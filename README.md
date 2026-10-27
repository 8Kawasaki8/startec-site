# Star.Tec.Solutions — site

Statische site van STS Digital (Antwerpen). Bronnen in `src/` (pagina's, partials) en `docs/assets/`; `python3 scripts/build.py --base "https://8kawasaki8.github.io/startec-site/"` schrijft `docs/`. QA: `node scripts/qa/qa.mjs`.

## Scène: profieltabel

De inline loader in `src/partials/scene.html` kiest de route voordat er één byte Three.js wordt gevraagd. Dezelfde tabel staat in de kop van `docs/assets/js/scene.js`.

| Profiel | Test | Route |
| --- | --- | --- |
| phone | coarse pointer en breedte < 900 | geen Three.js; inline SVG-skyline (`#plattegrond`) + `#sign-dom`; nul rAF |
| tablet | coarse pointer, breedte >= 900 | Three.js, DPR 1.0, geen bloom, rust = 0 frames |
| desktop | fijne pointer | Three.js, DPR min(dpr, 1.5), bloom pas na een probe van 60 frames onder 14 ms gemiddeld (anders gewone render, geen composer), rust = 0 frames |
| lite | `?lite` of localStorage `sts-lite=1` | geen Three.js (SVG-route) |
| weak | `hardwareConcurrency <= 4` | SVG-route |
| falen | geen WebGL, modulefout, context verloren, of de tweede val van `guard()` | SVG-route met `sts:scene-failed`; `guard()` stuurt eerst `sts:scene-degraded` |

Renderstaten: `vlucht` (volle snelheid tijdens een vlucht of de intro), `settle` (600 ms na het landen), `rust` (nul frames op elk profiel). Een nieuwe bordtekst, sectorkleur of resize tekent één frame; parallax met de muis (alleen desktop, hoogstens 1 eenheid, uit tijdens een vlucht) wekt de lus maximaal 400 ms. De lus stopt ook wanneer `STSScene.cover(f)` boven 0,6 komt, het canvas buiten beeld is of het tabblad verborgen is; een landing kost ook dan precies één frame, en `cover()` wekt alleen bij de overgang terug naar onder 0,6. `#sign-dom` staat vast in de viewport en vervaagt (`is-behind`) zolang een kamerpaneel meer dan 30 % van het bord dekt; de gloed op het canvas blijft door het paneel zichtbaar.

API: `window.STSScene = { lite, profile, flyTo(id), setSign(tekst, kleur), signText(), setSector(kleur), cover(fractie), setParallax(x, y), places, intro, debug }` met `debug = { frames, longTasks, camera(), landmarkVisible, bloom, probe, state, signBox(), info() }`. `index.html?debug=1` toont die cijfers in een klein paneel; `docs/dev/scene.html` is de testpagina (niet geïndexeerd).

## Kamercontract

Een kamer is één bestand, `src/rooms/<naam>.html`, zonder front matter, met één `<h2>` en haar eigen inhoud; de bestandsnaam is haar id.
Een pagina somt kamers op in haar front matter (`rooms: gevel telefoon bericht`) en zet `{{rooms}}` op de plek waar ze moeten komen.
`scripts/build.py` plakt elke kamer in die volgorde in `<section id="<naam>" data-room>…</section>`; de id is dus ook het anker (`index.html#gevel`) en de deur in de strip.
Dezelfde kamer kan op meer dan één pagina staan: op `index.html` als sectie en, zodra een andere pagina ze opsomt, als eigen pagina met een canonieke URL; de bron blijft dat ene bestand.
Kamers laden zelf geen CSS of JS: de pagina die ze opsomt noemt die in `styles:` en `scripts:`; inhoud die data is staat in `src/data/` (JSON die de build rendert, `.js` die een pagina als script laadt); alleen die `.js` komt in `docs/assets/data/`.
`{{svg:naam}}`, `{{date}}` en `{{home}}` werken in een kamer zoals op een pagina.
Een kamer die cijfers of gesprekken verzint draagt `data-sim` en zegt in zichtbare tekst 'gesimuleerd' of 'fictief'; de zaak in die kamer heeft een verzonnen naam.
Een kamer die een gesprek wil starten linkt naar `index.html#bericht?onderwerp=<sleutel>` uit de vaste sleutellijst (WP-02).
Een kamer met een timeline of timer registreert `init`, `enter` en `leave` in `window.STS_ROOMS[id]`, zodat ze stilvalt wanneer ze uit beeld scrolt (WP-04).
Een opgesomde kamer die niet bestaat, of `rooms:` zonder `{{rooms}}`, breekt de build met een duidelijke fout.
Elke kamer linkt in de taal van de koper naar minstens twee andere kamers, en na elk simulatieresultaat staat de regel 'Ken je een collega?' met een knop `[data-share=<sleutel>]` waarvan de tekst in een databestand staat (`window.STS_DEEL`, WP-27); `scripts/qa/meta-check.mjs` en `lint-deel.mjs` bewaken dat.

## Release en QA-poort (WP-15)

`docs/` is wat GitHub Pages serveert; elke commit die `docs/` wijzigt moet releasebaar zijn. De volgorde:

```sh
npm run build                    # src/ -> docs/ met --base (canonicals, OG, sitemap, robots, <base> van 404)
npm run qa                       # volledige matrix; schrijft .qa/report.json en docs/qa-report.html
git commit src scripts docs      # de release-commit (docs/qa-report.html mag hier nog oud zijn)
npm run qa                       # nog eens, op die commit: het rapport draagt dan die hash en dirty = false
scripts/qa/prepush.sh --check    # groen, volledig, bij deze commit en niet op een werkmap met wijzigingen?
STS_RELEASE=1 git push origin main
node scripts/qa/budget.mjs --measure && npm run qa   # op de schone boom: measuredOn = de release-commit
git commit scripts/qa/budget.json docs/qa-report.html  # vervolgcommit; de hook laat een push door die in docs/ alleen het rapport wijzigt
```

De hook rekent `docs/qa-report.html` niet als release (dat bestand komt altijd één commit na de release die het beschrijft)
en weigert een rapport dat op een werkmap met wijzigingen is gemaakt (`dirty` in `.qa/report.json`).

Het prestatiebudget is gemeten, niet geschat: `scripts/qa/budget.json` komt uit `node scripts/qa/budget.mjs --measure`
op een volledige groene run en draagt de commit (`measuredOn`). Plafond = meting + 10 % voor bytes en + 20 % voor
draw calls (afgerond naar beneden: 16 gemeten geeft 19), nooit boven de harde grenzen (telefoon 450 000 bytes ruw zonder
Three.js, wat het rapport als 439 kB afdrukt omdat het per 1024 telt; 90 000 bytes JS gzip-equivalent in lite). Een meting
op een werkmap met wijzigingen krijgt naast `measuredOn` een `workingTree`-hash; de meting die telt gebeurt op de schone
boom na de release-commit (hierboven).
De statische sitechecks draaien mee in het lintblok van `npm run qa` en in `npm run lint`: `scripts/qa/links.mjs` (WP-22,
`npm run links`: elke `href`, `src`, `srcset`, `poster`, `action`, meta refresh en og:image op elke gebouwde pagina, ook
onder de `<base>` van 404.html, bestaat in `docs/` en elk `#anker` is een id op de doelpagina; een oud anker uit `LEGACY`
in uithangbord.js is een notitie) en `scripts/qa/meta-check.mjs` (WP-27: titels, beschrijvingen, OG, JSON-LD, sitemap,
kamerlinks). Een gebroken link of een gat in de sitemap maakt het rapport rood.
Bewaakt: telefoon-bytes per pagina, lite-JS per pagina, verzoeken en ruwe JS per pagina (telefoon en lite, WP-16), draw
calls na het landen op desktop en tablet, rAF-rust 0, timers, eerste scherm, backdrop-filter, regellimieten (scene < 300,
CSS < 400, alles < 500), SVG-skyline en `#sign-dom` zonder WebGL, nul externe verzoeken, nul consolefouten, nul overflow,
opslagsleutels, Three.js nooit op telefoon of lite, geen opgevraagd lettertypebestand dat geen tekst gebruikt, de H1 die
niet verschuift (CLS onder 0,1) en binnen 1 s in beeld staat op de route zonder Three.js, og.png en de straatfoto's op
gewicht en maat, elke preload op schijf en geen dood lettertypebestand, klikdoelen van minstens 44 px op de telefoon, en de
toegankelijkheidscontrole (contrast en namen zijn een fout, de rest notitie; WP-19). Gemeld en niet bewaakt: het
gewicht met Three.js en de lange taken onder SwiftShader; de echte GPU-controle is de `?debug=1`-stap in
`docs/CHECKLIST-SAKI.md`. Na een bewuste gewichtswijziging: opnieuw meten en `budget.json` mee committen.
`node scripts/qa/budget.mjs` zonder opties toont het geladen budget en de poorten.

Documenten: `CHANGELOG.md` (per golf: verwijderd, toegevoegd, gemeten, uitgesteld; golf 6 = WP-26, WP-27, WP-22),
`docs/CHECKLIST-SAKI.md` (alles wat de oprichter aanlevert of beslist, met hoofdstuk G: de stand na golf 6),
`docs/qa-report.html` (het laatste volledige rapport), `scripts/qa/README.md` (de harnas, met de kenmerkentabel van WP-26),
`scripts/workflows/HANDOFF.md` (de takken, de golven en hoe een volgende golf start).
