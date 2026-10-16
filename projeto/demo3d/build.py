#!/usr/bin/env python3
# ANDORA — build: junta src/*.js em game.js e injeta no template → webapp/index.html
import pathlib, sys

root = pathlib.Path(__file__).resolve().parent
webapp = root.parent / "webapp"

parts = [root / "src" / "core.js", root / "src" / "world.js", root / "src" / "game3.js"]
code = "\n".join(p.read_text(encoding="utf-8") for p in parts)
game = "(function(){\n'use strict';\n" + code + "\n})();\n"
(root / "game.js").write_text(game, encoding="utf-8")

three = (root / "three.min.js").read_text(encoding="utf-8")

tpl = (root / "template.html").read_text(encoding="utf-8")
if "<!-- {{GAME_JS}} -->" not in tpl:
    sys.exit("marcador <!-- {{GAME_JS}} --> ausente no template")
html = tpl.replace(
    "<!-- {{GAME_JS}} -->",
    "<script>\n" + three + "\n</script>\n<script>\n" + game + "</script>"
)
(webapp / "index.html").write_text(html, encoding="utf-8")
(root / "andora3d.html").write_text(html, encoding="utf-8")
print(f"[build] three: {len(three)//1024}KB + game.js: {len(game)//1024}KB → webapp/index.html ({len(html)//1024}KB)")
