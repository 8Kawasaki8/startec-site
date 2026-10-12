/* Barbier Boris (fictief): gedeelde data, beschikbaarheid in de hero, motion. Geen externe requests. */
(function () {
  'use strict';
  var BB = window.BB = {};
  BB.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  BB.BARBERS = { boris: 'Boris', lena: 'Lena', yusuf: 'Yusuf' };
  BB.SERVICES = {
    knippen: { name: 'Knippen', min: 30, price: 28 },
    baard: { name: 'Baard', min: 20, price: 18 },
    combo: { name: 'Knippen + baard', min: 50, price: 42 },
    kids: { name: 'Kids', min: 25, price: 20 },
    scheren: { name: 'Scheren met warme handdoek', min: 30, price: 30 }
  };
  /* Fictieve openingsuren per weekdag (0 = zondag), in minuten sinds middernacht */
  BB.HOURS = { 0: null, 1: [720, 1140], 2: [540, 1140], 3: [540, 1140], 4: [540, 1140], 5: [540, 1140], 6: [510, 1020] };
  BB.DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  BB.DAYS_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  BB.MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

  BB.pad = function (n) { return String(n).padStart(2, '0'); };
  BB.fmtTime = function (m) { return BB.pad(Math.floor(m / 60)) + ':' + BB.pad(m % 60); };
  BB.dateKey = function (d) { return d.getFullYear() + '-' + BB.pad(d.getMonth() + 1) + '-' + BB.pad(d.getDate()); };
  BB.addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); x.setHours(0, 0, 0, 0); return x; };
  BB.cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  /* Deterministische "drukte": de demo ziet er levend uit, maar is identiek na een refresh */
  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h;
  }
  BB.isTaken = function (barber, date, minutes) {
    return hash(barber + BB.dateKey(date) + ':' + minutes) % 100 < 34;
  };

  /* Slots per dag (om het halfuur); voorbije slots van vandaag vallen weg */
  BB.slotsFor = function (barber, date, now) {
    var h = BB.HOURS[date.getDay()];
    if (!h) return [];
    var isToday = BB.dateKey(date) === BB.dateKey(now);
    var cutoff = isToday ? now.getHours() * 60 + now.getMinutes() + 20 : -1;
    var out = [];
    for (var m = h[0]; m <= h[1] - 30; m += 30) {
      if (m < cutoff) continue;
      out.push({ m: m, label: BB.fmtTime(m), taken: BB.isTaken(barber, date, m) });
    }
    return out;
  };

  BB.fmtDay = function (date, now) {
    var diff = Math.round((BB.addDays(date, 0) - BB.addDays(now, 0)) / 864e5);
    if (diff === 0) return 'vandaag';
    if (diff === 1) return 'morgen';
    return BB.DAYS[date.getDay()] + ' ' + date.getDate() + ' ' + BB.MONTHS[date.getMonth()];
  };

  /* Eerste vrije stoel bij om het even welke barbier, voor de hero */
  BB.firstFree = function (now) {
    for (var i = 0; i < 8; i++) {
      var date = BB.addDays(now, i);
      var best = null;
      Object.keys(BB.BARBERS).forEach(function (b) {
        var s = BB.slotsFor(b, date, now).filter(function (x) { return !x.taken; })[0];
        if (s && (!best || s.m < best.m)) best = s;
      });
      if (best) return { offset: i, date: date, slot: best };
    }
    return null;
  };

  function availabilityLine() {
    var now = new Date();
    var f = BB.firstFree(now);
    var el = document.getElementById('avail-text');
    if (!el) return;
    if (!f) { el.textContent = 'Deze week is alles vol. Bel ons even.'; return; }
    if (f.offset === 0) el.textContent = 'Vandaag nog vrij om ' + f.slot.label;
    else if (f.offset === 1) el.textContent = 'Morgen vrij om ' + f.slot.label;
    else el.textContent = BB.cap(BB.DAYS[f.date.getDay()]) + ' vrij om ' + f.slot.label;
  }

  function markToday() {
    var row = document.querySelector('#hours-table tr[data-day="' + new Date().getDay() + '"]');
    if (row) row.classList.add('is-today');
  }

  /* Motion: alleen transform/opacity, stepped eases (comic frames), elastic stickers */
  function motion() {
    if (BB.reduced || !window.gsap) return;
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    var tl = gsap.timeline({ defaults: { overwrite: 'auto' } });
    tl.from('.hero .pop', { scale: 0.9, opacity: 0, duration: 0.45, ease: 'steps(4)', stagger: 0.15 })
      .from('.hero-art .sticker', { scale: 0, rotation: '-=30', duration: 0.75, ease: 'elastic.out(1, 0.45)', stagger: 0.12 }, '-=0.1');
    if (!window.ScrollTrigger) return;
    gsap.utils.toArray('section:not(.hero) .pop').forEach(function (el) {
      gsap.from(el, {
        scale: 0.92, opacity: 0, rotation: -1.5, duration: 0.4, ease: 'steps(3)',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });
    gsap.utils.toArray('.tcard-sticker, .bub-sticker, .svc-sticker, .sec-sticker, .ba-label').forEach(function (el) {
      gsap.from(el, {
        scale: 0, rotation: '+=25', duration: 0.7, ease: 'elastic.out(1, 0.45)',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true }
      });
    });
  }

  availabilityLine();
  markToday();
  motion();
})();
