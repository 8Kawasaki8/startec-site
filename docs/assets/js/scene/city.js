/* City: instanced towers with tiers and spires, lit windows in mixed colour
   temperatures, neon trims on the tall ones, street lamps, traffic, a mirrored
   reflection in the wet ground, and the landmark: one solid tower under the
   sign, visible from the first frame, with one emissive uniform (uSector)
   that takes the visitor's sector colour. The city is always lit; nothing in
   it follows the scroll position or any page state. One draw call per layer. */
import * as THREE from "../../vendor/three.module.min.js";
import { HERO } from "./places.js";
export { HERO };

let seed = 1337;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const N = 24, STEP = 4;

export function glowTexture(inner, outer) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.22, inner); r.addColorStop(1, outer);
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const glowTex = glowTexture("rgba(170,240,255,0.9)", "rgba(54,232,255,0)");

/* ── tower shader (instanced city, its mirror, and the landmark) ─────────── */
const VERT = `
  attribute float aSeed; attribute float aH; attribute float aKind; attribute float aLand;
  varying vec3 vN; varying vec3 vW; varying vec3 vL; varying float vSeed; varying float vH; varying float vKind; varying float vLand;
  #include <fog_pars_vertex>
  void main(){
    vSeed = aSeed; vH = aH; vKind = aKind; vLand = aLand; vL = position;
    mat4 im = mat4(1.0);
    #ifdef USE_INSTANCING
      im = instanceMatrix;
    #endif
    mat4 mm = modelMatrix * im;
    vN = normalize(mat3(mm) * normal);
    vec4 wp = mm * vec4(position, 1.0); vW = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FRAG = `
  uniform float uTime; uniform vec3 uCyan; uniform vec3 uViolet; uniform vec3 uBase; uniform float uMirror; uniform float uAlpha; uniform vec3 uSector; uniform float uHero;
  varying vec3 vN; varying vec3 vW; varying vec3 vL; varying float vSeed; varying float vH; varying float vKind; varying float vLand;
  #include <fog_pars_fragment>
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    vec3 n = normalize(vN);
    float side = 1.0 - abs(n.y);
    float ao = 0.45 + 0.55*smoothstep(0.0, 0.4, vL.y);
    float sky = 0.55 + 0.45*max(0.0, dot(n, normalize(vec3(0.3,0.8,0.5))));
    vec3 col = uBase * sky * ao;
    vec3 em = vec3(0.0);
    if (vKind < 1.5) {
      vec2 uv = abs(n.x) > 0.5 ? vL.zy : vL.xy;
      float cols = floor(3.0 + vSeed*4.0);
      vec2 cell = vec2((uv.x+0.5)*cols, uv.y*vH*2.4);
      vec2 f = fract(cell);
      float pane = step(0.28,f.x)*step(f.x,0.72)*step(0.30,f.y)*step(f.y,0.78);
      vec2 id2 = floor(cell) + vSeed*53.0 + vKind*7.0;
      float id = hash(id2), b = hash(id2+1.7), tc = hash(id2+3.1);
      float on = step(0.56, id);
      vec3 wc = tc < 0.55 ? mix(vec3(0.75,0.93,1.0), uCyan, 0.55) : (tc < 0.86 ? vec3(1.0,0.62,0.30) : uViolet);
      float flick = 0.82 + 0.18*sin(uTime*0.5 + id*40.0);
      float tv = step(0.975, id) * (0.5 + 0.5*step(0.5, fract(uTime*2.3 + b*5.0)));
      em += pane*on*(0.45+0.7*b)*flick*wc*side*(1.0+tv);
      float sign = vLand * step(0.5, n.x) * step(0.1,uv.x+0.5)*step(uv.x+0.5,0.9) * step(0.42,uv.y)*step(uv.y,0.6);
      float stripe = 0.5+0.5*sin(uTime*1.4 + (uv.x+0.5)*12.0 - uv.y*30.0);
      vec3 neon = mix(mix(uCyan, uViolet, stripe), uSector, uHero);
      em += sign * neon * (0.6 + 0.5*stripe) * 1.4;
      em += vLand * side * step(0.975, vL.y) * mix(uCyan, uSector, uHero) * 1.6;
      em += uHero * side * step(0.90, vL.y) * step(vL.y, 0.93) * uSector * 1.2;
    }
    em += (1.0-side) * 0.035 * uCyan;
    float edge = smoothstep(0.975,1.0,max(abs(vL.x*2.0),abs(vL.z*2.0)))*side;
    em += edge * uCyan * 0.12;                       // tints the whole side face: the teal body of every tower
    float mirrorFade = uMirror < 0.99 ? clamp(1.0 + vW.y*0.09, 0.0, 1.0) : 1.0;
    col = col * (0.4 + 0.6*uMirror) + em * uMirror * mirrorFade;
    gl_FragColor = vec4(col, uAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
function towerMaterial(extra) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uCyan: { value: new THREE.Color(0x36e8ff) }, uViolet: { value: new THREE.Color(0x8a6bff) },
      uBase: { value: new THREE.Color(0x0c1222) }, uMirror: { value: 1 }, uAlpha: { value: 1 }, uSector: { value: new THREE.Color(0x36e8ff) }, uHero: { value: 0 } }]),
    vertexShader: VERT, fragmentShader: FRAG, fog: true, ...extra
  });
}

/* ── point layers: lamps (mode 0), traffic (1), warning lights (2) ──────── */
const PT_VERT = `
  attribute float aSize; attribute vec3 aColor; attribute vec3 aDir; attribute float aLen; attribute float aSpeed; attribute float aPhase;
  uniform float uPx; uniform float uTime; uniform float uMode; varying vec3 vC; varying float vA;
  #include <fog_pars_vertex>
  void main(){
    vec3 p = position;
    if (uMode > 0.5 && uMode < 1.5) p += aDir * mod(aPhase + uTime*aSpeed, aLen);
    vA = uMode > 1.5 ? step(0.93, sin(uTime*1.7 + aPhase)) : 1.0;
    vC = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uPx / max(1.0, -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const PT_FRAG = `
  uniform float uAlpha; varying vec3 vC; varying float vA;
  #include <fog_pars_fragment>
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * uAlpha * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vC * (0.6 + 1.2*smoothstep(0.35,0.0,d)), a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
function pointLayer(d, mode, alpha) {
  const n = d.pos.length / 3, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(d.pos, 3));
  g.setAttribute("aSize", new THREE.Float32BufferAttribute(d.size, 1));
  g.setAttribute("aColor", new THREE.Float32BufferAttribute(d.col, 3));
  g.setAttribute("aDir", new THREE.Float32BufferAttribute(d.dir || new Array(n * 3).fill(0), 3));
  g.setAttribute("aLen", new THREE.Float32BufferAttribute(d.len || new Array(n).fill(1), 1));
  g.setAttribute("aSpeed", new THREE.Float32BufferAttribute(d.speed || new Array(n).fill(0), 1));
  g.setAttribute("aPhase", new THREE.Float32BufferAttribute(d.phase || new Array(n).fill(0), 1));
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uPx: { value: 90 }, uTime: { value: 0 }, uMode: { value: mode }, uAlpha: { value: alpha } }]),
    vertexShader: PT_VERT, fragmentShader: PT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true
  });
  return new THREE.Points(g, m);
}

export function createCity(scene) {
  const group = new THREE.Group(); scene.add(group);
  const isStreetX = i => i % 4 === 1, isStreetZ = j => j % 5 === 2;

  /* ground: wet asphalt (semi-transparent so the mirror shows) + blueprint grid */
  const gridMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x36e8ff) }, uDark: { value: new THREE.Color(0x0a1220) } },
    vertexShader: `varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vP,1.); }`,
    fragmentShader: `uniform vec3 uColor; uniform vec3 uDark; varying vec3 vP;
      void main(){
        vec2 g = abs(fract(vP.xz/4.0-0.5)-0.5)/fwidth(vP.xz/4.0);
        float line = 1.0-min(min(g.x,g.y),1.0);
        float d = length(vP.xz);
        float a = line*0.16*(1.0-smoothstep(28.0,80.0,d));
        gl_FragColor = vec4(mix(uDark,uColor,0.65), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), gridMat); grid.rotation.x = -Math.PI / 2; grid.position.y = 0.01; group.add(grid);
  const base = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ color: 0x05070d, transparent: true, opacity: 0.74, fog: true }));
  base.rotation.x = -Math.PI / 2; base.position.y = -0.02; base.renderOrder = 1; group.add(base);

  /* plots */
  const cells = [], lamps = { pos: [], size: [], col: [] }, warn = { pos: [], size: [], col: [], phase: [] };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = (i - N / 2 + 0.5) * STEP, z = (j - N / 2 + 0.5) * STEP;
    if (isStreetX(i) || isStreetZ(j)) continue;
    if (Math.abs(x - HERO.x) < 4.5 && Math.abs(z - HERO.z) < 4.5) continue;   // room for the landmark
    if (rnd() < 0.04) continue;                                                 // a few empty plots
    const d = Math.hypot(x, z) / (N * STEP * 0.5);
    const h = 1.2 + rnd() * 2.6 + (1 - d) * (rnd() < 0.11 ? 13 : 4.5) * rnd();
    const w = 2.1 + rnd() * 1.3, s = rnd(), land = h > 9.5 ? 1 : 0;
    cells.push({ x, z, y: 0, h, w, s, kind: 0, land });
    if (h > 5 && rnd() < 0.62) {
      const th = h * 0.28 + rnd() * 2, tw = w * (0.5 + rnd() * 0.25);
      cells.push({ x: x + (rnd() - 0.5) * (w - tw) * 0.6, z: z + (rnd() - 0.5) * (w - tw) * 0.6, y: h, h: th, w: tw, s: rnd(), kind: 1, land: 0 });
      if (h > 10 && rnd() < 0.75) {
        const sh = 2 + rnd() * 2.5;
        cells.push({ x, z, y: h + th, h: sh, w: 0.28, s: rnd(), kind: 2, land: 0 });
        warn.pos.push(x, h + th + sh + 0.1, z); warn.size.push(3.5); warn.col.push(1, 0.12, 0.08); warn.phase.push(rnd() * 6.28);
      }
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mat = towerMaterial();
  const city = new THREE.InstancedMesh(geo, mat, cells.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const aS = new Float32Array(cells.length), aH = new Float32Array(cells.length), aK = new Float32Array(cells.length), aL = new Float32Array(cells.length);
  cells.forEach((c, k) => { m.compose(new THREE.Vector3(c.x, c.y, c.z), q, new THREE.Vector3(c.w, c.h, c.w)); city.setMatrixAt(k, m); aS[k] = c.s; aH[k] = c.h; aK[k] = c.kind; aL[k] = c.land; });
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(aS, 1));
  geo.setAttribute("aH", new THREE.InstancedBufferAttribute(aH, 1));
  geo.setAttribute("aKind", new THREE.InstancedBufferAttribute(aK, 1));
  geo.setAttribute("aLand", new THREE.InstancedBufferAttribute(aL, 1));
  group.add(city);

  /* the reflection: the same instances flipped under the ground */
  let mirror = null;
  {
    const mm = towerMaterial({ side: THREE.DoubleSide }); mm.uniforms.uMirror.value = 0.32;
    mirror = new THREE.InstancedMesh(geo, mm, cells.length); mirror.instanceMatrix = city.instanceMatrix;
    mirror.scale.y = -1; mirror.renderOrder = 0; group.add(mirror);
  }

  /* street lamps + traffic lanes */
  const traffic = { pos: [], size: [], col: [], dir: [], len: [], speed: [], phase: [] };
  const span = N * STEP / 2;
  const car = (p, dir, red) => { traffic.pos.push(...p); traffic.dir.push(...dir); traffic.len.push(span * 2); traffic.speed.push(5 + rnd() * 7); traffic.phase.push(rnd() * span * 2); traffic.size.push(2.4); traffic.col.push(red ? 1 : 0.95, red ? 0.1 : 0.95, red ? 0.08 : 1); };
  for (let i = 0; i < N; i++) if (isStreetX(i)) {
    const x = (i - N / 2 + 0.5) * STEP;
    for (let z = -span; z <= span; z += 5) { const side = (z / 5) % 2 ? 1.5 : -1.5; lamps.pos.push(x + side, 1.6, z); lamps.size.push(2.2); lamps.col.push(1, 0.84, 0.6); }
    for (let k = 0; k < 7; k++) { const dir = k % 2 ? 1 : -1; car([x + dir * 0.8, 0.35, -span * dir], [0, 0, dir], dir > 0); }
  }
  for (let j = 0; j < N; j++) if (isStreetZ(j)) {
    const z = (j - N / 2 + 0.5) * STEP;
    for (let x = -span; x <= span; x += 5) { const side = (x / 5) % 2 ? 1.5 : -1.5; lamps.pos.push(x, 1.6, z + side); lamps.size.push(2.2); lamps.col.push(1, 0.84, 0.6); }
    for (let k = 0; k < 7; k++) { const dir = k % 2 ? 1 : -1; car([-span * dir, 0.35, z + dir * 0.8], [dir, 0, 0], dir < 0); }
  }
  const lampPts = pointLayer(lamps, 0, 0.9), carPts = pointLayer(traffic, 1, 0.85), warnPts = pointLayer(warn, 2, 1);
  group.add(lampPts, carPts, warnPts);

  /* light pollution dome on the horizon */
  const dome = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(54,160,220,0.25)", "rgba(20,60,120,0)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.15, fog: false }));
  dome.scale.set(300, 70, 1); dome.position.set(0, 8, -46); group.add(dome);

  /* the landmark: solid from the first frame; uSector is its emissive colour */
  const heroMat = towerMaterial(); heroMat.uniforms.uHero.value = 1;
  const heroGeo = geo.clone();
  ["aSeed", "aH", "aKind", "aLand"].forEach(n => heroGeo.deleteAttribute(n));
  const nv = heroGeo.attributes.position.count;
  heroGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(new Float32Array(nv).fill(0.31), 1));
  heroGeo.setAttribute("aH", new THREE.Float32BufferAttribute(new Float32Array(nv).fill(HERO.h), 1));
  heroGeo.setAttribute("aKind", new THREE.Float32BufferAttribute(new Float32Array(nv).fill(0), 1));
  heroGeo.setAttribute("aLand", new THREE.Float32BufferAttribute(new Float32Array(nv).fill(1), 1));
  const hero = new THREE.Mesh(heroGeo, heroMat); hero.position.set(HERO.x, 0, HERO.z); hero.scale.set(HERO.w, HERO.h, HERO.w); hero.visible = true; group.add(hero);
  /* the annex: three static boxes around the landmark (a low wing, a setback tower, a plant room on the
     roof) in one instanced draw with the landmark's material, 36 triangles; they sit inside the cleared plot
     (4.5 units around HERO), away from the street at z = 2; the plant room stands behind the board */
  const annexGeo = geo.clone();
  ["aSeed", "aH", "aKind", "aLand"].forEach(n => annexGeo.deleteAttribute(n));
  const ANNEX = [
    { x: HERO.x - 3.4, z: HERO.z + 0.8, w: 2.2, h: 6.2, s: 0.57 },
    { x: HERO.x + 3.6, z: HERO.z - 0.6, w: 2.0, h: 10.2, s: 0.83 },
    { x: HERO.x + 1.1, z: HERO.z - 1.8, w: 1.4, h: HERO.h + 0.6, s: 0.12 }
  ];
  const annex = new THREE.InstancedMesh(annexGeo, heroMat, ANNEX.length);
  ANNEX.forEach((b, k) => { m.compose(new THREE.Vector3(b.x, 0, b.z), q, new THREE.Vector3(b.w, b.h, b.w)); annex.setMatrixAt(k, m); });
  annexGeo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(ANNEX.map(b => b.s)), 1));
  annexGeo.setAttribute("aH", new THREE.InstancedBufferAttribute(new Float32Array(ANNEX.map(b => b.h)), 1));
  annexGeo.setAttribute("aKind", new THREE.InstancedBufferAttribute(new Float32Array(ANNEX.length).fill(0), 1));
  annexGeo.setAttribute("aLand", new THREE.InstancedBufferAttribute(new Float32Array(ANNEX.length).fill(1), 1));
  annex.frustumCulled = false; group.add(annex);
  /* the roof under the sign: a warm reflection, one static additive plane (no light); faint while the sign is
     unlit, warmer and tinted by the sector colour once a name is on the board (signState from sign.js) */
  const roofTex = glowTexture("rgba(255,214,160,0.8)", "rgba(255,176,96,0)");
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(HERO.w * 1.3, HERO.w * 1.3), new THREE.MeshBasicMaterial({ map: roofTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.22, fog: true, toneMapped: false }));
  roof.rotation.x = -Math.PI / 2; roof.position.set(HERO.x, HERO.h + 0.04, HERO.z); roof.renderOrder = 2; group.add(roof);
  const WARM = new THREE.Color(0xffd6a0);
  function signState(lit, color) {
    roof.material.opacity = lit ? 0.55 : 0.22;
    roof.material.color.copy(WARM); if (color) roof.material.color.lerp(color, lit ? 0.45 : 0.25);
  }
  signState(false, null);

  function update(t, px) {
    mat.uniforms.uTime.value = t; heroMat.uniforms.uTime.value = t;
    if (mirror) mirror.material.uniforms.uTime.value = t;
    for (const p of [lampPts, carPts, warnPts]) { p.material.uniforms.uTime.value = t; p.material.uniforms.uPx.value = px; }
  }
  function dropMirror() { if (mirror) { group.remove(mirror); mirror = null; base.material.transparent = false; base.material.opacity = 1; base.material.needsUpdate = true; } }
  return { group, update, dropMirror, signState, count: cells.length, landmark: hero, annex, roof, sector: heroMat.uniforms.uSector };
}
