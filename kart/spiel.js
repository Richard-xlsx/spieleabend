// Kerker-Kart (Arbeitstitel): Die Helden aus Dungeons & Disappointments fahren durch den Kerker.
// Lenken durch Neigen des Handys im Querformat (wie ein Lenkrad) oder mit Tasten. Konzept: KONZEPT.md
import * as THREE from "three";
import { ABSCHNITTE, planWuerfeln, planCode, planAusCode, kontrollpunkte, rng } from "./strecke.js?v=2026-11-20e";

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
  paladin: { name: "Paladin", gefaehrt: "Panzerlore", klasse: "schwer", text: "Treffer werfen ihn nur halb so lang aus der Bahn", maxV: 27, accel: 12.5, turn: 1.8, grip: 11.5, drift: 1.3, masse: 1.7 },
  dieb: { name: "Dieb", gefaehrt: "geklauter Handkarren", klasse: "leicht", text: "flink und wendig, erkennt Mimik-Truhen", maxV: 26, accel: 17, turn: 2.2, grip: 9.5, drift: 1.55, masse: .8 },
  waldlaeufer: { name: "Waldläufer", gefaehrt: "Baumstamm-Renner", klasse: "mittel", text: "Geröll bremst ihn kaum", maxV: 27, accel: 14, turn: 1.95, grip: 10, drift: 1.35, masse: 1, gelaende: .82 },
  magierin: { name: "Magierin", gefaehrt: "fliegender Teppich", klasse: "leicht", text: "sehr schnell, schwebt über Pfützen und Krähenfüße, rutscht in Kurven", maxV: 28.5, accel: 13.5, turn: 1.85, grip: 6.5, drift: 1.35, masse: .8 },
  heilerin: { name: "Heilerin", gefaehrt: "Kräuterkarren", klasse: "mittel", text: "nach Treffern schnell wieder auf Tempo", maxV: 27, accel: 15, turn: 1.95, grip: 10, drift: 1.4, masse: 1 },
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
// Die Strecke wird vor jedem Rennen aus Abschnitten neu gebaut (Varianten in strecke.js). Alles, was zur Strecke gehört,
// hängt an streckeG und wird beim nächsten Bau weggeräumt. Positionen auf der Strecke: Index i (0 … S-1) und Seitenabstand d.
const S = 3000;
const PX = new Float32Array(S), PZ = new Float32Array(S), TX = new Float32Array(S), TZ = new Float32Array(S);
const MAUERW = new Float32Array(S).fill(MAUER);     // Abstand der Mauer je Streckenpunkt (auf der Brücke schmaler)
const BELAG = new Uint8Array(S);                    // 0 Stein, 1 nass (schneller, aber rutschig)
const nX = i => -TZ[i], nZ = i => TX[i];            // Normale (seitlich)
const wrap = i => ((i % S) + S) % S;
const vorab = (i, i0) => wrap(i - i0);              // wie weit liegt i hinter i0, in Fahrtrichtung gezählt
let LAENGE = 1000, SCHRITT = 1 / 3, STRICH = 12;
const meter = m => Math.round(m / SCHRITT);
let plan = null, abschnitte = [], rampen = [], gabeln = [], loren = [], pendel = [], pfosten = [], rattenStellen = [], troll = null, koenig = null;
let streckeG = null, zufall = Math.random, fackeln = [], flammen = [], belegt = [];
const hashf = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };

function hoehe(i, d) {
  if (Math.abs(d) > BR / 2 + 1.3) return 0;
  for (const r of rampen) { const v = vorab(i, r.i0); if (v <= r.n) return r.h * v / r.n; }
  return 0;
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
function bau(i, seite, w, h, d, farbe, schild, gitter) {
  const p = punkt(i, seite * (MAUER + 3 + d / 2));
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
  const geteilt = new Set([...matCache.values(), ...glutCache.values(), scheinMat, ROT_RAND, MUENZ_MAT]);
  g.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) if (!geteilt.has(m)) { if (m.map) m.map.dispose(); m.dispose(); }
  });
}

function streckeBauen(p) {
  plan = p; zufall = rng(p.s * 7 + 13);
  if (streckeG) { sc.remove(streckeG); entsorgen(streckeG); }
  streckeG = new THREE.Group(); sc.add(streckeG);
  const { kp, start } = kontrollpunkte(p);
  const kurve = new THREE.CatmullRomCurve3(kp.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "catmullrom", .5);
  for (let i = 0; i < S; i++) {
    const q = kurve.getPointAt(i / S), t = kurve.getTangentAt(i / S);
    PX[i] = q.x; PZ[i] = q.z; TX[i] = t.x; TZ[i] = t.z;
  }
  LAENGE = kurve.getLength(); SCHRITT = LAENGE / S; STRICH = meter(4);
  MAUERW.fill(MAUER); BELAG.fill(0);
  rampen = []; gabeln = []; loren = []; pendel = []; pfosten = []; rattenStellen = []; troll = null; koenig = null; belegt = []; fackeln = [];
  kisten.length = 0; muenzen.length = 0;
  muenzGeo = new THREE.CylinderGeometry(.5, .5, .13, 16); muenzGeo.rotateX(Math.PI / 2);
  // Abschnitte: Knoten auf Streckenpunkte abbilden
  const knoten = start.map(k => { const [x, z] = kp[k]; let best = 1e12, bi = 0; for (let i = 0; i < S; i++) { const q = (PX[i] - x) ** 2 + (PZ[i] - z) ** 2; if (q < best) { best = q; bi = i; } } return bi; });
  knoten[0] = 0;
  abschnitte = ABSCHNITTE.map((a, n) => ({ von: knoten[n], bis: knoten[(n + 1) % knoten.length], name: a.varianten[p.v[n]].name, v: a.varianten[p.v[n]] }));
  const stelle = (n, u) => wrap(Math.round(abschnitte[n].von + vorab(abschnitte[n].bis, abschnitte[n].von) * u));
  const seiteVon = (s, n, u) => s === "innen" || s === "aussen" ? innenSeite(stelle(n, Math.max(0, u - .2)), stelle(n, Math.min(1, u + .2))) * (s === "innen" ? 1 : -1) : s;

  // Dinge der Abschnitte
  abschnitte.forEach((a, n) => {
    for (const d of a.v.dinge) {
      if (d.art === "haus") bau(stelle(n, d.bei), seiteVon(d.seite, n, d.bei), d.w, d.h, d.d, d.farbe, d.schild, d.gitter);
      else if (d.art === "rampe") rampen.push({ i0: stelle(n, d.von), n: vorab(stelle(n, d.bis), stelle(n, d.von)), h: d.h, treppe: !!d.treppe });
      else if (d.art === "nass") { const i0 = stelle(n, d.von), m = vorab(stelle(n, d.bis), i0); for (let k = 0; k <= m; k++) BELAG[wrap(i0 + k)] = 1; a.kanal = d.kanal ? [i0, m] : null; a.nass = [i0, m]; }
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
      else if (d.art === "pendel") d.bei.forEach((u, k) => pendel.push({ i: stelle(n, u), phase: k * 2.1 }));
      else if (d.art === "faesser" || d.art === "ruestung") for (const [u, dd] of d.stuecke) { const q = punkt(stelle(n, u), dd); pfosten.push({ x: q.x, z: q.z, r: d.art === "faesser" ? .75 : .7, art: d.art, rot: q.rot, i: stelle(n, u), d: dd }); }
      else if (d.art === "ratten") d.bei.forEach((u, k) => rattenStellen.push({ i: stelle(n, u), phase: k * 3.1 }));
      else if (d.art === "koenig") koenig = { i: stelle(n, d.bei), s: seiteVon(d.seite, n, d.bei), anim: 0 };
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
  });

  // Fahrbahn
  const nassFarbe = ["#5E7E80", "#567476", "#66888A"];
  const PLATTE = ["#9A8F82", "#8C8275", "#A39888"];
  for (let j = 0; j < 3; j++) band(-BR / 2 + j * BR / 3, -BR / 2 + (j + 1) * BR / 3, i => (BELAG[wrap(i)] ? nassFarbe : PLATTE)[(Math.floor(i / (STRICH * .75) + j * .5) + j) % 3], .05);
  for (const sg of [-1, 1]) {
    band(sg * BR / 2, sg * (BR / 2 + 1.3), i => (Math.floor(i / (STRICH * .6)) % 2 ? "#E6D6AE" : "#8E2F22"), .05);
    band(sg * RAND, i => sg * (MAUERW[i] + .2), i => MAUERW[wrap(i)] < MAUER ? "#1E3A44" : (Math.floor(i / STRICH) % 3 ? "#4E443B" : "#463D35"), .03);
  }
  // Wasser unter Brücke und in der Kanalisation
  for (const a of abschnitte) {
    if (a.bruecke) for (const sg of [-1, 1]) band(sg * (RAND + .6), sg * (MAUER + 12), i => (Math.floor(i / STRICH) % 2 ? "#1E3A44" : "#22424C"), .02, a.bruecke[0], a.bruecke[0] + a.bruecke[1]);
    if (a.kanal) for (const sg of [-1, 1]) band(sg * (RAND + .5), sg * (MAUER - 1), i => (Math.floor(i / STRICH) % 2 ? "#2C4A48" : "#33554F"), .06, a.kanal[0], a.kanal[0] + a.kanal[1]);
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
    const steine = [], pfeiler = [], scheine = [], gelaender = [], STEIN = ["#6B6158", "#62584F", "#73695F", "#5D544C"];
    const n = Math.floor(LAENGE / 2.2);
    for (let j = 0; j < n; j++) {
      const i = Math.floor(j * S / n);
      if (rampen.some(r => r.treppe && vorab(i, wrap(r.i0 - 8)) <= r.n + 12)) continue;
      for (const s of [-1, 1]) {
        const rot = Math.atan2(TX[i], TZ[i]) + Math.PI / 2;
        if (MAUERW[i] < MAUER) { const q = punkt(i, s * (MAUERW[i] + .3)); gelaender.push([q.x, .6, q.z, rot]); continue; }
        if (troll && s === troll.s && Math.abs(((i - troll.i + S / 2) % S + S) % S - S / 2) < meter(8)) { if (j % 2) { const q = punkt(i, s * (MAUER + .7)); steine.push([q.x, .3, q.z, rot + zufall(), .55, STEIN[0]]); } continue; }
        const d = s * (MAUER + .7);
        steine.push([PX[i] + nX(i) * d, 1.1, PZ[i] + nZ(i) * d, rot, 1, STEIN[Math.floor(zufall() * 4)]]);
        if (j % 7 === 0) {
          pfeiler.push([PX[i] + nX(i) * d, 2.4, PZ[i] + nZ(i) * d, rot]);
          const df = s * (MAUER - .2); fackeln.push([PX[i] + nX(i) * df, 3.9, PZ[i] + nZ(i) * df]);
          const ds = s * (MAUER - 3); scheine.push([PX[i] + nX(i) * ds, .14, PZ[i] + nZ(i) * ds]);
        }
      }
    }
    // Trennwände der Gabelungen
    for (const f of gabeln) for (let k = 0; k <= f.n; k += meter(2.2)) { const i = wrap(f.i0 + k); steine.push([PX[i], .9, PZ[i], Math.atan2(TX[i], TZ[i]) + Math.PI / 2, .75, STEIN[Math.floor(zufall() * 4)]]); }
    instanzen(new THREE.BoxGeometry(2.4, 2.2, 1.3), new THREE.MeshLambertMaterial({ color: "#ffffff" }), steine);
    instanzen(new THREE.BoxGeometry(1.6, 4.8, 1.6), M("#574E46"), pfeiler);
    instanzen(new THREE.BoxGeometry(2.3, 1.2, .25), M("#4A3426"), gelaender);
    instanzen(new THREE.CylinderGeometry(.09, .06, .9, 6), M("#4A3426"), fackeln.map(([x, y, z]) => [x, y - .5, z]), false);
    const sg = new THREE.PlaneGeometry(13, 13); sg.rotateX(-Math.PI / 2);
    const ims = instanzen(sg, scheinMat, scheine, false); ims.receiveShadow = false;
  }
  flammen = [instanzen(new THREE.ConeGeometry(.28, .9, 6), GLUT("#FF8A2A"), fackeln.map(([x, y, z]) => [x, y + .2, z]), false),
    instanzen(new THREE.ConeGeometry(.16, .6, 6), GLUT("#FFE07A"), fackeln.map(([x, y, z]) => [x, y + .1, z]), false)];

  streckeDingeBauen();
  hallenDeko();
  startBogen();
  minikarte();
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
  if (koenig) {
    const q = punkt(koenig.i, koenig.s * (MAUER + 3.5)), g = new THREE.Group();
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
    g.position.set(q.x, 0, q.z); g.rotation.y = q.rot - Math.PI / 2 * koenig.s; streckeG.add(g);
    koenig.g = g; koenig.arm = arm; koenig.augMat = augMat;
  }
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
  // Feuerschale in der Mitte
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
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
// Start: Steinbogen mit Schild und Bannern, Fässer an der Geraden
function startBogen() {
  const d = BR / 2 + 2.2, r0 = Math.atan2(TX[0], TZ[0]);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 8, 1.6), M("#6E655C")); p.position.set(PX[0] + nX(0) * d * s, 4, PZ[0] + nZ(0) * d * s); p.castShadow = true; streckeG.add(p);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.4), new THREE.MeshLambertMaterial({ color: "#8E2F22", side: THREE.DoubleSide }));
    ban.position.set(PX[0] + nX(0) * (d - 1.6) * s, 5.2, PZ[0] + nZ(0) * (d - 1.6) * s); ban.rotation.y = r0; streckeG.add(ban);
  }
  const bo = new THREE.Mesh(new THREE.BoxGeometry(d * 2 + 1.6, 1.4, 1.4), M("#6E655C")); bo.position.set(PX[0], 8.6, PZ[0]); bo.rotation.y = r0 + Math.PI / 2; streckeG.add(bo);
  const b = new THREE.Mesh(new THREE.BoxGeometry(d * 2 - 1, 1.5, .4), schildMat("START · ZIEL", "#F3E6CC", "#2A2118", 1024, 96));
  b.position.set(PX[0], 7.2, PZ[0]); b.rotation.y = r0 + Math.PI; streckeG.add(b);
  for (let i = 0; i < 6; i++) { const p = punkt(meter(18 + i * 12), -(MAUER + 2.4)); const f = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 1.3, 10), M("#7A5434")); f.position.set(p.x, .65, p.z); f.castShadow = true; streckeG.add(f); }
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
    this.kraft = 0; this.gold = 0; this.wirbel = this.wall = this.unsicht = this.wind = this.segen = this.eis = this.glatt = this.skelette = this.skelettUhr = 0; this.klauVor = null; this.wirbelGetroffen = null;
  }
  suchen() {                                     // nächster Streckenpunkt über die ganze Runde
    let best = Infinity, bi = 0;
    for (let i = 0; i < S; i += 3) { const q = (this.x - PX[i]) ** 2 + (this.z - PZ[i]) ** 2; if (q < best) { best = q; bi = i; } }
    this.idx = bi; this.naechster();
  }
  // Zustand eines anderen Handys übernehmen; dazwischen wird weitergerechnet und weich nachgeführt
  netzZustand(a) {
    const [x, y, z, yaw, v, s, drift, boost, prog, ladung, fx = 0] = a;
    this.schild = !!(fx & 1); this.amulett = fx & 2 ? 1 : 0; this.netz = fx & 4 ? 1 : 0; this.fleder = fx & 8 ? 1 : 0; this.schonzeit = fx & 16 ? 1 : 0;
    this.wirbel = fx & 64 ? 1 : 0; this.wall = fx & 128 ? 1 : 0; this.unsicht = fx & 256 ? 1 : 0; this.eis = fx & 512 ? 1 : 0; this.segen = fx & 1024 ? 1 : 0; this.wind = fx & 2048 ? 1 : 0;
    this.skelette = (fx & 4096 ? 1 : 0) + (fx & 8192 ? 1 : 0);
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
      | (this.skelette > 0 ? 4096 : 0) | (this.skelette > 1 ? 8192 : 0);
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
    const offroad = Math.abs(this.d) > RAND && !this.luft, nass = BELAG[this.idx] && !this.luft;
    if (this.boost > 0) this.boost -= dt;
    if (this.dreher > 0) this.dreher -= dt;
    let maxV = st.maxV * (offroad ? (st.gelaende || .5) : nass ? 1.1 : 1);
    if (this.netz > 0) maxV *= .7;
    if (this.bremse > 0) maxV *= .55;
    if (this.holper > 0) maxV *= .5;
    if (this.skelette > 0) maxV *= 1 - .14 * this.skelette;
    maxV *= 1 + this.gold * .006;                                   // jedes Goldstück macht etwas schneller
    if (this.boost > 0) maxV = st.maxV * 1.4;
    if (this.wind > 0) maxV = st.maxV * 1.5;
    if (this.haken) maxV = st.maxV * 1.55;
    if (ein.gas === false) maxV = 0; else if (this.dreher > 0) maxV = Math.min(maxV, st.maxV * .35);
    const schub = this.boost > 0 || this.haken || this.wind > 0 ? 3 : this.erholung > 0 && !(this.dreher > 0) ? 2.2 : 1;
    if (this.eis > 0) this.v *= Math.max(0, 1 - .45 * dt);         // eingefroren: schlittert ohne Antrieb
    else if (!this.luft) this.v += Math.max(-30 * dt, Math.min(st.accel * dt * schub, maxV - this.v));
    // Lenken (für Tasten geglättet); im Netz lenkt es sich schwer, im Eisblock gar nicht
    const lenk = this.eis > 0 ? 0 : ein.lenk * (this.netz > 0 ? .3 : 1);
    this.s += (lenk - this.s) * Math.min(1, dt * (ein.direkt ? 30 : 9));
    // Drift
    if (!this.drift && ein.drift && Math.abs(this.s) > .25 && this.v > 14 && !this.luft && !(this.eis > 0)) { this.drift = Math.sign(this.s); this.ladung = 0; }
    if (this.drift && (!ein.drift || this.v < 9)) {
      if (this.ladung > 1.7) this.boost = Math.max(this.boost, 1.2); else if (this.ladung > .8) this.boost = Math.max(this.boost, .6);
      this.drift = 0; this.ladung = 0;
    }
    let s = this.s, wende = st.turn;
    if (this.drift) { s = this.drift * .6 + this.s * .5; wende *= st.drift; this.ladung += dt * (.6 + Math.abs(s) * .6); if (phase === "rennen") kraftLaden(this, dt * (this.typ === "moench" ? .05 : .025)); }
    let rate = -s * wende * Math.min(1, Math.max(Math.abs(this.v), 3) / 10) * (this.v < -.5 ? -1 : 1) * (this.luft ? .35 : 1);   // auch langsam etwas lenkbar
    if (this.dreher > 0) rate = 9;
    this.yaw += rate * dt;
    const k = this.eis > 0 ? .5 : this.wind > 0 ? 16 : (this.drift ? 2.6 : st.grip) * (nass ? .55 : 1) * (this.glatt > 0 ? .3 : 1);
    let diff = this.yaw - this.mh; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.mh += diff * (1 - Math.exp(-k * dt));
    if (this.dreher > 0) this.mh = this.mhFest;
    const alt = { x: this.x, z: this.z, idx: this.idx, prog: this.prog, d: this.d };
    this.x += Math.sin(this.mh) * this.v * dt; this.z += Math.cos(this.mh) * this.v * dt;
    if (this.wind > 0) { this.x -= Math.cos(this.mh) * this.s * 16 * dt; this.z += Math.sin(this.mh) * this.s * 16 * dt; }   // Windschritt: seitlich ausweichen
    this.naechster();
    streckeStoss(this, alt, dt);
    // Mauer
    const mw = MAUERW[this.idx];
    if (Math.abs(this.d) > mw) {
      const zu = Math.abs(this.d) - mw, sg = Math.sign(this.d);
      this.x -= nX(this.idx) * sg * zu; this.z -= nZ(this.idx) * sg * zu; this.d = sg * mw;
      this.v *= Math.max(0, 1 - 3 * dt); this.yaw += sg * .9 * dt * Math.sign(Math.cos(this.mh - Math.atan2(TX[this.idx], TZ[this.idx])));   // von der Mauer weg drehen
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
    this.flamme.visible = this.boost > 0 || !!this.haken || this.wind > 0;
    if (this.flamme.visible) this.flamme.scale.set(1, .7 + Math.random() * .6, 1);
    const t = zeit / 1000;
    this.schildM.visible = !!this.schild;
    this.aura.visible = this.amulett > 0; if (this.aura.visible) this.aura.material.opacity = .2 + Math.sin(t * 10) * .08;
    this.netzM.visible = this.netz > 0; if (this.netzM.visible) this.netzM.rotation.y = Math.sin(t * 9) * .2;
    this.flederM.visible = this.fleder > 0;
    if (this.flederM.visible) this.flederM.children.forEach((f, i) => { const w = t * 5 + i * 2.1; f.position.set(Math.sin(w) * 1.2, 2.3 + Math.sin(t * 9 + i) * .25, Math.cos(w) * 1.2 + .6); f.rotation.y = w + Math.PI / 2; f.children[1].rotation.x = f.children[2].rotation.x = Math.sin(t * 30 + i) * .6; });
    this.koerper.visible = !(this.schonzeit > 0 && !(this.dreher > 0) && Math.floor(t * 12) % 2 === 0);
    this.koerper.rotation.y = this.wirbel > 0 ? t * 26 : 0;
    this.wirbelM.visible = this.wirbel > 0; if (this.wirbelM.visible) { this.wirbelM.rotation.z = t * 20; this.wirbelM.scale.setScalar(.85 + Math.sin(t * 30) * .12); }
    this.wallM.visible = this.wall > 0;
    this.eisM.visible = this.eis > 0;
    this.segenM.visible = this.segen > 0; if (this.segenM.visible) this.segenM.rotation.y = t * 2;
    this.windM.visible = this.wind > 0; if (this.windM.visible) this.windM.children.forEach((f, i) => f.scale.z = .6 + Math.random() * .8);
    this.skelM.forEach((s, i) => { s.visible = this.skelette > i; if (s.visible) s.rotation.z = Math.sin(t * 14 + i * 2) * .3; });
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
function truhenReihe(i) {
  for (const d of [-3.4, 0, 3.4]) {
    const x = PX[i] + nX(i) * d, z = PZ[i] + nZ(i) * d;
    const g = truhe(false), mg = truhe(true);
    for (const h of [g, mg]) { h.position.set(x, 1.1, z); streckeG.add(h); }
    const b = { g, mg, x, z, weg: 0, mimik: false, blinzeln: 2 + Math.random() * 3 };
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
    const q = punkt(i, d), m = new THREE.Mesh(muenzGeo, MUENZ_MAT);
    const y = hoehe(i, d) + 1; m.position.set(q.x, y, q.z); m.castShadow = true; streckeG.add(m);
    muenzen.push({ m, x: q.x, y, z: q.z, weg: 0 });
  }
}
function goldNehmen(k, mz) {
  mz.weg = 8; mz.m.visible = false;
  k.gold = Math.min(10, (k.gold || 0) + 1); kraftLaden(k, .05);
  if (k.ich) { const g = $("gold"); g.classList.remove("neu"); void g.offsetWidth; g.classList.add("neu"); }
}
function neuMischen(b) { b.mimik = Math.random() < 1 / 8; b.g.visible = !b.mimik; b.mg.visible = b.mimik; }
function truhenZeigen(dt) {
  const dieb = ich && ich.typ === "dieb";
  for (const mz of muenzen) {
    if (mz.weg > 0) { mz.weg -= dt; if (mz.weg <= 0) { mz.weg = 0; mz.m.visible = true; } }
    else mz.m.rotation.y += dt * 3;
  }
  for (const b of kisten) {
    if (b.weg > 0) { b.weg -= dt; if (b.weg <= 0) { b.weg = 0; neuMischen(b); } }
    const h = b.mimik ? b.mg : b.g;
    h.rotation.y += dt * 1.2; h.position.y = 1.1 + Math.sin(uhr * 3 + b.x) * .15;
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
  beben:     { name: "Beben", bild: "🪨", w: [0, 0, 2] }
};
const TEST_EXTRA = new URLSearchParams(location.search).get("extra");    // Test: ?extra=feuerball gibt immer dieses Extra
const klemmen = (v, a, b) => Math.max(a, Math.min(b, v));
let wackeln = 0;                                                        // Kamera wackelt (Beben, Treffer)

function extraZiehen(k) {
  if (TEST_EXTRA && EXTRAS[TEST_EXTRA]) return TEST_EXTRA;
  const n = karts.length, p = n > 1 ? (platzVon(k) - 1) / (n - 1) : .5;
  const stufe = p < .34 ? 0 : p < .67 ? 1 : 2;
  const alle = Object.entries(EXTRAS); let summe = 0; for (const [, e] of alle) summe += e.w[stufe];
  let x = Math.random() * summe; for (const [a, e] of alle) { x -= e.w[stufe]; if (x < 0) return a; }
  return "flink";
}
function truheNehmen(k, b) {
  b.weg = 3.5; b.g.visible = b.mg.visible = false;
  if (b.mimik) {                                   // gebissen: Kart dreht sich, Extra weg
    k.item = null; k.walze = 0;
    treffen(k, "mimik");
    if (k.ich) { melden("Ein Mimik! 😬 Extra weg"); extraAnzeigen(); }
    return;
  }
  if (k.item || k.walze > 0) return;
  const art = extraZiehen(k);
  k.item = { art, n: EXTRAS[art].n || 1 }; k.walze = k.bot ? .8 : 1.1;
  if (k.ich) extraAnzeigen(true);
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
  else if (e.a === "beben") { bebenStarten(e); if (e.von === "koenig" && koenig) { koenig.anim = 1.6; if (ich && ich.fertig == null) melden("Der Knochenkönig zürnt! ⚠", 1.8); } }
  else if (e.a === "wand") { const f = gabeln[e.n | 0]; if (f && !f.offen) { f.offen = true; if (f.wandM) { f.wandM.visible = false; const q = punkt(f.i0, f.innen * 6); puff(q.x, 2, q.z, "#9A8F82"); } } }
  else if (e.a === "platte") { const f = gabeln[e.n | 0]; if (f && (e.seite === 1 || e.seite === -1)) f.platte = { seite: e.seite, bis: +e.bis || 0 }; }
}
// Wirkung auf ein Kart, das dieses Handy fährt
function wirkung(k, e) {
  if (e.art === "treffer") treffen(k, "treffer");
  else if (e.art === "bremse") { k.bremse = 1.2; if (k.ich) melden("Eingehakt! 🪝"); }
  else if (e.art === "fleder") { if (k.amulett > 0) return; k.fleder = 3; if (k.ich) melden("Fledermäuse! 🦇", 1); }
  else if (e.art === "tausch") { versetzen(k, wrap(e.idx | 0), +e.d || 0, +e.prog || k.prog); if (k.ich) melden("Platz getauscht! 📜"); }
  else if (e.art === "lohn") kraftLaden(k, .2);
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
  if (!k.remote) kraftLaden(k, .2); else ereignis({ a: "wirkung", ziel: k.id, art: "lohn" });
}

// Treffer auf ein selbst gefahrenes Kart. Rückgabe: "durch" (wirkt nicht, Geschoss fliegt weiter) oder "weg" (Geschoss verbraucht)
function treffen(k, art) {
  if (k.fertig != null) return "durch";
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
    k.sporen = 2.2; k.v *= .75; k.schonzeit = 1;
    if (k.ich) { melden("Sporen! Wischen!", 1.4); summen(60); }
    return "weg";
  }
  k.dreher = k.typ === "paladin" ? .5 : .95; k.mhFest = k.mh; k.v *= .5; k.drift = 0; k.ladung = 0; k.boost = 0; k.haken = null;
  k.schonzeit = k.dreher + 2; if (k.typ === "heilerin") k.erholung = k.dreher + 1.5;
  if (art !== "mimik" && k.gold > 0) { k.gold = Math.max(0, k.gold - 2); if (k.ich) puff(k.x, k.y + 1.5, k.z, "#F2B705"); }
  if (k.ich) { summen(180); wackeln = Math.max(wackeln, .35); }
  return "weg";
}
function summen(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch {} }

// Kart an eine andere Stelle der Strecke setzen (Teleport, Platztausch)
function versetzen(k, idx, d, prog) {
  d = klemmen(d, -BR / 2 + 1, BR / 2 - 1);
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
  if (phase !== "rennen" || !k.item || k.walze > 0 || k.fertig != null || k.dreher > 0 || k.eis > 0) return false;
  const art = k.item.art, E = EXTRAS[art];
  const hinten = wunsch ? wunsch === "hinten" : !!E.falle, rf = hinten ? -1 : 1;
  if (--k.item.n <= 0) k.item = null;
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
      for (let n = 0; n < 2; n++) steine.push([wrap(Math.round(o.idx + (28 + n * 12 + Math.random() * 8) / SCHRITT)), Math.round(((Math.random() - .5) * (BR - 2)) * 10) / 10]);
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
const FALLE = { schleim: 30, kraehen: 18, kaese: 5.5, pilz: 30, stein: 4.5, glatt: 4 };
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
    o.idx = wrap(Math.round(o.p)); o.x = PX[o.idx] + nX(o.idx) * o.d; o.z = PZ[o.idx] + nZ(o.idx) * o.d;
    o.g = objMesh(e.art); o.g.position.set(o.x, o.y, o.z); objekte.set(o.id, o);
  } else {
    if (!FALLE[e.art]) return;
    const idx = wrap(e.idx | 0), d = klemmen(+e.d || 0, -MAUER, MAUER);
    const o = { id: e.id, art: e.art, von: e.von, idx, d, x: PX[idx] + nX(idx) * d, z: PZ[idx] + nZ(idx) * d, alter: 0, flug: e.flug ? .55 : 0, fall: e.fall || 0 };
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
    if (o.art === "pilz") { const s = 1 + Math.sin(o.alter * 6) * .08; o.g.userData.puls.scale.set(s, .6 * s, s); }
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
      if (k.remote || k.fertig != null || k.luft) continue;
      if (o.art === "schleim") {
        if (k.typ === "magierin" || Math.hypot(k.x - o.x, k.z - o.z) > 1.9) continue;
        if (treffen(k, "treffer") === "weg") { if (k.dreher > 0) lohn(o.von, k); objektWeg(id); ereignis({ a: "weg", id }); break; }
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
  for (const t of ["schonzeit", "netz", "bremse", "fleder", "sporen", "amulett", "erholung", "holper", "walze", "wirbel", "wall", "unsicht", "wind", "segen", "eis", "glatt"]) if (k[t] > 0) k[t] = Math.max(0, k[t] - dt);
}

// ----- Heldenkräfte -----
function kraftNutzen(k) {
  if (phase !== "rennen" || k.kraft < 1 || k.fertig != null || k.lore || k.flug || k.eis > 0 || (k.dreher > 0 && k.typ !== "heilerin")) return false;
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
      k.netz = k.bremse = k.fleder = k.sporen = k.holper = k.glatt = k.skelette = k.dreher = 0; k.haken = null;
      k.segen = 5; sag("Segen! ✨"); break;
    case "moench": k.wind = 2; k.drift = 0; sag("Windschritt! 💨"); break;
    case "nekromant": {
      const z = karts.filter(o => o !== k && o.fertig == null && o.g.visible && o.prog < k.prog && (k.prog - o.prog) * SCHRITT < 120).sort((a, b) => b.prog - a.prog).slice(0, 2);
      if (!z.length) { sag("Niemand hinter dir für die Skelette", 1.2); return false; }
      for (const o of z) ereignis({ a: "wirkung", ziel: o.id, art: "skelett" });
      sag(z.length > 1 ? "Skelette auf " + z[0].name + " und " + z[1].name + "! 💀" : "Skelett auf " + z[0].name + "! 💀", 1.4); break;
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
    else if (!f.offen && seite === f.innen) {
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
  for (const r of rattenStellen) if (r.aktiv) for (const q of r.pos) if (Math.hypot(k.x - q.x, k.z - q.z) < 1.3) { treffen(k, "treffer"); break; }
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
    k.lore = null; k.v = 0; k.dreher = .9; k.mhFest = k.mh; k.schonzeit = 2.2; k.drift = 0;
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
function flugSchritt(k, dt) {
  const F = k.flug; F.t += dt;
  const u = Math.min(1, F.t / F.dauer), tx = PX[F.b] + nX(F.b) * F.d, tz = PZ[F.b] + nZ(F.b) * F.d;
  k.x = F.x0 + (tx - F.x0) * u; k.z = F.z0 + (tz - F.z0) * u; k.y = F.y0 * (1 - u) + 4 * 9 * u * (1 - u);
  let dy = Math.atan2(TX[F.b], TZ[F.b]) - F.yaw0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  k.yaw = k.mh = F.yaw0 + dy * u; k.luft = true; k.vy = u < .5 ? 5 : -5;
  if (u >= 1) { k.flug = null; k.idx = F.b; k.prog = F.prog; k.d = F.d; k.y = hoehe(F.b, F.d); k.luft = false; k.vy = 0; k.landung = .25; k.boost = Math.max(k.boost, .4); }
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
  if (koenig) {
    if (koenig.anim > 0) koenig.anim = Math.max(0, koenig.anim - dt);
    const a = koenig.anim > 0 ? Math.sin(Math.min(1, (1.6 - koenig.anim) * 3) * Math.PI / 2) : 0;
    koenig.arm.rotation.z = a * 1.4; koenig.augMat.color.set(a > .2 ? "#C6FFD8" : "#7BE3A0");
  }
}
// Knochenkönig: ab Runde 2 lässt er alle 14 bis 20 Sekunden die Erde beben (entscheidet allein der Spielleiter)
let koenigTakt = 0;
function koenigLenken(dt) {
  if (!koenig || modus === "client" || phase !== "rennen") return;
  if (!karts.some(k => k.runden.length >= 1 && k.fertig == null)) { koenigTakt = 6; return; }
  koenigTakt -= dt; if (koenigTakt > 0) return;
  koenigTakt = 14 + Math.random() * 6;
  const steine = [];
  for (const o of karts) {
    if (o.fertig != null || !o.g.visible) continue;
    for (let n = 0; n < 2; n++) steine.push([wrap(Math.round(o.idx + (30 + n * 13 + Math.random() * 8) / SCHRITT)), Math.round(((Math.random() - .5) * (BR - 2)) * 10) / 10]);
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
      return !f.offen && k.st.masse < 1.5 ? -f.innen * BR / 4 : f.innen * BR / 4;
    }
  }
  if (k.loreWahl) for (const f of loren) { const vor = vorab(f.i0, k.idx) * SCHRITT; if (vor > 0 && vor < 45) return f.railD; }
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
  v.innerHTML = `<b>${esc(abschnitte[n] ? abschnitte[n].name : "")}</b><small>${planCode(plan)}${modus === "allein" ? " · Tippen überspringt" : ""}</small>`;
}

// ---------- Minikarte ----------
let mx = x => x, mz = z => z;
function minikarte() {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < S; i++) { minX = Math.min(minX, PX[i]); maxX = Math.max(maxX, PX[i]); minZ = Math.min(minZ, PZ[i]); maxZ = Math.max(maxZ, PZ[i]); }
  const mf = Math.min(88 / (maxX - minX), 68 / (maxZ - minZ));
  mx = x => 52 + (x - (minX + maxX) / 2) * mf; mz = z => 42 + (z - (minZ + maxZ) / 2) * mf;
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
  karts.forEach(k => { sc.remove(k.g); sc.remove(k.schatten); if (k.seil) sc.remove(k.seil); });
  karts = []; ich = null;
  raster.forEach((e, n) => {
    const k = new Kart(e.typ, e.name, e.id === PID, e.farbe);
    k.id = e.id; k.bot = !!e.bot; k.remote = e.id !== PID && !(e.bot && modus !== "client");
    k.tempo = .9 + (n % 4) * .025; k.loreWahl = Math.random() < .45; k.trollWahl = Math.random() < .4;
    const [i, d] = startplatz(n); k.setzen(i, d); k.zeigen(0);
    karts.push(k); if (k.ich) ich = k;
  });
  $("punkte").innerHTML = karts.map((k, n) => `<circle r="${k.ich ? 4.5 : 3}" fill="${k.farbe}" stroke="#2A1A12" stroke-width="1.2"/>`).join("");
  document.querySelectorAll(".tag").forEach(t => t.remove());
  for (const k of karts) if (!k.ich) { k.tag = document.createElement("div"); k.tag.className = "tag"; k.tag.textContent = k.name; $("hud").appendChild(k.tag); }
  kisten.forEach(b => { b.weg = 0; neuMischen(b); });
  objekteLeeren(); wackeln = 0;
  liste = []; uhr = 0; rennenVorbei = false; extraAnzeigen();
  $("kraftbild").innerHTML = ich && window.VB && HELDEN[ich.typ] ? VB.held(ich.typ) : "⚡";
  $("kkraft").hidden = !ich || !HELDEN[ich.typ];
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
  const fs = phase === "rennen" ? streckenSpur(k) : null;          // Spur, die die Strecke verlangt (Gabelung, Wand, Lore, Troll)
  const vor = Math.round((fs != null ? 5 + k.v * .45 : 10 + k.v * .9) / (LAENGE / S));   // vor Engstellen kürzer vorausschauen, sonst wird die Kurve geschnitten
  const j = wrap(k.idx + vor);
  k.botTimer -= dt;
  if (k.botTimer <= 0) { k.botTimer = 2 + Math.random() * 3; k.spurZiel = (Math.random() - .5) * (BR - 4); }
  // Fallen und Steinen ausweichen (der Pilzling ist zu schusselig dafür)
  if (k.typ !== "pilzling" && phase === "rennen") for (const o of objekte.values()) {
    if (o.wurf || o.art === "kaese") continue;
    let di = o.idx - k.idx; if (di > S / 2) di -= S; if (di < -S / 2) di += S;
    const m = di * SCHRITT, breit = o.art === "kraehen" ? BR / 4 + 1.6 : 2.6;
    if (m < 3 || m > 32 || Math.abs(o.d - k.spur) > breit) continue;
    k.spurZiel = klemmen(o.d > 0 ? o.d - breit - 1.2 : o.d + breit + 1.2, -BR / 2 + 1.5, BR / 2 - 1.5); k.botTimer = Math.max(k.botTimer, 1.2);
    k.spur += (k.spurZiel - k.spur) * Math.min(1, dt * 2.5);
  }
  if (fs != null) { k.spurZiel = fs; k.botTimer = Math.max(k.botTimer, .5); k.spur += (fs - k.spur) * Math.min(1, dt * 2.5); }
  k.spur += ((k.spurZiel ?? 0) - k.spur) * Math.min(1, dt * .8);
  const tx = PX[j] + nX(j) * k.spur, tz = PZ[j] + nZ(j) * k.spur;
  let diff = Math.atan2(tx - k.x, tz - k.z) - k.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  // Gummiband: weit hinter dem führenden Menschen etwas schneller, weit vorne etwas langsamer
  const mensch = Math.max(...karts.filter(o => !o.bot).map(o => o.prog));
  const abstand = (mensch - k.prog) / S * LAENGE;
  k.st = { ...TYPEN[k.typ], maxV: TYPEN[k.typ].maxV * k.tempo * (abstand > 40 ? 1.08 : abstand < -60 ? .93 : 1) };
  let lenk = -diff * 2.2;
  if (fs != null) lenk += klemmen((k.spur - k.d) * .18, -.6, .6);   // aktiv in die verlangte Spur
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
        if (!A.remote && (B.amulett > 0 || B.wall > 0) && !(A.amulett > 0)) treffen(A, "treffer");
        if (!B.remote && (A.amulett > 0 || A.wall > 0) && !(B.amulett > 0)) treffen(B, "treffer");
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
  for (const k of karts) {
    if (k.remote) { k.folgen(dt); continue; }
    extraTimer(k, dt);
    let e = !rennt ? { lenk: k.ich ? ein.lenk : 0, gas: false, drift: false, direkt: true }
      : k.fertig != null ? (k.ich ? { lenk: botEingabe(k, dt).lenk, drift: false, direkt: true } : botEingabe(k, dt))
        : k.ich && !AUTO && !k.aufgegeben ? ein : botEingabe(k, dt);
    if (rennt && k.haken) e = hakenLenken(k, dt) || e;
    if (rennt && k.fertig == null && (k.bot || (k.ich && AUTO))) botExtra(k, dt);
    if (rennt && k.ich && AUTO && k.kraft >= 1) kraftNutzen(k);
    if (rennt) kraftSchritt(k, dt);
    if (k.fertig != null && k.ich) k.st = { ...TYPEN[k.typ], maxV: TYPEN[k.typ].maxV * .6 };
    if (k.lore) loreSchritt(k, dt, e);
    else if (k.flug) flugSchritt(k, dt);
    else { k.schritt(dt, e); if (rennt) streckeWirkung(k, dt, e); }
    // Runden
    const runde = Math.floor(k.prog / S);
    if (rennt && runde > k.runden.length && k.fertig == null && k.prog > 0) {
      k.runden.push(uhr - k.rundeStart); k.rundeStart = uhr;
      if (k.runden.length >= RUNDEN) { k.fertig = uhr; imZiel(k.id, uhr); if (k.ich) zielEinlauf(); }
      else if (k.ich) melden(k.runden.length === RUNDEN - 1 ? "Letzte Runde!" : `Runde ${k.runden.length + 1}`);
    }
    // Kisten
    if (rennt && k.fertig == null) for (const b of kisten) if (!b.weg && Math.hypot(b.x - k.x, b.z - k.z) < 1.8 && k.y < 2.5) truheNehmen(k, b);
    if (rennt && k.fertig == null) for (const mz of muenzen) if (!mz.weg && Math.abs(mz.y - 1 - k.y) < 1.6 && (mz.x - k.x) ** 2 + (mz.z - k.z) ** 2 < 2.9) goldNehmen(k, mz);
  }
  stossen();
  if (rennt || phase === "ziel") objekteSchritt(dt);
  streckeZeigen(dt); koenigLenken(dt);
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
function kamera(dt, sofort) {
  if (phase === "vorschau") { vorschauKamera(); kamPos.copy(cam.position); return; }
  const fx = Math.sin(ich.yaw * .5 + ich.mh * .5), fz = Math.cos(ich.yaw * .5 + ich.mh * .5);
  ziel3.set(ich.x - fx * 7.6, ich.y * .6 + 3.5, ich.z - fz * 7.6);
  if (sofort) kamPos.copy(ziel3); else kamPos.lerp(ziel3, 1 - Math.exp(-dt * 7));
  cam.position.copy(kamPos);
  if (wackeln > 0) cam.position.add(v3.set((Math.random() - .5) * wackeln * .9, (Math.random() - .5) * wackeln * .6, (Math.random() - .5) * wackeln * .9));
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
    c.style.display = k.g.visible && !(k.unsicht > 0 && !k.ich) ? "" : "none";
    if (k.tag) {
      v3.set(k.x, k.y + 2.8, k.z).project(cam);
      const sichtbar = k.g.visible && !(k.unsicht > 0) && v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 && Math.hypot(k.x - ich.x, k.z - ich.z) < 120;
      k.tag.style.display = sichtbar ? "" : "none";
      if (sichtbar) { k.tag.style.left = (v3.x + 1) / 2 * innerWidth + "px"; k.tag.style.top = (1 - v3.y) / 2 * innerHeight + "px"; }
    }
  });
  $("lenkrad").style.transform = `rotate(${ein.lenk * 90}deg)`;
  extraHud(dt);
  hudTakt -= dt; if (hudTakt > 0) return; hudTakt = .1;
  const kk = $("kkraft"); kk.style.setProperty("--k", ich.kraft.toFixed(3)); kk.classList.toggle("voll", ich.kraft >= 1);
  $("gold").innerHTML = `<i></i>${ich.gold}`;
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
  h += `</div><p class="leise">Strecke ${planCode(plan)}: ${abschnitte.map(a => esc(a.name)).join(" · ")}</p><div class="zeile" style="justify-content:space-between">`;
  if (modus === "allein") h += `<a class="zurueck" href="../">‹ Spielauswahl</a><span><button class="los zweit" id="zumMenue">Einstellungen</button> <button class="los zweit" id="gleich">Gleiche Strecke</button> <button class="los" id="nochmal">Neue Strecke</button></span>`;
  else if (modus === "host") h += `<button class="zurueck knopflos" id="verlassen">Raum schließen</button><span><button class="los zweit" id="zurLobby">Zur Lobby</button> <button class="los zweit" id="gleich">Gleiche Strecke</button> <button class="los" id="nochmal">Neue Strecke</button></span>`;
  else h += `<button class="zurueck knopflos" id="verlassen">Raum verlassen</button><span class="leise">${esc(hostName())} startet das nächste Rennen.</span>`;
  h += `</div>`;
  $("zielKasten").innerHTML = h; $("ziel").hidden = false;
  if ($("nochmal")) $("nochmal").onclick = () => modus === "allein" ? alleinStarten() : rennenStarten();
  if ($("gleich")) $("gleich").onclick = () => modus === "allein" ? alleinStarten(true) : rennenStarten(true);
  if ($("zumMenue")) $("zumMenue").onclick = () => menue("start");
  if ($("zurLobby")) $("zurLobby").onclick = () => { lobbyPhase = "lobby"; lobbySenden(); menue("lobby"); };
  if ($("verlassen")) $("verlassen").onclick = verlassen;
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
function planPruefen(p) { return p && planAusCode(planCode({ v: Array.isArray(p.v) ? p.v : [], s: +p.s || 0 })) || planWuerfeln(); }
function countdownStarten(raster, p) {
  if (!raster.some(e => e.id === PID)) { menue("lobby"); return; }      // bin nicht dabei (zu spät gekommen)
  streckeBauen(planPruefen(p));
  rennenAufbauen(raster);
  hudVorbereiten(); zielInfo = null;
  $("menue").hidden = true; $("ziel").hidden = true; $("pausiert").hidden = true; $("hud").hidden = false;
  phase = "vorschau"; vorschauZeit = VORSCHAU; $("gross").hidden = true;
}
// gleich = dieselbe Strecke noch einmal, sonst eine neue
function alleinStarten(gleich) { modus = "allein"; countdownStarten(alleinRaster(), gleich ? plan : startPlan || planWuerfeln()); startPlan = null; }
let startPlan = planAusCode(new URLSearchParams(location.search).get("strecke"));   // ?strecke=KERKER-… fährt diese Strecke
// Vorschau: allein mit Antippen überspringen
addEventListener("pointerdown", () => { if (phase === "vorschau" && modus === "allein") vorschauZeit = Math.min(vorschauZeit, .01); });

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
  else if (m.t === "ev" && m.nr === rennNr && m.e) { m.e.q = m.pid; anAlle({ t: "ev", nr: rennNr, e: m.e }); anwenden(m.e); }
  else if (m.t === "ziel" && m.nr === rennNr) { eintragen(m.pid, +m.zeit); ergebnisSenden(); }
  else if (m.t === "aufgeben" && m.nr === rennNr) { eintragen(m.pid, null); ergebnisSenden(); }
}
function ergebnisSenden() {
  const menschen = karts.filter(k => !k.bot);
  if (!rennenVorbei && menschen.every(k => liste.some(e => e.id === k.id))) rennenVorbei = true;
  anAlle({ t: "ergebnis", nr: rennNr, liste, vorbei: rennenVorbei });
  zielZeigen();
}
function rennenStarten(gleich) {
  if (modus !== "host") return;
  const p = gleich && plan ? plan : startPlan || planWuerfeln(); startPlan = null;
  rennNr++; lobbyPhase = "rennen";
  const menschen = lobbyListe().filter(e => e.online), raster = monsterRaster(wahlGegner);
  // Spieler in zufälliger Reihenfolge hinter die Übungsgegner
  menschen.sort(() => Math.random() - .5).forEach((e, n) => raster.push({ id: e.pid, name: e.name, typ: e.typ, farbe: SPIELERFARBEN[n % SPIELERFARBEN.length] }));
  lobbySenden();
  anAlle({ t: "start", nr: rennNr, raster, plan: p });
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
    lobby = m; wahlGegner = m.gegner;
    if (m.phase === "lobby" && (phase === "ziel" || phase === "menue")) { phase = "menue"; menue("lobby"); }
    else if (phase === "menue") menue("lobby");
  } else if (m.t === "start") { rennNr = m.nr; countdownStarten(m.raster, m.plan); }
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
      <div class="zeile" style="justify-content:space-between"><a class="zurueck" href="../">‹ Spielauswahl</a><span class="leise">Am Computer: Pfeiltasten, Leertaste = Drift, E = Extra, R = Heldenkraft</span></div>`;
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
streckeBauen(startPlan || planWuerfeln());
rennenAufbauen(alleinRaster());
const gespeichert = ss.get("kart:host");
if (typeof Peer === "undefined") { menue("start"); netzStatus("Die Verbindungsbibliothek fehlt: zusammen fahren geht gerade nicht."); }
else if (code && gespeichert && gespeichert.code === code) { wahlGegner = gespeichert.gegner ?? wahlGegner; hostStarten(); }
else if (code) menue("einladung");
else menue("start");
requestAnimationFrame(loop);
window.KART = { get phase() { return phase; }, get ich() { return ich; }, karts: () => karts, ein, S, get LAENGE() { return LAENGE; }, get liste() { return liste; }, get modus() { return modus; },
  sim(sek) { for (let t = 0; t < sek; t += 1 / 60) { update(1 / 60); } }, aufbauen: rennenAufbauen, cam, sc, r, THREE, streckeBauen, planWuerfeln, planCode, get plan() { return plan; }, get strecke() { return { abschnitte, gabeln, loren, troll, pendel, pfosten, rattenStellen, koenig, rampen }; }, PX, PZ, set uhr(v) { uhr = v; }, objekte, extraNutzen, kisten, treffen, versetzen, anwenden, ereignis, schritte(sek) { for (let t = 0; t < sek; t += 1 / 30) { update(1 / 30); karts.forEach(k => k.zeigen(performance.now())); hud(1 / 30); } }, neigung: () => neigung, lenkWert, kraftNutzen, muenzen, wirkung, set steuerung(v) { steuerung = v; } };
