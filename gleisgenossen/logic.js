// Gleisgenossen: Spielregeln ohne Netzwerk und ohne Oberfläche.
// Eine Eisenbahn-Genossenschaft mit gemeinsamer Kasse. Karte aus Sechsecken (Zeilen versetzt, ungerade Zeilen nach rechts).
// Ein Monat: alle planen gleichzeitig (Gleise bauen, Züge kaufen) → alle fertig → Abrechnung → nächster Monat.
(function () {
  const GELAENDE = {
    ".": { name: "Wiese", kosten: 20 }, w: { name: "Wald", kosten: 40 }, h: { name: "Hügel", kosten: 60 },
    "~": { name: "Fluss", kosten: 150 }, b: { name: "Berg", kosten: 250 }, x: { name: "Bebaut", kosten: null }
  };
  const BAHNHOF = 100, START_KASSE = 2500, WARTUNG_GLEIS = 2, WARTUNG_BAHNHOF = 5, TAGE = 30, WAGEN_PLATZ = 5;
  // Betrieb in T pro Monat, dazu Kohle als Treibstoff (aus dem eigenen Lager, sonst zugekauft)
  const LOKS = {
    feld: { name: "Feldbahn", preis: 250, tempo: 3, wagen: 2, betrieb: 15, kohle: 3 },
    dampf: { name: "Dampflok", preis: 550, tempo: 5, wagen: 4, betrieb: 30, kohle: 6 }
  };
  const KOHLE_PREIS = 5, LAGER_MAX = 200, ZINS = .05, KREDIT_SCHRITT = 500, RUF_START = 3, RUF_MAX = 5, MAX_AUFTRAEGE = 3;
  const LADUNG = { fahrgaeste: { name: "Fahrgäste", satz: 1.2 }, kohle: { name: "Kohle", satz: 1.0 }, holz: { name: "Holz", satz: 0.9 }, bretter: { name: "Bretter", satz: 1.3 } };
  // Kohle in einen Ort = ins eigene Kohlenlager (kein Geld). Holz ins Sägewerk wird zu Brettern, Bretter lassen Orte wachsen.
  const ORTE = {
    stadt: { name: "Ort", liefert: ["fahrgaeste"], nimmt: ["fahrgaeste", "bretter", "kohle"] },
    zeche: { name: "Zeche", liefert: ["kohle"], nimmt: [] }, kraftwerk: { name: "Kraftwerk", liefert: [], nimmt: ["kohle"] },
    holzfaeller: { name: "Holzfäller", liefert: ["holz"], nimmt: [] }, saegewerk: { name: "Sägewerk", liefert: ["bretter"], nimmt: ["holz"] }
  };
  const FAHRGAESTE = [0, 14, 24, 36, 50];      // pro Monat je Ortsgröße
  const WACHSTUM = [0, 30, 50, 80];            // Bretter bis zur nächsten Größe
  const EREIGNISSE = [
    { typ: "ruhig", titel: "Ruhiger Monat", text: "Nichts Besonderes. Gute Gelegenheit zum Bauen.", w: 3 },
    { typ: "stadtfest", titel: "Stadtfest in {ort}", text: "Diesen Monat doppelt so viele Fahrgäste in {ort}.", w: 2 },
    { typ: "hochwasser", titel: "Hochwasser", text: "Alle Brücken sind gesperrt. Züge, die über den Fluss müssen, stehen still.", w: 1.5 },
    { typ: "schnee", titel: "Schneesturm", text: "Alle Züge fahren langsamer und schaffen weniger Fahrten.", w: 1.5 },
    { typ: "lokschaden", titel: "Lokschaden an Zug {zug}", text: "Zug {zug} bleibt diesen Monat in der Werkstatt.", w: 1.5 },
    { typ: "kohlepreis", titel: "Kohle wird knapp", text: "Kohle ans Kraftwerk bringt 50 % mehr, zugekaufte Kohle kostet doppelt.", w: 1.5 },
    { typ: "streik", titel: "Streik bei den Holzfällern", text: "Diesen Monat gibt es kein Holz.", w: 1 },
    { typ: "baustoffe", titel: "Baustoffe im Angebot", text: "Gleise und Bahnhöfe kosten diesen Monat 25 % weniger.", w: 1.5 },
    { typ: "foerderung", titel: "Fördergeld vom Landkreis", text: "Die Genossenschaft bekommt 300 T geschenkt.", w: 1 }
  ];
  const STADTNAMEN = ["Lindenau", "Mühlbach", "Großfurt", "Eichstedt", "Birkenhain", "Steinbrück", "Talheim", "Rabenau", "Wiesental", "Kranichfeld"];
  const INDUSTRIENAMEN = {
    zeche: ["Zeche Glückauf", "Zeche Morgenstern"], kraftwerk: ["Kraftwerk Nord", "Kraftwerk Süd"],
    holzfaeller: ["Holzfäller Tannengrund", "Holzfäller Fichtenhang"], saegewerk: ["Sägewerk"]
  };
  const FARBEN = ["#E2453A", "#2F6FDE", "#2E9E5B", "#F2B705", "#8E5BD6", "#F08A24", "#1FA5A5", "#D6457E"];
  const MONATE = [8, 12, 16];
  const MAX_HALTE = 8;

  const kopie = o => JSON.parse(JSON.stringify(o));
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // ---------- Sechsecke ----------
  function nachbarn(K, i) {
    const c = i % K.B, r = (i / K.B) | 0;
    const d = r & 1 ? [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]] : [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
    const l = [];
    for (const [dc, dr] of d) { const cc = c + dc, rr = r + dr; if (cc >= 0 && cc < K.B && rr >= 0 && rr < K.H) l.push(rr * K.B + cc); }
    return l;
  }
  function wuerfel(K, i) { const c = i % K.B, r = (i / K.B) | 0, x = c - (r - (r & 1)) / 2; return [x, r, -x - r]; }
  function hexAbstand(K, a, b) { const p = wuerfel(K, a), q = wuerfel(K, b); return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])); }
  const G_hex = (K, a, b) => hexAbstand(K, a, b);
  const kante = (a, b) => a < b ? a + "-" + b : b + "-" + a;

  // ---------- Karte ----------
  function karteErzeugen(seed, spieler) {
    const z = rng(seed);
    const [B, H] = spieler <= 2 ? [20, 15] : spieler <= 4 ? [22, 16] : [24, 18];
    const K = { seed, B, H, g: "", orte: [] };
    const ph = Array.from({ length: 8 }, () => z() * 6.283);
    const g = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < B; c++) {
      const x = (c + .5 * (r & 1)) * .72, y = r * .866 * .72;   // gestreckt: größere Wälder, Hügel, Gebirge
      const n1 = Math.sin(x * .42 + ph[0]) * Math.cos(y * .5 + ph[1]) + .5 * Math.sin(x * .9 - y * .7 + ph[2]) + .3 * Math.cos(x * 1.4 + y * 1.2 + ph[3]);
      const n2 = Math.sin(x * .55 + ph[4]) * Math.sin(y * .6 + ph[5]) + .45 * Math.cos(x * 1.1 + y * .4 + ph[6]);
      const rand = Math.max(Math.abs(c + .5 * (r & 1) - (B - .5) / 2) / (B / 2), Math.abs(r - (H - 1) / 2) / (H / 2));
      g.push(rand > .7 && n1 > .05 ? "b" : n1 > .62 ? "h" : n2 > .35 ? "w" : ".");
    }
    // Fluss von oben nach unten, schlängelt sich durch die Mitte
    let c = Math.floor(B * (.3 + z() * .4));
    for (let r = 0; r < H; r++) {
      g[r * B + c] = "~";
      const links = r & 1 ? c : c - 1, rechts = links + 1;
      const ziel = B / 2 + Math.sin(r * .8 + ph[7]) * B / 5;
      c = z() < (c > ziel ? .7 : .3) ? links : rechts;
      c = Math.max(1, Math.min(B - 2, c));
    }
    K.g = g.join("");
    // Orte und Betriebe: Mittelfeld (dort entsteht der Bahnhof) und bebaute Nachbarfelder
    const belegt = new Set();
    const istRand = i => { const cc = i % B, rr = (i / B) | 0; return cc === 0 || rr === 0 || cc === B - 1 || rr === H - 1; };
    const frei = i => !belegt.has(i) && g[i] !== "~" && g[i] !== "b" && !istRand(i);
    const umfeld = (i, t) => nachbarn(K, i).filter(n => g[n] === t).length;
    function setze(typ, name, groesse, wertung) {
      for (let min = 6; min >= 3; min--) {
        let best = -1, bw = -1e9;
        for (let i = 0; i < B * H; i++) {
          if (!frei(i) || K.orte.some(o => hexAbstand(K, o.zelle, i) < min)) continue;
          const freiNb = nachbarn(K, i).filter(n => frei(n) && g[n] !== "~").length;
          if (freiNb < 4) continue;
          const w = wertung(i) + z() * 2;
          if (w > bw) { bw = w; best = i; }
        }
        if (best < 0) continue;
        g[best] = "."; belegt.add(best);
        const deko = [];
        const anzahl = typ === "stadt" ? groesse + 1 : 1;
        const kand = nachbarn(K, best).filter(n => frei(n) && g[n] !== "~").sort(() => z() - .5);
        for (const n of kand.slice(0, anzahl)) { g[n] = "x"; belegt.add(n); deko.push(n); }
        const o = { id: K.orte.length, typ, name, zelle: best, deko };
        if (typ === "stadt") o.groesse = groesse;
        if (typ === "zeche") o.menge = 36 + Math.floor(z() * 4) * 4;
        if (typ === "holzfaeller") o.menge = 32 + Math.floor(z() * 4) * 4;
        K.orte.push(o);
        return o;
      }
      return null;
    }
    const nStadt = spieler <= 2 ? 4 : spieler <= 4 ? 5 : 6;
    const namen = STADTNAMEN.slice().sort(() => z() - .5);
    for (let k = 0; k < nStadt; k++) setze("stadt", namen[k], k === 0 ? 3 : k < 3 ? 2 : 1 + Math.floor(z() * 2), () => 0);
    const naheBerg = i => umfeld(i, "b") * 2 + umfeld(i, "h");
    INDUSTRIENAMEN.zeche.forEach(n => setze("zeche", n, 0, naheBerg));
    INDUSTRIENAMEN.holzfaeller.forEach(n => setze("holzfaeller", n, 0, i => umfeld(i, "w") * 2 + (g[i] === "w" ? 2 : 0)));
    INDUSTRIENAMEN.kraftwerk.slice(0, spieler <= 3 ? 1 : 2).forEach(n => setze("kraftwerk", n, 0, i => -naheBerg(i)));
    setze("saegewerk", INDUSTRIENAMEN.saegewerk[0], 0, i => -umfeld(i, "w"));
    K.g = g.join("");
    return K;
  }
  const ortBei = (S, zelle) => S.karte.orte.find(o => o.zelle === zelle) || null;
  function produktion(o, S) { return o.typ === "stadt" ? FAHRGAESTE[o.groesse] : o.typ === "saegewerk" ? ((S && S.bretter && S.bretter[o.id]) || 0) : o.menge || 0; }
  function nimmt(o, ladung) { return ORTE[o.typ].nimmt.includes(ladung); }
  function liefert(o, ladung) { return ORTE[o.typ].liefert.includes(ladung); }
  const rabatt = S => S.ereignis && S.ereignis.typ === "baustoffe" ? .75 : 1;
  const kreditRahmen = S => 1000 + 500 * S.ruf;

  // ---------- Gleisnetz ----------
  function netz(S) {
    const adj = new Map();
    for (const k in S.gleise) {
      const [a, b] = k.split("-").map(Number);
      if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b); adj.get(b).push(a);
    }
    return adj;
  }
  // kürzester Weg auf vorhandenen Gleisen (Breitensuche), ohne die Gleisstücke in „verboten“
  function weg(adj, a, b, verboten) {
    if (a === b) return [a];
    const vor = new Map([[a, -1]]), q = [a];
    while (q.length) {
      const x = q.shift();
      for (const n of adj.get(x) || []) if (!vor.has(n) && !(verboten && verboten.has(kante(x, n)))) { vor.set(n, x); if (n === b) { const p = [b]; let y = x; while (y !== -1) { p.push(y); y = vor.get(y); } return p.reverse(); } q.push(n); }
    }
    return null;
  }
  const streckenWeg = (S, a, b) => weg(netz(S), a, b);
  // Weg einer Zuglinie über alle Halte: Felder und Position jedes Halts (in Feldern ab Start)
  // Rundkurs: nach dem letzten Halt geht es zurück zum ersten, ohne ein Gleisstück doppelt zu befahren.
  function linienWeg(S, linie, adj, rund) {
    adj = adj || netz(S);
    const pfad = [linie[0]], pos = [0], benutzt = rund ? new Set() : null;
    const n = linie.length, bis = rund ? n : n - 1;
    for (let k = 1; k <= bis; k++) {
      const w = weg(adj, linie[k - 1], linie[k % n], benutzt); if (!w || w.length < 2) return null;
      if (rund) for (let i = 1; i < w.length; i++) benutzt.add(kante(w[i - 1], w[i]));
      pfad.push(...w.slice(1)); if (k < n) pos.push(pfad.length - 1);
    }
    return { pfad, pos, rund: !!rund, laenge: pfad.length - 1 };
  }
  const imNetz = (S, zelle) => Object.keys(S.gleise).some(k => k.split("-").map(Number).includes(zelle));
  const darfStarten = (S, zelle) => !!ortBei(S, zelle) || imNetz(S, zelle);
  const feldKosten = (S, i) => GELAENDE[S.karte.g[i]].kosten;

  // Kosten eines Gleiswegs (nur neue Stücke) und neue Bahnhöfe
  function pfadKosten(S, pfad) {
    if (!Array.isArray(pfad) || pfad.length < 2) return { fehler: "Der Weg ist zu kurz." };
    const n = S.karte.B * S.karte.H, kanten = [], bahnhoefe = [];
    let kosten = 0;
    for (let k = 0; k < pfad.length; k++) {
      const i = pfad[k];
      if (!Number.isInteger(i) || i < 0 || i >= n) return { fehler: "Ungültiges Feld." };
      if (S.karte.g[i] === "x") return { fehler: "Durch bebaute Felder kann kein Gleis führen." };
      const o = ortBei(S, i);
      if (o && !S.bahnhoefe.includes(i) && !bahnhoefe.includes(i)) { bahnhoefe.push(i); kosten += Math.round(BAHNHOF * rabatt(S)); }
      if (k === 0) continue;
      const a = pfad[k - 1];
      if (!nachbarn(S.karte, a).includes(i)) return { fehler: "Die Felder liegen nicht nebeneinander." };
      const key = kante(a, i);
      if (S.gleise[key] || kanten.includes(key)) continue;
      kanten.push(key); kosten += Math.round((feldKosten(S, a) + feldKosten(S, i)) / 2 * rabatt(S));
    }
    return { kosten, kanten, bahnhoefe };
  }
  // Günstigster neuer Weg von a nach b (vorhandene Gleise fast kostenlos, fremde Orte gemieden)
  // neu = eigene Trasse: vorhandene Gleisstücke werden nicht mitbenutzt (für Kreise und zweite Strecken)
  function bauWeg(S, a, b, neu) {
    const K = S.karte, n = K.B * K.H;
    if (K.g[b] === "x" || K.g[a] === "x") return null;
    const dist = new Array(n).fill(Infinity), vor = new Array(n).fill(-1), fertig = new Array(n).fill(false);
    dist[a] = 0;
    const mitGleis = neu ? new Set(netz(S).keys()) : null;
    for (;;) {
      let x = -1, m = Infinity;
      for (let i = 0; i < n; i++) if (!fertig[i] && dist[i] < m) { m = dist[i]; x = i; }
      if (x < 0) return null;
      if (x === b) break;
      fertig[x] = true;
      for (const y of nachbarn(K, x)) {
        if (fertig[y] || K.g[y] === "x" || (neu && (S.gleise[kante(x, y)] || (y !== b && mitGleis.has(y))))) continue;
        let w = S.gleise[kante(x, y)] ? .01 : (feldKosten(S, x) + feldKosten(S, y)) / 2;
        if (y !== b && ortBei(S, y) && !S.bahnhoefe.includes(y)) w += BAHNHOF * 4;
        if (dist[x] + w < dist[y]) { dist[y] = dist[x] + w; vor[y] = x; }
      }
    }
    const p = []; let y = b; while (y !== -1) { p.push(y); y = vor[y]; }
    return p.reverse();
  }
  function linieOk(S, linie, rund) {
    if (!Array.isArray(linie) || linie.length < 2) return { fehler: "Eine Linie braucht mindestens zwei Bahnhöfe." };
    if (linie.length > MAX_HALTE) return { fehler: "Höchstens " + MAX_HALTE + " Halte pro Linie." };
    for (let k = 0; k < linie.length; k++) {
      if (!S.bahnhoefe.includes(linie[k])) return { fehler: "Halte müssen Bahnhöfe sein." };
      if (k && linie[k] === linie[k - 1]) return { fehler: "Zweimal derselbe Halt hintereinander." };
    }
    if (!linienWeg(S, linie)) return { fehler: "Zwischen zwei Halten fehlt die Gleisverbindung." };
    if (rund && !linienWeg(S, linie, null, true)) return { fehler: "Für einen Rundkurs fehlt eine zweite Strecke zurück nach " + (ortBei(S, linie[0]) || { name: "zum Start" }).name + ". Ohne doppelt befahrene Gleise muss es einen Kreis geben." };
    return { ok: true };
  }
  // Was ein Zug mit dieser Ladung auf der Linie tun würde (für Hinweise in der Oberfläche)
  function linieInfo(S, linie, ladung) {
    const orte = [...new Set(linie)].map(z => ortBei(S, z)).filter(Boolean), namen = l => l.map(o => o.name).join(", ");
    if (ladung === "fahrgaeste") {
      const st = orte.filter(o => o.typ === "stadt");
      return st.length >= 2 ? { ok: true, text: "Fahrgäste zwischen " + namen(st) } : { ok: false, text: "Fahrgäste brauchen mindestens zwei Orte auf der Linie." };
    }
    const q = orte.filter(o => liefert(o, ladung)), n = LADUNG[ladung].name;
    const quelle = { kohle: "Zeche", holz: "Holzfäller", bretter: "Sägewerk" }[ladung];
    if (!q.length) return { ok: false, text: "Auf der Linie gibt es kein " + n + " zum Laden (" + quelle + " fehlt)." };
    if (ladung === "kohle") {
      const kw = orte.filter(o => o.typ === "kraftwerk"), st = orte.filter(o => o.typ === "stadt");
      if (kw.length) return { ok: true, text: "Kohle von " + namen(q) + " zum " + namen(kw) + ": bringt Geld." };
      if (st.length) return { ok: true, text: "Kohle von " + namen(q) + " ins Lager in " + namen(st) + ": Treibstoff für eure Loks, bringt kein Geld." };
      return { ok: false, text: "Kohle braucht ein Kraftwerk (Geld) oder einen Ort (Lager für eure Loks) auf der Linie." };
    }
    const a = orte.filter(o => nimmt(o, ladung));
    if (!a.length) return { ok: false, text: "Niemand auf der Linie nimmt " + n + " an (" + (ladung === "holz" ? "Sägewerk" : "Ort") + " fehlt)." };
    if (ladung === "holz") return { ok: true, text: "Holz von " + namen(q) + " zum " + namen(a) + ". Daraus werden Bretter." };
    return { ok: true, text: "Bretter vom Sägewerk nach " + namen(a) + ". Damit wachsen die Orte." };
  }

  // ---------- Zustand ----------
  function neu(code, hostPid, hostName) {
    return {
      v: 1, spiel: "gleisgenossen", code, epoch: 0, host: hostPid, phase: "lobby",
      spieler: { [hostPid]: { name: hostName } }, reihenfolge: [hostPid], online: [hostPid],
      monate: 12, monat: 0, kasse: 0, karte: null, gleise: {}, bahnhoefe: [], zuege: [], zugNr: 0,
      ruf: RUF_START, kredit: 0, lager: 0, bretter: {}, wachstum: {}, auftraege: [], angebote: [], aNr: 0, ereignis: null, naechstes: null,
      bereit: {}, bericht: null, historie: [], baulog: [], ergebnis: null, aenderung: Date.now()
    };
  }
  const zugWert = (S, z) => z.gekauft === S.monat ? LOKS[z.lok].preis : Math.round(LOKS[z.lok].preis / 2);
  function wert(S) { return S.kasse - S.kredit + S.zuege.reduce((a, z) => a + Math.round(LOKS[z.lok].preis / 2), 0); }
  // Möglicher Monatsertrag der Karte (grob, nach Luftlinie): daran messen sich die Sterne
  function sterneGrenzen(S) {
    const K = S.karte, orte = K.orte, ab = (a, b) => G_hex(K, a.zelle, b.zelle) * 1.2;
    let pot = 0;
    for (const o of orte) {
      if (o.typ === "stadt") {
        const andere = orte.filter(x => x.typ === "stadt" && x !== o);
        pot += produktion(o, S) * LADUNG.fahrgaeste.satz * andere.reduce((a, x) => a + ab(o, x), 0) / Math.max(1, andere.length);
      } else if (o.typ === "zeche" || o.typ === "holzfaeller") {
        const l = ORTE[o.typ].liefert[0], z = orte.filter(x => x.typ !== "stadt" && nimmt(x, l));
        if (z.length) pot += produktion(o, S) * LADUNG[l].satz * Math.min(...z.map(x => ab(o, x)));
      }
    }
    return [.45, .7, .95].map(x => Math.round((START_KASSE + pot * (S.monate - 2) * x) / 500) * 500);
  }
  // Ältere Spielstände (vor Aufträgen, Kredit usw.) um die neuen Felder ergänzen
  function nachruesten(S) {
    if (!S) return S;
    const d = { ruf: RUF_START, kredit: 0, lager: 0, bretter: {}, wachstum: {}, auftraege: [], angebote: [], aNr: 0, ereignis: null, naechstes: null };
    for (const k in d) if (S[k] === undefined) S[k] = d[k];
    return S;
  }
  function aktion(S0, pid, m) {
    S0 = nachruesten(S0);
    const S = kopie(S0);
    const istHost = pid === S.host;
    const nein = fehler => ({ ok: false, fehler, S: S0 });
    switch (m.t) {
      case "hallo": case "join": {
        const name = String(m.name || "").trim().slice(0, 20) || "Gast";
        if (!S.spieler[pid]) { S.spieler[pid] = { name }; S.reihenfolge.push(pid); } else S.spieler[pid].name = name;
        break;
      }
      case "einstellungen":
        if (!istHost || S.phase !== "lobby") return nein("Nur der Spielleiter kann das ändern.");
        if (MONATE.includes(m.monate)) S.monate = m.monate;
        break;
      case "start": {
        if (!istHost || S.phase !== "lobby") return nein("Nur der Spielleiter kann starten.");
        const anzahl = Math.max(1, Math.min(6, m.anzahl || 1));
        S.karte = karteErzeugen(Number.isInteger(m.seed) ? m.seed : Math.floor(Math.random() * 1e9), anzahl);
        Object.assign(S, { phase: "planen", monat: 1, kasse: START_KASSE, gleise: {}, bahnhoefe: [], zuege: [], zugNr: 0, bereit: {}, bericht: null, historie: [], baulog: [], ergebnis: null,
          ruf: RUF_START, kredit: 0, lager: 0, bretter: {}, wachstum: {}, auftraege: [], angebote: [], aNr: 0, ereignis: null, naechstes: null });
        S.angebote = angeboteErzeugen(S);
        break;
      }
      case "bauen": {
        if (S.phase !== "planen") return nein("Gebaut wird in der Planungsphase.");
        const p = m.pfad;
        if (!Array.isArray(p) || p.length < 2) return nein("Der Weg ist zu kurz.");
        if (!darfStarten(S, p[0])) return nein("Gleise beginnen an einem Ort oder an einem vorhandenen Gleis.");
        const k = pfadKosten(S, p); if (k.fehler) return nein(k.fehler);
        if (!k.kanten.length && !k.bahnhoefe.length) return nein("Hier liegt schon überall ein Gleis.");
        if (k.kosten > S.kasse) return nein("Dafür reicht die Kasse nicht (" + k.kosten + " T).");
        k.kanten.forEach(x => { S.gleise[x] = 1; });
        S.bahnhoefe.push(...k.bahnhoefe);
        S.kasse -= k.kosten;
        S.baulog.push({ pid, monat: S.monat, kanten: k.kanten, bahnhoefe: k.bahnhoefe, kosten: k.kosten });
        break;
      }
      case "rueckgaengig": {
        if (S.phase !== "planen") return nein("Gerade nicht möglich.");
        const l = S.baulog[S.baulog.length - 1];
        if (!l || l.monat !== S.monat || l.pid !== pid) return nein("Nur der eigene letzte Bau in diesem Monat lässt sich zurücknehmen.");
        l.kanten.forEach(x => { delete S.gleise[x]; });
        S.bahnhoefe = S.bahnhoefe.filter(b => !l.bahnhoefe.includes(b));
        if (S.zuege.some(z => !linieOk(S, z.linie, z.rund).ok)) return nein("Ein Zug fährt schon über diese Strecke.");
        S.kasse += l.kosten; S.baulog.pop();
        break;
      }
      case "zugKaufen": {
        if (S.phase !== "planen") return nein("Züge kauft man in der Planungsphase.");
        const L = LOKS[m.lok]; if (!L || !LADUNG[m.ladung]) return nein("Unbekannter Zug.");
        const ok = linieOk(S, m.linie, !!m.rund); if (!ok.ok) return nein(ok.fehler);
        if (L.preis > S.kasse) return nein("Dafür reicht die Kasse nicht (" + L.preis + " T).");
        S.kasse -= L.preis; S.zugNr += 1;
        S.zuege.push({ id: "z" + S.zugNr, nr: S.zugNr, lok: m.lok, ladung: m.ladung, linie: m.linie.slice(), rund: !!m.rund, farbe: FARBEN[(S.zugNr - 1) % FARBEN.length], gekauft: S.monat, letzter: null });
        break;
      }
      case "linie": {
        if (S.phase !== "planen") return nein("Linien ändert man in der Planungsphase.");
        const z = S.zuege.find(x => x.id === m.id); if (!z) return nein("Diesen Zug gibt es nicht mehr.");
        const ok = linieOk(S, m.linie, !!m.rund); if (!ok.ok) return nein(ok.fehler);
        z.linie = m.linie.slice(); z.rund = !!m.rund;
        if (LADUNG[m.ladung]) z.ladung = m.ladung;
        break;
      }
      case "verkaufen": {
        if (S.phase !== "planen") return nein("Gerade nicht möglich.");
        const i = S.zuege.findIndex(x => x.id === m.id); if (i < 0) return nein("Diesen Zug gibt es nicht mehr.");
        S.kasse += zugWert(S, S.zuege[i]); S.zuege.splice(i, 1);
        break;
      }
      case "annehmen": {
        if (S.phase !== "planen") return nein("Aufträge nimmt man in der Planungsphase an.");
        const i = S.angebote.findIndex(a => a.id === m.id); if (i < 0) return nein("Dieses Angebot gibt es nicht mehr.");
        if (S.auftraege.length >= MAX_AUFTRAEGE) return nein("Höchstens " + MAX_AUFTRAEGE + " Aufträge gleichzeitig.");
        S.auftraege.push(Object.assign(S.angebote.splice(i, 1)[0], { stand: 0 }));
        break;
      }
      case "kredit":
        if (S.phase !== "planen") return nein("Gerade nicht möglich.");
        if (S.kredit + KREDIT_SCHRITT > kreditRahmen(S)) return nein("Mehr leiht euch die Bank bei diesem Ruf nicht.");
        S.kredit += KREDIT_SCHRITT; S.kasse += KREDIT_SCHRITT;
        break;
      case "tilgen": {
        if (S.phase !== "planen") return nein("Gerade nicht möglich.");
        const b = Math.min(KREDIT_SCHRITT, S.kredit);
        if (!b) return nein("Es gibt keinen Kredit.");
        if (S.kasse < b) return nein("Dafür reicht die Kasse nicht.");
        S.kredit -= b; S.kasse -= b;
        break;
      }
      case "bereit":
        if (!(S.phase === "planen" || S.phase === "bericht") || !S.spieler[pid]) return nein("Gerade nicht möglich.");
        S.bereit[pid] = !!m.wert;
        break;
      case "erzwingen":
        if (!istHost || !(S.phase === "planen" || S.phase === "bericht")) return nein("Nur der Spielleiter kann das.");
        weiter(S);
        break;
      case "neustart":
        if (!istHost) return nein("Nur der Spielleiter kann das.");
        Object.assign(S, { phase: "lobby", monat: 0, karte: null, gleise: {}, bahnhoefe: [], zuege: [], bereit: {}, bericht: null, historie: [], baulog: [], ergebnis: null });
        break;
      default:
        return nein("Unbekannte Aktion.");
    }
    S.aenderung = Date.now();
    return { ok: true, S };
  }

  // Nächster Schritt: Planung → Abrechnung → nächster Monat (oder Ende)
  function weiter(S) {
    if (S.phase === "planen") monatRechnen(S);
    else if (S.phase === "bericht") {
      if (S.monat >= S.monate) spielEnde(S, false);
      else {
        S.monat += 1; S.phase = "planen"; S.bereit = {};
        S.ereignis = S.naechstes; S.naechstes = null;
        if (S.ereignis && S.ereignis.typ === "foerderung") S.kasse += 300;
      }
    }
  }
  // Vom Spielleiter nach jeder Änderung aufgerufen: sind alle verbundenen Mitspieler fertig, geht es weiter.
  function weiterWennBereit(S0, online) {
    if (!(S0.phase === "planen" || S0.phase === "bericht")) return null;
    const da = (online || []).filter(p => S0.spieler[p]);
    if (!da.length || !da.every(p => S0.bereit[p])) return null;
    const S = kopie(S0); weiter(S); S.aenderung = Date.now(); return S;
  }
  function spielEnde(S, grund) {
    const w = wert(S), g = sterneGrenzen(S), aus = grund === "pleite" || grund === "ruf";
    S.phase = "ende"; S.bereit = {};
    S.ergebnis = { pleite: aus, grund: grund || "zeit", wert: w, grenzen: g, sterne: aus ? 0 : g.filter(x => w >= x).length };
  }
  // Ereignis für den nächsten Monat
  function ereignisZiehen(S) {
    const l = EREIGNISSE.filter(e => (e.typ !== "lokschaden" || S.zuege.length) && (S.monat >= 1 || e.typ === "ruhig"));
    let r = Math.random() * l.reduce((a, e) => a + e.w, 0), e = l[0];
    for (const x of l) { r -= x.w; if (r <= 0) { e = x; break; } }
    const ev = { typ: e.typ };
    const st = S.karte.orte.filter(o => o.typ === "stadt");
    if (e.typ === "stadtfest") ev.ort = st[Math.floor(Math.random() * st.length)].id;
    if (e.typ === "lokschaden") ev.zug = S.zuege[Math.floor(Math.random() * S.zuege.length)].id;
    const ortN = ev.ort !== undefined ? S.karte.orte[ev.ort].name : "", zugN = ev.zug ? String(S.zuege.find(z => z.id === ev.zug).nr) : "";
    ev.titel = e.titel.replace(/\{ort\}/g, ortN).replace(/\{zug\}/g, zugN);
    ev.text = e.text.replace(/\{ort\}/g, ortN).replace(/\{zug\}/g, zugN);
    return ev;
  }
  // Zwei neue Auftragsangebote (nicht angenommene verfallen)
  function angeboteErzeugen(S) {
    const kand = [];
    S.karte.orte.forEach(o => {
      if (o.typ === "kraftwerk") kand.push({ ladung: "kohle", ort: o.id, proMonat: 22 });
      if (o.typ === "saegewerk") kand.push({ ladung: "holz", ort: o.id, proMonat: 18 });
      if (o.typ === "stadt") { kand.push({ ladung: "fahrgaeste", ort: o.id, proMonat: 6 + o.groesse * 6 }); if (S.monat >= 2) kand.push({ ladung: "bretter", ort: o.id, proMonat: 10 }); }
    });
    const frei = kand.filter(k => !S.auftraege.some(a => a.ort === k.ort && a.ladung === k.ladung)).sort(() => Math.random() - .5);
    const l = [];
    for (const k of frei) {
      if (l.length >= 2) break;
      const dauer = 2 + Math.floor(Math.random() * 2), frist = Math.min(S.monate, S.monat + dauer);
      const monate = frist - S.monat; if (monate < 1) break;
      const menge = Math.max(10, Math.round(k.proMonat * (monate + (S.phase === "planen" ? 1 : 0)) * (.7 + Math.random() * .4) / 5) * 5);
      const belohnung = Math.round(menge * LADUNG[k.ladung].satz * 9 / 50) * 50 + 100;
      l.push({ id: "a" + (++S.aNr), ladung: k.ladung, ort: k.ort, menge, frist, belohnung });
    }
    return l;
  }

  // ---------- Abrechnung eines Monats ----------
  function monatRechnen(S) {
    const adj = netz(S), ev = S.ereignis || {}, vorrat = {}, geliefert = {}, neueBretter = {};
    const rufFaktor = .7 + .1 * S.ruf;
    S.karte.orte.forEach(o => {
      let p = produktion(o, S);
      if (o.typ === "stadt") p = Math.round(p * rufFaktor * (ev.typ === "stadtfest" && ev.ort === o.id ? 2 : 1));
      if (o.typ === "holzfaeller" && ev.typ === "streik") p = 0;
      vorrat[o.id] = p;
    });
    const b = { monat: S.monat, zuege: [], einnahmen: 0, belohnung: 0, betrieb: 0, wartung: 0, zinsen: 0, kohle: null, muenzen: [], auftraege: [], gewachsen: [], ereignis: S.ereignis || null };
    const muenze = (zelle, betrag) => { if (betrag <= 0) return; const m = b.muenzen.find(x => x.zelle === zelle); if (m) m.betrag += betrag; else b.muenzen.push({ zelle, betrag }); };
    const gib = (ort, l, n) => { const k = ort + "|" + l; geliefert[k] = (geliefert[k] || 0) + n; };
    let insLager = 0;
    for (const z of S.zuege) {
      const L = LOKS[z.lok], e = { id: z.id, menge: 0, einnahmen: 0, fahrten: 0, hinweis: "" };
      b.betrieb += L.betrieb;
      const fertig = () => { b.zuege.push(e); z.letzter = e; };
      if (ev.typ === "lokschaden" && ev.zug === z.id) { e.hinweis = "Lokschaden, stand in der Werkstatt"; fertig(); continue; }
      const w = linienWeg(S, z.linie, adj, z.rund);
      if (!w) { e.hinweis = "Strecke unterbrochen"; fertig(); continue; }
      if (ev.typ === "hochwasser" && w.pfad.some(i => S.karte.g[i] === "~")) { e.hinweis = "Brücke wegen Hochwasser gesperrt"; fertig(); continue; }
      const tempo = L.tempo * (ev.typ === "schnee" ? .6 : 1);
      // Pendelzug: jede Fahrt eine Richtung, an den Enden wenden. Rundkurs: eine Runde zählt wie Hin- und Rückfahrt, ohne Wenden.
      const laenge = w.laenge, tage = laenge / tempo + z.linie.length * .5 + (z.rund ? 0 : .5);
      const fahrten = z.rund ? 2 * Math.max(1, Math.floor(TAGE / tage)) : Math.max(1, Math.floor(TAGE / tage)), kap = L.wagen * WAGEN_PLATZ;
      const ab = (p, q) => { const d = Math.abs(p - q); return z.rund ? Math.min(d, laenge - d) : d; };
      e.fahrten = fahrten;
      const halte = [], gesehen = new Set();
      z.linie.forEach((zelle, k) => { const o = ortBei(S, zelle); if (o && !gesehen.has(o.id)) { gesehen.add(o.id); halte.push({ o, pos: w.pos[k], zelle }); } });
      const satz = LADUNG[z.ladung].satz * (ev.typ === "kohlepreis" && z.ladung === "kohle" ? 1.5 : 1);
      if (z.ladung === "fahrgaeste") {
        const st = halte.filter(h => h.o.typ === "stadt");
        if (st.length < 2) e.hinweis = "Braucht mindestens zwei Orte";
        else {
          const summe = st.reduce((a, h) => a + vorrat[h.o.id], 0), anteil = summe ? Math.min(1, fahrten * kap / summe) : 0;
          st.forEach(h => {
            const n = Math.floor(vorrat[h.o.id] * anteil); vorrat[h.o.id] -= n;
            const andere = st.filter(x => x !== h);
            const d = andere.reduce((a, x) => a + ab(x.pos, h.pos), 0) / andere.length;
            const geld = Math.round(n * satz * d);
            e.menge += n; e.einnahmen += geld; muenze(h.zelle, geld);
            andere.forEach(x => gib(x.o.id, "fahrgaeste", n / andere.length));
          });
          if (!e.menge) e.hinweis = "Keine Fahrgäste mehr übrig";
        }
      } else {
        const q = halte.filter(h => liefert(h.o, z.ladung));
        let a = halte.filter(h => nimmt(h.o, z.ladung)), lager = false;
        if (z.ladung === "kohle") { const kw = a.filter(h => h.o.typ === "kraftwerk"); if (kw.length) a = kw; else lager = a.length > 0; }
        if (!q.length) e.hinweis = "Nichts zu laden";
        else if (!a.length) e.hinweis = "Kein Abnehmer";
        else {
          let frei = Math.ceil(fahrten / 2) * kap;
          q.forEach(h => {
            const n = Math.min(frei, vorrat[h.o.id]); frei -= n; vorrat[h.o.id] -= n;
            const ziel = a.reduce((x, y) => ab(y.pos, h.pos) > ab(x.pos, h.pos) ? y : x);
            const geld = lager ? 0 : Math.round(n * satz * ab(ziel.pos, h.pos));
            e.menge += n; e.einnahmen += geld; muenze(ziel.zelle, geld);
            gib(ziel.o.id, z.ladung, n);
            if (lager) insLager += n;
            if (z.ladung === "holz") neueBretter[ziel.o.id] = (neueBretter[ziel.o.id] || 0) + n;
            if (z.ladung === "bretter") S.wachstum[ziel.o.id] = (S.wachstum[ziel.o.id] || 0) + n;
          });
          if (!e.menge) e.hinweis = z.ladung === "bretter" ? "Sägewerk hat keine Bretter" : "Ladestelle schon leer";
          else if (lager) e.hinweis = e.menge + " Kohle ins Lager";
        }
      }
      b.einnahmen += e.einnahmen; fertig();
    }
    // Sägewerke: Rest bleibt liegen, aus dem neuen Holz werden Bretter für den nächsten Monat
    S.karte.orte.filter(o => o.typ === "saegewerk").forEach(o => { S.bretter[o.id] = Math.min(LAGER_MAX, vorrat[o.id] + (neueBretter[o.id] || 0)); });
    // Kohle für die Loks: erst aus dem Lager, der Rest wird zugekauft
    const bedarf = S.zuege.reduce((a, z) => a + LOKS[z.lok].kohle, 0);
    S.lager = Math.min(LAGER_MAX, S.lager + insLager);
    const ausLager = Math.min(S.lager, bedarf); S.lager -= ausLager;
    const zukauf = bedarf - ausLager, preis = KOHLE_PREIS * (ev.typ === "kohlepreis" ? 2 : 1);
    b.kohle = { bedarf, ausLager, zukauf, preis, kosten: zukauf * preis, neu: insLager, lager: S.lager };
    b.zinsen = Math.round(S.kredit * ZINS);
    // Orte wachsen mit Brettern
    S.karte.orte.filter(o => o.typ === "stadt").forEach(o => {
      const n = WACHSTUM[o.groesse];
      if (n && (S.wachstum[o.id] || 0) >= n) { S.wachstum[o.id] -= n; o.groesse += 1; b.gewachsen.push(o.id); }
    });
    // Aufträge: erfüllt → Belohnung und Ruf, Frist verpasst → Ruf weg
    S.auftraege = S.auftraege.filter(a => {
      a.stand = Math.min(a.menge, a.stand + Math.round(geliefert[a.ort + "|" + a.ladung] || 0));
      if (a.stand >= a.menge) { b.auftraege.push(Object.assign({}, a, { ok: true })); b.belohnung += a.belohnung; S.ruf = Math.min(RUF_MAX, S.ruf + 1); return false; }
      if (S.monat >= a.frist) { b.auftraege.push(Object.assign({}, a, { ok: false })); S.ruf = Math.max(0, S.ruf - 1); return false; }
      return true;
    });
    b.wartung = Object.keys(S.gleise).length * WARTUNG_GLEIS + S.bahnhoefe.length * WARTUNG_BAHNHOF;
    const kosten = b.betrieb + b.wartung + b.kohle.kosten + b.zinsen;
    S.kasse += b.einnahmen + b.belohnung - kosten;
    b.kasse = S.kasse; b.ruf = S.ruf; b.kredit = S.kredit;
    S.bericht = b;
    S.historie.push({ monat: S.monat, einnahmen: b.einnahmen + b.belohnung, kosten, kasse: S.kasse });
    S.phase = "bericht"; S.bereit = {};
    if (S.kasse < 0) return spielEnde(S, "pleite");
    if (S.ruf <= 0) return spielEnde(S, "ruf");
    if (S.monat < S.monate) { S.naechstes = ereignisZiehen(S); S.angebote = angeboteErzeugen(S); }
  }

  window.GG = {
    GELAENDE, BAHNHOF, START_KASSE, WARTUNG_GLEIS, WARTUNG_BAHNHOF, LOKS, LADUNG, ORTE, FAHRGAESTE, MONATE, MAX_HALTE, WAGEN_PLATZ,
    KOHLE_PREIS, LAGER_MAX, ZINS, KREDIT_SCHRITT, RUF_MAX, MAX_AUFTRAEGE, WACHSTUM, kreditRahmen,
    neu, nachruesten, aktion, weiterWennBereit, karteErzeugen, nachbarn, hexAbstand, kante, netz, streckenWeg, linienWeg, pfadKosten, bauWeg,
    linieOk, linieInfo, ortBei, produktion, darfStarten, imNetz, zugWert, wert, sterneGrenzen, monatRechnen
  };
})();
