// Sperrgut: Turmansicht (Canvas) und Steuerung per Finger, Tasten oder Knopfleiste.
//   const a = SG_SPIEL.ansicht(canvas);  a.zeichnen(turm, info)   info = { farbe, modus, fenster, dach, tag, laken, regen, jetzt }
//   SG_SPIEL.steuerung(element, { schieben(r), drehen(), fallen(), schnell(an), proFeld() })  → { weg() }
(function () {
  const W = window;
  const Z = () => W.SG_ZEICHNEN;
  const ST = W.SG_TEILE;

  // Einfache Ersatz-Zeichnung, falls zeichnen.js fehlt
  function teilEinfach(g, typ, s, o) {
    const T = ST.TEILE[typ];
    g.fillStyle = o.geist ? "rgba(255,255,255,.18)" : T.art === "karton" ? "#C8965A" : T.art === "rund" ? "#8FD3FF" : "#E9E2D0";
    g.strokeStyle = o.geist ? "rgba(255,255,255,.6)" : "#2A1D14"; g.lineWidth = Math.max(1, s * 0.06);
    if (T.kreis) { g.beginPath(); g.arc(0, 0, T.kreis * s, 0, 7); g.fill(); g.stroke(); return; }
    for (const [x, y, w, h] of T.rects) { g.fillRect(x * s, y * s, w * s, h * s); g.strokeRect(x * s, y * s, w * s, h * s); }
    if (!o.geist && o.farbe && T.art === "karton") { g.fillStyle = o.farbe; for (const [x, y, w, h] of T.rects) g.fillRect((x + w / 2 - 0.08) * s, y * s, 0.16 * s, h * s); }
  }
  const teil = (g, typ, s, o) => (Z() && Z().teil ? Z().teil(g, typ, s, o) : teilEinfach(g, typ, s, o));

  function ansicht(cv) {
    const g = cv.getContext("2d");
    let unten = -1.6, s = 30, scherben = [];
    const a = {
      get s() { return s; },
      bruch(x, y) { scherben.push({ x, y, t0: performance.now() }); },
      zeichnen(t, info) {
        const dpr = Math.min(2, W.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight;
        if (!cw || !ch) return;
        if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const modus = info.modus;
        // Maßstab und Kamera
        let ziel;
        if (modus === "wagen") { s = Math.min(cw / 11, (ch - 10) / (t.dach + 2.6)); ziel = -1.4; unten = ziel; }
        else {
          s = Math.min(cw / 11, ch / 13);
          const hoehe = ch / s, oben = Math.max(t.oben || 0, t.hoehe);
          ziel = Math.max(-1.6, oben + 7.2 - hoehe * 0.95);
          unten += (ziel - unten) * 0.06;
        }
        const mitteX = modus === "wagen" ? cw / 2 + 0.5 * s : cw / 2;
        const px = x => mitteX + x * s, py = y => ch - (y - unten) * s;
        const v = { w: cw, h: ch, s, unten, mitteX, tag: info.tag || 0, fenster: modus === "hoch" ? info.fenster : null, modus, dach: t.dach };
        if (Z() && Z().hintergrund) Z().hintergrund(g, v);
        else {
          g.fillStyle = "#E8D9BC"; g.fillRect(0, 0, cw, ch);
          g.fillStyle = "#7A5A3A"; g.fillRect(px(-3), py(0), 6 * s, 0.6 * s);
          if (v.fenster) { g.strokeStyle = "#C0392B"; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(0, py(v.fenster)); g.lineTo(cw, py(v.fenster)); g.stroke(); g.setLineDash([]); }
        }
        const liste = t.liste();
        // Lot und Geist des fallenden Teils
        const akt = liste.find(e => e.aktiv), lot = t.lot && t.lot();
        if (akt && lot) {
          const fall = Math.max(0, lot.unten - lot.y);
          if (Z() && Z().lot) Z().lot(g, px(lot.x0), px(lot.x1), py(lot.unten), py(lot.y));
          else { g.strokeStyle = "rgba(255,255,255,.7)"; g.setLineDash([4, 5]); g.beginPath(); for (const x of [lot.x0, lot.x1]) { g.moveTo(px(x), py(lot.unten)); g.lineTo(px(x), py(lot.y)); } g.stroke(); g.setLineDash([]); }
          g.save(); g.translate(px(akt.x), py(akt.y - fall)); g.rotate(-akt.a); teil(g, akt.typ, s, { geist: true }); g.restore();
        }
        for (const e of liste) {
          if (e.aktiv) continue;
          g.save(); g.translate(px(e.x), py(e.y)); g.rotate(-e.a); teil(g, e.typ, s, { farbe: info.farbe, pizza: e.pizza, zerbrechlich: e.zerbrechlich, nass: e.nass }); g.restore();
          if (e.gurt || e.fest) { g.save(); g.translate(px(e.x), py(e.y)); g.rotate(-e.a); g.strokeStyle = e.fest ? "rgba(46,196,182,.9)" : "rgba(255,210,63,.9)"; g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); g.arc(0, 0, ST.radius(e.typ) * s * 0.75, 0, 7); g.stroke(); g.restore(); }
        }
        if (akt) { g.save(); g.translate(px(akt.x), py(akt.y)); g.rotate(-akt.a); teil(g, akt.typ, s, { farbe: info.farbe, pizza: akt.pizza, zerbrechlich: akt.zerbrechlich, nass: akt.nass }); g.restore(); }
        const k = t.katzePos && t.katzePos();
        if (k) { g.save(); g.translate(px(k.x), py(k.y)); if (k.r < 0) g.scale(-1, 1); if (Z() && Z().katze) Z().katze(g, s, (info.jetzt || 0) / 1000, 1); else { g.fillStyle = "#E08A2E"; g.fillRect(-0.6 * s, -0.7 * s, 1.2 * s, 0.7 * s); } g.restore(); }
        // Scherben
        const jetzt = performance.now();
        scherben = scherben.filter(b => jetzt - b.t0 < 900);
        for (const b of scherben) {
          const kk = (jetzt - b.t0) / 900, x = Math.max(16, Math.min(cw - 16, px(b.x))), y = Math.max(16, Math.min(ch - 16, py(b.y)));
          if (Z() && Z().scherben) Z().scherben(g, x, y, kk);
          else { g.fillStyle = `rgba(255,255,255,${1 - kk})`; for (let i = 0; i < 8; i++) { const w = i / 8 * 7; g.fillRect(x + Math.cos(w) * kk * 40, y + Math.sin(w) * kk * 40, 4, 4); } }
        }
        if (info.regen && Z() && Z().regen) Z().regen(g, v, (info.jetzt || 0) / 1000);
        if (info.laken) {
          const y0 = 0, y1 = Math.min(ch, py(Math.max(t.hoehe, 0) + 0.8));
          if (Z() && Z().laken) Z().laken(g, 0, y0, cw, Math.max(80, y1 - y0), (info.jetzt || 0) / 1000);
          else { g.fillStyle = "rgba(245,245,245,.96)"; g.fillRect(0, y0, cw, y1 - y0); }
          if (akt && lot && Z() && Z().lot) Z().lot(g, px(lot.x0), px(lot.x1), py(lot.unten), py(lot.y));   // das Lot sieht man durchs Laken
        }
      }
    };
    return a;
  }

  // Finger: ziehen = verschieben (in halben Feldern), tippen = drehen, nach unten wischen = fallen, halten = schneller
  function steuerung(el, z) {
    let start = null;
    const ab = e => {
      if (e.target.closest && e.target.closest("button")) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, bewegt: false, halt: null, schnell: false };
      start.halt = setTimeout(() => { if (start && !start.bewegt) { start.schnell = true; z.schnell(true); } }, 280);
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
    };
    const zug = e => {
      if (!start || e.pointerId !== start.id) return;
      const schritt = z.proFeld() * 0.5;
      const dx = e.clientX - start.lx;
      if (Math.abs(e.clientX - start.x) > 10 || Math.abs(e.clientY - start.y) > 10) start.bewegt = true;
      if (Math.abs(e.clientY - start.y) > Math.abs(e.clientX - start.x) * 1.4 && e.clientY - start.y > 18) return;   // wischt nach unten
      while (Math.abs(start.lx - e.clientX) >= schritt) {
        const r = Math.sign(dx); z.schieben(r); start.lx += r * schritt;
      }
    };
    const auf = e => {
      if (!start || e.pointerId !== start.id) return;
      clearTimeout(start.halt);
      const dt = performance.now() - start.t, dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (start.schnell) z.schnell(false);
      else if (dy > 45 && dy > Math.abs(dx) * 1.4 && dt < 450) z.fallen();
      else if (!start.bewegt && dt < 280) z.drehen();
      start = null;
    };
    const abbruch = () => { if (start) { clearTimeout(start.halt); if (start.schnell) z.schnell(false); } start = null; };
    const taste = e => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft") z.schieben(-1);
      else if (e.key === "ArrowRight") z.schieben(1);
      else if (e.key === "ArrowUp" || e.key === "x") z.drehen();
      else if (e.key === "ArrowDown") { if (!e.repeat) z.schnell(true); }
      else if (e.key === " ") z.fallen();
      else return;
      e.preventDefault();
    };
    const tasteAuf = e => { if (e.key === "ArrowDown") z.schnell(false); };
    el.addEventListener("pointerdown", ab); el.addEventListener("pointermove", zug); el.addEventListener("pointerup", auf); el.addEventListener("pointercancel", abbruch);
    W.addEventListener("keydown", taste); W.addEventListener("keyup", tasteAuf);
    return { weg() { el.removeEventListener("pointerdown", ab); el.removeEventListener("pointermove", zug); el.removeEventListener("pointerup", auf); el.removeEventListener("pointercancel", abbruch); W.removeEventListener("keydown", taste); W.removeEventListener("keyup", tasteAuf); } };
  }

  // Kleiner Turm eines Mitspielers
  function mini(cv, teile, o) {
    const g = cv.getContext("2d"), dpr = Math.min(2, W.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight;
    if (!cw || !ch) return;
    if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hoch = o.modus === "wagen" ? (o.dach || 8) + 1.5 : Math.max(o.fenster || 10, ...teile.map(e => e.y + 1.5)) + 1.5;
    const s = Math.min(cw / 9, ch / (hoch + 1.2)), unten = -1;
    if (Z() && Z().miniTurm) { Z().miniTurm(g, teile, { w: cw, h: ch, s, farbe: o.farbe, fenster: o.modus === "hoch" ? o.fenster : null, unten, modus: o.modus, dach: o.dach }); return; }
    g.clearRect(0, 0, cw, ch);
    const px = x => cw / 2 + x * s, py = y => ch - (y - unten) * s;
    g.fillStyle = "#7A5A3A"; g.fillRect(px(-3), py(0), 6 * s, 0.6 * s);
    if (o.fenster && o.modus === "hoch") { g.fillStyle = "#C0392B"; g.fillRect(0, py(o.fenster), cw, 1); }
    for (const e of teile) { g.save(); g.translate(px(e.x), py(e.y)); g.rotate(-e.a); teilEinfach(g, e.typ, s, { farbe: o.farbe }); g.restore(); }
  }

  W.SG_SPIEL = { ansicht, steuerung, mini };
})();
