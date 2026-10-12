/* Radar - kandidatenlijst: zoeken, filteren op sector/district/status, sorteren. Volledig client-side. */
(function () {
  "use strict";
  var D = window.RADAR; if (!D || !D.businesses) return;
  var root = document.getElementById("kandidaten"); if (!root) return;
  var q = root.querySelector("#f-q"), fs = root.querySelector("#f-sector"), fd = root.querySelector("#f-district");
  var fst = root.querySelector("#f-status"), fo = root.querySelector("#f-sort"), rows = root.querySelector("#rows");
  var count = root.querySelector("#list-count"), reset = root.querySelector("#f-reset");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function opt(sel, v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); }
  D.sectors.forEach(function (s) { opt(fs, s, s); });
  D.districts.forEach(function (d) { opt(fd, d.id, d.name); });
  Object.keys(D.statuses).forEach(function (k) { opt(fst, k, D.statuses[k].label); });

  function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function current() {
    var term = norm(q.value.trim()), sec = fs.value, dis = fd.value, st = fst.value, sort = fo.value;
    var list = D.businesses.filter(function (b) {
      return (!sec || b.s === sec) && (!dis || b.d === dis) && (!st || b.st === st) &&
        (!term || norm(b.n + " " + b.s + " " + D.districtName(b.d)).indexOf(term) > -1);
    });
    list.sort(function (a, b) {
      if (sort === "score-asc") return a.sc - b.sc || a.n.localeCompare(b.n, "nl");
      if (sort === "name") return a.n.localeCompare(b.n, "nl");
      return b.sc - a.sc || a.n.localeCompare(b.n, "nl");
    });
    return list;
  }
  function span(cls, text) { var s = document.createElement("span"); s.className = cls; s.textContent = text; return s; }
  function render() {
    var list = current();
    rows.textContent = "";
    count.textContent = list.length + " van " + D.businesses.length + " zaken";
    if (!list.length) {
      var e = document.createElement("li"); e.className = "empty"; e.textContent = "Geen zaken gevonden voor deze filters.";
      rows.appendChild(e); return;
    }
    list.forEach(function (b) {
      var li = document.createElement("li"); li.className = "row"; li.setAttribute("data-name", b.n);
      var sec = span("sec", b.s); sec.setAttribute("data-d", D.districtName(b.d));
      var st = span("status st-" + b.st, ""); st.appendChild(document.createElement("i")); st.appendChild(document.createTextNode(D.statuses[b.st].label));
      var sc = span("sc", String(b.sc)); sc.setAttribute("aria-label", "vindbaarheid " + b.sc + " op 100");
      li.appendChild(span("nm", b.n)); li.appendChild(sec); li.appendChild(span("dis", D.districtName(b.d)));
      li.appendChild(D.abar(b.sc, 12)); li.appendChild(sc); li.appendChild(st);
      rows.appendChild(li);
    });
  }
  [q, fs, fd, fst, fo].forEach(function (c) { c.addEventListener("input", render); c.addEventListener("change", render); });
  reset.addEventListener("click", function () { q.value = ""; fs.value = ""; fd.value = ""; fst.value = ""; fo.value = "score-desc"; render(); q.focus(); });

  /* vanuit de kaart: "Toon in de lijst" */
  document.addEventListener("radar:find", function (e) {
    fs.value = ""; fd.value = ""; fst.value = ""; q.value = e.detail; render();
    if (D.lenis) D.lenis.scrollTo(root, { offset: -56, duration: 1.1 });
    else root.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    var row = rows.querySelector(".row");
    if (row) { row.classList.add("is-flash"); setTimeout(function () { row.classList.remove("is-flash"); }, 2000); }
  });
  render();
})();
