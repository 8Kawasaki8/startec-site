/* Jouw gevel (src/rooms/gevel.html): the entry of the site.
   - The three fields write the shared record (STSState, source 'typed') on every input and the
     sign follows the record (one STSScene.setSign(text, sector colour) per change, on either route;
     uithangbord.js leaves the sign to this room on index); without a scene object yet, #sign-dom,
     #sign-sr and the SVG <g id=landmark> are written directly, and again once the scene reports in.
   - A name that arrives from outside the room commits too: 'Zet op het bord' in the strip's sheet dispatches
     'sts:bord' (commit at once), typing in the sheet commits after the same 1.5 s pause as typing here, so the
     sentence, the live line and the flight never wait for a second press in the room.
   - Commit = Enter, the button 'Hang mijn bord op', a neighbour chip, or 1.5 s without typing
     with a name in the field. The first commit writes g=15 (all four switches on) when g is 0,
     switches the sentence above the sketch from the waiting line to the honesty variant (by
     STSState.source: typed / url, 'buur' for a fictional neighbour) and lets the city fly to the place
     'gevel': the room reports data-plek 'start' until then, so uithangbord.js frames the sign from
     places.start first and from places.gevel after the commit. Arriving with a name (share link,
     card, storage) commits at once. The sketch itself (STSPreview.render) is always there and follows
     every keystroke: 'Jouw zaak' until a name is typed, so the CTA is reachable on a fresh page too.
   - Four switches flip one bit each in g (STSState.G) and hide their [data-el] block; 'Om 19 u'
     adds .night to the screen. 'Deel deze schets' builds the explicit URL with STSState.toShareQuery
     (zaak, sector, gemeente, g) and uses navigator.share, else the clipboard, else shows the link.
   - Nothing typed for 4 s: three fictional neighbours from STS_PREVIEW.buren ('(verzonnen)' in the
     name). Timers are cleared when the room leaves the viewport (window.STS_ROOMS.gevel).
   - The CTA data-bericht=gevel adds one visitor-voice line to the frozen template (STSBericht.prefill lines). */
(function () {
  var d = document, S = window.STSState, N = window.STSNames, D = window.STS_PREVIEW, V = window.STSPreview;
  var room = d.getElementById("gevel"), form = room && room.querySelector("[data-gevel-form]");
  if (!room || !form || !S || !N || !D || !V) return;
  var q = function (sel) { return room.querySelector(sel); };
  var naam = form.elements.zaak, gemeente = form.elements.gemeente, radios = form.elements.sector;
  var result = q("[data-gevel-result]"), zin = q("[data-gevel-zin]"), live = q("[data-gevel-live]"), screen = q("[data-gevel-screen]");
  var buren = q("[data-gevel-buren]"), burenLijst = q("[data-gevel-buren-lijst]");
  var nightBtn = q("[data-gevel-night]"), nightZin = q("[data-gevel-night-zin]"), switches = [].slice.call(room.querySelectorAll("[data-gevel-switch]"));
  var deel = q("[data-gevel-deel]"), deelStatus = q("[data-gevel-deel-status]"), cta = q("[data-bericht=gevel]");
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var committed = false, touched = false, night = false, idleTimer = 0, burenTimer = 0, burenShown = false;

  /* ── the sign ─────────────────────────────────────────────────────────── */
  function sign(s) {
    var c = N.sectorColour(s.sector), sc = window.STSScene;
    if (sc && typeof sc.setSign === "function") { sc.setSign(s.zaak, c); return; }
    var dom = d.getElementById("sign-dom"), sr = d.getElementById("sign-sr"), lm = d.getElementById("landmark");
    if (dom) { dom.textContent = s.zaak; dom.style.setProperty("--sign", c); }
    if (sr) sr.textContent = s.zaak ? "Uithangbord: " + s.zaak : "Uithangbord zonder naam";
    if (lm) { lm.setAttribute("fill", c); lm.setAttribute("stroke", c); }
  }

  /* ── the form mirrors the record (the strip's sheet edits the same one) ── */
  function fillForm(s) {
    if (d.activeElement !== naam && naam.value !== s.zaak) naam.value = s.zaak;
    if (d.activeElement !== gemeente && gemeente.value !== s.gemeente) gemeente.value = s.gemeente;
    [].forEach.call(radios, function (r) { r.checked = r.value === s.sector; });
  }
  form.addEventListener("input", function (e) {
    var t = e.target, p = {};
    if (t.name !== "zaak" && t.name !== "sector" && t.name !== "gemeente") return;
    p[t.name] = t.value;
    S.set(p, "typed");   /* onState lights the sign */
    hideBuren();
    clearTimeout(idleTimer);
    if (naam.value.trim()) idleTimer = setTimeout(function () { idleTimer = 0; commit("idle"); }, 1500);
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); commit("button"); });

  /* ── commit: sentence, sketch, flight ────────────────────────────────── */
  function variant(s) { return /\(verzonnen\)/.test(s.zaak) ? "buur" : (s.source === "url" ? "url" : "typed"); }
  function gOf(s) { return (!s.g && !touched) ? 15 : s.g; }   // all four on until the visitor touches a switch
  /* the sketch is always there: 'Jouw zaak' and the waiting sentence until a name is committed */
  function render(s) {
    var g = gOf(s);
    zin.textContent = committed && s.zaak ? D.zin[variant(s)].replace("{zaak}", s.zaak) : D.zin.wacht;
    V.render(screen, s, { g: g, night: night });
    switches.forEach(function (b) { b.setAttribute("aria-pressed", (g & S.G[b.getAttribute("data-gevel-switch")]) ? "true" : "false"); });
  }
  function fly() {
    var U = window.STSUithangbord, sc = window.STSScene;
    if (U && typeof U.refresh === "function") U.refresh();
    else if (sc && sc.places && sc.places.gevel) sc.flyTo("gevel").catch(function () { /* interrupted */ });
  }
  function commit(how) {
    var s = S.get();
    if (!s.zaak) return;
    clearTimeout(idleTimer); idleTimer = 0; hideBuren();
    if (!s.g && !touched) s = S.set({ g: 15 }, s.source || "typed");
    var first = !committed;
    committed = true;
    render(s);
    live.textContent = "De schets voor " + s.zaak + " staat klaar.";
    if (first) { room.setAttribute("data-plek", "gevel"); fly(); }
    if (how !== "idle" && how !== "init" && result.getBoundingClientRect().top > innerHeight - 160) {
      result.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }
  function onState(s) {
    fillForm(s);
    sign(s);
    if (!s.zaak) committed = false;
    if (s.zaak && !committed && !form.contains(d.activeElement)) {   /* typed in the sheet, Wis-then-retype: commit after the pause */
      clearTimeout(idleTimer); idleTimer = setTimeout(function () { idleTimer = 0; commit("init"); }, 1500);
    }
    render(s);
  }
  addEventListener("sts:bord", function () { commit("init"); });
  ["sts:scene-ready", "sts:scene-failed", "sts:intro-done"].forEach(function (n) { addEventListener(n, function () { sign(S.get()); }); });

  /* ── switches and 'Om 19 u' ───────────────────────────────────────────── */
  switches.forEach(function (b) {
    b.addEventListener("click", function () {
      var s = S.get(), bit = S.G[b.getAttribute("data-gevel-switch")] || 0, g = gOf(s);
      touched = true;
      S.set({ g: g ^ bit }, s.source || "typed");
    });
  });
  nightBtn.addEventListener("click", function () {
    night = !night;
    nightBtn.setAttribute("aria-pressed", night ? "true" : "false");
    nightZin.hidden = !night;
    screen.classList.toggle("night", night);
  });

  /* ── share: explicit URL with zaak, sector, gemeente and g ────────────── */
  function status(msg) { deelStatus.hidden = false; deelStatus.textContent = msg; }
  function copyLink(url) {
    var shown = function () { status("Kopieer deze link zelf: " + url); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { status("Link gekopieerd. Plak hem in een berichtje: " + url); }, shown);
    else shown();
  }
  deel.addEventListener("click", function () {
    var s = S.get(), url = new URL(S.toShareQuery("index.html#gevel", gOf(s)), location.href).href;
    var text = D.deelTekst.replace("{zaak}", s.zaak || "deze zaak");
    if (navigator.share) {
      navigator.share({ title: (s.zaak || "Een zaak") + " op het uithangbord", text: text, url: url })
        .then(function () { status("De link staat in je deelmenu: " + url); }, function () { copyLink(url); });
      return;
    }
    copyLink(url);
  });

  /* ── the CTA: the frozen template plus one visitor line ───────────────── */
  if (cta) cta.addEventListener("click", function (e) {
    var B = window.STSBericht;
    if (!B || typeof B.prefill !== "function") return;
    e.preventDefault();
    B.prefill({ key: "gevel", lines: [D.berichtRegel] });
  });

  /* ── neighbours after 4 s without a name ──────────────────────────────── */
  D.buren.forEach(function (b) {
    var chip = d.createElement("button");
    chip.type = "button"; chip.className = "btn btn-sm"; chip.textContent = b.zaak + " (verzonnen)";
    chip.addEventListener("click", function () {
      S.set({ zaak: b.zaak + " (verzonnen)", sector: b.sector, gemeente: b.gemeente }, "typed");
      commit("buur");
    });
    burenLijst.appendChild(chip);
  });
  function armBuren() {
    clearTimeout(burenTimer); burenTimer = 0;
    if (burenShown || committed || S.get().zaak) return;
    burenTimer = setTimeout(function () { burenTimer = 0; if (!S.get().zaak && !committed) { burenShown = true; buren.hidden = false; } }, 4000);
  }
  function hideBuren() { clearTimeout(burenTimer); burenTimer = 0; buren.hidden = true; }
  function rest() { clearTimeout(burenTimer); burenTimer = 0; }
  var ROOMS = window.STS_ROOMS = window.STS_ROOMS || {};
  ROOMS.gevel = { enter: armBuren, leave: rest };
  addEventListener("pagehide", function () { rest(); clearTimeout(idleTimer); }, { once: true });

  /* ── start ─────────────────────────────────────────────────────────────── */
  var s0 = S.get();
  if (s0.zaak) commit("init"); else room.setAttribute("data-plek", "start");
  S.subscribe(onState);
  armBuren();   // the room is the first viewport: its enter hook may already have fired before this script registered it
})();
