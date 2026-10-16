/* ============================================================
   ANDORA — parte 2: mundo vivo
   Assets GLTF instanciados, vila medieval, personagens (GLB),
   animais, cavalos montáveis, clima e partículas.
   ============================================================ */

/* ---------------- assets GLTF ---------------- */
const GLB = {
  pending: 0, done: false, cache: {}, onReady: [],
  load(key, cb) {
    if (this.cache[key]) { cb && cb(this.cache[key]); return; }
    if (!window.THREE.GLTFLoader) { cb && cb(null); return; }
    this.pending++;
    const loader = new THREE.GLTFLoader();
    loader.load('assets/' + key + '.glb', (g) => {
      const s = this.prep(key, g);
      this.cache[key] = s;
      this.pending--;
      if (this.pending <= 0 && !this.done) {
        this.done = true;
        this.onReady.forEach(f => f());
      }
      cb && cb(s);
    }, undefined, () => {
      this.pending--;
      cb && cb(null);
    });
  },
  prep(key, gltf) {
    const root = gltf.scene;
    root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          o.material.metalness = Math.min(o.material.metalness || 0, 0.35);
          o.material.roughness = Math.max(o.material.roughness || 1, 0.55);
          o.material.envMapIntensity = 0.6;
        }
      }
    });
    return { scene: root, clips: gltf.animations || [], mixer: null };
  },
  inst(key, mat) {
    // acha a primeira malha para InstancedMesh
    let mesh = null;
    this.cache[key].scene.traverse(o => { if (!mesh && o.isMesh && o.geometry) mesh = o; });
    if (!mesh) return null;
    const m = new THREE.InstancedMesh(mesh.geometry, mat || mesh.material, 1);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  },
  clone(key) {
    const c = this.cache[key];
    if (!c) return null;
    return (THREE.SkeletonUtils && THREE.SkeletonUtils.clone) ? THREE.SkeletonUtils.clone(c.scene) : c.scene.clone(true);
  }
};

/* ---------------- vegetação instanciada ---------------- */
const Nature = {
  defs: [
    { key: 'commontree_1', n: 9, cap: 74, s: [2.2, 3.6], h: [1.2, 52], slope: 3.0, shadow: true },
    { key: 'commontree_3', n: 6, cap: 58, s: [2.0, 3.2], h: [1.2, 56], slope: 3.2, shadow: true },
    { key: 'commontree_5', n: 5, cap: 50, s: [2.2, 3.8], h: [1.5, 58], slope: 3.0, shadow: true },
    { key: 'pinetree_1', n: 6, cap: 56, s: [2.2, 3.6], h: [3, 70], slope: 3.6, shadow: true },
    { key: 'pinetree_3', n: 4, cap: 40, s: [2.4, 3.8], h: [3, 74], slope: 3.6, shadow: true },
    { key: 'birchtree_2', n: 4, cap: 38, s: [2.0, 3.0], h: [1.2, 48], slope: 2.8, shadow: true },
    { key: 'willow_3', n: 3, cap: 26, s: [2.2, 3.4], h: [0.6, 12], slope: 2.2, shadow: true },
    { key: 'bush_1', n: 8, cap: 64, s: [1.2, 2.0], h: [1, 50], slope: 3.4 },
    { key: 'bushberries_1', n: 5, cap: 40, s: [1.1, 1.8], h: [1, 44], slope: 3.0 },
    { key: 'rock_moss_1', n: 5, cap: 40, s: [1.2, 2.6], h: [0.5, 70], slope: 6.0 },
    { key: 'rock_moss_3', n: 4, cap: 36, s: [1.0, 2.2], h: [0.5, 72], slope: 6.0 },
    { key: 'rock_2', n: 4, cap: 30, s: [1.2, 2.8], h: [0.5, 76], slope: 6.5 },
    { key: 'woodlog', n: 3, cap: 18, s: [1.2, 2.0], h: [1, 50], slope: 3.5 },
    { key: 'treestump', n: 3, cap: 16, s: [1.1, 1.8], h: [1, 48], slope: 3.2 },
    { key: 'wheat', n: 5, cap: 34, s: [1.4, 2.2], h: [1, 30], slope: 2.4 }
  ],
  meshes: {}, lastX: 1e9, lastZ: 1e9,
  init() {
    for (const d of this.defs) {
      const src = GLB.cache[d.key];
      if (!src) continue;
      let mesh = null;
      src.scene.traverse(o => { if (!mesh && o.isMesh && o.geometry) mesh = o; });
      if (!mesh) continue;
      const cap = d.cap || d.n * 20;
      const big = new THREE.InstancedMesh(mesh.geometry, mesh.material, cap);
      big.castShadow = !!d.shadow && QUAL.level >= 2;
      big.receiveShadow = true;
      big.count = 0;
      big.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      big.frustumCulled = false;
      scene.add(big);
      this.meshes[d.key] = big;
    }
  },
  scatter() {
    // determinístico por região 256u — mesmo resultado sempre
    const R = QUAL.level >= 1 ? 640 : 430, TS = 256;
    const cx = Math.round(hero.pos.x / TS), cz = Math.round(hero.pos.z / TS);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const counts = {};
    for (const d of this.defs) counts[d.key] = 0;
    const rT = Math.ceil(R / TS);
    for (let tz = -rT; tz <= rT; tz++) {
      for (let tx = -rT; tx <= rT; tx++) {
        const gx = cx + tx, gz = cz + tz;
        const seed = (gx * 73856093 ^ gz * 19349663 ^ WORLD_SEED) | 0;
        for (const d of this.defs) {
          const im = this.meshes[d.key];
          if (!im) continue;
          const n = d.n;
          for (let k = 0; k < n; k++) {
            const hx = hashi(gx * 31 + k, gz * 17 + k * 7, seed);
            const hz = hashi(gx * 13 + k * 5, gz * 41 + k, seed + 9);
            const x = gx * TS + (hx - 0.5) * TS;
            const z = gz * TS + (hz - 0.5) * TS;
            const dist = wdist(x, z, hero.pos.x, hero.pos.z);
            if (dist > R) continue;
            const h = groundH(x, z);
            if (h < d.h[0] || h > d.h[1]) continue;
            const sl = Math.abs(groundH(x - 5, z) - groundH(x + 5, z)) + Math.abs(groundH(x, z - 5) - groundH(x, z + 5));
            if (sl > d.slope) continue;
            if (wdist(x, z, VILLAGE.x, VILLAGE.z) < 92) continue;
            if (wdist(x, z, LAKE.x, LAKE.z) < LAKE.r * 0.92) continue;
            if (wdist(x, z, POND.x, POND.z) < POND.r * 0.8) continue;
            if (counts[d.key] >= im.instanceMatrix.count) continue;
            const s = lerp(d.s[0], d.s[1], hashi(gx + k * 3, gz + k, seed + 5));
            const rot = hashi(gx + k, gz - k, seed + 11) * TAU;
            P.set(x, h - 0.25, z);
            Q.setFromAxisAngle(up, rot);
            S.setScalar(s);
            M.compose(P, Q, S);
            im.setMatrixAt(counts[d.key]++, M);
          }
        }
      }
    }
    for (const d of this.defs) {
      const im = this.meshes[d.key];
      if (!im) continue;
      im.count = counts[d.key];
      im.instanceMatrix.needsUpdate = true;
    }
    this.lastX = hero.pos.x; this.lastZ = hero.pos.z;
  },
  tick() {
    if (!this.meshes[Object.keys(this.meshes)[0]]) return;
    const moved = wdist(hero.pos.x, hero.pos.z, this.lastX, this.lastZ);
    if (moved > 55) this.scatter();
  }
};

/* ---------------- grama instanciada perto da câmera ---------------- */
const GrassField = {
  im: null, last: 0, lastX: 1e9, lastZ: 1e9,
  init() {
    const src = GLB.cache['grass'] || GLB.cache['grass_2'];
    let geo = null, mat = null;
    if (src) {
      src.scene.traverse(o => { if (!geo && o.isMesh) { geo = o.geometry; mat = o.material; } });
    }
    if (!geo) {
      geo = new THREE.PlaneGeometry(1.4, 1.2, 1, 2);
      geo.translate(0, 0.6, 0);
      mat = new THREE.MeshLambertMaterial({ color: 0x4c7a2e, side: THREE.DoubleSide });
    }
    if (mat.color) mat.color.multiplyScalar(1.35);
    this.im = new THREE.InstancedMesh(geo, mat, QUAL.grass);
    this.im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.im.castShadow = false;
    this.im.receiveShadow = true;
    this.im.frustumCulled = false;
    scene.add(this.im);
  },
  tick(t) {
    if (!this.im || QUAL.grass <= 0) return;
    const moved = wdist(hero.pos.x, hero.pos.z, this.lastX, this.lastZ);
    if (t - this.last < 1.2 && moved < 14) return;
    this.last = t; this.lastX = hero.pos.x; this.lastZ = hero.pos.z;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const R = QUAL.grassR;
    const N = QUAL.grass;
    for (let i = 0; i < N; i++) {
      const a = i * 2.399963; // golden angle
      const r = Math.sqrt(i / N) * R;
      const x = hero.pos.x + Math.cos(a) * r + (hashi(i, 3, WORLD_SEED) - 0.5) * 4;
      const z = hero.pos.z + Math.sin(a) * r + (hashi(i, 7, WORLD_SEED) - 0.5) * 4;
      const h = groundH(x, z);
      const ok = h > 1.0 && h < 50 && wdist(x, z, LAKE.x, LAKE.z) > LAKE.r * 0.9;
      P.set(x, h - 0.06, z);
      Q.setFromAxisAngle(up, hashi(i, 11, WORLD_SEED) * TAU);
      S.setScalar(ok ? 0.20 + hashi(i, 13, WORLD_SEED) * 0.16 : 0.001);
      M.compose(P, Q, S);
      this.im.setMatrixAt(i, M);
    }
    this.im.instanceMatrix.needsUpdate = true;
    this.im.count = N;
  }
};

/* ---------------- vila medieval (GLB) ---------------- */
const villageParts = [];
function placeModel(key, x, z, rot, scale, yOff) {
  const g = GLB.clone(key);
  if (!g) return null;
  const y = groundH(x, z) + (yOff || 0);
  g.position.set(x, y, z);
  g.rotation.y = rot || 0;
  if (scale) g.scale.setScalar(scale);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);
  villageParts.push(g);
  return g;
}
function buildVillage() {
  const C = VILLAGE;
  const houses = [
    ['v_house_1', -120, -60, 0.4], ['v_house_2', -40, -140, 0.1], ['v_house_3', 90, -110, -0.3],
    ['v_house_4', 150, -20, -0.9], ['v_house_1', 120, 90, -1.8], ['v_house_2', 20, 150, 2.9],
    ['v_house_3', -110, 110, 2.2], ['v_house_4', -170, 20, 1.2],
    ['v_inn', -20, -20, 0.15], ['v_stable', 190, 60, -1.2]
  ];
  for (const [k, dx, dz, r] of houses) {
    placeModel(k, C.x + dx, C.z + dz, r, 1);
    colliders.push({ x: C.x + dx, z: C.z + dz, r: 14 });
  }
  placeModel('v_well', C.x, C.z + 40, 0, 1);
  colliders.push({ x: C.x, z: C.z + 40, r: 4.5 });
  placeModel('v_marketstand_1', C.x - 60, C.z + 60, 0.6, 1);
  placeModel('v_marketstand_2', C.x + 70, C.z + 70, -0.5, 1);
  placeModel('v_bell_tower', C.x + 40, C.z - 60, 0.2, 1);
  colliders.push({ x: C.x + 40, z: C.z - 60, r: 8 });
  placeModel('v_cart', C.x - 90, C.z + 10, 1.1, 1);
  placeModel('v_hay', C.x + 165, C.z + 95, 0.4, 1);
  placeModel('v_hay', C.x + 172, C.z + 86, 1.2, 0.85);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU;
    placeModel(i % 2 ? 'v_barrel' : 'v_crate', C.x + Math.cos(a) * 210, C.z + Math.sin(a) * 190, a, 1);
  }
  placeModel('v_bench_1', C.x + 30, C.z + 55, 2.6, 1);
  placeModel('v_bench_1', C.x - 35, C.z + 48, -2.6, 1);
  // cercas do perímetro (arcos)
  for (let a = 0; a < TAU; a += 0.24) {
    const rr2 = 300 + Math.sin(a * 3) * 18;
    const x = C.x + Math.cos(a) * rr2, z = C.z + Math.sin(a) * rr2;
    if (groundH(x, z) < 2) continue;
    placeModel('v_fence', x, z, -a + Math.PI / 2, 1);
  }
  // fogueira central
  const fire = placeModel('v_bonfire_lit', C.x + 15, C.z + 15, 0, 1);
  if (fire) {
    const light = new THREE.PointLight(0xff7a2a, 1.25, 60, 2);
    light.position.set(C.x + 15, groundH(C.x + 15, C.z + 15) + 2.4, C.z + 15);
    scene.add(light);
    bonfire.light = light;
  }
  // postes de luz em terreno SECO (exige h alto o bastante)
  lampPosts.length = 0;
  let placed = 0;
  for (let a = 0; a < TAU && placed < 14; a += 0.12) {
    for (let r = 40; r <= 260 && placed < 14; r += 26) {
      const x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r;
      const h = groundH(x, z);
      if (h < WATER_Y + 1.2) continue;
      const lm = lampPostMesh();
      lm.position.set(x, h, z);
      scene.add(lm);
      lampPosts.push({ x, z, y: h + 5.4, headMat: lm.userData.headMat, glow: lm.userData.glow });
      placed++;
      break;
    }
  }
  buildLampLights();
}
/* poste de luz próprio (GLB não traz poste; poste novo em madeira/ferro) */
function lampPostMesh() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.85, metalness: 0.25 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 5.6, 8), dark);
  post.position.y = 2.8;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.14), dark);
  arm.position.set(0.42, 5.5, 0);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xff9b3d, emissiveIntensity: 0.4, roughness: 0.6 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.55), headMat);
  head.position.set(0.85, 5.15, 0);
  g.add(post, arm, head);
  g.userData.headMat = headMat;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffc070, transparent: true, opacity: 0.0, depthWrite: false }));
  glow.position.set(0.85, 5.15, 0);
  glow.scale.setScalar(2.6);
  g.add(glow);
  g.userData.glow = glow;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
const lampPosts = [];
const lampLights = [];
function buildLampLights() {
  for (const l of lampPosts) {
    const pl = new THREE.PointLight(0xffa04d, 0.0, 26, 2);
    pl.position.set(l.x, l.y, l.z);
    scene.add(pl);
    lampLights.push(pl);
  }
}

/* ---------------- fumaça / partículas baratas ---------------- */
function makeSoftParticles(n, color, size, area, yBase) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * area;
    pos[i * 3 + 1] = Math.random() * yBase;
    pos[i * 3 + 2] = (Math.random() - 0.5) * area;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color, size, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

/* ---------------- personagens (GLB + fallback procedural) ---------------- */
const HUMAN_MODELS = ['mage', 'rogue', 'roguehooded', 'barbarian'];
function fallbackHuman(hue) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d68, roughness: 0.75 });
  const cloth = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, 0.5, 0.32), roughness: 0.85 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 8), cloth);
  torso.position.y = 1.32;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), skin);
  head.position.y = 2.18;
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.7, 4, 8), cloth);
  legL.position.set(-0.2, 0.55, 0);
  const legR = legL.clone(); legR.position.x = 0.2;
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.6, 4, 8), cloth);
  armL.position.set(-0.55, 1.35, 0);
  const armR = armL.clone(); armR.position.x = 0.55;
  g.add(torso, head, legL, legR, armL, armR);
  return g;
}
function makeChar(modelKey, hue) {
  const wrapper = new THREE.Group();
  let inner = null, isGLTF = false, actions = null, mixer = null;
  if (modelKey && GLB.cache[modelKey]) {
    inner = GLB.clone(modelKey);
    isGLTF = !!inner;
  }
  if (!inner) inner = fallbackHuman(hue == null ? Math.random() : hue);
  wrapper.add(inner);
  const api = {
    g: wrapper, inner, isGLTF, mixer: null, actions: null,
    clips: isGLTF ? GLB.cache[modelKey].clips : null,
    play(name, fade) {
      if (!this.mixer || !this.clips) return;
      const clip = THREE.AnimationClip.findByName(this.clips, name)
        || this.clips.find(c => c.name.toLowerCase().indexOf(name.toLowerCase()) === 0);
      if (!clip) return;
      const next = this.mixer.clipAction(clip);
      if (this.current === next && next.isRunning()) return;
      next.reset();
      next.fadeIn(fade == null ? 0.18 : fade);
      next.play();
      if (this.current && this.current !== next) this.current.fadeOut(0.18);
      this.current = next;
    }
  };
  if (isGLTF) {
    mixer = new THREE.AnimationMixer(inner);
    api.mixer = mixer;
    api.play('Idle', 0);
  }
  return api;
}

/* ---------------- animais ---------------- */
function makeAnimal(key, x, z, scale) {
  const a = makeChar(key, 0.3);
  a.g.position.set(x, groundH(x, z), z);
  a.g.scale.setScalar(scale || 1);
  scene.add(a.g);
  return {
    a, x, z, homeX: x, homeZ: z, dir: Math.random() * TAU,
    speed: 0, state: 'idle', timer: Math.random() * 4, hp: 1, flee: 0
  };
}
const animals = [];
function spawnAnimals() {
  const spots = [
    ['deer', 420, -260, 1], ['stag', 460, -320, 1], ['deer', -420, -340, 1],
    ['fox', -260, 320, 1], ['wolf', 720, 240, 1], ['shibainu', 120, 260, 0.9],
    ['husky', -180, 60, 1], ['alpaca', 300, 420, 1], ['deer', -620, -180, 1],
    ['fox', -820, -420, 1], ['wolf', 900, -620, 1], ['stag', -1100, -300, 1]
  ];
  for (const [k, dx, dz, s] of spots) {
    let placed = false;
    for (let a = 0; a < 18 && !placed; a++) {
      const ox = dx + (a ? Math.cos(a * 1.37) * (60 + a * 26) : 0), oz = dz + (a ? Math.sin(a * 1.37) * (60 + a * 26) : 0);
      const x = VILLAGE.x + ox, z = VILLAGE.z + oz;
      const h = groundH(x, z);
      if (h > 1.2 && h < 55) { animals.push(makeAnimal(k, x, z, s)); placed = true; }
    }
  }
}
function tickAnimals(dt, t) {
  const camDist = QUAL.npcDist;
  for (const an of animals) {
    const d = wdist(an.x, an.z, hero.pos.x, hero.pos.z);
    if (d > camDist) continue;
    const hd = wdist(an.x, an.z, hero.pos.x, hero.pos.z);
    if (hd < 26 && hero.speed > 5) an.flee = 3;
    if (an.flee > 0) {
      an.flee -= dt;
      const ang = Math.atan2(an.z - hero.pos.z, an.x - hero.pos.x);
      an.dir += (ang - an.dir) * 0.1;
      an.speed = 7;
      an.state = 'run';
    } else {
      an.timer -= dt;
      if (an.timer <= 0) {
        an.timer = 2 + Math.random() * 5;
        if (Math.random() < 0.5) { an.speed = 0; an.state = 'idle'; }
        else { an.speed = 1.4 + Math.random() * 1.2; an.state = 'walk'; an.dir += (Math.random() - 0.5) * 2.2; }
      }
      const dh = wdist(an.x, an.z, an.homeX, an.homeZ);
      if (dh > 220) {
        const back = Math.atan2(an.homeZ - an.z, an.homeX - an.x);
        an.dir += (back - an.dir) * 0.04;
        an.speed = Math.max(an.speed, 1.6);
      }
    }
    if (an.speed > 0) {
      an.x += Math.cos(an.dir) * an.speed * dt;
      an.z += Math.sin(an.dir) * an.speed * dt;
      const h = groundH(an.x, an.z);
      if (h < 1.0) { an.dir += Math.PI * 0.6; }
    }
    const ang2 = Math.atan2(Math.cos(an.dir), Math.sin(an.dir));
    an.a.g.rotation.y = damp(an.a.g.rotation.y, an.dir + Math.PI / 2, 6, dt);
    an.a.g.position.set(an.x, groundH(an.x, an.z), an.z);
    if (an.a.mixer) {
      an.a.mixer.update(dt * (an.state === 'run' ? 1.25 : 1));
      an.a.play(an.state === 'run' ? 'Running_A' : an.state === 'walk' ? 'Walking_A' : 'Idle', 0.25);
    }
  }
}

/* ---------------- cavalos montáveis ---------------- */
const horses = [];
function spawnHorses() {
  const spots = [[220, 130], [246, 152], [-260, -320]];
  for (let i = 0; i < spots.length; i++) {
    const [dx, dz] = spots[i];
    const x = VILLAGE.x + dx, z = VILLAGE.z + dz;
    const a = makeChar('horse', 0.1);
    a.g.position.set(x, groundH(x, z), z);
    scene.add(a.g);
    horses.push({
      a, x, z, dir: 0.6 + i, speed: 0, ridden: false,
      hunger: 60 + Math.random() * 30, thirst: 60 + Math.random() * 30,
      homeX: x, homeZ: z, name: ['Trovão', 'Sombra', 'Névoa'][i] || 'Cavalo'
    });
  }
}
function tickHorses(dt, t) {
  for (const h of horses) {
    if (h.hunger > 0) h.hunger -= dt * 0.55;
    if (h.thirst > 0) h.thirst -= dt * 0.75;
    if (hero.mounted === h) {
      h.a.g.position.set(hero.pos.x, groundH(hero.pos.x, hero.pos.z), hero.pos.z);
      h.a.g.rotation.y = hero.yaw + Math.PI / 2;
      if (h.a.mixer) {
        h.a.mixer.update(dt * clamp(hero.speed / 6, 0.4, 1.5));
        h.a.play(hero.speed > 9 ? 'Running_A' : hero.speed > 1 ? 'Walking_A' : 'Idle', 0.2);
      }
      h.hunger -= dt * 0.15;
      continue;
    }
    const d = wdist(h.x, h.z, hero.pos.x, hero.pos.z);
    if (d < QUAL.npcDist && h.a.mixer) {
      h.timer = (h.timer || 0) - dt;
      if (h.timer <= 0) {
        h.timer = 3 + Math.random() * 6;
        h.speed = Math.random() < 0.6 ? 0 : 1.2;
        h.dir += (Math.random() - 0.5) * 1.6;
      }
      if (h.speed > 0) {
        h.x += Math.cos(h.dir) * h.speed * dt;
        h.z += Math.sin(h.dir) * h.speed * dt;
      }
      h.a.g.position.set(h.x, groundH(h.x, h.z), h.z);
      h.a.g.rotation.y = damp(h.a.g.rotation.y, h.dir + Math.PI / 2, 5, dt);
      h.a.mixer.update(dt);
      h.a.play(h.speed > 0 ? 'Walking_A' : 'Idle', 0.25);
    }
  }
}

/* ---------------- chuva + vagalumes ---------------- */
const weatherFx = {};
function buildWeatherFx() {
  // chuva
  const N = 1100;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 90;
    pos[i * 3 + 1] = Math.random() * 42;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x9db8d8, size: 0.16, transparent: true, opacity: 0.0,
    depthWrite: false
  });
  const rain = new THREE.Points(geo, mat);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  weatherFx.rain = rain;
  // vagalumes
  const M = 140;
  const g2 = new THREE.BufferGeometry();
  const p2 = new Float32Array(M * 3);
  for (let i = 0; i < M; i++) {
    p2[i * 3] = VILLAGE.x + (Math.random() - 0.5) * 640;
    p2[i * 3 + 1] = 2 + Math.random() * 6;
    p2[i * 3 + 2] = VILLAGE.z + (Math.random() - 0.5) * 640;
  }
  g2.setAttribute('position', new THREE.BufferAttribute(p2, 3));
  const ff = new THREE.Points(g2, new THREE.PointsMaterial({
    color: 0xffe9a0, size: 0.55, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  ff.frustumCulled = false;
  scene.add(ff);
  weatherFx.fireflies = ff;
}
function tickWeatherFx(dt, t) {
  const rain = weatherFx.rain;
  if (rain) {
    const on = WEATHER.rain > 0.05;
    rain.visible = on;
    rain.material.opacity = WEATHER.rain * 0.5;
    if (on) {
      rain.position.set(hero.pos.x, groundH(hero.pos.x, hero.pos.z), hero.pos.z);
      const p = rain.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - dt * (26 + (i % 5));
        if (y < 0) y = 42;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }
  }
  const ff = weatherFx.fireflies;
  if (ff) {
    const night = skyState.night;
    ff.material.opacity = night * 0.75 * (1 - WEATHER.rain);
    if (ff.material.opacity > 0.02) {
      const p = ff.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        p.setX(i, p.getX(i) + Math.sin(t * 0.7 + i) * dt * 1.4);
        p.setY(i, clamp(p.getY(i) + Math.cos(t * 0.9 + i * 1.7) * dt * 0.8, 1, 10));
        p.setZ(i, p.getZ(i) + Math.cos(t * 0.5 + i * 2.1) * dt * 1.4);
      }
      p.needsUpdate = true;
    }
  }
}
