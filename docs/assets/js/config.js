/* ───────────────────────────────────────────────────────────
   STAR.TEC.SOLUTIONS — site settings. Change values here only.
   Empty values are hidden on the site automatically (contact
   details, legal rows). No prices live on the site: every
   quote is made per client.
─────────────────────────────────────────────────────────── */
window.STS_CONFIG = {
  company: "STS Digital",
  brand: "Star.Tec.Solutions",
  founder: "Snymis",
  city: "Antwerpen",

  // Contact — fill in before publishing.
  email: "rubyghosty@gmail.com",   // temporary channel until a company address exists
  whatsapp: "",       // international, digits only: "32470123456"
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

  // Optional: send the contact form directly (emailjs.com). Leave empty to
  // fall back to the visitor's own mail app or WhatsApp.
  emailjs: { serviceId: "", templateId: "", publicKey: "" }
};
