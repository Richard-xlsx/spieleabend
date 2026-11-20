// Würfelpoker: Physik für Becher und Würfel (cannon-es). Ohne Grafik, damit sie sich auch ohne Browser prüfen lässt.
// Einheiten: Kantenlänge eines Würfels = 1. Der Tisch liegt bei y = 0.
// Ablauf eines Wurfs: Während geschüttelt wird, läuft die Physik live (Becher folgt dem Finger, ein unsichtbarer
// Deckel hält die Würfel drin). Beim Wischen wird der Rest des Wurfs in einem Rutsch vorausberechnet und als Bahn
// aufgezeichnet. Diese Bahn spielt jedes Handy gleich ab. Welche Zahl oben liegt, entscheidet trotzdem der Spielleiter:
// Die Augen werden beim Zeichnen so auf den Würfel gelegt, dass die gewürfelte Zahl auf der oben liegenden Seite steht.
import * as CANNON from "cannon-es";

export const DT = 1 / 120, BILD = 4;               // 120 Rechenschritte pro Sekunde, jeder 4. wird aufgezeichnet (30 pro Sekunde)
export const FELD = { x0: -5, x1: 5, z0: -3.6, z1: 3.9 };   // Filzfläche mit Holzrand
export const BECHER = { r: 1.75, h: 3.1, wand: .24, boden: .3 };
export const RAUM = { x0: FELD.x0 + BECHER.r + .45, x1: FELD.x1 - BECHER.r - .45, z0: -.6, z1: FELD.z1 - BECHER.r - .45 };  // wo der Becher beim Schütteln sein darf
export const BECHER_Y = .55;                        // so hoch hält die Hand den Becher über dem Filz
export const HEIM = { x: 4.6, y: 2.2, z: 6.2 };     // Ruheplatz des leeren Bechers (vorn rechts, halb außerhalb des Bildes)
export const BEREIT = { x: 0, y: 0, z: 1.2 };       // hier steht der volle Becher, bevor jemand würfelt
const SCHWERE = -95;

const v3 = (x, y, z) => new CANNON.Vec3(x, y, z);
const klemmen = (x, a, b) => Math.max(a, Math.min(b, x));

export function becherPose(p, t) {
  // Gescripteter Verlauf beim Auskippen. p = { x, z, dx, dz, s } (Startpunkt, Richtung, Wurfstärke)
  const k1 = .3, k2 = .5, k3 = 1.05;
  const neig = t < k1 ? 1 - Math.pow(1 - t / k1, 2) : t < k2 ? 1 : Math.max(0, 1 - (t - k2) / (k3 - k2));
  const vor = Math.min(1, t / k1);
  const winkel = neig * 2.15;                         // gut 120 Grad
  let x = p.x + p.dx * 1.1 * vor, z = p.z + p.dz * 1.1 * vor, y = BECHER_Y + .9 * neig + .5 * vor;
  if (t > k2) {                                       // zurück zum Ruheplatz
    const w = Math.min(1, (t - k2) / (k3 - k2)), e = w * w * (3 - 2 * w);
    x += (HEIM.x - x) * e; y += (HEIM.y - y) * e; z += (HEIM.z - z) * e;
  }
  const ax = p.dz, az = -p.dx, l = Math.hypot(ax, az) || 1, s = Math.sin(winkel / 2);
  return { x, y, z, q: [ax / l * s, 0, az / l * s, Math.cos(winkel / 2)], fest: t < k2 + .02, fertig: t >= k3 };
}

export function erstelle() {
  const welt = new CANNON.World({ gravity: v3(0, SCHWERE, 0) });
  welt.allowSleep = false;
  welt.broadphase = new CANNON.NaiveBroadphase();
  welt.solver.iterations = 10;
  welt.defaultContactMaterial.contactEquationStiffness = 5e7;
  const mFilz = new CANNON.Material("filz"), mHolz = new CANNON.Material("holz"), mWuerfel = new CANNON.Material("wuerfel"), mBecher = new CANNON.Material("becher");
  welt.addContactMaterial(new CANNON.ContactMaterial(mWuerfel, mFilz, { friction: .32, restitution: .32 }));
  welt.addContactMaterial(new CANNON.ContactMaterial(mWuerfel, mHolz, { friction: .15, restitution: .5 }));
  welt.addContactMaterial(new CANNON.ContactMaterial(mWuerfel, mWuerfel, { friction: .12, restitution: .45 }));
  welt.addContactMaterial(new CANNON.ContactMaterial(mWuerfel, mBecher, { friction: .08, restitution: .45 }));

  const ebene = (mat, pos, achse, winkel) => {
    const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Plane() });
    b.position.set(...pos); if (achse) b.quaternion.setFromAxisAngle(v3(...achse), winkel);
    b.art = mat === mFilz ? "filz" : "holz"; welt.addBody(b); return b;
  };
  ebene(mFilz, [0, 0, 0], [1, 0, 0], -Math.PI / 2);                   // Tisch, Normale nach oben
  ebene(mHolz, [FELD.x0, 0, 0], [0, 1, 0], Math.PI / 2);              // links, Normale +x
  ebene(mHolz, [FELD.x1, 0, 0], [0, 1, 0], -Math.PI / 2);             // rechts
  ebene(mHolz, [0, 0, FELD.z0], null, 0);                             // hinten (Ablage dahinter), Normale +z
  ebene(mHolz, [0, 0, FELD.z1], [0, 1, 0], Math.PI);                  // vorn

  // Becher: Boden und ein Ring aus Wandstücken, als bewegter (kinematischer) Körper
  const becher = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: mBecher });
  // Die Wand ist für die Physik dicker als sie aussieht, damit schnell geschüttelte Würfel nicht hindurchrutschen
  const B = BECHER, n = 12, dick = .8, ri = B.r + dick / 2;
  becher.addShape(new CANNON.Box(v3(B.r + .2, .4, B.r + .2)), v3(0, -.4, 0));
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, seg = 2 * B.r * Math.tan(Math.PI / n) + .5;
    const q = new CANNON.Quaternion(); q.setFromAxisAngle(v3(0, 1, 0), -a);
    becher.addShape(new CANNON.Box(v3(dick / 2, B.h / 2 + .2, seg / 2)), v3(Math.cos(a) * ri, B.h / 2, Math.sin(a) * ri), q);
  }
  becher.art = "becher";
  welt.addBody(becher);
  const deckel = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: mBecher, shape: new CANNON.Box(v3(B.r + .6, .4, B.r + .6)) });
  deckel.art = "becher";
  welt.addBody(deckel);

  const wuerfel = [];
  for (let i = 0; i < 5; i++) {
    const b = new CANNON.Body({ mass: 1, material: mWuerfel, shape: new CANNON.Box(v3(.5, .5, .5)), linearDamping: .08, angularDamping: .12 });
    b.i = i; b.art = "wuerfel"; b.dabei = false;
    b.collisionFilterGroup = 2;
    welt.addBody(b); wuerfel.push(b);
  }

  const sim = { welt, becher, deckel, wuerfel, klang: null, zeit: 0 };
  // Stöße für die Klappergeräusche
  for (const b of wuerfel) b.addEventListener("collide", e => {
    if (!sim.klang) return;
    const o = e.body, st = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (st < 1.2) return;
    if (o.art === "wuerfel" && o.i < b.i) return;   // Würfel gegen Würfel nur einmal
    sim.klang(o.art, Math.min(1, st / 14));
  });

  // Pose des Bechers setzen. Mit dt bekommt er die passende Geschwindigkeit, damit er die Würfel anschubst.
  // Wichtig: Die Physik schiebt einen bewegten Körper im nächsten Schritt selbst um Geschwindigkeit·dt weiter.
  // Deshalb steht er vor dem Schritt auf der alten Soll-Pose und kommt durch den Schritt genau auf der neuen an.
  // (Früher stand er schon auf der neuen und wurde noch weitergeschoben, dann pendelte er heftig hin und her
  // und hat Würfel durch die Wand geschleudert.)
  const soll = { x: 0, y: 0, z: 0, q: new CANNON.Quaternion() };
  sim.becherSetzen = (x, y, z, q, dt) => {
    const qa = becher.quaternion, qz = new CANNON.Quaternion(q[0], q[1], q[2], q[3]);
    if (dt) {
      becher.velocity.set((x - soll.x) / dt, (y - soll.y) / dt, (z - soll.z) / dt);
      const d = qz.mult(soll.q.conjugate());
      if (d.w < 0) { d.x = -d.x; d.y = -d.y; d.z = -d.z; d.w = -d.w; }
      const s = Math.sqrt(1 - Math.min(1, d.w * d.w)), w = 2 * Math.acos(Math.min(1, d.w));
      if (s > 1e-6) becher.angularVelocity.set(d.x / s * w / dt, d.y / s * w / dt, d.z / s * w / dt); else becher.angularVelocity.set(0, 0, 0);
      becher.position.set(soll.x, soll.y, soll.z); qa.copy(soll.q);
    } else {
      becher.velocity.set(0, 0, 0); becher.angularVelocity.set(0, 0, 0);
      becher.position.set(x, y, z); qa.copy(qz);
    }
    soll.x = x; soll.y = y; soll.z = z; soll.q.copy(qz);
    const oben = qa.vmult(v3(0, B.h + .4, 0));
    deckel.position.set(becher.position.x + oben.x, becher.position.y + oben.y, becher.position.z + oben.z); deckel.quaternion.copy(qa);
    deckel.velocity.copy(becher.velocity).vadd(becher.angularVelocity.cross(oben), deckel.velocity);
    deckel.angularVelocity.copy(becher.angularVelocity);
  };
  // Abgeschaltete Teile ganz aus der Kollisionsprüfung nehmen, das spart viel Rechenzeit
  sim.deckelZu = zu => { deckel.collisionFilterMask = zu ? -1 : 0; };
  sim.becherAn = an => { becher.collisionFilterMask = an ? -1 : 0; };
  sim.becherSetzen(HEIM.x, HEIM.y, HEIM.z, [0, 0, 0, 1]);

  // Welche Würfel gerade mitspielen (gehaltene liegen in der Ablage und sind aus der Physik raus)
  sim.mitmachen = (i, an) => {
    const b = wuerfel[i]; b.dabei = an;
    b.type = an ? CANNON.Body.DYNAMIC : CANNON.Body.STATIC;
    b.mass = an ? 1 : 0; b.updateMassProperties();
    b.collisionResponse = an;
    b.collisionFilterMask = an ? -1 : 0;
    if (!an) { b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.position.set(0, -20 - i * 2, 0); }
    b.aabbNeedsUpdate = true;
  };
  for (let i = 0; i < 5; i++) sim.mitmachen(i, false);

  // Würfel locker in den Becher legen (in seiner aktuellen Pose)
  sim.inDenBecher = (liste, zufall = Math.random) => {
    const plaetze = [[-.62, .6, -.45], [.62, .6, -.45], [0, .6, .7], [-.4, 1.65, .2], [.45, 1.65, .1]];
    liste.forEach((i, k) => {
      const b = wuerfel[i]; if (!b.dabei) sim.mitmachen(i, true);
      const p = plaetze[k], w = becher.quaternion.vmult(v3(p[0], p[1], p[2]));
      b.position.set(becher.position.x + w.x, becher.position.y + w.y, becher.position.z + w.z);
      b.quaternion.setFromEuler(zufall() * 6.3, zufall() * 6.3, zufall() * 6.3);
      b.velocity.copy(becher.velocity); b.angularVelocity.set(0, 0, 0);
    });
  };
  // Sicherung beim Schütteln: Würfel, die durch Wand oder Deckel gedrückt wurden, zurück in den Becher holen
  const ql = new CANNON.Quaternion(), rel = v3(0, 0, 0), vr = v3(0, 0, 0);
  sim.festhalten = () => {
    becher.quaternion.conjugate(ql);
    const ra = B.r - .45, yo = B.h - .45;
    for (const b of wuerfel) {
      if (!b.dabei) continue;
      b.position.vsub(becher.position, rel); ql.vmult(rel, rel);
      b.velocity.vsub(becher.velocity, vr); ql.vmult(vr, vr);
      let neu = false;
      const r = Math.hypot(rel.x, rel.z);
      if (r > ra) {
        const nx = rel.x / r, nz = rel.z / r, raus = vr.x * nx + vr.z * nz;
        rel.x = nx * ra; rel.z = nz * ra; neu = true;
        if (raus > 0) { vr.x -= nx * raus * 1.4; vr.z -= nz * raus * 1.4; }
      }
      if (rel.y > yo) { rel.y = yo; if (vr.y > 0) vr.y = -vr.y * .4; neu = true; }
      if (rel.y < .45) { rel.y = .45; if (vr.y < 0) vr.y = -vr.y * .4; neu = true; }
      if (!neu) continue;
      becher.quaternion.vmult(rel, rel); becher.position.vadd(rel, b.position);
      becher.quaternion.vmult(vr, vr); becher.velocity.vadd(vr, b.velocity);
      b.aabbNeedsUpdate = true;
    }
  };
  sim.schritt = () => { welt.step(DT); sim.zeit += DT; if (deckel.collisionFilterMask) sim.festhalten(); };

  // Ab dem Loslassen: Auskippen und Ausrollen in einem Rutsch berechnen. Liefert Bahn (für die Wiedergabe) und Endlage.
  sim.werfen = (p, zufall = Math.random, maxSek = 7) => {
    const liste = wuerfel.filter(b => b.dabei);
    const bilder = [], klaenge = [], halt = sim.klang;
    let schritt = 0, nachgeholfen = 0;
    for (const b of liste) { b.ruhe = 0; b.klemmt = 0; }
    sim.klang = (art, st) => { if (klaenge.length < 90) klaenge.push([schritt, art === "wuerfel" ? 0 : art === "becher" ? 1 : art === "holz" ? 2 : 3, Math.round(st * 100)]); };
    const aufnehmen = () => {
      const f = [];
      for (const b of liste) f.push(Math.round(b.position.x * 100), Math.round(b.position.y * 100), Math.round(b.position.z * 100),
        Math.round(b.quaternion.x * 1000), Math.round(b.quaternion.y * 1000), Math.round(b.quaternion.z * 1000), Math.round(b.quaternion.w * 1000));
      bilder.push(f);
    };
    sim.deckelZu(false);
    aufnehmen();
    const max = Math.round(maxSek / DT);
    for (schritt = 1; schritt <= max; schritt++) {
      const t = schritt * DT, bp = becherPose(p, t);
      sim.becherSetzen(bp.x, bp.y, bp.z, bp.q, DT);
      sim.becherAn(bp.fest);
      if (schritt === Math.round(.12 / DT)) for (const b of liste) {     // der Schwung aus dem Handgelenk
        b.velocity.x += p.dx * p.s * (.8 + zufall() * .4); b.velocity.z += p.dz * p.s * (.8 + zufall() * .4); b.velocity.y += 2 + zufall() * 3;
        b.angularVelocity.x += (zufall() - .5) * 30; b.angularVelocity.z += (zufall() - .5) * 30;
      }
      welt.step(DT);
      bremsen(liste);
      if (schritt % BILD === 0) aufnehmen();
      if (t < .9) continue;
      let alleRuhig = true;
      for (const b of liste) {
        const v2 = b.velocity.lengthSquared(), w2 = b.angularVelocity.lengthSquared();
        b.ruhe = v2 < .01 && w2 < .04 ? (b.ruhe || 0) + 1 : 0;
        const gut = flach(b);
        b.klemmt = !gut && v2 < 1 && w2 < 4 ? (b.klemmt || 0) + 1 : 0;
        if (b.klemmt > 30) {                       // schief angelehnt oder obenauf: in Richtung freien Platz schubsen
          b.klemmt = 0; nachgeholfen++;
          // freien Platz suchen und im Bogen dorthin hüpfen lassen
          let bester = null, bestD = -1;
          for (let gx = FELD.x0 + .9; gx <= FELD.x1 - .9; gx += .5) for (let gz = FELD.z0 + .9; gz <= FELD.z1 - .9; gz += .5) {
            let m = 9;
            for (const o of liste) if (o !== b) m = Math.min(m, Math.hypot(gx - o.position.x, gz - o.position.z));
            const dd = m - Math.hypot(gx - b.position.x, gz - b.position.z) * .08 + zufall() * .2;
            if (dd > bestD) { bestD = dd; bester = [gx, gz]; }
          }
          const T = .42, dy = .5 - b.position.y;
          b.velocity.set((bester[0] - b.position.x) / T, (dy - .5 * SCHWERE * T * T) / T, (bester[1] - b.position.z) / T);
          b.angularVelocity.set((zufall() - .5) * 14, (zufall() - .5) * 4, (zufall() - .5) * 14);
        }
        if (b.ruhe < 24 || !gut) alleRuhig = false;
      }
      if (alleRuhig) break;
    }
    // Endlage: auf die nächste flache Seite einrasten
    const lage = liste.map(b => {
      einrasten(b);
      return [b.i, Math.round(b.position.x * 100), Math.round(b.position.y * 100), Math.round(b.position.z * 100),
        Math.round(b.quaternion.x * 1000), Math.round(b.quaternion.y * 1000), Math.round(b.quaternion.z * 1000), Math.round(b.quaternion.w * 1000)];
    });
    aufnehmen();
    sim.klang = halt;
    sim.becherSetzen(HEIM.x, HEIM.y, HEIM.z, [0, 0, 0, 1]); sim.becherAn(true); sim.deckelZu(true);
    return { nachgeholfen, bahn: { w: liste.map(b => b.i), b: bilder, k: klaenge, p: [p.x, p.z, p.dx, p.dz, p.s].map(x => Math.round(x * 1000)) }, lage, schritte: schritt };
  };

  // Würfel auf eine gespeicherte Endlage setzen (ruhend)
  sim.lageSetzen = l => {
    const b = wuerfel[l[0]]; if (!b.dabei) sim.mitmachen(l[0], true);
    b.position.set(l[1] / 100, l[2] / 100, l[3] / 100);
    b.quaternion.set(l[4] / 1000, l[5] / 1000, l[6] / 1000, l[7] / 1000); b.quaternion.normalize();
    b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
  };
  return sim;
}

// Welche Würfelachse (im Würfel selbst) nach oben zeigt, und wie gerade
export function obenAchse(q) {
  const c = new CANNON.Quaternion(q.x, q.y, q.z, q.w).conjugate().vmult(v3(0, 1, 0));
  const a = [Math.abs(c.x), Math.abs(c.y), Math.abs(c.z)], m = a.indexOf(Math.max(...a));
  const achse = [0, 0, 0]; achse[m] = Math.sign([c.x, c.y, c.z][m]) || 1;
  return { achse, gerade: a[m] };
}
// Filz bremst: cannon kennt keine Reibung gegen das Drehen um die Hochachse, also helfen wir bei liegenden Würfeln nach
function bremsen(liste) {
  for (const b of liste) {
    if (b.position.y > .56) continue;
    const g = obenAchse(b.quaternion).gerade;
    if (g < .97) continue;
    const v = b.velocity, w = b.angularVelocity, sp = Math.hypot(v.x, v.z);
    const f = sp < .6 ? .9 : .975;
    v.x *= f; v.z *= f; w.y *= .9;
    if (sp < .6) { w.x *= .9; w.z *= .9; }
  }
}
function flach(b) { return obenAchse(b.quaternion).gerade > .985 && b.position.y < .62; }
function einrasten(b) {
  const { achse } = obenAchse(b.quaternion);
  // Drehung, die die oben liegende Würfelachse genau nach oben bringt
  const welt = b.quaternion.vmult(v3(...achse)), oben = v3(0, 1, 0);
  const korr = new CANNON.Quaternion(); korr.setFromVectors(welt, oben);
  b.quaternion.copy(korr.mult(b.quaternion)); b.quaternion.normalize();
  b.position.y = .5;
}
export { klemmen };
