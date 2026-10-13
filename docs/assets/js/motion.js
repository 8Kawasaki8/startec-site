/* Motion layer: intro hand-over, smooth scroll (Lenis), scroll-driven 3D
   progress, text reveals, chapter copy, flick deck with holographic sheen,
   kinetic marquee, split-flap board, ASCII mirror, accordion, rail, cursor. */
(function () {
  var body = document.body, C = window.STS_CONFIG || {};
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });   // the address bar on phones must not re-layout the chapters

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
  var lenis = null, scrollVel = 0;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on("scroll", function (e) { scrollVel = e.velocity || 0; ScrollTrigger.update(); });
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

  /* ── the scene module loads after this script; wait for it ──── */
  function whenScene(cb) {
    if (window.STSScene) return cb(window.STSScene);
    var done = false;
    function go(s) { if (done) return; done = true; cb(s); }
    addEventListener("sts:scene-ready", function () { go(window.STSScene); }, { once: true });
    addEventListener("sts:scene-failed", function () { go(null); }, { once: true });
    setTimeout(function () { go(window.STSScene || null); }, 4000);
  }

  /* ── intro (once per session) → hero reveal ────────────────── */
  var intro = document.getElementById("intro");
  function start() {
    if (lenis) lenis.start();
    if (!document.querySelector(".hero")) return;
    var h1 = document.querySelector(".hero h1");
    if (h1 && !reduce) revealLines(h1, 0.1);
    gsap.from(".hero .eyebrow, .hero .lede, .hero .ctas, .hero .slogan", { y: 18, opacity: 0, duration: 1, stagger: 0.1, delay: 0.5, ease: "power3.out" });
    gsap.from(".tag", { y: 30, opacity: 0, scale: 0.9, duration: 1, stagger: 0.12, delay: 0.9, ease: "back.out(1.6)" });
    document.querySelectorAll(".tag").forEach(function (t, i) {
      gsap.to(t, { y: i % 2 ? -10 : 10, duration: 2.6 + i * 0.4, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1.9 });
    });
  }
  if (intro) {
    if (sessionStorage.getItem("sts-pre") || reduce) { intro.remove(); start(); }
    else {
      if (lenis) lenis.stop();
      body.classList.add("introing");
      var finished = false;
      function finish() {
        if (finished) return; finished = true;
        sessionStorage.setItem("sts-pre", "1");
        gsap.to(intro, { opacity: 0, duration: 0.5, onComplete: function () { intro.remove(); } });
        body.classList.remove("introing");
        start();
      }
      whenScene(function (s) {
        if (s && s.intro) {
          s.intro.play(finish);
          var skip = function () { s.intro.skip(); };
          intro.addEventListener("click", skip);
          addEventListener("keydown", skip, { once: true });
          addEventListener("wheel", skip, { once: true, passive: true });
          addEventListener("touchstart", skip, { once: true, passive: true });
        } else {
          gsap.to(intro.querySelector(".veil"), { opacity: 0, duration: 0.8, delay: 0.3 });
          setTimeout(finish, 900);
        }
      });
    }
  } else start();

  /* ── 3D progress across the chapters ───────────────────────── */
  var chapters = document.getElementById("chapters");
  if (chapters) {
    ScrollTrigger.create({
      trigger: chapters, start: "top top", end: "bottom bottom", scrub: 0.6,
      onUpdate: function (self) { if (window.STSScene) window.STSScene.setProgress(self.progress); }
    });
    document.querySelectorAll(".chapter").forEach(function (ch) {
      var copies = ch.querySelectorAll(".copy"), meter = ch.querySelectorAll(".meter i"), card = ch.querySelector(".city-card");
      ScrollTrigger.create({
        trigger: ch, start: "top top", end: "bottom bottom",
        onUpdate: function (self) {
          var i = Math.min(copies.length - 1, Math.floor(self.progress * copies.length));
          var ending = self.progress > 0.94;                 // fade the text before the chapter scrolls out
          copies.forEach(function (c, k) { c.classList.toggle("is-active", k === i && !ending); });
          meter.forEach(function (m, k) { m.classList.toggle("on", k <= i); });
          if (card) card.classList.toggle("is-active", self.progress > 0.3 && self.progress < 0.95);
        },
        onLeaveBack: function () { copies.forEach(function (c, k) { c.classList.toggle("is-active", k === 0); }); meter.forEach(function (m, k) { m.classList.toggle("on", k === 0); }); }
      });
    });
  }

  /* ── ASCII mirror of the scene (Onderzoek) ─────────────────── */
  var asciiEl = document.getElementById("ascii");
  if (asciiEl) whenScene(function (s) {
    if (!s || !s.ascii) { asciiEl.parentNode.hidden = true; return; }
    var ctl = s.ascii(asciiEl);
    new IntersectionObserver(function (en) { ctl.set(en[0].isIntersecting); }, { threshold: 0.05 }).observe(asciiEl);
  });

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

  /* ── kinetic marquee: speed follows the scroll velocity ────── */
  document.querySelectorAll("[data-marquee]").forEach(function (track) {
    var seg = track.innerHTML; track.innerHTML = seg + seg + seg;
    var x = 0, w = 0, seen = false;
    function measure() { w = track.scrollWidth / 3; } measure(); addEventListener("resize", measure);
    new IntersectionObserver(function (en) { seen = en[0].isIntersecting; }).observe(track);
    if (!reduce) gsap.ticker.add(function (t, dt) {
      if (!seen) return;
      x -= (0.7 + Math.min(7, Math.abs(scrollVel) * 0.04)) * (dt / 16.7);
      if (x <= -w) x += w;
      track.style.transform = "translate3d(" + x + "px,0,0)";
    });
  });

  /* ── split-flap board ──────────────────────────────────────── */
  var CH = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  document.querySelectorAll("[data-flap]").forEach(function (el) {
    var text = el.getAttribute("data-flap"), n = Math.max(text.length, parseInt(el.getAttribute("data-len") || "0", 10));
    el.innerHTML = ""; var cells = [];
    for (var i = 0; i < n; i++) { var c = document.createElement("span"); c.className = "flap"; c.innerHTML = "<b>&nbsp;</b>"; el.appendChild(c); cells.push(c); }
    el._cells = cells;
  });
  function flipTo(el, text) {
    var cells = el._cells; if (!cells) return;
    text = text.padEnd(cells.length, " ").slice(0, cells.length).toUpperCase();
    cells.forEach(function (cell, i) {
      var target = text[i], b = cell.firstChild;
      if ((b.textContent === " " ? " " : b.textContent) === target) return;
      var steps = 3 + Math.floor(Math.random() * 5), k = 0;
      function step() {
        var ch = k < steps ? CH[Math.floor(Math.random() * CH.length)] : target; k++;
        gsap.to(cell, { rotateX: -90, duration: 0.055, ease: "power1.in", delay: k === 1 ? i * 0.03 : 0, onComplete: function () {
          b.textContent = ch === " " ? " " : ch;
          gsap.to(cell, { rotateX: 0, duration: 0.055, ease: "power1.out", onComplete: function () { if (k <= steps) step(); } });
        } });
      }
      step();
    });
  }
  document.querySelectorAll("[data-board]").forEach(function (board) {
    var rows = board.querySelectorAll("[data-flap]");
    ScrollTrigger.create({ trigger: board, start: "top 85%", once: true, onEnter: function () {
      rows.forEach(function (r) { flipTo(r, r.getAttribute("data-flap")); });
      if (!reduce) setInterval(function () { var r = rows[Math.floor(Math.random() * rows.length)]; flipTo(r, r.getAttribute("data-flap")); r._cells.forEach(function (c) { c.firstChild.textContent = " "; }); flipTo(r, r.getAttribute("data-flap")); }, 14000);
    } });
  });

  /* ── flick deck: drag with inertia, snap, arrows, dots ──────── */
  document.querySelectorAll(".deck").forEach(function (deck) {
    var track = deck.querySelector(".deck-track"), cards = track.children, dots = deck.parentNode.querySelectorAll(".dots i");
    var x = 0, startX = 0, lastX = 0, lastT = 0, vel = 0, down = false, idx = 0, tween;
    function step() { return cards[0].offsetWidth + parseFloat(getComputedStyle(track).gap); }
    function max() { return Math.max(0, track.scrollWidth - deck.clientWidth + parseFloat(getComputedStyle(deck).paddingLeft) * 2); }
    function set(v) { x = Math.max(-max(), Math.min(0, v)); track.style.transform = "translate3d(" + x + "px,0,0)"; idx = Math.round(-x / step()); dots.forEach(function (d, i) { d.classList.toggle("on", i === idx); }); }
    function snap(to) { if (tween) tween.kill(); var target = Math.max(-max(), Math.min(0, -Math.round(-to / step()) * step())); tween = gsap.to({ v: x }, { v: target, duration: 0.7, ease: "power3.out", onUpdate: function () { set(this.targets()[0].v); } }); }
    deck.addEventListener("pointerdown", function (e) { down = true; startX = lastX = e.clientX; lastT = performance.now(); if (tween) tween.kill(); deck.classList.add("dragging"); deck.setPointerCapture(e.pointerId); });
    deck.addEventListener("pointermove", function (e) { if (!down) return; var now = performance.now(); vel = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now; set(x + (e.clientX - startX)); startX = e.clientX; });
    function up() { if (!down) return; down = false; deck.classList.remove("dragging"); snap(x + vel * 260); }
    deck.addEventListener("pointerup", up); deck.addEventListener("pointercancel", up);
    deck.addEventListener("click", function (e) { if (Math.abs(vel) > 0.3) e.preventDefault(); }, true);
    deck.parentNode.querySelector("[data-prev]")?.addEventListener("click", function () { snap(x + step()); });
    deck.parentNode.querySelector("[data-next]")?.addEventListener("click", function () { snap(x - step()); });
    addEventListener("resize", function () { set(x); });
    set(0);
  });

  /* holographic sheen + tilt on cards and demo plots (pointer devices) */
  if (matchMedia("(hover:hover) and (pointer:fine)").matches && !reduce) document.querySelectorAll(".card, .plot").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", (x * 100).toFixed(1) + "%"); card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
      card.style.setProperty("--a", Math.round(x * 360) + "deg");
      card.style.setProperty("--rx", ((0.5 - y) * 7).toFixed(2) + "deg"); card.style.setProperty("--ry", ((x - 0.5) * 9).toFixed(2) + "deg");
    });
    card.addEventListener("pointerleave", function () { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); });
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

  /* ── "minder animatie": remembered per browser, reloads in lite mode ── */
  document.querySelectorAll("[data-lite-toggle]").forEach(function (b) {
    var on = false; try { on = localStorage.getItem("sts-lite") === "1"; } catch (e) { /* storage blocked */ }
    b.textContent = on ? "Meer animatie" : "Minder animatie";
    b.addEventListener("click", function () { try { on ? localStorage.removeItem("sts-lite") : localStorage.setItem("sts-lite", "1"); } catch (e) { /* storage blocked */ } location.reload(); });
  });

  /* ── cursor follower + comet tail (desktop only) ───────────── */
  if (matchMedia("(hover:hover) and (pointer:fine)").matches && !reduce) {
    var dot = document.createElement("i"), ring = document.createElement("i");
    dot.className = "cur-dot"; ring.className = "cur-ring"; body.append(dot, ring);
    var dx = gsap.quickTo(dot, "x", { duration: 0.05 }), dy = gsap.quickTo(dot, "y", { duration: 0.05 });
    var rx = gsap.quickTo(ring, "x", { duration: 0.22, ease: "power3" }), ry = gsap.quickTo(ring, "y", { duration: 0.22, ease: "power3" });
    // the tail: the last ~20 pointer positions, drawn as a tapered cyan stroke that fades within 0.45 s
    var trail = document.createElement("canvas"), tctx = trail.getContext("2d"), pts = [];
    trail.className = "cur-trail"; body.appendChild(trail);
    function sizeTrail() { trail.width = innerWidth; trail.height = innerHeight; } sizeTrail(); addEventListener("resize", sizeTrail);
    addEventListener("pointermove", function (e) { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); pts.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (pts.length > 22) pts.shift(); }, { passive: true });
    gsap.ticker.add(function () {
      var now = performance.now(); while (pts.length && now - pts[0].t > 450) pts.shift();
      tctx.clearRect(0, 0, trail.width, trail.height);
      if (pts.length < 3) return;
      tctx.lineCap = "round"; tctx.lineJoin = "round";
      for (var i = 1; i < pts.length; i++) {
        var k = i / pts.length, age = 1 - (now - pts[i].t) / 450;
        tctx.beginPath(); tctx.moveTo(pts[i - 1].x, pts[i - 1].y); tctx.lineTo(pts[i].x, pts[i].y);
        tctx.strokeStyle = "rgba(54,232,255," + (0.5 * k * age).toFixed(3) + ")"; tctx.lineWidth = 1 + 5 * k * age; tctx.stroke();
      }
    });
    document.querySelectorAll("a, button, .card, .tag, .acc-head, .plot").forEach(function (el) {
      el.addEventListener("pointerenter", function () { ring.classList.add("big"); });
      el.addEventListener("pointerleave", function () { ring.classList.remove("big"); });
    });
  }

  addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
