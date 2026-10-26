/* WhatsApp-knop en QR-code (loket 2 of src/rooms/gereedschap.html).
   - The number is normalised the Belgian way (0470 12 34 56 -> 32470123456; +32 and 0032 too);
     the message field is what the customer sends to the business (label 'Dit is wat de klant naar
     jou stuurt', data-voice=customer) and is prefilled by contact-prefill.js from
     gereedschap.html#whatsapp?bericht=... (event 'sts:tool-prefill').
   - Output: the wa.me link, the button markup, a QR canvas (STSTools.qr, local qrcode.min.js) and
     an A6 card canvas (1240 x 1748, 300 dpi) with the button text, the QR, the name of the business
     under the code (STSState) and the number; the credit line (config.credit) is drawn only when the
     checkbox is on, and the checkbox starts off. #wa-a6-mirror holds the card's text for readers and QA.
   - Downloads are PNG data URLs; 'Druk af op A6' prints only the card (STSTools.printBlock, print.css).
   - A hash prefill ('sts:tool-prefill') lands on the loket: the browser never scrolls to '#whatsapp?bericht=',
     so this file scrolls #whatsapp into view, rewrites the hash to #whatsapp and marks the tab. */
(function () {
  var d = document, T = window.STSTools, S = window.STSState, C = window.STS_CONFIG || {};
  var num = d.getElementById("wa-num");
  if (!num || !T) return;
  var $ = function (id) { return d.getElementById(id); };
  var msg = $("wa-msg"), lbl = $("wa-label"), credit = $("wa-credit"), creditTxt = $("wa-credit-txt");
  var link = $("wa-link"), code = $("wa-code"), qr = $("wa-qr"), a6 = $("wa-a6"), mirror = $("wa-a6-mirror");
  var err = $("wa-err"), out = $("wa-out"), hint = $("wa-hint");
  var CREDIT = String(C.credit || "").trim();
  if (creditTxt) creditTxt.textContent = CREDIT || "gemaakt op startec";
  credit.checked = false;   /* opt-in, never remembered */
  if (!CREDIT) credit.closest("label").hidden = true;

  /* 0470 12 34 56 -> 32470123456; +32 470 12 34 56 and 0032 470 12 34 56 give the same */
  function normalise(raw) {
    var v = String(raw).replace(/[^\d+]/g, "");
    if (v.indexOf("+") === 0) v = v.slice(1);
    else if (v.indexOf("00") === 0) v = v.slice(2);
    else if (v.indexOf("0") === 0) v = "32" + v.slice(1);
    return /^\d{9,15}$/.test(v) ? v : "";
  }
  function pretty(n) { return n.indexOf("32") === 0 && n.length === 11 ? "+32 " + n.slice(2, 5) + " " + n.slice(5, 7) + " " + n.slice(7, 9) + " " + n.slice(9) : "+" + n; }
  function zaak() { return S ? S.get().zaak : ""; }
  function label() { return lbl.value.trim() || "Stuur ons een WhatsApp"; }

  /* the A6 card: white, the QR in the middle, the name under the code */
  function wrap(ctx, text, max) {
    var words = text.split(" "), lines = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines.slice(0, 2);
  }
  function drawA6(url, n) {
    var W = 1240, H = 1748, ctx = a6.getContext("2d"), tmp = d.createElement("canvas");
    a6.width = W; a6.height = H;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#16233A"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = "700 72px Panchang, Unbounded, system-ui, sans-serif";
    var head = wrap(ctx, label(), W - 200), y = 220;
    head.forEach(function (l) { ctx.fillText(l, W / 2, y); y += 86; });
    var size = T.qr(tmp, url, { size: 760, quiet: 2 }), top = 400;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, (W - 760) / 2, top, 760, 760);
    var name = zaak(), ny = top + 760 + 120, lines = [];
    ctx.font = "600 60px Panchang, Unbounded, system-ui, sans-serif";
    if (name) { wrap(ctx, name, W - 200).forEach(function (l) { ctx.fillText(l, W / 2, ny); lines.push(l); ny += 74; }); }
    ctx.font = "500 44px 'JetBrains Mono', ui-monospace, monospace"; ctx.fillStyle = "#4d5156";
    ctx.fillText(pretty(n), W / 2, ny + 20);
    var parts = ["Kaartje A6: " + head.join(" "), name ? "Naam: " + name : "", "Nummer: " + pretty(n)];
    if (credit.checked && CREDIT) {
      ctx.font = "500 30px 'JetBrains Mono', ui-monospace, monospace"; ctx.fillStyle = "#9aa0a6";
      ctx.fillText(CREDIT, W / 2, H - 90);
      parts.push("Vermelding: " + CREDIT);
    }
    mirror.textContent = parts.filter(Boolean).join(". ") + ".";
    return size;
  }

  function update() {
    var n = normalise(num.value);
    if (!num.value.trim()) { out.hidden = true; err.hidden = true; hint.hidden = false; return; }
    if (!n) { out.hidden = true; err.hidden = false; hint.hidden = false; return; }
    err.hidden = true; out.hidden = false; hint.hidden = true;
    var text = msg.value.trim(), url = "https://wa.me/" + n + (text ? "?text=" + encodeURIComponent(text) : "");
    link.href = url; link.textContent = url;
    code.textContent = '<a href="' + url + '" target="_blank" rel="noopener" style="display:inline-block;padding:12px 18px;background:#1F7A4A;color:#fff;border-radius:6px;font:600 16px/1.2 system-ui,sans-serif;text-decoration:none">' + label().replace(/</g, "&lt;") + "</a>";
    T.qr(qr, url, { size: 480 });
    draw(url, n);
  }
  function draw(url, n) {
    var fonts = d.fonts && d.fonts.load ? Promise.all([d.fonts.load("700 72px Panchang"), d.fonts.load("500 44px 'JetBrains Mono'")]) : Promise.resolve();
    fonts.then(function () { drawA6(url, n); }, function () { drawA6(url, n); });
  }
  [num, msg, lbl].forEach(function (i) { i.addEventListener("input", update); });
  credit.addEventListener("change", update);
  if (S) S.subscribe(function () { if (!out.hidden) update(); });
  $("wa-copy-link").addEventListener("click", function () { T.copy(link.href, this); });
  $("wa-copy-code").addEventListener("click", function () { T.copy(code.textContent, this); });
  $("wa-download").addEventListener("click", function () { T.download(qr, "whatsapp-qr.png"); });
  $("wa-a6-download").addEventListener("click", function () { T.download(a6, "whatsapp-kaartje-a6.png"); });
  $("wa-a6-print").addEventListener("click", function () { T.printBlock(a6.parentNode, "print-a6"); });
  window.STSWhatsApp = { normalise: normalise };
  update();
  function land() {
    var s = d.getElementById("whatsapp"), tab = d.querySelector('[data-loketten] a[href="#whatsapp"]');
    if (!s) return;
    s.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    if (tab) tab.setAttribute("aria-current", "true");
    try { history.replaceState(history.state, "", location.pathname + location.search + "#whatsapp"); } catch (x) { /* sandbox */ }
  }
  addEventListener("sts:tool-prefill", function (e) { if (e.detail && e.detail.tool === "whatsapp") land(); });
  if (/^#whatsapp\?/.test(location.hash)) land();   /* contact-prefill.js dispatched the event before this file loaded */
})();
