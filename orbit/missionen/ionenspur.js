// Mission „Ionenspur“ (Arena, Tippen links/rechts): Jeder fliegt ununterbrochen und zieht eine leuchtende Spur hinter
// sich her. Lenken geht nur nach links oder rechts. Wer gegen eine Spur oder die Wand fliegt, scheidet aus. Ab und zu
// setzt das Triebwerk kurz aus, und die Spur hat eine Lücke, durch die man schlüpfen kann.
// Live-Mission: Der Spielleiter rechnet 30-mal pro Sekunde (schritt), die Handys zeichnen (bild). Die Spur wird
// stückweise übertragen: Jedes Bild enthält nur ihr Ende, die Handys setzen sie zusammen.
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const V0 = 0.24, VPLUS = 0.005, DREH = 3;             // Tempo (Einheiten/s, Feld −1 … 1), Zunahme pro Sekunde, Drehung (rad/s)
  const G = 128, ZG = 2 / G, BREIT = 0.013, EIGEN = 300;  // Belegungsraster für Zusammenstöße; eigene Spur zählt nach 300 ms
  const PUNKT = 0.025, ENDE = 30;                         // Abstand der Spurpunkte, so viele Punkte gehen pro Bild mit
  const LUECKE = 280, LUECKEAB = 2200, LUECKEZU = 2600;   // Lücke: Dauer, frühestens/zusätzlich zufällig danach
  const NACHLAUF = 1000, DAUER = 120000;
  const TAU = Math.PI * 2;
  const laenge = (x, y) => Math.hypot(x, y);
  const r3 = v => Math.round(v * 1000) / 1000;
  // Tempo: in den ersten 2,5 s langsam anlaufen, damit man sich zurechtfindet, danach langsam schneller
  const tempo = t => V0 * Math.min(1, 0.4 + t / 2500 * 0.6) + VPLUS * t / 1000;

  // Raster: welche Zellen liegen im Radius BREIT um (x, y)?
  function zellen(x, y, fn) {
    const i0 = Math.max(0, Math.floor((x - BREIT + 1) / ZG)), i1 = Math.min(G - 1, Math.floor((x + BREIT + 1) / ZG));
    const j0 = Math.max(0, Math.floor((y - BREIT + 1) / ZG)), j1 = Math.min(G - 1, Math.floor((y + BREIT + 1) / ZG));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = -1 + (i + 0.5) * ZG, cy = -1 + (j + 0.5) * ZG;
      if (laenge(cx - x, cy - y) <= BREIT + ZG * 0.5) fn(j * G + i);
    }
  }
  const zelleVon = (x, y) => Math.floor((y + 1) / ZG) * G + Math.floor((x + 1) / ZG);
  const draussen = (x, y) => x <= -1 || x >= 1 || y <= -1 || y >= 1;
  // Ist die Stelle für Spieler i tödlich? (fremde Spur, eigene ältere Spur oder Wand)
  function belegt(d, x, y, i) {
    if (draussen(x, y)) return true;
    const k = zelleVon(x, y), b = d.belegt[k];
    return b > 0 && (b !== i + 1 || d.zeit[k] < d.t - EIGEN);
  }

  M.ionenspur = {
    id: "ionenspur", name: "Ionenspur", art: "Arena", ab: 2, eingabe: "Tippen links/rechts", besser: "hoch", einheit: "Sekunden",
    live: true, lenkung: "knopf",
    kurz: "Zieh deine Leuchtspur und flieg nirgends dagegen.",
    anleitung: [
      "Dein Schiff fliegt von allein und zieht eine <b>leuchtende Spur</b> hinter sich her.",
      "Halte <b>links</b> oder <b>rechts</b> gedrückt, um zu lenken. Am Rechner gehen auch die Pfeiltasten.",
      "Wer gegen eine Spur oder die Wand fliegt, scheidet aus. Auch die eigene Spur ist gefährlich.",
      "Ab und zu hat die Spur eine <b>Lücke</b>, durch die man schlüpfen kann. Es wird mit der Zeit schneller.",
      "Es zählt, wie lange du durchhältst."
    ],
    neu(tn, rng) {
      const sp = {};
      tn.forEach((p, i) => {
        // Alle starten nahe der Mitte und fliegen nach außen auseinander
        const w = i / tn.length * TAU + rng() * 0.3, r = 0.2;
        const x = Math.cos(w) * r, y = Math.sin(w) * r;
        sp[p] = { x, y, w: w + (rng() - 0.5) * 0.5, drin: true, fiel: null, spur: [[r3(x), r3(y)]], weg: 0, luecke: LUECKEAB + rng() * LUECKEZU, offen: false };
      });
      return { tn, t: 0, sp, belegt: new Array(G * G).fill(0), zeit: new Array(G * G).fill(0), endeBei: null, fertig: false };
    },
    start() {},
    aktion() { return "?"; },
    takt() { return false; },
    schritt(d, dt, ein, jetzt, ctx) {
      if (d.fertig || dt <= 0) return false;
      d.t += dt * 1000;
      let anders = false;
      const v = tempo(d.t), raus = [];
      // Erst alle bewegen, dann prüfen, damit niemand bevorzugt ist, der in der Liste vorn steht
      const wege = d.tn.map((p, i) => {
        const s = d.sp[p];
        if (!s.drin) return null;
        const e = ein[p] || { x: 0 };
        const lenk = Math.max(-1, Math.min(1, +e.x || 0));
        s.w += lenk * DREH * dt;
        const ax = s.x, ay = s.y;
        s.x += Math.cos(s.w) * v * dt; s.y += Math.sin(s.w) * v * dt;
        // Lücke in der Spur
        const warOffen = s.offen;
        if (d.t >= s.luecke) { s.offen = true; if (d.t >= s.luecke + LUECKE) { s.offen = false; s.luecke = d.t + LUECKEAB + ctx.rng() * LUECKEZU; } }
        if (s.offen && !warOffen) { s.spur.push([r3(ax), r3(ay)], null); s.weg = 0; }
        if (!s.offen && warOffen) { s.spur.push([r3(s.x), r3(s.y)]); s.weg = 0; }
        return { i, p, s, ax, ay };
      }).filter(Boolean);
      // Zusammenstöße: Weg in kleinen Schritten abtasten
      for (const { i, s, ax, ay } of wege) {
        const l = laenge(s.x - ax, s.y - ay), n = Math.max(1, Math.ceil(l / (ZG * 0.5)));
        for (let k = 1; k <= n; k++) {
          const x = ax + (s.x - ax) * k / n, y = ay + (s.y - ay) * k / n;
          if (belegt(d, x, y, i)) { raus.push(i); break; }
        }
      }
      // Frontal: zwei Köpfe treffen sich
      for (let a = 0; a < wege.length; a++) for (let b = a + 1; b < wege.length; b++) {
        if (laenge(wege[a].s.x - wege[b].s.x, wege[a].s.y - wege[b].s.y) < BREIT * 2) raus.push(wege[a].i, wege[b].i);
      }
      // Spur eintragen (auch für die, die gerade ausscheiden, damit ihre letzte Strecke stehen bleibt).
      // Nur freie Stellen: sonst würde der Rand der frischen eigenen Spur ältere Spuren überdecken.
      for (const { i, s, ax, ay } of wege) {
        if (!s.offen) {
          const l = laenge(s.x - ax, s.y - ay), n = Math.max(1, Math.ceil(l / (ZG * 0.5)));
          for (let k = 1; k <= n; k++) zellen(ax + (s.x - ax) * k / n, ay + (s.y - ay) * k / n, z => { if (!d.belegt[z]) { d.belegt[z] = i + 1; d.zeit[z] = d.t; } });
          s.weg += l;
          if (s.weg >= PUNKT) { s.spur.push([r3(s.x), r3(s.y)]); s.weg = 0; }
        }
      }
      for (const i of new Set(raus)) {
        const s = d.sp[d.tn[i]];
        s.drin = false; s.fiel = d.t; s.x = Math.max(-1, Math.min(1, s.x)); s.y = Math.max(-1, Math.min(1, s.y));
        if (!s.offen) s.spur.push([r3(s.x), r3(s.y)]);
        anders = true;
      }
      const uebrig = d.tn.filter(p => d.sp[p].drin).length;
      if (d.endeBei === null && (uebrig === 0 || (d.tn.length > 1 && uebrig <= 1))) { d.endeBei = d.t + (uebrig ? NACHLAUF : 0); anders = true; }
      if ((d.endeBei !== null && d.t >= d.endeBei) || d.t >= DAUER) { d.fertig = true; anders = true; }
      return anders;
    },
    wertung(d) {
      return Object.fromEntries(d.tn.map(p => { const s = d.sp[p]; return [p, Math.round((s.fiel === null ? d.t : s.fiel) / 100) / 10]; }));
    },
    // Bild: Kopf jedes Schiffs und nur das Ende der Spur (ab Punkt-Nummer a)
    bild(d) {
      return {
        t: Math.round(d.t),
        p: d.tn.map(p => { const s = d.sp[p]; return [r3(s.x), r3(s.y), r3(s.w), s.drin ? 1 : 0, s.fiel === null ? -1 : Math.round(s.fiel), s.offen ? 1 : 0]; }),
        s: d.tn.map(p => { const sp = d.sp[p].spur, a = Math.max(0, sp.length - ENDE); return [a, sp.slice(a)]; }),
        e: d.endeBei !== null ? 1 : 0
      };
    },
    // Das Raster bleibt beim Spielleiter
    sicht(d) { const v = Object.assign({}, d); delete v.belegt; delete v.zeit; delete v.botLenk; return v; },
    // Bots: tasten drei Richtungen ab und fliegen dorthin, wo am meisten Platz ist
    botEingabe(d, pid, rng) {
      const s = d.sp[pid], i = d.tn.indexOf(pid);
      if (!s.drin) return { x: 0, y: 0, k: 0 };
      d.botLenk = d.botLenk || {};
      const v = tempo(d.t), schritt = 0.03, dreh = DREH / v * schritt;
      const frei = dw => {
        // gekrümmter Blick: so, als würde man die Lenkung (ganz oder halb) halten
        let x = s.x, y = s.y, w = s.w;
        for (let n = 1; n <= 24; n++) {
          w += dw * dreh; x += Math.cos(w) * schritt; y += Math.sin(w) * schritt;
          if (belegt(d, x, y, i) || (n > 2 && d.belegt[zelleVon(x, y)] === i + 1)) return n;
        }
        return 25;
      };
      const proben = [0, -0.5, 0.5, -1, 1].map(dw => ({ dw, n: frei(dw) }));
      let lenk = d.botLenk[pid] || 0;
      if (proben[0].n >= 16 && rng() < 0.92) lenk = rng() < 0.1 ? (rng() < 0.5 ? -0.6 : 0.6) : 0;
      else { const best = proben.slice().sort((a, b) => b.n - a.n || Math.abs(a.dw) - Math.abs(b.dw))[0]; lenk = best.dw; }
      if (Math.max(...proben.map(p => p.n)) <= 4 && rng() < 0.4) lenk = -lenk;   // ab und zu verschätzt sich ein Bot
      d.botLenk[pid] = lenk;
      return { x: lenk, y: 0, k: 0 };
    }
  };

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  const L = W.ORBIT_LIVE, SN = W.ORBIT_SENSOR;

  // Spuren zusammensetzen: aus dem vollen Stand (bei Ereignissen) und aus den Enden in den Bildern
  let spurNr = null, spuren = [], letzterStand = null;
  function einlesen(nr, s) {
    if (nr !== spurNr) { spurNr = nr; spuren = []; }
    s.forEach(([a, pkt], i) => { const z = spuren[i] || (spuren[i] = []); for (let k = 0; k < pkt.length; k++) z[a + k] = pkt[k]; });
  }

  U.ionenspur = {
    html(d, c) {
      const mein = c.dabei ? d.sp[c.PID] : null;
      return `<div class="arena-rahmen eckig"><canvas id="arena" class="arena" aria-label="Spielfeld mit allen Spuren"></canvas></div>
        ${c.dabei ? `<div class="lenkknoepfe">
            <button class="lenkknopf" data-lenk="-1" aria-label="Links"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M25 8 L11 20 L25 32" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <button class="lenkknopf" data-lenk="1" aria-label="Rechts"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M15 8 L29 20 L15 32" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </div>
          <p class="leise klein mitte">${mein && !mein.drin ? "Du bist raus. Schau zu, wer am längsten durchhält." : "Gedrückt halten zum Lenken."}</p>`
        : `<p class="leise mitte">Du schaust zu.</p>`}`;
    },
    binden(c) {
      document.querySelectorAll(".lenkknopf").forEach(k => SN.lenkknopf(k, +k.dataset.lenk));
    },
    bewegen(d, c) {
      const cv = document.getElementById("arena");
      if (!cv) return;
      const dpr = Math.min(2, W.devicePixelRatio || 1), px = Math.round(cv.clientWidth * dpr);
      if (cv.width !== px) { cv.width = px; cv.height = px; }
      const g = cv.getContext("2d"), S = px, m = S / 2, sk = S / 2 / 1.03;
      g.fillStyle = "#070B1E"; g.fillRect(0, 0, S, S);
      // Gitter
      g.strokeStyle = "#16204A"; g.lineWidth = 1;
      for (let k = -1; k <= 1.001; k += 0.25) {
        g.beginPath(); g.moveTo(m + k * sk, m - sk); g.lineTo(m + k * sk, m + sk); g.stroke();
        g.beginPath(); g.moveTo(m - sk, m + k * sk); g.lineTo(m + sk, m + k * sk); g.stroke();
      }
      g.strokeStyle = "#5B6BB0"; g.lineWidth = 3 * dpr; g.strokeRect(m - sk, m - sk, sk * 2, sk * 2);
      const z = L.zwischen(c.nr, c.jetzt());
      if (!z) { g.fillStyle = "#9AA7D1"; g.font = `${14 * dpr}px Inter, sans-serif`; g.textAlign = "center"; g.fillText("Verbinde …", m, m); return; }
      if (spurNr !== c.nr || d !== letzterStand) { einlesen(c.nr, d.tn.map(p => [0, (d.sp[p] && d.sp[p].spur) || []])); letzterStand = d; }
      einlesen(c.nr, z.b.s); if (z.letztes) einlesen(c.nr, z.letztes.b.s);
      const A = z.a, B = z.b, f = z.f, t = L.mix(A.t, B.t, f), ich = d.tn.indexOf(c.PID), letzt = z.letztes;
      const X = x => m + x * sk;
      // Köpfe: andere glatt zwischen zwei Bildern, der eigene nach vorn gerechnet
      const koepfe = d.tn.map((p, i) => {
        const a = A.p[i], b = B.p[i];
        if (!a || !b) return null;
        let x = L.mix(a[0], b[0], f), y = L.mix(a[1], b[1], f), w = b[2];
        if (i === ich && letzt && letzt.b.p[i] && letzt.b.p[i][3]) {
          const q = letzt.b.p[i], dt = Math.min(0.25, Math.max(0, (c.jetzt() - letzt.h + (c.laufzeit || 0) / 2) / 1000)), v = tempo(letzt.b.t);
          x = Math.max(-1, Math.min(1, q[0] + Math.cos(q[2]) * v * dt)); y = Math.max(-1, Math.min(1, q[1] + Math.sin(q[2]) * v * dt)); w = q[2];
        }
        return { p, i, x, y, w, drin: b[3], fiel: b[4], offen: b[5] };
      });
      // Spuren mit Leuchten
      g.lineCap = "round"; g.lineJoin = "round";
      for (const kopf of koepfe) {
        if (!kopf) continue;
        const pkt = spuren[kopf.i] || [], farbe = c.farbe(kopf.p);
        const zeichne = (breite, alpha) => {
          g.globalAlpha = alpha; g.strokeStyle = farbe; g.lineWidth = breite;
          g.beginPath(); let zu = true;
          for (const q of pkt) { if (!q) { zu = true; continue; } if (zu) { g.moveTo(X(q[0]), X(q[1])); zu = false; } else g.lineTo(X(q[0]), X(q[1])); }
          if (!zu && !kopf.offen && kopf.drin) g.lineTo(X(kopf.x), X(kopf.y));
          g.stroke();
        };
        zeichne(BREIT * 2 * sk * 2.4, kopf.drin ? 0.18 : 0.1);
        zeichne(BREIT * 2 * sk, kopf.drin ? 1 : 0.45);
        g.globalAlpha = 1;
      }
      // Schiffe
      for (const kopf of koepfe) {
        if (!kopf) continue;
        const x = X(kopf.x), y = X(kopf.y), r = BREIT * sk * 2.2;
        if (!kopf.drin) {
          const seit = t - kopf.fiel;
          if (seit < 800) { g.strokeStyle = c.farbe(kopf.p); g.globalAlpha = 1 - seit / 800; g.lineWidth = 3 * dpr; g.beginPath(); g.arc(x, y, r * (1 + seit / 120), 0, TAU); g.stroke(); g.globalAlpha = 1; }
          continue;
        }
        g.save(); g.translate(x, y); g.rotate(kopf.w);
        g.fillStyle = c.farbe(kopf.p); g.strokeStyle = "#EAF2FF"; g.lineWidth = 1.5 * dpr;
        g.beginPath(); g.moveTo(r * 1.4, 0); g.lineTo(-r * 0.9, r * 0.9); g.lineTo(-r * 0.5, 0); g.lineTo(-r * 0.9, -r * 0.9); g.closePath(); g.fill(); g.stroke();
        g.restore();
        if (kopf.i === ich) { g.strokeStyle = "#EAF2FF"; g.lineWidth = 1.5 * dpr; g.setLineDash([3 * dpr, 3 * dpr]); g.beginPath(); g.arc(x, y, r * 2.2, 0, TAU); g.stroke(); g.setLineDash([]); }
      }
      const uebrig = koepfe.filter(k => k && k.drin).length;
      g.fillStyle = "#EAF2FF"; g.font = `800 ${14 * dpr}px "Exo 2", Inter, sans-serif`; g.textBaseline = "top";
      g.textAlign = "left"; g.fillText(`${Math.floor(t / 1000)} s`, 12 * dpr, 10 * dpr);
      g.textAlign = "right"; g.fillText(`${uebrig} im Flug`, S - 12 * dpr, 10 * dpr);
    }
  };
})();
