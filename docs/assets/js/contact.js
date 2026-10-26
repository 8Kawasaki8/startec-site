/* Bericht (src/rooms/bericht.html, dev/bericht.html): the one form of the site.
   - Hands the message to the visitor's mail app (mailto:) or WhatsApp (wa.me); EmailJS only
     when config.js names a service. Never a 'verstuurd' state without a real success.
   - Honeypot (company_site) drops bots silently; it sits in an aria-hidden block with tabindex -1.
   - Validation (WP-19): a missing required field is named in #form-err (role=alert) and carries
     aria-invalid and aria-describedby=form-err until it is filled; focus moves to the first one.
   - Consumes 'sts:prefill' from contact-prefill.js (the frozen contract fills the textarea,
     the subject field and data-voice=visitor); this file only scrolls the field into view on
     phones and keeps the business field in step with the shared state (sts-zaak).
   - WhatsApp first: when config.whatsapp is set the answer-channel list starts with WhatsApp
     and a visitor who prefers WhatsApp is handed to wa.me; otherwise the mail app.
   - ?onderwerp=<key> in the query (old Lab links) goes through STSBericht.prefill.
   - The share line: one text the visitor copies or shares himself; nothing leaves the page. */
(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;
  var C = window.STS_CONFIG || {}, S = window.STSState, B = window.STSBericht;
  var msg = form.elements.message, biz = form.elements.business, prefer = form.elements.prefer, subj = form.elements.onderwerp;
  var ok = document.getElementById("form-ok"), err = document.getElementById("form-err");
  var phone = matchMedia("(max-width: 899px)").matches, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasWa = !!C.whatsapp, hasMail = !!C.email;

  /* the channel the visitor picks: WhatsApp first when the number exists, else e-mail first */
  if (prefer && prefer.options) {
    var first = [].slice.call(prefer.options).filter(function (o) { return o.value === (hasWa ? "WhatsApp" : "E-mail"); })[0];
    if (first) { prefer.insertBefore(first, prefer.options[0]); prefer.selectedIndex = 0; }
  }

  /* the visitor's name is context: the business field follows the shared record until he types himself */
  var autoBiz = "";
  if (S && biz) S.subscribe(function (s) { if (!biz.value || biz.value === autoBiz) biz.value = s.zaak; autoBiz = s.zaak; });

  /* ?onderwerp=… in the query (legacy of the Lab cards) uses the same contract as the hash */
  var q = new URLSearchParams(location.search);
  if (q.get("onderwerp") && B && !msg.value && !/^#bericht\?/.test(location.hash)) B.prefill(q.get("onderwerp"));

  /* after a prefill the field itself comes into view on phones (the room starts with its heading) */
  window.addEventListener("sts:prefill", function () {
    var wrap = msg.closest("[data-voice]");
    if (!wrap) msg.setAttribute("data-voice", "visitor");
    if (!phone) return;
    requestAnimationFrame(function () { msg.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }); });
  });

  function show(el, text) { if (!el) return; if (text != null) el.textContent = text; el.hidden = false; }
  function fail(text) { show(err, text); }

  /* WP-19: a missing field is named in #form-err (role=alert) and tied to the field itself: aria-invalid plus
     aria-describedby, focus on the first one; typing a valid value clears the field, the last one clears the message */
  var VELD = { name: "je naam", reach: "een e-mailadres of gsm-nummer", message: "je bericht" };
  function describe(el, on) {
    var ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(function (id) { return id && id !== "form-err"; });
    if (on) ids.push("form-err");
    if (ids.length) el.setAttribute("aria-describedby", ids.join(" ")); else el.removeAttribute("aria-describedby");
    if (on) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
  }
  function invalidFields() { return [].filter.call(form.querySelectorAll("[required]"), function (el) { return !el.checkValidity(); }); }
  function markInvalid(list) {
    fail("Nog even invullen: " + list.map(function (el) { return VELD[el.name] || el.name; }).join(", ") + ".");
    list.forEach(function (el) { describe(el, true); });
    try { list[0].focus({ preventScroll: false }); } catch (x) { list[0].focus(); }
  }
  form.addEventListener("input", function (e) {
    var el = e.target;
    if (el.getAttribute("aria-invalid") === "true" && el.checkValidity()) describe(el, false);
    if (err && !err.hidden && !form.querySelector('[aria-invalid="true"]')) err.hidden = true;
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (err) err.hidden = true;
    if (ok) ok.hidden = true;
    if (form.elements.company_site && form.elements.company_site.value) return;          // honeypot: silently drop bots
    var missing = invalidFields();
    if (missing.length) { markInvalid(missing); return; }

    var data = {
      name: form.elements.name.value.trim(),
      business: biz ? biz.value.trim() : "",
      reach: form.elements.reach.value.trim(),
      prefer: prefer ? prefer.value : "",
      message: msg.value.trim()
    };
    var subject = (subj && subj.value.trim()) || ("Bericht via de site" + (data.business ? ": " + data.business : ""));
    var body = data.message + "\n\n— " + data.name + (data.business ? ", " + data.business : "") +
      "\nBereikbaar via: " + data.reach + (data.prefer ? " (liefst via " + data.prefer + ")" : "");

    var ej = C.emailjs || {};
    if (ej.serviceId && ej.templateId && ej.publicKey) {
      var btn = form.querySelector("button[type=submit]"); btn.disabled = true;
      fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_id: ej.serviceId, template_id: ej.templateId, user_id: ej.publicKey,
          template_params: { subject: subject, from_name: data.name, business: data.business, reply_to: data.reach, prefer: data.prefer, message: body } })
      }).then(function (r) {
        btn.disabled = false;
        if (!r.ok) throw new Error(r.status);
        form.reset(); show(ok, "Je bericht is aangekomen bij Snymis. Hij leest het zelf."); ok.focus();
      }).catch(function () {
        btn.disabled = false;
        fail("Versturen lukte niet. Probeer opnieuw, of stuur je bericht rechtstreeks" + (hasMail ? " naar " + C.email : "") + ".");
      });
      return;
    }
    var viaWa = hasWa && (data.prefer === "WhatsApp" || !hasMail);
    if (viaWa) {
      window.open("https://wa.me/" + String(C.whatsapp).replace(/\D/g, "") + "?text=" + encodeURIComponent(subject + "\n\n" + body), "_blank", "noopener");
    } else if (hasMail) {
      location.href = "mailto:" + C.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    } else { fail("Contactgegevens zijn nog niet ingesteld op deze site."); return; }
    if (ok) { ok.hidden = false; try { ok.focus({ preventScroll: true }); } catch (x) { /* older browsers */ } }
  });

  /* ── the share line: 'Ken je een collega in je straat?' ── */
  var maak = document.querySelector("[data-deel-maak]"), kopieer = document.querySelector("[data-deel-kopieer]");
  var deel = document.querySelector("[data-deel-tekst]"), status = document.querySelector("[data-deel-status]");
  if (!maak || !deel) return;
  function pageUrl() { return location.href.split("#")[0].split("?")[0]; }
  function deelTekst() {
    return "Dag, ken je dit al? Op " + pageUrl() + " typ je de naam van je zaak op een uithangbord en zie je meteen een schets van een site, " +
      "met wat een klant om 19 u zoekt. Er is ook gratis gereedschap voor je zaak: een WhatsApp-knop met QR-code en een zichtbaarheidscheck. " +
      "De man erachter, Snymis uit Antwerpen, leest elk bericht zelf. Misschien iets voor jou.";
  }
  maak.addEventListener("click", function () {
    deel.value = deelTekst();
    deel.hidden = false; maak.setAttribute("aria-expanded", "true");
    if (kopieer) { kopieer.hidden = false; kopieer.textContent = navigator.share ? "Deel de tekst" : "Kopieer de tekst"; }
    show(status, "Dit is jouw tekst: pas hem aan als je wilt en stuur hem zelf door.");
    deel.focus(); deel.select();
  });
  if (kopieer) kopieer.addEventListener("click", function () {
    var text = deel.value || deelTekst();
    if (navigator.share) { navigator.share({ text: text }).catch(function () { /* the visitor closed the sheet */ }); return; }
    var done = function () { show(status, "Gekopieerd. Plak de tekst in je bericht aan je collega."); };
    var hand = function () { deel.focus(); deel.select(); show(status, "Kopiëren lukte niet vanzelf: de tekst staat geselecteerd, kopieer hem met je toetsenbord."); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, hand); else hand();
  });
})();
