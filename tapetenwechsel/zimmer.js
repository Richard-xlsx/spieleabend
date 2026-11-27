// Tapetenwechsel: Zimmer aus dem Startwert (Konzept: KONZEPT.md, Abschnitte 2, 8 und 10).
// Alles wird im Code gebaut: Möbel aus einfachen Formen, Muster werden in Leinwände (Canvas) gemalt. Nichts wird geladen.
// Gleicher Startwert → gleiches Zimmer auf jedem Handy (alle Zufallszahlen kommen aus zufall(seed), in fester Reihenfolge).
//
// Für die Pipette liefert farbeAn(treffer) die Grundfarbe (Albedo) an der getroffenen Stelle, ohne Licht.
// Dafür gibt es nur drei Sorten Stoff, alle MeshLambertMaterial:
//   1. mit Muster (map, sRGB-CanvasTexture): Farbe wird aus der Leinwand gelesen
//   2. mit Eckfarben (vertexColors): viele einfarbige Teile in einem Mesh zusammengefasst (spart Zeichenaufrufe)
//   3. mit fester Farbe (color)
// Muster liegen in Metern auf den Flächen (UV = Meter, map.repeat = 1 / Kachelgröße), eine Tapete ist also überall gleich groß.
// „Bilder“ (Ölbild, Poster, Schrankfronten) liegen dagegen genau einmal auf ihrer Fläche (UV 0..1).
import * as THREE from "three";

export const ZIMMER = {
  wohnzimmer: { name: "Omas Wohnzimmer" },
  kinderzimmer: { name: "Kinderzimmer" },
  kueche: { name: "Küche" },
};

// Zufallszahlen (mulberry32): gleicher Startwert, gleiche Folge
export function zufall(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Licht: hell und gleichmäßig wie am Nachmittag, ohne Schatten (Zimmer und Klecks nutzen dasselbe Licht)
export function licht(szene) {
  szene.background = new THREE.Color("#e8e0d2");
  const himmel = new THREE.HemisphereLight("#ffffff", "#d6ccbd", 2.45);
  const sonne = new THREE.DirectionalLight("#fff4e2", 0.85);
  sonne.position.set(-3, 6, 2.2);
  szene.add(himmel, sonne);
  return { himmel, sonne };
}

// ---------- Bauzustand (baue läuft synchron, daher reicht ein Modulzustand) ----------
let B = null;
const R = { x0: -3.5, x1: 3.5, z0: -2.5, z1: 2.5, h: 2.8 };

const zw = (a, b) => a + (b - a) * B.rng();
const ganz = (a, b) => a + Math.floor(B.rng() * (b - a + 1));
const wahl = l => l[Math.floor(B.rng() * l.length)];
const ja = (p = .5) => B.rng() < p;
function mischen(l) { const k = l.slice(); for (let i = k.length - 1; i > 0; i--) { const j = Math.floor(B.rng() * (i + 1)); [k[i], k[j]] = [k[j], k[i]]; } return k; }
const PI = Math.PI;

// ---------- Farben ----------
function rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function hex(r, g, b) { return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
function mix(a, b, t) { const p = rgb(a), q = rgb(b); return hex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t); }
const hell = (a, t) => mix(a, "#ffffff", t), dunkel = (a, t) => mix(a, "#000000", t);
function wackel(a, t) { const p = rgb(a), k = 1 + (B.rng() * 2 - 1) * t; return hex(p[0] * k, p[1] * k, p[2] * k); }

// ---------- Malen ----------
function leinwand(w, h = w) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function rect(g, x, y, w, h, f) { g.fillStyle = f; g.fillRect(x, y, w, h); }
function kreis(g, x, y, r, f) { g.fillStyle = f; g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill(); }
function oval(g, x, y, rx, ry, rot, f) { g.fillStyle = f; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, PI * 2); g.fill(); }
function raute(g, x, y, rx, ry, f) { g.fillStyle = f; g.beginPath(); g.moveTo(x, y - ry); g.lineTo(x + rx, y); g.lineTo(x, y + ry); g.lineTo(x - rx, y); g.closePath(); g.fill(); }
function vieleck(g, pkte, f) { g.fillStyle = f; g.beginPath(); pkte.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); }
function rundrect(g, x, y, w, h, r, f) { g.fillStyle = f; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
function stern(g, x, y, r, f, zacken = 5) { const p = []; for (let i = 0; i < zacken * 2; i++) { const a = -PI / 2 + i * PI / zacken, rr = i % 2 ? r * .45 : r; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } vieleck(g, p, f); }
// zeichnet an allen Stellen, an denen das Motiv über den Rand einer Kachel ragt, noch einmal (nahtlose Muster)
function rundum(W, H, x, y, r, fn) { for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) { const X = x + dx, Y = y + dy; if (X > -r && X < W + r && Y > -r && Y < H + r) fn(X, Y); } }
// erhabene oder vertiefte Kante (Licht von oben links)
function fase(g, x, y, w, h, d = 3, tief = false) {
  const a = tief ? "rgba(0,0,0,.28)" : "rgba(255,255,255,.22)", b = tief ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.3)";
  g.fillStyle = a; g.fillRect(x, y, w, d); g.fillRect(x, y, d, h);
  g.fillStyle = b; g.fillRect(x, y + h - d, w, d); g.fillRect(x + w - d, y, d, h);
}
function holzBild(g, holz, x, y, w, h) { for (let yy = 0; yy < h; yy += holz.height) for (let xx = 0; xx < w; xx += holz.width) { const ww = Math.min(holz.width, w - xx), hh = Math.min(holz.height, h - yy); g.drawImage(holz, 0, 0, ww, hh, x + xx, y + yy, ww, hh); } }

// ---------- Muster: allgemein ----------
function mHolz(farbe, W = 256) {
  const [c, g] = leinwand(W);
  rect(g, 0, 0, W, W, farbe);
  for (let k = 0; k < 30; k++) {
    const y0 = B.rng() * W, a = zw(1, 6), per = ganz(1, 3), ph = B.rng() * 6.28;
    g.strokeStyle = ja(.65) ? dunkel(farbe, zw(.05, .16)) : hell(farbe, zw(.04, .1)); g.lineWidth = zw(.8, 3);
    for (const dy of [-W, 0, W]) { g.beginPath(); for (let x = 0; x <= W; x += 4) { const y = y0 + dy + a * Math.sin(ph + x / W * PI * 2 * per); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  }
  return c;
}
function mHimmel() {
  const [c, g] = leinwand(256);
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, "#79b2e4"); v.addColorStop(1, "#d8ecf7");
  g.fillStyle = v; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 4; k++) { const x = zw(10, 246), y = zw(20, 120); for (let i = 0; i < 6; i++) kreis(g, x + zw(-30, 30), y + zw(-8, 8), zw(10, 20), "#ffffff"); }
  // Bäume und Dächer gegenüber
  for (let x = -10; x < 270; x += zw(18, 34)) kreis(g, x, zw(190, 210), zw(22, 34), wahl(["#5f8f4e", "#6d9c55", "#527f45"]));
  rect(g, 150, 196, 70, 60, "#d9c7a8"); vieleck(g, [[140, 198], [185, 168], [230, 198]], "#a8483a");
  for (const x of [162, 196]) rect(g, x, 210, 14, 16, "#7a8ea0");
  rect(g, 0, 236, 256, 20, "#6a9a52");
  return c;
}
function mKissen(art, a, b) {
  const W = 128, [c, g] = leinwand(W);
  rect(g, 0, 0, W, W, a);
  if (art === "streifen") for (let y = 0; y < W; y += 32) { rect(g, 0, y + 6, W, 10, b); rect(g, 0, y + 20, W, 3, b); }
  else if (art === "punkte") { for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) kreis(g, 13 + x * 25 + (y % 2) * 12, 13 + y * 25, 5, b); }
  else if (art === "karo") { for (let i = 0; i < W; i += 32) { rect(g, i, 0, 14, W, mix(a, b, .5)); rect(g, 0, i, W, 14, mix(a, b, .5)); } for (let y = 0; y < W; y += 32) for (let x = 0; x < W; x += 32) rect(g, x, y, 14, 14, b); }
  else if (art === "blume") { for (let k = 0; k < 6; k++) { const ang = k * PI / 3; kreis(g, 64 + Math.cos(ang) * 22, 64 + Math.sin(ang) * 22, 18, b); } kreis(g, 64, 64, 14, "#f2cf55"); for (const [x, y] of [[14, 14], [114, 14], [14, 114], [114, 114]]) kreis(g, x, y, 9, b); }
  else if (art === "raute") { for (let y = 0; y <= W; y += 32) for (let x = 0; x <= W; x += 32) raute(g, x + ((y / 32) % 2) * 16, y, 16, 16, b); }
  else if (art === "zickzack") { g.strokeStyle = b; g.lineWidth = 8; for (let y = 8; y < W; y += 28) { g.beginPath(); for (let x = 0; x <= W; x += 16) g.lineTo(x, y + ((x / 16) % 2) * 12); g.stroke(); } }
  rect(g, 0, 0, W, 5, dunkel(b, .15)); rect(g, 0, W - 5, W, 5, dunkel(b, .15)); rect(g, 0, 0, 5, W, dunkel(b, .15)); rect(g, W - 5, 0, 5, W, dunkel(b, .15));
  return c;
}
function mTuer(holz, gestrichen) {
  const W = 128, H = 288, [c, g] = leinwand(W, H);
  if (gestrichen) rect(g, 0, 0, W, H, gestrichen); else holzBild(g, holz, 0, 0, W, H);
  for (const [x, y, w, h] of [[14, 14, 44, 70], [70, 14, 44, 70], [14, 98, 44, 80], [70, 98, 44, 80], [14, 192, 44, 82], [70, 192, 44, 82]]) {
    fase(g, x, y, w, h, 4, true); fase(g, x + 7, y + 7, w - 14, h - 14, 3);
  }
  return c;
}
function mFoto() {
  const W = 64, H = 80, [c, g] = leinwand(W, H);
  const sepia = ja(.5);
  rect(g, 0, 0, W, H, "#f3eee2"); rect(g, 6, 6, W - 12, H - 12, sepia ? "#b79a72" : wahl(["#9cc4dc", "#c9d9a8", "#e4c4a0"]));
  const n = ganz(1, 3);
  for (let i = 0; i < n; i++) {
    const x = 32 + (i - (n - 1) / 2) * 16, f = sepia ? "#5a4532" : wahl(["#b0413e", "#3d5a8a", "#4f7a3a", "#8a5a9a"]);
    rect(g, x - 6, 42, 12, 26, f); kreis(g, x, 34, 6, sepia ? "#7a604a" : "#e8c4a0");
  }
  return c;
}

// ---------- Muster: Omas Wohnzimmer ----------
function mBlumentapete(grund, bl, blatt) {
  const W = 256, [c, g] = leinwand(W);
  rect(g, 0, 0, W, W, grund);
  const st = hell(grund, .25);
  for (let x = 0; x < W; x += 64) { rect(g, x + 29, 0, 4, W, st); rect(g, x + 36, 0, 1.5, W, st); }
  const n = 4, s = W / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + .25 + (j % 2) * .5) * s, y = (j + .5) * s, f = bl[(i + j * 2) % bl.length], rot = B.rng() * PI;
    rundum(W, W, x, y, 32, (X, Y) => {
      oval(g, X + 12 * Math.cos(rot), Y + 12 * Math.sin(rot), 8, 3.5, rot, blatt);
      oval(g, X - 12 * Math.cos(rot + .7), Y - 12 * Math.sin(rot + .7), 7, 3, rot + .7, blatt);
      for (let k = 0; k < 5; k++) { const a = rot + k * PI * 2 / 5; kreis(g, X + Math.cos(a) * 6, Y + Math.sin(a) * 6, 5, f); }
      kreis(g, X, Y, 3.5, "#f3cf4e");
    });
    rundum(W, W, x + s / 2, y + s / 2, 6, (X, Y) => { for (let k = 0; k < 3; k++) kreis(g, X + Math.cos(k * 2.1) * 3, Y + Math.sin(k * 2.1) * 3, 2.2, dunkel(grund, .12)); });
  }
  return c;
}
function mPerser(p) {
  const W = 512, H = 352, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, "#d8ccb2");
  for (let y = 2; y < H; y += 4) { rect(g, 0, y, 14, 2, "#f1e9d6"); rect(g, W - 14, y, 14, 2, "#f1e9d6"); }
  const x0 = 14, w = W - 28;
  rect(g, x0, 0, w, H, p.rand);
  const bb = 32;
  for (let x = x0 + 16; x < x0 + w - 8; x += 24) for (const y of [16, H - 16]) { raute(g, x, y, 9, 9, p.hell); kreis(g, x, y, 3, p.akzent); }
  for (let y = 16 + 24; y < H - 24; y += 24) for (const x of [x0 + 16, x0 + w - 16]) { raute(g, x, y, 9, 9, p.hell); kreis(g, x, y, 3, p.akzent); }
  rect(g, x0 + bb, bb, w - 2 * bb, H - 2 * bb, p.gold);
  const fx = x0 + bb + 3, fy = bb + 3, fw = w - 2 * bb - 6, fh = H - 2 * bb - 6;
  rect(g, fx, fy, fw, fh, p.feld);
  for (let y = fy + 14; y < fy + fh; y += 28) for (let x = fx + 14; x < fx + fw; x += 28) { raute(g, x, y, 6, 6, dunkel(p.feld, .25)); kreis(g, x, y, 1.8, p.hell); }
  const cx = W / 2, cy = H / 2;
  const sym = fn => { for (const sx of [1, -1]) for (const sy of [1, -1]) fn(cx + sx * 1, cy + sy * 1, sx, sy); };
  // Blümchen im Feld, gespiegelt
  for (let k = 0; k < 9; k++) {
    const dx = zw(130, fw / 2 - 20), dy = zw(20, fh / 2 - 16), f = wahl([p.hell, p.akzent, p.gold]);
    sym((x, y, sx, sy) => { const X = cx + sx * dx, Y = cy + sy * dy; for (let i = 0; i < 4; i++) kreis(g, X + Math.cos(i * PI / 2) * 5, Y + Math.sin(i * PI / 2) * 5, 3.5, f); kreis(g, X, Y, 2.5, p.rand); });
  }
  // Ecken
  g.save(); g.beginPath(); g.rect(fx, fy, fw, fh); g.clip();
  for (const [x, y] of [[fx, fy], [fx + fw, fy], [fx, fy + fh], [fx + fw, fy + fh]]) { raute(g, x, y, 70, 52, p.rand); raute(g, x, y, 60, 44, p.gold); raute(g, x, y, 56, 40, p.akzent); raute(g, x, y, 30, 22, p.hell); }
  g.restore();
  // Medaillon
  raute(g, cx, cy, 150, 104, p.rand); raute(g, cx, cy, 140, 96, p.gold); raute(g, cx, cy, 134, 92, p.akzent);
  raute(g, cx, cy, 96, 66, p.hell); raute(g, cx, cy, 84, 58, p.feld);
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; oval(g, cx + Math.cos(a) * 34, cy + Math.sin(a) * 24, 12, 6, a, p.rand); }
  kreis(g, cx, cy, 16, p.gold); kreis(g, cx, cy, 9, p.rand); kreis(g, cx, cy, 4, p.hell);
  for (const s of [-1, 1]) { raute(g, cx + s * 160, cy, 16, 12, p.rand); raute(g, cx + s * 160, cy, 9, 7, p.gold); }
  return c;
}
function mParkett(farbe) {
  const W = 256, [c, g] = leinwand(W), s = 128, n = 4, sw = s / n, fuge = dunkel(farbe, .35);
  for (let by = 0; by < 2; by++) for (let bx = 0; bx < 2; bx++) {
    const quer = (bx + by) % 2 === 0;
    for (let k = 0; k < n; k++) {
      const f = wackel(farbe, .1);
      const [x, y, w, h] = quer ? [bx * s, by * s + k * sw, s, sw] : [bx * s + k * sw, by * s, sw, s];
      rect(g, x, y, w, h, f);
      for (let m = 0; m < 5; m++) { const t = 3 + B.rng() * (sw - 6), ff = ja() ? dunkel(f, zw(.04, .1)) : hell(f, .06); if (quer) rect(g, x, y + t, w, 1, ff); else rect(g, x + t, y, 1, h, ff); }
      if (quer) rect(g, x, y, w, 1, fuge); else rect(g, x, y, 1, h, fuge);
    }
    rect(g, bx * s, by * s, s, 1, fuge); rect(g, bx * s, by * s, 1, s, fuge);
  }
  return c;
}
function mHaekel(farben, rand) {
  const W = 256, [c, g] = leinwand(W), s = 128;
  rect(g, 0, 0, W, W, rand);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const x = i * s, y = j * s, f = mischen(farben);
    for (let r = 0; r < 4; r++) { const e = 7 + r * 15; rect(g, x + e, y + e, s - 2 * e, s - 2 * e, f[r % f.length]); }
    rect(g, x + 64 - 6, y + 64 - 6, 12, 12, rand);
    for (let r = 0; r < 4; r++) {
      const e = 7 + r * 15 + 1, l = s - 2 * e;
      for (let t = 6; t < l - 4; t += 11) for (const [px, py] of [[x + e + t, y + e], [x + e + t, y + s - e - 3], [x + e, y + e + t], [x + s - e - 3, y + e + t]]) rect(g, px, py, 3, 3, rand);
    }
  }
  return c;
}
function mKacheln(farbe) {
  const W = 256, [c, g] = leinwand(W), s = 128;
  rect(g, 0, 0, W, W, "#e6dccb");
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const x = i * s + 3, y = j * s + 3, w = s - 6, f = wackel(farbe, .06);
    const v = g.createRadialGradient(x + w * .42, y + w * .4, 6, x + w / 2, y + w / 2, w * .72);
    v.addColorStop(0, hell(f, .28)); v.addColorStop(.6, f); v.addColorStop(1, dunkel(f, .22));
    g.fillStyle = v; g.fillRect(x, y, w, w);
    fase(g, x, y, w, w, 5); fase(g, x + 16, y + 16, w - 32, w - 32, 3, true);
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; oval(g, x + w / 2 + Math.cos(a) * 15, y + w / 2 + Math.sin(a) * 15, 11, 5, a, dunkel(f, .14)); }
    kreis(g, x + w / 2, y + w / 2, 7, hell(f, .2));
  }
  return c;
}
function mVorhang(grund, akzent, blatt) {
  const W = 128, [c, g] = leinwand(W);
  rect(g, 0, 0, W, W, grund);
  rect(g, 10, 0, 6, W, akzent); rect(g, 20, 0, 2, W, akzent);
  for (let k = 0; k < 4; k++) {
    const y = k * 32 + 16, x = 76 + (k % 2 ? 14 : -14);
    rundum(W, W, x, y, 20, (X, Y) => { oval(g, X - 9, Y + 6, 7, 3, .5, blatt); for (let i = 0; i < 5; i++) kreis(g, X + Math.cos(i * 1.26) * 6, Y + Math.sin(i * 1.26) * 6, 4.5, akzent); kreis(g, X, Y, 3, "#f1d36a"); });
  }
  return c;
}
function mOelbild(art) {
  const W = 256, H = 192, [c, g] = leinwand(W, H);
  const v = g.createLinearGradient(0, 0, 0, H * .6);
  if (art === "meer") {
    v.addColorStop(0, "#e9a25a"); v.addColorStop(1, "#f3d79a"); g.fillStyle = v; g.fillRect(0, 0, W, H);
    kreis(g, 180, 92, 20, "#fbe7a8");
    rect(g, 0, 104, W, H - 104, "#2f5f7a");
    for (let k = 0; k < 60; k++) rect(g, zw(0, W), zw(106, H), zw(8, 24), 2, wahl(["#4a7d96", "#26506a", "#e7c27a"]));
    vieleck(g, [[60, 118], [150, 118], [138, 132], [72, 132]], "#5a3826");
    rect(g, 103, 46, 3, 72, "#3a2618");
    vieleck(g, [[108, 50], [108, 112], [150, 108]], "#f3ead6"); vieleck(g, [[100, 56], [100, 110], [66, 106]], "#ebdfc6");
    vieleck(g, [[0, 104], [0, 70], [30, 80], [44, 104]], "#4b5a3a");
  } else if (art === "hirsch") {
    v.addColorStop(0, "#9cb8c8"); v.addColorStop(1, "#efe2c0"); g.fillStyle = v; g.fillRect(0, 0, W, H);
    vieleck(g, [[0, 120], [60, 60], [120, 110], [170, 50], [256, 120]], "#7d8fa0");
    rect(g, 0, 118, W, H - 118, "#6d8a4a");
    for (let x = 0; x < W; x += 12) { const h = zw(50, 90); vieleck(g, [[x - 8, 130], [x, 130 - h], [x + 8, 130]], wahl(["#2f4a2e", "#3a5634", "#28402a"])); }
    rect(g, 0, 150, W, H - 150, "#7a9a4e");
    const hx = 120, hy = 140, f = "#6a4228";
    oval(g, hx, hy, 30, 14, 0, f); rect(g, hx - 24, hy, 5, 26, f); rect(g, hx - 14, hy, 5, 28, f); rect(g, hx + 14, hy, 5, 28, f); rect(g, hx + 22, hy, 5, 26, f);
    vieleck(g, [[hx + 20, hy - 6], [hx + 34, hy - 36], [hx + 44, hy - 32], [hx + 32, hy + 4]], f); oval(g, hx + 44, hy - 36, 10, 6, .3, f);
    g.strokeStyle = "#d9c49a"; g.lineWidth = 2.5;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx + 40, hy - 40); g.lineTo(hx + 40 + s * 10, hy - 62); g.lineTo(hx + 40 + s * 18, hy - 76); g.moveTo(hx + 40 + s * 10, hy - 62); g.lineTo(hx + 40 + s * 2, hy - 72); g.moveTo(hx + 40 + s * 5, hy - 52); g.lineTo(hx + 40 + s * 16, hy - 56); g.stroke(); }
  } else {
    v.addColorStop(0, "#8ab4d8"); v.addColorStop(1, "#eef0dc"); g.fillStyle = v; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 3; k++) { const x = zw(20, 230), y = zw(15, 50); for (let i = 0; i < 5; i++) kreis(g, x + zw(-20, 20), y + zw(-5, 5), zw(7, 13), "#f8f6ee"); }
    vieleck(g, [[0, 110], [50, 50], [90, 90], [140, 40], [200, 95], [256, 70], [256, 120], [0, 120]], "#8a9ab0");
    vieleck(g, [[140, 40], [128, 55], [152, 55]], "#ffffff");
    oval(g, 128, 150, 160, 50, 0, "#7fa65a"); oval(g, 40, 170, 120, 40, 0, "#6a9448");
    oval(g, 180, 140, 46, 9, 0, "#5a8ab0");
    rect(g, 60, 116, 30, 22, "#efe2c4"); vieleck(g, [[56, 118], [75, 102], [94, 118]], "#a84a38"); rect(g, 70, 126, 7, 12, "#6a4a32");
    for (const [x, y, r] of [[30, 120, 16], [205, 116, 20], [230, 124, 14]]) { rect(g, x - 2, y, 4, 18, "#5a4030"); kreis(g, x, y - r * .5, r, "#3f6a36"); }
  }
  // Pinselstriche
  for (let k = 0; k < 500; k++) { g.fillStyle = ja() ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.07)"; g.fillRect(zw(0, W), zw(0, H), zw(3, 9), 1.5); }
  return c;
}
function mSchrankFront(holz, n, W, H) {
  const [c, g] = leinwand(W, H), dw = W / n;
  holzBild(g, holz, 0, 0, W, H);
  for (let i = 0; i < n; i++) { const x = i * dw; rect(g, x, 0, 2, H, "#21160f"); fase(g, x + 2, 2, dw - 2, H - 4, 2); fase(g, x + 9, 10, dw - 16, H - 20, 3, true); }
  rect(g, 0, 0, W, 2, "#21160f"); rect(g, 0, H - 2, W, 2, "#21160f");
  return c;
}
function mKommodeFront(holz) {
  const W = 256, H = 182, [c, g] = leinwand(W, H);
  holzBild(g, holz, 0, 0, W, H);
  for (const [x, y, w, h] of [[2, 2, 125, 46], [129, 2, 125, 46], [2, 52, 125, 128], [129, 52, 125, 128]]) { rect(g, x - 2, y - 2, w + 4, h + 4, "#21160f"); holzBild(g, holz, x, y, w, h); fase(g, x, y, w, h, 2); fase(g, x + 10, y + 8, w - 20, h - 16, 3, true); }
  return c;
}
function mStanduhrFront(holz) {
  const W = 96, H = 364, [c, g] = leinwand(W, H);
  holzBild(g, holz, 0, 0, W, H);
  fase(g, 0, 0, W, H, 3);
  kreis(g, 48, 52, 38, "#c9a24a"); kreis(g, 48, 52, 33, "#f3ead2");
  for (let i = 0; i < 12; i++) { const a = i * PI / 6; rect(g, 48 + Math.cos(a) * 27 - 1.5, 52 + Math.sin(a) * 27 - 1.5, 3, 3, "#2a2a2a"); }
  g.strokeStyle = "#1f1f1f"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(48, 52); g.lineTo(48 + 14, 52 - 10); g.moveTo(48, 52); g.lineTo(48 - 4, 52 - 22); g.stroke();
  rect(g, 14, 104, 68, 186, "#3a2a1c"); fase(g, 14, 104, 68, 186, 3, true);
  rect(g, 46, 110, 4, 130, "#c9a24a"); kreis(g, 48, 248, 15, "#d6ae52"); kreis(g, 44, 244, 5, "#efd58e");
  rect(g, 30, 140, 4, 70, "#8a7a5a"); rect(g, 62, 150, 4, 60, "#8a7a5a");
  rect(g, 27, 210, 10, 26, "#b8933e"); rect(g, 59, 210, 10, 26, "#b8933e");
  fase(g, 14, 302, 68, 50, 3, true);
  return c;
}
function mFernseher() {
  const W = 128, H = 92, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, "#5a3a24"); fase(g, 0, 0, W, H, 3);
  rundrect(g, 8, 8, 86, 76, 12, "#2e3632");
  const v = g.createLinearGradient(8, 8, 94, 84); v.addColorStop(0, "#5f7068"); v.addColorStop(1, "#2f3a36");
  g.fillStyle = v; g.beginPath(); g.roundRect(12, 12, 78, 68, 10); g.fill();
  oval(g, 34, 28, 16, 6, -.5, "rgba(255,255,255,.18)");
  rect(g, 100, 8, 22, 76, "#3a2618");
  for (const y of [22, 44]) { kreis(g, 111, y, 7, "#c8c2b4"); kreis(g, 111, y, 3, "#5a5a5a"); }
  for (let y = 60; y < 80; y += 4) rect(g, 103, y, 16, 2, "#1d140d");
  return c;
}
function mZeitung() {
  const W = 96, H = 128, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, "#ece7db"); rect(g, 6, 6, W - 12, 12, "#3a3a3a");
  rect(g, 6, 24, 40, 30, "#9a9488");
  for (let y = 24; y < H - 6; y += 5) for (let x = 0; x < 3; x++) if (!(x === 0 && y < 56)) rect(g, 6 + x * 29, y, zw(18, 26), 2, "#8d8a84");
  return c;
}

// ---------- Muster: Kinderzimmer ----------
function mStreifen(farben) {
  const folge = [[farben[0], 40], [farben[2], 5], [farben[1], 16], [farben[2], 5], [farben[0], 40], [farben[2], 5], [farben[3], 10], [farben[2], 5]];
  const W = folge.reduce((s, f) => s + f[1], 0), [c, g] = leinwand(W, 64);
  let x = 0; for (const [f, w] of folge) { rect(g, x, 0, w, 64, f); x += w; }
  return [c, W];
}
function mBordure(farben) {
  const W = 512, H = 64, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, "#fbf7ee"); rect(g, 0, 0, W, 4, farben[0]); rect(g, 0, H - 4, W, 4, farben[0]);
  const bogen = ["#e2504c", "#f39a3d", "#f4d34a", "#6cbf5a", "#4a90d0", "#8a62c4"];
  for (let k = 0; k < 4; k++) {
    const x = k * 128 + 40;
    bogen.forEach((f, i) => { g.strokeStyle = f; g.lineWidth = 3.5; g.beginPath(); g.arc(x, 52, 30 - i * 3.5, PI, 0); g.stroke(); });
    for (const dx of [-30, 30]) for (let i = 0; i < 3; i++) kreis(g, x + dx + (i - 1) * 7, 52, 6, "#ffffff");
    stern(g, x + 64, 28, 10, wahl(["#f4c43a", "#f28a3a", "#e56aa0"]));
    kreis(g, x + 88, 40, 3, farben[1]); kreis(g, x + 100, 22, 3, farben[1]);
  }
  return c;
}
function mStrasse() {
  const W = 512, H = 340, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, "#74b65c");
  for (let k = 0; k < 160; k++) rect(g, zw(0, W), zw(0, H), 2, 4, "#64a54e");
  const st = "#5c6068", li = "#f4f1e6";
  rect(g, 8, 148, W - 16, 48, st); rect(g, 138, 8, 48, H - 16, st); rect(g, 360, 148, 48, H - 156, st);
  for (let x = 14; x < W - 14; x += 24) if ((x < 132 || x > 192) && (x < 354 || x > 414)) rect(g, x, 170, 14, 4, li);
  for (let y = 14; y < H - 14; y += 24) if (y < 142 || y > 202) rect(g, 160, y, 4, 14, li);
  for (let y = 210; y < H - 14; y += 24) rect(g, 382, y, 4, 14, li);
  for (let k = 0; k < 5; k++) rect(g, 204, 151 + k * 9, 22, 5, "#ffffff");
  for (let k = 0; k < 5; k++) rect(g, 141 + k * 9, 216, 5, 22, "#ffffff");
  // Häuser
  const haus = (x, y, f, d) => { rect(g, x, y, 40, 32, f); vieleck(g, [[x - 4, y], [x + 20, y - 18], [x + 44, y]], d); rect(g, x + 6, y + 8, 9, 9, "#8fc6e8"); rect(g, x + 25, y + 8, 9, 9, "#8fc6e8"); rect(g, x + 16, y + 18, 9, 14, "#7a4a2a"); };
  haus(30, 50, "#f2d27a", "#c8503c"); haus(84, 60, "#e8a0b0", "#7a4a8a"); haus(210, 56, "#a8d0f0", "#c8503c"); haus(270, 48, "#f4f0e4", "#4a6a9a");
  haus(40, 240, "#f0b880", "#8a3a2a"); haus(210, 250, "#c8e0a0", "#c8503c");
  // Parkplatz
  rect(g, 430, 222, 64, 100, "#8a8d92"); for (let y = 228; y < 320; y += 22) rect(g, 432, y, 30, 3, li);
  // Teich und Bäume
  oval(g, 450, 72, 40, 28, 0, "#9fd3ec"); oval(g, 450, 72, 34, 23, 0, "#5aaee0");
  for (const [x, y] of [[100, 120], [124, 30], [320, 110], [330, 30], [430, 130], [100, 300], [300, 300], [320, 230], [20, 130]]) { kreis(g, x, y, 11, "#3f8a3e"); kreis(g, x - 3, y - 3, 5, "#5aa84e"); }
  // Autos
  const auto = (x, y, f, q) => { if (q) { rundrect(g, x, y, 26, 14, 4, f); rect(g, x + 7, y + 3, 10, 8, "#cfe8f6"); } else { rundrect(g, x, y, 14, 26, 4, f); rect(g, x + 3, y + 7, 8, 10, "#cfe8f6"); } };
  auto(60, 154, "#e2483a", true); auto(290, 176, "#3a78d0", true); auto(144, 70, "#f4c43a", false); auto(436, 250, "#6aba4a", true);
  rect(g, 0, 0, W, 8, "#3c6f8e"); rect(g, 0, H - 8, W, 8, "#3c6f8e"); rect(g, 0, 0, 8, H, "#3c6f8e"); rect(g, W - 8, 0, 8, H, "#3c6f8e");
  return c;
}
function mKariert(a, b, linie) {
  const W = 128, [c, g] = leinwand(W);
  rect(g, 0, 0, W, W, a);
  const m = mix(a, b, .5);
  rect(g, 0, 40, W, 48, m); rect(g, 40, 0, 48, W, m); rect(g, 40, 40, 48, 48, b);
  for (const p of [20, 106]) { rect(g, 0, p, W, 3, linie); rect(g, p, 0, 3, W, linie); }
  return c;
}
function mPunkte(a, b, n = 2, r = 7) {
  const W = 64, [c, g] = leinwand(W); rect(g, 0, 0, W, W, a);
  const s = W / n; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) rundum(W, W, (i + .25 + (j % 2) * .5) * s, (j + .5) * s, r, (x, y) => kreis(g, x, y, r, b));
  return c;
}
function mBlockstreifen(a, b) { const W = 64, [c, g] = leinwand(W); rect(g, 0, 0, W, W, a); rect(g, 0, 0, W, 16, b); rect(g, 0, 32, W, 16, b); return c; }
function mSterne(a, b) {
  const W = 128, [c, g] = leinwand(W); rect(g, 0, 0, W, W, a);
  for (const [x, y, r] of [[24, 22, 10], [88, 40, 7], [50, 84, 9], [110, 100, 6], [14, 110, 5]]) rundum(W, W, x, y, r + 2, (X, Y) => stern(g, X, Y, r, b));
  rundum(W, W, 92, 78, 12, (X, Y) => { kreis(g, X, Y, 10, b); kreis(g, X + 5, Y - 3, 9, a); });
  return c;
}
function mDielen(farbe) {
  const W = 256, H = 256, [c, g] = leinwand(W, H), rh = H / 6, fuge = dunkel(farbe, .35);
  for (let r = 0; r < 6; r++) {
    let x = -zw(0, W), y = r * rh;
    while (x < W) { const l = zw(.45, .9) * W, f = wackel(farbe, .09); for (const dx of [0, W]) { rect(g, x - dx, y, l, rh, f); for (let m = 0; m < 4; m++) rect(g, x - dx, y + 4 + B.rng() * (rh - 8), l, 1, dunkel(f, .07)); rect(g, x - dx, y, 2, rh, fuge); } x += l; }
    rect(g, 0, y, W, 2, fuge);
  }
  return c;
}
function mPosterRakete() {
  const W = 192, H = 256, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, "#ffffff"); rect(g, 8, 8, W - 16, H - 16, "#1f2d5a");
  for (let k = 0; k < 40; k++) kreis(g, zw(12, W - 12), zw(12, H - 12), zw(.8, 2.2), "#ffffff");
  kreis(g, 46, 58, 24, "#ef8a4a"); oval(g, 46, 58, 40, 9, -.3, "rgba(0,0,0,0)");
  g.strokeStyle = "#f6d28a"; g.lineWidth = 4; g.beginPath(); g.ellipse(46, 58, 40, 9, -.3, 0, PI * 2); g.stroke(); kreis(g, 40, 50, 6, "#f4a86a");
  kreis(g, 150, 210, 18, "#d9d4c8"); kreis(g, 144, 204, 4, "#b9b4a8"); kreis(g, 156, 216, 3, "#b9b4a8");
  const x = 104, y = 70;
  vieleck(g, [[x - 18, y + 100], [x - 36, y + 132], [x - 18, y + 124]], "#e2483a"); vieleck(g, [[x + 18, y + 100], [x + 36, y + 132], [x + 18, y + 124]], "#e2483a");
  oval(g, x, y + 140, 12, 24, 0, "#f39a3d"); oval(g, x, y + 136, 6, 14, 0, "#f9e05a");
  rundrect(g, x - 18, y + 20, 36, 108, 8, "#f3f3f3"); vieleck(g, [[x - 18, y + 26], [x, y - 16], [x + 18, y + 26]], "#e2483a");
  kreis(g, x, y + 54, 11, "#7a8a9a"); kreis(g, x, y + 54, 8, "#6ac3f0"); rect(g, x - 18, y + 92, 36, 6, "#4a90d0");
  return c;
}
function mPosterRegenbogen() {
  const W = 192, H = 256, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, "#ffffff"); rect(g, 8, 8, W - 16, H - 16, "#c6e8f6");
  kreis(g, 150, 50, 22, "#f8d24a"); for (let i = 0; i < 10; i++) { const a = i * PI / 5; rect(g, 150 + Math.cos(a) * 30 - 2, 50 + Math.sin(a) * 30 - 2, 5, 5, "#f8d24a"); }
  ["#e2504c", "#f39a3d", "#f4d34a", "#6cbf5a", "#4a90d0", "#8a62c4"].forEach((f, i) => { g.strokeStyle = f; g.lineWidth = 9; g.beginPath(); g.arc(96, 200, 78 - i * 9, PI, 0); g.stroke(); });
  for (const x of [28, 164]) for (let i = 0; i < 4; i++) kreis(g, x + (i - 1.5) * 10, 198 - (i % 2) * 6, 11, "#ffffff");
  rect(g, 8, 210, W - 16, 38, "#7cc25c");
  for (const [x, f] of [[40, "#e2504c"], [80, "#f4d34a"], [130, "#e56aa0"]]) { rect(g, x - 1, 216, 2, 14, "#3f8a3e"); kreis(g, x, 216, 5, f); }
  return c;
}
function mKleiderschrank(f, deko) {
  const W = 192, H = 364, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, f);
  rect(g, 95, 0, 2, H, dunkel(f, .3)); fase(g, 0, 0, 95, H, 3); fase(g, 97, 0, 95, H, 3);
  for (const x of [0, 97]) fase(g, x + 12, 14, 71, H - 28, 3, true);
  for (let k = 0; k < 7; k++) stern(g, zw(22, 170), zw(30, 330), zw(6, 11), wahl(deko));
  for (const x of [48, 145]) { kreis(g, x, 80, 14, "#ffffff"); kreis(g, x + 12, 76, 11, "#ffffff"); kreis(g, x - 12, 78, 10, "#ffffff"); }
  return c;
}
function mSpielkiste(f) {
  const W = 160, H = 84, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, f); fase(g, 0, 0, W, H, 3);
  [["A", "#e2483a"], ["B", "#4a90d0"], ["C", "#6cbf5a"], ["D", "#f4c43a"]].forEach(([b, ff], i) => {
    const x = 12 + i * 36; rundrect(g, x, 24, 30, 30, 4, ff);
    g.fillStyle = "#ffffff"; g.font = "bold 22px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(b, x + 15, 40);
  });
  return c;
}
function mBall() {
  const W = 128, H = 64, [c, g] = leinwand(W, H);
  ["#e2483a", "#ffffff", "#f4c43a", "#ffffff", "#4a90d0", "#ffffff"].forEach((f, i) => rect(g, i * W / 6, 0, W / 6 + 1, H, f));
  rect(g, 0, 0, W, 5, "#ffffff"); rect(g, 0, H - 5, W, 5, "#ffffff");
  return c;
}
function mGlobus() {
  const W = 128, H = 64, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, "#3d7fc4");
  for (const [x, y, rx, ry] of [[20, 20, 14, 10], [30, 42, 7, 13], [66, 18, 10, 9], [70, 38, 9, 12], [96, 20, 20, 10], [110, 46, 8, 6]]) rundum(W, H, x, y, rx + 2, (X, Y) => oval(g, X, Y, rx, ry, .3, "#6cae4a"));
  rect(g, 0, 0, W, 5, "#f4f4f4"); rect(g, 0, H - 5, W, 5, "#f4f4f4");
  return c;
}
function mKinderbild() {
  const W = 96, H = 72, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, "#fbfaf4");
  g.lineWidth = 3; g.lineCap = "round";
  kreis(g, 78, 16, 9, "#f4c43a");
  rect(g, 22, 34, 34, 26, "#e2483a"); vieleck(g, [[18, 34], [39, 16], [60, 34]], "#4a90d0"); rect(g, 34, 46, 9, 14, "#7a4a2a");
  rect(g, 0, 62, W, 10, "#6cbf5a");
  g.strokeStyle = "#3a3a3a"; g.beginPath(); g.moveTo(72, 62); g.lineTo(72, 46); g.moveTo(66, 52); g.lineTo(78, 52); g.stroke(); kreis(g, 72, 42, 5, "#e8b48a");
  return c;
}

// ---------- Muster: Küche ----------
function mSchach(a, b) {
  const W = 128, [c, g] = leinwand(W), f = mix(a, b, .5);
  rect(g, 0, 0, W, W, f);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) rect(g, i * 64 + 1, j * 64 + 1, 62, 62, (i + j) % 2 ? b : a);
  return c;
}
function mWandfliesen(farbe, deko) {
  const W = 256, [c, g] = leinwand(W), s = 64;
  rect(g, 0, 0, W, W, "#d9d6cf");
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const x = i * s + 2, y = j * s + 2, w = s - 4;
    rect(g, x, y, w, w, wackel(farbe, .025)); rect(g, x + 4, y + 4, w * .45, 4, "rgba(255,255,255,.35)");
    if ((i === 1 && j === 1) || (i === 3 && j === 2) || (i === 0 && j === 3)) {
      kreis(g, x + w / 2, y + w / 2, 18, deko); kreis(g, x + w / 2, y + w / 2, 14, farbe);
      for (let k = 0; k < 4; k++) { const a = k * PI / 2; oval(g, x + w / 2 + Math.cos(a) * 7, y + w / 2 + Math.sin(a) * 7, 6, 3, a, deko); }
      kreis(g, x + w / 2, y + w / 2, 3, deko);
      for (const [px, py] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + w - 5], [x + w - 5, y + w - 5]]) raute(g, px, py, 4, 4, deko);
    }
  }
  return c;
}
function mKuechentapete(grund, motiv) {
  const W = 128, [c, g] = leinwand(W); rect(g, 0, 0, W, W, grund);
  if (motiv === "kirschen") {
    for (const [x, y] of [[32, 32], [96, 96]]) rundum(W, W, x, y, 20, (X, Y) => {
      g.strokeStyle = "#5a7a3a"; g.lineWidth = 2; g.beginPath(); g.moveTo(X - 7, Y + 6); g.quadraticCurveTo(X - 4, Y - 10, X + 4, Y - 14); g.moveTo(X + 7, Y + 6); g.quadraticCurveTo(X + 6, Y - 6, X + 4, Y - 14); g.stroke();
      oval(g, X + 10, Y - 14, 7, 3, .4, "#6a9a4a"); kreis(g, X - 7, Y + 8, 6, "#c8323a"); kreis(g, X + 7, Y + 8, 6, "#b82a32"); kreis(g, X - 9, Y + 6, 1.8, "#f3b0b0");
    });
    for (const [x, y] of [[96, 32], [32, 96]]) rundum(W, W, x, y, 4, (X, Y) => kreis(g, X, Y, 2.5, dunkel(grund, .12)));
  } else {
    g.strokeStyle = dunkel(grund, .14); g.lineWidth = 2;
    for (let k = -1; k < 3; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64 + 128, 128); g.moveTo(k * 64 + 128, 0); g.lineTo(k * 64, 128); g.stroke(); }
    for (const [x, y] of [[0, 32], [64, 32], [32, 0], [32, 64], [96, 0], [96, 64], [0, 96], [64, 96]]) rundum(W, W, x, y, 6, (X, Y) => kreis(g, X, Y, 4, motiv));
  }
  return c;
}
function mKaro(a) {
  const W = 64, [c, g] = leinwand(W), m = mix(a, "#ffffff", .5);
  rect(g, 0, 0, W, W, "#fbf8f2");
  rect(g, 0, 0, W, 32, m); rect(g, 0, 0, 32, W, m); rect(g, 0, 0, 32, 32, a);
  return c;
}
function mFront(art, holz, f) {
  const W = 128, H = art === "hoch" ? 427 : 176, [c, g] = leinwand(W, H);
  if (art === "herd") {
    rect(g, 0, 0, W, H, "#ece7dc"); fase(g, 0, 0, W, H, 3);
    rect(g, 0, 0, W, 34, "#d6d0c2"); for (let i = 0; i < 4; i++) { kreis(g, 22 + i * 28, 17, 8, "#2b2b2b"); rect(g, 21 + i * 28, 9, 2, 6, "#ffffff"); }
    rect(g, 14, 44, 100, 6, "#b9bdc2"); rundrect(g, 18, 58, 92, 76, 8, "#2b2b30");
    vieleck(g, [[24, 64], [60, 64], [30, 126], [24, 126]], "rgba(255,255,255,.08)");
    rect(g, 4, 144, W - 8, 2, "#9a958a"); rect(g, 44, 156, 40, 5, "#b9bdc2");
    return c;
  }
  holzBild(g, holz, 0, 0, W, H);
  if (f) { g.fillStyle = f; g.globalAlpha = .82; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  fase(g, 0, 0, W, H, 3);
  if (art === "tuer") fase(g, 14, 16, W - 28, H - 32, 4, true);
  else if (art === "doppel") { rect(g, 63, 0, 2, H, "#21160f"); fase(g, 0, 0, 63, H, 3); fase(g, 65, 0, 63, H, 3); fase(g, 10, 14, 43, H - 28, 3, true); fase(g, 75, 14, 43, H - 28, 3, true); }
  else if (art === "schub") { for (const y of [58, 116]) rect(g, 0, y, W, 2, "#21160f"); for (const y of [0, 60, 118]) { fase(g, 0, y, W, 56, 3); fase(g, 12, y + 10, W - 24, 36, 2, true); } }
  else if (art === "vitrine") {
    rect(g, 14, 14, W - 28, H - 28, "#c9dcdc"); fase(g, 14, 14, W - 28, H - 28, 3, true);
    rect(g, 14, 86, W - 28, 5, f || "#a07a50");
    for (const y of [80, 150]) for (let i = 0; i < 3; i++) { const x = 34 + i * 30; rect(g, x - 9, y - 16, 18, 16, wahl(["#f6f2ea", "#e2a03a", "#4a7ab0", "#c8503c"])); rect(g, x + 9, y - 12, 4, 7, "#efe9dd"); }
    vieleck(g, [[20, 20], [50, 20], [24, 150], [20, 150]], "rgba(255,255,255,.18)");
  } else if (art === "hoch") {
    rect(g, 0, 262, W, 2, "#21160f"); fase(g, 0, 0, W, 262, 3); fase(g, 0, 264, W, H - 264, 3);
    fase(g, 14, 16, W - 28, 230, 4, true); fase(g, 14, 280, W - 28, H - 296, 4, true);
  } else if (art === "buffet") {
    for (const x of [63]) rect(g, x, 0, 2, H, "#21160f"); rect(g, 0, 44, W, 2, "#21160f");
    for (const [x, y, w, h] of [[0, 0, 63, 44], [65, 0, 63, 44], [0, 46, 63, H - 46], [65, 46, 63, H - 46]]) { fase(g, x, y, w, h, 3); fase(g, x + 8, y + 8, w - 16, h - 16, 2, true); }
  }
  return c;
}
function mKuehlschrank(f) {
  const W = 128, H = 344, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, f);
  rect(g, 0, 0, 5, H, hell(f, .25)); rect(g, W - 5, 0, 5, H, dunkel(f, .14));
  rect(g, 0, 96, W, 3, dunkel(f, .4)); rect(g, 0, H - 12, W, 12, dunkel(f, .3));
  rundrect(g, 40, 12, 48, 12, 6, "#d5d8dc"); rect(g, 46, 16, 36, 4, "#a5aab0");
  return c;
}
function mLaeufer() {
  const W = 512, H = 164, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, "#e9e0cc");
  for (let y = 4; y < H; y += 6) { rect(g, 0, y, 12, 3, "#f3ecdc"); rect(g, W - 12, y, 12, 3, "#f3ecdc"); }
  let x = 12; const farben = ["#c8503c", "#4a7ab0", "#e8b84a", "#6a9a5a", "#e9e0cc", "#8a5a8a", "#d87a4a"];
  while (x < W - 12) { const w = Math.min(ganz(6, 26), W - 12 - x), f = wahl(farben); rect(g, x, 0, w, H, f); for (let k = 0; k < w * 2; k++) rect(g, x + zw(0, w - 2), zw(0, H - 2), 2, 2, wackel(f, .25)); x += w; }
  return c;
}
function mKalender() {
  const W = 128, H = 192, [c, g] = leinwand(W, H);
  rect(g, 0, 0, W, H, "#f8f6f0");
  const v = g.createLinearGradient(0, 8, 0, 90); v.addColorStop(0, "#8ac0e8"); v.addColorStop(1, "#e8f0e0"); g.fillStyle = v; g.fillRect(8, 8, 112, 84);
  vieleck(g, [[8, 92], [8, 60], [48, 36], [80, 70], [120, 48], [120, 92]], "#6a9a4a");
  rect(g, 8, 100, 112, 12, "#c8503c");
  for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) rect(g, 10 + i * 16, 118 + j * 14, 12, 10, (i === 6 ? "#f0c8c0" : "#e2ded4"));
  rect(g, 10 + 3 * 16, 118 + 2 * 14, 12, 10, "#e2483a");
  return c;
}
function mUhr(rand) {
  const W = 128, [c, g] = leinwand(W);
  rect(g, 0, 0, W, W, rand); kreis(g, 64, 64, 58, "#fbf8f0");
  for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.save(); g.translate(64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48); g.rotate(a); rect(g, -6, -2, i % 3 ? 7 : 12, i % 3 ? 3 : 5, "#2a2a2a"); g.restore(); }
  g.strokeStyle = "#2a2a2a"; g.lineCap = "round"; g.lineWidth = 6; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 24, 64 - 14); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 - 8, 64 - 40); g.stroke();
  g.strokeStyle = "#c8323a"; g.lineWidth = 2; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 10, 64 + 42); g.stroke(); kreis(g, 64, 64, 5, "#2a2a2a");
  return c;
}

// ---------- Stoffe ----------
function stoff(canvas, kx, ky = kx) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (kx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / kx, 1 / ky); }
  const m = new THREE.MeshLambertMaterial({ map: t });
  m.userData.bild = !kx;
  B.weg.push(t, m);
  return m;
}
function uni(farbe) {
  let m = B.uni.get(farbe);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: farbe }); B.uni.set(farbe, m); B.weg.push(m); }
  return m;
}

// ---------- Formen ----------
// UV in Metern: jede Fläche bekommt die beiden Achsen, die in ihr liegen (wie von außen gesehen, v nach oben)
function meterUV(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    if (ax >= ay && ax >= az) uv.setXY(i, nx > 0 ? -z : z, y);
    else if (ay >= az) uv.setXY(i, x, ny > 0 ? -z : z);
    else uv.setXY(i, nz > 0 ? x : -x, y);
  }
  return geo;
}
// Quader mit Boden bei y = 0. art: "m" Meter, "b" Bild auf jeder Fläche, "f" Bild vorne (+z), sonst Meter
function geoQuader(w, h, d, art = "m") {
  const k = `q${w.toFixed(4)},${h.toFixed(4)},${d.toFixed(4)},${art}`;
  let g = B.geos.get(k);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
    if (art !== "b") { const vorne = g.attributes.uv.array.slice(32, 40); meterUV(g); if (art === "f") g.attributes.uv.array.set(vorne, 32); }
    if (art === "f") {
      // nur zwei Gruppen (Korpus und Front), damit ein Möbel zwei statt sechs Zeichenaufrufe braucht
      const ix = Array.from(g.index.array), neu = ix.slice(0, 24).concat(ix.slice(30, 36), ix.slice(24, 30));
      g.setIndex(neu); g.clearGroups(); g.addGroup(0, 30, 0); g.addGroup(30, 6, 1);
    }
    B.geos.set(k, g); B.weg.push(g);
  }
  return g;
}
// Zylinder (oder Kegelstumpf) mit Boden bei y = 0
function geoZylinder(rt, rb, h, seg = 16, meter = true) {
  const k = `z${rt.toFixed(4)},${rb.toFixed(4)},${h.toFixed(4)},${seg},${meter}`;
  let g = B.geos.get(k);
  if (!g) {
    g = new THREE.CylinderGeometry(rt, rb, h, seg, 1); g.translate(0, h / 2, 0);
    if (meter) {
      const uv = g.attributes.uv, nT = (seg + 1) * 2, um = PI * (rt + rb), r = Math.max(rt, rb);
      for (let i = 0; i < uv.count; i++) i < nT ? uv.setXY(i, uv.getX(i) * um, uv.getY(i) * h) : uv.setXY(i, (uv.getX(i) - .5) * 2 * r, (uv.getY(i) - .5) * 2 * r);
    }
    B.geos.set(k, g); B.weg.push(g);
  }
  return g;
}
function geoKugel(seg = 12) {
  const k = "k" + seg; let g = B.geos.get(k);
  if (!g) { g = new THREE.SphereGeometry(1, seg, Math.max(6, seg * .75 | 0)); B.geos.set(k, g); B.weg.push(g); }
  return g;
}
// ebene Fläche von (0,0) bis (w,h), UV in Metern
function geoFlaeche(w, h) {
  const g = new THREE.PlaneGeometry(w, h); g.translate(w / 2, h / 2, 0);
  const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getY(i));
  B.weg.push(g); return g;
}
// Vorhang mit Falten (Mitte unten bei 0,0), UV in Metern
function geoVorhang(w, h, tiefe = .035, welle = .17) {
  const n = Math.max(8, Math.round(w / welle * 4)), g = new THREE.PlaneGeometry(w, h, n, 1); g.translate(0, h / 2, 0);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, tiefe * (1 + Math.sin(x / welle * PI * 2)) / 2); uv.setXY(i, x, p.getY(i)); }
  g.computeVertexNormals(); B.weg.push(g); return g;
}

// ---------- Teile ----------
function teil(eltern, geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  eltern.add(m); B.meshes.push(m); return m;
}
// mat: ein Stoff, oder [Korpus, Front] für ein Möbel mit Bild vorne (+z)
function quader(eltern, w, h, d, mat, x, y, z, ry = 0, rx = 0, rz = 0) {
  const art = Array.isArray(mat) ? "f" : mat.userData.bild ? "b" : "m";
  return teil(eltern, geoQuader(w, h, d, art), mat, x, y, z, ry, rx, rz);
}
function gruppeBei(x, z, ry = 0, y = 0, eltern = B.gruppe) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; eltern.add(g); return g; }
// Gruppe an einer Wand: x läuft an der Wand entlang (von innen gesehen nach rechts), z zeigt ins Zimmer, z = 0 ist die Wand
function an(wand, a) {
  if (wand === "n") return gruppeBei(a, R.z0, 0);
  if (wand === "s") return gruppeBei(a, R.z1, PI);
  if (wand === "w") return gruppeBei(R.x0, a, PI / 2);
  return gruppeBei(R.x1, a, -PI / 2);
}
const WAND = { n: () => [R.x0, R.x1 - R.x0], s: () => [R.x1, R.x1 - R.x0], w: () => [R.z1, R.z1 - R.z0], o: () => [R.z0, R.z1 - R.z0] };
function stoss(obj) { B.stoss.push(obj); return obj; }

// Sammler: viele Teile werden zu einem Mesh. Ohne Stoff mit Eckfarben (jedes Teil einfarbig), mit Stoff mit gemeinsamem Muster.
function sammler(mat = null) {
  const teile = [], E = new THREE.Euler(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const s = {
    geo(g, farbe, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) { E.set(rx, ry, rz); Q.setFromEuler(E); P.set(x, y, z); S.set(sx, sy, sz); teile.push([g, farbe, new THREE.Matrix4().compose(P, Q, S)]); return s; },
    box(w, h, d, farbe, x, y, z, ry = 0, rx = 0, rz = 0) { return s.geo(geoQuader(w, h, d, "m"), farbe, x, y, z, ry, rx, rz); },
    zyl(rt, rb, h, farbe, x, y, z, ry = 0, rx = 0, rz = 0, seg = 14) { return s.geo(geoZylinder(rt, rb, h, seg, true), farbe, x, y, z, ry, rx, rz); },
    kugel(sx, sy, sz, farbe, x, y, z, ry = 0, rx = 0, rz = 0, seg = 12) { return s.geo(geoKugel(seg), farbe, x, y, z, ry, rx, rz, sx, sy, sz); },
    leer: () => !teile.length,
    fertig(eltern) {
      if (!teile.length) return null;
      let n = 0;
      const gs = teile.map(([g, f, m]) => { const k = g.index ? g.toNonIndexed() : g.clone(); k.applyMatrix4(m); n += k.attributes.position.count; return [k, f]; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = mat ? null : new Float32Array(n * 3), uv = mat ? new Float32Array(n * 2) : null, c = new THREE.Color();
      let o = 0;
      for (const [k, f] of gs) {
        const cnt = k.attributes.position.count;
        pos.set(k.attributes.position.array, o * 3); nor.set(k.attributes.normal.array, o * 3);
        if (col) { c.set(f); for (let i = 0; i < cnt; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; } }
        if (uv) uv.set(k.attributes.uv.array, o * 2);
        o += cnt; k.dispose();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      if (col) g.setAttribute("color", new THREE.BufferAttribute(col, 3)); else g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      B.weg.push(g);
      return teil(eltern, g, mat || B.eckfarben);
    },
  };
  return s;
}

// ---------- Bauteile für alle Zimmer ----------
function huelle(wandMat, bodenMat, decke, leiste) {
  const { x0, x1, z0, z1, h } = R, G = B.gruppe;
  teil(G, geoFlaeche(x1 - x0, z1 - z0), bodenMat, x0, 0, z1, 0, -PI / 2);
  teil(G, geoFlaeche(x1 - x0, z1 - z0), uni(decke), x0, h, z0, 0, PI / 2);
  const s = sammler(), v = new THREE.Vector3();
  for (const w of ["n", "s", "w", "o"]) {
    const [a, l] = WAND[w](), g = an(w, a), ry = g.rotation.y;
    teil(g, geoFlaeche(l, h), wandMat, 0, 0, 0);
    // Fußleiste und Deckenleiste (in Weltkoordinaten, damit alle Leisten ein Mesh werden)
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(g.position.x, 0, g.position.z);
    v.set(l / 2, 0, .009).applyMatrix4(m); s.box(l, .09, .018, leiste, v.x, 0, v.z, ry);
    v.set(l / 2, 0, .015).applyMatrix4(m); s.box(l, .03, .03, leiste, v.x, h - .03, v.z, ry);
  }
  s.fertig(G);
}
// Fenster an einer Wandgruppe (Mitte x = 0). Gibt die Höhe der Fensterbank zurück.
function fenster(g, b, unten, oben, vorhangMat, art = "lang", rahmen = "#f4f1ea") {
  const hh = oben - unten, t = .07, s = sammler();
  quader(g, b, hh, .02, B.himmel, 0, unten, .012);
  s.box(b + 2 * t, t, .09, rahmen, 0, unten - t, .045).box(b + 2 * t, t, .09, rahmen, 0, oben, .045)
    .box(t, hh, .09, rahmen, -b / 2 - t / 2, unten, .045).box(t, hh, .09, rahmen, b / 2 + t / 2, unten, .045)
    .box(.05, hh, .06, rahmen, 0, unten, .05).box(b, .05, .06, rahmen, 0, unten + hh * .68, .05)
    .box(b + .34, .04, .24, "#ebe6dc", 0, unten - t - .04, .12);
  const bank = unten - t;
  if (art === "lang") {
    const vb = .55, vh = oben + .14 - .04;
    s.zyl(.016, .016, b + 1.3, "#b08a4a", (b + 1.3) / 2, oben + .16, .14, 0, 0, PI / 2);
    for (const sx of [-1, 1]) s.kugel(.035, .035, .035, "#b08a4a", sx * (b / 2 + .68), oben + .176, .14);
    for (const sx of [-1, 1]) teil(g, geoVorhang(vb, vh), vorhangMat, sx * (b / 2 + t + vb / 2 - .12), .04, .1);
  } else {
    // Scheibengardine und Querbehang
    s.zyl(.008, .008, b, "#d8d4cc", b / 2, unten + hh * .45, .1, 0, 0, PI / 2);
    teil(g, geoVorhang(b, hh * .45 - .01, .02, .1), vorhangMat, 0, unten + .005, .088);
    teil(g, geoVorhang(b + .2, .24, .02, .1), vorhangMat, 0, oben - .2, .1);
  }
  s.fertig(g);
  return bank;
}
function tuer(g, blatt, rahmen, griff) {
  const b = .9, h = 2.02, s = sammler();
  s.box(.08, h + .08, .05, rahmen, -b / 2 - .04, 0, .025).box(.08, h + .08, .05, rahmen, b / 2 + .04, 0, .025).box(b, .08, .05, rahmen, 0, h, .025);
  quader(g, b, h, .04, [uni(rahmen), blatt], 0, 0, .02);
  s.box(.045, .2, .01, griff, b / 2 - .09, .94, .045).box(.13, .022, .022, griff, b / 2 - .13, 1.07, .07).zyl(.012, .012, .03, griff, b / 2 - .075, 1.07, .045, 0, PI / 2);
  s.fertig(g);
}
function bild(g, mat, b, h, y, rahmen = "#b88a35", innen = "#d8b45a") {
  const s = sammler(); s.box(b + .14, h + .14, .035, rahmen, 0, y - .07, .0175).box(b + .05, h + .05, .045, innen, 0, y - .025, .0225); s.fertig(g);
  quader(g, b, h, .05, mat, 0, y, .025);
}
function stuhl(x, z, ry, f, polster = null) {
  const g = gruppeBei(x, z, ry), s = sammler();
  s.box(.42, .04, .42, f, 0, .43, 0);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.box(.035, .43, .035, f, a * .18, 0, b * .18);
  for (const a of [-1, 1]) s.box(.035, .48, .035, f, a * .18, .47, -.19);
  s.box(.4, .07, .025, f, 0, .62, -.19).box(.4, .1, .025, f, 0, .84, -.19);
  if (polster) s.box(.38, .04, .38, polster, 0, .47, .01);
  s.fertig(g); stoss(g); return g;
}
function deckenlampe(x, z, art, farbe) {
  const g = gruppeBei(x, z, 0), s = sammler(), h = R.h;
  if (art === "kugel") { s.zyl(.005, .005, .5, "#e8e4dc", 0, h - .5, 0).kugel(.24, .22, .24, farbe, 0, h - .66, 0, 0, 0, 0, 16); }
  else if (art === "pendel") { s.zyl(.005, .005, .95, "#3a3a3a", 0, h - .95, 0).zyl(.05, .26, .2, farbe, 0, h - 1.13, 0, 0, 0, 0, 20).kugel(.05, .05, .05, "#fff6d8", 0, h - 1.13, 0); }
  else {
    s.zyl(.06, .06, .03, farbe, 0, h - .03, 0).zyl(.008, .008, .4, farbe, 0, h - .43, 0).kugel(.05, .05, .05, farbe, 0, h - .45, 0);
    for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3, x = Math.cos(a) * .26, zz = Math.sin(a) * .26; s.box(.26, .012, .012, farbe, x / 2, h - .46, zz / 2, -a).zyl(.07, .035, .12, "#f3ead6", x, h - .5, zz, 0, 0, 0, 12); }
  }
  s.fertig(g);
}

// ---------- Möbel ----------
const BUCHFARBEN = ["#8a2a2a", "#2a3f6a", "#2f5a3a", "#b8892f", "#6a3a2a", "#e8dcc0", "#4a2a4a", "#c8503c", "#3a6a7a", "#1f1f24", "#a86a3a", "#5a6a3a"];
function buecher(s, x0, x1, y, hMax, z0, tMax) {
  let x = x0 + zw(0, .04);
  while (x < x1 - .03) {
    if (ja(.1) && x < x1 - .28) {
      const w = zw(.15, .22); let yy = y; const n = ganz(2, 4);
      for (let k = 0; k < n; k++) { const hh = zw(.025, .045), d = zw(.14, Math.min(.2, tMax)); s.box(w, hh, d, wahl(BUCHFARBEN), x + w / 2 + .01, yy, z0 + d / 2, zw(-.08, .08)); yy += hh; }
      x += w + .03; continue;
    }
    const w = zw(.022, .055), h = zw(.58, .94) * hMax, d = zw(.14, tMax), f = wahl(BUCHFARBEN);
    s.box(w, h, d, f, x + w / 2, y, z0 + d / 2);
    if (ja(.55)) { const band = ja(.7) ? "#d9b25a" : "#1a1a1a"; s.box(w + .002, .012, .003, band, x + w / 2, y + h * .8, z0 + d + .0005); if (ja()) s.box(w + .002, .008, .003, band, x + w / 2, y + h * .12, z0 + d + .0005); }
    x += w + .002;
    if (ja(.05)) x += zw(.04, .12);
  }
}
function polster(g, b, d, f, sitze) {
  const s = sammler(), arm = .17, rl = .2, sb = b - 2 * arm, f2 = hell(f, .07), f3 = dunkel(f, .12);
  s.box(sb, .4, d - rl, f3, 0, 0, rl + (d - rl) / 2).box(b, .86, rl, f, 0, 0, rl / 2)
    .box(arm, .62, d, f, -b / 2 + arm / 2, 0, d / 2).box(arm, .62, d, f, b / 2 - arm / 2, 0, d / 2);
  const kb = sb / sitze;
  for (let i = 0; i < sitze; i++) {
    const x = -sb / 2 + kb * (i + .5);
    s.box(kb - .012, .12, d - rl - .01, f2, x, .4, rl + (d - rl) / 2);
    s.box(kb - .012, .4, .14, f, x, .52, rl + .075, 0, -.14);
  }
  s.fertig(g);
  return rl;
}
function teddy(x, y, z, ry, fell, eltern = B.gruppe) {
  const g = gruppeBei(x, z, ry, y, eltern), s = sammler(), h2 = hell(fell, .3);
  s.kugel(.09, .11, .08, fell, 0, .11, 0).kugel(.06, .07, .02, h2, 0, .1, .068)
    .kugel(.075, .072, .07, fell, 0, .26, 0).kugel(.03, .03, .016, fell, -.055, .32, 0).kugel(.03, .03, .016, fell, .055, .32, 0)
    .kugel(.035, .027, .03, h2, 0, .245, .06).kugel(.012, .01, .01, "#2a1a14", 0, .255, .09)
    .kugel(.01, .01, .01, "#111111", -.028, .28, .062).kugel(.01, .01, .01, "#111111", .028, .28, .062)
    .kugel(.03, .07, .03, fell, -.09, .13, .02, 0, 0, .5).kugel(.03, .07, .03, fell, .09, .13, .02, 0, 0, -.5)
    .kugel(.035, .035, .065, fell, -.05, .035, .06).kugel(.035, .035, .065, fell, .05, .035, .06);
  if (ja(.5)) s.box(.06, .03, .02, wahl(["#c8323a", "#3a78d0", "#f4c43a"]), 0, .19, .068);
  s.fertig(g); return g;
}
function hase(x, y, z, ry, fell, eltern = B.gruppe) {
  const g = gruppeBei(x, z, ry, y, eltern), s = sammler();
  s.kugel(.08, .095, .075, fell, 0, .095, 0).kugel(.065, .06, .06, fell, 0, .23, .01)
    .kugel(.018, .085, .01, fell, -.03, .34, -.01, 0, 0, .2).kugel(.018, .085, .01, fell, .03, .34, -.01, 0, 0, -.2)
    .kugel(.01, .06, .006, "#f2b8c4", -.031, .34, -.001, 0, 0, .2).kugel(.01, .06, .006, "#f2b8c4", .031, .34, -.001, 0, 0, -.2)
    .kugel(.012, .01, .01, "#e88a9a", 0, .225, .068).kugel(.009, .009, .009, "#111111", -.025, .245, .055).kugel(.009, .009, .009, "#111111", .025, .245, .055)
    .kugel(.03, .03, .03, "#ffffff", 0, .07, -.075).kugel(.03, .03, .06, fell, -.045, .025, .06).kugel(.03, .03, .06, fell, .045, .025, .06);
  s.fertig(g); return g;
}
function ente(x, y, z, ry, eltern = B.gruppe) {
  const g = gruppeBei(x, z, ry, y, eltern), s = sammler();
  s.kugel(.1, .075, .075, "#f4cf3a", 0, .075, 0).kugel(.055, .055, .055, "#f4cf3a", .06, .17, 0).box(.05, .016, .035, "#f0882a", .13, .16, 0)
    .kugel(.009, .009, .009, "#111111", .1, .19, -.03).kugel(.009, .009, .009, "#111111", .1, .19, .03).kugel(.04, .02, .05, "#e8b82a", -.02, .1, -.07).kugel(.04, .02, .05, "#e8b82a", -.02, .1, .07);
  s.fertig(g); return g;
}
function katze(x, y, z, ry, fell, eltern = B.gruppe) {
  const g = gruppeBei(x, z, ry, y, eltern), s = sammler(), d = dunkel(fell, .25);
  s.kugel(.16, .08, .11, fell, 0, .075, 0).kugel(.065, .06, .065, fell, .15, .1, .04)
    .geo(geoZylinder(0, .025, .05, 4, false), fell, .17, .15, .01, .3).geo(geoZylinder(0, .025, .05, 4, false), fell, .13, .15, .08, .3)
    .kugel(.03, .025, .11, d, -.05, .04, .1, .6).kugel(.008, .004, .008, "#2a2a2a", .2, .12, .03).kugel(.008, .004, .008, "#2a2a2a", .2, .12, .07);
  for (let i = 0; i < 3; i++) s.box(.012, .002, .1, d, -.05 + i * .06, .155, 0);
  s.fertig(g); return g;
}

// ---------- Omas Wohnzimmer ----------
function wohnzimmer() {
  const P = {
    tapete: wahl([
      { grund: "#eadcbe", bl: ["#c4566b", "#e58aa0", "#7c8fc4"], blatt: "#7f9a5a" },
      { grund: "#dfe5cf", bl: ["#d66a4f", "#f0b23e", "#c7609a"], blatt: "#5f8b57" },
      { grund: "#efd8cc", bl: ["#8a5aa8", "#d64f6a", "#4f8fc0"], blatt: "#6d9459" },
      { grund: "#d6e1e8", bl: ["#e07b3c", "#e8c64a", "#b94a6a"], blatt: "#5b8a63" },
    ]),
    perser: wahl([
      { feld: "#9b2a2a", rand: "#1f2f5a", hell: "#eadcb8", akzent: "#3c6a9a", gold: "#d1a248" },
      { feld: "#1f3f6a", rand: "#8a2430", hell: "#efe2c4", akzent: "#b8483a", gold: "#d8a84a" },
      { feld: "#7a2d4a", rand: "#24423a", hell: "#eee0c2", akzent: "#c98a3a", gold: "#e0b65a" },
    ]),
    sofa: wahl(["#6f7a3a", "#a8742c", "#7a4634", "#9a6070", "#4f6f78"]),
    holz: wahl(["#6a4128", "#7a4a2a", "#5c3b25"]),
    kachel: wahl(["#3f7a4e", "#2f6a5a", "#5f8a3a", "#4a7a6a"]),
    vorhang: wahl([["#efe4c8", "#b8483a", "#6d8a4a"], ["#f1e6d6", "#5a7ab0", "#6d8a4a"], ["#e8dcc4", "#8a5a2a", "#7a8a4a"]]),
    schirm: wahl(["#efe0c0", "#e8c4b0", "#f2e8d0"]),
  };
  const holzC = mHolz(P.holz), holz = stoff(holzC, .9);
  huelle(stoff(mBlumentapete(P.tapete.grund, P.tapete.bl, P.tapete.blatt), .45), stoff(mParkett("#c08a52"), .6), "#f5f1e8", dunkel(P.holz, .1));

  // Tür (Südwand, Osten) und Fenster (Westwand)
  tuer(an("s", 2.6), stoff(mTuer(holzC)), dunkel(P.holz, .05), "#c9a24a");
  fenster(an("w", .15), 1.3, .92, 2.3, stoff(mVorhang(...P.vorhang), .4), "lang");

  // Perserteppich
  quader(B.gruppe, 2.6, .012, 1.8, stoff(mPerser(P.perser)), -.3, 0, -.55);

  // Sofa an der Nordwand mit Häkeldecke und Kissen
  const kissenArten = ["streifen", "punkte", "karo", "blume", "raute", "zickzack"];
  const kissenFarben = [["#c8503c", "#f2e2c4"], ["#3a5a8a", "#e8c45a"], ["#e8c45a", "#8a3a2a"], ["#6a8a4a", "#f1e6cc"], ["#b06a9a", "#f6e8ee"], ["#e8e0cc", "#6a4a8a"], ["#d87a3a", "#3a4a6a"]];
  const kissen = () => { const [a, b] = wahl(kissenFarben); return stoff(mKissen(wahl(kissenArten), a, b)); };
  const haekel = stoff(mHaekel(mischen(["#c8503c", "#e8b84a", "#6a9a5a", "#4a7ab0", "#b06a9a", "#e88a4a"]).slice(0, 4), "#f2ead6"), .5);
  {
    const g = stoss(an("n", -.3)), rl = polster(g, 2.1, .9, P.sofa, 3);
    const hx = zw(-.35, .35), s = sammler(haekel);
    s.box(1.2, .014, rl + .03, null, hx, .86, rl / 2 + .015).box(1.2, .44, .014, null, hx, .5, rl + .155, 0, -.14);
    s.fertig(g);
    const plaetze = mischen([-.72, -.25, .25, .72]).slice(0, ganz(2, 3));
    for (const px of plaetze) quader(g, .4, .4, .12, kissen(), px + zw(-.06, .06), .52, rl + .26, zw(-.15, .15), -.32, zw(-.12, .12));
  }
  // Ölbild über dem Sofa
  bild(an("n", -.3), stoff(mOelbild(wahl(["landschaft", "meer", "hirsch"]))), 1.0, .66, 1.3);

  // Sessel am Fenster, zum Tisch gedreht
  {
    const g = stoss(gruppeBei(-2.48, -.5, PI / 2 + .12)), rl = polster(g, .92, .85, P.sofa, 1);
    if (ja(.6)) quader(g, .38, .38, .12, kissen(), 0, .52, rl + .25, zw(-.2, .2), -.32, zw(-.15, .15));
    sammler().zyl(.13, .13, .006, "#f6f2ea", 0, .86, .1, 0, 0, 0, 20).fertig(g);
  }
  // Couchtisch mit Deckchen und Kleinkram
  {
    const g = stoss(gruppeBei(-.3, -.72)), s = sammler(holz);
    s.box(1.1, .04, .6, null, 0, .41, 0);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.zyl(.022, .03, .41, null, a * .48, 0, b * .23, 0, 0, 0, 10);
    s.fertig(g);
    const k = sammler(), y = .45;
    k.zyl(.24, .24, .004, "#f6f2ea", 0, y, 0, 0, 0, 0, 24);
    const dinge = mischen(["schale", "kaffee", "vase", "kerze"]).slice(0, 2), x = [-.32, .3];
    dinge.forEach((d, i) => {
      if (d === "schale") { k.zyl(.11, .06, .06, "#b8d4d8", x[i], y, 0, 0, 0, 0, 16); for (let j = 0; j < 7; j++) k.kugel(.022, .016, .022, wahl(["#e2483a", "#f4c43a", "#4a90d0", "#6cbf5a", "#e56aa0"]), x[i] + zw(-.06, .06), y + .062, zw(-.06, .06)); }
      else if (d === "kaffee") { const p = wahl(["#4a7ab0", "#c8503c", "#6a9a5a"]); k.zyl(.055, .06, .16, "#f4f0e8", x[i], y, -.06).zyl(.045, .0, .04, p, x[i], y + .16, -.06).box(.012, .02, .07, "#f4f0e8", x[i] + .07, y + .08, -.06, 0, 0, .8); for (const dz of [.1]) k.zyl(.065, .065, .008, "#f4f0e8", x[i] + .08, y, dz).zyl(.04, .032, .06, "#f4f0e8", x[i] + .08, y + .008, dz).zyl(.041, .041, .008, p, x[i] + .08, y + .06, dz); }
      else if (d === "vase") { k.zyl(.04, .06, .2, wahl(["#2f5a8a", "#d8c8a0", "#7a3a4a"]), x[i], y, 0); for (let j = 0; j < 5; j++) { const a = j * 1.26, r = .04; k.zyl(.004, .004, .14, "#4a7a3a", x[i] + Math.cos(a) * .01, y + .18, Math.sin(a) * .01, 0, Math.sin(a) * .25, -Math.cos(a) * .25); k.kugel(.03, .025, .03, wahl(["#e2483a", "#f4c43a", "#f2f2f2", "#e56aa0"]), x[i] + Math.cos(a) * r, y + .33, Math.sin(a) * r); } }
      else { k.zyl(.05, .05, .012, "#c9a24a", x[i], y, 0).zyl(.02, .02, .2, wahl(["#c8323a", "#f2eee2", "#2f5a3a"]), x[i], y + .012, 0); }
    });
    k.fertig(g);
    if (ja(.6)) quader(g, .26, .006, .34, stoff(mZeitung()), zw(-.1, .1), .41, -.36, zw(-.4, .4));
  }
  // Schrankwand an der Südwand: unten Türen, oben offene Fächer mit Büchern, Porzellan und Fernseher
  {
    const g = stoss(an("s", -.8)), b = 3.2, n = 4, mb = b / n, t = .45, hu = .78;
    const ebenen = [hu, 1.32, 1.7, 2.06];
    quader(g, b, hu, t, [holz, stoff(mSchrankFront(holzC, 8, 512, 125))], 0, 0, t / 2);
    const s = sammler(holz);
    for (let i = 0; i <= n; i++) s.box(.03, 2.06 - hu, t - .02, null, -b / 2 + .015 + i * (b - .03) / n, hu, (t - .02) / 2 + .02);
    s.box(b, 2.06 - hu, .02, null, 0, hu, .01);
    for (const y of ebenen.slice(1, 3)) s.box(b - .02, .025, t - .04, null, 0, y - .025, (t - .04) / 2 + .02);
    s.box(b + .06, .07, t + .04, null, 0, 2.06, (t + .04) / 2);
    s.fertig(g);
    const k = sammler(), tv = ja(.75) ? ganz(1, 2) : -1;
    for (let i = 0; i < 2 * n; i++) k.kugel(.016, .016, .016, "#c9a24a", -b / 2 + (i + .5) * b / (2 * n) + (i % 2 ? -.04 : .04), hu * .78, t + .01);
    for (let i = 0; i < n; i++) for (let r = 0; r < 3; r++) {
      const xa = -b / 2 + .03 + i * (b - .03) / n + .005, xb = xa + (b - .03) / n - .04, y = ebenen[r], hm = ebenen[r + 1] - y - .03;
      if (r === 0 && i === tv) { quader(g, .62, .44, .36, [uni("#5a3a24"), stoff(mFernseher())], (xa + xb) / 2, y, .2); continue; }
      const art = r === 1 && ja(.45) ? "porzellan" : ja(.85) ? "buecher" : "porzellan";
      if (art === "buecher") buecher(k, xa, xb, y, Math.min(hm, .34), .025, .3);
      else {
        const m = (xa + xb) / 2, p = wahl(["#f4f0e8", "#e8eef4", "#f2e8d8"]), muster = wahl(["#2f5a9a", "#c8503c", "#6a8a4a", "#c9a24a"]);
        k.zyl(.11, .11, .012, p, m - .16, y + .11, .1, 0, PI / 2 - .2).zyl(.085, .085, .014, muster, m - .16, y + .112, .102, 0, PI / 2 - .2);
        k.zyl(.035, .055, .18, muster, m + .05, y, .22).zyl(.025, .035, .06, muster, m + .05, y + .18, .22);
        if (ja()) { k.zyl(.03, .04, .04, p, m + .22, y, .25).kugel(.035, .05, .035, p, m + .22, y + .08, .25).kugel(.025, .025, .025, p, m + .22, y + .14, .25); }
        else { k.zyl(.04, .03, .05, p, m + .22, y, .25).zyl(.06, .06, .006, p, m + .22, y, .25); }
      }
    }
    k.fertig(g);
  }
  // Kachelofen in der Nordostecke, daneben die Ofenbank
  {
    const g = stoss(an("n", 2.9)), km = stoff(mKacheln(P.kachel), .44), lf = hell(P.kachel, .4);
    const s = sammler(km); s.box(1.1, 1.25, .9, null, 0, .12, .45).box(.9, .6, .72, null, 0, 1.43, .38); s.fertig(g);
    sammler().box(1.16, .12, .96, "#4a3a30", 0, 0, .48).box(1.2, .06, 1.0, lf, 0, 1.37, .5).box(.98, .07, .8, lf, 0, 2.03, .4).box(.6, .04, .54, lf, 0, 2.1, .3)
      .box(.3, .26, .02, "#2b2b2b", 0, .4, .905).box(.26, .02, .025, "#3a3a3a", 0, .62, .91).kugel(.02, .02, .02, "#c9a24a", .1, .53, .925)
      .zyl(.012, .012, 1.3, "#c9a24a", .64, 1.0, .6, 0, 0, PI / 2).fertig(g);
    const bank = stoss(an("n", 1.98)), bs = sammler(holz);
    bs.box(.66, .4, .42, null, 0, 0, .21).box(.7, .04, .44, null, 0, .4, .22); bs.fertig(bank);
    if (ja(.65)) katze(zw(-.15, .1), .44, .24, zw(-.4, .4) + (ja() ? PI : 0), wahl(["#d8873a", "#8a8a8a", "#2a2a2a", "#e8e0d0"]), bank);
    else quader(bank, .5, .07, .36, kissen(), 0, .44, .22, zw(-.1, .1));
  }
  // Stehlampe neben dem Sofa
  {
    const g = stoss(gruppeBei(-1.7, -2.1)), s = sammler();
    s.zyl(.16, .18, .03, "#3a3330", 0, 0, 0, 0, 0, 0, 20).zyl(.014, .014, 1.36, "#c9a24a", 0, .03, 0)
      .zyl(.17, .26, .32, P.schirm, 0, 1.36, 0, 0, 0, 0, 24).zyl(.265, .265, .05, dunkel(P.schirm, .3), 0, 1.33, 0, 0, 0, 0, 24);
    s.fertig(g);
  }
  // Gummibaum in der Südwestecke
  {
    const g = stoss(gruppeBei(-3.02, 1.98)), s = sammler();
    s.zyl(.2, .15, .36, "#b8643c", 0, 0, 0, 0, 0, 0, 18).zyl(.215, .215, .05, "#a95a35", 0, .33, 0, 0, 0, 0, 18).zyl(.19, .19, .01, "#3a2a1e", 0, .37, 0)
      .zyl(.02, .028, 1.25, "#7a6a4a", 0, .37, 0, 0, 0, 0, 8);
    const n = ganz(14, 18);
    for (let i = 0; i < n; i++) { const a = i * 2.4 + zw(-.3, .3), y = .62 + i * (1.0 / n), l = zw(.12, .15); s.kugel(l, .016, l * .45, wahl(["#2f5a2e", "#3a6a34", "#28502a"]), Math.cos(a) * (l * .9 + .01), y, Math.sin(a) * (l * .9 + .01), -a, 0, -.35); }
    s.fertig(g);
  }
  // Kommode an der Ostwand mit Fotos und Kuckucksuhr darüber
  {
    const g = stoss(an("o", .2));
    quader(g, 1.2, .85, .45, [holz, stoff(mKommodeFront(holzC))], 0, 0, .225);
    const k = sammler();
    for (const x of [-.3, .3]) k.kugel(.015, .015, .015, "#c9a24a", x, .76, .455);
    for (const x of [-.06, .06]) k.kugel(.015, .015, .015, "#c9a24a", x, .4, .455);
    k.box(.7, .004, .3, "#f6f2ea", zw(-.15, .15), .85, .22);
    if (ja()) { k.zyl(.05, .07, .24, wahl(["#2f5a8a", "#c9a24a", "#8a2a3a"]), .4, .85, .22); for (let j = 0; j < 3; j++) k.kugel(.04, .035, .04, wahl(["#e2483a", "#f2eee2", "#e8a0b0"]), .4 + zw(-.03, .03), 1.1 + j * .02, .22 + zw(-.03, .03)); }
    else { k.zyl(.12, .1, .05, "#c9a24a", .4, .85, .22); for (let j = 0; j < 4; j++) k.kugel(.035, .035, .035, wahl(["#e2483a", "#f4c43a", "#7ab04a"]), .4 + zw(-.05, .05), .9, .22 + zw(-.05, .05)); }
    k.fertig(g);
    const nf = ganz(1, 3);
    for (let i = 0; i < nf; i++) quader(g, .14, .18, .015, stoff(mFoto()), -.45 + i * .2, .85, .2 + i * .02, zw(-.15, .15), -.18);
    // Kuckucksuhr
    const w = an("o", .2), u = sammler();
    u.box(.28, .32, .14, P.holz, 0, 1.6, .07).box(.2, .025, .2, dunkel(P.holz, .2), -.08, 1.9, .09, 0, 0, .65).box(.2, .025, .2, dunkel(P.holz, .2), .08, 1.9, .09, 0, 0, -.65)
      .zyl(.075, .075, .012, "#f1e6c8", 0, 1.74, .14, 0, PI / 2).box(.006, .06, .004, "#1f1f1f", 0, 1.74, .153).box(.04, .006, .004, "#1f1f1f", .02, 1.74, .153)
      .box(.05, .05, .01, dunkel(P.holz, .3), 0, 1.86, .141).box(.008, .3, .004, "#c9a24a", 0, 1.3, .1).zyl(.03, .03, .006, "#c9a24a", 0, 1.3, .1, 0, PI / 2)
      .zyl(.018, .018, .1, "#5a4632", -.06, 1.1, .1).zyl(.018, .018, .1, "#5a4632", .06, 1.18, .1).box(.003, .4, .003, "#8a8a8a", -.06, 1.2, .1).box(.003, .32, .003, "#8a8a8a", .06, 1.28, .1);
    for (let i = 0; i < 5; i++) u.kugel(.03, .012, .015, "#3a6a34", -.12 + i * .06, 1.86 - Math.abs(i - 2) * .02, .145, 0, 0, (i - 2) * .4);
    u.fertig(w);
    quader(w, .24, .3, .02, stoff(mFoto()), -.55, 1.45, .01);
    quader(w, .2, .25, .02, stoff(mFoto()), .55, 1.5, .01);
  }
  // Standuhr zwischen Schrankwand und Tür
  {
    const g = stoss(an("s", 1.45));
    quader(g, .5, 1.9, .32, [holz, stoff(mStanduhrFront(holzC))], 0, 0, .16);
    sammler(holz).box(.58, .08, .36, null, 0, 1.9, .18).box(.36, .1, .3, null, 0, 1.98, .15).fertig(g);
  }
  deckenlampe(-.3, -.6, "kronleuchter", "#c9a24a");

  return [
    { name: "Tür", pos: new THREE.Vector3(2.6, 1.6, 1.85), ziel: new THREE.Vector3(-1.2, .8, -2.0) },
    { name: "Fenster", pos: new THREE.Vector3(-2.55, 1.6, 1.15), ziel: new THREE.Vector3(2.4, 1.0, -1.6) },
    { name: "Mitte", pos: new THREE.Vector3(.9, 1.6, .55), ziel: new THREE.Vector3(-1.0, .9, 2.4) },
    { name: "Ofenecke", pos: new THREE.Vector3(1.7, 1.6, -1.0), ziel: new THREE.Vector3(-2.8, .7, .6) },
  ];
}

// ---------- Kinderzimmer ----------
function kinderzimmer() {
  const P = {
    streifen: wahl([["#bfe3d4", "#f6d26a", "#ffffff", "#7cc2a8"], ["#bcd8f0", "#2f5a9a", "#ffffff", "#f4a24a"], ["#f4c8d4", "#b39ad8", "#ffffff", "#e8789a"], ["#f8e4a0", "#f2944a", "#ffffff", "#6cbf8a"]]),
    bett: wahl(["#f4f1ea", "#9ac8e8", "#e8b0c0", "#a8d8a0"]),
    decke: wahl([["#d8463a", "#2a2a4a", "#f4d34a"], ["#3a78d0", "#1f2f5a", "#f4f4f4"], ["#4a9a5a", "#1f3a2a", "#f4d34a"], ["#e87aa0", "#7a3a6a", "#ffffff"]]),
    schrank: wahl(["#f4f1ea", "#bfe3f0", "#f6e0a8", "#d8ecd0"]),
    rueck: wahl(["#f6d26a", "#9ac8e8", "#f4a8b8", "#a8d8a0"]),
    fell: mischen(["#a8743a", "#d8b48a", "#8a5a3a", "#e8d8c0", "#c8c8c8"]),
  };
  const [sc, sw] = mStreifen(P.streifen);
  huelle(stoff(sc, sw / 256 * 1.1, .25), stoff(mDielen("#d4b088"), 1.3), "#f8f6f0", "#f4f1ea");
  const bord = stoff(mBordure(P.streifen.slice(1)), 1.0, .14);
  for (const w of ["n", "s", "w", "o"]) { const [a, l] = WAND[w](); teil(an(w, a), geoFlaeche(l, .14), bord, 0, 1.0, .003); }

  tuer(an("o", 1.6), stoff(mTuer(null, "#f6f4ee")), "#f4f1ea", "#b9bdc2");
  fenster(an("n", .2), 1.3, .95, 2.3, stoff(mSterne(wahl(["#2f4a8a", "#5a8ad0", "#e8789a"]), "#f6e07a"), .35), "lang");

  // Straßenteppich
  quader(B.gruppe, 2.4, .012, 1.6, stoff(mStrasse()), .3, 0, .25);

  // Bett an der Westwand mit karierter Decke
  {
    const g = stoss(gruppeBei(-2.94, -1.43)), s = sammler(), f = P.bett;
    s.box(1.0, .3, 2.0, f, 0, 0, 0).box(1.04, .95, .05, f, 0, 0, -1.025).box(1.04, .55, .05, f, 0, 0, 1.025)
      .box(.96, .14, 1.96, "#f6f4ef", 0, .3, 0);
    for (const sx of [-1, 1]) { s.kugel(.04, .04, .04, dunkel(f, .1), sx * .5, .97, -1.025).kugel(.04, .04, .04, dunkel(f, .1), sx * .5, .57, 1.025); }
    s.fertig(g);
    const dm = stoff(mKariert(...P.decke), .32);
    sammler(dm).box(1.08, .22, 1.46, null, 0, .3, .25).fertig(g);
    quader(g, .62, .13, .4, stoff(mKissen(wahl(["punkte", "streifen", "blume"]), "#f6f4ef", P.decke[0])), 0, .44, -.73, 0, .12);
    teddy(zw(-.2, .2), .52, zw(-.3, .2), zw(-.4, .4), P.fell[0], g);
  }
  bild(an("w", -1.45), stoff(mPosterRakete()), .5, .68, 1.3, "#f4f4f4", "#e4e4e4");

  // Regal mit bunten Kisten an der Südwand
  {
    const g = stoss(an("s", -1.6)), s = sammler(), w = "#f6f4ee", B3 = 1.8, T = .38;
    for (let i = 0; i < 4; i++) s.box(.02, 1.22, T, w, -B3 / 2 + .01 + i * (B3 - .02) / 3, 0, T / 2);
    for (const y of [0, .4, .8, 1.2]) s.box(B3, .02, T, w, 0, y, T / 2);
    s.box(B3, 1.22, .01, P.rueck, 0, 0, .005);
    s.fertig(g);
    const kisten = [uni("#e2483a"), uni("#f4c43a"), uni("#3a78d0"), uni("#6cbf5a"), stoff(mPunkte("#e87aa0", "#ffffff"), .16), stoff(mBlockstreifen("#f6f4ee", "#3a78d0"), .2), stoff(mPunkte("#2f4a8a", "#f6e07a", 2, 5), .14), uni("#f2944a")];
    const k = sammler(), faecher = mischen([0, 1, 2, 3, 4, 5, 6, 7, 8]), nk = ganz(4, 6);
    faecher.forEach((f, idx) => {
      const col = f % 3, row = f / 3 | 0, cx = -B3 / 2 + .02 + (col + .5) * (B3 - .04) / 3, y = row * .4 + .02;
      if (idx < nk) {
        quader(g, .5, .3, .33, kisten[(idx + ganz(0, 7)) % kisten.length], cx, y, .2);
        k.box(.12, .03, .004, "#ffffff", cx, y + .2, .3665);
      } else if (idx === nk) buecher(k, cx - .27, cx + .27, y, .34, .02, .3);
      else if (idx === nk + 1) { // Auto
        const f2 = wahl(["#e2483a", "#3a78d0", "#f4c43a"]);
        k.box(.24, .07, .12, f2, cx, y + .03, .2).box(.13, .06, .11, hell(f2, .3), cx - .02, y + .1, .2);
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.zyl(.03, .03, .025, "#2a2a2a", cx + a * .08, y + .03, .2 + b * .06, 0, PI / 2);
      } else if (idx === nk + 2) { for (let j = 0; j < 4; j++) k.box(.09, .09, .09, wahl(["#e2483a", "#3a78d0", "#f4c43a", "#6cbf5a"]), cx + zw(-.12, .12), y + (j > 2 ? .09 : 0), .2 + zw(-.05, .05), zw(-.5, .5)); }
    });
    k.fertig(g);
    hase(zw(-.6, .6), 1.22, .2, zw(-.3, .3), P.fell[1], g);
  }
  bild(an("s", -1.6), stoff(mPosterRegenbogen()), .5, .68, 1.5, "#f4f4f4", "#e4e4e4");

  // Schreibtisch unter dem Fenster mit Stuhl
  {
    const g = stoss(an("n", .2)), s = sammler(), bein = wahl(["#3a78d0", "#e2483a", "#6cbf5a", "#f4c43a"]);
    s.box(1.2, .03, .6, "#f2efe8", 0, .7, .3);
    for (const [a, b] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) s.box(.04, .7, .04, bein, a * .56, 0, .04 + b * .52);
    s.box(1.12, .04, .02, bein, 0, .62, .04);
    // Lampe, Stiftebecher, Zettel
    s.zyl(.07, .08, .02, bein, -.45, .73, .15).zyl(.01, .01, .35, "#d8d8d8", -.45, .75, .15, 0, .25).zyl(.05, .09, .1, bein, -.45, 1.03, .25, 0, .9);
    s.zyl(.04, .04, .1, wahl(["#f4c43a", "#e87aa0", "#6cbf5a"]), .42, .73, .18);
    for (let i = 0; i < 6; i++) s.box(.008, .15, .008, wahl(["#e2483a", "#3a78d0", "#f4c43a", "#6cbf5a", "#8a62c4", "#f2944a"]), .42 + zw(-.022, .022), .75, .18 + zw(-.022, .022), 0, zw(-.15, .15), zw(-.15, .15));
    s.fertig(g);
    quader(g, .3, .003, .22, stoff(mKinderbild()), zw(-.15, .1), .73, .38, zw(-.3, .3));
    // Globus
    const gl = teil(g, geoKugel(20), stoff(mGlobus()), .15, .92, .15); gl.scale.setScalar(.11); gl.rotation.z = .4;
    sammler().zyl(.06, .07, .02, "#3a3a3a", .15, .73, .15).zyl(.008, .008, .08, "#3a3a3a", .15, .75, .15).fertig(g);
  }
  stuhl(.35, -1.45, PI + zw(-.3, .3), wahl(["#f4f1ea", "#3a78d0", "#e2483a"]), wahl(["#f4c43a", "#6cbf5a", "#e87aa0"]));

  // Kleiderschrank an der Ostwand
  {
    const g = stoss(an("o", -1.2));
    const front = stoff(mKleiderschrank(P.schrank, ["#f4c43a", "#e87aa0", "#6cbf5a", "#4a90d0"]));
    quader(g, 1.0, 1.9, .55, [uni(P.schrank), front], 0, 0, .275);
    const s = sammler(); s.box(1.04, .05, .58, dunkel(P.schrank, .06), 0, 1.9, .29);
    for (const x of [-.06, .06]) s.kugel(.022, .022, .02, wahl(["#e2483a", "#3a78d0"]), x, 1.0, .56);
    s.box(.4, .2, .3, "#d8b48a", zw(-.2, .2), 1.95, .25);
    s.fertig(g);
  }
  // Spielzeugkiste an der Südwand
  {
    const g = stoss(an("s", 1.05)), f = wahl(["#f4c43a", "#6cbf5a", "#4a90d0", "#e87aa0"]);
    quader(g, .8, .42, .45, [uni(f), stoff(mSpielkiste(hell(f, .2)))], 0, 0, .225);
    sammler().box(.84, .05, .48, dunkel(f, .15), 0, .42, .24).fertig(g);
    if (ja(.6)) ente(zw(-.2, .2), .47, .25, zw(-1, 1), g);
    else teddy(zw(-.2, .2), .47, .25, zw(-.4, .4), P.fell[2], g);
  }
  // Sitzsack
  {
    const g = stoss(gruppeBei(2.25, -.05)), m = stoff(mPunkte(wahl(["#e2483a", "#3a78d0", "#6cbf5a", "#8a62c4"]), "#ffffff", 2, 5), 1 / 8, 1 / 4);
    const k = teil(g, geoKugel(18), m, 0, .26, 0, zw(0, 6)); k.scale.set(.45, .28, .45);
    const k2 = teil(g, geoKugel(14), m, -.12, .42, -.1, 0, 0, .3); k2.scale.set(.28, .2, .3);
  }
  // Bauklötze: Turm auf dem Teppich, dazu verstreute Klötze
  {
    const farben = ["#d9443a", "#3d6fc4", "#f2c53d", "#4fa35a", "#e98a2e", "#d8b48a"];
    const tx = zw(.6, 1.1), tz = zw(.3, .7), g = stoss(gruppeBei(tx, tz, zw(0, 3))), s = sammler();
    let y = .012;
    const nT = ganz(4, 6);
    for (let i = 0; i < nT; i++) {
      const art = i % 2 ? "quer" : wahl(["wuerfel", "rund", "quer"]), f = wahl(farben), r = zw(-.25, .25), dx = zw(-.012, .012);
      if (art === "wuerfel") { s.box(.08, .08, .08, f, dx, y, 0, r); y += .08; }
      else if (art === "rund") { s.zyl(.04, .04, .08, f, dx, y, 0, 0, 0, 0, 16); y += .08; }
      else { s.box(.16, .04, .08, f, dx, y, 0, r); y += .04; }
    }
    s.geo(geoZylinder(.055, .055, .08, 3, true), wahl(farben), 0, y + .0275, .04, 0, -PI / 2);
    s.fertig(g);
    const l = sammler(), n = ganz(7, 11);
    for (let i = 0; i < n; i++) {
      const x = zw(-.8, 1.4), z = zw(-.45, .95);
      if (Math.hypot(x - tx, z - tz) < .25) continue;
      const f = wahl(farben), r = zw(0, PI);
      const art = wahl(["wuerfel", "quer", "rund", "dach"]);
      if (art === "wuerfel") l.box(.08, .08, .08, f, x, .012, z, r);
      else if (art === "quer") l.box(.16, .04, .08, f, x, .012, z, r);
      else if (art === "rund") l.zyl(.04, .04, .08, f, x, .012, z, 0, 0, 0, 16);
      else l.geo(geoZylinder(.055, .055, .08, 3, true), f, x, .012 + .0275, z, r, -PI / 2);
    }
    l.fertig(B.gruppe);
    // Ball
    const bx = zw(1.6, 2.6), bz = wahl([1.0, -1.9]);
    const ball = stoss(gruppeBei(bx, bz)); const bm = teil(ball, geoKugel(20), stoff(mBall()), 0, .11, 0, zw(0, 6), .3); bm.scale.setScalar(.11);
  }
  deckenlampe(.3, .2, "kugel", wahl(["#f6f4ee", "#f6e07a", "#f4c8d4"]));

  return [
    { name: "Tür", pos: new THREE.Vector3(2.85, 1.6, 1.6), ziel: new THREE.Vector3(-2.5, .7, -1.5) },
    { name: "Fenster", pos: new THREE.Vector3(1.35, 1.6, -1.35), ziel: new THREE.Vector3(-1.6, .7, 2.3) },
    { name: "Mitte", pos: new THREE.Vector3(-.1, 1.6, .25), ziel: new THREE.Vector3(-3.0, .6, -1.4) },
    { name: "Bett", pos: new THREE.Vector3(-1.8, 1.6, 1.05), ziel: new THREE.Vector3(2.8, .8, -1.2) },
  ];
}

// ---------- Küche ----------
function kueche() {
  const P = {
    boden: wahl([["#f4f1ea", "#2a2a2e"], ["#f4f1ea", "#b8323a"], ["#f2efe6", "#2f5a8a"], ["#f2ecd8", "#3f6a4a"]]),
    fliese: wahl([["#f6f4ef", "#2f5a9a"], ["#d8ecd8", "#3a7a5a"], ["#f8eab8", "#c8603a"], ["#f6f4ef", "#c8323a"]]),
    holz: wahl(["#b07a48", "#8a5a38", "#c8955a"]),
    lack: wahl([null, null, "#6a9a7a", "#e8dcc0", "#7a9ac0"]),
    kuehl: wahl(["#f2ead6", "#bfe0d4", "#d8463a", "#a8cce4", "#f4d88a"]),
    karo: wahl(["#c8323a", "#2f5a9a", "#3f8a4a", "#e8a03a"]),
    tapete: wahl([["#f6efdc", "kirschen"], ["#eaf2ea", "#e2a03a"], ["#f8f0e0", "#c8503c"], ["#eef0f6", "kirschen"]]),
  };
  const holzC = mHolz(P.holz), holz = stoff(holzC, .9);
  huelle(stoff(mKuechentapete(...P.tapete), .3), stoff(mSchach(...P.boden), .6), "#f8f6f0", "#f2efe8");

  tuer(an("s", -2.6), stoff(mTuer(null, "#f4f2ec")), "#f2efe8", "#b9bdc2");
  const fliesen = stoff(mWandfliesen(...P.fliese), .6);

  // Küchenzeile an der Nordwand: Schränke, Herd, Spüle, Arbeitsplatte, Fliesenspiegel
  const fronten = {}; const front = art => fronten[art] || (fronten[art] = stoff(mFront(art, holzC, P.lack)));
  const korpus = P.lack ? uni(P.lack) : holz;
  {
    const g = stoss(an("n", -3.45)), arten = ["tuer", "herd", "schub", "tuer", "doppel", "tuer", "schub"], k = sammler();
    sammler().box(4.2, .1, .52, "#3a3632", 2.1, 0, .26).fertig(g);
    arten.forEach((a, i) => {
      const x = .3 + i * .6;
      quader(g, .596, .8, .58, [korpus, front(a)], x, .1, .29);
      if (a === "tuer") k.box(.02, .12, .02, "#c9ccd0", x + .22, .7, .59);
      else if (a === "doppel") { k.box(.02, .12, .02, "#c9ccd0", x - .04, .7, .59).box(.02, .12, .02, "#c9ccd0", x + .04, .7, .59); }
      else if (a === "schub") for (const y of [.83, .56, .3]) k.box(.14, .02, .02, "#c9ccd0", x, y, .59);
    });
    quader(g, 4.24, .04, .64, stoff(mHolz(hell(P.holz, .25)), .9), 2.12, .9, .32);
    // Herd: Platten und Topf
    const hx = .9;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.zyl(.085, .085, .008, "#2a2a2a", hx + a * .14, .94, .3 + b * .13, 0, 0, 0, 18);
    const topf = wahl(["#c8323a", "#2f5a9a", "#e8dcc0", "#3f8a4a"]);
    if (ja(.7)) k.zyl(.12, .12, .14, topf, hx - .14, .948, .43, 0, 0, 0, 18).zyl(.125, .125, .015, dunkel(topf, .15), hx - .14, 1.088, .43, 0, 0, 0, 18).kugel(.02, .015, .02, "#2a2a2a", hx - .14, 1.105, .43).box(.12, .02, .03, "#2a2a2a", hx - .14 + .17, 1.04, .43);
    if (ja(.6)) k.zyl(.07, .09, .18, wahl(["#f2f0ea", "#d8463a", "#4a7ab0"]), hx + .14, .948, .17, 0, 0, 0, 16).zyl(.02, .07, .04, "#2a2a2a", hx + .14, 1.128, .17).box(.03, .03, .12, "#3a3a3a", hx + .14, 1.05, .25, 0, -.6);
    // Spüle mit Hahn
    const sx = .3 + 4 * .6;
    k.box(.5, .012, .44, "#b9bec2", sx, .94, .32).zyl(.03, .03, .003, "#5a5e62", sx, .952, .34).zyl(.015, .015, .28, "#c9ccd0", sx, .94, .1).box(.025, .025, .18, "#c9ccd0", sx, 1.2, .18)
      .box(.06, .02, .02, "#c9ccd0", sx - .06, 1.0, .1).box(.06, .02, .02, "#c9ccd0", sx + .06, 1.0, .1);
    // Kleinkram auf der Arbeitsplatte
    const slots = mischen([.3, 1.5, 2.1, 3.3, 3.9]);
    slots.slice(0, 3).forEach((x, i) => {
      const art = ["brotkasten", "glaeser", "brett", "kanne", "mixer"][(i + ganz(0, 4)) % 5];
      if (art === "brotkasten") { const f = wahl(["#c8323a", "#f2ead6", "#3f8a4a", "#2f5a9a"]); k.box(.4, .2, .26, f, x, .94, .2).box(.4, .06, .2, hell(f, .2), x, 1.08, .22, 0, -.5).box(.1, .02, .02, "#c9ccd0", x, 1.1, .32); }
      else if (art === "glaeser") for (let j = 0; j < 3; j++) { const f = wahl(["#e2483a", "#f4c43a", "#7a4a2a", "#6cbf5a", "#f2f0ea"]); k.zyl(.05, .05, .14 + j * .03, f, x - .12 + j * .12, .94, .15).zyl(.052, .052, .02, wahl(["#c8323a", "#f2f0ea", "#c9ccd0"]), x - .12 + j * .12, 1.08 + j * .03, .15); }
      else if (art === "brett") { k.box(.36, .02, .24, "#d8b07a", x, .94, .3, zw(-.3, .3)).kugel(.11, .06, .07, "#c8904a", x, 1.0, .3, zw(-.3, .3)); }
      else if (art === "kanne") { const f = wahl(["#2f5a9a", "#c8323a", "#f2f0ea"]); k.kugel(.09, .08, .09, f, x, 1.02, .25, 0, 0, 0, 16).zyl(.03, .03, .03, f, x, 1.09, .25).box(.12, .02, .02, f, x + .1, 1.0, .25, 0, 0, .7).box(.02, .08, .07, "#2a2a2a", x - .1, .99, .25); }
      else { k.zyl(.08, .09, .05, "#f2f0ea", x, .94, .2).zyl(.06, .05, .22, "#d8e8ec", x, .99, .2).zyl(.065, .065, .02, "#2a2a2a", x, 1.21, .2); }
    });
    k.fertig(g);
    const w = an("n", -3.45);
    teil(w, geoFlaeche(4.2, .6), fliesen, .03, .94, .003);
  }
  // Oberschränke
  {
    const g = stoss(an("n", -3.45)), k = sammler();
    for (let i = 0; i < 3; i++) {
      const a = i === 1 && ja(.6) ? "vitrine" : "tuer";
      quader(g, .596, .7, .35, [korpus, front(a)], .3 + i * .6, 1.52, .175);
      k.box(.02, .1, .02, "#c9ccd0", .3 + i * .6 + .22, 1.6, .36);
    }
    k.box(1.8, .03, .37, dunkel(P.holz, .05), .9, 2.22, .185);
    k.fertig(g);
  }
  // Fenster über der Spüle mit Pflanze auf der Fensterbank
  {
    const g = an("n", -.75);
    const bank = fenster(g, 1.0, 1.12, 2.22, stoff(mKaro(P.karo), .16), "kurz");
    const s = sammler(), x = zw(-.3, .3);
    s.zyl(.07, .055, .12, "#b8643c", x, bank, .12, 0, 0, 0, 14).zyl(.065, .065, .01, "#3a2a1e", x, bank + .11, .12);
    for (let i = 0; i < 12; i++) { const a = i * 2.4, r = zw(.01, .07); s.kugel(.035, .012, .025, wahl(["#4a8a3a", "#5aa04a"]), x + Math.cos(a) * r, bank + .14 + i * .012, .12 + Math.sin(a) * r, -a, 0, .3); }
    s.fertig(g);
  }
  // Gewürzregal rechts neben dem Fenster
  {
    const g = an("n", .4), s = sammler(), f = dunkel(P.holz, .1);
    for (const x of [-.32, .32]) s.box(.02, .5, .12, f, x, 1.36, .06);
    const inhalt = ["#c8323a", "#e8a82a", "#5a7a3a", "#2a2a2a", "#f2eee4", "#a8642a", "#7a9a4a", "#d8c08a"];
    for (const y of [1.36, 1.6]) {
      s.box(.66, .02, .12, f, 0, y, .06).box(.62, .012, .006, f, 0, y + .06, .118);
      let x = -.27;
      while (x < .27) { const c = wahl(inhalt), hh = zw(.07, .1); s.zyl(.024, .024, hh, c, x, y + .02, .06, 0, 0, 0, 12).zyl(.026, .026, .022, wahl(["#c8323a", "#f2f0ea", "#c9ccd0", "#2f5a9a"]), x, y + .02 + hh, .06, 0, 0, 0, 12); x += zw(.065, .085); }
    }
    s.box(.66, .02, .12, f, 0, 1.84, .06);
    s.fertig(g);
  }
  // Kühlschrank mit Magneten
  {
    const g = stoss(an("n", 1.13)), f = P.kuehl;
    quader(g, .65, 1.75, .66, [uni(f), stoff(mKuehlschrank(f))], 0, 0, .33);
    const s = sammler();
    s.box(.03, .3, .04, "#c9ccd0", -.27, 1.3, .68).box(.03, .3, .04, "#c9ccd0", -.27, .8, .68);
    const magnet = ["#e2483a", "#f4c43a", "#3a78d0", "#6cbf5a", "#e87aa0", "#8a62c4", "#f2944a"];
    const nm = ganz(7, 12);
    for (let i = 0; i < nm; i++) {
      const x = zw(-.2, .26), y = zw(.55, 1.65), c = wahl(magnet), art = ganz(0, 3);
      if (art === 0) s.zyl(.025, .025, .012, c, x, y, .66, 0, PI / 2, 0, 12);
      else if (art === 1) s.box(.05, .05, .012, c, x, y - .025, .66, 0, 0, zw(-.4, .4));
      else if (art === 2) s.kugel(.03, .03, .012, c, x, y, .666);
      else s.zyl(.02, .02, .012, c, x, y, .66, 0, PI / 2, 0, 5);
    }
    s.box(.3, .2, .25, wahl(["#d8b07a", "#c8503c", "#e8e0d0"]), zw(-.1, .1), 1.75, .33);
    s.fertig(g);
    quader(g, .2, .15, .003, stoff(mKinderbild()), zw(-.05, .1), zw(1.1, 1.35), .662, 0, 0, zw(-.15, .15));
    if (ja()) quader(g, .1, .16, .003, stoff(mZeitung()), zw(-.15, 0), zw(.6, .8), .662, 0, 0, zw(-.2, .2));
  }
  // Küchenbuffet an der Westwand mit Tellern und Tassen
  {
    const g = stoss(an("w", .1)), lack = P.lack || hell(P.holz, .1), m = uni(lack);
    quader(g, 1.2, .88, .5, [m, stoff(mFront("buffet", holzC, P.lack || null))], 0, 0, .25);
    const s = sammler(holz);
    s.box(1.24, .03, .53, null, 0, .88, .265).box(1.2, .8, .02, null, 0, 1.25, .01).box(.02, .8, .26, null, -.59, 1.25, .13).box(.02, .8, .26, null, .59, 1.25, .13)
      .box(1.18, .02, .26, null, 0, 1.25, .13).box(1.18, .02, .26, null, 0, 1.55, .13).box(1.18, .02, .26, null, 0, 1.82, .13).box(1.26, .05, .3, null, 0, 2.05, .15);
    s.fertig(g);
    const k = sammler(), rand = wahl(["#2f5a9a", "#c8323a", "#3f8a4a"]);
    for (const x of [-.31, .31]) k.kugel(.018, .018, .018, "#c9ccd0", x, .82, .51);
    for (const x of [-.06, .06]) k.kugel(.018, .018, .018, "#c9ccd0", x, .5, .51);
    const nt = ganz(3, 5);
    for (let i = 0; i < nt; i++) { const x = -.45 + i * .22; k.zyl(.1, .1, .012, rand, x, 1.37, .035, 0, PI / 2 - .2).zyl(.08, .08, .013, "#f6f4ef", x, 1.372, .036, 0, PI / 2 - .2); }
    for (let i = 0; i < ganz(3, 5); i++) { const x = -.45 + i * .2, c = wahl(["#f6f4ef", rand, "#e8a82a"]); k.zyl(.04, .033, .08, c, x, 1.57, .15).box(.012, .04, .03, c, x + .045, 1.59, .15); }
    for (let i = 0; i < 3; i++) k.zyl(.05, .05, .16, wahl(["#e8dcc0", "#d8c8a0"]), -.3 + i * .3, 1.84, .13).zyl(.052, .052, .03, rand, -.3 + i * .3, 2.0, .13);
    if (ja()) k.box(.4, .2, .26, wahl(["#c8323a", "#f2ead6"]), zw(-.3, .3), .91, .2);
    else for (let j = 0; j < 4; j++) k.kugel(.04, .04, .04, wahl(["#e2483a", "#f4c43a", "#7ab04a", "#f2944a"]), zw(-.4, .4), .95, zw(.15, .35));
    k.fertig(g);
  }
  // Hochschrank in der Südostecke
  {
    const g = stoss(an("s", 3.05)), m = korpus;
    quader(g, .6, 2.0, .5, [m, front("hoch")], 0, 0, .25);
    sammler().box(.02, .12, .02, "#c9ccd0", .22, 1.0, .51).box(.02, .12, .02, "#c9ccd0", .22, .6, .51).fertig(g);
  }
  // Läufer vor der Küchenzeile
  quader(B.gruppe, 2.2, .01, .7, stoff(mLaeufer()), -1.4, 0, -1.48);
  // Tisch mit Karo-Tischdecke, Obstschale und Stühlen
  {
    const tx = 2.05, tz = .6, g = stoss(gruppeBei(tx, tz)), s = sammler(holz);
    s.box(1.3, .04, .85, null, 0, .72, 0);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.box(.06, .72, .06, null, a * .58, 0, b * .36);
    s.fertig(g);
    const d = sammler(stoff(mKaro(P.karo), .16));
    d.box(1.42, .006, .97, null, 0, .76, 0).box(1.42, .22, .006, null, 0, .546, .488).box(1.42, .22, .006, null, 0, .546, -.488).box(.006, .22, .97, null, .713, .546, 0).box(.006, .22, .97, null, -.713, .546, 0);
    d.fertig(g);
    const k = sammler(), y = .766, ox = zw(-.25, .25), oz = zw(-.15, .15);
    k.zyl(.17, .08, .08, wahl(["#f2f0ea", "#c8a878", "#4a7ab0"]), ox, y, oz, 0, 0, 0, 20);
    const obst = [["#c8323a", .045], ["#7ab04a", .045], ["#f2944a", .042], ["#f4d84a", .04]];
    for (let i = 0; i < ganz(5, 7); i++) { const [f, r] = wahl(obst), a = i * 1.3, rr = i ? .08 : 0; k.kugel(r, r * .92, r, f, ox + Math.cos(a) * rr, y + .08 + r * .6 + (i ? 0 : .03), oz + Math.sin(a) * rr); }
    k.kugel(.1, .025, .025, "#f4d03a", ox, y + .16, oz, zw(0, 3), 0, .3);
    for (let i = 0; i < ganz(0, 2); i++) { const x = wahl([-.45, .45]) + zw(-.05, .05), z = zw(-.25, .25), c = wahl(["#f6f4ef", "#2f5a9a", "#c8323a"]); k.zyl(.04, .034, .085, c, x, y, z).box(.012, .045, .03, c, x + .045, y + .025, z); }
    if (ja()) k.zyl(.03, .045, .16, wahl(["#2f5a9a", "#f2f0ea"]), -.4, y, -.2).kugel(.05, .04, .05, wahl(["#f4c43a", "#e2483a", "#f2f2f2"]), -.4, y + .2, -.2);
    k.fertig(g);
    const sf = dunkel(P.holz, .05), pf = wahl([null, P.karo, "#f2ead6"]);
    for (const [x, z, r] of [[-.33, -.62, 0], [.33, -.62, 0], [-.33, .66, PI], [.33, .66, PI]]) stuhl(tx + x + zw(-.04, .04), tz + z + zw(-.03, .05) * Math.sign(z), r + zw(-.12, .12), sf, pf);
  }
  // Wandbrett mit Kochbüchern und Dosen an der Ostwand
  {
    const g = an("o", -1.25), k = sammler(), f = dunkel(P.holz, .1);
    k.box(.9, .025, .24, f, 0, 1.45, .12);
    for (const x of [-.4, .4]) k.box(.02, .12, .2, "#3a3a3a", x, 1.33, .1);
    buecher(k, -.43, .05, 1.475, .3, .02, .2);
    for (let i = 0; i < 3; i++) { const c = wahl(["#c8323a", "#2f5a9a", "#f2ead6", "#3f8a4a", "#e8a03a"]); k.zyl(.055, .055, .14 - i * .025, c, .14 + i * .12, 1.475, .12).zyl(.057, .057, .015, "#c9ccd0", .14 + i * .12, 1.615 - i * .025, .12); }
    k.fertig(g);
  }
  // Große Zimmerpflanze an der Südwand
  {
    const g = stoss(gruppeBei(-1.45, 2.12)), s = sammler(), topf = wahl(["#b8643c", "#e8e0d0", "#2f5a7a"]);
    s.zyl(.19, .15, .34, topf, 0, 0, 0, 0, 0, 0, 16).zyl(.2, .2, .04, dunkel(topf, .1), 0, .32, 0, 0, 0, 0, 16).zyl(.18, .18, .01, "#3a2a1e", 0, .35, 0);
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4, l = zw(.32, .55), neig = zw(.5, 1.0), bx = Math.cos(a) * Math.sin(neig) * l, bz = Math.sin(a) * Math.sin(neig) * l, by = .35 + Math.cos(neig) * l;
      s.zyl(.006, .008, l, "#4a7a3a", 0, .35, 0, -a, 0, -neig, 6);
      s.kugel(.14, .012, .1, wahl(["#2f6a34", "#3a7a3e", "#28582c"]), bx, by, bz, -a, 0, -.25);
    }
    s.fertig(g);
  }
  // Uhr und Kalender
  {
    const g = an("o", .6), um = [uni("#2a2a2a"), stoff(mUhr("#2a2a2a")), uni("#2a2a2a")];
    teil(g, geoZylinder(.17, .17, .05, 28, false), um, 0, 2.0, 0, 0, PI / 2);
    quader(an("s", .6), .3, .45, .006, stoff(mKalender()), 0, 1.3, .003);
  }
  deckenlampe(2.05, .6, "pendel", wahl(["#2f5a9a", "#c8323a", "#3f8a4a", "#f2ead6"]));

  return [
    { name: "Tür", pos: new THREE.Vector3(-2.6, 1.6, 1.85), ziel: new THREE.Vector3(1.6, .9, -1.6) },
    { name: "Spüle", pos: new THREE.Vector3(-.9, 1.6, -1.25), ziel: new THREE.Vector3(2.4, .8, 1.3) },
    { name: "Mitte", pos: new THREE.Vector3(.35, 1.6, .55), ziel: new THREE.Vector3(-3.2, 1.2, .1) },
    { name: "Tisch", pos: new THREE.Vector3(.9, 1.6, 1.95), ziel: new THREE.Vector3(-1.6, 1.0, -2.2) },
  ];
}

// ---------- Bauen ----------
const BAUER = { wohnzimmer, kinderzimmer, kueche };

export function baue(art, seed) {
  if (!BAUER[art]) art = "wohnzimmer";
  const salz = { wohnzimmer: 101, kinderzimmer: 202, kueche: 303 }[art];
  const gruppe = new THREE.Group(); gruppe.name = "zimmer-" + art;
  B = { rng: zufall(((seed >>> 0) ^ Math.imul(salz, 0x9E3779B1)) >>> 0), gruppe, meshes: [], stoss: [], geos: new Map(), uni: new Map(), weg: [] };
  B.eckfarben = new THREE.MeshLambertMaterial({ vertexColors: true }); B.weg.push(B.eckfarben);
  B.himmel = stoff(mHimmel());
  const blickpunkte = BAUER[art]();
  gruppe.updateMatrixWorld(true);
  const r4 = v => new THREE.Vector3(Math.round(v.x * 1e4) / 1e4, Math.round(v.y * 1e4) / 1e4, Math.round(v.z * 1e4) / 1e4);
  const kaesten = B.stoss.map(o => { const b = new THREE.Box3().setFromObject(o); return { min: r4(b.min), max: r4(b.max) }; });
  const { meshes, weg } = B;
  B = null;
  return {
    gruppe, meshes, kaesten, blickpunkte,
    raum: { ...R },
    farbeAn,
    entsorgen() { for (const w of weg) w.dispose(); },
  };
}

// ---------- Farbe an einer Stelle (Pipette, Abpausen, Bots) ----------
const PIXEL = new WeakMap();
const _c = new THREE.Color(), _uv = new THREE.Vector2();
function pixel(bildQuelle) {
  let d = PIXEL.get(bildQuelle);
  if (!d) {
    const w = bildQuelle.width, h = bildQuelle.height;
    let ctx = bildQuelle.getContext ? bildQuelle.getContext("2d") : null;
    if (!ctx) { const c = document.createElement("canvas"); c.width = w; c.height = h; ctx = c.getContext("2d"); ctx.drawImage(bildQuelle, 0, 0); }
    d = { w, h, px: ctx.getImageData(0, 0, w, h).data };
    PIXEL.set(bildQuelle, d);
  }
  return d;
}
export function farbeAn(treffer) {
  if (!treffer || !treffer.object) return "#808080";
  let m = treffer.object.material;
  if (Array.isArray(m)) m = m[treffer.face ? treffer.face.materialIndex : 0] || m[0];
  const geo = treffer.object.geometry;
  if (m.vertexColors && geo.attributes.color && treffer.face) {
    _c.fromBufferAttribute(geo.attributes.color, treffer.face.a);
  } else if (m.map && m.map.image && treffer.uv) {
    const t = m.map, d = pixel(t.image);
    t.updateMatrix(); _uv.copy(treffer.uv); t.transformUv(_uv);
    const x = Math.min(d.w - 1, Math.max(0, Math.floor(_uv.x * d.w))), y = Math.min(d.h - 1, Math.max(0, Math.floor(_uv.y * d.h))), i = (y * d.w + x) * 4;
    _c.setRGB(d.px[i] / 255, d.px[i + 1] / 255, d.px[i + 2] / 255, THREE.SRGBColorSpace);
  } else _c.setRGB(1, 1, 1);
  _c.multiply(m.color);
  return "#" + _c.getHexString();
}
