/* Radar - kaartpaneel: abstracte SVG-vormen van de Antwerpse districten (geen kaarttegels),
   HTML-stippen per zaak met tooltipkaart (hover, tik, toetsenbord), en een draaiende sweep. */
(function () {
  "use strict";
  var D = window.RADAR; if (!D || !D.districts) return;
  var wrap = document.getElementById("map"); if (!wrap) return;
  var svg = wrap.querySelector("svg"), labels = wrap.querySelector(".map-labels"), dots = wrap.querySelector(".map-dots");
  var tip = wrap.querySelector(".map-tip"), sweepEl = wrap.querySelector(".map-sweep");
  /* de data staat in een 600x560-raster; we tonen het uitgesneden venster (96,0)-(576,566) zodat de districten het paneel vullen */
  var VX = 96, VY = 0, VW = 480, VH = 566, NS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function el(n, attrs) { var e = document.createElementNS(NS, n); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function px(x) { return ((x - VX) / VW * 100) + "%"; }
  function py(y) { return ((y - VY) / VH * 100) + "%"; }
  svg.setAttribute("viewBox", VX + " " + VY + " " + VW + " " + VH);

  /* ── rivier + districten ── */
  svg.appendChild(el("path", { "class": "river", d: D.river }));
  var rl = el("path", { "class": "river-line", id: "river-path", d: D.river });
  svg.appendChild(rl);
  var rt = el("text", { "class": "river-label", dy: "-6" });
  var tp = el("textPath", { href: "#river-path", startOffset: "56%" }); tp.textContent = "SCHELDE";
  rt.appendChild(tp); svg.appendChild(rt);

  var polys = {};
  D.districts.forEach(function (d) {
    var p = el("polygon", { "class": "dist", points: d.poly.map(function (pt) { return pt.join(","); }).join(" ") });
    svg.appendChild(p); polys[d.id] = p;
    var lb = document.createElement("span"); lb.className = "map-label"; lb.textContent = d.name;
    lb.style.left = px(d.label[0]); lb.style.top = py(d.label[1]);
    labels.appendChild(lb);
  });
  function hot(id) { for (var k in polys) polys[k].classList.toggle("is-hot", k === id); }

  /* ── tooltipkaart ── */
  var hideT = 0, openDot = null;
  function build(b) {
    tip.textContent = "";
    var h = document.createElement("h3"); h.textContent = b.n;
    var sub = document.createElement("p"); sub.className = "sub"; sub.textContent = b.s + " · " + D.districtName(b.d) + " · gescand (fictief)";
    var sc = document.createElement("div"); sc.className = "score";
    sc.appendChild(D.abar(b.sc, 10));
    var scv = document.createElement("span"); var scb = document.createElement("b"); scb.textContent = b.sc; scv.appendChild(scb); scv.appendChild(document.createTextNode("/100 vindbaar"));
    sc.appendChild(scv);
    var st = document.createElement("span"); st.className = "status st-" + b.st; st.appendChild(document.createElement("i")); st.appendChild(document.createTextNode(D.statuses[b.st].label));
    var ul = document.createElement("ul");
    b.sig.forEach(function (s) { var li = document.createElement("li"); li.textContent = s; ul.appendChild(li); });
    var lnk = document.createElement("button"); lnk.type = "button"; lnk.className = "lnk"; lnk.textContent = "Toon in de lijst";
    lnk.addEventListener("click", function () { hide(); document.dispatchEvent(new CustomEvent("radar:find", { detail: b.n })); });
    tip.appendChild(h); tip.appendChild(sub); tip.appendChild(sc); tip.appendChild(st); tip.appendChild(ul); tip.appendChild(lnk);
  }
  function show(b, bt) {
    clearTimeout(hideT);
    if (openDot !== bt) { build(b); }
    openDot = bt;
    dots.querySelectorAll(".is-open").forEach(function (x) { x.classList.remove("is-open"); });
    bt.classList.add("is-open"); hot(b.d);
    tip.classList.add("is-on");
    var wr = wrap.getBoundingClientRect(), r = bt.getBoundingClientRect();
    var x = r.left - wr.left + r.width / 2, y = r.top - wr.top, tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = Math.min(Math.max(8, x - tw / 2), wr.width - tw - 8);
    var top = y - th - 10; if (top < 6) top = y + r.height + 10;
    tip.style.left = left + "px"; tip.style.top = top + "px";
  }
  function hide() {
    tip.classList.remove("is-on"); hot(null);
    if (openDot) openDot.classList.remove("is-open");
    openDot = null;
  }
  function hideSoon() { clearTimeout(hideT); hideT = setTimeout(hide, 260); }
  tip.addEventListener("pointerenter", function () { clearTimeout(hideT); });
  tip.addEventListener("pointerleave", hideSoon);

  /* ── stippen ── */
  D.businesses.forEach(function (b, i) {
    var bt = document.createElement("button"); bt.type = "button"; bt.className = "dot st-" + b.st;
    bt.style.left = px(b.x); bt.style.top = py(b.y);
    bt.setAttribute("aria-label", b.n + ", " + D.districtName(b.d));
    var halo = document.createElement("i"); halo.className = "halo"; halo.style.animationDelay = ((i * 0.37) % 2.8).toFixed(2) + "s";
    var core = document.createElement("i"); core.className = "core";
    bt.appendChild(halo); bt.appendChild(core);
    bt.addEventListener("pointerenter", function (e) { if (e.pointerType !== "touch") show(b, bt); });
    bt.addEventListener("pointerleave", function (e) { if (e.pointerType !== "touch") hideSoon(); });
    bt.addEventListener("focus", function () { show(b, bt); });
    bt.addEventListener("blur", function () { hideSoon(); });
    /* klik/tik opent altijd (focus kan de kaart al getoond hebben); sluiten via Escape, weg-tikken of de muis weghalen */
    bt.addEventListener("click", function () { show(b, bt); });
    dots.appendChild(bt);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && tip.classList.contains("is-on")) hide(); });
  document.addEventListener("pointerdown", function (e) {
    if (tip.contains(e.target) || (e.target.closest && e.target.closest(".dot"))) return;
    hide();
  });

  /* ── sweep: een roterende conische gradient (alleen transform), gecentreerd op Centrum ── */
  function sizeSweep() {
    if (!sweepEl) return;
    var w = wrap.clientWidth, h = wrap.clientHeight, s = w * 1.5;
    var cxp = w * (232 - VX) / VW, cyp = h * (276 - VY) / VH;
    sweepEl.style.width = s + "px"; sweepEl.style.height = s + "px";
    sweepEl.style.left = (cxp - s / 2) + "px"; sweepEl.style.top = (cyp - s / 2) + "px";
  }
  sizeSweep();
  var rT; window.addEventListener("resize", function () { clearTimeout(rT); rT = setTimeout(sizeSweep, 120); });
  if (sweepEl && !reduce) D.watch(wrap, function (on) { sweepEl.classList.toggle("is-paused", !on); });
})();
