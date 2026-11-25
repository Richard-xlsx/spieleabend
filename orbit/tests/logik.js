// Test für Ablauf und Mission Funkfrequenz: node orbit/tests/logik.js
global.window = {};
require(__dirname + '/../logic.js');
require(__dirname + '/../missionen/funkfrequenz.js');
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
assert.strictEqual(e[0].pid, 'h'); assert.strictEqual(e[0].energie, 10);
assert.strictEqual(S.spieler.h.energie, 10);
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
assert.deepStrictEqual(S2.mission.ergebnis.map(x => x.energie), [10, 10, 5]);
// Übernahme-Neustart aus Sicht-Kopie
R.aktion(S2, 'a', { t: 'weiter' }, 0); R.aktion(S2, 'a', { t: 'mission', id: 'funkfrequenz' }, 0);
const k = R.sicht(S2, 'b'); k.seed = 5; R.missionNeustart(k, 50);
assert.strictEqual(k.mission.schritt, 'anleitung'); assert.strictEqual(k.missionNr, S2.missionNr);
console.log('alle Tests ok');
