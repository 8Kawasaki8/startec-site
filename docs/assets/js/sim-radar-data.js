/* Data for the replay 'Van radar tot gesprek' (werkwijze.html#radar, sim-radar.js). Content only.

   RULES OF THIS FILE (Eerlijkheidsregels, WP-09)
   - One FICTIONAL neighbour per sector; sim-radar.js appends '(verzonnen)' to the name wherever it
     is shown and never puts the visitor's own name in the replay. The visitor's gemeente is used as
     context only ('een buur in Hoboken'); the neighbour's default gemeente stands when none is set.
   - 'aan' is the hard-coded, invented stand of the six public signals (1 on, 0 off) in the order of
     'signalen'. The ring shows STSScore.score over those values: the same six questions and the same
     rule as the zichtbaarheidscheck. It is an illustration of how we look, never a measurement, and
     nothing here claims a formula.
   - 'vondst' are three plain sentences the verkenner would write down: only things a zaak made public
     itself. No numbers of calls, visits or revenue, no studies, no reports.
   - 'aanleiding' is the one opening sentence of the first-contact draft for this neighbour (u-vorm,
     {zaak} allowed); it fills {aanleiding} in radar-bericht.json and must agree with 'vondst', so the
     letter of step 4 never contradicts the findings of step 1.
   - 'kaarten' names the three public sources the bouwer uses; the example hours and street come from
     preview-data.js (every line marked 'voorbeeld'). */
window.SIM_RADAR = {
  signalen: [
    { id: "profiel", label: "Google-profiel in eigen beheer" },
    { id: "uren", label: "Openingsuren overal gelijk" },
    { id: "contact", label: "Bellen of WhatsApp in één tik" },
    { id: "gsm", label: "Site laadt op een gsm" },
    { id: "reviews", label: "Reviews beantwoord" },
    { id: "fotos", label: "Foto's van de laatste zes maanden" }
  ],
  kaarten: [
    { id: "profiel", titel: "Google-profiel", uit: "wat de zaak zelf invulde: naam, soort zaak, telefoonnummer" },
    { id: "uren", titel: "Openingsuren", uit: "zoals ze op het profiel staan; voorbeelduren in deze schets" },
    { id: "adres", titel: "Adres en route", uit: "het publieke adres, met een routeknop" }
  ],
  buren: {
    horeca: { zaak: "Taverne Het Anker", gemeente: "Deurne", aan: [1, 0, 0, 0, 1, 0],
      vondst: ["Google-profiel gevonden, met adres en telefoonnummer, maar met uren van voor de zomer.", "Geen eigen website: wie 's avonds zoekt, vindt enkel het profiel en een Facebook-pagina.", "Reviews staan er; de helft kreeg nooit een antwoord."],
      aanleiding: "Wie {zaak} 's avonds op zijn gsm zoekt, vindt vandaag enkel uw Google-profiel en geen site die op een gsm werkt." },
    kapper: { zaak: "Kapsalon Mira", gemeente: "Berchem", aan: [1, 1, 0, 0, 0, 1],
      vondst: ["Google-profiel in orde, met recente foto's van het salon.", "De website laadt op een gsm pas na acht seconden en heeft geen belknop.", "Een afspraak maken kan enkel telefonisch, ook na sluitingstijd."],
      aanleiding: "Wie {zaak} 's avonds op zijn gsm zoekt, wacht acht seconden op uw site en vindt dan geen knop om te bellen." },
    garage: { zaak: "Garage Dewilde", gemeente: "Hoboken", aan: [0, 0, 0, 1, 0, 0],
      vondst: ["Google-profiel bestaat, maar niemand van de zaak beheert het: de uren staan op 'onbekend'.", "De website werkt op een gsm, maar nummer en adres staan enkel in een afbeelding.", "Nergens een knop om te bellen of een foto van een defect te sturen."],
      aanleiding: "Wie {zaak} op zijn gsm zoekt, vindt uw site wel, maar kan uw nummer en adres niet aantikken: ze staan in een afbeelding." },
    bakker: { zaak: "Bakkerij Zonnewende", gemeente: "Merksem", aan: [1, 0, 1, 0, 0, 1],
      vondst: ["Google-profiel in eigen beheer, met foto's van de toog van deze maand.", "Geen website; de feestdaguren staan enkel op een briefje aan de deur.", "Bellen kan vanaf het profiel, maar de uren op Facebook wijken af van die op Google."],
      aanleiding: "Wie {zaak} 's avonds op zijn gsm zoekt, vindt uw profiel, maar geen site, en op Facebook andere uren dan op Google." },
    aannemer: { zaak: "Schrijnwerkerij Maes", gemeente: "Wilrijk", aan: [0, 0, 0, 0, 0, 1],
      vondst: ["Geen Google-profiel; enkel een vermelding in een gouden gids van jaren geleden.", "Een website van een vorige eigenaar, met een e-mailadres dat niet meer bestaat.", "Recente foto's van werken staan er wel, op een persoonlijke Facebook-pagina."],
      aanleiding: "Wie {zaak} op zijn gsm zoekt, vindt enkel een oude site van de vorige eigenaar, met een e-mailadres dat niet meer bestaat." },
    praktijk: { zaak: "Praktijk Moens", gemeente: "Borgerhout", aan: [1, 1, 0, 0, 1, 0],
      vondst: ["Google-profiel in eigen beheer, met juiste uren en een beantwoorde review.", "De website toont de uren, maar op een gsm staan ze onderaan, onder drie schermen tekst.", "Bellen kan enkel tijdens de uren; buiten de uren staat er geen andere weg."],
      aanleiding: "Wie {zaak} 's avonds op zijn gsm zoekt, vindt uw uren pas onder drie schermen tekst en buiten de uren geen andere weg dan bellen." },
    winkel: { zaak: "Bloemen Lieve", gemeente: "Mortsel", aan: [1, 0, 0, 1, 0, 1],
      vondst: ["Google-profiel met mooie recente foto's, maar de zondaguren kloppen niet meer.", "De website laadt vlot op een gsm, maar nergens staat een knop om te bellen of te bestellen.", "Reviews van het voorjaar staan nog zonder antwoord."],
      aanleiding: "Wie {zaak} 's avonds op zijn gsm zoekt, vindt uw site vlot, maar nergens een knop om te bellen of te bestellen." },
    anders: { zaak: "Zaak Op den Hoek", gemeente: "Antwerpen", aan: [1, 0, 0, 0, 0, 0],
      vondst: ["Google-profiel gevonden, met adres, maar zonder uren en zonder foto's.", "Geen website die op een gsm werkt.", "Geen knop om te bellen of een bericht te sturen."],
      aanleiding: "Wie {zaak} 's avonds op zijn gsm zoekt, vindt vandaag enkel uw Google-profiel en geen site die op een gsm werkt." }
  }
};
