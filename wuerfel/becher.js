// Würfelpoker: 3D-Tisch mit Würfelbecher. Mit dem Finger auf dem Becher reiben schüttelt ihn, ein Wisch nach oben
// kippt ihn aus. Die anderen Handys sehen das Schütteln live und denselben Wurf (die Bahn wird mitgeschickt).
// Die Augenzahl bestimmt weiter der Spielleiter: Wir drehen die Augen auf dem Würfel so, dass sie zur Endlage passen.
// Schnittstelle für wuerfel.js: window.BECHER (siehe ganz unten).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as P from "./physik.js?v=2026-11-20c";

const klemmen = (x, a, b) => Math.max(a, Math.min(b, x));
const glatt = x => x * x * (3 - 2 * x);
const OBEN = new THREE.Vector3(0, 1, 0);

// ---------- Grafik ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
} catch (e) { renderer = null; }

if (renderer) {
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x2A0F18);

  // Der Tisch hängt fest im body und wird nur über den Platzhalter gelegt. So bleibt das Canvas beim Neuzeichnen
  // der Oberfläche im Dokument, und ein Finger, der gerade schüttelt, wird nicht unterbrochen.
  const wrap = document.createElement("div");
  wrap.className = "tisch3d";
  wrap.style.display = "none";
  document.body.appendChild(wrap);
  let platz = null;
  wrap.appendChild(renderer.domElement);
  const tipp = document.createElement("div");
  tipp.className = "tisch-tipp";
  wrap.appendChild(tipp);

  const szene = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(36, 1, .5, 80);
  szene.add(new THREE.HemisphereLight(0xFFF1DE, 0x3A1420, 1.25));
  const sonne = new THREE.DirectionalLight(0xFFF4E2, 2.1);
  sonne.position.set(-4, 16, 7);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(1024, 1024);
  Object.assign(sonne.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 2, far: 40 });
  sonne.shadow.bias = -.0008;
  sonne.shadow.radius = 4;
  szene.add(sonne);

  // Tisch: Filz in der Mitte, Holzrand außen, hinten eine Ablage für festgehaltene Würfel
  const F = P.FELD;
  const filzTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
    const v = g.createRadialGradient(128, 110, 20, 128, 128, 190); v.addColorStop(0, "#7A2A40"); v.addColorStop(1, "#4A1828");
    g.fillStyle = v; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? "255,220,230" : "20,0,8"},${Math.random() * .05})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const filz = new THREE.Mesh(new THREE.PlaneGeometry(F.x1 - F.x0, F.z1 - F.z0), new THREE.MeshStandardMaterial({ map: filzTex, roughness: .95 }));
  filz.rotation.x = -Math.PI / 2; filz.position.set((F.x0 + F.x1) / 2, 0, (F.z0 + F.z1) / 2); filz.receiveShadow = true;
  szene.add(filz);
  const holz = new THREE.MeshStandardMaterial({ color: 0x6B3A22, roughness: .55, metalness: .05 });
  const holzDunkel = new THREE.MeshStandardMaterial({ color: 0x4A2615, roughness: .7 });
  const leiste = (w, h, d, x, y, z, m = holz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; szene.add(b); return b; };
  const RH = .85, RB = .45;
  leiste(F.x1 - F.x0 + 2 * RB, RH, RB, 0, RH / 2, F.z1 + RB / 2);                // vorn
  leiste(RB, RH, F.z1 - F.z0 + 2 * RB + 1.5, F.x0 - RB / 2, RH / 2, (F.z0 + F.z1) / 2 - .75);  // links
  leiste(RB, RH, F.z1 - F.z0 + 2 * RB + 1.5, F.x1 + RB / 2, RH / 2, (F.z0 + F.z1) / 2 - .75);  // rechts
  leiste(F.x1 - F.x0, RH, RB, 0, RH / 2, F.z0 - RB / 2);                          // Trennleiste zur Ablage
  const ABL_Z = F.z0 - RB - .75;
  leiste(F.x1 - F.x0, .3, 1.5, 0, .15, ABL_Z, holzDunkel);                        // Ablagefach
  leiste(F.x1 - F.x0 + 2 * RB, RH, RB, 0, RH / 2, ABL_Z - .75 - RB / 2);        // hinten
  const ablage = i => new THREE.Vector3((i - 2) * 1.55, .3 + .5, ABL_Z);
  // Untergrund unter allem, damit der Rand nicht im Nichts schwebt
  const grund = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x2A0F18, roughness: 1 }));
  grund.rotation.x = -Math.PI / 2; grund.position.y = -.02; grund.receiveShadow = true; szene.add(grund);

  // Würfel: abgerundet, elfenbeinfarben, Augen per Canvas. Gegenüberliegende Seiten ergeben 7.
  // Seitenreihenfolge der Box: +x, -x, +y, -y, +z, -z
  const SEITE = [2, 5, 1, 6, 3, 4];
  const NORMALE = { 1: [0, 1, 0], 6: [0, -1, 0], 2: [1, 0, 0], 5: [-1, 0, 0], 3: [0, 0, 1], 4: [0, 0, -1] };
  const AUGEN = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
  const seitenMat = SEITE.map(n => {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    g.fillStyle = "#FFF8EC"; g.fillRect(0, 0, 128, 128);
    const v = g.createRadialGradient(64, 64, 30, 64, 64, 92); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(120,80,60,.16)");
    g.fillStyle = v; g.fillRect(0, 0, 128, 128);
    for (const [x, y] of AUGEN[n]) {
      g.fillStyle = n === 1 ? "#B0263A" : "#2A0F18";
      g.beginPath(); g.arc(x * 1.28, y * 1.28, n === 1 ? 15 : 11.5, 0, 7); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map: t, roughness: .38, metalness: 0 });
  });
  const wGeo = new RoundedBoxGeometry(1, 1, 1, 3, .13);
  const W = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(wGeo, seitenMat); m.castShadow = true; m.receiveShadow = true; m.userData.i = i;
    szene.add(m);
    W.push({ m, modus: "becher", R: new THREE.Quaternion(), wert: 0, tw: null, spot: i });
  }

  // Becher: Leder mit goldenem Rand
  const B = P.BECHER;
  const profil = [];
  profil.push(new THREE.Vector2(0, 0));
  profil.push(new THREE.Vector2(B.r + B.wand * .9, 0));
  profil.push(new THREE.Vector2(B.r + B.wand, .15));
  profil.push(new THREE.Vector2(B.r + B.wand + .12, B.h));
  profil.push(new THREE.Vector2(B.r + .1, B.h));
  profil.push(new THREE.Vector2(B.r - .02, .2));
  profil.push(new THREE.Vector2(0, .2));
  const becherG = new THREE.Group();
  const leder = new THREE.Mesh(new THREE.LatheGeometry(profil, 40), new THREE.MeshStandardMaterial({ color: 0x8B2E3F, roughness: .7, side: THREE.DoubleSide }));
  leder.castShadow = true; leder.receiveShadow = true; becherG.add(leder);
  const randGold = new THREE.Mesh(new THREE.TorusGeometry(B.r + B.wand / 2 + .07, .1, 8, 40), new THREE.MeshStandardMaterial({ color: 0xF2C14E, roughness: .35, metalness: .6 }));
  randGold.rotation.x = Math.PI / 2; randGold.position.y = B.h; becherG.add(randGold);
  const bandGold = new THREE.Mesh(new THREE.CylinderGeometry(B.r + B.wand + .03, B.r + B.wand + .015, .18, 40, 1, true), randGold.material);
  bandGold.position.y = .5; becherG.add(bandGold);
  szene.add(becherG);

  // ---------- Zustand ----------
  const sim = P.erstelle();
  let cb = {}, info = { meinZug: false, kannWerfen: false, kannHalten: false };
  let S = null, bekannt = -1, zug = null;          // bekannt: welche wurfNr schon dargestellt ist
  const becher = { x: P.HEIM.x, y: P.HEIM.y, z: P.HEIM.z, q: new THREE.Quaternion() };
  let modus = "heim";                               // heim | anheben | hand | kippen
  let anheben = null, hand = null, wg = null, auto = null, fremd = null, warteBahn = null;
  let geschuettelt = 0, letzteLive = 0, schmutzig = true;
  const bahnen = new Map();

  function becherZeigen() {
    becherG.position.set(becher.x, becher.y, becher.z); becherG.quaternion.copy(becher.q);
  }
  // Platz eines Würfels im Becher (für Ruhezustand und Einsammeln)
  const PLAETZE = [[-.62, .62, -.45], [.62, .62, -.45], [0, .62, .7], [-.4, 1.65, .2], [.45, 1.65, .1]];
  const ROH = [new THREE.Euler(.3, .8, 0), new THREE.Euler(1.2, .1, .4), new THREE.Euler(0, 2, 1.1), new THREE.Euler(.7, 0, 2.2), new THREE.Euler(2.4, 1, .2)].map(e => new THREE.Quaternion().setFromEuler(e));
  function imBecher(k) {
    const p = new THREE.Vector3(...PLAETZE[k % 5]).applyQuaternion(becher.q).add(new THREE.Vector3(becher.x, becher.y, becher.z));
    return { p, q: becher.q.clone().multiply(ROH[k % 5]) };
  }
  const wertQ = (n, dreh = 0) => new THREE.Quaternion().setFromAxisAngle(OBEN, dreh).multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...NORMALE[n]), OBEN));
  // Augen so drehen, dass bei dieser Endlage (Körper-Quaternion) die Zahl n oben liegt
  function korrektur(q, n) {
    if (!n) return new THREE.Quaternion();
    const a = P.obenAchse(q).achse;
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...NORMALE[n]), new THREE.Vector3(...a));
  }
  const lageQ = l => new THREE.Quaternion(l[3] / 1000, l[4] / 1000, l[5] / 1000, l[6] / 1000).normalize();
  const lageP = l => new THREE.Vector3(l[0] / 100, l[1] / 100, l[2] / 100);

  function flug(w, nach, dauer = .32, bogen = 1.2) {
    w.tw = { vonP: w.m.position.clone(), vonQ: w.m.quaternion.clone(), nach, t: 0, dauer, bogen };
  }
  // Wo ein Würfel laut Spielstand liegen soll (ohne laufende Animation)
  function sollOrt(i) {
    const w = W[i];
    if (!S || !S.wurf) return { art: "becher" };
    if (S.halten[i]) return { art: "ablage", p: ablage(i), q: wertQ(S.wuerfel[i], (i - 2) * .06) };
    const l = S.lage && S.lage[i];
    if (l) return { art: "liegt", p: lageP(l), q: lageQ(l).multiply(korrektur(lageQ(l), S.wuerfel[i])) };
    return { art: "liegt", p: new THREE.Vector3((i - 2) * 1.6, .5, -1), q: wertQ(S.wuerfel[i]) };
  }

  // ---------- Klang ----------
  let ton = null, rausch = null, tonZuletzt = 0;
  function tonAn() {
    if (ton) { if (ton.state === "suspended") ton.resume(); return; }
    try {
      ton = new (window.AudioContext || window.webkitAudioContext)();
      rausch = ton.createBuffer(1, ton.sampleRate * .08, ton.sampleRate);
      const d = rausch.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    } catch (e) { ton = null; }
  }
  document.addEventListener("pointerdown", tonAn, { capture: true, passive: true });
  const KLANG = { wuerfel: [3200, 14, .022], becher: [900, 4, .045], holz: [1700, 6, .03], filz: [380, 2, .03] };
  function klack(art, st) {
    if (!ton || ton.state !== "running") return;
    const jetzt = ton.currentTime; if (jetzt - tonZuletzt < .018) return; tonZuletzt = jetzt;
    const [f, qf, len] = KLANG[art] || KLANG.filz;
    const s = ton.createBufferSource(); s.buffer = rausch; s.playbackRate.value = .8 + Math.random() * .4;
    const bp = ton.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f * (.85 + Math.random() * .3); bp.Q.value = qf;
    const g = ton.createGain(); g.gain.setValueAtTime(Math.min(.9, st * st * 1.4 + .04) * (art === "filz" ? .5 : 1), jetzt); g.gain.exponentialRampToValueAtTime(.0005, jetzt + len * 2);
    s.connect(bp).connect(g).connect(ton.destination); s.start(jetzt); s.stop(jetzt + len * 2 + .02);
    if (hand && art === "becher" && navigator.vibrate && st > .25) { try { navigator.vibrate(7); } catch (e) {} }
  }
  sim.klang = klack;

  // ---------- Ablauf: Schütteln ----------
  const nichtGehalten = () => [0, 1, 2, 3, 4].filter(i => !(S && S.wurf && S.halten[i]));
  function schuettelnBeginnen(ziel, eigen) {
    if (modus !== "heim" && modus !== "hand" && modus !== "warten") return;
    const liste = nichtGehalten();
    if (modus === "heim") {
      anheben = { t: 0, von: { x: becher.x, y: becher.y, z: becher.z, q: becher.q.clone() }, ziel, liste, eigen };
      modus = "anheben";
      liste.forEach((i, k) => { W[i].spot = k; if (W[i].modus !== "becher") { W[i].modus = "rein"; } });
    } else modus = "hand";
    hand = { ziel, eigen };
    for (let i = 0; i < 5; i++) if (!liste.includes(i)) sim.mitmachen(i, false);
    schmutzig = true;
  }
  function physikAnheben(dt) {
    const a = anheben; a.t += dt;
    const e = glatt(Math.min(1, a.t / .3)), z = hand.ziel;
    becher.x = a.von.x + (z.x - a.von.x) * e; becher.y = a.von.y + (P.BECHER_Y - a.von.y) * e; becher.z = a.von.z + (z.z - a.von.z) * e;
    becher.q.copy(a.von.q).slerp(new THREE.Quaternion(), e);
    a.liste.forEach((i, k) => {
      const w = W[i], s = imBecher(k);
      if (w.modus === "rein") {                      // vom Tisch in den Becher fliegen
        if (!w.tw) flug(w, null, .3, 2.2);
        w.tw.nachP = s.p; w.tw.nachQ = s.q;
      } else { w.m.position.copy(s.p); w.m.quaternion.copy(s.q); }
    });
    if (a.t >= .32 && a.liste.every(i => !W[i].tw)) {
      sim.becherSetzen(becher.x, becher.y, becher.z, [0, 0, 0, 1]);
      sim.inDenBecher(a.liste);
      a.liste.forEach(i => { const b = sim.wuerfel[i]; b.position.copy(W[i].m.position); b.quaternion.copy(W[i].m.quaternion); });
      sim.deckelZu(true);
      a.liste.forEach(i => { W[i].modus = "frei"; W[i].R.identity(); });
      modus = "hand"; anheben = null;
    }
  }
  let rest = 0;
  function physikHand(dt) {
    const z = hand.ziel, r = P.RAUM;
    const zx = klemmen(z.x, r.x0, r.x1), zz = klemmen(z.z, r.z0, r.z1);
    rest += Math.min(dt, .05);
    let n = 0;
    while (rest >= P.DT && n < 6) {
      rest -= P.DT; n++;
      const dx = zx - becher.x, dz = zz - becher.z, d = Math.hypot(dx, dz), max = 15 * P.DT;
      const f = d > max ? max / d : 1;
      const nx = becher.x + dx * f, nz = becher.z + dz * f;
      geschuettelt += Math.hypot(nx - becher.x, nz - becher.z);
      becher.x = nx; becher.z = nz; becher.y = P.BECHER_Y;
      sim.becherSetzen(nx, P.BECHER_Y, nz, [0, 0, 0, 1], P.DT);
      sim.schritt();
    }
    if (n === 6) rest = 0;
    becher.q.identity();
    for (const i of nichtGehalten()) { const b = sim.wuerfel[i]; W[i].m.position.copy(b.position); W[i].m.quaternion.copy(b.quaternion); }
  }

  // ---------- Ablauf: Werfen ----------
  function werfen(dx, dz, staerke) {
    if (modus !== "hand" || !info.kannWerfen) return;
    if (dz > -.25) dz = -.25;
    const l = Math.hypot(dx, dz); dx /= l; dz /= l;
    const p = { x: becher.x, z: becher.z, dx, dz, s: klemmen(staerke, 3.5, 11) };
    let r;
    try { r = sim.werfen(p); } catch (e) { r = null; }
    hand = null; auto = null;
    const nr = S.wurfNr;
    if (r) { wiedergabe(nr + 1, r.bahn, true); cb.werfen && cb.werfen({ lage: r.lage, bahn: r.bahn }); }
    else { modus = "heim"; cb.werfen && cb.werfen({}); }
    geschuettelt = 0;
  }
  function wiedergabe(nr, bahn, eigen) {
    const p = bahn.p.map(x => x / 1000);
    wg = { nr, bahn, t: 0, p: { x: p[0], z: p[1], dx: p[2], dz: p[3], s: p[4] }, k: 0, eigen,
      start: bahn.w.map(i => ({ p: W[i].m.position.clone(), q: W[i].m.quaternion.clone() })) };
    const letzt = bahn.b[bahn.b.length - 1];
    bahn.w.forEach((i, j) => {
      const w = W[i]; w.modus = "bahn"; w.tw = null;
      w.endQ = new THREE.Quaternion(letzt[j * 7 + 3] / 1000, letzt[j * 7 + 4] / 1000, letzt[j * 7 + 5] / 1000, letzt[j * 7 + 6] / 1000).normalize();
      w.R.identity();
    });
    modus = "kippen"; hand = null; anheben = null; fremd = null;
    werteSetzen();
    schmutzig = true;
  }
  // Sobald der Spielleiter die Zahlen geschickt hat, die Augen passend drehen
  function werteSetzen() {
    if (!wg || !S || S.wurfNr !== wg.nr) return;
    wg.bahn.w.forEach(i => { const w = W[i]; w.R.copy(korrektur(w.endQ, S.wuerfel[i])); w.wert = S.wuerfel[i]; });
    wg.bekannt = true;
  }
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  function physikKippen(dt) {
    wg.t += Math.min(dt, .05);
    const bp = P.becherPose(wg.p, wg.t);
    becher.x = bp.x; becher.y = bp.y; becher.z = bp.z; becher.q.set(...bp.q);
    const B_ = wg.bahn.b, f = wg.t / (P.DT * P.BILD), i0 = Math.min(B_.length - 1, Math.floor(f)), i1 = Math.min(B_.length - 1, i0 + 1), a = f - Math.floor(f);
    const misch = Math.min(1, wg.t / .15);
    wg.bahn.w.forEach((i, j) => {
      const A = B_[i0], C = B_[i1], o = j * 7, w = W[i];
      w.m.position.set((A[o] + (C[o] - A[o]) * a) / 100, (A[o + 1] + (C[o + 1] - A[o + 1]) * a) / 100, (A[o + 2] + (C[o + 2] - A[o + 2]) * a) / 100);
      qa.set(A[o + 3], A[o + 4], A[o + 5], A[o + 6]).normalize(); qb.set(C[o + 3], C[o + 4], C[o + 5], C[o + 6]).normalize();
      qa.slerp(qb, a);
      w.m.quaternion.copy(qa).multiply(w.R);
      if (misch < 1 && !wg.eigen) {
        w.m.position.lerpVectors(wg.start[j].p, w.m.position, misch);
        w.m.quaternion.slerpQuaternions(wg.start[j].q, w.m.quaternion, misch);
      }
    });
    const K = wg.bahn.k, jetzt = wg.t / P.DT;
    while (wg.k < K.length && K[wg.k][0] <= jetzt) { const k = K[wg.k++]; klack(["wuerfel", "becher", "holz", "filz"][k[1]], k[2] / 100); }
    if (bp.fertig && i0 >= B_.length - 1) {
      // fertig: Becher steht wieder am Ruheplatz, Würfel liegen. Ohne Zahlen vom Spielleiter warten wir noch.
      if (!wg.bekannt) { warteBahn = warteBahn || performance.now(); if (performance.now() - warteBahn < 5000) return; }
      warteBahn = null;
      wg.bahn.w.forEach(i => { W[i].modus = "liegt"; });
      wg = null; modus = "heim";
      abgleichen(true);
    }
  }

  // ---------- Stand übernehmen ----------
  function abgleichen(sofort) {
    if (!S) return;
    if (modus === "kippen" || modus === "anheben" || modus === "hand") {
      // nur gehaltene Würfel nachziehen
      for (let i = 0; i < 5; i++) if (S.wurf && S.halten[i] && W[i].modus !== "ablage") { const s = sollOrt(i); W[i].modus = "ablage"; flug(W[i], s, .3, 1.4); }
      return;
    }
    for (let i = 0; i < 5; i++) {
      const w = W[i], s = sollOrt(i);
      if (s.art === "becher") {
        if (w.modus !== "becher") { w.modus = "becher"; flug(w, { becher: i }, sofort ? .01 : .4, 2.5); }
        w.spot = i;
        continue;
      }
      if (w.modus !== s.art || (s.art === "liegt" && w.m.position.distanceTo(s.p) > .05 && !w.tw)) {
        w.modus = s.art;
        flug(w, s, sofort ? .01 : s.art === "ablage" ? .3 : .35, s.art === "ablage" ? 1.4 : 1.1);
      } else if (s.art === "ablage" && !w.tw) { w.m.position.copy(s.p); w.m.quaternion.copy(s.q); }
      if (s.art === "liegt") { w.R.copy(korrektur(lageQ(S.lage && S.lage[i] || [0, 0, 0, 0, 0, 0, 1000]), S.wuerfel[i])); }
    }
    schmutzig = true;
  }
  function zustand(s, inf) {
    const neuerZug = !S || !s || s.phase !== S.phase || s.dran !== S.dran || s.spielNr !== S.spielNr || (s.wurf === 0 && S.wurf > 0);
    S = s; info = inf || info;
    if (!S) return;
    if (neuerZug && modus !== "kippen") { hand = null; anheben = null; fremd = null; auto = null; modus = "heim"; }
    if (S.wurfNr !== bekannt) {
      const b = bahnen.get(S.wurfNr);
      if (wg && wg.nr === S.wurfNr) werteSetzen();
      else if (b && S.wurf > 0) { bahnen.clear(); wiedergabe(S.wurfNr, b, false); }
      else if (bekannt !== -1 && S.wurf > 0 && modus !== "kippen") { modus = "heim"; hand = null; anheben = null; }
      bekannt = S.wurfNr;
    }
    abgleichen(bekannt === -1);
    tippZeigen();
    renderer.domElement.style.touchAction = info.kannWerfen || info.kannHalten ? "none" : "pan-y";
    schmutzig = true;
  }
  function tippZeigen() {
    let t = "";
    if (info.kannWerfen && modus === "heim" && S.wurf === 0) t = "Auf dem Becher reiben, dann nach oben wischen";
    else if (info.kannWerfen && modus === "hand" && hand && hand.eigen) t = geschuettelt < 5 ? "Weiter reiben …" : "Jetzt nach oben wischen!";
    tipp.textContent = t; tipp.hidden = !t;
  }

  // ---------- Finger ----------
  const ray = new THREE.Raycaster(), ebene = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(P.BECHER_Y + 1.4)), pt = new THREE.Vector3(), ndc = new THREE.Vector2();
  function tischPunkt(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, kamera);
    return ray.ray.intersectPlane(ebene, pt) ? { x: pt.x, z: pt.z } : null;
  }
  let finger = null;
  renderer.domElement.addEventListener("pointerdown", e => {
    if (finger) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, kamera);
    const treffer = ray.intersectObjects(W.filter(w => w.modus === "liegt" || w.modus === "ablage").map(w => w.m))[0];
    const p = tischPunkt(e); if (!p) return;
    finger = { id: e.pointerId, x0: e.clientX, y0: e.clientY, wuerfel: treffer ? treffer.object.userData.i : null, verlauf: [{ t: e.timeStamp, ...p }], schuettelt: false };
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch (er) {}
    if (finger.wuerfel === null && info.kannWerfen && !wg && !auto) { finger.schuettelt = true; schuettelnBeginnen(p, true); }
    e.preventDefault();
  });
  renderer.domElement.addEventListener("pointermove", e => {
    if (!finger || e.pointerId !== finger.id) return;
    const p = tischPunkt(e); if (!p) return;
    finger.verlauf.push({ t: e.timeStamp, ...p }); if (finger.verlauf.length > 30) finger.verlauf.shift();
    if (!finger.schuettelt && Math.hypot(e.clientX - finger.x0, e.clientY - finger.y0) > 14 && info.kannWerfen && !wg && !auto) { finger.schuettelt = true; finger.wuerfel = null; schuettelnBeginnen(p, true); }
    if (finger.schuettelt && hand) hand.ziel = p;
  });
  const loslassen = e => {
    if (!finger || e.pointerId !== finger.id) return;
    const f = finger; finger = null;
    if (!f.schuettelt) { if (f.wuerfel !== null && info.kannHalten) cb.halten && cb.halten(f.wuerfel); return; }
    // Wisch: Geschwindigkeit der letzten ~100 ms
    const v = f.verlauf, jetzt = e.timeStamp, letzt = v[v.length - 1];
    let alt = v[0]; for (const x of v) if (letzt.t - x.t <= 130) { alt = x; break; }
    if (alt === letzt && v.length > 1) alt = v[v.length - 2];
    const dt = Math.max(.016, (letzt.t - alt.t) / 1000), vx = (letzt.x - alt.x) / dt, vz = (letzt.z - alt.z) / dt, sp = Math.hypot(vx, vz);
    if (sp > 7 && vz < -.35 * sp && jetzt - letzt.t < 220) {
      if (geschuettelt < 5) { tipp.textContent = "Erst ein bisschen schütteln!"; tipp.hidden = false; return; }
      werfen(vx, vz, sp * .4);
    }
  };
  renderer.domElement.addEventListener("pointerup", loslassen);
  renderer.domElement.addEventListener("pointercancel", e => { if (finger && e.pointerId === finger.id) finger = null; });

  // Knopf "Würfeln": der Becher schüttelt sich selbst und kippt aus
  function autoWurf() {
    if (!info.kannWerfen || wg || auto) return false;
    const start = { x: (Math.random() - .5) * 2, z: 1.2 };
    auto = { t: 0, start };
    schuettelnBeginnen({ ...start }, true);
    return true;
  }
  function physikAuto(dt) {
    auto.t += dt;
    const t = auto.t, s = auto.start;
    if (hand) { hand.ziel = { x: s.x + Math.sin(t * 15) * 1.1, z: s.z + Math.cos(t * 11) * .6 }; }
    if (t > .95 && modus === "hand") {
      geschuettelt = Math.max(geschuettelt, 5);
      const a = (Math.random() - .5) * .7;
      werfen(Math.sin(a), -Math.cos(a), 5 + Math.random() * 4);
    }
  }

  // ---------- Netz: Becher der anderen ----------
  function liveSenden(jetzt) {
    if (!hand || !hand.eigen || !cb.live) return;
    if (jetzt - letzteLive < 70) return;
    letzteLive = jetzt;
    cb.live({ nr: S ? S.wurfNr : 0, x: Math.round(becher.x * 100), z: Math.round(becher.z * 100) });
  }
  function live(d) {
    if (!S || d.nr !== S.wurfNr || wg) return;
    const ziel = { x: d.x / 100, z: d.z / 100 };
    fremd = performance.now();
    if (modus === "heim") schuettelnBeginnen(ziel, false);
    else if (hand && !hand.eigen) hand.ziel = ziel;
  }
  function bahn(nr, b) {
    if (!b || !b.b || !b.w) return;
    if (S && S.wurfNr >= nr) return;
    bahnen.set(nr, b);
    wiedergabe(nr, b, false);
  }

  // ---------- Bildaufbau ----------
  let breite = 0, hoehe = 0;
  let ortAlt = "";
  function groesse() {
    const r = platz.getBoundingClientRect();
    const ort = `${Math.round(r.left + scrollX)},${Math.round(r.top + scrollY)}`;
    if (ort !== ortAlt) { ortAlt = ort; const [x, y] = ort.split(","); wrap.style.left = x + "px"; wrap.style.top = y + "px"; }
    const w = Math.round(r.width); if (!w) return;
    wrap.style.width = w + "px";
    const h = Math.round(w * .92);
    if (w === breite && h === hoehe) return;
    breite = w; hoehe = h;
    renderer.setSize(w, h, true);
    kamera.aspect = w / h;
    kamera.position.set(0, 17.2, 7.6);
    kamera.lookAt(0, 0, -.75);
    kamera.fov = 35 * Math.max(1, 1.05 / kamera.aspect);
    kamera.updateProjectionMatrix();
    schmutzig = true;
  }

  function flugSchritt(w, dt) {
    const t = w.tw; t.t += dt;
    let ziel = t.nach, zP, zQ;
    if (ziel && ziel.becher !== undefined) { const s = imBecher(ziel.becher); zP = s.p; zQ = s.q; }
    else if (ziel) { zP = ziel.p; zQ = ziel.q; }
    else { zP = t.nachP; zQ = t.nachQ; }
    if (!zP) return;
    const e = glatt(Math.min(1, t.t / t.dauer));
    w.m.position.lerpVectors(t.vonP, zP, e); w.m.position.y += Math.sin(e * Math.PI) * t.bogen;
    w.m.quaternion.slerpQuaternions(t.vonQ, zQ, e);
    if (t.t >= t.dauer) { w.tw = null; if (w.modus === "rein") w.modus = "becher"; }
  }

  const ruhePlatz = () => (S && S.phase === "spiel" && S.wurf === 0 ? P.BEREIT : P.HEIM);
  function becherRuhen(dt) {
    const z = ruhePlatz(), k = 1 - Math.exp(-dt * 7);
    const d = Math.hypot(z.x - becher.x, z.y - becher.y, z.z - becher.z);
    if (d < .01 && Math.abs(becher.q.w) > .9999) return false;
    becher.x += (z.x - becher.x) * k; becher.y += (z.y - becher.y) * k; becher.z += (z.z - becher.z) * k;
    becher.q.slerp(new THREE.Quaternion(), k);
    return true;
  }
  let vorher = performance.now(), vdAlt = false;
  const verdeckt = () => modus === "kippen" || modus === "anheben" || modus === "hand";
  function bild(jetzt) {
    requestAnimationFrame(bild);
    const dt = Math.min(.05, (jetzt - vorher) / 1000); vorher = jetzt;
    if (!platz || !platz.isConnected) { if (wrap.style.display !== "none") { wrap.style.display = "none"; finger = null; } return; }
    if (wrap.style.display === "none") { wrap.style.display = ""; schmutzig = true; }
    groesse();
    const vd = verdeckt();
    if (vd !== vdAlt) { vdAlt = vd; setTimeout(() => cb.anders && cb.anders(), 0); }
    let bewegt = schmutzig; schmutzig = false;
    if (auto) physikAuto(dt);
    if (modus === "anheben") { physikAnheben(dt); bewegt = true; }
    else if (modus === "hand") { physikHand(dt); bewegt = true; liveSenden(jetzt); if (fremd && !hand.eigen && jetzt - fremd > 4000) { /* Werfer hat aufgehört */ } }
    else if (modus === "kippen") { physikKippen(dt); bewegt = true; }
    else if (modus === "heim" && becherRuhen(dt)) bewegt = true;
    for (const w of W) {
      if (w.tw) { flugSchritt(w, dt); bewegt = true; }
      else if (w.modus === "becher" && modus !== "hand") { const s = imBecher(w.spot); w.m.position.copy(s.p); w.m.quaternion.copy(s.q); }
    }
    if (!bewegt) return;
    becherZeigen();
    if (modus === "hand" && hand && hand.eigen) tippZeigen();
    renderer.render(szene, kamera);
  }
  becherZeigen();
  requestAnimationFrame(bild);

  window.BECHER = {
    init(c) { cb = c || {}; },
    einhaengen(p) { platz = p; wrap.style.display = ""; schmutzig = true; groesse(); },
    zustand, live, bahn, autoWurf, verdeckt,
    get modus() { return modus; },
    abbrechen() { if (wg && wg.eigen) { wg = null; modus = "heim"; abgleichen(true); } },
    _test: { sim, W, becher, werfen, get wg() { return wg; },
      bildschirm(i) { const v = W[i].m.position.clone().project(kamera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
      oben() {                             // welche Augenzahl jeder 3D-Würfel gerade oben zeigt
        const n = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(v => new THREE.Vector3(...v));
        return W.map(w => { let best = -2, k = 0; n.forEach((v, j) => { const y = v.clone().applyQuaternion(w.m.quaternion).y; if (y > best) { best = y; k = j; } }); return SEITE[k]; });
      } }
  };
  window.dispatchEvent(new Event("becher-bereit"));
}
