/* Capaciteitenkaart (werkwijze.html#kaart, src/rooms/kaart.html): the map itself is rendered by build.py
   from src/data/capabilities.json. This script only (1) opens the <details> of an In-onderzoek item when
   the address names it (#onderzoek-assistent, #proef-reviews, ...) so deep links from the FAQ land open,
   and (2) announces every open/close as 'sts:proef' on window with {id, proef, open} so the proefs of
   WP-10 (lab-assistent.js, lab-reviews.js) can start and stop their own timers; the room hook 'leave'
   sends the same event with open:false for every open panel. No timers, no storage, no requests. */
(function () {
  var room = document.getElementById("kaart");
  if (!room) return;
  function announce(d, open) {
    var proef = d.querySelector("[data-proef]");
    try { dispatchEvent(new CustomEvent("sts:proef", { detail: { id: d.id, proef: proef ? proef.getAttribute("data-proef") : "", open: !!open } })); } catch (e) { /* no CustomEvent */ }
  }
  function openHash() {
    var id = location.hash.slice(1).split("?")[0], el = id && document.getElementById(id);
    if (!el || el === room || !room.contains(el)) return;   /* WP-10: #kaart itself opens nothing; only an item or a proef does */
    var d = el.closest("details") || el.querySelector("details");
    if (d && !d.open) d.open = true;
  }
  openHash();
  addEventListener("hashchange", openHash);
  room.addEventListener("toggle", function (e) { if (e.target.tagName === "DETAILS") announce(e.target, e.target.open); }, true);
  var ROOMS = window.STS_ROOMS = window.STS_ROOMS || {};
  ROOMS.kaart = { leave: function () { [].forEach.call(room.querySelectorAll("details[open]"), function (d) { announce(d, false); }); } };
})();
