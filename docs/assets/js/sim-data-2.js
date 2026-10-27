/* Doorlichting, part two: the fourth FICTIONAL business (Dakwerken Pauwels, Hoboken, an
   aannemer: aanvragen 's avonds, offerte-opvolging, reviews, mobiele laadtijd), the map from
   the gevel's sector chips to the business whose pattern comes closest, and the wat-als switch
   per advice for all four businesses. Every number is invented. Loads after sim-data.js and
   extends window.SIM_DATA in place.
   SECTOR MAP: bakker, kapper, garage and aannemer have their own business. praktijk -> lumen:
   a practice runs on appointments and a phone that rings during treatments, the kapper's pattern,
   until a fifth business exists (say it here, not in the copy). horeca and winkel -> noordpool:
   a counter that is full while the phone rings. anders: no preference, the first chip stays.
   WAT-ALS: whatif[biz][i] is the switch of advice i; 'rule' names a pure function in
   sim-whatif.js (documented in its header), the other keys are its parameters. The charts read
   the same arrays as the findings, so scripts/qa/sim-check.mjs can recompute every counter. */
(function () {
  var D = window.SIM_DATA; if (!D) return;
  D.businesses.pauwels = {
    name: "Dakwerken Pauwels", place: "Hoboken", kind: "dakwerker", sector: "aannemer",
    titles: {
      calls:  { src: "oproeplijst van de gsm" },
      search: { title: "Zoekopdrachten ‘dakwerker’ per uur", sub: "met de bereikbare uren als band, 4 weken" }
    },
    calls: { from: 7, answered: [6, 9, 8, 6, 7, 9, 6, 5, 7, 10, 12, 10], missed: [2, 5, 8, 10, 9, 4, 8, 9, 7, 3, 2, 1], focus: [2, 5],
      callout: { v: "51 %", t: "gemist tussen 9 en 13 u, op het dak" } },
    search: { values: [1, 0, 0, 0, 0, 1, 3, 5, 8, 9, 8, 7, 8, 7, 6, 7, 9, 12, 15, 19, 22, 14, 6, 2], open: [7, 17], openLabel: "bereikbaar 7–17 u", bandLabel: "bereikbare uren", label: "zoekopdrachten ‘dakwerker’", focus: [17, 21],
      callout: { v: "56 %", t: "zoekt na de werkuren, piek om 20 u" } },
    reviews: { total: [4, 3, 5, 4, 3, 6, 5, 7, 6, 8, 7, 6], unanswered: [1, 1, 2, 1, 1, 3, 2, 4, 4, 5, 4, 4], score: [4.5, 4.5, 4.4, 4.4, 4.4, 4.3, 4.3, 4.2, 4.1, 4.0, 4.0, 3.9], focus: [7, 11],
      callout: { v: "4,5 → 3,9", t: "score; 21 reviews sinds juni zonder antwoord" } },
    web: { mobile: [142, 151, 139, 160, 171, 166, 180, 188], desktop: [38, 41, 40, 44, 40, 47, 43, 45], load: { mobile: 6.8, desktop: 2.2, ref: 2.5 },
      callout: { v: "6,8 s", t: "laadtijd op gsm, richtwaarde 2,5 s" } },
    findings: [
      { sev: "hoog",   title: "1 op 2 oproepen tussen 9 en 13 u gemist, op het dak", value: "51 %", proof: "31 van 61 oproepen, 4 weken, ma–vr" },
      { sev: "hoog",   title: "Meer dan de helft zoekt een dakwerker na 17 u", value: "56 %", proof: "95 van 169 zoekopdrachten na de werkuren; piek om 20 u" },
      { sev: "middel", title: "Score zakt van 4,5 naar 3,9; 21 reviews zonder antwoord", value: "4,5 → 3,9", proof: "21 van de 34 reviews sinds juni onbeantwoord; 9 over een offerte die niet kwam" },
      { sev: "middel", title: "Laadtijd 6,8 s op gsm, waar 79 % van het bezoek vandaan komt", value: "6,8 s", proof: "richtwaarde 2,5 s; 1.635 bezoeken in 8 weken; het aanvraagformulier staat onderaan de laatste pagina" }
    ],
    advice: [
      { title: "Terugbelbericht en WhatsApp-knop voor wie overdag belt", why: "51 % van de oproepen tussen 9 en 13 u gaat verloren terwijl Pauwels op een dak staat. Een bericht met het uur waarop hij terugbelt en een WhatsApp-knop houden de aanvraag vast.", impact: "+8 tot +14 bereikte aanvragers per week" },
      { title: "Aanvraagformulier met foto en ontvangstbevestiging, ook om 20 u", why: "56 % zoekt na 17 u. Een formulier waarop een klant een foto van zijn dak stuurt, met meteen een bevestiging en een termijn voor de offerte, vangt die avondvraag op.", impact: "+4 tot +7 offerteaanvragen per week" },
      { title: "Offerte-opvolging en reviews beantwoorden binnen 24 u", why: "9 reviews gaan over een offerte die niet kwam en 21 bleven sinds juni onbeantwoord. Een vaste termijn per offerte en een antwoord op elke review keren de score.", impact: "score +0,2 tot +0,3 in 3 maanden" }
    ],
    log: {
      intro: [["verkenner", "Google-profiel gelezen: 4,2 sterren, 64 reviews, bereikbaar ma–vr 7–17 u. Geen website gekoppeld, wel een Facebook-pagina."],
              ["verkenner", "Website gevonden via Facebook: 4 pagina’s, aanvraagformulier onderaan de laatste pagina, geen WhatsApp, geen foto-upload."]],
      calls:   [["meter", "Oproeplijst van de gsm gelezen: 163 oproepen in 4 weken, 68 gemist. Lees per uur."],
                ["meter", "51 % van de oproepen tussen 9 en 13 u gemist: 31 van 61. Pauwels staat dan op een dak, de gsm in de bus."]],
      search:  [["meter", "Google: 169 zoekopdrachten ‘dakwerker’ met een klik naar het profiel in 4 weken. Leg naast de bereikbare uren."],
                ["meter", "56 % zoekt na 17 u; piek om 20 u, als de klant thuis naar zijn plafond kijkt."]],
      reviews: [["lezer", "64 reviews gelezen, 12 maanden. Tel de antwoorden en volg de score."],
                ["lezer", "Score zakt van 4,5 naar 3,9. 21 van de 34 reviews sinds juni zonder antwoord; 9 noemen een offerte die nooit kwam."]],
      web:     [["meter", "Serverlogs: 1.635 bezoeken in 8 weken. Meet de laadtijd op gsm en desktop."],
                ["meter", "79 % van het bezoek is mobiel. Laadtijd 6,8 s op gsm, 2,2 s op desktop. Richtwaarde: 2,5 s."]],
      advice:  ["planner", "Drie acties opgesteld, gerangschikt op impact. Schattingen op gesimuleerde data."]
    }
  };

  D.sectorMap = { bakker: "noordpool", kapper: "lumen", garage: "verhulst", aannemer: "pauwels", praktijk: "lumen", horeca: "noordpool", winkel: "noordpool" };

  D.whatif_note = "schatting op gesimuleerde data, geen voorspelling voor jouw zaak";
  D.whatif = {
    noordpool: [
      { rule: "calls_shift", p: 0.6 },
      { rule: "search_gap", listed: [6.5, 18.5], listedLabel: "Google: tot 18.30 u" },
      { rule: "reviews_answer", p: 0.8 }
    ],
    lumen: [
      { rule: "calls_shift", p: 0.6 },
      { rule: "search_catch", p: 0.7, what: "zoekers buiten de uren zonder een plek om te boeken, per 4 weken" },
      { rule: "reviews_flow", add: 4 }
    ],
    verhulst: [
      { rule: "calls_shift", p: 0.6 },
      { rule: "search_catch", p: 0.6, what: "zoekers buiten de uren zonder een plek om een offerte te vragen, per 4 weken" },
      { rule: "reviews_answer", p: 0.8 }
    ],
    pauwels: [
      { rule: "calls_shift", p: 0.6 },
      { rule: "search_catch", p: 0.6, what: "zoekers na de werkuren zonder een plek om een aanvraag te laten, per 4 weken" },
      { rule: "reviews_answer", p: 0.8 }
    ]
  };
})();
/* WP-27: wat de uitbater na de doorlichting naar een collega doorstuurt (deel.js, [data-share=doorlichting]); regels in deel-data.js */
window.STS_DEEL = window.STS_DEEL || {};
window.STS_DEEL.doorlichting = "Kijk mee hoe een agent de cijfers van een verzonnen zaak leest, drie acties voorstelt en dan wacht tot een mens het goedkeurt. Gesimuleerde cijfers, echte methode: {site}simulatie.html";
