const path = require('path'), os = require('os');
const LOGIK = path.join(__dirname, '..', 'verlies-logic.js');
const AUS = path.join(os.tmpdir(), 'verlies-tests'); require('fs').mkdirSync(AUS, { recursive: true });
const URL_BASIS = process.env.VERLIES_URL || 'http://localhost:8765';
const { chromium, devices } = require('playwright');
const OUT = path.join(AUS, (process.argv[3] || 'b') + '-');
(async () => {
  const b = await chromium.launch();
  const mk = async () => {
    const c = await b.newContext(devices['iPhone 13']); const p = await c.newPage(); p.errs = [];
    p.on('pageerror', e => p.errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') p.errs.push('console: ' + m.text()); });
    return p;
  };
  const [h, a, c] = [await mk(), await mk(), await mk()];
  await h.goto(URL_BASIS + '/verlies/'); await h.fill('#name', 'Richard'); await h.click('#neu');
  await h.waitForFunction(() => window.__vl && window.__vl.verbunden, null, { timeout: 30000 });
  const code = new URL(h.url()).searchParams.get('raum'); console.log('Raum', code);
  for (const [p, n] of [[a, 'Lena'], [c, 'Jens']]) { await p.goto(URL_BASIS + '/verlies/?raum=' + code); await p.fill('#name', n); await p.click('#mitspielen'); }
  await h.waitForFunction(() => window.__vl.S.online.length === 3, null, { timeout: 30000 });
  const R = (process.argv[2] || 'paladin,magierin,waldlaeufer').split(',');
  await h.click('[data-rolle="' + R[0] + '"]'); await a.waitForTimeout(600);
  await a.click('[data-rolle="' + R[1] + '"]'); await c.waitForTimeout(600);
  const belegt = await c.$('[data-rolle="' + R[0] + '"][disabled]'); console.log('Rolle 1 für Jens gesperrt:', !!belegt);
  await c.click('[data-rolle="' + R[2] + '"]');
  await h.waitForTimeout(800);
  console.log('Rollen', JSON.stringify(await h.evaluate(() => window.__vl.S.rollen)));
  await h.screenshot({ path: OUT + '1-lobby.png', fullPage: true });
  await h.click('#start');
  const pages = [h, a, c]; const shots = {}; let schritte = 0, neugeladen = false, hostNeu = false;
  while (schritte++ < 2500) {
    const ph = await h.evaluate(() => window.__vl.S && window.__vl.S.phase);
    if (ph === 'ende') break;
    const raum = await h.evaluate(() => window.__vl.S.raumNr);
    if (raum === 3 && !neugeladen) { neugeladen = true; await a.reload(); await a.waitForFunction(() => window.__vl && window.__vl.verbunden, null, { timeout: 30000 }); console.log('Lena neu geladen, wieder verbunden'); }
    if (raum === 5 && !hostNeu) {
      hostNeu = true; await h.reload();
      await h.waitForFunction(() => window.__vl && window.__vl.rolle === 'host' && window.__vl.verbunden, null, { timeout: 40000 });
      await h.waitForFunction(() => window.__vl.S.online.length === 3, null, { timeout: 40000 });
      console.log('Spielleiter neu geladen, alle wieder da');
    }
    for (const p of pages) { try {
      const ue = await p.$('#ueberspringen');
      if (ue) {
        shots.wiedergaben = (shots.wiedergaben || 0) + (p === h ? 1 : 0);
        if (p === h && shots.wiedergaben <= 2) {
          for (const ms of [900, 1700, 2600]) { await p.waitForTimeout(ms === 900 ? 900 : 800); await p.screenshot({ path: OUT + '5-wiedergabe-' + shots.wiedergaben + '-' + ms + '.png' }); }
          await p.waitForSelector('#ueberspringen', { state: 'detached', timeout: 30000 }).catch(() => {});
          continue;
        }
        await ue.click().catch(() => {}); await p.waitForTimeout(400); continue;
      }
      const st = await p.evaluate(() => { const S = window.__vl.S; return S ? S.phase + ':' + (S.entscheidung ? S.entscheidung.art : '') : ''; });
      if (st.startsWith('erkunden') && !shots[st]) { shots[st] = 1; await p.screenshot({ path: OUT + '2-' + st.replace(':', '-') + '.png', fullPage: true }); }
      if (st.startsWith('kampf') && !shots.kampf && p === h) { shots.kampf = 1; await p.screenshot({ path: OUT + '3-kampf.png', fullPage: true }); }
      const fk = await p.$('#faehigkeiten:not(.zweit)');
      if (fk) {
        await fk.click(); await p.waitForTimeout(200);
        const v = await p.$('[data-talent]:not([disabled])');
        if (v) { await v.click(); await p.waitForTimeout(400); }
        if (!shots.faehigkeiten) { shots.faehigkeiten = 1; await p.screenshot({ path: OUT + '2-faehigkeiten.png', fullPage: true }); }
        await p.click('#zurueck-f'); await p.waitForTimeout(150);
        continue;
      }
      if (st.startsWith('lager')) {
        if (!shots.lager) { shots.lager = 1; await p.screenshot({ path: OUT + '2-lager.png', fullPage: true }); }
        for (let k = 0; k < 3; k++) { const w = await p.$$('[data-kauf]:not([disabled])'); if (!w.length) break; await w[Math.floor(Math.random() * w.length)].evaluate(e => e.click()); await p.waitForTimeout(250); }
        const f = await p.$('#fertig:not(.zweit)'); if (f) await f.click();
        continue;
      }
      const opt = await p.$('[data-stimme]:not([disabled])');
      if (opt && !(await p.$('.option.meins'))) { const all = await p.$$('[data-stimme]:not([disabled])'); await all[Math.floor(Math.random() * all.length)].click(); continue; }
      const akt = await p.$$('[data-aktion]:not([disabled])');
      if (akt.length) {
        await akt[Math.floor(Math.random() * akt.length)].click(); await p.waitForTimeout(150);
        const z = await p.$$('[data-ziel]');
        if (z.length) { const held = await p.$('.heldzeile.ziel'); const key = held ? 'zielheld' : 'ziel'; if (!shots[key]) { shots[key] = 1; await p.screenshot({ path: OUT + '3-' + key + '.png', fullPage: true }); } await z[Math.floor(Math.random() * z.length)].click(); }
      }
    } catch (x) { if (!/not attached|detached/i.test(x.message)) throw x; } }   // Knopf wurde gerade neu gezeichnet
    await h.waitForTimeout(300);
  }
  await h.waitForTimeout(1500);
  for (const p of pages) console.log(await p.evaluate(() => (document.querySelector('.etikett') || {}).textContent), '| Fehler:', JSON.stringify(p.errs));
  await h.screenshot({ path: OUT + '4-ende.png', fullPage: true });
  const S = await h.evaluate(() => window.__vl.S); console.log('Ergebnis', S.ergebnis, 'Ebene', S.ebene + '/' + S.ebenen, 'Raum', S.raumNr, 'Schleifen', schritte);
  const sync = await Promise.all(pages.map(p => p.evaluate(() => window.__vl.S.aenderung))); console.log('Gleicher Stand auf allen:', new Set(sync).size === 1);
  await b.close();
})().catch(e => { console.error('ABBRUCH', e.message); process.exit(1); });
