// Mission „Alien im Frachtraum“ (Einer gegen alle, Neigen): Das Alien schleicht unsichtbar durch den dunklen
// Frachtraum und frisst Proviant. Die Crew sucht es mit Helmlampen. Steht das Alien im Lichtkegel, schmilzt sein
// Schild; ist er leer, gewinnt die Crew. Frisst das Alien 8 Proviantpakete, gewinnt es. Nach 80 Sekunden gewinnt die Crew.
// Spuren für die Crew: Wo Proviant verschwindet, blitzt es kurz, und wer rennt, macht Geräusche (Ringe in der Nähe).
// Die Position des Aliens bekommt die Crew nur, solange es im Licht steht (bildFuer).
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const PR = 0.05, WAND = 0.95;
  const MAXC = 0.4, MAXA = 0.58, ACC = 5;            // Höchsttempo Crew und Alien
  const LR = 0.62, HW = 0.42, NAH = 0.13, DREH = 7;   // Lichtkegel: Reichweite, halber Winkel, Schein ums Helmlicht
  const SCHILD = 1, LEER1 = 0.5, LEER2 = 0.8, AUFLADEN = 0.08, RUHE = 2000;   // nach 2 s im Dunkeln lädt der Schild langsam auf        // Schild schmilzt pro Sekunde (eine Lampe / mehrere)
  const ZIEL = 8, PROVIANT = 3, NACHSCHUB = 1200, PR_P = 0.045;
  const LAUT = 0.62 * MAXA, GERAEUSCH = 500, STREU = 0.15;
  const DAUER = 80000, ENTHUELLUNG = 3000;
  const KISTEN = [[-0.62, -0.58, -0.36, -0.36], [0.3, -0.66, 0.58, -0.44], [-0.16, -0.14, 0.16, 0.12], [-0.66, 0.3, -0.44, 0.6], [0.36, 0.32, 0.62, 0.54], [-0.1, 0.62, 0.18, 0.78]];
  const TAU = Math.PI * 2;
  const laenge = (x, y) => Math.hypot(x, y);
  const winkelDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

  // Aus Kisten und Wänden herausschieben (Kreis gegen Rechteck)
  function kollision(s, r) {
    const g = WAND - r;
    if (s.x < -g) { s.x = -g; if (s.vx < 0) s.vx = 0; } if (s.x > g) { s.x = g; if (s.vx > 0) s.vx = 0; }
    if (s.y < -g) { s.y = -g; if (s.vy < 0) s.vy = 0; } if (s.y > g) { s.y = g; if (s.vy > 0) s.vy = 0; }
    for (const [x0, y0, x1, y1] of KISTEN) {
      const nx = Math.max(x0, Math.min(x1, s.x)), ny = Math.max(y0, Math.min(y1, s.y));
      let dx = s.x - nx, dy = s.y - ny, l = laenge(dx, dy);
      if (l >= r) continue;
      if (l < 1e-6) {   // Mitte steckt in der Kiste: zur nächsten Kante
        const k = [[s.x - x0, -1, 0], [x1 - s.x, 1, 0], [s.y - y0, 0, -1], [y1 - s.y, 0, 1]].sort((a, b) => a[0] - b[0])[0];
        dx = k[1]; dy = k[2]; l = 1;
        s.x = k[1] ? (k[1] < 0 ? x0 : x1) : s.x; s.y = k[2] ? (k[2] < 0 ? y0 : y1) : s.y;
        s.x += dx * r; s.y += dy * r;
      } else { s.x = nx + dx / l * r; s.y = ny + dy / l * r; }
      const vn = s.vx * dx / l + s.vy * dy / l;
      if (vn < 0) { s.vx -= vn * dx / l; s.vy -= vn * dy / l; }
    }
  }
  const inKiste = (x, y, rand) => KISTEN.some(([x0, y0, x1, y1]) => x > x0 - rand && x < x1 + rand && y > y0 - rand && y < y1 + rand);
  // Verdeckt eine Kiste die Strecke von a nach b? (Liang-Barsky)
  function verdeckt(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    for (const [x0, y0, x1, y1] of KISTEN) {
      let t0 = 0, t1 = 1, ok = true;
      for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) {
        if (Math.abs(p) < 1e-9) { if (q < 0) { ok = false; break; } continue; }
        const r = q / p;
        if (p < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; }
        else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; }
      }
      if (ok && t0 <= t1) return true;
    }
    return false;
  }
  // Wie viele Lampen treffen den Punkt? Kisten werfen Schatten.
  function lampen(d, x, y) {
    let n = 0;
    for (const p of d.tn) {
      if (p === d.einzelner) continue;
      const s = d.sp[p], dx = x - s.x, dy = y - s.y, l = laenge(dx, dy);
      if (l < NAH + PR || (l < d.lr + PR && Math.abs(winkelDiff(Math.atan2(dy, dx), s.w)) < HW + PR / Math.max(l, 0.05) && !verdeckt(s.x, s.y, x, y))) n++;
    }
    return n;
  }
  function proviantSetzen(d, rng) {
    const a = d.sp[d.einzelner];
    for (let v = 0; v < 40; v++) {
      const x = (rng() * 2 - 1) * 0.85, y = (rng() * 2 - 1) * 0.85;
      if (inKiste(x, y, 0.07)) continue;
      if (laenge(a.x - x, a.y - y) < 0.4 || d.proviant.some(q => laenge(q.x - x, q.y - y) < 0.3)) continue;
      d.proviant.push({ x, y, id: ++d.proviantNr });
      return;
    }
  }

  M.frachtraum = {
    id: "frachtraum", name: "Alien im Frachtraum", art: "Einer gegen alle", ab: 3, eingabe: "Neigen", besser: "hoch", einheit: "Proviant",
    live: true,
    kurz: "Das Alien schleicht unsichtbar durch den Frachtraum. Leuchtet es an!",
    anleitung: [
      "Einer ist das <b>Alien</b>: unsichtbar für die anderen. Es frisst <b>Proviant</b>, bei 8 Paketen gewinnt es.",
      "Die <b>Crew</b> trägt Helmlampen und leuchtet in die Richtung, in die sie läuft. Steht das Alien im Licht, <b>schmilzt sein Schild</b>. Hinter Kisten ist Schatten.",
      "Spuren: Wo Proviant verschwindet, blitzt es. Und wenn das Alien rennt, hört man es (Ringe in der Nähe).",
      "Alle lenken durch <b>Neigen</b>. Ist der Schild leer oder sind <b>80 Sekunden</b> um, gewinnt die Crew."
    ],
    neu(tn, rng, einzelner) {
      const e = einzelner || tn[0], crew = tn.filter(p => p !== e), sp = {};
      sp[e] = { x: (rng() * 2 - 1) * 0.5, y: -0.84, vx: 0, vy: 0, w: Math.PI / 2 };
      crew.forEach((p, i) => { sp[p] = { x: crew.length > 1 ? -0.7 + 1.4 * i / (crew.length - 1) : 0, y: 0.86, vx: 0, vy: 0, w: -Math.PI / 2 }; });
      // Je größer die Crew, desto kürzer die Lampen (sonst ist der Raum zu hell)
      const d = { tn, einzelner: e, lr: LR * (crew.length <= 2 ? 1 : crew.length <= 3 ? 0.82 : crew.length <= 4 ? 0.72 : 0.66), t: 0, sp, schild: SCHILD, licht: 0, gefressen: 0, proviant: [], proviantNr: 0, nachschub: [],
        geraeusche: [], blitze: [], gesehen: null, letzterLaut: -9999, ende: null, dabei: {}, fertig: false };
      for (let i = 0; i < PROVIANT; i++) {
        // Der erste Proviant liegt in der Mitte, die anderen irgendwo
        const v = d.proviant.length;
        proviantSetzen(d, rng);
        if (d.proviant.length === v) d.proviant.push({ x: 0, y: 0.3, id: ++d.proviantNr });
      }
      return d;
    },
    start(d, jetzt, ctx) { for (const p of ctx.aktiv) d.dabei[p] = true; },
    aktion() { return "?"; },
    takt() { return false; },
    schritt(d, dt, ein, jetzt, ctx) {
      if (d.fertig || dt <= 0) return false;
      d.t += dt * 1000;
      let anders = false;
      if (d.ende) {
        if (d.t >= d.ende.t + ENTHUELLUNG) { d.fertig = true; anders = true; }
        return anders;
      }
      for (const p of d.tn) {
        const s = d.sp[p], e = ein[p] || { x: 0, y: 0 }, max = p === d.einzelner ? MAXA : MAXC;
        let ex = e.x || 0, ey = e.y || 0; const el = laenge(ex, ey); if (el > 1) { ex /= el; ey /= el; }
        const f = Math.min(1, ACC * dt);
        s.vx += (ex * max - s.vx) * f; s.vy += (ey * max - s.vy) * f;
        s.x += s.vx * dt; s.y += s.vy * dt;
        kollision(s, PR);
        // Die Lampe dreht sich in Laufrichtung
        if (laenge(s.vx, s.vy) > 0.06) {
          const dw = winkelDiff(Math.atan2(s.vy, s.vx), s.w), max2 = DREH * dt;
          s.w += Math.max(-max2, Math.min(max2, dw));
        }
      }
      const a = d.sp[d.einzelner];
      // Licht: der Schild schmilzt
      const n = lampen(d, a.x, a.y), vorher = d.licht;
      d.licht = n;
      if (n) {
        d.schild = Math.max(0, d.schild - (n > 1 ? LEER2 : LEER1) * dt);
        d.gesehen = { x: a.x, y: a.y, t: d.t };
        if (d.schild <= 0) { d.ende = { art: "erwischt", t: d.t }; anders = true; }
      } else if (d.gesehen && d.t - d.gesehen.t > RUHE) d.schild = Math.min(SCHILD, d.schild + AUFLADEN * dt);
      if (!!n !== !!vorher) anders = true;
      // Geräusche beim Rennen (nicht genau an der Stelle des Aliens)
      if (laenge(a.vx, a.vy) > LAUT && d.t - d.letzterLaut > GERAEUSCH) {
        const w = ctx.rng() * TAU, r = ctx.rng() * STREU;
        d.geraeusche.push({ x: a.x + Math.cos(w) * r, y: a.y + Math.sin(w) * r, t: d.t });
        d.letzterLaut = d.t;
      }
      d.geraeusche = d.geraeusche.filter(g => d.t - g.t < 1400);
      d.blitze = d.blitze.filter(b => d.t - b.t < 1400);
      // Fressen
      const q = d.proviant.find(q => laenge(q.x - a.x, q.y - a.y) < PR + PR_P);
      if (q && !d.ende) {
        d.proviant = d.proviant.filter(x => x !== q);
        d.gefressen += 1; d.blitze.push({ x: q.x, y: q.y, t: d.t });
        d.nachschub.push(d.t + NACHSCHUB);
        anders = true;
        if (d.gefressen >= ZIEL) d.ende = { art: "satt", t: d.t };
      }
      while (d.nachschub.length && d.t >= d.nachschub[0]) { d.nachschub.shift(); proviantSetzen(d, ctx.rng); anders = true; }
      if (!d.ende && d.t >= DAUER) { d.ende = { art: "zeit", t: d.t }; anders = true; }
      return anders;
    },
    ausgang(d) { return d.ende && d.ende.art === "satt" ? "einzeln" : "crew"; },
    wertung(d) { return Object.fromEntries(d.tn.map(p => [p, d.dabei[p] ? (p === d.einzelner ? d.gefressen : 0) : null])); },
    wertText(d, p) {
      if (p === d.einzelner) return `Alien · ${d.gefressen} von ${ZIEL} Proviant`;
      return "Crew";
    },
    bild(d) {
      const r3 = v => Math.round(v * 1000) / 1000, r2 = v => Math.round(v * 100) / 100;
      return {
        t: Math.round(d.t), s: r2(d.schild), l: d.licht, n: d.gefressen,
        p: d.tn.map(p => { const s = d.sp[p]; return [r3(s.x), r3(s.y), r3(s.vx), r3(s.vy), r2(s.w)]; }),
        v: d.proviant.map(q => [r3(q.x), r3(q.y), q.id]),
        g: d.geraeusche.map(g => [r3(g.x), r3(g.y), Math.round(g.t)]),
        b: d.blitze.map(b => [r3(b.x), r3(b.y), Math.round(b.t)])
      };
    },
    // Die Crew sieht das Alien nur im Licht (und am Ende)
    bildFuer(b, d, pid) {
      if (pid === d.einzelner || d.ende || b.l) return b;
      const i = d.tn.indexOf(d.einzelner), p = b.p.slice();
      p[i] = null;
      return Object.assign({}, b, { p });
    },
    sicht(d, pid) {
      const v = Object.assign({}, d);
      delete v.botZiel;
      if (pid !== d.einzelner && !d.ende) { v.sp = Object.assign({}, d.sp); v.sp[d.einzelner] = null; }
      return v;
    },
    // Bots: Das Alien holt sich den sichersten Proviant und weicht den Lampen aus, in der Nähe der Crew schleicht es.
    // Die Crew läuft zu den letzten Spuren (Geräusch, Blitz, Sichtung), sonst bewacht sie Proviant.
    botEingabe(d, pid, rng) {
      d.botZiel = d.botZiel || {};
      const s = d.sp[pid];
      if (d.ende) return { x: 0, y: 0, k: 0 };
      if (pid === d.einzelner) {
        const crew = d.tn.filter(p => p !== pid).map(p => d.sp[p]);
        // Gefahr an einem Punkt: im Kegel oder nah an der Crew
        const gefahr = (x, y) => crew.reduce((n, c) => {
          const dx = x - c.x, dy = y - c.y, l = laenge(dx, dy);
          const kegel = l < d.lr * 1.3 && !verdeckt(c.x, c.y, x, y) ? Math.max(0, 1 - Math.abs(winkelDiff(Math.atan2(dy, dx), c.w)) / (HW * 1.7)) * (1.4 - l / d.lr) * 4 : 0;
          return n + kegel + Math.max(0, 0.5 - l) * 4;
        }, 0);
        let ziel = d.botZiel[pid];
        if (!ziel || d.t > ziel.bis || (ziel.id >= 0 && !d.proviant.some(q => q.id === ziel.id))) {
          const wert = q => laenge(q.x - s.x, q.y - s.y) + crew.reduce((n, c) => n + Math.max(0, 0.6 - laenge(c.x - q.x, c.y - q.y)) * 3, 0);
          const q = d.proviant.slice().sort((a, b) => wert(a) - wert(b))[0];
          ziel = q && wert(q) < 2 ? { x: q.x, y: q.y, id: q.id, bis: d.t + 2500 } : { x: (rng() * 2 - 1) * 0.8, y: (rng() * 2 - 1) * 0.8, id: -1, bis: d.t + 1500 };
          d.botZiel[pid] = ziel;
        }
        // 12 Richtungen und Stehenbleiben durchprobieren: nah zum Ziel, weg vom Licht, nicht in eine Kiste
        const l0 = laenge(ziel.x - s.x, ziel.y - s.y), nah = Math.min(...crew.map(c => laenge(c.x - s.x, c.y - s.y)));
        const bedroht = d.licht || gefahr(s.x, s.y) > 1.5, tempo = !bedroht && nah < 0.6 ? 0.55 : 1, schritt = bedroht ? 0.3 : 0.18 * tempo;
        let best = { x: 0, y: 0 }, bk = gefahr(s.x, s.y) * 1.5 + l0 * 0.8;
        for (let k = 0; k < 12; k++) {
          const w = k / 12 * TAU, x = s.x + Math.cos(w) * schritt, y = s.y + Math.sin(w) * schritt;
          if (Math.abs(x) > WAND - PR || Math.abs(y) > WAND - PR || inKiste(x, y, PR)) continue;
          const kosten = gefahr(x, y) * 1.5 + laenge(ziel.x - x, ziel.y - y) * 0.8 + rng() * 0.05;
          if (kosten < bk) { bk = kosten; best = { x: Math.cos(w) * tempo, y: Math.sin(w) * tempo }; }
        }
        return { x: best.x, y: best.y, k: 0 };
      }
      let ziel = d.botZiel[pid];
      const spuren = d.geraeusche.concat(d.blitze).concat(d.gesehen ? [d.gesehen] : []).filter(x => d.t - x.t < 3000 && d.t - x.t > 400).sort((a, b) => b.t - a.t);
      if (spuren.length && (!ziel || (ziel.spur !== spuren[0].t && d.t - ziel.seit > 700)) && rng() < 0.5) {
        ziel = { x: spuren[0].x + (rng() - 0.5) * 0.35, y: spuren[0].y + (rng() - 0.5) * 0.35, spur: spuren[0].t, seit: d.t, bis: d.t + 2500 };
      } else if (!ziel || d.t > ziel.bis || laenge(ziel.x - s.x, ziel.y - s.y) < 0.08) {
        const q = d.proviant[Math.floor(rng() * d.proviant.length)];
        ziel = q && rng() < 0.6 ? { x: q.x + (rng() - 0.5) * 0.5, y: q.y + (rng() - 0.5) * 0.5, seit: d.t, bis: d.t + 3000 } : { x: (rng() * 2 - 1) * 0.8, y: (rng() * 2 - 1) * 0.8, seit: d.t, bis: d.t + 3000 };
      }
      d.botZiel[pid] = ziel;
      const dx = ziel.x - s.x, dy = ziel.y - s.y, l = laenge(dx, dy) || 1, w = Math.sin(d.t / 400 + d.tn.indexOf(pid)) * 0.35;
      return { x: dx / l * 0.85 + -dy / l * w, y: dy / l * 0.85 + dx / l * w, k: 0 };
    }
  };
  M.frachtraum.hilfe = { KISTEN, lampen, kollision, verdeckt, LR, HW, ZIEL, DAUER, ENTHUELLUNG, MAXA, LAUT };

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  const L = W.ORBIT_LIVE, SN = W.ORBIT_SENSOR;
  let dunkel = null;   // eigene Fläche für die Dunkelheit mit ausgeschnittenen Lichtkegeln

  function zeichneAlien(g, x, y, r, dpr, alpha) {
    g.globalAlpha = alpha;
    g.fillStyle = "#7BD957"; g.strokeStyle = "#060A1C"; g.lineWidth = 2.2 * dpr;
    g.beginPath(); g.ellipse(x, y, r * 0.95, r * 1.1, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = "#060A1C";
    g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.15, r * 0.24, r * 0.38, -0.45, 0, TAU); g.ellipse(x + r * 0.38, y - r * 0.15, r * 0.24, r * 0.38, 0.45, 0, TAU); g.fill();
    g.strokeStyle = "#7BD957"; g.lineWidth = 2 * dpr;
    g.beginPath(); g.moveTo(x - r * 0.4, y - r * 1); g.lineTo(x - r * 0.6, y - r * 1.5); g.moveTo(x + r * 0.4, y - r * 1); g.lineTo(x + r * 0.6, y - r * 1.5); g.stroke();
    g.globalAlpha = 1;
  }
  // Schatten einer Kiste vom Licht bei (lx, ly) aus: jede Kante weit nach hinten verlängert
  function schatten(g, lx, ly, sk, m) {
    for (const [x0, y0, x1, y1] of KISTEN) {
      const ecken = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      for (let i = 0; i < 4; i++) {
        const a = ecken[i], b = ecken[(i + 1) % 4];
        const fern = q => { const dx = q[0] - lx, dy = q[1] - ly, l = laenge(dx, dy) || 1; return [q[0] + dx / l * 3, q[1] + dy / l * 3]; };
        const fa = fern(a), fb = fern(b);
        g.beginPath(); g.moveTo(m + a[0] * sk, m + a[1] * sk); g.lineTo(m + b[0] * sk, m + b[1] * sk); g.lineTo(m + fb[0] * sk, m + fb[1] * sk); g.lineTo(m + fa[0] * sk, m + fa[1] * sk); g.closePath(); g.fill();
      }
    }
  }
  let lampe = null, reichweite = LR;   // Hilfsfläche: ein Lichtkegel ohne die Schatten
  function kegelMitSchatten(g, x, y, w, sk, m, alpha, S) {
    if (!lampe) lampe = document.createElement("canvas");
    if (lampe.width !== S) { lampe.width = S; lampe.height = S; }
    const h = lampe.getContext("2d");
    h.globalCompositeOperation = "source-over"; h.clearRect(0, 0, S, S);
    kegel(h, x, y, w, sk, m, alpha, true);
    h.globalCompositeOperation = "destination-out"; h.fillStyle = "#000";
    schatten(h, x, y, sk, m);
    h.globalCompositeOperation = "source-over";
    kegel(h, x, y, w, sk, m, alpha, false, true);   // der Schein direkt am Helm bleibt
    g.drawImage(lampe, 0, 0);
  }
  function kegel(g, x, y, w, sk, m, alpha, ohneNah, nurNah) {
    const cx = m + x * sk, cy = m + y * sk, r = reichweite * sk;
    if (nurNah) {
      const n = g.createRadialGradient(cx, cy, 0, cx, cy, NAH * sk * 1.3);
      n.addColorStop(0, `rgba(255,236,170,${alpha})`); n.addColorStop(1, "rgba(255,236,170,0)");
      g.fillStyle = n; g.beginPath(); g.arc(cx, cy, NAH * sk * 1.3, 0, TAU); g.fill();
      return;
    }
    const v = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    v.addColorStop(0, `rgba(255,236,170,${alpha})`); v.addColorStop(0.75, `rgba(255,236,170,${alpha * 0.75})`); v.addColorStop(1, "rgba(255,236,170,0)");
    g.fillStyle = v;
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, w - HW, w + HW); g.closePath(); g.fill();
    if (ohneNah) return;
    const n = g.createRadialGradient(cx, cy, 0, cx, cy, NAH * sk * 1.3);
    n.addColorStop(0, `rgba(255,236,170,${alpha})`); n.addColorStop(1, "rgba(255,236,170,0)");
    g.fillStyle = n; g.beginPath(); g.arc(cx, cy, NAH * sk * 1.3, 0, TAU); g.fill();
  }

  U.frachtraum = {
    html(d, c) {
      const alien = c.PID === d.einzelner, daumen = SN && SN.modus === "daumen";
      const kopf = `<div class="missionskopf"><span class="etikett">${alien ? "Du bist das Alien" : `Alien: ${c.esc(c.name(d.einzelner))}`}</span><span class="etikett">Proviant ${d.gefressen} von ${ZIEL}</span></div>`;
      let unten = "";
      if (d.ende) unten = `<p class="mitte gross"><b>${d.ende.art === "erwischt" ? "Erwischt! Die Crew gewinnt." : d.ende.art === "satt" ? "Das Alien ist satt und gewinnt!" : "Zeit um, die Crew gewinnt!"}</b></p>`;
      else if (c.dabei) unten = `<div class="steuerleiste">
          ${daumen ? `<div class="daumenfeld" id="daumenfeld" aria-label="Joystick"><div class="knauf"></div></div>`
            : `<div class="neigehinweis"><svg viewBox="0 0 40 40" aria-hidden="true"><rect x="12" y="5" width="16" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="2.5" transform="rotate(-15 20 20)"/></svg><span>Neigen</span><button class="chipknopf" id="nullen">Gerade stellen</button></div>`}
          <p class="leise klein gwtext">${alien ? "Friss Proviant und bleib aus dem Licht. Wer rennt, ist zu hören. Langsam ist leise." : "Deine Lampe leuchtet, wohin du läufst. Folgt den Geräuschen und Blitzen!"}</p>
        </div>
        <p class="leise klein mitte"><button class="link" id="steuerwechsel">${daumen ? "Mit Neigen steuern" : "Mit Daumen steuern"}</button></p>`;
      else unten = `<p class="leise mitte">Du schaust zu.</p>`;
      return kopf + `<div class="arena-rahmen eckig"><canvas id="arena" class="arena fracht" aria-label="Dunkler Frachtraum"></canvas></div>${unten}`;
    },
    binden(c) {
      if (SN) SN.daumen(document.getElementById("daumenfeld"));
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
      const g = cv.getContext("2d"), S = px, m = S / 2, sk = S / 2;
      const z = L.zwischen(c.nr, c.jetzt()), alien = c.PID === d.einzelner, jetzt = c.jetzt();
      reichweite = d.lr || LR;
      // Boden und Kisten
      g.fillStyle = "#1B2246"; g.fillRect(0, 0, S, S);
      g.strokeStyle = "rgba(154,167,209,0.14)"; g.lineWidth = 1 * dpr;
      for (let i = 1; i < 8; i++) { const p = i / 8 * S; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.moveTo(0, p); g.lineTo(S, p); g.stroke(); }
      g.strokeStyle = "#060A1C"; g.lineWidth = 8 * dpr; g.strokeRect(m - WAND * sk, m - WAND * sk, 2 * WAND * sk, 2 * WAND * sk);
      for (const [x0, y0, x1, y1] of KISTEN) {
        const x = m + x0 * sk, y = m + y0 * sk, w = (x1 - x0) * sk, h = (y1 - y0) * sk;
        g.fillStyle = "#8A5A2B"; g.strokeStyle = "#060A1C"; g.lineWidth = 2.5 * dpr; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
        g.strokeStyle = "#5E3B19"; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.moveTo(x + w, y); g.lineTo(x, y + h); g.stroke();
      }
      if (!z) { g.fillStyle = "#9AA7D1"; g.font = `${14 * dpr}px Inter, sans-serif`; g.textAlign = "center"; g.fillText("Verbinde …", m, m); return; }
      const A = z.a, B = z.b, f = z.f, t = L.mix(A.t, B.t, f), ai = d.tn.indexOf(d.einzelner), ich = d.tn.indexOf(c.PID);
      // Positionen: andere glatt zwischen zwei Bildern, die eigene Figur nach vorn gerechnet
      const letzt = z.letztes, pos = d.tn.map((p, i) => {
        const a = A.p[i], b = B.p[i];
        if (!b) return null;
        if (i === ich && letzt && letzt.b.p[i] && !d.ende) {
          const q = letzt.b.p[i], dt = Math.min(0.25, Math.max(0, (jetzt - letzt.h + (c.laufzeit || 0) / 2) / 1000));
          return { x: q[0] + q[2] * dt, y: q[1] + q[3] * dt, w: q[4] };
        }
        if (!a) return { x: b[0], y: b[1], w: b[4] };
        return { x: L.mix(a[0], b[0], f), y: L.mix(a[1], b[1], f), w: a[4] + winkelDiff(b[4], a[4]) * f };
      });
      // Proviant leuchtet, auch im Dunkeln
      const puls = 0.5 + 0.5 * Math.sin(jetzt / 200);
      for (const [x, y] of B.v) {
        const cx = m + x * sk, cy = m + y * sk, r = PR_P * sk;
        const v = g.createRadialGradient(cx, cy, 1, cx, cy, r * (2.4 + puls));
        v.addColorStop(0, "rgba(255,210,63,0.85)"); v.addColorStop(1, "rgba(255,210,63,0)");
        g.fillStyle = v; g.beginPath(); g.arc(cx, cy, r * (2.4 + puls), 0, TAU); g.fill();
        g.fillStyle = "#FFD23F"; g.strokeStyle = "#5A3E00"; g.lineWidth = 2 * dpr; g.fillRect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4); g.strokeRect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4);
      }
      if (alien || d.ende) {
        // Das Alien sieht alles; die Lichtkegel sind für es gefährlich
        d.tn.forEach((p, i) => { if (i !== ai && pos[i]) kegelMitSchatten(g, pos[i].x, pos[i].y, pos[i].w, sk, m, 0.3, S); });
      } else {
        // Dunkelheit mit ausgeschnittenen Lichtkegeln
        if (!dunkel) dunkel = document.createElement("canvas");
        if (dunkel.width !== S) { dunkel.width = S; dunkel.height = S; }
        const h = dunkel.getContext("2d");
        h.globalCompositeOperation = "source-over"; h.clearRect(0, 0, S, S);
        h.fillStyle = "rgba(3,5,16,0.93)"; h.fillRect(0, 0, S, S);
        h.globalCompositeOperation = "destination-out";
        d.tn.forEach((p, i) => { if (i !== ai && pos[i]) kegelMitSchatten(h, pos[i].x, pos[i].y, pos[i].w, sk, m, 1, S); });
        h.globalCompositeOperation = "source-over";
        g.drawImage(dunkel, 0, 0);
        // Proviant schimmert durch die Dunkelheit
        for (const [x, y] of B.v) { g.fillStyle = `rgba(255,210,63,${0.5 + 0.3 * puls})`; g.beginPath(); g.arc(m + x * sk, m + y * sk, PR_P * sk * 0.6, 0, TAU); g.fill(); }
      }
      // Spuren: Fressblitze und Geräusche
      for (const [x, y, bt] of B.b) {
        const k = (t - bt) / 1400; if (k < 0 || k > 1) continue;
        g.strokeStyle = `rgba(255,210,63,${1 - k})`; g.lineWidth = 4 * dpr * (1 - k) + 1;
        g.beginPath(); g.arc(m + x * sk, m + y * sk, (0.05 + 0.2 * k) * sk, 0, TAU); g.stroke();
      }
      for (const [x, y, gt] of B.g) {
        const k = (t - gt) / 1400; if (k < 0 || k > 1) continue;
        g.strokeStyle = `rgba(255,122,47,${0.9 * (1 - k)})`; g.lineWidth = 2.5 * dpr;
        for (const r0 of [0.03, 0.08]) { g.beginPath(); g.arc(m + x * sk, m + y * sk, (r0 + 0.14 * k) * sk, 0, TAU); g.stroke(); }
      }
      // Figuren: Crew mit Helm, das Alien nur für sich selbst, im Licht oder am Ende
      const r = PR * sk;
      d.tn.forEach((p, i) => {
        const q = pos[i]; if (!q) return;
        const cx = m + q.x * sk, cy = m + q.y * sk;
        if (i === ai) {
          if (alien && !d.ende) { g.strokeStyle = "#7BD957"; g.lineWidth = 2 * dpr; g.setLineDash([4 * dpr, 3 * dpr]); g.beginPath(); g.arc(cx, cy, r * 1.7, 0, TAU); g.stroke(); g.setLineDash([]); }
          if (B.l && !alien) { g.fillStyle = `rgba(255,77,77,${0.3 + 0.2 * puls})`; g.beginPath(); g.arc(cx, cy, r * 2, 0, TAU); g.fill(); }
          zeichneAlien(g, cx, cy, r, dpr, alien && !B.l && !d.ende ? 0.75 : 1);
          return;
        }
        if (i === ich) { g.strokeStyle = "#EAF2FF"; g.lineWidth = 2 * dpr; g.setLineDash([4 * dpr, 4 * dpr]); g.beginPath(); g.arc(cx, cy, r * 1.5, 0, TAU); g.stroke(); g.setLineDash([]); }
        g.fillStyle = c.farbe(p); g.strokeStyle = "#060A1C"; g.lineWidth = 2.5 * dpr;
        g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); g.stroke();
        // Helmlampe vorn
        g.fillStyle = "#FFF3C4"; g.beginPath(); g.arc(cx + Math.cos(q.w) * r * 0.8, cy + Math.sin(q.w) * r * 0.8, r * 0.28, 0, TAU); g.fill();
        g.fillStyle = "#060A1C"; g.font = `900 ${Math.round(r * 1.05)}px "Exo 2", Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(c.anfang(p), cx, cy + r * 0.05);
      });
      // Anzeige: Restzeit, Proviant, Schild des Aliens
      g.fillStyle = "#EAF2FF"; g.font = `800 ${14 * dpr}px "Exo 2", Inter, sans-serif`; g.textBaseline = "top";
      g.textAlign = "left"; g.fillText(`${Math.max(0, Math.ceil((DAUER - t) / 1000))} s`, 10 * dpr, 6 * dpr);
      g.textAlign = "right"; g.fillText(`Proviant ${B.n}/${ZIEL}`, S - 10 * dpr, 6 * dpr);
      const bx = S * 0.25, bw = S * 0.5, by = S - 14 * dpr, bh = 7 * dpr;
      g.fillStyle = "#26305E"; g.fillRect(bx, by, bw, bh);
      g.fillStyle = B.l ? "#FF4D4D" : "#7BD957"; g.fillRect(bx, by, bw * B.s, bh);
      g.fillStyle = "#EAF2FF"; g.font = `700 ${10 * dpr}px Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "bottom";
      g.fillText(alien ? (B.l ? "Du bist im Licht!" : "Dein Schild") : "Schild des Aliens", m, by - 2 * dpr);
    }
  };
})();
