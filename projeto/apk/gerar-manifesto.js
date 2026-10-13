/* Gera twa-manifest.json do APK usando @bubblewrap/core (sem prompts). */
const { TwaManifest } = require('/home/user/apk/node_modules/@bubblewrap/core');
(async () => {
  const m = await TwaManifest.fromWebManifest('https://andora-75sw.onrender.com/manifest.webmanifest');
  console.log('defaults:', m.packageId, '|', m.name, '|', m.launcherName, '|', m.host);
  m.packageId = 'com.andora.jogo';
  m.name = 'Andora';
  m.launcherName = 'Andora';
  m.display = 'standalone';
  m.orientation = 'any';
  m.minSdkVersion = 24;
  m.host = 'andora-75sw.onrender.com';
  m.startUrl = 'https://andora-75sw.onrender.com/';
  m.signingKey = { path: '/home/user/apk/andora-app/android-keystore', alias: 'android' };
  await m.saveToFile('/home/user/apk/andora-app/twa-manifest.json');
  console.log('OK twa-manifest.json gerado');
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });
