/* Kaartje voor aan de toog: the generator for Snymis, mounted only when location.search holds
   toog=1 (gereedschap.html?toog=1), from <template data-toog-tpl> in src/rooms/gereedschap.html,
   after the public loketten and outside their tabs, with a one-line 'intern' label.
   - Fields naam, sector, gemeente (not the shared record: the shop's name must not land in
     Snymis' own sts-zaak). The QR (STSTools.qr, local qrcode.min.js) carries
     {root}index.html?zaak=..&sector=..&gemeente=..#gevel, empty fields left out, so scanning lights
     the sign with that name and the gevel room shows the card variant of its honesty sentence.
   - The card has a front (name, QR) and a back with the printed line 'We gebruikten enkel je naam.
     De rest typ je zelf.'; 'Druk af' prints only the card, two A6 pages (print.css, html.print-toog).
   - window.STSToog.debug.lastQrText is the string last encoded, for QA. */
(function () {
  if (!/[?&]toog=1\b/.test(location.search)) return;
  var d = document, T = window.STSTools, N = window.STSNames, C = window.STS_CONFIG || {};
  var tpl = d.querySelector("[data-toog-tpl]"), kamer = tpl && tpl.parentNode;
  if (!tpl || !T || !("content" in tpl)) return;
  var node = d.importNode(tpl.content, true), sec = node.querySelector("#toog");
  kamer.insertBefore(node, tpl);
  var form = sec.querySelector("[data-toog-form]"), kaart = sec.querySelector("[data-toog-kaart]"), qr = sec.querySelector("[data-toog-qr]");
  var naamEl = sec.querySelector("[data-toog-naam]"), subEl = sec.querySelector("[data-toog-sub]"), urlEl = sec.querySelector("[data-toog-url]"), kortEl = sec.querySelector("[data-toog-url-kort]"), mailEl = sec.querySelector("[data-toog-mail]");
  var debug = { lastQrText: "" };
  window.STSToog = { debug: debug, url: url };

  /* the sector list and the gemeenten: hydrate.js ran before this clone existed */
  var sel = form.elements.sector;
  var leeg = d.createElement("option"); leeg.value = ""; leeg.textContent = "(geen)"; sel.appendChild(leeg);
  (N ? N.SECTORS : []).forEach(function (s) { var o = d.createElement("option"); o.value = s.id; o.textContent = s.label; sel.appendChild(o); });
  if (N) N.fillDatalist(sec.querySelector("#toog-gemeenten"));
  if (mailEl) mailEl.textContent = C.email ? "Vragen: " + C.email : "";

  function values() {
    var z = N ? N.sanitise(form.elements.zaak.value) : form.elements.zaak.value.trim().slice(0, 40);
    var s = N ? N.sector(form.elements.sector.value) : form.elements.sector.value;
    var g = N ? N.gemeente(form.elements.gemeente.value) : form.elements.gemeente.value.trim().slice(0, 30);
    return { zaak: z, sector: s, gemeente: g };
  }
  function url(v) {
    v = v || values();
    var q = [];
    if (v.zaak) q.push("zaak=" + encodeURIComponent(v.zaak));
    if (v.sector) q.push("sector=" + encodeURIComponent(v.sector));
    if (v.gemeente) q.push("gemeente=" + encodeURIComponent(v.gemeente));
    return T.root() + "index.html" + (q.length ? "?" + q.join("&") : "") + "#gevel";
  }
  function render() {
    var v = values(), u = url(v), label = N && v.sector ? N.sectorLabel(v.sector) : "";
    naamEl.textContent = v.zaak || "Jouw zaak";
    subEl.textContent = [label, v.gemeente || "Antwerpen"].filter(Boolean).join(" · ");
    kaart.style.setProperty("--c", N ? N.sectorColour(v.sector) : "#36E8FF");
    T.qr(qr, u, { size: 600, quiet: 3 });
    debug.lastQrText = u;
    urlEl.textContent = u;
    kortEl.textContent = T.root().replace(/^https?:\/\//, "");
  }
  form.addEventListener("input", render);
  form.addEventListener("change", render);
  form.addEventListener("submit", function (e) { e.preventDefault(); render(); });
  sec.querySelector("[data-toog-print]").addEventListener("click", function () { render(); T.printBlock(kaart, "print-toog"); });
  sec.querySelector("[data-toog-png]").addEventListener("click", function () { render(); T.download(qr, "toog-qr-" + (T.slug(values().zaak) || "kaartje") + ".png"); });
  render();
})();
