/* Het Google-kaartje om 19 u (loket 4 of src/rooms/gereedschap.html, [data-sim]).
   - Three states the visitor toggles: 'geen' (no profile: the card shows a fictional neighbour of
     the same sector and the business is absent), 'zonder' (profile without hours: 'Uren onbekend'),
     'met' (profile with the hours he typed: 'Open · sluit om 18:00', 'Sluit binnenkort' or
     'Gesloten · opent ... om ...'). A range 12-21 sets the hour, a select the weekday (default today).
   - The hours table starts from a default per sector (Sunday closed) and is editable as free text,
     '9:00 – 18:00' or 'gesloten'; the name and gemeente come from STSState, no Google request.
   - Output is text and attribute changes only; the sentence under the card always says
     'Voorbeeldweergave, niet live van Google'. The CTA data-bericht=kaartje adds one visitor line. */
(function () {
  var d = document, S = window.STSState, N = window.STSNames;
  var form = d.querySelector("[data-gk-form]");
  if (!form) return;
  var q = function (sel) { return d.querySelector(sel); };
  var range = q("[data-gk-uur]"), uurOut = q("[data-gk-uur-out]"), dag = q("[data-gk-dag]"), tbody = q("[data-gk-uren]");
  var naamEl = q("[data-gk-naam]"), soortEl = q("[data-gk-soort]"), lijn = q("[data-gk-uren-lijn]"), afwezig = q("[data-gk-afwezig]"), zin = q("[data-gk-zin]"), zoek = q("[data-gk-zoek]");
  var DAGEN = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"], KORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
  /* default hours per sector, Monday to Sunday; Sunday closed everywhere */
  var UREN = {
    horeca: ["11:30 – 22:00", "11:30 – 22:00", "11:30 – 22:00", "11:30 – 22:00", "11:30 – 23:00", "11:30 – 23:00", "gesloten"],
    kapper: ["gesloten", "9:00 – 18:00", "9:00 – 18:00", "9:00 – 18:00", "9:00 – 19:00", "8:30 – 16:00", "gesloten"],
    garage: ["8:00 – 18:00", "8:00 – 18:00", "8:00 – 18:00", "8:00 – 18:00", "8:00 – 17:00", "9:00 – 12:00", "gesloten"],
    bakker: ["gesloten", "6:30 – 18:00", "6:30 – 18:00", "6:30 – 18:00", "6:30 – 18:00", "6:30 – 13:00", "gesloten"],
    aannemer: ["7:30 – 17:00", "7:30 – 17:00", "7:30 – 17:00", "7:30 – 17:00", "7:30 – 16:00", "gesloten", "gesloten"],
    praktijk: ["8:00 – 19:00", "8:00 – 19:00", "8:00 – 19:00", "8:00 – 19:00", "8:00 – 17:00", "9:00 – 12:00", "gesloten"],
    winkel: ["10:00 – 18:00", "10:00 – 18:00", "10:00 – 18:00", "10:00 – 18:00", "10:00 – 18:00", "10:00 – 18:00", "gesloten"],
    anders: ["9:00 – 18:00", "9:00 – 18:00", "9:00 – 18:00", "9:00 – 18:00", "9:00 – 18:00", "9:00 – 13:00", "gesloten"]
  };
  /* the fictional neighbour per sector for the state without a profile */
  var BUUR = { horeca: ["Brasserie De Lantaarn", "Berchem"], kapper: ["Kapsalon Mira", "Borgerhout"], garage: ["Garage Smets", "Mortsel"], bakker: ["Bakkerij Zoete Inval", "Deurne"], aannemer: ["Aannemer Van Dyck", "Hoboken"], praktijk: ["Kinepraktijk Aerts", "Wilrijk"], winkel: ["Winkel De Hoek", "Merksem"], anders: ["De Zaak om de Hoek", "Antwerpen"] };
  var SOORT = { horeca: "Restaurant", kapper: "Kapsalon", garage: "Garage", bakker: "Bakkerij", aannemer: "Aannemer", praktijk: "Praktijk", winkel: "Winkel", anders: "Zaak" };
  var sectorNow = "", inputs = [];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(min) { return Math.floor(min / 60) + ":" + pad(min % 60); }
  /* '9:00 – 18:00' -> [540, 1080]; 'gesloten', empty or unreadable -> null */
  function parse(text) {
    var m = /(\d{1,2})(?:[:.hu](\d{2}))?\s*(?:-|–|—|tot)\s*(\d{1,2})(?:[:.hu](\d{2}))?/.exec(String(text || ""));
    if (!m) return null;
    var a = +m[1] * 60 + (+m[2] || 0), b = +m[3] * 60 + (+m[4] || 0);
    return a < b && b <= 24 * 60 ? [a, b] : null;
  }
  function buildTable(sector) {
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    inputs = [];
    (UREN[sector] || UREN.anders).forEach(function (v, i) {
      var tr = d.createElement("tr"), th = d.createElement("th"), td = d.createElement("td"), inp = d.createElement("input");
      th.scope = "row"; th.textContent = KORT[i];
      inp.type = "text"; inp.value = v; inp.setAttribute("aria-label", "Openingsuren " + DAGEN[i]); inp.setAttribute("autocomplete", "off"); inp.maxLength = 24;
      inp.addEventListener("input", render);
      td.appendChild(inp); tr.appendChild(th); tr.appendChild(td); tbody.appendChild(tr);
      inputs.push(inp);
    });
  }
  function hours(sector, day) { return inputs.length ? parse(inputs[day].value) : parse((UREN[sector] || UREN.anders)[day]); }
  function nextOpen(sector, day, fromTable) {
    for (var i = 1; i <= 7; i++) {
      var dd = (day + i) % 7, h = fromTable ? parse(inputs[dd].value) : parse((UREN[sector] || UREN.anders)[dd]);
      if (h) return (i === 1 ? "morgen" : DAGEN[dd]) + " om " + hhmm(h[0]);
    }
    return "";
  }
  /* the status line Google shows for an hour of the day */
  function statusLine(h, minute, sector, day, fromTable) {
    if (!h || minute < h[0] || minute >= h[1]) { var n = nextOpen(sector, day, fromTable); return "Gesloten" + (n ? " · opent " + n : ""); }
    if (h[1] - minute <= 60) return "Sluit binnenkort · " + hhmm(h[1]);
    return "Open · sluit om " + hhmm(h[1]);
  }
  function stand() { var r = form.querySelector("input[name=gk-stand]:checked"); return r ? r.value : "geen"; }

  function render() {
    var s = S ? S.get() : { zaak: "", sector: "", gemeente: "" }, sector = s.sector || "anders", zaak = s.zaak || "je zaak";
    var uur = +range.value, minute = uur * 60, day = +dag.value, st = stand(), buur = BUUR[sector] || BUUR.anders, where = s.gemeente || buur[1];
    uurOut.textContent = uur + ":00";
    zoek.textContent = (SOORT[sector] || "zaak").toLowerCase() + " " + where;
    afwezig.hidden = st !== "geen";
    if (st === "geen") {
      naamEl.textContent = buur[0] + " (verzonnen)";
      soortEl.textContent = SOORT[sector] + " · " + buur[1];
      lijn.textContent = statusLine(hours(sector, day), minute, sector, day, true) + " · dit is de buur, niet " + zaak;
      afwezig.textContent = (s.zaak ? s.zaak : "Jouw zaak") + " staat er niet tussen: zonder Google-profiel toont Google een andere zaak, hier een fictieve buur.";
    } else {
      naamEl.textContent = s.zaak || "Jouw zaak";
      soortEl.textContent = SOORT[sector] + " · " + where;
      lijn.textContent = st === "zonder" ? "Uren onbekend" : statusLine(hours(sector, day), minute, sector, day, true);
    }
    var kijkt = "Zo ziet een klant " + zaak + " om " + uur + ":00 op " + DAGEN[day] + " op zijn gsm";
    zin.textContent = (st === "geen" ? kijkt.replace("ziet", "zoekt") + ", en vindt een buur" : kijkt) + ". Voorbeeldweergave, niet live van Google.";
  }

  function onState(s) {
    var sector = s.sector || "anders";
    if (sector !== sectorNow) { sectorNow = sector; buildTable(sector); }
    render();
  }
  dag.value = String((new Date().getDay() + 6) % 7);
  form.addEventListener("input", render);
  form.addEventListener("change", render);
  if (S) S.subscribe(onState); else onState({ zaak: "", sector: "", gemeente: "" });

  var cta = d.querySelector("#kaartje-google [data-bericht=kaartje]");
  if (cta) cta.addEventListener("click", function (e) {
    var B = window.STSBericht;
    if (!B || typeof B.prefill !== "function") return;
    e.preventDefault();
    var st = stand(), regel = st === "geen" ? "In het voorbeeld koos ik: geen profiel. Ik weet niet zeker of mijn zaak op Google staat." : st === "zonder" ? "In het voorbeeld koos ik: profiel zonder uren." : "In het voorbeeld koos ik: profiel met uren; ik wil zeker zijn dat ze overal juist staan.";
    B.prefill({ key: "kaartje", lines: [regel] });
  });
  window.STSKaartje = { parse: parse, statusLine: statusLine, render: render };
})();
