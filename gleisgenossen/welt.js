// Gleisgenossen: die 3D-Welt (Three.js). Zeichnet Gelände mit Hügeln, Gleise und Züge, meldet angetippte Felder.
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const G = window.GG;
const F = 2, GY = .3, HS = .72;              // Weltgröße eines Feldes, Höhe der Ebene 0, Höhe einer Stufe
const WASSER = GY - .18, MULDE = .62;       // Wasserspiegel, Tiefe des Flussbetts
const RING = 44;                            // so viele Felder Landschaft rund um die Karte
const HIMMEL = 0x6FAEE3, DUNST = 0xD9ECF5;
const wy = h => GY + h * HS;
const BODEN = { ".": 0x92C955, w: 0x5E9B3D, h: 0xB2C97A, b: 0x948C80, "~": 0xD6C690 };
const WAND = [0xF3E6CC, 0xF9C7A8, 0xE8E1F5, 0xFFE3A3, 0xD9EEF7], DACH = [0xC9553D, 0x8C4A3A, 0x4A5A8C, 0xB8643C, 0x6E4A3A];
const BLUMEN = [0xFFFFFF, 0xFFD447, 0xF27BA8, 0x8FA8FF, 0xFF8A5B];
const WAGENFARBE = [0x2F6FDE, 0x2E9E5B, 0xF2B705, 0x8E5BD6, 0xF08A24, 0x1FA5A5];
const ZEIT = { value: 0 };
const mats = new Map();
function mat(farbe, extra) {
  const key = farbe + (extra ? JSON.stringify(extra) : "");
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial(Object.assign({ color: farbe, roughness: .9, metalness: 0, flatShading: true }, extra)));
  return mats.get(key);
}
// Baumkronen wiegen sich im Wind (je Instanz etwas anders)
function windMat() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true });
  m.onBeforeCompile = sh => {
    sh.uniforms.uZeit = ZEIT;
    sh.vertexShader = "uniform float uZeit;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * .37 + instanceMatrix[3].z * .51;
        float k = max(0., position.y - .3);
        transformed.x += sin(uZeit * 1.6 + ph) * .06 * k;
        transformed.z += cos(uZeit * 1.25 + ph * 1.3) * .045 * k;
      #endif`);
  };
  return m;
}
function wasserMat() {
  const m = new THREE.MeshStandardMaterial({ color: 0x3D85C6, roughness: .16, metalness: .15, transparent: true, opacity: .86 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uZeit = ZEIT;
    sh.vertexShader = "uniform float uZeit;\n" + sh.vertexShader
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
        objectNormal = normalize(vec3(cos(position.x * 1.7 + uZeit * 1.4) * .09, 1., sin(position.z * 2.1 + uZeit * 1.1) * .09));`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        transformed.y += sin(position.x * 1.7 + uZeit * 1.4) * .02 + cos(position.z * 2.1 + uZeit * 1.1) * .02;`);
  };
  return m;
}
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// Weiches Rauschen 0…1, gekachelt (n × n Gitterpunkte)
function rauschen(seed, n = 32) {
  const z = rng(seed), g = Array.from({ length: n * n }, z), s = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), tx = s(x - ix), ty = s(y - iy);
    const at = (a, b) => g[((b % n + n) % n) * n + ((a % n + n) % n)];
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx, b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
    return a + (b - a) * ty;
  };
}
const glatt = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function leeren(g) {
  g.traverse(o => {
    if (o.isInstancedMesh) o.dispose();
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); }
  });
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
// Viele gleiche Körper auf einmal: liste = [{ x, y, z, sx, sy, sz, ry, rz, farbe }]; rz neigt in Längsrichtung (Steigung)
function instanzen(geo, material, liste, schatten = true) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, liste.length)), o = new THREE.Object3D(), col = new THREE.Color();
  m.count = liste.length;
  liste.forEach((e, k) => {
    o.position.set(e.x, e.y, e.z); o.rotation.set(0, e.ry || 0, e.rz || 0, "YZX"); o.scale.set(e.sx || 1, e.sy || 1, e.sz || 1); o.updateMatrix();
    m.setMatrixAt(k, o.matrix);
    if (e.farbe != null) m.setColorAt(k, col.set(e.farbe));
  });
  m.castShadow = schatten; m.receiveShadow = true;
  return m;
}
// Formen für Bäume (Krone und Stamm), Büsche, Steine
function formen() {
  const kegel = (r, h, y) => new THREE.ConeGeometry(r, h, 7).translate(0, y, 0);
  return {
    tanne: mergeGeometries([kegel(.44, .75, .62), kegel(.33, .62, .98), kegel(.2, .45, 1.3)]),
    laub: new THREE.IcosahedronGeometry(.44, 0).scale(1, .92, 1).translate(0, .82, 0),
    birke: new THREE.IcosahedronGeometry(.27, 0).scale(.9, 1.55, .9).translate(0, 1.02, 0),
    stamm: new THREE.CylinderGeometry(.055, .08, .5, 5).translate(0, .25, 0),
    birkenstamm: new THREE.CylinderGeometry(.035, .05, .85, 5).translate(0, .42, 0),
    busch: new THREE.IcosahedronGeometry(.24, 0).scale(1, .7, 1).translate(0, .1, 0),
    stein: new THREE.DodecahedronGeometry(.15, 0).scale(1, .6, 1.2),
    blume: new THREE.IcosahedronGeometry(.055, 0),
    halm: new THREE.ConeGeometry(.045, .24, 4).translate(0, .1, 0),
    fels: new THREE.DodecahedronGeometry(.5, 0),
    box: new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0),
    // Satteldach: Dreiecksprisma längs x, First oben, Grundfläche bei y = 0
    dach: new THREE.CylinderGeometry(.5, .5, 1, 3, 1, false, Math.PI / 2).rotateZ(Math.PI / 2).translate(0, .25, 0)
  };
}

export class Welt {
  constructor(el) {
    this.el = el;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(el.clientWidth || innerWidth, el.clientHeight || innerHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(r.domElement);
    const sc = this.scene = new THREE.Scene();
    sc.fog = new THREE.Fog(DUNST, 80, 230);
    this.camera = new THREE.PerspectiveCamera(45, 1, .25, 1000);
    sc.add(new THREE.HemisphereLight(0xEAF4FF, 0x5F7F4A, 1.55));
    const s = this.sonne = new THREE.DirectionalLight(0xFFEFD2, 2.7);
    s.castShadow = true; s.shadow.mapSize.set(2048, 2048); s.shadow.bias = -.0006; s.shadow.normalBias = .02;
    Object.assign(s.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 140 }); s.shadow.camera.updateProjectionMatrix();
    sc.add(s); sc.add(s.target);
    const c = this.controls = new MapControls(this.camera, r.domElement);
    c.enableDamping = true; c.dampingFactor = .08; c.minDistance = 5; c.maxDistance = 90;
    c.minPolarAngle = .2; c.maxPolarAngle = 1.25; c.zoomToCursor = true;
    c.addEventListener("change", () => this.begrenzen());
    c.addEventListener("start", () => { this.folgen = false; if (this.onFolgenAus) this.onFolgenAus(); });
    this.f = formen();
    ["gTerrain", "gDeko", "gLand", "gRaster", "gNetz", "gBauten", "gZug", "gMarke", "gRauch", "gSchweben"].forEach(n => { this[n] = new THREE.Group(); sc.add(this[n]); });
    this.gRaster.visible = false; this.bau = false;
    this.drehteile = []; this.schwebende = [];
    this.himmel();
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
  hy(x, y) { return wy(G.gelaendeHoehe(x, y)); }     // Geländehöhe (Welt) an einem Punkt der Karte
  begrenzen() {
    const t = this.controls.target, bx = G.B * F / 2, bz = G.H * F / 2;
    const vx = Math.max(-bx, Math.min(bx, t.x)) - t.x, vz = Math.max(-bz, Math.min(bz, t.z)) - t.z;
    if (vx || vz) { t.x += vx; t.z += vz; this.camera.position.x += vx; this.camera.position.z += vz; }
  }
  // Kamera auf einen Punkt (Feldkoordinaten) richten
  blick(x, y, abstand = 26) {
    const hoch = this.camera.aspect < 1, d = hoch ? abstand * 1.35 : abstand, h = this.hy(x, y);
    this.controls.target.set(this.wx(x), h, this.wz(y));
    this.camera.position.set(this.wx(x) - d * .1, h + d * .8, this.wz(y) + d * .62);
    this.controls.update();
  }
  // Antippen: Strahl von der Kamera bis zum Gelände verfolgen
  tippen() {
    const el = this.renderer.domElement, ray = new THREE.Raycaster(), maus = new THREE.Vector2(), p = new THREE.Vector3();
    let aktiv = 0, start = null;
    const boden = (t, o, d) => { p.copy(o).addScaledVector(d, t); const x = p.x / F + G.B / 2, y = p.z / F + G.H / 2; return p.y - (x >= 0 && y >= 0 && x <= G.B && y <= G.H ? this.hy(x, y) : GY); };
    el.addEventListener("pointerdown", e => { aktiv++; start = aktiv === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
    const ende = e => {
      aktiv = Math.max(0, aktiv - 1);
      if (!start || e.type === "pointercancel" || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 9 || performance.now() - start.t > 500) { start = null; return; }
      start = null;
      if (!this.onTap || e.target !== el) return;
      const r = el.getBoundingClientRect();
      maus.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(maus, this.camera);
      const o = ray.ray.origin, d = ray.ray.direction;
      let a = 0, b = -1;
      for (let t = .3; t < 700; t += .3) { if (boden(t, o, d) <= 0) { b = t; break; } a = t; }
      if (b < 0) return;
      for (let k = 0; k < 12; k++) { const m = (a + b) / 2; if (boden(m, o, d) <= 0) b = m; else a = m; }
      boden(b, o, d);
      const c = Math.floor(p.x / F + G.B / 2), rr = Math.floor(p.z / F + G.H / 2);
      if (c >= 0 && rr >= 0 && c < G.B && rr < G.H) this.onTap(rr * G.B + c);
    };
    addEventListener("pointerup", ende); addEventListener("pointercancel", ende);
  }
  markieren(i) {
    if (i == null || i < 0) { this.marke.visible = false; return; }
    this.marke.visible = true; this.marke.position.set(this.wx(i % G.B + .5), wy(G.feldHoehe(i)) + .08, this.wz((i / G.B | 0) + .5));
  }
  // Beim Bauen: Raster auf eigenem Land, fremdes Land abgedunkelt
  bauModus(an) {
    an = !!an; if (an === this.bau) return;
    this.bau = an; this.gRaster.visible = an; this.farben();
  }

  // ---------- Himmel ----------
  himmel() {
    const geo = new THREE.SphereGeometry(800, 32, 16), pos = geo.attributes.position, col = [], c = new THREE.Color(), oben = new THREE.Color(HIMMEL), unten = new THREE.Color(DUNST);
    for (let k = 0; k < pos.count; k++) { c.copy(unten).lerp(oben, Math.pow(Math.max(0, pos.getY(k) / 800), .5)); col.push(c.r, c.g, c.b); }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    this.kuppel = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.kuppel.renderOrder = -1; this.scene.add(this.kuppel);
    this.wolken = new THREE.Group();
    const wm = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, emissive: 0xB8C8D8, emissiveIntensity: .45, fog: false, flatShading: true }), wg = new THREE.IcosahedronGeometry(1, 1), q = rng(77);
    for (let k = 0; k < 22; k++) {
      const w = new THREE.Group(), n = 3 + Math.floor(q() * 4);
      for (let j = 0; j < n; j++) { const m = new THREE.Mesh(wg, wm); m.position.set((j - n / 2) * 6 + q() * 3, q() * 2.5, (q() - .5) * 6); m.scale.set(5 + q() * 4, 3 + q() * 2.5, 5 + q() * 4); w.add(m); }
      const a = q() * 6.28, rr = 260 + q() * 200; w.position.set(Math.cos(a) * rr, 55 + q() * 70, Math.sin(a) * rr); w.rotation.y = q() * 6;
      this.wolken.add(w);
    }
    this.scene.add(this.wolken);
  }

  // ---------- Stand übernehmen (nach jeder Aktion) ----------
  // ich = eigene Spieler-ID (bestimmt eigenes Land, Kamera beim Folgen)
  setzen(S, ich) {
    this.S = S; this.ich = ich; this.gid = G.gruppeVon(S, ich);
    const tunnel = Object.keys(S.gleise).filter(k => S.karte.g[k] === "b").join(",");
    const tk = S.seed + "|" + G.B + "|" + S.karte.g + "|" + (S.karte.hoehe || "") + "|" + tunnel;
    if (tk !== this.terrainKey) { this.terrainKey = tk; this.gelaende(S); this.landKey = null; this.dekoKey = null; }
    const lk = S.land.join(",") + "|" + this.gid + "|" + (this.gid ? G.landPreis(S, this.gid) : 0) + "|" + Object.keys(S.gruppen).map(g => S.gruppen[g].name).join();
    if (lk !== this.landKey) { this.landKey = lk; this.landZeichnen(S); }
    const gk = JSON.stringify(S.gleise);
    if (gk !== this.gleisKey) { this.gleisKey = gk; this.gleiseZeichnen(S); }
    const bk = JSON.stringify(Object.keys(S.bauten).map(k => k + S.bauten[k].t));
    if (bk !== this.bautenKey) { this.bautenKey = bk; this.bautenZeichnen(S); }
    const dk = Object.keys(S.gleise).join() + "|" + Object.keys(S.bauten).join() + "|" + this.terrainKey.length + "|" + S.land.join();
    if (dk !== this.dekoKey) { this.dekoKey = dk; this.deko(S); }
    for (const pid in this.zuege) if (!S.zuege[pid]) { this.zuege[pid].teile.forEach(o => this.gZug.remove(o)); delete this.zuege[pid]; }
    for (const pid in S.zuege) {
      const z = this.zuege[pid], farbe = S.spieler[pid] ? S.spieler[pid].farbe : 0;
      if (!z || z.teile.length !== 2 + S.zuege[pid].stufen.wagen || z.farbe !== farbe) this.zugBauen(S, pid);
    }
  }

  // ---------- Gelände ----------
  gelaende(S) {
    leeren(this.gTerrain);
    const K = S.karte, B = G.B, H = G.H, seed = K.seed, f = this.f;
    const rn = rauschen(seed * 3 + 1), rw = rauschen(seed * 5 + 2);
    const typ = (c, r) => K.g[Math.max(0, Math.min(H - 1, r)) * B + Math.max(0, Math.min(B - 1, c))];
    // Felder, die einen Punkt (auf dem Halbfeld-Gitter) berühren
    const felder = (x, y) => {
      const xs = Number.isInteger(x) ? [x - 1, x] : [Math.floor(x)], ys = Number.isInteger(y) ? [y - 1, y] : [Math.floor(y)], l = [];
      ys.forEach(r => xs.forEach(c => l.push([c, r]))); return l;
    };
    const innenY = (x, y) => wy(G.gelaendeHoehe(x, y)) - (felder(x, y).every(([c, r]) => typ(c, r) === "~") ? MULDE : 0);
    const aussenY = (x, y) => {
      const px = Math.max(0, Math.min(B, x)), py = Math.max(0, Math.min(H, y)), d = Math.hypot(x - px, y - py);
      const hb = innenY(Number.isInteger(px) ? px : Math.round(px * 2) / 2, Number.isInteger(py) ? py : Math.round(py * 2) / 2);
      if (hb < GY - .1) return hb - Math.min(.25, d * .02);                       // Fluss läuft weiter
      const hn = wy(rn(x / 7, y / 7) * 3.2 + Math.pow(Math.max(0, d - 8), 1.3) * .15);
      return hb + (hn - hb) * glatt(d / 12);
    };
    this.boden = null;
    const c = new THREE.Color(), tmp = new THREE.Color(), hell = new THREE.Color(0xD8D27E), dunst = new THREE.Color(0xA9C1CC), fels = new THREE.Color(0x8F8A84);
    // Karte: zwei Gitterpunkte je Feld
    {
      const VB = 2 * B + 1, VH = 2 * H + 1, pos = new Float32Array(VB * VH * 3), col = new Float32Array(VB * VH * 3), idx = [];
      for (let v = 0; v < VH; v++) for (let u = 0; u < VB; u++) {
        const x = u / 2, y = v / 2, k = v * VB + u, fl = felder(x, y);
        pos[k * 3] = this.wx(x); pos[k * 3 + 1] = innenY(x, y); pos[k * 3 + 2] = this.wz(y);
        c.setRGB(0, 0, 0);
        fl.forEach(([cc, rr]) => { tmp.setHex(BODEN[typ(cc, rr)]); c.r += tmp.r; c.g += tmp.g; c.b += tmp.b; });
        c.multiplyScalar(1 / fl.length).multiplyScalar(.9 + .2 * rn(x / 3.1, y / 3.1));
        if (!fl.some(([cc, rr]) => typ(cc, rr) === "b")) c.lerp(hell, Math.min(.3, G.gelaendeHoehe(x, y) * .05));
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
        if (u < VB - 1 && v < VH - 1) idx.push(k, k + VB, k + 1, k + 1, k + VB, k + VB + 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col.slice(), 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      // Hänge etwas dunkler, damit man die Hügel sieht
      const nor = geo.attributes.normal.array;
      for (let k = 0; k < VB * VH; k++) { const m = 1 - Math.min(.35, (1 - nor[k * 3 + 1]) * 2.2); col[k * 3] *= m; col[k * 3 + 1] *= m; col[k * 3 + 2] *= m; }
      geo.attributes.color.array.set(col);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 }));
      m.receiveShadow = true; this.gTerrain.add(m);
      this.boden = { geo, basis: col, VB, VH, felder };
    }
    // Landschaft rings um die Karte, steigt zum Horizont hin an und verschwindet im Dunst
    const baeume = { tanne: [], laub: [], birke: [], stamm: [], birkenstamm: [] };
    const baum = (x, y, art, s, q, yy) => {
      const bx = this.wx(x), bz = this.wz(y), by = yy - .03, gruen = [0x2F8A4A, 0x3C9A52, 0x2A7D43, 0x4B9E3F][Math.floor(q() * 4)];
      if (art === "tanne") { baeume.tanne.push({ x: bx, y: by, z: bz, sx: s, sy: s * (1 + q() * .35), sz: s, ry: q() * 6, farbe: gruen }); baeume.stamm.push({ x: bx, y: by, z: bz, sx: s, sy: s, sz: s }); }
      else if (art === "laub") { baeume.laub.push({ x: bx, y: by, z: bz, sx: s * (1 + q() * .2), sy: s, sz: s, ry: q() * 6, farbe: [0x5DAA3C, 0x6BB541, 0x4E9A36, 0x88B83A][Math.floor(q() * 4)] }); baeume.stamm.push({ x: bx, y: by, z: bz, sx: s, sy: s * 1.2, sz: s }); }
      else { baeume.birke.push({ x: bx, y: by, z: bz, sx: s, sy: s, sz: s, ry: q() * 6, farbe: 0x9BCB4E }); baeume.birkenstamm.push({ x: bx, y: by, z: bz, sx: s, sy: s, sz: s }); }
    };
    {
      const R = RING, OB = B + 2 * R + 1, OH = H + 2 * R + 1, pos = new Float32Array(OB * OH * 3), col = new Float32Array(OB * OH * 3), idx = [], q = rng(seed + 99);
      for (let j = 0; j < OH; j++) for (let i = 0; i < OB; i++) {
        const x = i - R, y = j - R, k = j * OB + i, innen = x > 0 && x < B && y > 0 && y < H;
        const d = Math.hypot(x - Math.max(0, Math.min(B, x)), y - Math.max(0, Math.min(H, y)));
        const yy = innen ? GY - 6 : aussenY(x, y);
        pos[k * 3] = this.wx(x); pos[k * 3 + 1] = yy; pos[k * 3 + 2] = this.wz(y);
        const wald = rw(x / 5, y / 5) > .56;
        c.setHex(yy < GY - .1 ? BODEN["~"] : wald ? BODEN.w : BODEN["."]).multiplyScalar(.9 + .2 * rn(x / 3.1, y / 3.1));
        c.lerp(fels, glatt((yy - wy(5)) / 3)).lerp(dunst, glatt((d - 6) / RING) * .55);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
        if (i < OB - 1 && j < OH - 1) {
          idx.push(k, k + OB, k + 1, k + 1, k + OB, k + OB + 1);
          const tx = x + .5, ty = y + .5;
          if (!(tx > 0 && tx < B && ty > 0 && ty < H) && d < R - 8 && (wald ? q() < .75 : q() < .04)) {
            const bx = tx + (q() - .5) * .6, by = ty + (q() - .5) * .6, h = aussenY(bx, by);
            if (h > GY - .05 && h < wy(5.5)) baum(bx, by, q() < .65 ? "tanne" : "laub", .8 + q() * .5, q, h);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      this.gTerrain.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 })));
      const wasser = new THREE.Mesh(new THREE.PlaneGeometry((B + 2 * R) * F, (H + 2 * R) * F, (B + 2 * R) / 2, (H + 2 * R) / 2).rotateX(-Math.PI / 2), wasserMat());
      wasser.position.y = WASSER; wasser.receiveShadow = true; this.gTerrain.add(wasser);
    }
    // Wald, Felsen, Dörfer
    const felsen = [], schnee = [], haeuser = [], daecher = [], kamine = [];
    for (let i = 0; i < B * H; i++) {
      const g = K.g[i], cc = i % B, r = i / B | 0, x = this.wx(cc + .5), zz = this.wz(r + .5), q = rng(i * 31 + seed);
      if (g === "w") for (let k = 0; k < 3; k++) {
        const bx = cc + .15 + (k + q() * .9) / 3 * .7, by = r + .15 + q() * .7, a = q();
        baum(bx, by, a < .58 ? "tanne" : a < .88 ? "laub" : "birke", .75 + q() * .5, q, this.hy(bx, by));
      }
      if (g === "b") {
        let um = 0; for (let s = 0; s < 4; s++) if (typ(cc + G.DIR[s][0], r + G.DIR[s][1]) === "b") um++;
        const tun = S.gleise[i] ? 1.45 : 1, h = this.hy(cc + .5, r + .5), sy = F * (.9 + q() * .9 + (um === 4 ? .9 : 0)) * (tun > 1 ? .9 : 1);
        felsen.push({ x: x + (q() - .5) * .3 / tun, y: h - .1, z: zz + (q() - .5) * .3 / tun, sx: F * .95 * tun, sy, sz: F * .95 * tun, ry: q() * 6, farbe: [0x9C9C8E, 0xA6A496, 0x8E8C80, 0x96918A][Math.floor(q() * 4)] });
        if (um === 4 && G.feldHoehe(i) >= 4.5) schnee.push({ x, y: h - .1 + sy * .3, z: zz, sx: F * .55, sy: sy * .45, sz: F * .55, ry: q() * 6, farbe: 0xF6F8FA });
      }
      if (g === "h" && !K.doerfer.some(d => d.x === cc && d.y === r)) {
        const ry = (q() < .5 ? 0 : Math.PI / 2) + (q() - .5) * .25, w = .8 + q() * .35, t = .62 + q() * .2, hh = .55 + q() * .35;
        const y0 = Math.min(this.hy(cc + .3, r + .3), this.hy(cc + .7, r + .3), this.hy(cc + .3, r + .7), this.hy(cc + .7, r + .7)) - .02;
        haeuser.push({ x, y: y0 - .3, z: zz, sx: w, sy: hh + .3, sz: t, ry, farbe: WAND[Math.floor(q() * WAND.length)] });
        daecher.push({ x, y: y0 + hh, z: zz, sx: w + .14, sy: .42 + q() * .18, sz: (t + .16) / .866, ry, farbe: DACH[Math.floor(q() * DACH.length)] });
        if (q() < .5) { const o = (q() - .5) * w * .5; kamine.push({ x: x + Math.cos(ry) * o, y: y0 + hh, z: zz - Math.sin(ry) * o + .12, sx: .1, sy: .45, sz: .1, farbe: 0x8C4A3A }); }
      }
    }
    for (const art of ["tanne", "laub", "birke"]) if (baeume[art].length) this.gTerrain.add(instanzen(f[art], windMat(), baeume[art]));
    if (baeume.stamm.length) this.gTerrain.add(instanzen(f.stamm, mat(0x6B4A32), baeume.stamm));
    if (baeume.birkenstamm.length) this.gTerrain.add(instanzen(f.birkenstamm, mat(0xEDEAE0), baeume.birkenstamm));
    if (felsen.length) this.gTerrain.add(instanzen(f.fels, mat(0xffffff), felsen));
    if (schnee.length) this.gTerrain.add(instanzen(f.fels, mat(0xffffff), schnee));
    if (haeuser.length) {
      this.gTerrain.add(instanzen(f.box, mat(0xffffff), haeuser));
      this.gTerrain.add(instanzen(f.dach, mat(0xffffff), daecher));
      if (kamine.length) this.gTerrain.add(instanzen(f.box, mat(0xffffff), kamine));
    }
    // Kirche in der Dorfmitte, Ortsschild
    K.doerfer.forEach(d => {
      const h = this.hy(d.x + .5, d.y + .5);
      if (typ(d.x, d.y) === "h") {
        const k = new THREE.Group(), weiss = mat(0xF4EFE4), dunkel = mat(0x5A4A6A);
        const teil = (geo, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; k.add(o); };
        teil(f.box, weiss, .15, -.3, 0, 1.05, 1.05, .62); teil(f.dach, mat(0xA4483A), .15, .75, 0, 1.15, .45, .85);
        teil(f.box, weiss, -.45, -.3, 0, .34, 1.85, .34);
        const spitze = new THREE.Mesh(new THREE.ConeGeometry(.26, .8, 4).rotateY(Math.PI / 4).translate(0, .4, 0), dunkel); spitze.position.set(-.45, 1.55, 0); spitze.castShadow = true; k.add(spitze);
        k.position.set(this.wx(d.x + .5), h, this.wz(d.y + .5)); k.rotation.y = (d.x + d.y) % 2 ? 0 : Math.PI / 2;
        this.gTerrain.add(k);
      }
      const sp = schild(d.name, { groesse: 1.6 }); sp.position.set(this.wx(d.x + .5), h + 3.2, this.wz(d.y + .5)); this.gTerrain.add(sp);
    });
    this.farben();
  }
  // Bodenfarben: beim Bauen fremdes Land abdunkeln
  farben() {
    const b = this.boden; if (!b || !this.S) return;
    const a = b.geo.attributes.color.array, S = this.S, B = G.B, H = G.H;
    for (let v = 0; v < b.VH; v++) for (let u = 0; u < b.VB; u++) {
      const k = v * b.VB + u;
      let fremd = 0;
      if (this.bau && this.gid) {
        const fl = b.felder(u / 2, v / 2);
        fl.forEach(([c, r]) => { if (G.besitzer(S, Math.max(0, Math.min(H - 1, r)) * B + Math.max(0, Math.min(B - 1, c))) !== this.gid) fremd++; });
        fremd /= fl.length;
      }
      const m = 1 - .42 * fremd;
      a[k * 3] = b.basis[k * 3] * m; a[k * 3 + 1] = b.basis[k * 3 + 1] * m; a[k * 3 + 2] = b.basis[k * 3 + 2] * (m + .08 * fremd);
    }
    b.geo.attributes.color.needsUpdate = true;
  }
  // Kleinkram auf Wiesen: Blumen, Gras, Büsche, Steine, einzelne Bäume (nicht auf Gleisen und Bauwerken)
  deko(S) {
    leeren(this.gDeko);
    const K = S.karte, B = G.B, f = this.f, blumen = [], halme = [], buesche = [], steine = [], kronen = [], staemme = [];
    for (let i = 0; i < B * G.H; i++) {
      if (K.g[i] !== "." || S.gleise[i] || S.bauten[i]) continue;
      const q = rng(i * 17 + K.seed * 3), c = i % B, r = i / B | 0;
      const at = (x, y) => ({ x: this.wx(x), y: this.hy(x, y), z: this.wz(y) });
      if (q() < .22) { const fx = c + .2 + q() * .6, fy = r + .2 + q() * .6, farbe = BLUMEN[Math.floor(q() * BLUMEN.length)];
        for (let k = 0; k < 5; k++) { const p = at(fx + (q() - .5) * .3, fy + (q() - .5) * .3); blumen.push({ x: p.x, y: p.y + .04, z: p.z, farbe }); } }
      if (q() < .4) for (let k = 0; k < 3; k++) { const p = at(c + .1 + q() * .8, r + .1 + q() * .8); halme.push({ x: p.x, y: p.y - .02, z: p.z, sy: .7 + q() * .6, ry: q() * 6, farbe: [0x6FA83E, 0x7FB848, 0x5E9636][Math.floor(q() * 3)] }); }
      if (q() < .06) { const p = at(c + .25 + q() * .5, r + .25 + q() * .5), s = .8 + q() * .7; buesche.push({ x: p.x, y: p.y - .02, z: p.z, sx: s, sy: s, sz: s, ry: q() * 6, farbe: [0x3E8A3A, 0x4E9A40, 0x5A8F2E][Math.floor(q() * 3)] }); }
      if (q() < .035) { const p = at(c + .2 + q() * .6, r + .2 + q() * .6), s = .7 + q() * .9; steine.push({ x: p.x, y: p.y, z: p.z, sx: s, sy: s, sz: s, ry: q() * 6, farbe: [0x9C9A92, 0xAFADA4, 0x8A8880][Math.floor(q() * 3)] }); }
      if (q() < .03 && !G.besitzer(S, i)) { const p = at(c + .3 + q() * .4, r + .3 + q() * .4), s = .9 + q() * .4;
        kronen.push({ x: p.x, y: p.y - .03, z: p.z, sx: s * 1.1, sy: s, sz: s * 1.1, ry: q() * 6, farbe: [0x5DAA3C, 0x6BB541, 0x88B83A][Math.floor(q() * 3)] }); staemme.push({ x: p.x, y: p.y - .03, z: p.z, sx: s, sy: s * 1.2, sz: s }); }
    }
    if (blumen.length) this.gDeko.add(instanzen(f.blume, mat(0xffffff, { flatShading: false, roughness: .6 }), blumen, false));
    if (halme.length) this.gDeko.add(instanzen(f.halm, mat(0xffffff), halme, false));
    if (buesche.length) this.gDeko.add(instanzen(f.busch, windMat(), buesche));
    if (steine.length) this.gDeko.add(instanzen(f.stein, mat(0xffffff), steine));
    if (kronen.length) { this.gDeko.add(instanzen(f.laub, windMat(), kronen)); this.gDeko.add(instanzen(f.stamm, mat(0x6B4A32), staemme)); }
  }
  // Grenzen aller Bahnen (eigene gelb, andere in ihrer Farbe), Namen der anderen Bahnen, Preisschilder für kaufbares Land, Raster
  landZeichnen(S) {
    leeren(this.gLand); leeren(this.gRaster);
    const n = G.B / G.P, P = G.P, B = G.B, striche = {}, ey = (cx, cy) => wy(G.ecke(cx, cy)) + .035;
    // ein Strich je Feldkante, folgt den Hügeln
    const kante = (l, cx, cy, waag, innen, dick) => {
      const ax = cx, ay = cy, bx = cx + (waag ? 1 : 0), by = cy + (waag ? 0 : 1), y1 = ey(ax, ay), y2 = ey(bx, by);
      const ox = waag ? 0 : innen * .07, oz = waag ? innen * .07 : 0;
      l.push({ x: this.wx((ax + bx) / 2) + ox, y: (y1 + y2) / 2 - .025, z: this.wz((ay + by) / 2) + oz, sx: F + .02, sy: .05, sz: dick, ry: waag ? 0 : -Math.PI / 2, rz: Math.atan2((waag ? y2 - y1 : y2 - y1), F) });
    };
    for (let p = 0; p < n * n; p++) {
      const gid = S.land[p]; if (!gid) continue;
      const c = p % n, r = p / n | 0, l = striche[gid] = striche[gid] || [], d = gid === this.gid ? .14 : .1;
      const frei = (cc, rr) => cc < 0 || rr < 0 || cc >= n || rr >= n || S.land[rr * n + cc] !== gid;
      for (let k = 0; k < P; k++) {
        if (frei(c, r - 1)) kante(l, c * P + k, r * P, true, 1, d);
        if (frei(c, r + 1)) kante(l, c * P + k, (r + 1) * P, true, -1, d);
        if (frei(c - 1, r)) kante(l, c * P, r * P + k, false, 1, d);
        if (frei(c + 1, r)) kante(l, (c + 1) * P, r * P + k, false, -1, d);
      }
    }
    for (const gid in striche) {
      const farbe = gid === this.gid ? 0xFFD447 : new THREE.Color(G.FARBEN[(S.gruppen[gid] || {}).farbe || 0]).getHex();
      this.gLand.add(instanzen(this.f.box, new THREE.MeshBasicMaterial({ color: farbe }), striche[gid], false));
    }
    for (const pid in S.spieler) {
      const sp = S.spieler[pid], gid = sp.gruppe; if (gid === this.gid || !S.gruppen[gid]) continue;
      const sc = schild(S.gruppen[gid].name, { bg: G.FARBEN[S.gruppen[gid].farbe], fg: "#FFFFFF", groesse: 2.2, unter: sp.name });
      sc.position.set(this.wx(sp.start.x), this.hy(sp.start.x, sp.start.y - 3) + 4, this.wz(sp.start.y - 3)); this.gLand.add(sc);
    }
    // Raster auf eigenem Land (nur beim Bauen sichtbar)
    if (this.gid) {
      const pkt = [], halb = (x, y) => [this.wx(x), this.hy(x, y) + .03, this.wz(y)];
      const linie = (x1, y1, x2, y2) => { const xm = (x1 + x2) / 2, ym = (y1 + y2) / 2; pkt.push(...halb(x1, y1), ...halb(xm, ym), ...halb(xm, ym), ...halb(x2, y2)); };
      for (let i = 0; i < B * G.H; i++) {
        if (G.besitzer(S, i) !== this.gid) continue;
        const c = i % B, r = i / B | 0;
        linie(c, r, c + 1, r); linie(c, r, c, r + 1);
        if (G.besitzer(S, i + 1) !== this.gid || c === B - 1) linie(c + 1, r, c + 1, r + 1);
        if (r === G.H - 1 || G.besitzer(S, i + B) !== this.gid) linie(c, r + 1, c + 1, r + 1);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pkt, 3));
      this.gRaster.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: .32 })));
    }
    this.farben();
    if (!this.gid) return;
    const preis = G.landPreis(S, this.gid).toLocaleString("de-DE") + " T";
    for (let p = 0; p < n * n; p++) {
      if (!G.landKaufbar(S, this.gid, p)) continue;
      const sp = schild("Land kaufen", { bg: "#FFD447", fg: "#1C1A33", unter: preis, groesse: 2.6 }), x = (p % n + .5) * P, y = ((p / n | 0) + .5) * P;
      sp.position.set(this.wx(x), this.hy(x, y) + 3, this.wz(y)); this.gLand.add(sp);
    }
  }
  gleiseZeichnen(S) {
    leeren(this.gNetz);
    const bett = [], schwellen = [], schienen = [], matt = [], holz = [], stein = [], bahnsteig = [], dach = [], lampen = [], portal = [];
    // Punkt auf dem Gleis (Welt), quer = seitlicher Versatz; rz = Neigung in Fahrtrichtung
    const lage = (seg, s, quer) => {
      const p = G.punkt(seg, s), q = G.punkt(seg, Math.min(G.laenge(seg), s + .01)), o = G.punkt(seg, Math.max(0, s - .01));
      const dx = q.x - o.x, dy = q.y - o.y, n = Math.hypot(dx, dy) || 1;
      return { x: this.wx(p.x - dy / n * quer), y: wy(G.gleisHoehe(seg, s)), z: this.wz(p.y + dx / n * quer), ry: -Math.atan2(dy, dx), rz: Math.atan2(G.steigung(seg) * HS, F) };
    };
    for (const k in S.gleise) {
      const i = +k, t = S.gleise[k], gel = S.karte.g[i], bruecke = gel === "~", tunnel = gel === "b";
      G.paare(t.t, t.r).forEach(([a, b], nr) => {
        const seg = { i, ein: a, aus: b }, L = G.laenge(seg), teile = L === 1 ? 1 : 8, schraeg = 1 / Math.cos(Math.atan2(G.steigung(seg) * HS, F));
        const aus = t.t === "s" && nr !== (t.st ? 1 : 0);          // nicht gestellter Weichenzweig: dunkle Schienen
        for (let j = 0; j < teile; j++) {
          const s0 = L * j / teile, s1 = L * (j + 1) / teile, m = (s0 + s1) / 2, len = (s1 - s0) * F * schraeg;
          const mi = lage(seg, m, 0);
          if (!bruecke) bett.push({ x: mi.x, y: mi.y - .1, z: mi.z, sx: len + (teile > 1 ? .12 : .04), sy: .15, sz: .78, ry: mi.ry, rz: mi.rz });
          for (const quer of [-.16, .16]) { const r = lage(seg, m, quer); (aus ? matt : schienen).push({ x: r.x, y: r.y + .1, z: r.z, sx: len * (teile > 1 ? 1.35 : 1) + .03, sy: .06, sz: .05, ry: r.ry, rz: r.rz }); }
        }
        const anzahl = Math.round(L / .24);
        for (let j = 0; j < anzahl; j++) { const r = lage(seg, (j + .5) * L / anzahl, 0); schwellen.push({ x: r.x, y: r.y + .05, z: r.z, sx: .12, sy: .05, sz: .62, ry: r.ry, rz: r.rz }); }
        const mi = lage(seg, L / 2, 0);
        if (bruecke) {
          holz.push({ x: mi.x, y: mi.y - .1, z: mi.z, sx: F * 1.01, sy: .14, sz: F * .5, ry: mi.ry });
          for (const q of [-.24, .24]) { const r = lage(seg, L / 2, q); holz.push({ x: r.x, y: r.y + .04, z: r.z, sx: F, sy: .3, sz: .06, ry: r.ry }); }
          for (const s of [.1, .9]) { const r = lage(seg, s, 0); stein.push({ x: r.x, y: GY - MULDE - .05, z: r.z, sx: .3, sy: r.y - .1 - (GY - MULDE - .05), sz: F * .45, ry: r.ry }); }
        }
        if (tunnel) stein.push({ x: mi.x, y: mi.y + .55, z: mi.z, sx: F * 1.02, sy: .6, sz: F * .8, ry: mi.ry, rz: mi.rz });
        if (tunnel) for (const [s, seite] of [[0, a], [L, b]]) {   // Portale nur am Ein- und Ausgang, der Berg verdeckt den Zug
          const c = i % G.B + G.DIR[seite][0], rr = (i / G.B | 0) + G.DIR[seite][1], j = rr * G.B + c;
          if (c >= 0 && rr >= 0 && c < G.B && rr < G.H && S.karte.g[j] === "b" && S.gleise[j]) continue;
          const r = lage(seg, s, 0);
          stein.push({ x: r.x, y: r.y - .1, z: r.z, sx: .22, sy: 1.25, sz: F * .5, ry: r.ry });
          portal.push({ x: r.x, y: r.y, z: r.z, sx: .26, sy: .8, sz: F * .3, ry: r.ry });
        }
        if (t.t === "b") {
          const r = lage(seg, L / 2, .36);
          bahnsteig.push({ x: r.x, y: r.y - .1, z: r.z, sx: F * .96, sy: .34, sz: .5, ry: r.ry });
          const r2 = lage(seg, L / 2, .42);
          dach.push({ x: r2.x, y: r2.y + 1.05, z: r2.z, sx: F * .7, sy: .08, sz: .6, ry: r2.ry });
          for (const s of [.3, .7]) { const p = lage(seg, s, .48); stein.push({ x: p.x, y: p.y + .24, z: p.z, sx: .07, sy: .82, sz: .07, ry: p.ry }); }
          const sp = schild(G.bahnhofName(S, i), { groesse: 1.1, unter: "Bahnhof" }); sp.position.set(r.x, r.y + 2, r.z); this.gNetz.add(sp);
        }
        if (t.t === "s" && nr === 0) {
          const p = lage(seg, .12, .4);
          lampen.push({ x: p.x, y: p.y + .45, z: p.z, sx: .2, sy: .2, sz: .2, farbe: t.st ? 0xFFB020 : 0x5BD69A });
          stein.push({ x: p.x, y: p.y - .05, z: p.z, sx: .05, sy: .5, sz: .05 });
        }
      });
    }
    const box = this.f.box;
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
        for (const [x, z] of [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) box(g, .09, 1.8, .09, x, .6, z, mat(0x6B4A32));
        zyl(g, .55, .55, .7, 0, 1.8, 0, mat(0x8C4A3A), 14);
        const kegel = new THREE.Mesh(new THREE.ConeGeometry(.62, .45, 14), mat(0x3D3868)); kegel.position.y = 2.38; g.add(kegel);
        zyl(g, .06, .06, .6, .5, 1.4, 0, mat(0x2A2A35), 6).rotation.z = .6;
      } else if (t === "muehle") {
        zyl(g, .38, .58, 2.1, 0, .65, 0, mat(0xF3E6CC), 8);
        const kappe = new THREE.Mesh(new THREE.ConeGeometry(.48, .6, 8), mat(0x8C4A3A)); kappe.position.y = 2; g.add(kappe);
        const fluegel = new THREE.Group(); fluegel.position.set(0, 1.6, .55);
        for (let a = 0; a < 4; a++) { const f = box(fluegel, .16, 1.2, .03, 0, .65, 0, mat(0xE8E1F5)); const h = new THREE.Group(); h.add(f); h.rotation.z = a * Math.PI / 2; fluegel.add(h); }
        g.add(fluegel); this.drehteile.push({ o: fluegel, achse: "z", tempo: 1.2 });
      } else if (t === "burg") {
        const st = mat(0xB8B2A6);
        box(g, 1.4, 1.3, 1.4, 0, .25, 0, st);
        for (const [x, z] of [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]]) {
          zyl(g, .26, .28, 1.9, x, .55, z, st, 8);
          const d = new THREE.Mesh(new THREE.ConeGeometry(.34, .55, 8), mat(0xC9553D)); d.position.set(x, 1.78, z); g.add(d);
        }
        box(g, .5, 1.8, .5, 0, .7, 0, st);
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
        for (const z of [-.3, .3]) for (const x of [-.6, .6]) { const b = box(g, .08, 2.6, .08, x * .55, .8, z, mat(0x8C8F99)); b.rotation.z = x > 0 ? .28 : -.28; }
      }
      // auf Hängen auf einen Sockel in Höhe des höchsten Punkts stellen
      const c = i % G.B, r = i / G.B | 0, ys = [G.ecke(c, r), G.ecke(c + 1, r), G.ecke(c, r + 1), G.ecke(c + 1, r + 1)];
      const y0 = wy(Math.min(...ys)), y1 = wy(Math.max(...ys)), hs = y1 - y0 + .15;
      if (y1 - y0 > .01) box(g, 1.7, hs, 1.7, 0, -hs / 2 + .05, 0, mat(0xA89C86));
      g.position.set(this.wx(c + .5), y1, this.wz(r + .5));
      g.rotation.y = Math.floor(q() * 4) * Math.PI / 2;
      this.gBauten.add(g);
    }
  }
  // Text, der über einem Feld aufsteigt und verblasst (Geld, Ziele)
  schweben(x, y, text, art = "geld") {
    const farben = { geld: ["#FFD447", "#1C1A33"], info: ["#F3F0FF", "#1C1A33"], ziel: ["#5BD69A", "#1C1A33"] }[art];
    const sp = schild(text, { bg: farben[0], fg: farben[1], groesse: 1.3 });
    sp.position.set(this.wx(x), this.hy(x, y) + 2.3, this.wz(y));
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
    this.gZug.add(lok); teile.push(lok);
    for (let k = 0; k < n; k++) {
      const w = new THREE.Group(), f = mat(WAGENFARBE[(k + farbe) % WAGENFARBE.length]);
      box(w, 1.12, .12, .58, 0, .24, 0, schwarz);
      box(w, 1.1, .46, .64, 0, .52, 0, f);
      box(w, .9, .14, .66, 0, .6, 0, mat(0xF3F0FF));
      box(w, 1.18, .07, .72, 0, .79, 0, mat(0x3D3868));
      [-.35, .35].forEach(x => { rad(w, x, .3, .16); rad(w, x, -.3, .16); });
      this.gZug.add(w); teile.push(w);
    }
    this.zuege[pid] = { teile, farbe, rauch: Math.random() * .3 };
  }
  // Lok eines Spielers in Feldkoordinaten (für Kamera und Texte)
  lokBei(pid) { const z = this.S && this.S.zuege[pid]; if (!z) return null; const l = G.wagenlage(z)[0]; return { x: l.x, y: l.y }; }

  // ---------- jedes Bild ----------
  bild() {
    const dt = Math.min(.05, this.uhr.getDelta());
    ZEIT.value += dt;
    if (this.vorBild) this.vorBild(dt);
    const S = this.S;
    if (S) for (const pid in this.zuege) {
      const zug = S.zuege[pid], zz = this.zuege[pid]; if (!zug) continue;
      G.wagenlage(zug).forEach((w, k) => {
        const o = zz.teile[k]; if (!o) return;
        o.position.set(this.wx(w.x), wy(w.h) + .1, this.wz(w.y)); o.rotation.set(0, -w.w, Math.atan2(w.dh * HS, w.len * F), "YZX");
      });
      const lok = zz.teile[0], v = zug.v;
      // Rauch aus dem Schlot
      zz.rauch -= dt;
      if (zz.rauch <= 0) {
        zz.rauch = v > .05 ? Math.max(.06, .3 - v * .1) : .9;
        const r = this.rauch[this.rNr++ % this.rauch.length], c = Math.cos(lok.rotation.y), s = Math.sin(lok.rotation.y);
        r.m.position.set(lok.position.x + .55 * c, lok.position.y + 1.1, lok.position.z - .55 * s); r.alter = 0; r.m.visible = true; r.m.scale.setScalar(.6);
      }
      if (this.folgen && pid === this.ich) {
        const t = this.controls.target, k = Math.min(1, dt * 3), dx = (lok.position.x - t.x) * k, dy = (lok.position.y - .1 - t.y) * k, dz = (lok.position.z - t.z) * k;
        t.x += dx; t.y += dy; t.z += dz; this.camera.position.x += dx; this.camera.position.y += dy; this.camera.position.z += dz;
      }
    }
    // Beim Verschieben der Karte die Kamera sanft der Geländehöhe nachführen
    const t = this.controls.target;
    if (S && !this.folgen) {
      const x = t.x / F + G.B / 2, y = t.z / F + G.H / 2, dy = (this.hy(x, y) - t.y) * Math.min(1, dt * 2);
      t.y += dy; this.camera.position.y += dy;
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
    this.wolken.rotation.y += dt * .004;
    this.kuppel.position.copy(this.camera.position);
    this.sonne.position.set(t.x + 26, t.y + 32, t.z + 12); this.sonne.target.position.copy(t);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
