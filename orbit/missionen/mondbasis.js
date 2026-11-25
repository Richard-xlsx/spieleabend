// Mission „Mondbasis“ (Teams, Ziehen): Die Teams setzen abwechselnd Bauteile auf einen gemeinsamen Turm, bei der schwachen
// Schwerkraft des Mondes. Wer dran ist, zieht das Bauteil an die richtige Stelle, dreht es und lässt es los. Fällt danach
// etwas vom Turm, verliert das Team, das zuletzt gebaut hat. Steht der Turm nach allen Bauteilen noch, kommt ein Mondbeben:
// Das Team, dessen Bauteil zuerst herunterfällt, verliert.
// Live-Mission: Der Spielleiter rechnet die Physik mit planck.js (über das CDN geladen), die Handys zeichnen nur.
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const SCHWERE = -1.62, PH = 1.4, XMAX = 1.7, TIEF = -0.7, SEITE = 4;     // Plattform: halbe Breite 1,4 m, Oberkante y = 0
  const JE_TEAM = 7, ZIELEN = 15000, ABWESEND = 1500, RUHE = 600, FALLMAX = 8000, BEBENMAX = 25000, SCHLUSS = 3000;
  const BOTZEIT = 2600, DT = 1 / 60;
  const TAU = Math.PI * 2;
  // Bauteile: Maße in Metern, form box [halbe Breite, halbe Höhe] | kreis r | poly [[x, y] …] (um den Schwerpunkt)
  const kuppel = [[-0.5, -0.212], [0.5, -0.212]].concat([30, 60, 90, 120, 150].map(g => [0.5 * Math.cos(g / 180 * Math.PI), 0.5 * Math.sin(g / 180 * Math.PI) - 0.212]));
  const TYPEN = [
    { name: "Wohnmodul", box: [0.5, 0.25] },
    { name: "Träger", box: [0.9, 0.1] },
    { name: "Würfel", box: [0.3, 0.3] },
    { name: "Keil", poly: [[-0.5, -0.2], [0.5, -0.2], [0, 0.4]] },
    { name: "Tank", kreis: 0.3 },
    { name: "Antenne", box: [0.1, 0.5] },
    { name: "Kuppel", poly: kuppel },
    { name: "Sonnensegel", box: [0.7, 0.06] }
  ];
  const ausdehnung = T => (T.kreis ? T.kreis : T.box ? Math.hypot(T.box[0], T.box[1]) : Math.max(...T.poly.map(p => Math.hypot(p[0], p[1]))));
  const welten = new WeakMap();   // d → { w: planck-Welt, platte, koerper: Map id → Körper }
  const pl = () => W.planck;

  function welt(d) {
    let o = welten.get(d);
    if (o) return o;
    const P = pl(), w = new P.World({ gravity: P.Vec2(0, SCHWERE) });
    const platte = w.createBody({ type: "kinematic", position: P.Vec2(0, -0.2) });
    platte.createFixture(P.Box(PH, 0.2), { friction: 0.9 });
    o = { w, platte, koerper: new Map(), x0: 0 };
    welten.set(d, o);
    return o;
  }
  function koerperNeu(o, teil, x, y, a) {
    const P = pl(), T = TYPEN[teil.typ], b = o.w.createBody({ type: "dynamic", position: P.Vec2(x, y), angle: a });
    const sh = T.kreis ? P.Circle(T.kreis) : T.box ? P.Box(T.box[0], T.box[1]) : P.Polygon(T.poly.map(p => P.Vec2(p[0], p[1])));
    b.createFixture(sh, { density: 1, friction: 0.95, restitution: 0 });
    o.koerper.set(teil.id, b);
    return b;
  }
  // Höchster Punkt des Turms
  function oben(o) {
    let top = 0;
    for (const b of o.koerper.values()) for (let f = b.getFixtureList(); f; f = f.getNext()) { const bb = f.getAABB(0); if (bb && bb.upperBound.y > top) top = bb.upperBound.y; }
    return top;
  }
  // Wie hoch steht der Turm an der Stelle x (Strahl von oben)? −9, wenn dort nichts ist
  function hoehe(o, x) {
    const P = pl(); let h = -9;
    o.w.rayCast(P.Vec2(x, 30), P.Vec2(x, -3), (f, p, n, fr) => { h = p.y; return fr; });
    return h;
  }

  const teamVon = (d, p) => (d.teams[0].includes(p) ? 0 : 1);
  // Reihenfolge: die Teams abwechselnd, im Team reihum; Bauteile paarweise gleich, damit beide Teams dasselbe bekommen
  function plan(teams, rng) {
    const out = [];
    for (let i = 0; i < JE_TEAM; i++) {
      const typ = i === 0 ? 0 : Math.floor(rng() * TYPEN.length);
      for (let t = 0; t < 2; t++) out.push({ team: t, pid: teams[t][i % teams[t].length], typ });
    }
    return out;
  }
  const geist = d => ({ x: d.halt.x, y: d.gy, a: d.halt.r * Math.PI / 4 });

  function naechster(d) {
    d.zug += 1; d.ruhe = 0;
    if (d.zug >= d.plan.length) { d.phase = "beben"; d.seit = d.t; d.dran = null; d.bis = 0; return; }
    const z = d.plan[d.zug], T = TYPEN[z.typ];
    d.phase = "zielen"; d.seit = d.t; d.dran = z.pid; d.typ = z.typ; d.bis = d.jetzt + ZIELEN;
    d.halt = { x: 0, r: 0 }; d.gy = Math.max(d.top, 0) + 0.25 + ausdehnung(T);
  }
  function setzen(d, x, r) {
    const z = d.plan[d.zug], o = welt(d);
    d.halt = { x: Math.max(-XMAX, Math.min(XMAX, +x || 0)), r: ((Math.round(+r) || 0) % 8 + 8) % 8 };
    const g = geist(d), teil = { id: d.zug + 1, typ: z.typ, pid: z.pid, team: z.team };
    koerperNeu(o, teil, g.x, g.y, g.a);
    d.teile.push(teil); d.letzt = z.team; d.wer = z.pid;
    d.phase = "faellt"; d.seit = d.t; d.dran = null; d.bis = 0; d.ruhe = 0;
  }
  function kippt(d, team, teil, schuld) {
    d.verlierer = team; d.schuld = schuld; d.gefallen = teil ? teil.id : null;
    d.phase = "ende"; d.seit = d.t; d.dran = null;
  }

  // Bot: sucht eine flache Stelle mit genug Auflage nahe der Turmmitte (für den Tank eine Mulde), legt flache Teile flach hin
  // und zittert ein bisschen
  function botZiel(d, rng) {
    const o = welt(d), T = TYPEN[d.typ];
    let best = null, bw = Infinity;
    const lagen = T.box ? (T.box[1] > T.box[0] ? [2, 0] : [0, 2]) : [0];
    let mx = 0, n = 0; for (const b of o.koerper.values()) { mx += b.getPosition().x; n++; } mx = n ? mx / n : 0;
    for (const r of lagen) {
      const hw = T.kreis ? 0.32 : T.box ? (r === 2 ? T.box[1] : T.box[0]) : 0.5;
      for (let x = -1.3; x <= 1.31; x += 0.05) {
        const fs = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1], hs = fs.map(f => hoehe(o, x + f * (hw + 0.05)));
        if (hs.some(h => h < -1)) continue;
        const hoch = Math.max(...hs), mitte = hs[4];
        // Auflage: die höchsten Punkte unter dem Teil; nur wenn sie links und rechts der Mitte liegen, kippt es nicht
        const auf = fs.filter((f, i) => hs[i] > hoch - 0.06), lo = auf[0], hi = auf[auf.length - 1];
        let w = lo > -0.2 || hi < 0.2 ? 3 : 1 - (hi - lo) / 2;
        if (T.kreis) w = Math.abs(hs[0] - hs[8]) * 3 + Math.max(0, mitte - Math.min(hs[2], hs[6])) * 6 + (hs[1] > mitte + 0.05 && hs[7] > mitte + 0.05 ? -0.3 : 0);
        // Auflage: links und rechts knapp außerhalb sollte es nicht gleich steil abfallen
        const rand = [hoehe(o, x - hw - 0.15), hoehe(o, x + hw + 0.15)].filter(h => h < hoch - 0.3).length;
        const ph = T.box ? 2 * (r === 2 ? T.box[0] : T.box[1]) : 0.6;   // hochkant stehende Teile kippen leicht
        w += rand * 0.15 + Math.abs(x - mx * 0.5) * 0.35 + hoch * 0.1 + ph * 0.8 + rng() * 0.12;
        if (w < bw) { bw = w; best = { x, r }; }
      }
    }
    if (!best) best = { x: 0, r: 0 };
    const fehler = rng() < 0.06 ? 0.3 : 0.05;
    return { x: Math.max(-XMAX, Math.min(XMAX, best.x + (rng() - 0.5) * 2 * fehler)), r: best.r };
  }

  M.mondbasis = {
    id: "mondbasis", name: "Mondbasis", art: "Teams", ab: 4, eingabe: "Ziehen", besser: "hoch", einheit: "Bauteile",
    live: true, lenkung: "eigen",
    verfuegbar: () => !!pl(),
    kurz: "Baut abwechselnd an einem Turm. Das Team, bei dem er umkippt, verliert.",
    anleitung: [
      "Die beiden Teams setzen <b>abwechselnd Bauteile</b> auf einen gemeinsamen Turm. Auf dem Mond fällt alles langsam.",
      "Wenn du dran bist: <b>Zieh das Bauteil</b> mit dem Finger an die richtige Stelle, dreh es mit „Drehen“ und tippe auf „Loslassen“.",
      "Fällt danach etwas von der Plattform, <b>verliert das Team, das zuletzt gebaut hat</b>.",
      `Steht der Turm nach ${2 * JE_TEAM} Bauteilen noch, kommt ein <b>Mondbeben</b>: Wessen Bauteil zuerst herunterfällt, dessen Team verliert.`
    ],
    neu(tn, rng, _e, teams) {
      return { tn, teams, plan: plan(teams, rng), zug: -1, teile: [], phase: "warten", dran: null, typ: 0, halt: { x: 0, r: 0 }, gy: 1,
        top: 0, t: 0, seit: 0, bis: 0, jetzt: 0, ruhe: 0, letzt: null, wer: null, verlierer: null, schuld: null, gefallen: null, fertig: false, bz: null };
    },
    start(d, jetzt) { d.jetzt = jetzt; welt(d); naechster(d); },
    aktion(d, pid, m) {
      if (m.a !== "los") return "?";
      if (d.phase !== "zielen" || d.dran !== pid) return "Du bist gerade nicht dran.";
      setzen(d, m.x, m.r);
      return true;
    },
    takt() { return false; },
    schritt(d, dt, ein, jetzt, ctx) {
      if (d.fertig || dt <= 0) return false;
      d.t += dt * 1000; d.jetzt = jetzt;
      const o = welt(d);
      let anders = false;
      // Mondbeben: die Plattform wackelt immer stärker
      if (d.phase === "beben") {
        const tb = (d.t - d.seit) / 1000, A = Math.min(0.35, 0.03 + 0.025 * tb), om = TAU * 1.5;
        o.platte.setLinearVelocity(pl().Vec2(A * om * Math.cos(om * tb), 0));
        if (d.t - d.seit > BEBENMAX) { d.phase = "ende"; d.verlierer = -1; d.seit = d.t; anders = true; }
      } else o.platte.setLinearVelocity(pl().Vec2(-o.platte.getPosition().x * 2, 0));
      for (let n = 0; n < Math.max(1, Math.round(dt / DT)); n++) o.w.step(Math.min(DT, dt), 8, 3);
      // Ist etwas heruntergefallen?
      if (d.phase !== "ende") for (const teil of d.teile) {
        const p = o.koerper.get(teil.id).getPosition();
        // Beim Bauen verliert das Team, das zuletzt gesetzt hat, im Beben das Team des Teils, das fällt
        if (p.y < TIEF || Math.abs(p.x) > SEITE) { const beben = d.phase === "beben"; kippt(d, beben ? teil.team : d.letzt, teil, beben ? teil.pid : d.wer); anders = true; break; }
      }
      if (d.phase === "zielen") {
        const e = ein[d.dran];
        if (e) d.halt = { x: Math.max(-1, Math.min(1, e.x)) * XMAX, r: ((Math.round(e.y * 8) % 8) + 8) % 8 };
        const weg = !ctx.aktiv.includes(d.dran) && d.t - d.seit > ABWESEND;
        if (weg) { const z = botZiel(d, ctx.rng); setzen(d, z.x, z.r); anders = true; }
        else if (jetzt >= d.bis) { setzen(d, d.halt.x, d.halt.r); anders = true; }
      } else if (d.phase === "faellt") {
        let v = 0;
        for (const b of o.koerper.values()) v = Math.max(v, b.getLinearVelocity().length(), Math.abs(b.getAngularVelocity()) * 0.5);
        d.ruhe = v < 0.05 ? d.ruhe + dt * 1000 : 0;
        if (d.ruhe > RUHE || d.t - d.seit > FALLMAX) { d.top = oben(o); naechster(d); anders = true; }
      } else if (d.phase === "ende" && d.t - d.seit > SCHLUSS) { d.fertig = true; anders = true; }
      return anders;
    },
    wertung(d) { return Object.fromEntries(d.tn.map(p => [p, d.teile.filter(t => t.pid === p).length])); },
    wertText(d, p) {
      if (d.schuld === p && d.verlierer !== -1) return d.teile.length >= d.plan.length ? "Bauteil fiel im Beben zuerst" : "hat den Turm zum Kippen gebracht";
      const n = d.teile.filter(t => t.pid === p).length;
      return `${n} ${n === 1 ? "Bauteil" : "Bauteile"} gesetzt`;
    },
    ausgang(d) { return d.verlierer === null || d.verlierer === -1 ? -1 : 1 - d.verlierer; },
    bild(d) {
      const o = welten.get(d), r3 = v => Math.round(v * 1000) / 1000;
      if (!o) return { t: 0, k: [], p: 0 };
      const k = d.teile.map(t => { const b = o.koerper.get(t.id), p = b.getPosition(); return [t.id, r3(p.x), r3(p.y), r3(b.getAngle())]; });
      return { t: Math.round(d.t), k, p: r3(o.platte.getPosition().x), g: d.phase === "zielen" ? [r3(d.halt.x), d.halt.r] : null };
    },
    botEingabe(d, pid, rng) {
      if (d.phase !== "zielen" || d.dran !== pid) return { x: 0, y: 0, k: 0 };
      if (!d.bz || d.bz.zug !== d.zug) d.bz = Object.assign({ zug: d.zug, um: d.t + BOTZEIT + rng() * 1800 }, botZiel(d, rng));
      // langsam hinziehen
      const x = d.halt.x + Math.max(-0.05, Math.min(0.05, d.bz.x - d.halt.x));
      return { x: x / XMAX, y: d.bz.r / 8, k: 0 };
    },
    bot(d, pid) {
      if (d.phase !== "zielen" || d.dran !== pid || !d.bz || d.bz.zug !== d.zug || d.t < d.bz.um) return null;
      return { t: "b", a: "los", x: d.bz.x, r: d.bz.r };
    },
    sicht(d) { const v = Object.assign({}, d); delete v.bz; return v; },
    hilfe: { welt, welten, botZiel, oben, hoehe, plan, TYPEN, JE_TEAM, XMAX, PH, ZIELEN }
  };

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  const L = W.ORBIT_LIVE;
  const TEAMFARBE = ["#FF7A2F", "#4DA3FF"];
  const STERNE = Array.from({ length: 50 }, (_, i) => [((i * 97) % 100) / 100, ((i * 61 + 17) % 100) / 100, i % 5 ? 0.7 : 1.4]);
  const BREITE = 5.4, HOCH = 6.6;
  let ich = { zug: -2, x: 0, r: 0 }, zieh = null, sichtOben = 4.9;
  const meinZug = c => { const d = c.S.mission && c.S.mission.d; return d && d.phase === "zielen" && d.dran === c.PID && ich.zug === d.zug ? d : null; };
  const loslassen = c => { const d = meinZug(c); if (!d) return; ich.zug = -3; c.tun({ t: "b", a: "los", x: ich.x, r: ich.r }); };
  const drehen = () => { ich.r = (ich.r + 1) % 8; };
  W.addEventListener("keydown", e => {
    if (!document.getElementById("mondfeld") || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft") ich.x = Math.max(-XMAX, ich.x - 0.1);
    else if (e.key === "ArrowRight") ich.x = Math.min(XMAX, ich.x + 0.1);
    else if (e.key === "r" || e.key === "ArrowUp") drehen();
    else if ((e.key === " " || e.key === "Enter") && U.mondbasis.c) loslassen(U.mondbasis.c);
    else return;
    e.preventDefault();
  });
  if (L) L.steuerung = () => ({ x: Math.round(ich.x / XMAX * 100) / 100, y: ich.r / 8, k: 0 });

  function form(g, T, sk) {
    g.beginPath();
    if (T.kreis) g.arc(0, 0, T.kreis * sk, 0, TAU);
    else if (T.box) g.rect(-T.box[0] * sk, -T.box[1] * sk, 2 * T.box[0] * sk, 2 * T.box[1] * sk);
    else { T.poly.forEach((p, i) => (i ? g.lineTo(p[0] * sk, -p[1] * sk) : g.moveTo(p[0] * sk, -p[1] * sk))); g.closePath(); }
  }
  function teilZeichnen(g, T, x, y, a, sk, farbe, buchstabe, dpr, alpha) {
    g.save(); g.translate(x, y); g.rotate(-a); g.globalAlpha = alpha || 1;
    form(g, T, sk); g.fillStyle = farbe; g.fill(); g.strokeStyle = "#060A1C"; g.lineWidth = 2 * dpr; g.stroke();
    // Fenster und Streifen, damit die Teile nach Station aussehen
    g.fillStyle = "rgba(6,10,28,.35)";
    if (T.name === "Wohnmodul") for (const fx of [-0.25, 0, 0.25]) { g.beginPath(); g.arc(fx * sk, 0, 0.07 * sk, 0, TAU); g.fill(); }
    if (T.name === "Sonnensegel") for (let i = -3; i <= 3; i++) g.fillRect(i * 0.2 * sk - 1 * dpr, -0.06 * sk, 2 * dpr, 0.12 * sk);
    if (T.name === "Tank") { g.fillRect(-0.3 * sk, -0.05 * sk, 0.6 * sk, 0.1 * sk); }
    if (buchstabe && sk * 0.18 > 8 * dpr) {
      g.rotate(a); g.fillStyle = "#060A1C"; g.font = `900 ${Math.round(Math.min(0.22 * sk, 16 * dpr))}px "Exo 2", Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(buchstabe, 0, 1);
    }
    g.restore();
  }

  U.mondbasis = {
    html(d, c) {
      U.mondbasis.c = c;
      const dran = d.phase === "zielen" && d.dran === c.PID, T = TYPEN[d.typ];
      if (dran && ich.zug !== d.zug && ich.zug !== -3) ich = { zug: d.zug, x: 0, r: 0 };
      if (!dran && ich.zug === -3) ich.zug = -2;
      const t = d.teams[0].includes(c.PID) ? 0 : d.teams[1].includes(c.PID) ? 1 : -1;
      const kopf = `<div class="missionskopf"><span class="etikett">${t >= 0 ? `Team ${W.RM.TEAMNAMEN[t]}` : "Zuschauer"} · Bauteil ${Math.min(d.zug + 1, d.plan.length)} von ${d.plan.length}</span>${d.phase === "zielen" ? c.uhr(d.bis) : ""}</div>`;
      let zeile;
      if (d.phase === "ende") zeile = d.verlierer === -1 ? `<p class="mitte gross"><b>Der Turm hat das Beben überstanden!</b></p>` : `<p class="mitte gross"><b>Der Turm kippt!</b> Team ${W.RM.TEAMNAMEN[d.verlierer]} verliert.</p>`;
      else if (d.phase === "beben") zeile = `<p class="mitte gross mondbeben"><b>Mondbeben!</b> Wessen Teil fällt zuerst?</p>`;
      else if (dran) zeile = `<p class="mitte bouledran"><b>Du bist dran:</b> ${T.name}. Ziehen, drehen, loslassen.</p>`;
      else if (d.phase === "zielen") zeile = `<p class="mitte">${c.helm(d.dran)} <b>${c.esc(c.name(d.dran))}</b> setzt: ${T.name}</p>`;
      else zeile = `<p class="mitte leise">Das Bauteil fällt …</p>`;
      const knoepfe = dran && ich.zug === d.zug ? `<div class="steuerleiste"><button class="knopf zweit drehknopf" id="drehen">⟳ Drehen</button><button class="aktionsknopf loslassen" id="loslassen">Loslassen</button></div>` : "";
      return kopf + `<div class="arena-rahmen eckig frei mondrahmen"><canvas id="mondfeld" class="arena mondfeld ${dran ? "ziehbar" : ""}" aria-label="Turm auf der Mondplattform"></canvas></div>${zeile}${knoepfe}`;
    },
    binden(c) {
      U.mondbasis.c = c;
      const cv = document.getElementById("mondfeld");
      const dr = document.getElementById("drehen"), lo = document.getElementById("loslassen");
      if (dr) dr.onclick = drehen;
      if (lo) lo.onclick = () => loslassen(c);
      if (!cv) return;
      cv.addEventListener("pointerdown", e => { if (!meinZug(c)) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} zieh = { id: e.pointerId, x: e.clientX, x0: ich.x }; });
      cv.addEventListener("pointermove", e => {
        if (!zieh || e.pointerId !== zieh.id || !meinZug(c)) return;
        const m = cv.getBoundingClientRect().width / BREITE;
        ich.x = Math.max(-XMAX, Math.min(XMAX, zieh.x0 + (e.clientX - zieh.x) / m));
      });
      const ende = e => { if (zieh && e.pointerId === zieh.id) zieh = null; };
      cv.addEventListener("pointerup", ende); cv.addEventListener("pointercancel", ende);
    },
    bewegen(d, c) {
      const cv = document.getElementById("mondfeld");
      if (!cv) return;
      const dpr = Math.min(2, W.devicePixelRatio || 1), px = Math.round(cv.clientWidth * dpr), ph = Math.round(px * HOCH / BREITE);
      if (cv.width !== px || cv.height !== ph) { cv.width = px; cv.height = ph; }
      const z = L.zwischen(c.nr, c.jetzt());
      // Kamera folgt dem Turm nach oben
      const mein = meinZug(c), gy = d.gy || 1;
      const zielOben = Math.max(4.9, (d.phase === "zielen" ? gy : d.top) + 1.3);
      sichtOben += (zielOben - sichtOben) * 0.06;
      const sk = px / BREITE, X = x => px / 2 + x * sk, Y = y => (sichtOben - y) * sk;
      const g = cv.getContext("2d");
      g.fillStyle = "#050819"; g.fillRect(0, 0, px, ph);
      for (const [x, y, r] of STERNE) { g.fillStyle = "#EAF2FF"; g.globalAlpha = 0.55; g.beginPath(); g.arc(x * px, ((y * ph + sichtOben * sk * 0.2) % ph), r * dpr, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      // Erde am Himmel
      g.fillStyle = "#2E6FD1"; g.beginPath(); g.arc(px * 0.82, Y(sichtOben - 0.8), 0.32 * sk, 0, TAU); g.fill();
      g.fillStyle = "#7BD957"; g.beginPath(); g.arc(px * 0.8, Y(sichtOben - 0.75), 0.13 * sk, 0, TAU); g.fill();
      // Mondboden mit Kratern
      const boden = -1.55;
      g.fillStyle = "#4A4F66"; g.fillRect(0, Y(boden), px, ph - Y(boden));
      g.fillStyle = "#3A3E52"; for (const [kx, kr] of [[-1.9, 0.25], [0.6, 0.18], [2.1, 0.3], [-0.4, 0.12]]) { g.beginPath(); g.ellipse(X(kx), Y(boden - 0.25), kr * sk, kr * sk * 0.3, 0, 0, TAU); g.fill(); }
      // Plattform auf Stelzen
      const pxv = z ? L.mix(z.a.p || 0, z.b.p || 0, z.f) : 0;
      g.fillStyle = "#26305E"; for (const sx of [-1.1, 0, 1.1]) g.fillRect(X(pxv + sx) - 0.06 * sk, Y(-0.4), 0.12 * sk, Y(boden) - Y(-0.4));
      g.fillStyle = "#9AA7D1"; g.strokeStyle = "#060A1C"; g.lineWidth = 2 * dpr;
      g.fillRect(X(pxv - PH), Y(0), 2 * PH * sk, 0.4 * sk); g.strokeRect(X(pxv - PH), Y(0), 2 * PH * sk, 0.4 * sk);
      g.fillStyle = "#FFD23F"; for (let i = -6; i < 7; i += 2) g.fillRect(X(pxv + i * 0.2), Y(0) + 0.3 * sk, 0.2 * sk, 0.1 * sk);
      // Bauteile: glatt zwischen zwei Bildern
      if (z) {
        const A = new Map(z.a.k.map(k => [k[0], k])), teile = new Map(d.teile.map(t => [t.id, t]));
        for (const b of z.b.k) {
          const teil = teile.get(b[0]); if (!teil) continue;
          const a = A.get(b[0]) || b, x = L.mix(a[1], b[1], z.f), y = L.mix(a[2], b[2], z.f), w = L.mix(a[3], b[3], z.f);
          const markiert = d.phase === "ende" && d.gefallen === teil.id;
          teilZeichnen(g, TYPEN[teil.typ], X(x), Y(y), w, sk, TEAMFARBE[teil.team], c.anfang(teil.pid), dpr);
          if (markiert) { g.strokeStyle = "#FF5C9A"; g.lineWidth = 3 * dpr; g.beginPath(); g.arc(X(x), Y(y), 0.6 * sk, 0, TAU); g.stroke(); }
        }
      }
      // Das Bauteil, das gerade gesetzt wird (bei mir sofort, bei den anderen aus dem Bild)
      if (d.phase === "zielen" && d.dran) {
        const T = TYPEN[d.typ], team = teamVon(d, d.dran);
        const gh = mein ? { x: ich.x, r: ich.r } : z && z.b.g ? { x: L.mix(z.a.g ? z.a.g[0] : z.b.g[0], z.b.g[0], z.f), r: z.b.g[1] } : { x: d.halt.x, r: d.halt.r };
        g.strokeStyle = "rgba(234,242,255,.25)"; g.setLineDash([4 * dpr, 6 * dpr]); g.lineWidth = 1.5 * dpr;
        g.beginPath(); g.moveTo(X(gh.x), Y(gy)); g.lineTo(X(gh.x), Y(boden)); g.stroke(); g.setLineDash([]);
        teilZeichnen(g, T, X(gh.x), Y(gy), gh.r * Math.PI / 4, sk, TEAMFARBE[team], c.anfang(d.dran), dpr, mein ? 0.95 : 0.6);
        if (mein) { g.fillStyle = "#EAF2FF"; g.font = `700 ${Math.round(11 * dpr)}px Inter, sans-serif`; g.textAlign = "center"; g.fillText("‹ ziehen ›", X(gh.x), Y(gy) - (ausdehnung(T) * sk + 10 * dpr)); }
      }
      // Ganz oben: Höhe des Turms
      g.fillStyle = "#9AA7D1"; g.font = `700 ${Math.round(11 * dpr)}px Inter, sans-serif`; g.textAlign = "left"; g.textBaseline = "top";
      g.fillText(`Höhe ${(Math.max(0, d.top)).toFixed(1).replace(".", ",")} m`, 8 * dpr, 8 * dpr);
    }
  };
})();
