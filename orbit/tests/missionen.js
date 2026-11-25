// Tests für Schrotthändler und Reaktor-Countdown (wird von logik.js mit aufgerufen, geht auch allein: node orbit/tests/missionen.js)
if (!global.window) global.window = {};
if (!window.RM) {
  require(__dirname + '/../logic.js');
  require(__dirname + '/../missionen/funkfrequenz.js');
  require(__dirname + '/../missionen/schrotthaendler.js');
  require(__dirname + '/../missionen/reaktor.js');
}
if (!window.ORBIT_MISSIONEN.asteroid) { require(__dirname + '/../missionen/asteroid.js'); require(__dirname + '/../missionen/kapseln.js'); }
if (!window.ORBIT_MISSIONEN.terraforming) { require(__dirname + '/../missionen/terraforming.js'); require(__dirname + '/../missionen/ionenspur.js'); }
if (!window.ORBIT_MISSIONEN.gestaltwandler) { require(__dirname + '/../missionen/gestaltwandler.js'); require(__dirname + '/../missionen/frachtraum.js'); }
if (!window.ORBIT_MISSIONEN.greifarm) { require(__dirname + '/../missionen/solo.js'); require(__dirname + '/../missionen/greifarm.js'); require(__dirname + '/../missionen/bordkueche.js'); require(__dirname + '/../missionen/boule.js'); }
if (!window.ORBIT_MISSIONEN.treibstoff) {
  require(__dirname + '/../missionen/treibstoff.js'); require(__dirname + '/../missionen/mondbasis.js');
  // planck.js kommt im Browser vom CDN; in node: npm install planck@1.4.2 (oder NODE_PATH), sonst wird die Mondbasis übersprungen
  try { window.planck = require('planck'); } catch (e) { window.planck = null; }
}
if (!window.ORBIT_LIVE) require(__dirname + '/../live.js');
const R = window.RM, assert = require('assert');
const ctx = (tn, aktiv) => ({ tn, aktiv: aktiv || tn, rng: Math.random });

// ---------- Schrotthändler ----------
{
  const SH = R.MISSIONEN.schrotthaendler, tn = ['a', 'b', 'c'];
  const d = SH.neu(tn, R.zufall(5));
  assert.deepStrictEqual(d.teile.map(x => x.wert).sort((x, y) => x - y), [3, 4, 6, 8, 12]);
  let t = 0;
  SH.start(d, t, ctx(tn));
  assert.strictEqual(d.nr, 1); assert.strictEqual(d.schritt, 'gebot');
  assert.strictEqual(SH.aktion(d, 'a', { a: 'gebot', g: 31 }), 'Du hast nur 30 Credits.');
  assert.strictEqual(SH.aktion(d, 'a', { a: 'gebot', g: 10 }), true);
  assert.strictEqual(SH.aktion(d, 'a', { a: 'gebot', g: 12 }), true, 'ändern geht');
  SH.aktion(d, 'b', { a: 'gebot', g: 5 });
  // Sicht: fremde Gebote verdeckt
  const v = SH.sicht(d, 'b');
  assert.deepStrictEqual(v.gebote, { b: 5 }); assert.deepStrictEqual(v.geboten.sort(), ['a', 'b']);
  assert.strictEqual(SH.takt(d, t, ctx(tn)), false, 'c fehlt noch');
  SH.aktion(d, 'c', { a: 'gebot', g: 0 });
  assert(SH.takt(d, t, ctx(tn)), 'alle haben geboten');
  assert.strictEqual(d.schritt, 'aufloesung');
  assert.strictEqual(d.verlauf[0].sieger, 'a'); assert.strictEqual(d.guthaben.a, 18); assert.strictEqual(d.guthaben.b, 30);
  assert.strictEqual(d.punkte.a, d.teile[0].wert);
  assert.strictEqual(SH.sicht(d, 'b').gebote.a, 12, 'nach der Auflösung sichtbar');
  // Teil 2: Gleichstand → keiner bekommt es, keiner zahlt
  t += 6000; SH.takt(d, t, ctx(tn));
  assert.strictEqual(d.nr, 2);
  SH.aktion(d, 'a', { a: 'gebot', g: 7 }); SH.aktion(d, 'b', { a: 'gebot', g: 7 }); SH.aktion(d, 'c', { a: 'gebot', g: 2 });
  SH.takt(d, t, ctx(tn));
  assert.strictEqual(d.verlauf[1].sieger, null); assert.deepStrictEqual(d.verlauf[1].gleich.sort(), ['a', 'b']);
  assert.strictEqual(d.guthaben.a, 18); assert.strictEqual(d.guthaben.b, 30);
  // Teil 3: Zeit läuft ab, keiner bietet → keiner bekommt es
  t += 6000; SH.takt(d, t, ctx(tn)); t += 15000; SH.takt(d, t, ctx(tn));
  assert.strictEqual(d.verlauf[2].sieger, null); assert.strictEqual(d.verlauf[2].hoch, 0);
  // Teil 4 und 5: b bietet alles
  for (let i = 4; i <= 5; i++) {
    t += 6000; SH.takt(d, t, ctx(tn));
    SH.aktion(d, 'b', { a: 'gebot', g: d.guthaben.b }); t += 15000; SH.takt(d, t, ctx(tn));
  }
  assert.strictEqual(d.verlauf[3].sieger, 'b'); assert.strictEqual(d.guthaben.b, 0);
  assert.strictEqual(d.verlauf[4].sieger, null, 'b hat 0 geboten');
  t += 6000; SH.takt(d, t, ctx(tn));
  assert(d.fertig);
  const w = SH.wertung(d);
  assert.strictEqual(w.a, d.teile[0].wert); assert.strictEqual(w.b, d.teile[3].wert); assert.strictEqual(w.c, 0);
  // Bots bieten nie mehr, als sie haben
  for (let s = 1; s < 200; s++) {
    const e = SH.neu(tn, R.zufall(s)); SH.start(e, 0, ctx(tn)); const rng = R.zufall(s * 3);
    for (let k = 0; k < 400 && !e.fertig; k++) {
      for (const p of tn) { const m = SH.bot(e, p, rng); if (m) assert.strictEqual(SH.aktion(e, p, m), true); }
      SH.takt(e, k * 500, ctx(tn));
    }
    assert(e.fertig); for (const p of tn) assert(e.guthaben[p] >= 0);
  }
}

// ---------- Reaktor-Countdown ----------
{
  const RK = R.MISSIONEN.reaktor, tn = ['a', 'b', 'c'];
  assert.strictEqual(RK.wert(0), 0); assert.strictEqual(RK.wert(10000), 90);
  const d = RK.neu(tn, R.zufall(9));
  let t = 1000;
  RK.start(d, t, ctx(tn));
  assert.strictEqual(d.schritt, 'hochfahren');
  assert(d.knall - d.start >= 3000 && d.knall - d.start <= 18000);
  // Geheim: Explosion und Zufall fehlen in der Sicht
  const v = RK.sicht(d, 'a');
  assert(!('knall' in v) && !('zufall' in v));
  assert.notStrictEqual(RK.aktion(d, 'a', { a: 'raus', z: t }, t), true, 'noch nicht gestartet');
  t = d.start; RK.takt(d, t, ctx(tn));
  assert.strictEqual(d.schritt, 'laeuft');
  d.knall = d.start + 10000;   // für den Test festgelegt
  // a springt nach 2 s; Zeitstempel zählt, aber höchstens 1 s vor der Ankunft
  assert.strictEqual(RK.aktion(d, 'a', { a: 'raus', z: d.start + 2000 }, d.start + 2400), true);
  assert.strictEqual(d.sprung.a.ms, 2000); assert.strictEqual(d.sprung.a.wert, RK.wert(2000));
  RK.aktion(d, 'b', { a: 'raus', z: d.start + 1000 }, d.start + 6000);
  assert.strictEqual(d.sprung.b.ms, 5000, 'zu alter Zeitstempel wird begrenzt');
  RK.aktion(d, 'b', { a: 'raus', z: d.start + 9000 }, d.start + 9000);
  assert.strictEqual(d.sprung.b.ms, 5000, 'nur ein Sprung');
  const vb = RK.sicht(d, 'b');
  assert.deepStrictEqual(Object.keys(vb.sprung), ['b'], 'fremde Sprünge verdeckt');
  // Knall bei 10 s; c ist noch drin. Ein Sprung kurz vor dem Knall, der knapp danach ankommt, zählt
  t = d.knall; RK.takt(d, t, ctx(tn));
  assert.strictEqual(d.schritt, 'knall');
  assert.strictEqual(RK.aktion(d, 'c', { a: 'raus', z: d.knall + 50 }, d.knall + 300), 'Zu spät!');
  assert.strictEqual(RK.aktion(d, 'c', { a: 'raus', z: d.knall - 100 }, d.knall + 400), true);
  assert.strictEqual(d.sprung.c.ms, 9900);
  t += 1000; RK.takt(d, t, ctx(tn));
  assert.strictEqual(d.schritt, 'aufloesung');
  const e = d.verlauf[0];
  assert.deepStrictEqual(e.letzter, ['c']);
  assert.strictEqual(d.punkte.c, RK.wert(9900) + RK.BONUS); assert.strictEqual(d.punkte.b, RK.wert(5000));
  assert.strictEqual(RK.sicht(d, 'a').knall, d.knall, 'nach der Auflösung sichtbar');
  // Durchgang 2: niemand springt → alle 0
  t += 7000; RK.takt(d, t, ctx(tn)); assert.strictEqual(d.dg, 2);
  t = d.start; RK.takt(d, t, ctx(tn)); t = d.knall; RK.takt(d, t, ctx(tn)); t += 1000; RK.takt(d, t, ctx(tn));
  assert(Object.values(d.verlauf[1].ergebnis).every(x => x.wert === 0 && x.bonus === 0));
  // Durchgang 3: alle springen gleichzeitig → endet früh
  t += 7000; RK.takt(d, t, ctx(tn)); t = d.start; RK.takt(d, t, ctx(tn));
  for (const p of tn) RK.aktion(d, p, { a: 'raus', z: t + 500 }, t + 500);
  t += 600; RK.takt(d, t, ctx(tn)); assert.strictEqual(d.schritt, 'knall', 'alle raus → früher Schluss');
  t += 1000; RK.takt(d, t, ctx(tn));
  assert.deepStrictEqual(d.verlauf[2].letzter.sort(), tn, 'Gleichstand: alle bekommen den Bonus');
  t += 7000; RK.takt(d, t, ctx(tn)); assert(d.fertig);
  assert(Object.values(RK.wertung(d)).every(x => typeof x === 'number'));
  // Nur einer springt: er ist der Letzte vor dem Knall und bekommt den Bonus
  const d2 = RK.neu(['a', 'b'], R.zufall(3)); RK.start(d2, 0, ctx(['a', 'b'])); RK.takt(d2, d2.start, ctx(['a', 'b']));
  RK.aktion(d2, 'a', { a: 'raus', z: d2.start + 1000 }, d2.start + 1000);
  RK.takt(d2, d2.knall, ctx(['a', 'b'])); RK.takt(d2, d2.knall + 1000, ctx(['a', 'b']));
  assert.deepStrictEqual(d2.verlauf[0].letzter, ['a']);
  // Bots: in vielen Durchgängen springt mal jemand, mal nicht
  let raus = 0, drin = 0;
  for (let s = 1; s < 100; s++) {
    const f = RK.neu(tn, R.zufall(s)); RK.start(f, 0, ctx(tn)); const rng = R.zufall(s * 7);
    for (let k = 0; k < 300 && !f.fertig; k++) {
      const jetzt = k * 200;
      for (const p of tn) { const m = RK.bot(f, p, rng, jetzt); if (m) RK.aktion(f, p, m, jetzt); }
      RK.takt(f, jetzt, ctx(tn));
    }
    for (const v of f.verlauf) for (const p of tn) v.ergebnis[p].ms === null ? drin++ : raus++;
  }
  assert(raus > drin * 0.8 && drin > raus * 0.1, `Bots plausibel: ${raus} raus, ${drin} drin`);
  console.log(`Missionen ok (Reaktor-Bots: ${raus} raus, ${drin} explodiert)`);
}

// ---------- Mission-Startwert bleibt geheim ----------
{
  const S = R.neu('SEED', 'h', 'Host'); S.online = ['h'];
  R.aktion(S, 'h', { t: 'bot', dazu: true }, 0);
  assert(R.aktion(S, 'h', { t: 'mission', id: 'reaktor' }, 0).ok);
  const v = R.sicht(S, 'h');
  assert(!('seed' in v.mission), 'kein Startwert');
  assert(!('knall' in v.mission.d) && !('zufall' in v.mission.d));
}

// ---------- Zerfallender Asteroid ----------
{
  const A = R.MISSIONEN.asteroid, tn = ['a', 'b', 'c'];
  const d = A.neu(tn, R.zufall(4));
  const c = ctx(tn, tn);
  // Rammen: der erste Zähler setzt nur den Stand, erst ein höherer stößt
  A.schritt(d, 0.033, { a: { x: 1, y: 0, k: 5 } }, 0, c);
  assert.strictEqual(d.sp.a.rammt, -9999);
  A.schritt(d, 0.033, { a: { x: 1, y: 0, k: 6 } }, 0, c);
  assert(d.sp.a.rammt > -9999 && d.sp.a.vx > 1, 'Stoß nach rechts');
  // Zusammenstoß überträgt Schwung
  const d2 = A.neu(['a', 'b'], R.zufall(1));
  Object.assign(d2.sp.a, { x: -0.2, y: 0, vx: 1, vy: 0 }); Object.assign(d2.sp.b, { x: 0, y: 0, vx: 0, vy: 0 });
  for (let i = 0; i < 8; i++) A.schritt(d2, 0.033, {}, 0, ctx(['a', 'b']));
  assert(d2.sp.b.vx > 0.5 && d2.sp.a.vx < 0.4, 'b wird weggeschubst');
  // Wer über den Rand rollt, wird zur Drohne; mit einem Übrigen endet es nach kurzem Nachlauf
  Object.assign(d2.sp.b, { x: 0.5, y: 0, vx: 1.2 });
  let anders = false;
  for (let i = 0; i < 40 && d2.sp.b.drin; i++) anders = A.schritt(d2, 0.033, {}, 0, ctx(['a', 'b'])) || anders;
  assert(!d2.sp.b.drin && anders && d2.endeBei !== null);
  for (let i = 0; i < 60 && !d2.fertig; i++) A.schritt(d2, 0.033, { b: { x: 1, y: 0, k: 1 } }, 0, ctx(['a', 'b']));
  assert(d2.fertig);
  const w = A.wertung(d2); assert(w.a > w.b, 'Überlebender vorn');
  // Drohne lässt Öl fallen
  const d3 = A.neu(['a', 'b'], R.zufall(2)); d3.sp.b.drin = false; d3.sp.b.fiel = 0; d3.k.b = 0; d3.t = 5000;
  A.schritt(d3, 0.033, { b: { x: 0, y: 0, k: 1 } }, 0, ctx(['a', 'b']));
  assert.strictEqual(d3.oel.length, 1);
  // Bild ist klein
  assert(JSON.stringify(A.bild(d)).length < 900);
  // Mit Bots über R.liveSchritt bis zum Ende
  const S = R.neu('AST', 'h', 'Host'); S.online = ['h'];
  R.aktion(S, 'h', { t: 'bot', dazu: true }, 0); R.aktion(S, 'h', { t: 'bot', dazu: true }, 0);
  assert(R.aktion(S, 'h', { t: 'mission', id: 'asteroid' }, 0).ok);
  let t = 0; R.aktion(S, 'h', { t: 'bereit' }, t); R.takt(S, t); t += 3600; R.takt(S, t);
  assert.strictEqual(S.mission.schritt, 'spiel');
  let i = 0;
  while (S.mission.schritt === 'spiel' && i++ < 4000) { t += 33; R.liveSchritt(S, t, { h: { x: 0, y: 0, k: 0 } }); if (i % 6 === 0) R.takt(S, t); }
  assert.strictEqual(S.mission.schritt, 'ergebnis', 'Asteroid endet');
  assert(t < 95000);
  console.log('Asteroid:', S.mission.ergebnis.map(e => `${e.pid} ${e.wert}s`).join(', '), '· Rand', S.mission.d.rand.reduce((a, b) => a + b, 0).toFixed(1));
  assert.strictEqual(R.liveBild(S), null, 'nach dem Spiel kein Bild');
  // Live-Puffer: glatt zwischen zwei Bildern
  const L = window.ORBIT_LIVE;
  L.empfang(1, { t: 0 }, 1000); L.empfang(1, { t: 100 }, 1100);
  const z = L.zwischen(1, 1150); assert.strictEqual(z.a.t, 0); assert(Math.abs(z.f - 0.5) < 1e-9);
  L.eingang('x', { x: 3, y: -0.5, k: 2, l: 120 }); assert.deepStrictEqual(L.eingaben(0).x, { x: 1, y: -0.5, k: 2 });
  assert.strictEqual(L.verzoegerung(), 60);
  L.eigeneEingabe('h', { x: 1, y: 0, k: 0 }, 1000);
  assert(!L.eingaben(1030).h, 'Spielleiter verzögert'); assert(L.eingaben(1070).h);
}

// ---------- Rettungskapseln ----------
{
  const K = R.MISSIONEN.kapseln, tn = ['a', 'b', 'c', 'd'];
  const d = K.neu(tn);
  let t = 0;
  K.start(d, t, ctx(tn));
  assert.strictEqual(d.kapseln, 3); assert.strictEqual(d.ausloeser, null); assert.strictEqual(d.schritt, 'bereit');
  assert.strictEqual(K.sicht(d, 'a').bis, 0, 'Zeitpunkt des Alarms geheim');
  assert.strictEqual(K.aktion(d, 'a', { a: 'kapsel', k: 0, z: t }, t), 'Noch kein Alarm!');
  t = d.bis; K.takt(d, t, ctx(tn));
  assert.strictEqual(d.schritt, 'alarm'); const ab = d.signal.ab; assert.strictEqual(ab, t + 400);
  assert.strictEqual(K.aktion(d, 'a', { a: 'kapsel', k: 0, z: ab - 50 }, ab - 50), 'Zu früh!');
  assert.strictEqual(K.aktion(d, 'a', { a: 'kapsel', k: 0, z: ab + 400 }, ab + 500), true);
  // b tippt dieselbe Kapsel mit früherem Zeitstempel, kommt aber später an → b bekommt sie, a muss neu wählen
  assert.strictEqual(K.aktion(d, 'b', { a: 'kapsel', k: 0, z: ab + 300 }, ab + 700), true);
  assert.strictEqual(d.belegt[0].pid, 'b');
  assert.strictEqual(K.aktion(d, 'c', { a: 'kapsel', k: 0, z: ab + 600 }, ab + 700), 'Schon besetzt! Schnell eine andere!');
  K.aktion(d, 'c', { a: 'kapsel', k: 1, z: ab + 650 }, ab + 700);
  K.aktion(d, 'a', { a: 'kapsel', k: 2, z: ab + 800 }, ab + 850);
  // d hat keine Kapsel; alle drei voll → nach der Nachfrist Auflösung
  K.takt(d, ab + 900, ctx(tn)); assert.strictEqual(d.schritt, 'alarm');
  K.takt(d, ab + 1600, ctx(tn)); assert.strictEqual(d.schritt, 'aufloesung');
  assert.deepStrictEqual(d.verlauf[0].raus, ['d']); assert.strictEqual(d.verlauf[0].zeit.b, 300);
  // Runde 2: d löst aus, Testalarm, c fällt darauf herein
  t = ab + 1600 + 5000; K.takt(d, t, ctx(tn));
  assert.strictEqual(d.runde, 2); assert.strictEqual(d.ausloeser, 'd'); assert.strictEqual(d.kapseln, 2);
  assert.notStrictEqual(K.aktion(d, 'a', { a: 'alarm', art: 'echt' }, t), true, 'nur der Auslöser');
  assert.strictEqual(K.aktion(d, 'd', { a: 'alarm', art: 'test' }, t), true);
  assert.strictEqual(K.aktion(d, 'c', { a: 'kapsel', k: 0, z: t + 600 }, t + 650), true);
  assert(d.falle.c);
  assert.strictEqual(K.aktion(d, 'c', { a: 'kapsel', k: 0, z: t + 700 }, t + 750), 'Du bist beim Testalarm eingestiegen.');
  K.takt(d, t + 2400, ctx(tn)); assert.strictEqual(d.signal, null);
  K.aktion(d, 'd', { a: 'alarm', art: 'echt' }, t + 3000);
  const ab2 = d.signal.ab;
  K.aktion(d, 'a', { a: 'kapsel', k: 0, z: ab2 + 500 }, ab2 + 500); K.aktion(d, 'b', { a: 'kapsel', k: 1, z: ab2 + 450 }, ab2 + 500);
  K.takt(d, ab2 + 1300, ctx(tn));
  assert.deepStrictEqual(d.verlauf[1].raus, ['c']);
  // Runde 3: a gegen b, eine Kapsel; Auslöser ist c (gerade raus)
  t = ab2 + 1300 + 5000; K.takt(d, t, ctx(tn));
  assert.strictEqual(d.ausloeser, 'c'); assert.strictEqual(d.kapseln, 1);
  t += 9000; K.takt(d, t, ctx(tn)); assert.strictEqual(d.schritt, 'alarm', 'Auslöser trödelt → Alarm von selbst');
  K.aktion(d, 'a', { a: 'kapsel', k: 0, z: d.signal.ab + 400 }, d.signal.ab + 400);
  K.takt(d, d.signal.ab + 1200, ctx(tn)); assert.strictEqual(d.schritt, 'aufloesung');
  K.takt(d, d.signal.ab + 7000, ctx(tn)); assert(d.fertig);
  assert.deepStrictEqual(K.wertung(d), { a: 3, b: 2, c: 1, d: 0 });
  // Mit Bots durchspielen
  let auf = 0, test = 0;
  for (let s = 1; s < 60; s++) {
    const e = K.neu(tn); K.start(e, 0, ctx(tn)); const rng = R.zufall(s);
    for (let j = 0; j < 2000 && !e.fertig; j++) {
      const jetzt = j * 200;
      for (const p of tn) { const m = K.bot(e, p, rng, jetzt); if (m) K.aktion(e, p, m, jetzt); }
      K.takt(e, jetzt, { tn, aktiv: tn, rng });
    }
    assert(e.fertig, 'Bots spielen zu Ende'); auf++;
    test += e.verlauf.reduce((n, v) => n + v.falle.length, 0);
  }
  console.log(`Rettungskapseln ok (${auf} Spiele, ${test}× auf Testalarm hereingefallen)`);
}

// Live-Mission mit Bots über R.liveSchritt zu Ende spielen (h ist ein Mensch, der nichts tut)
function liveLauf(id, bots, ein, einzelner) {
  const S = R.neu('L' + id, 'h', 'Host'); S.online = ['h'];
  for (let i = 0; i < bots; i++) R.aktion(S, 'h', { t: 'bot', dazu: true }, 0);
  assert(R.aktion(S, 'h', { t: 'mission', id, einzelner }, 0).ok);
  let t = 0; R.aktion(S, 'h', { t: 'bereit' }, t); R.takt(S, t); t += 3600; R.takt(S, t);
  assert.strictEqual(S.mission.schritt, 'spiel');
  let i = 0;
  while (S.mission.schritt === 'spiel' && i++ < 6000) { t += 33; R.liveSchritt(S, t, { h: ein || { x: 0, y: 0, k: 0 } }); if (i % 6 === 0) R.takt(S, t); }
  assert.strictEqual(S.mission.schritt, 'ergebnis', id + ' endet');
  return S;
}

// ---------- Terraforming ----------
{
  const T = R.MISSIONEN.terraforming, tn = ['a', 'b'], rng = R.zufall(3), c = { tn, rng };
  const d = T.neu(tn, rng), { N, GUELTIG, anteile } = T.raster;
  const a0 = anteile(d.g, 2);
  assert(a0[1] > 2 && Math.abs(a0[1] - a0[2]) < 0.5, 'beide starten mit etwa gleich viel Fläche');
  // a fährt nach rechts und malt dabei
  d.sp.a.x = -0.5; d.sp.a.y = 0; d.sp.b.x = 0.5; d.sp.b.y = 0.6;
  for (let i = 0; i < 20; i++) T.schritt(d, 0.033, { a: { x: 1, y: 0, k: 0 }, b: { x: 0, y: 0, k: 0 } }, 0, c);
  assert(d.sp.a.x > -0.4, 'a bewegt sich');
  const a1 = anteile(d.g, 2); assert(a1[1] > a0[1], 'a hat mehr Fläche');
  // Übermalen: b fährt über a's Fläche
  d.sp.b.x = d.sp.a.x - 0.15; d.sp.b.y = 0; d.sp.b.vx = d.sp.b.vy = 0;
  T.schritt(d, 0.033, { a: { x: 0, y: -1, k: 0 }, b: { x: 0, y: 0, k: 0 } }, 0, c);
  assert(anteile(d.g, 2)[1] < a1[1], 'b übermalt a');
  // Rand: Rover bleibt auf dem Planeten
  d.sp.a.x = 0.9; d.sp.a.y = 0; d.sp.a.vx = 2;
  for (let i = 0; i < 10; i++) T.schritt(d, 0.033, { a: { x: 1, y: 0, k: 0 } }, 0, c);
  assert(Math.hypot(d.sp.a.x, d.sp.a.y) <= 1, 'Rover bleibt auf dem Planeten');
  // Saatkapsel aufsammeln und zünden
  d.kapseln = [{ x: 0, y: -0.5, id: 99 }]; d.sp.a.x = 0; d.sp.a.y = -0.5; d.sp.a.vx = d.sp.a.vy = 0;
  assert(T.schritt(d, 0.033, { a: { x: 0, y: 0, k: 0 } }, 0, c), 'Aufsammeln ist ein Ereignis');
  assert.strictEqual(d.sp.a.bomben, 1); assert.strictEqual(d.kapseln.length, 0);
  const vor = anteile(d.g, 2)[1];
  T.schritt(d, 0.033, { a: { x: 0, y: 0, k: 1 } }, 0, c);
  assert.strictEqual(d.sp.a.bomben, 0); assert(anteile(d.g, 2)[1] - vor > 3, 'Saatbombe begrünt viel');
  T.schritt(d, 0.033, { a: { x: 0, y: 0, k: 2 } }, 0, c);
  assert.strictEqual(d.knall.length, 1, 'ohne Bombe kein Knall');
  // Bild und Sicht
  const b = T.bild(d); assert.strictEqual(b.g.length, N * N); assert(JSON.stringify(b).length < 1500);
  T.botEingabe(d, 'b', rng); assert(d.botZiel); assert(!('botZiel' in T.sicht(d)));
  const w = T.wertung(d); assert(w.a + w.b <= 100.01 && w.a > 0 && w.b > 0);
  // Mit Bots: endet nach 60 s, Bots begrünen viel
  const S = liveLauf('terraforming', 3);
  assert(Math.abs(S.mission.d.t - 60000) < 100);
  const e = S.mission.ergebnis, summe = e.reduce((n, x) => n + x.wert, 0);
  assert(summe > 60 && summe <= 100.01, 'Planet ist zum Großteil begrünt: ' + summe);
  assert.strictEqual(e[e.length - 1].pid, 'h', 'wer still steht, verliert');
  console.log('Terraforming ok:', e.map(x => `${x.pid} ${x.wert} %`).join(', '));
}

// ---------- Ionenspur ----------
{
  const I = R.MISSIONEN.ionenspur, tn = ['a', 'b'], rng = R.zufall(4), c = { tn, rng };
  const setze = (d, p, x, y, w) => Object.assign(d.sp[p], { x, y, w, spur: [[x, y]], luecke: 1e9, offen: false });
  // Geradeaus gegen die Wand
  let d = I.neu(tn, rng); d.laeufe = 1;
  setze(d, 'a', 0.8, 0, 0); setze(d, 'b', -0.5, -0.5, Math.PI / 2);
  let i = 0; while (d.sp.a.drin && i++ < 100) I.schritt(d, 0.033, {}, 0, c);
  assert(!d.sp.a.drin && d.sp.b.drin, 'a fliegt gegen die Wand'); assert(d.sp.a.fiel > 500 && d.sp.a.fiel < 1500, 'Wand nach ' + d.sp.a.fiel);
  assert(d.endeBei !== null, 'nur noch einer übrig');
  while (!d.fertig) I.schritt(d, 0.033, {}, 0, c);
  assert(d.t - d.endeBei < 50, 'Nachlauf');
  let w = I.wertung(d); assert(w.b > w.a);
  // Quer durch eine fremde Spur
  d = I.neu(tn, rng); d.laeufe = 1;
  setze(d, 'b', -0.6, 0, 0); setze(d, 'a', 0, -0.75, Math.PI / 2);
  for (let k = 0; k < 200 && d.sp.a.drin; k++) I.schritt(d, 0.033, {}, 0, c);
  assert(!d.sp.a.drin, 'a stößt gegen b\'s Spur'); assert(Math.abs(d.sp.a.y) < 0.05, 'genau an der Spur: ' + d.sp.a.y);
  // … mit Lücke kommt man durch
  d = I.neu(tn, rng); d.laeufe = 1;
  setze(d, 'b', -0.6, 0, 0); setze(d, 'a', 0, -0.75, Math.PI / 2);
  for (let k = 0; k < 200 && d.sp.a.drin && d.sp.a.y < 0.5; k++) {
    if (d.sp.b.luecke > 1e8 && d.sp.b.x > -0.04) d.sp.b.luecke = d.t;   // Lücke genau dort, wo a kreuzt
    I.schritt(d, 0.033, {}, 0, c);
  }
  assert(d.sp.a.drin, 'durch die Lücke geschlüpft'); assert(d.sp.b.spur.includes(null), 'Lücke steht in der Spur');
  // Eigene Spur: im Kreis fliegen
  d = I.neu(tn, rng); d.laeufe = 1;
  setze(d, 'a', 0, 0, 0); setze(d, 'b', -0.8, -0.8, Math.PI / 2);
  for (let k = 0; k < 200 && d.sp.a.drin; k++) I.schritt(d, 0.033, { a: { x: 1 } }, 0, c);
  assert(!d.sp.a.drin, 'gegen die eigene Spur'); assert(d.sp.a.fiel > 1500 && d.sp.a.fiel < 4500, 'nach ein, zwei Runden: ' + d.sp.a.fiel);
  // Frontal
  d = I.neu(tn, rng); d.laeufe = 1;
  setze(d, 'a', -0.3, 0, 0); setze(d, 'b', 0.3, 0, Math.PI);
  for (let k = 0; k < 60 && d.sp.a.drin; k++) I.schritt(d, 0.033, {}, 0, c);
  assert(!d.sp.a.drin && !d.sp.b.drin && d.sp.a.fiel === d.sp.b.fiel, 'beide gleichzeitig raus');
  assert(d.fertig || d.endeBei === d.t);
  // Bild: nur das Ende der Spur; Sicht ohne Raster
  d = I.neu(tn, rng); d.laeufe = 1;
  for (let k = 0; k < 90; k++) I.schritt(d, 0.033, { a: { x: 0.3 }, b: { x: -0.3 } }, 0, c);
  const b = I.bild(d);
  assert(b.s[0][1].length <= 30 && b.s[0][0] + b.s[0][1].length === d.sp.a.spur.length);
  const v = I.sicht(d); assert(!v.belegt && !v.zeit && v.sp.a.spur.length);
  assert(I.botEingabe(d, 'b', rng).x !== undefined); assert(!('botLenk' in I.sicht(d)));
  // Drei Läufe: Pause, neu aufstellen, Zeiten addieren
  d = I.neu(tn, rng);
  setze(d, 'a', 0.8, 0, 0); setze(d, 'b', -0.5, -0.5, Math.PI / 2);
  for (let k = 0; k < 400 && d.lauf === 1; k++) I.schritt(d, 0.033, {}, 0, c);
  assert.strictEqual(d.lauf, 2, 'nach der Pause kommt Lauf 2'); assert(d.summe.b > d.summe.a && d.summe.a > 500);
  assert(d.sp.a.drin && d.sp.b.drin && d.t < 100 && d.belegt.every(x => !x), 'alles neu aufgestellt');
  const nachLauf1 = I.wertung(d);
  while (!d.fertig) I.schritt(d, 0.033, {}, 0, c);
  assert.strictEqual(d.lauf, 3); const w3 = I.wertung(d);
  assert(w3.a > nachLauf1.a && w3.b > nachLauf1.b, 'Zeiten addiert');
  assert(I.bild(d).l === 3);
  // Mit Bots: endet, Bots halten länger durch als einer, der nur geradeaus fliegt
  const dauer = [];
  for (const nb of [1, 3, 5]) {
    const S = liveLauf('ionenspur', nb);
    const e = S.mission.ergebnis; dauer.push(S.mission.d.uhr); assert.strictEqual(S.mission.d.lauf, 3);
    assert.strictEqual(e[e.length - 1].pid, 'h', 'geradeaus fliegen reicht nicht');
    assert(JSON.stringify(R.sicht(S, 'h')).length < 40000);
  }
  console.log('Ionenspur ok, 3 Läufe dauern', dauer.map(x => Math.round(x / 1000) + ' s').join(', '));
}

// ---------- Gestaltwandler ----------
{
  const G = R.MISSIONEN.gestaltwandler, H = G.hilfe, tn = ['a', 'b', 'c'], rng = R.zufall(6), c = { tn, aktiv: tn, bots: [], rng };
  const d = G.neu(tn, rng, 'b');
  assert.strictEqual(d.einzelner, 'b');
  // Die Wege der Roboter sind auf jedem Handy gleich und bleiben in der Halle
  const p1 = H.plaene(d.rs), p2 = H.plaene(d.rs);
  assert.deepStrictEqual(H.roboter(p1, 7, 12345), H.roboter(p2, 7, 12345));
  assert.notDeepStrictEqual(H.roboter(H.plaene(d.rs + 1), 7, 12345), H.roboter(p1, 7, 12345));
  let drin = true, besucht = H.KONSOLEN.map(() => 0), proben = 0;
  for (let t = 0; t < H.DAUER; t += 250) {
    proben++;
    const nah = H.KONSOLEN.map(() => false);
    for (let r = 0; r < H.ROBOTER; r++) {
      const q = H.roboter(p1, r, t);
      if (Math.abs(q.x) > 0.9 || Math.abs(q.y) > 0.9) drin = false;
      H.KONSOLEN.forEach((k, i) => { if (Math.hypot(k[0] - q.x, k[1] - q.y) < H.KR) nah[i] = true; });
    }
    nah.forEach((x, i) => { if (x) besucht[i]++; });
  }
  assert(drin, 'Roboter bleiben in der Halle');
  assert(besucht.every(n => n / proben > 0.5), 'an jeder Konsole steht meistens ein Roboter: ' + besucht.map(n => Math.round(n / proben * 100) + '%'));
  // Alien bewegt sich mit dem Daumen
  G.start(d, 0, c);
  d.a.x = -0.5; d.a.y = 0.5;
  for (let i = 0; i < 30; i++) G.schritt(d, 0.033, { b: { x: 1, y: 0 } }, 0, c);
  assert(d.a.x > -0.3 && Math.abs(d.a.y - 0.5) < 1e-9, 'nach rechts: ' + d.a.x);
  assert(Math.hypot(d.a.vx, d.a.vy) <= 0.34, 'nicht schneller als ein flotter Roboter');
  // Sabotage: 2,5 s an der Konsole in der Mitte; wer vorher weggeht, fängt von vorn an
  Object.assign(d.a, { x: 0.02, y: 0.01, vx: 0, vy: 0 });
  for (let i = 0; i < 50; i++) G.schritt(d, 0.033, {}, 0, c);
  assert.strictEqual(d.am, 3); assert(d.fort > 1500 && !d.sabotiert.length);
  Object.assign(d.a, { x: 0.4, y: 0.4 }); G.schritt(d, 0.033, {}, 0, c);
  assert.strictEqual(d.am, -1); assert.strictEqual(d.fort, 0);
  Object.assign(d.a, { x: 0.02, y: 0.01 });
  for (let i = 0; i < 80; i++) G.schritt(d, 0.033, {}, 0, c);
  assert.deepStrictEqual(d.sabotiert.map(s => s.k), [3], 'Mitte sabotiert');
  for (let i = 0; i < 80; i++) G.schritt(d, 0.033, {}, 0, c);
  assert.strictEqual(d.sabotiert.length, 1, 'dieselbe Konsole zählt nur einmal');
  // Was die Crew sieht: keinen Fortschritt
  Object.assign(d.a, { x: 0.86, y: 0 }); for (let i = 0; i < 20; i++) G.schritt(d, 0.033, {}, 0, c);
  assert.strictEqual(d.am, 4);
  assert.strictEqual(G.sicht(d, 'a').am, -1); assert.strictEqual(G.sicht(d, 'b').am, 4);
  const b = G.bild(d);
  assert(b.f > 0 && G.bildFuer(b, d, 'b').f === b.f && G.bildFuer(b, d, 'a').f === 0 && G.bildFuer(b, d, 'a').k === -1);
  assert.deepStrictEqual(G.bildFuer(b, d, 'c').a, b.a, 'die Position des Aliens sehen alle');
  // Verdächtigungen: zusammen 2
  assert.strictEqual(G.aktion(d, 'b', { a: 'verdacht', z: 3 }), 'Du bist das Alien.');
  assert.strictEqual(G.aktion(d, 'a', { a: 'verdacht', z: 5 }), true);
  assert.deepStrictEqual(d.harmlos, [5]);
  assert.strictEqual(G.aktion(d, 'c', { a: 'verdacht', z: 5 }), 'Dieser Roboter ist schon überprüft.');
  assert.strictEqual(G.aktion(d, 'c', { a: 'verdacht', z: 9 }), true);
  assert.strictEqual(G.aktion(d, 'a', { a: 'verdacht', z: H.ALIEN }), 'Ihr habt keine Verdächtigung mehr.');
  assert(!d.ende);
  // Noch zwei Sabotagen → das Alien gewinnt (nach der Enthüllung)
  for (const k of [0, 6]) { Object.assign(d.a, { x: H.KONSOLEN[k][0] * 0.95, y: H.KONSOLEN[k][1] * 0.95 }); for (let i = 0; i < 80; i++) G.schritt(d, 0.033, {}, 0, c); }
  assert.strictEqual(d.sabotiert.length, 3); assert.strictEqual(d.ende.art, 'sabotage'); assert(!d.fertig);
  for (let i = 0; i < 120; i++) G.schritt(d, 0.033, {}, 0, c);
  assert(d.fertig); assert.strictEqual(G.ausgang(d), 'einzeln');
  assert.strictEqual(G.wertText(d, 'b'), 'Alien · 3 von 3 Konsolen sabotiert');
  // Treffer: die Crew gewinnt
  const e = G.neu(tn, rng, 'a'); G.start(e, 0, c);
  assert.strictEqual(G.aktion(e, 'c', { a: 'verdacht', z: H.ALIEN }), true);
  assert.strictEqual(e.ende.art, 'erwischt'); assert.strictEqual(G.ausgang(e), 'crew');
  assert.strictEqual(G.wertText(e, 'c'), 'Crew · hat das Alien entlarvt');
  // Ganze Mission über den Spielleiter: der Mensch ist das Alien und steht still → Zeit um, die Crew gewinnt je 6
  const S = liveLauf('gestaltwandler', 3, null, 'h');
  const m = S.mission, eg = m.ergebnis;
  assert.strictEqual(m.einzelner, 'h'); assert.strictEqual(m.d.ende.art, 'zeit');
  assert(Math.abs(m.d.t - H.DAUER - H.ENTHUELLUNG) < 100);
  assert.deepStrictEqual(eg.map(x => x.energie), [6, 6, 6, 0]); assert.strictEqual(eg[3].pid, 'h'); assert.strictEqual(eg[3].rolle, 'einzeln');
  assert(eg.slice(0, 3).every(x => x.platz === 1 && x.rolle === 'crew')); assert.strictEqual(eg[3].platz, 2);
  // Bots in der Crew raten nur, wenn kein Mensch in der Crew ist
  const S2 = liveLauf('gestaltwandler', 3, null, 'bot1');
  assert.strictEqual(S2.mission.d.verdacht.length, 0, 'mit Mensch in der Crew raten Bots nicht');
  // Bot als Alien gegen eine Bot-Crew: beide Seiten gewinnen mal
  let alien = 0;
  for (let s = 1; s <= 12; s++) {
    const T = R.neu('G' + s, 'h', 'Host'); T.online = ['h']; T.seed = s * 131;
    for (let i = 0; i < 3; i++) R.aktion(T, 'h', { t: 'bot', dazu: true }, 0);
    R.aktion(T, 'h', { t: 'mission', id: 'gestaltwandler', einzelner: 'bot1' }, 0);
    let t = 0; R.aktion(T, 'h', { t: 'bereit' }, t); R.takt(T, t); t += 3600; R.takt(T, t);
    T.mission.d.botsRaten = true;   // als wäre h nicht da
    for (let i = 0; i < 6000 && T.mission.schritt === 'spiel'; i++) { t += 33; R.liveSchritt(T, t, {}); if (i % 6 === 0) R.takt(T, t); }
    assert.strictEqual(T.mission.schritt, 'ergebnis');
    if (T.mission.ergebnis.find(x => x.pid === 'bot1').platz === 1) alien++;
  }
  assert(alien > 0 && alien < 12, 'Bot-Alien gewinnt ' + alien + ' von 12');
  console.log('Gestaltwandler ok, Bot-Alien gewinnt', alien, 'von 12');
}

// ---------- Alien im Frachtraum ----------
{
  const F = R.MISSIONEN.frachtraum, H = F.hilfe, tn = ['a', 'b', 'c'], rng = R.zufall(8), c = { tn, aktiv: tn, rng };
  const d = F.neu(tn, rng, 'c');
  F.start(d, 0, c);
  assert.strictEqual(d.proviant.length, 3);
  assert(d.sp.c.y < -0.5 && d.sp.a.y > 0.5, 'Alien oben, Crew unten');
  // Kisten halten auf
  const s = { x: -0.8, y: -0.47, vx: 1, vy: 0 };
  for (let i = 0; i < 30; i++) { s.x += s.vx * 0.033; H.kollision(s, 0.05); }
  assert(s.x <= -0.62 - 0.05 + 1e-6, 'vor der Kiste gestoppt: ' + s.x);
  // Licht: im Kegel ja, dahinter nein, hinter einer Kiste nein
  Object.assign(d.sp.a, { x: 0, y: 0.6, w: -Math.PI / 2 }); Object.assign(d.sp.b, { x: 0.9, y: 0.9, w: 0 });
  assert.strictEqual(H.lampen(d, 0.6, 0.9 - 0.4 * 0 + 0.0), 0, 'b leuchtet zur Wand');
  assert.strictEqual(H.lampen(d, 0, 0.25), 1, 'a leuchtet nach oben');
  assert.strictEqual(H.lampen(d, 0, 0.9), 0, 'nicht hinter a');
  assert.strictEqual(H.lampen(d, 0.03, 0.65), 1, 'direkt neben a ist es hell');
  Object.assign(d.sp.a, { x: 0, y: 0.4, w: -Math.PI / 2 });
  assert.strictEqual(H.lampen(d, 0, -0.25), 0, 'die Kiste in der Mitte wirft Schatten');
  assert(H.verdeckt(0, 0.4, 0, -0.25) && !H.verdeckt(0.5, 0.2, 0.5, -0.2));
  // Im Licht schmilzt der Schild, das Bild zeigt das Alien der Crew nur dann
  Object.assign(d.sp.c, { x: 0.8, y: -0.3, vx: 0, vy: 0 });
  F.schritt(d, 0.033, {}, 0, c);
  let b = F.bild(d);
  assert.strictEqual(b.l, 0); assert.strictEqual(F.bildFuer(b, d, 'a').p[2], null); assert(F.bildFuer(b, d, 'c').p[2]);
  assert.strictEqual(F.sicht(d, 'a').sp.c, null); assert(F.sicht(d, 'c').sp.c);
  Object.assign(d.sp.a, { x: 0.8, y: 0.3, w: -Math.PI / 2, vx: 0, vy: 0 });
  for (let i = 0; i < 30; i++) F.schritt(d, 0.033, {}, 0, c);
  b = F.bild(d);
  assert(b.l === 1 && d.schild < 0.6 && d.schild > 0.4, 'Schild nach 1 s im Licht: ' + d.schild);
  assert(F.bildFuer(b, d, 'a').p[2], 'im Licht sieht die Crew das Alien');
  // Schatten lädt nach 2 s langsam wieder auf
  Object.assign(d.sp.c, { x: -0.8, y: -0.8 }); const vor = d.schild;
  for (let i = 0; i < 120; i++) F.schritt(d, 0.033, {}, 0, c);
  assert(d.schild > vor && d.schild < vor + 0.2, 'lädt auf: ' + vor + ' → ' + d.schild);
  // Rennen macht Geräusche, Schleichen nicht
  const g0 = d.geraeusche.length;
  for (let i = 0; i < 20; i++) F.schritt(d, 0.033, { c: { x: 0.4, y: 0 } }, 0, c);
  assert.strictEqual(d.geraeusche.length, g0, 'schleichen ist leise');
  for (let i = 0; i < 30; i++) F.schritt(d, 0.033, { c: { x: 0, y: 1 } }, 0, c);
  assert(d.geraeusche.length > g0, 'rennen ist laut');
  // Fressen: Blitz und neuer Proviant
  const q = d.proviant[0]; Object.assign(d.sp.c, { x: q.x, y: q.y, vx: 0, vy: 0 });
  Object.assign(d.sp.a, { x: -0.9, y: 0.9, w: Math.PI }); Object.assign(d.sp.b, { x: -0.9, y: 0.85, w: Math.PI });
  F.schritt(d, 0.033, {}, 0, c);
  assert.strictEqual(d.gefressen, 1); assert.strictEqual(d.proviant.length, 2); assert.strictEqual(d.blitze.length, 1);
  for (let i = 0; i < 45; i++) F.schritt(d, 0.033, {}, 0, c);
  assert.strictEqual(d.proviant.length, 3, 'Nachschub');
  // 8 Proviant → das Alien gewinnt
  while (d.gefressen < H.ZIEL) { const p = d.proviant[0]; Object.assign(d.sp.c, { x: p.x, y: p.y, vx: 0, vy: 0 }); F.schritt(d, 0.033, {}, 0, c); if (!d.proviant.length) for (let i = 0; i < 45; i++) F.schritt(d, 0.033, {}, 0, c); }
  assert.strictEqual(d.ende.art, 'satt');
  for (let i = 0; i < 100; i++) F.schritt(d, 0.033, {}, 0, c);
  assert(d.fertig); assert.strictEqual(F.ausgang(d), 'einzeln');
  // Leerer Schild → die Crew gewinnt
  const e = F.neu(tn, rng, 'a'); F.start(e, 0, c);
  Object.assign(e.sp.a, { x: 0.8, y: -0.2 }); Object.assign(e.sp.b, { x: 0.8, y: 0.3, w: -Math.PI / 2 }); Object.assign(e.sp.c, { x: 0.7, y: 0.3, w: -Math.PI / 2 });
  for (let i = 0; i < 60 && !e.ende; i++) F.schritt(e, 0.033, {}, 0, c);
  assert.strictEqual(e.ende.art, 'erwischt'); assert(e.t < 1500, 'zwei Lampen: schnell erwischt ' + e.t);
  assert.strictEqual(F.ausgang(e), 'crew');
  // Über den Spielleiter: der Mensch ist Crew und steht still, die Bots spielen
  let alien = 0, dauer = 0;
  for (let s = 1; s <= 10; s++) {
    const T = R.neu('F' + s, 'h', 'Host'); T.online = ['h']; T.seed = s * 71;
    for (let i = 0; i < 3; i++) R.aktion(T, 'h', { t: 'bot', dazu: true }, 0);
    R.aktion(T, 'h', { t: 'mission', id: 'frachtraum', einzelner: 'bot2' }, 0);
    let t = 0; R.aktion(T, 'h', { t: 'bereit' }, t); R.takt(T, t); t += 3600; R.takt(T, t);
    for (let i = 0; i < 6000 && T.mission.schritt === 'spiel'; i++) { t += 33; R.liveSchritt(T, t, { h: { x: 0, y: 0, k: 0 } }); if (i % 6 === 0) R.takt(T, t); }
    assert.strictEqual(T.mission.schritt, 'ergebnis');
    const eg = T.mission.ergebnis, a = eg.find(x => x.pid === 'bot2');
    if (a.platz === 1) { alien++; assert.strictEqual(a.energie, 15); assert(eg.filter(x => x.pid !== 'bot2').every(x => x.energie === 0)); }
    else assert(eg.filter(x => x.pid !== 'bot2').every(x => x.energie === 6 && x.platz === 1));
    dauer += T.mission.d.t;
    assert(JSON.stringify(R.sicht(T, 'h')).length < 20000);
  }
  assert(alien > 0 && alien < 10, 'Bot-Alien gewinnt ' + alien + ' von 10');
  console.log('Frachtraum ok, Bot-Alien gewinnt', alien, 'von 10, Ø', Math.round(dauer / 10000), 's');
}

// ---------- Einer gegen alle auf dem Brett: Alien-Feld und Missionswahl ----------
{
  const S = R.neu('E', 'h', 'Host'); S.online = ['h'];
  for (let i = 0; i < 3; i++) R.aktion(S, 'h', { t: 'bot', dazu: true }, 0);
  assert(R.aktion(S, 'h', { t: 'partie', laenge: 'kurz' }, 0).ok);
  S.partie.alien = 'bot2';
  // Wer auf dem Alien-Feld stand, wird das Alien, danach ist das Feld verbraucht
  S.partie.gewaehlt = 'frachtraum'; S.partie.schritt = 'wetten'; S.partie.bis = 0; S.partie.wetten = {};
  R.takt(S, 1);
  assert.strictEqual(S.phase, 'mission'); assert.strictEqual(S.mission.einzelner, 'bot2'); assert.strictEqual(S.mission.d.einzelner, 'bot2');
  assert.strictEqual(S.partie.alien, null);
  // Ohne Alien-Feld: Zufall, aber immer einer aus der Runde
  const zahl = {};
  for (let s = 0; s < 40; s++) {
    const T = R.neu('E' + s, 'h', 'Host'); T.online = ['h']; T.seed = s * 13;
    for (let i = 0; i < 3; i++) R.aktion(T, 'h', { t: 'bot', dazu: true }, 0);
    R.aktion(T, 'h', { t: 'mission', id: 'gestaltwandler' }, 0);
    zahl[T.mission.einzelner] = (zahl[T.mission.einzelner] || 0) + 1;
  }
  assert.strictEqual(Object.keys(zahl).length, 4, 'jeder kann das Alien sein: ' + JSON.stringify(zahl));
  // Missionswahl: mit wartendem Alien ist eine „Einer gegen alle“-Mission dabei
  for (let s = 0; s < 30; s++) {
    const T = R.neu('W' + s, 'h', 'Host'); T.online = ['h']; T.seed = s * 17;
    for (let i = 0; i < 3; i++) R.aktion(T, 'h', { t: 'bot', dazu: true }, 0);
    R.aktion(T, 'h', { t: 'partie', laenge: 'kurz' }, 0);
    T.partie.alien = 'bot1';
    T.partie.reihe = []; T.partie.schritt = 'ziehen'; T.partie.zug = null;
    let t = 0; for (let i = 0; i < 40 && T.partie.schritt !== 'wahl'; i++) { t += 2000; R.takt(T, t); }
    assert.strictEqual(T.partie.schritt, 'wahl', 'Wahl erreicht');
    const o = T.partie.wahl.optionen;
    assert(o.length === 3 && o.some(id => R.MISSIONEN[id].art === 'Einer gegen alle'), 'Alien-Mission zur Wahl: ' + o);
  }
  console.log('Einer gegen alle auf dem Brett ok');
}

// ---------- Jeder für sich: Ablauf beim Spielleiter ----------
function soloLauf(id, bots, mensch) {
  const S = R.neu('S' + id, 'h', 'Host'); S.online = ['h'];
  for (let i = 0; i < bots; i++) R.aktion(S, 'h', { t: 'bot', dazu: true }, 0);
  assert(R.aktion(S, 'h', { t: 'mission', id }, 0).ok);
  let t = 0; R.aktion(S, 'h', { t: 'bereit' }, t); R.takt(S, t); t += 3600; R.takt(S, t);
  assert.strictEqual(S.mission.schritt, 'spiel');
  const d = S.mission.d;
  assert(d.rs > 0 && d.start === t, 'Startwert und Startzeit');
  assert(R.sicht(S, 'h').mission.d.bp === undefined, 'Bot-Läufe bleiben beim Spielleiter');
  let i = 0;
  while (S.mission.schritt === 'spiel' && i++ < 1000) { t += 200; if (mensch) mensch(S, t); R.takt(S, t); }
  assert.strictEqual(S.mission.schritt, 'ergebnis', id + ' endet');
  return { S, t };
}
{
  const G = R.MISSIONEN.greifarm, H = G.hilfe;
  // Gleicher Startwert, gleicher Schrott
  const a = H.neu(42), b = H.neu(42);
  assert.deepStrictEqual(a.teile.map(t => [t.typ, t.x]), b.teile.map(t => [t.typ, t.x]), 'gleicher Schrott auf allen Handys');
  assert.strictEqual(a.teile.length, 12);
  // Fahren mit Neigen
  a.schritt({ x: 1, g: 0 }, 0.5); assert(a.x > 0.2 + 0.4, 'Greifarm fährt nach rechts');
  // Greifen: ein Teil genau darunter legen, Griff stark genug
  const sim = H.neu(7); sim.teile = [{ id: 99, typ: 2, x: 0.2, y: 0.9, vx: 0, vy: 0, a: 0, da: 0 }]; sim.rngG = () => 1;
  sim.schritt({ x: 0, g: 1 }, 1 / 60); assert.strictEqual(sim.zust, 'runter');
  let n = 0; while (sim.zust !== 'fahren' && n++ < 2000) sim.schritt({ x: 0, g: 1 }, 1 / 60);
  assert.strictEqual(sim.punkte, H.TEILE[2].wert, 'Solarpaneel in der Luke');
  assert.strictEqual(sim.beute.length, 1); assert.strictEqual(sim.teile.length, 1, 'neues Teil treibt herein');
  // Schwacher Griff: der Satellit rutscht unterwegs heraus
  const s2 = H.neu(7); s2.teile = [{ id: 98, typ: 4, x: 0.5, y: 1.2, vx: 0, vy: 0, a: 0, da: 0 }]; s2.x = 0.5; s2.rngG = () => 0;
  s2.schritt({ x: 0, g: 1 }, 1 / 60); n = 0; while (s2.zust !== 'fahren' && n++ < 3000) s2.schritt({ x: 0, g: 1 }, 1 / 60);
  assert.strictEqual(s2.punkte, 0, 'rausgerutscht'); assert.strictEqual(s2.teile.length, 1, 'Satellit treibt wieder im Feld');
  assert(s2.meldung && s2.meldung.schlecht);
  // Leer greifen: nichts darunter
  const s3 = H.neu(7); s3.teile = []; s3.schritt({ x: 0, g: 1 }, 1 / 60); n = 0; while (s3.zust !== 'fahren' && n++ < 3000) s3.schritt({ x: 0, g: 1 }, 1 / 60);
  assert.strictEqual(s3.punkte, 0); assert.strictEqual(s3.q, null);
  // Ende nach 45 s, danach nimmt der Greifer nichts mehr
  const s4 = H.neu(9); n = 0; while (!s4.ende() && n++ < 10000) s4.schritt({ x: 0, g: 0 }, 1 / 60);
  assert(Math.abs(s4.t - H.DAUER) < 20, 'Ende nach 45 s');
  // Bots fangen etwas, aber nicht alles
  const werte = [1, 2, 3, 4, 5].map(s => H.botLauf(s * 1001, 'bot1').wert);
  assert(werte.every(w => w >= 5 && w <= 120), 'Bot-Greifarm: ' + werte);
  // Ablauf: Bots melden nach und nach, der Mensch meldet sein Ergebnis
  const { S } = soloLauf('greifarm', 2, (S, t) => { if (t > S.mission.d.start + 20000 && S.mission.d.erg.h === undefined) { R.aktion(S, 'h', { t: 'b', a: 'stand', wert: 7 }, t); R.aktion(S, 'h', { t: 'b', a: 'ende', wert: 9999 }, t); } });
  const e = S.mission.ergebnis;
  assert.strictEqual(e.find(x => x.pid === 'h').wert, 600, 'Ergebnis wird begrenzt');
  assert(e.filter(x => x.pid !== 'h').every(x => x.wert > 0), 'Bots haben gespielt');
  assert(R.aktion(S, 'h', { t: 'b', a: 'stand', wert: 1 }, 0).ok === false);
  // Ohne Meldung des Menschen endet die Mission nach der Zeit, sein letzter Stand zählt
  const r2 = soloLauf('greifarm', 1, (S, t) => { if (t < S.mission.d.start + 1000) R.aktion(S, 'h', { t: 'b', a: 'stand', wert: 4 }, t); });
  assert(r2.t - r2.S.mission.ergebnis.length >= 3600 + H.DAUER + H.NACHSPIEL, 'wartet bis zum Ende');
  assert.strictEqual(r2.S.mission.ergebnis.find(x => x.pid === 'h').wert, 4, 'letzter Stand zählt');
  console.log('Greifarm ok');
}
{
  const K = R.MISSIONEN.bordkueche, H = K.hilfe;
  const st = H.strecke(5), st2 = H.strecke(5);
  assert.deepStrictEqual(st.teile, st2.teile, 'gleiche Strecke auf allen Handys');
  assert(st.teile.some(t => t.k > 0) && st.teile.some(t => t.k < 0), 'Kurven nach links und rechts');
  assert(st.luft.length >= 2 && st.stoesse.length >= 2, 'Lüftungen und Schwellen');
  // Stehen bleiben: Becher bleiben auf dem Tablett
  const a = H.neu(5); for (let i = 0; i < 300; i++) a.schritt({ x: 0, y: 0, gehen: false }, 1 / 60);
  assert.strictEqual(a.becher.length, 5); assert.strictEqual(a.s, 0);
  // Neigen schiebt die Becher
  const mx = s => s.becher.reduce((q, b) => q + b.x, 0) / s.becher.length;
  const x0 = mx(a); for (let i = 0; i < 30; i++) a.schritt({ x: 1, y: 0, gehen: false }, 1 / 60);
  assert(mx(a) > x0 + 0.1, 'Neigen nach rechts schiebt die Becher nach rechts');
  // Losgehen schiebt die Becher nach hinten (unten)
  const b = H.neu(5), my0 = b.becher.reduce((q, c) => q + c.y, 0);
  for (let i = 0; i < 40; i++) b.schritt({ x: 0, y: 0, gehen: true }, 1 / 60);
  assert(b.becher.reduce((q, c) => q + c.y, 0) > my0 + 0.2, 'beim Losgehen treiben die Becher nach hinten'); assert(b.v > 1);
  // Vollgas ohne Ausgleich: Becher weg
  const c = H.neu(5); while (!c.ende()) c.schritt({ x: 0, y: 0, gehen: true }, 1 / 60);
  assert(c.becher.length < 3, 'Vollgas ohne Balancieren kostet Becher');
  // Bots kommen an, Punkte = 10 pro Becher + Restsekunden
  for (let s = 1; s <= 4; s++) {
    const sim = H.neu(s * 333), steuer = H.botSteuer(s * 333, 'bot1');
    while (!sim.ende()) sim.schritt(steuer(sim), 1 / 60);
    assert(sim.angekommen, 'Bot kommt an');
    assert.strictEqual(sim.punkte, sim.becher.length * H.PUNKTE + (sim.becher.length ? Math.ceil((H.DAUER - sim.t) / 1000) : 0));
    assert(sim.punkte > 20, 'Bot-Punkte ' + sim.punkte);
  }
  // Zeit um: Becher zählen nur anteilig
  const z = H.neu(5); while (!z.ende()) z.schritt({ x: 0, y: 0, gehen: false }, 1 / 60);
  assert.strictEqual(z.punkte, 0);
  soloLauf('bordkueche', 3, (S, t) => { if (t > S.mission.d.start + 30000) R.aktion(S, 'h', { t: 'b', a: 'ende', wert: 55 }, t); });
  console.log('Bordküche ok');
}
{
  const B = R.MISSIONEN.boule, H = B.hilfe;
  for (let s = 0; s < 50; s++) {
    const f = H.feld(R.zufall(s));
    assert(f.pl.length >= 2, 'mindestens 2 Planeten');
    for (const p of f.pl) {
      assert(Math.hypot(p.x - f.mond.x, p.y - f.mond.y) > p.r + H.MR + 0.2, 'Planet nicht am Mond');
      assert(Math.hypot(p.x - H.START.x, p.y - H.START.y) > p.r + 0.5, 'Planet nicht am Start');
    }
  }
  const tn = ['a', 'b'], d = B.neu(tn, R.zufall(1)), ctx = { tn, aktiv: tn, rng: R.zufall(2) };
  assert.deepStrictEqual(d.reihe, ['a', 'b', 'b', 'a'], 'zweite Runde rückwärts');
  B.start(d, 0, ctx);
  assert.strictEqual(d.dran, 'a');
  assert.notStrictEqual(B.aktion(d, 'b', { a: 'wurf', w: -1.5, s: 0.5 }, 0), true, 'nur wer dran ist');
  assert.strictEqual(B.aktion(d, 'a', { a: 'wurf', w: -Math.PI / 2, s: 0.5 }, 0), true);
  let t = 0; while (d.phase === 'rollt' && t < 10000) { t += 33; B.schritt(d, 0.033, {}, t, ctx); }
  assert.strictEqual(d.dran, 'b', 'nach dem Rollen ist b dran');
  assert(d.k.length <= 1 && d.k.every(k => k.vx === 0 && k.vy === 0), 'Kugel liegt');
  // Schwerkraft lenkt ab: gleicher Wurf mit und ohne Planeten
  const bahn = pl => { const w = { k: [{ id: 1, p: 'a', x: 0, y: 1.3, vx: 0, vy: -2 }], pl, mond: { x: 5, y: 5 } }; for (let i = 0; i < 60; i++) H.physik(w, 1 / 60); return w.k[0]; };
  const ohne = bahn([]), mit = bahn([{ x: 0.35, y: 0.3, r: 0.12 }]);
  assert(Math.abs(ohne.x) < 1e-9 && mit.x > 0.03, 'Planet zieht die Kugel zu sich');
  // Liegende Kugeln spüren keine Schwerkraft
  const lieg = { k: [{ id: 1, p: 'a', x: 0.3, y: 0.3, vx: 0, vy: 0 }], pl: [{ x: 0.5, y: 0.3, r: 0.12 }], mond: { x: 5, y: 5 } };
  H.physik(lieg, 1 / 60); assert.strictEqual(lieg.k[0].x, 0.3);
  // Wegschießen: eine schnelle Kugel stößt eine liegende aus dem Feld
  const stoss = { k: [{ id: 1, p: 'a', x: 0, y: -1.2, vx: 0, vy: 0 }, { id: 2, p: 'b', x: 0, y: 0, vx: 0, vy: -3.3 }], pl: [], mond: { x: 5, y: 5 } };
  let raus = []; for (let i = 0; i < 200; i++) raus = raus.concat(H.physik(stoss, 1 / 60).raus);
  assert(raus.some(k => k.p === 'a'), 'Kugel von a fliegt aus dem Feld');
  // Ganze Runde mit Bots; der Host wirft nie und verliert seine Kugeln
  const S = liveLauf('boule', 3);
  const e = S.mission.ergebnis, h = e.find(x => x.pid === 'h');
  assert.strictEqual(h.wert, 999); assert.strictEqual(h.text, 'keine Kugel im Feld');
  assert(e.filter(x => x.pid !== 'h').every(x => x.wert < 999 && /cm zum Mond/.test(x.text)), 'Bots haben Kugeln im Feld');
  assert.strictEqual(S.mission.d.verfallen, 2, 'zwei Kugeln des Hosts verfallen');
  // Bots treffen ordentlich: meist näher als 40 cm
  let gut = 0;
  for (let s = 0; s < 6; s++) {
    const dd = B.neu(['x', 'y'], R.zufall(s + 10)), cc = { tn: ['x', 'y'], aktiv: ['x', 'y'], rng: R.zufall(s) };
    B.start(dd, 0, cc); dd.t = 2000; dd.seit = 0;
    const m = B.bot(dd, 'x', cc.rng, 0); B.aktion(dd, 'x', m, 0);
    let tt = 0; while (dd.phase === 'rollt' && tt < 10000) { tt += 33; B.schritt(dd, 0.033, {}, tt, cc); }
    const w = H.bester(dd, 'x'); if (w !== null && w < 0.4) gut++;
  }
  assert(gut >= 4, 'Bot-Würfe gut: ' + gut + '/6');
  console.log('Planeten-Boule ok');
}

// ---------- Teams: Auslosen und Energie ----------
{
  for (let n = 4; n <= 8; n++) {
    const tn = Array.from({ length: n }, (_, i) => 'p' + i), t = R.teamsLosen(tn, R.zufall(n));
    assert.strictEqual(t[0].length, Math.ceil(n / 2)); assert.strictEqual(t[1].length, Math.floor(n / 2));
    assert.deepStrictEqual(t[0].concat(t[1]).sort(), tn.slice().sort(), 'jeder in genau einem Team');
  }
  assert.strictEqual(R.passend(3).some(b => b.art === 'Teams'), false, 'Teams erst ab 4');
  assert.strictEqual(R.passend(4).filter(b => b.art === 'Teams').length, 2);
  console.log('Teams ok');
}

// ---------- Treibstoffkette ----------
function teamLauf(id, bots, mensch, schritte) {
  const S = R.neu('T' + id, 'h', 'Host'); S.online = ['h'];
  for (let i = 0; i < bots; i++) R.aktion(S, 'h', { t: 'bot', dazu: true }, 0);
  assert(R.aktion(S, 'h', { t: 'mission', id }, 0).ok);
  const m = S.mission;
  assert(m.teams && m.teams[0].length + m.teams[1].length === bots + 1, 'Teams ausgelost');
  let t = 0; R.aktion(S, 'h', { t: 'bereit' }, t); R.takt(S, t); t += 3600; R.takt(S, t);
  assert.strictEqual(S.mission.schritt, 'spiel');
  let i = 0;
  while (S.mission.schritt === 'spiel' && i++ < (schritte || 2000)) { t += 33; if (mensch) mensch(S, t); if (S.mission.schritt !== 'spiel') break; if (R.MISSIONEN[id].live) R.liveSchritt(S, t, { h: { x: 0, y: 0, k: 0 } }); if (i % 6 === 0) R.takt(S, t); }
  assert.strictEqual(S.mission.schritt, 'ergebnis', id + ' endet');
  // Siegerteam je 8, das andere je 2, Gleichstand je 5
  const e = S.mission.ergebnis, sieger = S.mission.sieger;
  for (const x of e) {
    const team = m.teams[0].includes(x.pid) ? 0 : 1;
    assert.strictEqual(x.team, team);
    assert.strictEqual(x.energie, sieger === -1 ? 5 : team === sieger ? 8 : 2, 'Energie für ' + x.pid);
    assert.strictEqual(x.platz, sieger === -1 || team === sieger ? 1 : 2);
  }
  return { S, t };
}
{
  const B = R.MISSIONEN.treibstoff, H = B.hilfe;
  const k = { luke: 0.5 }, hoch = -Math.PI / 2;
  { const r = H.wurf(k, { w: hoch, v: 1.5 }); assert(r.art === 'weiter' && r.leck === 0, 'ruhig und gerade: kein Leck'); }
  const hastig = H.wurf(k, { w: hoch, v: 4 });
  assert(hastig.art === 'weiter' && hastig.leck > 20, 'zu hastig: Leck ' + hastig.leck);
  assert.strictEqual(H.wurf(k, { w: hoch + 0.5, v: 1.5 }).art, 'wand', 'schräg: gegen die Wand');
  assert.strictEqual(H.wurf(k, { w: 0, v: 1.5 }).art, 'wand', 'zur Seite: gegen die Wand');
  assert.strictEqual(H.wurf(k, { w: hoch, v: 0.2 }).art, 'schwach');
  assert.strictEqual(H.wurf({ luke: 0.75 }, { w: Math.atan2(-H.CY, 0.25), v: 1.5 }).art, 'weiter', 'schräg auf eine Luke rechts');
  // Ablauf: 2 gegen 2
  const tn = ['a', 'b', 'c', 'd'], teams = [['a', 'b'], ['c', 'd']], c = { tn, aktiv: tn, rng: R.zufall(3) };
  const d = B.neu(tn, R.zufall(1), null, teams);
  B.start(d, 0, c);
  assert.deepStrictEqual(d.k.map(x => [x.t, x.p]), [[0, 'a'], [1, 'c']], 'je ein Kanister beim Ersten');
  assert.deepStrictEqual(H.pfad(d, 0), ['a', 'b', 'a', 'b', 'a', 'b'], 'Weg: 6 Würfe reihum');
  const k1 = d.k[0], gerade = kk => ({ t: 'b', a: 'wisch', id: kk.id, w: Math.atan2(-H.CY, kk.luke - H.CX), v: 1.2 });
  assert.notStrictEqual(B.aktion(d, 'b', gerade(k1), 400), true, 'nur wer den Kanister hat');
  assert.notStrictEqual(B.aktion(d, 'a', gerade(k1), 0), true, 'erst wenn er angekommen ist');
  assert.strictEqual(B.aktion(d, 'a', gerade(k1), 400), true);
  assert.strictEqual(k1.p, 'b'); assert.strictEqual(k1.f, 100); assert.strictEqual(k1.ab, 400 + H.FLUG);
  assert.strictEqual(d.k.filter(x => x.t === 0).length, 2, 'Nachschub beim Ersten');
  assert.notStrictEqual(B.aktion(d, 'b', gerade(k1), 500), true, 'noch im Flug');
  // Leck und Fehlwurf
  let t = 2000;
  B.aktion(d, 'b', Object.assign(gerade(k1), { v: 4 }), t); assert(k1.f < 80 && k1.p === 'a', 'Leck beim hastigen Wurf');
  t += 1000; const f = k1.f; B.aktion(d, 'a', Object.assign(gerade(k1), { w: 0 }), t); assert.strictEqual(k1.f, f - 6); assert.strictEqual(k1.p, 'a', 'Fehlwurf bleibt liegen');
  for (let i = 0; i < 4; i++) { t += 1000; assert.strictEqual(B.aktion(d, k1.p, gerade(k1), t), true); }
  assert.strictEqual(d.voll[0], 1); assert.strictEqual(d.tank[0], f - 6, 'nach 6 Würfen in der Rakete');
  assert(!d.k.includes(k1));
  // Abwesende reichen von selbst weiter
  const k2 = d.k.find(x => x.t === 1); B.takt(d, t, { tn, aktiv: ['a', 'b', 'd'] }); assert.strictEqual(k2.p, 'd', 'c ist weg, der Kanister geht weiter');
  // Ganze Runde: 4 Bots und ein Mensch, der ruhig und genau wischt
  const runde = teamLauf('treibstoff', 4, (S, tt) => {
    const dd = S.mission.d; if (!dd.start || tt >= dd.bis) return;
    const kk = H.bei(dd, 'h')[0];
    if (kk && kk.ab <= tt - 300) R.aktion(S, 'h', gerade(kk), tt);
  });
  const e = runde.S.mission.ergebnis, dd = runde.S.mission.d;
  assert(e.every(x => x.wert > 0 && /l pro Person/.test(x.text)), 'alle Teams tanken');
  const pro = [0, 1].map(tt => H.proKopf(dd, tt));
  assert(pro.every(x => x > 150 && x < 2000), 'plausible Mengen: ' + pro);
  assert.strictEqual(R.sicht(runde.S, 'h').mission.d.bp, undefined, 'Bot-Pläne bleiben beim Spielleiter');
  console.log(`Treibstoffkette ok (l pro Person: ${pro.join(' / ')}, Kanister ${dd.voll.join(' / ')}, leer ${dd.leer.join(' / ')})`);
}

// ---------- Mondbasis ----------
if (!window.planck) console.log('Mondbasis übersprungen (planck fehlt: npm install planck@1.4.2)');
else {
  const B = R.MISSIONEN.mondbasis, H = B.hilfe;
  const teams = [['a', 'b'], ['c', 'd']], tn = ['a', 'b', 'c', 'd'];
  const p = H.plan(teams, R.zufall(4));
  assert.strictEqual(p.length, 2 * H.JE_TEAM);
  assert(p.every((z, i) => z.team === i % 2), 'Teams abwechselnd');
  assert(p.every((z, i) => i % 2 === 0 || z.typ === p[i - 1].typ), 'beide Teams bekommen dieselben Teile');
  assert.deepStrictEqual(p.slice(0, 4).map(z => z.pid), ['a', 'c', 'b', 'd'], 'im Team reihum');
  assert.strictEqual(p[0].typ, 0, 'zuerst ein Wohnmodul');
  // Wer das Teil neben die Plattform setzt, bringt den Turm zum Kippen
  const c = { tn, aktiv: tn, rng: R.zufall(2) }, d = B.neu(tn, R.zufall(4), null, teams);
  B.start(d, 0, c);
  assert.strictEqual(d.dran, 'a');
  assert.notStrictEqual(B.aktion(d, 'c', { a: 'los', x: 0, r: 0 }), true, 'nur wer dran ist');
  assert.strictEqual(B.aktion(d, 'a', { a: 'los', x: 0, r: 0 }), true);
  let t = 0;
  while (d.phase === 'faellt' && t < 10000) { t += 33; B.schritt(d, 0.033, {}, t, c); }
  assert.strictEqual(d.dran, 'c', 'nach dem Fallen ist Team Nebel dran');
  assert(Math.abs(d.top - 0.5) < 0.05, 'Wohnmodul liegt auf der Plattform: ' + d.top);
  // Steuerung über die Live-Eingabe: x −1…1, Drehung in Achteln
  B.schritt(d, 0.033, { c: { x: 1, y: 2 / 8 } }, t, c);
  assert.strictEqual(d.halt.x, H.XMAX); assert.strictEqual(d.halt.r, 2);
  assert.strictEqual(B.aktion(d, 'c', { a: 'los', x: 9, r: 0 }), true);
  assert.strictEqual(d.halt.x, H.XMAX, 'nicht weiter als bis zum Rand');
  while (d.phase !== 'ende' && t < 20000) { t += 33; B.schritt(d, 0.033, {}, t, c); }
  // Ein Wohnmodul mit der Mitte 1,7 m weit draußen kippt herunter (Plattform bis 1,4 m)
  assert.strictEqual(d.verlierer, 1, 'Team Nebel hat den Turm kippen lassen');
  assert.strictEqual(B.ausgang(d), 0); assert.strictEqual(d.schuld, 'c');
  assert.strictEqual(B.wertText(d, 'c'), 'hat den Turm zum Kippen gebracht');
  // Bilder sind klein und ohne Welt
  const bild = B.bild(d); assert.strictEqual(bild.k.length, 2); assert(JSON.stringify(R.kopie(d)).length < 4000);
  // Ganze Runden mit Bots: wie lange halten die Türme?
  const teile = [], aus = [];
  for (let s = 0; s < 4; s++) {
    const r = teamLauf('mondbasis', 4, null, 12000);
    const dd = r.S.mission.d; teile.push(dd.teile.length); aus.push(dd.verlierer === -1 ? '=' : dd.teile.length >= dd.plan.length ? 'B' : 'K');
  }
  assert(teile.reduce((a, b) => a + b, 0) / teile.length >= 4, 'Bots bauen ordentlich: ' + teile);
  console.log(`Mondbasis ok (Bauteile je Runde: ${teile.join(', ')}; ${aus.join('')}: K gekippt, B im Beben, = überstanden)`);
}

// ---------- Klänge: jeder Name, den das Spiel abspielt, gibt es im Synthesizer ----------
{
  const fs = require('fs');
  if (!window.addEventListener) window.addEventListener = () => {};
  require(__dirname + '/../klang.js');
  const da = window.ORBIT_KLANG.namen;
  const quellen = ['app.js'].concat(fs.readdirSync(__dirname + '/../missionen').map(f => 'missionen/' + f));
  const benutzt = new Set();
  for (const q of quellen) {
    const t = fs.readFileSync(__dirname + '/../' + q, 'utf8');
    for (const m of t.matchAll(/(?:K\.spiel|c\.klang)\(([^)]*)\)/g)) for (const n of m[1].matchAll(/(?<!=== )"([a-z]+)"/g)) benutzt.add(n[1]);
  }
  const fehlt = [...benutzt].filter(n => !da.includes(n));
  assert(!fehlt.length, 'Klänge fehlen: ' + fehlt);
  window.ORBIT_KLANG.spiel('tipp');   // ohne Audio im node: darf nichts werfen
  console.log(`Klänge ok (${benutzt.size} benutzt, ${da.length} im Synthesizer)`);
}

// ---------- Funkfrequenz: jede Frequenz nur einmal ----------
{
  const F = R.MISSIONEN.funkfrequenz, tn = ['a', 'b', 'c'], d = F.neu(tn), cx = { aktiv: tn };
  F.start(d, 0);
  assert.strictEqual(F.aktion(d, 'a', { a: 'frequenz', f: 15 }), true);
  F.aktion(d, 'b', { a: 'frequenz', f: 15 }); F.aktion(d, 'c', { a: 'frequenz', f: 9 });
  F.takt(d, 1, cx); assert.strictEqual(d.verlauf[0].sieger, 'c', 'die 15 stört sich, die 9 gewinnt');
  assert.deepStrictEqual(d.benutzt, { a: [15], b: [15], c: [9] });
  F.takt(d, 99999, cx); assert.strictEqual(d.dg, 2);
  assert.match(String(F.aktion(d, 'a', { a: 'frequenz', f: 15 })), /schon benutzt/);
  assert.strictEqual(F.aktion(d, 'a', { a: 'frequenz', f: 14 }), true);
  // Bots nehmen nie eine benutzte Frequenz
  const rng = R.zufall(3);
  for (let i = 0; i < 300; i++) { const m = F.bot(d, 'b', () => 0); const z = F.bot(d, 'c', rng); if (m) assert(m.f !== 15); if (z) assert(z.f !== 9); }
  console.log('Funkfrequenz: jede Frequenz nur einmal ok');
}
