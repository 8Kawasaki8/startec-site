# Checklist voor Saki (de oprichter)

Punten die alleen de oprichter kan beslissen of aanleveren. De bouwploeg wijzigt juridische tekst nooit
op eigen houtje: elke voorgestelde zin staat hier, met de reden, tot er een OK is. Aangevuld per golf;
WP-15 maakt de eindversie.

## Juridische tekst: voorstellen die op een OK wachten

1. **cookies.html, rij `sts-zaak` (WP-02, herziening golf 1).** De rij zegt nu dat het record 'de naam,
   het vak en de gemeente die je zelf intypte' bevat en de alinea erboven dat de naam 'je toestel nooit
   verlaat'. Het record bevat ook de vier schakelaars van de schets (g), en de naam staat wel in een
   deellink of op een kaartje als de bezoeker die zelf maakt (STSState.toShareQuery).
   Voorstel: aan de dd toevoegen *'en de vier schakelaars van de schets'* en één zin erbij:
   *'Alleen wanneer je zelf een deellink of kaartje maakt, staat de naam in dat adres; wij lezen die niet.'*
2. **privacy.html, 2.3 (zelfde reden).** Zelfde zin spiegelen na 'ze verlaten je toestel nooit'.
3. **JSON-LD `areaServed` (scripts/buildlib.py) en FAQ 06 in src/rooms/bericht.html.** Stond op Antwerpen,
   Vlaanderen, Brussel. Brussel is zonder grond geschrapt, ook uit het FAQ-antwoord 'Werken jullie ook buiten
   Antwerpen?' (nu 'Ja, voor heel Vlaanderen.'); terug toevoegen alleen als je er echt klanten bedient, en dan in
   beide plaatsen in dezelfde commit.
4. **juridisch.html, 'Wat we doen' en voorwaarden.html, punt 1 (WP-04).** Beide noemen 'websites,
   AI-systemen en automatisering' als diensten. De rest van de site verkoopt dat niet meer (alleen websites,
   gratis gereedschap en onderzoek); de juridische tekst is ongemoeid gelaten tot er een OK is.
   Voorstel juridisch: *'Star.Tec.Solutions ontwerpt en bouwt websites voor zelfstandigen en kleine bedrijven,
   maakt gratis gereedschap voor hun zichtbaarheid en doet onderzoek naar AI die werk overneemt van zulke
   zaken. Elke opdracht begint met een gratis voorbeeld; daarna volgt een offerte op maat.'*
   Voorstel voorwaarden, punt 1: *'websites en platformen, ontwerp, onderhoud, advies en, zodra ze bestaan,
   de systemen die uit dat onderzoek volgen'*.
5. **juridisch.html (1x) en privacy.html (2x): link `index.html#contact` -> `index.html#bericht`.** De sectie
   `#contact` bestaat niet meer; de link werkt vandaag alleen via de legacy-koppeling in uithangbord.js (met
   JavaScript). Voorstel: enkel de drie href-waarden vervangen, de zin blijft. Toe te passen samen met punt 4.

## Aan te leveren (config.js-plaatshouders, geen blokkering)

- KBO-nummer, adres, echte naam, zakelijk e-mailadres, domeinnaam (docs/assets/js/config.js).
- De echte eerste-contacttekst van het acquisitiebericht, in u-vorm en zonder prijs: `src/data/radar-bericht.json`,
  veld `regels`, en zet `echt` op `true`; het label in de replay wordt dan 'zo schrijven we echt' (nu 'voorbeeldbericht (ontwerp)').
- Eén ware zin per prototype (Kawa, sts-world, webshot) voor de capaciteitenkaart: `src/data/capabilities.json`,
  lamp `prototype`; de bouwploeg zette er enkel je eigen woorden in.
- Wat er gebeurt met een gebouwd voorbeeld dat je niet stuurt (meteen weg, na 30 dagen, privé bewaard); tot dan zegt
  de replay na 'Niet sturen' enkel 'Dan vertrekt er niets. Ook in het echt niet.'
- Toestemming van de eerste echte klant voor een vierde pand in de straat: pas dan `consent: true` in `src/data/panden.json`,
  met in het veld `zin` de ene zin die de klant goedkeurde (zonder `oud`, `beeld` of `probeer`: voor een echte zaak wordt niets verzonnen).
- De verzonnen buren per sector in `docs/assets/js/sim-radar-data.js` (namen waar je je goed bij voelt).
- Of 'Kom eens langs' ergens waar mag staan (alleen als het waar is).
- Eén sfeerzin per gemeente of district voor de wijkpagina's, in je eigen woorden: `src/data/wijken.json`, veld
  `sfeerzin` (Berchem, Borgerhout, Deurne, Merksem, Hoboken, Wilrijk, Mortsel). Zolang het veld leeg is, staat er
  geen sfeerzin op de pagina; de rest van de tekst daar blijft neutraal en zonder cijfers (lint-copy bewaakt dat).
- Of 'Snymis komt hier langs' op een wijkpagina mag staan: zet de namen in `docs/assets/js/config.js`, veld `wijken`
  (bijvoorbeeld "Berchem, Borgerhout en Mortsel."); na een nieuwe build toont alleen die pagina's de zin.

## Golf 3, WP-12 (copy, voet, og.png): te lezen en te beslissen

6. **juridisch.html, 'Wat we doen': de vervangende alinea staat klaar (bevestigt punt 4).** De hele site, de OG-tags en
   de JSON-LD noemen vandaag alleen websites, gratis gereedschap en onderzoek; `lint-copy` weigert 'AI-systemen' en
   'automatisering' overal behalve op de vier juridische pagina's. Zodra je OK geeft, vervangt de bouwploeg enkel deze
   ene alinea (de rest van de pagina blijft):
   *'Star.Tec.Solutions ontwerpt en bouwt websites voor zelfstandigen en kleine bedrijven, maakt gratis gereedschap voor
   hun zichtbaarheid en doet onderzoek naar AI die werk overneemt van zulke zaken. Elke opdracht begint met een gratis,
   werkend voorbeeld; pas daarna volgt een offerte op maat. De <a href="voorwaarden.html">algemene voorwaarden</a>
   gelden voor alle offertes en overeenkomsten.'*
   Punt 1 van voorwaarden.html krijgt dan de zin uit punt 4; beide in dezelfde commit als punt 5 (de drie `#contact`-links).
7. **De voet toont je contact uit `config.js`** (WhatsApp en telefoon, elk alleen als het veld gevuld is) onder de
   merkregel, op elke pagina. Het e-mailadres staat er bewust niet zolang `email` het tijdelijke Gmail-adres is (het blijft
   wel het mailto-doel van het Bericht). Zodra het zakelijke adres bestaat: vul `email` in en zet in `src/partials/foot.html`
   de span `<span data-c-wrap><a data-c="email" href="#"></a></span>` terug vooraan in `.foot-contact`.
8. **Eén naam voor de rustige stand:** de schakelaar in het bewerkblad van het uithangbord heet nu 'Minder animatie',
   net als de knop in de voet en de rij `sts-lite` in cookies.html. Geen juridische wijziging; ter info.
9. **og.png (de afbeelding bij een gedeelde link)** is opnieuw gemaakt uit `src/og.html`: de nachtstad met het bord
   'Jouw zaak' en het aankomstpaneel. Lokale stap na een wijziging: `node scripts/og-render.mjs`. Bekijk ze één keer op
   je gsm via een gedeelde link; de tekst erop volgt copy-regels.md.
10. **copy-regels.md en `src/data/woordenlijst.json`** zijn de schrijfregels van de site. Wat je bij je leesbeurt schrapt
   of anders wilt, komt daar als regel in; zeg het in een paar woorden, de bouwploeg zet het om.
