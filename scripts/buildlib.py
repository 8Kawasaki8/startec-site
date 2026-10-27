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
        html = f.read_text(encoding="utf-8").strip()
        # WP-19: a room whose heading carries id="<name>-titel" becomes a named region (aria-labelledby)
        label = ' aria-labelledby="%s-titel"' % name if ('id="%s-titel"' % name) in html else ""
        parts.append('<section id="%s" data-room%s>\n%s\n</section>' % (name, label, html))
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
    """Canonical, Open Graph and Twitter card for one page (WP-27): the same title, description and og.png
    on every page, nl_BE locale, so a link forwarded on WhatsApp, Facebook or LinkedIn shows the page it names."""
    if not base:
        return ""
    url = base + ("" if slug == "index" else slug + ".html")
    title, desc = meta["title"], meta["description"]
    return "\n".join([
        '<link rel="canonical" href="%s">' % url,
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Star.Tec.Solutions">',
        '<meta property="og:locale" content="nl_BE">',
        '<meta property="og:title" content="%s">' % title,
        '<meta property="og:description" content="%s">' % desc,
        '<meta property="og:url" content="%s">' % url,
        '<meta property="og:image" content="%sassets/img/og.png">' % base,
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="%s">' % OG_IMAGE_ALT,
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="twitter:title" content="%s">' % title,
        '<meta name="twitter:description" content="%s">' % desc,
        '<meta name="twitter:image" content="%sassets/img/og.png">' % base,
        '<meta name="twitter:image:alt" content="%s">' % OG_IMAGE_ALT,
    ])


OG_IMAGE_ALT = "Een verlicht uithangbord op een nachtstad, met de naam Star.Tec.Solutions"
# WP-27: a mailbox at a consumer provider is a person's address, not the business's; it stays out of the JSON-LD
# (as it stays out of the footer, src/partials/foot.html) until config.email is a business address.
PERSONAL_MAIL = ("gmail.com", "googlemail.com", "hotmail.com", "hotmail.be", "outlook.com", "outlook.be", "live.com",
                 "live.be", "yahoo.com", "icloud.com", "me.com", "telenet.be", "skynet.be", "proximus.be")


def business_email(email):
    """The e-mail for the structured data, or '' while it is a personal mailbox."""
    e = (email or "").strip()
    return e if "@" in e and e.rsplit("@", 1)[1].lower() not in PERSONAL_MAIL else ""


def json_ld_data(c, base):
    """The LocalBusiness record from a config dict (the string keys of config.js). Pure, so build.py can
    self-test it with a filled dict before any page is written. Only true fields: every value that waits on the
    founder (owner, address, kbo, vat, a business e-mail, a phone) is left out while config.js is empty, never
    filled with a placeholder; no priceRange, no aggregateRating, no openingHours (there is no shop to visit)."""
    data = {
        "@context": "https://schema.org", "@type": "LocalBusiness",
        "name": "Star.Tec.Solutions", "legalName": c.get("legalName") or "STS Digital", "alternateName": "STS Digital",
        "description": "Websites met eerst een gratis voorbeeld, gratis gereedschap en onderzoek naar AI voor kleine zaken, vanuit Antwerpen.",
        "areaServed": ["Antwerpen", "Vlaanderen"],   # Brussel alleen na OK van de oprichter (docs/CHECKLIST-SAKI.md, punt 3)
        "address": {"@type": "PostalAddress", "addressLocality": "Antwerpen", "addressCountry": "BE"},
        "knowsLanguage": "nl-BE",
    }
    if base:
        data["@id"] = base + "#sts"
        data["url"] = base
        data["logo"] = base + "assets/img/logo.svg"
        data["image"] = base + "assets/img/og.png"
    if c.get("owner"):
        data["founder"] = {"@type": "Person", "name": c["owner"]}
    if business_email(c.get("email")):
        data["email"] = business_email(c["email"])
    if c.get("phone"):
        data["telephone"] = c["phone"]
    if c.get("address"):
        data["address"]["streetAddress"] = c["address"]
    if c.get("kbo"):
        data["identifier"] = {"@type": "PropertyValue", "propertyID": "KBO", "value": c["kbo"]}
    if c.get("vat", "").upper().startswith("BE"):
        data["vatID"] = c["vat"]
    return data


def breadcrumb_data(base, slug, naam):
    """BreadcrumbList for a wijk page (WP-27): the start page, then the gemeente or district."""
    return {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Star.Tec.Solutions", "item": base},
            {"@type": "ListItem", "position": 2, "name": naam, "item": base + slug + ".html"},
        ],
    }


def wijk_naam(slug):
    """'wijk/<slug>' -> the name in src/data/wijken.json, or '' for any other page."""
    f = SRC / "data" / "wijken.json"
    if not slug.startswith("wijk/") or not f.is_file():
        return ""
    data = json.loads(f.read_text(encoding="utf-8"))
    for w in (data["wijken"] if isinstance(data, dict) else data):
        if w.get("slug") == slug[len("wijk/"):]:
            return w["naam"]
    return ""


def json_ld(base, slug):
    """Structured data per page: the LocalBusiness on the home page (the contact details come from config.js
    so they live in one place), a BreadcrumbList on every wijk page, nothing elsewhere. No price statement
    of any kind: every quote is made per client. Without --base there is no absolute address, so no markup."""
    if slug == "index":
        cfg = (OUT / "assets" / "js" / "config.js").read_text(encoding="utf-8")
        c = dict(re.findall(r'^\s*(\w+):\s*"([^"]*)"', cfg, re.M))
        return '<script type="application/ld+json">%s</script>' % json.dumps(json_ld_data(c, base), ensure_ascii=False)
    naam = wijk_naam(slug) if base else ""
    if naam:
        return '<script type="application/ld+json">%s</script>' % json.dumps(breadcrumb_data(base, slug, naam), ensure_ascii=False)
    return ""


def selftest():
    """Renders the JSON-LD with a filled config (what Saki will supply): every key lands, nothing raises; with an
    empty config nothing is invented (no founder, no personal mailbox, no placeholder)."""
    full = {"legalName": "Test bv", "owner": "Snymis", "email": "a@b.be", "phone": "+32 470 00 00 00",
            "address": "Teststraat 1, 2000 Antwerpen", "kbo": "0123.456.789", "vat": "BE0123456789"}
    d = json_ld_data(full, "https://example.test/")
    assert d["address"]["streetAddress"] == full["address"] and d["address"]["addressLocality"] == "Antwerpen", d
    assert d["identifier"]["value"] == full["kbo"] and d["vatID"] == full["vat"] and d["email"] == full["email"]
    assert d["founder"]["name"] == "Snymis" and d["@type"] == "LocalBusiness" and d["@id"] == "https://example.test/#sts"
    assert "priceRange" not in json.dumps(d) and "Brussel" not in d["areaServed"]
    e = json_ld_data({"email": "iemand@gmail.com"}, "")
    assert "address" in e and "streetAddress" not in e["address"] and "url" not in e and "founder" not in e and "email" not in e
    assert not any(v in ("", None, [], {}) for v in e.values()), e
    b = breadcrumb_data("https://example.test/", "wijk/berchem", "Berchem")
    assert b["itemListElement"][1]["item"] == "https://example.test/wijk/berchem.html" and b["itemListElement"][0]["position"] == 1


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
