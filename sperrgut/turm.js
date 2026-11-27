// Sperrgut: ein Turm mit planck.js. Läuft im Browser (window.planck) und in node (require("planck")), ohne Zeichnung.
// Welt: 1 Feld = 1 Einheit, y zeigt nach OBEN, Palettenoberkante bei y = 0, Palette von x = −3 bis 3.
// Die Formen in teile.js haben y nach unten; hier wird y beim Anlegen umgedreht.
//
//   const t = SG_TURM.neu({ modus, folge, planck, dach })
//   t.schritt(dt)                 rechnet in festen Schritten (60 pro Sekunde)
//   t.schieben(-1|1), t.drehen(), t.fallen(), t.schnell(bool)     Steuerung des fallenden Teils
//   t.liste() → Teile zum Zeichnen [{ id, typ, x, y, a, aktiv, pizza, zerbrechlich, nass, farbe? }]
//   t.lot() → { x0, x1, y } Landestelle des fallenden Teils (ungefähr, für das Lot)
//   t.hoehe, t.bruch, t.gesetzt, t.ereignisse (Liste, wird vom Aufrufer geleert)
//   Karten: t.regen(n), t.langsam(n), t.einfuegen(typ, n), t.spanngurt(), t.festhalten(sek), t.katze(), t.wunsch(typ)
//   t.momentaufnahme() / t.wiederherstellen(liste)   knappe Liste für die kleinen Türme und fürs Neuladen
(function () {
  const ST = typeof module !== "undefined" ? require("./teile.js") : window.SG_TEILE;
  const TYPEN = Object.keys(ST.TEILE);
  const DT = 1 / 60;
  const PAL = 3;               // halbe Palettenbreite
  const SCHWERE = -12;

  function neu(opt) {
    opt = opt || {};
    const P = opt.planck || (typeof window !== "undefined" ? window.planck : require("planck"));
    const modus = opt.modus || "hoch";
    const folge = opt.folge || ST.folge(opt.seed || 1, 200);
    const dach = opt.dach || 9;
    const w = new P.World({ gravity: P.Vec2(0, SCHWERE) });
    const boden = w.createBody({ type: "static" });
    const W = { links: -PAL, rechts: PAL };
    if (modus === "wagen") {
      W.links = -5; W.rechts = 4;
      boden.createFixture(P.Box(4.5, 0.25, P.Vec2(-0.5, -0.25)), { friction: 0.8 });       // Ladeboden
      boden.createFixture(P.Box(0.25, dach / 2 + 0.25, P.Vec2(-5.25, dach / 2)), { friction: 0.6, userData: "wand" });   // Rückwand
      boden.createFixture(P.Box(4.75, 0.25, P.Vec2(-0.75, dach + 0.25)), { friction: 0.6, userData: "wand" });  // Dach
    } else {
      boden.createFixture(P.Box(PAL, 0.3, P.Vec2(0, -0.3)), { friction: 0.85 });
    }

    const t = {
      modus, dach, w, P, ereignisse: [], hoehe: 0, oben: 0, bruch: 0, gesetzt: 0, i: 0, zeit: 0,
      tempo: opt.tempo || 1.5, nass: 0, langsamN: 0, vorne: [], aktiv: null, pause: 0, festBis: 0, katzeK: null,
      dachVoll: false, inWagen: 0, verdrehtBis: 0, ende: false, farbe: opt.farbe || null,
      max: opt.max || 0, manuell: !!opt.manuell, bereit: false
    };
    const teile = new Map();     // id → { id, typ, b, pizza, zerbrechlich, nass, ruhig, imTurm, pizzaZeit }
    let naechsteId = 1, rest = 0, schnell = false;

    function koerper(typ, x, y, a, eig) {
      const T = ST.TEILE[typ];
      const b = w.createBody({ type: "dynamic", position: P.Vec2(x, y), angle: a || 0, allowSleep: true, linearDamping: 0.05, angularDamping: 0.6 });
      const reib = eig && eig.nass ? 0.06 : T.reibung;
      const fx = { density: T.dichte, friction: reib, restitution: T.federung || 0 };
      if (T.kreis) b.createFixture(P.Circle(T.kreis), fx);
      else for (const [rx, ry, rw, rh] of T.rects) b.createFixture(P.Box(rw / 2 - 0.005, rh / 2 - 0.005, P.Vec2(rx + rw / 2, -(ry + rh / 2))), fx);
      return b;
    }

    // Wo erscheint das nächste Teil?
    function startY(typ) {
      const r = ST.radius(typ);
      if (modus === "wagen") { const T = ST.TEILE[typ]; const unten = T.kreis ? T.kreis : Math.max(...T.rects.map(q => -q[1])); return dach - unten - 0.12; }
      return Math.max(t.oben, t.hoehe, 0) + 5.5 + r;
    }
    function naechstes() {
      let def;
      if (t.vorne.length) def = t.vorne.shift();
      else { def = folge[t.i % folge.length]; t.i++; }
      const typ = def.typ, nass = t.nass > 0;
      if (nass) t.nass--;
      const langsam = t.langsamN > 0;
      if (langsam) t.langsamN--;
      const b = koerper(typ, 0, startY(typ), 0, { nass });
      b.setGravityScale(0); b.setFixedRotation(true); b.setBullet(true);
      const e = { id: naechsteId++, typ, b, pizza: !!def.pizza, zerbrechlich: !!def.zerbrechlich || !!ST.TEILE[typ].zerbrechlich, nass, ruhig: 0, imTurm: false, pizzaZeit: 0, langsam };
      b.setUserData(e);
      teile.set(e.id, e);
      t.aktiv = e;
      t.ereignisse.push({ art: "neu", typ });
      // Kein Platz mehr? (Wagen voll bis unters Dach)
      if (ueberschneidet(b, b.getPosition(), b.getAngle())) { if (modus === "wagen") t.dachVoll = true; }
    }

    // Überschneidet sich der Körper an Stelle pos/Winkel a mit etwas anderem?
    function ueberschneidet(b, pos, a) {
      const xf = P.Transform(pos, a);
      for (let f = b.getFixtureList(); f; f = f.getNext()) {
        const sh = f.getShape(), aabb = new P.AABB();
        sh.computeAABB(aabb, xf, 0);
        let treffer = false;
        w.queryAABB(aabb, g => {
          if (g.getBody() === b) return true;
          const gb = g.getBody();
          if (P.testOverlap(sh, 0, g.getShape(), 0, xf, gb.getTransform())) { treffer = true; return false; }
          return true;
        });
        if (treffer) return true;
      }
      return false;
    }
    function loslassen(e) {
      if (t.aktiv !== e) return;
      const b = e.b;
      b.setGravityScale(1); b.setFixedRotation(false); b.setBullet(false);
      const v = b.getLinearVelocity();
      b.setLinearVelocity(P.Vec2(0, Math.max(v.y, -3)));
      t.aktiv = null; t.gesetzt++; t.pause = 0.4;
      t.ereignisse.push({ art: "plumps", typ: e.typ, staerke: Math.min(1, Math.abs(v.y) / 8 + 0.3) });
    }
    w.on("begin-contact", c => {
      const fa = c.getFixtureA(), fb = c.getFixtureB(), a = fa.getBody(), b = fb.getBody();
      const e = t.aktiv;
      if (!e) return;
      if (fa.getUserData() === "wand" || fb.getUserData() === "wand") return;   // an Wand oder Dach entlang: weiter steuern
      if (a === e.b || b === e.b) e.beruehrt = true;    // erst nach dem Schritt loslassen (nicht mitten im Rechnen)
    });

    // ---------- Steuerung ----------
    t.schieben = function (r) {
      const e = t.aktiv; if (!e || t.ende) return false;
      if (t.zeit < t.verdrehtBis) r = -r;
      const p = e.b.getPosition(), n = P.Vec2(p.x + 0.5 * r, p.y);
      if (n.x < W.links - 1.5 || n.x > W.rechts + 1.5) return false;
      if (ueberschneidet(e.b, n, e.b.getAngle())) return false;
      e.b.setPosition(n); e.b.setAwake(true);
      return true;
    };
    t.drehen = function () {
      const e = t.aktiv; if (!e || t.ende) return false;
      const p = e.b.getPosition(), a = e.b.getAngle() - Math.PI / 2;     // im Uhrzeigersinn auf dem Bildschirm
      for (const dx of [0, 0.5, -0.5, 1, -1]) {
        const n = P.Vec2(p.x + dx, p.y);
        if (!ueberschneidet(e.b, n, a)) { e.b.setTransform(n, a); e.b.setAwake(true); return true; }
      }
      return false;
    };
    t.fallen = function () { if (t.aktiv) { t.aktiv.sturz = true; t.ereignisse.push({ art: "fall" }); } };
    t.schnell = function (an) { schnell = !!an; };

    // ---------- Karten ----------
    t.regen = n => { t.nass = Math.max(t.nass, n || 3); };
    t.langsam = n => { t.langsamN = Math.max(t.langsamN, n || 3); };
    t.einfuegen = (typ, n) => { for (let k = 0; k < (n || 1); k++) t.vorne.push({ typ }); };
    t.wunsch = typ => { t.vorne.unshift({ typ }); };
    t.festhalten = sek => {
      t.festBis = t.zeit + (sek || 10);
      for (const e of teile.values()) if (e !== t.aktiv) { e.b.setLinearVelocity(P.Vec2(0, 0)); e.b.setAngularVelocity(0); e.b.setType("static"); e.fest = true; }
    };
    t.spanngurt = function () {
      const oben = [...teile.values()].filter(e => e !== t.aktiv && e.imTurm).sort((a, b) => b.b.getPosition().y - a.b.getPosition().y).slice(0, 4);
      const menge = new Set(oben.map(e => e.b));
      let n = 0;
      for (let c = w.getContactList(); c; c = c.getNext()) {
        if (!c.isTouching()) continue;
        const a = c.getFixtureA().getBody(), b = c.getFixtureB().getBody();
        if (menge.has(a) && (menge.has(b) || b === boden) || menge.has(b) && a === boden) {
          if (a.getType() === "static" && b.getType() === "static") continue;
          const anker = a === boden ? b.getPosition() : a.getPosition();
          w.createJoint(P.WeldJoint({}, a, b, anker)); n++;
        }
      }
      for (const e of oben) e.gurt = true;
      return n;
    };
    t.katze = function () {
      const r = 0.35, x = (Math.random() < 0.5 ? -1 : 1) * 0.5;
      const b = w.createBody({ type: "dynamic", position: P.Vec2(x, Math.max(t.hoehe, 0) + 2.5), fixedRotation: true });
      b.createFixture(P.Box(0.6, r), { density: 1.4, friction: 0.9 });
      t.katzeK = { b, seit: t.zeit, richtung: x < 0 ? 1 : -1, wechsel: t.zeit + 0.9 };
      t.ereignisse.push({ art: "miau" });
    };

    // ---------- Rechnen ----------
    function festerSchritt() {
      t.zeit += DT;
      const e = t.aktiv;
      if (e) {
        let v = t.tempo * (e.langsam ? 0.5 : 1);
        if (schnell) v = Math.max(v * 5, 7);
        if (e.sturz) v = 22;
        e.b.setLinearVelocity(P.Vec2(0, -v)); e.b.setAngularVelocity(0);
        // Wer zu tief fällt (an allem vorbei), ist Bruch
      } else if (!t.ende) {
        t.pause -= DT;
        const leer = t.max && t.i >= t.max && !t.vorne.length;
        if (t.pause <= 0 && !leer && (!t.manuell || t.bereit)) { t.bereit = false; naechstes(); }
      }
      if (t.festBis && t.zeit >= t.festBis) {
        t.festBis = 0;
        for (const x of teile.values()) if (x.fest) { x.b.setType("dynamic"); x.b.setAwake(true); x.fest = false; }
      }
      const k = t.katzeK;
      if (k) {
        const v = k.b.getLinearVelocity();
        if (t.zeit > k.wechsel) { k.richtung = -k.richtung; k.wechsel = t.zeit + 0.7 + Math.random() * 0.6; }
        k.b.setLinearVelocity(P.Vec2(k.richtung * 1.6, v.y));
        if (t.zeit - k.seit > 4.5 || k.b.getPosition().y < -3) { w.destroyBody(k.b); t.katzeK = null; }
      }
      w.step(DT, 10, 8);
      if (e && e.beruehrt) loslassen(e);
      if (e && t.aktiv === e && e.b.getPosition().y < -4) loslassen(e);
      pruefen();
    }

    function pruefen() {
      let hoch = 0, imWagen = 0, alle = 0;
      for (const e of [...teile.values()]) {
        if (e === t.aktiv) continue;
        const b = e.b, p = b.getPosition();
        // Bruch: unter die Palette gerutscht oder weit daneben
        if (p.y < -2.5 || p.x < W.links - 9 || p.x > W.rechts + 9) {
          t.ereignisse.push({ art: "bruch", typ: e.typ, x: p.x, y: Math.max(p.y, -1), zerbrechlich: e.zerbrechlich, pizza: e.pizza });
          w.destroyBody(b); teile.delete(e.id); t.bruch++;
          continue;
        }
        const v = b.getLinearVelocity(), tempo = Math.hypot(v.x, v.y), still = tempo < 0.45 && Math.abs(b.getAngularVelocity()) < 0.5;
        e.ruhig = still ? e.ruhig + DT : 0;
        const war = e.imTurm;
        // im Turm: einmal 0,5 s ruhig gelegen, und seitdem nicht ins Rutschen oder Fallen gekommen
        e.imTurm = e.fest || e.ruhig > 0.35 || (war && tempo < 1.2 && Math.abs(b.getAngularVelocity()) < 1.5);
        if (!war && e.imTurm) t.ereignisse.push({ art: "liegt", typ: e.typ });
        let top = -Infinity;
        for (let f = b.getFixtureList(); f; f = f.getNext()) { const bb = f.getAABB(0); if (bb && bb.upperBound.y > top) top = bb.upperBound.y; }
        if (p.y > -1 && top > alle) alle = top;
        if (e.imTurm) {
          if (top > hoch) hoch = top;
          if (modus === "wagen" && p.x < W.rechts && p.y > -0.2) { imWagen++; if (top > dach - 0.2) t.dachVoll = true; }
          if (e.pizza && !e.pizzaFertig) { e.pizzaZeit += DT; if (e.pizzaZeit > 2) { e.pizzaFertig = true; t.ereignisse.push({ art: "pizza", id: e.id }); } }
        }
      }
      t.hoehe = hoch; t.inWagen = imWagen; t.oben = alle;
    }

    t.schritt = function (dt) {
      rest = Math.min(rest + dt, 0.25);
      while (rest >= DT) { rest -= DT; festerSchritt(); }
    };
    t.stopp = () => { t.ende = true; if (t.aktiv) { const e = t.aktiv; w.destroyBody(e.b); teile.delete(e.id); t.aktiv = null; } };

    // ---------- Abfragen ----------
    t.liste = function () {
      const out = [];
      for (const e of teile.values()) {
        const p = e.b.getPosition();
        out.push({ id: e.id, typ: e.typ, x: p.x, y: p.y, a: e.b.getAngle(), aktiv: e === t.aktiv, im: e.imTurm, pizza: e.pizza && !e.pizzaFertig, zerbrechlich: e.zerbrechlich, nass: e.nass, gurt: !!e.gurt, fest: !!e.fest });
      }
      return out;
    };
    t.katzePos = () => (t.katzeK ? { x: t.katzeK.b.getPosition().x, y: t.katzeK.b.getPosition().y - 0.35, r: t.katzeK.richtung } : null);
    t.naechsterTyp = () => (t.vorne.length ? t.vorne[0].typ : folge[t.i % folge.length].typ);
    t.naechsteDef = () => (t.vorne.length ? t.vorne[0] : folge[t.i % folge.length]);
    // Höhe an Stelle x (Strahl von oben), ohne das fallende Teil
    t.profil = function (x, von) {
      let h = -9;
      w.rayCast(P.Vec2(x, von == null ? (modus === "wagen" ? dach - 0.02 : 60) : von), P.Vec2(x, -3), (f, p, n, fr) => {
        if (t.aktiv && f.getBody() === t.aktiv.b) return -1;
        if (t.katzeK && f.getBody() === t.katzeK.b) return -1;
        h = p.y; return fr;
      });
      return h;
    };
    // Lot: wo das fallende Teil ungefähr aufsetzt (Strahlen unter den unteren Kanten)
    t.lot = function () {
      const e = t.aktiv; if (!e) return null;
      const b = e.b, xf = b.getTransform();
      let x0 = Infinity, x1 = -Infinity, unten = Infinity, boden = -9;
      for (let f = b.getFixtureList(); f; f = f.getNext()) {
        const aabb = new P.AABB(); f.getShape().computeAABB(aabb, xf, 0);
        x0 = Math.min(x0, aabb.lowerBound.x); x1 = Math.max(x1, aabb.upperBound.x); unten = Math.min(unten, aabb.lowerBound.y);
      }
      const von = b.getPosition().y;
      for (let x = x0 + 0.05; x <= x1 - 0.04; x += 0.25) boden = Math.max(boden, t.profil(x, unten - 0.01));
      return { x0, x1, y: boden, unten };
    };
    t.momentaufnahme = function () {
      const out = [];
      for (const e of teile.values()) {
        const p = e.b.getPosition();
        out.push([e.id, TYPEN.indexOf(e.typ), Math.round(p.x * 100), Math.round(p.y * 100), Math.round(e.b.getAngle() * 1000), (e === t.aktiv ? 1 : 0) | (e.zerbrechlich ? 2 : 0) | (e.nass ? 4 : 0) | (e.pizza && !e.pizzaFertig ? 8 : 0)]);
      }
      return out;
    };
    t.wiederherstellen = function (liste, stand) {
      for (const e of teile.values()) w.destroyBody(e.b);
      teile.clear(); t.aktiv = null;
      for (const [id, ti, x, y, a, fl] of liste) {
        if (fl & 1) continue;
        const typ = TYPEN[ti], nass = !!(fl & 4);
        const b = koerper(typ, x / 100, y / 100, a / 1000, { nass });
        const e = { id, typ, b, pizza: !!(fl & 8), zerbrechlich: !!(fl & 2), nass, ruhig: 1, imTurm: true, pizzaZeit: 0 };
        b.setUserData(e); teile.set(id, e); naechsteId = Math.max(naechsteId, id + 1);
      }
      if (stand) { t.i = stand.i || 0; t.bruch = stand.bruch || 0; t.gesetzt = stand.gesetzt || 0; }
    };
    t.anzahl = () => teile.size;
    t.W = W;
    return t;
  }

  // Liste aus der Momentaufnahme lesen (für die kleinen Türme)
  function lesen(liste) {
    return (liste || []).map(([id, ti, x, y, a, fl]) => ({ id, typ: TYPEN[ti], x: x / 100, y: y / 100, a: a / 1000, aktiv: !!(fl & 1), zerbrechlich: !!(fl & 2), nass: !!(fl & 4), pizza: !!(fl & 8) }));
  }

  const SG_TURM = { neu, lesen, TYPEN, PAL, DT };
  if (typeof module !== "undefined") module.exports = SG_TURM;
  if (typeof window !== "undefined") window.SG_TURM = SG_TURM;
})();
