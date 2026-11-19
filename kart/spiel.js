// Campus-Rallye (Arbeitstitel), Schritt 1: eine Strecke allein oder gegen Übungsgegner fahren.
// Lenken durch Neigen des Handys im Querformat (wie ein Lenkrad) oder mit Tasten.
import * as THREE from "three";

const $ = id => document.getElementById(id);
const RUNDEN = 3;
const AUTO = new URLSearchParams(location.search).has("auto");   // Test: eigenes Kart fährt selbst
const BR = 12;                      // Fahrbahnbreite
const RAND = BR / 2 + 1.3;          // ab hier Wiese (langsamer)
const HECKE = BR / 2 + 8;           // hier ist Schluss
const lager = { lesen(k) { try { return localStorage.getItem(k); } catch { return null; } }, schreiben(k, v) { try { localStorage.setItem(k, v); } catch {} } };

// ---------- Fahrzeuge ----------
const FAHRZEUGE = {
  bobbycar: { name: "Bobbycar", emoji: "🚗", maxV: 27, accel: 15, turn: 1.95, grip: 10, drift: 1.35, masse: 1, text: "ausgewogen" },
  stuhl: { name: "Bürostuhl", emoji: "🪑", maxV: 25.5, accel: 17, turn: 2.25, grip: 9, drift: 1.6, masse: .8, text: "wendig, driftet stark" },
  wagen: { name: "Einkaufswagen", emoji: "🛒", maxV: 27.5, accel: 11, turn: 1.7, grip: 11, drift: 1.25, masse: 1.8, text: "schwer, schiebt weg" },
  boller: { name: "Bollerwagen", emoji: "🛞", maxV: 29, accel: 13, turn: 1.8, grip: 6, drift: 1.3, masse: 1.2, text: "schnell, rutschig" },
};

// ---------- Szene ----------
const r = new THREE.WebGLRenderer({ antialias: true });
r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(r.domElement);
const sc = new THREE.Scene();
sc.background = new THREE.Color("#8FD0F5"); sc.fog = new THREE.Fog("#BFE3F7", 90, 260);
const cam = new THREE.PerspectiveCamera(62, 1, .1, 600);
sc.add(new THREE.HemisphereLight("#ffffff", "#7BBF5A", 1.6));
const sonne = new THREE.DirectionalLight("#fff4e0", 2.1);
sonne.castShadow = true; sonne.shadow.mapSize.set(1024, 1024);
Object.assign(sonne.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
sc.add(sonne, sonne.target);
const matCache = new Map();
const M = c => { if (!matCache.has(c)) matCache.set(c, new THREE.MeshLambertMaterial({ color: c })); return matCache.get(c); };
function groesse() { const w = innerWidth, h = innerHeight; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }
addEventListener("resize", groesse); groesse();

const boden = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M("#86C866"));
boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true; sc.add(boden);

// ---------- Strecke ----------
const KP = [[0, 0], [90, -6], [150, -46], [168, -120], [128, -178], [52, -184], [14, -140], [-26, -112], [-84, -136],
  [-138, -112], [-150, -46], [-110, -4], [-60, 12]];
const kurve = new THREE.CatmullRomCurve3(KP.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "catmullrom", .5);
const S = 3000;
const PX = new Float32Array(S), PZ = new Float32Array(S), TX = new Float32Array(S), TZ = new Float32Array(S);
for (let i = 0; i < S; i++) {
  const p = kurve.getPointAt(i / S), t = kurve.getTangentAt(i / S);
  PX[i] = p.x; PZ[i] = p.z; TX[i] = t.x; TZ[i] = t.z;
}
const nX = i => -TZ[i], nZ = i => TX[i];      // Normale (seitlich)
const wrap = i => ((i % S) + S) % S;
const LAENGE = kurve.getLength();

// Treppe vor dem Hörsaal: Rampe zum Springen
const R0 = Math.round(S * .335), R1 = Math.round(S * .348), RH = 2.1;
function hoehe(i, d) {
  if (i >= R0 && i <= R1 && Math.abs(d) < BR / 2 + 1.3) return RH * (i - R0) / (R1 - R0);
  return 0;
}

function band(innen, aussen, farbe, y, von = 0, bis = S, hFn) {
  const pos = [], col = [], c = new THREE.Color();
  for (let i = von; i < bis; i++) {
    const a = wrap(i), b = wrap(i + 1);
    const ya = y + (hFn ? hFn(a) : 0), yb = y + (hFn ? hFn(b) : 0);
    const P = (k, d, yy) => [PX[k] + nX(k) * d, yy, PZ[k] + nZ(k) * d];
    const q = [P(a, innen, ya), P(a, aussen, ya), P(b, aussen, yb), P(b, innen, yb)];
    pos.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
    c.set(farbe(i)); for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  m.receiveShadow = true; sc.add(m); return m;
}
const STRICH = Math.round(S * 4 / LAENGE);   // Strich etwa 4 m
band(-BR / 2, BR / 2, () => "#6B6560", .02);
band(-.18, .18, i => (Math.floor(i / STRICH) % 2 ? "#6B6560" : "#FFFFFF"), .03);
band(BR / 2, BR / 2 + 1.3, i => (Math.floor(i / (STRICH * .6)) % 2 ? "#FFFFFF" : "#E23B2E"), .05);
band(-BR / 2 - 1.3, -BR / 2, i => (Math.floor(i / (STRICH * .6)) % 2 ? "#FFFFFF" : "#E23B2E"), .05);
// Rampe als Treppe: Stufenstreifen
const rampe = band(-BR / 2 - 1.3, BR / 2 + 1.3, i => (Math.floor((i - R0) / 3) % 2 ? "#CFC4B2" : "#B8AC98"), .06, R0, R1, k => hoehe(k, 0));
{ // Vorderkante der Treppe
  const k = R1, w = BR + 2.6, g = new THREE.Mesh(new THREE.BoxGeometry(w, RH, .4), M("#9C907E"));
  g.position.set(PX[k], RH / 2, PZ[k]); g.rotation.y = Math.atan2(TX[k], TZ[k]); sc.add(g);
  for (const s of [-1, 1]) { // Geländer
    const gl = new THREE.Mesh(new THREE.BoxGeometry(.25, 1.1, (R1 - R0) * LAENGE / S), M("#5C6B7A"));
    const m = Math.round((R0 + R1) / 2); gl.position.set(PX[m] + nX(m) * s * (BR / 2 + 1.5), RH / 2 + .9, PZ[m] + nZ(m) * s * (BR / 2 + 1.5));
    gl.rotation.y = Math.atan2(TX[m], TZ[m]); gl.rotation.x = -Math.atan2(RH, (R1 - R0) * LAENGE / S) * Math.sign(1); sc.add(gl);
  }
}
// Start/Ziel-Linie
for (let k = 0; k < BR; k++) for (let j = 0; j < 2; j++) {
  const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M((k + j) % 2 ? "#FFFFFF" : "#16161D"));
  q.rotation.x = -Math.PI / 2; q.rotation.z = Math.atan2(TX[0], TZ[0]);
  const d = -BR / 2 + .5 + k, f = j - .5;
  q.position.set(PX[0] + nX(0) * d + TX[0] * f, .07, PZ[0] + nZ(0) * d + TZ[0] * f); sc.add(q);
}
{ // Startbogen
  const d = BR / 2 + 2.2;
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.6, 6, .6), M("#2A1A12")); p.position.set(PX[0] + nX(0) * d * s, 3, PZ[0] + nZ(0) * d * s); p.castShadow = true; sc.add(p); }
  const b = new THREE.Mesh(new THREE.BoxGeometry(d * 2 + .6, 1.4, .4), schildMat("START · ZIEL", "#E23B2E", "#fff", 1024, 96));
  b.position.set(PX[0], 6, PZ[0]); b.rotation.y = Math.atan2(TX[0], TZ[0]) + Math.PI; sc.add(b);
}

function schildMat(text, bg, fg, w = 512, h = 128) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const x = cv.getContext("2d"); x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = fg; x.font = `900 ${Math.round(h * .62)}px Unbounded, system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return [M(bg), M(bg), M(bg), M(bg), new THREE.MeshLambertMaterial({ map: t }), new THREE.MeshLambertMaterial({ map: t })];
}

// ---------- Umgebung ----------
const neben = (t, d) => { const i = wrap(Math.round(t * S)); return { x: PX[i] + nX(i) * d, z: PZ[i] + nZ(i) * d, rot: Math.atan2(TX[i], TZ[i]) }; };
function frei(x, z, abstand) {
  for (let i = 0; i < S; i += 6) if ((PX[i] - x) ** 2 + (PZ[i] - z) ** 2 < abstand * abstand) return false;
  return true;
}
const belegt = [];
function haus(t, seite, w, h, d, farbe, dach, schild) {
  const abst = HECKE + 3 + d / 2, p = neben(t, seite * abst);
  const g = new THREE.Group();
  const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(farbe)); k.position.y = h / 2; k.castShadow = k.receiveShadow = true; g.add(k);
  const dm = new THREE.Mesh(new THREE.BoxGeometry(w + .8, .8, d + .8), M(dach)); dm.position.y = h + .4; g.add(dm);
  const fen = M("#9CD4F2");
  for (let i = 0; i < Math.floor((w - 2) / 3.6); i++) for (let j = 0; j < Math.floor((h - 2) / 3.4); j++) {
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), fen); f.position.set(-w / 2 + 2.6 + i * 3.6, 2.2 + j * 3.4, s * (d / 2 + .02)); if (s < 0) f.rotation.y = Math.PI; g.add(f); }
  }
  if (schild) {
    const sl = schild.length * 1.25 + 2, b = new THREE.Mesh(new THREE.BoxGeometry(sl, 2, .3), schildMat(schild, "#FFF6E6", "#2A1A12", 1024, 160));
    b.position.set(0, h + 1.8, 0); g.add(b);
    const b2 = b.clone(); b2.rotation.y = Math.PI; b2.position.z = .01; g.add(b2);
  }
  g.position.set(p.x, 0, p.z); g.rotation.y = p.rot + Math.PI / 2; sc.add(g);
  belegt.push({ x: p.x, z: p.z, r: Math.hypot(w, d) / 2 + 2 });
  return g;
}
haus(.97, 1, 26, 8, 12, "#E9B97A", "#E8692E", "MENSA");
haus(.34, 1, 40, 13, 16, "#D9CBB4", "#9A5A26", "HÖRSAAL");
haus(.16, -1, 18, 18, 14, "#C9D3DE", "#5C6B7A", "BIBLIOTHEK");
haus(.53, 1, 22, 10, 14, "#F1C27D", "#8B5A2B", "WOHNHEIM");
haus(.73, -1, 16, 9, 22, "#E5DDF5", "#6A5ACD", "LABOR");
{ // Brunnen in der Mitte
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.5, 1.2, 28), M("#B8AC98")); b.position.y = .6; g.add(b);
  const w = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.2, .3, 28), M("#5A9BE0")); w.position.y = 1.1; g.add(w);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(.8, 1.2, 4, 12), M("#B8AC98")); s.position.y = 2.4; g.add(s);
  const f = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), new THREE.MeshLambertMaterial({ color: "#BFE6FF", transparent: true, opacity: .7 })); f.position.y = 4.6; g.add(f);
  g.traverse(o => o.castShadow = true); g.position.set(10, 0, -90); sc.add(g); belegt.push({ x: 10, z: -90, r: 12 });
}
// Hecke am Rand (Instanzen)
{
  const n = Math.floor(LAENGE / 2.2) * 2, geo = new THREE.BoxGeometry(2.4, 1.2, 1.3);
  const im = new THREE.InstancedMesh(geo, M("#3E8E45"), n), o = new THREE.Object3D(); let k = 0;
  for (let j = 0; j < n / 2; j++) {
    const i = Math.floor(j * S / (n / 2));
    if (i >= R0 - 8 && i <= R1 + 4) continue;
    for (const s of [-1, 1]) {
      const d = s * (HECKE + .7); o.position.set(PX[i] + nX(i) * d, .6, PZ[i] + nZ(i) * d); o.rotation.set(0, Math.atan2(TX[i], TZ[i]) + Math.PI / 2, 0); o.updateMatrix();
      im.setMatrixAt(k++, o.matrix);
    }
  }
  im.count = k; im.receiveShadow = true; sc.add(im);
}
// Bäume
{
  const st = [], kr = [];
  let seed = 7; const zufall = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 900 && st.length < 170; n++) {
    const x = -220 + zufall() * 440, z = -260 + zufall() * 330;
    if (!frei(x, z, HECKE + 4)) continue;
    if (belegt.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + 3) ** 2)) continue;
    const s = .8 + zufall() * .7; st.push([x, z, s]);
  }
  const geoS = new THREE.CylinderGeometry(.35, .45, 2.4), geoK = new THREE.IcosahedronGeometry(2.3, 0);
  const iS = new THREE.InstancedMesh(geoS, M("#8B5A2B"), st.length), iK = new THREE.InstancedMesh(geoK, M("#3E9B4F"), st.length), o = new THREE.Object3D();
  st.forEach(([x, z, s], i) => {
    o.position.set(x, 1.2 * s, z); o.scale.setScalar(s); o.rotation.set(0, i, 0); o.updateMatrix(); iS.setMatrixAt(i, o.matrix);
    o.position.y = 3.7 * s; o.updateMatrix(); iK.setMatrixAt(i, o.matrix);
  });
  iS.castShadow = iK.castShadow = true; sc.add(iS, iK);
}
// Bänke an der Start-Geraden
for (let i = 0; i < 5; i++) { const p = neben(.02 + i * .012, -(BR / 2 + 3.5)); const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, .55, .9), M("#2F6FDE")); b.position.set(p.x, .6, p.z); b.rotation.y = p.rot + Math.PI / 2; b.castShadow = true; sc.add(b); }

// ---------- Kart-Modelle (Front zeigt nach +z) ----------
function fahrer(farbe, haar) {
  const g = new THREE.Group();
  const kp = new THREE.Mesh(new THREE.CapsuleGeometry(.42, .5, 4, 10), M(farbe)); kp.position.y = .55; g.add(kp);
  const ko = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 12), M("#F1C27D")); ko.position.y = 1.35; g.add(ko);
  const h = new THREE.Mesh(new THREE.SphereGeometry(.45, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(haar)); h.position.y = 1.4; g.add(h);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .5, 3, 6), M(farbe)); arm.position.set(s * .38, .75, .35); arm.rotation.x = 1.2; g.add(arm);
    const au = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 6), M("#16161D")); au.position.set(s * .15, 1.42, .38); g.add(au);
  }
  return g;
}
function rad(g, x, z, rr = .38) {
  const w = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, .3, 14), M("#2A2A2A")); w.rotation.z = Math.PI / 2; w.position.set(x, rr, z);
  const nabe = new THREE.Mesh(new THREE.BoxGeometry(.32, rr * 1.2, .12), M("#BBBBBB")); w.add(nabe);
  g.add(w); g.userData.raeder.push(w);
}
const MODELLE = {
  bobbycar(farbe, kl) {
    const g = new THREE.Group(); g.userData.raeder = [];
    const k = new THREE.Mesh(new THREE.BoxGeometry(1.3, .55, 2.4), M(farbe)); k.position.y = .6; g.add(k);
    const n = new THREE.Mesh(new THREE.BoxGeometry(1.1, .5, .7), M(farbe)); n.position.set(0, .95, 1); g.add(n);
    const lk = new THREE.Mesh(new THREE.TorusGeometry(.3, .06, 6, 16), M("#2A1A12")); lk.position.set(0, 1.4, .95); lk.rotation.x = -1.1 + Math.PI; g.add(lk);
    rad(g, -.75, -.8); rad(g, .75, -.8); rad(g, -.75, .85); rad(g, .75, .85);
    const f = fahrer(kl[0], kl[1]); f.position.set(0, .7, -.25); g.add(f); return g;
  },
  stuhl(farbe, kl) {
    const g = new THREE.Group(); g.userData.raeder = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const b = new THREE.Mesh(new THREE.BoxGeometry(.12, .1, .9), M("#333")); b.position.set(Math.sin(a) * .45, .25, Math.cos(a) * .45); b.rotation.y = a; g.add(b); rad(g, Math.sin(a) * .9, Math.cos(a) * .9, .16); }
    const s = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .6), M("#555")); s.position.y = .55; g.add(s);
    const sitz = new THREE.Mesh(new THREE.BoxGeometry(1.2, .25, 1.1), M(farbe)); sitz.position.y = .9; g.add(sitz);
    const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, .2), M(farbe)); l.position.set(0, 1.6, -.55); g.add(l);
    const f = fahrer(kl[0], kl[1]); f.position.set(0, .95, 0); g.add(f); return g;
  },
  wagen(farbe, kl) {
    const g = new THREE.Group(); g.userData.raeder = [];
    const k = new THREE.Mesh(new THREE.BoxGeometry(1.3, .9, 1.9, 4, 3, 6), new THREE.MeshLambertMaterial({ color: "#B8C4D1", wireframe: true })); k.position.y = 1; g.add(k);
    const bo = new THREE.Mesh(new THREE.BoxGeometry(1.3, .05, 1.9), M("#8C99A8")); bo.position.y = .56; g.add(bo);
    const gr = new THREE.Mesh(new THREE.BoxGeometry(1.4, .12, .12), M(farbe)); gr.position.set(0, 1.6, -1.05); g.add(gr);
    rad(g, -.55, -.8, .2); rad(g, .55, -.8, .2); rad(g, -.55, .8, .2); rad(g, .55, .8, .2);
    const f = fahrer(kl[0], kl[1]); f.position.set(0, .6, -.1); g.add(f); return g;
  },
  boller(farbe, kl) {
    const g = new THREE.Group(); g.userData.raeder = [];
    const k = new THREE.Mesh(new THREE.BoxGeometry(1.4, .6, 2.4), M(farbe)); k.position.y = .75; g.add(k);
    const d = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, 1.4), M("#333")); d.position.set(0, .9, 1.8); d.rotation.x = -.4; g.add(d);
    rad(g, -.8, -.8, .45); rad(g, .8, -.8, .45); rad(g, -.8, .8, .45); rad(g, .8, .8, .45);
    const f = fahrer(kl[0], kl[1]); f.position.set(0, .8, -.3); g.add(f); return g;
  },
};
const FARBEN = { bobbycar: ["#E23B2E", ["#2F6FDE", "#E86FB0"]], stuhl: ["#2F6FDE", ["#F97316", "#16161D"]], wagen: ["#E23B2E", ["#2E9B4F", "#8B5A2B"]], boller: ["#8B5A2B", ["#8B5CF6", "#F2B705"]] };

// ---------- Kart ----------
const funkenGeo = new THREE.SphereGeometry(.13, 6, 4);
class Kart {
  constructor(typ, name, istIch) {
    this.typ = typ; this.st = FAHRZEUGE[typ]; this.name = name; this.ich = istIch;
    const [fa, kl] = FARBEN[typ];
    this.g = new THREE.Group(); this.koerper = MODELLE[typ](fa, kl); this.g.add(this.koerper);
    this.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const schatten = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: .22, depthWrite: false }));
    schatten.rotation.x = -Math.PI / 2; this.schatten = schatten; sc.add(schatten);
    this.funken = [];
    for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(funkenGeo, new THREE.MeshBasicMaterial({ color: "#F2B705" })); f.visible = false; this.g.add(f); this.funken.push(f); }
    this.flamme = new THREE.Mesh(new THREE.ConeGeometry(.35, 1.4, 8), new THREE.MeshBasicMaterial({ color: "#F97316", transparent: true, opacity: .85 }));
    this.flamme.rotation.x = -Math.PI / 2; this.flamme.position.set(0, .7, -1.8); this.flamme.visible = false; this.g.add(this.flamme);
    sc.add(this.g);
  }
  setzen(i, d) {
    this.x = PX[i] + nX(i) * d; this.z = PZ[i] + nZ(i) * d; this.y = 0; this.vy = 0; this.luft = false;
    this.yaw = this.mh = Math.atan2(TX[i], TZ[i]); this.v = 0; this.s = 0;
    this.idx = i; this.prog = i > S / 2 ? i - S : i; this.d = d;
    this.boost = 0; this.drift = 0; this.ladung = 0; this.item = null; this.fertig = null; this.runden = []; this.rundeStart = 0;
    this.botTimer = 0; this.spur = d; this.dreher = 0;
  }
  naechster() {
    let best = Infinity, bi = this.idx;
    for (let k = -40; k <= 40; k++) { const i = wrap(this.idx + k), dx = this.x - PX[i], dz = this.z - PZ[i], q = dx * dx + dz * dz; if (q < best) { best = q; bi = i; } }
    let delta = bi - this.idx; if (delta > S / 2) delta -= S; if (delta < -S / 2) delta += S;
    this.prog += delta; this.idx = bi;
    this.d = (this.x - PX[bi]) * nX(bi) + (this.z - PZ[bi]) * nZ(bi);
  }
  schritt(dt, ein) {
    const st = this.st;
    const offroad = Math.abs(this.d) > RAND && !this.luft;
    if (this.boost > 0) this.boost -= dt;
    if (this.dreher > 0) this.dreher -= dt;
    let maxV = st.maxV * (offroad ? .5 : 1);
    if (this.boost > 0) maxV = st.maxV * 1.4;
    if (ein.gas === false || this.dreher > 0) maxV = 0;
    if (!this.luft) this.v += Math.max(-30 * dt, Math.min(st.accel * dt * (this.boost > 0 ? 3 : 1), maxV - this.v));
    // Lenken (für Tasten geglättet)
    this.s += (ein.lenk - this.s) * Math.min(1, dt * (ein.direkt ? 30 : 9));
    // Drift
    if (!this.drift && ein.drift && Math.abs(this.s) > .25 && this.v > 14 && !this.luft) { this.drift = Math.sign(this.s); this.ladung = 0; }
    if (this.drift && (!ein.drift || this.v < 9)) {
      if (this.ladung > 1.7) this.boost = Math.max(this.boost, 1.2); else if (this.ladung > .8) this.boost = Math.max(this.boost, .6);
      this.drift = 0; this.ladung = 0;
    }
    let s = this.s, wende = st.turn;
    if (this.drift) { s = this.drift * .6 + this.s * .5; wende *= st.drift; this.ladung += dt * (.6 + Math.abs(s) * .6); }
    let rate = -s * wende * Math.min(1, this.v / 10) * (this.luft ? .35 : 1);
    if (this.dreher > 0) rate = 9;
    this.yaw += rate * dt;
    const k = this.drift ? 2.6 : st.grip;
    let diff = this.yaw - this.mh; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.mh += diff * (1 - Math.exp(-k * dt));
    if (this.dreher > 0) this.mh = this.mhFest;
    this.x += Math.sin(this.mh) * this.v * dt; this.z += Math.cos(this.mh) * this.v * dt;
    this.naechster();
    // Hecke
    if (Math.abs(this.d) > HECKE) {
      const zu = Math.abs(this.d) - HECKE, sg = Math.sign(this.d);
      this.x -= nX(this.idx) * sg * zu; this.z -= nZ(this.idx) * sg * zu; this.d = sg * HECKE;
      this.v *= Math.max(0, 1 - 3 * dt); this.yaw -= sg * .9 * dt * Math.sign(Math.cos(this.mh - Math.atan2(TX[this.idx], TZ[this.idx])));
    }
    // Höhe / Sprung
    const g = hoehe(this.idx, this.d);
    if (!this.luft) {
      if (g >= this.y - .05) { this.vy = (g - this.y) / Math.max(dt, .001); this.y = g; }
      else { this.luft = true; this.vy = Math.min(this.vy, 12); }
    }
    if (this.luft) {
      this.vy -= 32 * dt; this.y += this.vy * dt;
      if (this.y <= g) { this.y = g; this.luft = false; this.vy = 0; this.landung = .25; }
    }
    if (this.landung > 0) this.landung -= dt;
  }
  zeigen(zeit) {
    this.g.position.set(this.x, this.y, this.z);
    this.g.rotation.y = this.yaw;
    this.koerper.rotation.z = -this.s * .07 * Math.min(1, this.v / 15) + (this.drift ? -this.drift * .06 : 0);
    this.koerper.rotation.x = this.luft ? -Math.max(-.25, Math.min(.25, this.vy * .02)) : 0;
    this.koerper.position.y = this.landung > 0 ? -Math.sin(this.landung / .25 * Math.PI) * .12 : 0;
    if (this.typ === "stuhl") this.koerper.rotation.y = this.drift ? this.drift * -.4 : 0;
    for (const w of this.koerper.userData.raeder) w.rotation.x += this.v * .05;
    this.schatten.position.set(this.x, hoehe(this.idx, this.d) + .08, this.z);
    this.schatten.scale.setScalar(Math.max(.4, 1 - (this.y - hoehe(this.idx, this.d)) * .12));
    const farbe = this.ladung > 1.7 ? "#E86FB0" : this.ladung > .8 ? "#38BDF8" : "#F2B705";
    this.funken.forEach((f, i) => {
      f.visible = !!this.drift && !this.luft;
      if (f.visible) { f.material.color.set(farbe); f.position.set((i % 2 ? .8 : -.8) + (Math.random() - .5) * .4, .12 + Math.random() * .4, -1 - Math.random() * .6); }
    });
    this.flamme.visible = this.boost > 0;
    if (this.flamme.visible) this.flamme.scale.set(1, .7 + Math.random() * .6, 1);
  }
}

// ---------- Pfandkisten ----------
const kisten = [];
function kistenReihe(t) {
  const i = wrap(Math.round(t * S));
  for (const d of [-3.4, 0, 3.4]) {
    const g = new THREE.Group();
    const k = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1.1), M("#2E9B4F")); g.add(k);
    for (let a = -1; a <= 1; a++) for (const b of [-1, 1]) { const fl = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .8, 8), M("#BDEBC8")); fl.position.set(a * .42, .7, b * .24); g.add(fl); }
    g.traverse(o => o.castShadow = true);
    const x = PX[i] + nX(i) * d, z = PZ[i] + nZ(i) * d;
    g.position.set(x, 1.1, z); sc.add(g);
    kisten.push({ g, x, z, weg: 0 });
  }
}
[.09, .4, .63, .86].forEach(kistenReihe);

// ---------- Minikarte ----------
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (let i = 0; i < S; i++) { minX = Math.min(minX, PX[i]); maxX = Math.max(maxX, PX[i]); minZ = Math.min(minZ, PZ[i]); maxZ = Math.max(maxZ, PZ[i]); }
const mf = Math.min(88 / (maxX - minX), 68 / (maxZ - minZ));
const mx = x => 52 + (x - (minX + maxX) / 2) * mf, mz = z => 42 + (z - (minZ + maxZ) / 2) * mf;
{
  let dd = ""; for (let i = 0; i <= S; i += 30) dd += (i ? "L" : "M") + mx(PX[wrap(i)]).toFixed(1) + " " + mz(PZ[wrap(i)]).toFixed(1);
  $("mini").innerHTML = `<path d="${dd}Z" fill="none" stroke="#6B6560" stroke-width="5" stroke-linejoin="round"/><path d="M${mx(PX[0] + nX(0) * 6)} ${mz(PZ[0] + nZ(0) * 6)}L${mx(PX[0] - nX(0) * 6)} ${mz(PZ[0] - nZ(0) * 6)}" stroke="#fff" stroke-width="2"/><g id="punkte"></g>`;
}

// ---------- Eingabe ----------
const ein = { lenk: 0, drift: false, extra: false, direkt: false };
let steuerung = lager.lesen("kart:steuerung") || (matchMedia("(pointer:coarse)").matches ? "neigen" : "tasten");
let neigung = 0, neigungDa = false;
const tasten = { l: false, r: false };
function bildschirmWinkel() {
  const a = screen.orientation && typeof screen.orientation.angle === "number" ? screen.orientation.angle : (window.orientation || 0);
  return a * Math.PI / 180;
}
addEventListener("deviceorientation", e => {
  if (e.beta == null || e.gamma == null) return;
  neigungDa = true;
  const b = e.beta * Math.PI / 180, g = e.gamma * Math.PI / 180;
  // Richtung "unten" im Gerät, dann in Bildschirmkoordinaten drehen
  const dx = Math.cos(b) * Math.sin(g), dy = -Math.sin(b);
  const a = bildschirmWinkel();
  const sx = dx * Math.cos(a) - dy * Math.sin(a), su = dx * Math.sin(a) + dy * Math.cos(a);
  if (Math.hypot(sx, su) < .25) return;               // Handy liegt fast flach: letzten Wert behalten
  neigung = Math.atan2(sx, -su);                      // Handy im Uhrzeigersinn gedreht = rechts
});
function lenkWert() {
  if (steuerung === "neigen" && neigungDa) {
    const grad = neigung * 180 / Math.PI, tot = 2.5, voll = 22;
    const v = Math.sign(grad) * Math.max(0, Math.abs(grad) - tot) / (voll - tot);
    ein.direkt = true; return Math.max(-1, Math.min(1, v));
  }
  ein.direkt = false;
  return (tasten.r ? 1 : 0) - (tasten.l ? 1 : 0);
}
const tastMap = { ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r" };
addEventListener("keydown", e => {
  if (tastMap[e.key]) tasten[tastMap[e.key]] = true;
  if (e.key === " " || e.key === "Shift") { ein.drift = true; e.preventDefault(); }
  if (e.key === "e" || e.key === "E" || e.key === "ArrowUp") extraZuenden();
  if (e.key === "Escape" || e.key === "p") pause(true);
});
addEventListener("keyup", e => {
  if (tastMap[e.key]) tasten[tastMap[e.key]] = false;
  if (e.key === " " || e.key === "Shift") ein.drift = false;
});
function halten(el, an, aus) {
  const runter = ev => { ev.preventDefault(); el.classList.add("an"); an(); };
  const hoch = ev => { ev.preventDefault(); el.classList.remove("an"); aus && aus(); };
  el.addEventListener("pointerdown", runter); el.addEventListener("pointerup", hoch); el.addEventListener("pointercancel", hoch); el.addEventListener("pointerleave", hoch);
}
halten($("kdrift"), () => ein.drift = true, () => ein.drift = false);
halten($("kextra"), () => extraZuenden());
halten($("klinks"), () => tasten.l = true, () => tasten.l = false);
halten($("krechts"), () => tasten.r = true, () => tasten.r = false);
document.addEventListener("gesturestart", e => e.preventDefault());
document.addEventListener("contextmenu", e => e.preventDefault());

// ---------- Rennen ----------
let karts = [], ich = null, phase = "menue", uhr = 0, countdown = 0, zielZeit = 0, reihenfolge = [];
let wahlTyp = lager.lesen("kart:typ") || "bobbycar", wahlGegner = +(lager.lesen("kart:gegner") ?? 3);
const NAMEN = ["Lena", "Jens", "Mo"];

function rennenAufbauen() {
  karts.forEach(k => { sc.remove(k.g); sc.remove(k.schatten); });
  karts = [];
  ich = new Kart(wahlTyp, "Du", true);
  const typen = Object.keys(FAHRZEUGE).filter(t => t !== wahlTyp);
  const gegner = [];
  for (let n = 0; n < wahlGegner; n++) gegner.push(new Kart(typen[n % typen.length], NAMEN[n], false));
  // Startaufstellung: Spieler hinten, Gegner davor
  const reihe = Math.round(9 / (LAENGE / S));
  const plaetze = [[-1, 2.6], [-1, -2.6], [-2, 2.6], [-2, -2.6]];
  [...gegner, ich].forEach((k, n) => {
    const [r_, d] = plaetze[n]; k.setzen(wrap(-6 + r_ * reihe), d);
    k.tempo = .9 + n * .025; k.zeigen(0); karts.push(k);
  });
  $("punkte").innerHTML = karts.map((k, n) => `<circle r="${k.ich ? 4.5 : 3}" fill="${k.ich ? "#E23B2E" : ["#2F6FDE", "#2E9B4F", "#8B5CF6"][n % 3]}" stroke="#2A1A12" stroke-width="1.2"/>`).join("");
  document.querySelectorAll(".tag").forEach(t => t.remove());
  for (const k of karts) if (!k.ich) { k.tag = document.createElement("div"); k.tag.className = "tag"; k.tag.textContent = k.name; $("hud").appendChild(k.tag); }
  kisten.forEach(k => { k.weg = 0; k.g.visible = true; });
  reihenfolge = []; uhr = 0; zielZeit = 0; extraAnzeigen();
  kamera(1, true);
}

function botEingabe(k, dt) {
  const vor = Math.round((10 + k.v * .9) / (LAENGE / S));
  const j = wrap(k.idx + vor);
  k.botTimer -= dt;
  if (k.botTimer <= 0) { k.botTimer = 2 + Math.random() * 3; k.spurZiel = (Math.random() - .5) * (BR - 4); }
  k.spur += ((k.spurZiel ?? 0) - k.spur) * Math.min(1, dt * .8);
  const tx = PX[j] + nX(j) * k.spur, tz = PZ[j] + nZ(j) * k.spur;
  let diff = Math.atan2(tx - k.x, tz - k.z) - k.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  // Gummiband: weit hinter dem Spieler etwas schneller, weit vorne etwas langsamer
  const abstand = (ich.prog - k.prog) / S * LAENGE;
  k.st = { ...FAHRZEUGE[k.typ], maxV: FAHRZEUGE[k.typ].maxV * k.tempo * (abstand > 40 ? 1.08 : abstand < -60 ? .93 : 1) };
  if (k.item && Math.random() < dt * .5) { k.item = null; k.boost = 1.5; }
  return { lenk: Math.max(-1, Math.min(1, -diff * 2.2)), drift: false, direkt: true };
}

function extraZuenden() {
  if (phase !== "rennen" || !ich || !ich.item || ich.fertig) return;
  ich.item = null; ich.boost = Math.max(ich.boost, 1.6); extraAnzeigen(); melden("Espresso! ☕");
}
function extraAnzeigen(neu) {
  const e = $("extra"); e.classList.toggle("leer", !ich || !ich.item);
  if (neu) { e.classList.remove("neu"); void e.offsetWidth; e.classList.add("neu"); }
}
let meldTimer = 0;
function melden(t) { const m = $("meldung"); m.textContent = t; m.hidden = false; meldTimer = 1.4; }

const zeitText = s => { const m = Math.floor(s / 60), r_ = s - m * 60; return `${m}:${r_ < 10 ? "0" : ""}${r_.toFixed(1).replace(".", ",")}`; };

function stossen() {
  for (let a = 0; a < karts.length; a++) for (let b = a + 1; b < karts.length; b++) {
    const A = karts[a], B = karts[b];
    if (Math.abs(A.y - B.y) > 1.2) continue;
    const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
    if (d < 1.9 && d > .001) {
      const ueber = 1.9 - d, mA = A.st.masse, mB = B.st.masse, sum = mA + mB;
      A.x -= dx / d * ueber * mB / sum; A.z -= dz / d * ueber * mB / sum;
      B.x += dx / d * ueber * mA / sum; B.z += dz / d * ueber * mA / sum;
    }
  }
}

function update(dt) {
  if (phase === "countdown") {
    countdown -= dt;
    const g = $("gross"), n = Math.ceil(countdown);
    if (countdown > 0) { g.hidden = false; g.classList.remove("klein"); g.textContent = n; }
    else { phase = "rennen"; g.textContent = "LOS!"; setTimeout(() => { if (g.textContent === "LOS!") g.hidden = true; }, 700); uhr = 0; karts.forEach(k => k.rundeStart = 0); }
  }
  ein.lenk = lenkWert();
  const rennt = phase === "rennen";
  if (rennt) uhr += dt;
  for (const k of karts) {
    const e = !rennt ? { lenk: k.ich ? ein.lenk : 0, gas: false, drift: false, direkt: true }
      : k.fertig != null ? (k.ich ? { lenk: botEingabe(k, dt).lenk, drift: false, direkt: true } : botEingabe(k, dt))
        : k.ich && !AUTO ? ein : botEingabe(k, dt);
    if (k.fertig != null && k.ich) k.st = { ...FAHRZEUGE[k.typ], maxV: FAHRZEUGE[k.typ].maxV * .6 };
    k.schritt(dt, e);
    // Runden
    const runde = Math.floor(k.prog / S);
    if (rennt && runde > k.runden.length && k.fertig == null && k.prog > 0) {
      k.runden.push(uhr - k.rundeStart); k.rundeStart = uhr;
      if (k.runden.length >= RUNDEN) { k.fertig = uhr; reihenfolge.push(k); if (k.ich) zielEinlauf(); }
      else if (k.ich) melden(k.runden.length === RUNDEN - 1 ? "Letzte Runde!" : `Runde ${k.runden.length + 1}`);
    }
    // Kisten
    if (rennt) for (const b of kisten) if (!b.weg && Math.hypot(b.x - k.x, b.z - k.z) < 1.8 && k.y < 2.5) {
      b.weg = 3.5; b.g.visible = false;
      if (!k.item) { k.item = "espresso"; if (k.ich) extraAnzeigen(true); }
    }
  }
  stossen();
  for (const b of kisten) { if (b.weg > 0) { b.weg -= dt; if (b.weg <= 0) { b.weg = 0; b.g.visible = true; } } b.g.rotation.y += dt * 1.2; b.g.position.y = 1.1 + Math.sin(uhr * 3 + b.x) * .15; }
  if (meldTimer > 0) { meldTimer -= dt; if (meldTimer <= 0) $("meldung").hidden = true; }
}

function platzVon(k) {
  const i = reihenfolge.indexOf(k); if (i >= 0) return i + 1;
  return reihenfolge.length + 1 + karts.filter(o => o !== k && !reihenfolge.includes(o) && o.prog > k.prog).length;
}

const ziel3 = new THREE.Vector3(), kamPos = new THREE.Vector3(), blick = new THREE.Vector3();
function kamera(dt, sofort) {
  const fx = Math.sin(ich.yaw * .5 + ich.mh * .5), fz = Math.cos(ich.yaw * .5 + ich.mh * .5);
  ziel3.set(ich.x - fx * 7.6, ich.y * .6 + 3.5, ich.z - fz * 7.6);
  if (sofort) kamPos.copy(ziel3); else kamPos.lerp(ziel3, 1 - Math.exp(-dt * 7));
  cam.position.copy(kamPos);
  blick.set(ich.x + fx * 6, ich.y * .7 + 1.3, ich.z + fz * 6);
  cam.lookAt(blick);
  const fov = 62 + (ich.boost > 0 ? 9 : 0) + Math.min(4, ich.v / 8);
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix();
  sonne.position.set(ich.x - 30, 60, ich.z + 25); sonne.target.position.set(ich.x, 0, ich.z);
}

const v3 = new THREE.Vector3();
let hudTakt = 0;
function hud(dt) {
  karts.forEach((k, n) => {
    const c = $("punkte").children[n]; c.setAttribute("cx", mx(k.x).toFixed(1)); c.setAttribute("cy", mz(k.z).toFixed(1));
    if (k.tag) {
      v3.set(k.x, k.y + 2.8, k.z).project(cam);
      const sichtbar = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
      k.tag.style.display = sichtbar ? "" : "none";
      if (sichtbar) { k.tag.style.left = (v3.x + 1) / 2 * innerWidth + "px"; k.tag.style.top = (1 - v3.y) / 2 * innerHeight + "px"; }
    }
  });
  $("lenkrad").style.transform = `rotate(${ein.lenk * 90}deg)`;
  hudTakt -= dt; if (hudTakt > 0) return; hudTakt = .1;
  $("uhr").textContent = zeitText(ich.fertig ?? uhr);
  $("runde").textContent = `Runde ${Math.min(RUNDEN, Math.max(1, ich.runden.length + 1))}/${RUNDEN}`;
  $("platz").innerHTML = karts.length > 1 ? `${platzVon(ich)}<small>. Platz</small>` : `<small>Testfahrt</small>`;
}

function zielEinlauf() {
  const p = platzVon(ich), gesamt = ich.fertig;
  const g = $("gross"); g.hidden = false; g.classList.add("klein"); g.textContent = karts.length > 1 ? `${p}. Platz!` : "Im Ziel!";
  const key = "kart:best:" + wahlTyp, alt = +lager.lesen(key) || 0, rekord = !alt || gesamt < alt;
  if (rekord) lager.schreiben(key, gesamt);
  const bestRunde = Math.min(...ich.runden);
  setTimeout(() => {
    if (phase !== "rennen") return;
    phase = "ziel"; g.hidden = true;
    $("zieltitel").textContent = (karts.length > 1 ? `${p}. Platz` : "Im Ziel") + (rekord ? " · neue Bestzeit!" : "");
    $("zeiten").innerHTML = ich.runden.map((t, i) => `<tr><td>Runde ${i + 1}</td><td><b>${zeitText(t)}</b>${t === bestRunde ? " ⚡" : ""}</td></tr>`).join("") +
      `<tr><td>Gesamt</td><td><b>${zeitText(gesamt)}</b></td></tr>` + (alt && !rekord ? `<tr><td class="leise">Bestzeit</td><td class="leise">${zeitText(alt)}</td></tr>` : "");
    $("rangliste").innerHTML = karts.length > 1 ? [...karts].sort((a, b) => platzVon(a) - platzVon(b)).map(k => `<tr><td>${platzVon(k)}.</td><td>${k.ich ? "<b>Du</b>" : k.name}</td><td class="leise">${FAHRZEUGE[k.typ].emoji}</td></tr>`).join("") : "";
    $("ziel").hidden = false;
  }, 2200);
}

// ---------- Menü ----------
function menueZeigen() {
  phase = "menue"; $("start").hidden = false; $("ziel").hidden = true; $("pausiert").hidden = true; $("hud").hidden = true;
  $("fahrzeuge").innerHTML = Object.entries(FAHRZEUGE).map(([t, f]) => `<button class="wahl ${t === wahlTyp ? "an" : ""}" data-typ="${t}" title="${f.text}">${f.emoji} ${f.name}</button>`).join("");
  document.querySelectorAll("[data-typ]").forEach(b => b.onclick = () => { wahlTyp = b.dataset.typ; lager.schreiben("kart:typ", wahlTyp); menueZeigen(); });
  document.querySelectorAll("[data-st]").forEach(b => { b.classList.toggle("an", b.dataset.st === steuerung); b.onclick = () => { steuerung = b.dataset.st; lager.schreiben("kart:steuerung", steuerung); menueZeigen(); }; });
  document.querySelectorAll("[data-geg]").forEach(b => { b.classList.toggle("an", +b.dataset.geg === wahlGegner); b.onclick = () => { wahlGegner = +b.dataset.geg; lager.schreiben("kart:gegner", wahlGegner); menueZeigen(); }; });
  const best = +lager.lesen("kart:best:" + wahlTyp);
  $("best").textContent = best ? `Bestzeit ${FAHRZEUGE[wahlTyp].name}: ${zeitText(best)}` : "";
  rennenAufbauen();
}
async function starten() {
  if (steuerung === "neigen" && typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    try { const a = await DeviceOrientationEvent.requestPermission(); if (a !== "granted") { steuerung = "tasten"; alert("Ohne Erlaubnis für den Bewegungssensor geht Neigen nicht. Ich schalte auf Tasten um."); } }
    catch { steuerung = "tasten"; }
  }
  const t = steuerung === "tasten";
  document.body.classList.toggle("tasten", t);
  $("hud").classList.toggle("tasten", t);
  $("klinks").hidden = $("krechts").hidden = !t;
  $("lenk").hidden = t && matchMedia("(pointer:coarse)").matches;
  $("lenktext").textContent = t ? "Pfeiltasten lenken" : "Handy neigen zum Lenken";
  rennenAufbauen();
  $("start").hidden = true; $("ziel").hidden = true; $("hud").hidden = false;
  phase = "countdown"; countdown = 3;
}
$("los").onclick = starten;
$("nochmal").onclick = starten;
$("menue").onclick = menueZeigen;
let vorPause = null;
function pause(an) {
  if (an && (phase === "rennen" || phase === "countdown")) { vorPause = phase; phase = "pause"; $("pausiert").hidden = false; }
  else if (!an && phase === "pause") { phase = vorPause; $("pausiert").hidden = true; }
}
$("pause").onclick = () => pause(true);
$("weiter").onclick = () => pause(false);
$("abbruch").onclick = menueZeigen;
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });

// ---------- Schleife ----------
let letzte = performance.now();
function loop(jetzt) {
  const dt = Math.min(.05, (jetzt - letzte) / 1000); letzte = jetzt;
  if (phase === "menue") {                    // Menü: Kamera fährt langsam um die Startaufstellung
    const t = jetzt / 6000;
    cam.position.set(ich.x + Math.sin(t) * 14, 5, ich.z + Math.cos(t) * 14); cam.lookAt(ich.x, 1, ich.z);
    sonne.position.set(ich.x - 30, 60, ich.z + 25); sonne.target.position.set(ich.x, 0, ich.z);
  } else if (phase !== "pause") {
    update(dt);
    karts.forEach(k => k.zeigen(jetzt));
    kamera(dt);
    hud(dt);
  }
  r.render(sc, cam);
  requestAnimationFrame(loop);
}
menueZeigen();
requestAnimationFrame(loop);
window.KART = { get phase() { return phase; }, get ich() { return ich; }, karts: () => karts, ein, starten, S, LAENGE,
  sim(sek) { for (let t = 0; t < sek; t += 1 / 60) { update(1 / 60); } }, neigung: () => neigung, lenkWert, set steuerung(v) { steuerung = v; } };
