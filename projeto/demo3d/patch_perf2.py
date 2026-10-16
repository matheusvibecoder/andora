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

# ---------- world.js ----------
patch('world.js', [
# grama menor e mais clara
("""    this.im = new THREE.InstancedMesh(geo, mat, QUAL.grass);""",
 """    if (mat.color) mat.color.multiplyScalar(1.35);
    this.im = new THREE.InstancedMesh(geo, mat, QUAL.grass);"""),
("""      S.setScalar(ok ? 0.9 + hashi(i, 13, WORLD_SEED) * 0.8 : 0.001);""",
 """      S.setScalar(ok ? 0.30 + hashi(i, 13, WORLD_SEED) * 0.24 : 0.001);"""),
# lampiao: emissivo controlavel + glow
("""  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xff9b3d, emissiveIntensity: 1.6, roughness: 0.6 }));
  head.position.set(0.85, 5.15, 0);
  g.add(post, arm, head);""",
 """  const headMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xff9b3d, emissiveIntensity: 0.4, roughness: 0.6 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.55), headMat);
  head.position.set(0.85, 5.15, 0);
  g.add(post, arm, head);
  g.userData.headMat = headMat;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffc070, transparent: true, opacity: 0.0, depthWrite: false }));
  glow.position.set(0.85, 5.15, 0);
  glow.scale.setScalar(2.6);
  g.add(glow);
  g.userData.glow = glow;"""),
("      lampPosts.push({ x, z, y: h + 5.4 });",
 "      lampPosts.push({ x, z, y: h + 5.4, headMat: lm.userData.headMat, glow: lm.userData.glow });"),
])

# ---------- core.js ----------
patch('core.js', [
# cores do terreno mais ricas
("""    } else {
      const g1 = lerp(0.3, 0.42, nv);
      const g2 = lerp(0.52, 0.36, smoothstep(8, 50, h));
      c.setRGB(g1 * 0.62 + 0.1 * n, g2 + 0.14 * n, g1 * 0.42);
    }
    const tint = 0.92 + nv * 0.18;""",
 """    } else {
      const dry = smoothstep(0.52, 0.78, fbmP(x / 240, z / 240, W / 240, WORLD_SEED + 400, 2));
      const rich = smoothstep(0.55, 0.85, n);
      const g1 = lerp(0.3, 0.42, nv), g2 = lerp(0.5, 0.34, smoothstep(8, 50, h));
      c.setRGB(g1 * 0.6 + 0.1 * n + dry * 0.16 - rich * 0.05,
        g2 + 0.13 * n - dry * 0.02 - rich * 0.08,
        g1 * 0.4 + dry * 0.02);
    }
    const tint = 0.9 + nv * 0.24;"""),
# estrelas cubicas
("      ' float st = step(0.9985, h21(floor(d.xz * 420.0) + floor(d.y * 420.0)));',",
 "      ' float st = step(0.9975, h21(floor(d.x * 700.0) + floor(d.y * 700.0) * 3.7 + floor(d.z * 700.0) * 7.1));',"),
# agua mais profunda/real
("""      ' vec3 deep = mix(vec3(0.05, 0.16, 0.22), vec3(0.02, 0.05, 0.1), uNight);',
      ' vec3 skyRef = mix(uSky, uTop, 0.35) * (0.35 + 0.65 * (1.0 - uNight));',
      ' vec3 col = mix(deep, skyRef, clamp(fres * 1.15, 0.0, 0.94));',""",
 """      ' vec3 deep = mix(vec3(0.04, 0.14, 0.19), vec3(0.02, 0.045, 0.09), uNight);',
      ' vec3 skyRef = mix(uSky, uTop, 0.35) * (0.42 + 0.58 * (1.0 - uNight));',
      ' vec3 col = mix(deep, skyRef, clamp(pow(fres, 1.3) * 1.1, 0.0, 0.9));',
      ' col += deep * (1.0 - fres) * 0.4;',"""),
])

# ---------- game3.js ----------
patch('game3.js', [
("""const hemi = new THREE.HemisphereLight(0xbfd8e8, 0x4a5a3a, 0.75);
scene.add(hemi);
scene.fog = new THREE.FogExp2(0xbfd8e8, 0.0011);""",
 """const hemi = new THREE.HemisphereLight(0xbfd8e8, 0x4a5a3a, 0.75);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8ea8d8, 0.0);
moon.position.set(-200, 260, 120);
scene.add(moon);
scene.fog = new THREE.FogExp2(0xbfd8e8, 0.0011);"""),
("  scene.fog.density = 0.0009 + WEATHER.rain * 0.0016 + night * 0.0004;",
 "  scene.fog.density = 0.00078 + WEATHER.rain * 0.00075 + night * 0.0004;"),
("""  sun.intensity = clamp(elev * 1.5, 0, 1.25) * (1 - WEATHER.rain * 0.55) + 0.06;
  sun.color.copy(skyUniforms.uSunCol.value);
  hemi.intensity = 0.28 + 0.5 * (1 - night) * (1 - WEATHER.rain * 0.4);
  hemi.color.copy(hor);
  hemi.groundColor.setHex(night > 0.5 ? 0x0c1220 : 0x4a5a3a);
  // luzes das lanternas à noite
  const lampOn = night > 0.25 ? 1 : 0;
  for (const pl of lampLights) pl.intensity = damp(pl.intensity, lampOn * 1.15, 2, dt);
  if (bonfire.light) {
    bonfire.light.intensity = (0.9 + Math.sin(skyUniforms.uTime.value * 9) * 0.12) * (0.7 + night * 0.8);
    bonfire.light.distance = 46;
  }""",
 """  sun.intensity = clamp(elev * 1.5, 0, 1.25) * (1 - WEATHER.rain * 0.55) + 0.05;
  sun.color.copy(skyUniforms.uSunCol.value);
  moon.intensity = night * 0.16 * (1 - WEATHER.rain * 0.6);
  hemi.intensity = 0.42 + 0.44 * (1 - night) * (1 - WEATHER.rain * 0.4);
  hemi.color.copy(hor);
  hemi.groundColor.setHex(night > 0.5 ? 0x1c2a48 : 0x4a5a3a);
  // luzes das lanternas à noite
  const lampOn = night > 0.25 ? 1 : 0;
  for (const pl of lampLights) pl.intensity = damp(pl.intensity, lampOn * 2.9, 2, dt);
  for (const lm of lampPosts) {
    if (lm.headMat) lm.headMat.emissiveIntensity = damp(lm.headMat.emissiveIntensity, lampOn * 3.4, 3, dt);
    if (lm.glow) lm.glow.material.opacity = damp(lm.glow.material.opacity, lampOn * 0.55, 3, dt);
  }
  if (bonfire.light) {
    bonfire.light.intensity = (1.4 + Math.sin(skyUniforms.uTime.value * 9) * 0.2) * (0.55 + night * 1.1);
    bonfire.light.distance = 58;
  }"""),
])
print('TODOS OS PATCHES OK')
