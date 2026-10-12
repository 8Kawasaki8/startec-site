/* Garage Verhulst (fictief): afspraak-aanvraag (werkdagen, uren, gegevens, overzicht) and the keuring-checklist. Demo only: nothing is sent. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const GV = window.GV || {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- afspraak-aanvraag ---------- */
  const form = $('#book-form');
  if (form) {
    const DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
    const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const SLOTS = ['07:30', '08:30', '09:30', '10:30', '13:00', '14:00', '15:00', '16:00'];
    const days = [];
    { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + 1);
      while (days.length < 10) { const wd = d.getDay(); if (wd !== 0 && wd !== 6) days.push(new Date(d)); d.setDate(d.getDate() + 1); } }
    const seed = d => d.getDate() * 31 + d.getMonth() * 7 + d.getDay();                 // deterministic, fictional
    const noise = (d, i) => { const x = Math.sin(seed(d) * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };
    const taken = (d, i) => i !== seed(d) % 8 && noise(d, i) < .3;                    // varies per day, never all busy
    const free = d => SLOTS.filter((s, i) => !taken(d, i)).length;
    const longDate = (d, year) => d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: year ? 'numeric' : undefined });
    const sel = { day: -1, slot: '' };
    const daysEl = $('#days'), slotsEl = $('#slots'), hint = $('#slots-hint');

    daysEl.innerHTML = days.map((d, i) =>
      `<button type="button" class="day" role="radio" aria-checked="false" data-i="${i}" aria-label="${longDate(d)}, ${free(d)} uren vrij">` +
      `<span>${DAYS[d.getDay()]}</span><b>${d.getDate()}</b><span>${MONTHS[d.getMonth()]}</span><small>${free(d)} vrij</small></button>`).join('');

    function renderSlots() {
      if (sel.day < 0) { slotsEl.innerHTML = ''; hint.textContent = 'Kies eerst een dag.'; return; }
      const d = days[sel.day];
      hint.textContent = longDate(d) + ' - binnenbrengen om:';
      slotsEl.innerHTML = SLOTS.map((s, i) => {
        const busy = taken(d, i);
        return `<button type="button" class="slot" role="radio" aria-checked="${s === sel.slot}" data-s="${s}"${busy ? ' disabled aria-disabled="true" title="Bezet"' : ''}>${s}</button>`;
      }).join('');
    }
    daysEl.addEventListener('click', e => {
      const b = e.target.closest('.day'); if (!b) return;
      sel.day = Number(b.dataset.i); sel.slot = '';
      $$('.day', daysEl).forEach(x => x.setAttribute('aria-checked', String(x === b)));
      renderSlots();
    });
    slotsEl.addEventListener('click', e => {
      const b = e.target.closest('.slot'); if (!b || b.disabled) return;
      sel.slot = b.dataset.s;
      $$('.slot', slotsEl).forEach(x => x.setAttribute('aria-checked', String(x === b)));
    });

    /* services (same list as the calculator) */
    const chips = $('#book-svcs'), bookHint = $('#book-hint'), PRICES = GV.PRICES || {};
    const HINT_DEFAULT = bookHint.textContent;
    chips.innerHTML = Object.keys(PRICES).map(k => `<label class="chip"><input type="checkbox" name="bsvc" value="${k}">${esc(PRICES[k].name)}</label>`).join('');
    const syncChips = () => $$('.chip', chips).forEach(c => c.classList.toggle('is-on', c.querySelector('input').checked));
    chips.addEventListener('change', syncChips);
    let cls = 0;
    document.addEventListener('gv:prefill', e => {
      const { keys, cls: c } = e.detail; cls = c;
      $$('input', chips).forEach(i => { i.checked = keys.includes(i.value); });
      syncChips();
      bookHint.textContent = keys.length ? 'Overgenomen uit de richtprijs-calculator. Pas gerust aan.' : HINT_DEFAULT;
    });

    /* validation at the boundary */
    const err = $('#book-err');
    const f = { name: $('#f-name'), phone: $('#f-phone'), plate: $('#f-plate'), car: $('#f-car'), note: $('#f-note') };
    function validate() {
      const name = f.name.value.trim(), phone = f.phone.value.trim(), plate = f.plate.value.trim().toUpperCase().replace(/\s/g, '');
      if (sel.day < 0) return ['Kies eerst een dag.', $('.day', daysEl)];
      if (!sel.slot) return ['Kies een uur om binnen te brengen.', $('.slot:not([disabled])', slotsEl)];
      if (name.length < 2) return ['Vul uw naam in.', f.name];
      if (!/^\+?[\d\s./-]{8,20}$/.test(phone) || phone.replace(/\D/g, '').length < 8) return ['Vul een telefoonnummer in, bv. +32 470 00 00 00.', f.phone];
      if (plate && !/^[0-9A-Z]{1,3}-?[0-9A-Z]{2,4}-?[0-9A-Z]{2,4}$/.test(plate)) return ['Het kenteken ziet er niet juist uit, bv. 1-ABC-000.', f.plate];
      return null;
    }

    /* summary: ends in a panel, nothing is sent */
    const summary = $('#book-summary'), sumList = $('#sum-list');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = validate();
      if (v) { err.textContent = v[0]; if (v[1]) v[1].focus(); return; }
      err.textContent = '';
      const d = days[sel.day];
      const keys = $$('input:checked', chips).map(i => i.value);
      const q = GV.quote ? GV.quote(keys, cls) : null;
      const wagen = [f.car.value.trim(), f.plate.value.trim().toUpperCase()].filter(Boolean).join(' - ');
      const rows = [
        ['Dag', longDate(d, true)],
        ['Uur', sel.slot + ' binnenbrengen'],
        ['Naam', f.name.value.trim()],
        ['Telefoon', f.phone.value.trim()],
        ['Wagen', wagen || 'nog niet ingevuld'],
        ['Werk', keys.length ? keys.map(k => PRICES[k].name).join(', ') : 'te bespreken bij ontvangst'],
        ['Richtprijs', q && q.lines.length ? `€ ${q.lo} – ${q.hi} (${GV.CLASSES[cls].toLowerCase()}), ongeveer ${GV.fmtMins(q.mins)}` : 'na diagnose'],
      ];
      if (f.note.value.trim()) rows.push(['Opmerking', f.note.value.trim()]);
      sumList.innerHTML = rows.map(([k, val]) => `<dt>${k}</dt><dd>${esc(val)}</dd>`).join('');
      form.hidden = true; summary.hidden = false;
      summary.focus({ preventScroll: true });
      if (GV.scrollTo) GV.scrollTo(summary); else summary.scrollIntoView();
    });
    $('#book-reset').addEventListener('click', () => {
      form.reset(); sel.day = -1; sel.slot = ''; cls = 0;
      $$('.day', daysEl).forEach(x => x.setAttribute('aria-checked', 'false'));
      renderSlots(); syncChips(); bookHint.textContent = HINT_DEFAULT;
      summary.hidden = true; form.hidden = false;
      if (GV.scrollTo) GV.scrollTo('#afspraak');
    });
    renderSlots();
  }

  /* ---------- keuring-checklist ---------- */
  const list = $('#check-list');
  if (list) {
    const bar = $('#check-bar'), n = $('#check-n'), msg = $('#check-msg'), prog = $('.bar');
    const MSGS = [
      'Begin bovenaan. Elk punt is iets wat de keurder ook bekijkt.',
      'Goed begonnen. Neem per punt even de tijd.',
      'Meer dan de helft is nagekeken. Zo wordt de keuring een formaliteit.',
      'Bijna klaar. Nog even de laatste punten.',
      'Alles nagekeken. Klaar voor de keuring. Twijfel? Vraag een voorcontrole aan.',
    ];
    function update() {
      const boxes = $$('input', list), c = boxes.filter(b => b.checked).length;
      $$('.ck', list).forEach(l => l.classList.toggle('is-on', l.querySelector('input').checked));
      bar.style.transform = `scaleX(${c / boxes.length})`;
      n.textContent = c;
      prog.setAttribute('aria-valuenow', c);
      msg.textContent = c === 0 ? MSGS[0] : c < 4 ? MSGS[1] : c < 7 ? MSGS[2] : c < 8 ? MSGS[3] : MSGS[4];
    }
    list.addEventListener('change', update);
    update();
  }
})();
