// Zeichnet die Kerker-Gegner auf der Kampfbühne (mit Eigenschaften, Absichten, Knochenschild) und als Seitenbilder.
// Ergebnis: gegner-1.png … gegner-4.png und gegner-seiten.png im Ordner verlies-tests (tmp). Server: python3 -m http.server 8765
const path = require('path'), os = require('os'), fs = require('fs');
const AUS = path.join(os.tmpdir(), 'verlies-tests'); fs.mkdirSync(AUS, { recursive: true });
const URL_BASIS = process.env.VERLIES_URL || 'http://localhost:8765';
const { chromium, devices } = require('playwright');
const BUEHNEN = [
  { arten: ['kerkerwaerter', 'langfinger'], absicht: { g0: { a: 'beben', name: 'Kettenschlag' }, g1: { a: 'stehlen', ziel: 'p1' } } },
  { arten: ['totenbeschwoerer', 'skelett', 'bogenschuetze', 'ghul'], absicht: { g0: { a: 'ruf' }, g1: { a: 'angriff', ziel: 'p0' }, g2: { a: 'angriff', ziel: 'p2' }, g3: { a: 'angriff', ziel: 'p1' } } },
  { arten: ['schwarm', 'schwarm', 'schwarm', 'schamane'], absicht: { g0: { a: 'angriff', ziel: 'p0' }, g3: { a: 'heilen', ziel: 'g1' }, g2: { a: 'flucht' } } },
  { arten: ['koenig', 'skelett', 'skelett'], schild: true, absicht: { g0: { a: 'beben' } } }
];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext(devices['iPhone 13'])).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL_BASIS + '/verlies/index.html'); await p.waitForTimeout(500);
  for (let i = 0; i < BUEHNEN.length; i++) {
    await p.evaluate(B => {
      document.getElementById('app').innerHTML = '<div class="buehne" id="bt"></div>';
      VBuehne.zeichne(document.getElementById('bt'), { gegner: B.arten.map((a, i) => ({ id: 'g' + i, art: a, name: VL.GEGNER[a].name, hp: 30, max: 40, giftR: 0, markiert: 0, schild: B.schild && i === 0 })),
        helden: ['kaempfer', 'dieb', 'heilerin'].map((r, i) => ({ id: 'p' + i, rolle: r, name: ['Richard', 'Lena', 'Jens'][i], hp: 20, max: 30, marken: '' })), absicht: B.absicht, zielModus: null, zielHelden: [] });
    }, BUEHNEN[i]);
    await p.waitForTimeout(300);
    await (await p.$('#bt')).screenshot({ path: path.join(AUS, `gegner-${i + 1}.png`) });
  }
  await p.evaluate(() => {
    document.getElementById('app').innerHTML = '<div id="seiten" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#F3E6CC;padding:8px">' +
      ['schwarm', 'langfinger', 'bogenschuetze', 'ghul', 'kerkerwaerter', 'totenbeschwoerer'].map(a => `<div>${VB.bild(a)}<small>${a}</small></div>`).join('') + '</div>';
  });
  await (await p.$('#seiten')).screenshot({ path: path.join(AUS, 'gegner-seiten.png') });
  console.log('Bilder in', AUS, '| Fehler:', JSON.stringify(errs));
  await b.close();
})();
