/* Free tools: WhatsApp button + QR code, and a Google result preview. */
(function () {
  function $(id) { return document.getElementById(id); }
  function copy(text, btn) {
    var done = function () { var o = btn.textContent; btn.textContent = "Gekopieerd"; setTimeout(function () { btn.textContent = o; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback() { var t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (e) {} t.remove(); }
  }

  /* ── WhatsApp button & QR ─────────────────────────────── */
  if ($("wa-num")) {
    var num = $("wa-num"), msg = $("wa-msg"), lbl = $("wa-label");
    var link = $("wa-link"), code = $("wa-code"), qr = $("wa-qr"), err = $("wa-err"), out = $("wa-out");

    // Belgian-friendly normalisation: 0470 12 34 56 → 32470123456
    function normalise(raw) {
      var d = String(raw).replace(/[^\d+]/g, "");
      if (d.indexOf("+") === 0) d = d.slice(1);
      else if (d.indexOf("00") === 0) d = d.slice(2);
      else if (d.indexOf("0") === 0) d = "32" + d.slice(1);
      return /^\d{9,15}$/.test(d) ? d : "";
    }
    function drawQR(text) {
      var q = qrcode(0, "M"); q.addData(text); q.make();
      var n = q.getModuleCount(), quiet = 4, scale = Math.max(4, Math.floor(480 / (n + quiet * 2)));
      var size = (n + quiet * 2) * scale, ctx = qr.getContext("2d");
      qr.width = size; qr.height = size;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#16233A";
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++)
        if (q.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    }
    var hint = $("wa-hint");
    function update() {
      var n = normalise(num.value);
      if (!num.value.trim()) { out.hidden = true; err.hidden = true; hint.hidden = false; return; }
      if (!n) { out.hidden = true; err.hidden = false; hint.hidden = false; return; }
      err.hidden = true; out.hidden = false; hint.hidden = true;
      var url = "https://wa.me/" + n + (msg.value.trim() ? "?text=" + encodeURIComponent(msg.value.trim()) : "");
      link.href = url; link.textContent = url;
      var label = (lbl.value.trim() || "Stuur ons een WhatsApp").replace(/</g, "&lt;");
      code.textContent = '<a href="' + url + '" target="_blank" rel="noopener" style="display:inline-block;padding:12px 18px;background:#1F7A4A;color:#fff;border-radius:6px;font:600 16px/1.2 system-ui,sans-serif;text-decoration:none">' + label + "</a>";
      drawQR(url);
    }
    [num, msg, lbl].forEach(function (i) { i.addEventListener("input", update); });
    $("wa-copy-link").addEventListener("click", function () { copy(link.href, this); });
    $("wa-copy-code").addEventListener("click", function () { copy(code.textContent, this); });
    $("wa-download").addEventListener("click", function () {
      var a = document.createElement("a"); a.href = qr.toDataURL("image/png"); a.download = "whatsapp-qr.png"; a.click();
    });
    update();
  }

  /* ── Zichtbaarheidscheck: six questions → score + three steps ── */
  if ($("zc")) {
    var zc = $("zc"), TIPS = {
      q1: "Claim je Google-bedrijfsprofiel. Het is wat klanten als eerste zien, nog voor je website.",
      q2: "Zet overal dezelfde openingsuren, ook voor feestdagen. Een klant die voor een gesloten deur staat, komt niet terug.",
      q3: "Zet een bel- en WhatsApp-knop bovenaan je site. Eén tik, geen nummer overtypen.",
      q4: "Laat je site op een gsm meten. Meer dan drie seconden laden kost je de helft van je bezoekers.",
      q5: "Beantwoord elke review binnen 24 uur, ook de slechte. Lezers kijken naar je reactie, niet naar de score.",
      q6: "Plaats elke maand een recente foto van je zaak of je werk. Oude foto's wekken de indruk dat je dicht bent."
    };
    zc.addEventListener("submit", function (e) {
      e.preventDefault();
      var keys = Object.keys(TIPS), vals = {}, missing = false;
      keys.forEach(function (k) { var r = zc.querySelector('input[name=' + k + ']:checked'); if (!r) missing = true; else vals[k] = +r.value; });
      $("zc-err").hidden = !missing;
      if (missing) return;
      var score = Math.round(keys.reduce(function (s, k) { return s + vals[k]; }, 0) / keys.length);
      var title, text;
      if (score < 40) { title = "Onzichtbaar voor wie 's avonds zoekt."; text = "Klanten vinden je niet, of vinden verkeerde informatie. Het goede nieuws: dit is in een paar dagen rechtgezet."; }
      else if (score < 75) { title = "Zichtbaar, maar je laat klanten liggen."; text = "De basis staat er. Een paar gerichte stappen maken het verschil tussen gevonden worden en gebeld worden."; }
      else { title = "Sterk. Nu is het tijd voor automatisering."; text = "Je bent vindbaar en bereikbaar. De volgende winst zit in werk dat vanzelf gebeurt: antwoorden, reservaties, offertes."; }
      var worst = keys.slice().sort(function (a, b) { return vals[a] - vals[b]; }).slice(0, 3);
      $("zc-num").textContent = score; $("zc-title").textContent = title; $("zc-text").textContent = text;
      $("zc-tips").innerHTML = worst.map(function (k) { return "<li>" + TIPS[k] + "</li>"; }).join("");
      $("zc-cta").href = "index.html?onderwerp=" + encodeURIComponent("Zichtbaarheidscheck, score " + score + " op 100") + "#contact";
      $("zc-res").hidden = false; $("zc-hint").hidden = true;
      requestAnimationFrame(function () { $("zc-arc").style.strokeDashoffset = (326.7 * (1 - score / 100)).toFixed(1); });
      if (innerWidth < 860) $("zc-res").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ── Google result preview ────────────────────────────── */
  if ($("sp-title")) {
    var tIn = $("sp-title"), dIn = $("sp-desc"), uIn = $("sp-url");
    var meas = document.createElement("canvas").getContext("2d");
    // Google cuts by pixel width, not characters. These widths are approximations.
    function cut(text, font, max) {
      meas.font = font;
      if (meas.measureText(text).width <= max) return { text: text, cut: false };
      var s = text;
      while (s.length && meas.measureText(s + " …").width > max) s = s.slice(0, -1);
      return { text: s.replace(/\s+\S*$/, "") + " …", cut: true };
    }
    function crumbs(raw) {
      try {
        var u = new URL(/^https?:\/\//.test(raw) ? raw : "https://" + raw);
        var parts = u.pathname.split("/").filter(Boolean);
        return { host: u.hostname.replace(/^www\./, ""), path: parts.length ? " › " + parts.join(" › ") : "" };
      } catch (e) { return { host: raw || "jouwzaak.be", path: "" }; }
    }
    function judge(len, lo, hi, cutoff) {
      if (!len) return "Nog leeg.";
      if (cutoff) return "Te lang: Google kapt dit af.";
      if (len < lo) return "Kort — hier is nog ruimte voor wat je doet of waar je zit.";
      if (len > hi) return "Aan de lange kant.";
      return "Goede lengte.";
    }
    function update() {
      var c = crumbs(uIn.value.trim());
      $("sp-host").textContent = c.host;
      $("sp-crumb").textContent = c.host + c.path;
      $("sp-fav").textContent = (c.host[0] || "?").toUpperCase();
      var t = cut(tIn.value.trim() || "Jouw paginatitel", "20px Arial", 600);
      var d = cut(dIn.value.trim() || "Je beschrijving verschijnt hier.", "14px Arial", 920);
      $("sp-out-title").textContent = t.text;
      $("sp-out-desc").textContent = d.text;
      var tl = tIn.value.trim().length, dl = dIn.value.trim().length;
      $("sp-t-meter").textContent = tl + " tekens · " + judge(tl, 30, 60, tIn.value.trim() && t.cut);
      $("sp-d-meter").textContent = dl + " tekens · " + judge(dl, 70, 160, dIn.value.trim() && d.cut);
    }
    [tIn, dIn, uIn].forEach(function (i) { i.addEventListener("input", update); });
    update();
  }
})();
