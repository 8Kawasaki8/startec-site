/* Split-flap phase board (flap.css). STSFlap.mount(el, opts) builds a row of character cells
   in el's [data-flap-rij] (aria-hidden) and returns { set(name), clear(), kill(), names }. The
   visible mirror is the static <ol data-flap-fasen> in el: its items are the phases, in order; the
   current one gets aria-current="step", the ones before it the class is-done.
   The board knows nothing about the simulation. sim.js calls set() with the current label of its
   GSAP timeline (tl.currentLabel()), so the board can only show a phase the timeline has reached.
   set(name) flips each changed cell from its character to the target through at most STEPS
   intermediate characters: one GSAP tween per changed cell on a plain counter whose onUpdate
   writes textContent and scales the glyph on Y (transform only, 55 ms per step, 25 ms stagger per
   cell). Nothing runs between changes; kill() stops a flip in progress (pagehide). Reduced motion,
   lite or no GSAP: the text is written at once. No setTimeout, no setInterval. */
(function () {
  var CH = " ABCDEFGHIJKLMNOPQRSTUVWXYZ", STEPS = 5, NB = " ";
  function mount(el, opts) {
    opts = opts || {};
    var row = el.querySelector("[data-flap-rij]"), ol = el.querySelector("[data-flap-fasen]"), items = ol ? [].slice.call(ol.children) : [];
    var names = items.map(function (li) { return li.textContent.trim().toUpperCase(); });
    var width = Math.max.apply(null, names.map(function (n) { return n.length; }).concat([opts.width || 0, 1]));
    var G = window.gsap || null, instant = !!(opts.reduce || opts.lite) || !G, cells = [], tweens = [];
    if (row) {
      row.innerHTML = "";
      for (var i = 0; i < width; i++) { var c = document.createElement("span"); c.className = "fasenbord-cel is-leeg"; c.innerHTML = '<b class="fasenbord-teken">' + NB + "</b>"; row.appendChild(c); cells.push(c); }
    }
    function glyph(c) { return c.firstChild; }
    function write(c, ch) { glyph(c).textContent = ch === " " ? NB : ch; c.classList.toggle("is-leeg", ch === " "); }
    function mark(name) {
      var at = names.indexOf(name);
      items.forEach(function (li, k) {
        if (k === at) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
        li.classList.toggle("is-done", at > k);
      });
    }
    function kill() {
      tweens.forEach(function (t) { t.kill(); }); tweens = [];
      if (G) cells.forEach(function (c) { G.set(glyph(c), { scaleY: 1 }); });
    }
    function flip(c, from, to, i) {
      var a = CH.indexOf(from), z = CH.indexOf(to), n = Math.min(STEPS, Math.max(1, Math.abs(z - a))), seq = [], k, o = { k: 0 }, g = glyph(c), last = -1;
      for (k = 1; k < n; k++) seq.push(CH.charAt(Math.round(a + (z - a) * k / n)));
      seq.push(to);
      tweens.push(G.to(o, { k: n, duration: 0.055 * n, ease: "none", delay: 0.025 * i,
        onUpdate: function () {
          var s = Math.min(n - 1, Math.floor(o.k));
          if (s !== last) { last = s; write(c, seq[s]); }
          G.set(g, { scaleY: 0.3 + 0.7 * Math.abs(Math.cos(Math.PI * (o.k % 1))) });
        },
        onComplete: function () { write(c, to); G.set(g, { scaleY: 1 }); } }));
    }
    function set(name) {
      var target = String(name || "").toUpperCase().slice(0, width);
      while (target.length < width) target += " ";
      mark(target.trim());
      kill();
      cells.forEach(function (c, i) {
        var from = glyph(c).textContent.replace(NB, " "), to = target.charAt(i);
        if (from === to) return;
        if (instant || CH.indexOf(to) < 0 || CH.indexOf(from) < 0) write(c, to); else flip(c, from, to, i);
      });
    }
    return { set: set, clear: function () { set(""); }, kill: kill, names: names };
  }
  window.STSFlap = { mount: mount };
})();
