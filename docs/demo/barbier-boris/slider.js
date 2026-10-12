/* Barbier Boris (fictief): voor/na-slider. Pointer events + toetsenbord (pijltjes, Home, End). Alleen clip-path en transform bewegen. */
(function () {
  'use strict';
  var stage = document.getElementById('ba-stage');
  var handle = document.getElementById('ba-handle');
  if (!stage || !handle) return;
  var pct = 50, width = 0, dragging = false;

  function apply() {
    var r = Math.round(pct);
    stage.style.setProperty('--x', pct + '%');
    stage.style.setProperty('--dx', ((pct - 50) / 100 * width) + 'px');
    handle.setAttribute('aria-valuenow', String(r));
    handle.setAttribute('aria-valuetext', r + ' procent voor, ' + (100 - r) + ' procent na');
  }
  function set(p) { pct = Math.max(0, Math.min(100, p)); apply(); }
  function measure() { width = stage.clientWidth; apply(); }
  function fromEvent(e) {
    var r = stage.getBoundingClientRect();
    set((e.clientX - r.left - stage.clientLeft) / stage.clientWidth * 100);
  }

  stage.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    stage.classList.add('is-dragging');
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* oude browsers */ }
    fromEvent(e);
  });
  stage.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
  function stop(e) {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-dragging');
    try { stage.releasePointerCapture(e.pointerId); } catch (_) { /* al losgelaten */ }
  }
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);

  handle.addEventListener('keydown', function (e) {
    var step = 0;
    switch (e.key) {
      case 'ArrowLeft': case 'ArrowDown': step = -2; break;
      case 'ArrowRight': case 'ArrowUp': step = 2; break;
      case 'PageDown': step = -10; break;
      case 'PageUp': step = 10; break;
      case 'Home': e.preventDefault(); set(0); return;
      case 'End': e.preventDefault(); set(100); return;
      default: return;
    }
    e.preventDefault();
    set(pct + step);
  });

  window.addEventListener('resize', measure);
  measure();
})();
