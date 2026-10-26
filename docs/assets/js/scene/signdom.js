/* The DOM side of the sign, shared by the Three.js route (scene.js) and the
   SVG route (plattegrond.js): text rules (two lines at 16 characters, 40 at
   most), the font size that fits a box, and the writes to #sign-dom (visual,
   aria-hidden) and #sign-sr (the same text for assistive technology). No
   Three.js import here, so phones never pay for it. */
export const SIGN = { w: 12, h: 3, maxChars: 40, lineChars: 16 };
/* the framed board around the text plane, in world units (sign.js draws it; the SVG route carries the same frame) */
export const FRAME = { w: SIGN.w + 0.9, h: SIGN.h + 0.9 };
/* one font string for the texture and the measurements, so the glow and #sign-dom share one geometry */
export const SIGN_FONT = size => "700 " + size + "px 'Panchang', 'Unbounded', system-ui, sans-serif";
/* vertical offset of line i of n from the centre at the line pitch of #sign-dom (line-height 1.08 in base.css) */
export const LINE_PITCH = 1.08;
export const lineOffset = (i, n, size) => (i - (n - 1) / 2) * size * LINE_PITCH;

export function cleanSign(text) {
  return String(text || "").replace(/[\u0000-\u0008\u000e-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, SIGN.maxChars);
}

/* two-line wrap at 16 characters on word boundaries, never inside a word: a
   first word longer than 16 characters (Kinesitherapiepraktijk) is line 1 on
   its own and the rest is line 2 (the texture scales it to fit, the DOM
   shrinks the font to the widest line); a single word can never exceed the
   40-character cap of cleanSign */
export function wrapSign(text) {
  const t = cleanSign(text);
  if (t.length <= SIGN.lineChars) return [t];
  const words = t.split(" ");
  let a = "", rest = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i], join = a ? a + " " + w : w;
    if (!a || join.length <= SIGN.lineChars) a = join; else { rest = words.slice(i); break; }
  }
  const b = rest.join(" ").trim();
  return b ? [a, b] : [a];
}

/* the font race: a name written before panchang-normal-700.woff2 has arrived is measured in the
   fallback font; fontsReady(fn) returns false when the real Panchang is there, else starts its load
   (one request, the preloaded file) and runs fn once it has landed */
const PANCHANG = "700 100px 'Panchang'";
let fontLoad = null, settled = false;
export function fontsReady(fn) {
  const fonts = document.fonts;
  /* settled: the load ended, with or without the file (offline, 404, blocked); check() then stays false
     forever and a caller that redraws on every fontsReady would loop (sign.js draw -> schedule -> draw) */
  if (settled || !fonts || !fonts.check || !fonts.load || fonts.check(PANCHANG)) return false;
  if (!fontLoad) fontLoad = fonts.load(PANCHANG).catch(() => []).then(() => { settled = true; });
  fontLoad.then(() => { try { fn(); } catch (e) { /* one refit must not stop the next */ } });
  return true;
}

let measure = null;
/* font size in px so the longest line fits 92 % of the width and the lines
   fit the height; measured with the real Panchang when it is loaded */
export function fitFont(lines, w, h) {
  if (!measure) { try { measure = document.createElement("canvas").getContext("2d"); } catch (e) { measure = false; } }
  const maxH = h / (lines.length > 1 ? 2.5 : 1.7);
  let widest = 0;
  for (const l of lines) {
    let wl = l.length * 72;
    if (measure) { measure.font = SIGN_FONT(100); wl = measure.measureText(l).width; }
    widest = Math.max(widest, wl);
  }
  const byW = widest ? (w * 0.92) / (widest / 100) : maxH;
  return Math.max(8, Math.floor(Math.min(maxH, byW)));
}

/* #sign-sr is aria-live: while the owner types, the announcement waits until 600 ms after the last
   change, so a name is read once instead of once per keystroke; #sign-dom itself updates at once */
let srTimer = 0;
export const SR_DELAY = 600;
function refit() { const dom = document.getElementById("sign-dom"), w = dom && dom.offsetWidth, h = dom && dom.offsetHeight; if (w && h) dom.style.fontSize = fitFont(wrapSign(dom.textContent), w, h) + "px"; }
export function writeSignDom(text, color) {
  const dom = document.getElementById("sign-dom"), sr = document.getElementById("sign-sr");
  const lines = wrapSign(text), clean = lines.join(" ").trim();
  if (dom) {
    const nodes = [];
    lines.filter(Boolean).forEach((l, i) => { if (i) nodes.push(document.createTextNode(" ")); const s = document.createElement("span"); s.textContent = l; nodes.push(s); });
    dom.replaceChildren(...nodes);
    dom.dataset.lines = String(lines.filter(Boolean).length);
    if (color) dom.style.setProperty("--sign", color);
    const w = dom.offsetWidth, h = dom.offsetHeight;
    if (w && h) dom.style.fontSize = fitFont(lines, w, h) + "px";
    fontsReady(refit);
  }
  if (sr) {
    clearTimeout(srTimer);
    srTimer = setTimeout(() => { sr.textContent = clean ? "Uithangbord: " + clean : "Uithangbord zonder naam"; }, SR_DELAY);
  }
  return clean;
}

/* homography: maps the element's own rectangle onto four projected corners
   (Heckbert's adjugate method), so the crisp DOM letters sit exactly on the
   plane in perspective; with axis-aligned corners it is a plain affine map */
const adj = m => [m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4], m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5], m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]];
function mul(a, b) { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let v = 0; for (let k = 0; k < 3; k++) v += a[3 * i + k] * b[3 * k + j]; c[3 * i + j] = v; } return c; }
function basis(p) { const m = [p[0].x, p[1].x, p[2].x, p[0].y, p[1].y, p[2].y, 1, 1, 1], a = adj(m), v = [a[0] * p[3].x + a[1] * p[3].y + a[2], a[3] * p[3].x + a[4] * p[3].y + a[5], a[6] * p[3].x + a[7] * p[3].y + a[8]]; return mul(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); }
export function matrix3d(w, h, c) {   // c: top-left, top-right, bottom-right, bottom-left in pixels
  const t = mul(basis([c[0], c[1], c[3], c[2]]), adj(basis([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: h }, { x: w, y: h }])));
  const m = t.map(v => v / t[8]);
  return "matrix3d(" + [m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, m[8]].map(v => +v.toFixed(6)).join(",") + ")";
}

/* put #sign-dom on the projected plane: the box (viewport pixels) and, when
   known, its four corners; called once per landing and on debounced resize,
   never per frame */
export function placeSignDom(box, text, corners) {
  const dom = document.getElementById("sign-dom");
  if (!dom || !box) return;
  const ok = box.width > 40 && box.height > 10;
  const w = Math.max(1, Math.round(box.width)), h = corners ? Math.round(w * SIGN.h / SIGN.w) : Math.max(1, Math.round(box.height));
  dom.style.width = w + "px"; dom.style.height = h + "px";
  dom.style.fontSize = fitFont(wrapSign(text), w, h) + "px";
  dom.style.transform = corners ? matrix3d(w, h, corners) : "translate(" + Math.round(box.x) + "px," + Math.round(box.y) + "px)";
  dom.classList.toggle("is-placed", ok);
}

/* the twin fades while an opaque panel (a room, the strip, the dock) covers its box: the page scrolls
   over the fixed sign, so a landing that puts the board under a .92 panel would show the crisp letters
   at 8 % behind an edge; the canvas glow stays faintly visible through the panel, the DOM letters do not.
   Evaluated on every placement and, throttled, on scroll (no requestAnimationFrame, no loop). */
let lastBox = null, shadeTimer = 0;
const bgAlpha = el => { const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(el).backgroundColor || ""); return m ? (m[1].split(",")[3] === undefined ? 1 : parseFloat(m[1].split(",")[3])) : 0; };
export function shadeSignDom(box) {
  const dom = document.getElementById("sign-dom");
  if (box) lastBox = box;
  const b = lastBox; if (!dom || !b) return false;
  let hit = 0; const area = Math.max(1, b.width * b.height);
  for (const el of document.querySelectorAll("[data-room], .uithangbord")) {
    if (bgAlpha(el) < 0.5) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const w = Math.min(b.x + b.width, r.right) - Math.max(b.x, r.left), h = Math.min(b.y + b.height, r.bottom) - Math.max(b.y, r.top);
    if (w > 0 && h > 0) hit += w * h;
  }
  const behind = hit / area > 0.3;
  dom.classList.toggle("is-behind", behind);
  return behind;
}
export function watchSignShade() {
  addEventListener("scroll", () => { if (shadeTimer) return; shadeTimer = setTimeout(() => { shadeTimer = 0; shadeSignDom(); }, 80); }, { passive: true });
}

export function countLongTasks(counter) {
  try {
    const po = new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.duration > 100) counter.n++; });
    po.observe({ type: "longtask", buffered: true });
    return po;
  } catch (e) { return null; }
}
