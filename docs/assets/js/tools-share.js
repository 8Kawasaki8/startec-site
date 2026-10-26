/* 'Stuur naar een collega' (src/rooms/gereedschap.html, [data-share]): a Flemish WhatsApp text with
   the address of the page, through navigator.share where it exists and otherwise a wa.me link in a
   new tab. Nothing leaves the page before the click: no request, no prefetch. Two texts: 'tools'
   (the four loketten) and 'score' (the visitor's own score, with 'zelfinschatting'). */
(function () {
  var d = document, T = window.STSTools, Ch = window.STSCheck;
  var buttons = [].slice.call(d.querySelectorAll("[data-share]"));
  if (!buttons.length || !T) return;

  function text(kind) {
    var url = T.root() + "gereedschap.html";
    if (kind === "score" && Ch && Ch.last) return "Mijn zichtbaarheidscheck: " + Ch.last.score + " op 100 (zelfinschatting). Doe hem zelf in een minuut, het blijft in je browser: " + url + "#zichtbaarheid";
    return "Kijk, gratis gereedschap voor je zaak: een zichtbaarheidscheck, een WhatsApp-knop met QR-code voor aan de kassa en je Google-kaartje om 19 u. Blijft in je browser: " + url;
  }
  function statusEl(btn) {
    var p = btn.parentNode;
    while (p && p !== d.body) { var el = p.querySelector("[data-share-status]"); if (el) return el; p = p.parentNode; }
    return null;
  }
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var t = text(btn.getAttribute("data-share")), st = statusEl(btn), wa = "https://wa.me/?text=" + encodeURIComponent(t);
      if (navigator.share) {
        navigator.share({ text: t }).then(function () { T.status(st, "Je deelmenu stond open; het bericht is onderweg via de app die jij koos."); }, function () { T.status(st, "Niets verstuurd. Je kan de tekst ook zelf plakken: " + t); });
        return;
      }
      var a = d.createElement("a"); a.href = wa; a.target = "_blank"; a.rel = "noopener noreferrer";
      d.body.appendChild(a); a.click(); a.remove();
      T.status(st, "WhatsApp opent in een nieuw venster met de tekst klaar; jij kiest wie hem krijgt. Blijft het dicht, plak dan zelf: " + t);
    });
  });
})();
