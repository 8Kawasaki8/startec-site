/* The phone sketch of the gevel room: a first sketch of a site for whatever the visitor
   typed, built from STS_PREVIEW (preview-data.js) and the shared record {zaak, sector,
   gemeente, g}. Everything is written with textContent, nothing is sent, no timers.
   API: window.STSPreview.render(container, state, opts) -> container
     container: the .phone-screen element (its closest .phone gets the sector colour --c)
     state:     {zaak, sector, gemeente} (STSState.get() or any object with those keys)
     opts.g:    bitmask of the four switches (STSState.G: bel 1, whatsapp 2, open 4, uren 8;
                default 15 = all on); every block carries data-el and is hidden when its bit is off
     opts.night: true adds the class 'night' (dim screen, outlines on the three .need blocks:
                 Bel, WhatsApp, the hours)
   Reused by werkwijze.html for the old/new gevel; the gevel room (gevel.js) calls it on every
   state change after commit. Every preset line carries the marker 'voorbeeld'; the stars are
   outlined (no filled star without the word 'voorbeeld'). */
(function () {
  var DEFAULT_G = { bel: 1, whatsapp: 2, open: 4, uren: 8 };

  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function attr(el, name, value) { el.setAttribute(name, value); return el; }
  function marker(D) { return h("small", "ps-vb", D.marker); }
  function line(tag, cls, text, D) {
    var el = h(tag, cls, text + " ");
    el.appendChild(marker(D));
    return el;
  }

  function render(container, state, opts) {
    if (!container) return container;
    var D = window.STS_PREVIEW, N = window.STSNames, s = state || {}, o = opts || {};
    if (!D) return container;
    var key = s.sector && D.sectors[s.sector] ? s.sector : "anders", p = D.sectors[key];
    var name = String(s.zaak || "").trim() || "Jouw zaak", gemeente = String(s.gemeente || "").trim() || "Antwerpen";
    var bits = o.g == null ? 15 : (o.g | 0), G = (window.STSState && window.STSState.G) || DEFAULT_G;
    var colour = N ? N.sectorColour(key) : "#36E8FF", bezit = N ? N.bezit(key) : "jouw";
    var frame = container.closest ? container.closest(".phone") : null;
    (frame || container).style.setProperty("--c", colour);
    if (frame) frame.setAttribute("aria-label", "Schets van een site voor " + name + ", voorbeeld");
    container.classList.toggle("night", !!o.night);

    var frag = document.createDocumentFragment();

    /* top bar: initial coin, name, menu lines */
    var bar = h("div", "ps-bar");
    bar.appendChild(h("i", "", name.charAt(0).toUpperCase()));
    bar.appendChild(h("span", "ps-bar-naam", name));
    var menu = attr(h("span", "ps-menu"), "aria-hidden", "true");
    menu.appendChild(h("b")); menu.appendChild(h("b"));
    bar.appendChild(menu);
    frag.appendChild(bar);

    /* hero: status (switch 'open'), the name, the tag line, Bel / WhatsApp / Route */
    var hero = h("div", "ps-hero");
    var status = attr(h("span", "ps-status"), "data-el", "open");
    status.appendChild(h("i")); status.appendChild(document.createTextNode(p.open + " ")); status.appendChild(marker(D));
    hero.appendChild(status);
    hero.appendChild(h("div", "ps-name", name));
    hero.appendChild(line("p", "ps-tag", p.tag, D));
    var ctas = h("div", "ps-ctas");
    ctas.appendChild(attr(h("span", "main need", "Bel"), "data-el", "bel"));
    ctas.appendChild(attr(h("span", "need", "WhatsApp"), "data-el", "whatsapp"));
    ctas.appendChild(h("span", "", D.route));
    hero.appendChild(ctas);
    frag.appendChild(hero);

    /* photo placeholder */
    var foto = h("div", "ps-foto");
    foto.appendChild(line("span", "", p.foto, D));
    frag.appendChild(foto);

    /* address and reviews placeholder (outlined stars) */
    var row = h("div", "ps-row");
    var adres = h("div", "ps-card");
    adres.appendChild(h("span", "label", "Adres"));
    adres.appendChild(line("p", "", p.adres + ", " + gemeente, D));
    row.appendChild(adres);
    var reviews = h("div", "ps-card");
    reviews.appendChild(h("span", "label", "Reviews"));
    reviews.appendChild(attr(h("p", "ps-stars", "☆☆☆☆☆"), "aria-hidden", "true"));
    reviews.appendChild(line("p", "", bezit.charAt(0).toUpperCase() + bezit.slice(1) + " " + D.reviews, D));
    row.appendChild(reviews);
    frag.appendChild(row);

    /* opening hours (switch 'uren') */
    var uren = attr(h("div", "ps-hours need"), "data-el", "uren");
    uren.appendChild(line("span", "label", "Openingsuren", D));
    var grid = h("div");
    p.uren.forEach(function (r) { grid.appendChild(h("span", "", r[0])); grid.appendChild(h("b", "", r[1])); });
    uren.appendChild(grid);
    frag.appendChild(uren);

    /* foot */
    var foot = h("div", "ps-foot");
    foot.appendChild(h("span", "", name));
    foot.appendChild(h("span", "", D.credit));
    frag.appendChild(foot);

    container.replaceChildren(frag);
    container.querySelectorAll("[data-el]").forEach(function (el) {
      var bit = G[el.getAttribute("data-el")] || 0;
      el.hidden = !(bits & bit);
    });
    return container;
  }

  window.STSPreview = { render: render, DEFAULT_G: DEFAULT_G };
})();
