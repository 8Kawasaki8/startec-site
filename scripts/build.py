"""Builds the site: src/pages/*.html + src/partials -> docs/*.html.

Usage:  python scripts/build.py [--base https://example.github.io/site/]
--base sets absolute URLs for link previews (WhatsApp, Facebook, LinkedIn).

Page front matter (HTML comment at the top):
  title, description, nav (section id to mark active), scripts (space-separated
  names in docs/assets/js), styles (space-separated names in docs/assets/css,
  loaded after style.css), scene: yes (loads the 3D scene module).
Also writes docs/sitemap.xml and docs/robots.txt when --base is given, and
replaces {{date}} in any page with the build date in Dutch.
"""
import argparse, datetime, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "src", ROOT / "docs"

# (href fragment or page, label)
NAV = [("#oplossingen", "Oplossingen"), ("#lab", "Lab"), ("#werkwijze", "Werkwijze"),
       ("demos.html", "Demo's"), ("simulatie.html", "Simulatie"), ("gereedschap.html", "Gereedschap"), ("#contact", "Contact")]
VENDOR = ["gsap.min", "ScrollTrigger.min", "lenis.min"]
NOT_IN_SITEMAP = {"404"}
MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"]


def dutch_date(d):
    return "%d %s %d" % (d.day, MONTHS[d.month - 1], d.year)


def front_matter(text):
    m = re.match(r"\s*<!--(.*?)-->", text, re.S)
    meta = {}
    for line in (m.group(1) if m else "").strip().splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, (text[m.end():] if m else text)


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
    """Organization markup for Google, only on the home page; the e-mail comes from config.js so it lives in one place."""
    if slug != "index":
        return ""
    cfg = (OUT / "assets" / "js" / "config.js").read_text(encoding="utf-8")
    c = dict(re.findall(r'^\s*(\w+):\s*"([^"]*)"', cfg, re.M))
    data = {
        "@context": "https://schema.org", "@type": "ProfessionalService",
        "name": "Star.Tec.Solutions", "legalName": c.get("legalName") or "STS Digital", "alternateName": "STS Digital",
        "description": "Websites, AI-systemen en automatisering voor zaken in Vlaanderen. Eerst een gratis voorbeeld, dan een offerte op maat.",
        "areaServed": ["Antwerpen", "Vlaanderen", "Brussel"], "address": {"@type": "PostalAddress", "addressLocality": "Antwerpen", "addressCountry": "BE"},
        "founder": {"@type": "Person", "name": c.get("owner") or "Snymis"}, "knowsLanguage": "nl-BE", "priceRange": "Offerte op maat",
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="")
    args = ap.parse_args()
    base = args.base.rstrip("/") + "/" if args.base else ""

    head = (SRC / "partials" / "head.html").read_text(encoding="utf-8")
    nav = (SRC / "partials" / "nav.html").read_text(encoding="utf-8")
    foot = (SRC / "partials" / "foot.html").read_text(encoding="utf-8")
    today = dutch_date(datetime.date.today())
    built = []

    for page in sorted((SRC / "pages").glob("*.html")):
        meta, body = front_matter(page.read_text(encoding="utf-8"))
        slug = page.stem
        home = "" if slug == "index" else "index.html"
        links = "\n".join('      <li><a href="%s">%s</a></li>'
                          % ((home + h) if h.startswith("#") else h, label) for h, label in NAV)
        scripts = ['<script src="assets/vendor/%s.js"></script>' % v for v in VENDOR]
        scripts += ['<script src="assets/js/config.js"></script>']
        if meta.get("scene") == "yes":
            scripts += ['<script type="module" src="assets/js/scene.js"></script>']
        scripts += ['<script src="assets/js/%s.js"></script>' % s for s in meta.get("scripts", "").split()]
        styles = "\n".join('<link rel="stylesheet" href="assets/css/%s.css">' % s for s in meta.get("styles", "").split())
        page_head = head
        if slug == "404" and base:   # served for any missing URL, so relative assets need an anchor
            page_head = head.replace("<head>", '<head>\n<base href="%s">' % base, 1)
        html = (page_head.replace("{{title}}", meta["title"])
                    .replace("{{description}}", meta["description"])
                    .replace("{{og}}", og_tags(base, slug, meta))
                    .replace("{{jsonld}}", json_ld(base, slug))
                    .replace("{{styles}}", styles)
                + nav.replace("{{links}}", links).replace("{{home}}", home or "index.html")
                + body.strip() + "\n"
                + foot.replace("{{scripts}}", "\n".join(scripts)).replace("{{home}}", home or "index.html"))
        html = html.replace("{{date}}", today)
        (OUT / (slug + ".html")).write_text(html, encoding="utf-8", newline="\n")
        built.append(slug)
        print("built docs/%s.html" % slug)

    if base:
        urls = [base + ("" if s == "index" else s + ".html") for s in built if s not in NOT_IN_SITEMAP]
        today_iso = datetime.date.today().isoformat()
        (OUT / "sitemap.xml").write_text(
            '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "".join("  <url><loc>%s</loc><lastmod>%s</lastmod></url>\n" % (u, today_iso) for u in urls)
            + "</urlset>\n", encoding="utf-8", newline="\n")
        (OUT / "robots.txt").write_text("User-agent: *\nAllow: /\nSitemap: %ssitemap.xml\n" % base, encoding="utf-8", newline="\n")
        print("wrote docs/sitemap.xml (%d urls) and docs/robots.txt" % len(urls))


if __name__ == "__main__":
    main()
