// Orbit: Ablauf ohne Netz und ohne Oberfläche (mit node testbar).
//
// Der Spielleiter hält den Zustand S. Die Handys schicken Aktionen, der Spielleiter ruft RM.aktion(S, pid, m, jetzt)
// und alle 200 ms RM.takt(S, jetzt) auf (Zeiten in Spielleiter-Millisekunden). Jedes Handy bekommt RM.sicht(S, pid),
// darin fehlen Geheimnisse wie die Wahl der anderen.
//
// Missionen melden sich in window.ORBIT_MISSIONEN an (siehe missionen/*.js). Teil für den Spielleiter:
//   { id, name, art, ab, eingabe, kurz, anleitung: [...], besser: "hoch"|"niedrig",
//     neu(tn, rng) → d, start(d, jetzt, ctx), aktion(d, pid, m, jetzt, ctx) → true|"Fehlertext",
//     takt(d, jetzt, ctx) → true bei Änderung (setzt d.fertig = true am Ende), wertung(d) → { pid: Wert|null },
//     sicht(d, pid) → Kopie ohne Geheimnisse, bot(d, pid, rng, jetzt) → Aktion oder null }
//   ctx = { tn: Teilnehmer, aktiv: Teilnehmer, die gerade verbunden sind (Bots immer), rng }
//
// Ablauf in Schritt 1: Lobby → Mission (Anleitung → Countdown → Spiel → Ergebnis) → Lobby. Die Energie zählt weiter.
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const MISSIONEN = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};

  const MAX = 8;
  const FARBEN = [
    { name: "Karmin", f: "#C42A3A" }, { name: "Petrol", f: "#1F6F75" }, { name: "Gold", f: "#E0A526" }, { name: "Veilchen", f: "#7B52AB" },
    { name: "Himmel", f: "#3C8FD6" }, { name: "Klee", f: "#3F9A4C" }, { name: "Orange", f: "#E5712B" }, { name: "Rosa", f: "#DE6A9E" }
  ];
  const ENERGIE = [10, 7, 5, 4, 3, 2, 1, 1];
  const ZEIT = { anleitung: 30000, countdown: 3500 };
  const BOTNAMEN = ["Lotte", "Fritz", "Greta", "Emil", "Ida", "Paul", "Hanne", "Kurt"];

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
  const kopie = o => JSON.parse(JSON.stringify(o));

  function neu(code, pid, name) {
    return {
      code, epoch: 0, host: pid, phase: "lobby",
      spieler: { [pid]: { name: name || "?", farbe: 0, energie: 0 } },
      reihenfolge: [pid], online: [pid],
      mission: null, missionNr: 0, gespielt: [], seed: Math.floor(Math.random() * 2 ** 31)
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
    S.spieler[pid] = { name: BOTNAMEN[(n - 1) % BOTNAMEN.length], farbe: freieFarbe(S), energie: 0, bot: true };
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
  const passend = n => Object.values(MISSIONEN).filter(b => n >= (b.ab || 1));

  function ctxVon(S) {
    const b = S.mission;
    return { tn: b.tn, aktiv: b.tn.filter(p => istDa(S, p)), rng: zufall(b.seed + (b.zug = (b.zug || 0) + 1)) };
  }

  function missionStarten(S, id, jetzt) {
    const B = MISSIONEN[id];
    if (!B) return "Diese Mission gibt es nicht.";
    const tn = anwesend(S).slice(0, MAX);
    if (tn.length < (B.ab || 1)) return `${B.name} braucht mindestens ${B.ab} Mitspieler.`;
    S.missionNr += 1;
    const seed = (S.seed + S.missionNr * 7919) >>> 0;
    S.mission = { id, nr: S.missionNr, tn, seed, schritt: "anleitung", bis: jetzt + ZEIT.anleitung, bereit: {}, d: B.neu(tn, zufall(seed)), ergebnis: null };
    S.phase = "mission";
    return null;
  }
  // Nach einer Übernahme: laufende Mission von vorn (die Geheimnisse des alten Spielleiters sind weg)
  function missionNeustart(S, jetzt) {
    if (S.phase !== "mission" || !S.mission || S.mission.schritt === "ergebnis") return;
    const { id } = S.mission; S.missionNr -= 1;
    if (missionStarten(S, id, jetzt)) { S.phase = "lobby"; S.mission = null; }
  }

  // Platzierung mit Gleichstand (1, 1, 3 …) und Energie je Platz
  function werten(S) {
    const b = S.mission, B = MISSIONEN[b.id], werte = B.wertung(b.d) || {};
    const mit = b.tn.filter(p => werte[p] !== null && werte[p] !== undefined);
    const tabelle = ENERGIE_FUER(b.tn.length);
    mit.sort((x, y) => B.besser === "niedrig" ? werte[x] - werte[y] : werte[y] - werte[x]);
    const ergebnis = [];
    mit.forEach((p, i) => {
      const platz = i > 0 && werte[p] === werte[mit[i - 1]] ? ergebnis[i - 1].platz : i + 1;
      ergebnis.push({ pid: p, wert: werte[p], platz, energie: tabelle[platz - 1] || 1 });
    });
    for (const p of b.tn) if (!mit.includes(p)) ergebnis.push({ pid: p, wert: null, platz: null, energie: 0 });
    for (const e of ergebnis) if (S.spieler[e.pid]) S.spieler[e.pid].energie += e.energie;
    b.ergebnis = ergebnis; b.schritt = "ergebnis"; b.bis = 0;
    S.gespielt.push(b.id);
  }
  const ENERGIE_FUER = n => n === 2 ? [10, 5] : ENERGIE;

  function aktion(S, pid, m, jetzt) {
    if (!m || !m.t) return { ok: false, fehler: "?" };
    const host = pid === S.host;
    const b = S.mission;
    switch (m.t) {
      case "hallo": {
        const name = String(m.name || "?").trim().slice(0, 20) || "?";
        if (!S.spieler[pid]) {
          if (S.phase === "lobby" && anwesend(S).length >= MAX) return { ok: false, fehler: "Die Station ist voll (8 Leute)." };
          S.spieler[pid] = { name, farbe: freieFarbe(S, pid), energie: 0 };
          S.reihenfolge.push(pid);
        } else S.spieler[pid].name = name;
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
      case "mission": {
        if (!host) return { ok: false, fehler: "Nur der Spielleiter wählt die Mission." };
        if (S.phase !== "lobby") return { ok: false, fehler: "Es läuft schon eine Mission." };
        farbenPruefen(S);
        const f = missionStarten(S, m.id, jetzt);
        return f ? { ok: false, fehler: f } : { ok: true };
      }
      case "bereit": {
        if (!b || b.schritt !== "anleitung" || !b.tn.includes(pid)) return { ok: false };
        b.bereit[pid] = true; takt(S, jetzt); return { ok: true };
      }
      case "weiter": {
        if (!host || !b || b.schritt !== "ergebnis") return { ok: false };
        S.phase = "lobby"; S.letzte = { id: b.id, ergebnis: b.ergebnis }; S.mission = null; return { ok: true };
      }
      case "abbrechen": {
        if (!host || !b || b.schritt === "ergebnis") return { ok: false };
        S.phase = "lobby"; S.mission = null; return { ok: true };
      }
      case "b": {   // Eingabe in der Mission
        if (!b || b.schritt !== "spiel" || !b.tn.includes(pid)) return { ok: false };
        const r = MISSIONEN[b.id].aktion(b.d, pid, m, jetzt, ctxVon(S));
        if (r === true) { takt(S, jetzt); return { ok: true }; }
        return { ok: false, fehler: typeof r === "string" ? r : "" };
      }
      case "punkteNull": {
        if (!host || S.phase !== "lobby") return { ok: false };
        for (const p in S.spieler) S.spieler[p].energie = 0;
        S.gespielt = []; S.letzte = null; return { ok: true };
      }
    }
    return { ok: false, fehler: "?" };
  }

  // Zeitgesteuerter Ablauf und Bots; true, wenn sich etwas geändert hat
  function takt(S, jetzt) {
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
      if (b.d.fertig) { werten(S); anders = true; }
    }
    return anders;
  }

  function sicht(S, pid) {
    const v = kopie(S);
    if (v.mission && MISSIONEN[v.mission.id] && MISSIONEN[v.mission.id].sicht) v.mission.d = MISSIONEN[v.mission.id].sicht(v.mission.d, pid);
    delete v.seed;
    return v;
  }

  // Gesamtstand nach Energie
  function stand(S) {
    return S.reihenfolge.filter(p => S.spieler[p]).sort((a, b) => S.spieler[b].energie - S.spieler[a].energie);
  }

  W.RM = { MAX, FARBEN, ENERGIE, ZEIT, MISSIONEN, zufall, neu, aktion, takt, sicht, stand, passend, anwesend, istBot, istDa, missionNeustart, kopie };
})();
