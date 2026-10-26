/* De straat (werkwijze.html#straat, src/rooms/straat.html): the panden are rendered by build.py from
   src/data/panden.json (builddata.py). This script adds the sector tabs (radio chips built from the
   rendered articles, so the data file stays the only source), shows one pand at a time, and binds each
   range to the clip-path of its new facade: value v -> .nieuw clip-path inset(0 0 0 (100-v)%), so 100
   shows the new gevel fully and 0 the old one. Paint only, no layout, no timers, no rAF. The pand of the
   visitor's sector (horeca, garage, kapper) opens first; without JavaScript all panden stand stacked. */
(function () {
  var room = document.getElementById("straat");
  if (!room) return;
  var panden = [].slice.call(room.querySelectorAll(".pand[data-sector]")), form = room.querySelector("[data-straat-form]"), tabs = room.querySelector("[data-straat-tabs]");
  if (!panden.length || !form || !tabs) return;
  var S = window.STSState, N = window.STSNames, chosen = false;

  function knip(input) {
    var v = Math.max(0, Math.min(100, parseInt(input.value, 10) || 0)), pand = input.closest(".pand");
    var nieuw = pand && pand.querySelector("[data-nieuw]"), out = pand && pand.querySelector("[data-gevel-out]");
    if (nieuw) nieuw.setAttribute("style", "clip-path:inset(0 0 0 " + (v === 100 ? "0" : (100 - v) + "%") + ")");   /* the attribute keeps the literal value; CSSOM would serialise inset(0 0 0 0) as inset(0px) */
    if (out) out.textContent = v + " % nieuw";
    input.setAttribute("aria-valuetext", v + " procent nieuwe gevel");
  }
  function select(slug) {
    panden.forEach(function (p) { p.hidden = p.getAttribute("data-pand") !== slug; });
    [].forEach.call(form.elements.pand || [], function (r) { r.checked = r.value === slug; });
  }
  function bySector(sector) {
    for (var i = 0; i < panden.length; i++) if (panden[i].getAttribute("data-sector") === sector) return panden[i].getAttribute("data-pand");
    return null;
  }

  /* tabs from the rendered panden */
  panden.forEach(function (p, i) {
    var slug = p.getAttribute("data-pand"), sector = p.getAttribute("data-sector"), h = p.querySelector("h3");
    var lab = document.createElement("label"), input = document.createElement("input"), span = document.createElement("span");
    input.type = "radio"; input.name = "pand"; input.value = slug; input.checked = i === 0;
    span.textContent = ((N && N.sectorLabel(sector)) || sector) + ": " + (h ? h.textContent : slug);
    lab.appendChild(input); lab.appendChild(span); tabs.appendChild(lab);
  });
  form.hidden = false;
  form.addEventListener("change", function (e) { if (e.target.name === "pand") { chosen = true; select(e.target.value); } });
  room.addEventListener("input", function (e) { if (e.target.hasAttribute && e.target.hasAttribute("data-gevel-range")) knip(e.target); });
  [].forEach.call(room.querySelectorAll("[data-gevel-range]"), knip);

  var first = panden[0].getAttribute("data-pand");
  select(first);
  if (S) S.subscribe(function (s) { var slug = bySector(s.sector); if (!chosen && slug) select(slug); });
  window.STSStraat = { select: select, knip: knip };
})();
