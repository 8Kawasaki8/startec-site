# Checklist voor Saki (de oprichter), eindversie WP-15, bijgewerkt in golf 6 (WP-27 en WP-22)

Alles wat alleen jij kan beslissen of aanleveren, op één plek. Niets hiervan blokkeert de site: elke lege waarde
is vandaag onzichtbaar of netjes gelabeld ('voorbeeldbericht (ontwerp)', 'Prototype, niet op deze site'). Per punt
staat waar het heen moet en wat er gebeurt zolang het leeg blijft. De bouwploeg wijzigt juridische tekst nooit op
eigen houtje: elke voorgestelde zin staat hier, met de reden, tot er een OK is. Technische details van de release
staan in `CHANGELOG.md` en `README.md`; het testrapport is `docs/qa-report.html`.

## A. Eerst doen, op je eigen pc: de controle met `?debug=1`

De testmachine in de cloud heeft geen echte grafische kaart (Chromium tekent er met SwiftShader, in software).
Daarom is de ene controle die telt op de pc die vroeger bevroor, voor jou:

1. Open `index.html?debug=1` (op de gepubliceerde site: `https://8kawasaki8.github.io/startec-site/?debug=1`) in
   een nieuw privévenster, zodat de intro speelt.
2. Laat de intro lopen tot het bord staat.
3. Klik twee deuren in de strip (bijvoorbeeld 'De telefoon om 19 u' en dan 'Bericht aan STS'), zodat de camera
   twee keer vliegt.
4. Maak een schermafbeelding van het kleine zwarte paneel met de cijfers (de debug-overlay: regels `frames`,
   `longtasks`, `bloom`, `calls`) en stuur ze door.

Wat goed is: `longtasks` stijgt met hoogstens 3 per vlucht (dus na de intro en twee vluchten blijft het laag),
`frames` staat stil zodra de camera landt (de stad tekent in rust geen enkel beeld), `calls` is een vast getal zodra
het stilstaat. `bloom` mag `false` zijn: de gloed gaat alleen aan als je kaart een proef van 60 beelden onder 14 ms
haalt, anders tekent de stad zonder composer en dat is de bedoeling. Staat `scene svg` in de eerste regel, dan koos
de lader de SVG-route (zwakke kaart, lite of een fout); ook dat is een geldig resultaat, zeg het er dan bij.

## B. `docs/assets/js/config.js`: elke lege of tijdelijke sleutel

Een lege waarde verbergt het element dat ze toont (voet, juridische rijen, de antwoordbelofte). Vul in en bouw opnieuw
(`npm run build`); er hoeft geen andere tekst aangepast te worden.

| sleutel | wat | vandaag | gevolg zodra gevuld |
| --- | --- | --- | --- |
| `email` | zakelijk e-mailadres | tijdelijk Gmail-adres | de voet toont het adres (zie C.7) en het Bericht mailt ernaar |
| `whatsapp` | WhatsApp Business-nummer, cijfers met landcode (`32470123456`) | leeg | het Bericht wordt WhatsApp-eerst en de voet toont het nummer |
| `phone` | telefoonnummer zoals het op de site mag staan | leeg | de voet toont het nummer |
| `legalName` | de geregistreerde naam | `STS Digital` | bevestig of dit de naam op de KBO-inschrijving wordt |
| `legalForm` | rechtsvorm: eenmanszaak of BV | leeg | rij op juridisch.html |
| `owner` | verantwoordelijke uitgever (je echte naam) | leeg | rij op juridisch.html; nergens anders op de site |
| `address` | adres van de zetel | leeg | rij op juridisch.html en in de JSON-LD |
| `kbo` | ondernemingsnummer | leeg | rij op juridisch.html |
| `vat` | btw-nummer of de vrijstellingsregel voor kleine ondernemingen | leeg | rij op juridisch.html |
| `replyPromise` | de ene zin over antwoordtijd die je echt waarmaakt | leeg | de zin onder het Bericht-formulier; leeg = geen belofte, nergens |
| `wijken` | de gemeenten en districten waar je deze maand langsgaat | leeg | de regel 'Deze maand' in de kamer Wie zit erachter en 'Wij komen hier langs' op die wijkpagina's |
| `emailjs.*` | directe verzending via een derde | leeg, en dat blijft zo | niet invullen: het zou een extern verzoek toevoegen, en de site belooft er geen te doen |

Art. XII.6 WER vraagt naam, rechtsvorm, adres, ondernemingsnummer en btw-nummer zodra de site diensten aanbiedt;
`hosting` (GitHub Pages) en `credit` ('gemaakt op startec', standaard uit) staan al goed.

## C. Juridische tekst: voorstellen die op een OK wachten

Sinds de vorige publicatie (commit `4188ce3`) veranderden in de vier juridische pagina's alleen deze zinnen, allemaal
door WP-02 en WP-12 afgesproken: de rij `sts-zaak` en 'Drie' met de zin over een persoonsnaam in cookies.html, 'Drie'
in privacy 2.3, 'Een mens leest' in plaats van 'Een medewerker leest' in privacy, de datum in de kop, en de
meta-beschrijving van voorwaarden.html die 'AI-systemen' niet meer noemt (een beschrijving voor zoekmachines, geen
voorwaarde; de regel 'nooit AI-systemen in titels, meta-beschrijvingen of OG-tags' ging voor). De zichtbare
juridische tekst zelf is verder onaangeroerd. Deze punten wachten:

1. **cookies.html, rij `sts-zaak` (WP-02).** De rij zegt dat het record 'de naam, het vak en de gemeente die je zelf
   intypte' bevat en de alinea erboven dat de naam 'je toestel nooit verlaat'. Het record bevat ook de vier
   schakelaars van de schets, en de naam staat wél in een deellink of op een kaartje als de bezoeker die zelf maakt.
   Voorstel: aan de rij toevoegen *'en de vier schakelaars van de schets'* en één zin erbij: *'Alleen wanneer je zelf
   een deellink of kaartje maakt, staat de naam in dat adres; wij lezen die niet.'*
2. **privacy.html, 2.3.** Dezelfde zin spiegelen na 'ze verlaten je toestel nooit'.
3. **JSON-LD `areaServed` (scripts/buildlib.py) en FAQ 06 in `src/rooms/bericht.html`.** Stond op Antwerpen,
   Vlaanderen, Brussel. Brussel is geschrapt (geen grond), ook uit het antwoord op 'Werken jullie ook buiten
   Antwerpen?' (nu 'Ja, voor heel Vlaanderen.'). Terug toevoegen alleen als je er echt klanten bedient, in beide
   plaatsen in dezelfde commit.
4. **juridisch.html, 'Wat we doen': de vervangende alinea staat klaar.** De pagina noemt vandaag 'websites,
   AI-systemen en automatisering' als diensten; de rest van de site, de OG-tags en de JSON-LD noemen alleen websites,
   gratis gereedschap en onderzoek, en `lint-copy` weigert 'AI-systemen' en 'automatisering' overal behalve op de vier
   juridische pagina's. Zodra je OK geeft, vervangt de bouwploeg enkel deze ene alinea:
   *'Star.Tec.Solutions ontwerpt en bouwt websites voor zelfstandigen en kleine bedrijven, maakt gratis gereedschap voor
   hun zichtbaarheid en doet onderzoek naar AI die werk overneemt van zulke zaken. Elke opdracht begint met een gratis,
   werkend voorbeeld; pas daarna volgt een offerte op maat. De <a href="voorwaarden.html">algemene voorwaarden</a>
   gelden voor alle offertes en overeenkomsten.'*
5. **voorwaarden.html, punt 1.** Zelfde reden. Voorstel: *'websites en platformen, ontwerp, onderhoud, advies en, zodra ze
   bestaan, de systemen die uit dat onderzoek volgen'*. In dezelfde commit als punt 4.
6. **juridisch.html (1x) en privacy.html (2x): link `index.html#contact` -> `index.html#bericht`.** De sectie `#contact`
   bestaat niet meer; de link werkt vandaag via de oude koppeling in uithangbord.js (met JavaScript; zonder JavaScript landt
   hij bovenaan de startpagina). Voorstel: enkel de drie href-waarden vervangen, de zin blijft. In dezelfde commit als punt
   4. De linkchecker (`npm run links`, WP-22) meldt deze drie links als notitie, met verwijzing naar dit punt, tot ze
   vervangen zijn; elke andere interne link en elk ander anker op de site is nagekeken en klopt.
7. **De voet en je e-mailadres.** De voet toont WhatsApp en telefoon uit `config.js` (elk alleen als gevuld) en bewust
   géén e-mailadres zolang `email` het tijdelijke Gmail-adres is; het blijft wel het mailto-doel van het Bericht. Zodra
   het zakelijke adres bestaat: vul `email` in en zet in `src/partials/foot.html` de span
   `<span data-c-wrap><a data-c="email" href="#"></a></span>` terug vooraan in `.foot-contact`.
8. **Privacy 2.2 en het voorbeeld dat je niet stuurt.** De tekst belooft: openbare data, één bericht, voorbeeld niet
   geïndexeerd, weg na 30 dagen zonder reactie of binnen 5 werkdagen op vraag. Voor een voorbeeld dat jij zelf beslist
   niet te sturen staat er niets; zie D.6.

## D. Wat alleen jij kan aanleveren

1. **Wettelijke identiteit** (B): rechtsvorm, adres, KBO, btw, verantwoordelijke uitgever. Vóór de site een offerte
   aanbiedt.
2. **Zakelijk e-mailadres en WhatsApp Business-nummer** (B). Met WhatsApp gevuld wordt het Bericht WhatsApp-eerst.
3. **`replyPromise`** (B): bijvoorbeeld 'Je krijgt meestal binnen een werkdag antwoord van ons.' Alleen als je dat
   ook op een drukke week haalt; anders leeg laten.
4. **Eén ware zin per prototype** voor de capaciteitenkaart op werkwijze.html (`src/data/capabilities.json`, lamp
   `prototype`). Nu, enkel uit je eigen woorden: *'Kawa: een assistent die lokaal bij ons draait en onthoudt wat hij
   leert.'*, *'sts-world: een 3D-overzicht van het werk van de agents.'*, *'webshot: fotografeert een site op een gsm.'*
   De voetzin 'Prototype, niet op deze site, nog geen klantproduct.' blijft, en de assistent-proef noemt Kawa nooit.
5. **De echte eerste-contacttekst** die de pijplijn na jouw goedkeuring stuurt, in u-vorm, zonder prijs:
   `src/data/radar-bericht.json`, veld `regels` (met `{aanleiding}` als plaatshouder per zaak), en `echt` op `true`. Het
   label in de replay wordt dan 'zo schrijven we echt'; tot dan staat er 'voorbeeldbericht (ontwerp)'. Het ontwerp
   van vandaag begint met 'Dag,' en eindigt met 'STS Digital, Antwerpen'; lees het na.
6. **Wat er gebeurt met een gebouwd voorbeeld dat je niet stuurt**: meteen weg, na 30 dagen, of privé bewaard. Tot je
   dat zegt, zegt de replay na 'Niet sturen' enkel 'Dan vertrekt er niets. Ook in het echt niet.' en citeert de site
   privacy 2.2 alleen voor het geval zonder reactie. Zodra je kiest, komt de zin in de replay én in privacy 2.2 (C.8),
   en dan ook in de lede van werkwijze.html ('Bevalt het niet, dan verdwijnt het weer.', de enige plek die nu al een
   beleid noemt; de kamers Snymis en Bericht zeggen enkel 'dan stopt het daar').
7. **Een foto van jezelf** (of een vaste illustratie) voor de kamer 'Wie zit erachter' op werkwijze.html. De tekst staat er
   sinds WP-18 zonder plaatshouder: 127 woorden in de ik-vorm in `src/rooms/snymis.html`, enkel uit wat elders op de site
   al staat (Antwerpen, geen kantoor, een jonge zaak, onderzoek naar AI die werk overneemt, de verkenner en de bouwer, elk
   bericht zelf gelezen, eerst het voorbeeld). Wat alleen jij kan toevoegen, in je eigen woorden en zonder echte naam:
   een leeftijdsvork, waarom Antwerpen, waarom je met agents werkt, en of 'ik zou het zelf ook zo willen' klopt. Vervang
   dan de drie alinea's in dat bestand; de kop en het blok 'Wat wij niet zijn' blijven.
8. **Bevestiging van de capaciteitenkaart**: wat 'onderhoud' vandaag betekent (maandelijks, opzegbaar?), of het gratis
   voorbeeld foto's van de zaak hergebruikt (zo niet, zegt de tekst enkel 'uren en adres'), en of 'een eerlijke blik op
   je Google-profiel en je site op een gsm' echt bij elk gratis voorbeeld hoort.
9. **Wijken**: `config.wijken` met de gemeenten en districten waar je deze maand echt langsgaat (of leeg), en één
   sfeerzin per wijkpagina in je eigen woorden in `src/data/wijken.json`, veld `sfeerzin` (Berchem, Borgerhout, Deurne,
   Merksem, Hoboken, Wilrijk, Mortsel). Zolang het veld leeg is, staat er geen sfeerzin en blijft de pagina neutraal en
   zonder cijfers (lint-copy bewaakt dat). Mortsel is een gemeente, de zes andere zijn districten.
10. **Je OK op de alinea voor juridisch.html** (C.4) en punt 1 van voorwaarden.html (C.5).
11. **Domeinnaam**: GitHub Pages met subpad houden of een eigen domein. De links op de site zijn relatief, dus beide
    werken; bij een eigen domein verandert alleen `--base` in `package.json`: canonicals, OG-tags, sitemap, robots en de
    `<base href>` van 404.html volgen uit die ene waarde.
12. **Toestemming van de eerste echte klant** voor een vierde pand in De straat: pas dan `consent: true` in
    `src/data/panden.json`, met in `zin` de ene zin die de klant goedkeurde en zonder `oud`, `beeld` of `probeer` (voor
    een echte zaak wordt niets verzonnen; de QA-harnas weigert anders).
13. **Een leesbeurt van elke tekst in `src/rooms/`** (toon, districten, sectorwoorden), een beslissing over je of u in de
    praktijk-variant (nu u, zie copy-regels.md hoofdstuk 2) en één blik op de schermafbeeldingen van de gevel
    (`.qa/shots/index.html.desktop.png` en `.phone.png` na `npm run qa -- --shots`): is het bord leesbaar, klopt de
    kadrering. WP-18 las alles al als een bakker uit Borgerhout en een garagist uit Mortsel; wat toen veranderde staat in
    `CHANGELOG.md` (golf 5). Lees vooral na: de aanloop van De telefoon om 19 u ('Je staat te bedienen ...'), de drie
    stappen en de antwoorden onder 'Wat mensen ons eerst vragen' in de kamer Bericht (het gratis voorbeeld belooft nu
    enkel 'je uren, je adres, je Google-profiel', geen foto's of reviews, tot jij D.8 beantwoordt), en de
    meta-beschrijvingen in de front matter van `src/pages/*.html` (elk korter dan 155 tekens).
14. **Verzonnen namen waar je je goed bij voelt.** De drie buren die verschijnen als niemand typt staan in
    `docs/assets/js/preview-data.js`, lijst `buren` (nu Bakkerij Noordpool, Kapsalon Lumen, Garage Verhulst); de
    verzonnen buur per sector in de radar-replay in `docs/assets/js/sim-radar-data.js`, object `buren` (Taverne Het
    Anker, Kapsalon Mira, Garage Dewilde, Bakkerij Zonnewende, Schrijnwerkerij Maes, Praktijk Moens, Bloemen Lieve, Zaak
    Op den Hoek); de zaken van De telefoon om 19 u in `sim-dag-data.js` en van de Doorlichting in `sim-data.js`. Elke
    naam blijft verzonnen en draagt het woord 'verzonnen' of 'fictief' in de zin; de fixture
    `scripts/qa/fixtures/names.json` test alleen de spelling, niet de keuze.
15. **De schermafbeelding met `?debug=1`** (A), van de pc die bevroor.
16. **'Kom eens langs'**: alleen als het waar is, en dan zeg je waar.
17. **Wat je schrapt of anders wil** in `copy-regels.md` en `src/data/woordenlijst.json`: zeg het in een paar woorden, de
    bouwploeg zet het om in een regel zodat het niet terugsluipt.

## E. Ter info, geen beslissing nodig

- Eén naam voor de rustige stand: 'Minder animatie' in de voet, in het bewerkblad van het uithangbord en in de rij
  `sts-lite` van cookies.html.
- `og.png` (de afbeelding bij een gedeelde link) komt uit `src/og.html` via `node scripts/og-render.mjs`; bekijk ze één keer
  op je gsm via een gedeelde link.
- De openingsuren-check staat live als vijfde loket in Gereedschap (WP-14 is niet uitgesteld); een kioskstand (de stad die
  blijft draaien zonder bezoeker) is bewust niet gebouwd.
- De sleutels in de browser blijven exact drie: `sts-pre`, `sts-lite`, `sts-zaak`; de QA-harnas weigert elke andere.

## F. Gratis lokale kanalen die de site al ondersteunt (WP-27)

Geen advertenties, geen koude mails. Elk kanaal hieronder is gratis, en de site levert er het stuk voor dat je nodig
hebt. Wat je deelt, is altijd iets wat vandaag waar is; de deelteksten zeggen zelf 'gesimuleerd', 'voorbeeld' of
'zelfinschatting' waar dat hoort.

1. **Google Bedrijfsprofiel van STS Digital.** Maak het aan zodra het adres (B) er is; zonder adres kan het als
   'dienst aan huis' met Antwerpen als werkgebied. Zet als website het adres uit `package.json` (`--base`), kies de
   categorie 'webdesigner', en vul de uren in met de openingsuren-check op `gereedschap.html#uren` (het urenblok in
   gewone tekst past in het profiel). De pagina `index.html` draagt de bijbehorende LocalBusiness-gegevens als
   JSON-LD; naam, zetel, KBO en e-mail verschijnen daar vanzelf zodra `config.js` ze heeft, en niet eerder (een
   persoonlijk Gmail-adres blijft eruit). Plaats er geen reviews die je niet hebt; vraag ze pas aan echte klanten.
2. **Unizo en de handelaarsverenigingen per district.** Lid worden hoeft niet om langs te gaan op een
   handelaarsavond of een Winkelhierweek. Neem de afdrukbare eenpager mee (`gereedschap.html?print`, knop 'Druk af'):
   vijf gratis loketten, een QR-code naar de pagina, geen prijzen. Voor een adviseur of boekhouder die ziet welke
   klanten geen goede site hebben, is dat blad genoeg; hij geeft het door, jij hoeft niets te verkopen.
3. **Buurtgroepen op Facebook (per district) en WhatsApp-groepen van handelaars.** Deel enkel wat nuttig is voor
   de groep: de wijkpagina van dat district (`wijk/berchem.html` enzovoort, met kruimelpad en deelkaart), of een
   loket ('Typ je uren één keer'). De deelteksten op de site (knop 'Stuur naar een collega' onder elk resultaat) zijn
   daarvoor geschreven: kort, Vlaams, zonder hype. Antwoord op vragen in de groep zelf; stuur niemand een privébericht
   dat hij niet vroeg (art. XII.13 WER, en het staat zo in de privacyverklaring).
4. **WhatsApp-status en LinkedIn.** Elke nieuwe simulatie of kamer is een kort bouwverslag met een schermafbeelding
   waar 'gesimuleerd' in beeld staat (`npm run qa -- --shots` schrijft ze naar `.qa/shots/`); de gedeelde link toont
   automatisch `og.png` met de juiste titel en beschrijving per pagina. In je status werkt dezelfde deeltekst als de
   knop 'Stuur naar een collega' geeft.
5. **Het kaartje voor aan de toog** (`gereedschap.html?toog=1`, intern) blijft het kanaal voor een zaak die je zelf
   bezocht: de QR-code hangt hun naam op het bord, de achterkant zegt dat je enkel de naam gebruikte.

Wat je hiervoor nog moet beslissen staat al in B en D: adres en KBO (profiel), `config.wijken` (de districten van deze
maand), en de sfeerzin per wijkpagina. Zonder die waarden werkt elk kanaal ook; er staat dan gewoon minder.

## G. Stand na golf 6 (WP-22, release-refresh): wat nog open staat

Golf 6 (robuustheid, vindbaarheid, release-refresh) sloot geen enkel punt van jou: alles in B, C en D staat nog open,
want elk punt vraagt een feit dat alleen jij kent. Wat er voor jou veranderde:

- De site werkt nu ook zonder JavaScript (gewone tekst, de deuren als links, de skyline met een neutraal bord), met een
  geblokkeerd script, zonder lettertypen en in browsers vanaf Safari 15.4 / Chrome 100; de drie afdrukken van Gereedschap
  (A6-kaartje, toogkaartje, eenpager) zijn wit op papier. Dat is getest (`docs/qa-report.html`, sectie Robuustheid) en
  vraagt niets van jou. Wil je het zelf zien: zet JavaScript uit in je browser en open de startpagina.
- Elke pagina heeft een eigen titel en beschrijving, een deelkaart (og.png) en de gegevens voor Google (JSON-LD). Zodra
  B gevuld is (adres, KBO, zakelijk e-mailadres) verschijnen die daar vanzelf; tot dan staat er enkel wat waar is.
- Onder elk resultaat staat 'Stuur naar een collega' met een tekst zoals jij ze zou doorsturen; hoofdstuk F zegt waar die
  teksten voor dienen. Lees ze één keer na (`docs/assets/js/deel-data.js` en de `STS_DEEL`-blokken in de databestanden).
- Elke interne link en elk anker is nagekeken (`npm run links`): niets is gebroken; de enige notitie zijn de drie
  `#contact`-links in de juridische tekst (C.6), die op jouw OK wachten.

Volgorde die het meest oplevert, als je één avond hebt: A (de schermafbeelding met `?debug=1`), dan B (de identiteit en
het zakelijke e-mailadres), dan D.5 (de echte eerste-contacttekst) en D.9 (de wijken van deze maand en één sfeerzin per
wijkpagina). De rest kan per stuk, zonder volgorde.
