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

Opties van `scripts/qa/qa.mjs`: `--pages a.html,b.html`, `--profile phone|desktop|tablet`,
`--mode gl|gl-swift|nogl`, `--variant default|reduced|lite|intro`, `--shots` (schermafbeeldingen in `.qa/`),
`--no-lint`, `--port 8765`, `--out .qa`, `--report-only`. Elke selectie markeert het rapport als `partial`;
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
tenzij `.qa/report.json` groen is, uit een volledige run komt en bij de gepushte commit hoort.

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
overflow en bytes, en per run de bevindingen. De pagina draagt `data-voice="qa"` zodat de woordenlijst
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
