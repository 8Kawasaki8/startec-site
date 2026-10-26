/* Names: the visitor's own words, made safe and grammatical. One source for the
   sector list (keys, labels, colours), the Antwerp districts and nearby gemeenten
   for datalists, and the helpers every room uses to write about the business.
   Classic script (window.STSNames); also importable in node for the fixture test
   (the module sets globalThis.STSNames). No DOM access at load. */
(function (root) {
  var MAX = 40;
  /* The eight sector chips of the gevel, in the buyer's words. 'colour' is the landmark accent;
     the CSS tokens --sector-* (WP-04) mirror these values. 'u' marks the sectors addressed formally. */
  var SECTORS = [
    { id: "horeca", label: "Horeca", colour: "#FFB347" },
    { id: "kapper", label: "Kapper", colour: "#FF7AB6" },
    { id: "garage", label: "Garage", colour: "#FF6B57" },
    { id: "bakker", label: "Bakker", colour: "#FFD166" },
    { id: "aannemer", label: "Aannemer", colour: "#C9A96E" },
    { id: "praktijk", label: "Praktijk", colour: "#9FC5FF", u: true },
    { id: "winkel", label: "Winkel", colour: "#7CFF9A" },
    { id: "anders", label: "Andere zaak", colour: "#36E8FF" }
  ];
  /* Districts of the stad Antwerpen first, then the gemeenten around it. Mortsel is a gemeente. */
  var DISTRICTEN = ["Antwerpen", "Berchem", "Borgerhout", "Deurne", "Ekeren", "Hoboken", "Merksem", "Wilrijk", "Berendrecht-Zandvliet-Lillo"];
  var GEMEENTEN = ["Mortsel", "Edegem", "Kontich", "Aartselaar", "Hove", "Boechout", "Borsbeek", "Wommelgem", "Wijnegem", "Schoten",
    "Brasschaat", "Kapellen", "Stabroek", "Zwijndrecht", "Hemiksem", "Schelle", "Niel", "Boom", "Lint", "Ranst", "Schilde", "Zandhoven",
    "Kalmthout", "Essen", "Wuustwezel", "Brecht", "Malle", "Lier", "Duffel", "Mechelen"];

  function byId(id) {
    for (var i = 0; i < SECTORS.length; i++) if (SECTORS[i].id === id) return SECTORS[i];
    return null;
  }

  /* sanitise: what the owner typed, as he typed it (capitals, apostrophes and even '<3' stay: every
     write is textContent or canvas fillText, so nothing needs escaping or stripping), without control
     characters or runs of whitespace, capped at 40 characters (the width of the sign). */
  function sanitise(value, max) {
    var s = String(value == null ? "" : value);
    s = s.replace(/[\u0000-\u0008\u000E-\u001F\u007F-\u009F\u200B-\u200F\uFEFF]/g, "");   // control and zero-width characters first (tabs, newlines and line separators are whitespace)
    s = s.replace(/\s+/g, " ").trim();                              // then tabs and newlines become one space
    var cap = max || MAX;
    if (s.length > cap) {                                           // cut at a word when that keeps most of the name
      var cut = s.slice(0, cap), words = /\s/.test(s.charAt(cap)) ? cut : cut.replace(/\s*\S*$/, "");
      s = (words.trim().length >= Math.ceil(cap * 0.6) ? words : cut).trim();
    }
    return s;
  }

  /* sector: a known key or '' (anything else is treated as not chosen). */
  function sector(value) {
    var k = sanitise(value, 20).toLowerCase();
    return byId(k) ? k : "";
  }

  function sectorLabel(id) {
    var s = byId(id);
    return s ? s.label : "";
  }

  function sectorColour(id) {
    var s = byId(id);
    return s ? s.colour : SECTORS[SECTORS.length - 1].colour;
  }

  /* aanspreek: 'je' for every sector except the praktijk, where the site says 'u'. */
  function aanspreek(id) {
    var s = byId(id);
    return s && s.u ? "u" : "je";
  }

  /* jouw/uw and jij/u for the same sector rule. */
  function bezit(id) { return aanspreek(id) === "u" ? "uw" : "jouw"; }

  /* Grammar helpers. The name keeps the owner's capitalisation; the fallback names the business
     without a name so a sentence never ends in a hole, in the address of the sector ('je zaak',
     'uw zaak' for the praktijk) so one sentence never mixes je and u. */
  function zaakFallback(sector, fallback) { return fallback || (aanspreek(sector) === "u" ? "uw zaak" : "je zaak"); }
  function bij(zaak, sector, fallback) { return "bij " + (sanitise(zaak) || zaakFallback(sector, fallback)); }
  function van(zaak, sector, fallback) { return "van " + (sanitise(zaak) || zaakFallback(sector, fallback)); }

  /* 'Frituur 't Pleintje uit Deurne' / 'Frituur 't Pleintje' / '' */
  function uit(zaak, gemeente) {
    var z = sanitise(zaak), g = sanitise(gemeente, 30);
    return z ? (g ? z + " uit " + g : z) : "";
  }

  /* The gemeente as the datalist knows it (case repaired for a known name, otherwise as typed). */
  function gemeente(value) {
    var g = sanitise(value, 30);
    if (!g) return "";
    var all = districten(), low = g.toLowerCase();
    for (var i = 0; i < all.length; i++) if (all[i].toLowerCase() === low) return all[i];
    return g;
  }

  function districten() { return DISTRICTEN.concat(GEMEENTEN); }

  /* Fills a <datalist> (or any element) with one <option> per district and gemeente. */
  function fillDatalist(el) {
    if (!el || !el.ownerDocument) return el;
    while (el.firstChild) el.removeChild(el.firstChild);
    districten().forEach(function (name) {
      var o = el.ownerDocument.createElement("option");
      o.value = name;
      el.appendChild(o);
    });
    return el;
  }

  root.STSNames = {
    MAX: MAX, SECTORS: SECTORS, DISTRICTEN: DISTRICTEN, GEMEENTEN: GEMEENTEN,
    sanitise: sanitise, sector: sector, sectorLabel: sectorLabel, sectorColour: sectorColour,
    aanspreek: aanspreek, bezit: bezit, bij: bij, van: van, uit: uit, gemeente: gemeente,
    districten: districten, fillDatalist: fillDatalist
  };
})(typeof window !== "undefined" ? window : globalThis);
