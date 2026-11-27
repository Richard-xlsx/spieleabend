// Sperrgut: Bots. Suchen für das fallende Teil eine Lage (Drehung und Stelle) mit guter Auflage nahe der Mitte,
// steuern dann wie ein Mensch Schritt für Schritt dorthin und lassen das Teil fallen. Manchmal liegen sie daneben.
//   SG_BOT.steuern(turm, dt, { modus, rng, geschick 0..1 })
(function () {
  const ST = typeof module !== "undefined" ? require("./teile.js") : window.SG_TEILE;

  // Rechtecke des Teils in Welt-Ausrichtung (y nach oben) nach k Vierteldrehungen im Uhrzeigersinn
  function form(typ, k) {
    const T = ST.TEILE[typ];
    const rects = T.kreis ? [[-T.kreis, -T.kreis, 2 * T.kreis, 2 * T.kreis]] : T.rects;
    return rects.map(([x, y, w, h]) => {
      // in y-oben umrechnen: Rechteck von (x, -(y+h)) bis (x+w, -y)
      let x0 = x, x1 = x + w, y0 = -(y + h), y1 = -y;
      for (let i = 0; i < k; i++) {               // Drehung um −90°: (x, y) → (y, −x)
        const nx0 = y0, nx1 = y1, ny0 = -x1, ny1 = -x0;
        x0 = nx0; x1 = nx1; y0 = ny0; y1 = ny1;
      }
      return [x0, y0, x1, y1];
    });
  }
  // Wie gut liegt das Teil (Mitte bei x) in Lage k? Liefert Bewertung und Landehöhe
  function bewerten(t, typ, k, x, modus) {
    const R = form(typ, k), proben = [];
    let lo = Infinity, hi = -Infinity;
    for (const r of R) { lo = Math.min(lo, r[0] + x); hi = Math.max(hi, r[2] + x); }
    for (let px = lo + 0.08; px <= hi - 0.07; px += 0.25) {
      let unten = Infinity;
      for (const r of R) if (px >= r[0] + x && px <= r[2] + x) unten = Math.min(unten, r[1]);
      if (unten === Infinity) continue;
      proben.push({ px, unten, boden: t.profil(px) });
    }
    if (!proben.length) return null;
    let fall = Infinity;
    for (const p of proben) fall = Math.min(fall, p.unten - p.boden);    // Abstand Mitte → Landung
    const yMitte = -fall;                                                  // Mitte des Teils bei der Landung
    let auflage = 0, luecke = 0, ins = 0, links = Infinity, rechts = -Infinity;
    for (const p of proben) {
      const g = p.unten + yMitte - p.boden;
      if (p.boden < -1) { ins++; continue; }                               // ragt über den Rand ins Leere
      if (g < 0.12) { auflage++; links = Math.min(links, p.px); rechts = Math.max(rechts, p.px); } else luecke += Math.min(g, 2);
    }
    let oben = -Infinity; for (const r of R) oben = Math.max(oben, r[3] + yMitte);
    // Schwerpunkt der Form über der Auflage?
    let fl = 0, sx = 0; for (const r of R) { const a = (r[2] - r[0]) * (r[3] - r[1]); fl += a; sx += a * ((r[0] + r[2]) / 2 + x); }
    const schwer = sx / fl, ueber = links === Infinity ? 3 : schwer < links - 0.05 ? links - schwer : schwer > rechts + 0.05 ? schwer - rechts : 0;
    const n = proben.length;
    let w = (auflage / n) * 6 - (luecke / n) * 3 - (ins / n) * 8 - ueber * 6 - Math.abs(x - (t.W.links + t.W.rechts) / 2) * 0.35;
    if (auflage < 2) w -= 4;
    if (modus === "hoch") w += oben * 0.12;
    else w -= oben * (modus === "wagen" ? 1.6 : 0.9);
    if (modus === "wagen") { if (oben > t.dach - 0.15) w -= 20; if (hi > t.W.rechts - 0.2) w -= (hi - t.W.rechts + 0.2) * 8; w -= x * 0.3; }
    return { w, oben, auflage };
  }
  function planen(t, modus, rng, geschick) {
    const e = t.aktiv, typ = e.typ;
    let best = null;
    const lagen = ST.TEILE[typ].kreis ? [0] : [0, 1, 2, 3];
    for (const k of lagen) {
      for (let x = t.W.links - 0.5; x <= t.W.rechts + 0.51; x += 0.5) {
        const b = bewerten(t, typ, k, x, modus);
        if (!b) continue;
        b.w += (rng() - 0.5) * (1 - geschick) * 2.5;
        if (!best || b.w > best.w) best = { k, x, w: b.w };
      }
    }
    if (best && rng() > 0.55 + geschick * 0.4) best.x += rng() < 0.5 ? -0.5 : 0.5;   // daneben
    return best;
  }

  function steuern(t, dt, o) {
    const e = t.aktiv, rng = o.rng || Math.random, geschick = o.geschick == null ? 0.6 : o.geschick;
    if (!e || t.ende) { if (t._bot) t._bot = null; return; }
    let b = t._bot;
    if (!b || b.id !== e.id) { b = t._bot = { id: e.id, warte: 0.35 + rng() * 0.5, plan: null, gedreht: 0 }; }
    b.warte -= dt;
    if (b.warte > 0) return;
    if (!b.plan) { b.plan = planen(t, o.modus, rng, geschick) || { k: 0, x: 0 }; }
    const takt = 0.11 + (1 - geschick) * 0.12 + rng() * 0.06;
    if (b.gedreht < b.plan.k) { t.drehen(); b.gedreht++; b.warte = takt; return; }
    const x = e.b.getPosition().x, d = b.plan.x - x;
    if (Math.abs(d) > 0.25) { if (!t.schieben(Math.sign(d))) b.plan.x = x; b.warte = takt * 0.8; return; }
    if (!e.sturz) { t.fallen(); b.warte = 9; }
  }

  const SG_BOT = { steuern, bewerten, form };
  if (typeof module !== "undefined") module.exports = SG_BOT;
  if (typeof window !== "undefined") window.SG_BOT = SG_BOT;
})();
