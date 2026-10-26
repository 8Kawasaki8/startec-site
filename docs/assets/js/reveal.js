/* Reveal: [data-reveal] and .rv get the class 'in' when they enter the viewport (one
   IntersectionObserver, disconnected per element after the first hit). Elements already
   scrolled past (anchor links) count as entered. prefers-reduced-motion, no observer or
   lite mode: everything is shown at once. */
(function () {
  var els = document.querySelectorAll("[data-reveal], .rv");
  if (!els.length) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, lite = false;
  try { lite = localStorage.getItem("sts-lite") === "1"; } catch (e) { /* storage blocked */ }
  lite = lite || /[?&]lite\b/.test(location.search);
  function show(el) { el.classList.add("in"); }
  if (reduce || lite || !("IntersectionObserver" in window)) { els.forEach(show); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting && en.boundingClientRect.bottom >= 0) return;
      show(en.target);
      io.unobserve(en.target);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.01 });
  els.forEach(function (el) { io.observe(el); });
  addEventListener("pagehide", function () { io.disconnect(); }, { once: true });
})();
