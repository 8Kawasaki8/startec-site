/* Score: the one scoring function of the site. The Zichtbaarheidscheck (tools-check.js) and the
   signal toggles of werkwijze.html feed it the same way: a list or map of values from 0 to 100,
   one per question or signal, and get the rounded mean back. Three bands with fixed thresholds
   (laag < 40, midden < 75, hoog). Classic script (window.STSScore); also loadable in node for
   scripts/qa/fixtures/tools.json (the module sets globalThis.STSScore). No DOM access. */
(function (root) {
  var BANDS = { laag: 40, hoog: 75 };

  function list(values) {
    if (Array.isArray(values)) return values;
    if (!values || typeof values !== "object") return [];
    return Object.keys(values).map(function (k) { return values[k]; });
  }

  /* score([100, 50, 0]) -> 50; values outside 0-100 are clamped, non-numbers skipped; no answers -> 0. */
  function score(values) {
    var n = 0, sum = 0;
    list(values).forEach(function (v) {
      v = Number(v);
      if (!isFinite(v)) return;
      sum += Math.max(0, Math.min(100, v)); n++;
    });
    return n ? Math.round(sum / n) : 0;
  }

  /* band(score) -> 'laag' | 'midden' | 'hoog' */
  function band(s) { return s < BANDS.laag ? "laag" : s < BANDS.hoog ? "midden" : "hoog"; }

  /* worst({q1: 100, q2: 0}, 3) -> the n keys with the lowest values, ties in their original order. */
  function worst(values, n) {
    var keys = Object.keys(values || {});
    return keys.map(function (k, i) { return { k: k, v: Number(values[k]) || 0, i: i }; })
      .sort(function (a, b) { return a.v - b.v || a.i - b.i; })
      .slice(0, n == null ? 3 : n)
      .map(function (o) { return o.k; });
  }

  /* dashoffset(score, circumference) for an SVG ring: the unlit part of the circle. */
  function dashoffset(s, circumference) { return (circumference * (1 - Math.max(0, Math.min(100, s)) / 100)).toFixed(1); }

  root.STSScore = { BANDS: BANDS, score: score, band: band, worst: worst, dashoffset: dashoffset };
})(typeof window !== "undefined" ? window : globalThis);
