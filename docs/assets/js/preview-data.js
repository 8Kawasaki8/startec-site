/* Preview data for the gevel sketch (preview.js) and the neighbour chips (gevel.js).
   Content only, no code: change words here, never in the city.

   RULES OF THIS FILE (Eerlijkheidsregels, WP-05)
   - A preset promises only what the free example really holds: the name, the opening
     hours, the address, a call and a WhatsApp button, a reviews placeholder and a photo
     placeholder. No bookings, no agenda link, no order tracking, no garantie, no
     response-time promise. The words 'garantie', 'live uit je agenda' and '24 uur' are
     forbidden in the gevel room (lint-copy scope 'gevel' and the rendered-text scan).
   - Every preset line is rendered with the marker 'voorbeeld' next to it (preview.js
     appends it); the hours, the address and the status are invented examples.
   - The sketch is the site of the visitor's own business speaking to its customers:
     'je' for every sector, 'u' for the praktijk (names.js STSNames.aanspreek).
   - Neighbours are FICTIONAL businesses (names from the Doorlichting set) and are
     shown with '(verzonnen)' in the name itself; the founder may replace them with
     his own fixtures without touching gevel.js.
   Keys follow STSNames.SECTORS: horeca, kapper, garage, bakker, aannemer, praktijk, winkel, anders.
   Fields: tag (one line under the name), open (the 'nu open' status), foto (photo placeholder
   label), adres (street example), uren (three rows of example hours), actie (the main button in the owner's words),
   blok (one sector block: a title and three example lines; no prices, no stars). */
window.STS_PREVIEW = {
  sectors: {
    horeca: {
      tag: "Vanavond open? Hier zie je het meteen, met de weg ernaartoe.",
      open: "Nu open tot 22 u", foto: "Foto van de zaal of het terras", adres: "Kerkstraat 12",
      uren: [["Ma – do", "11:30 – 22:00"], ["Vr – za", "11:30 – 23:00"], ["Zo", "gesloten"]],
      actie: "Reserveer een tafel", blok: { titel: "Vandaag op de kaart", items: ["Dagsoep", "Stoofvlees met frietjes", "Vegetarische curry"] }
    },
    kapper: {
      tag: "Een stoel vrij? Bel of stuur een berichtje, ook na sluitingstijd.",
      open: "Nu open tot 18 u", foto: "Foto van het salon", adres: "Statiestraat 48",
      uren: [["Di – vr", "9:00 – 18:00"], ["Za", "8:30 – 16:00"], ["Zo – ma", "gesloten"]],
      actie: "Maak een afspraak", blok: { titel: "Behandelingen", items: ["Knippen, 30 min", "Kleuren, 90 min", "Baard bijwerken, 20 min"] }
    },
    garage: {
      tag: "Onderhoud, keuring of een vreemd geluid: bel of stuur een foto via WhatsApp.",
      open: "Nu open tot 18 u", foto: "Foto van de werkplaats", adres: "Industrieweg 7",
      uren: [["Ma – vr", "8:00 – 18:00"], ["Za", "9:00 – 12:00"], ["Zo", "gesloten"]],
      actie: "Plan een onderhoud", blok: { titel: "In de werkplaats", items: ["Onderhoud en keuring", "Banden wisselen", "Diagnose van een vreemd geluid"] }
    },
    bakker: {
      tag: "Elke ochtend vers. De uren staan hier, ook op feestdagen.",
      open: "Nu open tot 18 u", foto: "Foto van de toog", adres: "Dorpsstraat 3",
      uren: [["Di – vr", "6:30 – 18:00"], ["Za – zo", "6:30 – 13:00"], ["Ma", "gesloten"]],
      actie: "Bestel voor morgen", blok: { titel: "Vandaag vers", items: ["Desembrood", "Croissants", "Taart op bestelling"] }
    },
    aannemer: {
      tag: "Een aanvraag of een offerte? Stuur foto's van de werf via WhatsApp of bel.",
      open: "Vandaag bereikbaar tot 17 u", foto: "Foto van recent werk", adres: "Molenstraat 21",
      uren: [["Ma – vr", "7:30 – 17:00"], ["Za", "op afspraak"], ["Zo", "gesloten"]],
      actie: "Vraag een offerte", blok: { titel: "Recente werken", items: ["Badkamerrenovatie", "Dakwerken", "Gevelrenovatie"] }
    },
    praktijk: {
      tag: "Maandagochtend is de lijn druk. Hier vindt u de uren, het adres en hoe u ons bereikt.",
      open: "Vandaag open tot 19 u", foto: "Foto van de wachtruimte", adres: "Lange Leemstraat 90",
      uren: [["Ma – vr", "8:00 – 19:00"], ["Za", "9:00 – 12:00"], ["Zo", "gesloten"]],
      actie: "Maak een afspraak", blok: { titel: "Consultaties", items: ["Eerste consult, 45 min", "Opvolging, 30 min", "Huisbezoek op afspraak"] }
    },
    winkel: {
      tag: "Open of gesloten, het adres en een foto van de winkel: in één oogopslag.",
      open: "Nu open tot 18 u", foto: "Foto van de winkel", adres: "Turnhoutsebaan 115",
      uren: [["Ma – za", "10:00 – 18:00"], ["Zo", "gesloten"], ["Feestdagen", "gesloten"]],
      actie: "Bekijk wat er binnen is", blok: { titel: "In de winkel", items: ["Nieuwe collectie", "Cadeaubonnen", "Online bestellen, in de winkel ophalen"] }
    },
    anders: {
      tag: "Zichtbaar voor wie je 's avonds zoekt op zijn gsm.",
      open: "Nu open tot 18 u", foto: "Foto van de zaak", adres: "Kerkstraat 12",
      uren: [["Ma – vr", "9:00 – 18:00"], ["Za", "9:00 – 13:00"], ["Zo", "gesloten"]],
      actie: "Neem contact op", blok: { titel: "Bij ons", items: ["Wat je bij ons vindt", "Hoe je ons bereikt", "Wanneer we open zijn"] }
    }
  },
  /* fixed lines of the sketch */
  reviews: "echte Google-reviews komen hier",   // preceded by 'Jouw' or 'Uw' (STSNames.bezit)
  route: "Route",
  credit: "Schets · Star.Tec.Solutions",
  marker: "voorbeeld",
  /* the three fictional neighbours of the gevel room; '(verzonnen)' is appended to the name by gevel.js */
  buren: [
    { zaak: "Bakkerij Noordpool", sector: "bakker", gemeente: "Borgerhout" },
    { zaak: "Kapsalon Lumen", sector: "kapper", gemeente: "Berchem" },
    { zaak: "Garage Verhulst", sector: "garage", gemeente: "Mortsel" }
  ],
  /* the sentence above the sketch: 'wacht' before a name is committed, then by how the name arrived
     (STSState.source: typed / url) or 'buur' for a fictional neighbour; {zaak} is replaced */
  zin: {
    wacht: "Typ je naam en de schets hieronder neemt ze over. Tot dan staat er \u2018Jouw zaak\u2019 en is elke regel een voorbeeld.",
    typed: "Dag {zaak}. Daar hangt je naam. Hieronder een schets op jouw naam, naast een paar verzonnen buren. We weten niets over je zaak behalve de naam die je net typte. Een mens leest elk bericht zelf.",
    url: "Dag {zaak}. We gebruikten enkel de naam op het kaartje; de rest typ je zelf. Hieronder een schets op jouw naam, naast een paar verzonnen buren. Een mens leest elk bericht zelf.",
    buur: "Dit is {zaak}: een verzonnen buur om mee te vergelijken, geen echte zaak. Typ je eigen naam en de schets hangt op jouw naam. Een mens leest elk bericht zelf."
  },
  /* visitor voice: the extra line the gevel CTA adds to the frozen 'gevel' template (STSBericht.prefill lines) */
  berichtRegel: "Een gratis voorbeeld zonder verplichting is goed; ik beslis daarna zelf.",
  /* the share text (navigator.share); {zaak} is replaced */
  deelTekst: "Dit is {zaak} op het uithangbord van Star.Tec.Solutions: een schets van een site op onze naam, nog niets echt."
};
