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
3. **JSON-LD `areaServed` (scripts/buildlib.py).** Stond op Antwerpen, Vlaanderen, Brussel. Brussel is
   zonder grond geschrapt; terug toevoegen alleen als je er echt klanten bedient.

## Aan te leveren (config.js-plaatshouders, geen blokkering)

- KBO-nummer, adres, echte naam, zakelijk e-mailadres, domeinnaam (docs/assets/js/config.js).
- De echte eerste-contacttekst van het acquisitiebericht (nu 'voorbeeldbericht (ontwerp)').
- Of 'Kom eens langs' ergens waar mag staan (alleen als het waar is).
