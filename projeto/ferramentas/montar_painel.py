#!/usr/bin/env python3
"""Monta arte/painel-conceito.png com a arte atual de ANDORA."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path("/home/user")
ARTE = ROOT / "arte"
OUT = ARTE / "painel-conceito.png"

ITEMS = [
    ("personagens/andora-heroi-referencia.png", "O Herói de Andora", "Referência do personagem"),
    ("sprites/andora-heroi.png",   "Herói — parado",     "Sprite (jogo)"),
    ("sprites/andora-heroi-andando.png", "Herói — andando", "Sprite (jogo)"),
    ("sprites/andora-lumo.png",    "Lumo",               "Companheiro · espírito de luz"),
    ("sprites/cavalo.png",         "Cavalo",             "Transporte · fome e sede"),
    ("cenas/andora-vila.png",      "Vila de Andora",     "Cena do jogo"),
    ("cenas/andora-floresta.png",  "Floresta Serena",    "Cena do jogo"),
    ("cenas/andora-lago.png",      "Lago Espelho",       "Cena do jogo"),
    ("cutscene/a1-estrada.png",    "Cutscene — A estrada", "Quadro 1"),
    ("cutscene/a2-ponte.png",      "Cutscene — A ponte",   "Quadro 2"),
    ("cutscene/a3-vila.png",       "Cutscene — A vila",    "Quadro 3"),
    ("cutscene/a4-lago.png",       "Cutscene — O lago",    "Quadro 4"),
]

CELL_W, IMG_H, LABEL_H = 380, 280, 46
COLS = 4
ROWS = (len(ITEMS) + COLS - 1) // COLS
HEADER = 96
PAD = 16

W = COLS * CELL_W + (COLS + 1) * PAD
H = HEADER + ROWS * (IMG_H + LABEL_H) + (ROWS + 1) * PAD

sheet = Image.new("RGB", (W, H), (24, 32, 42))
draw = ImageDraw.Draw(sheet)

def load_font(size, bold=False):
    for p in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()

title_f = load_font(36, bold=True)
sub_f = load_font(18)
name_f = load_font(18, bold=True)
tag_f = load_font(14)

draw.text((PAD, 22), "ANDORA — Pacote de Arte", font=title_f, fill=(253, 246, 230))
draw.text((PAD, 64), "pintura fantástica realista · sem pixel art · mundo aberto relaxante", font=sub_f, fill=(170, 190, 170))

for i, (rel, name, tag) in enumerate(ITEMS):
    r, c = divmod(i, COLS)
    x = PAD + c * (CELL_W + PAD)
    y = HEADER + PAD + r * (IMG_H + LABEL_H + PAD)
    draw.rectangle([x, y, x + CELL_W, y + IMG_H + LABEL_H], fill=(40, 52, 66))
    path = ARTE / rel
    if not path.exists():
        draw.text((x + 12, y + 12), f"[faltando] {rel}", font=tag_f, fill=(230, 140, 120))
        continue
    im = Image.open(path)
    if im.mode == "RGBA":
        bg = Image.new("RGB", im.size, (40, 52, 66))
        bg.paste(im, mask=im.split()[3])
        im = bg
    else:
        im = im.convert("RGB")
    im.thumbnail((CELL_W - 8, IMG_H - 8))
    ix = x + (CELL_W - im.width) // 2
    iy = y + (IMG_H - im.height) // 2
    sheet.paste(im, (ix, iy))
    draw.text((x + 12, y + IMG_H + 6), name, font=name_f, fill=(253, 246, 230))
    draw.text((x + 12, y + IMG_H + 27), tag, font=tag_f, fill=(180, 200, 185))

OUT.parent.mkdir(parents=True, exist_ok=True)
sheet.save(OUT)
print(f"OK {OUT} ({W}x{H})")
