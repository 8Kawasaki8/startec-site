/* Radar - achtergrond en motion: sterrenveld (canvas, max 300 deeltjes, pauzeert bij verborgen tab),
   holografische glans die de pointer volgt, tellers, scroll-reveals, zachte scroll. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hasGsap = typeof gsap !== "undefined";
  window.RADAR = window.RADAR || {};

  /* ── zachte scroll (alleen desktop, niet bij reduced motion) ── */
  if (hasGsap && typeof Lenis !== "undefined" && !reduce && fine) {
    var lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.RADAR.lenis = lenis;
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href"); if (id.length < 2) return;
        var el = document.querySelector(id); if (!el) return;
        e.preventDefault(); lenis.scrollTo(el, { offset: -56, duration: 1.2 });
      });
    });
  }

  /* ── deeltjes ── */
  var canvas = document.getElementById("stars");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d"), parts = [], W = 0, H = 0, running = false, last = 0, raf = 0;
    function make(anywhere) {
      var cyan = Math.random() < 0.3;
      return { x: Math.random() * W, y: anywhere ? Math.random() * H : H + 4, r: 0.5 + Math.random() * 1.3,
        vx: (Math.random() - 0.5) * 0.08, vy: -(0.04 + Math.random() * 0.14), a: 0.25 + Math.random() * 0.6,
        ph: Math.random() * Math.PI * 2, c: cyan ? "54,232,255" : "244,246,255" };
    }
    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.min(300, Math.max(40, Math.round((W * H) / 7500)));
      parts = [];
      for (var i = 0; i < n; i++) parts.push(make(true));
    }
    function paint(dt) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (dt) { p.x += p.vx * dt; p.y += p.vy * dt; p.ph += 0.02 * dt; if (p.y < -4 || p.x < -4 || p.x > W + 4) parts[i] = p = make(false); }
        var a = p.a * (0.6 + 0.4 * Math.sin(p.ph));
        ctx.fillStyle = "rgba(" + p.c + "," + a.toFixed(2) + ")";
        if (p.r > 1) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill(); }
        else ctx.fillRect(p.x, p.y, 1.2, 1.2);
      }
    }
    function frame(t) {
      raf = 0; if (!running) return;
      if (t - last >= 33) { paint(Math.min(60, t - last) / 16.7); last = t; }   /* ~30 fps is genoeg voor stof */
      raf = requestAnimationFrame(frame);
    }
    function start() { if (running || reduce) return; running = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { running = false; }
    size();
    if (reduce) paint(0); else start();
    var rT; window.addEventListener("resize", function () { clearTimeout(rT); rT = setTimeout(function () { size(); if (reduce) paint(0); }, 150); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
  }

  /* ── holografische glans: CSS-variabelen volgen de pointer (alleen muis) ── */
  if (fine) {
    document.querySelectorAll(".holo").forEach(function (el) {
      var pending = false, px = 0, py = 0;
      el.addEventListener("pointerenter", function () { el.classList.add("is-lit"); });
      el.addEventListener("pointerleave", function () { el.classList.remove("is-lit"); });
      el.addEventListener("pointermove", function (e) {
        px = e.clientX; py = e.clientY;
        if (pending) return; pending = true;
        requestAnimationFrame(function () {
          pending = false;
          var r = el.getBoundingClientRect();
          el.style.setProperty("--mx", ((px - r.left) / r.width * 100).toFixed(1) + "%");
          el.style.setProperty("--my", ((py - r.top) / r.height * 100).toFixed(1) + "%");
        });
      });
    });
  }

  /* ── tellers ── */
  var nf = new Intl.NumberFormat("nl-BE");
  document.querySelectorAll("[data-count]").forEach(function (el, i) {
    var end = parseInt(el.getAttribute("data-count"), 10);
    if (reduce || !hasGsap) { el.textContent = nf.format(end); return; }
    var o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.8, ease: "power3.out", delay: 0.35 + i * 0.12,
      onUpdate: function () { el.textContent = nf.format(Math.round(o.v)); } });
  });

  /* ── reveals bij scroll (IntersectionObserver: blijft juist als de lijst korter of langer wordt) ── */
  var rv = document.querySelectorAll(".rv");
  if (reduce || !hasGsap || !("IntersectionObserver" in window)) { rv.forEach(function (el) { el.classList.add("is-in"); }); }
  else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        gsap.to(en.target, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", delay: parseFloat(en.target.getAttribute("data-delay")) || 0, clearProps: "transform" });
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.01 });
    rv.forEach(function (el) { io.observe(el); });
  }

  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
