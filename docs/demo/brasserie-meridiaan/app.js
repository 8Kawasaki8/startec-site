/* Brasserie Meridiaan: fictieve demo door Star.Tec.Solutions.
   Gegevens van de zaak, openingsuren, kaart, marquee, ornamenten en motion.
   Alles hier is verzonnen: adres, nummer, gerechten en prijzen. */
(function () {
  "use strict";

  var M = (window.MERIDIAAN = window.MERIDIAAN || {});
  var root = document.documentElement;
  root.classList.add("js");
  M.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (M.reduced) root.classList.add("reduced");

  /* ---------- Gegevens van de zaak ---------- */
  M.PLACE = {
    name: "Brasserie Meridiaan",
    street: "Sterrenplein 4",
    city: "2000 Antwerpen",
    phone: "+32 3 000 00 00",
    maxOnline: 8,
    salonSeats: 20,
    vegMenu: "Zeg het bij je aanvraag, dan stelt de keuken een vegetarisch menu in drie gangen samen.",
    parking: "Parking Zuiderpoort, op 200 meter van de deur, is open tot 01:00. Op zondag parkeer je gratis in de straten rond het plein.",
    terrace: "Ja, een terras op het Sterrenplein met 24 plaatsen, van april tot oktober. Terrasplaatsen reserveren we niet: wie eerst komt, zit eerst.",
    terraceSeason: [4, 10]
  };

  /* Index = getDay(): 0 = zondag. null = gesloten. */
  M.HOURS = [
    { open: "11:30", close: "21:30" },
    null,
    { open: "11:30", close: "22:30" },
    { open: "11:30", close: "22:30" },
    { open: "11:30", close: "22:30" },
    { open: "11:30", close: "23:30" },
    { open: "11:30", close: "23:30" }
  ];
  M.LAST_SEATING = 90; /* minuten voor sluitingstijd */
  M.DAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  M.DAYS_SHORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];

  M.MENU = [
    { id: "soupe", cat: "voor", name: "Soupe à l’oignon gratinée", price: 12, tag: "veg", today: true,
      desc: "Op groentebouillon, gegratineerd met Gruyère en een korst van zuurdesem." },
    { id: "kroket", cat: "voor", name: "Garnaalkroketten van het huis", price: 16, tag: "vis", today: true,
      desc: "Twee kroketten van Noordzeegarnaal, gefrituurde peterselie, citroen." },
    { id: "tartaar", cat: "voor", name: "Tartaar van rund", price: 17, tag: "vlees",
      desc: "Met de hand gesneden, kappertjes, sjalot, toast van brioche." },
    { id: "prei", cat: "voor", name: "Gebrande prei met hazelnoot", price: 13, tag: "veg",
      desc: "Vinaigrette van bruine boter, geroosterde hazelnoot, gepocheerd ei." },
    { id: "forel", cat: "voor", name: "Gerookte forel, mierikswortel", price: 15, tag: "vis",
      desc: "Lauwwarm gerookt, crème van mierikswortel, jong bietenblad." },
    { id: "steak", cat: "hoofd", name: "Steak-frites Meridiaan", price: 29, tag: "vlees", chef: true, today: true,
      desc: "Entrecote van Belgisch wit-blauw, béarnaise aan tafel bijgeschept, dubbel gebakken frieten." },
    { id: "sole", cat: "hoofd", name: "Sole meunière", price: 38, tag: "vis", today: true,
      desc: "Hele tong uit de pan, bruine boter, citroen, peterselie. Met puree of frieten." },
    { id: "volauvent", cat: "hoofd", name: "Vol-au-vent van hoevekip", price: 24, tag: "vlees",
      desc: "Met champignons, gehaktballetjes en bladerdeeg, zoals het hoort." },
    { id: "risotto", cat: "hoofd", name: "Risotto van pompoen en salie", price: 22, tag: "veg", today: true,
      desc: "Geroosterde pompoen, gebakken salie, oude Brugge kaas." },
    { id: "moules", cat: "hoofd", name: "Moules-frites van het seizoen", price: 27, tag: "vis", today: true,
      desc: "Zeeuwse mosselen in witte wijn, selder en ui, met frieten en mayonaise." },
    { id: "canard", cat: "hoofd", name: "Confit de canard", price: 28, tag: "vlees",
      desc: "Gekonfijte eendenbout, gratin dauphinois, jus van sinaasappel." },
    { id: "bloemkool", cat: "hoofd", name: "Gegrilde bloemkool, romesco", price: 21, tag: "veg",
      desc: "Hele bloemkool van de grill, romesco van paprika en amandel, kruidensalade." },
    { id: "brulee", cat: "na", name: "Crème brûlée", price: 10, tag: "veg",
      desc: "Vanille uit Madagaskar, aan tafel gebrand." },
    { id: "dame", cat: "na", name: "Dame blanche", price: 9, tag: "veg",
      desc: "Vanille-ijs, warme chocoladesaus van Callebaut, slagroom." },
    { id: "tatin", cat: "na", name: "Tarte tatin", price: 11, tag: "veg", today: true,
      desc: "Voor twee personen, met crème fraîche. Reken twintig minuten." },
    { id: "kaas", cat: "na", name: "Kaasplank", price: 14, tag: "veg",
      desc: "Drie Belgische kazen, notenbrood, vijgencompote." }
  ];

  /* ---------- Hulpjes ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  M.esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; });
  };
  M.cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  M.toMin = function (hhmm) { var p = hhmm.split(":"); return (+p[0]) * 60 + (+p[1]); };
  M.fromMin = function (m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); };
  M.minutesOf = function (d) { return d.getHours() * 60 + d.getMinutes(); };
  M.sameDay = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
  M.isoDate = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  M.parseIso = function (s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  M.fmtDate = function (d) {
    return new Intl.DateTimeFormat("nl-BE", { weekday: "long", day: "numeric", month: "long" }).format(d);
  };
  M.fmtTime = function (d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); };

  /* De demo kan een vast tijdstip krijgen via ?now=2026-10-14T19:05 (handig om de open-toestand te tonen). */
  M.now = function () {
    var q = new URLSearchParams(window.location.search).get("now");
    var d = q ? new Date(q) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  };

  M.dayHours = function (d) { return M.HOURS[d.getDay()]; };
  M.nextOpening = function (from) {
    for (var i = 1; i <= 7; i++) {
      var d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
      if (M.HOURS[d.getDay()]) return { date: d, hours: M.HOURS[d.getDay()] };
    }
    return null;
  };
  M.status = function (now) {
    var h = M.dayHours(now), mins = M.minutesOf(now);
    if (h && mins >= M.toMin(h.open) && mins < M.toMin(h.close)) return { open: true, text: "Nu open · sluit om " + h.close };
    if (h && mins < M.toMin(h.open)) return { open: false, text: "Gesloten · opent vandaag om " + h.open };
    var n = M.nextOpening(now);
    return { open: false, text: "Gesloten · opent " + M.DAYS_SHORT[n.date.getDay()] + " om " + n.hours.open };
  };
  /* Tijdsloten per dag: middag tot 13:30, avond vanaf 18:00 tot anderhalf uur voor sluiting. */
  M.slots = function (date, now) {
    var h = M.dayHours(date);
    if (!h) return null;
    var isToday = M.sameDay(date, now), nowMin = M.minutesOf(now);
    var out = { lunch: [], dinner: [] }, m;
    function slot(min) { return { value: M.fromMin(min), past: isToday && min < nowMin + 30 }; }
    for (m = M.toMin(h.open); m <= 13 * 60 + 30; m += 30) out.lunch.push(slot(m));
    for (m = 18 * 60; m <= M.toMin(h.close) - M.LAST_SEATING; m += 30) out.dinner.push(slot(m));
    return out;
  };
  M.price = function (n) { return "€ " + n; };
  /* Scrollt naar een element, via Lenis als dat actief is. Berekent de positie zelf,
     zodat een net gewijzigde lay-out (verborgen formulier) geen verouderde waarde gebruikt. */
  M.scrollToEl = function (el, offset) {
    var y = Math.max(0, el.getBoundingClientRect().top + window.scrollY + (offset || 0));
    if (M.lenis) M.lenis.scrollTo(y, { force: true });
    else window.scrollTo({ top: y, behavior: M.reduced ? "auto" : "smooth" });
  };

  /* ---------- Status in de hero en footer ---------- */
  function renderStatus() {
    var el = document.getElementById("status");
    if (!el) return;
    var s = M.status(M.now());
    el.querySelector(".status-text").textContent = s.text;
    el.classList.toggle("is-open", s.open);
    var today = String(M.now().getDay());
    document.querySelectorAll("#hours-grid [data-days]").forEach(function (row) {
      row.classList.toggle("is-today", row.getAttribute("data-days").split(" ").indexOf(today) > -1);
    });
  }

  /* ---------- Marquee met de gerechten van vandaag ---------- */
  function renderMarquee() {
    var track = document.querySelector("[data-marquee]");
    if (!track) return;
    var items = ["Vandaag op de kaart"].concat(M.MENU.filter(function (d) { return d.today; }).map(function (d) { return d.name; }));
    var html = items.map(function (t, i) {
      return '<span class="marquee-item' + (i === 0 ? " is-label" : "") + '">' + M.esc(t) + "</span>";
    }).join("");
    track.innerHTML = '<div class="marquee-group">' + html + "</div>" +
      (M.reduced ? "" : '<div class="marquee-group" aria-hidden="true">' + html + "</div>");
  }

  /* ---------- Zonnestralen in de hero (art-deco sunburst) ---------- */
  function renderSunburst() {
    var g = document.querySelector("[data-rays]");
    if (!g) return;
    var cx = 800, cy = 800, r = 1000, n = 48, parts = [];
    for (var i = 0; i <= n; i++) {
      var a = Math.PI * i / n;
      parts.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(a) * r).toFixed(1) + '" y2="' + (cy - Math.sin(a) * r).toFixed(1) + '"/>');
    }
    [240, 400, 580].forEach(function (rr) {
      parts.push('<path d="M' + (cx - rr) + " " + cy + "A" + rr + " " + rr + " 0 0 1 " + (cx + rr) + " " + cy + '"/>');
    });
    g.innerHTML = parts.join("");
  }

  /* ---------- De kaart ---------- */
  var currentFilter = "alles";
  function dishHTML(d) {
    return '<li class="dish' + (d.chef ? " is-chef" : "") + '" data-id="' + d.id + '">' +
      '<button type="button" class="dish-btn" aria-expanded="false" aria-controls="desc-' + d.id + '">' +
        '<span class="dish-title"><span class="dish-name">' + M.esc(d.name) + "</span>" +
          (d.chef ? '<span class="chef-badge">Chef’s keuze</span>' : "") +
        "</span>" +
        '<span class="dish-leader" aria-hidden="true"></span>' +
        '<span class="dish-price">' +
          (d.tag === "veg" ? '<span class="tag-v" role="img" aria-label="vegetarisch">V</span>' : "") +
          "<span>" + M.price(d.price) + "</span></span>" +
      "</button>" +
      '<div class="dish-desc" id="desc-' + d.id + '"><p>' + M.esc(d.desc) + "</p></div>" +
    "</li>";
  }
  function renderMenu(filter, animate) {
    currentFilter = filter;
    document.querySelectorAll("[data-menu] .menu-col").forEach(function (col) {
      var cat = col.getAttribute("data-cat");
      var items = M.MENU.filter(function (d) { return d.cat === cat && (filter === "alles" || d.tag === filter); });
      col.querySelector(".dishes").innerHTML = items.map(dishHTML).join("");
      col.querySelector(".empty").hidden = items.length > 0;
    });
    if (animate && window.gsap && !M.reduced) {
      window.gsap.fromTo("[data-menu] .dish", { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: .5, stagger: .035, ease: "power2.out", overwrite: true, clearProps: "transform" });
    }
  }
  function initMenu() {
    var grid = document.querySelector("[data-menu]");
    if (!grid) return;
    renderMenu("alles", false);
    grid.addEventListener("click", function (e) {
      var btn = e.target.closest(".dish-btn");
      if (!btn) return;
      var li = btn.closest(".dish");
      var open = !li.classList.contains("is-open");
      li.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
    document.querySelectorAll(".chip[data-filter]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        if (chip.getAttribute("data-filter") === currentFilter) return;
        document.querySelectorAll(".chip[data-filter]").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        renderMenu(chip.getAttribute("data-filter"), true);
      });
    });
  }

  /* ---------- Kinetische koppen: woorden apart zetten ---------- */
  function splitKinetic() {
    document.querySelectorAll("[data-kinetic]").forEach(function (el) {
      var text = el.textContent.trim().replace(/\s+/g, " ");
      el.setAttribute("aria-label", text);
      el.innerHTML = text.split(" ").map(function (w) {
        return '<span class="w" aria-hidden="true"><span>' + M.esc(w) + "</span></span>";
      }).join("");
    });
  }

  /* ---------- Header ---------- */
  function initHeader() {
    var top = document.querySelector(".top");
    if (!top) return;
    var update = function () { top.classList.toggle("is-scrolled", window.scrollY > 24); };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ---------- Motion: Lenis, scroll reveals, kinetische koppen ---------- */
  function initMotion() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (!gsap || !ST || M.reduced) return;
    gsap.registerPlugin(ST);

    if (window.Lenis && window.matchMedia("(pointer: fine)").matches) {
      var lenis = new window.Lenis({ lerp: .1 });
      lenis.on("scroll", ST.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      M.lenis = lenis;
    }

    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href").slice(1);
        var target = id && document.getElementById(id);
        if (!target || a.classList.contains("skip")) return;
        e.preventDefault();
        M.scrollToEl(target, -56);
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      });
    });

    document.querySelectorAll("[data-kinetic]").forEach(function (el) {
      var words = el.querySelectorAll(".w > span");
      gsap.set(words, { yPercent: 112, rotate: 7 });
      gsap.to(words, {
        yPercent: 0, rotate: 0, duration: 1, ease: "power3.out", stagger: .07,
        scrollTrigger: { trigger: el, start: "top 86%", once: true }
      });
    });

    var reveals = gsap.utils.toArray("[data-reveal]");
    gsap.set(reveals, { opacity: 0, y: 26 });
    ST.batch(reveals, {
      start: "top 90%", once: true,
      onEnter: function (batch) { gsap.to(batch, { opacity: 1, y: 0, duration: .9, ease: "power3.out", stagger: .09, overwrite: true }); }
    });
    window.addEventListener("load", function () { ST.refresh(); });
  }

  /* ---------- Start ---------- */
  renderStatus();
  renderMarquee();
  renderSunburst();
  initMenu();
  splitKinetic();
  initHeader();
  initMotion();
  window.setInterval(renderStatus, 60000);
})();
