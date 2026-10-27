// WP-26: the page.evaluate half of robust.mjs. Every function here runs inside the page (no closures over node
// state); robust.mjs passes plain arguments and reads plain results.

/** Is the page visibly alive: a visible H1, text in <main> (or body), and the no-JS line when scripts are off. */
export function aliveState() {
  const vis = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0 && cs.display !== 'none'; };
  const h1 = document.querySelector('h1');
  const main = document.querySelector('main') || document.body;
  const text = (main.innerText || '').replace(/\s+/g, ' ').trim();
  const doors = [...document.querySelectorAll('nav[aria-label="Uithangbord"] a[href]')].map(a => ({ label: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), visible: vis(a) }));
  const fb = document.getElementById('scene-fallback'), svg = fb && fb.querySelector('svg'), board = document.getElementById('landmark-bord');
  const canvas = document.getElementById('scene');
  const sb = svg ? svg.getBoundingClientRect() : null;
  const nojs = document.querySelector('.nojs');
  const hiddenReveal = [...document.querySelectorAll('.rv, [data-reveal]')].filter(e => parseFloat(getComputedStyle(e).opacity) === 0).length;
  const arrival = [...document.querySelectorAll('.gevel-aankomst p, .gevel-aankomst h1')].filter(vis).map(e => e.textContent.trim());
  return {
    h1: h1 ? { visible: vis(h1), text: h1.textContent.trim().slice(0, 80), top: Math.round(h1.getBoundingClientRect().top) } : null,
    textLength: text.length, doors, arrival,
    svg: { present: !!svg, visible: !!(fb && vis(fb) && sb && sb.width > 0 && sb.height > 0), board: !!board, fallbackHidden: fb ? fb.hidden : null },
    canvasVisible: !!canvas && vis(canvas), nojsVisible: !!nojs && vis(nojs), nojsText: nojs ? nojs.textContent.trim() : '',
    hiddenReveal, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
    chipVisible: vis(document.querySelector('[data-ub-chip]')),
  };
}

/** The Bericht form after a submit attempt: where the native submit would go, and whether the page navigated. */
export function formState() {
  const f = document.getElementById('contact-form');
  if (!f) return null;
  return { action: f.getAttribute('action') || '', method: (f.getAttribute('method') || 'get').toLowerCase(), enctype: f.getAttribute('enctype') || '', url: location.href, okShown: !!(document.getElementById('form-ok') && !document.getElementById('form-ok').hidden) };
}

/** Fonts: which font files loaded, the H1 box and the page height (compared between a normal and a blocked run). */
export function fontState() {
  const h1 = document.querySelector('h1'), r = h1 ? h1.getBoundingClientRect() : null;
  const faces = [];
  try { for (const f of document.fonts) faces.push({ family: f.family.replace(/"/g, ''), weight: f.weight, status: f.status }); } catch (e) { /* no FontFaceSet */ }
  const fam = h1 ? getComputedStyle(h1).fontFamily : '';
  const sign = document.getElementById('sign-dom');
  return {
    h1: r ? { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), lines: Math.round(r.height / parseFloat(getComputedStyle(h1).lineHeight || '1')) } : null,
    h1Family: fam, scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
    faces, loaded: faces.filter(f => f.status === 'loaded' && !/Fallback/.test(f.family)).length,   // the local fallback faces load by design
    signPlaced: !!(sign && sign.classList.contains('is-placed')), frames: window.STSScene && window.STSScene.debug ? window.STSScene.debug.frames : null,
  };
}

/** A deep link: where the target landed against every fixed or sticky bar that overlaps it horizontally. */
export function anchorState(id) {
  const el = document.getElementById(id);
  if (!el) return { found: false, id, hash: location.hash };
  const r = el.getBoundingClientRect();
  // the content starts at the first visible text inside the target: main and the gevel room start at the top of the
  // document and pad their first words under the strip (and, on index, under the sign)
  let contentTop = r.top + (parseFloat(getComputedStyle(el).paddingTop) || 0), firstText = null;
  for (const d of el.querySelectorAll('*')) {
    if (d.closest('.sr, [aria-hidden="true"], [hidden], script, style, template')) continue;
    if (![...d.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) continue;
    const dr = d.getBoundingClientRect(); if (dr.height === 0 || dr.width === 0) continue;
    if (firstText === null || dr.top < firstText) firstText = dr.top;
  }
  if (firstText !== null) contentTop = firstText;
  const bars = [];
  for (const b of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(b);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (b.id === 'scene' || b.id === 'scene-fallback' || b.id === 'sign-dom' || b.classList.contains('skip') || b.closest('[hidden]') || el.contains(b)) continue;   // a sticky panel inside the target is its own
    const br = b.getBoundingClientRect();
    if (br.height === 0 || br.width === 0 || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    if (br.top > innerHeight / 2) continue;                               // the phone dock sits at the bottom
    if (br.right <= r.left || br.left >= r.right) continue;                // no horizontal overlap
    bars.push({ what: `${b.tagName.toLowerCase()}${b.id ? '#' + b.id : ''}${typeof b.className === 'string' && b.className ? '.' + b.className.split(' ')[0] : ''}`, bottom: Math.round(br.bottom) });
  }
  const cover = bars.reduce((m, b) => Math.max(m, b.bottom), 0);
  // what actually sits on the target's first pixels: the target itself (or a child) or something covering it
  const probe = document.elementFromPoint(Math.min(innerWidth - 2, Math.max(1, r.left + Math.min(40, r.width / 2))), Math.max(0, contentTop + 2));
  const covered = !!probe && probe !== el && !el.contains(probe) && !probe.contains(el);
  return { found: true, id, hash: location.hash, top: Math.round(contentTop), boxTop: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), cover, bars, covered, probe: probe ? `${probe.tagName.toLowerCase()}${probe.id ? '#' + probe.id : ''}` : null, innerHeight, scrollY: Math.round(scrollY) };
}

/** Every same-site link with a hash on this page: [{page, id}] relative to the docs root. */
export function anchorLinks(docsOrigin) {
  const out = [];
  for (const a of document.querySelectorAll('a[href]')) {
    let u; try { u = new URL(a.href, location.href); } catch (e) { continue; }
    if (u.origin !== docsOrigin || !u.hash || u.hash.length < 2) continue;
    const hash = u.hash.slice(1);
    if (hash.includes('?')) continue;                                      // prefill links: the conversion check covers them
    const page = u.pathname.replace(/^\//, '') || 'index.html';
    out.push({ page, id: decodeURIComponent(hash), from: location.pathname.replace(/^\//, '') });
  }
  return out;
}

/** 404 under <base>: stylesheets applied, every link resolved to the Pages host, the H1 styled in the display face. */
export function baseState(pagesHost) {
  const h1 = document.querySelector('h1');
  const links = [...document.querySelectorAll('a[href]')].map(a => { try { return new URL(a.href).hostname; } catch (e) { return ''; } });
  const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].filter(l => !!l.sheet).length;   // cross-origin under <base>: cssRules is closed, the sheet object is not
  const base = document.querySelector('base');
  return {
    base: base ? base.getAttribute('href') : null, sheets, h1Family: h1 ? getComputedStyle(h1).fontFamily : '', h1Visible: !!h1 && h1.getBoundingClientRect().width > 0,
    bodyBg: getComputedStyle(document.body).backgroundColor, styled: getComputedStyle(document.body).backgroundColor === 'rgb(6, 8, 15)', linksOnPagesHost: links.filter(h => h === pagesHost).length, links: links.length,
    icon: (() => { const l = document.querySelector('link[rel="icon"]'); return l ? l.href : ''; })(),
  };
}

/** Print media (emulated): what is visible, the page colours and any dark surface or light text that would print badly. */
export function printScan(only) {
  const lum = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(',').map(parseFloat); const a = p[3] === undefined ? 1 : p[3]; if (a < 0.5) return null; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]); };
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''}`;
  const dark = [], light = [];
  let visibleCount = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg, canvas')) continue;
    if (!vis(el)) continue;
    visibleCount++;
    const cs = getComputedStyle(el);
    const bl = lum(cs.backgroundColor);
    if (bl !== null && bl < 0.5 && dark.length < 8) dark.push(`${name(el)} ${cs.backgroundColor}`);
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
    if (hasText) { const tl = lum(cs.color); if (tl !== null && tl > 0.6 && light.length < 8) light.push(`${name(el)} ${cs.color}`); }
  }
  const outside = only ? [...document.body.children].filter(el => vis(el) && !el.matches(only)).map(name) : [];
  const box = (sel) => { const el = document.querySelector(sel); if (!el || !vis(el)) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  return {
    htmlBg: getComputedStyle(document.documentElement).backgroundColor, bodyBg: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme,
    strip: vis(document.querySelector('.uithangbord') || document.body) && !!document.querySelector('.uithangbord') && vis(document.querySelector('.uithangbord')),
    foot: !!document.querySelector('.foot') && vis(document.querySelector('.foot')), canvas: !!document.getElementById('scene') && vis(document.getElementById('scene')),
    dark, light, outside, visibleCount, htmlClass: document.documentElement.className,
    a6: box('.a6-wrap canvas'), toog: [...document.querySelectorAll('.toog-zijde')].filter(vis).map(el => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }),
    eenpager: box('.eenpager'), qr: box('.eenpager canvas'), printed: window.__printed || 0,
  };
}
