// Gleisgenossen: Spielregeln ohne Netzwerk und ohne Oberfläche.
// Offene Welt im Quadratraster. Jeder Spieler startet mit eigenem Gleiskreis, Zug, Land und eigener Kasse (eine „Bahn“).
// Jeder gefahrene Meter bringt Geld (Taler, T). Bahnen können sich später zu einer Genossenschaft zusammentun:
// dann teilen sie Kasse, Land, Gleise und Ziele, und alle Züge fahren im gemeinsamen Netz.
// Ein Feld = 10 m. Seiten eines Feldes: 0 = Norden, 1 = Osten, 2 = Süden, 3 = Westen.
(function () {
  let B = 64, H = 64;                           // Kartengröße in Feldern, je nach Spielerzahl (karteSetzen)
  let HK = null;                                // Höhen an den Feldecken ((B+1) × (H+1) Ziffern), null = flache Karte
  const P = 8;                                  // Grundstücke zu P × P Feldern, Startbereich 2 × 2 Grundstücke
  const GROESSE = [64, 64, 80, 96, 96, 112, 112];   // nach Spielerzahl
  const METER = 10, START_KASSE = 80, MAX_SPIELER = 6;
  const FARBEN = ["#E2453A", "#2F6FDE", "#2E9E5B", "#F2B705", "#8E5BD6", "#F08A24"];
  const TEILE = {
    g: { name: "Gerade", preis: 20, lagen: 2 },
    k: { name: "Kurve", preis: 25, lagen: 4 },
    s: { name: "Weiche", preis: 80, lagen: 8 },
    x: { name: "Kreuzung", preis: 60, lagen: 1 },
    b: { name: "Bahnhof", preis: 150, lagen: 2 }
  };
  const BRUECKE = 100, TUNNEL = 180, RODEN = 15, RUECKGABE = .5;
  const LAND_PREIS = 300, LAND_FAKTOR = 1.45;
  // Bauwerke neben der Strecke: Wirkung, wenn eine Lok im Umkreis vorbeifährt (einmal pro Durchfahrt).
  // bonus = so viele Felder Fahrgeld extra; Kette: mehrere Bauwerke kurz hintereinander geben mehr (bis × 2).
  const BAUTEN = {
    turm: { name: "Wasserturm", preis: 150, radius: 1, schub: 20, text: "Zug fährt 20 s lang 30 % schneller" },
    muehle: { name: "Windmühle", preis: 300, radius: 2, bonus: 8, text: "Bonus bei jeder Durchfahrt" },
    burg: { name: "Burg", preis: 900, radius: 3, bonus: 20, text: "großer Bonus bei jeder Durchfahrt" },
    rad: { name: "Riesenrad", preis: 2200, radius: 3, bonus: 45, text: "sehr großer Bonus bei jeder Durchfahrt" }
  };
  const AUSSICHT = .1;                          // je Höhenstufe so viel mehr Geld pro Meter (nicht im Tunnel)
  const KETTE_WEG = 200;                        // m: so kurz nacheinander zählt als Kette
  const HALT_ZEIT = 2.5, PLAETZE = 6, FAHRPREIS = .5;   // T pro Fahrgast und Feld
  const STUFEN = {
    tempo: { name: "Kessel", text: "Höchsttempo", preis: 40, faktor: 1.5, max: 20 },
    kraft: { name: "Zugkraft", text: "Beschleunigung", preis: 35, faktor: 1.45, max: 20 },
    kurve: { name: "Kurvenlauf", text: "Tempo in Kurven", preis: 50, faktor: 1.55, max: 15 },
    bremse: { name: "Bremsen", text: "Später bremsen", preis: 30, faktor: 1.45, max: 15 },
    wagen: { name: "Wagen", text: "Mehr Geld pro Meter und mehr Plätze, aber schwerer", preis: 120, faktor: 2.1, max: 5 }
  };
  const LOK_L = .8, WAGEN_L = .6, LUECKE = .08;   // in Feldern
  const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const GELAENDE = { ".": "Wiese", w: "Wald", "~": "Wasser", b: "Berg", h: "Dorf" };
  const DORFNAMEN = ["Lindenau", "Mühlbach", "Großfurt", "Eichstedt", "Birkenhain", "Steinbrück", "Talheim", "Rabenau", "Wiesental", "Kranichfeld",
    "Ahornfeld", "Fuchsberg", "Seedorf", "Hagenbach", "Klarwasser", "Rosenthal", "Waldheim", "Sonnenstein", "Erlenbruch", "Moosburg"];

  // Ziele je Bahn: der Reihe nach angezeigt, jedes zählt aber, sobald es erfüllt ist
  const hatTeil = (S, gid, t) => Object.keys(S.gleise).some(k => S.gleise[k].t === t && besitzer(S, +k) === gid);
  const zuegeVon = (S, gid) => S.gruppen[gid].mitglieder.map(p => S.zuege[p]).filter(Boolean);
  const ZIELE = [
    { id: "km1", text: "Fahrt 1 km", geld: 60, ok: (S, g) => g.meter >= 1000 },
    { id: "teile10", text: "Baut 10 Gleisteile", geld: 100, ok: (S, g) => g.gebaut >= 10 },
    { id: "tempo50", text: "Erreicht 50 km/h", geld: 120, ok: (S, g) => kmh(g.stat.vmax) >= 50 },
    { id: "bahnhof", text: "Baut einen Bahnhof", geld: 150, ok: (S, g, gid) => hatTeil(S, gid, "b") },
    { id: "fahrgaeste", text: "Bringt Fahrgäste von einem Bahnhof zu einem anderen", geld: 250, ok: (S, g) => g.stat.fahrgaeste > 0 },
    { id: "land1", text: "Kauft ein Grundstück dazu", geld: 150, ok: (S, g, gid) => gekauftesLand(S, gid) >= 1 },
    { id: "weiche", text: "Baut eine Weiche", geld: 100, ok: (S, g, gid) => hatTeil(S, gid, "s") },
    { id: "bauwerk", text: "Stellt ein Bauwerk an die Strecke", geld: 150, ok: (S, g, gid) => Object.keys(S.bauten).some(k => besitzer(S, +k) === gid) },
    { id: "dorf2", text: "Verbindet zwei Dörfer mit Bahnhöfen", geld: 500, ok: (S, g) => g.stat.doerfer > 0 },
    { id: "bruecke", text: "Fahrt über eine Brücke", geld: 300, ok: (S, g) => g.stat.bruecke > 0 },
    { id: "tunnel", text: "Fahrt durch einen Tunnel", geld: 400, ok: (S, g) => g.stat.tunnel > 0 },
    { id: "hoehe3", text: "Fahrt auf einen Hügel (Höhe 3)", geld: 300, huegel: true, ok: (S, g) => (g.stat.hoehe || 0) >= 3 },
    { id: "wagen3", text: "Hängt 3 Wagen an", geld: 600, ok: (S, g, gid) => zuegeVon(S, gid).some(z => 1 + z.stufen.wagen >= 3) },
    { id: "kette3", text: "Fahrt an 3 Bauwerken kurz hintereinander vorbei", geld: 600, ok: (S, g) => g.stat.kette >= 3 },
    { id: "tempo100", text: "Erreicht 100 km/h", geld: 1500, ok: (S, g) => kmh(g.stat.vmax) >= 100 },
    { id: "km50", text: "Fahrt 50 km", geld: 1500, ok: (S, g) => g.meter >= 50000 },
    { id: "land6", text: "Kauft 6 Grundstücke dazu", geld: 2500, ok: (S, g, gid) => gekauftesLand(S, gid) >= 6 }
  ];

  const kopie = o => JSON.parse(JSON.stringify(o));
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function karteSetzen(K) { B = K.B; H = K.H; HK = K.hoehe || null; }

  // ---------- Raster und Besitz ----------
  const nb = (i, s) => { const c = i % B + DIR[s][0], r = (i / B | 0) + DIR[s][1]; return c < 0 || r < 0 || c >= B || r >= H ? -1 : r * B + c; };
  const parzelle = i => ((i / B | 0) / P | 0) * (B / P) + ((i % B) / P | 0);
  const besitzer = (S, i) => S.land[parzelle(i)] || null;
  const gruppeVon = (S, pid) => S.spieler[pid] ? S.spieler[pid].gruppe : null;
  const darf = (S, pid, i) => !!gruppeVon(S, pid) && besitzer(S, i) === gruppeVon(S, pid);
  const besitzt = darf;
  const abstand = (a, b) => Math.max(Math.abs(a % B - b % B), Math.abs((a / B | 0) - (b / B | 0)));

  // ---------- Gleisteile ----------
  // Weiche (r = 0…7): Stamm, gerader und abzweigender Zweig; r ≥ 4 = gespiegelt
  function weiche(r) { const q = r % 4; return { stamm: (2 + q) % 4, gerade: q, ab: r < 4 ? (1 + q) % 4 : (3 + q) % 4 }; }
  function paare(t, r) {
    if (t === "g" || t === "b") return r % 2 ? [[1, 3]] : [[0, 2]];
    if (t === "k") return [[r % 4, (r + 1) % 4]];
    if (t === "s") { const w = weiche(r); return [[w.stamm, w.gerade], [w.stamm, w.ab]]; }
    return [[0, 2], [1, 3]];
  }
  function ausgang(teil, ein) {
    if (teil.t === "s") {
      const w = weiche(teil.r);
      if (ein === w.stamm) return teil.st ? w.ab : w.gerade;
      return ein === w.gerade || ein === w.ab ? w.stamm : -1;
    }
    for (const [a, b] of paare(teil.t, teil.r)) { if (a === ein) return b; if (b === ein) return a; }
    return -1;
  }
  const hatSeite = (teil, s) => paare(teil.t, teil.r).some(p => p.includes(s));
  const istKurve = seg => (seg.ein + 2) % 4 !== seg.aus;
  const laenge = seg => istKurve(seg) ? Math.PI / 4 : 1;
  const umkehren = g => ({ i: g.i, ein: g.aus, aus: g.ein });
  // Nächstes Gleisstück; Züge fahren nur auf Land ihrer eigenen Bahn
  function weiter(S, seg, gid) {
    const j = nb(seg.i, seg.aus), t = j >= 0 && S.gleise[j]; if (!t || (gid && besitzer(S, j) !== gid)) return null;
    const ein = (seg.aus + 2) % 4, aus = ausgang(t, ein);
    return aus < 0 ? null : { i: j, ein, aus };
  }
  function zurueck(S, seg, gid) {
    const j = nb(seg.i, seg.ein), t = j >= 0 && S.gleise[j]; if (!t || (gid && besitzer(S, j) !== gid)) return null;
    const aus = (seg.ein + 2) % 4, ein = ausgang(t, aus);
    return ein < 0 ? null : { i: j, ein, aus };
  }
  // Punkt auf einem Gleisstück (Feldkoordinaten, x nach Osten, y nach Süden), s = Weg ab Einfahrt in Feldern
  function punkt(seg, s) {
    const mx = seg.i % B + .5, my = (seg.i / B | 0) + .5, L = laenge(seg), t = Math.min(1, Math.max(0, s / L));
    const e = DIR[seg.ein], a = DIR[seg.aus];
    const ax = mx + .5 * e[0], ay = my + .5 * e[1], bx = mx + .5 * a[0], by = my + .5 * a[1];
    if (L === 1) return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
    const kx = mx + .5 * (e[0] + a[0]), ky = my + .5 * (e[1] + a[1]), th = t * Math.PI / 2, co = Math.cos(th), si = Math.sin(th);
    return { x: kx + (ax - kx) * co + (bx - kx) * si, y: ky + (ay - ky) * co + (by - ky) * si };
  }
  // ---------- Höhen ----------
  // Ganzzahlige Höhen an den Feldecken, benachbarte Ecken unterscheiden sich höchstens um 1.
  // Ein Gleis liegt an jeder Feldkante auf dem Mittelwert ihrer zwei Ecken und steigt dazwischen gleichmäßig.
  const ecke = (cx, cy) => HK ? HK.charCodeAt(Math.max(0, Math.min(H, cy)) * (B + 1) + Math.max(0, Math.min(B, cx))) - 48 : 0;
  const KANTE = [[0, 0, 1, 0], [1, 0, 1, 1], [0, 1, 1, 1], [0, 0, 0, 1]];
  function kantenHoehe(i, s) {
    const c = i % B, r = i / B | 0, k = KANTE[s];
    return (ecke(c + k[0], r + k[1]) + ecke(c + k[2], r + k[3])) / 2;
  }
  function gleisHoehe(seg, s) {
    const a = kantenHoehe(seg.i, seg.ein), t = Math.min(1, Math.max(0, s / laenge(seg)));
    return a + (kantenHoehe(seg.i, seg.aus) - a) * t;
  }
  const steigung = seg => (kantenHoehe(seg.i, seg.aus) - kantenHoehe(seg.i, seg.ein)) / laenge(seg);   // Stufen pro Feld
  // Geländehöhe an einem Punkt (Feldkoordinaten), zwischen den Ecken gemittelt
  function gelaendeHoehe(x, y) {
    if (!HK) return 0;
    x = Math.max(0, Math.min(B, x)); y = Math.max(0, Math.min(H, y));
    const cx = Math.min(B - 1, Math.floor(x)), cy = Math.min(H - 1, Math.floor(y)), fx = x - cx, fy = y - cy;
    const a = ecke(cx, cy), b = ecke(cx + 1, cy), c = ecke(cx, cy + 1), d = ecke(cx + 1, cy + 1);
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }
  const feldHoehe = i => gelaendeHoehe(i % B + .5, (i / B | 0) + .5);
  function eben(i) { const c = i % B, r = i / B | 0, h = ecke(c, r); return ecke(c + 1, r) === h && ecke(c, r + 1) === h && ecke(c + 1, r + 1) === h; }
  // Anhöhe: mindestens Höhe 3 und kein Nachbarfeld höher. Bauwerke wirken dort ein Feld weiter.
  function anhoehe(i) {
    if (!HK) return false;
    const h = feldHoehe(i); if (h < 3) return false;
    const c = i % B, r = i / B | 0;
    for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (x >= 0 && y >= 0 && x < B && y < H && feldHoehe(y * B + x) > h + 1e-6) return false;
    return true;
  }
  const bauRadius = (i, t) => BAUTEN[t].radius + (anhoehe(i) ? 1 : 0);
  // Aussicht: Faktor auf das Geld pro Meter an der Stelle der Lok
  const aussicht = (S, z) => S.karte.g[z.seg.i] === "b" ? 1 : 1 + AUSSICHT * gleisHoehe(z.seg, z.s);

  // Lage, in der ein neues Teil am besten an die Nachbargleise passt
  function besteLage(S, i, t) {
    let best = 0, bw = -1e9;
    for (let r = 0; r < TEILE[t].lagen; r++) {
      let w = 0;
      for (let s = 0; s < 4; s++) {
        const j = nb(i, s), n = j >= 0 && S.gleise[j], offen = !!n && hatSeite(n, (s + 2) % 4), meins = hatSeite({ t, r }, s);
        if (meins && offen) w += 3; else if (meins && n) w -= 1; else if (!meins && offen) w -= 1;
      }
      if (w > bw) { bw = w; best = r; }
    }
    return best;
  }
  const extra = (S, i) => S.karte.g[i] === "~" ? BRUECKE : S.karte.g[i] === "b" ? TUNNEL : 0;
  const teilWert = (S, i) => TEILE[S.gleise[i].t].preis + extra(S, i);

  // ---------- Bahnhöfe ----------
  function haeuser(S, i) {
    let n = 0; const c = i % B, r = i / B | 0;
    for (let y = r - 2; y <= r + 2; y++) for (let x = c - 2; x <= c + 2; x++) if (x >= 0 && y >= 0 && x < B && y < H && S.karte.g[y * B + x] === "h") n++;
    return n;
  }
  const nachfrage = (S, i) => 3 + 2 * haeuser(S, i);
  function bahnhofName(S, i) {
    let best = null, bd = 6;
    S.karte.doerfer.forEach(d => { const a = abstand(i, d.y * B + d.x); if (a < bd) { bd = a; best = d; } });
    return best ? best.name : "Halt " + (i % B) + "/" + (i / B | 0);
  }

  // ---------- Züge ----------
  function werte(z) {
    const st = z.stufen, wagen = 1 + st.wagen;
    return {
      vmax: (1 + .3 * st.tempo) * (z.schub > 0 ? 1.3 : 1),   // Felder pro Sekunde (1 = 36 km/h)
      vk: .7 + .12 * st.kurve,
      a: .35 * Math.pow(1.22, st.kraft) / (1 + .2 * wagen),
      b: .5 * Math.pow(1.22, st.bremse),
      wagen, plaetze: PLAETZE * wagen, geld: 2 + wagen             // Taler pro gefahrenem Feld (10 m)
    };
  }
  const kmh = v => Math.round(v * METER * 3.6);
  const zugLaenge = z => LOK_L + (1 + z.stufen.wagen) * (LUECKE + WAGEN_L);
  function hinten(z, d) {
    let seg = z.seg, s = z.s, k = 0;
    while (d > s) { const v = z.verlauf[k++]; if (!v) { s = d; break; } d -= s; seg = v; s = laenge(v); }
    const p = punkt(seg, s - d); p.h = gleisHoehe(seg, s - d); return p;
  }
  // Lok und Wagen: Mitte und Richtung (Winkel in der x-y-Ebene)
  function wagenlage(z) {
    const l = [], n = 1 + z.stufen.wagen; let d = 0;
    for (let k = 0; k <= n; k++) {
      const len = k ? WAGEN_L : LOK_L, v = hinten(z, d), h = hinten(z, d + len);
      l.push({ x: (v.x + h.x) / 2, y: (v.y + h.y) / 2, w: Math.atan2(v.y - h.y, v.x - h.x), lok: !k, h: (v.h + h.h) / 2, dh: v.h - h.h, len });
      d += len + LUECKE;
    }
    return l;
  }
  // Punkt d Felder vor der Lok entlang der Strecke (für die Kamera); endet das Gleis, bleibt er am Ende
  function vorne(S, pid, d) {
    const z = S.zuege[pid], gid = gruppeVon(S, pid);
    let seg = z.seg, s = z.s + d;
    for (let n = 0; n < 60 && s > laenge(seg); n++) { const nx = weiter(S, seg, gid); if (!nx) { s = laenge(seg); break; } s -= laenge(seg); seg = nx; }
    const p = punkt(seg, s); p.h = gleisHoehe(seg, s); p.i = seg.i; return p;
  }
  // Was vor dem Zug liegt: nächster Bahnhof und nächste Weiche, die vom Stamm her befahren wird (Wege in Feldern)
  function voraus(S, pid, weit = 40) {
    const z = S.zuege[pid], gid = gruppeVon(S, pid), r = { bf: null, weiche: null };
    if (!z) return r;
    let seg = z.seg, d = laenge(seg) - z.s;
    if (istBahnhof(S, seg.i) && z.bedient !== seg.i && z.s < .5) r.bf = { i: seg.i, d: .5 - z.s };
    for (let n = 0; n < 80 && d < weit && !(r.bf && r.weiche); n++) {
      const nx = weiter(S, seg, gid); if (!nx) break;
      const t = S.gleise[nx.i];
      if (!r.bf && t.t === "b") r.bf = { i: nx.i, d: d + .5 };
      if (!r.weiche && t.t === "s" && nx.ein === weiche(t.r).stamm) r.weiche = { i: nx.i, d, st: t.st ? 1 : 0 };
      seg = nx; d += laenge(nx);
    }
    return r;
  }
  const zugFelder = z => [z.seg.i].concat(z.verlauf.map(v => v.i));
  function belegt(S, ohne) { const b = new Set(); for (const p in S.zuege) if (p !== ohne) zugFelder(S.zuege[p]).forEach(i => b.add(i)); return b; }
  function verlaufFuellen(S, z, gid) {
    const lang = zugLaenge(z) + .5; let sum = z.s, k = 0;
    while (k < z.verlauf.length && sum < lang) sum += laenge(z.verlauf[k++]);
    z.verlauf.length = k;
    let seg = z.verlauf[k - 1] || z.seg;
    while (sum < lang) { const v = zurueck(S, seg, gid); if (!v) break; z.verlauf.push(v); sum += laenge(v); seg = v; }
  }
  const istBahnhof = (S, i) => S.gleise[i] && S.gleise[i].t === "b";

  // Halt am Bahnhof: wer am letzten (anderen) Bahnhof eingestiegen ist, zahlt nach Entfernung
  function halten(S, pid, z, g, i, w, ereignisse) {
    z.halt = HALT_ZEIT;
    const vorher = z.letzterBf, strecke = z.seitBf;
    let geld = 0, leute = 0;
    if (vorher != null && vorher !== i && istBahnhof(S, vorher)) {
      leute = Math.min(w.plaetze, z.fahrgaeste || 0);
      geld = Math.round(leute * strecke * FAHRPREIS);
      if (leute) { g.stat.fahrgaeste += leute; if (haeuser(S, vorher) && haeuser(S, i)) g.stat.doerfer++; }
    }
    z.fahrgaeste = Math.min(w.plaetze, nachfrage(S, i));
    z.letzterBf = i; z.seitBf = 0;
    g.kasse += geld; g.verdient += geld;
    ereignisse.push({ art: "halt", pid, i, geld, leute, name: bahnhofName(S, i), gleicher: vorher === i });
  }
  // Lok kommt in ein neues Feld: Brücke, Tunnel, Bauwerke in der Nähe
  function neuesFeld(S, pid, z, g, i, w, ereignisse) {
    const gel = S.karte.g[i];
    if (gel === "~") g.stat.bruecke++;
    if (gel === "b") g.stat.tunnel++;
    for (const k in S.bauten) {
      const b = S.bauten[k], d = BAUTEN[b.t], rad = bauRadius(+k, b.t);
      if (abstand(+k, i) > rad) continue;
      b.zuletzt = b.zuletzt && typeof b.zuletzt === "object" ? b.zuletzt : {};
      if (z.meter - (b.zuletzt[pid] == null ? -1e9 : b.zuletzt[pid]) < (2 * rad + 3) * METER) continue;
      b.zuletzt[pid] = z.meter;
      z.kette = z.meter - (z.ketteM == null ? -1e9 : z.ketteM) < KETTE_WEG ? (z.kette || 1) + 1 : 1;
      z.ketteM = z.meter;
      g.stat.kette = Math.max(g.stat.kette, z.kette);
      if (d.schub) { z.schub = d.schub; ereignisse.push({ art: "schub", pid, i: +k, name: d.name }); continue; }
      const faktor = Math.min(2, 1 + .25 * (z.kette - 1)), geld = Math.round(d.bonus * w.geld * faktor);
      g.kasse += geld; g.verdient += geld;
      ereignisse.push({ art: "bonus", pid, i: +k, geld, name: d.name, kette: z.kette, faktor });
    }
  }

  // Ein Zeitschritt für einen Zug. andere = Felder, auf denen andere Züge stehen (davor wird angehalten).
  function zugSchritt(S, pid, dt, andere, ereignisse) {
    const z = S.zuege[pid], gid = gruppeVon(S, pid), g = S.gruppen[gid];
    if (!z || !g) return;
    if (z.schub > 0) z.schub = Math.max(0, z.schub - dt);
    if (z.halt > 0) {
      z.halt -= dt; z.v = 0;
      if (z.halt <= 0) { z.halt = 0; z.bedient = z.seg.i; }
      return;
    }
    const w = werte(z), kriech = d => Math.sqrt(2 * w.b * Math.max(0, d)) + (d > .01 ? .06 : 0);
    // Steigung: bergauf langsamer (Zugkraft hilft), bergab etwas schneller als das Höchsttempo
    const st = steigung(z.seg), zk = Math.pow(1.22, z.stufen.kraft) * 1.2 / (1 + .2 * w.wagen);
    const erlBerg = w.vmax * (st > 0 ? Math.max(.3, 1 - .4 * st / zk) : 1 + .15 * Math.min(1, -st));
    let erl = erlBerg, seg = z.seg, d = laenge(seg) - z.s;
    if (istKurve(seg)) erl = Math.min(erl, w.vk);
    if (istBahnhof(S, seg.i) && z.bedient !== seg.i && z.s < .5) erl = Math.min(erl, kriech(.5 - z.s));
    const weit = z.v * z.v / (2 * w.b) + 1.5;
    for (let n = 0; n < 80 && d < weit; n++) {
      const nx = weiter(S, seg, gid);
      if (!nx || andere.has(nx.i)) { erl = Math.min(erl, kriech(d)); break; }
      if (istKurve(nx)) erl = Math.min(erl, Math.sqrt(w.vk * w.vk + 2 * w.b * d));
      if (istBahnhof(S, nx.i)) erl = Math.min(erl, kriech(d + .5));
      seg = nx; d += laenge(nx);
    }
    const aE = w.a / (1 + Math.max(0, st) * .6 / zk) + .25 * Math.max(0, -st);
    z.v = z.v < erl ? Math.min(erl, z.v + aE * dt) : Math.max(erl, z.v - (erl === erlBerg ? Math.max(.12, .5 * Math.max(0, st)) : w.b) * dt);
    let ds = z.v * dt, weg = 0;
    z.wartet = null;
    while (ds > 0) {
      if (istBahnhof(S, z.seg.i) && z.bedient !== z.seg.i && z.s < .5 && z.s + ds >= .5) {
        weg += .5 - z.s; z.s = .5; z.v = 0; halten(S, pid, z, g, z.seg.i, w, ereignisse); break;
      }
      const rest = laenge(z.seg) - z.s;
      if (ds < rest) { z.s += ds; weg += ds; break; }
      const nx = weiter(S, z.seg, gid);
      weg += rest; z.s += rest;
      if (!nx || andere.has(nx.i)) { z.v = 0; z.wartet = nx ? "zug" : "ende"; break; }
      ds -= rest; z.verlauf.unshift(z.seg); z.seg = nx; z.s = 0;
      if (z.bedient !== nx.i) z.bedient = null;
      z.meter += rest * METER;                       // für Bauwerke schon hier zählen
      neuesFeld(S, pid, z, g, nx.i, w, ereignisse);
      z.meter -= rest * METER;
    }
    if (z.v === 0 && !z.halt && !z.wartet) { const nx = weiter(S, z.seg, gid); if (z.s >= laenge(z.seg) - 1e-6) z.wartet = !nx ? "ende" : andere.has(nx.i) ? "zug" : null; }
    g.stat.vmax = Math.max(g.stat.vmax, z.v);
    verlaufFuellen(S, z, gid);
    z.seitBf = (z.seitBf || 0) + weg;
    z.meter += weg * METER;
    const hoch = aussicht(S, z), geld = weg * w.geld * hoch;
    if (S.karte.g[z.seg.i] !== "b") g.stat.hoehe = Math.max(g.stat.hoehe || 0, Math.round(gleisHoehe(z.seg, z.s) * 10) / 10);
    g.kasse += geld; g.verdient += geld; g.meter += weg * METER;
  }
  // Ein Zeitschritt für alle Züge. Gibt { ereignisse } zurück.
  function schritt(S, dt) {
    const ereignisse = [];
    S.zeit += dt;
    for (const pid in S.zuege) zugSchritt(S, pid, dt, belegt(S, pid), ereignisse);
    return { ereignisse };
  }
  function wenden(S, pid) {
    const z = S.zuege[pid], gid = gruppeVon(S, pid);
    let seg = z.seg, s = z.s, d = zugLaenge(z), k = 0; const liste = [];
    while (d > s) { const v = z.verlauf[k++]; if (!v) { d = s; break; } liste.push(seg); d -= s; seg = v; s = laenge(v); }
    z.seg = umkehren(seg); z.s = laenge(seg) - (s - d); z.verlauf = liste.reverse().map(umkehren); z.v = 0; z.halt = 0;
    z.bedient = istBahnhof(S, z.seg.i) ? z.seg.i : null;
    verlaufFuellen(S, z, gid);
  }

  // ---------- Ziele ----------
  // Prüft alle Ziele aller Bahnen, zahlt Belohnungen aus und gibt die neu erreichten zurück: [{ gid, ziel }]
  function zielePruefen(S) {
    const neu = [];
    for (const gid in S.gruppen) {
      const g = S.gruppen[gid];
      ZIELE.forEach(z => { if (!g.ziele[z.id] && (!z.huegel || HK) && z.ok(S, g, gid)) { g.ziele[z.id] = 1; g.kasse += z.geld; neu.push({ gid, ziel: z }); } });
    }
    return neu;
  }
  const offeneZiele = (S, gid) => ZIELE.filter(z => !S.gruppen[gid].ziele[z.id] && (!z.huegel || HK));
  const alleZiele = () => ZIELE.filter(z => !z.huegel || HK);

  // ---------- Preise ----------
  const stufenPreis = (z, k) => Math.round(STUFEN[k].preis * Math.pow(STUFEN[k].faktor, z.stufen[k]) / 5) * 5;
  const gekauftesLand = (S, gid) => S.land.filter(x => x === gid).length - 4 * (S.gruppen[gid].starts || 1);
  const landPreis = (S, gid) => Math.round(LAND_PREIS * Math.pow(LAND_FAKTOR, Math.max(0, gekauftesLand(S, gid))) / 10) * 10;
  function landKaufbar(S, gid, p) {
    if (!gid || S.land[p]) return false;
    const n = B / P, c = p % n, r = p / n | 0;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => { const cc = c + dc, rr = r + dr; return cc >= 0 && rr >= 0 && cc < n && rr < n && S.land[rr * n + cc] === gid; });
  }
  // Was kostet ein Antippen mit diesem Teil? { kosten, art: "bauen" | "drehen" | "ersetzen" } oder { fehler }
  function bauInfo(S, pid, i, t) {
    if (i < 0 || i >= B * H) return { fehler: "Außerhalb der Karte." };
    if (!darf(S, pid, i)) return { fehler: besitzer(S, i) ? "Dieses Land gehört einer anderen Bahn." : "Dieses Grundstück gehört euch noch nicht." };
    const g = S.karte.g[i];
    if (g === "h") return { fehler: "Hier steht ein Dorf. Baut den Bahnhof daneben." };
    if (S.bauten[i]) return { fehler: "Hier steht schon ein Bauwerk." };
    if ((g === "~" || g === "b") && t !== "g") return { fehler: g === "~" ? "Über Wasser gehen nur Geraden (als Brücke)." : "Durch Berge gehen nur Geraden (als Tunnel)." };
    if (t === "b" && !eben(i)) return { fehler: "Bahnhöfe brauchen ebenen Boden." };
    const alt = S.gleise[i];
    if (alt && belegt(S).has(i)) return { fehler: "Hier steht gerade ein Zug." };
    if (alt && alt.t === t) return TEILE[t].lagen > 1 ? { kosten: 0, art: "drehen" } : { fehler: "Eine Kreuzung lässt sich nicht drehen." };
    if (alt) return { kosten: Math.max(0, TEILE[t].preis - Math.round(TEILE[alt.t].preis * RUECKGABE)), art: "ersetzen" };
    return { kosten: TEILE[t].preis + extra(S, i) + (g === "w" ? RODEN : 0), art: "bauen", roden: g === "w" };
  }
  function bauwerkInfo(S, pid, i, t) {
    if (!darf(S, pid, i)) return { fehler: besitzer(S, i) ? "Dieses Land gehört einer anderen Bahn." : "Dieses Grundstück gehört euch noch nicht." };
    const g = S.karte.g[i];
    if (S.gleise[i]) return { fehler: "Hier liegt ein Gleis. Bauwerke kommen neben die Strecke." };
    if (S.bauten[i]) return { fehler: "Hier steht schon ein Bauwerk." };
    if (g !== "." && g !== "w") return { fehler: "Bauwerke gehen nur auf Wiese oder Wald." };
    return { kosten: BAUTEN[t].preis + (g === "w" ? RODEN : 0), roden: g === "w" };
  }
  const roden = (S, i) => { S.karte.g = S.karte.g.slice(0, i) + "." + S.karte.g.slice(i + 1); };

  // ---------- Karte ----------
  function rauschen(z, n) {
    const g = Array.from({ length: (n + 1) * (n + 1) }, z), s = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const fx = x * n, fy = y * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = s(fx - ix), ty = s(fy - iy), o = iy * (n + 1) + ix;
      const a = g[o] + (g[o + 1] - g[o]) * tx, b = g[o + n + 1] + (g[o + n + 2] - g[o + n + 1]) * tx;
      return a + (b - a) * ty;
    };
  }
  // Startbereiche (je 2 × 2 Grundstücke) gleichmäßig verteilt; allein in der Mitte
  function startplaetze(n, anzahl, z) {
    if (anzahl === 1) return [{ c: n / 2 - 1, r: n / 2 - 1 }];
    const l = [], R = n / 2 - 2.6, w0 = z() * Math.PI * 2;
    for (let k = 0; k < anzahl; k++) {
      const w = w0 + k * Math.PI * 2 / anzahl;
      l.push({ c: Math.max(1, Math.min(n - 3, Math.round(n / 2 - 1 + R * Math.cos(w)))), r: Math.max(1, Math.min(n - 3, Math.round(n / 2 - 1 + R * Math.sin(w)))) });
    }
    return l;
  }
  function karteErzeugen(seed, anzahl) {
    const z = rng(seed), groesse = GROESSE[Math.min(anzahl, GROESSE.length - 1)];
    B = H = groesse;
    const n = B / P, starts = startplaetze(n, anzahl, z), skala = B / 64;
    const h1 = rauschen(z, Math.round(4 * skala)), h2 = rauschen(z, Math.round(9 * skala)), h3 = rauschen(z, Math.round(17 * skala)), w1 = rauschen(z, Math.round(6 * skala)), w2 = rauschen(z, Math.round(13 * skala));
    const imStart = (c, r, rand = 0) => starts.some(s => c >= s.c * P - rand && c < (s.c + 2) * P + rand && r >= s.r * P - rand && r < (s.r + 2) * P + rand);
    const g = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < B; c++) {
      const x = (c + .5) / B, y = (r + .5) / H, rand = Math.hypot(x - .5, y - .5) * 2;
      const hoehe = .55 * h1(x, y) + .3 * h2(x, y) + .15 * h3(x, y) + .28 * Math.max(0, rand - .45);
      const wald = .65 * w1(x, y) + .35 * w2(x, y);
      g.push(hoehe > .74 ? "b" : hoehe < .26 ? "~" : wald > .58 ? "w" : ".");
    }
    // Fluss von Norden nach Süden
    const links = z() < .5, phase = z() * 6.28;
    for (let r = 0; r < H; r++) {
      const mitte = Math.round((links ? .2 : .8) * B + Math.sin(r * .16 + phase) * 4 + Math.sin(r * .05 + phase * 2) * 3);
      for (let c = mitte - 1; c <= mitte; c++) if (c >= 0 && c < B && g[r * B + c] !== "b") g[r * B + c] = "~";
    }
    // Startbereiche: nur Wiese und etwas Wald, Startkreis ganz frei
    for (let r = 0; r < H; r++) for (let c = 0; c < B; c++) {
      if (!imStart(c, r)) continue;
      const x = (c + .5) / B, y = (r + .5) / H, wald = .65 * w1(x, y) + .35 * w2(x, y);
      g[r * B + c] = wald > .66 ? "w" : ".";
    }
    starts.forEach(s => { for (let r = s.r * P + 4; r < s.r * P + 11; r++) for (let c = s.c * P + 4; c < s.c * P + 11; c++) g[r * B + c] = "."; });
    // Höhen an den Ecken: aus der Höhenkarte, Startbereiche eben mit einem kleinen Hügel, Wasser auf 0, dann glätten
    const HB = B + 1, hk = new Array(HB * (H + 1));
    for (let cy = 0; cy <= H; cy++) for (let cx = 0; cx <= B; cx++) {
      const x = Math.min(.9999, cx / B), y = Math.min(.9999, cy / H), rand = Math.hypot(x - .5, y - .5) * 2;
      const hoehe = .55 * h1(x, y) + .3 * h2(x, y) + .15 * h3(x, y) + .28 * Math.max(0, rand - .45);
      hk[cy * HB + cx] = Math.max(0, Math.min(6, Math.floor((hoehe - .3) * 13)));
    }
    starts.forEach(s => {
      const x0 = s.c * P, y0 = s.r * P, L = 1;
      for (let cy = y0; cy <= y0 + 2 * P; cy++) for (let cx = x0; cx <= x0 + 2 * P; cx++) hk[cy * HB + cx] = L;
      const hx = x0 + (z() < .5 ? 3 : 13), hy = y0 + (z() < .5 ? 3 : 13);
      for (let cy = hy - 3; cy <= hy + 3; cy++) for (let cx = hx - 3; cx <= hx + 3; cx++) hk[cy * HB + cx] += Math.max(0, 2 - Math.floor(Math.hypot(cx - hx, cy - hy) / 1.5));
    });
    for (let i = 0; i < B * H; i++) if (g[i] === "~") { const c = i % B, r = i / B | 0; hk[r * HB + c] = hk[r * HB + c + 1] = hk[(r + 1) * HB + c] = hk[(r + 1) * HB + c + 1] = 0; }
    for (let weiter = true; weiter;) {
      weiter = false;
      for (let cy = 0; cy <= H; cy++) for (let cx = 0; cx <= B; cx++) {
        let m = 99;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx, y = cy + dy;
          if ((dx || dy) && x >= 0 && y >= 0 && x <= B && y <= H) m = Math.min(m, hk[y * HB + x] + 1);
        }
        if (hk[cy * HB + cx] > m) { hk[cy * HB + cx] = m; weiter = true; }
      }
    }
    // Dörfer
    const doerfer = [], namen = DORFNAMEN.slice(), soll = Math.round(7 * skala * skala);
    for (let v = 0; v < 800 && doerfer.length < soll; v++) {
      const c = 4 + Math.floor(z() * (B - 8)), r = 4 + Math.floor(z() * (H - 8));
      if (imStart(c, r, 5) || g[r * B + c] !== ".") continue;
      if (doerfer.some(d => Math.abs(d.x - c) + Math.abs(d.y - r) < 13)) continue;
      const name = namen.length ? namen.splice(Math.floor(z() * namen.length), 1)[0] : "Dorf " + (doerfer.length + 1);
      doerfer.push({ name, x: c, y: r });
      const k = 5 + Math.floor(z() * 5); let hc = c, hr = r;
      for (let j = 0; j < k * 3; j++) {
        const i = hr * B + hc;
        if ((g[i] === "." || g[i] === "w") && !imStart(hc, hr)) g[i] = "h";
        const d = DIR[Math.floor(z() * 4)]; hc = Math.max(1, Math.min(B - 2, c + d[0] * Math.floor(z() * 3) + Math.floor(z() * 3) - 1)); hr = Math.max(1, Math.min(H - 2, r + d[1] * Math.floor(z() * 3) + Math.floor(z() * 3) - 1));
      }
    }
    const K = { seed, B, H, g: g.join(""), doerfer, hoehe: hk.join("") };
    HK = K.hoehe;
    return { K, starts };
  }

  const neueGruppe = (name, pid, farbe) => ({
    name, farbe, kasse: START_KASSE, verdient: 0, meter: 0, gebaut: 0, starts: 1, mitglieder: [pid], ziele: {},
    stat: { vmax: 0, fahrgaeste: 0, doerfer: 0, bruecke: 0, tunnel: 0, kette: 0, hoehe: 0 }
  });
  const neuerZug = () => ({ seg: null, s: .5, v: 0, verlauf: [], wartet: null, stufen: { tempo: 0, kraft: 0, kurve: 0, bremse: 0, wagen: 0 },
    halt: 0, bedient: null, letzterBf: null, seitBf: 0, fahrgaeste: 0, schub: 0, kette: 0, ketteM: null, meter: 0 });
  const bahnName = name => (!name ? "Bahn" : /[sßxz]$/i.test(name) ? name + "’ Bahn" : name + "s Bahn");

  // Neue Welt. spieler = [{ pid, name }]; jeder bekommt Startbereich, Gleiskreis, Zug und Kasse.
  function neu(seed, spieler) {
    seed = seed == null ? Math.floor(Math.random() * 1e9) : seed;
    spieler = (spieler && spieler.length ? spieler : [{ pid: "ich", name: "" }]).slice(0, MAX_SPIELER);
    const { K, starts } = karteErzeugen(seed, spieler.length), n = B / P;
    const S = { v: 3, spiel: "gleisgenossen", seed, karte: K, land: Array(n * n).fill(null), gleise: {}, bauten: {},
      spieler: {}, gruppen: {}, zuege: {}, einladungen: [], zeit: 0, gNr: 0 };
    spieler.forEach((sp, k) => {
      const gid = "g" + (S.gNr++), st = starts[k], farbe = k % FARBEN.length;
      S.gruppen[gid] = neueGruppe(bahnName(sp.name), sp.pid, farbe);
      S.spieler[sp.pid] = { name: sp.name || "Spieler " + (k + 1), gruppe: gid, farbe, start: { x: st.c * P + 7.5, y: st.r * P + 7.5 } };
      for (let r = st.r; r < st.r + 2; r++) for (let c = st.c; c < st.c + 2; c++) S.land[r * n + c] = gid;
      // Startkreis: 3 × 3 Felder in der Mitte des Startbereichs
      const x0 = st.c * P + 6, y0 = st.r * P + 6, at = (c, r) => r * B + c;
      Object.assign(S.gleise, {
        [at(x0, y0)]: { t: "k", r: 1 }, [at(x0 + 1, y0)]: { t: "g", r: 1 }, [at(x0 + 2, y0)]: { t: "k", r: 2 },
        [at(x0, y0 + 1)]: { t: "g", r: 0 }, [at(x0 + 2, y0 + 1)]: { t: "g", r: 0 },
        [at(x0, y0 + 2)]: { t: "k", r: 0 }, [at(x0 + 1, y0 + 2)]: { t: "g", r: 1 }, [at(x0 + 2, y0 + 2)]: { t: "k", r: 3 }
      });
      const z = S.zuege[sp.pid] = neuerZug();
      z.seg = { i: at(x0 + 1, y0), ein: 3, aus: 1 };
      verlaufFuellen(S, z, gid);
    });
    return S;
  }

  // Spielstände aus Schritt 1 und 2 (eine Bahn, Land als "0"/"1") umbauen; Karte setzen
  function auffrischen(S, pid) {
    karteSetzen(S.karte);
    if (!S.gruppen) {
      const p = pid || "ich", alt = S;
      const g = neueGruppe(bahnName(""), p, 0);
      Object.assign(g, { kasse: alt.kasse, verdient: alt.verdient || 0, meter: alt.meter || 0, gebaut: alt.gebaut || 0, ziele: alt.ziele || {} });
      Object.assign(g.stat, alt.stat || {});
      const z = Object.assign(neuerZug(), alt.zug, { meter: alt.meter || 0 });
      const land = typeof alt.land === "string" ? alt.land.split("").map(x => x === "1" ? "g0" : null) : alt.land;
      ["kasse", "verdient", "meter", "gebaut", "ziele", "stat", "zug"].forEach(k => delete S[k]);
      Object.assign(S, { v: 3, land, bauten: S.bauten || {}, gruppen: { g0: g }, zuege: { [p]: z }, einladungen: [], gNr: 1,
        spieler: { [p]: { name: "", gruppe: "g0", farbe: 0, start: { x: z.seg.i % B + .5, y: (z.seg.i / B | 0) + .5 } } } });
    }
    for (const k in S.bauten) if (typeof S.bauten[k].zuletzt !== "object") S.bauten[k].zuletzt = {};
    for (const p in S.zuege) if (typeof S.zuege[p].wartet === "boolean") S.zuege[p].wartet = S.zuege[p].wartet ? "ende" : null;
    S.einladungen = S.einladungen || [];
    for (const gid in S.gruppen) S.gruppen[gid].stat.hoehe = S.gruppen[gid].stat.hoehe || 0;
    return S;
  }
  // Ein neues Gerät übernimmt den Platz eines Spielers (z. B. beim Fortsetzen eines gespeicherten Spiels)
  function platzUebernehmen(S, alt, neuPid, name) {
    if (!S.spieler[alt] || S.spieler[neuPid]) return false;
    S.spieler[neuPid] = S.spieler[alt]; delete S.spieler[alt];
    if (name) S.spieler[neuPid].name = name;
    S.zuege[neuPid] = S.zuege[alt]; delete S.zuege[alt];
    for (const gid in S.gruppen) S.gruppen[gid].mitglieder = S.gruppen[gid].mitglieder.map(p => p === alt ? neuPid : p);
    return true;
  }

  // ---------- Aktionen (alles, was Spieler auslösen) ----------
  // aktion(S, pid, m) gibt { ok: true, … } oder { fehler } zurück und ändert S nur im Erfolgsfall.
  function aktion(S, pid, m) {
    const nein = fehler => ({ fehler });
    const gid = gruppeVon(S, pid), g = gid && S.gruppen[gid], z = S.zuege[pid];
    if (!g) return nein("Du spielst in dieser Welt nicht mit.");
    const zahlen = k => { if (g.kasse < k) return false; g.kasse -= k; return true; };
    const fehlt = k => nein("Dafür fehlen noch " + Math.ceil(k - g.kasse) + " T.");
    switch (m.typ) {
      case "bauen": {
        if (!TEILE[m.t]) return nein("Unbekanntes Teil.");
        const info = bauInfo(S, pid, m.i, m.t);
        if (info.fehler) return info;
        if (g.kasse < info.kosten) return fehlt(info.kosten);
        zahlen(info.kosten);
        if (info.art === "drehen") { const t = S.gleise[m.i]; t.r = (t.r + 1) % TEILE[t.t].lagen; return { ok: true, art: "drehen" }; }
        S.gleise[m.i] = { t: m.t, r: besteLage(S, m.i, m.t) };
        if (m.t === "s") S.gleise[m.i].st = 0;
        if (info.roden) roden(S, m.i);
        if (info.art === "bauen") g.gebaut++;
        return { ok: true, art: info.art, kosten: info.kosten };
      }
      case "weiche": {
        const t = S.gleise[m.i];
        if (!t || t.t !== "s") return nein("Hier ist keine Weiche.");
        if (!darf(S, pid, m.i)) return nein("Diese Weiche gehört einer anderen Bahn.");
        t.st = t.st ? 0 : 1;
        return { ok: true, st: t.st };
      }
      case "bauwerk": {
        if (!BAUTEN[m.t]) return nein("Unbekanntes Bauwerk.");
        const info = bauwerkInfo(S, pid, m.i, m.t);
        if (info.fehler) return info;
        if (!zahlen(info.kosten)) return fehlt(info.kosten);
        if (info.roden) roden(S, m.i);
        S.bauten[m.i] = { t: m.t, zuletzt: {} };
        return { ok: true };
      }
      case "abreissen": {
        if (!darf(S, pid, m.i)) return nein(besitzer(S, m.i) ? "Das gehört einer anderen Bahn." : "Hier ist nichts zum Abreißen.");
        if (S.bauten[m.i]) {
          const geld = Math.round(BAUTEN[S.bauten[m.i].t].preis * RUECKGABE);
          delete S.bauten[m.i]; g.kasse += geld;
          return { ok: true, geld };
        }
        if (!S.gleise[m.i]) return nein("Hier ist nichts zum Abreißen.");
        if (belegt(S).has(m.i)) return nein("Hier steht gerade ein Zug.");
        const geld = Math.round(teilWert(S, m.i) * RUECKGABE);
        delete S.gleise[m.i];
        for (const p in S.zuege) if (S.zuege[p].letzterBf === m.i) S.zuege[p].letzterBf = null;
        g.kasse += geld;
        return { ok: true, geld };
      }
      case "stufe": {
        const st = STUFEN[m.k]; if (!st || !z) return nein("Unbekannte Verbesserung.");
        if (z.stufen[m.k] >= st.max) return nein("Schon ganz ausgebaut.");
        const k = stufenPreis(z, m.k);
        if (!zahlen(k)) return fehlt(k);
        z.stufen[m.k]++;
        if (m.k === "wagen") verlaufFuellen(S, z, gid);
        return { ok: true };
      }
      case "land": {
        if (!landKaufbar(S, gid, m.p)) return nein(S.land[m.p] === gid ? "Gehört euch schon." : S.land[m.p] ? "Gehört einer anderen Bahn." : "Kaufen geht nur neben eigenem Land.");
        const k = landPreis(S, gid);
        if (!zahlen(k)) return fehlt(k);
        S.land[m.p] = gid;
        return { ok: true };
      }
      case "wenden": if (!z) return nein("Kein Zug."); wenden(S, pid); return { ok: true };
      case "einladen": {
        if (!S.gruppen[m.an] || m.an === gid) return nein("Diese Bahn gibt es nicht.");
        if (S.einladungen.some(e => e.von === gid && e.an === m.an)) return nein("Die Einladung ist schon unterwegs.");
        const gegen = S.einladungen.find(e => e.von === m.an && e.an === gid);
        if (gegen) return aktion(S, pid, { typ: "annehmen", von: m.an });
        S.einladungen.push({ von: gid, an: m.an, wer: pid });
        return { ok: true };
      }
      case "ablehnen": {
        const vor = S.einladungen.length;
        S.einladungen = S.einladungen.filter(e => !((e.von === m.von && e.an === gid) || (e.von === gid && e.an === m.von)));
        return vor === S.einladungen.length ? nein("Keine Einladung.") : { ok: true };
      }
      case "annehmen": {
        if (!S.einladungen.some(e => e.von === m.von && e.an === gid) || !S.gruppen[m.von]) return nein("Keine Einladung von dieser Bahn.");
        const ziel = S.gruppen[m.von], weg = g;
        // Die einladende Bahn nimmt die andere auf
        ziel.kasse += weg.kasse; ziel.verdient += weg.verdient; ziel.meter += weg.meter; ziel.gebaut += weg.gebaut; ziel.starts += weg.starts;
        ziel.mitglieder = ziel.mitglieder.concat(weg.mitglieder);
        Object.assign(ziel.ziele, weg.ziele);
        for (const k in ziel.stat) ziel.stat[k] = ["vmax", "kette", "hoehe"].includes(k) ? Math.max(ziel.stat[k] || 0, weg.stat[k] || 0) : (ziel.stat[k] || 0) + (weg.stat[k] || 0);
        weg.mitglieder.forEach(p => { if (S.spieler[p]) S.spieler[p].gruppe = m.von; });
        S.land = S.land.map(x => x === gid ? m.von : x);
        ziel.name = "Genossenschaft " + ziel.mitglieder.map(p => S.spieler[p] ? S.spieler[p].name : "?").join(", ");
        delete S.gruppen[gid];
        S.einladungen = S.einladungen.filter(e => e.von !== gid && e.an !== gid);
        return { ok: true, gruppe: m.von };
      }
    }
    return nein("Unbekannte Aktion.");
  }

  const GG = {
    P, METER, MAX_SPIELER, FARBEN, TEILE, BAUTEN, STUFEN, ZIELE, GELAENDE, DIR, LOK_L, WAGEN_L, BRUECKE, TUNNEL, RODEN, PLAETZE, FAHRPREIS,
    neu, auffrischen, karteSetzen, platzUebernehmen, aktion, schritt, werte, kmh, wagenlage, belegt, bauInfo, bauwerkInfo, besteLage,
    paare, weiche, punkt, laenge, stufenPreis, landPreis, landKaufbar, parzelle, besitzer, besitzt, darf, gruppeVon, kopie,
    zielePruefen, offeneZiele, alleZiele, nachfrage, haeuser, bahnhofName, abstand, gekauftesLand,
    AUSSICHT, vorne, voraus, ecke, kantenHoehe, gleisHoehe, steigung, gelaendeHoehe, feldHoehe, eben, anhoehe, bauRadius, aussicht
  };
  Object.defineProperty(GG, "B", { get: () => B });
  Object.defineProperty(GG, "H", { get: () => H });
  if (typeof module !== "undefined") module.exports = GG; else window.GG = GG;
})();
