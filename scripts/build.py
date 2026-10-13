"""Builds the site: src/pages/*.html + src/partials -> docs/*.html.

Usage:  python scripts/build.py [--base https://example.github.io/site/]
--base sets absolute URLs for link previews (WhatsApp, Facebook, LinkedIn).

Page front matter (HTML comment at the top):
  title, description, nav (section id to mark active), scripts (space-separated
  names in docs/assets/js), scene: yes (loads the 3D scene module).
"""
import argparse, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "src", ROOT / "docs"

# (href fragment or page, label)
NAV = [("#oplossingen", "Oplossingen"), ("#lab", "Lab"), ("#werkwijze", "Werkwijze"),
       ("demos.html", "Demo's"), ("gereedschap.html", "Gereedschap"), ("#contact", "Contact")]
VENDOR = ["gsap.min", "ScrollTrigger.min", "lenis.min"]


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
    email = (re.search(r'email:\s*"([^"]*)"', cfg) or [None, ""])[1]
    data = {
        "@context": "https://schema.org", "@type": "ProfessionalService",
        "name": "Star.Tec.Solutions", "legalName": "STS Digital", "alternateName": "STS Digital",
        "description": "Websites, AI-systemen en automatisering voor zaken in Vlaanderen. Eerst een gratis voorbeeld, dan een offerte op maat.",
        "areaServed": ["Antwerpen", "Vlaanderen", "Brussel"], "address": {"@type": "PostalAddress", "addressLocality": "Antwerpen", "addressCountry": "BE"},
        "founder": {"@type": "Person", "name": "Snymis"}, "knowsLanguage": "nl-BE", "priceRange": "Offerte op maat",
    }
    if base:
        data["url"] = base
        data["logo"] = base + "assets/img/logo.svg"
    if email:
        data["email"] = email
    return '<script type="application/ld+json">%s</script>' % json.dumps(data, ensure_ascii=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="")
    args = ap.parse_args()
    base = args.base.rstrip("/") + "/" if args.base else ""

    head = (SRC / "partials" / "head.html").read_text(encoding="utf-8")
    nav = (SRC / "partials" / "nav.html").read_text(encoding="utf-8")
    foot = (SRC / "partials" / "foot.html").read_text(encoding="utf-8")

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
        page_head = head
        if slug == "404" and base:   # served for any missing URL, so relative assets need an anchor
            page_head = head.replace("<head>", '<head>\n<base href="%s">' % base, 1)
        html = (page_head.replace("{{title}}", meta["title"])
                    .replace("{{description}}", meta["description"])
                    .replace("{{og}}", og_tags(base, slug, meta))
                    .replace("{{jsonld}}", json_ld(base, slug))
                + nav.replace("{{links}}", links).replace("{{home}}", home or "index.html")
                + body.strip() + "\n"
                + foot.replace("{{scripts}}", "\n".join(scripts)).replace("{{home}}", home or "index.html"))
        (OUT / (slug + ".html")).write_text(html, encoding="utf-8", newline="\n")
        print("built docs/%s.html" % slug)


if __name__ == "__main__":
    main()
