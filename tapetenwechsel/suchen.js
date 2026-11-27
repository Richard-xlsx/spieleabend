// Tapetenwechsel: Suchen in Ich-Sicht. Joystick (laufen), Ziehen (umschauen), zwei Finger (Fernglas), Hocke,
// kurzes Tippen = „Da!“. Dazu Niesen-Wolken, Markierung gefundener Kleckse und Zuschauen (Sicht eines anderen Suchers).
import * as THREE from "three";
import { AUGE, HOCKE } from "./welt.js";

export function markieren(kl, farbe) {
  kl.augen.visible = true;
  if (kl.rahmen) kl.rahmen.material.color.set(farbe);
  else {
    const m = new THREE.MeshBasicMaterial({ color: farbe, side: THREE.BackSide });
    kl.rahmen = new THREE.Mesh(kl.geo, m); kl.rahmen.scale.setScalar(1.07);
    kl.rahmen.position.y = -kl.hoeheOben() * 0.035;
    kl.mesh.add(kl.rahmen);
  }
}

export function suchenStarten(W, ui, opt) {
  const K = opt.K || { spiel() {} }, kam = W.kamera, cv = W.renderer.domElement, Z = W.Z;
  const ac = new AbortController(), sig = { signal: ac.signal };
  const B = Z.blickpunkte[0];
  const pos = new THREE.Vector3(B.pos.x, AUGE, B.pos.z);
  const zu = new THREE.Vector3().subVectors(B.ziel, B.pos);
  let yaw = Math.atan2(zu.x, zu.z), pitch = Math.atan2(zu.y, Math.hypot(zu.x, zu.z)) * 0.5, fov = 64, hocke = false, sperreBis = 0, fremd = null;
  const stick = { x: 0, y: 0, id: null, cx: 0, cy: 0 }, tasten = new Set();
  let schrittZeit = 0;

  ui.innerHTML = `
    <div class="ss-kreuz"></div>
    <div class="ss-stick"><div class="ss-knopf"></div></div>
    <button class="ss-hocke" aria-label="in die Hocke">🧎<span>Hocke</span></button>
    <div class="ss-nebel"></div>`;
  const stEl = ui.querySelector(".ss-stick"), knEl = ui.querySelector(".ss-knopf"), hoEl = ui.querySelector(".ss-hocke"), neb = ui.querySelector(".ss-nebel");
  if (!opt.darf) ui.classList.add("zuschauer"); else ui.classList.remove("zuschauer");
  hoEl.addEventListener("click", () => { hocke = !hocke; hoEl.classList.toggle("an", hocke); }, sig);
  // Joystick
  stEl.addEventListener("pointerdown", e => {
    if (stick.id != null) return;
    stEl.setPointerCapture(e.pointerId); stick.id = e.pointerId;
    const b = stEl.getBoundingClientRect(); stick.cx = b.left + b.width / 2; stick.cy = b.top + b.height / 2; stickBew(e);
  }, sig);
  function stickBew(e) {
    const r = stEl.getBoundingClientRect().width / 2;
    let dx = (e.clientX - stick.cx) / r, dy = (e.clientY - stick.cy) / r; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    stick.x = dx; stick.y = -dy; knEl.style.transform = `translate(${dx * r * 0.6}px, ${dy * r * 0.6}px)`;
  }
  stEl.addEventListener("pointermove", e => { if (e.pointerId === stick.id) stickBew(e); }, sig);
  const stickAus = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knEl.style.transform = ""; };
  stEl.addEventListener("pointerup", stickAus, sig); stEl.addEventListener("pointercancel", stickAus, sig);
  // Umschauen, Fernglas, Tippen
  const zeiger = new Map(); let geste = null;
  cv.addEventListener("pointerdown", e => {
    cv.setPointerCapture(e.pointerId);
    zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), weit: 0 });
    if (zeiger.size === 2) { const [a, b] = [...zeiger.values()]; geste = { d: Math.hypot(a.x - b.x, a.y - b.y), fov }; }
  }, sig);
  cv.addEventListener("pointermove", e => {
    const z = zeiger.get(e.pointerId); if (!z) return;
    const dx = e.clientX - z.x, dy = e.clientY - z.y; z.x = e.clientX; z.y = e.clientY; z.weit = Math.max(z.weit, Math.hypot(z.x - z.x0, z.y - z.y0));
    if (fremd) return;
    if (zeiger.size === 2 && geste) { const [a, b] = [...zeiger.values()]; fov = Math.max(21, Math.min(64, geste.fov * geste.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)))); return; }
    const k = 0.0055 * fov / 64;
    yaw += dx * k; pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * k));
  }, sig);
  const los = e => {
    const z = zeiger.get(e.pointerId); if (!z) return; zeiger.delete(e.pointerId); if (zeiger.size < 2) geste = null;
    if (z.weit > 9 || performance.now() - z.t0 > 380 || zeiger.size || e.type === "pointercancel") return;
    tippen(e.clientX, e.clientY);
  };
  cv.addEventListener("pointerup", los, sig); cv.addEventListener("pointercancel", los, sig);
  cv.addEventListener("wheel", e => { fov = Math.max(21, Math.min(64, fov * (e.deltaY > 0 ? 1.08 : 0.92))); e.preventDefault(); }, { passive: false, signal: ac.signal });
  addEventListener("keydown", e => { tasten.add(e.key.toLowerCase()); if (e.key.toLowerCase() === "c") { hocke = !hocke; hoEl.classList.toggle("an", hocke); } }, sig);
  addEventListener("keyup", e => tasten.delete(e.key.toLowerCase()), sig);

  function tippen(x, y) {
    if (!opt.darf || fremd) return;
    if (Date.now() < sperreBis) { K.spiel("daneben", 0.3); return; }
    const kl = opt.kleckse().filter(k => !k.gefunden);
    const hits = W.strahl(x, y, Z.meshes.concat(kl.map(k => k.klecks.mesh)));
    const t = hits[0], k = t && kl.find(k => k.klecks.mesh === t.object);
    zeigeFinger(x, y, !!(k && k.pid !== opt.ich));
    if (k && k.pid === opt.ich) { if (opt.onTipp) opt.onTipp("selbst"); return; }
    if (k) { if (opt.onTipp) opt.onTipp(k.pid); return; }
    if (opt.onTipp) opt.onTipp(null);
  }
  function zeigeFinger(x, y, treffer) {
    const b = cv.getBoundingClientRect(), f = document.createElement("div");
    f.className = "ss-finger" + (treffer ? " treffer" : ""); f.textContent = treffer ? "!" : "☝";
    f.style.left = (x - b.left) + "px"; f.style.top = (y - b.top) + "px"; ui.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  // ---------- Niesen ----------
  const wolken = [];
  function niesen(kl) {
    const m = kl.mitteWelt(), d = kl.bild.data, farben = [];
    for (let i = 0; i < 8; i++) { const o = ((Math.random() * 256 * 256) | 0) * 4; farben.push(new THREE.Color(`rgb(${d[o]},${d[o + 1]},${d[o + 2]})`)); }
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: farben[i % 8], transparent: true }));
      s.position.copy(m).addScaledVector(kl.n, kl.hoeheOben() * 0.5);
      s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8).addScaledVector(kl.n, 0.5);
      s.userData.t = 0; W.szene.add(s); wolken.push(s);
    }
    const rechts = new THREE.Vector3(1, 0, 0).applyQuaternion(kam.quaternion), hin = new THREE.Vector3().subVectors(m, kam.position);
    const pan = Math.max(-1, Math.min(1, rechts.dot(hin.normalize()) * 1.2)), nah = Math.max(0.25, 1 - kam.position.distanceTo(m) / 9);
    K.spiel("hatschi", nah, pan);
  }

  function blick() { return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)); }
  return {
    schritt(dt) {
      for (let i = wolken.length - 1; i >= 0; i--) {
        const s = wolken[i]; s.userData.t += dt; s.position.addScaledVector(s.userData.v, dt); s.userData.v.multiplyScalar(0.94);
        s.scale.setScalar(1 + s.userData.t * 2); s.material.opacity = Math.max(0, 1 - s.userData.t / 1.3);
        if (s.userData.t > 1.3) { W.szene.remove(s); s.geometry.dispose(); s.material.dispose(); wolken.splice(i, 1); }
      }
      if (Date.now() < sperreBis) neb.classList.add("an"); else neb.classList.remove("an");
      if (fremd) {                         // Zuschauen: Sicht eines anderen Suchers, geglättet
        const z = fremd; pos.lerp(new THREE.Vector3(z[0], z[1], z[2]), Math.min(1, dt * 8));
        let dy = z[3] - yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
        yaw += dy * Math.min(1, dt * 8); pitch += (z[4] - pitch) * Math.min(1, dt * 8); fov += (z[5] - fov) * Math.min(1, dt * 6);
      } else if (opt.darf) {
        let mx = stick.x, my = stick.y;
        if (tasten.has("w") || tasten.has("arrowup")) my = 1; if (tasten.has("s") || tasten.has("arrowdown")) my = -1;
        if (tasten.has("a")) mx = -1; if (tasten.has("d")) mx = 1;
        if (tasten.has("arrowleft")) yaw += dt * 1.8; if (tasten.has("arrowright")) yaw -= dt * 1.8;
        const v = (hocke ? 0.9 : 1.7) * dt, fx = Math.sin(yaw), fz = Math.cos(yaw);
        const dx = (fx * my - fz * mx) * v, dz = (fz * my + fx * mx) * v;
        if (dx || dz) { W.gehen(pos, dx, dz); schrittZeit += dt * Math.hypot(mx, my); if (schrittZeit > 0.42) { schrittZeit = 0; K.spiel("schritt", 0.25); } }
        pos.y += ((hocke ? HOCKE : AUGE) - pos.y) * Math.min(1, dt * 8);
      }
      kam.fov = fov; kam.updateProjectionMatrix();
      kam.position.copy(pos); kam.lookAt(pos.clone().add(blick()));
    },
    pose: () => [r2(pos.x), r2(pos.y), r2(pos.z), r2(yaw), r2(pitch), Math.round(fov)],
    blick,
    sperre(bis) { sperreBis = bis; },
    zuschauen(p) { fremd = p; if (p && !opt.darf) ui.classList.add("zuschauer"); },
    niesen,
    aus() { ac.abort(); for (const s of wolken) W.szene.remove(s); ui.innerHTML = ""; ui.classList.remove("zuschauer"); }
  };
}
const r2 = x => Math.round(x * 100) / 100;
