/* ───────────────────────────────────────────────────────────
   STAR.TEC.SOLUTIONS — site settings. Change values here only.
   Empty contact values are hidden on the site automatically.
   No prices live on the site: every quote is made per client.
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
  kbo: "",            // company number once registered: "BE 0123.456.789"

  // Optional: send the contact form directly (emailjs.com). Leave empty to
  // fall back to the visitor's own mail app or WhatsApp.
  emailjs: { serviceId: "", templateId: "", publicKey: "" }
};
