/* ============================================================
   ANDORA — parte 3: gameplay
   Herói, câmera, NPCs com diálogos ramificados, missões,
   6 finais, save/worlds, qualidade adaptativa, loop principal.
   ============================================================ */

/* ---------------- cena / renderer / luzes ---------------- */
const WATER_Y = 0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.25, 5200);
camera.position.set(0, 30, 40);
const renderer = new THREE.WebGLRenderer({
  antialias: (navigator.hardwareConcurrency || 6) >= 6 && !('ontouchstart' in window),
  powerPreference: 'high-performance', stencil: false
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('c').appendChild(renderer.domElement);

const texDetail = makeNoiseTex(256, (x, s) => {
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const g = 108 + Math.random() * 80 | 0;
    x.fillStyle = `rgb(${g},${g},${g})`;
    x.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 5, 2 + Math.random() * 5);
  }
});

const sun = new THREE.DirectionalLight(0xfff1dc, 1.1);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -85; sun.shadow.camera.right = 85;
sun.shadow.camera.top = 85; sun.shadow.camera.bottom = -85;
sun.shadow.camera.near = 40; sun.shadow.camera.far = 420;
sun.shadow.bias = -0.0012;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbfd8e8, 0x4a5a3a, 0.75);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8ea8d8, 0.0);
moon.position.set(-200, 260, 120);
scene.add(moon);
scene.fog = new THREE.FogExp2(0xbfd8e8, 0.0011);

/* ---------------- qualidade adaptativa ---------------- */
const QUAL = {
  level: 2, grass: 1500, grassR: 66, npcDist: 240, rain: 1100,
  frames: 0, acc: 0, bad: 0, good: 0
};
function applyQual() {
  const q = QUAL.level;
  renderer.setPixelRatio(Math.min(devicePixelRatio, q >= 2 ? 1.5 : q === 1 ? 1.2 : 1));
  renderer.shadowMap.enabled = q >= 1;
  sun.castShadow = q >= 1;
  QUAL.grass = q >= 2 ? 850 : q === 1 ? 420 : 180;
  QUAL.grassR = q >= 2 ? 66 : q === 1 ? 48 : 32;
  QUAL.npcDist = q >= 2 ? 240 : q === 1 ? 170 : 110;
}
function qualWatchdog(dt) {
  QUAL.acc += dt; QUAL.frames++;
  if (QUAL.acc < 2.2) return;
  const fps = QUAL.frames / QUAL.acc;
  QUAL.acc = 0; QUAL.frames = 0;
  if (fps < 30) { QUAL.bad++; QUAL.good = 0; }
  else if (fps > 50) { QUAL.good++; QUAL.bad = 0; }
  else { QUAL.bad = 0; QUAL.good = 0; }
  if (QUAL.bad >= 1 && QUAL.level > 0) {
    QUAL.level--; applyQual();
    if (GrassField.im) { scene.remove(GrassField.im); GrassField.im = null; GrassField.init(); }
  } else if (QUAL.good >= 4 && QUAL.level < 2) {
    QUAL.level++; applyQual();
    if (GrassField.im) { scene.remove(GrassField.im); GrassField.im = null; GrassField.init(); }
    QUAL.good = 0;
  }
}

/* ---------------- estado do jogo / save ---------------- */
const SKEY = 'andora-worlds-v2';
const state = {
  flags: {}, quests: { q1: 0, q2: 0, q3: 0 }, achv: {}, inv: { fish: 0, flower: 0, ore: 0, seed: 0 },
  rep: 0, hour: 9.2, day: 1, ending: null, talkedTo: {}, seed: 20261
};
const hero = {
  pos: new THREE.Vector3(VILLAGE.x - 8, 12, VILLAGE.z + 78), yaw: Math.PI, pitch: 0.30,
  speed: 0, vy: 0, onGround: true, mounted: null, camDist: 11, moving: false,
  fishing: 0
};
const colliders = [];
const bonfire = { light: null };
const WEATHER = { rain: 0, target: 0, wind: 0.3, state: 'clear', timer: 40 };
const skyState = { night: 0 };

function saveWorld(slot) {
  const w = {
    seed: WORLD_SEED, x: hero.pos.x, z: hero.pos.z, yaw: hero.yaw,
    hour: state.hour, day: state.day, flags: state.flags, quests: state.quests,
    achv: state.achv, inv: state.inv, rep: state.rep, ending: state.ending,
    horse: hero.mounted ? { hunger: hero.mounted.hunger, thirst: hero.mounted.thirst } : null,
    at: Date.now()
  };
  try {
    const all = JSON.parse(localStorage.getItem(SKEY) || '{}');
    all[slot || 'slot1'] = w;
    localStorage.setItem(SKEY, JSON.stringify(all));
    return true;
  } catch (e) { return false; }
}
function listWorlds() {
  try { return JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch (e) { return {}; }
}
function loadWorld(slot) {
  const all = listWorlds();
  const w = all[slot];
  if (!w) return false;
  WORLD_SEED = w.seed || 20261;
  bakeHeightmap();
  hero.pos.set(w.x || VILLAGE.x, groundH(w.x || VILLAGE.x, w.z || VILLAGE.z) + 2, w.z || VILLAGE.z);
  hero.yaw = w.yaw || 0;
  state.hour = w.hour == null ? 9.2 : w.hour;
  state.day = w.day || 1;
  state.flags = w.flags || {};
  state.quests = w.quests || { q1: 0, q2: 0, q3: 0 };
  state.achv = w.achv || {};
  state.inv = w.inv || { fish: 0, flower: 0, ore: 0, seed: 0 };
  state.rep = w.rep || 0;
  state.ending = w.ending || null;
  updateTerrain(hero.pos.x, hero.pos.z);
  Nature.scatter();
  return true;
}
function newWorld(seed) {
  WORLD_SEED = seed || (20261 + ((Math.random() * 90000) | 0));
  bakeHeightmap();
  hero.pos.set(VILLAGE.x - 8, groundH(VILLAGE.x - 8, VILLAGE.z + 78) + 2, VILLAGE.z + 78);
  hero.yaw = Math.PI;
  state.flags = {}; state.quests = { q1: 0, q2: 0, q3: 0 };
  state.achv = {}; state.inv = { fish: 0, flower: 0, ore: 0, seed: 0 };
  state.rep = 0; state.hour = 9.2; state.day = 1; state.ending = null;
  updateTerrain(hero.pos.x, hero.pos.z);
  Nature.scatter();
}

/* ---------------- sol / ciclo de tempo ---------------- */
function tickSky(dt) {
  state.hour += dt / 60; // 1 hora de jogo por minuto real
  if (state.hour >= 24) { state.hour -= 24; state.day++; }
  const h = state.hour;
  const ang = ((h - 6) / 12) * Math.PI; // 6h nasce, 18h se põe
  const elev = Math.sin(ang);
  const az = (h / 24) * TAU + 2.2;
  const sd = new THREE.Vector3(Math.cos(az) * Math.cos(Math.asin(clamp(elev, -1, 1))), Math.abs(elev) * 0.92 + 0.08, Math.sin(az) * 0.7).normalize();
  const sunDir = new THREE.Vector3(Math.cos(az), elev, Math.sin(az) * 0.75).normalize();
  skyUniforms.uSunDir.value.copy(sunDir);
  skyUniforms.uTime.value += dt;
  const night = smoothstep(0.08, -0.14, elev);
  skyState.night = night;
  skyUniforms.uNight.value = night;
  // cores do céu por hora
  const dayTop = new THREE.Color(0x2c6fc0), duskTop = new THREE.Color(0x3b2c62), nightTop = new THREE.Color(0x081226);
  const dayHor = new THREE.Color(0xc4dcea), duskHor = new THREE.Color(0xf2996a), nightHor = new THREE.Color(0x1a2740);
  const dusk = smoothstep(0.22, 0.02, Math.abs(elev)) * (1 - night * 0.6);
  const top = dayTop.clone().lerp(duskTop, dusk).lerp(nightTop, night);
  const hor = dayHor.clone().lerp(duskHor, dusk).lerp(nightHor, night);
  skyUniforms.uTop.value.copy(top);
  skyUniforms.uHorizon.value.copy(hor);
  skyUniforms.uSunCol.value.setHex(elev < 0.12 ? 0xffb27a : 0xfff2dc).lerp(new THREE.Color(0x8aa6d8), night * 0.7);
  skyUniforms.uCloud.value = 0.35 + WEATHER.rain * 0.5 + (WEATHER.state === 'cloudy' ? 0.35 : 0);
  skyUniforms.uFog.value.copy(hor);
  scene.fog.color.copy(hor);
  scene.fog.density = 0.00078 + WEATHER.rain * 0.00075 + night * 0.0004;
  // sol direcional
  sun.position.copy(hero.pos).add(sunDir.clone().multiplyScalar(180));
  sun.target.position.copy(hero.pos);
  sun.intensity = clamp(elev * 1.5, 0, 1.25) * (1 - WEATHER.rain * 0.55) + 0.05;
  sun.color.copy(skyUniforms.uSunCol.value);
  moon.intensity = night * 0.16 * (1 - WEATHER.rain * 0.6);
  hemi.intensity = 0.36 + 0.5 * (1 - night) * (1 - WEATHER.rain * 0.4);
  hemi.color.copy(hor);
  hemi.groundColor.setHex(night > 0.5 ? 0x131d33 : 0x4a5a3a);
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
  }
}

/* ---------------- clima ---------------- */
function tickWeather(dt) {
  WEATHER.timer -= dt;
  if (WEATHER.timer <= 0) {
    const roll = Math.random();
    if (WEATHER.state === 'clear') {
      WEATHER.state = roll < 0.55 ? 'cloudy' : 'rain';
      WEATHER.timer = 45 + Math.random() * 60;
    } else if (WEATHER.state === 'cloudy') {
      WEATHER.state = roll < 0.5 ? 'rain' : 'clear';
      WEATHER.timer = 40 + Math.random() * 50;
    } else {
      WEATHER.state = 'clear';
      WEATHER.timer = 70 + Math.random() * 80;
    }
    UI.toast('O tempo está ' + (WEATHER.state === 'rain' ? 'chuvoso ☔' : WEATHER.state === 'cloudy' ? 'nublado ☁' : 'limpo ☀'));
  }
  WEATHER.target = WEATHER.state === 'rain' ? 1 : 0;
  WEATHER.rain = damp(WEATHER.rain, WEATHER.target, 0.5, dt);
  WEATHER.wind = damp(WEATHER.wind, 0.2 + WEATHER.rain * 0.7 + (WEATHER.state === 'cloudy' ? 0.25 : 0), 0.4, dt);
}

/* ---------------- input ---------------- */
const keys = {};
const input = { mx: 0, my: 0, joyX: 0, joyY: 0, run: false, dragging: false, lastX: 0, lastY: 0 };
function bindInput() {
  addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    keys[e.code] = true;
    Audio2.resume(); Audio2.start();
    if (e.code === 'KeyE') interact();
    if (e.code === 'KeyQ') toggleMount();
    if (e.code === 'Space') { e.preventDefault(); jump(); }
    if (e.code === 'Escape') { if (dlgOpen) closeDialogue(); else UI.togglePause(); }
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  const cv = renderer.domElement;
  cv.addEventListener('mousedown', e => { input.dragging = true; input.lastX = e.clientX; input.lastY = e.clientY; });
  addEventListener('mouseup', () => input.dragging = false);
  addEventListener('mousemove', e => {
    if (!input.dragging) return;
    hero.yaw -= (e.clientX - input.lastX) * 0.0062;
    hero.pitch = clamp(hero.pitch + (e.clientY - input.lastY) * 0.0042, 0.05, 1.05);
    input.lastX = e.clientX; input.lastY = e.clientY;
  });
  cv.addEventListener('wheel', e => {
    hero.camDist = clamp(hero.camDist + e.deltaY * 0.012, 5.5, 22);
    e.preventDefault();
  }, { passive: false });
  // touch: joystick virtual + olhar + botões
  const joy = document.getElementById('joy');
  if (joy) {
    let jid = null, jcx = 0, jcy = 0;
    joy.addEventListener('touchstart', e => {
      const t = e.changedTouches[0];
      jid = t.identifier; jcx = t.clientX; jcy = t.clientY;
      e.preventDefault();
    }, { passive: false });
    joy.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== jid) continue;
        input.joyX = clamp((t.clientX - jcx) / 52, -1, 1);
        input.joyY = clamp((t.clientY - jcy) / 52, -1, 1);
      }
      e.preventDefault();
    }, { passive: false });
    const jend = e => { input.joyX = input.joyY = 0; jid = null; };
    joy.addEventListener('touchend', jend);
    joy.addEventListener('touchcancel', jend);
  }
  const look = document.getElementById('look');
  if (look) {
    let lid = null, lx = 0, ly = 0;
    look.addEventListener('touchstart', e => {
      const t = e.changedTouches[0];
      lid = t.identifier; lx = t.clientX; ly = t.clientY;
    }, { passive: true });
    look.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lid) continue;
        hero.yaw -= (t.clientX - lx) * 0.0072;
        hero.pitch = clamp(hero.pitch + (t.clientY - ly) * 0.0042, 0.05, 1.05);
        lx = t.clientX; ly = t.clientY;
      }
    }, { passive: true });
    look.addEventListener('touchend', () => lid = null);
  }
  const btn = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => { Audio2.resume(); Audio2.start(); fn(); });
  };
  btn('b-interact', interact);
  btn('b-jump', jump);
  btn('b-mount', toggleMount);
  btn('b-run', () => { input.run = !input.run; UI.toast(input.run ? 'Corrida ligada 🏃' : 'Corrida desligada'); });
}
function jump() {
  if (hero.mounted) return;
  if (hero.onGround) {
    hero.vy = 9.6;
    hero.onGround = false;
    Audio2.chirp(180, 0.12, 0.05);
    achv('jump');
  }
}

/* ---------------- movimento do herói ---------------- */
function tickHero(dt) {
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - input.joyY;
  const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + input.joyX;
  const run = keys.ShiftLeft || keys.ShiftRight || input.run;
  const mag = Math.min(1, Math.hypot(f, s));
  const inWater = groundH(hero.pos.x, hero.pos.z) < -1.1;
  let speed = hero.mounted ? (run ? 17 : 11) : (run ? 11.2 : 6.4);
  if (inWater && !hero.mounted) speed = 3.6;
  if (mag > 0.05) {
    const ang = Math.atan2(f, s) + hero.yaw;
    const nx = hero.pos.x + Math.cos(ang) * speed * mag * dt;
    const nz = hero.pos.z + Math.sin(ang) * speed * mag * dt;
    // colisão simples
    let bx = nx, bz = nz;
    for (const c of colliders) {
      const dx = bx - c.x, dz = bz - c.z;
      const d2 = dx * dx + dz * dz;
      const rr2 = c.r * c.r;
      if (d2 < rr2 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        bx = c.x + dx / d * c.r; bz = c.z + dz / d * c.r;
      }
    }
    hero.pos.x = bx; hero.pos.z = bz;
    hero.speed = speed * mag;
    hero.moving = true;
    hero._stepT = (hero._stepT || 0) + dt * (run ? 2.4 : 1.6) * mag;
    if (hero._stepT > 1) {
      hero._stepT = 0;
      Audio2.step(run && !hero.mounted);
      achv('walk');
    }
  } else {
    hero.speed = damp(hero.speed, 0, 8, dt);
    hero.moving = false;
  }
  // física vertical
  const gy = groundH(hero.pos.x, hero.pos.z);
  if (inWater && !hero.mounted) {
    hero.pos.y = damp(hero.pos.y, -0.15, 4, dt);
    hero.vy = 0;
    hero.onGround = true;
  } else {
    hero.vy -= 26 * dt;
    hero.pos.y += hero.vy * dt;
    const floor = gy + (hero.mounted ? 1.1 : 1.7);
    if (hero.pos.y <= floor) {
      if (!hero.onGround && hero.vy < -8) Audio2.chirp(90, 0.1, 0.06);
      hero.pos.y = floor;
      hero.vy = 0;
      hero.onGround = true;
    } else hero.onGround = false;
  }
  // aviso de beira do mundo é desnecessário: mundo é infinito (wrap visual)
  // animação do herói (ou do cavalo em tickHorses)
  if (hero.mounted) {
    hero.mounted.x = hero.pos.x; hero.mounted.z = hero.pos.z;
    hero.mounted.hunger = Math.max(0, hero.mounted.hunger);
    hero.mounted.thirst = Math.max(0, hero.mounted.thirst);
    if (hero.mounted.hunger < 12) speed *= 0.75;
    if (hero.mounted.thirst < 12) speed *= 0.85;
    if (hero.char) hero.char.g.visible = false;
  } else if (hero.char && hero.char.mixer) {
    hero.char.g.visible = true;
    hero.char.mixer.update(dt * (run ? 1.35 : 1) * (hero.moving ? 1 : 0.85));
    const clip = !hero.onGround ? 'Jump_Full_Short'
      : inWater ? 'Walking_A'
      : hero.moving ? (run ? 'Running_A' : 'Walking_A') : 'Idle';
    hero.char.play(clip, 0.2);
    hero.char.g.rotation.y = damp(hero.char.g.rotation.y, hero.yaw + Math.PI / 2, 12, dt);
    hero.char.g.position.copy(hero.pos).y -= 1.7;
    if (inWater) hero.char.g.position.y -= 0.55;
  }
  achv('move');
}

/* ---------------- câmera ---------------- */
function tickCamera(dt) {
  const isTouch = 'ontouchstart' in window;
  const dist = Math.max(hero.camDist, isTouch ? 9.5 : 6);
  const px = hero.pos.x - Math.sin(hero.yaw) * Math.cos(hero.pitch) * dist;
  const pz = hero.pos.z - Math.cos(hero.yaw) * Math.cos(hero.pitch) * dist;
  const py = hero.pos.y + Math.sin(hero.pitch) * dist * 0.92 + 1.6;
  camera.position.x = damp(camera.position.x, px, 7, dt);
  camera.position.y = damp(camera.position.y, Math.max(py, groundH(px, pz) + 1.6), 7, dt);
  camera.position.z = damp(camera.position.z, pz, 7, dt);
  camera.lookAt(hero.pos.x, hero.pos.y + 1.5, hero.pos.z);
  const wantFov = hero.mounted ? 66 : runFov();
  camera.fov = damp(camera.fov, wantFov, 4, dt);
  camera.updateProjectionMatrix();
}
function runFov() {
  return (keys.ShiftLeft || keys.ShiftRight || input.run) && hero.moving ? 64 : 58;
}

/* ---------------- diálogo / NPCs ---------------- */
let dlgOpen = false, dlgNPC = null, dlgNode = null;
function N(text, choices, on) { return { text, choices: choices || [], on }; }
function C(t, goto, fx, req) { return { t, goto, fx, req }; }

const NPCS = [
  {
    id: 'moira', name: 'Moira', role: 'curandeira', model: 'mage', hue: 0.32,
    x: -60, z: -30,
    tree: () => ({
      start: N('Oi! Você deve ser o viajante que andaram falando. Eu sou a Moira, curandeira do vale. Bem-vindo a Andora.', [
        C('Onde eu tô exatamente?', 'where'),
        C('Falam de mim por quê?', 'rumor'),
        C('Tchau!', null)
      ]),
      where: N('Andora é um vale esquecido pelo mundo. As pessoas vêm pra cá pra descansar... ou pra fugir. O lago ao sul é o coração do lugar.', [
        C('O que tem de especial no lago?', 'lake'),
        C('Quem manda aqui?', 'chief'),
        C('Até mais')
      ]),
      lake: N('As lanternas acendem sozinhas toda noite na beira do lago. Ninguém sabe por quê. A vovó Selma diz que é a "luz de quem partiu".', [
        C('Vou investigar isso', null, () => { setQuest('q1', Math.max(state.quests.q1, 1)); }),
        C('Estranho...')
      ]),
      chief: N('Ninguém manda, ué. Aqui a gente se resolve na conversa. Se precisar de ferramentas, fala com o Breno, o ferreiro.', [
        C('Valeu!', null)
      ]),
      rumor: N('Dizem que alguém chegou há anos procurando uma irmã desaparecida... e nunca mais saiu. Você me lembra essa pessoa.', [
        C('Eu procuro minha irmã, Elara', 'elara'),
        C('Coincidência...')
      ]),
      elara: N('Elara... esse nome ecoa no vale. Fala com a vovó Selma — ela sabe coisas que a gente prefere esquecer.', [
        C('Obrigado', null, () => { setQuest('q1', Math.max(state.quests.q1, 1)); })
      ])
    })
  },
  {
    id: 'selma', name: 'Selma', role: 'a guardiã das memórias', model: 'roguehooded', hue: 0.12,
    x: -150, z: 80,
    tree: () => ({
      start: N('...Você tem os olhos de quem procura. Senta aqui, filho. Eu sou a Selma, e eu lembro de tudo.', [
        C('O que você sabe sobre Elara?', 'elara', null, () => state.quests.q1 >= 1),
        C('Por que as lanternas acendem?', 'lanterns'),
        C('Só passando')
      ]),
      elara: N('Elara chegou num inverno frio, chorando o nome de alguém. Ela caminhou até o lago... e o lago acendeu. Desde aquela noite, a luz dela virou parte de Andora.', [
        C('Ela... morreu?', 'dead'),
        C('Tem como trazê-la de volta?', 'back')
      ]),
      dead: N('Ninguém morre de verdade aqui. Quem o lago acolhe, vira luz. As lanternas são os abraços que ela não pode mais dar.', [
        C('Preciso pensar', null, () => { state.flags.selma = 1; setQuest('q1', Math.max(state.quests.q1, 2)); }),
      ]),
      back: N('Talvez. Se você encontrar a Flor de Andora — a semente da primeira árvore — e plantá-la de novo... o lago pode te escutar.', [
        C('Onde encontro essa flor?', 'flower')
      ]),
      flower: N('A Lia, a botânica, procura ela há anos. Ou... olhe dentro da cachoeira ao nascer do sol.', [
        C('Vou procurar', null, () => { state.flags.flowerHint = 1; setQuest('q2', Math.max(state.quests.q2, 1)); })
      ]),
      lanterns: N('Toda luz aqui é uma história que alguém deixou pra trás. Acender as lanternas é o jeito do vale dizer "eu lembro de você".', [
        C('Que lindo...', null, () => { state.rep += 2; }),
        C('Esquisito')
      ])
    })
  },
  {
    id: 'lyra', name: 'Lyra', role: 'pescadora', model: 'rogue', hue: 0.55,
    x: -520, z: -380,
    tree: () => ({
      start: N('Ei, você! Cuidado pra não cair no lago. Eu sou a Lyra, pesco aqui desde criança. Quer uma vara?', [
        C('Quero pescar!', 'fish'),
        C('Você conheceu Elara?', 'elara', null, () => state.quests.q1 >= 2),
        C('Só olhando')
      ]),
      fish: N('Toma, uma vara de bambu. Fica na beira da água e espera. Quando a bóia tremer, puxa! Mas não pesque demais — o lago gosta de gente educada.', [
        C('Obrigado!', null, () => { state.inv.rod = 1; achv('rod'); }),
      ]),
      elara: N('Elara? A moça dos olhos tristes? Ela sentava naquela pedra toda noite, falando com a água. Um dia... a água respondeu.', [
        C('Ela tá bem?', null, () => { state.flags.lyra = 1; state.rep += 2; }),
      ])
    })
  },
  {
    id: 'breno', name: 'Breno', role: 'ferreiro', model: 'barbarian', hue: 0.02,
    x: 90, z: -110,
    tree: () => ({
      start: N('*martelando* ...Já volto. É, Breno, ferreiro, forjando prego e esperança desde sempre. O que você precisa?', [
        C('Você forja algo especial?', 'forge'),
        C('Preciso de minério', 'ore'),
        C('Nada, valeu')
      ]),
      forge: N('Ferramentas, ferraduras, panela... e, se tiver minério da montanha, algo que protege contra o escuro. Mas ninguém busca o minério mais.', [
        C('Eu busco', null, () => { setQuest('q3', Math.max(state.quests.q3, 1)); })
      ]),
      ore: N('Na montanha ao nordeste, tem veios azuis brilhando nas pedras. Pega um pedaço e eu te faço uma lâmina de guardião.', [
        C('Já volto', null, () => { setQuest('q3', Math.max(state.quests.q3, 1)); })
      ])
    })
  },
  {
    id: 'lia', name: 'Lia', role: 'botânica', model: 'mage', hue: 0.38,
    x: -110, z: 110,
    tree: () => ({
      start: N('Shh! Tem uma samambaia aqui que só floresce quando... ah, oi. Eu sou a Lia. Estudo as plantas de Andora.', [
        C('Me falaram da Flor de Andora', 'flower', null, () => state.flags.flowerHint),
        C('Plantas que florescem sozinhas?', 'fern'),
        C('Desculpa atrapalhar')
      ]),
      flower: N('A lendária! Dizem que é uma semente que brilha. Se você plantar ela no monte da vila, o vale pode renascer. Tome — eu guardei uma muda.', [
        C('Vou plantar!', null, () => { state.inv.seed = 1; setQuest('q2', Math.max(state.quests.q2, 2)); achv('seed'); })
      ]),
      fern: N('Aqui tudo cresce estranho. O solo do vale tem memória. As árvores lembram de quem plantou.', [
        C('Que lugar esquisito', null, () => { state.rep += 1; })
      ])
    })
  },
  {
    id: 'tomas', name: 'Tomás', role: 'lenhador', model: 'barbarian', hue: 0.28,
    x: 150, z: 150,
    tree: () => ({
      start: N('*encostado no machado* Corto madeira há vinte anos. Nessa terra, as árvores crescem rápido demais pra ser normal.', [
        C('Rápido como assim?', 'fast'),
        C('Precisa de ajuda?', 'help'),
        C('Boa sorte')
      ]),
      fast: N('Cortei um pinheiro ontem e hoje tinha outro no mesmo lugar. A Lia diz que é "o solo com memória". Eu digo que é assombração.', [
        C('Interessante...', null, () => { state.rep += 1; })
      ]),
      help: N('Se você plantar alguma coisa no monte da vila, me avisa. Curto ver coisa nova crescendo.', [
        C('Combinado', null, () => { state.flags.tomas = 1; })
      ])
    })
  },
  {
    id: 'amara', name: 'Amara', role: 'mercadora', model: 'rogue', hue: 0.95,
    x: -40, z: 60,
    tree: () => ({
      start: N('Bem-vindo à minha banca! Não tenho muito, mas o que tenho é honesto. Você parece alguém que sabe o que quer.', [
        C('Como é a vida aqui?', 'life'),
        C('Tem notícias do mundo lá fora?', 'news'),
        C('Só dando uma olhada')
      ]),
      life: N('Devagar. Perigoso devagar, na verdade. Mas ninguém aqui tem pressa de morrer.', [
        C('Justo')
      ]),
      news: N('O mundo lá fora anda estranho. Por isso tanta gente vem pra Andora. Só não deixa o lago saber que você tem saudade.', [
        C('Por quê?', 'why')
      ]),
      why: N('O lago alimenta de saudade. E volta em forma de luz.', [
        C('...', null, () => { state.flags.amara = 1; })
      ])
    })
  },
  {
    id: 'ivo', name: 'Ivo', role: 'pastor', model: 'roguehooded', hue: 0.65,
    x: 260, z: 240,
    tree: () => ({
      start: N('Bom dia! As ovelhas hoje tão calmas. Quando elas miem demais, é chuva — ou coisa pior.', [
        C('Coisa pior?', 'worse'),
        C('Gosto daqui', 'like'),
        C('Até')
      ]),
      worse: N('Teve uma noite que o lago ficou vermelho. Ninguém fala sobre isso. Nem eu.', [
        C('Entendi...', null, () => { state.flags.ivo = 1; })
      ]),
      like: N('Andora acolhe quem chega cansado. Só não acolhe quem chega com pressa.', [
        C('Vou com calma', null, () => { state.rep += 1; })
      ])
    })
  },
  {
    id: 'nara', name: 'Nara', role: 'criança curiosa', model: 'rogue', hue: 0.15,
    x: 40, z: 200,
    tree: () => ({
      start: N('OI! Você é o gigante novo?! Posso te seguir? A mamãe diz que não pra falar com estranho, mas você não parece estranho. Parece cansado.', [
        C('Sou só cansado mesmo', 'tired'),
        C('O que você faz aqui?', 'play'),
        C('Vá brincar')
      ]),
      tired: N('Então senta naquele banco! O senhor Rui toca música e aí todo mundo fica menos cansado.', [
        C('Boa ideia', null, () => { state.rep += 1; })
      ]),
      play: N('Eu conto as lanternas. Ontem tinham 12. Hoje 13. A mamãe disse pra eu não contar alto.', [
        C('Por que não?', 'why')
      ]),
      why: N('Porque quando alguém conta demais, o lago escuta.', [
        C('...', null, () => { state.flags.nara = 1; })
      ])
    })
  },
  {
    id: 'otavio', name: 'Otávio', role: 'guarda do vale', model: 'barbarian', hue: 0.08,
    x: 200, z: -40,
    tree: () => ({
      start: N('Alto. ...Ah, você é o visitante. Pode passar. Sou Otávio, guardo o vale. Não que precise de guarda.', [
        C('Guarda contra o quê?', 'guard'),
        C('Relaxa que eu sou de paz', 'peace'),
        C('Tô indo')
      ]),
      guard: N('Contra o que o lago manda de volta, às vezes. A gente só quer garantir.', [
        C('Já aconteceu?', 'happen')
      ]),
      happen: N('Uma vez. Não vou falar mais. Vai embora antes que eu precise pensar nisso.', [
        C('...', null, () => { state.flags.otavio = 1; })
      ]),
      peace: N('Paz é o que a gente tem aqui. Por isso eu fico de olho.', [
        C('Justo', null, () => { state.rep += 1; })
      ])
    })
  },
  {
    id: 'bruna', name: 'Bruna', role: 'padeira', model: 'rogue', hue: 0.82,
    x: -90, z: -90,
    tree: () => ({
      start: N('O pão acabou de sair! Come enquanto tá quente. Você tá magro demais pra um herói.', [
        C('Obrigado!', 'eat'),
        C('Herói? Eu não sou...', 'hero'),
        C('Depois eu volto')
      ]),
      eat: N('*Você come pão quente* (foi reconfortante)', [
        C('Tava ótimo', null, () => { state.rep += 2; achv('bread'); })
      ]),
      hero: N('Em Andora, quem procura alguém é herói. Quem acha... aí é outra história.', [
        C('O que você quer dizer?', null, () => { state.flags.bruna = 1; })
      ])
    })
  },
  {
    id: 'davi', name: 'Davi', role: 'mineiro', model: 'barbarian', hue: 0.42,
    x: 130, z: -220,
    tree: () => ({
      start: N('*tossindo poeira* Mineração não é pra todo mundo. Mas o minério daqui... é diferente.', [
        C('Diferente como?', 'ore'),
        C('Quer ajuda?', 'help'),
        C('Boa sorte')
      ]),
      ore: N('Ele pulsa. Tipo coração. Breno quer forjar coisa com ele, mas eu fico com medo.', [
        C('Deixa comigo', null, () => { setQuest('q3', Math.max(state.quests.q3, 1)); state.flags.davi = 1; })
      ]),
      help: N('Se você pegar minério pra Breno, pega pra mim também? Eu fico com medo lá no alto.', [
        C('Combinado', null, () => { state.rep += 1; })
      ])
    })
  },
  {
    id: 'celia', name: 'Célia', role: 'viajante', model: 'roguehooded', hue: 0.48,
    x: -200, z: -160,
    tree: () => ({
      start: N('Oi! Eu cheguei semana passada e ainda não fui embora. Dizem que isso acontece com todo mundo aqui. Eu sou a Célia.', [
        C('Por que você não foi embora?', 'stay'),
        C('O que você achou do lago?', 'lake'),
        C('Boa viagem')
      ]),
      stay: N('Porque dormi bem pela primeira vez em anos. Andora tem um jeito de segurar a gente. Tipo abraço de água.', [
        C('Abraço de água?', 'hug')
      ]),
      hug: N('É o que a Bruna chama. Quando você fica triste perto do lago, a tristeza fica menor. Não some — fica menor.', [
        C('Gostei disso', null, () => { state.rep += 2; state.flags.celia = 1; })
      ]),
      lake: N('Na primeira noite eu vi uma luz saindo da água e acenando. Juro que acenou de volta.', [
        C('Acenou de volta', null, () => { setQuest('q1', Math.max(state.quests.q1, 1)); }),
        C('Ilusão...')
      ])
    })
  },
  {
    id: 'rui', name: 'Rui', role: 'bardo', model: 'mage', hue: 0.72,
    x: 30, z: 55,
    tree: () => ({
      start: N('*acordando o alaúde* Ah, um ouvinte! Senta aí. Eu sou o Rui, contador de histórias, tocador de acordes e campeão de não fazer nada.', [
        C('Toca uma pra mim', 'song'),
        C('Me conta uma história', 'story'),
        C('Depois eu volto')
      ]),
      song: N('*Rui toca uma melodia lenta que lembra água corrente* ...', [
        C('Bonito', null, () => { state.rep += 2; achv('song'); })
      ]),
      story: N('Dizem que Andora era um rei que transformou o próprio coração em lago pra não sentir saudade. Não funcionou.', [
        C('E aí?', 'end')
      ]),
      end: N('Aí ele virou saudade de todo mundo que chegou depois. Por isso o lago acende.', [
        C('...', null, () => { state.flags.rui = 1; setQuest('q1', Math.max(state.quests.q1, 2)); })
      ])
    })
  }
];

function spawnNPCs() {
  for (const def of NPCS) {
    const ch = makeChar(def.model, def.hue);
    const x = VILLAGE.x + def.x, z = VILLAGE.z + def.z;
    ch.g.position.set(x, groundH(x, z), z);
    ch.g.rotation.y = Math.random() * TAU;
    scene.add(ch.g);
    def.char = ch;
    def.wx = x; def.wz = z;
    def.dir = Math.random() * TAU;
    def.timer = Math.random() * 4;
    def.speed = 0;
  }
}
function tickNPCs(dt, t) {
  for (const def of NPCS) {
    const ch = def.char;
    if (!ch) continue;
    const d = wdist(ch.g.position.x, ch.g.position.z, hero.pos.x, hero.pos.z);
    if (d > QUAL.npcDist) continue;
    if (dlgOpen && dlgNPC === def) {
      ch.g.lookAt(hero.pos.x, ch.g.position.y, hero.pos.z);
      if (ch.mixer) { ch.mixer.update(dt); ch.play('Idle', 0.3); }
      continue;
    }
    def.timer -= dt;
    if (def.timer <= 0) {
      def.timer = 4 + Math.random() * 7;
      def.speed = Math.random() < 0.55 ? 0 : 1.3 + Math.random() * 1.1;
      def.dir += (Math.random() - 0.5) * 2.4;
    }
    if (def.speed > 0) {
      const nx = ch.g.position.x + Math.cos(def.dir) * def.speed * dt;
      const nz = ch.g.position.z + Math.sin(def.dir) * def.speed * dt;
      if (wdist(nx, nz, def.wx, def.wz) < 46 && groundH(nx, nz) > 1.2) {
        ch.g.position.x = nx; ch.g.position.z = nz;
      } else def.dir += Math.PI * 0.7;
    }
    ch.g.position.y = groundH(ch.g.position.x, ch.g.position.z);
    if (ch.mixer) {
      ch.mixer.update(dt);
      ch.play(def.speed > 0 ? 'Walking_A' : 'Idle', 0.25);
      if (def.speed > 0) ch.g.rotation.y = damp(ch.g.rotation.y, def.dir + Math.PI / 2, 5, dt);
    }
  }
}

function nearestNPC(maxD) {
  let best = null, bd = maxD || 7;
  for (const def of NPCS) {
    if (!def.char) continue;
    const d = wdist(def.char.g.position.x, def.char.g.position.z, hero.pos.x, hero.pos.z);
    if (d < bd) { bd = d; best = def; }
  }
  return best;
}
function openDialogue(def) {
  dlgOpen = true;
  dlgNPC = def;
  if (!state.talkedTo[def.id]) {
    state.talkedTo[def.id] = 1;
    achv('talk');
    state.rep += 1;
  }
  showNode('start');
}
function showNode(key) {
  const tree = dlgNPC.tree();
  dlgNode = tree[key] || tree.start;
  if (dlgNode.on) dlgNode.on();
  const choices = dlgNode.choices.map((c, i) => ({ ...c, i })).filter(c => !c.req || c.req());
  UI.dialogue(dlgNPC.name + ' — ' + dlgNPC.role, dlgNode.text, choices.map(c => ({ t: c.t, i: c.i })), (i) => {
    const c = dlgNode.choices[i];
    if (!c) return closeDialogue();
    if (c.fx) c.fx();
    if (c.goto && dlgNPC.tree()[c.goto]) showNode(c.goto);
    else closeDialogue();
  });
}
function closeDialogue() {
  dlgOpen = false;
  dlgNPC = null;
  UI.dialogueHide();
  saveWorld('slot1');
}

/* ---------------- interações do mundo ---------------- */
function interact() {
  if (dlgOpen) return;
  Audio2.resume(); Audio2.start();
  // NPC
  const npc = nearestNPC(8.5);
  if (npc) { openDialogue(npc); return; }
  // cavalo
  for (const h of horses) {
    const d = wdist(h.x, h.z, hero.pos.x, hero.pos.z);
    if (d < 6.5 && !hero.mounted) {
      if (h.hunger < 25) { h.hunger = Math.min(100, h.hunger + 45); UI.toast(`Você alimenta ${h.name} 🌾`); return; }
      if (h.thirst < 25) { h.thirst = Math.min(100, h.thirst + 45); UI.toast(`Você dá água a ${h.name} 💧`); return; }
    }
  }
  // pesca
  const nearLake = wdist(hero.pos.x, hero.pos.z, LAKE.x, LAKE.z) < LAKE.r + 90;
  const nearPond = wdist(hero.pos.x, hero.pos.z, POND.x, POND.z) < POND.r + 50;
  if ((nearLake || nearPond) && state.inv.rod) {
    if (hero.fishing > 0) {
      if (hero.fishing < 2.2 && hero.fishing > 1.15) {
        state.inv.fish++;
        UI.toast('Pescou um peixe! 🐟 (' + state.inv.fish + ')');
        Audio2.chirp(320, 0.18, 0.09);
        achv('fish');
        hero.fishing = 0;
      } else if (hero.fishing >= 2.2) {
        UI.toast('O peixe escapou...');
        hero.fishing = 0;
      }
      return;
    }
    hero.fishing = 3.4;
    hero._tremble = false;
    UI.toast('Pescando... espera a bóia tremer e aperta E!');
    return;
  }
  // plantar semente no monte da vila
  if (state.inv.seed === 1 && wdist(hero.pos.x, hero.pos.z, VILLAGE.x, VILLAGE.z) < 70) {
    state.inv.seed = 2;
    state.quests.q2 = 3;
    state.rep += 10;
    UI.toast('Você plantou a Flor de Andora. O vale tremeu de alegra. 🌱');
    achv('planted');
    saveWorld('slot1');
    return;
  }
  // minério na montanha
  if (state.quests.q3 >= 1 && state.inv.ore < 1) {
    const md = wdist(hero.pos.x, hero.pos.z, 1250, -1500);
    if (md < 700) {
      state.inv.ore = 1;
      UI.toast('Você coletou minério pulsante. ⛏');
      achv('ore');
      return;
    }
  }
  // entregar minério
  if (state.inv.ore === 1) {
    const breno = NPCS.find(n => n.id === 'breno');
    if (breno && wdist(hero.pos.x, hero.pos.z, breno.char.g.position.x, breno.char.g.position.z) < 12) {
      state.inv.ore = 2;
      state.quests.q3 = 3;
      state.rep += 8;
      UI.toast('Breno forjou a Lâmina de Guardião. ⚔');
      achv('forged');
      return;
    }
  }
  // fogueira
  const fd = wdist(hero.pos.x, hero.pos.z, VILLAGE.x + 15, VILLAGE.z + 15);
  if (fd < 8) {
    UI.toast('Você se aquece na fogueira. 🔥');
    achv('bonfire');
    state.hour = (state.hour + 1.2) % 24;
    return;
  }
  // decisão final no lago
  const atLake = wdist(hero.pos.x, hero.pos.z, LAKE.x, LAKE.z) < LAKE.r + 120;
  if (atLake && state.quests.q1 >= 2 && !state.ending) {
    finalChoice();
    return;
  }
  UI.toast('Nada por perto...');
}

function toggleMount() {
  if (hero.mounted) {
    hero.mounted.ridden = false;
    hero.mounted = null;
    UI.toast('Você desmontou');
    return;
  }
  for (const h of horses) {
    const d = wdist(h.x, h.z, hero.pos.x, hero.pos.z);
    if (d < 7) {
      if (h.hunger < 18) { UI.toast(`${h.name} está com fome... 🌾`); return; }
      if (h.thirst < 18) { UI.toast(`${h.name} está com sede... 💧`); return; }
      hero.mounted = h;
      h.ridden = true;
      UI.toast(`Montou em ${h.name}!`);
      achv('ride');
      return;
    }
  }
  UI.toast('Nenhum cavalo por perto');
}

/* ---------------- missões e finais ---------------- */
function setQuest(q, step) {
  if (state.quests[q] < step) {
    state.quests[q] = step;
    const names = { q1: 'As Lanternas', q2: 'A Semente', q3: 'O Ferro' };
    UI.toast('Missão atualizada: ' + names[q]);
    Audio2.blip(660);
    achv('quest');
    saveWorld('slot1');
  }
}
function questCount() {
  return (state.quests.q1 >= 2 ? 1 : 0) + (state.quests.q2 >= 3 ? 1 : 0) + (state.quests.q3 >= 3 ? 1 : 0);
}
function finalChoice() {
  const opts = [];
  opts.push({ t: 'Ficar e proteger o vale para sempre', i: 'guardiao' });
  if (state.quests.q1 >= 2) opts.push({ t: 'Seguir a luz de Elara e partir', i: 'partida' });
  opts.push({ t: 'Apagar as lanternas e deixar o vale em paz', i: 'silencio' });
  if (state.rep >= 20) opts.push({ t: 'Abrir Andora para o mundo', i: 'colheita' });
  opts.push({ t: 'Aceitar o peso do lago — a escuridão', i: 'escuridao' });
  if (questCount() >= 2) opts.push({ t: 'Plantar a luz e renascer com o vale', i: 'luz' });
  dlgOpen = true;
  dlgNPC = { name: 'O Lago de Andora', role: 'a água fala', tree: () => ({
    start: N('A água se acalma. As lanternas se apagam, uma por uma, esperando. Este é o momento da sua escolha.', opts.map(o => C(o.t, 'done_' + o.i, () => endGame(o.i))))
  }) };
  showNode('start');
}
function endGame(id) {
  state.ending = id;
  const texts = {
    guardiao: 'FINAL: O Guardião — Ari permanece em Andora. As lanternas acendem para ele, e o vale nunca mais se sente sozinho.',
    partida: 'FINAL: A Partida — Ari segue a luz de Elara para além do lago. Andora guarda a saudade, mas agora ela tem um nome: esperança.',
    silencio: 'FINAL: O Silêncio — as lanternas se apagam. O vale descansa em paz, e Ari carrega o silêncio como uma bênção.',
    colheita: 'FINAL: A Colheita — as portas de Andora se abrem. O vale floresce com novos rostos, e as luzes viram festa.',
    escuridao: 'FINAL: A Escuridão — Ari aceita o peso do lago. As águas ficam escuras, mas ninguém mais precisa chorar sozinho.',
    luz: 'FINAL: A Luz — a flor renasce no monte. O vale inteiro acende, e cada lâgrima vira estrela.'
  };
  UI.ending(texts[id] || 'FIM', () => {
    closeDialogue();
    saveWorld('slot1');
    UI.toast('Jogo salvo. Continue explorando!');
  });
  achv('ending');
  saveWorld('slot1');
}

/* ---------------- conquistas ---------------- */
function achv(id) {
  if (state.achv[id]) return;
  state.achv[id] = 1;
  const names = {
    talk: 'Primeira Conversa', walk: 'Passeante', jump: 'Pulo de Fé', ride: 'Cavaleiro',
    fish: 'Pescador', seed: 'Jardineiro', planted: 'O Planteiro', ore: 'Mineiro',
    forged: 'Ferreiro de Andora', bonfire: 'Guardião do Fogo', bread: 'Pão Quente',
    song: 'Ouvinte', rod: 'Com a Vara na Mão', quest: 'Missão Cumprida',
    move: 'Passos em Andora', ending: 'Um dos Finais'
  };
  if (names[id]) UI.toast('🏆 Conquista: ' + names[id]);
}

/* ---------------- UI ---------------- */
const UI = {
  el(id) { return document.getElementById(id); },
  toast(t) {
    const box = this.el('toasts');
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = t;
    box.appendChild(d);
    setTimeout(() => d.classList.add('on'), 20);
    setTimeout(() => { d.classList.remove('on'); setTimeout(() => d.remove(), 350); }, 3400);
  },
  dialogue(name, text, choices, cb) {
    this.el('dlg').style.display = 'flex';
    this.el('dlg-name').textContent = name;
    this.el('dlg-text').textContent = text;
    const box = this.el('dlg-choices');
    box.innerHTML = '';
    choices.forEach(c => {
      const b = document.createElement('button');
      b.className = 'dlg-btn';
      b.textContent = c.t;
      b.onclick = () => { Audio2.blip(440); cb(c.i); };
      box.appendChild(b);
    });
  },
  dialogueHide() {
    const el = this.el('dlg');
    if (el) el.style.display = 'none';
  },
  ending(text, cb) {
    const el = this.el('ending');
    el.style.display = 'flex';
    this.el('ending-text').textContent = text;
    this.el('ending-ok').onclick = () => {
      el.style.display = 'none';
      cb && cb();
    };
  },
  togglePause() {
    const p = this.el('pause');
    p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
  },
  hud(t) {
    const el = this.el('hud-time');
    if (!el) return;
    const h = Math.floor(state.hour);
    const m = Math.floor((state.hour - h) * 60);
    el.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    const w = this.el('hud-weather');
    if (w) w.textContent = WEATHER.state === 'rain' ? '☔' : WEATHER.state === 'cloudy' ? '☁' : (skyState.night > 0.5 ? '🌙' : '☀');
    const q = this.el('hud-quest');
    if (q) {
      const parts = [];
      if (state.quests.q1 === 1) parts.push('Fale com Selma');
      if (state.quests.q1 === 2 && !state.flags.elara) parts.push('Vá ao lago à noite');
      if (state.quests.q2 === 1) parts.push('Fale com Lia');
      if (state.quests.q2 === 2) parts.push('Plante no monte');
      if (state.quests.q3 === 1 && state.inv.ore < 1) parts.push('Busque minério na montanha');
      if (state.inv.ore === 1) parts.push('Entregue ao Breno');
      q.textContent = parts[0] || (questCount() > 0 ? 'Vá ao lago e escolha' : 'Explore Andora');
    }
    const horseEl = this.el('hud-horse');
    if (horseEl) {
      if (hero.mounted) {
        horseEl.style.display = 'block';
        horseEl.textContent = `${hero.mounted.name} · 🌾${Math.round(hero.mounted.hunger)}% · 💧${Math.round(hero.mounted.thirst)}%`;
      } else horseEl.style.display = 'none';
    }
  }
};

/* ---------------- loop principal ---------------- */
let lastT = 0, running = true;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = clamp((t - lastT) / 1000, 0.001, 0.05);
  lastT = t;
  const paused = document.hidden || (UI.el('pause') && UI.el('pause').style.display === 'flex');
  tickSky(paused ? dt * 0.15 : dt);
  tickWeather(dt);
  if (!paused) {
    tickHero(dt);
    tickNPCs(dt, t);
    tickAnimals(dt, t);
    tickHorses(dt, t);
    tickWeatherFx(dt, t);
    if (hero.fishing > 0) {
      hero.fishing -= dt;
      if (hero.fishing < 2.2 && hero.fishing > 1.9 && !hero._tremble) {
        hero._tremble = true;
        UI.toast('A bóia tremeu! Aperta E!');
      }
      if (hero.fishing <= 0) { hero._tremble = false; }
    }
  }
  tickCamera(dt);
  updateTerrain(hero.pos.x, hero.pos.z);
  Nature.tick();
  GrassField.tick(t / 1000);
  // sincroniza névoa da água com a cena + tempo do shader
  if (window.__water) {
    window.__water.uniforms.uTime.value += dt;
    window.__water.uniforms.fogColor.value.copy(scene.fog.color);
    window.__water.uniforms.fogDensity.value = scene.fog.density;
  }
  // áudio ambiente
  const lakeD = wdist(hero.pos.x, hero.pos.z, LAKE.x, LAKE.z);
  Audio2.setEnv({
    wind: WEATHER.wind,
    water: clamp(1 - lakeD / 700, 0, 1),
    rain: WEATHER.rain
  });
  if (Math.random() < dt * (skyState.night > 0.5 ? 0.12 : 0.45)) {
    Audio2.chirp(700 + Math.random() * 900, 0.1, 0.035);
  }
  qualWatchdog(dt);
  UI.hud(t);
  renderer.render(scene, camera);
}

/* ---------------- boot ---------------- */
function boot() {
  bakeHeightmap();
  buildSky();
  makeRing(320, 84, 0, 26);
  makeRing(1300, 64, -0.5, 70);
  makeRing(5600, 44, -1.1, 260);
  updateTerrain(hero.pos.x, hero.pos.z);
  window.__water = buildWater();
  buildWeatherFx();
  bindInput();
  applyQual();

  // carrega GLTFs em segundo plano enquanto o menu está aberto
  const keysToLoad = [
    ...HUMAN_MODELS, 'horse', 'deer', 'stag', 'fox', 'wolf', 'shibainu', 'husky', 'alpaca',
    'commontree_1', 'commontree_3', 'commontree_5', 'pinetree_1', 'pinetree_3', 'birchtree_2', 'willow_3',
    'bush_1', 'bushberries_1', 'grass', 'grass_2', 'flowers', 'rock_moss_1', 'rock_moss_3', 'rock_2',
    'woodlog', 'treestump', 'wheat',
    'v_house_1', 'v_house_2', 'v_house_3', 'v_house_4', 'v_inn', 'v_stable', 'v_well',
    'v_marketstand_1', 'v_marketstand_2', 'v_cart', 'v_bonfire_lit', 'v_fence', 'v_bench_1',
    'v_barrel', 'v_crate', 'v_hay', 'v_bell_tower', 'v_rock_1'
  ];
  keysToLoad.forEach(k => GLB.load(k));

  // mundo inicial + personagens quando os assets chegarem
  let worldStarted = false;
  const startWorld = () => {
    if (worldStarted) return;
    worldStarted = true;
    buildVillage();
    Nature.init();
    Nature.scatter();
    GrassField.init();
    spawnNPCs();
    spawnAnimals();
    spawnHorses();
    hero.char = makeChar('mage', 0.55);
    hero.char.g.position.copy(hero.pos);
    scene.add(hero.char.g);
    // câmera inicial apresentando o vale
    hero.yaw = Math.PI * 0.94;
    hero.pitch = 0.26;
    if (window.__afterGLB) window.__afterGLB();
  };
  if (GLB.pending === 0) startWorld();
  else GLB.onReady.push(startWorld);
  // timeout de segurança
  setTimeout(() => {
    if (!worldStarted) startWorld();
  }, 9000);

  requestAnimationFrame(frame);
  // keep-alive (Render free tier) + autosave
  const kaTimer = setInterval(() => {
    if (document.hidden) {
      fetch('index.html', { cache: 'no-store' }).catch(() => { });
    }
    saveWorld('slot1');
  }, 90000);
  if (kaTimer && kaTimer.unref) kaTimer.unref();

  window.__AO = {
    hero, state, scene, camera, renderer, NPCS, animals, horses, WEATHER,
    isGLTF: () => !!(hero.char && hero.char.isGLTF),
    stepDay: () => { state.hour = (state.hour + 6) % 24; },
    endGame, interact, openDialogue, QUAL, GLB,
    ready: () => worldStarted,
    resume: () => { Audio2.start(); Audio2.resume(); },
    newWorld: (seed) => newWorld(seed),
    load: (slot) => loadWorld(slot),
    saveNow: () => { saveWorld('slot1'); UI.toast('Mundo salvo! 💾'); },
    setSound: (on) => {
      Audio2.on = on;
      if (Audio2.master) Audio2.master.gain.value = on ? 0.34 : 0;
    },
    tp: (x, z) => { hero.pos.set(x, groundH(x, z) + 2, z); updateTerrain(x, z); Nature.scatter(); },
    groundH, villageParts
  };
  window.__launched = true;
}
boot();
