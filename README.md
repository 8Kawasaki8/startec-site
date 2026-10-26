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

Renderstaten: `vlucht` (volle snelheid tijdens een vlucht of de intro), `settle` (600 ms na het landen), `rust` (nul frames op elk profiel). Een nieuwe bordtekst, sectorkleur of resize tekent één frame; parallax met de muis (alleen desktop) wekt de lus maximaal 400 ms. De lus stopt ook wanneer `STSScene.cover(f)` boven 0,6 komt, het canvas buiten beeld is of het tabblad verborgen is.

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
