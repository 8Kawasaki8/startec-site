/* Proef 'Antwoord buiten de uren' (werkwijze.html#kaart, under the In onderzoek item of that name).
   A DESIGN SKETCH of research, scripted end to end from window.STS_ASSISTENT (assets/data/
   assistent-dialoog.js): no model, no text input, no request, no storage. The panel markup lives in
   src/rooms/kaart.html ([data-proef-bron=assistent], so lint-copy reads the customer chips with
   data-voice=customer) and is moved here next to the <details> that holds the mount point [data-proef=assistent].
   The knowledge blocks (hours, menu, practical notes) of the fictional Brasserie Meridiaan are rendered
   visibly; every answer carries a source chip 'uit: ...' pointing at one of them and lights that block.
   The 'twintig man' question is handed over: the scripted sentence plus a card 'doorgegeven (gesimuleerd)'.
   Typing: one setTimeout at a time, word by word, finished at once on a second click, on close of the
   <details> (kaart.js dispatches 'sts:proef' {proef:'assistent', open:false}, also from the room's leave
   hook, hidden tab and pagehide), under reduced motion and in lite. The log is aria-live=polite; a bubble
   joins it only when its text is complete. The item's CTA (the data-bericht link under the <details>)
   moves into the panel foot while the proef is open and back when it closes, so it is clickable either way. */
(function () {
  var D = window.STS_ASSISTENT, mount = document.querySelector("[data-proef='assistent']"), panel = document.querySelector("[data-proef-bron='assistent']");
  if (!D || !mount || !panel) return;
  var q = function (s) { return panel.querySelector(s); };
  var E = { scenario: q("[data-la-scenario]"), kennis: q("[data-la-kennis]"), chips: q("[data-la-chips]"), log: q("[data-la-log]"), slot: q("[data-la-slot]"), voet: q("[data-la-voet]"), kop: q("[data-la-kop]") };
  if (!E.kennis || !E.chips || !E.log) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, lite = /[?&]lite\b/.test(location.search);
  try { lite = lite || localStorage.getItem("sts-lite") === "1"; } catch (e) { /* storage blocked */ }
  var instant = reduce || lite, WORD_MS = 55, THINK_MS = 420;
  var st = { timer: 0, typing: null, cta: null, ctaHome: null };

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* ── mount: the panel sits right after the <details> of the item (the mount point marks that item) and
     follows its open state. Not inside it: Chrome skips the content of a closed <details>, so its text
     would be invisible to the QA label check even though the panel says 'gesimuleerd'. ─────────────── */
  var details = mount.closest("details");
  if (details) details.after(panel); else mount.appendChild(panel);
  panel.hidden = !!(details && !details.open);
  panel.removeAttribute("data-proef-bron");
  if (E.kop) E.kop.textContent = D.kop;
  if (E.scenario) E.scenario.textContent = D.scenario;
  if (E.slot) E.slot.textContent = D.slot;
  D.kennis.forEach(function (b) {
    var blok = el("section", "la-blok"); blok.setAttribute("data-la-blok", b.id);
    blok.appendChild(el("h4", "", b.titel));
    var ul = el("ul"); b.regels.forEach(function (r) { ul.appendChild(el("li", "", r)); }); blok.appendChild(ul);
    E.kennis.appendChild(blok);
  });
  var item = mount.closest("li"), ctaLink = item && item.querySelector(".kaart-meer [data-bericht]");
  if (ctaLink) { st.cta = ctaLink; st.ctaHome = ctaLink.parentNode; }

  function light(id) { [].forEach.call(E.kennis.querySelectorAll("[data-la-blok]"), function (b) { b.classList.toggle("is-bron", b.getAttribute("data-la-blok") === id); }); }
  function bottom() { E.log.scrollTop = E.log.scrollHeight; }   /* per typed word: instant, no smooth-scroll animation on weak phones */
  function bottomSoft() { try { E.log.scrollTo({ top: E.log.scrollHeight, behavior: instant ? "auto" : "smooth" }); } catch (e) { bottom(); } }

  /* ── typing: a placeholder bubble (aria-hidden) grows word by word; the finished bubble replaces it ── */
  function finish() {
    clearTimeout(st.timer); st.timer = 0;
    var t = st.typing; if (!t) return;
    st.typing = null;
    var bel = el("p", "la-bel la-ass"); bel.appendChild(el("span", "la-wie", "assistent (gescript)")); bel.appendChild(document.createTextNode(t.a.tekst));
    t.node.replaceWith(bel);
    var bron = el("span", "la-bron", t.a.bron); E.log.appendChild(bron);
    if (t.a.overdracht) {
      var kaart = el("div", "la-kaart"); kaart.setAttribute("data-la-overdracht", "");
      kaart.appendChild(el("strong", "", t.a.kaart)); kaart.appendChild(el("span", "", t.a.uitleg));
      E.log.appendChild(kaart);
    }
    light(t.a.blok);
    E.chips.removeAttribute("aria-busy");
    bottomSoft();
  }
  function step() {
    var t = st.typing; if (!t) return;
    if (t.i >= t.words.length) { finish(); return; }
    t.i++;
    t.node.textContent = t.words.slice(0, t.i).join(" ");
    bottom();
    st.timer = setTimeout(step, WORD_MS);
  }
  function ask(btn) {
    var a = D.antwoorden[btn.getAttribute("data-vraag")]; if (!a) return;
    if (st.typing) finish();
    [].forEach.call(E.chips.querySelectorAll("[data-vraag]"), function (c) { c.setAttribute("aria-pressed", c === btn ? "true" : "false"); });
    var klant = el("p", "la-bel la-klant", btn.textContent); klant.setAttribute("data-voice", "customer"); E.log.appendChild(klant);
    var node = el("p", "la-bel la-ass la-typ", D.wacht); node.setAttribute("aria-hidden", "true"); E.log.appendChild(node);
    st.typing = { a: a, node: node, words: a.tekst.split(" "), i: 0 };
    E.chips.setAttribute("aria-busy", "true");
    bottom();
    if (instant) { finish(); return; }
    st.timer = setTimeout(step, THINK_MS);
  }
  E.chips.addEventListener("click", function (e) { var b = e.target.closest("[data-vraag]"); if (b) ask(b); });

  /* ── open and close: the CTA travels with the panel; closing stops the typing at once ────── */
  function reveal() {
    panel.hidden = false;
    if (st.cta && E.voet && st.cta.parentNode !== E.voet) { E.voet.appendChild(st.cta); }
    if (!E.kop) return;
    var r = E.kop.getBoundingClientRect(), room = innerHeight - 88;   /* 88: the dock plus a margin */
    if (r.bottom > room || r.top < 0) scrollBy({ top: r.top < 0 ? r.top - 72 : r.bottom - room, behavior: instant ? "auto" : "smooth" });
  }
  function hide() {   /* also called on leave while the item stays open: then only the typing stops */
    if (st.typing) finish();
    if (details && details.open) return;
    panel.hidden = true;
    if (st.cta && st.ctaHome && st.cta.parentNode !== st.ctaHome) st.ctaHome.appendChild(st.cta);
  }
  addEventListener("sts:proef", function (e) {
    var d = e.detail || {}; if (d.proef !== "assistent") return;
    if (d.open) reveal(); else hide();
  });
  if (!panel.hidden) reveal();
  window.STSLabAssistent = { ask: function (id) { var b = E.chips.querySelector("[data-vraag='" + id + "']"); if (b) ask(b); }, finish: finish, busy: function () { return !!st.typing; } };
})();
