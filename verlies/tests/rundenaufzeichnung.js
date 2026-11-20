const path = require('path'), os = require('os');
const LOGIK = path.join(__dirname, '..', 'verlies-logic.js');
const AUS = path.join(os.tmpdir(), 'verlies-tests'); require('fs').mkdirSync(AUS, { recursive: true });
const URL_BASIS = process.env.VERLIES_URL || 'http://localhost:8765';
// Prüft: Ausgangslage + alle Ereignis-Deltas ergeben genau die Lebenspunkte nach der Runde.
const fs = require('fs'), vm = require('vm'); const ctx = { window: {}, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(LOGIK, 'utf8'), ctx); const V = ctx.window.VL;
let runden = 0, fehler = 0, arten = {}, ohneZiel = 0;
for (let seed = 1; seed <= 400; seed++) {
  const R = ['kaempfer', 'dieb', 'heilerin', 'magierin', 'waldlaeufer', 'paladin', 'moench', 'nekromant', 'bardin', 'hexe'].sort(() => Math.random() - .5).slice(0, 2 + seed % 5);   // 2 bis 6 Helden
  let S = V.neu('X', 'p0', 'A', seed * 977); const P = R.map((_, i) => 'p' + i);
  for (let i = 1; i < R.length; i++) S = V.aktion(S, P[i], { t: 'join', name: 'S' + i });
  P.forEach((p, i) => S = V.aktion(S, p, { t: 'rolle', rolle: R[i] }));
  const tiefe = seed % 4 === 0; S = V.aktion(S, 'p0', { t: 'laenge', n: tiefe ? 4 : 3 }); S = V.aktion(S, 'p0', { t: 'schwere', n: 1 + (seed >> 2) % 4 }); for (const f of Object.keys(V.FLUECHE)) if (Math.random() < .4) S = V.aktion(S, 'p0', { t: 'fluch', id: f });
  S = V.aktion(S, 'p0', { t: 'start', mindestens: 1 });   // Flüche zufällig
  // Ein Drittel der Partien beginnt in Ebene 2, eins in Ebene 3 (mit kräftigeren Helden), damit alle Gegner vorkommen
  const ab = 1 + seed % 3 + (tiefe ? 3 + (seed >> 3) % 4 : 0);   // die Tiefe: Ebene 4 bis 9
  if (ab > 1) { S.ebene = ab - 1; S.ebeneFertig = true; for (const p of S.teilnehmer) { const h = S.helden[p]; h.max += 30 * (ab - 1); h.hp = h.max; h.waffe = 2 * (ab - 1); h.ruestung = 2 * (ab - 1); } }
  // Damit alle Talente vorkommen: jeder Held bekommt 12 Punkte und verteilt sie zufällig (auch Meisterfähigkeiten)
  // Relikte: jeder Held bekommt bis zu 3 zufällige (jedes nur einmal), damit auch ihre Effekte geprüft werden
  { const l = Object.keys(V.RELIKTE).sort(() => Math.random() - .5); for (const p of S.teilnehmer) S.helden[p].relikte = l.splice(0, seed % 4); }
  for (const p of S.teilnehmer) { S.helden[p].punkte = 12; for (let k = 0; k < 12; k++) {
    const h = S.helden[p], frei = Object.keys(V.TALENT).filter(id => V.talentWaehlbar(h, id)); if (!frei.length) break;
    S = V.aktion(S, p, { t: 'talent', id: frei[Math.floor(Math.random() * frei.length)], nr: S.spielNr }); } }
  // Jeder Zweite ist aufgestiegen: Stufe 22, Spezialisierung ganz gelernt (zweite Meisterfähigkeit), Ruhmesboni
  if (seed % 2) for (const p of S.teilnehmer) { const h = S.helden[p]; h.ep = V.epFuer(22); h.stufe = 22; h.ruhm = 6;
    const a = V.AUFSTIEG_AESTE[h.rolle][seed % 4 < 2 ? 0 : 1]; for (const id of a.knoten) S = V.aktion(S, p, { t: 'talent', id, nr: S.spielNr });
    S = V.aktion(S, p, { t: 'ruhm', id: 'kraft', nr: S.spielNr }); S = V.aktion(S, p, { t: 'ruhm', id: 'haut', nr: S.spielNr });
    if (S.helden[p].ruhm !== 0) throw new Error('Aufstieg nicht gelernt ' + h.rolle); }
  let n = 0;
  while (S.phase !== 'ende' && n++ < 3000) {
    if (S.phase === 'erkunden') { for (const p of S.teilnehmer) { if (S.phase !== 'erkunden') break; S = V.aktion(S, p, { t: 'stimme', i: 0, nr: S.spielNr }); } }
    else if (S.phase === 'lager') { for (const p of S.teilnehmer) if (S.phase === 'lager') S = V.aktion(S, p, { t: 'fertig', nr: S.spielNr }); }
    else if (S.phase === 'kampf') {
      if (!S.kampf.absicht || V.gegnerLebend(S).some(g => !S.kampf.absicht[g.id])) ohneZiel++;
      const r = S.kampf.runde, vorher = JSON.parse(JSON.stringify(S));
      for (const p of V.lebend(S)) {
        if (S.phase !== 'kampf' || S.kampf.runde !== r) break;
        const h = S.helden[p], akt = V.aktionenVon(h).filter(a => V.bereit(S, p, a));
        const a = akt[Math.floor(Math.random() * akt.length)];
        const g = V.gegnerLebend(S); const ziel = a.ziel === 'gegner' ? g[0].id : a.ziel === 'held' ? p : a.ziel === 'anderer' ? S.teilnehmer.find(q => q !== p && S.helden[q].hp > 0) : null;
        const vor = S; S = V.aktion(S, p, { t: 'wahl', runde: r, a: a.id, ziel });
        if (S === vor) S = V.aktion(S, p, Object.assign({ t: 'wahl', runde: r }, V.standardWahl(S, p)));
      }
      runden++;
      const L = S.letzte;
      if (!L || L.runde !== r) { fehler++; console.log('keine Wiedergabe', seed, r); continue; }
      const hp = {}; for (const g of L.start.gegner) hp[g.id] = g.hp; for (const p in L.start.helden) hp[p] = L.start.helden[p].hp; for (const d of L.start.diener || []) hp[d.id] = d.hp;
      for (const e of L.ev) { arten[e.a] = (arten[e.a] || 0) + 1; if (e.neu) for (const g of e.neu) hp[g.id] = g.hp; if (e.diener) for (const d of e.diener) hp[d.id] = d.hp;
        for (const [id, d, nach] of e.d) { if (hp[id] + d !== nach) { fehler++; console.log('Delta passt nicht', seed, r, e.a, id, hp[id], d, nach); } hp[id] = nach; } }
      // Vergleich mit dem Stand nach der Runde (Helden vor dem Aufstehen nach dem Kampf)
      for (const g of (S.phase === 'kampf' ? S.gegner : [])) if (hp[g.id] !== g.hp) { fehler++; console.log('Gegner weicht ab', seed, r, g.id, hp[g.id], g.hp); }
      if (S.phase === 'kampf') for (const d of S.kampf.diener) if (hp[d.id] !== d.hp) { fehler++; console.log('Diener weicht ab', seed, r, d.id, hp[d.id], d.hp); }
      if (S.phase === 'kampf') for (const p of S.teilnehmer) if (hp[p] !== S.helden[p].hp) { fehler++; console.log('Held weicht ab', seed, r, p, hp[p], S.helden[p].hp); }
      if (S.phase !== 'kampf' && S.ergebnis !== 'niederlage') for (const id in hp) if (L.start.gegner.find(g => g.id === id) && hp[id] > 0) { fehler++; console.log('Kampf gewonnen, aber Gegner lebt in Wiedergabe', seed, id, hp[id]); }
    }
  }
}
console.log('Runden geprüft:', runden, '| Fehler:', fehler, '| Kampfrunden ohne vollständige Absichten:', ohneZiel);
console.log('Ereignisarten:', JSON.stringify(arten));
