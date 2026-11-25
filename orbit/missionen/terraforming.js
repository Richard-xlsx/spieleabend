// Mission „Terraforming“ (Arena, Neigen): Jeder rollt mit seinem Rover über einen kahlen Planeten und begrünt ihn in
// seiner Farbe. Fremde Flächen darf man übermalen. Saatkapseln liegen herum: Wer eine aufsammelt, kann mit „Saatbombe“
// eine große Fläche auf einmal begrünen. Nach 60 Sekunden zählt der Anteil am Planeten.
// Live-Mission: Der Spielleiter rechnet 30-mal pro Sekunde (schritt), die Handys zeichnen (bild).
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const N = 26, ZELLE = 2 / N, RAND = 0.97;                 // Raster über dem Planeten (Radius 1)
  const PR = 0.065, PINSEL = 0.1, ACC = 2.8, REIB = 2.2, MAXV = 0.95, E = 0.8;
  const BOMBE = 0.3, KAPSELR = 0.05, KAPSELALLE = 5000, KAPSELMAX = 2, ERSTEKAPSEL = 3000;
  const DAUER = 60000;
  const TAU = Math.PI * 2;
  const laenge = (x, y) => Math.hypot(x, y);
  // Welche Zellen gehören zum Planeten? (Mitte innerhalb des Randes)
  const GUELTIG = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -1 + (i + 0.5) * ZELLE, y = -1 + (j + 0.5) * ZELLE;
    if (laenge(x, y) <= RAND) GUELTIG.push(j * N + i);
  }

  // Alle Zellen im Kreis um (x, y) bekommen die Farbe f (1 … Spielerzahl)
  function malen(d, x, y, r, f) {
    const i0 = Math.max(0, Math.floor((x - r + 1) / ZELLE)), i1 = Math.min(N - 1, Math.floor((x + r + 1) / ZELLE));
    const j0 = Math.max(0, Math.floor((y - r + 1) / ZELLE)), j1 = Math.min(N - 1, Math.floor((y + r + 1) / ZELLE));
    let neu = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = -1 + (i + 0.5) * ZELLE, cy = -1 + (j + 0.5) * ZELLE;
      if (laenge(cx - x, cy - y) > r || laenge(cx, cy) > RAND) continue;
      const k = j * N + i;
      if (d.g[k] !== f) { d.g[k] = f; neu++; }
    }
    return neu;
  }
  function anteile(g, n) {
    const z = new Array(n + 1).fill(0);
    for (const k of GUELTIG) z[g[k]]++;
    return z.map(x => x / GUELTIG.length * 100);
  }
  function kapselSetzen(d, rng) {
    for (let v = 0; v < 20; v++) {
      const w = rng() * TAU, r = Math.sqrt(rng()) * 0.8, x = Math.cos(w) * r, y = Math.sin(w) * r;
      if (d.tn.some(p => laenge(d.sp[p].x - x, d.sp[p].y - y) < 0.3)) continue;
      d.kapseln.push({ x, y, id: ++d.kapselNr });
      return;
    }
  }

  M.terraforming = {
    id: "terraforming", name: "Terraforming", art: "Arena", ab: 2, eingabe: "Neigen", besser: "hoch", einheit: "Prozent",
    live: true,
    kurz: "Begrüne den Planeten in deiner Farbe.",
    anleitung: [
      "<b>Neige das Handy</b>, um deinen Rover über den Planeten zu lenken. Ohne Sensor steuerst du mit dem Daumen.",
      "Wo du fährst, wächst es <b>in deiner Farbe</b>. Die Flächen der anderen darfst du übermalen.",
      "Sammle die leuchtenden <b>Saatkapseln</b> ein und zünde mit „Saatbombe“ eine große Fläche auf einmal.",
      "Nach <b>60 Sekunden</b> zählt, wie viel vom Planeten deine Farbe hat."
    ],
    neu(tn, rng) {
      const sp = {};
      tn.forEach((p, i) => {
        const w = i / tn.length * TAU + rng() * 0.3, r = tn.length > 1 ? 0.5 : 0;
        sp[p] = { x: Math.cos(w) * r, y: Math.sin(w) * r, vx: 0, vy: 0, bomben: 0, bombeT: -9999 };
      });
      const d = { tn, t: 0, sp, k: {}, g: new Array(N * N).fill(0), kapseln: [], kapselNr: 0, naechsteKapsel: ERSTEKAPSEL, knall: [], fertig: false };
      tn.forEach((p, i) => malen(d, sp[p].x, sp[p].y, PINSEL * 1.6, i + 1));
      return d;
    },
    start() {},
    aktion() { return "?"; },
    takt() { return false; },
    schritt(d, dt, ein, jetzt, ctx) {
      if (d.fertig || dt <= 0) return false;
      d.t += dt * 1000;
      let anders = false;
      if (d.t >= d.naechsteKapsel) {
        if (d.kapseln.length < KAPSELMAX) kapselSetzen(d, ctx.rng);
        d.naechsteKapsel += KAPSELALLE;
      }
      d.knall = d.knall.filter(b => d.t - b.t < 900);
      d.tn.forEach((p, idx) => {
        const s = d.sp[p], e = ein[p] || { x: 0, y: 0, k: d.k[p] || 0 };
        let ex = e.x || 0, ey = e.y || 0; const el = laenge(ex, ey); if (el > 1) { ex /= el; ey /= el; }
        const druck = d.k[p] !== undefined && (e.k | 0) > d.k[p];
        if (d.k[p] === undefined || druck) d.k[p] = e.k | 0;
        s.vx += ex * ACC * dt; s.vy += ey * ACC * dt;
        const f = Math.max(0, 1 - REIB * dt); s.vx *= f; s.vy *= f;
        const v = laenge(s.vx, s.vy); if (v > MAXV) { s.vx *= MAXV / v; s.vy *= MAXV / v; }
        s.x += s.vx * dt; s.y += s.vy * dt;
        // Am Rand des Planeten prallt der Rover ab
        const l = laenge(s.x, s.y), max = 1 - PR;
        if (l > max) {
          const nx = s.x / l, ny = s.y / l, vn = s.vx * nx + s.vy * ny;
          s.x = nx * max; s.y = ny * max;
          if (vn > 0) { s.vx -= (1 + E) * vn * nx; s.vy -= (1 + E) * vn * ny; }
        }
        malen(d, s.x, s.y, PINSEL, idx + 1);
        // Saatkapsel aufsammeln (höchstens eine Bombe auf Vorrat)
        if (!s.bomben) {
          const k = d.kapseln.find(c => laenge(c.x - s.x, c.y - s.y) < PR + KAPSELR);
          if (k) { s.bomben = 1; d.kapseln = d.kapseln.filter(c => c !== k); anders = true; }
        }
        if (druck && s.bomben) {
          s.bomben = 0; s.bombeT = d.t;
          malen(d, s.x, s.y, BOMBE, idx + 1);
          d.knall.push({ x: s.x, y: s.y, t: d.t, von: idx });
          anders = true;
        }
      });
      // Zusammenstöße: weich abstoßen, damit man sich gegenseitig wegdrängen kann
      for (let i = 0; i < d.tn.length; i++) for (let j = i + 1; j < d.tn.length; j++) {
        const a = d.sp[d.tn[i]], b = d.sp[d.tn[j]];
        let dx = b.x - a.x, dy = b.y - a.y, l = laenge(dx, dy);
        if (l >= PR * 2) continue;
        if (l < 1e-6) { dx = 1; dy = 0; l = 1; }
        const nx = dx / l, ny = dy / l, ueber = PR * 2 - l;
        a.x -= nx * ueber / 2; a.y -= ny * ueber / 2; b.x += nx * ueber / 2; b.y += ny * ueber / 2;
        const vrel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vrel > 0) { const j2 = (1 + E) * vrel / 2; a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny; }
      }
      if (d.t >= DAUER) { d.fertig = true; anders = true; }
      return anders;
    },
    wertung(d) {
      const a = anteile(d.g, d.tn.length);
      return Object.fromEntries(d.tn.map((p, i) => [p, Math.round(a[i + 1] * 10) / 10]));
    },
    // Kompaktes Bild: Raster als Zeichenkette (eine Ziffer bzw. ein Buchstabe pro Zelle)
    bild(d) {
      const r3 = v => Math.round(v * 1000) / 1000;
      return {
        t: Math.round(d.t),
        p: d.tn.map(p => { const s = d.sp[p]; return [r3(s.x), r3(s.y), r3(s.vx), r3(s.vy), s.bomben, Math.round(Math.min(9999, d.t - s.bombeT))]; }),
        g: d.g.map(x => x.toString(36)).join(""),
        c: d.kapseln.map(c => [r3(c.x), r3(c.y), c.id]),
        b: d.knall.map(b => [r3(b.x), r3(b.y), Math.round(b.t), b.von])
      };
    },
    // Bots: fahren zu einer Stelle, die noch nicht ihre Farbe hat, holen sich Saatkapseln in der Nähe
    // und zünden die Bombe, wo viel Fremdes ist.
    botEingabe(d, pid, rng) {
      const s = d.sp[pid], k = d.k[pid] || 0, f = d.tn.indexOf(pid) + 1;
      d.botZiel = d.botZiel || {};
      let z = d.botZiel[pid];
      const kapsel = !s.bomben && d.kapseln.slice().sort((a, b) => laenge(a.x - s.x, a.y - s.y) - laenge(b.x - s.x, b.y - s.y))[0];
      if (kapsel && laenge(kapsel.x - s.x, kapsel.y - s.y) < 0.7) z = { x: kapsel.x, y: kapsel.y, bis: d.t + 400 };
      if (!z || d.t > z.bis || laenge(z.x - s.x, z.y - s.y) < 0.06 || d.g[zelle(z.x, z.y)] === f) {
        // Ziel: eine zufällige fremde oder leere Zelle, bevorzugt in der Nähe
        let best = null, bw = -1;
        for (let v = 0; v < 12; v++) {
          const c = GUELTIG[Math.floor(rng() * GUELTIG.length)];
          if (d.g[c] === f) continue;
          const x = -1 + (c % N + 0.5) * ZELLE, y = -1 + (Math.floor(c / N) + 0.5) * ZELLE;
          const w = (d.g[c] ? 1.4 : 1) / (0.3 + laenge(x - s.x, y - s.y));
          if (w > bw) { bw = w; best = { x, y }; }
        }
        z = best ? { x: best.x, y: best.y, bis: d.t + 2500 } : { x: 0, y: 0, bis: d.t + 1000 };
      }
      d.botZiel[pid] = z;
      const dx = z.x - s.x, dy = z.y - s.y, l = laenge(dx, dy) || 1;
      let bombe = false;
      if (s.bomben && rng() < 0.08) {
        let fremd = 0;
        for (let a = 0; a < 8; a++) { const w = a / 8 * TAU; if (d.g[zelle(s.x + Math.cos(w) * 0.2, s.y + Math.sin(w) * 0.2)] !== f) fremd++; }
        bombe = fremd >= 5;
      }
      return { x: dx / l * 0.85 + (rng() - 0.5) * 0.3, y: dy / l * 0.85 + (rng() - 0.5) * 0.3, k: bombe ? k + 1 : k };
    },
    sicht(d) { const v = Object.assign({}, d); delete v.botZiel; return v; }
  };
  function zelle(x, y) {
    const i = Math.max(0, Math.min(N - 1, Math.floor((x + 1) / ZELLE))), j = Math.max(0, Math.min(N - 1, Math.floor((y + 1) / ZELLE)));
    return j * N + i;
  }
  M.terraforming.raster = { N, GUELTIG, anteile, malen };

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  const L = W.ORBIT_LIVE, SN = W.ORBIT_SENSOR;
  const STERNE = Array.from({ length: 40 }, (_, i) => [((i * 97) % 100) / 100, ((i * 61 + 17) % 100) / 100, i % 3 ? 0.6 : 1.2]);
  // Kleine Unregelmäßigkeit pro Zelle, damit die Flächen wie Bewuchs aussehen und nicht wie Kacheln
  const BUSCH = Array.from({ length: N * N }, (_, k) => [((k * 37) % 11) / 11, ((k * 53) % 7) / 7]);

  U.terraforming = {
    html(d, c) {
      const mein = c.dabei ? d.sp[c.PID] : null;
      const daumen = SN && SN.modus === "daumen";
      return `<div class="arena-rahmen"><canvas id="arena" class="arena" aria-label="Planet mit allen Rovern"></canvas></div>
        ${c.dabei ? `<div class="steuerleiste">
          ${daumen ? `<div class="daumenfeld" id="daumenfeld" aria-label="Joystick"><div class="knauf"></div></div>`
            : `<div class="neigehinweis"><svg viewBox="0 0 40 40" aria-hidden="true"><rect x="12" y="5" width="16" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="2.5" transform="rotate(-15 20 20)"/></svg><span>Neigen</span><button class="chipknopf" id="nullen">Gerade stellen</button></div>`}
          <button class="aktionsknopf saat" id="liveaktion" ${mein && mein.bomben ? "" : "data-leer"}>Saatbombe</button>
        </div>
        <p class="leise klein mitte">Fahr über leuchtende Saatkapseln, um eine Saatbombe zu bekommen.
          <button class="link" id="steuerwechsel">${daumen ? "Mit Neigen steuern" : "Mit Daumen steuern"}</button></p>`
        : `<p class="leise mitte">Du schaust zu.</p>`}`;
    },
    binden(c) {
      if (SN) SN.daumen(document.getElementById("daumenfeld"));
      const a = document.getElementById("liveaktion");
      if (a) a.addEventListener("pointerdown", e => { e.preventDefault(); L.druck(); a.classList.remove("blitz"); void a.offsetWidth; a.classList.add("blitz"); });
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
      const cv = document.getElementById("arena");
      if (!cv) return;
      const dpr = Math.min(2, W.devicePixelRatio || 1), px = Math.round(cv.clientWidth * dpr);
      if (cv.width !== px) { cv.width = px; cv.height = px; }
      const g = cv.getContext("2d"), S = px, m = S / 2, sk = S / 2 / 1.08;
      const z = L.zwischen(c.nr, c.jetzt());
      g.clearRect(0, 0, S, S);
      g.fillStyle = "#EAF2FF";
      for (const [x, y, r] of STERNE) { g.globalAlpha = 0.5; g.beginPath(); g.arc(x * S, y * S, r * dpr, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      if (!z) { g.fillStyle = "#9AA7D1"; g.font = `${14 * dpr}px Inter, sans-serif`; g.textAlign = "center"; g.fillText("Verbinde …", m, m); return; }
      const A = z.a, B = z.b, f = z.f, t = L.mix(A.t, B.t, f), ich = d.tn.indexOf(c.PID);
      // Knopf „Saatbombe“ nur hell, wenn man eine hat
      const knopf = document.getElementById("liveaktion");
      if (knopf && ich >= 0 && B.p[ich]) { const hat = !!B.p[ich][4]; if (hat === knopf.hasAttribute("data-leer")) knopf.toggleAttribute("data-leer", !hat); }
      // Planet: kahler Fels, darauf die begrünten Zellen
      const verlauf = g.createRadialGradient(m - sk * 0.3, m - sk * 0.3, sk * 0.1, m, m, sk);
      verlauf.addColorStop(0, "#8B6B4E"); verlauf.addColorStop(1, "#4A3424");
      g.fillStyle = verlauf; g.beginPath(); g.arc(m, m, sk, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(m, m, sk * RAND, 0, TAU); g.clip();
      const zs = ZELLE * sk;
      for (const k of GUELTIG) {
        const v = parseInt(B.g[k], 36);
        if (!v || !d.tn[v - 1]) continue;
        const i = k % N, j = Math.floor(k / N), x = m + (-1 + i * ZELLE) * sk, y = m + (-1 + j * ZELLE) * sk;
        g.fillStyle = c.farbe(d.tn[v - 1]);
        g.globalAlpha = 0.78 + BUSCH[k][0] * 0.2;
        g.fillRect(x - 0.5, y - 0.5, zs + 1, zs + 1);
        g.globalAlpha = 0.25; g.fillStyle = "#06240F";
        g.beginPath(); g.arc(x + zs * (0.3 + BUSCH[k][1] * 0.4), y + zs * (0.3 + BUSCH[k][0] * 0.4), zs * 0.18, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      g.restore();
      // Schatten am Rand für die Rundung
      const schatten = g.createRadialGradient(m, m, sk * 0.7, m, m, sk);
      schatten.addColorStop(0, "rgba(0,0,0,0)"); schatten.addColorStop(1, "rgba(0,0,0,0.45)");
      g.fillStyle = schatten; g.beginPath(); g.arc(m, m, sk, 0, TAU); g.fill();
      g.lineWidth = 3 * dpr; g.strokeStyle = "#2B1D12"; g.stroke();
      // Saatkapseln
      const puls = 0.5 + 0.5 * Math.sin(c.jetzt() / 160);
      for (const [x, y] of B.c) {
        const cx = m + x * sk, cy = m + y * sk, r = KAPSELR * sk;
        const leuchten = g.createRadialGradient(cx, cy, 1, cx, cy, r * (2.2 + puls));
        leuchten.addColorStop(0, "rgba(200,255,120,0.9)"); leuchten.addColorStop(1, "rgba(200,255,120,0)");
        g.fillStyle = leuchten; g.beginPath(); g.arc(cx, cy, r * (2.2 + puls), 0, TAU); g.fill();
        g.fillStyle = "#E9FFB0"; g.strokeStyle = "#2F5E12"; g.lineWidth = 2 * dpr;
        g.beginPath(); g.ellipse(cx, cy, r * 0.7, r, 0.5, 0, TAU); g.fill(); g.stroke();
      }
      // Saatbomben: Ring, der sich ausbreitet
      for (const [x, y, bt, von] of B.b) {
        const seit = t - bt; if (seit < 0 || seit > 900) continue;
        const k = seit / 900;
        g.strokeStyle = c.farbe(d.tn[von]); g.globalAlpha = 1 - k; g.lineWidth = 6 * dpr * (1 - k) + 1;
        g.beginPath(); g.arc(m + x * sk, m + y * sk, BOMBE * sk * (0.3 + 0.8 * k), 0, TAU); g.stroke();
        g.globalAlpha = 1;
      }
      // Rover: andere glatt zwischen zwei Bildern, der eigene nach vorn gerechnet
      const letzt = z.letztes;
      d.tn.forEach((p, i) => {
        const a = A.p[i], b = B.p[i];
        if (!a || !b) return;
        let x = L.mix(a[0], b[0], f), y = L.mix(a[1], b[1], f), vx = b[2], vy = b[3];
        if (i === ich && letzt && letzt.b.p[i]) {
          const q = letzt.b.p[i], dt = Math.min(0.25, Math.max(0, (c.jetzt() - letzt.h + (c.laufzeit || 0) / 2) / 1000));
          x = q[0] + q[2] * dt; y = q[1] + q[3] * dt; vx = q[2]; vy = q[3];
          const l = laenge(x, y); if (l > 1 - PR) { x *= (1 - PR) / l; y *= (1 - PR) / l; }
        }
        const cx = m + x * sk, cy = m + y * sk, r = PR * sk, w = laenge(vx, vy) > 0.05 ? Math.atan2(vy, vx) : 0;
        if (i === ich) { g.strokeStyle = "#EAF2FF"; g.lineWidth = 2 * dpr; g.setLineDash([4 * dpr, 4 * dpr]); g.beginPath(); g.arc(cx, cy, r * 1.5, 0, TAU); g.stroke(); g.setLineDash([]); }
        if (b[4]) { g.fillStyle = `rgba(200,255,120,${0.35 + 0.3 * puls})`; g.beginPath(); g.arc(cx, cy, r * 1.3, 0, TAU); g.fill(); }
        g.save(); g.translate(cx, cy); g.rotate(w);
        g.fillStyle = "#1B2246"; g.fillRect(-r * 0.95, -r * 1.05, r * 1.9, r * 0.45); g.fillRect(-r * 0.95, r * 0.6, r * 1.9, r * 0.45);
        g.restore();
        g.fillStyle = c.farbe(p); g.strokeStyle = "#060A1C"; g.lineWidth = 2.5 * dpr;
        g.beginPath(); g.arc(cx, cy, r * 0.85, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "#060A1C"; g.font = `900 ${Math.round(r * 0.95)}px "Exo 2", Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(c.anfang(p), cx, cy + r * 0.04);
      });
      // Anzeige oben: Restzeit, unten: Anteile
      const anteil = anteile(Array.from(B.g, x => parseInt(x, 36)), d.tn.length);
      g.fillStyle = "#EAF2FF"; g.font = `800 ${14 * dpr}px "Exo 2", Inter, sans-serif`; g.textBaseline = "top";
      g.textAlign = "left"; g.fillText(`${Math.max(0, Math.ceil((DAUER - t) / 1000))} s`, 10 * dpr, 8 * dpr);
      if (ich >= 0) { g.textAlign = "right"; g.fillText(`Du: ${Math.round(anteil[ich + 1])} %`, S - 10 * dpr, 8 * dpr); }
      // Balken mit allen Anteilen
      const bx = S * 0.15, bw = S * 0.7, by = S - 14 * dpr, bh = 7 * dpr;
      let x0 = bx;
      g.fillStyle = "#26305E"; g.fillRect(bx, by, bw, bh);
      d.tn.forEach((p, i) => { const w = bw * anteil[i + 1] / 100; g.fillStyle = c.farbe(p); g.fillRect(x0, by, w, bh); x0 += w; });
    }
  };
})();
