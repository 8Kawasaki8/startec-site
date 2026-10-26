/* FROZEN CONVERSION CONTRACT (WP-02). Every simulation and tool reaches the one form through
   this file and nothing else. Later packages may add CTAs and extend copy inside the room, but
   the four rules below, the key list and the message composition do not change:
   (1) same page: window.STSBericht.prefill({key, subject?, lines?}) fills the subject and the
       textarea of #bericht (today: #contact-form), dispatches 'sts:prefill' and scrolls the form
       into view; prefill('gevel') is shorthand for prefill({key: 'gevel'}).
   (2) cross page: a link index.html#bericht?onderwerp=<key> is read from location.hash on load.
   (3) tool prefill: gereedschap.html#whatsapp?bericht=<urlencoded> is read from location.hash only
       and fills the WhatsApp message field (#wa-msg), event 'sts:tool-prefill'.
   (4) KEYS below are frozen. Message = 'Dag Snymis, ik ben van {zaak} in {gemeente} ({Sectorlabel}). ' +
       template ('Dag Snymis,' + blank line + template without a name). Visitor voice (data-voice=visitor).
       Templates only state what is true for every visitor (conditions, never facts about his business).
       Without a form on the page the message is parked in STSBericht.parked and the browser goes
       to index.html#bericht?onderwerp=<key>, with the composed lines as &r= (newline-separated,
       url-encoded) and a custom subject as &s=; both are read back by (2). The hash never reaches
       a server and nothing is stored.
   (5) every CTA that lands in Bericht carries data-bericht=<key>; the QA harness clicks each one.
   STSBericht.phrase(key) returns the template, STSBericht.compose(opts) the full text. */
(function () {
  var KEYS = {
    gevel: { subject: "Het echte voorbeeld van mijn gevel", template: "Ik heb mijn naam op het uithangbord getypt en de schets gezien. Mag ik het echte voorbeeld van mijn site, met mijn uren en foto's?" },
    telefoon: { subject: "De telefoon om 19 u", template: "Ik heb de dinsdag van de verzonnen zaak gespeeld. Als de telefoon bij mij ook overgaat terwijl ik bezig ben: kan je me tonen wat een site daaraan verandert, met mijn echte uren?" },
    doorlichting: { subject: "Een doorlichting van mijn zaak", template: "Ik heb de doorlichting van de fictieve zaak bekeken. Mag ik dezelfde doorlichting voor mijn eigen zaak, op basis van wat er publiek over mij te vinden is?" },
    kaartje: { subject: "Mijn Google-kaartje om 19 u", template: "Ik heb het Google-kaartje om 19 u geprobeerd. Wil je eens kijken hoe mijn eigen Google-profiel er 's avonds uitziet, en wat ik eraan kan verbeteren?" },
    radar: { subject: "Zet mijn zaak op de radar", template: "Ik las hoe een zaak bij jou op de radar komt. Je mag mijn zaak bekijken en een voorbeeld maken; ik beslis daarna zelf." },
    straat: { subject: "Mijn gevel in de straat", template: "Ik heb de oude en de nieuwe gevel in de straat vergeleken. Ik wil weten hoe mijn eigen gevel er nu uitziet voor een klant, en wat een nieuwe zou veranderen." },
    reviews: { subject: "Reviews beantwoorden in mijn toon", template: "Ik zag de proef met reviews beantwoorden in mijn eigen toon. Hou me op de hoogte als dit verder raakt dan onderzoek; ik wil het graag mee uitproberen." },
    assistent: { subject: "Een assistent buiten de uren", template: "Ik zag de schets van een assistent die buiten de uren antwoordt. Dat zou mij helpen. Laat het me weten als dit verder raakt dan onderzoek." },
    zichtbaarheid: { subject: "Mijn zichtbaarheidscheck", template: "Ik heb de zichtbaarheidscheck ingevuld. Wil je mijn resultaat eens bekijken en zeggen welke stap ik eerst moet zetten?" },
    uren: { subject: "Mijn openingsuren", template: "Ik heb de openingsuren-check gedaan. Als mijn uren niet overal hetzelfde staan, kan je me helpen om dat in orde te brengen?" },
    algemeen: { subject: "Een vraag over mijn zaak", template: "Ik heb een vraag over mijn zaak en mijn site. Wanneer past het om even te bellen of te schrijven?" }
  };
  function key(k) { return KEYS.hasOwnProperty(k) ? k : "algemeen"; }
  function phrase(k) { return KEYS[key(k)].template; }
  function zaak() { var S = window.STSState; return S ? S.get() : { zaak: "", sector: "", gemeente: "" }; }
  function sectorLabel(k) { var N = window.STSNames; return (N && N.sectorLabel(k)) || k; }
  function opening(s) {
    if (!s.zaak) return "Dag Snymis,\n\n";
    var t = "Dag Snymis, ik ben van " + s.zaak + (s.gemeente ? " in " + s.gemeente : "");   // the uitbater is 'van' the zaak
    return t + (s.sector && s.sector !== "anders" ? " (" + sectorLabel(s.sector) + ")" : "") + ". ";
  }
  function compose(o) {
    var lines = o && o.lines ? [].concat(o.lines).filter(Boolean) : [];
    return opening(zaak()) + phrase(o && o.key) + (lines.length ? "\n\n" + lines.join("\n") : "");
  }
  function root() { var l = document.querySelector('link[href*="assets/css/"]'); return l ? l.href.slice(0, l.href.indexOf("assets/")) : ""; }
  function form() { return document.querySelector("#bericht form, form#bericht, #contact-form"); }
  function hashQuery(name) {
    var h = location.hash || "", i = h.indexOf("?");
    if (i < 0 || h.slice(1, i) !== name) return null;
    try { return new URLSearchParams(h.slice(i + 1)); } catch (e) { return null; }
  }
  function prefill(opts) {
    var o = typeof opts === "string" ? { key: opts } : (opts || {}), k = key(o.key), f = form();
    var text = compose({ key: k, lines: o.lines }), subject = o.subject || KEYS[k].subject;
    if (!f) {
      api.parked = { key: k, subject: subject, text: text };
      var lines = o.lines ? [].concat(o.lines).filter(Boolean) : [];
      var target = root() + "index.html#bericht?onderwerp=" + encodeURIComponent(k)
        + (lines.length ? "&r=" + encodeURIComponent(lines.join("\n")) : "") + (o.subject ? "&s=" + encodeURIComponent(o.subject) : "");
      location.assign(target);
      return target;
    }
    var ta = f.querySelector("textarea[name=bericht], textarea[name=message], textarea"), sub = f.querySelector("[name=onderwerp], [name=subject]");
    if (sub) sub.value = subject;
    /* never wipe what the visitor typed: replace only an empty field or our own previous prefill */
    if (ta) {
      var own = !ta.value.trim() || ta.value === api.last;
      ta.value = own ? text : ta.value.replace(/\s+$/, "") + "\n\n" + text;
      ta.setAttribute("data-voice", "visitor"); ta.setAttribute("data-bericht-key", k);
    }
    api.last = text;
    f.setAttribute("data-bericht-key", k);
    api.parked = null;
    window.dispatchEvent(new CustomEvent("sts:prefill", { detail: { key: k, subject: subject, text: text } }));
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    (document.getElementById("bericht") || f).scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    if (ta) { try { ta.focus({ preventScroll: true }); } catch (e) { /* older browsers */ } }
    return text;
  }
  var api = window.STSBericht = { KEYS: KEYS, prefill: prefill, compose: compose, phrase: phrase, parked: null, last: null };

  /* (5) data-bericht: on a page with the form the click prefills in place; elsewhere it navigates with the key. */
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("[data-bericht]") : null;
    if (!a || e.defaultPrevented) return;
    e.preventDefault();
    prefill({ key: a.getAttribute("data-bericht"), subject: a.getAttribute("data-bericht-subject") || undefined });
  });
  /* (2) and (3): the hash on arrival. */
  var q = hashQuery("bericht");
  if (q && q.get("onderwerp") && form()) prefill({ key: q.get("onderwerp"), subject: q.get("s") || undefined, lines: q.get("r") ? q.get("r").split("\n") : undefined });
  var t = hashQuery("whatsapp");
  if (t && t.get("bericht") != null) {
    var msg = t.get("bericht").slice(0, 300), field = document.querySelector("#wa-msg, [data-tool-bericht=whatsapp]");
    if (field) { field.value = msg; field.dispatchEvent(new Event("input", { bubbles: true })); }
    window.dispatchEvent(new CustomEvent("sts:tool-prefill", { detail: { tool: "whatsapp", bericht: msg } }));
  }
})();
