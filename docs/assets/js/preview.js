/* "Typ je zaak. Zie je site.": builds a sketch of a site for whatever the
   visitor types, inside the phone frame on the home page. Nothing is sent. */
(function () {
  var form = document.getElementById("gen"), screen = document.getElementById("gen-screen");
  if (!form || !screen) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SECTORS = {
    horeca:   { c: "#E0A34B", tag: "Vandaag open tot 22:00. Reserveer je tafel in twee tikken.", main: "Reserveer een tafel", a: ["Lunch", "Diner", "Terras"], card1: ["De kaart", "Seizoensgerechten en klassiekers, met prijzen."], card2: ["Reviews", "Jouw echte Google-reviews komen hier."] },
    kapper:   { c: "#F5C400", tag: "Boek je stoel in twintig seconden, zonder te bellen.", main: "Boek online", a: ["Knippen", "Baard", "Kleuren"], card1: ["Vandaag nog vrij", "Eerstvolgende stoel: 16:30."], card2: ["Reviews", "Jouw echte Google-reviews komen hier."] },
    garage:   { c: "#7FB4FF", tag: "Eerlijke prijs, klaar wanneer we zeggen.", main: "Vraag een richtprijs", a: ["Onderhoud", "Keuring", "Banden"], card1: ["Werkplaatsbord", "Je klant ziet wanneer zijn wagen klaar is."], card2: ["Reviews", "Jouw echte Google-reviews komen hier."] },
    bakkerij: { c: "#F3B79B", tag: "Elke ochtend vers vanaf 7 uur. Bestel je taart online.", main: "Bestel je taart", a: ["Brood", "Patisserie", "Ontbijt"], card1: ["Vandaag in de toog", "Wat er vandaag ligt, met foto."], card2: ["Reviews", "Jouw echte Google-reviews komen hier."] },
    winkel:   { c: "#9BE88A", tag: "Kom langs of bestel online. Afhalen binnen het uur.", main: "Bekijk het aanbod", a: ["Nieuw", "Aanbiedingen", "Afhalen"], card1: ["Openingsuren", "Jouw echte uren, ook op feestdagen."], card2: ["Reviews", "Jouw echte Google-reviews komen hier."] },
    diensten: { c: "#FFB36B", tag: "Offerte binnen 24 uur. Vakwerk met garantie.", main: "Vraag een offerte", a: ["Renovatie", "Herstelling", "Onderhoud"], card1: ["Recent werk", "Foto's van je laatste projecten."], card2: ["Reviews", "Jouw echte Google-reviews komen hier."] },
    praktijk: { c: "#8FD3FF", tag: "Een afspraak maken zonder te bellen, ook 's avonds.", main: "Maak een afspraak", a: ["Eerste bezoek", "Terugbetaling", "Praktisch"], card1: ["Afspraken", "Vrije momenten, live uit je agenda."], card2: ["Reviews", "Jouw echte Google-reviews komen hier."] },
    anders:   { c: "#36E8FF", tag: "Zichtbaar voor wie je 's avonds zoekt op zijn gsm.", main: "Neem contact op", a: ["Diensten", "Over ons", "Contact"], card1: ["Wat je doet", "In drie zinnen, met een foto."], card2: ["Reviews", "Jouw echte Google-reviews komen hier."] }
  };
  var phone = form.closest(".sec").querySelector(".phone"), empty = screen.querySelector(".ps-empty"), cta = document.getElementById("gen-cta");
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var typing = null;

  function render(name, sectorKey, city) {
    var s = SECTORS[sectorKey] || SECTORS.anders, initial = (name.trim()[0] || "J").toUpperCase();
    phone.style.setProperty("--c", s.c);
    var html =
      '<div class="ps-bar"><i>' + esc(initial) + "</i>" + esc(name) + '<span class="ps-menu" aria-hidden="true"><b></b><b></b></span></div>' +
      '<div class="ps-hero gen-reveal">' +
        '<span class="ps-status"><i></i>Nu open</span>' +
        '<div class="ps-name"><span class="typed"></span><span class="cur"></span></div>' +
        '<div class="ps-tag">' + esc(s.tag) + "</div>" +
        '<div class="ps-ctas"><span class="main">' + esc(s.main) + "</span><span>Bel</span><span>WhatsApp</span></div>" +
        '<div class="ps-ctas" style="margin-top:8px">' + s.a.map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + "</div>" +
      "</div>" +
      '<div class="ps-row gen-reveal"><div class="ps-card"><span class="label">' + esc(s.card1[0]) + "</span><p>" + esc(s.card1[1]) + '</p></div><div class="ps-card"><span class="label">' + esc(s.card2[0]) + '</span><p class="ps-stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</p><p>' + esc(s.card2[1]) + "</p></div></div>" +
      '<div class="ps-map gen-reveal"><i></i><b>' + esc(city || "Jouw gemeente") + "</b></div>" +
      '<div class="ps-hours gen-reveal"><span class="label">Openingsuren</span><div><span>Ma &ndash; vr</span><b>9:00 &ndash; 18:00</b><span>Za</span><b>9:00 &ndash; 13:00</b><span>Zo</span><b>gesloten</b></div><small>Voorbeeld. Jouw echte uren komen hier.</small></div>' +
      '<div class="ps-foot"><span>' + esc(name) + "</span><span>Gemaakt door <em>Star.Tec.Solutions</em></span></div>";
    screen.querySelectorAll(":scope > :not(.ps-empty)").forEach(function (n) { n.remove(); });
    screen.insertAdjacentHTML("afterbegin", html);
    empty.classList.add("off");
    // the name types itself in; the rest reveals after it
    var typed = screen.querySelector(".typed"), i = 0;
    if (typing) clearInterval(typing);
    if (reduce) { typed.textContent = name; screen.querySelectorAll(".gen-reveal").forEach(function (g) { g.classList.add("in"); }); return; }
    screen.querySelectorAll(".gen-reveal").forEach(function (g) { g.classList.remove("in"); });
    typing = setInterval(function () {
      typed.textContent = name.slice(0, ++i);
      if (i >= name.length) { clearInterval(typing); typing = null; setTimeout(function () { screen.querySelectorAll(".gen-reveal").forEach(function (g) { g.classList.add("in"); }); }, 150); }
    }, 55);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = form.elements.name.value.trim().slice(0, 40) || "Jouw zaak", sector = form.elements.sector.value, city = form.elements.city.value.trim().slice(0, 30);
    render(name, sector, city);
    var label = form.elements.sector.options[form.elements.sector.selectedIndex].text;
    cta.hidden = false;
    cta.dataset.msg = "Hallo, ik wil graag het gratis voorbeeld voor " + name + " (" + label.toLowerCase() + (city ? ", " + city : "") + ").\n\n";
    if (innerWidth < 900) phone.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  });
  cta.addEventListener("click", function () {
    var m = document.querySelector("#contact-form [name=message]"), b = document.querySelector("#contact-form [name=business]");
    if (m && cta.dataset.msg) m.value = cta.dataset.msg;
    if (b && !b.value) b.value = form.elements.name.value.trim().slice(0, 40);
  });
})();
