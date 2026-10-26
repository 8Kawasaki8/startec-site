/* De telefoon om 19 u: zes VERZONNEN zaken, elk met een vaste, handgeschreven dinsdag van
   07:00 tot 20:00. Elke oproep hieronder is verzonnen; geen enkel cijfer is gemeten. sim-dag.js
   leest dit bestand; de bezoeker kiest enkel de sector en de modus. De naam van de bezoeker
   komt nergens in deze dag terecht.

   ONTWERPREGELS (aannames, geen metingen; dezelfde stijl als de wat-als-regels van de Doorlichting):
   - Drukke banden ('banden'): tijdvakken waarin niemand kan opnemen (bedient, handen in het deeg,
     onder de brug, deur nog dicht). Een oproep buiten elke band wordt in elke modus opgenomen.
   - Modus 1 'Niemand neemt op': elke oproep in een band gaat verloren (gemist).
   - Modus 2 'Bericht met terugbelbelofte': een oproep in een band blijft onbeantwoord, maar de
     beller hoort een bericht met de belofte dat de zaak terugbelt. De bellers met de vlag 'tb'
     worden die avond teruggebeld (teruggebeld); de andere blijven gemist. Welke bellers dat zijn,
     ligt vast in het script: een keuze, geen meting.
   - Modus 3 'WhatsApp-knop + bericht met de echte uren': de oproepen in een band met de vlag 'wa'
     komen als WhatsApp-bericht binnen (bericht) in plaats van als gemiste oproep; de rest volgt
     modus 2. Het aandeel 'wa' per sector is een vast gescript aandeel van de drukke oproepen:
     horeca 6 van de 11, kapper 8 van de 12, garage 7 van de 11, bakker 5 van de 10,
     aannemer 5 van de 9, praktijk 6 van de 14. Dat aandeel is een aanname van het ontwerp
     (afspraken en bestellingen gaan vlotter per bericht dan een dringende panne), geen voorspelling.
   - Elke oproep krijgt precies een uitkomst (opgenomen, gemist, bericht of teruggebeld); de vier
     tellers zijn dus altijd samen gelijk aan het aantal oproepen.
   - 'winkel' speelt het script van de bakker, 'anders' dat van de horeca (alias).
   Oproep: [uur, wie belt (in de woorden van de zaak), vlaggen 'wa' en/of 'tb'].
   'opener' is wat een klant naar de zaak stuurt (klantstem) en vult de WhatsApp-knop in Gereedschap.
   'antwoord' is het voorbeeldbericht dat de beller in modus 2 en 3 hoort; het staat enkel in het
   Bericht aan Snymis (zelf in te stellen; STS stuurt niets). */
window.SIM_DAG = {
  van: "07:00", tot: "20:00", dag: "dinsdag",
  alias: { winkel: "bakker", anders: "horeca" },
  sectoren: {
    horeca: {
      naam: "Brasserie De Lantaarn", soort: "brasserie", district: "Berchem",
      banden: [["07:00", "10:00", "deur nog dicht"], ["12:00", "14:30", "bedient de middag"], ["18:00", "20:00", "bedient de avond"]],
      oproepen: [
        ["07:40", "leverancier vraagt wanneer hij mag lossen", "tb"], ["09:15", "groep van twaalf wil reserveren voor vrijdag", "wa tb"],
        ["10:20", "vraag of er een kindermenu is", ""], ["11:05", "tafel voor twee vanavond", ""],
        ["12:10", "tafel voor vier om 19 u", "wa"], ["12:35", "vraag over allergenen", ""],
        ["13:05", "verjaardag met twintig man, volgende maand", "wa tb"], ["13:50", "annulering van een tafel", "wa"],
        ["15:10", "vraag naar de kaart van vanavond", ""], ["16:30", "vraag of het terras open is", ""],
        ["17:20", "reservatie voor zaterdag", ""], ["18:15", "tafel voor zes vanavond", "wa tb"],
        ["18:40", "vraag of de keuken om 21 u nog open is", ""], ["19:05", "reservatie voor zondagmiddag", "wa"],
        ["19:30", "iemand is zijn jas vergeten", "tb"], ["19:50", "tafel voor twee morgen", ""]
      ],
      opener: "Dag, ik wil graag een tafel reserveren. Is er vanavond nog plaats voor vier?",
      antwoord: "Dag, je belt Brasserie De Lantaarn. Over de middag en 's avonds staan we in de zaal. Stuur gerust een WhatsApp of spreek iets in: we bellen na de dienst terug."
    },
    kapper: {
      naam: "Kapsalon Mira", soort: "kapsalon", district: "Borgerhout",
      banden: [["07:00", "09:00", "deur nog dicht"], ["09:30", "12:30", "handen in het haar"], ["14:00", "18:00", "handen in het haar"], ["18:00", "20:00", "deur dicht"]],
      oproepen: [
        ["07:50", "afspraak voor zaterdag", "wa tb"], ["08:30", "vraag of ze zonder afspraak mag komen", "wa"],
        ["09:10", "afspraak verplaatsen", ""], ["09:45", "kleuring, hoelang duurt dat", "wa"],
        ["10:30", "afspraak voor haar zoon, woensdag", "wa tb"], ["11:20", "vraag of ze ook baarden doen", ""],
        ["12:05", "afspraak annuleren", "wa"], ["12:50", "afspraak voor vrijdagavond", ""],
        ["13:20", "vraag of er deze namiddag nog plaats is", ""], ["14:15", "communiefeest, drie kinderen", "wa tb"],
        ["15:40", "vraag of ze vandaag nog kan", ""], ["16:30", "afspraak voor volgende week", "wa"],
        ["17:10", "vraag over een product dat op is", "tb"], ["18:20", "afspraak voor zaterdagochtend", "wa tb"],
        ["19:15", "cadeaubon voor haar moeder", "tb"]
      ],
      opener: "Dag, ik wil graag een afspraak maken. Wanneer past het?",
      antwoord: "Dag, je belt Kapsalon Mira. Tijdens het knippen neem ik niet op. Stuur een WhatsApp met je naam en wanneer het je past: ik antwoord tussen twee klanten door."
    },
    garage: {
      naam: "Garage Smets", soort: "garage", district: "Mortsel",
      banden: [["07:00", "08:00", "poort nog dicht"], ["08:30", "12:00", "onder de brug"], ["13:00", "17:30", "onder de brug"], ["18:00", "20:00", "poort dicht"]],
      oproepen: [
        ["07:30", "auto start niet, kan hij langskomen", "wa tb"], ["08:10", "afspraak voor een onderhoud", ""],
        ["08:50", "keuring volgende week, kan de garage dat doen", "wa"], ["09:40", "lampje brandt op het dashboard", "wa tb"],
        ["10:30", "vraag of de wagen al klaar is", "tb"], ["11:15", "winterbanden wisselen", "wa"],
        ["12:20", "bestelwagen maakt een geluid", ""], ["12:45", "vraag naar een tweedehands", ""],
        ["13:30", "vraag of de wagen al klaar is", "tb"], ["14:40", "lekke band, staat langs de weg", "wa"],
        ["15:50", "afspraak voor de keuring", "wa tb"], ["17:00", "vraag of ze open zijn op zaterdag", ""],
        ["17:45", "ophalen voor sluitingstijd", ""], ["18:30", "auto start niet, morgenvroeg nodig", "wa tb"],
        ["19:20", "vraag naar een offerte voor de remmen", "tb"]
      ],
      opener: "Dag, mijn auto moet nagekeken worden. Wanneer kan ik langskomen?",
      antwoord: "Dag, je belt Garage Smets. We liggen onder een wagen en horen de telefoon niet altijd. Stuur een WhatsApp met je nummerplaat en wat er scheelt: we bellen terug voor 18 u."
    },
    bakker: {
      naam: "Bakkerij Zoete Inval", soort: "bakkerij", district: "Deurne",
      banden: [["07:00", "09:30", "winkel vol"], ["11:30", "13:30", "middagdrukte"], ["15:30", "18:00", "handen in het deeg"], ["18:00", "20:00", "deur dicht"]],
      oproepen: [
        ["07:15", "taart bestellen voor zaterdag", "wa tb"], ["08:05", "vraag of er nog pistolets zijn", ""],
        ["08:40", "bestelling van een school, zestig koffiekoeken", "wa tb"], ["09:50", "vraag of ze glutenvrij brood hebben", ""],
        ["10:30", "taart met foto voor een communie", ""], ["11:45", "broodjes voor een vergadering morgen", "wa"],
        ["12:30", "vraag of ze open zijn op maandag", ""], ["13:10", "bestelling ophalen, hoe laat", "tb"],
        ["14:20", "vraag over een ontbijtmand", ""], ["15:00", "verjaardagstaart voor woensdag", ""],
        ["16:10", "vraag of ze leveren", "wa"], ["17:20", "bestelling wijzigen", "tb"],
        ["18:30", "taart voor morgenmiddag", "wa tb"], ["19:10", "vraag naar de uren op zondag", ""]
      ],
      opener: "Dag, ik wil graag een taart bestellen voor zaterdag. Kan dat nog?",
      antwoord: "Dag, je belt Bakkerij Zoete Inval. 's Ochtends staat de winkel vol en horen we de telefoon niet. Stuur je bestelling per WhatsApp: we bevestigen voor de middag."
    },
    aannemer: {
      naam: "Aannemer Van Dyck", soort: "aannemer", district: "Hoboken",
      banden: [["07:30", "12:00", "op de werf"], ["12:30", "17:00", "op de werf"]],
      oproepen: [
        ["07:10", "leverancier: het zand komt later", ""], ["07:50", "vraag naar een offerte voor een oprit", "wa tb"],
        ["08:40", "architect wil de planning bespreken", "tb"], ["09:30", "lek in het dak na de storm", "wa tb"],
        ["10:45", "vraag of hij ook badkamers doet", "wa"], ["11:30", "buurman van de werf over de stelling", ""],
        ["12:15", "klant vraagt wanneer de keuken start", ""], ["13:20", "offerte voor een aanbouw", "wa tb"],
        ["14:50", "vraag of de offerte al klaar is", "tb"], ["15:40", "foto van een scheur in de muur", "wa"],
        ["16:30", "vraag naar een referentie", ""], ["17:45", "offerte voor een terras", ""],
        ["19:10", "vraag over de planning van volgende week", ""]
      ],
      opener: "Dag, ik zoek iemand voor werken aan mijn huis. Kan u eens langskomen voor een offerte?",
      antwoord: "Dag, je belt Van Dyck. Overdag sta ik op de werf. Stuur een WhatsApp met een foto en je adres: ik bel 's avonds terug en plan een bezoek."
    },
    praktijk: {
      naam: "Kinepraktijk Aerts", soort: "kinepraktijk", district: "Wilrijk",
      banden: [["07:00", "08:00", "praktijk nog dicht"], ["08:00", "12:00", "behandelt"], ["13:00", "15:00", "behandelt"], ["15:30", "18:30", "behandelt"], ["18:30", "20:00", "praktijk dicht"]],
      oproepen: [
        ["07:30", "afspraak na een val", "tb"], ["08:05", "afspraak verzetten", "wa"],
        ["08:20", "nieuwe patiënt met rugklachten", "tb"], ["08:50", "vraag of er een voorschrift nodig is", "wa"],
        ["09:40", "afspraak voor haar vader", "wa tb"], ["10:30", "afzeggen wegens ziekte", "wa"],
        ["11:20", "vraag of ze aan huis komen", ""], ["12:10", "afspraak voor volgende week", ""],
        ["12:40", "vraag naar de uren op vrijdag", ""], ["13:30", "nieuwe patiënt na een operatie", "tb"],
        ["14:45", "afspraak verzetten", "wa"], ["15:10", "vraag over een voorschrift", ""],
        ["16:00", "vraag of er deze week nog plaats is", "tb"], ["17:20", "vraag naar een attest", ""],
        ["18:10", "afspraak na het werk", "wa tb"], ["18:50", "afspraak voor haar zoon", "tb"],
        ["19:30", "vraag of ze morgen terechtkan", ""]
      ],
      opener: "Dag, ik wil graag een afspraak maken. Wanneer is er plaats?",
      antwoord: "Dag, u belt Kinepraktijk Aerts. Tijdens een behandeling neem ik niet op. Stuur een WhatsApp met uw naam en wanneer het u past: ik antwoord tussen twee patiënten door."
    }
  }
};
