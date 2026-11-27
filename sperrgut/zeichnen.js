// Sperrgut: Zeichnungen auf Canvas 2D (Altbau, Gehweg, Palette, Umzugswagen, Kartons, Möbel, Effekte).
// Keine Bibliotheken, keine Bilder. Formen der Teile aus SG_TEILE (teile.js): Felder, y nach UNTEN, Mittelpunkt (0, 0).
// Stil: kräftige dunkle Umrisse, flache warme Farben mit etwas Schattierung, leicht krakelige Kanten.
(function (W) {
  const TINTE = "#2a1d14";
  const SCHRIFT = "'Comic Sans MS', 'Marker Felt', 'Chalkboard SE', 'Comic Neue', cursive";
  const FARBEN = ["#e63946", "#1e7fd8", "#2fae4e", "#f2b705", "#8e44ad", "#ff7a1a", "#13b5b1", "#ff5fa2"];

  function teileDaten() {
    if (W && W.SG_TEILE) return W.SG_TEILE;
    if (typeof SG_TEILE !== "undefined") return SG_TEILE; // eslint-disable-line no-undef
    return null;
  }

  // ---------- kleine Helfer ----------
  // Fester Zufall aus einer Zahl (gleich bei jedem Bild, sonst würde es flimmern)
  function zz(n) {
    n = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13;
    n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  function hex(c) {
    c = c.replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    const n = parseInt(c, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mische(a, b, t) {
    const x = hex(a), y = hex(b);
    t = Math.max(0, Math.min(1, t));
    return "rgb(" + Math.round(x[0] + (y[0] - x[0]) * t) + "," + Math.round(x[1] + (y[1] - x[1]) * t) + "," + Math.round(x[2] + (y[2] - x[2]) * t) + ")";
  }
  function rgba(c, a) { const x = hex(c); return "rgba(" + x[0] + "," + x[1] + "," + x[2] + "," + a + ")"; }
  const dunkler = (c, t) => mische(c, "#1a1008", t);
  const heller = (c, t) => mische(c, "#ffffff", t);
  const klemm = (x, a, b) => Math.max(a, Math.min(b, x));

  // Krakeliges abgerundetes Rechteck als Pfad (Kanten leicht gebogen, wie von Hand)
  function krakel(g, x, y, w, h, r, j, seed) {
    const k = i => (zz(seed * 31 + i) - 0.5) * 2 * j;
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y);
    g.quadraticCurveTo(x + w / 2, y + k(1), x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.quadraticCurveTo(x + w + k(2), y + h / 2, x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.quadraticCurveTo(x + w / 2, y + h + k(3), x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.quadraticCurveTo(x + k(4), y + h / 2, x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }
  function rund(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function fuellen(g, farbe, rand, breite) {
    if (farbe) { g.fillStyle = farbe; g.fill(); }
    if (rand) { g.strokeStyle = rand; g.lineWidth = breite; g.lineJoin = "round"; g.lineCap = "round"; g.stroke(); }
  }
  function linie(g, x0, y0, x1, y1, farbe, breite) {
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
    g.strokeStyle = farbe; g.lineWidth = breite; g.lineCap = "round"; g.stroke();
  }
  function kreis(g, x, y, r) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); }
  const strich = s => Math.max(1, s * 0.065);

  // Pfad der Physik-Form (Rechtecke oder Kreis), Pixel
  function formPfad(g, T, s, rein) {
    rein = rein || 0;
    if (T.kreis) kreis(g, 0, 0, T.kreis * s - rein);
    else for (const [x, y, w, h] of T.rects) g.rect(x * s + rein, y * s + rein, w * s - 2 * rein, h * s - 2 * rein);
  }
  function grenzen(T) {
    if (T.kreis) return [-T.kreis, -T.kreis, T.kreis, T.kreis];
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y, w, h] of T.rects) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x + w); d = Math.max(d, y + h); }
    return [a, b, c, d];
  }

  // ---------- Kartons ----------
  const PAPPE = ["#c8965a", "#c08b4f", "#cfa064", "#c4914f"];

  function kartonZeichnen(g, typ, T, s, o) {
    const lw = strich(s), farbe = o.farbe || "#d8c9a8";
    const zellen = T.zellen;
    const hat = (x, y) => zellen.some(z => Math.abs(z[0] - x) < 0.01 && Math.abs(z[1] - y) < 0.01);
    const sd = typ.charCodeAt(0) * 13 + typ.length;
    // Grundkörper jeder Zelle
    zellen.forEach(([zx, zy], i) => {
      const x = zx * s, y = zy * s, ein = s * 0.015;
      const ton = PAPPE[Math.floor(zz(sd + i * 7) * PAPPE.length)];
      g.beginPath(); krakel(g, x + ein, y + ein, s - 2 * ein, s - 2 * ein, s * 0.06, s * 0.025, sd + i);
      g.fillStyle = ton; g.fill();
      g.save(); g.clip();
      // Schatten unten, Licht oben links
      g.fillStyle = "rgba(90,50,15,0.22)"; g.fillRect(x, y + s * 0.84, s, s * 0.16);
      g.fillStyle = "rgba(255,235,200,0.25)"; g.fillRect(x, y, s * 0.07, s);
      // Deckelkante (Klappen)
      g.fillStyle = "rgba(255,230,190,0.18)"; g.fillRect(x, y, s, s * 0.2);
      linie(g, x + s * 0.04, y + s * 0.2, x + s * 0.96, y + s * 0.2, "rgba(60,35,15,0.45)", Math.max(0.6, lw * 0.5));
      // Grifflöcher außen an den Seiten
      if (s >= 22 && !hat(zx - 1, zy)) { g.beginPath(); rund(g, x + s * 0.08, y + s * 0.36, s * 0.07, s * 0.2, s * 0.035); g.fillStyle = "rgba(50,28,10,0.55)"; g.fill(); }
      if (s >= 22 && !hat(zx + 1, zy)) { g.beginPath(); rund(g, x + s * 0.85, y + s * 0.36, s * 0.07, s * 0.2, s * 0.035); g.fillStyle = "rgba(50,28,10,0.55)"; g.fill(); }
      g.restore();
    });
    // Paketband über den Deckel jeder Zelle
    zellen.forEach(([zx, zy], i) => {
      const x = zx * s, y = zy * s, bw = s * 0.2, bx = x + s * 0.4 + (zz(sd + i * 3) - 0.5) * s * 0.06;
      bandStreifen(g, bx, y + s * 0.02, bw, s * 0.42, farbe, true, sd + i);
    });
    // Band über die Nähte, damit es wie zusammengeklebt aussieht
    zellen.forEach(([zx, zy], i) => {
      const x = zx * s, y = zy * s;
      if (hat(zx + 1, zy)) bandQuer(g, x + s, y + s * 0.33, s * 0.5, s * 0.16, farbe, sd + i * 5);
      if (hat(zx, zy + 1)) bandStreifen(g, x + s * 0.4, y + s * 0.86, s * 0.2, s * 0.3, farbe, false, sd + i * 9);
    });
    // Umrisse zuletzt (kräftig)
    g.beginPath();
    zellen.forEach(([zx, zy], i) => krakel(g, zx * s + s * 0.015, zy * s + s * 0.015, s * 0.97, s * 0.97, s * 0.06, s * 0.025, sd + i));
    g.strokeStyle = TINTE; g.lineWidth = lw; g.lineJoin = "round"; g.stroke();

    // Beschriftung und Aufkleber
    if (s < 15) return;
    const reihen = {};
    zellen.forEach(([x, y]) => { (reihen[y] = reihen[y] || []).push(x); });
    let best = null;
    for (const y in reihen) {
      const xs = reihen[y].sort((a, b) => a - b);
      let start = xs[0], len = 1;
      for (let k = 1; k <= xs.length; k++) {
        if (k < xs.length && xs[k] === xs[k - 1] + 1) { len++; continue; }
        if (!best || len > best.len || (len === best.len && +y > best.y)) best = { x: start, y: +y, len };
        if (k < xs.length) { start = xs[k]; len = 1; }
      }
    }
    const symbole = [];
    if (o.zerbrechlich) symbole.push("glas");
    if (o.pizza) symbole.push("pizza");
    const frei = zellen.filter(([x, y]) => !(y === best.y && x >= best.x && x < best.x + best.len));
    const plaetze = [];
    symbole.forEach(sym => {
      if (frei.length) { const z = frei.shift(); plaetze.push({ sym, x: z[0], y: z[1], gross: true }); }
      else if (best.len > 1) { best.len--; plaetze.push({ sym, x: best.x + best.len, y: best.y, gross: true }); }
      else plaetze.push({ sym, x: best.x, y: best.y, gross: false });
    });
    // Filzstift-Beschriftung
    const text = o.zerbrechlich && typ !== "kiste" ? "VORSICHT GLAS" : (T.etikett || "Kram");
    etikett(g, text, (best.x + best.len / 2) * s, (best.y + 0.64) * s, best.len * s * 0.84, s, o.zerbrechlich ? "#b3261e" : "#221a33", sd);
    // „Oben“-Pfeile auf freien Zellen
    if (s >= 26) frei.forEach(([x, y], i) => {
      if (zz(sd + i * 11) < 0.4) pfeileOben(g, (x + 0.5) * s, (y + 0.62) * s, s * 0.22);
    });
    plaetze.forEach(p => {
      const cx = (p.x + 0.5) * s, cy = (p.y + 0.6) * s, r = p.gross ? s * 0.3 : s * 0.16;
      const px = p.gross ? cx : cx + s * 0.27, py = p.gross ? cy : (p.y + 0.3) * s;
      if (p.sym === "glas") glasSymbol(g, px, py, r);
      else pizzaAufkleber(g, px, py, r);
    });
  }
  function bandStreifen(g, x, y, w, h, farbe, rissUnten, seed) {
    g.beginPath();
    g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h);
    if (rissUnten) { const n = 4; for (let i = 1; i <= n; i++) g.lineTo(x + w - (w * i) / n, y + h - (i % 2 ? w * 0.18 : 0)); }
    else g.lineTo(x, y + h);
    g.closePath();
    g.fillStyle = rgba(farbe, 0.92); g.fill();
    g.fillStyle = "rgba(255,255,255,0.28)"; g.fillRect(x + w * 0.15, y, w * 0.18, h * 0.85);
    g.strokeStyle = "rgba(42,29,20,0.45)"; g.lineWidth = Math.max(0.6, w * 0.08); g.stroke();
  }
  function bandQuer(g, cx, cy, w, h, farbe, seed) {
    g.save(); g.translate(cx, cy); g.rotate((zz(seed) - 0.5) * 0.16);
    g.beginPath(); g.rect(-w / 2, -h / 2, w, h);
    g.fillStyle = rgba(farbe, 0.92); g.fill();
    g.fillStyle = "rgba(255,255,255,0.28)"; g.fillRect(-w / 2, -h / 2 + h * 0.15, w, h * 0.2);
    g.strokeStyle = "rgba(42,29,20,0.45)"; g.lineWidth = Math.max(0.6, h * 0.08); g.stroke();
    g.restore();
  }
  function etikett(g, text, cx, cy, maxB, s, farbe, seed) {
    g.save(); g.translate(cx, cy); g.rotate((zz(seed + 99) - 0.5) * 0.12);
    g.font = "700 100px " + SCHRIFT;
    let zeilen = [text], b = g.measureText(text).width;
    let fs = Math.min(s * 0.3, (maxB / b) * 100);
    if (fs < s * 0.2 && text.indexOf(" ") > 0) {
      const teile = text.split(" "); let bestI = 1, bestD = Infinity;
      for (let i = 1; i < teile.length; i++) { const d = Math.abs(teile.slice(0, i).join(" ").length - teile.slice(i).join(" ").length); if (d < bestD) { bestD = d; bestI = i; } }
      zeilen = [teile.slice(0, bestI).join(" "), teile.slice(bestI).join(" ")];
      b = Math.max(g.measureText(zeilen[0]).width, g.measureText(zeilen[1]).width);
      fs = Math.min(s * 0.24, (maxB / b) * 100);
    }
    g.font = "700 " + fs.toFixed(1) + "px " + SCHRIFT;
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = farbe;
    if (zeilen.length === 1) g.fillText(text, 0, 0);
    else { g.fillText(zeilen[0], 0, -fs * 0.55); g.fillText(zeilen[1], 0, fs * 0.55); }
    g.restore();
  }
  function pfeileOben(g, cx, cy, r) {
    g.save(); g.strokeStyle = "rgba(34,26,51,0.7)"; g.lineWidth = Math.max(1, r * 0.16); g.lineCap = "round"; g.lineJoin = "round";
    for (const dx of [-0.45, 0.45]) {
      g.beginPath(); g.moveTo(cx + dx * r, cy + r * 0.7); g.lineTo(cx + dx * r, cy - r * 0.6);
      g.moveTo(cx + dx * r - r * 0.3, cy - r * 0.25); g.lineTo(cx + dx * r, cy - r * 0.65); g.lineTo(cx + dx * r + r * 0.3, cy - r * 0.25); g.stroke();
    }
    g.restore();
  }
  // Rotes Weinglas (zerbrechlich)
  function glasSymbol(g, cx, cy, r) {
    g.save(); g.translate(cx, cy);
    g.beginPath(); kreis(g, 0, 0, r); g.fillStyle = "#fff6e6"; g.fill();
    g.lineWidth = Math.max(1, r * 0.12); g.strokeStyle = "#c0281e"; g.stroke();
    g.beginPath();
    g.moveTo(-r * 0.4, -r * 0.62); g.lineTo(r * 0.4, -r * 0.62);
    g.quadraticCurveTo(r * 0.45, r * 0.02, 0, r * 0.08); g.quadraticCurveTo(-r * 0.45, r * 0.02, -r * 0.4, -r * 0.62);
    g.moveTo(0, r * 0.08); g.lineTo(0, r * 0.5); g.moveTo(-r * 0.3, r * 0.55); g.lineTo(r * 0.3, r * 0.55);
    g.lineWidth = Math.max(1, r * 0.14); g.lineCap = "round"; g.stroke();
    // kleiner Sprung im Glas
    g.beginPath(); g.moveTo(r * 0.05, -r * 0.6); g.lineTo(-r * 0.08, -r * 0.4); g.lineTo(r * 0.07, -r * 0.28); g.lineTo(-r * 0.03, -r * 0.12);
    g.lineWidth = Math.max(0.6, r * 0.07); g.stroke();
    g.restore();
  }
  // Runder Aufkleber mit Pizzastück
  function pizzaAufkleber(g, cx, cy, r) {
    g.save(); g.translate(cx, cy); g.rotate(-0.25);
    g.beginPath(); kreis(g, 0, 0, r); g.fillStyle = "#fffaf0"; g.fill();
    g.lineWidth = Math.max(1, r * 0.12); g.strokeStyle = "#2f8f3a"; g.stroke();
    g.beginPath(); g.moveTo(-r * 0.62, -r * 0.4); g.quadraticCurveTo(0, -r * 0.75, r * 0.62, -r * 0.4); g.lineTo(0, r * 0.68); g.closePath();
    g.fillStyle = "#f6c445"; g.fill(); g.lineWidth = Math.max(0.8, r * 0.1); g.strokeStyle = TINTE; g.lineJoin = "round"; g.stroke();
    g.beginPath(); g.moveTo(-r * 0.62, -r * 0.4); g.quadraticCurveTo(0, -r * 0.75, r * 0.62, -r * 0.4);
    g.lineWidth = r * 0.2; g.strokeStyle = "#c97a32"; g.stroke();
    g.fillStyle = "#d1372b";
    g.beginPath(); kreis(g, -r * 0.18, -r * 0.2, r * 0.12); kreis(g, r * 0.2, -r * 0.18, r * 0.11); kreis(g, 0, r * 0.15, r * 0.1); g.fill();
    g.restore();
  }

  // ---------- Möbel ----------
  function kuehlschrank(g, s, lw) {
    const x = -0.5 * s, y = -s, w = s, h = 2 * s;
    g.beginPath(); krakel(g, x, y, w, h, s * 0.13, s * 0.02, 3); fuellen(g, "#f3f0e8");
    g.save(); g.clip();
    g.fillStyle = "rgba(120,140,165,0.28)"; g.fillRect(x + w * 0.8, y, w * 0.2, h);
    g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(x + w * 0.08, y + s * 0.06, w * 0.06, h * 0.85);
    g.fillStyle = "#8f9aa3"; g.fillRect(x, y + h - s * 0.12, w, s * 0.12);
    for (let i = 1; i < 6; i++) g.fillRect(x + (w * i) / 6, y + h - s * 0.12, 0, 0);
    g.restore();
    linie(g, x + s * 0.05, y + s * 0.66, x + w - s * 0.05, y + s * 0.66, TINTE, lw * 0.8);
    linie(g, x, y + h - s * 0.12, x + w, y + h - s * 0.12, TINTE, lw * 0.6);
    // Griffe
    g.beginPath(); rund(g, x + w * 0.74, y + s * 0.3, s * 0.08, s * 0.28, s * 0.04); rund(g, x + w * 0.74, y + s * 0.8, s * 0.08, s * 0.45, s * 0.04);
    fuellen(g, "#b6c0c8", TINTE, lw * 0.6);
    // Zettel und Magnet
    g.save(); g.translate(x + w * 0.36, y + s * 1.15); g.rotate(-0.12);
    g.beginPath(); g.rect(-s * 0.15, -s * 0.15, s * 0.3, s * 0.3); fuellen(g, "#ffe37a", "rgba(42,29,20,0.6)", lw * 0.4);
    for (let i = 0; i < 3; i++) linie(g, -s * 0.1, -s * 0.06 + i * s * 0.07, s * (0.1 - i * 0.03), -s * 0.06 + i * s * 0.07, "rgba(40,40,90,0.6)", Math.max(0.5, lw * 0.3));
    g.restore();
    g.beginPath(); kreis(g, x + w * 0.36, y + s * 1.0, s * 0.05); fuellen(g, "#e63946");
    g.beginPath(); kreis(g, x + w * 0.3, y + s * 0.36, s * 0.06); fuellen(g, "#3a86ff");
    g.beginPath(); krakel(g, x, y, w, h, s * 0.13, s * 0.02, 3); fuellen(g, null, TINTE, lw);
  }
  function sofa(g, s, lw) {
    const stoff = "#3f8f8a", dunkel = dunkler(stoff, 0.3), hell = heller(stoff, 0.2);
    // Füße
    g.beginPath(); g.rect(-1.38 * s, 0.48 * s, 0.16 * s, 0.12 * s); g.rect(1.22 * s, 0.48 * s, 0.16 * s, 0.12 * s); fuellen(g, "#7a4a26", TINTE, lw * 0.6);
    // Unterteil
    g.beginPath(); krakel(g, -1.5 * s, -0.1 * s, 3 * s, 0.6 * s, s * 0.12, s * 0.03, 11); fuellen(g, stoff);
    g.save(); g.clip(); g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(-1.5 * s, 0.32 * s, 3 * s, 0.2 * s); g.restore();
    fuellen(g, null, TINTE, lw);
    // Polster
    for (const px of [-1.02, 0.02]) {
      g.beginPath(); krakel(g, px * s, -0.1 * s, 1.0 * s, 0.36 * s, s * 0.14, s * 0.03, 20 + px * 10);
      fuellen(g, hell, TINTE, lw * 0.8);
      g.beginPath(); kreis(g, (px + 0.5) * s, 0.08 * s, s * 0.035); fuellen(g, dunkel);
      linie(g, (px + 0.15) * s, -0.04 * s, (px + 0.6) * s, -0.04 * s, "rgba(255,255,255,0.35)", lw * 0.6);
    }
    // Lehnen
    for (const ax of [-1.5, 1.0]) {
      g.beginPath(); krakel(g, ax * s, -0.6 * s, 0.5 * s, 0.75 * s, s * 0.2, s * 0.02, 30 + ax);
      fuellen(g, stoff);
      g.save(); g.clip(); g.fillStyle = "rgba(255,255,255,0.2)"; g.fillRect(ax * s, -0.6 * s, 0.5 * s, 0.12 * s);
      g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect((ax + 0.38) * s, -0.6 * s, 0.12 * s, 0.75 * s); g.restore();
      fuellen(g, null, TINTE, lw);
    }
    // Ziernaht
    g.save(); g.setLineDash([s * 0.08, s * 0.07]);
    linie(g, -1.35 * s, 0.38 * s, 1.35 * s, 0.38 * s, "rgba(255,255,255,0.45)", Math.max(0.6, lw * 0.4)); g.restore();
  }
  function lampe(g, s, lw) {
    // Fuß
    g.beginPath(); krakel(g, -0.45 * s, 1.3 * s, 0.9 * s, 0.2 * s, s * 0.09, s * 0.01, 41); fuellen(g, "#4a3a30", TINTE, lw);
    // Stange
    g.beginPath(); g.rect(-0.08 * s, -0.95 * s, 0.16 * s, 2.28 * s); fuellen(g, "#b48a3c", TINTE, lw * 0.8);
    g.fillStyle = "rgba(255,240,190,0.55)"; g.fillRect(-0.05 * s, -0.9 * s, 0.035 * s, 2.15 * s);
    // Zugschalter
    linie(g, 0.25 * s, -0.9 * s, 0.25 * s, -0.55 * s, TINTE, Math.max(0.6, lw * 0.35));
    g.beginPath(); kreis(g, 0.25 * s, -0.53 * s, s * 0.04); fuellen(g, "#b48a3c", TINTE, lw * 0.4);
    // Schirm
    g.beginPath();
    g.moveTo(-0.46 * s, -1.5 * s); g.lineTo(0.46 * s, -1.5 * s); g.lineTo(0.6 * s, -0.9 * s);
    g.quadraticCurveTo(0, -0.84 * s, -0.6 * s, -0.9 * s); g.closePath();
    fuellen(g, "#f2cf6f");
    g.save(); g.clip();
    g.fillStyle = "rgba(200,120,30,0.22)";
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo((i * 0.2 - 0.05) * s, -1.5 * s); g.lineTo((i * 0.26 + 0.03) * s, -0.85 * s); g.lineTo((i * 0.26 - 0.06) * s, -0.85 * s); g.closePath(); g.fill(); }
    g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(-0.6 * s, -1.5 * s, 1.2 * s, 0.08 * s);
    g.fillStyle = "#d9534f"; g.fillRect(-0.7 * s, -0.98 * s, 1.4 * s, 0.1 * s);
    g.restore();
    g.beginPath();
    g.moveTo(-0.46 * s, -1.5 * s); g.lineTo(0.46 * s, -1.5 * s); g.lineTo(0.6 * s, -0.9 * s);
    g.quadraticCurveTo(0, -0.84 * s, -0.6 * s, -0.9 * s); g.closePath();
    fuellen(g, null, TINTE, lw);
  }
  function matratze(g, s, lw) {
    const x = -2 * s, y = -0.25 * s, w = 4 * s, h = 0.5 * s;
    g.beginPath(); krakel(g, x, y, w, h, s * 0.2, s * 0.03, 51); fuellen(g, "#f2f4f8");
    g.save(); g.clip();
    g.fillStyle = "rgba(80,120,190,0.3)";
    for (let i = 0; i < 20; i++) g.fillRect(x + i * s * 0.2 + s * 0.06, y, s * 0.08, h);
    g.fillStyle = "rgba(90,110,150,0.25)"; g.fillRect(x, y + h * 0.72, w, h * 0.28);
    g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(x, y, w, h * 0.12);
    g.restore();
    g.save(); g.setLineDash([s * 0.06, s * 0.05]);
    g.beginPath(); rund(g, x + s * 0.1, y + s * 0.08, w - s * 0.2, h - s * 0.16, s * 0.12);
    g.strokeStyle = "rgba(42,29,20,0.5)"; g.lineWidth = Math.max(0.6, lw * 0.4); g.stroke(); g.restore();
    g.fillStyle = "rgba(42,29,20,0.55)";
    for (let i = 0; i < 7; i++) { g.beginPath(); kreis(g, x + (i + 0.5) * w / 7, y + h * 0.5, s * 0.03); g.fill(); }
    // ein kleiner Fleck
    g.beginPath(); g.ellipse(1.2 * s, -0.03 * s, s * 0.16, s * 0.07, 0.2, 0, Math.PI * 2); fuellen(g, "rgba(190,150,80,0.35)");
    g.beginPath(); krakel(g, x, y, w, h, s * 0.2, s * 0.03, 51); fuellen(g, null, TINTE, lw);
  }
  function gummibaum(g, s, lw) {
    // Stamm
    g.beginPath(); g.moveTo(-0.04 * s, 0.05 * s); g.quadraticCurveTo(-0.1 * s, -0.4 * s, 0.02 * s, -0.75 * s);
    g.strokeStyle = "#6b4a2b"; g.lineWidth = s * 0.08; g.lineCap = "round"; g.stroke();
    // dunkle Krone als Grund, damit das Rechteck gefüllt wirkt
    g.beginPath(); g.ellipse(0, -0.5 * s, 0.95 * s, 0.46 * s, 0, 0, Math.PI * 2); fuellen(g, "#245e2c", TINTE, lw * 0.9);
    // Blätter: oval, glänzend, mit Mittelrippe
    const blaetter = [
      [-0.62, -0.32, -2.6, 0.42], [0.62, -0.3, -0.5, 0.42], [-0.45, -0.72, -2.1, 0.4], [0.45, -0.74, -1.0, 0.4],
      [0, -0.82, -1.57, 0.36], [-0.2, -0.38, -2.0, 0.34], [0.25, -0.42, -1.2, 0.34], [-0.82, -0.55, -2.9, 0.3], [0.82, -0.55, -0.25, 0.3]
    ];
    blaetter.forEach(([bx, by, a, l], i) => {
      g.save(); g.translate(bx * s, by * s); g.rotate(a + Math.PI / 2);
      g.beginPath(); g.moveTo(0, l * s * 0.5); g.quadraticCurveTo(l * s * 0.42, 0, 0, -l * s * 0.6); g.quadraticCurveTo(-l * s * 0.42, 0, 0, l * s * 0.5); g.closePath();
      fuellen(g, i % 2 ? "#3c8f3f" : "#2f7d36", TINTE, lw * 0.7);
      linie(g, 0, l * s * 0.45, 0, -l * s * 0.5, "rgba(180,230,150,0.75)", Math.max(0.6, lw * 0.4));
      g.beginPath(); g.ellipse(-l * s * 0.12, -l * s * 0.1, l * s * 0.05, l * s * 0.2, 0, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,0.3)"; g.fill();
      g.restore();
    });
    // Topf
    g.beginPath(); g.moveTo(-0.4 * s, 0.18 * s); g.lineTo(0.4 * s, 0.18 * s); g.lineTo(0.33 * s, 1.0 * s); g.lineTo(-0.33 * s, 1.0 * s); g.closePath();
    fuellen(g, "#c4643c");
    g.save(); g.clip(); g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(0.15 * s, 0, 0.3 * s, s); g.fillStyle = "rgba(255,220,180,0.25)"; g.fillRect(-0.3 * s, 0, 0.08 * s, s); g.restore();
    fuellen(g, null, TINTE, lw);
    g.beginPath(); krakel(g, -0.45 * s, 0, 0.9 * s, 0.22 * s, s * 0.05, s * 0.01, 61); fuellen(g, "#d4744a", TINTE, lw);
  }
  function stuhl(g, s, lw) {
    const holz = "#a8693a", dunkel = "#7d4a24";
    const brett = (x, y, w, h, sd) => {
      g.beginPath(); krakel(g, x * s, y * s, w * s, h * s, s * 0.04, s * 0.01, sd); fuellen(g, holz);
      g.save(); g.clip(); g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect((x + w * 0.65) * s, y * s, w * 0.35 * s, h * s); g.restore();
      fuellen(g, null, TINTE, lw * 0.85);
    };
    brett(0.38, 0.1, 0.12, 0.9, 71);
    brett(-0.5, 0.1, 0.12, 0.9, 72);
    brett(-0.5, -1, 0.15, 0.95, 73);
    // Kopf der Lehne
    g.beginPath(); kreis(g, -0.425 * s, -1 * s, s * 0.08); fuellen(g, dunkel, TINTE, lw * 0.6);
    // Sitz mit Kissen
    brett(-0.5, -0.1, 1, 0.2, 74);
    g.beginPath(); krakel(g, -0.33 * s, -0.2 * s, 0.8 * s, 0.11 * s, s * 0.05, s * 0.01, 75); fuellen(g, "#c94f4f", TINTE, lw * 0.6);
    // Maserung
    linie(g, -0.4 * s, 0, 0.3 * s, 0, "rgba(60,30,10,0.35)", Math.max(0.5, lw * 0.3));
  }
  function goldfischglas(g, s, lw) {
    const r = 0.55 * s;
    g.beginPath(); kreis(g, 0, 0, r); fuellen(g, "rgba(215,240,250,0.85)");
    g.save(); g.beginPath(); kreis(g, 0, 0, r); g.clip();
    // Wasser
    g.beginPath(); g.moveTo(-r, -0.25 * r);
    for (let i = 0; i <= 8; i++) g.lineTo(-r + (i * 2 * r) / 8, -0.25 * r + Math.sin(i * 1.4) * r * 0.04);
    g.lineTo(r, r); g.lineTo(-r, r); g.closePath(); g.fillStyle = "#58b4e0"; g.fill();
    g.fillStyle = "rgba(20,70,130,0.25)"; g.fillRect(-r, 0.45 * r, 2 * r, r);
    // Kies
    for (let i = 0; i < 12; i++) { g.beginPath(); kreis(g, -0.75 * r + i * 0.14 * r, 0.82 * r + zz(i) * 0.1 * r, 0.09 * r); g.fillStyle = ["#e8c66a", "#d46a4a", "#f1efe7"][i % 3]; g.fill(); }
    g.restore();
    // Fisch
    g.save(); g.translate(0.05 * r, 0.22 * r);
    g.beginPath(); g.moveTo(-0.3 * r, 0); g.lineTo(-0.55 * r, -0.2 * r); g.lineTo(-0.55 * r, 0.2 * r); g.closePath(); fuellen(g, "#ff8a1c", TINTE, lw * 0.6);
    g.beginPath(); g.ellipse(0, 0, 0.34 * r, 0.2 * r, 0, 0, Math.PI * 2); fuellen(g, "#ff9a2a", TINTE, lw * 0.6);
    g.beginPath(); kreis(g, 0.17 * r, -0.05 * r, 0.05 * r); fuellen(g, TINTE);
    g.restore();
    g.beginPath(); kreis(g, 0.3 * r, -0.05 * r, 0.05 * r); kreis(g, 0.38 * r, -0.2 * r, 0.035 * r); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = Math.max(0.6, lw * 0.35); g.stroke();
    // Glanz und Öffnung oben
    g.beginPath(); g.arc(0, 0, r * 0.78, Math.PI * 1.1, Math.PI * 1.45); g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = r * 0.1; g.lineCap = "round"; g.stroke();
    g.beginPath(); g.ellipse(0, -0.86 * r, 0.48 * r, 0.1 * r, 0, 0, Math.PI * 2); fuellen(g, "rgba(240,250,255,0.9)", TINTE, lw * 0.7);
    g.beginPath(); kreis(g, 0, 0, r); fuellen(g, null, TINTE, lw);
  }
  function klavier(g, s, lw) {
    const lack = "#241a17";
    // Beine
    for (const bx of [-1.5, 1.25]) {
      g.beginPath(); g.moveTo(bx * s, 0.68 * s); g.lineTo((bx + 0.25) * s, 0.68 * s); g.lineTo((bx + 0.2) * s, 1.0 * s); g.lineTo((bx + 0.05) * s, 1.0 * s); g.closePath();
      fuellen(g, lack, TINTE, lw);
      g.beginPath(); g.rect((bx + 0.03) * s, 0.94 * s, 0.19 * s, 0.06 * s); fuellen(g, "#c9a44a");
    }
    // Korpus
    g.beginPath(); krakel(g, -1.5 * s, -1 * s, 3 * s, 1.72 * s, s * 0.07, s * 0.02, 81); fuellen(g, lack);
    g.save(); g.clip();
    g.fillStyle = "#3a2b25"; g.fillRect(-1.5 * s, -1 * s, 3 * s, 0.14 * s);
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.beginPath(); g.moveTo(-1.1 * s, -1 * s); g.lineTo(-0.7 * s, -1 * s); g.lineTo(-1.3 * s, 0.7 * s); g.lineTo(-1.7 * s, 0.7 * s); g.closePath(); g.fill();
    g.restore();
    g.beginPath(); krakel(g, -1.5 * s, -1 * s, 3 * s, 1.72 * s, s * 0.07, s * 0.02, 81); fuellen(g, null, TINTE, lw);
    // Zierleisten
    g.beginPath(); rund(g, -1.3 * s, -0.78 * s, 2.6 * s, 0.6 * s, s * 0.06); rund(g, -1.3 * s, 0.24 * s, 2.6 * s, 0.38 * s, s * 0.06);
    g.strokeStyle = "#c9a44a"; g.lineWidth = Math.max(0.8, lw * 0.5); g.stroke();
    // Notenblatt
    g.save(); g.translate(0, -0.48 * s); g.rotate(-0.04);
    g.beginPath(); g.rect(-0.4 * s, -0.24 * s, 0.8 * s, 0.42 * s); fuellen(g, "#f6f0dc", TINTE, lw * 0.5);
    for (let i = 0; i < 4; i++) linie(g, -0.34 * s, (-0.14 + i * 0.09) * s, 0.34 * s, (-0.14 + i * 0.09) * s, "rgba(42,29,20,0.5)", Math.max(0.4, lw * 0.2));
    g.fillStyle = TINTE; for (let i = 0; i < 5; i++) { g.beginPath(); kreis(g, (-0.25 + i * 0.13) * s, (-0.1 + ((i * 7) % 4) * 0.06) * s, s * 0.03); g.fill(); }
    g.restore();
    // Kerzenhalter
    for (const kx of [-1.05, 1.05]) {
      g.beginPath(); g.rect((kx - 0.05) * s, -0.62 * s, 0.1 * s, 0.25 * s); fuellen(g, "#f4ecd6", TINTE, lw * 0.4);
      g.beginPath(); g.ellipse(kx * s, -0.68 * s, 0.03 * s, 0.06 * s, 0, 0, Math.PI * 2); fuellen(g, "#ffb347");
      g.beginPath(); g.rect((kx - 0.12) * s, -0.38 * s, 0.24 * s, 0.05 * s); fuellen(g, "#c9a44a");
    }
    // Tastatur
    const ty = -0.1 * s, th = 0.26 * s, tx = -1.4 * s, tw = 2.8 * s, n = 22;
    g.beginPath(); g.rect(tx - 0.06 * s, ty - 0.06 * s, tw + 0.12 * s, 0.06 * s); fuellen(g, "#3a2b25", TINTE, lw * 0.5);
    g.beginPath(); g.rect(tx, ty, tw, th); fuellen(g, "#fbf8ef", TINTE, lw * 0.7);
    for (let i = 1; i < n; i++) linie(g, tx + (i * tw) / n, ty, tx + (i * tw) / n, ty + th, "rgba(42,29,20,0.55)", Math.max(0.4, lw * 0.25));
    g.fillStyle = "#111";
    for (let i = 0; i < n - 1; i++) { const m = i % 7; if (m === 2 || m === 6) continue; g.fillRect(tx + ((i + 0.68) * tw) / n, ty, (tw / n) * 0.62, th * 0.6); }
    // Pedale
    for (const px of [-0.25, 0, 0.25]) { g.beginPath(); g.rect((px - 0.06) * s, 0.62 * s, 0.12 * s, 0.07 * s); fuellen(g, "#c9a44a", TINTE, lw * 0.4); }
  }
  function ball(g, s, lw) {
    const r = 0.9 * s;
    const gr = g.createRadialGradient(-0.35 * r, -0.4 * r, r * 0.1, 0, 0, r);
    gr.addColorStop(0, "#ff6f8f"); gr.addColorStop(0.45, "#c2338f"); gr.addColorStop(1, "#5e1f86");
    g.beginPath(); kreis(g, 0, 0, r); g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    g.beginPath(); g.ellipse(0, 0, r * 0.42, r * 1.02, 0, 0, Math.PI * 2);
    g.strokeStyle = "rgba(40,10,50,0.35)"; g.lineWidth = Math.max(0.8, lw * 0.6); g.stroke();
    g.restore();
    g.beginPath(); g.ellipse(-0.38 * r, -0.45 * r, 0.25 * r, 0.14 * r, -0.6, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,0.75)"; g.fill();
    g.beginPath(); kreis(g, -0.12 * r, -0.62 * r, 0.05 * r); g.fill();
    g.beginPath(); kreis(g, 0.62 * r, 0.55 * r, 0.07 * r); fuellen(g, "#4a1a66", TINTE, lw * 0.4);
    g.beginPath(); kreis(g, 0, 0, r); fuellen(g, null, TINTE, lw);
  }
  const MOEBEL_ZEICHNER = { kuehlschrank, sofa, lampe, matratze, gummibaum, stuhl, glas: goldfischglas, klavier, ball };
  const EINFACH_FARBE = { kuehlschrank: "#f1efe9", sofa: "#3f8f8a", lampe: "#e9c46a", matratze: "#dfe6f2", gummibaum: "#2f7d36", stuhl: "#a8693a", glas: "#8fd0ec", klavier: "#241a17", ball: "#b1328f" };

  // Nass: dunkler, glänzende Tropfen
  function nassDrueber(g, T, s) {
    g.save();
    g.beginPath(); formPfad(g, T, s); g.clip();
    g.fillStyle = "rgba(25,45,90,0.3)"; g.fill();
    const [a, b, c, d] = grenzen(T);
    const n = Math.max(4, Math.round((c - a) * (d - b) * 3));
    for (let i = 0; i < n; i++) {
      const x = (a + zz(i * 3 + 1) * (c - a)) * s, y = (b + zz(i * 3 + 2) * (d - b)) * s, r = s * (0.05 + zz(i * 3 + 3) * 0.05);
      g.beginPath(); g.moveTo(x, y - r * 1.8); g.quadraticCurveTo(x + r, y - r * 0.2, x, y + r); g.quadraticCurveTo(x - r, y - r * 0.2, x, y - r * 1.8);
      g.fillStyle = "rgba(170,210,255,0.75)"; g.fill();
      g.beginPath(); kreis(g, x - r * 0.3, y - r * 0.2, r * 0.3); g.fillStyle = "rgba(255,255,255,0.95)"; g.fill();
    }
    g.restore();
  }

  // ---------- Teil ----------
  function teil(g, typ, s, opt) {
    const D = teileDaten(); if (!D) return;
    const T = D.TEILE[typ]; if (!T) return;
    opt = opt || {};
    if (opt.geist) {
      g.save();
      g.beginPath();
      if (T.zellen) T.zellen.forEach(([x, y]) => g.rect(x * s + 1, y * s + 1, s - 2, s - 2)); else formPfad(g, T, s);
      g.fillStyle = "rgba(255,255,255,0.16)"; g.fill();
      g.setLineDash([Math.max(3, s * 0.18), Math.max(2, s * 0.12)]);
      g.strokeStyle = "rgba(42,29,20,0.35)"; g.lineWidth = Math.max(2, s * 0.08); g.stroke();
      g.strokeStyle = opt.farbe ? rgba(opt.farbe, 0.8) : "rgba(255,255,255,0.8)"; g.lineWidth = Math.max(1, s * 0.04); g.stroke();
      g.restore();
      return;
    }
    if (opt.klein) {
      g.beginPath(); formPfad(g, T, s);
      g.fillStyle = T.zellen ? (opt.nass ? "#9a7146" : "#c8965a") : (EINFACH_FARBE[typ] || "#999");
      g.fill();
      if (T.zellen && opt.farbe) { g.fillStyle = opt.farbe; for (const [x, y] of T.zellen) g.fillRect((x + 0.38) * s, y * s, s * 0.24, s); }
      if (s >= 4) {
        g.strokeStyle = TINTE; g.lineWidth = Math.max(0.5, s * 0.1);
        if (T.zellen) { g.beginPath(); for (const [x, y] of T.zellen) g.rect(x * s, y * s, s, s); }
        g.stroke();
      }
      return;
    }
    const lw = strich(s);
    g.save();
    if (T.zellen) kartonZeichnen(g, typ, T, s, opt);
    else if (MOEBEL_ZEICHNER[typ]) MOEBEL_ZEICHNER[typ](g, s, lw);
    else { g.beginPath(); formPfad(g, T, s); fuellen(g, "#999", TINTE, lw); }
    if (opt.nass) nassDrueber(g, T, s);
    g.restore();
  }

  // Teil passend in ein Kästchen (nächstes Teil, Wunschteil)
  function vorschau(g, typ, w, h, opt) {
    const D = teileDaten(); if (!D || !D.TEILE[typ]) return;
    const [a, b, c, d] = grenzen(D.TEILE[typ]);
    const s = Math.min(w / (c - a), h / (d - b)) * 0.82;
    g.save(); g.translate(w / 2 - ((a + c) / 2) * s, h / 2 - ((b + d) / 2) * s);
    teil(g, typ, s, opt);
    g.restore();
  }

  // ---------- Hintergrund ----------
  // Umrechnung Welt → Pixel (Welt-y nach OBEN)
  function ansicht(v) {
    const s = v.s, X = x => v.mitteX + x * s, Y = y => v.h - (y - v.unten) * s;
    return {
      s, X, Y,
      yMin: v.unten - 1, yMax: v.unten + v.h / s + 1,
      xMin: -v.mitteX / s - 1, xMax: (v.w - v.mitteX) / s + 1,
      // Rechteck in Weltkoordinaten (x0 < x1, y0 < y1) als Pfad
      R(g, x0, y0, x1, y1) { g.rect(X(x0), Y(y1), (x1 - x0) * s, (y1 - y0) * s); },
      sicht(y0, y1) { return y1 >= this.yMin && y0 <= this.yMax; },
      sichtX(x0, x1) { return x1 >= this.xMin && x0 <= this.xMax; }
    };
  }
  function himmel(g, v, A) {
    const t = klemm(v.tag || 0, 0, 1);
    const oben = t < 0.5 ? mische("#7fc0ea", "#a4c6e6", t * 2) : mische("#a4c6e6", "#3b3570", (t - 0.5) * 2);
    const unten = t < 0.5 ? mische("#fde9c4", "#ffe0a8", t * 2) : mische("#ffe0a8", "#f2875a", (t - 0.5) * 2);
    const gr = g.createLinearGradient(0, A.Y(60), 0, A.Y(30));
    gr.addColorStop(0, oben); gr.addColorStop(1, unten);
    g.fillStyle = gr; g.fillRect(0, 0, v.w, v.h);
    // Sonne / Abendsonne
    if (A.sicht(36, 60)) {
      const sx = A.X(t < 0.5 ? 10 - t * 8 : -4 - t * 4), sy = A.Y(52 - t * 10), r = A.s * 2.2;
      const gl = g.createRadialGradient(sx, sy, r * 0.3, sx, sy, r * 3);
      gl.addColorStop(0, rgba(t > 0.6 ? "#ffb070" : "#fff3c0", 0.6)); gl.addColorStop(1, rgba("#ffffff", 0));
      g.fillStyle = gl; g.fillRect(sx - r * 3, sy - r * 3, r * 6, r * 6);
      g.beginPath(); kreis(g, sx, sy, r); g.fillStyle = t > 0.6 ? "#ff9a55" : "#fff1b8"; g.fill();
    }
    // Wolken
    const wolke = (x, y, b) => {
      if (!A.sicht(y - 1, y + 2)) return;
      g.beginPath();
      kreis(g, A.X(x), A.Y(y + 0.6), b * A.s * 0.5); kreis(g, A.X(x + b * 0.55), A.Y(y + 0.9), b * A.s * 0.62);
      kreis(g, A.X(x + b * 1.2), A.Y(y + 0.55), b * A.s * 0.48); g.rect(A.X(x), A.Y(y + 0.55), b * A.s * 1.2, b * A.s * 0.4);
      g.fillStyle = t > 0.6 ? "rgba(255,190,170,0.75)" : "rgba(255,255,255,0.85)"; g.fill();
    };
    wolke(-7, 47, 2.2); wolke(4, 52, 2.8); wolke(-12, 55, 3); wolke(10, 44.5, 1.6);
  }

  // Ein Fenster mit Stuck. sill = Oberkante Fensterbrett (Welt), cx = Mitte.
  function fensterZ(g, A, cx, sill, o, licht) {
    const s = A.s, X = A.X, Y = A.Y, lw = Math.max(1, s * 0.045), rand = "rgba(42,29,20,0.75)";
    const stuck = o.stuck, schatten = o.schatten;
    // Brüstungsfeld mit Girlande
    g.beginPath(); A.R(g, cx - 0.8, sill - 1.0, cx + 0.8, sill - 0.3); fuellen(g, stuck, rand, lw * 0.7);
    g.beginPath(); g.moveTo(X(cx - 0.6), Y(sill - 0.45));
    g.quadraticCurveTo(X(cx - 0.3), Y(sill - 0.95), X(cx), Y(sill - 0.5)); g.quadraticCurveTo(X(cx + 0.3), Y(sill - 0.95), X(cx + 0.6), Y(sill - 0.45));
    g.strokeStyle = schatten; g.lineWidth = lw * 1.4; g.stroke();
    g.beginPath(); kreis(g, X(cx - 0.62), Y(sill - 0.45), s * 0.07); kreis(g, X(cx), Y(sill - 0.5), s * 0.07); kreis(g, X(cx + 0.62), Y(sill - 0.45), s * 0.07);
    fuellen(g, stuck, rand, lw * 0.6);
    // Konsolen und Fensterbrett
    g.beginPath(); A.R(g, cx - 1.08, sill - 0.6, cx - 0.88, sill - 0.25); A.R(g, cx + 0.88, sill - 0.6, cx + 1.08, sill - 0.25); fuellen(g, stuck, rand, lw * 0.6);
    g.beginPath(); A.R(g, cx - 1.18, sill - 0.27, cx + 1.18, sill); fuellen(g, stuck, rand, lw);
    g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(X(cx - 1.18), Y(sill - 0.18), 2.36 * s, 0.09 * s);
    // Laibung (Schatten) und Rahmen
    g.beginPath(); A.R(g, cx - 0.98, sill, cx + 0.98, sill + 3.28); fuellen(g, schatten);
    if (o.offen) return; // das offene Fenster zeichnet seinen Rest selbst
    g.beginPath(); A.R(g, cx - 0.86, sill + 0.04, cx + 0.86, sill + 3.2); fuellen(g, "#f3eee2", rand, lw);
    const glasF = o.glas;
    const scheiben = [[cx - 0.76, sill + 0.14, cx - 0.06, sill + 2.2], [cx + 0.06, sill + 0.14, cx + 0.76, sill + 2.2], [cx - 0.76, sill + 2.32, cx - 0.06, sill + 3.1], [cx + 0.06, sill + 2.32, cx + 0.76, sill + 3.1]];
    scheiben.forEach(([a, b, c, d]) => {
      g.beginPath(); A.R(g, a, b, c, d); fuellen(g, glasF, rand, lw * 0.6);
      if (licht) licht.push([X(a), Y(d), (c - a) * s, (d - b) * s]);
    });
    // Spiegelung
    g.save(); g.beginPath(); scheiben.forEach(([a, b, c, d]) => A.R(g, a, b, c, d)); g.clip();
    g.beginPath(); g.moveTo(X(cx - 0.76), Y(sill + 1.0)); g.lineTo(X(cx - 0.3), Y(sill + 2.2)); g.lineTo(X(cx - 0.05), Y(sill + 2.2)); g.lineTo(X(cx - 0.76), Y(sill + 0.4)); g.closePath();
    g.moveTo(X(cx + 0.1), Y(sill + 0.6)); g.lineTo(X(cx + 0.5), Y(sill + 2.2)); g.lineTo(X(cx + 0.62), Y(sill + 2.2)); g.lineTo(X(cx + 0.1), Y(sill + 0.2)); g.closePath();
    g.fillStyle = "rgba(255,255,255,0.22)"; g.fill(); g.restore();
    // Gardine hinter der Scheibe
    if (o.gardine) {
      g.beginPath(); g.moveTo(X(cx - 0.76), Y(sill + 2.2)); g.lineTo(X(cx - 0.4), Y(sill + 2.2)); g.quadraticCurveTo(X(cx - 0.55), Y(sill + 1.2), X(cx - 0.72), Y(sill + 0.14)); g.lineTo(X(cx - 0.76), Y(sill + 0.14)); g.closePath();
      g.moveTo(X(cx + 0.76), Y(sill + 2.2)); g.lineTo(X(cx + 0.4), Y(sill + 2.2)); g.quadraticCurveTo(X(cx + 0.55), Y(sill + 1.2), X(cx + 0.72), Y(sill + 0.14)); g.lineTo(X(cx + 0.76), Y(sill + 0.14)); g.closePath();
      g.fillStyle = "rgba(255,250,240,0.6)"; g.fill();
    }
  }
  function verdachung(g, A, cx, sill, o, art) {
    const s = A.s, X = A.X, Y = A.Y, lw = Math.max(1, s * 0.045), rand = "rgba(42,29,20,0.75)";
    // Schlussstein
    g.beginPath(); g.moveTo(X(cx - 0.16), Y(sill + 3.3)); g.lineTo(X(cx + 0.16), Y(sill + 3.3)); g.lineTo(X(cx + 0.1), Y(sill + 2.95)); g.lineTo(X(cx - 0.1), Y(sill + 2.95)); g.closePath();
    fuellen(g, o.stuck, rand, lw * 0.6);
    g.beginPath(); A.R(g, cx - 1.15, sill + 3.3, cx + 1.15, sill + 3.5); fuellen(g, o.stuck, rand, lw);
    g.beginPath();
    if (art === 0) { g.moveTo(X(cx - 1.15), Y(sill + 3.5)); g.lineTo(X(cx), Y(sill + 4.2)); g.lineTo(X(cx + 1.15), Y(sill + 3.5)); g.closePath(); }
    else if (art === 1) { g.moveTo(X(cx - 1.1), Y(sill + 3.5)); g.quadraticCurveTo(X(cx), Y(sill + 4.4), X(cx + 1.1), Y(sill + 3.5)); g.closePath(); }
    else { A.R(g, cx - 1.0, sill + 3.5, cx + 1.0, sill + 3.85); }
    fuellen(g, o.stuck, rand, lw);
    if (art === 0) { g.beginPath(); kreis(g, X(cx), Y(sill + 3.75), s * 0.12); fuellen(g, o.schatten); }
    if (art === 2) { g.beginPath(); A.R(g, cx - 1.1, sill + 3.85, cx + 1.1, sill + 4.0); fuellen(g, o.stuck, rand, lw * 0.7); }
  }

  const SPALTEN = [-7, -3.5, 0, 3.5, 7];
  const TUER_X = 7;
  function reihenFuer(v) {
    const r = [];
    for (let k = 0; k < 6; k++) {
      let sill = 4 + 6 * k;
      if (v.fenster != null && Math.abs(sill - v.fenster) < 3) sill = v.fenster;
      r.push(sill);
    }
    return r;
  }
  // Das Altbau-Haus mit Nachbarn. boden: Welt-y, wo die Fassade beginnt.
  function haus(g, v, A, boden, licht) {
    const s = A.s, X = A.X, Y = A.Y, lw = Math.max(1, s * 0.045), rand = "rgba(42,29,20,0.75)";
    const t = klemm(v.tag || 0, 0, 1);
    const putz = "#e5c58c", stuck = "#f4e6c6", schatten = "#a88456";
    const oben = 40;
    const hoch = v.modus === "hoch" && v.fenster != null;
    // Nachbarhäuser
    const nachbar = (x0, x1, top, farbe, versatz, sd) => {
      if (!A.sichtX(x0, x1)) return;
      g.beginPath(); A.R(g, x0, boden, x1, top); fuellen(g, farbe, rand, lw);
      const o = { stuck: heller(farbe, 0.35), schatten: dunkler(farbe, 0.35), glas: "#7d9db3" };
      for (let k = 0; 4 + versatz + 6 * k < top - 4; k++) {
        const sill = 4 + versatz + 6 * k;
        if (!A.sicht(sill - 1.2, sill + 4.5)) continue;
        g.beginPath(); A.R(g, x0, sill + 4.5, x1, sill + 4.8); fuellen(g, o.stuck, rand, lw * 0.7);
        for (let cx = x0 + 2; cx < x1 - 1.2; cx += 3.3) {
          const b = zz(sd + k * 17 + Math.round(cx * 3)) < 0.5;
          fensterZ(g, A, cx, sill, Object.assign({ gardine: b }, o), b ? licht : null);
          verdachung(g, A, cx, sill, o, 2);
        }
      }
      if (A.sicht(top, top + 1)) { g.beginPath(); A.R(g, x0 - 0.3, top, x1 + 0.3, top + 0.7); fuellen(g, o.stuck, rand, lw); }
      if (A.sicht(top + 0.7, top + 4)) {
        g.beginPath(); g.moveTo(X(x0 - 0.1), Y(top + 0.7)); g.lineTo(X(x0 + 1.2), Y(top + 3.5)); g.lineTo(X(x1 - 1.2), Y(top + 3.5)); g.lineTo(X(x1 + 0.1), Y(top + 0.7)); g.closePath();
        fuellen(g, "#6b4b46", rand, lw);
      }
    };
    nachbar(-25, -9.2, 34, "#cfcbc0", 1, 5);
    nachbar(9.2, 26, 31, "#b9583f", -1, 9);

    // Hauptfassade
    const x0 = -9.2, x1 = 9.2;
    if (A.sicht(boden, oben)) {
      g.beginPath(); A.R(g, x0, boden, x1, oben); fuellen(g, putz);
      // Putzstruktur (leichte Flecken)
      g.fillStyle = "rgba(150,100,40,0.06)";
      for (let i = 0; i < 70; i++) {
        const fy = boden + zz(i * 5 + 1) * (oben - boden);
        if (!A.sicht(fy - 1, fy + 1)) continue;
        g.beginPath(); g.ellipse(X(x0 + zz(i * 5 + 2) * (x1 - x0)), Y(fy), s * (0.4 + zz(i * 5 + 3)), s * 0.25, 0, 0, Math.PI * 2); g.fill();
      }
      // Ecksteine
      for (let y = boden; y < oben; y += 0.7) {
        if (!A.sicht(y, y + 0.7)) continue;
        const b = Math.round((y - boden) / 0.7) % 2 ? 0.55 : 0.85;
        g.beginPath(); A.R(g, x0, y, x0 + b, y + 0.66); A.R(g, x1 - b, y, x1, y + 0.66); fuellen(g, stuck, "rgba(42,29,20,0.4)", lw * 0.6);
      }
      // Regenrohr
      g.beginPath(); A.R(g, x0 + 1.05, boden, x0 + 1.3, oben + 0.3); fuellen(g, "#8b8f94", rand, lw * 0.7);
      for (let y = boden + 2; y < oben; y += 3) { if (A.sicht(y, y + 0.2)) { g.beginPath(); A.R(g, x0 + 1.0, y, x0 + 1.35, y + 0.15); fuellen(g, "#6f7378"); } }
    }
    // Sockel mit Quadern (Erdgeschoss)
    if (A.sicht(boden, 3.4)) {
      g.beginPath(); A.R(g, x0, boden, x1, 3.0); fuellen(g, "#cdb589", rand, lw);
      for (let y = boden + 0.6; y < 3.0; y += 0.6) linie(g, X(x0), Y(y), X(x1), Y(y), "rgba(80,55,25,0.45)", lw * 0.8);
      g.beginPath(); A.R(g, x0 - 0.1, 3.0, x1 + 0.1, 3.4); fuellen(g, stuck, rand, lw);
      // Kellerfenster
      for (const cx of SPALTEN) {
        if (cx === TUER_X) continue;
        g.beginPath(); A.R(g, cx - 0.6, boden + 0.75, cx + 0.6, boden + 1.5); fuellen(g, "#3a3030", rand, lw);
        for (let i = 1; i < 4; i++) linie(g, X(cx - 0.6 + i * 0.3), Y(boden + 0.75), X(cx - 0.6 + i * 0.3), Y(boden + 1.5), "#777", lw * 0.8);
      }
    }
    // Stockwerke mit Fenstern
    const reihen = reihenFuer(v);
    const o = { stuck, schatten, glas: t > 0.6 ? mische("#6b87a0", "#2f3656", (t - 0.6) / 0.4) : "#86a9c0" };
    reihen.forEach((sill, k) => {
      if (A.sicht(sill + 4.4, sill + 4.9)) {
        g.beginPath(); A.R(g, x0 - 0.1, sill + 4.5, x1 + 0.1, sill + 4.85); fuellen(g, stuck, rand, lw);
        g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(X(x0), Y(sill + 4.5), (x1 - x0) * s, s * 0.12);
      }
      if (!A.sicht(sill - 1.1, sill + 4.5)) return;
      SPALTEN.forEach((cx, j) => {
        if (k === 0 && cx === TUER_X) return;
        const ziel = hoch && cx === 0 && sill === v.fenster;
        const brennt = zz(k * 13 + j * 7 + 3) < 0.6 && !(k === 1 && cx === -3.5);
        fensterZ(g, A, cx, sill, Object.assign({ offen: ziel, gardine: zz(k * 5 + j * 3) < 0.6 }, o), brennt ? licht : null);
        verdachung(g, A, cx, sill, o, (k + (j % 2)) % 3);
        if (ziel) offenesFenster(g, A, cx, sill, v);
      });
      // Balkon über der Tür auf zweitem Stock (nur Zierde)
      if (k === 1 && A.sichtX(-5, -2)) {
        const bx = -3.5;
        g.beginPath(); A.R(g, bx - 1.5, sill - 0.35, bx + 1.5, sill); fuellen(g, stuck, rand, lw);
        g.strokeStyle = "#2d2a2a"; g.lineWidth = lw; g.beginPath();
        g.moveTo(X(bx - 1.4), Y(sill + 1.1)); g.lineTo(X(bx + 1.4), Y(sill + 1.1));
        for (let i = 0; i <= 10; i++) { g.moveTo(X(bx - 1.4 + i * 0.28), Y(sill)); g.lineTo(X(bx - 1.4 + i * 0.28), Y(sill + 1.1)); }
        g.stroke();
        g.beginPath(); kreis(g, X(bx + 1.0), Y(sill + 1.35), s * 0.3); kreis(g, X(bx + 0.7), Y(sill + 1.25), s * 0.25); fuellen(g, "#3c8f3f", rand, lw * 0.6);
        g.beginPath(); A.R(g, bx + 0.6, sill + 0.9, bx + 1.2, sill + 1.15); fuellen(g, "#c4643c", rand, lw * 0.6);
      }
    });
    // Haustür
    if (A.sicht(boden, 6.2) && A.sichtX(TUER_X - 2, TUER_X + 2)) {
      const cx = TUER_X;
      g.beginPath(); A.R(g, cx - 1.5, boden, cx + 1.5, 5.4);
      g.moveTo(X(cx - 1.5), Y(5.4)); g.arc(X(cx), Y(5.4), 1.5 * s, Math.PI, 0); fuellen(g, stuck, rand, lw);
      g.beginPath(); g.moveTo(X(cx - 1.15), Y(boden)); g.lineTo(X(cx - 1.15), Y(5.3)); g.arc(X(cx), Y(5.3), 1.15 * s, Math.PI, 0); g.lineTo(X(cx + 1.15), Y(boden)); g.closePath();
      fuellen(g, "#6d3b22", rand, lw);
      g.beginPath(); g.moveTo(X(cx - 1.0), Y(4.3)); g.lineTo(X(cx + 1.0), Y(4.3)); g.lineTo(X(cx + 1.0), Y(5.3)); g.arc(X(cx), Y(5.3), 1.0 * s, 0, Math.PI, true); g.closePath();
      fuellen(g, t > 0.6 ? "#ffd27a" : "#9bb5c6", rand, lw * 0.7);
      for (let i = -2; i <= 2; i++) linie(g, X(cx), Y(4.3), X(cx + Math.sin(i * 0.5) * 1.0), Y(4.3 + Math.cos(i * 0.5) * 1.0), rand, lw * 0.6);
      linie(g, X(cx), Y(boden), X(cx), Y(4.3), rand, lw);
      g.beginPath(); A.R(g, cx - 0.9, boden + 0.4, cx - 0.15, 2.0); A.R(g, cx + 0.15, boden + 0.4, cx + 0.9, 2.0); A.R(g, cx - 0.9, 2.3, cx - 0.15, 4.0); A.R(g, cx + 0.15, 2.3, cx + 0.9, 4.0);
      g.strokeStyle = "rgba(255,210,160,0.35)"; g.lineWidth = lw; g.stroke();
      g.beginPath(); kreis(g, X(cx - 0.3), Y(2.15), s * 0.08); kreis(g, X(cx + 0.3), Y(2.15), s * 0.08); fuellen(g, "#d8b04a", rand, lw * 0.5);
      // Hausnummer
      g.beginPath(); g.ellipse(X(cx + 1.9), Y(4.6), s * 0.32, s * 0.24, 0, 0, Math.PI * 2); fuellen(g, "#1f4e8c", "#f4e6c6", lw);
      g.fillStyle = "#fff"; g.font = "700 " + (s * 0.3).toFixed(1) + "px " + SCHRIFT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("12", X(cx + 1.9), Y(4.58));
    }
    // Dach: Kranzgesims mit Zahnschnitt, Mansarde, Gauben, Schornstein
    if (A.sicht(oben - 0.5, oben + 8)) {
      g.beginPath(); A.R(g, x0 - 0.2, oben - 0.4, x1 + 0.2, oben); fuellen(g, stuck, rand, lw);
      g.fillStyle = schatten;
      for (let x = x0; x < x1; x += 0.45) g.fillRect(X(x + 0.1), Y(oben - 0.4), s * 0.22, s * 0.22);
      g.beginPath(); A.R(g, x0 - 0.5, oben, x1 + 0.5, oben + 0.6); fuellen(g, stuck, rand, lw);
      // Schornstein
      g.beginPath(); A.R(g, 4.6, oben + 2, 5.6, oben + 6.2); fuellen(g, "#a84a35", rand, lw);
      g.beginPath(); A.R(g, 4.4, oben + 6.2, 5.8, oben + 6.6); fuellen(g, "#8a3a2a", rand, lw);
      g.beginPath(); g.moveTo(X(x0 - 0.3), Y(oben + 0.6)); g.lineTo(X(x0 + 1.4), Y(oben + 4.6)); g.lineTo(X(x1 - 1.4), Y(oben + 4.6)); g.lineTo(X(x1 + 0.3), Y(oben + 0.6)); g.closePath();
      fuellen(g, "#5a5f6e");
      g.save(); g.clip();
      for (let y = oben + 0.6; y < oben + 4.6; y += 0.45) {
        linie(g, 0, Y(y), v.w, Y(y), "rgba(20,20,30,0.35)", lw * 0.7);
        const vs = (Math.round((y - oben) / 0.45) % 2) * 0.3;
        for (let x = x0 + vs; x < x1; x += 0.6) linie(g, X(x), Y(y), X(x), Y(y + 0.45), "rgba(20,20,30,0.2)", lw * 0.5);
      }
      g.restore();
      g.beginPath(); g.moveTo(X(x0 - 0.3), Y(oben + 0.6)); g.lineTo(X(x0 + 1.4), Y(oben + 4.6)); g.lineTo(X(x1 - 1.4), Y(oben + 4.6)); g.lineTo(X(x1 + 0.3), Y(oben + 0.6)); g.closePath();
      fuellen(g, null, rand, lw);
      for (const gx of [-4, 0, 4]) {
        g.beginPath(); A.R(g, gx - 0.8, oben + 1.2, gx + 0.8, oben + 3.3); g.moveTo(X(gx - 1.0), Y(oben + 3.3)); g.lineTo(X(gx), Y(oben + 4.1)); g.lineTo(X(gx + 1.0), Y(oben + 3.3)); g.closePath();
        fuellen(g, stuck, rand, lw);
        g.beginPath(); A.R(g, gx - 0.5, oben + 1.4, gx + 0.5, oben + 2.9); fuellen(g, o.glas, rand, lw * 0.7);
        if (zz(gx + 50) < 0.7 && licht) licht.push([X(gx - 0.5), Y(oben + 2.9), s, 1.5 * s]);
        linie(g, X(gx), Y(oben + 1.4), X(gx), Y(oben + 2.9), rand, lw * 0.6);
      }
    }
  }
  // Das offene Fenster der neuen Wohnung (Ziel)
  function offenesFenster(g, A, cx, sill, v) {
    const s = A.s, X = A.X, Y = A.Y, lw = Math.max(1.2, s * 0.06), t = v.t || 0;
    // Zimmer innen, warmes Licht
    const gr = g.createRadialGradient(X(cx), Y(sill + 2.6), s * 0.2, X(cx), Y(sill + 1.6), s * 2.2);
    gr.addColorStop(0, "#ffe3a3"); gr.addColorStop(0.5, "#c98a52"); gr.addColorStop(1, "#5a3523");
    g.beginPath(); A.R(g, cx - 0.86, sill + 0.04, cx + 0.86, sill + 3.2); g.fillStyle = gr; g.fill();
    // Tapete, Kartons im Zimmer, Lampe
    g.save(); g.beginPath(); A.R(g, cx - 0.86, sill + 0.04, cx + 0.86, sill + 3.2); g.clip();
    g.fillStyle = "rgba(255,255,255,0.08)"; for (let i = 0; i < 6; i++) g.fillRect(X(cx - 0.8 + i * 0.32), Y(sill + 3.2), s * 0.12, 3.2 * s);
    g.beginPath(); A.R(g, cx + 0.15, sill, cx + 0.75, sill + 0.55); A.R(g, cx + 0.25, sill + 0.55, cx + 0.7, sill + 0.95); fuellen(g, "#b07e47", "rgba(42,29,20,0.7)", lw * 0.6);
    linie(g, X(cx - 0.15), Y(sill + 3.2), X(cx - 0.15), Y(sill + 2.55), TINTE, lw * 0.5);
    g.beginPath(); g.moveTo(X(cx - 0.4), Y(sill + 2.3)); g.lineTo(X(cx + 0.1), Y(sill + 2.3)); g.lineTo(X(cx - 0.05), Y(sill + 2.55)); g.lineTo(X(cx - 0.25), Y(sill + 2.55)); g.closePath(); fuellen(g, "#ffcf5a", TINTE, lw * 0.5);
    g.restore();
    // Gardine weht ein wenig heraus
    const w = Math.sin(t * 1.7) * 0.12;
    g.beginPath(); g.moveTo(X(cx - 0.86), Y(sill + 3.2)); g.lineTo(X(cx - 0.2), Y(sill + 3.2));
    g.bezierCurveTo(X(cx - 0.35 + w), Y(sill + 2.2), X(cx + 0.2 + w), Y(sill + 1.0), X(cx + 0.55 + w * 2), Y(sill + 0.25));
    g.quadraticCurveTo(X(cx - 0.1), Y(sill + 0.05), X(cx - 0.5), Y(sill + 0.15));
    g.quadraticCurveTo(X(cx - 0.75), Y(sill + 1.6), X(cx - 0.86), Y(sill + 3.2)); g.closePath();
    fuellen(g, "rgba(255,252,245,0.92)", "rgba(42,29,20,0.6)", lw * 0.6);
    linie(g, X(cx - 0.6), Y(sill + 3.1), X(cx - 0.5), Y(sill + 0.4), "rgba(160,140,120,0.35)", lw * 0.6);
    linie(g, X(cx - 0.4), Y(sill + 3.1), X(cx - 0.05 + w), Y(sill + 0.5), "rgba(160,140,120,0.35)", lw * 0.6);
    // Geöffnete Flügel nach außen
    const fluegel = (dir) => {
      const a = cx + dir * 0.86, b = cx + dir * 1.5;
      g.beginPath(); g.moveTo(X(a), Y(sill + 0.06)); g.lineTo(X(b), Y(sill - 0.18)); g.lineTo(X(b), Y(sill + 3.42)); g.lineTo(X(a), Y(sill + 3.18)); g.closePath();
      fuellen(g, "#f3eee2", TINTE, lw * 0.8);
      const a2 = cx + dir * 0.96, b2 = cx + dir * 1.4;
      g.beginPath(); g.moveTo(X(a2), Y(sill + 0.2)); g.lineTo(X(b2), Y(sill + 0.05)); g.lineTo(X(b2), Y(sill + 2.1)); g.lineTo(X(a2), Y(sill + 2.15)); g.closePath();
      g.moveTo(X(a2), Y(sill + 2.3)); g.lineTo(X(b2), Y(sill + 2.27)); g.lineTo(X(b2), Y(sill + 3.2)); g.lineTo(X(a2), Y(sill + 3.08)); g.closePath();
      fuellen(g, "#a9c8dc", "rgba(42,29,20,0.7)", lw * 0.5);
    };
    fluegel(-1); fluegel(1);
    // Leuchtender Rand, damit man das Ziel sofort sieht
    g.save(); g.beginPath(); A.R(g, cx - 0.92, sill, cx + 0.92, sill + 3.24);
    g.strokeStyle = "rgba(255,225,120," + (0.55 + Math.sin(t * 3) * 0.2).toFixed(2) + ")"; g.lineWidth = s * 0.14; g.stroke(); g.restore();
    // Blumenkasten
    g.beginPath(); A.R(g, cx - 0.7, sill, cx + 0.7, sill + 0.32); fuellen(g, "#8a4f2b", TINTE, lw * 0.7);
    for (let i = 0; i < 5; i++) { g.beginPath(); kreis(g, X(cx - 0.55 + i * 0.27), Y(sill + 0.42), s * 0.11); g.fillStyle = ["#e63946", "#ffd166", "#ff7ab6", "#ffffff", "#e63946"][i]; g.fill(); g.strokeStyle = TINTE; g.lineWidth = lw * 0.4; g.stroke(); }
  }
  // Ziellinie quer über das Bild mit Fähnchen „Ziel“
  function ziellinie(g, v, A) {
    const y = Math.round(A.Y(v.fenster)) + 0.5, s = A.s;
    if (y < -s || y > v.h + s) return;
    g.save();
    linie(g, 0, y, v.w, y, "rgba(42,29,20,0.55)", Math.max(3, s * 0.12));
    g.setLineDash([Math.max(6, s * 0.4), Math.max(4, s * 0.25)]);
    linie(g, 0, y, v.w, y, "#fff3a8", Math.max(1.5, s * 0.06));
    g.restore();
    // Fähnchen rechts
    const fx = v.w - Math.max(12, s * 0.5), fh = Math.max(16, s * 0.7);
    linie(g, fx, y, fx, y - fh * 1.6, TINTE, Math.max(1.5, s * 0.06));
    g.beginPath(); g.moveTo(fx, y - fh * 1.6); g.lineTo(fx - fh * 1.9, y - fh * 1.35); g.lineTo(fx, y - fh * 0.85); g.closePath();
    fuellen(g, "#d64545", TINTE, Math.max(1.2, s * 0.05));
    g.fillStyle = "#fff"; g.font = "700 " + (fh * 0.42).toFixed(1) + "px " + SCHRIFT; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("Ziel", fx - fh * 0.78, y - fh * 1.27);
  }
  // Gehweg, Bordstein und Kopfsteinpflaster
  function strasse(g, v, A, gehOben, gehUnten) {
    const s = A.s, X = A.X, Y = A.Y, lw = Math.max(1, s * 0.045);
    if (A.sicht(gehUnten, gehOben)) {
      g.beginPath(); A.R(g, A.xMin - 1, gehUnten, A.xMax + 1, gehOben); fuellen(g, "#b9b4ab");
      linie(g, 0, Y(gehOben), v.w, Y(gehOben), "rgba(42,29,20,0.6)", lw);
      const mitte = (gehOben + gehUnten) / 2;
      linie(g, 0, Y(mitte), v.w, Y(mitte), "rgba(60,50,40,0.3)", lw * 0.7);
      for (let x = Math.floor(A.xMin / 1.5) * 1.5; x < A.xMax; x += 1.5) {
        linie(g, X(x), Y(gehOben), X(x), Y(mitte), "rgba(60,50,40,0.3)", lw * 0.7);
        linie(g, X(x + 0.75), Y(mitte), X(x + 0.75), Y(gehUnten), "rgba(60,50,40,0.3)", lw * 0.7);
      }
      g.fillStyle = "rgba(255,255,255,0.15)"; g.fillRect(0, Y(gehOben), v.w, s * 0.1);
    }
    const bord = gehUnten - 0.35;
    if (A.sicht(bord, gehUnten)) { g.beginPath(); A.R(g, A.xMin - 1, bord, A.xMax + 1, gehUnten); fuellen(g, "#8e8a86", "rgba(42,29,20,0.6)", lw); }
    // Pflastersteine
    if (A.yMin < bord) {
      g.fillStyle = "#5e5a58"; g.fillRect(0, Y(bord), v.w, v.h - Y(bord));
      const hz = 0.45;
      for (let r = 0, y = bord; y > A.yMin && r < 60; r++, y -= hz) {
        const vs = (r % 2) * 0.3;
        for (let x = Math.floor(A.xMin) - vs; x < A.xMax; x += 0.6) {
          const n = zz(r * 131 + Math.round(x * 10));
          g.beginPath(); rund(g, X(x) + 1, Y(y) + 1, 0.6 * s - 2, hz * s - 2, s * 0.12);
          g.fillStyle = ["#8a8580", "#7c7773", "#948e87", "#6f6a67"][Math.floor(n * 4)]; g.fill();
        }
      }
    }
  }
  // Laterne (abends mit Licht)
  function laterne(g, v, A, lx, boden, leuchten) {
    const s = A.s, X = A.X, Y = A.Y, lw = Math.max(1, s * 0.05);
    if (!A.sichtX(lx - 2, lx + 2) || !A.sicht(boden, boden + 8)) return;
    if (leuchten > 0) {
      const gl = g.createRadialGradient(X(lx), Y(boden + 6.6), s * 0.2, X(lx), Y(boden + 6.6), s * 4);
      gl.addColorStop(0, "rgba(255,220,140," + (0.6 * leuchten).toFixed(2) + ")"); gl.addColorStop(1, "rgba(255,220,140,0)");
      g.fillStyle = gl; g.fillRect(X(lx) - s * 4, Y(boden + 6.6) - s * 4, s * 8, s * 8);
    }
    g.beginPath(); g.moveTo(X(lx - 0.35), Y(boden)); g.lineTo(X(lx + 0.35), Y(boden)); g.lineTo(X(lx + 0.18), Y(boden + 1.2)); g.lineTo(X(lx - 0.18), Y(boden + 1.2)); g.closePath();
    fuellen(g, "#2f4a3e", TINTE, lw);
    g.beginPath(); A.R(g, lx - 0.08, boden + 1.2, lx + 0.08, boden + 5.8); fuellen(g, "#2f4a3e", TINTE, lw);
    g.beginPath(); A.R(g, lx - 0.25, boden + 5.6, lx + 0.25, boden + 5.85); fuellen(g, "#2f4a3e", TINTE, lw * 0.8);
    // Glaskörper
    g.beginPath(); g.moveTo(X(lx - 0.3), Y(boden + 5.9)); g.lineTo(X(lx + 0.3), Y(boden + 5.9)); g.lineTo(X(lx + 0.5), Y(boden + 7.0)); g.lineTo(X(lx - 0.5), Y(boden + 7.0)); g.closePath();
    fuellen(g, leuchten > 0 ? mische("#d8e4e0", "#ffe08a", leuchten) : "#d8e4e0", TINTE, lw);
    linie(g, X(lx), Y(boden + 5.9), X(lx), Y(boden + 7.0), TINTE, lw * 0.6);
    g.beginPath(); g.moveTo(X(lx - 0.65), Y(boden + 7.0)); g.lineTo(X(lx + 0.65), Y(boden + 7.0)); g.lineTo(X(lx), Y(boden + 7.6)); g.closePath();
    fuellen(g, "#2f4a3e", TINTE, lw);
    g.beginPath(); kreis(g, X(lx), Y(boden + 7.7), s * 0.1); fuellen(g, "#2f4a3e", TINTE, lw * 0.6);
  }
  // Umzugswagen von außen (Seitenansicht), Heck rechts bei xHeck
  function wagenAussen(g, v, A, xHeck, boden) {
    const s = A.s, X = A.X, Y = A.Y, lw = Math.max(1, s * 0.05);
    const xv = xHeck - 10;
    if (!A.sichtX(xv - 4, xHeck + 1) || !A.sicht(boden, boden + 8)) return;
    // Kofferaufbau
    g.beginPath(); krakel(g, X(xv), Y(boden + 6.4), (xHeck - xv) * s, 5.4 * s, s * 0.2, s * 0.05, 91); fuellen(g, "#f0b429", TINTE, lw);
    g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(X(xv), Y(boden + 1.6), (xHeck - xv) * s, s * 0.6);
    g.fillStyle = "#fff8e6"; g.font = "700 " + (s * 1.1).toFixed(1) + "px " + SCHRIFT; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("UMZÜGE", X((xv + xHeck) / 2), Y(boden + 4.3));
    g.font = "700 " + (s * 0.55).toFixed(1) + "px " + SCHRIFT; g.fillText("schnell & (fast) heil", X((xv + xHeck) / 2), Y(boden + 2.9));
    // Heckleuchten und Türscharniere
    g.beginPath(); A.R(g, xHeck - 0.35, boden + 1.2, xHeck - 0.05, boden + 1.9); fuellen(g, "#e63946", TINTE, lw * 0.7);
    for (const y of [2.4, 4.0, 5.6]) { g.beginPath(); A.R(g, xHeck - 0.25, boden + y, xHeck, boden + y + 0.3); fuellen(g, "#888", TINTE, lw * 0.5); }
    linie(g, X(xHeck - 0.6), Y(boden + 1.3), X(xHeck - 0.6), Y(boden + 6.2), "rgba(42,29,20,0.6)", lw * 0.8);
    // Fahrerhaus
    g.beginPath(); g.moveTo(X(xv), Y(boden + 1.0)); g.lineTo(X(xv), Y(boden + 4.6)); g.lineTo(X(xv - 2.2), Y(boden + 4.6)); g.lineTo(X(xv - 3.4), Y(boden + 2.6)); g.lineTo(X(xv - 3.4), Y(boden + 1.0)); g.closePath();
    fuellen(g, "#e9e4d8", TINTE, lw);
    g.beginPath(); g.moveTo(X(xv - 0.3), Y(boden + 2.8)); g.lineTo(X(xv - 0.3), Y(boden + 4.3)); g.lineTo(X(xv - 2.0), Y(boden + 4.3)); g.lineTo(X(xv - 2.9), Y(boden + 2.8)); g.closePath();
    fuellen(g, "#8fb4cc", TINTE, lw * 0.8);
    // Unterboden und Räder
    g.beginPath(); A.R(g, xv - 3.4, boden + 0.6, xHeck, boden + 1.0); fuellen(g, "#3b3b3b", TINTE, lw);
    for (const rx of [xv - 1.8, xHeck - 2.4]) {
      g.beginPath(); kreis(g, X(rx), Y(boden + 0.75), s * 0.75); fuellen(g, "#232323", TINTE, lw);
      g.beginPath(); kreis(g, X(rx), Y(boden + 0.75), s * 0.33); fuellen(g, "#b9b9b9", TINTE, lw * 0.7);
    }
  }
  // Europalette, Oberkante bei y = 0, von x = -3 bis 3
  function palette(g, v) {
    const A = ansicht(v), s = A.s, X = A.X, Y = A.Y, lw = Math.max(1, s * 0.055);
    if (!A.sicht(-0.7, 0.1)) return;
    const holz = "#d7b07a", dunkel = "#a37a46";
    // Schatten auf dem Gehweg
    g.fillStyle = "rgba(0,0,0,0.18)"; g.beginPath(); g.ellipse(X(0), Y(-0.6), 3.3 * s, 0.18 * s, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); A.R(g, -3, -0.6, 3, -0.45); fuellen(g, dunkel, TINTE, lw);
    for (const bx of [-3, -0.35, 2.3]) {
      g.beginPath(); A.R(g, bx, -0.47, bx + 0.7, -0.13); fuellen(g, holz, TINTE, lw);
      g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(X(bx + 0.5), Y(-0.13), 0.2 * s, 0.34 * s);
    }
    g.fillStyle = "rgba(30,15,5,0.55)"; g.fillRect(X(-2.3), Y(-0.15), 1.95 * s, 0.3 * s); g.fillRect(X(0.35), Y(-0.15), 1.95 * s, 0.3 * s);
    g.beginPath(); A.R(g, -3, -0.15, 3, 0); fuellen(g, holz, TINTE, lw);
    // Maserung und Nägel
    linie(g, X(-2.8), Y(-0.07), X(-0.6), Y(-0.07), "rgba(120,80,40,0.45)", lw * 0.5);
    linie(g, X(0.4), Y(-0.08), X(2.7), Y(-0.08), "rgba(120,80,40,0.45)", lw * 0.5);
    g.fillStyle = "#555";
    for (const nx of [-2.65, -0.15, 2.65]) { g.beginPath(); kreis(g, X(nx), Y(-0.075), s * 0.035); g.fill(); }
    if (s >= 18) {
      g.fillStyle = "rgba(60,35,15,0.75)"; g.font = "700 " + (s * 0.2).toFixed(1) + "px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("EPAL", X(0), Y(-0.3));
    }
  }
  // Abenddämmerung darüberlegen (außer Lichter); bereich: wahlweise Liste von Pixel-Rechtecken [x, y, w, h]
  function daemmerung(g, v, bereich) {
    const t = klemm(v.tag || 0, 0, 1);
    const farbe = t < 0.5 ? mische("#fff8ee", "#fff0dc", t * 2) : mische("#fff0dc", "#9a6f92", (t - 0.5) * 2);
    g.save();
    if (bereich) { g.beginPath(); for (const [x, y, w, h] of bereich) g.rect(x, y, w, h); g.clip(); }
    g.globalCompositeOperation = "multiply"; g.fillStyle = farbe; g.fillRect(0, 0, v.w, v.h); g.restore();
  }
  function lichterAn(g, v, licht) {
    const t = klemm(v.tag || 0, 0, 1), a = klemm((t - 0.55) / 0.3, 0, 1);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    for (const [x, y, w, h] of licht) {
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, "#ffe9a8"); gr.addColorStop(1, "#ffbe5c");
      g.fillStyle = gr; g.fillRect(x, y, w, h);
    }
    g.restore();
  }

  function hintergrund(g, v) {
    const A = ansicht(v), s = A.s, licht = [];
    const t = klemm(v.tag || 0, 0, 1), leuchten = klemm((t - 0.55) / 0.3, 0, 1);
    himmel(g, v, A);
    if (v.modus === "wagen") { wagenInnen(g, v, A, licht); return; }
    haus(g, v, A, -0.6, licht);
    wagenAussen(g, v, A, -5.3, -0.6);
    strasse(g, v, A, -0.6, -2.4);
    laterne(g, v, A, 4.9, -0.6, 0);
    daemmerung(g, v);
    // Lichter in den Fenstern, aber nicht durch den Wagen hindurch
    const wx = A.X(-5.2), wy = A.Y(7.0);
    lichterAn(g, v, licht.filter(([x, y, w, h]) => !(x < wx && y + h > wy)));
    if (leuchten > 0) laterne(g, v, A, 4.9, -0.6, leuchten);
    if (v.modus === "hoch" && v.fenster != null && t > 0.3 && A.sicht(v.fenster - 1, v.fenster + 4)) {
      // das Zielfenster bleibt hell
      g.save(); g.globalAlpha = klemm((t - 0.3) * 2, 0, 1); offenesFenster(g, A, 0, v.fenster, v); g.restore();
    }
    palette(g, v);
    if (v.modus === "hoch" && v.fenster != null) ziellinie(g, v, A);
  }

  // Laderaum des Umzugswagens: Boden y = 0 von x = -5 bis 4, Rückwand links, Dach bei v.dach, Ladeklappe rechts
  function wagenInnen(g, v, A, licht) {
    const s = A.s, X = A.X, Y = A.Y, lw = Math.max(1.2, s * 0.06);
    const dach = v.dach == null ? 7 : v.dach;
    const strY = -2.4;
    // Häuser hinten, etwas blasser
    haus(g, Object.assign({}, v, { modus: "kaputt", fenster: null }), A, strY + 0.3, licht);
    daemmerung(g, v);
    lichterAn(g, v, licht);
    g.fillStyle = "rgba(255,245,230,0.25)"; g.fillRect(0, 0, v.w, v.h);
    strasse(g, v, A, strY + 0.3, strY);
    // Aufbau außen
    const xa = -5.8, xe = 4.25, aussen = "#f0b429";
    g.beginPath(); krakel(g, X(xa), Y(dach + 0.65), (xe - xa) * s, (dach + 1.25) * s, s * 0.18, s * 0.03, 93); fuellen(g, aussen, TINTE, lw);
    g.fillStyle = "#fff8e6"; g.font = "700 " + (s * 0.45).toFixed(1) + "px " + SCHRIFT; g.textAlign = "center"; g.textBaseline = "middle";
    // Laderaum innen
    g.beginPath(); A.R(g, -5, 0, 4, dach); fuellen(g, "#dcbf8f");
    g.save(); g.beginPath(); A.R(g, -5, 0, 4, dach); g.clip();
    for (let x = -5; x < 4; x += 1.5) {
      linie(g, X(x), Y(0), X(x), Y(dach), "rgba(110,75,35,0.45)", lw * 0.6);
      g.fillStyle = zz(Math.round(x * 2) + 7) < 0.5 ? "rgba(255,255,255,0.08)" : "rgba(120,80,30,0.08)"; g.fillRect(X(x), Y(dach), 1.5 * s, dach * s);
    }
    // Zurrschiene
    for (const zy of [dach * 0.38, dach * 0.75]) {
      g.beginPath(); A.R(g, -5, zy, 4, zy + 0.22); fuellen(g, "#b9bec4", "rgba(42,29,20,0.5)", lw * 0.5);
      g.fillStyle = "#555"; for (let x = -4.8; x < 4; x += 0.4) g.fillRect(X(x), Y(zy + 0.15), s * 0.16, s * 0.08);
    }
    // Schatten oben und an der Rückwand
    let gr = g.createLinearGradient(0, Y(dach), 0, Y(dach - 1.4)); gr.addColorStop(0, "rgba(40,20,5,0.45)"); gr.addColorStop(1, "rgba(40,20,5,0)");
    g.fillStyle = gr; g.fillRect(X(-5), Y(dach), 9 * s, 1.4 * s);
    gr = g.createLinearGradient(X(-5), 0, X(-3.8), 0); gr.addColorStop(0, "rgba(40,20,5,0.4)"); gr.addColorStop(1, "rgba(40,20,5,0)");
    g.fillStyle = gr; g.fillRect(X(-5), Y(dach), 1.2 * s, dach * s);
    g.restore();
    g.beginPath(); A.R(g, -5, 0, 4, dach); fuellen(g, null, "rgba(42,29,20,0.6)", lw * 0.7);
    // Rückwand (dick)
    g.beginPath(); A.R(g, -5.8, -0.6, -5, dach + 0.65); fuellen(g, "#c98f1a", TINTE, lw);
    g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(X(-5.15), Y(dach), s * 0.15, dach * s);
    // Dach
    g.beginPath(); A.R(g, -5.8, dach, 4.25, dach + 0.65); fuellen(g, "#c98f1a", TINTE, lw);
    g.fillStyle = "#fff8e6"; g.fillText("UMZÜGE · schnell & (fast) heil", X(-0.8), Y(dach + 0.33));
    // Boden mit Holzbohlen, Unterbau, Räder
    g.beginPath(); A.R(g, -5.8, -0.6, 4.25, 0); fuellen(g, "#8a5a32", TINTE, lw);
    g.fillStyle = "#a8743f"; g.fillRect(X(-5), Y(0), 9 * s, s * 0.14);
    for (let x = -4.4; x < 4; x += 1.1) linie(g, X(x), Y(0), X(x), Y(-0.6), "rgba(42,29,20,0.35)", lw * 0.6);
    g.beginPath(); A.R(g, -5.8, -1.05, 4.25, -0.6); fuellen(g, "#3b3b3b", TINTE, lw);
    for (const rx of [-3.6, 1.6]) {
      g.beginPath(); kreis(g, X(rx), Y(strY + 0.78), s * 0.78); fuellen(g, "#222", TINTE, lw);
      g.beginPath(); kreis(g, X(rx), Y(strY + 0.78), s * 0.34); fuellen(g, "#b9b9b9", TINTE, lw * 0.7);
    }
    g.beginPath(); A.R(g, 3.9, -1.2, 4.35, -0.55); fuellen(g, "#e63946", TINTE, lw * 0.6);
    // Fahrerhaus links hinter der Rückwand
    g.beginPath(); g.moveTo(X(-5.8), Y(-1.0)); g.lineTo(X(-5.8), Y(3.6)); g.lineTo(X(-8.2), Y(3.6)); g.lineTo(X(-9.5), Y(1.4)); g.lineTo(X(-9.5), Y(-1.0)); g.closePath();
    fuellen(g, "#e9e4d8", TINTE, lw);
    g.beginPath(); g.moveTo(X(-6.1), Y(1.6)); g.lineTo(X(-6.1), Y(3.3)); g.lineTo(X(-8.0), Y(3.3)); g.lineTo(X(-9.0), Y(1.6)); g.closePath(); fuellen(g, "#8fb4cc", TINTE, lw * 0.8);
    g.beginPath(); kreis(g, X(-7.8), Y(strY + 0.78), s * 0.78); fuellen(g, "#222", TINTE, lw);
    g.beginPath(); kreis(g, X(-7.8), Y(strY + 0.78), s * 0.34); fuellen(g, "#b9b9b9", TINTE, lw * 0.7);
    // Ladeklappe als Rampe nach unten
    const rx0 = 4.25, ry0 = 0, rx1 = 7.6, ry1 = strY;
    g.beginPath(); g.moveTo(X(rx0), Y(ry0)); g.lineTo(X(rx1), Y(ry1)); g.lineTo(X(rx1), Y(ry1 - 0.0) + s * 0.18); g.lineTo(X(rx0), Y(ry0 - 0.3)); g.closePath();
    fuellen(g, "#aeb3b8", TINTE, lw);
    for (let i = 1; i < 7; i++) {
      const f = i / 7, x = rx0 + (rx1 - rx0) * f, y = ry0 + (ry1 - ry0) * f;
      linie(g, X(x - 0.12), Y(y + 0.05), X(x + 0.12), Y(y + 0.17), "rgba(42,29,20,0.6)", lw * 0.6);
    }
    // Scharnier
    g.beginPath(); kreis(g, X(rx0), Y(-0.15), s * 0.12); fuellen(g, "#777", TINTE, lw * 0.6);
    daemmerung(g, v, [[X(-5.8), Y(dach + 0.7), 10.15 * s, (dach + 0.7 - strY) * s], [X(-9.6), Y(3.7), 3.8 * s, (3.7 - strY) * s], [0, Y(strY + 0.3), v.w, v.h]]);
    // Laserlinie knapp unter dem Dach
    const ly = Y(dach - 0.15);
    g.save();
    linie(g, X(-5), ly, X(4), ly, "rgba(255,40,40,0.3)", Math.max(6, s * 0.28));
    linie(g, X(-5), ly, X(4), ly, "rgba(255,60,60,0.5)", Math.max(3, s * 0.12));
    g.setLineDash([Math.max(5, s * 0.3), Math.max(3, s * 0.15)]);
    linie(g, X(-5), ly, X(4), ly, "#ff1f1f", Math.max(1.5, s * 0.06));
    g.setLineDash([]);
    linie(g, X(-5), ly, X(4), ly, "rgba(255,230,230,0.9)", Math.max(0.8, s * 0.02));
    g.restore();
    g.beginPath(); A.R(g, -5, dach - 0.3, -4.6, dach); fuellen(g, "#333", TINTE, lw * 0.6);
    g.beginPath(); kreis(g, X(-4.6), ly, s * 0.07); fuellen(g, "#ff4040");

  }

  // ---------- Effekte ----------
  function regen(g, v, t) {
    g.save();
    g.fillStyle = "rgba(40,60,95,0.16)"; g.fillRect(0, 0, v.w, v.h);
    g.strokeStyle = "rgba(205,225,255,0.65)"; g.lineCap = "round";
    const n = Math.round((v.w * v.h) / 2600), l = Math.max(10, (v.s || 30) * 0.45);
    g.lineWidth = Math.max(1, (v.s || 30) * 0.04);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const sp = 0.9 + zz(i * 3 + 2) * 0.5;
      const y = ((zz(i * 3 + 1) * (v.h + 60) + t * 700 * sp) % (v.h + 60)) - 30;
      const x = ((zz(i * 3) * (v.w + 40) - y * 0.18) % (v.w + 40) + v.w + 40) % (v.w + 40) - 20;
      g.moveTo(x, y); g.lineTo(x - l * 0.18, y + l * sp);
    }
    g.stroke();
    // Spritzer unten
    g.strokeStyle = "rgba(220,235,255,0.5)"; g.beginPath();
    for (let i = 0; i < 14; i++) {
      const p = (t * 2.3 + zz(i + 400)) % 1, x = zz(i + 500) * v.w, y = v.h - 4 - zz(i + 600) * 30, r = 2 + p * 7;
      g.moveTo(x - r, y); g.quadraticCurveTo(x, y - r * 0.8, x + r, y);
    }
    g.stroke();
    g.restore();
  }

  function laken(g, x, y, w, h, t) {
    const p = Math.min(w, h) * 0.07, lw = Math.max(1.5, Math.min(w, h) * 0.012);
    const wel = (k, a) => Math.sin(t * 5.2 + k) * a + Math.sin(t * 8.1 + k * 1.7) * a * 0.4;
    const pfad = () => {
      g.beginPath();
      const n = 6;
      g.moveTo(x - p, y - p + wel(0, p * 0.3));
      for (let i = 1; i <= n; i++) { const xx = x - p + ((w + 2 * p) * i) / n; g.quadraticCurveTo(xx - (w + 2 * p) / (2 * n), y - p + wel(i, p * 0.5) - p * 0.4, xx, y - p + wel(i + 0.5, p * 0.3)); }
      for (let i = 1; i <= n; i++) { const yy = y - p + ((h + 2 * p) * i) / n; g.quadraticCurveTo(x + w + p + wel(i + 3, p * 0.9), yy - (h + 2 * p) / (2 * n), x + w + p + wel(i + 4, p * 0.6), yy); }
      for (let i = 1; i <= n; i++) { const xx = x + w + p - ((w + 2 * p) * i) / n; g.quadraticCurveTo(xx + (w + 2 * p) / (2 * n), y + h + p + wel(i + 7, p * 1.4) + p * 0.5, xx, y + h + p + wel(i + 8, p)); }
      for (let i = 1; i <= n; i++) { const yy = y + h + p - ((h + 2 * p) * i) / n; g.quadraticCurveTo(x - p + wel(i + 11, p * 0.9), yy + (h + 2 * p) / (2 * n), x - p + wel(i + 12, p * 0.6), yy); }
      g.closePath();
    };
    g.save();
    // Schatten
    g.save(); g.translate(p * 0.4, p * 0.5); pfad(); g.fillStyle = "rgba(0,0,0,0.2)"; g.fill(); g.restore();
    pfad(); g.fillStyle = "#f8f6f0"; g.fill();
    g.save(); g.clip();
    // Falten, die mitwehen
    for (let i = 0; i < 7; i++) {
      const fx = x + (w * (i + 0.5)) / 7 + wel(i * 2, p);
      const gr = g.createLinearGradient(fx - w * 0.06, 0, fx + w * 0.06, 0);
      gr.addColorStop(0, "rgba(150,160,180,0)"); gr.addColorStop(0.5, "rgba(150,160,180,0.28)"); gr.addColorStop(1, "rgba(150,160,180,0)");
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(fx - w * 0.06, y - p * 2); g.quadraticCurveTo(fx + wel(i, w * 0.04), y + h / 2, fx - w * 0.06 + wel(i + 1, w * 0.05), y + h + p * 3);
      g.lineTo(fx + w * 0.06 + wel(i + 1, w * 0.05), y + h + p * 3); g.quadraticCurveTo(fx + wel(i, w * 0.04) + w * 0.08, y + h / 2, fx + w * 0.06, y - p * 2); g.fill();
    }
    // Zartes blaues Streifenmuster am Saum
    g.fillStyle = "rgba(90,130,200,0.35)"; g.fillRect(x - p * 2, y + h + p * 0.1 + wel(9, p * 0.6), w + p * 4, p * 0.35);
    g.restore();
    pfad(); g.strokeStyle = TINTE; g.lineWidth = lw; g.lineJoin = "round"; g.stroke();
    // Wäscheklammern oben
    for (const kx of [x + w * 0.12, x + w * 0.88]) {
      g.beginPath(); rund(g, kx - p * 0.25, y - p * 2.0, p * 0.5, p * 1.6, p * 0.15); fuellen(g, "#e6b86a", TINTE, lw * 0.8);
    }
    g.restore();
  }

  // Getigerte Katze, (0,0) = Mitte unter den Pfoten, y nach unten, schaut nach rechts.
  // schritt: true = läuft (Beine bewegen sich), false = steht still. Für die andere Richtung g.scale(-1, 1) vorher.
  function katze(g, s, t, schritt) {
    const fell = "#e8913a", streif = "#a8561c", hell = "#f8d9a8", lw = Math.max(1, s * 0.055);
    const ph = schritt ? t * 11 : 0;
    const bein = (bx, phase, hinten) => {
      const sw = schritt ? Math.sin(ph + phase) * s * 0.09 : 0, hb = schritt ? Math.max(0, Math.cos(ph + phase)) * s * 0.05 : 0;
      g.beginPath(); g.moveTo(bx * s - s * 0.05, -0.3 * s); g.lineTo(bx * s + sw - s * 0.045, -hb); g.lineTo(bx * s + sw + s * 0.06, -hb); g.lineTo(bx * s + s * 0.06, -0.3 * s); g.closePath();
      fuellen(g, hinten ? dunkler(fell, 0.2) : fell, TINTE, lw);
      g.beginPath(); g.ellipse(bx * s + sw + s * 0.01, -hb - s * 0.02, s * 0.07, s * 0.04, 0, 0, Math.PI * 2); fuellen(g, hell, TINTE, lw * 0.7);
    };
    const hub = schritt ? Math.abs(Math.sin(ph)) * s * 0.02 : 0;
    g.save();
    // hintere Beine (weiter weg)
    bein(-0.3, Math.PI, true); bein(0.25, 0, true);
    g.translate(0, -hub);
    // Schwanz
    const sw = Math.sin(t * 3) * 0.15;
    g.beginPath(); g.moveTo(-0.38 * s, -0.42 * s);
    g.bezierCurveTo(-0.7 * s, -0.45 * s, -0.72 * s, -0.75 * s, (-0.6 + sw) * s, -0.95 * s);
    g.strokeStyle = TINTE; g.lineWidth = s * 0.15; g.lineCap = "round"; g.stroke();
    g.strokeStyle = fell; g.lineWidth = s * 0.1; g.stroke();
    g.beginPath(); kreis(g, (-0.6 + sw) * s, -0.95 * s, s * 0.05); fuellen(g, streif);
    // Körper
    g.beginPath(); g.ellipse(0, -0.42 * s, 0.44 * s, 0.19 * s, 0, 0, Math.PI * 2); fuellen(g, fell);
    g.save(); g.clip();
    g.fillStyle = hell; g.beginPath(); g.ellipse(0.05 * s, -0.26 * s, 0.32 * s, 0.08 * s, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = streif; g.lineWidth = s * 0.06; g.lineCap = "round";
    for (let i = 0; i < 5; i++) { const sx = (-0.3 + i * 0.13) * s; g.beginPath(); g.moveTo(sx - s * 0.03, -0.62 * s); g.quadraticCurveTo(sx + s * 0.04, -0.5 * s, sx, -0.38 * s); g.stroke(); }
    g.restore();
    g.beginPath(); g.ellipse(0, -0.42 * s, 0.44 * s, 0.19 * s, 0, 0, Math.PI * 2); fuellen(g, null, TINTE, lw);
    // vordere Beine
    bein(-0.22, 0, false); bein(0.33, Math.PI, false);
    // Kopf
    const kx = 0.48 * s, ky = -0.6 * s, kr = 0.19 * s;
    g.beginPath();
    g.moveTo(kx - kr * 0.85, ky - kr * 0.35); g.lineTo(kx - kr * 0.6, ky - kr * 1.45); g.lineTo(kx - kr * 0.05, ky - kr * 0.8);
    g.moveTo(kx + kr * 0.15, ky - kr * 0.85); g.lineTo(kx + kr * 0.75, ky - kr * 1.4); g.lineTo(kx + kr * 0.9, ky - kr * 0.3);
    fuellen(g, fell, TINTE, lw);
    g.beginPath(); g.ellipse(kx, ky, kr * 1.05, kr * 0.9, 0, 0, Math.PI * 2); fuellen(g, fell, TINTE, lw);
    g.beginPath(); g.moveTo(kx - kr * 0.55, ky - kr * 0.55); g.lineTo(kx - kr * 0.5, ky - kr * 1.1); g.lineTo(kx - kr * 0.2, ky - kr * 0.75); g.fillStyle = "#f4a3a3"; g.fill();
    g.strokeStyle = streif; g.lineWidth = s * 0.035;
    g.beginPath(); g.moveTo(kx - kr * 0.25, ky - kr * 0.85); g.lineTo(kx - kr * 0.15, ky - kr * 0.5); g.moveTo(kx + kr * 0.1, ky - kr * 0.88); g.lineTo(kx + kr * 0.08, ky - kr * 0.5); g.stroke();
    g.beginPath(); g.ellipse(kx + kr * 0.4, ky + kr * 0.3, kr * 0.5, kr * 0.38, 0, 0, Math.PI * 2); g.fillStyle = hell; g.fill();
    // Augen (blinzeln ab und zu)
    const zu = (t % 3.2) < 0.15;
    g.fillStyle = TINTE;
    if (zu) { linie(g, kx - kr * 0.15, ky - kr * 0.1, kx + kr * 0.15, ky - kr * 0.1, TINTE, lw * 0.7); linie(g, kx + kr * 0.45, ky - kr * 0.1, kx + kr * 0.75, ky - kr * 0.1, TINTE, lw * 0.7); }
    else {
      g.beginPath(); g.ellipse(kx, ky - kr * 0.1, kr * 0.14, kr * 0.2, 0, 0, Math.PI * 2); g.ellipse(kx + kr * 0.6, ky - kr * 0.1, kr * 0.14, kr * 0.2, 0, 0, Math.PI * 2);
      g.fillStyle = "#7ac943"; g.fill(); g.fillStyle = TINTE;
      g.beginPath(); g.ellipse(kx + kr * 0.02, ky - kr * 0.1, kr * 0.05, kr * 0.16, 0, 0, Math.PI * 2); g.ellipse(kx + kr * 0.62, ky - kr * 0.1, kr * 0.05, kr * 0.16, 0, 0, Math.PI * 2); g.fill();
    }
    g.beginPath(); g.moveTo(kx + kr * 0.5, ky + kr * 0.18); g.lineTo(kx + kr * 0.7, ky + kr * 0.18); g.lineTo(kx + kr * 0.6, ky + kr * 0.3); g.closePath(); g.fillStyle = "#e46d7a"; g.fill();
    // Schnurrhaare
    g.strokeStyle = "rgba(42,29,20,0.7)"; g.lineWidth = Math.max(0.5, s * 0.015); g.beginPath();
    for (const d of [-0.1, 0.08]) { g.moveTo(kx + kr * 0.85, ky + kr * 0.3); g.lineTo(kx + kr * 1.6, ky + kr * (0.25 + d * 3)); }
    g.stroke();
    g.restore();
  }

  // Bruch: Scherben fliegen auseinander, k = 0..1 Fortschritt, s = Größe (Pixel pro Feld, wahlweise)
  function scherben(g, x, y, k, s) {
    s = s || 30; k = klemm(k, 0, 1);
    g.save(); g.translate(x, y);
    // Blitz am Anfang
    if (k < 0.35) {
      const a = 1 - k / 0.35, r = s * (0.5 + k * 3);
      g.beginPath();
      for (let i = 0; i < 16; i++) { const w = (i / 16) * Math.PI * 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(w) * rr, Math.sin(w) * rr); }
      g.closePath(); g.fillStyle = "rgba(255,240,160," + (a * 0.85).toFixed(2) + ")"; g.fill();
      g.strokeStyle = "rgba(42,29,20," + (a * 0.6).toFixed(2) + ")"; g.lineWidth = Math.max(1, s * 0.04); g.stroke();
    }
    g.globalAlpha = 1 - k * k;
    const lw = Math.max(1, s * 0.04);
    for (let i = 0; i < 12; i++) {
      const w = zz(i * 7 + 1) * Math.PI * 2, v = (0.8 + zz(i * 7 + 2) * 1.6) * s * 1.6;
      const px = Math.cos(w) * v * k, py = Math.sin(w) * v * k - s * 1.2 * k + s * 3 * k * k;
      const gr = s * (0.12 + zz(i * 7 + 3) * 0.18);
      g.save(); g.translate(px, py); g.rotate(k * (zz(i * 7 + 4) - 0.5) * 12);
      g.beginPath(); g.moveTo(-gr, -gr * 0.4); g.lineTo(gr * 0.8, -gr * 0.8); g.lineTo(gr * 0.3, gr); g.closePath();
      fuellen(g, i % 3 === 0 ? "#c8965a" : "rgba(200,235,250,0.9)", TINTE, lw);
      if (i % 3) linie(g, -gr * 0.4, -gr * 0.3, gr * 0.3, -gr * 0.55, "rgba(255,255,255,0.9)", lw);
      g.restore();
    }
    g.restore();
  }

  // Lot: zwei gestrichelte senkrechte Linien mit Schatten dazwischen (Pixel)
  function lot(g, x0, x1, yOben, yUnten) {
    if (yUnten <= yOben) return;
    g.save();
    const gr = g.createLinearGradient(0, yOben, 0, yUnten);
    gr.addColorStop(0, "rgba(255,255,255,0.05)"); gr.addColorStop(1, "rgba(255,255,255,0.22)");
    g.fillStyle = gr; g.fillRect(x0, yOben, x1 - x0, yUnten - yOben);
    g.fillStyle = "rgba(42,29,20,0.18)"; g.fillRect(x0, yUnten - 3, x1 - x0, 3);
    g.setLineDash([7, 6]); g.lineWidth = 2;
    for (const x of [x0, x1]) {
      linie(g, x + 1, yOben + 1, x + 1, yUnten + 1, "rgba(42,29,20,0.35)", 2);
      linie(g, x, yOben, x, yUnten, "rgba(255,255,255,0.85)", 2);
    }
    g.restore();
  }

  // Kleiner Turm eines Mitspielers. teile = [{typ, x, y, a}] (Welt, y nach oben, a gegen den Uhrzeigersinn)
  // v = { w, h, s, farbe, fenster, unten, hinter (Hintergrund füllen, Standard ja) }
  function miniTurm(g, teile, v) {
    const s = v.s, unten = v.unten == null ? -1 : v.unten, mx = v.w / 2;
    const X = x => mx + x * s, Y = y => v.h - (y - unten) * s;
    g.save();
    if (v.hinter !== false) {
      g.fillStyle = "#ecd6a6"; g.fillRect(0, 0, v.w, v.h);
      g.fillStyle = "rgba(150,110,60,0.18)";
      for (let k = 0; k < 8; k++) { const y = Y(4 + 6 * k + 4.5); if (y > -s && y < v.h) g.fillRect(0, y, v.w, Math.max(1, s * 0.3)); }
    }
    // Boden und Palette
    g.fillStyle = "#9d978e"; g.fillRect(0, Y(-0.6), v.w, v.h - Y(-0.6));
    g.fillStyle = "#b07e45"; g.fillRect(X(-3), Y(0), 6 * s, 0.6 * s);
    g.fillStyle = "#d7b07a"; g.fillRect(X(-3), Y(0), 6 * s, Math.max(1, 0.18 * s));
    // Ziellinie
    if (v.fenster != null) {
      const y = Math.round(Y(v.fenster)) + 0.5;
      g.save(); g.setLineDash([3, 2]); linie(g, 0, y, v.w, y, v.farbe || "#d64545", 1.5); g.restore();
    }
    for (const p of teile || []) {
      g.save(); g.translate(X(p.x), Y(p.y)); g.rotate(-(p.a || 0));
      teil(g, p.typ, s, { klein: true, farbe: v.farbe, nass: p.nass });
      g.restore();
    }
    g.restore();
  }

  W.SG_ZEICHNEN = { teil, vorschau, hintergrund, palette, regen, laken, katze, scherben, lot, miniTurm, FARBEN, TINTE, SCHRIFT, mische };
})(typeof window !== "undefined" ? window : globalThis);
