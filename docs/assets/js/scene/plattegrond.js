/* The SVG route: phones, lite mode, weak CPUs, no WebGL, or a scene that
   failed or degraded. The inline skyline #plattegrond is already visible (the
   loader unhid #scene-fallback); this module gives it the same STSScene API
   as scene.js so rooms never check which route runs: flyTo resolves at once
   and still dispatches sts:flight-start and sts:landed, setSector sets the
   fill of <g id=landmark>, setSign writes #sign-dom and #sign-sr, and the
   DOM sign sits over the board of the SVG landmark (once, and on resize).
   Dispatches sts:scene-failed for real failures (nogl, fout, traag,
   contextlost) and sts:scene-ready for the intended routes (phone, lite,
   weak). No requestAnimationFrame at all. On coarse pointers the fallback
   keeps the large viewport height (like the canvas), so the address bar of a
   phone never rescales the skyline or moves the sign. */
import { lichtOp } from "./rit-licht.js";
import { places } from "./places.js";
import { writeSignDom, placeSignDom, shadeSignDom, watchSignShade, countLongTasks } from "./signdom.js";

const FAILED = ["nogl", "fout", "traag", "contextlost"];
export let installed = false;

export function install({ reason = "svg", text = "", color = "#36E8FF" } = {}) {
  if (installed) return window.STSScene;
  installed = true;
  const fallback = document.getElementById("scene-fallback"), canvas = document.getElementById("scene");
  if (fallback) fallback.hidden = false;
  if (canvas) canvas.hidden = true;
  document.documentElement.dataset.scene = "svg";
  const landmark = document.getElementById("landmark"), board = document.getElementById("landmark-bord");
  const longTasks = { n: 0 }; countLongTasks(longTasks);
  const coarse = matchMedia("(pointer:coarse)").matches;
  let at = "start", signText = "", sector = color, resizeTimer = 0, lifted = false, lastW = 0, lastH = 0;

  /* coarse pointers: pin the fallback to the large viewport height in px; a height-only change
     under 200 px (the browser toolbar) is ignored, like resize() in scene.js does for the canvas */
  const probeEl = document.createElement("div"); probeEl.style.cssText = "position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none";
  if (coarse && fallback) document.body.appendChild(probeEl);
  function size(force) {
    const w = innerWidth, h = coarse ? Math.max(innerHeight, probeEl.offsetHeight || 0) : innerHeight;
    if (!force && coarse && w === lastW && Math.abs(h - lastH) < 200) return false;
    lastW = w; lastH = h;
    if (coarse && fallback) fallback.style.height = h + "px";
    /* wide viewports (desktop lite, weak, nogl): a wider board so the projected sign reaches the 420 px of the plan */
    if (board) { const wide = w >= 1200; board.setAttribute("x", wide ? "420" : "440"); board.setAttribute("width", wide ? "360" : "320"); }
    return true;
  }

  function box() {
    const el = board || landmark; if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }
  function place() { const b = box(); placeSignDom(b, signText); shadeSignDom(b); }
  function placed() { const d = document.getElementById("sign-dom"); return !!(d && d.classList.contains("is-placed")); }
  const UNLIT = "#1C2642";
  /* the board's tube: dim while no name is on the sign, the sector colour once there is one (sign.js draws the
     same two states on the GL route, so a phone sees the same waiting sign) */
  function tube() { if (board) board.setAttribute("stroke", signText ? sector : UNLIT); }
  function setSector(c) {
    if (!c) return; sector = c;
    if (landmark) { landmark.setAttribute("fill", c); landmark.setAttribute("stroke", c); }
    tube();
    const dom = document.getElementById("sign-dom"); if (dom) dom.style.setProperty("--sign", c);
  }
  /* the board does not move when its text changes: place only until the sign sits (then on resize) */
  function setSign(t, c) { signText = writeSignDom(t, c); if (c) setSector(c); tube(); if (!placed()) place(); return signText; }
  function flyTo(id) {
    if (!places[id]) return Promise.reject(new Error("onbekende plek: " + id));
    window.dispatchEvent(new CustomEvent("sts:flight-start", { detail: { id } }));
    at = id;
    return new Promise(resolve => {
      queueMicrotask(() => { window.dispatchEvent(new CustomEvent("sts:landed", { detail: { id } })); resolve(id); });
    });
  }
  /* the intro overlay has nothing to show here: lift it, mark the session (once per session,
     like the GL route) and tell the page */
  function endIntro() {
    if (lifted) return; lifted = true;
    try { sessionStorage.setItem("sts-pre", "1"); } catch (e) { /* storage blocked */ }
    const overlay = document.getElementById("intro");
    if (overlay) {
      overlay.classList.add("is-lifting");
      const t = setTimeout(() => { overlay.remove(); window.dispatchEvent(new Event("sts:intro-done")); }, 300);
      addEventListener("pagehide", () => clearTimeout(t), { once: true });
    } else window.dispatchEvent(new Event("sts:intro-done"));
  }

  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (size(false)) place(); }, 200); }, { passive: true });
  size(true);
  watchSignShade();
  setSector(sector);
  setSign(text);

  /* the scroll ride on the SVG route: only the window patterns dim and light up (opacity on 13 rects) */
  const ramen = fallback ? [...fallback.querySelectorAll('[fill="url(#pg-ramen)"],[fill="url(#pg-ramen2)"]')] : [];
  function ride(p) { const o = (0.1 + 0.9 * lichtOp(p)).toFixed(2); for (const r of ramen) r.style.opacity = o; }
  window.STSScene = {
    lite: true, profile: reason, places, ride,
    flyTo, setSign, signText: () => signText, setSector,
    cover() {}, setParallax() {},
    intro: {
      play(cb) { endIntro(); if (typeof cb === "function") cb(); return Promise.resolve(); },
      skip: endIntro, debug: () => ({ active: false, done: lifted })
    },
    debug: {
      get frames() { return 0; }, get longTasks() { return longTasks.n; },
      camera: () => (places[at] || places.start).p.slice(),
      get landmarkVisible() { const b = landmark && landmark.getBoundingClientRect(); return !!(b && b.width > 0 && b.height > 0); },
      get bloom() { return false; }, get state() { return "rust"; }, get profile() { return reason; },
      signBox: box, info: () => null
    }
  };
  /* no overlay on this route, but a fresh session still expects the intro contract: sts-pre written and
     sts:intro-done dispatched (uithangbord.js and gevel.js wait for it before they frame the sign) */
  let pre = null; try { pre = sessionStorage.getItem("sts-pre"); } catch (e) { /* storage blocked */ }
  if (document.getElementById("intro") || !pre) endIntro();
  window.dispatchEvent(new Event(FAILED.includes(reason) ? "sts:scene-failed" : "sts:scene-ready"));
  /* ?debug=1 shows the same panel as the GL route (docs/CHECKLIST-SAKI.md, step A): 'scene svg' in its first line */
  if (new URLSearchParams(location.search).get("debug") === "1") import("./debug.js").then(m => m.mountDebug(window.STSScene, () => ({ profile: reason, state: "rust", at }))).catch(() => {});
  return window.STSScene;
}

/* loaded directly by the inline loader: the reason is on <html data-scene-reason>. When scene.js
   imports this module after a failure, the loader had decided 'gl' and scene.js calls install() itself. */
if (!window.STSScene && document.documentElement.dataset.scene !== "gl") {
  const d = document.documentElement.dataset;
  install({ reason: d.sceneReason || "svg" });
}
