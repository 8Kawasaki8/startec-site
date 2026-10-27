/* Deelteksten van Gereedschap (WP-27): wat de uitbater naar een collega doorstuurt na een loket, via
   'Stuur naar een collega' ([data-share=<sleutel>], deel.js). Inhoud, geen code.

   REGELS VAN DIT BESTAND (Eerlijkheidsregels, copy-regels.md)
   - Geschreven zoals een uitbater het zelf zou doorsturen: kort, Vlaams, zonder reclametaal, geen 'jullie'.
   - Elke tekst zegt wat het is (gratis, in je browser, voorbeeldweergave, zelfinschatting) en belooft niets.
   - {site} wordt het publieke adres van de site; {score} de eigen score (alleen in 'score'; zonder score
     stuurt deel.js de tekst 'tools').
   - scripts/qa/lint-deel.mjs (in npm run lint en npm run qa) eist: elke sleutel hoort bij een knop en omgekeerd,
     korter dan 300 tekens met het adres ingevuld, geen woord uit de woordenlijst (STS-stem).
   De teksten van de simulaties staan bij hun data: sim-dag-data.js (telefoon), sim-data-2.js (doorlichting),
   sim-radar-data.js (radar), src/data/assistent-dialoog.js en lab-reviews-data.js (de twee proeven). */
window.STS_DEEL = window.STS_DEEL || {};
window.STS_DEEL.tools = "Kijk, gratis gereedschap voor je zaak: een zichtbaarheidscheck, een WhatsApp-knop met QR-code voor aan de kassa en je Google-kaartje om 19 u. Blijft in je browser: {site}gereedschap.html";
window.STS_DEEL.score = "Mijn zichtbaarheidscheck: {score} op 100 (zelfinschatting). Doe hem zelf in een minuut, het blijft in je browser: {site}gereedschap.html#zichtbaarheid";
window.STS_DEEL.whatsapp = "Ik heb net een WhatsApp-knop en een QR-code voor aan de kassa gemaakt, gratis en zonder account. Je typt je gsm-nummer en klaar: {site}gereedschap.html#whatsapp";
window.STS_DEEL.google = "Hier zie je hoe de titel en de beschrijving van je site er in Google uitzien, en waar Google afkapt. Gratis, in je browser: {site}gereedschap.html#google";
window.STS_DEEL.kaartje = "Kijk eens wat een klant om 19 u van je zaak ziet op Google: zonder profiel, zonder uren of met de juiste uren. Een voorbeeldweergave, maar je herkent het meteen: {site}gereedschap.html#kaartje-google";
window.STS_DEEL.uren = "Typ je openingsuren één keer en je krijgt je Google-kaartje, een afwezigheidsbericht voor WhatsApp en een urenblok voor je site. Gratis, blijft in je browser: {site}gereedschap.html#uren";
