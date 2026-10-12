/* Radar - grafiekpaneel. Inline SVG, een reeks per grafiek (geen legenda nodig), dunne balken met
   afgeronde data-uiteinden, hairline-raster, tooltip bij hover en toetsenbordfocus, tabel-tweeling.
   Kleur: --viz (#0F9FB6), dezelfde tint als het merkcyaan maar gevalideerd op de donkere ondergrond. */
(function () {
  "use strict";
  var D = window.RADAR; if (!D || !D.weeks) return;
  var NS = "http://www.w3.org/2000/svg", nf = new Intl.NumberFormat("nl-BE");
  function el(n, a, txt) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; }
  function colPath(x, y, w, h, r) { r = Math.min(r, w / 2, h); return "M" + x + "," + (y + h) + "V" + (y + r) + "a" + r + "," + r + " 0 0 1 " + r + ",-" + r + "h" + (w - 2 * r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r + "V" + (y + h) + "Z"; }
  function barPath(x, y, w, h, r) { r = Math.min(r, h / 2, w); return "M" + x + "," + y + "h" + (w - r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r + "v" + (h - 2 * r) + "a" + r + "," + r + " 0 0 1 -" + r + "," + r + "h-" + (w - r) + "Z"; }

  /* tooltip boven het merk; is daar geen plaats (de kop van het paneel), dan ernaast ("side").
     Liggende balken staan te dicht op elkaar voor 'erboven': die krijgen altijd een tooltip naast het cijfer ("beside"). */
  function tooltip(fig, host, mode) {
    var t = document.createElement("div"); t.className = "tip"; t.setAttribute("aria-hidden", "true");
    var b = document.createElement("b"), s = document.createElement("span");
    t.appendChild(b); t.appendChild(s); fig.appendChild(t);
    return {
      show: function (x, y, val, lab) {
        b.textContent = val; s.textContent = lab; t.classList.add("is-on");
        var fw = fig.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
        x += host.offsetLeft; y += host.offsetTop;
        var beside = mode === "beside", side = beside || (mode === "side" && y - th - 10 < host.offsetTop - 28);
        t.classList.toggle("side", side);
        if (side) {
          var left = x + (beside ? 0 : 20);
          if (left + tw > fw - 4) left = beside ? x - tw - 60 : x - tw - 20;
          t.style.left = left + "px"; t.style.top = (beside ? y : y + 14) + "px";
        } else {
          t.style.left = Math.max(tw / 2 + 4, Math.min(fw - tw / 2 - 4, x)) + "px"; t.style.top = y + "px";
        }
      },
      hide: function () { t.classList.remove("is-on"); }
    };
  }
  function bind(hit, bar, on, off) {
    hit.addEventListener("pointerenter", on); hit.addEventListener("pointerleave", off);
    hit.addEventListener("focus", on); hit.addEventListener("blur", off);
  }
  function table(fig, head, rowsData) {
    var t = fig.querySelector("table"); if (!t) return;
    t.textContent = "";
    var thead = document.createElement("thead"), tr = document.createElement("tr");
    head.forEach(function (h) { var th = document.createElement("th"); th.scope = "col"; th.textContent = h; tr.appendChild(th); });
    thead.appendChild(tr); t.appendChild(thead);
    var tb = document.createElement("tbody");
    rowsData.forEach(function (r) { var tr2 = document.createElement("tr"); r.forEach(function (c) { var td = document.createElement("td"); td.textContent = c; tr2.appendChild(td); }); tb.appendChild(tr2); });
    t.appendChild(tb);
  }

  /* ═══ 1. Scans per week (kolommen) ═══ */
  var f1 = document.getElementById("chart-weeks");
  if (f1) {
    var host1 = f1.querySelector(".plot"), tip1 = tooltip(f1, host1, "side"), wk = D.weeks;
    var draw1 = function () {
      var w = host1.clientWidth || 560, h = 250, mL = 36, mR = 12, mT = 24, mB = 26;
      host1.textContent = "";
      var svg = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h, role: "img", "aria-labelledby": "c1-title c1-desc" });
      svg.appendChild(el("title", { id: "c1-title" }, "Scans per week, week 30 tot 41 van 2026 (fictieve cijfers)"));
      svg.appendChild(el("desc", { id: "c1-desc" }, "Kolomgrafiek. Van " + wk.scans[0] + " scans in week 30 naar " + wk.scans[wk.scans.length - 1] + " in week 41, in totaal " + nf.format(D.kpis.scanned) + ". Alle waarden staan in de tabel onder de grafiek."));
      var vals = wk.scans, max = 160, n = vals.length, pw = w - mL - mR, ph = h - mT - mB, slot = pw / n, bw = Math.min(24, slot * 0.5);
      var g = el("g", { "class": "grid" });
      [0, 50, 100, 150].forEach(function (v) {
        var y = mT + ph - v / max * ph;
        g.appendChild(el("line", { x1: mL, x2: w - mR, y1: y, y2: y }));
        svg.appendChild(el("text", { "class": "axis-t", x: mL - 8, y: y + 4, "text-anchor": "end" }, nf.format(v)));
      });
      svg.appendChild(g);
      vals.forEach(function (v, i) {
        var x = mL + slot * i + (slot - bw) / 2, bh = v / max * ph, y = mT + ph - bh;
        var bar = el("path", { "class": "bar", d: colPath(x, y, bw, bh, 4) });
        var hit = el("rect", { "class": "hit", x: mL + slot * i, y: mT, width: slot, height: ph, rx: 4, tabindex: 0, role: "img",
          "aria-label": nf.format(v) + " scans in week " + wk.labels[i].slice(1) + ", " + wk.ranges[i] });
        svg.appendChild(bar); svg.appendChild(hit);
        if (i === n - 1 || i === 0) svg.appendChild(el("text", { "class": "val", x: x + bw / 2, y: y - 7, "text-anchor": "middle" }, nf.format(v)));
        if (slot >= 34 || i % 2 === 1) svg.appendChild(el("text", { "class": "axis-t", x: mL + slot * i + slot / 2, y: h - 8, "text-anchor": "middle" }, wk.labels[i]));
        bind(hit, bar, function () { bar.classList.add("is-hot"); tip1.show(x + bw / 2, y, nf.format(v) + " scans", "week " + wk.labels[i].slice(1) + " · " + wk.ranges[i]); },
          function () { bar.classList.remove("is-hot"); tip1.hide(); });
      });
      host1.appendChild(svg);
    };
    draw1();
    table(f1, ["Week", "Periode", "Scans"], wk.labels.map(function (l, i) { return [l, wk.ranges[i], nf.format(wk.scans[i])]; }));
    var r1; new ResizeObserver(function () { clearTimeout(r1); r1 = setTimeout(draw1, 120); }).observe(host1);
  }

  /* ═══ 2. Zonder website per sector (liggende balken, een tint) ═══ */
  var f2 = document.getElementById("chart-sectors");
  if (f2) {
    var host2 = f2.querySelector(".plot"), tip2 = tooltip(f2, host2, "beside"), total = D.kpis.noSite;
    var data = D.sectorBreakdown.slice().sort(function (a, b) { return b.value - a.value; });
    var max2 = data[0].value;
    var draw2 = function () {
      var w = host2.clientWidth || 460, rowH = 32, bh = 14, mL = Math.min(132, Math.max(104, w * 0.3)), mR = 46, mT = 6, h = mT + rowH * data.length + 6;
      host2.textContent = "";
      var svg = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h, role: "img", "aria-labelledby": "c2-title c2-desc" });
      svg.appendChild(el("title", { id: "c2-title" }, "Zaken zonder website per sector (fictieve cijfers)"));
      svg.appendChild(el("desc", { id: "c2-desc" }, "Liggende balken, van " + data[0].name + " met " + data[0].value + " tot " + data[data.length - 1].name + " met " + data[data.length - 1].value + " zaken, op " + total + " in totaal. De tabel onder de grafiek bevat alle waarden."));
      svg.appendChild(el("line", { "class": "axis-l", x1: mL, x2: mL, y1: mT, y2: h - 6 }));
      data.forEach(function (d, i) {
        var y = mT + rowH * i + (rowH - bh) / 2, bw = d.value / max2 * (w - mL - mR), pct = Math.round(d.value / total * 100);
        svg.appendChild(el("text", { "class": "cat", x: mL - 12, y: y + bh / 2 + 4, "text-anchor": "end" }, d.name));
        var bar = el("path", { "class": "bar", d: barPath(mL, y, bw, bh, 4) });
        svg.appendChild(bar);
        svg.appendChild(el("text", { "class": "val", x: mL + bw + 8, y: y + bh / 2 + 4 }, nf.format(d.value)));
        var hit = el("rect", { "class": "hit", x: 0, y: mT + rowH * i, width: w, height: rowH, rx: 6, tabindex: 0, role: "img",
          "aria-label": d.name + ": " + d.value + " zaken zonder website, " + pct + " procent van het totaal" });
        svg.appendChild(hit);
        bind(hit, bar, function () { bar.classList.add("is-hot"); tip2.show(mL + bw + 44, y + bh / 2, nf.format(d.value) + " zaken", d.name + " · " + pct + "% van " + nf.format(total)); },
          function () { bar.classList.remove("is-hot"); tip2.hide(); });
      });
      host2.appendChild(svg);
    };
    draw2();
    table(f2, ["Sector", "Aandeel", "Zonder website"], data.map(function (d) { return [d.name, Math.round(d.value / total * 100) + "%", nf.format(d.value)]; }));
    var r2; new ResizeObserver(function () { clearTimeout(r2); r2 = setTimeout(draw2, 120); }).observe(host2);
  }

  /* ═══ KPI-sparklines in blokjes (laatste week in accent) ═══ */
  var blocks = "▁▂▃▄▅▆▇█";
  document.querySelectorAll("[data-spark]").forEach(function (sp) {
    var series = D.weeks[sp.getAttribute("data-spark")]; if (!series) return;
    var lo = Math.min.apply(null, series), hi = Math.max.apply(null, series), out = "";
    series.forEach(function (v, i) {
      var ch = blocks[Math.round((v - lo) / Math.max(1, hi - lo) * 7)];
      if (i === series.length - 1) { var b = document.createElement("b"); b.textContent = ch; sp.appendChild(document.createTextNode(out)); sp.appendChild(b); out = ""; }
      else out += ch;
    });
  });
})();
