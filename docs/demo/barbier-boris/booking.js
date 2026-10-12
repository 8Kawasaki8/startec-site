/* Barbier Boris (fictief): boekingsflow in 4 stappen. Eindigt in een aanvraag-samenvatting; er wordt niets verzonden. */
(function () {
  'use strict';
  var BB = window.BB;
  if (!BB) return;
  var now = new Date();
  var state = { step: 1, barber: null, service: null, date: null, time: null, name: '', phone: '' };
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var section = $('#boeken'), backBtn = $('#back'), chosen = $('#chosen'), foot = $('.booking-foot');
  var daysEl = $('#days'), slotsEl = $('#slots'), slotsNote = $('#slots-note');
  var form = $('#bform'), nameIn = $('#f-name'), phoneIn = $('#f-phone');
  if (!section || !form) return;

  function serviceText(id) {
    var s = BB.SERVICES[id];
    return s.name + ' (' + s.min + ' min, € ' + s.price + ')';
  }
  function momentText() {
    return BB.cap(BB.fmtDay(state.date, now)) + ' om ' + BB.fmtTime(state.time);
  }

  function renderChosen() {
    var parts = [];
    if (state.barber) parts.push('<b>' + BB.BARBERS[state.barber] + '</b>');
    if (state.service) parts.push(serviceText(state.service));
    if (state.date && state.time !== null) parts.push(momentText());
    chosen.innerHTML = parts.length && state.step < 5 ? 'Gekozen: ' + parts.join(' &middot; ') : '';
    foot.hidden = backBtn.hidden && !chosen.textContent;
  }

  function keepInView() {
    var r = section.getBoundingClientRect();
    if (r.top < 60) window.scrollTo({ top: window.scrollY + r.top - 20, behavior: BB.reduced ? 'auto' : 'smooth' });
  }

  function show(step, focus) {
    state.step = step;
    $$('.bstep').forEach(function (el) { el.hidden = Number(el.dataset.step) !== step; });
    $$('.step').forEach(function (li) {
      var n = Number(li.dataset.step), btn = li.querySelector('.step-btn');
      li.classList.toggle('is-current', n === step);
      li.classList.toggle('is-done', n < step);
      btn.disabled = n > step;
      if (n === step) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
    });
    backBtn.hidden = step === 1 || step === 5;
    if (step === 3) renderDays();
    renderChosen();
    if (focus) {
      var t = $('.bstep[data-step="' + step + '"] .bstep-title');
      if (t) t.focus({ preventScroll: true });
      keepInView();
    }
  }

  /* Stap 1: barbier */
  $$('.bcard').forEach(function (card) {
    card.addEventListener('click', function () {
      state.barber = card.dataset.barber;
      state.date = null; state.time = null;
      $$('.bcard').forEach(function (c) { c.classList.toggle('is-selected', c === card); });
      setTimeout(function () { show(state.service ? 3 : 2, true); }, 160);
    });
  });

  /* Stap 2: dienst (ook vanuit de prijspanelen) */
  function pickService(id, advance) {
    state.service = id;
    $$('.srow').forEach(function (r) { r.classList.toggle('is-selected', r.dataset.service === id); });
    if (advance) setTimeout(function () { show(3, true); }, 160);
    else renderChosen();
  }
  $$('.srow').forEach(function (row) {
    row.addEventListener('click', function () { pickService(row.dataset.service, true); });
  });
  $$('[data-pick-service]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      pickService(btn.dataset.pickService, false);
      if (state.step === 2) show(3, false);
      section.scrollIntoView({ behavior: BB.reduced ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* Stap 3: dag en uur */
  function renderDays() {
    daysEl.innerHTML = '';
    var firstOpen = null;
    for (var i = 0; i < 8; i++) {
      var date = BB.addDays(now, i);
      var slots = BB.slotsFor(state.barber, date, now);
      var open = slots.length > 0;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'day';
      b.disabled = !open;
      var label = i === 0 ? 'vandaag' : i === 1 ? 'morgen' : BB.DAYS_SHORT[date.getDay()];
      var sub = open ? date.getDate() + '/' + (date.getMonth() + 1) : (BB.HOURS[date.getDay()] ? 'voorbij' : 'dicht');
      b.innerHTML = '<span class="day-l">' + label + '</span><span class="day-d">' + sub + '</span>';
      b.setAttribute('aria-label', BB.cap(BB.fmtDay(date, now)) + (open ? '' : ', niet beschikbaar'));
      b.dataset.key = BB.dateKey(date);
      (function (d) { b.addEventListener('click', function () { selectDay(d); }); })(date);
      daysEl.appendChild(b);
      if (open && !firstOpen) firstOpen = date;
    }
    var keep = state.date && BB.slotsFor(state.barber, state.date, now).length ? state.date : firstOpen;
    if (keep) selectDay(keep); else { slotsNote.textContent = 'Geen vrije momenten deze week.'; slotsEl.innerHTML = ''; }
  }

  function selectDay(date) {
    state.date = date;
    state.time = null;
    var key = BB.dateKey(date);
    $$('.day').forEach(function (d) {
      var on = d.dataset.key === key;
      d.classList.toggle('is-selected', on);
      d.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    renderSlots();
    renderChosen();
  }

  function renderSlots() {
    var slots = BB.slotsFor(state.barber, state.date, now);
    var free = slots.filter(function (s) { return !s.taken; }).length;
    slotsNote.textContent = BB.BARBERS[state.barber] + ' ' + BB.fmtDay(state.date, now) + ': ' +
      (free ? free + ' van ' + slots.length + ' stoelen vrij.' : 'alles vol. Kies een andere dag.');
    slotsEl.innerHTML = '';
    slots.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.textContent = s.label;
      b.disabled = s.taken;
      b.setAttribute('aria-label', s.label + (s.taken ? ', vol' : ''));
      b.addEventListener('click', function () {
        state.time = s.m;
        show(4, false);
        nameIn.focus({ preventScroll: true });
        keepInView();
      });
      slotsEl.appendChild(b);
    });
  }

  /* Stap 4: gegevens en samenvatting */
  function setError(input, errId, bad) {
    input.closest('.field').classList.toggle('is-invalid', bad);
    input.setAttribute('aria-invalid', bad ? 'true' : 'false');
    $('#' + errId).hidden = !bad;
  }
  function validPhone(v) {
    var d = v.replace(/[\s.\-\/()]/g, '');
    return /^(\+32|0032)4\d{8}$/.test(d) || /^04\d{8}$/.test(d) || /^\+\d{9,13}$/.test(d);
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = nameIn.value.trim(), phone = phoneIn.value.trim();
    var badName = name.length < 2, badPhone = !validPhone(phone);
    setError(nameIn, 'e-name', badName);
    setError(phoneIn, 'e-phone', badPhone);
    if (badName) { nameIn.focus(); return; }
    if (badPhone) { phoneIn.focus(); return; }
    state.name = name; state.phone = phone;
    var rows = [
      ['Barbier', BB.BARBERS[state.barber]],
      ['Dienst', serviceText(state.service)],
      ['Moment', momentText()],
      ['Naam', name],
      ['Gsm', phone]
    ];
    var list = $('#sum-list');
    list.innerHTML = '';
    rows.forEach(function (r) {
      var dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = r[0]; dd.textContent = r[1];
      list.appendChild(dt); list.appendChild(dd);
    });
    show(5, true);
  });
  [nameIn, phoneIn].forEach(function (input) {
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true') setError(input, input === nameIn ? 'e-name' : 'e-phone', false);
    });
  });

  $('#reset').addEventListener('click', function () {
    state = { step: 1, barber: null, service: null, date: null, time: null, name: '', phone: '' };
    form.reset();
    $$('.bcard, .srow').forEach(function (el) { el.classList.remove('is-selected'); });
    setError(nameIn, 'e-name', false); setError(phoneIn, 'e-phone', false);
    show(1, true);
  });

  backBtn.addEventListener('click', function () { show(state.step - 1, true); });
  $$('.step-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var n = Number(btn.closest('.step').dataset.step);
      if (n < state.step) show(n, true);
    });
  });

  show(1, false);
})();
