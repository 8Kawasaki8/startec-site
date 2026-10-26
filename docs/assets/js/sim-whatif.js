/* Wat-als switches of the Doorlichting (simulatie.html, src/rooms/doorlichting.html).
   After a run ends (status 'done' on the 'sts:sim' event of sim.js) one switch per advice appears.
   A switch re-renders the chart of that advice through the same renderer (sim-charts.js) with a
   second, lighter series and writes the counter 'in deze verzonnen zaak: a -> b ...' under the
   label 'schatting op gesimuleerde data, geen voorspelling voor jouw zaak'. Which switch runs which
   rule is data (SIM_DATA.whatif[biz][i], sim-data-2.js). The rules live here and are pure functions
   of the arrays; every bucket (hour, month) is rounded before it is summed, so the counter matches
   the drawing. One switch at a time; a tab click or a new run clears it.
   RULES (aanname per rule, never a measurement):
   calls_shift {p}    in the focus hours of the calls chart a share p of the missed calls arrives as a
                      message or a callback and counts as answered: missed'[h] = round(missed[h] * (1 - p)),
                      answered'[h] = answered[h] + missed[h] - missed'[h]. Counter: missed in those hours
                      before and after.
   search_catch {p}   of the searches outside the band (whole hours before open[0] or from open[1]) a
                      share p lands on a page where the customer can book or ask; the rest stays as it
                      was: values'[h] = round(values[h] * (1 - p)) outside the band, unchanged inside.
                      The search volume itself does not change: the lighter line is what is left
                      without an answer. Counter: searches outside the band before and after.
   search_gap {listed} Google lists other hours than the door keeps: every search in the gap between
                      the real band (open) and the listed band sees 'open' at a closed door:
                      gap = sum over hours of values[h] * overlap([h, h + 1), gap). After the correction
                      the gap is empty: counter gap -> 0; the second series is the listed band.
   reviews_answer {p} from the focus month a share p of the unanswered reviews gets an answer:
                      unanswered'[m] = round(unanswered[m] * (1 - p)). Counter: unanswered since the
                      focus month before and after. The score line stays as measured: no prediction.
   reviews_flow {add} from the focus month `add` extra reviews per month come in after a review
                      request: total'[m] = total[m] + add, unanswered unchanged. Counter: new reviews
                      in the last month before and after.
   Exported for scripts/qa/sim-check.mjs: window.SIM_WHATIF = { RULES, derive(business, spec) }. */
(function () {
  var MONTHS = { nov: "november", dec: "december", jan: "januari", feb: "februari", mrt: "maart", apr: "april", mei: "mei", jun: "juni", jul: "juli", aug: "augustus", sep: "september", okt: "oktober" };
  function round(v) { return Math.round(v); }
  function hourLabel(h) { var w = Math.floor(h), f = Math.round((h - w) * 60); return w + (f ? "." + (f < 10 ? "0" : "") + f : "") + " u"; }
  function monthName(i) { var D = window.SIM_DATA, k = D && D.months ? D.months[i] : ""; return MONTHS[k] || k; }
  function outside(s, h) { return h < s.open[0] || h >= s.open[1]; }
  function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }

  var RULES = {
    calls_shift: function (b, p) {
      var c = b.calls, a = c.focus[0], z = c.focus[1], missed = c.missed.slice(), answered = c.answered.slice(), before = 0, after = 0;
      for (var i = a; i <= z; i++) { var m2 = round(c.missed[i] * (1 - p.p)); before += c.missed[i]; after += m2; answered[i] += c.missed[i] - m2; missed[i] = m2; }
      return { chart: "calls", alt: { answered: answered, missed: missed, legend: "na de actie: gemist" }, a: before, b: after, what: "gemiste oproepen tussen " + (c.from + a) + " en " + (c.from + z + 1) + " u, per 4 weken" };
    },
    search_catch: function (b, p) {
      var s = b.search, vals = s.values.slice(), before = 0, after = 0;
      s.values.forEach(function (v, h) { if (outside(s, h)) { var n = round(v * (1 - p.p)); before += v; after += n; vals[h] = n; } });
      return { chart: "search", alt: { values: vals, legend: "na de actie: zonder antwoord" }, a: before, b: after, what: p.what || "zoekers buiten de uren die niets kunnen achterlaten, per 4 weken" };
    },
    search_gap: function (b, p) {
      var s = b.search, L = p.listed, gaps = [], count = 0;
      if (L[0] < s.open[0]) gaps.push([L[0], s.open[0]]);
      if (L[1] > s.open[1]) gaps.push([s.open[1], L[1]]);
      gaps.forEach(function (g) { s.values.forEach(function (v, h) { count += v * overlap(h, h + 1, g[0], g[1]); }); });
      var g = gaps[gaps.length - 1] || [s.open[1], s.open[1]];
      return { chart: "search", alt: { gap: g, gapLabel: p.listedLabel || ("Google: tot " + hourLabel(L[1])), legend: "zoals Google het toonde" }, a: round(count), b: 0, what: "zoekers per 4 weken die ‘open’ zagen terwijl de deur al dicht was" };
    },
    reviews_answer: function (b, p) {
      var r = b.reviews, from = r.focus[0], un = r.unanswered.slice(), before = 0, after = 0;
      for (var m = from; m < un.length; m++) { var n = round(r.unanswered[m] * (1 - p.p)); before += r.unanswered[m]; after += n; un[m] = n; }
      return { chart: "reviews", alt: { total: r.total.slice(), unanswered: un, legend: "na de actie: zonder antwoord" }, a: before, b: after, what: "reviews zonder antwoord sinds " + monthName(from) };
    },
    reviews_flow: function (b, p) {
      var r = b.reviews, from = r.focus[0], tot = r.total.slice(), last = tot.length - 1;
      for (var m = from; m < tot.length; m++) tot[m] = r.total[m] + p.add;
      return { chart: "reviews", alt: { total: tot, unanswered: r.unanswered.slice(), legend: "na de actie: nieuwe reviews" }, a: r.total[last], b: tot[last], what: "nieuwe reviews per maand, gemeten in de laatste maand" };
    }
  };
  function derive(b, spec) { var r = spec && RULES[spec.rule]; if (!r || !b) return null; var out = r(b, spec); out.rule = spec.rule; return out; }
  window.SIM_WHATIF = { RULES: RULES, derive: derive };

  /* ── the switches ─────────────────────────────────────────── */
  var box = document.getElementById("sim-watals"), D = window.SIM_DATA, CH = window.SIM_CHARTS;
  if (!box || !D || !CH) return;
  var list = box.querySelector("[data-watals-lijst]"), counter = box.querySelector("[data-watals-teller]"), note = box.querySelector("[data-watals-label]");
  if (note && D.whatif_note) note.textContent = D.whatif_note;
  var active = -1, biz = "";
  function specs() { return (D.whatif && D.whatif[biz]) || []; }
  function build() {
    list.innerHTML = "";
    var b = D.businesses[biz]; if (!b) return;
    specs().forEach(function (sp, i) {
      var btn = document.createElement("button"); btn.type = "button"; btn.className = "btn watals-knop"; btn.setAttribute("aria-pressed", "false");
      btn.innerHTML = '<span class="n">actie ' + (i + 1) + "</span><span>" + CH.esc((b.advice[i] || {}).title || "") + "</span>";
      btn.addEventListener("click", function () { toggle(i); });
      list.appendChild(btn);
    });
  }
  function press(i) { [].forEach.call(list.children, function (btn, k) { btn.setAttribute("aria-pressed", k === i ? "true" : "false"); }); }
  function clear() { active = -1; press(-1); counter.textContent = ""; }
  function toggle(i) {
    var Sim = window.STSSim; if (!Sim || Sim.status() !== "done") return;
    var sp = specs()[i], out = derive(D.businesses[biz], sp), idx = out ? CH.order.indexOf(out.chart) : -1;
    if (active === i || !out || idx < 0) { clear(); if (idx >= 0) Sim.showChart(idx, "final"); return; }
    active = i; press(i);
    Sim.showChart(idx, "final", out.alt);
    counter.textContent = "in deze verzonnen zaak: " + CH.nl(out.a) + " -> " + CH.nl(out.b) + " " + out.what;
  }
  window.addEventListener("sts:sim", function (e) {
    var d = e.detail || {};
    if (d.biz && d.biz !== biz) { biz = d.biz; build(); clear(); }
    if (d.type === "status") { box.hidden = d.status !== "done"; if (d.status !== "done") clear(); }
    if (d.type === "chart" && !d.alt && active >= 0) clear();   /* a tab click or a reset: the measurement stands alone again */
  });
  if (window.STSSim) { biz = window.STSSim.biz(); build(); box.hidden = window.STSSim.status() !== "done"; }
})();
