/* Flight: moves the camera from place to place. One GSAP tween of two
   vectors (position and look-at), 1.2 s power2.inOut, interruptible: a new
   flyTo kills the running one (its promise resolves with null). The path
   lifts a little at mid-flight (at most 1.5 units, scaled by the distance)
   so a flight reads as a swing past the landmark rather than a slide. Events
   on window: sts:flight-start {id} and sts:landed {id}. Under
   prefers-reduced-motion a flight is a cut behind a 300 ms fade of the canvas
   (GSAP, so the reduced-motion CSS does not shorten it) and lands in < 400 ms.
   The horizon stays fixed: the camera only ever looks at the look-at point.
   Flights run on GSAP's ticker and never read the scroll position, so native
   scroll and a flight never fight. Pointer parallax is a 1-unit offset that
   eases back to zero when a flight starts and is ignored while it runs. */
import * as THREE from "../../vendor/three.module.min.js";
import { places } from "./places.js";

export const PARALLAX_MAX = 1;

export function createFlight({ camera, canvas, reduce, onFrame }) {
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), par = new THREE.Vector3(), lift = new THREE.Vector3();
  const state = { active: false, id: null, at: null };
  let tween = null, fade = null, parTween = null, resolveCurrent = null;

  function apply() {
    camera.position.copy(pos).add(par).add(lift);
    camera.lookAt(look);
  }
  function emit(name, id) { window.dispatchEvent(new CustomEvent(name, { detail: { id } })); }
  function jump(id) {
    const pl = places[id]; if (!pl) return;
    pos.set(...pl.p); look.set(...pl.l); lift.set(0, 0, 0); state.at = id; apply();
  }
  function kill() {
    if (tween) { tween.kill(); tween = null; }
    if (fade) { fade.kill(); fade = null; }
    if (resolveCurrent) { const r = resolveCurrent; resolveCurrent = null; r(null); }
    state.active = false;
  }
  function land(id, resolve) {
    state.active = false; state.id = null; state.at = id; tween = null; resolveCurrent = null; lift.set(0, 0, 0);
    emit("sts:landed", id); resolve(id);
  }
  /* the parallax offset eases out before the camera moves, so a flight never starts with a jump */
  function settleParallax() {
    if (parTween) parTween.kill();
    if (par.lengthSq() < 1e-6) { parTween = null; return; }
    /* onUpdate: apply, so a cut under reduced motion (jump() runs once, mid-ease) still ends at offset zero */
    parTween = gsap.to(par, { x: 0, y: 0, z: 0, duration: 0.3, ease: "power2.out", onUpdate: apply, onComplete() { parTween = null; } });
  }

  /* flyTo(id, { duration, ease }) -> Promise<id | null> */
  function flyTo(id, opts = {}) {
    const pl = places[id];
    if (!pl) return Promise.reject(new Error("onbekende plek: " + id));
    kill();
    state.active = true; state.id = id;
    settleParallax();
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
      const target = { x: pl.p[0], y: pl.p[1], z: pl.p[2], lx: pl.l[0], ly: pl.l[1], lz: pl.l[2], k: 1 };
      const cur = { x: pos.x, y: pos.y, z: pos.z, lx: look.x, ly: look.y, lz: look.z, k: 0 };
      const rise = Math.min(1.5, Math.hypot(target.x - cur.x, target.y - cur.y, target.z - cur.z) * 0.06);
      tween = gsap.to(cur, {
        ...target, duration: opts.duration || 1.2, ease: opts.ease || "power2.inOut",
        onUpdate() { pos.set(cur.x, cur.y, cur.z); look.set(cur.lx, cur.ly, cur.lz); lift.y = Math.sin(cur.k * Math.PI) * rise; apply(); },
        onComplete() { land(id, resolve); }
      });
    });
  }

  /* pointer parallax: dx, dy in -0.5..0.5; capped at 1 world unit, eased in
     350 ms so it settles inside the 400 ms render window; ignored during a flight */
  function setParallax(dx, dy) {
    if (state.active) return;
    let x = Math.max(-0.5, Math.min(0.5, dx || 0)) * 2 * PARALLAX_MAX, y = Math.max(-0.5, Math.min(0.5, dy || 0)) * -PARALLAX_MAX;
    const m = Math.hypot(x, y); if (m > PARALLAX_MAX) { x *= PARALLAX_MAX / m; y *= PARALLAX_MAX / m; }
    if (parTween) parTween.kill();
    parTween = gsap.to(par, { x, y, duration: 0.35, ease: "power2.out", onUpdate: apply, onComplete() { parTween = null; } });
  }

  return { flyTo, jump, kill, apply, setParallax, state, pos, look, par };
}
