/* Zichtbaarheidscheck (loket 1 of src/rooms/gereedschap.html): six questions, one score.
   - The questions name the business through [data-zaak] (hydrate.js); the score is STSScore.score
     of the six values (0, 50, 100), the three lowest answers give the three steps (STSScore.worst).
   - Three result texts by band; the strong one sells nothing: it says to keep the hours
     and the profile right and to send Snymis a note when someone should look along.
   - The result CTA gets data-bericht=zichtbaarheid only once a score exists (before that there is
     nothing to send) and adds one visitor-voice line with the score to the frozen template
     (STSBericht.prefill lines); the quiet line at the end of the loket is always there.
   - The result is kept in the address (?score=NN&antw=digits, 0/1/2 per question) so the page can be
     reopened or sent; state.js leaves those keys alone. On load with ?antw the answers are restored
     and scored again; with only ?score the ring and the texts show and the steps ask for a new run.
   - Dispatches 'sts:score' {score, band, tips, vals} on window for the score card and the share line;
     window.STSCheck.last holds the same record. */
(function () {
  var d = document, zc = d.getElementById("zc"), Sc = window.STSScore;
  if (!zc || !Sc) return;
  var $ = function (id) { return d.getElementById(id); };
  var KEYS = ["q1", "q2", "q3", "q4", "q5", "q6"], CIRC = 326.7;
  var TIPS = {
    q1: "Claim je Google-bedrijfsprofiel. Het is wat klanten als eerste zien, nog voor je website.",
    q2: "Zet overal dezelfde openingsuren, ook voor feestdagen. Een klant die voor een gesloten deur staat, komt niet terug.",
    q3: "Zet een bel- en WhatsApp-knop bovenaan je site. Eén tik, geen nummer overtypen. De knop maak je hieronder gratis.",
    q4: "Een trage site op gsm wordt vaak weggeklikt voor ze open is; mik op minder dan 2,5 s.",
    q5: "Beantwoord elke review, ook de slechte, liefst dezelfde week nog. Lezers kijken naar je reactie, niet alleen naar de score.",
    q6: "Plaats elke maand een recente foto van je zaak of je werk. Oude foto's wekken de indruk dat je dicht bent."
  };
  var TEKST = {
    laag: ["Onzichtbaar voor wie 's avonds zoekt.", "Klanten vinden je niet, of vinden verkeerde informatie. Het goede nieuws: elk van de drie stappen hieronder kan je deze week zelf zetten."],
    midden: ["Zichtbaar, maar je laat klanten liggen.", "De basis staat er. Een paar gerichte stappen maken het verschil tussen gevonden worden en gebeld worden."],
    hoog: ["Sterk. Je bent vindbaar en bereikbaar.", "Hou je uren en je Google-profiel juist, en antwoord op reviews; wil je dat iemand meekijkt, stuur Snymis een berichtje."]
  };
  var res = $("zc-res"), hint = $("zc-hint"), err = $("zc-err"), cta = $("zc-cta"), api = window.STSCheck = { last: null, TIPS: TIPS, TEKST: TEKST };

  function answers() {
    var vals = {}, missing = false;
    KEYS.forEach(function (k) { var r = zc.querySelector('input[name=' + k + ']:checked'); if (!r) missing = true; else vals[k] = +r.value; });
    return missing ? null : vals;
  }
  function digits(vals) { return KEYS.map(function (k) { return vals[k] === 100 ? "2" : vals[k] === 50 ? "1" : "0"; }).join(""); }
  function setAnswers(str) {
    if (!/^[012]{6}$/.test(str || "")) return false;
    KEYS.forEach(function (k, i) { var r = zc.querySelector('input[name=' + k + '][value="' + ["0", "50", "100"][+str.charAt(i)] + '"]'); if (r) r.checked = true; });
    return true;
  }
  function remember(score, vals) {
    var p; try { p = new URLSearchParams(location.search); } catch (e) { return; }
    p.set("score", String(score));
    if (vals) p.set("antw", digits(vals)); else p.delete("antw");
    try { history.replaceState(history.state, "", location.pathname + "?" + p.toString() + "#zichtbaarheid"); } catch (e) { /* sandbox */ }
  }

  function show(score, vals, scroll) {
    var band = Sc.band(score), tips = vals ? Sc.worst(vals, 3) : [];
    $("zc-num").textContent = score;
    $("zc-title").textContent = TEKST[band][0];
    $("zc-text").textContent = TEKST[band][1];
    var ol = $("zc-tips");
    while (ol.firstChild) ol.removeChild(ol.firstChild);
    (tips.length ? tips.map(function (k) { return TIPS[k]; }) : ["Vul de zes vragen opnieuw in; dan staan je drie stappen hier."]).forEach(function (t) { var li = d.createElement("li"); li.textContent = t; ol.appendChild(li); });
    $("zc-live").textContent = "Je score: " + score + " op 100. " + TEKST[band][0];
    res.hidden = false; hint.hidden = true;
    cta.setAttribute("data-bericht", "zichtbaarheid");
    requestAnimationFrame(function () { $("zc-arc").style.strokeDashoffset = Sc.dashoffset(score, CIRC); });
    api.last = { score: score, band: band, tips: tips.map(function (k) { return TIPS[k]; }), vals: vals };
    try { window.dispatchEvent(new CustomEvent("sts:score", { detail: api.last })); } catch (e) { /* no CustomEvent */ }
    if (scroll && innerWidth < 860) res.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  zc.addEventListener("submit", function (e) {
    e.preventDefault();
    var vals = answers();
    err.hidden = !!vals;
    if (!vals) return;
    var score = Sc.score(vals);
    remember(score, vals);
    show(score, vals, true);
  });

  /* the CTA: the frozen template plus one line in the owner's words */
  cta.addEventListener("click", function (e) {
    var B = window.STSBericht, l = api.last;
    if (!B || typeof B.prefill !== "function" || !l) return;
    e.preventDefault();
    B.prefill({ key: "zichtbaarheid", lines: ["Mijn zelfinschatting: " + l.score + " op 100." + (l.tips.length ? " Eerste stap volgens de check: " + l.tips[0] : "")] });
  });

  /* arriving with a result in the address */
  var q; try { q = new URLSearchParams(location.search); } catch (e) { q = null; }
  if (q && q.has("score")) {
    var s = parseInt(q.get("score"), 10), restored = setAnswers(q.get("antw"));
    var vals = restored ? answers() : null;
    if (vals) s = Sc.score(vals);
    if (isFinite(s) && s >= 0 && s <= 100) show(s, vals, false);
  }
})();
