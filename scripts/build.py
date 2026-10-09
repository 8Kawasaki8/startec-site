"""Builds the site: src/pages/*.html + src/partials -> docs/*.html.

Usage:  python scripts/build.py [--base https://example.github.io/site/]
--base sets absolute URLs for link previews (WhatsApp, Facebook, LinkedIn).

Page front matter (HTML comment at the top):
  title, description, nav (section id to mark active), scripts (space-separated
  names in docs/assets/js), scene: yes (loads the 3D scene module).
"""
import argparse, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "src", ROOT / "docs"

# (href fragment or page, label)
NAV = [("#oplossingen", "Oplossingen"), ("#lab", "Lab"), ("#werkwijze", "Werkwijze"),
       ("gereedschap.html", "Gereedschap"), ("#contact", "Contact")]
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
        html = (head.replace("{{title}}", meta["title"])
                    .replace("{{description}}", meta["description"])
                    .replace("{{og}}", og_tags(base, slug, meta))
                + nav.replace("{{links}}", links).replace("{{home}}", home or "index.html")
                + body.strip() + "\n"
                + foot.replace("{{scripts}}", "\n".join(scripts)).replace("{{home}}", home or "index.html"))
        (OUT / (slug + ".html")).write_text(html, encoding="utf-8", newline="\n")
        print("built docs/%s.html" % slug)


if __name__ == "__main__":
    main()
