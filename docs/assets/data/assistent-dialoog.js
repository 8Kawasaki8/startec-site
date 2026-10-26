/* Data for the proef 'Antwoord buiten de uren' (werkwijze.html#kaart, under In onderzoek; lab-assistent.js).
   Content only; build.py copies this file to docs/assets/data/.

   RULES OF THIS FILE (Eerlijkheidsregels, WP-10)
   - This is a DESIGN SKETCH of research, scripted from start to finish. There is no model behind it,
     nothing is sent, nothing is stored. The header 'kop' says so and stays visible in the panel.
   - The zaak is FICTIONAL (Brasserie Meridiaan, verzonnen); its hours, menu and practical notes below
     are the ONLY knowledge the sketched assistant has. Every answer names its source with a chip that
     starts with 'uit:' and 'blok' names the block in 'kennis' that lights up; every block is visible in the panel.
   - The questions are the customer's words (chips in src/rooms/kaart.html, data-voice=customer); the
     ids here must match the data-vraag attributes of those chips.
   - A question the blocks cannot answer (twintig man) is handed over: 'overdracht' true, no invented
     answer, the card reads 'doorgegeven (gesimuleerd)'.
   - 'scenario' names the assumed moment; the sketch never pretends to know the real time or day.
   - No prices on the menu, no counters, no 'verzonden' state, and the name of any prototype of ours
     does not appear here: this panel is not a demonstration of a prototype. */
window.STS_ASSISTENT = {
  zaak: "Brasserie Meridiaan (verzonnen)",
  kop: "In onderzoek · gescripte simulatie, geen live AI. Zo zou het kunnen werken; dit bestaat nog niet als product.",
  scenario: "Scenario: dinsdagavond, 21 u. De zaak is open tot 22 u, maar niemand heeft tijd voor de telefoon.",
  kennis: [
    { id: "uren", titel: "Openingsuren", regels: [
      "maandag: gesloten", "dinsdag: 11-22 u", "woensdag: 11-22 u", "donderdag: 11-22 u",
      "vrijdag: 11-23 u", "zaterdag: 11-23 u", "zondag: 11-21 u", "keuken sluit een half uur voor sluitingstijd"
    ] },
    { id: "menu", titel: "Menukaart (uittreksel, zonder prijzen)", regels: [
      "dagsoep", "stoofvlees met frieten", "vol-au-vent", "vegetarische quiche",
      "taart van de dag; een hele taart bestel je twee dagen vooraf, telefonisch",
      "glutenvrij brood op vraag"
    ] },
    { id: "praktisch", titel: "Praktisch", regels: [
      "parking: zes plaatsen achter het gebouw; op straat vrij parkeren vanaf 18 u",
      "groepen: tot twaalf personen aan één tafel"
    ] }
  ],
  antwoorden: {
    open: {
      tekst: "Ja. Vandaag, dinsdag, zijn we open tot 22 u; de keuken sluit om 21.30 u. Kom je nog iets eten, dan is het best meteen.",
      bron: "uit: openingsuren, dinsdag 11-22 u", blok: "uren"
    },
    taart: {
      tekst: "Een hele taart bestel je twee dagen vooraf, telefonisch. Voor zaterdag bel je dus ten laatste donderdag tijdens de uren. Bestellen kan niet via mij.",
      bron: "uit: menukaart, taart van de dag", blok: "menu"
    },
    parking: {
      tekst: "Er zijn zes plaatsen achter het gebouw. Op straat parkeer je vrij vanaf 18 u, dus vanavond ook.",
      bron: "uit: praktisch, parking", blok: "praktisch"
    },
    glutenvrij: {
      tekst: "Glutenvrij brood is er op vraag. Over de andere gerechten staat niets op de kaart; dat vraag je best even aan de uitbater zelf, aan de telefoon of aan tafel.",
      bron: "uit: menukaart, glutenvrij brood", blok: "menu"
    },
    twintig: {
      overdracht: true,
      tekst: "Dat weet ik niet zeker. Ik geef dit door aan de zaak; je krijgt antwoord van een mens.",
      bron: "uit: praktisch staat enkel 'tot twaalf personen'; meer weet ik niet", blok: "praktisch",
      kaart: "doorgegeven (gesimuleerd)",
      uitleg: "In het echt zou de uitbater deze vraag zelf zien en zelf antwoorden. Hier gebeurt niets: er vertrekt geen bericht en er wordt niets bewaard."
    }
  },
  wacht: "De assistent leest de drie blokken hierboven",
  slot: "Alles wat deze schets zegt, komt uit de drie blokken hierboven. Weet ze het niet, dan verzint ze niets en geeft ze de vraag door."
};
