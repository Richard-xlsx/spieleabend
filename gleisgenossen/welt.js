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
const ZEIT = { value: 0 }, WIND = { value: 1 };
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
    sh.uniforms.uZeit = ZEIT; sh.uniforms.uWind = WIND;
    sh.vertexShader = "uniform float uZeit;\nuniform float uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * .37 + instanceMatrix[3].z * .51;
        float k = max(0., position.y - .3) * uWind;
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

// Zug-Formen: einmal gebaut, von allen Zügen geteilt (je Farbe ein zusammengefügtes Stück)
let ZF = null;
function zugFormen() {
  if (ZF) return ZF;
  const PI = Math.PI, B = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const X = (r1, r2, l, x, y, z, seg = 16) => new THREE.CylinderGeometry(r1, r2, l, seg).rotateZ(PI / 2).translate(x, y, z);     // Achse längs x
  const Y = (r1, r2, h, x, y, z, seg = 10) => new THREE.CylinderGeometry(r1, r2, h, seg).translate(x, y, z);
  const kuppel = (r, x, y, z) => new THREE.SphereGeometry(r, 10, 6, 0, 2 * PI, 0, PI / 2).translate(x, y, z);
  const bogen = (r, l, x, y, z, flach) => new THREE.CylinderGeometry(r, r, l, 12, 1, false, 0, PI).rotateZ(PI / 2).scale(1, flach, 1).translate(x, y, z);
  const zus = l => mergeGeometries(l.map(g => g.toNonIndexed()));
  const puffer = (x, s) => [X(.035, .035, .1, x + s * .05, .3, .2, 8), X(.06, .06, .02, x + s * .1, .3, .2, 10), X(.035, .035, .1, x + s * .05, .3, -.2, 8), X(.06, .06, .02, x + s * .1, .3, -.2, 10)];
  // Lok: Rahmen, Kessel mit Bändern und Domen, Rauchkammer mit Tür und Laterne, Schlot, Schienenräumer, Kohlenkasten
  const lok = {
    schwarz: zus([B(1.5, .12, .5, 0, .3, 0), X(.26, .26, .2, .58, .62, 0), Y(.075, .1, .3, .6, 1.0, 0), Y(.12, .12, .05, .6, 1.17, 0),
      ...puffer(.75, 1), ...puffer(-.75, -1)]),
    farbe: zus([B(.16, .3, .66, -.7, .5, 0), X(.25, .25, .72, .14, .62, 0), Y(.07, .09, .1, -.02, .88, 0), B(.86, .06, .06, .05, .38, .29), B(.86, .06, .06, .05, .38, -.29)]),
    messing: zus([X(.205, .205, .02, .685, .62, 0, 16), B(.03, .03, .12, .715, .62, 0), X(.262, .262, .035, -.12, .62, 0), X(.262, .262, .035, .14, .62, 0), X(.262, .262, .035, .42, .62, 0), kuppel(.11, .24, .85, 0), Y(.11, .11, .05, .24, .85, 0), Y(.02, .02, .1, -.1, .92, 0)]),
    dunkel: zus([X(.17, .17, .03, .695, .62, 0, 14), B(.2, .1, .6, -.7, .67, 0)]),
    rot: zus([B(.05, .14, .7, .76, .3, 0), B(.05, .14, .7, -.76, .3, 0)]),
    lampe: zus([X(.05, .05, .03, .72, .93, 0, 10)]),
    glas: zus([B(.012, .14, .12, -.21, .82, .2), B(.012, .14, .12, -.21, .82, -.2)])
  };
  lok.schwarz = zus([lok.schwarz, B(.08, .08, .08, .69, .93, 0)]);
  // Schienenräumer: schräge Keile vorne
  lok.schwarz = zus([lok.schwarz, B(.2, .04, .5, .84, .13, 0).rotateZ(-.5).translate(.03, .02, 0)]);
  // Führerhaus mit Fensteröffnungen (Wände als Rahmen) und gewölbtem Dach
  const kabine = { dach: zus([bogen(.4, .54, -.42, .97, 0, .3)]) };
  // Vorderwand: Fenster links und rechts frei lassen (Mitte und Ränder als Rahmen)
  kabine.farbe = zus([B(.44, .36, .66, -.42, .52, 0), B(.04, .26, .16, -.21, .83, 0), B(.04, .26, .07, -.21, .83, .3), B(.04, .26, .07, -.21, .83, -.3),
    B(.04, .26, .66, -.63, .83, 0), B(.07, .26, .04, -.6, .83, .31), B(.07, .26, .04, -.24, .83, .31), B(.07, .26, .04, -.6, .83, -.31), B(.07, .26, .04, -.24, .83, -.31),
    B(.44, .05, .7, -.42, .96, 0)]);
  // Treibrad: schwarzer Reifen, rote Scheibe, Speichen und Nabe (Farben im Modell, damit alle Räder ein Aufruf sind)
  const farbig = (g, f) => { g = g.toNonIndexed(); const c = new THREE.Color(f), a = []; for (let k = 0; k < g.attributes.position.count; k++) a.push(c.r, c.g, c.b); g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3)); return g; };
  const R = .18, radTeile = [farbig(new THREE.CylinderGeometry(R, R, .06, 18).rotateX(PI / 2), 0x2A2A35), farbig(new THREE.CylinderGeometry(R * .8, R * .8, .07, 16).rotateX(PI / 2), 0xB0302A)];
  for (let k = 0; k < 4; k++) radTeile.push(farbig(new THREE.BoxGeometry(R * 1.6, .025, .08).rotateZ(k * PI / 4), 0x2A2A35));
  radTeile.push(farbig(new THREE.CylinderGeometry(.04, .04, .09, 8).rotateX(PI / 2), 0xD9A440));
  const radPos = []; for (const x of [-.4, 0, .4]) for (const z of [.3, -.3]) radPos.push(new THREE.Vector3(x, R, z));
  const stangen = zus([B(.84, .035, .025, 0, R, .35), B(.84, .035, .025, 0, R, -.35), Y(.025, .025, .02, -.4, R, .36).rotateX(0)]);
  // Wagen (Länge 1,2): Fensterreihe, Türen, gewölbtes Dach, Puffer, Drehgestelle
  const fenster = []; for (const x of [-.27, -.09, .09, .27]) for (const z of [.322, -.322]) fenster.push(B(.13, .14, .012, x, .62, z));
  const wagen = {
    farbe: zus([B(1.08, .44, .64, 0, .53, 0)]),
    weiss: zus([B(1.1, .04, .66, 0, .73, 0), B(1.1, .03, .66, 0, .4, 0)]),
    dunkel: zus([B(.13, .3, .66, -.46, .52, 0), B(.13, .3, .66, .46, .52, 0)]),
    glas: zus(fenster),
    dach: zus([bogen(.36, 1.16, 0, .75, 0, .32)])
  };
  // Wagenräder: Zylinder mit Achse quer zur Fahrtrichtung
  wagen.schwarz = zus([B(1.12, .1, .5, 0, .26, 0), ...puffer(.56, 1), ...puffer(-.56, -1), B(.36, .08, .5, -.36, .17, 0), B(.36, .08, .5, .36, .17, 0),
    ...[-.48, -.24, .24, .48].flatMap(x => [.29, -.29].map(z => new THREE.CylinderGeometry(.13, .13, .05, 14).rotateX(PI / 2).translate(x, .13, z)))]);
  ZF = { lok, kabine, rad: mergeGeometries(radTeile), radMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, flatShading: true }), radPos, stangen, wagen };
  return ZF;
}

export class Welt {
  constructor(el) {
    this.el = el;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));     // mehr sieht man auf dem Handy kaum, kostet aber viel r.setSize(el.clientWidth || innerWidth, el.clientHeight || innerHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.shadowMap.autoUpdate = false;   // Schatten nur jedes zweite Bild
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
    c.addEventListener("start", () => { if (this.modus === "folgen") { this.modus = "frei"; if (this.onFolgenAus) this.onFolgenAus(); } });
    this.f = formen();
    ["gTerrain", "gDeko", "gLand", "gRaster", "gNetz", "gBauten", "gZug", "gMarke", "gRauch", "gSchweben", "gSchilder"].forEach(n => { this[n] = new THREE.Group(); sc.add(this[n]); });
    this.gRaster.visible = false; this.bau = false;
    this.drehteile = []; this.schwebende = [];
    this.himmel();
    this.rauch = [];
    const rg = new THREE.IcosahedronGeometry(.16, 0);
    for (let i = 0; i < 120; i++) { const m = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ color: 0xF4F4F6, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; this.gRauch.add(m); this.rauch.push({ m, alter: 9 }); }
    this.rNr = 0; this.rauchZeit = 0;
    const marke = this.marke = new THREE.Mesh(new THREE.RingGeometry(.62, .78, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFFD447, depthTest: false, transparent: true }));
    marke.scale.set(F * .92, 1, F * .92); marke.renderOrder = 9; marke.visible = false; this.gMarke.add(marke);
    this.zuege = {}; this.ich = null; this.modus = "frei"; this.ziel = null; this.onTap = null; this.onZug = null; this.onFolgenAus = null; this.S = null;
    this.blickRichtung = new THREE.Vector3(1, 0, 0); this.kino = null; this.tunnelWert = 0; this.fokus = new THREE.Vector3();
    const tb = this.tunnelEl = document.createElement("div"); tb.className = "tunnelblick"; tb.innerHTML = "<i></i><i></i>"; tb.style.opacity = 0; el.appendChild(tb);
    this.tippen();
    this.uhr = new THREE.Clock();
    addEventListener("resize", () => this.groesse());
    this.groesse();
    this.vorBild = null; this.onGrafik = null; this.bildNr = 0;
    this.stufe = "schoen"; this.grafikWahl = "auto"; this.mess = { t: 0, n: 0, warte: 3 };
    const schleife = () => { this.bild(); requestAnimationFrame(schleife); };
    requestAnimationFrame(schleife);
  }
  groesse() {
    const w = this.el.clientWidth || innerWidth, h = this.el.clientHeight || innerHeight;
    this.camera.aspect = w / h; this.renderer.setSize(w, h); this.sicht();
  }
  // Blickwinkel: beim Mitfahren und im Kino weiter, im Hochformat noch weiter
  sicht() {
    const hoch = this.camera.aspect < 1, m = this.modus;
    this.camera.fov = m === "mitfahren" ? (hoch ? 75 : 55) : m === "kino" ? (hoch ? 62 : 45) : 45;
    this.camera.updateProjectionMatrix();
  }
  // Grafikstufe: "schoen" oder "einfach"; wahl "auto" stellt bei Ruckeln selbst auf "einfach"
  grafik(wahl) {
    this.grafikWahl = wahl;
    this.stufeSetzen(wahl === "einfach" ? "einfach" : "schoen");
    this.mess = { t: 0, n: 0, warte: 3 };
  }
  stufeSetzen(st) {
    if (st === this.stufe) return;
    this.stufe = st; const einfach = st === "einfach", s = this.sonne;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, einfach ? 1.1 : 1.5)); this.groesse();
    s.shadow.mapSize.set(einfach ? 1024 : 2048, einfach ? 1024 : 2048); if (s.shadow.map) { s.shadow.map.dispose(); s.shadow.map = null; }
    WIND.value = einfach ? 0 : 1; this.wolken.visible = !einfach;
    if (this.S) this.deko(this.S);
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
  // Kamera: "frei", "folgen" (von oben hinterher), "mitfahren" (Führerstand), "kino" (wechselnde Blickwinkel)
  get folgen() { return this.modus === "folgen"; }
  kamera(modus, pid) {
    const vorher = this.modus;
    this.modus = modus; this.ziel = pid || this.ziel || this.ich;
    const fest = modus === "mitfahren" || modus === "kino";
    this.controls.enabled = !fest; this.gSchilder.visible = !fest;
    this.camera.near = modus === "mitfahren" ? .06 : .25; this.sicht(); 
    this.kino = null; this.kinoAlle = modus === "kino" && !pid;
    this.el.classList.toggle("kino", modus === "kino");
    if (modus === "mitfahren") { const z = this.zuege[this.ziel]; if (z) { const l = z.teile[0]; this.blickRichtung.set(Math.cos(l.rotation.y), 0, -Math.sin(l.rotation.y)); } }
    this.kabine(modus === "mitfahren");
    if (!fest && (vorher === "mitfahren" || vorher === "kino")) {
      const l = this.lokBei(this.ziel); this.tunnelWert = 0; this.tunnelEl.style.opacity = 0;
      if (l) this.blick(l.x, l.y, 22); else this.controls.update();
    }
    if (modus === "folgen") { const l = this.lokBei(this.ziel); if (l) this.blick(l.x, l.y, 22); }
  }
  // Im Führerstand das eigene Dach ausblenden, damit der Blick frei bleibt
  kabine(aus) { for (const pid in this.zuege) { const an = aus && pid === this.ziel; this.zuege[pid].kabine.forEach(m => m.visible = !an); } }
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
      if (e.target !== el || this.modus === "mitfahren" || this.modus === "kino") return;
      const r = el.getBoundingClientRect();
      let best = null;      // Zug in Fingernähe? (Weichen gehen vor, damit man sie auch unter dem Zug stellen kann)
      if (this.onZug && !this.bau) {
        let bd = 30; const v = new THREE.Vector3();
        for (const pid in this.zuege) for (const o of this.zuege[pid].teile) {
          v.copy(o.position); v.y += .5; v.project(this.camera); if (v.z > 1) continue;
          const dd = Math.hypot((v.x + 1) / 2 * r.width + r.left - e.clientX, (1 - v.y) / 2 * r.height + r.top - e.clientY);
          if (dd < bd) { bd = dd; best = pid; }
        }
      }
      if (!this.onTap && !best) return;
      maus.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(maus, this.camera);
      const o = ray.ray.origin, d = ray.ray.direction;
      let a = 0, b = -1;
      for (let t = .3; t < 700; t += .3) { if (boden(t, o, d) <= 0) { b = t; break; } a = t; }
      if (b < 0) { if (best) this.onZug(best); return; }
      for (let k = 0; k < 12; k++) { const m = (a + b) / 2; if (boden(m, o, d) <= 0) b = m; else a = m; }
      boden(b, o, d);
      const c = Math.floor(p.x / F + G.B / 2), rr = Math.floor(p.z / F + G.H / 2);
      const i = c >= 0 && rr >= 0 && c < G.B && rr < G.H ? rr * G.B + c : -1, gl = i >= 0 && this.S && this.S.gleise[i];
      if (best && !(gl && gl.t === "s")) this.onZug(best);
      else if (i >= 0 && this.onTap) this.onTap(i);
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
      if (K.g[i] !== "." || S.gleise[i] || S.bauten[i] || (this.stufe === "einfach" && i % 2)) continue;
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
    leeren(this.gLand); leeren(this.gRaster); leeren(this.gSchilder);
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
      sp.position.set(this.wx(x), this.hy(x, y) + 3, this.wz(y)); this.gSchilder.add(sp);
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
    const farbe = S.spieler[pid] ? S.spieler[pid].farbe : 0, z = S.zuege[pid], n = 1 + z.stufen.wagen, teile = [];
    const zf = zugFormen(), eigen = mat(new THREE.Color(G.FARBEN[farbe]).getHex());
    const M = { schwarz: mat(0x2A2A35), farbe: eigen, messing: mat(0xD9A440, { roughness: .45, metalness: .5 }), dunkel: mat(0x3A3A48), rot: mat(0xB0302A),
      glas: mat(0xBFE3F2, { roughness: .2 }), lampe: mat(0xFFF2B0, { emissive: 0xFFD87A, emissiveIntensity: .9 }), dach: mat(0x3D3868), weiss: mat(0xF3F0FF) };
    const stueck = (g, geo, m, schatten = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = schatten; g.add(o); return o; };
    // Lok (Länge 1,6, vorne = +x): Teile gleicher Farbe sind zu einem Stück zusammengefügt
    const lok = new THREE.Group();
    for (const k in zf.lok) stueck(lok, zf.lok[k], M[k], k !== "glas" && k !== "lampe");
    const kabine = [stueck(lok, zf.kabine.farbe, eigen), stueck(lok, zf.kabine.dach, M.schwarz)];
    const raeder = new THREE.InstancedMesh(zf.rad, zf.radMat, zf.radPos.length); raeder.castShadow = true; lok.add(raeder);
    const stangen = stueck(lok, zf.stangen, M.messing, false);
    this.gZug.add(lok); teile.push(lok);
    for (let k = 0; k < n; k++) {
      const w = new THREE.Group();
      for (const t in zf.wagen) stueck(w, zf.wagen[t], t === "farbe" ? mat(WAGENFARBE[(k + farbe) % WAGENFARBE.length]) : M[t], t !== "glas");
      this.gZug.add(w); teile.push(w);
    }
    this.zuege[pid] = { teile, farbe, rauch: Math.random() * .3, kabine, raeder, stangen, winkel: Math.random() * 6 };
    this.raederDrehen(this.zuege[pid]);
    if (this.modus === "mitfahren") this.kabine(true);
  }
  // Treibräder drehen sich, die Kuppelstangen laufen im Kreis mit
  raederDrehen(zz) {
    const zf = zugFormen(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Vector3(1, 1, 1), ach = new THREE.Vector3(0, 0, 1);
    q.setFromAxisAngle(ach, -zz.winkel);
    zf.radPos.forEach((p, k) => { m.compose(p, q, e); zz.raeder.setMatrixAt(k, m); });
    zz.raeder.instanceMatrix.needsUpdate = true;
    zz.stangen.position.set(Math.cos(-zz.winkel) * .07, Math.sin(-zz.winkel) * .07, 0);
  }
  // Lok eines Spielers in Feldkoordinaten (für Kamera und Texte)
  lokBei(pid) { const z = this.S && this.S.zuege[pid]; if (!z) return null; const l = G.wagenlage(z)[0]; return { x: l.x, y: l.y }; }

  // ---------- Mitfahren ----------
  fahrKamera(dt) {
    const S = this.S, z = S.zuege[this.ziel], zz = this.zuege[this.ziel];
    if (!z || !zz) { this.kamera("frei"); if (this.onFolgenAus) this.onFolgenAus(); return; }
    const lok = zz.teile[0], cam = this.camera; lok.updateMatrixWorld();
    cam.position.set(-.64, 1.13, .2).applyMatrix4(lok.matrixWorld);
    // Blick auf einen Punkt voraus auf dem Gleis: schaut in Kurven hinein, neigt sich mit der Steigung (gedämpft)
    // waagerecht zum Punkt voraus, geneigt nur nach der Steigung, damit der Horizont auch in engen Kurven ruhig bleibt
    const p = G.vorne(S, this.ziel, 1.5), ziel = new THREE.Vector3(this.wx(p.x) - cam.position.x, 0, this.wz(p.y) - cam.position.z);
    const dist = Math.max(3, ziel.length()); ziel.normalize();
    ziel.x += Math.cos(lok.rotation.y) * 1.5; ziel.z -= Math.sin(lok.rotation.y) * 1.5; ziel.normalize();   // halb in Fahrtrichtung, Kessel bleibt im Bild
    ziel.y = (wy(p.h) + 1.06 - cam.position.y) / dist - (cam.aspect < 1 ? .3 : .08); ziel.normalize();
    const jetzt = performance.now(), echt = Math.min(.5, (jetzt - (this.fahrZeit || jetzt)) / 1000); this.fahrZeit = jetzt;   // echte Zeit, auch bei wenigen Bildern
    if (this.blickRichtung.dot(ziel) < .3) this.blickRichtung.copy(ziel); else this.blickRichtung.lerp(ziel, Math.min(1, echt * 4)).normalize();
    this.fokus.copy(cam.position).addScaledVector(this.blickRichtung, 14);
    cam.lookAt(this.fokus);
    // Tunnel: innen dunkel, Lampen ziehen vorbei
    const feld = (x, y) => { x = Math.floor(x / F + G.B / 2); y = Math.floor(y / F + G.H / 2); const i = y * G.B + x; return x >= 0 && y >= 0 && x < G.B && y < G.H && S.karte.g[i] === "b" && S.gleise[i]; };
    const soll = feld(cam.position.x, cam.position.z) ? 1 : S.karte.g[z.seg.i] === "b" ? .55 : 0;
    this.tunnelWert += (soll - this.tunnelWert) * Math.min(1, dt * 9);
    this.tunnelEl.style.opacity = this.tunnelWert < .01 ? 0 : this.tunnelWert.toFixed(2);
    this.tunnelEl.style.setProperty("--takt", (z.v > .05 ? Math.min(3, 1.1 / z.v) : 0) + "s");
    this.tunnelEl.classList.toggle("steht", z.v <= .05);
  }
  // ---------- Kino: wechselnde Einstellungen, für den Fernseher ----------
  kinoKamera(dt) {
    const S = this.S, pids = Object.keys(this.zuege).filter(p => S.zuege[p]);
    if (!pids.length) return;
    let k = this.kino;
    const lokVon = pid => this.zuege[pid].teile[0];
    if (!k || !S.zuege[k.pid] || !this.zuege[k.pid]) k = null;
    if (k) {
      k.zeit = (performance.now() - k.seit) / 1000;
      const lok = lokVon(k.pid), weit = k.fest && this.camera.position.distanceTo(lok.position) > 22;
      if (k.zeit > k.dauer || weit) k = null;
    }
    if (!k) k = this.kino = this.einstellung(pids);
    const lok = lokVon(k.pid), c = Math.cos(lok.rotation.y), s = Math.sin(lok.rotation.y), cam = this.camera;
    const lokal = (x, y, z) => new THREE.Vector3(lok.position.x + x * c + z * s, lok.position.y + y, lok.position.z - x * s + z * c);
    if (!k.fest) {
      const soll = k.art === "hinterher" ? lokal(-7, 2.6, -1.2) : k.art === "seite" ? lokal(.6, 1.1, k.seite * 3.4) : lokal(-2, 9, k.seite * 7);
      if (!k.da) { cam.position.copy(soll); k.da = true; } else cam.position.lerp(soll, Math.min(1, dt * (k.art === "seite" ? 4 : 1.6)));
    }
    const boden = this.hy(cam.position.x / F + G.B / 2, cam.position.z / F + G.H / 2) + .45;
    if (cam.position.y < boden) cam.position.y = boden;
    const blick = k.art === "hinterher" ? lokal(3, .6, 0) : lokal(.4, .55, 0);
    if (!k.blick) k.blick = blick.clone(); else k.blick.lerp(blick, Math.min(1, dt * 4));
    cam.lookAt(k.blick); this.fokus.copy(k.blick);
  }
  einstellung(pids) {
    const alt = this.kino, S = this.S;
    let pid = alt ? alt.pid : this.ziel;
    if (this.kinoAlle && pids.length > 1 && alt && (alt.nr + 1) % 3 === 0) pid = pids[(pids.indexOf(alt.pid) + 1) % pids.length];
    if (!pids.includes(pid)) pid = pids[0];
    const nr = alt ? alt.nr + 1 : 0, z = S.zuege[pid], arten = ["gleis", "hinterher", "seite", "hoch", "gleis", "seite"];
    let art = arten[nr % arten.length];
    const k = { pid, nr, art, zeit: 0, seit: performance.now(), dauer: 6 + Math.random() * 3, seite: Math.random() < .5 ? -1 : 1, fest: false };
    if (art === "gleis" && z.v < .1) art = k.art = "seite";        // steht der Zug, lieber von der Seite
    if (art === "gleis" || art === "hoch") {
      // fester Punkt neben der Strecke voraus; gern an einer Brücke oder auf einem Hügel
      let d = art === "hoch" ? 7 : 4.5, p = G.vorne(S, pid, d);
      for (let dd = 2; dd < 12; dd++) { const q = G.vorne(S, pid, dd); if (S.karte.g[q.i] === "~") { p = q; d = dd; k.bruecke = true; break; } }
      const q = G.vorne(S, pid, d + .3), lx = q.x - p.x, ly = q.y - p.y, l = Math.hypot(lx, ly) || 1;
      const ab = art === "hoch" ? 6 : k.bruecke ? 2.2 : 1.3, x = p.x - ly / l * ab * k.seite, y = p.y + lx / l * ab * k.seite;
      const h = art === "hoch" ? this.hy(x, y) + 5.5 : k.bruecke ? WASSER + .3 : Math.max(this.hy(x, y), wy(p.h)) + .55;
      this.camera.position.set(this.wx(x), h, this.wz(y)); k.fest = true; k.dauer += 3;
    }
    return k;
  }

  // ---------- jedes Bild ----------
  bild() {
    const roh = this.uhr.getDelta(), dt = Math.min(.05, roh);
    // Bildrate messen: läuft es bei "auto" dauerhaft unter etwa 40 Bildern pro Sekunde, auf "einfach" schalten
    const m = this.mess;
    if (this.S && this.grafikWahl === "auto" && this.stufe === "schoen" && roh < 1 && !document.hidden) {
      if (m.warte > 0) m.warte -= roh;
      else { m.t += roh; m.n++; if (m.t > 4) { if (m.t / m.n > 1 / 40) { this.stufeSetzen("einfach"); if (this.onGrafik) this.onGrafik("einfach"); } m.t = 0; m.n = 0; } }
    }
    if (++this.bildNr % 2 === 0 || this.bildNr < 3) this.renderer.shadowMap.needsUpdate = true;
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
      if (v > 0) { zz.winkel += v * F / .18 * dt; this.raederDrehen(zz); }
      // Rauch aus dem Schlot
      zz.rauch -= dt;
      if (zz.rauch <= 0) {
        zz.rauch = v > .05 ? Math.max(.06, .3 - v * .1) : .9;
        const r = this.rauch[this.rNr++ % this.rauch.length], c = Math.cos(lok.rotation.y), s = Math.sin(lok.rotation.y);
        r.m.position.set(lok.position.x + .6 * c, lok.position.y + 1.25, lok.position.z - .6 * s); r.alter = 0; r.m.visible = true; r.m.scale.setScalar(.6);
      }
      if (this.modus === "folgen" && pid === this.ziel) {
        const t = this.controls.target, k = Math.min(1, dt * 3), dx = (lok.position.x - t.x) * k, dy = (lok.position.y - .1 - t.y) * k, dz = (lok.position.z - t.z) * k;
        t.x += dx; t.y += dy; t.z += dz; this.camera.position.x += dx; this.camera.position.y += dy; this.camera.position.z += dz;
      }
    }
    // Beim Verschieben der Karte die Kamera sanft der Geländehöhe nachführen
    const t = this.controls.target;
    if (S && this.modus === "mitfahren") this.fahrKamera(dt);
    else if (S && this.modus === "kino") this.kinoKamera(dt);
    if (S && this.modus === "frei") {
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
    const fk = this.controls.enabled ? t : this.fokus;
    this.sonne.position.set(fk.x + 26, fk.y + 32, fk.z + 12); this.sonne.target.position.copy(fk);
    if (this.controls.enabled) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
