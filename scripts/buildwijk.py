"""Wijkpagina's (WP-13): one page per gemeente or district from src/data/wijken.json, rendered from
src/templates/wijk.html through the same pipeline as a source page. build.py calls
build_wijken(data, render, write, today) when the data file exists:
  render(slug, meta, body) -> html      (build.render_page, so strip, footer, OG, canonical and ../ prefixes apply)
  write(slug, html, date)               (writes docs/<slug>.html and lists it in the sitemap)
The template's front matter and body carry these placeholders:
  {{naam}} {{naam-url}}   the name, escaped for text / for the query of the gevel button
  {{soortlabel}}          'District van Antwerpen' or 'Gemeente naast Antwerpen' (the eyebrow)
  {{soortzin}} {{rond}}   'een district van Antwerpen' + 'van de stad' / 'een gemeente naast Antwerpen' + 'rond de stad'
  {{sectoren}}            the three trades in the buyer's words, 'a, b en c'
  {{sfeerzin}}            a line that is dropped while the founder's sentence is empty
  {{langs}}               'Snymis komt hier langs' only when config.js wijken names the gemeente
Rules checked here, so a wrong data file breaks the build instead of the page: known slug, soort and
sector keys, exactly three sectors, no digits in naam or sfeerzin, no duplicate slugs. Stdlib only."""
import html as H, json, pathlib, re, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "src" / "templates" / "wijk.html"
CONFIG = ROOT / "docs" / "assets" / "js" / "config.js"
# The eight sector keys of names.js, written as the trades a visitor would name (plural, no numbers).
SECTOR_WOORDEN = {
    "horeca": "horecazaken", "kapper": "kapsalons", "garage": "garages", "bakker": "bakkers",
    "aannemer": "aannemers", "praktijk": "praktijken van kinesisten of tandartsen",   # no inner ' en ': opsomming() adds the only 'en'
    "winkel": "buurtwinkels", "anders": "kleine zaken van alle slag",
}
SOORTEN = {
    "district": {"label": "District van Antwerpen", "zin": "een district van Antwerpen", "rond": "van de stad"},
    "gemeente": {"label": "Gemeente naast Antwerpen", "zin": "een gemeente naast Antwerpen", "rond": "rond de stad"},
}
LANGS = ('  <p class="wijk-langs" data-wijk-langs>Snymis komt hier langs. Wil je het voorbeeld liever aan de toog bekijken '
         'dan op een scherm, zeg het in je bericht; hij komt het zelf tonen.</p>')
SFEER = '  <p class="wijk-sfeer" data-sfeerzin><span class="label">Snymis over %s</span>%s</p>'


def e(s):
    return H.escape(str(s), quote=True)


def opsomming(woorden):
    """['a', 'b', 'c'] -> 'a, b en c'."""
    return woorden[0] if len(woorden) == 1 else ", ".join(woorden[:-1]) + " en " + woorden[-1]


def config_wijken(path=CONFIG):
    """The 'wijken' sentence of config.js ('' until the founder fills it in)."""
    if not path.is_file():
        return ""
    m = re.search(r'^\s*wijken:\s*"([^"]*)"', path.read_text(encoding="utf-8"), re.M)
    return m.group(1) if m else ""


def komt_langs(naam, zin):
    """True only when the config sentence names this gemeente as a whole word."""
    return bool(zin) and re.search(r"(?<![\w-])" + re.escape(naam) + r"(?![\w-])", zin) is not None


def check(w, seen):
    """Validates one entry; raises SystemExit with the reason."""
    for k in ("slug", "naam", "soort", "sectoren"):
        if k not in w:
            raise SystemExit("wijken.json: entry %r misses %r" % (w.get("slug", "?"), k))
    if not re.fullmatch(r"[a-z0-9-]+", w["slug"]) or w["slug"] in seen:
        raise SystemExit("wijken.json: slug %r must be unique and [a-z0-9-]" % w["slug"])
    if w["soort"] not in SOORTEN:
        raise SystemExit("wijken.json: %s has soort %r (district or gemeente)" % (w["slug"], w["soort"]))
    if len(w["sectoren"]) != 3 or any(s not in SECTOR_WOORDEN for s in w["sectoren"]):
        raise SystemExit("wijken.json: %s needs exactly three known sector keys, got %r" % (w["slug"], w["sectoren"]))
    if re.search(r"\d", w["naam"] + w.get("sfeerzin", "")):
        raise SystemExit("wijken.json: %s carries a digit in naam or sfeerzin; wijk pages carry no numbers" % w["slug"])
    seen.add(w["slug"])


def fill(text, w, langs):
    """Replaces the placeholders in a template string (front matter value or body)."""
    s = SOORTEN[w["soort"]]
    out = (text.replace("{{naam}}", e(w["naam"])).replace("{{naam-url}}", urllib.parse.quote(w["naam"], safe=""))
               .replace("{{soortlabel}}", s["label"]).replace("{{soortzin}}", s["zin"]).replace("{{rond}}", s["rond"])
               .replace("{{sectoren}}", opsomming([SECTOR_WOORDEN[k] for k in w["sectoren"]])))
    sfeer = (w.get("sfeerzin") or "").strip()
    lines = []
    for line in out.split("\n"):
        key = line.strip()
        if key == "{{sfeerzin}}":
            if sfeer:
                lines.append(SFEER % (e(w["naam"]), e(sfeer)))
        elif key == "{{langs}}":
            if langs:
                lines.append(LANGS)
        else:
            lines.append(line)
    return "\n".join(lines)


def build_wijken(data, render, write, today, front_matter=None, page_date=None):
    """Renders every entry; returns the built slugs ('wijk/<slug>'). front_matter and page_date are the
    buildlib helpers (passed in so this module imports nothing from the build scripts)."""
    if not TEMPLATE.is_file():
        raise SystemExit("src/data/wijken.json exists but src/templates/wijk.html does not")
    entries = data["wijken"] if isinstance(data, dict) else data
    meta0, body0 = front_matter(TEMPLATE.read_text(encoding="utf-8"))
    body0 = re.sub(r"^\s*<!--.*?-->\n", "", body0, count=1, flags=re.S)   # the template's own documentation comment
    zin = config_wijken()
    built, seen = [], set()
    for w in entries:
        check(w, seen)
        langs = komt_langs(w["naam"], zin)
        meta = {k: fill(v, w, langs) for k, v in meta0.items()}
        slug = "wijk/" + w["slug"]
        html = render(slug, meta, fill(body0, w, langs))
        if html.count("\n") >= 200:
            raise SystemExit("docs/%s.html has %d lines; wijk pages stay under 200" % (slug, html.count("\n")))
        write(slug, html, page_date(meta, today))
        built.append(slug)
    return built
