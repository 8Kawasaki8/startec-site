/* Garage Verhulst (fictief): split-flap display. Each character is a card with a static top and bottom half plus two folding halves; the fold is animated with the Web Animations API (transform only). Also drives the Werkplaatsbord rows and the example customer message. */
(function () {
  'use strict';
  const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-:.';
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FLIP_MS = 70;          // one half-card fold; a full flip is two folds
  const MAX_STEPS = 6;         // a far character is reached in at most six evenly spaced flips
  const pad2 = n => String(n).padStart(2, '0');

  function half(cls, ch) { const i = document.createElement('i'); i.className = cls; i.dataset.c = ch; return i; }

  /* the characters shown on the way from one character to another (the drum only turns forward) */
  function plan(from, to) {
    if (from === to) return [];
    const a = CHARS.indexOf(from), b = CHARS.indexOf(to);
    if (a < 0 || b < 0) return [to];
    const n = CHARS.length, d = (b - a + n) % n, steps = Math.min(d, MAX_STEPS), out = [];
    for (let k = 1; k <= steps; k++) out.push(CHARS[(a + Math.round(d * k / steps)) % n]);
    return out;
  }

  class FlapCell {
    constructor(ch) {
      this.el = document.createElement('span');
      this.el.className = 'flap';
      this.t = half('t', ch); this.b = half('b', ch); this.ft = half('ft', ch); this.fb = half('fb', ch);
      this.el.append(this.t, this.b, this.ft, this.fb);
      this.cur = ch; this.target = ch; this.inflight = null; this.queue = []; this.running = false;
    }
    set(ch) {
      if (ch === this.target) return;
      this.target = ch;
      this.queue = plan(this.inflight || this.cur, ch);
      if (!this.running) this.run();
    }
    async run() {
      this.running = true;
      try {
        while (this.queue.length) {
          if (REDUCED || document.hidden || !this.el.isConnected) { this.queue = []; this.jump(this.target); break; }
          await this.flipOnce(this.queue.shift());
        }
      } finally { this.running = false; }
    }
    jump(ch) { this.cur = ch; this.inflight = null; this.t.dataset.c = ch; this.b.dataset.c = ch; }
    async flipOnce(ch) {
      const { t, b, ft, fb } = this;
      this.inflight = ch;
      t.dataset.c = ch; ft.dataset.c = this.cur; fb.dataset.c = ch;
      ft.style.visibility = 'visible'; fb.style.visibility = 'visible';
      const a1 = ft.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], { duration: FLIP_MS, easing: 'ease-in', fill: 'forwards' });
      const a2 = fb.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], { duration: FLIP_MS, delay: FLIP_MS, easing: 'ease-out', fill: 'both' });
      await a2.finished.catch(() => {});
      b.dataset.c = ch; this.cur = ch; this.inflight = null;
      ft.style.visibility = 'hidden'; fb.style.visibility = 'hidden';
      a1.cancel(); a2.cancel();
    }
  }

  class FlapGroup {
    constructor(n, label) {
      this.n = n;
      this.el = document.createElement('div');
      this.el.className = 'grp';
      this.el.dataset.l = label;
      const cells = document.createElement('span');
      cells.className = 'cells';
      this.cells = [];
      for (let i = 0; i < n; i++) { const c = new FlapCell(' '); this.cells.push(c); cells.appendChild(c.el); }
      this.el.appendChild(cells);
    }
    set(text) {
      const s = String(text).toUpperCase().padEnd(this.n).slice(0, this.n);
      this.cells.forEach((c, i) => {
        const ch = CHARS.includes(s[i]) ? s[i] : ' ';
        if (ch !== c.target) setTimeout(() => c.set(ch), i * 16);
      });
    }
  }

  /* ---------- Werkplaatsbord ---------- */
  const STATUS = ['ONTVANGEN', 'DIAGNOSE', 'IN ONDERHOUD', 'TESTRIT', 'KLAAR'];
  const REMAIN = [180, 150, 90, 20, 0];
  const POOL = [
    { plate: '1-ABC-000', car: 'VW GOLF 7', nice: 'Golf', name: 'Els' },
    { plate: '1-DEF-000', car: 'PEUGEOT 308', nice: '308', name: 'Tom' },
    { plate: '2-GHJ-000', car: 'TOYOTA YARIS', nice: 'Yaris', name: 'Mia' },
    { plate: '1-KLM-000', car: 'FORD TRANSIT', nice: 'Transit', name: 'Bart' },
    { plate: '2-NPR-000', car: 'SKODA FABIA', nice: 'Fabia', name: 'Nour' },
    { plate: '1-STV-000', car: 'RENAULT CLIO', nice: 'Clio', name: 'Jan' },
    { plate: '2-WXY-000', car: 'BMW 118I', nice: '118i', name: 'Lotte' },
    { plate: '1-ZAB-000', car: 'OPEL CORSA', nice: 'Corsa', name: 'Karim' },
    { plate: '2-CDE-000', car: 'HYUNDAI I20', nice: 'i20', name: 'Sofie' },
    { plate: '1-FGH-000', car: 'DACIA DUSTER', nice: 'Duster', name: 'Pieter' },
  ];
  const MSG = [
    (n, c) => `Dag ${n}, uw ${c} staat binnen bij Garage Verhulst. We houden u op de hoogte.`,
    (n, c) => `Dag ${n}, we zijn gestart met de diagnose van uw ${c}. Is er iets extra nodig, dan bellen we eerst.`,
    (n, c, eta) => `Dag ${n}, uw ${c} is in onderhoud. Verwacht klaar rond ${eta}.`,
    (n, c) => `Dag ${n}, uw ${c} maakt nog een korte testrit. Nog een kwartiertje.`,
    (n, c) => `Dag ${n}, uw ${c} is klaar. U kunt hem ophalen tot 18:00. Tot straks.`,
  ];
  function etaFor(idx) {
    if (idx === 4) return 'NU';
    const d = new Date(Date.now() + REMAIN[idx] * 60000);
    d.setMinutes(Math.round(d.getMinutes() / 5) * 5);
    const h = d.getHours() + d.getMinutes() / 60;
    if (h >= 18 || h < 7.5 || d.getDate() !== new Date().getDate()) return 'MORGEN';   // outside opening hours
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function initBoard() {
    const host = document.getElementById('board-rows');
    if (!host) return;
    const board = host.closest('.board');
    const rows = [];
    const startStatus = [0, 2, 4, 1, 3, 2];
    let poolIdx = 6;
    for (let i = 0; i < 6; i++) {
      const el = document.createElement('div');
      el.className = 'brow'; el.setAttribute('role', 'listitem');
      const g = [new FlapGroup(9, 'Kenteken'), new FlapGroup(12, 'Wagen'), new FlapGroup(12, 'Status'), new FlapGroup(6, 'Klaar om')];
      g.forEach(x => { x.el.setAttribute('aria-hidden', 'true'); el.appendChild(x.el); });
      host.appendChild(el);
      rows.push({ el, g, car: POOL[i], s: startStatus[i], eta: '' });
    }
    function paint(r, full) {
      r.eta = etaFor(r.s);
      if (full) { r.g[0].set(r.car.plate); r.g[1].set(r.car.car); }
      r.g[2].set(STATUS[r.s]); r.g[3].set(r.eta);
      r.g[2].el.className = 'grp s-' + r.s;
      r.el.setAttribute('aria-label', `${r.car.plate}, ${r.car.car}, ${STATUS[r.s].toLowerCase()}, klaar om ${r.eta}`);
    }
    const bubble = document.getElementById('wa-bubble'), waText = document.getElementById('wa-text'), waTime = document.getElementById('wa-time');
    function notify(r) {
      if (!bubble) return;
      const txt = MSG[r.s](r.car.name, r.car.nice, r.eta), now = new Date();
      bubble.classList.add('is-swap');
      setTimeout(() => {
        waText.textContent = txt;
        waTime.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
        bubble.classList.remove('is-swap');
      }, 80);
    }
    let timer = 0, started = false, visible = false, last = -1;
    function tick() {
      timer = 0;
      let i; do { i = Math.floor(Math.random() * rows.length); } while (i === last);
      last = i;
      const r = rows[i];
      r.s++;
      if (r.s > 4) { r.s = 0; r.car = POOL[poolIdx % POOL.length]; poolIdx++; paint(r, true); }
      else paint(r, false);
      notify(r);
      timer = setTimeout(tick, 2600 + Math.random() * 1600);
    }
    function stop() { clearTimeout(timer); timer = 0; }
    function resume() { if (!timer && started && visible && !document.hidden) timer = setTimeout(tick, 2200); }
    function start() {
      if (started) return;
      started = true;
      rows.forEach((r, i) => setTimeout(() => paint(r, true), i * 140));
      if (waTime) { const n = new Date(); waTime.textContent = pad2(n.getHours()) + ':' + pad2(n.getMinutes()); }
      timer = setTimeout(tick, 4200);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; if (visible) { start(); resume(); } else stop(); }), { threshold: .12 }).observe(board);
    } else { visible = true; start(); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else resume(); });

    const clock = document.getElementById('board-clock');
    if (clock) {
      const tickClock = () => { const d = new Date(); clock.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
      tickClock(); setInterval(tickClock, 1000);
    }
  }

  window.GVFlap = { FlapCell, FlapGroup };
  initBoard();
})();
