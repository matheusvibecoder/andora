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
  const md = distTo(x, z, MOUNT.x, MOUNT.z);
  const mMask = Math.exp(-(md * md) / 28800);
  const ridge = 1 - Math.abs(fbm(x * 0.011 + 3, z * 0.011 + 9) - 0.5) * 2;
  h += (72 + 34 * ridge * ridge) * mMask;
  const md2 = distTo(x, z, -160, -380); h += 52 * Math.exp(-(md2 * md2) / 16200);
  const ld = distTo(x, z, LAKE.x, LAKE.z); h -= 34 * Math.exp(-(ld * ld) / 22000);
  const vd = distTo(x, z, VILLAGE.x, VILLAGE.z); const vf = Math.max(0, 1 - vd / 75); h = h * (1 - vf * 0.92) + 3 * vf * 0.92;
  const rd = distTo(x, z, RUINS.x, RUINS.z); const rf = Math.max(0, 1 - rd / 48); h = h * (1 - rf * 0.75) + 11 * rf * 0.75;
  const far = clamp((Math.sqrt(x * x + z * z) - 520) / 320, 0, 1);
  if (far > 0) {
    const rm = vnoise(x * 0.0021 + 55, z * 0.0021 + 17);
    const rmask = Math.max(0, (rm - 0.56) / 0.44);
    const ridge2 = 1 - Math.abs(fbm(x * 0.0085 + 13, z * 0.0085 + 29) - 0.5) * 2;
    h += far * rmask * rmask * (52 + 58 * ridge2 * ridge2);
  }
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
function terrainColor(x, z, h, out, slopeIn) {
  const road = roadFactor(x, z);
  let slope;
  if (slopeIn !== undefined) slope = slopeIn;
  else {
    const hx = height(x + 2.5, z) - height(x - 2.5, z), hz = height(x, z + 2.5) - height(x, z - 2.5);
    slope = Math.sqrt(hx * hx + hz * hz) / 5;
  }
  const n = fbm(x * 0.02 + 40, z * 0.02 + 17);
  const n2 = fbm(x * 0.006 + 11, z * 0.006 + 5);
  let r, g, b;
  if (h > 48) {
    const t = clamp((h - 48) / 26, 0, 1);
    r = lerp(0.33, 0.87, t); g = lerp(0.34, 0.9, t); b = lerp(0.38, 0.94, t);
  } else if (h > 26 || slope > 0.85) {
    const t = clamp(clamp((h - 26) / 22, 0, 1) * 0.75 + clamp(slope - 0.85, 0, 0.6) * 0.7, 0, 1);
    const stri = (fbm(x * 0.06 + 3, z * 0.06 + 77) - 0.5) * 0.14;
    r = lerp(0.29, 0.5, t) + stri; g = lerp(0.27, 0.45, t) + stri; b = lerp(0.25, 0.41, t) + stri * 0.8;
  } else if (h < WATER_Y + 1.1 && distTo(x, z, LAKE.x, LAKE.z) < LAKE.r + 125) {
    r = 0.72; g = 0.64; b = 0.48;
  } else {
    const t = clamp(n * 0.65 + n2 * 0.45, 0, 1);
    r = lerp(0.17, 0.335, t) * 0.8; g = lerp(0.3, 0.5, t); b = lerp(0.1, 0.195, t);
    const warm = clamp((n2 - 0.55) * 2.2, 0, 1) * 0.2;
    r += warm; g += warm * 0.72;
    const dry = clamp((fbm(x * 0.012 + 60, z * 0.012 + 21) - 0.52) * 2.6, 0, 1) * 0.15;
    r += dry; g += dry * 0.82; b += dry * 0.32;
    const cool = clamp((fbm(x * 0.02 + 90, z * 0.02 + 40) - 0.58) * 2.8, 0, 1) * 0.1;
    g += cool; b += cool * 1.15;
  }
  if (road > 0) { const t = road * 0.85; r = lerp(r, 0.52, t); g = lerp(g, 0.41, t); b = lerp(b, 0.28, t); }
  out.setRGB(r, g, b);
}

/* ---------------- estado do jogo ---------------- */
let scene, camera, renderer, clock, skyDome;
let sun, moon, hemi, stars, sunSprite, moonSprite, glowTex, lanternGlowMats = [], lanternCoreMats = [];
let sunDir = new THREE.Vector3(0, 1, 0), cloudMatG = null, motePts = null, sunCore = null, leafPts = null, gradeEl = null;
let windowMats = [];
let reflRT = null, reflCam = null;
const windU = { value: 0 };
const _reflDir = new THREE.Vector3(), _reflLook = new THREE.Vector3(), _reflTexMat = new THREE.Matrix4();
let frameCount = 0, qualityLevel = IS_TOUCH ? 1 : 2, wdLast = (typeof performance !== 'undefined' ? performance.now() : Date.now()), wdFrames = 0, upGood = 0;
function applyQuality() {
  if (!renderer) return;
  const q = qualityLevel;
  if (bloomPass) bloomPass.enabled = q >= 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q >= 2 ? 1.35 : (q === 1 ? 1.15 : 1)));
  if (motePts) motePts.visible = q >= 2;
  if (leafPts) leafPts.visible = q >= 2;
  if (sun) sun.castShadow = q >= 1;
  if (cloudMatG) cloudMatG.opacity = q >= 2 ? 1 : 0.55;
  if (water && water.material.uniforms.uReflOn && q < 1) water.material.uniforms.uReflOn.value = 0;
  if (seedNature) seedNature();
  updateChunks(true);
}
let terrain = null, water;
const CHUNK = 100, CHUNK_SEGS = 18;
const chunkMap = new Map();
let terrainMatShared = null, chunkR = IS_TOUCH ? 5 : 7, lastChunkGX = 999999, lastChunkGZ = 999999;
let seedX = 1e9, seedZ = 1e9, seedNature = null, seedQueue = [], seedSlice = null;
const _sunProbe = new THREE.Vector3(), _sunProbe2 = new THREE.Vector3();
let hero = null, horseList = [], npcList = [], animalList = [], pickupList = [], lanternList = [], clouds = [], birds = [];
let windmillBlades = null;
const animatables = [];
let hour = 9, dayCount = 1, worldTime = 0, gameStarted = false, menuMode = true, paused = false;
let friends = {}, quests = {}, inv = {}, flags = {};
const input = { fwd: 0, strafe: 0, run: false, jump: false };
const touchMove = { x: 0, y: 0 };
let camYaw = 0, camPitch = 0.17, camDist = IS_TOUCH ? 16.5 : 13;
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
/* ---------------- texturas procedurais (sem downloads — roda em qualquer lugar) ---------------- */
function makeTexture(size, drawFn) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  drawFn(x, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function texClone(t, rx, ry) {
  const c = t.clone(); c.needsUpdate = true;
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  return c;
}
const texCobble = makeTexture(256, (x, s) => {
  x.fillStyle = '#8f8472'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 230; i++) {
    const px = Math.random() * s, py = Math.random() * s, r = 7 + Math.random() * 12;
    const v = 125 + Math.floor(Math.random() * 75);
    x.fillStyle = 'rgb(' + (v + 20) + ',' + (v + 12) + ',' + v + ')';
    x.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * 6.28, rr = r * (0.78 + Math.random() * 0.4);
      const qx = px + Math.cos(a) * rr, qy = py + Math.sin(a) * rr;
      if (k === 0) x.moveTo(qx, qy); else x.lineTo(qx, qy);
    }
    x.closePath(); x.fill();
    x.strokeStyle = 'rgba(62,54,44,0.6)'; x.lineWidth = 2.4; x.stroke();
  }
});
const texStripe = makeTexture(128, (x, s) => {
  for (let i = 0; i < 8; i++) {
    x.fillStyle = i % 2 ? '#f8f4ea' : '#5c5c5c';
    x.fillRect((i / 8) * s, 0, s / 8 + 1, s);
  }
});
const texDetail = makeTexture(256, (x, s) => {
  const img = x.createImageData(s, s);
  for (let py = 0; py < s; py++) {
    for (let px = 0; px < s; px++) {
      const n1 = fbm(px * 0.038, py * 0.038), n2 = fbm(px * 0.115 + 9.2, py * 0.115 + 4.7), n3 = fbm(px * 0.31 + 2.1, py * 0.31 + 8.3);
      const v = 198 + (n1 - 0.5) * 132 + (n2 - 0.5) * 86 + (n3 - 0.5) * 48;
      const i = (py * s + px) * 4;
      img.data[i] = Math.max(0, Math.min(255, v));
      img.data[i + 1] = Math.max(0, Math.min(255, v + 5));
      img.data[i + 2] = Math.max(0, Math.min(255, v - 3));
      img.data[i + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  for (let i = 0; i < 380; i++) {
    const v = 150 + Math.floor(Math.random() * 95);
    x.strokeStyle = 'rgba(' + v + ',' + v + ',' + (v - 8) + ',0.3)';
    x.lineWidth = 1 + Math.random() * 1.6;
    const px = Math.random() * s, py = Math.random() * s, a = Math.random() * 6.28, l = 4 + Math.random() * 13;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
});
const texPlaster = makeTexture(256, (x, s) => {
  x.fillStyle = '#d8d2c6'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 46; i++) {
    const px = Math.random() * s, py = Math.random() * s;
    const rx = 22 + Math.random() * 52, ry = 12 + Math.random() * 26, a = Math.random() * 3.14;
    const v = 196 + Math.floor(Math.random() * 46);
    x.save(); x.translate(px, py); x.rotate(a);
    const gr = x.createRadialGradient(0, 0, 2, 0, 0, rx);
    gr.addColorStop(0, 'rgba(' + v + ',' + (v - 4) + ',' + (v - 12) + ',0.5)');
    gr.addColorStop(1, 'rgba(' + v + ',' + (v - 4) + ',' + (v - 12) + ',0)');
    x.fillStyle = gr;
    x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, 6.28); x.fill();
    x.restore();
  }
  for (let i = 0; i < 900; i++) {
    const v = 150 + Math.floor(Math.random() * 90);
    x.fillStyle = 'rgba(' + v + ',' + (v - 8) + ',' + (v - 18) + ',0.16)';
    x.fillRect(Math.random() * s, Math.random() * s, 1.6, 1.6);
  }
  for (let i = 0; i < 14; i++) {
    x.strokeStyle = 'rgba(96,82,66,0.22)'; x.lineWidth = 0.9;
    let px = Math.random() * s, py = Math.random() * s;
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 7; k++) { px += Math.random() * 26 - 13; py += Math.random() * 18 - 6; x.lineTo(px, py); }
    x.stroke();
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.random() * 14 - 7, py + Math.random() * 12); x.stroke();
  }
});
const texTiles = makeTexture(256, (x, s) => {
  x.fillStyle = '#8a6a56'; x.fillRect(0, 0, s, s);
  const rows = 7, th = s / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (s / 8);
    for (let c2 = -1; c2 < 8; c2++) {
      const tw = s / 7.2;
      const px = c2 * tw + off, py = r * th;
      const v = 0.82 + Math.random() * 0.36;
      const gr = x.createLinearGradient(0, py, 0, py + th);
      gr.addColorStop(0, 'rgba(' + Math.floor(150 * v) + ',' + Math.floor(96 * v) + ',' + Math.floor(74 * v) + ',1)');
      gr.addColorStop(1, 'rgba(' + Math.floor(112 * v) + ',' + Math.floor(70 * v) + ',' + Math.floor(54 * v) + ',1)');
      x.fillStyle = gr;
      x.beginPath();
      x.moveTo(px + 1, py + 1);
      x.lineTo(px + tw - 1, py + 1);
      x.lineTo(px + tw - 1, py + th * 0.72);
      x.quadraticCurveTo(px + tw / 2, py + th * 1.06, px + 1, py + th * 0.72);
      x.closePath(); x.fill();
      x.strokeStyle = 'rgba(52,34,24,0.55)'; x.lineWidth = 1.6; x.stroke();
    }
  }
});
const texWood = makeTexture(128, (x, s) => {
  x.fillStyle = '#a98a6a'; x.fillRect(0, 0, s, s);
  const planks = 4, ph = s / planks;
  for (let p2 = 0; p2 < planks; p2++) {
    const py = p2 * ph;
    const v = 0.82 + Math.random() * 0.32;
    x.fillStyle = 'rgba(' + Math.floor(168 * v) + ',' + Math.floor(132 * v) + ',' + Math.floor(96 * v) + ',1)';
    x.fillRect(0, py, s, ph - 1.5);
    x.fillStyle = 'rgba(58,38,22,0.5)'; x.fillRect(0, py + ph - 1.8, s, 1.8);
    for (let i = 0; i < 16; i++) {
      const v2 = 62 + Math.floor(Math.random() * 60);
      x.strokeStyle = 'rgba(' + v2 + ',' + Math.floor(v2 * 0.72) + ',' + Math.floor(v2 * 0.46) + ',0.4)';
      x.lineWidth = 1 + Math.random() * 2;
      const gy = py + Math.random() * (ph - 3);
      x.beginPath(); x.moveTo(0, gy);
      for (let k = 0; k < 4; k++) x.lineTo((k + 1) * s / 4, gy + (Math.random() * 4 - 2));
      x.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const kx = Math.random() * s, ky = py + 4 + Math.random() * (ph - 10);
      x.strokeStyle = 'rgba(74,48,28,0.55)'; x.lineWidth = 1.3;
      for (let rr = 1; rr <= 3; rr++) { x.beginPath(); x.ellipse(kx, ky, rr * 2.1, rr * 1.15, 0.5, 0, 6.28); x.stroke(); }
    }
  }
});
const texCloth = makeTexture(128, (x, s) => {
  x.fillStyle = '#d8d4d0'; x.fillRect(0, 0, s, s);
  const step = 5;
  for (let yy = 0; yy < s; yy += step) {
    for (let xx = 0; xx < s; xx += step) {
      const on = ((xx / step) + (yy / step)) % 2 < 1;
      const v = on ? 212 : 188;
      x.fillStyle = 'rgba(' + v + ',' + (v - 3) + ',' + (v - 7) + ',0.65)';
      x.fillRect(xx, yy, step - 1.4, on ? step * 0.62 : step * 0.4);
    }
  }
  for (let i = 0; i < 240; i++) {
    const v = 150 + Math.floor(Math.random() * 90);
    x.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 6) + ',0.16)';
    x.fillRect(Math.random() * s, Math.random() * s, 1.7, 1.7);
  }
});
const texBlade = makeTexture(128, (x, s) => {
  x.clearRect(0, 0, s, s);
  for (let i = 0; i < 52; i++) {
    const bx = Math.random() * s, h = s * (0.32 + Math.random() * 0.62), w = 2 + Math.random() * 5.5;
    const g1 = 105 + Math.floor(Math.random() * 125);
    const warm = Math.random() * 0.16;
    x.fillStyle = 'rgb(' + Math.floor(g1 * (0.5 + warm)) + ',' + g1 + ',' + Math.floor(g1 * 0.38) + ')';
    const bend = (Math.random() * 14 - 7);
    x.beginPath();
    x.moveTo(bx - w, s);
    x.quadraticCurveTo(bx - w * 0.15, s - h * 0.6, bx + bend, s - h);
    x.quadraticCurveTo(bx + w * 0.15, s - h * 0.6, bx + w, s);
    x.closePath(); x.fill();
  }
});
const texLeaf = makeTexture(64, (x, s) => {
  x.clearRect(0, 0, s, s);
  x.fillStyle = '#9ab848';
  x.beginPath(); x.ellipse ? x.ellipse(s / 2, s / 2, s * 0.26, s * 0.4, 0.6, 0, 6.28) : x.arc(s / 2, s / 2, s * 0.3, 0, 6.28);
  x.fill();
  x.strokeStyle = 'rgba(80,100,40,0.7)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(s / 2, s * 0.18); x.lineTo(s / 2, s * 0.82); x.stroke();
});
const texPuff = makeTexture(128, (x, s) => {
  x.clearRect(0, 0, s, s);
  for (let i = 0; i < 24; i++) {
    const px = s * (0.15 + Math.random() * 0.7), py = s * (0.28 + Math.random() * 0.42), r = s * (0.07 + Math.random() * 0.17);
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 6.28); x.fill();
  }
});

function addWind(mat, amp) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTimeW = windU;
    shader.vertexShader = 'uniform float uTimeW;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nfloat wph = 0.0;\n#ifdef USE_INSTANCING\n wph = instanceMatrix[3][0] * 0.31 + instanceMatrix[3][2] * 0.47;\n#endif\nfloat wbend = sin(uTimeW * 1.7 + wph) * 0.6 + sin(uTimeW * 0.83 + wph * 1.9) * 0.4;\ntransformed.x += wbend * AMPVAL * max(transformed.y, 0.0);\ntransformed.z += wbend * AMPVAL * 0.6 * max(transformed.y, 0.0);'.replace(/AMPVAL/g, amp.toFixed(3))
    );
  };
}

/* ---------------- engine: IBL (luz por imagem) + pos-processamento PBR ---------------- */
let envRT = null, envPMREM = null, envHour = -99;
let composer = null, bloomPass = null, composerOn = false, gradePass = null;
function updateEnvironment(force) {
  try {
    if (!renderer || !THREE.PMREMGenerator) return;
    if (!envPMREM) envPMREM = new THREE.PMREMGenerator(renderer);
    if (!force && Math.abs(hour - envHour) < 2.5) return;
    envHour = hour;
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    const elev = Math.sin((hour - 6) / 12 * Math.PI);
    const dayF = clamp(elev * 1.6 + 0.35, 0, 1);
    const duskF = clamp(1 - Math.abs(hour - 18.6) / 2.2, 0, 1) + clamp(1 - Math.abs(hour - 6.2) / 1.6, 0, 1);
    const g = x.createLinearGradient(0, 0, 0, 128);
    const dim = 0.5;
    const top = [lerp(12, 47, dayF) + duskF * 42, lerp(18, 108, dayF) + duskF * 10, lerp(42, 196, dayF)];
    const hor = [lerp(26, 168, dayF) + duskF * 62, lerp(42, 212, dayF) + duskF * 18, lerp(78, 236, dayF) - duskF * 50];
    const gnd = [lerp(18, 72, dayF), lerp(26, 96, dayF), lerp(18, 56, dayF)];
    for (const arr of [top, hor, gnd]) { arr[0] *= dim; arr[1] *= dim; arr[2] *= dim; }
    g.addColorStop(0, 'rgb(' + top.map(Math.round) + ')');
    g.addColorStop(0.52, 'rgb(' + hor.map(Math.round) + ')');
    g.addColorStop(0.58, 'rgb(' + gnd.map(Math.round) + ')');
    g.addColorStop(1, 'rgb(' + [gnd[0] * 0.7, gnd[1] * 0.7, gnd[2] * 0.7].map(Math.round) + ')');
    x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    const sa = (hour - 6) / 12 * Math.PI;
    const sx = 128 + Math.cos(sa) * 100, sy = 60 - Math.sin(sa) * 48;
    const sg = x.createRadialGradient(sx, sy, 2, sx, sy, 36);
    sg.addColorStop(0, 'rgba(255,240,200,1)');
    sg.addColorStop(0.25, 'rgba(255,190,120,0.5)');
    sg.addColorStop(1, 'rgba(255,160,90,0)');
    x.fillStyle = sg; x.fillRect(0, 0, 256, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const rt = envPMREM.fromEquirectangular(tex);
    if (envRT) envRT.dispose();
    envRT = rt;
    scene.environment = envRT.texture;
    tex.dispose();
  } catch (e) { /* ambientes sem PMREM continuam com a luz clássica */ }
}
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.34 },
    uGrain: { value: 0.005 }, uCA: { value: 0.0008 }, uExp: { value: 0.56 }, uRain: { value: 0 },
    uSunUV: { value: new THREE.Vector2(0.5, 0.5) }, uSunVis: { value: 0 }, uSunColG: { value: new THREE.Color(0xffe9c0) }
  },
  vertexShader: 'varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform float uTime; uniform float uVig; uniform float uGrain; uniform float uCA; uniform float uExp;',
    'uniform vec2 uSunUV; uniform float uSunVis; uniform vec3 uSunColG; uniform float uRain;',
    'varying vec2 vUv;',
    'vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }',
    'void main(){',
    '  vec2 uv = vUv; vec2 cc = uv - 0.5; float r2 = dot(cc, cc);',
    '  float ca = uCA * (0.35 + r2 * 2.2);',
    '  vec3 col;',
    '  col.r = texture2D(tDiffuse, uv + cc * ca).r;',
    '  col.g = texture2D(tDiffuse, uv).g;',
    '  col.b = texture2D(tDiffuse, uv - cc * ca).b;',
    '  col = aces(col * uExp);',
    '  float lum = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col = mix(vec3(lum), col, 1.14);',
    '  col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);',
    '  float lum2 = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col += vec3(0.032, 0.01, -0.028) * (lum2 * lum2);',
    '  col += vec3(-0.018, -0.004, 0.032) * ((1.0 - lum2) * (1.0 - lum2));',
    '  col = mix(vec3(lum2), col, 1.05);',
    '  vec2 sd2 = uv - uSunUV;',
    '  float dsun = length(sd2);',
    '  float glare = exp(-dsun * 6.0) * 0.38 + exp(-dsun * 18.0) * 0.85;',
    '  col += uSunColG * glare * uSunVis;',
    '  float streak = exp(-abs(sd2.y) * 42.0) * exp(-abs(sd2.x) * 2.2) * 0.3;',
    '  col += uSunColG * streak * uSunVis;',
    '  if (uRain > 0.002) {',
    '    vec2 ruv2 = uv * vec2(95.0, 5.5);',
    '    ruv2.y += uTime * 4.2; ruv2.x += uTime * 0.14;',
    '    float r1 = fract(sin(dot(floor(ruv2), vec2(12.9898, 78.233))) * 43758.5453);',
    '    float rstreak = smoothstep(0.965, 1.0, r1) * (1.0 - fract(ruv2.y));',
    '    col += vec3(0.52, 0.6, 0.72) * rstreak * uRain * 0.26;',
    '  }',
    '  col *= 1.0 - uVig * r2 * 1.5;',
    '  float g = fract(sin(dot(uv * 761.31 + uTime, vec2(12.9898, 78.233))) * 43758.5453);',
    '  col += (g - 0.5) * uGrain;',
    '  col = pow(max(col, 0.0), vec3(0.4545));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n')
};
function setupComposer() {
  try {
    if (!THREE.EffectComposer || !THREE.UnrealBloomPass) return;
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(Math.floor(window.innerWidth * 0.5), Math.floor(window.innerHeight * 0.5)), 0.28, 0.5, 0.88);
    composer.addPass(bloomPass);
    if (THREE.ShaderPass) {
      gradePass = new THREE.ShaderPass(GradeShader);
      gradePass.renderToScreen = true;
      composer.addPass(gradePass);
    }
    composerOn = true;
    animatables.push(t => { if (gradePass) gradePass.uniforms.uTime.value = t; });
  } catch (e) { composer = null; bloomPass = null; composerOn = false; gradePass = null; }
}
function setupSky() {
  hemi = new THREE.HemisphereLight(0x9fd4ff, 0x5a7a4a, 0.5); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffe6c0, 1.05); sun.position.set(120, 200, 80); scene.add(sun);
  sun.castShadow = true;
  sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
  sun.shadow.camera.near = 40; sun.shadow.camera.far = 800;
  sun.shadow.camera.left = -115; sun.shadow.camera.right = 115;
  sun.shadow.camera.top = 115; sun.shadow.camera.bottom = -115;
  sun.shadow.bias = -0.0018; sun.shadow.normalBias = 0.55;
  scene.add(sun.target);
  moon = new THREE.DirectionalLight(0x8fb4ff, 0.12); moon.position.set(-120, 180, -80); scene.add(moon);
  scene.add(moon.target);
  const fill = new THREE.DirectionalLight(0x86a8d8, 0.22); fill.position.set(-220, 140, -180); scene.add(fill);
  glowTex = makeGlowTexture();
  // domo do céu com gradiente vertical (topo → horizonte)
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x2f6cc4) },
      bottomColor: { value: new THREE.Color(0xa8d4ec) },
      offset: { value: 28 },
      exponent: { value: 0.72 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color(0xffe9c0) },
      uTime: { value: 0 },
      uCloudAmt: { value: 0.52 }
    },
    vertexShader: 'varying vec3 vWP;\nvoid main(){\n vec4 wp = modelMatrix * vec4(position,1.0);\n vWP = wp.xyz;\n gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);\n}',
    fragmentShader: [
      'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent;',
      'uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uTime; uniform float uCloudAmt;',
      'varying vec3 vWP;',
      'float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
      'float vnoise2(vec2 p){',
      '  vec2 i = floor(p), f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0)), c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));',
      '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
      '}',
      'float fbm2(vec2 p){ float s = 0.0, a = 0.55; for (int k = 0; k < 4; k++){ s += a * vnoise2(p); p = p * 2.13 + 17.7; a *= 0.5; } return s; }',
      'void main(){',
      '  vec3 dir = normalize(vWP);',
      '  float h = normalize(vWP + vec3(0.0, offset, 0.0)).y;',
      '  vec3 col = mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0));',
      '  float sd = max(dot(dir, normalize(uSunDir)), 0.0);',
      '  float disc = pow(sd, 900.0) * 2.2;',
      '  float halo = pow(sd, 22.0) * 0.5 + pow(sd, 5.0) * 0.16;',
      '  col += uSunCol * (disc + halo);',
      '  float horiz = smoothstep(0.02, 0.16, dir.y);',
      '  vec2 cuv = dir.xz / max(dir.y, 0.12) * 1.35;',
      '  cuv += vec2(uTime * 0.0045, uTime * 0.0017);',
      '  float n1 = fbm2(cuv * 0.55);',
      '  float n2 = fbm2(cuv * 1.4 + 40.0);',
      '  float cov = smoothstep(0.52 - uCloudAmt * 0.22, 0.78 - uCloudAmt * 0.12, n1 * 0.72 + n2 * 0.28);',
      '  cov *= horiz;',
      '  float sunSide = 0.45 + 0.55 * pow(sd, 1.6);',
      '  vec3 cloudCol = mix(bottomColor * 0.82, vec3(1.04, 1.02, 0.99) * (0.28 + 0.85 * sunSide), 0.78);',
      '  cloudCol += uSunCol * pow(sd, 8.0) * 0.35;',
      '  col = mix(col, cloudCol, cov * 0.88);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });
  skyDome = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 12), skyMat);
  skyDome.renderOrder = -10;
  skyDome.frustumCulled = false;
  scene.add(skyDome);
  sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe9b0, transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
  sunSprite.scale.set(110, 110, 1); sunSprite.renderOrder = -4; scene.add(sunSprite);
  sunCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff8e0, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  sunCore.scale.set(30, 30, 1); sunCore.renderOrder = -4; scene.add(sunCore);
  moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xcfe0ff, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
  moonSprite.scale.set(55, 55, 1); moonSprite.renderOrder = -4; scene.add(moonSprite);
  // estrelas
  const sg = new THREE.BufferGeometry(); const n = 380; const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 0.48 + 0.06, r = 470;
    pos[i * 3] = Math.cos(a) * Math.cos(b) * r; pos[i * 3 + 1] = Math.sin(b) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
  }
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.1, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  stars.renderOrder = -5; scene.add(stars);
  // nuvens agora vivem no shader do ceu (mais reais e mais leves)
  // pólumen dourado flutuando (só de dia)
  const mg = new THREE.BufferGeometry();
  const mn = 140, mpos = new Float32Array(mn * 3);
  for (let i = 0; i < mn; i++) {
    mpos[i * 3] = rand(-140, 140);
    mpos[i * 3 + 1] = rand(1.2, 7);
    mpos[i * 3 + 2] = rand(20, 240);
  }
  mg.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
  motePts = new THREE.Points(mg, new THREE.PointsMaterial({ map: glowTex, color: 0xfff0c0, size: 1.6, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  scene.add(motePts);
  animatables.push(t => {
    motePts.rotation.y = t * 0.012;
    motePts.position.y = Math.sin(t * 0.25) * 0.9;
  });
  // folhas ao vento
  const lg = new THREE.BufferGeometry();
  const ln = 90, lpos = new Float32Array(ln * 3);
  for (let i = 0; i < ln; i++) {
    lpos[i * 3] = rand(-380, 380);
    lpos[i * 3 + 1] = rand(2, 13);
    lpos[i * 3 + 2] = rand(-380, 380);
  }
  lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
  leafPts = new THREE.Points(lg, new THREE.PointsMaterial({ map: texLeaf, color: 0xc8d878, size: 2.3, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  scene.add(leafPts);
  animatables.push(t => {
    leafPts.rotation.y = t * 0.024;
    leafPts.position.y = -((t * 0.55) % 9);
  });
}
const cNightTop = new THREE.Color(0x0b1026), cDayTop = new THREE.Color(0x2f6cc4), cDuskTop = new THREE.Color(0x6a4c93);
const cNightBot = new THREE.Color(0x1a2a4a), cDayBot = new THREE.Color(0xa8d4ec), cDuskBot = new THREE.Color(0xf2925c);
const cSkyTmp = new THREE.Color();
const cSunWarm = new THREE.Color(0xffb078), cSunNoon = new THREE.Color(0xfff3e2), cSunDusk = new THREE.Color(0xff9058);
function sunAngle() { return (hour - 6) / 12 * Math.PI; }
/* ---------------- clima: chuva que molha o mundo ---------------- */
const weather = { rain: 0, target: 0, timer: 30 };
function updateWeather(dt) {
  if (typeof cutActive !== 'undefined' && cutActive) return;
  weather.timer -= dt;
  if (weather.timer <= 0) {
    weather.timer = rand(38, 95);
    weather.target = Math.random() < 0.45 ? rand(0.35, 0.9) : 0;
  }
  weather.rain += (weather.target - weather.rain) * Math.min(1, dt * 0.22);
  if (terrainMatShared && terrainMatShared.userData.sh && terrainMatShared.userData.sh.uniforms.uWet) {
    terrainMatShared.userData.sh.uniforms.uWet.value = weather.rain;
  }
  if (gradePass) gradePass.uniforms.uRain.value = weather.rain;
  if (scene.fog) scene.fog.density = 0.0019 * (1 + weather.rain * 0.85);
  if (Amb && Amb.ctx && Amb.rainGain) {
    Amb.rainGain.gain.value += (weather.rain * 0.15 - Amb.rainGain.gain.value) * Math.min(1, dt * 1.2);
  }
}
function updateSky() {
  const a = sunAngle(), elev = Math.sin(a);
  const dayF = clamp(elev * 1.6 + 0.12, 0, 1);
  const duskF = clamp(1 - Math.abs(elev) * 1.9, 0, 1);
  const u = skyDome.material.uniforms;
  u.topColor.value.copy(cNightTop).lerp(cDayTop, dayF).lerp(cDuskTop, duskF * 0.75);
  u.bottomColor.value.copy(cNightBot).lerp(cDayBot, dayF).lerp(cDuskBot, duskF * 0.85);
  cSkyTmp.copy(u.bottomColor.value);
  scene.background = cSkyTmp;
  scene.fog.color.copy(cSkyTmp);
  sunDir.set(Math.cos(a) * 380, Math.sin(a) * 380, Math.sin(a * 0.6) * 240).normalize();
  const hx = hero ? hero.x : 0, hy = hero ? hero.y : 0, hz = hero ? hero.z : 0;
  sun.position.set(hx + sunDir.x * 320, hy + sunDir.y * 320, hz + sunDir.z * 320);
  sun.target.position.set(hx, hy, hz);
  sun.intensity = Math.max(0, elev) * 0.92;
  moon.position.set(hx - sunDir.x * 320, hy - sunDir.y * 320, hz - sunDir.z * 320);
  moon.target.position.set(hx, hy, hz);
  moon.intensity = clamp(-elev, 0, 1) * 0.14 + 0.035;
  hemi.intensity = 0.07 + dayF * 0.17;
  stars.material.opacity = clamp(1 - dayF * 1.9, 0, 0.9);
  const nightF = clamp(1 - dayF * 1.55, 0, 1);
  if (cloudMatG) cloudMatG.color.setRGB(Math.min(0.62 + dayF * 0.38 + duskF * 0.18, 1), Math.min(0.62 + dayF * 0.38 + duskF * 0.02, 1), Math.max(0.66 + dayF * 0.34 - duskF * 0.12, 0));
  if (motePts) motePts.material.opacity = dayF * 0.26 * (1 - duskF * 0.5);
  for (let i = 0; i < lanternGlowMats.length; i++) lanternGlowMats[i].opacity = 0.18 + nightF * 0.82;
  for (let i = 0; i < lanternCoreMats.length; i++) lanternCoreMats[i].emissive.setRGB(nightF * 1.0, nightF * 0.62, nightF * 0.22);
  for (let i = 0; i < windowMats.length; i++) windowMats[i].emissive.setRGB(0.1 * dayF + nightF * 0.55, 0.18 * dayF + nightF * 0.3, 0.28 * dayF + nightF * 0.1);
  if (sunSprite) sunSprite.scale.set(110 + duskF * 65, 110 + duskF * 65, 1);
  if (leafPts) leafPts.material.opacity = 0.42 * dayF * (1 - duskF * 0.5);
  if (gradeEl) {
    gradeEl.style.background = duskF > 0.18
      ? 'rgba(255,140,70,' + (0.11 * duskF).toFixed(3) + ')'
      : (dayF > 0.5 ? 'rgba(255,215,155,' + (0.07 * dayF).toFixed(3) + ')' : 'rgba(40,70,140,' + (0.1 * (1 - dayF)).toFixed(3) + ')');
  }
  {
    const su = skyDome.material.uniforms;
    if (su.uSunDir) {
      su.uSunDir.value.copy(sunDir);
      su.uSunCol.value.copy(sun.color).multiplyScalar(1.0 + duskF * 0.55);
      su.uTime.value = worldTime;
      su.uCloudAmt.value = 0.52 - 0.18 * (1 - dayF) + weather.rain * 0.42;
      if (weather.rain > 0.01) {
        u.topColor.value.multiplyScalar(1 - weather.rain * 0.24);
        u.bottomColor.value.multiplyScalar(1 - weather.rain * 0.12);
        cSkyTmp.copy(u.bottomColor.value);
        scene.fog.color.copy(cSkyTmp);
      }
    }
    if (gradePass && camera) {
      _sunProbe.copy(sunDir).multiplyScalar(300).add(camera.position);
      _sunProbe.project(camera);
      const vis = (_sunProbe.z < 1 && sunDir.y > -0.04) ? clamp(sunDir.y * 4 + 0.12, 0, 1) : 0;
      gradePass.uniforms.uSunUV.value.set(_sunProbe.x * 0.5 + 0.5, _sunProbe.y * 0.5 + 0.5);
      gradePass.uniforms.uSunVis.value = vis * 0.62;
      gradePass.uniforms.uSunColG.value.copy(sun.color);
    }
  }
  const camP = camera ? camera.position : _sunProbe.set(0, 0, 0);
  skyDome.position.copy(camP);
  if (stars) stars.position.copy(camP);
  sunSprite.position.copy(camP).add(_sunProbe2.copy(sunDir).multiplyScalar(465));
  if (sunCore) { sunCore.position.copy(camP).add(_sunProbe2.copy(sunDir).multiplyScalar(458)); sunCore.material.opacity = clamp(elev * 4, 0, 1); }
  sun.color.copy(cSunWarm).lerp(cSunNoon, dayF).lerp(cSunDusk, duskF * 0.85);
  moonSprite.position.copy(camP).add(_sunProbe2.copy(sunDir).multiplyScalar(-465));
  sunSprite.material.opacity = clamp(elev * 3, 0, 1) * 0.95;
  moonSprite.material.opacity = clamp(-elev * 2.2, 0, 1) * 0.75;
  return dayF;
}

/* ---------------- terreno + água ---------------- */
function chunkBuild(cx, cz) {
  const key = cx + ',' + cz;
  if (chunkMap.has(key)) return;
  const geo = new THREE.PlaneGeometry(CHUNK, CHUNK, CHUNK_SEGS, CHUNK_SEGS);
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx * CHUNK + CHUNK / 2, 0, cz * CHUNK + CHUNK / 2);
  const pos = geo.attributes.position;
  const nv = pos.count, n = CHUNK_SEGS + 1;
  const hs = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    hs[i] = height(pos.getX(i), pos.getZ(i));
    pos.setY(i, hs[i]);
  }
  const colors = new Float32Array(nv * 3);
  const col = new THREE.Color();
  for (let i = 0; i < nv; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const ix = i % n, iz = (i / n) | 0;
    const hL = hs[iz * n + Math.max(ix - 1, 0)], hR = hs[iz * n + Math.min(ix + 1, n - 1)];
    const hD = hs[Math.max(iz - 1, 0) * n + ix], hU = hs[Math.min(iz + 1, n - 1) * n + ix];
    const slope = Math.sqrt(Math.pow((hR - hL) * 0.45, 2) + Math.pow((hU - hD) * 0.45, 2)) / 5;
    terrainColor(x, z, hs[i], col, slope);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, terrainMatShared);
  mesh.receiveShadow = true;
  mesh.userData.noShadow = true;
  mesh.userData.hg = hs;
  mesh.userData.hx = cx * CHUNK; mesh.userData.hz = cz * CHUNK;
  scene.add(mesh);
  chunkMap.set(key, mesh);
}
function sampleHeight(x, z) {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  const mesh = chunkMap.get(cx + ',' + cz);
  if (mesh && mesh.userData.hg) {
    const n = CHUNK_SEGS + 1, cell = CHUNK / CHUNK_SEGS;
    const fx = clamp((x - mesh.userData.hx) / cell, 0, CHUNK_SEGS - 0.001);
    const fz = clamp((z - mesh.userData.hz) / cell, 0, CHUNK_SEGS - 0.001);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const hg = mesh.userData.hg;
    const h00 = hg[iz * n + ix], h10 = hg[iz * n + ix + 1];
    const h01 = hg[(iz + 1) * n + ix], h11 = hg[(iz + 1) * n + ix + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  }
  return height(x, z);
}
function chunkDispose(key) {
  const mesh = chunkMap.get(key);
  if (!mesh) return;
  scene.remove(mesh);
  mesh.geometry.dispose();
  chunkMap.delete(key);
}
let chunkPending = false;
function updateChunks(force) {
  if (!terrainMatShared) return;
  const pcx = Math.floor((hero ? hero.x : 0) / CHUNK), pcz = Math.floor((hero ? hero.z : 195) / CHUNK);
  const moved = pcx !== lastChunkGX || pcz !== lastChunkGZ;
  if (!force && !moved && !chunkPending) return;
  if (moved) { lastChunkGX = pcx; lastChunkGZ = pcz; }
  const R = qualityLevel <= 0 ? 4 : (qualityLevel === 1 ? 5 : chunkR);
  if (moved || force) {
    for (const [key] of chunkMap) {
      const kp = key.split(','); const cx = +kp[0], cz = +kp[1];
      if (Math.abs(cx - pcx) > R + 1 || Math.abs(cz - pcz) > R + 1) chunkDispose(key);
    }
  }
  const missing = [];
  for (let dz = -R; dz <= R; dz++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dz * dz > (R + 0.45) * (R + 0.45)) continue;
      const cx = pcx + dx, cz = pcz + dz;
      if (!chunkMap.has(cx + ',' + cz)) missing.push([cx, cz, dx * dx + dz * dz]);
    }
  }
  missing.sort((a, b) => a[2] - b[2]);
  const budget = force ? 48 : (moved ? 5 : 2);
  let built = 0;
  for (let i = 0; i < missing.length && built < budget; i++, built++) chunkBuild(missing[i][0], missing[i][1]);
  chunkPending = built >= budget && missing.length > built;
}
function buildTerrain() {
  terrainMatShared = new THREE.MeshStandardMaterial({ vertexColors: true, map: texClone(texDetail, 17, 17), bumpMap: texClone(texDetail, 17, 17), bumpScale: 0.6, roughness: 0.94, metalness: 0.0 });
  terrainMatShared.onBeforeCompile = (sh) => {
    sh.uniforms.uWet = { value: 0 };
    terrainMatShared.userData.sh = sh;
    sh.fragmentShader = ('uniform float uWet;\n' + sh.fragmentShader)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor *= (1.0 - uWet * 0.55);')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= (1.0 - uWet * 0.22);');
  };
  updateChunks(true);
  // água do lago — ondas, fresnel, espuma na margem e brilho do sol
  function makeBathymetry(reach) {
    const S = 192, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const cx2 = cv.getContext('2d'), img = cx2.createImageData(S, S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = LAKE.x + (i / (S - 1) - 0.5) * 2 * reach, z = LAKE.z + (j / (S - 1) - 0.5) * 2 * reach;
      const v = Math.max(0, Math.min(255, Math.round((height(x, z) + 40) / 80 * 255)));
      const k = (j * S + i) * 4; img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v; img.data[k + 3] = 255;
    }
    cx2.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.flipY = false;
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    return t;
  }
  const BATH_REACH = LAKE.r + 150;
  const bathTex = makeBathymetry(BATH_REACH);
  const wgeo = new THREE.CircleGeometry(LAKE.r + 130, 112);
  wgeo.rotateX(-Math.PI / 2);
  const wu = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x1b5c96) },
    uShallow: { value: new THREE.Color(0x55a8cf) },
    uSky: { value: new THREE.Color(0xa8d4ec) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color(0xffe9c0) },
    uRefl: { value: null },
    uReflOn: { value: 0 },
    uTexMat: { value: new THREE.Matrix4() },
    uCenter: { value: new THREE.Vector2(LAKE.x, LAKE.z) },
    uRadius: { value: LAKE.r + 130 },
    uFadeR: { value: LAKE.r + 122 },
    uShore0: { value: LAKE.r + 26 },
    uShore1: { value: LAKE.r + 52 },
    uBath: { value: bathTex },
    uBathC: { value: new THREE.Vector2(LAKE.x, LAKE.z) },
    uBathR: { value: BATH_REACH },
    fogColor: { value: new THREE.Color(0xa8d4ec) },
    fogDensity: { value: 0.00115 }
  };
  const wmat = new THREE.ShaderMaterial({
    uniforms: wu,
    transparent: true,
    vertexShader: 'uniform float uTime;\nuniform mat4 uTexMat;\nvarying vec3 vWp; varying vec3 vV; varying vec3 vN; varying vec4 vRefC;\nvoid main(){\n vec4 wp = modelMatrix * vec4(position, 1.0);\n vRefC = uTexMat * vec4(wp.xyz, 1.0);\n float w1 = sin(wp.x * 0.35 + uTime * 1.1) * cos(wp.z * 0.42 + uTime * 0.8);\n float w2 = sin(wp.x * 0.62 - uTime * 1.3) * sin(wp.z * 0.55 + uTime * 0.6);\n wp.y += w1 * 0.12 + w2 * 0.07;\n float dx = 0.35 * cos(wp.x * 0.35 + uTime * 1.1) * cos(wp.z * 0.42 + uTime * 0.8) * 0.12 + 0.62 * cos(wp.x * 0.62 - uTime * 1.3) * sin(wp.z * 0.55 + uTime * 0.6) * 0.07;\n float dz = -0.42 * sin(wp.x * 0.35 + uTime * 1.1) * sin(wp.z * 0.42 + uTime * 0.8) * 0.12 + 0.55 * sin(wp.x * 0.62 - uTime * 1.3) * cos(wp.z * 0.55 + uTime * 0.6) * 0.07;\n vN = normalize(vec3(-dx * 3.5, 1.0, -dz * 3.5));\n vWp = wp.xyz;\n vec4 mv = viewMatrix * wp;\n vV = -mv.xyz;\n gl_Position = projectionMatrix * mv;\n}',
    fragmentShader: 'uniform float uTime;\nuniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSunDir; uniform vec3 uSunCol;\nuniform vec2 uCenter; uniform float uRadius; uniform float uFadeR; uniform float uShore0; uniform float uShore1;\nuniform sampler2D uBath; uniform vec2 uBathC; uniform float uBathR;\nuniform vec3 fogColor; uniform float fogDensity;\nuniform sampler2D uRefl; uniform float uReflOn;\nvarying vec3 vWp; varying vec3 vV; varying vec3 vN; varying vec4 vRefC;\nvoid main(){\n vec3 N = normalize(vN); vec3 V = normalize(vV);\n N.x += 0.085 * sin(vWp.x * 1.7 + uTime * 1.9) + 0.05 * sin(vWp.x * 3.2 - uTime * 1.2 + vWp.z * 1.3); N.z += 0.085 * cos(vWp.z * 1.9 + uTime * 1.7) + 0.05 * cos(vWp.z * 2.8 + uTime * 1.1 + vWp.x * 1.5); N = normalize(N); float fres = pow(1.0 - max(dot(N, V), 0.0), 2.1);\n float ripple = N.x * 0.5 + N.z * 0.45;\n vec3 col = mix(uDeep, uShallow, clamp(0.3 + ripple * 1.4, 0.0, 1.0));\n vec3 reflC = uSky;\n if (uReflOn > 0.5) {\n  vec2 ruv = vRefC.xy / max(vRefC.w, 0.001) + N.xz * 0.13;\n  reflC = texture2D(uRefl, clamp(ruv, 0.001, 0.999)).rgb;\n }\n col = mix(col, reflC, clamp(pow(fres, 1.5) * 0.95 + 0.05, 0.0, 0.95));\n vec3 L = normalize(uSunDir);\n vec3 H = normalize(L + V);\n vec3 Lp = normalize(vec3(L.x, max(L.y, 0.02) * 0.22, L.z));\n vec3 H2 = normalize(Lp + V);\n float spec = pow(max(dot(N, H), 0.0), 60.0) * 0.8;\n float path = pow(max(dot(N, H2), 0.0), 70.0) * 1.5;\n col += uSunCol * (spec + path);\n float glint = pow(max(dot(reflect(-L, N), V), 0.0), 24.0);\n col += uSunCol * glint * 0.18;\n float sparkle = pow(max(dot(N, H), 0.0), 320.0) * 1.6; col += uSunCol * pow(max(dot(N, H), 0.0), 24.0) * 0.12;\n col += uSunCol * sparkle;\n float d = length(vWp.xz - uCenter);\n vec2 bUV = (vWp.xz - uBathC) / (2.0 * uBathR) + 0.5;\n float th = texture2D(uBath, clamp(bUV, 0.002, 0.998)).r * 80.0 - 40.0;\n float subm = smoothstep(0.45, -0.35, th);\n float shore = smoothstep(-1.6, -0.35, th) * (1.0 - smoothstep(0.1, 0.9, th));\n float foam = shore * (0.55 + 0.45 * sin(d * 1.4 - uTime * 1.6 + sin(vWp.x * 0.3 + uTime)));\n col = mix(col, vec3(0.93, 0.97, 1.0), clamp(foam, 0.0, 0.7) * 0.7);\n float edgeA = subm * (1.0 - smoothstep(uFadeR, uRadius - 2.0, d));\n float fd = length(vV);\n float fogF = 1.0 - exp(-fogDensity * fogDensity * fd * fd);\n col = mix(col, fogColor, fogF);\n gl_FragColor = vec4(col, 0.972 * edgeA);\n}'
  });
  const rSz = IS_TOUCH ? 256 : 512;
  reflRT = new THREE.WebGLRenderTarget(rSz, rSz);
  wu.uRefl.value = reflRT.texture;
  reflCam = new THREE.PerspectiveCamera(55, 1, 0.5, 1200);
  water = new THREE.Mesh(wgeo, wmat);
  water.position.set(LAKE.x, WATER_Y, LAKE.z);
  scene.add(water);
  animatables.push(t => {
    wu.uTime.value = t;
    if (sunDir.y > 0.02) {
      wu.uSunDir.value.copy(sunDir);
      wu.uSunCol.value.copy(sun.color);
    } else {
      wu.uSunDir.value.set(-sunDir.x, -sunDir.y, -sunDir.z);
      wu.uSunCol.value.setRGB(0.55, 0.66, 0.95);
    }
    if (skyDome) wu.uSky.value.copy(skyDome.material.uniforms.bottomColor.value);
    if (scene.fog) wu.fogColor.value.copy(scene.fog.color);
    water.position.y = WATER_Y + Math.sin(t * 0.7) * 0.07;
  });
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
  // ---- árvores completas (tronco+copa mesclados,1 chamada de desenho por tipo) ----
  function mergeParts(parts) {
    const posArr = [], normArr = [], colArr = [], uvArr = [];
    const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
    for (const pt of parts) {
      const g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo;
      nm.getNormalMatrix(pt.matrix);
      const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(pt.matrix);
        n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
        posArr.push(v.x, v.y, v.z);
        normArr.push(n.x, n.y, n.z);
        colArr.push(pt.color.r, pt.color.g, pt.color.b);
        if (ua) uvArr.push(ua.getX(i), ua.getY(i)); else uvArr.push(0, 0);
      }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    return out;
  }
  function roughen(g, amt, sx, sy, sz) {
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const px = pa.getX(i), py = pa.getY(i), pz = pa.getZ(i);
      const nrm = Math.sin(px * 12.9898 + py * 78.233 + pz * 37.719) * 43758.5453;
      const f = (nrm - Math.floor(nrm)) - 0.5;
      pa.setXYZ(i, px * (1 + f * amt * sx), py * (1 + f * amt * sy), pz * (1 + f * amt * sz));
    }
    g.computeVertexNormals();
    return g;
  }
  // ====== ÁRVORES NOVAS: tronco com casca, galhos e copa em camadas (código 100% novo) ======
  const texBark = makeTexture(128, (x, s) => {
    x.fillStyle = '#6b5138'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 110; i++) {
      const px = Math.random() * s, w = 2 + Math.random() * 6, h = 18 + Math.random() * 86;
      const v = 0.42 + Math.random() * 0.8;
      x.fillStyle = 'rgba(' + Math.floor(96 * v) + ',' + Math.floor(70 * v) + ',' + Math.floor(46 * v) + ',0.85)';
      x.fillRect(px, Math.random() * s, w, h);
    }
    for (let i = 0; i < 46; i++) {
      x.strokeStyle = 'rgba(28,18,10,0.55)'; x.lineWidth = 1 + Math.random() * 2.2;
      const px = Math.random() * s; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (Math.random() * 12 - 6), s); x.stroke();
    }
    for (let i = 0; i < 24; i++) {
      x.fillStyle = 'rgba(120,120,90,0.25)';
      x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, 3 + Math.random() * 8, 2 + Math.random() * 4, Math.random() * 3, 0, 6.28); x.fill();
    }
  });
  function trunkGeo(h, r0, r1, lean) {
    const g = new THREE.CylinderGeometry(r1, r0, h, 9, 5);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i) + h / 2, t = y / h;
      pa.setX(i, pa.getX(i) + Math.sin(t * 2.6) * lean);
      pa.setZ(i, pa.getZ(i) + Math.cos(t * 2.1) * lean * 0.6);
    }
    g.computeVertexNormals();
    return g;
  }
  function roughenNow(g, amt) {
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const nrm = Math.sin(pa.getX(i) * 12.9898 + pa.getY(i) * 78.233 + pa.getZ(i) * 37.719) * 43758.5453;
      const f = (nrm - Math.floor(nrm)) - 0.5;
      pa.setXYZ(i, pa.getX(i) * (1 + f * amt), pa.getY(i) * (1 + f * amt * 0.55), pa.getZ(i) * (1 + f * amt));
    }
    g.computeVertexNormals();
    return g;
  }
  // ---- pinheiro: líder central + 8 camadas de saias irregulares ----
  const pineParts = [];
  pineParts.push({ geo: trunkGeo(7.2, 0.32, 0.08, 0.12), matrix: new THREE.Matrix4().makeTranslation(0, 3.6, 0), color: new THREE.Color(0x5e4128) });
  for (let k = 0; k < 8; k++) {
    const t = k / 7;
    const y = 1.55 + t * 5.3, r = 2.45 * (1 - t * 0.8) + 0.3;
    for (let j = 0; j < 3; j++) {
      const a = k * 1.13 + j * 2.094;
      const fan = new THREE.ConeGeometry(r * 0.62, r * 0.78, 7);
      const pa = fan.attributes.position;
      for (let vi = 0; vi < pa.count; vi++) {
        const n = Math.sin(pa.getX(vi) * 12.9898 + pa.getY(vi) * 78.233 + vi * 3.71) * 43758.5453;
        const f = (n - Math.floor(n)) - 0.5;
        pa.setX(vi, pa.getX(vi) * (1 + f * 0.36)); pa.setZ(vi, pa.getZ(vi) * (1 + f * 0.36));
      }
      fan.computeVertexNormals();
      const mm = new THREE.Matrix4();
      const qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.46, a, 0));
      mm.compose(new THREE.Vector3(Math.cos(a) * r * 0.26, y + j * 0.14, Math.sin(a) * r * 0.26), qq, new THREE.Vector3(1, 0.6, 1));
      const vv = 0.68 + t * 0.5;
      pineParts.push({ geo: fan, matrix: mm, color: new THREE.Color(0.15 * vv, 0.37 * vv, 0.15 * vv) });
    }
  }
  const pineGeoM = mergeParts(pineParts);
  // ---- folhosa: tronco de casca + 3 galhos + núcleos de copa + folhas desenhadas ----
  const broadTrunkParts = [];
  broadTrunkParts.push({ geo: trunkGeo(3.7, 0.44, 0.2, 0.15), matrix: new THREE.Matrix4().makeTranslation(0, 1.85, 0), color: new THREE.Color(0x7a5232) });
  for (let b = 0; b < 3; b++) {
    const a = b * 2.094 + 0.45;
    const bg = new THREE.CylinderGeometry(0.1, 0.2, 2.4, 6);
    const mm = new THREE.Matrix4();
    const qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0.8));
    mm.compose(new THREE.Vector3(Math.cos(a) * 0.98, 3.4, Math.sin(a) * 0.98), qq, new THREE.Vector3(1, 1, 1));
    broadTrunkParts.push({ geo: bg, matrix: mm, color: new THREE.Color(0x6f4c2c) });
  }
  const broadTrunkM = mergeParts(broadTrunkParts);
  const coreParts = [];
  const crowns = [[0, 4.5, 0, 2.0], [-1.3, 4.1, 0.55, 1.35], [1.35, 4.25, -0.5, 1.32], [0.2, 5.7, 0.35, 1.18], [-0.85, 5.2, -0.8, 1.02], [1.0, 5.25, 0.75, 0.92]];
  for (const cc2 of crowns) {
    const ic = new THREE.IcosahedronGeometry(cc2[3], 1);
    const pa = ic.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const n = Math.sin(pa.getX(i) * 12.9898 + pa.getY(i) * 78.233 + pa.getZ(i) * 37.719) * 43758.5453;
      const f = (n - Math.floor(n)) - 0.5;
      pa.setXYZ(i, pa.getX(i) * (1 + f * 0.36), pa.getY(i) * (1 + f * 0.28), pa.getZ(i) * (1 + f * 0.36));
    }
    ic.computeVertexNormals();
    coreParts.push({ geo: ic, matrix: new THREE.Matrix4().makeTranslation(cc2[0], cc2[1], cc2[2]), color: new THREE.Color(0x2c6026) });
  }
  const broadCoreM = mergeParts(coreParts);
  const leafParts = [];
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996, r = 1.25 + (i % 3) * 0.72, y = 3.75 + (i % 5) * 0.72;
    const pl = new THREE.PlaneGeometry(2.6 - (i % 3) * 0.3, 2.15 - (i % 2) * 0.35);
    const mm = new THREE.Matrix4();
    const qtmp = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-0.7, 0.7), a * 1.7, rand(-0.6, 0.6)));
    mm.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), qtmp, new THREE.Vector3(1, 1, 1));
    const vv = 0.72 + (i % 4) * 0.15;
    leafParts.push({ geo: pl, matrix: mm, color: new THREE.Color(0.52 * vv, 0.8 * vv, 0.4 * vv) });
  }
  const broadLeafM = mergeParts(leafParts);
  // textura de folhas: folhas individuais com nervura
  const leafTex = makeTexture(256, (x, s) => {
    x.clearRect(0, 0, s, s);
    for (let i = 0; i < 130; i++) {
      const px = 14 + Math.random() * (s - 28), py = 14 + Math.random() * (s - 28);
      const len = 15 + Math.random() * 27, wid = len * (0.3 + Math.random() * 0.24), a = Math.random() * 6.28;
      const v = 0.5 + Math.random() * 0.55;
      x.save(); x.translate(px, py); x.rotate(a);
      x.fillStyle = 'rgba(' + Math.floor(44 * v) + ',' + Math.floor(110 * v) + ',' + Math.floor(38 * v) + ',0.95)';
      x.beginPath(); x.moveTo(0, -len * 0.5);
      x.quadraticCurveTo(wid, -len * 0.12, 0, len * 0.5);
      x.quadraticCurveTo(-wid, -len * 0.12, 0, -len * 0.5);
      x.fill();
      x.strokeStyle = 'rgba(' + Math.floor(26 * v) + ',' + Math.floor(64 * v) + ',' + Math.floor(24 * v) + ',0.75)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, -len * 0.45); x.lineTo(0, len * 0.48); x.stroke();
      x.restore();
    }
  });
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: leafTex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.86, metalness: 0 });
  addWind(leafMat, 0.062);
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: texClone(texDetail, 2, 2), bumpMap: texClone(texDetail, 2, 2), bumpScale: 0.25, roughness: 0.9 });
  addWind(treeMat, 0.04);
  const barkMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: texClone(texBark, 1, 2), bumpMap: texClone(texBark, 1, 2), bumpScale: 0.45, roughness: 0.94 });
  addWind(barkMat, 0.01);
  const N = 320;
  const pines = new THREE.InstancedMesh(pineGeoM, treeMat, N);
  const broads = new THREE.InstancedMesh(broadCoreM, treeMat, N);
  const broadsT = new THREE.InstancedMesh(broadTrunkM, barkMat, N);
  const broadsL = new THREE.InstancedMesh(broadLeafM, leafMat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  pines.castShadow = true; broads.castShadow = true; broadsL.castShadow = true; broadsT.castShadow = true;
  scene.add(pines, broads, broadsT, broadsL);
  const treeForestOk = (x, z, h) => fbm(x * 0.0055 + 3, z * 0.0055 + 8) > 0.53 && h > -1.8 && h < 36 && roadFactor(x, z) < 0.28;
  const treeOpenOk = (x, z, h) => h > -1.8 && h < 40 && roadFactor(x, z) < 0.22 && distTo(x, z, VILLAGE.x, VILLAGE.z) > 55 && distTo(x, z, LAKE.x, LAKE.z) > LAKE.r + 12 && distTo(x, z, RUINS.x, RUINS.z) > 30;
  // arbustos
  const bushGeo = new THREE.IcosahedronGeometry(1.15, 1);
  const bushMat = new THREE.MeshStandardMaterial({});
  addWind(bushMat, 0.05);
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, 130);
  bushes.castShadow = true;
  scene.add(bushes);
  const bushOk = (x, z, h) => h > -2.4 && h < 32 && distTo(x, z, LAKE.x, LAKE.z) > LAKE.r + 6;
  // ---- campos de flores: lupins, papoulas e margaridas (como nas pinturas) ----
  const lupineGeoM = mergeParts([
    { geo: new THREE.CylinderGeometry(0.022, 0.032, 0.66, 5), matrix: new THREE.Matrix4().makeTranslation(0, 0.33, 0), color: new THREE.Color(0x3f7a34) },
    { geo: new THREE.ConeGeometry(0.13, 0.62, 6), matrix: new THREE.Matrix4().makeTranslation(0, 0.82, 0), color: new THREE.Color(0x7a52c8) }
  ]);
  const poppyGeoM = mergeParts([
    { geo: new THREE.CylinderGeometry(0.02, 0.028, 0.52, 5), matrix: new THREE.Matrix4().makeTranslation(0, 0.26, 0), color: new THREE.Color(0x3f7a34) },
    { geo: new THREE.SphereGeometry(0.11, 8, 6), matrix: new THREE.Matrix4().makeTranslation(0, 0.56, 0), color: new THREE.Color(0xe0562e) }
  ]);
  const daisyGeoM = mergeParts([
    { geo: new THREE.CylinderGeometry(0.018, 0.026, 0.44, 5), matrix: new THREE.Matrix4().makeTranslation(0, 0.22, 0), color: new THREE.Color(0x3f7a34) },
    { geo: new THREE.CylinderGeometry(0.145, 0.145, 0.032, 9), matrix: new THREE.Matrix4().makeTranslation(0, 0.47, 0), color: new THREE.Color(0xf4f0e2) },
    { geo: new THREE.SphereGeometry(0.056, 7, 5), matrix: new THREE.Matrix4().makeTranslation(0, 0.5, 0), color: new THREE.Color(0xe8c23a) }
  ]);
  const flowerMat = new THREE.MeshStandardMaterial({ vertexColors: true });
  addWind(flowerMat, 0.08);
  const flowerOk = (x, z, h) => h > -1.6 && h < 22 && distTo(x, z, LAKE.x, LAKE.z) > LAKE.r + 6 && distTo(x, z, VILLAGE.x, VILLAGE.z) > 9;
  const meadowOk = (x, z, h) => h > -1.6 && h < 22 && (roadFactor(x, z) > 0.015 || distTo(x, z, 0, 195) < 130) && distTo(x, z, LAKE.x, LAKE.z) > LAKE.r + 6 && distTo(x, z, VILLAGE.x, VILLAGE.z) > 11;
  const flowerDefs = [];
  function scatterFlowers(geo, count, okFn, hue, sat, lit) {
    const im = new THREE.InstancedMesh(geo, flowerMat, count);
    im.userData.noShadow = true;
    scene.add(im);
    flowerDefs.push({ im, count, okFn, hue, sat, lit });
    return im;
  }
  const flMul = IS_TOUCH ? 0.55 : 1;
  scatterFlowers(lupineGeoM, Math.floor(560 * flMul), meadowOk, 0.72, 0.55, 0.72);
  scatterFlowers(poppyGeoM, Math.floor(520 * flMul), flowerOk, 0.035, 0.72, 0.62);
  scatterFlowers(daisyGeoM, Math.floor(580 * flMul), flowerOk, 0.13, 0.18, 0.88);
  // ---- névoa suave do vale (manhãs e crepúsculos) ----
  const mistList = [];
  for (let i = 0; i < 11; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xeef2f6, transparent: true, opacity: 0, depthWrite: false }));
    const ang = rand(0, 6.28), rr = rand(55, 300);
    const mx = Math.cos(ang) * rr, mz = Math.sin(ang) * rr;
    const mh = height(mx, mz);
    sp.position.set(mx, Math.max(mh + rand(1.5, 5), WATER_Y + 1.2), mz);
    sp.scale.set(rand(60, 130), rand(15, 30), 1);
    sp.renderOrder = 3;
    scene.add(sp); mistList.push(sp);
  }
  animatables.push(t => {
    const dawnF = clamp(1 - Math.abs(hour - 7.2) / 3.8, 0, 1) + clamp(1 - Math.abs(hour - 18.3) / 3.2, 0, 1);
    for (let i = 0; i < mistList.length; i++) {
      const sp = mistList[i];
      sp.position.x += Math.sin(t * 0.05 + i * 1.7) * 0.025;
      sp.position.z += Math.cos(t * 0.04 + i * 2.1) * 0.02;
      sp.material.opacity = 0.07 + dawnF * 0.26;
    }
  });
  // tufos de grama — lâminas cruzadas com textura de verdade
  const b1 = new THREE.PlaneGeometry(1.15, 0.95); b1.translate(0, 0.46, 0);
  const b2 = new THREE.PlaneGeometry(1.15, 0.95); b2.translate(0, 0.46, 0); b2.rotateY(Math.PI / 2);
  const tuftGeo = mergeParts([
    { geo: b1, matrix: new THREE.Matrix4(), color: new THREE.Color(0xffffff) },
    { geo: b2, matrix: new THREE.Matrix4(), color: new THREE.Color(0xf2f2f2) }
  ]);
  const tuftMat = new THREE.MeshStandardMaterial({ map: texClone(texBlade, 1, 1), alphaTest: 0.42, side: THREE.DoubleSide });
  addWind(tuftMat, 0.17);
  const tuftN = IS_TOUCH ? 2600 : 6000;
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftN);
  const tuftOk = (x, z, h) => h > -2.6 && h < 26 && distTo(x, z, LAKE.x, LAKE.z) > LAKE.r + 4 && distTo(x, z, VILLAGE.x, VILLAGE.z) > 8;
  tufts.userData.noShadow = true;
  scene.add(tufts);
  // laminas de grama 3D — milhares, curvadas, com gradiente de cor
  const bladeGeo = new THREE.PlaneGeometry(0.085, 0.55, 1, 3);
  bladeGeo.translate(0, 0.31, 0);
  {
    const pa = bladeGeo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i);
      pa.setZ(i, Math.pow(Math.max(y, 0) / 0.55, 2.0) * 0.13);
      pa.setX(i, pa.getX(i) * (1.0 - Math.max(y, 0) / 0.55 * 0.72));
    }
    const cols = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) {
      const t = Math.max(pa.getY(i), 0) / 0.55;
      cols[i * 3] = 0.1 + t * 0.26; cols[i * 3 + 1] = 0.22 + t * 0.36; cols[i * 3 + 2] = 0.06 + t * 0.15;
    }
    bladeGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    bladeGeo.computeVertexNormals();
  }
  const bladeMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.88, metalness: 0 });
  addWind(bladeMat, 0.12);
  const bladeN = IS_TOUCH ? 3200 : 9500;
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeN);
  const bladeOk = (x, z, h) => h > -2.4 && h < 30 && distTo(x, z, LAKE.x, LAKE.z) > LAKE.r + 3 && distTo(x, z, VILLAGE.x, VILLAGE.z) > 6 && roadFactor(x, z) < 0.45;
  blades.userData.noShadow = true;
  scene.add(blades);
  // pedras
  const rockGeo = roughen(new THREE.IcosahedronGeometry(1.5, 0), 0.32, 1, 1, 1);
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x8a8478 }), 140);
  rocks.castShadow = true; scene.add(rocks);
  const rockOk = (x, z, h) => h > -1.5 && h < 62 && distTo(x, z, VILLAGE.x, VILLAGE.z) > 25;

  // ---- re-semeio FATIADO: uma parte por frame (zero congelamento) ----
  const flushIm = (im) => {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  };
  seedNature = function () {
    seedX = hero ? hero.x : 0; seedZ = hero ? hero.z : 195;
    seedQueue = ['arvores', 'arbustos', 'tufos1', 'tufos2', 'grama1', 'grama2', 'flores'];
  };
  seedSlice = function (part) {
    const cx = seedX, cz = seedZ;
    const R = 250;
    const qMul = qualityLevel >= 2 ? 1 : (qualityLevel === 1 ? 0.55 : 0.3);
    const posNear = (ok) => {
      for (let t = 0; t < 18; t++) {
        const x = cx + rand(-R, R), z = cz + rand(-R, R);
        const h = sampleHeight(x, z);
        if (ok(x, z, h)) return { x, z, h };
      }
      return null;
    };
    if (part === 'arvores') {
      let ip = 0, ib = 0;
      const tN = Math.floor(N * qMul);
      for (let i = 0; i < tN; i++) {
        const pos = posNear(Math.random() < 0.62 ? treeForestOk : treeOpenOk);
        if (!pos) continue;
        const sc = rand(0.8, 1.55);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, Math.PI * 2));
        p.set(pos.x, pos.h, pos.z); s.set(sc, sc * rand(0.9, 1.2), sc);
        m.compose(p, q, s);
        const isPine = pos.h > 15 || Math.random() < 0.45;
        if (isPine) {
          pines.setMatrixAt(ip, m); c.setHSL(0.325 + rand(-0.035, 0.035), 0.44, rand(0.55, 0.82)); pines.setColorAt(ip, c); ip++;
        } else {
          broads.setMatrixAt(ib, m); c.setHSL(0.255 + rand(-0.035, 0.035), 0.44, rand(0.58, 0.88)); broads.setColorAt(ib, c);
          broadsT.setMatrixAt(ib, m); broadsT.setColorAt(ib, c);
          broadsL.setMatrixAt(ib, m); broadsL.setColorAt(ib, c); ib++;
        }
      }
      for (let i = ip; i < N; i++) pines.setMatrixAt(i, zero);
      for (let i = ib; i < N; i++) { broads.setMatrixAt(i, zero); broadsT.setMatrixAt(i, zero); broadsL.setMatrixAt(i, zero); }
      pines.count = ip; broads.count = ib; broadsT.count = ib; broadsL.count = ib;
      flushIm(pines); flushIm(broads); flushIm(broadsT); flushIm(broadsL);
    } else if (part === 'arbustos') {
      const bN = Math.floor(130 * qMul);
      for (let i = 0; i < bN; i++) {
        const pos = posNear(bushOk);
        if (!pos) { bushes.setMatrixAt(i, zero); continue; }
        const sc = rand(0.6, 1.5);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6.28));
        p.set(pos.x, pos.h + 0.55 * sc, pos.z); s.set(sc, sc * 0.75, sc);
        m.compose(p, q, s); bushes.setMatrixAt(i, m);
        c.setHSL(0.28 + rand(-0.03, 0.03), 0.4, rand(0.3, 0.44)); bushes.setColorAt(i, c);
      }
      bushes.count = bN;
      const rN = Math.floor(140 * qMul);
      for (let i = 0; i < rN; i++) {
        const pos = posNear(rockOk);
        if (!pos) { rocks.setMatrixAt(i, zero); continue; }
        const sc = rand(0.5, 2.2);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6.28));
        p.set(pos.x, pos.h + 0.5 * sc, pos.z); s.set(sc, sc * rand(0.55, 0.9), sc);
        m.compose(p, q, s); rocks.setMatrixAt(i, m);
      }
      rocks.count = rN;
      flushIm(bushes); flushIm(rocks);
    } else if (part === 'tufos1' || part === 'tufos2') {
      let placed = part === 'tufos1' ? 0 : Math.floor(tuftN * qMul * 0.5);
      const tuN = part === 'tufos1' ? Math.floor(tuftN * qMul * 0.5) : Math.floor(tuftN * qMul);
      const gx0 = part === 'tufos1' ? cx - 300 : cx, gx1 = part === 'tufos1' ? cx : cx + 300;
      for (let gx = gx0; gx <= gx1 && placed < tuN; gx += 9.5) {
        for (let gz = cz - 300; gz <= cz + 300 && placed < tuN; gz += 9.5) {
          const x = gx + (Math.random() - 0.5) * 11, z = gz + (Math.random() - 0.5) * 11;
          const hh = sampleHeight(x, z);
          if (!tuftOk(x, z, hh) || Math.random() < 0.3) continue;
          const sc = rand(1.3, 2.8);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6.28));
          p.set(x, hh + 0.02, z); s.set(sc, sc * rand(0.85, 1.3), sc);
          m.compose(p, q, s); tufts.setMatrixAt(placed, m);
          c.setHSL(0.24 + rand(-0.03, 0.03), 0.45, rand(0.65, 0.95)); tufts.setColorAt(placed, c);
          placed++;
        }
      }
      tufts.count = placed;
      flushIm(tufts);
    } else if (part === 'grama1' || part === 'grama2') {
      const blN = Math.floor(bladeN * qMul);
      const half = Math.floor(blN / 2);
      const from = part === 'grama1' ? 0 : half, to = part === 'grama1' ? half : blN;
      let bp = from;
      for (let i = from; i < to; i++) {
        const ang = Math.random() * 6.2832, rr = Math.sqrt(Math.random()) * 245;
        const x = cx + Math.cos(ang) * rr, z = cz + Math.sin(ang) * rr;
        const hh = sampleHeight(x, z);
        if (!bladeOk(x, z, hh)) { continue; }
        const sc = rand(0.55, 1.2);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6.28));
        p.set(x, hh + 0.015, z); s.set(sc, sc * rand(0.85, 1.3), sc);
        m.compose(p, q, s); blades.setMatrixAt(bp, m);
        c.setHSL(0.27 + rand(-0.035, 0.035), 0.45, rand(0.6, 0.95)); blades.setColorAt(bp, c);
        bp++;
      }
      for (let i = bp; i < to; i++) blades.setMatrixAt(i, zero);
      if (part === 'grama2') blades.count = Math.max(bp, half);
      flushIm(blades);
    } else if (part === 'flores') {
      for (const fd of flowerDefs) {
        const fN = Math.floor(fd.count * qMul);
        for (let i = 0; i < fN; i++) {
          const pos = posNear(fd.okFn);
          if (!pos) { fd.im.setMatrixAt(i, zero); continue; }
          const sc = rand(0.75, 1.35);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6.28));
          p.set(pos.x, pos.h, pos.z); s.set(sc, sc * rand(0.85, 1.3), sc);
          m.compose(p, q, s); fd.im.setMatrixAt(i, m);
          c.setHSL(fd.hue + rand(-0.035, 0.035), fd.sat + rand(-0.12, 0.12), fd.lit + rand(-0.14, 0.14));
          fd.im.setColorAt(i, c);
        }
        fd.im.count = fN;
        flushIm(fd.im);
      }
    }
  }
  seedNature();
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
  const sh = new THREE.Mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.06;
  sh.userData.noShadow = true;
  g.add(sh);
}
function makeHouse(x, z, rot, sc, wall, roof) {
  const g = new THREE.Group();
  const h0 = height(x, z);
  const wallM = new THREE.MeshStandardMaterial({ color: wall, map: texClone(texPlaster, 2, 2), bumpMap: texClone(texPlaster, 2, 2), bumpScale: 0.62, roughness: 0.92, metalness: 0.02 });
  const roofM = new THREE.MeshStandardMaterial({ color: roof, map: texClone(texTiles, 4, 2), bumpMap: texClone(texTiles, 4, 2), bumpScale: 0.95, roughness: 0.86 });
  const woodM = new THREE.MeshStandardMaterial({ color: 0x6a4526, map: texClone(texWood, 1, 3), bumpMap: texClone(texWood, 1, 3), bumpScale: 0.3, roughness: 0.82 });
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x9a9086, map: texClone(texCobble, 3, 1), bumpMap: texClone(texCobble, 3, 1), bumpScale: 0.8, roughness: 0.95 });
  const W = 8.6 * sc, D = 7.2 * sc, H = 3.15 * sc, Y0 = 1.0 * sc;
  // fundação de pedra
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8 * sc, 1.05 * sc, D + 0.8 * sc), stoneM);
  base.position.y = 0.52 * sc; g.add(base);
  // paredes de reboco
  const walls = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallM);
  walls.position.y = Y0 + H / 2; g.add(walls);
  // vigas de madeira: cantos, cintas horizontais e diagonais
  const beam = (w, h, d, px2, py2, pz2, rz) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodM);
    b.position.set(px2, py2, pz2);
    if (rz) b.rotation.z = rz;
    g.add(b);
    return b;
  };
  const post = 0.27 * sc;
  for (const sxx of [-1, 1]) for (const szz of [-1, 1]) {
    beam(post, H + 0.12 * sc, post, sxx * (W / 2 - 0.01), Y0 + H / 2, szz * (D / 2 - 0.01));
  }
  for (const yy of [Y0 + 0.07 * sc, Y0 + H * 0.58, Y0 + H - 0.07 * sc]) {
    beam(W + 0.06 * sc, 0.22 * sc, 0.12 * sc, 0, yy, D / 2 + 0.02);
    beam(W + 0.06 * sc, 0.22 * sc, 0.12 * sc, 0, yy, -D / 2 - 0.02);
    beam(0.12 * sc, 0.22 * sc, D + 0.06 * sc, W / 2 + 0.02, yy, 0);
    beam(0.12 * sc, 0.22 * sc, D + 0.06 * sc, -W / 2 - 0.02, yy, 0);
  }
  for (const s2 of [-1, 1]) beam(0.15 * sc, H * 0.78, 0.11 * sc, s2 * W * 0.27, Y0 + H * 0.5, D / 2 + 0.03, s2 * 0.52);
  for (const s2 of [-1, 1]) beam(0.15 * sc, H * 0.78, 0.11 * sc, s2 * W * 0.27, Y0 + H * 0.5, -D / 2 - 0.03, -s2 * 0.52);
  // telhado em duas águas
  const roofRun = W / 2 + 0.9 * sc, roofRise = 2.5 * sc;
  const slope = Math.atan2(roofRise, roofRun);
  for (const s2 of [-1, 1]) {
    const plane = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(roofRun, roofRise) + 0.3 * sc, 0.17 * sc, D + 1.6 * sc), roofM);
    plane.position.set(s2 * roofRun / 2, Y0 + H + roofRise / 2, 0);
    plane.rotation.z = s2 * -slope;
    plane.castShadow = true;
    g.add(plane);
    // fileiras de telhas sobrepostas com variacao de cor
    for (let row = 0; row < 7; row++) {
      const u = (row + 0.5) / 7;
      const tj = 0.88 + ((row * 37) % 11) / 44;
      const tileM2 = new THREE.MeshStandardMaterial({ color: new THREE.Color(roof).multiplyScalar(tj).getHex(), map: texClone(texTiles, 6, 1), bumpMap: texClone(texTiles, 6, 1), bumpScale: 1.05, roughness: 0.84 });
      const slen = Math.hypot(roofRun, roofRise) / 7 + 0.16 * sc;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(slen, 0.085 * sc, D + 1.72 * sc), tileM2);
      strip.position.set(s2 * roofRun * (1 - u), Y0 + H + roofRise * u + 0.065 * sc, 0);
      strip.rotation.z = s2 * -slope;
      g.add(strip);
    }
  }
  // caibros (rabos de viga) sob os beirais
  for (const s2 of [-1, 1]) for (let rz2 = -3; rz2 <= 3; rz2++) {
    const raf = new THREE.Mesh(new THREE.BoxGeometry(0.5 * sc, 0.12 * sc, 0.14 * sc), woodM);
    raf.position.set(s2 * (roofRun - 0.16 * sc), Y0 + H + 0.02 * sc, rz2 * (D / 6.4));
    raf.rotation.z = s2 * -slope * 0.45;
    g.add(raf);
  }
  // telhas da cumeeira
  for (let rc = -3; rc <= 3; rc++) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * sc, 0.2 * sc, (D + 1.75 * sc) / 7, 8, 1, false, 0, Math.PI), roofM);
    cap.position.set(0, Y0 + H + roofRise + 0.1 * sc, rc * ((D + 1.6 * sc) / 7));
    cap.rotation.x = Math.PI / 2;
    cap.rotation.z = Math.PI / 2;
    g.add(cap);
  }
  // empenas triangulares
  const shape = new THREE.Shape();
  shape.moveTo(-roofRun * 0.99, 0); shape.lineTo(roofRun * 0.99, 0); shape.lineTo(0, roofRise); shape.lineTo(-roofRun * 0.99, 0);
  const gableGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.16 * sc, bevelEnabled: false });
  for (const s2 of [-1, 1]) {
    const gm = new THREE.Mesh(gableGeo, wallM);
    gm.position.set(0, Y0 + H, s2 * (D / 2 - 0.02) - (s2 > 0 ? 0.02 : -0.02 + 0.16 * sc));
    g.add(gm);
    // viga da cumeeira na empena
    beam(0.22 * sc, 0.22 * sc, 0.2 * sc, 0, Y0 + H + roofRise * 0.55, s2 * (D / 2 + 0.1 * sc));
  }
  // cumeeira + beiral
  beam(0.3 * sc, 0.24 * sc, D + 1.7 * sc, 0, Y0 + H + roofRise + 0.02 * sc, 0);
  for (const s2 of [-1, 1]) beam(0.2 * sc, 0.2 * sc, D + 1.6 * sc, s2 * (roofRun - 0.1 * sc), Y0 + H + 0.12 * sc, 0);
  // porta de tábuas com batente e maçaneta
  const doorM = new THREE.MeshStandardMaterial({ color: 0x5a3a22, map: texClone(texWood, 1, 2), bumpMap: texClone(texWood, 1, 2), bumpScale: 0.35, roughness: 0.8 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.5 * sc, 2.55 * sc, 0.16), doorM);
  door.position.set(0, 1.28 * sc, D / 2 + 0.1 * sc); g.add(door);
  for (const pxx of [-0.5, 0, 0.5]) beam(0.07 * sc, 2.5 * sc, 0.05 * sc, pxx * sc, 1.28 * sc, D / 2 + 0.2 * sc);
  beam(1.9 * sc, 0.18 * sc, 0.14 * sc, 0, 2.62 * sc, D / 2 + 0.12 * sc);
  beam(0.18 * sc, 2.7 * sc, 0.14 * sc, -0.86 * sc, 1.32 * sc, D / 2 + 0.12 * sc);
  beam(0.18 * sc, 2.7 * sc, 0.14 * sc, 0.86 * sc, 1.32 * sc, D / 2 + 0.12 * sc);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075 * sc, 7, 6), new THREE.MeshStandardMaterial({ color: 0x3a2c1c, metalness: 0.55, roughness: 0.45 }));
  knob.position.set(0.52 * sc, 1.28 * sc, D / 2 + 0.22 * sc); g.add(knob);
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.9 * sc, 0.24 * sc, 0.9 * sc), stoneM);
  step.position.set(0, 0.12 * sc, D / 2 + 0.6 * sc); g.add(step);
  // janelas com moldura, vidro e contraventro
  const frameM = new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.85 });
  const winM = new THREE.MeshStandardMaterial({ color: 0x223242, roughness: 0.07, metalness: 0.55, envMapIntensity: 1.35, emissive: 0x1a2836 });
  windowMats.push(winM);
  for (const wz of [D / 2 + 0.06, -D / 2 - 0.06]) {
    for (const wx of [-2.55, 2.55]) {
      const dir = wz > 0 ? 1 : -1;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6 * sc, 1.7 * sc, 0.12), frameM);
      frame.position.set(wx * sc, 2.75 * sc, wz + dir * 0.04); g.add(frame);
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.32 * sc, 1.42 * sc, 0.1), winM);
      win.position.set(wx * sc, 2.75 * sc, wz + dir * 0.1); g.add(win);
      beam(0.07 * sc, 1.42 * sc, 0.06 * sc, wx * sc, 2.75 * sc, wz + dir * 0.15);
      beam(1.32 * sc, 0.07 * sc, 0.06 * sc, wx * sc, 2.75 * sc, wz + dir * 0.15);
    }
  }
  for (const s2 of [-1, 1]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6 * sc, 1.5 * sc), frameM);
    frame.position.set(s2 * (W / 2 + 0.08), 2.75 * sc, 0); g.add(frame);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.32 * sc, 1.22 * sc), winM);
    win.position.set(s2 * (W / 2 + 0.14), 2.75 * sc, 0); g.add(win);
  }
  // contraventos nas janelas da frente
  const shutterM = new THREE.MeshStandardMaterial({ color: 0x4a6a4e, map: texClone(texWood, 1, 2), bumpMap: texClone(texWood, 1, 2), bumpScale: 0.3, roughness: 0.8 });
  for (const wx of [-2.55, 2.55]) {
    for (const s3 of [-1, 1]) {
      const sh2 = new THREE.Mesh(new THREE.BoxGeometry(0.42 * sc, 1.55 * sc, 0.06 * sc), shutterM);
      sh2.position.set(wx * sc + s3 * 1.12 * sc, 2.75 * sc, D / 2 + 0.16 * sc);
      sh2.rotation.y = s3 * -0.22;
      g.add(sh2);
    }
  }
  // chaminé com fumaça subindo
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.95 * sc, 2.4 * sc, 0.95 * sc), roofM);
  chim.position.set(2.5 * sc, 6.6 * sc, -1.7 * sc); g.add(chim);
  const smokes = [];
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xd8d8d8, transparent: true, opacity: 0.3, depthWrite: false }));
    sp.renderOrder = 2;
    g.add(sp); smokes.push(sp);
  }
  const chimTop = new THREE.Vector3(2.5 * sc, 7.9 * sc, -1.7 * sc);
  animatables.push(t => {
    for (let i = 0; i < 3; i++) {
      const tt = (t * 0.22 + i * 0.33) % 1;
      const sp = smokes[i];
      sp.position.set(chimTop.x + Math.sin(t * 0.8 + i * 2) * 0.7 * tt, chimTop.y + tt * 4.2, chimTop.z);
      sp.material.opacity = 0.32 * (1 - tt);
      const s2 = (1.1 + tt * 3.2) * sc;
      sp.scale.set(s2, s2, 1);
    }
  });
  // jardineiras nas janelas da frente
  const boxM = new THREE.MeshStandardMaterial({ color: 0x7a4a28 });
  const petM = new THREE.MeshStandardMaterial({ color: 0xe06a9a });
  for (const wx of [-2.6, 2.6]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.4 * sc, 0.3 * sc, 0.5 * sc), boxM);
    box.position.set(wx * sc, 1.92 * sc, 3.92 * sc); g.add(box);
    for (let k = -1; k <= 1; k++) {
      const pet = new THREE.Mesh(new THREE.SphereGeometry(0.13 * sc, 6, 5), petM);
      pet.position.set(wx * sc + k * 0.38 * sc, 2.16 * sc, 3.92 * sc); g.add(pet);
    }
  }
  // lanterna ao lado da porta (acende à noite)
  const lantCore = new THREE.Mesh(new THREE.SphereGeometry(0.15 * sc, 7, 6), new THREE.MeshStandardMaterial({ color: 0x554433, emissive: 0x000000 }));
  lantCore.position.set(1.16 * sc, 2.6 * sc, 3.95 * sc); g.add(lantCore);
  const lantGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc070, transparent: true, opacity: 0, depthWrite: false }));
  lantGlow.scale.set(1.7 * sc, 1.7 * sc, 1);
  lantGlow.position.copy(lantCore.position); g.add(lantGlow);
  lanternCoreMats.push(lantCore.material);
  lanternGlowMats.push(lantGlow.material);
  addShadowBlob(g, 7.5 * sc);
  g.position.set(x, h0, z); g.rotation.y = rot;
  houseColliders.push({ x, z, r: 6.4 * sc });
  scene.add(g);
  return g;
}
let bonfire = null;
function buildBonfire() {
  const g2 = new THREE.Group();
  const logM = new THREE.MeshStandardMaterial({ color: 0x5a3c22, map: texClone(texWood, 1, 1), roughness: 0.92 });
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.115, 1.05, 6), logM);
    log.rotation.z = Math.PI / 2 - 0.32; log.rotation.y = i * 1.256;
    log.position.y = 0.17; log.castShadow = true; g2.add(log);
  }
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.95 });
  for (let i = 0; i < 9; i++) {
    const st = new THREE.Mesh(new THREE.SphereGeometry(0.15, 5, 4), stoneM);
    const a = i / 9 * 6.28;
    st.position.set(Math.cos(a) * 0.68, 0.09, Math.sin(a) * 0.68); st.scale.y = 0.62; g2.add(st);
  }
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa040, transparent: true, opacity: 0.8, depthWrite: false }));
  flame.scale.set(1.35, 1.9, 1); flame.position.y = 0.9; g2.add(flame);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe2a8, transparent: true, opacity: 0.95, depthWrite: false }));
  core.scale.set(0.72, 1.05, 1); core.position.y = 0.72; g2.add(core);
  const light = new THREE.PointLight(0xff9040, 0, 17, 2);
  light.position.y = 1.25; g2.add(light);
  const fx = VILLAGE.x - 7, fz = VILLAGE.z + 11;
  g2.position.set(fx, height(fx, fz), fz);
  scene.add(g2);
  bonfire = { g: g2, flame, core, light };
  animatables.push(t => {
    const night = (hour >= 19.1 || hour < 5.7) ? 1 : 0;
    const fl = night * (0.82 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.08);
    flame.material.opacity = 0.16 + fl * 0.8;
    core.material.opacity = 0.22 + fl * 0.75;
    flame.scale.set(1.15 + fl * 0.55, 1.6 + fl * 0.9, 1);
    light.intensity = night * (1.7 + Math.sin(t * 11) * 0.4);
  });
}
const props = [];
function buildProps() {
  const bodyM = new THREE.MeshStandardMaterial({ color: 0x7a5232, map: texClone(texWood, 1, 1), bumpMap: texClone(texWood, 1, 1), bumpScale: 0.3, roughness: 0.8 });
  const hoopM = new THREE.MeshStandardMaterial({ color: 0x4a3c30, metalness: 0.5, roughness: 0.5 });
  for (let i = 0; i < 14; i++) {
    const g2 = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.9, 10), bodyM);
    body.position.y = 0.45; body.castShadow = true; g2.add(body);
    for (const hy of [0.22, 0.68]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.355, 0.028, 5, 12), hoopM);
      hoop.rotation.x = Math.PI / 2; hoop.position.y = hy; g2.add(hoop);
    }
    const ang = i * 1.7, rr = 9 + (i % 5) * 5.5;
    const px2 = VILLAGE.x + Math.cos(ang) * rr, pz2 = VILLAGE.z + Math.sin(ang) * rr * 0.82;
    g2.position.set(px2, height(px2, pz2), pz2);
    scene.add(g2);
    props.push({ g: g2, x: px2, z: pz2, vx: 0, vz: 0, r: 0.62 });
  }
}
function updateProps(dt) {
  if (!hero) return;
  for (const pr of props) {
    const dx = pr.x - hero.x, dz = pr.z - hero.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 1.85 * 1.85 && d2 > 0.0001) {
      const d = Math.sqrt(d2), push = (1.85 - d) * 7.5;
      pr.vx += (dx / d) * push * dt * 11;
      pr.vz += (dz / d) * push * dt * 11;
      if (Math.abs(pr.vx) + Math.abs(pr.vz) > 1.2) {
        if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} }
        unlock('empurrador', 'Empurrador de Barris');
      }
    }
    const fr = Math.pow(0.1, dt);
    pr.vx *= fr; pr.vz *= fr;
    pr.x += pr.vx * dt; pr.z += pr.vz * dt;
    const cc = collideCircle(pr.x, pr.z, pr.r);
    pr.x = cc.x; pr.z = cc.z;
    pr.g.position.set(pr.x, height(pr.x, pr.z), pr.z);
    pr.g.rotation.x += pr.vz * dt * 1.7;
    pr.g.rotation.z -= pr.vx * dt * 1.7;
  }
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
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 1.3, 12), new THREE.MeshStandardMaterial({ color: 0xcfc4ae }));
  base.position.y = 0.65; fg.add(base);
  const wtr = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x5aa8d8, transparent: true, opacity: 0.85 }));
  wtr.position.y = 1.42; fg.add(wtr);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.05, 3.1, 8), new THREE.MeshStandardMaterial({ color: 0xd8cdb6 }));
  pillar.position.y = 2.6; fg.add(pillar);
  const orbM = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x4a90c8 });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), orbM);
  orb.position.y = 5.0; fg.add(orb);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x7fd4ff, transparent: true, opacity: 0.7, depthWrite: false }));
  glow.scale.set(7, 7, 1); glow.position.y = 5.0; fg.add(glow);
  addShadowBlob(fg, 5);
  fg.position.set(VILLAGE.x, height(VILLAGE.x, VILLAGE.z), VILLAGE.z);
  scene.add(fg);
  houseColliders.push({ x: VILLAGE.x, z: VILLAGE.z, r: 5.2 });
  animatables.push(t => { orb.position.y = 5.0 + Math.sin(t * 1.1) * 0.22; glow.position.y = orb.position.y; });
  // ---- praça de pedra portuguesa ao redor da fonte ----
  const cobM = new THREE.MeshStandardMaterial({ map: texClone(texCobble, 7, 7), color: 0xbfb6a6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(21, 30), cobM);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(VILLAGE.x, height(VILLAGE.x, VILLAGE.z) + 0.1, VILLAGE.z);
  scene.add(plaza);
  // ---- barracas da feira (toldos listrados + mercadorias) ----
  function makeStall(sx, sz, rot, tint) {
    const g = new THREE.Group();
    const woodM = new THREE.MeshStandardMaterial({ color: 0x7a5230, map: texClone(texWood, 1, 1) });
    const table = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 1.5), woodM);
    table.position.y = 1.05; g.add(table);
    const front = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.05, 0.14), woodM);
    front.position.set(0, 0.52, 0.68); g.add(front);
    for (const px of [-1.55, 1.55]) for (const pz of [-0.62, 0.62]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 2.55, 7), woodM);
      post.position.set(px, 1.28, pz); g.add(post);
    }
    const awnM = new THREE.MeshStandardMaterial({ color: tint, map: texClone(texStripe, 3, 1), side: THREE.DoubleSide });
    const awn = new THREE.Mesh(new THREE.BoxGeometry(3.95, 0.09, 2.15), awnM);
    awn.position.set(0, 2.58, 0.12); awn.rotation.x = -0.17; g.add(awn);
    const fruitCols = [0xd84a3a, 0xe8963a, 0x7ab040, 0xd8b83a, 0xb04a68];
    for (let i = 0; i < 12; i++) {
      const fr = new THREE.Mesh(new THREE.SphereGeometry(0.135 + Math.random() * 0.05, 7, 6), new THREE.MeshStandardMaterial({ color: fruitCols[i % fruitCols.length] }));
      fr.position.set(-1.32 + (i % 6) * 0.52, 1.28, -0.18 + Math.floor(i / 6) * 0.42); g.add(fr);
    }
    for (let i = 0; i < 3; i++) {
      const bread = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc89050 }));
      bread.scale.set(1.45, 0.62, 0.9);
      bread.position.set(-1.0 + i * 0.95, 1.24, -0.56); g.add(bread);
    }
    const rolls = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x7a9ac8 }));
    rolls.rotation.z = Math.PI / 2; rolls.position.set(1.15, 1.28, 0.3); g.add(rolls);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.85, 9), woodM);
    barrel.position.set(2.2, 0.42, 0.35); g.add(barrel);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.36, 9), new THREE.MeshStandardMaterial({ color: 0xb08a4a }));
    basket.position.set(-2.15, 0.18, 0.4); g.add(basket);
    addShadowBlob(g, 2.6);
    g.position.set(sx, height(sx, sz), sz); g.rotation.y = rot;
    houseColliders.push({ x: sx, z: sz, r: 2.1 });
    scene.add(g);
  }
  const stallTints = [0xc85040, 0x4a8a5c, 0x4a6ac0, 0xc08a30, 0xa04a88];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.55;
    const r = 13.5;
    const sx = VILLAGE.x + Math.cos(ang) * r, sz = VILLAGE.z + Math.sin(ang) * r * 0.92;
    makeStall(sx, sz, -ang + Math.PI / 2, stallTints[i]);
  }
  // barris e caixas soltas pela vila
  const crateM = new THREE.MeshStandardMaterial({ color: 0x8a6238, map: texClone(texWood, 1, 1) });
  for (let i = 0; i < 9; i++) {
    const ang = rand(0, 6.28), r = rand(10, 34);
    const cx = VILLAGE.x + Math.cos(ang) * r, cz = VILLAGE.z + Math.sin(ang) * r * 0.85;
    const hh = height(cx, cz);
    if (i % 2 === 0) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.29, 0.82, 9), crateM);
      bar.position.set(cx, hh + 0.41, cz); bar.rotation.y = rand(0, 6.28); scene.add(bar);
    } else {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.72, 0.85), crateM);
      box.position.set(cx, hh + 0.36, cz); box.rotation.y = rand(0, 6.28); scene.add(box);
    }
    addShadowBlob(scene.children[scene.children.length - 1], 0.9);
  }
  // moinho
  const mg = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.4, 13, 10), new THREE.MeshStandardMaterial({ color: 0xd8c6a2 }));
  tower.position.y = 6.5; mg.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3.9, 3.2, 10), new THREE.MeshStandardMaterial({ color: 0x8c4630 }));
  cap.position.y = 14.2; mg.add(cap);
  const hub = new THREE.Group(); hub.position.set(0, 12, 3.6);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10.5, 0.22), new THREE.MeshStandardMaterial({ color: 0xefe3c8 }));
    blade.position.y = 5.2; const arm = new THREE.Group(); arm.rotation.z = (i / 4) * Math.PI * 2; arm.add(blade); hub.add(arm);
  }
  mg.add(hub); windmillBlades = hub;
  addShadowBlob(mg, 5.5);
  mg.position.set(WINDMILL.x, height(WINDMILL.x, WINDMILL.z), WINDMILL.z);
  mg.rotation.y = -0.7; scene.add(mg);
  houseColliders.push({ x: WINDMILL.x, z: WINDMILL.z, r: 5.6 });
  animatables.push((t, dt) => { hub.rotation.z += dt * 0.55; });
  // ruínas antigas
  const colM = new THREE.MeshStandardMaterial({ color: 0xb8ac96 });
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
  const runaM = new THREE.MeshStandardMaterial({ color: 0x9ad8ff, emissive: 0x2a6a9a });
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
  for (const [sx, sz] of spots) {
    let x = sx, z = sz;
    let h = height(x, z);
    if (h < WATER_Y + 1.5 && distTo(x, z, LAKE.x, LAKE.z) < LAKE.r + 140) {
      let best = null;
      for (let r = 5; r <= 250 && !best; r += 5) {
        for (let a = 0; a < 360; a += 12) {
          const nx = x + Math.cos(a * Math.PI / 180) * r, nz = z + Math.sin(a * Math.PI / 180) * r;
          const nh = height(nx, nz);
          if (nh >= WATER_Y + 1.5) { best = [nx, nz, nh]; break; }
        }
      }
      if (best) { x = best[0]; z = best[1]; h = best[2]; }
    }
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3.6, 6), new THREE.MeshStandardMaterial({ color: 0x4a3624 }));
    post.position.y = 1.8; g.add(post);
    const coreM = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb45a });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 7), coreM);
    core.position.y = 3.8; g.add(core);
    lanternCoreMats.push(coreM);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a1c }));
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
const texSkin = makeTexture(128, (x, s2) => {
  for (let y = 0; y < s2; y++) for (let i = 0; i < s2; i++) {
    const v = Math.round(132 + Math.random() * 20 - 10 + Math.sin(i * 0.31 + y * 0.17) * 4);
    x.fillStyle = 'rgb(' + v + ',' + (v - 2) + ',' + (v - 4) + ')';
    x.fillRect(i, y, 1, 1);
  }
  for (let k = 0; k < 240; k++) {
    x.fillStyle = 'rgba(90,70,60,0.16)';
    x.fillRect(Math.random() * s2, Math.random() * s2, 1, 1);
  }
});
const texLeather = makeTexture(128, (x, s2) => {
  for (let y = 0; y < s2; y++) for (let i = 0; i < s2; i++) {
    const v = Math.round(128 + Math.sin(i * 0.22) * 10 + Math.sin(y * 0.19 + i * 0.11) * 12 + Math.random() * 16 - 8);
    x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
    x.fillRect(i, y, 1, 1);
  }
  for (let k = 0; k < 26; k++) {
    x.strokeStyle = 'rgba(70,55,45,0.22)';
    x.lineWidth = 1 + Math.random() * 2;
    x.beginPath();
    x.moveTo(Math.random() * s2, Math.random() * s2);
    x.quadraticCurveTo(Math.random() * s2, Math.random() * s2, Math.random() * s2, Math.random() * s2);
    x.stroke();
  }
});
const texFur = makeTexture(128, (x, s2) => {
  for (let y = 0; y < s2; y++) for (let i = 0; i < s2; i++) {
    const v = Math.round(128 + Math.sin(i * 0.9 + y * 0.13) * 16 + Math.random() * 18 - 9);
    x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
    x.fillRect(i, y, 1, 1);
  }
  for (let k = 0; k < 90; k++) {
    x.strokeStyle = 'rgba(60,50,42,0.2)';
    x.lineWidth = 1;
    const x0 = Math.random() * s2, y0 = Math.random() * s2;
    x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + (Math.random() * 8 - 4), y0 + 10 + Math.random() * 14); x.stroke();
  }
});
function furify(mat, amt) {
  const a = amt === undefined ? 0.15 : amt;
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', 'float rimF = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.4); gl_FragColor.rgb += vec3(1.0, 0.93, 0.82) * rimF * ' + a + ';');
  };
  return mat;
}
const GLB_FILES = {
  mage: 'assets/mage.glb', rogue: 'assets/rogue.glb', roguehooded: 'assets/roguehooded.glb', barb: 'assets/barbarian.glb',
  deer: 'assets/deer.glb', stag: 'assets/stag.glb', fox: 'assets/fox.glb', wolf: 'assets/wolf.glb',
  shiba: 'assets/shibainu.glb', husky: 'assets/husky.glb', alpaca: 'assets/alpaca.glb', horse: 'assets/horse.glb'
};
const GLB = { models: {}, pending: 0, swapped: false };
function glbBuild(key, targetH, wantWalk) {
  const src = GLB.models[key];
  if (!src || !THREE.SkeletonUtils) return null;
  const wrap = new THREE.Group();
  const inner = THREE.SkeletonUtils.clone(src.scene);
  const box = new THREE.Box3().setFromObject(inner);
  const h = box.max.y - box.min.y;
  const sc = h > 0.01 ? targetH / h : 1;
  inner.scale.setScalar(sc);
  inner.position.y = -box.min.y * sc;
  inner.traverse(o => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = true; o.receiveShadow = true;
      if (o.material && o.material.clone) o.material = o.material.clone();
    }
  });
  wrap.add(inner);
  const mixer = new THREE.AnimationMixer(inner);
  const actions = {};
  (src.animations || []).forEach(a => {
    const short = a.name.split('|').pop();
    actions[short] = mixer.clipAction(a);
    actions[a.name] = actions[short];
  });
  const first = (wantWalk && (actions.Walk || actions.Gallop)) || actions.Idle || actions.Unarmed_Idle;
  if (first) first.play();
  return { g: wrap, mixer, actions, isGLTF: true, animWant: first === actions.Idle ? 'Idle' : 'Walk' };
}
function glbSwapRig(obj, gl, blobR) {
  if (!obj || !obj.g || !gl) return false;
  const old = obj.g;
  gl.g.position.copy(old.position);
  gl.g.rotation.copy(old.rotation);
  scene.add(gl.g);
  scene.remove(old);
  addShadowBlob(gl.g, blobR);
  if (obj.nametag) gl.g.add(obj.nametag);
  obj.g = gl.g; obj.mixer = gl.mixer; obj.actions = gl.actions;
  obj.isGLTF = true; obj.animWant = gl.animWant;
  return true;
}
function swapPeopleToGLB() {
  if (GLB.swapped) return;
  GLB.swapped = true;
  try {
    if (typeof hero !== 'undefined' && hero && hero.g && !hero.mounted) {
      const gl = glbBuild('mage', 1.78, false);
      if (gl && glbSwapRig(hero, gl, 0.85)) applyHeroStyle();
    }
    const picks = ['rogue', 'roguehooded', 'barb', 'mage'];
    let i = 0;
    for (const n of (typeof npcList !== 'undefined' ? npcList : [])) {
      const gl = glbBuild(picks[(i++) % picks.length], 1.72 + (i % 3) * 0.05, false);
      glbSwapRig(n, gl, 0.8);
    }
    const A = { cervo: ['deer', 'stag'], cachorro: ['shiba', 'husky'], cabra: ['alpaca'] };
    for (const an of (typeof animalList !== 'undefined' ? animalList : [])) {
      const pk = A[an.kind];
      if (!pk) continue;
      const gl = glbBuild(pk[Math.floor(Math.random() * pk.length)], 1.15, true);
      if (gl && glbSwapRig(an, gl, 0.7)) an.animWant = gl.animWant;
    }
  } catch (e) { }
}
function loadGLTFAssets() {
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined' || !window.THREE || !THREE.GLTFLoader) return;
  const loader = new THREE.GLTFLoader();
  const keys = Object.keys(GLB_FILES);
  GLB.pending = keys.length;
  keys.forEach(k => {
    try {
      loader.load(GLB_FILES[k], (g) => {
        GLB.models[k] = g;
        if (--GLB.pending <= 0) swapPeopleToGLB();
      }, undefined, () => {
        if (--GLB.pending <= 0) swapPeopleToGLB();
      });
    } catch (e) {
      if (--GLB.pending <= 0) swapPeopleToGLB();
    }
  });
}
function poseG(rig, st, dt) {
  dt = Math.min(dt || 0.016, 0.05);
  if (rig.mixer) rig.mixer.update(dt);
  let want = 'Idle';
  if (st.mounted) want = 'Sit_Chair_Idle';
  else if (st.air) want = 'Jump_Full_Short';
  else if (st.swim) want = 'Walking_A';
  else if (st.moving) want = st.run ? 'Running_A' : 'Walking_A';
  else if (st.talk) want = 'Interact';
  if (want !== rig.animWant) {
    const a = rig.actions[want] || rig.actions.Idle || rig.actions.Unarmed_Idle;
    const old = rig.actions[rig.animWant];
    if (old && old !== a) old.fadeOut(0.22);
    if (a) { a.reset().fadeIn(0.22).play(); }
    rig.animWant = want;
  }
}
loadGLTFAssets();
const SKINS = ['#e8b88a', '#c98a5e', '#8a5a3c', '#f0c9a2'];
const HUES = [0, 45, 120, 210, 300, 160];
let heroName = 'Ari', heroHue = 120, heroSkin = 0;

/* ---------------- personagens: humanoide detalhado (rig com articulacoes) ---------------- */
function srot(obj, x, y, z, dt, r) {
  const k = 1 - Math.exp(-(r || 11) * dt);
  obj.rotation.x += (x - obj.rotation.x) * k;
  obj.rotation.y += (y - obj.rotation.y) * k;
  obj.rotation.z += (z - obj.rotation.z) * k;
}
function makeHumanoid(o) {
  o = o || {};
  const skinC = o.skin !== undefined ? o.skin : 0xe8b88a;
  const tunicC = o.tunic !== undefined ? o.tunic : 0xd8d0bc;
  const pantsC = o.pants !== undefined ? o.pants : 0x4a3c30;
  const bootC = o.boots !== undefined ? o.boots : 0x6a4a32;
  const hairC = o.hairColor !== undefined ? o.hairColor : 0x4a2e18;
  const bulk = o.bulk || 1;
  const ch = o.child ? 0.72 : 1;
  const g = new THREE.Group();
  const vestHex = new THREE.Color(tunicC).multiplyScalar(0.58).getHex();
  const skinM = new THREE.MeshStandardMaterial({ color: skinC, map: texClone(texSkin, 2, 2), bumpMap: texClone(texSkin, 3, 3), bumpScale: 0.012, roughness: 0.62, metalness: 0.02, envMapIntensity: 0.62, emissive: 0x241208, emissiveIntensity: 0.22 });
  const tunicM = new THREE.MeshStandardMaterial({ color: tunicC, map: texClone(texCloth, 2, 2), bumpMap: texClone(texCloth, 3, 3), bumpScale: 0.028, roughness: 0.9, metalness: 0.01, envMapIntensity: 0.5 });
  const pantsM = new THREE.MeshStandardMaterial({ color: pantsC, map: texClone(texCloth, 2, 2), bumpMap: texClone(texCloth, 3, 3), bumpScale: 0.028, roughness: 0.9, metalness: 0.01, envMapIntensity: 0.5 });
  const vestM = new THREE.MeshStandardMaterial({ color: vestHex, map: texClone(texCloth, 2, 2), bumpMap: texClone(texCloth, 3, 3), bumpScale: 0.032, roughness: 0.88, metalness: 0.01, envMapIntensity: 0.5 });
  const bootM = new THREE.MeshStandardMaterial({ color: bootC, map: texClone(texLeather, 2, 2), bumpMap: texClone(texLeather, 2, 2), bumpScale: 0.03, roughness: 0.58, metalness: 0.05, envMapIntensity: 0.7 });
  const hairM = new THREE.MeshStandardMaterial({ color: hairC, map: texClone(texFur, 2, 2), bumpMap: texClone(texFur, 3, 3), bumpScale: 0.022, roughness: 0.58, metalness: 0.05, envMapIntensity: 0.62 });
  const lipM = new THREE.MeshStandardMaterial({ color: 0xa86455, roughness: 0.52, envMapIntensity: 0.5 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x221812, roughness: 0.35, metalness: 0.05 });
  const scleraM = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.22, envMapIntensity: 1.1 });
  const irisM = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.18, envMapIntensity: 1.2 });
  let cloakM = null;
  if (typeof furify === 'function') { furify(skinM, 0.1); furify(hairM, 0.17); furify(bootM, 0.08); }

  // ---- pernas: pivô no quadril + joelho (altura total 1.75, 7 cabecas) ----
  const hips = new THREE.Group(); hips.position.y = 0.93 * ch; g.add(hips);
  function leg(side) {
    const lg = new THREE.Group(); lg.position.set(side * 0.098 * bulk * ch, 0, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.088 * bulk * ch, 0.062 * bulk * ch, 0.42, 10), pantsM);
    thigh.position.y = -0.21; thigh.scale.z = 1.14; lg.add(thigh);
    const quad = new THREE.Mesh(new THREE.SphereGeometry(0.062 * bulk * ch, 8, 6), pantsM);
    quad.position.set(0, -0.16, 0.03 * ch); quad.scale.set(1, 1.6, 0.85); lg.add(quad);
    const knee = new THREE.Group(); knee.position.y = -0.42; lg.add(knee);
    const kneecap = new THREE.Mesh(new THREE.SphereGeometry(0.048 * ch, 7, 6), pantsM);
    kneecap.position.set(0, -0.012, 0.022 * ch); kneecap.scale.set(1, 1.08, 0.85); knee.add(kneecap);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.056 * ch, 0.038 * ch, 0.34, 8), pantsM);
    shin.position.y = -0.17; knee.add(shin);
    const calf = new THREE.Mesh(new THREE.SphereGeometry(0.05 * ch, 7, 6), pantsM);
    calf.position.set(0, -0.1, -0.028 * ch); calf.scale.set(1, 1.75, 0.85); knee.add(calf);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.056 * ch, 0.066 * ch, 0.24, 8), bootM);
    shaft.position.set(0, -0.38, 0.005); knee.add(shaft);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.092 * ch, 0.055, 0.21), bootM);
    foot.position.set(0, -0.465, 0.055); knee.add(foot);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.047 * ch, 7, 5), bootM);
    toe.position.set(0, -0.475, 0.155); toe.scale.set(1, 0.62, 1.1); knee.add(toe);
    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.07 * ch, 0.045, 0.06), bootM);
    heel.position.set(0, -0.5, -0.03); knee.add(heel);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.1 * ch, 0.018, 0.225), darkM);
    sole.position.set(0, -0.497, 0.055); knee.add(sole);
    hips.add(lg);
    return { lg, knee };
  }
  const L = leg(-1), R = leg(1);

  // ---- torso: camadas (camisa, colete aberto, gola, cinto) ----
  const torso = new THREE.Group(); torso.position.y = 0.26 * ch; g.add(torso);
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.108 * bulk * ch, 0.122 * bulk * ch, 0.17, 10), pantsM);
  pelvis.position.y = 0.62 * ch; pelvis.scale.z = 0.8; torso.add(pelvis);
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.102 * bulk * ch, 0.112 * bulk * ch, 0.13, 10), tunicM);
  waist.position.y = 0.735 * ch; waist.scale.z = 0.78; torso.add(waist);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.112 * bulk * ch, 0.15 * bulk * ch, 0.26, 12), tunicM);
  chest.position.y = 0.9 * ch; chest.scale.set(0.92, 1, 0.72); torso.add(chest);
  const pecs = new THREE.Mesh(new THREE.SphereGeometry(0.092 * bulk * ch, 9, 7), tunicM);
  pecs.position.set(0, 0.985 * ch, 0.048 * ch); pecs.scale.set(1.35, 0.55, 0.7); torso.add(pecs);
  const shYoke = new THREE.Mesh(new THREE.SphereGeometry(0.072 * bulk * ch, 9, 7), vestM);
  shYoke.position.set(0, 1.075 * ch, 0); shYoke.scale.set(1.75, 0.5, 0.88); torso.add(shYoke);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.124 * ch, 0.124 * ch, 0.052, 12), bootM);
  belt.position.y = 0.685 * ch; belt.scale.z = 0.82; torso.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.052 * ch, 0.042 * ch, 0.016), new THREE.MeshStandardMaterial({ color: 0xc8a24a, metalness: 0.7, roughness: 0.38 }));
  buckle.position.set(0, 0.685 * ch, 0.108 * ch); torso.add(buckle);
  for (const s of [-1, 1]) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.072 * ch, 0.088 * ch, 0.05 * ch), bootM);
    pouch.position.set(s * 0.098 * ch, 0.645 * ch, 0.102 * ch); torso.add(pouch);
  }
  const vestBack = new THREE.Mesh(new THREE.BoxGeometry(0.23 * bulk * ch, 0.36 * ch, 0.014), vestM);
  vestBack.position.set(0, 0.92 * ch, -0.108 * ch); torso.add(vestBack);
  for (const s of [-1, 1]) {
    const vestF = new THREE.Mesh(new THREE.BoxGeometry(0.1 * ch, 0.36 * ch, 0.014), vestM);
    vestF.position.set(s * 0.062 * ch, 0.92 * ch, 0.108 * ch); vestF.rotation.y = -s * 0.14; torso.add(vestF);
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.046 * bulk * ch, 7, 6), vestM);
    shoulderCap.position.set(s * 0.152 * bulk * ch, 1.068 * ch, 0); shoulderCap.scale.set(1, 0.72, 1.12); torso.add(shoulderCap);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.052 * ch, 0.062 * ch, 0.038, 9), vestM);
  collar.position.y = 1.185 * ch; collar.scale.z = 0.9; torso.add(collar);
  if (o.dress) {
    const dressM = new THREE.MeshStandardMaterial({ color: tunicC, map: texClone(texCloth, 2, 2), bumpMap: texClone(texCloth, 3, 3), bumpScale: 0.028, roughness: 0.9 });
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.135 * ch, 0.27 * ch, 0.74, 12, 1, true), dressM);
    skirt.position.y = 0.3 * ch; torso.add(skirt);
    const skirt2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * ch, 0.145 * ch, 0.42, 12), dressM);
    skirt2.position.y = 0.72 * ch; skirt2.scale.z = 0.82; torso.add(skirt2);
  }
  if (o.apron) {
    const apronM = new THREE.MeshStandardMaterial({ color: o.apron, map: texClone(texCloth, 2, 2), roughness: 0.88 });
    const ap = new THREE.Mesh(new THREE.BoxGeometry(0.2 * ch, 0.44 * ch, 0.012), apronM);
    ap.position.set(0, 0.48 * ch, 0.168 * ch); torso.add(ap);
  }
  if (o.shawl) {
    const shawlM = new THREE.MeshStandardMaterial({ color: o.shawl, map: texClone(texCloth, 2, 2), bumpMap: texClone(texCloth, 3, 3), bumpScale: 0.03, roughness: 0.9 });
    const shawl = new THREE.Mesh(new THREE.SphereGeometry(0.185 * bulk * ch, 12, 10), shawlM);
    shawl.position.y = 1.04 * ch; shawl.scale.set(1.12, 0.58, 1.08); torso.add(shawl);
    const shawlF = new THREE.Mesh(new THREE.BoxGeometry(0.13 * ch, 0.26 * ch, 0.012), shawlM);
    shawlF.position.set(-0.055 * ch, 0.82 * ch, 0.142 * ch); shawlF.rotation.z = 0.18; torso.add(shawlF);
  }
  if (o.armor) {
    const armorM = new THREE.MeshStandardMaterial({ color: 0x8a8fa0, map: texClone(texLeather, 2, 2), bumpMap: texClone(texLeather, 2, 2), bumpScale: 0.02, metalness: 0.55, roughness: 0.42, envMapIntensity: 1.1 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.27 * bulk * ch, 0.34 * ch, 0.16 * ch), armorM);
    plate.position.y = 0.95 * ch; torso.add(plate);
  }
  if (o.satchel) {
    const strapM = new THREE.MeshStandardMaterial({ color: 0x6a4526, map: texClone(texLeather, 1, 2), bumpMap: texClone(texLeather, 1, 2), bumpScale: 0.02, roughness: 0.62 });
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.52, 0.012), strapM);
    strap.position.set(0, 0.92 * ch, 0.118 * ch); strap.rotation.z = 0.62; torso.add(strap);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.1, 0.055), strapM);
    bag.position.set(-0.128 * ch, 0.72 * ch, 0.118 * ch); torso.add(bag);
  }

  // ---- braços + mãos com dedos ----
  function arm(side) {
    const ag = new THREE.Group(); ag.position.set(side * 0.178 * bulk * ch, 1.068 * ch, 0);
    const delt = new THREE.Mesh(new THREE.SphereGeometry(0.048 * bulk * ch, 8, 7), vestM);
    delt.position.y = 0.005; delt.scale.set(1, 1.18, 1); ag.add(delt);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.047 * ch, 0.038 * ch, 0.28, 8), tunicM);
    upper.position.y = -0.15; ag.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.29; ag.add(elbow);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.046 * ch, 0.042 * ch, 0.032, 8), tunicM);
    cuff.position.y = -0.015; elbow.add(cuff);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.038 * ch, 0.03 * ch, 0.24, 8), skinM);
    fore.position.y = -0.13; elbow.add(fore);
    const hand = new THREE.Group(); hand.position.y = -0.26; elbow.add(hand);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.052 * ch, 0.068 * ch, 0.026 * ch), skinM);
    palm.position.y = -0.034; hand.add(palm);
    for (let f = 0; f < 4; f++) {
      const fx = (f - 1.5) * 0.0155 * ch;
      const fl = f === 0 || f === 3 ? 0.026 : 0.031;
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.0125 * ch, fl, 0.013 * ch), skinM);
      p1.position.set(fx, -0.082, 0.002); p1.rotation.x = 0.22; hand.add(p1);
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.0115 * ch, fl * 0.72, 0.012 * ch), skinM);
      p2.position.set(fx, -0.082 - fl * 0.78, 0.012); p2.rotation.x = 0.55; hand.add(p2);
    }
    const thumb = new THREE.Group(); thumb.position.set(side * 0.028 * ch, -0.028, 0.012); thumb.rotation.z = -side * 0.75; hand.add(thumb);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.014 * ch, 0.034, 0.014 * ch), skinM);
    t1.position.y = -0.018; thumb.add(t1);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.0125 * ch, 0.026, 0.0125 * ch), skinM);
    t2.position.y = -0.048; t2.rotation.x = 0.35; thumb.add(t2);
    torso.add(ag);
    return { ag, elbow, hand };
  }
  const aL = arm(-1), aR = arm(1);

  // ---- cabeça realista (0.25 de altura -> 7 cabecas) ----
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * ch, 0.055 * ch, 0.115, 9), skinM);
  neck.position.y = 1.225 * ch; neck.scale.z = 0.88; torso.add(neck);
  const head = new THREE.Group(); head.position.y = 1.335 * ch; head.scale.setScalar(1.24); torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), skinM);
  skull.scale.set(1, 1.18, 1.06); skull.position.y = 0.012; head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.078, 11, 9), skinM);
  jaw.position.set(0, -0.052, 0.018); jaw.scale.set(1.04, 0.95, 1.1); head.add(jaw);
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 7, 6), skinM);
  chin.position.set(0, -0.092, 0.072); chin.scale.set(1, 0.8, 1); head.add(chin);
  for (const s of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.038, 7, 6), skinM);
    cheek.position.set(s * 0.066, -0.018, 0.062); cheek.scale.set(1, 1, 0.8); head.add(cheek);
  }
  const browRidge = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.016, 0.026), skinM);
  browRidge.position.set(0, 0.034, 0.082); head.add(browRidge);
  const eyes = [];
  for (const s of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 6), skinM);
    socket.position.set(s * 0.042, 0.013, 0.072); socket.scale.set(1, 0.78, 0.55); head.add(socket);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.0165, 8, 7), scleraM);
    white.position.set(s * 0.042, 0.011, 0.081); white.scale.set(1, 0.58, 0.48); head.add(white);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 7, 6), irisM);
    iris.position.set(s * 0.042, 0.011, 0.0935); iris.scale.set(1, 1, 0.45); head.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.004, 5, 4), darkM);
    pupil.position.set(s * 0.042, 0.011, 0.0975); head.add(pupil);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0195, 7, 5), skinM);
    lid.position.set(s * 0.042, 0.0205, 0.0795); lid.scale.set(1, 0.52, 0.5); head.add(lid);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 4, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    spark.position.set(s * 0.042 + 0.006, 0.016, 0.099); spark.userData.noShadow = true; head.add(spark);
    eyes.push(white);
  }
  for (const s of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.0075, 0.011), hairM);
    brow.position.set(s * 0.046, 0.043, 0.092); brow.rotation.z = s * 0.14; head.add(brow);
  }
  const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.05, 0.024), skinM);
  noseBridge.position.set(0, -0.006, 0.088); noseBridge.rotation.x = 0.2; head.add(noseBridge);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.017, 7, 6), skinM);
  nose.position.set(0, -0.036, 0.104); nose.scale.set(1.1, 0.85, 1); head.add(nose);
  for (const s of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 5, 4), darkM);
    nostril.position.set(s * 0.011, -0.042, 0.108); nostril.scale.set(1, 0.6, 0.8); head.add(nostril);
  }
  const lipU = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 8, 5), lipM);
  lipU.position.set(0, -0.062, 0.088); lipU.scale.set(1.25, 0.32, 0.42); head.add(lipU);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 8, 5), new THREE.MeshStandardMaterial({ color: 0x6e3830, roughness: 0.6 }));
  mouth.position.set(0, -0.0685, 0.0855); mouth.scale.set(1.2, 0.16, 0.34); head.add(mouth);
  const lipD = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 5), lipM);
  lipD.position.set(0, -0.0765, 0.0875); lipD.scale.set(1.1, 0.36, 0.48); head.add(lipD);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 7, 6), skinM);
    ear.position.set(s * 0.102, -0.012, -0.012); ear.scale.set(0.36, 1.05, 0.62); head.add(ear);
    const earIn = new THREE.Mesh(new THREE.SphereGeometry(0.016, 5, 4), new THREE.MeshStandardMaterial({ color: 0xb87858, roughness: 0.6 }));
    earIn.position.set(s * 0.112, -0.012, -0.006); earIn.scale.set(0.3, 0.85, 0.55); head.add(earIn);
  }

  // ---- cabelo por estilo ----
  const hs = o.hairStyle || 'short';
  if (hs !== 'bald' && hs !== 'hood') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.118, 12, 10), hairM);
    cap.position.set(0, 0.035, -0.012); cap.scale.set(1, 1.12, 1.08); head.add(cap);
    if (hs === 'messy') {
      for (const [fx, fy, fz, rz, sc2] of [[-0.07, 0.1, 0.088, -0.5, 1], [0.01, 0.118, 0.098, -0.25, 1.15], [0.085, 0.092, 0.082, 0.35, 0.9], [-0.025, 0.128, 0.05, -0.1, 1.05]]) {
        const fr = new THREE.Mesh(new THREE.ConeGeometry(0.036 * sc2, 0.082 * sc2, 6), hairM);
        fr.position.set(fx, fy, fz); fr.rotation.x = -0.38; fr.rotation.z = rz * 0.7; head.add(fr);
      }
      const back = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), hairM);
      back.position.set(0, 0.012, -0.06); back.scale.set(1, 0.95, 0.72); head.add(back);
    } else if (hs === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.062, 9, 8), hairM);
      bun.position.set(0, 0.115, -0.1); head.add(bun);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.014, 6, 12), hairM);
      band.position.copy(bun.position); band.rotation.x = 1.2; head.add(band);
    } else if (hs === 'long') {
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.09), hairM);
        side.position.set(s * 0.108, -0.13, -0.012); head.add(side);
      }
      const backL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.06), hairM);
      backL.position.set(0, -0.1, -0.105); head.add(backL);
    } else if (hs === 'straw') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.018, 14), new THREE.MeshStandardMaterial({ color: 0xd8b866, map: texClone(texFur, 2, 2), roughness: 0.82 }));
      brim.position.y = 0.1; head.add(brim);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xc8a855, map: texClone(texFur, 2, 2), roughness: 0.82 }));
      top.position.y = 0.155; head.add(top);
    } else if (hs === 'cap') {
      const capM = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: o.capColor || 0x8a4a3a, map: texClone(texCloth, 2, 2), roughness: 0.88 }));
      capM.position.y = 0.025; head.add(capM);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.012, 0.075), new THREE.MeshStandardMaterial({ color: o.capColor || 0x8a4a3a }));
      brim.position.set(0, 0.058, 0.128); head.add(brim);
    }
  }
  if (o.beard) {
    const beardM = new THREE.Mesh(new THREE.SphereGeometry(0.085, 9, 8), hairM);
    beardM.position.set(0, -0.078, 0.052); beardM.scale.set(1, 1.15, 0.9); head.add(beardM);
    mouth.position.z = 0.115;
  }
  if (o.helmet) {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.128, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: 0x9aa0b2, metalness: 0.55, roughness: 0.45, envMapIntensity: 1.1 }));
    helm.position.y = 0.025; head.add(helm);
    const helmNose = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.075, 0.012), new THREE.MeshStandardMaterial({ color: 0x8a90a2, metalness: 0.6, roughness: 0.4 }));
    helmNose.position.set(0, -0.03, 0.112); head.add(helmNose);
  }

  // ---- capa + capuz ----
  let cloak = null, hood = null;
  if (o.cloak !== undefined && o.cloak !== null) {
    cloakM = new THREE.MeshStandardMaterial({ color: o.cloak, map: texClone(texCloth, 2, 2), bumpMap: texClone(texCloth, 3, 3), bumpScale: 0.03, roughness: 0.9, side: THREE.DoubleSide });
    cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.142 * ch, 0.195 * ch, 0.98, 12, 1, true, Math.PI * 0.86, Math.PI * 1.28), cloakM);
    cloak.position.set(0, 0.72 * ch, 0); g.add(cloak);
    const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.026, 7, 6), new THREE.MeshStandardMaterial({ color: 0xd8b060, metalness: 0.7, roughness: 0.35 }));
    clasp.position.set(0, 1.21 * ch, 0.138 * ch); g.add(clasp);
    hood = new THREE.Mesh(new THREE.SphereGeometry(0.125 * ch, 10, 8), cloakM);
    hood.position.set(0, 1.26 * ch, -0.108 * ch); hood.scale.set(1, 0.85, 0.8); g.add(hood);
    if (o.hoodUp) {
      const up = new THREE.Mesh(new THREE.SphereGeometry(0.165 * ch, 12, 10), cloakM);
      up.position.set(0, 1.3 * ch, -0.03 * ch); up.scale.set(1, 1.12, 1.05); g.add(up);
      const face = head; face.position.z += 0.012;
    }
  }

  // ---- acessórios: cajado e lanterna ----
  if (o.staff) {
    const staffM = new THREE.MeshStandardMaterial({ color: 0x7a5230, map: texClone(texWood, 1, 2), bumpMap: texClone(texWood, 1, 2), bumpScale: 0.02, roughness: 0.72 });
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.025, 1.62, 7), staffM);
    staff.position.set(0.035, -0.26, 0.07); aR.elbow.add(staff);
    const crook = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.016, 6, 10, Math.PI * 1.2), staffM);
    crook.position.set(0.035, 0.55, 0.07); crook.rotation.set(0.4, 0, -1.2); aR.elbow.add(crook);
  }
  if (o.lantern) {
    const lantM = new THREE.MeshStandardMaterial({ color: 0x4a3826, map: texClone(texLeather, 1, 1), roughness: 0.6 });
    const lant = new THREE.Group(); lant.position.set(-0.115, 0.62 * ch, 0.12); torso.add(lant);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.11, 0.085), lantM); lant.add(box);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 7), new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0x000000 }));
    lant.add(core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc070, transparent: true, opacity: 0, depthWrite: false }));
    glow.scale.set(0.62, 0.62, 1); lant.add(glow);
    if (typeof lanternCoreMats !== 'undefined') lanternCoreMats.push(core.material);
    if (typeof lanternGlowMats !== 'undefined') lanternGlowMats.push(glow.material);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 5, 8), lantM);
    ring.position.y = 0.075; ring.rotation.x = 1.57; lant.add(ring);
  }

  addShadowBlob(g, 0.85);
  return {
    g, hips, torso, head, eyes, mouth, hairM, skinM, tunicM, cloakM: cloakM || tunicM,
    legL: L.lg, legR: R.lg, kneeL: L.knee, kneeR: R.knee,
    armL: aL.ag, armR: aR.ag, elbowL: aL.elbow, elbowR: aR.elbow,
    cloak, hood, animT: 0, idleT: rand(0, 6), blinkT: rand(1.2, 4), blink: 0, baseHipY: 0.93 * ch
  };
}

function poseHuman(rig, st, dt) {
  if (!rig) return;
  if (rig.isGLTF) return poseG(rig, st, dt);
  if (!rig.hips) return;
  dt = Math.min(dt || 0.016, 0.05);
  rig.idleT = (rig.idleT || 0) + dt;
  const p = rig.animT || 0;
  const it = rig.idleT;
  const bh = rig.baseHipY;
  rig.blinkT -= dt;
  if (rig.blinkT <= 0) { rig.blinkT = rand(1.8, 5.2); rig.blink = 0.15; }
  if (rig.blink > 0) rig.blink = Math.max(0, rig.blink - dt);
  if (rig.eyes) for (const e of rig.eyes) e.scale.y = rig.blink > 0 ? 0.12 : 1;

  if (st.mounted) {
    srot(rig.legL, 0.72, 0, 0.4, dt); srot(rig.legR, 0.72, 0, -0.4, dt);
    srot(rig.kneeL, 0.95, 0, 0, dt); srot(rig.kneeR, 0.95, 0, 0, dt);
    srot(rig.armL, 0.48, 0, 0.12, dt); srot(rig.armR, 0.48, 0, -0.12, dt);
    srot(rig.elbowL, -1.0, 0, 0, dt); srot(rig.elbowR, -1.0, 0, 0, dt);
    srot(rig.torso, 0.07, 0, 0, dt); srot(rig.head, -0.04, 0, 0, dt);
    rig.hips.position.y += (bh + 0.14 - rig.hips.position.y) * 0.18;
  } else if (st.swim) {
    const sc = Math.sin(p * 3.1);
    srot(rig.legL, 0.42 + sc * 0.18, 0, 0, dt); srot(rig.legR, 0.42 - sc * 0.18, 0, 0, dt);
    srot(rig.kneeL, 0.35, 0, 0, dt); srot(rig.kneeR, 0.35, 0, 0, dt);
    srot(rig.armL, sc * 1.5 - 0.45, 0, 0.3, dt); srot(rig.armR, -sc * 1.5 - 0.45, 0, -0.3, dt);
    srot(rig.elbowL, -0.45, 0, 0, dt); srot(rig.elbowR, -0.45, 0, 0, dt);
    srot(rig.torso, 0.42, 0, 0, dt); srot(rig.head, -0.32, 0, 0, dt);
    rig.hips.position.y += (bh - 0.08 - rig.hips.position.y) * 0.18;
  } else if (st.air) {
    srot(rig.legL, 0.55, 0, 0, dt); srot(rig.legR, 0.36, 0, 0, dt);
    srot(rig.kneeL, 0.85, 0, 0, dt); srot(rig.kneeR, 0.68, 0, 0, dt);
    srot(rig.armL, -0.85, 0, 0.35, dt); srot(rig.armR, -0.85, 0, -0.35, dt);
    srot(rig.elbowL, -0.5, 0, 0, dt); srot(rig.elbowR, -0.5, 0, 0, dt);
    srot(rig.torso, -0.05, 0, 0, dt); srot(rig.head, -0.06, 0, 0, dt);
    rig.hips.position.y += (bh + 0.05 - rig.hips.position.y) * 0.22;
  } else if (st.moving) {
    const run = st.run ? 1 : 0;
    const A = 0.52 + run * 0.56;
    const sw = Math.sin(p), sw2 = Math.sin(p + Math.PI);
    srot(rig.legL, sw * A, 0, 0, dt); srot(rig.legR, sw2 * A, 0, 0, dt);
    const kb = 0.7 + run * 0.6;
    srot(rig.kneeL, Math.max(0, Math.sin(p + 1.35)) * kb, 0, 0, dt);
    srot(rig.kneeR, Math.max(0, Math.sin(p + 1.35 + Math.PI)) * kb, 0, 0, dt);
    srot(rig.armL, -sw * A * 0.72, 0, 0.09 + run * 0.04, dt); srot(rig.armR, -sw2 * A * 0.72, 0, -0.09 - run * 0.04, dt);
    srot(rig.elbowL, -0.22 - Math.max(0, -sw) * (0.32 + run * 0.4), 0, 0, dt);
    srot(rig.elbowR, -0.22 - Math.max(0, -sw2) * (0.32 + run * 0.4), 0, 0, dt);
    srot(rig.torso, 0.055 + run * 0.19, -sw * (0.08 + run * 0.05), sw * 0.035, dt);
    srot(rig.head, -0.02 - run * 0.11, sw * 0.05 - sw * run * 0.03, 0, dt);
    const bob = Math.abs(Math.cos(p)) * (0.032 + run * 0.032);
    rig.hips.position.y += (bh + bob + (st.land || 0) * -0.12 - rig.hips.position.y) * (1 - Math.exp(-14 * dt));
    if (rig.g && typeof height === 'function') {
      const gx3 = rig.g.position.x, gz3 = rig.g.position.z;
      const hxA = height(gx3 + 0.7, gz3) - height(gx3 - 0.7, gz3);
      const hzA = height(gx3, gz3 + 0.7) - height(gx3, gz3 - 0.7);
      rig.hips.rotation.x += (clamp(hzA * 0.2, -0.15, 0.15) - rig.hips.rotation.x) * 0.06;
      rig.hips.rotation.z += (clamp(-hxA * 0.2, -0.15, 0.15) - rig.hips.rotation.z) * 0.06;
    }
  } else if (st.talk) {
    const g2 = Math.sin(it * 2.1), g3 = Math.sin(it * 1.55);
    srot(rig.armR, -0.32 + g2 * 0.26, 0, -0.13, dt);
    srot(rig.elbowR, -0.8 + g3 * 0.32, 0, 0, dt);
    srot(rig.armL, 0.05 + g3 * 0.09, 0, 0.11, dt);
    srot(rig.elbowL, -0.26, 0, 0, dt);
    srot(rig.head, Math.sin(it * 2.3) * 0.065, Math.sin(it * 0.62) * 0.14, 0, dt);
    srot(rig.torso, 0.02, Math.sin(it * 0.47) * 0.06, 0, dt);
    if (rig.mouth) rig.mouth.scale.y = 0.5 + Math.abs(Math.sin(it * 7.2)) * 0.75;
    rig.hips.position.y += (bh - rig.hips.position.y) * 0.14;
  } else {
    const br = Math.sin(it * 1.05);
    if (rig.torso) {
      const bs = 1 + br * 0.011;
      rig.torso.scale.set(bs, bs, bs);
    }
    srot(rig.legL, 0.02, 0, 0.015, dt); srot(rig.legR, 0.02, 0, -0.015, dt);
    srot(rig.kneeL, 0.05, 0, 0, dt); srot(rig.kneeR, 0.05, 0, 0, dt);
    srot(rig.armL, 0.05 + Math.sin(it * 0.55) * 0.06, 0, 0.115, dt);
    srot(rig.armR, 0.05 + Math.sin(it * 0.55 + 1.2) * 0.06, 0, -0.115, dt);
    srot(rig.elbowL, -0.2 + Math.sin(it * 0.4) * 0.05, 0, 0, dt);
    srot(rig.elbowR, -0.2 + Math.sin(it * 0.4 + 0.8) * 0.05, 0, 0, dt);
    srot(rig.torso, 0.015 + br * 0.014, Math.sin(it * 0.32) * 0.055, 0, dt);
    srot(rig.head, Math.sin(it * 0.23) * 0.055, Math.sin(it * 0.27) * 0.24, 0, dt, 6);
    if (rig.mouth) rig.mouth.scale.y += (0.42 - rig.mouth.scale.y) * 0.15;
    rig.hips.position.y += (bh + Math.sin(it * 0.8) * 0.012 - rig.hips.position.y) * 0.12;
    rig.hips.rotation.z += (Math.sin(it * 0.4) * 0.02 - rig.hips.rotation.z) * 0.1;
    if (st.land) {
      srot(rig.kneeL, 0.05 + st.land * 0.6, 0, 0, dt, 18); srot(rig.kneeR, 0.05 + st.land * 0.6, 0, 0, dt, 18);
      rig.hips.position.y -= st.land * 0.12;
    }
  }
  if (rig.cloak && typeof worldTime !== 'undefined') {
    rig.cloak.rotation.x = 0.05 + Math.sin(worldTime * 1.6) * 0.07 + (st.moving ? (st.run ? 0.22 : 0.12) : 0);
    rig.cloak.rotation.z = st.moving ? Math.sin(p) * 0.05 : Math.sin(worldTime * 0.9) * 0.03;
  }
}

function makeHero() {
  const rig = makeHumanoid({
    skin: SKINS[heroSkin] !== undefined ? SKINS[heroSkin] : 0xe8b88a,
    tunic: 0xe6dcc4, pants: 0x3c3a46, boots: 0x6a452c,
    hairColor: 0x4a2c16, hairStyle: 'messy',
    cloak: 0x3e8a5c, hoodUp: false,
    staff: true, lantern: true, satchel: true
  });
  scene.add(rig.g);
  rig.x = 0; rig.z = 195; rig.y = 3; rig.vy = 0;
  rig.yaw = 0; rig.speed = 0; rig.stamina = 100;
  rig.onGround = true; rig.swimming = false; rig.mounted = false;
  rig.animT = 0;
  return rig;
}
function applyHeroStyle() {
  if (!hero) return;
  if (hero.isGLTF) {
    const h = heroHue / 360;
    const tint = new THREE.Color().setHSL(h, 0.42, 0.52);
    hero.g.traverse(o => {
      if ((o.isMesh || o.isSkinnedMesh) && o.material && o.material.color && !o.userData.noTint) {
        if (!o.userData.baseCol) o.userData.baseCol = o.material.color.clone();
        o.material.color.copy(o.userData.baseCol).lerp(tint, 0.3);
      }
    });
    return;
  }
  const h = heroHue / 360;
  hero.cloakM.color.setHSL(h, 0.52, 0.4);
  hero.tunicM.color.setHSL(h, 0.22, 0.78);
  hero.skinM.color.set(SKINS[heroSkin]);
}

/* ---------------- cavalo ---------------- */
function buildHorseModel(body, mane) {
  const g = new THREE.Group();
  const bodyM = furify(new THREE.MeshStandardMaterial({ color: body, map: texClone(texFur, 3, 3), bumpMap: texClone(texFur, 3, 3), bumpScale: 0.035, roughness: 0.82 }), 0.18);
  const maneM = furify(new THREE.MeshStandardMaterial({ color: mane, map: texClone(texFur, 2, 4), bumpMap: texClone(texFur, 2, 4), bumpScale: 0.05, roughness: 0.72 }), 0.22);
  const darkM = new THREE.MeshStandardMaterial({ color: 0x2a2018 });
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), bodyM);
  torso.position.set(0, 1.62, 0); torso.scale.set(0.72, 0.8, 1.55); g.add(torso);
  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), bodyM);
  rump.position.set(0, 1.66, -1.02); g.add(rump);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), bodyM);
  chest.position.set(0, 1.58, 1.08); g.add(chest);
  const head = new THREE.Group(); head.position.set(0, 2.4, 1.0); g.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.46, 1.2, 8), bodyM);
  neck.position.set(0, 0.38, 0.3); neck.rotation.x = -0.62; head.add(neck);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.48, 0.9), bodyM);
  skull.position.set(0, 0.82, 0.72); skull.rotation.x = 0.3; head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.4), bodyM);
  muzzle.position.set(0, 0.62, 1.22); head.add(muzzle);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.28, 5), bodyM);
    ear.position.set(s * 0.17, 1.14, 0.38); head.add(ear);
    const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), new THREE.MeshStandardMaterial({ color: 0xe0d4c0, roughness: 0.25 }));
    eyeW.position.set(s * 0.225, 0.9, 0.58); head.add(eyeW);
    const eyeI = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 5), darkM);
    eyeI.position.set(s * 0.256, 0.9, 0.622); head.add(eyeI);
    const eyeS = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eyeS.position.set(s * 0.268, 0.935, 0.638); eyeS.userData.noShadow = true; head.add(eyeS);
  }
  const maneT = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.0, 0.5), maneM);
  maneT.position.set(0, 0.6, 0.12); maneT.rotation.x = -0.55; head.add(maneT);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 1.3, 6), maneM);
  tail.position.set(0, 1.32, -1.68); tail.rotation.x = -0.55; g.add(tail);
  const legs = [];
  for (const [lx, lz] of [[-0.36, 0.8], [0.36, 0.8], [-0.36, -0.8], [0.36, -0.8]]) {
    const hip = new THREE.Group(); hip.position.set(lx, 1.3, lz); g.add(hip);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.125, 0.62, 7), bodyM);
    upper.position.y = -0.3; hip.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.098, 0.7, 7), bodyM);
    lower.position.y = -0.9; hip.add(lower);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.128, 0.16, 7), darkM);
    hoof.position.y = -1.24; hip.add(hoof);
    legs.push(hip);
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
        hs.animT += dt * 7.2;
        for (let i = 0; i < hs.legs.length; i++) hs.legs[i].rotation.x = Math.sin(hs.animT + i * Math.PI / 2) * 0.58;
        hs.head.rotation.x = Math.sin(hs.animT * 2) * 0.06;
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

const NPC_STYLE = {
  moira:  { hairStyle: 'bun', hairColor: 0xb8b0a8, tunic: 0x8a5a44, dress: true, apron: 0xe8e0d0, shawl: 0x5a8a5c, skin: 0xe0b088 },
  bram:   { hairStyle: 'short', hairColor: 0x3a2818, beard: true, tunic: 0xa8601f, pants: 0x4a3c30, apron: 0x6a4a32, bulk: 1.12, skin: 0xc89868 },
  mira:   { hairStyle: 'long', hairColor: 0x6a3a1e, tunic: 0xc98a5e, dress: true, apron: 0xf0e8d8, skin: 0xecc098 },
  teo:    { hairStyle: 'straw', hairColor: 0x8a6a34, tunic: 0x7ab060, pants: 0x5a4a32, skin: 0xe0b088 },
  pip:    { hairStyle: 'cap', hairColor: 0x5a3a1c, tunic: 0x5aa0d8, pants: 0x3a5a80, child: true, capColor: 0xc85a3a, skin: 0xf0c8a0 },
  lyra:   { hairStyle: 'long', hairColor: 0x4a2a20, tunic: 0xa06ac0, dress: true, skin: 0xe8b890 },
  kael:   { hairStyle: 'short', hairColor: 0x2a1c12, beard: true, tunic: 0xb06030, pants: 0x4a3c30, bulk: 1.1, skin: 0xc89868 },
  silas:  { hairStyle: 'short', hairColor: 0x6a6a72, beard: true, tunic: 0x6a4a9a, pants: 0x3a2a52, skin: 0xe0b088 },
  wren:   { hairStyle: 'long', hairColor: 0x8a5a28, tunic: 0xc8a040, dress: true, apron: 0xe8e0c0, skin: 0xecc098 },
  breno:  { hairStyle: 'straw', hairColor: 0x4a3018, beard: true, tunic: 0x9a7a4a, pants: 0x5a4a32, skin: 0xd8a878 },
  nilo:   { hairStyle: 'straw', hairColor: 0x3a2a18, beard: true, tunic: 0x4a7aaa, pants: 0x3a4a5a, skin: 0xd8a878 },
  vesper: { hairStyle: 'hood', hairColor: 0xc8c8e8, tunic: 0x5a5aaa, pants: 0x3a3a6a, cloak: 0x4a4a9a, hoodUp: true, lantern: true, skin: 0xd8c8c8 },
  iara:   { hairStyle: 'long', hairColor: 0xd8d8e8, tunic: 0x2a9a90, dress: true, skin: 0xe8d0c0 },
  aldric: { hairStyle: 'short', hairColor: 0x3a3a42, tunic: 0x8a8fa0, pants: 0x5a5a70, armor: true, helmet: true, bulk: 1.12, skin: 0xd0a880 }
};
function buildNPCs() {
  for (const n of NPCS) {
    const st = NPC_STYLE[n.id] || {};
    const rig = makeHumanoid(Object.assign({ tunic: new THREE.Color(n.c2).getHex(), pants: new THREE.Color(n.c1).getHex() }, st));
    const g = rig.g;
    // nome flutuante
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 80;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(10,22,46,0.72)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(20, 10, 216, 56, 16) : ctx.rect(20, 10, 216, 56); ctx.fill();
    ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe6b3'; ctx.fillText(n.emoji + ' ' + n.name, 128, 40);
    const tex = new THREE.CanvasTexture(cv);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(3.4, 1.05, 1); spr.position.y = 3.55; spr.renderOrder = 5; g.add(spr);
    const nametagRef = spr;
    const h = height(n.x, n.z);
    g.position.set(n.x, h, n.z);
    scene.add(g);
    npcList.push(Object.assign({}, n, rig, { nametag: nametagRef, homeX: n.x, homeZ: n.z, animT: rand(0, 6), wanderT: rand(2, 8), lastTalk: 0, x: n.x, z: n.z }));
  }
  // moradores ambientes (sem diálogo) — trajes variados da vila
  for (let i = 0; i < 8; i++) {
    const ang = rand(0, 6.28), r = rand(18, 62);
    const x = VILLAGE.x + Math.cos(ang) * r, z = VILLAGE.z + Math.sin(ang) * r * 0.8;
    const female = Math.random() < 0.5;
    const rig = makeHumanoid({
      tunic: new THREE.Color().setHSL(rand(0, 1), 0.3, 0.5).getHex(),
      pants: new THREE.Color().setHSL(rand(0, 1), 0.22, 0.32).getHex(),
      dress: female, apron: Math.random() < 0.4 ? 0xe8e0d0 : null,
      hairStyle: female ? (Math.random() < 0.5 ? 'long' : 'bun') : (Math.random() < 0.5 ? 'short' : 'straw'),
      hairColor: new THREE.Color().setHSL(0.08, 0.35, rand(0.18, 0.42)).getHex(),
      skin: new THREE.Color().setHSL(0.08, 0.42, rand(0.58, 0.72)).getHex()
    });
    const g = rig.g;
    const h = height(x, z); g.position.set(x, h, z);
    scene.add(g);
    npcList.push(Object.assign({ ambient: true }, rig, { x, z, homeX: x, homeZ: z, yaw: rand(0, 6.28), animT: rand(0, 6), wanderT: rand(2, 8), speed: 0 }));
  }
}

/* ---------------- animais ---------------- */
function makeAnimal(kind, x, z) {
  const g = new THREE.Group();
  const col = { cervo: 0xb08858, coelho: 0xd8d0c8, pato: 0xf0d060, cisne: 0xffffff, cachorro: 0xc89858, galinha: 0xe8e0d0, cabra: 0xc8c0b8 }[kind] || 0xaaaaaa;
  const m = furify(new THREE.MeshStandardMaterial({ color: col, map: texClone(texDetail, 3, 3), bumpMap: texClone(texFur, 3, 3), bumpScale: 0.03, roughness: 0.84, metalness: 0.02 }), 0.17);
  const darkA = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.45 });
  const paleA = furify(new THREE.MeshStandardMaterial({ color: 0xd8c8a8, map: texClone(texDetail, 3, 3), bumpMap: texClone(texFur, 3, 3), bumpScale: 0.03, roughness: 0.86 }), 0.15);
  let scale = 1, bobAmp = 0.05;
  const eyePair = (hy, hz, ex, ez, r) => {
    for (const s of [-1, 1]) {
      const rr = r || 0.05;
      const white = new THREE.Mesh(new THREE.SphereGeometry(rr, 7, 6), new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.28 }));
      white.position.set(s * ex, hy, hz + ez); g.add(white);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(rr * 0.55, 5, 4), darkA);
      iris.position.set(s * (ex + rr * 0.38), hy, hz + ez + rr * 0.62); g.add(iris);
      const spark = new THREE.Mesh(new THREE.SphereGeometry(rr * 0.2, 4, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      spark.position.set(s * (ex + rr * 0.5), hy + rr * 0.35, hz + ez + rr * 0.8); spark.userData.noShadow = true; g.add(spark);
    }
  };
  if (kind === 'cervo') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), m); body.position.set(0, 1.18, -0.05); body.scale.set(0.78, 0.86, 1.5); g.add(body);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.5, 9, 7), m); chest.position.set(0, 1.12, 0.52); chest.scale.set(0.82, 0.95, 0.9); g.add(chest);
    const rump = new THREE.Mesh(new THREE.SphereGeometry(0.48, 9, 7), m); rump.position.set(0, 1.2, -0.62); rump.scale.set(0.86, 0.92, 0.85); g.add(rump);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), paleA); belly.position.set(0, 0.92, -0.05); belly.scale.set(0.72, 0.5, 1.35); g.add(belly);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.72, 8), m); neck.position.set(0, 1.62, 0.62); neck.rotation.x = -0.72; g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 9, 7), m); head.position.set(0, 1.88, 0.98); head.scale.set(0.82, 0.9, 1.1); g.add(head);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.3, 7), m); snout.position.set(0, 1.8, 1.22); snout.rotation.x = 1.35; g.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), darkA); nose.position.set(0, 1.82, 1.36); g.add(nose);
    eyePair(1.96, 1.06, 0.15, 0, 0.045);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 6), m); ear.position.set(s * 0.2, 2.12, 0.86); ear.rotation.z = s * 0.85; g.add(ear);
    }
    const antM = new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.7 });
    for (const s of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.62, 6), antM);
      beam.position.set(s * 0.13, 2.32, 0.88); beam.rotation.z = s * 0.42; beam.rotation.x = -0.25; g.add(beam);
      for (let k = 0; k < 2; k++) {
        const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, 0.3, 5), antM);
        tine.position.set(s * (0.2 + k * 0.08), 2.42 + k * 0.18, 0.82 + k * 0.1); tine.rotation.z = s * (0.9 + k * 0.25); g.add(tine);
      }
    }
    for (const [lx, lz, lean] of [[-0.17, 0.52, 0.06], [0.17, 0.52, -0.06], [-0.17, -0.58, -0.05], [0.17, -0.58, 0.05]]) {
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.5, 6), m); up.position.set(lx, 0.82, lz); up.rotation.x = lean; g.add(up);
      const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.48, 6), m); lo.position.set(lx, 0.32, lz + lean * 0.4); g.add(lo);
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.07, 0.12, 6), darkA); hoof.position.set(lx, 0.06, lz + lean * 0.4); g.add(hoof);
    }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), m); tail.position.set(0, 1.32, -1.06); tail.scale.set(0.7, 1, 1.4); g.add(tail);
  } else if (kind === 'coelho') {
    scale = 0.55;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 9, 7), m); body.position.set(0, 0.48, -0.06); body.scale.set(0.92, 0.9, 1.18); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), m); head.position.set(0, 0.8, 0.5); g.add(head);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 5), paleA); muzzle.position.set(0, 0.7, 0.72); g.add(muzzle);
    const noseR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 4), new THREE.MeshStandardMaterial({ color: 0xc08080 })); noseR.position.set(0, 0.76, 0.86); g.add(noseR);
    for (const ex of [-0.14, 0.14]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 6), m); ear.position.set(ex, 1.22, 0.4); ear.scale.set(0.55, 2.4, 0.32); ear.rotation.x = -0.12; ear.rotation.z = ex * 1.1; g.add(ear);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), new THREE.MeshStandardMaterial({ color: 0xd8a0a0 })); inner.position.set(ex, 1.22, 0.44); inner.scale.set(0.5, 2.2, 0.22); inner.rotation.z = ex * 1.1; g.add(inner);
    }
    eyePair(0.88, 0.62, 0.17, 0, 0.055);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), paleA); puff.position.set(0, 0.5, -0.72); g.add(puff);
    bobAmp = 0.12;
  } else if (kind === 'pato' || kind === 'galinha') {
    scale = 0.62;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 9, 7), m); body.position.set(0, 0.52, -0.04); body.scale.set(0.95, 0.88, 1.15); g.add(body);
    const breast = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), kind === 'pato' ? paleA : m); breast.position.set(0, 0.55, 0.34); g.add(breast);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), m); head.position.set(0, 1.02, 0.42); g.add(head);
    const beak = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xe88a2a, roughness: 0.55 }));
    beak.position.set(0, 0.98, 0.72); beak.rotation.x = 1.57; g.add(beak);
    eyePair(1.1, 0.52, 0.16, 0, 0.04);
    if (kind === 'galinha') {
      const comb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.22), new THREE.MeshStandardMaterial({ color: 0xc03a2a })); comb.position.set(0, 1.3, 0.38); g.add(comb);
      for (let k = -1; k <= 1; k++) {
        const fe = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 5), m); fe.position.set(0, 0.82 + k * 0.1, -0.62); fe.rotation.x = -1.15 - k * 0.28; g.add(fe);
      }
    } else {
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 5), m); tail.position.set(0, 0.72, -0.58); tail.scale.set(0.8, 0.55, 1.15); tail.rotation.x = -0.55; g.add(tail);
    }
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.3, 7, 6), m); wing.position.set(s * 0.42, 0.58, -0.04); wing.scale.set(0.38, 0.75, 1.15); g.add(wing);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.3, 5), new THREE.MeshStandardMaterial({ color: 0xc8862e })); leg.position.set(s * 0.16, 0.15, 0.02); g.add(leg);
    }
  } else if (kind === 'cisne') {
    scale = 0.85;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), m); body.position.set(0, 0.46, -0.08); body.scale.set(0.95, 0.72, 1.35); g.add(body);
    const wingL = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), m); wingL.position.set(-0.3, 0.62, -0.1); wingL.scale.set(0.55, 0.5, 1.3); g.add(wingL);
    const wingR = wingL.clone(); wingR.position.x = 0.3; g.add(wingR);
    const n1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.62, 7), m); n1.position.set(0, 1.02, 0.3); n1.rotation.x = -0.55; g.add(n1);
    const n2 = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.6, 7), m); n2.position.set(0, 1.42, 0.5); n2.rotation.x = -0.12; g.add(n2);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), m); head.position.set(0, 1.74, 0.58); g.add(head);
    const beak = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.085, 0.26, 6), new THREE.MeshStandardMaterial({ color: 0xe88a2a, roughness: 0.5 })); beak.position.set(0, 1.7, 0.8); beak.rotation.x = 1.5; g.add(beak);
    eyePair(1.8, 0.62, 0.11, 0, 0.035);
  } else if (kind === 'cachorro') {
    scale = 0.72;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 9, 7), m); body.position.set(0, 0.78, -0.02); body.scale.set(0.72, 0.72, 1.35); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), m); head.position.set(0, 1.12, 0.68); g.add(head);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.34, 7), m); snout.position.set(0, 1.02, 0.98); snout.rotation.x = 1.45; g.add(snout);
    const noseD = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), darkA); noseD.position.set(0, 1.06, 1.16); g.add(noseD);
    eyePair(1.2, 0.78, 0.15, 0, 0.05);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), m); ear.position.set(s * 0.24, 1.22, 0.58); ear.scale.set(0.42, 1.35, 0.62); ear.rotation.z = s * 0.5; g.add(ear);
    }
    for (const [lx, lz] of [[-0.16, 0.38], [0.16, 0.38], [-0.16, -0.38], [0.16, -0.38]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.62, 6), m); leg.position.set(lx, 0.32, lz); g.add(leg);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), m); paw.position.set(lx, 0.06, lz + 0.04); paw.scale.set(1, 0.6, 1.3); g.add(paw);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 0.55, 6), m); tail.position.set(0, 1.06, -0.78); tail.rotation.x = -0.85; g.add(tail);
    bobAmp = 0.09;
  } else if (kind === 'cabra') {
    scale = 0.82;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 9, 7), m); body.position.set(0, 0.98, -0.02); body.scale.set(0.75, 0.78, 1.3); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), m); head.position.set(0, 1.42, 0.72); head.scale.set(0.85, 0.95, 1.15); g.add(head);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.3, 6), m); snout.position.set(0, 1.32, 0.98); snout.rotation.x = 1.4; g.add(snout);
    eyePair(1.5, 0.8, 0.15, 0, 0.05);
    const hornM = new THREE.MeshStandardMaterial({ color: 0x7a6a52, roughness: 0.62 });
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, 0.42, 6), hornM);
      horn.position.set(s * 0.12, 1.72, 0.62); horn.rotation.x = -0.6; horn.rotation.z = s * 0.35; g.add(horn);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), m); ear.position.set(s * 0.26, 1.48, 0.6); ear.scale.set(1.25, 0.5, 0.55); ear.rotation.z = s * 0.45; g.add(ear);
    }
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), m); beard.position.set(0, 1.12, 0.86); beard.rotation.x = 0.35; g.add(beard);
    for (const [lx, lz] of [[-0.17, 0.42], [0.17, 0.42], [-0.17, -0.42], [0.17, -0.42]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.095, 0.82, 6), m); leg.position.set(lx, 0.42, lz); g.add(leg);
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.14, 6), darkA); hoof.position.set(lx, 0.07, lz); g.add(hoof);
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
  if (an.isGLTF && an.mixer) an.mixer.update(dt);
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
  const birdM = new THREE.MeshStandardMaterial({ color: 0x3a3a4a });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const wl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), birdM); wl.position.x = -0.85; g.add(wl);
    const wr = wl.clone(); wr.position.x = 0.85; g.add(wr);
    g.position.set(rand(-300, 300), rand(45, 85), rand(-300, 300));
    scene.add(g);
    birds.push({ g, wl, wr, cx: g.position.x, cz: g.position.z, r: rand(40, 120), a: rand(0, 6.28), spd: rand(0.12, 0.25), y: g.position.y });
  }
  // borboletas
  const bfM = new THREE.MeshStandardMaterial({ color: 0xffe08a });
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
      if (camera) g.visible = g.position.distanceTo(camera.position) > 3.2;
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
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 7), new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.25 }));
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
function showToast(msg) {
  try {
    const d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;left:50%;top:calc(86px + env(safe-area-inset-top));transform:translateX(-50%);background:rgba(12,24,48,.9);border:1px solid rgba(255,220,160,.45);color:#ffe6b3;padding:10px 18px;border-radius:13px;font-size:13px;z-index:60;box-shadow:0 10px 30px rgba(0,0,0,.45);transition:opacity .5s;opacity:0;pointer-events:none';
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.opacity = '1'; });
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => { try { d.remove(); } catch (e) {} }, 600); }, 2700);
  } catch (e) {}
}
const ACHV = {};
try {
  const _av = (typeof localStorage !== 'undefined') ? localStorage.getItem('andora3d_achv') : null;
  if (_av) Object.assign(ACHV, JSON.parse(_av));
} catch (e) {}
function unlock(id, title) {
  if (ACHV[id]) return;
  ACHV[id] = 1;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('andora3d_achv', JSON.stringify(ACHV)); } catch (e) {}
  showToast('🏆 Conquista desbloqueada: ' + title);
  if (navigator.vibrate) { try { navigator.vibrate([16, 40, 16]); } catch (e) {} }
  ambClick();
}
function tryFishing() {
  if (!hero || hero.mounted || hero.fishingT) return false;
  const d = distTo(hero.x, hero.z, LAKE.x, LAKE.z);
  if (d > LAKE.r + 45) return false;
  hero.fishingT = 2.3 + Math.random() * 1.7;
  showToast('🎣 Linha na água... aguarde o peixe morder!');
  return true;
}
function doInteract() {
  if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
  if (tryFishing()) return;
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

/* ---------------- cutscene cinematográfica (vídeo em tempo real) ---------------- */
let cutActive = false;
const cutFrom = new THREE.Vector3(), cutTo = new THREE.Vector3(), cutLookA = new THREE.Vector3(), cutLookB = new THREE.Vector3(), _cutLook = new THREE.Vector3();
const CS = {
  idx: 0, a: 0, b: 0, c: 0, after: null, t0: 0, imgTimer: null, prevHour: 9,
  nodes: [
    {
      img: 'f1', clip: 'cut-0.mp4', hour: 8, who: 'Narrador',
      text: 'Depois de muitos dias de caminho, você cruza a última colina — e o Vale de Andora se abre sob o sol. Dizem que, ao anoitecer, lanternas de luz dançam sobre o lago... e que o vale escolhe quem pode vê-las.',
      opts: [['Caminhar em silêncio, admirando o vale.', 'a'], ['Perguntar a um transeunte sobre as lanternas.', 'b'], ['Compartilhar pão com quem encontrar no caminho.', 'c']],
      shot: {
        from: [34, 18, 240], to: [12, 10, 216], look: [0, 7, 150], lookTo: [0, 5, 162], fov: 52, dur: 14.1333,
        hero: { x: 3, z: 216, toX: 3, toZ: 200, yaw: Math.PI, walk: true }
      }
    },
    {
      img: 'f2', clip: 'cut-1.mp4', hour: 10, who: 'Voz do vento',
      text: 'A ponte de madeira range sob seus pés. Em algum lugar, um sino toca uma vez. Você percebe que não está andando sozinho — algo brilha entre as árvores, sempre a alguns passos de distância.',
      opts: [['Seguir a luz com calma.', 'a'], ['Observar de longe, tentando entender.', 'b'], ['Deixar um pedaço de fruta como oferenda.', 'c']],
      shot: {
        from: [130, 10, -12], to: [165, 6, -26], look: [215, 3, -22], lookTo: [208, 3, -26], fov: 46, dur: 13.1333,
        hero: { x: 172, z: -30, toX: 192, toZ: -24, yaw: 1.28, walk: true }
      }
    },
    {
      img: 'f3', clip: 'cut-2.mp4', hour: 12, who: 'Moira 🧶',
      text: 'Na vila, Moira sorri ao te ver chegar. "Então é você quem todos esperavam! Sente-se. O vale não tem pressa — e quem tem pressa nunca vê as lanternas."',
      opts: [['Sentar e ouvir suas histórias.', 'a'], ['Perguntar sobre Vesper, a guardiã do lago.', 'b'], ['Ajudar a cortar a torta recém-saída do forno.', 'c']],
      shot: {
        from: [26, 9, 152], to: [-12, 7, 150], look: [4, 3, 124], lookTo: [2, 3, 122], fov: 46, dur: 10.6,
        hero: { x: 6, z: 131, yaw: 2.94, walk: false }
      }
    },
    {
      img: 'f4', clip: 'cut-3.mp4', hour: 18.35, who: 'Vesper 🌙',
      text: 'À beira do lago, Vesper acende uma lanterna sem cera. "As lanternas de Andora são memórias felizes feitas luz. O vale te escolheu para cuidar delas... ou para descansar entre elas. Você decide."',
      opts: [['Cuidar das lanternas, sem pressa.', 'a'], ['Descobrir os segredos das luzes.', 'b'], ['Cuidar das pessoas primeiro, sempre.', 'c']],
      shot: {
        from: [-92, 6, -8], to: [-100, 4, -14], look: [-180, 2, -120], lookTo: [-215, 1, -165], fov: 44, dur: 13.4667,
        hero: { x: -106, z: -23, yaw: -2.51, walk: false }
      }
    },
    { finale: true, clip: 'cut-4.mp4', hour: 20.4, who: 'Fim da introdução',
      shot: {
        from: [-96, 3.2, -14], to: [-100, 2.9, -17], look: [-106, 2.2, -23], lookTo: [-106, 2.3, -23], fov: 42, dur: 11.5333,
        hero: { x: -106, z: -23, yaw: 0.79, walk: false }
      }
    }
  ]
};
/* ---------------- captura deterministica do filme da cutscene ---------------- */
window.__capFilm = {
  prep(i, dur) {
    window.__andoraCapture = true;
    const n = CS.nodes[i];
    CS.idx = i;
    n.shot.dur = dur;
    CS.t0 = 0;
    if (n.hour !== undefined) hour = n.hour;
    const sh = n.shot;
    cutFrom.fromArray(sh.from); cutTo.fromArray(sh.to);
    cutLookA.fromArray(sh.look); cutLookB.fromArray(sh.lookTo);
    camera.position.copy(cutFrom);
    camera.fov = sh.fov; camera.updateProjectionMatrix();
    camera.lookAt(cutLookA);
    placeCutHero(sh);
    if (hero) {
      for (let k = 0; k < 26; k++) {
        hero.animT = (k / 15) * 5.4;
        poseHuman(hero, { moving: !!(sh.hero && sh.hero.walk) }, 1 / 15);
      }
    }
    updateSky();
    if (renderer.shadowMap) { renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true; }
    document.querySelectorAll('body > *').forEach(el => {
      if (el.tagName === 'CANVAS' || el.tagName === 'SCRIPT') return;
      el.style.display = 'none';
    });
  },
  seek(t) {
    worldTime = t;
    if (hero) hero.animT = t * 5.4;
    cutCamTick(1 / 15);
    windU.value = worldTime;
    if (hero && hero.cloak) hero.cloak.rotation.x = 0.05 + Math.sin(worldTime * 1.6) * 0.07;
    // mesmo reflexo espelhado do animate (necessario nas cenas com agua)
    if (reflRT && reflCam && camera && water && renderer.setRenderTarget) {
      const nearLake = hero ? distTo(hero.x, hero.z, LAKE.x, LAKE.z) < LAKE.r + 170 : false;
      if (nearLake && qualityLevel >= 1) {
        reflCam.position.copy(camera.position);
        reflCam.position.y = 2 * WATER_Y - camera.position.y;
        camera.getWorldDirection(_reflDir);
        _reflLook.copy(camera.position).add(_reflDir);
        _reflLook.y = 2 * WATER_Y - _reflLook.y;
        reflCam.up.set(0, 1, 0);
        reflCam.lookAt(_reflLook);
        reflCam.fov = camera.fov; reflCam.aspect = camera.aspect;
        reflCam.updateProjectionMatrix();
        reflCam.updateMatrixWorld(true);
        reflCam.matrixWorldInverse.copy(reflCam.matrixWorld).invert();
        _reflTexMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
        _reflTexMat.multiply(reflCam.projectionMatrix);
        _reflTexMat.multiply(reflCam.matrixWorldInverse);
        water.material.uniforms.uTexMat.value.copy(_reflTexMat);
        water.material.uniforms.uReflOn.value = 1;
        water.visible = false;
        const shd = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
        renderer.setRenderTarget(reflRT);
        renderer.render(scene, reflCam);
        renderer.setRenderTarget(null);
        renderer.shadowMap.enabled = shd;
        water.visible = true;
      } else {
        water.material.uniforms.uReflOn.value = 0;
      }
    }
    updateSky();
    for (const fn of animatables) fn(t, 1 / 15);
    for (const b of birds) {
      b.a += b.spd / 15;
      b.g.position.set(b.cx + Math.cos(b.a) * b.r, b.y + Math.sin(b.a * 2) * 3, b.cz + Math.sin(b.a) * b.r);
      b.g.rotation.y = -b.a + Math.PI / 2;
      const flap = Math.sin(t * 7 + b.a * 3) * 0.7;
      b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
    }
    for (const c of clouds) {
      c.position.x += 1.6 / 15;
      if (c.position.x > 420) c.position.x = -420;
    }
    for (const n of npcList) { n.animT += 1 / 15; if (!n.ambient) n.g.rotation.y = Math.sin(n.animT * 0.4) * 0.3; }
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }
};

/* ---------------- ambiencia procedural (Web Audio): vento, passaros, agua, grilos ---------------- */
const Amb = { ctx: null, on: false, master: null, windGain: null, waterGain: null, birdT: 2, cricketT: 1 };
function ambInit() {
  if (Amb.ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    Amb.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    Amb.master = master;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const ws = ctx.createBufferSource(); ws.buffer = buf; ws.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 420;
    const wg = ctx.createGain(); wg.gain.value = 0.1;
    ws.connect(wf); wf.connect(wg); wg.connect(master); ws.start();
    Amb.windGain = wg;
    const as2 = ctx.createBufferSource(); as2.buffer = buf; as2.loop = true;
    const af = ctx.createBiquadFilter(); af.type = 'bandpass'; af.frequency.value = 900; af.Q.value = 0.7;
    const ag = ctx.createGain(); ag.gain.value = 0;
    as2.connect(af); af.connect(ag); ag.connect(master); as2.start();
    Amb.waterGain = ag;
    master.gain.setTargetAtTime(0.32, ctx.currentTime, 1.4);
    Amb.on = true;
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {}
}
function ambChirp() {
  const ctx = Amb.ctx; if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    const g = ctx.createGain();
    const f0 = 2200 + Math.random() * 1800;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * (1.2 + Math.random() * 0.5), t + 0.06);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.85, t + 0.13);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045 + Math.random() * 0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    o.connect(g); g.connect(Amb.master);
    o.start(t); o.stop(t + 0.22);
    if (Math.random() < 0.45) setTimeout(ambChirp, 150 + Math.random() * 130);
  } catch (e) {}
}
function ambCricket() {
  const ctx = Amb.ctx; if (!ctx) return;
  try {
    const t = ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 4200 + Math.random() * 600;
      const g = ctx.createGain();
      const t0 = t + k * 0.07;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.018, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
      o.connect(g); g.connect(Amb.master); o.start(t0); o.stop(t0 + 0.06);
    }
  } catch (e) {}
}
function ambTick(dt) {
  if (!Amb.on || !Amb.ctx) return;
  const night = hour >= 19.4 || hour < 5.6;
  if (Amb.windGain) {
    const target = 0.09 + 0.06 * (0.5 + 0.5 * Math.sin(worldTime * 0.13));
    Amb.windGain.gain.value += (target - Amb.windGain.gain.value) * Math.min(1, dt * 1.5);
  }
  if (Amb.waterGain && hero) {
    const dx = hero.x + 200, dz = hero.z + 150;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const near = Math.max(0, Math.min(1, 1 - (dist - 70) / 120));
    Amb.waterGain.gain.value += (near * 0.13 - Amb.waterGain.gain.value) * Math.min(1, dt * 2);
  }
  if (!Amb.rainGain) {
    try {
      const buf = Amb.ctx.createBuffer(1, Math.floor(Amb.ctx.sampleRate * 2), Amb.ctx.sampleRate);
      const dd = buf.getChannelData(0);
      for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
      const src2 = Amb.ctx.createBufferSource(); src2.buffer = buf; src2.loop = true;
      const hp2 = Amb.ctx.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 520;
      const lp2 = Amb.ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 2600;
      Amb.rainGain = Amb.ctx.createGain(); Amb.rainGain.gain.value = 0;
      src2.connect(hp2); hp2.connect(lp2); lp2.connect(Amb.rainGain); Amb.rainGain.connect(Amb.master);
      src2.start();
    } catch (e) { Amb.rainGain = null; }
  }
  Amb.birdT -= dt;
  if (!night && Amb.birdT <= 0) { Amb.birdT = 1.6 + Math.random() * 4.2; ambChirp(); }
  Amb.cricketT -= dt;
  if (night && Amb.cricketT <= 0) { Amb.cricketT = 0.9 + Math.random() * 1.6; ambCricket(); }
  const tg = cutActive ? 0.15 : 0.32;
  Amb.master.gain.value += (tg - Amb.master.gain.value) * Math.min(1, dt * 2);
}
document.addEventListener('pointerdown', ambInit, { once: true });
document.addEventListener('keydown', ambInit, { once: true });
function ambStep(stone) {
  if (!Amb.ctx || !Amb.on) return;
  try {
    const t = Amb.ctx.currentTime, len = 0.09;
    const buf = Amb.ctx.createBuffer(1, Math.floor(Amb.ctx.sampleRate * len), Amb.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const o = Amb.ctx.createBufferSource(); o.buffer = buf;
    const f = Amb.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = stone ? 1350 + Math.random() * 550 : 640 + Math.random() * 320; f.Q.value = 1.15;
    const g = Amb.ctx.createGain();
    g.gain.value = (stone ? 0.15 : 0.1) * (0.7 + Math.random() * 0.5);
    o.connect(f); f.connect(g); g.connect(Amb.master);
    o.start(t); o.stop(t + len);
  } catch (e) {}
}
function ambClick() {
  if (!Amb.ctx || !Amb.on) return;
  try {
    const t = Amb.ctx.currentTime;
    const o = Amb.ctx.createOscillator(); o.type = 'triangle';
    o.frequency.value = 620 + Math.random() * 60;
    const g = Amb.ctx.createGain();
    g.gain.setValueAtTime(0.045, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g); g.connect(Amb.master); o.start(t); o.stop(t + 0.09);
  } catch (e) {}
}
document.addEventListener('click', (e) => { if (e && e.target && e.target.tagName === 'BUTTON') ambClick(); });
// keep-alive: mantem o servidor acordado enquanto o jogo esta aberto (a cada 2 min)
if (typeof setInterval === 'function' && typeof fetch === 'function') {
  const kaTimer = setInterval(() => {
    try { fetch('https://andora-75sw.onrender.com/', { mode: 'no-cors', cache: 'no-store' }); } catch (e) {}
    try { fetch(location.href, { cache: 'no-store' }); } catch (e) {}
  }, 120000);
  if (kaTimer && kaTimer.unref) kaTimer.unref();
}

function placeCutHero(sh) {
  if (!hero || !sh || !sh.hero) return;
  const h = sh.hero;
  hero.swimming = false; hero.mounted = false;
  hero.x = h.x; hero.z = h.z;
  hero.yaw = h.yaw;
  hero.g.position.set(h.x, height(h.x, h.z), h.z);
  hero.g.rotation.set(0, h.yaw, 0);
}
function cutCamTick(dt) {
  dt = Math.min(dt, 0.05);
  // fade + ken burns por relógio real (CSS transitions podem travar; dt varia com FPS)
  const nowMs = performance.now();
  if (CS.fadeDir) {
    CS.fadeT = clamp((CS.fadeDir > 0 ? (nowMs - CS.fadeT0) : 1150 - (nowMs - CS.fadeT0)) / 1150, 0, 1);
    const w0 = $('csImgWrap'); if (w0) w0.style.opacity = String(CS.fadeT);
    if ((CS.fadeDir > 0 && CS.fadeT >= 1) || (CS.fadeDir < 0 && CS.fadeT <= 0)) CS.fadeDir = 0;
  }
  const cim = $('csImg');
  if (cim) {
    const kenP = clamp((nowMs - (CS.kenT0 || nowMs)) / 15000, 0, 1);
    cim.style.transform = 'scale(' + (1.02 + 0.10 * kenP) + ')';
  }
  const n = CS.nodes[CS.idx];
  const sh = n && n.shot;
  if (!sh) return;
  const u = clamp((worldTime - CS.t0) / sh.dur, 0, 1);
  const e = u * u * (3 - 2 * u);
  camera.position.lerpVectors(cutFrom, cutTo, e);
  if (Math.abs(camera.fov - sh.fov) > 0.05) {
    camera.fov += (sh.fov - camera.fov) * Math.min(1, dt * 2.2);
    camera.updateProjectionMatrix();
  }
  _cutLook.lerpVectors(cutLookA, cutLookB, e);
  camera.lookAt(_cutLook);
  const hh = sh.hero;
  if (hh && hero) {
    const hu = clamp((worldTime - CS.t0) / sh.dur, 0, 1);
    if (hh.walk && hh.toX !== undefined) {
      hero.x = lerp(hh.x, hh.toX, hu);
      hero.z = lerp(hh.z, hh.toZ, hu);
    }
    hero.g.position.set(hero.x, height(hero.x, hero.z), hero.z);
    hero.g.rotation.set(0, hh.yaw, 0);
    hero.yaw = hh.yaw;
    if (hh.walk) hero.animT += dt * 5.4;
    poseHuman(hero, { moving: !!hh.walk, run: false }, dt);
  }
}
function playCutscene(after) {
  CS.idx = 0; CS.a = CS.b = CS.c = 0; CS.after = after || null;
  CS.prevHour = hour;
  cutActive = true;
  $('menu').classList.add('hidden');
  $('cutscene').classList.remove('hidden');
  const mm = $('minimapWrap'); if (mm) mm.classList.add('hidden');
  const hd = $('hud'); if (hd) hd.classList.add('hidden');
  showCSNode();
}
function endCutscene() {
  cutActive = false;
  if (CS.imgTimer) { clearTimeout(CS.imgTimer); CS.imgTimer = null; }
  const wrap = $('csImgWrap'); if (wrap) { wrap.classList.remove('show'); wrap.style.opacity = '0'; }
  CS.fadeDir = 0; CS.fadeT = 0;
  $('cutscene').classList.add('hidden');
  if (gameStarted) {
    const mm = $('minimapWrap'); if (mm) mm.classList.remove('hidden');
    const hd = $('hud'); if (hd) hd.classList.remove('hidden');
  }
  store.set('andora3d_intro_v1', 1);
  if (gameStarted) hour = CS.prevHour;
  camera.fov = IS_TOUCH ? 70 : 62; camera.updateProjectionMatrix();
  const fn = CS.after; CS.after = null;
  if (fn) fn();
  else if (!gameStarted) $('menu').classList.remove('hidden');
}
function showCSNode() {
  const n = CS.nodes[CS.idx];
  if (!n) { endCutscene(); return; }
  // direção de câmera do plano atual
  const sh = n.shot;
  if (sh) {
    CS.t0 = worldTime;
    cutFrom.fromArray(sh.from); cutTo.fromArray(sh.to);
    cutLookA.fromArray(sh.look); cutLookB.fromArray(sh.lookTo);
    camera.position.copy(cutFrom);
    camera.fov = sh.fov; camera.updateProjectionMatrix();
    camera.lookAt(cutLookA);
    hour = n.hour !== undefined ? n.hour : hour;
    placeCutHero(sh);
  }
  // quadro pintado em transição (Ken Burns) e depois a cena viva
  const wrap = $('csImgWrap'), img = $('csImg'), vid = $('csVid');
  if (CS.imgTimer) { clearTimeout(CS.imgTimer); CS.imgTimer = null; }
  if (vid) { try { vid.onended = null; vid.pause(); } catch (e) {} }
  if (n.img && ASSETS[n.img] && img) img.src = ASSETS[n.img];
  if (wrap && (n.clip || (n.img && ASSETS[n.img]))) {
    try { wrap.getAnimations().forEach(a => a.cancel()); if (img) img.getAnimations().forEach(a => a.cancel()); } catch (e) {}
    wrap.classList.add('show');
    wrap.style.opacity = '0';
    CS.fadeT = 0; CS.fadeDir = 1; CS.fadeT0 = performance.now();
    CS.kenT0 = performance.now();
    if (img) img.style.transform = 'scale(1.02)';
    const fadeOff = () => { CS.fadeDir = -1; CS.fadeT0 = performance.now(); wrap.classList.remove('show'); CS.imgTimer = null; };
    if (vid && n.clip) {
      vid.style.display = 'block';
      vid.src = n.clip;
      try { vid.currentTime = 0; } catch (e) {}
      vid.onended = fadeOff;
      const pr = vid.play ? vid.play() : null;
      if (pr && pr.catch) pr.catch(() => {
        // autoplay bloqueado ou codec indisponível: usa o quadro pintado
        vid.style.display = 'none';
        if (!n.img || !ASSETS[n.img]) fadeOff();
        else CS.imgTimer = setTimeout(fadeOff, 3800);
      });
    } else if (vid) {
      vid.style.display = 'none';
      CS.imgTimer = setTimeout(fadeOff, 3800);
    } else {
      CS.imgTimer = setTimeout(fadeOff, 3800);
    }
  } else if (wrap) {
    wrap.classList.remove('show');
    wrap.style.opacity = '0';
    CS.fadeDir = 0; CS.fadeT = 0;
    if (vid) { try { vid.pause(); vid.style.display = 'none'; } catch (e) {} }
  }
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
  let speed = 5.8;
  const wantRun = input.run || keys['ShiftLeft'] || keys['ShiftRight'];
  if (wantRun && hero.stamina > 1 && moving) { speed = 11; hero.stamina = clamp(hero.stamina - 24 * dt, 0, 100); }
  else hero.stamina = clamp(hero.stamina + 15 * dt, 0, 100);
  if (hero.swimming) speed = 3.4;
  if (hero.mounted) {
    speed = 18;
    const hs = hero.mountedHorse;
    if (hs && (hs.hunger < 15 || hs.thirst < 15)) speed = 12;
    if (wantRun && hero.stamina > 1) { speed = 26; hero.stamina = clamp(hero.stamina - 16 * dt, 0, 100); }
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
    const fixed = collideCircle(hero.x, hero.z, 0.9);
    hero.x = fixed.x; hero.z = fixed.z;
    hero.yaw = lerp(hero.yaw, Math.atan2(wx, wz), 1 - Math.exp(-10 * dt));
    hero.speed = speed;
    hero.animT += dt * speed * (hero.mounted ? 0.5 : hero.swimming ? 1.1 : 1.75);
    if (!hero.swimming && !hero.mounted && speed > 1.5 && hero.onGround) {
      hero.stepT = (hero.stepT || 0) + dt * speed * 1.05;
      hero.walkDist = (hero.walkDist || 0) + speed * dt;
      if (hero.walkDist > 1000) unlock('caminhante', '1 km pelo Vale de Andora');
      if (hour >= 21 && hour < 22.4 && distTo(hero.x, hero.z, LAKE.x, LAKE.z) < LAKE.r + 70) unlock('lanternas', 'As Lanternas do Lago');
      if (hero.stepT > Math.PI) {
        hero.stepT -= Math.PI;
        ambStep(roadFactor(hero.x, hero.z) > 0.3);
      }
    }

  } else {
    hero.speed = 0;
    hero.animT += dt * 1.6;
  }
  // gravidade / chão / água
  const gh = height(hero.x, hero.z);
  hero.swimming = gh < WATER_Y - 1.2 && hero.y < WATER_Y + 0.6 && distTo(hero.x, hero.z, LAKE.x, LAKE.z) < LAKE.r + 130;
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
  // animação completa do rig (andar/correr/nadar/pular/montado + aterrissagem)
  if (!hero.mounted && hero.swimming) hero.g.rotation.x = lerp(hero.g.rotation.x, 0.28, dt * 6);
  else hero.g.rotation.x = lerp(hero.g.rotation.x, 0, dt * 8);
  const air = !hero.onGround && !hero.swimming && !hero.mounted;
  if (hero.landT === undefined) hero.landT = 0;
  if (hero.onGround && hero._wasAir) hero.landT = 0.22;
  hero._wasAir = air;
  if (hero.landT > 0) hero.landT = Math.max(0, hero.landT - dt);
  poseHuman(hero, {
    moving: moving, run: speed > 10 && !hero.mounted,
    swim: hero.swimming, mounted: !!hero.mounted, air: air, land: hero.landT
  }, dt);
  // cavalo montado segue o herói
  if (hero.mounted && hero.mountedHorse) {
    const hs = hero.mountedHorse;
    hs.x = hero.x; hs.z = hero.z; hs.yaw = hero.yaw;
    hs.g.position.set(hs.x, height(hs.x, hs.z), hs.z);
    hs.g.rotation.y = hs.yaw;
    const hp = hero.animT * 1.35;
    for (let i = 0; i < hs.legs.length; i++) hs.legs[i].rotation.x = moving ? Math.sin(hp + i * Math.PI / 2) * 0.62 : 0;
    hs.head.rotation.x = moving ? Math.sin(hp * 2) * 0.07 : 0;
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
  camPitch = clamp(camPitch, -0.24, 0.62);
  camDist = clamp(camDist, 6, 30);
  if (cutActive) { cutCamTick(dt); return; }
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
  if (window.__andoraCapture) return;
  frameCount++; wdFrames++;
  const wdNow = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (wdNow - wdLast > 2200) {
    const fps = wdFrames * 1000 / (wdNow - wdLast);
    wdLast = wdNow; wdFrames = 0;
    if (fps < 38 && qualityLevel > 0) {
      qualityLevel--; upGood = 0;
      applyQuality();
    } else if (fps > 55 && qualityLevel < 2) {
      upGood++;
      if (upGood >= 3) { upGood = 0; qualityLevel++; applyQuality(); }
    } else if (fps <= 55) {
      upGood = 0;
    }
  }
  const t = worldTime;
  if (gameStarted && !menuMode && !dlgNpc && !cutActive) updateHero(dt);
  updateWeather(dt);
  updateProps(dt);
  if (hero && hero.fishingT > 0) {
    hero.fishingT -= dt;
    if (hero.fishingT <= 0) {
      hero.fishingT = 0;
      if (Math.random() < 0.72) {
        inv['peixe'] = (inv['peixe'] || 0) + 1;
        showToast('🐟 Um peixe mordeu! (peixe ×' + inv['peixe'] + ')');
        if (navigator.vibrate) { try { navigator.vibrate(20); } catch (e) {} }
        unlock('pescador', 'Pescador do Vale');
      } else {
        showToast('💧 O peixe escapou dessa vez...');
      }
    }
  }
  if (menuMode && !cutActive) camYaw += dt * 0.05;
  if (hero) {
    updateChunks(false);
    if (seedNature && seedQueue.length === 0 && (Math.abs(hero.x - seedX) + Math.abs(hero.z - seedZ) > 70)) seedNature();
  }
  if (seedSlice && seedQueue && seedQueue.length) seedSlice(seedQueue.shift());
  if (hero) updateCamera(dt);
  windU.value = worldTime;
  if (hero && (menuMode || dlgNpc || (!gameStarted && !cutActive))) poseHuman(hero, { talk: !!dlgNpc, moving: false }, dt);
  // reflexo espelhado do cenario na agua (so perto do lago; some se o FPS cair)
  if (reflRT && reflCam && camera && water && renderer.setRenderTarget) {
    const nearLake = hero ? distTo(hero.x, hero.z, LAKE.x, LAKE.z) < LAKE.r + 170 : false;
    if (nearLake && qualityLevel >= 1 && (frameCount % 2 === 0 || water.material.uniforms.uReflOn.value < 0.5)) {
      reflCam.position.copy(camera.position);
      reflCam.position.y = 2 * WATER_Y - camera.position.y;
      camera.getWorldDirection(_reflDir);
      _reflLook.copy(camera.position).add(_reflDir);
      _reflLook.y = 2 * WATER_Y - _reflLook.y;
      reflCam.up.set(0, 1, 0);
      reflCam.lookAt(_reflLook);
      reflCam.fov = camera.fov; reflCam.aspect = camera.aspect;
      reflCam.updateProjectionMatrix();
      reflCam.updateMatrixWorld(true);
      reflCam.matrixWorldInverse.copy(reflCam.matrixWorld).invert();
      _reflTexMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      _reflTexMat.multiply(reflCam.projectionMatrix);
      _reflTexMat.multiply(reflCam.matrixWorldInverse);
      water.material.uniforms.uTexMat.value.copy(_reflTexMat);
      water.material.uniforms.uReflOn.value = 1;
      water.visible = false;
      const shd = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
      renderer.setRenderTarget(reflRT);
      renderer.render(scene, reflCam);
      renderer.setRenderTarget(null);
      renderer.shadowMap.enabled = shd;
      water.visible = true;
    } else if (!nearLake || qualityLevel < 1) {
      water.material.uniforms.uReflOn.value = 0;
    }
  }
  if (hero && camera && !cutActive) {
    const tf = (hero.speed >= 15 ? 73.5 : (hero.speed > 8 ? 67.5 : 62)) + (IS_TOUCH ? 7 : 0);
    if (Math.abs(camera.fov - tf) > 0.04) { camera.fov += (tf - camera.fov) * (1 - Math.exp(-3.2 * dt)); camera.updateProjectionMatrix(); }
  }
  updateSky();
  if (Math.abs(hour - envHour) > 2.5) updateEnvironment(false);
  for (const fn of animatables) fn(t, dt);
  for (const hs of horseList) horseThink(hs, dt);
  for (const an of animalList) animalThink(an, dt);
  for (const b of birds) {
    let sx = 0, sz = 0, ax = 0, az = 0, mx = 0, mz = 0, nb = 0;
    for (const o of birds) {
      if (o === b) continue;
      const dx = o.g.position.x - b.g.position.x, dz = o.g.position.z - b.g.position.z;
      const d2b = dx * dx + dz * dz;
      if (d2b < 7200) {
        mx += o.g.position.x; mz += o.g.position.z; ax += (o.vx || 0); az += (o.vz || 0); nb++;
        if (d2b < 1100 && d2b > 0.01) { sx -= dx / d2b * 90; sz -= dz / d2b * 90; }
      }
    }
    if (nb > 0) {
      mx = mx / nb - b.g.position.x; mz = mz / nb - b.g.position.z;
      ax = ax / nb - (b.vx || 0); az = az / nb - (b.vz || 0);
      b.vx = (b.vx || 0) + (mx * 0.07 + ax * 0.5 + sx * 1.35) * dt * 2.6;
      b.vz = (b.vz || 0) + (mz * 0.07 + az * 0.5 + sz * 1.35) * dt * 2.6;
    }
    b.vx = (b.vx || 0) + (b.cx - b.g.position.x) * 0.02 * dt * 6;
    b.vz = (b.vz || 0) + (b.cz - b.g.position.z) * 0.02 * dt * 6;
    const sp = Math.sqrt((b.vx || 0) * (b.vx || 0) + (b.vz || 0) * (b.vz || 0)), maxS = 17;
    if (sp > maxS) { b.vx *= maxS / sp; b.vz *= maxS / sp; }
    else if (sp < 7) { b.vx = (b.vx || 0) * 1.3; b.vz = (b.vz || 0) * 1.3; }
    b.g.position.x += (b.vx || 0) * dt; b.g.position.z += (b.vz || 0) * dt;
    b.g.position.y = b.y + Math.sin(t * 0.7 + b.a) * 3;
    if (sp > 0.4) b.g.rotation.y = Math.atan2(b.vx, b.vz);
    const flap = Math.sin(t * 7 + b.a * 3) * 0.75;
    b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
    b.a += dt;
  }
  for (const c of clouds) {
    c.position.x += dt * 1.6;
    if (c.position.x > 420) c.position.x = -420;
  }
  // NPCs: balanço suave e passeio dos ambientes
  for (const n of npcList) {
    if (n.ambient) {
      n.animT += dt * 5.2;
      n.wanderT -= dt;
      const nightR = hour >= 20 || hour < 5.5;
      const homeTx = nightR ? VILLAGE.x : n.homeX, homeTz = nightR ? VILLAGE.z : n.homeZ;
      if (n.wanderT <= 0) {
        n.wanderT = rand(4, 10);
        n.yaw = nightR ? Math.atan2(homeTx - n.x, homeTz - n.z) + rand(-0.6, 0.6) : rand(0, 6.28);
      }
      const nx = n.x + Math.sin(n.yaw) * 1.5 * dt, nz = n.z + Math.cos(n.yaw) * 1.5 * dt;
      const walking = distTo(nx, nz, homeTx, homeTz) < (nightR ? 58 : 26) && height(nx, nz) > 1.5;
      if (walking) { n.x = nx; n.z = nz; }
      else n.yaw += 2.4 * dt;
      n.g.position.set(n.x, height(n.x, n.z), n.z);
      n.g.rotation.y = n.yaw;
      poseHuman(n, { moving: walking }, dt);
    } else {
      n.animT += dt * 1.5;
      n.g.rotation.y = Math.sin(n.animT * 0.35) * 0.3 + Math.atan2(hero.x - n.g.position.x, hero.z - n.g.position.z) * 0.25;
      poseHuman(n, { talk: dlgNpc === n, moving: false }, dt);
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
  ambTick(dt);
  if (renderer.shadowMap && frameCount % (qualityLevel >= 2 ? 2 : 3) === 0) renderer.shadowMap.needsUpdate = true;
  if (composer) composer.render();
  else renderer.render(scene, camera);
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  if (renderer.shadowMap) renderer.shadowMap.autoUpdate = false;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xbfe2f2, 0.0019);
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 12, 180);
  clock = new THREE.Clock();
  try {
    const vig = document.createElement('div');
    vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:8;background:radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 52%, rgba(8,10,16,0.32) 100%)';
    document.body.appendChild(vig);
    gradeEl = document.createElement('div');
    gradeEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9;mix-blend-mode:soft-light;background:transparent';
    document.body.appendChild(gradeEl);
  } catch (e) {}
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  });
  updateEnvironment(true);
  setupComposer();
  setupSky();
  buildTerrain();
  buildNature();
  buildVillage();
  buildLanterns();
  buildProps();
  buildBonfire();
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
  // sombras reais em tudo que é sólido (menos céu, água, grama e blobs)
  scene.traverse(o => {
    if ((o.isMesh || o.isInstancedMesh) && !o.userData.noShadow && o !== terrain && o !== water && o !== skyDome) {
      o.castShadow = true;
      if (!o.isInstancedMesh) o.receiveShadow = true;
    }
  });
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
