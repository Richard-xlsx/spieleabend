// Test für Ablauf und Mission Funkfrequenz: node orbit/tests/logik.js
global.window = {};
require(__dirname + '/../logic.js');
require(__dirname + '/../missionen/funkfrequenz.js');
require(__dirname + '/../missionen/schrotthaendler.js');
require(__dirname + '/../missionen/reaktor.js');
require(__dirname + '/../missionen/asteroid.js');
require(__dirname + '/../missionen/kapseln.js');
require(__dirname + '/../live.js');
const R = window.RM, assert = require('assert');
let t = 1000;
const S = R.neu('ABCD', 'h', 'Host');
assert(R.aktion(S, 'c1', { t: 'hallo', name: 'Clara' }, t).ok);
S.online = ['h', 'c1'];
assert.notStrictEqual(S.spieler.c1.farbe, S.spieler.h.farbe);
// zu wenige für Funkfrequenz
assert(!R.aktion(S, 'h', { t: 'mission', id: 'funkfrequenz' }, t).ok);
assert(!R.aktion(S, 'c1', { t: 'bot', dazu: true }, t).ok, 'nur Host');
R.aktion(S, 'h', { t: 'bot', dazu: true }, t);
R.aktion(S, 'h', { t: 'bot', dazu: true }, t);
assert.strictEqual(R.anwesend(S).length, 4);
assert(R.aktion(S, 'h', { t: 'mission', id: 'funkfrequenz' }, t).ok);
assert.strictEqual(S.mission.schritt, 'anleitung');
R.takt(S, t);                         // Bots bereit
R.aktion(S, 'h', { t: 'bereit' }, t);
assert.strictEqual(S.mission.schritt, 'anleitung');
R.aktion(S, 'c1', { t: 'bereit' }, t);
assert.strictEqual(S.mission.schritt, 'countdown');
const botAlt = R.MISSIONEN.funkfrequenz.bot; R.MISSIONEN.funkfrequenz.bot = () => null;   // Bots kurz still, damit der Durchgang offen bleibt
t += 3600; R.takt(S, t);
assert.strictEqual(S.mission.schritt, 'spiel');
const d = () => S.mission.d;
assert.strictEqual(d().dg, 1);
// Durchgang 1: Host 15, Clara 15 (gestört), bots egal → setzen wir manuell
R.aktion(S, 'h', { t: 'b', a: 'frequenz', f: 15 }, t);
R.aktion(S, 'c1', { t: 'b', a: 'frequenz', f: 15 }, t);
// Sicht: Clara sieht Host-Wahl nicht
const v = R.sicht(S, 'c1');
assert.deepStrictEqual(v.mission.d.wahl, { c1: 15 });
assert(v.mission.d.gesendet.includes('h'));
assert(!('seed' in v));
d().wahl.bot1 = 9; d().wahl.bot2 = 9; d().dabei.bot1 = d().dabei.bot2 = true;
R.takt(S, t);
assert.strictEqual(d().schritt, 'aufloesung');
assert.strictEqual(d().verlauf[0].sieger, null);
// Durchgang 2: Host 12 allein, Clara 3 allein → Host +12
t += 7100; R.takt(S, t); assert.strictEqual(d().dg, 2);
R.aktion(S, 'h', { t: 'b', a: 'frequenz', f: 12 }, t);
R.aktion(S, 'c1', { t: 'b', a: 'frequenz', f: 3 }, t);
d().wahl.bot1 = 5; d().wahl.bot2 = 5;
R.takt(S, t);
assert.strictEqual(d().verlauf[1].sieger, 'h'); assert.strictEqual(d().punkte.h, 12);
R.MISSIONEN.funkfrequenz.bot = botAlt;
// Durchgang 3: Zeit läuft ab, Clara offline (kein Warten), Bots wählen via bot()
t += 7100; R.takt(S, t); assert.strictEqual(d().dg, 3);
S.online = ['h'];
R.aktion(S, 'h', { t: 'b', a: 'frequenz', f: 1 }, t);
for (let i = 0; i < 400 && d().schritt === 'wahl'; i++) { t += 200; R.takt(S, t); }
assert.strictEqual(d().schritt, 'aufloesung');
assert(d().verlauf[2].wahl.bot1 && d().verlauf[2].wahl.bot2, 'Bots haben gesendet');
assert(t < 1000 + 3600 + 14200 + 15000 + 1, 'nicht länger als Wahlzeit');
t += 7100; R.takt(S, t);
assert.strictEqual(S.mission.schritt, 'ergebnis');
const e = S.mission.ergebnis;
assert.strictEqual(e[0].wert, Math.max(...Object.values(d().punkte))); assert.strictEqual(e[0].energie, 10);
assert.strictEqual(S.spieler[e[0].pid].energie, 10);
assert(e.every(x => x.energie >= 1));
assert(!R.aktion(S, 'c1', { t: 'weiter' }, t).ok);
assert(R.aktion(S, 'h', { t: 'weiter' }, t).ok);
assert.strictEqual(S.phase, 'lobby'); assert(S.letzte);
// Gleichstand-Wertung
const S2 = R.neu('X', 'a', 'A'); S2.online = ['a', 'b', 'c']; ['b', 'c'].forEach(p => R.aktion(S2, p, { t: 'hallo', name: p }, 0)); S2.online = ['a', 'b', 'c'];
R.aktion(S2, 'a', { t: 'mission', id: 'funkfrequenz' }, 0); S2.mission.schritt = 'spiel'; R.MISSIONEN.funkfrequenz.start(S2.mission.d, 0);
Object.assign(S2.mission.d, { fertig: true, punkte: { a: 5, b: 5, c: 1 }, dabei: { a: 1, b: 1, c: 1 } });
R.takt(S2, 0);
console.log(S2.mission.ergebnis.map(x => [x.pid, x.platz, x.energie]).join(' | '));
assert.deepStrictEqual(S2.mission.ergebnis.map(x => x.platz), [1, 1, 3]);
assert.deepStrictEqual(S2.mission.ergebnis.map(x => x.energie), [10, 10, 2]);   // bei 3 Leuten: 10, 6, 2
// Übernahme-Neustart aus Sicht-Kopie
R.aktion(S2, 'a', { t: 'weiter' }, 0); R.aktion(S2, 'a', { t: 'mission', id: 'funkfrequenz' }, 0);
const k = R.sicht(S2, 'b'); k.seed = 5; R.missionNeustart(k, 50);
assert.strictEqual(k.mission.schritt, 'anleitung'); assert.strictEqual(k.missionNr, S2.missionNr);

// ---------- Partie auf dem Brett ----------
{
  let t = 0;
  const S = R.neu('BRET', 'h', 'Host'); S.online = ['h', 'c'];
  R.aktion(S, 'c', { t: 'hallo', name: 'Clara' }, t);
  assert(!R.aktion(S, 'c', { t: 'partie', laenge: 'kurz' }, t).ok, 'nur Host');
  R.aktion(S, 'h', { t: 'bot', dazu: true }, t); R.aktion(S, 'h', { t: 'bot', dazu: true }, t);
  assert(R.aktion(S, 'h', { t: 'partie', laenge: 'kurz' }, t).ok);
  assert.strictEqual(S.phase, 'brett'); assert.strictEqual(S.partie.runden, 5); assert.strictEqual(S.partie.runde, 1);
  assert(Object.values(S.spieler).every(x => x.energie === 10 && x.kristalle === 0));
  assert.strictEqual(R.FELDER.length, 32);
  // Würfeln: Host und Clara tippen, Bots würfeln von selbst
  assert(R.aktion(S, 'h', { t: 'wurf' }, t).ok); assert(!R.aktion(S, 'h', { t: 'wurf' }, t).ok, 'nur einmal');
  R.aktion(S, 'c', { t: 'wurf' }, t);
  for (let i = 0; i < 200 && S.partie.schritt === 'wuerfeln'; i++) { t += 200; R.takt(S, t); }
  assert.strictEqual(S.partie.schritt, 'ziehen');
  assert(Object.values(S.partie.wurf).every(w => w.length === 2 && w.every(x => x >= 1 && x <= 6)));
  assert.strictEqual(S.partie.reihe.length, 4);
  // Sicht: kein Zufallszustand
  assert(!('rs' in R.sicht(S, 'c')) && !('seed' in R.sicht(S, 'c')));
  // Händler: Clara landet auf dem Händler mit genug Energie und kauft
  S.partie.haendler2 = null;   // für die Einzeltests nur ein Schiff
  S.partie.reihe = ['c']; S.partie.wurf.c = 3; S.partie.pos.c = 0; S.partie.haendler = 3; S.spieler.c.energie = 45;
  t += 2000; R.takt(S, t); assert.strictEqual(S.partie.zug.pid, 'c');
  t += 3 * 280 + 300; R.takt(S, t);
  assert.strictEqual(S.partie.pos.c, 3); assert.strictEqual(R.FELDER[3], 'V');
  assert.strictEqual(S.partie.zug.frage.art, 'kauf'); assert.strictEqual(S.spieler.c.energie, 48); assert.strictEqual(S.partie.zug.frage.optionen, 2);
  assert(!R.aktion(S, 'h', { t: 'antwort', w: 'ja' }, t).ok, 'nur wer dran ist');
  assert(R.aktion(S, 'c', { t: 'antwort', w: 1 }, t).ok);
  assert.strictEqual(S.spieler.c.kristalle, 1); assert.strictEqual(S.spieler.c.energie, 28); assert.strictEqual(S.partie.haendler, 3, 'Händler bleibt die Runde über');
  // Würfelwahl: mit zwei Würfeln ein Würfel oder beide
  t += 2000; R.takt(S, t); assert.strictEqual(S.partie.zug, null);
  S.partie.reihe = ['c']; S.partie.wurf.c = [2, 5]; S.partie.pos.c = 0;
  t += 10; R.takt(S, t);
  assert.strictEqual(S.partie.zug.frage.art, 'schritte'); assert.deepStrictEqual(S.partie.zug.frage.optionen, [2, 5, 7]);
  assert.strictEqual(S.partie.zug.stufe, 'wahl'); assert.strictEqual(S.partie.zug.wurf, null);
  R.aktion(S, 'c', { t: 'antwort', w: 4 }, t); assert.strictEqual(S.partie.zug.frage.art, 'schritte', 'falsche Zahl zählt nicht');
  R.aktion(S, 'c', { t: 'antwort', w: 2 }, t);
  t += 2 * 280 + 300; R.takt(S, t);
  assert.strictEqual(S.partie.pos.c, 2, 'nur ein Würfel');
  assert.deepStrictEqual(R.schrittOptionen([4, 4]), [4, 8], 'Pasch: ein Würfel oder beide');
  // ohne Antwort: beide Würfel
  t += 2000; for (let i = 0; i < 20 && S.partie.zug; i++) { t += 2000; R.takt(S, t); }
  S.partie.reihe = ['c']; S.partie.wurf.c = [1, 3]; S.partie.pos.c = 0; S.partie.haendler = 30;
  t += 10; R.takt(S, t); t += 10001; R.takt(S, t);
  assert.strictEqual(S.partie.zug.wurf, 4); t += 4 * 280 + 300; R.takt(S, t); assert.strictEqual(S.partie.pos.c, 4);
  // Vorab gewählt (gleich nach dem Würfeln): der Zug läuft ohne Frage los
  t += 2000; for (let i = 0; i < 20 && S.partie.zug; i++) { t += 2000; R.takt(S, t); }
  S.partie.reihe = ['c']; S.partie.wurf.c = [3, 6]; S.partie.pos.c = 0;
  assert(!R.aktion(S, 'c', { t: 'schritte', n: 5 }, t).ok, 'nur Würfel oder Summe');
  assert(R.aktion(S, 'c', { t: 'schritte', n: 6 }, t).ok);
  assert(!R.sicht(S, 'h').partie.schritte || !('c' in R.sicht(S, 'h').partie.schritte), 'Wahl der anderen bleibt verdeckt');
  t += 10; R.takt(S, t);
  assert.strictEqual(S.partie.zug.stufe, 'laufen'); assert.strictEqual(S.partie.zug.wurf, 6);
  t += 6 * 280 + 300; R.takt(S, t); assert.strictEqual(S.partie.pos.c, 6);
  assert(!R.aktion(S, 'c', { t: 'schritte', n: 3 }, t).ok, 'nach dem Zug nicht mehr');
  // Reaktionen: eine pro Sekunde
  assert(R.aktion(S, 'c', { t: 'reaktion', e: 1 }, t).ok); assert(!R.aktion(S, 'c', { t: 'reaktion', e: 2 }, t + 100).ok);
  assert(R.aktion(S, 'c', { t: 'reaktion', e: 2 }, t + 1000).ok); assert(!R.aktion(S, 'c', { t: 'reaktion', e: 9 }, t + 3000).ok);
  S.partie.haendler = 3; S.partie.pos.c = 3; S.spieler.c.energie = 28;   // zurück auf den Stand vor der Würfelwahl
  // Pirat: Host landet auf 10, Zeit läuft ab → klaut dem Reichsten
  t += 2000; R.takt(S, t); assert.strictEqual(S.partie.zug, null);
  S.partie.reihe = ['h']; S.partie.wurf.h = 4; S.partie.pos.h = 6; S.partie.haendler = 30; S.spieler.bot1.energie = 30;
  R.takt(S, t); t += 4 * 280 + 300; R.takt(S, t);
  assert.strictEqual(S.partie.zug.frage.art, 'pirat');
  t += 10001; R.takt(S, t);
  assert.strictEqual(S.spieler.bot1.energie, 25); assert.strictEqual(S.spieler.h.energie, 15);
  // Wurmloch: Clara auf 8, springt nach 24
  t += 2000; R.takt(S, t);
  S.partie.reihe = ['c']; S.partie.wurf.c = 5; R.takt(S, t); t += 5 * 280 + 300; R.takt(S, t);
  assert.strictEqual(S.partie.pos.c, 8); assert.strictEqual(S.partie.zug.frage.art, 'wurmloch');
  R.aktion(S, 'c', { t: 'antwort', w: 'ja' }, t);
  assert.strictEqual(S.partie.pos.c, 24); assert.strictEqual(S.spieler.c.energie, 23);
  // Alle gezogen → Missionswahl durch den Letzten
  t += 2000; R.takt(S, t); t += 300; R.takt(S, t);
  assert.strictEqual(S.partie.schritt, 'wahl');
  const letzter = R.rangliste(S).filter(p => R.istDa(S, p)).pop();
  assert.strictEqual(S.partie.wahl.wer, letzter);
  assert.strictEqual(S.partie.wahl.optionen.length, 3); assert(S.partie.wahl.optionen.every(id => R.MISSIONEN[id]));
  S.partie.wahl.optionen = ['funkfrequenz'];   // der Test unten setzt Punkte wie bei Funkfrequenz
if (letzter === 'h' || letzter === 'c') assert(R.aktion(S, letzter, { t: 'waehle', id: S.partie.wahl.optionen[0] }, t).ok);
  for (let i = 0; i < 50 && S.partie.schritt === 'wahl'; i++) { t += 200; R.takt(S, t); }
  assert.strictEqual(S.partie.schritt, 'wetten');
  // Wetten: Host setzt 5 auf sich, Clara (Gratiswette) tippt auf Host ohne Einsatz
  S.partie.gratis.c = true;
  const vorH = S.spieler.h.energie;
  assert(R.aktion(S, 'h', { t: 'wette', auf: 'h', einsatz: 9 }, t).ok);
  assert.strictEqual(S.partie.wetten.h.einsatz, 5);
  assert.deepStrictEqual(R.sicht(S, 'c').partie.wetten.h, { verdeckt: true });
  R.aktion(S, 'c', { t: 'wette', auf: 'h', einsatz: 0 }, t);
  for (let i = 0; i < 200 && S.phase === 'brett'; i++) { t += 200; R.takt(S, t); }
  assert.strictEqual(S.phase, 'mission'); assert(S.mission.partie);
  assert.strictEqual(S.spieler.h.energie, vorH - 5);
  assert(S.partie.wetten.c.gratis && !S.partie.gratis.c);
  // Mission: Host gewinnt
  const M = S.mission; M.schritt = 'spiel';
  Object.assign(M.d, { fertig: true, punkte: { h: 20, c: 3, bot1: 1, bot2: 0 }, dabei: { h: 1, c: 1, bot1: 1, bot2: 1 } });
  const eH = S.spieler.h.energie, eC = S.spieler.c.energie;
  R.takt(S, t);
  assert.strictEqual(M.schritt, 'ergebnis');
  assert.strictEqual(S.spieler.h.energie, eH + 10 + 10, 'Platz 1 + Wette 2×5');
  assert.strictEqual(S.spieler.c.energie, eC + 7 + 8, 'Platz 2 + Gratiswette');
  assert.strictEqual(S.partie.stat.h.mission, 10);
  // Nachzügler kommt während der Mission
  S.online = ['h', 'c', 'n'];
  R.aktion(S, 'n', { t: 'hallo', name: 'Nils' }, t);
  assert(S.spieler.n.wartet);
  // Ergebnis läuft von selbst weiter → Runde 2, Nils steigt mit dem Schnitt ein
  t += 25001; R.takt(S, t);
  assert.strictEqual(S.phase, 'brett'); assert.strictEqual(S.partie.runde, 2);
  assert(!S.spieler.n.wartet); assert.strictEqual(S.partie.pos.n, 0);
  assert(S.spieler.n.energie > 0);
  // Rest der Partie automatisch (Menschen offline → Vorgaben), Missionen per Bot
  S.online = ['h'];
  let schritte = 0;
  while (S.phase !== 'ende' && schritte++ < 20000) {
    t += 200; R.takt(S, t);
    for (let k = 0; k < 6; k++) R.liveSchritt(S, t - 200 + k * 33, {});
    if (S.phase === 'mission' && S.mission.schritt === 'anleitung') R.aktion(S, 'h', { t: 'bereit' }, t);
    if (S.phase === 'brett' && S.partie.schritt === 'wuerfeln') R.aktion(S, 'h', { t: 'wurf' }, t);
    if (S.phase === 'brett' && S.partie.schritt === 'wahl' && S.partie.wahl.wer === 'h') R.aktion(S, 'h', { t: 'waehle', id: S.partie.wahl.optionen[0] }, t);
    if (S.phase === 'brett' && S.partie.schritt === 'wetten' && !S.partie.wetten.h) R.aktion(S, 'h', { t: 'wette', auf: 'bot1', einsatz: 2 }, t);
    if (S.phase === 'mission' && S.mission.schritt === 'spiel' && S.mission.id === 'schrotthaendler' && S.mission.d.schritt === 'gebot' && S.mission.d.gebote.h === undefined) R.aktion(S, 'h', { t: 'b', a: 'gebot', g: t % 9 }, t);
    if (S.phase === 'mission' && S.mission.schritt === 'spiel' && S.mission.id === 'reaktor' && S.mission.d.schritt === 'laeuft' && t - S.mission.d.start > 6000) R.aktion(S, 'h', { t: 'b', a: 'raus', z: t - 300 }, t);
    if (S.phase === 'mission' && S.mission.schritt === 'spiel' && S.mission.id === 'funkfrequenz' && S.mission.d.schritt === 'wahl' && !S.mission.d.wahl.h) R.aktion(S, 'h', { t: 'b', a: 'frequenz', f: 1 + (t % 15) }, t);
    for (const p in S.spieler) assert(S.spieler[p].energie >= 0, 'Energie nie negativ');
  }
  assert.strictEqual(S.phase, 'ende', 'Partie endet');
  assert.strictEqual(S.partie.runde, 5);
  assert.strictEqual(S.partie.ehrung.length, 3);
  assert.deepStrictEqual(S.partie.ehrung.map(e => e.titel), ['Missionsheld', 'Bester Tipper', 'Comeback']);
  assert(S.partie.ehrung[0].pids.length >= 1);
  assert(Array.isArray(S.partie.titel) && S.partie.titel.every(x => x.pids.length && x.wert > 0), 'Ehrentitel');
  for (const e of S.partie.ehrung) assert(e.pids.length === 0 || e.wert > 0, 'Bonus nur für mehr als 0');
  const es = S.partie.endstand;
  assert.strictEqual(es[0].platz, 1);
  for (let i = 1; i < es.length; i++) { const a = S.spieler[es[i - 1].pid], b = S.spieler[es[i].pid]; assert(a.kristalle > b.kristalle || (a.kristalle === b.kristalle && a.energie >= b.energie)); }
  console.log('Partie:', es.map(e => `${e.platz}. ${S.spieler[e.pid].name} ${S.spieler[e.pid].kristalle}✦ ${S.spieler[e.pid].energie}⚡`).join(' | '), '·', Math.round(t / 1000), 's');
  assert(R.aktion(S, 'h', { t: 'neuePartie' }, t).ok);
  assert.strictEqual(S.phase, 'lobby'); assert.strictEqual(S.partie, null);
  // Übernahme mitten in der Partie: Kopie ohne Geheimnisse läuft weiter
  R.aktion(S, 'h', { t: 'partie', laenge: 'kurz' }, t);
  const k = R.sicht(S, 'c'); k.seed = 77; k.host = 'c'; k.online = ['c'];
  for (let i = 0; i < 300 && k.partie.schritt !== 'wahl'; i++) { t += 200; R.takt(k, t); R.aktion(k, 'c', { t: 'wurf' }, t); }
  assert.strictEqual(k.partie.schritt, 'wahl', 'nach Übernahme geht es weiter');
}
require(__dirname + '/missionen.js');
// ---------- Energie je Platz, Wettquoten, Boni ----------
{
  assert.deepStrictEqual(R.ENERGIE_FUER(2), [10, 3]); assert.deepStrictEqual(R.ENERGIE_FUER(4), [10, 7, 4, 2]); assert.strictEqual(R.ENERGIE_FUER(8).length, 8);
  for (let n = 2; n <= 8; n++) { const e = R.ENERGIE_FUER(n); assert.strictEqual(e.length, n); assert(e.every((x, i) => !i || x <= e[i - 1])); }
  const q = R.wettQuote('funkfrequenz'), qt = R.wettQuote('treibstoff'), qe = R.wettQuote('gestaltwandler');
  assert(!q.leicht && q.gewinn(5) === 10 && q.gratis === 8);
  assert(qt.leicht && qe.leicht && qt.gewinn(5) === 8 && qt.gewinn(1) === 2 && qt.gewinn(0) === 0 && qt.gratis === 5);
  // Comeback und Bester Tipper
  let t = 0;
  const S = R.neu('B', 'h', 'H'); for (let i = 0; i < 3; i++) R.aktion(S, 'h', { t: 'bot', dazu: true }, t);
  S.online = ['h']; R.aktion(S, 'h', { t: 'partie', laenge: 'kurz' }, t);
  const P = S.partie, ps = Object.keys(S.spieler);
  P.stat.h.tief = 4; P.stat.h.wette = 6; P.stat[ps[1]].wette = 3;
  S.spieler.h.kristalle = 5;   // von Platz 4 auf Platz 1
  R.aktion(S, 'h', { t: 'beenden' }, t);
  const eh = Object.fromEntries(P.ehrung.map(e => [e.titel, e]));
  assert.deepStrictEqual(eh['Bester Tipper'].pids, ['h']); assert.strictEqual(eh['Bester Tipper'].wert, 6);
  assert.deepStrictEqual(eh.Comeback.pids, ['h']); assert.strictEqual(eh.Comeback.wert, 3);
  // Händler fliegt zu Beginn der nächsten Runde weiter
  const S3 = R.neu('C', 'h', 'H'); R.aktion(S3, 'h', { t: 'bot', dazu: true }, 0); S3.online = ['h']; R.aktion(S3, 'h', { t: 'partie', laenge: 'kurz' }, 0);
  const h0 = S3.partie.haendler; let tt = 0;
  while (S3.partie.runde < 2 && tt < 3e6) { tt += 200; R.takt(S3, tt); R.liveSchritt(S3, tt, {}); if (S3.phase === 'brett' && S3.partie.schritt === 'wuerfeln') R.aktion(S3, 'h', { t: 'wurf' }, tt); if (S3.phase === 'mission' && S3.mission.schritt === 'anleitung') R.aktion(S3, 'h', { t: 'bereit' }, tt); }
  assert.strictEqual(S3.partie.runde, 2); const ab = Math.abs(S3.partie.haendler - h0);
  assert(Math.min(ab, R.N - ab) >= 8, 'Händler weit weg geflogen');
  console.log('Energie, Wettquoten, Boni, Händler ok');
}
console.log('alle Tests ok');
