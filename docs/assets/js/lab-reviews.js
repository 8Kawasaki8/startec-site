/* Proef 'Reviews in jouw toon' (werkwijze.html#kaart, under the In onderzoek item of that name).
   Research sketch, scripted from window.STS_LAB_REVIEWS (assets/data/lab-reviews-data.js): three fictional
   reviews of Kapsalon Lumen (verzonnen), per review two pre-written tones that fill an editable textarea,
   two equal buttons 'Goedkeuren (lokaal)' and 'Niet antwoorden'. Approving places the text under the review
   with the stamp 'gesimuleerd, niet op Google geplaatst'; the readout counts approvals and always ends on
   'automatisch geplaatst: 0 (altijd)'. DOM only: no timers, no requests, no storage, nothing persists.
   The panel markup lives in src/rooms/kaart.html ([data-proef-bron=reviews]) and is moved next to the <details>
   that holds the mount point [data-proef=reviews]; the item's CTA (data-bericht=reviews under the <details>) moves into the panel
   foot while the proef is open ('sts:proef' from kaart.js) and back when it closes. */
(function () {
  var D = window.STS_LAB_REVIEWS, mount = document.querySelector("[data-proef='reviews']"), panel = document.querySelector("[data-proef-bron='reviews']");
  if (!D || !mount || !panel) return;
  var q = function (s) { return panel.querySelector(s); };
  var E = { kop: q("[data-lr-kop]"), uitleg: q("[data-lr-uitleg]"), readout: q("[data-lr-readout]"), lijst: q("[data-lr-lijst]"), slot: q("[data-lr-slot]"), voet: q("[data-lr-voet]") };
  if (!E.lijst || !E.readout) return;
  var st = { beslist: {}, cta: null, ctaHome: null };   /* beslist[id] = 'ja' | 'nee' */

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(cls, text) { var b = el("button", "btn " + cls, text); b.type = "button"; return b; }

  /* ── mount: after the <details> of the item, following its open state (see lab-assistent.js) ── */
  var details = mount.closest("details");
  if (details) details.after(panel); else mount.appendChild(panel);
  panel.hidden = !!(details && !details.open);
  panel.removeAttribute("data-proef-bron");
  if (E.kop) E.kop.textContent = D.kop;
  if (E.uitleg) E.uitleg.textContent = D.uitleg;
  if (E.slot) E.slot.textContent = D.slot;
  var item = mount.closest("li"), ctaLink = item && item.querySelector(".kaart-meer [data-bericht]");
  if (ctaLink) { st.cta = ctaLink; st.ctaHome = ctaLink.parentNode; }

  /* ── readout: proposals, approved, not answered, open, auto-placed (always 0) ────────────── */
  function readout() {
    var ja = 0, nee = 0, k;
    for (k in st.beslist) { if (st.beslist[k] === "ja") ja++; else nee++; }
    var open = D.reviews.length - ja - nee;
    E.readout.replaceChildren();
    [["Voorstellen", String(D.reviews.length * D.tonen.length)], ["door jou goedgekeurd", String(ja)], ["niet beantwoord", String(nee)], ["nog open", String(open)], ["automatisch geplaatst", "0 (altijd)"]].forEach(function (p, i) {
      if (i) E.readout.appendChild(document.createTextNode(" · "));
      E.readout.appendChild(document.createTextNode(p[0] + ": ")); E.readout.appendChild(el("b", "", p[1]));
    });
    E.readout.setAttribute("data-lr-open", String(open)); E.readout.setAttribute("data-lr-ja", String(ja)); E.readout.setAttribute("data-lr-auto", "0");
  }

  /* ── one review card: text, tones, textarea, two equal buttons, outcome ──────────────────── */
  function card(r) {
    var art = el("article", "lr-review"); art.setAttribute("data-lr-review", String(r.id)); art.setAttribute("aria-labelledby", "lr-h-" + r.id);
    var kop = el("div", "lr-kop"); var h = el("h4", "", r.naam); h.id = "lr-h-" + r.id; kop.appendChild(h);
    kop.appendChild(el("span", "small", r.score + " op 5 · " + r.wanneer + " · fictieve review")); art.appendChild(kop);
    var tekst = el("p", "lr-tekst", r.tekst); tekst.setAttribute("data-voice", "customer"); art.appendChild(tekst);
    var editor = el("div", "lr-editor");
    var tonen = el("div", "lr-tonen"); tonen.setAttribute("role", "group"); tonen.setAttribute("aria-label", "Toon van het voorstel");
    var veld = el("label", "lr-veld"); veld.appendChild(el("span", "", "Jouw antwoord: kies een toon en pas aan wat je wil"));
    var ta = document.createElement("textarea"); ta.rows = 4; ta.setAttribute("data-lr-tekst", ""); ta.setAttribute("data-voice", "visitor"); veld.appendChild(ta);
    D.tonen.forEach(function (t, i) {
      var b = btn("btn-sm", t.label); b.setAttribute("aria-pressed", "false"); b.setAttribute("data-lr-toon", t.id); b.setAttribute("data-lr-toon-nr", String(i + 1));
      b.addEventListener("click", function () {
        [].forEach.call(tonen.children, function (c) { c.setAttribute("aria-pressed", c === b ? "true" : "false"); });
        ta.value = r.voorstel[t.id]; status.textContent = ""; ta.focus({ preventScroll: true });
      });
      tonen.appendChild(b);
    });
    var acties = el("div", "lr-acties"), ja = btn("is-ja", D.acties.ja), nee = btn("", D.acties.nee);
    ja.setAttribute("data-lr-ja", ""); nee.setAttribute("data-lr-nee", ""); acties.appendChild(ja); acties.appendChild(nee);
    var status = el("p", "small lr-status"); status.setAttribute("aria-live", "polite");
    editor.appendChild(tonen); editor.appendChild(veld); editor.appendChild(acties); editor.appendChild(status);
    var uit = el("div", "lr-antwoord"); uit.hidden = true; uit.setAttribute("data-lr-uit", "");
    art.appendChild(editor); art.appendChild(uit);

    function decide(keuze) {
      var t = ta.value.trim();
      if (keuze === "ja" && !t) { status.textContent = D.leeg; ta.focus({ preventScroll: true }); return; }
      st.beslist[r.id] = keuze;
      uit.replaceChildren();
      if (keuze === "ja") { var p = el("p", "", t); p.setAttribute("data-voice", "visitor"); p.setAttribute("data-lr-geplaatst", ""); uit.appendChild(p); uit.appendChild(el("span", "lr-stempel", D.stempel)); }
      else uit.appendChild(el("p", "", D.geenAntwoord));
      var terug = btn("btn-sm btn-line", D.acties.opnieuw); terug.addEventListener("click", undo); uit.appendChild(terug);
      editor.hidden = true; uit.hidden = false; art.setAttribute("data-lr-beslist", keuze);
      readout(); terug.focus({ preventScroll: true });
    }
    function undo() {
      delete st.beslist[r.id]; art.removeAttribute("data-lr-beslist");
      uit.hidden = true; editor.hidden = false; readout(); ta.focus({ preventScroll: true });
    }
    ja.addEventListener("click", function () { decide("ja"); });
    nee.addEventListener("click", function () { decide("nee"); });
    return art;
  }
  D.reviews.forEach(function (r) { E.lijst.appendChild(card(r)); });
  readout();

  /* ── open and close: the CTA travels with the panel ─────────────────────────────────────── */
  function reveal() { panel.hidden = false; if (st.cta && E.voet && st.cta.parentNode !== E.voet) E.voet.appendChild(st.cta); }
  function hide() {
    if (details && details.open) return;   /* leave while open: nothing to stop here, the panel stays */
    panel.hidden = true;
    if (st.cta && st.ctaHome && st.cta.parentNode !== st.ctaHome) st.ctaHome.appendChild(st.cta);
  }
  addEventListener("sts:proef", function (e) { var d = e.detail || {}; if (d.proef === "reviews") { if (d.open) reveal(); else hide(); } });
  if (!panel.hidden) reveal();
  window.STSLabReviews = { beslist: function () { var o = {}, k; for (k in st.beslist) o[k] = st.beslist[k]; return o; } };
})();
