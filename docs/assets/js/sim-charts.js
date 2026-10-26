/* Doorlichting: the four chart renderers, pure functions of (business, width, height, alt).
   Each returns { svg, frame, focus, cpos, legend }: the SVG markup, the drawing frame, the
   rectangle the reticle locks on, a preferred callout position and the legend markup.
   Nothing here touches the DOM or the timeline (sim.js does), so the same function draws the
   idle chart, the running chart and, with `alt`, the wat-als second series (sim-whatif.js):
   calls   alt = { answered, missed, legend }      grouped lighter columns where the values differ
   search  alt = { values, legend } or { gap: [from, to], gapLabel, legend }   lighter line or band
   reviews alt = { total, unanswered, legend }     grouped lighter columns, the score line untouched
   web     no alt (no wat-als rule changes a load time).
   Marks follow the dataviz rules: thin marks, 4 px data-end, 2 px gaps, mono labels; classes
   s0 (de-emphasis), s1 (the measured thing), s2 (status: gemist, zonder antwoord), wat (second series).
   Exported as window.SIM_CHARTS = { calls, search, reviews, web, order, meta, nl, esc }. */
(function () {
  function D() { return window.SIM_DATA || { charts: [], months: [] }; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function nl(n) { var s = String(n).split("."); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, "."); return s.join(","); }
  function stepFor(max) { return max <= 8 ? 2 : max <= 16 ? 5 : max <= 50 ? 10 : max <= 100 ? 20 : max <= 400 ? 100 : 200; }
  function frame(W, H, l) { return { x0: l || 40, x1: W - 14, y0: 14, y1: H - 30 }; }
  function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }
  function mx(a) { return Math.max.apply(null, a); }
  /* chart text: the global chart list, overridden per business when its trade needs other words (b.titles[id]) */
  function meta(b, id) {
    var c = D().charts.filter(function (x) { return x.id === id; })[0] || {}, o = (b && b.titles && b.titles[id]) || {};
    return { id: id, n: c.n, tab: c.tab, title: o.title || c.title || "", sub: o.sub || c.sub || "", src: o.src || c.src || "" };
  }

  /* ── SVG mark builders ─────────────────────────────────────── */
  function rect(x, y, w, h, cls) { return h <= 0 || w <= 0 ? "" : '<rect class="' + cls + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '"/>'; }
  function col(x, y, w, h, cls) {           /* rounded top, square base */
    if (h <= 0) return ""; var r = Math.min(4, h / 2, w / 2);
    return '<path class="' + cls + '" d="M' + x.toFixed(1) + " " + (y + h).toFixed(1) + "V" + (y + r).toFixed(1) + "Q" + x.toFixed(1) + " " + y.toFixed(1) + " " + (x + r).toFixed(1) + " " + y.toFixed(1) + "H" + (x + w - r).toFixed(1) + "Q" + (x + w).toFixed(1) + " " + y.toFixed(1) + " " + (x + w).toFixed(1) + " " + (y + r).toFixed(1) + "V" + (y + h).toFixed(1) + 'Z"/>';
  }
  function hbar(x, y, w, h, cls) {          /* rounded right end, square at the axis */
    if (w <= 0) return ""; var r = Math.min(4, w / 2, h / 2);
    return '<path class="' + cls + '" d="M' + x.toFixed(1) + " " + y.toFixed(1) + "H" + (x + w - r).toFixed(1) + "Q" + (x + w).toFixed(1) + " " + y.toFixed(1) + " " + (x + w).toFixed(1) + " " + (y + r).toFixed(1) + "V" + (y + h - r).toFixed(1) + "Q" + (x + w).toFixed(1) + " " + (y + h).toFixed(1) + " " + (x + w - r).toFixed(1) + " " + (y + h).toFixed(1) + "H" + x.toFixed(1) + 'Z"/>';
  }
  function text(x, y, s, cls, anchor) { return '<text class="' + (cls || "") + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : "") + ">" + esc(s) + "</text>"; }
  function axisY(f, max, step, fmt) {
    var s = "", ph = f.y1 - f.y0;
    for (var v = 0; v <= max + 1e-9; v += step) { var y = f.y1 - v / max * ph; s += '<line class="' + (v === 0 ? "base" : "grid") + '" x1="' + f.x0 + '" x2="' + f.x1 + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>' + text(f.x0 - 8, y + 4, fmt ? fmt(v) : nl(v), "", "end"); }
    return s;
  }
  function axisScore(f, lo, hi, step) {
    var s = "", ph = f.y1 - f.y0;
    for (var v = lo; v <= hi + 1e-9; v += step) { var y = f.y1 - (v - lo) / (hi - lo) * ph; s += '<line class="' + (v === lo ? "base" : "grid") + '" x1="' + f.x0 + '" x2="' + f.x1 + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>' + text(f.x0 - 8, y + 4, nl(Math.round(v * 10) / 10), "", "end"); }
    return s;
  }
  /* one stacked column per bucket; where `alt` differs the slot holds two narrower columns: the measured one and the lighter wat-als one */
  function stack1(x, yb, w, hb, ht, clsBase, clsTop) {
    if (ht > 0.5) return rect(x, yb, w, hb, clsBase) + col(x, yb - 2 - ht, w, ht, clsTop);
    return col(x, yb, w, hb, clsBase);
  }
  function stacked(f, base, top, n, max, clsBase, clsTop, alt) {
    var slot = (f.x1 - f.x0) / n, bw = Math.min(24, slot * 0.58), ph = f.y1 - f.y0, s = "", tops = [];
    for (var i = 0; i < n; i++) {
      var x = f.x0 + i * slot + (slot - bw) / 2, hb = base[i] / max * ph, ht = top[i] / max * ph, yb = f.y1 - hb;
      var two = alt && (alt.base[i] !== base[i] || alt.top[i] !== top[i]), w = two ? bw / 2 - 1 : bw;
      s += stack1(x, yb, w, hb, ht, clsBase, clsTop);
      if (two) { var ab = alt.base[i] / max * ph, at = alt.top[i] / max * ph; s += stack1(x + w + 2, f.y1 - ab, w, ab, at, clsBase + " wat", clsTop + " wat"); }
      tops.push(ht > 0.5 ? yb - 2 - ht : yb);
    }
    return { svg: s, slot: slot, bw: bw, tops: tops };
  }
  function legend(items) { return items.map(function (it) { return "<li><i class=\"" + it[0] + "\"></i>" + esc(it[1]) + "</li>"; }).join(""); }
  function wrapSvg(W, H, title, desc, inner) {
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="sim-ct sim-cd"><title id="sim-ct">' + esc(title) + '</title><desc id="sim-cd">' + esc(desc) + "</desc>" +
      '<defs><clipPath id="sim-clip"><rect id="sim-clip-r" x="0" y="0" width="' + W + '" height="' + H + '"/></clipPath></defs>' + inner + "</svg>";
  }

  /* ── chart 1: oproepen per uur (stacked columns, gemist on top) ── */
  function renderCalls(b, W, H, alt) {
    var c = b.calls, n = c.answered.length, f = frame(W, H), tot = c.answered.map(function (v, i) { return v + c.missed[i]; });
    var step = stepFor(mx(tot)), max = Math.ceil(mx(tot) / step) * step, m = meta(b, "calls");
    var st = stacked(f, c.answered, c.missed, n, max, "s0", "s2", alt ? { base: alt.answered, top: alt.missed } : null), every = st.slot < 30 ? 2 : 1, x = "";
    for (var i = 0; i < n; i += every) x += text(f.x0 + i * st.slot + st.slot / 2, f.y1 + 18, (c.from + i) + " u", "", "middle");
    var a = c.focus[0], z = c.focus[1], fy = Math.min.apply(null, st.tops.slice(a, z + 1)) - 8;
    var lg = [["s0", "beantwoord"], ["s2", "gemist"]]; if (alt) lg.push(["s2 wat", alt.legend || "na de actie"]);
    return { svg: wrapSvg(W, H, m.title + ", gesimuleerd", "Gestapelde kolommen per uur van " + c.from + " tot " + (c.from + n) + " u. " + c.callout.v + " " + c.callout.t + "." + (alt ? " Lichtere kolommen: " + (alt.legend || "na de actie") + "." : ""),
        axisY(f, max, step) + x + '<g clip-path="url(#sim-clip)">' + st.svg + "</g>"),
      frame: f, focus: { x: f.x0 + a * st.slot + (st.slot - st.bw) / 2 - 7, y: fy, w: (z - a + 1) * st.slot - (st.slot - st.bw) + 14, h: f.y1 - fy + 4 }, cpos: { x: f.x1 - 236, y: f.y0 + 2 },
      legend: legend(lg) };
  }
  /* ── chart 2: zoekopdrachten per uur, line over the opening-hours band ── */
  function renderSearch(b, W, H, alt) {
    var sd = b.search, v = sd.values, f = frame(W, H), top = mx(v), step = stepFor(top), max = Math.ceil(top / step) * step, ph = f.y1 - f.y0, m = meta(b, "search");
    var xh = function (h) { return f.x0 + h / 23 * (f.x1 - f.x0); }, yv = function (val) { return f.y1 - val / max * ph; };
    var path = function (arr) { return "M" + arr.map(function (val, h) { return xh(h).toFixed(1) + " " + yv(val).toFixed(1); }).join("L"); };
    var bx0 = xh(sd.open[0]), bx1 = xh(sd.open[1]), line = path(v), area = line + "L" + f.x1 + " " + f.y1 + "L" + f.x0 + " " + f.y1 + "Z", peak = v.indexOf(top), xs = "";
    for (var h = 0; h <= 21; h += 3) xs += text(xh(h), f.y1 + 18, h + " u", "", "middle");
    var defs = '<defs><clipPath id="sim-cin"><rect x="' + bx0.toFixed(1) + '" y="0" width="' + (bx1 - bx0).toFixed(1) + '" height="' + H + '"/></clipPath>' +
      '<clipPath id="sim-cout"><rect x="0" y="0" width="' + bx0.toFixed(1) + '" height="' + H + '"/><rect x="' + bx1.toFixed(1) + '" y="0" width="' + (W - bx1).toFixed(1) + '" height="' + H + '"/></clipPath></defs>';
    var extra = "", lg = [["s1 line", sd.label || "zoekopdrachten ‘open nu’"], ["band", sd.bandLabel || "openingsuren"], ["s2", "buiten de uren"]];
    if (alt && alt.gap) { var g0 = xh(alt.gap[0]), g1 = xh(alt.gap[1]); extra = rect(g0, f.y0, g1 - g0, ph, "band wat") + (alt.gapLabel ? text(g1 + 6, f.y0 + 13, alt.gapLabel, "lbl wat") : ""); lg.push(["band wat", alt.legend || "zoals Google het toonde"]); }
    if (alt && alt.values) { extra = '<path class="ln wat" d="' + path(alt.values) + '"/>'; lg.push(["s1 line wat", alt.legend || "na de actie"]); }
    var inner = defs + rect(bx0, f.y0, bx1 - bx0, ph, "band") + text(bx0 + 7, f.y0 + 13, sd.openLabel, "lbl") + axisY(f, max, step) + xs +
      '<g clip-path="url(#sim-clip)"><path class="wash" clip-path="url(#sim-cin)" d="' + area + '"/><path class="wash2" clip-path="url(#sim-cout)" d="' + area + '"/>' + (alt && alt.gap ? extra : "") + '<path class="ln" d="' + line + '"/>' + (alt && alt.values ? extra : "") +
      '<circle class="dot" r="4" cx="' + xh(peak).toFixed(1) + '" cy="' + yv(v[peak]).toFixed(1) + '"/>' + text(xh(peak), yv(v[peak]) - 10, nl(v[peak]), "val", "middle") + "</g>";
    var h0 = sd.focus[0], h1 = sd.focus[1], fy = yv(mx(v.slice(h0, h1 + 1))) - 12;
    return { svg: wrapSvg(W, H, m.title + ", gesimuleerd", "Lijn per uur van 0 tot 23 u; de band toont de uren waarop de zaak bereikbaar is. " + sd.callout.v + " " + sd.callout.t + "." + (alt ? " Tweede, lichtere reeks: " + (alt.legend || "na de actie") + "." : ""), inner),
      frame: f, focus: { x: xh(h0) - 6, y: fy, w: xh(h1) - xh(h0) + 12, h: f.y1 - fy + 4 }, cpos: { x: f.x0 + 10, y: f.y0 + 24 }, legend: legend(lg) };
  }
  /* ── chart 3: reviews per maand (stacked) + score (line), two panels on one x ── */
  function renderReviews(b, W, H, alt) {
    var r = b.reviews, n = 12, f = frame(W, H), gap = 30, topH = (f.y1 - f.y0 - gap - 28) * 0.58, m = meta(b, "reviews");
    var fT = { x0: f.x0, x1: f.x1, y0: f.y0 + 14, y1: f.y0 + 14 + topH }, fB = { x0: f.x0, x1: f.x1, y0: f.y0 + 14 + topH + gap + 14, y1: f.y1 };
    var ans = r.total.map(function (t, i) { return t - r.unanswered[i]; }), a2 = alt ? { base: alt.total.map(function (t, i) { return t - alt.unanswered[i]; }), top: alt.unanswered } : null;
    var top = mx(alt ? r.total.concat(alt.total) : r.total), step = stepFor(top), max = Math.ceil(top / step) * step;
    var st = stacked(fT, ans, r.unanswered, n, max, "s0", "s2", a2), lo = 3.5, hi = 5, ph = fB.y1 - fB.y0, every = st.slot < 26 ? 2 : 1;
    var xc = function (i) { return fT.x0 + i * st.slot + st.slot / 2; }, ys = function (val) { return fB.y1 - (val - lo) / (hi - lo) * ph; };
    var pts = r.score.map(function (val, i) { return xc(i).toFixed(1) + " " + ys(val).toFixed(1); }), xs = "", dots = "";
    for (var i = 0; i < n; i += every) xs += text(xc(i), fB.y1 + 18, D().months[i], "", "middle");
    for (var k = 0; k < n; k++) dots += '<circle class="dot" r="4" cx="' + xc(k).toFixed(1) + '" cy="' + ys(r.score[k]).toFixed(1) + '"/>';
    var lab = function (i) { var y = ys(r.score[i]); return text(xc(i), y < fB.y0 + 24 ? y + 17 : y - 11, nl(r.score[i]), "val", "middle"); };   /* flips below the dot near the panel title */
    var inner = text(fT.x0, fT.y0 - 6, "reviews per maand", "lbl") + text(fB.x0, fB.y0 - 6, "gemiddelde score", "lbl") + axisY(fT, max, step) + axisScore(fB, lo, hi, 0.5) + xs +
      '<g clip-path="url(#sim-clip)">' + st.svg + '<path class="ln" d="M' + pts.join("L") + '"/>' + dots + lab(0) + lab(n - 1) + "</g>";
    var a = r.focus[0], z = r.focus[1], lg = [["s0", "beantwoord"], ["s2", "zonder antwoord"], ["s1 line", "gemiddelde score"]]; if (alt) lg.push(["s2 wat", alt.legend || "na de actie"]);
    return { svg: wrapSvg(W, H, m.title + ", gesimuleerd", "Boven: reviews per maand, beantwoord en zonder antwoord. Onder: gemiddelde score van 3,5 tot 5. " + r.callout.v + ", " + r.callout.t + "." + (alt ? " Lichtere kolommen: " + (alt.legend || "na de actie") + "; de score blijft zoals gemeten." : ""), inner),
      frame: f, focus: { x: fT.x0 + a * st.slot - 2, y: fT.y0 - 4, w: (z - a + 1) * st.slot + 4, h: fB.y1 - fT.y0 + 8 }, legend: legend(lg) };
  }
  /* ── chart 4: bezoek per week (stacked) + laadtijd (horizontal bars), small multiples ── */
  function renderWeb(b, W, H) {
    var w = b.web, f = frame(W, H), n = 8, narrow = W < 520, leftW = (f.x1 - f.x0) * (narrow ? 0.5 : 0.55), gapX = narrow ? 58 : 78, m = meta(b, "web");
    var fL = { x0: f.x0, x1: f.x0 + leftW, y0: f.y0 + 14, y1: f.y1 }, fR = { x0: f.x0 + leftW + gapX, x1: f.x1, y0: f.y0 + 14, y1: f.y1 };
    var tot = w.mobile.map(function (v, i) { return v + w.desktop[i]; }), max = Math.ceil(mx(tot) / 100) * 100;
    var st = stacked(fL, w.mobile, w.desktop, n, max, "s1", "s0"), xs = "", every = st.slot < 26 ? 2 : 1;
    for (var i = 0; i < n; i += every) xs += text(fL.x0 + i * st.slot + st.slot / 2, fL.y1 + 18, "w" + (i + 1), "", "middle");
    var lmax = w.load.mobile > 6 ? 10 : 8, bh = 18, rowY = [fR.y0 + 36, fR.y0 + 36 + bh + 26], pw = fR.x1 - fR.x0, xl = function (s) { return fR.x0 + s / lmax * pw; }, bars = "", ticks = "";
    [["mobiel", w.load.mobile, "s1"], ["desktop", w.load.desktop, "s0"]].forEach(function (row, k) {
      bars += text(fR.x0 - 8, rowY[k] + bh / 2 + 4, row[0], "lbl", "end") + hbar(fR.x0, rowY[k], xl(row[1]) - fR.x0, bh, row[2]) + text(xl(row[1]) + 7, rowY[k] + bh / 2 + 4, nl(row[1]) + " s", "val");
    });
    for (var s = 0; s <= lmax; s += lmax / 2) ticks += '<line class="' + (s === 0 ? "base" : "grid") + '" x1="' + xl(s).toFixed(1) + '" x2="' + xl(s).toFixed(1) + '" y1="' + fR.y0 + '" y2="' + fR.y1 + '"/>' + text(xl(s), fR.y1 + 18, s + " s", "", "middle");
    var rx = xl(w.load.ref), rl = (narrow ? "richtw. " : "richtwaarde ") + nl(w.load.ref) + " s", fits = rx + 5 + rl.length * 6.8 <= fR.x1;
    var ref = '<line class="ref" x1="' + rx.toFixed(1) + '" x2="' + rx.toFixed(1) + '" y1="' + fR.y0 + '" y2="' + fR.y1 + '"/>' + text(fits ? rx + 5 : fR.x1, fR.y0 + 12, rl, "lbl", fits ? "" : "end");
    var share = Math.round(100 * sum(w.mobile) / (sum(w.mobile) + sum(w.desktop)));
    var inner = text(fL.x0, fL.y0 - 6, "bezoek per week", "lbl") + text(fR.x0, fR.y0 - 6, "laadtijd", "lbl") + axisY(fL, max, max / 2) + xs + ticks + ref +
      '<g clip-path="url(#sim-clip)">' + st.svg + bars + "</g>";
    return { svg: wrapSvg(W, H, m.title + ", gesimuleerd", "Links gestapelde kolommen per week, mobiel onderaan. Rechts laadtijd in seconden met de richtwaarde. " + w.callout.v + " " + w.callout.t + ".", inner),
      frame: f, focus: { x: fR.x0 - 4, y: rowY[0] - 8, w: Math.min(xl(w.load.mobile) - fR.x0 + 54, W - fR.x0 + 2), h: bh + 16 }, cpos: { x: fR.x0 - 4, y: rowY[1] + bh + 16 },
      legend: legend([["s1", "mobiel " + share + " %"], ["s0", "desktop " + (100 - share) + " %"]]) };
  }

  window.SIM_CHARTS = { calls: renderCalls, search: renderSearch, reviews: renderReviews, web: renderWeb, order: ["calls", "search", "reviews", "web"], meta: meta, nl: nl, esc: esc, sum: sum };
})();
