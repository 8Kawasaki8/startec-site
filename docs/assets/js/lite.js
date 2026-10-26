/* Lite: the 'Minder animatie' button in the footer ([data-lite-toggle]). The choice is one
   localStorage key, sts-lite (named in cookies.html); the page reloads so the scene loader
   and every room read it from the start. Storage blocked: the button still toggles ?lite. */
(function () {
  var on = false;
  try { on = localStorage.getItem("sts-lite") === "1"; } catch (e) { /* storage blocked */ }
  on = on || /[?&]lite\b/.test(location.search);
  document.querySelectorAll("[data-lite-toggle]").forEach(function (b) {
    b.textContent = on ? "Meer animatie" : "Minder animatie";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.addEventListener("click", function () {
      var stored = false;
      try { on ? localStorage.removeItem("sts-lite") : localStorage.setItem("sts-lite", "1"); stored = true; } catch (e) { /* storage blocked */ }
      if (stored) { location.reload(); return; }
      var p = new URLSearchParams(location.search);
      on ? p.delete("lite") : p.set("lite", "1");
      var q = p.toString();
      location.assign(location.pathname + (q ? "?" + q : "") + location.hash);
    });
  });
})();
