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
function liveLauf(id, bots, ein) {
  const S = R.neu('L' + id, 'h', 'Host'); S.online = ['h'];
  for (let i = 0; i < bots; i++) R.aktion(S, 'h', { t: 'bot', dazu: true }, 0);
  assert(R.aktion(S, 'h', { t: 'mission', id }, 0).ok);
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
  let d = I.neu(tn, rng);
  setze(d, 'a', 0.8, 0, 0); setze(d, 'b', -0.5, -0.5, Math.PI / 2);
  let i = 0; while (d.sp.a.drin && i++ < 100) I.schritt(d, 0.033, {}, 0, c);
  assert(!d.sp.a.drin && d.sp.b.drin, 'a fliegt gegen die Wand'); assert(d.sp.a.fiel > 500 && d.sp.a.fiel < 1500, 'Wand nach ' + d.sp.a.fiel);
  assert(d.endeBei !== null, 'nur noch einer übrig');
  while (!d.fertig) I.schritt(d, 0.033, {}, 0, c);
  assert(d.t - d.endeBei < 50, 'Nachlauf');
  let w = I.wertung(d); assert(w.b > w.a);
  // Quer durch eine fremde Spur
  d = I.neu(tn, rng);
  setze(d, 'b', -0.6, 0, 0); setze(d, 'a', 0, -0.75, Math.PI / 2);
  for (let k = 0; k < 200 && d.sp.a.drin; k++) I.schritt(d, 0.033, {}, 0, c);
  assert(!d.sp.a.drin, 'a stößt gegen b\'s Spur'); assert(Math.abs(d.sp.a.y) < 0.05, 'genau an der Spur: ' + d.sp.a.y);
  // … mit Lücke kommt man durch
  d = I.neu(tn, rng);
  setze(d, 'b', -0.6, 0, 0); setze(d, 'a', 0, -0.75, Math.PI / 2);
  for (let k = 0; k < 200 && d.sp.a.drin && d.sp.a.y < 0.5; k++) {
    if (d.sp.b.luecke > 1e8 && d.sp.b.x > -0.04) d.sp.b.luecke = d.t;   // Lücke genau dort, wo a kreuzt
    I.schritt(d, 0.033, {}, 0, c);
  }
  assert(d.sp.a.drin, 'durch die Lücke geschlüpft'); assert(d.sp.b.spur.includes(null), 'Lücke steht in der Spur');
  // Eigene Spur: im Kreis fliegen
  d = I.neu(tn, rng);
  setze(d, 'a', 0, 0, 0); setze(d, 'b', -0.8, -0.8, Math.PI / 2);
  for (let k = 0; k < 200 && d.sp.a.drin; k++) I.schritt(d, 0.033, { a: { x: 1 } }, 0, c);
  assert(!d.sp.a.drin, 'gegen die eigene Spur'); assert(d.sp.a.fiel > 1500 && d.sp.a.fiel < 4500, 'nach ein, zwei Runden: ' + d.sp.a.fiel);
  // Frontal
  d = I.neu(tn, rng);
  setze(d, 'a', -0.3, 0, 0); setze(d, 'b', 0.3, 0, Math.PI);
  for (let k = 0; k < 60 && d.sp.a.drin; k++) I.schritt(d, 0.033, {}, 0, c);
  assert(!d.sp.a.drin && !d.sp.b.drin && d.sp.a.fiel === d.sp.b.fiel, 'beide gleichzeitig raus');
  assert(d.fertig || d.endeBei === d.t);
  // Bild: nur das Ende der Spur; Sicht ohne Raster
  d = I.neu(tn, rng);
  for (let k = 0; k < 90; k++) I.schritt(d, 0.033, { a: { x: 0.3 }, b: { x: -0.3 } }, 0, c);
  const b = I.bild(d);
  assert(b.s[0][1].length <= 30 && b.s[0][0] + b.s[0][1].length === d.sp.a.spur.length);
  const v = I.sicht(d); assert(!v.belegt && !v.zeit && v.sp.a.spur.length);
  assert(I.botEingabe(d, 'b', rng).x !== undefined); assert(!('botLenk' in I.sicht(d)));
  // Mit Bots: endet, Bots halten länger durch als einer, der nur geradeaus fliegt
  const dauer = [];
  for (const nb of [1, 3, 5]) {
    const S = liveLauf('ionenspur', nb);
    const e = S.mission.ergebnis; dauer.push(S.mission.d.t);
    assert.strictEqual(e[e.length - 1].pid, 'h', 'geradeaus fliegen reicht nicht');
    assert(JSON.stringify(R.sicht(S, 'h')).length < 40000);
  }
  console.log('Ionenspur ok, Runden', dauer.map(x => Math.round(x / 1000) + ' s').join(', '));
}
