/* Intro: "STS" made of particles gathers in the night sky above the city, the
   wordmark appears, then the letters release softly while the camera glides
   down to the hero view. Calm by design: no warp, no dive. GSAP timeline;
   skippable; once per session. */
import * as THREE from "../../vendor/three.module.min.js";
import { glowTex } from "./city.js";

let seed = 777;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const P_VERT = `
  attribute vec3 aStart; attribute float aSeed; attribute float aSize;
  uniform float uMorph; uniform float uRelease; uniform float uTime; uniform float uPx; varying float vA;
  void main(){
    vec3 p = mix(aStart, position, uMorph);
    p += 0.22 * vec3(sin(uTime*1.3 + aSeed*20.0), cos(uTime*1.1 + aSeed*13.0), sin(uTime*0.9 + aSeed*7.0));
    float s = fract(aSeed*7.0), s2 = fract(aSeed*13.0);
    p += uRelease * vec3((aSeed-0.5)*5.0, 1.5 + s*4.0, (s2-0.5)*5.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uPx / max(1.0, -mv.z);
    gl_Position = projectionMatrix * mv;
    vA = (0.5 + 0.5*s2) * smoothstep(0.0, 0.25, uMorph) * (1.0 - smoothstep(0.0, 0.7, uRelease));
  }`;
const P_FRAG = `
  uniform sampler2D uMap; uniform float uAlpha; varying float vA;
  void main(){ vec4 t = texture2D(uMap, gl_PointCoord); float a = t.a * vA * uAlpha; if (a < 0.01) discard; gl_FragColor = vec4(t.rgb, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

async function sampleLetters(text, width) {
  try { await Promise.race([document.fonts.load("700 230px 'Clash Display'"), new Promise(r => setTimeout(r, 1500))]); } catch (e) { /* system font fallback */ }
  const W = 1024, H = 360, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#fff"; g.font = "700 250px 'Clash Display', 'Unbounded', system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  if ("letterSpacing" in g) g.letterSpacing = "14px";
  g.fillText(text, W / 2, H / 2 + 10);
  const d = g.getImageData(0, 0, W, H).data, pts = [], k = width / W;
  for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) if (d[(y * W + x) * 4 + 3] > 110) pts.push((x - W / 2) * k + (rnd() - 0.5) * 0.15, (H / 2 - y) * k + (rnd() - 0.5) * 0.15, (rnd() - 0.5) * 1.2);
  return pts;
}

export function createIntro({ scene, camera, overlay }) {
  const state = { veil: 1, morph: 0, release: 0, glide: 0, active: false, done: false };
  const START = new THREE.Vector3(0, 62, 120), K0 = new THREE.Vector3(0, 34, 60);
  const path = new THREE.CatmullRomCurve3([START, new THREE.Vector3(1, 48, 90), K0], false, "catmullrom", 0.3);
  const lookA = new THREE.Vector3(0, 14, 0), lookB = new THREE.Vector3(0, 6, 0), look = new THREE.Vector3();

  const letters = new THREE.Group(); letters.position.set(0, 49.9, 71); letters.lookAt(START); letters.visible = false; scene.add(letters);
  let points = null;
  async function build() {
    const width = innerWidth / innerHeight < 1 ? 22 : 38;
    const target = await sampleLetters("STS", width), n = target.length / 3, start = new Float32Array(target.length), seeds = new Float32Array(n), sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, b = Math.acos(rnd() * 2 - 1), r = 18 + rnd() * 70;
      start.set([Math.sin(b) * Math.cos(a) * r, Math.sin(b) * Math.sin(a) * r, Math.cos(b) * r * 0.5 - 20], i * 3);
      seeds[i] = rnd(); sizes[i] = 2.0 + rnd() * 2.4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(target, 3));
    g.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    points = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uMorph: { value: 0 }, uRelease: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 }, uMap: { value: glowTex }, uAlpha: { value: 0.5 } },
      vertexShader: P_VERT, fragmentShader: P_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    letters.add(points);
  }

  const el = s => overlay && overlay.querySelector(s);
  const veil = el(".veil"), lock = el(".intro-lock"), hint = el(".intro-hint"), bar = el(".bar");
  let tl = null, onDone = null;

  function update(t, px) {
    if (!state.active) return;
    const d = state.glide;
    camera.position.copy(path.getPoint(d));
    look.copy(lookA).lerp(lookB, d); camera.lookAt(look);
    if (scene.fog) { scene.fog.near = 52 - 14 * d; scene.fog.far = 260 - 150 * d; }
    if (points) { const u = points.material.uniforms; u.uMorph.value = state.morph; u.uRelease.value = state.release; u.uTime.value = t; u.uPx.value = px; }
    letters.rotation.y = Math.sin(t * 0.35) * 0.05; letters.rotation.x = Math.cos(t * 0.3) * 0.03;
    if (veil) veil.style.opacity = state.veil;
  }

  async function play(cb) {
    onDone = cb; state.active = true;
    await build(); letters.visible = true;
    tl = gsap.timeline({ onComplete: finish });
    tl.to(state, { veil: 0, duration: 1.1, ease: "power2.out" }, 0)
      .to(state, { morph: 1, duration: 1.9, ease: "power3.inOut" }, 0.2)
      .to(state, { release: 1, duration: 1.6, ease: "power2.inOut" }, 2.6)
      .to(state, { glide: 1, duration: 2.1, ease: "power2.inOut" }, 2.7);
    if (lock) tl.fromTo(lock, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 1.1).to(lock, { opacity: 0, y: -8, duration: 0.6, ease: "power2.in" }, 2.7);
    if (hint) tl.fromTo(hint, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.8).to(hint, { opacity: 0, duration: 0.3 }, 3.9);
    if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 4.7, ease: "none" }, 0.1);
  }
  function finish() {
    state.active = false; state.done = true;
    if (scene.fog) { scene.fog.near = 38; scene.fog.far = 110; }
    letters.visible = false;
    if (points) { points.geometry.dispose(); points.material.dispose(); }
    scene.remove(letters);
    if (onDone) onDone();
  }
  function skip() { if (tl && state.active && tl.progress() < 0.97) tl.timeScale(3); }
  function seek(t) { if (!tl) return; if (t < 0) { tl.play(); return; } tl.pause(); tl.seek(t, false); }
  function debug() { return { active: state.active, done: state.done, morph: +state.morph.toFixed(3), release: +state.release.toFixed(3), glide: +state.glide.toFixed(3), tl: tl ? +tl.progress().toFixed(3) : null, scale: tl ? tl.timeScale() : null, points: points ? points.geometry.attributes.position.count : 0, cam: camera.position.toArray().map(v => Math.round(v)) }; }
  return { play, skip, update, state, debug, seek };
}
