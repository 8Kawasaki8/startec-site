"""Helpers for scripts/build.py, stdlib only: front matter, the Uithangbord (doors), rooms,
redirect stubs, OG and JSON-LD markup, inline SVG, link prefixing, data copies, the wijk
hook and the sitemap. build.py owns the page loop and the command line; nothing here
reads argv or prints."""
import datetime, json, pathlib, re, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "src", ROOT / "docs"

# The Uithangbord: five doors in the buyer's words plus the one action. (href from the site root, label, id)
DOORS = [
    ("index.html#gevel", "Jouw gevel", "gevel"),
    ("index.html#telefoon", "De telefoon om 19 u", "telefoon"),
    ("simulatie.html", "Doorlichting", "simulatie"),
    ("gereedschap.html", "Gereedschap", "gereedschap"),
    ("werkwijze.html", "Hoe wij werken", "werkwijze"),
]
ACTION = ("index.html#bericht", "Bericht aan Snymis", "bericht")
# Until WP-04 ships the strip and the rooms behind the doors, src/partials/uithangbord.html shows the
# seven links of the current site ({{links}}) through the same renderer as DOORS ({{doors}}, {{action}}).
LEGACY_LINKS = [
    ("index.html#oplossingen", "Oplossingen", "oplossingen"), ("index.html#lab", "Lab", "lab"),
    ("index.html#werkwijze", "Werkwijze", "werkwijze"), ("demos.html", "Demo's", "demos"),
    ("simulatie.html", "Simulatie", "simulatie"), ("gereedschap.html", "Gereedschap", "gereedschap"),
    ("index.html#contact", "Contact", "contact"),
]
# ScrollTrigger and Lenis stay in docs/assets/vendor for the demo sites; no STS page loads them.
VENDOR_DEFAULT = "gsap.min"
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
    href, _, did = door
    page, _, frag = href.partition("#")
    return did == meta.get("nav") or (not frag and page == slug + ".html")


def render_doors(doors, slug, meta, indent="      "):
    """<li><a> rows for a door list, with aria-current="page" on the door the visitor is behind."""
    return "\n".join('%s<li><a href="%s"%s>%s</a></li>' % (indent, door_href(h, slug), ' aria-current="page"' if is_current((h, l, i), slug, meta) else "", l)
                     for h, l, i in doors)


def render_action(slug, meta):
    """The one action of the strip, as a link (the prefill contract of WP-02 hangs on the room, not here)."""
    h, label, _ = ACTION
    return '<a class="pill" href="%s"%s>%s</a>' % (door_href(h, slug), ' aria-current="page"' if is_current(ACTION, slug, meta) else "", label)


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
    label = next((l for h, l, _ in DOORS + [ACTION] if h == target), target)
    return "\n".join([
        '<!doctype html><html lang="nl-BE">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        "<title>%s</title>" % meta["title"],
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


def json_ld(base, slug):
    """Organization markup for Google, only on the home page; the e-mail comes from config.js so it lives in
    one place. No price statement of any kind: every quote is made per client."""
    if slug != "index":
        return ""
    cfg = (OUT / "assets" / "js" / "config.js").read_text(encoding="utf-8")
    c = dict(re.findall(r'^\s*(\w+):\s*"([^"]*)"', cfg, re.M))
    data = {
        "@context": "https://schema.org", "@type": "ProfessionalService",
        "name": "Star.Tec.Solutions", "legalName": c.get("legalName") or "STS Digital", "alternateName": "STS Digital",
        "description": "Websites met eerst een gratis voorbeeld, gratis gereedschap en onderzoek naar AI voor kleine zaken, vanuit Antwerpen.",
        "areaServed": ["Antwerpen", "Vlaanderen"],   # Brussel only after the founder confirms it (docs/CHECKLIST-SAKI.md) "address": {"@type": "PostalAddress", "addressLocality": "Antwerpen", "addressCountry": "BE"},
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
    return '<script type="application/ld+json">%s</script>' % json.dumps(data, ensure_ascii=False)


def inline_svg(html):
    """{{svg:name}} -> the contents of docs/assets/img/name.svg (inline, so it needs no request)."""
    return re.sub(r"\{\{svg:([\w-]+)\}\}", lambda m: (OUT / "assets" / "img" / (m.group(1) + ".svg")).read_text(encoding="utf-8").strip(), html)


def prefix_links(html, up):
    """Pages in a sub-folder reach assets and other pages through ../ (href/src that are not absolute, anchors or schemes)."""
    if not up:
        return html
    return re.sub(r'((?:href|src)=")(?!https?:|//|#|/|mailto:|tel:|data:|\.\./)', r"\1" + up, html)


def copy_data():
    """src/data/*.json and *.js -> docs/assets/data/ (content files stay apart from code). Returns the count."""
    src = SRC / "data"
    files = sorted(p for p in src.glob("*") if p.suffix in (".json", ".js") and p.is_file()) if src.is_dir() else []
    if files:
        (OUT / "assets" / "data").mkdir(parents=True, exist_ok=True)
        for p in files:
            shutil.copyfile(p, OUT / "assets" / "data" / p.name)
    return len(files)


def build_wijken(wijken, render, write):
    """Hook for WP-13: one page per gemeente or district from src/data/wijken.json, each rendered through the
    same pipeline as a source page (render(slug, meta, body) -> html; write(slug, html, date)). Called only when
    the data file exists. Returns the built slugs (wijk/<slug>) so the sitemap lists them. Nothing yet."""
    return []


def write_sitemap(base, entries):
    """entries: [(slug, date)] for every page that may be indexed. Also writes robots.txt."""
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join("  <url><loc>%s</loc><lastmod>%s</lastmod></url>\n" % (base + ("" if s == "index" else s + ".html"), d.isoformat()) for s, d in entries)
        + "</urlset>\n", encoding="utf-8", newline="\n")
    (OUT / "robots.txt").write_text("User-agent: *\nAllow: /\nSitemap: %ssitemap.xml\n" % base, encoding="utf-8", newline="\n")
