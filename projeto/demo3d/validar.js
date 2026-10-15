#!/usr/bin/env node
/* Validação rápida do Andora 3D sem navegador:
   carrega o game.js com stubs de DOM/WebGL e simula jogar alguns segundos. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const THREE = require(path.join(__dirname, 'three.min.js'));
global.THREE = THREE;
global.ASSETS = { f1: 'data:,1', f2: 'data:,2', f3: 'data:,3', f4: 'data:,4' };

/* stub de contexto 2D (auto-referente: gradiente.addColorStop etc.) */
function ctx2d() {
  const canvasRef = { width: 256, height: 80 };
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, {
    get: (t, k) => (k === 'canvas' ? canvasRef : proxy),
    apply: () => proxy,
    set: () => true
  });
  return proxy;
}
let ctx;

function fakeEl(id) {
  const el = {
    id, tag: 'div', style: {}, children: [], _cls: new Set(), _handlers: {}, _html: '',
    classList: {
      add: c => el._cls.add(c), remove: c => el._cls.delete(c),
      toggle: (c, f) => { if (f === undefined) { el._cls.has(c) ? el._cls.delete(c) : el._cls.add(c); } else if (f) el._cls.add(c); else el._cls.delete(c); },
      contains: c => el._cls.has(c)
    },
    addEventListener: (type, fn) => { el._handlers[type] = fn; },
    fire: (type, ev) => { if (el._handlers[type]) el._handlers[type](ev || { preventDefault() {}, stopPropagation() {}, clientX: 0, clientY: 0, pointerId: 1 }); },
    appendChild: c => { el.children.push(c); return c; },
    remove: () => {}, setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 120, height: 120 }),
    setAttribute: () => {}, getContext: () => ctx,
    width: 300, height: 150, textContent: '', value: '', onclick: null
  };
  Object.defineProperty(el, 'innerHTML', {
    get: () => el._html,
    set: v => { el._html = v; if (v === '') el.children.length = 0; }
  });
  return el;
}
ctx = ctx2d();
const els = {};
const doc = {
  getElementById: id => (els[id] = els[id] || fakeEl(id)),
  createElement: tag => fakeEl(tag),
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.document = doc;
global.window = global;
global.location = { protocol: 'file:' };
global.navigator = {};
global.matchMedia = () => ({ matches: false });
global.innerWidth = 1280; global.innerHeight = 720; global.devicePixelRatio = 1;
global.addEventListener = () => {};
global.localStorage = undefined; // store deve cair no fallback em memória
let rafCb = null;
global.requestAnimationFrame = cb => { rafCb = cb; };

/* renderer falso */
THREE.WebGLRenderer = function (opts) {
  this.shadowMap = {};
  this.setRenderTarget = () => {};
  this.getRenderTarget = () => null;
  this.clear = () => {};
  this.setPixelRatio = () => {};
  this.setSize = () => {};
  this.render = () => {};
  this.domElement = opts.canvas;
};
/* passo de tempo fixo */
THREE.Clock.prototype.getDelta = function () { return 0.0167; };

const code = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
vm.runInThisContext(code, { filename: 'game.js' });

function frames(n) { for (let i = 0; i < n; i++) { if (rafCb) rafCb(); } }

console.log('boot OK · frames no menu...');
frames(30);

/* fluxo: Jogar → cutscene → começar */
const btnPlay = doc.getElementById('btnPlay');
if (!btnPlay.onclick) throw new Error('btnPlay sem handler');
btnPlay.onclick();
console.log('cutscene aberta · percorrendo nós...');
for (let i = 0; i < 4; i++) {
  const opts = doc.getElementById('csOpts');
  if (!opts.children.length) throw new Error('nó da cutscene sem opções (i=' + i + ')');
  opts.children[0].onclick();
}
const fin = doc.getElementById('csOpts');
if (!fin.children.length) throw new Error('finale sem botão');
fin.children[0].onclick();
console.log('jogo iniciado · simulando 6s de caminhada (S)...');
global._keys = global._keys || {};
doc.getElementById('game'); // canvas
window._keys['KeyS'] = true; // anda em direção à vila
frames(420);
window._keys['KeyS'] = false;
console.log('encostando na Moira e interagindo...');
window.__andora.warp(10, 113);
doc.getElementById('btnAct').fire('pointerdown');
frames(5);
const name = doc.getElementById('dlgName').textContent;
if (!name) { console.error('FALHA: diálogo não abriu com a Moira'); process.exit(1); }
console.log('diálogo aberto com:', name, '| nível:', doc.getElementById('dlgFriend').textContent);
const opts = doc.getElementById('dlgOpts');
if (opts.children[0]) opts.children[0].onclick();
frames(2);
const opts2 = doc.getElementById('dlgOpts');
if (opts2.children[0]) opts2.children[0].onclick(); // "Continuar"
frames(2);
console.log('posição do herói:', window.__andora.hero.x.toFixed(1), window.__andora.hero.z.toFixed(1));
frames(60);
doc.getElementById('btnSave').fire && doc.getElementById('btnSave').onclick && doc.getElementById('btnSave').onclick();
frames(20);
console.log('OK — simulação sem erros · frames totais ok');
