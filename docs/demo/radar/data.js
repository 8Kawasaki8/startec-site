/* Radar - demo van Star.Tec.Solutions.
   FICTIEVE dataset: alle zaken, namen, posities en cijfers hieronder zijn verzonnen.
   Gedeelde hulpfuncties (abar, watch) staan onderaan. */
window.RADAR = (function () {
  "use strict";

  /* Abstracte districtsvormen (viewBox 600 x 560). Geen echte kaartdata. */
  var districts = [
    { id: "ekeren",     name: "Ekeren",     label: [376, 116], poly: [[300,22],[392,14],[446,52],[438,118],[372,136],[312,110]] },
    { id: "merksem",    name: "Merksem",    label: [392, 146], poly: [[312,118],[372,138],[438,120],[462,180],[420,236],[338,232],[296,186]] },
    { id: "noord",      name: "Noord",      label: [250, 92],  poly: [[212,70],[300,24],[312,112],[296,188],[262,226],[196,200],[182,140]] },
    { id: "centrum",    name: "Centrum",    label: [205, 230], poly: [[196,204],[262,228],[292,262],[280,318],[224,336],[178,300],[170,250]] },
    { id: "borgerhout", name: "Borgerhout", label: [334, 250], poly: [[292,246],[338,236],[372,262],[364,310],[318,322],[290,300]] },
    { id: "deurne",     name: "Deurne",     label: [470, 245], poly: [[338,236],[420,238],[470,200],[540,246],[556,330],[486,366],[400,350],[366,312],[372,262]] },
    { id: "berchem",    name: "Berchem",    label: [330, 398], poly: [[282,322],[318,324],[364,312],[400,352],[388,412],[322,418],[280,386]] },
    { id: "zuid",       name: "Zuid",       label: [205, 398], poly: [[176,302],[226,338],[282,324],[282,388],[246,430],[190,420],[150,370]] },
    { id: "wilrijk",    name: "Wilrijk",    label: [355, 440], poly: [[282,392],[322,420],[388,414],[430,470],[400,540],[300,548],[262,480]] },
    { id: "hoboken",    name: "Hoboken",    label: [178, 500], poly: [[150,372],[190,422],[246,432],[262,482],[240,550],[158,556],[146,470]] }
  ];
  var river = "M140,560 C140,480 125,430 122,360 C118,280 142,210 158,160 C176,105 196,55 222,0";

  var statuses = {
    scan: { label: "Gescand" },
    demo: { label: "Voorbeeld klaar" },
    talk: { label: "Gesprek" },
    live: { label: "Live" }
  };
  var sectors = ["Voeding", "Horeca", "Retail", "Verzorging", "Bouw & techniek", "Mobiliteit"];

  /* n = naam, s = sector, d = district, sc = vindbaarheid bij scan (0-100), st = status, x/y = positie, sig = signalen */
  var businesses = [
    { n: "Bakkerij Noordpool",          s: "Voeding",         d: "noord",      sc: 22, st: "demo", x: 250, y: 120, sig: ["Geen website, enkel een Facebook-pagina", "Openingsuren nergens online te vinden"] },
    { n: "Fietsherstel Ketting & Co",   s: "Mobiliteit",      d: "noord",      sc: 16, st: "demo", x: 235, y: 170, sig: ["Niet gevonden op kaarten", "Geen foto's van de werkplaats online"] },
    { n: "Kapsalon Lumen",              s: "Verzorging",      d: "centrum",    sc: 48, st: "scan", x: 225, y: 255, sig: ["Website uit 2016, niet mobiel leesbaar", "Geen online afspraken"] },
    { n: "Boekhandel Kantlijn",         s: "Retail",          d: "centrum",    sc: 56, st: "live", x: 245, y: 300, sig: ["Had een trage site zonder https", "Voorbeeld goedgekeurd, site nu live"] },
    { n: "Kledingzaak Garde Robe",      s: "Retail",          d: "centrum",    sc: 61, st: "live", x: 210, y: 285, sig: ["Site zonder productfoto's", "Nu live met collectiepagina"] },
    { n: "Café De Ronde Tafel",         s: "Horeca",          d: "borgerhout", sc: 31, st: "scan", x: 322, y: 268, sig: ["Geen website", "Menu enkel als foto op sociale media"] },
    { n: "Wasserette Blauwzeep",        s: "Verzorging",      d: "borgerhout", sc: 7,  st: "demo", x: 340, y: 300, sig: ["Geen website, niet op kaarten", "Enkel een telefoonnummer in een gids"] },
    { n: "Slagerij Tweesprong",         s: "Voeding",         d: "deurne",     sc: 18, st: "demo", x: 430, y: 270, sig: ["Geen website", "Goede reviews (4,7), onzichtbaar in zoekresultaten"] },
    { n: "Dierenwinkel Pluim & Poot",   s: "Retail",          d: "deurne",     sc: 29, st: "scan", x: 500, y: 300, sig: ["Facebook-pagina, laatste bericht in 2023", "Geen openingsuren online"] },
    { n: "Schoonheidssalon Satijn",     s: "Verzorging",      d: "deurne",     sc: 33, st: "scan", x: 450, y: 330, sig: ["Website van een pagina, zonder prijzen", "Niet mobiel leesbaar"] },
    { n: "Fietsen De Spaak",            s: "Mobiliteit",      d: "berchem",    sc: 35, st: "talk", x: 330, y: 360, sig: ["Verouderde site, laatste update 2019", "Herstellingen nergens vindbaar"] },
    { n: "Brasserie Zilverlaan",        s: "Horeca",          d: "berchem",    sc: 44, st: "talk", x: 365, y: 385, sig: ["Website zonder https", "Reserveren kan enkel telefonisch"] },
    { n: "Bloemen Aster & Co",          s: "Retail",          d: "zuid",       sc: 41, st: "scan", x: 220, y: 360, sig: ["Enkel een Instagram-account", "Geen adres of uren op de pagina"] },
    { n: "Traiteur Mevrouw Groen",      s: "Voeding",         d: "zuid",       sc: 38, st: "scan", x: 250, y: 395, sig: ["Website zonder menu", "Trage laadtijd (6,2 s)"] },
    { n: "Garage Mertensveld",          s: "Mobiliteit",      d: "wilrijk",    sc: 27, st: "talk", x: 330, y: 460, sig: ["Geen website", "Vermelding op kaarten zonder foto's"] },
    { n: "Optiek Lensvlak",             s: "Retail",          d: "wilrijk",    sc: 52, st: "live", x: 380, y: 500, sig: ["Site zonder afsprakenknop", "Nu live met afsprakenpagina"] },
    { n: "Bakkerij Zonnewijzer",        s: "Voeding",         d: "wilrijk",    sc: 40, st: "talk", x: 300, y: 505, sig: ["Facebook-pagina, geen website", "Veel vragen over uren in de reviews"] },
    { n: "Frituur Nummer Negen",        s: "Voeding",         d: "hoboken",    sc: 12, st: "demo", x: 190, y: 470, sig: ["Geen website", "Niet gevonden op kaarten"] },
    { n: "Elektro Stroomlijn",          s: "Bouw & techniek", d: "hoboken",    sc: 20, st: "scan", x: 215, y: 515, sig: ["Geen website", "Enkel een vermelding in een online gids"] },
    { n: "Loodgieterij Waterval",       s: "Bouw & techniek", d: "merksem",    sc: 9,  st: "demo", x: 370, y: 170, sig: ["Geen website, niet op kaarten", "Telefoonnummer staat enkel op de bestelwagen"] },
    { n: "Fitness Studio Vonk",         s: "Verzorging",      d: "merksem",    sc: 46, st: "talk", x: 420, y: 200, sig: ["Website zonder lesrooster", "Geen online inschrijving"] },
    { n: "Dakwerken Nokhoog",           s: "Bouw & techniek", d: "merksem",    sc: 11, st: "scan", x: 340, y: 200, sig: ["Geen website", "Geen reviews, geen foto's"] },
    { n: "Schildersbedrijf Palet Noord", s: "Bouw & techniek", d: "ekeren",    sc: 15, st: "scan", x: 360, y: 70,  sig: ["Geen website", "Alleen een vermelding in een online gids"] },
    { n: "Eethuis De Lantaarn",         s: "Horeca",          d: "ekeren",     sc: 25, st: "demo", x: 410, y: 95,  sig: ["Geen website", "Menu en uren enkel op een krijtbord"] }
  ];

  var weeks = {
    labels: ["w30", "w31", "w32", "w33", "w34", "w35", "w36", "w37", "w38", "w39", "w40", "w41"],
    ranges: ["20-26 jul", "27 jul-2 aug", "3-9 aug", "10-16 aug", "17-23 aug", "24-30 aug", "31 aug-6 sep", "7-13 sep", "14-20 sep", "21-27 sep", "28 sep-4 okt", "5-11 okt"],
    scans:  [64, 72, 88, 81, 95, 110, 104, 126, 131, 118, 142, 153],
    noSite: [20, 23, 28, 26, 30, 35, 33, 40, 42, 38, 46, 51],
    demos:  [1, 2, 2, 3, 3, 3, 4, 3, 4, 4, 4, 4],
    talks:  [0, 1, 1, 1, 2, 1, 2, 2, 2, 2, 2, 3]
  };
  var sectorBreakdown = [
    { name: "Horeca", value: 118 }, { name: "Voeding", value: 86 }, { name: "Retail", value: 74 },
    { name: "Verzorging", value: 58 }, { name: "Bouw & techniek", value: 47 }, { name: "Mobiliteit", value: 29 }
  ];
  var kpis = { scanned: 1284, noSite: 412, demos: 37, talks: 19 };

  var log = [
    { a: "verkenner", t: "14 nieuwe zaken gevonden in Borgerhout" },
    { a: "meter",     t: "Bakkerij Noordpool: geen website, 3 vermeldingen, score 22/100" },
    { a: "verkenner", t: "Deurne doorzocht: 212 zaken, 71 zonder website" },
    { a: "meter",     t: "Fietsen De Spaak: site uit 2019, mobiel onleesbaar, score 35/100" },
    { a: "bouwer",    t: "voorbeeld klaar voor Wasserette Blauwzeep (laadtijd 0,8 s)" },
    { a: "planner",   t: "6 kandidaten in de wachtrij voor goedkeuring door een mens" },
    { a: "mens",      t: "Mens: 4 berichten goedgekeurd, 1 aangepast, 1 afgewezen" },
    { a: "meter",     t: "Loodgieterij Waterval: niet gevonden op kaarten, score 9/100" },
    { a: "verkenner", t: "scan Ekeren gestart: 148 adressen in de wachtrij" },
    { a: "bouwer",    t: "foto's en openingsuren verzameld voor Eethuis De Lantaarn" },
    { a: "meter",     t: "Brasserie Zilverlaan: geen https, reserveren enkel telefonisch" },
    { a: "planner",   t: "gesprek ingepland: Garage Mertensveld, donderdag 14:00" },
    { a: "verkenner", t: "Merksem: 9 zaken met enkel een Facebook-pagina gevonden" },
    { a: "bouwer",    t: "voorbeeld klaar voor Slagerij Tweesprong (4 pagina's)" },
    { a: "mens",      t: "Mens: voorbeeld Frituur Nummer Negen goedgekeurd voor verzending" },
    { a: "planner",   t: "weekrapport klaar: 153 scans, 51 zonder website, 4 voorbeelden" }
  ];
  var agents = [
    { name: "verkenner", task: "scant Ekeren (148 adressen)", load: 0.82 },
    { name: "meter",     task: "meet 23 zaken in de wachtrij", load: 0.64 },
    { name: "bouwer",    task: "bouwt 2 voorbeelden",          load: 0.47 },
    { name: "planner",   task: "wacht op een mens (6 berichten)", load: 0.21 }
  ];

  function rep(ch, n) { return n > 0 ? new Array(n + 1).join(ch) : ""; }
  function districtName(id) {
    for (var i = 0; i < districts.length; i++) if (districts[i].id === id) return districts[i].name;
    return id;
  }

  /* ASCII-balk: blokjes die via clip-path 'vollopen'. Decoratief; het cijfer staat er altijd naast. */
  function abar(score, len) {
    len = len || 12;
    var blocks = Math.max(0, Math.min(len, Math.round(score / 100 * len)));
    var w = document.createElement("span");
    w.className = "abar"; w.setAttribute("aria-hidden", "true");
    w.style.setProperty("--w", (blocks / len * 100).toFixed(2) + "%");
    var t = document.createElement("span"); t.className = "trk"; t.textContent = rep("░", len);
    var f = document.createElement("span"); f.className = "fil"; f.textContent = rep("█", len);
    w.appendChild(t); w.appendChild(f);
    requestAnimationFrame(function () { requestAnimationFrame(function () { w.classList.add("is-in"); }); });
    return w;
  }

  /* Roept cb(true/false) aan wanneer el in beeld is en het tabblad zichtbaar is: animaties pauzeren anders. */
  function watch(el, cb) {
    var inView = true;
    function upd() { cb(inView && !document.hidden); }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; upd(); }, { threshold: 0.02 }).observe(el);
    }
    document.addEventListener("visibilitychange", upd);
    upd();
  }

  return {
    districts: districts, river: river, statuses: statuses, sectors: sectors, businesses: businesses,
    weeks: weeks, sectorBreakdown: sectorBreakdown, kpis: kpis, log: log, agents: agents,
    rep: rep, districtName: districtName, abar: abar, watch: watch
  };
})();
