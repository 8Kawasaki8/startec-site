/* Google-voorbeeld (loket 3 of src/rooms/gereedschap.html): title, description and address as a
   search result, cut the way Google cuts (by pixel width, approximated with canvas measureText).
   - With a name on the sign the fields are prefilled '{zaak} · {gemeente}', a description in the
     owner's words and an address made of the name; without a name the example is a fictional
     bakery, named as such in the hint. A field the visitor edited is never overwritten: each field
     remembers the last value this script wrote and only replaces that one. */
(function () {
  var d = document, S = window.STSState, N = window.STSNames, T = window.STSTools;
  var tIn = d.getElementById("sp-title"), dIn = d.getElementById("sp-desc"), uIn = d.getElementById("sp-url");
  if (!tIn || !dIn || !uIn) return;
  var $ = function (id) { return d.getElementById(id); };
  var meas = d.createElement("canvas").getContext("2d"), auto = { t: null, d: null, u: null };
  var FICTIEF = { t: "Bakkerij Sterrenhemel | Vers brood en taart in Hoboken", d: "Elke ochtend vers brood en patisserie uit eigen atelier. Open van dinsdag tot zondag vanaf 7 uur. Bestel je taart online of kom even binnen.", u: "bakkerijsterrenhemel.be/taarten" };

  function cut(text, font, max) {
    meas.font = font;
    if (meas.measureText(text).width <= max) return { text: text, cut: false };
    var s = text;
    while (s.length && meas.measureText(s + " …").width > max) s = s.slice(0, -1);
    return { text: s.replace(/\s+\S*$/, "") + " …", cut: true };
  }
  function crumbs(raw) {
    try {
      var u = new URL(/^https?:\/\//.test(raw) ? raw : "https://" + raw), parts = u.pathname.split("/").filter(Boolean);
      return { host: u.hostname.replace(/^www\./, ""), path: parts.length ? " › " + parts.join(" › ") : "" };
    } catch (e) { return { host: raw || "jouwzaak.be", path: "" }; }
  }
  function judge(len, lo, hi, cutoff) {
    if (!len) return "Nog leeg.";
    if (cutoff) return "Te lang: Google kapt dit af.";
    if (len < lo) return "Kort: hier is nog ruimte voor wat je doet of waar je zit.";
    if (len > hi) return "Aan de lange kant.";
    return "Goede lengte.";
  }
  function update() {
    var c = crumbs(uIn.value.trim());
    $("sp-host").textContent = c.host;
    $("sp-crumb").textContent = c.host + c.path;
    $("sp-fav").textContent = (c.host.charAt(0) || "?").toUpperCase();
    var t = cut(tIn.value.trim() || "Jouw paginatitel", "20px Arial", 600);
    var de = cut(dIn.value.trim() || "Je beschrijving verschijnt hier.", "14px Arial", 920);
    $("sp-out-title").textContent = t.text;
    $("sp-out-desc").textContent = de.text;
    var tl = tIn.value.trim().length, dl = dIn.value.trim().length;
    $("sp-t-meter").textContent = tl + " tekens · " + judge(tl, 30, 60, tl && t.cut);
    $("sp-d-meter").textContent = dl + " tekens · " + judge(dl, 70, 160, dl && de.cut);
  }

  /* the owner's own words, from the sign; only fields still holding our last value change */
  function propose(s) {
    var p;
    if (!s.zaak) p = FICTIEF;
    else {
      var soort = N && s.sector && s.sector !== "anders" ? N.sectorLabel(s.sector) : "", where = s.gemeente || "Antwerpen";
      var wat = soort ? soort + " in " + where : "Jouw zaak in " + where;
      p = {
        t: s.zaak + " · " + where,
        d: wat + ". Onze openingsuren, ons adres en hoe je ons bereikt: bel of stuur een WhatsApp, we antwoorden zelf.",
        u: (T ? T.slug(s.zaak) : s.zaak.toLowerCase().replace(/[^a-z0-9]/g, "")) + ".be"
      };
    }
    var fictief = p === FICTIEF, hint = $("sp-hint");
    if (hint) hint.textContent = "Een benadering: Google kapt af op schermbreedte en past soms zelf je tekst aan. " + (fictief ? "Zonder naam op het bord staat hier een verzonnen bakkerij." : "De tekst is een voorstel in jouw woorden; pas ze gerust aan.");
    [[tIn, "t"], [dIn, "d"], [uIn, "u"]].forEach(function (f) {
      var el = f[0], k = f[1];
      if (el.value === "" || el.value === auto[k]) { el.value = p[k]; auto[k] = p[k]; }
    });
    update();
  }
  [tIn, dIn, uIn].forEach(function (i) { i.addEventListener("input", update); });
  if (S) S.subscribe(propose); else propose({ zaak: "", sector: "", gemeente: "" });
})();
