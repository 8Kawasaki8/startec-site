/* Night city — the 3D world behind the site.
   The intro drives the camera first; afterwards scroll progress (0..1) from
   motion.js does, via window.STSScene.setProgress(). Bloom + tone mapping run
   through an EffectComposer unless the device is weak ("lite"). */
import * as THREE from "../vendor/three.module.min.js";
import { EffectComposer } from "../vendor/three-addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three-addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../vendor/three-addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../vendor/three-addons/postprocessing/OutputPass.js";
import { createCity, glowTex, HERO } from "./scene/city.js";
import { createSky } from "./scene/sky.js";
import { createIntro } from "./scene/intro.js";

const canvas = document.getElementById("scene");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const params = new URLSearchParams(location.search);
let liteStored = null; try { liteStored = localStorage.getItem("sts-lite"); } catch (e) { /* storage blocked */ }
const lite = params.has("lite") || liteStored === "1" || ((navigator.hardwareConcurrency || 8) <= 4) || (matchMedia("(pointer:coarse)").matches && innerWidth < 900);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: lite, powerPreference: "high-performance" });
} catch (e) {
  document.getElementById("scene-fallback")?.removeAttribute("hidden");
  window.dispatchEvent(new Event("sts:scene-failed"));
  throw e;
}
let dpr = Math.min(devicePixelRatio, lite ? 1.25 : 1.5);
renderer.setPixelRatio(dpr);
renderer.setClearColor(0x06080f, 1);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x06080f, 38, 110);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1800);
scene.add(camera);

const sky = createSky(scene, { lite });
const city = createCity(scene, { lite });

/* the three belt stars (Werkwijze) + the light trail through the streets (Lab) */
const beltMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const belt = [[-12, 24, -6], [0, 27, 0], [11, 30, 5]].map(p => { const s = new THREE.Sprite(beltMat.clone()); s.position.set(...p); s.scale.setScalar(0.001); scene.add(s); return s; });
const beacon = new THREE.Sprite(beltMat.clone()); beacon.position.set(0, 9, 0); beacon.scale.setScalar(9); scene.add(beacon);
const path = new THREE.CatmullRomCurve3([[-40, .35, 10], [-22, .35, 10], [-22, .35, -14], [2, .35, -14], [2, .35, 18], [26, .35, 18], [26, .35, -30], [48, .35, -30]].map(p => new THREE.Vector3(...p)));
const trailGeo = new THREE.TubeGeometry(path, 240, 0.11, 6, false);
const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: 0x36e8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
trail.geometry.setDrawRange(0, 0); scene.add(trail);
const head = new THREE.Sprite(beltMat.clone()); head.scale.setScalar(5); head.visible = false; scene.add(head);
const TRAIL_INDEX = trailGeo.index.count;

/* post-processing: bloom makes the windows, lamps and stars actually glow */
let composer = null, bloom = null;
function buildComposer() {
  const w = innerWidth, h = innerHeight;
  const rt = new THREE.WebGLRenderTarget(w * dpr, h * dpr, { type: THREE.HalfFloatType, samples: 2 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.45, 0.4, 0.72);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
if (!lite) buildComposer();

/* camera keyframes over scroll progress (position, look-at) */
const K = [
  { t: 0.00, p: [0, 34, 60], l: [0, 6, 0] },
  { t: 0.16, p: [26, 22, 44], l: [0, 4, 0] },
  { t: 0.33, p: [14, 7, 20], l: [-4, 4, -6] },
  { t: 0.50, p: [-30, 16, 34], l: [0, 2, -4] },
  { t: 0.66, p: [14, 8.5, 2], l: [HERO.x, 5, HERO.z] },
  { t: 0.80, p: [22, 16, 2], l: [HERO.x, 7, HERO.z] },
  { t: 0.90, p: [4, 22, 40], l: [0, 20, -10] },
  { t: 1.00, p: [0, 26, 40], l: [0, 27, 0] }
];
const camPos = new THREE.CatmullRomCurve3(K.map(k => new THREE.Vector3(...k.p)), false, "catmullrom", 0.3);
const camLook = new THREE.CatmullRomCurve3(K.map(k => new THREE.Vector3(...k.l)), false, "catmullrom", 0.3);
function curveT(t) { for (let i = 1; i < K.length; i++) if (t <= K[i].t) { const a = K[i - 1].t, b = K[i].t; return (i - 1 + (t - a) / (b - a)) / (K.length - 1); } return 1; }
const ease = (a, b, t) => Math.min(1, Math.max(0, (t - a) / (b - a)));

/* state */
let progress = 0, target = 0, mx = 0, my = 0, smx = 0, smy = 0, needs = true, visible = true, raf = 0;
const look = new THREE.Vector3(), pos = new THREE.Vector3(), clock = new THREE.Clock();
const overlay = document.getElementById("intro");
const wantIntro = !!overlay && !reduce && !sessionStorage.getItem("sts-pre");
const intro = wantIntro ? createIntro({ scene, camera, overlay }) : null;
if (intro) { intro.state.active = true; camera.position.set(0, 62, 120); camera.lookAt(0, 14, 0); scene.fog.near = 52; scene.fog.far = 260; }

/* On phones the address bar shows and hides constantly; the canvas is sized to
   the large viewport (100lvh) and height-only changes are ignored, so the city
   never jumps while scrolling. */
const coarse = matchMedia("(pointer:coarse)").matches;
const probe = document.createElement("div"); probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none"; document.body.appendChild(probe);
let lastW = 0, lastH = 0;
function resize(force) {
  const w = innerWidth, h = coarse ? Math.max(innerHeight, probe.offsetHeight || 0) : innerHeight;
  if (!force && coarse && w === lastW && Math.abs(h - lastH) < 200) return;
  lastW = w; lastH = h;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 58 : 42; camera.updateProjectionMatrix();
  if (composer) { composer.setSize(w, h); bloom.setSize(w / 2, h / 2); }
  needs = true;
}
addEventListener("resize", () => resize(false)); resize(true);
addEventListener("pointermove", e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; needs = true; }, { passive: true });
document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible && !raf) tick(); });

/* ASCII mirror: a tiny second render read back as text (Onderzoek section) */
let asciiEl = null, asciiRT = null, asciiBuf = null, asciiLast = 0, asciiOn = false;
const RAMP = " .,:;-=+*#%@";
function renderAscii(t) {
  if (!asciiOn || t - asciiLast < 0.16) return; asciiLast = t;
  const W = 96, H = 40;
  if (!asciiRT) { asciiRT = new THREE.WebGLRenderTarget(W, H); asciiBuf = new Uint8Array(W * H * 4); }
  renderer.setRenderTarget(asciiRT); renderer.render(scene, camera); renderer.setRenderTarget(null);
  renderer.readRenderTargetPixels(asciiRT, 0, 0, W, H, asciiBuf);
  let out = "";
  for (let y = H - 1; y >= 0; y--) { for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const l = Math.pow((asciiBuf[i] * 0.3 + asciiBuf[i + 1] * 0.59 + asciiBuf[i + 2] * 0.11) / 255, 0.6); out += RAMP[Math.min(RAMP.length - 1, Math.floor(l * RAMP.length * 1.6))]; } out += "\n"; }
  asciiEl.textContent = out;
}

/* quality guard: after the intro, measure; if the device struggles, drop bloom + mirror */
let samples = 0, acc = 0, guarded = lite;
function guard(dt) {
  if (guarded || (intro && intro.state.active)) return;
  if (dt < 0.2) { acc += dt; samples++; }
  if (samples >= 150) { guarded = true; if (acc / samples > 0.028) degrade(); }
}
function degrade() {
  composer = null; bloom = null; city.dropMirror(); dpr = 1; renderer.setPixelRatio(1); resize(true);
  document.documentElement.classList.add("lite-gpu");
}

function render(t) {
  const px = 90 * dpr, inIntro = intro && intro.state.active;
  if (inIntro) intro.update(t, px);
  else {
    const u = curveT(progress);
    pos.copy(camPos.getPoint(u)); look.copy(camLook.getPoint(u));
    pos.x += smx * 3 + Math.sin(t * 0.37) * 0.25; pos.y += -smy * 1.5 + Math.cos(t * 0.29) * 0.18;
    camera.position.copy(pos); camera.lookAt(look);
  }
  const lit = inIntro ? 0 : ease(0.05, 0.33, progress);
  const rise = ease(0.88, 1, progress), heroGrow = ease(0.66, 0.76, progress), heroSolid = ease(0.77, 0.86, progress);
  sky.group.position.copy(camera.position); sky.update(t, dpr, rise);
  city.update(t, lit, px, heroGrow, heroSolid);
  beacon.scale.setScalar((8 + Math.sin(t * 2) * 1.2) * (1 - ease(0.04, 0.2, progress)) * (inIntro ? intro.state.glide : 1));
  const tr = ease(0.36, 0.62, progress);
  trail.geometry.setDrawRange(0, Math.floor(TRAIL_INDEX * tr));
  head.visible = tr > 0 && tr < 1; if (head.visible) head.position.copy(path.getPoint(tr)).setY(0.9);
  belt.forEach((s, i) => { s.scale.setScalar(0.001 + rise * (10 + i * 2) * (1 + 0.08 * Math.sin(t * 1.6 + i))); s.material.opacity = rise; });
  if (composer) composer.render(); else renderer.render(scene, camera);
  renderAscii(t);
}

let lastT = 0;
function tick() {
  if (!visible) { raf = 0; return; }
  const t = clock.getElapsedTime(), dt = t - lastT; lastT = t;
  progress += (target - progress) * 0.12;
  smx += (mx - smx) * 0.06; smy += (my - smy) * 0.06;
  const moving = Math.abs(target - progress) > 0.0005 || Math.abs(mx - smx) > 0.001 || (intro && intro.state.active);
  if (moving || needs || !reduce) render(t);
  guard(dt);
  needs = false;
  if (!reduce || moving) raf = requestAnimationFrame(tick); else raf = 0;
}
tick();

window.STSScene = {
  lite,
  setProgress(p) { target = Math.min(1, Math.max(0, p)); needs = true; if (!raf) tick(); },
  intro: intro ? { play(cb) { return intro.play(cb); }, skip() { intro.skip(); }, debug() { return intro.debug(); }, seek(t) { intro.seek(t); } } : null,
  ascii(el) { asciiEl = el; return { set(on) { asciiOn = on && !!asciiEl; } }; }
};
window.dispatchEvent(new Event("sts:scene-ready"));
