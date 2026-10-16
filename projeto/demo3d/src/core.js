/* ============================================================
   ANDORA — jogo reescrito do zero (2026)
   Núcleo: mundo infinito por heightmap periódico, terreno em
   clipmap (3 draw calls), céu/água próprios, áudio sintetizado.
   Orçamento rígido de performance para máquinas fracas.
   ============================================================ */
'use strict';

/* ---------------- utils (novos) ---------------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const TAU = Math.PI * 2;
let RNG_SEED = 1337;
function srand() { RNG_SEED = (RNG_SEED * 1664525 + 1013904223) >>> 0; return RNG_SEED / 4294967296; }
function rr(a, b) { return a + srand() * (b - a); }

/* ruído de valor periódico (o mundo é um toro: x/z infinitos por repetição) */
function hashi(x, z, s) {
  let h = (x * 374761393 + z * 668265263 + s * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function wrapN(n, p) { return ((n % p) + p) % p; }
function vnoiseP(x, z, period, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const x0 = wrapN(xi, period), x1 = wrapN(xi + 1, period);
  const z0 = wrapN(zi, period), z1 = wrapN(zi + 1, period);
  const a = hashi(x0, z0, seed), b = hashi(x1, z0, seed);
  const c = hashi(x0, z1, seed), d = hashi(x1, z1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbmP(x, z, period, seed, oct) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < (oct || 4); i++) {
    s += amp * vnoiseP(x * f, z * f, period * f, seed + i * 7);
    amp *= 0.5; f *= 2;
  }
  return s;
}
/* distância com wrap (feições continuam do outro lado do mundo) */
function wdist(ax, az, bx, bz) {
  const W = 4096;
  let dx = Math.abs(ax - bx); if (dx > W / 2) dx = W - dx;
  let dz = Math.abs(az - bz); if (dz > W / 2) dz = W - dz;
  return Math.sqrt(dx * dx + dz * dz);
}

/* ---------------- mundo: heightmap periódico ---------------- */
const W = 4096;          // período do mundo (unidades)
const HM = 512;          // resolução do heightmap
const HSTEP = W / HM;    // 8u por texel
let HM_DATA = new Float32Array(HM * HM);
let WORLD_SEED = 20261;

const LAKE = { x: -900, z: -760, r: 470 };
const VILLAGE = { x: 60, z: 180, r: 300 };
const POND = { x: 1560, z: 1180, r: 170 };

function terrainRaw(x, z) {
  // colinas grandes + médias + detalhe
  let h = (fbmP(x / 620, z / 620, W / 620, WORLD_SEED, 3) - 0.45) * 62;
  h += (fbmP(x / 190, z / 190, W / 190, WORLD_SEED + 40, 3) - 0.5) * 16;
  h += (fbmP(x / 46, z / 46, W / 46, WORLD_SEED + 80, 2) - 0.5) * 4.2;
  // cordilhava a nordeste (wrap)
  const md = wdist(x, z, 1250, -1500);
  const ridge = 1 - Math.abs(fbmP(x / 260, z / 260, W / 260, WORLD_SEED + 120, 3) - 0.5) * 2;
  h += smoothstep(1500, 300, md) * (58 + 72 * ridge * ridge);
  // montanha isolada ao sul
  const md2 = wdist(x, z, -1750, 1650);
  h += smoothstep(1100, 120, md2) * (44 + 40 * ridge);
  // bacia do lago
  const ld = wdist(x, z, LAKE.x, LAKE.z);
  h -= Math.exp(-(ld * ld) / (LAKE.r * LAKE.r * 0.92)) * 46;
  // lagoa pequena
  const pd = wdist(x, z, POND.x, POND.z);
  h -= Math.exp(-(pd * pd) / (POND.r * POND.r)) * 26;
  // planalto da vila (achatado e levemente elevado)
  const vd = wdist(x, z, VILLAGE.x, VILLAGE.z);
  const vf = smoothstep(VILLAGE.r, VILLAGE.r * 0.35, vd);
  h = lerp(h, 7.5, vf * 0.94);
  return h;
}
function bakeHeightmap() {
  for (let j = 0; j < HM; j++) {
    const z = (j / HM) * W;
    for (let i = 0; i < HM; i++) {
      HM_DATA[j * HM + i] = terrainRaw((i / HM) * W, z);
    }
  }
}
/* amostragem bilinear com wrap (física e geometria usam esta) */
function groundH(x, z) {
  const fx = ((x % W) + W) % W / HSTEP;
  const fz = ((z % W) + W) % W / HSTEP;
  const xi = Math.floor(fx), zi = Math.floor(fz);
  const tx = fx - xi, tz = fz - zi;
  const x0 = wrapN(xi, HM), x1 = wrapN(xi + 1, HM);
  const z0 = wrapN(zi, HM), z1 = wrapN(zi + 1, HM);
  const a = HM_DATA[z0 * HM + x0], b = HM_DATA[z0 * HM + x1];
  const c = HM_DATA[z1 * HM + x0], d = HM_DATA[z1 * HM + x1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}
function groundN(x, z, out) {
  const e = 4;
  const hx = groundH(x - e, z) - groundH(x + e, z);
  const hz = groundH(x, z - e) - groundH(x, z + e);
  const inv = 1 / Math.sqrt(hx * hx + hz * hz + 4 * e * e);
  out[0] = hx * inv; out[1] = 2 * e * inv; out[2] = hz * inv;
  return out;
}

/* ---------------- textura de detalhe do terreno ---------------- */
function makeNoiseTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  draw(x, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ---------------- áudio sintetizado (sem arquivos) ---------------- */
const Audio2 = {
  ctx: null, master: null, nodes: {}, on: true,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.34;
      this.master.connect(this.ctx.destination);
      // ruído branco reutilizável
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    } catch (e) { this.ctx = null; }
  },
  noiseLoop(filterType, freq, gain) {
    if (!this.ctx) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    return { src, f, g };
  },
  start() {
    this.init();
    if (!this.ctx) return;
    if (this.nodes.wind) return;
    this.nodes.wind = this.noiseLoop('lowpass', 380, 0.05);
    this.nodes.water = this.noiseLoop('bandpass', 850, 0.0);
    this.nodes.rain = this.noiseLoop('highpass', 1600, 0.0);
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setEnv(o) {
    if (!this.ctx || !this.nodes.wind) return;
    const t = this.ctx.currentTime;
    const setv = (n, v) => { if (n && n.g) n.g.gain.setTargetAtTime(v, t, 0.6); };
    setv(this.nodes.wind, this.on ? (0.035 + (o.wind || 0) * 0.05) : 0);
    setv(this.nodes.water, this.on ? (o.water || 0) * 0.1 : 0);
    setv(this.nodes.rain, this.on ? (o.rain || 0) * 0.16 : 0);
    if (this.nodes.wind && this.nodes.wind.f) this.nodes.wind.f.frequency.setTargetAtTime(320 + (o.wind || 0) * 260, t, 0.8);
  },
  chirp(f0, dur, vol) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + dur * 0.4);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  step(run) {
    if (!this.ctx || !this.on) return;
    this.chirp(run ? 140 : 100, 0.07, 0.05);
  },
  blip(f) { this.chirp(f || 520, 0.12, 0.08); }
};

/* ---------------- céu (domo com sol, nuvens e estrelas) ---------------- */
const skyUniforms = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uTop: { value: new THREE.Color(0x2a6ab8) },
  uHorizon: { value: new THREE.Color(0xbfd8e8) },
  uSunCol: { value: new THREE.Color(0xfff2d8) },
  uNight: { value: 0 },
  uTime: { value: 0 },
  uCloud: { value: 0.55 },
  uFog: { value: new THREE.Color(0xbfd8e8) }
};
function buildSky() {
  const geo = new THREE.SphereGeometry(3600, 32, 18);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: skyUniforms,
    vertexShader: [
      'varying vec3 vDir;',
      'void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vDir;',
      'uniform vec3 uSunDir, uTop, uHorizon, uSunCol, uFog;',
      'uniform float uNight, uTime, uCloud;',
      'float h21(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }',
      'float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
      ' float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));',
      ' return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }',
      'void main(){',
      ' vec3 d = normalize(vDir);',
      ' float t = pow(clamp(d.y, 0.0, 1.0), 0.55);',
      ' vec3 col = mix(uHorizon, uTop, t);',
      ' float sunAmt = max(dot(d, normalize(uSunDir)), 0.0);',
      ' col += uSunCol * pow(sunAmt, 380.0) * 4.2;',
      ' col += uSunCol * pow(sunAmt, 8.0) * 0.16;',
      ' vec2 cuv = d.xz / max(d.y + 0.18, 0.12) * 1.3;',
      ' float cl = n2(cuv * 1.1 + vec2(uTime * 0.008, 0.0));',
      ' cl += 0.5 * n2(cuv * 2.7 - vec2(uTime * 0.012, 3.0));',
      ' cl = smoothstep(0.62, 1.15, cl) * uCloud * smoothstep(0.02, 0.28, d.y);',
      ' vec3 cloudCol = mix(uHorizon * 1.06, uSunCol * 0.9 + vec3(0.25), sunAmt * 0.7);',
      ' cloudCol = mix(cloudCol, uTop * 0.4 + vec3(0.03, 0.03, 0.06), uNight);',
      ' col = mix(col, cloudCol, cl * 0.85);',
      ' vec3 c3 = floor(d * 700.0);',
      ' float st = step(0.9975, h21(vec2(c3.x + c3.z * 1.7, c3.y + c3.z * 3.3)));',
      ' col += vec3(st) * uNight * (1.0 - cl) * smoothstep(0.05, 0.4, d.y) * 0.85;',
      ' col = mix(col, uFog, pow(1.0 - clamp(d.y, 0.0, 1.0), 9.0) * 0.6);',
      ' gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);
  return dome;
}

/* ---------------- terreno em clipmap (3 anéis) ---------------- */
const rings = [];
function makeRing(span, segs, sink, snapStep) {
  const geo = new THREE.PlaneGeometry(span, span, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0.0,
    map: texDetail, bumpMap: texDetail, bumpScale: 0.5
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  const ring = { mesh, span, segs, sink, snapStep, snapX: 1e9, snapZ: 1e9, geo };
  rings.push(ring);
  return ring;
}
function bakeRing(ring, cx, cz) {
  const snap = ring.snapStep || ring.span / ring.segs;
  const sx = Math.round(cx / snap) * snap;
  const sz = Math.round(cz / snap) * snap;
  if (sx === ring.snapX && sz === ring.snapZ) return;
  ring.snapX = sx; ring.snapZ = sz;
  const pos = ring.geo.attributes.position;
  const col = ring.geo.attributes.color || new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
  const nrm = ring.geo.attributes.normal;
  const uv = ring.geo.attributes.uv;
  const half = ring.span / 2;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = sx + pos.getX(i);
    const z = sz + pos.getZ(i);
    const h = groundH(x, z) + ring.sink;
    pos.setY(i, h);
    uv.setXY(i, x / 14, z / 14);
    // cor por altura/encosta/variação
    const slope = Math.abs(groundH(x - 6, z) - groundH(x + 6, z)) + Math.abs(groundH(x, z - 6) - groundH(x, z + 6));
    const n = fbmP(x / 90, z / 90, W / 90, WORLD_SEED + 300, 2);
    const nv = fbmP(x / 26, z / 26, W / 26, WORLD_SEED + 310, 2);
    if (h < 1.4 && wdist(x, z, LAKE.x, LAKE.z) < LAKE.r + 260) {
      const t = smoothstep(1.4, -2.5, h);
      c.setRGB(lerp(0.72, 0.42, t), lerp(0.66, 0.38, t), lerp(0.44, 0.3, t));
    } else if (h > 58) {
      const t = smoothstep(58, 82, h);
      c.setRGB(lerp(0.42, 0.92, t), lerp(0.44, 0.93, t), lerp(0.42, 0.96, t));
    } else if (slope > 2.6) {
      const t = smoothstep(2.6, 6.5, slope);
      c.setRGB(lerp(0.36, 0.48, t), lerp(0.4, 0.46, t), lerp(0.32, 0.4, t));
    } else {
      const dry = smoothstep(0.52, 0.78, fbmP(x / 240, z / 240, W / 240, WORLD_SEED + 400, 2));
      const rich = smoothstep(0.55, 0.85, n);
      const g1 = lerp(0.3, 0.42, nv), g2 = lerp(0.5, 0.34, smoothstep(8, 50, h));
      c.setRGB(g1 * 0.6 + 0.1 * n + dry * 0.16 - rich * 0.05,
        g2 + 0.13 * n - dry * 0.02 - rich * 0.08,
        g1 * 0.4 + dry * 0.02);
    }
    const tint = 0.9 + nv * 0.24;
    col.setXYZ(i, c.r * tint, c.g * tint, c.b * tint);
  }
  pos.needsUpdate = true; col.needsUpdate = true;
  ring.geo.setAttribute('color', col);
  // normais aproximadas
  const arr = nrm.array;
  const e = ring.span / ring.segs;
  for (let i = 0; i < pos.count; i++) {
    const x = sx + pos.getX(i), z = sz + pos.getZ(i);
    const hx = (groundH(x - e, z) - groundH(x + e, z));
    const hz = (groundH(x, z - e) - groundH(x, z + e));
    const inv = 1 / Math.sqrt(hx * hx + hz * hz + 4 * e * e);
    arr[i * 3] = hx * inv; arr[i * 3 + 1] = 2 * e * inv; arr[i * 3 + 2] = hz * inv;
  }
  nrm.needsUpdate = true;
  ring.mesh.position.set(sx, 0, sz);
}
function updateTerrain(cx, cz) {
  for (const r of rings) bakeRing(r, cx, cz);
}

/* ---------------- água (lago + lagoa) ---------------- */
function buildWater() {
  // mapa de bacia local do lago para o alpha da água
  const S = 192, REACH = LAKE.r + 320;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const cx2 = cv.getContext('2d');
  const img = cx2.createImageData(S, S);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const x = LAKE.x + (i / (S - 1) - 0.5) * 2 * REACH;
      const z = LAKE.z + (j / (S - 1) - 0.5) * 2 * REACH;
      const v = clamp(Math.round((groundH(x, z) + 48) / 96 * 255), 0, 255);
      const k = (j * S + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
      img.data[k + 3] = 255;
    }
  }
  cx2.putImageData(img, 0, 0);
  const bath = new THREE.CanvasTexture(cv);
  bath.flipY = false;
  bath.minFilter = bath.magFilter = THREE.LinearFilter;

  const uniforms = {
    uTime: { value: 0 },
    uSunDir: skyUniforms.uSunDir,
    uSunCol: skyUniforms.uSunCol,
    uSky: skyUniforms.uHorizon,
    uTop: skyUniforms.uTop,
    uNight: skyUniforms.uNight,
    uBath: { value: bath },
    uBathC: { value: new THREE.Vector2(LAKE.x, LAKE.z) },
    uBathR: { value: REACH },
    fogColor: { value: new THREE.Color(0xbfd8e8) },
    fogDensity: { value: 0.0012 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: [
      'uniform float uTime;',
      'varying vec3 vW; varying vec3 vV;',
      'void main(){',
      ' vec3 p = position;',
      ' float w1 = sin(p.x * 0.055 + uTime * 1.1) * cos(p.z * 0.062 - uTime * 0.8);',
      ' float w2 = sin(p.x * 0.12 - uTime * 1.5) * sin(p.z * 0.1 + uTime * 1.2);',
      ' p.y += w1 * 0.22 + w2 * 0.1;',
      ' vec4 wp = modelMatrix * vec4(p, 1.0);',
      ' vW = wp.xyz;',
      ' vV = cameraPosition - wp.xyz;',
      ' gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime, uNight, uBathR, fogDensity;',
      'uniform vec3 uSunDir, uSunCol, uSky, uTop, fogColor;',
      'uniform vec2 uBathC;',
      'uniform sampler2D uBath;',
      'varying vec3 vW; varying vec3 vV;',
      'void main(){',
      ' vec3 V = normalize(vV);',
      ' vec3 N = normalize(vec3(',
      '   0.11 * sin(vW.x * 1.9 + uTime * 1.9) + 0.06 * sin(vW.x * 3.4 - uTime + vW.z * 1.4),',
      '   1.0,',
      '   0.11 * cos(vW.z * 2.1 + uTime * 1.7) + 0.06 * cos(vW.z * 3.1 + uTime * 1.2 + vW.x * 1.3)));',
      ' float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);',
      ' vec3 deep = mix(vec3(0.04, 0.14, 0.19), vec3(0.02, 0.045, 0.09), uNight);',
      ' vec3 skyRef = mix(uSky, uTop, 0.35) * (0.42 + 0.58 * (1.0 - uNight));',
      ' vec3 col = mix(deep, skyRef, clamp(pow(fres, 1.3) * 1.1, 0.0, 0.9));',
      ' col += deep * (1.0 - fres) * 0.4;',
      ' vec3 L = normalize(uSunDir);',
      ' vec3 H = normalize(L + V);',
      ' float spec = pow(max(dot(N, H), 0.0), 220.0) * 3.2 + pow(max(dot(N, H), 0.0), 28.0) * 0.14;',
      ' col += uSunCol * spec;',
      ' vec2 bUV = (vW.xz - uBathC) / (2.0 * uBathR) + 0.5;',
      ' float th = texture2D(uBath, clamp(bUV, 0.003, 0.997)).r * 96.0 - 48.0;',
      ' float subm = smoothstep(0.55, -0.45, th);',
      ' float shore = smoothstep(-2.0, -0.3, th) * (1.0 - smoothstep(0.1, 1.1, th));',
      ' col = mix(col, vec3(0.82, 0.88, 0.9), shore * (0.35 + 0.3 * sin(th * 6.0 + uTime * 1.4)));',
      ' float fd = length(vV);',
      ' float fogF = 1.0 - exp(-fogDensity * fogDensity * fd * fd);',
      ' col = mix(col, fogColor, fogF);',
      ' gl_FragColor = vec4(col, 0.96 * subm);',
      '}'
    ].join('\n')
  });
  const geo = new THREE.CircleGeometry(LAKE.r + 300, 72);
  geo.rotateX(-Math.PI / 2);
  const lake = new THREE.Mesh(geo, mat);
  lake.position.set(LAKE.x, 0, LAKE.z);
  lake.renderOrder = 2;
  scene.add(lake);
  return { mesh: lake, uniforms };
}
