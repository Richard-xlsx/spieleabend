// Mission „Bordküche“ (Jeder für sich, Daumen und Neigen): Ein Tablett mit 5 Bechern durch die Gänge der Station in die
// Messe tragen. Mit dem Daumen hält man „Gehen“ gedrückt, durch Neigen hält man die Becher auf dem Tablett. In der
// Schwerelosigkeit treiben die Becher: beim Losgehen nach hinten, beim Bremsen nach vorn, in Kurven nach außen, und die
// Lüftung bläst sie zur Seite. Wer zu schnell ist, verliert Becher, wer zu langsam ist, verliert Zeit.
// Punkte: 10 pro Becher, der ankommt, plus 1 pro übrige Sekunde. Jedes Handy rechnet selbst (siehe solo.js).
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const SOLO = W.ORBIT_SOLO;
  const DAUER = 60000, LAENGE = 52, BECHER = 5, BR = 0.17, PUNKTE = 10;
  const VMAX = 3.0, ANFAHREN = 1.8, BREMSEN = 2.6;
  const KL = 0.17, KC = 0.5, KT = 1.5, LUFT = 1.15, REIB = 1.0, WACKEL = 0.22, STOSS = 0.5;
  const DS = 0.1;                                  // Abstand der Wegpunkte
  const TAU = Math.PI * 2;
  const klemm = (v, a, b) => Math.max(a, Math.min(b, v));
  function zufall(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Die Strecke: Abschnitte mit Krümmung (k > 0: Linkskurve), Lüftungen und Stöße (Schwellen) an festen Stellen
  function strecke(rs) {
    const rng = zufall(rs), teile = [{ s0: 0, s1: 4, k: 0 }];
    let s = 4, seite = rng() < 0.5 ? 1 : -1;
    while (s < LAENGE - 4) {
      const kurve = teile[teile.length - 1].k === 0 || rng() < 0.3;
      const l = kurve ? 3 + rng() * 3 : 2 + rng() * 3;
      const k = kurve ? (seite = rng() < 0.7 ? -seite : seite) * (0.18 + rng() * 0.22) : 0;
      teile.push({ s0: s, s1: Math.min(LAENGE - 4, s + l), k }); s = Math.min(LAENGE - 4, s + l);
    }
    teile.push({ s0: s, s1: LAENGE + 6, k: 0 });
    const luft = [], stoesse = [];
    for (let x = 8 + rng() * 4; x < LAENGE - 4; x += 7 + rng() * 6) luft.push({ s0: x, s1: x + 1.6, dir: rng() < 0.5 ? -1 : 1, f: 0.6 + rng() * 0.4 });
    for (let x = 12 + rng() * 5; x < LAENGE - 3; x += 9 + rng() * 8) { const w = rng() * TAU; stoesse.push({ s: x, x: Math.cos(w), y: Math.sin(w), f: 0.6 + rng() * 0.4 }); }
    // Wegpunkte (x, y nach oben, Richtung h)
    const pkt = []; let px = 0, py = 0, h = Math.PI / 2;
    for (let i = 0; i * DS <= LAENGE + 6; i++) {
      pkt.push([px, py, h]);
      h += kruemmung(teile, i * DS) * DS; px += Math.cos(h) * DS; py += Math.sin(h) * DS;
    }
    return { teile, luft, stoesse, pkt };
  }
  function kruemmung(teile, s) { for (const t of teile) if (s >= t.s0 && s < t.s1) return t.k; return 0; }
  const wind = (st, s) => { for (const l of st.luft) if (s >= l.s0 && s < l.s1) return l.dir * l.f; return 0; };

  // ---------- Das Spiel (ohne Oberfläche, für Handy, Bots und Tests) ----------
  function neu(rs) {
    const st = strecke(rs), rng = zufall(rs ^ 0x2545F491);
    const becher = [];
    for (let i = 0; i < BECHER; i++) {
      const w = i / BECHER * TAU + 0.3, r = i === BECHER - 1 ? 0 : 0.37;
      becher.push({ x: i === BECHER - 1 ? 0 : Math.cos(w) * r, y: i === BECHER - 1 ? 0 : Math.sin(w) * r, vx: 0, vy: 0, ph: [rng() * TAU, rng() * TAU, 0.6 + rng() * 0.8, 0.6 + rng() * 0.8] });
    }
    // Becher 4 steht in der Mitte, die anderen im Kreis darum
    const sim = { t: 0, s: 0, v: 0, a: 0, st, becher, weg: [], stossNr: 0, angekommen: false, punkte: BECHER * PUNKTE, meldung: null, rng };
    sim.wert = () => sim.punkte;
    sim.ende = () => sim.angekommen || sim.t >= DAUER || !sim.becher.length;
    sim.schritt = (ein, dt) => schritt(sim, ein, dt);
    sim.kraft = () => kraft(sim, 0, 0);
    return sim;
  }
  // Was die Becher gerade schiebt (ohne Neigen und Wackeln)
  function kraft(sim) {
    const k = kruemmung(sim.st.teile, sim.s);
    return { x: k * sim.v * sim.v * KC + wind(sim.st, sim.s) * LUFT, y: sim.a * KL };
  }
  function schritt(sim, ein, dt) {
    if (sim.ende()) return;
    sim.t += dt * 1000;
    // Gehen und Bremsen
    const v0 = sim.v;
    sim.v = ein.gehen ? Math.min(VMAX, sim.v + ANFAHREN * dt) : Math.max(0, sim.v - BREMSEN * dt);
    sim.a = (sim.v - v0) / dt;
    sim.s += sim.v * dt;
    // Kräfte auf die Becher
    const f = kraft(sim);
    let nx = klemm(+ein.x || 0, -1, 1), ny = klemm(+ein.y || 0, -1, 1); const nl = Math.hypot(nx, ny); if (nl > 1) { nx /= nl; ny /= nl; }
    const st = sim.st.stoesse[sim.stossNr], stoss = st && sim.s >= st.s;
    if (stoss) { sim.stossNr++; sim.meldung = { t: sim.t, text: "Rumms!" }; }
    const sek = sim.t / 1000;
    for (const b of sim.becher) {
      const wx = Math.sin(sek * b.ph[2] + b.ph[0]) * WACKEL, wy = Math.cos(sek * b.ph[3] + b.ph[1]) * WACKEL;
      b.vx += (f.x + nx * KT + wx) * dt; b.vy += (f.y + ny * KT + wy) * dt;
      if (stoss) { const s = STOSS * st.f * (0.4 + sim.v / VMAX); b.vx += st.x * s * (0.8 + 0.4 * sim.rng()); b.vy += st.y * s * (0.8 + 0.4 * sim.rng()); }
      const r = Math.exp(-REIB * dt); b.vx *= r; b.vy *= r;
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    // Becher stoßen sich ab
    for (let i = 0; i < sim.becher.length; i++) for (let j = i + 1; j < sim.becher.length; j++) {
      const a = sim.becher[i], b = sim.becher[j];
      let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy);
      if (l >= 2 * BR || l < 1e-6) continue;
      dx /= l; dy /= l; const u = (2 * BR - l) / 2;
      a.x -= dx * u; a.y -= dy * u; b.x += dx * u; b.y += dy * u;
      const vrel = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
      if (vrel > 0) { const j2 = vrel * 0.9; a.vx -= j2 * dx; a.vy -= j2 * dy; b.vx += j2 * dx; b.vy += j2 * dy; }
    }
    // Wer über den Rand treibt, schwebt davon
    for (const b of sim.becher.slice()) if (Math.hypot(b.x, b.y) > 1) {
      sim.becher = sim.becher.filter(x => x !== b);
      sim.weg.push({ x: b.x, y: b.y, vx: b.vx * 1.3 + b.x * 0.3, vy: b.vy * 1.3 + b.y * 0.3, t: sim.t });
      sim.meldung = { t: sim.t, text: "Becher weg!", schlecht: true };
    }
    if (sim.s >= LAENGE) {
      sim.angekommen = true;
      sim.punkte = sim.becher.length * PUNKTE + (sim.becher.length ? Math.ceil((DAUER - sim.t) / 1000) : 0);
    } else if (sim.t >= DAUER) sim.punkte = Math.round(sim.becher.length * PUNKTE * sim.s / LAENGE);
    else sim.punkte = sim.becher.length * PUNKTE;
  }

  // Bot: hält dagegen und zieht die Becher zur Mitte, geht langsamer vor Kurven und wenn ein Becher am Rand ist
  function botSteuer(rs, pid) {
    const r = zufall(rs ^ (pid.length * 104729 + pid.charCodeAt(pid.length - 1) * 131));
    const genau = 0.55 + r() * 0.35, mut = 0.8 + r() * 0.6;
    let rausch = { x: 0, y: 0 }, n = 0;
    return sim => {
      if (n++ % 12 === 0) rausch = { x: (r() - 0.5) * 0.5, y: (r() - 0.5) * 0.5 };
      const bs = sim.becher; if (!bs.length) return { x: 0, y: 0, gehen: true };
      let mx = 0, my = 0, vx = 0, vy = 0, rand = 0;
      for (const b of bs) { mx += b.x; my += b.y; vx += b.vx; vy += b.vy; rand = Math.max(rand, Math.hypot(b.x, b.y)); }
      mx /= bs.length; my /= bs.length; vx /= bs.length; vy /= bs.length;
      const f = kraft(sim);
      const x = (-f.x / KT - mx * 2.2 - vx * 1.6) * genau + rausch.x, y = (-f.y / KT - my * 2.2 - vy * 1.6) * genau + rausch.y;
      // Vorausschauen: kommt eine scharfe Kurve oder Lüftung?
      let kmax = 0;
      for (let s = sim.s; s < sim.s + 3.5; s += 0.5) kmax = Math.max(kmax, Math.abs(kruemmung(sim.st.teile, s)) * sim.v * sim.v * KC, Math.abs(wind(sim.st, s)) * LUFT * 0.6);
      const gehen = rand < 0.8 && kmax < mut;
      return { x: klemm(x, -1, 1), y: klemm(y, -1, 1), gehen };
    };
  }
  function botLauf(rs, pid) { return SOLO.durch(neu(rs), DAUER, botSteuer(rs, pid)); }

  M.bordkueche = Object.assign(SOLO.host({ dauer: DAUER, max: 200, botLauf }), {
    id: "bordkueche", name: "Bordküche", art: "Jeder für sich", ab: 1, eingabe: "Daumen und Neigen", besser: "hoch", einheit: "Punkte",
    kurz: "Bring das Tablett mit allen Bechern in die Messe.",
    anleitung: [
      "Halte <b>„Gehen“</b> gedrückt, um mit dem Tablett durch die Station zu laufen. Loslassen bremst.",
      "In der Schwerelosigkeit <b>treiben die Becher</b>: beim Losgehen nach hinten, beim Bremsen nach vorn, in Kurven nach außen, und die Lüftung bläst sie zur Seite.",
      "<b>Neige das Handy</b>, damit die Becher zurück in die Mitte rutschen. Ohne Sensor nimmst du den Daumen-Joystick. Wer über den Rand treibt, schwebt davon.",
      `Alle laufen dieselbe Strecke. <b>${PUNKTE} Punkte pro Becher</b>, der ankommt, und 1 Punkt pro übrige Sekunde.`
    ],
    hilfe: { neu, strecke, kruemmung, botSteuer, botLauf, DAUER, LAENGE, BECHER, PUNKTE, VMAX }
  });

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  const SN = W.ORBIT_SENSOR;
  let gehId = null, taste = false;   // Finger, der „Gehen“ hält
  W.addEventListener("keydown", e => { if (e.key === " " && document.getElementById("gehen") && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); taste = true; } });
  W.addEventListener("keyup", e => { if (e.key === " ") taste = false; });
  W.addEventListener("blur", () => { gehId = null; taste = false; });
  const los = e => { if (e.pointerId === gehId) gehId = null; };
  W.addEventListener("pointerup", los); W.addEventListener("pointercancel", los);

  function becherZeichnen(g, x, y, r, dpr, a) {
    g.save(); g.translate(x, y); g.rotate(a || 0);
    g.fillStyle = "#EAF2FF"; g.strokeStyle = "#060A1C"; g.lineWidth = 2 * dpr;
    g.beginPath(); g.arc(r * 0.95, 0, r * 0.38, -1.2, 1.2); g.lineWidth = 4 * dpr; g.strokeStyle = "#EAF2FF"; g.stroke();
    g.lineWidth = 2 * dpr; g.strokeStyle = "#060A1C";
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = "#6B3B1F"; g.beginPath(); g.arc(0, 0, r * 0.72, 0, TAU); g.fill();
    g.fillStyle = "#C98A5B"; g.beginPath(); g.arc(-r * 0.2, -r * 0.2, r * 0.25, 0, TAU); g.fill();
    g.restore();
  }

  U.bordkueche = {
    html(d, c) {
      const daumen = SN && SN.modus === "daumen";
      const stand = SOLO.standLeiste();
      if (!c.dabei) return `<div class="arena-rahmen eckig frei kuechenrahmen"><canvas id="arena" class="arena kueche"></canvas></div><p class="leise mitte">Du schaust zu. Alle spielen gleichzeitig auf ihrem Handy.</p>${stand}`;
      if (d.erg[c.PID] !== undefined) return `<p class="mitte gross">Fertig: <b>${d.erg[c.PID]}</b> Punkte</p><p class="leise mitte">Warte auf die anderen …</p>${stand}`;
      return `<div class="arena-rahmen eckig frei kuechenrahmen"><canvas id="arena" class="arena kueche" aria-label="Gang der Station und Tablett mit Bechern"></canvas></div>
        <div class="steuerleiste">
          ${daumen ? `<div class="daumenfeld" id="daumenfeld" aria-label="Joystick zum Ausbalancieren"><div class="knauf"></div></div>`
            : `<div class="neigehinweis"><svg viewBox="0 0 40 40" aria-hidden="true"><rect x="12" y="5" width="16" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="2.5" transform="rotate(-15 20 20)"/></svg><span>Neigen</span><button class="chipknopf" id="nullen">Gerade stellen</button></div>`}
          <button class="aktionsknopf gehen" id="gehen">Gehen</button>
        </div>
        <p class="leise klein mitte"><button class="link" id="steuerwechsel">${daumen ? "Mit Neigen balancieren" : "Mit Daumen balancieren"}</button></p>${stand}`;
    },
    binden(c) {
      if (SN) SN.daumen(document.getElementById("daumenfeld"));
      const k = document.getElementById("gehen");
      if (k) {
        k.addEventListener("pointerdown", e => { e.preventDefault(); gehId = e.pointerId; });
        k.addEventListener("contextmenu", e => e.preventDefault());
      }
      const w = document.getElementById("steuerwechsel");
      if (w) w.onclick = async () => {
        const neu = SN.modus === "daumen" ? "neigen" : "daumen";
        if (neu === "neigen" && SN.brauchtErlaubnis()) await SN.erlauben();
        SN.setzeModus(neu); c.neu();
      };
      const n = document.getElementById("nullen");
      if (n) n.onclick = () => SN.nullen();
    },
    bewegen(d, c) {
      const sim = SOLO.lauf(c, d, { neu, dauer: DAUER, eingabe: () => { const r = SN ? SN.richtung() : { x: 0, y: 0 }; return { x: r.x, y: r.y, gehen: gehId !== null || taste }; } });
      SOLO.standZeigen(d, c);
      const cv = document.getElementById("arena");
      const k = document.getElementById("gehen");
      if (k) k.classList.toggle("gedrueckt", gehId !== null || taste);
      if (!cv || !sim) return;
      const dpr = Math.min(2, W.devicePixelRatio || 1), px = Math.round(cv.clientWidth * dpr), ph = Math.round(px * 1.25);
      if (cv.width !== px || cv.height !== ph) { cv.width = px; cv.height = ph; }
      const g = cv.getContext("2d");
      g.fillStyle = "#070C24"; g.fillRect(0, 0, px, ph);
      // Gang von oben: die Blickrichtung zeigt immer nach oben
      const st = sim.st, i0 = Math.min(st.pkt.length - 1, Math.round(sim.s / DS)), [ax, ay, ah] = st.pkt[i0];
      const sc = px / 8, cx = px / 2, cy = ph * 0.4, rot = Math.PI / 2 - ah, co = Math.cos(rot), si = Math.sin(rot);
      const P = (x, y) => { const dx = x - ax, dy = y - ay; return [cx + (dx * co - dy * si) * sc, cy - (dx * si + dy * co) * sc]; };
      const von = Math.max(0, i0 - 30), bis = Math.min(st.pkt.length - 1, i0 + 110);
      const linie = (seite, breite) => { g.beginPath(); for (let i = von; i <= bis; i++) { const [x, y, h] = st.pkt[i]; const q = P(x - Math.sin(h) * seite * breite, y + Math.cos(h) * seite * breite); i === von ? g.moveTo(q[0], q[1]) : g.lineTo(q[0], q[1]); } };
      g.save(); g.beginPath(); g.rect(0, 0, px, ph * 0.52); g.clip();
      g.lineCap = "round"; g.lineJoin = "round";
      linie(0, 0); g.strokeStyle = "#141B3D"; g.lineWidth = 2.4 * sc; g.stroke();
      for (const s of [-1, 1]) { linie(s, 1.2); g.strokeStyle = "#4A5694"; g.lineWidth = 3 * dpr; g.stroke(); }
      // Bodenstreifen, damit man die Bewegung sieht
      g.strokeStyle = "#26305E"; g.lineWidth = 2 * dpr;
      for (let i = von - (von % 10); i <= bis; i += 10) { if (i < 0) continue; const [x, y, h] = st.pkt[i], a = P(x - Math.sin(h) * 1.1, y + Math.cos(h) * 1.1), b = P(x + Math.sin(h) * 1.1, y - Math.cos(h) * 1.1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      // Lüftungen (Pfeile an der Wand) und Schwellen
      const zeit = sim.t / 1000;
      for (const l of st.luft) {
        const i = Math.round((l.s0 + l.s1) / 2 / DS); if (i < von || i > bis) continue;
        const [x, y, h] = st.pkt[i], seite = -l.dir;   // Wind nach rechts kommt von der linken Wand
        g.fillStyle = "#4DA3FF"; g.globalAlpha = 0.18 + 0.12 * Math.sin(zeit * 8);
        const a = P(x - Math.sin(h) * 1.2, y + Math.cos(h) * 1.2), b = P(x + Math.sin(h) * 1.2, y - Math.cos(h) * 1.2);
        g.beginPath(); g.arc((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.9 * sc, 0, TAU); g.fill(); g.globalAlpha = 1;
        const w = P(x - Math.sin(h) * seite * 1.25, y + Math.cos(h) * seite * 1.25);
        g.fillStyle = "#4DA3FF"; g.fillRect(w[0] - 5 * dpr, w[1] - 9 * dpr, 10 * dpr, 18 * dpr);
        for (let j = 0; j < 3; j++) {
          const o = ((zeit * 1.5 + j / 3) % 1) * 1.8 - 0.9, q = P(x - Math.sin(h) * o * -l.dir, y + Math.cos(h) * o * -l.dir), dirx = (b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]) * -l.dir * -1, diry = (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]) * -l.dir * -1;
          g.strokeStyle = "#9CCBFF"; g.lineWidth = 2.5 * dpr; g.beginPath(); g.moveTo(q[0] - dirx * 8 * dpr, q[1] - diry * 8 * dpr); g.lineTo(q[0] + dirx * 8 * dpr, q[1] + diry * 8 * dpr); g.stroke();
        }
      }
      for (const s of st.stoesse) {
        const i = Math.round(s.s / DS); if (i < von || i > bis) continue;
        const [x, y, h] = st.pkt[i], a = P(x - Math.sin(h) * 1.15, y + Math.cos(h) * 1.15), b = P(x + Math.sin(h) * 1.15, y - Math.cos(h) * 1.15);
        g.strokeStyle = "#FFD23F"; g.lineWidth = 6 * dpr; g.setLineDash([8 * dpr, 8 * dpr]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
      }
      // Ziel: die Messe
      const iz = Math.round(LAENGE / DS);
      if (iz <= bis) {
        const [x, y, h] = st.pkt[iz], a = P(x - Math.sin(h) * 1.2, y + Math.cos(h) * 1.2), b = P(x + Math.sin(h) * 1.2, y - Math.cos(h) * 1.2);
        g.strokeStyle = "#7BD957"; g.lineWidth = 8 * dpr; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        const m = P(x + Math.cos(h) * 0.7, y + Math.sin(h) * 0.7);
        g.fillStyle = "#7BD957"; g.font = `900 ${14 * dpr}px "Exo 2", Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("MESSE", m[0], m[1]);
      }
      // Du (Astronaut mit Tablett)
      g.fillStyle = c.farbe(c.PID); g.strokeStyle = "#060A1C"; g.lineWidth = 2 * dpr;
      g.beginPath(); g.arc(cx, cy + 0.25 * sc, 0.32 * sc, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = "#C9D1E0"; g.beginPath(); g.arc(cx, cy - 0.2 * sc, 0.34 * sc, 0, TAU); g.fill(); g.stroke();
      g.restore();
      // Tablett mit Bechern
      const tx = px / 2, ty = ph * 0.76, tr = Math.min(px * 0.4, ph * 0.22);
      const grad = g.createRadialGradient(tx - tr * 0.3, ty - tr * 0.3, tr * 0.1, tx, ty, tr);
      grad.addColorStop(0, "#9AA7D1"); grad.addColorStop(1, "#4A5694");
      g.fillStyle = grad; g.strokeStyle = "#060A1C"; g.lineWidth = 3 * dpr;
      g.beginPath(); g.arc(tx, ty, tr * 1.04, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = "#C9D1E0"; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(tx, ty, tr * 0.97, 0, TAU); g.stroke();
      g.strokeStyle = "rgba(6,10,28,.25)"; g.setLineDash([3 * dpr, 5 * dpr]); g.beginPath(); g.arc(tx, ty, tr * 0.25, 0, TAU); g.stroke(); g.setLineDash([]);
      sim.becher.forEach((b, i) => becherZeichnen(g, tx + b.x * tr, ty + b.y * tr, BR * tr, dpr, i));
      for (const b of sim.weg) {
        const s = (sim.t - b.t) / 1000; if (s > 3) continue;
        g.globalAlpha = Math.max(0, 1 - s / 3);
        becherZeichnen(g, tx + (b.x + b.vx * s) * tr, ty + (b.y + b.vy * s) * tr, BR * tr * (1 + s * 0.3), dpr, s * 3);
        g.globalAlpha = 1;
      }
      // Anzeige: Zeit, Becher, Fortschritt, Meldung
      g.fillStyle = "#EAF2FF"; g.font = `800 ${14 * dpr}px "Exo 2", Inter, sans-serif`; g.textBaseline = "top";
      g.textAlign = "left"; g.fillText(`${Math.max(0, Math.ceil((DAUER - sim.t) / 1000))} s`, 10 * dpr, 8 * dpr);
      g.textAlign = "right"; g.fillText(`${sim.becher.length} von ${BECHER} Bechern`, px - 10 * dpr, 8 * dpr);
      const bx = px * 0.15, bw = px * 0.7, by = ph * 0.535, bh = 6 * dpr;
      g.fillStyle = "#26305E"; g.fillRect(bx, by, bw, bh);
      g.fillStyle = "#7BD957"; g.fillRect(bx, by, bw * Math.min(1, sim.s / LAENGE), bh);
      const kv = kruemmung(st.teile, sim.s + 2.5), wv = wind(st, sim.s + 2);
      const warnung = sim.meldung && sim.t - sim.meldung.t < 1200 ? sim.meldung : wv ? { text: `Lüftung bläst nach ${wv > 0 ? "rechts" : "links"}!` } : kv ? { text: `Kurve nach ${kv > 0 ? "links" : "rechts"}` } : null;
      if (warnung) {
        g.font = `900 ${15 * dpr}px "Exo 2", Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "bottom";
        const bw2 = g.measureText(warnung.text).width + 16 * dpr;
        g.fillStyle = "rgba(7,12,36,.8)"; g.fillRect(px / 2 - bw2 / 2, ph * 0.505 - 20 * dpr, bw2, 22 * dpr);
        g.fillStyle = warnung.schlecht ? "#FF5C9A" : "#FFD23F"; g.fillText(warnung.text, px / 2, ph * 0.505);
      }
      if (sim.angekommen) { g.fillStyle = "#7BD957"; g.textAlign = "center"; g.font = `900 ${22 * dpr}px "Exo 2", Inter, sans-serif`; g.fillText(`Angekommen! ${sim.punkte} Punkte`, px / 2, ph * 0.2); }
      else if (sim.t >= DAUER) { g.fillStyle = "#FF5C9A"; g.textAlign = "center"; g.font = `900 ${22 * dpr}px "Exo 2", Inter, sans-serif`; g.fillText("Zeit um!", px / 2, ph * 0.2); }
    }
  };
})();
