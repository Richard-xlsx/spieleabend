// Viererkette: Spielregeln ohne Netzwerk und ohne Oberfläche.
// Zu zweit 7×6, zu dritt 9×7. Steine fallen in die Spalte, wer zuerst vier in einer Reihe hat, gewinnt die Runde.
(function () {
  const FELD = { 2: { breite: 7, hoehe: 6 }, 3: { breite: 9, hoehe: 7 } };
  const MAX = 3, STEINE = 5;              // fünf Steine (Farbe + Muster) zur Wahl
  const kopie = o => JSON.parse(JSON.stringify(o));

  function neu(code, hostPid, hostName) {
    return {
      v: 1, spiel: "viererkette", code, epoch: 0, host: hostPid, phase: "lobby", spielNr: 0, runde: 0,
      spieler: { [hostPid]: { name: hostName, siege: 0 } }, reihenfolge: [hostPid], teilnehmer: [], online: [hostPid],
      stein: { [hostPid]: 0 }, feld: [], breite: 7, hoehe: 6, dran: 0, beginner: 0, letzter: null, linie: null, sieger: null, zuege: 0, aenderung: Date.now()
    };
  }

  const zelle = (S, x, y) => S.feld[y * S.breite + x];          // y = 0 ist die unterste Reihe
  // Findet eine Reihe von mindestens vier gleichen Steinen durch (x, y); gibt die Felder zurück oder null
  function linieDurch(S, x, y) {
    const w = zelle(S, x, y); if (w === null || w === undefined) return null;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const l = [[x, y]];
      for (const s of [1, -1]) {
        let i = x + s * dx, j = y + s * dy;
        while (i >= 0 && i < S.breite && j >= 0 && j < S.hoehe && zelle(S, i, j) === w) { l.push([i, j]); i += s * dx; j += s * dy; }
      }
      if (l.length >= 4) return l.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    }
    return null;
  }
  const spalteFrei = (S, x) => x >= 0 && x < S.breite && zelle(S, x, S.hoehe - 1) === null;
  function rundeStarten(S) {
    const f = FELD[S.teilnehmer.length] || FELD[2];
    S.breite = f.breite; S.hoehe = f.hoehe;
    S.feld = Array(S.breite * S.hoehe).fill(null);
    S.phase = "spiel"; S.runde += 1; S.spielNr += 1;
    S.beginner = (S.runde - 1) % S.teilnehmer.length; S.dran = S.beginner;
    S.letzter = null; S.linie = null; S.sieger = null; S.zuege = 0;
  }

  // Steine, die pid nehmen darf: alle, die kein anderer anwesender Mitspieler hat
  function freieSteine(S, pid) {
    const belegt = new Set(Object.keys(S.stein || {}).filter(p => p !== pid && S.spieler[p] && (!S.online || S.online.includes(p) || (S.teilnehmer || []).includes(p))).map(p => S.stein[p]));
    return [...Array(STEINE).keys()].filter(i => !belegt.has(i));
  }
  function aktion(S0, pid, m) {
    const S = kopie(S0), istHost = pid === S.host;
    const nein = t => ({ ok: false, fehler: t });
    switch (m.t) {
      case "hallo": case "join": {
        const nm = String(m.name || "").trim().slice(0, 20) || "Gast";
        if (!S.spieler[pid]) { S.spieler[pid] = { name: nm, siege: 0 }; S.reihenfolge.push(pid); } else S.spieler[pid].name = nm;
        if (!S.stein) S.stein = {};
        if (S.stein[pid] === undefined) { const frei = freieSteine(S, pid); if (frei.length) S.stein[pid] = frei[0]; }
        break;
      }
      case "stein": {                      // eigenen Stein wählen (nicht während einer Runde)
        const n = m.n | 0;
        if (S.phase === "spiel") return nein("Erst nach der Runde.");
        if (n < 0 || n >= STEINE) return nein("Unbekannter Stein.");
        if (!freieSteine(S, pid).includes(n)) return nein("Diesen Stein hat schon jemand.");
        S.stein[pid] = n;
        break;
      }
      case "start": {                      // Spielleiter: neue Partie mit den Anwesenden (Siege auf null)
        if (!istHost || S.phase === "spiel") return nein("Nur der Spielleiter kann starten.");
        const t = (m.teilnehmer || S.reihenfolge).filter(p => S.spieler[p]).slice(0, MAX);
        if (t.length < 2) return nein("Es braucht mindestens 2 Spieler.");
        S.teilnehmer = t; S.runde = 0;
        // doppelte oder fehlende Steine auflösen: wer zuerst im Raum war, behält seinen
        if (!S.stein) S.stein = {};
        const vergeben = new Set();
        for (const p of t) { if (S.stein[p] === undefined || vergeben.has(S.stein[p])) S.stein[p] = [...Array(STEINE).keys()].find(n => !vergeben.has(n) && !t.some(q => q !== p && S.stein[q] === n)) ?? [...Array(STEINE).keys()].find(n => !vergeben.has(n)); vergeben.add(S.stein[p]); }
        for (const p of t) S.spieler[p].siege = 0;
        rundeStarten(S);
        break;
      }
      case "weiter": {                     // Spielleiter: nächste Runde, gleiche Besetzung
        if (!istHost || S.phase !== "ende") return nein("Gerade nicht möglich.");
        rundeStarten(S);
        break;
      }
      case "lobby": {
        if (!istHost) return nein("Nur der Spielleiter.");
        S.phase = "lobby";
        break;
      }
      case "setzen": {
        if (S.phase !== "spiel" || m.nr !== S.spielNr) return nein("Gerade nicht möglich.");
        if (S.teilnehmer[S.dran] !== pid) return nein("Du bist nicht dran.");
        const x = m.spalte | 0;
        if (!spalteFrei(S, x)) return nein("Diese Spalte ist voll.");
        let y = 0; while (zelle(S, x, y) !== null) y++;
        S.feld[y * S.breite + x] = S.dran;   // Index in S.teilnehmer; der Stein dazu steht in S.stein
        S.letzter = { x, y, wer: S.dran }; S.zuege += 1;
        const l = linieDurch(S, x, y);
        if (l) { S.linie = l; S.sieger = pid; S.spieler[pid].siege += 1; S.phase = "ende"; }
        else if (S.feld.every(v => v !== null)) { S.sieger = null; S.phase = "ende"; }
        else S.dran = (S.dran + 1) % S.teilnehmer.length;
        break;
      }
      case "auslassen": {                  // Spielleiter: wer nicht verbunden ist, wird übersprungen
        if (!istHost || S.phase !== "spiel" || S.teilnehmer[S.dran] !== m.ziel) return nein("Gerade nicht möglich.");
        S.dran = (S.dran + 1) % S.teilnehmer.length;
        break;
      }
      default: return nein("Unbekannt.");
    }
    S.aenderung = Date.now();
    return { ok: true, S };
  }

  window.VK = { neu, aktion, linieDurch, spalteFrei, freieSteine, FELD, MAX, STEINE };
})();
