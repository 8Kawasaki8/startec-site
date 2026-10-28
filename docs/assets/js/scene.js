/* Night city: the Three.js world behind the site, with the sign on the
   landmark as the subject of the camera. The city reacts to state (sign text,
   sector colour, one place per room), never to scroll position. Frames are
   drawn on demand only.

   PROFILES (the inline loader in src/partials/scene.html decides; same table in README.md)
   | profile | test                              | route                                              |
   | phone   | coarse pointer and width < 900    | no Three.js: inline SVG skyline + #sign-dom        |
   | tablet  | coarse pointer, width >= 900      | Three.js, DPR 1.0, no bloom, rust = 0 frames       |
   | desktop | fine pointer                      | Three.js, DPR min(dpr, 1.5), bloom only after a    |
   |         |                                   | 60-frame probe averages < 14 ms, rust = 0 frames   |
   | lite    | ?lite or localStorage sts-lite=1  | no Three.js (SVG route)                            |
   | weak    | hardwareConcurrency <= 4          | SVG route                                          |
   | failure | no WebGL, module error, context   | SVG route, sts:scene-failed                        |
   |         | lost, or guard() second trap      | (guard: sts:scene-degraded first)                  |

   RENDER STATES: vlucht (full rate while a flight or the intro runs), settle
   (600 ms after landing), rust (zero frames). Sign or sector changes and a
   resize draw one frame; pointer parallax (desktop, 1 unit, off during a
   flight) wakes at most 400 ms.
   The loop also stops when STSScene.cover(f) > 0.6, the canvas leaves the
   viewport or the tab is hidden. guard(): 150 frames averaging > 28 ms drop
   the composer and the DPR; a second such window swaps to the SVG route.

   API: window.STSScene = { lite, profile, flyTo, setSign, signText, setSector,
   cover, setParallax, places, intro, debug: { frames, longTasks, camera(),
   landmarkVisible, bloom, probe, state, signBox(), info() } }. */
import * as THREE from "../vendor/three.module.min.js";
import { EffectComposer } from "../vendor/three-addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/three-addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../vendor/three-addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../vendor/three-addons/postprocessing/OutputPass.js";
import { createCity } from "./scene/city.js";
import { createSky, NIGHT } from "./scene/sky.js";
import { createIntro } from "./scene/intro.js";
import { places } from "./scene/places.js";
import { createFlight } from "./scene/flight.js";
import { ritPose } from "./scene/rit.js";
import { createSign } from "./scene/sign.js";
import { writeSignDom, placeSignDom, shadeSignDom, watchSignShade, countLongTasks } from "./scene/signdom.js";
import { mountDebug } from "./scene/debug.js";

const canvas = document.getElementById("scene");
const params = new URLSearchParams(location.search);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer:coarse)").matches;
const profile = coarse ? "tablet" : "desktop";
const debugOn = params.get("debug") === "1" || document.documentElement.dataset.sceneDebug === "1";
const longTasks = { n: 0 }; countLongTasks(longTasks);
let dead = false;

/* any failure ends in the SVG route, with the sign text carried over */
async function toSvg(reason, text, color) {
  if (dead) return; dead = true;
  const m = await import("./scene/plattegrond.js");
  m.install({ reason, text, color });
}

function boot() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" }); }
  catch (e) { toSvg("fout"); return; }
  let dpr = profile === "tablet" ? 1 : Math.min(devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr); renderer.setClearColor(NIGHT, 1);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1800); scene.add(camera);
  const sky = createSky(scene);
  const city = createCity(scene);
  const sign = createSign(scene, { landmarkUniform: city.sector, onChange: () => wake(0), onState: (lit, c) => { city.signState(lit, c); wake(0); } });
  const flight = createFlight({ camera, canvas, reduce, onFrame: () => wake(0) });
  const clock = new THREE.Clock();

  /* ── render states ───────────────────────────────────────────────────── */
  let raf = 0, wakeUntil = 0, lastNow = 0, frames = 0, state = "rust";
  let covered = 0, offscreen = false, hidden = document.hidden;
  const canRender = () => !dead && !hidden && !offscreen && covered <= 0.6;
  function render(t) {
    const px = 90 * dpr;
    sky.group.position.copy(camera.position); sky.update(t, dpr);
    city.update(t, px);
    if (composer) composer.render(); else renderer.render(scene, camera);
    frames++;
  }
  function tick(now) {
    raf = 0;
    if (!canRender()) { lastNow = 0; return; }
    if (lastNow) measure(now - lastNow); lastNow = now;
    render(clock.getElapsedTime());
    const flying = flight.state.active || (intro && intro.state.active);
    state = flying ? "vlucht" : now < wakeUntil ? "settle" : "rust";
    if (state !== "rust") raf = requestAnimationFrame(tick); else lastNow = 0;
  }
  function wake(ms) {
    wakeUntil = Math.max(wakeUntil, performance.now() + (ms || 0));
    if (!raf && canRender()) raf = requestAnimationFrame(tick);
  }
  /* one frame when the city comes back from under the panels; a cover() call that changes nothing
     (uithangbord.js reports every observer step) costs nothing */
  function cover(f) { const was = covered; covered = Math.max(0, Math.min(1, +f || 0)); if (was > 0.6 && covered <= 0.6) wake(0); }
  document.addEventListener("visibilitychange", () => { hidden = document.hidden; if (!hidden) wake(0); });
  new IntersectionObserver(en => { offscreen = !en[0].isIntersecting; if (!offscreen) wake(0); }).observe(canvas);
  /* a flight wakes the loop at once (flight.js only emits the event); after landing the neon settles for
     600 ms, except under reduced motion where the cut needs exactly one frame */
  addEventListener("sts:flight-start", () => wake(0));
  /* a landing always costs exactly one frame, also while the panels cover more than 60 % of the viewport
     (every landing after gevel on index): the loop stays paused there, so without this direct render the
     canvas would keep the previous landing while #sign-dom already moved to the new place */
  addEventListener("sts:landed", () => {
    document.documentElement.classList.remove("is-rit");
    if (!dead && !hidden && !offscreen && covered > 0.6) render(clock.getElapsedTime());
    wake(reduce ? 0 : 600); placeSign();
  });

  /* ── bloom probe and quality guard ───────────────────────────────────── */
  let composer = null, bloomPass = null, bloom = false;
  const probe = { frames: 0, acc: 0, avgMs: 0, done: false, limitMs: 14 };
  const guard = { frames: 0, acc: 0, stage: 0 };
  function buildComposer() {
    const w = innerWidth, h = innerHeight;
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w * dpr, h * dpr, { type: THREE.HalfFloatType }));
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.45, 0.4, 0.72);
    composer.addPass(bloomPass); composer.addPass(new OutputPass());
    bloom = true;
  }
  function measure(dt) {
    if (dt > 200) return;
    if (!probe.done) {
      probe.acc += dt; probe.avgMs = probe.acc / ++probe.frames;
      if (probe.frames >= 60) { probe.done = true; if (profile === "desktop" && probe.avgMs < probe.limitMs) buildComposer(); }
    }
    guard.acc += dt; guard.frames++;
    if (guard.frames < 150) return;
    const slow = guard.acc / guard.frames > 28; guard.frames = 0; guard.acc = 0;
    if (!slow) return;
    if (guard.stage === 0) { guard.stage = 1; dropComposer(); city.dropMirror(); dpr = 1; renderer.setPixelRatio(1); resize(true); return; }
    guard.stage = 2; degrade("traag");
  }
  /* frees the two HalfFloat targets and the bloom mip chain on the GPU that was just measured as slow */
  function dropComposer() {
    if (composer) composer.dispose();
    if (bloomPass) bloomPass.dispose();
    composer = null; bloomPass = null; bloom = false;
  }
  function degrade(reason) {
    window.dispatchEvent(new CustomEvent("sts:scene-degraded", { detail: { reason } }));
    if (raf) cancelAnimationFrame(raf); raf = 0;
    const text = sign.text(), color = "#" + sign.color.getHexString();
    dropComposer(); sign.dispose(); renderer.dispose();
    toSvg(reason, text, color);
  }
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); degrade("contextlost"); }, { once: true });

  /* ── size: tablets keep the large viewport so the address bar never jumps the city ── */
  const probeEl = document.createElement("div"); probeEl.style.cssText = "position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none"; document.body.appendChild(probeEl);
  let lastW = 0, lastH = 0, resizeTimer = 0;
  function resize(force) {
    const w = innerWidth, h = coarse ? Math.max(innerHeight, probeEl.offsetHeight || 0) : innerHeight;
    if (!force && coarse && w === lastW && Math.abs(h - lastH) < 200) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 64 : 42;   /* portrait (tablet): wider, so the 12-unit sign stays inside the frame */ camera.updateProjectionMatrix();
    if (composer) { composer.setSize(w, h); bloomPass.setSize(w / 2, h / 2); }
    placeSign(); wake(0);
  }
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => resize(false), 200); }, { passive: true });
  resize(true);

  /* ── the sign: DOM text follows the projected plane once per landing ────── */
  function placeSign() { camera.updateMatrixWorld(); const pr = sign.project(camera, innerWidth, innerHeight); placeSignDom(pr.box, sign.text(), pr.visible ? pr.corners : null); shadeSignDom(pr.box); }
  watchSignShade();
  function setSector(color) { if (!color) return; sign.setSector(color); const d = document.getElementById("sign-dom"); if (d) d.style.setProperty("--sign", color); wake(0); }
  /* the plane does not move when its text changes: writeSignDom re-fits the font to the current box;
     placeSign runs on sts:landed and resize, and here only while the sign has not been placed yet */
  function setSign(text, color) { const t = sign.setText(text); writeSignDom(t, color); if (color) setSector(color); const d = document.getElementById("sign-dom"); if (!d || !d.classList.contains("is-placed")) placeSign(); return t; }

  /* ── pointer parallax: desktop only, at most 400 ms of frames ───────────── */
  if (profile === "desktop") {
    let lastMove = 0;
    addEventListener("pointermove", e => {
      const now = performance.now(); if (now - lastMove < 50 || flight.state.active) return; lastMove = now;
      flight.setParallax(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5); wake(400);
    }, { passive: true });
  }

  /* ── intro once per session, otherwise straight to places.start ─────────── */
  const overlay = document.getElementById("intro");
  let pre = null; try { pre = sessionStorage.getItem("sts-pre"); } catch (e) { /* storage blocked */ }
  const intro = overlay && !reduce && !pre ? createIntro({ scene, flight, overlay, onFrame: () => wake(0) }) : null;
  flight.jump("start");
  renderer.compile(scene, camera);
  if (intro) addEventListener("sts:intro-done", () => { flight.jump("start"); wake(600); placeSign(); }, { once: true });
  else if (overlay) overlay.remove();
  placeSign(); wake(0);

  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4();
  const debug = {
    get frames() { return frames; }, get longTasks() { return longTasks.n; },
    camera: () => camera.position.toArray(),
    get landmarkVisible() { camera.updateMatrixWorld(); city.landmark.updateWorldMatrix(true, false); frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); return city.landmark.visible && frustum.intersectsObject(city.landmark); },
    get bloom() { return bloom; }, get probe() { return { ...probe }; }, get state() { return state; }, get profile() { return profile; }, get dpr() { return dpr; }, get guard() { return guard.stage; },
    signBox: () => sign.project(camera, innerWidth, innerHeight).box,
    info: () => renderer.info.render
  };
  /* the scroll ride (scene/rit.js): p = 0 is the gevel framing, so leaving the ride upwards ends exactly
     where the sign was; under reduced motion only the light changes, the camera stays put */
  function ride(p) {
    if (p <= 0 && flight.state.at !== "rit") { city.setLit(1); return; }
    const r = ritPose(p);
    city.setLit(r.lit);
    if (!reduce) {
      /* the crisp DOM twin of the sign belongs to a landing; during the ride only the 3D board shows */
      document.documentElement.classList.toggle("is-rit", p > 0);
      if (flight.state.active) flight.kill();
      flight.par.set(0, 0, 0); flight.pos.copy(r.pos); flight.look.copy(r.look); flight.apply();
      flight.state.at = p <= 0 ? "gevel" : "rit";
    }
    wake(120);
  }
  window.STSScene = {
    lite: false, profile, places, flyTo: id => flight.flyTo(id), setSign, signText: () => sign.text(), setSector, cover, ride,
    setParallax: (x, y) => { if (profile === "desktop") { flight.setParallax(x, y); wake(400); } },
    intro: intro ? { play: cb => intro.play(cb), skip: () => intro.skip(), debug: () => intro.debug() } : null,
    debug
  };
  if (debugOn) mountDebug(window.STSScene, () => ({ profile, state, dpr, probe, guard: guard.stage, at: flight.state.at }));
  /* first frame now; "ready" (and the intro clock) one composited frame later, so the
     browser's first canvas composite (slow on software GL) is not charged to the intro */
  render(clock.getElapsedTime());
  requestAnimationFrame(() => requestAnimationFrame(() => { if (intro) { intro.play(); wake(0); } window.dispatchEvent(new Event("sts:scene-ready")); }));
}

try { boot(); } catch (e) { console.warn("scene: " + (e && e.message)); toSvg("fout"); }
