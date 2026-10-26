/* Uithangbord: the one navigation (src/partials/uithangbord.html), on every page.
   - Below 900 px the block moves to the end of <body> (the dock is the last element).
   - Legacy anchors of the old site map to the rooms (#contact -> #bericht, ...).
   - The name chip mirrors STSState; the sheet edits the same record live, 'Wis' clears
     it, 'Minder animatie' toggles sts-lite like the footer button; Escape closes the sheet
     and focus returns to the chip.
   - On pages with sections ([data-room] or [data-plek]) one IntersectionObserver names the
     section at the viewport's midline: the matching door gets aria-current, and 300 ms
     after the last change the city flies there (STSScene.flyTo, never on scroll position;
     skipped when the camera already stands there). The same observer feeds
     STSScene.cover() with the fraction of the viewport covered by opaque rooms and calls the
     room hooks window.STS_ROOMS[id].{init, enter, leave} so a room stops its timeline when it
     scrolls out, when the tab hides and on pagehide. Rooms registered late can call
     STSUithangbord.refresh().
   - On pages with a scene but without the gevel room the sign follows the state here (setSign with
     the sector colour); on index the room Jouw gevel (gevel.js) owns that binding, so one keystroke
     costs one texture. 'Zet op het bord' dispatches 'sts:bord' so that room commits the name at once.
   - The sheet is role=dialog without a focus trap (aria-modal=false): Tab out of it closes it. */
(function () {
  var d = document, S = window.STSState, N = window.STSNames;
  var ub = d.querySelector(".uithangbord"), chip = d.querySelector("[data-ub-chip]"), chipTxt = d.querySelector("[data-ub-chip-txt]");
  var sheet = d.getElementById("ub-sheet"), form = sheet && sheet.querySelector("[data-ub-form]");
  if (!ub || !chip || !sheet || !form) return;
  var LEGACY = { contact: "bericht", vragen: "bericht", probeer: "gevel", start: "gevel", oplossingen: "gevel", demos: "buren", lab: "verder", werkwijze: "verder", bouwen: "verder", onderzoek: "verder" };

  /* the dock is the last element in <body>: moved now, again after the parser's last script and after the
     scene module appended its viewport probe (both dispatch nothing visible; appendChild of a fixed block is free) */
  var phone = matchMedia("(max-width: 899px)").matches;
  function toEnd() { if (phone && ub.parentNode && d.body.lastElementChild !== ub) d.body.appendChild(ub); }
  toEnd();
  d.addEventListener("DOMContentLoaded", toEnd);

  /* legacy anchors: rewrite the hash and land on the room (same-page only) */
  function mapHash() {
    var h = location.hash.slice(1), q = h.indexOf("?"), name = q < 0 ? h : h.slice(0, q), to = LEGACY[name];
    if (!to || !d.getElementById(to)) return;
    try { history.replaceState(history.state, "", location.origin + location.pathname + location.search + "#" + to + (q < 0 ? "" : h.slice(q))); } catch (e) { /* sandbox */ }
    d.getElementById(to).scrollIntoView();
  }
  mapHash();
  addEventListener("hashchange", mapHash);

  /* the chip and the sheet follow the state */
  function label(s) {
    if (!s.zaak) return "Hoe heet je zaak?";
    var parts = [s.zaak], sec = N && s.sector && s.sector !== "anders" ? N.sectorLabel(s.sector) : "";
    if (sec) parts.push(sec);
    if (s.gemeente) parts.push(s.gemeente);
    return parts.join(" · ");
  }
  function fillForm(s) {
    var z = form.elements.zaak, g = form.elements.gemeente;
    if (d.activeElement !== z && z.value !== s.zaak) z.value = s.zaak;
    if (d.activeElement !== g && g.value !== s.gemeente) g.value = s.gemeente;
    [].forEach.call(form.elements.sector, function (r) { r.checked = r.value === s.sector; });
  }
  function onState(s) { chipTxt.textContent = label(s); chip.classList.toggle("is-leeg", !s.zaak); fillForm(s); sign(s); }
  if (S) S.subscribe(onState); else onState({ zaak: "", sector: "", gemeente: "" });

  form.addEventListener("input", function (e) {
    if (!S) return;
    var t = e.target, p = {};
    if (t.name === "zaak" || t.name === "gemeente" || t.name === "sector") { p[t.name] = t.value; S.set(p, "typed"); }
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); close(); if (S && S.get().zaak) dispatchEvent(new CustomEvent("sts:bord")); });   /* gevel.js commits on it */
  form.querySelector("[data-ub-wis]").addEventListener("click", function () { if (S) S.clear(); form.reset(); form.elements.zaak.focus({ preventScroll: true }); });

  /* sheet: open, close with focus return, Escape, click outside */
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
  function onOutside(e) { if (!sheet.contains(e.target) && !chip.contains(e.target)) close(false); }
  function open() {
    sheet.hidden = false; chip.setAttribute("aria-expanded", "true");
    form.elements.zaak.focus({ preventScroll: true });
    d.addEventListener("keydown", onKey); d.addEventListener("pointerdown", onOutside, true);
  }
  function close(back) {
    if (sheet.hidden) return;
    sheet.hidden = true; chip.setAttribute("aria-expanded", "false");
    d.removeEventListener("keydown", onKey); d.removeEventListener("pointerdown", onOutside, true);
    if (back !== false) chip.focus({ preventScroll: true });
  }
  chip.addEventListener("click", function () { sheet.hidden ? open() : close(); });
  /* keyboard: focus that leaves the sheet (Tab past the last button) closes it, so no stale dialog stays open */
  sheet.addEventListener("focusout", function (e) { var to = e.relatedTarget; if (to && !sheet.contains(to) && !chip.contains(to)) close(false); });

  /* Minder animatie: the same key as the footer button (sts-lite, see lite.js); the page reloads so the scene loader reads it */
  var lite = /[?&]lite\b/.test(location.search), sw = form.querySelector("[data-lite-switch]"), st = sw.querySelector("[data-lite-state]");
  try { lite = lite || localStorage.getItem("sts-lite") === "1"; } catch (e) { /* storage blocked */ }
  sw.setAttribute("aria-checked", lite ? "true" : "false"); st.textContent = lite ? "aan" : "uit";
  sw.addEventListener("click", function () {
    var stored = false;
    try { lite ? localStorage.removeItem("sts-lite") : localStorage.setItem("sts-lite", "1"); stored = true; } catch (e) { /* storage blocked */ }
    if (stored) { location.reload(); return; }
    var p = new URLSearchParams(location.search); lite ? p.delete("lite") : p.set("lite", "1");
    location.assign(location.pathname + (p.toString() ? "?" + p : "") + location.hash);
  });

  /* doors: the one whose same-page anchor names the current section; the dock scrolls the current door into view
     (also the page's own aria-current=page door at load, on simulatie, gereedschap and werkwijze) */
  var doors = [].slice.call(ub.querySelectorAll("nav a[href]"));
  function showDoor(a) { var ul = a.closest("ul"); if (ul && ul.scrollWidth > ul.clientWidth) ul.scrollLeft = Math.max(0, Math.min(a.offsetLeft - 12, ul.scrollWidth - ul.clientWidth)); }
  function markDoor(id) {
    doors.forEach(function (a) {
      var h = a.getAttribute("href"), same = !!id && h.charAt(0) === "#" && h.slice(1) === id;
      a.classList.toggle("is-active", same);
      if (same) { a.setAttribute("aria-current", "location"); showDoor(a); }
      else if (a.getAttribute("aria-current") === "location") a.removeAttribute("aria-current");
    });
  }
  function showCurrent() { var a = ub.querySelector('nav a[aria-current="page"]'); if (a) showDoor(a); }
  showCurrent();
  d.addEventListener("DOMContentLoaded", showCurrent);

  /* sections: current place, flights, cover, room hooks */
  var ROOMS = window.STS_ROOMS = window.STS_ROOMS || {};
  var rooms = [].slice.call(d.querySelectorAll("[data-room], [data-plek]"));
  var inView = {}, heights = {}, glass = {}, current = null, at = "start", pending = null, timer = 0;
  function placeOf(el) { return el.getAttribute("data-plek") || el.id; }
  function hook(id, name) {
    var r = ROOMS[id]; if (!r) return;
    try {
      if (name === "enter" && !r.__init && typeof r.init === "function") { r.__init = true; r.init(); }
      if (typeof r[name] === "function") r[name]();
    } catch (e) { /* one room must not stop the others */ }
  }
  function ready() { var sc = window.STSScene; return sc && !d.getElementById("intro") ? sc : null; }
  function fly(id) {
    var sc = ready();
    if (!sc) { pending = id; return; }
    pending = null;
    if (!sc.places || !sc.places[id] || id === at) return;
    at = id; sc.flyTo(id).catch(function () { /* interrupted by a newer flight */ });
  }
  function update() {
    var mid = innerHeight / 2, hit = null, h = 0, k;
    rooms.forEach(function (el) { if (!inView[el.id || placeOf(el)]) return; var r = el.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) hit = el; });
    if (hit !== current) { current = hit; markDoor(hit ? hit.id : ""); }
    clearTimeout(timer);
    timer = setTimeout(function () { if (current) fly(placeOf(current)); }, 300);
    for (k in heights) h += heights[k];
    if (window.STSScene) window.STSScene.cover(Math.min(1, h / Math.max(1, innerHeight)));
  }
  function alpha(c) { var m = /rgba?\(([^)]+)\)/.exec(c || ""); return m ? (m[1].split(",")[3] === undefined ? 1 : parseFloat(m[1].split(",")[3])) : 0; }
  if (rooms.length && "IntersectionObserver" in window) {
    rooms.forEach(function (el) { glass[el.id || placeOf(el)] = !el.hasAttribute("data-room") || alpha(getComputedStyle(el).backgroundColor) < 0.5; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var el = en.target, key = el.id || placeOf(el), was = inView[key];
        inView[key] = en.isIntersecting;
        heights[key] = glass[key] ? 0 : en.intersectionRect.height;
        if (el.hasAttribute("data-room") && (en.isIntersecting ? !was : was)) hook(el.id, en.isIntersecting ? "enter" : "leave");
      });
      update();
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
    rooms.forEach(function (el) { io.observe(el); });
    d.addEventListener("visibilitychange", function () { rooms.forEach(function (el) { if (el.hasAttribute("data-room") && inView[el.id]) hook(el.id, d.hidden ? "leave" : "enter"); }); });
    addEventListener("pagehide", function () { rooms.forEach(function (el) { if (el.hasAttribute("data-room") && inView[el.id]) hook(el.id, "leave"); }); io.disconnect(); }, { once: true });
  }
  function flush() { if (pending) fly(pending); }
  ["sts:scene-ready", "sts:scene-failed", "sts:intro-done"].forEach(function (n) { addEventListener(n, function () { toEnd(); if (S) sign(S.get()); flush(); }); });

  /* the sign follows the state (debounced 120 ms: one texture per pause in typing); not on index, where gevel.js owns it */
  var signTimer = 0, gevelOwnsSign = !!d.getElementById("gevel");
  function sign(s) {
    if (gevelOwnsSign || !window.STSScene || !d.getElementById("sign-dom")) return;
    clearTimeout(signTimer);
    signTimer = setTimeout(function () { window.STSScene.setSign(s.zaak, N ? N.sectorColour(s.sector) : undefined); }, 120);
  }

  window.STSUithangbord = { open: open, close: close, refresh: update, current: function () { return current ? current.id : ""; } };
})();
