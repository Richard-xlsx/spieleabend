// Gemeinsamer Teil für Missionen „Jeder für sich“ (Greifarm, Bordküche): Jedes Handy rechnet sein Spiel selbst mit dem
// gleichen Startwert (d.rs) und einem festen Zeitschritt. Der Spielleiter sammelt nur Zwischenstände und das Ergebnis.
// Bots spielen dasselbe Spiel ohne Oberfläche gleich zu Beginn durch, ihre Stände erscheinen dann nach und nach.
//   ORBIT_SOLO.host({ dauer, max, botLauf(rs, pid, rng) → { stand: [[ms, wert]], wert, ms } }) → Teil für den Spielleiter
//   ORBIT_SOLO.lauf(c, d, { neu(rs), schritt(sim, ein, dt), eingabe(), wert(sim), ende(sim) }) → sim (auf dem Handy)
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const DT = 1 / 60, NACHLAUF = 4000;

  function host(cfg) {
    const zahl = v => { v = Math.round(+v); return isFinite(v) ? Math.max(0, Math.min(cfg.max, v)) : 0; };
    return {
      neu(tn, rng) { return { tn, rs: Math.floor(rng() * 2 ** 31), start: 0, bis: 0, stand: {}, erg: {}, fertig: false }; },
      start(d, jetzt, ctx) {
        d.start = jetzt; d.bis = jetzt + cfg.dauer; d.bp = {};
        for (const p of (ctx && ctx.bots) || []) d.bp[p] = Object.assign({ i: 0 }, cfg.botLauf(d.rs, p, ctx.rng));
      },
      aktion(d, pid, m, jetzt) {
        if (!d.tn.includes(pid) || !d.start) return "?";
        if (d.erg[pid] !== undefined) return "Du bist schon fertig.";
        if (m.a === "stand") { d.stand[pid] = zahl(m.wert); return true; }
        if (m.a === "ende") { d.erg[pid] = d.stand[pid] = zahl(m.wert); return true; }
        return "?";
      },
      takt(d, jetzt, ctx) {
        if (!d.start || d.fertig) return false;
        let anders = false;
        for (const p in d.bp) {
          const b = d.bp[p];
          while (b.i < b.stand.length && d.start + b.stand[b.i][0] <= jetzt) { d.stand[p] = b.stand[b.i][1]; b.i++; anders = true; }
          if (d.erg[p] === undefined && d.start + b.ms <= jetzt) { d.erg[p] = d.stand[p] = b.wert; anders = true; }
        }
        const offen = ctx.aktiv.filter(p => d.erg[p] === undefined);
        if (!offen.length || jetzt >= d.bis + NACHLAUF) { d.fertig = true; anders = true; }
        return anders;
      },
      // Wer zwischendurch die Verbindung verliert, behält seinen letzten Stand
      wertung(d) { return Object.fromEntries(d.tn.map(p => [p, d.erg[p] !== undefined ? d.erg[p] : d.stand[p] !== undefined ? d.stand[p] : null])); },
      sicht(d) { const v = Object.assign({}, d); delete v.bp; return v; }
    };
  }

  // Ein Spiel ohne Oberfläche ganz durchrechnen (Bots, Tests): steuer(sim) → Eingabe
  function durch(sim, dauer, steuer) {
    const stand = []; let t = 0, w = sim.wert();
    while (t < dauer && !sim.ende()) {
      sim.schritt(steuer(sim), DT); t += DT * 1000;
      if (sim.wert() !== w) { w = sim.wert(); stand.push([Math.round(t), w]); }
    }
    return { stand, wert: sim.wert(), ms: Math.round(Math.min(t, dauer)) };
  }

  // ---------- Handy: das eigene Spiel im festen Takt nach der abgeglichenen Uhr ----------
  let L = null;   // { nr, sim, t, wert, gemeldet }
  function lauf(c, d, f) {
    if (!d.start) return null;
    if (!L || L.nr !== c.nr) L = { nr: c.nr, sim: f.neu(d.rs), t: 0, wert: 0, gemeldet: false };
    if (!c.dabei || d.erg[c.PID] !== undefined) { L.gemeldet = true; return L.sim; }
    const ziel = Math.min(c.jetzt() - d.start, f.dauer);
    let n = 0;
    while (L.t + DT * 1000 <= ziel && !L.sim.ende() && n++ < 600) { L.sim.schritt(f.eingabe(), DT); L.t += DT * 1000; }
    const w = L.sim.wert();
    if (w !== L.wert) { L.wert = w; c.tun({ t: "b", a: "stand", wert: w }); }
    if (!L.gemeldet && (L.sim.ende() || ziel >= f.dauer)) { L.gemeldet = true; c.tun({ t: "b", a: "ende", wert: w }); }
    return L.sim;
  }
  const zeit = () => (L ? L.t : 0);
  // Zwischenstände aller Spieler: wird in bewegen() gefüllt, damit sich die Seite nicht neu aufbaut, während man spielt
  // (sonst verschwindet der gedrückte Knopf unter dem Finger)
  const standLeiste = () => `<div class="punkteleiste" id="solostand"></div>`;
  function standZeigen(d, c) {
    const el = typeof document !== "undefined" && document.getElementById("solostand");
    if (!el) return;
    const h = d.tn.map(p => `<span class="${p === c.PID ? "ich" : ""}">${c.helm(p)}<b>${d.stand[p] !== undefined ? d.stand[p] : "–"}</b>${d.erg[p] !== undefined ? "✓" : ""}</span>`).join("");
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }

  W.ORBIT_SOLO = { host, durch, lauf, zeit, DT, standLeiste, standZeigen, get sim() { return L && L.sim; } };
})();
