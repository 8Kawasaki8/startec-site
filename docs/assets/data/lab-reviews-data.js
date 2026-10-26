/* Data for the proef 'Reviews in jouw toon' (werkwijze.html#kaart, under In onderzoek; lab-reviews.js).
   Content only; build.py copies this file to docs/assets/data/.

   RULES OF THIS FILE (Eerlijkheidsregels, WP-10)
   - Research sketch, scripted: the six replies below are PRE-WRITTEN by a person, there is no model,
     nothing is placed on Google, nothing is sent or stored. The header 'kop' says so in the panel.
   - The zaak is FICTIONAL (Kapsalon Lumen, verzonnen) and the reviewers carry fictional first names
     with an initial; no star glyphs, the score is written out ('5 op 5').
   - Three reviews: goed, gemengd, slecht. Per review two tones: 'warm' and 'kort' (kort en zakelijk),
     both written as the uitbater would answer, in nl-BE, without promises the zaak cannot keep.
   - The readout always ends on 'automatisch geplaatst: 0 (altijd)': the human approves, or nothing
     happens. No 'verzonden' state anywhere. */
window.STS_LAB_REVIEWS = {
  zaak: "Kapsalon Lumen (verzonnen)",
  kop: "In onderzoek · gescripte simulatie, geen live AI. De teksten zijn vooraf geschreven.",
  uitleg: "Drie fictieve reviews. Kies per review een toon, pas de tekst aan zoals jij het zou zeggen, en keur goed of antwoord niet. Niets hiervan komt op Google; het blijft in je browser.",
  tonen: [
    { id: "warm", label: "Warm" },
    { id: "kort", label: "Kort en zakelijk" }
  ],
  reviews: [
    {
      id: 1, naam: "Els V.", score: 5, soort: "goed", wanneer: "vorige week",
      tekst: "Eerste keer bij Lumen en meteen goed geholpen. Ze luisterde echt naar wat ik wou en nam haar tijd voor de kleur. Ik kom zeker terug.",
      voorstel: {
        warm: "Dag Els, dankjewel voor je lieve woorden. Fijn dat de kleur precies is wat je in gedachten had; dat is waar we onze tijd voor nemen. Tot de volgende keer!",
        kort: "Dag Els, bedankt voor je review. Fijn dat je tevreden bent over de kleur. Tot een volgende afspraak."
      }
    },
    {
      id: 2, naam: "Karim B.", score: 3, soort: "gemengd", wanneer: "twee weken geleden",
      tekst: "Goeie knip, daar niets op aan te merken. Maar ik had een afspraak om 14 u en ben pas om 14.40 u in de stoel geraakt, zonder dat iemand iets zei.",
      voorstel: {
        warm: "Dag Karim, bedankt dat je dit schrijft. Het wachten was niet in orde en dat je er niets over hoorde nog minder; daar leren we van. Bel of schrijf gerust als je een volgende afspraak plant, dan maken we het goed.",
        kort: "Dag Karim, bedankt voor je eerlijke review. Veertig minuten wachten zonder uitleg hoort niet. We plannen voortaan ruimer en verwittigen als het uitloopt."
      }
    },
    {
      id: 3, naam: "Jo D.", score: 1, soort: "slecht", wanneer: "gisteren",
      tekst: "Twee keer gebeld, twee keer voicemail. Dan maar naar een ander kapsalon gegaan. Spijtig, want het zag er van buiten goed uit.",
      voorstel: {
        warm: "Dag Jo, dat spijt ons oprecht. Tijdens het knippen nemen we de telefoon niet op, en daardoor missen we soms iemand zoals jij. Je kan ons ook een berichtje sturen; dan antwoorden we tussen twee klanten door. Welkom als je het nog eens wil proberen.",
        kort: "Dag Jo, bedankt voor je reactie. Tijdens het knippen nemen we niet op; een berichtje beantwoorden we wel tussen twee klanten door. Je bent welkom."
      }
    }
  ],
  acties: { ja: "Goedkeuren (lokaal)", nee: "Niet antwoorden", opnieuw: "Opnieuw" },
  stempel: "gesimuleerd, niet op Google geplaatst",
  geenAntwoord: "Geen antwoord, jouw keuze. Ook dat vertrekt nergens heen.",
  leeg: "Kies eerst een toon of schrijf zelf een antwoord.",
  slot: "Zo zou het kunnen gaan: een voorstel per review, jij past aan en beslist. Automatisch plaatsen doen we nooit, ook niet als dit ooit meer wordt dan onderzoek."
};
