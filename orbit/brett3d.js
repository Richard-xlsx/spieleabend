// Orbit: 3D-Brett für den gemeinsamen Bildschirm (?tv=1). Nur Anzeige, die Regeln stehen in logic.js.
// Die Raumstation als Ring aus Modulen, Astronauten in Spielerfarbe, kreisende Händlerschiffe, Kamera folgt dem Zug.
// brett.js ruft zeigen(platz, c, info) nach jedem Neuzeichnen auf; die Zeichenfläche bleibt dabei bestehen.
import * as THREE from "three";

const K = 6 / 136;                 // 2D-Einheiten (Brett 360 × 360) → 3D
const zu3 = (x, y) => [(x - 180) * K, (y - 180) * K];
let renderer = null, scene, camera, uhr, platzAlt = null, beobachter = null, ctx = null, info = null, an = false;
const module = [], figuren = new Map(), schiffe = [], ziele = [], effekte = [], gesehen = new Set();
let hub, hubRing, felderText = "";
const kamZiel = new THREE.Vector3(0, 0, 0.4), kamPos = new THREE.Vector3(0, 13, 13.5);
let hubText = null, hubStand = "";

function bauen() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = "brett3d";
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#0B1026");
  scene.fog = new THREE.Fog("#0B1026", 26, 60);
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.copy(kamPos); camera.lookAt(kamZiel);
  uhr = new THREE.Clock();
  scene.add(new THREE.HemisphereLight("#9AB8FF", "#1A1030", 1.1));
  const sonne = new THREE.DirectionalLight("#FFF4E0", 1.6); sonne.position.set(-6, 12, 8); scene.add(sonne);
  const glut = new THREE.PointLight("#2EC4B6", 6, 9, 1.6); glut.position.set(0, 1.2, 0); scene.add(glut);
  // Sterne und ein Ringplanet im Hintergrund
  const st = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i++) { const u = Math.random() * 2 - 1, w = Math.random() * Math.PI * 2, r = 70; st.set([Math.sqrt(1 - u * u) * Math.cos(w) * r, Math.abs(u) * r * 0.8 - 8, Math.sqrt(1 - u * u) * Math.sin(w) * r], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(st, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: "#EAF2FF", size: 0.25, sizeAttenuation: true, fog: false })));
  const planet = new THREE.Mesh(new THREE.SphereGeometry(7, 48, 32), new THREE.MeshStandardMaterial({ color: "#FF7A2F", roughness: 0.9 }));
  planet.position.set(-30, -6, -48); scene.add(planet);
  const pring = new THREE.Mesh(new THREE.RingGeometry(9, 12.5, 64), new THREE.MeshBasicMaterial({ color: "#FFD23F", side: THREE.DoubleSide, transparent: true, opacity: 0.55, fog: false }));
  pring.position.copy(planet.position); pring.rotation.set(-1.25, 0.2, 0.3); scene.add(pring);
  // Korridor (flacher Ring), Speichen und Mitte
  const korridor = new THREE.Mesh(new THREE.RingGeometry(136 * K - 0.85, 136 * K + 0.85, 128), new THREE.MeshStandardMaterial({ color: "#1C2550", roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide }));
  korridor.rotation.x = -Math.PI / 2; korridor.position.y = -0.12; scene.add(korridor);
  const rand = new THREE.Mesh(new THREE.TorusGeometry(136 * K + 0.85, 0.06, 8, 128), new THREE.MeshStandardMaterial({ color: "#2A3568", emissive: "#2A3568" }));
  rand.rotation.x = Math.PI / 2; rand.position.y = -0.1; scene.add(rand);
  for (const i of [4, 12, 20, 28]) {
    const w = -Math.PI / 2 + i * 2 * Math.PI / 32, l = 136 * K - 0.9 - 58 * K;
    const sp = new THREE.Mesh(new THREE.BoxGeometry(l, 0.18, 0.28), new THREE.MeshStandardMaterial({ color: "#2A3568", metalness: 0.4, roughness: 0.5 }));
    const r = 58 * K + l / 2; sp.position.set(Math.cos(w) * r, -0.05, Math.sin(w) * r); sp.rotation.y = -w; scene.add(sp);
  }
  hub = new THREE.Mesh(new THREE.CylinderGeometry(58 * K, 58 * K, 0.5, 64), new THREE.MeshStandardMaterial({ color: "#141B3D", metalness: 0.5, roughness: 0.4 }));
  hub.position.y = 0.05; scene.add(hub);
  hubRing = new THREE.Mesh(new THREE.TorusGeometry(48 * K, 0.05, 8, 96), new THREE.MeshBasicMaterial({ color: "#2EC4B6" }));
  hubRing.rotation.x = Math.PI / 2; hubRing.position.y = 0.32; scene.add(hubRing);
  // Runde in der Mitte, liegend auf der Nabe
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256;
  hubText = { cv, tex: new THREE.CanvasTexture(cv) }; hubText.tex.colorSpace = THREE.SRGBColorSpace;
  const schild = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map: hubText.tex, transparent: true }));
  schild.rotation.x = -Math.PI / 2; schild.position.y = 0.31; scene.add(schild);
}

// Feldsymbol als Textur (aus den SVG-Symbolen von brett.js)
function symbolTextur(farbe, icon) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="256" height="256"><circle cx="10" cy="10" r="10" fill="${farbe}"/><g transform="translate(3 3) scale(.7)" fill="none" stroke="#060A1C" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${icon}</g></svg>`;
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const img = new Image();
  img.onload = () => { cv.getContext("2d").drawImage(img, 0, 0, 256, 256); tex.needsUpdate = true; };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  return tex;
}
function felderBauen(R) {
  if (felderText === R.FELDER) return;
  felderText = R.FELDER;
  for (const m of module) scene.remove(m.g);
  module.length = 0;
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 0.24, 40), cache = {};
  Array.from(R.FELDER).forEach((k, i) => {
    const farbe = info.FARBE[k];
    if (!cache[k]) cache[k] = [new THREE.MeshStandardMaterial({ color: new THREE.Color(farbe).multiplyScalar(0.55), roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: symbolTextur(farbe, info.ICON[k]), roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: "#060A1C" })];
    const g = new THREE.Group(), m = new THREE.Mesh(geo, cache[k]);
    m.rotation.y = -Math.PI / 2;   // Symbol aufrecht zur Kamera
    g.add(m);
    const w = -Math.PI / 2 + i * 2 * Math.PI / R.N, r = 136 * K;
    g.position.set(Math.cos(w) * r, 0.05, Math.sin(w) * r);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: "#FFD23F" }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; ring.visible = false; g.add(ring);
    scene.add(g); module.push({ g, ring });
  });
}

// Astronaut in Spielerfarbe mit Anfangsbuchstaben darüber
function buchstabe(text, farbe) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const g = cv.getContext("2d");
  g.fillStyle = "#0A1030"; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.fill();
  g.lineWidth = 8; g.strokeStyle = farbe; g.stroke();
  g.fillStyle = farbe; g.font = "900 64px 'Exo 2', Inter, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 64, 68);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(0.5, 0.5, 1); s.renderOrder = 5;
  return s;
}
function figur(farbe, text) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.45, metalness: 0.1 });
  const koerper = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.2, 6, 16), mat); koerper.position.y = 0.3; g.add(koerper);
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 16), mat); kopf.position.y = 0.62; g.add(kopf);
  const visier = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 12, -Math.PI / 2.6, Math.PI / 1.3, Math.PI / 3, Math.PI / 2.6), new THREE.MeshStandardMaterial({ color: "#0A1030", metalness: 0.8, roughness: 0.15 }));
  visier.position.set(0, 0.63, 0.06); visier.scale.set(1.15, 1, 1.1); g.add(visier);
  const rucksack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.12), new THREE.MeshStandardMaterial({ color: "#C9D1E0" })); rucksack.position.set(0, 0.36, -0.17); g.add(rucksack);
  const b = buchstabe(text, farbe); b.position.y = 1.05; g.add(b);
  return g;
}
function schiff() {
  const g = new THREE.Group();
  const rumpf = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 6, 16), new THREE.MeshStandardMaterial({ color: "#FFD23F", roughness: 0.4, metalness: 0.3, emissive: "#3A2A00" }));
  rumpf.rotation.z = Math.PI / 2; g.add(rumpf);
  const kanzel = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: "#9AA7D1", metalness: 0.7, roughness: 0.2 })); kanzel.position.y = 0.2; g.add(kanzel);
  const licht = new THREE.PointLight("#FFD23F", 3, 3, 2); licht.position.y = 0.6; g.add(licht);
  return g;
}
function textSprite(text, farbe) {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 96;
  const g = cv.getContext("2d");
  g.font = "900 60px 'Exo 2', Inter, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 12; g.strokeStyle = "#060A1C"; g.strokeText(text, 128, 50); g.fillStyle = farbe; g.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.6, 1); s.renderOrder = 6;
  return s;
}

function positionen() {
  const orte = info.figurOrte(ctx), aus = {};
  for (const p in orte) { const [x, z] = zu3(orte[p][0], orte[p][1]); aus[p] = { x, z, gross: !!orte[p][2] }; }
  return aus;
}
function effektePruefen(orte) {
  const P = ctx.S.partie, z = P.zug, R = ctx.R;
  if (!z || !z.feld || !orte[z.pid]) return;
  const key = P.runde + ":" + z.pid + ":" + z.start, o = orte[z.pid];
  const neu = (k, fn) => { if (!gesehen.has(key + k)) { gesehen.add(key + k); fn(); } };
  const steig = (x, zz, text, farbe) => { const s = textSprite(text, farbe); s.position.set(x, 1.4, zz); scene.add(s); effekte.push({ s, t0: performance.now(), dauer: 1900, art: "steigen", y0: 1.4 }); };
  const m = /([+−-])(\d+) Energie/.exec(z.text || "");
  if (m && !z.opfer) neu(":e", () => steig(o.x, o.z, (m[1] === "+" ? "+" : "−") + m[2] + " ⚡", m[1] === "+" ? "#7BD957" : "#FF7A2F"));
  if (/Sternkristall!/.test(z.text || "")) neu(":k", () => steig(o.x, o.z, "+1 ◆", "#FFD23F"));
  if (z.opfer && orte[z.opfer]) neu(":p", () => { const v = orte[z.opfer]; steig(v.x, v.z, "−" + z.beute + " ⚡", "#FF7A2F"); steig(o.x, o.z, "+" + z.beute + " ⚡", "#7BD957"); });
  if (z.kauf) neu(":c", () => {
    const h = z.pfad.find(i => R.schiffe(P).includes(i)), w = -Math.PI / 2 + (h == null ? P.pos[z.pid] : h) * 2 * Math.PI / R.N, r = 136 * K + 1.3;
    for (let i = 0; i < z.kauf; i++) {
      const k = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: "#FFD23F", emissive: "#7A5A00", metalness: 0.6, roughness: 0.2 }));
      k.scale.y = 1.4; scene.add(k);
      effekte.push({ s: k, t0: performance.now() + i * 250, dauer: 1300, art: "flug", von: new THREE.Vector3(Math.cos(w) * r, 0.6, Math.sin(w) * r), nach: new THREE.Vector3(o.x, 0.9, o.z) });
    }
    steig(o.x, o.z, "+" + z.kauf + " ◆", "#FFD23F");
  });
}

function schritt() {
  if (!an || !renderer) return;
  requestAnimationFrame(schritt);
  const dt = Math.min(0.05, uhr.getDelta()), t = uhr.elapsedTime, glatt = 1 - Math.exp(-dt * 8);
  if (!ctx || !ctx.S || !ctx.S.partie) { renderer.render(scene, camera); return; }
  const S = ctx.S, P = S.partie, R = ctx.R, z = P.zug;
  // Figuren
  const orte = positionen(), da = new Set(Object.keys(orte));
  for (const [p, f] of figuren) if (!da.has(p)) { scene.remove(f.g); figuren.delete(p); }
  for (const p of da) {
    let f = figuren.get(p);
    const farbe = ctx.farbe(p), text = ((S.spieler[p] && S.spieler[p].name) || "?").trim().charAt(0).toUpperCase();
    if (!f || f.farbe !== farbe || f.text !== text) {
      if (f) scene.remove(f.g);
      f = { g: figur(farbe, text), farbe, text }; scene.add(f.g); figuren.set(p, f);
      f.g.position.set(orte[p].x, 0.14, orte[p].z);
    }
    const o = orte[p], g = f.g, weit = Math.hypot(g.position.x - o.x, g.position.z - o.z);
    g.position.x += (o.x - g.position.x) * glatt; g.position.z += (o.z - g.position.z) * glatt;
    const laeuft = z && z.pid === p && z.stufe === "laufen";
    const hopp = laeuft ? Math.abs(Math.sin((ctx.jetzt() - z.start) / R.ZEIT.schritt * Math.PI)) * 0.45 : weit > 2 ? Math.min(1.5, weit * 0.25) : 0;
    g.position.y += ((0.14 + hopp) - g.position.y) * Math.min(1, glatt * 2.5);
    const sk = o.gross ? 2 : 1.45; g.scale.setScalar(g.scale.x + (sk - g.scale.x) * glatt);
    g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z) * 0.6;
  }
  // Händlerschiffe kreisen außen, immer vorwärts
  const sp = R.schiffe(P);
  while (schiffe.length < sp.length) { const s = schiff(); scene.add(s); schiffe.push({ g: s, w: null }); }
  schiffe.forEach((s, k) => {
    s.g.visible = k < sp.length;
    if (k >= sp.length) return;
    let ziel = -Math.PI / 2 + sp[k] * 2 * Math.PI / R.N;
    if (s.w == null) s.w = ziel;
    while (ziel < s.w - 1e-3) ziel += Math.PI * 2;
    s.w += (ziel - s.w) * (1 - Math.exp(-dt * 1.6));
    const r = 136 * K + 1.5;
    s.g.position.set(Math.cos(s.w) * r, 0.55 + Math.sin(t * 2 + k) * 0.08, Math.sin(s.w) * r);
    s.g.rotation.y = -s.w;
  });
  module.forEach((m, i) => { m.ring.visible = sp.includes(i); m.ring.rotation.z = t; });
  // Mögliche Ziele bei der Schrittwahl
  const fr = z && z.frage && z.frage.art === "schritte" ? z : null, opt = fr ? fr.frage.optionen.map(n => (fr.von + n) % R.N) : [];
  while (ziele.length < opt.length) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 8, 40), new THREE.MeshBasicMaterial({ color: "#EAF2FF", transparent: true })); r.rotation.x = Math.PI / 2; scene.add(r); ziele.push(r); }
  ziele.forEach((r, k) => { r.visible = k < opt.length; if (r.visible) { const m = module[opt[k]]; r.position.set(m.g.position.x, 0.25, m.g.position.z); const s = 1 + 0.12 * Math.sin(t * 5); r.scale.set(s, s, s); r.material.opacity = 0.6 + 0.4 * Math.sin(t * 5); } });
  // Effekte
  effektePruefen(orte);
  const jetzt = performance.now();
  for (let i = effekte.length - 1; i >= 0; i--) {
    const e = effekte[i], k = (jetzt - e.t0) / e.dauer;
    if (k < 0) { e.s.visible = false; continue; }
    e.s.visible = true;
    if (k >= 1) { scene.remove(e.s); effekte.splice(i, 1); continue; }
    if (e.art === "steigen") { e.s.position.y = e.y0 + k * 1.2; e.s.material.opacity = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25; }
    else { e.s.position.lerpVectors(e.von, e.nach, k * k * (3 - 2 * k)); e.s.position.y += Math.sin(k * Math.PI) * 1.4; e.s.rotation.y = t * 6; }
  }
  // Kamera: folgt dem ziehenden Helm, sonst die ganze Station, leicht schwebend
  const zieht = z && orte[z.pid] && (z.stufe === "laufen" || z.stufe === "feld" || z.stufe === "handel" || (z.stufe === "fertig" && !z.frage));
  const fokus = zieht ? new THREE.Vector3(orte[z.pid].x * 0.45, 0, orte[z.pid].z * 0.45 + 0.4) : new THREE.Vector3(0, 0, 0.4);
  const abstand = zieht ? 0.8 : 1;
  kamZiel.lerp(fokus, 1 - Math.exp(-dt * 2));
  const sollPos = new THREE.Vector3(kamZiel.x + Math.sin(t * 0.12) * 0.6, 13 * abstand, kamZiel.z + 13 * abstand);
  const stand = P.runde + "/" + P.runden + (P.runde >= P.runden ? "!" : "");
  if (hubText && stand !== hubStand) {
    hubStand = stand;
    const g = hubText.cv.getContext("2d"), fin = P.runde >= P.runden;
    g.clearRect(0, 0, 512, 256); g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#9AA7D1"; g.font = "700 40px Inter, sans-serif"; g.fillText(fin ? "LETZTE RUNDE" : "RUNDE", 256, 62);
    g.fillStyle = fin ? "#FF7A2F" : "#EAF2FF"; g.font = "900 120px 'Exo 2', Inter, sans-serif"; g.fillText(P.runde + " / " + P.runden, 256, 168);
    hubText.tex.needsUpdate = true;
  }
  camera.position.lerp(sollPos, 1 - Math.exp(-dt * 2));
  camera.lookAt(kamZiel);
  hubRing.material.color.set(P.runde >= P.runden ? "#FF7A2F" : "#2EC4B6");
  hubRing.scale.setScalar(1 + 0.03 * Math.sin(t * 2));
  renderer.render(scene, camera);
}

function groesse() {
  if (!renderer || !platzAlt) return;
  const w = platzAlt.clientWidth, h = platzAlt.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1.1 ? 50 : 38;
  camera.updateProjectionMatrix();
}

export default {
  // true, wenn die 3D-Ansicht läuft; false, wenn WebGL fehlt (dann zeigt brett.js das 2D-Brett)
  zeigen(platz, c, i) {
    try { if (!renderer) { info = i; bauen(); } } catch (e) { console.warn(e); renderer = null; return false; }
    info = Object.assign(info || {}, i); ctx = c;
    felderBauen(c.R);
    if (renderer.domElement.parentNode !== platz) platz.appendChild(renderer.domElement);
    if (platzAlt !== platz) {
      platzAlt = platz;
      if (beobachter) beobachter.disconnect();
      if (window.ResizeObserver) { beobachter = new ResizeObserver(groesse); beobachter.observe(platz); }
      groesse();
    }
    if (!an) { an = true; uhr.getDelta(); requestAnimationFrame(schritt); }
    return true;
  },
  verstecken() { an = false; if (renderer && renderer.domElement.parentNode) renderer.domElement.remove(); platzAlt = null; }
};
