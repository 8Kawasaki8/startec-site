"""Renders content from src/data/*.json into the rooms (WP-09). build.py calls fill(html) after the
rooms are pasted; the placeholders may stand in a room or in a page body:
  {{panden}}          the three (or, with consent:true, four) panden of werkwijze.html#straat
  {{panden-kaarten}}  the facade cards of index.html#buren, from the same panden.json
  {{capabilities}}    the capability map of werkwijze.html#kaart (Werkt vandaag / Prototype / In onderzoek)
  {{radar-bericht}}   the first-contact draft of the radar replay, label by the flag echt
Every string from the JSON is escaped except the 'html' field of a capability item, which may hold
links. A placeholder without its data file breaks the build. Stdlib only, nothing printed."""
import html as H, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
SECTOR_LABEL = {"horeca": "Horeca", "kapper": "Kapper", "garage": "Garage", "bakker": "Bakker", "aannemer": "Aannemer",
                "praktijk": "Praktijk", "winkel": "Winkel", "anders": "Andere zaak"}
FICTIEF = "Fictieve zaak. Jouw versie bouwen we met jouw echte gegevens."


def load(name):
    f = DATA / (name + ".json")
    if not f.is_file():
        raise SystemExit("placeholder needs src/data/%s.json, which does not exist" % name)
    return json.loads(f.read_text(encoding="utf-8"))


def e(s):
    return H.escape(str(s), quote=True)


def pand(p):
    """One pand of the straat: old facade (inline SVG), new facade (demo screenshot under a clip-path),
    the range, the three 'probeer' lines and 'Stap binnen' in a new tab."""
    lijnen = "".join("<li>%s</li>" % e(t) for t in p["probeer"])
    return "\n".join([
        '<article class="pand" id="pand-%s" data-pand="%s" data-sector="%s" style="--c:%s" aria-labelledby="pand-h-%s">' % (e(p["slug"]), e(p["slug"]), e(p["sector"]), e(p["kleur"]), e(p["slug"])),
        '  <div class="pand-kop"><h3 id="pand-h-%s">%s</h3><p class="small">%s &middot; %s &middot; verzonnen zaak</p></div>' % (e(p["slug"]), e(p["naam"]), e(p["gemeente"]), e(SECTOR_LABEL.get(p["sector"], p["sector"]))),
        '  <div class="gevels" data-gevels>',
        '    <div class="oud" data-voice="pand">{{svg:%s}}</div>' % e(p["oud"]),   # WP-12: the pand's own old site speaks, not STS (woordenlijst voices)
        '    <div class="nieuw" data-nieuw style="clip-path:inset(0 0 0 40%%)"><img src="%s" alt="Nieuwe gevel: de demo van %s op een scherm" width="800" height="500" loading="lazy" decoding="async"></div>' % (e(p["beeld"]), e(p["naam"])),
        '    <span class="gevel-tag gevel-tag-oud" aria-hidden="true">oude gevel</span><span class="gevel-tag gevel-tag-nieuw" aria-hidden="true">nieuwe gevel</span>',
        '  </div>',
        '  <label class="gevel-range"><span>Schuif van de oude naar de nieuwe gevel: <output data-gevel-out>60 % nieuw</output></span>'
        '<input type="range" min="0" max="100" step="1" value="60" data-gevel-range aria-valuetext="60 procent nieuwe gevel"></label>',
        '  <p class="label probeer-label">Wat je hier kunt proberen</p>',
        '  <ul class="probeer">%s</ul>' % lijnen,
        '  <div class="pand-acties"><a class="pill" href="%s" target="_blank" rel="noopener">Stap binnen bij %s</a><span class="small">opent in een nieuw tabblad</span></div>' % (e(p["demo"]), e(p["naam"])),
        '</article>',
    ])


def pand_echt(p):
    """The fourth gevel: only rendered for a pand with consent:true (a real client who agreed); its body is
    'zin', the one sentence that client approved (empty: no body, never a placeholder next to a real name)."""
    return ('<article class="pand pand-echt" data-pand="%s" aria-label="%s"><div class="pand-kop"><h3>%s</h3><p class="small">%s &middot; echte zaak, met toestemming</p></div>'
            '%s<div class="pand-acties"><a class="pill" href="%s" target="_blank" rel="noopener">Stap binnen bij %s</a></div></article>'
            % (e(p["slug"]), e(p["naam"]), e(p["naam"]), e(p.get("gemeente", "")),
               '<p class="pand-echt-zin">%s</p>' % e(p["zin"]) if str(p.get("zin", "")).strip() else "", e(p.get("demo", "#")), e(p["naam"])))


def render_panden(data):
    fictief = [p for p in data["panden"] if not p.get("consent")]
    echt = [p for p in data["panden"] if p.get("consent") is True]
    return "\n".join([pand(p) for p in fictief] + [pand_echt(p) for p in echt])


def render_kaarten(data):
    """The facade cards of index.html#buren: name, buyer subtitle, the honesty line, link to the demo."""
    out = []
    for p in data["panden"]:
        if p.get("consent"):
            continue
        out.append('<a class="buur" href="%s" style="--c:%s"><span class="buur-gevel" aria-hidden="true"><i></i><i></i><i></i></span>'
                   '<strong>%s</strong><span class="buur-waar">%s &middot; %s</span><span class="buur-sub">%s</span><span class="buur-fictief">%s</span></a>'
                   % (e(p["demo"]), e(p["kleur"]), e(p["naam"]), e(p["gemeente"]), e(SECTOR_LABEL.get(p["sector"], p["sector"])), e(p["ondertitel"]), FICTIEF))
    return "\n".join(out)


def render_capabilities(data):
    """Three lamps, each item with exactly one token (<span class="lamp">). Prototype items: the founder's one
    sentence plus the foot line. In onderzoek: <details> with the proef mount point (WP-10) and, visible under
    it, the Bericht prefill link (data-bericht=<key>); a link inside a closed <details> cannot be clicked.
    The summary holds one heading element only (its content model), so the lamp sits inside the h3."""
    cols = []
    for lamp in data["lampen"]:
        lid, tok = e(lamp["id"]), e(lamp["token"])
        items = []
        for it in lamp["items"]:
            if lid == "vandaag":
                items.append('<li data-lamp="vandaag"><span class="lamp">%s</span><p>%s</p></li>' % (tok, it["html"]))
            elif lid == "prototype":
                items.append('<li data-lamp="prototype"><span class="lamp">%s</span><p>%s</p><p class="small">%s</p></li>' % (tok, e(it["zin"]), e(lamp["voet"])))
            else:
                proef = '<div class="proef" data-proef="%s" id="proef-%s"></div>' % (e(it["proef"]), e(it["proef"])) if it.get("proef") else ""
                items.append('<li data-lamp="onderzoek"><details id="onderzoek-%s"><summary><h3><span class="lamp">%s</span><span class="kaart-titel">%s</span></h3></summary><p>%s</p>%s</details>'
                             '<p class="kaart-meer"><a href="index.html#bericht?onderwerp=%s" data-bericht="%s" data-bericht-subject="%s">%s</a></p></li>'
                             % (e(it["id"]), tok, e(it["titel"]), e(it["tekst"]), proef, e(it["bericht"]), e(it["bericht"]), e(it["onderwerp"]), e(it["cta"])))
        cols.append('<div class="kaart-kolom kaart-%s"><p class="label kaart-kop" id="kaart-%s-h">%s</p><ul aria-labelledby="kaart-%s-h">\n%s\n</ul></div>' % (lid, lid, tok, lid, "\n".join(items)))
    return "\n".join(cols)


def render_radar_bericht(data):
    echt = data.get("echt") is True
    label = data["label"]["echt" if echt else "ontwerp"]
    regels = "".join("<p>%s</p>" % e(r) for r in data["regels"])
    return ('<p class="rs-brief-label" data-radar-label data-echt="%s">%s</p>'
            '<p class="rs-brief-onderwerp"><span class="label">Onderwerp</span> <span data-radar-onderwerp>%s</span></p>'
            '<div class="rs-brief-tekst" data-radar-tekst>%s</div>' % ("true" if echt else "false", e(label), e(data["onderwerp"]), regels))


RENDER = {
    "{{panden}}": lambda: render_panden(load("panden")),
    "{{panden-kaarten}}": lambda: render_kaarten(load("panden")),
    "{{capabilities}}": lambda: render_capabilities(load("capabilities")),
    "{{radar-bericht}}": lambda: render_radar_bericht(load("radar-bericht")),
}


def fill(html):
    for key, fn in RENDER.items():
        if key in html:
            html = html.replace(key, fn())
    return html
