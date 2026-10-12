/* Radar - ASCII-laag: radar-sweep in pure tekst (3 lagen: basis, sweep, blips),
   agent-log dat regel per regel tikt, en ASCII-belastingsbalkjes per agent.
   Alles pauzeert buiten beeld of bij een verborgen tab. */
(function () {
  "use strict";
  var D = window.RADAR; if (!D || !D.log) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TAU = Math.PI * 2;

  /* ═══ RADAR-SWEEP ═══ */
  var base = document.getElementById("r-base"), sweep = document.getElementById("r-sweep"), blipL = document.getElementById("r-blip");
  var hitsEl = document.getElementById("radar-hits");
  if (base && sweep && blipL) {
    var W = 39, H = 21, cx = 19, cy = 10, R = 10, ASP = 1.9, PERIOD = 4000, WEDGE = TAU * 0.3;
    var ramp = " .:-=+*#%@";
    var cells = [], r, c;
    for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
      var dx = (c - cx) / ASP, dy = r - cy;
      cells.push({ d: Math.sqrt(dx * dx + dy * dy) / R, a: (Math.atan2(dy, dx) + TAU) % TAU });
    }
    var blips = [[0.3, 0.55], [1.1, 0.8], [1.9, 0.35], [2.6, 0.7], [3.4, 0.5], [4.1, 0.85], [4.9, 0.3], [5.6, 0.65]].map(function (b) {
      return { ang: b[0], c: Math.round(cx + Math.cos(b[0]) * b[1] * R * ASP), r: Math.round(cy + Math.sin(b[0]) * b[1] * R), hit: -1e9 };
    });
    /* basislaag: ringen en assen, eenmalig */
    var bs = "";
    for (r = 0; r < H; r++) {
      for (c = 0; c < W; c++) {
        var k = cells[r * W + c], ch = " ";
        if (k.d <= 1.02) {
          if (k.d > 0.92) ch = "·"; else if (Math.abs(k.d - 0.5) < 0.05) ch = ".";
          if (k.d <= 0.92) { if (r === cy) ch = "-"; if (c === cx) ch = "|"; if (r === cy && c === cx) ch = "+"; }
        }
        bs += ch;
      }
      bs += "\n";
    }
    base.textContent = bs;

    var hits = 0, rev = 0, t0 = performance.now(), running = false, raf = 0, lastF = 0;
    function render(s, now) {
      var out = "", grid = [], i, r2 = Math.floor((now - t0) / PERIOD);
      if (r2 !== rev) { rev = r2; hits = 0; }                       /* contacten tellen per sweep */
      for (r = 0; r < H; r++) {
        var row = "";
        for (c = 0; c < W; c++) {
          var k2 = cells[r * W + c], ch2 = " ";
          if (k2.d <= 1) {
            var diff = (s - k2.a + TAU) % TAU;
            if (diff < WEDGE) { var t = 1 - diff / WEDGE; ch2 = ramp[Math.min(ramp.length - 1, Math.floor(t * t * (ramp.length - 1) + 0.999))]; }
          }
          row += ch2;
        }
        out += row + "\n";
        grid.push(new Array(W).fill(" "));
      }
      sweep.textContent = out;
      for (i = 0; i < blips.length; i++) {
        var b = blips[i], d2 = (s - b.ang + TAU) % TAU;
        if (d2 < 0.14 && now - b.hit > PERIOD * 0.5) { b.hit = now; hits++; }
        var age = now - b.hit;
        grid[b.r][b.c] = age < 350 ? "@" : age < 1300 ? "O" : age < 2600 ? "o" : "·";
      }
      blipL.textContent = grid.map(function (g) { return g.join(""); }).join("\n") + "\n";
      if (hitsEl) hitsEl.textContent = hits + "/" + blips.length;
    }
    function frame(now) {
      raf = 0; if (!running) return;
      if (now - lastF >= 80) { lastF = now; render(((now - t0) % PERIOD) / PERIOD * TAU, now); }
      raf = requestAnimationFrame(frame);
    }
    if (reduce) { blips.forEach(function (b, i) { b.hit = performance.now() - i * 400; }); hits = 8; render(0.8, performance.now()); }
    else D.watch(base.parentNode, function (on) { running = on; if (on && !raf) raf = requestAnimationFrame(frame); });
  }

  /* ═══ AGENT-LOG (tikkende regels) ═══ */
  var term = document.getElementById("term");
  if (term) {
    var lines = D.log, idx = 0, MAXL = 12, clock = 14 * 3600 + 2 * 60 + 17, timer = 0, active = false, cur = null;
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function stamp() {
      clock += 3 + Math.floor(Math.random() * 38);
      return pad(Math.floor(clock / 3600) % 24) + ":" + pad(Math.floor(clock / 60) % 60) + ":" + pad(clock % 60);
    }
    function addLine(item, instant) {
      var ln = document.createElement("div"); ln.className = "ln " + item.a;
      var ts = document.createElement("span"); ts.className = "ts"; ts.textContent = stamp();
      var ag = document.createElement("span"); ag.className = "ag " + item.a; ag.textContent = "[" + item.a + "]";
      var tx = document.createElement("span"); tx.className = "tx";
      ln.appendChild(ts); ln.appendChild(ag); ln.appendChild(tx);
      term.appendChild(ln);
      while (term.children.length > MAXL) term.removeChild(term.firstChild);
      if (instant) { tx.textContent = item.t; return null; }
      var cu = document.createElement("i"); cu.className = "cur"; tx.appendChild(cu);
      return { tx: tx, cu: cu, text: item.t, i: 0 };
    }
    function step() {
      timer = 0; if (!active) return;
      if (!cur) { cur = addLine(lines[idx % lines.length], false); idx++; }
      if (cur.i < cur.text.length) {
        cur.i += Math.random() < 0.3 ? 2 : 1;
        cur.tx.textContent = cur.text.slice(0, cur.i);
        cur.tx.appendChild(cur.cu);
        timer = setTimeout(step, 18 + Math.random() * 30);
      } else {
        var done = cur; cur = null;
        timer = setTimeout(function () { if (done.cu.parentNode) done.cu.parentNode.removeChild(done.cu); step(); }, 900 + Math.random() * 1400);
      }
    }
    var i0;
    if (reduce) { for (i0 = 0; i0 < 10; i0++) addLine(lines[i0], true); }
    else {
      var pre = window.innerWidth > 900 ? 9 : 6;                   /* desktop-terminal is hoger: meer regels vooraf */
      for (i0 = 0; i0 < pre; i0++) addLine(lines[i0], true);
      idx = pre;
      D.watch(term, function (on) { active = on; if (on && !timer) step(); });
    }
  }

  /* ═══ AGENT-BELASTING (ASCII-balkjes) ═══ */
  var ag = document.getElementById("agents");
  if (ag) {
    var rows = D.agents.map(function (a) {
      var row = document.createElement("div"); row.className = "agent";
      var nm = document.createElement("span"); nm.className = "nm"; nm.textContent = a.name;
      var bar = document.createElement("span"); bar.className = "bar";
      var task = document.createElement("span"); task.className = "task"; task.textContent = a.task;
      row.appendChild(nm); row.appendChild(bar); row.appendChild(task);
      ag.appendChild(row);
      return { bar: bar, v: a.load, base: a.load };
    });
    function paintBar(rw) {
      var n = Math.round(rw.v * 10), f = document.createElement("b");
      f.textContent = D.rep("█", n);
      rw.bar.textContent = "";
      rw.bar.appendChild(f);
      rw.bar.appendChild(document.createTextNode(D.rep("░", 10 - n) + " " + Math.round(rw.v * 100) + "%"));
    }
    rows.forEach(paintBar);
    if (!reduce) {
      var iv = 0;
      D.watch(ag, function (on) {
        if (!on) { clearInterval(iv); iv = 0; return; }
        if (!iv) iv = setInterval(function () {
          rows.forEach(function (rw) { rw.v = Math.max(0.05, Math.min(0.98, rw.base + (Math.random() - 0.5) * 0.18)); paintBar(rw); });
        }, 1500);
      });
    }
  }
})();
