// Tapetenwechsel: Ablauf beim Spielleiter, ohne Netz und ohne 3D (mit node testbar).
// Lobby → Hausbesuch aus mehreren Runden (Verstecken → Warten → Suchen → Auflösung) → Siegerehrung mit Ehrentiteln.
// Jedes Handy rechnet sein Versteck und seine Suche selbst. Der Spielleiter entscheidet Phasen (nach abgeglichener Uhr),
// Funde (wer zuerst kommt), Strafen, Niesen, Punkte und Ehrentitel.
//   TW.neu(code, pid, name) → S;  TW.aktion(S, pid, m, jetzt) → { ok, fehler };  TW.takt(S, jetzt) → geändert?
//   TW.neustart(S, jetzt) (= TW.uebernahme): nach Übernahme der Spielleitung beginnt die laufende Runde neu, Punkte bleiben.
(function () {
  const ZIMMER_NAMEN = { wohnzimmer: "Omas Wohnzimmer", kinderzimmer: "Kinderzimmer", kueche: "Küche" };
  const ZIMMER = Object.keys(ZIMMER_NAMEN);
  const ARTEN = {
    alle: { name: "Alle suchen", kurz: "Alle verstecken sich, dann suchen alle gleichzeitig nach den anderen. 3 Punkte pro Fund, 1 Punkt für je 20 Sekunden unentdeckt." },
    einer: { name: "Einer sucht", kurz: "Einer sucht, die anderen verstecken sich und schauen ihm dabei zu. Ab 6 Spielern suchen zwei. Jeder ist einmal dran." }
  };
  const LAENGEN = { kurz: { n: 3, name: "Kurz" }, normal: { n: 5, name: "Normal" }, lang: { n: 7, name: "Lang" } };
  const VERSTECKZEITEN = [60, 90, 120];
  const ABPAUSEN = ["einmal", "aus", "frei"];
  const ZEIT = {
    vorlauf: 3000,        // bis das Verstecken beginnt
    warten: 3000,         // höchstens so lange auf die Verstecke warten
    countdown: 2000,      // „Ich komme!“ vor der Suche
    suchAlle: 90000, suchEiner: 120000,
    aufloesung: 6000, proVersteck: 4000,
    sperre: 3000,         // daneben bei „Alle suchen“
    abzug: 5000,          // daneben bei „Einer sucht“
    niesen: 15000,        // ab der Hälfte der Suchzeit alle 15 s
    punktTakt: 20000      // 1 Punkt je 20 s unentdeckt
  };
  const PUNKTE = { alle: { fund: 3, nie: 4, alleGefunden: 0 }, einer: { fund: 2, nie: 3, alleGefunden: 3 } };
  const BOTNAMEN = ["Kalle", "Jule", "Ronny", "Bärbel", "Heinz", "Mandy", "Uwe"];

  function zufall(S) { S.rz = (Math.imul(S.rz ^ (S.rz >>> 15), 2246822507) + 0x9E3779B9) >>> 0; return ((S.rz ^ (S.rz >>> 13)) >>> 0) / 4294967296; }
  function mischen(S, l) { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(zufall(S) * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; }

  function neu(code, pid, name) {
    const S = { code, epoch: 0, host: pid, phase: "lobby", spieler: {}, reihe: [], online: [],
      einst: { art: "alle", laenge: "normal", zimmer: { wohnzimmer: true, kinderzimmer: true, kueche: true }, versteck: 90, niesen: true, abpausen: "einmal" },
      tag: null, r: null, ehrung: null, rz: (Math.random() * 2 ** 31) | 0 };
    dazu(S, pid, name || "Spielleitung");
    return S;
  }
  function freieFarbe(S) { const belegt = new Set(Object.values(S.spieler).map(s => s.farbe)); for (let i = 0; i < 8; i++) if (!belegt.has(i)) return i; return Object.keys(S.spieler).length % 8; }
  // Nachzügler bekommen den Durchschnitt der bisherigen Punkte
  function dazu(S, pid, name, bot) {
    if (S.spieler[pid]) { if (name) S.spieler[pid].name = String(name).slice(0, 20); return; }
    const imSpiel = S.phase !== "lobby";
    const alle = S.reihe.filter(p => S.spieler[p]);
    const schnitt = imSpiel && alle.length ? Math.round(alle.reduce((s, p) => s + S.spieler[p].punkte, 0) / alle.length) : 0;
    S.spieler[pid] = { name: String(name || "?").slice(0, 20), farbe: freieFarbe(S), bot: !!bot, punkte: schnitt, stat: neueStat() };
    S.reihe.push(pid);
  }
  const neueStat = () => ({ unentdeckt: 0, funde: 0, daneben: 0, schnellst: null, farben: 0, runden: 0, gefunden: 0 });
  const istBot = (S, p) => !!(S.spieler[p] && S.spieler[p].bot);
  const da = (S, p) => istBot(S, p) || (S.online || []).includes(p);
  const anwesend = S => S.reihe.filter(p => S.spieler[p] && da(S, p));

  // ---------- Hausbesuch ----------
  // Zimmer reihum in gemischter Folge, nie zweimal dasselbe hintereinander (wenn es mehr als eins gibt)
  function zimmerFolge(S, n) {
    const an = ZIMMER.filter(z => S.einst.zimmer[z]);
    const liste = an.length ? an : ZIMMER.slice();
    const out = [];
    while (out.length < n) {
      const runde = mischen(S, liste.slice());
      if (out.length && runde.length > 1 && runde[0] === out[out.length - 1]) { const j = 1 + Math.floor(zufall(S) * (runde.length - 1)); [runde[0], runde[j]] = [runde[j], runde[0]]; }
      for (const z of runde) if (out.length < n) out.push(z);
    }
    return out;
  }
  function plan(S) {
    const tn = anwesend(S);
    if (S.einst.art === "einer") {
      const reihe = mischen(S, tn.slice());
      const zwei = reihe.length >= 6;
      const sucher = [];
      for (let i = 0; i < reihe.length; i += zwei ? 2 : 1) sucher.push(reihe.slice(i, i + (zwei ? 2 : 1)));
      const z = zimmerFolge(S, sucher.length);
      return sucher.map((s, i) => ({ zimmer: z[i], sucher: s }));
    }
    const n = LAENGEN[S.einst.laenge].n;
    return zimmerFolge(S, n).map(z => ({ zimmer: z, sucher: [] }));
  }
  function tagStarten(S, jetzt) {
    for (const p of S.reihe) { S.spieler[p].punkte = 0; S.spieler[p].stat = neueStat(); }
    S.ehrung = null;
    S.tag = { plan: plan(S), nr: -1, ergebnisse: [] };
    rundeStarten(S, jetzt);
  }
  function rundeStarten(S, jetzt) {
    const T = S.tag; T.nr++;
    const P = T.plan[T.nr], art = S.einst.art;
    const tn = anwesend(S);
    let sucher, verstecker;
    if (art === "einer") { sucher = P.sucher.filter(p => tn.includes(p)); verstecker = tn.filter(p => !P.sucher.includes(p)); }
    else { sucher = tn.slice(); verstecker = tn.slice(); }
    const versteckStart = jetzt + ZEIT.vorlauf;
    S.phase = "runde";
    S.r = {
      nr: T.nr, zimmer: P.zimmer, seed: (zufall(S) * 2 ** 31) | 0, art, sucher, verstecker,
      teil: "verstecken", versteckStart, versteckEnde: versteckStart + S.einst.versteck * 1000,
      wartenBis: null, suchStart: null, suchEnde: null, dauer: art === "einer" ? ZEIT.suchEiner : ZEIT.suchAlle,
      niesenAb: null, niesenNaechst: null,
      fertig: {}, da: {}, farben: {}, funde: {}, daneben: {}, gesperrt: {}, ev: [], evn: 0,
      aufloesungEnde: null, punkte: null, rundflug: null, tarnkuenstler: null
    };
  }
  // Versteck komplett angekommen: Meldung nach dem Ende des eigenen Versteckens (Fertig oder Zeit um)
  function angekommen(r, p) { return r.da[p] != null && r.da[p] >= (r.fertig[p] != null ? r.fertig[p] : r.versteckEnde); }

  function ev(r, e) { e.n = ++r.evn; r.ev.push(e); if (r.ev.length > 60) r.ev.splice(0, r.ev.length - 60); }

  function auswerten(S, jetzt) {
    const r = S.r, P = PUNKTE[r.art];
    const dauer = Math.max(0, Math.min(jetzt, r.suchEnde) - r.suchStart);
    r.suchDauer = dauer;
    const punkte = {};
    const alleTn = [...new Set(r.sucher.concat(r.verstecker))];
    for (const p of alleTn) punkte[p] = 0;
    for (const z of r.verstecker) {
      const f = r.funde[z];
      const unentdeckt = f ? Math.min(f.t, dauer) : dauer;
      punkte[z] += Math.floor(unentdeckt / ZEIT.punktTakt) + (f ? 0 : P.nie);
      if (f && punkte[f.von] != null) punkte[f.von] += P.fund;
      const st = S.spieler[z] && S.spieler[z].stat;
      if (st) {
        st.unentdeckt += unentdeckt;
        if (f) { st.gefunden++; st.schnellst = st.schnellst == null ? f.t : Math.min(st.schnellst, f.t); }
      }
      if (f && S.spieler[f.von]) S.spieler[f.von].stat.funde++;
    }
    if (P.alleGefunden && r.verstecker.length && r.verstecker.every(z => r.funde[z])) for (const s of r.sucher) punkte[s] += P.alleGefunden;
    for (const p of alleTn) if (S.spieler[p]) { S.spieler[p].punkte += punkte[p]; S.spieler[p].stat.runden++; }
    r.punkte = punkte;
    // Rundflug: zuerst die früh Gefundenen, zuletzt die nie Gefundenen
    const reiheIdx = p => S.reihe.indexOf(p);
    r.rundflug = r.verstecker.slice().sort((a, b) => {
      const ta = r.funde[a] ? r.funde[a].t : Infinity, tb = r.funde[b] ? r.funde[b].t : Infinity;
      return ta !== tb ? ta - tb : reiheIdx(a) - reiheIdx(b);
    });
    // Tarnkünstler der Runde: am längsten unentdeckt (Gleichstand: zuerst in der Reihe)
    let best = null, bw = -1;
    for (const p of S.reihe) if (r.verstecker.includes(p)) { const w = r.funde[p] ? r.funde[p].t : Infinity; if (w > bw) { bw = w; best = p; } }
    r.tarnkuenstler = best;
    r.teil = "aufloesung";
    r.aufloesungEnde = jetzt + ZEIT.aufloesung + ZEIT.proVersteck * r.verstecker.length;
    S.tag.ergebnisse.push({ nr: r.nr, zimmer: r.zimmer, art: r.art, punkte: Object.assign({}, punkte), funde: JSON.parse(JSON.stringify(r.funde)), daneben: Object.assign({}, r.daneben) });
  }
  function weiter(S, jetzt) {
    if (S.tag && S.tag.nr + 1 < S.tag.plan.length) rundeStarten(S, jetzt);
    else { S.phase = "ende"; S.ehrung = ehrung(S); }
  }

  // ---------- Rangliste und Siegerehrung ----------
  function rangliste(S, nur) {
    const l = S.reihe.filter(p => S.spieler[p] && (!nur || nur.includes(p))).map((p, i) => ({ pid: p, name: S.spieler[p].name, punkte: S.spieler[p].punkte, i }));
    l.sort((a, b) => b.punkte - a.punkte || a.i - b.i);
    let platz = 0;
    l.forEach((e, i) => { if (i === 0 || l[i - 1].punkte !== e.punkte) platz = i + 1; e.platz = platz; delete e.i; });
    return l;
  }
  const uhr = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  function ehrung(S) {
    const tn = S.reihe.filter(p => S.spieler[p] && S.spieler[p].stat.runden > 0);
    const titel = [];
    // Gleichstand: wer zuerst in der Reihe steht
    const bester = (id, name, f, text, kleinste) => {
      let wer = null, w = null;
      for (const p of tn) {
        const v = f(S.spieler[p].stat);
        if (v == null || (!kleinste && v <= 0)) continue;
        if (w == null || (kleinste ? v < w : v > w)) { w = v; wer = p; }
      }
      if (wer != null) titel.push({ id, name, pid: wer, wert: w, text: text(w) });
    };
    bester("tarnkuenstler", "Tarnkünstler", s => s.unentdeckt, w => "am längsten unentdeckt: " + uhr(w));
    bester("adlerauge", "Adlerauge", s => s.funde, w => w === 1 ? "einen Klecks gefunden" : w + " Kleckse gefunden");
    bester("blindfisch", "Blindfisch", s => s.daneben, w => w === 1 ? "einmal daneben getippt" : w + "-mal daneben getippt");
    bester("bunterhund", "Bunter Hund", s => s.schnellst, w => "nach " + uhr(w) + " gefunden", true);
    bester("picasso", "Picasso", s => s.farben, w => w + " Farben benutzt");
    const stand = rangliste(S, tn);
    return { stand, titel, meister: stand.length ? stand[0].pid : null };
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
    if (t === "bot") {
      if (!host) return nein("Nur die Spielleitung.");
      if (S.phase !== "lobby") return nein("Nur in der Lobby.");
      if (m.an || m.dazu) {
        if (S.reihe.length >= 8) return nein("Höchstens 8 Spieler.");
        const namen = new Set(Object.values(S.spieler).map(s => s.name));
        const nr = S.reihe.filter(p => istBot(S, p)).length;
        let name = BOTNAMEN.find(n => !namen.has(n)) || BOTNAMEN[nr % BOTNAMEN.length];
        let id; do id = "bot" + Math.random().toString(36).slice(2, 7); while (S.spieler[id]);
        dazu(S, id, name, true); return ok;
      }
      if (m.weg) {
        if (!istBot(S, m.weg)) return nein("Kein Bot.");
        delete S.spieler[m.weg]; S.reihe = S.reihe.filter(p => p !== m.weg); return ok;
      }
      return nein();
    }
    if (t === "einst") {
      if (!host || S.phase !== "lobby") return nein("Nur die Spielleitung in der Lobby.");
      const e = S.einst;
      if (m.art && ARTEN[m.art]) e.art = m.art;
      if (m.laenge && LAENGEN[m.laenge]) e.laenge = m.laenge;
      if (VERSTECKZEITEN.includes(+m.versteck)) e.versteck = +m.versteck;
      if (typeof m.niesen === "boolean") e.niesen = m.niesen;
      if (ABPAUSEN.includes(m.abpausen)) e.abpausen = m.abpausen;
      if (typeof m.zimmer === "string" && ZIMMER_NAMEN[m.zimmer]) {
        // umschalten, aber eins bleibt immer an
        const neuW = !e.zimmer[m.zimmer];
        if (neuW || ZIMMER.some(z => z !== m.zimmer && e.zimmer[z])) e.zimmer[m.zimmer] = neuW;
      } else if (m.zimmer && typeof m.zimmer === "object") {
        const z = {}; for (const k of ZIMMER) z[k] = m.zimmer[k] == null ? !!e.zimmer[k] : !!m.zimmer[k];
        if (ZIMMER.some(k => z[k])) e.zimmer = z;
      }
      return ok;
    }
    if (t === "start") {
      if (!host || S.phase !== "lobby") return nein("Nur die Spielleitung in der Lobby.");
      if (anwesend(S).length < 2) return nein("Mindestens 2 Spieler.");
      tagStarten(S, jetzt); return ok;
    }
    if (t === "neustart") {
      if (!host || S.phase !== "ende") return nein();
      if (anwesend(S).length < 2) return nein("Mindestens 2 Spieler.");
      tagStarten(S, jetzt); return ok;
    }
    if (t === "lobby") {
      if (!host || S.phase === "lobby") return nein();
      S.phase = "lobby"; S.r = null; S.tag = null; S.ehrung = null; return ok;
    }
    const r = S.r;
    if (S.phase !== "runde" || !r) return nein();
    if (t === "weiter") {
      if (!host || r.teil !== "aufloesung") return nein();
      weiter(S, jetzt); return ok;
    }
    if (t === "fertig") {
      if (r.teil !== "verstecken" || !r.verstecker.includes(pid)) return nein();
      if (r.fertig[pid] == null) r.fertig[pid] = jetzt;
      return ok;
    }
    if (t === "versteckt") {
      // vom Spielleiter-Handy, sobald das Versteck eines Spielers angekommen ist
      if (!host) return nein();
      const p = m.pid || pid;
      if (!r.verstecker.includes(p) || (r.teil !== "verstecken" && r.teil !== "warten")) return nein();
      r.da[p] = jetzt;
      const f = Math.max(0, m.farben | 0);
      r.farben[p] = Math.max(r.farben[p] || 0, f);
      if (S.spieler[p]) S.spieler[p].stat.farben = Math.max(S.spieler[p].stat.farben, f);
      return { ok: true, leise: r.teil === "verstecken" };
    }
    if (t === "fund" || t === "daneben") {
      if (r.teil !== "suchen" || jetzt < r.suchStart || jetzt >= r.suchEnde) return nein("Gerade wird nicht gesucht.");
      if (!r.sucher.includes(pid)) return nein("Du suchst gerade nicht.");
      if (r.gesperrt[pid] > jetzt) return nein("Brille beschlagen.");
      if (t === "fund") {
        const z = m.ziel;
        if (z === pid) return nein("Das bist du selbst.");
        if (!r.verstecker.includes(z)) return nein("Den gibt es hier nicht.");
        if (r.funde[z]) return nein("Schon gefunden.");
        const bisher = jetzt - r.suchStart;
        let ms = m.ms != null ? +m.ms : bisher;
        if (!isFinite(ms)) ms = bisher;
        ms = Math.round(Math.max(0, Math.min(ms, bisher, r.dauer)));
        r.funde[z] = { von: pid, t: ms };
        ev(r, { t: "fund", von: pid, pid: z, ms, zeit: jetzt });
        return ok;
      }
      r.daneben[pid] = (r.daneben[pid] || 0) + 1;
      sp.stat.daneben++;
      if (r.art === "einer") r.suchEnde = Math.max(jetzt, r.suchEnde - ZEIT.abzug);
      else r.gesperrt[pid] = jetzt + ZEIT.sperre;
      ev(r, { t: "daneben", pid, zeit: jetzt, bis: r.art === "einer" ? r.suchEnde : r.gesperrt[pid] });
      return ok;
    }
    return nein();
  }

  // Takt beim Spielleiter (alle 200 ms)
  function takt(S, jetzt) {
    if (S.phase !== "runde" || !S.r) return false;
    const r = S.r;
    const vda = r.verstecker.filter(p => da(S, p));
    if (r.teil === "verstecken") {
      if (jetzt < r.versteckStart) return false;
      if (jetzt >= r.versteckEnde || vda.every(p => r.fertig[p] != null)) {
        r.versteckEnde = Math.min(r.versteckEnde, jetzt);
        r.teil = "warten"; r.wartenBis = jetzt + ZEIT.warten;
        return true;
      }
      return false;
    }
    if (r.teil === "warten") {
      if (jetzt >= r.wartenBis || vda.every(p => angekommen(r, p))) {
        r.teil = "suchen";
        r.suchStart = jetzt + ZEIT.countdown; r.suchEnde = r.suchStart + r.dauer;
        r.niesenAb = r.suchStart + r.dauer / 2; r.niesenNaechst = r.niesenAb;
        return true;
      }
      return false;
    }
    if (r.teil === "suchen") {
      if (jetzt < r.suchStart) return false;
      if (jetzt >= r.suchEnde || r.verstecker.every(p => r.funde[p])) { auswerten(S, jetzt); return true; }
      if (S.einst.niesen && jetzt >= r.niesenNaechst) {
        while (r.niesenNaechst <= jetzt) r.niesenNaechst += ZEIT.niesen;    // verpasste Termine überspringen
        const frei = r.verstecker.filter(p => !r.funde[p]);
        if (frei.length) { ev(r, { t: "niesen", pid: frei[Math.floor(zufall(S) * frei.length)], zeit: jetzt }); return true; }
      }
      return false;
    }
    if (r.teil === "aufloesung" && jetzt >= r.aufloesungEnde) { weiter(S, jetzt); return true; }
    return false;
  }

  // Spielleitung übernommen oder fortgesetzt: laufende Runde beginnt neu mit dem Verstecken (gleiches Zimmer, gleiche Sucher, neue Zeiten), Punkte bleiben.
  // In der Auflösung sind die Punkte schon verbucht, dann läuft sie einfach weiter.
  function uebernahme(S, jetzt) {
    if (S.phase === "runde" && S.tag && S.r && S.r.teil !== "aufloesung") { const seed = S.r.seed; S.tag.nr--; rundeStarten(S, jetzt); S.r.seed = seed; }
  }
  // Was ein Handy vom Stand bekommt (alle sehen alles, wie bei Sperrgut)
  const sicht = (S, pid) => S;
  const TW = { neu, aktion, takt, sicht, neustart: uebernahme, uebernahme, rangliste, istBot, da, ZEIT, PUNKTE, ZIMMER_NAMEN, ARTEN, LAENGEN, VERSTECKZEITEN, ABPAUSEN, BOTNAMEN };
  if (typeof module !== "undefined") module.exports = TW;
  if (typeof window !== "undefined") window.TW = TW;
})();
