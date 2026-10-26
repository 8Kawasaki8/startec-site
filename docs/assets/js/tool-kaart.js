/* The score card (loket 1 of src/rooms/gereedschap.html): a 1080 x 1080 PNG drawn on a canvas
   after document.fonts.load, with the name of the business (STSState, 'Mijn zaak' without one),
   the ring and the score, the three steps, the word 'zelfinschatting' and the address of the site.
   Made on click only ('Maak mijn scorekaart'); the result goes into <img id=kaart-img> as a data
   URL, the download link gets the same URL and #kaart-mirror carries the card's text. */
(function () {
  var d = document, S = window.STSState, T = window.STSTools, Ch = window.STSCheck;
  var btn = d.getElementById("kaart-maak"), out = d.getElementById("kaart-out"), img = d.getElementById("kaart-img");
  var dl = d.getElementById("kaart-download"), mirror = d.getElementById("kaart-mirror");
  if (!btn || !out || !img || !dl || !mirror || !T) return;
  var W = 1080, CYAN = "#36E8FF", INK = "#F2F5FF", INK2 = "rgba(242,245,255,.7)", INK3 = "rgba(242,245,255,.46)";
  var DISPLAY = "Panchang, Unbounded, system-ui, sans-serif", SANS = "Switzer, system-ui, sans-serif", MONO = "'JetBrains Mono', ui-monospace, monospace";

  function wrap(ctx, text, max, maxLines) {
    var words = String(text).split(" "), lines = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + " …"; }
    return lines;
  }
  function mono(ctx, size) { ctx.font = "500 " + size + "px " + MONO; if ("letterSpacing" in ctx) ctx.letterSpacing = "0.14em"; }
  function plain(ctx) { if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"; }

  function draw(last) {
    var c = d.createElement("canvas"), ctx = c.getContext("2d"), s = S ? S.get() : { zaak: "" }, name = s.zaak || "Mijn zaak";
    var url = T.root().replace(/^https?:\/\//, "") + "gereedschap.html", y;
    c.width = W; c.height = W;
    ctx.fillStyle = "#06080F"; ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = "#0B0F1A"; ctx.fillRect(0, 0, W, 8); ctx.fillStyle = CYAN; ctx.fillRect(0, 0, 220, 8);
    /* label and name */
    mono(ctx, 24); ctx.fillStyle = INK3; ctx.textBaseline = "alphabetic"; ctx.fillText("ZELFINSCHATTING · ZICHTBAARHEIDSCHECK", 72, 110); plain(ctx);
    ctx.font = "700 60px " + DISPLAY; ctx.fillStyle = INK; y = 196;
    wrap(ctx, name, W - 144, 2).forEach(function (l) { ctx.fillText(l, 72, y); y += 70; });
    /* ring */
    var cx = 300, cy = 620, r = 168, a0 = -Math.PI / 2;
    ctx.lineWidth = 26; ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(242,245,255,.12)"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (last.score > 0) { ctx.strokeStyle = CYAN; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + Math.PI * 2 * last.score / 100); ctx.stroke(); }
    ctx.textAlign = "center"; ctx.font = "700 128px " + DISPLAY; ctx.fillStyle = INK; ctx.fillText(String(last.score), cx, cy + 44);
    mono(ctx, 22); ctx.fillStyle = INK3; ctx.fillText("OP 100", cx, cy + 92); plain(ctx);
    ctx.textAlign = "left";
    /* the three steps */
    mono(ctx, 22); ctx.fillStyle = INK3; ctx.fillText("BEGIN HIERMEE", 560, 400); plain(ctx);
    ctx.font = "400 27px " + SANS; y = 456;
    (last.tips.length ? last.tips : ["Vul de zes vragen in op de site; dan staan je drie stappen hier."]).forEach(function (t, i) {
      ctx.fillStyle = CYAN; ctx.font = "700 27px " + DISPLAY; ctx.fillText(String(i + 1), 560, y);
      ctx.fillStyle = INK2; ctx.font = "400 27px " + SANS;
      wrap(ctx, t, 420, 4).forEach(function (l) { ctx.fillText(l, 604, y); y += 36; });
      y += 26;
    });
    /* foot */
    ctx.fillStyle = "rgba(242,245,255,.14)"; ctx.fillRect(72, 936, W - 144, 1);
    mono(ctx, 24); ctx.fillStyle = INK; ctx.fillText(url, 72, 990); plain(ctx);
    ctx.font = "400 22px " + SANS; ctx.fillStyle = INK3; ctx.fillText("Zelfinschatting: wat de uitbater zelf invulde, geen meting. Star.Tec.Solutions, Antwerpen.", 72, 1030);
    return { url: c.toDataURL("image/png"), text: "Scorekaart (zelfinschatting) van " + name + ": " + last.score + " op 100. Begin hiermee: " + last.tips.map(function (t, i) { return (i + 1) + ". " + t; }).join(" ") + " " + url };
  }

  function make() {
    var last = Ch && Ch.last;
    if (!last) return;
    btn.disabled = true;
    var wanted = ["700 60px Panchang", "400 27px Switzer", "500 24px 'JetBrains Mono'"];
    var ready = d.fonts && d.fonts.load ? Promise.all(wanted.map(function (f) { return d.fonts.load(f); })) : Promise.resolve();
    ready.then(null, function () { /* a font failed: the system fallback draws */ }).then(function () {
      var card = draw(last), s = S ? S.get() : { zaak: "" };
      img.src = card.url; img.alt = "Scorekaart van " + (s.zaak || "mijn zaak") + ", zelfinschatting: " + last.score + " op 100";
      dl.href = card.url; dl.download = "scorekaart-" + (T.slug(s.zaak) || "zichtbaarheid") + ".png";
      mirror.textContent = card.text;
      out.hidden = false; btn.disabled = false;
      btn.textContent = "Maak de scorekaart opnieuw";
      window.STSKaart = { lastDataUrl: card.url, lastText: card.text };
    });
  }
  btn.addEventListener("click", make);
  addEventListener("sts:score", function () { if (!out.hidden) make(); });
})();
