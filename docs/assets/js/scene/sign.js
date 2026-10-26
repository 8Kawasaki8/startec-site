/* The sign: one 512x128 CanvasTexture (Panchang) on an emissive plane of
   12 x 3 world units on top of the landmark, facing the start/gevel camera,
   inside a framed board (its own static texture: dark enamel panel, metal
   rim, one neon tube along the inside of the frame). The text texture is
   drawn in two passes, once per text change (debounced 120 ms): a blurred
   copy of the letters for the glow (bloom-friendly), then the crisp tube
   letters (light core, sector-coloured edge). The crisp DOM twin #sign-dom
   sits on top of exactly the same letters: both use fitFont() from signdom.js
   and the same line pitch, so the two layers coincide. Unlit (no text) the
   board shows only its dark frame with a dim tube, so the visitor sees that a
   sign is waiting. setSector(color) sets the one emissive uniform on the
   landmark, retints the tube and the glow, and tells city.js (onState) so the
   roof reflection follows. No post-processing and no light is involved. */
import * as THREE from "../../vendor/three.module.min.js";
import { HERO, places } from "./places.js";
import { wrapSign, cleanSign, SIGN, FRAME, SIGN_FONT, fitFont, lineOffset, fontsReady } from "./signdom.js";
export { wrapSign, SIGN };

/* centre of the sign plane in world units */
export const SIGN_POS = { x: HERO.x, y: HERO.h + 2.2, z: HERO.z };
const TW = 512, TH = 128;                 // text texture
const FW = 516, FH = 156;                 // frame texture, 40 px per world unit
const WHITE = new THREE.Color(0xffffff);

/* frame texture: enamel panel, metal rim, neon tube; drawn on creation and when lit state or colour changes */
function drawFrame(g, lit, css) {
  g.clearRect(0, 0, FW, FH);
  const r = 14;
  const rr = (x, y, w, h, rad) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, rad); else g.rect(x, y, w, h); };
  /* rim: dark steel with a lighter top edge */
  rr(0, 0, FW, FH, r); g.fillStyle = "#161d33"; g.fill();
  rr(1, 1, FW - 2, FH - 2, r - 1); g.strokeStyle = "#2b3657"; g.lineWidth = 2; g.stroke();
  g.fillStyle = "#38457a"; g.fillRect(r, 1, FW - 2 * r, 1);
  /* bezel: a dark band, then the panel face */
  rr(7, 7, FW - 14, FH - 14, 9); g.fillStyle = "#070b16"; g.fill();
  const face = g.createLinearGradient(0, 11, 0, FH - 11);
  face.addColorStop(0, "#0d1428"); face.addColorStop(1, "#090e1d");
  rr(11, 11, FW - 22, FH - 22, 7); g.fillStyle = face; g.fill();
  /* the tube along the inside of the frame: glowing when lit, a dim dark line when not */
  rr(17, 17, FW - 34, FH - 34, 6);
  if (lit) {
    g.save(); g.shadowColor = css; g.shadowBlur = 12; g.strokeStyle = css; g.lineWidth = 3; g.globalAlpha = 0.85; g.stroke(); g.restore();
    g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1; g.stroke();
  } else { g.strokeStyle = "#1c2642"; g.lineWidth = 2; g.stroke(); }
  /* four screws in the rim */
  g.fillStyle = "#46538a";
  for (const [x, y] of [[8, 8], [FW - 8, 8], [8, FH - 8], [FW - 8, FH - 8]]) { g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); }
}

/* text texture, two passes: blurred letters (glow) behind crisp tube letters */
function drawText(g, lines, css, core) {
  g.clearRect(0, 0, TW, TH);
  if (!lines[0]) return;
  const size = fitFont(lines, TW, TH);
  g.font = SIGN_FONT(size); g.textAlign = "center"; g.textBaseline = "middle";
  try { g.letterSpacing = "0.01em"; } catch (e) { /* older canvas: no letter spacing, 0.5 % wider at most */ }
  const each = fn => lines.forEach((l, i) => fn(l, TH / 2 + lineOffset(i, lines.length, size)));
  /* pass 1, glow: the letters are drawn 2000 px above the canvas and only their shadow lands on it */
  g.save(); g.fillStyle = css; g.shadowColor = css; g.shadowOffsetY = 2000;
  g.shadowBlur = 26; g.globalAlpha = 0.9; each((l, y) => g.fillText(l, TW / 2, y - 2000));
  g.shadowBlur = 8; g.globalAlpha = 0.7; each((l, y) => g.fillText(l, TW / 2, y - 2000));
  g.restore();
  /* pass 2, the tube: a light core with the sector colour along the edge */
  g.lineJoin = "round"; g.lineWidth = Math.max(1.5, size * 0.04); g.strokeStyle = css;
  each((l, y) => g.strokeText(l, TW / 2, y));
  g.fillStyle = core; each((l, y) => g.fillText(l, TW / 2, y));
}

export function createSign(scene, { landmarkUniform, onChange, onState }) {
  const canvas = document.createElement("canvas"); canvas.width = TW; canvas.height = TH;
  const g = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const fc = document.createElement("canvas"); fc.width = FW; fc.height = FH;
  const fg = fc.getContext("2d");
  const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace; ftex.anisotropy = 4;
  const color = new THREE.Color(0x36e8ff);
  let text = "", timer = 0, lit = false;

  const group = new THREE.Group(); group.position.set(SIGN_POS.x, SIGN_POS.y, SIGN_POS.z);
  const face = places.start.p; group.lookAt(face[0], SIGN_POS.y, face[2]);
  /* the board: one framed plane behind the letters (rim, bezel, face and tube in one texture) */
  const board = new THREE.Mesh(new THREE.PlaneGeometry(FRAME.w, FRAME.h), new THREE.MeshBasicMaterial({ map: ftex, fog: true, toneMapped: false }));
  board.position.z = -0.06; group.add(board);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.w, SIGN.h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: 0xffffff }));
  group.add(plane); scene.add(group);

  const css = () => "#" + color.getHexString();
  const core = () => "#" + color.clone().lerp(WHITE, 0.5).getHexString();
  function frame() { drawFrame(fg, lit, css()); ftex.needsUpdate = true; }
  function draw() {
    const lines = wrapSign(text), now = !!lines[0];
    if (now !== lit) { lit = now; frame(); onState && onState(lit, color); }
    if (now) fontsReady(schedule);   /* drawn before Panchang arrived: once more with the real font, so glow and DOM letters coincide */
    drawText(g, lines, css(), core());
    tex.needsUpdate = true;
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => { timer = 0; draw(); onChange && onChange(); }, 120); }

  function setText(t) {
    const next = cleanSign(t);
    if (next === text) return text;
    text = next; schedule(); return text;
  }
  function setSector(c) {
    try { color.set(c); } catch (e) { return; }
    if (landmarkUniform) landmarkUniform.value.copy(color);
    frame(); onState && onState(lit, color);
    schedule();
  }
  /* centre and the four corners of the text plane in pixels of the given size */
  function project(camera, w, h) {
    const v = new THREE.Vector3(), out = [];
    const pts = [[0, 0], [-SIGN.w / 2, SIGN.h / 2], [SIGN.w / 2, SIGN.h / 2], [SIGN.w / 2, -SIGN.h / 2], [-SIGN.w / 2, -SIGN.h / 2]];
    for (const [x, y] of pts) {
      v.set(x, y, 0); group.localToWorld(v); v.project(camera);
      out.push({ x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, behind: v.z > 1 });
    }
    const xs = out.slice(1).map(p => p.x), ys = out.slice(1).map(p => p.y);
    const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    return { centre: out[0], corners: out.slice(1), box, visible: !out.some(p => p.behind) };
  }
  function dispose() { clearTimeout(timer); tex.dispose(); ftex.dispose(); }
  frame();
  return { group, plane, board, setText, setSector, project, text: () => text, lit: () => lit, color, draw, dispose };
}
