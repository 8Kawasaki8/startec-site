/* Simulatieruimte engine. One GSAP master timeline owns every beat of a run
   (log lines typed, chart revealed by the scan, reticle locked, callout,
   finding, advice), so speed, pause (tab hidden / room off-screen) and
   "skip to the end" are all operations on that one timeline.
   Charts are pure functions of (business, width, height) returning SVG
   markup plus the focus rectangle the reticle locks on; the reticle lives
   in its own SVG layer over the chart and only ever changes transforms. */
(function () {
  var D = window.SIM_DATA; if (!D || !window.gsap) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, lite = false;
  try { lite = localStorage.getItem("sts-lite") === "1"; } catch (e) { /* storage blocked */ }
  var $ = function (id) { return document.getElementById(id); };
  var E = { stage: $("stage"), wrap: $("chart-wrap"), chart: $("sim-chart"), ret: $("sim-ret"), callout: $("sim-callout"), log: $("sim-log"),
    finds: $("sim-find"), findEmpty: $("find-empty"), findCount: $("find-count"), logCount: $("log-count"), tabs: $("sim-tabs"), legend: $("sim-legend"),
    title: $("chart-title"), sub: $("chart-sub-txt"), src: $("chart-src"), biz: $("stage-biz"), place: $("stage-place"), phase: $("sim-phase"),
    clock: $("sim-clock"), prog: $("sim-prog"), advice: $("sim-advice"), advNote: $("adv-note"), human: document.querySelector(".human"),
    humState: $("hum-state"), start: $("sim-start"), reset: $("sim-reset"), skips: [$("sim-skip"), $("sim-skip2")].filter(Boolean), room: $("room"), zone: $("sim-zone") };
  var S = { biz: "noordpool", speed: 1, status: "idle", tl: null, chart: 0, cur: null, locked: false, hidden: false, off: false, lines: [], finds: [], advs: [], lastSec: -1 };
  var TYPE = lite ? 2000 : 80;      /* characters per second in the log */

  /* ── helpers ──────────────────────────────────────────────── */
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function nl(n) { var s = String(n).split("."); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, "."); return s.join(","); }
  function clock(t) { t = Math.max(0, Math.floor(t)); return (t < 600 ? "0" : "") + Math.floor(t / 60) + ":" + (t % 60 < 10 ? "0" : "") + (t % 60); }
  function biz() { return D.businesses[S.biz]; }
  function stepFor(max) { return max <= 8 ? 2 : max <= 16 ? 5 : max <= 50 ? 10 : max <= 100 ? 20 : max <= 400 ? 100 : 200; }
  function frame(W, H, l) { return { x0: l || 40, x1: W - 14, y0: 14, y1: H - 30 }; }
  function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }

  /* ── SVG mark builders (dataviz specs: thin marks, 4px data-end, 2px gaps) */
  function rect(x, y, w, h, cls) { return h <= 0 ? "" : '<rect class="' + cls + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '"/>'; }
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
  function stacked(f, base, top, n, max, clsBase, clsTop, every) {
    var slot = (f.x1 - f.x0) / n, bw = Math.min(24, slot * 0.58), ph = f.y1 - f.y0, s = "", tops = [];
    for (var i = 0; i < n; i++) {
      var x = f.x0 + i * slot + (slot - bw) / 2, hb = base[i] / max * ph, ht = top[i] / max * ph, yb = f.y1 - hb, t = yb;
      if (ht > 0.5) { s += rect(x, yb, bw, hb, clsBase); t = yb - 2 - ht; s += col(x, t, bw, ht, clsTop); } else s += col(x, yb, bw, hb, clsBase);
      tops.push(t);
    }
    return { svg: s, slot: slot, bw: bw, tops: tops };
  }
  function legend(items) { return items.map(function (it) { return "<li><i class=\"" + it[0] + "\"></i>" + esc(it[1]) + "</li>"; }).join(""); }
  function wrapSvg(W, H, title, desc, inner) {
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="sim-ct sim-cd"><title id="sim-ct">' + esc(title) + '</title><desc id="sim-cd">' + esc(desc) + "</desc>" +
      '<defs><clipPath id="sim-clip"><rect id="sim-clip-r" x="0" y="0" width="' + W + '" height="' + H + '"/></clipPath></defs>' + inner + "</svg>";
  }

  /* ── chart 1: oproepen per uur (stacked columns, gemist on top) ── */
  function renderCalls(b, W, H) {
    var c = b.calls, n = c.answered.length, f = frame(W, H), tot = c.answered.map(function (v, i) { return v + c.missed[i]; });
    var step = stepFor(Math.max.apply(null, tot)), max = Math.ceil(Math.max.apply(null, tot) / step) * step;
    var st = stacked(f, c.answered, c.missed, n, max, "s0", "s2"), every = st.slot < 30 ? 2 : 1, x = "";
    for (var i = 0; i < n; i += every) x += text(f.x0 + i * st.slot + st.slot / 2, f.y1 + 18, (c.from + i) + " u", "", "middle");
    var a = c.focus[0], z = c.focus[1], fy = Math.min.apply(null, st.tops.slice(a, z + 1)) - 8;
    return { svg: wrapSvg(W, H, "Oproepen per uur, beantwoord en gemist, gesimuleerd", "Gestapelde kolommen per uur van " + c.from + " tot " + (c.from + n) + " u. " + c.callout.v + " " + c.callout.t + ".",
        axisY(f, max, step) + x + '<g clip-path="url(#sim-clip)">' + st.svg + "</g>"),
      frame: f, focus: { x: f.x0 + a * st.slot + (st.slot - st.bw) / 2 - 7, y: fy, w: (z - a + 1) * st.slot - (st.slot - st.bw) + 14, h: f.y1 - fy + 4 }, cpos: { x: f.x1 - 236, y: f.y0 + 2 },
      legend: legend([["s0", "beantwoord"], ["s2", "gemist"]]) };
  }
  /* ── chart 2: zoekopdrachten "open nu" per uur, line over the opening-hours band ── */
  function renderSearch(b, W, H) {
    var sd = b.search, v = sd.values, f = frame(W, H), mx = Math.max.apply(null, v), step = stepFor(mx), max = Math.ceil(mx / step) * step, ph = f.y1 - f.y0;
    var xh = function (h) { return f.x0 + h / 23 * (f.x1 - f.x0); }, yv = function (val) { return f.y1 - val / max * ph; };
    var bx0 = xh(sd.open[0]), bx1 = xh(sd.open[1]), pts = v.map(function (val, h) { return xh(h).toFixed(1) + " " + yv(val).toFixed(1); });
    var line = "M" + pts.join("L"), area = line + "L" + f.x1 + " " + f.y1 + "L" + f.x0 + " " + f.y1 + "Z", peak = v.indexOf(mx), xs = "";
    for (var h = 0; h <= 21; h += 3) xs += text(xh(h), f.y1 + 18, h + " u", "", "middle");
    var defs = '<defs><clipPath id="sim-cin"><rect x="' + bx0.toFixed(1) + '" y="0" width="' + (bx1 - bx0).toFixed(1) + '" height="' + H + '"/></clipPath>' +
      '<clipPath id="sim-cout"><rect x="0" y="0" width="' + bx0.toFixed(1) + '" height="' + H + '"/><rect x="' + bx1.toFixed(1) + '" y="0" width="' + (W - bx1).toFixed(1) + '" height="' + H + '"/></clipPath></defs>';
    var inner = defs + rect(bx0, f.y0, bx1 - bx0, ph, "band") + text(bx0 + 7, f.y0 + 13, sd.openLabel, "lbl") + axisY(f, max, step) + xs +
      '<g clip-path="url(#sim-clip)"><path class="wash" clip-path="url(#sim-cin)" d="' + area + '"/><path class="wash2" clip-path="url(#sim-cout)" d="' + area + '"/><path class="ln" d="' + line + '"/>' +
      '<circle class="dot" r="4" cx="' + xh(peak).toFixed(1) + '" cy="' + yv(v[peak]).toFixed(1) + '"/>' + text(xh(peak), yv(v[peak]) - 10, nl(v[peak]), "val", "middle") + "</g>";
    var h0 = sd.focus[0], h1 = sd.focus[1], fy = yv(Math.max.apply(null, v.slice(h0, h1 + 1))) - 12;
    return { svg: wrapSvg(W, H, "Zoekopdrachten open nu per uur, met de openingsuren, gesimuleerd", "Lijn per uur van 0 tot 23 u; de band toont de openingsuren. " + sd.callout.v + " " + sd.callout.t + ".", inner),
      frame: f, focus: { x: xh(h0) - 6, y: fy, w: xh(h1) - xh(h0) + 12, h: f.y1 - fy + 4 }, cpos: { x: f.x0 + 10, y: f.y0 + 24 },
      legend: legend([["s1 line", "zoekopdrachten ‘open nu’"], ["band", "openingsuren"], ["s2", "buiten de uren"]]) };
  }
  /* ── chart 3: reviews per maand (stacked) + score (line), two panels on one x ── */
  function renderReviews(b, W, H) {
    var r = b.reviews, n = 12, f = frame(W, H), gap = 30, topH = (f.y1 - f.y0 - gap - 28) * 0.58;
    var fT = { x0: f.x0, x1: f.x1, y0: f.y0 + 14, y1: f.y0 + 14 + topH }, fB = { x0: f.x0, x1: f.x1, y0: f.y0 + 14 + topH + gap + 14, y1: f.y1 };
    var ans = r.total.map(function (t, i) { return t - r.unanswered[i]; }), mx = Math.max.apply(null, r.total), step = stepFor(mx), max = Math.ceil(mx / step) * step;
    var st = stacked(fT, ans, r.unanswered, n, max, "s0", "s2"), lo = 3.5, hi = 5, ph = fB.y1 - fB.y0, every = st.slot < 26 ? 2 : 1;
    var xc = function (i) { return fT.x0 + i * st.slot + st.slot / 2; }, ys = function (val) { return fB.y1 - (val - lo) / (hi - lo) * ph; };
    var pts = r.score.map(function (val, i) { return xc(i).toFixed(1) + " " + ys(val).toFixed(1); }), xs = "", dots = "";
    for (var i = 0; i < n; i += every) xs += text(xc(i), fB.y1 + 18, D.months[i], "", "middle");
    for (var k = 0; k < n; k++) dots += '<circle class="dot" r="4" cx="' + xc(k).toFixed(1) + '" cy="' + ys(r.score[k]).toFixed(1) + '"/>';
    var lab = function (i) { var y = ys(r.score[i]); return text(xc(i), y < fB.y0 + 24 ? y + 17 : y - 11, nl(r.score[i]), "val", "middle"); };   /* flips below the dot near the panel title */
    var inner = text(fT.x0, fT.y0 - 6, "reviews per maand", "lbl") + text(fB.x0, fB.y0 - 6, "gemiddelde score", "lbl") + axisY(fT, max, step) + axisScore(fB, lo, hi, 0.5) + xs +
      '<g clip-path="url(#sim-clip)">' + st.svg + '<path class="ln" d="M' + pts.join("L") + '"/>' + dots + lab(0) + lab(n - 1) + "</g>";
    var a = r.focus[0], z = r.focus[1];
    return { svg: wrapSvg(W, H, "Reviews per maand en gemiddelde score, gesimuleerd", "Boven: reviews per maand, beantwoord en zonder antwoord. Onder: gemiddelde score van 3,5 tot 5. " + r.callout.v + ", " + r.callout.t + ".", inner),
      frame: f, focus: { x: fT.x0 + a * st.slot - 2, y: fT.y0 - 4, w: (z - a + 1) * st.slot + 4, h: fB.y1 - fT.y0 + 8 },
      legend: legend([["s0", "beantwoord"], ["s2", "zonder antwoord"], ["s1 line", "gemiddelde score"]]) };
  }
  /* ── chart 4: bezoek per week (stacked) + laadtijd (horizontal bars), small multiples ── */
  function renderWeb(b, W, H) {
    var w = b.web, f = frame(W, H), n = 8, narrow = W < 520, leftW = (f.x1 - f.x0) * (narrow ? 0.5 : 0.55), gapX = narrow ? 58 : 78;
    var fL = { x0: f.x0, x1: f.x0 + leftW, y0: f.y0 + 14, y1: f.y1 }, fR = { x0: f.x0 + leftW + gapX, x1: f.x1, y0: f.y0 + 14, y1: f.y1 };
    var tot = w.mobile.map(function (m, i) { return m + w.desktop[i]; }), mx = Math.max.apply(null, tot), max = Math.ceil(mx / 100) * 100;
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
    return { svg: wrapSvg(W, H, "Websitebezoek per week, mobiel en desktop, en laadtijd, gesimuleerd", "Links gestapelde kolommen per week, mobiel onderaan. Rechts laadtijd in seconden met de richtwaarde. " + w.callout.v + " " + w.callout.t + ".", inner),
      frame: f, focus: { x: fR.x0 - 4, y: rowY[0] - 8, w: Math.min(xl(w.load.mobile) - fR.x0 + 54, W - fR.x0 + 2), h: bh + 16 }, cpos: { x: fR.x0 - 4, y: rowY[1] + bh + 16 },
      legend: legend([["s1", "mobiel " + share + " %"], ["s0", "desktop " + (100 - share) + " %"]]) };
  }
  var RENDER = [renderCalls, renderSearch, renderReviews, renderWeb];

  /* ── reticle layer: built once, moved by transforms only ──── */
  var RL = {};
  function buildRet() {
    var ns = "http://www.w3.org/2000/svg", mk = function (tag, attrs, parent) { var el = document.createElementNS(ns, tag); for (var k in attrs) el.setAttribute(k, attrs[k]); (parent || E.ret).appendChild(el); return el; };
    E.ret.innerHTML = '<defs><linearGradient id="sim-scan-grad" x1="0" x2="1"><stop offset="0" stop-color="#36E8FF" stop-opacity="0"/><stop offset="1" stop-color="#36E8FF" stop-opacity=".2"/></linearGradient></defs>';
    RL.scan = mk("g", { opacity: 0 }); RL.wash = mk("rect", { "class": "scan-wash", x: -90, y: 0, width: 90, height: 10 }, RL.scan); RL.line = mk("line", { "class": "scan-line", x1: 0, x2: 0, y1: 0, y2: 10 }, RL.scan);
    RL.g = mk("g", { opacity: 0 }); RL.dim = []; RL.glow = []; RL.fr = []; RL.cn = [];
    for (var i = 0; i < 4; i++) RL.dim.push(mk("rect", { "class": "dim", width: 1, height: 1 }, RL.g));
    for (i = 0; i < 4; i++) RL.glow.push(mk("line", { "class": "fr-glow", x1: 0, y1: 0, x2: i < 2 ? 1 : 0, y2: i < 2 ? 0 : 1 }, RL.g));
    for (i = 0; i < 4; i++) RL.fr.push(mk("line", { "class": "fr", x1: 0, y1: 0, x2: i < 2 ? 1 : 0, y2: i < 2 ? 0 : 1 }, RL.g));
    for (i = 0; i < 4; i++) RL.cn.push(mk("path", { "class": "corner", d: "M0 9V0H9" }, RL.g));
    RL.lead = mk("line", { "class": "lead", opacity: 0 });
  }
  function drawRet(x, y, w, h, o) {
    var W = S.cur.W, H = S.cur.H, t = function (el, v) { el.setAttribute("transform", v); };
    t(RL.dim[0], "translate(0 0) scale(" + W + " " + Math.max(0, y) + ")"); t(RL.dim[1], "translate(0 " + (y + h) + ") scale(" + W + " " + Math.max(0, H - y - h) + ")");
    t(RL.dim[2], "translate(0 " + y + ") scale(" + Math.max(0, x) + " " + h + ")"); t(RL.dim[3], "translate(" + (x + w) + " " + y + ") scale(" + Math.max(0, W - x - w) + " " + h + ")");
    var tf = ["translate(" + x + " " + y + ") scale(" + w + " 1)", "translate(" + x + " " + (y + h) + ") scale(" + w + " 1)", "translate(" + x + " " + y + ") scale(1 " + h + ")", "translate(" + (x + w) + " " + y + ") scale(1 " + h + ")"];
    for (var i = 0; i < 4; i++) { t(RL.fr[i], tf[i]); t(RL.glow[i], tf[i]); }
    t(RL.cn[0], "translate(" + x + " " + y + ")"); t(RL.cn[1], "translate(" + (x + w) + " " + y + ") rotate(90)"); t(RL.cn[2], "translate(" + (x + w) + " " + (y + h) + ") rotate(180)"); t(RL.cn[3], "translate(" + x + " " + (y + h) + ") rotate(270)");
    RL.g.setAttribute("opacity", o);
  }
  var P = { p: 0 }, L = { k: 0 };
  function drawReveal() {
    if (!S.cur) return; var f = S.cur.frame, p = P.p, clip = $("sim-clip-r");
    if (clip) clip.setAttribute("transform", "scale(" + Math.max(p, 0.001) + " 1)");
    RL.scan.setAttribute("transform", "translate(" + (f.x0 + p * (f.x1 - f.x0)) + " 0)"); RL.scan.setAttribute("opacity", Math.min(1, p * 6, (1 - p) * 6));
  }
  function drawLock() {
    if (!S.cur) return; var f = S.cur.frame, F = S.cur.focus, k = L.k, e = function (a, b) { return a + (b - a) * k; };
    drawRet(e(f.x1, F.x), e(f.y0, F.y), e(0, F.w), e(f.y1 - f.y0, F.h), k); S.locked = k > 0.99;
  }
  function lockNow() { L.k = 1; drawLock(); }
  function placeCallout(i) {
    var b = biz(), c = b[D.charts[i].id].callout; E.callout.querySelector(".v").textContent = c.v; E.callout.querySelector(".t").textContent = c.t;
    RL.lead.setAttribute("opacity", 0);
    if (!matchMedia("(min-width: 761px)").matches) return;
    var F = S.cur.focus, W = S.cur.W, H = S.cur.H, cw = 232, ch = 64, c = S.cur.cpos, ox = E.wrap.offsetLeft, oy = E.wrap.offsetTop, left, top, lead = null;
    var cx = function (v) { return Math.min(Math.max(4, v), W - cw - 4); }, cy = function (v) { return Math.min(Math.max(4, v), H - ch - 4); };
    if (c) { left = cx(c.x); top = cy(c.y); }                                    /* the chart knows its empty region */
    else if (F.x + F.w + 12 + cw <= W) { left = F.x + F.w + 12; top = cy(F.y - 2); }
    else if (F.x - 12 - cw >= 0) { left = F.x - 12 - cw; top = cy(F.y - 2); }
    else { left = cx(F.x + F.w / 2 - cw / 2); top = F.y > 90 ? F.y - ch - 10 : cy(F.y + F.h + 10); }
    if (left >= F.x + F.w) lead = [left, top + 16, F.x + F.w, F.y];              /* lead line from the nearest callout edge */
    else if (left + cw <= F.x) lead = [left + cw, top + 16, F.x, F.y];
    else if (top >= F.y + F.h) lead = [left + 18, top, Math.min(F.x + 18, F.x + F.w), F.y + F.h];
    else if (top + ch <= F.y) lead = [left + 18, top + ch, F.x + 18, F.y];
    E.callout.style.left = (ox + left) + "px"; E.callout.style.top = (oy + top) + "px"; E.callout.style.width = cw + "px";
    if (lead) { RL.lead.setAttribute("x1", lead[0]); RL.lead.setAttribute("y1", lead[1]); RL.lead.setAttribute("x2", lead[2]); RL.lead.setAttribute("y2", lead[3]); RL.lead.setAttribute("opacity", 0.7); }
  }

  /* ── stage ────────────────────────────────────────────────── */
  function showChart(i, mode) {
    var b = biz(), c = D.charts[i], W = Math.max(280, Math.round(E.wrap.clientWidth || 600)), H = W < 520 ? 262 : 330, out = RENDER[i](b, W, H);
    S.chart = i; S.cur = out; out.W = W; out.H = H; S.locked = false;
    E.chart.innerHTML = out.svg; E.legend.innerHTML = out.legend; E.title.textContent = c.title; E.sub.textContent = c.sub; E.src.textContent = c.src;
    E.ret.setAttribute("viewBox", "0 0 " + W + " " + H); RL.wash.setAttribute("height", H); RL.line.setAttribute("y2", H);
    E.tabs.querySelectorAll("button").forEach(function (t, k) { t.classList.toggle("active", k === i); t.classList.toggle("done", mode !== "idle" && (k < i || (k === i && mode === "final")) || S.status === "done"); t.setAttribute("aria-pressed", k === i); });
    gsap.set(E.callout, { autoAlpha: 0 }); RL.lead.setAttribute("opacity", 0); RL.scan.setAttribute("opacity", 0);
    P.p = mode === "run" ? 0 : 1; drawReveal(); RL.scan.setAttribute("opacity", 0);
    if (mode === "final") { lockNow(); placeCallout(i); gsap.set(E.callout, { autoAlpha: 1, y: 0 }); } else RL.g.setAttribute("opacity", 0);
  }
  function setPhase(s) { E.phase.textContent = s; }
  function showFinding(i) { E.findEmpty.hidden = true; S.finds[i].hidden = false; E.findCount.textContent = (i + 1) + " van 4"; E.finds.scrollTop = E.finds.scrollHeight; }
  function showAdvice() { S.advs.forEach(function (a) { a.hidden = false; }); E.advNote.textContent = "Drie acties, gerangschikt op impact. " + D.advice_note.charAt(0).toUpperCase() + D.advice_note.slice(1) + "."; }
  function humanWait() { E.human.classList.add("wait"); E.humState.textContent = "Wacht op goedkeuring van Snymis"; }
  function scrollLog() { E.log.scrollTop = E.log.scrollHeight; }

  /* ── a run: pre-build the DOM, then one master timeline ────── */
  function prepareRun() {
    var b = biz(); S.lines = []; S.finds = []; S.advs = [];
    E.finds.querySelectorAll(".find").forEach(function (n) { n.remove(); }); E.advice.innerHTML = "";
    b.findings.forEach(function (f) {
      var el = document.createElement("article"); el.className = "find"; el.hidden = true;
      el.innerHTML = '<span class="sev ' + esc(f.sev) + '">' + esc(f.sev) + "</span><h3>" + esc(f.title) + '</h3><p class="num">' + esc(f.value) + '</p><p class="proof">' + esc(f.proof) + "</p>";
      E.finds.appendChild(el); S.finds.push(el);
    });
    b.advice.forEach(function (a, i) {
      var el = document.createElement("article"); el.className = "adv"; el.hidden = true;
      el.innerHTML = '<span class="n">actie ' + (i + 1) + "</span><h3>" + esc(a.title) + "</h3><p>" + esc(a.why) + '</p><p class="imp">' + esc(a.impact) + '</p><span class="est">' + esc(D.advice_note) + "</span>";
      E.advice.appendChild(el); S.advs.push(el);
    });
  }
  function addLine(agent, txt, t) {
    var li = document.createElement("li"); if (agent === "systeem") li.className = "sys";
    li.innerHTML = '<span class="ts">' + clock(t) + '</span><span class="ag">[' + esc(agent) + ']</span><span class="tx"></span>';
    li._text = txt; E.log.appendChild(li); S.lines.push(li); return li;
  }
  function buildTimeline() {
    var b = biz(), tl = gsap.timeline({ paused: true, onUpdate: tick, onComplete: done }), t = 0;
    function say(agent, txt) {
      var li = addLine(agent, txt, t), tx = li.querySelector(".tx"), o = { n: 0 }, dur = Math.max(0.4, txt.length / TYPE);
      tl.call(function () { li.classList.add("on", "typing"); scrollLog(); }, null, t);
      tl.fromTo(o, { n: 0 }, { n: txt.length, duration: dur, ease: "none", onUpdate: function () { tx.textContent = txt.slice(0, Math.round(o.n)); if (Math.round(o.n) % 12 === 0) scrollLog(); } }, t);
      tl.call(function () { li.classList.remove("typing"); tx.textContent = txt; scrollLog(); }, null, t + dur);
      t += dur + 0.3;
    }
    tl.call(setPhase, ["leest het profiel"], 0);
    say("systeem", "Analyse gestart: " + b.name + ", " + b.place + ". Alle data is gesimuleerd.");
    b.log.intro.forEach(function (l) { say(l[0], l[1]); });
    D.charts.forEach(function (c, i) {
      tl.call(setPhase, ["leest " + c.tab.toLowerCase() + " · grafiek " + (i + 1) + " van 4"], t);
      say(b.log[c.id][0][0], b.log[c.id][0][1]);
      tl.call(showChart, [i, "run"], t);
      tl.fromTo(P, { p: 0 }, { p: 1, duration: 1.8, ease: "none", onUpdate: drawReveal }, t); t += 1.9;
      tl.fromTo(L, { k: 0 }, { k: 1, duration: 0.65, ease: "power3.inOut", onUpdate: drawLock }, t); t += 0.75;
      tl.call(placeCallout, [i], t); tl.fromTo(E.callout, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, immediateRender: false }, t); t += 0.35;
      say(b.log[c.id][1][0], b.log[c.id][1][1]);
      tl.call(showFinding, [i], t - 0.02); tl.fromTo(S.finds[i], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, immediateRender: false }, t); t += 1.1;
    });
    tl.call(setPhase, ["stelt het advies op"], t);
    say(b.log.advice[0], b.log.advice[1]);
    tl.call(showAdvice, [], t - 0.02); tl.fromTo(S.advs, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.14, immediateRender: false }, t); t += 0.9;
    say("systeem", D.end_line);
    tl.call(humanWait, [], t);
    return tl;
  }
  function tick() {
    var tl = S.tl; if (!tl) return; E.prog.style.transform = "scaleX(" + tl.progress().toFixed(4) + ")";
    var s = Math.floor(tl.time()); if (s !== S.lastSec) { S.lastSec = s; E.clock.textContent = clock(s); }
  }
  function done() {
    S.status = "done"; E.room.classList.remove("running"); setPhase("klaar · wacht op Snymis");
    E.tabs.querySelectorAll("button").forEach(function (t) { t.classList.add("can", "done"); });
  }
  function finish() {                                  /* skip to the end (also the reduced-motion path) */
    if (S.status === "idle") { prepareRun(); if (!S.tl) S.tl = buildTimeline(); }
    var tl = S.tl, total = tl ? tl.duration() : 0; if (tl) tl.kill();
    S.lines.forEach(function (li) { li.classList.add("on"); li.classList.remove("typing"); li.querySelector(".tx").textContent = li._text; });
    S.finds.concat(S.advs).forEach(function (el) { el.hidden = false; }); gsap.set(S.finds.concat(S.advs), { autoAlpha: 1, y: 0 });
    E.stage.classList.remove("idle"); showFinding(3); showAdvice(); humanWait(); scrollLog();
    E.prog.style.transform = "scaleX(1)"; E.clock.textContent = clock(total); E.start.disabled = true; E.reset.disabled = false;
    done(); showChart(3, "final");
  }
  function reset() {
    if (S.tl) S.tl.kill(); S.tl = null; S.status = "idle"; S.lastSec = -1;
    E.log.innerHTML = ""; E.finds.querySelectorAll(".find").forEach(function (n) { n.remove(); }); E.findEmpty.hidden = false; E.advice.innerHTML = "";
    E.findCount.textContent = "0 van 4"; E.advNote.textContent = "Drie acties, gerangschikt op impact. Verschijnen na de vier grafieken."; E.human.classList.remove("wait"); E.humState.textContent = "Nog geen advies";
    E.room.classList.remove("running"); E.stage.classList.add("idle"); E.skips.forEach(function (a) { a.hidden = true; });
    E.start.disabled = false; E.reset.disabled = true; E.prog.style.transform = "scaleX(0)"; E.clock.textContent = "00:00"; setPhase("standby");
    E.tabs.querySelectorAll("button").forEach(function (t) { t.classList.remove("can", "done"); });
    showChart(0, "idle");
  }
  function start() {
    if (S.status === "running") return;
    reset(); S.status = "running"; prepareRun(); S.tl = buildTimeline(); S.tl.timeScale(S.speed);
    E.stage.classList.remove("idle"); E.room.classList.add("running"); E.skips.forEach(function (a) { a.hidden = false; });
    E.start.disabled = true; E.reset.disabled = false;
    var r = E.room.getBoundingClientRect();                   /* bring the whole room into view when the start button sat above it */
    if (r.top < 60 || r.bottom > innerHeight) scrollTo({ top: scrollY + r.top - 84, behavior: reduce ? "auto" : "smooth" });
    if (reduce) finish(); else { syncPause(); if (!S.hidden && !S.off) S.tl.play(0); }
  }
  function syncPause() {
    if (!S.tl || S.status !== "running") return;
    if (S.hidden || S.off) { S.tl.pause(); setPhase("gepauzeerd · " + (S.hidden ? "tabblad verborgen" : "ruimte buiten beeld")); }
    else if (S.tl.paused()) { S.tl.play(); setPhase("gaat verder"); }
  }

  /* ── wiring ───────────────────────────────────────────────── */
  buildRet();
  D.charts.forEach(function (c, i) {
    var btn = document.createElement("button"); btn.type = "button"; btn.innerHTML = "<b>" + c.n + "</b><span>" + esc(c.tab) + "</span>"; btn.setAttribute("aria-label", "Grafiek " + c.n + ": " + c.title);
    btn.addEventListener("click", function () { if (S.status === "done") showChart(i, "final"); }); E.tabs.appendChild(btn);
  });
  E.logCount.textContent = D.agents.length + " agents · 1 mens";
  document.querySelectorAll(".chip[data-biz]").forEach(function (ch) {
    ch.addEventListener("click", function () {
      S.biz = ch.getAttribute("data-biz"); document.querySelectorAll(".chip[data-biz]").forEach(function (o) { o.setAttribute("aria-pressed", o === ch); });
      E.biz.textContent = biz().name; E.place.textContent = biz().place + " · fictief"; reset();
    });
  });
  document.querySelectorAll(".seg [data-speed]").forEach(function (b) {
    b.addEventListener("click", function () { S.speed = +b.getAttribute("data-speed"); document.querySelectorAll(".seg [data-speed]").forEach(function (o) { o.setAttribute("aria-pressed", o === b); }); if (S.tl) S.tl.timeScale(S.speed); });
  });
  E.start.addEventListener("click", start);
  E.reset.addEventListener("click", reset);
  E.skips.forEach(function (a) { a.addEventListener("click", function () { if (S.status !== "done") finish(); }); });
  document.addEventListener("visibilitychange", function () { S.hidden = document.hidden; syncPause(); });
  if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { S.off = !en[0].isIntersecting; syncPause(); }, { threshold: 0 }).observe(E.zone);
  var rt; addEventListener("resize", function () {
    clearTimeout(rt); rt = setTimeout(function () {
      if (S.status === "idle") showChart(S.chart, "idle"); else if (S.status === "done") showChart(S.chart, "final");
      else { var was = S.locked, p = P.p; showChart(S.chart, "run"); P.p = p; drawReveal(); if (was) { lockNow(); placeCallout(S.chart); gsap.set(E.callout, { autoAlpha: 1, y: 0 }); } }
    }, 150);
  });
  reset();
})();
