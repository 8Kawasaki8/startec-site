/* The sign: one 512x128 CanvasTexture (Panchang) on an emissive plane of
   12 x 3 world units on top of the landmark, facing the start/gevel camera.
   The texture carries the glow (soft, bloom-friendly); the crisp letters are
   the DOM element #sign-dom that scene.js positions with project() once per
   landing. Text wraps on two lines at 16 characters, 40 characters at most,
   and the texture redraws debounced by 120 ms. setSector(color) sets the one
   emissive uniform on the landmark and tints the sign. */
import * as THREE from "../../vendor/three.module.min.js";
import { HERO, places } from "./places.js";
import { wrapSign, cleanSign, SIGN } from "./signdom.js";
export { wrapSign, SIGN };

/* centre of the sign plane in world units */
export const SIGN_POS = { x: HERO.x, y: HERO.h + 2.2, z: HERO.z };

export function createSign(scene, { landmarkUniform, onChange }) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
  const g = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const color = new THREE.Color(0x36e8ff);
  let text = "", timer = 0;

  /* the unlit board: a dark panel with a thin rim, visible before any text */
  const group = new THREE.Group(); group.position.set(SIGN_POS.x, SIGN_POS.y, SIGN_POS.z);
  const face = places.start.p; group.lookAt(face[0], SIGN_POS.y, face[2]);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.w + 0.6, SIGN.h + 0.5), new THREE.MeshBasicMaterial({ color: 0x0b1020, fog: true }));
  board.position.z = -0.08; group.add(board);
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.w + 0.8, SIGN.h + 0.7), new THREE.MeshBasicMaterial({ color: 0x1b2440, fog: true }));
  rim.position.z = -0.12; group.add(rim);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(SIGN.w, SIGN.h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: 0xffffff }));
  group.add(plane); scene.add(group);

  function draw() {
    g.clearRect(0, 0, 512, 128);
    const lines = wrapSign(text);
    if (!lines[0]) { tex.needsUpdate = true; return; }
    const size = lines.length > 1 ? 50 : 62, css = "#" + color.getHexString();
    g.font = "700 " + size + "px 'Panchang', 'Unbounded', system-ui, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    const scale = Math.min(1, 470 / Math.max(...lines.map(l => g.measureText(l).width)));
    g.save(); g.translate(256, 64); g.scale(scale, 1);
    /* only the halo: the crisp letters are the DOM element #sign-dom on top */
    g.shadowColor = css; g.shadowBlur = 30; g.fillStyle = css; g.globalAlpha = 0.9;
    lines.forEach((l, i) => g.fillText(l, 0, lines.length > 1 ? (i - 0.5) * size * 1.08 : 0));
    g.shadowBlur = 10; g.globalAlpha = 0.55;
    lines.forEach((l, i) => g.fillText(l, 0, lines.length > 1 ? (i - 0.5) * size * 1.08 : 0));
    g.restore();
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
    plane.material.color.copy(color).lerp(new THREE.Color(0xffffff), 0.25);
    schedule();
  }
  /* centre and the four corners of the plane in pixels of the given size */
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
  function dispose() { clearTimeout(timer); tex.dispose(); }
  return { group, plane, setText, setSector, project, text: () => text, color, draw, dispose };
}
