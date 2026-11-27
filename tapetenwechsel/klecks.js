// Tapetenwechsel: der Klecks. Knetbare Form (Superellipsoid: flach ↔ hoch, rund ↔ kantig) mit gleichem Volumen,
// Malfläche 256 × 256, die um den Klecks gewickelt ist. Für jeden Bildpunkt kennt der Klecks seine Stelle im Raum,
// so ist ein Pinselstrich überall gleich breit. Dazu Eimer, Rückgängig, Abpausen und Augen (nur für die Auflösung).
import * as THREE from "three";

export const N = 256;                       // Kantenlänge der Malfläche
const SU = 64, SV = 40;                     // Gitter der Form
const R0 = 0.17;                            // Grundradius (bei mittlerer Form ~35 cm hoch)
export const WEISS = "#F3F0E8";

const sp = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);

// Halbachsen für Höhe h (0 flach … 1 hoch) und Ecken k (0 rund … 1 kantig), Volumen etwa gleich
export function achsen(h, k) {
  const s = h < 0.5 ? 0.32 + (1 - 0.32) * (h * 2) : 1 + (2.6 - 1) * ((h - 0.5) * 2);
  const f = 1 - 0.19 * k;                   // kantig hat mehr Volumen → etwas kleiner
  return { a: R0 * f / Math.cbrt(s), c: R0 * f * Math.pow(s, 2 / 3), eps: 1 - 0.8 * k, spitze: 1 - k };
}
// Punkt der Oberfläche für u, v ∈ [0, 1] (u rundherum, v von unten nach oben). Unterseite liegt bei y = 0.
function punkt(A, u, v, out) {
  const ph = u * Math.PI * 2 - Math.PI, th = v * Math.PI - Math.PI / 2;
  const ct = Math.cos(th), st = Math.sin(th), e = A.eps;
  const r = sp(ct, e);
  let x = A.a * r * sp(Math.cos(ph), e), z = A.a * r * sp(Math.sin(ph), e), y = A.c * sp(st, e);
  if (y < 0) y *= 0.82;                                   // unten etwas platter, damit er sitzt
  if (A.spitze > 0 && v > 0.5) {                          // Tropfenspitze oben
    const q = Math.max(0, (v - 0.72) / 0.28);
    y += A.c * 0.34 * A.spitze * q * q * q;
    const w = 1 - 0.25 * A.spitze * q * q; x *= w; z *= w;
  }
  out[0] = x; out[1] = y + A.c * 0.82; out[2] = z;
  return out;
}

export class Klecks {
  constructor() {
    this.h = 0.5; this.k = 0;
    this.leinwand = document.createElement("canvas"); this.leinwand.width = this.leinwand.height = N;
    this.ctx = this.leinwand.getContext("2d", { willReadFrequently: true });
    this.ctx.fillStyle = WEISS; this.ctx.fillRect(0, 0, N, N);
    this.bild = this.ctx.getImageData(0, 0, N, N);
    this.tex = new THREE.CanvasTexture(this.leinwand);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.wrapS = THREE.RepeatWrapping;
    this.tex.anisotropy = 4;
    this.geo = new THREE.BufferGeometry();
    const n = (SU + 1) * (SV + 1);
    this.geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const uv = new Float32Array(n * 2), idx = [];
    for (let j = 0; j <= SV; j++) for (let i = 0; i <= SU; i++) { const o = j * (SU + 1) + i; uv[o * 2] = i / SU; uv[o * 2 + 1] = j / SV; }
    for (let j = 0; j < SV; j++) for (let i = 0; i < SU; i++) {
      const a = j * (SU + 1) + i, b = a + 1, c = a + SU + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    this.geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.mat = new THREE.MeshLambertMaterial({ map: this.tex });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.userData.klecks = this;
    this.gruppe = new THREE.Group();
    this.gruppe.add(this.mesh);
    this.augen = new THREE.Group(); this.gruppe.add(this.augen);
    const weiss = new THREE.MeshLambertMaterial({ color: 0xffffff }), schwarz = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    for (const s of [-1, 1]) {
      const auge = new THREE.Group();
      const ap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), weiss);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), schwarz); pu.position.z = 0.034;
      auge.add(ap, pu); auge.userData.s = s; this.augen.add(auge);
    }
    this.augen.visible = false;
    this.texPos = new Float32Array(N * N * 3);
    this.verlauf = [];
    this.drehung = 0; this.p = new THREE.Vector3(); this.n = new THREE.Vector3(0, 1, 0);
    this.form(0.5, 0);
  }
  form(h, k) {
    this.h = Math.max(0, Math.min(1, h)); this.k = Math.max(0, Math.min(1, k));
    const A = this.A = achsen(this.h, this.k), pos = this.geo.attributes.position.array, o = [0, 0, 0];
    for (let j = 0; j <= SV; j++) for (let i = 0; i <= SU; i++) {
      punkt(A, i / SU, j / SV, o); const q = (j * (SU + 1) + i) * 3;
      pos[q] = o[0]; pos[q + 1] = o[1]; pos[q + 2] = o[2];
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    const nr = this.geo.attributes.normal.array;
    for (let j = 0; j <= SV; j++) {                       // Naht und Pole glätten
      const a = j * (SU + 1) * 3, b = (j * (SU + 1) + SU) * 3;
      for (let c = 0; c < 3; c++) { const m = (nr[a + c] + nr[b + c]) / 2; nr[a + c] = nr[b + c] = m; }
    }
    for (const j of [0, SV]) {
      let sx = 0, sy = 0, sz = 0;
      for (let i = 0; i <= SU; i++) { const q = (j * (SU + 1) + i) * 3; sx += nr[q]; sy += nr[q + 1]; sz += nr[q + 2]; }
      const l = Math.hypot(sx, sy, sz) || 1;
      for (let i = 0; i <= SU; i++) { const q = (j * (SU + 1) + i) * 3; nr[q] = sx / l; nr[q + 1] = sy / l; nr[q + 2] = sz / l; }
    }
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.computeBoundingSphere(); this.geo.computeBoundingBox();
    // Stellen der Bildpunkte (Zeile 0 der Leinwand ist oben = v nahe 1)
    const tp = this.texPos;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      punkt(A, (x + 0.5) / N, 1 - (y + 0.5) / N, o); const q = (y * N + x) * 3;
      tp[q] = o[0]; tp[q + 1] = o[1]; tp[q + 2] = o[2];
    }
    // Augen vorne (z+) auf der Oberfläche
    for (const auge of this.augen.children) {
      const u = 0.75 + auge.userData.s * 0.055, v = 0.6;
      punkt(A, u, v, o); auge.position.set(o[0], o[1], o[2]);
      const nn = new THREE.Vector3(o[0], 0, o[2]).normalize();
      auge.position.addScaledVector(nn, 0.012);
      auge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nn);
    }
  }
  hoeheOben() { return this.geo.boundingBox ? this.geo.boundingBox.max.y : 0.35; }
  mitteLokal() { return new THREE.Vector3(0, this.hoeheOben() / 2, 0); }
  mitteWelt() { this.gruppe.updateMatrixWorld(); return this.mitteLokal().applyMatrix4(this.gruppe.matrixWorld); }
  setzen(p, n, drehung) {
    this.p.copy(p); this.n.copy(n).normalize(); if (drehung != null) this.drehung = drehung;
    this.gruppe.position.copy(p).addScaledVector(this.n, -0.012);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.n);
    const qd = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.drehung);
    this.gruppe.quaternion.copy(q).multiply(qd);
    this.gruppe.updateMatrixWorld(true);
  }
  drehen(d) { this.setzen(this.p, this.n, this.drehung + d); }
  // ---------- Malen ----------
  merken() { this.verlauf.push(new ImageData(new Uint8ClampedArray(this.bild.data), N, N)); if (this.verlauf.length > 12) this.verlauf.shift(); }
  rueck() { const b = this.verlauf.pop(); if (!b) return false; this.bild = b; this.zeigen(); return true; }
  zeigen() { this.ctx.putImageData(this.bild, 0, 0); this.tex.needsUpdate = true; }
  tupfen(l, r, hex) {             // l: Punkt in Klecks-Koordinaten
    const c = rgb(hex), rr = c[0], gg = c[1], bb = c[2];
    const d = this.bild.data, tp = this.texPos, r2 = r * r, lx = l.x, ly = l.y, lz = l.z;
    let n = 0;
    for (let i = 0, q = 0; i < N * N; i++, q += 3) {
      const dx = tp[q] - lx, dy = tp[q + 1] - ly, dz = tp[q + 2] - lz;
      if (dx * dx + dy * dy + dz * dz <= r2) { const o = i * 4; d[o] = rr; d[o + 1] = gg; d[o + 2] = bb; d[o + 3] = 255; n++; }
    }
    return n;
  }
  strich(a, b, r, hex) {
    const l = a.distanceTo(b), schritte = Math.max(1, Math.ceil(l / (r * 0.5)));
    const t = new THREE.Vector3();
    for (let i = 1; i <= schritte; i++) { t.lerpVectors(a, b, i / schritte); this.tupfen(t, r, hex); }
  }
  eimer(hex) { const c = rgb(hex), d = this.bild.data; for (let i = 0; i < N * N; i++) { const o = i * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; } this.zeigen(); }
  weltZuLokal(p) { this.mesh.updateMatrixWorld(); return this.mesh.worldToLocal(p.clone()); }
  // Abpausen: von „von“ aus durch jeden (groben) Bildpunkt auf die Fläche dahinter schauen und deren Farbe übernehmen.
  // block: Größe der groben Pixel (in Bildpunkten), rauschen: Farbfehler 0..1 (Bots), wahl: nur zum Blickpunkt zeigende Seite?
  abpausen(von, meshes, farbeAn, block = 8, rauschen = 0, rng = Math.random) {
    this.gruppe.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(), w = new THREE.Vector3(), dir = new THREE.Vector3(), d = this.bild.data, tp = this.texPos;
    const M = this.mesh.matrixWorld, mitte = this.mitteWelt();
    for (let by = 0; by < N; by += block) for (let bx = 0; bx < N; bx += block) {
      const cx = Math.min(N - 1, bx + (block >> 1)), cy = Math.min(N - 1, by + (block >> 1)), q = (cy * N + cx) * 3;
      w.set(tp[q], tp[q + 1], tp[q + 2]).applyMatrix4(M);
      dir.subVectors(w, von);
      // Bildpunkte auf der abgewandten Seite: so tun, als schaue man von gegenüber
      const nach = new THREE.Vector3().subVectors(w, mitte);
      if (nach.dot(dir) < 0) dir.copy(nach).multiplyScalar(-1).add(new THREE.Vector3().subVectors(mitte, von).normalize().multiplyScalar(0.5 * nach.length()));
      dir.normalize();
      ray.set(w, dir); ray.far = 12;
      const t = ray.intersectObjects(meshes, false)[0];
      let c = t ? rgb(farbeAn(t)) : [200, 200, 200];
      if (rauschen > 0) { const s = (rng() - 0.5) * 80 * rauschen; c = c.map(x => Math.max(0, Math.min(255, Math.round(x + s + (rng() - 0.5) * 40 * rauschen)))); }
      for (let y = by; y < Math.min(N, by + block); y++) for (let x = bx; x < Math.min(N, bx + block); x++) { const o = (y * N + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
    }
    this.zeigen();
  }
  farben() {                                  // wie viele deutlich verschiedene Farben (grob gezählt)
    const d = this.bild.data, s = new Map();
    for (let i = 0; i < N * N; i += 7) { const o = i * 4, k = (d[o] >> 4) << 8 | (d[o + 1] >> 4) << 4 | (d[o + 2] >> 4); s.set(k, (s.get(k) || 0) + 1); }
    let n = 0; for (const v of s.values()) if (v > 8) n++;
    return n;
  }
  // ---------- Austausch ----------
  bildUrl() { this.zeigen(); try { const u = this.leinwand.toDataURL("image/webp", 0.85); if (u.startsWith("data:image/webp")) return u; } catch (e) {} return this.leinwand.toDataURL("image/png"); }
  ladeBild(url) {
    return new Promise(res => {
      if (!url) return res(false);
      const img = new Image();
      img.onload = () => { this.ctx.drawImage(img, 0, 0, N, N); this.bild = this.ctx.getImageData(0, 0, N, N); this.tex.needsUpdate = true; res(true); };
      img.onerror = () => res(false);
      img.src = url;
    });
  }
  daten() { return { p: [r3(this.p.x), r3(this.p.y), r3(this.p.z)], n: [r3(this.n.x), r3(this.n.y), r3(this.n.z)], d: r3(this.drehung), h: r3(this.h), k: r3(this.k) }; }
  anwenden(dt) { this.form(dt.h, dt.k); this.setzen(new THREE.Vector3(...dt.p), new THREE.Vector3(...dt.n), dt.d); }
  entsorgen() { this.geo.dispose(); this.mat.dispose(); this.tex.dispose(); }
}
const r3 = x => Math.round(x * 1000) / 1000;
export function rgb(hex) { const h = String(hex).replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
