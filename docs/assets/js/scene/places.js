/* Places: the camera keyframes of the night city. Every place frames the
   landmark (the HERO tower with the sign on top); none stands at street level.
   A place is { p: camera position, l: look-at point, label }. The city never
   reacts to scroll position: a room asks for its place with STSScene.flyTo(id).

   start and gevel put the sign in the frame (14-18 units away, sign >= 12 units
   wide, skyline below). The other rooms stand 22-30 units out at varying
   azimuths so the landmark stays in view while the room's own content leads. */
/* the landmark plot: shared with city.js (which builds it) and sign.js */
export const HERO = { x: 6, z: -2, w: 5.4, h: 15 };

const SIGN_Y = HERO.h + 2.2;                 // centre height of the sign plane
const LOOK = [HERO.x, HERO.h + 2, HERO.z];   // what every place looks at

/* a camera on a ring around the landmark: distance d, azimuth in degrees
   measured from the front (+z, the side the sign faces), height y */
function ring(d, azimuth, y, look = LOOK) {
  const a = azimuth * Math.PI / 180;
  const flat = Math.sqrt(Math.max(1, d * d - (y - SIGN_Y) * (y - SIGN_Y)));
  return { p: [+(HERO.x + Math.sin(a) * flat).toFixed(2), y, +(HERO.z + Math.cos(a) * flat).toFixed(2)], l: look };
}

export const places = {
  start:        { p: [HERO.x + 4, HERO.h + 6, HERO.z + 17], l: LOOK, label: "Start: het uithangbord" },
  gevel:        { p: [HERO.x + 2, HERO.h + 4, HERO.z + 14], l: LOOK, label: "Jouw gevel" },
  telefoon:     { ...ring(24, -34, HERO.h + 5), label: "De telefoon om 19 u" },
  buren:        { ...ring(22, 38, HERO.h + 3, [HERO.x - 2, HERO.h - 1, HERO.z - 2]), label: "De buren" },
  bericht:      { ...ring(26, 14, HERO.h + 9), label: "Bericht aan Snymis" },
  doorlichting: { ...ring(28, -56, HERO.h + 12), label: "Doorlichting" },
  gereedschap:  { ...ring(25, 58, HERO.h + 6), label: "Gereedschap" },
  werkwijze:    { ...ring(30, -12, HERO.h + 14), label: "Werkwijze" }
};

/* distance from a place's camera to the sign centre, for the debug overlay */
export function distanceToSign(place) {
  const [x, y, z] = place.p;
  return Math.hypot(x - HERO.x, y - SIGN_Y, z - HERO.z);
}
