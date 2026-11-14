// Gleisgenossen: die 3D-Welt (Three.js). Zeichnet Karte, Gleise, Bahnhöfe und fahrende Züge, meldet angetippte Felder.
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";

const W3 = Math.sqrt(3), GY = .35, TY = .37;
const HOEHE = { ".": GY, w: GY, h: .62, b: .5, "~": .12, x: GY };
const FARBE = {
  ".": [0x9BD45A, 0x8FCB50, 0xA5DA66], w: [0x84C04F, 0x7DB84A], h: [0x7FB64B, 0x76AD45],
  "~": [0x4F86D9, 0x4A80D2], b: [0x9C9C8E, 0xA6A496], x: [0x9BD45A, 0x8FCB50]
};
const WAND = [0xF3E6CC, 0xF9C7A8, 0xE8E1F5, 0xFFE3A3, 0xD9EEF7], DACH = [0xC9553D, 0x8C4A3A, 0x4A5A8C, 0xB8643C];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mats = new Map();
function mat(farbe, extra) {
  const key = farbe + (extra ? JSON.stringify(extra) : "");
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial(Object.assign({ color: farbe, roughness: .9, metalness: 0, flatShading: true }, extra)));
  return mats.get(key);
}
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function schatten(o) { o.traverse(k => { if (k.isMesh) { k.castShadow = true; k.receiveShadow = true; } }); return o; }
function balken(a, b, dicke, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(dicke, dicke, Math.max(.001, a.distanceTo(b))), material);
  m.position.copy(a).add(b).multiplyScalar(.5); m.lookAt(b); m.castShadow = true; return m;
}
function leeren(g) {
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); } });
  while (g.children.length) g.remove(g.children[0]);
}
// Beschriftung als Sprite (immer zur Kamera gedreht)
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

export class Welt {
  constructor(el) {
    this.el = el;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(el.clientWidth || innerWidth, el.clientHeight || innerHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(r.domElement);
    const sc = this.scene = new THREE.Scene();
    sc.fog = new THREE.Fog(0xD7EDF6, 50, 110);
    this.camera = new THREE.PerspectiveCamera(45, 1, .1, 250);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x5f7f4a, 1.7));
    const s = this.sonne = new THREE.DirectionalLight(0xfff1d6, 2.6);
    s.castShadow = true; s.shadow.mapSize.set(2048, 2048); s.shadow.bias = -.0006; sc.add(s); sc.add(s.target);
    const c = this.controls = new MapControls(this.camera, r.domElement);
    c.enableDamping = true; c.dampingFactor = .08; c.minDistance = 4; c.maxDistance = 50;
    c.minPolarAngle = .2; c.maxPolarAngle = 1.22; c.zoomToCursor = true;
    c.addEventListener("change", () => this.begrenzen());
    this.gTerrain = new THREE.Group(); this.gNetz = new THREE.Group(); this.gZuege = new THREE.Group(); this.gVorschau = new THREE.Group(); this.gMarken = new THREE.Group(); this.gEffekte = new THREE.Group();
    [this.gTerrain, this.gNetz, this.gZuege, this.gVorschau, this.gMarken, this.gEffekte].forEach(g => sc.add(g));
    this.zuege = []; this.muenzenListe = []; this.rauchQuellen = []; this.wolken = [];
    const wg = new THREE.IcosahedronGeometry(.13, 0);
    for (let i = 0; i < 120; i++) { const m = new THREE.Mesh(wg, new THREE.MeshLambertMaterial({ color: 0xF4F4F6, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; this.gEffekte.add(m); this.wolken.push({ m, alter: 9 }); }
    this.wNr = 0;
    this.onTap = null;
    this.tippen();
    this.uhr = new THREE.Clock();
    addEventListener("resize", () => this.groesse());
    this.groesse();
    const schleife = () => { this.bild(); requestAnimationFrame(schleife); };
    requestAnimationFrame(schleife);
  }
  groesse() {
    const w = this.el.clientWidth || innerWidth, h = this.el.clientHeight || innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
  }
  pos(i) { const K = this.K, c = i % K.B, r = (i / K.B) | 0; return { x: W3 * (c + .5 * (r & 1)) - this.ox, z: 1.5 * r - this.oz }; }
  mitte(a, b) { const p = this.pos(a), q = this.pos(b); return { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }; }
  begrenzen() {
    if (!this.K) return;
    const t = this.controls.target, bx = W3 * this.K.B / 2, bz = .75 * this.K.H;
    const vx = Math.max(-bx, Math.min(bx, t.x)) - t.x, vz = Math.max(-bz, Math.min(bz, t.z)) - t.z;
    if (vx || vz) { t.x += vx; t.z += vz; this.camera.position.x += vx; this.camera.position.z += vz; }
  }
  uebersicht() {
    if (!this.K) return;
    const hoch = this.camera.aspect < 1, breit = W3 * this.K.B, tief = 1.5 * this.K.H;
    // so weit weg, dass die Breite (hochkant) bzw. die Tiefe (quer) ins Bild passt
    const d = hoch ? breit / this.camera.aspect * .82 : Math.max(tief * 1.15, breit / this.camera.aspect * .6);
    this.controls.target.set(0, 0, hoch ? tief * .1 : tief * .05);
    this.camera.position.set(-d * .12, d * .78, this.controls.target.z + d * .6);
    this.controls.update();
  }
  // ---------- Antippen ----------
  tippen() {
    const el = this.renderer.domElement, ray = new THREE.Raycaster(), maus = new THREE.Vector2();
    let aktiv = 0, start = null;
    el.addEventListener("pointerdown", e => { aktiv++; start = aktiv === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
    const ende = e => {
      aktiv = Math.max(0, aktiv - 1);
      if (!start || e.type === "pointercancel" || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 9 || performance.now() - start.t > 500) { start = null; return; }
      start = null;
      if (!this.feldMesh || !this.onTap) return;
      const r = el.getBoundingClientRect();
      maus.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(maus, this.camera);
      const t = ray.intersectObject(this.feldMesh)[0];
      if (t) this.onTap(t.instanceId);
    };
    addEventListener("pointerup", ende); addEventListener("pointercancel", ende);
  }

  // ---------- Karte ----------
  karteSetzen(K) {
    if (this.K && this.K.seed === K.seed && this.K.B === K.B && this.K.g === K.g) return;
    this.K = K; this.ox = W3 * (K.B - .5) / 2; this.oz = 1.5 * (K.H - 1) / 2;
    leeren(this.gTerrain); leeren(this.gNetz); leeren(this.gZuege); leeren(this.gVorschau); leeren(this.gMarken);
    this.netzKey = null; this.zugKey = null; this.zuege = []; this.rauchQuellen = [];
    const z = rng(K.seed + 17), n = K.B * K.H, hilf = new THREE.Object3D(), col = new THREE.Color();
    // Felder
    const fm = this.feldMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, .5, 0), mat(0xffffff), n);
    this.hoehe = [];
    for (let i = 0; i < n; i++) {
      const t = K.g[i], p = this.pos(i), h = t === "h" ? HOEHE.h + z() * .2 : HOEHE[t];
      this.hoehe.push(h);
      hilf.position.set(p.x, 0, p.z); hilf.scale.set(1, h, 1); hilf.updateMatrix(); fm.setMatrixAt(i, hilf.matrix);
      const l = FARBE[t]; fm.setColorAt(i, col.setHex(l[Math.floor(z() * l.length)]));
    }
    fm.receiveShadow = true; this.gTerrain.add(fm);
    const so = new THREE.Mesh(new THREE.BoxGeometry(W3 * K.B + 1.6, 1.4, 1.5 * K.H + 1.3), mat(0x7A5A3F));
    so.position.set(W3 / 4, -.7, 0); this.gTerrain.add(so);
    // Licht und Schatten passend zur Kartengröße
    const gr = Math.max(W3 * K.B, 1.5 * K.H) / 2 + 3;
    this.sonne.position.set(-gr * .6, gr * 1.1, gr * .5);
    Object.assign(this.sonne.shadow.camera, { left: -gr, right: gr, top: gr, bottom: -gr, near: 1, far: gr * 4 }); this.sonne.shadow.camera.updateProjectionMatrix();
    // Berge
    this.berge = {};
    for (let i = 0; i < n; i++) if (K.g[i] === "b") {
      const p = this.pos(i), hb = 1.3 + z() * 1.3, g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.ConeGeometry(.95, hb, 5), mat(0x8E8B84)); b.position.y = hb / 2; g.add(b);
      const s = new THREE.Mesh(new THREE.ConeGeometry(.34, hb * .36, 5), mat(0xF7F7FA)); s.position.y = hb * .82 + .01; g.add(s);
      g.position.set(p.x, this.hoehe[i], p.z); g.rotation.y = z() * 6; this.gTerrain.add(schatten(g)); this.berge[i] = g;
    }
    // Orte und Betriebe
    const zentren = new Set(K.orte.map(o => o.zelle)), deko = new Set(K.orte.flatMap(o => o.deko));
    K.orte.forEach(o => this.ortBauen(o, z));
    // Bäume (pro Feld gemerkt, damit Gleise sie roden können)
    const baeume = []; this.baumVon = {};
    for (let i = 0; i < n; i++) {
      const t = K.g[i]; if (zentren.has(i) || deko.has(i)) continue;
      const anzahl = t === "w" ? 3 + Math.floor(z() * 3) : t === "h" ? (z() < .4 ? 1 : 0) : t === "." ? (z() < .1 ? 1 : 0) : 0;
      const p = this.pos(i); this.baumVon[i] = [];
      for (let k = 0; k < anzahl; k++) { this.baumVon[i].push(baeume.length); baeume.push({ x: p.x + (z() - .5) * 1.2, z: p.z + (z() - .5) * 1.2, y: this.hoehe[i], s: .7 + z() * .55, r: z() * 6, f: Math.floor(z() * 4) }); }
    }
    this.baeume = baeume;
    const kr = this.kronen = new THREE.InstancedMesh(new THREE.ConeGeometry(.32, .9, 7).translate(0, .62, 0), mat(0xffffff), Math.max(1, baeume.length));
    const st = this.staemme = new THREE.InstancedMesh(new THREE.CylinderGeometry(.06, .07, .24, 5).translate(0, .12, 0), mat(0x7A5234), Math.max(1, baeume.length));
    baeume.forEach((b, i) => { kr.setColorAt(i, col.setHex([0x2F8A4A, 0x3A9A52, 0x2A7D44, 0x4BA35A][b.f])); });
    this.baeumeSetzen(new Set());
    [kr, st].forEach(m => { m.castShadow = true; m.receiveShadow = true; this.gTerrain.add(m); });
    this.uebersicht();
  }
  baeumeSetzen(gerodet) {
    const hilf = new THREE.Object3D();
    const weg = new Set(); gerodet.forEach(i => (this.baumVon[i] || []).forEach(k => weg.add(k)));
    this.baeume.forEach((b, i) => {
      hilf.position.set(b.x, b.y, b.z); hilf.rotation.y = b.r; hilf.scale.setScalar(weg.has(i) ? 0 : b.s); hilf.updateMatrix();
      this.kronen.setMatrixAt(i, hilf.matrix); this.staemme.setMatrixAt(i, hilf.matrix);
    });
    this.kronen.instanceMatrix.needsUpdate = true; this.staemme.instanceMatrix.needsUpdate = true;
  }
  haus(g, x, z, y, b, t, h, wand, dach, dreh) {
    const k = new THREE.Group();
    const kv = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), mat(wand)); kv.position.y = h / 2; k.add(kv);
    const form = new THREE.Shape([new THREE.Vector2(-b * .58, 0), new THREE.Vector2(b * .58, 0), new THREE.Vector2(0, b * .42)]);
    const d = new THREE.Mesh(new THREE.ExtrudeGeometry(form, { depth: t * 1.08, bevelEnabled: false }).translate(0, 0, -t * .54), mat(dach)); d.position.y = h; k.add(d);
    const f = new THREE.Mesh(new THREE.BoxGeometry(b * 1.01, h * .22, t * .5), mat(0x3B4A6B)); f.position.y = h * .6; k.add(f);
    k.position.set(x, y, z); k.rotation.y = dreh; g.add(schatten(k)); return k;
  }
  ortBauen(o, z) {
    const g = new THREE.Group(), p = this.pos(o.zelle);
    // gepflasterter Platz für den Bahnhof
    const platz = new THREE.Mesh(new THREE.CylinderGeometry(.82, .82, .03, 6), mat(0xD8D2C4)); platz.position.set(p.x, GY + .015, p.z); platz.receiveShadow = true; g.add(platz);
    const dk = o.deko.map(i => ({ i, p: this.pos(i) }));
    const um = (q, r) => ({ x: q.x + (z() - .5) * r, z: q.z + (z() - .5) * r });
    if (o.typ === "stadt") {
      dk.forEach(({ p: q }) => {
        const n = 3 + Math.floor(z() * 2);
        for (let k = 0; k < n; k++) {
          const w = k / n * Math.PI * 2 + z() * .6, rr = k === 0 ? 0 : .52;
          this.haus(g, q.x + Math.cos(w) * rr, q.z + Math.sin(w) * rr, GY, .45 + z() * .3, .5 + z() * .35, .4 + z() * (.25 + o.groesse * .18), WAND[Math.floor(z() * 5)], DACH[Math.floor(z() * 4)], Math.floor(z() * 4) * Math.PI / 2);
        }
      });
      // Kirchturm im größten Ort
      if (o.groesse >= 3 && dk[0]) {
        const q = dk[0].p, t = new THREE.Mesh(new THREE.BoxGeometry(.32, 1.3, .32), mat(0xF3E6CC)); t.position.set(q.x, GY + .65, q.z); g.add(schatten(t));
        const s = new THREE.Mesh(new THREE.ConeGeometry(.26, .6, 4), mat(0x3E7D6B)); s.position.set(q.x, GY + 1.6, q.z); s.rotation.y = Math.PI / 4; g.add(schatten(s));
      }
    } else if (o.typ === "zeche") {
      const q = dk[0].p, gr = new THREE.Group();
      const halle = new THREE.Mesh(new THREE.BoxGeometry(.9, .5, .6), mat(0xB65C3A)); halle.position.set(-.2, .25, .3); gr.add(halle);
      const dach = new THREE.Mesh(new THREE.BoxGeometry(.95, .06, .65), mat(0x4A3B33)); dach.position.set(-.2, .53, .3); gr.add(dach);
      [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([a, b]) => gr.add(balken(V(.25 + a * .3, 0, -.3 + b * .3), V(.25, 1.25, -.3), .06, mat(0x3A3A44))));
      const rad = new THREE.Mesh(new THREE.TorusGeometry(.2, .035, 6, 16), mat(0x3A3A44)); rad.position.set(.25, 1.3, -.3); gr.add(rad); this.rad = this.rad || []; this.rad.push(rad);
      const kohle = new THREE.Mesh(new THREE.ConeGeometry(.4, .35, 7), mat(0x24242A)); kohle.position.set(.45, .17, .45); gr.add(kohle);
      gr.position.set(q.x, GY, q.z); gr.rotation.y = z() * 6; g.add(schatten(gr));
    } else if (o.typ === "kraftwerk") {
      const q = dk[0].p, gr = new THREE.Group();
      const halle = new THREE.Mesh(new THREE.BoxGeometry(1.1, .65, .8), mat(0xE9E4DA)); halle.position.set(0, .33, .15); gr.add(halle);
      const dach = new THREE.Mesh(new THREE.BoxGeometry(1.15, .06, .85), mat(0xC9553D)); dach.position.set(0, .68, .15); gr.add(dach);
      const turm = new THREE.Mesh(new THREE.CylinderGeometry(.3, .42, .8, 10), mat(0xB8BCC6)); turm.position.set(-.35, .4, -.45); gr.add(turm);
      [.15, .45].forEach(x => {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 1.6, 8), mat(0xE9E4DA)); s.position.set(x, .8, -.35); gr.add(s);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .16, 8), mat(0xE2453A)); ring.position.set(x, 1.45, -.35); gr.add(ring);
        this.rauchQuellen.push({ g: gr, lokal: V(x, 1.65, -.35) });
      });
      gr.position.set(q.x, GY, q.z); gr.rotation.y = z() * 6; g.add(schatten(gr));
    } else if (o.typ === "holzfaeller") {
      const q = dk[0].p;
      this.haus(g, q.x - .2, q.z + .1, GY, .55, .45, .35, 0x9A6A42, 0x5E4330, z() * 6);
      for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .7, 7), mat(0xA0663A)); s.rotation.z = Math.PI / 2; s.position.set(q.x + .35, GY + .07 + Math.floor(k / 3) * .13, q.z - .35 + (k % 3) * .15 + (k > 2 ? .07 : 0)); g.add(schatten(s)); }
      for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.ConeGeometry(.3, .9, 7).translate(0, .62, 0), mat(0x2A7D44)); const w = um(q, 1.2); s.position.set(w.x, GY, w.z); g.add(schatten(s)); }
    } else if (o.typ === "saegewerk") {
      const q = dk[0].p, gr = new THREE.Group();
      const halle = new THREE.Mesh(new THREE.BoxGeometry(1.2, .45, .55), mat(0xC28A55)); halle.position.set(0, .23, 0); gr.add(halle);
      const form = new THREE.Shape([new THREE.Vector2(-.36, 0), new THREE.Vector2(.36, 0), new THREE.Vector2(0, .3)]);
      const d = new THREE.Mesh(new THREE.ExtrudeGeometry(form, { depth: 1.3, bevelEnabled: false }).translate(0, 0, -.65), mat(0x6B4A32)); d.rotation.y = Math.PI / 2; d.position.y = .45; gr.add(d);
      for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.7, .05, .3), mat(0xE5C08A)); b.position.set(.1, .03 + k * .055, .5); gr.add(b); }
      gr.position.set(q.x, GY, q.z); gr.rotation.y = z() * 6; g.add(schatten(gr));
    }
    const unter = { stadt: ["", "kleiner Ort", "Ort", "Stadt"][o.groesse], zeche: "Kohle", kraftwerk: "nimmt Kohle", holzfaeller: "Holz", saegewerk: "nimmt Holz" }[o.typ];
    const s = schild(o.name, { unter, bg: o.typ === "stadt" ? "#1C1A33" : "#3B3561" });
    s.position.set(p.x, 1.55, p.z); g.add(s);
    this.gTerrain.add(g);
  }

  // ---------- Gleise und Bahnhöfe ----------
  // Linienzug eines Gleiswegs durch die Felder (Bögen in den Feldern, Mitte → Kante → Mitte)
  zellenLinie(zellen) {
    const pts = [], halt = [];
    const push = (x, z) => { const l = pts[pts.length - 1]; if (!l || Math.hypot(l.x - x, l.z - z) > 1e-4) pts.push({ x, z }); };
    const n = zellen.length;
    if (n === 1) { const p = this.pos(zellen[0]); return { pts: [p, p], halt: [0] }; }
    for (let k = 0; k < n; k++) {
      const c = this.pos(zellen[k]);
      if (k === 0) { const m = this.mitte(zellen[0], zellen[1]); halt[0] = pts.length; push(c.x, c.z); for (let t = 1; t <= 4; t++) push(c.x + (m.x - c.x) * t / 4, c.z + (m.z - c.z) * t / 4); }
      else if (k === n - 1) { const m = this.mitte(zellen[k - 1], zellen[k]); for (let t = 1; t <= 4; t++) push(m.x + (c.x - m.x) * t / 4, m.z + (c.z - m.z) * t / 4); halt[k] = pts.length - 1; }
      else {
        const a = this.mitte(zellen[k - 1], zellen[k]), b = this.mitte(zellen[k], zellen[k + 1]);
        for (let t = 1; t <= 8; t++) { const u = t / 8, x = (1 - u) ** 2 * a.x + 2 * (1 - u) * u * c.x + u * u * b.x, z = (1 - u) ** 2 * a.z + 2 * (1 - u) * u * c.z + u * u * b.z; push(x, z); if (t === 4) halt[k] = pts.length - 1; }
      }
    }
    return { pts, halt };
  }
  // Gleisstücke je Feld: zwei Anschlüsse → Bogen, sonst Strahlen von der Mitte
  netzLinien(adj) {
    const linien = [];
    for (const [c, nb] of adj) {
      const p = this.pos(c), ms = nb.map(n => this.mitte(c, n));
      if (ms.length === 2) {
        const l = []; for (let t = 0; t <= 8; t++) { const u = t / 8; l.push({ x: (1 - u) ** 2 * ms[0].x + 2 * (1 - u) * u * p.x + u * u * ms[1].x, z: (1 - u) ** 2 * ms[0].z + 2 * (1 - u) * u * p.z + u * u * ms[1].z }); }
        linien.push({ c, l });
      } else ms.forEach(m => { const l = []; for (let t = 0; t <= 4; t++) l.push({ x: p.x + (m.x - p.x) * t / 4, z: p.z + (m.z - p.z) * t / 4 }); linien.push({ c, l }); });
    }
    return linien;
  }
  band(linien, breite, y, versatz = 0) {
    const pos = [], idx = [];
    for (const l of linien) {
      const basis = pos.length / 3;
      l.forEach((p, i) => {
        const a = l[Math.max(0, i - 1)], b = l[Math.min(l.length - 1, i + 1)];
        let tx = b.x - a.x, tz = b.z - a.z; const len = Math.hypot(tx, tz) || 1; tx /= len; tz /= len;
        const nx = tz, nz = -tx;
        pos.push(p.x + nx * (versatz + breite), y, p.z + nz * (versatz + breite), p.x + nx * (versatz - breite), y, p.z + nz * (versatz - breite));
        if (i < l.length - 1) { const k = basis + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      });
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  gleisMeshes(linien, gruppe, farbe) {
    if (!linien.length) return;
    const geist = farbe !== undefined;
    const schotter = new THREE.Mesh(this.band(linien, geist ? .34 : .36, TY + (geist ? .06 : 0)), geist ? new THREE.MeshBasicMaterial({ color: farbe, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false }) : mat(0x9A8C7C, { side: THREE.DoubleSide }));
    schotter.receiveShadow = true; gruppe.add(schotter);
    if (geist) return;
    const schienen = new THREE.Mesh(this.band(linien, .028, TY + .085, .2), mat(0xC9CED6, { metalness: .5, roughness: .4, side: THREE.DoubleSide }));
    const schienen2 = new THREE.Mesh(this.band(linien, .028, TY + .085, -.2), schienen.material);
    gruppe.add(schienen, schienen2);
    const sw = [];
    for (const l of linien) {
      let rest = .12;
      for (let i = 1; i < l.length; i++) {
        const a = l[i - 1], b = l[i], d = Math.hypot(b.x - a.x, b.z - a.z);
        while (rest < d) { const u = rest / d; sw.push({ x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, w: Math.atan2(b.x - a.x, b.z - a.z) }); rest += .24; }
        rest -= d;
      }
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(.6, .05, .11), mat(0x6B4A32), Math.max(1, sw.length)), hilf = new THREE.Object3D();
    sw.forEach((s, i) => { hilf.position.set(s.x, TY + .035, s.z); hilf.rotation.set(0, s.w, 0); hilf.updateMatrix(); im.setMatrixAt(i, hilf.matrix); });
    if (!sw.length) im.count = 0;
    im.receiveShadow = true; gruppe.add(im);
  }
  netzSetzen(S, adj) {
    const key = Object.keys(S.gleise).sort().join(",") + "|" + S.bahnhoefe.join(",");
    if (key === this.netzKey) return;
    this.netzKey = key;
    leeren(this.gNetz);
    const K = this.K, linien = this.netzLinien(adj);
    this.gleisMeshes(linien.map(x => x.l), this.gNetz);
    // Hügel mit Gleis abtragen (Einschnitt), Wald roden
    const hilf = new THREE.Object3D(), mitGleis = new Set(adj.keys());
    for (let i = 0; i < K.B * K.H; i++) if (K.g[i] === "h") {
      const p = this.pos(i), h = mitGleis.has(i) ? GY : this.hoehe[i];
      hilf.position.set(p.x, 0, p.z); hilf.scale.set(1, h, 1); hilf.updateMatrix(); this.feldMesh.setMatrixAt(i, hilf.matrix);
    }
    this.feldMesh.instanceMatrix.needsUpdate = true;
    this.baeumeSetzen(mitGleis);
    // Brücken über den Fluss, Tunnelportale am Berg
    const blau = mat(0x2F6FDE), grau = mat(0x8D8F99), stein = mat(0x77736C), dunkel = mat(0x1C1A22);
    for (const { c, l } of linien) {
      if (K.g[c] === "~") {
        for (let i = 0; i < l.length - 1; i++) {
          const a = l[i], b = l[i + 1], tx = b.x - a.x, tz = b.z - a.z, len = Math.hypot(tx, tz) || 1, nx = tz / len, nz = -tx / len;
          for (const s of [-.42, .42]) {
            const A = V(a.x + nx * s, 0, a.z + nz * s), B = V(b.x + nx * s, 0, b.z + nz * s);
            this.gNetz.add(balken(A.clone().setY(TY + .55), B.clone().setY(TY + .55), .07, blau), balken(A.clone().setY(TY + .02), B.clone().setY(TY + .02), .07, blau));
            if (i % 2 === 0) this.gNetz.add(balken(A.clone().setY(TY), A.clone().setY(TY + .55), .05, blau), balken(A.clone().setY(TY + .02), B.clone().setY(TY + .55), .045, blau));
          }
        }
        const p = this.pos(c), pf = new THREE.Mesh(new THREE.CylinderGeometry(.13, .16, TY, 6), grau); pf.position.set(p.x, TY / 2, p.z); this.gNetz.add(schatten(pf));
      }
    }
    for (const [c, nb] of adj) {
      if (K.g[c] !== "b") continue;
      if (this.berge[c]) this.berge[c].scale.set(1, 1, 1);
      for (const n of nb) if (K.g[n] !== "b") {
        const m = this.mitte(c, n), p = this.pos(c), w = Math.atan2(m.x - p.x, m.z - p.z), gp = new THREE.Group();
        const rahmen = new THREE.Mesh(new THREE.BoxGeometry(.95, .75, .2), stein); rahmen.position.y = .37; gp.add(rahmen);
        const loch = new THREE.Mesh(new THREE.BoxGeometry(.6, .5, .22), dunkel); loch.position.y = .28; gp.add(loch);
        gp.position.set(p.x + (m.x - p.x) * .8, TY - .05, p.z + (m.z - p.z) * .8); gp.rotation.y = w; this.gNetz.add(schatten(gp));
      }
    }
    // Bahnhöfe: Bahnsteig entlang des ersten Gleises, Empfangsgebäude daneben
    for (const c of S.bahnhoefe) {
      const nb = adj.get(c) || []; if (!nb.length) continue;
      const p = this.pos(c), m = this.mitte(c, nb[0]);
      let dx = m.x - p.x, dz = m.z - p.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      let nx = dz, nz = -dx;
      // Seite ohne zweites Gleis wählen
      if (nb[1]) { const m2 = this.mitte(c, nb[1]); if ((m2.x - p.x) * nx + (m2.z - p.z) * nz > 0) { nx = -nx; nz = -nz; } }
      const w = Math.atan2(dx, dz);
      const bs = new THREE.Mesh(new THREE.BoxGeometry(.42, .14, 1.25), mat(0xE7E1D3)); bs.position.set(p.x + nx * .5, TY + .07, p.z + nz * .5); bs.rotation.y = w; this.gNetz.add(schatten(bs));
      const dach = new THREE.Mesh(new THREE.BoxGeometry(.46, .04, .9), mat(0xC9553D)); dach.position.set(p.x + nx * .52, TY + .5, p.z + nz * .52); dach.rotation.y = w; this.gNetz.add(schatten(dach));
      [-.35, .35].forEach(o => { const s = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .38, 5), mat(0x3A3A44)); s.position.set(p.x + nx * .6 + dx * o, TY + .3, p.z + nz * .6 + dz * o); this.gNetz.add(s); });
      const hs = new THREE.Group();
      const kv = new THREE.Mesh(new THREE.BoxGeometry(.4, .42, .6), mat(0xF0D9B5)); kv.position.y = .21; hs.add(kv);
      const form = new THREE.Shape([new THREE.Vector2(-.25, 0), new THREE.Vector2(.25, 0), new THREE.Vector2(0, .2)]);
      const dd = new THREE.Mesh(new THREE.ExtrudeGeometry(form, { depth: .66, bevelEnabled: false }).translate(0, 0, -.33), mat(0x9A3B2E)); dd.position.y = .42; hs.add(dd);
      hs.position.set(p.x + nx * .9, GY, p.z + nz * .9); hs.rotation.y = w; this.gNetz.add(schatten(hs));
    }
  }

  // ---------- Züge ----------
  lok(farbe) {
    const g = new THREE.Group(), m = mat(farbe), schwarz = mat(0x26252E), gold = mat(0xFFD447);
    const add = (geo, ma, x, y, z, rx, rz) => { const k = new THREE.Mesh(geo, ma); k.position.set(x, y, z); if (rx) k.rotation.x = rx; if (rz) k.rotation.z = rz; g.add(k); return k; };
    add(new THREE.BoxGeometry(.44, .1, 1.05), schwarz, 0, .16, 0);
    add(new THREE.CylinderGeometry(.17, .17, .66, 12), m, 0, .36, .14, Math.PI / 2);
    add(new THREE.CylinderGeometry(.18, .18, .06, 12), schwarz, 0, .36, .49, Math.PI / 2);
    add(new THREE.SphereGeometry(.05, 8, 6), gold, 0, .42, .53);
    add(new THREE.BoxGeometry(.46, .42, .36), m, 0, .42, -.33);
    add(new THREE.BoxGeometry(.47, .14, .2), mat(0xBFE3F2), 0, .52, -.33);
    add(new THREE.BoxGeometry(.52, .05, .44), schwarz, 0, .65, -.33);
    add(new THREE.CylinderGeometry(.06, .045, .2, 8), schwarz, 0, .6, .36);
    add(new THREE.SphereGeometry(.07, 8, 6), gold, 0, .53, .08);
    [-.36, -.08, .2, .42].forEach(z => add(new THREE.CylinderGeometry(.085, .085, .48, 10), schwarz, 0, .09, z, 0, Math.PI / 2));
    return schatten(g);
  }
  feldbahn(farbe) {
    const g = new THREE.Group(), m = mat(farbe), schwarz = mat(0x26252E);
    const add = (geo, ma, x, y, z, rz) => { const k = new THREE.Mesh(geo, ma); k.position.set(x, y, z); if (rz) k.rotation.z = rz; g.add(k); return k; };
    add(new THREE.BoxGeometry(.4, .1, .78), schwarz, 0, .15, 0);
    add(new THREE.BoxGeometry(.36, .26, .42), m, 0, .33, .12);
    add(new THREE.BoxGeometry(.4, .4, .3), m, 0, .4, -.22);
    add(new THREE.BoxGeometry(.41, .12, .18), mat(0xBFE3F2), 0, .5, -.22);
    add(new THREE.BoxGeometry(.46, .05, .36), schwarz, 0, .62, -.22);
    add(new THREE.CylinderGeometry(.05, .04, .2, 8), schwarz, 0, .55, .25);
    [-.22, .2].forEach(z => add(new THREE.CylinderGeometry(.08, .08, .44, 10), schwarz, 0, .08, z, Math.PI / 2));
    return schatten(g);
  }
  wagen(ladung, farbe) {
    const g = new THREE.Group(), schwarz = mat(0x26252E);
    const add = (geo, ma, x, y, z, rz) => { const k = new THREE.Mesh(geo, ma); k.position.set(x, y, z); if (rz) k.rotation.z = rz; g.add(k); return k; };
    add(new THREE.BoxGeometry(.42, .08, .82), schwarz, 0, .15, 0);
    if (ladung === "fahrgaeste") {
      add(new THREE.BoxGeometry(.44, .34, .8), mat(0xF3E6CC), 0, .36, 0);
      add(new THREE.BoxGeometry(.45, .07, .81), mat(farbe), 0, .25, 0);
      add(new THREE.BoxGeometry(.45, .1, .62), mat(0x3B4A6B), 0, .42, 0);
      add(new THREE.BoxGeometry(.48, .05, .84), mat(0x5A5866), 0, .55, 0);
    } else if (ladung === "kohle") {
      add(new THREE.BoxGeometry(.44, .24, .78), mat(0x7A5A3F), 0, .31, 0);
      add(new THREE.BoxGeometry(.38, .1, .7), mat(0x24242A), 0, .44, 0);
    } else {
      add(new THREE.BoxGeometry(.44, .06, .8), mat(0x7A5A3F), 0, .22, 0);
      [-.13, 0, .13].forEach(x => [0, 1].forEach(y => add(new THREE.CylinderGeometry(.065, .065, .76, 7), mat(0xA0663A), x + y * .065 - .03, .3 + y * .11, 0, 0).rotation.x = Math.PI / 2));
    }
    [-.25, .25].forEach(z => add(new THREE.CylinderGeometry(.07, .07, .46, 10), schwarz, 0, .08, z, Math.PI / 2));
    return schatten(g);
  }
  zuegeSetzen(S, linienWeg, LOKS) {
    const key = this.netzKey + "|" + JSON.stringify(S.zuege.map(z => [z.id, z.lok, z.ladung, z.linie, z.farbe]));
    if (key === this.zugKey) return;
    this.zugKey = key;
    const alt = new Map(this.zuege.map(z => [z.id, z]));
    leeren(this.gZuege); this.zuege = [];
    S.zuege.forEach((z, k) => {
      const w = linienWeg(S, z.linie); if (!w) return;
      const { pts, halt } = this.zellenLinie(w.pfad);
      const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
      const L = len[len.length - 1], L0 = LOKS[z.lok];
      const teile = [z.lok === "feld" ? this.feldbahn(z.farbe) : this.lok(z.farbe)];
      for (let i = 0; i < L0.wagen; i++) teile.push(this.wagen(z.ladung, z.farbe));
      const abst = [0]; for (let i = 1; i < teile.length; i++) abst.push(abst[i - 1] + (i === 1 ? (z.lok === "feld" ? .82 : .98) : .9));
      teile.forEach(t => this.gZuege.add(t));
      const laenge = abst[abst.length - 1];
      const stops = w.pos.map(pi => len[halt[pi]] ?? 0);
      const ziele = [...new Set(stops.map(s => Math.max(laenge, Math.min(L, s + laenge / 2))))].sort((a, b) => a - b);
      const vorher = alt.get(z.id);
      const zug = { id: z.id, pts, len, L, teile, abst, laenge, ziele, tempo: L0.tempo * .45, s: vorher && vorher.L === L ? vorher.s : ziele[k % ziele.length] ?? laenge, dir: vorher ? vorher.dir : 1, warten: vorher ? vorher.warten : .5 + k * .7, v: 0 };
      this.zuege.push(zug); this.zugStellen(zug);
    });
  }
  punktBei(z, s) {
    s = Math.max(0, Math.min(z.L, s));
    let lo = 0, hi = z.len.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (z.len[m] <= s) lo = m; else hi = m; }
    const a = z.pts[lo], b = z.pts[hi], d = z.len[hi] - z.len[lo] || 1, u = (s - z.len[lo]) / d;
    return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u };
  }
  zugStellen(z) {
    z.teile.forEach((t, i) => {
      const s = z.s - z.abst[i], p = this.punktBei(z, s), q = this.punktBei(z, s + .06), r = this.punktBei(z, s - .06);
      t.position.set(p.x, TY + .08, p.z); t.lookAt(q.x + (q.x - r.x) * 5, TY + .08, q.z + (q.z - r.z) * 5);
    });
  }
  zugBewegen(z, dt) {
    if (z.L < .5) return;
    if (z.warten > 0) { z.warten -= dt; return; }
    const vor = z.dir > 0 ? z.ziele.find(x => x > z.s + 1e-3) : [...z.ziele].reverse().find(x => x < z.s - 1e-3);
    if (vor === undefined) { z.dir = -z.dir; z.warten = .4; return; }
    const d = Math.abs(vor - z.s);
    z.v = Math.min(z.v + 1.5 * dt, z.tempo, Math.max(.25, Math.sqrt(2 * 1.2 * d)));
    if (d <= z.v * dt) { z.s = vor; z.v = 0; z.warten = 1.6; } else z.s += z.dir * z.v * dt;
    this.zugStellen(z);
  }

  // ---------- Vorschau, Markierungen, Münzen ----------
  vorschau(zellen, farbe = 0xFF6B57) {
    leeren(this.gVorschau);
    if (!zellen || zellen.length < 2) return;
    const { pts } = this.zellenLinie(zellen);
    this.gleisMeshes([pts], this.gVorschau, farbe);
  }
  markieren(liste) {
    leeren(this.gMarken);
    for (const m of liste || []) {
      const p = this.pos(m.zelle), h = Math.max(GY, this.hoehe[m.zelle]);
      const ring = new THREE.Mesh(new THREE.RingGeometry(.78, .97, 6, 1, Math.PI / 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: m.farbe || 0xFFD447, transparent: true, opacity: .95, depthWrite: false }));
      ring.position.set(p.x, h + .03, p.z); ring.renderOrder = 5; this.gMarken.add(ring);
      if (m.text) { const s = schild(m.text, { bg: m.bg || "#FFD447", fg: "#1C1A33", groesse: 1.25 }); s.position.set(p.x, h + .95, p.z); this.gMarken.add(s); }
    }
  }
  muenzen(liste) {
    (liste || []).forEach((m, i) => {
      const p = this.pos(m.zelle), s = schild("+" + m.betrag + " T", { bg: "#FFD447", fg: "#1C1A33", groesse: 1.4 });
      s.position.set(p.x, 1.2, p.z); s.material.opacity = 0; this.gEffekte.add(s);
      this.muenzenListe.push({ s, alter: -i * .35 });
    });
  }
  hinfliegen(zelle) {
    const p = this.pos(zelle), t = this.controls.target, dx = p.x - t.x, dz = p.z - t.z;
    t.x += dx; t.z += dz; this.camera.position.x += dx; this.camera.position.z += dz; this.controls.update();
  }
  puff(p, kraft) { const w = this.wolken[this.wNr++ % this.wolken.length]; w.m.position.copy(p); w.alter = 0; w.kraft = kraft; w.m.visible = true; w.dx = (Math.random() - .5) * .2; }
  bild() {
    const dt = Math.min(this.uhr.getDelta(), .05);
    if (!this.K || document.hidden) { if (this.K) this.renderer.render(this.scene, this.camera); return; }
    this.zuege.forEach(z => this.zugBewegen(z, dt));
    this.rauchTakt = (this.rauchTakt || 0) - dt; this.kwTakt = (this.kwTakt || 0) - dt;
    const wp = new THREE.Vector3();
    if (this.rauchTakt <= 0) { this.zuege.forEach(z => { if (z.v > .05 || Math.random() < .3) this.puff(z.teile[0].localToWorld(wp.set(0, .7, .32)), z.v > .3 ? .8 : .45); }); this.rauchTakt = .2; }
    if (this.kwTakt <= 0) { this.rauchQuellen.forEach(q => this.puff(q.g.localToWorld(wp.copy(q.lokal)), 1.3)); this.kwTakt = .4; }
    this.wolken.forEach(w => {
      if (w.alter > 2.4) { w.m.visible = false; return; }
      w.alter += dt; w.m.position.y += dt * (.45 + w.kraft * .3); w.m.position.x += dt * (.25 + w.dx);
      w.m.scale.setScalar(1 + w.alter * 1.6 * w.kraft); w.m.material.opacity = Math.max(0, .85 - w.alter / 2.6);
    });
    (this.rad || []).forEach(r => { r.rotation.z += dt * 1.5; });
    this.muenzenListe = this.muenzenListe.filter(m => {
      m.alter += dt; if (m.alter < 0) return true;
      m.s.position.y = 1.2 + m.alter * .55; m.s.material.opacity = m.alter < .3 ? m.alter / .3 : Math.max(0, 1 - (m.alter - 2.4) / .8);
      if (m.alter > 3.2) { this.gEffekte.remove(m.s); m.s.material.map.dispose(); m.s.material.dispose(); return false; }
      return true;
    });
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
