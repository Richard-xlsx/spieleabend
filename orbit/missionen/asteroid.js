// Mission „Zerfallender Asteroid“ (Arena, Neigen): Der Asteroid bröckelt am Rand, und man schubst die anderen ins All.
// Wer abtreibt, wird zur Drohne und lässt Ölflecken fallen, auf denen man rutscht. Es zählt, wie lange man auf dem
// Asteroiden bleibt. Live-Mission: Der Spielleiter rechnet 30-mal pro Sekunde (schritt), die Handys zeichnen (bild).
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const SEG = 28, PR = 0.075, ACC = 2.6, REIB = 1.6, MAXV = 1.25, E = 0.9, SCHUBS = 1.2;
  const RAMM = 1.15, RAMMPAUSE = 1800;
  const OELR = 0.11, OELDAUER = 7000, OELPAUSE = 2200, OELMAX = 8, DROHNE = 0.95;
  const SCHONZEIT = 4000, RISS = 1200, MINR = 0.1, SCHRUMPF = 20000, DAUER = 90000, NACHLAUF = 1500;
  const TAU = Math.PI * 2;

  function randBei(d, w) {
    const x = ((w % TAU) + TAU) % TAU / TAU * SEG, i = Math.floor(x) % SEG, f = x - Math.floor(x);
    return d.rand[i] + (d.rand[(i + 1) % SEG] - d.rand[i]) * f;
  }
  const laenge = (x, y) => Math.hypot(x, y);

  function brechen(d, rng) {
    // Ein Stück am Rand bekommt einen Riss und bricht kurz danach ab. Große Stücke brechen eher.
    const gew = d.rand.map((r, i) => (d.riss.some(x => x.i === i) ? 0 : Math.max(0, r - MINR) ** 2));
    let s = gew.reduce((a, b) => a + b, 0);
    if (s <= 0) return;
    let z = rng() * s, i = 0;
    while (i < SEG - 1 && z > gew[i]) { z -= gew[i]; i++; }
    d.riss.push({ i, bei: d.t + RISS });
  }

  M.asteroid = {
    id: "asteroid", name: "Zerfallender Asteroid", art: "Arena", ab: 2, eingabe: "Neigen", besser: "hoch", einheit: "Sekunden",
    live: true,
    kurz: "Schubs die anderen vom bröckelnden Asteroiden.",
    anleitung: [
      "<b>Neige das Handy</b>, um über den Asteroiden zu rollen. Ohne Sensor steuerst du mit dem Daumen.",
      "Tippe auf <b>„Rammen“</b> für einen Stoß nach vorn und schubs die anderen ins All.",
      "Der Asteroid <b>bröckelt</b>: Rot leuchtende Stellen brechen gleich ab.",
      "Wer abtreibt, wird zur <b>Drohne</b> und lässt Ölflecken fallen. Auf Öl rutscht man.",
      "Es zählt, wie lange du auf dem Asteroiden bleibst. Handy gut festhalten!"
    ],
    neu(tn, rng) {
      const sp = {};
      tn.forEach((p, i) => {
        const w = i / tn.length * TAU + rng() * 0.3, r = tn.length > 1 ? 0.55 : 0;
        sp[p] = { x: Math.cos(w) * r, y: Math.sin(w) * r, vx: 0, vy: 0, drin: true, fiel: null, ramm: 0, rammt: -9999, oelBereit: 0 };
      });
      return {
        tn, t: 0, sp, k: {}, rand: Array.from({ length: SEG }, () => 0.94 + rng() * 0.08), riss: [], naechsterBruch: SCHONZEIT,
        oel: [], endeBei: null, fertig: false
      };
    },
    start() {},
    aktion() { return "?"; },
    takt() { return false; },
    schritt(d, dt, ein, jetzt, ctx) {
      if (d.fertig || dt <= 0) return false;
      d.t += dt * 1000;
      let anders = false;
      // Bröckeln: erst langsam, nach 40 s schneller
      if (d.t >= d.naechsterBruch) { brechen(d, ctx.rng); d.naechsterBruch += d.t > 40000 ? 800 : 1400; }
      for (const r of d.riss.filter(x => d.t >= x.bei)) {
        d.rand[r.i] = Math.max(MINR, d.rand[r.i] - 0.13);
        for (const n of [r.i - 1, r.i + 1]) { const j = (n + SEG) % SEG; d.rand[j] = Math.max(MINR, Math.min(d.rand[j], d.rand[r.i] + 0.1)); }
      }
      d.riss = d.riss.filter(x => d.t < x.bei);
      // Ab 20 s schrumpft der ganze Asteroid langsam, damit jede Runde ein Ende findet
      if (d.t > SCHRUMPF) for (let i = 0; i < SEG; i++) d.rand[i] = Math.max(MINR, d.rand[i] - (0.006 + (d.t - SCHRUMPF) / 1e7) * dt);
      d.oel = d.oel.filter(o => d.t < o.bis);

      for (const p of d.tn) {
        const s = d.sp[p], e = ein[p] || { x: 0, y: 0, k: d.k[p] || 0 };
        let ex = e.x || 0, ey = e.y || 0; const el = laenge(ex, ey); if (el > 1) { ex /= el; ey /= el; }
        const druck = d.k[p] !== undefined && (e.k | 0) > d.k[p];
        if (d.k[p] === undefined || druck) d.k[p] = e.k | 0;
        if (s.drin) {
          const aufOel = d.oel.some(o => laenge(s.x - o.x, s.y - o.y) < OELR + PR * 0.4);
          const steuer = aufOel ? 0.35 : 1, reib = aufOel ? 0.2 : 1;
          s.vx += ex * ACC * steuer * dt; s.vy += ey * ACC * steuer * dt;
          if (druck && d.t >= s.ramm) {
            let rx = ex, ry = ey;
            if (laenge(rx, ry) < 0.2) { rx = s.vx; ry = s.vy; }
            const l = laenge(rx, ry);
            if (l > 0.01) { s.vx += rx / l * RAMM; s.vy += ry / l * RAMM; s.ramm = d.t + RAMMPAUSE; s.rammt = d.t; }
          }
          const f = Math.max(0, 1 - REIB * reib * dt); s.vx *= f; s.vy *= f;
          const v = laenge(s.vx, s.vy), max = d.t - s.rammt < 400 ? MAXV * 2 : MAXV;
          if (v > max) { s.vx *= max / v; s.vy *= max / v; }
          s.x += s.vx * dt; s.y += s.vy * dt;
        } else {
          s.x += ex * DROHNE * dt; s.y += ey * DROHNE * dt;
          const l = laenge(s.x, s.y); if (l > 1.15) { s.x *= 1.15 / l; s.y *= 1.15 / l; }
          if (druck && d.t >= s.oelBereit) {
            d.oel.push({ x: s.x, y: s.y, bis: d.t + OELDAUER, von: d.tn.indexOf(p) });
            if (d.oel.length > OELMAX) d.oel.shift();
            s.oelBereit = d.t + OELPAUSE;
          }
        }
      }
      // Zusammenstöße: Abstoßen und Schwung übertragen, etwas kräftiger als echt, damit Schubsen Spaß macht
      const drin = d.tn.filter(p => d.sp[p].drin);
      for (let i = 0; i < drin.length; i++) for (let j = i + 1; j < drin.length; j++) {
        const a = d.sp[drin[i]], b = d.sp[drin[j]];
        let dx = b.x - a.x, dy = b.y - a.y, l = laenge(dx, dy);
        if (l >= PR * 2) continue;
        if (l < 1e-6) { dx = 1; dy = 0; l = 1; }
        const nx = dx / l, ny = dy / l, ueber = PR * 2 - l;
        a.x -= nx * ueber / 2; a.y -= ny * ueber / 2; b.x += nx * ueber / 2; b.y += ny * ueber / 2;
        const vrel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vrel > 0) {
          const j2 = (1 + E) * vrel / 2 * SCHUBS;
          a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny;
        }
      }
      // Abgetrieben?
      for (const p of drin) {
        const s = d.sp[p];
        if (laenge(s.x, s.y) > randBei(d, Math.atan2(s.y, s.x))) { s.drin = false; s.fiel = d.t; s.oelBereit = d.t + 1500; anders = true; }
      }
      const uebrig = d.tn.filter(p => d.sp[p].drin).length;
      if (d.endeBei === null && (uebrig === 0 || (d.tn.length > 1 && uebrig <= 1))) { d.endeBei = d.t + (uebrig ? NACHLAUF : 0); anders = true; }
      if ((d.endeBei !== null && d.t >= d.endeBei) || d.t >= DAUER) { d.fertig = true; anders = true; }
      return anders;
    },
    wertung(d) {
      return Object.fromEntries(d.tn.map(p => { const s = d.sp[p]; return [p, Math.round((s.fiel === null ? d.t : s.fiel) / 100) / 10]; }));
    },
    // Kompaktes Bild für die Handys (15-mal pro Sekunde)
    bild(d) {
      const r3 = v => Math.round(v * 1000) / 1000;
      return {
        t: Math.round(d.t),
        p: d.tn.map(p => { const s = d.sp[p]; return [r3(s.x), r3(s.y), r3(s.vx), r3(s.vy), s.drin ? 1 : 0, Math.round(Math.min(9999, d.t - s.rammt)), s.fiel === null ? -1 : Math.round(s.fiel)]; }),
        r: d.rand.map(x => Math.round(x * 1000) / 1000),
        ri: d.riss.map(x => [x.i, Math.round(x.bei)]),
        o: d.oel.map(o => [r3(o.x), r3(o.y), Math.round(o.bis), o.von]),
        e: d.endeBei !== null ? 1 : 0
      };
    },
    // Bots: auf den nächsten Gegner zu, am Rand zurück zur Mitte, ab und zu rammen. Als Drohne Öl vor die anderen.
    botEingabe(d, pid, rng) {
      const s = d.sp[pid], k = d.k[pid] || 0;
      const andere = d.tn.filter(p => p !== pid && d.sp[p].drin).map(p => d.sp[p]);
      const naechster = andere.sort((a, b) => laenge(a.x - s.x, a.y - s.y) - laenge(b.x - s.x, b.y - s.y))[0];
      if (!s.drin) {
        if (!naechster) return { x: 0, y: 0, k };
        const dx = naechster.x + naechster.vx * 0.4 - s.x, dy = naechster.y + naechster.vy * 0.4 - s.y, l = laenge(dx, dy) || 1;
        return { x: dx / l, y: dy / l, k: l < 0.15 && d.t >= s.oelBereit && rng() < 0.3 ? k + 1 : k };
      }
      const rr = randBei(d, Math.atan2(s.y, s.x)), weit = laenge(s.x, s.y);
      let x = 0, y = 0;
      if (weit > rr - Math.min(0.28, rr * 0.45)) { x = -s.x / (weit || 1); y = -s.y / (weit || 1); }
      else if (naechster) { const dx = naechster.x - s.x, dy = naechster.y - s.y, l = laenge(dx, dy) || 1; x = dx / l * 0.75; y = dy / l * 0.75; }
      x += (rng() - 0.5) * 0.5; y += (rng() - 0.5) * 0.5;
      const ramm = naechster && laenge(naechster.x - s.x, naechster.y - s.y) < 0.3 && weit < rr - 0.2 && d.t >= s.ramm && rng() < 0.12;
      return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), k: ramm ? k + 1 : k };
    }
  };

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  const L = W.ORBIT_LIVE, SN = W.ORBIT_SENSOR;
  const KRATER = [[0.3, 0.2, 0.12], [-0.35, -0.25, 0.09], [-0.1, 0.45, 0.07], [0.45, -0.4, 0.08], [-0.55, 0.15, 0.06], [0.1, -0.6, 0.05], [0.62, 0.35, 0.05]];
  const STERNE = Array.from({ length: 40 }, (_, i) => [((i * 97) % 100) / 100, ((i * 61 + 17) % 100) / 100, i % 3 ? 0.6 : 1.2]);

  function steuerung(d, c, mein) {
    const drohne = mein && !mein.drin;
    const daumen = SN && SN.modus === "daumen";
    return `<div class="steuerleiste">
        ${daumen ? `<div class="daumenfeld" id="daumenfeld" aria-label="Joystick"><div class="knauf"></div></div>`
          : `<div class="neigehinweis"><svg viewBox="0 0 40 40" aria-hidden="true"><rect x="12" y="5" width="16" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="2.5" transform="rotate(-15 20 20)"/></svg><span>Neigen</span><button class="chipknopf" id="nullen">Gerade stellen</button></div>`}
        <button class="aktionsknopf ${drohne ? "oel" : ""}" id="liveaktion">${drohne ? "Öl ablassen" : "Rammen"}</button>
      </div>
      <p class="leise klein mitte">${drohne ? "Du bist abgetrieben und fliegst jetzt als Drohne. Lass Öl vor die anderen fallen!" : "Handy gut festhalten."}
        <button class="link" id="steuerwechsel">${daumen ? "Mit Neigen steuern" : "Mit Daumen steuern"}</button></p>`;
  }

  U.asteroid = {
    html(d, c) {
      const mein = c.dabei ? d.sp[c.PID] : null;
      return `<div class="arena-rahmen"><canvas id="arena" class="arena" aria-label="Asteroid mit allen Figuren"></canvas></div>
        ${c.dabei ? steuerung(d, c, mein) : `<p class="leise mitte">Du schaust zu.</p>`}`;
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
      const dpr = Math.min(2, W.devicePixelRatio || 1), breite = cv.clientWidth, px = Math.round(breite * dpr);
      if (cv.width !== px) { cv.width = px; cv.height = px; }
      const g = cv.getContext("2d"), S = px, m = S / 2, sk = S / 2 / 1.22;
      const z = L.zwischen(c.nr, c.jetzt());
      g.clearRect(0, 0, S, S);
      g.fillStyle = "#EAF2FF";
      for (const [x, y, r] of STERNE) { g.globalAlpha = 0.5; g.beginPath(); g.arc(x * S, y * S, r * dpr, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      if (!z) { g.fillStyle = "#9AA7D1"; g.font = `${14 * dpr}px Inter, sans-serif`; g.textAlign = "center"; g.fillText("Verbinde …", m, m); return; }
      const A = z.a, B = z.b, f = z.f, t = L.mix(A.t, B.t, f);
      const rand = B.r.map((r, i) => L.mix(A.r[i] !== undefined ? A.r[i] : r, r, f));
      // Asteroid
      const punkte = rand.map((r, i) => { const w = i / SEG * TAU; return [m + Math.cos(w) * r * sk, m + Math.sin(w) * r * sk]; });
      g.beginPath();
      for (let i = 0; i <= SEG; i++) {
        const p = punkte[i % SEG], q = punkte[(i + 1) % SEG], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(p[0], p[1], mx, my);
      }
      g.closePath();
      const verlauf = g.createRadialGradient(m - sk * 0.3, m - sk * 0.3, sk * 0.1, m, m, sk);
      verlauf.addColorStop(0, "#8A7A6C"); verlauf.addColorStop(1, "#4E4238");
      g.fillStyle = verlauf; g.fill();
      g.lineWidth = 3 * dpr; g.strokeStyle = "#2E2620"; g.stroke();
      g.save(); g.clip();
      g.fillStyle = "#00000033";
      for (const [x, y, r] of KRATER) { g.beginPath(); g.arc(m + x * sk, m + y * sk, r * sk, 0, TAU); g.fill(); }
      g.restore();
      // Risse: diese Stellen brechen gleich ab
      const puls = 0.5 + 0.5 * Math.sin(c.jetzt() / 90);
      for (const [i, bei] of B.ri) {
        const w0 = (i - 0.6) / SEG * TAU, w1 = (i + 1.6) / SEG * TAU, r = rand[i] * sk, nah = Math.max(0, 1 - (bei - t) / RISS);
        g.beginPath(); g.arc(m, m, r - 6 * dpr, w0, w1);
        g.strokeStyle = `rgba(255,92,92,${0.35 + 0.65 * puls * nah})`; g.lineWidth = (5 + 6 * nah) * dpr; g.stroke();
      }
      // Öl
      for (const [x, y, bis] of B.o) {
        const a = Math.min(1, (bis - t) / 800);
        const og = g.createRadialGradient(m + x * sk, m + y * sk, 1, m + x * sk, m + y * sk, OELR * sk);
        og.addColorStop(0, `rgba(20,16,40,${0.95 * a})`); og.addColorStop(0.6, `rgba(70,40,110,${0.8 * a})`); og.addColorStop(1, `rgba(46,196,182,${0.25 * a})`);
        g.fillStyle = og; g.beginPath(); g.arc(m + x * sk, m + y * sk, OELR * sk, 0, TAU); g.fill();
      }
      // Figuren: andere glatt zwischen zwei Bildern, die eigene nach vorn gerechnet
      const ich = d.tn.indexOf(c.PID), letzt = z.letztes;
      const figuren = d.tn.map((p, i) => {
        const a = A.p[i], b = B.p[i];
        if (!a || !b) return null;
        let x = L.mix(a[0], b[0], f), y = L.mix(a[1], b[1], f);
        if (i === ich && letzt && letzt.b.p[i] && letzt.b.p[i][4]) {
          const q = letzt.b.p[i], dt = Math.min(0.25, Math.max(0, (c.jetzt() - letzt.h + (c.laufzeit || 0) / 2) / 1000));
          x = q[0] + q[2] * dt; y = q[1] + q[3] * dt;
        }
        return { p, i, x, y, drin: b[4], ramm: b[5], fiel: b[6] };
      }).filter(Boolean);
      const zeichneHelm = (fg, x, y, r, alpha) => {
        g.globalAlpha = alpha;
        g.fillStyle = c.farbe(fg.p); g.strokeStyle = "#060A1C"; g.lineWidth = 2.5 * dpr;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "#0A1030"; g.beginPath(); g.roundRect ? g.roundRect(x - r * 0.65, y - r * 0.4, r * 1.3, r * 0.8, r * 0.35) : g.rect(x - r * 0.65, y - r * 0.4, r * 1.3, r * 0.8); g.fill();
        g.fillStyle = c.farbe(fg.p); g.font = `900 ${Math.round(r * 0.75)}px "Exo 2", Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(c.anfang(fg.p), x, y + r * 0.04);
        g.globalAlpha = 1;
      };
      for (const fg of figuren) {
        const x = m + fg.x * sk, y = m + fg.y * sk, r = PR * sk;
        if (fg.drin) {
          if (fg.ramm < 250) { g.strokeStyle = `rgba(255,255,255,${1 - fg.ramm / 250})`; g.lineWidth = 4 * dpr; g.beginPath(); g.arc(x, y, r * (1.2 + fg.ramm / 300), 0, TAU); g.stroke(); }
          if (fg.i === ich) { g.strokeStyle = "#EAF2FF"; g.lineWidth = 2 * dpr; g.setLineDash([4 * dpr, 4 * dpr]); g.beginPath(); g.arc(x, y, r * 1.45, 0, TAU); g.stroke(); g.setLineDash([]); }
          zeichneHelm(fg, x, y, r, 1);
        } else {
          const seit = t - fg.fiel;
          if (seit < 700) { const k = 1 - seit / 700; zeichneHelm(fg, x, y, r * (0.3 + 0.7 * k), k); }
        }
      }
      // Drohnen über allem
      for (const fg of figuren) {
        if (fg.drin || t - fg.fiel < 700) continue;
        const x = m + fg.x * sk, y = m + fg.y * sk, r = PR * sk * 0.75;
        g.globalAlpha = 0.85;
        g.fillStyle = "#26305E"; g.beginPath(); g.ellipse(x, y, r * 1.5, r * 0.6, 0, 0, TAU); g.fill();
        g.fillStyle = c.farbe(fg.p); g.beginPath(); g.arc(x, y - r * 0.2, r * 0.7, Math.PI, 0); g.fill();
        g.strokeStyle = fg.i === ich ? "#EAF2FF" : "#9AA7D1"; g.lineWidth = 1.5 * dpr; g.beginPath(); g.ellipse(x, y, r * 1.5, r * 0.6, 0, 0, TAU); g.stroke();
        g.globalAlpha = 1;
      }
      // Anzeige oben: Zeit und wie viele noch drauf sind
      const uebrig = figuren.filter(x => x.drin).length;
      g.fillStyle = "#EAF2FF"; g.font = `800 ${14 * dpr}px "Exo 2", Inter, sans-serif`; g.textBaseline = "top";
      g.textAlign = "left"; g.fillText(`${Math.floor(t / 1000)} s`, 10 * dpr, 8 * dpr);
      g.textAlign = "right"; g.fillText(`${uebrig} auf dem Asteroiden`, S - 10 * dpr, 8 * dpr);
    }
  };
})();
