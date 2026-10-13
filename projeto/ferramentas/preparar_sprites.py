#!/usr/bin/env python3
"""Recorta sprites (remove magenta) e monta prancha de verificação das cenas com grade."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

BASE = Path("/home/user")
SPR = BASE / "arte/sprites"
CEN = BASE / "arte/cenas"


def key_magenta(src: Path, dst: Path):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # magenta dominante?
            if r > 150 and b > 150 and g < 120 and (r + b) - 2 * g > 100:
                px[x, y] = (0, 0, 0, 0)
            elif r > 120 and b > 120 and g < 160 and r > g + 40 and b > g + 40:
                # borda com franja magenta: semi-transparente + despill
                ng = g
                nr = min(r, g + 30)
                nb = min(b, g + 30)
                px[x, y] = (nr, ng, nb, 140)
    # recorta bbox
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(dst)
    print(f"OK sprite {dst.name} ({im.size[0]}x{im.size[1]})")


SPR.mkdir(parents=True, exist_ok=True)
key_magenta(SPR / "fontes/heroi-parado.png", SPR / "heroi-parado.png")
key_magenta(SPR / "fontes/heroi-andando.png", SPR / "heroi-andando.png")
key_magenta(SPR / "fontes/cavalo.png", SPR / "cavalo.png")

# prancha das cenas com grade 10%
scenes = ["vila", "jardim", "campo", "bosque", "ruinas", "lago", "montanha"]
CW, CH = 900, 506  # 16:9
cols = 2
rows = (len(scenes) + cols - 1) // cols
pad = 10
W = cols * CW + (cols + 1) * pad
H = rows * (CH + 28) + pad
sheet = Image.new("RGB", (W, H), (18, 18, 18))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    font_b = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
except Exception:
    font = font_b = ImageFont.load_default()

for i, name in enumerate(scenes):
    r, c = divmod(i, cols)
    x0 = pad + c * (CW + pad)
    y0 = pad + r * (CH + 28)
    im = Image.open(CEN / f"{name}.png").convert("RGB")
    im = im.resize((CW, CH))
    sheet.paste(im, (x0, y0))
    d = ImageDraw.Draw(sheet)
    for p in range(10, 100, 10):
        gx = x0 + int(CW * p / 100)
        gy = y0 + int(CH * p / 100)
        d.line([(gx, y0), (gx, y0 + CH)], fill=(255, 255, 0), width=1)
        d.line([(x0, gy), (x0 + CW, gy)], fill=(255, 255, 0), width=1)
        d.text((gx + 2, y0 + 2), f"{p}", fill=(255, 255, 0), font=font)
        d.text((x0 + 2, gy + 2), f"{p}", fill=(255, 255, 0), font=font)
    d.text((x0 + 6, y0 + CH + 5), f"{i+1}. {name}", fill=(255, 255, 255), font=font_b)

sheet.save("/home/user/arte/prancha-cenas.png")
print(f"OK prancha-cenas.png ({W}x{H})")
