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
    this.gTerrain = new THREE.Group(); this.gLand = new THREE.Group(); this.gNetz = new THREE.Group(); this.gZug = new THREE.Group(); this.gMarke = new THREE.Group(); this.gRauch = new THREE.Group(); this.gBauten = new THREE.Group(); this.gSchweben = new THREE.Group();
    this.drehteile = []; this.schwebende = [];
    [this.gTerrain, this.gLand, this.gNetz, this.gBauten, this.gZug, this.gMarke, this.gRauch, this.gSchweben].forEach(g => sc.add(g));
    this.rauch = [];
    const rg = new THREE.IcosahedronGeometry(.16, 0);
    for (let i = 0; i < 120; i++) { const m = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ color: 0xF4F4F6, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; this.gRauch.add(m); this.rauch.push({ m, alter: 9 }); }
    this.rNr = 0; this.rauchZeit = 0;
    const marke = this.marke = new THREE.Mesh(new THREE.RingGeometry(.62, .78, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFFD447, depthTest: false, transparent: true }));
    marke.scale.set(F * .92, 1, F * .92); marke.renderOrder = 9; marke.visible = false; this.gMarke.add(marke);
    this.zuege = {}; this.ich = null; this.folgen = false; this.onTap = null; this.onFolgenAus = null; this.S = null;
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
  // ich = eigene Spieler-ID (bestimmt eigenes Land, Kamera beim Folgen)
  setzen(S, ich) {
    this.S = S; this.ich = ich; this.gid = G.gruppeVon(S, ich);
    const tunnel = Object.keys(S.gleise).filter(k => S.karte.g[k] === "b").join(",");
    const tk = S.seed + "|" + S.karte.g + "|" + S.land.join(",") + "|" + tunnel + "|" + this.gid;
    if (tk !== this.terrainKey) { this.terrainKey = tk; this.gelaende(S); }
    const lk = S.land.join(",") + "|" + this.gid + "|" + (this.gid ? G.landPreis(S, this.gid) : 0) + "|" + Object.keys(S.gruppen).map(g => S.gruppen[g].name).join();
    if (lk !== this.landKey) { this.landKey = lk; this.landZeichnen(S); }
    const gk = JSON.stringify(S.gleise);
    if (gk !== this.gleisKey) { this.gleisKey = gk; this.gleiseZeichnen(S); }
    const bk = JSON.stringify(Object.keys(S.bauten).map(k => k + S.bauten[k].t));
    if (bk !== this.bautenKey) { this.bautenKey = bk; this.bautenZeichnen(S); }
    for (const pid in this.zuege) if (!S.zuege[pid]) { this.zuege[pid].teile.forEach(o => this.gZug.remove(o)); delete this.zuege[pid]; }
    for (const pid in S.zuege) {
      const z = this.zuege[pid], farbe = S.spieler[pid] ? S.spieler[pid].farbe : 0;
      if (!z || z.teile.length !== 2 + S.zuege[pid].stufen.wagen || z.farbe !== farbe) this.zugBauen(S, pid);
    }
  }
  gelaende(S) {
    const K = S.karte, boden = [], baeume = [], kronen = [], felsen = [], haeuser = [], daecher = [];
    leeren(this.gTerrain);
    for (let i = 0; i < G.B * G.H; i++) {
      const g = K.g[i], c = i % G.B, r = i / G.B | 0, x = this.wx(c + .5), zz = this.wz(r + .5), an = !!this.gid && G.besitzer(S, i) === this.gid;
      const fl = FARBE[g], h = HOEHE[g];
      boden.push({ x, y: 0, z: zz, sx: F, sy: h, sz: F, farbe: abdunkeln(fl[(c * 7 + r * 13) % fl.length], an) });
      const q = rng(i * 31 + K.seed);
      if (g === "w") for (let k = 0; k < 2; k++) {
        const bx = x + (q() - .5) * F * .7, bz = zz + (q() - .5) * F * .7, s = .8 + q() * .5;
        baeume.push({ x: bx, y: GY, z: bz, sx: s, sy: s, sz: s });
        kronen.push({ x: bx, y: GY + .35 * s, z: bz, sx: s, sy: s * (1 + q() * .4), sz: s, ry: q() * 6, farbe: abdunkeln([0x2F8A4A, 0x3C9A52, 0x2A7D43][k + (i % 2)], an) });
      }
      const tun = S.gleise[i] ? 1.45 : 1;
      if (g === "b") felsen.push({ x: x + (q() - .5) * .4 / tun / tun, y: HOEHE.b, z: zz + (q() - .5) * .4 / tun / tun, sx: F * .62 * tun, sy: F * (.55 + q() * .9) * (tun > 1 ? .85 : 1), sz: F * .62 * tun, ry: q() * 6, farbe: abdunkeln([0x9C9C8E, 0xA6A496, 0x8E8B84][i % 3], an) });
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
  // Grenzen aller Bahnen (eigene gelb, andere in ihrer Farbe), Namen der anderen Bahnen, Preisschilder für kaufbares Land
  landZeichnen(S) {
    leeren(this.gLand);
    const n = G.B / G.P, P = G.P, striche = {};
    for (let p = 0; p < n * n; p++) {
      const gid = S.land[p]; if (!gid) continue;
      const c = p % n, r = p / n | 0, l = striche[gid] = striche[gid] || [];
      const frei = (cc, rr) => cc < 0 || rr < 0 || cc >= n || rr >= n || S.land[rr * n + cc] !== gid;
      const x0 = this.wx(c * P), z0 = this.wz(r * P), L = P * F, d = gid === this.gid ? .14 : .1, y = GY + .02 + (gid === this.gid ? .01 : 0);
      if (frei(c, r - 1)) l.push({ x: x0 + L / 2, y, z: z0 + .07, sx: L, sy: .05, sz: d });
      if (frei(c, r + 1)) l.push({ x: x0 + L / 2, y, z: z0 + L - .07, sx: L, sy: .05, sz: d });
      if (frei(c - 1, r)) l.push({ x: x0 + .07, y, z: z0 + L / 2, sx: d, sy: .05, sz: L });
      if (frei(c + 1, r)) l.push({ x: x0 + L - .07, y, z: z0 + L / 2, sx: d, sy: .05, sz: L });
    }
    for (const gid in striche) {
      const farbe = gid === this.gid ? 0xFFD447 : new THREE.Color(G.FARBEN[(S.gruppen[gid] || {}).farbe || 0]).getHex();
      this.gLand.add(instanzen(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: farbe }), striche[gid], false));
    }
    for (const pid in S.spieler) {
      const sp = S.spieler[pid], gid = sp.gruppe; if (gid === this.gid || !S.gruppen[gid]) continue;
      const sc = schild(S.gruppen[gid].name, { bg: G.FARBEN[S.gruppen[gid].farbe], fg: "#FFFFFF", groesse: 2.2, unter: sp.name });
      sc.position.set(this.wx(sp.start.x), 4.2, this.wz(sp.start.y - 3)); this.gLand.add(sc);
    }
    if (!this.gid) return;
    const preis = G.landPreis(S, this.gid).toLocaleString("de-DE") + " T";
    for (let p = 0; p < n * n; p++) {
      if (!G.landKaufbar(S, this.gid, p)) continue;
      const sp = schild("Land kaufen", { bg: "#FFD447", fg: "#1C1A33", unter: preis, groesse: 2.6 });
      sp.position.set(this.wx((p % n + .5) * P), 3, this.wz(((p / n | 0) + .5) * P)); this.gLand.add(sp);
    }
  }
  gleiseZeichnen(S) {
    leeren(this.gNetz);
    const bett = [], schwellen = [], schienen = [], matt = [], holz = [], stein = [], bahnsteig = [], dach = [], lampen = [], portal = [], y0 = GY;
    const lage = (seg, s, quer) => {
      const p = G.punkt(seg, s), q = G.punkt(seg, Math.min(G.laenge(seg), s + .01)), o = G.punkt(seg, Math.max(0, s - .01));
      const dx = q.x - o.x, dy = q.y - o.y, n = Math.hypot(dx, dy) || 1;
      return { x: this.wx(p.x - dy / n * quer), z: this.wz(p.y + dx / n * quer), ry: -Math.atan2(dy, dx) };
    };
    for (const k in S.gleise) {
      const i = +k, t = S.gleise[k], gel = S.karte.g[i], bruecke = gel === "~", tunnel = gel === "b";
      G.paare(t.t, t.r).forEach(([a, b], nr) => {
        const seg = { i, ein: a, aus: b }, L = G.laenge(seg), teile = L === 1 ? 1 : 8;
        const aus = t.t === "s" && nr !== (t.st ? 1 : 0);          // nicht gestellter Weichenzweig: dunkle Schienen
        for (let j = 0; j < teile; j++) {
          const s0 = L * j / teile, s1 = L * (j + 1) / teile, m = (s0 + s1) / 2, len = (s1 - s0) * F;
          const mi = lage(seg, m, 0);
          if (!bruecke) bett.push({ x: mi.x, y: y0, z: mi.z, sx: len + (teile > 1 ? .12 : .02), sy: .05, sz: .78, ry: mi.ry });
          for (const quer of [-.16, .16]) { const r = lage(seg, m, quer); (aus ? matt : schienen).push({ x: r.x, y: y0 + .1, z: r.z, sx: len * (teile > 1 ? 1.35 : 1) + .03, sy: .06, sz: .05, ry: r.ry }); }
        }
        const anzahl = Math.round(L / .24);
        for (let j = 0; j < anzahl; j++) { const r = lage(seg, (j + .5) * L / anzahl, 0); schwellen.push({ x: r.x, y: y0 + .05, z: r.z, sx: .12, sy: .05, sz: .62, ry: r.ry }); }
        const mi = lage(seg, L / 2, 0);
        if (bruecke) {
          holz.push({ x: mi.x, y: y0 - .1, z: mi.z, sx: F * 1.01, sy: .14, sz: F * .5, ry: mi.ry });
          for (const q of [-.24, .24]) { const r = lage(seg, L / 2, q); holz.push({ x: r.x, y: y0 + .04, z: r.z, sx: F, sy: .3, sz: .06, ry: r.ry }); }
          for (const s of [.1, .9]) { const r = lage(seg, s, 0); stein.push({ x: r.x, y: 0, z: r.z, sx: .3, sy: y0 - .1, sz: F * .45, ry: r.ry }); }
        }
        if (tunnel) stein.push({ x: mi.x, y: y0 + .55, z: mi.z, sx: F * 1.02, sy: .6, sz: F * .8, ry: mi.ry });
        if (tunnel) for (const [s, seite] of [[0, a], [L, b]]) {   // Portale nur am Ein- und Ausgang, der Berg verdeckt den Zug
          const c = i % G.B + G.DIR[seite][0], rr = (i / G.B | 0) + G.DIR[seite][1], j = rr * G.B + c;
          if (c >= 0 && rr >= 0 && c < G.B && rr < G.H && S.karte.g[j] === "b" && S.gleise[j]) continue;
          const r = lage(seg, s, 0);
          stein.push({ x: r.x, y: y0, z: r.z, sx: .22, sy: 1.15, sz: F * .5, ry: r.ry });
          portal.push({ x: r.x, y: y0, z: r.z, sx: .26, sy: .8, sz: F * .3, ry: r.ry });
        }
        if (t.t === "b") {
          const r = lage(seg, L / 2, .36);
          bahnsteig.push({ x: r.x, y: y0, z: r.z, sx: F * .96, sy: .24, sz: .5, ry: r.ry });
          const r2 = lage(seg, L / 2, .42);
          dach.push({ x: r2.x, y: y0 + 1.05, z: r2.z, sx: F * .7, sy: .08, sz: .6, ry: r2.ry });
          for (const s of [.3, .7]) { const p = lage(seg, s, .48); stein.push({ x: p.x, y: y0 + .24, z: p.z, sx: .07, sy: .82, sz: .07, ry: p.ry }); }
          const sp = schild(G.bahnhofName(S, i), { groesse: 1.1, unter: "Bahnhof" }); sp.position.set(r.x, 2.3, r.z); this.gNetz.add(sp);
        }
        if (t.t === "s" && nr === 0) {
          const p = lage(seg, .12, .4);
          lampen.push({ x: p.x, y: y0 + .45, z: p.z, sx: .2, sy: .2, sz: .2, farbe: t.st ? 0xFFB020 : 0x5BD69A });
          stein.push({ x: p.x, y: y0, z: p.z, sx: .05, sy: .45, sz: .05 });
        }
      });
    }
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
    this.gNetz.add(instanzen(box, mat(0xB9A68A), bett, false));
    this.gNetz.add(instanzen(box, mat(0x6B4A32), schwellen, false));
    this.gNetz.add(instanzen(box, mat(0x8C8F99, { metalness: .5, roughness: .4 }), schienen));
    if (matt.length) this.gNetz.add(instanzen(box, mat(0x5A5D66), matt));
    if (holz.length) this.gNetz.add(instanzen(box, mat(0x8A5A3A), holz));
    if (stein.length) this.gNetz.add(instanzen(box, mat(0x8E8B84), stein));
    if (portal.length) this.gNetz.add(instanzen(box, mat(0x1C1A33), portal, false));
    if (bahnsteig.length) this.gNetz.add(instanzen(box, mat(0xD8CFC0), bahnsteig));
    if (dach.length) this.gNetz.add(instanzen(box, mat(0xC9553D), dach));
    if (lampen.length) this.gNetz.add(instanzen(new THREE.SphereGeometry(.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), lampen, false));
  }
  // Bauwerke neben der Strecke; Windmühlenflügel und Riesenrad drehen sich
  bautenZeichnen(S) {
    leeren(this.gBauten); this.drehteile = [];
    const box = (g, w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
    const zyl = (g, r1, r2, h, x, y, z, m, n = 10) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, n), m); c.position.set(x, y, z); c.castShadow = true; g.add(c); return c; };
    for (const k in S.bauten) {
      const i = +k, t = S.bauten[k].t, g = new THREE.Group(), q = rng(i * 7 + 3);
      if (t === "turm") {
        for (const [x, z] of [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) box(g, .09, 1.5, .09, x, .75, z, mat(0x6B4A32));
        zyl(g, .55, .55, .7, 0, 1.8, 0, mat(0x8C4A3A), 14);
        const kegel = new THREE.Mesh(new THREE.ConeGeometry(.62, .45, 14), mat(0x3D3868)); kegel.position.y = 2.38; g.add(kegel);
        zyl(g, .06, .06, .6, .5, 1.4, 0, mat(0x2A2A35), 6).rotation.z = .6;
      } else if (t === "muehle") {
        zyl(g, .38, .58, 1.7, 0, .85, 0, mat(0xF3E6CC), 8);
        const kappe = new THREE.Mesh(new THREE.ConeGeometry(.48, .6, 8), mat(0x8C4A3A)); kappe.position.y = 2; g.add(kappe);
        const fluegel = new THREE.Group(); fluegel.position.set(0, 1.6, .55);
        for (let a = 0; a < 4; a++) { const f = box(fluegel, .16, 1.2, .03, 0, .65, 0, mat(0xE8E1F5)); const h = new THREE.Group(); h.add(f); h.rotation.z = a * Math.PI / 2; fluegel.add(h); }
        g.add(fluegel); this.drehteile.push({ o: fluegel, achse: "z", tempo: 1.2 });
      } else if (t === "burg") {
        const st = mat(0xB8B2A6);
        box(g, 1.4, .9, 1.4, 0, .45, 0, st);
        for (const [x, z] of [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]]) {
          zyl(g, .26, .28, 1.5, x, .75, z, st, 8);
          const d = new THREE.Mesh(new THREE.ConeGeometry(.34, .55, 8), mat(0xC9553D)); d.position.set(x, 1.78, z); g.add(d);
        }
        box(g, .5, 1.4, .5, 0, .9, 0, st);
        box(g, .03, .6, .03, 0, 1.9, 0, mat(0x2A2A35)); box(g, .3, .18, .02, .15, 2.1, 0, mat(0xFFD447));
        box(g, .36, .5, .05, 0, .25, .71, mat(0x4A3A2A));
      } else if (t === "rad") {
        const rot = new THREE.Group(); rot.position.y = 1.9;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, .05, 6, 28), mat(0xF3F0FF)); rot.add(ring);
        for (let a = 0; a < 8; a++) {
          const sp = box(rot, .04, 1.35, .04, 0, 0, 0, mat(0xF3F0FF)); const h = new THREE.Group(); sp.position.y = .67; h.add(sp); h.rotation.z = a * Math.PI / 4; rot.add(h);
          const kab = box(rot, .26, .24, .3, Math.cos(a * Math.PI / 4) * 1.35, Math.sin(a * Math.PI / 4) * 1.35, 0, mat([0xE2453A, 0x2F6FDE, 0xFFD447, 0x2E9E5B][a % 4]));
          kab.userData.gondel = true;
        }
        g.add(rot); this.drehteile.push({ o: rot, achse: "z", tempo: .35 });
        for (const z of [-.3, .3]) for (const x of [-.6, .6]) { const b = box(g, .08, 2.2, .08, x * .55, 1, z, mat(0x8C8F99)); b.rotation.z = x > 0 ? .28 : -.28; }
      }
      g.position.set(this.wx(i % G.B + .5), GY, this.wz((i / G.B | 0) + .5));
      g.rotation.y = Math.floor(q() * 4) * Math.PI / 2;
      this.gBauten.add(g);
    }
  }
  // Text, der über einem Feld aufsteigt und verblasst (Geld, Ziele)
  schweben(x, y, text, art = "geld") {
    const farben = { geld: ["#FFD447", "#1C1A33"], info: ["#F3F0FF", "#1C1A33"], ziel: ["#5BD69A", "#1C1A33"] }[art];
    const sp = schild(text, { bg: farben[0], fg: farben[1], groesse: 1.3 });
    sp.position.set(this.wx(x), 2.6, this.wz(y));
    this.gSchweben.add(sp); this.schwebende.push({ sp, alter: 0 });
  }
  zugBauen(S, pid) {
    const alt = this.zuege[pid]; if (alt) alt.teile.forEach(o => this.gZug.remove(o));
    const farbe = S.spieler[pid] ? S.spieler[pid].farbe : 0, z = S.zuege[pid];
    const n = 1 + z.stufen.wagen, schwarz = mat(0x2A2A35), rot = mat(new THREE.Color(G.FARBEN[farbe]).getHex()), teile = [];
    const rad = (g, x, zz, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .08, 10).rotateX(Math.PI / 2), schwarz); m.position.set(x, r, zz); g.add(m); };
    const box = (g, w, h, d, x, y, zz, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, zz); b.castShadow = true; g.add(b); return b; };
    // Lok, Länge 1,6 in x-Richtung, vorne = +x; Farbe des Spielers
    const lok = new THREE.Group();
    box(lok, 1.5, .14, .62, 0, .26, 0, schwarz);
    const kessel = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .95, 12).rotateZ(Math.PI / 2), rot); kessel.position.set(.22, .6, 0); kessel.castShadow = true; lok.add(kessel);
    const schlot = new THREE.Mesh(new THREE.CylinderGeometry(.08, .11, .3, 8), schwarz); schlot.position.set(.55, .98, 0); lok.add(schlot);
    box(lok, .5, .62, .66, -.48, .64, 0, rot); box(lok, .62, .07, .76, -.48, .98, 0, schwarz);
    box(lok, .3, .22, .4, -.48, .75, 0, mat(0xBFE3F2));
    [-.5, -.1, .3].forEach(x => { rad(lok, x, .3, .2); rad(lok, x, -.3, .2); });
    lok.position.y = GY + .1;
    this.gZug.add(lok); teile.push(lok);
    for (let k = 0; k < n; k++) {
      const w = new THREE.Group(), f = mat(WAGENFARBE[(k + farbe) % WAGENFARBE.length]);
      box(w, 1.12, .12, .58, 0, .24, 0, schwarz);
      box(w, 1.1, .46, .64, 0, .52, 0, f);
      box(w, .9, .14, .66, 0, .6, 0, mat(0xF3F0FF));
      box(w, 1.18, .07, .72, 0, .79, 0, mat(0x3D3868));
      [-.35, .35].forEach(x => { rad(w, x, .3, .16); rad(w, x, -.3, .16); });
      w.position.y = GY + .1;
      this.gZug.add(w); teile.push(w);
    }
    this.zuege[pid] = { teile, farbe, rauch: Math.random() * .3 };
  }
  // Lok eines Spielers in Feldkoordinaten (für Kamera und Texte)
  lokBei(pid) { const z = this.S && this.S.zuege[pid]; if (!z) return null; const l = G.wagenlage(z)[0]; return { x: l.x, y: l.y }; }

  // ---------- jedes Bild ----------
  bild() {
    const dt = Math.min(.05, this.uhr.getDelta());
    if (this.vorBild) this.vorBild(dt);
    const S = this.S;
    if (S) for (const pid in this.zuege) {
      const zug = S.zuege[pid], zz = this.zuege[pid]; if (!zug) continue;
      G.wagenlage(zug).forEach((w, k) => { const o = zz.teile[k]; if (!o) return; o.position.x = this.wx(w.x); o.position.z = this.wz(w.y); o.rotation.y = -w.w; });
      const lok = zz.teile[0], v = zug.v;
      // Rauch aus dem Schlot
      zz.rauch -= dt;
      if (zz.rauch <= 0) {
        zz.rauch = v > .05 ? Math.max(.06, .3 - v * .1) : .9;
        const r = this.rauch[this.rNr++ % this.rauch.length], c = Math.cos(lok.rotation.y), s = Math.sin(lok.rotation.y);
        r.m.position.set(lok.position.x + .55 * c, lok.position.y + 1.1, lok.position.z - .55 * s); r.alter = 0; r.m.visible = true; r.m.scale.setScalar(.6);
      }
      if (this.folgen && pid === this.ich) {
        const t = this.controls.target, dx = (lok.position.x - t.x) * Math.min(1, dt * 3), dz = (lok.position.z - t.z) * Math.min(1, dt * 3);
        t.x += dx; t.z += dz; this.camera.position.x += dx; this.camera.position.z += dz;
      }
    }
    this.rauch.forEach(r => {
      if (r.alter > 2.2) { r.m.visible = false; return; }
      r.alter += dt; r.m.position.y += dt * .7; r.m.scale.setScalar(.6 + r.alter * .9); r.m.material.opacity = Math.max(0, .75 * (1 - r.alter / 2.2));
    });
    this.drehteile.forEach(d => { d.o.rotation[d.achse] += dt * d.tempo; d.o.children.forEach(c => { if (c.userData.gondel) c.rotation.z = -d.o.rotation.z; }); });
    this.schwebende = this.schwebende.filter(e => {
      e.alter += dt; e.sp.position.y += dt * .9; e.sp.material.opacity = Math.max(0, 1 - Math.max(0, e.alter - 1.2) / .8);
      if (e.alter < 2) return true;
      this.gSchweben.remove(e.sp); e.sp.material.map.dispose(); e.sp.material.dispose(); return false;
    });
    const t = this.controls.target;
    this.sonne.position.set(t.x + 22, 38, t.z + 14); this.sonne.target.position.copy(t);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
