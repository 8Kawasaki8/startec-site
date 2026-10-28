/* ───────────────────────────────────────────────────────────
   STAR.TEC.SOLUTIONS — site settings. Change values here only.
   Empty values are hidden on the site automatically (contact
   details, legal rows). No prices live on the site: every
   quote is made per client.
─────────────────────────────────────────────────────────── */
window.STS_CONFIG = {
  company: "STS Digital",
  brand: "Star.Tec.Solutions",
  founder: "",                 // leeg = geen naam op de site (bewuste keuze van de oprichter)
  city: "Antwerpen",

  // Contact — fill in before publishing.
  email: "rubyghosty@gmail.com",   // temporary channel until a company address exists
  whatsapp: "",       // international, digits only: "32470123456". Once set, Bericht lists WhatsApp first and hands a visitor who prefers WhatsApp to wa.me
  phone: "",          // as shown on the site: "+32 470 12 34 56"

  // Legal identity (wettelijke vermeldingen, privacy, voorwaarden).
  // Required by Belgian law (art. XII.6 WER) as soon as the site offers services:
  legalName: "STS Digital",   // the registered name, e.g. "STS Digital" or your own name for an eenmanszaak
  legalForm: "",              // "eenmanszaak", "BV", ... (empty = row hidden)
  owner: "",                  // real name of the responsible publisher (verantwoordelijke uitgever)
  address: "",                // registered seat: "Straat 1, 2000 Antwerpen"
  kbo: "",                    // company number once registered: "0123.456.789"
  vat: "",                    // "BE 0123.456.789" or "btw-vrijstelling kleine onderneming (art. 56bis W.Btw)"
  hosting: "GitHub Pages (GitHub, Inc.)",   // where the site is served from; named in the privacy policy

  // Optional site copy (WP-02). Empty = the element that shows it stays hidden.
  replyPromise: "",            // the only response-time promise on the site (WP-11): one sentence the founder can keep, e.g. "Je krijgt binnen twee werkdagen antwoord van ons."
                               // Shown under the Bericht form (data-c="replyPromise") only while non-empty; empty = the line stays hidden, nothing else promises a response time
  wijken: "",                  // one sentence about the gemeenten and districten we serve, e.g. "Berchem, Borgerhout, Deurne, Merksem, Hoboken, Wilrijk en Mortsel." (data-c="wijken")
  credit: "gemaakt op startec", // the opt-in credit line on exports (A6 card, score card); the visitor switches it on, default off

  // Optional: send the contact form directly (emailjs.com). Leave empty to
  // fall back to the visitor's own mail app or WhatsApp.
  emailjs: { serviceId: "", templateId: "", publicKey: "" }
};
