// Mau-Mau: Spielregeln ohne Netzwerk und ohne Oberfläche.
// S = öffentlicher Zustand (geht an alle), H = geheimer Zustand (nur beim Spielleiter): Handkarten, Ziehstapel, Ablage.
// Karte als Text "farbe:wert:nr", z. B. "herz:7:0" (nr unterscheidet die Karten bei zwei Blättern).
(function () {
  const FARBEN = ["kreuz", "pik", "herz", "karo"];
  const WERTE = ["7", "8", "9", "10", "B", "D", "K", "A"];
  const PUNKTE = { A: 11, K: 10, D: 10, B: 10, "10": 10, "9": 9, "8": 8, "7": 7 };
  const SPECIAL = ["7", "8", "B", "A"];
  const kopie = x => JSON.parse(JSON.stringify(x));
  const teile = k => { const [f, w] = k.split(":"); return { f, w }; };

  function neu(code, hostPid, hostName, einst) {
    einst = einst || {};
    return {
      v: 1, spiel: "maumau", code, epoch: 0, host: hostPid, phase: "lobby", spielNr: 0,
      runden: [3, 5, 8].includes(einst.runden) ? einst.runden : 5, runde: 0, regeln: { ass: true },
      spieler: { [hostPid]: { name: hostName, punkte: 0 } }, reihenfolge: [hostPid], teilnehmer: [],
      dran: null, oben: null, wunsch: null, zieh: 0, gezogen: false, anzahl: {}, stapelAnzahl: 0,
      mau: {}, offenMau: {}, meldung: "", ergebnis: null, aenderung: Date.now()
    };
  }
  function leerH() { return { hand: {}, stapel: [], ablage: [] }; }

  function mischen(a, rnd) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function blatt(anzahlBlaetter) { const k = []; for (let n = 0; n < anzahlBlaetter; n++) for (const f of FARBEN) for (const w of WERTE) k.push(f + ":" + w + ":" + n); return k; }

  function erlaubt(S, karte) {
    const { f, w } = teile(karte), o = teile(S.oben);
    if (S.zieh > 0) return w === "7";
    if (w === "B") return o.w !== "B";
    if (S.wunsch) return f === S.wunsch;
    return f === o.f || w === o.w;
  }
  function name(S, p) { return (S.spieler[p] || {}).name || "?"; }
  function zaehlen(S, H) {
    S.anzahl = {}; for (const p of S.teilnehmer) S.anzahl[p] = (H.hand[p] || []).length;
    S.stapelAnzahl = H.stapel.length;
  }
  function ziehen(S, H, p, n, rnd) {
    let gezogen = 0;
    for (let i = 0; i < n; i++) {
      if (!H.stapel.length) {
        const oben = H.ablage.pop();
        H.stapel = mischen(H.ablage, rnd); H.ablage = oben ? [oben] : [];
        if (!H.stapel.length) break;
      }
      H.hand[p].push(H.stapel.pop()); gezogen++;
    }
    if (H.hand[p].length > 1) { delete S.mau[p]; delete S.offenMau[p]; }
    return gezogen;
  }
  function weiterGeben(S, schritte) {
    const n = S.teilnehmer.length, i = S.teilnehmer.indexOf(S.dran);
    S.dran = S.teilnehmer[(i + (schritte || 1)) % n];
    S.gezogen = false;
  }
  function rundeStarten(S, H, rnd) {
    const t = S.teilnehmer, blaetter = t.length > 5 ? 2 : 1;
    H.stapel = mischen(blatt(blaetter), rnd); H.ablage = []; H.hand = {};
    for (const p of t) H.hand[p] = [];
    for (let r = 0; r < 5; r++) for (const p of t) H.hand[p].push(H.stapel.pop());
    // erste offene Karte: keine Sonderkarte
    let versuche = 0;
    while (SPECIAL.includes(teile(H.stapel[H.stapel.length - 1]).w) && versuche++ < 60) H.stapel.unshift(H.stapel.pop());
    H.ablage.push(H.stapel.pop());
    Object.assign(S, { phase: "spiel", oben: H.ablage[0], wunsch: null, zieh: 0, gezogen: false, mau: {}, offenMau: {}, ergebnis: null });
    S.dran = t[(S.runde - 1) % t.length];          // Rundenbeginn wandert reihum
    S.meldung = name(S, S.dran) + " fängt an.";
  }
  function rundeEnde(S, H, gewinner) {
    const minus = {}, haende = {};
    for (const p of S.teilnehmer) {
      haende[p] = H.hand[p].slice();
      minus[p] = H.hand[p].reduce((a, k) => a + PUNKTE[teile(k).w], 0);
      if (S.spieler[p]) S.spieler[p].punkte += minus[p];
    }
    S.ergebnis = { runde: S.runde, gewinner, minus, haende };
    S.phase = S.runde >= S.runden ? "ende" : "rundenende";
    S.meldung = "Mau-Mau! " + name(S, gewinner) + " ist fertig.";
  }

  // Aktion anwenden. rnd: Zufallsfunktion (für Tests ersetzbar). Gibt {S, H, ok, fehler} zurück.
  function aktion(S0, H0, pid, m, rnd) {
    rnd = rnd || Math.random;
    const S = kopie(S0), H = kopie(H0), nein = f => ({ S: S0, H: H0, ok: false, fehler: f });
    const istHost = pid === S.host, istDran = pid === S.dran && S.phase === "spiel";
    switch (m.t) {
      case "hallo": case "join": {
        const nm = String(m.name || "").trim().slice(0, 20) || "Gast";
        if (!S.spieler[pid]) { S.spieler[pid] = { name: nm, punkte: 0 }; S.reihenfolge.push(pid); } else S.spieler[pid].name = nm;
        break;
      }
      case "einstellungen":
        if (!istHost || S.phase !== "lobby") return nein("nur in der Lobby");
        if ([3, 5, 8].includes(m.runden)) S.runden = m.runden;
        if (typeof m.ass === "boolean") S.regeln.ass = m.ass;
        break;
      case "start": {
        if (!istHost) return nein("nur Spielleiter");
        if (S.phase === "lobby" || S.phase === "ende") {
          const t = (m.teilnehmer || S.reihenfolge).filter(p => S.spieler[p]).slice(0, 8);
          if (t.length < 2) return nein("mindestens 2 Spieler");
          if (S.phase === "ende") for (const p in S.spieler) S.spieler[p].punkte = 0;
          S.teilnehmer = t; S.runde = 0; S.spielNr += 1;
        } else if (S.phase !== "rundenende") return nein("Runde läuft");
        S.runde += 1;
        rundeStarten(S, H, rnd);
        break;
      }
      case "neustartRunde":                      // nach Übernahme der Spielleitung: Karten neu geben, Punkte bleiben
        if (!istHost || S.phase !== "spiel") return nein("geht gerade nicht");
        rundeStarten(S, H, rnd); S.meldung = "Neue Spielleitung: Die Runde wurde neu gegeben.";
        break;
      case "legen": {
        if (!istDran) return nein("nicht dran");
        const hand = H.hand[pid] || [], i = hand.indexOf(m.karte);
        if (i < 0) return nein("Karte nicht auf der Hand");
        if (!erlaubt(S, m.karte)) return nein("Karte passt nicht");
        const { w } = teile(m.karte);
        if (w === "B" && !FARBEN.includes(m.wunsch)) return nein("Farbe wünschen");
        hand.splice(i, 1); H.ablage.push(m.karte); S.oben = m.karte;
        S.wunsch = w === "B" ? m.wunsch : null;
        if (w === "7") S.zieh += 2;
        if (!hand.length) { zaehlen(S, H); rundeEnde(S, H, pid); break; }
        if (hand.length === 1 && !S.mau[pid]) S.offenMau[pid] = true;
        if (hand.length > 2) delete S.mau[pid];
        let txt = name(S, pid) + " legt " + (w === "B" ? "einen Buben und wünscht sich " + m.wunsch : m.karte.split(":").slice(0, 2).join(" "));
        if (w === "8") { weiterGeben(S, 2); txt += ". " + name(S, S.teilnehmer[(S.teilnehmer.indexOf(S.dran) - 1 + S.teilnehmer.length) % S.teilnehmer.length]) + " setzt aus"; }
        else if (w === "A" && S.regeln.ass) { S.gezogen = false; txt += " und ist nochmal dran"; }
        else weiterGeben(S, 1);
        if (S.zieh > 0) txt += ". " + name(S, S.dran) + " muss " + S.zieh + " ziehen oder eine 7 legen";
        S.meldung = txt + ".";
        break;
      }
      case "ziehen": {
        if (!istDran) return nein("nicht dran");
        if (S.zieh > 0) {
          const n = ziehen(S, H, pid, S.zieh, rnd);
          S.meldung = name(S, pid) + " zieht " + n + " Karten."; S.zieh = 0; weiterGeben(S, 1);
        } else {
          if (S.gezogen) return nein("schon gezogen");
          ziehen(S, H, pid, 1, rnd); S.gezogen = true; S.meldung = name(S, pid) + " zieht eine Karte.";
        }
        break;
      }
      case "weiter":
        if (!istDran || !S.gezogen) return nein("erst ziehen");
        S.meldung = name(S, pid) + " setzt aus."; weiterGeben(S, 1);
        break;
      case "mau":
        if (S.phase !== "spiel" || !S.teilnehmer.includes(pid) || (H.hand[pid] || []).length > 2) return nein("zu viele Karten");
        S.mau[pid] = true; delete S.offenMau[pid];
        S.meldung = name(S, pid) + " sagt Mau!";
        break;
      case "erwischt": {
        if (S.phase !== "spiel" || !S.offenMau[m.ziel] || m.ziel === pid || !S.teilnehmer.includes(pid)) return nein("nichts zu erwischen");
        delete S.offenMau[m.ziel];
        const n = ziehen(S, H, m.ziel, 2, rnd);
        S.meldung = name(S, pid) + " hat " + name(S, m.ziel) + " erwischt: " + n + " Strafkarten.";
        break;
      }
      case "auslassen": {                       // Spielleiter überspringt jemanden, der nicht mehr da ist
        if (!istHost || S.phase !== "spiel" || m.ziel !== S.dran) return nein("geht nicht");
        const n = ziehen(S, H, S.dran, S.zieh > 0 ? S.zieh : 1, rnd);
        S.meldung = name(S, S.dran) + " ist nicht da und zieht " + n + "."; S.zieh = 0; weiterGeben(S, 1);
        break;
      }
      case "neustart":
        if (!istHost) return nein("nur Spielleiter");
        for (const p in S.spieler) S.spieler[p].punkte = 0;
        Object.assign(S, { phase: "lobby", runde: 0, teilnehmer: [], dran: null, oben: null, wunsch: null, zieh: 0, mau: {}, offenMau: {}, ergebnis: null, meldung: "" });
        S.spielNr += 1; Object.assign(H, leerH());
        break;
      default: return nein("unbekannt");
    }
    if (S.phase === "spiel" || S.phase === "rundenende" || S.phase === "ende") zaehlen(S, H);
    S.aenderung = Date.now();
    return { S, H, ok: true };
  }

  window.MM = { FARBEN, WERTE, PUNKTE, teile, erlaubt, neu, leerH, aktion, blatt };
})();
