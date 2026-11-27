// Sperrgut: Ablauf beim Spielleiter, ohne Netz und ohne Physik (mit node testbar).
// Lobby → Umzugstag aus mehreren Aufträgen → Ergebnis je Auftrag → Siegerehrung.
// Jedes Handy rechnet seinen Turm selbst und meldet seinen Stand („stand“). Der Spielleiter entscheidet Reihenfolge,
// Punkte, zieht die Karten (je nach Platz) und verteilt Gemeinheiten mit Startzeit.
//   SG.neu(code, pid, name) → S;  SG.aktion(S, pid, m, jetzt) → { ok, fehler };  SG.takt(S, jetzt) → geändert?
(function () {
  const PUNKTE = { 1: [10], 2: [10, 3], 3: [10, 6, 2], 4: [10, 7, 4, 2], 5: [10, 7, 5, 3, 1], 6: [10, 7, 5, 3, 2, 1], 7: [10, 7, 5, 4, 3, 2, 1], 8: [10, 7, 5, 4, 3, 2, 1, 1] };
  const LAENGEN = { kurz: { n: 3, name: "Kurz", fenster: 12 }, normal: { n: 5, name: "Normal", fenster: 16 }, lang: { n: 7, name: "Lang", fenster: 20 } };
  const ARTEN = {
    hoch: { name: "Hoch hinaus", kurz: "Stapel bis zum offenen Fenster der neuen Wohnung. Wer zuerst oben ist und 3 Sekunden stehen bleibt, gewinnt." },
    kaputt: { name: "Bloß nichts kaputt", kurz: "30 Teile für alle. Jedes Teil, das herunterfällt, ist ein Bruch. Nach drei Bruch bist du raus." },
    wagen: { name: "Wagen beladen", kurz: "Pack so viele Teile wie möglich unter das Dach des Umzugswagens. Hinten ist die Klappe offen!" },
    wg: { name: "WG-Umzug", kurz: "Alle bauen reihum an einem Turm. Wer ihn zum Einstürzen bringt, ist raus und zahlt die Pizza." }
  };
  const ZEIT = { vorlauf: 4500, hoch: 180000, nach: 20000, kaputt: 240000, wagen: 120000, ergebnis: 14000, halten: 3000, wgZug: 12000, wgNach: 3000, schutz: 5000, flug: 1000 };
  const TEILE_KAPUTT = 30, LEBEN = 3, KARTEN_MAX = 2;
  const KARTEN = {
    klavier: { name: "Klavier", gemein: true, stufe: 3, text: "Der Nachbar gibt sein Klavier mit: Das nächste Teil ist ein Klavier." },
    katze: { name: "Katze", gemein: true, stufe: 3, text: "Eine Katze springt auf den Turm und läuft hin und her." },
    regen: { name: "Platzregen", gemein: true, stufe: 2, text: "Die nächsten 3 Teile sind nass und rutschig." },
    ball: { name: "Gymnastikball", gemein: true, stufe: 2, text: "Das nächste Teil ist ein großer Ball, der rollt." },
    laken: { name: "Bettlaken", gemein: true, stufe: 1, text: "Ein Laken weht 8 Sekunden vor die Turmspitze." },
    schwager: { name: "Ansage vom Schwager", gemein: true, stufe: 1, text: "Er ruft „links!“ und meint rechts: 8 Sekunden vertauscht." },
    festhalten: { name: "Festhalten", gemein: false, stufe: 3, text: "Die Helfer halten den Turm 10 Sekunden lang starr." },
    wunsch: { name: "Wunschteil", gemein: false, stufe: 3, text: "Ein Helfer bringt eins von drei Teilen zur Wahl." },
    gurt: { name: "Spanngurt", gemein: false, stufe: 2, text: "Die obersten 4 Teile halten fest zusammen." },
    kisten: { name: "Kleine Kisten", gemein: false, stufe: 1, text: "Die nächsten 2 Teile sind kleine Kisten zum Lückenfüllen." },
    atmen: { name: "Tief durchatmen", gemein: false, stufe: 1, text: "Die nächsten 3 Teile fallen halb so schnell." }
  };
  const BOTNAMEN = ["Kalle", "Jule", "Ronny", "Bärbel", "Heinz", "Mandy", "Uwe"];

  function zufall(S) { S.rz = (Math.imul(S.rz ^ (S.rz >>> 15), 2246822507) + 0x9E3779B9) >>> 0; return ((S.rz ^ (S.rz >>> 13)) >>> 0) / 4294967296; }

  function neu(code, pid, name) {
    const S = { code, epoch: 0, host: pid, phase: "lobby", spieler: {}, reihe: [], einst: { laenge: "normal", arten: { hoch: true, kaputt: true, wagen: true, wg: true } }, tag: null, a: null, rz: (Math.random() * 2 ** 31) | 0, online: [] };
    dazu(S, pid, name || "Spielleitung");
    return S;
  }
  function freieFarbe(S) { const belegt = new Set(Object.values(S.spieler).map(s => s.farbe)); for (let i = 0; i < 8; i++) if (!belegt.has(i)) return i; return Object.keys(S.spieler).length % 8; }
  function dazu(S, pid, name, bot) {
    if (S.spieler[pid]) { if (name) S.spieler[pid].name = name; return; }
    const imSpiel = S.phase !== "lobby";
    const schnitt = imSpiel ? Math.round(menschen(S, true).reduce((s, p) => s + S.spieler[p].punkte, 0) / Math.max(1, S.reihe.length)) : 0;
    S.spieler[pid] = { name: String(name || "?").slice(0, 20), farbe: freieFarbe(S), bot: !!bot, punkte: schnitt, stat: neueStat() };
    S.reihe.push(pid);
  }
  const neueStat = () => ({ bruch: 0, hoch: 0, getroffen: 0, geschickt: 0 });
  const istBot = (S, p) => !!(S.spieler[p] && S.spieler[p].bot);
  const da = (S, p) => istBot(S, p) || (S.online || []).includes(p);
  function menschen(S, alle) { return S.reihe.filter(p => S.spieler[p] && (alle || da(S, p))); }

  // ---------- Umzugstag ----------
  function plan(S) {
    const an = ["hoch", "kaputt", "wagen", "wg"].filter(k => S.einst.arten[k]);
    const arten = an.length ? an : ["hoch"];
    const n = LAENGEN[S.einst.laenge].n, out = [];
    for (let i = 0; i < n; i++) out.push(arten[i % arten.length]);
    if (n >= 3 && arten.includes("hoch")) out[n - 1] = "hoch";       // das Finale ist immer ein Wettrennen
    return out;
  }
  function tagStarten(S, jetzt) {
    for (const p of S.reihe) { S.spieler[p].punkte = 0; S.spieler[p].stat = neueStat(); }
    S.tag = { plan: plan(S), nr: -1, ergebnisse: [] };
    auftragStarten(S, jetzt);
  }
  function auftragStarten(S, jetzt, modusFest) {
    const T = S.tag; T.nr++;
    const modus = modusFest || T.plan[T.nr];
    const tn = S.reihe.filter(p => da(S, p));
    const start = jetzt + ZEIT.vorlauf;
    const dauer = modus === "hoch" ? ZEIT.hoch : modus === "kaputt" ? ZEIT.kaputt : modus === "wagen" ? ZEIT.wagen : 30 * 60000;
    const st = {};
    for (const p of tn) st[p] = { h: 0, b: 0, g: 0, w: 0, z: 0, l: LEBEN, fertig: null, raus: false, snapT: 0 };
    S.phase = "auftrag";
    S.a = { nr: T.nr, modus, seed: (zufall(S) * 2 ** 31) | 0, start, ende: start + dauer, fenster: LAENGEN[S.einst.laenge].fenster, dach: 10,
      tn, st, karten: {}, ev: [], evn: 0, schutz: {}, erster: null, tag: T.plan.length > 1 ? T.nr / (T.plan.length - 1) : 0 };
    for (const p of tn) S.a.karten[p] = [];
    if (modus === "wg") {
      const reihe = tn.slice();
      for (let i = reihe.length - 1; i > 0; i--) { const j = Math.floor(zufall(S) * (i + 1)); [reihe[i], reihe[j]] = [reihe[j], reihe[i]]; }
      S.a.wg = { reihe, raus: [], dran: reihe[0], zugBis: start + ZEIT.wgZug, zug: 0, schritt: "zielen", nachBis: 0 };
    }
  }
  // Wer liegt gerade vorn? Liefert die Teilnehmer sortiert, mit Platz (Gleichstand = gleicher Platz)
  function wert(S, p) {
    const a = S.a, s = a.st[p];
    if (a.modus === "hoch") return [s.fertig != null ? 1 : 0, s.fertig != null ? -s.fertig : s.h];
    if (a.modus === "kaputt") return [s.l, s.g - s.b, s.h];
    if (a.modus === "wagen") return [s.w, -s.b];
    if (a.modus === "wg") { const i = a.wg.raus.indexOf(p); return [i < 0 ? 999 : i]; }
    return [0];
  }
  function vergleich(x, y) { for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (y[i] || 0) - (x[i] || 0); if (Math.abs(d) > 1e-9) return d; } return 0; }
  function rangliste(S) {
    const a = S.a, l = a.tn.map(p => ({ pid: p, w: wert(S, p) })).sort((x, y) => vergleich(x.w, y.w));
    let platz = 0;
    l.forEach((e, i) => { if (i === 0 || vergleich(l[i - 1].w, e.w) !== 0) platz = i + 1; e.platz = platz; });
    return l;
  }
  function auswerten(S, jetzt) {
    const a = S.a, l = rangliste(S), n = l.length, tab = PUNKTE[Math.min(8, Math.max(1, n))];
    const liste = l.map(e => {
      const s = a.st[e.pid], bonus = a.modus === "wg" ? 0 : Math.min(3, s.z || 0);
      const punkte = (tab[e.platz - 1] || 0) + bonus;
      const sp = S.spieler[e.pid];
      if (sp) { sp.punkte += punkte; sp.stat.bruch += s.b; sp.stat.hoch = Math.max(sp.stat.hoch, s.h); }
      return { pid: e.pid, platz: e.platz, punkte, bonus, h: s.h, b: s.b, g: s.g, w: s.w, l: s.l, fertig: s.fertig != null ? s.fertig - a.start : null };
    });
    const erg = { nr: a.nr, modus: a.modus, liste };
    S.tag.ergebnisse.push(erg);
    S.phase = "ergebnis"; S.erg = erg; S.weiterAb = jetzt + ZEIT.ergebnis;
    S.a = null;
  }
  function weiter(S, jetzt) {
    if (S.tag && S.tag.nr + 1 < S.tag.plan.length) auftragStarten(S, jetzt);
    else { S.phase = "ende"; S.ehrung = ehrung(S); }
  }
  function ehrung(S) {
    const tn = S.reihe.filter(p => S.spieler[p] && S.tag.ergebnisse.some(e => e.liste.some(x => x.pid === p)));
    const stand = tn.map(p => ({ pid: p, punkte: S.spieler[p].punkte })).sort((x, y) => y.punkte - x.punkte);
    let platz = 0; stand.forEach((e, i) => { if (i === 0 || stand[i - 1].punkte !== e.punkte) platz = i + 1; e.platz = platz; });
    const titel = [];
    const bester = (name, text, f, min, kleinste) => {
      const w = tn.map(p => ({ p, v: f(S.spieler[p].stat) }));
      if (!w.length) return;
      const ziel = kleinste ? Math.min(...w.map(x => x.v)) : Math.max(...w.map(x => x.v));
      if (!kleinste && ziel < (min || 1)) return;
      const wer = w.filter(x => x.v === ziel).map(x => x.p);
      if (kleinste && wer.length === tn.length) return;
      titel.push({ name, text, wer });
    };
    bester("Hochstapler", "der höchste Turm des Tages", s => Math.round(s.hoch * 10) / 10, 2);
    bester("Scherbenkönig", "die meisten Bruch", s => s.bruch, 2);
    if (tn.length > 1) bester("Ruhige Hand", "die wenigsten Bruch", s => s.bruch, 0, true);
    bester("Klavierträger", "die meisten Gemeinheiten abbekommen", s => s.getroffen, 2);
    bester("Nervensäge", "die meisten Gemeinheiten verschickt", s => s.geschickt, 2);
    return { stand, titel };
  }

  // ---------- Karten ----------
  function karteZiehen(S, p) {
    const a = S.a, l = rangliste(S), n = l.length, e = l.find(x => x.pid === p);
    const r = n > 1 ? (e.platz - 1) / (n - 1) : 0.5;          // 0 = vorn, 1 = hinten
    const stufen = r < 0.34 ? [1, 2] : r > 0.66 ? [2, 3] : [1, 2, 3];
    const gemein = n > 1 && a.modus !== "wg" ? zufall(S) < 0.5 : false;
    const auswahl = Object.keys(KARTEN).filter(k => KARTEN[k].gemein === gemein && stufen.includes(KARTEN[k].stufe));
    return auswahl[Math.floor(zufall(S) * auswahl.length)];
  }
  function ziel(S, von, gewuenscht, jetzt) {
    const a = S.a;
    const frei = p => p !== von && a.st[p] && !a.st[p].raus && a.st[p].fertig == null && !(a.schutz[p] > jetzt);
    if (gewuenscht && frei(gewuenscht)) return gewuenscht;
    const l = rangliste(S).filter(e => frei(e.pid));
    return l.length ? l[0].pid : null;
  }

  // ---------- Aktionen ----------
  function aktion(S, pid, m, jetzt) {
    const ok = { ok: true }, nein = f => ({ ok: false, fehler: f });
    const host = pid === S.host, t = m && m.t;
    if (t === "hallo") { dazu(S, pid, m.name); return ok; }
    if (!S.spieler[pid]) return nein("Unbekannt");
    const sp = S.spieler[pid];
    if (t === "name") { sp.name = String(m.name || sp.name).slice(0, 20); return ok; }
    if (t === "farbe") {
      const f = +m.farbe;
      if (!(f >= 0 && f < 8)) return nein();
      if (Object.entries(S.spieler).some(([q, s]) => q !== pid && s.farbe === f)) return nein("Die Farbe hat schon jemand.");
      sp.farbe = f; return ok;
    }
    if (t === "bot" && host) {
      if (m.dazu) {
        if (S.reihe.length >= 8) return nein("Höchstens 8 Spieler.");
        const nr = S.reihe.filter(p => istBot(S, p)).length, id = "bot" + Math.random().toString(36).slice(2, 7);
        dazu(S, id, BOTNAMEN[nr % BOTNAMEN.length], true); return ok;
      }
      const b = S.reihe.filter(p => istBot(S, p)).pop();
      if (b && S.phase === "lobby") { delete S.spieler[b]; S.reihe = S.reihe.filter(p => p !== b); }
      return ok;
    }
    if (t === "einst" && host && S.phase === "lobby") {
      if (m.laenge && LAENGEN[m.laenge]) S.einst.laenge = m.laenge;
      if (m.art && ARTEN[m.art]) S.einst.arten[m.art] = !S.einst.arten[m.art];
      return ok;
    }
    if (t === "start" && host && S.phase === "lobby") { tagStarten(S, jetzt); return ok; }
    if (t === "einzeln" && host && S.phase === "lobby" && ARTEN[m.modus]) {
      // nur ein Auftrag (zum Üben)
      for (const p of S.reihe) { S.spieler[p].punkte = 0; S.spieler[p].stat = neueStat(); }
      S.tag = { plan: [m.modus], nr: -1, ergebnisse: [] }; auftragStarten(S, jetzt); return ok;
    }
    if (t === "weiter" && host && S.phase === "ergebnis") { weiter(S, jetzt); return ok; }
    if (t === "lobby" && host && (S.phase === "ende" || S.phase === "ergebnis" || S.phase === "auftrag")) { S.phase = "lobby"; S.a = null; S.tag = null; S.erg = null; return ok; }

    const a = S.a;
    if (!a || S.phase !== "auftrag" || !a.st[pid]) return nein();
    const s = a.st[pid];
    if (t === "stand") {
      if (s.raus && a.modus !== "wg") return ok;
      s.h = Math.max(0, +m.h || 0); s.b = Math.max(s.b, m.b | 0); s.g = Math.max(0, m.g | 0); s.w = Math.max(0, m.w | 0); s.z = Math.max(0, m.z | 0);
      if (a.modus === "kaputt") { s.l = Math.max(0, LEBEN - s.b); if (s.l <= 0 && !s.raus) { s.raus = true; s.fertig = null; } if (m.fertig && !s.raus) s.fertigK = true; }
      if (a.modus === "wagen" && m.voll && !s.raus) s.raus = true;   // Wagen voll: fertig
      if (a.modus === "hoch" && m.ziel && s.fertig == null) {
        const zt = Math.min(jetzt, Math.max(a.start, +m.ziel || jetzt));
        s.fertig = zt; if (!a.erster) a.erster = zt;
      }
      return { ok: true, leise: !m.ziel && !m.voll && !(a.modus === "kaputt" && (s.raus || m.fertig)) };
    }
    if (t === "pizza") {
      if (a.karten[pid].length >= KARTEN_MAX) return ok;
      const k = karteZiehen(S, pid);
      if (k) a.karten[pid].push(k);
      return ok;
    }
    if (t === "karte") {
      const i = m.i | 0, k = a.karten[pid][i];
      if (!k) return nein();
      const K = KARTEN[k];
      if (K.gemein) {
        const an = ziel(S, pid, m.ziel, jetzt);
        if (!an) return nein("Gerade kann niemand eine Gemeinheit abbekommen.");
        a.karten[pid].splice(i, 1);
        a.ev.push({ id: ++a.evn, art: k, von: pid, an, ab: jetzt + ZEIT.flug });
        a.schutz[an] = jetzt + ZEIT.flug + ZEIT.schutz;
        sp.stat.geschickt++; if (S.spieler[an]) S.spieler[an].stat.getroffen++;
      } else {
        a.karten[pid].splice(i, 1);
        a.ev.push({ id: ++a.evn, art: k, von: pid, an: pid, ab: jetzt });
      }
      if (a.ev.length > 30) a.ev.splice(0, a.ev.length - 30);
      return ok;
    }
    // WG-Umzug: Meldungen vom gemeinsamen Turm (nur der Spielleiter rechnet ihn)
    if (a.modus === "wg" && host) {
      const g = a.wg;
      if (t === "wgGesetzt" && g.schritt === "zielen") { g.schritt = "wackeln"; g.nachBis = jetzt + ZEIT.wgNach; return ok; }
      if (t === "wgBruch" && g.dran && g.schritt !== "pause") {
        const p = g.dran;
        g.raus.push(p); a.st[p].raus = true; a.st[p].b++;
        g.reihe = g.reihe.filter(x => x !== p);
        g.schritt = "pause"; g.nachBis = jetzt + 2500; g.letzterRaus = p;
        return ok;
      }
    }
    return nein();
  }
  function wgWeiter(S, jetzt) {
    const g = S.a.wg;
    if (g.reihe.length <= 1) return true;     // fertig
    const i = g.schritt === "pause" ? g.zug % g.reihe.length : (g.reihe.indexOf(g.dran) + 1) % g.reihe.length;
    g.zug = i; g.dran = g.reihe[i]; g.schritt = "zielen"; g.zugBis = jetzt + ZEIT.wgZug; g.nachBis = 0;
    return false;
  }

  // Takt beim Spielleiter (alle 200 ms)
  function takt(S, jetzt) {
    if (S.phase === "ergebnis" && jetzt >= S.weiterAb) { weiter(S, jetzt); return true; }
    if (S.phase !== "auftrag" || !S.a) return false;
    const a = S.a;
    if (jetzt < a.start) return false;
    const aktiv = a.tn.filter(p => da(S, p));
    if (a.modus === "wg") {
      const g = a.wg;
      // Wer weg ist, fliegt aus der Reihe
      for (const p of g.reihe.slice()) if (!da(S, p) && g.reihe.length > 1) { g.raus.push(p); a.st[p].raus = true; g.reihe = g.reihe.filter(x => x !== p); if (g.dran === p) { g.schritt = "pause"; g.nachBis = jetzt; } }
      if (g.schritt === "wackeln" && jetzt >= g.nachBis) { if (wgWeiter(S, jetzt)) { auswerten(S, jetzt); } return true; }
      if (g.schritt === "pause" && jetzt >= g.nachBis) { if (g.reihe.length <= 1) auswerten(S, jetzt); else { g.zug = g.zug % g.reihe.length; g.dran = g.reihe[g.zug]; g.schritt = "zielen"; g.zugBis = jetzt + ZEIT.wgZug; } return true; }
      return false;
    }
    const fertig = p => { const s = a.st[p]; return s.raus || s.fertig != null || s.fertigK; };
    if (jetzt >= a.ende || aktiv.every(fertig)) { auswerten(S, jetzt); return true; }
    if (a.modus === "hoch" && a.erster && jetzt >= a.erster + ZEIT.nach) { auswerten(S, jetzt); return true; }
    return false;
  }

  // Spielleitung übernommen: laufender Auftrag beginnt neu, Punkte bleiben
  function neustart(S, jetzt) {
    if (S.phase === "auftrag" && S.tag && S.a) { const modus = S.a.modus; S.tag.nr--; auftragStarten(S, jetzt, modus); }
  }
  const sicht = S => S;
  const SG = { neu, aktion, takt, sicht, neustart, rangliste, istBot, da, PUNKTE, LAENGEN, ARTEN, ZEIT, KARTEN, TEILE_KAPUTT, LEBEN, KARTEN_MAX };
  if (typeof module !== "undefined") module.exports = SG;
  if (typeof window !== "undefined") window.SG = SG;
})();
