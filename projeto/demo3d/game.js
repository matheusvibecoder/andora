'use strict';
/* ============================================================
   ANDORA — O Vale das Lanternas · Mundo Aberto 3D
   Motor: Three.js r128 embutido · offline · pronto p/ celular
   ============================================================ */

/* ---------------- helpers ---------------- */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const distTo = (x1, z1, x2, z2) => { const dx = x2 - x1, dz = z2 - z1; return Math.sqrt(dx * dx + dz * dz); };
const pad2 = n => (n < 10 ? '0' : '') + n;
const IS_TOUCH = window.matchMedia && window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

/* ---------------- storage (seguro) ---------------- */
const store = {
  mem: {},
  get(k, d) {
    try { const v = localStorage.getItem(k); if (v == null) { return (k in this.mem) ? this.mem[k] : d; } return JSON.parse(v); }
    catch (e) { return (k in this.mem) ? this.mem[k] : d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { this.mem[k] = v; }
  }
};

/* ---------------- constantes do mundo ---------------- */
const WATER_Y = 0;
const LAKE = { x: -200, z: -150, r: 95 };
const VILLAGE = { x: 0, z: 120 };
const FOREST = { x: 220, z: -40 };
const MOUNT = { x: 0, z: -330 };
const RUINS = { x: 250, z: 250 };
const WINDMILL = { x: -70, z: 300 };

/* ---------------- terreno (função de altura) ---------------- */
function hash2(x, z) { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); a *= 0.5; f *= 2; } return s; }
function height(x, z) {
  let h = (fbm(x * 0.008, z * 0.008) - 0.5) * 24;
  h += (fbm(x * 0.03 + 7, z * 0.03 + 3) - 0.5) * 5;
  const md = distTo(x, z, MOUNT.x, MOUNT.z); h += 88 * Math.exp(-(md * md) / 28800);
  const md2 = distTo(x, z, -160, -380); h += 52 * Math.exp(-(md2 * md2) / 16200);
  const ld = distTo(x, z, LAKE.x, LAKE.z); h -= 26 * Math.exp(-(ld * ld) / 18050);
  const vd = distTo(x, z, VILLAGE.x, VILLAGE.z); const vf = Math.max(0, 1 - vd / 75); h = h * (1 - vf * 0.92) + 3 * vf * 0.92;
  const rd = distTo(x, z, RUINS.x, RUINS.z); const rf = Math.max(0, 1 - rd / 48); h = h * (1 - rf * 0.75) + 11 * rf * 0.75;
  return h;
}
const ROADS = [
  [VILLAGE.x, VILLAGE.z, FOREST.x, FOREST.z],
  [VILLAGE.x, VILLAGE.z, LAKE.x + 70, LAKE.z + 70],
  [VILLAGE.x, VILLAGE.z, 30, -250],
  [VILLAGE.x, VILLAGE.z, RUINS.x - 30, RUINS.z - 30],
  [WINDMILL.x, WINDMILL.z, VILLAGE.x, VILLAGE.z]
];
function segDist(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1; const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - x1) * dx + (pz - z1) * dz) / l2 : 0; t = clamp(t, 0, 1);
  return distTo(px, pz, x1 + t * dx, z1 + t * dz);
}
function roadFactor(x, z) {
  let best = 1e9;
  for (let i = 0; i < ROADS.length; i++) { const s = ROADS[i]; best = Math.min(best, segDist(x, z, s[0], s[1], s[2], s[3])); }
  return clamp(1 - best / 6.5, 0, 1);
}
function terrainColor(x, z, h, out) {
  const road = roadFactor(x, z);
  const hx = height(x + 2.5, z) - height(x - 2.5, z), hz = height(x, z + 2.5) - height(x, z - 2.5);
  const slope = Math.sqrt(hx * hx + hz * hz) / 5;
  const n = fbm(x * 0.02 + 40, z * 0.02 + 17);
  let r, g, b;
  if (h > 52) { const t = clamp((h - 52) / 26, 0, 1); r = lerp(0.52, 0.92, t); g = lerp(0.55, 0.94, t); b = lerp(0.58, 0.97, t); }
  else if (h > 30 || slope > 0.85) {
    const t = clamp(clamp((h - 30) / 22, 0, 1) * 0.7 + clamp(slope - 0.85, 0, 0.6) * 0.7, 0, 1);
    r = lerp(0.4, 0.6, t); g = lerp(0.39, 0.53, t); b = lerp(0.35, 0.47, t);
  } else if (h < WATER_Y + 1.7 && distTo(x, z, LAKE.x, LAKE.z) < LAKE.r + 42) { r = 0.76; g = 0.7; b = 0.5; }
  else { const t = n; r = lerp(0.26, 0.42, t) * 0.92; g = lerp(0.5, 0.7, t); b = lerp(0.26, 0.38, t); }
  if (road > 0) { const t = road * 0.82; r = lerp(r, 0.6, t); g = lerp(g, 0.48, t); b = lerp(b, 0.34, t); }
  out.setRGB(r, g, b);
}

/* ---------------- estado do jogo ---------------- */
let scene, camera, renderer, clock;
let sun, moon, hemi, stars, sunSprite, moonSprite, glowTex, lanternGlowMats = [], lanternCoreMats = [];
let terrain, water;
let hero = null, horseList = [], npcList = [], animalList = [], pickupList = [], lanternList = [], clouds = [], birds = [];
let windmillBlades = null;
const animatables = [];
let hour = 9, dayCount = 1, worldTime = 0, gameStarted = false, menuMode = true, paused = false;
let friends = {}, quests = {}, inv = {}, flags = {};
const input = { fwd: 0, strafe: 0, run: false, jump: false };
const touchMove = { x: 0, y: 0 };
let camYaw = 0, camPitch = 0.22, camDist = 13;
let dlgNpc = null, saveTimer = 0;

/* ---------------- céu / luzes ---------------- */
function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function setupSky() {
  hemi = new THREE.HemisphereLight(0x9fd4ff, 0x4a6b3a, 0.9); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff2d8, 1.1); sun.position.set(120, 200, 80); scene.add(sun);
  moon = new THREE.DirectionalLight(0x8fb4ff, 0.12); moon.position.set(-120, 180, -80); scene.add(moon);
  glowTex = makeGlowTexture();
  sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe9b0, transparent: true, opacity: 0.95, depthWrite: false }));
  sunSprite.scale.set(90, 90, 1); scene.add(sunSprite);
  moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xcfe0ff, transparent: true, opacity: 0.8, depthWrite: false }));
  moonSprite.scale.set(55, 55, 1); scene.add(moonSprite);
  // estrelas
  const sg = new THREE.BufferGeometry(); const n = 380; const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 0.48 + 0.06, r = 470;
    pos[i * 3] = Math.cos(a) * Math.cos(b) * r; pos[i * 3 + 1] = Math.sin(b) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
  }
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.1, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(stars);
  // nuvens
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 11; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rand(7, 13), 7, 5), cloudMat);
      s.position.set(rand(-9, 9), rand(-2, 2), rand(-5, 5)); s.scale.y = 0.45; g.add(s);
    }
    g.position.set(rand(-380, 380), rand(95, 150), rand(-380, 380));
    clouds.push(g); scene.add(g);
  }
}
const cDay = new THREE.Color(0x7ec8f2), cNight = new THREE.Color(0x0b1026), cDusk = new THREE.Color(0xf2925c), cSkyTmp = new THREE.Color();
function sunAngle() { return (hour - 6) / 12 * Math.PI; }
function updateSky() {
  const a = sunAngle(), elev = Math.sin(a);
  const dayF = clamp(elev * 1.6 + 0.12, 0, 1);
  const duskF = clamp(1 - Math.abs(elev) * 3.4, 0, 1) * (dayF > 0.015 ? 1 : 0);
  cSkyTmp.copy(cNight).lerp(cDay, dayF).lerp(cDusk, duskF * 0.7);
  scene.background = cSkyTmp;
  scene.fog.color.copy(cSkyTmp);
  sun.position.set(Math.cos(a) * 380, Math.sin(a) * 380, Math.sin(a * 0.6) * 240);
  sun.intensity = Math.max(0, elev) * 1.25;
  moon.position.copy(sun.position).multiplyScalar(-1);
  moon.intensity = clamp(-elev, 0, 1) * 0.3 + 0.04;
  hemi.intensity = 0.26 + dayF * 0.74;
  stars.material.opacity = clamp(1 - dayF * 1.9, 0, 0.9);
  const nightF = clamp(1 - dayF * 1.55, 0, 1);
  for (let i = 0; i < lanternGlowMats.length; i++) lanternGlowMats[i].opacity = 0.18 + nightF * 0.82;
  for (let i = 0; i < lanternCoreMats.length; i++) lanternCoreMats[i].emissive.setRGB(nightF * 1.0, nightF * 0.62, nightF * 0.22);
  sunSprite.position.copy(sun.position).normalize().multiplyScalar(465);
  moonSprite.position.copy(sunSprite.position).multiplyScalar(-1);
  sunSprite.material.opacity = clamp(elev * 3, 0, 1) * 0.95;
  moonSprite.material.opacity = clamp(-elev * 2.2, 0, 1) * 0.75;
  return dayF;
}

/* ---------------- terreno + água ---------------- */
function buildTerrain() {
  const seg = 140, size = 900;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = height(x, z);
    pos.setY(i, h);
    terrainColor(x, z, h, col);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(terrain);
  // água do lago
  const wgeo = new THREE.CircleGeometry(LAKE.r + 6, 54);
  wgeo.rotateX(-Math.PI / 2);
  water = new THREE.Mesh(wgeo, new THREE.MeshLambertMaterial({ color: 0x2f7fc9, transparent: true, opacity: 0.82 }));
  water.position.set(LAKE.x, WATER_Y, LAKE.z);
  scene.add(water);
  animatables.push(t => { water.position.y = WATER_Y + Math.sin(t * 0.7) * 0.07; });
}

/* ---------------- vegetação e pedras ---------------- */
function scatterPos(ok) {
  for (let tries = 0; tries < 40; tries++) {
    const x = rand(-430, 430), z = rand(-430, 430);
    const h = height(x, z);
    if (ok(x, z, h)) return { x, z, h };
  }
  return null;
}
function buildNature() {
  // árvores: troncos + copas instanciadas
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.55, 4.2, 6);
  const pineGeo = new THREE.ConeGeometry(2.3, 5.6, 7);
  const blobGeo = new THREE.IcosahedronGeometry(2.6, 1);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7a34 });
  const N = 340;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N);
  const pines = new THREE.InstancedMesh(pineGeo, leafMat.clone(), N);
  const blobs = new THREE.InstancedMesh(blobGeo, leafMat.clone(), N);
  let ip = 0, ib = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const inForest = Math.random() < 0.62;
    const pos = inForest ? scatterPos((x, z, h) => {
      const d = distTo(x, z, FOREST.x, FOREST.z);
      return d < 155 && h > 1.2 && h < 34 && roadFactor(x, z) < 0.25;
    }) : scatterPos((x, z, h) => {
      return h > 1.4 && h < 38 && roadFactor(x, z) < 0.2 && distTo(x, z, VILLAGE.x, VILLAGE.z) > 95 && distTo(x, z, LAKE.x, LAKE.z) > LAKE.r + 12 && distTo(x, z, RUINS.x, RUINS.z) > 40;
    });
    if (!pos) {
      const zero = new THREE.Matrix4().makeScale(0, 0, 0);
      trunks.setMatrixAt(i, zero); pines.setMatrixAt(i, zero); blobs.setMatrixAt(i, zero);
      continue;
    }
    const sc = rand(0.75, 1.5), rot = rand(0, Math.PI * 2);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    // tronco
    p.set(pos.x, pos.h + 2.1 * sc, pos.z); s.set(sc, sc, sc);
    m.compose(p, q, s); trunks.setMatrixAt(i, m);
    const isPine = pos.h > 16 || Math.random() < 0.45;
    const geoUse = isPine ? pines : blobs;
    const idx = isPine ? ip++ : ib++;
    p.set(pos.x, pos.h + (isPine ? 5.6 : 5.1) * sc, pos.z);
    m.compose(p, q, s);
    if (isPine) { pines.setMatrixAt(ip - 1, m); c.setHSL(0.32 + rand(-0.03, 0.03), 0.42, rand(0.22, 0.34)); pines.setColorAt(ip - 1, c); }
    else { blobs.setMatrixAt(ib - 1, m); c.setHSL(0.27 + rand(-0.035, 0.035), 0.48, rand(0.26, 0.4)); blobs.setColorAt(ib - 1, c); }
  }
  pines.count = ip; blobs.count = ib;
  trunks.instanceMatrix.needsUpdate = true; pines.instanceMatrix.needsUpdate = true; blobs.instanceMatrix.needsUpdate = true;
  if (pines.instanceColor) pines.instanceColor.needsUpdate = true;
  if (blobs.instanceColor) blobs.instanceColor.needsUpdate = true;
  scene.add(trunks, pines, blobs);
  // pedras
  const rockGeo = new THREE.IcosahedronGeometry(1.5, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0x8a8478 }), 130);
  for (let i = 0; i < 130; i++) {
    const pos = scatterPos((x, z, h) => h > 2 && h < 62 && distTo(x, z, VILLAGE.x, VILLAGE.z) > 40);
    if (!pos) { rocks.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); continue; }
    const sc = rand(0.5, 2.2);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6.28));
    p.set(pos.x, pos.h + 0.5 * sc, pos.z); s.set(sc, sc * rand(0.55, 0.9), sc);
    m.compose(p, q, s); rocks.setMatrixAt(i, m);
  }
  rocks.instanceMatrix.needsUpdate = true; scene.add(rocks);
  // flores
  const flGeo = new THREE.SphereGeometry(0.22, 5, 4);
  const flMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const fl = new THREE.InstancedMesh(flGeo, flMat, 420);
  for (let i = 0; i < 420; i++) {
    const pos = scatterPos((x, z, h) => h > 1.5 && h < 26 && roadFactor(x, z) < 0.3 && distTo(x, z, LAKE.x, LAKE.z) > LAKE.r + 4);
    if (!pos) { fl.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); continue; }
    p.set(pos.x, pos.h + 0.22, pos.z); s.set(1, 1, 1); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
    m.compose(p, q, s); fl.setMatrixAt(i, m);
    const hue = [0.0, 0.12, 0.75, 0.58, 0.88][i % 5];
    c.setHSL(hue, 0.72, 0.62); fl.setColorAt(i, c);
  }
  fl.instanceMatrix.needsUpdate = true;
  if (fl.instanceColor) fl.instanceColor.needsUpdate = true;
  scene.add(fl);
}

/* ---------------- construções ---------------- */
const houseColliders = [];
function collideCircle(x, z, r) {
  for (const c of houseColliders) {
    const dx = x - c.x, dz = z - c.z;
    const d = Math.sqrt(dx * dx + dz * dz), min = c.r + r;
    if (d < min) {
      if (d < 0.001) { x = c.x + min; }
      else { const k = min / d; x = c.x + dx * k; z = c.z + dz * k; }
    }
  }
  return { x, z };
}
function addShadowBlob(g, r) {
  const sh = new THREE.Mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.06; g.add(sh);
}
function makeHouse(x, z, rot, sc, wall, roof) {
  const g = new THREE.Group();
  const h0 = height(x, z);
  const wallM = new THREE.MeshLambertMaterial({ color: wall });
  const roofM = new THREE.MeshLambertMaterial({ color: roof });
  const body = new THREE.Mesh(new THREE.BoxGeometry(9 * sc, 5.2 * sc, 7.5 * sc), wallM);
  body.position.y = 2.6 * sc; g.add(body);
  const roofM2 = new THREE.Mesh(new THREE.ConeGeometry(7.6 * sc, 3.6 * sc, 4), roofM);
  roofM2.position.y = 6.4 * sc; roofM2.rotation.y = Math.PI / 4; g.add(roofM2);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6 * sc, 2.5 * sc, 0.25), new THREE.MeshLambertMaterial({ color: 0x5a3a22 }));
  door.position.set(0, 1.25 * sc, 3.82 * sc); g.add(door);
  const winM = new THREE.MeshLambertMaterial({ color: 0x2a3a4a, emissive: 0x1a2836 });
  for (const wx of [-2.6, 2.6]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.3 * sc, 1.3 * sc, 0.2), winM);
    win.position.set(wx * sc, 2.9 * sc, 3.82 * sc); g.add(win);
    const win2 = win.clone(); win2.position.x = wx * sc; win2.position.z = -3.82 * sc; g.add(win2);
  }
  addShadowBlob(g, 7.5 * sc);
  g.position.set(x, h0, z); g.rotation.y = rot;
  houseColliders.push({ x, z, r: 6.4 * sc });
  scene.add(g);
  return g;
}
function buildVillage() {
  const walls = [0xe8d9b8, 0xdcc9a4, 0xe4cfa8, 0xd8c2a0, 0xe0c8a8, 0xd4b894, 0xe8d4b0, 0xcfb896, 0xe2c49c];
  const roofs = [0xa8563c, 0x93482f, 0xb06044, 0x8c4230, 0xa05438, 0x974e33, 0xaa5c3e, 0x8e4632, 0xb26646];
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + 0.25;
    const r = 30 + (i % 3) * 13;
    const x = VILLAGE.x + Math.cos(ang) * r, z = VILLAGE.z + Math.sin(ang) * r * 0.85;
    makeHouse(x, z, -ang + Math.PI / 2, 1 + (i % 3) * 0.14, walls[i], roofs[i]);
  }
  // fonte / espírito do vale
  const fg = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 1.3, 12), new THREE.MeshLambertMaterial({ color: 0xcfc4ae }));
  base.position.y = 0.65; fg.add(base);
  const wtr = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.35, 12), new THREE.MeshLambertMaterial({ color: 0x5aa8d8, transparent: true, opacity: 0.85 }));
  wtr.position.y = 1.42; fg.add(wtr);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.05, 3.1, 8), new THREE.MeshLambertMaterial({ color: 0xd8cdb6 }));
  pillar.position.y = 2.6; fg.add(pillar);
  const orbM = new THREE.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x4a90c8 });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), orbM);
  orb.position.y = 5.0; fg.add(orb);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x7fd4ff, transparent: true, opacity: 0.7, depthWrite: false }));
  glow.scale.set(7, 7, 1); glow.position.y = 5.0; fg.add(glow);
  addShadowBlob(fg, 5);
  fg.position.set(VILLAGE.x, height(VILLAGE.x, VILLAGE.z), VILLAGE.z);
  scene.add(fg);
  houseColliders.push({ x: VILLAGE.x, z: VILLAGE.z, r: 5.2 });
  animatables.push(t => { orb.position.y = 5.0 + Math.sin(t * 1.1) * 0.22; glow.position.y = orb.position.y; });
  // moinho
  const mg = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.4, 13, 10), new THREE.MeshLambertMaterial({ color: 0xd8c6a2 }));
  tower.position.y = 6.5; mg.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3.9, 3.2, 10), new THREE.MeshLambertMaterial({ color: 0x8c4630 }));
  cap.position.y = 14.2; mg.add(cap);
  const hub = new THREE.Group(); hub.position.set(0, 12, 3.6);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10.5, 0.22), new THREE.MeshLambertMaterial({ color: 0xefe3c8 }));
    blade.position.y = 5.2; const arm = new THREE.Group(); arm.rotation.z = (i / 4) * Math.PI * 2; arm.add(blade); hub.add(arm);
  }
  mg.add(hub); windmillBlades = hub;
  addShadowBlob(mg, 5.5);
  mg.position.set(WINDMILL.x, height(WINDMILL.x, WINDMILL.z), WINDMILL.z);
  mg.rotation.y = -0.7; scene.add(mg);
  houseColliders.push({ x: WINDMILL.x, z: WINDMILL.z, r: 5.6 });
  animatables.push((t, dt) => { hub.rotation.z += dt * 0.55; });
  // ruínas antigas
  const colM = new THREE.MeshLambertMaterial({ color: 0xb8ac96 });
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2, r = 16;
    const x = RUINS.x + Math.cos(ang) * r, z = RUINS.z + Math.sin(ang) * r;
    const hh = height(x, z);
    const hcol = 4 + (i % 3) * 3.2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, hcol, 8), colM);
    col.position.set(x, hh + hcol / 2, z); scene.add(col);
    if (i % 2 === 0) {
      const capc = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 3), colM);
      capc.position.set(x, hh + hcol + 0.35, z); capc.rotation.y = ang; scene.add(capc);
    }
  }
  const altar = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 5), colM);
  altar.position.set(RUINS.x, height(RUINS.x, RUINS.z) + 0.8, RUINS.z); scene.add(altar);
  const runaM = new THREE.MeshLambertMaterial({ color: 0x9ad8ff, emissive: 0x2a6a9a });
  const runa = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 1.6), runaM);
  runa.position.set(RUINS.x, height(RUINS.x, RUINS.z) + 1.75, RUINS.z); scene.add(runa);
  animatables.push(t => { runaM.emissive.setRGB(0.1 + 0.14 * (1 + Math.sin(t * 1.7)) * 0.5, 0.3 + 0.2 * Math.sin(t * 1.7) * 0.5 + 0.2, 0.55 + 0.25 * Math.sin(t * 1.3) * 0.5 + 0.25); });
}
function buildLanterns() {
  const spots = [
    [-12, 150], [12, 150], [-12, 96], [12, 96], [40, 132], [-40, 128],
    [120, 60], [180, 0], [-80, 40], [-140, -40], [-176, -96], [-120, -110],
    [30, -160], [40, -240], [210, 210], [150, 190], [-60, 250], [60, 210]
  ];
  for (const [x, z] of spots) {
    const h = height(x, z);
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3.6, 6), new THREE.MeshLambertMaterial({ color: 0x4a3624 }));
    post.position.y = 1.8; g.add(post);
    const coreM = new THREE.MeshLambertMaterial({ color: 0xffd98a, emissive: 0xffb45a });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 7), coreM);
    core.position.y = 3.8; g.add(core);
    lanternCoreMats.push(coreM);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 6), new THREE.MeshLambertMaterial({ color: 0x3a2a1c }));
    cap.position.y = 4.35; g.add(cap);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc878, transparent: true, opacity: 0.4, depthWrite: false }));
    gl.scale.set(3.6, 3.6, 1); gl.position.y = 3.8; g.add(gl);
    lanternGlowMats.push(gl.material);
    addShadowBlob(g, 0.8);
    g.position.set(x, h, z);
    scene.add(g);
    lanternList.push({ x, z, lit: false, g });
  }
}

/* ---------------- herói ---------------- */
const SKINS = ['#e8b88a', '#c98a5e', '#8a5a3c', '#f0c9a2'];
const HUES = [0, 45, 120, 210, 300, 160];
let heroName = 'Ari', heroHue = 120, heroSkin = 0;
function makeHero() {
  const g = new THREE.Group();
  const skinM = new THREE.MeshLambertMaterial({ color: SKINS[heroSkin] });
  const tunicM = new THREE.MeshLambertMaterial({ color: 0x3e8e6e });
  const cloakM = new THREE.MeshLambertMaterial({ color: 0x2e7a5a });
  const hairM = new THREE.MeshLambertMaterial({ color: 0x5a3a24 });
  const legM = new THREE.MeshLambertMaterial({ color: 0x4a3826 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.05, 0.38), legM); legL.position.set(-0.24, 0.52, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.24; g.add(legR);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.55), tunicM); torso.position.y = 1.62; g.add(torso);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.02, 0.32), tunicM); armL.position.set(-0.64, 1.62, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.64; g.add(armR);
  const cloak = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.35, 0.16), cloakM); cloak.position.set(0, 1.62, -0.4); g.add(cloak);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), skinM); head.position.y = 2.55; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), hairM); hair.position.set(0, 2.72, -0.06); hair.scale.set(1, 0.82, 1); g.add(hair);
  addShadowBlob(g, 0.85);
  scene.add(g);
  return { g, legL, legR, armL, armR, cloak, torso, tunicM, cloakM, skinM, x: 0, z: 195, y: 3, vy: 0, yaw: 0, speed: 0, stamina: 100, onGround: true, swimming: false, mounted: false, animT: 0 };
}
function applyHeroStyle() {
  if (!hero) return;
  const hsl = { h: heroHue / 360, s: 0.5, l: 0.42 };
  hero.cloakM.color.setHSL(hsl.h, 0.55, 0.42);
  hero.tunicM.color.setHSL(hsl.h, 0.42, 0.52);
  hero.skinM.color.set(SKINS[heroSkin]);
}

/* ---------------- cavalo ---------------- */
function buildHorseModel(body, mane) {
  const g = new THREE.Group();
  const bodyM = new THREE.MeshLambertMaterial({ color: body });
  const maneM = new THREE.MeshLambertMaterial({ color: mane });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.15, 2.5), bodyM); torso.position.y = 1.65; g.add(torso);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.15, 0.55), bodyM); neck.position.set(0, 2.35, 1.05); neck.rotation.x = 0.5; g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.95), bodyM); head.position.set(0, 2.95, 1.62); g.add(head);
  const maneT = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.55), maneM); maneT.position.set(0, 2.65, 0.78); maneT.rotation.x = 0.5; g.add(maneT);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.3), maneM); tail.position.set(0, 1.75, -1.32); tail.rotation.x = -0.5; g.add(tail);
  const legs = [];
  for (const [lx, lz] of [[-0.38, 0.85], [0.38, 0.85], [-0.38, -0.85], [0.38, -0.85]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.35, 0.32), bodyM);
    leg.position.set(lx, 0.68, lz); g.add(leg); legs.push(leg);
  }
  addShadowBlob(g, 1.7);
  return { g, head, legs };
}
function makeHorse(x, z, body, mane) {
  const m = buildHorseModel(body, mane);
  m.g.position.set(x, height(x, z), z);
  scene.add(m.g);
  return { ...m, x, z, yaw: rand(0, 6.28), hunger: rand(45, 80), thirst: rand(45, 80), energy: 100, state: 'graze', timer: rand(2, 6), target: null, ridden: false, animT: 0 };
}
function findShore() {
  for (let i = 0; i < 60; i++) {
    const a = rand(0, 6.28), r = LAKE.r * rand(0.72, 0.92);
    const x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r;
    const h = height(x, z);
    if (h > -1.2 && h < 1.4) return { x, z };
  }
  return { x: LAKE.x + LAKE.r * 0.8, z: LAKE.z };
}
function horseThink(hs, dt) {
  if (hs.ridden) return;
  hs.timer -= dt;
  const spd = 4.2;
  if (hs.state === 'graze') {
    hs.head.rotation.x = lerp(hs.head.rotation.x, 0.75, dt * 3);
    hs.hunger = clamp(hs.hunger + 4.2 * dt, 0, 100);
    if (hs.timer <= 0) {
      if (hs.thirst < 72) { hs.state = 'seek_water'; hs.target = findShore(); }
      else { hs.state = 'wander'; hs.target = { x: hs.x + rand(-45, 45), z: hs.z + rand(-45, 45) }; hs.timer = rand(6, 12); }
    }
  } else if (hs.state === 'seek_food' || hs.state === 'seek_water' || hs.state === 'wander') {
    hs.head.rotation.x = lerp(hs.head.rotation.x, 0, dt * 3);
    if (!hs.target) {
      if (hs.state === 'seek_food') {
        const p = scatterPos((x, z, h) => h > 1.4 && h < 30 && distTo(x, z, hs.x, hs.z) < 80);
        hs.target = p ? { x: p.x, z: p.z } : { x: hs.x + rand(-30, 30), z: hs.z + rand(-30, 30) };
      }
    }
    if (hs.target) {
      const dx = hs.target.x - hs.x, dz = hs.target.z - hs.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d > 2.2) {
        hs.yaw = lerp(hs.yaw, Math.atan2(dx, dz), dt * 4);
        hs.x += Math.sin(hs.yaw) * spd * dt; hs.z += Math.cos(hs.yaw) * spd * dt;
        hs.animT += dt * 8;
        for (let i = 0; i < hs.legs.length; i++) hs.legs[i].rotation.x = Math.sin(hs.animT + i * 1.7) * 0.55;
      } else {
        hs.target = null;
        if (hs.state === 'seek_food') { hs.state = 'graze'; hs.timer = 6.5; }
        else if (hs.state === 'seek_water') {
          if (hs.timer <= 0) hs.timer = 5.5;
          hs.head.rotation.x = lerp(hs.head.rotation.x, 0.95, dt * 3);
          hs.thirst = clamp(hs.thirst + 5.2 * dt, 0, 100);
          if (hs.thirst > 96) {
            if (hs.hunger < 88) { hs.state = 'seek_food'; hs.target = null; }
            else hs.state = 'wander';
          }
        } else if (hs.state === 'wander') {
          hs.state = 'graze'; hs.timer = rand(3, 7);
        }
      }
    }
  }
  if (hs.state === 'seek_water' && hs.target) {
    hs.head.rotation.x = lerp(hs.head.rotation.x, 0.3, dt * 2);
    if (distTo(hs.x, hs.z, hs.target.x, hs.target.z) < 4) {
      hs.head.rotation.x = lerp(hs.head.rotation.x, 0.95, dt * 4);
      hs.thirst = clamp(hs.thirst + 5.2 * dt, 0, 100);
      if (hs.thirst > 96) { hs.state = hs.hunger < 88 ? 'seek_food' : 'wander'; hs.target = null; }
    }
  }
  hs.hunger = clamp(hs.hunger - 0.02 * dt, 0, 100);
  hs.thirst = clamp(hs.thirst - 0.025 * dt, 0, 100);
  hs.g.position.set(hs.x, height(hs.x, hs.z), hs.z);
  hs.g.rotation.y = hs.yaw;
}

/* ---------------- NPCs ---------------- */
const NPCS = [
  { id: 'moira', name: 'Moira', emoji: '🧶', x: 10, z: 112, c1: '#c98adf', c2: '#8a4fb0', region: 'Vila', intro: 'Ah, {hero}! O forno está quente e o vale está cheio de luzes hoje. Você veio na hora certa.', opts: [['O cheiro de torta chega até a estrada!', 'c', 'Ha! Então fique — as maçãs do pomar estão perfeitas para a torta de hoje.'], ['A vila nunca parou tão aconchegante.', 'a', 'É o povo daqui... todo mundo cuida de um pedacinho do vale.'], ['Ouvi falar de lanternas que aparecem à noite.', 'b', 'Hmm, Vesper no lago sabe mais sobre isso. Mas cuidado: o lago guarda segredos gentis.']] },
  { id: 'bram', name: 'Bram', emoji: '🔨', x: -16, z: 136, c1: '#e8a54b', c2: '#a8601f', region: 'Vila', intro: 'Cuidado com as faíscas, {hero}. Estou consertando as ferramentas da colheita. Precisa de alguma coisa?', opts: [['Só admirando seu trabalho.', 'a', 'Heh, obrigado. Ferro bem trabalhado dura gerações — igual amizade.'], ['O que você está forjando?', 'b', 'Uma lâmina nova para o Kael, e ferragem para o moinho. O vento anda preguiçoso.'], ['Posso ajudar em alguma coisa?', 'c', 'Se achar pedras brilhantes perto do riacho, traga — troco por amizade... e por ferramentas.']] },
  { id: 'mira', name: 'Mira', emoji: '🍞', x: 24, z: 142, c1: '#f0c9a2', c2: '#c98a5e', region: 'Vila', intro: 'Pão fresquinho, {hero}! A massa da manhã ainda está morna.', opts: [['Aceito um pedaço!', 'c', 'Tome — e leve um para a estrada. Compartilhar pão é metade da aventura.'], ['Como você acorda tão cedo?', 'b', 'O vale acorda com o sol, e eu com ele. À noite, as lanternas me fazem companhia.'], ['A vila cheira maravilhoso.', 'a', 'Quando o vento vem do sul, até os cervos aparecem curiosos.']] },
  { id: 'teo', name: 'Teo', emoji: '🧺', x: -28, z: 108, c1: '#8fe07a', c2: '#4a9040', region: 'Vila', intro: 'Cesta cheia de verduras do pomar, {hero}! A terra anda generosa.', opts: [['A colheita parece ótima.', 'a', 'Sol e água na medida. O vale recompensa quem escuta a terra.'], ['Vendeu tudo na praça?', 'b', 'Quase! Levei o resto para o abrigo da montanha. Eles agradecem sempre.'], ['Posso provar um fruto?', 'c', 'Claro — pegue uma maçã. As melhores crescem perto da fonte da vila.']] },
  { id: 'pip', name: 'Pip', emoji: '🎒', x: 14, z: 152, c1: '#7fd4ff', c2: '#3a7ab0', region: 'Vila', intro: 'Oi! Eu sou a Pip, viajante como você! Já vi o lago, a floresta e quase a montanha.', opts: [['"Quase" a montanha?', 'b', 'A neblina me desceu antes do cume... mas ouvi um som de sinos lá de cima. Estranho, né?'], ['Qual lugar é o mais bonito?', 'c', 'O lago ao anoitecer. As lanternas dançam na água. Você PRECISA ver.'], ['Vamos explorar juntos?', 'a', 'Um dia sim! Por agora, o povo daqui precisa de ajuda — e as amizades valem mais que mapas.']] },
  { id: 'lyra', name: 'Lyra', emoji: '🎻', x: 205, z: -22, c1: '#d8a8e8', c2: '#8a4fb0', region: 'Floresta', intro: 'Shh... ouviu? O vento entre as árvores toca uma melodia antiga. Eu só anoto o que a floresta canta.', opts: [['Que som bonito...', 'a', 'A floresta de Andora tem acordes próprios. Sente-se — ela toca melhor para quem cala.'], ['Dizem que o lago canta também.', 'b', 'Sim! Vá à margem quando o sol se puser. É lá que a melodia nasce. Depois volte e me conte.'], ['Posso levar uma música?', 'c', 'Tome esta nota. Toque quando estiver sozinho — a floresta responde.']] },
  { id: 'kael', name: 'Kael', emoji: '🪓', x: 252, z: -68, c1: '#e88a5a', c2: '#a84a20', region: 'Floresta', intro: 'Ah, viajante! Estou reparando a ponte velha. Madeira boa precisa de pedra boa na base.', opts: [['Precisa de pedras?', 'c', 'Exato! Três pedras do riacho resolvem. Brilhantes, pesadas, firmes.'], ['Não derruba árvores demais?', 'a', 'Nunca mais do que a floresta devolve. Cada corte meu vem com dois plantios.'], ['Como foi a vida na floresta?', 'b', 'Silenciosa... e cheia de vizinhos que não falam, mas entendem tudo.']] },
  { id: 'silas', name: 'Silas', emoji: '📚', x: 182, z: -92, c1: '#c8b8e8', c2: '#6a4a9a', region: 'Floresta', intro: 'Ahem! Silas, cronista do vale. Estudo as ruínas ao sul. Interessado em história?', opts: [['Conta sobre as ruínas.', 'b', 'Eram um santuário das primeiras lanternas. Um altar ainda brilha quando a lua está alta.'], ['E sobre o espírito do vale?', 'c', 'Dizem que é um guardião gentil. Aparece como luz — e some quando confia em você.'], ['Tem algum mapa?', 'a', 'Tome este esboço. Não mostra estradas... mostra atalhos que só o coração encontra.']] },
  { id: 'wren', name: 'Wren', emoji: '🕯️', x: 242, z: 12, c1: '#f0e0a2', c2: '#c8a040', region: 'Floresta', intro: 'As minhas velas iluminam o caminho dos perdidos. Acendo uma para cada viajante que passa.', opts: [['Acenda uma para mim.', 'c', 'Feito. Que ela te guie até onde você precisa estar — não até onde pensava ir.'], ['Tem medo do escuro?', 'a', 'Já tive. Depois descobri que o escuro só existe para valorizar as luzes.'], ['O que acha das lanternas do lago?', 'b', 'São velas antigas, sem cera. Vesper cuida delas. Ou ela das elas.']] },
  { id: 'breno', name: 'Breno', emoji: '🐐', x: 282, z: -32, c1: '#d8c8a8', c2: '#9a7a4a', region: 'Floresta', intro: 'Meu bode fugiu de novo... ou fugi dele? Nunca sei. Quer conversar enquanto procuro?', opts: [['Vou procurar com você.', 'c', 'Sério? Obrigado! Ele adora perto das pedras quentes ao sul da floresta.'], ['Como se chama?', 'a', 'Nuvem. Porque some quando mais preciso. Mas sempre volta pra jantar.'], ['A floresta é perigosa?', 'b', 'Só se você tiver pressa. Andando devagar, até as sombras se afastam.']] },
  { id: 'nilo', name: 'Nilo', emoji: '🎣', x: -178, z: -108, c1: '#7fc8e8', c2: '#3a6a9a', region: 'Lago', intro: 'Shhh... os peixes estão mordendo hoje. Senta aqui comigo, {hero}, o lago acalma qualquer coração.', opts: [['Fico um pouco.', 'a', 'É... o lago devolve o que damos a ele. Silêncio por exemplo.'], ['Quem é aquela figura ao longe?', 'b', 'A Vesper. Ela fala com as lanternas. Ninguém sabe de onde veio — nem ela, acho.'], ['Posso pescar também?', 'c', 'Claro, pegue uma vara. E se pegar demais, devolva — o lago agradece.']] },
  { id: 'vesper', name: 'Vesper', emoji: '🌙', x: -228, z: -182, c1: '#9a9ae8', c2: '#4a4a9a', region: 'Lago', intro: 'Então você veio... O vale fala de você, {hero}. As lanternas esperaram por esta visita.', opts: [['Quem sou eu aqui?', 'b', 'Quem quiser ser. O vale não exige heróis — só corações presentes.'], ['O que são as lanternas?', 'a', 'Memórias felizes do vale, feitas luz. Cada uma é alguém que amou este lugar.'], ['Como posso ajudar?', 'c', 'Acenda as lanternas esquecidas à noite, e o lago fará o resto. Depois volte para mim.']] },
  { id: 'iara', name: 'Iara', emoji: '🌊', x: -158, z: -168, c1: '#8fe8e0', c2: '#2a9a90', region: 'Lago', intro: 'As águas de Andora correm devagar de propósito. Tudo aqui tem o seu tempo.', opts: [['Que bonito...', 'a', 'Beleza é só tempo bem usado. O lago ensina isso a quem observa.'], ['A água é segura?', 'c', 'Nade onde for azul-escuro, evite o verde raso. E sempre volte antes das lanternas acenderem.'], ['Para onde vai o rio?', 'b', 'Para o sul, até o mar — e volta como chuva. Como todos nós, de certo modo.']] },
  { id: 'aldric', name: 'Aldric', emoji: '🛡️', x: -218, z: -98, c1: '#c8c8d8', c2: '#6a6a8a', region: 'Lago', intro: 'Pare! ...Ah, é você, viajante. Desculpe — guardo a margem desde antes de eu me lembrar.', opts: [['Guarda contra o quê?', 'b', 'Contra o esquecimento. Um lugar só morra quando ninguém mais vem visitá-lo.'], ['Parece cansado.', 'c', 'Um pouco. Mas cada visitante novo me dá mais forças que um ano de sono.'], ['Quer companhia?', 'a', 'Por cinco minutos? Adoro. Sente-se — vou te contar como o lago era antigamente.']] }
];
function friendLevel(v) { return v < 15 ? 'Desconhecido' : v < 40 ? 'Conhecido' : v < 70 ? 'Amigo' : v < 95 ? 'Amigo íntimo' : 'Amigo do vale 🌟'; }
function buildNPCs() {
  for (const n of NPCS) {
    const g = new THREE.Group();
    const skinM = new THREE.MeshLambertMaterial({ color: '#e8b88a' });
    const clothM = new THREE.MeshLambertMaterial({ color: new THREE.Color(n.c2) });
    const cloth2M = new THREE.MeshLambertMaterial({ color: new THREE.Color(n.c1) });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.12, 0.52), clothM); torso.position.y = 1.58; g.add(torso);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.42), cloth2M); legs.position.y = 0.55; g.add(legs);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 9), skinM); head.position.y = 2.48; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.42, 9, 7), cloth2M); hair.position.y = 2.66; hair.scale.y = 0.72; g.add(hair);
    addShadowBlob(g, 0.8);
    // nome flutuante
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 80;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(10,22,46,0.72)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(20, 10, 216, 56, 16) : ctx.rect(20, 10, 216, 56); ctx.fill();
    ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe6b3'; ctx.fillText(n.emoji + ' ' + n.name, 128, 40);
    const tex = new THREE.CanvasTexture(cv);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(3.4, 1.05, 1); spr.position.y = 3.4; spr.renderOrder = 5; g.add(spr);
    const h = height(n.x, n.z);
    g.position.set(n.x, h, n.z);
    scene.add(g);
    npcList.push({ ...n, g, homeX: n.x, homeZ: n.z, animT: rand(0, 6), wanderT: rand(2, 8), lastTalk: 0 });
  }
  // moradores ambientes (sem diálogo)
  for (let i = 0; i < 8; i++) {
    const ang = rand(0, 6.28), r = rand(18, 62);
    const x = VILLAGE.x + Math.cos(ang) * r, z = VILLAGE.z + Math.sin(ang) * r * 0.8;
    const g = new THREE.Group();
    const clothM = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(rand(0, 1), 0.35, 0.5) });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.48), clothM); torso.position.y = 1.55; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.37, 8, 7), new THREE.MeshLambertMaterial({ color: 0xe8b88a })); head.position.y = 2.4; g.add(head);
    addShadowBlob(g, 0.7);
    const h = height(x, z); g.position.set(x, h, z);
    scene.add(g);
    npcList.push({ ambient: true, g, x, z, homeX: x, homeZ: z, yaw: rand(0, 6.28), animT: rand(0, 6), wanderT: rand(2, 8), speed: 0 });
  }
}

/* ---------------- animais ---------------- */
function makeAnimal(kind, x, z) {
  const g = new THREE.Group();
  const col = { cervo: 0xb08858, coelho: 0xd8d0c8, pato: 0xf0d060, cisne: 0xffffff, cachorro: 0xc89858, galinha: 0xe8e0d0, cabra: 0xc8c0b8 }[kind] || 0xaaaaaa;
  const m = new THREE.MeshLambertMaterial({ color: col });
  let scale = 1, bobAmp = 0.05;
  if (kind === 'cervo') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 1.7), m); body.position.y = 1.15; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.6), m); head.position.set(0, 1.75, 0.95); g.add(head);
    for (const [lx, lz] of [[-0.22, 0.55], [0.22, 0.55], [-0.22, -0.55], [0.22, -0.55]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.18), m); leg.position.set(lx, 0.42, lz); g.add(leg);
    }
    const ant = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), new THREE.MeshLambertMaterial({ color: 0x8a6a40 }));
    ant.position.set(-0.16, 2.15, 0.9); g.add(ant); const ant2 = ant.clone(); ant2.position.x = 0.16; g.add(ant2);
  } else if (kind === 'coelho') {
    scale = 0.55;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), m); body.position.y = 0.45; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 6), m); head.position.set(0, 0.75, 0.5); g.add(head);
    for (const ex of [-0.14, 0.14]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.06), m); ear.position.set(ex, 1.15, 0.42); g.add(ear);
    }
    bobAmp = 0.12;
  } else if (kind === 'pato' || kind === 'galinha') {
    scale = 0.62;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), m); body.position.y = 0.5; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 6), m); head.position.set(0, 0.95, 0.42); g.add(head);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.3), new THREE.MeshLambertMaterial({ color: 0xe88a2a })); beak.position.set(0, 0.92, 0.72); g.add(beak);
    if (kind === 'pato') { const wing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.7), m); wing.position.set(0.5, 0.55, 0); g.add(wing); const w2 = wing.clone(); w2.position.x = -0.5; g.add(w2); }
  } else if (kind === 'cisne') {
    scale = 0.85;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), m); body.position.y = 0.42; g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.0, 6), m); neck.position.set(0, 1.05, 0.42); neck.rotation.x = 0.35; g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 6), m); head.position.set(0, 1.55, 0.62); g.add(head);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.22), new THREE.MeshLambertMaterial({ color: 0xe88a2a })); beak.position.set(0, 1.52, 0.82); g.add(beak);
  } else if (kind === 'cachorro') {
    scale = 0.72;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 1.1), m); body.position.y = 0.72; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.5), m); head.position.set(0, 1.05, 0.72); g.add(head);
    for (const [lx, lz] of [[-0.2, 0.35], [0.2, 0.35], [-0.2, -0.35], [0.2, -0.35]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), m); leg.position.set(lx, 0.28, lz); g.add(leg);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), m); tail.position.set(0, 1.0, -0.68); tail.rotation.x = -0.7; g.add(tail);
    bobAmp = 0.09;
  } else if (kind === 'cabra') {
    scale = 0.82;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.65, 1.25), m); body.position.y = 0.92; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.5), m); head.position.set(0, 1.35, 0.72); g.add(head);
    for (const [lx, lz] of [[-0.2, 0.4], [0.2, 0.4], [-0.2, -0.4], [0.2, -0.4]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.75, 0.17), m); leg.position.set(lx, 0.38, lz); g.add(leg);
    }
  }
  g.scale.setScalar(scale);
  addShadowBlob(g, 0.8 * scale);
  g.position.set(x, height(x, z), z);
  scene.add(g);
  return { kind, g, x, z, yaw: rand(0, 6.28), t: rand(0, 6), speed: kind === 'pato' || kind === 'cisne' ? 1.4 : rand(1.2, 2.4), wanderT: rand(2, 9), onWater: kind === 'pato' || kind === 'cisne', bobAmp };
}
function buildAnimals() {
  for (let i = 0; i < 6; i++) {
    const p = scatterPos((x, z, h) => distTo(x, z, FOREST.x, FOREST.z) < 170 && h > 1.5 && h < 28);
    if (p) animalList.push(makeAnimal('cervo', p.x, p.z));
  }
  for (let i = 0; i < 6; i++) {
    const p = scatterPos((x, z, h) => distTo(x, z, VILLAGE.x, VILLAGE.z) < 160 && h > 1.5 && h < 22);
    if (p) animalList.push(makeAnimal('coelho', p.x, p.z));
  }
  for (let i = 0; i < 5; i++) {
    const a = rand(0, 6.28), r = LAKE.r * rand(0.35, 0.68);
    animalList.push(makeAnimal('pato', LAKE.x + Math.cos(a) * r, LAKE.z + Math.sin(a) * r));
  }
  for (let i = 0; i < 2; i++) {
    const a = rand(0, 6.28), r = LAKE.r * rand(0.25, 0.5);
    animalList.push(makeAnimal('cisne', LAKE.x + Math.cos(a) * r, LAKE.z + Math.sin(a) * r));
  }
  animalList.push(makeAnimal('cachorro', VILLAGE.x + 18, VILLAGE.z + 22));
  animalList.push(makeAnimal('cabra', 276, -38));
  for (let i = 0; i < 4; i++) animalList.push(makeAnimal('galinha', VILLAGE.x - 22 + rand(-6, 6), VILLAGE.z - 16 + rand(-6, 6)));
}
function animalThink(an, dt) {
  an.t += dt; an.wanderT -= dt;
  if (an.onWater) {
    if (an.wanderT <= 0) { an.wanderT = rand(4, 10); an.yaw = rand(0, 6.28); }
    const r = distTo(an.x, an.z, LAKE.x, LAKE.z);
    if (r > LAKE.r * 0.72) an.yaw = Math.atan2(LAKE.x - an.x, LAKE.z - an.z);
    an.x += Math.sin(an.yaw) * an.speed * dt; an.z += Math.cos(an.yaw) * an.speed * dt;
    an.g.position.set(an.x, WATER_Y + 0.06 + Math.sin(an.t * 2) * 0.04, an.z);
    an.g.rotation.y = an.yaw;
    return;
  }
  if (an.wanderT <= 0) { an.wanderT = rand(3, 10); an.yaw += rand(-1.6, 1.6); }
  const nx = an.x + Math.sin(an.yaw) * an.speed * dt, nz = an.z + Math.cos(an.yaw) * an.speed * dt;
  const nh = height(nx, nz);
  if (nh > WATER_Y + 0.4 && nh < 40) { an.x = nx; an.z = nz; } else an.yaw += 2.2 * dt;
  an.g.position.set(an.x, height(an.x, an.z) + Math.abs(Math.sin(an.t * 6)) * an.bobAmp, an.z);
  an.g.rotation.y = an.yaw;
}

/* ---------------- pássaros e borboletas ---------------- */
function buildBirds() {
  const birdM = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const wl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), birdM); wl.position.x = -0.85; g.add(wl);
    const wr = wl.clone(); wr.position.x = 0.85; g.add(wr);
    g.position.set(rand(-300, 300), rand(45, 85), rand(-300, 300));
    scene.add(g);
    birds.push({ g, wl, wr, cx: g.position.x, cz: g.position.z, r: rand(40, 120), a: rand(0, 6.28), spd: rand(0.12, 0.25), y: g.position.y });
  }
  // borboletas
  const bfM = new THREE.MeshLambertMaterial({ color: 0xffe08a, side: THREE.DoubleSide });
  for (let i = 0; i < 10; i++) {
    const p = scatterPos((x, z, h) => h > 1.5 && h < 24 && distTo(x, z, VILLAGE.x, VILLAGE.z) < 180);
    if (!p) continue;
    const g = new THREE.Group();
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), bfM); w1.position.x = -0.22; g.add(w1);
    const w2 = w1.clone(); w2.position.x = 0.22; g.add(w2);
    g.position.set(p.x, p.h + 1.6, p.z);
    scene.add(g);
    animatables.push(t => {
      const tt = t * 2 + i;
      g.position.x = p.x + Math.sin(tt * 0.7) * 2.2;
      g.position.z = p.z + Math.cos(tt * 0.53) * 2.2;
      g.position.y = p.h + 1.6 + Math.sin(tt * 1.1) * 0.5;
      w1.rotation.y = Math.sin(tt * 9) * 1.0; w2.rotation.y = -Math.sin(tt * 9) * 1.0;
    });
  }
}

/* ---------------- coletáveis e missões ---------------- */
const PICKUP_DEFS = [
  { kind: 'maca', emoji: '🍎', name: 'Maçã', color: 0xd84a3a },
  { kind: 'flor', emoji: '🌸', name: 'Flor', color: 0xf090c0 },
  { kind: 'pedra', emoji: '🪨', name: 'Pedra', color: 0x8a8478 },
  { kind: 'cogumelo', emoji: '🍄', name: 'Cogumelo', color: 0xc86a4a },
  { kind: 'concha', emoji: '🐚', name: 'Concha', color: 0xf0e0d0 }
];
function buildPickups() {
  const plan = [
    ['maca', 6, (x, z, h) => distTo(x, z, VILLAGE.x, VILLAGE.z) < 70 && h > 2],
    ['flor', 6, (x, z, h) => h > 1.5 && h < 20 && distTo(x, z, VILLAGE.x, VILLAGE.z) > 60 && distTo(x, z, VILLAGE.x, VILLAGE.z) < 200],
    ['pedra', 6, (x, z, h) => (h > 8 || distTo(x, z, LAKE.x, LAKE.z) < LAKE.r + 30) && h > 1],
    ['cogumelo', 5, (x, z, h) => distTo(x, z, FOREST.x, FOREST.z) < 130 && h > 1.5],
    ['concha', 5, (x, z, h) => distTo(x, z, LAKE.x, LAKE.z) < LAKE.r + 18 && h > -0.5 && h < 2.2]
  ];
  for (const [kind, n, ok] of plan) {
    const def = PICKUP_DEFS.find(d => d.kind === kind);
    for (let i = 0; i < n; i++) {
      const p = scatterPos(ok);
      if (!p) continue;
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 7), new THREE.MeshLambertMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.25 }));
      core.position.y = 0.55; g.add(core);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: def.color, transparent: true, opacity: 0.55, depthWrite: false }));
      gl.scale.set(1.7, 1.7, 1); gl.position.y = 0.6; g.add(gl);
      g.position.set(p.x, height(p.x, p.z), p.z);
      scene.add(g);
      pickupList.push({ kind, def, g, x: p.x, z: p.z, alive: true, timer: 0, t: rand(0, 6) });
    }
  }
  animatables.push((t, dt) => {
    for (const pk of pickupList) {
      if (pk.alive) {
        pk.t += dt;
        pk.g.rotation.y += dt * 1.6;
        pk.g.position.y = height(pk.x, pk.z) + 0.15 + Math.sin(pk.t * 2) * 0.12;
      } else {
        pk.timer -= dt;
        if (pk.timer <= 0) { pk.alive = true; pk.g.visible = true; }
      }
    }
  });
}
const QUESTS = [
  { id: 'macas', npc: 'moira', title: 'Maçãs para a torta', desc: 'Junte 3 maçãs 🍎 e volte para Moira', need: 3, item: 'maca' },
  { id: 'pedras', npc: 'kael', title: 'Pedras do riacho', desc: 'Junte 3 pedras 🪨 e leve para Kael', need: 3, item: 'pedra' },
  { id: 'lago', npc: 'lyra', title: 'O som do lago', desc: 'Vá à margem do lago entre 18h e 22h', need: 1, item: null },
  { id: 'lanternas', npc: 'vesper', title: 'Acenda as lanternas', desc: 'Acenda 3 lanternas à noite 🌙', need: 3, item: null }
];
function initQuestState() {
  quests = {};
  for (const q of QUESTS) quests[q.id] = { accepted: false, n: 0, done: false };
}
function questHud() {
  const lines = [];
  for (const q of QUESTS) {
    const s = quests[q.id];
    if (!s || !s.accepted || s.done) continue;
    lines.push('<b>⭐ ' + q.title + '</b><br>' + q.desc + (q.item ? ' (' + s.n + '/' + q.need + ')' : (q.id === 'lanternas' ? ' (' + s.n + '/3)' : '')));
  }
  const items = Object.keys(inv).filter(k => inv[k] > 0);
  if (items.length) {
    lines.push('<br>🎒 ' + items.map(k => {
      const d = PICKUP_DEFS.find(p => p.kind === k); return (d ? d.emoji : '•') + '×' + inv[k];
    }).join(' '));
  }
  $('questBox').innerHTML = lines.join('<br>');
}

/* ---------------- interação / diálogo ---------------- */
function toast(msg, ms) {
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = msg;
  $('toastWrap').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .5s'; setTimeout(() => el.remove(), 520); }, ms || 3200);
}
function openDialogue(npc) {
  dlgNpc = npc;
  const now = worldTime;
  const first = now - (npc.lastTalk || 0) > 45;
  const gain = first ? 3 : 1;
  friends[npc.id] = clamp((friends[npc.id] || 0) + gain, 0, 100);
  npc.lastTalk = now;
  if (first) toast('💛 Amizade com <b>' + npc.name + '</b> +' + gain);
  $('dialogue').classList.remove('hidden');
  $('dlgAvatar').textContent = npc.emoji;
  $('dlgAvatar').style.background = 'linear-gradient(135deg,' + npc.c1 + ',' + npc.c2 + ')';
  $('dlgName').textContent = npc.name;
  $('dlgFriend').textContent = friendLevel(friends[npc.id]) + ' · ' + npc.region;
  $('dlgText').innerHTML = npc.intro.replace('{hero}', heroName);
  const optsEl = $('dlgOpts'); optsEl.innerHTML = '';
  for (const [txt, tone, reply] of npc.opts) {
    const b = document.createElement('button'); b.className = 'dlg-opt'; b.innerHTML = txt;
    b.onclick = () => {
      const pts = tone === 'a' ? 2 : tone === 'c' ? 4 : 3;
      friends[npc.id] = clamp(friends[npc.id] + pts, 0, 100);
      $('dlgText').innerHTML = reply;
      optsEl.innerHTML = '';
      addOpt(optsEl, 'Continuar ▶', () => afterTalk(npc));
    };
    optsEl.appendChild(b);
  }
  addOpt(optsEl, '🎁 Dar presente (item do inventário)', () => {
    const k = Object.keys(inv).find(kk => inv[kk] > 0);
    if (!k) { $('dlgText').innerHTML = 'Você não tem nada para dar agora... volte mais tarde!'; return; }
    inv[k]--; const d = PICKUP_DEFS.find(p => p.kind === k);
    friends[npc.id] = clamp(friends[npc.id] + 5, 0, 100);
    $('dlgText').innerHTML = 'Você deu <b>' + (d ? d.emoji + ' ' + d.name : k) + '</b> para ' + npc.name + '.<br><i>"Obrigado, {hero}! Isso alegra meu dia."</i>'.replace('{hero}', heroName);
    optsEl.innerHTML = '';
    addOpt(optsEl, 'Continuar ▶', () => afterTalk(npc));
  });
}
function addOpt(parent, txt, fn) {
  const b = document.createElement('button'); b.className = 'dlg-opt'; b.innerHTML = txt; b.onclick = fn; parent.appendChild(b);
}
function afterTalk(npc) {
  $('dialogue').classList.add('hidden');
  // conclusão de missões
  for (const q of QUESTS) {
    const s = quests[q.id];
    if (!s || !s.accepted || s.done || q.npc !== npc.id) continue;
    const ready = q.item ? (inv[q.item] || 0) >= q.need : s.n >= q.need;
    if (ready) {
      if (q.item) inv[q.item] -= q.need;
      s.done = true;
      friends[npc.id] = clamp(friends[npc.id] + 12, 0, 100);
      toast('⭐ Missão concluída: <b>' + q.title + '</b>!<br>💛 Amizade +12', 4200);
      return;
    }
    if (q.item && (inv[q.item] || 0) < q.need) {
      toast('⭐ ' + q.title + ': você ainda precisa de ' + q.need + ' itens (' + ((inv[q.item] || 0)) + '/' + q.need + ')');
    }
  }
  // aceitar missões
  for (const q of QUESTS) {
    const s = quests[q.id];
    if (s && !s.accepted && !s.done && q.npc === npc.id) {
      s.accepted = true;
      toast('⭐ Nova missão: <b>' + q.title + '</b><br>' + q.desc, 4200);
    }
  }
  dlgNpc = null;
}
function nearestInteractable() {
  if (!hero) return null;
  let best = null, bestD = 1e9;
  for (const n of npcList) {
    if (n.ambient) continue;
    const d = distTo(hero.x, hero.z, n.g.position.x, n.g.position.z);
    if (d < 5.2 && d < bestD) { bestD = d; best = { type: 'npc', data: n, label: '💬 Conversar com <b>' + n.name + '</b>' }; }
  }
  for (const hs of horseList) {
    const d = distTo(hero.x, hero.z, hs.x, hs.z);
    if (d < 5.5 && d < bestD) {
      bestD = d;
      best = { type: 'horse', data: hs, label: hero.mounted ? '🐴 Desmontar' : '🐴 <b>Montar</b> no cavalo' };
    }
  }
  for (const pk of pickupList) {
    if (!pk.alive) continue;
    const d = distTo(hero.x, hero.z, pk.x, pk.z);
    if (d < 2.8 && d < bestD) { bestD = d; best = { type: 'pickup', data: pk, label: pk.def.emoji + ' Pegar <b>' + pk.def.name + '</b>' }; }
  }
  for (const ln of lanternList) {
    const d = distTo(hero.x, hero.z, ln.x, ln.z);
    if (d < 3.6 && d < bestD) { bestD = d; best = { type: 'lantern', data: ln, label: '🏮 Acender a <b>lanterna</b>' }; }
  }
  return best;
}
function doInteract() {
  if (dlgNpc) return;
  const it = nearestInteractable();
  if (!it) return;
  if (it.type === 'npc') { openDialogue(it.data); return; }
  if (it.type === 'pickup') {
    const pk = it.data;
    pk.alive = false; pk.g.visible = false; pk.timer = 45;
    inv[pk.kind] = (inv[pk.kind] || 0) + 1;
    toast(pk.def.emoji + ' Você pegou <b>' + pk.def.name + '</b>!');
    return;
  }
  if (it.type === 'lantern') {
    const ln = it.data;
    const isNight = hour >= 18.5 || hour < 5.5;
    if (!isNight) { toast('🏮 As lanternas só acendem quando a noite chega.'); return; }
    if (ln.lit) { toast('🏮 Esta lanterna já brilha.'); return; }
    ln.lit = true;
    const gl = ln.g.children.find(c => c.isSprite);
    if (gl) gl.material.opacity = 1;
    const s = quests['lanternas'];
    if (s && s.accepted && !s.done) {
      s.n++;
      toast('🏮 Lanterna acesa! (' + s.n + '/3)', 3000);
      if (s.n >= 3) toast('🌙 As lanternas dançam na água... volte para <b>Vesper</b>.', 4200);
    } else {
      toast('🏮 A lanterna brilha suavemente.');
    }
    return;
  }
  if (it.type === 'horse') {
    if (hero.mounted) {
      hero.mounted = false;
      const hs = it.data; // pode ser outro; usar montado
      const h = hero.mountedHorse;
      if (h) {
        h.ridden = false;
        h.state = 'seek_food';
        h.target = null;
        toast('🐴 O cavalo foi comer grama e beber água para recuperar! 🌿💧', 4200);
        hero.mountedHorse = null;
      }
      hero.y += 0.2;
    } else {
      const hs = it.data;
      hero.mounted = true; hero.mountedHorse = hs; hs.ridden = true;
      if (hs.hunger < 15 || hs.thirst < 15) toast('🐴 O cavalo está cansado com fome/sede... mas obedece (devagar).', 3800);
      else toast('🐴 Você montou! Corra mais rápido pelo vale.', 3000);
    }
    return;
  }
}

/* ---------------- save / load ---------------- */
function saveWorld(manual) {
  const slots = store.get('andora3d_mundos_v1', []);
  const data = {
    v: 1,
    id: (hero && hero.saveId) || ('w' + Date.now()),
    name: (hero && hero.saveName) || ('Mundo de ' + heroName),
    heroName, heroHue, heroSkin,
    x: hero.x, z: hero.z, yaw: hero.yaw,
    hour, dayCount,
    friends, quests, inv, flags,
    played: worldTime
  };
  hero.saveId = data.id;
  const idx = slots.findIndex(s => s.id === data.id);
  if (idx >= 0) slots[idx] = data; else slots.unshift(data);
  while (slots.length > 6) slots.pop();
  store.set('andora3d_mundos_v1', slots);
  store.set('andora3d_last', data.id);
  if (manual) toast('💾 Mundo salvo!', 2200);
}
function loadWorld(data) {
  heroName = data.heroName || 'Ari';
  heroHue = data.heroHue != null ? data.heroHue : 120;
  heroSkin = data.heroSkin || 0;
  friends = data.friends || {};
  quests = data.quests || initQuestState();
  inv = data.inv || {};
  flags = data.flags || {};
  hour = data.hour != null ? data.hour : 9;
  dayCount = data.dayCount || 1;
  worldTime = data.played || 0;
  hero.x = data.x || 0; hero.z = data.z || 195; hero.yaw = data.yaw != null ? data.yaw : 0;
  hero.y = height(hero.x, hero.z) + 0.1;
  hero.saveId = data.id; hero.saveName = data.name;
  applyHeroStyle();
  startPlaying();
}
function renderSlots() {
  const slots = store.get('andora3d_mundos_v1', []);
  const el = $('slotsList'); el.innerHTML = '';
  if (!slots.length) { el.innerHTML = '<div class="slot">Nenhum mundo salvo ainda. Crie um novo! ✨</div>'; return; }
  for (const s of slots) {
    const b = document.createElement('button'); b.className = 'slot';
    b.innerHTML = '<b>' + (s.name || 'Mundo') + '</b><br>Herói: ' + (s.heroName || 'Ari') + ' · 🕐 Dia ' + (s.dayCount || 1) + ' · ' + Math.floor((s.played || 0) / 60) + ' min jogados';
    b.onclick = () => { loadWorld(s); };
    el.appendChild(b);
  }
}

/* ---------------- cutscene ---------------- */
const CS = {
  idx: 0, a: 0, b: 0, c: 0, after: null,
  nodes: [
    { img: 'f1', who: 'Narrador', text: 'Depois de muitos dias de caminho, você cruza a última colina — e o Vale de Andora se abre sob o sol. Dizem que, ao anoitecer, lanternas de luz dançam sobre o lago... e que o vale escolhe quem pode vê-las.', opts: [['Caminhar em silêncio, admirando o vale.', 'a'], ['Perguntar a um transeunte sobre as lanternas.', 'b'], ['Compartilhar pão com quem encontrar no caminho.', 'c']] },
    { img: 'f2', who: 'Voz do vento', text: 'A ponte de madeira range sob seus pés. Em algum lugar, um sino toca uma vez. Você percebe que não está andando sozinho — algo brilha entre as árvores, sempre a alguns passos de distância.', opts: [['Seguir a luz com calma.', 'a'], ['Observar de longe, tentando entender.', 'b'], ['Deixar um pedaço de fruta como oferenda.', 'c']] },
    { img: 'f3', who: 'Moira 🧶', text: 'Na vila, Moira sorri ao te ver chegar. "Então é você quem todos esperavam! Sente-se. O vale não tem pressa — e quem tem pressa nunca vê as lanternas."', opts: [['Sentar e ouvir suas histórias.', 'a'], ['Perguntar sobre Vesper, a guardiã do lago.', 'b'], ['Ajudar a cortar a torta recém-saída do forno.', 'c']] },
    { img: 'f4', who: 'Vesper 🌙', text: 'À beira do lago, Vesper acende uma lanterna sem cera. "As lanternas de Andora são memórias felizes feitas luz. O vale te escolheu para cuidar delas... ou para descansar entre elas. Você decide."', opts: [['Cuidar das lanternas, sem pressa.', 'a'], ['Descobrir os segredos das luzes.', 'b'], ['Cuidar das pessoas primeiro, sempre.', 'c']] },
    { finale: true, who: 'Fim da introdução' }
  ]
};
function playCutscene(after) {
  CS.idx = 0; CS.a = CS.b = CS.c = 0; CS.after = after || null;
  $('menu').classList.add('hidden');
  $('cutscene').classList.remove('hidden');
  showCSNode();
}
function endCutscene() {
  $('cutscene').classList.add('hidden');
  store.set('andora3d_intro_v1', 1);
  const fn = CS.after; CS.after = null;
  if (fn) fn();
  else if (!gameStarted) $('menu').classList.remove('hidden');
}
function showCSNode() {
  const n = CS.nodes[CS.idx];
  if (!n) { endCutscene(); return; }
  const img = $('csImg');
  if (n.img && ASSETS[n.img]) { img.src = ASSETS[n.img]; img.classList.remove('hidden'); }
  if (n.finale) {
    const total = CS.a + CS.b + CS.c || 1;
    let title, text;
    if (CS.a >= CS.b && CS.a >= CS.c) { title = '🌅 O Amigo de Andora'; text = 'Você escolheu a calma do vale. As lanternas reconhecem em você um guardião paciente — e as portas de Andora ficam sempre abertas, para sempre.'; }
    else if (CS.b >= CS.c) { title = '📖 O Leitor de Luzes'; text = 'A curiosidade guiou seus passos. Ninguém sabe mais sobre as lanternas do que você agora — e os segredos do vale confiam em quem pergunta.'; }
    else { title = '💛 O Coração Generoso'; text = 'Sua generosidade precede você. O vale retribui: onde você pisa, crescem flores; onde você para, as pessoas sorriem.'; }
    if (CS.a && CS.b && Math.abs(CS.a - CS.b) <= 1 && CS.c === 0) { title = '🌄 O Caminhante Atento'; text = 'Você equilibrou a calma e a curiosidade. Andora se abre para você como um livro bem escrito — página a página, sem pressa.'; }
    else if (CS.a && CS.c && Math.abs(CS.a - CS.c) <= 1 && CS.b === 0) { title = '🏮 O Farol Viajante'; text = 'Calma e generosidade: você é um farol. Onde quer que viaje, as lanternas iluminam o caminho de outros.'; }
    else if (CS.b && CS.c && Math.abs(CS.b - CS.c) <= 1 && CS.a === 0) { title = '🌊 O Amigo das Duas Margens'; text = 'Curiosidade e cuidado juntos. Você entende as duas margens do lago — e o vale inteiro quer ser seu amigo.'; }
    $('csWho').textContent = title;
    $('csText').innerHTML = text + '<br><br><b>Bem-vindo a Andora, ' + heroName + '.</b> ✨';
    $('csOpts').innerHTML = '';
    const b = document.createElement('button'); b.className = 'cs-opt';
    b.innerHTML = '✨ Começar a jogar';
    b.onclick = () => endCutscene();
    $('csOpts').appendChild(b);
    return;
  }
  $('csWho').textContent = n.who;
  $('csText').textContent = n.text;
  const opts = $('csOpts'); opts.innerHTML = '';
  for (const [txt, tone] of n.opts) {
    const b = document.createElement('button'); b.className = 'cs-opt'; b.innerHTML = txt;
    b.onclick = () => {
      CS[tone]++;
      CS.idx++;
      showCSNode();
    };
    opts.appendChild(b);
  }
}

/* ---------------- câmera + input ---------------- */
function setupInput() {
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') input.jump = true;
    if (e.code === 'KeyE') doInteract();
    if (e.code === 'Escape') toggleMenu();
    if (e.code === 'KeyM') $('minimapWrap').classList.toggle('hidden');
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window._keys = keys;
  // órbita da câmera (mouse/touch no canvas)
  let dragId = null, lastX = 0, lastY = 0, pinchD = 0;
  const cv = $('game');
  cv.addEventListener('pointerdown', e => {
    if (dragId === null) { dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY; }
  });
  window.addEventListener('pointermove', e => {
    if (e.pointerId === dragId) {
      camYaw -= (e.clientX - lastX) * 0.0052;
      camPitch = clamp(camPitch + (e.clientY - lastY) * 0.0038, -0.18, 0.72);
      lastX = e.clientX; lastY = e.clientY;
    }
  });
  window.addEventListener('pointerup', e => { if (e.pointerId === dragId) dragId = null; });
  window.addEventListener('pointercancel', e => { if (e.pointerId === dragId) dragId = null; });
  cv.addEventListener('wheel', e => { camDist = clamp(camDist + e.deltaY * 0.012, 7, 28); e.preventDefault(); }, { passive: false });
  // joystick
  const joy = $('joyBase'), knob = $('joyKnob');
  let joyId = null;
  function joyMove(e) {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = r.width / 2 - 12;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    knob.style.left = (r.width / 2 - 32 + dx) + 'px';
    knob.style.top = (r.height / 2 - 32 + dy) + 'px';
    touchMove.x = dx / max; touchMove.y = dy / max;
  }
  joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); e.stopPropagation(); e.preventDefault(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) { joyMove(e); e.preventDefault(); } });
  function joyEnd(e) {
    if (e.pointerId === joyId) { joyId = null; touchMove.x = 0; touchMove.y = 0; knob.style.left = '34px'; knob.style.top = '34px'; }
  }
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);
  // botões de ação
  $('btnJump').addEventListener('pointerdown', e => { input.jump = true; e.preventDefault(); });
  $('btnRun').addEventListener('pointerdown', e => {
    input.run = !input.run;
    $('btnRun').classList.toggle('on', input.run);
    e.preventDefault();
  });
  $('btnAct').addEventListener('pointerdown', e => { doInteract(); e.preventDefault(); });
}

/* ---------------- HUD ---------------- */
function regionName(x, z) {
  const spots = [
    ['Vila de Andora', VILLAGE.x, VILLAGE.z, 95],
    ['Floresta Sussurrante', FOREST.x, FOREST.z, 165],
    ['Lago das Lanternas', LAKE.x, LAKE.z, 130],
    ['Montanha Nevada', MOUNT.x, MOUNT.z, 170],
    ['Ruínas Antigas', RUINS.x, RUINS.z, 85],
    ['Moinho do Vento', WINDMILL.x, WINDMILL.z, 70]
  ];
  let best = 'Vale de Andora', bestD = 1e9;
  for (const [name, sx, sz, r] of spots) {
    const d = distTo(x, z, sx, sz);
    if (d < r && d < bestD) { best = name; bestD = d; }
  }
  return best;
}
function updateHUD() {
  if (!hero) return;
  $('localName').textContent = regionName(hero.x, hero.z);
  const hh = Math.floor(hour), mm = Math.floor((hour % 1) * 60);
  const icon = (hour >= 6 && hour < 18) ? '☀️' : (hour >= 18 && hour < 21) ? '🌇' : '🌙';
  $('clockLine').textContent = icon + ' ' + pad2(hh) + ':' + pad2(mm) + ' · Dia ' + dayCount;
  $('stamBar').style.width = hero.stamina + '%';
  questHud();
}
function drawMinimap() {
  const cv = $('minimap'), ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, S = W / 950; // escala mundo→px
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#3f7a44'; ctx.fillRect(0, 0, W, H);
  const px = (x) => W / 2 + x * S, pz = (z) => H / 2 + z * S;
  // montanha
  ctx.fillStyle = '#8a8f98';
  ctx.beginPath(); ctx.arc(px(MOUNT.x), pz(MOUNT.z), 150 * S, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#e8eef4';
  ctx.beginPath(); ctx.arc(px(MOUNT.x), pz(MOUNT.z), 70 * S, 0, 6.29); ctx.fill();
  // floresta
  ctx.fillStyle = '#2c5c30';
  ctx.beginPath(); ctx.arc(px(FOREST.x), pz(FOREST.z), 150 * S, 0, 6.29); ctx.fill();
  // lago
  ctx.fillStyle = '#2f7fc9';
  ctx.beginPath(); ctx.arc(px(LAKE.x), pz(LAKE.z), (LAKE.r + 10) * S, 0, 6.29); ctx.fill();
  // vila
  ctx.fillStyle = '#c8a86a';
  ctx.beginPath(); ctx.arc(px(VILLAGE.x), pz(VILLAGE.z), 55 * S, 0, 6.29); ctx.fill();
  // ruínas
  ctx.fillStyle = '#b8ac96';
  ctx.beginPath(); ctx.arc(px(RUINS.x), pz(RUINS.z), 24 * S, 0, 6.29); ctx.fill();
  // estradas
  ctx.strokeStyle = '#b09060'; ctx.lineWidth = 3.2 * S * 1.6;
  for (const s of ROADS) {
    ctx.beginPath(); ctx.moveTo(px(s[0]), pz(s[1])); ctx.lineTo(px(s[2]), pz(s[3])); ctx.stroke();
  }
  // NPCs
  for (const n of npcList) {
    if (n.ambient) continue;
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.arc(px(n.g.position.x), pz(n.g.position.z), 3.4, 0, 6.29); ctx.fill();
  }
  // herói
  ctx.save();
  ctx.translate(px(hero.x), pz(hero.z));
  ctx.rotate(-hero.yaw);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(-5.5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
  // borda
  ctx.strokeStyle = 'rgba(255,220,160,0.5)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 3, 0, 6.29); ctx.stroke();
}

/* ---------------- menu ---------------- */
function toggleMenu() {
  if (!gameStarted) return;
  menuMode = !menuMode;
  $('menu').classList.toggle('hidden', !menuMode);
  if (menuMode) { $('btnPlay').innerHTML = '▶ Continuar'; saveWorld(false); }
}
function showMenuPanel(id) {
  for (const p of ['menuHome', 'menuLoad', 'menuCustom', 'menuHelp', 'menuAbout']) $(p).classList.add('hidden');
  $(id).classList.remove('hidden');
}
function startPlaying() {
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('minimapWrap').classList.remove('hidden');
  if (IS_TOUCH) $('touchUI').classList.remove('hidden');
  menuMode = false; gameStarted = true;
  toast('✨ Bem-vindo a <b>Andora</b>, ' + heroName + '! Explore o vale livremente.', 4200);
}
function setupMenu() {
  $('menuBg').style.backgroundImage = 'url(' + ASSETS.f3 + ')';
  $('btnPlay').onclick = () => {
    if (gameStarted) { toggleMenu(); return; }
    const slots = store.get('andora3d_mundos_v1', []);
    const last = store.get('andora3d_last', null);
    const found = slots.find(s => s.id === last);
    const go = () => { if (found) loadWorld(found); else startNew(); };
    if (!store.get('andora3d_intro_v1', 0)) playCutscene(go);
    else go();
  };
  $('btnNew').onclick = () => showMenuPanel('menuCustom');
  $('btnLoad').onclick = () => { renderSlots(); showMenuPanel('menuLoad'); };
  $('btnCustom').onclick = () => showMenuPanel('menuCustom');
  $('btnCine').onclick = () => playCutscene(null);
  $('btnHelp').onclick = () => showMenuPanel('menuHelp');
  $('btnAbout').onclick = () => showMenuPanel('menuAbout');
  for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => showMenuPanel('menuHome');
  // customização
  const chips = ['Ari', 'Lino', 'Suri', 'Téo', 'Nim'];
  const chipEl = $('nameChips');
  for (const c of chips) {
    const b = document.createElement('button'); b.className = 'chip' + (c === heroName ? ' sel' : ''); b.textContent = c;
    b.onclick = () => {
      heroName = c; $('heroNameIn').value = '';
      for (const x of chipEl.children) x.classList.remove('sel');
      b.classList.add('sel');
    };
    chipEl.appendChild(b);
  }
  $('heroNameIn').oninput = e => {
    heroName = e.target.value.trim() || 'Ari';
    for (const x of chipEl.children) x.classList.remove('sel');
  };
  const hueEl = $('hueSw');
  for (const h of HUES) {
    const b = document.createElement('button'); b.className = 'sw' + (h === heroHue ? ' sel' : '');
    b.style.background = 'hsl(' + h + ',60%,45%)';
    b.onclick = () => {
      heroHue = h;
      for (const x of hueEl.children) x.classList.remove('sel');
      b.classList.add('sel'); applyHeroStyle();
    };
    hueEl.appendChild(b);
  }
  const skinEl = $('skinSw');
  SKINS.forEach((sk, i) => {
    const b = document.createElement('button'); b.className = 'sw' + (i === heroSkin ? ' sel' : '');
    b.style.background = sk;
    b.onclick = () => {
      heroSkin = i;
      for (const x of skinEl.children) x.classList.remove('sel');
      b.classList.add('sel'); applyHeroStyle();
    };
    skinEl.appendChild(b);
  });
  $('btnStartNew').onclick = () => startNew();
  $('csSkip').onclick = () => endCutscene();
  $('dlgClose').onclick = () => { $('dialogue').classList.add('hidden'); dlgNpc = null; };
  $('btnSave').onclick = () => saveWorld(true);
  $('btnMenu').onclick = () => toggleMenu();
  $('btnMap').onclick = () => $('minimapWrap').classList.toggle('hidden');
}
function startNew() {
  heroName = ($('heroNameIn').value.trim() || heroName || 'Ari');
  friends = {}; inv = {}; flags = {};
  initQuestState();
  hour = 9; dayCount = 1; worldTime = 0;
  hero.x = 0; hero.z = 195; hero.yaw = 0; hero.y = height(0, 195) + 0.1; hero.vy = 0;
  hero.mounted = false; hero.mountedHorse = null; hero.stamina = 100;
  hero.saveId = 'w' + Date.now(); hero.saveName = 'Mundo de ' + heroName;
  applyHeroStyle();
  if (!store.get('andora3d_intro_v1', 0)) {
    playCutscene(() => { startPlaying(); saveWorld(false); });
  } else {
    startPlaying(); saveWorld(false);
  }
}

/* ---------------- física do herói ---------------- */
function updateHero(dt) {
  const keys = window._keys || {};
  let mx = input.strafe + touchMove.x;
  let mz = input.fwd + (IS_TOUCH ? -touchMove.y : 0);
  if (keys['KeyW'] || keys['ArrowUp']) mz += 1;
  if (keys['KeyS'] || keys['ArrowDown']) mz -= 1;
  if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
  const mag = Math.sqrt(mx * mx + mz * mz);
  if (mag > 1) { mx /= mag; mz /= mag; }
  const moving = mag > 0.08;
  // velocidades
  let speed = 7.6;
  const wantRun = input.run || keys['ShiftLeft'] || keys['ShiftRight'];
  if (wantRun && hero.stamina > 1 && moving) { speed = 13.2; hero.stamina = clamp(hero.stamina - 24 * dt, 0, 100); }
  else hero.stamina = clamp(hero.stamina + 15 * dt, 0, 100);
  if (hero.swimming) speed = 3.4;
  if (hero.mounted) {
    speed = 21;
    const hs = hero.mountedHorse;
    if (hs && (hs.hunger < 15 || hs.thirst < 15)) speed = 12;
    if (wantRun && hero.stamina > 1) { speed = 29; hero.stamina = clamp(hero.stamina - 16 * dt, 0, 100); }
    if (hs) {
      hs.hunger = clamp(hs.hunger - 0.28 * dt, 0, 100);
      hs.thirst = clamp(hs.thirst - 0.34 * dt, 0, 100);
    }
  }
  // direção relativa à câmera
  const cy = camYaw;
  const wx = -Math.sin(cy) * mz + Math.cos(cy) * mx;
  const wz = -Math.cos(cy) * mz - Math.sin(cy) * mx;
  if (moving) {
    hero.x += wx * speed * dt;
    hero.z += wz * speed * dt;
    hero.x = clamp(hero.x, -430, 430); hero.z = clamp(hero.z, -430, 430);
    const fixed = collideCircle(hero.x, hero.z, 0.9);
    hero.x = fixed.x; hero.z = fixed.z;
    hero.yaw = lerp(hero.yaw, Math.atan2(wx, wz), 1 - Math.exp(-10 * dt));
    hero.speed = speed;
    hero.animT += dt * (speed * 0.62);
  } else {
    hero.speed = 0;
    hero.animT += dt * 1.6;
  }
  // gravidade / chão / água
  const gh = height(hero.x, hero.z);
  hero.swimming = gh < WATER_Y - 1.2 && hero.y < WATER_Y + 0.6;
  if (hero.swimming && !hero.mounted) {
    hero.y = lerp(hero.y, WATER_Y - 0.25, dt * 5);
    hero.vy = 0;
  } else {
    hero.vy -= 26 * dt;
    hero.y += hero.vy * dt;
    const ground = hero.mounted ? gh + 1.55 : gh;
    if (hero.y <= ground) { hero.y = ground; hero.vy = 0; hero.onGround = true; }
    else hero.onGround = false;
    if (input.jump && hero.onGround && hero.stamina > 8) {
      hero.vy = hero.mounted ? 11.5 : 9.4;
      hero.stamina = clamp(hero.stamina - 8, 0, 100);
      hero.onGround = false;
    }
  }
  input.jump = false;
  hero.g.position.set(hero.x, hero.y, hero.z);
  hero.g.rotation.y = hero.yaw;
  // animação de membros
  const sw = moving ? Math.sin(hero.animT * 2.1) : 0;
  if (hero.mounted) {
    hero.legL.rotation.x = 0.65; hero.legR.rotation.x = 0.65;
    hero.armL.rotation.x = 0.5; hero.armR.rotation.x = 0.5;
  } else {
    hero.legL.rotation.x = sw * 0.62; hero.legR.rotation.x = -sw * 0.62;
    hero.armL.rotation.x = -sw * 0.5; hero.armR.rotation.x = sw * 0.5;
    if (hero.swimming) {
      hero.g.rotation.x = lerp(hero.g.rotation.x, 1.15, dt * 6);
      hero.armL.rotation.x = Math.sin(hero.animT * 4) * 1.4;
      hero.armR.rotation.x = -Math.sin(hero.animT * 4) * 1.4;
      hero.legL.rotation.x = 0.4; hero.legR.rotation.x = -0.4;
    } else hero.g.rotation.x = lerp(hero.g.rotation.x, 0, dt * 8);
  }
  // cavalo montado segue o herói
  if (hero.mounted && hero.mountedHorse) {
    const hs = hero.mountedHorse;
    hs.x = hero.x; hs.z = hero.z; hs.yaw = hero.yaw;
    hs.g.position.set(hs.x, height(hs.x, hs.z), hs.z);
    hs.g.rotation.y = hs.yaw;
    for (let i = 0; i < hs.legs.length; i++) hs.legs[i].rotation.x = moving ? Math.sin(hero.animT * 2.1 + i * 1.6) * 0.6 : 0;
    hs.head.rotation.x = 0;
    hero.g.position.y = height(hs.x, hs.z) + 1.62;
  }
  // missão "o som do lago"
  if (quests['lago'] && quests['lago'].accepted && !quests['lago'].done && !flags.lakeNight) {
    if (distTo(hero.x, hero.z, LAKE.x, LAKE.z) < LAKE.r + 26 && hour >= 18 && hour <= 22) {
      flags.lakeNight = true;
      quests['lago'].n = 1;
      toast('🌙 Você ouviu a melodia do lago ao anoitecer... volte para <b>Lyra</b>.', 4600);
    }
  }
  // dia/noite contínuo
  hour += dt / 15;
  if (hour >= 24) { hour -= 24; dayCount++; toast('🌅 Um novo dia amanhece em Andora — Dia ' + dayCount, 3000); }
  worldTime += dt;
  saveTimer += dt;
  if (saveTimer > 45) { saveTimer = 0; saveWorld(false); }
}

/* ---------------- câmera ---------------- */
function updateCamera(dt) {
  if (!gameStarted) {
    // órbita cinematográfica da vila no menu
    const a = worldTime * 0.07;
    camera.position.set(VILLAGE.x + Math.cos(a) * 95, 34, VILLAGE.z + Math.sin(a) * 95);
    camera.lookAt(VILLAGE.x, 6, VILLAGE.z);
    return;
  }
  const target = new THREE.Vector3(hero.x, hero.y + (hero.mounted ? 2.2 : 1.9), hero.z);
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  const desired = new THREE.Vector3(
    target.x + Math.sin(camYaw) * cp * camDist,
    target.y + sp * camDist + 1.6,
    target.z + Math.cos(camYaw) * cp * camDist
  );
  const gy = height(desired.x, desired.z) + 1.4;
  if (desired.y < gy) desired.y = gy;
  const fixed = collideCircle(desired.x, desired.z, 0.5);
  desired.x = fixed.x; desired.z = fixed.z;
  camera.position.lerp(desired, 1 - Math.exp(-7 * dt));
  camera.lookAt(target);
}

/* ---------------- loop principal ---------------- */
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = worldTime;
  if (gameStarted && !menuMode && !dlgNpc) updateHero(dt);
  if (hero) updateCamera(dt);
  updateSky();
  for (const fn of animatables) fn(t, dt);
  for (const hs of horseList) horseThink(hs, dt);
  for (const an of animalList) animalThink(an, dt);
  for (const b of birds) {
    b.a += b.spd * dt;
    b.g.position.set(b.cx + Math.cos(b.a) * b.r, b.y + Math.sin(b.a * 2) * 3, b.cz + Math.sin(b.a) * b.r);
    b.g.rotation.y = -b.a + Math.PI / 2;
    const flap = Math.sin(t * 7 + b.a * 3) * 0.7;
    b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
  }
  for (const c of clouds) {
    c.position.x += dt * 1.6;
    if (c.position.x > 420) c.position.x = -420;
  }
  // NPCs: balanço suave e passeio dos ambientes
  for (const n of npcList) {
    n.animT += dt;
    if (n.ambient) {
      n.wanderT -= dt;
      if (n.wanderT <= 0) { n.wanderT = rand(4, 10); n.yaw = rand(0, 6.28); }
      const nx = n.x + Math.sin(n.yaw) * 1.5 * dt, nz = n.z + Math.cos(n.yaw) * 1.5 * dt;
      if (distTo(nx, nz, n.homeX, n.homeZ) < 26 && height(nx, nz) > 1.5) { n.x = nx; n.z = nz; }
      else n.yaw += 2.4 * dt;
      n.g.position.set(n.x, height(n.x, n.z), n.z);
      n.g.rotation.y = n.yaw;
    } else {
      n.g.rotation.y = Math.sin(n.animT * 0.4) * 0.3 + Math.atan2(hero.x - n.g.position.x, hero.z - n.g.position.z) * 0.25;
    }
  }
  // prompt de interação
  if (gameStarted && !menuMode && !dlgNpc) {
    const it = nearestInteractable();
    const pr = $('prompt');
    if (it) { pr.classList.remove('hidden'); pr.innerHTML = (IS_TOUCH ? '👆 Toque em 💬 usar · ' : 'E · ') + it.label; }
    else pr.classList.add('hidden');
    updateHUD();
    if (t - (animate._mm || 0) > 0.24) { animate._mm = t; drawMinimap(); }
  }
  renderer.render(scene, camera);
}

/* ---------------- boot ---------------- */
function boot() {
  const canvas = $('game');
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH, powerPreference: 'high-performance' });
  } catch (e) {
    $('loading').innerHTML = '<div style="text-align:center;padding:24px;max-width:520px;line-height:1.7">' +
      '<div style="font-size:44px">🎮</div>' +
      '<h2 style="color:#ffe6b3;letter-spacing:1px">Quase lá!</h2>' +
      '<p style="opacity:.92;font-size:14px">Este visualizador embutido <b>não roda gráficos 3D (WebGL)</b>. ' +
      'Mas o jogo funciona normalmente em qualquer navegador de verdade!</p>' +
      '<p style="opacity:.92;font-size:14px">Abra o link publicado no <b>Chrome do seu celular</b> ' +
      '(ou clique no preview do servidor "Andora 3D") e jogue em tela cheia. ✨</p></div>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.8 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x7ec8f2, 0.0021);
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 12, 180);
  clock = new THREE.Clock();
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });
  setupSky();
  buildTerrain();
  buildNature();
  buildVillage();
  buildLanterns();
  hero = makeHero();
  hero.g.position.set(hero.x, height(hero.x, hero.z), hero.z);
  applyHeroStyle();
  horseList.push(makeHorse(-70, 268, 0xa8785a, 0x4a2e1c));
  horseList.push(makeHorse(46, 152, 0x7a5238, 0x2e1c12));
  horseList.push(makeHorse(150, 30, 0xd8c0a0, 0xa89070));
  horseList.push(makeHorse(-150, -80, 0x5a4030, 0x241812));
  horseList.push(makeHorse(24, -230, 0x8a6a4a, 0x3a2818));
  buildNPCs();
  buildAnimals();
  buildBirds();
  buildPickups();
  initQuestState();
  setupInput();
  setupMenu();
  updateSky();
  animate();
  setTimeout(() => $('loading').classList.add('hidden'), 350);
  // PWA (só quando hospedado em http/https — no preview local falha em silêncio)
  try {
    if (location.protocol.indexOf('http') === 0 && navigator.serviceWorker) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  } catch (e) {}
}
/* hook de depuração/teste automático (não interfere no jogo) */
window.__andora = {
  get hero() { return hero; },
  get npcs() { return npcList; },
  warp: (x, z) => { hero.x = x; hero.z = z; hero.y = height(x, z); },
  interact: () => doInteract(),
  setHour: h => { hour = h; }
};
boot();
