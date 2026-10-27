/* 'Stuur naar een collega' ([data-share=<sleutel>], WP-27): one text per tool or simulation, written as the
   owner would forward it to a colleague, from window.STS_DEEL. The texts are data, not code: deel-data.js
   (the loketten of Gereedschap) and the *-data.js file of each simulation register their key; lint-deel.mjs
   (in lint-copy) keeps every text under 300 characters, jargon-free and matched to a button.
   {site} becomes the public address of the site (from <link rel=canonical>); {score} the visitor's own
   score (STSCheck.last) and, while there is none, the 'tools' text stands in.
   navigator.share where it exists, otherwise a wa.me link in a new tab. Nothing leaves the page before the
   click: no request, no prefetch. The status line says what happened; never a 'verzonden' state. A button
   whose key has no text hides itself together with its line. */
(function () {
  var d = document, D = window.STS_DEEL || {};
  var buttons = [].slice.call(d.querySelectorAll("[data-share]"));
  if (!buttons.length) return;

  function site() {
    var c = d.querySelector('link[rel="canonical"]'), href = c ? c.getAttribute("href") || "" : "";
    if (!/^https?:/.test(href)) { var l = d.querySelector('link[href*="assets/css/"]'); href = l ? l.href.slice(0, l.href.indexOf("assets/")) : location.href; }
    return href.replace(/[?#].*$/, "").replace(/[^\/]*$/, "");
  }
  function text(key) {
    var t = D[key] || "", Ch = window.STSCheck;
    if (t.indexOf("{score}") >= 0) t = Ch && Ch.last && Ch.last.score != null ? t.replace("{score}", Ch.last.score) : (D.tools || "");
    return t.replace(/\{site\}/g, site());
  }
  function statusEl(btn) {
    var p = btn.parentNode;
    while (p && p !== d.body) { var el = p.querySelector("[data-share-status]"); if (el) return el; p = p.parentNode; }
    return null;
  }
  function status(el, msg) { if (!el) return; el.hidden = !msg; el.textContent = msg || ""; }

  buttons.forEach(function (btn) {
    var key = btn.getAttribute("data-share");
    if (!D[key]) { var line = btn.parentNode; (line && line.className.indexOf("deel-collega") >= 0 ? line : btn).hidden = true; return; }
    btn.addEventListener("click", function () {
      var t = text(key), st = statusEl(btn), wa = "https://wa.me/?text=" + encodeURIComponent(t);
      if (navigator.share) {
        navigator.share({ text: t }).then(function () { status(st, "Je deelmenu stond open; de tekst ging naar de app die jij koos."); }, function () { status(st, "Niets verstuurd. Je kan de tekst ook zelf plakken: " + t); });
        return;
      }
      var a = d.createElement("a"); a.href = wa; a.target = "_blank"; a.rel = "noopener noreferrer";
      d.body.appendChild(a); a.click(); a.remove();
      status(st, "WhatsApp opent in een nieuw venster met de tekst klaar; jij kiest wie hem krijgt. Blijft het dicht, plak dan zelf: " + t);
    });
  });
})();
