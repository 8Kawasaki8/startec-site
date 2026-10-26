/* Sky: thousands of stars with colour temperatures and twinkle, a Milky Way
   band, a slow value-noise nebula and a moon. The group follows the camera so
   the sky reads as infinitely far away. The scene fog lives here too (night
   colour, 38..110 units) so the city, sign and sky share one horizon. Nothing
   here depends on page state: the stars only twinkle while frames are drawn. */
import * as THREE from "../../vendor/three.module.min.js";
import { glowTexture } from "./city.js";

let seed = 4242;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 0.8;
const R = 300;

const STAR_VERT = `
  attribute float aSize; attribute vec3 aColor; attribute float aPhase;
  uniform float uTime; uniform float uPx; varying vec3 vC; varying float vA;
  void main(){
    float tw = 0.72 + 0.28*sin(uTime*(1.2+aPhase*2.5) + aPhase*31.0);
    vC = aColor; vA = tw;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPx * (0.85 + 0.15*tw);
    gl_Position = projectionMatrix * mv;
  }`;
const STAR_FRAG = `
  uniform float uAlpha; varying vec3 vC; varying float vA;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.12, d) * vA * uAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vC * (1.0 + 0.8*smoothstep(0.22, 0.0, d)), a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
function starLayer(count, pick, alpha) {
  const pos = [], size = [], col = [], phase = [];
  for (let i = 0; i < count; i++) { const s = pick(); pos.push(...s.p); size.push(s.size); col.push(...s.c); phase.push(rnd()); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aSize", new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute("aColor", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("aPhase", new THREE.Float32BufferAttribute(phase, 1));
  return new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uAlpha: { value: alpha } },
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}
const onSphere = (minY) => { const y = minY + rnd() * (1 - minY), a = rnd() * Math.PI * 2, r = Math.sqrt(1 - y * y); return [Math.cos(a) * r, y, Math.sin(a) * r]; };
const TEMP = [[0.70, 0.82, 1.0], [0.95, 0.96, 1.0], [1.0, 0.93, 0.78], [1.0, 0.78, 0.55]];
const temp = () => { const r = rnd(); return TEMP[r < 0.12 ? 0 : r < 0.57 ? 1 : r < 0.85 ? 2 : 3]; };

/* gradient-mesh nebula: value noise evaluated per vertex, so it costs nothing */
const NEB_VERT = `
  uniform float uTime; uniform vec3 uNight; uniform vec3 uA; uniform vec3 uB; uniform float uGain; varying vec3 vC;
  float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
  float vn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
  void main(){
    vec3 d = normalize(position); float t = uTime*0.015;
    float n1 = vn(d*2.2 + t); n1 = vn(d*2.6 + n1*0.9 - t*0.7);
    float n2 = vn(d*1.7 + 5.3 - t); n2 = vn(d*2.1 + n2*1.1 + t*0.5 + 9.1);
    float up = smoothstep(-0.08, 0.45, d.y);
    vC = uNight + (uA * pow(n1, 2.6) * 0.9 + uB * pow(n2, 2.8) * 0.8) * up * uGain;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const NEB_FRAG = `varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function moonTexture() {
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d");
  const grad = g.createRadialGradient(S * 0.38, S * 0.36, S * 0.05, S * 0.5, S * 0.5, S * 0.5);
  grad.addColorStop(0, "#f4f1e6"); grad.addColorStop(0.75, "#cfc9b4"); grad.addColorStop(1, "#6f6a5a");
  g.fillStyle = grad; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 42; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * S * 0.44, x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr, r = 3 + rnd() * rnd() * 16;
    g.fillStyle = "rgba(90,85,70,0.35)"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,250,235,0.25)"; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.7, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export const NIGHT = 0x06080f;

export function createSky(scene) {
  scene.fog = new THREE.Fog(NIGHT, 38, 110);
  const group = new THREE.Group(); scene.add(group);

  const nebula = new THREE.Mesh(new THREE.SphereGeometry(R + 22, 72, 36), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uNight: { value: new THREE.Color(0x06080f) }, uA: { value: new THREE.Color(0x1aa6c8) }, uB: { value: new THREE.Color(0x5a3fc8) }, uGain: { value: 0.085 } },
    vertexShader: NEB_VERT, fragmentShader: NEB_FRAG, side: THREE.BackSide, depthWrite: false
  }));
  nebula.renderOrder = -10; group.add(nebula);

  const stars = starLayer(5200, () => { const d = onSphere(-0.08); return { p: d.map(v => v * R), size: 1.0 + Math.pow(rnd(), 4) * 4.2, c: temp() }; }, 0.9);
  // Milky Way: points scattered around a tilted great circle, plus soft clouds
  const bn = new THREE.Vector3(0.55, 0.65, -0.52).normalize(), u = new THREE.Vector3(1, 0, 0).cross(bn).normalize(), v = bn.clone().cross(u).normalize();
  const band = (spread) => { const a = rnd() * Math.PI * 2; return u.clone().multiplyScalar(Math.cos(a)).add(v.clone().multiplyScalar(Math.sin(a))).add(bn.clone().multiplyScalar(gauss() * spread)).normalize(); };
  const milky = starLayer(3000, () => { let p = band(0.16); while (p.y < -0.05) p = band(0.16); return { p: [p.x * R, p.y * R, p.z * R], size: 0.7 + rnd() * 1.1, c: [0.78, 0.84, 1.0] }; }, 0.5);
  group.add(stars, milky);
  const cloudTex = glowTexture("rgba(150,170,230,0.35)", "rgba(90,110,200,0)");
  for (let k = 0; k < 9; k++) {
    const p = band(0.05); if (p.y < 0.05) continue;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.05 + rnd() * 0.03, fog: false }));
    s.position.copy(p).multiplyScalar(R - 12); s.scale.set(90 + rnd() * 70, 60 + rnd() * 40, 1); group.add(s);
  }

  const moonDir = new THREE.Vector3(-0.55, 0.40, -0.73).normalize();
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), transparent: true, depthWrite: false, opacity: 0.95, fog: false }));
  moon.position.copy(moonDir).multiplyScalar(R - 20); moon.scale.setScalar(22); group.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(220,225,240,0.5)", "rgba(180,190,230,0)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.1, fog: false }));
  moonGlow.position.copy(moon.position); moonGlow.scale.setScalar(84); group.add(moonGlow);

  function update(t, px) {
    stars.material.uniforms.uTime.value = t; stars.material.uniforms.uPx.value = px;
    milky.material.uniforms.uTime.value = t; milky.material.uniforms.uPx.value = px;
    nebula.material.uniforms.uTime.value = t;
    group.rotation.y = t * 0.003;                               // the whole sky turns, very slowly
  }
  return { group, update };
}
