// Gleisgenossen: die 3D-Welt (Three.js). Zeichnet Gelände, Gleise und den fahrenden Zug, meldet angetippte Felder.
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";

const G = window.GG;
const F = 2, GY = .3;                       // Weltgröße eines Feldes, Höhe der Wiese
const HOEHE = { ".": GY, w: GY, h: GY, b: .45, "~": .1 };
const FARBE = {
  ".": [0x9BD45A, 0x93CE52, 0xA3D963], w: [0x7DB84A, 0x76B044], h: [0xB5D77A, 0xADD072],
  b: [0x9A9A8A, 0x8F8F80], "~": [0x4F86D9, 0x4A80D2]
};
const WAND = [0xF3E6CC, 0xF9C7A8, 0xE8E1F5, 0xFFE3A3, 0xD9EEF7], DACH = [0xC9553D, 0x8C4A3A, 0x4A5A8C, 0xB8643C];
const WAGENFARBE = [0x2F6FDE, 0x2E9E5B, 0xF2B705, 0x8E5BD6, 0xF08A24, 0x1FA5A5];
const mats = new Map();
function mat(farbe, extra) {
  const key = farbe + (extra ? JSON.stringify(extra) : "");
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial(Object.assign({ color: farbe, roughness: .9, metalness: 0, flatShading: true }, extra)));
  return mats.get(key);
}
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function leeren(g) {
  g.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); } });
  while (g.children.length) g.remove(g.children[0]);
}
function schild(text, { bg = "#1C1A33", fg = "#F3F0FF", groesse = 1, unter = "" } = {}) {
  const c = document.createElement("canvas"), x = c.getContext("2d"), s = 4;
  const f1 = `700 ${26 * s / 2}px Inter, system-ui, sans-serif`, f2 = `600 ${19 * s / 2}px Inter, system-ui, sans-serif`;
  x.font = f1; let w = x.measureText(text).width; x.font = f2; if (unter) w = Math.max(w, x.measureText(unter).width);
  const pad = 14 * s / 2, h = (unter ? 58 : 38) * s / 2;
  c.width = Math.ceil(w + pad * 2); c.height = Math.ceil(h);
  x.fillStyle = bg; x.beginPath(); x.roundRect(0, 0, c.width, c.height, 12 * s / 2); x.fill();
  x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle"; x.font = f1;
  x.fillText(text, c.width / 2, (unter ? 20 : 19) * s / 2 + 1);
  if (unter) { x.font = f2; x.globalAlpha = .8; x.fillText(unter, c.width / 2, 42 * s / 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  const k = groesse / 165; sp.scale.set(c.width * k, c.height * k, 1); sp.renderOrder = 10;
  return sp;
}
// Viele gleiche Körper auf einmal: liste = [{ x, y, z, sx, sy, sz, ry, farbe }]
function instanzen(geo, material, liste, schatten = true) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, liste.length)), o = new THREE.Object3D(), col = new THREE.Color();
  m.count = liste.length;
  liste.forEach((e, k) => {
    o.position.set(e.x, e.y, e.z); o.rotation.set(0, e.ry || 0, 0); o.scale.set(e.sx || 1, e.sy || 1, e.sz || 1); o.updateMatrix();
    m.setMatrixAt(k, o.matrix);
    if (e.farbe != null) m.setColorAt(k, col.set(e.farbe));
  });
  m.castShadow = schatten; m.receiveShadow = true;
  return m;
}
const abdunkeln = (farbe, an) => an ? farbe : new THREE.Color(farbe).lerp(new THREE.Color(0x6E7A66), .45).multiplyScalar(.72).getHex();

export class Welt {
  constructor(el) {
    this.el = el;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(el.clientWidth || innerWidth, el.clientHeight || innerHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(r.domElement);
    const sc = this.scene = new THREE.Scene();
    sc.fog = new THREE.Fog(0xD7EDF6, 60, 150);
    this.camera = new THREE.PerspectiveCamera(45, 1, .1, 260);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x5f7f4a, 1.7));
    const s = this.sonne = new THREE.DirectionalLight(0xfff1d6, 2.6);
    s.castShadow = true; s.shadow.mapSize.set(2048, 2048); s.shadow.bias = -.0006;
    Object.assign(s.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 120 }); s.shadow.camera.updateProjectionMatrix();
    sc.add(s); sc.add(s.target);
    const c = this.controls = new MapControls(this.camera, r.domElement);
    c.enableDamping = true; c.dampingFactor = .08; c.minDistance = 5; c.maxDistance = 90;
    c.minPolarAngle = .2; c.maxPolarAngle = 1.25; c.zoomToCursor = true;
    c.addEventListener("change", () => this.begrenzen());
    c.addEventListener("start", () => { this.folgen = false; if (this.onFolgenAus) this.onFolgenAus(); });
    this.gTerrain = new THREE.Group(); this.gLand = new THREE.Group(); this.gNetz = new THREE.Group(); this.gZug = new THREE.Group(); this.gMarke = new THREE.Group(); this.gRauch = new THREE.Group();
    [this.gTerrain, this.gLand, this.gNetz, this.gZug, this.gMarke, this.gRauch].forEach(g => sc.add(g));
    this.rauch = [];
    const rg = new THREE.IcosahedronGeometry(.16, 0);
    for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ color: 0xF4F4F6, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; this.gRauch.add(m); this.rauch.push({ m, alter: 9 }); }
    this.rNr = 0; this.rauchZeit = 0;
    const marke = this.marke = new THREE.Mesh(new THREE.RingGeometry(.62, .78, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFFD447, depthTest: false, transparent: true }));
    marke.scale.set(F * .92, 1, F * .92); marke.renderOrder = 9; marke.visible = false; this.gMarke.add(marke);
    this.wagen = []; this.folgen = false; this.onTap = null; this.onFolgenAus = null; this.S = null;
    this.tippen();
    this.uhr = new THREE.Clock();
    addEventListener("resize", () => this.groesse());
    this.groesse();
    this.vorBild = null;
    const schleife = () => { this.bild(); requestAnimationFrame(schleife); };
    requestAnimationFrame(schleife);
  }
  groesse() {
    const w = this.el.clientWidth || innerWidth, h = this.el.clientHeight || innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
  }
  // Feldkoordinaten (x nach Osten, y nach Süden, Einheit Feld) → Welt
  wx(x) { return (x - G.B / 2) * F; }
  wz(y) { return (y - G.H / 2) * F; }
  begrenzen() {
    const t = this.controls.target, bx = G.B * F / 2, bz = G.H * F / 2;
    const vx = Math.max(-bx, Math.min(bx, t.x)) - t.x, vz = Math.max(-bz, Math.min(bz, t.z)) - t.z;
    if (vx || vz) { t.x += vx; t.z += vz; this.camera.position.x += vx; this.camera.position.z += vz; }
  }
  // Kamera auf einen Punkt (Feldkoordinaten) richten
  blick(x, y, abstand = 26) {
    const hoch = this.camera.aspect < 1, d = hoch ? abstand * 1.35 : abstand;
    this.controls.target.set(this.wx(x), 0, this.wz(y));
    this.camera.position.set(this.wx(x) - d * .1, d * .8, this.wz(y) + d * .62);
    this.controls.update();
  }
  tippen() {
    const el = this.renderer.domElement, ray = new THREE.Raycaster(), maus = new THREE.Vector2(), ebene = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GY), p = new THREE.Vector3();
    let aktiv = 0, start = null;
    el.addEventListener("pointerdown", e => { aktiv++; start = aktiv === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
    const ende = e => {
      aktiv = Math.max(0, aktiv - 1);
      if (!start || e.type === "pointercancel" || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 9 || performance.now() - start.t > 500) { start = null; return; }
      start = null;
      if (!this.onTap || e.target !== el) return;
      const r = el.getBoundingClientRect();
      maus.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(maus, this.camera);
      if (!ray.ray.intersectPlane(ebene, p)) return;
      const c = Math.floor(p.x / F + G.B / 2), rr = Math.floor(p.z / F + G.H / 2);
      if (c >= 0 && rr >= 0 && c < G.B && rr < G.H) this.onTap(rr * G.B + c);
    };
    addEventListener("pointerup", ende); addEventListener("pointercancel", ende);
  }
  markieren(i) {
    if (i == null || i < 0) { this.marke.visible = false; return; }
    this.marke.visible = true; this.marke.position.set(this.wx(i % G.B + .5), GY + .06, this.wz((i / G.B | 0) + .5));
  }

  // ---------- Stand übernehmen (nach jeder Aktion) ----------
  setzen(S) {
    this.S = S;
    const tk = S.seed + "|" + S.karte.g + "|" + S.land;
    if (tk !== this.terrainKey) { this.terrainKey = tk; this.gelaende(S); }
    const lk = S.land + "|" + G.landPreis(S);
    if (lk !== this.landKey) { this.landKey = lk; this.landZeichnen(S); }
    const gk = JSON.stringify(S.gleise);
    if (gk !== this.gleisKey) { this.gleisKey = gk; this.gleiseZeichnen(S); }
    if (this.wagen.length !== 2 + S.zug.stufen.wagen) this.zugBauen(S);
  }
  gelaende(S) {
    const K = S.karte, boden = [], baeume = [], kronen = [], felsen = [], haeuser = [], daecher = [];
    leeren(this.gTerrain);
    for (let i = 0; i < G.B * G.H; i++) {
      const g = K.g[i], c = i % G.B, r = i / G.B | 0, x = this.wx(c + .5), zz = this.wz(r + .5), an = G.besitzt(S, i);
      const fl = FARBE[g], h = HOEHE[g];
      boden.push({ x, y: 0, z: zz, sx: F, sy: h, sz: F, farbe: abdunkeln(fl[(c * 7 + r * 13) % fl.length], an) });
      const q = rng(i * 31 + K.seed);
      if (g === "w") for (let k = 0; k < 2; k++) {
        const bx = x + (q() - .5) * F * .7, bz = zz + (q() - .5) * F * .7, s = .8 + q() * .5;
        baeume.push({ x: bx, y: GY, z: bz, sx: s, sy: s, sz: s });
        kronen.push({ x: bx, y: GY + .35 * s, z: bz, sx: s, sy: s * (1 + q() * .4), sz: s, ry: q() * 6, farbe: abdunkeln([0x2F8A4A, 0x3C9A52, 0x2A7D43][k + (i % 2)], an) });
      }
      if (g === "b") felsen.push({ x: x + (q() - .5) * .4, y: HOEHE.b, z: zz + (q() - .5) * .4, sx: F * .62, sy: F * (.55 + q() * .9), sz: F * .62, ry: q() * 6, farbe: abdunkeln([0x9C9C8E, 0xA6A496, 0x8E8B84][i % 3], an) });
      if (g === "h") {
        const ry = (q() < .5 ? 0 : Math.PI / 2) + (q() - .5) * .2;
        haeuser.push({ x, y: GY, z: zz, sx: 1.05, sy: .75 + q() * .3, sz: .8, ry, farbe: abdunkeln(WAND[Math.floor(q() * WAND.length)], an) });
        daecher.push({ x, y: GY + .82, z: zz, sx: 1.25, sy: .55, sz: 1, ry, farbe: abdunkeln(DACH[Math.floor(q() * DACH.length)], an) });
      }
    }
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
    const bm = instanzen(box, mat(0xffffff), boden, false); this.gTerrain.add(bm);
    if (baeume.length) {
      this.gTerrain.add(instanzen(new THREE.CylinderGeometry(.06, .08, .4, 5).translate(0, .2, 0), mat(0x6B4A32), baeume));
      this.gTerrain.add(instanzen(new THREE.ConeGeometry(.32, .9, 6).translate(0, .45, 0), mat(0xffffff), kronen));
    }
    if (felsen.length) this.gTerrain.add(instanzen(new THREE.ConeGeometry(.6, 1, 5).translate(0, .5, 0), mat(0xffffff), felsen));
    if (haeuser.length) {
      this.gTerrain.add(instanzen(new THREE.BoxGeometry(.9, 1, .7).translate(0, .5, 0), mat(0xffffff), haeuser));
      this.gTerrain.add(instanzen(new THREE.ConeGeometry(.75, 1, 4).rotateY(Math.PI / 4).translate(0, .5, 0), mat(0xffffff), daecher));
    }
    K.doerfer.forEach(d => { const sp = schild(d.name, { groesse: 1.6 }); sp.position.set(this.wx(d.x + .5), 3.2, this.wz(d.y + .5)); this.gTerrain.add(sp); });
  }
  // Grenze des eigenen Landes und Preisschilder für kaufbare Grundstücke
  landZeichnen(S) {
    leeren(this.gLand);
    const n = G.B / G.P, striche = [], P = G.P;
    for (let p = 0; p < n * n; p++) {
      if (S.land[p] !== "1") continue;
      const c = p % n, r = p / n | 0;
      const frei = (cc, rr) => cc < 0 || rr < 0 || cc >= n || rr >= n || S.land[rr * n + cc] !== "1";
      const x0 = this.wx(c * P), z0 = this.wz(r * P), L = P * F;
      if (frei(c, r - 1)) striche.push({ x: x0 + L / 2, y: GY + .02, z: z0, sx: L, sy: .05, sz: .14 });
      if (frei(c, r + 1)) striche.push({ x: x0 + L / 2, y: GY + .02, z: z0 + L, sx: L, sy: .05, sz: .14 });
      if (frei(c - 1, r)) striche.push({ x: x0, y: GY + .02, z: z0 + L / 2, sx: .14, sy: .05, sz: L });
      if (frei(c + 1, r)) striche.push({ x: x0 + L, y: GY + .02, z: z0 + L / 2, sx: .14, sy: .05, sz: L });
    }
    this.gLand.add(instanzen(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xFFD447 }), striche, false));
    const preis = G.landPreis(S).toLocaleString("de-DE") + " T";
    for (let p = 0; p < n * n; p++) {
      if (!G.landKaufbar(S, p)) continue;
      const sp = schild("Land kaufen", { bg: "#FFD447", fg: "#1C1A33", unter: preis, groesse: 2.6 });
      sp.position.set(this.wx((p % n + .5) * P), 3, this.wz(((p / n | 0) + .5) * P)); this.gLand.add(sp);
    }
  }
  gleiseZeichnen(S) {
    leeren(this.gNetz);
    const bett = [], schwellen = [], schienen = [], y0 = GY;
    const lage = (seg, s, quer) => {
      const p = G.punkt(seg, s), q = G.punkt(seg, Math.min(G.laenge(seg), s + .01)), o = G.punkt(seg, Math.max(0, s - .01));
      const dx = q.x - o.x, dy = q.y - o.y, n = Math.hypot(dx, dy) || 1;
      return { x: this.wx(p.x - dy / n * quer), z: this.wz(p.y + dx / n * quer), ry: -Math.atan2(dy, dx) };
    };
    for (const k in S.gleise) {
      const i = +k, t = S.gleise[k];
      for (const [a, b] of G.paare(t.t, t.r)) {
        const seg = { i, ein: a, aus: b }, L = G.laenge(seg), teile = L === 1 ? 1 : 8;
        for (let j = 0; j < teile; j++) {
          const s0 = L * j / teile, s1 = L * (j + 1) / teile, m = (s0 + s1) / 2, len = (s1 - s0) * F;
          const mi = lage(seg, m, 0);
          bett.push({ x: mi.x, y: y0, z: mi.z, sx: len + (teile > 1 ? .12 : .02), sy: .05, sz: .78, ry: mi.ry });
          for (const quer of [-.16, .16]) { const r = lage(seg, m, quer); schienen.push({ x: r.x, y: y0 + .1, z: r.z, sx: len * (teile > 1 ? 1.35 : 1) + .03, sy: .06, sz: .05, ry: r.ry }); }
        }
        const anzahl = Math.round(L / .24);
        for (let j = 0; j < anzahl; j++) { const r = lage(seg, (j + .5) * L / anzahl, 0); schwellen.push({ x: r.x, y: y0 + .05, z: r.z, sx: .12, sy: .05, sz: .62, ry: r.ry }); }
      }
    }
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
    this.gNetz.add(instanzen(box, mat(0xB9A68A), bett, false));
    this.gNetz.add(instanzen(box, mat(0x6B4A32), schwellen, false));
    this.gNetz.add(instanzen(box, mat(0x8C8F99, { metalness: .5, roughness: .4 }), schienen));
  }
  zugBauen(S) {
    leeren(this.gZug); this.wagen = [];
    const n = 1 + S.zug.stufen.wagen, schwarz = mat(0x2A2A35), rot = mat(0xE2453A);
    const rad = (g, x, z, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .08, 10).rotateX(Math.PI / 2), schwarz); m.position.set(x, r, z); g.add(m); };
    const box = (g, w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
    // Lok, Länge 1,6 in x-Richtung, vorne = +x
    const lok = new THREE.Group();
    box(lok, 1.5, .14, .62, 0, .26, 0, schwarz);
    const kessel = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .95, 12).rotateZ(Math.PI / 2), rot); kessel.position.set(.22, .6, 0); kessel.castShadow = true; lok.add(kessel);
    const schlot = new THREE.Mesh(new THREE.CylinderGeometry(.08, .11, .3, 8), schwarz); schlot.position.set(.55, .98, 0); lok.add(schlot);
    box(lok, .5, .62, .66, -.48, .64, 0, rot); box(lok, .62, .07, .76, -.48, .98, 0, schwarz);
    box(lok, .3, .22, .4, -.48, .75, 0, mat(0xBFE3F2));
    [-.5, -.1, .3].forEach(x => { rad(lok, x, .3, .2); rad(lok, x, -.3, .2); });
    lok.position.y = GY + .1;
    this.gZug.add(lok); this.wagen.push(lok);
    for (let k = 0; k < n; k++) {
      const w = new THREE.Group(), f = mat(WAGENFARBE[k % WAGENFARBE.length]);
      box(w, 1.12, .12, .58, 0, .24, 0, schwarz);
      box(w, 1.1, .46, .64, 0, .52, 0, f);
      box(w, .9, .14, .66, 0, .6, 0, mat(0xF3F0FF));
      box(w, 1.18, .07, .72, 0, .79, 0, mat(0x3D3868));
      [-.35, .35].forEach(x => { rad(w, x, .3, .16); rad(w, x, -.3, .16); });
      w.position.y = GY + .1;
      this.gZug.add(w); this.wagen.push(w);
    }
  }

  // ---------- jedes Bild ----------
  bild() {
    const dt = Math.min(.05, this.uhr.getDelta());
    if (this.vorBild) this.vorBild(dt);
    const S = this.S;
    if (S && this.wagen.length) {
      const l = G.wagenlage(S);
      l.forEach((w, k) => { const o = this.wagen[k]; if (!o) return; o.position.x = this.wx(w.x); o.position.z = this.wz(w.y); o.rotation.y = -w.w; });
      const lok = this.wagen[0], v = S.zug.v;
      // Rauch aus dem Schlot
      this.rauchZeit -= dt;
      if (this.rauchZeit <= 0) {
        this.rauchZeit = v > .05 ? Math.max(.06, .3 - v * .1) : .9;
        const r = this.rauch[this.rNr++ % this.rauch.length], c = Math.cos(lok.rotation.y), s = Math.sin(lok.rotation.y);
        r.m.position.set(lok.position.x + .55 * c, lok.position.y + 1.1, lok.position.z - .55 * s); r.alter = 0; r.m.visible = true; r.m.scale.setScalar(.6);
      }
      if (this.folgen) {
        const t = this.controls.target, dx = (lok.position.x - t.x) * Math.min(1, dt * 3), dz = (lok.position.z - t.z) * Math.min(1, dt * 3);
        t.x += dx; t.z += dz; this.camera.position.x += dx; this.camera.position.z += dz;
      }
    }
    this.rauch.forEach(r => {
      if (r.alter > 2.2) { r.m.visible = false; return; }
      r.alter += dt; r.m.position.y += dt * .7; r.m.scale.setScalar(.6 + r.alter * .9); r.m.material.opacity = Math.max(0, .75 * (1 - r.alter / 2.2));
    });
    const t = this.controls.target;
    this.sonne.position.set(t.x + 22, 38, t.z + 14); this.sonne.target.position.copy(t);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
