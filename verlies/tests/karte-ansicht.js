// Zeichnet eine Karte mitten in einer Partie (Reihe 4, mit Weg und Nebel) und die Elite-Gegner auf der Bühne.
const path = require('path'), os = require('os'), fs = require('fs'), vm = require('vm');
const AUS = path.join(os.tmpdir(), 'verlies-tests'); fs.mkdirSync(AUS, { recursive: true });
const URL_BASIS = process.env.VERLIES_URL || 'http://localhost:8765';
const { chromium, devices } = require('playwright');
const ctx = { window: {}, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'verlies-logic.js'), 'utf8'), ctx); const V = ctx.window.VL;
let S = V.neu('ABCD', 'p0', 'Richard', 7);
S = V.aktion(S, 'p1', { t: 'join', name: 'Lena' }); S = V.aktion(S, 'p2', { t: 'join', name: 'Jens' });
['paladin', 'magierin', 'heilerin'].forEach((r, i) => S = V.aktion(S, 'p' + i, { t: 'rolle', rolle: r }));
S = V.aktion(S, 'p0', { t: 'start' });
// bis Reihe 4 laufen, Kämpfe automatisch
for (let n = 0; n < 400 && !(S.entscheidung && S.entscheidung.art === 'karte' && S.raumNr >= 4); n++) {
  if (S.phase === 'kampf') S = V.aktion(S, 'p0', { t: 'auto' });
  else if (S.phase === 'lager') S = V.aktion(S, 'p0', { t: 'beenden' });
  else if (S.phase === 'erkunden') { const p = S.teilnehmer.find(x => S.entscheidung.stimmen[x] === undefined);
    S = V.aktion(S, p, { t: 'stimme', i: S.entscheidung.optionen.findIndex(o => !o.gesperrt), nr: S.spielNr }); }
  else break;
  for (const p of S.teilnehmer) if (S.helden[p].hp <= 0) S.helden[p].hp = 10;
}
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext(devices['iPhone 13'])).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL_BASIS + '/verlies/index.html'); await p.waitForTimeout(500);
  await p.evaluate(S => {
    const e = S.entscheidung;
    document.getElementById('app').innerHTML = `<article class="seite kartenblatt" id="k">${VKarte.svg(S, { optionen: e.optionen.map((o, i) => ({ knoten: o.knoten, i, gesperrt: o.gesperrt, geheim: o.geheim })), meine: 0, stimmen: { [e.optionen[0].knoten]: ['Ri', 'Le'] }, klickbar: true, namen: { p0: 'Richard', p1: 'Lena', p2: 'Jens' } })}${VKarte.legende()}</article><div class="buehne" id="bt"></div>`;
    VBuehne.zeichne(document.getElementById('bt'), { gegner: ['kerkerwaerter', 'totenbeschwoerer', 'langfinger'].map((a, i) => ({ id: 'g' + i, art: a, name: VL.GEGNER[a].name, hp: 40, max: 60, giftR: 0, markiert: 0 })),
      helden: S.teilnehmer.map(x => ({ id: x, rolle: S.helden[x].rolle, name: x, hp: 20, max: 30, marken: '' })), absicht: { g0: { a: 'beben', name: 'Kettenschlag' }, g1: { a: 'angriff', ziel: 'p0' } }, zielModus: null, zielHelden: [] });
  }, S);
  await p.waitForTimeout(400);
  await (await p.$('#k')).screenshot({ path: path.join(AUS, 'karte-mitte.png') });
  await (await p.$('#bt')).screenshot({ path: path.join(AUS, 'elite-buehne.png') });
  console.log('Reihe', S.raumNr, 'Weg', S.karte.weg.join(' '), '| Fehler:', JSON.stringify(errs));
  await b.close();
})();
