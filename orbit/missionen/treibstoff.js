// Mission „Treibstoffkette“ (Teams, Wischen): Jedes Team reicht Kanister von Handy zu Handy bis zur Rakete. Man wischt
// den Kanister durch die Luke oben zum Nächsten im Team. Wer zu hastig wischt, verursacht ein Leck, wer die Luke verfehlt,
// prallt gegen die Wand. Jeder Kanister braucht 6 Würfe (das Team reicht ihn reihum, auch mehrmals), damit kleine und große
// Teams gleich viel Arbeit haben. Es zählt der getankte Treibstoff pro Person im Team.
// Das Handy rechnet seinen Wurf selbst vor (gleiche Funktion wurf()), der Spielleiter prüft ihn und reicht den Kanister weiter.
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const M = W.ORBIT_MISSIONEN = W.ORBIT_MISSIONEN || {};
  const DAUER = 60000, SCHRITTE = 6, FLUG = 650, NACHSCHUB = 300, VOLL = 100, ABWESEND = 1500;
  const HOEHE = 1.35, CX = 0.5, CY = 1.02, LW = 0.3;         // Feld: Breite 1, Kanister unten, Luke oben (y = 0)
  const VMIN = 0.45, VLECK = 2.3, LECKMAX = 45, WANDLECK = 6;  // Tempo in Bildschirmbreiten pro Sekunde
  const TAU = Math.PI * 2;

  // Ein Wurf: sw = { w: Richtung (Bogenmaß, y nach unten), v: Tempo am Ende des Wischs }
  function wurf(k, sw) {
    const w = +sw.w, v = +sw.v;
    if (!isFinite(w) || !isFinite(v) || v < VMIN) return { art: "schwach", leck: 0 };
    const s = Math.sin(w), c = Math.cos(w);
    const x = s < -0.12 ? CX + c * (CY / -s) : (c >= 0 ? 2 : -1);
    if (Math.abs(x - k.luke) > LW / 2) return { art: "wand", leck: WANDLECK, x: Math.max(0.04, Math.min(0.96, x)) };
    return { art: "weiter", leck: v > VLECK ? Math.min(LECKMAX, Math.round(6 + (v - VLECK) * 16)) : 0, x };
  }
  const lukeNeu = rng => 0.2 + rng() * 0.6;
  const teamVon = (d, p) => (d.teams[0].includes(p) ? 0 : 1);
  // Der Weg eines Kanisters: das Team reihum, bis es 6 Würfe sind
  const pfad = (d, t) => Array.from({ length: SCHRITTE }, (_, i) => d.teams[t][i % d.teams[t].length]);
  // Die Kanister, die gerade bei pid liegen oder ankommen (der erste ist dran)
  const bei = (d, pid) => d.k.filter(k => k.p === pid).sort((a, b) => a.ab - b.ab || a.id - b.id);
  const proKopf = (d, t) => Math.round(d.tank[t] / d.teams[t].length);

  // Nachschub: Der Erste im Team bekommt einen neuen Kanister, sobald er keinen frischen mehr hat (höchstens 2 pro Person unterwegs)
  function nachschub(d, jetzt) {
    if (!d.bis || jetzt >= d.bis) return false;
    let anders = false;
    for (let t = 0; t < 2; t++) {
      const erster = d.teams[t][0], im = d.k.filter(k => k.t === t);
      if (im.length >= 2 * d.teams[t].length || im.some(k => k.s === 0)) continue;
      d.k.push({ id: ++d.nr, t, s: 0, p: erster, f: VOLL, ab: jetzt + NACHSCHUB, luke: lukeNeu(d.rng), von: null });
      anders = true;
    }
    return anders;
  }

  // Der Kanister fliegt zum Nächsten im Team, nach dem letzten Wurf in die Rakete
  function weiter(d, k, pid, jetzt) {
    k.s += 1; k.von = pid;
    if (k.s >= SCHRITTE) { d.tank[k.t] += k.f; d.voll[k.t] += 1; d.k = d.k.filter(x => x !== k); }
    else { k.p = pfad(d, k.t)[k.s]; k.ab = jetzt + FLUG; k.luke = lukeNeu(d.rng); }
    nachschub(d, jetzt);
  }
  function ereignis(d, e) { d.ev.push(e); if (d.ev.length > 16) d.ev.shift(); }

  M.treibstoff = {
    id: "treibstoff", name: "Treibstoffkette", art: "Teams", ab: 4, eingabe: "Wischen", besser: "hoch", einheit: "l pro Person",
    kurz: "Reicht die Kanister von Handy zu Handy bis zur Rakete, ohne dass sie lecken.",
    anleitung: [
      "Ein Kanister erscheint unten auf deinem Handy. <b>Wische ihn durch die Luke oben</b>, dann fliegt er aufs Handy des Nächsten in deinem Team.",
      "<b>Ruhig wischen!</b> Wer zu hastig wischt, verursacht ein Leck. Wer die Luke verfehlt, prallt gegen die Wand und verliert auch etwas.",
      `Jeder Kanister geht ${SCHRITTE}-mal durchs Team und dann in die Rakete. Es kommen laufend neue nach.`,
      "Es zählt der getankte Treibstoff <b>pro Person</b> im Team. Ihr habt 60 Sekunden."
    ],
    neu(tn, rng, _e, teams) {
      return { tn, teams, k: [], nr: 0, tank: [0, 0], voll: [0, 0], leer: [0, 0], ev: [], start: 0, bis: 0, fertig: false, rng: null, bp: {} };
    },
    start(d, jetzt, ctx) {
      d.start = jetzt; d.bis = jetzt + DAUER;
      let a = Math.floor(ctx.rng() * 2 ** 31);
      Object.defineProperty(d, "rng", { value: W.RM ? W.RM.zufall(a) : (() => ((a = (a * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)), enumerable: false, writable: true });
      nachschub(d, jetzt);
    },
    aktion(d, pid, m, jetzt) {
      if (m.a !== "wisch") return "?";
      if (!d.bis || jetzt >= d.bis) return "Die Zeit ist um.";
      const k = d.k.find(x => x.id === m.id);
      if (!k || k.p !== pid) return "Diesen Kanister hast du nicht mehr.";
      if (k.ab > jetzt + 250) return "Der Kanister ist noch unterwegs.";
      const r = wurf(k, m);
      ereignis(d, { id: k.id, p: pid, art: r.art, leck: r.leck, t: jetzt });
      if (r.art === "schwach") return true;
      k.f -= r.leck;
      if (k.f <= 0) { d.k = d.k.filter(x => x !== k); d.leer[k.t] += 1; nachschub(d, jetzt); return true; }
      if (r.art === "wand") return true;
      weiter(d, k, pid, jetzt);
      return true;
    },
    takt(d, jetzt, ctx) {
      if (!d.bis || d.fertig) return false;
      if (jetzt >= d.bis + 800) { d.fertig = true; return true; }
      let anders = false;
      // Wer nicht mehr verbunden ist, reicht seine Kanister nach 1,5 Sekunden von selbst weiter (ohne Leck)
      if (jetzt < d.bis) for (const k of d.k.slice()) if (ctx && !ctx.aktiv.includes(k.p) && k.ab < jetzt - ABWESEND) {
        weiter(d, k, k.p, jetzt); anders = true;
      }
      return nachschub(d, jetzt) || anders;
    },
    wertung(d) { return Object.fromEntries(d.tn.map(p => [p, proKopf(d, teamVon(d, p))])); },
    wertText(d, p) { const t = teamVon(d, p); return `${proKopf(d, t)} l pro Person (${d.voll[t]} Kanister)`; },
    ausgang(d) { const a = d.tank[0] / d.teams[0].length, b = d.tank[1] / d.teams[1].length; return Math.abs(a - b) < 0.5 ? -1 : a > b ? 0 : 1; },
    sicht(d) { const v = Object.assign({}, d); delete v.bp; return v; },
    // Bot: wartet kurz, zielt ungefähr auf die Luke und wischt mal ruhig, mal zu hastig
    bot(d, pid, rng, jetzt) {
      if (!d.bis || jetzt >= d.bis) return null;
      const k = bei(d, pid)[0];
      if (!k || k.ab > jetzt) return null;
      const b = d.bp[pid] = d.bp[pid] || {};
      if (b.id !== k.id || b.f !== k.f) { b.id = k.id; b.f = k.f; b.um = jetzt + 450 + rng() * 900; return null; }
      if (jetzt < b.um) return null;
      b.id = null;
      const w = Math.atan2(-CY, k.luke - CX) + (rng() + rng() + rng() - 1.5) * 0.12;
      const v = rng() < 0.04 ? 0.3 : 0.9 + rng() * 1.9;
      return { t: "b", a: "wisch", id: k.id, w, v };
    },
    hilfe: { wurf, pfad, bei, nachschub, proKopf, DAUER, SCHRITTE, FLUG, CX, CY, LW, VLECK, VMIN, VOLL }
  };

  // ---------- Anzeige auf dem Handy ----------
  if (typeof document === "undefined") return;
  const U = W.ORBIT_UI = W.ORBIT_UI || {};
  const TEAMFARBE = ["#FF7A2F", "#4DA3FF"];
  let zug = null;                  // Wisch: { id, punkte: [{ x, y, t }] }
  let weg = new Map();             // meine Würfe: "id:Schritt" → { w, art, x, leck, t0, f, luke } (ein Kanister kommt öfter vorbei)
  const schluessel = k => k.id + ":" + k.s;
  const gesendet = k => { const a = weg.get(schluessel(k)); return !!a && a.art === "weiter"; };
  let zuletzt = { nr: null };

  function wischAus(c, cv) {
    const d = c.S.mission && c.S.mission.d, z = zug; zug = null;
    if (!d || !z || z.punkte.length < 2) return;
    const a = z.punkte[0], e = z.punkte[z.punkte.length - 1], dx = e.x - a.x, dy = e.y - a.y, breite = cv.getBoundingClientRect().width;
    if (Math.hypot(dx, dy) < 25) return;
    // Tempo am Ende: Strecke der letzten 80 ms
    let i = z.punkte.length - 1; while (i > 0 && e.t - z.punkte[i - 1].t <= 80) i--;
    const s = z.punkte[Math.max(0, i - 1)], dt = Math.max(16, e.t - s.t);
    const v = Math.hypot(e.x - s.x, e.y - s.y) / dt * 1000 / breite, w = Math.atan2(dy, dx);
    const k = bei(d, c.PID).filter(x => !gesendet(x) && x.ab <= c.jetzt())[0];
    if (!k) return;
    const r = wurf(k, { w, v });
    weg.set(schluessel(k), Object.assign({ w, t0: performance.now(), f: k.f, luke: k.luke, s: k.s }, r));
    if (c.klang) { if (r.art === "weiter") { c.klang("wurf"); if (r.leck) c.klang("leck"); } else c.klang(r.art === "wand" ? "fehler" : "tipp"); }
    c.tun({ t: "b", a: "wisch", id: k.id, w, v });
  }

  function kanister(g, x, y, sk, f, farbe, dpr, a) {
    const bw = 0.15 * sk, bh = 0.22 * sk;
    g.save(); g.translate(x, y); if (a) g.rotate(a);
    g.fillStyle = "#1B2246"; g.strokeStyle = "#060A1C"; g.lineWidth = 2.5 * dpr;
    g.beginPath(); g.roundRect(-bw / 2, -bh / 2, bw, bh, 6 * dpr); g.fill(); g.stroke();
    const h = (bh - 6 * dpr) * Math.max(0, f) / VOLL;
    g.fillStyle = farbe; g.fillRect(-bw / 2 + 3 * dpr, bh / 2 - 3 * dpr - h, bw - 6 * dpr, h);
    g.fillStyle = "#C9D1E0"; g.fillRect(-bw * 0.18, -bh / 2 - 5 * dpr, bw * 0.36, 6 * dpr);
    g.fillStyle = "#EAF2FF"; g.font = `900 ${Math.round(11 * dpr)}px "Exo 2", Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(Math.max(0, Math.round(f)), 0, 0);
    g.restore();
  }

  U.treibstoff = {
    html(d, c) {
      const ich = c.PID, t = d.teams[0].includes(ich) ? 0 : d.teams[1].includes(ich) ? 1 : -1;
      const kopf = `<div class="missionskopf"><span class="etikett">${t >= 0 ? `Team ${W.RM.TEAMNAMEN[t]}` : "Zuschauer"}</span>${c.uhr(d.bis)}</div>`;
      const tanks = `<div class="tankleiste" id="tanks"></div>`;
      if (!c.dabei || t < 0) return kopf + tanks + `<div class="kettenblick" id="kette"></div><p class="leise mitte">Du schaust zu.</p>`;
      return kopf + tanks + `<div class="arena-rahmen eckig frei tankrahmen"><canvas id="arena" class="arena tankfeld" aria-label="Kanister und Luke: wische den Kanister durch die Luke"></canvas></div>
        <p class="mitte tankzeile" id="tankzeile" aria-live="polite"></p><div class="kettenblick" id="kette"></div>`;
    },
    binden(c) {
      const cv = document.getElementById("arena");
      if (!cv) return;
      cv.addEventListener("pointerdown", e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} zug = { pid: e.pointerId, punkte: [{ x: e.clientX, y: e.clientY, t: performance.now() }] }; });
      cv.addEventListener("pointermove", e => { if (zug && e.pointerId === zug.pid) { zug.punkte.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (zug.punkte.length > 60) zug.punkte.splice(1, 1); } });
      cv.addEventListener("pointerup", e => { if (zug && e.pointerId === zug.pid) { zug.punkte.push({ x: e.clientX, y: e.clientY, t: performance.now() }); wischAus(c, cv); } });
      cv.addEventListener("pointercancel", () => { zug = null; });
    },
    bewegen(d, c) {
      if (zuletzt.nr !== c.nr) { zuletzt = { nr: c.nr, da: new Set() }; weg = new Map(); zug = null; }
      const jetzt = c.jetzt(), now = performance.now();
      // Klang, wenn ein Kanister bei mir ankommt
      for (const k of bei(d, c.PID)) if (k.ab <= jetzt && !zuletzt.da.has(schluessel(k))) { zuletzt.da.add(schluessel(k)); if (c.klang && k.ab > jetzt - 400) c.klang("plopp"); }
      // Tanks beider Teams und die Kette (wer gerade wie viele Kanister hat)
      const tk = document.getElementById("tanks");
      if (tk) {
        const h = [0, 1].map(t => `<span class="team${t} ${d.teams[t].includes(c.PID) ? "meins" : ""}"><b>${W.RM.TEAMNAMEN[t]}</b><i>${proKopf(d, t)} l</i><small>pro Person</small></span>`).join("");
        if (tk.dataset.h !== h) { tk.dataset.h = h; tk.innerHTML = h; }
      }
      const kt = document.getElementById("kette");
      if (kt) {
        const h = [0, 1].map(t => `<div class="team${t}">${d.teams[t].map(p => { const n = d.k.filter(k => k.p === p && k.ab <= jetzt).length; return `<span class="${p === c.PID ? "ich" : ""}">${c.helm(p)}<b>${"▮".repeat(Math.min(4, n))}</b></span>`; }).join("<i>›</i>")}<i>›</i><span class="rakete">🚀</span></div>`).join("");
        if (kt.dataset.h !== h) { kt.dataset.h = h; kt.innerHTML = h; }
      }
      const cv = document.getElementById("arena");
      if (!cv) return;
      const dpr = Math.min(2, W.devicePixelRatio || 1), px = Math.round(cv.clientWidth * dpr), ph = Math.round(px * HOEHE);
      if (cv.width !== px || cv.height !== ph) { cv.width = px; cv.height = ph; }
      const g = cv.getContext("2d"), sk = px, X = x => x * sk, Y = y => y * sk;
      const meinT = teamVon(d, c.PID), farbe = TEAMFARBE[meinT];
      // Wand der Station
      g.fillStyle = "#0B1026"; g.fillRect(0, 0, px, ph);
      g.strokeStyle = "#1C2550"; g.lineWidth = 1 * dpr;
      for (let y = 0.2; y < HOEHE; y += 0.2) { g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(px, Y(y)); g.stroke(); }
      for (let x = 0.25; x < 1; x += 0.25) { g.beginPath(); g.moveTo(X(x), Y(0.1)); g.lineTo(X(x), ph); g.stroke(); }
      for (const [k, a] of weg) if (now - a.t0 > 2500) weg.delete(k);
      const meine = bei(d, c.PID), frei = meine.filter(k => !gesendet(k));
      const oben = frei.find(k => k.ab <= jetzt) || frei[0];
      // Luke oben (für den Kanister, der dran ist)
      const luke = oben ? oben.luke : 0.5, ziel = oben ? (oben.s + 1 >= SCHRITTE ? null : pfad(d, meinT)[oben.s + 1]) : null;
      g.fillStyle = "#141B3D"; g.fillRect(0, 0, px, Y(0.1));
      g.fillStyle = "#060A1C"; g.fillRect(X(luke - LW / 2), 0, X(LW), Y(0.1));
      g.strokeStyle = oben ? (ziel ? c.farbe(ziel) : "#FFD23F") : "#26305E"; g.lineWidth = 3 * dpr;
      g.strokeRect(X(luke - LW / 2), -2, X(LW), Y(0.1) + 2);
      g.fillStyle = "#EAF2FF"; g.font = `800 ${Math.round(12 * dpr)}px "Exo 2", Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
      if (oben) g.fillText(ziel ? `→ ${c.name(ziel)}` : "→ RAKETE", X(luke), Y(0.05));
      // Warteschlange unten links
      const wartend = frei.filter(k => k !== oben && k.ab <= jetzt).length;
      if (wartend) { g.fillStyle = "#9AA7D1"; g.textAlign = "left"; g.fillText(`+${wartend} wartet`, X(0.04), Y(HOEHE - 0.05)); }
      // Kanister: ankommend von unten, der oberste in der Mitte
      for (const k of frei) {
        if (k === oben && k.ab <= jetzt) continue;
        if (k.ab > jetzt) { const f = 1 - (k.ab - jetzt) / FLUG; if (f > 0) kanister(g, X(CX), Y(HOEHE + 0.2 - (HOEHE + 0.2 - CY) * Math.min(1, f)), sk, k.f, farbe, dpr); }
      }
      let meldung = null;
      for (const [id, a] of weg) {
        const tt = (now - a.t0) / 1000, ux = Math.cos(a.w), uy = Math.sin(a.w);
        if (a.art === "weiter") {
          if (tt < 0.6) kanister(g, X(CX + ux * tt * 2.6), Y(CY + uy * tt * 2.6), sk, a.f - a.leck, farbe, dpr, a.w + Math.PI / 2);
          if (a.leck && tt < 1) for (let i = 0; i < 10; i++) { const s = tt * (0.4 + i * 0.07); g.fillStyle = farbe; g.globalAlpha = 1 - tt; g.beginPath(); g.arc(X(CX + ux * tt * 1.2 + Math.cos(i * 2.4) * s), Y(CY + uy * tt * 1.2 + Math.sin(i * 2.4) * s), 3 * dpr, 0, TAU); g.fill(); g.globalAlpha = 1; }
          if (tt < 1.3) meldung = a.leck ? [`Leck! −${a.leck} l`, "#FF5C9A"] : ["Sauber!", "#7BD957"];
        } else if (tt < 1.3) meldung = a.art === "wand" ? [`Daneben! −${a.leck} l`, "#FF7A2F"] : ["Zu schwach", "#9AA7D1"];
      }
      if (oben && oben.ab <= jetzt) {
        // Der Kanister, der dran ist (prallt nach einem Fehlwurf kurz ab)
        const a = weg.get(schluessel(oben)); let x = CX, y = CY;
        if (a && a.art !== "weiter") {
          const tt = (now - a.t0) / 1000, ziely = a.art === "wand" ? 0.1 : CY - 0.2, zielx = a.art === "wand" ? a.x : CX + Math.cos(a.w) * 0.2;
          const f = tt < 0.25 ? tt / 0.25 : tt < 0.6 ? 1 - (tt - 0.25) / 0.35 : 0;
          x = CX + (zielx - CX) * f; y = CY + (ziely - CY) * f;
          if (tt > 0.6) weg.delete(schluessel(oben));
        }
        kanister(g, X(x), Y(y), sk, oben.f, farbe, dpr);
        // Wischspur
        if (zug && zug.punkte.length > 1) {
          const r = cv.getBoundingClientRect(), p0 = zug.punkte[0];
          g.strokeStyle = "rgba(234,242,255,.35)"; g.lineWidth = 6 * dpr; g.lineCap = "round"; g.beginPath();
          for (const p of zug.punkte) g.lineTo((p.x - r.left) * dpr, (p.y - r.top) * dpr);
          g.stroke(); void p0;
        }
      } else if (!meldung) {
        g.fillStyle = "#9AA7D1"; g.textAlign = "center"; g.font = `700 ${Math.round(13 * dpr)}px Inter, sans-serif`;
        g.fillText(jetzt >= d.bis ? "Zeit um!" : "Warte auf einen Kanister …", X(0.5), Y(CY));
      }
      if (meldung) { g.fillStyle = meldung[1]; g.textAlign = "center"; g.font = `900 ${Math.round(20 * dpr)}px "Exo 2", Inter, sans-serif`; g.fillText(meldung[0], X(0.5), Y(0.55)); }
      const zl = document.getElementById("tankzeile");
      if (zl) { const txt = oben && oben.ab <= jetzt ? `Kanister ${oben.s + 1} von ${SCHRITTE}: ruhig nach oben wischen` : ""; if (zl.textContent !== txt) zl.textContent = txt; }
    }
  };
})();
