// Kerker-Kart (Arbeitstitel): Die Helden aus Dungeons & Disappointments fahren durch den Kerker.
// Lenken durch Neigen des Handys im Querformat (wie ein Lenkrad) oder mit Tasten. Konzept: KONZEPT.md
import * as THREE from "three";

const $ = id => document.getElementById(id);
const RUNDEN = +(new URLSearchParams(location.search).get("runden")) || 3;   // ?runden=1 zum Testen
const AUTO = new URLSearchParams(location.search).has("auto");   // Test: eigenes Kart fährt selbst
const BR = 12;                      // Fahrbahnbreite
const RAND = BR / 2 + 1.3;          // ab hier Geröll (langsamer)
const MAUER = BR / 2 + 8;           // hier ist Schluss
const lager = { lesen(k) { try { return localStorage.getItem(k); } catch { return null; } }, schreiben(k, v) { try { localStorage.setItem(k, v); } catch {} } };

// ---------- Fahrer ----------
// Helden aus dem Verlies, jeder mit eigenem Gefährt. gelaende: Tempo auf Geröll (sonst 0,5)
const HELDEN = {
  kaempfer: { name: "Kämpfer", gefaehrt: "Streitwagen", klasse: "schwer", text: "schiebt alle weg, beschleunigt langsam", maxV: 27.5, accel: 11.5, turn: 1.75, grip: 11, drift: 1.25, masse: 1.8 },
  paladin: { name: "Paladin", gefaehrt: "Panzerlore", klasse: "schwer", text: "liegt satt in der Kurve", maxV: 27, accel: 12.5, turn: 1.8, grip: 11.5, drift: 1.3, masse: 1.7 },
  dieb: { name: "Dieb", gefaehrt: "geklauter Handkarren", klasse: "leicht", text: "flink und wendig", maxV: 26, accel: 17, turn: 2.2, grip: 9.5, drift: 1.55, masse: .8 },
  waldlaeufer: { name: "Waldläufer", gefaehrt: "Baumstamm-Renner", klasse: "mittel", text: "Geröll bremst ihn kaum", maxV: 27, accel: 14, turn: 1.95, grip: 10, drift: 1.35, masse: 1, gelaende: .82 },
  magierin: { name: "Magierin", gefaehrt: "fliegender Teppich", klasse: "leicht", text: "sehr schnell, rutscht in Kurven", maxV: 28.5, accel: 13.5, turn: 1.85, grip: 6.5, drift: 1.35, masse: .8 },
  heilerin: { name: "Heilerin", gefaehrt: "Kräuterkarren", klasse: "mittel", text: "ausgewogen, gut für den Anfang", maxV: 27, accel: 15, turn: 1.95, grip: 10, drift: 1.4, masse: 1 },
  moench: { name: "Mönch", gefaehrt: "Rollkissen", klasse: "leicht", text: "beste Beschleunigung, driftet stark", maxV: 25.5, accel: 18, turn: 2.25, grip: 9, drift: 1.6, masse: .75 },
  nekromant: { name: "Nekromant", gefaehrt: "rollender Sarg", klasse: "mittel", text: "schnell, aber träge in Kurven", maxV: 28, accel: 13, turn: 1.8, grip: 9.5, drift: 1.35, masse: 1.15 },
};
// Übungsgegner: Monster aus dem Verlies
const MONSTER = {
  goblin: { name: "Goblin", emoji: "👺", farbe: "#7C8F64", maxV: 27, accel: 15, turn: 1.95, grip: 10, drift: 1.35, masse: 1 },
  skelett: { name: "Skelett", emoji: "💀", farbe: "#EDE4D0", maxV: 26.5, accel: 16, turn: 2.1, grip: 9.5, drift: 1.5, masse: .8 },
  ork: { name: "Ork", emoji: "👹", farbe: "#5E7350", maxV: 27.5, accel: 11.5, turn: 1.75, grip: 11, drift: 1.25, masse: 1.8 },
  ratte: { name: "Riesenratte", emoji: "🐀", farbe: "#8C7A6B", maxV: 28, accel: 17, turn: 2.1, grip: 9, drift: 1.5, masse: .7 },
  schleim: { name: "Schleim", emoji: "🟢", farbe: "#7BD64A", maxV: 27, accel: 14, turn: 1.9, grip: 6.5, drift: 1.35, masse: 1.1 },
  pilzling: { name: "Pilzling", emoji: "🍄", farbe: "#D9483B", maxV: 26.5, accel: 16, turn: 2.2, grip: 9.5, drift: 1.55, masse: .8 },
};
const TYPEN = { ...HELDEN, ...MONSTER };
const heldOder = t => HELDEN[t] ? t : "kaempfer";
// kleines Bild für Listen: Heldenwappen aus dem Verlies, bei Monstern ein Emoji
const icon = t => HELDEN[t] ? (window.VB ? `<span class="wappen">${VB.held(t)}</span>` : "") : MONSTER[t] ? MONSTER[t].emoji : "";

// ---------- Szene ----------
const r = new THREE.WebGLRenderer({ antialias: true });
r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(r.domElement);
const sc = new THREE.Scene();
const DUNKEL = "#140F14";
sc.background = new THREE.Color(DUNKEL); sc.fog = new THREE.Fog(DUNKEL, 55, 200);
const cam = new THREE.PerspectiveCamera(62, 1, .4, 600);
sc.add(new THREE.HemisphereLight("#FFE6C4", "#3A2C24", 1.35));
const sonne = new THREE.DirectionalLight("#FFD9A6", 1.7);
sonne.castShadow = true; sonne.shadow.mapSize.set(1024, 1024);
Object.assign(sonne.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
sc.add(sonne, sonne.target);
const matCache = new Map();
const M = c => { if (!matCache.has(c)) matCache.set(c, new THREE.MeshLambertMaterial({ color: c })); return matCache.get(c); };
const glutCache = new Map();          // selbstleuchtend (Flammen, Augen, Kugeln): kein Licht nötig
const GLUT = c => { if (!glutCache.has(c)) glutCache.set(c, new THREE.MeshBasicMaterial({ color: c })); return glutCache.get(c); };
function groesse() { const w = innerWidth, h = innerHeight; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }
addEventListener("resize", groesse); groesse();

const boden = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M("#2E2723"));
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

// Treppe zum Thronsaal: Rampe zum Springen
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
const STRICH = Math.round(S * 4 / LAENGE);   // etwa 4 m
// Fahrbahn aus Steinplatten: drei Reihen, versetzt
const PLATTE = ["#9A8F82", "#8C8275", "#A39888"];
for (let j = 0; j < 3; j++) band(-BR / 2 + j * BR / 3, -BR / 2 + (j + 1) * BR / 3, i => PLATTE[(Math.floor(i / (STRICH * .75) + j * .5) + j) % 3], .05);
band(BR / 2, BR / 2 + 1.3, i => (Math.floor(i / (STRICH * .6)) % 2 ? "#E6D6AE" : "#8E2F22"), .05);
band(-BR / 2 - 1.3, -BR / 2, i => (Math.floor(i / (STRICH * .6)) % 2 ? "#E6D6AE" : "#8E2F22"), .05);
band(RAND, MAUER + .2, i => (Math.floor(i / STRICH) % 3 ? "#4E443B" : "#463D35"), .03);
band(-MAUER - .2, -RAND, i => (Math.floor(i / STRICH) % 3 ? "#4E443B" : "#463D35"), .03);
// Rampe als Treppe: Stufenstreifen
band(-BR / 2 - 1.3, BR / 2 + 1.3, i => (Math.floor((i - R0) / 3) % 2 ? "#B5A894" : "#9C907E"), .08, R0, R1, k => hoehe(k, 0));
{ // Vorderkante der Treppe
  const k = R1, w = BR + 2.6, g = new THREE.Mesh(new THREE.BoxGeometry(w, RH, .4), M("#7E7466"));
  g.position.set(PX[k], RH / 2, PZ[k]); g.rotation.y = Math.atan2(TX[k], TZ[k]); sc.add(g);
  for (const s of [-1, 1]) { // Geländer
    const gl = new THREE.Mesh(new THREE.BoxGeometry(.25, 1.1, (R1 - R0) * LAENGE / S), M("#4A3F36"));
    const m = Math.round((R0 + R1) / 2); gl.position.set(PX[m] + nX(m) * s * (BR / 2 + 1.5), RH / 2 + .9, PZ[m] + nZ(m) * s * (BR / 2 + 1.5));
    gl.rotation.y = Math.atan2(TX[m], TZ[m]); gl.rotation.x = -Math.atan2(RH, (R1 - R0) * LAENGE / S); sc.add(gl);
  }
}
// Start/Ziel-Linie
for (let k = 0; k < BR; k++) for (let j = 0; j < 2; j++) {
  const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M((k + j) % 2 ? "#F3E6CC" : "#16161D"));
  q.rotation.x = -Math.PI / 2; q.rotation.z = Math.atan2(TX[0], TZ[0]);
  const d = -BR / 2 + .5 + k, f = j - .5;
  q.position.set(PX[0] + nX(0) * d + TX[0] * f, .1, PZ[0] + nZ(0) * d + TZ[0] * f); sc.add(q);
}

function schildMat(text, bg, fg, w = 512, h = 128) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const x = cv.getContext("2d"); x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = fg; x.font = `900 ${Math.round(h * .62)}px Unbounded, system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return [M(bg), M(bg), M(bg), M(bg), new THREE.MeshLambertMaterial({ map: t }), new THREE.MeshLambertMaterial({ map: t })];
}
// Lichtschein auf dem Boden (statt echter Lichter, die auf dem Handy teuer wären)
const scheinTex = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const x = cv.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,170,80,1)"); g.addColorStop(.5, "rgba(255,130,50,.35)"); g.addColorStop(1, "rgba(255,120,40,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
})();
const scheinMat = new THREE.MeshBasicMaterial({ map: scheinTex, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false });

// Viele gleiche Teile als eine Instanz-Gruppe: liste = [[x, y, z, drehY, groesse, farbe?], …]
function instanzen(geo, mat, liste, schatten = true) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, liste.length)), o = new THREE.Object3D(), c = new THREE.Color();
  liste.forEach(([x, y, z, ry = 0, s = 1, farbe], i) => {
    o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    if (farbe) im.setColorAt(i, c.set(farbe));
  });
  im.count = liste.length; im.castShadow = schatten; im.receiveShadow = true; sc.add(im); return im;
}

// ---------- Umgebung: Kerker ----------
const neben = (t, d) => { const i = wrap(Math.round(t * S)); return { x: PX[i] + nX(i) * d, z: PZ[i] + nZ(i) * d, rot: Math.atan2(TX[i], TZ[i]) }; };
function frei(x, z, abstand) {
  for (let i = 0; i < S; i += 6) if ((PX[i] - x) ** 2 + (PZ[i] - z) ** 2 < abstand * abstand) return false;
  return true;
}
let seed = 7; const zufall = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const belegt = [];
// Gebäude: Steinblock mit Zinnen, erleuchteten Fenstern und Schild
function bau(t, seite, w, h, d, farbe, schild) {
  const abst = MAUER + 3 + d / 2, p = neben(t, seite * abst);
  const g = new THREE.Group();
  const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(farbe)); k.position.y = h / 2; k.castShadow = k.receiveShadow = true; g.add(k);
  const zinne = new THREE.BoxGeometry(1.2, 1.1, 1.2);
  for (let i = 0; i <= Math.floor(w / 2.4); i++) for (const s of [-1, 1]) { const z = new THREE.Mesh(zinne, M(farbe)); z.position.set(-w / 2 + .6 + i * (w - 1.2) / Math.floor(w / 2.4), h + .55, s * (d / 2 - .6)); g.add(z); }
  const fen = GLUT("#FFB45A"), fg = new THREE.PlaneGeometry(1, 1.6);
  for (let i = 0; i < Math.floor((w - 2) / 4.2); i++) for (let j = 0; j < Math.floor((h - 2) / 4); j++) {
    for (const s of [-1, 1]) { const f = new THREE.Mesh(fg, fen); f.position.set(-w / 2 + 3 + i * 4.2, 2.6 + j * 4, s * (d / 2 + .02)); if (s < 0) f.rotation.y = Math.PI; g.add(f); }
  }
  if (schild) {
    const sl = schild.length * 1.25 + 2, b = new THREE.Mesh(new THREE.BoxGeometry(sl, 2, .3), schildMat(schild, "#F3E6CC", "#2A2118", 1024, 160));
    b.position.set(0, h + 2.4, 0); g.add(b);
    const b2 = b.clone(); b2.rotation.y = Math.PI; b2.position.z = .01; g.add(b2);
  }
  g.position.set(p.x, 0, p.z); g.rotation.y = p.rot + Math.PI / 2; sc.add(g);
  belegt.push({ x: p.x, z: p.z, r: Math.hypot(w, d) / 2 + 2 });
  return g;
}
bau(.97, 1, 24, 8, 12, "#6E655C", "WACHSTUBE");
const thronsaal = bau(.34, 1, 40, 14, 16, "#5E564F", "THRONSAAL");
const zellen = bau(.16, -1, 20, 9, 12, "#655C54", "VERLIES");
bau(.53, 1, 22, 10, 14, "#6A5F55", "SCHATZKAMMER");
bau(.73, -1, 16, 9, 22, "#5F5850", "WAFFENKAMMER");
{ // Gitterstäbe vor den Zellen
  const st = new THREE.CylinderGeometry(.09, .09, 6, 6);
  for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(st, M("#2A2A30")); b.position.set(-8 + i, 3, -6.15); zellen.add(b); }
}
{ // Gold vor der Schatzkammer
  const p = neben(.53, MAUER + 2.2), g = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.4, 10), M("#E8B53A"));
  g.position.set(p.x, .7, p.z); sc.add(g);
}
// Thron des Knochenkönigs neben der Treppe (er schaut nur zu, noch)
{
  const p = neben(.348, MAUER + 3.5), g = new THREE.Group();
  const st = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.6, 3), M("#3A2E26")); st.position.y = .8; g.add(st);
  const le = new THREE.Mesh(new THREE.BoxGeometry(3.6, 6, .6), M("#3A2E26")); le.position.set(0, 3.5, -1.3); g.add(le);
  for (let i = -2; i <= 2; i++) { const z = new THREE.Mesh(new THREE.ConeGeometry(.3, 1.2, 6), M("#3A2E26")); z.position.set(i * .75, 7, -1.3); g.add(z); }
  const ko = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.2, 2.2, 10), M("#4A2E5A")); ko.position.set(0, 2.6, -.2); g.add(ko);
  const sch = new THREE.Mesh(new THREE.SphereGeometry(.8, 14, 10), M("#EDE4D0")); sch.position.set(0, 4.3, -.1); g.add(sch);
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 6), GLUT("#7BE3A0")); a.position.set(s * .3, 4.4, .6); g.add(a); }
  const kr = new THREE.Mesh(new THREE.CylinderGeometry(.75, .6, .6, 8, 1, true), new THREE.MeshLambertMaterial({ color: "#E8C24A", side: THREE.DoubleSide })); kr.position.set(0, 5.1, -.1); g.add(kr);
  const zep = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 3.4), M("#E8C24A")); zep.position.set(1.4, 3.4, .4); zep.rotation.z = -.2; g.add(zep);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.position.set(p.x, 0, p.z); g.rotation.y = p.rot - Math.PI / 2; sc.add(g);
}
{ // Feuerschale in der Mitte
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 3, 10), M("#5A5048")); s.position.y = 1.5; g.add(s);
  const sch = new THREE.Mesh(new THREE.CylinderGeometry(5, 3, 1.6, 16), M("#4A3F36")); sch.position.y = 3.6; g.add(sch);
  for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.9, 3 + (i % 3), 6), GLUT(i % 2 ? "#FF9A3C" : "#FFD15A")); f.position.set(Math.sin(i) * 2.2 * (i ? 1 : 0), 5.2, Math.cos(i) * 2.2 * (i ? 1 : 0)); g.add(f); }
  const sc2 = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), scheinMat); sc2.rotation.x = -Math.PI / 2; sc2.position.y = .12; g.add(sc2);
  g.position.set(10, 0, -90); sc.add(g); belegt.push({ x: 10, z: -90, r: 12 });
}
// Mauer am Rand, Pfeiler mit Fackeln
const fackeln = [];
{
  const steine = [], pfeiler = [], scheine = [], STEIN = ["#6B6158", "#62584F", "#73695F", "#5D544C"];
  const n = Math.floor(LAENGE / 2.2);
  for (let j = 0; j < n; j++) {
    const i = Math.floor(j * S / n);
    if (i >= R0 - 8 && i <= R1 + 4) continue;
    for (const s of [-1, 1]) {
      const d = s * (MAUER + .7), rot = Math.atan2(TX[i], TZ[i]) + Math.PI / 2;
      steine.push([PX[i] + nX(i) * d, 1.1, PZ[i] + nZ(i) * d, rot, 1, STEIN[Math.floor(zufall() * 4)]]);
      if (j % 7 === 0) {
        pfeiler.push([PX[i] + nX(i) * d, 2.4, PZ[i] + nZ(i) * d, rot]);
        const df = s * (MAUER - .2); fackeln.push([PX[i] + nX(i) * df, 3.9, PZ[i] + nZ(i) * df]);
        const ds = s * (MAUER - 3); scheine.push([PX[i] + nX(i) * ds, .14, PZ[i] + nZ(i) * ds]);
      }
    }
  }
  instanzen(new THREE.BoxGeometry(2.4, 2.2, 1.3), new THREE.MeshLambertMaterial({ color: "#ffffff" }), steine);
  instanzen(new THREE.BoxGeometry(1.6, 4.8, 1.6), M("#574E46"), pfeiler);
  instanzen(new THREE.CylinderGeometry(.09, .06, .9, 6), M("#4A3426"), fackeln.map(([x, y, z]) => [x, y - .5, z]), false);
  const sg = new THREE.PlaneGeometry(13, 13); sg.rotateX(-Math.PI / 2);
  const ims = instanzen(sg, scheinMat, scheine, false); ims.receiveShadow = false;
}
// Flammen flackern: jede Fackel hat zwei Flammen, die abwechselnd größer und kleiner werden
const flammen = [instanzen(new THREE.ConeGeometry(.28, .9, 6), GLUT("#FF8A2A"), fackeln.map(([x, y, z]) => [x, y + .2, z]), false),
  instanzen(new THREE.ConeGeometry(.16, .6, 6), GLUT("#FFE07A"), fackeln.map(([x, y, z]) => [x, y + .1, z]), false)];
const flamO = new THREE.Object3D();
function flackern(t) {
  flammen.forEach((im, k) => {
    for (let i = 0; i < fackeln.length; i++) {
      const [x, y, z] = fackeln[i], f = 1 + Math.sin(t * (9 + k * 4) + i * 1.7) * .18 + Math.sin(t * 23 + i) * .08;
      flamO.position.set(x, y + (k ? .1 : .2) + (f - 1) * .3, z); flamO.scale.set(1, f, 1); flamO.updateMatrix(); im.setMatrixAt(i, flamO.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  });
}
// Halle: Säulen, die im Dunkeln verschwinden, dazu Fässer und Kisten
{
  const saeulen = [], kapitelle = [], faesser = [], kisten_ = [];
  for (let n = 0; n < 1400 && saeulen.length < 70; n++) {
    const x = -230 + zufall() * 460, z = -270 + zufall() * 350;
    if (!frei(x, z, MAUER + 8)) continue;
    if (belegt.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + 4) ** 2)) continue;
    if (saeulen.some(([a, , c]) => (a - x) ** 2 + (c - z) ** 2 < 400)) continue;
    saeulen.push([x, 11, z, zufall() * 3]); kapitelle.push([x, .8, z, zufall() * 3]);
  }
  for (let n = 0; n < 2000 && faesser.length + kisten_.length < 150; n++) {
    const x = -220 + zufall() * 440, z = -260 + zufall() * 330;
    if (!frei(x, z, MAUER + 2.5)) continue;
    if (belegt.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + 2) ** 2)) continue;
    if (zufall() < .5) faesser.push([x, .8, z, 0, .8 + zufall() * .4]); else kisten_.push([x, .7, z, zufall() * 3, .8 + zufall() * .5]);
  }
  instanzen(new THREE.CylinderGeometry(1.5, 1.7, 22, 10), M("#544B43"), saeulen);
  instanzen(new THREE.BoxGeometry(4.2, 1.6, 4.2), M("#4A423B"), kapitelle);
  instanzen(new THREE.CylinderGeometry(.75, .75, 1.6, 10), M("#7A5434"), faesser);
  instanzen(new THREE.BoxGeometry(1.4, 1.4, 1.4), M("#8A6A44"), kisten_);
}
// Start: Steinbogen mit Schild und Bannern, Fässer an der Geraden
{
  const d = BR / 2 + 2.2;
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 8, 1.6), M("#6E655C")); p.position.set(PX[0] + nX(0) * d * s, 4, PZ[0] + nZ(0) * d * s); p.castShadow = true; sc.add(p);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.4), new THREE.MeshLambertMaterial({ color: "#8E2F22", side: THREE.DoubleSide }));
    ban.position.set(PX[0] + nX(0) * (d - 1.6) * s, 5.2, PZ[0] + nZ(0) * (d - 1.6) * s); ban.rotation.y = Math.atan2(TX[0], TZ[0]); sc.add(ban);
  }
  const bo = new THREE.Mesh(new THREE.BoxGeometry(d * 2 + 1.6, 1.4, 1.4), M("#6E655C")); bo.position.set(PX[0], 8.6, PZ[0]); bo.rotation.y = Math.atan2(TX[0], TZ[0]) + Math.PI / 2; sc.add(bo);
  const b = new THREE.Mesh(new THREE.BoxGeometry(d * 2 - 1, 1.5, .4), schildMat("START · ZIEL", "#F3E6CC", "#2A2118", 1024, 96));
  b.position.set(PX[0], 7.2, PZ[0]); b.rotation.y = Math.atan2(TX[0], TZ[0]) + Math.PI; sc.add(b);
  for (let i = 0; i < 6; i++) { const p = neben(.015 + i * .011, -(MAUER + 2.4)); const f = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 1.3, 10), M("#7A5434")); f.position.set(p.x, .65, p.z); f.castShadow = true; sc.add(f); }
}

// ---------- Fahrer-Modelle (Front zeigt nach +z) ----------
// Bausteine: teil(Geometrie, Farbe, x, y, z, drehX, drehY, drehZ)
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const kugel = (r, n = 14) => new THREE.SphereGeometry(r, n, Math.max(6, n - 4));
const zyl = (r1, r2, h, n = 12) => new THREE.CylinderGeometry(r1, r2, h, n);
const kegel = (r, h, n = 12) => new THREE.ConeGeometry(r, h, n);
const kapsel = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
function teil(g, geo, farbe, x, y, z, rx = 0, ry = 0, rz = 0, mat) {
  const m = new THREE.Mesh(geo, mat || M(farbe)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
}
const HAUT = "#E3B48A";
function rad(g, x, z, rr = .38, farbe = "#2A2A2A", nabe = "#BBBBBB") {
  const w = new THREE.Mesh(zyl(rr, rr, .26, 14), M(farbe)); w.rotation.z = Math.PI / 2; w.position.set(x, rr, z); w.userData.lose = true;
  w.add(new THREE.Mesh(box(.28, rr * 1.25, .14), M(nabe)));
  g.add(w); g.userData.raeder.push(w);
}
const neu = () => { const g = new THREE.Group(); g.userData.raeder = []; return g; };
// Wimpel in der Spielerfarbe: so unterscheidet man zwei gleiche Helden
function wimpel(g, farbe, x, y, z, h = 1.5) {
  teil(g, zyl(.035, .035, h, 6), "#4A3426", x, y + h / 2, z);
  teil(g, box(.04, .42, .62), farbe, x, y + h - .25, z - .3);
}
const MODELLE = {
  kaempfer(f) {      // Streitwagen mit Rammbock, er steht darin
    const g = neu();
    teil(g, box(1.4, .14, 1.5), "#7A5434", 0, .5, 0);
    teil(g, box(1.4, .85, .14), "#B83A2A", 0, .9, .72);
    teil(g, box(1.5, .12, .2), "#C99A2E", 0, 1.34, .72);
    for (const s of [-1, 1]) teil(g, box(.12, .55, 1.4), "#7A5434", s * .7, .78, 0);
    teil(g, zyl(.17, .17, 1.3, 8), "#6B4A2E", 0, .62, 1.35, Math.PI / 2);
    teil(g, box(.5, .5, .32), "#5A5D68", 0, .62, 2.05);
    rad(g, -.86, -.1, .6, "#4A3426", "#C99A2E"); rad(g, .86, -.1, .6, "#4A3426", "#C99A2E");
    rad(g, -.6, .75, .22); rad(g, .6, .75, .22);
    // Kämpfer
    for (const s of [-1, 1]) teil(g, box(.22, .5, .24), "#4A3426", s * .15, .82, 0);
    teil(g, zyl(.32, .38, .8, 10), "#B83A2A", 0, 1.45, 0);
    teil(g, box(.66, .7, .06), "#8E2A1E", 0, 1.4, -.34, .15);
    for (const s of [-1, 1]) teil(g, kapsel(.11, .45), "#9EA2AE", s * .38, 1.55, .3, 1.2);
    teil(g, kugel(.33), "#9EA2AE", 0, 2.05, 0);
    teil(g, box(.08, .32, .55), "#B83A2A", 0, 2.42, -.05);
    teil(g, zyl(.42, .42, .08, 14), "#7A5434", 0, 1.5, -.42, Math.PI / 2);
    teil(g, kugel(.12, 8), "#C99A2E", 0, 1.5, -.47);
    wimpel(g, f, -.62, .6, -.62, 1.7);
    return g;
  },
  paladin(f) {       // gepanzerte Lore
    const g = neu();
    const lg = zyl(1.0, .78, .85, 4); lg.rotateY(Math.PI / 4);
    teil(g, lg, "#5C6370", 0, .78, 0).scale.set(1, 1, 1.35);
    teil(g, box(1.46, .12, 1.96), "#3F444D", 0, 1.2, 0);
    teil(g, box(1.24, .04, 1.72), "#22252B", 0, 1.25, 0);
    for (const z of [-.45, .45]) teil(g, box(1.3, .08, .08), "#3F444D", 0, .78, z * 1.9);
    for (const x of [-.6, .6]) for (const z of [-.62, .62]) rad(g, x, z, .26, "#3F444D", "#8A8F99");
    // Paladin
    teil(g, zyl(.34, .42, .7, 12), "#C9CCD6", 0, 1.5, -.05);
    teil(g, box(.07, .5, .06), "#C99A2E", 0, 1.55, -.42); teil(g, box(.36, .07, .06), "#C99A2E", 0, 1.62, -.42);
    for (const s of [-1, 1]) { teil(g, kugel(.2, 10), "#A6A9B2", s * .4, 1.8, -.05); teil(g, kapsel(.11, .4), "#B8BCC6", s * .4, 1.55, .25, 1.1); }
    teil(g, kugel(.31), "#B8BCC6", 0, 2.12, -.05);
    teil(g, box(.07, .07, .5), "#E8E2D0", 0, 2.47, -.15, -.4);
    teil(g, zyl(.05, .05, 1.4, 6), "#6B4A2E", .66, 1.5, -.5, 0, 0, -.15);
    teil(g, box(.42, .26, .26), "#9EA2AE", .76, 2.2, -.5);
    wimpel(g, f, -.55, 1.2, -.78, 1.3);
    return g;
  },
  dieb(f) {          // geklauter Handkarren mit Beutesack
    const g = neu();
    teil(g, box(1.3, .14, 1.7), "#8A6A44", 0, .68, 0);
    for (const s of [-1, 1]) { teil(g, box(.08, .34, 1.7), "#7A5A36", s * .65, .9, 0); teil(g, zyl(.05, .05, 1.1, 6), "#6B4A2E", s * .45, .62, 1.25, 1.75); }
    teil(g, box(1.3, .34, .08), "#7A5A36", 0, .9, -.85);
    rad(g, -.82, -.1, .55, "#5A4232", "#8A6A44"); rad(g, .82, -.1, .55, "#5A4232", "#8A6A44");
    teil(g, zyl(.06, .06, .5, 6), "#5A4232", 0, .35, 1.0);
    const sack = teil(g, kugel(.4), "#C9A26A", 0, 1.05, .5); sack.scale.set(1.2, .85, .9);
    for (const [x, z] of [[-.15, .45], [.12, .6], [0, .3]]) teil(g, zyl(.11, .11, .04, 10), "#F2C14E", x, 1.38, z, .3);
    // Dieb
    teil(g, zyl(.3, .44, .8, 12), "#4A3F8A", 0, 1.15, -.35);
    for (const s of [-1, 1]) teil(g, kapsel(.1, .45), "#4A3F8A", s * .36, 1.25, -.05, 1.2);
    teil(g, kugel(.25), "#2A2232", 0, 1.78, -.2);
    teil(g, kugel(.37), "#3A3170", 0, 1.82, -.42);
    teil(g, kegel(.18, .45, 8), "#3A3170", 0, 1.78, -.72, -2.1);
    for (const s of [-1, 1]) { teil(g, box(.05, .5, .04), "#D9DCE4", s * .14, 1.3, -.75, 0, 0, s * .6); teil(g, box(.07, .18, .07), "#6B4A2E", s * .28, 1.5, -.75, 0, 0, s * .6); }
    wimpel(g, f, .58, .8, -.8, 1.4);
    return g;
  },
  waldlaeufer(f) {   // Baumstamm auf Holzscheiben
    const g = neu();
    teil(g, zyl(.48, .5, 2.6, 12), "#7A5434", 0, .78, 0, Math.PI / 2);
    for (const z of [-1.31, 1.31]) teil(g, zyl(.44, .44, .03, 12), "#C9A46A", 0, .78, z, Math.PI / 2);
    for (const [x, y, z, s] of [[.3, 1.25, 1.0, .3], [-.32, 1.2, .8, .25], [.1, 1.25, -1.05, .28]]) teil(g, new THREE.IcosahedronGeometry(s, 0), "#4E8A3C", x, y, z);
    for (const x of [-.64, .64]) for (const z of [-.85, .85]) rad(g, x, z, .4, "#B08A5A", "#7A5434");
    // Waldläufer
    teil(g, zyl(.32, .48, .85, 12), "#5C6B3A", 0, 1.62, -.1);
    for (const s of [-1, 1]) teil(g, kapsel(.11, .45), "#5C6B3A", s * .38, 1.68, .22, 1.2);
    teil(g, kugel(.25), "#6B4A2E", 0, 2.25, .04);
    teil(g, kugel(.36), "#4A5A2C", 0, 2.3, -.18);
    teil(g, zyl(.13, .13, .75, 8), "#8A6A44", .18, 1.85, -.42, -.3, 0, -.25);
    for (const [x, c] of [[.08, "#B83A2A"], [.2, "#D9CDB6"], [.32, "#B83A2A"]]) teil(g, box(.06, .14, .03), c, x + .12, 2.3, -.55);
    const bogen = teil(g, new THREE.TorusGeometry(.62, .035, 6, 18, Math.PI), "#6B4A2E", -.22, 1.75, -.45, 0, Math.PI / 2, Math.PI / 2);
    bogen.userData.k = 1;
    wimpel(g, f, -.36, 1.1, -1.15, 1.4);
    return g;
  },
  magierin(f) {      // fliegender Teppich: schwebt und wellt sich
    const g = neu(), sch = new THREE.Group(); sch.userData.lose = true; g.add(sch);
    teil(sch, box(1.5, .08, 2.5), "#9E2B1F", 0, .55, 0);
    teil(sch, box(1.56, .09, .14), "#E8B84A", 0, .56, 1.2); teil(sch, box(1.56, .09, .14), "#E8B84A", 0, .56, -1.2);
    for (const s of [-1, 1]) teil(sch, box(.12, .09, 2.5), "#E8B84A", s * .74, .56, 0);
    teil(sch, box(.55, .1, .9), "#2F4690", 0, .57, .45);
    for (const x of [-.7, .7]) for (const z of [-1.3, 1.3]) teil(sch, kegel(.07, .25, 6), "#E8B84A", x, .5, z + Math.sign(z) * .08, Math.sign(z) * Math.PI / 2);
    // Magierin
    teil(sch, zyl(.3, .55, 1.0, 12), "#3E5BB8", 0, 1.08, -.1);
    teil(sch, box(.7, .08, .1), "#F5CF4A", 0, .95, -.42);
    for (const s of [-1, 1]) teil(sch, kapsel(.1, .45), "#3E5BB8", s * .36, 1.22, .2, 1.2);
    teil(sch, kugel(.29), "#3A2A22", 0, 1.78, -.1);
    teil(sch, kapsel(.09, .4), "#3A2A22", 0, 1.48, -.38, .2);
    teil(sch, zyl(.55, .55, .05, 16), "#2F4690", 0, 1.96, -.1);
    teil(sch, kegel(.32, 1.0, 12), "#3E5BB8", 0, 2.45, -.25, -.35);
    teil(sch, new THREE.OctahedronGeometry(.12, 0), "", .02, 2.45, .08, 0, 0, 0, GLUT("#F5CF4A"));
    teil(sch, zyl(.05, .05, 2.2, 6), "#6B4A2E", .62, 1.55, .15, .1);
    teil(sch, kugel(.18, 10), "", .62, 2.68, .27, 0, 0, 0, GLUT("#FFE27A"));
    wimpel(sch, f, -.6, .6, -1.05, 1.3);
    sch.userData.anim = (k, t) => { sch.position.y = Math.sin(t / 260 + k.x) * .09; sch.rotation.x = Math.sin(t / 180 + k.z) * .025; };
    g.userData.anim = sch.userData.anim;
    return g;
  },
  heilerin(f) {      // Kräuterkarren mit Töpfen
    const g = neu();
    teil(g, box(1.4, .5, 2.0), "#9A7048", 0, .78, 0);
    teil(g, box(1.46, .08, 2.06), "#7A5434", 0, 1.06, 0);
    for (const x of [-.72, .72]) for (const z of [-.7, .7]) rad(g, x, z, .38, "#5A4232", "#9A7048");
    for (const [x, z, c] of [[-.4, -.65, "#F2A0C0"], [.05, -.75, "#FFFFFF"], [.45, -.6, "#F5CF4A"]]) {
      teil(g, zyl(.17, .13, .3, 8), "#B5623A", x, 1.25, z);
      teil(g, kugel(.24, 8), "#4FB98A", x, 1.5, z);
      teil(g, kugel(.07, 6), c, x + .1, 1.66, z + .08);
    }
    // Heilerin
    teil(g, zyl(.32, .48, .85, 12), "#3E8C62", 0, 1.48, .25);
    teil(g, box(.66, .08, .1), "#F3EEE0", 0, 1.3, -.05);
    for (const s of [-1, 1]) teil(g, kapsel(.11, .45), "#3E8C62", s * .38, 1.55, .55, 1.2);
    teil(g, kugel(.25), "#2C6648", 0, 2.1, .38);
    teil(g, kugel(.37), "#4FB98A", 0, 2.14, .16);
    teil(g, kegel(.18, .45, 8), "#4FB98A", 0, 2.08, -.18, -2.1);
    teil(g, zyl(.05, .05, 2.0, 6), "#6B4A2E", -.65, 1.8, .35, -.1);
    for (const s of [-1, 1]) teil(g, kugel(.14, 8), "#7BE3A0", -.65 + s * .14, 2.85, .3).scale.set(1, .5, 1);
    wimpel(g, f, .6, 1.0, -.88, 1.3);
    return g;
  },
  moench(f) {        // Rollkissen: er fährt im Schneidersitz
    const g = neu();
    teil(g, zyl(.85, .85, .18, 18), "#8A6A44", 0, .4, 0);
    teil(g, zyl(.88, .88, .06, 18), "#C99A2E", 0, .5, 0);
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; rad(g, Math.sin(a) * .62, Math.cos(a) * .62, .2, "#3A2A22", "#C99A2E"); }
    teil(g, zyl(.72, .74, .26, 18), "#B8461E", 0, .65, 0);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; teil(g, kugel(.08, 6), "#E8B84A", Math.sin(a) * .74, .6, Math.cos(a) * .74); }
    // Mönch
    teil(g, kapsel(.2, .7), "#E08A2E", 0, .88, .2, 0, 0, Math.PI / 2);
    teil(g, zyl(.32, .44, .75, 12), "#E08A2E", 0, 1.28, 0);
    teil(g, box(.08, .8, .08), "#B8461E", 0, 1.3, -.36, 0, 0, .6);
    for (const s of [-1, 1]) teil(g, kapsel(.11, .4), "#E08A2E", s * .3, 1.4, .3, 1.1, 0, -s * .5);
    teil(g, kugel(.12, 8), HAUT, 0, 1.55, .55);
    teil(g, new THREE.TorusGeometry(.3, .045, 6, 18), "#5A3A22", 0, 1.68, 0, Math.PI / 2);
    teil(g, kugel(.3), "#D9A77A", 0, 1.95, 0);
    wimpel(g, f, -.55, .5, -.55, 1.6);
    return g;
  },
  nekromant(f) {     // rollender Sarg mit Knochenrädern
    const g = neu();
    const form = new THREE.Shape([[-.42, -1.25], [.42, -1.25], [.68, .45], [.42, 1.25], [-.42, 1.25], [-.68, .45]].map(([x, y]) => new THREE.Vector2(x, y)));
    const sg = new THREE.ExtrudeGeometry(form, { depth: .6, bevelEnabled: false }); sg.rotateX(-Math.PI / 2);
    teil(g, sg, "#3D2A20", 0, .45, 0);
    const innen = new THREE.ExtrudeGeometry(new THREE.Shape(form.getPoints().map(p => p.clone().multiplyScalar(.85))), { depth: .02, bevelEnabled: false }); innen.rotateX(-Math.PI / 2);
    teil(g, innen, "#140E12", 0, 1.04, 0);
    teil(g, box(.26, .26, .04), "#7BE3A0", 0, .75, -1.26, 0, 0, Math.PI / 4);
    for (const x of [-.66, .66]) for (const z of [-.8, .8]) rad(g, x, z, .36, "#EDE4D0", "#B8AE98");
    // Nekromant
    teil(g, zyl(.32, .5, .95, 12), "#2E2A3A", 0, 1.42, .1);
    teil(g, box(.7, .06, .08), "#7BE3A0", 0, 1.08, -.3);
    for (const s of [-1, 1]) teil(g, kapsel(.11, .45), "#2E2A3A", s * .38, 1.55, .42, 1.2);
    teil(g, kugel(.25), "#1C1A26", 0, 2.07, .23);
    teil(g, kugel(.37), "#3D3650", 0, 2.11, .02);
    teil(g, kegel(.2, .5, 8), "#3D3650", 0, 2.04, -.34, -2.1);
    teil(g, zyl(.05, .05, 2.2, 6), "#4A3426", .62, 1.75, .3, .1);
    teil(g, kugel(.2, 10), "#EDE4D0", .62, 2.92, .42);
    teil(g, kugel(.34, 10), "", .62, 2.92, .42, 0, 0, 0, new THREE.MeshBasicMaterial({ color: "#7BE3A0", transparent: true, opacity: .3, depthWrite: false }));
    wimpel(g, f, -.5, 1.0, -1.05, 1.3);
    return g;
  },
  // ----- Monster -----
  goblin() {         // Goblin im Fass
    const g = neu();
    teil(g, zyl(.62, .62, 1.1, 14), "#8A5A2E", 0, .95, 0);
    for (const y of [.55, 1.35]) teil(g, zyl(.64, .64, .08, 14), "#4A4A50", 0, y, 0);
    for (const x of [-.68, .68]) for (const z of [-.6, .6]) rad(g, x, z, .3);
    teil(g, kugel(.4), "#7C8F64", 0, 1.72, .05);
    for (const s of [-1, 1]) { teil(g, kegel(.13, .6, 6), "#7C8F64", s * .55, 1.8, 0, 0, 0, -s * Math.PI / 2 * .85); teil(g, kugel(.07, 6), "", s * .14, 1.78, .38, 0, 0, 0, GLUT("#E23B2E")); }
    for (const s of [-1, 1]) teil(g, kapsel(.09, .35), "#7C8F64", s * .45, 1.45, .35, 1.1);
    return g;
  },
  skelett() {        // Skelett auf einem Karren aus Knochen
    const g = neu(), K = "#EDE4D0";
    for (const s of [-1, 1]) { teil(g, zyl(.07, .07, 2.0, 6), K, s * .5, .6, 0, Math.PI / 2); for (const z of [-1, 1]) teil(g, kugel(.12, 8), K, s * .5, .6, z); }
    for (const z of [-.6, 0, .6]) teil(g, zyl(.06, .06, 1.0, 6), K, 0, .6, z, 0, 0, Math.PI / 2);
    for (const x of [-.62, .62]) for (const z of [-.75, .75]) rad(g, x, z, .32, "#D9CFB8", "#8A8070");
    teil(g, zyl(.05, .05, .9, 6), K, 0, 1.15, 0);
    for (const y of [.95, 1.12, 1.29]) teil(g, new THREE.TorusGeometry(.26, .035, 5, 14, Math.PI * 1.4), K, 0, y, 0, Math.PI / 2, 0, Math.PI * .8);
    for (const s of [-1, 1]) teil(g, zyl(.04, .04, .6, 5), K, s * .3, 1.25, .25, 1.0);
    teil(g, kugel(.3), "#F3EEE0", 0, 1.78, 0);
    for (const s of [-1, 1]) teil(g, kugel(.08, 6), "#16161D", s * .11, 1.8, .26);
    return g;
  },
  ork() {            // Ork im Rammwagen mit Stacheln
    const g = neu();
    teil(g, box(1.6, .6, 2.2), "#4A3F36", 0, .75, 0);
    teil(g, box(1.66, .12, 2.26), "#5A5D68", 0, 1.08, 0);
    for (const x of [-.5, 0, .5]) teil(g, kegel(.13, .55, 6), "#9EA2AE", x, .75, 1.35, Math.PI / 2);
    for (const x of [-.82, .82]) for (const z of [-.75, .75]) rad(g, x, z, .45);
    teil(g, zyl(.45, .58, .9, 12), "#5E7350", 0, 1.55, -.1);
    teil(g, box(.95, .2, .5), "#6B4A2E", 0, 1.95, -.1);
    for (const s of [-1, 1]) teil(g, kapsel(.15, .5), "#5E7350", s * .55, 1.6, .3, 1.15);
    teil(g, kugel(.42), "#5E7350", 0, 2.32, 0);
    for (const s of [-1, 1]) teil(g, kegel(.05, .18, 6), "#EDE4D0", s * .14, 2.2, .38);
    return g;
  },
  ratte() {          // Riesenratte: rennt auf vier Beinen
    const g = neu(), F = "#8C7A6B";
    teil(g, kugel(.6), F, 0, .85, -.1).scale.set(1, .85, 1.7);
    teil(g, kegel(.36, .8, 10), F, 0, .95, 1.15, Math.PI / 2);
    teil(g, kugel(.08, 6), "#D98080", 0, .95, 1.55);
    for (const s of [-1, 1]) { teil(g, zyl(.18, .18, .04, 10), "#D9A0A0", s * .22, 1.3, .85, 0, 0, Math.PI / 2 * .6 * s); teil(g, kugel(.06, 6), "", s * .2, 1.08, 1.12, 0, 0, 0, GLUT("#E23B2E")); }
    teil(g, zyl(.04, .02, 1.8, 5), "#C9A0A0", 0, 1.0, -1.7, -1.2);
    const beine = [];
    for (const s of [-1, 1]) for (const z of [-.6, .55]) {
      const b = new THREE.Group(); b.position.set(s * .38, .65, z); b.userData.lose = true; g.add(b);
      teil(b, kapsel(.1, .4), "#7A6A5C", 0, -.3, 0); beine.push(b);
    }
    g.userData.anim = (k, t) => { const w = t / 1000 * (4 + k.v * .7); beine.forEach((b, i) => b.rotation.x = Math.sin(w + (i % 2 ? 0 : Math.PI) + (i > 1 ? Math.PI / 2 : 0)) * Math.min(.9, k.v / 12)); };
    return g;
  },
  schleim() {        // Schleim: hüpft
    const g = neu(), h = new THREE.Group(); h.userData.lose = true; g.add(h);
    const k = teil(h, kugel(.85, 18), "", 0, .75, 0, 0, 0, 0, new THREE.MeshLambertMaterial({ color: "#7BD64A", transparent: true, opacity: .82 })); k.scale.set(1, .8, 1.15);
    teil(h, kugel(.4, 10), "#4E9A2E", 0, .65, -.1);
    for (const s of [-1, 1]) { teil(h, kugel(.17, 10), "#FFFFFF", s * .3, 1.2, .55); teil(h, kugel(.08, 8), "#16161D", s * .3, 1.22, .69); }
    g.userData.anim = (kk, t) => { const p = Math.abs(Math.sin(t / 1000 * (5 + kk.v * .15))); h.position.y = p * .35; h.scale.set(1 + (1 - p) * .12, 1 - (1 - p) * .15, 1 + (1 - p) * .12); };
    return g;
  },
  pilzling() {       // Pilzling auf einem Kreisel
    const g = neu(), kr = new THREE.Group(); kr.userData.lose = true; g.add(kr);
    teil(kr, kegel(.75, .7, 10), "#6FB7D9", 0, .4, 0, Math.PI);
    teil(kr, zyl(.78, .78, .12, 10), "#3E5BB8", 0, .78, 0);
    for (let i = 0; i < 5; i++) teil(kr, box(.12, .14, .3), "#F5CF4A", Math.sin(i * 1.26) * .7, .78, Math.cos(i * 1.26) * .7, 0, i * 1.26);
    teil(g, zyl(.32, .4, .85, 12), "#EDE4D0", 0, 1.25, 0);
    for (const s of [-1, 1]) teil(g, kugel(.07, 6), "#16161D", s * .12, 1.35, .33);
    const hut = teil(g, kugel(.75, 16), "#D9483B", 0, 1.68, 0); hut.scale.set(1, .6, 1);
    for (const [x, y, z] of [[.3, 2.05, .3], [-.35, 2.0, .15], [.05, 2.12, -.3], [-.2, 1.95, -.5], [.55, 1.85, -.2]]) teil(g, kugel(.11, 6), "#FFFFFF", x, y, z);
    g.userData.anim = (k, t) => { kr.rotation.y = t / 1000 * (3 + k.v * .5); };
    return g;
  },
};

// Viele kleine Teile zu einem Netz zusammenbacken (ein Zeichenaufruf statt dreißig). Bewegliche Teile (Räder, Beine) bleiben eigenständig.
function backen(g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), sammeln = [];
  const lauf = o => { for (const c of [...o.children]) {
    if (c.userData.lose) { backen(c); continue; }
    if (c.isMesh && c.material.isMeshLambertMaterial && !c.material.transparent && !c.material.vertexColors && c.material.side === THREE.FrontSide) sammeln.push(c);
    lauf(c);
  } };
  lauf(g);
  if (sammeln.length < 2) return;
  const pos = [], nor = [], col = [], m = new THREE.Matrix4(), c = new THREE.Color();
  for (const o of sammeln) {
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    geo.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    const p = geo.attributes.position.array, n = geo.attributes.normal.array; c.copy(o.material.color);
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b);
  }
  for (const o of sammeln) { for (const k of [...o.children]) g.attach(k); o.parent.remove(o); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.add(new THREE.Mesh(geo, KART_MAT));
}
const KART_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });

// ---------- Kart ----------
const funkenGeo = new THREE.SphereGeometry(.13, 6, 4);
class Kart {
  constructor(typ, name, istIch, eigeneFarbe) {
    if (!TYPEN[typ]) typ = "kaempfer";
    this.typ = typ; this.st = TYPEN[typ]; this.name = name; this.ich = istIch;
    this.farbe = eigeneFarbe || TYPEN[typ].farbe || "#E23B2E";
    this.g = new THREE.Group(); this.koerper = MODELLE[typ](this.farbe); backen(this.koerper); this.g.add(this.koerper);
    this.g.traverse(o => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    const schatten = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: .3, depthWrite: false }));
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
  suchen() {                                     // nächster Streckenpunkt über die ganze Runde
    let best = Infinity, bi = 0;
    for (let i = 0; i < S; i += 3) { const q = (this.x - PX[i]) ** 2 + (this.z - PZ[i]) ** 2; if (q < best) { best = q; bi = i; } }
    this.idx = bi; this.naechster();
  }
  // Zustand eines anderen Handys übernehmen; dazwischen wird weitergerechnet und weich nachgeführt
  netzZustand(a) {
    const [x, y, z, yaw, v, s, drift, boost, prog, ladung] = a;
    const erst = !this.netz;
    this.netz = { x, y, z, yaw, v, t: performance.now() };
    this.s = s; this.drift = drift; this.boost = boost ? .2 : 0; this.ladung = ladung; this.netzProg = prog;
    if (erst) { this.x = x; this.y = y; this.z = z; this.yaw = this.mh = yaw; this.v = v; this.suchen(); this.prog = prog; }
  }
  folgen(dt) {
    const n = this.netz; if (!n) return;
    const alter = (performance.now() - n.t) / 1000;
    this.g.visible = this.schatten.visible = alter < 4;
    const a = Math.min(.3, alter), tx = n.x + Math.sin(n.yaw) * n.v * a, tz = n.z + Math.cos(n.yaw) * n.v * a;
    if (Math.hypot(tx - this.x, tz - this.z) > 15) { this.x = tx; this.z = tz; this.suchen(); }
    const f = 1 - Math.exp(-dt * 10);
    this.x += (tx - this.x) * f; this.z += (tz - this.z) * f; this.y += (n.y - this.y) * f;
    let d = n.yaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * f; this.mh = this.yaw;
    this.v = n.v; this.luft = this.y > hoehe(this.idx, this.d) + .2;
    this.naechster(); this.prog = this.netzProg;
  }
  zustand() {
    const r2 = v => Math.round(v * 100) / 100;
    return [r2(this.x), r2(this.y), r2(this.z), r2(this.yaw), r2(this.v), r2(this.s), this.drift, this.boost > 0 ? 1 : 0, this.prog, r2(this.ladung)];
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
    let maxV = st.maxV * (offroad ? (st.gelaende || .5) : 1);
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
    // Mauer
    if (Math.abs(this.d) > MAUER) {
      const zu = Math.abs(this.d) - MAUER, sg = Math.sign(this.d);
      this.x -= nX(this.idx) * sg * zu; this.z -= nZ(this.idx) * sg * zu; this.d = sg * MAUER;
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
    if (this.koerper.userData.anim) this.koerper.userData.anim(this, zeit);
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

// ---------- Truhen ----------
const kisten = [];
function truhenReihe(t) {
  const i = wrap(Math.round(t * S));
  for (const d of [-3.4, 0, 3.4]) {
    const g = new THREE.Group();
    teil(g, box(1.4, .75, 1.0), "#8A5A2E", 0, 0, 0);
    teil(g, new THREE.CylinderGeometry(.5, .5, 1.4, 12, 1, false, 0, Math.PI), "#9A6A3A", 0, .375, 0, 0, 0, Math.PI / 2);
    for (const x of [-.45, .45]) { teil(g, box(.12, .78, 1.04), "#E8C24A", x, 0, 0); teil(g, new THREE.CylinderGeometry(.53, .53, .12, 12, 1, false, 0, Math.PI), "#E8C24A", x, .375, 0, 0, 0, Math.PI / 2); }
    teil(g, box(.26, .3, .1), "#E8C24A", 0, .2, .52);
    backen(g); g.traverse(o => o.castShadow = true);
    const x = PX[i] + nX(i) * d, z = PZ[i] + nZ(i) * d;
    g.position.set(x, 1.1, z); sc.add(g);
    kisten.push({ g, x, z, weg: 0 });
  }
}
[.09, .4, .63, .86].forEach(truhenReihe);

// ---------- Minikarte ----------
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (let i = 0; i < S; i++) { minX = Math.min(minX, PX[i]); maxX = Math.max(maxX, PX[i]); minZ = Math.min(minZ, PZ[i]); maxZ = Math.max(maxZ, PZ[i]); }
const mf = Math.min(88 / (maxX - minX), 68 / (maxZ - minZ));
const mx = x => 52 + (x - (minX + maxX) / 2) * mf, mz = z => 42 + (z - (minZ + maxZ) / 2) * mf;
{
  let dd = ""; for (let i = 0; i <= S; i += 30) dd += (i ? "L" : "M") + mx(PX[wrap(i)]).toFixed(1) + " " + mz(PZ[wrap(i)]).toFixed(1);
  $("mini").innerHTML = `<path d="${dd}Z" fill="none" stroke="#5A4A3A" stroke-width="5" stroke-linejoin="round"/><path d="M${mx(PX[0] + nX(0) * 6)} ${mz(PZ[0] + nZ(0) * 6)}L${mx(PX[0] - nX(0) * 6)} ${mz(PZ[0] - nZ(0) * 6)}" stroke="#2A2118" stroke-width="2"/><g id="punkte"></g>`;
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
// Jedes Handy rechnet sein eigenes Kart selbst und schickt 15-mal pro Sekunde seinen Zustand an den Spielleiter.
// Der Spielleiter rechnet die Übungsgegner und schickt allen den Stand aller Karts.
let karts = [], ich = null, phase = "menue", uhr = 0, countdown = 0, liste = [], rennNr = 0, rennenVorbei = false;
let wahlTyp = heldOder(lager.lesen("kart:typ")), wahlGegner = Math.min(5, +(lager.lesen("kart:gegner") ?? 3));
// Jeder Mitspieler bekommt eine eigene Kart-Farbe, damit gleiche Fahrzeuge unterscheidbar sind
const SPIELERFARBEN = ["#E23B2E", "#2F6FDE", "#F2B705", "#2E9B4F", "#8B5CF6", "#F97316", "#E86FB0", "#38BDF8"];

// Startaufstellung: Reihen zu zweit hinter der Linie
function startplatz(n) { const reihe = Math.round(9 / (LAENGE / S)); return [wrap(-6 - (1 + Math.floor(n / 2)) * reihe), n % 2 ? -2.6 : 2.6]; }

function rennenAufbauen(raster) {
  karts.forEach(k => { sc.remove(k.g); sc.remove(k.schatten); });
  karts = []; ich = null;
  raster.forEach((e, n) => {
    const k = new Kart(e.typ, e.name, e.id === PID, e.farbe);
    k.id = e.id; k.bot = !!e.bot; k.remote = e.id !== PID && !(e.bot && modus !== "client");
    k.tempo = .9 + (n % 4) * .025;
    const [i, d] = startplatz(n); k.setzen(i, d); k.zeigen(0);
    karts.push(k); if (k.ich) ich = k;
  });
  $("punkte").innerHTML = karts.map((k, n) => `<circle r="${k.ich ? 4.5 : 3}" fill="${k.farbe}" stroke="#2A1A12" stroke-width="1.2"/>`).join("");
  document.querySelectorAll(".tag").forEach(t => t.remove());
  for (const k of karts) if (!k.ich) { k.tag = document.createElement("div"); k.tag.className = "tag"; k.tag.textContent = k.name; $("hud").appendChild(k.tag); }
  kisten.forEach(k => { k.weg = 0; k.g.visible = true; });
  liste = []; uhr = 0; rennenVorbei = false; extraAnzeigen();
  kamera(1, true);
}
// Übungsgegner: zufällige Monster, jedes nur einmal
function monsterRaster(n) {
  return Object.keys(MONSTER).sort(() => Math.random() - .5).slice(0, n).map((t, i) => ({ id: "bot" + i, name: MONSTER[t].name, typ: t, bot: true }));
}
function alleinRaster() {
  return [...monsterRaster(wahlGegner), { id: PID, name: name || "Du", typ: wahlTyp, farbe: SPIELERFARBEN[0] }];
}

function botEingabe(k, dt) {
  const vor = Math.round((10 + k.v * .9) / (LAENGE / S));
  const j = wrap(k.idx + vor);
  k.botTimer -= dt;
  if (k.botTimer <= 0) { k.botTimer = 2 + Math.random() * 3; k.spurZiel = (Math.random() - .5) * (BR - 4); }
  k.spur += ((k.spurZiel ?? 0) - k.spur) * Math.min(1, dt * .8);
  const tx = PX[j] + nX(j) * k.spur, tz = PZ[j] + nZ(j) * k.spur;
  let diff = Math.atan2(tx - k.x, tz - k.z) - k.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  // Gummiband: weit hinter dem führenden Menschen etwas schneller, weit vorne etwas langsamer
  const mensch = Math.max(...karts.filter(o => !o.bot).map(o => o.prog));
  const abstand = (mensch - k.prog) / S * LAENGE;
  k.st = { ...TYPEN[k.typ], maxV: TYPEN[k.typ].maxV * k.tempo * (abstand > 40 ? 1.08 : abstand < -60 ? .93 : 1) };
  if (k.item && Math.random() < dt * .5) { k.item = null; k.boost = 1.5; }
  return { lenk: Math.max(-1, Math.min(1, -diff * 2.2)), drift: false, direkt: true };
}

function extraZuenden() {
  if (phase !== "rennen" || !ich || !ich.item || ich.fertig != null) return;
  ich.item = null; ich.boost = Math.max(ich.boost, 1.6); extraAnzeigen(); melden("Flinktrank! 🧪");
}
function extraAnzeigen(neu) {
  const e = $("extra"); e.classList.toggle("leer", !ich || !ich.item);
  if (neu) { e.classList.remove("neu"); void e.offsetWidth; e.classList.add("neu"); }
}
let meldTimer = 0;
function melden(t, dauer = 1.4) { const m = $("meldung"); m.textContent = t; m.hidden = false; meldTimer = dauer; }

const zeitText = s => { const m = Math.floor(s / 60), r_ = s - m * 60; return `${m}:${r_ < 10 ? "0" : ""}${r_.toFixed(1).replace(".", ",")}`; };

// Zusammenstöße: nur die eigenen (hier gerechneten) Karts werden verschoben, die anderen schieben ihr Kart selbst weg
function stossen() {
  for (let a = 0; a < karts.length; a++) for (let b = a + 1; b < karts.length; b++) {
    const A = karts[a], B = karts[b];
    if (A.remote && B.remote) continue;
    if (Math.abs(A.y - B.y) > 1.2 || !A.g.visible || !B.g.visible) continue;
    const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
    if (d < 1.9 && d > .001) {
      const ueber = 1.9 - d, mA = A.st.masse, mB = B.st.masse, sum = mA + mB;
      const fA = B.remote ? mB / sum * 2 : mB / sum, fB = A.remote ? mA / sum * 2 : mA / sum;
      if (!A.remote) { A.x -= dx / d * ueber * Math.min(1, fA); A.z -= dz / d * ueber * Math.min(1, fA); }
      if (!B.remote) { B.x += dx / d * ueber * Math.min(1, fB); B.z += dz / d * ueber * Math.min(1, fB); }
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
    if (k.remote) { k.folgen(dt); continue; }
    const e = !rennt ? { lenk: k.ich ? ein.lenk : 0, gas: false, drift: false, direkt: true }
      : k.fertig != null ? (k.ich ? { lenk: botEingabe(k, dt).lenk, drift: false, direkt: true } : botEingabe(k, dt))
        : k.ich && !AUTO && !k.aufgegeben ? ein : botEingabe(k, dt);
    if (k.fertig != null && k.ich) k.st = { ...TYPEN[k.typ], maxV: TYPEN[k.typ].maxV * .6 };
    k.schritt(dt, e);
    // Runden
    const runde = Math.floor(k.prog / S);
    if (rennt && runde > k.runden.length && k.fertig == null && k.prog > 0) {
      k.runden.push(uhr - k.rundeStart); k.rundeStart = uhr;
      if (k.runden.length >= RUNDEN) { k.fertig = uhr; imZiel(k.id, uhr); if (k.ich) zielEinlauf(); }
      else if (k.ich) melden(k.runden.length === RUNDEN - 1 ? "Letzte Runde!" : `Runde ${k.runden.length + 1}`);
    }
    // Kisten
    if (rennt) for (const b of kisten) if (!b.weg && Math.hypot(b.x - k.x, b.z - k.z) < 1.8 && k.y < 2.5) {
      b.weg = 3.5; b.g.visible = false;
      if (!k.item) { k.item = "trank"; if (k.ich) extraAnzeigen(true); }
    }
  }
  stossen();
  for (const b of kisten) { if (b.weg > 0) { b.weg -= dt; if (b.weg <= 0) { b.weg = 0; b.g.visible = true; } } b.g.rotation.y += dt * 1.2; b.g.position.y = 1.1 + Math.sin(uhr * 3 + b.x) * .15; }
  if (meldTimer > 0) { meldTimer -= dt; if (meldTimer <= 0) $("meldung").hidden = true; }
}

// Zieleinlauf: allein und beim Spielleiter direkt in die Liste, sonst an den Spielleiter melden
function imZiel(id, zeit) {
  const k = karts.find(o => o.id === id);
  if (modus === "client") { if (id === PID) { senden({ t: "ziel", pid: PID, nr: rennNr, zeit }); eintragen(id, zeit); } return; }
  eintragen(id, zeit);
  if (modus === "host") ergebnisSenden();
}
function eintragen(id, zeit) {
  if (liste.some(e => e.id === id)) return;
  const k = karts.find(o => o.id === id);
  liste.push({ id, name: k ? k.name : "?", typ: k ? k.typ : "kaempfer", zeit });
  liste.sort((a, b) => (a.zeit ?? 1e9) - (b.zeit ?? 1e9));
}
function platzVon(k) {
  const fertig = liste.filter(e => e.zeit != null), i = fertig.findIndex(e => e.id === k.id);
  if (i >= 0) return i + 1;
  return fertig.length + 1 + karts.filter(o => o !== k && !liste.some(e => e.id === o.id) && o.prog > k.prog).length;
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
    c.style.display = k.g.visible ? "" : "none";
    if (k.tag) {
      v3.set(k.x, k.y + 2.8, k.z).project(cam);
      const sichtbar = k.g.visible && v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 && Math.hypot(k.x - ich.x, k.z - ich.z) < 120;
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

let zielInfo = null;
function zielEinlauf() {
  const p = platzVon(ich), gesamt = ich.fertig;
  const g = $("gross"); g.hidden = false; g.classList.add("klein"); g.textContent = karts.length > 1 ? `${p}. Platz!` : "Im Ziel!";
  const key = "kart:best:" + ich.typ, alt = +lager.lesen(key) || 0, rekord = !alt || gesamt < alt;
  if (rekord) lager.schreiben(key, gesamt);
  zielInfo = { alt, rekord };
  setTimeout(() => {
    if (phase !== "rennen" || !ich || ich.fertig == null) return;
    phase = "ziel"; g.hidden = true; zielZeigen();
  }, 2200);
}
function zielZeigen() {
  if (phase !== "ziel" && !(phase === "rennen" && ich && ich.aufgegeben)) return;
  const bestRunde = ich.runden.length ? Math.min(...ich.runden) : 0, mehr = karts.length > 1;
  const p = ich.fertig != null ? platzVon(ich) : null;
  let h = `<h1>${ich.aufgegeben ? "Aufgegeben" : (mehr ? `${p}. Platz` : "Im Ziel") + (zielInfo && zielInfo.rekord ? " · neue Bestzeit!" : "")}</h1>`;
  h += `<div class="zeile" style="align-items:flex-start;gap:28px"><table>`;
  if (ich.fertig != null) {
    h += ich.runden.map((t, i) => `<tr><td>Runde ${i + 1}</td><td><b>${zeitText(t)}</b>${t === bestRunde ? " ⚡" : ""}</td></tr>`).join("") + `<tr><td>Gesamt</td><td><b>${zeitText(ich.fertig)}</b></td></tr>`;
    if (zielInfo && zielInfo.alt && !zielInfo.rekord) h += `<tr><td class="leise">Bestzeit</td><td class="leise">${zeitText(zielInfo.alt)}</td></tr>`;
  }
  h += `</table>`;
  if (mehr) {
    const fertig = liste.filter(e => e.zeit != null), rest = karts.filter(k => !fertig.some(e => e.id === k.id)).sort((a, b) => b.prog - a.prog);
    h += `<table>${fertig.map((e, i) => `<tr><td>${i + 1}.</td><td>${e.id === PID ? "<b>Du</b>" : esc(e.name)}</td><td>${icon(e.typ)}</td><td class="leise">${zeitText(e.zeit)}</td></tr>`).join("")}
      ${rest.map(k => `<tr><td></td><td>${k.ich ? "<b>Du</b>" : esc(k.name)}</td><td>${icon(k.typ)}</td><td class="leise">${liste.some(e => e.id === k.id) ? "aufgegeben" : rennenVorbei ? "–" : "fährt noch …"}</td></tr>`).join("")}</table>`;
  }
  h += `</div><div class="zeile" style="justify-content:space-between">`;
  if (modus === "allein") h += `<a class="zurueck" href="../">‹ Spielauswahl</a><span><button class="los zweit" id="zumMenue">Einstellungen</button> <button class="los" id="nochmal">Nochmal</button></span>`;
  else if (modus === "host") h += `<button class="zurueck knopflos" id="verlassen">Raum schließen</button><span><button class="los zweit" id="zurLobby">Zur Lobby</button> <button class="los" id="nochmal">Nochmal</button></span>`;
  else h += `<button class="zurueck knopflos" id="verlassen">Raum verlassen</button><span class="leise">${esc(hostName())} startet das nächste Rennen.</span>`;
  h += `</div>`;
  $("zielKasten").innerHTML = h; $("ziel").hidden = false;
  if ($("nochmal")) $("nochmal").onclick = () => modus === "allein" ? alleinStarten() : rennenStarten();
  if ($("zumMenue")) $("zumMenue").onclick = () => menue("start");
  if ($("zurLobby")) $("zurLobby").onclick = () => { lobbyPhase = "lobby"; lobbySenden(); menue("lobby"); };
  if ($("verlassen")) $("verlassen").onclick = verlassen;
}

// ---------- Steuerung vorbereiten ----------
let sensorGefragt = false;
async function sensorErlauben() {      // muss direkt aus einem Tippen heraus kommen (iPhone)
  if (steuerung !== "neigen" || sensorGefragt) return;
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    try { const a = await DeviceOrientationEvent.requestPermission(); sensorGefragt = a === "granted"; if (!sensorGefragt) { steuerung = "tasten"; alert("Ohne Erlaubnis für den Bewegungssensor geht Neigen nicht. Ich schalte auf Tasten um."); } }
    catch { steuerung = "tasten"; }
  } else sensorGefragt = true;
}
function hudVorbereiten() {
  const t = steuerung === "tasten";
  $("hud").classList.toggle("tasten", t);
  $("klinks").hidden = $("krechts").hidden = !t;
  $("lenk").hidden = t && matchMedia("(pointer:coarse)").matches;
  $("lenktext").textContent = t ? "Pfeiltasten lenken" : "Handy neigen zum Lenken";
}
function countdownStarten(raster) {
  if (!raster.some(e => e.id === PID)) { menue("lobby"); return; }      // bin nicht dabei (zu spät gekommen)
  rennenAufbauen(raster);
  hudVorbereiten(); zielInfo = null;
  $("menue").hidden = true; $("ziel").hidden = true; $("pausiert").hidden = true; $("hud").hidden = false;
  phase = "countdown"; countdown = 3;
}
function alleinStarten() { modus = "allein"; countdownStarten(alleinRaster()); }

// ---------- Verbindung ----------
const params = new URLSearchParams(location.search);
const T = params.get("test") ? "-" + params.get("test") : "";
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k + T)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k + T, JSON.stringify(v)); } catch {} },
};
const ss = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k + T)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k + T, JSON.stringify(v)); } catch {} },
  del(k) { try { sessionStorage.removeItem(k + T); } catch {} },
};
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let PID = ls.get("slf:pid"); if (!PID) { PID = Math.random().toString(36).slice(2, 10); ls.set("slf:pid", PID); }
let name = ls.get("slf:name") || "";
const PREFIX = "fmwkart-", ZEICHEN = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
const PEER_OPT = window.SPIELEABEND_PEER ? window.SPIELEABEND_PEER() : { debug: 0 };
let modus = "allein", code = (params.get("raum") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
let peer = null, hostConn = null, verbunden = false, retry = null;
const conns = new Map();                  // Spielleiter: pid → Verbindung
const spieler = new Map();                // Spielleiter: pid → { name, typ, online }
let lobby = null, lobbyPhase = "lobby";   // Mitspieler: Kopie vom Spielleiter
const link = () => location.origin + location.pathname + "?raum=" + code + (params.get("test") ? "&test=" + params.get("test") : "");
const hostName = () => { const l = lobbyListe(); const h = l.find(e => e.host); return h ? h.name : "Der Spielleiter"; };

function netzStatus(t) { const n = $("netzstatus"); n.textContent = t || ""; n.hidden = !t; }
function senden(m) { if (modus === "host") return; if (hostConn && hostConn.open) { try { hostConn.send(m); } catch {} } }
function anAlle(m) { for (const [, c] of conns) { try { c.send(m); } catch {} } }

function lobbyListe() {
  if (modus === "host") return [{ pid: PID, name: name, typ: wahlTyp, online: true, host: true }, ...[...spieler].filter(([p]) => p !== PID).map(([pid, s]) => ({ pid, ...s }))];
  return lobby ? lobby.spieler : [];
}
function lobbySenden() {
  if (modus !== "host") return;
  ss.set("kart:host", { code, gegner: wahlGegner });
  anAlle({ t: "lobby", spieler: lobbyListe(), gegner: wahlGegner, phase: lobbyPhase, nr: rennNr });
  if (phase === "menue") menue("lobby");
}

function raumErstellen() {
  code = Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
  history.replaceState(null, "", "?raum=" + code + (params.get("test") ? "&test=" + params.get("test") : ""));
  hostStarten();
}
function hostStarten() {
  modus = "host"; lobbyPhase = "lobby";
  ss.set("kart:host", { code, gegner: wahlGegner });
  oeffneHost(); menue("lobby");
}
function oeffneHost() {
  if (peer) { try { peer.destroy(); } catch {} }
  verbunden = false;
  const p = peer = new Peer(PREFIX + code, PEER_OPT);
  p.on("open", () => { if (p !== peer) return; verbunden = true; netzStatus(""); if (phase === "menue") menue("lobby"); });
  p.on("connection", c => {
    c.on("data", m => vonClient(c, m));
    c.on("close", () => { for (const [pid, x] of conns) if (x === c) { conns.delete(pid); const s = spieler.get(pid); if (s) s.online = false; } lobbySenden(); });
    c.on("error", () => {});
  });
  p.on("disconnected", () => { if (p !== peer) return; setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch {} }, 2000); });
  p.on("error", e => {
    if (p !== peer) return;
    verbunden = false;
    netzStatus(e.type === "unavailable-id" ? "Raum wird geöffnet …" : "Keine Verbindung zum Vermittlungsdienst, neuer Versuch …");
    if (["unavailable-id", "network", "server-error", "socket-error", "socket-closed"].includes(e.type)) setTimeout(() => { if (p === peer) oeffneHost(); }, 3000);
  });
}
function vonClient(c, m) {
  if (!m || !m.pid) return;
  if (m.t === "hallo") {
    conns.set(m.pid, c);
    spieler.set(m.pid, { name: String(m.name || "?").slice(0, 20), typ: heldOder(m.typ), online: true });
    lobbySenden();
    if (lobbyPhase === "rennen") { try { c.send({ t: "ergebnis", nr: rennNr, liste, vorbei: rennenVorbei }); } catch {} }
  } else if (m.t === "typ" && spieler.has(m.pid) && HELDEN[m.typ]) { spieler.get(m.pid).typ = m.typ; lobbySenden(); }
  else if (m.t === "lauf" && m.nr === rennNr) { const k = karts.find(o => o.id === m.pid); if (k && k.remote) k.netzZustand(m.s); }
  else if (m.t === "ziel" && m.nr === rennNr) { eintragen(m.pid, +m.zeit); ergebnisSenden(); }
  else if (m.t === "aufgeben" && m.nr === rennNr) { eintragen(m.pid, null); ergebnisSenden(); }
}
function ergebnisSenden() {
  const menschen = karts.filter(k => !k.bot);
  if (!rennenVorbei && menschen.every(k => liste.some(e => e.id === k.id))) rennenVorbei = true;
  anAlle({ t: "ergebnis", nr: rennNr, liste, vorbei: rennenVorbei });
  zielZeigen();
}
function rennenStarten() {
  if (modus !== "host") return;
  rennNr++; lobbyPhase = "rennen";
  const menschen = lobbyListe().filter(e => e.online), raster = monsterRaster(wahlGegner);
  // Spieler in zufälliger Reihenfolge hinter die Übungsgegner
  menschen.sort(() => Math.random() - .5).forEach((e, n) => raster.push({ id: e.pid, name: e.name, typ: e.typ, farbe: SPIELERFARBEN[n % SPIELERFARBEN.length] }));
  lobbySenden();
  anAlle({ t: "start", nr: rennNr, raster });
  countdownStarten(raster);
}

function clientStarten() {
  modus = "client";
  if (peer) { try { peer.destroy(); } catch {} }
  const p = peer = new Peer(undefined, PEER_OPT);
  p.on("open", () => { if (p === peer) verbinde(); });
  p.on("disconnected", () => { if (p !== peer) return; setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch {} }, 2000); });
  p.on("error", e => { if (p !== peer) return; if (e.type === "peer-unavailable") nochmal(); else if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) nochmal(); });
  netzStatus("Verbinde mit Raum " + code + " …");
  menue("lobby");
}
function nochmal() { verbunden = false; hostConn = null; clearTimeout(retry); retry = setTimeout(verbinde, 2000); netzStatus(lobby ? "Verbindung zum Spielleiter weg, verbinde neu …" : "Suche Raum " + code + " …"); }
function verbinde() {
  if (!peer || peer.destroyed || !peer.open || (hostConn && hostConn.open)) return;
  const c = peer.connect(PREFIX + code, { serialization: "json", reliable: true });
  let offen = false;
  c.on("open", () => { offen = true; hostConn = c; verbunden = true; netzStatus(""); c.send({ t: "hallo", pid: PID, name, typ: wahlTyp }); });
  c.on("data", vomHost);
  c.on("close", () => { if (hostConn === c) nochmal(); });
  c.on("error", () => {});
  clearTimeout(retry); retry = setTimeout(() => { if (!offen) { try { c.close(); } catch {} nochmal(); } }, window.SPIELEABEND_WARTEN || 12000);
}
function vomHost(m) {
  if (!m) return;
  if (m.t === "lobby") {
    lobby = m; wahlGegner = m.gegner;
    if (m.phase === "lobby" && (phase === "ziel" || phase === "menue")) { phase = "menue"; menue("lobby"); }
    else if (phase === "menue") menue("lobby");
  } else if (m.t === "start") { rennNr = m.nr; countdownStarten(m.raster); }
  else if (m.t === "lauf" && m.nr === rennNr) {
    for (const [id, a] of m.k) { if (id === PID) continue; const k = karts.find(o => o.id === id); if (k && k.remote) k.netzZustand(a); }
  } else if (m.t === "ergebnis" && m.nr === rennNr) {
    const eigen = liste.find(e => e.id === PID);
    liste = m.liste.slice(); if (eigen && !liste.some(e => e.id === PID)) { liste.push(eigen); liste.sort((a, b) => (a.zeit ?? 1e9) - (b.zeit ?? 1e9)); }
    rennenVorbei = m.vorbei; zielZeigen();
  } else if (m.t === "zu") { ss.del("kart:host"); alert("Der Spielleiter hat den Raum geschlossen."); location.href = location.pathname; }
}
// 15-mal pro Sekunde: eigener Zustand an den Spielleiter, der Spielleiter schickt allen alles
let sendeTakt = 0;
function netzTakt(dt) {
  if (modus === "allein" || !ich || (phase !== "countdown" && phase !== "rennen" && phase !== "ziel" && phase !== "pause")) return;
  sendeTakt -= dt; if (sendeTakt > 0) return; sendeTakt = 1 / 15;
  if (modus === "client") senden({ t: "lauf", pid: PID, nr: rennNr, s: ich.zustand() });
  else anAlle({ t: "lauf", nr: rennNr, k: karts.filter(k => k.g.visible || !k.remote).map(k => [k.id, k.zustand()]) });
}
function verlassen() {
  if (modus === "host") { anAlle({ t: "zu" }); ss.del("kart:host"); }
  try { peer && peer.destroy(); } catch {}
  location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : "");
}

// ---------- Menüs ----------
let ansicht = "start";
function heldWahl() {
  const h = HELDEN[wahlTyp];
  return `<div class="wahlblock"><b class="etikett">Dein Held</b><div class="helden">${Object.entries(HELDEN).map(([t, f]) => `<button class="held ${t === wahlTyp ? "an" : ""}" data-typ="${t}">${window.VB ? VB.held(t) : ""}<span>${f.name}</span></button>`).join("")}</div>
    <p class="heldinfo"><b>${h.gefaehrt}</b> · ${h.klasse}: ${h.text}</p></div>`;
}
function lenkWahl() {
  return `<button class="wahl ${steuerung === "neigen" ? "an" : ""}" data-st="neigen">📱 Neigen</button><button class="wahl ${steuerung === "tasten" ? "an" : ""}" data-st="tasten">◀ ▶ Tasten</button>`;
}
function menue(a) {
  ansicht = a; phase = "menue";
  $("menue").hidden = false; $("ziel").hidden = true; $("pausiert").hidden = true; $("hud").hidden = true;
  let h = "";
  if (a === "start") {
    const best = +lager.lesen("kart:best:" + wahlTyp);
    h = `<div class="zeile" style="justify-content:space-between;align-items:baseline"><h1>Kerker-<span>Kart</span></h1><p class="leise">Testversion: Kerker, 3 Runden, bis zu 8 Leute</p></div>
      <div class="spalten"><div class="stapel">
        <label class="zeile namenszeile"><b>Name</b><input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
        ${heldWahl()}
        <div class="zeile"><b>Lenken</b>${lenkWahl()}</div>
        ${best ? `<p class="leise">Deine Bestzeit als ${HELDEN[wahlTyp].name}: ${zeitText(best)}</p>` : ""}
      </div><div class="stapel">
        <div class="box"><b class="titelchen">Zusammen fahren</b><button class="los" id="erstellen">Raum erstellen</button>
          <div class="zeile"><input id="code" maxlength="4" autocapitalize="characters" placeholder="Code" value="${esc(code)}"><button class="los zweit" id="beitreten">Beitreten</button></div></div>
        <div class="box"><b class="titelchen">Allein üben</b><div class="zeile">${[3, 5, 0].map(n => `<button class="wahl ${wahlGegner === n || (n === 3 && wahlGegner && wahlGegner !== 5) ? "an" : ""}" data-geg="${n}">${n ? n + " Monster" : "ohne"}</button>`).join("")}<button class="los zweit" id="allein">Los</button></div></div>
      </div></div>
      <div class="zeile" style="justify-content:space-between"><a class="zurueck" href="../">‹ Spielauswahl</a><span class="leise">Am Computer: Pfeiltasten, Leertaste = Drift, E = Extra</span></div>`;
  } else if (a === "einladung") {
    h = `<div><h1>Kerker-<span>Kart</span></h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></div>
      <div class="stapel">
        <label class="zeile namenszeile"><b>Name</b><input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
        ${heldWahl()}
        <div class="zeile"><b>Lenken</b>${lenkWahl()}</div>
      </div>
      <div class="zeile" style="justify-content:space-between"><button class="zurueck knopflos" id="abbrechen">‹ Abbrechen</button><button class="los" id="mitfahren">Mitfahren</button></div>`;
  } else if (a === "lobby") {
    const host = modus === "host", l = lobbyListe(), da = l.filter(e => e.online);
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 1, scalable: true }); } } catch {}
    h = `<div class="spalten"><div class="stapel">
        <div class="zeile" style="gap:14px;flex-wrap:nowrap">${qr ? `<div class="qr">${qr}</div>` : ""}<div class="stapel"><p class="etikett">Raumcode</p><div class="code">${esc(code)}</div><button class="los zweit klein" id="teilen">Link teilen</button></div></div>
        <b class="titelchen">Im Raum (${da.length})</b>
        <ul class="spielerliste">${l.map(e => `<li class="${e.online ? "" : "weg"}">${icon(e.typ)}${esc(e.name)}${e.host ? " <small>Spielleiter</small>" : ""}${e.pid === PID ? " <small>du</small>" : ""}${e.online ? "" : " <small>nicht verbunden</small>"}</li>`).join("") || `<li class="weg">…</li>`}</ul>
      </div><div class="stapel">
        ${heldWahl()}
        <div class="zeile"><b>Lenken</b>${lenkWahl()}</div>
        ${host ? `<div class="zeile"><b>Monster</b>${[0, 1, 2, 3, 4, 5].map(n => `<button class="wahl ${wahlGegner === n ? "an" : ""}" data-geg="${n}">${n}</button>`).join("")}</div>` : `<p class="leise">Monster als Gegner: ${wahlGegner}</p>`}
        ${host ? `<button class="los" id="rennstart">Rennen starten</button>` : `<p class="warte">${lobby && lobby.phase === "rennen" ? "Ein Rennen läuft gerade. Beim nächsten bist du dabei." : `Warte, bis ${esc(hostName())} das Rennen startet …`}</p>`}
        <button class="zurueck knopflos" id="verlassen" style="align-self:flex-start">${host ? "Raum schließen" : "Raum verlassen"}</button>
      </div></div>`;
  }
  $("menueKasten").innerHTML = h;
  menueBinden();
}
function nameAus() {
  const f = $("name"); if (!f) return true;
  const n = (f.value || "").trim().slice(0, 20); if (!n) { f.focus(); f.classList.add("fehlt"); return false; }
  name = n; ls.set("slf:name", n); return true;
}
function menueBinden() {
  const nameMerken = () => { const f = $("name"); if (f) { name = f.value.trim().slice(0, 20); } };
  document.querySelectorAll("[data-typ]").forEach(b => b.onclick = () => {
    nameMerken(); wahlTyp = b.dataset.typ; lager.schreiben("kart:typ", wahlTyp);
    if (modus === "client") senden({ t: "typ", pid: PID, typ: wahlTyp });
    if (modus === "host") lobbySenden(); else menue(ansicht);
  });
  document.querySelectorAll("[data-st]").forEach(b => b.onclick = async () => { nameMerken(); steuerung = b.dataset.st; lager.schreiben("kart:steuerung", steuerung); await sensorErlauben(); menue(ansicht); });
  document.querySelectorAll("[data-geg]").forEach(b => b.onclick = () => { nameMerken(); wahlGegner = +b.dataset.geg; lager.schreiben("kart:gegner", wahlGegner); if (modus === "host") lobbySenden(); else menue(ansicht); });
  const klick = (id, f) => { if ($(id)) $(id).onclick = f; };
  klick("allein", async () => { if (!nameAus()) return; await sensorErlauben(); alleinStarten(); });
  klick("erstellen", async () => { if (!nameAus()) return; await sensorErlauben(); raumErstellen(); });
  klick("beitreten", async () => {
    if (!nameAus()) return;
    const c = ($("code").value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.length !== 4) { $("code").focus(); return; }
    await sensorErlauben(); code = c;
    history.replaceState(null, "", "?raum=" + code + (params.get("test") ? "&test=" + params.get("test") : ""));
    clientStarten();
  });
  klick("mitfahren", async () => { if (!nameAus()) return; await sensorErlauben(); clientStarten(); });
  klick("abbrechen", () => { code = ""; history.replaceState(null, "", location.pathname); menue("start"); });
  klick("rennstart", async () => { await sensorErlauben(); rennenStarten(); });
  klick("verlassen", verlassen);
  klick("teilen", () => { if (navigator.share) navigator.share({ title: "Kerker-Kart", text: "Fahr mit! Raum " + code, url: link() }).catch(() => {}); else { try { navigator.clipboard.writeText(link()); $("teilen").textContent = "Kopiert"; } catch { prompt("Link kopieren:", link()); } } });
  // Im Rennen gestartet ohne Sensor-Erlaubnis (Mitspieler): beim ersten Tippen nachholen
}
document.addEventListener("pointerdown", () => { if (steuerung === "neigen" && !sensorGefragt && phase !== "menue") sensorErlauben(); });

// ---------- Pause / Menü im Rennen ----------
let vorPause = null;
function pause(an) {
  if (modus !== "allein") {     // zu mehreren läuft das Rennen weiter
    if (an && (phase === "rennen" || phase === "countdown")) $("pausiert").hidden = false; else $("pausiert").hidden = true;
    return;
  }
  if (an && (phase === "rennen" || phase === "countdown")) { vorPause = phase; phase = "pause"; $("pausiert").hidden = false; }
  else if (!an && phase === "pause") { phase = vorPause; $("pausiert").hidden = true; }
}
$("pause").onclick = () => pause(true);
$("weiter").onclick = () => pause(false);
$("abbruch").onclick = () => {
  if (modus === "allein") return menue("start");
  $("pausiert").hidden = true;
  if (ich && ich.fertig == null && !ich.aufgegeben) {
    ich.aufgegeben = true;
    if (modus === "client") { senden({ t: "aufgeben", pid: PID, nr: rennNr }); eintragen(PID, null); }
    else { eintragen(PID, null); ergebnisSenden(); }
    phase = "ziel"; zielZeigen();
  }
};
document.addEventListener("visibilitychange", () => { if (document.hidden && modus === "allein") pause(true); });

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
    netzTakt(dt);
  }
  flackern(jetzt / 1000);
  r.render(sc, cam);
  requestAnimationFrame(loop);
}

// ---------- Start ----------
rennenAufbauen(alleinRaster());
const gespeichert = ss.get("kart:host");
if (typeof Peer === "undefined") { menue("start"); netzStatus("Die Verbindungsbibliothek fehlt: zusammen fahren geht gerade nicht."); }
else if (code && gespeichert && gespeichert.code === code) { wahlGegner = gespeichert.gegner ?? wahlGegner; hostStarten(); }
else if (code) menue("einladung");
else menue("start");
requestAnimationFrame(loop);
window.KART = { get phase() { return phase; }, get ich() { return ich; }, karts: () => karts, ein, S, LAENGE, get liste() { return liste; }, get modus() { return modus; },
  sim(sek) { for (let t = 0; t < sek; t += 1 / 60) { update(1 / 60); } }, aufbauen: rennenAufbauen, cam, sc, r, THREE, neigung: () => neigung, lenkWert, set steuerung(v) { steuerung = v; } };
