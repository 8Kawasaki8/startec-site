/* Flight: moves the camera from place to place. One GSAP tween of two
   vectors (position and look-at), 1.2 s power2.inOut, interruptible: a new
   flyTo kills the running one (its promise resolves with null). Events on
   window: sts:flight-start {id} and sts:landed {id}. Under
   prefers-reduced-motion a flight is a cut behind a 300 ms fade of the canvas
   (GSAP, so the reduced-motion CSS does not shorten it) and lands in < 400 ms.
   The horizon stays fixed: the camera only ever looks at the look-at point. */
import * as THREE from "../../vendor/three.module.min.js";
import { places } from "./places.js";

export function createFlight({ camera, canvas, reduce, onFrame }) {
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), par = new THREE.Vector3();
  const state = { active: false, id: null, at: null };
  let tween = null, fade = null, resolveCurrent = null;

  function apply() {
    camera.position.copy(pos).add(par);
    camera.lookAt(look);
  }
  function emit(name, id) { window.dispatchEvent(new CustomEvent(name, { detail: { id } })); }
  function jump(id) {
    const pl = places[id]; if (!pl) return;
    pos.set(...pl.p); look.set(...pl.l); state.at = id; apply();
  }
  function kill() {
    if (tween) { tween.kill(); tween = null; }
    if (fade) { fade.kill(); fade = null; }
    if (resolveCurrent) { const r = resolveCurrent; resolveCurrent = null; r(null); }
    state.active = false;
  }
  function land(id, resolve) {
    state.active = false; state.id = null; state.at = id; tween = null; resolveCurrent = null;
    emit("sts:landed", id); resolve(id);
  }

  /* flyTo(id, { duration, ease }) -> Promise<id | null> */
  function flyTo(id, opts = {}) {
    const pl = places[id];
    if (!pl) return Promise.reject(new Error("onbekende plek: " + id));
    kill();
    state.active = true; state.id = id;
    emit("sts:flight-start", id);
    return new Promise(resolve => {
      resolveCurrent = resolve;
      if (reduce) {
        /* cut: fade the canvas out (150 ms), move, land, fade back in */
        fade = gsap.timeline({ onComplete() { fade = null; } });
        fade.to(canvas, { opacity: 0, duration: 0.15, ease: "none" })
          .call(() => { pos.set(...pl.p); look.set(...pl.l); apply(); onFrame(); land(id, resolve); })
          .to(canvas, { opacity: 1, duration: 0.15, ease: "none" });
        return;
      }
      const target = { x: pl.p[0], y: pl.p[1], z: pl.p[2], lx: pl.l[0], ly: pl.l[1], lz: pl.l[2] };
      const cur = { x: pos.x, y: pos.y, z: pos.z, lx: look.x, ly: look.y, lz: look.z };
      tween = gsap.to(cur, {
        ...target, duration: opts.duration || 1.2, ease: opts.ease || "power2.inOut",
        onUpdate() { pos.set(cur.x, cur.y, cur.z); look.set(cur.lx, cur.ly, cur.lz); apply(); },
        onComplete() { land(id, resolve); }
      });
    });
  }

  /* pointer parallax: dx, dy in -0.5..0.5; capped at 2 world units, eased in
     350 ms so it settles inside the 400 ms render window */
  let parTween = null;
  function setParallax(dx, dy) {
    let x = Math.max(-0.5, Math.min(0.5, dx || 0)) * 4, y = Math.max(-0.5, Math.min(0.5, dy || 0)) * -2;
    const m = Math.hypot(x, y); if (m > 2) { x *= 2 / m; y *= 2 / m; }
    if (parTween) parTween.kill();
    parTween = gsap.to(par, { x, y, duration: 0.35, ease: "power2.out", onUpdate: apply, onComplete() { parTween = null; } });
  }

  return { flyTo, jump, kill, apply, setParallax, state, pos, look, par };
}
