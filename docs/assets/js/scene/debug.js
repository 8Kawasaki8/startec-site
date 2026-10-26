/* Debug overlay for the founder's own PC (index.html?debug=1 and the dev
   page): the numbers of STSScene.debug in a small mono panel, refreshed twice
   a second by a timer that stops when the tab is hidden. It never asks the
   scene for a frame. */
export function mountDebug(api, extra) {
  const el = document.createElement("pre");
  el.id = "scene-debug"; el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  let timer = 0;
  const r1 = v => Math.round(v * 10) / 10;
  function line() {
    const d = api.debug, cam = d.camera(), info = d.info() || {}, box = d.signBox();
    const x = extra ? extra() : {};
    return [
      "scene " + (api.lite ? "svg" : "gl") + "  profile " + (x.profile || "-") + "  state " + (x.state || "-"),
      "frames " + d.frames + "  longtasks " + d.longTasks + "  dpr " + (x.dpr != null ? x.dpr : "-"),
      "bloom " + d.bloom + "  probe " + (x.probe ? r1(x.probe.avgMs) + " ms/" + x.probe.frames : "-") + "  guard " + (x.guard != null ? x.guard : "-"),
      "cam " + cam.map(r1).join(" ") + "  at " + (x.at || "-"),
      "landmark " + d.landmarkVisible + "  sign " + (box ? Math.round(box.width) + "x" + Math.round(box.height) : "-") + ' "' + api.signText() + '"',
      "calls " + (info.calls ?? "-") + "  tris " + (info.triangles ?? "-") + "  points " + (info.points ?? "-")
    ].join("\n");
  }
  function refresh() { try { el.textContent = line(); } catch (e) { el.textContent = "debug: " + e.message; } }
  function start() { stop(); refresh(); timer = setInterval(refresh, 500); }
  function stop() { if (timer) { clearInterval(timer); timer = 0; } }
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  start();
  return { el, refresh, stop };
}
