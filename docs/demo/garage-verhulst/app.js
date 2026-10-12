/* Garage Verhulst (fictief): smooth scroll, scroll-triggered motion, hero drawing tilt and the richtprijs-calculator. Static demo: nothing is sent anywhere. */
(function () {
  'use strict';
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const pad2 = n => String(n).padStart(2, '0');
  const GV = (window.GV = window.GV || {});

  /* ---------- smooth scroll + anchors ---------- */
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  let lenis = null;
  if (!REDUCED && window.Lenis) {
    lenis = new Lenis({ lerp: 0.12 });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const topH = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 66;
  function scrollTo(target) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -topH() - 12, duration: 1.1 });
    else el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  }
  GV.scrollTo = scrollTo;
  GV.lenis = lenis;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = id.length > 1 ? $(id) : null;
    if (!el) return;
    e.preventDefault();
    scrollTo(el);
    history.replaceState(null, '', id);
  });

  /* ---------- scroll-triggered reveals (default state is visible; motion only when allowed) ---------- */
  if (hasGsap && !REDUCED) {
    const st = (el, start) => ({ trigger: el, start: start || 'top 88%', once: true });
    $$('.sec-rule').forEach(el => gsap.from(el, { scaleX: 0, duration: 1.3, ease: 'power3.inOut', scrollTrigger: st(el, 'top 92%') }));
    $$('.sec-head').forEach(el => {
      const parts = ['.sec-no', '.sec-titles', '.sec-lead'].map(s => $(s, el)).filter(Boolean);
      gsap.from(parts, { y: 18, opacity: 0, duration: .8, stagger: .12, ease: 'power3.out', scrollTrigger: st(el) });
    });
    $$('.reveal').forEach(el => gsap.from(el, { y: 26, opacity: 0, duration: .9, ease: 'power3.out', scrollTrigger: st(el) }));
    $$('.note').forEach(el => gsap.from(el, { opacity: 0, x: -10, duration: .7, delay: .5, ease: 'power2.out', scrollTrigger: st(el, 'top 94%') }));
  }

  /* ---------- hero drawing: 3D tilt follows the pointer (or scroll on touch) ---------- */
  const sheet = $('.sheet'), stage = $('.stage'), hero = $('.hero');
  if (sheet && stage && hero && !REDUCED) {
    let tx = -8, ty = 4, cx = tx, cy = ty, raf = 0;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const loop = () => {
      cx += (tx - cx) * .085; cy += (ty - cy) * .085;
      sheet.style.setProperty('--ry', cx.toFixed(2) + 'deg');
      sheet.style.setProperty('--rx', cy.toFixed(2) + 'deg');
      raf = (Math.abs(tx - cx) > .02 || Math.abs(ty - cy) > .02) ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      hero.addEventListener('pointermove', e => {
        const r = stage.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / r.width;
        const y = (e.clientY - (r.top + r.height / 2)) / r.height;
        tx = clamp(x, -1, 1) * 15; ty = clamp(-y, -1, 1) * 10; kick();
      });
      hero.addEventListener('pointerleave', () => { tx = -8; ty = 4; kick(); });
    } else {
      const onScroll = () => { const p = clamp(window.scrollY / (window.innerHeight * .9), 0, 1); tx = -8 + p * 16; ty = 4 - p * 8; kick(); };
      window.addEventListener('scroll', onScroll, { passive: true });
    }
  }

  /* ---------- richtprijs-calculator (fictional prices, EUR incl. btw, per car class: klein / middel / SUV-bestel) ---------- */
  const PRICES = {
    olie:    { name: 'Olie & filter',         lo: [95, 120, 150],  hi: [130, 165, 210], min: 45 },
    rem:     { name: 'Remblokken vooraan',    lo: [140, 170, 210], hi: [190, 230, 290], min: 60 },
    keuring: { name: 'Keuringsvoorbereiding', lo: [60, 70, 85],    hi: [90, 110, 130],  min: 45 },
    banden:  { name: 'Banden wisselen',       lo: [50, 60, 70],    hi: [70, 80, 100],   min: 40 },
    airco:   { name: 'Airco onderhoud',       lo: [90, 100, 120],  hi: [120, 140, 170], min: 60 },
    diag:    { name: 'Diagnose foutcodes',    lo: [45, 45, 55],    hi: [65, 65, 75],    min: 30 },
  };
  const CLASSES = ['Klein', 'Middel', 'SUV / bestel'];
  function quote(keys, cls) {
    let lo = 0, hi = 0, mins = 0; const lines = [];
    keys.forEach(k => {
      const p = PRICES[k]; if (!p) return;
      lo += p.lo[cls]; hi += p.hi[cls]; mins += p.min;
      lines.push({ key: k, name: p.name, lo: p.lo[cls], hi: p.hi[cls] });
    });
    if (lines.length > 1) mins -= 10 * (lines.length - 1);   // shared setup time when combining jobs
    return { lo, hi, mins, lines };
  }
  function fmtMins(m) {
    const h = Math.floor(m / 60), r = m % 60;
    return h ? `${h} u${r ? ' ' + r + ' min' : ''}` : `${r} min`;
  }
  Object.assign(GV, { PRICES, CLASSES, quote, fmtMins, pad2 });

  const tweens = new WeakMap();
  function countTo(el, to) {
    const from = Number(el.dataset.v || 0);
    el.dataset.v = to;
    if (REDUCED || !hasGsap) { el.textContent = to; return; }
    const o = { v: from }, old = tweens.get(el);
    if (old) old.kill();
    tweens.set(el, gsap.to(o, { v: to, duration: .75, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } }));
  }

  const form = $('#calc-form');
  if (form) {
    const outMin = $('#out-min'), outMax = $('#out-max'), outTime = $('#out-time'), outLines = $('#out-lines');
    const state = () => ({
      keys: $$('input[name="svc"]:checked', form).map(i => i.value),
      cls: Number(($('input[name="cls"]:checked', form) || { value: 0 }).value),
    });
    function render() {
      const { keys, cls } = state(), q = quote(keys, cls);
      $$('.svc, .cls', form).forEach(l => l.classList.toggle('is-on', l.querySelector('input').checked));
      countTo(outMin, q.lo); countTo(outMax, q.hi);
      outTime.textContent = q.lines.length ? `ongeveer ${fmtMins(q.mins)}` : 'nog niets gekozen';
      outLines.innerHTML = q.lines.length
        ? q.lines.map(l => `<li><span>${l.name}</span><span>&euro; ${l.lo} &ndash; ${l.hi}</span></li>`).join('')
        : '<li class="out-empty">Kies minstens een dienst om een vork te zien.</li>';
    }
    form.addEventListener('change', render);
    render();
    GV.calcState = state;
    const toBook = $('#calc-to-book');
    if (toBook) toBook.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('gv:prefill', { detail: state() }));
      scrollTo('#afspraak');
    });
  }
})();
