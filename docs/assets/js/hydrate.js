/* Hydrate: fills the static page from config.js and the shared state. Text only, never
   markup: everything the visitor typed lands through textContent.
   - [data-c=key] from window.STS_CONFIG; empty values hide the element or its [data-c-wrap]
     (email, whatsapp and phone become links; data-keep keeps the element's own label).
   - [data-year]; the EmailJS paragraphs of privacy.html only when direct sending is configured.
   - [data-subject] links prefill the old contact form once (legacy of the Lab cards).
   - [data-zaak], [data-gemeente], [data-sector-label] on every 'sts:zaak' (the attribute's own
     value is the fallback text, e.g. <span data-zaak="je zaak">); [data-aanspreek] gets je or u;
     html[data-sector] carries the sector key for CSS; <datalist data-gemeenten> gets the districts.
   Loads after names.js and state.js, before the page scripts. */
(function () {
  var C = window.STS_CONFIG || {}, N = window.STSNames, S = window.STSState;

  function digits(v) { return String(v).replace(/[^\d+]/g, ""); }
  document.querySelectorAll("[data-c]").forEach(function (el) {
    var key = el.getAttribute("data-c"), v = C[key], wrap = el.closest("[data-c-wrap]") || el;
    if (!v || typeof v === "object") { wrap.hidden = true; return; }
    wrap.hidden = false;
    if (key === "email") { el.href = "mailto:" + v; if (!el.hasAttribute("data-keep")) el.textContent = v; }
    else if (key === "whatsapp") { el.href = "https://wa.me/" + digits(v); el.target = "_blank"; el.rel = "noopener"; if (!el.hasAttribute("data-keep")) el.textContent = "WhatsApp"; }
    else if (key === "phone") { el.href = "tel:" + digits(v); if (!el.hasAttribute("data-keep")) el.textContent = v; }
    else if (!el.hasAttribute("data-keep")) el.textContent = v;
  });
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  var ej = C.emailjs || {}, ejOn = !!(ej.serviceId && ej.templateId && ej.publicKey);
  ["pv-emailjs", "pv-emailjs-li"].forEach(function (id) { var el = document.getElementById(id); if (el) el.hidden = !ejOn; });

  document.querySelectorAll("[data-subject]").forEach(function (a) {
    a.addEventListener("click", function () {
      var m = document.querySelector("#contact-form [name=message]");
      if (m && !m.value) m.value = "Dag Snymis, ik heb een vraag over: " + a.getAttribute("data-subject") + ".\n\n";
    });
  });

  if (N) document.querySelectorAll("datalist[data-gemeenten]").forEach(function (dl) { N.fillDatalist(dl); });

  /* The shared record, written as text. */
  function fallback(el, attr) { return el.getAttribute(attr) || ""; }
  function fill(s) {
    var label = N ? N.sectorLabel(s.sector) : s.sector, who = N ? N.aanspreek(s.sector) : "je";
    document.querySelectorAll("[data-zaak]").forEach(function (el) { el.textContent = s.zaak || fallback(el, "data-zaak"); });
    document.querySelectorAll("[data-gemeente]").forEach(function (el) { el.textContent = s.gemeente || fallback(el, "data-gemeente"); });
    document.querySelectorAll("[data-sector-label]").forEach(function (el) { el.textContent = label || fallback(el, "data-sector-label"); });
    document.querySelectorAll("[data-aanspreek]").forEach(function (el) { el.textContent = who; });
    var d = document.documentElement;
    if (s.sector) d.setAttribute("data-sector", s.sector); else d.removeAttribute("data-sector");
    d.setAttribute("data-zaak-source", s.source || "none");
  }
  if (S) S.subscribe(fill);
  else fill({ zaak: "", sector: "", gemeente: "", g: 0, source: "" });
})();
