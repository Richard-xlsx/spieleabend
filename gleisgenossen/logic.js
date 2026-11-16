// Gleisgenossen: Spielregeln ohne Netzwerk und ohne Oberfläche.
// Offene Welt im Quadratraster. Ein Zug fährt auf einem Gleiskreis, jeder Meter bringt Geld (Taler, T).
// Davon kauft die Genossenschaft (gemeinsame Kasse) Gleisteile, Bauwerke, Land und Verbesserungen für den Zug.
// Ein Feld = 10 m. Seiten eines Feldes: 0 = Norden, 1 = Osten, 2 = Süden, 3 = Westen.
(function () {
  const B = 64, H = 64, P = 8;                 // Karte in Feldern, Grundstücke zu P × P Feldern
  const METER = 10, START_KASSE = 80;
  const TEILE = {
    g: { name: "Gerade", preis: 20, lagen: 2 },
    k: { name: "Kurve", preis: 25, lagen: 4 },
    s: { name: "Weiche", preis: 80, lagen: 8 },
    x: { name: "Kreuzung", preis: 60, lagen: 1 },
    b: { name: "Bahnhof", preis: 150, lagen: 2 }
  };
  const BRUECKE = 100, TUNNEL = 180, RODEN = 15, RUECKGABE = .5;
  const LAND_PREIS = 300, LAND_FAKTOR = 1.45;
  // Bauwerke neben der Strecke: Wirkung, wenn die Lok im Umkreis vorbeifährt (einmal pro Durchfahrt).
  // bonus = so viele Felder Fahrgeld extra; Kette: mehrere Bauwerke kurz hintereinander geben mehr (bis × 2).
  const BAUTEN = {
    turm: { name: "Wasserturm", preis: 150, radius: 1, schub: 20, text: "Zug fährt 20 s lang 30 % schneller" },
    muehle: { name: "Windmühle", preis: 300, radius: 2, bonus: 8, text: "Bonus bei jeder Durchfahrt" },
    burg: { name: "Burg", preis: 900, radius: 3, bonus: 20, text: "großer Bonus bei jeder Durchfahrt" },
    rad: { name: "Riesenrad", preis: 2200, radius: 3, bonus: 45, text: "sehr großer Bonus bei jeder Durchfahrt" }
  };
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
  const DORFNAMEN = ["Lindenau", "Mühlbach", "Großfurt", "Eichstedt", "Birkenhain", "Steinbrück", "Talheim", "Rabenau", "Wiesental", "Kranichfeld"];
  // Ziele: der Reihe nach angezeigt, jedes zählt aber, sobald es erfüllt ist
  const ZIELE = [
    { id: "km1", text: "Fahrt 1 km", geld: 60, ok: S => S.meter >= 1000 },
    { id: "teile10", text: "Baut 10 Gleisteile", geld: 100, ok: S => S.gebaut >= 10 },
    { id: "tempo50", text: "Erreicht 50 km/h", geld: 120, ok: S => kmh(S.stat.vmax) >= 50 },
    { id: "bahnhof", text: "Baut einen Bahnhof", geld: 150, ok: S => Object.values(S.gleise).some(g => g.t === "b") },
    { id: "fahrgaeste", text: "Bringt Fahrgäste von einem Bahnhof zu einem anderen", geld: 250, ok: S => S.stat.fahrgaeste > 0 },
    { id: "land1", text: "Kauft ein Grundstück dazu", geld: 150, ok: S => gekauftesLand(S) >= 1 },
    { id: "weiche", text: "Baut eine Weiche", geld: 100, ok: S => Object.values(S.gleise).some(g => g.t === "s") },
    { id: "bauwerk", text: "Stellt ein Bauwerk an die Strecke", geld: 150, ok: S => Object.keys(S.bauten).length > 0 },
    { id: "dorf2", text: "Verbindet zwei Dörfer mit Bahnhöfen", geld: 500, ok: S => S.stat.doerfer > 0 },
    { id: "bruecke", text: "Fahrt über eine Brücke", geld: 300, ok: S => S.stat.bruecke > 0 },
    { id: "tunnel", text: "Fahrt durch einen Tunnel", geld: 400, ok: S => S.stat.tunnel > 0 },
    { id: "wagen3", text: "Hängt 3 Wagen an", geld: 600, ok: S => 1 + S.zug.stufen.wagen >= 3 },
    { id: "kette3", text: "Fahrt an 3 Bauwerken kurz hintereinander vorbei", geld: 600, ok: S => S.stat.kette >= 3 },
    { id: "tempo100", text: "Erreicht 100 km/h", geld: 1500, ok: S => kmh(S.stat.vmax) >= 100 },
    { id: "km50", text: "Fahrt 50 km", geld: 1500, ok: S => S.meter >= 50000 },
    { id: "land6", text: "Kauft 6 Grundstücke dazu", geld: 2500, ok: S => gekauftesLand(S) >= 6 }
  ];

  const kopie = o => JSON.parse(JSON.stringify(o));
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // ---------- Raster ----------
  const nb = (i, s) => { const c = i % B + DIR[s][0], r = (i / B | 0) + DIR[s][1]; return c < 0 || r < 0 || c >= B || r >= H ? -1 : r * B + c; };
  const parzelle = i => ((i / B | 0) / P | 0) * (B / P) + ((i % B) / P | 0);
  const besitzt = (S, i) => S.land[parzelle(i)] === "1";
  const abstand = (a, b) => Math.max(Math.abs(a % B - b % B), Math.abs((a / B | 0) - (b / B | 0)));

  // ---------- Gleisteile ----------
  // Weiche (r = 0…7): Stamm, gerader Zweig, abzweigender Zweig; r ≥ 4 = gespiegelt
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
  function weiter(S, seg) {
    const j = nb(seg.i, seg.aus), t = j >= 0 && S.gleise[j]; if (!t) return null;
    const ein = (seg.aus + 2) % 4, aus = ausgang(t, ein);
    return aus < 0 ? null : { i: j, ein, aus };
  }
  function zurueck(S, seg) {
    const j = nb(seg.i, seg.ein), t = j >= 0 && S.gleise[j]; if (!t) return null;
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

  // ---------- Zug ----------
  function werte(S) {
    const st = S.zug.stufen, wagen = 1 + st.wagen;
    return {
      vmax: (1 + .3 * st.tempo) * (S.zug.schub > 0 ? 1.3 : 1),   // Felder pro Sekunde (1 = 36 km/h)
      vk: .7 + .12 * st.kurve,
      a: .35 * Math.pow(1.22, st.kraft) / (1 + .2 * wagen),
      b: .5 * Math.pow(1.22, st.bremse),
      wagen, plaetze: PLAETZE * wagen, geld: 2 + wagen               // Taler pro gefahrenem Feld (10 m)
    };
  }
  const kmh = v => Math.round(v * METER * 3.6);
  const zugLaenge = S => LOK_L + (1 + S.zug.stufen.wagen) * (LUECKE + WAGEN_L);
  // Punkt d Felder hinter der Zugspitze
  function hinten(S, d) {
    const z = S.zug; let seg = z.seg, s = z.s, k = 0;
    while (d > s) { const v = z.verlauf[k++]; if (!v) return punkt(seg, 0); d -= s; seg = v; s = laenge(v); }
    return punkt(seg, s - d);
  }
  // Lok und Wagen: Mitte und Richtung (Winkel in der x-y-Ebene)
  function wagenlage(S) {
    const l = [], n = 1 + S.zug.stufen.wagen; let d = 0;
    for (let k = 0; k <= n; k++) {
      const len = k ? WAGEN_L : LOK_L, v = hinten(S, d), h = hinten(S, d + len);
      l.push({ x: (v.x + h.x) / 2, y: (v.y + h.y) / 2, w: Math.atan2(v.y - h.y, v.x - h.x), lok: !k });
      d += len + LUECKE;
    }
    return l;
  }
  function belegt(S) { const b = new Set([S.zug.seg.i]); S.zug.verlauf.forEach(v => b.add(v.i)); return b; }
  function verlaufFuellen(S) {
    const z = S.zug, lang = zugLaenge(S) + .5; let sum = z.s, k = 0;
    while (k < z.verlauf.length && sum < lang) sum += laenge(z.verlauf[k++]);
    z.verlauf.length = k;
    let seg = z.verlauf[k - 1] || z.seg;
    while (sum < lang) { const v = zurueck(S, seg); if (!v) break; z.verlauf.push(v); sum += laenge(v); seg = v; }
  }
  const istBahnhof = (S, i) => S.gleise[i] && S.gleise[i].t === "b";

  // Halt am Bahnhof: wer am letzten (anderen) Bahnhof eingestiegen ist, zahlt nach Entfernung
  function halten(S, i, w, ereignisse) {
    const z = S.zug; z.halt = HALT_ZEIT;
    const vorher = z.letzterBf, strecke = z.seitBf;
    let geld = 0, leute = 0;
    if (vorher != null && vorher !== i && istBahnhof(S, vorher)) {
      leute = Math.min(w.plaetze, z.fahrgaeste || 0);
      geld = Math.round(leute * strecke * FAHRPREIS);
      if (leute) { S.stat.fahrgaeste += leute; if (haeuser(S, vorher) && haeuser(S, i)) S.stat.doerfer++; }
    }
    z.fahrgaeste = Math.min(w.plaetze, nachfrage(S, i));
    z.letzterBf = i; z.seitBf = 0;
    S.kasse += geld; S.verdient += geld;
    ereignisse.push({ art: "halt", i, geld, leute, name: bahnhofName(S, i), gleicher: vorher === i });
  }
  // Lok kommt in ein neues Feld: Brücke, Tunnel, Bauwerke in der Nähe
  function neuesFeld(S, i, w, ereignisse) {
    const g = S.karte.g[i];
    if (g === "~") S.stat.bruecke++;
    if (g === "b") S.stat.tunnel++;
    for (const k in S.bauten) {
      const b = S.bauten[k], d = BAUTEN[b.t];
      if (abstand(+k, i) > d.radius || S.meter - (b.zuletzt == null ? -1e9 : b.zuletzt) < (2 * d.radius + 3) * METER) continue;
      b.zuletzt = S.meter;
      const z = S.zug;
      z.kette = S.meter - (z.ketteM == null ? -1e9 : z.ketteM) < KETTE_WEG ? (z.kette || 1) + 1 : 1;
      z.ketteM = S.meter;
      S.stat.kette = Math.max(S.stat.kette, z.kette);
      if (d.schub) { z.schub = d.schub; ereignisse.push({ art: "schub", i: +k, name: d.name }); continue; }
      const faktor = Math.min(2, 1 + .25 * (z.kette - 1)), geld = Math.round(d.bonus * w.geld * faktor);
      S.kasse += geld; S.verdient += geld;
      ereignisse.push({ art: "bonus", i: +k, geld, name: d.name, kette: z.kette, faktor });
    }
  }

  // Ein Zeitschritt (dt in Sekunden). Gibt { geld, ereignisse } zurück.
  function schritt(S, dt) {
    const z = S.zug, ereignisse = [];
    S.zeit += dt;
    if (z.schub > 0) z.schub = Math.max(0, z.schub - dt);
    if (z.halt > 0) {
      z.halt -= dt; z.v = 0;
      if (z.halt <= 0) { z.halt = 0; z.bedient = z.seg.i; }
      return { geld: 0, ereignisse };
    }
    const w = werte(S), kriech = d => Math.sqrt(2 * w.b * Math.max(0, d)) + (d > .01 ? .06 : 0);
    let erl = w.vmax, seg = z.seg, d = laenge(seg) - z.s;
    if (istKurve(seg)) erl = Math.min(erl, w.vk);
    if (istBahnhof(S, seg.i) && z.bedient !== seg.i && z.s < .5) erl = Math.min(erl, kriech(.5 - z.s));
    const weit = z.v * z.v / (2 * w.b) + 1.5;
    for (let n = 0; n < 80 && d < weit; n++) {
      const nx = weiter(S, seg);
      if (!nx) { erl = Math.min(erl, kriech(d)); break; }
      if (istKurve(nx)) erl = Math.min(erl, Math.sqrt(w.vk * w.vk + 2 * w.b * d));
      if (istBahnhof(S, nx.i)) erl = Math.min(erl, kriech(d + .5));
      seg = nx; d += laenge(nx);
    }
    z.v = z.v < erl ? Math.min(erl, z.v + w.a * dt) : Math.max(erl, z.v - w.b * dt);
    let ds = z.v * dt, weg = 0, ende = false;
    while (ds > 0) {
      if (istBahnhof(S, z.seg.i) && z.bedient !== z.seg.i && z.s < .5 && z.s + ds >= .5) {
        weg += .5 - z.s; z.s = .5; z.v = 0; halten(S, z.seg.i, w, ereignisse); break;
      }
      const rest = laenge(z.seg) - z.s;
      if (ds < rest) { z.s += ds; weg += ds; break; }
      const nx = weiter(S, z.seg);
      weg += rest; z.s += rest;
      if (!nx) { z.v = 0; ende = true; break; }
      ds -= rest; z.verlauf.unshift(z.seg); z.seg = nx; z.s = 0;
      if (z.bedient !== nx.i) z.bedient = null;
      neuesFeld(S, nx.i, w, ereignisse);
    }
    z.wartet = ende;
    S.stat.vmax = Math.max(S.stat.vmax, z.v);
    verlaufFuellen(S);
    z.seitBf = (z.seitBf || 0) + weg;
    const geld = weg * w.geld;
    S.kasse += geld; S.verdient += geld; S.meter += weg * METER;
    return { geld, ereignisse };
  }
  function wenden(S) {
    const z = S.zug; let seg = z.seg, s = z.s, d = zugLaenge(S), k = 0; const liste = [];
    while (d > s) { const v = z.verlauf[k++]; if (!v) { d = s; break; } liste.push(seg); d -= s; seg = v; s = laenge(v); }
    z.seg = umkehren(seg); z.s = laenge(seg) - (s - d); z.verlauf = liste.reverse().map(umkehren); z.v = 0; z.halt = 0;
    z.bedient = istBahnhof(S, z.seg.i) ? z.seg.i : null;
    verlaufFuellen(S);
  }

  // ---------- Ziele ----------
  // Prüft alle Ziele, zahlt Belohnungen aus und gibt die neu erreichten zurück
  function zielePruefen(S) {
    const neu = [];
    ZIELE.forEach(z => { if (!S.ziele[z.id] && z.ok(S)) { S.ziele[z.id] = 1; S.kasse += z.geld; neu.push(z); } });
    return neu;
  }
  const offeneZiele = S => ZIELE.filter(z => !S.ziele[z.id]);

  // ---------- Preise ----------
  const stufenPreis = (S, k) => Math.round(STUFEN[k].preis * Math.pow(STUFEN[k].faktor, S.zug.stufen[k]) / 5) * 5;
  const gekauftesLand = S => S.land.split("").filter(x => x === "1").length - 4;
  const landPreis = S => Math.round(LAND_PREIS * Math.pow(LAND_FAKTOR, gekauftesLand(S)) / 10) * 10;
  function landKaufbar(S, p) {
    if (S.land[p] === "1") return false;
    const n = B / P, c = p % n, r = p / n | 0;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => { const cc = c + dc, rr = r + dr; return cc >= 0 && rr >= 0 && cc < n && rr < n && S.land[rr * n + cc] === "1"; });
  }
  // Was kostet ein Antippen mit diesem Teil? { kosten, art: "bauen" | "drehen" | "ersetzen" } oder { fehler }
  function bauInfo(S, i, t) {
    if (i < 0 || i >= B * H) return { fehler: "Außerhalb der Karte." };
    if (!besitzt(S, i)) return { fehler: "Dieses Grundstück gehört euch noch nicht." };
    const g = S.karte.g[i];
    if (g === "h") return { fehler: "Hier steht ein Dorf. Baut den Bahnhof daneben." };
    if (S.bauten[i]) return { fehler: "Hier steht schon ein Bauwerk." };
    if ((g === "~" || g === "b") && t !== "g") return { fehler: g === "~" ? "Über Wasser gehen nur Geraden (als Brücke)." : "Durch Berge gehen nur Geraden (als Tunnel)." };
    const alt = S.gleise[i];
    if (alt && belegt(S).has(i)) return { fehler: "Hier steht gerade der Zug." };
    if (alt && alt.t === t) return TEILE[t].lagen > 1 ? { kosten: 0, art: "drehen" } : { fehler: "Eine Kreuzung lässt sich nicht drehen." };
    if (alt) return { kosten: Math.max(0, TEILE[t].preis - Math.round(TEILE[alt.t].preis * RUECKGABE)), art: "ersetzen" };
    return { kosten: TEILE[t].preis + extra(S, i) + (g === "w" ? RODEN : 0), art: "bauen", roden: g === "w", bruecke: g === "~", tunnel: g === "b" };
  }
  function bauwerkInfo(S, i, t) {
    if (!besitzt(S, i)) return { fehler: "Dieses Grundstück gehört euch noch nicht." };
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
  function karteErzeugen(seed) {
    const z = rng(seed), h1 = rauschen(z, 4), h2 = rauschen(z, 9), h3 = rauschen(z, 17), w1 = rauschen(z, 6), w2 = rauschen(z, 13);
    const g = [], start = (c, r) => c >= 24 && c < 40 && r >= 24 && r < 40;
    for (let r = 0; r < H; r++) for (let c = 0; c < B; c++) {
      const x = (c + .5) / B, y = (r + .5) / H, rand = Math.hypot(x - .5, y - .5) * 2;
      const hoehe = .55 * h1(x, y) + .3 * h2(x, y) + .15 * h3(x, y) + .28 * Math.max(0, rand - .45);
      const wald = .65 * w1(x, y) + .35 * w2(x, y);
      let f = hoehe > .74 ? "b" : hoehe < .26 ? "~" : wald > .58 ? "w" : ".";
      if (start(c, r)) f = wald > .66 ? "w" : ".";
      g.push(f);
    }
    // Fluss an einer Seite von Norden nach Süden, um das Startland herum
    const links = z() < .5, phase = z() * 6.28;
    for (let r = 0; r < H; r++) {
      const mitte = (links ? 13 : 50) + Math.round(Math.sin(r * .16 + phase) * 4 + Math.sin(r * .05 + phase * 2) * 3);
      for (let c = mitte - 1; c <= mitte; c++) if (c >= 0 && c < B && g[r * B + c] !== "b") g[r * B + c] = "~";
    }
    // Startkreis frei halten
    for (let r = 28; r < 35; r++) for (let c = 28; c < 35; c++) g[r * B + c] = ".";
    // Dörfer
    const doerfer = [], namen = DORFNAMEN.slice();
    for (let v = 0; v < 400 && doerfer.length < 7; v++) {
      const c = 4 + Math.floor(z() * (B - 8)), r = 4 + Math.floor(z() * (H - 8));
      if (start(c, r) || Math.abs(c - 32) + Math.abs(r - 32) < 14 || g[r * B + c] !== ".") continue;
      if (doerfer.some(d => Math.abs(d.x - c) + Math.abs(d.y - r) < 13)) continue;
      const name = namen.splice(Math.floor(z() * namen.length), 1)[0];
      doerfer.push({ name, x: c, y: r });
      const n = 5 + Math.floor(z() * 5); let hc = c, hr = r;
      for (let k = 0; k < n * 3; k++) {
        const i = hr * B + hc;
        if (g[i] === "." || g[i] === "w") g[i] = "h";
        const d = DIR[Math.floor(z() * 4)]; hc = Math.max(1, Math.min(B - 2, c + d[0] * Math.floor(z() * 3) + Math.floor(z() * 3) - 1)); hr = Math.max(1, Math.min(H - 2, r + d[1] * Math.floor(z() * 3) + Math.floor(z() * 3) - 1));
      }
    }
    return { seed, B, H, g: g.join(""), doerfer };
  }

  // Fehlende Felder ergänzen (Spielstände aus Schritt 1)
  function auffrischen(S) {
    S.bauten = S.bauten || {};
    S.ziele = S.ziele || {};
    S.stat = Object.assign({ vmax: 0, fahrgaeste: 0, doerfer: 0, bruecke: 0, tunnel: 0, kette: 0 }, S.stat || {});
    Object.assign(S.zug, Object.assign({ halt: 0, bedient: null, letzterBf: null, seitBf: 0, fahrgaeste: 0, schub: 0, kette: 0, ketteM: null }, S.zug));
    return S;
  }
  function neu(seed) {
    seed = seed == null ? Math.floor(Math.random() * 1e9) : seed;
    const n = B / P, land = Array.from({ length: n * n }, (_, p) => (p % n === 3 || p % n === 4) && ((p / n | 0) === 3 || (p / n | 0) === 4) ? "1" : "0").join("");
    const S = {
      v: 2, spiel: "gleisgenossen", seed, kasse: START_KASSE, karte: karteErzeugen(seed), land, gleise: {}, bauten: {},
      zug: { seg: null, s: .5, v: 0, verlauf: [], wartet: false, stufen: { tempo: 0, kraft: 0, kurve: 0, bremse: 0, wagen: 0 } },
      meter: 0, verdient: 0, zeit: 0, gebaut: 0, ziele: {}
    };
    // Startkreis: 3 × 3 Felder um die Kartenmitte, 4 Kurven und 4 Geraden
    const at = (c, r) => r * B + c;
    Object.assign(S.gleise, {
      [at(30, 30)]: { t: "k", r: 1 }, [at(31, 30)]: { t: "g", r: 1 }, [at(32, 30)]: { t: "k", r: 2 },
      [at(30, 31)]: { t: "g", r: 0 }, [at(32, 31)]: { t: "g", r: 0 },
      [at(30, 32)]: { t: "k", r: 0 }, [at(31, 32)]: { t: "g", r: 1 }, [at(32, 32)]: { t: "k", r: 3 }
    });
    S.zug.seg = { i: at(31, 30), ein: 3, aus: 1 };
    auffrischen(S);
    verlaufFuellen(S);
    return S;
  }

  // ---------- Aktionen (alles, was Spieler auslösen) ----------
  // Gibt { ok: true, … } oder { fehler } zurück und ändert S nur im Erfolgsfall.
  function aktion(S, m) {
    const nein = fehler => ({ fehler });
    const zahlen = k => { if (S.kasse < k) return false; S.kasse -= k; return true; };
    const fehlt = k => nein("Dafür fehlen noch " + Math.ceil(k - S.kasse) + " T.");
    switch (m.typ) {
      case "bauen": {
        if (!TEILE[m.t]) return nein("Unbekanntes Teil.");
        const info = bauInfo(S, m.i, m.t);
        if (info.fehler) return info;
        if (S.kasse < info.kosten) return fehlt(info.kosten);
        zahlen(info.kosten);
        if (info.art === "drehen") { const g = S.gleise[m.i]; g.r = (g.r + 1) % TEILE[g.t].lagen; return { ok: true, art: "drehen" }; }
        S.gleise[m.i] = { t: m.t, r: besteLage(S, m.i, m.t) };
        if (m.t === "s") S.gleise[m.i].st = 0;
        if (info.roden) roden(S, m.i);
        if (info.art === "bauen") S.gebaut++;
        return { ok: true, art: info.art, kosten: info.kosten };
      }
      case "weiche": {
        const g = S.gleise[m.i];
        if (!g || g.t !== "s") return nein("Hier ist keine Weiche.");
        g.st = g.st ? 0 : 1;
        return { ok: true, st: g.st };
      }
      case "bauwerk": {
        if (!BAUTEN[m.t]) return nein("Unbekanntes Bauwerk.");
        const info = bauwerkInfo(S, m.i, m.t);
        if (info.fehler) return info;
        if (!zahlen(info.kosten)) return fehlt(info.kosten);
        if (info.roden) roden(S, m.i);
        S.bauten[m.i] = { t: m.t };
        return { ok: true };
      }
      case "abreissen": {
        if (S.bauten[m.i]) {
          const geld = Math.round(BAUTEN[S.bauten[m.i].t].preis * RUECKGABE);
          delete S.bauten[m.i]; S.kasse += geld;
          return { ok: true, geld };
        }
        if (!S.gleise[m.i]) return nein("Hier ist nichts zum Abreißen.");
        if (belegt(S).has(m.i)) return nein("Hier steht gerade der Zug.");
        const geld = Math.round(teilWert(S, m.i) * RUECKGABE);
        delete S.gleise[m.i];
        if (S.zug.letzterBf === m.i) S.zug.letzterBf = null;
        S.kasse += geld;
        return { ok: true, geld };
      }
      case "stufe": {
        const st = STUFEN[m.k]; if (!st) return nein("Unbekannte Verbesserung.");
        if (S.zug.stufen[m.k] >= st.max) return nein("Schon ganz ausgebaut.");
        const k = stufenPreis(S, m.k);
        if (!zahlen(k)) return fehlt(k);
        S.zug.stufen[m.k]++;
        if (m.k === "wagen") verlaufFuellen(S);
        return { ok: true };
      }
      case "land": {
        if (!landKaufbar(S, m.p)) return nein(S.land[m.p] === "1" ? "Gehört euch schon." : "Kaufen geht nur neben eigenem Land.");
        const k = landPreis(S);
        if (!zahlen(k)) return fehlt(k);
        S.land = S.land.slice(0, m.p) + "1" + S.land.slice(m.p + 1);
        return { ok: true };
      }
      case "wenden": wenden(S); return { ok: true };
    }
    return nein("Unbekannte Aktion.");
  }

  const GG = {
    B, H, P, METER, TEILE, BAUTEN, STUFEN, ZIELE, GELAENDE, DIR, LOK_L, WAGEN_L, BRUECKE, TUNNEL, RODEN, PLAETZE, FAHRPREIS,
    neu, auffrischen, aktion, schritt, werte, kmh, wagenlage, belegt, bauInfo, bauwerkInfo, besteLage, paare, weiche, punkt, laenge,
    stufenPreis, landPreis, landKaufbar, parzelle, besitzt, kopie, zielePruefen, offeneZiele, nachfrage, haeuser, bahnhofName, abstand
  };
  if (typeof module !== "undefined") module.exports = GG; else window.GG = GG;
})();
