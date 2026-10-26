"""Helpers for scripts/build.py, stdlib only: front matter, the Uithangbord (doors), rooms,
redirect stubs, OG and JSON-LD markup, inline SVG, link prefixing, data copies and the
sitemap (the wijk pages live in buildwijk.py, WP-13). build.py owns the page loop and the command line; nothing here
reads argv or prints."""
import datetime, json, pathlib, re, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "src", ROOT / "docs"

# The Uithangbord: five doors in the buyer's words plus the one action.
# (href from the site root, label, id, short label for the phone dock below 900 px)
DOORS = [
    ("index.html#gevel", "Jouw gevel", "gevel", "Gevel"),
    ("index.html#telefoon", "De telefoon om 19 u", "telefoon", "Telefoon"),
    ("simulatie.html", "Doorlichting", "simulatie", "Doorlichting"),
    ("gereedschap.html", "Gereedschap", "gereedschap", "Gereedschap"),
    ("werkwijze.html", "Hoe wij werken", "werkwijze", "Werkwijze"),
]
ACTION = ("index.html#bericht", "Bericht aan Snymis", "bericht", "Bericht")
# ScrollTrigger and Lenis stay in docs/assets/vendor for the demo sites; no STS page loads them.
# GSAP only where a timeline exists: index.html, simulatie.html and dev/scene.html declare 'vendor: gsap.min'.
VENDOR_DEFAULT = ""
MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"]


def dutch_date(d):
    return "%d %s %d" % (d.day, MONTHS[d.month - 1], d.year)


def front_matter(text):
    """The HTML comment at the top of a page: 'key: value' lines. Returns (meta, body)."""
    m = re.match(r"\s*<!--(.*?)-->", text, re.S)
    meta = {}
    for line in (m.group(1) if m else "").strip().splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, (text[m.end():] if m else text)


def page_date(meta, today):
    """'updated: YYYY-MM-DD' is the date a page shows and reports; the build date only when it is absent."""
    u = meta.get("updated")
    if not u:
        return today
    try:
        return datetime.date.fromisoformat(u)
    except ValueError:
        raise SystemExit("front matter 'updated' must be YYYY-MM-DD, got %r" % u)


def door_href(href, slug):
    """Same-page doors become plain anchors on index; every other page keeps the full address."""
    if slug == "index" and href.startswith("index.html#"):
        return href[len("index.html"):]
    return href


def is_current(door, slug, meta):
    """aria-current: the door named by 'nav:' in the front matter, or the door whose page this is (no hash)."""
    href, did = door[0], door[2]
    page, _, frag = href.partition("#")
    return did == meta.get("nav") or (not frag and page == slug + ".html")


def door_label(label, kort):
    """The full label, or (strip) the full one plus the short one; uithangbord.css shows one of the two."""
    return '<span class="ub-lang">%s</span><span class="ub-kort">%s</span>' % (label, kort) if kort else label


def render_doors(doors, slug, meta, indent="      ", kort=False):
    """<li><a> rows for a door list, with aria-current="page" on the door the visitor is behind.
    kort=True (the strip) also renders the short dock label; the footer keeps the full words."""
    return "\n".join('%s<li><a href="%s"%s>%s</a></li>' % (indent, door_href(h, slug), ' aria-current="page"' if is_current(door, slug, meta) else "", door_label(l, k if kort else ""))
                     for door in doors for h, l, _, k in [door])


def render_action(slug, meta):
    """The one action of the strip, as a link (the prefill contract of WP-02 hangs on the room, not here)."""
    h, label, _, kort = ACTION
    return '<a class="pill" href="%s"%s>%s</a>' % (door_href(h, slug), ' aria-current="page"' if is_current(ACTION, slug, meta) else "", door_label(label, kort))


def rooms_html(meta):
    """'rooms: a b c' -> src/rooms/a.html ... each wrapped in <section id=a data-room>, in that order."""
    parts = []
    for name in meta.get("rooms", "").split():
        f = SRC / "rooms" / (name + ".html")
        if not f.is_file():
            raise SystemExit("room %r listed in front matter but src/rooms/%s.html does not exist" % (name, name))
        parts.append('<section id="%s" data-room>\n%s\n</section>' % (name, f.read_text(encoding="utf-8").strip()))
    return "\n\n".join(parts)


def redirect_stub(target, meta, base, up):
    """A 20-line page for an address that moved: meta refresh 0, canonical to the target, a visible link
    and a short script that carries ?query and #hash along (the visitor's own hash wins over the target's)."""
    href = up + target
    label = next((d[1] for d in DOORS + [ACTION] if d[0].partition("#")[0] == target.partition("#")[0]), target)   # the door of the landing page
    return "\n".join([
        '<!doctype html><html lang="nl-BE">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        "<title>%s</title>" % meta["title"],
        '<meta name="description" content="%s">' % meta["description"],
        '<meta name="robots" content="noindex">',
        '<meta http-equiv="refresh" content="0; url=%s">' % href,
        '<link rel="canonical" href="%s">' % ((base + target) if base else href),
        "<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#06080F;color:#F2F5FF;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:16px}a{color:#36E8FF}</style>",
        "</head>",
        "<body>",
        '<main><h1>Deze pagina is verhuisd</h1><p>Je gaat meteen door naar <a href="%s">%s</a>.</p></main>' % (href, label),
        "<script>",
        "(function () {",
        '  var t = "%s", i = t.indexOf("#"), p = i < 0 ? t : t.slice(0, i), h = i < 0 ? "" : t.slice(i);' % href,
        '  var q = location.search.replace(/^\\?/, ""), u = p + (q ? (p.indexOf("?") < 0 ? "?" : "&") + q : "");',
        "  location.replace(u + (location.hash || h));",
        "})();",
        "</script>",
        "</body></html>",
    ]) + "\n"


def og_tags(base, slug, meta):
    if not base:
        return ""
    url = base + ("" if slug == "index" else slug + ".html")
    return "\n".join([
        '<link rel="canonical" href="%s">' % url,
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Star.Tec.Solutions">',
        '<meta property="og:title" content="%s">' % meta["title"],
        '<meta property="og:description" content="%s">' % meta["description"],
        '<meta property="og:url" content="%s">' % url,
        '<meta property="og:image" content="%sassets/img/og.png">' % base,
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
    ])


def json_ld_data(c, base):
    """The Organization record from a config dict (the string keys of config.js). Pure, so build.py can
    self-test it with a filled dict before any page is written."""
    data = {
        "@context": "https://schema.org", "@type": "ProfessionalService",
        "name": "Star.Tec.Solutions", "legalName": c.get("legalName") or "STS Digital", "alternateName": "STS Digital",
        "description": "Websites met eerst een gratis voorbeeld, gratis gereedschap en onderzoek naar AI voor kleine zaken, vanuit Antwerpen.",
        "areaServed": ["Antwerpen", "Vlaanderen"],   # Brussel alleen na OK van de oprichter (docs/CHECKLIST-SAKI.md, punt 3)
        "address": {"@type": "PostalAddress", "addressLocality": "Antwerpen", "addressCountry": "BE"},
        "founder": {"@type": "Person", "name": c.get("owner") or "Snymis"}, "knowsLanguage": "nl-BE",
    }
    if base:
        data["url"] = base
        data["logo"] = base + "assets/img/logo.svg"
    if c.get("email"):
        data["email"] = c["email"]
    if c.get("phone"):
        data["telephone"] = c["phone"]
    if c.get("address"):
        data["address"]["streetAddress"] = c["address"]
    if c.get("kbo"):
        data["identifier"] = {"@type": "PropertyValue", "propertyID": "KBO", "value": c["kbo"]}
    if c.get("vat", "").upper().startswith("BE"):
        data["vatID"] = c["vat"]
    return data


def json_ld(base, slug):
    """Organization markup for Google, only on the home page; the e-mail comes from config.js so it lives in
    one place. No price statement of any kind: every quote is made per client."""
    if slug != "index":
        return ""
    cfg = (OUT / "assets" / "js" / "config.js").read_text(encoding="utf-8")
    c = dict(re.findall(r'^\s*(\w+):\s*"([^"]*)"', cfg, re.M))
    return '<script type="application/ld+json">%s</script>' % json.dumps(json_ld_data(c, base), ensure_ascii=False)


def selftest():
    """Renders the JSON-LD with a filled config (what Saki will supply): every key lands, nothing raises."""
    full = {"legalName": "Test bv", "owner": "Snymis", "email": "a@b.be", "phone": "+32 470 00 00 00",
            "address": "Teststraat 1, 2000 Antwerpen", "kbo": "0123.456.789", "vat": "BE0123456789"}
    d = json_ld_data(full, "https://example.test/")
    assert d["address"]["streetAddress"] == full["address"] and d["address"]["addressLocality"] == "Antwerpen", d
    assert d["identifier"]["value"] == full["kbo"] and d["vatID"] == full["vat"] and d["email"] == full["email"]
    assert "priceRange" not in json.dumps(d) and "Brussel" not in d["areaServed"]
    e = json_ld_data({}, "")
    assert "address" in e and "streetAddress" not in e["address"] and "url" not in e


def inline_svg(html):
    """{{svg:name}} -> the contents of docs/assets/img/name.svg (inline, so it needs no request)."""
    return re.sub(r"\{\{svg:([\w-]+)\}\}", lambda m: (OUT / "assets" / "img" / (m.group(1) + ".svg")).read_text(encoding="utf-8").strip(), html)


def prefix_links(html, up):
    """Pages in a sub-folder reach assets and other pages through ../ (href/src that are not absolute, anchors or schemes)."""
    if not up:
        return html
    return re.sub(r'((?:href|src)=")(?!https?:|//|#|/|mailto:|tel:|data:|\.\./)', r"\1" + up, html)


DATA_PUBLIC_JSON = ()   # JSON a page fetches at runtime; today none: every JSON is rendered at build time


def copy_data():
    """src/data/*.js (loaded by a page as a script) and the JSON in DATA_PUBLIC_JSON -> docs/assets/data/.
    The other JSON (woordenlijst, panden, capabilities, radar-bericht, wijken) is build-time input with
    internal notes and stays out of docs/; a stale copy from an earlier build is removed. Returns the count."""
    src = SRC / "data"
    files = sorted(p for p in src.glob("*") if p.is_file() and (p.suffix == ".js" or p.name in DATA_PUBLIC_JSON)) if src.is_dir() else []
    out = OUT / "assets" / "data"
    if out.is_dir():
        for old in out.iterdir():
            if old.is_file() and old.name not in {p.name for p in files}:
                old.unlink()
    if files:
        out.mkdir(parents=True, exist_ok=True)
        for p in files:
            shutil.copyfile(p, out / p.name)
    return len(files)


def write_sitemap(base, entries):
    """entries: [(slug, date)] for every page that may be indexed. Also writes robots.txt."""
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join("  <url><loc>%s</loc><lastmod>%s</lastmod></url>\n" % (base + ("" if s == "index" else s + ".html"), d.isoformat()) for s, d in entries)
        + "</urlset>\n", encoding="utf-8", newline="\n")
    (OUT / "robots.txt").write_text("User-agent: *\nAllow: /\nSitemap: %ssitemap.xml\n" % base, encoding="utf-8", newline="\n")
