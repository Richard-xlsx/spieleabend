// Orbit: Klänge aus dem Synthesizer (Web Audio), keine Tondateien.
// ORBIT_KLANG.spiel("name") spielt einen Klang, ORBIT_KLANG.an sagt, ob der Ton an ist (gespeichert im Handy).
(function (W) {
  let ac = null, haupt = null, rauschen = null;
  let an = true;
  try { an = localStorage.getItem("ob:ton") !== "aus"; } catch (e) {}

  function bereit() {
    if (!an) return null;
    try {
      if (!ac) {
        const AC = W.AudioContext || W.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        haupt = ac.createGain(); haupt.gain.value = 0.55;
        const f = ac.createDynamicsCompressor(); haupt.connect(f); f.connect(ac.destination);
        const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), x = b.getChannelData(0);
        for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1;
        rauschen = b;
      }
      if (ac.state === "suspended") ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  // Browser erlauben Ton erst nach einer Berührung
  const wecken = () => { if (an) bereit(); };
  W.addEventListener("pointerdown", wecken, { passive: true });
  W.addEventListener("keydown", wecken);

  // Ein Ton: Frequenz (auch gleitend), Hüllkurve, Wellenform
  function ton(hz, ab, dauer, o) {
    o = o || {};
    const t = ac.currentTime + ab, osz = ac.createOscillator(), g = ac.createGain();
    osz.type = o.typ || "sine";
    osz.frequency.setValueAtTime(hz, t);
    if (o.bis) osz.frequency.exponentialRampToValueAtTime(o.bis, t + dauer);
    const laut = o.laut == null ? 0.3 : o.laut, an = o.an || 0.008;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(laut, t + an);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    let ziel = haupt;
    if (o.filter) { const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.filter; f.connect(haupt); ziel = f; }
    osz.connect(g); g.connect(ziel);
    osz.start(t); osz.stop(t + dauer + 0.02);
  }
  // Rauschen durch einen Bandpass (Würfel, Wischen, Beben)
  function zisch(ab, dauer, o) {
    o = o || {};
    const t = ac.currentTime + ab, q = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    q.buffer = rauschen; q.loop = true;
    f.type = o.art || "bandpass"; f.Q.value = o.q || 1.2;
    f.frequency.setValueAtTime(o.hz || 1200, t);
    if (o.bis) f.frequency.exponentialRampToValueAtTime(o.bis, t + dauer);
    const laut = o.laut == null ? 0.3 : o.laut;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(laut, t + (o.an || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    q.connect(f); f.connect(g); g.connect(haupt);
    q.start(t, Math.random() * 0.5); q.stop(t + dauer + 0.02);
  }
  const akkord = (hzs, ab, dauer, o) => hzs.forEach(h => ton(h, ab, dauer, o));

  const KLANG = {
    tipp() { ton(1400, 0, 0.05, { typ: "triangle", laut: 0.12 }); },
    schritt() { ton(520, 0, 0.07, { typ: "triangle", laut: 0.12, bis: 640 }); },
    wuerfel() {
      for (let i = 0; i < 7; i++) zisch(i * 0.055 + Math.random() * 0.02, 0.045, { hz: 1800 + Math.random() * 1600, q: 4, laut: 0.35 });
      ton(180, 0.42, 0.08, { typ: "triangle", laut: 0.25 });
    },
    dran() { ton(660, 0, 0.14, { typ: "triangle", laut: 0.22 }); ton(990, 0.12, 0.22, { typ: "triangle", laut: 0.22 }); },
    energie() { ton(880, 0, 0.12, { typ: "triangle", laut: 0.2 }); ton(1320, 0.08, 0.2, { typ: "triangle", laut: 0.2 }); },
    verlust() { ton(392, 0, 0.18, { typ: "sawtooth", laut: 0.12, bis: 262, filter: 1400 }); ton(262, 0.15, 0.25, { typ: "sawtooth", laut: 0.12, bis: 196, filter: 1000 }); },
    kristall() { [1047, 1319, 1568, 2093, 2637].forEach((h, i) => ton(h, i * 0.06, 0.5, { laut: 0.14 })); zisch(0, 0.5, { hz: 6000, art: "highpass", laut: 0.04 }); },
    glocke() { ton(784, 0, 0.6, { laut: 0.18 }); ton(1176, 0, 0.45, { laut: 0.08 }); },
    auftakt() { ton(220, 0, 0.5, { typ: "triangle", laut: 0.18, bis: 880 }); zisch(0, 0.5, { hz: 400, bis: 3000, laut: 0.06 }); },
    tick() { ton(1000, 0, 0.06, { typ: "square", laut: 0.08, filter: 2500 }); },
    los() { akkord([523, 784, 1047], 0, 0.45, { typ: "triangle", laut: 0.16 }); },
    sieg() { [523, 659, 784, 1047].forEach((h, i) => ton(h, i * 0.1, i === 3 ? 0.6 : 0.16, { typ: "triangle", laut: 0.2 })); },
    ende() { ton(523, 0, 0.18, { typ: "triangle", laut: 0.16 }); ton(392, 0.16, 0.35, { typ: "triangle", laut: 0.16 }); },
    fanfare() {
      [392, 523, 659, 784].forEach((h, i) => ton(h, i * 0.12, 0.2, { typ: "sawtooth", laut: 0.1, filter: 2200 }));
      akkord([523, 659, 784, 1047], 0.5, 1.1, { typ: "triangle", laut: 0.14 });
    },
    wurf() { zisch(0, 0.28, { hz: 600, bis: 3500, q: 1.5, laut: 0.22, an: 0.04 }); },
    plopp() { ton(320, 0, 0.12, { laut: 0.28, bis: 120 }); },
    leck() { [900, 760, 640].forEach((h, i) => ton(h, i * 0.07, 0.08, { laut: 0.15, bis: h * 0.7 })); zisch(0, 0.3, { hz: 3000, laut: 0.08 }); },
    fehler() { ton(150, 0, 0.16, { typ: "square", laut: 0.1, filter: 700 }); ton(120, 0.12, 0.2, { typ: "square", laut: 0.1, filter: 600 }); },
    beben() { zisch(0, 1.4, { hz: 120, art: "lowpass", q: 0.7, laut: 0.5, an: 0.2 }); ton(55, 0, 1.4, { typ: "sawtooth", laut: 0.12, filter: 160, an: 0.2 }); },
    krach() { zisch(0, 0.5, { hz: 300, bis: 80, art: "lowpass", laut: 0.45 }); ton(90, 0, 0.35, { laut: 0.3, bis: 40 }); }
  };

  let zuletzt = {};
  W.ORBIT_KLANG = {
    get an() { return an; },
    umschalten() {
      an = !an;
      try { localStorage.setItem("ob:ton", an ? "an" : "aus"); } catch (e) {}
      if (an) { bereit(); KLANG.tipp(); }
      return an;
    },
    // Derselbe Klang höchstens alle 60 ms, und nur, wenn das Handy den Tab zeigt
    spiel(name) {
      if (!an || !KLANG[name] || (W.document && W.document.visibilityState === "hidden")) return;
      const jetzt = Date.now();
      if (zuletzt[name] && jetzt - zuletzt[name] < 60) return;
      zuletzt[name] = jetzt;
      if (!bereit()) return;
      try { KLANG[name](); } catch (e) {}
    },
    namen: Object.keys(KLANG)
  };
})(window);
