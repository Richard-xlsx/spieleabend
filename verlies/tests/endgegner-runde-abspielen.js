const path = require('path'), os = require('os');
const LOGIK = path.join(__dirname, '..', 'verlies-logic.js');
const AUS = path.join(os.tmpdir(), 'verlies-tests'); require('fs').mkdirSync(AUS, { recursive: true });
const URL_BASIS = process.env.VERLIES_URL || 'http://localhost:8765';
const { chromium, devices } = require('playwright');
const daten = JSON.parse(require('fs').readFileSync(path.join(AUS, 'ruf.json'), 'utf8'));
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext(devices['iPhone 13'])).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL_BASIS + '/verlies/index.html'); await p.waitForTimeout(600);
  await p.evaluate(d => {
    document.getElementById('app').innerHTML = '<div class="buehne" id="bt"></div>';
    window.__fertig = false;
    VBuehne.abspielen(document.getElementById('bt'), d.L, { name: x => d.namen[x], rolle: x => d.helden[x], tempo: .6, ton: false, abbruch: () => false, sag: () => {} })
      .then(() => { window.__fertig = true; }, e => { window.__fehler = String(e); window.__fertig = true; });
  }, daten);
  await p.waitForTimeout(2600); await (await p.$('#bt')).screenshot({ path: path.join(AUS, 'ruf-a.png') });
  await p.waitForTimeout(1800); await (await p.$('#bt')).screenshot({ path: path.join(AUS, 'ruf-b.png') });
  await p.waitForFunction(() => window.__fertig, null, { timeout: 30000 });
  await (await p.$('#bt')).screenshot({ path: path.join(AUS, 'ruf-c.png') });
  console.log('Fehler:', JSON.stringify(errs), await p.evaluate(() => window.__fehler || ''));
  await b.close();
})();
