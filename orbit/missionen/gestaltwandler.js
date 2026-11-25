// Mission „Gestaltwandler“ (Einer gegen alle, Daumen): Ein Alien versteckt sich als Wartungsroboter unter 30 echten
// Robotern und muss 3 Konsolen sabotieren (2,5 Sekunden daneben stehen bleiben). Die Crew beobachtet das Gewusel und
// hat zusammen 2 Verdächtigungen. Trifft eine, gewinnt die Crew, sonst gewinnt das Alien nach der dritten Sabotage.
// Nach 90 Sekunden ohne 3 Sabotagen gewinnt auch die Crew.
// Die Wege der Roboter entstehen auf jedem Handy gleich aus einem gemeinsamen Startwert (d.rs); verschickt wird nur
// die Position des Aliens. Den Fortschritt der Sabotage sieht nur das Alien.
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const ROBOTER = 30, ALIEN = ROBOTER;            // Nummer 30 ist das Alien
  const V = 0.24, VMAX = 0.33, ACC = 3.5;         // Tempo der Roboter (Mittel), Höchsttempo des Aliens
  const FR = 0.045, RAND = 0.9;                   // Radius einer Figur, Spielfeld von −0,9 bis 0,9
  const KONSOLEN = [[-0.74, -0.84], [0.74, -0.84], [-0.9, 0], [0, 0], [0.9, 0], [-0.74, 0.84], [0.74, 0.84]];
  const KR = 0.11, SABOTAGE = 2500, ZIEL = 3, VERDACHT = 2, DAUER = 90000, ENTHUELLUNG = 3500;
  const TAU = Math.PI * 2;
  const laenge = (x, y) => Math.hypot(x, y);
  const klemm = (v, a) => Math.max(-a, Math.min(a, v));

  // Zufall mit Startwert (wie RM.zufall, hier eigens, damit die Datei allein läuft)
  function zufall(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // Wege der Roboter: Abschnitte { t0, t1, t2, a, c, b }: von a über die Kurve c nach b (t0 bis t1), dann Pause bis t2.
  // Gut die Hälfte der Wege führt zu einer Konsole, dort bleiben die Roboter 1,5 bis 4,5 Sekunden (wie das Alien).
  function plaene(rs) {
    const rng = zufall(rs), alle = [];
    for (let r = 0; r < ROBOTER; r++) {
      const tempo = V * (0.8 + 0.4 * rng());
      let p = { x: (rng() * 2 - 1) * 0.85, y: (rng() * 2 - 1) * 0.85 }, t = rng() * 1500;
      const wege = [];
      while (t < DAUER + ENTHUELLUNG + 2000) {
        let b, pause;
        if (rng() < 0.5) {
          const k = KONSOLEN[Math.floor(rng() * KONSOLEN.length)], w = rng() * TAU, a = rng() * 0.07;
          b = { x: klemm(k[0] + Math.cos(w) * a, RAND - FR), y: klemm(k[1] + Math.sin(w) * a, RAND - FR) };
          pause = 1500 + rng() * 3000;
        } else {
          b = { x: (rng() * 2 - 1) * 0.86, y: (rng() * 2 - 1) * 0.86 };
          pause = rng() < 0.45 ? 100 + rng() * 300 : 400 + rng() * 1800;
        }
        const dx = b.x - p.x, dy = b.y - p.y, l = laenge(dx, dy);
        if (l < 0.15) continue;
        const bieg = (rng() - 0.5) * 0.7;
        const c = { x: klemm((p.x + b.x) / 2 - dy * bieg, RAND - FR), y: klemm((p.y + b.y) / 2 + dx * bieg, RAND - FR) };
        const dauer = l * (1 + Math.abs(bieg) * 0.5) / tempo * 1000;
        wege.push({ t0: t, t1: t + dauer, t2: t + dauer + pause, a: p, c, b });
        t += dauer + pause; p = b;
      }
      alle.push(wege);
    }
    return alle;
  }
  let zwischenspeicher = null;
  const planVon = rs => (zwischenspeicher && zwischenspeicher.rs === rs ? zwischenspeicher.plan : (zwischenspeicher = { rs, plan: plaene(rs) }).plan);
  // Wo ist Roboter r zur Zeit t? (sanft anfahren und abbremsen, wie mit dem Daumen gesteuert)
  function roboter(plan, r, t) {
    const wege = plan[r];
    let lo = 0, hi = wege.length - 1;
    if (t < wege[0].t0) return { x: wege[0].a.x, y: wege[0].a.y };
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (wege[m].t0 <= t) lo = m; else hi = m - 1; }
    const w = wege[lo];
    if (t >= w.t1) return { x: w.b.x, y: w.b.y };
    const u = (t - w.t0) / (w.t1 - w.t0), s = 0.5 - 0.5 * Math.cos(Math.PI * u), q = 1 - s;
    return { x: q * q * w.a.x + 2 * q * s * w.c.x + s * s * w.b.x, y: q * q * w.a.y + 2 * q * s * w.c.y + s * s * w.b.y };
  }
  const offen = d => KONSOLEN.map((_, k) => k).filter(k => !d.sabotiert.some(s => s.k === k));

  M.gestaltwandler = {
    id: "gestaltwandler", name: "Gestaltwandler", art: "Einer gegen alle", ab: 3, eingabe: "Daumen", besser: "hoch", einheit: "Konsolen",
    live: true, lenkung: "daumen",
    kurz: "Ein Alien versteckt sich unter den Wartungsrobotern. Findet es!",
    anleitung: [
      "Einer ist das <b>Alien</b> und sieht aus wie einer von 30 Wartungsrobotern. Es lenkt mit dem Daumen.",
      "Das Alien muss <b>3 Konsolen sabotieren</b>: 2,5 Sekunden an einer Konsole stehen bleiben. Die Roboter machen dort auch Pausen.",
      "Die <b>Crew</b> beobachtet das Gewusel. Tippt auf einen Roboter und dann auf „Verdächtigen“. Ihr habt <b>zusammen nur 2 Versuche</b>, sprecht euch ab!",
      "Wird das Alien entlarvt oder sind <b>90 Sekunden</b> um, gewinnt die Crew. Schafft es 3 Sabotagen, gewinnt das Alien."
    ],
    neu(tn, rng, einzelner) {
      const e = einzelner || tn[0];
      const d = { tn, einzelner: e, rs: Math.floor(rng() * 2 ** 31), t: 0, a: { x: 0, y: 0, vx: 0, vy: 0 }, am: -1, fort: 0,
        sabotiert: [], verdacht: [], harmlos: [], ende: null, dabei: {}, fertig: false };
      // Das Alien beginnt wie ein Roboter irgendwo, aber nicht direkt an einer Konsole
      for (let v = 0; v < 30; v++) {
        const x = (rng() * 2 - 1) * 0.7, y = (rng() * 2 - 1) * 0.7;
        if (KONSOLEN.every(k => laenge(k[0] - x, k[1] - y) > 0.3)) { d.a.x = x; d.a.y = y; break; }
      }
      return d;
    },
    start(d, jetzt, ctx) {
      for (const p of ctx.aktiv) d.dabei[p] = true;
      // Bots verdächtigen nur, wenn kein Mensch in der Crew ist (sonst würden sie euch die Versuche wegnehmen)
      d.botsRaten = d.tn.filter(p => p !== d.einzelner).every(p => (ctx.bots || []).includes(p));
    },
    aktion(d, pid, m) {
      if (m.a !== "verdacht") return "?";
      if (pid === d.einzelner) return "Du bist das Alien.";
      if (d.ende) return "Die Mission ist vorbei.";
      if (d.verdacht.length >= VERDACHT) return "Ihr habt keine Verdächtigung mehr.";
      const z = m.z | 0;
      if (z < 0 || z > ALIEN) return "?";
      if (d.harmlos.includes(z)) return "Dieser Roboter ist schon überprüft.";
      const treffer = z === ALIEN;
      d.verdacht.push({ pid, z, t: Math.round(d.t), treffer });
      if (treffer) d.ende = { art: "erwischt", t: d.t, pid };
      else d.harmlos.push(z);
      return true;
    },
    takt() { return false; },
    schritt(d, dt, ein, jetzt, ctx) {
      if (d.fertig || dt <= 0) return false;
      d.t += dt * 1000;
      let anders = false;
      if (d.ende) {
        if (d.t >= d.ende.t + ENTHUELLUNG) { d.fertig = true; anders = true; }
        return anders;
      }
      // Das Alien: sanft beschleunigen, höchstens so schnell wie ein flotter Roboter
      const a = d.a, e = ein[d.einzelner] || { x: 0, y: 0 };
      let ex = e.x || 0, ey = e.y || 0; const el = laenge(ex, ey); if (el > 1) { ex /= el; ey /= el; }
      const f = Math.min(1, ACC * dt);
      a.vx += (ex * VMAX - a.vx) * f; a.vy += (ey * VMAX - a.vy) * f;
      a.x += a.vx * dt; a.y += a.vy * dt;
      const g = RAND - FR;
      if (Math.abs(a.x) > g) { a.x = klemm(a.x, g); a.vx = 0; }
      if (Math.abs(a.y) > g) { a.y = klemm(a.y, g); a.vy = 0; }
      // Sabotage: 2,5 Sekunden an einer noch heilen Konsole
      const k = offen(d).find(i => laenge(KONSOLEN[i][0] - a.x, KONSOLEN[i][1] - a.y) < KR);
      if (k === undefined) { if (d.am >= 0) anders = true; d.am = -1; d.fort = 0; }
      else {
        if (k !== d.am) { d.am = k; d.fort = 0; anders = true; }
        d.fort += dt * 1000;
        if (d.fort >= SABOTAGE) {
          d.sabotiert.push({ k, t: Math.round(d.t) }); d.am = -1; d.fort = 0; anders = true;
          if (d.sabotiert.length >= ZIEL) d.ende = { art: "sabotage", t: d.t };
        }
      }
      if (!d.ende && d.t >= DAUER) { d.ende = { art: "zeit", t: d.t }; anders = true; }
      return anders;
    },
    ausgang(d) { return d.ende && d.ende.art === "sabotage" ? "einzeln" : "crew"; },
    wertung(d) { return Object.fromEntries(d.tn.map(p => [p, d.dabei[p] ? (p === d.einzelner ? d.sabotiert.length : d.verdacht.filter(v => v.pid === p && v.treffer).length) : null])); },
    wertText(d, p) {
      if (p === d.einzelner) return `Alien · ${d.sabotiert.length} von ${ZIEL} Konsolen sabotiert`;
      if (d.verdacht.some(v => v.pid === p && v.treffer)) return "Crew · hat das Alien entlarvt";
      if (d.verdacht.some(v => v.pid === p)) return "Crew · falscher Verdacht";
      return "Crew";
    },
    bild(d) {
      const r3 = v => Math.round(v * 1000) / 1000, a = d.a;
      return { t: Math.round(d.t), a: [r3(a.x), r3(a.y), r3(a.vx), r3(a.vy)], k: d.am, f: Math.round(Math.min(1, d.fort / SABOTAGE) * 100) / 100 };
    },
    // Wo das Alien gerade sabotiert, sieht nur das Alien
    bildFuer(b, d, pid) {
      if (pid === d.einzelner || d.ende) return b;
      return { t: b.t, a: b.a, k: -1, f: 0 };
    },
    sicht(d, pid) {
      const v = Object.assign({}, d);
      delete v.botZiel; delete v.botRaten;
      if (pid !== d.einzelner && !d.ende) { v.am = -1; v.fort = 0; }
      return v;
    },
    // Bot als Alien: bewegt sich wie ein Roboter (Kurven, Pausen) und hält an heilen Konsolen lange genug an
    botEingabe(d, pid, rng) {
      if (pid !== d.einzelner || d.ende) return { x: 0, y: 0, k: 0 };
      d.botZiel = d.botZiel || null;
      const a = d.a;
      let z = d.botZiel;
      if (z && z.konsole !== undefined && d.sabotiert.some(s => s.k === z.konsole)) z = null;
      if (!z || (z.ab && d.t > z.bis)) {
        if (rng() < 0.55 && offen(d).length) {
          const o = offen(d), k = o[Math.floor(rng() * o.length)];
          z = { x: KONSOLEN[k][0] * 0.95, y: KONSOLEN[k][1] * 0.95, konsole: k, pause: SABOTAGE + 400 + rng() * 1200 };
        } else z = { x: (rng() * 2 - 1) * 0.8, y: (rng() * 2 - 1) * 0.8, pause: 200 + rng() * 1500 };
        z.ab = 0; z.bis = 0;
      }
      d.botZiel = z;
      const dx = z.x - a.x, dy = z.y - a.y, l = laenge(dx, dy);
      if (l < 0.04) { if (!z.ab) { z.ab = d.t; z.bis = d.t + z.pause; } return { x: 0, y: 0, k: 0 }; }
      const s = Math.min(0.75, l * 2.5);
      return { x: dx / l * s, y: dy / l * s, k: 0 };
    },
    // Bots in der Crew: nach einer Sabotage tippen sie auf einen der Roboter, die gerade an der Konsole waren
    bot(d, pid, rng) {
      if (!d.botsRaten || pid === d.einzelner || d.ende || d.verdacht.length >= VERDACHT || !d.sabotiert.length) return null;
      const s = d.sabotiert[d.sabotiert.length - 1];
      d.botRaten = d.botRaten || {};
      if (d.botRaten.nach === s.t) return null;
      if (!d.botRaten.wann || d.botRaten.fuer !== s.t) d.botRaten = { fuer: s.t, wann: s.t + 1500 + rng() * 2500 };
      if (d.t < d.botRaten.wann) return null;
      d.botRaten = { nach: s.t };
      if (rng() < 0.35) return null;   // diesmal lieber abwarten
      const plan = planVon(d.rs), kx = KONSOLEN[s.k][0], ky = KONSOLEN[s.k][1], kandidaten = [ALIEN];
      for (let r = 0; r < ROBOTER; r++) {
        if (d.harmlos.includes(r)) continue;
        const p = roboter(plan, r, s.t);
        if (laenge(p.x - kx, p.y - ky) < KR + 0.04) kandidaten.push(r);
      }
      return { t: "b", a: "verdacht", z: kandidaten[Math.floor(rng() * kandidaten.length)] };
    }
  };
  M.gestaltwandler.hilfe = { plaene, planVon, roboter, KONSOLEN, KR, SABOTAGE, ROBOTER, ALIEN, DAUER, ENTHUELLUNG };

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  const L = W.ORBIT_LIVE, SN = W.ORBIT_SENSOR;
  let auswahl = null, auswahlNr = null;   // angetippte Figur der Crew (gilt nur in dieser Mission)
  let reihenfolge = null;                 // Zeichenreihenfolge, damit das Alien nicht immer oben liegt
  let zuletzt = null;                     // zuletzt gezeichnete Positionen (zum Antippen)
  let blick = [];                         // Blickrichtung je Figur (stehende schauen weiter in die letzte Richtung)

  function zeichneRoboter(g, x, y, r, w, dpr, blass) {
    g.globalAlpha = blass ? 0.35 : 1;
    // Schatten
    g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(x, y + r * 0.85, r * 0.9, r * 0.35, 0, 0, TAU); g.fill();
    // Körper
    g.fillStyle = "#AEB8D6"; g.strokeStyle = "#060A1C"; g.lineWidth = 2 * dpr;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = "#7C88AE"; g.beginPath(); g.arc(x, y, r * 0.55, 0, TAU); g.fill();
    // Auge in Fahrtrichtung
    const ax = x + Math.cos(w) * r * 0.45, ay = y + Math.sin(w) * r * 0.45;
    g.fillStyle = "#2EC4B6"; g.beginPath(); g.arc(ax, ay, r * 0.3, 0, TAU); g.fill();
    g.fillStyle = "#EAF2FF"; g.beginPath(); g.arc(ax - r * 0.08, ay - r * 0.08, r * 0.1, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }

  U.gestaltwandler = {
    html(d, c) {
      if (auswahlNr !== c.nr) { auswahl = null; auswahlNr = c.nr; reihenfolge = null; blick = []; zuletzt = null; }
      const ich = c.PID, alien = ich === d.einzelner, rest = VERDACHT - d.verdacht.length;
      const kopf = `<div class="missionskopf"><span class="etikett">${alien ? "Du bist das Alien" : `Alien: ${c.esc(c.name(d.einzelner))}`}</span><span class="etikett">Sabotiert ${d.sabotiert.length} von ${ZIEL}</span></div>`;
      const verlauf = d.verdacht.length ? `<p class="leise klein mitte">${d.verdacht.map(v => `${c.esc(c.name(v.pid))}: ${v.treffer ? "<b>Treffer!</b>" : "falscher Verdacht"}`).join(" · ")}</p>` : "";
      let unten;
      if (d.ende) unten = `<p class="mitte gross"><b>${d.ende.art === "erwischt" ? "Das Alien ist entlarvt!" : d.ende.art === "sabotage" ? "Sabotage geglückt, das Alien gewinnt!" : "Zeit um, die Crew gewinnt!"}</b></p>`;
      else if (alien) unten = `<div class="steuerleiste"><div class="daumenfeld" id="daumenfeld" aria-label="Joystick"><div class="knauf"></div></div>
          <p class="leise klein gwtext">Bleib <b>2,5 s an einer Konsole</b>, um sie zu sabotieren. Beweg dich wie ein Roboter: sanft, mit Pausen.</p></div>`;
      else if (!c.dabei) unten = `<p class="leise mitte">Du schaust zu.</p>`;
      else unten = `<div class="verdachtleiste"><button class="knopf verdachtknopf" id="verdacht" ${rest > 0 && auswahl !== null ? "" : "disabled"}>Verdächtigen (${rest})</button></div>
          <p class="leise klein mitte">${rest > 0 ? "Tippe auf einen Roboter, der sich verdächtig bewegt. Ihr habt zusammen nur noch " + rest + (rest === 1 ? " Versuch." : " Versuche.") : "Keine Versuche mehr. Haltet durch, bis die Zeit um ist!"}</p>`;
      return kopf + `<div class="arena-rahmen eckig"><canvas id="arena" class="arena halle" aria-label="Wartungshalle mit Robotern und Konsolen"></canvas></div>${unten}${verlauf}`;
    },
    binden(c) {
      if (SN) SN.daumen(document.getElementById("daumenfeld"));
      const cv = document.getElementById("arena"), knopf = document.getElementById("verdacht");
      const d = c.S.mission.d;
      if (cv && c.dabei && c.PID !== d.einzelner) cv.addEventListener("pointerdown", e => {
        if (!zuletzt || d.ende) return;
        const r = cv.getBoundingClientRect(), sk = r.width / 2 / 1.0;
        const x = (e.clientX - r.left - r.width / 2) / sk, y = (e.clientY - r.top - r.height / 2) / sk;
        let best = null, bl = 0.13;
        zuletzt.forEach((p, i) => { if (!p || d.harmlos.includes(i)) return; const l = laenge(p.x - x, p.y - y); if (l < bl) { bl = l; best = i; } });
        auswahl = best;
        if (knopf) knopf.disabled = !(auswahl !== null && d.verdacht.length < VERDACHT);
      });
      if (knopf) knopf.onclick = () => {
        if (auswahl === null) return;
        c.tun({ t: "b", a: "verdacht", z: auswahl });
        auswahl = null; knopf.disabled = true;
      };
    },
    bewegen(d, c) {
      const cv = document.getElementById("arena");
      if (!cv) return;
      const dpr = Math.min(2, W.devicePixelRatio || 1), px = Math.round(cv.clientWidth * dpr);
      if (cv.width !== px) { cv.width = px; cv.height = px; }
      const g = cv.getContext("2d"), S = px, m = S / 2, sk = S / 2;
      const z = L.zwischen(c.nr, c.jetzt()), ich = c.PID, alien = ich === d.einzelner;
      // Boden der Wartungshalle
      g.fillStyle = "#141B3D"; g.fillRect(0, 0, S, S);
      g.strokeStyle = "rgba(154,167,209,0.12)"; g.lineWidth = 1 * dpr;
      for (let i = 1; i < 10; i++) { const p = i / 10 * S; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.moveTo(0, p); g.lineTo(S, p); g.stroke(); }
      g.strokeStyle = "#060A1C"; g.lineWidth = 6 * dpr; g.strokeRect(m - RAND * sk, m - RAND * sk, 2 * RAND * sk, 2 * RAND * sk);
      if (!z) { g.fillStyle = "#9AA7D1"; g.font = `${14 * dpr}px Inter, sans-serif`; g.textAlign = "center"; g.fillText("Verbinde …", m, m); return; }
      const A = z.a, B = z.b, f = z.f, t = L.mix(A.t, B.t, f), jetzt = c.jetzt();
      // Konsolen: heil (türkis) oder sabotiert (rot flackernd); das Alien sieht den Fortschritt
      KONSOLEN.forEach(([kx, ky], k) => {
        const cx = m + kx * sk, cy = m + ky * sk, w = 0.1 * sk, h = 0.07 * sk;
        const kaputt = d.sabotiert.some(s => s.k === k);
        g.fillStyle = "#2A3366"; g.strokeStyle = "#060A1C"; g.lineWidth = 2 * dpr;
        g.beginPath(); if (g.roundRect) g.roundRect(cx - w, cy - h, 2 * w, 2 * h, 4 * dpr); else g.rect(cx - w, cy - h, 2 * w, 2 * h); g.fill(); g.stroke();
        g.fillStyle = kaputt ? (Math.sin(jetzt / 90 + k) > 0 ? "#FF4D4D" : "#7A1E1E") : "#2EC4B6";
        g.fillRect(cx - w * 0.7, cy - h * 0.6, w * 1.4, h * 1.2);
        if (alien && !kaputt) { g.strokeStyle = "rgba(123,217,87,0.5)"; g.lineWidth = 1.5 * dpr; g.setLineDash([3 * dpr, 4 * dpr]); g.beginPath(); g.arc(cx, cy, KR * sk, 0, TAU); g.stroke(); g.setLineDash([]); }
        if (alien && B.k === k && B.f > 0) {
          g.strokeStyle = "#7BD957"; g.lineWidth = 5 * dpr;
          g.beginPath(); g.arc(cx, cy, KR * sk, -Math.PI / 2, -Math.PI / 2 + TAU * B.f); g.stroke();
        }
      });
      // Alle Figuren zur selben Zeit t: Roboter aus dem Plan, das Alien aus den Bildern
      const plan = planVon(d.rs), pos = [];
      for (let r = 0; r < ROBOTER; r++) {
        const p = roboter(plan, r, t), q = roboter(plan, r, t + 60);
        pos.push({ x: p.x, y: p.y, w: Math.atan2(q.y - p.y, q.x - p.x), steht: laenge(q.x - p.x, q.y - p.y) < 1e-4 });
      }
      let ax = L.mix(A.a[0], B.a[0], f), ay = L.mix(A.a[1], B.a[1], f), vx = B.a[2], vy = B.a[3];
      const letzt = z.letztes;
      if (alien && letzt && !d.ende) {
        const q = letzt.b.a, dt = Math.min(0.25, Math.max(0, (jetzt - letzt.h + (c.laufzeit || 0) / 2) / 1000));
        ax = klemm(q[0] + q[2] * dt, RAND - FR); ay = klemm(q[1] + q[3] * dt, RAND - FR); vx = q[2]; vy = q[3];
      }
      pos.push({ x: ax, y: ay, w: Math.atan2(vy, vx), steht: laenge(vx, vy) < 0.02 });
      // Zeichenreihenfolge gemischt, damit das Alien nicht immer oben liegt
      if (!reihenfolge) { const rng = zufall(d.rs + 7); reihenfolge = pos.map((_, i) => i); for (let i = reihenfolge.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [reihenfolge[i], reihenfolge[j]] = [reihenfolge[j], reihenfolge[i]]; } }
      zuletzt = pos;
      pos.forEach((p, i) => { if (!p.steht || blick[i] === undefined) blick[i] = p.w; });
      const r = FR * sk;
      // Bei der Enthüllung liegt das Alien obenauf
      const folge = d.ende ? reihenfolge.filter(i => i !== ALIEN).concat(ALIEN) : reihenfolge;
      for (const i of folge) {
        const p = pos[i], cx = m + p.x * sk, cy = m + p.y * sk;
        const enthuellt = d.ende && i === ALIEN;
        if (enthuellt) {
          g.fillStyle = `rgba(123,217,87,${0.35 + 0.25 * Math.sin(jetzt / 120)})`; g.beginPath(); g.arc(cx, cy, r * 2.4, 0, TAU); g.fill();
        }
        zeichneRoboter(g, cx, cy, r, blick[i], dpr, d.harmlos.includes(i));
        if (d.harmlos.includes(i)) { g.strokeStyle = "#7BD957"; g.lineWidth = 2.5 * dpr; g.beginPath(); g.moveTo(cx - r * 0.5, cy); g.lineTo(cx - r * 0.1, cy + r * 0.4); g.lineTo(cx + r * 0.55, cy - r * 0.45); g.stroke(); }
        if (enthuellt) { g.fillStyle = "#7BD957"; g.strokeStyle = "#060A1C"; g.lineWidth = 2 * dpr; g.beginPath(); g.ellipse(cx, cy - r * 0.1, r * 0.55, r * 0.7, 0, 0, TAU); g.fill(); g.stroke();
          g.fillStyle = "#060A1C"; g.beginPath(); g.ellipse(cx - r * 0.2, cy - r * 0.2, r * 0.14, r * 0.22, -0.4, 0, TAU); g.ellipse(cx + r * 0.2, cy - r * 0.2, r * 0.14, r * 0.22, 0.4, 0, TAU); g.fill(); }
      }
      // Das Alien sieht sich selbst, die Crew ihre Auswahl
      if (alien && !d.ende) {
        const p = pos[ALIEN], cx = m + p.x * sk, cy = m + p.y * sk;
        g.strokeStyle = "#7BD957"; g.lineWidth = 2.5 * dpr; g.setLineDash([4 * dpr, 3 * dpr]);
        g.beginPath(); g.arc(cx, cy, r * 1.7, 0, TAU); g.stroke(); g.setLineDash([]);
      }
      if (auswahl !== null && pos[auswahl] && !d.ende) {
        const p = pos[auswahl], cx = m + p.x * sk, cy = m + p.y * sk;
        g.strokeStyle = "#FF7A2F"; g.lineWidth = 3 * dpr;
        g.beginPath(); g.arc(cx, cy, r * 1.8, 0, TAU); g.stroke();
        g.beginPath(); for (let k = 0; k < 4; k++) { const w = k * Math.PI / 2; g.moveTo(cx + Math.cos(w) * r * 1.5, cy + Math.sin(w) * r * 1.5); g.lineTo(cx + Math.cos(w) * r * 2.3, cy + Math.sin(w) * r * 2.3); } g.stroke();
      }
      // Restzeit oben links
      g.fillStyle = "#EAF2FF"; g.font = `800 ${14 * dpr}px "Exo 2", Inter, sans-serif`; g.textBaseline = "top"; g.textAlign = "left";
      g.fillText(`${Math.max(0, Math.ceil((DAUER - t) / 1000))} s`, 10 * dpr, 6 * dpr);
    }
  };
})();
