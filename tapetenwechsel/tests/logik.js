// node tests/logik.js
const assert = require("assert");
const R = require("../logic.js");
let n = 0; const ok = (b, t) => { assert.ok(b, t); n++; };
const t0 = 1e6;
const Z = R.ZEIT;

// Hilfen: Spiel mit Menschen a, b, … aufsetzen
function spiel(namen, einst) {
  const S = R.neu("TEST", "a", "Anna");
  S.rz = 12345;
  S.online = namen.slice();
  for (const p of namen.slice(1)) R.aktion(S, p, { t: "hallo", name: p.toUpperCase() }, t0);
  if (einst) R.aktion(S, "a", Object.assign({ t: "einst" }, einst), t0);
  return S;
}
// Verstecken und Warten überspringen: alle fertig, Verstecke angekommen, Countdown vorbei
function zurSuche(S, jetzt) {
  const r = S.r;
  for (const p of r.verstecker) R.aktion(S, p, { t: "fertig" }, r.versteckStart + 1000);
  R.takt(S, r.versteckStart + 1000);
  for (const p of r.verstecker) R.aktion(S, "a", { t: "versteckt", pid: p, farben: 3 }, r.versteckStart + 1100);
  R.takt(S, r.versteckStart + 1200);
  return r.suchStart;
}

// ---------- Lobby, Beitritt, Bots, Einstellungen ----------
{
  const S = spiel(["a", "b"]);
  ok(S.reihe.length === 2 && S.spieler.b.name === "B" && S.spieler.b.farbe === 1, "Beitritt mit freier Farbe");
  R.aktion(S, "b", { t: "hallo", name: "Bea" }, t0);
  ok(S.reihe.length === 2 && S.spieler.b.name === "Bea", "erneutes Hallo ändert nur den Namen");
  R.aktion(S, "b", { t: "name", name: "Bernd" }, t0);
  ok(S.spieler.b.name === "Bernd", "Name ändern");
  ok(!R.aktion(S, "b", { t: "bot", an: true }, t0).ok, "nur Spielleitung fügt Bots hinzu");
  R.aktion(S, "a", { t: "bot", an: true }, t0);
  R.aktion(S, "a", { t: "bot", dazu: true }, t0);
  const bots = S.reihe.filter(p => R.istBot(S, p));
  ok(bots.length === 2 && S.spieler[bots[0]].name === "Kalle" && S.spieler[bots[1]].name === "Jule", "zwei Bots mit Namen");
  ok(R.da(S, bots[0]) && R.da(S, "a") && !R.da(S, "x"), "da: Bot oder online");
  R.aktion(S, "a", { t: "bot", weg: bots[0] }, t0);
  ok(S.reihe.length === 3 && !S.spieler[bots[0]], "Bot entfernt");
  ok(!R.aktion(S, "a", { t: "bot", weg: "b" }, t0).ok, "Menschen kann man nicht als Bot entfernen");
  for (let i = 0; i < 10; i++) R.aktion(S, "a", { t: "bot", an: true }, t0);
  ok(S.reihe.length === 8, "höchstens 8 Spieler");
  ok(!R.aktion(S, "b", { t: "einst", art: "einer" }, t0).ok, "nur Spielleitung stellt ein");
  R.aktion(S, "a", { t: "einst", art: "einer", laenge: "lang", versteck: 120, niesen: false, abpausen: "frei" }, t0);
  ok(S.einst.art === "einer" && S.einst.laenge === "lang" && S.einst.versteck === 120 && !S.einst.niesen && S.einst.abpausen === "frei", "Einstellungen");
  R.aktion(S, "a", { t: "einst", versteck: 75, art: "quatsch", abpausen: "nie" }, t0);
  ok(S.einst.versteck === 120 && S.einst.art === "einer" && S.einst.abpausen === "frei", "ungültige Werte werden ignoriert");
  R.aktion(S, "a", { t: "einst", zimmer: "kueche" }, t0);
  R.aktion(S, "a", { t: "einst", zimmer: "kinderzimmer" }, t0);
  R.aktion(S, "a", { t: "einst", zimmer: "wohnzimmer" }, t0);
  ok(S.einst.zimmer.wohnzimmer && !S.einst.zimmer.kueche && !S.einst.zimmer.kinderzimmer, "ein Zimmer bleibt immer an");
  R.aktion(S, "a", { t: "einst", zimmer: { kueche: true } }, t0);
  ok(S.einst.zimmer.kueche && S.einst.zimmer.wohnzimmer, "Zimmer als Objekt");
  ok(R.ZIMMER_NAMEN.wohnzimmer === "Omas Wohnzimmer" && R.ARTEN.alle.name === "Alle suchen" && R.LAENGEN.lang.n === 7, "Konstanten");
  const E = R.neu("E", "a", "Anna"); E.online = ["a"];
  ok(!R.aktion(E, "a", { t: "start" }, t0).ok, "allein kein Start");
  ok(!R.aktion(S, "b", { t: "start" }, t0).ok, "nur Spielleitung startet");
}

// ---------- Plan ----------
for (const [laenge, nn] of [["kurz", 3], ["normal", 5], ["lang", 7]]) {
  const S = spiel(["a", "b", "c"], { laenge });
  R.aktion(S, "a", { t: "start" }, t0);
  const P = S.tag.plan;
  ok(P.length === nn && P.every(x => x.sucher.length === 0), "Alle suchen " + laenge + ": " + nn + " Runden");
  ok(P.every((x, i) => i === 0 || x.zimmer !== P[i - 1].zimmer), "nie zweimal dasselbe Zimmer hintereinander (" + laenge + ")");
  ok(new Set(P.slice(0, 3).map(x => x.zimmer)).size === 3, "die ersten drei Zimmer sind verschieden");
}
{
  const S = spiel(["a", "b", "c"], { laenge: "lang", zimmer: { wohnzimmer: true, kinderzimmer: false, kueche: false } });
  R.aktion(S, "a", { t: "start" }, t0);
  ok(S.tag.plan.every(x => x.zimmer === "wohnzimmer"), "nur ein Zimmer an: immer dasselbe");
}
{
  const S = spiel(["a", "b", "c", "d"], { art: "einer", laenge: "kurz" });
  R.aktion(S, "a", { t: "start" }, t0);
  const P = S.tag.plan;
  ok(P.length === 4 && P.every(x => x.sucher.length === 1), "Einer sucht, 4 Spieler: 4 Runden mit einem Sucher");
  ok(P.map(x => x.sucher[0]).sort().join() === "a,b,c,d", "jeder sucht einmal");
  ok(S.r.sucher.length === 1 && S.r.verstecker.length === 3 && !S.r.verstecker.includes(S.r.sucher[0]), "Sucher versteckt sich nicht");
}
for (const k of [6, 7]) {
  const namen = "abcdefg".split("").slice(0, k);
  const S = spiel(namen, { art: "einer" });
  R.aktion(S, "a", { t: "start" }, t0);
  const P = S.tag.plan, alle = P.flatMap(x => x.sucher);
  ok(P.length === Math.ceil(k / 2) && P[0].sucher.length === 2, k + " Spieler: zwei Sucher, " + Math.ceil(k / 2) + " Runden");
  ok(alle.length === k && new Set(alle).size === k, k + " Spieler: jeder sucht genau einmal");
}

// ---------- Phasen und Zeiten ----------
{
  const S = spiel(["a", "b", "c"]);
  R.aktion(S, "a", { t: "start" }, t0);
  const r = S.r;
  ok(S.phase === "runde" && r.teil === "verstecken" && r.versteckStart === t0 + Z.vorlauf && r.versteckEnde === r.versteckStart + 90000, "Verstecken mit Vorlauf und 90 s");
  ok(r.verstecker.length === 3 && r.sucher.length === 3, "Alle suchen: alle verstecken und suchen");
  ok(!R.takt(S, r.versteckStart + 5000), "noch nicht fertig");
  R.aktion(S, "a", { t: "fertig" }, r.versteckStart + 5000);
  R.aktion(S, "b", { t: "fertig" }, r.versteckStart + 6000);
  ok(!R.takt(S, r.versteckStart + 6000), "einer fehlt noch");
  S.online = ["a", "b"];
  ok(R.takt(S, r.versteckStart + 7000) && r.teil === "warten" && r.versteckEnde === r.versteckStart + 7000, "früher fertig, wer weg ist, zählt nicht");
  ok(!R.aktion(S, "c", { t: "fertig" }, r.versteckStart + 7100).ok, "fertig nur beim Verstecken");
  ok(!R.aktion(S, "b", { t: "versteckt", pid: "a", farben: 4 }, r.versteckStart + 7100).ok, "versteckt nur vom Spielleiter");
  R.aktion(S, "a", { t: "versteckt", pid: "a", farben: 4 }, r.versteckStart + 7100);
  ok(!R.takt(S, r.versteckStart + 7200) && r.teil === "warten", "Warten, b fehlt noch");
  R.aktion(S, "a", { t: "versteckt", pid: "b", farben: 2 }, r.versteckStart + 7300);
  ok(R.takt(S, r.versteckStart + 7400) && r.teil === "suchen", "alle Verstecke da: Suche beginnt sofort");
  ok(r.suchStart === r.versteckStart + 7400 + Z.countdown && r.suchEnde === r.suchStart + 90000, "Countdown 2 s, Suche 90 s");
  ok(!R.aktion(S, "a", { t: "fund", ziel: "b" }, r.suchStart - 100).ok, "kein Fund im Countdown");
  ok(S.spieler.a.stat.farben === 4 && r.farben.b === 2, "Farben gezählt");
}
{
  const S = spiel(["a", "b"]);
  R.aktion(S, "a", { t: "bot", an: true }, t0);
  R.aktion(S, "a", { t: "start" }, t0);
  const r = S.r;
  // Zwischenstand während des Versteckens zählt nicht als angekommen
  R.aktion(S, "a", { t: "versteckt", pid: "b", farben: 1 }, r.versteckStart + 15000);
  ok(R.takt(S, r.versteckEnde) && r.teil === "warten" && r.wartenBis === r.versteckEnde + Z.warten, "Zeit um: Warten");
  R.aktion(S, "a", { t: "versteckt", pid: "a", farben: 1 }, r.versteckEnde + 100);
  ok(!R.takt(S, r.versteckEnde + 2000), "Bot und b fehlen: weiter warten");
  ok(R.takt(S, r.versteckEnde + Z.warten) && r.teil === "suchen", "nach 3 s geht es trotzdem los");
}
{
  // Einer sucht: 120 s
  const S = spiel(["a", "b", "c"], { art: "einer", versteck: 60 });
  R.aktion(S, "a", { t: "start" }, t0);
  ok(S.r.versteckEnde - S.r.versteckStart === 60000, "Versteckzeit 60 s");
  const s0 = zurSuche(S);
  ok(S.r.suchEnde - s0 === 120000, "Einer sucht: 120 s");
}

// ---------- Funde ----------
{
  const S = spiel(["a", "b", "c"]);
  R.aktion(S, "a", { t: "start" }, t0);
  const s0 = zurSuche(S), r = S.r;
  R.takt(S, s0);
  ok(!R.aktion(S, "a", { t: "fund", ziel: "a" }, s0 + 1000).ok, "sich selbst finden geht nicht");
  ok(!R.aktion(S, "a", { t: "fund", ziel: "zz" }, s0 + 1000).ok, "Unbekannter ist kein Versteck");
  ok(R.aktion(S, "a", { t: "fund", ziel: "b", ms: 9000 }, s0 + 10000).ok && r.funde.b.von === "a" && r.funde.b.t === 9000, "Fund mit Zeit");
  ok(!R.aktion(S, "c", { t: "fund", ziel: "b", ms: 8000 }, s0 + 10100).ok, "wer zuerst kommt, bekommt den Fund");
  const e = r.ev[r.ev.length - 1];
  ok(e.t === "fund" && e.von === "a" && e.pid === "b" && e.n === r.evn, "Fund-Ereignis");
  R.aktion(S, "b", { t: "fund", ziel: "c", ms: 99999 }, s0 + 12000);
  ok(r.funde.c.t === 12000, "Zeit wird auf die bisherige Suchzeit begrenzt");
  // gefundene Spieler suchen weiter; daneben → 3 s gesperrt
  R.aktion(S, "b", { t: "daneben" }, s0 + 13000);
  ok(r.gesperrt.b === s0 + 16000 && r.daneben.b === 1 && S.spieler.b.stat.daneben === 1, "daneben: 3 s gesperrt");
  ok(r.suchEnde === s0 + 90000, "Alle suchen: keine Zeitstrafe");
  ok(!R.aktion(S, "b", { t: "fund", ziel: "a" }, s0 + 14000).ok && !R.aktion(S, "b", { t: "daneben" }, s0 + 14000).ok, "gesperrt: kein Fund, kein Daneben");
  ok(r.daneben.b === 1, "gesperrtes Daneben zählt nicht");
  ok(R.aktion(S, "b", { t: "fund", ziel: "a", ms: 16500 }, s0 + 16500).ok, "nach der Sperre geht es wieder");
  // alle gefunden → Auflösung
  ok(R.takt(S, s0 + 17000) && r.teil === "aufloesung", "alle gefunden: Suche endet");
  // Wertung Alle suchen: Finder 3 je Fund, Versteckte 1 je 20 s
  ok(r.punkte.a === 3 && r.punkte.b === 6 && r.punkte.c === 0, "Wertung Alle suchen (früh gefunden)");
  ok(r.aufloesungEnde === s0 + 17000 + 6000 + 3 * 4000, "Auflösung 6 s + 4 s je Versteck");
  ok(r.rundflug.join() === "b,c,a", "Rundflug: zuerst die früh Gefundenen");
  ok(!R.aktion(S, "b", { t: "weiter" }, s0 + 18000).ok, "nur Spielleitung überspringt");
  R.aktion(S, "a", { t: "weiter" }, s0 + 18000);
  ok(S.r.nr === 1 && S.r.teil === "verstecken", "weiter: nächste Runde sofort");
  ok(S.tag.ergebnisse.length === 1 && S.tag.ergebnisse[0].punkte.a === 3 && S.tag.ergebnisse[0].daneben.b === 1, "Ergebnis gespeichert");
}
{
  // Wertung Alle suchen mit Zeit
  const S = spiel(["a", "b", "c"]);
  R.aktion(S, "a", { t: "start" }, t0);
  const s0 = zurSuche(S), r = S.r;
  R.aktion(S, "a", { t: "fund", ziel: "b", ms: 45000 }, s0 + 45500);
  R.takt(S, s0 + 89000); ok(r.teil === "suchen", "Suche läuft noch");
  ok(R.takt(S, s0 + 90000) && r.teil === "aufloesung", "Zeit um: Auflösung");
  ok(r.punkte.a === 3 + 4 + 4 && r.punkte.b === 2 && r.punkte.c === 4 + 4, "a: Fund + nie gefunden, b: 2× 20 s, c: nie gefunden");
  ok(r.tarnkuenstler === "a", "Tarnkünstler der Runde: Gleichstand → zuerst in der Reihe");
  ok(S.spieler.a.stat.unentdeckt === 90000 && S.spieler.b.stat.unentdeckt === 45000 && S.spieler.b.stat.schnellst === 45000, "Statistik unentdeckt");
}
{
  // Einer sucht: Funde, Strafen, Wertung
  const S = spiel(["a", "b", "c", "d"], { art: "einer" });
  R.aktion(S, "a", { t: "start" }, t0);
  const s0 = zurSuche(S), r = S.r, su = r.sucher[0], [v1, v2, v3] = r.verstecker;
  ok(!R.aktion(S, v1, { t: "fund", ziel: v2 }, s0 + 1000).ok, "Versteckte können nicht finden");
  ok(!R.aktion(S, v1, { t: "daneben" }, s0 + 1000).ok, "Versteckte können nicht daneben tippen");
  R.aktion(S, su, { t: "daneben" }, s0 + 2000);
  ok(r.suchEnde === s0 + 115000 && !r.gesperrt[su], "daneben: 5 s weniger Suchzeit, keine Sperre");
  ok(R.aktion(S, su, { t: "fund", ziel: v1, ms: 30000 }, s0 + 30000).ok, "Sucher findet sofort weiter");
  R.aktion(S, su, { t: "fund", ziel: v2, ms: 70000 }, s0 + 70000);
  R.takt(S, s0 + 114999);
  ok(r.teil === "suchen", "noch Zeit");
  R.takt(S, s0 + 115000);
  ok(r.teil === "aufloesung", "verkürzte Suchzeit um");
  ok(r.punkte[su] === 4 && r.punkte[v1] === 1 && r.punkte[v2] === 3 && r.punkte[v3] === 5 + 3, "Wertung Einer sucht");
  ok(S.spieler[su].stat.funde === 2 && S.spieler[su].stat.daneben === 1, "Statistik Sucher");
}
{
  const S = spiel(["a", "b", "c"], { art: "einer" });
  R.aktion(S, "a", { t: "start" }, t0);
  const s0 = zurSuche(S), r = S.r, su = r.sucher[0];
  for (let i = 0; i < 30; i++) R.aktion(S, su, { t: "daneben" }, s0 + 1000);
  ok(r.suchEnde === s0 + 1000, "Strafe nicht unter jetzt");
  ok(!R.aktion(S, su, { t: "daneben" }, s0 + 1000).ok, "danach ist die Suche vorbei");
  R.takt(S, s0 + 1000);
  ok(r.teil === "aufloesung", "Suche endet sofort");
}
{
  // Einer sucht: alle gefunden → +3
  const S = spiel(["a", "b", "c"], { art: "einer" });
  R.aktion(S, "a", { t: "start" }, t0);
  const s0 = zurSuche(S), r = S.r, su = r.sucher[0];
  for (const v of r.verstecker) R.aktion(S, su, { t: "fund", ziel: v, ms: 10000 }, s0 + 10000);
  R.takt(S, s0 + 10000);
  ok(r.punkte[su] === 2 * 2 + 3 && r.verstecker.every(v => r.punkte[v] === 0), "alle gefunden: Bonus 3");
}

// ---------- Niesen ----------
{
  const S = spiel(["a", "b", "c"]);
  R.aktion(S, "a", { t: "start" }, t0);
  const s0 = zurSuche(S), r = S.r;
  R.aktion(S, "a", { t: "fund", ziel: "b", ms: 1000 }, s0 + 1000);
  const niesen = () => r.ev.filter(e => e.t === "niesen");
  for (let t = s0; t < s0 + 45000; t += 200) R.takt(S, t);
  ok(niesen().length === 0, "erste Hälfte: kein Niesen");
  for (let t = s0 + 45000; t < s0 + 89900; t += 200) R.takt(S, t);
  const l = niesen();
  ok(l.length === 3 && l[0].zeit === s0 + 45000 && l[1].zeit === s0 + 60000 && l[2].zeit === s0 + 75000, "ab der Hälfte alle 15 s");
  ok(l.every(e => e.pid !== "b" && r.verstecker.includes(e.pid)), "nur noch nicht Gefundene niesen");
  // gleich mit gleichem Zufall
  const S2 = spiel(["a", "b", "c"]);
  R.aktion(S2, "a", { t: "start" }, t0);
  const s2 = zurSuche(S2);
  R.aktion(S2, "a", { t: "fund", ziel: "b", ms: 1000 }, s2 + 1000);
  for (let t = s2; t < s2 + 89900; t += 200) R.takt(S2, t);
  ok(JSON.stringify(S2.r.ev.filter(e => e.t === "niesen").map(e => e.pid)) === JSON.stringify(l.map(e => e.pid)), "Niesen hängt nur vom Startwert ab");
  const S3 = spiel(["a", "b", "c"], { niesen: false });
  R.aktion(S3, "a", { t: "start" }, t0);
  const s3 = zurSuche(S3);
  for (let t = s3; t < s3 + 89900; t += 200) R.takt(S3, t);
  ok(!S3.r.ev.some(e => e.t === "niesen"), "Niesen abgeschaltet");
}

// ---------- Ganzer Hausbesuch, Ehrentitel, Nachzügler ----------
{
  const S = spiel(["a", "b", "c"], { laenge: "kurz" });
  R.aktion(S, "a", { t: "start" }, t0);
  let jetzt = t0;
  // Runde 1: a findet b schnell, c bleibt versteckt; b tippt zweimal daneben
  let s0 = zurSuche(S);
  R.aktion(S, "a", { t: "fund", ziel: "b", ms: 5000 }, s0 + 5000);
  R.aktion(S, "b", { t: "daneben" }, s0 + 6000);
  R.aktion(S, "b", { t: "daneben" }, s0 + 20000);
  R.takt(S, s0 + 90000);
  const p1 = Object.assign({}, S.r.punkte);
  ok(p1.a === 3 + 4 + 4 && p1.b === 0 && p1.c === 8, "Punkte Runde 1");
  R.takt(S, S.r.aufloesungEnde);
  ok(S.r.nr === 1 && S.r.teil === "verstecken", "nach der Auflösung: nächste Runde");
  // Nachzügler mitten in Runde 2
  S.online.push("d");
  R.aktion(S, "d", { t: "hallo", name: "Dora" }, S.r.versteckStart);
  ok(S.spieler.d.punkte === Math.round((11 + 0 + 8) / 3), "Nachzügler bekommt den Durchschnitt");
  ok(!S.r.verstecker.includes("d") && !S.r.sucher.includes("d"), "Nachzügler wartet auf die nächste Runde");
  ok(!R.aktion(S, "d", { t: "fertig" }, S.r.versteckStart).ok, "Nachzügler versteckt sich noch nicht");
  s0 = zurSuche(S);
  R.aktion(S, "c", { t: "fund", ziel: "a", ms: 60000 }, s0 + 60000);
  R.takt(S, s0 + 90000);
  R.aktion(S, "a", { t: "weiter" }, s0 + 91000);
  ok(S.r.nr === 2 && S.r.verstecker.includes("d"), "Nachzügler ist in Runde 3 dabei");
  s0 = zurSuche(S);
  R.aktion(S, "d", { t: "fund", ziel: "c", ms: 80000 }, s0 + 80000);
  R.takt(S, s0 + 90000);
  R.takt(S, S.r.aufloesungEnde);
  ok(S.phase === "ende" && S.ehrung, "nach der letzten Runde: Siegerehrung");
  const st = S.ehrung.stand;
  const summe = p => S.tag.ergebnisse.reduce((s, e) => s + (e.punkte[p] || 0), 0);
  ok(S.spieler.a.punkte === summe("a") && S.spieler.d.punkte === 6 + summe("d"), "Punkte addiert");
  ok(st[0].punkte >= st[1].punkte && st.every((e, i) => i === 0 || e.platz === (e.punkte === st[i - 1].punkte ? st[i - 1].platz : i + 1)), "Rangliste mit Plätzen");
  ok(S.ehrung.meister === st[0].pid, "Meister der Tarnung");
  const titel = id => S.ehrung.titel.find(x => x.id === id);
  ok(S.spieler.c.stat.unentdeckt === 90000 + 90000 + 80000 && titel("tarnkuenstler").pid === "c" && titel("tarnkuenstler").name === "Tarnkünstler" && titel("tarnkuenstler").text.includes("4:20"), "Tarnkünstler: c am längsten unentdeckt");
  ok(titel("adlerauge").pid === "a", "Adlerauge: Gleichstand → zuerst in der Reihe");
  ok(titel("blindfisch").pid === "b" && titel("blindfisch").wert === 2, "Blindfisch");
  ok(titel("bunterhund").pid === "b" && titel("bunterhund").text.includes("0:05"), "Bunter Hund: am schnellsten gefunden");
  ok(titel("picasso").pid === "a" && titel("picasso").wert === 3, "Picasso");
  ok(R.rangliste(S).length === 4 && R.rangliste(S)[0].platz === 1, "rangliste()");
  // Neustart und Lobby
  ok(!R.aktion(S, "b", { t: "neustart" }, s0 + 200000).ok, "nur Spielleitung startet neu");
  R.aktion(S, "a", { t: "neustart" }, s0 + 200000);
  ok(S.phase === "runde" && S.r.nr === 0 && S.reihe.every(p => S.spieler[p].punkte === 0) && !S.ehrung, "Neustart: neuer Hausbesuch");
  ok(S.r.verstecker.length === 4, "beim Neustart sind alle dabei");
  R.aktion(S, "a", { t: "lobby" }, s0 + 201000);
  ok(S.phase === "lobby" && !S.r && !S.tag, "zurück in die Lobby");
  ok(!R.aktion(S, "a", { t: "neustart" }, s0 + 201000).ok, "Neustart nur am Ende");
}
{
  // Ein Bot ohne Versteck, ein Spieler offline: Runde läuft trotzdem
  const S = spiel(["a", "b", "c"], { art: "einer", laenge: "kurz" });
  R.aktion(S, "a", { t: "start" }, t0);
  const su = S.r.sucher[0];
  S.online = S.online.filter(p => p !== su);
  R.aktion(S, "a", { t: "weiter" }, t0);   // geht nicht: keine Auflösung
  ok(S.r.teil === "verstecken", "weiter nur in der Auflösung");
  R.takt(S, S.r.versteckEnde); R.takt(S, S.r.wartenBis);
  ok(S.r.teil === "suchen", "ohne Sucher wird trotzdem gesucht");
  R.takt(S, S.r.suchEnde);
  ok(S.r.teil === "aufloesung" && S.r.verstecker.every(v => S.r.punkte[v] === 6 + 3), "nie gefunden: 6 + 3");
}
{
  // Übernahme der Spielleitung: Runde beginnt neu, Punkte bleiben
  const S = spiel(["a", "b", "c"]);
  R.aktion(S, "a", { t: "start" }, t0);
  const s0 = zurSuche(S);
  R.takt(S, s0 + 90000); R.takt(S, S.r.aufloesungEnde);
  const punkte = S.spieler.a.punkte, z = S.r.zimmer, seed = S.r.seed;
  zurSuche(S);
  R.neustart(S, s0 + 200000);
  ok(S.r.nr === 1 && S.r.teil === "verstecken" && S.r.zimmer === z && S.r.seed === seed && S.r.versteckStart === s0 + 200000 + Z.vorlauf, "Übernahme: Runde neu");
  ok(S.spieler.a.punkte === punkte && S.tag.ergebnisse.length === 1, "Übernahme: Punkte bleiben");
  ok(R.sicht(S, "b") === S, "sicht");
}
console.log("alle Tests ok (" + n + ")");
