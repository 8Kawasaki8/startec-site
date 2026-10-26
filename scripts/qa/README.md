# QA-harnas voor Star.Tec.Solutions

Headless kwaliteitspoort voor de statische site in `docs/`. Draait op elke machine met alleen
`node` (20 of hoger), `npm` en `python3`. Geen andere afhankelijkheden dan Playwright.

## De vijf opdrachten (verse Ubuntu-container)

```sh
npm ci
npx playwright install --with-deps chromium
npm run build
npm run qa
npm run lint
```

`npm run qa` eindigt met `QA GROEN` en schrijft `.qa/report.json` (genegeerd door git) en
`docs/qa-report.html` (gecommit, statisch, zonder externe bronnen). Exitcode 1 bij een fout.

Kan Chromium niet gedownload worden (afgesloten netwerk), wijs `PLAYWRIGHT_BROWSERS_PATH`
naar een bestaande Playwright-installatie met dezelfde Chromium-revisie als de vastgezette
Playwright-versie in `package.json`. De harnas meldt het ontbrekende pad zelf.

## npm-scripts

| script | doet |
| --- | --- |
| `npm run build` | `python3 scripts/build.py --base https://8kawasaki8.github.io/startec-site/` |
| `npm run serve` | `python3 -m http.server 8899 -d docs` voor handmatig kijken |
| `npm run qa` | volledige matrix (zie onder), statische lints inbegrepen |
| `npm run qa:quick` | index.html en dev/scene.html, desktop en telefoon, modus `gl`; voor tijdens het bouwen |
| `npm run lint` | `lint-css` en `lint-copy` op de bronnen |
| `npm run lint:selftest` | bewijst dat `lint-copy` de kapotte fixture afkeurt om precies drie redenen |
| `npm run lines` | elk bestand onder `src/`, `scripts/` en `docs/assets/{css,js}` blijft onder 500 regels |
| `npm run report` | schrijft `docs/qa-report.html` opnieuw uit het bestaande `.qa/report.json` |
| `npm run audit` | `lines`, `lint` en `qa` na elkaar |
| `npm run perf:css` | WP-16: `css-dead.mjs`, selectors die op geen gebouwde pagina iets raken (exit 1 bij een dode) |
| `npm run perf:img` | WP-16: `scripts/img-shrink.py --check`, og.png onder 150 kB en elke straatfoto onder 60 kB |
| `npm run perf:selftest` | bewijst dat `checkAssets` (perf.mjs) een preload van een onbestaand lettertypebestand afkeurt |
| `node scripts/qa/a11y.mjs` | WP-19: de toegankelijkheidscontrole los van de matrix (`--pages`, `--profile desktop,phone`, `--port`, `--verbose`) |

Opties van `scripts/qa/qa.mjs`: `--pages a.html,b.html`, `--profile phone|desktop|tablet`,
`--mode gl|gl-swift|nogl`, `--variant default|reduced|lite|intro`, `--shots` (schermafbeeldingen in `.qa/`),
`--no-lint`, `--no-a11y` (slaat de toegankelijkheidscontrole over tijdens het bouwen), `--port 8765`, `--out .qa`, `--report-only`. Elke selectie markeert het rapport als `partial`;
`prepush.sh` weigert zo'n rapport net als een quick-run.

## Modi, profielen, varianten

Drie manieren om Chromium te starten (`profiles.mjs`):

- `gl`: headless standaard, ANGLE op SwiftShader, gestart met `--enable-unsafe-swiftshader` zodat WebGL bestaat.
- `gl-swift`: expliciet `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
- `nogl`: `--disable-3d-apis`; de site moet `#scene-fallback` tonen en zonder fouten werken.

Drie profielen: `phone` 390x844 (grove aanwijzer, `hardwareConcurrency` 4, DPR 2), `desktop` 1440x900
(fijne aanwijzer), `tablet` 1024x1366 (grove aanwijzer). In elk profiel staat `sessionStorage.sts-pre = 1`
voor de pagina laadt, dus de intro speelt niet. Varianten: `default`, `reduced` (prefers-reduced-motion),
`lite` (`?lite`) en `intro` (geen `sts-pre`: de intro speelt; alleen index.html op desktop en telefoon, ook in
`qa:quick`). De intro-run eist `sts:intro-done` binnen 1600 ms na het eerste scene-event, daarna geen
`#intro` meer en `sts-pre` geschreven; dezelfde run herlaadt daarna de pagina met de scene-module geblokkeerd
(`dead-module`): binnen 1 s geen `#intro`, `#scene-fallback` zichtbaar, `sts:scene-failed` en een zichtbare H1.

Gesnoeide matrix (`buildMatrix`): elke pagina x drie profielen in `gl`; `reduced` op telefoon voor elke
pagina en op desktop voor de scenepagina's; `lite` op desktop en telefoon voor index, dev/scene, simulatie
en de wijkpagina's; `gl-swift` en `nogl` alleen op index.html, dev/scene.html, simulatie.html en de eerste
wijkpagina. Pagina's die nog niet bestaan worden als notitie gemeld, niet als fout.

## Wat per run gemeten wordt

Elke run (pagina x profiel x modus x variant) levert een record in `.qa/report.json` met onder meer
`rafCount` (requestAnimationFrame-callbacks in 3 s rust na de scrollpas), `timerCount` (setInterval en
setTimeout via omwikkelde tellers), `externalRequests`, `consoleErrors`, `overflow`, `forbiddenText`,
`storageKeys`, `animations` (lopende en gedeclareerde transitions op filter, backdrop-filter, box-shadow,
background-position, 2 s na laden), `bytes` (ruw en gzip-equivalent voor JS), `scene` (eerste
`sts:scene-ready` / `sts:scene-failed` met tijdstip, zichtbaarheid van `#scene-fallback`), `webgl`
(`canvas.getContext('webgl2')`), `firstViewport` en `conversion`.

Harde poorten op elke pagina: nul consolefouten, nul verzoeken naar een andere host dan 127.0.0.1
(elk verzoektype, ook module-imports, fetch en navigaties; verwijzingen in de opmaak tellen ook), geen
horizontale overflow, `lang` begint met `nl`, precies een `h1`, geen emoji, geen `undefined`/`NaN` in tekst.
`404.html` draagt een `<base>` naar de Pages-host; de harnas beantwoordt die verzoeken lokaal.

Bijzonderheden:

- Opslag: `sessionStorage` binnen `{sts-pre, sts-zaak}` en `localStorage` binnen `{sts-lite}`; `docs/demo` is vrijgesteld.
- Woordenlijst: `src/data/woordenlijst.json` is sinds WP-12 de enige bron (`woorden.mjs` laadt ze; uitleg in
  `copy-regels.md`). In STS-stem verboden: euroteken, 'euro' buiten de juridische pagina's, prijsankers, 'gegarandeerd',
  schaarste en urgentie, tellers, een 'Verzonden'-staat, 'ons team', 'een medewerker', nl-NL-woorden (mobieltje, leuk,
  hartstikke, KvK, iDEAL), Engels marketingjargon (leads, funnel, conversie, smart, boost, KPI), 'AI-powered', 'slim',
  'AI-systemen' en 'automatisering' buiten de juridische pagina's, 'jullie'. Vrijgesteld: tekst in `[data-voice=visitor]`,
  `[data-voice=customer]` en FAQ-vragen in `<details><summary>`. In `[data-sim]` verboden: 'studie', 'onderzoek toont',
  'rapport', 'statistiek'; verplicht: 'gesimuleerd' of 'fictief', en per kamer de woorden uit `sim.perRoom` (lint-copy,
  sleutel = `data-proef-bron`, het id of de bestandsnaam van de kamer). Vijf gevulde sterren alleen met 'voorbeeld' in
  hetzelfde blok.
  `docs/demo` is vrijgesteld van prijs-, sterren- en opslagscans, niet van de externe-verzoekwacht.
- Wijkpagina's (`docs/wijk/*.html`, WP-13): de regels met `scope: 'wijk'` (gezellig, bruisend, authentiek, levendig en
  tellers als 'N zaken') gelden alleen daar en nooit binnen `[data-sfeerzin]`, de ene zin van de oprichter; `lint-copy`
  en de gerenderde scan (`checks.mjs`, `cfg.wijk`) passen dezelfde uitzondering toe.
- Conversiecontract: de harnas klikt elk `[data-bericht]` met een proefzaak in `sessionStorage.sts-zaak`
  (`{naam:'Proefzaak QA', ...}`) en controleert dat het Bericht-tekstvak de zaaknaam en de sleutelzin
  (`STSBericht.phrase(key)`) bevat (`window.STSBericht.prefill` bestaat sinds WP-02).
- Eerste scherm: `budget.firstViewportWords` (voor index.html: 'onderzoek', 'verkenner', 'Snymis') moet zichtbaar
  zijn zonder scrollen. De helper `firstViewport(words)` in `checks.mjs` is herbruikbaar.
- Dock (`dock`, telefoon): minstens vier van de vijf deuren volledig in beeld (drie op een pagina met een eigen
  deur, die dan zelf in beeld staat met `aria-current=page`), elke deur minstens 44x44 px, de actie in beeld.
- Lange naam (`long-name`, telefoon, index.html): `?zaak=Kinesitherapiepraktijk Vanderstraeten` geeft geen
  horizontale overflow, `#sign-dom` binnen de viewport, geen woord gebroken over de twee regels en `#sign-sr`
  gelijk aan 'Uithangbord: ' + de naam.

## Fout, bekend, notitie

`budget.mjs` deelt elke bevinding in. `fail` blokkeert. `known` is een bevinding van de huidige site die
een genoemd werkpakket oplost (lijst `KNOWN`): alleen nog de strenge regellimieten (WP-15); de regel voor het
gewicht van de oude demos.html verviel met de redirect-stub van WP-09. `checkDataFiles` (checks.mjs) toetst
`src/data/panden.json`, `capabilities.json` en `radar-bericht.json` aan een klein schema, naast de fixtures. De WP-04-regels (style.css, backdrop-filter, de rAF-lus van motion.js, timers, het
gewicht en de overflow van de oude index, 'Data & leads', het eerste scherm), de WP-02-regel (de conversiecheck
zonder STSBericht) en de WP-11-regel ('jullie' in de FAQ-vraag, nu `<details><summary>`) zijn met die pakketten
verwijderd: die controles falen nu echt. Een bekende bevinding houdt het rapport groen maar staat in het rapport met zijn
werkpakket. Zodra de oorzaak weg is vervalt de regel en wordt dezelfde bevinding een fout. Poorten in `budget.gates` (rAF-rust, timers, bytes,
eerste scherm, backdrop-filter, strikte regellimieten) staan uit tot `scripts/qa/budget.json` ze aanzet (WP-15).

## Statische lints

- `lint-css.mjs`: transition of `@keyframes` op filter, backdrop-filter, box-shadow, background-position;
  `transition: all`; `filter: url(#...)` op DOM; paginabrede `mix-blend-mode`; `will-change` buiten
  transform/opacity; `backdrop-filter` in niet-juridische CSS (bekend tot WP-04). Vendor en `docs/demo` niet.
- `lint-copy.mjs`: de woordenlijst op `src/pages`, `src/partials`, `src/rooms`, `docs/wijk`, `docs/dev`,
  inclusief front matter (title, description) en attributen (alt, placeholder, aria-label, title).
  `--selftest` draait op `fixtures/broken.html` en eist precies drie fouten: prijs, sterren, 'jullie';
  de regel met `data-voice="visitor"` en de FAQ-`summary` mogen niet aanslaan.
- `lint-lines.mjs`: maximaal 499 regels per bestand; `--strict` dwingt ook scene < 300 en CSS < 400 af.
  `scripts/workflows` (plan-data) en vendor-mappen tellen niet mee.

## Publicatiewacht (opt-in)

`docs/` is wat GitHub Pages serveert. Golven bouwen op de tak `v5`; `docs/` op `main` blijft bevroren tot
WP-15. De pre-push-hook `scripts/qa/prepush.sh` weigert een push die `docs/` wijzigt op de Pages-tak
tenzij `.qa/report.json` groen is, uit een volledige run komt, bij de gepushte commit hoort en niet op een werkmap
met wijzigingen is gemaakt (`dirty`). `docs/qa-report.html` telt daarbij niet mee: dat bestand wordt door dezelfde
`npm run qa` geschreven en komt dus altijd één commit na de release die het beschrijft. Volgorde: commit `src/`,
`scripts/` en `docs/` -> `npm run qa` op die commit -> `scripts/qa/prepush.sh --check` -> push -> commit
`docs/qa-report.html` (en de op de schone boom opnieuw gemeten `scripts/qa/budget.json`) als vervolgcommit.

```sh
git config core.hooksPath scripts/qa/hooks      # aanzetten in deze kloon
git config sts.pagesBranch main                 # standaard: main
scripts/qa/prepush.sh --check                   # droge test van het huidige rapport
STS_RELEASE=1 git push origin main              # pas bij WP-15, na een groen volledig rapport
```

De hook test met `python3` en `git diff`; hij raakt de werkmap niet aan.

## Rapport

`docs/qa-report.html` wordt uit `.qa/report.json` gerenderd (`report.mjs`): status, bekende punten met
werkpakket, de matrix met laadtijd, rAF, intervals, scene-event, WebGL, externe verzoeken, consolefouten,
overflow en bytes, per run de bevindingen, en de sectie Toegankelijkheid (WP-19, per pagina x profiel). De kopregel
zegt het wanneer het rapport op een werkmap met wijzigingen is gemaakt. De pagina draagt `data-voice="qa"` zodat de woordenlijst
de geciteerde bevindingen niet als sitecopy leest, en `noindex`.

## Bestanden

```
scripts/qa/qa.mjs          orkestratie: server, browsers, matrix, rapport, exitcode
scripts/qa/runner.mjs      een run: context, routes, metingen, classificatie
scripts/qa/checks.mjs      init-script en page.evaluate-functies
scripts/qa/profiles.mjs    GL-modi, profielen, varianten, matrix, toegestane hosts en sleutels
scripts/qa/budget.mjs      budgetten, poorten, KNOWN-lijst, classify()
scripts/qa/woorden.mjs     laadt src/data/woordenlijst.json (WP-12) en scanText()
scripts/qa/copy-check.mjs  WP-12: leus-telling, euroteken, 'AI-systemen', persona, og.png, cyaan op één regel en de 'jullie'-scope op de gebouwde site; `--shots` schrijft schermafbeeldingen naar .qa/shots/
scripts/qa/html-lite.mjs   kleine HTML-parser voor lint-copy
scripts/qa/lint-css.mjs    lint-copy.mjs  lint-lines.mjs
scripts/qa/report.mjs      docs/qa-report.html
scripts/qa/prepush.sh      publicatiewacht; scripts/qa/hooks/pre-push is de wrapper voor core.hooksPath
scripts/qa/fixtures/broken.html  opzettelijk foute pagina voor de zelftest
scripts/qa/fixtures/sign.json    wrapSign: twee regels, nooit een woord gebroken (fixtures.mjs, checkSignFixtures)
scripts/qa/sim-check.mjs   WP-07: herrekent elke bevinding, callout, logregel en wat-als-teller van de Doorlichting uit de arrays (sim-data.js, sim-data-2.js, sim-whatif.js); `node scripts/qa/sim-check.mjs`
scripts/qa/perf.mjs        WP-16: verzoeken, ruwe JS, lettertypen, H1-verschuiving, CLS en H1-tijd per run; checkAssets (og.png, straatfoto's, preloads)
scripts/qa/css-dead.mjs    WP-16: dode selectors in docs/assets/css tegen elke gebouwde pagina (Chromium); ALLOW met reden
scripts/qa/a11y.mjs        WP-19: toegankelijkheidscontrole na de matrix (Tab-doorloop, dialoog, zoom, minder beweging); ook los te draaien
scripts/qa/a11y-dom.mjs    WP-19: de page.evaluate-helft: contrast, namen, koppen, landmarks, formulieren, live-gebieden, taal
scripts/img-shrink.py      WP-16: og.png naar 256 kleuren, straatfoto's naar de hoogste kwaliteit onder 56 kB (Pillow)
```

## Herziening golf 1: extra poorten

- `raf-scene` (nooit 'bekend'): `STSScene.debug.frames` mag in 3 s rust niet stijgen op desktop en tablet;
  op de telefoon moet `STSScene.lite` waar zijn en blijft de teller 0. De `raf`-check (window.__rafCount)
  blijft apart en is tot WP-04 bekend voor de gsap-ticker van motion.js op pagina's met de oude UI.
- `fallback-resize`: op de telefoon mag een 100 px lagere viewport (de werkbalk) `#landmark-bord` niet
  verplaatsen of herschalen.
- Overflow meet tegen `documentElement.clientWidth`/`visualViewport.width`, niet `innerWidth` (dat groeit
  onder telefoonemulatie mee met de inhoud); kinderen van een inline `<svg>` tellen niet mee.
- Bytes worden alleen voor de eerste lading geteld (de conversiecheck herlaadt de pagina per sleutel).
- `fixtures.mjs`: names.json en prefill.json tegen names.js en contact-prefill.js, in node; sign.json tegen signdom.js.
- Bekende punten zijn gebonden aan het bestand of de pagina die ze beschrijven (style.css, index.html,
  pagina's met motion.js); nieuwe CSS of een nieuwe lus valt er niet onder.

## WP-15: gemeten budget, poorten aan

- `scripts/qa/budget.json` bestaat nu en komt uit `node scripts/qa/budget.mjs --measure [--report .qa/report.json] [--dry-run]`:
  per pagina x profiel x variant het grootste ruwe gewicht en de gzip-equivalente JS over de GL-modi, per pagina x profiel
  de draw calls van de gl/default-run (`STSScene.debug.info().calls`, het laatste getekende frame). Plafond = meting + 10 %
  (bytes) of + 20 % (draw calls), nooit boven `phoneRawBytesMax` (450 kB) en `jsGzipLiteMax` (90 kB). Het bestand draagt
  `measuredOn` (commit), `measuredAt`, `workingTreeDirty` en zet elke poort aan. Meten kan alleen uit een volledige groene run.
- Bewaakt per pagina: telefoon ruw (elke modus en variant), lite ruw en lite JS (elk profiel), draw calls op desktop en
  tablet. Gemeld, niet bewaakt: desktop en tablet mét Three.js, lange taken (`STSScene.debug.longTasks`); `qa-report.html`
  (`UNGATED_PAGES`) wordt nooit op gewicht beoordeeld. Een pagina zonder meting krijgt een notitie en alleen de harde grenzen.
- Nieuwe poorten: `calls` en `nogl` (zonder WebGL moeten `#scene-fallback` zichtbaar zijn, de SVG-skyline afmetingen hebben
  en `#sign-dom` `is-placed` dragen). `sceneState` (checks.mjs) levert `calls`, `longTasks`, `skyline`, `signPlaced` en `route`.
- De `KNOWN`-lijst is leeg: de strikte regellimieten zijn een poort (`lineLimitsStrict`). Een nieuw bekend punt vraagt een werkpakket.
- `--shots` schrijft nu een set per pagina voor `gl` én `gl-swift` (desktop en telefoon) naar `.qa/shots/`; het rapport
  (`docs/qa-report.html`) toont de lijst, de sectie Budget, en de kolommen JS gzip, calls en lange taken in de matrix.
- Een bewuste budgetbreuk testen: zet tijdelijk een bestand van 600 kB in `docs/assets/` en verwijs ernaar vanuit
  `docs/index.html`; `node scripts/qa/qa.mjs --pages index.html --profile phone --mode gl --variant default --no-lint`
  moet rood zijn op `bytes`. Bouw daarna opnieuw (`npm run build`), de bron blijft ongemoeid.

## WP-16: prestaties gemeten, dan gesnoeid

Meten eerst (`perf.mjs`, per run in `.qa/report.json` onder `perf`), dan de poorten in `budget.json`:

- `requests` en `jsRaw`: het aantal verzoeken en de ruwe scriptbytes van de eerste lading, per pagina x profiel x variant;
  plafond = meting + 10 % op telefoon en in lite (zoals de ruwe bytes van WP-15). Een regressie van 20 % valt dus.
- `three`: op telefoon en in lite wordt `three.module` of een `three-addons`-bestand nooit opgevraagd.
- `font`: elk opgevraagd lettertypebestand is door tekst gebruikt (`document.fonts`-status `loaded`); een preload die niemand
  nodig heeft of een `@font-face` zonder regel die ernaar vraagt, is rood. Op 404.html (fonts.css via `<base>` van de
  Pages-host, dus onleesbare regels) wordt het bestand op naam aan de face gekoppeld.
- `cls`: de H1 staat na de rust nog waar ze in haar eerste frame stond (offsetbox, transforms tellen niet; `h1ShiftMaxPx` 1)
  en de som van de `layout-shift`-entries zonder invoer blijft bij de eerste lading onder `clsMax` 0,1 (`clsLoad`, vastgelegd
  voor de scrollpas; de waarde over de hele run staat ernaast als `cls`). Gemeten: 0 px op elke run, `clsLoad` hoogstens
  0,0005. Over de hele run meet werkwijze.html op de telefoon 0,26: de radar-replay opent haar stappen (`li.rs-stap`) zodra
  de kamer in beeld komt en duwt de knoppen eronder weg; dat is de bedoelde animatie van WP-09, geen laadfout, maar wie
  die kamer herziet kan de stappen hun eindhoogte geven voor ze openen.
- `h1-paint`: het eerste frame waarin de H1 breedte heeft (rAF-peiling vanuit het initscript) blijft onder `h1PaintMaxMs`
  1000 op telefoon en in lite; een vaste grens, want de tijdmeting onder SwiftShader schommelt meer dan 10 %. Desktop en
  tablet worden gemeld (kolommen `H1 ms`, `H1 px`, `CLS`, `verzoeken` in `docs/qa-report.html`), net als `fcp` en `lcp`.
- `assets` (statisch, bij de lints): `og.png` onder 150 kB, elke `docs/assets/img/straat/*.jpg` onder 60 kB en 800x500,
  elke `<link rel=preload>` naar `assets/fonts/` in een gebouwde pagina (`docs/**/*.html` buiten `demo/`, dus
  `PRELOAD_DEFAULT` én de front matter `preload:`) bestaat op schijf, en elk bestand in `docs/assets/fonts` wordt door
  minstens één stylesheet of pagina onder `docs/` genoemd (geen dode lettertypen). `npm run perf:selftest` bewijst dat
  een valse preload precies één fout geeft; `node scripts/qa/perf.mjs` draait de controle los.
- Ongewijzigd: rAF-rust 0, `setInterval` 0 (geen enkele STS-pagina maakt er een aan), hoogstens 2 hangende `setTimeout`
  (index.html houdt er één: de burenterugval van 4 s in gevel.js, bewust).

Gemeten op commit `c48bc9a5fd` (volledige groene run van 138 runs, `node scripts/qa/budget.mjs --measure`; 201 poorten). Per pagina de telefoon (gl, default): ruw gewicht van de eerste lading en zijn plafond (+10 %), verzoeken, JS ruw en gzip-equivalent, het eerste frame met de H1 (SwiftShader, gemeld), en ter vergelijking het desktopgewicht met Three.js (gemeld, niet bewaakt). Voor WP-16 woog index.html op de telefoon 412 kB ruw in 32 verzoeken; nu 374 kB in 30 (drie lettertypebestanden minder, vier dode CSS-regels weg).

| pagina | telefoon ruw | plafond | verzoeken | JS ruw | JS gzip | H1 eerste frame | desktop met Three.js |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 404.html | 181 kB | 199 kB | 17 | 39 kB | 16 kB | 97 ms | 181 kB |
| cookies.html | 163 kB | 179 kB | 15 | 38 kB | 15 kB | 71 ms | 182 kB |
| demos.html | 354 kB | 389 kB | 32 | 95 kB | 38 kB | 131 ms | 354 kB |
| dev/bericht.html | 190 kB | 209 kB | 17 | 45 kB | 18 kB | 55 ms | 190 kB |
| dev/scene.html | 286 kB | 314 kB | 20 | 123 kB | 49 kB | 79 ms | 1029 kB |
| gereedschap.html | 310 kB | 341 kB | 31 | 117 kB | 47 kB | 118 ms | 310 kB |
| index.html | 374 kB | 411 kB | 30 | 180 kB | 70 kB | 112 ms | 1117 kB |
| juridisch.html | 164 kB | 180 kB | 15 | 38 kB | 15 kB | 71 ms | 183 kB |
| privacy.html | 186 kB | 205 kB | 16 | 38 kB | 15 kB | 72 ms | 186 kB |
| qa-report.html | 31 kB | 34 kB | 1 | 0 kB | 0 kB | 38 ms | 31 kB |
| simulatie.html | 359 kB | 395 kB | 27 | 179 kB | 67 kB | 83 ms | 359 kB |
| voorwaarden.html | 168 kB | 185 kB | 15 | 38 kB | 15 kB | 65 ms | 187 kB |
| werkwijze.html | 354 kB | 389 kB | 32 | 95 kB | 38 kB | 96 ms | 354 kB |
| wijk/berchem.html | 185 kB | 203 kB | 18 | 39 kB | 16 kB | 65 ms | 185 kB |
| wijk/borgerhout.html | 185 kB | 203 kB | 18 | 39 kB | 16 kB | 67 ms | 185 kB |
| wijk/deurne.html | 184 kB | 203 kB | 18 | 39 kB | 16 kB | 70 ms | 184 kB |
| wijk/hoboken.html | 184 kB | 203 kB | 18 | 39 kB | 16 kB | 61 ms | 184 kB |
| wijk/merksem.html | 184 kB | 203 kB | 18 | 39 kB | 16 kB | 63 ms | 184 kB |
| wijk/mortsel.html | 185 kB | 203 kB | 18 | 39 kB | 16 kB | 60 ms | 185 kB |
| wijk/wilrijk.html | 185 kB | 203 kB | 18 | 39 kB | 16 kB | 63 ms | 185 kB |

Bevinding bij de eerste lading (gemeld, onder de poort): simulatie.html meet `clsLoad` 0,033 op desktop en 0,088 op de tablet, één verschuiving rond 100 ms na het laden waarin sim.js de kamer opbouwt (`#room`, `.fasenbord-fasen`, `#sim-context`, een label); wie WP-07 herziet geeft die blokken hun eindhoogte in sim.css. Alle andere pagina's blijven onder 0,001.

Laadvolgorde: fonts.css, base.css, uithangbord.css en de paginastijlen blokkeren het renderen bewust (kritieke CSS eerst,
geen flits van ongestileerde tekst); daarvoor staan de preloads van de eerste viewport (front matter `preload:`, standaard
`PRELOAD_DEFAULT` in build.py: Panchang 700 voor het bord en de juridische H1's, Panchang 600 voor de aankomst-H1 en de
h2's, Switzer 400 voor de lopende tekst, en sinds de fixronde van golf 4 ook JetBrains Mono 400: op de telefoon zijn de
zes doklabels de enige tekst van het eerste scherm in die face en elke STS-pagina vraagt het bestand op elk profiel
toch op, dus de preload kost geen byte en geen verzoek extra; dev/scene.html laat Panchang 600 weg omdat geen tekst
daar die face gebruikt).
Elk script staat achter alle inhoud onderaan de body, zonder `defer`: defer zou de scripts tot na het parsen uitstellen,
terwijl de scènemodule (door de inline lader ingevoegd, async) dan al kan starten voor gsap bestaat. Three.js komt alleen
via die lader op de GL-route; de poort `three` bewijst dat de telefoon en lite het nooit vragen.

Lettertypen: drie bestanden minder per pagina zonder nieuwe bestanden. Panchang 600 bedient ook gewicht 500 (`.foot .motto`,
`.gevel-zin`), Switzer 400 ook gewicht 500 (kleine labels, legenda's, de naamchip: nu regular), JetBrains Mono 400 en 500 waren
hetzelfde bestand en staan één keer als 400-500. De 500-bestanden van Panchang en Switzer zijn verwijderd (fixronde golf 4;
`checkAssets` faalt voortaan op een lettertypebestand dat niets noemt); Unbounded laadt enkel nog in docs/demo/radar. Elke familie heeft een metrisch gelijk lokaal terugvalfont (fonts.css: `size-adjust`, `ascent-override`,
`descent-override`, `line-gap-override`, gemeten met canvas tegen Liberation Sans = Arial en Liberation Mono = Courier New:
Panchang 162 %/60 %/16 %/5,6 %, Switzer 100,7 %/97,3 %/24,8 %/8,9 %, mono 100 %/102 %/30 %/0 %), zodat de wissel van
`font-display: swap` geen regel verschuift; base.css noemt ze direct na het webfont.

Afbeeldingen (`python3 scripts/img-shrink.py`, `--check` in `npm run perf:img`): og.png van 169 kB naar 60 kB als 8-bits palet
(256 kleuren, Floyd-Steinberg); barbier-boris.jpg van 69 kB naar 56 kB (progressief, kwaliteit 46), de twee andere straatfoto's
zaten al onder 56 kB. De foto's blijven 800x500: de grootste weergave is 996 CSS-px op desktop (DPR 1) en 869 CSS-px op de
tablet (DPR 2), en een bron op 2x DPR past niet onder 60 kB; `width`, `height`, `loading="lazy"` en `decoding="async"` zet
builddata.py. Op de telefoon laadt alleen de eerste foto (315x196); de andere twee pas bij het schuiven.

Dode CSS (`npm run perf:css`): `css-dead.mjs` splitst elke selector van docs/assets/css op komma's, haalt pseudo-elementen en
staatpseudoklassen weg en test de rest met `document.querySelector` op elke gebouwde STS-pagina (desktop en telefoon, na een
scrollpas). Wat nergens raakt is 'dynamisch' als elke klasse, id of attribuut ergens in een script, bron, bouwscript of inline
SVG voorkomt (ook `dataset.fooBar` en samengestelde namen zoals `'mk-' + uit`), anders 'dood'. Resultaat: 1063 selectors in
12 bestanden tegen 20 pagina's, 4 dode verwijderd (`video` in de reset, `.solid`, `.legal ol`, `.legal .note`), 176 dynamische
(`--all` toont ze), 2 regels in `ALLOW` met reden (`html.js [data-reveal]`: het gedocumenteerde attribuut naast `.rv`).

Rustcontract van de scène, nagemeten met Playwright (desktop 1440x900 en tablet 1024x1366): 0 frames in 3 s rust, 0 frames bij
een vlucht met `STSScene.cover(1)`, 0 frames bij een vlucht met `document.hidden`, 13 tot 16 frames bij een zichtbare vlucht en
daarna weer 0. De bevinding van toen (elke `cover()` onder 0,6 riep `wake(0)`, vijf gelijke waarden kostten 9 frames) is in de
fixronde van golf 4 opgelost: `cover()` wekt alleen bij de overgang van boven naar onder 0,6 (nagemeten: 1 frame voor de
overgang, 0 voor de vier gelijke waarden erna).

Opnieuw meten na een bewuste wijziging: `npm run build && npm run qa && node scripts/qa/budget.mjs --measure`, dan `npm run qa`
nog eens met de nieuwe plafonds en `scripts/qa/budget.json` mee committen.

## WP-19: toegankelijkheid (WCAG 2.1 AA), eigen controle

`@axe-core/playwright` is hier niet offline te installeren; `scripts/qa/a11y.mjs` en `a11y-dom.mjs` doen het werk zelf. De pas
draait na de matrix in `npm run qa` (elke STS-pagina op desktop 1440x900 en telefoon 390x844, modus `gl`, `sts-pre` gezet) en
staat in `.qa/report.json` onder `a11y` (per pagina x profiel de bevindingen, de koppenlijst, de Tab-telling, de dialoogtest,
de zoommeting). Alleen **contrast** en een **ontbrekende toegankelijke naam** zijn een fout (`summary.a11yFails`, exit 1);
al het andere is een notitie (`summary.a11yNotices`), zichtbaar met `--verbose`. Demosites (`docs/demo`), `demos.html`
(doorverwijzing) en `qa-report.html` worden overgeslagen met een notitie.

Per pagina x profiel, na een scrollpas zodat ook onthulde tekst meetelt:

- `contrast`: elke zichtbare tekstknoop (TreeWalker) tegen het vlak erachter: de achtergrondkleuren van de voorouders van boven
  naar beneden samengesteld over `html`, de tekstkleur met haar alfa en de opacity van de keten erover. 4,5:1, of 3:1 voor grote
  tekst (24 px, of 18,66 px vet). Niet gemeten: `.sr`, `#sign-dom` (staat op de stad), tekst in een afbeelding
  (`svg[role=img]`, `[aria-hidden]`-svg: de oude gevel in De straat is bewust onleesbaar), symbolen zonder letters (de sterren),
  uitgeschakelde knoppen, en gedimde tekst onder een overlay (`elementFromPoint`, de grafiek achter 'Standby'). Een verloop in de
  keten staat als 'geschat' in de tekst. Gemeten en gefixt: `--ink3` van .44 naar .58 (4,1:1 werd 6,4:1 op bg, 6,0:1 op glas;
  base.css, append-blok), de standby-tekst van de Doorlichting stond door een specificiteitsfout op 30 % (1,4:1; sim.css).
- `name`: `a[href]`, `button`, velden, `summary`, `img`, `svg[role=img]`, `canvas[role=img]` zonder naam (aria-labelledby,
  aria-label, label, inhoud, alt, title; alleen een placeholder is een notitie). Focusbare inhoud in `aria-hidden` is een notitie.
- `headings`: precies één zichtbare h1, geen sprong van meer dan één niveau, geen lege kop. `landmarks`: één `main`, `header`,
  `footer`, `nav` met naam, de skip-link naar een bestaand `#main`, elke kamer (`section[data-room]`) met `aria-labelledby`
  (build.py zet dat zodra de kop van de kamer `id="<kamer>-titel"` draagt). `forms`: `aria-describedby` naar bestaande id's,
  `fieldset` met gevulde `legend`, de honeypot in `aria-hidden` met tabindex -1, `#form-err` als `role=alert`. `live`: geen
  `assertive` buiten `role=alert`, hoogstens twaalf live-gebieden. `sim`: `#scene`, `#scene-fallback` en `#sign-dom`
  aria-hidden, `#sign-sr` polite, grafieken in `[data-sim]` met role=img of aria-hidden naast een lijst, groepsknoppen met
  `aria-pressed`. `lang`: `html[lang=nl-BE]`, Engels buiten `lang=en` (de leus in de voet).
- `keyboard` en `focus`: een echte Tab-doorloop (`page.keyboard.press`) tot de focus de pagina verlaat; elk tabbaar element
  (radio's één per groep, gesloten `details` niet) moet bereikt zijn, met een ring (outline, of een box-shadow- of randwissel
  tegenover de ruststand; bij een onzichtbare radio telt de chip-span) en `:focus-visible`; een lus of meer dan 900 keer Tab is
  een val. Tijdvelden houden de focus over hun segmenten; dat telt niet als val.
- `dialog`: klik op de naamchip, dan: `role=dialog`, `aria-modal=true`, werkend `aria-labelledby`, focus in het blad, Tab vanaf
  het laatste element naar het eerste en Shift+Tab terug, Escape sluit, focus terug op de chip (uithangbord.js, focusval).
- `zoom` (desktop): de viewport naar 720x450 (1440x900 op 200 %): geen horizontale scroll, geen afgesneden tekst in blokken met
  `overflow:hidden` (scrollers en beletseltekens uitgezonderd). `motion` (desktop, aparte context met `prefers-reduced-motion`):
  geen gedeclareerde animatie of lopende WAAPI-animatie boven 200 ms.

Overige wijzigingen van WP-19: `contact.js` noemt ontbrekende velden in `#form-err` (role=alert) en zet `aria-invalid` plus
`aria-describedby=form-err` op elk veld tot het ingevuld is (focus op het eerste; base.css kleurt de rand); de voet draagt
`lang="en"` op de leus; `tools.css` geeft de uurschuiver van het Google-kaartje haar ring terug; `dev/bericht.html` heeft
`role=alert` op de fout. Klikdoelen onder 44 px op de telefoon zijn sinds de fixronde van golf 4 een fout (`targets`) op elke
STS-pagina: `checks.mjs` meet een radio of checkbox aan zijn `<label>` (de chip of de rij), slaat alles in `aria-hidden` of met
`tabindex=-1` over (de honeypot) en telt niets met opacity 0; de demosites houden de notitie. Gemeten: 0 op elke pagina.

## Fixronde golf 4 (na WP-16, WP-19, WP-21)

- Scène: een landing kost altijd precies één frame, ook terwijl de panelen meer dan 60 % dekken (`sts:landed` tekent dan één
  frame rechtstreeks; daarvoor hield het canvas de vorige landing terwijl `#sign-dom` al verplaatst was). `cover()` wekt enkel bij
  de overgang naar onder 0,6. `fontsReady` (signdom.js) onthoudt dat het laden afliep, ook zonder bestand: met een geblokkeerde
  `panchang-normal-700.woff2` tekende het bord anders elke 120 ms opnieuw (ongeveer 7 frames per seconde in rust; nu 0).
- Het bord achter een paneel: `#sign-dom` staat vast in de viewport en de kamerpanelen (.92) scrollen eroverheen; op de landing
  van telefoon, buren en bericht zat het bord achter de bovenrand van het paneel (gemeten op index.html, 1440x900 en 1920x1080,
  kamertop op het midden en 80 en 120 px erboven: de panelen sluiten op elkaar aan, er is geen stadsband waar een vast bord in
  past). `shadeSignDom` zet `is-behind` (opacity 0, 200 ms) zodra een paneel meer dan 30 % van het bord dekt, bij elke plaatsing
  en gedempt op scroll; de gloed op het canvas blijft op 8 % door het paneel zichtbaar. Geldt op beide routes. De
  `.qa/place-{telefoon,buren,bericht}-{desktop,1920}.png` zijn opnieuw genomen op index.html met de kamertop 80 px boven het
  midden (de positie na debounce en vlucht); de andere plekken staan nog op de kale scène.
- Minder beweging: de parallax-settle past de camera ook toe onder reduced motion (`onUpdate: apply`), zodat een cut zonder
  restverschuiving landt. SVG-route: `#landmark-bord` heeft een eigen donkere buis (`#1C2642`) tot er een naam staat, zoals
  sign.js; `?debug=1` toont het paneel ook op die route (`scene svg` in de eerste regel, zoals CHECKLIST-SAKI stap A zegt).
- Harnas: plafond draw calls = `floor(meting x 1,2)` (16 -> 19, niet 20); `budget.mjs --measure` schrijft op een werkmap met
  wijzigingen `workingTree` (sha1 van `git diff HEAD` plus de niet-gevolgde bestanden) naast `measuredOn` en waarschuwt;
  `report.json` draagt `dirty` en `dirtyFiles`, het rapport zegt het in de kopregel en `prepush.sh` weigert zo'n rapport; de
  `docs/qa-report.html` telt niet als release in de hook (`:(exclude)`), zie Publicatiewacht; `docs/qa-report.html` toont de
  sectie Toegankelijkheid (per pagina x profiel contrast, namen, koppen, Tab, dialoog, zoom, beweging) en de a11y-telling bovenaan.
