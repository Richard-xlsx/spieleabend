// Tapetenwechsel: Auflösung. Die Kamera fliegt der Reihe nach zu jedem Versteck, der Klecks reißt die Augen auf
// („Kuckuck!“), dazu Name und Ergebnis. Zeitlich an die Uhr des Spielleiters gebunden, damit alle dasselbe sehen.
import * as THREE from "three";
import { markieren } from "./suchen.js";

export function aufloesungStarten(W, ui, opt) {
  // opt: { reihe: [{pid, klecks, name, farbe, text}], start (ms Spielleiter-Uhr), jetzt(), intro, pro, K, onIndex(i) }
  const K = opt.K || { spiel() {} }, kam = W.kamera, Z = W.Z;
  let idx = -2, ziel = new THREE.Vector3(), blickZiel = new THREE.Vector3(), pop = 0, popKl = null;
  const mitte = new THREE.Vector3((Z.raum.x0 + Z.raum.x1) / 2, 1.0, (Z.raum.z0 + Z.raum.z1) / 2);
  ui.innerHTML = `<div class="af-schild"></div>`;
  const schild = ui.querySelector(".af-schild");
  for (const e of opt.reihe) markieren(e.klecks, e.farbe);
  for (const e of opt.reihe) e.klecks.augen.visible = false;
  kam.fov = 55; kam.updateProjectionMatrix();
  blickZiel.copy(mitte);
  function zeigen(i) {
    if (i < 0 || i >= opt.reihe.length) {
      schild.classList.remove("an");
      return;
    }
    const e = opt.reihe[i], kl = e.klecks, m = kl.mitteWelt();
    // Kamera vor den Klecks: entlang der Flächennormale, etwas zur Raummitte hin und von oben
    const zurMitte = new THREE.Vector3().subVectors(mitte, m).setY(0).normalize();
    const richt = kl.n.clone().multiplyScalar(0.6).add(zurMitte).add(new THREE.Vector3(0, 0.45, 0)).normalize();
    ziel.copy(m).addScaledVector(richt, 1.05);
    const r = Z.raum; ziel.x = Math.max(r.x0 + 0.1, Math.min(r.x1 - 0.1, ziel.x)); ziel.z = Math.max(r.z0 + 0.1, Math.min(r.z1 - 0.1, ziel.z)); ziel.y = Math.max(0.15, Math.min(r.h - 0.1, ziel.y));
    blickZiel.copy(m);
    popKl = kl; pop = 0; kl.augen.visible = true; kl.augen.scale.setScalar(0.01);
    schild.innerHTML = `<b style="--f:${e.farbe}">${e.name}</b><span>${e.text}</span>`;
    schild.classList.add("an");
    setTimeout(() => K.spiel("kuckuck"), 450);
    K.spiel("zeigen", 0.5);
    if (opt.onIndex) opt.onIndex(i);
  }
  kam.position.copy(Z.blickpunkte[0].pos);
  return {
    schritt(dt) {
      const t = opt.jetzt() - opt.start - opt.intro;
      const i = t < 0 ? -1 : Math.floor(t / opt.pro);
      if (i !== idx) { idx = i; zeigen(i); if (i >= opt.reihe.length || i < 0) { ziel.copy(mitte).add(new THREE.Vector3(Math.sin(t / 3000) * 2.2, 1.3, Math.cos(t / 3000) * 1.6)); blickZiel.copy(mitte); } }
      if (i < 0 || i >= opt.reihe.length) { const w = opt.jetzt() / 4000; ziel.set(mitte.x + Math.sin(w) * 2.2, 2.2, mitte.z + Math.cos(w) * 1.5); blickZiel.copy(mitte).setY(0.6); }
      kam.position.lerp(ziel, Math.min(1, dt * 2.5));
      const blick = new THREE.Vector3(); kam.getWorldDirection(blick);
      const soll = new THREE.Vector3().subVectors(blickZiel, kam.position).normalize();
      blick.lerp(soll, Math.min(1, dt * 4));
      kam.lookAt(kam.position.clone().add(blick));
      if (popKl && pop < 1) { pop = Math.min(1, pop + dt * 2.2); const s = pop < 0.7 ? pop / 0.7 * 1.35 : 1.35 - (pop - 0.7) / 0.3 * 0.35; popKl.augen.scale.setScalar(Math.max(0.01, s)); }
    },
    aus() { ui.innerHTML = ""; }
  };
}
