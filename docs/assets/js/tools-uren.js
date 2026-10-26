/* Openingsuren-check (loket 5 of src/rooms/gereedschap.html).
   - Per weekday 'open' or 'gesloten' (nothing chosen = missing), one block van/tot and an optional
     middagpauze (gesloten van/tot), so at most two blocks a day; a feestdagen choice (the Belgian
     public holidays 2026-2027 are hard-coded below, no request) and one 'uitzondering deze week'.
   - The clock is injectable: STSUren.setNow(date|null), default new Date(); page.clock works too.
   - Output: the Google card ('Nu open · sluit om 18:00', 'Nu gesloten · opent woensdag om 9:00'),
     the sentence 'nu gesloten, opnieuw open woensdag 9 u', the WhatsApp away text in the voice of
     the business (data-voice=visitor, labelled 'tekst om zelf in te stellen in WhatsApp Business;
     wij sturen niets'), a plain-text list and the HTML urenblok, plus warnings: a day without a
     choice, tot before van, Saturday open six hours or more without a pauze, a holiday within 31
     days on a day the business is open while feestdagen is undecided, an exception without hours.
     The copy outputs and the Bericht line list only decided, valid days; 'nog niet ingevuld' stays on the page.
   - Copy buttons use STSTools.copy; the credit line (config.credit) is appended only while the
     opt-in box is checked (default off). The CTA data-bericht=uren adds the week as one visitor line.
   - Nothing leaves the browser: no storage, no request, no timer; everything re-renders on input. */
(function () {
  var d = document, T = window.STSTools, S = window.STSState, C = window.STS_CONFIG || {};
  var sec = d.getElementById("uren");
  if (!sec || !T) return;
  var q = function (sel) { return sec.querySelector(sel); };
  var DAGEN = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"], KORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];
  var MAAND = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  /* Belgische wettelijke feestdagen 2026 en 2027 (Pasen 5 april 2026 en 28 maart 2027) */
  var FEEST = [["2026-01-01", "Nieuwjaar"], ["2026-04-06", "Paasmaandag"], ["2026-05-01", "Dag van de Arbeid"], ["2026-05-14", "O.L.H. Hemelvaart"], ["2026-05-25", "Pinkstermaandag"],
    ["2026-07-21", "Nationale feestdag"], ["2026-08-15", "O.L.V. Hemelvaart"], ["2026-11-01", "Allerheiligen"], ["2026-11-11", "Wapenstilstand"], ["2026-12-25", "Kerstmis"],
    ["2027-01-01", "Nieuwjaar"], ["2027-03-29", "Paasmaandag"], ["2027-05-01", "Dag van de Arbeid"], ["2027-05-06", "O.L.H. Hemelvaart"], ["2027-05-17", "Pinkstermaandag"],
    ["2027-07-21", "Nationale feestdag"], ["2027-08-15", "O.L.V. Hemelvaart"], ["2027-11-01", "Allerheiligen"], ["2027-11-11", "Wapenstilstand"], ["2027-12-25", "Kerstmis"]];
  var CREDIT = String(C.credit || "").trim(), nowOverride = null, rijen = [], teksten = {};
  var out = q("[data-ur-out]"), hint = q("[data-ur-hint]"), credit = q("[data-ur-credit]"), creditTxt = q("[data-ur-credit-txt]");
  if (creditTxt) creditTxt.textContent = CREDIT || "gemaakt op startec";
  credit.checked = false;
  if (!CREDIT) credit.closest("label").hidden = true;

  function now() { return nowOverride ? new Date(nowOverride.getTime()) : new Date(); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function iso(dt) { return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate()); }
  function wd(dt) { return (dt.getDay() + 6) % 7; }
  function plus(dt, n) { var x = new Date(dt.getTime()); x.setDate(x.getDate() + n); x.setHours(12, 0, 0, 0); return x; }   /* noon: no DST slips */
  function feest(dt) { var k = iso(dt); for (var i = 0; i < FEEST.length; i++) if (FEEST[i][0] === k) return FEEST[i][1]; return ""; }
  function mins(v) { var m = /^(\d{1,2}):(\d{2})$/.exec(v || ""); return m ? +m[1] * 60 + +m[2] : null; }
  function u(min) { var m = min % 60; return Math.floor(min / 60) + (m ? "." + pad(m) : "") + " u"; }   /* 9 u, 9.30 u */
  function hm(min) { return Math.floor(min / 60) + ":" + pad(min % 60); }                              /* 9:00, like Google */
  function datum(dt) { return DAGEN[wd(dt)] + " " + dt.getDate() + " " + MAAND[dt.getMonth()]; }

  /* the seven rows from the template */
  var tpl = q("[data-ur-rij]"), lijst = q("[data-ur-dagen]");
  DAGEN.forEach(function (naam, i) {
    var r = tpl.content.firstElementChild.cloneNode(true);
    r.querySelector(".ur-naam").textContent = cap(naam);
    r.querySelector("legend").textContent = naam + ": open of gesloten";
    r.querySelectorAll("input[type=radio]").forEach(function (inp) { inp.name = "ur-d" + i; });
    r.querySelectorAll("input[type=time]").forEach(function (inp) { inp.setAttribute("aria-label", naam + ", " + inp.getAttribute("data-ur-label")); });
    lijst.appendChild(r); rijen.push(r);
  });
  function veld(r, k) { return r.querySelector("[data-ur=" + k + "]"); }
  function leesDag(i) {
    var r = rijen[i], st = r.querySelector("input[type=radio]:checked"), v = function (k) { return mins(veld(r, k).value); };
    var o = { st: st ? st.value : "", blokken: [], fout: "" };
    if (o.st !== "open") return o;
    var a = v("van"), b = v("tot"), pa = v("pvan"), pb = v("ptot");
    if (a == null || b == null) { o.fout = "vul het openingsuur en het sluituur in"; return o; }
    if (b <= a) { o.fout = "het sluituur ligt niet na het openingsuur"; return o; }
    if (pa != null && pb != null && pa > a && pb > pa && pb < b) o.blokken = [[a, pa], [pb, b]];
    else { o.blokken = [[a, b]]; if (pa != null || pb != null) o.fout = "de middagpauze valt niet binnen de uren, ze telt nog niet mee"; }
    return o;
  }
  function lees() {
    var dagen = DAGEN.map(function (x, i) { return leesDag(i); }), f = q("[data-ur-feest] input:checked"), ud = +q("[data-ur-uitz-dag]").value;
    var us = q("[data-ur-uitz-st] input:checked"), a = mins(q("[data-ur=uvan]").value), b = mins(q("[data-ur=utot]").value);
    var uitz = ud >= 0 ? { dag: ud, st: us ? us.value : "dicht", blok: a != null && b != null && b > a ? [a, b] : null } : null;
    return { dagen: dagen, feest: f ? f.value : "", uitz: uitz, ingevuld: dagen.some(function (x) { return x.st; }) };
  }
  /* the blocks that count on one date: holiday, this week's exception, else the weekday */
  function blokkenOp(m, dt, vandaag) {
    var dag = m.dagen[wd(dt)], b = dag.st === "open" ? dag.blokken : [];
    if (m.feest === "dicht" && feest(dt)) return { b: [], waarom: "feestdag" };
    if (m.uitz && iso(plus(vandaag, m.uitz.dag - wd(vandaag))) === iso(dt)) {
      if (m.uitz.st === "dicht") return { b: [], waarom: "uitzondering" };
      if (m.uitz.blok) return { b: [m.uitz.blok], waarom: "uitzondering" };
    }
    return { b: b, waarom: "" };
  }
  function status(m, t) {
    var min = t.getHours() * 60 + t.getMinutes(), nu = blokkenOp(m, t, t), i, k;
    for (k = 0; k < nu.b.length; k++) if (min >= nu.b[k][0] && min < nu.b[k][1]) return { open: true, tot: nu.b[k][1], gauw: nu.b[k][1] - min <= 60 };
    for (i = 0; i < 8; i++) {
      var dt = i ? plus(t, i) : t, bb = blokkenOp(m, dt, t).b;
      for (k = 0; k < bb.length; k++) if (i || bb[k][0] > min) return { open: false, waarom: nu.waarom, dag: i ? DAGEN[wd(dt)] : "vandaag", om: bb[k][0] };
    }
    return { open: false, waarom: nu.waarom };
  }
  function tekstDag(dag) { return dag.st === "open" ? (dag.blokken.length ? dag.blokken.map(function (b) { return u(b[0]) + " tot " + u(b[1]); }).join(" en ") : "uren nog niet juist") : dag.st === "dicht" ? "gesloten" : "nog niet ingevuld"; }
  function klaar(dag) { return dag.st === "dicht" || (dag.st === "open" && dag.blokken.length > 0); }   /* decided and valid */
  /* consecutive days with the same hours become one row: ['maandag tot vrijdag', '9 u tot 18 u']. Only the on-page
     table (alles) lists undecided or wrong days; the three copy outputs and the Bericht line skip them, so nobody
     pastes 'nog niet ingevuld' into WhatsApp Business or a site (waarschuw() names those days instead). */
  function overzicht(m, lang, alles) {
    var N = lang ? DAGEN : KORT, rows = [], i, j;
    for (i = 0; i < 7; i = j) {
      if (!alles && !klaar(m.dagen[i])) { j = i + 1; continue; }
      var t = tekstDag(m.dagen[i]);
      for (j = i + 1; j < 7 && (alles || klaar(m.dagen[j])) && tekstDag(m.dagen[j]) === t; j++) { /* same hours */ }
      rows.push([j - i > 1 ? N[i] + (lang ? " tot " : "–") + N[j - 1] : N[i], t]);
    }
    return rows;
  }
  function feestZin(m) { return m.feest === "dicht" ? "Op feestdagen zijn we gesloten." : m.feest === "open" ? "Op feestdagen zijn we open zoals anders." : ""; }
  function uitzZin(m, t) {
    if (!m.uitz) return "";
    var dt = plus(t, m.uitz.dag - wd(t));
    if (iso(dt) < iso(t)) return "";
    return "Deze week, " + datum(dt) + ": " + (m.uitz.st === "dicht" ? "gesloten" : m.uitz.blok ? "open " + u(m.uitz.blok[0]) + " tot " + u(m.uitz.blok[1]) : "andere uren") + ".";
  }
  function zinNu(st) { return st.open ? "nu open, " + (st.gauw ? "sluit binnenkort, om " : "tot ") + u(st.tot) : "nu gesloten" + (st.dag ? ", opnieuw open " + st.dag + " " + u(st.om) : ""); }
  function googleLijn(st) {
    if (st.open) return st.gauw ? "Sluit binnenkort · " + hm(st.tot) : "Nu open · sluit om " + hm(st.tot);
    return "Nu gesloten" + (st.waarom === "feestdag" ? " · feestdag" : st.waarom ? " · afwijkende uren" : "") + (st.dag ? " · opent " + st.dag + " om " + hm(st.om) : "");
  }
  function waTekst(m, t, st, zaak) {
    var regels = ["Dag, bedankt voor je bericht" + (zaak ? " aan " + zaak : "") + ". We zijn op dit moment gesloten en lezen je bericht zodra we opnieuw open zijn" + (st.open || !st.dag ? "." : ": " + st.dag + " om " + u(st.om) + ".")];
    var rows = overzicht(m, false);
    if (rows.length) regels.push("Onze uren: " + rows.map(function (r) { return r[0] + " " + r[1]; }).join(", ") + ".");
    return regels.concat([feestZin(m), uitzZin(m, t)].filter(Boolean)).join("\n");
  }
  function platteTekst(m, t, zaak) {
    return ["Openingsuren" + (zaak ? " " + zaak : "")].concat(overzicht(m, true).map(function (r) { return cap(r[0]) + ": " + r[1]; }), [feestZin(m), uitzZin(m, t)].filter(Boolean)).join("\n");
  }
  function htmlBlok(m, t, zaak) {
    var rows = overzicht(m, true).map(function (r) { return '    <tr><th scope="row">' + cap(r[0]) + "</th><td>" + r[1] + "</td></tr>"; });
    var extra = [feestZin(m), uitzZin(m, t)].filter(Boolean).map(function (z) { return "  <p>" + z + "</p>"; });
    return ['<div class="openingsuren">', "  <h2>Openingsuren" + (zaak ? " van " + esc(zaak) : "") + "</h2>"].concat(rows.length ? ["  <table>"].concat(rows, ["  </table>"]) : [], extra, ["</div>"]).join("\n");
  }
  function waarschuw(m, t) {
    var w = [], i, za = m.dagen[5];
    for (i = 0; i < 7; i++) {
      if (!m.dagen[i].st) w.push(cap(DAGEN[i]) + ": open of gesloten? Zolang dat niet ingevuld is, weet een klant 's avonds niet of je open bent.");
      else if (m.dagen[i].fout) w.push(cap(DAGEN[i]) + ": " + m.dagen[i].fout + ".");
    }
    if (za.st === "open" && za.blokken.length === 1 && za.blokken[0][1] - za.blokken[0][0] >= 360) w.push("Zaterdag open van " + u(za.blokken[0][0]) + " tot " + u(za.blokken[0][1]) + " zonder middagpauze: klopt dat? Sluit je 's middags toch even, zet de pauze erbij, anders staat er iemand voor een dichte deur.");
    if (!m.feest) for (i = 0; i < FEEST.length; i++) {
      var dt = new Date(FEEST[i][0] + "T12:00:00"), diff = (dt - t) / 864e5;
      if (diff > -1 && diff <= 31 && m.dagen[wd(dt)].st === "open") { w.push(cap(datum(dt)) + " is een feestdag (" + FEEST[i][1] + ") en normaal ben je dan open. Kies hierboven wat je op feestdagen doet, zodat je uren overal kloppen."); break; }
    }
    if (m.uitz && m.uitz.st === "open" && !m.uitz.blok) w.push("De uitzondering van deze week heeft nog geen uren: vul van en tot in.");
    return w;
  }
  function vul(el, items, maak) { while (el.firstChild) el.removeChild(el.firstChild); items.forEach(function (it) { el.appendChild(maak(it)); }); }

  function render() {
    var m = lees(), t = now(), s = S ? S.get() : { zaak: "" }, zaak = s.zaak || "";
    rijen.forEach(function (r, i) { r.querySelector(".ur-tijden").hidden = m.dagen[i].st !== "open"; });
    q("[data-ur-uitz-velden]").hidden = !m.uitz;
    q("[data-ur-uitz-uren]").hidden = !m.uitz || m.uitz.st !== "open";
    out.hidden = !m.ingevuld; hint.hidden = m.ingevuld;
    if (!m.ingevuld) return;
    var st = status(m, t), lijn = q("[data-ur-gk-lijn]");
    q("[data-ur-gk-naam]").textContent = zaak || "Jouw zaak";
    lijn.textContent = googleLijn(st); lijn.classList.toggle("is-dicht", !st.open);
    q("[data-ur-zin]").textContent = cap(zinNu(st)) + ". Klok van je toestel: " + datum(t) + ", " + hm(t.getHours() * 60 + t.getMinutes()) + ". Voorbeeldweergave, niet live van Google.";
    teksten = { wa: waTekst(m, t, st, zaak), tekst: platteTekst(m, t, zaak), html: htmlBlok(m, t, zaak) };
    q("[data-ur-wa]").textContent = teksten.wa; q("[data-ur-html]").textContent = teksten.html;
    vul(q("[data-ur-tabel]"), overzicht(m, true, true), function (r) { var tr = d.createElement("tr"), th = d.createElement("th"), td = d.createElement("td"); th.scope = "row"; th.textContent = cap(r[0]); td.textContent = r[1]; tr.appendChild(th); tr.appendChild(td); return tr; });
    var extra = [feestZin(m), uitzZin(m, t)].filter(Boolean); q("[data-ur-extra]").textContent = extra.join(" ");
    var w = waarschuw(m, t), ul = q("[data-ur-warn]");
    vul(ul, w, function (z) { var li = d.createElement("li"); li.textContent = z; return li; });
    ul.hidden = !w.length; q("[data-ur-ok]").hidden = !!w.length;
  }
  function metCredit(k) { var tx = teksten[k] || ""; if (!credit.checked || !CREDIT) return tx; return k === "html" ? tx.replace(/\n<\/div>$/, "\n  <p><small>" + esc(CREDIT) + "</small></p>\n</div>") : tx + "\n\n" + CREDIT; }

  sec.addEventListener("input", render);
  sec.addEventListener("change", render);
  if (S) S.subscribe(render); else render();
  q("[data-ur-vul]").addEventListener("click", function () {
    rijen.slice(0, 5).forEach(function (r) { r.querySelector("input[value=open]").checked = true; veld(r, "van").value = "09:00"; veld(r, "tot").value = "18:00"; });
    render(); try { rijen[5].querySelector("input[type=radio]").focus(); } catch (e) { /* no focus */ }
  });
  sec.querySelectorAll("[data-ur-copy]").forEach(function (b) { b.addEventListener("click", function () { T.copy(metCredit(b.getAttribute("data-ur-copy")), b); }); });
  var cta = q("[data-bericht=uren]");
  if (cta) cta.addEventListener("click", function (e) {
    var B = window.STSBericht;
    if (!B || typeof B.prefill !== "function") return;
    e.preventDefault();
    var m = lees();
    var rows = overzicht(m, false);
    B.prefill({ key: "uren", lines: rows.length ? ["Mijn uren volgens de check: " + rows.map(function (r) { return r[0] + " " + r[1]; }).join("; ") + "."] : [] });
  });
  window.STSUren = { setNow: function (dt) { nowOverride = dt ? new Date(dt) : null; render(); }, render: render, lees: lees, status: status, copyText: metCredit, FEEST: FEEST };
})();
