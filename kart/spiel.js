// Kerker-Kart (Arbeitstitel): Die Helden aus Dungeons & Disappointments fahren durch den Kerker.
// Lenken durch Neigen des Handys im Querformat (wie ein Lenkrad) oder mit Tasten. Konzept: KONZEPT.md
import * as THREE from "three";
import { WELTEN, planWuerfeln, planCode, planAusCode, kontrollpunkte, rng } from "./strecke.js?v=2026-11-20p";

const $ = id => document.getElementById(id);
const TEST_RUNDEN = +(new URLSearchParams(location.search).get("runden")) || 0;   // ?runden=1 zum Testen
let RUNDEN = TEST_RUNDEN || 3;                      // vom Spielleiter in der Lobby gewählt (2, 3 oder 4)
// Rennflüche (im Feldzug wählt der Letzte einen für das nächste Rennen)
const FLUECHE = {
  nacht: { name: "Nacht", bild: "🌙", text: "nur Fackellicht, die Strecke ist schwer zu lesen" },
  glatteis: { name: "Glatteis", bild: "🧊", text: "alle rutschen mehr" },
  fallen: { name: "Fallenmeister", bild: "🪤", text: "doppelt so viele Fallen-Extras" },
  koepfe: { name: "Riesenköpfe", bild: "🗿", text: "alle Fahrer mit riesigem Kopf" },
  spiegel: { name: "Spiegelstrecke", bild: "🪞", text: "die Strecke ist seitenverkehrt" },
  gold: { name: "Goldrausch", bild: "💰", text: "doppelt so viel Gold, die Heldenkraft lädt schneller" },
  mimik: { name: "Mimik-Plage", bild: "👅", text: "jede dritte Truhe beißt" },
};
let fluch = null;
const AUTO = new URLSearchParams(location.search).has("auto");   // Test: eigenes Kart fährt selbst
const BR = 12;                      // Fahrbahnbreite
const RAND = BR / 2 + 1.3;          // ab hier Geröll (langsamer)
const MAUER = BR / 2 + 8;           // hier ist Schluss
const lager = { lesen(k) { try { return localStorage.getItem(k); } catch { return null; } }, schreiben(k, v) { try { localStorage.setItem(k, v); } catch {} } };

// ---------- Fahrer ----------
// Helden aus dem Verlies, jeder mit eigenem Gefährt. gelaende: Tempo auf Geröll (sonst 0,5)
const HELDEN = {
  kaempfer: { name: "Kämpfer", gefaehrt: "Streitwagen", klasse: "schwer", text: "schiebt alle weg, beschleunigt langsam", maxV: 27.5, accel: 11.5, turn: 1.75, grip: 11, drift: 1.25, masse: 1.8 },
  paladin: { name: "Paladin", gefaehrt: "Panzerlore", klasse: "schwer", text: "Treffer werfen ihn nur halb so lang aus der Bahn", maxV: 27, accel: 12.5, turn: 1.8, grip: 11.5, drift: 1.3, masse: 1.7 },
  dieb: { name: "Dieb", gefaehrt: "geklauter Handkarren", klasse: "leicht", text: "flink und wendig, erkennt Mimik-Truhen", maxV: 26, accel: 17, turn: 2.2, grip: 9.5, drift: 1.55, masse: .8 },
  waldlaeufer: { name: "Waldläufer", gefaehrt: "Baumstamm-Renner", klasse: "mittel", text: "Geröll bremst ihn kaum", maxV: 27, accel: 14, turn: 1.95, grip: 10, drift: 1.35, masse: 1, gelaende: .82 },
  magierin: { name: "Magierin", gefaehrt: "fliegender Teppich", klasse: "leicht", text: "sehr schnell, schwebt über Pfützen und Krähenfüße, rutscht in Kurven", maxV: 28.5, accel: 13.5, turn: 1.85, grip: 6.5, drift: 1.35, masse: .8 },
  heilerin: { name: "Heilerin", gefaehrt: "Kräuterkarren", klasse: "mittel", text: "nach Treffern schnell wieder auf Tempo", maxV: 27, accel: 15, turn: 1.95, grip: 10, drift: 1.4, masse: 1 },
  moench: { name: "Mönch", gefaehrt: "Rollkissen", klasse: "leicht", text: "beste Beschleunigung, driftet stark", maxV: 25.5, accel: 18, turn: 2.25, grip: 9, drift: 1.6, masse: .75 },
  nekromant: { name: "Nekromant", gefaehrt: "rollender Sarg", klasse: "mittel", text: "schnell, aber träge in Kurven", maxV: 28, accel: 13, turn: 1.8, grip: 9.5, drift: 1.35, masse: 1.15 },
  bardin: { name: "Bardin", gefaehrt: "Lautenwagen", klasse: "mittel", text: "Gold lädt ihre Heldenkraft doppelt", maxV: 26.5, accel: 15.5, turn: 2.05, grip: 10, drift: 1.45, masse: .95 },
  hexe: { name: "Hexe", gefaehrt: "Kessel auf Rädern", klasse: "schwer", text: "Fledermäuse und Sporen lassen schnell von ihr ab", maxV: 27.5, accel: 12.5, turn: 1.85, grip: 10.5, drift: 1.3, masse: 1.5 },
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
// Heldenkräfte: die Kraftleiste füllt sich durch Gold, Driften und Treffer, die man landet (wer hinten liegt, lädt schneller)
const KRAEFTE = {
  kaempfer: { name: "Wirbelschlag", text: "dreht sich eine Sekunde wie ein Kreisel, alles in der Nähe fliegt weg, Geschosse prallen ab" },
  paladin: { name: "Schildwall", text: "4 Sekunden prallt alles ab, wen er rammt, der fliegt" },
  dieb: { name: "Langfinger", text: "3 Sekunden unsichtbar, wen er dabei überholt, dem klaut er das Extra" },
  waldlaeufer: { name: "Pfeilhagel", text: "drei Pfeile auf die drei nächsten Karts vor ihm" },
  magierin: { name: "Eislanze", text: "das nächste Kart vor ihr friert ein und schlittert, die Stelle bleibt glatt" },
  heilerin: { name: "Segen", text: "alle Störungen fallen ab, 5 Sekunden lang gibt jeder Treffer Schub statt Dreher" },
  moench: { name: "Windschritt", text: "2 Sekunden rasend schnell und unberührbar, weicht blitzschnell seitlich aus" },
  nekromant: { name: "Skelett rufen", text: "zwei Knochenkrieger springen auf die Karts hinter ihm und bremsen sie" },
  bardin: { name: "Schlaflied", text: "die drei Karts vor ihr werden 2 Sekunden schläfrig: langsam und schwer zu lenken" },
  hexe: { name: "Verwandeln", text: "das Kart vor ihr wird 3 Sekunden zur hüpfenden Kröte, langsam und ohne Extras" },
};
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
const hemi = new THREE.HemisphereLight("#FFE6C4", "#3A2C24", 1.35); sc.add(hemi);
const sonne = new THREE.DirectionalLight("#FFD9A6", 1.7);
sonne.castShadow = true; sonne.shadow.mapSize.set(1024, 1024);
Object.assign(sonne.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
sc.add(sonne, sonne.target);
const laterne = new THREE.PointLight("#FFC98A", 0, 34, 1.2); laterne.position.set(0, -50, 0); sc.add(laterne);   // nur beim Fluch Nacht an
const matCache = new Map();
const M = c => { if (!matCache.has(c)) matCache.set(c, new THREE.MeshLambertMaterial({ color: c })); return matCache.get(c); };
const glutCache = new Map();          // selbstleuchtend (Flammen, Augen, Kugeln): kein Licht nötig
const GLUT = c => { if (!glutCache.has(c)) glutCache.set(c, new THREE.MeshBasicMaterial({ color: c })); return glutCache.get(c); };
function groesse() { const w = innerWidth, h = innerHeight; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }
addEventListener("resize", groesse); groesse();

const boden = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: "#2E2723" }));
boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true; sc.add(boden);

// ---------- Strecke ----------
// Die Strecke wird vor jedem Rennen aus Abschnitten neu gebaut (Varianten in strecke.js). Alles, was zur Strecke gehört,
// hängt an streckeG und wird beim nächsten Bau weggeräumt. Positionen auf der Strecke: Index i (0 … S-1) und Seitenabstand d.
const S = 3000;
const PX = new Float32Array(S), PZ = new Float32Array(S), TX = new Float32Array(S), TZ = new Float32Array(S);
const MAUERW = new Float32Array(S).fill(MAUER);     // Abstand der Mauer je Streckenpunkt (auf der Brücke schmaler)
const BELAG = new Uint8Array(S);                    // 0 Stein, 1 nass (schneller, aber rutschig)
const HOCH = new Float32Array(S), NEIG = new Float32Array(S);   // Hügel: Höhe der Fahrbahnmitte und Querneigung (Steilkurve) je Streckenpunkt
const STEIG = new Float32Array(S);                  // Steigung in Fahrtrichtung (für Tempo und Kartneigung)
let runen = [];                                     // Schubrunen auf der Fahrbahn
// Echte Gabelungen: zwei getrennte Wege. Je Streckenpunkt die Mitte des linken (-1) und rechten (+1) Weges, quer zur Mittellinie.
const WEG = new Uint8Array(S), WEG_L = new Float32Array(S), WEG_R = new Float32Array(S), WEG_LANG = new Int8Array(S);
let wege = [];
// Gleitstellen: Loch in der Strecke (kein Boden), davor eine Schanze; Gleiten erlaubt von der Schanze bis kurz nach dem Loch
const LOCH = new Uint8Array(S), GLEIT = new Uint8Array(S), LOCH_ZIEL = new Int16Array(S);
let gleitstellen = [], aufwinde = [], strudel = [];
const BOOT = 2;                                     // BELAG: Wasser, das Kart schwimmt
const WEG_RAND = BR / 2 + 2.5;                      // von der Wegmitte bis zur Mauer
const wegMitte = (i, s) => s < 0 ? WEG_L[i] : WEG_R[i];
const wegSeite = (i, d) => Math.abs(d - WEG_L[i]) < Math.abs(d - WEG_R[i]) ? -1 : 1;
const wegQuer = (i, d) => WEG[i] ? d - wegMitte(i, wegSeite(i, d)) : d;           // Abstand zur Mitte des eigenen Weges
const inselDa = i => WEG[i] && WEG_R[i] - WEG_L[i] > 2 * WEG_RAND + .6;
// Eine Stelle sicher auf eine Fahrbahn legen (für Teleport, Steine, Feuer): in der Gabelung auf den nächsten Weg
// Quer-Lage d auf dem Weg, auf dem o gerade fährt (vor einer Gabelung: zufällig einer der beiden)
const wegZiel = (o, j, d) => (WEG[j] ? wegMitte(j, WEG[o.idx] ? wegSeite(o.idx, o.d) : Math.random() < .5 ? -1 : 1) : 0) + d;
function aufWeg(i, d, rand = 1) {
  const m = WEG[i] ? wegMitte(i, wegSeite(i, d)) : 0;
  return m + klemmen(d - m, -BR / 2 + rand, BR / 2 - rand);
}
const nX = i => -TZ[i], nZ = i => TX[i];            // Normale (seitlich)
const wrap = i => ((i % S) + S) % S;
const vorab = (i, i0) => wrap(i - i0);              // wie weit liegt i hinter i0, in Fahrtrichtung gezählt
let LAENGE = 1000, SCHRITT = 1 / 3, STRICH = 12;
const meter = m => Math.round(m / SCHRITT);
let plan = null, abschnitte = [], rampen = [], gabeln = [], loren = [], pendel = [], pfosten = [], rattenStellen = [], troll = null, koenig = null;
const SCHLUCHT = new Int8Array(S);                  // Schlucht neben der Fahrbahn: Seite +1/-1, 2 = beide Seiten (Hängebrücke)
let welt = "kerker", TH = null, pilzSprung = null, tropfen = [], schluchten = [], haengebruecken = [];
// Glutschlund: Geysire (auf der Fahrbahn und als Sprung), Pfade über die Lava (sinkende Steine, einstürzende Brücke), Lavaspalten
let geysire = [], geysirSprung = null, pfade = [], spalten = [], lavaHoch = false, flutBaender = [];
let streckeG = null, zufall = Math.random, fackeln = [], flammen = [], belegt = [];
const hashf = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };

function hoehe(i, d) {
  const grund = HOCH[i] + NEIG[i] * (d < -MAUER - 1.3 ? -MAUER - 1.3 : d > MAUER + 1.3 ? MAUER + 1.3 : d);
  if (Math.abs(d) > BR / 2 + 1.3) return grund;
  for (const r of rampen) { const v = vorab(i, r.i0); if (v <= r.n) return grund + r.h * v / r.n; }
  return grund;
}
const gabelDrin = (i, f) => { const v = vorab(i, f.i0); return v > 0 && v <= f.n; };

function band(innen, aussen, farbe, y, von = 0, bis = S, hFn, ziel = streckeG) {
  const pos = [], col = [], c = new THREE.Color();
  for (let i = von; i < bis; i++) {
    const a = wrap(i), b = wrap(i + 1);
    const ya = y + (hFn ? hFn(a) : 0), yb = y + (hFn ? hFn(b) : 0);
    const ia = typeof innen === "function" ? innen(a) : innen, aa = typeof aussen === "function" ? aussen(a) : aussen;
    const ib = typeof innen === "function" ? innen(b) : innen, ab = typeof aussen === "function" ? aussen(b) : aussen;
    const P = (k, d, yy) => [PX[k] + nX(k) * d, yy, PZ[k] + nZ(k) * d];
    const q = [P(a, ia, ya), P(a, aa, ya), P(b, ab, yb), P(b, ib, yb)];
    pos.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
    c.set(farbe(i)); for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  m.receiveShadow = true; ziel.add(m); return m;
}

function lavaBand(innen, aussen, y, von, bis) {
  const m = band(innen, aussen, lavaFarbe, y, von, bis); m.material.dispose(); m.material = lavaMat; m.receiveShadow = false; return m;
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
const scheinGruen = new THREE.MeshBasicMaterial({ map: scheinTex, color: "#55FFB0", transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false });
// Aussehen der Welten
const THEMEN = {
  kerker: { himmel: "#140F14", hemi: ["#FFE6C4", "#3A2C24", 1.35], sonne: ["#FFD9A6", 1.7], boden: "#2E2723", platte: ["#9A8F82", "#8C8275", "#A39888"], nass: ["#5E7E80", "#567476", "#66888A"],
    kante: ["#E6D6AE", "#8E2F22"], geroell: ["#4E443B", "#463D35"], stein: ["#6B6158", "#62584F", "#73695F", "#5D544C"], pfeiler: "#574E46", schein: scheinMat, wasser: ["#1E3A44", "#22424C"] },
  grotte: { himmel: "#07110E", hemi: ["#C4F7E0", "#1A2620", 1.3], sonne: ["#BDF7D8", 1.35], boden: "#18201C", platte: ["#8E998F", "#838F86", "#98A39A"], nass: ["#4F8790", "#477D86", "#5A929A"],
    kante: ["#D4F7E4", "#2F7A64"], geroell: ["#2E3A34", "#29342E"], stein: ["#44514A", "#3C4842", "#4C5952", "#36423C"], pfeiler: "#2E3A33", schein: scheinGruen, wasser: ["#123A3A", "#164444"] },
  glut: { himmel: "#1C0806", hemi: ["#FFD2B0", "#4A1A10", 1.55], sonne: ["#FFB27A", 1.6], boden: "#1E1513", platte: ["#857873", "#7A6E6A", "#8E817B"], nass: ["#857873", "#7A6E6A", "#8E817B"],
    kante: ["#FFE2B0", "#B8321C"], geroell: ["#2C201D", "#261B19"], stein: ["#2E252B", "#272027", "#362C33", "#221B20"], pfeiler: "#2B2229", schein: scheinMat, wasser: ["#C2410C", "#EA580C"] },
};
// Lava leuchtet selbst (kein Licht nötig) und pulsiert; ein Material für alle Lavaflächen
const lavaMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const LAVA = ["#C2410C", "#EA580C", "#F97316", "#9A3412"];
const lavaFarbe = i => LAVA[Math.floor(hashf(Math.floor(i / 5), 3) * 3.4)];
const dampfMat = new THREE.MeshBasicMaterial({ color: "#F4EDE6", transparent: true, opacity: .45, depthWrite: false });
const fluegelMat = new THREE.MeshLambertMaterial({ color: "#5A140E", side: THREE.DoubleSide });
// Spinnennetz als Bild (Netztunnel, Nest)
const netzTex = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const x = cv.getContext("2d"); x.strokeStyle = "rgba(240,250,245,.95)"; x.lineWidth = 3;
  const n = 12, R = 124;
  for (let k = 0; k < n; k++) { const w = k / n * Math.PI * 2; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(w) * R, 128 + Math.sin(w) * R); x.stroke(); }
  x.lineWidth = 2;
  for (let r = 14; r < R; r += 13) { x.beginPath(); for (let k = 0; k <= n; k++) { const w = k / n * Math.PI * 2, rr = r + Math.sin(k * 2.3) * 2; x[k ? "lineTo" : "moveTo"](128 + Math.cos(w) * rr, 128 + Math.sin(w) * rr); } x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const netzMat = new THREE.MeshBasicMaterial({ map: netzTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });

// Viele gleiche Teile als eine Instanz-Gruppe: liste = [[x, y, z, drehY, groesse, farbe?], …]
function instanzen(geo, mat, liste, schatten = true) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, liste.length)), o = new THREE.Object3D(), c = new THREE.Color();
  liste.forEach(([x, y, z, ry = 0, s = 1, farbe], i) => {
    o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    if (farbe) im.setColorAt(i, c.set(farbe));
  });
  im.count = liste.length; im.castShadow = schatten; im.receiveShadow = true; streckeG.add(im); return im;
}
const punkt = (i, d) => ({ x: PX[i] + nX(i) * d, z: PZ[i] + nZ(i) * d, rot: Math.atan2(TX[i], TZ[i]) });
function frei(x, z, abstand) {
  for (let i = 0; i < S; i += 6) if ((PX[i] - x) ** 2 + (PZ[i] - z) ** 2 < abstand * abstand) return false;
  return true;
}
// Innenseite einer Kurve zwischen zwei Streckenpunkten: +1 oder -1
function innenSeite(i0, i1) {
  let sum = 0; const n = vorab(i1, i0);
  for (let k = 0; k < n; k += 4) { const a = wrap(i0 + k), b = wrap(i0 + k + 4); let d = Math.atan2(TX[b], TZ[b]) - Math.atan2(TX[a], TZ[a]); sum += Math.atan2(Math.sin(d), Math.cos(d)); }
  return sum < 0 ? 1 : -1;
}

// Gebäude: Steinblock mit Zinnen, erleuchteten Fenstern und Schild
function bau(i, seite, w, h, d, farbe, schild, gitter, quer) {
  const p = punkt(i, quer ?? seite * (MAUER + 3 + d / 2));
  const g = new THREE.Group();
  const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(farbe)); k.position.y = h / 2; k.castShadow = k.receiveShadow = true; g.add(k);
  const zinne = new THREE.BoxGeometry(1.2, 1.1, 1.2);
  for (let n = 0; n <= Math.floor(w / 2.4); n++) for (const s of [-1, 1]) { const z = new THREE.Mesh(zinne, M(farbe)); z.position.set(-w / 2 + .6 + n * (w - 1.2) / Math.floor(w / 2.4), h + .55, s * (d / 2 - .6)); g.add(z); }
  const fen = GLUT("#FFB45A"), fg = new THREE.PlaneGeometry(1, 1.6);
  for (let a = 0; a < Math.floor((w - 2) / 4.2); a++) for (let j = 0; j < Math.floor((h - 2) / 4); j++) {
    for (const s of [-1, 1]) { const f = new THREE.Mesh(fg, fen); f.position.set(-w / 2 + 3 + a * 4.2, 2.6 + j * 4, s * (d / 2 + .02)); if (s < 0) f.rotation.y = Math.PI; g.add(f); }
  }
  if (schild) {
    const sl = schild.length * 1.25 + 2, b = new THREE.Mesh(new THREE.BoxGeometry(sl, 2, .3), schildMat(schild, "#F3E6CC", "#2A2118", 1024, 160));
    b.position.set(0, h + 2.4, 0); g.add(b);
    const b2 = b.clone(); b2.rotation.y = Math.PI; b2.position.z = .01; g.add(b2);
  }
  if (gitter) { const st = new THREE.CylinderGeometry(.09, .09, 6, 6); for (let n = 0; n < Math.floor(w * .8); n++) { const b = new THREE.Mesh(st, M("#2A2A30")); b.position.set(-w * .4 + n, 3, seite * (d / 2 + .15)); g.add(b); } }
  g.position.set(p.x, 0, p.z); g.rotation.y = p.rot + Math.PI / 2; streckeG.add(g);
  belegt.push({ x: p.x, z: p.z, r: Math.hypot(w, d) / 2 + 2 });
  return g;
}

// Alles wegräumen, was zur alten Strecke gehörte (geteilte Materialien bleiben)
function entsorgen(g) {
  const geteilt = new Set([...matCache.values(), ...glutCache.values(), scheinMat, scheinGruen, netzMat, ROT_RAND, MUENZ_MAT, lavaMat, dampfMat, fluegelMat, schwingenMat, aufwindMat, pfeilMat, strudelMat, runenMat]);
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) if (!geteilt.has(m)) { if (m.map) m.map.dispose(); m.dispose(); }
  });
}

function streckeBauen(p) {
  plan = p; welt = WELTEN[p.w] ? p.w : "kerker"; TH = THEMEN[welt]; zufall = rng(p.s * 7 + 13); fluch = FLUECHE[p.f] ? p.f : null;
  sc.background.set(TH.himmel); sc.fog.color.set(TH.himmel); hemi.color.set(TH.hemi[0]); hemi.groundColor.set(TH.hemi[1]); hemi.intensity = TH.hemi[2];
  sonne.color.set(TH.sonne[0]); sonne.intensity = TH.sonne[1]; boden.material.color.set(TH.boden);
  const nacht = fluch === "nacht";               // Fluch Nacht: kaum Licht, nahe Nebelwand, nur eine Laterne am eigenen Kart
  if (nacht) { hemi.intensity *= .22; sonne.intensity *= .12; sc.background.set("#050306"); sc.fog.color.set("#050306"); }
  sc.fog.near = nacht ? 12 : 55; sc.fog.far = nacht ? 62 : 200; laterne.intensity = nacht ? 40 : 0;
  if (streckeG) { sc.remove(streckeG); entsorgen(streckeG); }
  streckeG = new THREE.Group(); sc.add(streckeG);
  let { kp, start } = kontrollpunkte(p);
  if (fluch === "spiegel") kp = kp.map(([x, z]) => [-x, z]);
  const kurve = new THREE.CatmullRomCurve3(kp.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "catmullrom", .5);
  for (let i = 0; i < S; i++) {
    const q = kurve.getPointAt(i / S), t = kurve.getTangentAt(i / S);
    PX[i] = q.x; PZ[i] = q.z; TX[i] = t.x; TZ[i] = t.z;
  }
  LAENGE = kurve.getLength(); SCHRITT = LAENGE / S; STRICH = meter(4);
  MAUERW.fill(MAUER); BELAG.fill(0); SCHLUCHT.fill(0); HOCH.fill(0); NEIG.fill(0); STEIG.fill(0); runen = []; WEG.fill(0); WEG_L.fill(0); WEG_R.fill(0); WEG_LANG.fill(0); wege = [];
  LOCH.fill(0); GLEIT.fill(0); UEBER.fill(0); ueberfuehrungen = []; gleitstellen = []; aufwinde = []; strudel = [];
  rampen = []; gabeln = []; loren = []; pendel = []; pfosten = []; rattenStellen = []; troll = null; koenig = null; belegt = []; fackeln = [];
  pilzSprung = null; tropfen = []; schluchten = []; haengebruecken = [];
  geysire = []; geysirSprung = null; pfade = []; spalten = []; lavaHoch = false; flutBaender = [];
  kisten.length = 0; muenzen.length = 0;
  muenzGeo = new THREE.CylinderGeometry(.5, .5, .13, 16); muenzGeo.rotateX(Math.PI / 2);
  // Abschnitte: Knoten auf Streckenpunkte abbilden
  const knoten = start.map(k => { const [x, z] = kp[k]; let best = 1e12, bi = 0; for (let i = 0; i < S; i++) { const q = (PX[i] - x) ** 2 + (PZ[i] - z) ** 2; if (q < best) { best = q; bi = i; } } return bi; });
  knoten[0] = 0;
  abschnitte = (WELTEN[welt]).abschnitte.map((a, n) => ({ von: knoten[n], bis: knoten[(n + 1) % knoten.length], name: a.varianten[p.v[n]].name, v: a.varianten[p.v[n]] }));
  const stelle = (n, u) => wrap(Math.round(abschnitte[n].von + vorab(abschnitte[n].bis, abschnitte[n].von) * u));
  const seiteVon = (s, n, u) => s === "innen" || s === "aussen" ? innenSeite(stelle(n, Math.max(0, u - .2)), stelle(n, Math.min(1, u + .2))) * (s === "innen" ? 1 : -1) : s;

  // Dinge der Abschnitte
  abschnitte.forEach((a, n) => {
    for (const d of a.v.dinge) {
      if (d.art === "haus") bau(stelle(n, d.bei), seiteVon(d.seite, n, d.bei), d.w, d.h, d.d, d.farbe, d.schild, d.gitter);
      else if (d.art === "rampe") rampen.push({ i0: stelle(n, d.von), n: vorab(stelle(n, d.bis), stelle(n, d.von)), h: d.h, treppe: !!d.treppe });
      else if (d.art === "nass") { const i0 = stelle(n, d.von), m = vorab(stelle(n, d.bis), i0); for (let k = 0; k <= m; k++) BELAG[wrap(i0 + k)] = 1; a.kanal = d.kanal || d.see ? [i0, m] : null; a.nass = [i0, m]; }
      else if (d.art === "schlucht") {
        const i0 = stelle(n, d.von), m = vorab(stelle(n, d.bis), i0), sg = seiteVon(d.seite, n, (d.von + d.bis) / 2);
        for (let k = 0; k <= m; k++) { const j = wrap(i0 + k); SCHLUCHT[j] = SCHLUCHT[j] && SCHLUCHT[j] !== sg ? 2 : sg; }
        schluchten.push({ i0, m, s: sg });
      }
      else if (d.art === "haengebruecke") {
        const i0 = stelle(n, d.von), m = vorab(stelle(n, d.bis), i0);
        for (let k = 0; k <= m; k++) SCHLUCHT[wrap(i0 + k)] = 2;
        haengebruecken.push({ i0, m });
      }
      else if (d.art === "tunnel") {
        const i0 = stelle(n, d.von), f = { art: "tunnel", nr: gabeln.length, i0, n: vorab(stelle(n, d.bis), i0), torY: { "-1": 6, "1": 6 }, platte: null, offen: true };
        f.innen = innenSeite(i0, wrap(i0 + f.n)); f.netze = [.12, .36, .6, .84].map(u => Math.round(f.n * u)); f.staerke = [3, 3, 3, 3];
        gabeln.push(f);
      }
      else if (d.art === "koenigin") koenig = { art: "spinne", i: stelle(n, d.bei), s: seiteVon(d.seite, n, d.bei), anim: 0 };
      else if (d.art === "spinnen") d.bei.forEach((u, k) => rattenStellen.push({ i: stelle(n, u), phase: k * 3.1, art: "spinne" }));
      else if (d.art === "eier") eierDeko(stelle(n, d.bei), seiteVon(d.seite, n, d.bei));
      else if (d.art === "pilzhaus") pilzHaus(stelle(n, d.bei), seiteVon(d.seite, n, d.bei));
      else if (d.art === "tropfen") d.bei.forEach((u, k) => tropfen.push({ i: stelle(n, u), phase: k * 1.9, nr: tropfen.length }));
      else if (d.art === "pilzsprung") {
        // Landestelle: der nächste Streckenpunkt weiter vorn (jenseits der Schlucht)
        const i = stelle(n, d.bei); let best = 1e12, b = -1;
        for (let k = meter(45); k < S / 2; k++) { const j = wrap(i + k), dd = (PX[j] - PX[i]) ** 2 + (PZ[j] - PZ[i]) ** 2; if (dd < best) { best = dd; b = j; } }
        const sg = Math.sign((PX[b] - PX[i]) * nX(i) + (PZ[b] - PZ[i]) * nZ(i)) || 1;
        pilzSprung = { i, s: sg, b, sprung: vorab(b, i) };
      }
      else if (d.art === "lava") {
        const i0 = stelle(n, d.von), m = vorab(stelle(n, d.bis), i0), sg = seiteVon(d.seite, n, (d.von + d.bis) / 2);
        for (let k = 0; k <= m; k++) { const j = wrap(i0 + k); SCHLUCHT[j] = SCHLUCHT[j] && SCHLUCHT[j] !== sg ? 2 : sg; }
        schluchten.push({ i0, m, s: sg, lava: true });
      }
      else if (d.art === "geysirsprung" || d.art === "steine" || d.art === "einsturz") {
        // Gegenüber: der nächste Streckenpunkt jenseits der Lava (auf der Strecke deutlich weiter weg als quer drüber)
        const i = stelle(n, d.bei); let best = 1e12, b = -1;
        for (let k = meter(30); k < S / 2; k++) { const j = wrap(i + k), dd = (PX[j] - PX[i]) ** 2 + (PZ[j] - PZ[i]) ** 2; if (dd < best && (k * SCHRITT) ** 2 > 2.2 * dd) { best = dd; b = j; } }
        const sg = Math.sign((PX[b] - PX[i]) * nX(i) + (PZ[b] - PZ[i]) * nZ(i)) || 1;
        if (d.art === "geysirsprung") geysirSprung = { i, s: sg, b, sprung: vorab(b, i), phase: zufall() * 4 };
        else {
          const sb = Math.sign((PX[i] - PX[b]) * nX(b) + (PZ[i] - PZ[b]) * nZ(b)) || 1, a = punkt(i, sg * (BR / 2 + 1.2)), z = punkt(b, sb * (BR / 2 + 1.2));
          const len = Math.hypot(z.x - a.x, z.z - a.z);
          pfade.push({ art: d.art, nr: pfade.length, i, s: sg, b, sb, ax: a.x, az: a.z, ux: (z.x - a.x) / len, uz: (z.z - a.z) / len, len, hp: 5, weg: false, fallT: 0, phase: zufall() * 7 });
        }
      }
      else if (d.art === "geysire") d.stuecke.forEach(([u, dd], k) => { const i = stelle(n, u), q = punkt(i, dd); geysire.push({ i, d: dd, x: q.x, z: q.z, phase: k * 1.37 + zufall() }); });
      else if (d.art === "drache") koenig = { art: "drache", i: stelle(n, d.bei), s: seiteVon(d.seite, n, d.bei), anim: 0 };
      else if (d.art === "spalte") { const e = stelle(n, d.bei); spalten.push({ i0: wrap(e + meter(1)), n: meter(5), zurueck: wrap(e - meter(45)) }); }
      else if (d.art === "bruecke") { const i0 = stelle(n, d.von), m = vorab(stelle(n, d.bis), i0); for (let k = 0; k <= m; k++) MAUERW[wrap(i0 + k)] = RAND + .6; a.bruecke = [i0, m]; }
      else if (d.art === "gabel" || d.art === "wand") {
        const i0 = stelle(n, d.von), f = { art: d.art, nr: gabeln.length, i0, n: vorab(stelle(n, d.bis), i0), torY: { "-1": 6, "1": 6 }, platte: null, offen: false };
        if (d.art === "wand") f.innen = innenSeite(i0, wrap(i0 + f.n));
        gabeln.push(f);
      }
      else if (d.art === "lore") {
        const i0 = stelle(n, d.von), s = seiteVon(d.seite, n, (d.von + d.bis) / 2), laenge = vorab(stelle(n, d.bis), i0) * SCHRITT;
        loren.push({ i0, s, railD: s * (RAND + 3.4), laenge, weiche: laenge * (d.weiche - d.von) / (d.bis - d.von), tot: zufall() < .5 ? "ab" : "gerade" });
      }
      else if (d.art === "gleit") {
        const i0 = stelle(n, d.von), m = vorab(stelle(n, d.bis), i0), ende = wrap(i0 + m + meter(3));
        for (let k = 0; k <= m; k++) { LOCH[wrap(i0 + k)] = 1; LOCH_ZIEL[wrap(i0 + k)] = ende; }
        for (let k = -meter(3); k <= m + meter(30); k++) GLEIT[wrap(i0 + k)] = 1;
        gleitstellen.push({ i0, m, ende });
        for (const [u, dd] of d.aufwind || []) { const i = stelle(n, u), q = punkt(i, dd); aufwinde.push({ i, d: dd, x: q.x, z: q.z }); }
      }
      else if (d.art === "wasser") {
        const i0 = stelle(n, d.von), m = vorab(stelle(n, d.bis), i0); for (let k = 0; k <= m; k++) BELAG[wrap(i0 + k)] = BOOT; a.nass = [i0, m]; a.wasser = [i0, m];
        for (const [u, dd] of d.strudel || []) { const i = stelle(n, u), q = punkt(i, dd); strudel.push({ i, d: dd, x: q.x, z: q.z }); }
      }
      else if (d.art === "ueberfuehrung") ueberfuehrungAnlegen(a.von, a.bis);
      else if (d.art === "weggabel") wegAnlegen(stelle(n, d.von), vorab(stelle(n, d.bis), stelle(n, d.von)), d);
      else if (d.art === "pendel") d.bei.forEach((u, k) => pendel.push({ i: stelle(n, u), phase: k * 2.1 }));
      else if (d.art === "faesser" || d.art === "ruestung" || d.art === "tropfstein" || d.art === "kristall" || d.art === "obsidian") for (const [u, dd] of d.stuecke) { const q = punkt(stelle(n, u), dd); pfosten.push({ x: q.x, z: q.z, r: d.art === "faesser" ? .75 : d.art === "ruestung" ? .7 : .85, art: d.art, rot: q.rot, i: stelle(n, u), d: dd }); }
      else if (d.art === "ratten") d.bei.forEach((u, k) => rattenStellen.push({ i: stelle(n, u), phase: k * 3.1 }));
      else if (d.art === "koenig") koenig = { art: "knochen", i: stelle(n, d.bei), s: seiteVon(d.seite, n, d.bei), anim: 0 };
      else if (d.art === "troll") {
        const i = stelle(n, d.bei);
        // Landestelle: der nächste Streckenpunkt jenseits der Mauer, weiter vorn auf der Strecke
        let best = 1e12, b = -1, s = 1;
        for (const sg of [-1, 1]) {
          const q = punkt(i, sg * (MAUER + 8));
          for (let k = meter(50); k < S / 2; k++) { const j = wrap(i + k), dd = (PX[j] - q.x) ** 2 + (PZ[j] - q.z) ** 2; if (dd < best) { best = dd; b = j; s = sg; } }
        }
        const q = punkt(i, s * (MAUER + 8)), ld = klemmen((q.x - PX[b]) * nX(b) + (q.z - PZ[b]) * nZ(b), -BR / 2 + 1.5, BR / 2 - 1.5);
        troll = { i, s, b, ld, sprung: vorab(b, i) };
      }
    }
    for (const u of a.v.truhen || []) truhenReihe(stelle(n, u));
    // eine Reihe Goldstücke je Abschnitt, nicht direkt an den Truhen
    let u = .3 + zufall() * .4; if ((a.v.truhen || []).some(t => Math.abs(t - u) < .15)) u = u < .5 ? u + .25 : u - .25;
    goldReihe(stelle(n, u), (zufall() - .5) * 5, zufall() * 6);
    if (fluch === "gold") goldReihe(stelle(n, u > .5 ? u - .2 : u + .2), (zufall() - .5) * 5, zufall() * 6);
  });

  // Fahrbahn
  const nassFarbe = TH.nass, PLATTE = TH.platte;
  ausserhalbWege((von, bis) => {
    for (let j = 0; j < 3; j++) band(-BR / 2 + j * BR / 3, -BR / 2 + (j + 1) * BR / 3, i => BELAG[wrap(i)] === BOOT ? TH.wasser[(Math.floor(i / STRICH) + (j === 1 ? 1 : 0)) % 2] : (BELAG[wrap(i)] ? nassFarbe : PLATTE)[(Math.floor(i / (STRICH * .75) + j * .5) + j) % 3], .05, von, bis);
    for (const sg of [-1, 1]) {
      band(sg * BR / 2, sg * (BR / 2 + 1.3), i => (Math.floor(i / (STRICH * .6)) % 2 ? TH.kante[0] : TH.kante[1]), .05, von, bis);
      band(sg * RAND, i => sg * (MAUERW[i] + .2), i => MAUERW[wrap(i)] < MAUER ? (welt === "glut" ? "#9A3412" : "#1E3A44") : (Math.floor(i / STRICH) % 3 ? TH.geroell[0] : TH.geroell[1]), .03, von, bis);
    }
  });
  wegeBauen();
  gleitWasserBauen();
  // Wasser unter Brücke und in der Kanalisation
  for (const a of abschnitte) {
    if (a.bruecke) for (const sg of [-1, 1]) {
      if (welt === "glut") lavaBand(sg * (RAND + .6), sg * (MAUER + 12), .02, a.bruecke[0], a.bruecke[0] + a.bruecke[1]);
      else band(sg * (RAND + .6), sg * (MAUER + 12), i => (Math.floor(i / STRICH) % 2 ? "#1E3A44" : "#22424C"), .02, a.bruecke[0], a.bruecke[0] + a.bruecke[1]);
    }
    if (a.kanal) for (const sg of [-1, 1]) band(sg * (RAND + .5), sg * (MAUER - 1), i => (Math.floor(i / STRICH) % 2 ? (welt === "grotte" ? "#1E5652" : "#2C4A48") : (welt === "grotte" ? "#24605B" : "#33554F")), .06, a.kanal[0], a.kanal[0] + a.kanal[1]);
  }
  // Schluchten: schwarzer Abgrund neben der Fahrbahn, Hängebrücke aus Planken
  for (const c of schluchten) {
    if (!c.lava) { band(c.s * RAND, c.s * (MAUER + 30), i => (Math.floor(i / STRICH) % 2 ? "#040807" : "#060C0A"), .04, c.i0, c.i0 + c.m); continue; }
    const breit = i => { const v = vorab(wrap(i), c.i0), r = Math.min(v, c.m - v) / meter(16); return c.s * (RAND + (MAUER + 22 - RAND) * (r >= 1 ? 1 : Math.sqrt(Math.max(0, r)))); };   // rund auslaufen
    lavaBand(c.s * RAND, breit, .04, c.i0, c.i0 + c.m);
    // steigt die Lava (Runde 3), überflutet sie die Randstreifen
    const f = lavaBand(c.s * (BR / 2 - .1), c.s * (RAND + .2), .075, c.i0 + meter(2), c.i0 + c.m - meter(2)); f.visible = false; flutBaender.push(f);
  }
  for (const sp of spalten) lavaBand(-MAUER - 1, MAUER + 1, .07, sp.i0, sp.i0 + sp.n);
  if (pilzSprung) { const P = pilzSprung; band(P.s * (RAND - .2), P.s * (RAND + 3.6), i => (Math.floor(i / meter(2)) % 2 ? "#55625A" : "#4C5850"), .07, P.i - meter(24), P.i + meter(1)); }
  for (const h of haengebruecken) {
    for (const sg of [-1, 1]) band(sg * (RAND - 1), sg * (MAUER + 30), i => (Math.floor(i / STRICH) % 2 ? "#040807" : "#060C0A"), .06, h.i0, h.i0 + h.m);
    band(-RAND + 1, RAND - 1, i => (Math.floor(i / meter(1.1)) % 3 ? "#7A5A3A" : "#6A4C30"), .09, h.i0, h.i0 + h.m);
    const pfo = [], seile = [];
    for (let k = 0; k <= h.m; k += meter(4)) for (const sg of [-1, 1]) {
      const i = wrap(h.i0 + k), q = punkt(i, sg * (RAND - .7)); pfo.push([q.x, .7, q.z, q.rot]);
      if (k + meter(4) <= h.m) { const j = wrap(h.i0 + k + meter(2)), r2 = punkt(j, sg * (RAND - .7)); seile.push([r2.x, 1.2, r2.z, r2.rot]); }
    }
    instanzen(box(.25, 1.4, .25), M("#4A3426"), pfo);
    instanzen(box(.07, .07, 4.1), M("#C9B48A"), seile, false);
  }
  // Rampen und Treppen
  for (const r of rampen) {
    band(-BR / 2 - 1.3, BR / 2 + 1.3, i => (Math.floor(vorab(wrap(i), r.i0) / 3) % 2 ? "#B5A894" : "#9C907E"), .08, r.i0, r.i0 + r.n, k => hoehe(k, 0));
    const k = wrap(r.i0 + r.n), g = new THREE.Mesh(new THREE.BoxGeometry(BR + 2.6, r.h, .4), M("#7E7466"));
    g.position.set(PX[k], r.h / 2, PZ[k]); g.rotation.y = Math.atan2(TX[k], TZ[k]); streckeG.add(g);
    for (const s of [-1, 1]) {
      const gl = new THREE.Mesh(new THREE.BoxGeometry(.25, 1.1, r.n * SCHRITT), M("#4A3F36"));
      const m = wrap(r.i0 + Math.round(r.n / 2)); gl.position.set(PX[m] + nX(m) * s * (BR / 2 + 1.5), r.h / 2 + .9, PZ[m] + nZ(m) * s * (BR / 2 + 1.5));
      gl.rotation.y = Math.atan2(TX[m], TZ[m]); gl.rotation.x = -Math.atan2(r.h, r.n * SCHRITT); streckeG.add(gl);
    }
  }
  // Start/Ziel-Linie
  for (let k = 0; k < BR; k++) for (let j = 0; j < 2; j++) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M((k + j) % 2 ? "#F3E6CC" : "#16161D"));
    q.rotation.x = -Math.PI / 2; q.rotation.z = Math.atan2(TX[0], TZ[0]);
    const d = -BR / 2 + .5 + k, f = j - .5;
    q.position.set(PX[0] + nX(0) * d + TX[0] * f, .1, PZ[0] + nZ(0) * d + TZ[0] * f); streckeG.add(q);
  }

  // Mauer am Rand, Pfeiler mit Fackeln; auf der Brücke ein Geländer, an der Treppe offen, am Troll eingestürzt
  {
    const steine = [], pfeiler = [], scheine = [], gelaender = [], STEIN = TH.stein;
    const n = Math.floor(LAENGE / 2.2);
    for (let j = 0; j < n; j++) {
      const i = Math.floor(j * S / n);
      if (rampen.some(r => r.treppe && vorab(i, wrap(r.i0 - 8)) <= r.n + 12)) continue;
      if (WEG[i] || LOCH[i] || UEBER[i]) continue;
      for (const s of [-1, 1]) {
        const rot = Math.atan2(TX[i], TZ[i]) + Math.PI / 2;
        if (SCHLUCHT[i] === s || SCHLUCHT[i] === 2) continue;
        if (MAUERW[i] < MAUER) { const q = punkt(i, s * (MAUERW[i] + .3)); gelaender.push([q.x, .6, q.z, rot]); continue; }
        if (troll && s === troll.s && Math.abs(((i - troll.i + S / 2) % S + S) % S - S / 2) < meter(8)) { if (j % 2) { const q = punkt(i, s * (MAUER + .7)); steine.push([q.x, .3, q.z, rot + zufall(), .55, STEIN[0]]); } continue; }
        const d = s * (MAUER + .7);
        steine.push([PX[i] + nX(i) * d, 1.1, PZ[i] + nZ(i) * d, rot, 1, STEIN[Math.floor(zufall() * 4)]]);
        if (j % 7 === 0) {
          pfeiler.push([PX[i] + nX(i) * d, 2.4, PZ[i] + nZ(i) * d, rot]);
          const df = s * (welt === "grotte" ? MAUER + .7 : MAUER - .2); fackeln.push([PX[i] + nX(i) * df, welt === "grotte" ? 5.6 : 3.9, PZ[i] + nZ(i) * df]);
          const ds = s * (MAUER - 3); scheine.push([PX[i] + nX(i) * ds, .14, PZ[i] + nZ(i) * ds]);
        }
      }
    }
    // Trennwände der Gabelungen
    for (const f of gabeln) for (let k = 0; k <= f.n; k += meter(2.2)) { const i = wrap(f.i0 + k); steine.push([PX[i], .9, PZ[i], Math.atan2(TX[i], TZ[i]) + Math.PI / 2, .75, STEIN[Math.floor(zufall() * 4)]]); }
    instanzen(new THREE.BoxGeometry(2.4, 2.2, 1.3), new THREE.MeshLambertMaterial({ color: "#ffffff" }), steine);
    instanzen(new THREE.BoxGeometry(2.3, 1.2, .25), M("#4A3426"), gelaender);
    if (welt === "grotte") {          // Leuchtpilze statt Pfeiler und Fackeln
      instanzen(new THREE.CylinderGeometry(.45, .7, 5, 8), M("#D6E4D8"), pfeiler.map(([x, , z, r]) => [x, 2.5, z, r]));
      const kappe = new THREE.SphereGeometry(2.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      instanzen(kappe, GLUT("#3FD9A4"), pfeiler.map(([x, , z, r], n) => [x, 4.8, z, r, .85 + (n % 3) * .12]), false);
    } else {
      instanzen(new THREE.BoxGeometry(1.6, 4.8, 1.6), M(TH.pfeiler), pfeiler);
      instanzen(new THREE.CylinderGeometry(.09, .06, .9, 6), M("#4A3426"), fackeln.map(([x, y, z]) => [x, y - .5, z]), false);
    }
    const sg = new THREE.PlaneGeometry(13, 13); sg.rotateX(-Math.PI / 2);
    const ims = instanzen(sg, TH.schein, scheine, false); ims.receiveShadow = false;
  }
  flammen = welt === "grotte"
    ? [instanzen(new THREE.SphereGeometry(.22, 6, 4), GLUT("#A6FFDA"), fackeln.map(([x, y, z]) => [x, y + .2, z]), false),
      instanzen(new THREE.SphereGeometry(.13, 6, 4), GLUT("#F0FFF8"), fackeln.map(([x, y, z]) => [x + .5, y + .1, z]), false)]
    : [instanzen(new THREE.ConeGeometry(.28, .9, 6), GLUT("#FF8A2A"), fackeln.map(([x, y, z]) => [x, y + .2, z]), false),
      instanzen(new THREE.ConeGeometry(.16, .6, 6), GLUT("#FFE07A"), fackeln.map(([x, y, z]) => [x, y + .1, z]), false)];

  streckeDingeBauen();
  hallenDeko();
  startBogen();
  minikarte();
  huegelBauen();
  ueberfuehrungBauen();
  sperrenBauen();
  ereignisDingeBauen();
}

// ---------- Hügel ----------
// Nach dem Bau der flachen Strecke bekommen ruhige Abschnitte (ohne Gitter, Loren, Schluchten, Wasser …) Kuppen, lange Hügel
// mit Abfahrt und Steilkurven. Danach wird alles in streckeG auf die neue Höhe gehoben: die Fahrbahn verformt, Mauern und Deko
// verschoben. Außen fällt eine Böschung zum Boden ab. Alles hängt nur vom Plan ab, ist also auf allen Handys gleich.
const RANDW = MAUER + 1.3, HG = 8;
let hgGitter = new Map(), hgX0 = 0, hgZ0 = 0;
const BOESCH = new Float32Array(2 * S);              // Breite der Böschung je Streckenpunkt (links, rechts)
const hgKey = (cx, cz) => cx * 4096 + cz;
function hgBauen() {
  let x0 = 1e9, z0 = 1e9; for (let i = 0; i < S; i++) { x0 = Math.min(x0, PX[i]); z0 = Math.min(z0, PZ[i]); }
  hgX0 = x0 - 80; hgZ0 = z0 - 80; hgGitter = new Map();
  for (let i = 0; i < S; i++) { if (UEBER[i]) continue; const k = hgKey(Math.floor((PX[i] - hgX0) / HG), Math.floor((PZ[i] - hgZ0) / HG)); if (!hgGitter.has(k)) hgGitter.set(k, []); hgGitter.get(k).push(i); }
}
// Nächster Streckenpunkt im Umkreis r (oder -1); mit fern: nur Punkte, die auf der Strecke weiter als fern Punkte von i0 weg sind
function nahPunkt(x, z, r, i0 = -1, fern = 0) {
  const cx = Math.floor((x - hgX0) / HG), cz = Math.floor((z - hgZ0) / HG), n = Math.ceil(r / HG);
  let best = r * r, bi = -1;
  for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
    const l = hgGitter.get(hgKey(cx + a, cz + b)); if (!l) continue;
    for (const i of l) {
      if (fern && Math.min(vorab(i, i0), vorab(i0, i)) < fern) continue;
      const q = (PX[i] - x) ** 2 + (PZ[i] - z) ** 2; if (q < best) { best = q; bi = i; }
    }
  }
  return bi;
}
// Höhe des Geländes an einer beliebigen Stelle: auf der Strecke wie hoehe(), außen entlang der Böschung zum Boden
function hoeheAn(x, z) {
  let i = nahPunkt(x, z, RANDW + 3); if (i < 0) i = nahPunkt(x, z, RANDW + 26); if (i < 0) return 0;
  if (!HOCH[i] && !NEIG[i]) return 0;
  const d = (x - PX[i]) * nX(i) + (z - PZ[i]) * nZ(i), a = Math.abs(d);
  const g = HOCH[i] + NEIG[i] * klemmen(d, -RANDW, RANDW);
  if (a <= RANDW) return g;
  return g * Math.max(0, 1 - (a - RANDW) / Math.max(.01, BOESCH[(d > 0 ? S : 0) + i]));
}
const glatt = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
function huegelBauen() {
  hgBauen();
  // 1. Wo es flach bleiben muss
  const flach = new Uint8Array(S), rand = meter(18);
  const sperr = (i0, n = 0, r = rand) => { for (let k = -r; k <= n + r; k++) flach[wrap(i0 + k)] = 1; };
  sperr(0, 0, meter(45));
  for (const r of rampen) sperr(r.i0, r.n);
  for (const f of gabeln) sperr(f.i0, f.n, meter(25));
  for (const f of loren) sperr(f.i0, meter(f.laenge + 16));
  for (const x of pendel) sperr(x.i);
  for (const x of rattenStellen) sperr(x.i, 0, meter(25));
  for (const x of tropfen) sperr(x.i);
  for (const c of schluchten) sperr(c.i0, c.m);
  for (const h of haengebruecken) sperr(h.i0, h.m);
  for (const g of geysire) sperr(g.i);
  for (const sp of spalten) { sperr(sp.i0, sp.n, meter(25)); sperr(sp.zurueck, 0, meter(10)); }
  for (const P of pfade) { sperr(P.i, 0, meter(30)); sperr(P.b, 0, meter(30)); }
  for (const x of [troll, pilzSprung, geysirSprung]) if (x) { sperr(x.i, 0, meter(30)); sperr(x.b, 0, meter(30)); }
  if (koenig) sperr(koenig.i, 0, meter(45));
  for (const a of abschnitte) for (const z of [a.bruecke, a.nass, a.kanal]) if (z) sperr(z[0], z[1]);
  for (const W of wege) sperr(W.i0, W.n, meter(20));
  for (const g of gleitstellen) sperr(g.i0, g.m + meter(30), meter(30));
  for (const U of ueberfuehrungen) { sperr(U.i0, U.n, meter(25)); sperr(U.unten, 0, meter(60)); }
  for (let i = 0; i < S; i += 3) {                 // wo die Strecke nah an sich selbst vorbeiführt
    if (flach[i]) continue;
    for (const sg of [-1, 1]) { const q = punkt(i, sg * RANDW); if (nahPunkt(q.x, q.z, RANDW + 8, i, meter(60)) >= 0) { sperr(i, 3, meter(6)); break; } }
  }
  SPERR.set(flach);                                // für Händlerstand, Hebel, Kronleuchter, Zuschauer
  // 2. Freie Strecken finden und Höhen hineinlegen
  const laeufe = [];
  let st = 0; while (st < S && !flach[st]) st++;
  for (let k = 0, a = -1; k <= S; k++) { const i = wrap(st + k); if (k < S && !flach[i]) { if (a < 0) a = i; } else if (a >= 0) { laeufe.push([a, vorab(i, a)]); a = -1; } }
  const hill = new Float32Array(S), runenPlan = [];
  for (const [a, n] of laeufe) {
    const L = n * SCHRITT, w = zufall();
    if (L < 45) continue;
    if (L >= 120 && w < .75) {                    // langer Hügel: flach hinauf, kurz oben, steil hinunter
      const hoch = Math.min(4.5, L * .03), auf = .55 + zufall() * .1, oben = .08;
      for (let k = 0; k <= n; k++) { const u = k / n; hill[wrap(a + k)] = hoch * (u < auf ? glatt(u / auf) : u < auf + oben ? 1 : 1 - glatt((u - auf - oben) / (1 - auf - oben))); }
      runenPlan.push(wrap(a + Math.round(n * (auf + oben * .5))));
    } else if (w < .92) {                          // Kuppen: kleine Hopser
      const breite = meter(17), abst = meter(30), anz = Math.max(1, Math.min(4, Math.floor((n - meter(12)) / abst)));
      const off = Math.round((n - (anz - 1) * abst) / 2);
      for (let b = 0; b < anz; b++) for (let k = -breite / 2; k <= breite / 2; k++) {
        const u = (k + breite / 2) / breite, j = wrap(a + off + b * abst + Math.round(k));
        hill[j] = Math.max(hill[j], 1.15 * Math.sin(Math.PI * u) ** 2);
      }
      if (zufall() < .5) runenPlan.push(wrap(a + Math.round(off / 2)));
    }
  }
  // 3. Steilkurven: in engen Kurven ist die Außenseite höher
  const roh = new Float32Array(S), w6 = meter(6);
  for (let i = 0; i < S; i++) {
    if (flach[i]) continue;
    const a = wrap(i - w6), b = wrap(i + w6); let da = Math.atan2(TX[b], TZ[b]) - Math.atan2(TX[a], TZ[a]); da = Math.atan2(Math.sin(da), Math.cos(da));
    roh[i] = klemmen(da / (2 * w6 * SCHRITT) * 4.5, -.12, .12);
    if (Math.abs(roh[i]) < .02) roh[i] = 0;
  }
  for (const [a, n] of laeufe) for (let k = 0; k <= n; k++) {
    const i = wrap(a + k); let sum = 0, cnt = 0;
    for (let m = -meter(8); m <= meter(8); m += 2) { sum += roh[wrap(i + m)]; cnt++; }
    NEIG[i] = sum / cnt * glatt(Math.min(k, n - k) / meter(18));
  }
  for (let i = 0; i < S; i++) HOCH[i] = hill[i] + Math.abs(NEIG[i]) * RANDW;
  const s6 = meter(6);
  for (let i = 0; i < S; i++) STEIG[i] = (HOCH[wrap(i + s6)] - HOCH[wrap(i - s6)]) / (2 * s6 * SCHRITT);
  // 4. Böschung: so breit wie die Höhe es verlangt, aber nicht bis an einen anderen Teil der Strecke
  for (let i = 0; i < S; i++) for (const sg of [-1, 1]) {
    const g = HOCH[i] + NEIG[i] * sg * RANDW, idx = (sg > 0 ? S : 0) + i;
    if (g <= .01) { BOESCH[idx] = .01; continue; }
    let w = Math.max(2, g * 2.4);
    const q = punkt(i, sg * RANDW), j = nahPunkt(q.x, q.z, RANDW + w + 2, i, meter(60));
    if (j >= 0) w = Math.max(1, Math.min(w, Math.hypot(PX[j] - q.x, PZ[j] - q.z) - RANDW - 1));
    BOESCH[idx] = w;
  }
  // 5. Alles anheben
  streckeG.updateMatrixWorld(true);
  const v = new THREE.Vector3(), mm = new THREE.Matrix4(), inv = new THREE.Matrix4(), fertig = new Set(), merk = new Map();
  const hAn = (x, z) => { const k = Math.round(x * 20) + "," + Math.round(z * 20); let h = merk.get(k); if (h === undefined) { h = hoeheAn(x, z); merk.set(k, h); } return h; };
  const heben = o => {
    if (o.isInstancedMesh) {
      let neu = false;
      for (let n = 0; n < o.count; n++) { o.getMatrixAt(n, mm); v.setFromMatrixPosition(mm).applyMatrix4(o.matrixWorld); const h = hAn(v.x, v.z); if (h) { mm.elements[13] += h; o.setMatrixAt(n, mm); neu = true; } }
      if (neu) { o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere && o.computeBoundingSphere(); }
      return;
    }
    if (o.isMesh && o.geometry) {
      const geo = o.geometry; if (!geo.boundingSphere) geo.computeBoundingSphere();
      if (geo.boundingSphere.radius > 14) {          // große Teile (Fahrbahn, Bänder): Punkt für Punkt verformen
        if (fertig.has(geo)) return; fertig.add(geo);
        const pos = geo.attributes.position; inv.copy(o.matrixWorld).invert(); let neu = false;
        for (let n = 0; n < pos.count; n++) { v.fromBufferAttribute(pos, n).applyMatrix4(o.matrixWorld); const h = hAn(v.x, v.z); if (!h) continue; v.y += h; v.applyMatrix4(inv); pos.setXYZ(n, v.x, v.y, v.z); neu = true; }
        if (neu) { pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.computeBoundingBox(); }
        return;
      }
    }
    if (!o.isMesh && o.children.length && Math.abs(o.position.x) < 1e-4 && Math.abs(o.position.z) < 1e-4) { o.children.forEach(heben); return; }   // reine Sammelgruppe
    o.getWorldPosition(v); o.position.y += hAn(v.x, v.z);
  };
  streckeG.children.slice().forEach(heben);
  for (const b of kisten) b.h = hAn(b.x, b.z);
  for (const mz of muenzen) mz.y = mz.m.position.y;
  for (const f of fackeln) f[1] += hAn(f[0], f[2]);
  // 6. Böschungen bauen
  for (const sg of [-1, 1]) {
    const pos = [], col = [], c = new THREE.Color(), f0 = TH.geroell[0], f1 = TH.geroell[1];
    for (let i = 0; i < S; i += 2) {
      const a = i, b = wrap(i + 2), ia = (sg > 0 ? S : 0) + a, ib = (sg > 0 ? S : 0) + b;
      const ga = HOCH[a] + NEIG[a] * sg * RANDW, gb = HOCH[b] + NEIG[b] * sg * RANDW;
      if (ga <= .02 && gb <= .02) continue;
      if (SCHLUCHT[a] || SCHLUCHT[b] || MAUERW[a] < MAUER) continue;
      const P = (k, d, y) => [PX[k] + nX(k) * d, y, PZ[k] + nZ(k) * d];
      const q = [P(a, sg * (RANDW - .05), ga + .02), P(a, sg * (RANDW + BOESCH[ia]), .01), P(b, sg * (RANDW + BOESCH[ib]), .01), P(b, sg * (RANDW - .05), gb + .02)];
      if (sg > 0) pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]); else pos.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
      c.set(Math.floor(i / STRICH) % 2 ? f0 : f1); for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
    if (!pos.length) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.receiveShadow = true; streckeG.add(m);
  }
  // 7. Schubrunen: oben auf den Hügeln vor der Abfahrt, manchmal vor Kuppen
  for (const W of wege) runenPlan.push([wrap(W.i0 + Math.round(W.n * .8)), wegMitte(wrap(W.i0 + Math.round(W.n * .8)), W.lang)]);
  for (const r of runenPlan) {
    const [i, d] = Array.isArray(r) ? r : [r, Math.round((zufall() - .5) * BR * .6 * 10) / 10], q = punkt(i, d);
    const m = new THREE.Mesh(runenGeo, runenMat); m.position.set(q.x, hoehe(i, d) + .12, q.z); m.rotation.order = "YXZ"; m.rotation.set(-Math.PI / 2 + Math.atan(STEIG[i]), q.rot, 0);
    streckeG.add(m); runen.push({ i, d, x: q.x, z: q.z, m });
  }
}
const runenGeo = new THREE.PlaneGeometry(3.4, 3.4);
const runenMat = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const x = cv.getContext("2d");
  const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, "rgba(90,220,255,.9)"); g.addColorStop(1, "rgba(40,120,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = "#E8FBFF"; x.lineWidth = 9; x.lineJoin = "round"; x.lineCap = "round";
  for (const y0 of [34, 66]) { x.beginPath(); x.moveTo(30, y0 + 26); x.lineTo(64, y0); x.lineTo(98, y0 + 26); x.stroke(); }
  const t = new THREE.CanvasTexture(cv);
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
})();
// Über eine Schubrune fahren gibt kurzen Schwung (nur das eigene Handy prüft seine Karts)
function runenPruefen(k) {
  if (k.luft || k.runeUhr > uhr) return;
  for (const R of runen) if ((R.x - k.x) ** 2 + (R.z - k.z) ** 2 < 4) { k.boost = Math.max(k.boost, .9); k.runeUhr = uhr + 1.2; if (k.ich) summen(30); break; }
}

// ---------- Echte Gabelungen ----------
// Die Mittellinie läuft weiter über eine Insel, links und rechts davon je ein eigener Weg mit eigenen Mauern.
// Der kurze Weg ist gerade und hat Hindernisse, der lange schlägt einen Bogen und hat Truhen, Gold und eine Schubrune.
function wegAnlegen(i0, n, def) {
  const lang = def.lang > 0 ? 1 : -1, W = { nr: wege.length, i0, n, lang, kurz: def.kurz, insel: def.insel };
  for (let k = 0; k <= n; k++) {
    const u = k / n, j = wrap(i0 + k), auf = glatt(u / .25) * glatt((1 - u) / .25);
    const kurzD = 13 * auf, langD = 20 * auf + 9 * Math.sin(Math.PI * 3 * klemmen((u - .25) / .5, 0, 1)) ** 2;
    if (lang > 0) { WEG_R[j] = langD; WEG_L[j] = -kurzD; } else { WEG_L[j] = -langD; WEG_R[j] = kurzD; }
    WEG[j] = 1; WEG_LANG[j] = lang;
  }
  wege.push(W);
  const bei = u => wrap(i0 + Math.round(n * u));
  // kurzer Weg: Hindernisse
  [[.32, 3.2], [.4, -3], [.48, .4], [.56, 3.3], [.64, -2.6], [.72, 1.2]].forEach(([u, q]) => {
    const i = bei(u), dd = wegMitte(i, -lang) + q, p = punkt(i, dd);
    pfosten.push({ x: p.x, z: p.z, r: def.kurz === "faesser" ? .75 : def.kurz === "ruestung" ? .7 : .85, art: def.kurz, rot: p.rot, i, d: dd });
  });
  // langer Weg: Truhen
  truhenReihe(bei(.42), wegMitte(bei(.42), lang));
}
// Mauern der Gabelung: außen und (wo die Insel beginnt) innen
function wegMauer(k, dt) {
  const i = k.idx, s = wegSeite(i, k.d), m = wegMitte(i, s), rel = k.d - m;
  const aussen = Math.max(MAUER - Math.abs(m), WEG_RAND);
  let grenze = null;
  if (rel * s > aussen) grenze = s * aussen;
  else if (inselDa(i) && -rel * s > WEG_RAND) grenze = -s * WEG_RAND;
  if (grenze == null) return;
  const nd = m + grenze, zu = k.d - nd, sg = Math.sign(zu);
  k.x -= nX(i) * zu; k.z -= nZ(i) * zu; k.d = nd;
  k.v *= Math.max(0, 1 - 3 * dt); k.yaw += sg * .9 * dt * Math.sign(Math.cos(k.mh - Math.atan2(TX[i], TZ[i])));
}
// Fahrbahn, Mauern, Insel der Gabelungen bauen (nach der normalen Fahrbahn)
function wegeBauen() {
  const STEIN = TH.stein, steine = [], pfeiler = [], scheine = [];
  for (const W of wege) {
    const von = W.i0, bis = W.i0 + W.n;
    for (const s of [-1, 1]) {
      const m = i => wegMitte(wrap(i), s), y = s > 0 ? .055 : .05;
      for (let j = 0; j < 3; j++) band(i => m(i) - BR / 2 + j * BR / 3, i => m(i) - BR / 2 + (j + 1) * BR / 3, i => TH.platte[(Math.floor(i / (STRICH * .75) + j * .5) + j) % 3], y, von, bis);
      for (const sg of [-1, 1]) band(i => m(i) + sg * BR / 2, i => m(i) + sg * (BR / 2 + 1.3), i => (Math.floor(i / (STRICH * .6)) % 2 ? TH.kante[0] : TH.kante[1]), y, von, bis);
      band(i => m(i) + s * RAND, i => s * (Math.max(MAUER, Math.abs(m(i)) + WEG_RAND) + .2), i => (Math.floor(i / STRICH) % 3 ? TH.geroell[0] : TH.geroell[1]), .03, von, bis);
      band(i => m(i) - s * RAND, i => m(i) - s * (WEG_RAND + .2), i => (Math.floor(i / STRICH) % 3 ? TH.geroell[0] : TH.geroell[1]), .03, von, bis);
      // Mauersteine entlang des Weges (in Wegrichtung gedreht)
      for (let k = 0; k <= W.n; k += meter(2.2)) {
        const i = wrap(von + k), a = wrap(i - 3), b = wrap(i + 3), mi = wegMitte(i, s);
        const dd = (wegMitte(b, s) - wegMitte(a, s)) / (6 * SCHRITT), rot = Math.atan2(TX[i] + nX(i) * dd, TZ[i] + nZ(i) * dd) + Math.PI / 2;
        const aus = s * (Math.max(MAUER, Math.abs(mi) + WEG_RAND) + .7), q = punkt(i, aus);
        steine.push([q.x, 1.1, q.z, rot, 1, STEIN[Math.floor(zufall() * 4)]]);
        if (k % meter(15.4) < meter(2.2)) { pfeiler.push([q.x, 2.4, q.z, rot]); const f = punkt(i, aus - s * .9); fackeln.push([f.x, 3.9, f.z]); const sc2 = punkt(i, aus - s * 3.7); scheine.push([sc2.x, .14, sc2.z]); }
        if (inselDa(i) && Math.abs(mi) - WEG_RAND > 1.2) { const r = punkt(i, mi - s * (WEG_RAND + .7)); steine.push([r.x, 1.1, r.z, rot, 1, STEIN[Math.floor(zufall() * 4)]]); }
      }
    }
    // Insel: Boden und ein Gebäude mit Schild
    band(i => inselDa(wrap(i)) ? WEG_L[wrap(i)] + WEG_RAND + 1.3 : 0, i => inselDa(wrap(i)) ? WEG_R[wrap(i)] - WEG_RAND - 1.3 : 0, i => (Math.floor(i / STRICH) % 2 ? TH.geroell[1] : TH.boden), .02, von, bis);
    let breit = 1e9; for (let k = Math.round(W.n * .4); k <= Math.round(W.n * .6); k++) { const i = wrap(von + k); breit = Math.min(breit, WEG_R[i] - WEG_L[i] - 2 * WEG_RAND - 4); }
    const mi = wrap(von + Math.round(W.n * .5));
    if (breit > 6) bau(mi, 0, Math.min(36, W.n * SCHRITT * .2), welt === "kerker" ? 9 : 7, Math.min(16, breit), welt === "grotte" ? "#3E4A44" : welt === "glut" ? "#3A2F33" : "#655C54", W.insel, false, (WEG_L[mi] + WEG_R[mi]) / 2);
  }
  if (steine.length) instanzen(new THREE.BoxGeometry(2.4, 2.2, 1.3), new THREE.MeshLambertMaterial({ color: "#ffffff" }), steine);
  if (pfeiler.length) instanzen(new THREE.BoxGeometry(1.6, 4.8, 1.6), M(TH.pfeiler), pfeiler);
  if (scheine.length) { const sg = new THREE.PlaneGeometry(13, 13); sg.rotateX(-Math.PI / 2); instanzen(sg, TH.schein, scheine, false).receiveShadow = false; }
}
// Fahrbahn-Bänder nur außerhalb der Gabelungen bauen
function ausserhalbWege(fn) {
  const l = [...wege, ...gleitstellen.map(g => ({ i0: g.i0, n: g.m })), ...ueberfuehrungen.map(u => ({ i0: u.i0, n: u.n }))].sort((a, b) => a.i0 - b.i0);
  if (!l.length) { fn(0, S); return; }
  for (let n = 0; n < l.length; n++) { const a = l[n].i0 + l[n].n, b = n + 1 < l.length ? l[n + 1].i0 : l[0].i0 + S; if (b > a) fn(a, b); }
}

// ---------- Gleiten und Wasser ----------
const schwingenMat = new THREE.MeshLambertMaterial({ color: "#2A1E2E", side: THREE.DoubleSide });
function schwinge(x) {
  const geo = new THREE.BufferGeometry(), p = [];
  const pk = [[0, 0, .6], [x * 1.2, .25, .3], [x * 2.3, .45, .1], [x * 3.3, .6, -.2], [x * 2.6, .1, -.9], [x * 1.9, .2, -.6], [x * 1.3, 0, -1.1], [x * .6, .1, -.7], [0, 0, -.9]];
  for (let n = 1; n < pk.length - 1; n++) p.push(...pk[0], ...pk[n], ...pk[n + 1]);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, schwingenMat); return m;
}
const aufwindMat = new THREE.MeshBasicMaterial({ color: "#FFB070", transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const pfeilMat = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64; const x = cv.getContext("2d");
  x.strokeStyle = "rgba(235,250,255,.75)"; x.lineWidth = 8; x.lineCap = "round"; x.lineJoin = "round";
  x.beginPath(); x.moveTo(14, 44); x.lineTo(32, 22); x.lineTo(50, 44); x.stroke();
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false });
})();
const strudelMat = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const x = cv.getContext("2d");
  x.strokeStyle = "rgba(220,245,255,.8)"; x.lineWidth = 5;
  for (let a = 0; a < 3; a++) { x.beginPath(); for (let t = 0; t < 60; t++) { const r = 6 + t, w = t * .12 + a * 2.1; x.lineTo(64 + Math.cos(w) * r, 64 + Math.sin(w) * r); } x.stroke(); }
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false });
})();
let strudelM = [], aufwindM = [];
function gleitWasserBauen() {
  // Loch: Abgrund (Grotte), Burggraben (Kerker) oder Lava (Glutschlund) über die ganze Breite
  for (const g of gleitstellen) {
    const von = g.i0, bis = g.i0 + g.m;
    if (welt === "glut") lavaBand(-MAUER - 30, MAUER + 30, .04, von, bis);
    else band(-MAUER - 30, MAUER + 30, i => welt === "kerker" ? TH.wasser[Math.floor(i / STRICH) % 2] : (Math.floor(i / STRICH) % 2 ? "#040807" : "#060C0A"), .04, von, bis);
    // Felskanten an beiden Enden
    for (const [i, s] of [[von, 1], [wrap(bis), -1]]) {
      const q = punkt(i, 0), k = new THREE.Mesh(new THREE.BoxGeometry(2 * MAUER + 3, .8, 1.2), M(TH.stein[1]));
      k.position.set(q.x - TX[i] * s * .6, -.3, q.z - TZ[i] * s * .6); k.rotation.y = q.rot; streckeG.add(k);
    }
  }
  aufwindM = aufwinde.map(A => {
    const g = new THREE.Group();
    for (const r of [3.6, 2.4]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .8, 18, 16, 1, true), aufwindMat); c.position.y = 7; g.add(c); }
    g.position.set(A.x, 0, A.z); streckeG.add(g); return g;
  });
  // Wasser: Schaumpfeile zeigen die Strömung, Strudel drehen sich
  const pf = [];
  for (const a of abschnitte) if (a.wasser) for (let k = meter(6); k < a.wasser[1]; k += meter(9)) { const i = wrap(a.wasser[0] + k), q = punkt(i, 0); pf.push([q.x, .08, q.z, q.rot]); }
  if (pf.length) { const g = new THREE.PlaneGeometry(2.6, 2.6); g.rotateX(-Math.PI / 2); g.rotateY(Math.PI); instanzen(g, pfeilMat, pf, false).receiveShadow = false; }
  strudelM = strudel.map(W => { const m = new THREE.Mesh(new THREE.CircleGeometry(3.6, 24), strudelMat); m.rotation.x = -Math.PI / 2; m.position.set(W.x, .1, W.z); streckeG.add(m); return m; });
}
function gleitWasserZeigen(dt) {
  for (const m of strudelM) m.rotation.z += dt * 3;
  aufwindM.forEach((g, n) => { g.children.forEach((c, j) => c.rotation.y += dt * (j ? -2 : 1.4)); g.children[0].material.opacity = .14 + Math.sin(uhr * 3 + n) * .04; });
}
// Strudel (nur für selbst gefahrene Karts)
function strudelPruefen(k, dt) {
  if (k.luft || BELAG[k.idx] !== BOOT || k.typ === "magierin") return;
  for (const W of strudel) {
    const q = (W.x - k.x) ** 2 + (W.z - k.z) ** 2; if (q > 14) continue;
    k.yaw += 2.8 * dt; k.v *= Math.max(0, 1 - .9 * dt);
    if (k.ich && !(k.strudelUhr > uhr)) { melden("Strudel! 🌀", .9); k.strudelUhr = uhr + 2; }
  }
}

// Fallgitter, Druckplatten, brüchige Wand, Lorenbahn, Troll, Pendel, Fässer, Rüstungen, Ratten, Knochenkönig
function streckeDingeBauen() {
  for (const f of gabeln) {
    const breite = MAUER - .7, mitte = (MAUER + .7) / 2;
    if (f.art === "gabel") {
      f.tore = {};
      for (const s of [-1, 1]) {
        const g = new THREE.Group(), q = punkt(f.i0, s * mitte);
        for (let x = -breite / 2 + .4; x < breite / 2; x += .9) teil(g, box(.16, 5.4, .16), "#2E2B30", x, 2.7, 0);
        for (const y of [1, 2.6, 4.2]) teil(g, box(breite, .16, .16), "#2E2B30", 0, y, 0);
        for (let x = -breite / 2 + .4; x < breite / 2; x += .9) teil(g, kegel(.12, .4, 4), "#2E2B30", x, -.2, 0, Math.PI);
        g.position.set(q.x, 6, q.z); g.rotation.y = q.rot; streckeG.add(g); f.tore[s] = g;
        // Druckplatte gleich hinter dem Gitter
        const pi = wrap(f.i0 + meter(7)), pp = punkt(pi, s * BR / 4), pl = new THREE.Mesh(box(2.6, .12, 2.6), M("#8E7F6A"));
        pl.position.set(pp.x, .1, pp.z); pl.rotation.y = pp.rot; streckeG.add(pl);
        const kreuz = new THREE.Mesh(box(1.6, .14, .3), M("#5C4E3E")); kreuz.position.copy(pl.position); kreuz.rotation.y = pp.rot + Math.PI / 4; streckeG.add(kreuz);
      }
      // Torbalken über beiden Durchfahrten
      const q = punkt(f.i0, 0), bo = new THREE.Mesh(box(2 * MAUER + 1.4, 1.2, 1.2), M("#5F564D")); bo.position.set(q.x, 6.6, q.z); bo.rotation.y = q.rot; streckeG.add(bo);
    } else if (f.art === "tunnel") {
      // Netztunnel auf der Innenseite (Dach, Felspfeiler, Netze), außen Wurzeln
      const dach = [], pf = [], wurzeln = [], licht = [];
      for (let k = 0; k <= f.n; k += meter(3)) {
        const i = wrap(f.i0 + k), q = punkt(i, f.innen * (MAUER / 2 + .5)); dach.push([q.x, 5.6, q.z, q.rot]);
        if (k % meter(6) < meter(3)) { const r = punkt(i, f.innen * 1.1); pf.push([r.x, 2.8, r.z, r.rot]); const l = punkt(i, f.innen * (MAUER - .6)); licht.push([l.x, 1.2, l.z, 0, .8 + (k % 5) * .1]); }
      }
      for (let k = meter(2); k < f.n; k += meter(2.6)) { const i = wrap(f.i0 + k), q = punkt(i, -f.innen * (MAUER / 2 + .4)); wurzeln.push([q.x, .12, q.z, q.rot + Math.sin(k) * .2, 1, k % 2 ? "#5A3F2A" : "#6B4A30"]); }
      instanzen(box(MAUER + 1.5, 1.4, SCHRITT * meter(3) + .2), M("#25302A"), dach);
      instanzen(box(1.1, 5.6, 1.1), M("#33403A"), pf);
      instanzen(new THREE.CapsuleGeometry(.28, MAUER - 3, 3, 6), new THREE.MeshLambertMaterial({ color: "#ffffff" }), wurzeln).geometry.rotateZ(Math.PI / 2);
      instanzen(kugel(.35, 8), GLUT("#62F2C0"), licht, false);
      f.netzM = f.netze.map(k => {
        const i = wrap(f.i0 + k), q = punkt(i, f.innen * (MAUER / 2 + .5)), m = new THREE.Mesh(new THREE.PlaneGeometry(MAUER - 1.5, 4.8), netzMat.clone());
        m.position.set(q.x, 2.5, q.z); m.rotation.y = q.rot; streckeG.add(m); return m;
      });
      const sp = punkt(wrap(f.i0 - meter(16)), f.innen * (MAUER - 1.2)), sch = new THREE.Mesh(box(4.4, 1.1, .2), schildMat("NETZTUNNEL", "#DFF7EA", "#1E4A3A", 512, 96));
      sch.position.set(sp.x, 2.8, sp.z); sch.rotation.y = sp.rot + Math.PI; streckeG.add(sch);
    } else {
      // Brüchige Wand auf der Innenseite; dahinter Gold, das Schwung gibt
      const g = new THREE.Group(), q = punkt(f.i0, f.innen * mitte);
      for (let r = 0; r < 4; r++) for (let x = -breite / 2 + (r % 2) * .6; x < breite / 2 - .5; x += 1.2) teil(g, box(1.15, .95, .9), (r * 7 + Math.round(x * 3)) % 3 ? "#7A6E62" : "#6A5F55", x + .6, .5 + r, 0);
      for (const [x, y] of [[-2, 2.2], [1.5, 1.4], [3.2, 3]]) teil(g, box(.12, 1.6, .95), "#2A2420", x, y, 0, 0, 0, .5);
      g.position.set(q.x, 0, q.z); g.rotation.y = q.rot; streckeG.add(g); f.wandM = g;
      const gi = wrap(f.i0 + Math.round(f.n / 2)), gp = punkt(gi, f.innen * BR / 4);
      const gold = new THREE.Group(); teil(gold, new THREE.ConeGeometry(1.6, .9, 10), "#E8B53A", 0, .45, 0);
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), scheinMat); s2.rotation.x = -Math.PI / 2; s2.position.y = .15; gold.add(s2);
      gold.position.set(gp.x, 0, gp.z); streckeG.add(gold); f.gold = { i: gi, d: f.innen * BR / 4 };
      // Schild: nur schwere Karts
      const sp = punkt(wrap(f.i0 - meter(18)), f.innen * (MAUER - 1.2)), sch = new THREE.Mesh(box(4.2, 1.1, .2), schildMat("NUR SCHWERE", "#F3E6CC", "#8E2F22", 512, 96));
      sch.position.set(sp.x, 2.8, sp.z); sch.rotation.y = sp.rot + Math.PI; streckeG.add(sch);
    }
  }
  for (const f of loren) {
    // Gleise: beide Zweige ab der Weiche, Prellbock am toten Zweig, Totenkopf-Schild davor
    const schienen = [], schwellen = [];
    for (const zweig of ["gerade", "ab"]) {
      const bis = zweig === "ab" ? f.weiche + 14 : f.laenge;
      for (let m = zweig === "ab" ? f.weiche : 0; m < bis; m += 1.2) {
        const i = wrap(f.i0 + meter(m)), d = lorePfad(f, m, zweig), q = punkt(i, d), rot = q.rot;
        const d2 = lorePfad(f, m + 1.2, zweig), q2 = punkt(wrap(f.i0 + meter(m + 1.2)), d2), w = Math.atan2(q2.x - q.x, q2.z - q.z);
        for (const sd of [-.6, .6]) schienen.push([q.x + Math.cos(w) * sd, .12, q.z - Math.sin(w) * sd, w, 1]);
        if (Math.round(m / 1.2) % 1 === 0) schwellen.push([q.x, .05, q.z, w + Math.PI / 2, 1]);
        if (f.tot === zweig && m > f.weiche + 9) break;
      }
    }
    instanzen(box(.12, .14, 1.25), M("#8C8F99"), schienen);
    instanzen(box(.25, .1, 1.9), M("#5A4030"), schwellen);
    const pm = f.weiche + 9.4, pq = punkt(wrap(f.i0 + meter(pm)), lorePfad(f, pm, f.tot));
    const pb = new THREE.Group(); teil(pb, box(2, 1.1, .5), "#8E2F22", 0, .8, 0); teil(pb, box(2.2, .3, .7), "#E6D6AE", 0, 1.45, 0);
    pb.position.set(pq.x, 0, pq.z); pb.rotation.y = pq.rot; streckeG.add(pb);
    const tq = punkt(wrap(f.i0 + meter(f.weiche - 6)), lorePfad(f, f.weiche - 6, f.tot) + (f.tot === "ab" ? -f.s * 1.5 : f.s * 1.8));
    const ts = new THREE.Mesh(box(1.3, 1.3, .15), schildMat("☠", "#F3E6CC", "#2A2118", 128, 128)); ts.position.set(tq.x, 2.6, tq.z); ts.rotation.y = tq.rot + Math.PI; streckeG.add(ts);
    const tp = new THREE.Mesh(zyl(.06, .06, 2), M("#4A3426")); tp.position.set(tq.x, 1, tq.z); streckeG.add(tp);
    // Auffahrt vom Geröll auf die Gleise
    const aq = punkt(f.i0, f.railD), au = new THREE.Mesh(box(2.4, .3, 3.5), M("#6B4A2E")); au.position.set(aq.x, .15, aq.z); au.rotation.y = aq.rot; streckeG.add(au);
    const lq = punkt(wrap(f.i0 - meter(6)), f.s * (MAUER - 1.5)), lo = new THREE.Group();   // abgestellte Lore mit Gold
    teil(lo, box(1.6, .9, 2.2), "#5A4A3A", 0, .75, 0); teil(lo, box(1.2, .3, 1.8), "#E8B53A", 0, 1.3, 0);
    lo.position.set(lq.x, 0, lq.z); lo.rotation.y = lq.rot; streckeG.add(lo);
  }
  if (pilzSprung) {
    // drei Leuchtpilze: der erste am Rand der Schlucht (zum Draufspringen), zwei stehen tief in der Schlucht
    const P = pilzSprung, a = punkt(P.i, P.s * (RAND + 1.2)), z = punkt(P.b, 0);
    P.pilze = [0, .36, .68].map((u, n) => {
      const x = a.x + (z.x - a.x) * u, zz = a.z + (z.z - a.z) * u, h = n ? 2.6 : .7, g = new THREE.Group();
      teil(g, zyl(n ? .7 : 1, n ? 1 : 1.3, h + 6, 10), "#D9E7DA", 0, (h - 6) / 2, 0);
      const k = teil(g, new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), null, 0, h, 0, 0, 0, 0, GLUT(n % 2 ? "#E070FF" : "#4FE3B6")); k.scale.y = .55;
      for (const [dx, dz] of [[.9, .5], [-.7, .9], [.2, -1.1], [-1.2, -.3]]) teil(g, kugel(.25, 6), null, dx, h + .9, dz, 0, 0, 0, GLUT("#FFFFFF"));
      const sch = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), scheinGruen); sch.rotation.x = -Math.PI / 2; sch.position.y = .1; g.add(sch);
      g.position.set(x, 0, zz); streckeG.add(g); g.userData.kappe = k; return { x, z: zz, g, h };
    });
    const sp = punkt(wrap(P.i - meter(26)), P.s * (BR / 2 + .6)), sch = new THREE.Mesh(box(4.6, 1.1, .2), schildMat("PILZSPRUNG ➜", "#DFF7EA", "#5A2A6A", 512, 96));
    sch.position.set(sp.x, 2.6, sp.z); sch.rotation.y = sp.rot + Math.PI; streckeG.add(sch);
    const pp = new THREE.Mesh(zyl(.08, .08, 2.4), M("#3A4A42")); pp.position.set(sp.x, 1.2, sp.z); streckeG.add(pp);
  }
  for (const t of tropfen) {
    const g = new THREE.Group(); teil(g, kegel(.8, 3.2, 8), "#8C9A90", 0, -1.6, 0, Math.PI); teil(g, kegel(.4, 1.6, 6), "#A4B2A8", .5, -.8, .3, Math.PI);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); streckeG.add(g); t.g = g;
    const sch = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: .5, depthWrite: false }));
    sch.rotation.x = -Math.PI / 2; streckeG.add(sch); t.sch = sch;
    const decke = punkt(t.i, 0), dk = new THREE.Mesh(new THREE.DodecahedronGeometry(5), M("#26302B")); dk.scale.set(2.2, .5, 1.4); dk.position.set(decke.x, 17, decke.z); dk.rotation.y = decke.rot; streckeG.add(dk);
  }
  for (const p of pendel) {
    const q = punkt(p.i, 0), g = new THREE.Group();
    for (const s of [-1, 1]) teil(g, box(.8, 10, .8), "#4A3F36", s * (RAND + .6), 5, 0);
    teil(g, box(2 * RAND + 2, .8, .8), "#4A3F36", 0, 10, 0);
    const arm = new THREE.Group(); arm.position.y = 9.6; g.add(arm);
    teil(arm, zyl(.08, .08, 7.6, 6), "#3A3A40", 0, -3.8, 0);
    const blatt = teil(arm, new THREE.CylinderGeometry(1.5, 1.5, .14, 16, 1, false, Math.PI / 2, Math.PI), "#C9CED6", 0, -7.4, 0, Math.PI / 2, 0, 0);
    g.position.set(q.x, 0, q.z); g.rotation.y = q.rot; streckeG.add(g); p.arm = arm; p.blatt = blatt;
  }
  for (const p of pfosten) {
    const g = new THREE.Group();
    if (p.art === "faesser") { teil(g, zyl(.7, .7, 1.5, 12), "#7A5434", 0, .75, 0); teil(g, zyl(.73, .73, .12, 12), "#3A3A40", 0, .35, 0); teil(g, zyl(.73, .73, .12, 12), "#3A3A40", 0, 1.15, 0); }
    else if (p.art === "tropfstein") { teil(g, kegel(.95, 4.2, 9), "#8C9A90", 0, 2.1, 0); teil(g, kegel(.5, 2.2, 7), "#A4B2A8", .6, 1.1, .3); teil(g, kegel(.4, 1.6, 7), "#7E8C82", -.5, .8, -.4); }
    else if (p.art === "obsidian") {
      teil(g, kegel(.95, 3.8, 5), "#1E1820", 0, 1.9, 0, .08, 0, -.1); teil(g, kegel(.55, 2.4, 5), "#2A2128", .6, 1.1, .3, 0, 1, .35); teil(g, kegel(.45, 1.7, 5), "#1A1419", -.55, .8, -.35, 0, 2, -.4);
      teil(g, box(.12, 1.6, .12), null, .15, 1.2, .5, 0, 0, .3, GLUT("#FF7A1A"));
    }
    else if (p.art === "kristall") {
      for (const [x, z, h, rz, f] of [[0, 0, 3.4, 0, "#7FF3FF"], [.5, .2, 2.2, .45, "#C59BFF"], [-.45, -.2, 2.6, -.4, "#7FF3FF"]]) { const c = teil(g, new THREE.OctahedronGeometry(.6), null, x, h / 2, z, 0, 0, rz, GLUT(f)); c.scale.y = h / 1.2; }
      const sch = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), scheinGruen); sch.rotation.x = -Math.PI / 2; sch.position.y = .1; g.add(sch);
    }
    else {
      teil(g, box(.9, .2, .9), "#4A3F36", 0, .1, 0);
      for (const x of [-.2, .2]) teil(g, zyl(.13, .13, 1, 8), "#9AA3AD", x, .7, 0);
      teil(g, box(.8, 1, .5), "#AEB6BF", 0, 1.7, 0); teil(g, kugel(.3, 10), "#AEB6BF", 0, 2.45, 0); teil(g, box(.5, .08, .1), "#2A2420", 0, 2.45, .26);
      teil(g, zyl(.04, .04, 3.2, 6), "#6B4A2E", .55, 1.8, 0); teil(g, kegel(.12, .4, 6), "#C9CED6", .55, 3.5, 0);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.position.set(p.x, 0, p.z); g.rotation.y = p.rot + Math.PI; streckeG.add(g);
  }
  for (const r of rattenStellen) {
    r.g = new THREE.Group(); streckeG.add(r.g); r.ratten = [];
    if (r.art === "spinne") {
      for (let i = 0; i < 5; i++) { const g = spinneMesh(.42, false); g.visible = false; r.g.add(g); r.ratten.push(g); }
      for (const s of [-1, 1]) { const q = punkt(r.i, s * (RAND + 1.2)); for (let e = 0; e < 4; e++) { const ei = new THREE.Mesh(kugel(.45, 10), M("#EDEBDD")); ei.scale.y = 1.25; ei.position.set(q.x + Math.sin(e * 2.1) * .7, .5, q.z + Math.cos(e * 2.1) * .7); streckeG.add(ei); } }
      continue;
    }
    for (let i = 0; i < 5; i++) { const g = new THREE.Group(); teil(g, kapsel(.22, .5), "#7D6E62", 0, .25, 0, Math.PI / 2); teil(g, kugel(.16, 8), "#8C7D70", 0, .3, .45); teil(g, zyl(.03, .02, .8, 4), "#E2A3A0", 0, .2, -.7, Math.PI / 2 - .3); g.visible = false; r.g.add(g); r.ratten.push(g); }
    for (const s of [-1, 1]) { const q = punkt(r.i, s * (RAND + .4)), loch = new THREE.Mesh(new THREE.CircleGeometry(1, 12, 0, Math.PI), M("#141010")); loch.position.set(q.x, .05, q.z); loch.rotation.y = q.rot + (s > 0 ? Math.PI / 2 : -Math.PI / 2); streckeG.add(loch); }
  }
  if (troll) {
    const q = punkt(troll.i, troll.s * (RAND + 2.6)), g = new THREE.Group();
    const koerper = new THREE.Group(); g.add(koerper);
    const bauch = teil(koerper, kugel(2.4, 16), "#7C8A5E", 0, .9, 0); bauch.scale.set(1, .62, 1.35);
    teil(koerper, kugel(1.1, 12), "#8A9868", 0, 1.1, 2.9);
    for (const x of [-.4, .4]) teil(koerper, kugel(.16, 6), "#1B1620", x, 1.55, 3.85);
    teil(koerper, kugel(.25, 8), "#9AA676", 0, 1.2, 3.95);
    for (const x of [-1.4, 1.4]) teil(koerper, kapsel(.45, 1.6), "#7C8A5E", x, .5, -2.6, Math.PI / 2);
    const keule = new THREE.Group(); keule.position.set(-troll.s * 0, 1, 1); g.add(keule);
    teil(keule, zyl(.25, .45, 5, 8), "#6B4A2E", 0, 0, 2.6, Math.PI / 2);
    g.position.set(q.x, 0, q.z); g.rotation.y = q.rot; streckeG.add(g);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    troll.g = g; troll.koerper = koerper; troll.keule = keule;
    const zz = new THREE.Group(); for (let n = 0; n < 3; n++) { const z = new THREE.Mesh(new THREE.PlaneGeometry(.8, .8), new THREE.MeshBasicMaterial({ map: schildMat("Z", "#140F14", "#F3E6CC", 64, 64)[4].map, transparent: true })); z.position.set(n * .5, 3 + n * .8, 3 + n * .3); zz.add(z); }
    g.add(zz); troll.zz = zz;
  }
  if (koenig && koenig.art === "spinne") {
    // Nest: große Netze an der Wand, darin sitzt die Königin (ab Runde 2 ist sie auf der Jagd)
    for (let n = -2; n <= 2; n++) {
      const q = punkt(wrap(koenig.i + meter(n * 9)), koenig.s * (MAUER + 2.5 + Math.abs(n))), m = new THREE.Mesh(new THREE.PlaneGeometry(14 - Math.abs(n) * 2, 14 - Math.abs(n) * 2), netzMat);
      m.position.set(q.x, 7 - Math.abs(n), q.z); m.rotation.y = q.rot + Math.PI / 2 + n * .25; streckeG.add(m);
    }
    for (let n = 0; n < 9; n++) { const q = punkt(wrap(koenig.i + meter((n - 4) * 5)), koenig.s * (MAUER + 1 + (n % 3))), ei = new THREE.Mesh(kugel(.7, 10), M("#E4E2D2")); ei.scale.y = 1.3; ei.position.set(q.x, .8, q.z); streckeG.add(ei); }
    const q = punkt(koenig.i, koenig.s * (MAUER + 2)), g = spinneMesh(2.4, true);
    g.position.set(q.x, 7.5, q.z); g.rotation.y = q.rot - Math.PI / 2 * koenig.s; g.rotation.x = -.9; streckeG.add(g); koenig.g = g;
    const sp = punkt(wrap(koenig.i - meter(30)), koenig.s * (MAUER - 1.2)), sch = new THREE.Mesh(box(4.6, 1.1, .2), schildMat("NEST ⚠", "#DFF7EA", "#5A2A6A", 512, 96));
    sch.position.set(sp.x, 2.8, sp.z); sch.rotation.y = sp.rot + Math.PI; streckeG.add(sch);
  }
  if (koenig && koenig.art === "knochen") {
    const q = punkt(koenig.i, koenig.s * (MAUER + 3.5)), { g, arm, augMat } = knochenKoenigMesh();
    g.position.set(q.x, 0, q.z); g.rotation.y = q.rot - Math.PI / 2 * koenig.s; streckeG.add(g);
    koenig.g = g; koenig.arm = arm; koenig.augMat = augMat;
  }
  if (welt === "glut") glutDingeBauen();
}
// Knochenkönig (Thron, Zepter); auch für die Siegerehrung
function knochenKoenigMesh() {
  const g = new THREE.Group();
  const st = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.6, 3), M("#3A2E26")); st.position.y = .8; g.add(st);
  const le = new THREE.Mesh(new THREE.BoxGeometry(3.6, 6, .6), M("#3A2E26")); le.position.set(0, 3.5, -1.3); g.add(le);
  for (let n = -2; n <= 2; n++) { const z = new THREE.Mesh(new THREE.ConeGeometry(.3, 1.2, 6), M("#3A2E26")); z.position.set(n * .75, 7, -1.3); g.add(z); }
  const ko = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.2, 2.2, 10), M("#4A2E5A")); ko.position.set(0, 2.6, -.2); g.add(ko);
  const sch = new THREE.Mesh(new THREE.SphereGeometry(.8, 14, 10), M("#EDE4D0")); sch.position.set(0, 4.3, -.1); g.add(sch);
  const augMat = new THREE.MeshBasicMaterial({ color: "#7BE3A0" });
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 6), augMat); a.position.set(s * .3, 4.4, .6); g.add(a); }
  const kr = new THREE.Mesh(new THREE.CylinderGeometry(.75, .6, .6, 8, 1, true), new THREE.MeshLambertMaterial({ color: "#E8C24A", side: THREE.DoubleSide })); kr.position.set(0, 5.1, -.1); g.add(kr);
  const arm = new THREE.Group(); arm.position.set(1.1, 3.2, .2); g.add(arm);
  const zep = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 3.4), M("#E8C24A")); zep.position.set(.3, .2, .2); zep.rotation.z = -.2; arm.add(zep);
  const kug = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), GLUT("#7BE3A0")); kug.position.set(.62, 1.85, .2); arm.add(kug);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { g, arm, augMat };
}
// Spinne (Königin mit Krone, sonst klein); Beine in userData.beine zum Krabbeln
function spinneMesh(r, krone) {
  const g = new THREE.Group(), dunkel = krone ? "#2B1A33" : "#2A2420";
  teil(g, kugel(r, 14), dunkel, 0, r * .9, -r * .9).scale.set(1, .85, 1.15);
  teil(g, kugel(r * .6, 12), dunkel, 0, r * .8, r * .4);
  if (krone) { teil(g, kugel(r * .55, 10), "#7A2A8A", 0, r * 1.3, -r * 1.1).scale.set(1, .4, 1.2); for (let n = 0; n < 5; n++) teil(g, kegel(r * .1, r * .35, 4), "#E8C24A", (n - 2) * r * .14, r * 1.45, r * .55); }
  for (const x of [-1, 1]) for (const y of [0, 1]) teil(g, kugel(r * .09, 6), null, x * r * (.13 + y * .1), r * (1.02 + y * .08), r * .92, 0, 0, 0, GLUT("#FF3A3A"));
  g.userData.beine = [];
  for (const sx of [-1, 1]) for (let n = 0; n < 4; n++) {
    const b = new THREE.Group(); b.position.set(sx * r * .45, r * .85, r * (.6 - n * .38)); b.rotation.y = sx * (n * .35 - .5);
    teil(b, zyl(r * .07, r * .07, r * 1.3, 5), dunkel, sx * r * .55, r * .25, 0, 0, 0, sx * 1.1);
    teil(b, zyl(r * .06, r * .04, r * 1.4, 5), dunkel, sx * r * 1.25, -r * .35, 0, 0, 0, -sx * .45);
    g.add(b); g.userData.beine.push(b);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// ---------- Glutschlund ----------
// Geysir: Krater, Feuersäule (Höhe wird beim Zeigen gesetzt), Dampf als Vorwarnung
function geysirMesh(gross) {
  const g = new THREE.Group(), r = gross ? 1.9 : 1.3;
  teil(g, zyl(r + .4, r + .9, .25, 14), "#2B2026", 0, .1, 0);
  teil(g, zyl(r, r, .04, 14), null, 0, .24, 0, 0, 0, 0, GLUT("#FF6A1A"));
  const sg = zyl(r * .65, r * .9, 1, 10); sg.translate(0, .5, 0);
  const saeule = teil(g, sg, null, 0, .2, 0, 0, 0, 0, GLUT("#FFA23C"));
  const kappe = teil(g, kugel(r * 1.1, 10), null, 0, 0, 0, 0, 0, 0, GLUT("#FFE08A"));
  const dampf = [0, 1, 2].map(n => teil(g, kugel(.6 + n * .2, 8), null, 0, 0, 0, 0, 0, 0, dampfMat));
  const sch = new THREE.Mesh(new THREE.PlaneGeometry(r * 5, r * 5), scheinMat); sch.rotation.x = -Math.PI / 2; sch.position.y = .12; g.add(sch);
  g.userData = { saeule, kappe, dampf };
  return g;
}
// h > 0: Feuersäule so hoch, h < 0: es brodelt (Dampf), 0: Ruhe
function geysirZeigen(g, h, t) {
  const U = g.userData; U.saeule.visible = U.kappe.visible = h > 0;
  if (h > 0) { U.saeule.scale.set(1, h, 1); U.kappe.position.y = .2 + h; U.kappe.scale.setScalar(.8 + Math.sin(t * 23) * .15); }
  U.dampf.forEach((d, n) => { d.visible = h !== 0; const z = (t * 1.3 + n / 3) % 1; d.position.set(Math.sin(n * 2.1) * .5, .5 + z * (h > 0 ? h + 2 : 3.5), Math.cos(n * 2.1) * .5); d.scale.setScalar(.6 + z); });
}
// Glutdrache (Front nach +z), Flügel in userData zum Schlagen
function dracheMesh(r) {
  const g = new THREE.Group(), rot = "#7A1E14", bauch = "#D08A3A";
  teil(g, kugel(r, 14), rot, 0, 0, 0).scale.set(.8, .7, 1.5);
  teil(g, kugel(r * .62, 10), bauch, 0, -r * .28, r * .25).scale.set(1, .6, 1.7);
  teil(g, zyl(r * .28, r * .42, r * 1.5, 8), rot, 0, r * .6, r * 1.3, .75, 0, 0);
  const kopf = new THREE.Group(); kopf.position.set(0, r * 1.15, r * 1.95); g.add(kopf);
  teil(kopf, box(r * .62, r * .48, r * .9), rot, 0, 0, 0);
  teil(kopf, box(r * .46, r * .26, r * .62), rot, 0, -r * .1, r * .62);
  for (const x of [-1, 1]) {
    teil(kopf, kegel(r * .09, r * .55, 5), "#E8D9B0", x * r * .2, r * .38, -r * .28, -.7);
    teil(kopf, kugel(r * .075, 6), null, x * r * .22, r * .1, r * .3, 0, 0, 0, GLUT("#FFE14A"));
    teil(g, zyl(r * .12, r * .1, r * .9, 6), rot, x * r * .45, -r * .7, r * .55);
  }
  teil(g, kegel(r * .32, r * 2.6, 8), rot, 0, -r * .1, -r * 2.3, -Math.PI / 2 + .15, 0, 0);
  for (let n = 0; n < 5; n++) teil(g, kegel(r * .12, r * .4, 4), "#E8D9B0", 0, r * .7 - n * r * .08, r * .6 - n * r * .45);
  const fluegel = [-1, 1].map(x => {
    const f = new THREE.Group(); f.position.set(x * r * .55, r * .4, r * .2); g.add(f);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -r * .7, x * r * 3.3, r * .25, -r * .2, 0, 0, r * .9, 0, 0, -r * .7, x * r * 2.5, 0, -r * 1.5, x * r * 3.3, r * .25, -r * .2], 3));
    geo.computeVertexNormals(); f.add(new THREE.Mesh(geo, fluegelMat)); return f;
  });
  const feuer = teil(kopf, kegel(r * .45, r * 3, 8), null, 0, -r * .4, r * 2, -1.37, 0, 0, GLUT("#FF8A2A")); feuer.visible = false;
  g.userData = { fluegel, kopf, feuer };
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
const rein = (im, g) => { streckeG.remove(im); g.add(im); return im; };
function glutDingeBauen() {
  for (const gy of geysire) { gy.m = geysirMesh(false); gy.m.position.set(gy.x, 0, gy.z); streckeG.add(gy.m); }
  if (geysirSprung) {
    const G = geysirSprung, q = punkt(G.i, G.s * (RAND + 1.2));
    G.m = geysirMesh(true); G.m.position.set(q.x, 0, q.z); streckeG.add(G.m);
    band(G.s * (RAND - .2), G.s * (RAND + 3.6), i => (Math.floor(i / meter(2)) % 2 ? "#3A2E30" : "#33282A"), .07, G.i - meter(24), G.i + meter(1));
    const sp = punkt(wrap(G.i - meter(34)), G.s * (MAUER - 1.2)), sch = new THREE.Mesh(box(4.6, 1.1, .2), schildMat("GEYSIR ➜", "#FFE2B0", "#8E2F22", 512, 96));
    sch.position.set(sp.x, 2.6, sp.z); sch.rotation.y = sp.rot + Math.PI; streckeG.add(sch);
    const pp = new THREE.Mesh(zyl(.08, .08, 2.4), M("#3A2E30")); pp.position.set(sp.x, 1.2, sp.z); streckeG.add(pp);
  }
  for (const P of pfade) {
    const rot = Math.atan2(P.ux, P.uz), nx = -P.uz, nz = P.ux;
    P.g = new THREE.Group(); streckeG.add(P.g);
    if (P.art === "steine") {
      P.mat = new THREE.MeshLambertMaterial({ color: "#6E5E62" });
      const n = Math.max(6, Math.round(P.len / 3.3));
      for (let j = 0; j <= n; j++) {
        const m = j / n * P.len, st = new THREE.Mesh(zyl(1.75, 1.95, 1.4, 9), P.mat);
        st.position.set(P.ax + P.ux * m + Math.sin(j * 2.3) * .2, -.35, P.az + P.uz * m + Math.cos(j * 1.7) * .2); st.rotation.y = j; st.castShadow = st.receiveShadow = true; P.g.add(st);
      }
    } else {
      P.g.position.set(P.ax, 0, P.az);
      const planken = [], pf = [], seile = [];
      for (let m = 0; m <= P.len; m += 1.1) planken.push([P.ux * m, .42, P.uz * m, rot, 1, Math.round(m / 1.1) % 3 ? "#5A3A26" : "#4A2E1E"]);
      for (let m = 0; m <= P.len + .1; m += P.len / Math.max(2, Math.round(P.len / 4))) for (const sd of [-1, 1]) {
        pf.push([P.ux * m + nx * sd * 2.6, 1, P.uz * m + nz * sd * 2.6, rot]);
        if (m + 1 < P.len) { const mm = m + P.len / Math.max(2, Math.round(P.len / 4)) / 2; seile.push([P.ux * mm + nx * sd * 2.6, 1.55, P.uz * mm + nz * sd * 2.6, rot, 1]); }
      }
      rein(instanzen(box(5.4, .25, 1), new THREE.MeshLambertMaterial({ color: "#ffffff" }), planken), P.g);
      rein(instanzen(box(.3, 2, .3), M("#2E252B"), pf), P.g);
      rein(instanzen(box(.09, .09, P.len / Math.max(2, Math.round(P.len / 4)) + .2), M("#6B6570"), seile, false), P.g);
    }
    const sp = punkt(wrap(P.i - meter(34)), P.s * (MAUER - 1.2)), sch = new THREE.Mesh(box(4.6, 1.1, .2), schildMat(P.art === "steine" ? "STEINE ➜" : "BRÜCKE ➜", "#FFE2B0", "#8E2F22", 512, 96));
    sch.position.set(sp.x, 2.6, sp.z); sch.rotation.y = sp.rot + Math.PI; streckeG.add(sch);
    const pp = new THREE.Mesh(zyl(.08, .08, 2.4), M("#3A2E30")); pp.position.set(sp.x, 1.2, sp.z); streckeG.add(pp);
  }
  if (koenig && koenig.art === "drache") {
    // Horst: Felsnadel mit Goldschatz, oben sitzt der Drache (unterwegs ist er nicht da)
    const q = punkt(koenig.i, koenig.s * (MAUER + 8)), fels = new THREE.Group();
    teil(fels, zyl(4.2, 7, 9, 9), "#2E252B", 0, 4.5, 0); teil(fels, zyl(5.4, 4.2, 1.2, 9), "#3A2F35", 0, 9.4, 0);
    for (let n = 0; n < 9; n++) teil(fels, kugel(.55, 8), n % 3 ? "#E8B53A" : "#F2D06A", Math.sin(n * 2.4) * 3.3, 10.1, Math.cos(n * 2.4) * 3.3);
    const sch = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), scheinMat); sch.rotation.x = -Math.PI / 2; sch.position.y = .13; fels.add(sch);
    fels.position.set(q.x, 0, q.z); fels.traverse(o => { if (o.isMesh) o.castShadow = true; }); streckeG.add(fels);
    const g = dracheMesh(2.1); g.position.set(q.x, 12, q.z); g.rotation.y = q.rot - Math.PI / 2 * koenig.s; streckeG.add(g); koenig.g = g;
    belegt.push({ x: q.x, z: q.z, r: 10 });
    const sp = punkt(wrap(koenig.i - meter(32)), koenig.s * (MAUER - 1.2)), ss = new THREE.Mesh(box(4.8, 1.1, .2), schildMat("DRACHE ⚠", "#FFE2B0", "#8E2F22", 512, 96));
    ss.position.set(sp.x, 2.8, sp.z); ss.rotation.y = sp.rot + Math.PI; streckeG.add(ss);
  }
}
function eierDeko(i, sg) {
  const q = punkt(i, sg * (MAUER + 4));
  for (let n = 0; n < 14; n++) { const ei = new THREE.Mesh(kugel(.6 + (n % 3) * .2, 10), M(n % 4 ? "#E8E6D6" : "#D6E8C8")); ei.scale.y = 1.3; ei.position.set(q.x + Math.sin(n * 2.4) * (1 + n * .25), .8, q.z + Math.cos(n * 2.4) * (1 + n * .25)); streckeG.add(ei); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), netzMat); m.position.set(q.x, 6, q.z); m.rotation.y = q.rot + Math.PI / 2; streckeG.add(m);
  belegt.push({ x: q.x, z: q.z, r: 7 });
}
function pilzHaus(i, sg) {
  const q = punkt(i, sg * (MAUER + 11)), g = new THREE.Group();
  teil(g, zyl(3.6, 4.4, 9, 16), "#E6DCC4", 0, 4.5, 0);
  const k = teil(g, new THREE.SphereGeometry(8, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), "#C8443A", 0, 8.5, 0); k.scale.y = .7;
  for (let n = 0; n < 9; n++) { const w = n * 2.3; teil(g, kugel(.9, 8), "#FFF6E6", Math.sin(w) * 5.5, 10.8 - (n % 2) * 1.4, Math.cos(w) * 5.5); }
  for (let n = 0; n < 5; n++) { const w = n / 5 * Math.PI * 2, f = teil(g, new THREE.PlaneGeometry(1.1, 1.6), null, Math.sin(w) * 4.05, 4 + (n % 2) * 2.4, Math.cos(w) * 4.05, 0, w, 0, GLUT("#9BFFD0")); f.material.side = THREE.DoubleSide; }
  teil(g, box(1.8, 3, .3), "#5A3F2A", 0, 1.5, 4.2);
  g.position.set(q.x, 0, q.z); g.rotation.y = q.rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); streckeG.add(g);
  const sl = new THREE.Mesh(box(8, 1.6, .3), schildMat("PILZHAIN", "#DFF7EA", "#1E4A3A", 1024, 160)); const sq = punkt(i, sg * (MAUER + 2.6)); sl.position.set(sq.x, 3.2, sq.z); sl.rotation.y = sq.rot + (sg > 0 ? -Math.PI / 2 : Math.PI / 2); streckeG.add(sl);
  belegt.push({ x: q.x, z: q.z, r: 10 });
}
// Gleisverlauf der Lore: Seitenabstand nach m Metern seit der Auffahrt
function lorePfad(f, m, zweig) {
  const ziel = f.s * (BR / 2 - 1.5);
  if (m < f.weiche) return f.railD;
  if (zweig === "ab") return f.railD + (ziel - f.railD) * Math.min(1, (m - f.weiche) / 14);
  const vorEnde = f.laenge - 12;
  return m < vorEnde ? f.railD : f.railD + (ziel - f.railD) * Math.min(1, (m - vorEnde) / 12);
}

// Halle drumherum: Säulen, die im Dunkeln verschwinden, Fässer, Kisten, Feuerschale
function hallenDeko() {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < S; i += 10) { x0 = Math.min(x0, PX[i]); x1 = Math.max(x1, PX[i]); z0 = Math.min(z0, PZ[i]); z1 = Math.max(z1, PZ[i]); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (welt === "grotte") { grottenDeko(x0, x1, z0, z1, cx, cz); return; }
  if (welt === "glut") { glutDeko(x0, x1, z0, z1, cx, cz); return; }
  // Feuerschale in der Mitte
  if (frei(cx, cz, MAUER + 16)) {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 3, 10), M("#5A5048")); s.position.y = 1.5; g.add(s);
    const sch = new THREE.Mesh(new THREE.CylinderGeometry(5, 3, 1.6, 16), M("#4A3F36")); sch.position.y = 3.6; g.add(sch);
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.9, 3 + (i % 3), 6), GLUT(i % 2 ? "#FF9A3C" : "#FFD15A")); f.position.set(Math.sin(i) * 2.2 * (i ? 1 : 0), 5.2, Math.cos(i) * 2.2 * (i ? 1 : 0)); g.add(f); }
    const sc2 = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), scheinMat); sc2.rotation.x = -Math.PI / 2; sc2.position.y = .12; g.add(sc2);
    g.position.set(cx, 0, cz); streckeG.add(g); belegt.push({ x: cx, z: cz, r: 12 });
  }
  const saeulen = [], kapitelle = [], faesser = [], kisten_ = [];
  const W = x1 - x0 + 160, H = z1 - z0 + 160;
  for (let n = 0; n < 1500 && saeulen.length < 75; n++) {
    const x = x0 - 80 + zufall() * W, z = z0 - 80 + zufall() * H;
    if (!frei(x, z, MAUER + 8)) continue;
    if (belegt.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + 4) ** 2)) continue;
    if (saeulen.some(([a, , c]) => (a - x) ** 2 + (c - z) ** 2 < 400)) continue;
    saeulen.push([x, 11, z, zufall() * 3]); kapitelle.push([x, .8, z, zufall() * 3]);
  }
  for (let n = 0; n < 2000 && faesser.length + kisten_.length < 150; n++) {
    const x = x0 - 70 + zufall() * (W - 20), z = z0 - 70 + zufall() * (H - 20);
    if (!frei(x, z, MAUER + 2.5)) continue;
    if (troll && (x - PX[troll.i]) ** 2 + (z - PZ[troll.i]) ** 2 < 60 ** 2) continue;
    if (belegt.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + 2) ** 2)) continue;
    if (zufall() < .5) faesser.push([x, .8, z, 0, .8 + zufall() * .4]); else kisten_.push([x, .7, z, zufall() * 3, .8 + zufall() * .5]);
  }
  instanzen(new THREE.CylinderGeometry(1.5, 1.7, 22, 10), M("#544B43"), saeulen);
  instanzen(new THREE.BoxGeometry(4.2, 1.6, 4.2), M("#4A423B"), kapitelle);
  instanzen(new THREE.CylinderGeometry(.75, .75, 1.6, 10), M("#7A5434"), faesser);
  instanzen(new THREE.BoxGeometry(1.4, 1.4, 1.4), M("#8A6A44"), kisten_);
}
// Grotte: Riesenkristall in der Mitte, Tropfsteine, Leuchtpilze und Felsbrocken
function grottenDeko(x0, x1, z0, z1, cx, cz) {
  if (frei(cx, cz, MAUER + 16)) {
    const g = new THREE.Group();
    for (const [x, z, h, rx, rz, f] of [[0, 0, 16, 0, 0, "#7FF3FF"], [3, 1, 10, 0, .4, "#C59BFF"], [-3, -1, 12, .2, -.35, "#7FF3FF"], [1, -3, 8, -.4, .1, "#C59BFF"], [-1.5, 3, 9, .35, 0, "#9BFFD0"]]) { const c = teil(g, new THREE.OctahedronGeometry(1.6), null, x, h / 2, z, rx, 0, rz, GLUT(f)); c.scale.y = h / 3.2; }
    const sc2 = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), scheinGruen); sc2.rotation.x = -Math.PI / 2; sc2.position.y = .12; g.add(sc2);
    g.position.set(cx, 0, cz); streckeG.add(g); belegt.push({ x: cx, z: cz, r: 12 });
  }
  const steine = [], spitzen = [], stiele = [], kappen = [], brocken = [];
  const W = x1 - x0 + 160, H = z1 - z0 + 160;
  for (let n = 0; n < 1500 && steine.length < 80; n++) {
    const x = x0 - 80 + zufall() * W, z = z0 - 80 + zufall() * H;
    if (!frei(x, z, MAUER + 8) || belegt.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + 4) ** 2) || steine.some(([a, , c]) => (a - x) ** 2 + (c - z) ** 2 < 360)) continue;
    const sz = .7 + zufall() * .8; steine.push([x, 9 * sz, z, zufall() * 3, sz]);
    spitzen.push([x + 3, 34 - 6 * sz, z - 2, zufall() * 3, sz]);
  }
  for (let n = 0; n < 2500 && stiele.length + brocken.length < 170; n++) {
    const x = x0 - 70 + zufall() * (W - 20), z = z0 - 70 + zufall() * (H - 20);
    if (!frei(x, z, MAUER + 2.5) || belegt.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + 2) ** 2)) continue;
    if (pilzSprung && (x - PX[pilzSprung.i]) ** 2 + (z - PZ[pilzSprung.i]) ** 2 < 50 ** 2) continue;
    if (schluchten.some(c => { for (let k = 0; k <= c.m; k += 15) { const j = wrap(c.i0 + k); if ((PX[j] - x) ** 2 + (PZ[j] - z) ** 2 < 45 ** 2) return true; } return false; })) continue;
    const sz = .6 + zufall() * .9;
    if (zufall() < .55) { stiele.push([x, 1.2 * sz, z, 0, sz]); kappen.push([x, 2.4 * sz, z, zufall() * 3, sz, zufall() < .5 ? "#4FE3B6" : zufall() < .5 ? "#E070FF" : "#7FC8FF"]); }
    else brocken.push([x, .6 * sz, z, zufall() * 3, sz]);
  }
  instanzen(new THREE.ConeGeometry(3.2, 18, 9), M("#3C4A43"), steine);
  const sp = new THREE.ConeGeometry(2.4, 12, 8); sp.rotateX(Math.PI);
  instanzen(sp, M("#2E3A34"), spitzen, false);
  instanzen(new THREE.CylinderGeometry(.35, .5, 2.4, 7), M("#D6E4D8"), stiele);
  instanzen(new THREE.SphereGeometry(1.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#ffffff" }), kappen, false);
  instanzen(new THREE.DodecahedronGeometry(1.2), M("#46534C"), brocken);
}
// Glutschlund: Vulkan in der Mitte, Obsidian-Spitzen, Lavatümpel, Schlacke
function glutDeko(x0, x1, z0, z1, cx, cz) {
  if (frei(cx, cz, MAUER + 24)) {
    const g = new THREE.Group();
    teil(g, zyl(4, 20, 24, 16), "#2A1F22", 0, 12, 0);
    teil(g, zyl(3.6, 3.6, .2, 16), null, 0, 24.05, 0, 0, 0, 0, GLUT("#FF7A1A"));
    for (let n = 0; n < 4; n++) { const s = new THREE.Group(); s.rotation.y = n * 1.7 + .4; teil(s, box(1.3, .3, 28.8), null, 0, 12.3, 12.1, Math.atan2(24, 16), 0, 0, GLUT(n % 2 ? "#EA580C" : "#F97316")); g.add(s); }
    const sc2 = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), scheinMat); sc2.rotation.x = -Math.PI / 2; sc2.position.y = .12; g.add(sc2);
    g.position.set(cx, 0, cz); streckeG.add(g); belegt.push({ x: cx, z: cz, r: 22 });
  }
  const nahLava = (x, z, r) => schluchten.some(c => { for (let k = 0; k <= c.m; k += 15) { const j = wrap(c.i0 + k); if ((PX[j] - x) ** 2 + (PZ[j] - z) ** 2 < r * r) return true; } return false; })
    || pfade.some(P => (P.ax + P.ux * P.len / 2 - x) ** 2 + (P.az + P.uz * P.len / 2 - z) ** 2 < (P.len / 2 + 15) ** 2);
  const spitzen = [], tuempel = [], brocken = [], glut = [];
  const W = x1 - x0 + 160, H = z1 - z0 + 160;
  for (let n = 0; n < 1500 && spitzen.length < 70; n++) {
    const x = x0 - 80 + zufall() * W, z = z0 - 80 + zufall() * H;
    if (!frei(x, z, MAUER + 8) || belegt.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + 4) ** 2) || spitzen.some(([a, , c]) => (a - x) ** 2 + (c - z) ** 2 < 300) || nahLava(x, z, 40)) continue;
    const sz = .7 + zufall() * .9; spitzen.push([x, 7 * sz, z, zufall() * 3, sz]);
  }
  for (let n = 0; n < 2500 && tuempel.length + brocken.length < 150; n++) {
    const x = x0 - 70 + zufall() * (W - 20), z = z0 - 70 + zufall() * (H - 20);
    if (!frei(x, z, MAUER + 3) || belegt.some(b => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + 2) ** 2) || nahLava(x, z, 44)) continue;
    const sz = .7 + zufall() * 1.1;
    if (zufall() < .3) tuempel.push([x, .03, z, 0, sz]); else { brocken.push([x, .5 * sz, z, zufall() * 3, sz]); if (zufall() < .3) glut.push([x, .9 * sz, z, 0, sz * .5]); }
  }
  instanzen(new THREE.ConeGeometry(2.6, 14, 5), M("#231B21"), spitzen);
  const tg = new THREE.CircleGeometry(2.4, 14); tg.rotateX(-Math.PI / 2);
  instanzen(tg, GLUT("#EA580C"), tuempel, false).receiveShadow = false;
  instanzen(new THREE.DodecahedronGeometry(1.1), M("#33292E"), brocken);
  instanzen(kugel(.5, 6), GLUT("#FF8A2A"), glut, false);
}
// Start: Steinbogen mit Schild und Bannern, Fässer an der Geraden
function startBogen() {
  const gr = welt === "grotte", gl = welt === "glut", fels = gr ? "#4A5750" : gl ? "#3A2F33" : "#6E655C", banner = gr ? "#2F7A64" : gl ? "#C2410C" : "#8E2F22";
  const d = BR / 2 + 2.2, r0 = Math.atan2(TX[0], TZ[0]);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 8, 1.6), M(fels)); p.position.set(PX[0] + nX(0) * d * s, 4, PZ[0] + nZ(0) * d * s); p.castShadow = true; streckeG.add(p);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.4), new THREE.MeshLambertMaterial({ color: banner, side: THREE.DoubleSide }));
    ban.position.set(PX[0] + nX(0) * (d - 1.6) * s, 5.2, PZ[0] + nZ(0) * (d - 1.6) * s); ban.rotation.y = r0; streckeG.add(ban);
  }
  const bo = new THREE.Mesh(new THREE.BoxGeometry(d * 2 + 1.6, 1.4, 1.4), M(fels)); bo.position.set(PX[0], 8.6, PZ[0]); bo.rotation.y = r0 + Math.PI / 2; streckeG.add(bo);
  const b = new THREE.Mesh(new THREE.BoxGeometry(d * 2 - 1, 1.5, .4), schildMat("START · ZIEL", "#F3E6CC", "#2A2118", 1024, 96));
  b.position.set(PX[0], 7.2, PZ[0]); b.rotation.y = r0 + Math.PI; streckeG.add(b);
  for (let i = 0; i < 6; i++) {
    const p = punkt(meter(18 + i * 12), -(MAUER + 2.4));
    if (gr) { const g = new THREE.Group(); teil(g, zyl(.3, .4, 1.6, 7), "#D6E4D8", 0, .8, 0); const k = teil(g, new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), null, 0, 1.6, 0, 0, 0, 0, GLUT(i % 2 ? "#E070FF" : "#4FE3B6")); g.position.set(p.x, 0, p.z); streckeG.add(g); continue; }
    if (gl) { const g = new THREE.Group(); teil(g, zyl(.9, .6, .9, 8), "#2E252B", 0, .45, 0); teil(g, kegel(.5, 1.1, 6), null, 0, 1.4, 0, 0, 0, 0, GLUT(i % 2 ? "#FF8A2A" : "#FFC14A")); g.position.set(p.x, 0, p.z); streckeG.add(g); continue; }
    const f = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 1.3, 10), M("#7A5434")); f.position.set(p.x, .65, p.z); f.castShadow = true; streckeG.add(f);
  }
}

// Flammen flackern: jede Fackel hat zwei Flammen, die abwechselnd größer und kleiner werden
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
  bardin(f) {        // Lautenwagen: der Bauch einer Laute auf Rädern, der Hals ragt nach hinten
    const g = neu();
    const bauch = teil(g, zyl(.78, .78, .42, 22), "#C9853A", 0, .72, .15); bauch.scale.z = 1.45;
    const decke = teil(g, zyl(.7, .7, .04, 22), "#E2B06A", 0, .95, .15); decke.scale.z = 1.4;
    teil(g, zyl(.2, .2, .05, 14), "#2A1A10", 0, .97, .55);
    teil(g, box(.36, .2, 1.5), "#6B4A2E", 0, .9, -1.3);
    teil(g, box(.42, .22, .5), "#4A3426", 0, 1.0, -2.1, -.45);
    for (const s of [-1, 1]) for (const z of [-1.95, -2.2]) teil(g, zyl(.04, .04, .22, 6), "#F3E6CC", s * .25, 1.1, z, 0, 0, Math.PI / 2);
    for (const x of [-.12, -.04, .04, .12]) teil(g, box(.015, .015, 2.4), "#F3E6CC", x, 1.0, -.55);
    teil(g, box(.5, .06, .1), "#3A2A1A", 0, .99, 1.05);
    for (const x of [-.74, .74]) for (const z of [-.55, .85]) rad(g, x, z, .36, "#5A3A22", "#C9853A");
    // Bardin
    teil(g, zyl(.32, .48, .85, 12), "#2F7F8A", 0, 1.38, .05);
    teil(g, box(.68, .08, .1), "#E2B06A", 0, 1.2, -.25);
    for (const s of [-1, 1]) teil(g, kapsel(.11, .45), "#2F7F8A", s * .38, 1.48, .35, 1.2);
    teil(g, kugel(.25), HAUT, 0, 2.0, .18);
    teil(g, kugel(.27), "#B8461E", 0, 2.04, .05).scale.set(1, .9, 1);
    const hut = teil(g, zyl(.42, .42, .1, 16), "#2F7F8A", .04, 2.24, .12, .12, 0, -.15);
    teil(g, kapsel(.05, .55), "#E23B2E", -.28, 2.48, -.08, -.5, 0, .5);
    hut.userData.k = 1;
    wimpel(g, f, .6, 1.0, -.7, 1.3);
    return g;
  },
  hexe(f) {          // Kessel auf Rädern, darin brodelt es grün
    const g = neu();
    teil(g, zyl(.95, .62, 1.0, 18), "#2A2430", 0, .95, .1);
    teil(g, new THREE.TorusGeometry(.95, .08, 8, 22), "#3E3646", 0, 1.45, .1, Math.PI / 2);
    teil(g, zyl(.88, .88, .04, 18), "", 0, 1.38, .1, 0, 0, 0, GLUT("#8BD14A"));
    for (const [x, z, r] of [[.35, .45, .14], [-.3, .3, .1], [.1, -.1, .12], [-.45, -.25, .08]]) teil(g, kugel(r, 8), "", x, 1.44, z, 0, 0, 0, GLUT("#B9F07A"));
    for (const a of [0, 2.1, 4.2]) teil(g, zyl(.07, .05, .5, 6), "#2A2430", Math.sin(a) * .5, .35, .1 + Math.cos(a) * .5);
    for (const x of [-.82, .82]) for (const z of [-.6, .75]) rad(g, x, z, .38, "#2E1C46", "#8BD14A");
    teil(g, zyl(.05, .05, 2.4, 6), "#6B4A2E", .7, 1.3, -.5, .9);
    teil(g, kegel(.22, .55, 8), "#C9A46A", .7, .55, -1.45, -.68 - Math.PI / 2);
    // Hexe
    teil(g, zyl(.3, .46, .8, 12), "#4A2E6E", 0, 1.75, -.15);
    for (const s of [-1, 1]) teil(g, kapsel(.1, .42), "#4A2E6E", s * .36, 1.85, .2, 1.2);
    teil(g, kugel(.24), "#9BC98A", 0, 2.32, -.08);
    teil(g, kegel(.1, .22, 6), "#9BC98A", 0, 2.28, .2, Math.PI / 2);
    teil(g, kugel(.27), "#2A1A10", 0, 2.3, -.24);
    teil(g, zyl(.55, .55, .05, 18), "#3A2458", 0, 2.5, -.1);
    teil(g, kegel(.3, 1.0, 12), "#4A2E6E", 0, 3.0, -.22, -.3);
    teil(g, box(.62, .08, .06), "#8BD14A", 0, 2.56, -.1);
    wimpel(g, f, -.75, 1.1, -.6, 1.3);
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
// „Z“ für schläfrige Karts (Schlaflied)
const zzzMat = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64; const x = cv.getContext("2d");
  x.font = "900 54px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 8; x.strokeStyle = "#1C1A33"; x.strokeText("Z", 32, 34); x.fillStyle = "#BFD8FF"; x.fillText("Z", 32, 34);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
})();
// Kröte (Verwandeln): ersetzt das Kart samt Fahrer
// Krone über dem führenden Menschen (Ausgleich)
function kronenModell() {
  const g = new THREE.Group();
  teil(g, zyl(.42, .38, .32, 12), "#F2B705", 0, 0, 0);
  for (let i = 0; i < 5; i++) { const w = i / 5 * Math.PI * 2; teil(g, kegel(.11, .32, 4), "#F2B705", Math.sin(w) * .4, .3, Math.cos(w) * .4); teil(g, kugel(.06, 6), i % 2 ? "#E23B2E" : "#2F6FDE", Math.sin(w) * .41, .02, Math.cos(w) * .41); }
  g.traverse(o => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: o.material.color }); });
  return g;
}
function kroetenModell(farbe) {
  const g = new THREE.Group();
  teil(g, kugel(1.0, 14), "#5E9B3A", 0, .75, 0).scale.set(1.15, .7, 1.25);
  teil(g, kugel(.8, 12), "#C9D98A", 0, .62, .25).scale.set(1, .55, 1);
  for (const s of [-1, 1]) {
    teil(g, kugel(.3, 10), "#5E9B3A", s * .48, 1.35, .6);
    teil(g, kugel(.2, 8), "#F5E27A", s * .5, 1.45, .78);
    teil(g, kugel(.1, 6), "#16161D", s * .5, 1.48, .95);
    teil(g, kapsel(.2, .7), "#4E8A30", s * .95, .35, -.35, 1.3, 0, 0);
    teil(g, box(.5, .08, .4), "#4E8A30", s * .7, .06, .85);
  }
  teil(g, box(.7, .05, .06), "#2E4A1E", 0, .72, 1.2);
  teil(g, zyl(.04, .04, .9, 6), "#4A3426", -.6, 1.4, -.6); teil(g, box(.04, .32, .46), farbe, -.6, 1.7, -.85);
  return g;
}
const funkenGeo = new THREE.SphereGeometry(.13, 6, 4);
class Kart {
  constructor(typ, name, istIch, eigeneFarbe) {
    if (!TYPEN[typ]) typ = "kaempfer";
    this.typ = typ; this.st = TYPEN[typ]; this.name = name; this.ich = istIch;
    this.farbe = eigeneFarbe || TYPEN[typ].farbe || "#E23B2E";
    this.g = new THREE.Group(); this.koerper = MODELLE[typ](this.farbe); if (fluch === "koepfe") riesenkopf(this.koerper); backen(this.koerper); this.g.add(this.koerper);
    this.g.traverse(o => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    const schatten = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: .3, depthWrite: false }));
    schatten.rotation.x = -Math.PI / 2; this.schatten = schatten; sc.add(schatten);
    this.funken = [];
    for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(funkenGeo, new THREE.MeshBasicMaterial({ color: "#F2B705" })); f.visible = false; this.g.add(f); this.funken.push(f); }
    this.flamme = new THREE.Mesh(new THREE.ConeGeometry(.35, 1.4, 8), new THREE.MeshBasicMaterial({ color: "#F97316", transparent: true, opacity: .85 }));
    this.flamme.rotation.x = -Math.PI / 2; this.flamme.position.set(0, .7, -1.8); this.flamme.visible = false; this.g.add(this.flamme);
    // Extras am Kart: Turmschild hinten, Segensschein, Netz, Fledermäuse
    this.schildM = new THREE.Group(); teil(this.schildM, box(1.5, 1.2, .16), this.farbe, 0, 0, 0); teil(this.schildM, box(1.62, .14, .2), "#E8C24A", 0, .6, 0);
    teil(this.schildM, box(1.62, .14, .2), "#E8C24A", 0, -.6, 0); teil(this.schildM, box(.16, 1.2, .2), "#E8C24A", 0, 0, -.02);
    this.schildM.position.set(0, 1, -1.55); this.schildM.visible = false; this.g.add(this.schildM);
    this.aura = new THREE.Mesh(kugel(1.9, 16), new THREE.MeshBasicMaterial({ color: "#FFD86A", transparent: true, opacity: .28, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.aura.position.y = 1; this.aura.visible = false; this.g.add(this.aura);
    this.netzM = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#F2EDE0", wireframe: true }));
    this.netzM.position.y = .2; this.netzM.visible = false; this.g.add(this.netzM);
    this.fleder = 0; this.flederM = new THREE.Group(); this.flederM.visible = false; this.g.add(this.flederM);
    for (let i = 0; i < 3; i++) { const f = new THREE.Group(); teil(f, kugel(.14, 6), "#1B1620", 0, 0, 0); teil(f, kegel(.3, .5, 3), "#1B1620", .3, 0, 0, 0, 0, -Math.PI / 2).scale.z = .2; teil(f, kegel(.3, .5, 3), "#1B1620", -.3, 0, 0, 0, 0, Math.PI / 2).scale.z = .2; this.flederM.add(f); }
    // Heldenkräfte am Kart: Wirbelring, Schildwall, Eisblock, Segensring, Windfahnen, Skelette
    const hell = (farbe, op) => new THREE.MeshBasicMaterial({ color: farbe, transparent: true, opacity: op, depthWrite: false });
    this.wirbelM = new THREE.Mesh(new THREE.TorusGeometry(2.6, .14, 6, 28), hell("#F2EDE0", .6)); this.wirbelM.rotation.x = Math.PI / 2; this.wirbelM.position.y = .9; this.wirbelM.visible = false; this.g.add(this.wirbelM);
    this.wallM = new THREE.Group(); teil(this.wallM, box(3.2, 2, .22), "#D7B44A", 0, 0, 0); teil(this.wallM, box(2.6, 1.5, .26), "#F2EDE0", 0, 0, 0);
    teil(this.wallM, box(.36, 1.5, .3), "#C9372C", 0, 0, 0); teil(this.wallM, box(2.6, .34, .3), "#C9372C", 0, .2, 0);
    const wglanz = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3), hell("#FFE7A0", .25)); wglanz.position.z = .2; this.wallM.add(wglanz);
    this.wallM.position.set(0, 1.2, 2.3); this.wallM.visible = false; this.g.add(this.wallM);
    this.eisM = new THREE.Mesh(box(2.7, 2.5, 3.7), new THREE.MeshLambertMaterial({ color: "#BDE8FF", transparent: true, opacity: .55, depthWrite: false })); this.eisM.position.y = 1.15; this.eisM.visible = false; this.g.add(this.eisM);
    this.segenM = new THREE.Group(); this.segenM.add(new THREE.Mesh(new THREE.TorusGeometry(1.9, .1, 6, 32), hell("#8BF0A0", .8)));
    this.segenM.add(new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 2.6, 24, 1, true), hell("#8BF0A0", .14))); this.segenM.children[0].rotation.x = Math.PI / 2; this.segenM.children[1].position.y = 1.3;
    this.segenM.position.y = .15; this.segenM.visible = false; this.g.add(this.segenM);
    this.windM = new THREE.Group(); for (const [x, y] of [[-1, .7], [1, .7], [0, 1.9], [-.5, 1.3], [.6, 1.4]]) { const f = new THREE.Mesh(box(.06, .06, 3.2), hell("#FFFFFF", .55)); f.position.set(x, y, -2.6); this.windM.add(f); }
    this.windM.visible = false; this.g.add(this.windM);
    this.skelM = [-.7, .7].map(x => { const s = new THREE.Group(); teil(s, kugel(.26, 10), "#EDE4D0", 0, .62, 0); teil(s, kugel(.06, 6), "#1B1620", -.09, .66, .22); teil(s, kugel(.06, 6), "#1B1620", .09, .66, .22);
      teil(s, box(.36, .42, .2), "#E2D8C2", 0, .18, 0); teil(s, box(.5, .08, .08), "#E2D8C2", 0, .3, .1); for (const a of [-1, 1]) teil(s, zyl(.04, .04, .55, 5), "#E2D8C2", a * .28, .38, .2, -1.2, 0, a * .4);
      s.position.set(x, 1.05, -1.25); s.visible = false; this.g.add(s); return s; });
    this.zzzM = new THREE.Group(); for (let i = 0; i < 3; i++) this.zzzM.add(new THREE.Sprite(zzzMat)); this.zzzM.visible = false; this.g.add(this.zzzM);
    this.kroeteM = kroetenModell(this.farbe); this.kroeteM.visible = false; this.g.add(this.kroeteM);
    this.kroneM = kronenModell(); this.kroneM.visible = false; this.g.add(this.kroneM);
    this.schwingenM = new THREE.Group(); this.schwingenM.add(schwinge(1), schwinge(-1)); this.schwingenM.position.set(0, 2.5, -.2); this.schwingenM.visible = false; this.g.add(this.schwingenM);
    this.faesserM = new THREE.Group(); for (const x of [-1.15, 1.15]) teil(this.faesserM, zyl(.42, .42, 2.6, 10), "#7A5434", x, .15, 0, Math.PI / 2); this.faesserM.visible = false; this.g.add(this.faesserM);
    sc.add(this.g);
  }
  setzen(i, d) {
    this.x = PX[i] + nX(i) * d; this.z = PZ[i] + nZ(i) * d; this.y = 0; this.vy = 0; this.luft = false;
    this.yaw = this.mh = Math.atan2(TX[i], TZ[i]); this.v = 0; this.s = 0;
    this.idx = i; this.prog = i > S / 2 ? i - S : i; this.d = d;
    this.boost = 0; this.drift = 0; this.ladung = 0; this.item = null; this.fertig = null; this.runden = []; this.rundeStart = 0;
    this.botTimer = 0; this.spur = d; this.dreher = 0;
    this.walze = 0; this.schild = false; this.amulett = 0; this.haken = null; this.extraUhr = null; this.lore = null; this.flug = null;
    this.schonzeit = this.netz = this.bremse = this.fleder = this.sporen = this.erholung = this.holper = 0;
    this.absturz = null; this.wurzel = 0; this.riss = null; this.pfad = null; this.geysirUhr = 0;
    this.kraft = 0; this.gold = 0; this.wirbel = this.wall = this.unsicht = this.wind = this.segen = this.eis = this.glatt = this.skelette = this.skelettUhr = 0; this.klauVor = null; this.wirbelGetroffen = null;
    this.schlaf = this.kroete = this.fluegel = 0; this.rw = this.rwA = 1; this.krone = false; this.goldtruhe = false; this.gleit = 0;
  }
  suchen() {                                     // nächster Streckenpunkt über die ganze Runde
    let best = Infinity, bi = 0;
    for (let i = 0; i < S; i += 3) { const q = (this.x - PX[i]) ** 2 + (this.z - PZ[i]) ** 2 + ((this.y || 0) - HOCH[i]) ** 2 * 4; if (q < best) { best = q; bi = i; } }
    this.idx = bi; this.naechster();
  }
  // Zustand eines anderen Handys übernehmen; dazwischen wird weitergerechnet und weich nachgeführt
  netzZustand(a) {
    const [x, y, z, yaw, v, s, drift, boost, prog, ladung, fx = 0] = a;
    this.schild = !!(fx & 1); this.amulett = fx & 2 ? 1 : 0; this.netz = fx & 4 ? 1 : 0; this.fleder = fx & 8 ? 1 : 0; this.schonzeit = fx & 16 ? 1 : 0;
    this.wirbel = fx & 64 ? 1 : 0; this.wall = fx & 128 ? 1 : 0; this.unsicht = fx & 256 ? 1 : 0; this.eis = fx & 512 ? 1 : 0; this.segen = fx & 1024 ? 1 : 0; this.wind = fx & 2048 ? 1 : 0;
    this.skelette = (fx & 4096 ? 1 : 0) + (fx & 8192 ? 1 : 0); this.abst = !!(fx & 16384); this.dreher = fx & 32768 ? 1 : 0;
    this.schlaf = fx & 65536 ? 1 : 0; this.kroete = fx & 131072 ? 1 : 0; this.fluegel = fx & 262144 ? 1 : 0; this.gleit = fx & 524288 ? 1 : 0;
    const erst = !this.nz;
    this.nz = { x, y, z, yaw, v, t: performance.now() };
    this.s = s; this.drift = drift; this.boost = boost || fx & 32 ? .2 : 0; this.ladung = ladung; this.netzProg = prog;
    if (erst) { this.x = x; this.y = y; this.z = z; this.yaw = this.mh = yaw; this.v = v; this.suchen(); this.prog = prog; }
  }
  folgen(dt) {
    const n = this.nz; if (!n) return;
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
    const fx = (this.schild ? 1 : 0) | (this.amulett > 0 ? 2 : 0) | (this.netz > 0 ? 4 : 0) | (this.fleder > 0 ? 8 : 0) | (this.schonzeit > 0 && !(this.dreher > 0) ? 16 : 0) | (this.haken ? 32 : 0)
      | (this.wirbel > 0 ? 64 : 0) | (this.wall > 0 ? 128 : 0) | (this.unsicht > 0 ? 256 : 0) | (this.eis > 0 ? 512 : 0) | (this.segen > 0 ? 1024 : 0) | (this.wind > 0 ? 2048 : 0)
      | (this.skelette > 0 ? 4096 : 0) | (this.skelette > 1 ? 8192 : 0) | (this.absturz ? 16384 : 0) | (this.dreher > 0 ? 32768 : 0)
      | (this.schlaf > 0 ? 65536 : 0) | (this.kroete > 0 ? 131072 : 0) | (this.fluegel > 0 ? 262144 : 0) | (this.gleit ? 524288 : 0);
    return [r2(this.x), r2(this.y), r2(this.z), r2(this.yaw), r2(this.v), r2(this.s), this.drift, this.boost > 0 ? 1 : 0, this.prog, r2(this.ladung), fx];
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
    const offroad = Math.abs(wegQuer(this.idx, this.d)) > RAND && !this.luft, nass = BELAG[this.idx] === 1 && !this.luft;
    const boot = BELAG[this.idx] === BOOT && !this.luft && this.typ !== "magierin";   // schwimmt: Mitte schnell (Strömung), Rand langsam
    if (this.boost > 0) this.boost -= dt;
    if (this.dreher > 0) this.dreher -= dt;
    let maxV = st.maxV * (offroad ? (st.gelaende || .5) : nass ? 1.1 : boot ? .84 + .28 * Math.max(0, 1 - Math.abs(this.d) / (BR / 2)) : 1);
    if (this.netz > 0) maxV *= .7;
    if (this.bremse > 0) maxV *= .55;
    if (this.holper > 0) maxV *= .5;
    if (this.skelette > 0) maxV *= 1 - .14 * this.skelette;
    if (this.wurzel > 0) maxV *= .78;
    if (this.schlaf > 0) maxV *= .6;
    if (this.kroete > 0) maxV *= .7;
    // Hügel: bergab schneller, bergauf langsamer; schwere Karts merken beides stärker
    const hangZiel = this.luft ? (this.hang ?? 1) : klemmen(1 - STEIG[this.idx] * Math.cos(this.mh - Math.atan2(TX[this.idx], TZ[this.idx])) * 2.2 * (st.masse || 1), .78, 1.28);
    this.hang = (this.hang ?? 1) + (hangZiel - (this.hang ?? 1)) * Math.min(1, dt * 1.5);
    maxV *= this.hang;
    maxV *= 1 + this.gold * .006;                                   // jedes Goldstück macht etwas schneller
    maxV *= this.rw || 1;                                           // Rückenwind (Ausgleich)
    if (this.boost > 0) maxV = st.maxV * 1.4;
    if (this.wind > 0) maxV = st.maxV * 1.5;
    if (this.haken) maxV = st.maxV * 1.55;
    if (this.fluegel > 0) maxV = st.maxV * 1.6;
    if (ein.gas === false) maxV = 0; else if (this.dreher > 0) maxV = Math.min(maxV, st.maxV * .35);
    const schub = this.boost > 0 || this.haken || this.wind > 0 || this.fluegel > 0 ? 3 : (this.rwA || 1) * ( this.erholung > 0 && !(this.dreher > 0) ? 2.2 : 1);
    if (this.eis > 0) this.v *= Math.max(0, 1 - .45 * dt);         // eingefroren: schlittert ohne Antrieb
    else if (!this.luft) this.v += Math.max(-30 * dt, Math.min(st.accel * dt * schub, maxV - this.v));
    // Lenken (für Tasten geglättet); im Netz lenkt es sich schwer, im Eisblock gar nicht
    const lenk = this.eis > 0 ? 0 : ein.lenk * (this.netz > 0 ? .3 : 1) * (this.schlaf > 0 ? .45 : 1);
    this.s += (lenk - this.s) * Math.min(1, dt * (ein.direkt ? 30 : 9));
    // Drift
    if (!this.drift && ein.drift && Math.abs(this.s) > .25 && this.v > 14 && !this.luft && !(this.eis > 0)) { this.drift = Math.sign(this.s); this.ladung = 0; }
    if (this.drift && (!ein.drift || this.v < 9)) {
      if (this.ladung > 1.7) this.boost = Math.max(this.boost, 1.2); else if (this.ladung > .8) this.boost = Math.max(this.boost, .6);
      this.drift = 0; this.ladung = 0;
    }
    let s = this.s, wende = st.turn * (this.luft ? 1 : 1 + Math.abs(NEIG[this.idx]) * 2.5) * (boot ? .85 : 1);    // Steilkurve: lenkt sich leichter
    if (this.drift) { s = this.drift * .6 + this.s * .5; wende *= st.drift; this.ladung += dt * (.6 + Math.abs(s) * .6); if (phase === "rennen") kraftLaden(this, dt * (this.typ === "moench" ? .05 : .025)); }
    let rate = -s * wende * Math.min(1, Math.max(Math.abs(this.v), 3) / 10) * (this.v < -.5 ? -1 : 1) * (this.luft && !this.gleit ? .35 : 1);   // auch langsam etwas lenkbar
    if (this.dreher > 0) rate = 0;                 // beim Dreher dreht sich nur das Modell (zeigen), Fahrtrichtung und Blick bleiben
    this.yaw += rate * dt;
    const k = this.eis > 0 ? .5 : this.wind > 0 ? 16 : (this.drift ? 2.6 : st.grip) * (1 + Math.abs(NEIG[this.idx]) * 4) * (nass ? .55 : boot ? .5 : 1) * (this.glatt > 0 ? .3 : 1) * (fluch === "glatteis" ? .4 : 1);
    let diff = this.yaw - this.mh; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.mh += diff * (1 - Math.exp(-k * dt));
    if (this.dreher > 0) this.mh = this.mhFest;
    const alt = { x: this.x, z: this.z, idx: this.idx, prog: this.prog, d: this.d };
    this.x += Math.sin(this.mh) * this.v * dt; this.z += Math.cos(this.mh) * this.v * dt;
    if (this.wind > 0) { this.x -= Math.cos(this.mh) * this.s * 16 * dt; this.z += Math.sin(this.mh) * this.s * 16 * dt; }   // Windschritt: seitlich ausweichen
    this.naechster();
    streckeStoss(this, alt, dt);
    // Schlucht: wer über den Rand fährt, stürzt ab (nicht am Pilzsprung, dort entscheidet der Pilz)
    // In der Lava (Glutschlund): steigt sie in Runde 3, ist der Randstreifen schon überflutet
    const sch = SCHLUCHT[this.idx], kante = lavaHoch ? BR / 2 + .3 : BR / 2 + 1.6;
    if (sch && !this.luft && phase === "rennen" && (sch === 2 ? Math.abs(this.d) > RAND - .6 : this.d * sch > kante) && !vorsprung(this)) { if (!pfadEinstieg(this)) absturz(this); return; }
    // Mauer
    const mw = MAUERW[this.idx];
    if (WEG[this.idx]) wegMauer(this, dt);
    else if (Math.abs(this.d) > mw) {
      const zu = Math.abs(this.d) - mw, sg = Math.sign(this.d);
      this.x -= nX(this.idx) * sg * zu; this.z -= nZ(this.idx) * sg * zu; this.d = sg * mw;
      this.v *= Math.max(0, 1 - 3 * dt); this.yaw += sg * .9 * dt * Math.sign(Math.cos(this.mh - Math.atan2(TX[this.idx], TZ[this.idx])));   // von der Mauer weg drehen
    }
    // Höhe / Sprung
    const loch = LOCH[this.idx] && !(this.fluegel > 0), g = loch ? -60 : hoehe(this.idx, this.d);
    if (!this.luft) {
      if (g >= this.y - .05) { this.vy = (g - this.y) / Math.max(dt, .001); this.y = g; }
      else { this.luft = true; this.vy = Math.min(this.vy, 12); }
    }
    if (this.luft) {
      if (!this.gleit && GLEIT[this.idx] && this.vy < 2 && phase === "rennen") { this.gleit = 1; if (this.ich) { melden("Fledermausschwingen! 🦇 Lenken!", 1.1); summen(40); } }
      if (this.gleit) {                            // Gleiten: langsam sinken, Drift-Knopf = Sturzflug, Aufwind trägt nach oben
        const sink = (ein.drift ? 7.5 : 2.4) * (this.typ === "magierin" ? .78 : 1);
        this.vy = Math.max(this.vy - 32 * dt, -sink);
        for (const A of aufwinde) if ((A.x - this.x) ** 2 + (A.z - this.z) ** 2 < 14) this.vy = Math.min(this.vy + 34 * dt, 4.5);
        this.v += (st.maxV * (ein.drift ? 1.35 : 1.2) - this.v) * Math.min(1, dt * .8);
        if (!GLEIT[this.idx] && !loch) this.gleit = 0;
      } else this.vy -= 32 * dt;
      this.y += this.vy * dt;
      if (this.y <= g) { this.y = g; this.luft = false; this.vy = 0; this.landung = .25; if (this.gleit) { this.gleit = 0; this.boost = Math.max(this.boost, .4); } }
      else if (loch && this.y < -4 && phase === "rennen") { this.gleit = 0; absturz(this, LOCH_ZIEL[this.idx]); }
    }
    if (this.landung > 0) this.landung -= dt;
  }
  zeigen(zeit) {
    this.g.position.set(this.x, this.y, this.z);
    this.g.rotation.y = this.yaw;
    const vor = Math.cos(this.yaw - Math.atan2(TX[this.idx], TZ[this.idx]));      // fährt das Kart in Streckenrichtung?
    this.koerper.rotation.z = -this.s * .07 * Math.min(1, this.v / 15) + (this.drift ? -this.drift * .06 : 0) - (this.luft ? 0 : Math.atan(NEIG[this.idx]) * vor);
    this.koerper.rotation.x = this.luft ? -Math.max(-.25, Math.min(.25, this.vy * .02)) : -Math.atan(STEIG[this.idx]) * vor;
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
    this.flamme.visible = this.boost > 0 || !!this.haken || this.wind > 0;
    if (this.flamme.visible) this.flamme.scale.set(1, .7 + Math.random() * .6, 1);
    const t = zeit / 1000;
    this.schildM.visible = !!this.schild;
    this.aura.visible = this.amulett > 0; if (this.aura.visible) this.aura.material.opacity = .2 + Math.sin(t * 10) * .08;
    this.netzM.visible = this.netz > 0; if (this.netzM.visible) this.netzM.rotation.y = Math.sin(t * 9) * .2;
    this.flederM.visible = this.fleder > 0 || !!this.absturz || !!this.abst || this.fluegel > 0;
    if (this.fluegel > 0) this.koerper.position.y += 1 + Math.sin(t * 6) * .2;
    this.schwingenM.visible = !!this.gleit;
    if (this.gleit) this.schwingenM.children.forEach((w, n) => w.rotation.z = (n ? -1 : 1) * Math.sin(t * 7) * .18);
    const schwimmt = BELAG[this.idx] === BOOT && !this.luft && this.typ !== "magierin" && !this.absturz;
    this.faesserM.visible = schwimmt;
    if (schwimmt) { this.koerper.position.y += .35 + Math.sin(t * 3.1 + this.x * .3) * .12; this.koerper.rotation.z += Math.sin(t * 2.2 + this.z * .2) * .07; this.koerper.rotation.x += Math.sin(t * 1.7 + this.x * .2) * .04; }
    this.kroneM.visible = !!this.krone && !(this.kroete > 0); if (this.kroneM.visible) { this.kroneM.rotation.y = t * 1.5; this.kroneM.position.y = 2.75 + Math.sin(t * 3) * .08; }
    if (this.flederM.visible) this.flederM.children.forEach((f, i) => { const w = t * 5 + i * 2.1; f.position.set(Math.sin(w) * 1.2, 2.3 + Math.sin(t * 9 + i) * .25, Math.cos(w) * 1.2 + .6); f.rotation.y = w + Math.PI / 2; f.children[1].rotation.x = f.children[2].rotation.x = Math.sin(t * 30 + i) * .6; });
    this.koerper.visible = !(this.schonzeit > 0 && !(this.dreher > 0) && Math.floor(t * 12) % 2 === 0);
    // Dreher: genau zwei ganze Umdrehungen des Modells, danach schaut es wieder nach vorn
    const dreh = this.dreher > 0 ? (this.remote ? t * 14 : (1 - this.dreher / (this.dreherDauer || .95)) * Math.PI * 4) : 0;
    this.koerper.rotation.y = this.wirbel > 0 ? t * 26 : dreh;
    this.wirbelM.visible = this.wirbel > 0; if (this.wirbelM.visible) { this.wirbelM.rotation.z = t * 20; this.wirbelM.scale.setScalar(.85 + Math.sin(t * 30) * .12); }
    this.wallM.visible = this.wall > 0;
    this.eisM.visible = this.eis > 0;
    this.segenM.visible = this.segen > 0; if (this.segenM.visible) this.segenM.rotation.y = t * 2;
    this.windM.visible = this.wind > 0; if (this.windM.visible) this.windM.children.forEach((f, i) => f.scale.z = .6 + Math.random() * .8);
    this.skelM.forEach((s, i) => { s.visible = this.skelette > i; if (s.visible) s.rotation.z = Math.sin(t * 14 + i * 2) * .3; });
    this.zzzM.visible = this.schlaf > 0;
    if (this.zzzM.visible) this.zzzM.children.forEach((z, i) => { const p = (t * .8 + i / 3) % 1; z.position.set(.4 + p * .9 + Math.sin(t * 3 + i) * .15, 2.4 + p * 1.8, 0); z.scale.setScalar(.5 + p * .5); z.material.opacity = 1; });
    this.kroeteM.visible = this.kroete > 0;
    if (this.kroete > 0) { this.koerper.visible = false; this.kroeteM.position.y = Math.abs(Math.sin(t * 7)) * .6; this.kroeteM.rotation.x = -Math.cos(t * 7) * .12; }
    geist(this, this.unsicht > 0 ? (this.ich ? .35 : .08) : 0);
    if (this.seil) this.seil.visible = false;
    if (this.haken) {
      const z = karts.find(o => o.id === this.haken.ziel);
      if (z) {
        if (!this.seil) { this.seil = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: "#D9C9A8" })); sc.add(this.seil); }
        const a = this.seil.geometry.attributes.position; a.setXYZ(0, this.x, this.y + 1.2, this.z); a.setXYZ(1, z.x, z.y + 1, z.z); a.needsUpdate = true; this.seil.visible = true;
      }
    }
  }
}

// Unsichtbar (Langfinger): Körper durchsichtig machen, das eigene Kart bleibt schwach zu sehen
function geist(k, op) {
  if ((k.geistOp || 0) === op) return;
  k.geistOp = op;
  k.koerper.traverse(o => {
    if (!o.isMesh) return;
    if (op) {
      if (!o.userData.orig) o.userData.orig = o.material;
      if (!o.userData.geist) { o.userData.geist = o.userData.orig.clone(); o.userData.geist.transparent = true; o.userData.geist.depthWrite = false; }
      o.userData.geist.opacity = op; o.material = o.userData.geist;
    } else if (o.userData.orig) o.material = o.userData.orig;
  });
  k.schatten.material.opacity = op ? .08 : .3;
}

// ---------- Truhen ----------
// Etwa jede achte Truhe ist ein Mimik: Er blinzelt ab und zu (Deckel hebt sich, Zähne blitzen). Der Dieb sieht Mimiks rot umrandet.
const kisten = [];
const ROT_RAND = new THREE.MeshBasicMaterial({ color: "#FF2A2A", side: THREE.BackSide });
function truhe(mimik) {
  const g = new THREE.Group();
  const holz = mimik ? "#7E5229" : "#8A5A2E";
  teil(g, box(1.4, .75, 1.0), holz, 0, 0, 0);
  for (const x of [-.45, .45]) teil(g, box(.12, .78, 1.04), "#E8C24A", x, 0, 0);
  teil(g, box(.26, .3, .1), "#E8C24A", 0, .2, .52);
  const deckel = new THREE.Group(); deckel.position.set(0, .375, -.5); deckel.userData.lose = true; g.add(deckel);
  teil(deckel, new THREE.CylinderGeometry(.5, .5, 1.4, 12, 1, false, 0, Math.PI), mimik ? "#8E5E30" : "#9A6A3A", 0, 0, .5, 0, 0, Math.PI / 2);
  for (const x of [-.45, .45]) teil(deckel, new THREE.CylinderGeometry(.53, .53, .12, 12, 1, false, 0, Math.PI), "#E8C24A", x, 0, .5, 0, 0, Math.PI / 2);
  if (mimik) {
    teil(g, box(1.2, .06, .9), "#7A1E22", 0, .36, 0);                                 // Schlund
    for (let i = 0; i < 6; i++) teil(g, kegel(.07, .2, 5), "#FFF6E6", -.5 + i * .2, .45, .44);     // Unterzähne
    for (let i = 0; i < 5; i++) teil(deckel, kegel(.07, .2, 5), "#FFF6E6", -.4 + i * .2, -.08, .96, Math.PI);
    for (const x of [-.25, .25]) teil(deckel, kugel(.09, 8), null, x, .3, .9, 0, 0, 0, GLUT("#FFD23A"));
    const rand = new THREE.Mesh(box(1.62, 1.2, 1.22), ROT_RAND); rand.position.y = .12; rand.visible = false; rand.userData.lose = true; g.add(rand); g.userData.rand = rand;
  }
  backen(g); g.traverse(o => { if (o.isMesh && o.material !== ROT_RAND) o.castShadow = true; });
  g.userData.deckel = deckel; return g;
}
function truhenReihe(i, mitte = 0) {
  for (const d of [mitte - 3.4, mitte, mitte + 3.4]) {
    const x = PX[i] + nX(i) * d, z = PZ[i] + nZ(i) * d;
    const g = truhe(false), mg = truhe(true);
    for (const h of [g, mg]) { h.position.set(x, 1.1, z); streckeG.add(h); }
    const b = { g, mg, x, z, weg: 0, mimik: false, blinzeln: 2 + Math.random() * 3, i, d };
    neuMischen(b); kisten.push(b);
  }
}
// Goldstücke: füllen die Kraftleiste und machen etwas schneller (höchstens 10, bei Treffern fallen 2 heraus)
const muenzen = [];
let muenzGeo = null;
const MUENZ_MAT = new THREE.MeshLambertMaterial({ color: "#F2B705", emissive: "#7A5200" });
function goldReihe(i0, mitte, phase) {
  for (let k = 0; k < 5; k++) {
    const i = wrap(i0 + k * meter(3.2));
    let d = klemmen(mitte + Math.sin(phase + k * .7) * 2.2, -BR / 2 + 1.2, BR / 2 - 1.2);
    if (gabeln.some(f => gabelDrin(i, f))) d = (Math.sign(mitte) || 1) * BR / 4;
    if (WEG[i]) d = wegMitte(i, WEG_LANG[i]) + klemmen(d, -BR / 2 + 1.2, BR / 2 - 1.2);
    const q = punkt(i, d), m = new THREE.Mesh(muenzGeo, MUENZ_MAT);
    const y = hoehe(i, d) + 1; m.position.set(q.x, y, q.z); m.castShadow = true; streckeG.add(m);
    muenzen.push({ m, x: q.x, y, z: q.z, weg: 0, i, d });
  }
}
function goldNehmen(k, mz) {
  mz.weg = 8; mz.m.visible = false;
  k.gold = Math.min(10, (k.gold || 0) + 1); kraftLaden(k, (fluch === "gold" ? .1 : .05) * (k.typ === "bardin" ? 2 : 1));
  if (k.ich) { const g = $("gold"); g.classList.remove("neu"); void g.offsetWidth; g.classList.add("neu"); klang("muenze"); }
}
function neuMischen(b) { b.mimik = Math.random() < (fluch === "mimik" ? 1 / 3 : 1 / 8); b.g.visible = !b.mimik; b.mg.visible = b.mimik; }
function truhenZeigen(dt) {
  const dieb = ich && ich.typ === "dieb";
  for (const mz of muenzen) {
    if (mz.weg > 0) { mz.weg -= dt; if (mz.weg <= 0) { mz.weg = 0; mz.m.visible = true; } }
    else mz.m.rotation.y += dt * 3;
  }
  for (const b of kisten) {
    if (b.weg > 0) { b.weg -= dt; if (b.weg <= 0) { b.weg = 0; neuMischen(b); } }
    const h = b.mimik ? b.mg : b.g;
    h.rotation.y += dt * (zfAktiv("fieber") ? 4 : 1.2); h.position.y = 1.1 + (b.h || 0) + Math.sin(uhr * 3 + b.x) * .15; h.scale.setScalar(zfAktiv("fieber") ? 1.2 + Math.sin(uhr * 10) * .1 : 1);
    if (b.mimik) {
      b.blinzeln -= dt; if (b.blinzeln < -.45) b.blinzeln = 2.5 + Math.random() * 3.5;
      h.userData.deckel.rotation.x = b.blinzeln < 0 ? -Math.sin(-b.blinzeln / .45 * Math.PI) * .55 : 0;
      h.userData.rand.visible = dieb && !b.weg;
    }
  }
}

// ---------- Extras ----------
// Was in der Truhe steckt, hängt vom Platz ab (Gewichte für vorne, Mitte, hinten).
// Netz: Wer ein Extra einsetzt, schickt ein Ereignis, der Spielleiter reicht es an alle weiter. Jedes Handy zeigt Geschosse und Fallen selbst an.
// Ob ein Kart getroffen wird, entscheidet nur das Handy, das dieses Kart fährt (das eigene Kart, beim Spielleiter auch die Monster).
const SVG_KRAEHE = `<svg viewBox="0 0 40 40" width="38" height="38"><g fill="#6B717C" stroke="#1E1A18" stroke-width="2" stroke-linejoin="round"><path d="M20 2l4.5 14L20 20l-4.5-4z"/><path d="M38 20l-14 4.5L20 20l4-4.5z"/><path d="M20 38l-4.5-14L20 20l4.5 4z"/><path d="M2 20l14-4.5L20 20l-4 4.5z"/></g></svg>`;
const SVG_SCHLEIM = `<svg viewBox="0 0 40 40" width="38" height="38"><path d="M5 27c0-6 6-8 9-12s3-9 8-9 5 6 6 9 8 5 8 11-6 8-15 8S5 33 5 27z" fill="#7BD64A" stroke="#1E1A18" stroke-width="2.4"/><ellipse cx="17" cy="20" rx="3" ry="2" fill="#D8F7B8"/></svg>`;
const EXTRAS = {
  flink:     { name: "Flinktrank", bild: "🧪", w: [2, 2, 2] },
  dreifach:  { name: "Dreifachtrank", bild: "🧪", n: 3, w: [0, 1, 3] },
  haken:     { name: "Enterhaken", bild: "🪝", w: [0, 2, 3] },
  teleport:  { name: "Teleport-Schriftrolle", bild: "📜", w: [0, 1, 3] },
  feuerball: { name: "Feuerball", bild: "🔥", angriff: true, w: [1, 3, 1] },
  pfeile:    { name: "Pfeilbündel", bild: "🏹", n: 3, angriff: true, w: [1, 2, 1] },
  axt:       { name: "Bumerang-Axt", bild: "🪓", angriff: true, w: [1, 3, 1] },
  netz:      { name: "Wurfnetz", bild: "🕸️", angriff: true, w: [1, 2, 1] },
  schleim:   { name: "Schleimpfütze", bild: SVG_SCHLEIM, falle: true, w: [3, 1, 0] },
  kraehen:   { name: "Krähenfüße", bild: SVG_KRAEHE, falle: true, w: [3, 1, 0] },
  kaese:     { name: "Käse", bild: "🧀", falle: true, w: [2, 1, 0] },
  pilz:      { name: "Knallpilz", bild: "🍄", falle: true, w: [3, 2, 0] },
  schild:    { name: "Turmschild", bild: "🛡️", w: [3, 1, 0] },
  amulett:   { name: "Segensamulett", bild: "📿", w: [0, 1, 2] },
  fleder:    { name: "Fledermausschwarm", bild: "🦇", w: [0, 1, 2] },
  beben:     { name: "Beben", bild: "🪨", w: [0, 0, 2] },
  // Aufhol-Extras: nur hinten beim Ausgleich „Stark“
  fluegel:   { name: "Fledermausflug", bild: "🌙", aufhol: true, w: [0, 0, 0] },
  rachegeist:{ name: "Rachegeist", bild: "👻", aufhol: true, w: [0, 0, 0] }
};
// ---------- Ausgleich zu fünft ----------
// Gilt nach dem Platz unter den Menschen. „hinten“ ist die hintere Hälfte (bei 5 Menschen die letzten 2).
// Jedes Handy entscheidet für sein eigenes Kart; die Krone rechnet jedes Handy selbst aus den Positionen.
let ausgleich = "sanft";
function menschLage(k) {
  const m = karts.filter(o => !o.bot), n = m.length;
  if (k.bot || n < 2) return { n, platz: 1, vorn: null };
  const pk = platzVon(k);
  let platz = 1, vorn = null, vp = -1;
  for (const o of m) { if (o === k) continue; const po = platzVon(o); if (po < pk) { platz++; if (po > vp) { vp = po; vorn = o; } } }
  return { n, platz, vorn };
}
const ausgleichAn = () => ausgleich === "sanft" || ausgleich === "stark";
function hinten(k) { if (!ausgleichAn()) return false; const L = menschLage(k); return L.n >= 2 && L.platz > L.n - Math.floor(L.n / 2); }
// Rückenwind: der Letzte (bei „Stark“ auch der Vorletzte), solange er mehr als 2 Sekunden hinter seinem Vordermann liegt
function rueckenwind(k) {
  k.rw = 1; k.rwA = 1;
  if (!ausgleichAn() || k.bot || k.fertig != null || phase !== "rennen") return;
  const L = menschLage(k); if (L.n < 2 || L.platz < L.n - (ausgleich === "stark" ? 1 : 0)) return;
  const o = L.vorn, sek = !o || o.fertig != null ? 99 : (o.prog - k.prog) / S * LAENGE / TYPEN[k.typ].maxV;
  if (sek < 2) return;
  const letzter = L.platz === L.n;
  k.rw = ausgleich === "stark" ? (letzter ? 1.04 : 1.02) : 1.03;
  k.rwA = ausgleich === "stark" && letzter ? 1.1 : 1;
}
// Krone: der führende Mensch, solange er fährt
function kroneSetzen() {
  for (const k of karts) k.krone = false;
  if (!ausgleichAn() || phase !== "rennen") return;
  const m = karts.filter(o => !o.bot && o.fertig == null && o.g.visible); if (karts.filter(o => !o.bot).length < 2 || !m.length) return;
  m.reduce((a, b) => platzVon(b) < platzVon(a) ? b : a).krone = true;
}
// Endgegner wählen ihre Ziele zufällig, den Träger der Krone doppelt so oft
const zielMischen = l => l.map(o => [o, Math.random() ** (o.krone ? .5 : 1)]).sort((a, b) => b[1] - a[1]).map(e => e[0]);
const STARKE_EXTRAS = ["dreifach", "teleport", "amulett", "fleder", "beben", "fluegel", "rachegeist"];
const TEST_EXTRA = new URLSearchParams(location.search).get("extra");    // Test: ?extra=feuerball gibt immer dieses Extra
const klemmen = (v, a, b) => Math.max(a, Math.min(b, v));
let wackeln = 0;                                                        // Kamera wackelt (Beben, Treffer)

function extraZiehen(k) {
  if (TEST_EXTRA && EXTRAS[TEST_EXTRA]) return TEST_EXTRA;
  const n = karts.length, p = n > 1 ? (platzVon(k) - 1) / (n - 1) : .5;
  const stufe = p < .34 ? 0 : p < .67 ? 1 : 2;
  const auf = hinten(k), stark = auf && ausgleich === "stark";
  const alle = Object.entries(EXTRAS), w = e => auf && e.falle ? 0 : e.aufhol ? (stark ? 2 : 0) : e.w[stufe] * (fluch === "fallen" && e.falle ? 2.5 : 1);
  let summe = 0; for (const [, e] of alle) summe += w(e);
  let x = Math.random() * summe; for (const [a, e] of alle) { x -= w(e); if (x < 0) return a; }
  return "flink";
}
function truheNehmen(k, b) {
  b.weg = 3.5; b.g.visible = b.mg.visible = false;
  if (k.goldtruhe && !k.item && !(k.walze > 0) && !(k.kroete > 0)) {   // Finale: die erste Truhe der letzten Runde ist golden
    k.goldtruhe = false;
    const art = STARKE_EXTRAS[Math.floor(Math.random() * STARKE_EXTRAS.length)];
    k.item = { art, n: EXTRAS[art].n || 1 }; k.walze = 1.1;
    if (k.ich) { melden("Goldene Truhe! ✨", 1.2); extraAnzeigen(true); }
    return;
  }
  if (b.mimik && hinten(k)) {                      // der Mimik hat Mitleid mit denen hinten
    if (k.ich) { melden("Der Mimik hat Mitleid … hier 🥺", 1.4); klang("hach"); }
    if (k.item || k.walze > 0 || k.kroete > 0) return;
    const art = extraZiehen(k);
    k.item = { art, n: EXTRAS[art].n || 1 }; k.walze = k.bot ? .8 : 1.1;
    if (k.ich) extraAnzeigen(true);
    return;
  }
  if (b.mimik) {                                   // gebissen: Kart dreht sich, Extra weg
    k.item = null; k.walze = 0;
    treffen(k, "mimik");
    if (k.ich) { melden("Ein Mimik! 😬 Extra weg"); extraAnzeigen(); klang("lachen"); }
    return;
  }
  if (k.item || k.walze > 0 || k.kroete > 0) return;
  const art = extraZiehen(k), fieber = zfAktiv("fieber");          // Truhenfieber: doppelt
  k.item = { art, n: (EXTRAS[art].n || 1) * (fieber ? 2 : 1) }; k.walze = k.bot ? .8 : 1.1;
  if (k.ich) { extraAnzeigen(true); if (fieber) melden("Truhenfieber: doppelt! 🎁", 1); }
}

// Nächstes Kart in Fahrtrichtung (rf = 1) oder dahinter (rf = -1), höchstens weit Meter entfernt
function naechstesKart(k, rf, weit) {
  let best = null, bd = Infinity;
  for (const o of karts) {
    if (o === k || o.fertig != null || !o.g.visible || o.unsicht > 0) continue;
    const dp = (o.prog - k.prog) * rf * SCHRITT;
    if (dp > .5 && dp < weit && dp < bd) { bd = dp; best = o; }
  }
  return best;
}

// ----- Ereignisse -----
let objZaehler = 0;
const neueId = () => PID + "-" + (++objZaehler);
function ereignis(e) {
  e.q = PID; anwenden(e);
  if (modus === "client") senden({ t: "ev", pid: PID, nr: rennNr, e });
  else if (modus === "host") anAlle({ t: "ev", nr: rennNr, e });
}
function anwenden(e) {
  if (!e || typeof e !== "object" || (phase !== "rennen" && phase !== "ziel" && phase !== "pause")) return;
  if (e.a === "wurf" || e.a === "falle") objektNeu(e);
  else if (e.a === "weg") objektWeg(e.id, true);
  else if (e.a === "wirkung") { const k = karts.find(o => o.id === e.ziel); if (k && !k.remote) wirkung(k, e); }
  else if (e.a === "beben") { bebenStarten(e); if (e.von === "koenig" && koenig) { koenig.anim = 1.6; if (ich && ich.fertig == null) { melden("Der Knochenkönig zürnt! ⚠", 1.8); klang("bruellen"); } } }
  else if (e.a === "wand") { const f = gabeln[e.n | 0]; if (f && !f.offen) { f.offen = true; if (f.wandM) { f.wandM.visible = false; const q = punkt(f.i0, f.innen * 6); puff(q.x, 2, q.z, "#9A8F82"); } } }
  else if (e.a === "riss") { const f = gabeln[e.n | 0]; if (f && f.staerke && f.staerke[e.w | 0] > 0) f.staerke[e.w | 0]--; }
  else if (e.a === "faden" && Array.isArray(e.stellen)) {
    e.stellen.slice(0, 8).forEach(([idx, d], n) => objektNeu({ a: "falle", id: e.id + "k" + n, art: "koenigin", von: "koenigin", idx, d }));
    if (ich && ich.fertig == null) { melden("⚠ Die Spinnenkönigin seilt sich ab!", 1.6); klang("bruellen"); }
  }
  else if (e.a === "glut" && Array.isArray(e.spuren)) {
    e.spuren.slice(0, 4).forEach(([idx, d0, d1], n) => {
      d0 = +d0 || 0; d1 = +d1 || 0;
      objektNeu({ a: "falle", id: e.id + "d" + n, art: "drache", idx, d: d0, d1 });
      for (let k = 0; k <= 10; k++) objektNeu({ a: "falle", id: e.id + "f" + n + "_" + k, art: "feuer", idx: wrap((idx | 0) + meter(k * 3)), d: d0 + (d1 - d0) * k / 10, fall: DRACHE_FLUG * (50 - k * 3) / 70 });
    });
    if (ich && ich.fertig == null) { melden("⚠ Der Glutdrache greift an!", 1.6); klang("bruellen"); }
  }
  else if (e.a === "lava") { if (!lavaHoch) { lavaHoch = true; flutBaender.forEach(f => f.visible = true); wackeln = Math.max(wackeln, .8); if (ich && ich.fertig == null) melden("Die Lava steigt! 🌋", 2); } }
  else if (e.a === "bruecke") {
    const P = pfade[e.n | 0];
    if (P && P.art === "einsturz" && P.hp > 0) { P.hp--; if (P.hp <= 0) { P.weg = true; P.fallT = 0; if (ich && ich.fertig == null) melden("Die Brücke ist eingestürzt! 💥", 1.8); } }
  }
  else if (e.a === "zufall") zufallStart(e);
  else if (e.a === "sperre") sperreSetzen(e);
  else if (e.a === "hebel") hebelZiehen(e);
  else if (e.a === "leuchter") leuchterFall(e);
  else if (e.a === "platte") { const f = gabeln[e.n | 0]; if (f && (e.seite === 1 || e.seite === -1)) f.platte = { seite: e.seite, bis: +e.bis || 0 }; }
}
// Wirkung auf ein Kart, das dieses Handy fährt
function wirkung(k, e) {
  if (e.art === "treffer") treffen(k, "treffer");
  else if (e.art === "bremse") { k.bremse = 1.2; if (k.ich) melden("Eingehakt! 🪝"); }
  else if (e.art === "fleder") { if (k.amulett > 0) return; k.fleder = k.typ === "hexe" ? 1.4 : 3; if (k.ich) melden("Fledermäuse! 🦇", 1); }
  else if (e.art === "tausch") { versetzen(k, wrap(e.idx | 0), +e.d || 0, +e.prog || k.prog); if (k.ich) melden("Platz getauscht! 📜"); }
  else if (e.art === "lohn") lohnNehmen(k, Math.max(0, Math.min(3, e.gold | 0)));
  else if (e.art === "rachegeist") {                               // hält den Führenden fest wie ein Netz
    if (k.fertig != null || k.amulett > 0 || k.segen > 0 || k.unsicht > 0 || k.wind > 0 || k.wall > 0 || k.wirbel > 0 || k.fluegel > 0) return;
    if (k.schild) { k.schild = false; if (k.ich) melden("Schild hält den Geist ab! 🛡️"); return; }
    k.netz = 1.5; k.v *= .35; k.drift = 0; k.ladung = 0; k.boost = 0; k.haken = null; k.schonzeit = Math.max(k.schonzeit, 1.7);
    puff(k.x, k.y + 1.5, k.z, "#CFE8FF");
    if (k.ich) { melden(steuerung === "neigen" ? "Ein Rachegeist hält dich fest! Schütteln! 👻" : "Ein Rachegeist hält dich fest! 👻", 1.6); summen(120); }
  }
  else if (e.art === "klau") {                                     // der Dieb hat mich überholt
    if (!k.item || k.walze > 0) return;
    const it = k.item; k.item = null;
    if (k.ich) { melden("Der Dieb hat dein Extra geklaut! 🫳", 1.6); extraAnzeigen(); }
    const d = karts.find(o => o.id === e.von);
    if (d && !d.remote) beute(d, it); else if (d) ereignis({ a: "wirkung", ziel: d.id, art: "beute", ding: it.art, n: it.n });
  }
  else if (e.art === "beute") { if (EXTRAS[e.ding]) beute(k, { art: e.ding, n: Math.max(1, Math.min(3, e.n | 0)) }); }
  else if (e.art === "skelett") {
    if (k.fertig != null || k.amulett > 0 || k.segen > 0 || k.unsicht > 0 || k.wind > 0 || k.wall > 0 || k.wirbel > 0) return;
    k.skelette = Math.min(2, k.skelette + 1); k.skelettUhr = k.bot ? 2.5 : 5;
    if (k.ich) { melden(steuerung === "neigen" ? "Skelett an Bord! Schütteln! 💀" : "Skelett an Bord! 💀", 1.6); summen(90); }
  }
  else if (e.art === "schlaf" || e.art === "kroete") {             // Schlaflied der Bardin, Verwandeln der Hexe
    if (k.fertig != null || k.amulett > 0 || k.segen > 0 || k.unsicht > 0 || k.wind > 0 || k.wall > 0 || k.wirbel > 0) return;
    if (k.schild) { k.schild = false; if (k.ich) melden("Schild hält! 🛡️"); return; }
    if (e.art === "schlaf") { k.schlaf = 2; k.drift = 0; k.ladung = 0; if (k.ich) { melden("Ein Schlaflied … Zzz 💤", 1.6); summen(60); } }
    else {
      k.kroete = 3; k.drift = 0; k.ladung = 0; k.boost = 0; k.haken = null; puff(k.x, k.y + 1.2, k.z, "#8BD14A");
      if (k.ich) { melden("Quak! Du bist eine Kröte 🐸", 1.8); summen(140); }
    }
  }
}
function beute(k, it) {
  k.item = it; k.walze = 0;                                       // Beute geht vor (sonst wäre das Extra verloren)
  if (k.ich) { melden("Geklaut: " + EXTRAS[it.art].name + " 🫳", 1.2); extraAnzeigen(true); }
}
// Kraftleiste laden; wer hinten liegt, lädt schneller
function kraftLaden(k, x) {
  if (k.fertig != null || phase !== "rennen") return;
  const n = karts.length, p = n > 1 ? (platzVon(k) - 1) / (n - 1) : .5;
  const vorher = k.kraft;
  k.kraft = Math.min(1, k.kraft + x * (.7 + p * .9));
  if (k.ich && vorher < 1 && k.kraft >= 1) melden(KRAEFTE[k.typ] ? KRAEFTE[k.typ].name + " bereit! ⚡" : "Kraft bereit!", 1.2);
}
// Wer hat getroffen? Der bekommt Kraft (über das Handy, das ihn fährt)
function lohn(vonId, opfer) {
  if (!vonId || vonId === opfer.id) return;
  const k = karts.find(o => o.id === vonId); if (!k) return;
  const gold = opfer.krone ? 3 : 0;                 // wer die Krone trifft, bekommt 3 Gold
  if (!k.remote) lohnNehmen(k, gold); else ereignis({ a: "wirkung", ziel: k.id, art: "lohn", gold });
}
function lohnNehmen(k, gold) {
  kraftLaden(k, .2);
  if (gold > 0) { k.gold = Math.min(10, (k.gold || 0) + gold); if (k.ich) { melden(`Die Krone getroffen! +${gold} Gold 👑`, 1.4); puff(k.x, k.y + 1.5, k.z, "#F2B705"); } }
}

// Treffer auf ein selbst gefahrenes Kart. Rückgabe: "durch" (wirkt nicht, Geschoss fliegt weiter) oder "weg" (Geschoss verbraucht)
function treffen(k, art) {
  if (k.fertig != null || k.absturz) return "durch";
  if (k.fluegel > 0) return art === "mimik" ? "durch" : "weg";
  if ((k.unsicht > 0 || k.wind > 0) && art !== "mimik") return "durch";        // Langfinger, Windschritt: nicht zu treffen
  if ((k.wirbel > 0 || k.wall > 0) && art !== "mimik") return "weg";          // Wirbelschlag, Schildwall: prallt ab
  if (k.segen > 0 && art !== "mimik") { k.boost = Math.max(k.boost, .8); if (k.ich) melden("Gesegnet! Schub statt Treffer ✨", 1); return "weg"; }
  if (k.amulett > 0 && art !== "mimik") return "weg";
  if (k.schonzeit > 0 && art !== "mimik") return "durch";
  if (k.schild && art !== "mimik") { k.schild = false; k.schonzeit = .8; if (k.ich) { melden("Schild hält! 🛡️"); summen(40); } return "weg"; }
  if (art === "netz") {
    k.netz = 2.2; k.schonzeit = 2.4; k.v *= .75;
    if (k.ich) { melden(steuerung === "neigen" ? "Im Netz! Handy schütteln!" : "Im Netz!", 1.6); summen(120); }
    return "weg";
  }
  if (art === "eis") {
    k.eis = 1.5; k.schonzeit = 2.6; k.drift = 0; k.ladung = 0; k.boost = 0; k.haken = null;
    ereignis({ a: "falle", id: neueId(), art: "glatt", von: k.id, idx: k.idx, d: k.d });
    if (k.ich) { melden("Eingefroren! 🧊", 1.5); summen(150); wackeln = Math.max(wackeln, .25); }
    return "weg";
  }
  if (art === "sporen") {
    k.sporen = k.typ === "hexe" ? 1 : 2.2; k.v *= .75; k.schonzeit = 1;
    if (k.ich) { melden("Sporen! Wischen!", 1.4); summen(60); }
    return "weg";
  }
  const mild = hinten(k);
  k.dreher = k.dreherDauer = k.typ === "paladin" ? .5 : mild && ausgleich === "stark" ? .6 : .95; k.mhFest = k.mh; k.yaw = k.mh; k.v *= .5; k.drift = 0; k.ladung = 0; k.boost = 0; k.haken = null;
  k.schonzeit = k.dreher + 2; if (k.typ === "heilerin") k.erholung = k.dreher + 1.5;
  if (art !== "mimik" && k.gold > 0 && !mild) { k.gold = Math.max(0, k.gold - 2); if (k.ich) puff(k.x, k.y + 1.5, k.z, "#F2B705"); }
  if (k.ich) { summen(180); wackeln = Math.max(wackeln, .35); klang("treffer"); }
  return "weg";
}
function summen(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch {} }

// Kart an eine andere Stelle der Strecke setzen (Teleport, Platztausch)
function versetzen(k, idx, d, prog) {
  d = aufWeg(idx, d);
  k.x = PX[idx] + nX(idx) * d; k.z = PZ[idx] + nZ(idx) * d; k.idx = idx; k.d = d; k.prog = prog;
  k.yaw = k.mh = Math.atan2(TX[idx], TZ[idx]); k.y = hoehe(idx, d); k.luft = false; k.vy = 0; k.drift = 0; k.ladung = 0;
}
function teleport(k) {
  if (Math.random() < 1 / 6) {                 // Patzer: Platz mit einem zufälligen Fahrer in der Nähe tauschen
    const andere = karts.filter(o => o !== k && o.fertig == null && o.g.visible && Math.abs(o.prog - k.prog) < S / 2);
    if (andere.length) {
      const o = andere[Math.floor(Math.random() * andere.length)], alt = { idx: k.idx, d: k.d, prog: k.prog };
      const vor = o.prog > k.prog;
      versetzen(k, o.idx, o.d, o.prog);
      if (o.remote) ereignis({ a: "wirkung", ziel: o.id, art: "tausch", idx: alt.idx, d: alt.d, prog: alt.prog });
      else versetzen(o, alt.idx, alt.d, alt.prog);
      if (k.ich) melden(vor ? `Patzer! Platz mit ${o.name} getauscht 🙂` : `Patzer! Platz mit ${o.name} getauscht 😖`, 2);
      return;
    }
  }
  const sprung = Math.round(50 / SCHRITT);
  versetzen(k, wrap(k.idx + sprung), k.d, k.prog + sprung);
  k.boost = Math.max(k.boost, .4);
  if (k.ich) melden("Teleport! 📜");
}

// Extra einsetzen. wunsch: "vorn", "hinten" oder leer (Angriffe nach vorn, Fallen nach hinten)
function extraNutzen(k, wunsch) {
  if (phase !== "rennen" || !k.item || k.walze > 0 || k.fertig != null || k.dreher > 0 || k.eis > 0 || k.absturz) return false;
  if (k.kroete > 0) { if (k.ich) melden("Kröten haben keine Hände 🐸", .9); return false; }
  const art = k.item.art, E = EXTRAS[art];
  const hinten = wunsch ? wunsch === "hinten" : !!E.falle, rf = hinten ? -1 : 1;
  if (--k.item.n <= 0) k.item = null;
  if (k.ich) klang("extra", art);
  const sag = t => { if (k.ich) melden(t); };
  if (art === "flink" || art === "dreifach") { k.boost = Math.max(k.boost, 1.6); sag(E.name + "! 🧪"); }
  else if (art === "haken") {
    const z = naechstesKart(k, 1, 80);
    if (z) { k.haken = { ziel: z.id, t: 0 }; sag("Enterhaken! 🪝"); } else { k.boost = Math.max(k.boost, 1.4); sag("Enterhaken greift ins Leere, Schwung!"); }
  }
  else if (art === "teleport") teleport(k);
  else if (E.angriff) {
    const ziel = art === "pfeile" || art === "netz" ? naechstesKart(k, rf, 90) : null;
    ereignis({ a: "wurf", id: neueId(), art, von: k.id, p: k.idx + rf * 3 / SCHRITT, d: k.d, rf, ziel: ziel ? ziel.id : null, y: k.y });
    if (k.ich && hinten) melden("Nach hinten!", .8);
  }
  else if (E.falle) {
    const weit = hinten ? -2.6 : 28;
    const idx = wrap(Math.round(k.idx + weit / SCHRITT));
    const d = art === "kraehen" ? (k.d >= 0 ? 1 : -1) * BR / 4 : art === "kaese" ? 0 : klemmen(k.d, -BR / 2 + 1, BR / 2 - 1);
    ereignis({ a: "falle", id: neueId(), art, von: k.id, idx, d, flug: !hinten });
  }
  else if (art === "schild") { k.schild = true; sag("Turmschild! 🛡️"); }
  else if (art === "fluegel") { k.fluegel = 4; k.drift = 0; k.ladung = 0; k.dreher = 0; k.netz = k.bremse = k.sporen = k.schlaf = 0; k.skelette = 0; sag("Fledermausflug! 🦇🦇🦇"); }
  else if (art === "rachegeist") {
    const z = karts.filter(o => o !== k && o.fertig == null && o.g.visible).sort((a, b) => b.prog - a.prog)[0];
    if (z) ereignis({ a: "wirkung", ziel: z.id, art: "rachegeist" });
    sag(z ? `Rachegeist auf ${z.name}! 👻` : "Der Geist findet niemanden.");
  }
  else if (art === "amulett") { k.amulett = 5; sag("Segensamulett! 📿"); }
  else if (art === "fleder") {
    const ziele = karts.filter(o => o !== k && o.fertig == null && o.g.visible).sort((a, b) => b.prog - a.prog).slice(0, 3);
    for (const o of ziele) ereignis({ a: "wirkung", ziel: o.id, art: "fleder" });
    sag(ziele.length ? "Fledermäuse zu den Ersten! 🦇" : "Die Fledermäuse finden niemanden.");
  }
  else if (art === "beben") {
    const steine = [];
    for (const o of karts) {
      if (o === k || o.fertig != null || !o.g.visible) continue;
      for (let n = 0; n < 2; n++) { const j = wrap(Math.round(o.idx + (28 + n * 12 + Math.random() * 8) / SCHRITT)); steine.push([j, Math.round(wegZiel(o, j, (Math.random() - .5) * (BR - 2)) * 10) / 10]); }
    }
    ereignis({ a: "beben", id: neueId(), von: k.id, steine });
  }
  if (k.ich) extraAnzeigen();
  return true;
}

// ----- Geschosse und Fallen auf der Strecke -----
const objekte = new Map();
const GESCHOSS = {       // Tempo (m/s), Lebensdauer (s)
  feuerball: { v: 62, leben: 2.6 }, pfeile: { v: 85, leben: 1.6 }, netz: { v: 58, leben: 2 }, axt: { v: 50, leben: 3 }, eis: { v: 80, leben: 3 }
};
const FALLE = { schleim: 30, kraehen: 18, kaese: 5.5, pilz: 30, stein: 4.5, glatt: 4, koenigin: 4.6, drache: 3.4, feuer: 7.5 };
const DRACHE_FLUG = 2.6;          // so lange braucht der Drache für seine 70 m über die Strecke
function objMesh(art) {
  const g = new THREE.Group();
  if (art === "feuerball") {
    teil(g, kugel(.55, 12), null, 0, 0, 0, 0, 0, 0, GLUT("#FF6A1A")); teil(g, kugel(.34, 10), null, 0, 0, .12, 0, 0, 0, GLUT("#FFE36A"));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), scheinMat); s.rotation.x = -Math.PI / 2; s.position.y = -.8; g.add(s);
  } else if (art === "pfeile") {
    teil(g, zyl(.04, .04, 1.3, 5), "#8A6A44", 0, 0, 0, Math.PI / 2); teil(g, kegel(.1, .26, 6), "#BFC5CC", 0, 0, .75, Math.PI / 2);
    teil(g, box(.02, .18, .3), "#E23B2E", 0, 0, -.55);
  } else if (art === "axt") {
    const a = new THREE.Group(); g.add(a); g.userData.dreh = a;
    teil(a, zyl(.06, .06, 1.2, 6), "#7A5434", 0, 0, 0, 0, 0, Math.PI / 2);
    teil(a, box(.42, .5, .07), "#C9CED6", .5, .12, 0);
  } else if (art === "netz") {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.75, 1), new THREE.MeshBasicMaterial({ color: "#F2EDE0", wireframe: true })); g.add(m); g.userData.dreh = m;
  } else if (art === "eis") {
    teil(g, kegel(.22, 1.9, 6), null, 0, 0, .2, Math.PI / 2, 0, 0, GLUT("#CFF1FF")); teil(g, kugel(.3, 8), null, 0, 0, -.7, 0, 0, 0, GLUT("#7FD3FF"));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), scheinMat); s.rotation.x = -Math.PI / 2; s.position.y = -.8; g.add(s);
  } else if (art === "koenigin") {
    const sp = spinneMesh(1.15, true); g.add(sp); g.userData.sp = sp;
    const faden = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 40, 0)]), new THREE.LineBasicMaterial({ color: "#E8F5EE" })); g.add(faden); g.userData.faden = faden;
    const sch = new THREE.Mesh(new THREE.CircleGeometry(2.2, 18), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: .5, depthWrite: false }));
    sch.rotation.x = -Math.PI / 2; sch.position.y = .07; g.add(sch); g.userData.schatten = sch;
  } else if (art === "drache") {
    const d = dracheMesh(2.2); g.add(d); g.userData.d = d;
  } else if (art === "feuer") {
    const fl = [];
    for (const [x, z, h] of [[0, 0, 1.6], [.6, .3, 1.1], [-.5, .4, 1.2], [.2, -.6, 1]]) fl.push(teil(g, kegel(.45, h, 6), null, x, h / 2, z, 0, 0, 0, GLUT(h > 1.3 ? "#FF8A2A" : "#FFC14A")));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), scheinMat); s.rotation.x = -Math.PI / 2; s.position.y = .1; g.add(s);
    const ru = new THREE.Mesh(new THREE.CircleGeometry(1.5, 12), M("#1A1210")); ru.rotation.x = -Math.PI / 2; ru.position.y = .07; g.add(ru);
    g.userData.fl = fl; g.visible = false;
  } else if (art === "glatt") {
    const m = new THREE.Mesh(new THREE.CircleGeometry(3, 20), new THREE.MeshLambertMaterial({ color: "#CDEFFF", transparent: true, opacity: .7, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .06; g.add(m);
    g.userData.glatt = m;
  } else if (art === "schleim") {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1.7, 18), new THREE.MeshLambertMaterial({ color: "#6CC93E", transparent: true, opacity: .85 })); m.rotation.x = -Math.PI / 2; m.position.y = .05; g.add(m);
    for (const [x, z, r] of [[.5, .3, .35], [-.6, -.2, .28], [.1, -.7, .22]]) teil(g, kugel(r, 8), "#8BE05A", x, .02, z).scale.y = .45;
  } else if (art === "kraehen") {
    const geo = new THREE.TetrahedronGeometry(.28), mat = M("#5C626C");
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(geo, mat); m.position.set((i / 15 - .5) * (BR / 2 - .4), .14, (Math.random() - .5) * 1.4); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); g.add(m); }
  } else if (art === "kaese") {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, .5, 3, 1), M("#F2C230")); k.position.y = .25; g.add(k);
    const ratten = []; for (let i = 0; i < 6; i++) {
      const r = new THREE.Group(); teil(r, kapsel(.22, .5), "#7D6E62", 0, .25, 0, Math.PI / 2); teil(r, kugel(.16, 8), "#8C7D70", 0, .3, .45);
      teil(r, zyl(.03, .02, .8, 4), "#E2A3A0", 0, .2, -.7, Math.PI / 2 - .3); teil(r, kugel(.05, 6), "#E23B2E", .08, .38, .58); r.visible = false; g.add(r); ratten.push(r);
    }
    g.userData.ratten = ratten;
  } else if (art === "pilz") {
    teil(g, zyl(.22, .28, .55, 8), "#F3E6CC", 0, .28, 0); const h = teil(g, kugel(.6, 12), "#D9483B", 0, .55, 0); h.scale.y = .6;
    for (const [x, z] of [[.3, .2], [-.25, .3], [0, -.35], [-.3, -.1]]) teil(g, kugel(.09, 6), "#FFF6E6", x, .82, z);
    g.userData.puls = h;
  } else if (art === "stein") {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1), M("#6E655C")); s.castShadow = true; g.add(s); g.userData.stein = s;
    const sch = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: .45, depthWrite: false }));
    sch.rotation.x = -Math.PI / 2; g.add(sch); g.userData.schatten = sch;
  }
  sc.add(g); return g;
}
function objektNeu(e) {
  if (objekte.has(e.id)) return;
  if (e.a === "wurf") {
    if (!GESCHOSS[e.art]) return;
    const o = { id: e.id, art: e.art, von: e.von, wurf: true, p: +e.p || 0, d: +e.d || 0, rf: e.rf === -1 ? -1 : 1, ziel: e.ziel, alter: 0, y: (+e.y || 0) + .9, getroffen: new Set(), kraft: !!e.kraft };
    o.idx = wrap(Math.round(o.p)); o.rel = wegQuer(o.idx, o.d); o.ws = WEG[o.idx] ? wegSeite(o.idx, o.d) : Math.sign(o.d) || 1;
    o.x = PX[o.idx] + nX(o.idx) * o.d; o.z = PZ[o.idx] + nZ(o.idx) * o.d;
    o.g = objMesh(e.art); o.g.position.set(o.x, o.y, o.z); objekte.set(o.id, o);
  } else {
    if (!FALLE[e.art]) return;
    const idx = wrap(e.idx | 0), d = klemmen(+e.d || 0, -MAUER, MAUER);
    const o = { id: e.id, art: e.art, von: e.von, idx, d, x: PX[idx] + nX(idx) * d, z: PZ[idx] + nZ(idx) * d, alter: 0, flug: e.flug ? .55 : 0, fall: +e.fall || 0, d1: +e.d1 || 0 };
    o.y = hoehe(idx, d); o.g = objMesh(e.art); o.g.position.set(o.x, o.y, o.z); o.g.rotation.y = Math.atan2(TX[idx], TZ[idx]); objekte.set(o.id, o);
  }
}
function objektWeg(id, knall) {
  const o = objekte.get(id); if (!o) return;
  sc.remove(o.g); objekte.delete(id);
  if (knall && (o.art === "feuerball" || o.art === "pilz" || o.art === "eis")) puff(o.x, o.y, o.z, o.art === "pilz" ? "#9BE36A" : o.art === "eis" ? "#CFF1FF" : "#FF8A2A");
}
// kurzer Knall (nur Optik)
const puffs = [];
// Noten der Bardin: kleine bunte Wölkchen über dem Lautenwagen
function noten(k) { for (const [dx, dy, c] of [[-.8, 2.4, "#FFD447"], [.7, 2.9, "#2F7F8A"], [0, 3.4, "#E86FB0"]]) puff(k.x + dx, k.y + dy, k.z, c); }
function puff(x, y, z, farbe) {
  const m = new THREE.Mesh(kugel(1, 10), new THREE.MeshBasicMaterial({ color: farbe, transparent: true, opacity: .7, depthWrite: false }));
  m.position.set(x, y, z); sc.add(m); puffs.push({ m, t: 0 });
}
function bebenStarten(e) {
  if (!Array.isArray(e.steine)) return;
  e.steine.slice(0, 60).forEach(([idx, d], n) => objektNeu({ a: "falle", id: e.id + "s" + n, art: "stein", von: e.von, idx, d, fall: 1.5 }));
  wackeln = Math.max(wackeln, 1.4);
  const k = karts.find(o => o.id === e.von);
  if (ich && ich.fertig == null) melden(k && k.ich ? "Beben! 🪨" : "⚠ Beben! Ausweichen!", 1.6);
}
// Ratten des Käses: wuseln quer über die Fahrbahn
function rattenPos(o, i) {
  const t = o.alter, laengs = (i - 2.5) * 2.2, quer = Math.sin(t * 1.7 + i * 1.3) * (BR / 2 + .5);
  const j = wrap(Math.round(o.idx + laengs / SCHRITT));
  return { x: PX[j] + nX(j) * quer, z: PZ[j] + nZ(j) * quer, j, quer, dir: Math.cos(t * 1.7 + i * 1.3) };
}

function objekteSchritt(dt) {
  for (const [id, o] of [...objekte]) {
    o.alter += dt;
    if (o.wurf) {
      const G = GESCHOSS[o.art];
      if (o.alter > G.leben) { objektWeg(id, o.art === "feuerball"); continue; }
      let zielK = o.ziel ? karts.find(k => k.id === o.ziel && k.g.visible && k.fertig == null) : null;
      let heim = false;
      if (o.art === "axt" && o.alter > .9) { zielK = karts.find(k => k.id === o.von); heim = true; }
      const alt = { x: o.x, z: o.z };
      if (zielK) {                                     // zielsuchend
        const dx = zielK.x - o.x, dz = zielK.z - o.z, dd = Math.hypot(dx, dz) || 1, s = Math.min(dd, G.v * dt);
        o.x += dx / dd * s; o.z += dz / dd * s; o.y += (zielK.y + .9 - o.y) * Math.min(1, dt * 6);
        if (heim && dd < 2) { objektWeg(id); continue; }
      } else {                                         // folgt der Strecke
        const vorher = o.idx;
        o.p += o.rf * G.v * dt / SCHRITT; o.idx = wrap(Math.round(o.p));
        if (o.art === "feuerball") for (const f of gabeln) if (f.art === "wand" && !f.offen && Math.sign(o.d) === f.innen && Math.abs(o.d) > .7 && vorab(vorher, f.i0) > S / 2 && vorab(o.idx, f.i0) < meter(6)) {
          const k = karts.find(x => x.id === o.von);
          if (k && !k.remote) ereignis({ a: "wand", n: f.nr });
          o.alter = 99;
        }
        if (o.art === "feuerball" && leuchter.length) { const k = karts.find(x => x.id === o.von); if (k && !k.remote && leuchterFeuer(o)) o.alter = 99; }
        if (o.rel != null) o.d = (WEG[o.idx] ? wegMitte(o.idx, o.ws) : 0) + o.rel;      // in der Gabelung auf dem eigenen Weg bleiben
        o.x = PX[o.idx] + nX(o.idx) * o.d; o.z = PZ[o.idx] + nZ(o.idx) * o.d; o.y += (hoehe(o.idx, o.d) + .9 - o.y) * Math.min(1, dt * 8);
      }
      o.g.position.set(o.x, o.y, o.z);
      const r = Math.atan2(o.x - alt.x, o.z - alt.z); if (Math.hypot(o.x - alt.x, o.z - alt.z) > .01) o.g.rotation.y = r;
      if (o.g.userData.dreh) o.g.userData.dreh.rotation.x += dt * 16;
      // Treffer prüfen (nur eigene Karts)
      for (const k of karts) {
        if (k.remote || k.fertig != null || o.getroffen.has(k.id)) continue;
        if (k.id === o.von) continue;
        if (Math.hypot(k.x - o.x, k.z - o.z) > (o.art === "netz" ? 1.9 : 1.6) || Math.abs(k.y + .9 - o.y) > 2) continue;
        const ergebnis = treffen(k, o.art === "netz" ? "netz" : o.art === "eis" ? "eis" : "treffer");
        if (ergebnis === "durch") continue;
        o.getroffen.add(k.id);
        if (!o.kraft && !(k.wirbel > 0 || k.wall > 0 || k.segen > 0 || k.amulett > 0 || k.schild)) lohn(o.von, k);
        if (o.art !== "axt") { objektWeg(id, true); ereignis({ a: "weg", id }); break; }
      }
      continue;
    }
    // Fallen
    if (o.alter > FALLE[o.art]) { objektWeg(id); continue; }
    const boden = hoehe(o.idx, o.d);
    if (o.flug > 0) { const f = Math.max(0, o.flug - o.alter) / .55; o.g.position.y = boden + Math.sin(f * Math.PI) * 3; }
    if (o.art === "stein") {
      const f = o.fall - o.alter;
      o.g.userData.stein.position.y = f > 0 ? 1 + f * 12 : 1;
      o.g.userData.schatten.scale.setScalar(f > 0 ? klemmen(1 - f / o.fall, .2, 1) : 1);
      o.g.userData.schatten.position.y = .06;
      if (f > 0) continue;
      if (!o.gelandet) { o.gelandet = true; wackeln = Math.max(wackeln, .25); }
      if (o.alter > FALLE.stein - .6) o.g.userData.stein.position.y = 1 - (o.alter - (FALLE.stein - .6)) * 3;
    }
    if (o.art === "drache") {
      // kommt von vorn entgegen und fliegt 70 m die Strecke zurück, über der Feuerspur speit er
      const u = Math.min(1, o.alter / DRACHE_FLUG), m = 50 - u * 70, j = wrap(o.idx + meter(m)), dd = o.d + (o.d1 - o.d) * klemmen(m / 30, 0, 1), q = punkt(j, dd), D = o.g.userData.d;
      o.g.position.set(q.x, 7 - Math.sin(u * Math.PI) * 2.5 + Math.max(0, o.alter - DRACHE_FLUG) * 9, q.z); o.g.rotation.y = q.rot + Math.PI;
      D.userData.fluegel.forEach((f, n) => f.rotation.z = (n ? -1 : 1) * Math.sin(o.alter * 9) * .7);
      D.userData.feuer.visible = m > -2 && m < 32; if (D.userData.feuer.visible) D.userData.feuer.scale.set(1, .8 + Math.random() * .5, 1);
      continue;
    }
    if (o.art === "feuer") {
      o.g.visible = o.alter > o.fall; if (!o.g.visible) continue;
      const aus = Math.min(1, (FALLE.feuer - o.alter) / .8);
      o.g.userData.fl.forEach((f, n) => f.scale.set(aus, aus * (.75 + Math.sin(o.alter * 17 + n * 2) * .25), aus));
      for (const k of karts) if (!k.remote && k.fertig == null && !k.luft && aus > .5 && Math.hypot(k.x - o.x, k.z - o.z) < 1.7 && Math.abs(k.y - o.y) < 3) {
        if (treffen(k, "treffer") === "weg" && k.dreher > 0 && k.ich) melden("Verbrannt! 🔥", 1.1);
      }
      continue;
    }
    if (o.art === "pilz") { const s = 1 + Math.sin(o.alter * 6) * .08; o.g.userData.puls.scale.set(s, .6 * s, s); }
    if (o.art === "koenigin") {
      const a = o.alter, h = a < 1.3 ? 1.6 + 26 * (1 - Math.sin(a / 1.3 * Math.PI / 2)) : a < 3.4 ? 1.6 + Math.sin(a * 5) * .25 : 1.6 + (a - 3.4) / 1.2 * 28;
      const U = o.g.userData; U.sp.position.y = h; U.sp.rotation.y = Math.sin(a * 2) * .5;
      const fp = U.faden.geometry.attributes.position; fp.setY(0, h + 2); fp.needsUpdate = true;
      U.schatten.scale.setScalar(klemmen(1.3 - (h - 1.6) / 22, .25, 1.2));
      U.sp.userData.beine.forEach((b, m) => b.rotation.x = Math.sin(a * 12 + m) * .3);
    }
    if (o.art === "glatt") o.g.userData.glatt.material.opacity = .7 * Math.min(1, (FALLE.glatt - o.alter) / .8);
    if (o.art === "kaese") {
      const zeigt = o.alter > .6;
      o.g.userData.ratten.forEach((r, i) => {
        r.visible = zeigt; if (!zeigt) return;
        const p = rattenPos(o, i); r.position.set(p.x - o.x, hoehe(p.j, p.quer) - boden + Math.abs(Math.sin(o.alter * 18 + i)) * .1, p.z - o.z);
        r.rotation.y = Math.atan2(nX(p.j), nZ(p.j)) * Math.sign(p.dir) - o.g.rotation.y + (p.dir < 0 ? Math.PI : 0);
      });
    }
    if (o.flug > o.alter) continue;
    for (const k of karts) {
      if (k.remote || k.fertig != null || k.luft || Math.abs(k.y - o.y) > 3) continue;
      if (o.art === "schleim") {
        if (k.typ === "magierin" || Math.hypot(k.x - o.x, k.z - o.z) > 1.9) continue;
        if (treffen(k, "treffer") === "weg") { if (k.dreher > 0) lohn(o.von, k); objektWeg(id); ereignis({ a: "weg", id }); break; }
      } else if (o.art === "koenigin") {
        if (o.alter > 1 && o.alter < 3.6 && Math.hypot(k.x - o.x, k.z - o.z) < 2.4) treffen(k, "netz");
      } else if (o.art === "glatt") {
        if (k.typ !== "magierin" && Math.hypot(k.x - o.x, k.z - o.z) < 3.2) k.glatt = .4;
      } else if (o.art === "kraehen") {
        if (k.typ === "magierin") continue;
        let di = k.idx - o.idx; if (di > S / 2) di -= S; if (di < -S / 2) di += S;
        if (Math.abs(di * SCHRITT) < 1 && Math.abs(k.d - o.d) < BR / 4 && k.amulett <= 0) { if (!(k.holper > 0) && k.ich) { melden("Krähenfüße! 🦶", .8); summen(60); } k.holper = Math.max(k.holper || 0, 1); }
      } else if (o.art === "kaese") {
        if (o.alter < .6) continue;
        for (let i = 0; i < 6; i++) { const p = rattenPos(o, i); if (Math.hypot(k.x - p.x, k.z - p.z) < 1.4) { if (treffen(k, "treffer") === "weg" && k.dreher > 0) lohn(o.von, k); break; } }
      } else if (o.art === "pilz") {
        if (Math.hypot(k.x - o.x, k.z - o.z) > 3) continue;
        if (treffen(k, "sporen") === "weg" || k.amulett > 0) { if (k.sporen > 0) lohn(o.von, k); objektWeg(id, true); ereignis({ a: "weg", id }); break; }
      } else if (o.art === "stein") {
        if (Math.hypot(k.x - o.x, k.z - o.z) < 1.7 && o.alter < FALLE.stein - .4) treffen(k, "treffer");
      }
    }
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i]; p.t += dt; p.m.scale.setScalar(1 + p.t * 9); p.m.material.opacity = Math.max(0, .7 - p.t * 1.6);
    if (p.t > .45) { sc.remove(p.m); puffs.splice(i, 1); }
  }
}
function objekteLeeren() { for (const id of [...objekte.keys()]) objektWeg(id); puffs.forEach(p => sc.remove(p.m)); puffs.length = 0; }

// Enterhaken: zieht das Kart zum Ziel, am Ende Schub und das Ziel wird kurz gebremst
const seilGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
function hakenLenken(k, dt) {
  const h = k.haken; h.t += dt;
  const z = karts.find(o => o.id === h.ziel);
  const ende = () => { k.haken = null; k.boost = Math.max(k.boost, 1); if (z) ereignis({ a: "wirkung", ziel: z.id, art: "bremse" }); };
  if (!z || h.t > 1.8 || z.prog < k.prog - 2) { ende(); return null; }
  if (Math.hypot(z.x - k.x, z.z - k.z) < 3.4) { ende(); return null; }
  let diff = Math.atan2(z.x - k.x, z.z - k.z) - k.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return { lenk: klemmen(-diff * 2.6, -1, 1), drift: false, direkt: true };
}

// Tempo-Einflüsse der Extras in einem Fahrschritt
function extraTimer(k, dt) {
  for (const t of ["schonzeit", "netz", "bremse", "fleder", "sporen", "amulett", "erholung", "holper", "walze", "wirbel", "wall", "unsicht", "wind", "segen", "eis", "glatt", "wurzel", "schlaf", "kroete", "fluegel"]) if (k[t] > 0) k[t] = Math.max(0, k[t] - dt);
}

// ----- Heldenkräfte -----
function kraftNutzen(k) {
  if (phase !== "rennen" || k.kraft < 1 || k.fertig != null || k.lore || k.flug || k.pfad || k.absturz || k.eis > 0 || k.kroete > 0 || (k.dreher > 0 && k.typ !== "heilerin")) return false;
  const sag = (t, d) => { if (k.ich) melden(t, d); };
  const vor = n => karts.filter(o => o !== k && o.fertig == null && o.g.visible && !(o.unsicht > 0) && o.prog > k.prog && (o.prog - k.prog) * SCHRITT < 250).sort((a, b) => a.prog - b.prog).slice(0, n);
  const wurf = (art, ziel, d) => ereignis({ a: "wurf", id: neueId(), art, von: k.id, p: k.idx + 3 / SCHRITT, d: d ?? k.d, rf: 1, ziel: ziel ? ziel.id : null, y: k.y, kraft: true });
  switch (k.typ) {
    case "kaempfer": k.wirbel = 1; k.wirbelGetroffen = new Set(); sag("Wirbelschlag! 🌀"); break;
    case "paladin": k.wall = 4; sag("Schildwall! 🛡️"); break;
    case "dieb": k.unsicht = 3; k.klauVor = new Set(karts.filter(o => o !== k && o.prog > k.prog && o.fertig == null).map(o => o.id)); sag("Langfinger! Unsichtbar 🫥"); break;
    case "waldlaeufer": {
      const z = vor(3);
      for (let n = 0; n < 3; n++) wurf("pfeile", z[n], z[n] ? k.d : k.d + (n - 1) * 3);
      sag("Pfeilhagel! 🏹"); break;
    }
    case "magierin": { const z = vor(1)[0]; wurf("eis", z); sag(z ? "Eislanze auf " + z.name + "! 🧊" : "Eislanze! 🧊"); break; }
    case "heilerin":
      k.netz = k.bremse = k.fleder = k.sporen = k.holper = k.glatt = k.skelette = k.dreher = k.schlaf = k.kroete = 0; k.haken = null;
      k.segen = 5; sag("Segen! ✨"); break;
    case "moench": k.wind = 2; k.drift = 0; sag("Windschritt! 💨"); break;
    case "nekromant": {
      const z = karts.filter(o => o !== k && o.fertig == null && o.g.visible && o.prog < k.prog && (k.prog - o.prog) * SCHRITT < 120).sort((a, b) => b.prog - a.prog).slice(0, 2);
      if (!z.length) { sag("Niemand hinter dir für die Skelette", 1.2); return false; }
      for (const o of z) ereignis({ a: "wirkung", ziel: o.id, art: "skelett" });
      sag(z.length > 1 ? "Skelette auf " + z[0].name + " und " + z[1].name + "! 💀" : "Skelett auf " + z[0].name + "! 💀", 1.4); break;
    }
    case "bardin": {
      const z = vor(3).filter(o => (o.prog - k.prog) * SCHRITT < 90);
      if (!z.length) { sag("Niemand vor dir hört dein Schlaflied", 1.2); return false; }
      for (const o of z) ereignis({ a: "wirkung", ziel: o.id, art: "schlaf" });
      noten(k); sag("Schlaflied! 🎵 " + z.map(o => o.name).join(", ") + " gähnen", 1.4); break;
    }
    case "hexe": {
      const z = vor(1)[0];
      if (!z) { sag("Niemand vor dir zum Verwandeln", 1.2); return false; }
      ereignis({ a: "wirkung", ziel: z.id, art: "kroete" });
      sag("Verwandeln! " + z.name + " wird zur Kröte 🐸", 1.4); break;
    }
    default: return false;
  }
  k.kraft = 0;
  return true;
}
// Was eine laufende Kraft in jedem Schritt tut (nur selbst gefahrene Karts)
function kraftSchritt(k, dt) {
  if (k.wirbel > 0 && k.wirbelGetroffen) {
    for (const o of karts) {
      if (o === k || o.fertig != null || !o.g.visible || k.wirbelGetroffen.has(o.id) || Math.hypot(o.x - k.x, o.z - k.z) > 4.6 || Math.abs(o.y - k.y) > 2) continue;
      k.wirbelGetroffen.add(o.id);
      if (o.remote) ereignis({ a: "wirkung", ziel: o.id, art: "treffer" }); else treffen(o, "treffer");
    }
    for (const [id, o] of objekte) if (o.wurf && o.von !== k.id && Math.hypot(o.x - k.x, o.z - k.z) < 4.2) { objektWeg(id, true); ereignis({ a: "weg", id }); }
  }
  if (k.unsicht > 0 && k.klauVor) {
    for (const o of karts) if (k.klauVor.has(o.id) && o.prog < k.prog) {
      k.klauVor.delete(o.id);
      if (k.item || k.walze > 0 || k.klauWartet > uhr) continue;          // nur mit freien Händen (Beute ist evtl. noch unterwegs)
      k.klauWartet = uhr + 1;
      if (o.remote) ereignis({ a: "wirkung", ziel: o.id, art: "klau", von: k.id }); else wirkung(o, { art: "klau", von: k.id });
    }
  }
  if (k.skelette > 0) {
    k.skelettUhr -= dt;
    if (k.skelettUhr <= 0) skelettAb(k);
  }
}
function skelettAb(k) {
  k.skelette = Math.max(0, k.skelette - 1); k.skelettUhr = k.bot ? 2.5 : 3.5;
  puff(k.x, k.y + 1.4, k.z, "#EDE4D0");
  if (k.ich) melden(k.skelette ? "Eins weg, noch eins! 💀" : "Skelett abgeworfen! 💀", .9);
}
function kraftZuenden() { if (ich && !AUTO && !ich.aufgegeben) kraftNutzen(ich); }

// ----- Anzeige: Extra-Feld mit Walze, Überlagerungen für Fledermäuse und Sporen -----
const WALZE = Object.values(EXTRAS).map(e => e.bild);
let walzeTakt = 0, walzeBild = 0;
function extraAnzeigen(neu) {
  const e = $("extra"), it = ich && ich.item;
  e.classList.toggle("leer", !it);
  if (neu) { e.classList.remove("neu"); void e.offsetWidth; e.classList.add("neu"); }
  if (!it) { e.innerHTML = ""; return; }
  if (ich.walze > 0) return;
  e.innerHTML = `<span class="ico">${EXTRAS[it.art].bild}</span>${it.n > 1 ? `<b class="anz">×${it.n}</b>` : ""}`;
}
function extraHud(dt) {
  if (!ich) return;
  if (ich.walze > 0 && ich.item) {
    walzeTakt -= dt;
    if (walzeTakt <= 0) { walzeTakt = .07; walzeBild = (walzeBild + 1) % WALZE.length; $("extra").innerHTML = `<span class="ico walzt">${WALZE[walzeBild]}</span>`; }
    ich.walzeLief = true;
  } else if (ich.walzeLief) { ich.walzeLief = false; extraAnzeigen(true); }
  $("fleder").hidden = !(ich.fleder > 0);
  const sp = $("sporen"); sp.hidden = !(ich.sporen > 0); if (ich.sporen > 0) sp.style.opacity = Math.min(1, ich.sporen / 1.2);
  $("schuettel").hidden = !((ich.netz > 0 || ich.skelette > 0) && steuerung === "neigen");
}

// Schütteln (Netz) und Wischen (Sporen)
let letzterRuck = 0, letzterAbwurf = 0;
addEventListener("devicemotion", e => {
  const a = e.acceleration; if (!a || a.x == null) return;
  const m = Math.hypot(a.x, a.y, a.z), jetzt = performance.now();
  if (m > 13 && jetzt - letzterRuck > 140) { letzterRuck = jetzt; if (ich && ich.netz > 0) { ich.netz = Math.max(0, ich.netz - .35); summen(20); } }
  if (m > 15 && ich && ich.skelette > 0 && jetzt - letzterAbwurf > 450) { letzterAbwurf = jetzt; skelettAb(ich); summen(30); }
});
let wischStart = null;
addEventListener("pointerdown", e => { wischStart = { x: e.clientX, y: e.clientY }; });
addEventListener("pointermove", e => {
  if (!wischStart || !ich || !(ich.sporen > 0)) return;
  const w = Math.hypot(e.clientX - wischStart.x, e.clientY - wischStart.y);
  if (w > 60) { ich.sporen = Math.max(0, ich.sporen - .45); wischStart = { x: e.clientX, y: e.clientY }; }
});
addEventListener("pointerup", () => { wischStart = null; });

// Monster setzen ihre Extras mit kleiner Verzögerung ein, der Goblin besonders schnell
function botExtra(k, dt) {
  if (!k.item || k.walze > 0) return;
  if (k.extraUhr == null) k.extraUhr = k.typ === "goblin" ? .3 + Math.random() * .8 : 1 + Math.random() * 3;
  k.extraUhr -= dt; if (k.extraUhr > 0) return;
  k.extraUhr = null;
  const E = EXTRAS[k.item.art];
  let wunsch;
  if (E.angriff) wunsch = !naechstesKart(k, 1, 70) && naechstesKart(k, -1, 30) ? "hinten" : "vorn";
  extraNutzen(k, wunsch);
}

// ---------- Strecke im Rennen: Gitter, Wand, Lore, Troll, Pendel, Ratten, Knochenkönig ----------
// Welche Seite der Gabelung zu ist: wechselt im Takt (für alle gleich), eine Druckplatte schließt die Seite hinter dem, der drüberfährt.
function torZu(f) {
  if (f.platte && uhr < f.platte.bis) return f.platte.seite;
  return hashf(plan.s + f.nr * 7, Math.floor(uhr / 11)) < .5 ? 1 : -1;
}
const trollWach = () => !!troll && phase === "rennen" && uhr > 35 && hashf(plan.s + 3, Math.floor(uhr / 6)) < .4;

// Zusammenstöße mit Trennwänden, Gittern, der brüchigen Wand, Fässern und Rüstungen (nur selbst gefahrene Karts)
function streckeStoss(k, alt, dt) {
  for (const f of gabeln) {
    const v = vorab(k.idx, f.i0), va = vorab(alt.idx, f.i0);
    if (v > 0 && v <= f.n && Math.abs(k.d) < .9) {             // Trennwand in der Mitte
      const sg = Math.sign(alt.d) || 1, zu = sg * .9 - k.d;
      k.x += nX(k.idx) * zu; k.z += nZ(k.idx) * zu; k.d = sg * .9; k.v *= Math.max(0, 1 - 2 * dt);
    }
    if (!(va > S / 2 && v < meter(5))) continue;                // nur beim Durchfahren des Eingangs
    const seite = Math.sign(k.d) || 1;
    let zu = false;
    if (f.art === "gabel") zu = seite === torZu(f) && f.torY[seite] < 1.6;
    else if (f.art === "wand" && !f.offen && seite === f.innen) {
      if (k.st.masse >= 1.5 && k.v > 12) { ereignis({ a: "wand", n: f.nr }); k.v *= .75; if (k.ich) melden("Wand durchbrochen! 💥"); }
      else { zu = true; if (k.ich && !f.gemeldet) { f.gemeldet = true; melden("Zu leicht! Nur schwere Karts oder ein Feuerball", 2); } }
    }
    if (zu) {
      k.x = alt.x; k.z = alt.z; k.idx = alt.idx; k.prog = alt.prog; k.d = alt.d; k.v = -Math.max(3.5, Math.min(7, Math.abs(k.v) * .35)); k.drift = 0;
      if (k.bot || AUTO || k.fertig != null) { const q = punkt(k.idx, -seite * BR / 4); k.x = q.x; k.z = q.z; k.d = -seite * BR / 4; k.spur = k.d; }   // Monster nicht festhängen lassen
      if (k.ich) { wackeln = Math.max(wackeln, .3); summen(60); }
    }
  }
  for (const p of pfosten) {
    const dx = k.x - p.x, dz = k.z - p.z, dd = Math.hypot(dx, dz), r = p.r + .9;
    if (dd < r && dd > .001) { k.x = p.x + dx / dd * r; k.z = p.z + dz / dd * r; k.v *= Math.max(0, 1 - 6 * dt); }
  }
  if (wege.length) sperreStoss(k, alt);
  if (leuchter.length) leuchterStoss(k, dt);
}

// Was auf der Strecke passiert, für selbst gefahrene Karts: Platten, Gold, Gleise, Troll, Pendel, Ratten
function streckeWirkung(k, dt, e) {
  if (k.fertig != null || k.luft) return;
  for (const f of gabeln) {
    const v = vorab(k.idx, f.i0);
    if (f.art === "gabel" && Math.abs(v - meter(7)) < meter(1.5) && Math.abs(Math.abs(k.d) - BR / 4) < 1.5) {
      const seite = Math.sign(k.d);
      if (torZu(f) !== seite && !(f.platte && f.platte.seite === seite && uhr < f.platte.bis)) {
        ereignis({ a: "platte", n: f.nr, seite, bis: uhr + 4 });
        if (k.ich) melden("Klack! Gitter hinter dir zu 😈", 1.2);
      }
    }
    const vg = f.gold ? vorab(k.idx, f.gold.i) : 0;
    if (f.gold && Math.min(vg, S - vg) * SCHRITT < 2 && Math.abs(k.d - f.gold.d) < 2.2 && !(k.goldUhr > uhr)) {
      k.goldUhr = uhr + 3; k.boost = Math.max(k.boost, .9); if (k.ich) melden("Goldrausch! 💰", 1);
    }
  }
  for (const f of loren) {
    const m = vorab(k.idx, f.i0) * SCHRITT;
    if (m < 6 && Math.abs(k.d - f.railD) < 2.2) { k.lore = { f, m, zweig: null }; k.drift = 0; if (k.ich) melden(steuerung === "neigen" ? "Lore! An der Weiche neigen" : "Lore! An der Weiche lenken", 1.6); }
  }
  if (troll) {
    const v = vorab(k.idx, troll.i), nah = Math.min(v, S - v) * SCHRITT, sd = k.d * troll.s;
    if (!trollWach() && nah < 3.2 && sd > RAND - 1.2 && sd < RAND + 4 && k.v > 8) trollSprung(k);
    if (trollWach() && nah < 3 && Math.abs(k.d - troll.keuleD) < 1.6) treffen(k, "treffer");
  }
  for (const p of pendel) {
    const v = vorab(k.idx, p.i), nah = Math.min(v, S - v) * SCHRITT;
    if (nah < 1.3 && Math.abs(k.d - p.d) < 1.4 && p.y < 2.6) treffen(k, "treffer");
  }
  if (pilzSprung) {
    const P = pilzSprung, v = vorab(k.idx, P.i), nah = Math.min(v, S - v) * SCHRITT;
    if (nah < 3.5 && k.d * P.s > RAND - .4) pilzHuepfer(k);
  }
  for (const f of gabeln) {
    if (f.art !== "tunnel" || !gabelDrin(k.idx, f)) continue;
    const v = vorab(k.idx, f.i0);
    if (Math.sign(k.d) === f.innen) f.netze.forEach((pos, w) => {
      if (f.staerke[w] <= 0 || Math.abs(v - pos) > meter(1.2)) return;
      const key = f.nr * 10 + w; k.riss = k.riss || {};
      if (k.riss[key] > uhr) return;
      k.riss[key] = uhr + 2;
      const st = f.staerke[w]; k.v *= [1, .86, .64, .38][st];
      ereignis({ a: "riss", n: f.nr, w });
      if (k.ich) { melden(st === 3 ? "Klebriges Netz! 🕸️" : st === 2 ? "Netz reißt …" : "Netz zerrissen!", .9); summen(st * 30); }
    });
    else if (k.typ !== "magierin") { if (!(k.wurzel > 0) && k.ich) melden("Wurzeln! Holprig", .7); k.wurzel = .25; }
  }
  for (const t of tropfen) if (t.liegt && Math.hypot(k.x - t.x, k.z - t.z) < 1.6) treffen(k, "treffer");
  for (const r of rattenStellen) if (r.aktiv) for (const q of r.pos) if (Math.hypot(k.x - q.x, k.z - q.z) < 1.3) { treffen(k, "treffer"); break; }
  // Glutschlund
  if (geysirSprung && !(k.geysirUhr > uhr)) {
    const G = geysirSprung, v = vorab(k.idx, G.i), nah = Math.min(v, S - v) * SCHRITT;
    if (nah < 3.5 && k.d * G.s > RAND - .4) { geysirStart(k); return; }
  }
  for (const g of geysire) if (g.aktiv && Math.hypot(k.x - g.x, k.z - g.z) < 1.9) { if (treffen(k, "treffer") === "weg" && k.dreher > 0 && k.ich) melden("Geysir! 🔥", 1); }
  if (pfade.length && SCHLUCHT[k.idx] && pfadEinstieg(k)) return;
  for (const sp of spalten) if (vorab(k.idx, sp.i0) <= sp.n) { absturz(k, sp.zurueck); return; }
}

// Lore: man wird schnell und kann nicht lenken; an der Weiche entscheidet Neigen (zur Fahrbahn hin = abzweigen)
function loreSchritt(k, dt, e) {
  const L = k.lore, f = L.f;
  if (L.zweig == null && L.m >= f.weiche - 2) {
    if (k.bot || AUTO) L.zweig = Math.random() < .75 ? (f.tot === "ab" ? "gerade" : "ab") : f.tot;
    else L.zweig = e.lenk * f.s < -.25 ? "ab" : "gerade";
  }
  k.v += (k.st.maxV * 1.38 - k.v) * Math.min(1, dt * 2.5);
  L.m += k.v * dt;
  if (L.zweig === f.tot && L.m >= f.weiche + 9) {               // Prellbock
    k.lore = null; k.v = 0; k.dreher = k.dreherDauer = .9; k.mhFest = k.mh; k.schonzeit = 2.2; k.drift = 0;
    if (k.ich) { melden("Prellbock! 💥 Falsche Weiche", 1.6); wackeln = Math.max(wackeln, .6); summen(200); }
    return;
  }
  const ende = L.zweig === "ab" ? f.weiche + 14 : f.laenge;
  const idx = wrap(f.i0 + meter(L.m)), d = lorePfad(f, L.m, L.zweig || "gerade");
  let delta = idx - k.idx; if (delta > S / 2) delta -= S; if (delta < -S / 2) delta += S;
  k.prog += delta; k.idx = idx; k.d = d; k.x = PX[idx] + nX(idx) * d; k.z = PZ[idx] + nZ(idx) * d; k.y = .25;
  const d2 = lorePfad(f, L.m + 2, L.zweig || "gerade"), i2 = wrap(f.i0 + meter(L.m + 2));
  k.yaw = k.mh = Math.atan2(PX[i2] + nX(i2) * d2 - k.x, PZ[i2] + nZ(i2) * d2 - k.z); k.s = 0;
  if (L.m >= ende) { k.lore = null; k.y = 0; k.boost = Math.max(k.boost, .3); }
}

// Troll-Trampolin: Bauch federt über die Mauer auf den Gang dahinter
function trollSprung(k) {
  const t = troll, b = t.b;
  k.flug = { t: 0, dauer: 1.3, x0: k.x, z0: k.z, y0: k.y, yaw0: k.yaw, prog: k.prog + vorab(b, k.idx), b, d: t.ld };
  k.drift = 0; if (k.ich) { melden("Boing! 🧌", 1); summen(40); }
}
// Pilzsprung: mittig getroffen = von Pilz zu Pilz über die Schlucht, am Rand = zu kurz und hinein
const pilzZone = k => { if (!pilzSprung) return false; const v = vorab(pilzSprung.i, k.idx); return (v < meter(24) || v > S - meter(3.5)) && k.d * pilzSprung.s > 0; };   // Felsvorsprung vor dem Pilz
function pilzHuepfer(k) {
  const P = pilzSprung, sd = k.d * P.s, mitte = sd > RAND + .3 && sd < RAND + 3.4 && k.v > 11;   // am inneren Rand des Pilzes = zu kurz
  if (mitte) k.flug = { t: 0, dauer: 1.9, x0: k.x, z0: k.z, y0: k.y, yaw0: k.yaw, prog: k.prog + vorab(P.b, k.idx), b: P.b, d: 0, hops: 3, hoch: 5 };
  else { const q = P.pilze[1]; k.flug = { t: 0, dauer: .8, x0: k.x, z0: k.z, y0: k.y, yaw0: k.yaw, kurz: { x: (k.x + q.x) / 2, z: (k.z + q.z) / 2 }, hops: 1, hoch: 3 }; }
  k.drift = 0; P.pilze[0].wipp = .4;
  if (k.ich) { melden(mitte ? "Boing, boing, boing! 🍄" : "Zu weit am Rand! 😱", 1.2); summen(40); }
}
// Geysirsprung: Bricht der Geysir gerade aus, trägt er das Kart über den Lavasee, sonst verbrennt man sich
const geysirZone = k => { if (!geysirSprung) return false; const v = vorab(geysirSprung.i, k.idx); return (v < meter(24) || v > S - meter(3.5)) && k.d * geysirSprung.s > 0; };
const vorsprung = k => pilzZone(k) || geysirZone(k);
const geysirTakt = () => phase === "rennen" ? (uhr + geysirSprung.phase) % 4.6 : 0;     // 2,2 bis 3,1 brodelt es, ab 3,1 Ausbruch
function geysirStart(k) {
  const G = geysirSprung, tt = geysirTakt();
  if (tt > 3.1 && k.v > 8) {
    k.flug = { t: 0, dauer: 1.6, x0: k.x, z0: k.z, y0: k.y, yaw0: k.yaw, prog: k.prog + vorab(G.b, k.idx), b: G.b, d: 0, hops: 1, hoch: 11 };
    k.drift = 0; if (k.ich) { melden("Fauch! Der Geysir trägt dich 🌋", 1.2); summen(60); }
    return;
  }
  k.geysirUhr = uhr + 1.5;
  treffen(k, "treffer");
  const d = G.s * (BR / 2 - 1), q = punkt(k.idx, d); k.x = q.x; k.z = q.z; k.d = d;
  if (k.ich) { melden(tt > 1.6 ? "Zu früh! Heißer Dampf 🔥" : "Zu spät! Hinterteil verbrannt 🔥", 1.4); summen(120); }
}
// Pfade über die Lava: sinkende Steine (sinken im Takt) und die Brücke (stürzt nach einigen Überfahrten ein)
const steinTakt = P => phase === "rennen" ? (uhr + P.phase) % 7 : 0;         // ab 4,4 wackeln sie, 5,4 bis 6,6 sind sie unten
const steinTragen = P => { const tt = steinTakt(P); return tt < 5.55 || tt > 6.85; };
function steinHoehe(P) {
  const tt = steinTakt(P);
  if (tt < 5.4) return tt > 4.4 ? Math.sin(uhr * 40) * .05 : 0;
  return tt < 5.8 ? -(tt - 5.4) / .4 * 1.9 : tt < 6.6 ? -1.9 : -1.9 * (1 - (tt - 6.6) / .4);
}
function pfadEinstieg(k) {
  for (const P of pfade) {
    const v = vorab(k.idx, P.i);
    if (!(v < meter(14) || v > S - meter(3)) || k.d * P.s < BR / 2 + .5) continue;
    if (P.weg || (P.art === "steine" && !steinTragen(P))) return false;          // nichts da, das trägt: hinein in die Lava
    const off = v > S / 2 ? v - S : v, rx = k.x - P.ax, rz = k.z - P.az;
    k.pfad = { P, m: Math.max(0, rx * P.ux + rz * P.uz), q: klemmen(-rx * P.uz + rz * P.ux, -1.8, 1.8), prog0: k.prog - off, yaw0: k.yaw };
    k.drift = 0; k.ladung = 0;
    if (k.ich) melden(P.art === "steine" ? "Über die Steine! Schnell! 🪨" : P.hp <= 2 ? "Die Brücke knirscht … 😬" : "Über die Brücke!", 1.1);
    return true;
  }
  return false;
}
function pfadSchritt(k, dt, e) {
  const L = k.pfad, P = L.P, auto = k.bot || (k.ich && AUTO) || k.fertig != null || k.aufgegeben;
  const lenk = k.eis > 0 ? 0 : auto ? klemmen(-L.q * .9, -1, 1) : e.lenk;
  if (k.boost > 0) k.boost -= dt;
  if (k.dreher > 0) k.dreher -= dt;
  const maxV = e.gas === false ? 0 : k.st.maxV * (k.boost > 0 ? 1.35 : 1) * (1 + k.gold * .006) * (k.dreher > 0 ? .35 : 1);
  k.v += Math.max(-30 * dt, Math.min(k.st.accel * dt, maxV - k.v));
  L.m += Math.max(0, k.v) * dt; L.q += lenk * 5.5 * dt * Math.min(1, k.v / 12);
  if (P.art === "einsturz") L.q = klemmen(L.q, -1.9, 1.9);
  k.s = lenk;
  k.x = P.ax + P.ux * L.m - P.uz * L.q; k.z = P.az + P.uz * L.m + P.ux * L.q;
  k.y = P.art === "steine" ? .35 + steinHoehe(P) : .55; k.luft = false; k.vy = 0;
  // Blick: zum Ende hin in Richtung der Strecke drehen
  const ende = Math.atan2(TX[P.b], TZ[P.b]), u = klemmen((L.m - (P.len - 9)) / 9, 0, 1), basis = Math.atan2(P.ux, P.uz);
  let dy = ende - basis; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  let dw = L.yaw0 - basis; dw = Math.atan2(Math.sin(dw), Math.cos(dw));              // am Anfang weich vom alten Kurs auf den Pfad
  k.yaw = k.mh = basis + dy * u * u * (3 - 2 * u) + dw * Math.max(0, 1 - L.m / 6) - lenk * .2;
  const weit = Math.round(vorab(P.b, P.i) * Math.min(1, L.m / P.len));
  k.idx = wrap(P.i + weit); k.prog = L.prog0 + weit; k.d = 0;
  if (P.weg || (P.art === "steine" && (!steinTragen(P) || Math.abs(L.q) > 2.1))) {      // daneben oder versunken: in die Lava
    k.pfad = null; k.idx = P.i; k.prog = L.prog0; absturz(k); return;
  }
  if (L.m >= P.len) {
    k.pfad = null;
    const d = P.sb * 2, q = punkt(P.b, d);
    k.x = q.x; k.z = q.z; k.idx = P.b; k.d = d; k.prog = L.prog0 + vorab(P.b, P.i); k.y = 0; k.yaw = k.mh = q.rot;
    if (P.art === "einsturz" && k.fertig == null) ereignis({ a: "bruecke", n: P.nr });
  }
}
function flugSchritt(k, dt) {
  const F = k.flug; F.t += dt;
  const u = Math.min(1, F.t / F.dauer), tx = F.kurz ? F.kurz.x : PX[F.b] + nX(F.b) * F.d, tz = F.kurz ? F.kurz.z : PZ[F.b] + nZ(F.b) * F.d;
  const hops = F.hops || 1, hu = u >= 1 ? 1 : (u * hops) % 1;
  k.x = F.x0 + (tx - F.x0) * u; k.z = F.z0 + (tz - F.z0) * u; k.y = F.y0 * (1 - u) + 4 * (F.hoch || 9) * hu * (1 - hu);
  if (!F.kurz) { let dy = Math.atan2(TX[F.b], TZ[F.b]) - F.yaw0; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); k.yaw = k.mh = F.yaw0 + dy * u; }
  k.luft = true; k.vy = hu < .5 ? 5 : -5;
  if (u >= 1 && F.kurz) { k.flug = null; absturz(k); return; }
  if (u >= 1) { k.flug = null; k.idx = F.b; k.prog = F.prog; k.d = F.d; k.y = hoehe(F.b, F.d); k.luft = false; k.vy = 0; k.landung = .25; k.boost = Math.max(k.boost, .4); }
}

// Absturz in die Schlucht: fallen, dann tragen Fledermäuse das Kart zurück auf die Fahrbahn (etwa 2 Sekunden)
function absturz(k, zurueck) {
  if (k.absturz || k.fluegel > 0) return;
  const zi = zurueck ?? wrap(k.idx - meter(3));
  let zur = vorab(k.idx, zi); if (zur > S / 2) zur -= S;                      // Ziel kann auch vorn liegen (nach einem Loch)
  k.absturz = { t: 0, vx: Math.sin(k.mh) * k.v * .4, vz: Math.cos(k.mh) * k.v * .4, zi, prog: k.prog - zur, y0: k.y, tempo: hinten(k) ? 2 / 1.2 : 1 };
  k.drift = 0; k.ladung = 0; k.boost = 0; k.haken = null; k.v = 0; k.dreher = 0; k.luft = true;
  if (k.ich) { melden(welt === "glut" ? "In die Lava! 🔥 Fledermäuse holen dich" : LOCH[k.idx] && welt === "kerker" ? "Platsch! In den Burggraben 🦇" : "Abgestürzt! Fledermäuse holen dich 🦇", 1.8); summen(150); wackeln = Math.max(wackeln, .4); }
}
function absturzSchritt(k, dt) {
  const A = k.absturz; A.t += dt * (A.tempo || 1);
  const q = punkt(A.zi, 0);
  if (A.t < .7) { k.x += A.vx * dt; k.z += A.vz * dt; k.y = A.y0 - A.t * A.t * 22; }
  else {
    if (A.x1 == null) { A.x1 = k.x; A.z1 = k.z; A.y1 = k.y; A.yaw1 = k.yaw; }
    const u = Math.min(1, (A.t - .7) / 1.3), e = u * u * (3 - 2 * u);
    k.x = A.x1 + (q.x - A.x1) * e; k.z = A.z1 + (q.z - A.z1) * e; k.y = A.y1 * (1 - e) + Math.sin(u * Math.PI) * 4;
    let dy = q.rot - A.yaw1; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); k.yaw = k.mh = A.yaw1 + dy * e;
  }
  if (A.t >= 2) {
    k.absturz = null; k.x = q.x; k.z = q.z; k.idx = A.zi; k.prog = A.prog; k.d = 0; k.y = hoehe(A.zi, 0); k.vy = 0; k.luft = false;
    k.yaw = k.mh = q.rot; k.v = 7; k.s = 0; k.schonzeit = 1.5;
  }
}

// Bewegte Dinge (auf allen Handys gleich, nach der Rennuhr): Gitter, Pendel, Ratten, Troll, König
function streckeZeigen(dt) {
  for (const f of gabeln) {
    if (f.art === "gabel") for (const s of [-1, 1]) {
      const ziel = torZu(f) === s ? 0 : 6;
      f.torY[s] += Math.sign(ziel - f.torY[s]) * Math.min(Math.abs(ziel - f.torY[s]), dt * 14);
      f.tore[s].position.y = f.torY[s];
    }
  }
  if (pilzSprung && pilzSprung.pilze) for (const pz of pilzSprung.pilze) { if (pz.wipp > 0) pz.wipp = Math.max(0, pz.wipp - dt); pz.g.userData.kappe.scale.y = .55 - Math.sin((pz.wipp || 0) / .4 * Math.PI) * .25; }
  // Tropfende Decke: Tropfsteine fallen im Takt an wechselnden Stellen (für alle Handys gleich)
  for (const t of tropfen) {
    const T = 5.5, z = Math.floor((uhr + t.phase) / T), tt = phase === "rennen" ? (uhr + t.phase) % T : 4;
    const d = (hashf(plan.s + t.nr * 3, z) - .5) * (BR - 3), q = punkt(t.i, d);
    t.x = q.x; t.z = q.z; t.liegt = tt > 1.85 && tt < 2.9;
    const y = tt < 1.6 ? 15 + Math.sin(uhr * 40) * (tt > .9 ? .15 : 0) : tt < 2 ? 15 - (tt - 1.6) / .4 * 14.2 : tt < 3 ? .8 : 15;
    t.g.position.set(q.x, y + (tt >= 2 && tt < 3 ? 2.4 : 0), q.z); t.g.rotation.z = tt >= 2 && tt < 3 ? 1.3 : 0; t.g.visible = tt < 3 || tt > 3.6;
    t.sch.position.set(q.x, .07, q.z); t.sch.visible = tt < 2; t.sch.scale.setScalar(Math.min(1, tt / 1.6));
  }
  for (const f of gabeln) if (f.art === "tunnel" && f.netzM) f.netzM.forEach((m, w) => { const st = f.staerke[w]; m.visible = st > 0; m.material.opacity = [0, .35, .65, .95][st]; m.scale.set(1, [0, .5, .8, 1][st], 1); });
  for (const p of pendel) {
    const w = Math.sin(uhr * 2.1 + p.phase) * .95;
    p.arm.rotation.z = w; p.d = -Math.sin(w) * 7.6; p.y = 9.6 - Math.cos(w) * 7.6;
  }
  for (const r of rattenStellen) {
    const t = (uhr + r.phase) % 7; r.aktiv = phase === "rennen" && t > 3.5; r.pos = [];
    r.ratten.forEach((g, n) => {
      g.visible = r.aktiv; if (!r.aktiv) return;
      const quer = ((t - 3.5) / 3.5 * 2 - 1) * (RAND + .4) * (n % 2 ? 1 : -1), laengs = (n - 2) * 2;
      const j = wrap(r.i + meter(laengs) + 0), q = punkt(j, quer + Math.sin(uhr * 9 + n) * .4);
      g.position.set(q.x, Math.abs(Math.sin(uhr * 16 + n)) * .1, q.z); g.rotation.y = q.rot + (n % 2 ? -Math.PI / 2 : Math.PI / 2);
      if (g.userData.beine) g.userData.beine.forEach((b, m) => b.rotation.x = Math.sin(uhr * 22 + m * 1.6) * .35);
      r.pos.push(q);
    });
  }
  if (troll) {
    const wach = trollWach();
    troll.koerper.rotation.x += ((wach ? -.9 : 0) - troll.koerper.rotation.x) * Math.min(1, dt * 4);
    troll.zz.visible = !wach; troll.zz.children.forEach((z, n) => { z.position.y = 3 + n * .8 + Math.sin(uhr * 2 + n) * .2; z.lookAt(cam.position); });
    const w = wach ? Math.sin(uhr * 2.6) : -1.2;
    troll.keule.rotation.y = troll.s > 0 ? -Math.PI / 2 - w * 1.1 : Math.PI / 2 + w * 1.1;
    troll.keule.position.y = wach ? 1.6 : .5;
    troll.keuleD = troll.s * (RAND + 2.6) - troll.s * (BR * .5) * (1 + Math.sin(uhr * 2.6)) * .9;
  }
  if (koenig && koenig.art === "spinne") {
    koenig.g.visible = ![...objekte.values()].some(o => o.art === "koenigin");
    koenig.g.position.y = 7.5 + Math.sin(uhr * 1.3) * .3; koenig.g.userData.beine.forEach((b, m) => b.rotation.x = Math.sin(uhr * 3 + m) * .12);
  }
  if (koenig && koenig.art === "knochen") {
    if (koenig.anim > 0) koenig.anim = Math.max(0, koenig.anim - dt);
    const a = koenig.anim > 0 ? Math.sin(Math.min(1, (1.6 - koenig.anim) * 3) * Math.PI / 2) : 0;
    koenig.arm.rotation.z = a * 1.4; koenig.augMat.color.set(a > .2 ? "#C6FFD8" : "#7BE3A0");
  }
  if (welt === "glut") glutZeigen(dt);
}
// Glutschlund: Lava pulsiert, Geysire brechen aus, Steine sinken, die Brücke stürzt ein, der Drache auf dem Horst
let glutZeit = 0;
function glutZeigen(dt) {
  glutZeit += dt;
  const hell = .9 + Math.sin(glutZeit * 1.7) * .08 + (lavaHoch ? .22 : 0); lavaMat.color.setRGB(hell, hell, hell);
  for (const g of geysire) {
    const tt = phase === "rennen" ? (uhr + g.phase) % 3.6 : 0;
    g.aktiv = phase === "rennen" && tt >= 2.4;
    geysirZeigen(g.m, tt < 1.6 ? 0 : tt < 2.4 ? -1 : 1 + Math.sin((tt - 2.4) / 1.2 * Math.PI) * 6, glutZeit);
  }
  if (geysirSprung && geysirSprung.m) { const tt = geysirTakt(); geysirZeigen(geysirSprung.m, tt < 2.2 ? 0 : tt < 3.1 ? -1 : 2 + Math.sin((tt - 3.1) / 1.5 * Math.PI) * 10, glutZeit); }
  for (const P of pfade) {
    if (!P.g) continue;
    if (P.art === "steine") { const tt = steinTakt(P); P.g.position.y = steinHoehe(P); P.mat.color.set(tt > 4.4 && tt < 6.85 ? "#C2502A" : "#6E5E62"); continue; }
    if (!P.weg) continue;
    P.fallT += dt; P.g.position.y = -P.fallT * P.fallT * 5; P.g.visible = P.fallT < 1.6;
    if (P.fallT < dt * 1.5) for (let m = 0; m <= P.len; m += 6) puff(P.ax + P.ux * m, 1, P.az + P.uz * m, "#FF8A2A");
  }
  if (koenig && koenig.art === "drache") {
    koenig.g.visible = ![...objekte.values()].some(o => o.art === "drache");
    koenig.g.userData.fluegel.forEach((f, n) => f.rotation.z = (n ? -1 : 1) * (.25 + Math.sin(glutZeit * 1.2) * .12));
    koenig.g.userData.kopf.rotation.y = Math.sin(glutZeit * .7) * .5;
  }
}
// Knochenkönig: ab Runde 2 lässt er alle 14 bis 20 Sekunden die Erde beben (entscheidet allein der Spielleiter)
let koenigTakt = 0;
function koenigLenken(dt) {
  if (!koenig || modus === "client" || phase !== "rennen") return;
  if (koenig.art === "drache" && !lavaHoch && karts.some(k => k.runden.length >= 2 && k.fertig == null)) ereignis({ a: "lava" });
  if (!karts.some(k => k.runden.length >= 1 && k.fertig == null)) { koenigTakt = 6; return; }
  koenigTakt -= dt; if (koenigTakt > 0) return;
  if (koenig.art === "spinne") {
    // Spinnenkönigin: seilt sich vor zwei Fahrern ab, in Runde 3 öfter
    const wild = karts.some(k => k.runden.length >= 2 && k.fertig == null);
    koenigTakt = wild ? 7 + Math.random() * 3 : 11 + Math.random() * 5;
    const ziele = zielMischen(karts.filter(o => o.fertig == null && o.g.visible)).slice(0, wild ? 3 : 2);
    const stellen = ziele.map(o => { const j = wrap(Math.round(o.idx + (34 + Math.random() * 10) / SCHRITT)); return [j, Math.round(wegZiel(o, j, (Math.random() - .5) * (BR - 4)) * 10) / 10]; });
    if (stellen.length) ereignis({ a: "faden", id: neueId(), stellen });
    return;
  }
  if (koenig.art === "drache") {
    // Glutdrache: überfliegt die Strecke vor einem Fahrer (in Runde 3 vor zweien) und brennt eine Feuerspur über die halbe Fahrbahn
    const wild = karts.some(k => k.runden.length >= 2 && k.fertig == null);
    koenigTakt = wild ? 8 + Math.random() * 3 : 12 + Math.random() * 4;
    const ziele = zielMischen(karts.filter(o => o.fertig == null && o.g.visible)).slice(0, wild ? 2 : 1);
    const spuren = ziele.map(o => { const sd = Math.random() < .5 ? 1 : -1, d0 = sd * (BR / 2 - 1), j = wrap(Math.round(o.idx + (42 + Math.random() * 12) / SCHRITT)), m = wegZiel(o, j, 0); return [j, Math.round((m + d0) * 10) / 10, Math.round((m + d0 - sd * (BR / 2 + Math.random() * 2)) * 10) / 10]; });
    if (spuren.length) ereignis({ a: "glut", id: neueId(), spuren });
    return;
  }
  koenigTakt = 14 + Math.random() * 6;
  const steine = [];
  for (const o of karts) {
    if (o.fertig != null || !o.g.visible) continue;
    for (let n = 0; n < 2; n++) { const j = wrap(Math.round(o.idx + (30 + n * 13 + Math.random() * 8) / SCHRITT)); steine.push([j, Math.round(wegZiel(o, j, (Math.random() - .5) * (BR - 2)) * 10) / 10]); }
  }
  ereignis({ a: "beben", id: neueId(), von: "koenig", steine });
}
// Monster nutzen die Strecke: offene Seite der Gabelung, Lore, Troll, schwere brechen durch die Wand
function streckenSpur(k) {
  for (const f of gabeln) {
    if (gabelDrin(k.idx, f)) return Math.sign(k.d || 1) * BR / 4;
    const vor = vorab(f.i0, k.idx) * SCHRITT;
    if (vor < 55) {
      if (f.art === "gabel") return -torZu(f) * BR / 4;
      if (f.art === "tunnel") return (k.tunnelWahl || f.staerke.reduce((a, b) => a + b, 0) <= 5 ? f.innen : -f.innen) * BR / 4;
      return !f.offen && k.st.masse < 1.5 ? -f.innen * BR / 4 : f.innen * BR / 4;
    }
  }
  if (k.loreWahl) for (const f of loren) { const vor = vorab(f.i0, k.idx) * SCHRITT; if (vor > 0 && vor < 45) return f.railD; }
  if (k.trollWahl && pilzSprung) { const vor = vorab(pilzSprung.i, k.idx) * SCHRITT; if (vor > 0 && vor < 40) return pilzSprung.s * (vor < 23 ? RAND + 1.2 : BR / 2 - 1.2); }
  if (k.trollWahl && geysirSprung) {                       // nur, wenn der Geysir bei der Ankunft ausbricht
    const G = geysirSprung, vor = vorab(G.i, k.idx) * SCHRITT;
    if (vor > 0 && vor < 40) { const tt = (uhr + vor / Math.max(10, k.v) + G.phase) % 4.6; if (tt > 3.25 && tt < 4.4) return G.s * (vor < 23 ? RAND + 1.2 : BR / 2 - 1.2); }
  }
  if (k.trollWahl) for (const P of pfade) {                // Steine nur, wenn sie lange genug oben bleiben; Brücke, solange sie steht
    const vor = vorab(P.i, k.idx) * SCHRITT;
    if (vor <= 0 || vor > 35 || P.weg) continue;
    if (P.art === "steine") { const tt = (uhr + vor / Math.max(10, k.v) + P.phase) % 7; if (tt + (P.len + 4) / Math.max(12, k.v) > 5.3) continue; }
    return P.s * (vor < 20 ? BR / 2 + 2.6 : BR / 2 + 1.2);       // kurz vorher weit nach außen, dann geradeaus auf den Pfad
  }
  if (k.trollWahl && troll && !trollWach()) { const vor = vorab(troll.i, k.idx) * SCHRITT; if (vor > 0 && vor < 40) return troll.s * (RAND + 1.6); }
  return null;
}

// Vorschau vor dem Start: Die Kamera fliegt einmal über die Strecke, dazu die Abschnitte
const VORSCHAU = 5;
let vorschauZeit = 0;
function vorschauKamera() {
  const u = 1 - vorschauZeit / VORSCHAU, i = wrap(Math.round(u * S * .97)), j = wrap(i + meter(70));
  cam.position.set(PX[i] - TX[i] * 10, 34, PZ[i] - TZ[i] * 10); cam.lookAt(PX[j], 0, PZ[j]);
  if (cam.fov !== 62) { cam.fov = 62; cam.updateProjectionMatrix(); }
  sonne.position.set(PX[i] - 30, 60, PZ[i] + 25); sonne.target.position.set(PX[i], 0, PZ[i]);
  const n = abschnitte.findIndex(a => vorab(i, a.von) < vorab(a.bis, a.von));
  const v = $("vorschau"); v.hidden = false;
  v.innerHTML = `<b>${esc(abschnitte[n] ? abschnitte[n].name : "")}</b><small>${fz ? `FELDZUG ${fz.nr + 1}/3 · ` : ""}${fluch ? `FLUCH: ${FLUECHE[fluch].bild} ${FLUECHE[fluch].name.toUpperCase()} · ` : ""}${planCode(plan)}${modus === "allein" ? " · Tippen überspringt" : ""}</small>`;
}

// ---------- Minikarte ----------
let mx = x => x, mz = z => z;
function minikarte() {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < S; i++) { minX = Math.min(minX, PX[i]); maxX = Math.max(maxX, PX[i]); minZ = Math.min(minZ, PZ[i]); maxZ = Math.max(maxZ, PZ[i]); }
  const mf = Math.min(88 / (maxX - minX), 68 / (maxZ - minZ));
  mx = x => 52 + (x - (minX + maxX) / 2) * mf; mz = z => 42 + (z - (minZ + maxZ) / 2) * mf;
  let dd = "", neu = true; for (let i = 0; i <= S; i += 30) { if (WEG[wrap(i)] && WEG_R[wrap(i)] - WEG_L[wrap(i)] > 4) { neu = true; continue; } dd += (neu ? "M" : "L") + mx(PX[wrap(i)]).toFixed(1) + " " + mz(PZ[wrap(i)]).toFixed(1); neu = false; }
  let wd = ""; for (const W of wege) for (const sg of [-1, 1]) for (let k = 0; k <= W.n; k += 12) { const i = wrap(W.i0 + Math.min(k, W.n)), dq = wegMitte(i, sg); wd += (k ? "L" : "M") + mx(PX[i] + nX(i) * dq).toFixed(1) + " " + mz(PZ[i] + nZ(i) * dq).toFixed(1); }
  $("mini").innerHTML = `<path d="${dd}" fill="none" stroke="#5A4A3A" stroke-width="5" stroke-linejoin="round"/>${wd ? `<path d="${wd}" fill="none" stroke="#5A4A3A" stroke-width="3.5" stroke-linejoin="round"/>` : ""}<path d="M${mx(PX[0] + nX(0) * 6)} ${mz(PZ[0] + nZ(0) * 6)}L${mx(PX[0] - nX(0) * 6)} ${mz(PZ[0] - nZ(0) * 6)}" stroke="#2A2118" stroke-width="2"/>${pfade.map(P => `<path d="M${mx(P.ax).toFixed(1)} ${mz(P.az).toFixed(1)}L${mx(P.ax + P.ux * P.len).toFixed(1)} ${mz(P.az + P.uz * P.len).toFixed(1)}" stroke="#EA580C" stroke-width="2" stroke-dasharray="2 2"/>`).join("")}<g id="punkte"></g>`;
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
  if (e.key === "e" || e.key === "E" || e.key === "ArrowUp") extraZuenden(e.key === "ArrowUp" ? "vorn" : undefined);
  if (e.key === "q" || e.key === "Q" || e.key === "ArrowDown") { extraZuenden("hinten"); e.preventDefault(); }
  if (e.key === "r" || e.key === "R" || e.key === "Enter") kraftZuenden();
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
halten($("kkraft"), () => kraftZuenden());
// Extra-Knopf: antippen = Standard (Angriffe nach vorn, Fallen nach hinten), nach unten wischen = nach hinten, nach oben = nach vorn
{
  const el = $("kextra"); let start = null;
  el.addEventListener("pointerdown", ev => { ev.preventDefault(); el.classList.add("an"); start = ev.clientY; try { el.setPointerCapture(ev.pointerId); } catch {} });
  const los = ev => { ev.preventDefault(); el.classList.remove("an"); if (start == null) return; const dy = ev.clientY - start; start = null; extraZuenden(dy > 28 ? "hinten" : dy < -28 ? "vorn" : undefined); };
  el.addEventListener("pointerup", los);
  el.addEventListener("pointercancel", () => { el.classList.remove("an"); start = null; });
}
halten($("klinks"), () => tasten.l = true, () => tasten.l = false);
halten($("krechts"), () => tasten.r = true, () => tasten.r = false);
document.addEventListener("gesturestart", e => e.preventDefault());
document.addEventListener("contextmenu", e => e.preventDefault());

// ---------- Brücken über die eigene Strecke ----------
// Eine Schleife kreuzt die Strecke: Beim ersten Mal fährt man unten durch, beim zweiten Mal auf einer Brücke darüber.
// Der obere Teil (UEBER) fehlt im Höhengitter, damit beim Anheben alles unten bleibt. Er bekommt seine Höhe und seine Bauten erst nach den Hügeln.
const UEBER = new Uint8Array(S), BRUECKE_H = 6.6, RAMPE_AUF = 55, RAMPE_AB = 42, OBEN = 16;
let ueberfuehrungen = [];
function ueberfuehrungAnlegen(von, bis) {
  const n = vorab(bis, von); let best = 1e9, a = -1, b = -1;
  for (let k = 0; k < n; k += 2) for (let m = k + meter(80); m < n; m += 2) {
    const i = wrap(von + k), j = wrap(von + m), q = (PX[i] - PX[j]) ** 2 + (PZ[i] - PZ[j]) ** 2;
    if (q < best) { best = q; a = i; b = j; }
  }
  if (a < 0 || best > 36) return;
  const i0 = wrap(b - meter(OBEN + RAMPE_AUF + 2)), len = meter(2 * OBEN + RAMPE_AUF + RAMPE_AB + 4);
  for (let k = 0; k <= len; k++) { const j = wrap(i0 + k); UEBER[j] = 1; MAUERW[j] = RAND + .6; }
  ueberfuehrungen.push({ unten: a, oben: b, i0, n: len });
}
// Höhe der Brücke, v = Meter vor (-) oder hinter (+) der Kreuzung
const brueckeProfil = v => v < -OBEN - RAMPE_AUF || v > OBEN + RAMPE_AB ? 0 : v < -OBEN ? BRUECKE_H * glatt((v + OBEN + RAMPE_AUF) / RAMPE_AUF) : v <= OBEN ? BRUECKE_H : BRUECKE_H * (1 - glatt((v - OBEN) / RAMPE_AB));
// senkrechte Fläche entlang der Strecke (Brückenkante, Viaduktwand)
function seitenWand(d, y0, y1, farbe, von, bis, offen) {
  const pos = [], col = [], c = new THREE.Color();
  for (let i = von; i < bis; i++) {
    const a = wrap(i), b = wrap(i + 1);
    if (offen && (offen(a) || offen(b))) continue;
    const A0 = y0(a), A1 = y1(a), B0 = y0(b), B1 = y1(b); if (A1 - A0 < .05 && B1 - B0 < .05) continue;
    const P = (k, y) => [PX[k] + nX(k) * d, y, PZ[k] + nZ(k) * d];
    pos.push(...P(a, A0), ...P(b, B0), ...P(b, B1), ...P(a, A0), ...P(b, B1), ...P(a, A1));
    c.set(farbe(i)); for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.castShadow = true; m.receiveShadow = true; streckeG.add(m);
}
function ueberfuehrungBauen() {
  const STEIN = TH.stein, bruest = [], laternen = [];
  for (const U of ueberfuehrungen) {
    const mitte = vorab(U.oben, U.i0);
    for (let k = 0; k <= U.n; k++) { const j = wrap(U.i0 + k); HOCH[j] = brueckeProfil((k - mitte) * SCHRITT); NEIG[j] = 0; }
    const s6 = meter(6);
    for (let k = -s6; k <= U.n + s6; k++) { const i = wrap(U.i0 + k); STEIG[i] = (HOCH[wrap(i + s6)] - HOCH[wrap(i - s6)]) / (2 * s6 * SCHRITT); }
    const von = U.i0, bis = U.i0 + U.n, H = i => HOCH[wrap(i)], RB = RAND + 1.2;
    for (let j = 0; j < 3; j++) band(-BR / 2 + j * BR / 3, -BR / 2 + (j + 1) * BR / 3, i => TH.platte[(Math.floor(i / (STRICH * .75) + j * .5) + j) % 3], .05, von, bis, H);
    for (const sg of [-1, 1]) {
      band(sg * BR / 2, sg * (BR / 2 + 1.3), i => (Math.floor(i / (STRICH * .6)) % 2 ? TH.kante[0] : TH.kante[1]), .05, von, bis, H);
      band(sg * RAND, sg * RB, i => (Math.floor(i / STRICH) % 3 ? TH.geroell[0] : TH.geroell[1]), .04, von, bis, H);
      // Kante der Brückenplatte und darunter die Viaduktwand; über der unteren Strecke bleibt sie offen
      const unten = i => { const q = punkt(i, sg * RB); return nahPunkt(q.x, q.z, MAUER + 1.5, i, meter(60)) >= 0; };
      const farbe = i => STEIN[Math.floor(i / meter(2.2)) % 4];
      seitenWand(sg * RB, i => Math.max(0, HOCH[i] - 1), i => HOCH[i] + .04, farbe, von, bis);
      seitenWand(sg * RB, () => 0, i => Math.max(0, HOCH[i] - 1), farbe, von, bis, unten);
      for (let k = 0; k <= U.n; k += meter(2.2)) {
        const i = wrap(U.i0 + k), q = punkt(i, sg * (RAND + .9));
        bruest.push([q.x, HOCH[i] + .55, q.z, q.rot + Math.PI / 2, 1, STEIN[Math.floor(zufall() * 4)]]);
        if (k % meter(17.6) < meter(2.2) && HOCH[i] > 2) laternen.push([q.x, HOCH[i] + 1.9, q.z]);
      }
    }
    band(-RB, RB, i => STEIN[Math.floor(i / meter(2.2)) % 4], -1, von, bis, H);           // Unterseite
    // Gold und Truhen, die auf der Brücke liegen, auf die Brücke heben
    for (const mz of muenzen) if (mz.i != null && UEBER[mz.i]) { mz.y = hoehe(mz.i, mz.d) + 1; mz.m.position.y = mz.y; }
    for (const b of kisten) if (b.i != null && UEBER[b.i]) b.h = hoehe(b.i, b.d);
  }
  if (bruest.length) instanzen(new THREE.BoxGeometry(2.2, 1.1, .6), new THREE.MeshLambertMaterial({ color: "#ffffff" }), bruest);
  if (laternen.length) {
    instanzen(new THREE.CylinderGeometry(.1, .1, 1.6, 6), M("#3A3A40"), laternen.map(([x, y, z]) => [x, y - .6, z]), false);
    instanzen(new THREE.SphereGeometry(.28, 8, 6), GLUT(welt === "grotte" ? "#A6FFDA" : "#FFB347"), laternen.map(([x, y, z]) => [x, y + .3, z]), false);
  }
}

// ---------- Ereignisse im Rennen ----------
// Zufallsereignis (einmal je Rennen, Runde 2 oder 3), Runde für Runde (Gitter öffnet sich, Weg stürzt ein),
// Händlerstand, Hebel mit Fässern, Kronleuchter, Leben am Rand und Klänge.
// Der Spielleiter (oder wer allein fährt) entscheidet und schickt es als Ereignis an alle, wie beim Endgegner.

// ----- Klänge: im Handy erzeugt -----
let tonAn = lager.lesen("kart:ton") !== "aus", ac = null;
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}
function rauschen(dauer, freq, laut) {
  const c = audio(); if (!c) return;
  const n = c.createBuffer(1, Math.floor(c.sampleRate * dauer), c.sampleRate), d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const q = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  q.buffer = n; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 1.2; g.gain.value = laut;
  q.connect(f); f.connect(g); g.connect(c.destination); q.start();
}
function ton(frequenzen, dauer, typ, laut, abstand = .7) {
  const c = audio(); if (!c) return;
  frequenzen.forEach((fr, i) => {
    const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + i * dauer * abstand;
    o.type = typ || "sine"; o.frequency.value = fr; g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(laut || .1, t0 + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + dauer);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dauer + .05);
  });
}
function gleitTon(f0, f1, dauer, typ, laut) {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime;
  o.type = typ; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dauer);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(laut, t0 + .04); g.gain.exponentialRampToValueAtTime(.001, t0 + dauer);
  o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dauer + .05);
}
// je Extra ein eigener Ton: [Frequenzen, Dauer, Wellenform] oder eine Funktion
const EXTRA_TON = {
  flink: [[660, 990], .12, "triangle"], dreifach: [[660, 880, 1100], .1, "triangle"], haken: () => gleitTon(250, 1100, .25, "sawtooth", .05),
  teleport: () => { gleitTon(1400, 300, .3, "sine", .08); setTimeout(() => gleitTon(300, 1500, .25, "sine", .07), 260); },
  feuerball: () => { rauschen(.45, 700, .5); ton([160], .25, "sawtooth", .05); }, pfeile: () => { rauschen(.08, 3600, .35); setTimeout(() => rauschen(.08, 3300, .3), 90); },
  axt: () => gleitTon(300, 160, .3, "square", .05), netz: [[420, 320], .14, "triangle"], schleim: () => gleitTon(260, 90, .35, "sine", .14),
  kraehen: [[1900, 1500, 1700], .06, "square"], kaese: [[784, 988], .1, "sine"], pilz: () => { gleitTon(200, 500, .15, "triangle", .1); setTimeout(() => rauschen(.2, 900, .4), 150); },
  schild: [[330, 440], .25, "triangle"], amulett: [[523, 659, 784, 1046], .16, "sine"], fleder: [[1500, 1800, 1400, 1700], .05, "square"],
  beben: () => { rauschen(.7, 110, .9); ton([55, 45], .3, "sine", .25); }, fluegel: [[392, 523, 659, 880], .18, "sine"],
  rachegeist: () => gleitTon(500, 180, .9, "sine", .1)
};
const KLAENGE = {
  ansage() { ton([523, 659, 784, 1046], .2, "square", .045); },
  extra(art) { const t = EXTRA_TON[art]; if (typeof t === "function") t(); else if (t) ton(t[0], t[1], t[2], .07); },
  lachen() { [0, 1, 2, 3].forEach(n => setTimeout(() => gleitTon(340 - n * 30, 250 - n * 25, .13, "square", .045), n * 150)); },   // „Ha-ha-ha-ha“ des Mimiks
  hach() { gleitTon(620, 260, .75, "sine", .12); },                                                     // „Hach“ des mitleidigen Mimiks
  bruellen() { rauschen(1, 170, .7); gleitTon(120, 55, 1, "sawtooth", .07); },
  pling() { ton([1320, 1760, 2093], .1, "triangle", .05); },
  muenze() { ton([1568, 2093], .06, "triangle", .025); },
  knall() { rauschen(.5, 240, .8); ton([70], .3, "sawtooth", .06); },
  treffer() { ton([140, 90], .12, "triangle", .14); },
  klatschen() { for (let n = 0; n < 5; n++) setTimeout(() => rauschen(.05, 2200, .18), n * 110 + Math.random() * 40); },
  klappern() { for (let n = 0; n < 4; n++) setTimeout(() => ton([900 + Math.random() * 500], .04, "square", .03), n * 60); }
};
function klang(name, arg) { if (!tonAn) return; try { KLAENGE[name](arg); } catch {} }
for (const t of ["pointerdown", "keydown"]) addEventListener(t, () => { if (tonAn) audio(); }, { passive: true });
function tonKnopf() { const b = $("tonknopf"); if (b) b.textContent = tonAn ? "🔊 Ton an" : "🔇 Ton aus"; }

// ----- Ruhige Stellen der Strecke (dort ist Platz für Stand, Hebel, Kronleuchter, Zuschauer) -----
const SPERR = new Uint8Array(S);                   // von huegelBauen gefüllt: hier ist schon etwas los
const DING_GEPLANT = [];
function ruhigeStelle(laenge, abstand = 60, versuche = 40, deko = false) {
  const r = meter(laenge);
  for (let n = 0; n < versuche; n++) {
    const i = Math.floor(zufall() * S);
    let ok = vorab(i, 0) > meter(70) && vorab(0, i) > meter(40);
    for (let k = -r; ok && k <= r; k += 2) { const j = wrap(i + k); if ((!deko && SPERR[j]) || UEBER[j] || WEG[j] || LOCH[j] || GLEIT[j] || SCHLUCHT[j] || BELAG[j] || MAUERW[j] < MAUER) ok = false; }
    if (ok) ok = !DING_GEPLANT.some(j => Math.abs(((i - j + S / 2) % S + S) % S - S / 2) * SCHRITT < abstand);
    if (ok && !deko) ok = ![...kisten, ...muenzen].some(b => (b.x - PX[i]) ** 2 + (b.z - PZ[i]) ** 2 < 10 * 10);
    if (ok && !deko) ok = !runen.some(u => (u.x - PX[i]) ** 2 + (u.z - PZ[i]) ** 2 < 10 * 10);
    if (ok) { DING_GEPLANT.push(i); return i; }
  }
  return -1;
}
const kruemmung = i => { let d = Math.atan2(TX[wrap(i + meter(8))], TZ[wrap(i + meter(8))]) - Math.atan2(TX[wrap(i - meter(8))], TZ[wrap(i - meter(8))]); return Math.atan2(Math.sin(d), Math.cos(d)); };

// ----- Modelle -----
function goblinModell(farbe = "#6E9E3A") {
  const g = new THREE.Group();
  teil(g, zyl(.26, .34, .7, 8), "#5A3B26", 0, .55, 0);                          // Kittel
  teil(g, kugel(.3, 10), farbe, 0, 1.12, 0);                                    // Kopf
  for (const s of [-1, 1]) { teil(g, kegel(.1, .42, 4), farbe, s * .34, 1.2, 0, 0, 0, -s * 1.25); teil(g, kugel(.06, 6), "#FFD23A", s * .11, 1.18, .25, 0, 0, 0, GLUT("#FFD23A")); }
  teil(g, kegel(.07, .2, 5), "#E9E2C8", 0, 1.02, .28, Math.PI / 2);              // Zahn
  const arme = [-1, 1].map(s => { const a = new THREE.Group(); a.position.set(s * .3, .82, 0); a.userData.lose = true; teil(a, zyl(.07, .06, .5, 6), farbe, 0, .22, 0); g.add(a); return a; });
  backen(g); g.userData.arme = arme; return g;
}
function haendlerModell() {
  const g = new THREE.Group();
  teil(g, box(2.4, .8, 3.4), "#7A5434", 0, .95, 0);
  for (const x of [-1.25, 1.25]) for (const z of [-1, 1]) teil(g, zyl(.5, .5, .2, 12), "#3A2A20", x, .5, z, 0, 0, Math.PI / 2);
  for (let n = 0; n < 5; n++) teil(g, box(.5, .1, 3.4), n % 2 ? "#F2EDE0" : "#C9372C", -1 + n * .5, 2.7, 0);   // gestreiftes Dach
  for (const x of [-1.1, 1.1]) teil(g, zyl(.06, .06, 1.6, 6), "#4A3426", x, 1.9, 1.5);
  teil(g, box(.5, .5, .5), "#B08A4A", -.6, 1.6, -1); teil(g, box(.5, .5, .5), "#8A5A2E", .5, 1.6, -.8); teil(g, kugel(.3, 10), "#E8C24A", 0, 1.6, .4);
  teil(g, zyl(.3, .36, .8, 8), "#6B4A8E", 0, 1.75, 1.2); teil(g, kugel(.27, 10), HAUT, 0, 2.35, 1.2); teil(g, kegel(.34, .5, 8), "#6B4A8E", 0, 2.72, 1.2);
  teil(g, box(.2, .2, .12), "#FFE07A", .5, 2.9, 1.6, 0, 0, 0, GLUT("#FFE07A"));
  backen(g); return g;
}
const geistKarrenMat = new THREE.MeshBasicMaterial({ color: "#BFE9FF", transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false });
function geistKarrenModell() {
  const g = MODELLE.kaempfer("#BFE9FF"); backen(g);
  g.traverse(o => { if (o.isMesh) { o.material = geistKarrenMat; o.castShadow = false; } });
  return g;
}
function fassModell() { const g = new THREE.Group(); teil(g, zyl(.55, .55, 1.3, 12), "#7A5434", 0, 0, 0, 0, 0, Math.PI / 2); for (const x of [-.45, .45]) teil(g, zyl(.58, .58, .1, 12), "#3A3A40", x, 0, 0, 0, 0, Math.PI / 2); backen(g); return g; }
function skelettModell() {
  const g = new THREE.Group(), K = "#EDE4D0", teile = [];
  const t = (geo, x, y, z, rx = 0, rz = 0) => { const m = teil(g, geo, K, x, y, z, rx, 0, rz); m.userData.ruhe = { p: m.position.clone(), r: m.rotation.clone() }; teile.push(m); return m; };
  t(kugel(.26, 10), 0, 1.15, .1); t(box(.5, .5, .25), 0, .7, 0); t(box(.45, .14, .25), 0, .38, 0);
  for (const s of [-1, 1]) { t(zyl(.05, .05, .6, 5), s * .32, .7, .15, -.6, s * .2); t(zyl(.06, .06, .7, 5), s * .14, .2, .35, Math.PI / 2 - .2); }
  teil(g, kugel(.06, 6), "#1B1620", -.09, 1.18, .33).userData.auge = true; teil(g, kugel(.06, 6), "#1B1620", .09, 1.18, .33).userData.auge = true;
  g.userData.teile = teile; return g;
}
function fledermaus() {
  const f = new THREE.Group(); teil(f, kugel(.16, 6), "#1B1620", 0, 0, 0);
  const fl = [-1, 1].map(s => { const w = teil(f, kegel(.32, .55, 3), "#1B1620", s * .32, 0, 0, 0, 0, -s * Math.PI / 2); w.scale.z = .2; return w; });
  f.userData.fl = fl; return f;
}
function leuchterModell() {
  const g = new THREE.Group();
  teil(g, new THREE.TorusGeometry(1.8, .12, 6, 24), "#C9A13A", 0, 0, 0, Math.PI / 2);
  teil(g, new THREE.TorusGeometry(.9, .1, 6, 18), "#C9A13A", 0, .5, 0, Math.PI / 2);
  for (let n = 0; n < 8; n++) { const a = n / 8 * Math.PI * 2; teil(g, zyl(.1, .1, .45, 6), "#F2EDE0", Math.cos(a) * 1.8, .3, Math.sin(a) * 1.8); teil(g, kegel(.1, .3, 6), "#FFB347", Math.cos(a) * 1.8, .65, Math.sin(a) * 1.8, 0, 0, 0, GLUT("#FFB347")); }
  for (let n = 0; n < 4; n++) { const a = n / 4 * Math.PI * 2; teil(g, zyl(.04, .04, 2.2, 4), "#8A7A4A", Math.cos(a) * .9, 1.1, Math.sin(a) * .9, Math.sin(a) * .7, 0, -Math.cos(a) * .7); }
  backen(g); return g;
}
const drachenSchattenMat = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 256; const x = cv.getContext("2d");
  x.fillStyle = "#000"; x.translate(128, 128);
  x.beginPath(); x.ellipse(0, 0, 18, 70, 0, 0, Math.PI * 2); x.fill();                                    // Leib
  for (const s of [-1, 1]) { x.beginPath(); x.moveTo(0, -20); x.lineTo(s * 125, -45); x.lineTo(s * 95, 0); x.lineTo(s * 110, 25); x.lineTo(s * 60, 15); x.lineTo(0, 25); x.fill(); }
  x.beginPath(); x.moveTo(-6, 60); x.lineTo(6, 60); x.lineTo(0, 125); x.fill();                           // Schwanz
  const t = new THREE.CanvasTexture(cv);
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: .42, depthWrite: false, color: "#000" });
})();

// ----- Bauen (nach den Hügeln, damit alles auf der richtigen Höhe steht) -----
let staende = [], hebel = [], leuchter = [], publikum = [], skelettRand = [], fledRand = [], drachenSchatten = null, faesserRoll = [];
function ereignisDingeBauen() {
  staende = []; hebel = []; leuchter = []; publikum = []; skelettRand = []; fledRand = []; faesserRoll = []; DING_GEPLANT.length = 0;
  // Händlerstand: in einer Kurve, über der Innenseite
  {
    let i = -1; for (let n = 0; n < 6 && i < 0; n++) { const j = ruhigeStelle(12, 80); if (j >= 0 && Math.abs(kruemmung(j)) > .12) i = j; else if (j >= 0) DING_GEPLANT.pop(); }
    if (i < 0) i = ruhigeStelle(12, 80);
    if (i >= 0) {
      const s = kruemmung(i) > 0 ? -1 : 1, g = new THREE.Group(), q = punkt(i, s * (BR / 4 + .5)), y = hoehe(i, s * BR / 4);
      for (const sl of [-1, 1]) for (const dz of [-3, 3]) teil(g, zyl(.12, .12, 3.6, 6), "#4A3426", sl * (BR / 4 + .3), 1.8, dz);
      for (let n = 0; n < 8; n++) teil(g, box(.9, .1, 7), n % 2 ? "#F2EDE0" : (welt === "grotte" ? "#2F7F8A" : welt === "glut" ? "#C2410C" : "#C9372C"), -BR / 4 + .2 + n * (BR / 2 - .4) / 7, 3.7 + Math.sin(n / 7 * Math.PI) * .4, 0);
      for (let n = 0; n < 5; n++) { const kx = -BR / 4 + 1 + n * (BR / 2 - 2) / 4; teil(g, zyl(.03, .03, .6, 4), "#2A2A2A", kx, 3.3, -1 + (n % 2) * 2); teil(g, kugel(.22, 8), ["#8BF0A0", "#E86FB0", "#38BDF8", "#F2B705", "#B78CFF"][n], kx, 2.95, -1 + (n % 2) * 2, 0, 0, 0, GLUT(["#8BF0A0", "#E86FB0", "#38BDF8", "#F2B705", "#B78CFF"][n])); }
      const sx = -s;                              // lokales x zeigt gegen die Streckennormale
      teil(g, box(1.2, 1, 4), "#7A5434", sx * (BR / 4 + 1.4), .5, 0); teil(g, box(.5, .5, .5), "#B08A4A", sx * (BR / 4 + 1.4), 1.25, -1.2); teil(g, kugel(.3, 10), "#E8C24A", sx * (BR / 4 + 1.4), 1.3, .8);
      teil(g, zyl(.34, .4, 1, 8), "#6B4A8E", sx * (BR / 4 + 2.6), .5, 0); teil(g, kugel(.3, 10), HAUT, sx * (BR / 4 + 2.6), 1.3, 0); teil(g, kegel(.38, .55, 8), "#6B4A8E", sx * (BR / 4 + 2.6), 1.75, 0);
      const schild = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), schildMat("Händler", "#5A3B26", "#F2EDE0")); schild.position.set(0, 4.5, 3.55); g.add(schild);
      const schild2 = schild.clone(); schild2.rotation.y = Math.PI; schild2.position.z = -3.55; g.add(schild2);
      backen(g); g.position.set(q.x, y, q.z); g.rotation.y = q.rot; streckeG.add(g);
      staende.push({ i, s, n: meter(6) });
    }
  }
  // Hebel mit Fässern: am Rand, dahinter eine Rampe mit Fässern
  const hebelZahl = welt === "kerker" ? 2 : 1;
  for (let n = 0; n < hebelZahl; n++) {
    const i = ruhigeStelle(10, 70); if (i < 0) continue;
    const s = zufall() < .5 ? -1 : 1, q = punkt(i, s * (BR / 2 + .6)), y = hoehe(i, s * BR / 2);
    const g = new THREE.Group(); teil(g, box(.7, .5, .7), "#3A3A40", 0, .25, 0);
    const arm = new THREE.Group(); arm.position.y = .45; arm.userData.lose = true; teil(arm, zyl(.07, .07, 1.5, 6), "#5A3B26", 0, .75, 0); teil(arm, kugel(.2, 8), "#C9372C", 0, 1.5, 0); arm.rotation.x = -.6; g.add(arm);
    const rampe = new THREE.Group(); teil(rampe, box(3, .2, 6), "#6A4A30", 0, 0, 0); rampe.rotation.x = .35; rampe.position.set(-s * 2.2, 1.2, -1.5); g.add(rampe);
    for (let f = 0; f < 3; f++) { const fm = fassModell(); fm.position.set(-s * 2.2, 2.3 - f * .05, -3.8 + f * 1.2); fm.rotation.y = Math.PI / 2; g.add(fm); }
    backen(g); g.position.set(q.x, y, q.z); g.rotation.y = q.rot; streckeG.add(g);
    hebel.push({ nr: hebel.length, i, s, d: s * (BR / 2 + .6), x: q.x, z: q.z, y, arm, bis: 0 });
  }
  // Kronleuchter (Kerker): hängt über der Fahrbahn, ein Feuerball holt ihn herunter
  if (welt === "kerker") for (let n = 0; n < 2; n++) {
    const i = ruhigeStelle(8, 70); if (i < 0) continue;
    const q = punkt(i, 0), y0 = hoehe(i, 0), g = leuchterModell(); g.position.set(q.x, y0 + 9, q.z); streckeG.add(g);
    const kette = new THREE.Mesh(zyl(.05, .05, 30, 4), M("#5A5048")); kette.position.set(q.x, y0 + 25, q.z); streckeG.add(kette);
    leuchter.push({ nr: leuchter.length, i, d: 0, x: q.x, z: q.z, y0, g, kette, zustand: 0, t: 0 });
  }
  // Zuschauer: Goblins auf der Mauer, die klatschen
  for (let n = 0; n < 7; n++) {
    const i = ruhigeStelle(4, 45, 40, true); if (i < 0) continue;
    const s = zufall() < .5 ? -1 : 1, gruppe = [];
    for (let m = -1; m <= 1; m++) {
      const j = wrap(i + meter(m * 1.3)), q = punkt(j, s * (MAUER + .7)), g = goblinModell(["#6E9E3A", "#7FAF45", "#5E8E30"][(m + 1)]);
      g.position.set(q.x, hoeheAn(q.x, q.z) + 2.2, q.z); g.rotation.y = q.rot + (s > 0 ? Math.PI / 2 : -Math.PI / 2); g.scale.setScalar(1.15); streckeG.add(g);
      gruppe.push({ g, y: g.position.y, ph: zufall() * 6 });
    }
    publikum.push({ i, x: PX[i], z: PZ[i], gruppe, laut: 0 });
  }
  // Skelette am Rand (Kerker, Glutschlund): wer sie streift, lässt sie auseinanderfallen
  if (welt !== "grotte") for (let n = 0; n < 6; n++) {
    const i = ruhigeStelle(3, 40, 40, true); if (i < 0) continue;
    const s = zufall() < .5 ? -1 : 1, d = s * (RAND + 1.2), q = punkt(i, d), g = skelettModell();
    g.position.set(q.x, hoehe(i, d), q.z); g.rotation.y = q.rot + (s > 0 ? Math.PI / 2 : -Math.PI / 2); streckeG.add(g);
    skelettRand.push({ g, x: q.x, z: q.z, t: 0 });
  }
  // Fledermäuse (Grotte): hängen unter der Decke und flattern auf, wenn jemand vorbeirast
  if (welt === "grotte") for (let n = 0; n < 6; n++) {
    const i = ruhigeStelle(3, 40, 40, true); if (i < 0) continue;
    const s = zufall() < .5 ? -1 : 1, q = punkt(i, s * (BR / 2 + 1)), y = hoehe(i, 0) + 8, schwarm = [];
    for (let m = 0; m < 7; m++) { const f = fledermaus(); const p = new THREE.Vector3(q.x + (zufall() - .5) * 3, y + zufall(), q.z + (zufall() - .5) * 3); f.position.copy(p); f.rotation.x = Math.PI; streckeG.add(f); schwarm.push({ f, p, dir: new THREE.Vector3(zufall() - .5, .6 + zufall() * .4, zufall() - .5).normalize() }); }
    fledRand.push({ x: q.x, z: q.z, schwarm, t: 0 });
  }
  drachenSchatten = null;
  if (welt === "glut") { const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), drachenSchattenMat); m.rotation.x = -Math.PI / 2; m.visible = false; streckeG.add(m); drachenSchatten = { m, t: 0, pause: 6 }; }
}

// ----- Runde für Runde: Sperren an den Gabelungen -----
// Runde 1: Gitter vor dem kurzen Weg der ersten Gabelung, ab Runde 2 offen. Letzte Runde (ab 3 Runden): Der lange Weg der zweiten Gabelung stürzt ein.
const SPERR_U = .1;
const sperrIdx = W => wrap(W.i0 + Math.round(W.n * SPERR_U));
function sperrenBauen() {
  for (const W of wege) {
    W.zu = 0; W.sperrM = {};
    const gi = sperrIdx(W), mitte = (WEG_L[gi] + WEG_R[gi]) / 2;
    for (const s of [-1, 1]) {
      const innen = mitte, aussen = wegMitte(gi, s) + s * WEG_RAND, breit = Math.abs(aussen - innen), q = punkt(gi, (innen + aussen) / 2), y = hoehe(gi, (innen + aussen) / 2);
      const g = new THREE.Group();
      if (W.nr === 0 && s === -W.lang) {           // Gitter
        const farbe = welt === "grotte" ? "#E8E4D8" : welt === "glut" ? "#3A2F33" : "#4A4A52";
        for (let x = -breit / 2 + .4; x <= breit / 2; x += .8) teil(g, box(.14, 4, .14), farbe, x, 2, 0);
        for (const h of [1, 2.6, 3.9]) teil(g, box(breit, .14, .14), farbe, 0, h, 0);
        for (const x of [-breit / 2, breit / 2]) teil(g, box(.6, 5, .6), TH.pfeiler, x, 2.5, 0);
      } else if (W.nr === 1 && s === W.lang) {      // Trümmer (erst beim Einsturz sichtbar)
        for (let n = 0; n < 9; n++) teil(g, box(1.4 + zufall(), 1 + zufall() * 1.2, 1.4 + zufall()), TH.stein[n % 4], -breit / 2 + .8 + n * (breit - 1.6) / 8, .6 + zufall() * .5, (zufall() - .5) * 2, zufall(), zufall(), zufall());
        for (let n = 0; n < 4; n++) teil(g, box(1.2, .9, 1.2), TH.stein[(n + 1) % 4], -breit / 2 + 1.6 + n * (breit - 3) / 3, 1.7, (zufall() - .5), zufall(), zufall(), zufall());
      } else continue;
      backen(g); g.position.set(q.x, y, q.z); g.rotation.y = q.rot; streckeG.add(g);
      W.sperrM[s] = g; g.visible = false;
    }
  }
}
function sperreSetzen(e) {
  const W = wege[e.w | 0]; if (!W) return;
  const zu = e.zu === 1 || e.zu === -1 ? e.zu : 0, vorher = W.zu;
  if (vorher === zu) return;
  W.zu = zu;
  for (const s of [-1, 1]) if (W.sperrM && W.sperrM[s]) W.sperrM[s].visible = s === zu;
  if (!e.leise) {
    const gi = sperrIdx(W), q = punkt(gi, wegMitte(gi, zu || vorher));
    if (zu) { for (let n = 0; n < 6; n++) puff(q.x + (Math.random() - .5) * 8, 1.5 + Math.random() * 2, q.z + (Math.random() - .5) * 8, "#9A8F82"); wackeln = Math.max(wackeln, .6); }
    if (ich && ich.fertig == null) { melden(zu ? `Einsturz! Ein Weg bei „${W.insel}“ ist zu 💥` : `Das Gitter bei „${W.insel}“ ist offen! Abkürzung 🔓`, 2.2); klang(zu ? "knall" : "pling"); }
  }
}
// Zusammenstoß mit einer Sperre (aus streckeStoss)
function sperreStoss(k, alt) {
  for (const W of wege) {
    if (!W.zu) continue;
    const gi = sperrIdx(W);
    if (!(vorab(alt.idx, gi) > S / 2 && vorab(k.idx, gi) < meter(4))) continue;
    if (wegSeite(k.idx, k.d) !== W.zu) continue;
    k.x = alt.x; k.z = alt.z; k.idx = alt.idx; k.prog = alt.prog; k.d = alt.d; k.v = -Math.max(3.5, Math.min(7, Math.abs(k.v) * .35)); k.drift = 0;
    if (k.bot || AUTO) k.wegWahl = -W.zu;
    if (k.ich) { wackeln = Math.max(wackeln, .3); summen(60); if (!(k.sperrGemeldet > uhr)) { k.sperrGemeldet = uhr + 3; melden("Versperrt! Nimm den anderen Weg", 1.6); } }
  }
}
// Monster nehmen keinen versperrten Weg (aus botEingabe)
function botSperre(k) {
  for (const W of wege) if (W.zu && k.wegWahl === W.zu) { const v = vorab(k.idx, W.i0); if (!(v <= W.n && v > Math.round(W.n * SPERR_U))) k.wegWahl = -W.zu; }
}

// ----- Händlerstand: langsamer hindurch, dafür ein Extra -----
function standPruefen(k) {
  for (const T of staende) {
    const v = vorab(k.idx, wrap(T.i - (T.n >> 1))), drin = v <= T.n && k.d * T.s > .3 && Math.abs(k.d) < BR / 2 + .5 && !k.luft;
    if (drin) { k.bremse = Math.max(k.bremse, .12); if (!k.imStand) { k.imStand = true; if (k.ich) melden("Beim Händler 🛍️", .8); } }
    else if (k.imStand && v > T.n && v < T.n + meter(6)) {
      k.imStand = false;
      const runde = Math.floor(k.prog / S);
      if (k.standRunde === runde || k.item || k.walze > 0 || k.kroete > 0) continue;
      k.standRunde = runde;
      const art = extraZiehen(k); k.item = { art, n: EXTRAS[art].n || 1 }; k.walze = k.bot ? .8 : 1.1;
      if (k.ich) { extraAnzeigen(true); klang("pling"); }
    } else if (v > T.n + meter(6) && v < S / 2) k.imStand = false;
  }
}

// ----- Hebel mit Fässern -----
function hebelPruefen(k) {
  for (const H of hebel) {
    if (H.bis > uhr || (k.x - H.x) ** 2 + (k.z - H.z) ** 2 > 1.9 * 1.9) continue;
    H.bis = uhr + 1;                                // gegen doppeltes Auslösen, bis das Ereignis zurückkommt
    ereignis({ a: "hebel", n: H.nr, von: k.id });
    if (k.ich) melden("Hebel! Die Fässer rollen nach hinten 🛢️", 1.4);
  }
}
let fassGeo = null;
function hebelZiehen(e) {
  const H = hebel[e.n | 0]; if (!H) return;
  H.bis = uhr + 6; H.zug = .6; klang("knall");
  for (let n = 0; n < 4; n++) {
    const g = fassModell(); streckeG.add(g);
    faesserRoll.push({ g, p: H.i - meter(1 + n * 2.2), d: H.s * (BR / 2 - 1.2 - n * 3.1), dv: -H.s * (.6 + n * .2), t: -n * .12, von: e.von, weg: false });
  }
}
function faesserSchritt(dt) {
  for (const H of hebel) if (H.zug > 0) { H.zug = Math.max(0, H.zug - dt); H.arm.rotation.x = -.6 + Math.sin((1 - H.zug / .6) * Math.PI) * 1.3; }
  for (const F of faesserRoll) {
    F.t += dt; if (F.t < 0) { F.g.visible = false; continue; }
    F.g.visible = !F.weg;
    F.p -= 14 * dt / SCHRITT; F.d = klemmen(F.d + F.dv * dt, -BR / 2 + .8, BR / 2 - .8);
    const i = wrap(Math.round(F.p)), d = aufWeg(i, F.d, .8), q = punkt(i, d);
    F.x = q.x; F.z = q.z; F.g.position.set(q.x, hoehe(i, d) + .55, q.z); F.g.rotation.set(0, q.rot + Math.PI / 2, 0); F.g.children.forEach(c => c.rotation.x -= dt * 9);
    if (F.weg) continue;
    for (const k of karts) {
      if (k.remote || k.id === F.von || k.fertig != null || (k.x - q.x) ** 2 + (k.z - q.z) ** 2 > 1.7 * 1.7 || k.y - hoehe(i, d) > 1.5) continue;
      treffen(k, "treffer"); F.weg = true; F.g.visible = false; puff(q.x, 1, q.z, "#7A5434"); if (k.ich) melden("Ein Fass! 🛢️", 1);
      break;
    }
  }
  for (let n = faesserRoll.length - 1; n >= 0; n--) if (faesserRoll[n].t > 4.5) { streckeG.remove(faesserRoll[n].g); entsorgen(faesserRoll[n].g); faesserRoll.splice(n, 1); }
}
// Monster rammen manchmal den Hebel, wenn jemand hinter ihnen ist
function hebelSpur(k) {
  for (const H of hebel) {
    const m = vorab(H.i, k.idx) * SCHRITT;
    if (m < 2 || m > 32 || H.bis > uhr) continue;
    if (k.hebelFuer !== H.nr + ":" + Math.floor(k.prog / S)) { k.hebelFuer = H.nr + ":" + Math.floor(k.prog / S); k.hebelWill = Math.random() < .45 && !!naechstesKart(k, -1, 45); }
    if (k.hebelWill) return H.s * (BR / 2 - .2);
  }
  return null;
}

// ----- Kronleuchter: ein Feuerball holt ihn herunter, dann liegt er eine Runde lang auf der Fahrbahn -----
const LEUCHTER_LIEGT = 45;
function leuchterFeuer(o) {                         // aus objekteSchritt, für Feuerbälle von Karts dieses Handys
  for (const L of leuchter) if (L.zustand === 0 && Math.abs(((o.idx - L.i + S / 2) % S + S) % S - S / 2) * SCHRITT < 3 && Math.abs(o.d - L.d) < 4.5) { ereignis({ a: "leuchter", n: L.nr }); return true; }
  return false;
}
function leuchterFall(e) {
  const L = leuchter[e.n | 0]; if (!L || L.zustand !== 0) return;
  L.zustand = 1; L.t = 0; klang("knall");
  if (ich && ich.fertig == null && Math.abs(((ich.idx - L.i + S / 2) % S + S) % S - S / 2) * SCHRITT < 120) melden("Der Kronleuchter stürzt herab! 💥", 1.6);
}
function leuchterSchritt(dt) {
  for (const L of leuchter) {
    if (L.zustand === 0) { L.g.rotation.y += dt * .2; continue; }
    L.t += dt;
    if (L.zustand === 1) {                          // fällt
      const y = Math.max(L.y0 + .3, L.y0 + 9 - 30 * L.t * L.t);
      L.g.position.y = y; L.kette.position.y = y + 16;
      if (y <= L.y0 + .3) {
        L.zustand = 2; L.t = 0; L.g.rotation.z = .12; wackeln = Math.max(wackeln, .4);
        for (let n = 0; n < 5; n++) puff(L.x + (Math.random() - .5) * 4, 1, L.z + (Math.random() - .5) * 4, "#C9A13A");
        for (const k of karts) if (!k.remote && (k.x - L.x) ** 2 + (k.z - L.z) ** 2 < 9) treffen(k, "treffer");
      }
    } else if (L.zustand === 2 && L.t > LEUCHTER_LIEGT) { L.zustand = 3; L.t = 0; L.g.rotation.z = 0; }
    else if (L.zustand === 3) {                     // wird wieder hochgezogen
      const y = Math.min(L.y0 + 9, L.y0 + .3 + L.t * 3); L.g.position.y = y; L.kette.position.y = y + 16;
      if (y >= L.y0 + 9) { L.zustand = 0; L.t = 0; }
    }
  }
}
function leuchterStoss(k, dt) {                     // aus streckeStoss
  for (const L of leuchter) {
    if (L.zustand !== 2 && L.zustand !== 3) continue;
    if (L.zustand === 3 && L.g.position.y > L.y0 + 2.2) continue;
    const dx = k.x - L.x, dz = k.z - L.z, dd = Math.hypot(dx, dz), r = 2.1 + .9;
    if (dd < r && dd > .001) { k.x = L.x + dx / dd * r; k.z = L.z + dz / dd * r; k.v *= Math.max(0, 1 - 6 * dt); }
  }
}
const liegendeLeuchter = () => leuchter.filter(L => L.zustand === 2).map(L => ({ i: L.i, d: L.d }));

// ----- Leben am Rand -----
function randLeben(dt) {
  const t = performance.now() / 1000;
  for (const P of publikum) {
    let nah = false; for (const k of karts) if (k.g.visible && (k.x - P.x) ** 2 + (k.z - P.z) ** 2 < 28 * 28) { nah = true; break; }
    if (nah && P.laut <= 0 && ich && (ich.x - P.x) ** 2 + (ich.z - P.z) ** 2 < 20 * 20) { klang("klatschen"); P.laut = 4; }
    if (P.laut > 0) P.laut -= dt;
    for (const G of P.gruppe) {
      const a = G.g.userData.arme, w = nah ? Math.sin(t * 16 + G.ph) : Math.sin(t * 2 + G.ph) * .2;
      a[0].rotation.z = -.4 - (nah ? 1.6 : .2) + w * .35; a[1].rotation.z = .4 + (nah ? 1.6 : .2) - w * .35;
      G.g.position.y = G.y + (nah ? Math.abs(Math.sin(t * 8 + G.ph)) * .35 : 0);
    }
  }
  for (const K of skelettRand) {
    const teile = K.g.userData.teile;
    if (K.t <= 0) {
      for (const k of karts) if (k.g.visible && (k.x - K.x) ** 2 + (k.z - K.z) ** 2 < 2.4 * 2.4) {
        K.t = 4.5; if (k.ich) klang("klappern");
        teile.forEach(m => m.userData.flug = new THREE.Vector3((Math.random() - .5) * 6, 3 + Math.random() * 4, (Math.random() - .5) * 6 + k.v * .15));
        break;
      }
      continue;
    }
    K.t -= dt;
    K.g.children.forEach(c => { if (c.userData.auge) c.visible = K.t <= .6; });
    for (const m of teile) {
      const R = m.userData.ruhe;
      if (K.t > 1.2) {                              // fällt auseinander
        const f = m.userData.flug; f.y -= 20 * dt; m.position.addScaledVector(f, dt);
        if (m.position.y < .12) { m.position.y = .12; f.set(f.x * .5, 0, f.z * .5); }
        m.rotation.x += dt * 5; m.rotation.z += dt * 3;
      } else {                                      // setzt sich wieder zusammen
        const u = Math.min(1, dt * 5); m.position.lerp(R.p, u);
        m.rotation.x += (R.r.x - m.rotation.x) * u; m.rotation.y += (R.r.y - m.rotation.y) * u; m.rotation.z += (R.r.z - m.rotation.z) * u;
      }
    }
    if (K.t <= 0) teile.forEach(m => { m.position.copy(m.userData.ruhe.p); m.rotation.copy(m.userData.ruhe.r); });
  }
  for (const F of fledRand) {
    if (F.t <= 0) {
      F.schwarm.forEach((b, n) => { b.f.position.copy(b.p); b.f.rotation.set(Math.PI, 0, 0); b.f.visible = true; b.f.userData.fl.forEach(w => w.rotation.x = 0); });
      for (const k of karts) if (k.g.visible && k.v > 12 && (k.x - F.x) ** 2 + (k.z - F.z) ** 2 < 14 * 14) { F.t = 14; if (k.ich) klang("extra", "fleder"); break; }
      continue;
    }
    F.t -= dt;
    const flug = 14 - F.t;
    F.schwarm.forEach((b, n) => {
      b.f.visible = flug < 3.5;
      b.f.position.addScaledVector(b.dir, dt * 11); b.f.position.x += Math.sin(t * 9 + n) * dt * 3;
      b.f.rotation.set(0, Math.atan2(b.dir.x, b.dir.z), 0); b.f.userData.fl.forEach((w, j) => w.rotation.x = Math.sin(t * 30 + n) * .7 * (j ? 1 : -1));
    });
  }
  // Der Schatten des Glutdrachen zieht in Runde 1 über die Strecke
  const D = drachenSchatten;
  if (D) {
    const f = fokusKart();
    if (D.t > 0 && f) {
      D.t -= dt; const u = 1 - D.t / 2.4, i = D.i, quer = -45 + u * 90, q = punkt(i, quer * D.s);
      D.m.visible = true; D.m.position.set(q.x, hoehe(i, 0) + .3, q.z); D.m.rotation.z = Math.atan2(D.s * TZ[i], -D.s * TX[i]);
      if (D.t <= 0) D.m.visible = false;
    } else if (phase === "rennen" && f && f.runden.length === 0 && koenig && koenig.art === "drache") {
      D.pause -= dt;
      if (D.pause <= 0) { D.pause = 9 + Math.random() * 6; D.t = 2.4; D.i = wrap(f.idx + meter(30 + f.v * .6)); D.s = Math.random() < .5 ? -1 : 1; if (f.ich) klang("bruellen"); }
    }
  }
}

// ----- Zufallsereignis -----
const ZUFALL = {
  goldregen: { name: "Goldregen", bild: "💰", text: "Gold fällt von der Decke!", dauer: 10 },
  horde: { name: "Goblin-Horde", bild: "👺", text: "Eine Goblin-Horde rennt über die Strecke!", dauer: 16 },
  dunkel: { name: "Fackeln aus", bild: "🌑", text: "Die Fackeln gehen aus!", dauer: 15 },
  haendler: { name: "Händlerkarren", bild: "🛒", text: "Wer den Händler berührt, bekommt ein starkes Extra!", dauer: 30 },
  fieber: { name: "Truhenfieber", bild: "🎁", text: "Jede Truhe gibt doppelt!", dauer: 12 },
  geist: { name: "Geisterkarren", bild: "👻", text: "Ein Geisterkarren fährt rückwärts. Ausweichen!", dauer: 26 }
};
const TEST_ZUFALL = new URLSearchParams(location.search).get("ereignis");   // Test: ?ereignis=horde erzwingt dieses Ereignis
let zf = null, zfPlan = null, zfDinge = [];
const zfAktiv = art => !!zf && zf.art === art && zf.t >= 0 && zf.t < ZUFALL[art].dauer;
const fuehrung = () => karts.reduce((b, k) => k.fertig == null && (!b || k.prog > b.prog) ? k : b, null);
// Neues Rennen: alles zurücksetzen (alle Handys gleich)
function ereignisseZuruecksetzen() {
  if (zf) zufallEnde();
  zf = null; zfPlan = null;
  for (const W of wege) { W.zu = 0; W.gestuerzt = false; if (W.sperrM) for (const s of [-1, 1]) if (W.sperrM[s]) W.sperrM[s].visible = false; }
  if (wege[0] && wege[0].sperrM && wege[0].sperrM[-wege[0].lang]) sperreSetzen({ w: 0, zu: -wege[0].lang, leise: true });
  for (const H of hebel) { H.bis = 0; H.zug = 0; H.arm.rotation.x = -.6; }
  for (const F of faesserRoll) { streckeG.remove(F.g); entsorgen(F.g); } faesserRoll = [];
  for (const L of leuchter) { L.zustand = 0; L.t = 0; L.g.position.y = L.y0 + 9; L.kette.position.y = L.y0 + 25; L.g.rotation.z = 0; }
  for (const F of fledRand) F.t = 0;
  for (const K of skelettRand) { K.t = 0; K.g.userData.teile.forEach(m => { m.position.copy(m.userData.ruhe.p); m.rotation.copy(m.userData.ruhe.r); }); K.g.children.forEach(c => c.visible = true); }
  if (drachenSchatten) { drachenSchatten.t = 0; drachenSchatten.pause = 6; drachenSchatten.m.visible = false; }
  $("ansage").hidden = true;
}
// Spielleiter: plant das Zufallsereignis und die Sperren, löst sie aus
function ereignisseLenken() {
  if (modus === "client" || phase !== "rennen") return;
  const F = fuehrung(); if (!F) return;
  const runde = Math.floor(F.prog / S);
  if (wege[0] && wege[0].zu && wege[0].zu === -wege[0].lang && runde >= 1) ereignis({ a: "sperre", w: 0, zu: 0 });
  if (wege[1] && !wege[1].zu && RUNDEN >= 3 && runde >= RUNDEN - 1 && !wege[1].gestuerzt) { wege[1].gestuerzt = true; ereignis({ a: "sperre", w: 1, zu: wege[1].lang }); }
  if (!zfPlan) {
    const arten = Object.keys(ZUFALL).filter(a => !(a === "dunkel" && fluch === "nacht") && !(a === "fieber" && kisten.length < 6));
    const art = ZUFALL[TEST_ZUFALL] ? TEST_ZUFALL : arten[Math.floor(Math.random() * arten.length)];
    const r = TEST_ZUFALL ? 0 : RUNDEN <= 2 ? 1 : 1 + Math.floor(Math.random() * Math.min(2, RUNDEN - 1));
    zfPlan = { art, prog: r * S + Math.floor((TEST_ZUFALL ? .08 : .15 + Math.random() * .4) * S), los: false };
  }
  if (!zfPlan.los && F.prog >= zfPlan.prog) {
    zfPlan.los = true;
    const e = { a: "zufall", art: zfPlan.art, s: Math.floor(Math.random() * 9999) + 1, seite: Math.random() < .5 ? 1 : -1 };
    // wo es passiert: vor dem Führenden, für die Horde an einer freien Stelle
    const vor = { horde: 150, haendler: 70, geist: 230, goldregen: 30 }[e.art] || 0;
    let i = wrap(F.idx + meter(vor));
    if (e.art === "horde") for (let n = 0; n < 200 && (UEBER[i] || WEG[i] || LOCH[i] || GLEIT[i] || SCHLUCHT[i] || BELAG[i] === BOOT || MAUERW[i] < MAUER); n++) i = wrap(i + meter(4));
    e.idx = i; ereignis(e);
  }
}
// Alle Handys: Ereignis ansagen und ablaufen lassen
function zufallStart(e) {
  if (zf || !ZUFALL[e.art]) return;
  zf = { art: e.art, t: -3, idx: wrap(e.idx | 0), s: +e.s || 1, seite: e.seite === -1 ? -1 : 1, an: false };
  const Z = ZUFALL[e.art], a = $("ansage");
  a.innerHTML = `<b>${Z.bild} ${Z.name}</b><span>${Z.text}</span>`; a.hidden = false; a.classList.remove("neu"); void a.offsetWidth; a.classList.add("neu");
  klang("ansage");
}
function zufallEnde() {
  for (const o of zfDinge) { streckeG.remove(o.g); if (!o.geteilt) entsorgen(o.g); }
  zfDinge = [];
  if (zf && zf.art === "dunkel") dunkelSetzen(0);
  zf = null;
}
const GOLD_REGEN = 70, HORDE = 14;
function zufallSchritt(dt) {
  if (!zf) return;
  const Z = ZUFALL[zf.art], vorher = zf.t;
  zf.t += dt;
  if (vorher < -.5 && zf.t >= -.5) $("ansage").hidden = true;
  if (vorher < 0 && zf.t >= 0) zufallAn();
  const t = zf.t;
  if (zf.art === "goldregen" && zf.an) {
    for (const c of zfDinge) {
      if (c.weg) continue;
      if (t < c.ab) { c.g.visible = false; continue; }
      c.g.visible = true;
      if (c.y > c.boden) { c.vy -= 25 * dt; c.y = Math.max(c.boden, c.y + c.vy * dt); }
      c.g.position.y = c.y; c.g.rotation.y += dt * 3;
      if (c.y > c.boden + 2.5) continue;
      for (const k of karts) {
        if (k.fertig != null || (k.x - c.x) ** 2 + (k.z - c.z) ** 2 > 2.9 || Math.abs(c.y - 1 - k.y) > 1.8) continue;
        c.weg = true; c.g.visible = false;
        if (!k.remote) { k.gold = Math.min(10, (k.gold || 0) + 1); kraftLaden(k, .05 * (k.typ === "bardin" ? 2 : 1)); if (k.ich) { klang("muenze"); const g = $("gold"); g.classList.remove("neu"); void g.offsetWidth; g.classList.add("neu"); } }
        break;
      }
    }
  }
  if (zf.art === "horde") {
    const i0 = zf.idx;
    zfDinge.forEach((G, n) => {
      const laengs = (n - (HORDE - 1) / 2) * 1.5, j = wrap(i0 + meter(laengs)), lauf = t >= 0 && t < Z.dauer;
      const quer = lauf ? Math.sin(t * G.tempo + G.ph) * (BR / 2 + 1.2) : (t < 0 ? 1 : -1) * G.seite * (BR / 2 + 2.5 + Math.max(0, t - Z.dauer) * 8);
      const q = punkt(j, quer), y = hoehe(j, quer);
      G.g.position.set(q.x, y + Math.abs(Math.sin(performance.now() / 90 + n)) * .25, q.z);
      const richt = lauf ? Math.cos(t * G.tempo + G.ph) : -G.seite;
      G.g.rotation.y = q.rot + (richt > 0 ? Math.PI / 2 : -Math.PI / 2);
      const a = G.g.userData.arme; a[0].rotation.x = a[1].rotation.x = Math.sin(performance.now() / 70 + n) * .9;
      G.g.visible = t < Z.dauer + 3;
      if (!lauf) return;
      for (const k of karts) if (!k.remote && k.fertig == null && !k.luft && (k.x - q.x) ** 2 + (k.z - q.z) ** 2 < 1.4 * 1.4) { if (treffen(k, "treffer") === "weg" && k.ich) melden("Von Goblins überrannt! 👺", 1.2); }
    });
  }
  if (zf.art === "dunkel") dunkelSetzen(t < 0 ? 0 : t < 1 ? t : t < Z.dauer - 1.5 ? 1 : Math.max(0, (Z.dauer - t) / 1.5));
  if ((zf.art === "haendler" || zf.art === "geist") && zf.an) {
    const W = zfDinge[0], geist = zf.art === "geist";
    W.p += (geist ? -21 : 15) * dt / SCHRITT;
    const i = wrap(Math.round(W.p)), wm = WEG[i] ? wegMitte(i, geist ? zf.seite : WEG_LANG[i]) : 0, d = wm + Math.sin(t * (geist ? .8 : .45)) * (geist ? BR / 2 - 2.2 : 2), q = punkt(i, d);
    const boden = LOCH[i] ? W.y : hoehe(i, d); W.y = W.y == null ? boden : W.y + (boden - W.y) * Math.min(1, dt * 6);
    const raus = t > Z.dauer - 1.5 ? Math.min(1, (t - Z.dauer + 1.5) / 1.5) : 0;
    W.g.position.set(q.x, W.y + (geist ? .4 + Math.sin(t * 3) * .25 : 0) + raus * 6, q.z); W.g.rotation.y = q.rot + (geist ? Math.PI : 0);
    W.g.visible = raus < 1;
    if (raus === 0) for (const k of karts) {
      if (k.remote || k.fertig != null || (k.x - q.x) ** 2 + (k.z - q.z) ** 2 > (geist ? 2.3 : 2.9) ** 2) continue;
      if (geist) { if (treffen(k, "treffer") === "weg" && k.ich) melden("Der Geisterkarren! 👻", 1.2); continue; }
      if (k.vomHaendler) continue;
      k.vomHaendler = true;
      const art = STARKE_EXTRAS[Math.floor(Math.random() * STARKE_EXTRAS.length)];
      k.item = { art, n: EXTRAS[art].n || 1 }; k.walze = k.bot ? .6 : 1.1; puff(k.x, k.y + 1.6, k.z, "#F2B705");
      if (k.ich) { melden("Der Händler schenkt dir etwas! 🛒", 1.4); extraAnzeigen(true); klang("pling"); }
    }
  }
  if (t > Z.dauer + (zf.art === "goldregen" ? 14 : 3)) zufallEnde();
}
// Ereignis beginnt (nach der Ansage)
function zufallAn() {
  zf.an = true;
  const Z = ZUFALL[zf.art], h = (n, m = 0) => hashf(zf.s + m * 17, n);
  if (ich && ich.fertig == null) melden(`${Z.bild} ${Z.text}`, 1.8);
  if (zf.art === "goldregen") {
    for (let n = 0; n < GOLD_REGEN; n++) {
      const i = wrap(zf.idx + meter(10 + h(n) * 520)); if (LOCH[i]) continue;
      const d = aufWeg(i, (h(n, 1) - .5) * (BR - 2.4), 1.2), q = punkt(i, d), boden = hoehe(i, d) + 1;
      const g = new THREE.Mesh(muenzGeo, MUENZ_MAT); g.castShadow = true; g.position.set(q.x, boden + 16, q.z); g.visible = false; streckeG.add(g);
      zfDinge.push({ g, x: q.x, z: q.z, y: boden + 16, vy: 0, boden, ab: h(n, 2) * 9, weg: false, geteilt: true });
    }
  }
  if (zf.art === "horde") {
    for (let n = 0; n < HORDE; n++) { const g = goblinModell(["#6E9E3A", "#7FAF45", "#5E8E30", "#8A9E3A"][n % 4]); g.scale.setScalar(1.1); streckeG.add(g); zfDinge.push({ g, tempo: .9 + h(n) * .7, ph: h(n, 1) * 6.3, seite: h(n, 2) < .5 ? -1 : 1 }); }
    if (ich && ich.fertig == null) klang("klatschen");
  }
  if (zf.art === "haendler") { const g = haendlerModell(); streckeG.add(g); zfDinge.push({ g, p: zf.idx, y: null }); for (const k of karts) k.vomHaendler = false; }
  if (zf.art === "geist") { const g = geistKarrenModell(); streckeG.add(g); zfDinge.push({ g, p: zf.idx, y: null }); }
}
// Fackeln aus: Licht dimmen, Laterne am eigenen Kart an (f: 0 hell … 1 dunkel)
function dunkelSetzen(f) {
  if (fluch === "nacht") return;
  hemi.intensity = TH.hemi[2] * (1 - .8 * f); sonne.intensity = TH.sonne[1] * (1 - .9 * f);
  sc.fog.near = 55 - 40 * f; sc.fog.far = 200 - 130 * f; laterne.intensity = 40 * f;
  const c = new THREE.Color(TH.himmel).lerp(new THREE.Color("#050306"), f); sc.background.copy(c); sc.fog.color.copy(c);
  for (const fl of flammen) fl.visible = f < .5;
}

// ----- Für update(): alles, was je Bild passiert -----
function ereignisseSchritt(dt) {
  ereignisseLenken();
  if (phase === "rennen" || phase === "ziel") { zufallSchritt(dt); faesserSchritt(dt); leuchterSchritt(dt); }
  randLeben(dt);
}

// ---------- Rennen ----------
// Jedes Handy rechnet sein eigenes Kart selbst und schickt 15-mal pro Sekunde seinen Zustand an den Spielleiter.
// Der Spielleiter rechnet die Übungsgegner und schickt allen den Stand aller Karts.
let karts = [], ich = null, phase = "menue", uhr = 0, countdown = 0, liste = [], rennNr = 0, rennenVorbei = false;
let wahlWelt = ["kerker", "grotte", "glut", "zufall"].includes(lager.lesen("kart:welt")) ? lager.lesen("kart:welt") : "zufall";
let wahlTyp = heldOder(lager.lesen("kart:typ")), wahlGegner = Math.min(5, +(lager.lesen("kart:gegner") ?? 3));
// Jeder Mitspieler bekommt eine eigene Kart-Farbe, damit gleiche Fahrzeuge unterscheidbar sind
const SPIELERFARBEN = ["#E23B2E", "#2F6FDE", "#F2B705", "#2E9B4F", "#8B5CF6", "#F97316", "#E86FB0", "#38BDF8"];

// Startaufstellung: Reihen zu zweit hinter der Linie
function startplatz(n) { const reihe = Math.round(9 / (LAENGE / S)); return [wrap(-6 - (1 + Math.floor(n / 2)) * reihe), n % 2 ? -2.6 : 2.6]; }

function rennenAufbauen(raster) {
  karts.forEach(k => { sc.remove(k.g); sc.remove(k.schatten); if (k.seil) sc.remove(k.seil); });
  karts = []; ich = null;
  raster.forEach((e, n) => {
    const k = new Kart(e.typ, e.name, e.id === PID, e.farbe);
    k.id = e.id; k.bot = !!e.bot; k.remote = e.id !== PID && !(e.bot && modus !== "client");
    k.tempo = .9 + (n % 4) * .025; k.loreWahl = Math.random() < .45; k.trollWahl = Math.random() < .4; k.tunnelWahl = Math.random() < .5;
    const [i, d] = startplatz(n); k.setzen(i, d); k.zeigen(0);
    karts.push(k); if (k.ich) ich = k;
  });
  $("punkte").innerHTML = karts.map((k, n) => `<circle r="${k.ich ? 4.5 : 3}" fill="${k.farbe}" stroke="#2A1A12" stroke-width="1.2"/>`).join("");
  document.querySelectorAll(".tag").forEach(t => t.remove());
  for (const k of karts) if (!k.ich) { k.tag = document.createElement("div"); k.tag.className = "tag"; k.tag.textContent = k.name; $("hud").appendChild(k.tag); }
  kisten.forEach(b => { b.weg = 0; neuMischen(b); });
  objekteLeeren(); wackeln = 0; ereignisseZuruecksetzen();
  liste = []; uhr = 0; rennenVorbei = false; extraAnzeigen();
  $("kraftbild").innerHTML = ich && window.VB && HELDEN[ich.typ] ? VB.held(ich.typ) : "⚡";
  $("kkraft").hidden = !ich || !HELDEN[ich.typ];
  kamera(1, true);
}
// Fluch Riesenköpfe: die oberste Kugel des Modells (der Kopf) wird riesig
function riesenkopf(koerper) {
  let kopf = null, hoch = -1e9; const p = new THREE.Vector3();
  koerper.updateMatrixWorld(true);
  koerper.traverse(o => { if (o.isMesh && o.geometry.type === "SphereGeometry" && o.visible) { o.getWorldPosition(p); if (p.y > hoch) { hoch = p.y; kopf = o; } } });
  if (kopf) { kopf.scale.multiplyScalar(2.7); kopf.position.y += .35; }
}
// Übungsgegner: zufällige Monster, jedes nur einmal
function monsterRaster(n) {
  return Object.keys(MONSTER).sort(() => Math.random() - .5).slice(0, n).map((t, i) => ({ id: "bot" + i, name: MONSTER[t].name, typ: t, bot: true }));
}
function alleinRaster() {
  return [...(fz && fz.monster ? fz.monster : monsterRaster(wahlGegner)), { id: PID, name: name || "Du", typ: wahlTyp, farbe: SPIELERFARBEN[0] }];
}

function botEingabe(k, dt) {
  let fs = phase === "rennen" ? streckenSpur(k) : null;            // Spur, die die Strecke verlangt (Gabelung, Wand, Lore, Troll)
  if (fs == null) {                                                   // an der Schlucht: Abstand zum Abgrund halten, Kurve nicht schneiden
    let sg = 0; for (let m = 0; m <= 36; m += 4) { const c = SCHLUCHT[wrap(k.idx + meter(m))]; if (c) sg = sg && sg !== c ? 2 : c; }
    if (sg) { const sp = k.spur || 0; fs = sg === 2 ? klemmen(sp, -2.5, 2.5) : sg > 0 ? Math.min(sp, BR / 2 - 3) : Math.max(sp, -BR / 2 + 3); }
  }
  if (fs == null && phase === "rennen" && hebel.length) fs = hebelSpur(k);
  const vor = Math.round((fs != null ? 5 + k.v * .45 : 10 + k.v * .9) / (LAENGE / S));   // vor Engstellen kürzer vorausschauen, sonst wird die Kurve geschnitten
  const j = wrap(k.idx + vor);
  k.botTimer -= dt;
  if (k.botTimer <= 0) { k.botTimer = 2 + Math.random() * 3; k.spurZiel = (Math.random() - .5) * (BR - 4); }
  // Fallen und Steinen ausweichen (der Pilzling ist zu schusselig dafür)
  if (k.typ !== "pilzling" && phase === "rennen") for (const o of objekte.values()) {
    if (o.wurf || o.art === "kaese" || o.art === "drache") continue;
    let di = o.idx - k.idx; if (di > S / 2) di -= S; if (di < -S / 2) di += S;
    const m = di * SCHRITT, breit = o.art === "kraehen" ? BR / 4 + 1.6 : 2.6;
    const od = wegQuer(o.idx, o.d);
    if (m < 3 || m > 32 || Math.abs(od - k.spur) > breit) continue;
    k.spurZiel = klemmen(od > 0 ? od - breit - 1.2 : od + breit + 1.2, -BR / 2 + 1.5, BR / 2 - 1.5); k.botTimer = Math.max(k.botTimer, 1.2);
    k.spur += (k.spurZiel - k.spur) * Math.min(1, dt * 2.5);
  }
  if (k.typ !== "pilzling" && phase === "rennen") for (const g of [...geysire, ...strudel, ...liegendeLeuchter()]) {      // Geysiren auf der Fahrbahn ausweichen
    const m = vorab(g.i, k.idx) * SCHRITT;
    if (m < 3 || m > 28 || Math.abs(g.d - k.spur) > 2.6) continue;
    k.spurZiel = klemmen(g.d > 0 ? g.d - 3.9 : g.d + 3.9, -BR / 2 + 1.5, BR / 2 - 1.5); k.botTimer = Math.max(k.botTimer, 1.2);
    k.spur += (k.spurZiel - k.spur) * Math.min(1, dt * 2.5);
  }
  if (fs != null) { k.spurZiel = fs; k.botTimer = Math.max(k.botTimer, .5); k.spur += (fs - k.spur) * Math.min(1, dt * 2.5); }
  k.spur += ((k.spurZiel ?? 0) - k.spur) * Math.min(1, dt * .8);
  for (const W of wege) {                                             // vor der Gabelung einen Weg wählen
    const vor = vorab(W.i0, k.idx) * SCHRITT, runde = Math.floor(k.prog / S);
    if (vor > 0 && vor < 70 && k.wegFuer !== W.nr + ":" + runde) { k.wegFuer = W.nr + ":" + runde; k.wegWahl = Math.random() < .5 ? W.lang : -W.lang; }
  }
  botSperre(k);
  const wm = WEG[j] ? wegMitte(j, k.wegWahl || 1) : 0;
  const tx = PX[j] + nX(j) * (wm + k.spur), tz = PZ[j] + nZ(j) * (wm + k.spur);
  let diff = Math.atan2(tx - k.x, tz - k.z) - k.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  // Gummiband: weit hinter dem führenden Menschen etwas schneller, weit vorne etwas langsamer
  const mensch = Math.max(...karts.filter(o => !o.bot).map(o => o.prog));
  const abstand = (mensch - k.prog) / S * LAENGE;
  k.st = { ...TYPEN[k.typ], maxV: TYPEN[k.typ].maxV * k.tempo * (!k.bot ? 1 : abstand > 40 ? 1.08 : abstand < -60 ? .93 : 1) };
  let lenk = -diff * 2.2;
  if (fs != null) lenk += klemmen((k.spur - k.d) * .3, -.8, .8);   // aktiv in die verlangte Spur
  if (k.fleder > 0) lenk += Math.sin(uhr * 7 + k.tempo * 50) * .9;      // Fledermäuse vor den Augen
  return { lenk: Math.max(-1, Math.min(1, lenk)), drift: false, direkt: true };
}

function extraZuenden(wunsch) { if (ich && !AUTO && !ich.aufgegeben) extraNutzen(ich, wunsch); }
let meldTimer = 0;
function melden(t, dauer = 1.4) { const m = $("meldung"); m.textContent = t; m.hidden = false; meldTimer = dauer; }

const zeitText = s => { const m = Math.floor(s / 60), r_ = s - m * 60; return `${m}:${r_ < 10 ? "0" : ""}${r_.toFixed(1).replace(".", ",")}`; };

// Zusammenstöße: nur die eigenen (hier gerechneten) Karts werden verschoben, die anderen schieben ihr Kart selbst weg
function stossen() {
  for (let a = 0; a < karts.length; a++) for (let b = a + 1; b < karts.length; b++) {
    const A = karts[a], B = karts[b];
    if (A.remote && B.remote) continue;
    if (Math.abs(A.y - B.y) > 1.2 || !A.g.visible || !B.g.visible || A.unsicht > 0 || B.unsicht > 0 || A.wind > 0 || B.wind > 0) continue;
    const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
    if (d < 1.9 && d > .001) {
      const ueber = 1.9 - d, mA = A.st.masse, mB = B.st.masse, sum = mA + mB;
      const fA = B.remote ? mB / sum * 2 : mB / sum, fB = A.remote ? mA / sum * 2 : mA / sum;
      if (!A.remote) { A.x -= dx / d * ueber * Math.min(1, fA); A.z -= dz / d * ueber * Math.min(1, fA); }
      if (!B.remote) { B.x += dx / d * ueber * Math.min(1, fB); B.z += dz / d * ueber * Math.min(1, fB); }
      // Wer das Segensamulett trägt, wirft andere beim Rammen herum (entschieden vom Handy des Gerammten)
      if (phase === "rennen") {
        if (!A.remote && (B.amulett > 0 || B.wall > 0 || B.fluegel > 0) && !(A.amulett > 0)) treffen(A, "treffer");
        if (!B.remote && (A.amulett > 0 || A.wall > 0 || A.fluegel > 0) && !(B.amulett > 0)) treffen(B, "treffer");
      }
    }
  }
}

function update(dt) {
  if (phase === "vorschau") {
    vorschauZeit -= dt;
    if (vorschauZeit <= 0) { phase = "countdown"; countdown = 3; $("vorschau").hidden = true; }
  }
  if (phase === "countdown") {
    countdown -= dt;
    const g = $("gross"), n = Math.ceil(countdown);
    if (countdown > 0) { g.hidden = false; g.classList.remove("klein"); g.textContent = n; }
    else { phase = "rennen"; g.textContent = "LOS!"; setTimeout(() => { if (g.textContent === "LOS!") g.hidden = true; }, 700); uhr = 0; karts.forEach(k => k.rundeStart = 0); }
  }
  ein.lenk = lenkWert();
  const rennt = phase === "rennen";
  if (rennt) uhr += dt;
  kroneSetzen();
  for (const k of karts) {
    if (k.remote) { k.folgen(dt); continue; }
    extraTimer(k, dt); rueckenwind(k);
    let e = !rennt ? { lenk: k.ich ? ein.lenk : 0, gas: false, drift: false, direkt: true }
      : k.fertig != null ? (k.ich ? { lenk: botEingabe(k, dt).lenk, drift: false, direkt: true } : botEingabe(k, dt))
        : k.ich && !AUTO && !k.aufgegeben ? ein : botEingabe(k, dt);
    if (rennt && k.haken) e = hakenLenken(k, dt) || e;
    if (rennt && k.fluegel > 0 && k.fertig == null) { const st = k.st, b = botEingabe(k, dt); k.st = st; e = { lenk: b.lenk, drift: false, direkt: true }; }
    if (rennt && k.fertig == null && (!k.ich || AUTO)) botExtra(k, dt);              // Monster (und im Test selbstfahrende Menschen)
    if (rennt && (k.ich ? AUTO : !k.bot) && k.kraft >= 1) kraftNutzen(k);
    if (rennt) kraftSchritt(k, dt);
    if (k.fertig != null && k.ich) k.st = { ...TYPEN[k.typ], maxV: TYPEN[k.typ].maxV * .6 };
    if (k.absturz) absturzSchritt(k, dt);
    else if (k.lore) loreSchritt(k, dt, e);
    else if (k.flug) flugSchritt(k, dt);
    else if (k.pfad) pfadSchritt(k, dt, e);
    else { k.schritt(dt, e); if (rennt) streckeWirkung(k, dt, e); }
    // Runden
    const runde = Math.floor(k.prog / S);
    if (rennt && runde > k.runden.length && k.fertig == null && k.prog > 0) {
      k.runden.push(uhr - k.rundeStart); k.rundeStart = uhr;
      if (k.runden.length >= RUNDEN) { k.fertig = uhr; imZiel(k.id, uhr); if (k.ich) zielEinlauf(); }
      else {
        const finale = k.runden.length === RUNDEN - 1 && ausgleich === "stark" && hinten(k);   // Finale: goldene Truhe für die hintere Hälfte
        if (finale) k.goldtruhe = true;
        if (k.ich) melden(k.runden.length === RUNDEN - 1 ? (finale ? "Letzte Runde! Deine nächste Truhe ist golden ✨" : "Letzte Runde!") : `Runde ${k.runden.length + 1}`, finale ? 2 : 1.4);
      }
    }
    // Kisten
    if (rennt && k.fertig == null) for (const b of kisten) if (!b.weg && Math.hypot(b.x - k.x, b.z - k.z) < 1.8 && Math.abs(k.y - (b.h || 0)) < 2.5) truheNehmen(k, b);
    if (rennt && k.fertig == null && runen.length) runenPruefen(k);
    if (rennt && strudel.length) strudelPruefen(k, dt);
    if (rennt && k.fertig == null) { if (staende.length) standPruefen(k); if (hebel.length) hebelPruefen(k); }
    if (rennt && k.fertig == null) for (const mz of muenzen) if (!mz.weg && Math.abs(mz.y - 1 - k.y) < 1.6 && (mz.x - k.x) ** 2 + (mz.z - k.z) ** 2 < 2.9) goldNehmen(k, mz);
  }
  stossen();
  if (rennt || phase === "ziel") objekteSchritt(dt);
  ereignisseSchritt(dt);
  streckeZeigen(dt); koenigLenken(dt); gleitWasserZeigen(dt);
  truhenZeigen(dt);
  if (wackeln > 0) wackeln = Math.max(0, wackeln - dt);
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
// Zuschauen: Wer im Ziel ist oder aufgegeben hat, kann anderen Fahrern folgen (Antippen wechselt)
let zuschauer = false, blickId = null;
function fokusKart() { if (!zuschauer) return ich; const k = karts.find(o => o.id === blickId && o.g.visible); return k || ich; }
function naechsterBlick() {
  const noch = karts.filter(o => o.fertig == null && o.g.visible && o !== ich), alle = noch.length ? noch : karts.filter(o => o !== ich && o.g.visible);
  if (!alle.length) { blickId = ich.id; return; }
  alle.sort((a, b) => b.prog - a.prog);
  const i = alle.findIndex(o => o.id === blickId);
  blickId = alle[(i + 1) % alle.length].id;
  zuschauLeiste();
}
function zuschauLeiste() {
  const z = $("zuschau"); z.hidden = !zuschauer || phase === "ehrung";
  if (z.hidden) return;
  const k = fokusKart();
  $("zuschauName").innerHTML = `${icon(k.typ)} ${esc(k.ich ? "Du" : k.name)}${k.fertig != null ? " <small>im Ziel</small>" : ""}`;
}
function zuschauen(an) {
  zuschauer = an; $("hud").classList.toggle("zuschauer", an);
  if (an) { $("ziel").hidden = true; blickId = null; naechsterBlick(); kamera(1, true); }
  else { blickId = null; zielZeigen(); }
  zuschauLeiste();
}
let testKamera = null;
function kamera(dt, sofort) {
  if (testKamera) { cam.position.set(...testKamera.p); cam.lookAt(...testKamera.z); return; }   // nur für Tests und Bilder
  if (phase === "vorschau") { vorschauKamera(); kamPos.copy(cam.position); return; }
  const f = fokusKart();
  const fx = Math.sin(f.yaw * .5 + f.mh * .5), fz = Math.cos(f.yaw * .5 + f.mh * .5);
  const grund = HOCH[f.idx] + NEIG[f.idx] * klemmen(f.d, -RANDW, RANDW), hy = f.y - grund;   // Hügel ganz folgen, Sprüngen nur gedämpft
  ziel3.set(f.x - fx * 7.6, grund + hy * .6 + 3.5, f.z - fz * 7.6);
  if (sofort) kamPos.copy(ziel3); else kamPos.lerp(ziel3, 1 - Math.exp(-dt * 7));
  cam.position.copy(kamPos);
  if (wackeln > 0) cam.position.add(v3.set((Math.random() - .5) * wackeln * .9, (Math.random() - .5) * wackeln * .6, (Math.random() - .5) * wackeln * .9));
  blick.set(f.x + fx * 6, grund + hy * .7 + 1.3, f.z + fz * 6);
  cam.lookAt(blick);
  const fov = 62 + (f.boost > 0 ? 9 : 0) + Math.min(4, f.v / 8);
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix();
  sonne.position.set(f.x - 30, 60, f.z + 25); sonne.target.position.set(f.x, 0, f.z);
  if (laterne.intensity) laterne.position.set(f.x + fx * 4, f.y + 4.5, f.z + fz * 4);
}

const v3 = new THREE.Vector3();
let hudTakt = 0;
function hud(dt) {
  karts.forEach((k, n) => {
    const c = $("punkte").children[n]; c.setAttribute("cx", mx(k.x).toFixed(1)); c.setAttribute("cy", mz(k.z).toFixed(1));
    c.style.display = k.g.visible && !(k.unsicht > 0 && !k.ich) ? "" : "none";
    if (k.tag) {
      v3.set(k.x, k.y + (k.krone ? 3.6 : 2.8), k.z).project(cam);
      const sichtbar = k.g.visible && !(k.unsicht > 0) && v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 && Math.hypot(k.x - fokusKart().x, k.z - fokusKart().z) < 120 && k !== fokusKart();
      k.tag.style.display = sichtbar ? "" : "none";
      if (sichtbar) { k.tag.style.left = (v3.x + 1) / 2 * innerWidth + "px"; k.tag.style.top = (1 - v3.y) / 2 * innerHeight + "px"; }
    }
  });
  $("lenkrad").style.transform = `rotate(${ein.lenk * 90}deg)`;
  extraHud(dt);
  hudTakt -= dt; if (hudTakt > 0) return; hudTakt = .1;
  if (zuschauer) zuschauLeiste();
  const kk = $("kkraft"); kk.style.setProperty("--k", ich.kraft.toFixed(3)); kk.classList.toggle("voll", ich.kraft >= 1);
  $("gold").innerHTML = `<i></i>${ich.gold}`;
  $("uhr").textContent = zeitText(ich.fertig ?? uhr);
  $("runde").textContent = `Runde ${Math.min(RUNDEN, Math.max(1, ich.runden.length + 1))}/${RUNDEN}`;
  $("platz").innerHTML = karts.length > 1 ? `${ich.krone ? "👑" : ""}${platzVon(ich)}<small>. Platz${ich.rw > 1 ? " 🍃" : ""}</small>` : `<small>Testfahrt</small>`;
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
  if (zuschauer && !rennenVorbei) { zuschauLeiste(); return; }
  if (zuschauer) { zuschauer = false; $("hud").classList.remove("zuschauer"); zuschauLeiste(); }
  const bestRunde = ich.runden.length ? Math.min(...ich.runden) : 0, mehr = karts.length > 1;
  const p = ich.fertig != null ? platzVon(ich) : null;
  let h = `<h1>${ich.aufgegeben ? "Aufgegeben" : (mehr ? `${p}. Platz` : "Im Ziel") + (zielInfo && zielInfo.rekord ? " · neue Bestzeit!" : "")}</h1>`;
  if (fz) h += `<p class="leise">Feldzug · Rennen ${fz.nr + 1} von 3: ${esc(WELTEN[welt].name)}${fluch ? ` · <span class="fluchschild">${FLUECHE[fluch].bild} ${FLUECHE[fluch].name}</span>` : ""}</p>`;
  h += `<div class="zeile" style="align-items:flex-start;gap:28px"><table>`;
  if (ich.fertig != null) {
    h += ich.runden.map((t, i) => `<tr><td>Runde ${i + 1}</td><td><b>${zeitText(t)}</b>${t === bestRunde ? " ⚡" : ""}</td></tr>`).join("") + `<tr><td>Gesamt</td><td><b>${zeitText(ich.fertig)}</b></td></tr>`;
    if (zielInfo && zielInfo.alt && !zielInfo.rekord) h += `<tr><td class="leise">Bestzeit</td><td class="leise">${zeitText(zielInfo.alt)}</td></tr>`;
  }
  h += `</table>`;
  if (mehr) {
    const fertig = liste.filter(e => e.zeit != null), rest = karts.filter(k => !fertig.some(e => e.id === k.id)).sort((a, b) => b.prog - a.prog);
    const pkt = n => fz ? `<td class="plus">+${FZ_PUNKTE[n] || 0}</td>` : "";
    h += `<table>${fertig.map((e, i) => `<tr><td>${i + 1}.</td><td>${e.id === PID ? "<b>Du</b>" : esc(e.name)}</td><td>${icon(e.typ)}</td><td class="leise">${zeitText(e.zeit)}</td>${pkt(i)}</tr>`).join("")}
      ${rest.map(k => `<tr><td></td><td>${k.ich ? "<b>Du</b>" : esc(k.name)}</td><td>${icon(k.typ)}</td><td class="leise">${liste.some(e => e.id === k.id) ? "aufgegeben" : rennenVorbei ? "–" : "fährt noch …"}</td>${fz ? "<td></td>" : ""}</tr>`).join("")}</table>`;
  }
  h += `</div>`;
  if (fz && fz.nr > 0) h += `<div><b class="etikett">Gesamtwertung vor diesem Rennen</b>${fzTabelle(false)}</div>`;
  if (!fz) h += `<p class="leise">Strecke ${planCode(plan)}: ${abschnitte.map(a => esc(a.name)).join(" · ")}</p>`;
  const nochWer = karts.some(k => k !== ich && k.fertig == null && k.g.visible && !liste.some(e => e.id === k.id));
  const schauen = nochWer && !rennenVorbei ? `<button class="los zweit klein" id="schauen">👀 Zuschauen</button> ` : "";
  const fertigGenug = modus === "allein" ? true : rennenVorbei;
  h += `<div class="zeile" style="justify-content:space-between">`;
  if (fz) {
    const weiterText = fz.nr >= 2 ? "Zur Siegerehrung 🏆" : `Weiter: Rennen ${fz.nr + 2} von 3`;
    if (modus === "client") h += `<button class="zurueck knopflos" id="verlassen">Raum verlassen</button><span>${schauen}<span class="leise">${esc(hostName())} macht weiter.</span></span>`;
    else h += `<button class="zurueck knopflos" id="${modus === "host" ? "verlassen" : "zumMenue"}">${modus === "host" ? "Raum schließen" : "Feldzug abbrechen"}</button><span>${schauen}${fertigGenug ? `<button class="los" id="fzweiter">${weiterText}</button>` : `<span class="leise">Warte, bis alle im Ziel sind …</span>`}</span>`;
  }
  else if (modus === "allein") h += `<a class="zurueck" href="../">‹ Spielauswahl</a><span>${schauen}<button class="los zweit" id="zumMenue">Einstellungen</button> <button class="los zweit" id="gleich">Gleiche Strecke</button> <button class="los" id="nochmal">Neue Strecke</button></span>`;
  else if (modus === "host") h += `<button class="zurueck knopflos" id="verlassen">Raum schließen</button><span>${schauen}<button class="los zweit" id="zurLobby">Zur Lobby</button> <button class="los zweit" id="gleich">Gleiche Strecke</button> <button class="los" id="nochmal">Neue Strecke</button></span>`;
  else h += `<button class="zurueck knopflos" id="verlassen">Raum verlassen</button><span>${schauen}<span class="leise">${esc(hostName())} startet das nächste Rennen.</span></span>`;
  h += `</div>`;
  $("ziel").classList.remove("ehrung");
  $("zielKasten").innerHTML = h; $("ziel").hidden = false;
  if ($("nochmal")) $("nochmal").onclick = () => modus === "allein" ? alleinStarten() : rennenStarten();
  if ($("gleich")) $("gleich").onclick = () => modus === "allein" ? alleinStarten(true) : rennenStarten(true);
  if ($("zumMenue")) $("zumMenue").onclick = () => { fz = null; menue("start"); };
  if ($("zurLobby")) $("zurLobby").onclick = () => { lobbyPhase = "lobby"; lobbySenden(); menue("lobby"); };
  if ($("verlassen")) $("verlassen").onclick = verlassen;
  if ($("schauen")) $("schauen").onclick = () => zuschauen(true);
  if ($("fzweiter")) $("fzweiter").onclick = fzWeiter;
}

// ---------- Feldzug: drei Rennen (Kerker, Grotte, Glutschlund), Punkte nach Platz, Flüche, Siegerehrung ----------
const FZ_WELTEN = ["kerker", "grotte", "glut"], FZ_PUNKTE = [10, 8, 6, 5, 4, 3, 2, 1];
let wahlModus = lager.lesen("kart:modus") === "feldzug" ? "feldzug" : "rennen";
let wahlRunden = [2, 3, 4].includes(+lager.lesen("kart:runden")) ? +lager.lesen("kart:runden") : 3;
let wahlAusgleich = ["aus", "sanft", "stark"].includes(lager.lesen("kart:ausgleich")) ? lager.lesen("kart:ausgleich") : "sanft";
const AUSGLEICH = { aus: "Aus", sanft: "Sanft", stark: "Stark" };
const AUSGLEICH_TEXT = {
  aus: "Alle fahren unter gleichen Bedingungen.",
  sanft: "Hinten beißt kein Mimik, der Letzte hat leichten Rückenwind, der Erste trägt die Krone.",
  stark: "Wie Sanft, dazu Aufhol-Extras, mildere Treffer und eine goldene Truhe in der letzten Runde."
};
function ausgleichWahl() { return Object.entries(AUSGLEICH).map(([m, t]) => `<button class="wahl ${wahlAusgleich === m ? "an" : ""}" data-ausgl="${m}">${t}</button>`).join(""); }
let fz = null, fluchTimer = null;      // fz: { nr, punkte, leute, letzte, waehler, angebot } – der Spielleiter (oder allein) rechnet, alle anderen bekommen eine Kopie
const fzNeu = () => ({ nr: 0, punkte: {}, leute: {}, letzte: {} });
function fzPlan(f) { const p = planWuerfeln(FZ_WELTEN[fz.nr] || "kerker"); if (f) p.f = f; return p; }
// Reihenfolge des Rennens: erst die im Ziel, dann die noch fahren (nach Fortschritt), zuletzt wer aufgegeben hat
function rennReihenfolge() {
  const fertig = liste.filter(e => e.zeit != null).map(e => e.id), auf = id => liste.some(e => e.id === id) ? 1 : 0;
  return [...fertig, ...karts.filter(k => !fertig.includes(k.id)).sort((a, b) => auf(a.id) - auf(b.id) || b.prog - a.prog).map(k => k.id)];
}
function fzTabelle(mitPlus) {
  const ids = Object.keys(fz.punkte).sort((a, b) => fz.punkte[b] - fz.punkte[a]);
  if (!ids.length) return "";
  return `<table class="wertung">${ids.map((id, i) => { const l = fz.leute[id] || {}; return `<tr class="${id === PID ? "ich" : ""}"><td>${i + 1}.</td><td>${icon(l.typ)}</td><td>${id === PID ? "<b>Du</b>" : esc(l.name || "?")}</td>${mitPlus ? `<td class="plus">+${fz.letzte[id] || 0}</td>` : ""}<td class="pkt">${fz.punkte[id]} P.</td></tr>`; }).join("")}</table>`;
}
function fzSenden() { if (modus === "host") anAlle({ t: "fz", nr: rennNr, fz }); }
// Spielleiter oder allein: Rennen werten, dann Fluch wählen lassen oder Siegerehrung
function fzWeiter() {
  if (!fz || modus === "client" || !karts.length) return;
  if (fz.gewertet !== fz.nr) {
    fz.gewertet = fz.nr; fz.letzte = {};
    rennReihenfolge().forEach((id, i) => {
      const k = karts.find(o => o.id === id); if (!k) return;
      fz.leute[id] = { name: k.name, typ: k.typ, bot: !!k.bot, farbe: k.farbe };
      fz.punkte[id] = (fz.punkte[id] || 0) + (FZ_PUNKTE[i] || 0); fz.letzte[id] = FZ_PUNKTE[i] || 0;
    });
  }
  if (fz.nr >= 2) { fz.ende = true; fzSenden(); ehrungZeigen(); return; }
  // der letzte Mensch dieses Rennens sucht einen Fluch aus (3 zur Wahl)
  const menschen = rennReihenfolge().filter(id => fz.leute[id] && !fz.leute[id].bot);
  fz.waehler = menschen[menschen.length - 1] || PID;
  fz.angebot = Object.keys(FLUECHE).sort(() => Math.random() - .5).slice(0, 3);
  fz.wahl = true;
  fzSenden(); fluchWahlZeigen();
  clearTimeout(fluchTimer); fluchTimer = setTimeout(() => { if (fz && fz.wahl) fluchGewaehlt(fz.angebot[Math.floor(Math.random() * 3)]); }, 25000);
}
function fluchWahlZeigen() {
  phase = "fluch"; zuschauer = false; $("hud").classList.remove("zuschauer"); zuschauLeiste();
  const ich_ = fz.waehler === PID, w = fz.leute[fz.waehler] || { name: "?" };
  let h = `<h1>Rennen ${fz.nr + 1} von 3 ist vorbei</h1><div class="zeile" style="align-items:flex-start;gap:24px"><div><b class="etikett">Gesamtwertung</b>${fzTabelle(true)}</div><div class="stapel" style="flex:1;min-width:240px">`;
  h += `<b class="etikett">Als Nächstes: ${esc(WELTEN[FZ_WELTEN[fz.nr + 1]].name)}</b>`;
  if (ich_) h += `<p style="margin:0"><b>Du warst Letzter.</b> Dafür darfst du das nächste Rennen verfluchen:</p><div class="fluchwahl">${fz.angebot.map(f => `<button class="fluch" data-fluch="${f}"><span class="bild">${FLUECHE[f].bild}</span><b>${FLUECHE[f].name}</b>${FLUECHE[f].text}</button>`).join("")}</div>`;
  else h += `<p class="warte">${icon(w.typ)} ${esc(w.name)} war Letzter und sucht einen Fluch für das nächste Rennen aus …</p><div class="fluchwahl">${fz.angebot.map(f => `<div class="fluch" style="cursor:default"><span class="bild">${FLUECHE[f].bild}</span><b>${FLUECHE[f].name}</b></div>`).join("")}</div>`;
  h += `</div></div>`;
  if (modus === "host") h += `<div class="zeile"><button class="zurueck knopflos" id="verlassen">Raum schließen</button></div>`;
  $("ziel").classList.remove("ehrung");
  $("zielKasten").innerHTML = h; $("ziel").hidden = false;
  document.querySelectorAll("[data-fluch]").forEach(b => b.onclick = () => {
    const f = b.dataset.fluch;
    if (modus === "client") { senden({ t: "fluch", pid: PID, f }); document.querySelectorAll("[data-fluch]").forEach(x => x.disabled = true); b.style.background = "#F2C14E"; }
    else fluchGewaehlt(f);
  });
  if ($("verlassen")) $("verlassen").onclick = verlassen;
}
// Spielleiter oder allein: nächstes Rennen mit dem Fluch starten
function fluchGewaehlt(f) {
  if (!fz || !fz.wahl || !FLUECHE[f]) return;
  clearTimeout(fluchTimer); fz.wahl = false; fz.nr++;
  const p = fzPlan(f);
  if (modus === "allein") { countdownStarten(alleinRaster(), p); }
  else rennenStarten(false, p);
}
function feldzugStarten() {
  fz = fzNeu(); fz.monster = monsterRaster(wahlGegner);         // dieselben Monster in allen drei Rennen
  if (modus === "allein") countdownStarten(alleinRaster(), fzPlan(null));
  else rennenStarten(false, fzPlan(null));
}

// ---------- Siegerehrung: Podest, der Knochenkönig überreicht schlecht gelaunt den Pokal ----------
let ehrung = null;
function ehrungWeg() { if (!ehrung) return; sc.remove(ehrung.g); entsorgen(ehrung.g); ehrung = null; $("ziel").classList.remove("ehrung"); cam.clearViewOffset(); laterne.intensity = fluch === "nacht" ? 40 : 0; }
function ehrungZeigen() {
  ehrungWeg(); clearTimeout(fluchTimer);
  phase = "ehrung"; zuschauer = false; $("hud").classList.remove("zuschauer"); zuschauLeiste();
  $("hud").hidden = true; objekteLeeren();
  karts.forEach(k => { k.g.visible = false; k.schatten.visible = false; if (k.tag) k.tag.style.display = "none"; });
  const ids = Object.keys(fz.punkte).sort((a, b) => fz.punkte[b] - fz.punkte[a]);
  const i0 = meter(30), O = new THREE.Vector3(PX[i0], 0, PZ[i0]), rot = Math.atan2(TX[i0], TZ[i0]), nx = nX(i0), nz = nZ(i0);
  const g = new THREE.Group(); sc.add(g);
  const am = (d, y = 0) => new THREE.Vector3(O.x + nx * d, y, O.z + nz * d);
  const stufen = [[0, 2.4, "#E8B53A", "1"], [-3.4, 1.6, "#C9CED6", "2"], [3.4, 1, "#C98A4A", "3"]];
  const sieger = [];
  stufen.forEach(([d, h, farbe, z], n) => {
    const b = new THREE.Mesh(box(3.2, h, 3.2), schildMat(z, farbe, "#2A1A12", 128, 128)); const p = am(d, h / 2); b.position.copy(p); b.rotation.y = rot; b.castShadow = b.receiveShadow = true; g.add(b);
    const id = ids[n]; if (!id) return;
    const l = fz.leute[id] || { typ: "kaempfer", name: "?" }, m = new Kart(l.typ, l.name, false, l.farbe);
    sc.remove(m.g); sc.remove(m.schatten); m.g.position.copy(am(d, h)); m.g.rotation.y = rot; g.add(m.g); sieger.push(m.g);
  });
  const { g: kg, arm } = knochenKoenigMesh(); kg.position.copy(am(7.6)); kg.rotation.y = rot - .5; kg.scale.setScalar(.8); g.add(kg);
  const pokal = new THREE.Group(); teil(pokal, zyl(.5, .2, .8, 12), "#E8C24A", 0, .9, 0); teil(pokal, zyl(.15, .15, .4, 8), "#E8C24A", 0, .35, 0); teil(pokal, zyl(.35, .35, .12, 12), "#E8C24A", 0, .1, 0);
  for (const x of [-1, 1]) teil(pokal, new THREE.TorusGeometry(.22, .05, 6, 12), "#E8C24A", x * .55, .95, 0, 0, Math.PI / 2, 0);
  g.add(pokal);
  const sch = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), scheinMat); sch.rotation.x = -Math.PI / 2; sch.position.copy(am(1.5, .15)); g.add(sch);
  ehrung = { g, O, rot, arm, pokal, kg, t: 0, sieger, start: am(7.6, 3.4), ziel: am(0, 2.4 + 2.6) };
  // Tafel
  const ich_ = ids.indexOf(PID);
  let h = `<h1>🏆 Siegerehrung</h1><div class="sprechblase">„Hmpf. Na schön. Hier ist euer Pokal. Freut euch nicht zu sehr.“<br><small class="leise">– der Knochenkönig</small></div>`;
  h += `<p style="margin:0">${ich_ === 0 ? "<b>Du gewinnst den Feldzug!</b>" : ich_ > 0 ? `Du bist <b>${ich_ + 1}.</b>` : ""}</p>${fzTabelle(true)}<div class="zeile" style="justify-content:space-between">`;
  if (modus === "client") h += `<button class="zurueck knopflos" id="verlassen">Raum verlassen</button><span class="leise">${esc(hostName())} entscheidet, wie es weitergeht.</span>`;
  else if (modus === "host") h += `<button class="zurueck knopflos" id="verlassen">Raum schließen</button><span><button class="los zweit klein" id="zurLobby">Zur Lobby</button> <button class="los klein" id="neuFz">Neuer Feldzug</button></span>`;
  else h += `<button class="zurueck knopflos" id="zumMenue">Einstellungen</button><button class="los klein" id="neuFz">Neuer Feldzug</button>`;
  h += `</div>`;
  $("ziel").classList.add("ehrung"); $("zielKasten").innerHTML = h; $("ziel").hidden = false;
  if ($("verlassen")) $("verlassen").onclick = verlassen;
  if ($("zurLobby")) $("zurLobby").onclick = () => { fz = null; ehrungWeg(); lobbyPhase = "lobby"; lobbySenden(); menue("lobby"); };
  if ($("zumMenue")) $("zumMenue").onclick = () => { fz = null; ehrungWeg(); menue("start"); };
  if ($("neuFz")) $("neuFz").onclick = () => { ehrungWeg(); feldzugStarten(); };
}
function ehrungSchritt(dt) {
  const E = ehrung; if (!E) return;
  E.t += dt;
  const t = E.t, f = Math.min(1, Math.max(0, (t - 2) / 1.6)), e = f * f * (3 - 2 * f);
  E.arm.rotation.z = t < 2 ? Math.min(1, t) * 1.3 : 1.3 * (1 - e);                 // erst hochhalten, dann widerwillig abgeben
  E.pokal.position.lerpVectors(E.start, E.ziel, e); E.pokal.position.y += Math.sin(e * Math.PI) * 2.5; E.pokal.rotation.y = t * 1.5;
  E.kg.rotation.z = Math.sin(t * 1.3) * .03;
  E.sieger.forEach((s, n) => s.position.y += Math.sin(t * 6 + n) * .004);
  const w = Math.sin(t * .25) * .5, d = 15, nx = Math.sin(E.rot + w), nz = Math.cos(E.rot + w);
  cam.position.set(E.O.x + nx * d + nX(meter(30)) * 1.5, 5.5, E.O.z + nz * d + nZ(meter(30)) * 1.5); cam.lookAt(E.O.x + nX(meter(30)) * 1.5, 2.6, E.O.z + nZ(meter(30)) * 1.5);
  if (cam.fov !== 55) cam.fov = 55;
  const breit = innerWidth > 700;                       // die Tafel steht rechts: Bild nach links schieben
  cam.setViewOffset(innerWidth, innerHeight, breit ? innerWidth * .2 : 0, 0, innerWidth, innerHeight);
  sonne.position.set(E.O.x - 30, 60, E.O.z + 25); sonne.target.position.copy(E.O);
  laterne.intensity = 140; laterne.position.set(E.O.x + Math.sin(E.rot) * 6, 9, E.O.z + Math.cos(E.rot) * 6);
}

// ---------- Steuerung vorbereiten ----------
let sensorGefragt = false;
async function sensorErlauben() {      // muss direkt aus einem Tippen heraus kommen (iPhone)
  if (steuerung !== "neigen" || sensorGefragt) return;
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    try { const a = await DeviceOrientationEvent.requestPermission(); sensorGefragt = a === "granted";
      if (sensorGefragt && typeof DeviceMotionEvent !== "undefined" && DeviceMotionEvent.requestPermission) DeviceMotionEvent.requestPermission().catch(() => {}); if (!sensorGefragt) { steuerung = "tasten"; alert("Ohne Erlaubnis für den Bewegungssensor geht Neigen nicht. Ich schalte auf Tasten um."); } }
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
// Plan aus dem Netz prüfen (sonst würfeln)
function planPruefen(p) {
  const q = p && planAusCode(planCode({ w: p.w, v: Array.isArray(p.v) ? p.v : [], s: +p.s || 0 })) || planWuerfeln(wahlWelt);
  if (p && FLUECHE[p.f]) q.f = p.f;
  return q;
}
function countdownStarten(raster, p) {
  if (!raster.some(e => e.id === PID)) { menue("lobby"); return; }      // bin nicht dabei (zu spät gekommen)
  ehrungWeg(); zuschauer = false; $("hud").classList.remove("zuschauer"); $("zuschau").hidden = true;
  streckeBauen(planPruefen(p));
  rennenAufbauen(raster);
  hudVorbereiten(); zielInfo = null;
  $("menue").hidden = true; $("ziel").hidden = true; $("pausiert").hidden = true; $("hud").hidden = false;
  phase = "vorschau"; vorschauZeit = VORSCHAU; $("gross").hidden = true;
}
// gleich = dieselbe Strecke noch einmal, sonst eine neue
function alleinStarten(gleich) { modus = "allein"; RUNDEN = TEST_RUNDEN || wahlRunden; if (!(gleich && fz)) fz = null; countdownStarten(alleinRaster(), gleich ? plan : startPlan || planWuerfeln(wahlWelt)); startPlan = null; }
let startPlan = planAusCode(new URLSearchParams(location.search).get("strecke"));   // ?strecke=KERKER-… fährt diese Strecke
// Vorschau: allein mit Antippen überspringen
addEventListener("pointerdown", () => { if (phase === "vorschau" && modus === "allein") vorschauZeit = Math.min(vorschauZeit, .01); });
// Zuschauen: Antippen des Bildes wechselt zum nächsten Fahrer
addEventListener("pointerdown", e => { if (zuschauer && e.target === r.domElement) naechsterBlick(); });
$("zuschauWeiter").onclick = naechsterBlick;
$("zuschauErgebnis").onclick = () => zuschauen(false);

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
  anAlle({ t: "lobby", spieler: lobbyListe(), gegner: wahlGegner, welt: wahlWelt, modus: wahlModus, ausgleich: wahlAusgleich, runden: wahlRunden, phase: lobbyPhase, nr: rennNr });
  if (phase === "menue") menue("lobby");
}

function raumErstellen() {
  code = (ABEND && ABEND.neuerRaum()) || Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
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
  else if (m.t === "ev" && m.nr === rennNr && m.e) { m.e.q = m.pid; anAlle({ t: "ev", nr: rennNr, e: m.e }); anwenden(m.e); }
  else if (m.t === "ziel" && m.nr === rennNr) { eintragen(m.pid, +m.zeit); ergebnisSenden(); }
  else if (m.t === "aufgeben" && m.nr === rennNr) { eintragen(m.pid, null); ergebnisSenden(); }
  else if (m.t === "fluch" && fz && fz.wahl && fz.waehler === m.pid) fluchGewaehlt(m.f);
}
function ergebnisSenden() {
  const menschen = karts.filter(k => !k.bot);
  if (!rennenVorbei && menschen.every(k => liste.some(e => e.id === k.id))) rennenVorbei = true;
  anAlle({ t: "ergebnis", nr: rennNr, liste, vorbei: rennenVorbei });
  zielZeigen();
}
function rennenStarten(gleich, fzP) {
  if (modus !== "host") return;
  if (!fzP && !(gleich && fz)) fz = null;                // ein einzelnes Rennen beendet einen alten Feldzug
  const p = fzP || (gleich && plan ? plan : startPlan || planWuerfeln(wahlWelt)); startPlan = null;
  rennNr++; lobbyPhase = "rennen";
  const menschen = lobbyListe().filter(e => e.online), raster = fz && fz.monster ? fz.monster.slice() : monsterRaster(wahlGegner);
  // Spieler in zufälliger Reihenfolge hinter die Übungsgegner
  menschen.sort(() => Math.random() - .5).forEach((e, n) => raster.push({ id: e.pid, name: e.name, typ: e.typ, farbe: SPIELERFARBEN[n % SPIELERFARBEN.length] }));
  lobbySenden();
  ausgleich = wahlAusgleich; RUNDEN = TEST_RUNDEN || wahlRunden;
  anAlle({ t: "start", nr: rennNr, raster, plan: p, fz, ausgleich, runden: RUNDEN });
  countdownStarten(raster, p);
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
    lobby = m; wahlGegner = m.gegner; if (m.welt) wahlWelt = m.welt; if (m.modus) wahlModus = m.modus; if (AUSGLEICH[m.ausgleich]) wahlAusgleich = m.ausgleich; if ([2, 3, 4].includes(m.runden)) wahlRunden = m.runden;
    if (m.phase === "lobby" && (phase === "ziel" || phase === "menue" || phase === "ehrung" || phase === "fluch")) { fz = null; phase = "menue"; menue("lobby"); }
    else if (phase === "menue") menue("lobby");
  } else if (m.t === "start") { rennNr = m.nr; fz = m.fz || null; ausgleich = AUSGLEICH[m.ausgleich] ? m.ausgleich : "sanft"; RUNDEN = TEST_RUNDEN || ([1, 2, 3, 4].includes(m.runden) ? m.runden : 3); countdownStarten(m.raster, m.plan); }
  else if (m.t === "fz" && m.fz) { fz = m.fz; if (fz.ende) ehrungZeigen(); else if (fz.wahl) fluchWahlZeigen(); }
  else if (m.t === "lauf" && m.nr === rennNr) {
    for (const [id, a] of m.k) { if (id === PID) continue; const k = karts.find(o => o.id === id); if (k && k.remote) k.netzZustand(a); }
  } else if (m.t === "ev" && m.nr === rennNr && m.e && m.e.q !== PID) anwenden(m.e);
  else if (m.t === "ergebnis" && m.nr === rennNr) {
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
    <p class="heldinfo"><b>${h.gefaehrt}</b> · ${h.klasse}: ${h.text}<br>Heldenkraft <b>${KRAEFTE[wahlTyp].name}</b>: ${KRAEFTE[wahlTyp].text}</p></div>`;
}
const WELT_NAMEN = { kerker: "🏰 Kerker", grotte: "🕷️ Grotte", glut: "🌋 Glutschlund", zufall: "🎲 Zufall" };
function modusWahl() { return [["rennen", "🏁 Ein Rennen"], ["feldzug", "⚔️ Feldzug (3 Rennen)"]].map(([m, t]) => `<button class="wahl ${wahlModus === m ? "an" : ""}" data-modus="${m}">${t}</button>`).join(""); }
const weltZeile = host => wahlModus === "feldzug" ? `<p class="leise">Feldzug: Kerker → Spinnengrotte → Glutschlund. Punkte nach Platz, der Letzte verflucht das nächste Rennen, am Ende Siegerehrung.</p>`
  : host ? `<div class="zeile"><b>Welt</b>${weltWahl()}</div>` : `<p class="leise">Welt: ${WELT_NAMEN[wahlWelt] || "Zufall"}</p>`;
// Gemeinsamer Abend (../abend.js): Der Abendleiter öffnet den Raum, die anderen folgen ihm von selbst
const ABEND = window.ABEND && window.ABEND.aktiv ? window.ABEND : null;
function weltWahl() { return Object.entries(WELT_NAMEN).map(([w, t]) => `<button class="wahl ${wahlWelt === w ? "an" : ""}" data-welt="${w}">${t}</button>`).join(""); }
function lenkWahl() {
  return `<button class="wahl ${steuerung === "neigen" ? "an" : ""}" data-st="neigen">📱 Neigen</button><button class="wahl ${steuerung === "tasten" ? "an" : ""}" data-st="tasten">◀ ▶ Tasten</button>`;
}
function menue(a) {
  ansicht = a; phase = "menue"; ehrungWeg(); zuschauer = false; $("zuschau").hidden = true;
  $("menue").hidden = false; $("ziel").hidden = true; $("pausiert").hidden = true; $("hud").hidden = true;
  let h = "";
  if (a === "start") {
    const best = +lager.lesen("kart:best:" + wahlTyp);
    h = `<div class="zeile" style="justify-content:space-between;align-items:baseline"><h1>Kerker-<span>Kart</span></h1><p class="leise">Testversion: Kerker, Spinnengrotte und Glutschlund, 3 Runden, bis zu 8 Leute</p></div>
      <div class="spalten"><div class="stapel">
        <label class="zeile namenszeile"><b>Name</b><input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
        ${heldWahl()}
        <div class="zeile"><b>Lenken</b>${lenkWahl()}</div>
        <div class="zeile"><b>Modus</b>${modusWahl()}</div>
        ${weltZeile(true)}
        ${best ? `<p class="leise">Deine Bestzeit als ${HELDEN[wahlTyp].name}: ${zeitText(best)}</p>` : ""}
      </div><div class="stapel">
        ${ABEND ? `<div class="box"><b class="titelchen">Gemeinsamer Abend</b>${ABEND.leiter ? `<p class="leise">Wähle Held und Modus, dann öffne den Raum. Die anderen kommen von selbst dazu.</p><button class="los" id="erstellen">Raum öffnen</button>` : `<p class="warte">${esc(ABEND.warten())}</p>`}</div>` : `
        <div class="box"><b class="titelchen">Zusammen fahren</b><button class="los" id="erstellen">Raum erstellen</button>
          <div class="zeile"><input id="code" maxlength="4" autocapitalize="characters" placeholder="Code" value="${esc(code)}"><button class="los zweit" id="beitreten">Beitreten</button></div></div>
        <div class="box"><b class="titelchen">Allein üben</b><div class="zeile">${[3, 5, 0].map(n => `<button class="wahl ${wahlGegner === n || (n === 3 && wahlGegner && wahlGegner !== 5) ? "an" : ""}" data-geg="${n}">${n ? n + " Monster" : "ohne"}</button>`).join("")}<button class="los zweit" id="allein">Los</button></div></div>`}
      </div></div>
      <div class="zeile" style="justify-content:space-between">${ABEND ? (ABEND.leiter ? `<button class="zurueck knopflos" id="zumAbend">‹ Zurück zum Abend</button>` : "<span></span>") : `<a class="zurueck" href="../">‹ Spielauswahl</a>`}<span class="leise">Am Computer: Pfeiltasten, Leertaste = Drift, E = Extra, R = Heldenkraft</span></div>`;
  } else if (a === "einladung") {
    h = `<div><h1>Kerker-<span>Kart</span></h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></div>
      <div class="stapel">
        <label class="zeile namenszeile"><b>Name</b><input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
        ${heldWahl()}
        <div class="zeile"><b>Lenken</b>${lenkWahl()}</div>
      </div>
      <div class="zeile" style="justify-content:space-between">${ABEND ? `<span class="leise">Gemeinsamer Abend: Held wählen, dann Mitfahren.</span>` : `<button class="zurueck knopflos" id="abbrechen">‹ Abbrechen</button>`}<button class="los" id="mitfahren">Mitfahren</button></div>`;
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
        ${host ? `<div class="zeile"><b>Modus</b>${modusWahl()}</div>` : `<p class="leise">Modus: ${wahlModus === "feldzug" ? "Feldzug (3 Rennen)" : "ein Rennen"}</p>`}
        ${weltZeile(host)}
        ${host ? `<div class="zeile"><b>Runden</b>${[2, 3, 4].map(n => `<button class="wahl ${wahlRunden === n ? "an" : ""}" data-runden="${n}">${n}</button>`).join("")}</div>` : `<p class="leise">Runden: ${wahlRunden}</p>`}
        ${host ? `<div class="zeile"><b>Ausgleich</b>${ausgleichWahl()}</div><p class="leise">${AUSGLEICH_TEXT[wahlAusgleich]}</p>` : `<p class="leise">Ausgleich: ${AUSGLEICH[wahlAusgleich]}. ${AUSGLEICH_TEXT[wahlAusgleich]}</p>`}
        ${host ? `<div class="zeile"><b>Monster</b>${[0, 1, 2, 3, 4, 5].map(n => `<button class="wahl ${wahlGegner === n ? "an" : ""}" data-geg="${n}">${n}</button>`).join("")}</div>` : `<p class="leise">Monster als Gegner: ${wahlGegner}</p>`}
        ${host ? `<button class="los" id="rennstart">${wahlModus === "feldzug" ? "Feldzug starten" : "Rennen starten"}</button>` : `<p class="warte">${lobby && lobby.phase === "rennen" ? "Ein Rennen läuft gerade. Beim nächsten bist du dabei." : `Warte, bis ${esc(hostName())} das Rennen startet …`}</p>`}
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
  document.querySelectorAll("[data-welt]").forEach(b => b.onclick = () => {
    nameMerken(); wahlWelt = b.dataset.welt; lager.schreiben("kart:welt", wahlWelt);
    // Hintergrund im Menü zeigt die gewählte Welt
    if (phase === "menue" && wahlWelt !== "zufall" && welt !== wahlWelt) { streckeBauen(planWuerfeln(wahlWelt)); rennenAufbauen(alleinRaster()); }
    if (modus === "host") lobbySenden(); else menue(ansicht);
  });
  document.querySelectorAll("[data-geg]").forEach(b => b.onclick = () => { nameMerken(); wahlGegner = +b.dataset.geg; lager.schreiben("kart:gegner", wahlGegner); if (modus === "host") lobbySenden(); else menue(ansicht); });
  const klick = (id, f) => { if ($(id)) $(id).onclick = f; };
  document.querySelectorAll("[data-runden]").forEach(b => b.onclick = () => { nameMerken(); wahlRunden = +b.dataset.runden; lager.schreiben("kart:runden", wahlRunden); if (modus === "host") lobbySenden(); else menue(ansicht); });
  document.querySelectorAll("[data-ausgl]").forEach(b => b.onclick = () => { nameMerken(); wahlAusgleich = b.dataset.ausgl; lager.schreiben("kart:ausgleich", wahlAusgleich); if (modus === "host") lobbySenden(); else menue(ansicht); });
  document.querySelectorAll("[data-modus]").forEach(b => b.onclick = () => { nameMerken(); wahlModus = b.dataset.modus; lager.schreiben("kart:modus", wahlModus); if (modus === "host") lobbySenden(); else menue(ansicht); });
  klick("allein", async () => { if (!nameAus()) return; await sensorErlauben(); if (wahlModus === "feldzug") { modus = "allein"; feldzugStarten(); } else alleinStarten(); });
  klick("zumAbend", () => ABEND.zurueck());
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
  klick("rennstart", async () => { await sensorErlauben(); if (wahlModus === "feldzug") feldzugStarten(); else rennenStarten(); });
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
$("pause").onclick = () => { tonKnopf(); pause(true); };
$("tonknopf").onclick = () => { tonAn = !tonAn; lager.schreiben("kart:ton", tonAn ? "an" : "aus"); tonKnopf(); if (tonAn) klang("pling"); };
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
  } else if (phase === "ehrung") ehrungSchritt(dt);
  else if (phase !== "pause") {
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
streckeBauen(startPlan || planWuerfeln(wahlWelt));
rennenAufbauen(alleinRaster());
const gespeichert = ss.get("kart:host");
if (typeof Peer === "undefined") { menue("start"); netzStatus("Die Verbindungsbibliothek fehlt: zusammen fahren geht gerade nicht."); }
else if (code && gespeichert && gespeichert.code === code) { wahlGegner = gespeichert.gegner ?? wahlGegner; hostStarten(); }
else if (code) menue("einladung");
else menue("start");
requestAnimationFrame(loop);
window.KART = { get phase() { return phase; }, get ich() { return ich; }, karts: () => karts, ein, S, get LAENGE() { return LAENGE; }, get liste() { return liste; }, get modus() { return modus; },
  sim(sek) { for (let t = 0; t < sek; t += 1 / 60) { update(1 / 60); } }, aufbauen: rennenAufbauen, cam, sc, r, THREE, streckeBauen, planWuerfeln, planCode, get plan() { return plan; }, get strecke() { return { wege, abschnitte, gabeln, loren, troll, pendel, pfosten, rattenStellen, koenig, rampen, pilzSprung, tropfen, schluchten, haengebruecken, welt, geysire, geysirSprung, pfade, spalten, lavaHoch }; }, SCHLUCHT, absturz, PX, PZ, set uhr(v) { uhr = v; }, objekte, extraNutzen, kisten, treffen, versetzen, anwenden, ereignis, schritte(sek) { for (let t = 0; t < sek; t += 1 / 30) { update(1 / 30); karts.forEach(k => k.zeigen(performance.now())); hud(1 / 30); } }, neigung: () => neigung, lenkWert, kraftNutzen, muenzen, wirkung, set steuerung(v) { steuerung = v; }, get fz() { return fz; }, fzWeiter, fluchGewaehlt, ehrungZeigen, zuschauen, get zuschauer() { return zuschauer; }, get fluch() { return fluch; }, get ausgleich() { return ausgleich; }, set ausgleich(v) { ausgleich = v; }, menschLage, hinten, platzVon, truheNehmen, get liste() { return liste; }, set testKamera(v) { testKamera = v; }, HOCH, NEIG, STEIG, WEG, WEG_L, WEG_R, LOCH, GLEIT, BELAG, get gleitstellen() { return gleitstellen; }, get aufwinde() { return aufwinde; }, get strudel() { return strudel; }, get runen() { return runen; }, hoehe, hoeheAn,
  get zf() { return zf; }, get zfPlan() { return zfPlan; }, get staende() { return staende; }, get hebel() { return hebel; }, get leuchter() { return leuchter; }, get publikum() { return publikum; }, get skelettRand() { return skelettRand; }, get fledRand() { return fledRand; }, get faesserRoll() { return faesserRoll; }, get wege() { return wege; }, get tonAn() { return tonAn; }, zufallStart, sperreSetzen, leuchterFall, hebelZiehen, set RUNDEN(v) { RUNDEN = v; }, get ueberfuehrungen() { return ueberfuehrungen; }, UEBER };
