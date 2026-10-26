// In-page checks for the QA harness. Every function here is either an init script
// or a page.evaluate body; qa.mjs wires them to Playwright.
import { gzipSync } from 'node:zlib';
import { LOCAL_HOSTS, PAGES_HOST, STORAGE_ALLOW } from './profiles.mjs';

/** Injected before any page script: counters, event log, sts-pre (except in the 'intro' variant), hardwareConcurrency. */
export function initScript(cfg) {
  if (!cfg.intro) { try { sessionStorage.setItem('sts-pre', '1'); } catch (e) { /* storage blocked */ } }
  try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cfg.hardwareConcurrency, configurable: true }); } catch (e) { /* read-only */ }
  const S = { raf: 0, intervals: new Map(), timeouts: new Map(), intervalsCreated: 0, timeoutsCreated: 0, events: [], t0: performance.now() };
  window.__sts = S;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { S.raf++; return cb(t); });
  const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
  window.setInterval = (fn, ms, ...a) => { const id = si(fn, ms, ...a); S.intervalsCreated++; S.intervals.set(id, { ms: ms | 0, at: Math.round(performance.now() - S.t0) }); return id; };
  window.clearInterval = (id) => { S.intervals.delete(id); return ci(id); };
  const st = window.setTimeout.bind(window), ct = window.clearTimeout.bind(window);
  window.setTimeout = (fn, ms, ...a) => {
    let id = 0;
    id = st((...x) => { S.timeouts.delete(id); return typeof fn === 'function' ? fn(...x) : undefined; }, ms, ...a);
    S.timeoutsCreated++; S.timeouts.set(id, { ms: ms | 0, at: Math.round(performance.now() - S.t0) });
    return id;
  };
  window.clearTimeout = (id) => { S.timeouts.delete(id); return ct(id); };
  for (const ev of ['sts:scene-ready', 'sts:scene-failed', 'sts:scene-degraded', 'sts:landed', 'sts:intro-done']) {
    window.addEventListener(ev, () => S.events.push({ ev, ms: Math.round(performance.now() - S.t0) }));
  }
  Object.defineProperty(window, '__rafCount', { get: () => S.raf });
}

/** Reads the counters. Call twice, 3 s apart, for the idle delta. */
export function readCounters() {
  const S = window.__sts;
  return {
    raf: S.raf, intervalsCreated: S.intervalsCreated, intervalsActive: S.intervals.size,
    timeoutsCreated: S.timeoutsCreated, timeoutsPending: S.timeouts.size, events: S.events.slice(),
  };
}

/** Scene state: is there a canvas, did an event fire, is the fallback showing. */
export function sceneState() {
  const canvas = document.getElementById('scene');
  const fb = document.getElementById('scene-fallback');
  const visible = (el) => !!el && !el.hidden && getComputedStyle(el).display !== 'none';
  let webgl2 = null, webgl1 = null;
  try { const c = document.createElement('canvas'); webgl2 = !!c.getContext('webgl2'); webgl1 = webgl2 || !!c.getContext('webgl'); } catch (e) { webgl2 = false; webgl1 = false; }
  const ev = (window.__sts && window.__sts.events[0]) || null;
  return {
    hasCanvas: !!canvas, hasFallback: !!fb, fallbackVisible: visible(fb), canvasVisible: visible(canvas),
    event: ev ? ev.ev.replace('sts:scene-', '') : 'none', eventMs: ev ? ev.ms : null, events: window.__sts ? window.__sts.events : [],
    webgl: { available: webgl2 || webgl1, webgl2, webgl1 }, stsScene: !!window.STSScene, lite: window.STSScene ? !!window.STSScene.lite : null,
  };
}

/** Hygiene, overflow, storage keys, pointer, markup references to other hosts.
 *  Overflow is measured against the layout viewport (documentElement.clientWidth, and visualViewport when
 *  smaller): under phone emulation Chromium widens innerWidth to the overflowing content, so innerWidth
 *  can never show an overflow there. */
export function pageInfo(cfg) {
  const de = document.documentElement;
  const sw = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0);
  const visualWidth = window.visualViewport ? Math.round(window.visualViewport.width) : innerWidth;
  const vw = Math.min(de.clientWidth || innerWidth, visualWidth || innerWidth);
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg')) continue;                                                 // clipped by the svg, cannot overflow
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > 0 && (r.right > vw + 1 || r.left < -1)) {   // right <= 0: parked off-screen (skip link)
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.overflow === 'hidden' || el.closest('[style*="overflow"], .scroller, pre, canvas, [hidden]')) continue;
      wide.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''} right=${Math.round(r.right)}`);
      if (wide.length >= 6) break;
    }
  }
  const keys = (s) => { try { return Object.keys(s); } catch (e) { return []; } };
  const session = keys(sessionStorage), local = keys(localStorage);
  const ext = [];
  const check = (el, attr, prop) => {
    const raw = el.getAttribute(attr); if (!raw) return;
    let u; try { u = new URL(el[prop] || raw, location.href); } catch (e) { return; }
    if (!/^https?:$/.test(u.protocol)) return;
    if (cfg.localHosts.includes(u.hostname) || u.hostname === cfg.pagesHost) return;
    ext.push(`${el.tagName.toLowerCase()}[${attr}] ${u.href.slice(0, 120)}`);
  };
  for (const el of document.querySelectorAll('link[href]')) check(el, 'href', 'href');
  for (const el of document.querySelectorAll('script[src], img[src], iframe[src], video[src], audio[src], source[src], embed[src], object[data]')) check(el, el.hasAttribute('src') ? 'src' : 'data', el.hasAttribute('src') ? 'src' : 'data');
  for (const el of document.querySelectorAll('form[action]')) check(el, 'action', 'action');
  const text = document.body ? document.body.innerText : '';
  return {
    scrollWidth: sw, innerWidth, viewportWidth: vw, visualWidth, clientWidth: de.clientWidth, wide, lang: de.getAttribute('lang'), title: document.title,
    hasViewport: !!document.querySelector('meta[name=viewport]'), hasDesc: !!document.querySelector('meta[name=description]'),
    undefinedText: /\bundefined\b|\[object Object\]|\bNaN\b/.test(text), emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(text.replace(/[★☆]/g, '')),
    h1: document.querySelectorAll('h1').length, imgsNoAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length,
    pointer: matchMedia('(pointer:coarse)').matches ? 'coarse' : 'fine', reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    hardwareConcurrency: navigator.hardwareConcurrency, storage: { session, local }, externalMarkup: ext,
    smallTargets: cfg.phone ? [...document.querySelectorAll('a, button, input, select, textarea, [role=button]')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44) && getComputedStyle(el).visibility !== 'hidden'; }).length : null,
  };
}

/** Running or declared transitions/animations on heavy properties. */
export function animationScan(heavy) {
  const running = [], declared = [];
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''}`;
  for (const a of document.getAnimations ? document.getAnimations() : []) {
    if (a.playState !== 'running' || !a.effect || !a.effect.target) continue;
    let props = [];
    if (a.transitionProperty) props = [a.transitionProperty];
    else if (a.effect.getKeyframes) props = [...new Set(a.effect.getKeyframes().flatMap(k => Object.keys(k)))].filter(k => !['offset', 'computedOffset', 'easing', 'composite'].includes(k));
    const bad = props.map(p => p.replace(/[A-Z]/g, c => '-' + c.toLowerCase())).filter(p => heavy.includes(p) || p === '-webkit-backdrop-filter');
    if (bad.length) running.push(`${name(a.effect.target)} ${a.animationName || 'transition'}: ${bad.join(', ')}`);
  }
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    const props = cs.transitionProperty.split(',').map(s => s.trim());
    const durs = cs.transitionDuration.split(',').map(s => parseFloat(s) || 0);
    // durations under 50 ms are the reduced-motion stub (transition-duration: .01ms), not an animation
    props.forEach((p, i) => { if ((heavy.includes(p) || p === '-webkit-backdrop-filter' || p === 'all') && (durs[i] ?? durs[0]) >= 0.05) declared.push(`${name(el)} transition ${p}`); });
    if (declared.length > 12) break;
  }
  return { running, declared: [...new Set(declared)] };
}

/** Rendered-text scan with the shared word rules (serialised form). */
export function textScan({ rules, cfg }) {
  const out = [], simMissing = [], stars = [];
  const blockSel = 'p, li, figure, figcaption, blockquote, div, article, section, td, th, dd, dt, summary, h1, h2, h3, h4, label, button';
  const name = (el) => { const parts = []; for (let n = el, d = 0; n && n !== document.body && d < 4; n = n.parentElement, d++) parts.unshift(`${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : ''}`); return parts.join(' > '); };
  const hidden = (el) => !!el.closest('script, style, template, noscript, [hidden]') || getComputedStyle(el).display === 'none';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  let n;
  while ((n = walker.nextNode())) {
    const t = n.nodeValue; if (!t || !t.trim()) continue;
    const el = n.parentElement; if (!el || hidden(el)) continue;
    const voiceEl = el.closest('[data-voice]');
    const voice = voiceEl ? (voiceEl.dataset.voice || 'sts') : 'sts';
    const exempt = voice !== 'sts' && rules.exemptVoices.includes(voice);
    const faq = !!el.closest('details > summary');
    const sim = !!el.closest('[data-sim]');
    const gevel = !!el.closest('#gevel, [data-room=gevel]');
    const where = name(el);
    if (!exempt && !faq && !cfg.demo) {
      for (const r of rules.sts) {
        if (r.legalOk && cfg.legal) continue;
        if (r.scope === 'gevel' && !gevel) continue;
        const m = new RegExp(r.pattern, r.flags.replace('g', '')).exec(t);
        if (m && !seen.has(r.id + where)) { seen.add(r.id + where); out.push({ rule: r.id, match: m[0], where, note: r.note }); }
      }
    }
    if (sim) for (const r of rules.simForbidden) { const m = new RegExp(r.pattern, r.flags.replace('g', '')).exec(t); if (m) out.push({ rule: 'sim-' + r.id, match: m[0], where, note: r.note }); }
    if (!cfg.demo && new RegExp(rules.stars.pattern, 'u').test(t)) {
      const block = el.closest(blockSel) || el;
      if (!block.innerText.toLowerCase().includes(rules.stars.required)) stars.push(where);
    }
  }
  for (const el of document.querySelectorAll('[data-sim]')) {
    const txt = el.innerText.toLowerCase();
    if (!rules.simRequired.some(w => txt.includes(w.toLowerCase()))) simMissing.push(name(el));
  }
  return { forbidden: out, simMissing, stars };
}

/** Are these words visible inside the first viewport without scrolling? */
export function firstViewport(words) {
  const res = [];
  for (const w of words) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n, ok = false, top = null;
    while ((n = walker.nextNode())) {
      const i = n.nodeValue.toLowerCase().indexOf(w.toLowerCase()); if (i < 0) continue;
      const el = n.parentElement; if (!el || el.closest('script, style, template, [hidden], [aria-hidden=true]')) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
      const range = document.createRange(); range.setStart(n, i); range.setEnd(n, i + w.length);
      const r = range.getBoundingClientRect(); top = Math.round(r.top);
      if (r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth) { ok = true; break; }
    }
    res.push({ word: w, ok, top });
  }
  return res;
}

/** Scene frames drawn so far (STSScene.debug.frames), the route and the intro overlay; null without a scene. */
export function sceneFrames() {
  const s = window.STSScene;
  return {
    frames: s && s.debug ? s.debug.frames : null, lite: s ? !!s.lite : null, state: s && s.debug ? s.debug.state : null,
    overlay: !!document.getElementById('intro'), route: document.documentElement.dataset.scene || null,
  };
}

/** The dock on the phone: every door's box against the scrolling list's own box (what is clipped is not visible),
 *  the action pill against the layout viewport, and the aria-current=page door. */
export function dockState() {
  const vw = document.documentElement.clientWidth;
  const ul = document.querySelector('nav[aria-label="Uithangbord"] .ub-deuren'), ur = ul ? ul.getBoundingClientRect() : { left: 0, right: vw };
  const inside = (r, box) => r.width > 0 && r.left >= box.left - 1 && r.right <= box.right + 1;
  const doors = [...document.querySelectorAll('nav[aria-label="Uithangbord"] .ub-deuren a')].map(a => {
    const r = a.getBoundingClientRect();
    return { label: a.textContent.trim(), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), visible: inside(r, ur), current: a.getAttribute('aria-current') === 'page' };
  });
  const pill = document.querySelector('nav[aria-label="Uithangbord"] .pill');
  const pr = pill ? pill.getBoundingClientRect() : null;
  return { vw, list: [Math.round(ur.left), Math.round(ur.right)], doors, pill: pr ? { label: pill.textContent.trim(), left: Math.round(pr.left), right: Math.round(pr.right), visible: inside(pr, { left: 0, right: vw }) } : null };
}

/** A long name on the sign: page width, the sign box, the lines on #sign-dom and the text for assistive technology. */
export function signState() {
  const de = document.documentElement, dom = document.getElementById('sign-dom'), sr = document.getElementById('sign-sr');
  const r = dom ? dom.getBoundingClientRect() : null;
  return {
    scrollWidth: Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0), clientWidth: de.clientWidth, innerWidth,
    sign: r ? { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height), placed: dom.classList.contains('is-placed') } : null,
    lines: dom ? [...dom.querySelectorAll('span')].map(s => s.textContent) : [], sr: sr ? sr.textContent : null,
  };
}

/** Bounding box of the SVG landmark board (phone route); null when absent. */
export function landmarkRect() {
  const el = document.getElementById('landmark-bord') || document.getElementById('landmark');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}

/** The conversion contract: [data-bericht] elements and the STSBericht API, if present. */
export function conversionTargets() {
  const els = [...document.querySelectorAll('[data-bericht]')];
  return { count: els.length, keys: els.map(e => e.getAttribute('data-bericht')), api: !!(window.STSBericht && typeof window.STSBericht.prefill === 'function') };
}

/** Sorts hosts: local, the Pages host (mapped on 404.html), or external. */
export function hostKind(url) {
  let u; try { u = new URL(url); } catch (e) { return 'other'; }
  if (!/^https?:$/.test(u.protocol)) return 'other';
  if (LOCAL_HOSTS.has(u.hostname)) return 'local';
  if (u.hostname === PAGES_HOST) return 'pages';
  return 'external';
}

/** Storage keys outside the three allowed ones. */
export function storageViolations(storage) {
  const bad = [];
  for (const k of storage.session || []) if (!STORAGE_ALLOW.session.includes(k)) bad.push(`sessionStorage.${k}`);
  for (const k of storage.local || []) if (!STORAGE_ALLOW.local.includes(k)) bad.push(`localStorage.${k}`);
  return bad;
}

/** Byte accounting for one response body. */
export function measure(bytes, type, body) {
  const n = body ? body.length : 0;
  bytes.total += n;
  bytes.byType[type] = (bytes.byType[type] || 0) + n;
  if (type === 'script' && body) bytes.jsGzip += gzipSync(body).length;
  return bytes;
}
