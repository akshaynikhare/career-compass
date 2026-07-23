"""
Generate the 1200x630 social-share image -> icons/og-image.png

Social platforms (Facebook, LinkedIn, WhatsApp, X) do NOT render SVG OG images,
so we ship a real PNG. Run once (or whenever branding changes):

    python -m pip install Pillow
    python scripts/gen_og_image.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons", "og-image.png")

INDIGO = (79, 70, 229)
INDIGO_DARK = (49, 46, 129)
WHITE = (255, 255, 255)
LIGHT = (199, 210, 254)


def load_font(names, size):
    for n in names:
        for path in (n, os.path.join("C:\\Windows\\Fonts", n)):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def main():
    img = Image.new("RGB", (W, H), INDIGO)
    px = img.load()
    # vertical gradient
    for y in range(H):
        t = y / H
        r = int(INDIGO[0] + (INDIGO_DARK[0] - INDIGO[0]) * t)
        g = int(INDIGO[1] + (INDIGO_DARK[1] - INDIGO[1]) * t)
        b = int(INDIGO[2] + (INDIGO_DARK[2] - INDIGO[2]) * t)
        for x in range(W):
            px[x, y] = (r, g, b)

    d = ImageDraw.Draw(img)

    # compass motif (top-right)
    cx, cy, rad = 1010, 150, 78
    d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], outline=WHITE, width=6)
    d.polygon([(cx, cy - 52), (cx - 16, cy), (cx, cy - 12), (cx + 16, cy)], fill=WHITE)
    d.polygon([(cx, cy + 52), (cx - 16, cy), (cx, cy + 12), (cx + 16, cy)], fill=LIGHT)
    d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=WHITE)

    title_font = load_font(["arialbd.ttf", "segoeuib.ttf", "seguisb.ttf"], 96)
    sub_font = load_font(["arial.ttf", "segoeui.ttf"], 46)
    tag_font = load_font(["arialbd.ttf", "segoeuib.ttf"], 34)
    url_font = load_font(["arial.ttf", "segoeui.ttf"], 30)

    d.text((90, 210), "Career Compass", font=title_font, fill=WHITE)
    d.text((90, 330), "Free career aptitude test for", font=sub_font, fill=LIGHT)
    d.text((90, 386), "Indian Class 9–10 students", font=sub_font, fill=LIGHT)

    # pill
    pill = "507 CAREERS  ·  RIASEC  ·  NO SIGN-UP"
    d.rounded_rectangle([90, 470, 90 + int(d.textlength(pill, font=tag_font)) + 56, 528],
                        radius=29, fill=(255, 255, 255, 255))
    d.text((118, 481), pill, font=tag_font, fill=INDIGO)

    d.text((90, 560), "akshaynikhare.github.io/career-compass", font=url_font, fill=LIGHT)

    img.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
