// Mission „Planeten-Boule“ (reihum, Wischen): Reihum schickt jeder eine Kugel los, möglichst nah an den Zielmond. Kleine
// Planeten lenken die Bahn mit ihrer Schwerkraft ab, und man darf die Kugeln der anderen wegschießen. Wer das Feld
// verlässt, ist weg. Jeder hat 2 Kugeln, die zweite Runde geht rückwärts. Es zählt die beste eigene Kugel.
// Live-Mission: Der Spielleiter rechnet die Bahnen 30-mal pro Sekunde, die Handys zeichnen.
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const BREIT = 1, HOCH = 1.5;                          // Feld: x von −1 bis 1, y von −1,5 bis 1,5 (unten ist der Start)
  const KR = 0.065, MR = 0.07, START = { x: 0, y: 1.3 };
  const VMIN = 0.35, VMAX = 3.3, GM = 0.24, AMAX = 6, VG = 0.5;
  const DAEMPF = 0.85, REIB = 0.12, STOPP = 0.035, E_KUGEL = 0.9, E_FEST = 0.6;
  const KUGELN = 2, ZIELEN = 15000, ROLLEN = 6500, SCHLUSS = 2500, BOTZEIT = 1400;
  const DT = 1 / 60;
  const TAU = Math.PI * 2;
  const laenge = (x, y) => Math.hypot(x, y);

  // Ein Zeitschritt der Bahnen (Spielleiter und Bot-Vorschau): Schwerkraft, Bremsen, Abprallen, Feld verlassen
  function physik(w, dt) {
    let bewegt = false; const raus = [];
    for (const k of w.k) {
      let v = laenge(k.vx, k.vy);
      if (v === 0) continue;
      bewegt = true;
      const zieh = Math.min(1, v / VG);      // nur rollende Kugeln spüren die Schwerkraft, liegende bleiben liegen
      for (const p of w.pl) {
        const dx = p.x - k.x, dy = p.y - k.y, d2 = Math.max(dx * dx + dy * dy, (p.r + KR) ** 2), a = Math.min(AMAX, GM * (p.r / 0.12) ** 2 / d2) * zieh, d = Math.sqrt(d2);
        k.vx += dx / d * a * dt; k.vy += dy / d * a * dt;
      }
      v = laenge(k.vx, k.vy);
      const nv = Math.max(0, v * Math.exp(-DAEMPF * dt) - REIB * dt);
      if (nv < STOPP) { k.vx = k.vy = 0; } else { k.vx *= nv / v; k.vy *= nv / v; }
      k.x += k.vx * dt; k.y += k.vy * dt;
      for (const p of w.pl.concat([{ x: w.mond.x, y: w.mond.y, r: MR }])) {
        const dx = k.x - p.x, dy = k.y - p.y, d = laenge(dx, dy), min = p.r + KR;
        if (d >= min || d < 1e-9) continue;
        const nx = dx / d, ny = dy / d; k.x = p.x + nx * min; k.y = p.y + ny * min;
        const vn = k.vx * nx + k.vy * ny; if (vn < 0) { k.vx -= (1 + E_FEST) * vn * nx; k.vy -= (1 + E_FEST) * vn * ny; }
      }
      if (Math.abs(k.x) > BREIT + KR || Math.abs(k.y) > HOCH + KR) raus.push(k);
    }
    for (let i = 0; i < w.k.length; i++) for (let j = i + 1; j < w.k.length; j++) {
      const a = w.k[i], b = w.k[j];
      let dx = b.x - a.x, dy = b.y - a.y; const d = laenge(dx, dy);
      if (d >= 2 * KR || d < 1e-9) continue;
      dx /= d; dy /= d; const u = (2 * KR - d) / 2;
      a.x -= dx * u; a.y -= dy * u; b.x += dx * u; b.y += dy * u;
      const vrel = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
      if (vrel > 0) { const j2 = (1 + E_KUGEL) * vrel / 2; a.vx -= j2 * dx; a.vy -= j2 * dy; b.vx += j2 * dx; b.vy += j2 * dy; }
    }
    if (raus.length) w.k = w.k.filter(k => !raus.includes(k));
    return { bewegt, raus };
  }
  const abstand = (w, k) => Math.max(0, laenge(k.x - w.mond.x, k.y - w.mond.y) - KR - MR);
  function bester(w, pid) { let b = null; for (const k of w.k) if (k.p === pid) { const a = abstand(w, k); if (b === null || a < b) b = a; } return b; }
  const tempo = s => VMIN + (VMAX - VMIN) * Math.max(0, Math.min(1, s));

  function feld(rng) {
    const mond = { x: (rng() - 0.5) * 0.9, y: -0.45 - rng() * 0.6 }, pl = [];
    const n = 2 + (rng() < 0.4 ? 1 : 0);
    for (let v = 0; v < 400 && pl.length < n; v++) {
      const r = 0.09 + rng() * 0.06, x = (rng() - 0.5) * 1.4, y = -0.95 + rng() * 1.65;
      if (laenge(x - mond.x, y - mond.y) < r + MR + 0.28) continue;
      if (laenge(x - START.x, y - START.y) < r + 0.55) continue;
      if (pl.some(p => laenge(p.x - x, p.y - y) < p.r + r + 0.35)) continue;
      pl.push({ x, y, r });
    }
    return { mond, pl };
  }

  function naechster(d, jetzt) {
    d.zug += 1;
    if (d.zug >= d.reihe.length) { d.phase = "ende"; d.seit = d.t; d.bis = 0; return; }
    d.phase = "zielen"; d.seit = d.t; d.bis = jetzt + ZIELEN; d.dran = d.reihe[d.zug];
  }

  // Bot: probiert viele Würfe in Gedanken aus und nimmt einen guten, aber nicht ganz genau
  function botWurf(d, pid, rng) {
    let best = null, bw = Infinity;
    const zw = Math.atan2(d.mond.y - START.y, d.mond.x - START.x);
    for (let i = 0; i < 70; i++) {
      const w = zw + (rng() - 0.5) * 1.2, s = 0.2 + rng() * 0.8;
      const welt = { k: d.k.map(k => Object.assign({}, k)), pl: d.pl, mond: d.mond };
      welt.k.push({ id: -1, p: pid, x: START.x, y: START.y, vx: Math.cos(w) * tempo(s), vy: Math.sin(w) * tempo(s) });
      for (let t = 0; t < ROLLEN / 1000 / (DT * 2); t++) if (!physik(welt, DT * 2).bewegt) break;
      const ich = bester(welt, pid);
      let andere = null; for (const k of welt.k) if (k.p !== pid) { const a = abstand(welt, k); if (andere === null || a < andere) andere = a; }
      const wert = (ich === null ? 3 : ich) - 0.4 * Math.min(andere === null ? 1 : andere, 1);
      if (wert < bw) { bw = wert; best = { w, s }; }
    }
    return { w: best.w + (rng() - 0.5) * 0.06, s: Math.max(0, Math.min(1, best.s + (rng() - 0.5) * 0.08)) };
  }

  M.boule = {
    id: "boule", name: "Planeten-Boule", art: "reihum", ab: 2, eingabe: "Wischen", besser: "niedrig", einheit: "cm zum Mond",
    live: true,
    kurz: "Bring deine Kugel möglichst nah an den Zielmond.",
    anleitung: [
      "Reihum schickt jeder eine Kugel los: <b>Wische in die Richtung</b>, in die sie fliegen soll. Je länger der Wisch, desto kräftiger.",
      "Die kleinen <b>Planeten ziehen</b> die Kugel mit ihrer Schwerkraft zu sich und lenken die Bahn ab.",
      "Du darfst die Kugeln der anderen <b>wegschießen</b>. Wer aus dem Feld fliegt, ist weg.",
      `Jeder hat ${KUGELN} Kugeln. Am Ende zählt deine Kugel, die dem <b>Zielmond</b> am nächsten liegt.`
    ],
    neu(tn, rng) {
      const f = feld(rng), reihe = [];
      for (let r = 0; r < KUGELN; r++) reihe.push(...(r % 2 ? tn.slice().reverse() : tn));
      return { tn, mond: f.mond, pl: f.pl, k: [], nr: 0, reihe, zug: -1, dran: null, phase: "warten", seit: 0, bis: 0, t: 0, raus: [], fertig: false };
    },
    start(d, jetzt) { naechster(d, jetzt); },
    aktion(d, pid, m, jetzt) {
      if (m.a !== "wurf") return "?";
      if (d.phase !== "zielen" || d.dran !== pid) return "Du bist gerade nicht dran.";
      const w = +m.w, s = +m.s;
      if (!isFinite(w) || !isFinite(s)) return "?";
      const v = tempo(s);
      d.k.push({ id: ++d.nr, p: pid, x: START.x, y: START.y, vx: Math.cos(w) * v, vy: Math.sin(w) * v });
      d.phase = "rollt"; d.seit = d.t; d.bis = 0;
      return true;
    },
    takt() { return false; },
    schritt(d, dt, ein, jetzt, ctx) {
      if (d.fertig || dt <= 0) return false;
      d.t += dt * 1000;
      let anders = false;
      if (d.phase === "zielen") {
        // Wer weg ist, wird übersprungen; wer zu lange zielt, verliert die Kugel
        const weg = !ctx.aktiv.includes(d.dran) && d.t - d.seit > 1000;
        if (weg || d.t - d.seit > ZIELEN) { d.verfallen = (d.verfallen || 0) + 1; naechster(d, jetzt); anders = true; }
      } else if (d.phase === "rollt") {
        let bewegt = false;
        for (let n = 0; n < Math.round(dt / DT) || n < 1; n++) {
          const r = physik(d, Math.min(DT, dt));
          if (r.bewegt) bewegt = true;
          for (const k of r.raus) { d.raus.push({ x: Math.max(-BREIT, Math.min(BREIT, k.x)), y: Math.max(-HOCH, Math.min(HOCH, k.y)), p: k.p, t: d.t }); anders = true; }
        }
        if (!bewegt || d.t - d.seit > ROLLEN) { for (const k of d.k) k.vx = k.vy = 0; naechster(d, jetzt); anders = true; }
      } else if (d.phase === "ende" && d.t - d.seit > SCHLUSS) { d.fertig = true; anders = true; }
      d.raus = d.raus.filter(r => d.t - r.t < 1500);
      return anders;
    },
    wertung(d) { return Object.fromEntries(d.tn.map(p => { const b = bester(d, p); return [p, b === null ? 999 : Math.round(b * 100)]; })); },
    wertText(d, p) { const b = bester(d, p); return b === null ? "keine Kugel im Feld" : `${Math.round(b * 100)} cm zum Mond`; },
    bild(d) {
      const r3 = v => Math.round(v * 1000) / 1000;
      return { t: Math.round(d.t), k: d.k.map(k => [k.id, d.tn.indexOf(k.p), r3(k.x), r3(k.y), r3(k.vx), r3(k.vy)]), r: d.raus.map(r => [r3(r.x), r3(r.y), d.tn.indexOf(r.p), Math.round(r.t)]) };
    },
    bot(d, pid, rng) {
      if (d.phase !== "zielen" || d.dran !== pid || d.t - d.seit < BOTZEIT) return null;
      const w = botWurf(d, pid, rng);
      return { t: "b", a: "wurf", w: w.w, s: w.s };
    },
    hilfe: { physik, bester, abstand, feld, botWurf, tempo, START, KR, MR, BREIT, HOCH, ZIELEN, ROLLEN, KUGELN }
  };

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  const L = W.ORBIT_LIVE;
  const STERNE = Array.from({ length: 50 }, (_, i) => [((i * 97) % 100) / 100, ((i * 61 + 17) % 100) / 100, i % 4 ? 0.6 : 1.3]);
  let ziel = null, gezielt = null;   // { x0, y0, x, y } beim Wischen; gezielt: Zug, in dem schon geworfen wurde

  function masse(cv) { const r = cv.getBoundingClientRect(); return { r, sk: r.width / 2 / (BREIT + 0.04) }; }

  U.boule = {
    html(d, c) {
      const ich = c.PID, dran = d.phase === "zielen" && d.dran === ich && gezielt !== d.zug;
      const rest = p => d.reihe.slice(d.zug + (d.phase === "zielen" ? 0 : 1)).filter(x => x === p).length;
      const kopf = `<div class="missionskopf"><span class="etikett">Wurf ${Math.min(d.zug + 1, d.reihe.length)} von ${d.reihe.length}</span>${d.phase === "zielen" ? c.uhr(d.bis) : ""}</div>`;
      let zeile;
      if (d.phase === "ende") zeile = `<p class="mitte gross"><b>Alle Kugeln sind gespielt.</b></p>`;
      else if (dran) zeile = `<p class="mitte gross bouledran"><b>Du bist dran!</b> Wische in die Wurfrichtung.</p>`;
      else if (d.phase === "zielen") zeile = `<p class="mitte">${c.helm(d.dran)} <b>${c.esc(c.name(d.dran))}</b> zielt …</p>`;
      else zeile = `<p class="mitte leise">Die Kugel rollt …</p>`;
      const liste = `<div class="punkteleiste">${d.tn.map(p => { const b = bester(d, p); return `<span class="${p === ich ? "ich" : ""}">${c.helm(p)}<b>${b === null ? "–" : Math.round(b * 100)}</b><small>${"●".repeat(rest(p))}</small></span>`; }).join("")}</div>`;
      return kopf + `<div class="arena-rahmen eckig frei boulerahmen"><canvas id="arena" class="arena boulefeld ${dran ? "zielbar" : ""}" aria-label="Spielfeld mit Zielmond, Planeten und Kugeln"></canvas></div>${zeile}${liste}
        <p class="leise klein mitte">Zahlen: Abstand der besten Kugel zum Mond, Punkte: Kugeln, die noch kommen.</p>`;
    },
    binden(c) {
      const cv = document.getElementById("arena"), d = c.S.mission.d;
      if (!cv || !(d.phase === "zielen" && d.dran === c.PID)) return;
      cv.addEventListener("pointerdown", e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} ziel = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId }; });
      cv.addEventListener("pointermove", e => { if (ziel && e.pointerId === ziel.id) { ziel.x = e.clientX; ziel.y = e.clientY; } });
      const los = e => {
        if (!ziel || e.pointerId !== ziel.id) return;
        const dx = ziel.x - ziel.x0, dy = ziel.y - ziel.y0, l = laenge(dx, dy), { r } = masse(cv); ziel = null;
        const dd = c.S.mission && c.S.mission.d;
        if (l < 20 || !dd || dd.phase !== "zielen" || dd.dran !== c.PID) return;
        gezielt = dd.zug;
        if (c.klang) c.klang("wurf");
        c.tun({ t: "b", a: "wurf", w: Math.atan2(dy, dx), s: Math.min(1, l / (r.width * 0.6)) });
        c.neu();
      };
      cv.addEventListener("pointerup", los);
      cv.addEventListener("pointercancel", () => { ziel = null; });
    },
    bewegen(d, c) {
      const cv = document.getElementById("arena");
      if (!cv) return;
      const dpr = Math.min(2, W.devicePixelRatio || 1), px = Math.round(cv.clientWidth * dpr), ph = Math.round(px * HOCH / (BREIT + 0.04));
      if (cv.width !== px || cv.height !== ph) { cv.width = px; cv.height = ph; }
      const g = cv.getContext("2d"), sk = px / 2 / (BREIT + 0.04), X = x => px / 2 + x * sk, Y = y => ph / 2 + y * sk;
      g.fillStyle = "#070C24"; g.fillRect(0, 0, px, ph);
      for (const [x, y, r] of STERNE) { g.fillStyle = "#EAF2FF"; g.globalAlpha = 0.5; g.beginPath(); g.arc(x * px, y * ph, r * dpr, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      g.strokeStyle = "#26305E"; g.lineWidth = 2 * dpr; g.strokeRect(X(-BREIT), Y(-HOCH), 2 * BREIT * sk, 2 * HOCH * sk);
      const jetzt = c.jetzt();
      // Planeten mit Schwerkraftringen
      d.pl.forEach((p, i) => {
        for (let j = 3; j >= 1; j--) { g.strokeStyle = `rgba(165,123,255,${0.07 * (4 - j)})`; g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(X(p.x), Y(p.y), (p.r + j * 0.09 + 0.02 * Math.sin(jetzt / 500 + i + j)) * sk, 0, TAU); g.stroke(); }
        const f = ["#A57BFF", "#FF7A2F", "#4DA3FF"][i % 3], gr = g.createRadialGradient(X(p.x - p.r * 0.35), Y(p.y - p.r * 0.35), 1, X(p.x), Y(p.y), p.r * sk);
        gr.addColorStop(0, "#FFFFFF"); gr.addColorStop(0.25, f); gr.addColorStop(1, "#1B2246");
        g.fillStyle = gr; g.beginPath(); g.arc(X(p.x), Y(p.y), p.r * sk, 0, TAU); g.fill();
      });
      // Zielmond mit Abstandsringen
      g.strokeStyle = "rgba(255,210,63,.22)"; g.lineWidth = 1 * dpr; g.setLineDash([3 * dpr, 5 * dpr]);
      for (let j = 1; j <= 2; j++) { g.beginPath(); g.arc(X(d.mond.x), Y(d.mond.y), (MR + KR + j * 0.1) * sk, 0, TAU); g.stroke(); }
      g.setLineDash([]);
      g.shadowColor = "#FFD23F"; g.shadowBlur = 16 * dpr; g.fillStyle = "#FFF0B8";
      g.beginPath(); g.arc(X(d.mond.x), Y(d.mond.y), MR * sk, 0, TAU); g.fill(); g.shadowBlur = 0;
      g.fillStyle = "rgba(201,160,60,.6)"; g.beginPath(); g.arc(X(d.mond.x + 0.02), Y(d.mond.y - 0.015), MR * 0.3 * sk, 0, TAU); g.fill();
      // Startfeld
      g.strokeStyle = "#2EC4B6"; g.lineWidth = 2 * dpr; g.setLineDash([4 * dpr, 4 * dpr]);
      g.beginPath(); g.arc(X(START.x), Y(START.y), (KR + 0.03) * sk, 0, TAU); g.stroke(); g.setLineDash([]);
      // Kugeln: glatt zwischen zwei Bildern
      const z = L.zwischen(c.nr, jetzt);
      if (z) {
        const A = new Map(z.a.k.map(k => [k[0], k]));
        for (const b of z.b.k) {
          const a = A.get(b[0]) || b, x = L.mix(a[2], b[2], z.f), y = L.mix(a[3], b[3], z.f), p = d.tn[b[1]];
          g.fillStyle = c.farbe(p); g.strokeStyle = "#060A1C"; g.lineWidth = 2.5 * dpr;
          g.beginPath(); g.arc(X(x), Y(y), KR * sk, 0, TAU); g.fill(); g.stroke();
          g.fillStyle = "#060A1C"; g.font = `900 ${Math.round(KR * sk * 1.1)}px "Exo 2", Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(c.anfang(p), X(x), Y(y) + 1);
        }
        const t = L.mix(z.a.t, z.b.t, z.f);
        for (const [x, y, pi, rt] of z.b.r || []) {
          const s = (t - rt) / 1500; if (s < 0 || s > 1) continue;
          g.strokeStyle = c.farbe(d.tn[pi]); g.globalAlpha = 1 - s; g.lineWidth = 3 * dpr;
          g.beginPath(); g.arc(X(x), Y(y), (0.05 + s * 0.25) * sk, 0, TAU); g.stroke(); g.globalAlpha = 1;
        }
      }
      // Wer dran ist: Kugel am Start und beim Wischen der Pfeil
      if (d.phase === "zielen" && d.dran) {
        const meins = d.dran === c.PID && gezielt !== d.zug;
        g.globalAlpha = meins ? 1 : 0.55; g.fillStyle = c.farbe(d.dran); g.strokeStyle = "#060A1C"; g.lineWidth = 2.5 * dpr;
        g.beginPath(); g.arc(X(START.x), Y(START.y), KR * sk, 0, TAU); g.fill(); g.stroke(); g.globalAlpha = 1;
        if (meins && ziel) {
          const r = cv.getBoundingClientRect(), dx = ziel.x - ziel.x0, dy = ziel.y - ziel.y0, l = laenge(dx, dy);
          if (l > 5) {
            const s = Math.min(1, l / (r.width * 0.6)), ux = dx / l, uy = dy / l, len = (0.15 + s * 0.65) * sk;
            const x0 = X(START.x), y0 = Y(START.y), x1 = x0 + ux * len, y1 = y0 + uy * len;
            g.strokeStyle = s >= 1 ? "#FF5C9A" : "#FFD23F"; g.lineWidth = 4 * dpr; g.lineCap = "round";
            g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
            g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - ux * 12 * dpr - uy * 8 * dpr, y1 - uy * 12 * dpr + ux * 8 * dpr); g.moveTo(x1, y1); g.lineTo(x1 - ux * 12 * dpr + uy * 8 * dpr, y1 - uy * 12 * dpr - ux * 8 * dpr); g.stroke();
            g.fillStyle = "#EAF2FF"; g.font = `800 ${12 * dpr}px "Exo 2", Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "bottom";
            g.fillText(`Kraft ${Math.round(s * 100)} %`, x0, y0 - KR * sk - 6 * dpr);
          }
        }
      }
    }
  };
})();
