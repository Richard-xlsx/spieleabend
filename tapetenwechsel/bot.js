// Tapetenwechsel: Bots. Verstecken: erlaubten Platz suchen, passende Form, von einem Blickpunkt abpausen (je nach
// Geschick grob und verwackelt). Suchen: zwischen Blickpunkten laufen, umschauen, Kleckse in Sicht je nach Tarnwert bemerken.
import * as THREE from "three";
import { Klecks, rgb } from "./klecks.js";
import { AUGE } from "./welt.js";

export function platzErlaubt(W, kl) {
  const Z = W.Z, m = kl.mitteWelt(), r = Z.raum;
  if (m.x < r.x0 || m.x > r.x1 || m.z < r.z0 || m.z > r.z1 || m.y < 0 || m.y > r.h) return false;
  if (Z.kaesten.some(k => m.x > k.min.x + 0.03 && m.x < k.max.x - 0.03 && m.y > k.min.y + 0.03 && m.y < k.max.y - 0.03 && m.z > k.min.z + 0.03 && m.z < k.max.z - 0.03)) return false;
  return W.sichtbar([m, m.clone().addScaledVector(kl.n, kl.hoeheOben() * 0.45)]);
}

export function botVerstecken(W, rng, geschick) {
  const Z = W.Z, r = Z.raum, kl = new Klecks(), ray = new THREE.Raycaster();
  let ok = false;
  for (let v = 0; v < 80 && !ok; v++) {
    const a = new THREE.Vector3(r.x0 + 0.4 + rng() * (r.x1 - r.x0 - 0.8), 0.4 + rng() * (r.h - 0.8), r.z0 + 0.4 + rng() * (r.z1 - r.z0 - 0.8));
    const d = new THREE.Vector3(rng() - 0.5, -0.2 - rng() * 0.9, rng() - 0.5).normalize();
    ray.set(a, d); ray.far = 10;
    const t = ray.intersectObjects(Z.meshes, false)[0]; if (!t) continue;
    const n = W.normaleVon(t); if (n.y < -0.3) continue;
    const wand = Math.abs(n.y) < 0.5;
    kl.form(wand ? 0.05 + rng() * 0.25 : rng() < 0.5 ? rng() * 0.35 : 0.3 + rng() * 0.6, rng() < 0.4 ? 0.6 + rng() * 0.4 : rng() * 0.35);
    kl.setzen(t.point, n, rng() * Math.PI * 2);
    ok = platzErlaubt(W, kl);
  }
  if (!ok) { kl.setzen(new THREE.Vector3((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2), new THREE.Vector3(0, 1, 0), 0); }
  // Abpausen vom Blickpunkt, der am nächsten dran ist (oder zufällig)
  const B = Z.blickpunkte, m = kl.mitteWelt();
  const bp = rng() < 0.6 ? B.slice().sort((a, b) => a.pos.distanceTo(m) - b.pos.distanceTo(m))[0] : B[Math.floor(rng() * B.length)];
  kl.abpausen(bp.pos.clone(), Z.meshes, Z.farbeAn, geschick > 0.6 ? 4 : 8, (1 - geschick) * 0.5, rng);
  const out = { d: kl.daten(), bild: kl.bildUrl(), farben: kl.farben() };
  kl.entsorgen();
  return out;
}

// Tarnwert 0 (fällt auf) … 1 (unsichtbar): Farben des Kleckses gegen das, was von den Blickpunkten aus dahinter liegt
export function tarnwert(W, kl, rng = Math.random) {
  const Z = W.Z, ray = new THREE.Raycaster(), tp = kl.texPos, d = kl.bild.data, M = kl.mesh.matrixWorld, w = new THREE.Vector3(), dir = new THREE.Vector3();
  kl.gruppe.updateMatrixWorld(true);
  let summe = 0, n = 0;
  for (const B of Z.blickpunkte) {
    const m = kl.mitteWelt(); if (!W.sieht(B.pos, m, 0.25)) continue;
    for (let i = 0; i < 40; i++) {
      const px = (rng() * 256 * 256) | 0, q = px * 3;
      w.set(tp[q], tp[q + 1], tp[q + 2]).applyMatrix4(M);
      if (new THREE.Vector3().subVectors(w, m).dot(new THREE.Vector3().subVectors(B.pos, m)) <= 0) continue;   // Rückseite
      dir.subVectors(w, B.pos).normalize(); ray.set(w, dir); ray.far = 12;
      const t = ray.intersectObjects(Z.meshes, false)[0]; if (!t) continue;
      const c = rgb(Z.farbeAn(t)), o = px * 4;
      summe += Math.min(1, (Math.abs(c[0] - d[o]) + Math.abs(c[1] - d[o + 1]) + Math.abs(c[2] - d[o + 2])) / 240); n++;
    }
  }
  return n ? Math.max(0, Math.min(1, 1 - summe / n)) : 0.9;
}

// Ein suchender Bot (läuft auf dem Handy des Spielleiters)
export function neuerSucher(W, rng, geschick) {
  const Z = W.Z, B = Z.blickpunkte[0];
  const pos = new THREE.Vector3(B.pos.x, AUGE, B.pos.z), zu = new THREE.Vector3().subVectors(B.ziel, B.pos);
  return { pos, yaw: Math.atan2(zu.x, zu.z), pitch: -0.15, zielYaw: Math.atan2(zu.x, zu.z), zielPitch: -0.2, weg: null, warte: 0.5 + rng() * 1.5, pruef: 0, bemerkt: null, rng, geschick, danebenUhr: 25 + rng() * 40 };
}
// dt Sekunden weiter; kleckse: [{pid, klecks, tarn, gefunden}], ich: eigene pid, anteil: Anteil der Suchzeit 0..1.
// Liefert {fund: pid} oder {daneben: true} oder null.
export function sucherSchritt(W, b, dt, kleckse, ich, anteil) {
  const rng = b.rng;
  if (b.bemerkt) {                       // auf den bemerkten Klecks schauen, dann tippen
    const k = kleckse.find(k => k.pid === b.bemerkt.pid);
    if (!k || k.gefunden) { b.bemerkt = null; }
    else {
      const m = k.klecks.mitteWelt(), v = m.sub(b.pos);
      b.zielYaw = Math.atan2(v.x, v.z); b.zielPitch = Math.atan2(v.y, Math.hypot(v.x, v.z));
      drehen(b, dt * 2.2);
      b.bemerkt.t -= dt;
      if (b.bemerkt.t <= 0) { const p = b.bemerkt.pid; b.bemerkt = null; return { fund: p }; }
      return null;
    }
  }
  // Laufen
  if (!b.weg && (b.warte -= dt) <= 0) {
    const P = W.punkte; if (P.length) { const q = P[Math.floor(rng() * P.length)]; b.weg = new THREE.Vector3(q.x, AUGE, q.y); }
  }
  if (b.weg) {
    const v = new THREE.Vector3(b.weg.x - b.pos.x, 0, b.weg.z - b.pos.z), l = v.length();
    if (l < 0.2) { b.weg = null; b.warte = 1.2 + rng() * 2.5; b.zielYaw = b.yaw + (rng() - 0.5) * 4; b.zielPitch = -0.5 + rng() * 0.7; }
    else {
      const s = Math.min(l, 1.3 * dt); const x0 = b.pos.x, z0 = b.pos.z;
      W.gehen(b.pos, v.x / l * s, v.z / l * s);
      if (Math.hypot(b.pos.x - x0, b.pos.z - z0) < s * 0.2) { b.weg = null; b.warte = 0.3; }
      b.zielYaw = Math.atan2(v.x, v.z) + Math.sin(performance.now() / 700) * 0.6;
    }
  } else if (rng() < dt * 0.7) { b.zielYaw = b.yaw + (rng() - 0.5) * 3; b.zielPitch = -0.6 + rng() * 0.8; }
  drehen(b, dt * 1.4);
  // Bemerken
  b.pruef -= dt;
  if (b.pruef <= 0) {
    b.pruef = 0.4;
    const blick = new THREE.Vector3(Math.sin(b.yaw) * Math.cos(b.pitch), Math.sin(b.pitch), Math.cos(b.yaw) * Math.cos(b.pitch));
    for (const k of kleckse) {
      if (k.gefunden || k.pid === ich) continue;
      const m = k.klecks.mitteWelt(), v = m.clone().sub(b.pos), d = v.length();
      if (d > 6.5 || v.normalize().dot(blick) < Math.cos(0.55)) continue;
      if (!W.sieht(b.pos, m, 0.2)) continue;
      const rate = Math.pow(1 - (k.tarn == null ? 0.5 : k.tarn), 1.6) * Math.max(0.1, 1.25 - d / 5) * (0.35 + b.geschick * 0.6) * (0.4 + 0.9 * anteil) * 1.1;
      if (rng() < rate * 0.4) { b.bemerkt = { pid: k.pid, t: 0.6 + rng() * 0.8 }; break; }
    }
    b.danebenUhr -= 0.4;
    if (b.danebenUhr <= 0) { b.danebenUhr = 30 + rng() * 50; if (rng() > b.geschick) return { daneben: true }; }
  }
  return null;
}
function drehen(b, k) {
  let d = b.zielYaw - b.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  b.yaw += d * Math.min(1, k); b.pitch += (b.zielPitch - b.pitch) * Math.min(1, k);
}
export const botPose = b => [r2(b.pos.x), r2(b.pos.y), r2(b.pos.z), r2(b.yaw), r2(b.pitch), 60];
const r2 = x => Math.round(x * 100) / 100;
