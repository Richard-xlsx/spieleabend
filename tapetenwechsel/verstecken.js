// Tapetenwechsel: Verstecken. Kamera kreist um den eigenen Klecks; Platz (Fläche antippen → hinhüpfen, drehen),
// Kneten (Höhe, Ecken), Malen (Pinsel, Pipette, Eimer, Abpausen, Rückgängig), Farbleiste, Probeblick.
import * as THREE from "three";
import { Klecks, WEISS } from "./klecks.js";

const KASTEN = ["#FFFFFF", "#F3F0E8", "#BDBDBD", "#6E6E6E", "#2B2B2B", "#7A4A2A", "#C08A5A", "#E8C9A0",
  "#C62828", "#EF6C00", "#F9C80E", "#7CB342", "#2E7D32", "#1E88E5", "#283593", "#8E24AA"];
const PINSEL = [0.012, 0.03, 0.065];

export function versteckenStarten(W, ui, opt) {
  const K = opt.K || { spiel() {} };
  const ac = new AbortController(), sig = { signal: ac.signal };
  const kl = new Klecks();
  W.szene.add(kl.gruppe);
  const Z = W.Z, kam = W.kamera, cv = W.renderer.domElement;
  let modus = "platz", werkzeug = "pinsel", groesse = 1, farbe = "#C62828", zuletzt = [];
  let pausenUebrig = opt.abpausen === "frei" ? Infinity : opt.abpausen === "aus" ? 0 : 1;
  let yaw = 0.6, pitch = 0.45, dist = 1.5, ziel = new THREE.Vector3(), probe = -1, sprung = null, schmutzig = false, gesperrt = false;

  // ---------- Startplatz ----------
  function bodenPunkt(x, z) {
    const r = new THREE.Raycaster(new THREE.Vector3(x, Z.raum.h - 0.05, z), new THREE.Vector3(0, -1, 0));
    return r.intersectObjects(Z.meshes, false)[0];
  }
  if (opt.start && opt.start.d) { kl.anwenden(opt.start.d); if (opt.start.bild) kl.ladeBild(opt.start.bild); }
  else {
    const P = W.punkte.length ? W.punkte : [new THREE.Vector2((Z.raum.x0 + Z.raum.x1) / 2, (Z.raum.z0 + Z.raum.z1) / 2)];
    const m = new THREE.Vector2((Z.raum.x0 + Z.raum.x1) / 2, (Z.raum.z0 + Z.raum.z1) / 2);
    const q = P.slice().sort((a, b) => a.distanceTo(m) - b.distanceTo(m))[Math.floor(Math.random() * Math.min(6, P.length))];
    const t = bodenPunkt(q.x, q.y);
    kl.setzen(t ? t.point : new THREE.Vector3(q.x, 0, q.y), new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
  }
  ziel.copy(kl.mitteWelt());
  const rm = Z.raum; yaw = Math.atan2((rm.x0 + rm.x1) / 2 - ziel.x, (rm.z0 + rm.z1) / 2 - ziel.z) || 0.6;

  // ---------- Oberfläche ----------
  ui.innerHTML = `
    <div class="vs-links">
      <div class="vs-modi">
        <button data-m="platz"><b>⌖</b><span>Platz</span></button>
        <button data-m="kneten"><b>✋</b><span>Kneten</span></button>
        <button data-m="malen"><b>🖌</b><span>Malen</span></button>
      </div>
      <div class="vs-werk"></div>
    </div>
    <div class="vs-rechts">
      <div class="vs-jetzt" title="aktuelle Farbe"></div>
      <div class="vs-leiste"></div>
      <div class="vs-kasten">${KASTEN.map(f => `<button style="--c:${f}" data-f="${f}" aria-label="Farbe ${f}"></button>`).join("")}</div>
    </div>
    <div class="vs-unten">
      <button class="vs-probe">👁 Probeblick</button>
      <button class="vs-fertig">Fertig ✓</button>
    </div>
    <div class="vs-tipp"></div>`;
  const $ = s => ui.querySelector(s);
  const tipp = (t, lang) => { const e = $(".vs-tipp"); e.textContent = t; e.classList.add("an"); clearTimeout(tipp.h); tipp.h = setTimeout(() => e.classList.remove("an"), lang || 2200); };
  function werkzeugeZeigen() {
    ui.querySelectorAll(".vs-modi button").forEach(b => b.classList.toggle("an", b.dataset.m === modus));
    const w = $(".vs-werk");
    if (modus === "platz") w.innerHTML = `<p>Tippe auf eine Fläche: Der Klecks hüpft hin. Auch Wände und Decke gehen.</p>
      <div class="reihe"><button data-a="links" aria-label="links drehen">⟲</button><button data-a="rechts" aria-label="rechts drehen">⟳</button></div>
      <button data-a="hin">◎ Zum Klecks</button>`;
    else if (modus === "kneten") w.innerHTML = `<label>Höhe<input type="range" min="0" max="100" value="${Math.round(kl.h * 100)}" data-s="h"><small><span>flach</span><span>hoch</span></small></label>
      <label>Ecken<input type="range" min="0" max="100" value="${Math.round(kl.k * 100)}" data-s="k"><small><span>rund</span><span>kantig</span></small></label>`;
    else w.innerHTML = `<div class="reihe pinsel">${PINSEL.map((_, i) => `<button data-g="${i}" class="${werkzeug === "pinsel" && groesse === i ? "an" : ""}" aria-label="Pinsel ${i + 1}"><i style="--d:${6 + i * 7}px"></i></button>`).join("")}</div>
      <div class="reihe"><button data-a="pipette" class="${werkzeug === "pipette" ? "an" : ""}">💧 Pipette</button></div>
      <div class="reihe"><button data-a="eimer">🪣 Eimer</button><button data-a="rueck" aria-label="rückgängig">↶</button></div>
      ${pausenUebrig > 0 ? `<button data-a="pausen">✨ Abpausen${pausenUebrig !== Infinity ? " (1×)" : ""}</button>` : ""}`;
    farbenZeigen();
  }
  function farbenZeigen() {
    $(".vs-jetzt").style.background = farbe;
    $(".vs-leiste").innerHTML = zuletzt.map(f => `<button style="--c:${f}" data-f="${f}" aria-label="Farbe ${f}"></button>`).join("");
  }
  function farbeNehmen(f, ausZimmer) {
    farbe = f;
    if (ausZimmer) { zuletzt = [f].concat(zuletzt.filter(x => x !== f)).slice(0, 8); }
    farbenZeigen();
  }
  ui.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || gesperrt) return;
    if (b.dataset.m) { modus = b.dataset.m; if (modus === "malen") werkzeug = "pinsel"; probe = -1; werkzeugeZeigen(); return; }
    if (b.dataset.f) { farbeNehmen(b.dataset.f, false); if (werkzeug === "pipette") { werkzeug = "pinsel"; werkzeugeZeigen(); } return; }
    if (b.dataset.g) { groesse = +b.dataset.g; werkzeug = "pinsel"; werkzeugeZeigen(); return; }
    const a = b.dataset.a;
    if (a === "links" || a === "rechts") { kl.drehen((a === "links" ? 1 : -1) * Math.PI / 12); K.spiel("quietsch", 0.4); }
    else if (a === "hin") { probe = -1; dist = 1.5; }
    else if (a === "pipette") { werkzeug = werkzeug === "pipette" ? "pinsel" : "pipette"; werkzeugeZeigen(); if (werkzeug === "pipette") tipp("Tippe ins Zimmer, um eine Farbe zu nehmen."); }
    else if (a === "eimer") { kl.merken(); kl.eimer(farbe); K.spiel("eimer"); }
    else if (a === "rueck") { if (kl.rueck()) K.spiel("rueck"); }
    else if (a === "pausen") {
      if (pausenUebrig <= 0) return;
      kl.merken(); kl.abpausen(kam.position.clone(), Z.meshes, Z.farbeAn, 8); pausenUebrig--; K.spiel("eimer", 0.6);
      tipp("Grob abgepaust. Jetzt mit Pinsel und Pipette nacharbeiten!", 3000); werkzeugeZeigen();
    }
    if (b.classList.contains("vs-probe")) {
      const B = Z.blickpunkte; probe = (probe + 1) % B.length;
      tipp("Probeblick von: " + B[probe].name + " (nochmal tippen = nächster, ziehen = zurück)", 2600);
    }
    if (b.classList.contains("vs-fertig")) { if (opt.onFertig) opt.onFertig(); }
  }, sig);
  ui.addEventListener("input", e => {
    const s = e.target.dataset.s; if (!s || gesperrt) return;
    const v = e.target.value / 100;
    kl.form(s === "h" ? v : kl.h, s === "k" ? v : kl.k); kl.setzen(kl.p, kl.n);
    K.spiel("quietsch", 0.25);
  }, sig);
  werkzeugeZeigen();

  // ---------- Hinsetzen ----------
  function hinsetzen(t) {
    const n = W.normaleVon(t), alt = kl.gruppe.position.clone(), altP = kl.p.clone(), altN = kl.n.clone();
    let d = kl.drehung;
    kl.setzen(t.point, n, d);
    const m = kl.mitteWelt(), oben = m.clone().addScaledVector(n, kl.hoeheOben() * 0.45), r = Z.raum;
    let fehler = null;
    if (m.x < r.x0 || m.x > r.x1 || m.z < r.z0 || m.z > r.z1 || m.y < 0 || m.y > r.h) fehler = "Da passt du nicht hin.";
    else if (Z.kaesten.some(k => m.x > k.min.x + 0.03 && m.x < k.max.x - 0.03 && m.y > k.min.y + 0.03 && m.y < k.max.y - 0.03 && m.z > k.min.z + 0.03 && m.z < k.max.z - 0.03)) fehler = "Da passt du nicht hinein.";
    else if (!W.sichtbar([m, oben])) fehler = "Da sieht dich keiner – such dir einen fairen Platz.";
    if (fehler) { kl.setzen(altP, altN, d); tipp(fehler); K.spiel("daneben", 0.5); return; }
    sprung = { von: alt, nach: kl.gruppe.position.clone(), t: 0, n };
    probe = -1; K.spiel("hupf");
  }

  // ---------- Zeiger ----------
  const zeiger = new Map(); let malt = null, geste = null;
  const lok = t => kl.weltZuLokal(t.point);
  function aufKlecks(x, y) { return W.strahl(x, y, [kl.mesh])[0]; }
  cv.addEventListener("pointerdown", e => {
    if (gesperrt) return;
    cv.setPointerCapture(e.pointerId);
    zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), weit: 0 });
    if (zeiger.size === 1 && modus === "malen" && werkzeug === "pinsel" && probe < 0) {
      const t = aufKlecks(e.clientX, e.clientY);
      if (t) { kl.merken(); malt = lok(t); kl.tupfen(malt, PINSEL[groesse], farbe); schmutzig = true; K.spiel("pinsel", 0.4); }
    }
    if (zeiger.size === 2) { malt = null; const [a, b] = [...zeiger.values()]; geste = { d: Math.hypot(a.x - b.x, a.y - b.y), w: Math.atan2(b.y - a.y, b.x - a.x), dist }; }
  }, sig);
  cv.addEventListener("pointermove", e => {
    const z = zeiger.get(e.pointerId); if (!z || gesperrt) return;
    const dx = e.clientX - z.x, dy = e.clientY - z.y; z.x = e.clientX; z.y = e.clientY; z.weit = Math.max(z.weit, Math.hypot(z.x - z.x0, z.y - z.y0));
    if (zeiger.size === 2 && geste) {
      const [a, b] = [...zeiger.values()], d = Math.hypot(a.x - b.x, a.y - b.y), w = Math.atan2(b.y - a.y, b.x - a.x);
      dist = Math.max(0.45, Math.min(4.5, geste.dist * geste.d / Math.max(20, d)));
      let dw = w - geste.w; if (dw > Math.PI) dw -= 2 * Math.PI; if (dw < -Math.PI) dw += 2 * Math.PI;
      if (modus === "platz" && Math.abs(dw) > 0.02) { kl.drehen(-dw); geste.w = w; }
      return;
    }
    if (malt) {
      const t = aufKlecks(e.clientX, e.clientY);
      if (t) { const p = lok(t); kl.strich(malt, p, PINSEL[groesse], farbe); malt = p; schmutzig = true; K.spiel("pinsel", 0.3); }
      return;
    }
    if (z.weit > 6) { if (probe >= 0) probe = -1; yaw -= dx * 0.009; pitch = Math.max(-0.35, Math.min(1.45, pitch + dy * 0.007)); }
  }, sig);
  const loslassen = e => {
    const z = zeiger.get(e.pointerId); if (!z) return;
    zeiger.delete(e.pointerId);
    if (zeiger.size < 2) geste = null;
    const warMalen = !!malt; malt = null;
    if (gesperrt || warMalen || z.weit > 10 || performance.now() - z.t0 > 450 || zeiger.size) return;
    tippen(e.clientX, e.clientY);
  };
  cv.addEventListener("pointerup", loslassen, sig);
  cv.addEventListener("pointercancel", e => { zeiger.delete(e.pointerId); malt = null; geste = null; }, sig);
  cv.addEventListener("wheel", e => { dist = Math.max(0.45, Math.min(4.5, dist * (e.deltaY > 0 ? 1.1 : 0.9))); e.preventDefault(); }, { passive: false, signal: ac.signal });
  function tippen(x, y) {
    if (modus === "malen" && werkzeug === "pipette") {
      const t = W.strahl(x, y, Z.meshes)[0];
      if (t) { farbeNehmen(Z.farbeAn(t), true); K.spiel("plopp"); werkzeug = "pinsel"; werkzeugeZeigen(); }
      return;
    }
    if (modus === "platz") {
      const t = W.strahl(x, y, Z.meshes)[0];
      if (t) hinsetzen(t);
    }
  }

  // ---------- Kamera ----------
  const tmp = new THREE.Vector3(), r0 = new THREE.Raycaster();
  function kamera(dt) {
    if (probe >= 0) {
      const B = Z.blickpunkte[probe];
      kam.position.lerp(B.pos, Math.min(1, dt * 6)); kam.lookAt(kl.mitteWelt()); return;
    }
    ziel.lerp(kl.mitteWelt(), Math.min(1, dt * 8));
    const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    let d = dist;
    r0.set(ziel, off); r0.far = dist + 0.1;
    const t = r0.intersectObjects(Z.meshes, false)[0];
    if (t) d = Math.max(0.3, t.distance - 0.08);
    tmp.copy(ziel).addScaledVector(off, d);
    const r = Z.raum;
    tmp.x = Math.max(r.x0 + 0.06, Math.min(r.x1 - 0.06, tmp.x)); tmp.z = Math.max(r.z0 + 0.06, Math.min(r.z1 - 0.06, tmp.z)); tmp.y = Math.max(0.06, Math.min(r.h - 0.06, tmp.y));
    kam.position.lerp(tmp, Math.min(1, dt * 10));
    kam.lookAt(ziel);
  }
  kam.fov = 62; kam.updateProjectionMatrix();
  kam.position.copy(ziel).add(new THREE.Vector3(Math.sin(yaw) * 1.2, 0.7, Math.cos(yaw) * 1.2));

  return {
    klecks: kl,
    schritt(dt) {
      if (sprung) {
        sprung.t = Math.min(1, sprung.t + dt / 0.35);
        kl.gruppe.position.lerpVectors(sprung.von, sprung.nach, sprung.t).addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(Math.PI * sprung.t) * 0.35);
        if (sprung.t >= 1) { kl.gruppe.position.copy(sprung.nach); sprung = null; K.spiel("hupf", 0.3); }
      }
      if (schmutzig) { kl.zeigen(); schmutzig = false; }
      kamera(dt);
    },
    sperren() { gesperrt = true; malt = null; ui.classList.add("gesperrt"); if (sprung) { kl.gruppe.position.copy(sprung.nach); sprung = null; } },
    daten: () => kl.daten(),
    bild: () => kl.bildUrl(),
    farben: () => kl.farben(),
    tipp,
    aus() { ac.abort(); ui.innerHTML = ""; ui.classList.remove("gesperrt"); }
  };
}
export { WEISS };
