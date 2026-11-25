// Orbit: Brett, Runden und Missionsablauf ohne Netz und ohne Oberfläche (mit node testbar).
//
// Der Spielleiter hält den Zustand S. Die Handys schicken Aktionen, der Spielleiter ruft RM.aktion(S, pid, m, jetzt)
// und alle 200 ms RM.takt(S, jetzt) auf (Zeiten in Spielleiter-Millisekunden). Jedes Handy bekommt RM.sicht(S, pid),
// darin fehlen Geheimnisse wie die Wahl oder die Wetten der anderen.
//
// Missionen melden sich in window.ORBIT_MISSIONEN an (siehe missionen/*.js; Oberfläche in window.ORBIT_UI). Teil für den Spielleiter:
//   { id, name, art, ab, eingabe, kurz, anleitung: [...], besser: "hoch"|"niedrig",
//     neu(tn, rng) → d, start(d, jetzt, ctx), aktion(d, pid, m, jetzt, ctx) → true|"Fehlertext",
//     takt(d, jetzt, ctx) → true bei Änderung (setzt d.fertig = true am Ende), wertung(d) → { pid: Wert|null },
//     sicht(d, pid) → Kopie ohne Geheimnisse, bot(d, pid, rng, jetzt) → Aktion oder null }
//   „Einer gegen alle“: neu(tn, rng, einzelner) bekommt den Einzelnen (Alien-Feld, sonst Zufall), dazu
//     ausgang(d) → "einzeln" | "crew" (wer gewonnen hat) und wertText(d, pid) → Text fürs Ergebnis.
//   Live-Missionen: schritt(d, dt, ein, jetzt, ctx), bild(d), bildFuer(bild, d, pid) (optional: Geheimes entfernen).
//   „Jeder für sich“ (Greifarm, Bordküche): Jedes Handy rechnet sein Spiel selbst, der Spielleiter sammelt Stände (missionen/solo.js).
//   „Teams“: Die Teams werden ausgelost (RM.TEAMNAMEN), neu(tn, rng, null, teams) bekommt [[pid …], [pid …]], dazu
//     ausgang(d) → 0 | 1 (Siegerteam) | -1 (Gleichstand). Sieger bekommen je 8 Energie, die anderen je 2 (Gleichstand: je 5).
//   wertText(d, pid) geht bei jeder Mission (z. B. „keine Kugel im Feld“).
//   ctx = { tn: Teilnehmer, aktiv: Teilnehmer, die gerade verbunden sind (Bots immer), bots, rng, einzelner, teams }
//
// Phasen: "lobby" → "brett" (Runde: würfeln, ziehen, Missionswahl, wetten) → "mission" → "brett" … → "ende" (Siegerehrung).
// Aus der Lobby kann der Spielleiter auch eine einzelne Mission ohne Brett starten (zum Üben).
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const MISSIONEN = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};

  const MAX = 8;
  const FARBEN = [
    { name: "Türkis", f: "#2EC4B6" }, { name: "Orange", f: "#FF7A2F" }, { name: "Gelb", f: "#FFD23F" }, { name: "Pink", f: "#FF5C9A" },
    { name: "Grün", f: "#7BD957" }, { name: "Violett", f: "#A57BFF" }, { name: "Himmel", f: "#4DA3FF" }, { name: "Silber", f: "#C9D1E0" }
  ];
  // Energie je Platz, nach Zahl der Teilnehmer gestaffelt: Der Abstand zwischen Erstem und Letztem bleibt groß,
  // auch wenn nur zwei oder drei mitspielen
  const ENERGIE = { 2: [10, 3], 3: [10, 6, 2], 4: [10, 7, 4, 2], 5: [10, 7, 5, 3, 1], 6: [10, 7, 5, 3, 2, 1], 7: [10, 7, 5, 4, 3, 2, 1], 8: [10, 7, 5, 4, 3, 2, 1, 1] };
  const ZEIT = {
    anleitung: 30000, countdown: 3500, ergebnis: 25000,
    wuerfeln: 20000, wuerfelPause: 1500, schritt: 280, frage: 10000, zugEnde: 1600, botDenkt: 1300, wahl: 20000, wetten: 20000
  };
  const BOTNAMEN = ["Nova", "Kepler", "Luna", "Orion", "Vega", "Atlas", "Lyra", "Juri"];

  // ---------- Das Brett: 32 Module im Ring, Modul 0 ist die Luftschleuse ----------
  const FELDER = "LVMVBVGMWVPVAMTVBGVMPVBMWVTGVAMV";
  const N = FELDER.length;
  const FELD = {
    L: { name: "Luftschleuse", text: "Start" },
    V: { name: "Versorgungskapsel", text: "+3 Energie" },
    M: { name: "Meteoritenschauer", text: "−3 Energie" },
    P: { name: "Weltraumpirat", text: "Klau jemandem 5 Energie" },
    T: { name: "Teleporter", text: "Tausche den Platz mit jemandem" },
    B: { name: "Bordcomputer", text: "Gratiswette: richtig getippt +8" },
    G: { name: "Gravitationsanomalie", text: "Zufall: −5 bis +10, selten ein Kristall" },
    A: { name: "Alien-Feld", text: "Du bist das nächste Alien" },
    W: { name: "Wurmloch", text: "Für 5 Energie auf die andere Seite" }
  };
  const WURMLOCH = { 8: 24, 24: 8 };
  const START = 10, PREIS = 20, MAXKAUF = 3, WURMPREIS = 5, MAXWETTE = 5, GRATIS = 8, GRATIS_LEICHT = 5;
  const LAENGEN = { kurz: 5, normal: 8, lang: 12 };

  // Zufall mit Startwert (mulberry32): gleicher Startwert → gleiche Folge auf jedem Handy
  function zufall(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Zufall des Spielleiters für das Brett (Würfel, Händler, Anomalie). Der Zustand S.rs bleibt geheim.
  function zahl(S) {
    const a = S.rs = (((S.rs == null ? S.seed : S.rs) >>> 0) + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const kopie = o => JSON.parse(JSON.stringify(o));

  function neu(code, pid, name) {
    return {
      code, epoch: 0, host: pid, phase: "lobby",
      spieler: { [pid]: { name: name || "?", farbe: 0, energie: 0, kristalle: 0 } },
      reihenfolge: [pid], online: [pid],
      mission: null, missionNr: 0, gespielt: [], partie: null, seed: Math.floor(Math.random() * 2 ** 31)
    };
  }

  const istBot = (S, p) => !!(S.spieler[p] && S.spieler[p].bot);
  const istDa = (S, p) => !!S.spieler[p] && (istBot(S, p) || (S.online || []).includes(p));
  const anwesend = S => S.reihenfolge.filter(p => istDa(S, p));
  function freieFarbe(S, ausser) {
    const belegt = new Set(Object.keys(S.spieler).filter(p => p !== ausser && istDa(S, p)).map(p => S.spieler[p].farbe));
    for (let i = 0; i < FARBEN.length; i++) if (!belegt.has(i)) return i;
    return 0;
  }
  // Farbe eines Spielers, die gerade ein anderer Anwesender hat, wird neu vergeben
  function farbenPruefen(S) {
    const belegt = new Set();
    for (const p of anwesend(S)) {
      const sp = S.spieler[p];
      if (belegt.has(sp.farbe)) sp.farbe = FARBEN.findIndex((_, i) => !belegt.has(i));
      if (sp.farbe < 0) sp.farbe = 0;
      belegt.add(sp.farbe);
    }
  }

  function botDazu(S) {
    if (anwesend(S).length >= MAX) return false;
    let n = 1; while (S.spieler["bot" + n]) n++;
    const pid = "bot" + n;
    S.spieler[pid] = { name: BOTNAMEN[(n - 1) % BOTNAMEN.length], farbe: freieFarbe(S), energie: 0, kristalle: 0, bot: true };
    S.reihenfolge.push(pid);
    return true;
  }
  function botWeg(S) {
    const b = S.reihenfolge.filter(p => istBot(S, p)).pop();
    if (!b) return false;
    delete S.spieler[b]; S.reihenfolge = S.reihenfolge.filter(p => p !== b);
    return true;
  }

  // Missionen, die mit n Teilnehmern gehen
  // (verfuegbar(): z. B. braucht die Mondbasis planck.js vom CDN)
  const passend = n => Object.values(MISSIONEN).filter(b => n >= (b.ab || 1) && (!b.verfuegbar || b.verfuegbar()));

  function ctxVon(S) {
    const b = S.mission;
    return { tn: b.tn, aktiv: b.tn.filter(p => istDa(S, p)), bots: b.tn.filter(p => istBot(S, p)), rng: zufall(b.seed + (b.zug = (b.zug || 0) + 1)), einzelner: b.einzelner || null, teams: b.teams || null };
  }

  const EINER = "Einer gegen alle", TEAMS = "Teams", TEAMNAMEN = ["Komet", "Nebel"];
  // Teams auslosen: gemischt und halbiert, bei ungerader Zahl ist das erste Team größer
  function teamsLosen(tn, rng) {
    const a = tn.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const h = Math.ceil(a.length / 2);
    return [a.slice(0, h), a.slice(h)];
  }
  function missionStarten(S, id, jetzt, tnVorgabe, einzelnerVorgabe) {
    const B = MISSIONEN[id];
    if (!B) return "Diese Mission gibt es nicht.";
    const tn = (tnVorgabe || anwesend(S)).slice(0, MAX);
    if (tn.length < (B.ab || 1)) return `${B.name} braucht mindestens ${B.ab} Mitspieler.`;
    if (B.verfuegbar && !B.verfuegbar()) return `${B.name} konnte nicht geladen werden. Bitte die Seite neu laden.`;
    S.missionNr += 1;
    const seed = (S.seed + S.missionNr * 7919) >>> 0;
    // Einer gegen alle: wer auf dem Alien-Feld stand, sonst der Zufall
    let einzelner = null;
    if (B.art === EINER) {
      const P = S.partie;
      if (einzelnerVorgabe && tn.includes(einzelnerVorgabe)) einzelner = einzelnerVorgabe;
      else if (P && P.alien && tn.includes(P.alien)) einzelner = P.alien;
      else einzelner = tn[Math.floor(zufall(seed + 1)() * tn.length)];
      if (P && P.alien === einzelner) P.alien = null;
    }
    const teams = B.art === TEAMS ? teamsLosen(tn, zufall(seed + 2)) : null;
    S.mission = { id, nr: S.missionNr, tn, seed, einzelner, teams, schritt: "anleitung", bis: jetzt + ZEIT.anleitung, bereit: {}, d: B.neu(tn, zufall(seed), einzelner, teams), ergebnis: null };
    if (S.partie) Object.assign(S.mission, { partie: true, faktor: faktor(S) });
    S.phase = "mission";
    return null;
  }
  // Nach einer Übernahme: laufende Mission von vorn (die Geheimnisse des alten Spielleiters sind weg)
  function missionNeustart(S, jetzt) {
    if (S.phase !== "mission" || !S.mission || S.mission.schritt === "ergebnis") return;
    const { id, tn, partie, einzelner } = S.mission; S.missionNr -= 1;
    if (missionStarten(S, id, jetzt, partie ? tn : null, einzelner)) { S.mission = null; if (S.partie) { S.phase = "brett"; rundeEnde(S, jetzt); } else S.phase = "lobby"; }
  }

  // Platzierung mit Gleichstand (1, 1, 3 …) und Energie je Platz
  function werten(S, jetzt) {
    const b = S.mission, B = MISSIONEN[b.id], werte = B.wertung(b.d) || {}, f = b.faktor || 1;
    const mit = b.tn.filter(p => werte[p] !== null && werte[p] !== undefined);
    const ergebnis = [];
    if (B.art === EINER && B.ausgang) {
      // Gewinnt der Einzelne, bekommt er 15 Energie, gewinnt die Crew, bekommt jeder aus der Crew 6
      const einzeln = B.ausgang(b.d) === "einzeln", e = b.einzelner;
      const sieg = p => (p === e) === einzeln;
      mit.sort((x, y) => (sieg(y) - sieg(x)) || ((y === e) - (x === e)));
      for (const p of mit) ergebnis.push({ pid: p, wert: werte[p], text: B.wertText ? B.wertText(b.d, p) : null, platz: sieg(p) ? 1 : 2,
        energie: sieg(p) ? (p === e ? 15 : 6) * f : 0, rolle: p === e ? "einzeln" : "crew" });
    } else if (B.art === TEAMS && B.ausgang && b.teams) {
      // Das Siegerteam bekommt je 8 Energie, das andere je 2, bei Gleichstand alle 5
      const sieger = B.ausgang(b.d), team = p => (b.teams[0].includes(p) ? 0 : 1);
      const platz = p => (sieger === -1 || team(p) === sieger ? 1 : 2);
      mit.sort((x, y) => (platz(x) - platz(y)) || (team(x) - team(y)) || (B.besser === "niedrig" ? werte[x] - werte[y] : werte[y] - werte[x]));
      for (const p of mit) ergebnis.push({ pid: p, wert: werte[p], text: B.wertText ? B.wertText(b.d, p) : null, platz: platz(p),
        energie: (sieger === -1 ? 5 : platz(p) === 1 ? 8 : 2) * f, team: team(p) });
      b.sieger = sieger;
    } else {
      const tabelle = ENERGIE_FUER(b.tn.length);
      mit.sort((x, y) => B.besser === "niedrig" ? werte[x] - werte[y] : werte[y] - werte[x]);
      mit.forEach((p, i) => {
        const platz = i > 0 && werte[p] === werte[mit[i - 1]] ? ergebnis[i - 1].platz : i + 1;
        ergebnis.push({ pid: p, wert: werte[p], text: B.wertText ? B.wertText(b.d, p) : null, platz, energie: (tabelle[platz - 1] || 1) * f });
      });
    }
    for (const p of b.tn) if (!mit.includes(p)) ergebnis.push({ pid: p, wert: null, platz: null, energie: 0 });
    for (const e of ergebnis) if (S.spieler[e.pid]) {
      S.spieler[e.pid].energie += e.energie;
      if (S.partie && S.partie.stat[e.pid]) S.partie.stat[e.pid].mission += e.energie;
    }
    b.ergebnis = ergebnis; b.schritt = "ergebnis"; b.bis = S.partie && b.partie ? jetzt + ZEIT.ergebnis : 0;
    S.gespielt.push(b.id);
    if (S.partie && b.partie) wettenAuszahlen(S, ergebnis.filter(e => e.platz === 1).map(e => e.pid));
  }
  const ENERGIE_FUER = n => ENERGIE[Math.max(2, Math.min(8, n))];
  // Wetten: doppelter Einsatz zurück; bei Teams und „Einer gegen alle“ (fast ein Münzwurf) nur das Anderthalbfache
  function wettQuote(id) {
    const B = MISSIONEN[id], leicht = !!(B && (B.art === TEAMS || B.art === EINER));
    return { leicht, gewinn: e => leicht ? e + Math.ceil(e / 2) : 2 * e, gratis: leicht ? GRATIS_LEICHT : GRATIS, text: leicht ? "das Anderthalbfache" : "den doppelten Einsatz" };
  }

  // ---------- Partie auf dem Brett ----------
  const faktor = S => (S.partie && S.partie.runde >= S.partie.runden ? 2 : 1);
  // Wer auf dem Brett mitspielt (Nachzügler warten bis zur nächsten Runde)
  const mitspieler = S => S.partie ? S.reihenfolge.filter(p => S.spieler[p] && S.partie.pos[p] !== undefined) : [];
  // Stand: meiste Kristalle, dann meiste Energie
  function rangliste(S) {
    const ps = mitspieler(S);
    return ps.slice().sort((a, b) => (S.spieler[b].kristalle - S.spieler[a].kristalle) || (S.spieler[b].energie - S.spieler[a].energie) || (ps.indexOf(a) - ps.indexOf(b)));
  }
  function plaetze(S) {
    const r = rangliste(S), out = [];
    r.forEach((p, i) => {
      const a = S.spieler[p], v = i && S.spieler[r[i - 1]];
      out.push({ pid: p, platz: v && v.kristalle === a.kristalle && v.energie === a.energie ? out[i - 1].platz : i + 1 });
    });
    return out;
  }
  function log(S, text) { const P = S.partie; P.log.push(text); if (P.log.length > 8) P.log.splice(0, P.log.length - 8); }
  const nm = (S, p) => (S.spieler[p] ? S.spieler[p].name : "?");

  // Statistik für die Bonus-Kristalle: tief = schlechtester Platz nach einer Runde (für „Comeback“)
  const neueStat = () => ({ mission: 0, wette: 0, tief: 0, kapseln: 0, weg: 0 });
  function partieStarten(S, runden, jetzt) {
    const tn = anwesend(S);
    if (tn.length < 2) return "Eine Partie braucht mindestens 2 Leute. Nimm Bots dazu.";
    farbenPruefen(S);
    for (const p in S.spieler) { const sp = S.spieler[p]; sp.energie = START; sp.kristalle = 0; delete sp.wartet; }
    for (const p of S.reihenfolge) if (!tn.includes(p) && S.spieler[p]) S.spieler[p].wartet = true;
    S.partie = { runde: 0, runden, schritt: "", bis: 0, seit: jetzt, pos: {}, haendler: 0, haendler2: 16, wurf: {}, reihe: [], zug: null, wahl: null, gewaehlt: null,
      wetten: {}, gratis: {}, alien: null, zyklus: [], stat: {}, log: [], ehrung: null, endstand: null };
    for (const p of tn) { S.partie.pos[p] = 0; S.partie.stat[p] = neueStat(); }
    S.partie.haendler = 4 + Math.floor(zahl(S) * 12); S.partie.haendler2 = S.partie.haendler + 16;   // zwei Schiffe, gegenüber
    S.phase = "brett"; S.mission = null; S.gespielt = []; S.letzte = null;
    neueRunde(S, jetzt);
    return null;
  }
  function nachzueglerRein(S) {
    const P = S.partie, ps = mitspieler(S);
    const schnitt = ps.length ? Math.round(ps.reduce((s, p) => s + S.spieler[p].energie, 0) / ps.length) : START;
    for (const p of S.reihenfolge) {
      const sp = S.spieler[p];
      if (!sp || !sp.wartet || !istDa(S, p) || mitspieler(S).length >= MAX) continue;
      delete sp.wartet; sp.energie = schnitt; sp.kristalle = 0;
      P.pos[p] = 0; P.stat[p] = neueStat();
      log(S, `${sp.name} steigt mit ${schnitt} Energie ein.`);
    }
  }
  function neueRunde(S, jetzt) {
    const P = S.partie;
    P.runde += 1;
    if (P.runde > 1) haendlerWeiter(S);   // die Händlerschiffe bleiben eine Runde und fliegen dann weiter
    nachzueglerRein(S);
    Object.assign(P, { schritt: "wuerfeln", bis: jetzt + ZEIT.wuerfeln, seit: jetzt, wurf: {}, reihe: [], zug: null, wahl: null, gewaehlt: null, wetten: {} });
    log(S, P.runde >= P.runden ? `Letzte Runde ${P.runde}: Felder und Mission zählen doppelt!` : `Runde ${P.runde} von ${P.runden}`);
  }
  // Zwei Würfel; gespeichert als [a, b] (Tests dürfen auch eine Zahl setzen)
  function wuerfeln(S, p) { S.partie.wurf[p] = [1 + Math.floor(zahl(S) * 6), 1 + Math.floor(zahl(S) * 6)]; }
  const summe = w => Array.isArray(w) ? w[0] + w[1] : (w | 0);

  // Ein Zug: laufen → Feld (vielleicht mit Frage) → Händler (Frage) → fertig
  // Mit zwei Würfeln wählt man: einen der beiden Würfel oder die Summe
  function zugStarten(S, p, jetzt) {
    const P = S.partie, w = P.wurf[p], von = P.pos[p];
    P.zug = { pid: p, wurf: null, von, pfad: [], start: jetzt, stufe: "wahl", frage: null, text: "" };
    if (Array.isArray(w)) frage(P.zug, "schritte", jetzt, schrittOptionen(w));
    else losLaufen(P.zug, summe(w) || 2, jetzt);
  }
  const schrittOptionen = w => [...new Set([w[0], w[1], w[0] + w[1]])].sort((a, b) => a - b);
  function losLaufen(z, n, jetzt) {
    z.wurf = n; z.pfad = Array.from({ length: n }, (_, i) => (z.von + i + 1) % N); z.start = jetzt; z.stufe = "laufen"; z.frage = null;
  }
  function frage(z, art, jetzt, optionen) { z.frage = { art, seit: jetzt, bis: jetzt + ZEIT.frage, optionen: optionen || null }; }
  function feldWirkung(S, z, jetzt) {
    const P = S.partie, p = z.pid, sp = S.spieler[p], typ = FELDER[P.pos[p]], f = faktor(S);
    z.stufe = "feld"; z.feld = typ;
    const andere = mitspieler(S).filter(q => q !== p);
    let t = "";
    if (typ === "V") { sp.energie += 3 * f; P.stat[p].kapseln += 1; t = `+${3 * f} Energie`; }
    else if (typ === "M") { const v = Math.min(sp.energie, 3 * f); sp.energie -= v; t = v ? `−${v} Energie` : "Nichts mehr zu verlieren"; }
    else if (typ === "G") {
      const r = zahl(S);
      if (r < 0.06) { sp.kristalle += 1; t = "Ein Sternkristall!"; }
      else {
        const d = (r < 0.36 ? -5 : r < 0.66 ? 3 : r < 0.9 ? 6 : 10) * f;
        if (d < 0) { const v = Math.min(sp.energie, -d); sp.energie -= v; t = `−${v} Energie`; } else { sp.energie += d; t = `+${d} Energie`; }
      }
    }
    else if (typ === "B") { P.gratis[p] = true; t = "Gratiswette für die nächste Mission"; }
    else if (typ === "A") { P.alien = p; t = "Ist in der nächsten „Einer gegen alle“-Mission das Alien"; }
    else if (typ === "P") {
      const opfer = andere.filter(q => S.spieler[q].energie > 0);
      if (opfer.length) frage(z, "pirat", jetzt, opfer); else t = "Bei niemandem ist etwas zu holen";
    }
    else if (typ === "T") { if (andere.length) frage(z, "teleporter", jetzt, andere); }
    else if (typ === "W") { if (sp.energie >= WURMPREIS) frage(z, "wurmloch", jetzt); else t = "Zu wenig Energie für das Wurmloch"; }
    z.text = t;
    if (t) log(S, `${sp.name}: ${FELD[typ].name}, ${t}`);
    if (!z.frage) haendlerPruefen(S, z, jetzt);
  }
  function haendlerPruefen(S, z, jetzt) {
    const P = S.partie, sp = S.spieler[z.pid];
    if (!z.handel && schiffe(P).some(h => z.pfad.includes(h))) {
      z.handel = true;
      const k = Math.min(MAXKAUF, Math.floor(sp.energie / PREIS));
      if (k > 0) { z.stufe = "handel"; frage(z, "kauf", jetzt, k); return; }
      z.text2 = `Am Händlerschiff vorbei, aber zu wenig Energie (${PREIS} nötig)`;
    }
    z.stufe = "fertig"; z.ende = jetzt + ZEIT.zugEnde;
  }
  // Zwei Händlerschiffe; ein Zug kauft höchstens einmal, auch wenn er an beiden vorbeikommt
  const schiffe = P => P.haendler2 == null ? [P.haendler] : [P.haendler, P.haendler2];
  const abstand = (a, b) => Math.min(Math.abs(a - b), N - Math.abs(a - b));
  // Jedes Schiff fliegt mindestens 8 Module weit, die beiden bleiben mindestens 8 Module auseinander
  function haendlerWeiter(S) {
    const P = S.partie;
    for (const k of ["haendler", "haendler2"]) {
      if (P[k] == null) continue;
      const alt = P[k], anderes = k === "haendler" ? P.haendler2 : P.haendler;
      let neu = alt;
      for (let i = 0; i < 80; i++) {
        neu = 1 + Math.floor(zahl(S) * (N - 1));
        if (abstand(neu, alt) >= 8 && (anderes == null || abstand(neu, anderes) >= 8)) break;
      }
      P[k] = neu;
    }
  }
  // Antwort auf eine Frage im Zug (von Spieler, Bot oder bei Zeitablauf w = undefined → Vorgabe)
  function antworten(S, w, jetzt) {
    const P = S.partie, z = P.zug, fr = z.frage, p = z.pid, sp = S.spieler[p], f = faktor(S);
    if (fr.art === "schritte") {
      if (w !== undefined && !fr.optionen.includes(w)) return;                        // ungültig: weiter warten
      const n = w === undefined ? fr.optionen[fr.optionen.length - 1] : w;               // ohne Antwort: beide Würfel
      log(S, `${sp.name} zieht ${n} Module${fr.optionen.length > 1 && n !== fr.optionen[fr.optionen.length - 1] ? " (nur ein Würfel)" : ""}.`);
      losLaufen(z, n, jetzt);
      return;
    }
    if (fr.art === "pirat") {
      const ziel = fr.optionen.includes(w) ? w : fr.optionen.slice().sort((a, b) => S.spieler[b].energie - S.spieler[a].energie)[0];
      const v = Math.min(S.spieler[ziel].energie, 5 * f);
      S.spieler[ziel].energie -= v; sp.energie += v;
      z.text = `Klaut ${nm(S, ziel)} ${v} Energie`;
    } else if (fr.art === "teleporter") {
      if (fr.optionen.includes(w)) { const a = P.pos[p]; P.pos[p] = P.pos[w]; P.pos[w] = a; z.text = `Tauscht den Platz mit ${nm(S, w)}`; }
      else z.text = "Bleibt an Ort und Stelle";
    } else if (fr.art === "wurmloch") {
      if (w === "ja" && sp.energie >= WURMPREIS) { sp.energie -= WURMPREIS; P.pos[p] = WURMLOCH[P.pos[p]]; z.text = `Springt für ${WURMPREIS} Energie durchs Wurmloch`; }
      else z.text = "Nimmt das Wurmloch nicht";
    } else if (fr.art === "kauf") {
      const k = Math.min(fr.optionen, Math.floor(sp.energie / PREIS), w === undefined || w === "ja" ? MAXKAUF : Math.max(0, w | 0));
      if (k > 0) {
        sp.energie -= k * PREIS; sp.kristalle += k;
        z.text2 = `Kauft ${k === 1 ? "einen Sternkristall" : k + " Sternkristalle"} für ${k * PREIS} Energie.`;
      } else z.text2 = "Kauft keinen Kristall";
      log(S, `${sp.name}: ${z.text2}`);
      z.frage = null; z.stufe = "fertig"; z.ende = jetzt + ZEIT.zugEnde;
      return;
    }
    log(S, `${sp.name}: ${FELD[z.feld].name}, ${z.text}`);
    z.frage = null;
    haendlerPruefen(S, z, jetzt);
  }
  function botAntwort(S, z) {
    const fr = z.frage;
    if (fr.art === "kauf") return fr.optionen;
    if (fr.art === "schritte") return botSchritte(S, z);
    if (fr.art === "pirat") return fr.optionen.slice().sort((a, b) => S.spieler[b].energie - S.spieler[a].energie)[0];
    if (fr.art === "teleporter") return zahl(S) < 0.5 ? fr.optionen[Math.floor(zahl(S) * fr.optionen.length)] : "nein";
    if (fr.art === "wurmloch") return zahl(S) < 0.5 ? "ja" : "nein";
    return undefined;
  }

  // Bot wählt die Schrittzahl mit dem besten Ziel: Händler erreichen, gute Felder, schlechte meiden
  const FELDWERT = { V: 3, M: -3, G: 2, P: 4, B: 2, A: 2, T: 0, W: 1, L: 0 };
  function botSchritte(S, z) {
    const P = S.partie, sp = S.spieler[z.pid];
    const wert = n => {
      let v = FELDWERT[FELDER[(z.von + n) % N]] || 0;
      const vorbei = Array.from({ length: n }, (_, i) => (z.von + i + 1) % N).some(m => schiffe(P).includes(m));
      if (vorbei && sp.energie >= PREIS) v += 10 + 5 * Math.min(MAXKAUF, Math.floor(sp.energie / PREIS));
      return v + n * 0.3 + zahl(S) * 1.5;   // weiter ist meist besser; etwas Zufall
    };
    return z.frage.optionen.slice().sort((a, b) => wert(b) - wert(a))[0];
  }
  function wahlStarten(S, jetzt) {
    const P = S.partie, da = mitspieler(S).filter(p => istDa(S, p));
    let pool = passend(da.length).map(b => b.id);
    if (!pool.length) pool = Object.keys(MISSIONEN);   // solange es wenige Missionen gibt
    let frei = pool.filter(id => !P.zyklus.includes(id));
    if (!frei.length) { P.zyklus = []; frei = pool; }
    for (let i = frei.length - 1; i > 0; i--) { const j = Math.floor(zahl(S) * (i + 1)); [frei[i], frei[j]] = [frei[j], frei[i]]; }
    // Wartet ein Alien vom Alien-Feld, ist eine „Einer gegen alle“-Mission dabei (wenn es eine passende gibt)
    if (P.alien && istDa(S, P.alien) && !frei.slice(0, 3).some(id => MISSIONEN[id].art === EINER)) {
      const e = pool.filter(id => MISSIONEN[id].art === EINER && !frei.slice(0, 2).includes(id));
      if (e.length) frei = frei.slice(0, 2).concat(e[Math.floor(zahl(S) * e.length)]);
    }
    const r = rangliste(S).filter(p => istDa(S, p));
    P.schritt = "wahl"; P.seit = jetzt; P.bis = jetzt + ZEIT.wahl;
    P.wahl = { wer: r[r.length - 1] || null, optionen: frei.slice(0, 3) };
    if (!P.wahl.wer || !P.wahl.optionen.length) { log(S, "Keine Mission diesmal."); rundeEnde(S, jetzt); }
  }
  function missionWaehlen(S, id, jetzt) {
    const P = S.partie;
    P.gewaehlt = id; P.zyklus.push(id); P.wahl.gewaehlt = id;
    log(S, `${nm(S, P.wahl.wer)} wählt die Mission ${MISSIONEN[id] ? MISSIONEN[id].name : id}.`);
    P.schritt = "wetten"; P.seit = jetzt; P.bis = jetzt + ZEIT.wetten; P.wetten = {};
  }
  function wettenEnde(S, jetzt) {
    const P = S.partie;
    for (const p in P.wetten) {
      const w = P.wetten[p], sp = S.spieler[p];
      w.einsatz = w.auf ? Math.max(0, Math.min(w.einsatz | 0, MAXWETTE, sp ? sp.energie : 0)) : 0;
      if (sp) sp.energie -= w.einsatz;
      w.gratis = !!(w.auf && P.gratis[p]);            // die Gratiswette vom Bordcomputer gilt für diesen Tipp
      if (w.gratis) delete P.gratis[p];
    }
    const tn = mitspieler(S).filter(p => istDa(S, p));
    const f = missionStarten(S, P.gewaehlt, jetzt, tn);
    if (f) { log(S, f); wettenZurueck(S); rundeEnde(S, jetzt); }
  }
  function wettenZurueck(S) {
    const P = S.partie;
    for (const p in P.wetten) {
      const w = P.wetten[p];
      if (S.spieler[p]) S.spieler[p].energie += w.einsatz | 0;
      if (w.gratis) P.gratis[p] = true;
    }
    P.wetten = {};
  }
  function wettenAuszahlen(S, sieger) {
    const P = S.partie, b = S.mission, liste = [];
    for (const p in P.wetten) {
      const w = P.wetten[p]; if (!w.auf || !S.spieler[p]) continue;
      const richtig = sieger.includes(w.auf), gratis = !!w.gratis, q = wettQuote(b.id);
      const gewinn = richtig ? q.gewinn(w.einsatz | 0) + (gratis ? q.gratis : 0) : 0;
      S.spieler[p].energie += gewinn;
      if (P.stat[p]) P.stat[p].wette += gewinn - (w.einsatz | 0);
      liste.push({ pid: p, auf: w.auf, einsatz: w.einsatz | 0, gratis, richtig, gewinn });
    }
    b.wetten = liste; P.wetten = {};
  }
  function rundeEnde(S, jetzt) {
    const P = S.partie;
    for (const e of plaetze(S)) if (P.stat[e.pid]) P.stat[e.pid].tief = Math.max(P.stat[e.pid].tief || 0, e.platz);
    S.phase = "brett"; P.wahl = null; P.gewaehlt = null; P.zug = null;
    if (P.runde >= P.runden) partieEnde(S); else neueRunde(S, jetzt);
  }
  // Siegerehrung: drei Bonus-Kristalle, dann zählen Kristalle, bei Gleichstand Energie
  function partieEnde(S) {
    const P = S.partie, ps = mitspieler(S);
    const bonus = (titel, text, wert) => {
      const max = Math.max(0, ...ps.map(wert));
      const pids = max > 0 ? ps.filter(p => wert(p) === max) : [];
      for (const p of pids) S.spieler[p].kristalle += 1;
      return { titel, text, pids, wert: max };
    };
    // Comeback: vom schlechtesten Platz nach einer Runde bis zum Platz vor den Boni am weitesten nach oben
    const vorher = Object.fromEntries(plaetze(S).map(e => [e.pid, e.platz]));
    P.ehrung = [
      bonus("Missionsheld", "meiste Energie aus Missionen", p => P.stat[p].mission),
      bonus("Bester Tipper", "meiste Energie aus Wetten", p => P.stat[p].wette),
      bonus("Comeback", "Plätze aufgeholt", p => (P.stat[p].tief || 0) - vorher[p])
    ];
    P.endstand = plaetze(S);
    P.schritt = "ende"; P.zug = null; P.wahl = null;
    S.phase = "ende"; S.mission = null;
  }

  // Zeitgesteuerter Ablauf auf dem Brett; true, wenn sich etwas geändert hat
  function brettTakt(S, jetzt) {
    const P = S.partie;
    if (!P) return false;
    let anders = false;
    if (P.schritt === "wuerfeln") {
      for (const p of mitspieler(S)) if (P.wurf[p] == null && istBot(S, p) && jetzt - P.seit > 700 && zahl(S) < 0.2) { wuerfeln(S, p); anders = true; }
      const offen = mitspieler(S).filter(p => P.wurf[p] == null && istDa(S, p));
      if (!offen.length || jetzt >= P.bis) {
        for (const p of mitspieler(S)) if (P.wurf[p] == null) wuerfeln(S, p);
        P.reihe = rangliste(S).reverse();          // wer hinten liegt, zieht zuerst
        P.schritt = "ziehen"; P.zug = null; P.bis = jetzt + ZEIT.wuerfelPause; anders = true;
      }
    }
    if (P.schritt === "ziehen") {
      const z = P.zug;
      if (!z) {
        if (jetzt >= P.bis) {
          const p = P.reihe.shift();
          if (p && S.spieler[p] && P.pos[p] !== undefined) zugStarten(S, p, jetzt);
          else if (!p) wahlStarten(S, jetzt);
          anders = true;
        }
      } else if (z.stufe === "laufen") {
        if (jetzt >= z.start + z.pfad.length * ZEIT.schritt + 250) {
          P.pos[z.pid] = z.pfad[z.pfad.length - 1]; P.stat[z.pid].weg += z.wurf;
          feldWirkung(S, z, jetzt); anders = true;
        }
      } else if (z.frage) {
        if (istBot(S, z.pid)) { if (jetzt >= z.frage.seit + ZEIT.botDenkt) { antworten(S, botAntwort(S, z), jetzt); anders = true; } }
        else if (!istDa(S, z.pid) || jetzt >= z.frage.bis) { antworten(S, undefined, jetzt); anders = true; }
      } else if (z.stufe === "fertig" && jetzt >= z.ende) { P.zug = null; P.bis = jetzt; anders = true; }
    }
    if (P.schritt === "wahl" && P.wahl && !P.wahl.gewaehlt) {
      const w = P.wahl.wer, opt = P.wahl.optionen;
      const automatisch = (istBot(S, w) && jetzt >= P.seit + ZEIT.botDenkt) || !istDa(S, w) || jetzt >= P.bis || (opt.length === 1 && jetzt >= P.seit + 4000);
      if (automatisch) { missionWaehlen(S, opt[Math.floor(zahl(S) * opt.length)], jetzt); anders = true; }
    }
    if (P.schritt === "wetten") {
      const tn = mitspieler(S).filter(p => istDa(S, p));
      for (const p of tn) if (istBot(S, p) && !P.wetten[p] && jetzt - P.seit > 1000 && zahl(S) < 0.15) {
        const auf = zahl(S) < 0.4 ? p : tn[Math.floor(zahl(S) * tn.length)];
        P.wetten[p] = { auf, einsatz: Math.min(S.spieler[p].energie, Math.floor(zahl(S) * 4)) };
        anders = true;
      }
      if (tn.every(p => P.wetten[p]) || jetzt >= P.bis) { wettenEnde(S, jetzt); anders = true; }
    }
    return anders;
  }

  function aktion(S, pid, m, jetzt) {
    if (!m || !m.t) return { ok: false, fehler: "?" };
    const host = pid === S.host;
    const b = S.mission, P = S.partie;
    switch (m.t) {
      case "hallo": {
        const name = String(m.name || "?").trim().slice(0, 20) || "?";
        if (!S.spieler[pid]) {
          if (anwesend(S).length >= MAX) return { ok: false, fehler: "Die Station ist voll (8 Leute)." };
          S.spieler[pid] = { name, farbe: freieFarbe(S, pid), energie: 0, kristalle: 0 };
          if (P && S.phase !== "lobby") S.spieler[pid].wartet = true;   // Nachzügler: steigt in der nächsten Runde ein
          S.reihenfolge.push(pid);
        } else {
          S.spieler[pid].name = name;
          if (P && S.phase !== "ende" && P.pos[pid] === undefined) S.spieler[pid].wartet = true;
        }
        return { ok: true };
      }
      case "farbe": {
        const n = m.n | 0;
        if (!S.spieler[pid] || n < 0 || n >= FARBEN.length) return { ok: false, fehler: "?" };
        if (anwesend(S).some(p => p !== pid && S.spieler[p].farbe === n)) return { ok: false, fehler: "Die Farbe hat schon jemand." };
        S.spieler[pid].farbe = n; return { ok: true };
      }
      case "bot": {
        if (!host || S.phase !== "lobby") return { ok: false, fehler: "Nur der Spielleiter in der Lobby." };
        const r = m.dazu ? botDazu(S) : botWeg(S);
        return r ? { ok: true } : { ok: false, fehler: m.dazu ? "Mehr als 8 gehen nicht." : "Kein Bot da." };
      }
      case "partie": {
        if (!host || S.phase !== "lobby") return { ok: false, fehler: "Nur der Spielleiter in der Lobby." };
        const runden = LAENGEN[m.laenge] || (m.runden | 0) || LAENGEN.normal;
        const f = partieStarten(S, Math.max(1, Math.min(20, runden)), jetzt);
        return f ? { ok: false, fehler: f } : { ok: true };
      }
      case "wurf": {
        if (S.phase !== "brett" || !P || P.schritt !== "wuerfeln" || P.pos[pid] === undefined || P.wurf[pid] != null) return { ok: false };
        wuerfeln(S, pid); brettTakt(S, jetzt); return { ok: true };
      }
      case "antwort": {
        const z = P && P.zug;
        if (S.phase !== "brett" || !z || z.pid !== pid || !z.frage) return { ok: false };
        antworten(S, m.w, jetzt); return { ok: true };
      }
      case "waehle": {
        if (S.phase !== "brett" || !P || P.schritt !== "wahl" || !P.wahl || P.wahl.gewaehlt) return { ok: false };
        if (P.wahl.wer !== pid) return { ok: false, fehler: "Die Mission wählt, wer gerade Letzter ist." };
        if (!P.wahl.optionen.includes(m.id)) return { ok: false, fehler: "?" };
        missionWaehlen(S, m.id, jetzt); return { ok: true };
      }
      case "wette": {
        if (S.phase !== "brett" || !P || P.schritt !== "wetten" || P.pos[pid] === undefined) return { ok: false };
        const tn = mitspieler(S).filter(p => istDa(S, p));
        const auf = tn.includes(m.auf) ? m.auf : null;
        P.wetten[pid] = { auf, einsatz: auf ? Math.max(0, Math.min(MAXWETTE, S.spieler[pid].energie, m.einsatz | 0)) : 0 };
        brettTakt(S, jetzt); return { ok: true };
      }
      case "beenden": {
        if (!host || !P || (S.phase !== "brett" && S.phase !== "mission")) return { ok: false };
        if (S.phase === "mission" && b && b.schritt !== "ergebnis") wettenZurueck(S);
        partieEnde(S); return { ok: true };
      }
      case "neuePartie": {
        if (!host || S.phase !== "ende") return { ok: false };
        S.phase = "lobby"; S.partie = null; S.mission = null;
        for (const p in S.spieler) { S.spieler[p].energie = 0; S.spieler[p].kristalle = 0; delete S.spieler[p].wartet; }
        return { ok: true };
      }
      case "mission": {
        if (!host) return { ok: false, fehler: "Nur der Spielleiter wählt die Mission." };
        if (S.phase !== "lobby") return { ok: false, fehler: "Es läuft schon etwas." };
        farbenPruefen(S);
        const f = missionStarten(S, m.id, jetzt, null, m.einzelner);
        return f ? { ok: false, fehler: f } : { ok: true };
      }
      case "bereit": {
        if (!b || b.schritt !== "anleitung" || !b.tn.includes(pid)) return { ok: false };
        b.bereit[pid] = true; takt(S, jetzt); return { ok: true };
      }
      case "weiter": {
        if (!host || !b || b.schritt !== "ergebnis") return { ok: false };
        missionZuende(S, jetzt); return { ok: true };
      }
      case "abbrechen": {
        if (!host || !b || b.schritt === "ergebnis") return { ok: false };
        S.mission = null;
        if (b.partie && P) { wettenZurueck(S); log(S, "Die Mission wurde abgebrochen."); rundeEnde(S, jetzt); }
        else S.phase = "lobby";
        return { ok: true };
      }
      case "b": {   // Eingabe in der Mission
        if (!b || b.schritt !== "spiel" || !b.tn.includes(pid)) return { ok: false };
        const r = MISSIONEN[b.id].aktion(b.d, pid, m, jetzt, ctxVon(S));
        if (r === true) { takt(S, jetzt); return { ok: true }; }
        return { ok: false, fehler: typeof r === "string" ? r : "" };
      }
      case "punkteNull": {
        if (!host || S.phase !== "lobby") return { ok: false };
        for (const p in S.spieler) { S.spieler[p].energie = 0; S.spieler[p].kristalle = 0; }
        S.gespielt = []; S.letzte = null; return { ok: true };
      }
    }
    return { ok: false, fehler: "?" };
  }
  function missionZuende(S, jetzt) {
    const b = S.mission;
    S.letzte = { id: b.id, ergebnis: b.ergebnis }; S.mission = null;
    if (b.partie && S.partie) rundeEnde(S, jetzt); else S.phase = "lobby";
  }

  // Zeitgesteuerter Ablauf und Bots; true, wenn sich etwas geändert hat
  function takt(S, jetzt) {
    if (S.phase === "brett") return brettTakt(S, jetzt);
    const b = S.mission;
    if (S.phase !== "mission" || !b) return false;
    const B = MISSIONEN[b.id];
    let anders = false;
    if (b.schritt === "anleitung") {
      for (const p of b.tn) if (istBot(S, p) && !b.bereit[p]) { b.bereit[p] = true; anders = true; }
      const offen = b.tn.filter(p => istDa(S, p) && !b.bereit[p]);
      if (!offen.length || jetzt >= b.bis) { b.schritt = "countdown"; b.bis = jetzt + ZEIT.countdown; anders = true; }
    }
    if (b.schritt === "countdown" && jetzt >= b.bis) {
      b.schritt = "spiel"; b.bis = 0; B.start(b.d, jetzt, ctxVon(S)); anders = true;
    }
    if (b.schritt === "spiel") {
      if (B.bot) {
        const ctx = ctxVon(S);
        for (const p of b.tn) {
          if (!istBot(S, p)) continue;
          const m = B.bot(b.d, p, ctx.rng, jetzt);
          if (m && B.aktion(b.d, p, m, jetzt, ctx) === true) anders = true;
        }
      }
      if (B.takt(b.d, jetzt, ctxVon(S))) anders = true;
      if (b.d.fertig) { werten(S, jetzt); anders = true; }
    }
    // In der Partie geht es nach dem Ergebnis von selbst weiter
    if (b.schritt === "ergebnis" && b.partie && b.bis && jetzt >= b.bis) { missionZuende(S, jetzt); anders = true; }
    return anders;
  }

  // Live-Missionen: der Spielleiter rechnet 30-mal pro Sekunde (eingaben: { pid: { x, y, k } }); true bei Ereignissen
  function liveSchritt(S, jetzt, eingaben) {
    const b = S.mission;
    if (S.phase !== "mission" || !b || b.schritt !== "spiel") return false;
    const B = MISSIONEN[b.id];
    if (!B || !B.live) return false;
    const dt = b.liveZeit ? Math.min(0.05, Math.max(0, (jetzt - b.liveZeit) / 1000)) : 0;
    b.liveZeit = jetzt;
    const ctx = ctxVon(S), ein = {};
    for (const p of b.tn) if (istDa(S, p) && eingaben && eingaben[p]) ein[p] = eingaben[p];
    if (B.botEingabe) for (const p of b.tn) if (istBot(S, p)) ein[p] = B.botEingabe(b.d, p, ctx.rng, jetzt);
    let anders = !!B.schritt(b.d, dt, ein, jetzt, ctx);
    if (b.d.fertig) { werten(S, jetzt); anders = true; }
    return anders;
  }
  function liveBild(S) {
    const b = S.mission, B = b && MISSIONEN[b.id];
    return S.phase === "mission" && b && b.schritt === "spiel" && B && B.live && B.bild ? B.bild(b.d) : null;
  }
  // Das Bild für einen Spieler (manche Missionen verstecken etwas, z. B. das Alien im Frachtraum)
  function liveBildFuer(S, bild, pid) {
    const b = S.mission, B = b && MISSIONEN[b.id];
    return bild && B && B.bildFuer ? B.bildFuer(bild, b.d, pid) : bild;
  }

  function sicht(S, pid) {
    const v = kopie(S);
    if (v.mission && MISSIONEN[v.mission.id] && MISSIONEN[v.mission.id].sicht) v.mission.d = MISSIONEN[v.mission.id].sicht(v.mission.d, pid);
    // Der Startwert der Mission bleibt beim Spielleiter, außer die Mission braucht ihn auf allen Handys
    if (v.mission && !(MISSIONEN[v.mission.id] && MISSIONEN[v.mission.id].seedFuerAlle)) delete v.mission.seed;
    // Wetten der anderen bleiben verdeckt, bis die Mission ausgewertet ist
    if (v.partie && v.partie.wetten) for (const p in v.partie.wetten) if (p !== pid) v.partie.wetten[p] = { verdeckt: true };
    delete v.seed; delete v.rs;
    return v;
  }

  // Gesamtstand nach Energie (Lobby) bzw. nach Kristallen und Energie (Partie)
  function stand(S) {
    if (S.partie) return rangliste(S);
    return S.reihenfolge.filter(p => S.spieler[p]).sort((a, b) => S.spieler[b].energie - S.spieler[a].energie);
  }

  W.RM = {
    MAX, FARBEN, ENERGIE, ENERGIE_FUER, wettQuote, schrittOptionen, ZEIT, MISSIONEN, TEAMNAMEN, teamsLosen, FELDER, FELD, WURMLOCH, N, START, PREIS, MAXKAUF, WURMPREIS, MAXWETTE, GRATIS, GRATIS_LEICHT, LAENGEN,
    zufall, summe, schiffe, neu, aktion, takt, sicht, liveSchritt, liveBild, liveBildFuer, stand, passend, anwesend, istBot, istDa, missionNeustart, kopie, mitspieler, rangliste, plaetze, faktor
  };
})();
