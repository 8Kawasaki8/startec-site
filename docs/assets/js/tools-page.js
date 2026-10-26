/* Gereedschap: page chrome and the helpers every loket shares (loads before them).
   - window.STSTools: root() (the public address of the site from <link rel=canonical>, else the
     folder of the stylesheet), copy(text, button), status(el, text), slug(name), qr(canvas, text,
     opts) (the local qrcode.min.js, modules as filled rectangles, quiet zone 4, no request),
     download(canvas, name) and printBlock(el, cls): moves the block to <body> under html.<cls>,
     opens the print dialog and puts it back on afterprint; print.css shows only that block.
   - The loketten tabs ([data-loketten] a): plain anchors to the stacked sections; one
     IntersectionObserver gives the loket at the viewport's midline aria-current, disconnected on
     pagehide. Nothing is hidden behind a tab.
   - ?print: the one-pager for boekhouders and adviseurs ([data-eenpager], src/pages/gereedschap.html):
     html.is-eenpager hides the loketten and shows the sheet with a QR to gereedschap.html; nothing
     prints by itself. */
(function () {
  var d = document;

  function root() {
    var c = d.querySelector('link[rel="canonical"]'), href = c ? c.getAttribute("href") || "" : "";
    if (!/^https?:/.test(href)) { var l = d.querySelector('link[href*="assets/css/"]'); href = l ? l.href.slice(0, l.href.indexOf("assets/")) : location.href; }
    return href.replace(/[?#].*$/, "").replace(/[^\/]*$/, "");
  }
  function copy(text, btn) {
    var done = function () { var o = btn.textContent; btn.textContent = "Gekopieerd"; setTimeout(function () { btn.textContent = o; }, 1600); };
    var fallback = function () { var t = d.createElement("textarea"); t.value = text; d.body.appendChild(t); t.select(); try { d.execCommand("copy"); done(); } catch (e) { /* no clipboard */ } t.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  function status(el, text) { if (!el) return; el.hidden = !text; el.textContent = text || ""; }
  function slug(name) {
    return String(name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 40);
  }
  /* qr(canvas, text, {size, dark, light, quiet, level}) -> the pixel size drawn (modules scaled to whole pixels). */
  function qr(canvas, text, o) {
    o = o || {};
    if (typeof window.qrcode !== "function") return 0;
    var q = window.qrcode(0, o.level || "M"); q.addData(String(text)); q.make();
    var n = q.getModuleCount(), quiet = o.quiet == null ? 4 : o.quiet, scale = Math.max(2, Math.floor((o.size || 480) / (n + quiet * 2)));
    var size = (n + quiet * 2) * scale, ctx = canvas.getContext("2d");
    canvas.width = size; canvas.height = size;
    ctx.fillStyle = o.light || "#ffffff"; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = o.dark || "#16233A";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    return size;
  }
  function download(canvas, name) {
    var a = d.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = name; a.rel = "noopener";
    d.body.appendChild(a); a.click(); a.remove();
  }
  function printBlock(el, cls) {
    var home = el.parentNode, next = el.nextSibling, h = d.documentElement;
    function back() { h.classList.remove(cls); if (el.parentNode === d.body) home.insertBefore(el, next); removeEventListener("afterprint", back); }
    d.body.appendChild(el); h.classList.add(cls);
    addEventListener("afterprint", back);
    try { window.print(); } catch (e) { back(); }
  }
  window.STSTools = { root: root, copy: copy, status: status, slug: slug, qr: qr, download: download, printBlock: printBlock };

  /* the tabs */
  var nav = d.querySelector("[data-loketten]"), links = nav ? [].slice.call(nav.querySelectorAll('a[href^="#"]')) : [];
  var lokets = links.map(function (a) { return d.getElementById(a.getAttribute("href").slice(1)); }).filter(Boolean);
  if (lokets.length && "IntersectionObserver" in window) {
    var mark = function () {
      var mid = innerHeight / 2, hit = null;
      lokets.forEach(function (el) { var r = el.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) hit = el; });
      links.forEach(function (a) {
        if (hit && a.getAttribute("href") === "#" + hit.id) { a.setAttribute("aria-current", "true"); if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, a.offsetLeft - 12); }
        else a.removeAttribute("aria-current");
      });
    };
    var io = new IntersectionObserver(mark, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] });
    lokets.forEach(function (el) { io.observe(el); });
    addEventListener("pagehide", function () { io.disconnect(); }, { once: true });
  }

  /* ?print: the one-pager */
  var een = d.querySelector("[data-eenpager]");
  if (een && /[?&]print\b/.test(location.search)) {
    d.documentElement.classList.add("is-eenpager");
    een.hidden = false;
    var url = root() + "gereedschap.html", c = een.querySelector("canvas");
    if (c) qr(c, url, { size: 360 });
    een.querySelectorAll("[data-eenpager-url]").forEach(function (el) { el.textContent = url.replace(/^https?:\/\//, ""); });
    var b = een.querySelector("[data-eenpager-print]");
    if (b) b.addEventListener("click", function () { try { window.print(); } catch (e) { /* no print here */ } });
  }
})();
