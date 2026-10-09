/* Night city — the 3D scene behind the chapters.
   One instanced draw call for the city, one for the ground grid, one for the
   stars, one for the light trail. Camera + lighting are driven by scroll
   progress (0..1) from motion.js via window.STSScene.setProgress(). */
import * as THREE from "../vendor/three.module.min.js";

const canvas = document.getElementById("scene");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (e) {
  document.getElementById("scene-fallback")?.removeAttribute("hidden");
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setClearColor(0x06080f, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x06080f, 38, 110);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);

/* ── deterministic random ─────────────────────────────────── */
let seed = 1337;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/* ── ground grid (shader plane) ───────────────────────────── */
const groundMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(0x36e8ff) }, uFade: { value: 0 } },
  vertexShader: `varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vP,1.); }`,
  fragmentShader: `uniform vec3 uColor; uniform float uFade; varying vec3 vP;
    void main(){
      vec2 g = abs(fract(vP.xz/4.0-0.5)-0.5)/fwidth(vP.xz/4.0);
      float line = 1.0-min(min(g.x,g.y),1.0);
      float d = length(vP.xz);
      float a = line*0.22*(1.0-smoothstep(28.0,70.0,d));
      gl_FragColor = vec4(mix(vec3(0.03,0.05,0.09),uColor,0.65), a*(0.55+0.45*uFade));
    }`,
  transparent: true, depthWrite: false
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const base = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ color: 0x070a12 }));
base.rotation.x = -Math.PI / 2; base.position.y = -0.02;
scene.add(base);

/* ── city: instanced boxes with a "lit" progression ───────── */
const N = 22, STEP = 4, cells = [];
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const x = (i - N / 2 + 0.5) * STEP, z = (j - N / 2 + 0.5) * STEP;
  if ((i % 4 === 1 && rnd() < 0.85) || (j % 5 === 2 && rnd() < 0.85)) continue;   // streets
  const d = Math.hypot(x, z) / (N * STEP * 0.5);
  const h = 1.2 + rnd() * 2.5 + (1 - d) * (rnd() < 0.12 ? 10 : 4) * rnd();
  cells.push({ x, z, h, w: 2.2 + rnd() * 1.2, seed: rnd() });
}
const cityGeo = new THREE.BoxGeometry(1, 1, 1);
cityGeo.translate(0, 0.5, 0);
const cityMat = new THREE.ShaderMaterial({
  uniforms: { uLit: { value: 0 }, uTime: { value: 0 }, uCyan: { value: new THREE.Color(0x36e8ff) }, uViolet: { value: new THREE.Color(0x8a6bff) } },
  vertexShader: `attribute float aSeed; attribute float aH; varying vec3 vN; varying vec3 vP; varying float vSeed; varying float vH; varying vec3 vLocal;
    void main(){ vSeed=aSeed; vH=aH; vLocal=position; vN = normalize(mat3(instanceMatrix)*normal);
      vec4 wp = instanceMatrix*vec4(position,1.); vP = wp.xyz; gl_Position = projectionMatrix*modelViewMatrix*wp; }`,
  fragmentShader: `uniform float uLit; uniform float uTime; uniform vec3 uCyan; uniform vec3 uViolet;
    varying vec3 vN; varying vec3 vP; varying float vSeed; varying float vH; varying vec3 vLocal;
    void main(){
      vec3 n = normalize(vN);
      float shade = 0.55 + 0.45*max(0.0, dot(n, normalize(vec3(0.4,0.9,0.3))));
      vec3 col = vec3(0.045,0.06,0.10)*shade;
      // windows: a sparse grid on the side walls; most stay dark, like a real night
      float side = 1.0-abs(n.y);
      vec2 uv = n.x!=0.0 ? vLocal.zy : vLocal.xy;
      vec2 cell = uv*vec2(4.0, 3.2*vH);
      vec2 f = fract(cell);
      float pane = step(0.55,f.x)*step(0.5,f.y)*(1.0-step(0.9,f.x))*(1.0-step(0.85,f.y));
      float id = fract(sin(dot(floor(cell)+vSeed*17.0, vec2(12.9898,78.233)))*43758.5453);
      float on = step(0.62, id);                               // ~38% of windows lit
      float lit = smoothstep(vSeed-0.14, vSeed+0.02, uLit);
      float flick = 0.8+0.2*sin(uTime*0.7+id*30.0);
      vec3 glow = mix(uViolet, uCyan, id);
      col += pane*on*lit*glow*0.9*flick*side;
      col += (1.0-side)*lit*glow*0.05;                       // faint roof tint
      float edge = smoothstep(0.985,1.0,max(abs(vLocal.x*2.0),abs(vLocal.z*2.0)))*side;
      col += edge*lit*uCyan*0.14;                              // thin neon edge
      gl_FragColor = vec4(col,1.0);
    }`
});
const city = new THREE.InstancedMesh(cityGeo, cityMat, cells.length);
const m = new THREE.Matrix4(), seeds = new Float32Array(cells.length), hs = new Float32Array(cells.length);
cells.forEach((c, i) => {
  m.compose(new THREE.Vector3(c.x, 0, c.z), new THREE.Quaternion(), new THREE.Vector3(c.w, c.h, c.w));
  city.setMatrixAt(i, m); seeds[i] = c.seed; hs[i] = c.h;
});
cityGeo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
cityGeo.setAttribute("aH", new THREE.InstancedBufferAttribute(hs, 1));
scene.add(city);

/* ── stars + the three belt stars ─────────────────────────── */
function glowTexture(inner) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.18, inner); r.addColorStop(0.5, "rgba(54,232,255,0.18)"); r.addColorStop(1, "rgba(54,232,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const starTex = glowTexture("rgba(143,243,255,0.95)");
const sp = new Float32Array(1800 * 3);
for (let i = 0; i < 1800; i++) { const a = rnd() * Math.PI * 2, r = 40 + rnd() * 120, y = 10 + rnd() * 90; sp.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); }
const starsGeo = new THREE.BufferGeometry(); starsGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ map: starTex, size: 1.1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9, sizeAttenuation: true }));
scene.add(stars);

const beltMat = new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const belt = [[-12, 24, -6], [0, 27, 0], [11, 30, 5]].map(p => { const s = new THREE.Sprite(beltMat.clone()); s.position.set(...p); s.scale.setScalar(0.001); scene.add(s); return s; });
const beacon = new THREE.Sprite(beltMat.clone()); beacon.position.set(0, 9, 0); beacon.scale.setScalar(9); scene.add(beacon);

/* ── light trail through the streets ──────────────────────── */
const path = new THREE.CatmullRomCurve3([[-40, .35, 10], [-22, .35, 10], [-22, .35, -14], [2, .35, -14], [2, .35, 18], [26, .35, 18], [26, .35, -30], [48, .35, -30]].map(p => new THREE.Vector3(...p)));
const trailGeo = new THREE.TubeGeometry(path, 240, 0.11, 6, false);
const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: 0x36e8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
trail.geometry.setDrawRange(0, 0); scene.add(trail);
const head = new THREE.Sprite(beltMat.clone()); head.scale.setScalar(5); head.visible = false; scene.add(head);
const TRAIL_INDEX = trailGeo.index.count;

/* ── camera keyframes (position, look-at) over scroll 0..1 ── */
// progress 0 = hero (above #chapters), 0–.33 oplossingen, .33–.66 lab, .66–1 werkwijze
const K = [
  { t: 0.00, p: [0, 34, 60], l: [0, 6, 0] },     // hero: high, wide
  { t: 0.16, p: [26, 22, 44], l: [0, 4, 0] },     // oplossingen: swing in
  { t: 0.33, p: [14, 7, 20], l: [-4, 4, -6] },    // street level, lights on
  { t: 0.50, p: [-30, 16, 34], l: [0, 2, -4] },   // lab: the trail runs
  { t: 0.72, p: [0, 20, 48], l: [0, 20, -10] },   // rise toward the stars
  { t: 1.00, p: [0, 26, 40], l: [0, 27, 0] }      // the belt
];
const camPos = new THREE.CatmullRomCurve3(K.map(k => new THREE.Vector3(...k.p)), false, "catmullrom", 0.3);
const camLook = new THREE.CatmullRomCurve3(K.map(k => new THREE.Vector3(...k.l)), false, "catmullrom", 0.3);
// map scroll progress onto the curve so keyframe times are honoured
function curveT(t) { for (let i = 1; i < K.length; i++) if (t <= K[i].t) { const a = K[i - 1].t, b = K[i].t; return (i - 1 + (t - a) / (b - a)) / (K.length - 1); } return 1; }
const ease = (a, b, t) => Math.min(1, Math.max(0, (t - a) / (b - a)));

/* ── state + loop ─────────────────────────────────────────── */
let progress = 0, target = 0, mx = 0, my = 0, smx = 0, smy = 0, needs = true, visible = true, raf = 0;
const look = new THREE.Vector3(), pos = new THREE.Vector3(), clock = new THREE.Clock();

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); needs = true;
}
addEventListener("resize", resize); resize();
addEventListener("pointermove", e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; needs = true; }, { passive: true });
document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) tick(); });

function render(t) {
  const u = curveT(progress);
  pos.copy(camPos.getPoint(u)); look.copy(camLook.getPoint(u));
  pos.x += smx * 3; pos.y += -smy * 1.5;
  camera.position.copy(pos); camera.lookAt(look);

  const lit = ease(0.05, 0.33, progress);
  cityMat.uniforms.uLit.value = lit; cityMat.uniforms.uTime.value = t; groundMat.uniforms.uFade.value = lit;
  beacon.scale.setScalar((8 + Math.sin(t * 2) * 1.2) * (1 - ease(0.04, 0.2, progress)));
  const tr = ease(0.36, 0.62, progress);
  trail.geometry.setDrawRange(0, Math.floor(TRAIL_INDEX * tr));
  head.visible = tr > 0 && tr < 1; if (head.visible) head.position.copy(path.getPoint(tr)).setY(0.9);
  const rise = ease(0.68, 1, progress);
  belt.forEach((s, i) => { s.scale.setScalar(0.001 + rise * (10 + i * 2) * (1 + 0.08 * Math.sin(t * 1.6 + i))); s.material.opacity = rise; });
  stars.material.opacity = 0.55 + 0.45 * rise; stars.rotation.y = t * 0.004;
  renderer.render(scene, camera);
}

function tick() {
  if (!visible) return;
  const t = clock.getElapsedTime();
  progress += (target - progress) * 0.12;
  smx += (mx - smx) * 0.06; smy += (my - smy) * 0.06;
  const moving = Math.abs(target - progress) > 0.0005 || Math.abs(mx - smx) > 0.001;
  if (moving || needs || !reduce) render(t);
  needs = false;
  if (!reduce || moving) raf = requestAnimationFrame(tick); else raf = 0;
}
tick();

window.STSScene = {
  setProgress(p) { target = Math.min(1, Math.max(0, p)); needs = true; if (!raf) tick(); }
};
window.dispatchEvent(new Event("sts:scene-ready"));
