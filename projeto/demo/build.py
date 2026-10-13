#!/usr/bin/env python3
"""Gera demo/demo-jogavel.html de ANDORA com todas as artes embutidas."""
import base64
import io
import json
from pathlib import Path
from PIL import Image

ROOT = Path("/home/user")
DEMO = ROOT / "demo"
TPL = DEMO / "template.html"
OUT = DEMO / "demo-jogavel.html"

JPG = {
    "sc_vila":    ("arte/cenas/andora-vila.png", 1360),
    "sc_floresta":("arte/cenas/andora-floresta.png", 1360),
    "sc_lago":    ("arte/cenas/andora-lago.png", 1360),
    "f1": ("arte/cutscene/a1-estrada.png", 1220),
    "f2": ("arte/cutscene/a2-ponte.png", 1220),
    "f3": ("arte/cutscene/a3-vila.png", 1220),
    "f4": ("arte/cutscene/a4-lago.png", 1220),
}
PNG = {
    "hs_parado":  ("arte/sprites/andora-heroi.png", 260),
    "hs_andando": ("arte/sprites/andora-heroi-andando.png", 260),
    "hs_lumo":    ("arte/sprites/andora-lumo.png", 150),
    "hs_cavalo":  ("arte/sprites/cavalo.png", 380),
}


def jpg_b64(path: Path, width: int) -> str:
    im = Image.open(path).convert("RGB")
    if im.width > width:
        im = im.resize((width, int(im.height * width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=82, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def png_b64(path: Path, width: int) -> str:
    im = Image.open(path).convert("RGBA")
    if im.width > width:
        im = im.resize((width, int(im.height * width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


assets = {}
for k, (rel, w) in JPG.items():
    assets[k] = jpg_b64(ROOT / rel, w)
for k, (rel, w) in PNG.items():
    assets[k] = png_b64(ROOT / rel, w)

html = TPL.read_text(encoding="utf-8").replace("@@ASSETS@@", json.dumps(assets))
OUT.write_text(html, encoding="utf-8")
print(f"OK {OUT} ({OUT.stat().st_size // 1024} KB, {len(assets)} assets)")
