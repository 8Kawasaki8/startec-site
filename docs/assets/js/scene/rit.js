/* The scroll ride on index.html: between the sign (#gevel) and De telefoon om 19 u (#telefoon) a
   transparent stretch (#rit, src/rooms/rit.html) scrubs the camera down a real street of the city while
   the windows go dark and light up again (rit-licht.js). Driven by the scroll position through
   docs/assets/js/rit.js -> STSScene.ride(p); the loop renders only while the visitor scrolls (wake),
   so the city still draws zero frames at rest. Streets of the city grid: x = -10 and z = 2 (city.js). */
import * as THREE from "../../vendor/three.module.min.js";
import { places } from "./places.js";
import { lichtOp } from "./rit-licht.js";

const V = a => new THREE.Vector3(...a);
const pos = new THREE.CatmullRomCurve3([
  V(places.gevel.p), V([-6, 26, 34]), V([-10, 10, 30]), V([-10, 11.5, 14]), V([-3, 12, 6]), V(places.telefoon.p)
], false, "centripetal");
const look = new THREE.CatmullRomCurve3([
  V(places.gevel.l), V([2, 8, -6]), V([-9, 7, -4]), V([-4, 8, -22]), V([6, 15, -2]), V(places.telefoon.l)
], false, "centripetal");
const ease = t => t * t * (3 - 2 * t);

/* p in 0..1 -> { pos, look, lit } */
export function ritPose(p) {
  const t = ease(Math.max(0, Math.min(1, p)));
  return { pos: pos.getPoint(t), look: look.getPoint(t), lit: lichtOp(p) };
}
