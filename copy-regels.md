# Copyregels van Star.Tec.Solutions (v5)

Elke zin op de site wordt gelezen door een uitbater aan de toog, 's avonds, op zijn gsm. Deze regels komen uit het
bouwplan (`scripts/workflows/PLAN-V5.md`, Copystrategie en Eerlijkheidsregels) en uit de beslissingen van de kritiek.
`src/data/woordenlijst.json` is de machineleesbare helft; `scripts/qa/lint-copy.mjs` (statisch) en `scripts/qa/checks.mjs`
(gerenderd, in `npm run qa`) dwingen ze af. Wie een regel schrapt, schrapt ze hier én in de woordenlijst, met de reden.

## 1. Taal: Belgisch-Nederlands, zonder jargon

- Woorden van hier: zaak, gsm, goesting, langskomen, offerte, in orde brengen, buurt, uitbater, handelaar, gemeente en
  district, KBO, Bancontact, fruitsap, frieten. 'Gemeente of district' is de veldnaam; Mortsel is een gemeente, de zes
  andere wijkpagina's zijn districten van Antwerpen.
- Nooit (woordenlijst, scope `sts`): leuk, mobieltje, doei, hartstikke, gaaf, pinnen, KvK, iDEAL, Randstad; leads, funnel,
  conversie, onboarding, solutions (behalve in de merknaam), smart, seamless, boost, premium, KPI, ROI, 'klik hier';
  AI-powered, AI-gedreven, slim(me), revolutionair, baanbrekend, innovatief.
- 'AI-systemen' en 'automatisering' zijn geen diensten van ons en staan nergens buiten de vier juridische pagina's, ook
  niet in titels, meta-beschrijvingen, OG-tags of JSON-LD. De juridische zin wacht op het OK van de oprichter
  (`docs/CHECKLIST-SAKI.md`, punt 4). Wat er wel is, heet bij zijn naam: een verkenner, een bouwer, onderzoek.
- Getallen en tijd: '19 u', '7 tot 20 u', '30 dagen', '5 werkdagen'; geen '24/7', geen '24 uur'.
- Engels alleen waar het een eigennaam is (WhatsApp, Google, GitHub Pages) en in de leus.

## 2. Aanspreking: je of u, nooit gemengd in één sectie

- `je/jij`: de startpagina, Doorlichting, Gereedschap, de proeven onder In onderzoek, de wijkpagina's.
- `u`: 'Zo komt u op onze radar' (kamer Snymis), het blok 'Kreeg u een bericht van ons' in de kamer Bericht, de
  eerste-contacttekst in de radar-replay (`src/data/radar-bericht.json`) en de praktijk-variant van de sector (names.js
  markeert die met `u`; `[data-aanspreek]` krijgt je of u).
- Binnen één `<section>` of kamer wisselt de aanspreking nooit. Een u-blok heeft een eigen kop en `role="region"`.

## 3. Persona: Snymis, en 'wij' één keer uitgelegd

- Snymis is de enige naam en altijd een echte persoon die alles leest. Geen echte naam tot de oprichter die aanlevert
  (config.js `owner`), geen foto tot hij er een geeft.
- 'Wij' betekent Snymis plus zijn agents (verkenner, bouwer). Dat staat één keer uitgelegd, in de lede van
  `werkwijze.html`; de kamer 'Wie is Snymis' spreekt in de eerste persoon en herhaalt die uitleg niet.
- Nooit: 'ons team', 'een medewerker', 'onze medewerkers', 'het team van'. 'Geen team van tien' mag: het ontkent.
- STS spreekt één uitbater nooit met 'jullie' aan. De lint verbiedt 'jullie' in STS-stem; zie hoofdstuk 4 voor de
  twee stemmen die wél 'jullie' zeggen.

## 4. Stemmen: `data-voice` en de FAQ-vraag

Niet elke zin op de site is STS die spreekt. Drie plekken zijn een andere stem en dragen dat als attribuut; de
woordenlijst slaat ze over voor de regels in STS-stem (en alleen daarvoor: sim-regels blijven gelden).

| attribuut | wie spreekt | waar |
| --- | --- | --- |
| `data-voice="visitor"` | de uitbater zelf | het tekstvak van het Bericht (voorinvulling 'Dag Snymis, ik ben ... Mag ik ...?'), de deeltekst, titel en beschrijving in het Google-voorbeeld, de afwezigheidstekst van de openingsuren-check |
| `data-voice="customer"` | een klant tegen een zaak | de klantvragen in de proef 'Zo zou een assistent kunnen antwoorden' ('Zijn jullie vanavond open?'), het WhatsApp-bericht dat de klant naar de zaak stuurt |
| `data-voice="pand"` | de verzonnen oude site van een pand | de `oude gevel` in De straat (`docs/assets/img/oud-*.svg`, inline gezet door `scripts/builddata.py`): een site uit 2011 die met opzet fout is ('klik hier', geen belknop) |
| `details > summary` | de bezoeker die een vraag stelt | de FAQ-koppen in de kamer Bericht ('Werken jullie ook buiten Antwerpen?'); het antwoord eronder is STS-stem |
| `data-voice="qa"` | het QA-rapport | `docs/qa-report.html`, citeert bevindingen |

Regels: het attribuut staat op het dichtstbijzijnde element dat de hele vreemde tekst omsluit, nooit op een hele kamer.
Een bouwer die 'jullie' tegenkomt in een lintfout verwijdert de regel niet en verplaatst het attribuut niet naar
een ouder: hij herschrijft de zin (STS-stem) of markeert precies het element dat een andere stem is.
De zelftest (`npm run lint:selftest`) bewijst dat de visitor-regel en de FAQ-kop vrij zijn en de STS-zin niet.

## 5. Simulaties: `data-sim`, labels in de zin zelf

- Een kamer die cijfers, oproepen, reviews of gesprekken verzint draagt `data-sim` en zegt in zichtbare tekst
  'gesimuleerd' of 'fictief'. Per kamer eist `sim.perRoom` in de woordenlijst meer: De telefoon om 19 u zegt
  gesimuleerd, verzonnen en scenario; Doorlichting verzonnen, gesimuleerd en Snymis; Van radar tot gesprek verzonnen,
  fictief, simulatie en Snymis; De straat verzonnen en fictief; het Google-kaartje fictief en voorbeeld; de twee
  proeven gesimuleerd, gescript en verzonnen.
- Elke zaak in een simulatie heeft een verzonnen naam (Brasserie De Lantaarn, Bakkerij Noordpool, Kapsalon Lumen,
  Garage Verhulst, Dakwerken Pauwels, Brasserie Meridiaan, Barbier Boris). De naam van de bezoeker staat alleen in de
  gevelschets, het Google-kaartje, het gereedschap en het Bericht, en als contextzin: 'Jouw echte cijfers kennen we niet.'
- De zin labelt zichzelf: 'een gesimuleerde dinsdag', 'de verzonnen Bakkerij Noordpool', 'schatting op gesimuleerde
  data, geen voorspelling voor jouw zaak'. Een label in een hoekje volstaat niet.
- Gescripte uitkomsten heten 'aanname' of 'scenario' ('Regel in dit scenario: ...') en hun regels staan in de kop van
  het databestand (`sim-dag-data.js`, `sim-data.js`, `assistent-dialoog.js`, `lab-reviews-data.js`).
- Binnen `data-sim` nooit: studie, 'onderzoek toont', rapport, statistiek, 'volgens de cijfers van', sectorcijfers als
  dreigement. De methode mag echt heten; de cijfers heten verzonnen.
- De goedkeuring door een mens blijft letterlijk: 'Snymis keurt het advies goed voor het naar de zaak gaat', 'Er vertrekt
  niets automatisch, ook in deze simulatie niet', en na 'Niet sturen': 'Dan vertrekt er niets. Ook in het echt niet.'
- Het eerste-contactbericht heet 'voorbeeldbericht (ontwerp)' tot de oprichter de echte tekst levert (`echt: true`).
- De assistent-proef noemt nooit Kawa; prototypes dragen enkel de ene zin van de oprichter en de voetzin 'Prototype,
  niet op deze site, nog geen klantproduct.'

## 6. Eerlijkheid in elke zin

- Geen prijzen, geen prijsankers, geen 'vanaf', geen euroteken buiten de juridische pagina's (daar staat de wettelijke
  vergoeding). Op de vraag naar de prijs: 'eerst gratis een werkend voorbeeld, daarna een vast bedrag op papier'.
- Geen 'gratis!' met uitroepteken; schrijf 'kosteloos voorbeeld, zonder verplichting' of 'gratis voorbeeld'.
- Geen tellers, geen 'reeds N zaken', geen testimonials, geen klantenlogo's, geen badges, geen urgentie ('laatste kans',
  'beperkte tijd'), geen vooraf aangevinkte vakjes. Vijf gevulde sterren alleen naast het woord 'voorbeeld'.
- Geen 'Verzonden'-staat: het formulier opent de mail- of WhatsApp-app en zegt dat ('Dit opent je mail- of WhatsApp-app.
  Snymis leest het zelf.'). De enige belofte over antwoordtijd is `config.replyPromise`; leeg betekent geen belofte.
- De gevelschets belooft alleen wat het gratis voorbeeld bevat (naam, uren, adres, bel- en WhatsApp-knop,
  plaatshouders), elke regel gemarkeerd 'voorbeeld'; nooit 'garantie', 'live uit je agenda', '24 uur'.
- De eerlijkheidszin van de gevel volgt hoe de naam binnenkwam: getypt ('behalve de naam die je net typte') of via
  kaartje of wijklink ('We gebruikten enkel de naam op het kaartje; de rest typ je zelf'). Nooit 'alles hier is op jouw
  naam', want de buren zijn verzonnen.
- Capaciteiten volgen de grondwaarheid: werkt vandaag (pijplijn met goedkeuring, gratis voorbeeld, Doorlichting,
  Radar-concept, demo's, gereedschap), prototype (Kawa, sts-world, webshot: niet op deze site), de rest in onderzoek.
- 'Kom eens langs' alleen als het waar is (oprichter beslist); 'Snymis komt hier langs' op een wijkpagina alleen via
  `config.wijken`.

## 7. Leus, merkregel en de voet

- De leus 'Where imagination can reach up to the stars.' staat precies twee keer op `index.html` (de intro, als
  `<template id="intro-tekst">` in de bron, en de voet) en precies één keer op elke andere pagina (de voet). Ze staat
  nergens in een alinea en wordt nooit vertaald of aangevuld.
- De merkregel onder de leus: 'Star.Tec.Solutions is het merk van STS Digital, Antwerpen. Eén persoon, Snymis, en een
  paar agents die hem helpen.'
- De voet bevat verder: de vijf deuren (dezelfde `DOORS` als de strip), de vier juridische links, de contactregel uit
  `config.js` (e-mail, WhatsApp, telefoon; leeg = onzichtbaar), het jaar, de rechtspersoon, 'Geen cookies, geen trackers'
  en de knop 'Minder animatie' (na een klik 'Meer animatie'). Dezelfde schakelaar heet in het bewerkblad van het
  uithangbord ook 'Minder animatie'. Geen derde navigatie.
- De intro toont de leus één keer (aria-hidden) en de knop 'Intro overslaan'; beide teksten zijn definitief.

## 8. Kleur en typografie als copyregel

- Cyaan (`--cyan`, #36E8FF) is accent: het bord, de actieve deur, focusringen, één gloed op de hoofdknop, een
  grafiekhoogtepunt, een inline link of een enkel woord in `<em>`. Nooit een alinea. `scripts/qa/copy-check.mjs` meet dat
  geen element met cyaan tekst hoger is dan 1,6 keer zijn lettergrootte, op desktop en telefoon: een link die op 390 px
  over twee regels loopt, is te lang en wordt ingekort.
- Violet (`--violet`, alias `--mens`) is de kleur van de mens: Snymis, de goedkeuringsstap, het label en de stapnummers
  van de kamer Bericht, de antwoordbelofte. Nergens anders.
- Sectorkleuren (`--sector-*`) kleuren alleen het landmark, de ster in de naamchip en het bord; nooit tekst.
- Panchang voor H1, kamertitels en het bord; Switzer voor tekst; JetBrains Mono voor labels, tellers, logs en het
  fasenbord. Een `.label` is een eyebrow in kapitalen, maximaal vijf woorden.

## 9. Microcopy

- Knoppen zijn beleefde werkwoorden in de eerste persoon van de bezoeker of een uitnodiging: 'Hang mijn bord op', 'Laat
  Snymis het echte voorbeeld bouwen', 'Speel de dinsdag', 'Start de doorlichting', 'Stuur een berichtje', 'Zet op het
  bord', 'Bespreek dit met Snymis'. Nooit 'Verstuur', 'Submit', 'Klik hier', 'Meer info'.
- Formulier: label 'Wat mogen we voor je bekijken?'; status 'Dit opent je mail- of WhatsApp-app. Snymis leest het zelf.';
  na het openen: 'Je mail- of WhatsApp-app zou nu open moeten staan, met je bericht erin.'
- Voorinvullingen schrijft `contact-prefill.js` uit één sjabloon per sleutel, zoals de uitbater het zou schrijven:
  'Dag Snymis, ik ben van {zaak} in {gemeente} ({Sector}).' Ze dragen `data-voice="visitor"`.
- Opslag: 'Blijft in je browser. We sturen niets.' Nooit 'veilig opgeslagen', nooit 'wij bewaren'.
- Het gereedschap zegt wat het is: 'zelfinschatting' op de scorekaart, 'niet live van Google' bij het kaartje, 'Dit is
  wat de klant naar jou stuurt' bij WhatsApp, 'zelf in te stellen; wij sturen niets' bij het afwezigheidsbericht.
- Vermelding op exports ('gemaakt op startec', `config.credit`) is opt-in en staat standaard uit.

## 10. Gereedschap en controle

- `src/data/woordenlijst.json`: de regels, per stem en per scope, met een `note` die in de lintfout verschijnt.
- `node scripts/qa/lint-copy.mjs` (in `npm run lint`): bronnen, front matter en attributen; faalt de build bij een fout.
  `npm run lint:selftest` bewijst dat de fixture op precies drie redenen faalt en dat de uitzonderingen werken.
- `npm run qa`: dezelfde regels op de gerenderde tekst, dus ook op wat JavaScript schrijft (sim-dag-data, preview-data,
  sim-radar-data, de proeven).
- `node scripts/qa/copy-check.mjs [--shots]`: meet cyaan tekst op één regel, zoekt 'jullie' buiten de toegestane stemmen,
  telt de leus per pagina, controleert euroteken, 'AI-systemen', 'automatisering voor', 'ons team', 'een medewerker',
  'Snymis' per kamerpagina en og.png (1200x630, onder 300 kB); `--shots` schrijft de schermafbeeldingen voor de
  oprichter naar `.qa/shots/`.
- Eén leesbeurt door Snymis voor elke release; wat hij schrapt, komt als regel terug in dit bestand.

## 11. Snel nalezen voor een commit

1. Zegt elke zin iets wat vandaag waar is en waar de grondwaarheid het staaft?
2. Noemt elke verzonnen zaak, elk verzonnen cijfer en elk gescript antwoord zichzelf zo, in de zin?
3. Je of u, consequent per sectie? 'Jullie' alleen in bezoekers- of klantenstem?
4. Geen prijs, teller, haast, garantie, 'Verzonden', Engels jargon?
5. Staat Snymis erin als de mens die leest, en 'wij' alleen waar het hem en zijn agents betekent?
6. `npm run lint`, `npm run lint:selftest`, `node scripts/qa/copy-check.mjs`, daarna `npm run qa`.
