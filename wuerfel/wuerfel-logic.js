// Würfelpoker: Spielregeln ohne Netzwerk und ohne Oberfläche.
// Fünf Würfel, bis zu drei Würfe pro Zug, dazwischen beliebige Würfel festhalten. Danach muss genau ein Feld
// auf dem eigenen Zettel belegt werden (notfalls mit 0). Nach 13 Runden ist der Zettel voll, die höchste Summe gewinnt.
(function () {
  const MAX = 8;
  const KATEGORIEN = [
    { k: "e1", name: "Einser", oben: true, info: "alle Einsen zählen" },
    { k: "e2", name: "Zweier", oben: true, info: "alle Zweien zählen" },
    { k: "e3", name: "Dreier", oben: true, info: "alle Dreien zählen" },
    { k: "e4", name: "Vierer", oben: true, info: "alle Vieren zählen" },
    { k: "e5", name: "Fünfer", oben: true, info: "alle Fünfen zählen" },
    { k: "e6", name: "Sechser", oben: true, info: "alle Sechsen zählen" },
    { k: "dp", name: "Dreierpasch", info: "3 gleiche: Summe aller Würfel" },
    { k: "vp", name: "Viererpasch", info: "4 gleiche: Summe aller Würfel" },
    { k: "fh", name: "Full House", info: "3 gleiche + 2 gleiche: 25" },
    { k: "ks", name: "Kleine Straße", info: "4 in Folge: 30" },
    { k: "gs", name: "Große Straße", info: "5 in Folge: 40" },
    { k: "fg", name: "Fünf gleiche", info: "alle 5 gleich: 50" },
    { k: "ch", name: "Chance", info: "Summe aller Würfel" },
  ];
  const BONUS_AB = 63, BONUS = 35;
  const kopie = o => JSON.parse(JSON.stringify(o));
  const summe = w => w.reduce((a, b) => a + b, 0);

  function punkte(k, w) {
    if (!w || w.length !== 5 || w.some(x => !x)) return 0;
    const anz = [0, 0, 0, 0, 0, 0, 0]; w.forEach(x => anz[x]++);
    const max = Math.max(...anz), s = summe(w), hat = n => anz[n] > 0;
    switch (k) {
      case "e1": case "e2": case "e3": case "e4": case "e5": case "e6": { const n = +k[1]; return anz[n] * n; }
      case "dp": return max >= 3 ? s : 0;
      case "vp": return max >= 4 ? s : 0;
      case "fh": return (anz.includes(3) && anz.includes(2)) || max === 5 ? 25 : 0;
      case "ks": return [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]].some(r => r.every(hat)) ? 30 : 0;
      case "gs": return [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]].some(r => r.every(hat)) ? 40 : 0;
      case "fg": return max === 5 ? 50 : 0;
      case "ch": return s;
    }
    return 0;
  }
  function wertung(z) {
    z = z || {};
    const oben = KATEGORIEN.filter(c => c.oben).reduce((a, c) => a + (z[c.k] || 0), 0);
    const bonus = oben >= BONUS_AB ? BONUS : 0;
    const unten = KATEGORIEN.filter(c => !c.oben).reduce((a, c) => a + (z[c.k] || 0), 0);
    return { oben, bonus, unten, gesamt: oben + bonus + unten };
  }
  const voll = z => KATEGORIEN.every(c => z && z[c.k] !== undefined);

  function neu(code, hostPid, hostName) {
    return {
      v: 1, spiel: "wuerfel", code, epoch: 0, host: hostPid, phase: "lobby", spielNr: 0,
      spieler: { [hostPid]: { name: hostName, siege: 0 } }, reihenfolge: [hostPid], teilnehmer: [], online: [hostPid],
      dran: 0, beginner: 0, runde: 0, wuerfel: [0, 0, 0, 0, 0], halten: [false, false, false, false, false], wurf: 0, wurfNr: 0,
      zettel: {}, letzter: null, sieger: [], aenderung: Date.now()
    };
  }
  function zugBeginn(S) { S.wuerfel = [0, 0, 0, 0, 0]; S.halten = [false, false, false, false, false]; S.wurf = 0; }
  function partieStarten(S) {
    S.phase = "spiel"; S.spielNr += 1; S.runde = 1;
    S.beginner = (S.spielNr - 1) % S.teilnehmer.length; S.dran = S.beginner;
    S.zettel = {}; for (const p of S.teilnehmer) S.zettel[p] = {};
    S.letzter = null; S.sieger = []; zugBeginn(S);
  }
  const zufall = () => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); } };

  // Wer am Zug handeln darf: der Spieler selbst, oder der Spielleiter, wenn dieser Spieler nicht verbunden ist
  function darf(S, pid) {
    const dran = S.teilnehmer[S.dran];
    return pid === dran || (pid === S.host && S.online && !S.online.includes(dran));
  }
  function aktion(S0, pid, m) {
    const S = kopie(S0), istHost = pid === S.host;
    const nein = t => ({ ok: false, fehler: t });
    switch (m.t) {
      case "hallo": case "join": {
        const nm = String(m.name || "").trim().slice(0, 20) || "Gast";
        if (!S.spieler[pid]) { S.spieler[pid] = { name: nm, siege: 0 }; S.reihenfolge.push(pid); } else S.spieler[pid].name = nm;
        break;
      }
      case "start": {
        if (!istHost || S.phase === "spiel") return nein("Nur der Spielleiter kann starten.");
        const t = (m.teilnehmer || S.reihenfolge).filter(p => S.spieler[p]).slice(0, MAX);
        if (t.length < 1) return nein("Es braucht mindestens einen Spieler.");
        S.teilnehmer = t; for (const p of t) S.spieler[p].siege = S.spieler[p].siege || 0;
        partieStarten(S);
        break;
      }
      case "wuerfeln": {
        if (S.phase !== "spiel" || !darf(S, pid)) return nein("Du bist nicht dran.");
        if (S.wurf >= 3) return nein("Drei Würfe sind vorbei: jetzt ein Feld wählen.");
        if (m.nr !== undefined && m.nr !== S.wurfNr) return nein("");
        const h = S.wurf === 0 ? [false, false, false, false, false] : (Array.isArray(m.halten) ? m.halten.map(Boolean).slice(0, 5) : S.halten);
        if (S.wurf > 0 && h.every(Boolean)) return nein("Alle Würfel sind festgehalten.");
        S.halten = h;
        S.wuerfel = S.wuerfel.map((w, i) => h[i] ? w : 1 + Math.floor(zufall() * 6));
        S.wurf += 1; S.wurfNr += 1;
        break;
      }
      case "halten": {
        if (S.phase !== "spiel" || !darf(S, pid) || S.wurf === 0 || S.wurf >= 3) return nein("");
        const i = m.i | 0; if (i < 0 || i > 4) return nein("");
        S.halten[i] = !S.halten[i];
        break;
      }
      case "eintragen": {
        if (S.phase !== "spiel" || !darf(S, pid)) return nein("Du bist nicht dran.");
        if (S.wurf === 0) return nein("Erst würfeln.");
        const wer = S.teilnehmer[S.dran], z = S.zettel[wer];
        if (!KATEGORIEN.some(c => c.k === m.k)) return nein("Unbekanntes Feld.");
        if (z[m.k] !== undefined) return nein("Dieses Feld ist schon belegt.");
        z[m.k] = punkte(m.k, S.wuerfel);
        S.letzter = { pid: wer, k: m.k, p: z[m.k], wuerfel: S.wuerfel.slice() };
        if (S.teilnehmer.every(p => voll(S.zettel[p]))) {
          S.phase = "ende";
          const best = Math.max(...S.teilnehmer.map(p => wertung(S.zettel[p]).gesamt));
          S.sieger = S.teilnehmer.filter(p => wertung(S.zettel[p]).gesamt === best);
          for (const p of S.sieger) S.spieler[p].siege = (S.spieler[p].siege || 0) + 1;
        } else {
          S.dran = (S.dran + 1) % S.teilnehmer.length;
          if (S.dran === S.beginner) S.runde += 1;
          zugBeginn(S);
        }
        break;
      }
      case "weiter": {                     // Spielleiter: neue Partie, gleiche Besetzung
        if (!istHost || S.phase !== "ende") return nein("Gerade nicht möglich.");
        partieStarten(S);
        break;
      }
      case "lobby": {
        if (!istHost) return nein("Nur der Spielleiter.");
        S.phase = "lobby";
        break;
      }
      case "raus": {                       // Spielleiter: jemanden aus der laufenden Partie nehmen
        if (!istHost || S.phase !== "spiel") return nein("");
        const i = S.teilnehmer.indexOf(m.ziel); if (i < 0 || S.teilnehmer.length < 2) return nein("");
        const dranPid = S.teilnehmer[S.dran];
        S.teilnehmer.splice(i, 1); delete S.zettel[m.ziel];
        if (dranPid === m.ziel) { S.dran = i % S.teilnehmer.length; zugBeginn(S); }
        else S.dran = S.teilnehmer.indexOf(dranPid);
        S.beginner = Math.min(S.beginner, S.teilnehmer.length - 1);
        if (S.teilnehmer.every(p => voll(S.zettel[p]))) S.phase = "ende";
        break;
      }
      default: return nein("Unbekannte Aktion.");
    }
    S.aenderung = Date.now();
    return { ok: true, S };
  }
  window.WP = { MAX, KATEGORIEN, BONUS_AB, BONUS, punkte, wertung, voll, neu, aktion, darf };
})();
