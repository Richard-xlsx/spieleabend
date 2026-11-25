// Tests für Schrotthändler und Reaktor-Countdown (wird von logik.js mit aufgerufen, geht auch allein: node orbit/tests/missionen.js)
if (!global.window) global.window = {};
if (!window.RM) {
  require(__dirname + '/../logic.js');
  require(__dirname + '/../missionen/funkfrequenz.js');
  require(__dirname + '/../missionen/schrotthaendler.js');
  require(__dirname + '/../missionen/reaktor.js');
}
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
