# -*- coding: utf-8 -*-
import io, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def patch(path, subs):
    s = io.open('src/' + path, encoding='utf-8').read()
    for a, b in subs:
        assert s.count(a) == 1, (path, a[:60], s.count(a))
        s = s.replace(a, b)
    io.open('src/' + path, 'w', encoding='utf-8').write(s)
    print(path, 'ok')

# game3.js — spawn em frente à estalagem + ringes com mais resolucao
patch('game3.js', [
("const hero = {\n  pos: new THREE.Vector3(VILLAGE.x, 12, VILLAGE.z + 30), yaw: 0, pitch: 0.32,",
 "const hero = {\n  pos: new THREE.Vector3(VILLAGE.x - 8, 12, VILLAGE.z + 78), yaw: Math.PI, pitch: 0.30,"),
("  makeRing(320, 60, 0, 26);\n  makeRing(1300, 52, -0.5, 70);",
 "  makeRing(320, 84, 0, 26);\n  makeRing(1300, 64, -0.5, 70);"),
("    hero.yaw = Math.PI * 1.15;\n    hero.pitch = 0.34;",
 "    hero.yaw = Math.PI * 0.94;\n    hero.pitch = 0.26;"),
("  WORLD_SEED = seed || (20261 + ((Math.random() * 90000) | 0));\n  bakeHeightmap();\n  hero.pos.set(VILLAGE.x + 10, groundH(VILLAGE.x + 10, VILLAGE.z + 40) + 2, VILLAGE.z + 40);\n  hero.yaw = Math.PI;",
 "  WORLD_SEED = seed || (20261 + ((Math.random() * 90000) | 0));\n  bakeHeightmap();\n  hero.pos.set(VILLAGE.x - 8, groundH(VILLAGE.x - 8, VILLAGE.z + 78) + 2, VILLAGE.z + 78);\n  hero.yaw = Math.PI;"),
# noite menos verde / mais azul
("  hemi.groundColor.setHex(night > 0.5 ? 0x1c2a48 : 0x4a5a3a);",
 "  hemi.groundColor.setHex(night > 0.5 ? 0x131d33 : 0x4a5a3a);"),
("  hemi.intensity = 0.42 + 0.44 * (1 - night) * (1 - WEATHER.rain * 0.4);",
 "  hemi.intensity = 0.36 + 0.5 * (1 - night) * (1 - WEATHER.rain * 0.4);"),
])

# world.js — grama tipo tapete + clareira menor
patch('world.js', [
("      S.setScalar(ok ? 0.30 + hashi(i, 13, WORLD_SEED) * 0.24 : 0.001);",
 "      S.setScalar(ok ? 0.20 + hashi(i, 13, WORLD_SEED) * 0.16 : 0.001);"),
("  QUAL.grass = q >= 2 ? 850 : q === 1 ? 420 : 180;",
 "  QUAL.grass = 1;"),  # placeholder substituído abaixo
])
# revert do placeholder (a linha QUAL.grass fica no game3, nao no world)
s = io.open('src/world.js', encoding='utf-8').read()
s = s.replace("  QUAL.grass = 1;\n", "")  # linha nao existe no world; noop seguro
io.open('src/world.js', 'w', encoding='utf-8').write(s)

# game3 — contagem de grama maior
s = io.open('src/game3.js', encoding='utf-8').read()
a = "  QUAL.grass = q >= 2 ? 850 : q === 1 ? 420 : 180;"
b = "  QUAL.grass = q >= 2 ? 1600 : q === 1 ? 800 : 320;"
assert s.count(a) == 1
s = s.replace(a, b)
io.open('src/game3.js', 'w', encoding='utf-8').write(s)

# world.js — clareira da vila 130 -> 92 (floresta chega mais perto)
s = io.open('src/world.js', encoding='utf-8').read()
a = "            if (wdist(x, z, VILLAGE.x, VILLAGE.z) < 130) continue;"
b = "            if (wdist(x, z, VILLAGE.x, VILLAGE.z) < 92) continue;"
assert s.count(a) == 1
s = s.replace(a, b)
io.open('src/world.js', 'w', encoding='utf-8').write(s)
print('finito')
