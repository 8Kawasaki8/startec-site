/* The scroll ride's light curve, shared by the WebGL route (scene/rit.js) and the SVG route
   (scene/plattegrond.js) without pulling in Three.js: at the top of the ride the city is lit, it goes
   dark in the first tenth ("een donker raam is een zaak die je 's avonds niet vindt") and lights up
   tower by tower until the end ("wij zetten het licht aan"). */
export function lichtOp(p) {
  const s = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  return p < 0.1 ? 1 - 0.95 * s(p / 0.1) : 0.05 + 0.95 * s((p - 0.32) / 0.5);
}
