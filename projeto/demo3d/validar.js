// ANDORA — validação rápida de sanidade do build
const fs = require('fs');
const path = require('path');

const game = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'webapp', 'index.html'), 'utf8');

let fails = 0;
function need(name, cond) {
  console.log((cond ? '[ok] ' : '[FALHOU] ') + name);
  if (!cond) fails++;
}

// sintaxe
try {
  new Function(game);
  need('game.js parseia sem erro de sintaxe', true);
} catch (e) {
  need('game.js parseia sem erro de sintaxe: ' + e.message, false);
}

// conteúdo essencial
const musts = [
  ['keep-alive present', 'kaTimer'],
  ['save/load', 'andora-worlds-v2'],
  ['14+ npcs', (game.match(/id: '/g) || []).length >= 14],
  ['6 finais', ['guardiao', 'partida', 'silencio', 'colheita', 'escuridao', 'luz'].every(e => game.includes(e))],
  ['cavalo montável', 'hero.mounted'],
  ['pesca', 'Pescando'],
  ['clima', 'WEATHER'],
  ['mundo infinito (wrap)', 'wrapN'],
  ['controles touch', 'joyX'],
  ['cutscene vídeo', html.includes('cut-0.mp4')],
  ['canvas container', html.includes('id="c"')],
  ['dialogo UI', html.includes('dlg-choices')],
  ['nosso marcador', html.includes('o vale das lanternas')]
];
for (const [name, cond] of musts) {
  need(name, typeof cond === 'boolean' ? cond : game.includes(cond) || html.includes(cond));
}

// sem setInterval "pendurado" sem unref (validar em node não deve travar)
need('sem timer solto sem unref', !/setInterval\([^)]*\)\s*&&/.test(game));

console.log(fails === 0 ? '\nVALIDAÇÃO OK' : `\n${fails} FALHAS`);
process.exit(fails ? 1 : 0);
