"""Shrinks the raster images the site ships (WP-16). Needs Pillow; nothing else.

  docs/assets/img/og.png         the link-preview image that node scripts/og-render.mjs writes in full colour:
                                 re-saved as an 8-bit palette PNG (256 colours, Floyd-Steinberg dither), under 150 kB.
  docs/assets/img/straat/*.jpg   the demo screenshots of werkwijze.html#straat: 800x500 (the largest rendered width is
                                 996 CSS px on desktop at DPR 1; a 2x DPR source would not fit the 60 kB cap, so the
                                 file stays 800 wide and is upscaled by at most 1.25), progressive, 4:2:0, the highest
                                 JPEG quality that stays under 56 kB.

Usage:  python3 scripts/img-shrink.py           rewrite what is over budget or not yet in this form
        python3 scripts/img-shrink.py --check   report only; exit 1 when a file is over its budget
The budgets are the WP-16 acceptance numbers; scripts/qa/perf.mjs (checkAssets) enforces them in npm run qa."""
import pathlib, sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG = ROOT / "docs" / "assets" / "img"
OG_MAX, STRAAT_MAX, STRAAT_TARGET = 150_000, 60_000, 56_000
STRAAT_SIZE = (800, 500)


def shrink_og(check):
    f = IMG / "og.png"
    size = f.stat().st_size
    im = Image.open(f)
    palette = im.mode == "P"
    print("og.png: %dx%d, %s, %.1f kB" % (im.width, im.height, im.mode, size / 1024))
    if check or (palette and size < OG_MAX):
        return size < OG_MAX
    rgb = im.convert("RGB")
    for colours in (256, 192, 128):
        q = rgb.quantize(colors=colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        q.save(f, optimize=True)
        size = f.stat().st_size
        print("  -> %d kleuren, %.1f kB" % (colours, size / 1024))
        if size < OG_MAX:
            return True
    return False


def shrink_straat(check):
    ok = True
    for f in sorted((IMG / "straat").glob("*.jpg")):
        size = f.stat().st_size
        im = Image.open(f)
        print("%s: %dx%d, %.1f kB" % (f.name, im.width, im.height, size / 1024))
        if check:
            ok = ok and size < STRAAT_MAX
            continue
        if size < STRAAT_TARGET and im.size == STRAAT_SIZE:
            continue
        src = im.convert("RGB")
        if src.size != STRAAT_SIZE:
            src = src.resize(STRAAT_SIZE, Image.Resampling.LANCZOS)
        for q in range(88, 40, -2):
            src.save(f, "JPEG", quality=q, optimize=True, progressive=True, subsampling="4:2:0")
            size = f.stat().st_size
            if size < STRAAT_TARGET:
                break
        print("  -> kwaliteit %d, %.1f kB" % (q, size / 1024))
        ok = ok and size < STRAAT_MAX
    return ok


if __name__ == "__main__":
    check = "--check" in sys.argv
    good = shrink_og(check) & shrink_straat(check)
    sys.exit(0 if good else 1)
