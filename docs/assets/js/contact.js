/* Contact form: sends via EmailJS when configured, otherwise hands the message
   to the visitor's mail app or WhatsApp. Never shows a fake "sent". */
(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;
  var C = window.STS_CONFIG || {};
  var msg = form.elements.message;
  var ok = document.getElementById("form-ok"), err = document.getElementById("form-err");

  // ?onderwerp=… from a Lab card prefills the message
  var q = new URLSearchParams(location.search);
  if (q.get("onderwerp") && !msg.value) msg.value = "Hallo, ik ben geïnteresseerd in: " + q.get("onderwerp") + ".\n\n";

  function fail(text) { err.textContent = text; err.hidden = false; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    err.hidden = true;
    if (form.elements.company_site.value) return;          // honeypot: silently drop bots
    if (!form.reportValidity()) return;

    var data = {
      name: form.elements.name.value.trim(),
      business: form.elements.business.value.trim(),
      reach: form.elements.reach.value.trim(),
      prefer: form.elements.prefer.value,
      message: msg.value.trim()
    };
    var subject = "Aanvraag" + (data.business ? " — " + data.business : "") + " (" + data.name + ")";
    var body = data.message + "\n\n— " + data.name + (data.business ? ", " + data.business : "") +
      "\nBereikbaar via: " + data.reach + " (voorkeur: " + data.prefer + ")";

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
        form.reset(); ok.hidden = false; ok.focus();
      }).catch(function () {
        btn.disabled = false;
        fail("Versturen lukte niet. Probeer opnieuw, of stuur je bericht rechtstreeks" + (C.email ? " naar " + C.email : "") + ".");
      });
      return;
    }
    if (C.email) { location.href = "mailto:" + C.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body); return; }
    if (C.whatsapp) { window.open("https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent(body), "_blank", "noopener"); return; }
    fail("Contactgegevens zijn nog niet ingesteld op deze site.");
  });
})();
