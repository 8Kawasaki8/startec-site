/* Drives the scroll ride (scene/rit.js) on index.html: the progress of #rit through the viewport,
   0 while the section is still below, 1 once it has scrolled past, read once per animation frame
   and passed to STSScene.ride only when it changed. Passive listener, no work at rest. */
(function () {
  var el = document.getElementById("rit"); if (!el) return;
  var last = -1, queued = false;
  function calc() {
    queued = false;
    var sc = window.STSScene; if (!sc || typeof sc.ride !== "function") return;
    var r = el.getBoundingClientRect(), span = r.height - innerHeight;
    var p = span > 0 ? -r.top / span : 0;
    p = Math.round(Math.max(0, Math.min(1, p)) * 1000) / 1000;
    if (p === last) return;
    last = p; sc.ride(p);
  }
  function on() { if (!queued) { queued = true; requestAnimationFrame(calc); } }
  addEventListener("scroll", on, { passive: true });
  addEventListener("resize", on);
  ["sts:scene-ready", "sts:intro-done"].forEach(function (n) { addEventListener(n, function () { last = -1; on(); }); });
})();
