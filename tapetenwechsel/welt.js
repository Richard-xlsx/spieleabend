// Tapetenwechsel: die 3D-Welt eines Handys. Renderer, Szene, Kamera, das Zimmer der Runde, Strahlen,
// Sichtprüfung (ist ein Platz vom Boden aus zu sehen?) und Laufen mit Anstoßen an Möbeln.
import * as THREE from "three";
import { baue, licht } from "./zimmer.js";

export const AUGE = 1.6, HOCKE = 0.7, RADIUS = 0.25;

export function neueWelt(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
  const schwach = (navigator.hardwareConcurrency || 4) <= 4;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, schwach ? 1.5 : 2));
  const szene = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(62, 2, 0.03, 40);
  licht(szene);
  const W = { renderer, szene, kamera, Z: null, art: null, seed: null, punkte: [], kaesten: [] };
  const ray = new THREE.Raycaster();

  W.laden = (art, seed) => {
    if (W.Z && W.art === art && W.seed === seed) return W.Z;
    if (W.Z) { szene.remove(W.Z.gruppe); try { W.Z.entsorgen ? W.Z.entsorgen() : W.Z.gruppe.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } catch (e) {} }
    W.Z = baue(art, seed); W.art = art; W.seed = seed;
    szene.add(W.Z.gruppe);
    W.kaesten = W.Z.kaesten.filter(k => k.min.y < 1.0 && k.max.y > 0.05);
    // Probepunkte auf dem begehbaren Boden für die Sichtprüfung
    const r = W.Z.raum; W.punkte = [];
    for (let x = r.x0 + 0.35; x <= r.x1 - 0.35; x += 0.5) for (let z = r.z0 + 0.35; z <= r.z1 - 0.35; z += 0.5)
      if (frei(x, z)) W.punkte.push(new THREE.Vector2(x, z));
    return W.Z;
  };
  function frei(x, z, rad = RADIUS) {
    const r = W.Z.raum;
    if (x < r.x0 + rad || x > r.x1 - rad || z < r.z0 + rad || z > r.z1 - rad) return false;
    for (const k of W.kaesten) if (x > k.min.x - rad && x < k.max.x + rad && z > k.min.z - rad && z < k.max.z + rad) return false;
    return true;
  }
  W.frei = frei;
  // Laufen: Schritt in x und z getrennt, damit man an Möbeln entlanggleitet
  W.gehen = (pos, dx, dz) => {
    if (frei(pos.x + dx, pos.z)) pos.x += dx;
    if (frei(pos.x, pos.z + dz)) pos.z += dz;
    return pos;
  };
  W.groesse = () => {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    kamera.aspect = w / Math.max(1, h); kamera.updateProjectionMatrix();
  };
  W.render = () => { W.groesse(); renderer.render(szene, kamera); };
  W.strahl = (cx, cy, objekte) => {
    const b = canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(v, kamera); ray.far = 40;
    return ray.intersectObjects(objekte, false);
  };
  // Ist der Punkt p (Welt) frei zu sehen von a aus? (nur Zimmer-Flächen verdecken)
  W.sieht = (a, p, rest = 0.04) => {
    const d = new THREE.Vector3().subVectors(p, a), l = d.length();
    ray.set(a, d.normalize()); ray.far = l;
    const t = ray.intersectObjects(W.Z.meshes, false)[0];
    return !t || t.distance >= l - rest;
  };
  // Kann man einen Klecks an dieser Stelle vom Boden aus sehen (stehend oder in der Hocke)?
  W.sichtbar = (ziele) => {
    const a = new THREE.Vector3();
    for (const h of [AUGE, HOCKE]) for (const q of W.punkte) {
      a.set(q.x, h, q.y);
      for (const p of ziele) if (W.sieht(a, p)) return true;
    }
    return false;
  };
  W.normaleVon = t => t.face ? t.face.normal.clone().transformDirection(t.object.matrixWorld).normalize() : new THREE.Vector3(0, 1, 0);
  return W;
}
