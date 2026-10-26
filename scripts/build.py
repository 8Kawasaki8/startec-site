"""Builds the site: src/pages/*.html + src/partials (+ src/rooms, src/data) -> docs/.

Usage:  python3 scripts/build.py [--base https://example.github.io/site/]
--base sets absolute URLs for link previews (WhatsApp, Facebook, LinkedIn), the canonical
links, sitemap.xml and robots.txt. Without it the pages are built with relative links only.

Page front matter (HTML comment at the top of src/pages/<slug>.html):
  title, description     required; description also feeds the OG tags.
  nav: <door id>         the door of the Uithangbord that gets aria-current on this page
                         (a door whose page this is gets it anyway; 'none' marks nothing).
  rooms: a b c           inserts src/rooms/a.html, b.html, c.html in that order where {{rooms}}
                         stands in the body, each wrapped in <section id="a" data-room>.
  updated: YYYY-MM-DD    the date {{date}} shows ('Laatst bijgewerkt') and the sitemap reports;
                         the build date is used only when the key is absent.
  vendor: gsap.min       scripts from docs/assets/vendor, loaded first (default: gsap.min;
                         an empty value loads none).
  scripts: a b           scripts from docs/assets/js, after config.js and the core scripts
                         (names, state, hydrate, contact-prefill: on every page, legal included;
                         'motion' is dropped on the legal pages).
  styles: a b            stylesheets from docs/assets/css, after style.css.
  scene: yes             inserts src/partials/scene.html at {{scene}} (canvas, sign, SVG fallback
                         and the inline loader that decides whether Three.js loads).
  noindex: yes           robots meta 'noindex, nofollow' and no sitemap entry.
  redirect: <target>     the page becomes a 20-line stub (meta refresh 0, canonical to the target,
                         visible link, query and hash carried along); not in the sitemap.
Pages in sub-folders of src/pages (dev/scene.html) are built to the same sub-folder of docs/
with their relative links prefixed. {{svg:name}} anywhere inlines docs/assets/img/name.svg;
{{home}} is the address of the start page. src/data/*.json and *.js are copied to
docs/assets/data/. When src/data/wijken.json exists, buildlib.build_wijken() runs (WP-13).
The strip (src/partials/uithangbord.html) is rendered from DOORS and ACTION in buildlib.py.
"""
import argparse, datetime, json

from buildlib import (DOORS, LEGACY_LINKS, OUT, SRC, VENDOR_DEFAULT, build_wijken, copy_data, dutch_date,
                      front_matter, inline_svg, json_ld, og_tags, page_date, prefix_links, redirect_stub,
                      render_action, render_doors, rooms_html, write_sitemap)

NOT_IN_SITEMAP = {"404"}
# WP-02: the state core on every page, in this order (state needs names; hydrate and the prefill contract need state).
CORE_SCRIPTS = ["names", "state", "hydrate", "contact-prefill"]
LEGAL_PAGES = {"juridisch", "privacy", "cookies", "voorwaarden"}   # no motion layer: nothing moves on a legal page
ROBOTS_NOINDEX = '<meta name="robots" content="noindex, nofollow">'


def read_partials():
    """The four partials; a leading HTML comment in a partial is documentation and is not shipped."""
    return {n: front_matter((SRC / "partials" / (n + ".html")).read_text(encoding="utf-8"))[1].lstrip("\n")
            for n in ("head", "uithangbord", "foot", "scene")}


def render_page(ctx, slug, meta, body):
    """One source page -> the finished HTML. ctx: base, today, partials."""
    base, part = ctx["base"], ctx["partials"]
    up = "../" * slug.count("/")
    if meta.get("redirect"):
        return redirect_stub(meta["redirect"], meta, base, up)
    if meta.get("scene") == "yes":
        body = body.replace("{{scene}}", part["scene"], 1) if "{{scene}}" in body else part["scene"] + body
    if meta.get("rooms"):
        if "{{rooms}}" not in body:
            raise SystemExit("src/pages/%s.html lists rooms but has no {{rooms}} placeholder" % slug)
        body = body.replace("{{rooms}}", rooms_html(meta), 1)
    strip = (part["uithangbord"].replace("{{links}}", render_doors(LEGACY_LINKS, slug, meta))
             .replace("{{doors}}", render_doors(DOORS, slug, meta)).replace("{{action}}", render_action(slug, meta)))
    scripts = ['<script src="assets/vendor/%s.js"></script>' % v for v in meta.get("vendor", VENDOR_DEFAULT).split()]
    scripts += ['<script src="assets/js/config.js"></script>']
    page_scripts = [s for s in meta.get("scripts", "").split() if s not in CORE_SCRIPTS and not (slug in LEGAL_PAGES and s == "motion")]
    scripts += ['<script src="assets/js/%s.js"></script>' % s for s in CORE_SCRIPTS + page_scripts]
    styles = "\n".join('<link rel="stylesheet" href="assets/css/%s.css">' % s for s in meta.get("styles", "").split())
    page_head = part["head"]
    if slug == "404" and base:   # served for any missing URL, so relative assets need an anchor
        page_head = page_head.replace("<head>", '<head>\n<base href="%s">' % base, 1)
    page_head = page_head.replace("{{robots}}\n", ROBOTS_NOINDEX + "\n" if meta.get("noindex") == "yes" else "", 1)
    html = (page_head.replace("{{title}}", meta["title"])
                .replace("{{description}}", meta["description"])
                .replace("{{og}}", og_tags(base, slug, meta))
                .replace("{{jsonld}}", json_ld(base, slug))
                .replace("{{styles}}", styles)
            + strip + body.strip() + "\n"
            + part["foot"].replace("{{scripts}}", "\n".join(scripts)))
    html = html.replace("{{home}}", "index.html").replace("{{date}}", dutch_date(page_date(meta, ctx["today"])))
    return prefix_links(inline_svg(html), up)


def write_page(slug, html):
    out = OUT / (slug + ".html")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8", newline="\n")
    print("built docs/%s.html" % slug)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="")
    args = ap.parse_args()
    base = args.base.rstrip("/") + "/" if args.base else ""
    ctx = {"base": base, "today": datetime.date.today(), "partials": read_partials()}
    indexed = []     # (slug, date) for the sitemap

    for page in sorted((SRC / "pages").rglob("*.html")):
        meta, body = front_matter(page.read_text(encoding="utf-8"))
        slug = page.relative_to(SRC / "pages").with_suffix("").as_posix()
        write_page(slug, render_page(ctx, slug, meta, body))
        if slug not in NOT_IN_SITEMAP and meta.get("noindex") != "yes" and not meta.get("redirect"):
            indexed.append((slug, page_date(meta, ctx["today"])))

    n = copy_data()
    if n:
        print("copied %d data file(s) to docs/assets/data/" % n)
    wijken = SRC / "data" / "wijken.json"
    if wijken.is_file():
        def render(slug, meta, body):
            return render_page(ctx, slug, meta, body)

        def write(slug, html, date):
            write_page(slug, html)
            indexed.append((slug, date))
        built = build_wijken(json.loads(wijken.read_text(encoding="utf-8")), render, write)
        print("wijk pages: %d" % len(built))

    if base:
        write_sitemap(base, indexed)
        print("wrote docs/sitemap.xml (%d urls) and docs/robots.txt" % len(indexed))


if __name__ == "__main__":
    main()
