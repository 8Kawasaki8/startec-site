/* De telefoon om 19 u (index#telefoon). One GSAP timeline plays a fictional Tuesday, 07:00 to
   20:00, in 40 s (1x or 2x, play/pause, skip). Data: window.SIM_DAG (sim-dag-data.js), whose
   header documents the rules. The outcome of a call is a pure function of (call, band, mode);
   the timeline SVG is a pure function of (width, calls, mode) and is rebuilt only on a debounced
   resize or a new sector/mode. During play only transforms move: each marker scales in at its
   minute, the playhead translates; the clock and the counters are text written once per minute.
   Counters stay aria-hidden while playing; one aria-live=polite sentence is written at the end.
   Reduced motion, lite and a missing GSAP show the end state at once; the controls keep working.
   Room hooks: window.STS_ROOMS.telefoon = {init, enter, leave} (uithangbord.js calls leave when
   the room scrolls out, when the tab hides and on pagehide). No setInterval, no setTimeout but
   the resize debounce. Debug: window.STSDag.debug = {paused, status, sector, mode, speed, counts}. */
(function () {
  var D = window.SIM_DAG, room = document.getElementById("telefoon");
  if (!D || !room) return;
  var q = function (s) { return room.querySelector(s); };
  var E = { tijd: q("[data-dag-tijdlijn]"), lijst: q("[data-dag-lijst]"), klok: q("[data-dag-klok]"), wie: q("[data-dag-wie]"), play: q("[data-dag-play]"), skip: q("[data-dag-skip]"),
    tellers: q("[data-dag-tellers]"), uit: q("[data-dag-uitkomst]"), aan: q("[data-dag-aanname]"), kassa: q("[data-dag-kassa]"), bespreek: q("[data-dag-bespreek]"), form: q("[data-dag-form]") };
  if (!E.tijd || !E.form || !E.play) return;
  var N = window.STSNames, ST = window.STSState, G = window.gsap || null;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, lite = /[?&]lite\b/.test(location.search);
  try { lite = lite || localStorage.getItem("sts-lite") === "1"; } catch (e) { /* storage blocked */ }
  var instant = reduce || lite || !G;
  var DUR = 40, T0 = min(D.van), T1 = min(D.tot), KEYS = ["opgenomen", "gemist", "bericht", "teruggebeld"];
  var S = { sector: "horeca", raw: "", mode: 1, speed: 1, status: "idle", tl: null, head: { p: 0 }, calls: [], lay: null, naald: null, off: true, hidden: false, lastMin: -1, counts: zero() };

  /* ── pure helpers ─────────────────────────────────────────── */
  function min(hhmm) { var p = String(hhmm).split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
  function hhmm(m) { var h = Math.floor(m / 60), r = m % 60; return (h < 10 ? "0" : "") + h + ":" + (r < 10 ? "0" : "") + r; }
  function zero() { return { opgenomen: 0, gemist: 0, bericht: 0, teruggebeld: 0 }; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function script(sector) { return D.sectoren[D.alias[sector] || sector] || D.sectoren.horeca; }
  function bands(sc) { return sc.banden.map(function (b) { return { van: min(b[0]), tot: min(b[1]), label: b[2] }; }); }
  function bandAt(t, bs) { for (var i = 0; i < bs.length; i++) if (t >= bs[i].van && t < bs[i].tot) return bs[i]; return null; }
  /* The rule of the data file header: outside a band answered; in a band wa -> bericht (mode 3), tb -> teruggebeld (mode 2 and 3), else gemist. */
  function outcome(flags, band, mode) {
    if (!band) return "opgenomen";
    if (mode === 3 && /\bwa\b/.test(flags)) return "bericht";
    if (mode >= 2 && /\btb\b/.test(flags)) return "teruggebeld";
    return "gemist";
  }
  function calls(sc, mode) {
    var bs = bands(sc);
    return sc.oproepen.map(function (o) { var t = min(o[0]), b = bandAt(t, bs); return { t: t, uur: o[0], wie: o[1], band: b, uit: outcome(o[2] || "", b, mode) }; })
      .sort(function (a, b) { return a.t - b.t; });
  }
  function tally(list, upTo) { var c = zero(); list.forEach(function (x) { if (upTo == null || x.t <= upTo) c[x.uit]++; }); return c; }
  function waShare(sc) { var busy = 0, wa = 0, bs = bands(sc); sc.oproepen.forEach(function (o) { if (bandAt(min(o[0]), bs)) { busy++; if (/\bwa\b/.test(o[2] || "")) wa++; } }); return wa + " van de " + busy; }

  /* Geometry: a pure function of (width, calls). Narrow widths run the day top to bottom (phone, within 60svh). */
  function layout(W, list) {
    var vertical = W < 560, H = vertical ? 440 : 200, span = T1 - T0, l = {}, lanes = [];
    l.vertical = vertical; l.W = W; l.H = H;
    l.axis = vertical ? 44 : 150;                                   /* x of the axis (vertical) or y of the axis (horizontal) */
    l.p0 = vertical ? 12 : 10; l.p1 = vertical ? H - 12 : W - 10;   /* start and end of the time axis in px */
    l.pos = function (t) { return l.p0 + (t - T0) / span * (l.p1 - l.p0); };
    l.marks = list.map(function (c) {
      var p = l.pos(c.t), lane = 0;
      while (lanes[lane] != null && p - lanes[lane] < 18) lane++;
      lanes[lane] = p;
      return vertical ? { x: W - 26 - lane * 20, y: p } : { x: p, y: l.axis - 24 - lane * 20 };   /* vertical: markers at the right edge, the band label keeps the left */
    });
    return l;
  }
  function render(W, list, mode) {
    var l = layout(W, list), sc = script(S.sector), s = "", bs = bands(sc), v = l.vertical, h;
    bs.forEach(function (b) {
      var a = l.pos(b.van), z = l.pos(b.tot), label = b.label, fits = (z - a) >= (v ? 14 : label.length * 6.8 + 10);
      s += v ? '<rect class="bnd" x="' + l.axis + '" y="' + a.toFixed(1) + '" width="' + (W - 8 - l.axis) + '" height="' + (z - a).toFixed(1) + '"/>'
             : '<rect class="bnd" x="' + a.toFixed(1) + '" y="40" width="' + (z - a).toFixed(1) + '" height="' + (l.axis - 40) + '"/>';
      if (fits) s += '<text class="bnd-l" x="' + (v ? l.axis + 8 : a + 6).toFixed(1) + '" y="' + (v ? a + 13 : 54).toFixed(1) + '">' + esc(label) + "</text>";
    });
    s += v ? '<line class="as" x1="' + l.axis + '" x2="' + l.axis + '" y1="' + l.p0 + '" y2="' + l.p1 + '"/>' : '<line class="as" x1="' + l.p0 + '" x2="' + l.p1 + '" y1="' + l.axis + '" y2="' + l.axis + '"/>';
    var every = v ? 1 : (W < 820 ? 2 : 1);
    for (h = Math.ceil(T0 / 60); h * 60 <= T1; h++) {
      var p = l.pos(h * 60), lbl = (h - Math.ceil(T0 / 60)) % every === 0;
      s += v ? '<line class="tk" x1="' + (l.axis - 4) + '" x2="' + l.axis + '" y1="' + p.toFixed(1) + '" y2="' + p.toFixed(1) + '"/>' : '<line class="tk" x1="' + p.toFixed(1) + '" x2="' + p.toFixed(1) + '" y1="' + l.axis + '" y2="' + (l.axis + 5) + '"/>';
      if (lbl) s += v ? '<text class="ul" x="' + (l.axis - 9) + '" y="' + (p + 4).toFixed(1) + '" text-anchor="end">' + h + " u</text>" : '<text class="ul" x="' + p.toFixed(1) + '" y="' + (l.axis + 20) + '" text-anchor="middle">' + h + " u</text>";
    }
    s += '<g class="naald" data-dag-naald>' + (v ? '<line x1="' + (l.axis - 6) + '" x2="' + (W - 8) + '" y1="0" y2="0"/>' : '<line x1="0" x2="0" y1="30" y2="' + (l.axis + 6) + '"/>') + "</g>";
    list.forEach(function (c, i) {
      var m = l.marks[i];
      s += '<g transform="translate(' + m.x.toFixed(1) + " " + m.y.toFixed(1) + ')"><g class="mk mk-' + c.uit + '" data-dag-mk><circle r="7"/>' + (c.uit === "bericht" ? '<circle class="mk-in" r="2.5"/>' : "") + "</g></g>";
    });
    return '<svg viewBox="0 0 ' + W + " " + l.H + '" width="' + W + '" height="' + l.H + '" aria-hidden="true" focusable="false">' + s + "</svg>";
  }

  /* ── copy ─────────────────────────────────────────────────── */
  function n(k, one, many) { return k + " " + (k === 1 ? one : many); }
  function sentence(sc, c, mode) {
    var s = "In deze verzonnen dinsdag bij een " + sc.soort + " in " + sc.district + (c.gemist === 1 ? " ging 1 oproep verloren" : " gingen " + c.gemist + " oproepen verloren") + " toen niemand opnam.";
    if (mode === 2) s += " In dit scenario " + (c.teruggebeld === 1 ? "werd 1 beller" : "werden " + c.teruggebeld + " bellers") + " die avond teruggebeld na het bericht met terugbelbelofte.";
    if (mode === 3) s += " In dit scenario " + (c.bericht === 1 ? "kwam er met een WhatsApp-knop 1 oproep" : "kwamen er met een WhatsApp-knop " + c.bericht + " oproepen") + " als bericht binnen" + (c.teruggebeld ? " en " + (c.teruggebeld === 1 ? "werd 1 beller" : "werden " + c.teruggebeld + " bellers") + " teruggebeld" : "") + ".";
    return s + " Een aanname in een gesimuleerde dag, geen voorspelling over jouw zaak.";
  }
  function aanname(sc, mode) {
    var s = mode === 1 ? "Regel in dit scenario: valt een oproep in een drukke band, dan neemt niemand op. Daarbuiten wordt elke oproep opgenomen."
      : mode === 2 ? "Regel in dit scenario: in een drukke band hoort de beller een bericht met de belofte dat de zaak terugbelt. Welke bellers daarop wachten en die avond bereikt worden, ligt vast in het script: een aanname, geen meting."
      : "Regel in dit scenario: " + waShare(sc) + " drukke oproepen komen als WhatsApp-bericht binnen in plaats van als gemiste oproep; dat aandeel ligt per sector vast in het script. Een aanname, geen meting.";
    if (D.alias[S.raw]) s += " Je koos " + ((N && N.sectorLabel(S.raw)) || S.raw).toLowerCase() + "; die speelt het script van de " + sc.soort + ".";
    return s;
  }
  function mirror(list) {
    E.lijst.innerHTML = list.map(function (c) { return "<li>" + esc(c.uur + ", " + c.wie + ": " + c.uit + (c.band ? " (" + c.band.label + ")" : "")) + "</li>"; }).join("");
  }

  /* ── DOM state ────────────────────────────────────────────── */
  function setCounts(c) {
    S.counts = c;
    KEYS.forEach(function (k) { var el = E.tellers.querySelector('[data-dag-n="' + k + '"]'); if (el && el.textContent !== String(c[k])) el.textContent = String(c[k]); });
  }
  function place(now) {
    if (!S.naald || !S.lay) return;
    var p = S.lay.pos(now).toFixed(2);
    S.naald.setAttribute("transform", S.lay.vertical ? "translate(0 " + p + ")" : "translate(" + p + " 0)");
  }
  function tick() {
    var now = T0 + S.head.p * (T1 - T0), m = Math.floor(now);
    place(now);
    if (m === S.lastMin) return;
    S.lastMin = m;
    E.klok.textContent = hhmm(m);
    setCounts(tally(S.calls, m));
  }
  function label() {
    E.play.textContent = S.status === "playing" ? "Pauzeer" : S.status === "paused" ? "Speel verder" : S.status === "done" ? "Speel opnieuw" : "Speel de dinsdag";
    E.skip.hidden = S.status === "done";
  }
  function finish() {
    S.status = "done"; S.lastMin = T1;
    E.klok.textContent = hhmm(T1); place(T1);
    setCounts(tally(S.calls));
    E.tellers.setAttribute("aria-hidden", "false");
    E.uit.textContent = sentence(script(S.sector), S.counts, S.mode);
    label();
  }
  function reset() {
    S.status = "idle"; S.lastMin = -1; S.head.p = 0;
    E.klok.textContent = hhmm(T0); place(T0);
    setCounts(zero());
    E.tellers.setAttribute("aria-hidden", "true");
    E.uit.textContent = "";
    label();
  }

  /* ── one timeline per (sector, mode, width) ───────────────── */
  function build() {
    var sc = script(S.sector), W = Math.max(280, Math.round(E.tijd.clientWidth || room.clientWidth || 320));
    if (S.tl) { S.tl.kill(); S.tl = null; }
    S.calls = calls(sc, S.mode); S.lay = layout(W, S.calls);
    E.tijd.innerHTML = render(W, S.calls, S.mode);
    S.naald = E.tijd.querySelector("[data-dag-naald]");
    mirror(S.calls);
    E.wie.textContent = sc.naam + " (verzonnen) · " + sc.district + " · " + D.dag;
    E.aan.textContent = aanname(sc, S.mode);
    if (E.kassa) E.kassa.setAttribute("href", "gereedschap.html#whatsapp?bericht=" + encodeURIComponent(sc.opener));
    S.head = { p: 0 };
    if (!G) { reset(); finish(); return; }                           /* no GSAP: a still end state */
    var marks = E.tijd.querySelectorAll("[data-dag-mk]");
    G.set(marks, { scale: 0, transformOrigin: "50% 50%" });
    var tl = G.timeline({ paused: true, onUpdate: tick, onComplete: finish });
    tl.to(S.head, { p: 1, duration: DUR, ease: "none" }, 0);
    S.calls.forEach(function (c, i) {
      tl.to(marks[i], { scale: 1, duration: instant ? 0.01 : 0.45, ease: instant ? "none" : "back.out(2.4)" }, (c.t - T0) / (T1 - T0) * DUR);
    });
    tl.timeScale(S.speed);
    S.tl = tl;
    reset();
  }
  function rebuild() {
    var was = S.status, p = S.tl ? S.tl.progress() : 0;
    build();
    if (!S.tl) return;
    if (instant || was === "done") S.tl.progress(1);
    else if (was === "playing" || was === "paused") { S.tl.progress(p); S.status = was; label(); sync(); }
  }
  function paused() { return S.off || S.hidden; }
  function sync() {
    if (!S.tl) return;
    if (S.status === "playing") { if (paused()) S.tl.pause(); else S.tl.play(); }
  }

  /* ── controls ─────────────────────────────────────────────── */
  E.play.addEventListener("click", function () {
    if (!S.tl) { S.status === "done" ? reset() : finish(); return; }
    S.off = false;                                                 /* the visitor is here: a click beats a late observer */
    if (instant) { reset(); S.tl.progress(1, true); finish(); return; }   /* reduced motion, lite: the end state at once, no 40 s run */
    if (S.status === "playing") { S.status = "paused"; S.tl.pause(); label(); return; }
    if (S.status === "done" || S.status === "idle") { reset(); S.tl.progress(0); }
    S.status = "playing"; label(); S.tl.play();
  });
  E.skip.addEventListener("click", function () { if (S.tl) S.tl.progress(1); else finish(); });
  [].forEach.call(room.querySelectorAll("[data-dag-speed]"), function (b) {
    b.addEventListener("click", function () {
      S.speed = +b.getAttribute("data-dag-speed") || 1;
      [].forEach.call(room.querySelectorAll("[data-dag-speed]"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      if (S.tl) S.tl.timeScale(S.speed);
    });
  });
  E.form.addEventListener("change", function (e) {
    var t = e.target;
    if (t.name === "dag-modus") { S.mode = +t.value || 1; rebuild(); }
    if (t.name === "dag-sector") {
      if (ST) ST.set({ sector: t.value }, "typed");                 /* the shared record; the subscription below rebuilds */
      else { S.sector = t.value; S.raw = t.value; rebuild(); }
    }
  });
  function setRadio(name, value) { [].forEach.call(E.form.elements[name], function (r) { r.checked = r.value === value; }); }
  function onState(s) {
    var k = s.sector ? (D.sectoren[s.sector] ? s.sector : (D.alias[s.sector] || "horeca")) : S.sector;
    if (k === S.sector && (s.sector || "") === S.raw && S.built) return;
    S.built = true;
    S.sector = k; S.raw = s.sector || "";
    setRadio("dag-sector", k);
    rebuild();
  }
  /* the Bericht: the key, the subject and, as the only place on the site, the example message the caller heard */
  if (E.bespreek) E.bespreek.addEventListener("click", function (e) {
    var B = window.STSBericht; if (!B) return;
    e.preventDefault();
    var sc = script(S.sector), modus = E.form.elements["dag-modus"].value, kop = modus === "3" ? "WhatsApp-knop + bericht met de echte uren" : modus === "2" ? "Bericht met terugbelbelofte" : "Niemand neemt op";
    B.prefill({ key: "telefoon", subject: "Antwoord buiten de uren (onderzoek)", lines: ["In de simulatie koos ik '" + kop + "'.", "Het bericht dat de beller daar hoorde, zou ik zelf ook willen instellen: “" + sc.antwoord + "”"] });
  });

  /* ── pause on leave, on hidden, on pagehide (room hooks of uithangbord.js) ── */
  var ROOMS = window.STS_ROOMS = window.STS_ROOMS || {};
  ROOMS.telefoon = {
    init: function () { /* the DOM is prepared at load; nothing to do twice */ },
    enter: function () { S.off = false; S.hidden = document.hidden; sync(); },
    leave: function () { S.off = true; sync(); }
  };
  document.addEventListener("visibilitychange", function () { S.hidden = document.hidden; sync(); });
  var rt = 0, lastW = 0;
  addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { var w = E.tijd.clientWidth; if (w && w !== lastW) { lastW = w; rebuild(); } }, 150);
  });

  /* ── start ────────────────────────────────────────────────── */
  if (ST) ST.subscribe(onState); else onState({ sector: "" });
  lastW = E.tijd.clientWidth;
  if (!window.STSUithangbord && !("IntersectionObserver" in window)) S.off = false;   /* no observer anywhere: never wait for an enter that cannot come */
  window.STSDag = {
    outcome: outcome, calls: calls, tally: tally, render: render,
    debug: { get paused() { return paused(); }, get status() { return S.status; }, get sector() { return S.sector; }, get mode() { return S.mode; }, get speed() { return S.speed; }, get counts() { return tally(S.calls, S.lastMin < 0 ? T0 - 1 : S.lastMin); }, get instant() { return instant; } }
  };
})();
