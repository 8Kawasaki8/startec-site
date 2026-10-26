/* Van radar tot gesprek (werkwijze.html#radar, src/rooms/radar.html). A four-station stepper replays
   the real pipeline on a FICTIONAL neighbour (window.SIM_RADAR, sim-radar-data.js) of the sector on the
   sign; the visitor's gemeente is context, the visitor's name never appears in the replay.
   1 Zoeken: three sentences the verkenner noted. 2 Meten: six signal toggles (aria-pressed) feed
   STSScore.score, the same rule as the zichtbaarheidscheck; the ring is labelled 'illustratie van hoe
   we kijken, geen meting'. 3 Bouwen: three public-data cards slide (transform) into view next to a phone
   frame drawn by STSPreview.render. 4 Lezen: the first-contact draft rendered by build.py from
   radar-bericht.json ({zaak} and {gemeente} are replaced with the neighbour here), status 'Wacht op
   goedkeuring van Snymis', two buttons with honest outcomes; the privacy 2.2 readout shows only after
   Goedkeuren (the no-reaction case) and never after Niet sturen.
   Autoplay: the stations open one by one (1.8 s apart) once the stepper itself is half in view (one
   IntersectionObserver on the first station, disconnected after its first hit), never on the room's enter
   hook alone: a deep link to #straat below the room must not grow the page above the viewport. The chain
   is one setTimeout at a time, cleared on leave, hidden tab and pagehide (window.STS_ROOMS.radar); enter
   resumes it only after the stepper was seen. Reduced motion or lite: all four open at once, behind the
   same gate. No IntersectionObserver at all: play at once. {aanleiding} in the draft is the neighbour's
   own opening sentence (sim-radar-data.js), so the letter matches the findings of step 1.
   No rAF, no GSAP, no count-ups. */
(function () {
  var D = window.SIM_RADAR, room = document.getElementById("radar");
  if (!D || !room) return;
  var q = function (s) { return room.querySelector(s); }, qa = function (s) { return [].slice.call(room.querySelectorAll(s)); };
  var S = window.STSState, N = window.STSNames, Sc = window.STSScore, V = window.STSPreview;
  var E = { form: q("[data-rs-form]"), context: q("[data-rs-context]"), status: q("[data-rs-status]"), replay: q("[data-rs-replay]"),
    stappen: qa(".rs-stap"), vondst: q("[data-rs-vondst]"), signalen: q("[data-rs-signalen]"), arc: q("[data-rs-arc]"), score: q("[data-rs-score]"),
    live: q("[data-rs-score-live]"), kaarten: q("[data-rs-kaarten]"), screen: q("[data-rs-screen]"), brief: q("[data-rs-brief]"), briefStatus: q("[data-rs-brief-status] span"),
    onderwerp: q("[data-radar-onderwerp]"), tekst: q("[data-radar-tekst]"), uitkomst: q("[data-rs-uitkomst]"), readout: q("[data-rs-readout]") };
  if (!E.form || !E.stappen.length || !E.signalen || !E.tekst) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, lite = /[?&]lite\b/.test(location.search);
  try { lite = lite || localStorage.getItem("sts-lite") === "1"; } catch (e) { /* storage blocked */ }
  var instant = reduce || lite, STEP_MS = 1800, CIRC = 326.7;
  var st = { sector: "anders", chosen: false, over: {}, open: 0, timer: 0, playing: false, done: false, off: true, seen: false, decided: "" };
  var TPL = { onderwerp: E.onderwerp ? E.onderwerp.textContent : "", regels: [].map.call(E.tekst.querySelectorAll("p"), function (p) { return p.textContent; }) };
  var UIT = { ja: "Goedgekeurd in deze simulatie. In het echt beslist Snymis, en er vertrekt niets vanzelf.", nee: "Dan vertrekt er niets. Ook in het echt niet." };

  /* ── the neighbour of the current sector ─────────────────────────────── */
  function buur() {
    var b = D.buren[st.sector] || D.buren.anders, s = S ? S.get() : {}, g = (s && s.gemeente) || b.gemeente;
    return { naam: b.zaak, zaak: b.zaak + " (verzonnen)", gemeente: g, sector: st.sector, aan: st.over[st.sector] || b.aan.slice(), vondst: b.vondst, aanleiding: b.aanleiding || "" };
  }
  function label(sector) { return N ? N.sectorLabel(sector) : sector; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* ── render: context, vondst, signals and ring, cards and phone, the draft ── */
  function render() {
    var b = buur(), s = S ? S.get() : {};
    E.context.textContent = "Hieronder: " + b.zaak + ", " + b.gemeente + ". " + (s.zaak ? "Een buur van " + s.zaak + "; de echte cijfers van een zaak kennen we niet." : "De echte cijfers van een zaak kennen we niet.");
    E.vondst.replaceChildren.apply(E.vondst, b.vondst.map(function (t) { return el("li", "", t); }));
    E.signalen.replaceChildren.apply(E.signalen, D.signalen.map(function (sig, i) {
      var btn = el("button", "btn btn-sm rs-sig", sig.label);
      btn.type = "button"; btn.setAttribute("aria-pressed", b.aan[i] ? "true" : "false"); btn.setAttribute("data-rs-sig", String(i));
      return btn;
    }));
    ring(b);
    E.kaarten.replaceChildren.apply(E.kaarten, D.kaarten.map(function (k, i) {
      var li = el("li", "rs-kaart"); li.style.setProperty("--i", String(i));
      li.appendChild(el("span", "label", k.titel));
      li.appendChild(el("strong", "", k.id === "profiel" ? b.zaak : k.id === "uren" ? "voorbeelduren van de sector " + label(b.sector).toLowerCase() : b.gemeente));
      li.appendChild(el("span", "small", k.uit));
      return li;
    }));
    if (V) V.render(E.screen, { zaak: b.zaak, sector: b.sector, gemeente: b.gemeente }, { g: 15 });
    if (E.onderwerp) E.onderwerp.textContent = vul(TPL.onderwerp, b);
    E.tekst.replaceChildren.apply(E.tekst, TPL.regels.map(function (r) { return el("p", "", vul(r, b)); }));
    E.form.elements["rs-sector"].value = st.sector;
  }
  function vul(t, b) { return t.replace(/\{aanleiding\}/g, b.aanleiding).replace(/\{zaak\}/g, b.naam).replace(/\{gemeente\}/g, b.gemeente).replace(/ {2,}/g, " ").trim(); }
  function ring(b) {
    var score = Sc ? Sc.score(b.aan.map(function (v) { return v ? 100 : 0; })) : 0;
    E.score.textContent = String(score);
    if (E.arc) E.arc.style.strokeDashoffset = Sc ? Sc.dashoffset(score, CIRC) : CIRC;
    E.live.textContent = "Illustratieve score van de verzonnen buur: " + score + " op 100, geen meting.";
  }

  /* ── the stepper ────────────────────────────────────────────────────── */
  function open(n, how) {
    st.open = Math.max(0, Math.min(4, n));
    E.stappen.forEach(function (li, i) {
      var k = i + 1, on = k <= st.open, btn = li.querySelector("[data-rs-open]");
      li.classList.toggle("is-open", on); li.classList.toggle("is-nu", k === st.open);
      if (k === st.open) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
      if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
    });
    if (st.open >= 4) { st.done = true; stop(); E.status.textContent = "Alle vier de stappen staan open. Zet een signaal aan of uit, of beslis mee bij stap vier."; }
    else if (how === "click") E.status.textContent = "Stap " + st.open + " van 4 staat open. Klik op een volgende stap of speel de vier stappen opnieuw.";
  }
  function stop() { clearTimeout(st.timer); st.timer = 0; st.playing = false; }
  function tick() {
    st.timer = 0;
    if (st.off || document.hidden) { st.playing = false; return; }
    open(st.open + 1, "auto");
    if (st.open < 4) st.timer = setTimeout(tick, STEP_MS);
  }
  function play() {
    if (st.done || st.playing) return;
    if (instant) { open(4, "auto"); return; }
    st.playing = true;
    if (st.open === 0) open(1, "auto");
    if (st.open < 4) { E.status.textContent = "De stappen openen vanzelf. Klik op een stap om ze meteen te openen."; st.timer = setTimeout(tick, STEP_MS); }
  }
  function reset() { stop(); st.done = false; st.decided = ""; beslis(""); open(0, "auto"); play(); if (st.open) E.stappen[0].scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" }); }

  /* ── Goedkeuren / Niet sturen ───────────────────────────────────────── */
  function beslis(keur) {
    st.decided = keur;
    E.brief.classList.toggle("is-ja", keur === "ja"); E.brief.classList.toggle("is-nee", keur === "nee");
    E.uitkomst.textContent = keur ? UIT[keur] : "";
    E.readout.hidden = keur !== "ja";
    E.briefStatus.textContent = keur === "ja" ? "Gelezen en goedgekeurd door Snymis (simulatie)" : keur === "nee" ? "Niet gestuurd (simulatie)" : "Wacht op goedkeuring van Snymis";
    qa("[data-rs-keur]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-rs-keur") === keur ? "true" : "false"); });
  }

  /* ── events ─────────────────────────────────────────────────────────── */
  room.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("button") : null;
    if (!t || !room.contains(t)) return;
    if (t.hasAttribute("data-rs-open")) { stop(); open(parseInt(t.getAttribute("data-rs-open"), 10), "click"); return; }
    if (t.hasAttribute("data-rs-sig")) {
      var i = parseInt(t.getAttribute("data-rs-sig"), 10), b = buur(), aan = b.aan.slice();
      aan[i] = aan[i] ? 0 : 1; st.over[st.sector] = aan;
      t.setAttribute("aria-pressed", aan[i] ? "true" : "false"); ring(buur());
      return;
    }
    if (t.hasAttribute("data-rs-keur")) { beslis(t.getAttribute("data-rs-keur")); return; }
    if (t === E.replay) reset();
  });
  E.form.addEventListener("change", function (e) {
    if (e.target.name !== "rs-sector") return;
    st.sector = (N && N.sector(e.target.value)) || "anders"; st.chosen = true;
    beslis(""); render();
  });
  if (S) S.subscribe(function (s) {   /* the sign's sector picks the neighbour until the visitor picks one here */
    var sec = s.sector && D.buren[s.sector] ? s.sector : "anders";
    if (!st.chosen && sec !== st.sector) st.sector = sec;
    render();
  });
  else render();

  /* ── autoplay gate: the first station half in view; room hooks pause on leave / hidden / pagehide ── */
  function seen() { st.seen = true; st.off = false; play(); }
  var ROOMS = window.STS_ROOMS = window.STS_ROOMS || {};
  ROOMS.radar = {
    enter: function () { st.off = false; if (st.seen) play(); },
    leave: function () { st.off = true; stop(); }
  };
  addEventListener("pagehide", stop, { once: true });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (ens) {
      if (!ens.some(function (en) { return en.isIntersecting; })) return;
      io.disconnect(); seen();
    }, { threshold: 0.5 });
    io.observe(E.stappen[0]);
  } else seen();   /* no observer: never wait for a hit that cannot come */
  window.STSRadar = { debug: st, open: open, play: play, buur: buur };
})();
