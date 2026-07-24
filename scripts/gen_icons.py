#!/usr/bin/env python3
"""
gen_icons.py — generate PNG favicons + apple-touch-icon from a drawn compass mark.

No SVG rasteriser is required: the compass is drawn directly with Pillow at 4x
and downscaled for crisp anti-aliased edges. Run:  python scripts/gen_icons.py

Outputs (into icons/):
  favicon-16.png, favicon-32.png, favicon.ico   — browser tab
  apple-touch-icon.png (180)                     — iOS home screen
  icon-192.png, icon-512.png                     — PWA manifest (PNG)
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(ROOT, "icons")

INDIGO = (79, 70, 229, 255)      # #4F46E5
INDIGO_LT = (165, 180, 252, 255)  # #A5B4FC (south needle)
WHITE = (255, 255, 255, 255)


def draw_icon(size, rounded=True, pad_ratio=0.0):
    """Draw the compass mark at `size` px. Renders at 4x then downscales."""
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Background — rounded square in brand indigo.
    if rounded:
        radius = int(S * 0.22)
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=INDIGO)
    else:
        d.rectangle([0, 0, S - 1, S - 1], fill=INDIGO)

    cx = cy = S / 2
    r = S * (0.32)  # needle reach

    # Compass needle — north (white), south (light indigo). Two kite triangles.
    w = S * 0.11  # half-width of the needle at centre
    # North (up)
    d.polygon([(cx, cy - r), (cx - w, cy), (cx, cy - w * 0.55), (cx + w, cy)], fill=WHITE)
    # South (down)
    d.polygon([(cx, cy + r), (cx - w, cy), (cx, cy + w * 0.55), (cx + w, cy)], fill=INDIGO_LT)

    # Centre hub
    hub = S * 0.055
    d.ellipse([cx - hub, cy - hub, cx + hub, cy + hub], fill=WHITE)

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(ICONS, exist_ok=True)

    # PWA / apple-touch — full-bleed rounded square.
    draw_icon(512).save(os.path.join(ICONS, "icon-512.png"))
    draw_icon(192).save(os.path.join(ICONS, "icon-192.png"))
    draw_icon(180).save(os.path.join(ICONS, "apple-touch-icon.png"))

    # Favicons.
    fav32 = draw_icon(32)
    fav16 = draw_icon(16)
    fav32.save(os.path.join(ICONS, "favicon-32.png"))
    fav16.save(os.path.join(ICONS, "favicon-16.png"))

    # Multi-resolution .ico from the 32px master.
    draw_icon(64).save(
        os.path.join(ICONS, "favicon.ico"),
        sizes=[(16, 16), (32, 32), (48, 48)],
    )

    print("Wrote icons:", ", ".join(sorted(
        f for f in os.listdir(ICONS) if f.endswith((".png", ".ico"))
    )))


if __name__ == "__main__":
    main()
