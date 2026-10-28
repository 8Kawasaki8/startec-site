# Wijzigingslogboek Star.Tec.Solutions

Statische site van STS Digital (Antwerpen). Bronnen in `src/`, gebouwd naar `docs/` (wat GitHub Pages serveert).
Het bouwplan is `scripts/workflows/PLAN-V5.md`; de beslissingen per golf staan in de Wave-log daar. Dit logboek
begint bij v5; v3, v3.1 en v4 staan alleen in de git-geschiedenis.

## Golf 6 (tak v5): WP-26 robuustheid, WP-27 vindbaarheid, WP-22 release-refresh

### WP-26, robuustheid: zonder JavaScript, dode modules, oude browsers, lettertypen, afdrukken, diepe links

- Zonder JavaScript (`src/partials/head.html`, `scene.html`, `uithangbord.html`): elke pagina is gewone tekst met de
  vijf deuren als links; één `<noscript>`-regel onder de strip zegt wat scripts nodig heeft (de schets op het bord, de
  simulaties, het gereedschap en het formulier); de naamchip en 'Minder animatie' zijn dan verborgen (dode knoppen); op
  de scenepagina's toont de SVG-skyline haar neutrale bord en blijft de canvas weg.
- Dode modules: `hydrate.js` zet `action="mailto:{config.email}"` (post, text/plain) op het formulier zolang het geen action
  heeft, zodat een gewone submit de mail-app opent wanneer `contact.js` niet laadt; de strip blijft staan zoals gebouwd
  (`aria-current` uit build.py) wanneer `uithangbord.js` wegvalt; de scene-loader toont bij een geblokkeerde module de
  SVG-route (`sts:scene-failed`).
- Oudere browsers (vloer Safari 15.4 / Chrome 100): `base.css` kreeg een bijgevoegd blok met de terugval voor elke
  `dvh`/`svh`/`lvh`- en `color-mix`-declaratie uit de later geladen bestanden (zelfde selector, zelfde eigenschap, eerst de
  waarde zonder het kenmerk), `-webkit-hyphens` naast `hyphens`, `vh` voor `lvh` op de scène; de kenmerkentabel met de
  terugval per item staat in `scripts/qa/README.md` (WP-26) en `robust-audit.mjs` bewaakt ze (`:has`, `@container`,
  `@layer`, nesting, `structuredClone`, `.at()`, top-level await, import maps en lookbehind komen nergens voor).
- Afdrukken (`print.css`): `color-scheme: light` op `:root` (anders schilderde Chromium de @page-marge zwart) en elke
  schermkleur wordt zwart op papier; het A6-kaartje, het toogkaartje en de eenpager van Gereedschap drukken op hun
  `@page`-maat (A6 298x420 pt, A4 595x842 pt) zonder donkere vlakken.
- Nieuwe poort `scripts/qa/robust.mjs` (met `robust-dom.mjs`, `robust-print.mjs`, `robust-audit.mjs`), na de
  toegankelijkheidscontrole in `npm run qa` en los te draaien: `nojs`, `modules` (elk script van een pagina één voor één
  geblokkeerd, op index ook de scènemodules en three.js), `fonts` (elke lettertypeaanvraag geblokkeerd: H1 binnen 6 px,
  paginahoogte binnen 4 %), `links` (elk `#anker` landt onder de balken, desktop en telefoon), `base` (404.html op een
  diep pad onder `<base>`), `print` (vier afdrukken met PDF) en `audit`. Alles is een notitie behalve een onopgevangen
  fout of een lege pagina; de sectie Robuustheid staat in `docs/qa-report.html`.

### WP-27, vindbaarheid zonder advertenties

- Metadata (`scripts/buildlib.py`, front matter van `src/pages/*.html` en `src/templates/wijk.html`): elke titel onder
  60 en elke beschrijving onder 155 tekens, uniek per pagina; `og:locale`, `og:image:alt` en de Twitter-kaart
  (`twitter:title`, `twitter:description`, `twitter:image`) per pagina met dezelfde `og.png`; canonical op elke pagina.
- JSON-LD: `LocalBusiness` op `index.html` met enkel ware velden (`@id`, `url`, `logo`, `image`, Antwerpen, nl-BE);
  oprichter, adres, KBO, btw en telefoon verschijnen pas als `config.js` ze heeft, een persoonlijk mailadres (Gmail en
  co) blijft eruit, nooit een plaatshouder; `BreadcrumbList` op elke wijkpagina (naam uit `wijken.json`).
- Sitemap: `lastmod` uit `updated:` in de front matter van elke geïndexeerde pagina (`index`, `simulatie`,
  `gereedschap`, `werkwijze` en de wijktemplate kregen die sleutel).
- Kamers (`src/rooms/*.html`): elke kamer linkt naar minstens twee andere kamers in de taal van de koper (buren ->
  gevel, bericht -> gevel en doorlichting, radar -> zichtbaarheidscheck, kaart -> doorlichting en gevel, snymis ->
  bericht met `data-bericht=algemeen`, gereedschap -> De telefoon om 19 u, telefoon -> doorlichting).
- 'Ken je een collega die dit ook zou moeten zien?' met de knop 'Stuur naar een collega' na elk resultaat: De
  telefoon om 19 u, de Doorlichting, de radar-replay, de twee proeven, en elk loket van Gereedschap. De teksten zijn
  data (`docs/assets/js/deel-data.js`, `sim-dag-data.js`, `sim-data-2.js`, `sim-radar-data.js`, `src/data/*.js`,
  sleutel `window.STS_DEEL.<naam>`), geschreven zoals een uitbater ze doorstuurt; `docs/assets/js/deel.js` vervangt
  `tools-share.js` en werkt op elke kamerpagina (navigator.share of wa.me, pas na de klik).
- Nieuwe poorten: `scripts/qa/lint-deel.mjs` (in `lint-copy`: elke knop een tekst en omgekeerd, onder 300 tekens,
  geen woord uit de woordenlijst) en `scripts/qa/meta-check.mjs` (`npm run meta`, in `npm run lint`: titels,
  beschrijvingen, OG, JSON-LD zonder lege of plaatshouderwaarden, sitemap-lastmod, twee kamerlinks per kamer, geen
  dood anker). `docs/CHECKLIST-SAKI.md` kreeg hoofdstuk F: de gratis lokale kanalen die de site ondersteunt.
- Stijl: `.deel-collega` en `.kamer-verder` in `rooms.css`; de ongebruikte `.zc-status` uit `tools.css`.

### WP-22, release-refresh na de polishgolven

- Nieuw: `scripts/qa/links.mjs` (`npm run links`, in `npm run lint` en in het lintblok van `npm run qa` samen met
  `meta-check.mjs`, zodat een gebroken link of een gat in de sitemap het rapport rood maakt). Het leest elke gebouwde pagina
  (`docs/*.html`, `wijk/`, `dev/`, `demo/**`), elke `href`, `src`, `srcset`, `poster`, `action`, `xlink:href`, meta refresh
  en og:image, lost ze op tegen de pagina en haar `<base href>` (404.html) en eist dat het bestand in `docs/` bestaat en
  dat elk `#anker` een id of name op de doelpagina is (een query na het anker is staat en telt niet; `#` alleen is een
  scripthaak). Een oud anker dat `uithangbord.js` doorstuurt (`LEGACY`, bv. `#contact` -> `#bericht`) telt als notitie met
  verwijzing naar `docs/CHECKLIST-SAKI.md` C.6; een adres op een andere host is een notitie (de juridische pagina's noemen
  de Consumentenombudsdienst en de Gegevensbeschermingsautoriteit; de site vraagt er niets op).
- Audit van de gebouwde site na golf 6: 23 pagina's, 1024 verwijzingen, 247 ankers, 0 gebroken; de enige notities zijn de
  drie `index.html#contact`-links in `juridisch.html` en `privacy.html` (C.6, wachten op het OK van de oprichter). Sitemap:
  15 adressen (start, simulatie, gereedschap, werkwijze, zeven wijkpagina's, vier juridische pagina's) met `lastmod` uit
  `updated:`; geen stub, dev-pagina, 404 of QA-rapport; `robots.txt` wijst naar de sitemap. JSON-LD op index.html: één
  `LocalBusiness` met naam, `legalName` uit `config.js`, de beschrijving uit de grondwaarheid (websites met eerst een gratis
  voorbeeld, gratis gereedschap, onderzoek naar AI), Antwerpen en Vlaanderen, adres enkel plaats en land, logo, og.png;
  geen telefoon, e-mail, KBO, prijs of beoordeling zolang `config.js` leeg is. 404.html op een diep pad
  (`wijk/diep/pad/onbestaand.html`, status 404, de Pages-host lokaal beantwoord): `<base>` naar de Pages-host, drie
  stylesheets, H1 in Panchang, 21 van 21 links naar de Pages-host, geen extern verzoek, geen overflow, op desktop en
  telefoon (`.qa/wp22/404-deep-*.png`). Juridische pagina's: de tekst binnen `<main>` verschilt met de vorige publicatie
  (`4188ce3`) nog altijd precies met de afgesproken regels ('Een mens leest', 'Drie' in privacy en cookies, de rij
  `sts-zaak`); golf 6 wijzigde er niets; de `data-c`-plaatshouders (legalName, legalForm, owner, address, kbo, vat, phone,
  whatsapp, email, hosting) staan er alle. Woordenlijst-grep over `docs/` zonder `demo/`: geen euroteken, 'AI-systemen',
  'automatisering', 'ons team', 'een medewerker', 'gegarandeerd', KvK, iDEAL, leads, funnel, 'Verzonden', TODO of lorem
  buiten de juridische pagina's; 'jullie' enkel in klantstem (`data-voice`) en een FAQ-vraag, zoals de regels toelaten.
- Documenten: dit logboek (golf 6 volledig: WP-26, WP-27, WP-22), `docs/CHECKLIST-SAKI.md` (kop, C.6 met de linkchecker,
  nieuw hoofdstuk G met de stand na golf 6), `README.md` (de linkchecker in de release-volgorde), `scripts/qa/README.md`
  (links.mjs). `scripts/qa/budget.json` is niet opnieuw gemeten: dat gebeurt per release-procedure op de schone boom na de
  commit (README, 'Release en QA-poort'); de meting van golf 5 houdt alle poorten groen.
- Gemeten in de volledige run van deze refresh (SwiftShader, werkmap van golf 6 op `269f50a`; 138 runs, 36 a11y-runs, 36
  no-JS-runs, 116 geblokkeerde modules, 4 fontruns, 32 ankers, 4 afdrukken, 1411 s; alles groen, 0 notities): startpagina
  op de telefoon zonder Three.js 407 122 bytes ruw (398 kB, plafond uit de meting van golf 5: 439 249) en 76 809 bytes JS
  gzip-equivalent (plafond 82 463); de groei tegenover golf 5 (399 317) komt van `deel.js`, de deelteksten en de metadata
  van WP-27 en de terugvalregels van WP-26. Desktop met Three.js 1 174 467 bytes (gemeld, niet bewaakt); draw calls na het
  landen 16 op desktop en tablet (plafond 19); lange taken 7 op desktop en 7 op de tablet (gemeld); rAF in 3 s rust 0 op elk
  profiel; intro klaar na 2473 ms op desktop. Doorlichting 384 430, Gereedschap 336 612, Hoe wij werken 380 409 bytes op de
  telefoon, elk onder zijn plafond. `docs/qa-report.html` is dat rapport; het draagt de hash van `269f50a` met de vlag
  'werkmap met wijzigingen' omdat golf 6 nog niet gecommit is: de release-commit draait `npm run qa` opnieuw op de schone
  boom en vervangt het (README, 'Release en QA-poort').

## Golf 5 (tak v5, na v5.0.0): WP-17 mobiele UX en WP-18 copy

Twee polishpakketten uit `scripts/workflows/plan-v5.json`, gebouwd op de live staat van golf 4 met dezelfde poorten.

### WP-17, mobiele UX

De hele site gelopen als uitbater op een telefoon van 390 px, met één duim; 51 schermafbeeldingen van elke gewijzigde
weergave in `.qa/wp17/` (390x844, 844x390, 1024x1366). Wat veranderde:

- Dock en kop (`uithangbord.css`): safe-area links en rechts (liggende notch) naast de bestaande onderrand; het dock
  schuift enkel wanneer de huidige deur afgesneden is, uitgelijnd op een deurgrens, en zet dan `is-scrolled` (ook links
  een randverloop); de deurenrij past dus nooit per ongeluk op een halve deur.
- Bewerkblad (`uithangbord.js`): openen zet één geschiedenisstap (`{ubSheet:1}`), zodat Terug op de telefoon het blad
  sluit in plaats van de pagina te verlaten; elke andere sluiting (Escape, chip, 'Zet op het bord', tik erbuiten) haalt
  die stap weer weg. Toetsenbord open (`visualViewport` 120 px lager en een veld met focus): `html.is-toetsenbord`
  verbergt het dock, `--vvh` begrenst de hoogte van het blad en het veld blijft in beeld.
- Velden (`src/partials/uithangbord.html`, `src/rooms/*.html`, enkel attributen): `autocapitalize`, `spellcheck`,
  `enterkeyhint` (next/done), `inputmode` (email, tel, url), `type="tel"` en `autocomplete="url"` waar het veld dat is;
  elk veld 16 px (iOS zoomt niet in), de uurvelden van het Google-kaartje 44 px hoog (`tools.css`).
- Bericht (`rooms.css`): de foutmelding `#form-err` (role=alert) staat boven het eerste veld, naast het veld dat van
  `contact.js` de focus krijgt, ook op een telefoon waar de knop dan buiten beeld is.
- Liggende telefoon (`base.css`, bijgevoegd blok, en `rooms.css`): op grove aanwijzers in liggende stand toont de
  SVG-skyline haar eigen verhouding vanaf de bovenrand, zodat het bord van het landmark niet achter de kop verdwijnt;
  de aankomst begint er net onder (23vw + 24 px).
- Gereedschap (`tools.css`): `scroll-margin-top` op elk loket en op elk veld, zodat een ankersprong of een focus de kop
  niet onder de kleverige tabs laat vallen.

### WP-18, copy en emotie: de hele site gelezen als uitbater

Alleen tekst veranderde; geen structuur, geen gedrag, de elf sleutels van het conversiecontract en hun sjablonen
ongewijzigd (`scripts/qa/fixtures/prefill.json` is onaangeroerd).

- Startpagina: de eerlijkheidszin boven de schets begint met de naam ('Dag {zaak}. Daar hangt je naam.') en houdt de
  verplichte varianten (getypt: 'behalve de naam die je net typte'; kaartje of wijklink: 'We gebruikten enkel de naam op
  het kaartje; de rest typ je zelf'); de wachtzin zegt wat er gebeurt als je typt; de 19 u-regel zegt 'meestal drie
  dingen'; de knop 'Loop verder' heet 'Verder: de telefoon om 19 u'. De twee aankomstzinnen en de H2 'Hoe
  heet je zaak?' bleven: ze dragen al Antwerpen, voorbeeld, onderzoek, verkenner en Snymis in 16 en 13 woorden.
- De telefoon om 19 u: de aanloop begint bij de dag van de uitbater ('Je staat te bedienen, je zit onder een wagen, je
  handen zitten in het deeg: en de telefoon gaat.') en houdt 'gesimuleerd', 'verzonnen' en 'jouw echte cijfers kennen we
  niet' in dezelfde alinea.
- Bericht: stap 3 belooft niet langer 'het is geregeld' maar 'onderhoud en aanpassingen als jij dat wil, nooit als
  verplichting'; het antwoord op 'Wat is dat gratis voorbeeld' noemt enkel wat de pijplijn gebruikt (je uren, je adres,
  je Google-profiel) en geen foto's of reviews meer (zie `docs/CHECKLIST-SAKI.md` D.8); het antwoord over AI zet wat
  vandaag werkt vooraan en het onderzoek erachter; de prijsvraag begint bij het gratis voorbeeld.
- Doorlichting: de lege staten zeggen wat er komt ('Nog niets gevonden. De agent leest eerst de cijfers; de bevindingen
  komen hier, een voor een.'); het slotblok heet 'Dezelfde blik, maar dan op jouw zaak' en de knop 'Laat ons kijken wat
  een klant van mij ziet'.
- Gereedschap: elke foutmelding en lege staat zegt wat er gebeurde en wat je doet ('Nog niet alle zes beantwoord. Vul de
  open vraag in, dan rekenen we je score uit.'; het nummerveld zegt hoe je het schrijft en wat er dan komt).
- Hoe wij werken: 'Wie zit erachter' is 127 woorden in de ik-vorm zonder plaatshouder, enkel uit feiten die elders op de
  site staan; de radar-statusregel zegt dat de stappen een voor een opengaan; het vierde pand in De straat is korter.
- Wijkpagina's: de knop heet 'Typ mijn zaak op het bord' (de uitbater spreekt), het bord heet overal 'bord'.
- Meta-beschrijvingen: elke `description:` korter dan 155 tekens en uniek (start, Doorlichting, Gereedschap, Hoe wij
  werken, de wijktemplate met de langste naam, dev/bericht); de titels bleven.
- Woordenlijst: nieuwe regel `robot` (robot, chatbot; de plaatshouder `{{robots}}` uitgesloten), gedocumenteerd in
  `copy-regels.md` hoofdstuk 1; nieuw hoofdstuk 11 met de lengte- en staatregels van dit pakket (25 woorden, 155 tekens,
  menselijke foutzinnen, de uitkomstzin van een simulatie, praktijk is u, de kamer Snymis).
- Sceptische leesbeurt van de gebouwde pagina's (als uitbater): drie zinnen die te veel beloofden zijn herschreven. 'Je domein
  verhuist ... zonder onderbreking' (een belofte over een verhuis) werd 'je huidige site blijft gewoon staan; je domein verhuist
  pas als jij tevreden bent'; 'Zit je liever samen aan de toog, dan kan dat ook' (een bezoek beloven is de keuze van de
  oprichter, copy-regels hoofdstuk 6) werd weer 'een bezoek kan als je dat liever hebt'; 'Om 19 u wil een klant drie dingen
  ... Meer niet.' werd 'meestal drie dingen'. De schetszin kreeg vier woorden minder ('om mee te vergelijken'), omdat ze in
  Panchang op een telefoon anders tien regels vraagt.
- Niet veranderd, bewust: de uitkomstzin van De telefoon om 19 u in `sim-dag.js` en die van de radar in `sim-radar.js`
  (code, geen data; ze eindigen al op 'geen voorspelling over jouw zaak' en 'Ook in het echt niet.'), de vier juridische
  pagina's en hun beschrijvingen (elk al onder 155 tekens), `sim-dag-data.js` en `sim-radar-data.js` (de verzonnen
  bellers en buren spreken al in de woorden van de zaak; praktijk in u), de sfeerzinnen (leeg tot de oprichter ze levert).

### Golf 5, fixronde

- Bewerkblad en geschiedenis (`uithangbord.js`): een tik op een deur of een link terwijl het blad open staat haalt eerst
  de stap van het blad weg en navigeert dan (de eigen klik wordt één keer opgegeten, de sprong wacht één taak op het
  herstel van de scrollpositie), zodat Terug niet meer op een dubbele startpagina landt; 'Minder animatie' herlaadt op
  dezelfde manier. Enkel een stap die dit document zelf zette wordt teruggenomen, en een stap die een herlading
  overleefde (F5, trek-om-te-verversen, de schakelaar) wordt bij de start gewist: geen onverwachte Terug meer na een
  herlading. Een knijpzoom is geen toetsenbord (`visualViewport.scale`): het dock blijft staan en de pagina scrolt niet
  onder de vingers van wie inzoomt.
- Lange namen: een naam van 40 tekens (twee woorden, of één woord zonder spatie) maakt geen enkele pagina breder dan het
  scherm. `tools.css` zet de telefoonkolom van elk loket op `minmax(0,1fr)`, de host en de titel van het Google-voorbeeld
  mogen breken; `base.css` (bijgevoegd blok) laat elk `[data-zaak]` breken, net als de schetszin (`rooms.css`), de
  contextregel van de Doorlichting (`sim.css`) en die van de radar (`werkwijze.css`). De harnas meet nu ook
  gereedschap.html en index.html met zo'n naam en een gemeente van 30 tekens (`runner.mjs`, long-name).
- Bericht: `#form-err` staat ook in de bron boven het eerste veld (`src/rooms/bericht.html`), de flex-order van WP-17 is
  weg: lees- en kijkvolgorde zijn gelijk. Het blok voor wie ongevraagd een bericht kreeg heeft zijn eigen label ('Voor
  wie een bericht van ons kreeg'), blijft in u en verwijst in één zin naar 'Zo komt u op onze radar' op werkwijze.html
  en naar de privacyverklaring; de kamer wisselt niet meer van aanspreekvorm binnen de vragenlijst.
- Copy: de eerlijkheidszin onder de schets belooft enkel 'je echte uren en adres ... met wat je zelf al openbaar maakte'
  (geen foto's, zoals de FAQ en `CHECKLIST-SAKI.md` D.8); 'Wie zit erachter' zegt 'Bevalt het niet, dan stopt het daar.'
  (de verwijdering van een geweigerd voorbeeld is D.6, nog niet beslist; de lede van werkwijze.html staat daar nu bij
  als tweede plek); de capaciteitenkaart 'Werkt vandaag' noemt de openingsuren-check als vijfde loket.
- Harnas: de poort eerste scherm op index.html meet nu ook 'Antwerpen' en 'voorbeeld' (`budget.mjs`), zoals
  `copy-regels.md` hoofdstuk 11 al beweerde.

## v5.0.0 (2026-10-26): Uithangbord op de nachtstad

Vier golven (WP-00 tot WP-15) plus de eerste drie polishpakketten (WP-16, WP-19, WP-21) en hun fixronde. De voorkant is het Uithangbord: de naam van de zaak van de bezoeker op een verlicht
bord op het landmark van de nachtstad, één strip met vijf deuren in de taal van de uitbater en één actie, 'Bericht
aan Snymis'. De stad reageert op staat (naam, sector, de kamer in beeld), nooit op scrollpositie.

### Verwijderd

- De bovennavigatie met zeven links, de hamburger, de rail met negen ankers, de vaste Contact-pil op de telefoon en de
  Site-kolom in de voet; in de plaats één strip (desktop) of dock (telefoon) met vijf deuren.
- De metafoor-H1, de drie zwevende tags met backdrop-filter, de vloeibare CTA (feGaussianBlur), de scroll-hint.
- De drie sticky hoofdstukken van 300svh, de hoofdstukmeters, ScrollTrigger-scrub, `STSScene.setProgress` en Lenis.
- Elke stadsprop die op scrollvoortgang draaide: het groeiende draadmodel van het landmark, het scanvlak, het baken,
  de band, het lichtspoor, de ASCII-spiegel met `readRenderTargetPixels`.
- De dienstencarrousel met zes kaarten en haar overclaims (AI-systemen en agents, automatisering, 'data & leads met
  duizenden contacten', ontwerp en branding als product), de holografische glans en de 3D-kanteling.
- De Engelse slogan-marquee, het split-flap vertrekbord als leusbord met zijn `setInterval` van 14 s, de
  gradient-mesh-vlekken, de eigen cursor met komeetspoor.
- Beide accordeons met GSAP-hoogteanimatie (nu native `<details>`), de demo-teaser op de startpagina, `demos.html`
  als pagina (nu een doorverwijzing naar De straat), de strip met vijftien Engelse stijlnamen.
- De negen losse 'Gratis voorbeeld'- en 'Contact'-knoppen; nu één `data-bericht`-actie per kamer die in het Bericht
  landt met een vooringevulde zin.
- Overclaimende copy: de hero-lede en -tags, FAQ 05, de simulatie-CTA 'met jouw echte oproepen', de statistiek in de
  tip van het gereedschap, het resultaat 'tijd voor automatisering', 'een medewerker' in de privacyverklaring, vijf
  gevulde sterren zonder 'voorbeeld', presets die agenda-integratie, garantie of ordertracking beloofden, de
  JSON-LD-beschrijving 'Websites, AI-systemen en automatisering' en `priceRange`, de titel van de startpagina.
- `motion.js` (vijftien taken in één bestand), `style.css` als één bestand van 423 regels, EmailJS als verzendpad (het
  zou een extern verzoek zijn; de sleutel blijft leeg), elke `backdrop-filter` boven het canvas.
- Golf 4: de faces Panchang 500, Switzer 500 en JetBrains Mono 500 uit de STS-CSS (Panchang 600 en Switzer 400 bedienen die
  gewichten; drie lettertypebestanden minder per pagina) en Unbounded buiten `docs/demo/radar`; de bestanden
  `panchang-normal-500.woff2` en `switzer-normal-500.woff2`; vier dode CSS-regels (`video` in de reset, `.solid`,
  `.legal ol`, `.legal .note`); in de scène de losse rand-mesh en de cyaan `heroLight`-sprite (nu één bordtextuur met rand,
  bezel en buis).

### Toegevoegd

- **Golf 1 (WP-00 tot WP-03).** De QA-harnas in `scripts/qa/` (Playwright, drie GL-modi, drie profielen, varianten
  reduced, lite en intro, woordenlijst-scan, byte- en rAF-meting, publicatiewacht `prepush.sh`); het bouwsysteem met
  kamers (`src/rooms/*.html`, `rooms:` in de front matter, `DOORS`/`ACTION`), doorverwijsstubs, `noindex:`,
  `updated:`, `{{svg:naam}}`; de staatkern (`state.js`, `names.js`, `contact-prefill.js` met het bevroren
  conversiecontract van elf sleutels, `hydrate.js`, `reveal.js`, `lite.js`); de scène met het bord als onderwerp van
  de camera, plekken en vluchten, render-on-demand met rust = 0 frames, de bloomproef, `guard()` en de SVG-skyline
  als route voor telefoon, lite, zwakke toestellen en elke fout.
- **Golf 2 (WP-04 tot WP-08, WP-11).** De strip en het dock, de startpagina met het bord en de twee aankomstzinnen,
  de kamers Jouw gevel, De telefoon om 19 u, De buren, Verder en Bericht; de Doorlichting (`simulatie.html`) met een
  vierde verzonnen zaak, wat-als en het fasebord; Gereedschap (`gereedschap.html`) met het Google-kaartje, de
  scorekaart, de A6-kaart met QR en het interne toogkaartje; het Bericht als enige conversiezinkput met FAQ en de
  drie stappen één keer; de CSS-split (elk bestand onder 400 regels, nergens `backdrop-filter`).
- **Golf 3 (WP-09, WP-10, WP-12, WP-13, WP-14).** `werkwijze.html` met de replay Van radar tot gesprek
  (`src/data/radar-bericht.json`, u-vorm, 'voorbeeldbericht (ontwerp)'), De straat uit `panden.json`, de
  capaciteitenkaart met de drie lampen WERKT VANDAAG / PROTOTYPE / IN ONDERZOEK uit `capabilities.json`, de kamer Wie
  is Snymis, de twee proeven onder In onderzoek (reviews in jouw toon, de gescripte assistent); de nl-BE-copypas met
  `copy-regels.md` en `src/data/woordenlijst.json` (stemmen `data-voice`, wijkscope), `og.png` uit `src/og.html`; zeven
  wijkpagina's uit `src/data/wijken.json`; de openingsuren-check als vijfde loket in Gereedschap.
- **Golf 4 (WP-15).** Het gemeten prestatiebudget: `node scripts/qa/budget.mjs --measure` schrijft
  `scripts/qa/budget.json` uit een volledige groene run (plafond = meting + 10 % voor bytes en + 20 % voor draw calls,
  nooit boven 450 kB ruw op de telefoon of 90 kB JS gzip-equivalent in lite, met de commit waarop gemeten is); alle
  poorten aan (rAF-rust, timers, bytes, draw calls, eerste scherm, backdrop-filter, strikte regellimieten: scene < 300,
  CSS < 400, alles < 500); de nogl-pas eist de SVG-skyline en een geplaatst `#sign-dom`; het rapport toont JS gzip,
  draw calls en lange taken per run, het budget en de lijst schermafbeeldingen van een `--shots`-run (gl en gl-swift,
  desktop en telefoon, in `.qa/shots/`); `docs/CHECKLIST-SAKI.md` in eindversie met de `?debug=1`-stap voor de echte
  grafische kaart; dit logboek.
- **Golf 4 (WP-16, prestaties).** Voor de bezoeker: de startpagina op de telefoon weegt 374 kB in plaats van 412 kB
  (drie lettertypebestanden minder, `og.png` van 169 naar 60 kB, de straatfoto's elk onder 60 kB), de tekst verspringt niet
  wanneer de webfonts aankomen (metrisch gelijke terugvalfonts met `size-adjust` in `fonts.css`), de preloads per pagina
  (`{{preloads}}`, `PRELOAD_DEFAULT` in build.py) dekken enkel het eerste scherm. In de harnas: `perf.mjs` meet verzoeken,
  ruwe JS, lettertypegebruik, de H1-verschuiving (CLS) en het eerste frame met de H1; poorten `requests`, `font`, `three`,
  `cls`, `h1-paint` en `assets`; `css-dead.mjs` (`npm run perf:css`) en `img-shrink.py` (`npm run perf:img`).
- **Golf 4 (WP-19, toegankelijkheid).** Voor de bezoeker: de gedempte tekst (`--ink3`) ging van .44 naar .58 (4,1:1 werd
  6,4:1), het naamblad is een echte dialoog (role, aria-modal, focusval, Escape, focus terug op de chip), een onvolledig
  formulier noemt de velden in `#form-err` (role=alert) en koppelt ze met `aria-invalid` en `aria-describedby`, de
  uurschuiver van het Google-kaartje heeft haar focusring terug, de leus in de voet draagt `lang="en"`. In de harnas:
  `a11y.mjs` en `a11y-dom.mjs` (contrast over samengestelde achtergronden, namen, koppen, landmarks, formulieren,
  live-gebieden, Tab-doorloop, dialoog, 200 % zoom, minder beweging) in `npm run qa`; contrast en namen zijn een fout.
- **Golf 4 (WP-21, scène en bord).** Voor de bezoeker: het bord is een ingelijst paneel met bezel en neonbuis (één
  textuur, geen post-processing), de letters krijgen hun gloed in de textuur (twee passen) en een lichte kern in de DOM,
  onverlicht toont het bord een donkere lijst met gedoofde buis, het dak van het landmark weerkaatst de sectorkleur, de
  silhouet kreeg een annex en een dakrand, nieuwe cameraplekken per kamer, fov 64 in portret, parallax begrensd op 1 eenheid
  en uit tijdens een vlucht; de SVG-skyline op de telefoon draagt dezelfde lijst.
- **Golf 4, fixronde.** Een landing kost altijd precies één frame, ook onder de panelen (daarvoor hield het canvas de vorige
  landing terwijl de DOM-letters al verplaatst waren); `cover()` tekent enkel bij de overgang terug onder 0,6; een geblokkeerd
  Panchang-bestand laat de lus niet meer draaien (rust blijft 0 frames); het DOM-bord vervaagt zolang een kamerpaneel het
  dekt (de panelen sluiten op elkaar aan, een vast bord past nergens in een stadsband; de gloed blijft door het paneel
  zichtbaar); de parallax-settle werkt ook onder minder beweging; de SVG-buis is gedoofd tot er een naam staat en
  `?debug=1` werkt ook op de SVG-route; JetBrains Mono 400 staat bij de preloads (de doklabels op de telefoon, kost geen
  byte extra); plafond draw calls 19 in plaats van 20; klikdoelen onder 44 px zijn een fout; `checkAssets` leest de
  preloads uit de gebouwde pagina's (`npm run perf:selftest`) en faalt op een dood lettertypebestand; het rapport toont de
  toegankelijkheidsresultaten en zegt wanneer het op een werkmap met wijzigingen is gemaakt; de publicatiewacht rekent
  `docs/qa-report.html` niet als release (zie Uitgesteld voor de volgorde).

### Gemeten bij de release (SwiftShader, zonder GPU; `scripts/qa/budget.json`, gemeten op `c48bc9a5` met de werkmap van golf 4)

Het rapport telt kB per 1024 bytes. De cijfers hieronder zijn die van `budget.json`; de release-commit meet opnieuw op de
schone boom (README, 'Release en QA-poort') en dan vervangt die meting deze lijst.

- Startpagina op de telefoon (SVG-route, zonder Three.js): 374 kB ruw (382 945 bytes, 30 verzoeken), 70 kB JS
  gzip-equivalent (71 551 bytes); de harde grens is 450 000 bytes (439 kB in het rapport) en het plafond uit de meting
  (+10 %, 411 kB) ligt daar dus onder.
- Startpagina op desktop mét Three.js: 1117 kB ruw (1 144 001 bytes), 262 kB JS gzip-equivalent (gemeld, niet bewaakt:
  Three.js laadt alleen op desktop en tablet na de inline routetest).
- Draw calls na het landen op desktop en tablet: 16 (plafond 19 = gemeten + 3); lange taken onder SwiftShader op de
  startpagina: 6 op desktop en 7 op de tablet in het rapport van deze fixronde (gemeld; de echte meting is de `?debug=1`-stap van de oprichter, doel hoogstens 3 per vlucht);
  H1-verschuiving 0 px en CLS 0 bij de eerste lading op elke run.
- rAF in 3 s rust: 0 op elk profiel; de telefoon tekent geen enkel scene-frame.
- Sitemap: 15 adressen (start, simulatie, gereedschap, werkwijze, zeven wijkpagina's, vier juridische pagina's); geen
  stubs, dev-pagina's, 404 of QA-rapport.

### Juridische pagina's

Sinds de vorige publicatie (commit `4188ce3`) veranderden in `juridisch.html`, `privacy.html`, `cookies.html` en
`voorwaarden.html` enkel de afgesproken regels: de rij `sts-zaak`, 'Drie' in plaats van 'Twee' met de zin dat een
zaaknaam een persoonsnaam kan zijn (cookies, privacy 2.3), 'Een mens leest' in plaats van 'Een medewerker leest'
(privacy), de datum in de front matter en de scriptlijst (`motion` -> `lite uithangbord`, techniek zonder
tekstgevolg). Eén afwijking buiten die lijst, bewust: de meta-beschrijving van `voorwaarden.html` noemt 'AI-systemen'
niet meer (WP-12; een beschrijving voor zoekmachines, geen voorwaarde). De kop- en voetpartials (de strip, de voet, de
scriptlijst, in golf 4 de preloads en `lang="en"` op de leus) zijn sitechrome en veranderen mee op elke pagina; de
tekst binnen `<main>` verschilt precies met de regels hierboven (nagekeken: privacy 2 regels, cookies 2 regels plus de
rij `sts-zaak`, voorwaarden enkel de meta-beschrijving, juridisch niets). De zichtbare tekst 'Wat we doen' en punt 1
van de voorwaarden wachten op het OK van de oprichter (`docs/CHECKLIST-SAKI.md`, C.4 en C.5).

### Uitgesteld of bewust niet gebouwd

- Kioskstand (de stad die blijft vliegen zonder bezoeker): niet gebouwd, de rust-staat tekent nul frames en dat blijft zo.
- Openingsuren-check: níet uitgesteld; ze staat als vijfde loket in Gereedschap (WP-14).
- EmailJS en elke andere directe verzending: uit, omdat de site geen extern verzoek doet; het Bericht opent de mail- of
  WhatsApp-app en zegt dat.
- Een eigen domein: beslissing van de oprichter; `--base` in `package.json` is de enige knop.
- De polishpakketten WP-17, WP-18, WP-20 en WP-22 (de rest uit `plan-v5.json`) volgen na deze release op dezelfde tak,
  met dezelfde poorten; WP-16, WP-19 en WP-21 zitten in deze release.
- Het samenvoegen van `v5` in `main` en de commit van `src/`, `scripts/` en `docs/` gebeuren door een mens op een groen
  rapport, in deze volgorde: commit -> `npm run qa` op die commit -> `scripts/qa/prepush.sh --check` ->
  `STS_RELEASE=1 git push origin main` -> `node scripts/qa/budget.mjs --measure && npm run qa` op de schone boom ->
  vervolgcommit met `scripts/qa/budget.json` en `docs/qa-report.html` (README, 'Release en QA-poort').

### Wacht op de oprichter

Alles in `docs/CHECKLIST-SAKI.md`: de wettelijke identiteit en de lege sleutels van `config.js`, het zakelijke
e-mailadres en WhatsApp, de antwoordbelofte, de drie prototypezinnen, de echte eerste-contacttekst, het beleid voor
een niet-verzonden voorbeeld, foto en verhaal, de sfeerzinnen en `config.wijken`, het OK op de juridische alinea, de
verzonnen namen, de domeinnaam, en de schermafbeelding met `?debug=1` van de pc die bevroor.
