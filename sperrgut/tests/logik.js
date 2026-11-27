// node tests/logik.js (für turm.js: NODE_PATH mit planck@1.4.2)
const assert = require("assert");
const R = require("../logic.js");
let n = 0; const ok = (b, t) => { assert.ok(b, t); n++; };
const t0 = 1e6;
// Lobby, Bots, Start
const S = R.neu("TEST", "a", "Anna");
S.online = ["a", "b"];
R.aktion(S, "b", { t: "hallo", name: "Ben" }, t0);
R.aktion(S, "a", { t: "bot", dazu: true }, t0);
ok(S.reihe.length === 3, "drei Spieler");
ok(!R.aktion(S, "b", { t: "start" }, t0).ok, "nur Spielleitung startet");
R.aktion(S, "a", { t: "einst", laenge: "kurz" }, t0);
R.aktion(S, "a", { t: "start" }, t0);
ok(S.phase === "auftrag" && S.tag.plan.length === 3 && S.tag.plan[2] === "hoch", "Plan mit Finale Hoch hinaus");
const a = S.a, bot = S.reihe[2];
ok(a.modus === "hoch" && a.tn.length === 3, "alle dabei");
// Stand und Ziel
R.aktion(S, "a", { t: "stand", h: 5, b: 1, g: 6 }, a.start + 1000);
R.aktion(S, "b", { t: "stand", h: 12.4, b: 0, g: 9, ziel: a.start + 20000 }, a.start + 21000);
ok(a.st.b.fertig === a.start + 20000 && a.erster, "Ziel gemeldet");
// Karten: Pizza → Karte, Gemeinheit trifft den Führenden (nicht fertig, nicht man selbst)
R.aktion(S, "a", { t: "pizza" }, a.start + 22000);
ok(a.karten.a.length === 1, "Karte gezogen");
a.karten.a = ["klavier"];
R.aktion(S, "a", { t: "karte", i: 0 }, a.start + 22000);
ok(a.ev[0].an === bot, "trifft den Bot");
a.karten.a = ["katze"];
const r = R.aktion(S, "a", { t: "karte", i: 0 }, a.start + 22500);
ok(!r.ok, "Schonfrist: keiner frei");
a.karten.a = ["gurt"];
R.aktion(S, "a", { t: "karte", i: 0 }, a.start + 22500);
ok(a.ev[1].an === "a", "Hilfe wirkt auf sich selbst");
// Nach 20 s Nachspielzeit Ende, Punkte
R.takt(S, a.start + 20000 + R.ZEIT.nach + 1);
ok(S.phase === "ergebnis", "Ergebnis nach Nachspielzeit");
ok(S.erg.liste[0].pid === "b" && S.erg.liste[0].punkte === 10, "Ben gewinnt 10");
ok(S.erg.liste[1].pid === "a" && S.erg.liste[1].punkte === 6, "Anna Platz 2 mit 6");
// weiter → kaputt
R.takt(S, S.weiterAb + 1);
ok(S.phase === "auftrag" && S.a.modus === "kaputt", "zweiter Auftrag");
const k = S.a;
R.aktion(S, "a", { t: "stand", h: 3, b: 3, g: 10 }, k.start + 1000);
ok(k.st.a.raus && k.st.a.l === 0, "drei Bruch: raus");
R.aktion(S, "b", { t: "stand", h: 4, b: 1, g: 30, fertig: true }, k.start + 1000);
R.aktion(S, bot, { t: "stand", h: 4, b: 2, g: 30, fertig: true }, k.start + 1000);
R.takt(S, k.start + 2000);
ok(S.phase === "ergebnis" && S.erg.liste[0].pid === "b" && S.erg.liste[2].pid === "a", "Wertung nach Leben");
R.takt(S, S.weiterAb + 1);
ok(S.a.modus === "hoch", "kurz: Finale ist wieder Hoch hinaus");
// WG-Umzug
const W = R.neu("WG", "a", "Anna"); W.online = ["a", "b", "c"];
R.aktion(W, "b", { t: "hallo", name: "Ben" }, t0); R.aktion(W, "c", { t: "hallo", name: "Cem" }, t0);
R.aktion(W, "a", { t: "einzeln", modus: "wg" }, t0);
const g = W.a.wg, erster = g.dran;
R.aktion(W, "a", { t: "wgGesetzt" }, W.a.start + 100);
R.takt(W, W.a.start + 100 + R.ZEIT.wgNach + 1);
ok(W.a.wg.dran !== erster, "nächster ist dran");
const zweiter = W.a.wg.dran;
R.aktion(W, "a", { t: "wgBruch" }, W.a.start + 5000);
ok(W.a.wg.raus[0] === zweiter, "wer Bruch baut, ist raus");
R.takt(W, W.a.start + 9000);
R.aktion(W, "a", { t: "wgBruch" }, W.a.start + 9500);
R.takt(W, W.a.start + 13000);
ok(W.phase === "ergebnis" && W.erg.liste[0].punkte === 10 && W.erg.liste[2].pid === zweiter, "WG-Wertung");
R.takt(W, W.weiterAb + 1);
ok(W.phase === "ende" && W.ehrung.stand.length === 3, "Siegerehrung");
// Teile-Folge gleich für alle
const ST = require("../teile.js");
ok(JSON.stringify(ST.folge(42, 50)) === JSON.stringify(ST.folge(42, 50)), "gleiche Folge");
ok(ST.folge(42, 60).filter(t => t.pizza).length >= 5, "Pizza-Kartons kommen vor");
// Physik (wenn planck da ist)
let planck = null; try { planck = require("planck"); } catch (e) {}
if (planck) {
  const TU = require("../turm.js");
  const t = TU.neu({ folge: Array.from({ length: 8 }, () => ({ typ: "O" })), planck, max: 8 });
  let last = null;
  for (let i = 0; i < 600; i++) { if (t.aktiv && t.aktiv !== last) { last = t.aktiv; t.fallen(); } t.schritt(1 / 30); }
  ok(t.hoehe > 15 && t.bruch === 0, "gerader Stapel aus großen Kartons steht (" + t.hoehe.toFixed(1) + ")");
  const u = TU.neu({ folge: [{ typ: "I" }, { typ: "O" }], planck });
  let schon = false;
  for (let i = 0; i < 300; i++) { if (u.aktiv && !schon) { for (let k = 0; k < 10; k++) u.schieben(1); u.fallen(); schon = true; } u.schritt(1 / 30); }
  ok(u.bruch >= 1, "Teil neben der Palette ist Bruch");
} else console.log("(Physik-Tests übersprungen: planck fehlt)");
console.log("alle Tests ok (" + n + ")");
