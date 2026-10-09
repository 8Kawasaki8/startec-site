/* Motion layer: preloader, smooth scroll (Lenis), scroll-driven 3D progress,
   text reveals, chapter copy, flick deck, accordion, rail, cursor, nav. */
(function () {
  var root = document.documentElement, body = document.body, C = window.STS_CONFIG || {};
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  gsap.registerPlugin(ScrollTrigger);

  /* ── contact details from config (empty → hidden) ─────────── */
  document.querySelectorAll("[data-c]").forEach(function (el) {
    var key = el.getAttribute("data-c"), v = C[key], wrap = el.closest("[data-c-wrap]") || el;
    if (!v) { wrap.hidden = true; return; }
    if (key === "email") { el.href = "mailto:" + v; if (!el.hasAttribute("data-keep")) el.textContent = v; }
    else if (key === "whatsapp") { el.href = "https://wa.me/" + v; el.target = "_blank"; el.rel = "noopener"; }
    else if (key === "phone") { el.href = "tel:" + v.replace(/[^\d+]/g, ""); if (!el.hasAttribute("data-keep")) el.textContent = v; }
    else el.textContent = v;
  });
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ── smooth scroll ─────────────────────────────────────────── */
  var lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href"); if (id.length < 2) return;
        var el = document.querySelector(id); if (!el) return;
        e.preventDefault(); body.classList.remove("menu-open"); lenis.scrollTo(el, { offset: 0, duration: 1.4 });
      });
    });
  }

  /* ── split text into masked lines (free SplitText stand-in) ── */
  function splitLines(el) {
    var words = el.textContent.trim().split(/\s+/), html = el.innerHTML;
    el.innerHTML = words.map(function (w) { return '<span class="w">' + w + "</span>"; }).join(" ");
    var lines = [], y = null, cur = [];
    el.querySelectorAll(".w").forEach(function (w) {
      var top = w.offsetTop; if (y !== null && top !== y) { lines.push(cur); cur = []; } y = top; cur.push(w.textContent);
    });
    lines.push(cur);
    // keep <em> highlighting by re-matching the original markup words
    var ems = (html.match(/<em>(.*?)<\/em>/g) || []).map(function (s) { return s.replace(/<\/?em>/g, ""); });
    el.innerHTML = lines.map(function (l) {
      var txt = l.join(" ");
      ems.forEach(function (e) { txt = txt.replace(e, "<em>" + e + "</em>"); });
      return '<span class="split-line"><span>' + txt + "</span></span>";
    }).join("");
    return el.querySelectorAll(".split-line > span");
  }
  function revealLines(el, delay) {
    var lines = splitLines(el);
    gsap.set(lines, { yPercent: 110 });
    return gsap.to(lines, { yPercent: 0, duration: 1.1, ease: "power4.out", stagger: 0.09, delay: delay || 0 });
  }

  /* ── preloader (once per session) ──────────────────────────── */
  var pre = document.getElementById("preloader");
  function start() {
    if (lenis) lenis.start();
    var h1 = document.querySelector(".hero h1");
    if (h1 && !reduce) revealLines(h1, 0.1);
    gsap.from(".hero .eyebrow, .hero .lede, .hero .ctas, .hero .slogan", { y: 18, opacity: 0, duration: 1, stagger: 0.1, delay: 0.5, ease: "power3.out" });
    gsap.from(".tag", { y: 30, opacity: 0, scale: 0.9, duration: 1, stagger: 0.12, delay: 0.9, ease: "back.out(1.6)" });
    document.querySelectorAll(".tag").forEach(function (t, i) {
      gsap.to(t, { y: i % 2 ? -10 : 10, duration: 2.6 + i * 0.4, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1.9 });
    });
  }
  if (pre) {
    if (sessionStorage.getItem("sts-pre") || reduce) { pre.remove(); start(); }
    else {
      if (lenis) lenis.stop();
      var spans = pre.querySelectorAll(".word span"), count = pre.querySelector(".count"), n = { v: 0 };
      var tl = gsap.timeline({ onComplete: function () { sessionStorage.setItem("sts-pre", "1"); pre.remove(); start(); } });
      tl.to(spans, { y: 0, duration: 0.9, stagger: 0.05, ease: "power4.out" }, 0)
        .to(pre.querySelectorAll(".word .st"), { opacity: 1, duration: 0.4 }, 0.5)
        .to(n, { v: 100, duration: 1.3, ease: "power2.inOut", onUpdate: function () { count.textContent = String(Math.round(n.v)).padStart(3, "0") + " %"; } }, 0.1)
        .to(pre.querySelector(".bar"), { scaleX: 1, duration: 1.3, ease: "power2.inOut" }, 0.1)
        .to(pre, { clipPath: "inset(0 0 100% 0)", duration: 0.9, ease: "expo.inOut" }, 1.6);
      pre.addEventListener("click", function () { tl.progress(1); });
    }
  } else start();

  /* ── 3D progress across the chapters ───────────────────────── */
  var chapters = document.getElementById("chapters");
  if (chapters) {
    ScrollTrigger.create({
      trigger: chapters, start: "top top", end: "bottom bottom", scrub: 0.6,
      onUpdate: function (self) { if (window.STSScene) window.STSScene.setProgress(self.progress); }
    });
    // chapter copy blocks switch with scroll position inside each chapter
    document.querySelectorAll(".chapter").forEach(function (ch) {
      var copies = ch.querySelectorAll(".copy"), meter = ch.querySelectorAll(".meter i"), card = ch.querySelector(".city-card");
      ScrollTrigger.create({
        trigger: ch, start: "top top", end: "bottom bottom",
        onUpdate: function (self) {
          var i = Math.min(copies.length - 1, Math.floor(self.progress * copies.length));
          copies.forEach(function (c, k) { c.classList.toggle("is-active", k === i); });
          meter.forEach(function (m, k) { m.classList.toggle("on", k <= i); });
          if (card) card.classList.toggle("is-active", self.progress > 0.3 && self.progress < 0.95);
        },
        // leaving forward: the last beat stays on screen while the sticky layer scrolls out
        onLeaveBack: function () { copies.forEach(function (c, k) { c.classList.toggle("is-active", k === 0); }); meter.forEach(function (m, k) { m.classList.toggle("on", k === 0); }); }
      });
    });
  }

  /* ── reveals + headline splits in later sections ───────────── */
  document.querySelectorAll("[data-reveal], .rv").forEach(function (el) {
    ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: function () { el.classList.add("in"); } });
  });
  if (!reduce) document.querySelectorAll("[data-split]").forEach(function (el) {
    var lines = splitLines(el); gsap.set(lines, { yPercent: 110 });
    ScrollTrigger.create({ trigger: el, start: "top 85%", once: true, onEnter: function () { gsap.to(lines, { yPercent: 0, duration: 1, ease: "power4.out", stagger: 0.08 }); } });
  });

  /* ── rail + nav active state ───────────────────────────────── */
  var railLinks = document.querySelectorAll(".rail a, .nav-links a");
  document.querySelectorAll("[data-section]").forEach(function (sec) {
    ScrollTrigger.create({
      trigger: sec, start: "top 50%", end: "bottom 50%",
      onToggle: function (self) {
        if (!self.isActive) return;
        railLinks.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href").replace(/^.*#/, "#") === "#" + sec.id); });
      }
    });
  });
  var nav = document.querySelector(".nav"), cta = document.querySelector(".fixed-cta");
  ScrollTrigger.create({ start: 80, onUpdate: function (s) { nav.classList.toggle("scrolled", s.scroll() > 80); if (cta) cta.classList.toggle("show", s.scroll() > innerHeight * 0.8); } });
  var burger = document.querySelector(".burger");
  if (burger) burger.addEventListener("click", function () { var o = body.classList.toggle("menu-open"); burger.setAttribute("aria-expanded", o); if (lenis) o ? lenis.stop() : lenis.start(); });
  document.querySelectorAll(".menu a").forEach(function (a) { a.addEventListener("click", function () { body.classList.remove("menu-open"); if (lenis) lenis.start(); }); });

  /* ── flick deck: drag with inertia, snap, arrows, dots ──────── */
  document.querySelectorAll(".deck").forEach(function (deck) {
    var track = deck.querySelector(".deck-track"), cards = track.children, dots = deck.parentNode.querySelectorAll(".dots i");
    var x = 0, startX = 0, startT = 0, lastX = 0, lastT = 0, vel = 0, down = false, idx = 0, tween;
    function step() { return cards[0].offsetWidth + parseFloat(getComputedStyle(track).gap); }
    function max() { return Math.max(0, track.scrollWidth - deck.clientWidth + parseFloat(getComputedStyle(deck).paddingLeft) * 2); }
    function set(v) { x = Math.max(-max(), Math.min(0, v)); track.style.transform = "translate3d(" + x + "px,0,0)"; idx = Math.round(-x / step()); dots.forEach(function (d, i) { d.classList.toggle("on", i === idx); }); }
    function snap(to) { if (tween) tween.kill(); var target = Math.max(-max(), Math.min(0, -Math.round(-to / step()) * step())); tween = gsap.to({ v: x }, { v: target, duration: 0.7, ease: "power3.out", onUpdate: function () { set(this.targets()[0].v); } }); }
    deck.addEventListener("pointerdown", function (e) { down = true; startX = lastX = e.clientX; startT = lastT = performance.now(); if (tween) tween.kill(); deck.classList.add("dragging"); deck.setPointerCapture(e.pointerId); });
    deck.addEventListener("pointermove", function (e) { if (!down) return; var now = performance.now(); vel = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now; set(x + (e.clientX - (startX)) ); startX = e.clientX; });
    function up(e) { if (!down) return; down = false; deck.classList.remove("dragging"); var fling = vel * 260; snap(x + fling); }
    deck.addEventListener("pointerup", up); deck.addEventListener("pointercancel", up);
    deck.addEventListener("click", function (e) { if (Math.abs(vel) > 0.3) e.preventDefault(); }, true);
    deck.parentNode.querySelector("[data-prev]")?.addEventListener("click", function () { snap(x + step()); });
    deck.parentNode.querySelector("[data-next]")?.addEventListener("click", function () { snap(x - step()); });
    addEventListener("resize", function () { set(x); });
    set(0);
  });

  /* Lab links prefill the contact form on the same page */
  document.querySelectorAll("[data-subject]").forEach(function (a) {
    a.addEventListener("click", function () {
      var m = document.querySelector("#contact-form [name=message]");
      if (m && !m.value) m.value = "Hallo, ik ben geïnteresseerd in: " + a.getAttribute("data-subject") + ".\n\n";
    });
  });

  /* ── accordion ─────────────────────────────────────────────── */
  document.querySelectorAll(".acc-item").forEach(function (item) {
    var head = item.querySelector(".acc-head"), bodyEl = item.querySelector(".acc-body");
    head.addEventListener("click", function () {
      var open = item.classList.toggle("open"); head.setAttribute("aria-expanded", open);
      gsap.to(bodyEl, { height: open ? "auto" : 0, duration: 0.5, ease: "power3.inOut", onComplete: ScrollTrigger.refresh });
    });
  });

  /* ── cursor follower (desktop only) ────────────────────────── */
  if (matchMedia("(hover:hover) and (pointer:fine)").matches && !reduce) {
    var dot = document.createElement("i"), ring = document.createElement("i");
    dot.className = "cur-dot"; ring.className = "cur-ring"; body.append(dot, ring);
    var dx = gsap.quickTo(dot, "x", { duration: 0.05 }), dy = gsap.quickTo(dot, "y", { duration: 0.05 });
    var rx = gsap.quickTo(ring, "x", { duration: 0.22, ease: "power3" }), ry = gsap.quickTo(ring, "y", { duration: 0.22, ease: "power3" });
    addEventListener("pointermove", function (e) { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
    document.querySelectorAll("a, button, .card, .tag, .acc-head").forEach(function (el) {
      el.addEventListener("pointerenter", function () { ring.classList.add("big"); });
      el.addEventListener("pointerleave", function () { ring.classList.remove("big"); });
    });
  }

  addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
