/* Intro: at most 1.5 s. The veil lifts, the slogan shows once, a comet crosses
   the sky towards the landmark and the camera settles at places.start. One
   small "Overslaan" button ends it early. Dispatches sts:intro-done, writes
   sessionStorage sts-pre so it plays once per session, and removes the
   overlay. The H1, arrival lines and strip are already in the DOM: the overlay
   is aria-hidden and only covers them visually. No intro under
   prefers-reduced-motion or when sts-pre is set (scene.js decides). */
import * as THREE from "../../vendor/three.module.min.js";
import { glowTex } from "./city.js";
import { HERO, places } from "./places.js";

export const INTRO_MAX = 1.5;      // ceiling: sts:intro-done is dispatched by then, whatever the frame rate
const INTRO_TL = 1.3;              // length of the timeline on a machine that keeps up

export function createIntro({ scene, flight, overlay, onFrame }) {
  const state = { active: false, done: false, t: 0 };
  const veil = overlay.querySelector(".veil"), slogan = overlay.querySelector(".intro-slogan"), skipBtn = overlay.querySelector(".intro-skip");
  let tl = null, onDone = null, playing = null, deadline = 0;

  /* the comet: a glow sprite with a short additive tail, flying towards the sign */
  const comet = new THREE.Group(); comet.visible = false; scene.add(comet);
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 }));
  head.scale.setScalar(2.2); comet.add(head);
  const tail = [];
  for (let i = 1; i <= 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 - i * 0.08 }));
    s.scale.setScalar(1.8 - i * 0.22); comet.add(s); tail.push(s);
  }
  const from = new THREE.Vector3(HERO.x - 34, HERO.h + 26, HERO.z - 30), to = new THREE.Vector3(HERO.x - 1, HERO.h + 4.5, HERO.z + 1), dir = to.clone().sub(from).normalize();
  function placeComet(k) {
    const p = from.clone().lerp(to, k); p.y += Math.sin(k * Math.PI) * 4;
    head.position.copy(p);
    tail.forEach((s, i) => s.position.copy(p).addScaledVector(dir, -(i + 1) * 1.1));
  }

  function play(cb) {
    if (cb) onDone = cb;
    if (playing) return playing;
    state.active = true;
    /* the camera starts a little higher and farther than start, then settles */
    const s = places.start.p;
    flight.pos.set(s[0] + 3, s[1] + 7, s[2] + 11); flight.look.set(...places.start.l); flight.apply();
    const cam = { x: flight.pos.x, y: flight.pos.y, z: flight.pos.z }, c = { k: 0 };
    playing = new Promise(resolve => {
      tl = gsap.timeline({ onComplete() { finish(); resolve(); } });
      /* wall-clock ceiling: a stalled first frame (shader compile) must not stretch the intro */
      deadline = setTimeout(skip, (INTRO_MAX - 0.15) * 1000);
      tl.to(cam, { x: s[0], y: s[1], z: s[2], duration: INTRO_TL, ease: "power2.out", onUpdate() { flight.pos.set(cam.x, cam.y, cam.z); flight.apply(); } }, 0);
      if (veil) tl.to(veil, { opacity: 0, duration: 0.5, ease: "power2.out" }, 0);
      tl.call(() => { comet.visible = true; }, null, 0.2)
        .to(c, { k: 1, duration: 0.8, ease: "power2.in", onUpdate() { placeComet(c.k); } }, 0.2)
        .call(() => { comet.visible = false; }, null, 1.0);
      if (slogan) tl.fromTo(slogan, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 0.1).to(slogan, { opacity: 0, duration: 0.3, ease: "power2.in" }, 0.95);
      if (skipBtn) skipBtn.addEventListener("click", skip, { once: true });
      addEventListener("keydown", onKey);
    });
    return playing;
  }
  function finish() {
    if (state.done) return;
    state.active = false; state.done = true; clearTimeout(deadline); removeEventListener("keydown", onKey);
    try { sessionStorage.setItem("sts-pre", "1"); } catch (e) { /* storage blocked */ }
    comet.visible = false; scene.remove(comet);
    head.material.dispose(); tail.forEach(s => s.material.dispose());
    overlay.remove();
    onFrame && onFrame();
    window.dispatchEvent(new Event("sts:intro-done"));
    if (onDone) onDone();
  }
  function onKey(e) { if (e.key === "Escape") skip(); }
  /* skip: jump to the end of the timeline (camera lands at start, overlay goes) */
  function skip() { if (tl && state.active) { tl.seek(tl.duration(), false); finish(); } }
  function debug() { return { active: state.active, done: state.done, time: tl ? +tl.time().toFixed(2) : null }; }
  return { play, skip, finish, state, debug };
}
