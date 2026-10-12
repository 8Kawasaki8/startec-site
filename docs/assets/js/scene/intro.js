/* Intro: "STS" made of thousands of particles floats in deep space, drifts up
   to the viewer, bursts, and the camera dives through warp streaks down into
   the city. Driven by a GSAP timeline; skippable; once per session. */
import * as THREE from "../../vendor/three.module.min.js";
import { glowTex } from "./city.js";

let seed = 777;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const P_VERT = `
  attribute vec3 aStart; attribute float aSeed; attribute float aSize;
  uniform float uMorph; uniform float uBurst; uniform float uTime; uniform float uPx; varying float vA;
  void main(){
    vec3 p = mix(aStart, position, uMorph);
    p += 0.3 * vec3(sin(uTime*1.3 + aSeed*20.0), cos(uTime*1.1 + aSeed*13.0), sin(uTime*0.9 + aSeed*7.0));
    float s = fract(aSeed*7.0), s2 = fract(aSeed*13.0);
    p += uBurst * vec3((aSeed-0.5)*70.0, (s-0.5)*70.0, 40.0 + 300.0*s2);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uPx / max(1.0, -mv.z) * (1.0 + uBurst*1.5);
    gl_Position = projectionMatrix * mv;
    vA = (0.5 + 0.5*s2) * (1.0 - smoothstep(0.6, 1.0, uBurst)) * smoothstep(0.0, 0.25, uMorph);
  }`;
const P_FRAG = `
  uniform sampler2D uMap; uniform float uAlpha; varying float vA;
  void main(){ vec4 t = texture2D(uMap, gl_PointCoord); float a = t.a * vA * uAlpha; if (a < 0.01) discard; gl_FragColor = vec4(t.rgb, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const W_VERT = `
  attribute float aEnd; attribute float aSeed; uniform float uTime; uniform float uWarp; varying float vA;
  void main(){
    vec3 p = position;
    float z = mod(p.z + uTime*(50.0 + 160.0*uWarp)*(0.5+aSeed), 240.0) - 240.0;
    p.z = z + aEnd * (1.5 + 30.0*uWarp);
    vA = uWarp * (0.25 + 0.75*aSeed) * smoothstep(-240.0, -170.0, z) * smoothstep(0.0, -6.0, z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const W_FRAG = `uniform vec3 uColor; varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(uColor, vA);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

async function sampleLetters(text) {
  try { await Promise.race([document.fonts.load("800 230px 'Unbounded'"), new Promise(r => setTimeout(r, 1500))]); } catch (e) { /* system font fallback */ }
  const W = 1024, H = 360, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#fff"; g.font = "800 230px 'Unbounded', system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  if ("letterSpacing" in g) g.letterSpacing = "22px";
  g.fillText(text, W / 2, H / 2 + 8);
  const d = g.getImageData(0, 0, W, H).data, pts = [], k = 66 / W;
  for (let y = 0; y < H; y += 5) for (let x = 0; x < W; x += 5) if (d[(y * W + x) * 4 + 3] > 110) pts.push((x - W / 2) * k + (rnd() - 0.5) * 0.25, (H / 2 - y) * k + (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 2.2);
  return pts;
}

export function createIntro({ scene, camera, overlay }) {
  const state = { veil: 1, morph: 0, burst: 0, dive: 0, alpha: 1, active: false, done: false };
  const START = new THREE.Vector3(0, 130, 430), K0 = new THREE.Vector3(0, 34, 60);
  const path = new THREE.CatmullRomCurve3([START, new THREE.Vector3(8, 102, 300), new THREE.Vector3(-10, 62, 150), K0], false, "catmullrom", 0.25);
  const lookA = new THREE.Vector3(0, 72, 0), lookB = new THREE.Vector3(0, 6, 0), look = new THREE.Vector3();

  const letters = new THREE.Group(); letters.position.set(0, 118, 300); letters.lookAt(START); letters.visible = false; scene.add(letters);
  let points = null;
  async function build() {
    const target = await sampleLetters("STS"), n = target.length / 3, start = new Float32Array(target.length), seeds = new Float32Array(n), sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, b = Math.acos(rnd() * 2 - 1), r = 40 + rnd() * 160;
      start.set([Math.sin(b) * Math.cos(a) * r, Math.sin(b) * Math.sin(a) * r, Math.cos(b) * r * 0.6 - 60], i * 3);
      seeds[i] = rnd(); sizes[i] = 4 + rnd() * 7;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(target, 3));
    g.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    points = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uMorph: { value: 0 }, uBurst: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 }, uMap: { value: glowTex }, uAlpha: { value: 0.55 } },
      vertexShader: P_VERT, fragmentShader: P_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    letters.add(points);
  }

  /* warp streaks live in camera space */
  const wn = 360, wp = [], we = [], ws = [];
  for (let i = 0; i < wn; i++) { const a = rnd() * Math.PI * 2, r = 3 + Math.pow(rnd(), 0.7) * 34, z = -(10 + rnd() * 230), s = rnd(); wp.push(Math.cos(a) * r, Math.sin(a) * r, z, Math.cos(a) * r, Math.sin(a) * r, z); we.push(0, 1); ws.push(s, s); }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute("position", new THREE.Float32BufferAttribute(wp, 3)); wg.setAttribute("aEnd", new THREE.Float32BufferAttribute(we, 1)); wg.setAttribute("aSeed", new THREE.Float32BufferAttribute(ws, 1));
  const warp = new THREE.LineSegments(wg, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uWarp: { value: 0 }, uColor: { value: new THREE.Color(0x9ff2ff) } }, vertexShader: W_VERT, fragmentShader: W_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  warp.frustumCulled = false; warp.visible = false; camera.add(warp);

  const el = s => overlay && overlay.querySelector(s);
  const veil = el(".veil"), lock = el(".intro-lock"), hint = el(".intro-hint"), bar = el(".bar");
  let tl = null, onDone = null;

  function update(t, px) {
    if (!state.active) return;
    const d = state.dive;
    camera.position.copy(path.getPoint(d));
    look.copy(lookA).lerp(lookB, d); camera.lookAt(look);
    if (scene.fog) { scene.fog.near = 260 - 222 * d; scene.fog.far = 1500 - 1390 * d; }
    if (points) { const u = points.material.uniforms; u.uMorph.value = state.morph; u.uBurst.value = state.burst; u.uTime.value = t; u.uPx.value = px; u.uAlpha.value = state.alpha; }
    letters.rotation.y = Math.sin(t * 0.4) * 0.08; letters.rotation.x = Math.cos(t * 0.3) * 0.05;
    warp.material.uniforms.uTime.value = t; warp.material.uniforms.uWarp.value = state.burst;
    warp.visible = state.burst > 0.01;
    if (veil) veil.style.opacity = state.veil;
  }

  async function play(cb) {
    onDone = cb; state.active = true;
    await build(); letters.visible = true;
    tl = gsap.timeline({ onComplete: finish });
    tl.to(state, { veil: 0, duration: 1.0, ease: "power2.out" }, 0)
      .to(state, { morph: 1, duration: 1.8, ease: "power3.inOut" }, 0.2)
      .to(state, { burst: 1, duration: 1.4, ease: "power2.in" }, 2.5)
      .to(state, { dive: 1, duration: 2.3, ease: "power2.inOut" }, 2.55)
      .to(state, { alpha: 0, duration: 0.5 }, 3.7);
    state.alpha = 0.55;
    if (lock) tl.fromTo(lock, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 1.1).to(lock, { opacity: 0, y: -10, duration: 0.5, ease: "power2.in" }, 2.55);
    if (hint) tl.fromTo(hint, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.8).to(hint, { opacity: 0, duration: 0.3 }, 3.6);
    if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 4.6, ease: "none" }, 0.1);
  }
  function finish() {
    state.active = false; state.done = true;
    if (scene.fog) { scene.fog.near = 38; scene.fog.far = 110; }
    letters.visible = false; warp.visible = false; camera.remove(warp);
    if (points) { points.geometry.dispose(); points.material.dispose(); }
    scene.remove(letters);
    if (onDone) onDone();
  }
  function skip() { if (tl && state.active && tl.progress() < 0.97) tl.timeScale(3.2); }
  function seek(t) { if (!tl) return; if (t < 0) { tl.play(); return; } tl.pause(); tl.seek(t, false); }
  function debug() { return { active: state.active, done: state.done, morph: +state.morph.toFixed(3), burst: +state.burst.toFixed(3), dive: +state.dive.toFixed(3), tl: tl ? +tl.progress().toFixed(3) : null, scale: tl ? tl.timeScale() : null, points: points ? points.geometry.attributes.position.count : 0, cam: camera.position.toArray().map(v => Math.round(v)) }; }
  return { play, skip, update, state, debug, seek };
}
