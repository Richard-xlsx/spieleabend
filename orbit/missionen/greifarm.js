// Mission „Greifarm“ (Jeder für sich, Neigen und Tippen): Mit dem Greifarm der Station Weltraumschrott einfangen und in
// die Luke bringen. Der Schrott treibt langsam durchs Feld. Wie gut der Griff hält, ist Glück: Schwere Teile rutschen bei
// einem schwachen Griff unterwegs wieder heraus. Nach 45 Sekunden zählt der Wert der Beute.
// Jedes Handy rechnet selbst mit dem gleichen Startwert, also treibt bei allen derselbe Schrott, und der n-te Griff ist
// bei allen gleich stark (siehe solo.js).
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const SOLO = W.ORBIT_SOLO;
  const DAUER = 45000, NACHSPIEL = 6000;        // was nach 45 s noch im Greifer hängt, darf noch ankommen
  const HOEHE = 1.6;                            // Feld: x von −1 bis 1, y von 0 (Schiene) bis HOEHE
  const OBEN = 0.42, LINKS = -0.66, RECHTS = 0.98;   // Schrottfeld
  const LUKE = -0.86, HEIM = 0.16, BODEN = HOEHE - 0.06;
  const FAHRT = 0.95, RUNTER = 1.0, HOCH = 0.8, SCHLIESSEN = 0.25, LOSLASSEN = 0.35, GR = 0.035;
  const TEILE = [
    { name: "Schraube", wert: 1, r: 0.045, g: 0.15, f: "#C9D1E0", h: 3 },
    { name: "Antenne", wert: 2, r: 0.065, g: 0.35, f: "#4DA3FF", h: 3 },
    { name: "Solarpaneel", wert: 3, r: 0.085, g: 0.55, f: "#2EC4B6", h: 3 },
    { name: "Tank", wert: 5, r: 0.1, g: 0.75, f: "#FF7A2F", h: 2 },
    { name: "Satellit", wert: 8, r: 0.12, g: 0.95, f: "#A57BFF", h: 1.2 },
    { name: "Goldbolzen", wert: 10, r: 0.04, g: 0.3, f: "#FFD23F", h: 0.5, schnell: true }
  ];
  const ANZAHL = 12;
  const TAU = Math.PI * 2;
  const klemm = (v, a, b) => Math.max(a, Math.min(b, v));
  function zufall(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const SUMME_H = TEILE.reduce((s, x) => s + x.h, 0);
  function teilNeu(sim, rand) {
    const rng = sim.rngT;
    let z = rng() * SUMME_H, typ = 0;
    while (z > TEILE[typ].h) { z -= TEILE[typ].h; typ++; }
    const T = TEILE[typ], v = (T.schnell ? 0.28 : 0.05 + rng() * 0.09), w = rng() * TAU;
    const x = rand ? RECHTS - T.r : LINKS + T.r + rng() * (RECHTS - LINKS - 2 * T.r);
    const y = OBEN + T.r + rng() * (HOEHE - OBEN - 2 * T.r);
    return { id: ++sim.nr, typ, x, y, vx: rand ? -Math.abs(Math.cos(w) * v) - 0.04 : Math.cos(w) * v, vy: Math.sin(w) * v, a: rng() * TAU, da: (rng() - 0.5) * 1.2 };
  }

  // ---------- Das Spiel (ohne Oberfläche, für Handy, Bots und Tests) ----------
  function neu(rs) {
    const sim = { t: 0, x: 0.2, y: HEIM, zust: "fahren", z: 0, halt: null, q: null, rutsch: null, weg: 0, strecke: 1, griffe: 0, g: 0,
      teile: [], nr: 0, punkte: 0, beute: [], meldung: null, rngT: zufall(rs), rngG: zufall(rs ^ 0x5bd1e995) };
    for (let i = 0; i < ANZAHL; i++) sim.teile.push(teilNeu(sim, false));
    sim.wert = () => sim.punkte;
    sim.ende = () => (sim.t >= DAUER && !sim.halt && sim.zust !== "los") || sim.t >= DAUER + NACHSPIEL;
    sim.schritt = (ein, dt) => schritt(sim, ein, dt);
    return sim;
  }
  function loslassen(sim, rein) {
    const it = sim.halt, T = TEILE[it.typ];
    sim.halt = null;
    if (rein) {
      sim.punkte += T.wert; sim.beute.push(it.typ); sim.meldung = { t: sim.t, text: `+${T.wert} ${T.name}` };
      sim.teile.push(teilNeu(sim, true));
    } else {
      it.vx = (sim.rngT() - 0.5) * 0.2; it.vy = 0.12 + sim.rngT() * 0.1;
      sim.teile.push(it); sim.meldung = { t: sim.t, text: `${T.name} rutscht raus!`, schlecht: true };
    }
  }
  function schritt(sim, ein, dt) {
    if (sim.ende()) return;
    sim.t += dt * 1000;
    const druck = (ein.g | 0) > sim.g; sim.g = ein.g | 0;
    const zeitUm = sim.t >= DAUER;
    // Schrott treibt und prallt an den Wänden und aneinander ab
    for (const it of sim.teile) {
      const r = TEILE[it.typ].r;
      it.x += it.vx * dt; it.y += it.vy * dt; it.a += it.da * dt;
      if (it.x < LINKS + r) { it.x = LINKS + r; it.vx = Math.abs(it.vx); }
      if (it.x > RECHTS - r) { it.x = RECHTS - r; it.vx = -Math.abs(it.vx); }
      if (it.y < OBEN + r) { it.vy = Math.abs(it.vy) || 0.05; if (it.y < OBEN + r - 0.02) it.y += 0.3 * dt; else it.y = OBEN + r; }
      if (it.y > HOEHE - r) { it.y = HOEHE - r; it.vy = -Math.abs(it.vy); }
    }
    for (let i = 0; i < sim.teile.length; i++) for (let j = i + 1; j < sim.teile.length; j++) {
      const a = sim.teile[i], b = sim.teile[j], ra = TEILE[a.typ].r, rb = TEILE[b.typ].r;
      let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy);
      if (l >= ra + rb || l < 1e-6) continue;
      dx /= l; dy /= l;
      const ma = ra * ra, mb = rb * rb, ueber = ra + rb - l;
      a.x -= dx * ueber * mb / (ma + mb); a.y -= dy * ueber * mb / (ma + mb); b.x += dx * ueber * ma / (ma + mb); b.y += dy * ueber * ma / (ma + mb);
      const vrel = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
      if (vrel > 0) { const j2 = 2 * vrel / (ma + mb); a.vx -= j2 * mb * dx; a.vy -= j2 * mb * dy; b.vx += j2 * ma * dx; b.vy += j2 * ma * dy; }
    }
    // Der Greifarm
    const it = sim.halt, T = it && TEILE[it.typ];
    if (sim.zust === "fahren") {
      sim.x = klemm(sim.x + klemm(+ein.x || 0, -1, 1) * FAHRT * dt, LUKE, RECHTS - 0.04);
      if (druck && !zeitUm) { sim.zust = "runter"; sim.q = null; }
    } else if (sim.zust === "runter") {
      sim.y += RUNTER * dt;
      const treffer = sim.teile.find(t => Math.hypot(t.x - sim.x, t.y - sim.y) < TEILE[t.typ].r + GR);
      if (treffer || sim.y >= BODEN) {
        sim.zust = "zu"; sim.z = 0;
        if (treffer) {
          // Griffstärke: der n-te Griff ist bei allen gleich (gleicher Startwert)
          sim.halt = treffer; sim.teile = sim.teile.filter(t => t !== treffer); sim.griffe++;
          sim.q = 0.25 + 0.75 * sim.rngG();
          const g = TEILE[treffer.typ].g;
          sim.weg = 0; sim.strecke = (sim.y - HEIM) + (sim.x - LUKE);
          sim.rutsch = sim.q >= g ? null : sim.q / g;
        } else sim.q = null;
      }
    } else if (sim.zust === "zu") {
      sim.z += dt;
      if (sim.z >= SCHLIESSEN) sim.zust = "hoch";
    } else if (sim.zust === "hoch") {
      const v = (HOCH - (T ? T.g * 0.3 : 0)) * dt;
      sim.y = Math.max(HEIM, sim.y - v); sim.weg += v;
      if (sim.y <= HEIM) sim.zust = "heim";
    } else if (sim.zust === "heim") {
      const v = Math.min(FAHRT * dt, sim.x - LUKE);
      sim.x -= v; sim.weg += v;
      if (sim.x <= LUKE + 1e-6) { sim.zust = "los"; sim.z = 0; }
    } else if (sim.zust === "los") {
      sim.z += dt;
      if (sim.halt && sim.z >= LOSLASSEN * 0.4) loslassen(sim, true);
      if (sim.z >= LOSLASSEN) sim.zust = "fahren";
    }
    // Rutscht das Teil heraus? (über der Luke fällt es trotzdem hinein)
    if (sim.halt && sim.rutsch !== null && (sim.zust === "hoch" || sim.zust === "heim") && sim.weg >= sim.rutsch * sim.strecke) {
      const h = sim.halt; h.x = sim.x; h.y = sim.y + TEILE[h.typ].r * 0.8;
      loslassen(sim, sim.x < LINKS - 0.04);
    }
    if (sim.halt) { sim.halt.x = sim.x; sim.halt.y = sim.y + TEILE[sim.halt.typ].r * 0.8; }
  }

  // Bot: wählt ein lohnendes Teil, fährt dorthin, wo es beim Ankommen des Greifers sein wird, und drückt
  function botSteuer(rs, pid) {
    const r = zufall(rs ^ (pid.length * 7919 + pid.charCodeAt(pid.length - 1) * 31)), fehler = 0.02 + r() * 0.04;
    let ziel = null, g = 0, ab = 0, warte = 0;
    return sim => {
      if (sim.zust !== "fahren") { ziel = null; return { x: 0, g }; }
      if (warte > 0) { warte--; return { x: 0, g }; }
      if (!ziel || !sim.teile.includes(ziel)) {
        let best = null, bw = -1;
        for (const t of sim.teile) {
          const T = TEILE[t.typ], halten = klemm((1 - T.g) / 0.75 + 0.15, 0.1, 1);
          const dauer = Math.abs(t.x - sim.x) / FAHRT + (t.y - HEIM) * 2.2 + (t.x - LUKE) / FAHRT + 0.8;
          const w = T.wert * halten / dauer * (0.7 + r() * 0.6);
          if (w > bw) { bw = w; best = t; }
        }
        ziel = best; ab = (r() - 0.5) * 2 * fehler;
      }
      if (!ziel) return { x: 0, g };
      const ty = (ziel.y - HEIM) / RUNTER, px = klemm(ziel.x + ziel.vx * ty, LINKS, RECHTS) + ab, dx = px - sim.x;
      if (Math.abs(dx) < TEILE[ziel.typ].r * 0.45 && sim.t < DAUER) { g++; warte = 10 + Math.floor(r() * 25); return { x: 0, g }; }
      return { x: klemm(dx * 7, -1, 1), g };
    };
  }
  function botLauf(rs, pid) { const sim = neu(rs); return SOLO.durch(sim, DAUER + NACHSPIEL, botSteuer(rs, pid)); }

  M.greifarm = Object.assign(SOLO.host({ dauer: DAUER + NACHSPIEL, max: 600, botLauf }), {
    id: "greifarm", name: "Greifarm", art: "Jeder für sich", ab: 1, eingabe: "Neigen und Tippen", besser: "hoch", einheit: "Punkte",
    kurz: "Fang den wertvollsten Weltraumschrott.",
    anleitung: [
      "<b>Neige das Handy</b> nach links und rechts, um den Greifarm zu fahren. Ohne Sensor steuerst du mit dem Daumen.",
      "<b>Tippe</b> auf „Greifen“ (oder irgendwo ins Feld), dann fährt der Greifer nach unten und packt zu.",
      "Kleine Teile sind leicht, <b>schwere Teile</b> sind mehr wert, rutschen aber bei einem schwachen Griff wieder heraus. Der goldene Bolzen ist klein, schnell und am meisten wert.",
      "Alle spielen gleichzeitig mit <b>demselben Schrott</b> und denselben Griffen. Nach <b>45 Sekunden</b> zählt der Wert deiner Beute."
    ],
    hilfe: { neu, TEILE, DAUER, NACHSPIEL, botSteuer, botLauf, LUKE, HEIM, LINKS }
  });

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  const SN = W.ORBIT_SENSOR;
  let druecke = 0;
  const greifen = () => { druecke++; const k = document.getElementById("greifen"); if (k) { k.classList.remove("blitz"); void k.offsetWidth; k.classList.add("blitz"); } };
  W.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && document.getElementById("greifen") && !/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) { e.preventDefault(); greifen(); } });
  const STERNE = Array.from({ length: 30 }, (_, i) => [((i * 97) % 100) / 100, ((i * 61 + 17) % 100) / 100]);

  function teilZeichnen(g, T, x, y, r, a, dpr) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = T.f; g.strokeStyle = "#060A1C"; g.lineWidth = 2 * dpr; g.lineJoin = "round";
    if (T.name === "Schraube") { g.beginPath(); for (let i = 0; i < 6; i++) { const w = i / 6 * TAU; g.lineTo(Math.cos(w) * r, Math.sin(w) * r); } g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#060A1C"; g.beginPath(); g.arc(0, 0, r * 0.35, 0, TAU); g.fill(); }
    else if (T.name === "Antenne") { g.fillRect(-r * 0.15, -r, r * 0.3, r * 2); g.strokeRect(-r * 0.15, -r, r * 0.3, r * 2); g.beginPath(); g.arc(0, -r * 0.2, r * 0.75, Math.PI * 0.15, Math.PI * 0.85); g.lineWidth = 3 * dpr; g.strokeStyle = T.f; g.stroke(); }
    else if (T.name === "Solarpaneel") { g.fillRect(-r, -r * 0.55, r * 2, r * 1.1); g.strokeRect(-r, -r * 0.55, r * 2, r * 1.1); g.strokeStyle = "#0A6E66"; g.lineWidth = 1.2 * dpr; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * r * 0.5, -r * 0.55); g.lineTo(i * r * 0.5, r * 0.55); g.stroke(); } }
    else if (T.name === "Tank") { g.beginPath(); g.ellipse(0, 0, r * 0.6, r, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = "#C4501A"; g.fillRect(-r * 0.6, -r * 0.15, r * 1.2, r * 0.3); }
    else if (T.name === "Satellit") { g.fillStyle = "#2EC4B6"; g.fillRect(-r, -r * 0.25, r * 2, r * 0.5); g.strokeRect(-r, -r * 0.25, r * 2, r * 0.5); g.fillStyle = T.f; g.fillRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9); g.strokeRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9); }
    else { g.shadowColor = "#FFD23F"; g.shadowBlur = 10 * dpr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.shadowBlur = 0; g.stroke(); g.fillStyle = "#FFF6D0"; g.beginPath(); g.arc(-r * 0.3, -r * 0.3, r * 0.3, 0, TAU); g.fill(); }
    g.restore();
  }

  U.greifarm = {
    html(d, c) {
      const daumen = SN && SN.modus === "daumen";
      const stand = SOLO.standLeiste();
      if (!c.dabei) return `<div class="arena-rahmen eckig frei greifrahmen"><canvas id="arena" class="arena greiffeld"></canvas></div><p class="leise mitte">Du schaust zu. Alle spielen gleichzeitig auf ihrem Handy.</p>${stand}`;
      if (d.erg[c.PID] !== undefined) return `<p class="mitte gross">Fertig: <b>${d.erg[c.PID]}</b> Punkte</p><p class="leise mitte">Warte auf die anderen …</p>${stand}`;
      return `<div class="arena-rahmen eckig frei greifrahmen"><canvas id="arena" class="arena greiffeld" aria-label="Schrottfeld mit Greifarm"></canvas></div>
        <div class="steuerleiste">
          ${daumen ? `<div class="daumenfeld" id="daumenfeld" aria-label="Joystick"><div class="knauf"></div></div>`
            : `<div class="neigehinweis"><svg viewBox="0 0 40 40" aria-hidden="true"><rect x="12" y="5" width="16" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="2.5" transform="rotate(-15 20 20)"/></svg><span>Neigen</span><button class="chipknopf" id="nullen">Gerade stellen</button></div>`}
          <button class="aktionsknopf greifen" id="greifen">Greifen</button>
        </div>
        <p class="leise klein mitte"><button class="link" id="steuerwechsel">${daumen ? "Mit Neigen steuern" : "Mit Daumen steuern"}</button></p>${stand}`;
    },
    binden(c) {
      if (SN) SN.daumen(document.getElementById("daumenfeld"));
      const k = document.getElementById("greifen");
      if (k) k.addEventListener("pointerdown", e => { e.preventDefault(); greifen(); });
      const cv = document.getElementById("arena");
      if (cv && c.dabei) cv.addEventListener("pointerdown", e => { e.preventDefault(); greifen(); });
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
      const sim = SOLO.lauf(c, d, { neu, dauer: DAUER + NACHSPIEL, eingabe: () => ({ x: SN ? SN.richtung().x : 0, g: druecke }) });
      SOLO.standZeigen(d, c);
      const cv = document.getElementById("arena");
      if (!cv || !sim) return;
      const dpr = Math.min(2, W.devicePixelRatio || 1), px = Math.round(cv.clientWidth * dpr), ph = Math.round(px * HOEHE / 2);
      if (cv.width !== px || cv.height !== ph) { cv.width = px; cv.height = ph; }
      const g = cv.getContext("2d"), sk = px / 2, X = x => (x + 1) * sk, Y = y => y * sk;
      g.fillStyle = "#070C24"; g.fillRect(0, 0, px, ph);
      g.fillStyle = "#EAF2FF"; g.globalAlpha = 0.45;
      for (const [x, y] of STERNE) { g.beginPath(); g.arc(x * px, y * ph, dpr, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      // Schrottfeld und Luke
      g.strokeStyle = "#26305E"; g.lineWidth = 2 * dpr; g.setLineDash([6 * dpr, 6 * dpr]);
      g.strokeRect(X(LINKS), Y(OBEN), X(RECHTS) - X(LINKS), Y(HOEHE) - Y(OBEN)); g.setLineDash([]);
      const lx0 = X(-1) + 4 * dpr, lx1 = X(LINKS) - 6 * dpr;
      g.fillStyle = "#141B3D"; g.fillRect(lx0, Y(0.34), lx1 - lx0, ph - Y(0.34));
      g.strokeStyle = "#2EC4B6"; g.lineWidth = 3 * dpr; g.strokeRect(lx0, Y(0.34), lx1 - lx0, ph - Y(0.34));
      g.fillStyle = "#2EC4B6"; g.font = `800 ${11 * dpr}px "Exo 2", Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
      g.save(); g.translate((lx0 + lx1) / 2, Y(1.0)); g.rotate(-Math.PI / 2); g.fillText("LUKE", 0, 0); g.restore();
      // Beute in der Luke stapeln
      sim.beute.slice(-8).forEach((typ, i) => { const T = TEILE[typ]; teilZeichnen(g, T, (lx0 + lx1) / 2, ph - (i + 0.6) * (lx1 - lx0) * 0.9, Math.min(T.r * sk, (lx1 - lx0) * 0.38), i, dpr); });
      // Schrott
      for (const it of sim.teile) { const T = TEILE[it.typ]; teilZeichnen(g, T, X(it.x), Y(it.y), T.r * sk, it.a, dpr); }
      // Schiene, Seil und Greifer
      g.fillStyle = "#9AA7D1"; g.fillRect(0, Y(0.04), px, 5 * dpr);
      const gx = X(sim.x), gy = Y(sim.y);
      g.fillStyle = "#C9D1E0"; g.strokeStyle = "#060A1C"; g.lineWidth = 2 * dpr;
      g.fillRect(gx - 14 * dpr, Y(0.02), 28 * dpr, 12 * dpr); g.strokeRect(gx - 14 * dpr, Y(0.02), 28 * dpr, 12 * dpr);
      g.strokeStyle = "#9AA7D1"; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(gx, Y(0.02) + 12 * dpr); g.lineTo(gx, gy - 10 * dpr); g.stroke();
      if (sim.halt) { const T = TEILE[sim.halt.typ]; teilZeichnen(g, T, X(sim.halt.x), Y(sim.halt.y), T.r * sk, sim.halt.a, dpr); }
      const offen = sim.zust === "fahren" || sim.zust === "runter" ? 1 : sim.zust === "zu" ? 1 - sim.z / SCHLIESSEN : sim.zust === "los" ? Math.min(1, sim.z / (LOSLASSEN * 0.4)) : sim.halt ? 0.25 : 0;
      const spreiz = (0.25 + 0.75 * offen) * 0.7;
      g.strokeStyle = "#EAF2FF"; g.lineWidth = 4 * dpr; g.lineCap = "round";
      g.fillStyle = "#EAF2FF"; g.fillRect(gx - 8 * dpr, gy - 12 * dpr, 16 * dpr, 6 * dpr);
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(gx + s * 6 * dpr, gy - 7 * dpr);
        g.lineTo(gx + s * Math.sin(spreiz) * 16 * dpr, gy + Math.cos(spreiz) * 6 * dpr);
        g.lineTo(gx + s * Math.sin(spreiz * 0.3) * 8 * dpr, gy + Math.cos(spreiz) * 14 * dpr); g.stroke();
      }
      // Griffstärke beim Zupacken
      if (sim.q !== null && sim.zust !== "fahren") {
        const T = sim.halt && TEILE[sim.halt.typ], gut = T ? sim.q >= T.g : true;
        g.fillStyle = gut ? "#7BD957" : "#FF5C9A"; g.font = `900 ${15 * dpr}px "Exo 2", Inter, sans-serif`; g.textAlign = "right"; g.textBaseline = "bottom";
        g.fillText(`Griff ${Math.round(sim.q * 100)} %${T ? (gut ? " hält" : " schwach") : ""}`, px - 8 * dpr, ph - 6 * dpr);
      }
      // Anzeige: Zeit und Punkte, Meldung
      const t = Math.max(0, Math.ceil((DAUER - sim.t) / 1000));
      g.fillStyle = "#EAF2FF"; g.font = `800 ${14 * dpr}px "Exo 2", Inter, sans-serif`; g.textBaseline = "top";
      g.textAlign = "center"; g.fillText(sim.t >= DAUER ? "Zeit um" : `${t} s`, px / 2, Y(0.1));
      g.textAlign = "right"; g.fillText(`${sim.punkte} Punkte`, px - 8 * dpr, Y(0.1));
      if (sim.meldung && sim.t - sim.meldung.t < 1400) {
        g.globalAlpha = 1 - (sim.t - sim.meldung.t) / 1400;
        g.fillStyle = sim.meldung.schlecht ? "#FF5C9A" : "#FFD23F"; g.textAlign = "center"; g.font = `900 ${16 * dpr}px "Exo 2", Inter, sans-serif`;
        g.fillText(sim.meldung.text, px * 0.58, Y(0.24)); g.globalAlpha = 1;
      }
      // Der Knopf ist nur bereit, wenn der Greifer oben steht
      const k = document.getElementById("greifen");
      if (k) { const leer = sim.zust !== "fahren" || sim.t >= DAUER; if (leer !== k.hasAttribute("data-leer")) k.toggleAttribute("data-leer", leer); }
    }
  };
})();
