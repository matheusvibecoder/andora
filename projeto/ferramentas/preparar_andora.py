#!/usr/bin/env python3
"""Recorta sprites ANDORA (magenta→alpha) e monta prancha de verificação."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

BASE = Path("/home/user")
SPR = BASE / "arte/sprites"


def key_magenta(src: Path, dst: Path):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 150 and b > 150 and g < 120 and (r + b) - 2 * g > 100:
                px[x, y] = (0, 0, 0, 0)
            elif r > 120 and b > 120 and g < 160 and r > g + 40 and b > g + 40:
                px[x, y] = (min(r, g + 30), g, min(b, g + 30), 140)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(dst)
    print(f"OK {dst.name} ({im.size[0]}x{im.size[1]})")


key_magenta(SPR / "fontes/andora-heroi-parado.png", SPR / "andora-heroi.png")
key_magenta(SPR / "fontes/andora-heroi-andando.png", SPR / "andora-heroi-andando.png")
key_magenta(SPR / "fontes/andora-lumo.png", SPR / "andora-lumo.png")

# prancha de verificação: 3 sprites + 3 cenas + 4 quadros
items = [
    ("sprite", SPR / "andora-heroi.png"),
    ("sprite", SPR / "andora-heroi-andando.png"),
    ("sprite", SPR / "andora-lumo.png"),
    ("cena", BASE / "arte/cenas/andora-vila.png"),
    ("cena", BASE / "arte/cenas/andora-floresta.png"),
    ("cena", BASE / "arte/cenas/andora-lago.png"),
    ("quadro", BASE / "arte/cutscene/a1-estrada.png"),
    ("quadro", BASE / "arte/cutscene/a2-ponte.png"),
    ("quadro", BASE / "arte/cutscene/a3-vila.png"),
    ("quadro", BASE / "arte/cutscene/a4-lago.png"),
]
CW, CH = 420, 300
cols = 4
rows = (len(items) + cols - 1) // cols
pad = 8
W = cols * CW + (cols + 1) * pad
H = rows * (CH + 26) + pad
sheet = Image.new("RGB", (W, H), (30, 34, 42))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
except Exception:
    font = ImageFont.load_default()

for i, (kind, path) in enumerate(items):
    r, c = divmod(i, cols)
    x0 = pad + c * (CW + pad)
    y0 = pad + r * (CH + 26)
    im = Image.open(path)
    if im.mode == "RGBA":
        bg = Image.new("RGB", im.size, (70, 74, 86))
        bg.paste(im, mask=im.split()[3])
        im = bg
    else:
        im = im.convert("RGB")
    im.thumbnail((CW, CH))
    sheet.paste(im, (x0 + (CW - im.width) // 2, y0 + (CH - im.height) // 2))
    draw.text((x0 + 6, y0 + CH + 4), f"{i+1}. {kind}: {path.name}", fill=(240, 240, 240), font=font)

sheet.save(BASE / "arte/prancha-andora.png")
print(f"OK prancha-andora.png ({W}x{H})")
