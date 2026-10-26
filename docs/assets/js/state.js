/* State core: the one record every page shares. {zaak, sector, gemeente, g, source}
   SOURCE ORDER on load: explicit ?zaak&sector&gemeente&g in location.search (share links,
   the A6 card, wijk buttons) -> written to sessionStorage 'sts-zaak' with source 'url' ->
   stripped from the address with history.replaceState, so normal navigation never carries
   the name. Without a query the record comes from sessionStorage; typing later sets source
   'typed'. When storage throws (blocked, private window) the record lives in memory and
   dies with the page. g is a 0-15 bitmask of the four sketch switches (bel 1, whatsapp 2,
   open 4, uren 8) and nothing else. Every change dispatches 'sts:zaak' on window with the
   record as detail. Depends on names.js (STSNames) for sanitising; falls back to a plain cap.
   API: window.STSState = { get, set(partial, source?), subscribe(fn), toShareQuery(path, g),
   clear, source, G, KEY } */
(function () {
  var KEY = "sts-zaak", G = { bel: 1, whatsapp: 2, open: 4, uren: 8 };
  var URL_KEYS = ["zaak", "sector", "gemeente", "g"];
  var state = { zaak: "", sector: "", gemeente: "", g: 0, source: "" };
  var subs = [], lastRaw = null;

  function N() { return window.STSNames || null; }
  function cleanName(v) { var n = N(); return n ? n.sanitise(v) : String(v == null ? "" : v).replace(/[\u0000-\u0008\u000E-\u001F]/g, "").replace(/\s+/g, " ").trim().slice(0, 40); }
  function cleanSector(v) { var n = N(); return n ? n.sector(v) : String(v || "").toLowerCase().slice(0, 20); }
  function cleanGemeente(v) { var n = N(); return n ? n.gemeente(v) : String(v == null ? "" : v).replace(/[\u0000-\u0008\u000E-\u001F]/g, "").replace(/\s+/g, " ").trim().slice(0, 30); }
  function cleanG(v) { var g = parseInt(v, 10); return isNaN(g) ? 0 : Math.max(0, Math.min(15, g)); }
  function cleanSource(v) { return v === "url" || v === "typed" ? v : ""; }

  /* Normalises any object shape; 'naam' and 'bron' are accepted aliases for zaak and source. */
  function normalise(o) {
    o = o || {};
    return {
      zaak: cleanName("zaak" in o ? o.zaak : o.naam),
      sector: cleanSector(o.sector),
      gemeente: cleanGemeente(o.gemeente),
      g: cleanG(o.g),
      source: cleanSource("source" in o ? o.source : o.bron)
    };
  }

  function same(a, b) { return a.zaak === b.zaak && a.sector === b.sector && a.gemeente === b.gemeente && a.g === b.g && a.source === b.source; }
  function copy() { return { zaak: state.zaak, sector: state.sector, gemeente: state.gemeente, g: state.g, source: state.source }; }
  function empty(s) { return !s.zaak && !s.sector && !s.gemeente && !s.g; }

  function storageRead() {
    var raw = null;
    try { raw = sessionStorage.getItem(KEY); } catch (e) { return null; }
    if (raw === lastRaw) return null;
    lastRaw = raw;
    if (!raw) return empty(state) ? null : normalise({});
    try { return normalise(JSON.parse(raw)); } catch (e) { return null; }
  }

  function storageWrite(s) {
    try {
      if (empty(s)) sessionStorage.removeItem(KEY);
      else sessionStorage.setItem(KEY, JSON.stringify(s));
      lastRaw = sessionStorage.getItem(KEY);
    } catch (e) { /* storage blocked: the record lives in memory for this page only */ }
  }

  function publish() {
    var d = copy();
    for (var i = 0; i < subs.length; i++) { try { subs[i](d); } catch (e) { /* one listener must not stop the others */ } }
    try { window.dispatchEvent(new CustomEvent("sts:zaak", { detail: d })); } catch (e) { /* no CustomEvent */ }
  }

  /* Another script (or the harness) may write sessionStorage directly: get() picks that up. */
  function sync() {
    var s = storageRead();
    if (s && !same(s, state)) { state = s; publish(); }
  }

  function get() { sync(); return copy(); }

  function set(partial, source) {
    sync();
    var next = normalise({
      zaak: partial && "zaak" in partial ? partial.zaak : (partial && "naam" in partial ? partial.naam : state.zaak),
      sector: partial && "sector" in partial ? partial.sector : state.sector,
      gemeente: partial && "gemeente" in partial ? partial.gemeente : state.gemeente,
      g: partial && "g" in partial ? partial.g : state.g,
      source: source || (partial && partial.source) || "typed"
    });
    if (empty(next)) next.source = "";
    if (same(next, state)) return copy();
    state = next;
    storageWrite(state);
    publish();
    return copy();
  }

  function clear() { return set({ zaak: "", sector: "", gemeente: "", g: 0 }, ""); }

  function subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    subs.push(fn);
    try { fn(get()); } catch (e) { /* listener error */ }
    return function () { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
  }

  /* 'index.html#gevel' + state -> 'index.html?zaak=...&sector=...&gemeente=...&g=5#gevel' (empty fields left out). */
  function toShareQuery(path, g) {
    var s = get(), p = String(path || ""), i = p.indexOf("#"), hash = i < 0 ? "" : p.slice(i), base = i < 0 ? p : p.slice(0, i);
    var q = [];
    if (s.zaak) q.push("zaak=" + encodeURIComponent(s.zaak));
    if (s.sector) q.push("sector=" + encodeURIComponent(s.sector));
    if (s.gemeente) q.push("gemeente=" + encodeURIComponent(s.gemeente));
    var bits = g == null ? s.g : cleanG(g);
    if (bits) q.push("g=" + bits);
    if (!q.length) return base + hash;
    return base + (base.indexOf("?") < 0 ? "?" : "&") + q.join("&") + hash;
  }

  /* On load: the address wins over storage, then leaves the address bar. */
  function fromUrl() {
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { return false; }
    var found = false, partial = {};
    URL_KEYS.forEach(function (k) { if (params.has(k)) { found = true; partial[k] = params.get(k); } });
    if (!found) return false;
    if (!("g" in partial)) partial.g = 0;
    set(partial, "url");
    URL_KEYS.forEach(function (k) { params.delete(k); });
    var rest = params.toString();
    var clean = location.origin + location.pathname + (rest ? "?" + rest : "") + location.hash;   // absolute: a <base> (404.html) must not redirect it
    try { history.replaceState(history.state, "", clean); } catch (e) { /* file: or sandbox */ }
    return true;
  }

  var stored = storageRead();
  if (stored) state = stored;
  fromUrl();

  var api = { get: get, set: set, subscribe: subscribe, toShareQuery: toShareQuery, clear: clear, G: G, KEY: KEY };
  try { Object.defineProperty(api, "source", { get: function () { return get().source; }, enumerable: true }); } catch (e) { api.source = state.source; }
  window.STSState = api;
})();
