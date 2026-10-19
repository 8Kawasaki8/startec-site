/* Simulatieruimte: three FICTIONAL businesses with fictional datasets.
   Every number here is invented; sim.js reads the charts, findings and
   advice from this file. Keep findings in sync with the arrays (the
   percentages are recomputed by the QA script in the scratchpad). */
window.SIM_DATA = {
  charts: [
    { id: "calls",   n: 1, tab: "Oproepen", title: "Oproepen per uur",                 sub: "beantwoord en gemist, 4 weken",          src: "telefooncentrale" },
    { id: "search",  n: 2, tab: "Google",   title: "Zoekopdrachten ‘open nu’ per uur", sub: "met de openingsuren als band, 4 weken", src: "Google Bedrijfsprofiel" },
    { id: "reviews", n: 3, tab: "Reviews",  title: "Reviews per maand en score",        sub: "beantwoord, zonder antwoord, 12 maanden", src: "Google reviews" },
    { id: "web",     n: 4, tab: "Website",  title: "Websitebezoek en laadtijd",         sub: "mobiel en desktop, 8 weken",             src: "serverlogs en laadtijdmeting" }
  ],
  agents: ["verkenner", "meter", "lezer", "planner"],
  months: ["nov", "dec", "jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt"],
  advice_note: "schatting op gesimuleerde data",
  end_line: "Advies klaar. Wacht op goedkeuring van Snymis. Er vertrekt niets automatisch.",
  businesses: {
    noordpool: {
      name: "Bakkerij Noordpool", place: "Borgerhout", kind: "bakkerij",
      calls: { from: 7, answered: [18, 20, 26, 29, 27, 22, 19, 21, 24, 26, 23, 14], missed: [13, 10, 5, 3, 2, 6, 5, 2, 2, 3, 4, 5], focus: [0, 1],
        callout: { v: "38 %", t: "gemist tussen 7 en 9 u" } },
      search: { values: [2, 1, 1, 0, 0, 1, 6, 14, 22, 19, 16, 15, 21, 17, 12, 13, 18, 24, 21, 25, 12, 6, 3, 1], open: [6.5, 18], openLabel: "open 6.30–18 u", focus: [18, 22],
        callout: { v: "27 %", t: "zoekt buiten de uren, piek om 19 u" } },
      reviews: { total: [8, 11, 6, 7, 9, 10, 9, 12, 13, 10, 9, 8], unanswered: [1, 1, 0, 1, 1, 1, 1, 3, 4, 3, 3, 3], score: [4.6, 4.6, 4.7, 4.6, 4.5, 4.6, 4.5, 4.4, 4.2, 4.1, 4.1, 4.1], focus: [7, 11],
        callout: { v: "4,6 → 4,1", t: "score sinds juni, 16 reviews zonder antwoord" } },
      web: { mobile: [296, 310, 288, 334, 352, 341, 365, 372], desktop: [71, 68, 74, 80, 77, 83, 79, 86], load: { mobile: 7.4, desktop: 2.3, ref: 2.5 },
        callout: { v: "7,4 s", t: "laadtijd op gsm, richtwaarde 2,5 s" } },
      findings: [
        { sev: "hoog",   title: "38 % van de oproepen tussen 7 en 9 u gemist", value: "38 %", proof: "23 van 61 oproepen, 4 weken, ma–za" },
        { sev: "hoog",   title: "Google zegt open tot 18.30 u, de deur sluit om 18 u", value: "27 %", proof: "van de ‘open nu’-zoekopdrachten valt buiten de uren; piek om 19 u" },
        { sev: "middel", title: "Score zakt van 4,6 naar 4,1 sinds juni", value: "4,6 → 4,1", proof: "16 van de 52 recente reviews zonder antwoord" },
        { sev: "middel", title: "Laadtijd 7,4 s op gsm, waar 81 % van het bezoek vandaan komt", value: "7,4 s", proof: "richtwaarde 2,5 s; 3.276 bezoeken in 8 weken" }
      ],
      advice: [
        { title: "WhatsApp-bestelknop met automatisch antwoord in de ochtendspits", why: "Vangt de 38 % gemiste oproepen tussen 7 en 9 u op: bestellingen komen binnen als tekst, niet als gemiste oproep.", impact: "+10 tot +16 bestellingen per week" },
        { title: "Openingsuren op Google corrigeren en koppelen aan de site", why: "Eén bron voor de uren. De 27 % die buiten de uren zoekt, ziet dan meteen het juiste antwoord.", impact: "−60 tot −80 % klachten over een gesloten deur" },
        { title: "Reviews beantwoorden binnen 24 u, in jouw toon", why: "16 reviews sinds juni bleven onbeantwoord. Een antwoord houdt de score en de klant.", impact: "score +0,2 tot +0,4 in 3 maanden" }
      ],
      log: {
        intro: [["verkenner", "Google-profiel gelezen: 4,3 sterren, 112 reviews, open di–za 6.30–18 u, zo tot 13 u."],
                ["verkenner", "Website gevonden: 6 pagina’s, geen bestelknop, geen WhatsApp. Laatste update: 2023."]],
        calls:   [["meter", "Telefooncentrale gelezen: 329 oproepen in 4 weken, 60 gemist. Lees per uur."],
                  ["meter", "38 % van de oproepen tussen 7 en 9 u gemist: 23 van 61. De toonbank staat dan vol."]],
        search:  [["meter", "Google: 270 zoekopdrachten ‘open nu’ in 4 weken. Leg naast de openingsuren."],
                  ["meter", "27 % valt buiten de uren, piek om 19 u. Google toont 18.30 u als sluitingsuur; de deur sluit om 18 u."]],
        reviews: [["lezer", "112 reviews gelezen, 12 maanden. Tel de antwoorden en volg de score."],
                  ["lezer", "Score zakt van 4,6 naar 4,1 sinds juni. 16 van de 52 recente reviews zonder antwoord; 11 noemen een gesloten deur."]],
        web:     [["meter", "Serverlogs: 3.276 bezoeken in 8 weken. Meet de laadtijd op gsm en desktop."],
                  ["meter", "81 % van het bezoek is mobiel. Laadtijd 7,4 s op gsm, 2,3 s op desktop. Richtwaarde: 2,5 s."]],
        advice:  ["planner", "Drie acties opgesteld, gerangschikt op impact. Schattingen op gesimuleerde data."]
      }
    },
    lumen: {
      name: "Kapsalon Lumen", place: "Berchem", kind: "kapsalon",
      calls: { from: 9, answered: [14, 12, 10, 12, 15, 10, 8, 10, 13, 9], missed: [3, 9, 9, 4, 3, 8, 9, 7, 4, 2], focus: [1, 2],
        callout: { v: "45 %", t: "gemist tussen 10 en 12 u" } },
      search: { values: [1, 0, 0, 0, 0, 1, 3, 6, 12, 18, 16, 14, 19, 15, 13, 12, 14, 17, 16, 20, 13, 6, 2, 1], open: [9, 18], openLabel: "open 9–18 u", focus: [18, 22],
        callout: { v: "37 %", t: "zoekt buiten de uren, piek om 19 u" } },
      reviews: { total: [7, 6, 5, 4, 6, 5, 4, 3, 3, 2, 2, 2], unanswered: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0], score: [4.7, 4.8, 4.7, 4.7, 4.8, 4.7, 4.7, 4.6, 4.7, 4.8, 4.7, 4.7], focus: [9, 11],
        callout: { v: "2 per maand", t: "nieuwe reviews, tegen 7 een jaar geleden" } },
      web: { mobile: [188, 176, 201, 194, 210, 203, 198, 215], desktop: [31, 28, 33, 30, 27, 35, 29, 32], load: { mobile: 4.9, desktop: 1.9, ref: 2.5 },
        callout: { v: "4,9 s", t: "laadtijd op gsm, richtwaarde 2,5 s" } },
      findings: [
        { sev: "hoog",   title: "45 % van de oproepen tussen 10 en 12 u gemist", value: "45 %", proof: "18 van 40 oproepen, tijdens behandelingen" },
        { sev: "middel", title: "Een derde zoekt ‘open nu’ als de deur al dicht is", value: "37 %", proof: "81 van 219 zoekopdrachten buiten de uren; piek om 19 u" },
        { sev: "laag",   title: "De reviewstroom droogt op: van 7 naar 2 per maand", value: "2 per maand", proof: "score 4,7 blijft prima; 6 nieuwe reviews in 3 maanden" },
        { sev: "hoog",   title: "Boeken kan alleen per telefoon, 87 % surft mobiel", value: "87 %", proof: "1.830 bezoeken in 8 weken; 4,9 s laadtijd op gsm" }
      ],
      advice: [
        { title: "Online boeken op de site, met bevestiging via WhatsApp", why: "87 % surft mobiel en kan nu enkel bellen. Wie ’s avonds boekt, hoeft niet te wachten tot 9 u.", impact: "+6 tot +11 afspraken per week" },
        { title: "Automatisch antwoord buiten de uren, met de eerstvolgende vrije plaats", why: "37 % zoekt buiten de uren en 45 % van de oproepen tijdens behandelingen blijft onbeantwoord.", impact: "−40 tot −55 % gemiste oproepen" },
        { title: "Reviewvraag na elke afspraak, via sms of WhatsApp", why: "De stroom zakte van 7 naar 2 reviews per maand. Een score van 4,7 verdient nieuwe stemmen.", impact: "+5 tot +8 reviews per maand" }
      ],
      log: {
        intro: [["verkenner", "Google-profiel gelezen: 4,7 sterren, 68 reviews, open di–za 9–18 u. Maandag gesloten."],
                ["verkenner", "Website gevonden: 3 pagina’s, afspraken enkel per telefoon. Instagram actief."]],
        calls:   [["meter", "Telefooncentrale gelezen: 171 oproepen in 4 weken, 58 gemist. Lees per uur."],
                  ["meter", "45 % van de oproepen tussen 10 en 12 u gemist: 18 van 40. De handen zitten dan in het haar van een klant."]],
        search:  [["meter", "Google: 219 zoekopdrachten ‘open nu’ in 4 weken. Leg naast de openingsuren."],
                  ["meter", "37 % valt buiten de uren; piek om 19 u, een uur na het sluiten."]],
        reviews: [["lezer", "68 reviews gelezen, 49 uit de laatste 12 maanden. Tel de antwoorden en volg de score."],
                  ["lezer", "Score blijft 4,7, maar de stroom droogt op: van 7 naar 2 nieuwe reviews per maand."]],
        web:     [["meter", "Serverlogs: 1.830 bezoeken in 8 weken. Meet de laadtijd op gsm en desktop."],
                  ["meter", "87 % van het bezoek is mobiel. Laadtijd 4,9 s op gsm, 1,9 s op desktop. Geen knop om te boeken."]],
        advice:  ["planner", "Drie acties opgesteld, gerangschikt op impact. Schattingen op gesimuleerde data."]
      }
    },
    verhulst: {
      name: "Garage Verhulst", place: "Mortsel", kind: "garage",
      calls: { from: 8, answered: [19, 27, 31, 28, 24, 15, 22, 26, 25, 18], missed: [14, 11, 6, 4, 3, 8, 4, 3, 6, 13], focus: [0, 1],
        callout: { v: "35 %", t: "gemist tussen 8 en 10 u" } },
      search: { values: [1, 0, 0, 0, 0, 2, 5, 16, 24, 20, 17, 14, 15, 13, 12, 14, 19, 23, 20, 17, 11, 6, 3, 1], open: [8, 18], openLabel: "open 8–18 u", focus: [18, 21],
        callout: { v: "32 %", t: "zoekt buiten de uren, piek om 18 u" } },
      reviews: { total: [11, 9, 10, 12, 9, 13, 10, 14, 15, 12, 13, 11], unanswered: [3, 2, 3, 4, 3, 5, 4, 6, 7, 6, 7, 6], score: [4.4, 4.4, 4.3, 4.3, 4.2, 4.2, 4.1, 4.0, 3.9, 3.9, 3.8, 3.9], focus: [7, 11],
        callout: { v: "4,4 → 3,9", t: "score; 32 reviews sinds juni zonder antwoord" } },
      web: { mobile: [241, 228, 256, 249, 262, 238, 270, 259], desktop: [92, 88, 97, 101, 95, 90, 104, 99], load: { mobile: 5.6, desktop: 2.4, ref: 2.5 },
        callout: { v: "5,6 s", t: "laadtijd op gsm, richtwaarde 2,5 s" } },
      findings: [
        { sev: "hoog",   title: "35 % van de oproepen tussen 8 en 10 u gemist", value: "35 %", proof: "25 van 71 oproepen, bij het binnenbrengen van wagens" },
        { sev: "middel", title: "1 op 3 zoekt ‘open nu’ buiten de uren", value: "32 %", proof: "82 van 253 zoekopdrachten; piek om 18 u, net na het sluiten" },
        { sev: "hoog",   title: "Score zakt van 4,4 naar 3,9; 32 reviews zonder antwoord", value: "3,9", proof: "32 van de 65 reviews sinds juni onbeantwoord; 14 over een offerte" },
        { sev: "middel", title: "Laadtijd 5,6 s op gsm, 72 % van het bezoek", value: "5,6 s", proof: "richtwaarde 2,5 s; 2.769 bezoeken in 8 weken" }
      ],
      advice: [
        { title: "Terugbelverzoek via WhatsApp tijdens de ochtendspits", why: "35 % van de oproepen tussen 8 en 10 u blijft onbeantwoord terwijl de balie vol staat. Een bericht wacht wel.", impact: "+12 tot +20 teruggebelde klanten per week" },
        { title: "Offerte- en afspraakformulier met automatische ontvangstbevestiging", why: "Wie een offerte vraagt, hoort meteen wanneer hij antwoord krijgt. 14 reviews klagen precies daarover.", impact: "−70 tot −90 % klachten over offertes" },
        { title: "Reviews beantwoorden binnen 24 u, reviewvraag bij het ophalen", why: "32 reviews sinds juni zonder antwoord en een score die naar 3,9 zakte. Antwoorden is zichtbaar voor elke lezer.", impact: "score +0,2 tot +0,3 in 3 maanden" }
      ],
      log: {
        intro: [["verkenner", "Google-profiel gelezen: 4,1 sterren, 203 reviews, open ma–vr 8–18 u, za tot 12.30 u."],
                ["verkenner", "Website gevonden: 9 pagina’s. Het offerteformulier mailt naar een adres zonder automatisch antwoord."]],
        calls:   [["meter", "Telefooncentrale gelezen: 307 oproepen in 4 weken, 72 gemist. Lees per uur."],
                  ["meter", "35 % van de oproepen tussen 8 en 10 u gemist: 25 van 71. Iedereen staat dan aan de balie."]],
        search:  [["meter", "Google: 253 zoekopdrachten ‘open nu’ in 4 weken. Leg naast de openingsuren."],
                  ["meter", "32 % valt buiten de uren; piek om 18 u, net na het sluiten. Zaterdagnamiddag dicht, zondag veel zoekers."]],
        reviews: [["lezer", "203 reviews gelezen, 139 uit de laatste 12 maanden. Tel de antwoorden en volg de score."],
                  ["lezer", "Score zakt van 4,4 naar 3,9. 32 van de 65 reviews sinds juni zonder antwoord; 14 noemen een offerte die nooit kwam."]],
        web:     [["meter", "Serverlogs: 2.769 bezoeken in 8 weken. Meet de laadtijd op gsm en desktop."],
                  ["meter", "72 % van het bezoek is mobiel. Laadtijd 5,6 s op gsm, 2,4 s op desktop. Richtwaarde: 2,5 s."]],
        advice:  ["planner", "Drie acties opgesteld, gerangschikt op impact. Schattingen op gesimuleerde data."]
      }
    }
  }
};
