/* Abre o jogo publicado num navegador de verdade e registra tudo:
   erros de console, mensagens, e prints das telas. */
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'https://matheusvibecoder.github.io/andora/';
const OUT = __dirname;

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[console.' + m.type() + ']', m.text().slice(0, 300)));
  page.on('pageerror', e => console.log('[PAGEERROR]', e.message.slice(0, 500)));
  page.on('requestfailed', r => console.log('[reqfail]', r.url().slice(0, 120), r.failure() && r.failure().errorText));
  page.on('response', r => { if (r.status() >= 400) console.log('[http ' + r.status() + ']', r.url().slice(0, 120)); });

  console.log('abrindo', URL);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  } catch (e) { console.log('goto aviso:', e.message.slice(0, 120)); }
  await new Promise(r => setTimeout(r, 10000)); // deixa o boot terminar

  const webgl = await page.evaluate(() => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  });
  console.log('WebGL disponível:', webgl);

  const state1 = await page.evaluate(() => ({
    loadingVisivel: !!document.getElementById('loading') && !document.getElementById('loading').classList.contains('hidden'),
    menuVisivel: !!document.getElementById('menu') && !document.getElementById('menu').classList.contains('hidden'),
    temAndora: typeof window.__andora !== 'undefined',
    titulo: (document.getElementById('logo') || {}).textContent
  }));
  console.log('estado inicial:', JSON.stringify(state1));
  await page.screenshot({ path: OUT + '/print1-menu.png' });

  // clica em Jogar
  await page.click('#btnPlay').catch(e => console.log('btnPlay:', e.message));
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: OUT + '/print2-apos-jogar.png' });

  // percorre a cutscene
  for (let i = 0; i < 6; i++) {
    const info = await page.evaluate(() => {
      const cs = document.getElementById('cutscene');
      const b = document.querySelector('#csOpts button');
      const visivel = cs && !cs.classList.contains('hidden');
      if (visivel && b) { b.click(); return 'clicou: ' + b.textContent.slice(0, 40); }
      return visivel ? 'cutscene sem botões' : 'cutscene fechada';
    });
    console.log('cutscene passo', i, '→', info);
    await new Promise(r => setTimeout(r, 900));
    if (info === 'cutscene fechada') break;
  }
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: OUT + '/print3-jogo.png' });

  const state2 = await page.evaluate(() => ({
    hudVisivel: !!document.getElementById('hud') && !document.getElementById('hud').classList.contains('hidden'),
    local: (document.getElementById('localName') || {}).textContent,
    relogio: (document.getElementById('clockLine') || {}).textContent,
    heroi: window.__andora && window.__andora.hero ? { x: +window.__andora.hero.x.toFixed(1), z: +window.__andora.hero.z.toFixed(1) } : null
  }));
  console.log('estado do jogo:', JSON.stringify(state2));

  // tenta andar 3 segundos
  await page.keyboard.down('KeyW');
  await new Promise(r => setTimeout(r, 3000));
  await page.keyboard.up('KeyW');
  const pos = await page.evaluate(() => window.__andora && window.__andora.hero ? { x: +window.__andora.hero.x.toFixed(1), z: +window.__andora.hero.z.toFixed(1) } : null);
  console.log('posição após andar:', JSON.stringify(pos));
  await page.screenshot({ path: OUT + '/print4-andando.png' });

  await browser.close();
  console.log('FIM DO TESTE');
})().catch(e => { console.error('ERRO NO TESTE:', e.message); process.exit(1); });
