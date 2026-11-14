const path = require('path'), os = require('os');
const LOGIK = path.join(__dirname, '..', 'verlies-logic.js');
const AUS = path.join(os.tmpdir(), 'verlies-tests'); require('fs').mkdirSync(AUS, { recursive: true });
const URL_BASIS = process.env.VERLIES_URL || 'http://localhost:8765';
const { chromium, devices } = require('playwright');
const OUT = path.join(AUS, 'v-');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext(devices['iPhone 13'])).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL_BASIS + '/verlies/vorschau-kampf.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const buehne = await p.$('.buehne');
  await buehne.screenshot({ path: OUT + '0-start.png' });
  await p.screenshot({ path: OUT + '0-seite.png', fullPage: true });
  await p.click('#r1');
  const t0 = Date.now();
  // Momentaufnahmen während Runde 1: Schwerthieb, Feuerball-Flug, Explosion, Heilung, Ork-Angriff, Gift
  for (const [ms, n] of [[560, 'a-hieb'], [1900, 'b-feuerflug'], [2350, 'c-explosion'], [3700, 'd-heilung'], [5300, 'e-ork'], [6600, 'f-gift']]) {
    const warte = ms - (Date.now() - t0); if (warte > 0) await p.waitForTimeout(warte);
    await buehne.screenshot({ path: OUT + n + '.png' });
  }
  await p.waitForFunction(() => !window.__vorschau.laeuft, null, { timeout: 30000 });
  console.log('Runde 1 fertig nach', Date.now() - t0, 'ms');
  await p.click('#r2');
  const t1 = Date.now();
  for (const [ms, n] of [[900, 'g-eis'], [2600, 'h-wirbel']]) { const w = ms - (Date.now() - t1); if (w > 0) await p.waitForTimeout(w); await buehne.screenshot({ path: OUT + n + '.png' }); }
  await p.waitForFunction(() => !window.__vorschau.laeuft, null, { timeout: 30000 });
  console.log('Runde 2 fertig nach', Date.now() - t1, 'ms');
  await buehne.screenshot({ path: OUT + 'i-ende.png' });
  console.log('Chronik:', await p.textContent('#chronik'));
  // Überspringen testen
  await p.click('#neu'); await p.click('#r1'); await p.waitForTimeout(400); await p.click('#ueberspringen');
  const t2 = Date.now(); await p.waitForFunction(() => !window.__vorschau.laeuft, null, { timeout: 10000 }); console.log('Überspringen dauerte', Date.now() - t2, 'ms');
  // Alle Einzeleffekte
  const n = (await p.$$('#einzeln button')).length;
  for (let i = 0; i < n; i++) { await p.click(`#einzeln button:nth-child(${i + 1})`); await p.waitForFunction(() => !window.__vorschau.laeuft, null, { timeout: 15000 }); }
  console.log('Einzeleffekte gespielt:', n, '| Fehler:', JSON.stringify(errs));
  console.log('Seitenbreite ok:', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await b.close();
})().catch(e => { console.error('ABBRUCH', e.message); process.exit(1); });
