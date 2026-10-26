// WP-19: the in-page half of the accessibility checker. Every export is a page.evaluate body
// (self-contained, no imports used inside), called by a11y.mjs. Returns plain data; the
// classification (fail for contrast and missing names, notice for the rest) happens in a11y.mjs.

/** The static audit: contrast of every visible text node, accessible names, heading order, landmarks,
 *  forms, live regions, the sign, simulations and language. cfg: { phone } */
export function domAudit(cfg) {
  const out = { contrast: [], names: [], headings: [], headingIssues: [], landmarks: [], forms: [], live: [], lang: [], sim: [], textNodes: 0, pairs: 0 };
  const path = (el) => { const p = []; for (let n = el, d = 0; n && n !== document.body && d < 4; n = n.parentElement, d++) p.unshift(`${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/)[0] : ''}`); return p.join(' > '); };
  const cs = (el) => getComputedStyle(el);
  const inHidden = (el) => !!el.closest('[hidden], template, script, style, noscript');
  const closedDetails = (el) => { const d = el.closest('details:not([open])'); return !!d && !(el.closest('summary') && el.closest('summary').parentElement === d); };
  const displayed = (el) => { if (inHidden(el) || closedDetails(el)) return false; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const s = cs(n); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
  const srOnly = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const s = cs(n); if (s.position === 'absolute' && (s.clip !== 'auto' || (parseFloat(s.width) <= 1 && s.overflow === 'hidden'))) return true; } return false; };
  const opacityOf = (el) => { let o = 1; for (let n = el; n && n !== document.documentElement; n = n.parentElement) o *= parseFloat(cs(n).opacity) || 0; return o; };

  /* ── colour helpers ── */
  const rgba = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[\s,\/]+/).map(parseFloat); return [p[0], p[1], p[2], p.length > 3 && !isNaN(p[3]) ? p[3] : 1]; };
  const over = (fg, bg) => { const a = fg[3]; return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const hex = (c) => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const rootBg = rgba(cs(document.documentElement).backgroundColor);
  const base = rootBg && rootBg[3] > 0 ? over(rootBg, [255, 255, 255, 1]) : [255, 255, 255, 1];
  /* the surface behind an element: its ancestors' background colours composited top-down over the page background;
   *  a background-image (gradient) on the way marks the pair as not measurable */
  function surface(el) {
    const layers = []; let image = false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = cs(n); const c = rgba(s.backgroundColor);
      if (s.backgroundImage && s.backgroundImage !== 'none') image = true;
      if (c && c[3] > 0) layers.unshift(c);
    }
    let bg = base; for (const l of layers) bg = over(l, bg);
    return { bg, image };
  }
  /* is another element painted over this text? (the point is brought into the viewport first) */
  function covered(el, r) {
    const y0 = window.scrollY; el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const b = el.getBoundingClientRect(), top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, b.left + b.width / 2)), Math.min(innerHeight - 1, Math.max(0, b.top + b.height / 2)));
    window.scrollTo(0, y0);
    return !!top && top !== el && !el.contains(top) && !top.contains(el);
  }
  const pairs = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue; if (!text || !text.trim() || !/[\p{L}\p{N}]/u.test(text)) continue;   // symbols only (stars, dots) are decoration
    const el = node.parentElement; if (!el || !displayed(el) || srOnly(el)) continue;
    if (el.closest('#sign-dom, #scene-debug, option, [data-voice="qa"]')) continue;   // the sign sits on the city (unmeasurable), options render natively
    if (el.closest('svg[role="img"], svg[aria-hidden="true"], [role="img"]')) continue; // text inside a picture is image content (1.4.3: incidental)
    if (el.closest(':disabled, [aria-disabled="true"]')) continue;                   // inactive controls are exempt (1.4.3)
    const r = (() => { const rg = document.createRange(); rg.selectNodeContents(node); return rg.getBoundingClientRect(); })();
    if (r.width === 0 || r.height === 0) continue;
    out.textNodes++;
    const s = cs(el), svgText = !!el.closest('svg');
    let fg = rgba(svgText ? s.fill : s.color); if (!fg) continue;
    const op = opacityOf(el); if (op < 0.05) continue;   // invisible (reveal before intersection): nothing to read yet
    if (op < 0.5 && covered(el, r)) continue;              // dimmed under an overlay (the idle chart behind 'Standby'): not the visible text
    fg = [fg[0], fg[1], fg[2], fg[3] * op];
    const { bg, image } = surface(el);
    const c = over(fg, bg), q = ratio(c, bg);
    const size = parseFloat(s.fontSize), weight = parseInt(s.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const key = `${hex(c)}|${hex(bg)}|${large ? 'L' : 'S'}`;
    const e = pairs.get(key) || { fg: hex(c), bg: hex(bg), ratio: Math.round(q * 100) / 100, need, large, count: 0, where: path(el), text: text.trim().slice(0, 40), size: Math.round(size * 10) / 10, weight, image };
    e.count++; if (image) e.image = true;
    pairs.set(key, e);
  }
  out.pairs = pairs.size;
  for (const e of pairs.values()) if (e.ratio < e.need) out.contrast.push(e);

  /* ── accessible names ── */
  const txt = (el) => { if (!el) return ''; const c = el.cloneNode(true); c.querySelectorAll('img[alt]').forEach(i => i.replaceWith(i.getAttribute('alt') || '')); c.querySelectorAll('svg title').forEach(t => t.replaceWith(t.textContent)); return (c.textContent || '').replace(/\s+/g, ' ').trim(); };
  const byIds = (ids) => (ids || '').split(/\s+/).filter(Boolean).map(id => txt(document.getElementById(id))).join(' ').trim();
  function accName(el) {
    const lb = el.getAttribute('aria-labelledby'); if (lb && byIds(lb)) return { name: byIds(lb), how: 'aria-labelledby' };
    const al = el.getAttribute('aria-label'); if (al && al.trim()) return { name: al.trim(), how: 'aria-label' };
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l && txt(l)) return { name: txt(l), how: 'label[for]' }; }
      const wrap = el.closest('label'); if (wrap && txt(wrap)) return { name: txt(wrap), how: 'label' };
      if (/^(submit|button|reset)$/.test(el.type) && el.value) return { name: el.value, how: 'value' };
      if (el.getAttribute('title')) return { name: el.getAttribute('title'), how: 'title' };
      if (el.getAttribute('placeholder')) return { name: el.getAttribute('placeholder'), how: 'placeholder' };
      return { name: '', how: '' };
    }
    if (tag === 'img') return { name: el.getAttribute('alt') || '', how: 'alt' };
    if (tag === 'svg') { const t = el.querySelector('title'); return { name: t ? t.textContent.trim() : '', how: 'title' }; }
    if (tag === 'fieldset') { const l = el.querySelector('legend'); return { name: txt(l), how: 'legend' }; }
    const t = txt(el); if (t) return { name: t, how: 'content' };
    if (el.getAttribute('title')) return { name: el.getAttribute('title'), how: 'title' };
    return { name: '', how: '' };
  }
  const nameSel = 'a[href], button, [role="button"], [role="link"], input:not([type="hidden"]), select, textarea, summary, [role="switch"], [role="tab"], [role="checkbox"], [role="radio"], [role="slider"], img, svg[role="img"], canvas[role="img"], [role="img"], fieldset, [role="group"], [role="region"], [role="dialog"], nav, aside, iframe';
  for (const el of document.querySelectorAll(nameSel)) {
    const tag = el.tagName.toLowerCase();
    const shown = displayed(el);
    const hiddenAt = el.closest('[aria-hidden="true"]');
    if (!shown && !(tag === 'img' && el.hasAttribute('alt'))) continue;
    if (hiddenAt) {   // focusable content inside aria-hidden reaches the keyboard but not the reader
      const focusable = /^(a|button|input|select|textarea|summary)$/.test(tag) && !el.disabled && el.tabIndex >= 0;
      if (focusable) out.names.push({ severity: 'notice', what: 'focusable in aria-hidden', where: path(el) });
      continue;
    }
    const { name, how } = accName(el);
    const soft = tag === 'fieldset' || tag === 'aside' || el.getAttribute('role') === 'group' || el.getAttribute('role') === 'region' || tag === 'nav';
    if (!name) out.names.push({ severity: soft ? 'notice' : 'fail', what: soft ? `${tag}${el.getAttribute('role') ? '[role=' + el.getAttribute('role') + ']' : ''} zonder naam` : `${tag} zonder toegankelijke naam`, where: path(el) });
    else if (how === 'placeholder') out.names.push({ severity: 'notice', what: 'naam enkel uit placeholder', where: path(el), name });
  }

  /* ── headings ── */
  let prev = 0, h1 = 0;
  for (const h of document.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (!displayed(h)) continue;
    const level = +h.tagName[1], text = txt(h);
    out.headings.push({ level, text: text.slice(0, 60) });
    if (level === 1) h1++;
    if (!text) out.headingIssues.push(`lege ${h.tagName.toLowerCase()} (${path(h)})`);
    if (prev && level > prev + 1) out.headingIssues.push(`niveau springt van h${prev} naar h${level}: '${text.slice(0, 50)}'`);
    prev = level;
  }
  if (h1 !== 1) out.headingIssues.push(`${h1} zichtbare h1`);

  /* ── landmarks and the skip link ── */
  const mains = document.querySelectorAll('main, [role="main"]');
  if (mains.length !== 1) out.landmarks.push(`${mains.length} <main>`);
  if (!document.querySelector('header, [role="banner"]')) out.landmarks.push('geen <header>');
  if (!document.querySelector('footer, [role="contentinfo"]')) out.landmarks.push('geen <footer>');
  const navs = [...document.querySelectorAll('nav')]; if (!navs.length) out.landmarks.push('geen <nav>');
  for (const n of navs) if (navs.length > 1 && !accName(n).name) out.landmarks.push(`<nav> zonder naam (${path(n)})`);
  const skip = document.querySelector('a.skip, a[href="#main"]');
  if (!skip) out.landmarks.push('geen skip-link');
  else { const id = (skip.getAttribute('href') || '').slice(1); const t = id && document.getElementById(id); if (!t) out.landmarks.push(`skip-link wijst naar #${id}, dat niet bestaat`); else if (!/^(main|section|div)$/i.test(t.tagName) || (t.tagName !== 'MAIN' && t.tabIndex < 0 && !t.hasAttribute('tabindex'))) out.landmarks.push(`skip-link doel #${id} is ${t.tagName.toLowerCase()}`); }
  for (const s of document.querySelectorAll('section[data-room], [role="region"]')) if (displayed(s) && !byIds(s.getAttribute('aria-labelledby')) && !(s.getAttribute('aria-label') || '').trim()) out.landmarks.push(`sectie zonder aria-labelledby: ${path(s)}`);

  /* ── forms ── */
  for (const el of document.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
    if (!displayed(el)) continue;
    const db = el.getAttribute('aria-describedby'); if (db && !byIds(db) && !db.split(/\s+/).every(id => document.getElementById(id))) out.forms.push(`aria-describedby wijst naar een ontbrekend id: ${path(el)}`);
    if (el.getAttribute('aria-invalid') === 'true' && !db) out.forms.push(`aria-invalid zonder aria-describedby: ${path(el)}`);
  }
  for (const f of document.querySelectorAll('fieldset')) { if (!displayed(f)) continue; const l = f.querySelector(':scope > legend'); if (!l) out.forms.push(`fieldset zonder legend: ${path(f)}`); else if (!txt(l)) out.forms.push(`lege legend: ${path(f)}`); }
  for (const hp of document.querySelectorAll('input[name="company_site"]')) { if (!hp.closest('[aria-hidden="true"]') || hp.tabIndex >= 0) out.forms.push(`honeypot bereikbaar voor hulptechnologie: ${path(hp)}`); }
  const err = document.getElementById('form-err'); if (document.getElementById('contact-form') && !(err && (err.getAttribute('role') === 'alert' || err.getAttribute('aria-live')))) out.forms.push('#form-err is geen role=alert');

  /* ── live regions, the sign, simulations ── */
  const lives = [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]')];
  for (const l of lives) { const mode = l.getAttribute('aria-live') || (l.getAttribute('role') === 'alert' ? 'assertive' : 'polite'); if (mode === 'assertive' && l.getAttribute('role') !== 'alert') out.live.push(`aria-live=assertive buiten role=alert: ${path(l)}`); }
  out.liveCount = lives.length;
  if (lives.length > 12) out.live.push(`${lives.length} live-gebieden op één pagina`);
  const scene = document.getElementById('scene'), signDom = document.getElementById('sign-dom'), signSr = document.getElementById('sign-sr'), fb = document.getElementById('scene-fallback');
  if (scene && scene.getAttribute('aria-hidden') !== 'true') out.sim.push('#scene is niet aria-hidden');
  if (fb && fb.getAttribute('aria-hidden') !== 'true') out.sim.push('#scene-fallback is niet aria-hidden');
  if (signDom && signDom.getAttribute('aria-hidden') !== 'true') out.sim.push('#sign-dom is niet aria-hidden');
  if (signDom && !(signSr && signSr.getAttribute('aria-live') === 'polite')) out.sim.push('#sign-sr ontbreekt of is niet aria-live=polite');
  for (const room of document.querySelectorAll('[data-sim]')) {
    if (!displayed(room)) continue;
    for (const g of room.querySelectorAll('svg, canvas')) {
      if (!displayed(g) || g.closest('[aria-hidden="true"]') || g.closest('button, a, summary')) continue;
      if (g.getAttribute('role') !== 'img' || !accName(g).name) out.sim.push(`grafiek zonder tekstalternatief (role=img met naam, of aria-hidden naast een lijst): ${path(g)}`);
    }
    for (const b of room.querySelectorAll('button')) {
      if (!displayed(b)) continue;
      const role = b.getAttribute('role'), pressed = b.hasAttribute('aria-pressed') || b.hasAttribute('aria-expanded') || b.hasAttribute('aria-checked');
      if (b.closest('[role="group"]') && !pressed && !b.closest('.ctas, .rs-acties, .sim-ctrl, .dag-speler, .la-chips, .lr-tonen')) out.sim.push(`knop in een groep zonder staat (aria-pressed): ${path(b)}`);
      if (role === 'switch' && !b.hasAttribute('aria-checked')) out.sim.push(`role=switch zonder aria-checked: ${path(b)}`);
    }
  }

  /* ── language ── */
  const lang = document.documentElement.getAttribute('lang');
  if (lang !== 'nl-BE') out.lang.push(`html lang is ${lang}, verwacht nl-BE`);
  const en = /\b(the|and|with|your|can|our|you|this|that|are|imagination|reach)\b/gi;
  const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seenEn = new Set();
  while ((node = w2.nextNode())) {
    const t = node.nodeValue; if (!t || t.trim().length < 12) continue;
    const el = node.parentElement; if (!el || !displayed(el) || el.closest('[lang="en"], [lang^="en-"], code, pre, [data-voice="qa"]')) continue;
    const m = t.match(en); if (m && m.length >= 3) { const k = path(el); if (!seenEn.has(k)) { seenEn.add(k); out.lang.push(`Engels zonder lang=en: '${t.trim().slice(0, 50)}' (${k})`); } }
  }
  return out;
}

/** Lists the elements the Tab key should reach, in DOM order, and stores them on window.__a11yTab with a
 *  snapshot of their resting outline/shadow/border (the focus ring is whatever changes). Radios count once
 *  per group: the checked one, else the first. */
export function tabbables() {
  const cs = (el) => getComputedStyle(el);
  const hidden = (el) => { if (el.closest('[hidden], [inert], template')) return true; const d = el.closest('details:not([open])'); if (d && !(el.tagName === 'SUMMARY' && el.parentElement === d)) return true; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const s = cs(n); if (s.display === 'none' || s.visibility === 'hidden') return true; } return false; };
  const ringEl = (el) => (el.tagName === 'INPUT' && /^(radio|checkbox)$/.test(el.type) && parseFloat(cs(el).opacity) === 0 && el.nextElementSibling) ? el.nextElementSibling : el;
  const snap = (el) => { const s = cs(ringEl(el)); return { outline: `${s.outlineStyle}/${s.outlineWidth}`, shadow: s.boxShadow, border: s.borderColor, bg: s.backgroundColor }; };
  const list = [], seenRadio = new Set();
  for (const el of document.querySelectorAll('a[href], area[href], button, input, select, textarea, summary, [tabindex], audio[controls], video[controls], [contenteditable="true"]')) {
    if (el.tabIndex < 0 || el.disabled || hidden(el)) continue;
    if (el.tagName === 'INPUT' && el.type === 'hidden') continue;
    if (el.closest('fieldset:disabled')) continue;
    if (el.tagName === 'INPUT' && el.type === 'radio' && el.name) {
      const form = el.form || document, group = [...form.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)].filter(r => !r.disabled && !hidden(r));
      const key = (el.form ? 'f' : 'd') + el.name; if (seenRadio.has(key)) continue; seenRadio.add(key);
      const pick = group.find(r => r.checked) || group[0]; if (pick !== el) { list.push(pick); continue; }
    }
    list.push(el);
  }
  window.__a11yTab = list.map(el => ({ el, rest: snap(el) }));
  const sig = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.name ? '[' + el.name + ']' : ''}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''}:${(el.textContent || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 24)}`;
  return list.map(sig);
}

/** After one Tab: which listed element has focus, and does its ring differ from rest. */
export function focusState() {
  const a = document.activeElement, L = window.__a11yTab || [];
  if (!a || a === document.body) return { index: -1, body: true };
  const cs = (el) => getComputedStyle(el);
  const ringEl = (el) => (el.tagName === 'INPUT' && /^(radio|checkbox)$/.test(el.type) && parseFloat(cs(el).opacity) === 0 && el.nextElementSibling) ? el.nextElementSibling : el;
  const i = L.findIndex(x => x.el === a);
  const s = cs(ringEl(a)), rest = i >= 0 ? L[i].rest : null;
  const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
  const ring = outline || (rest && (s.boxShadow !== rest.shadow || s.borderColor !== rest.border));
  const visible = a.matches(':focus-visible');
  return { index: i, body: false, ring: !!ring, focusVisible: visible, tag: a.tagName.toLowerCase(), id: a.id || '', type: a.type || '' };
}

/** Reduced motion: declared animation and transition durations above the limit, and running WAAPI animations. */
export function motionScan(limitMs) {
  const out = [], name = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''}`;
  const ms = (v) => v.trim().endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000;
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    if (s.animationName !== 'none') for (const d of s.animationDuration.split(',')) if (ms(d) > limitMs && s.animationIterationCount !== '0') { out.push(`animatie ${s.animationName} ${d.trim()} op ${name(el)}`); break; }
    if (out.length > 12) break;
  }
  for (const a of document.getAnimations ? document.getAnimations() : []) {
    if (a.playState !== 'running' || !a.effect || !a.effect.target) continue;
    const t = a.effect.getTiming ? a.effect.getTiming() : {}; const d = typeof t.duration === 'number' ? t.duration : 0;
    if (d > limitMs) out.push(`lopende animatie ${a.animationName || a.transitionProperty || 'waapi'} ${Math.round(d)} ms op ${name(a.effect.target)}`);
  }
  return out;
}

/** At a narrow viewport (200 % zoom): horizontal overflow and text clipped by overflow:hidden. */
export function zoomScan() {
  const de = document.documentElement, vw = de.clientWidth;
  const sw = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0);
  const clipped = [], name = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''}`;
  for (const el of document.querySelectorAll('h1, h2, h3, h4, p, li, label, legend, button, a, dt, dd, summary, td, th')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || el.closest('[hidden], svg, .scroller, .ub-deuren, pre, [aria-hidden="true"], details:not([open]) > :not(summary)')) continue;
    if (s.position === 'absolute' && (s.clip !== 'auto' || parseFloat(s.width) <= 1)) continue;   // visually hidden text (.sr) is clipped on purpose
    if (s.textOverflow === 'ellipsis' || el.querySelector('[style*="text-overflow"], .ub-chip-txt')) continue;
    if (!/(hidden|clip)/.test(s.overflowX) && !el.parentElement.matches('[style*="overflow"]')) continue;
    if (el.scrollWidth > el.clientWidth + 2 && (el.textContent || '').trim()) clipped.push(`${name(el)} ${el.scrollWidth}>${el.clientWidth}`);
    if (clipped.length >= 8) break;
  }
  return { vw, sw, overflow: sw > vw + 1, clipped };
}
