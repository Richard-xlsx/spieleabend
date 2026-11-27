// Sperrgut: Klänge aus dem Synthesizer (Web Audio), keine Tondateien.
// SG_KLANG.spiel("name", staerke) spielt einen Klang, SG_KLANG.an sagt, ob der Ton an ist (gespeichert im Handy unter "sg:ton").
(function (W) {
  let ac = null, haupt = null, rauschen = null;
  let an = true;
  try { an = W.localStorage ? W.localStorage.getItem("sg:ton") !== "aus" : true; } catch (e) {}

  function bereit() {
    if (!an) return null;
    try {
      if (!ac) {
        const AC = W.AudioContext || W.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        haupt = ac.createGain(); haupt.gain.value = 0.5;
        const f = ac.createDynamicsCompressor(); haupt.connect(f); f.connect(ac.destination);
        const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), x = b.getChannelData(0);
        for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1;
        rauschen = b;
      }
      if (ac.state === "suspended") ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  // Browser erlauben Ton erst nach einer Berührung
  const wecken = () => { if (an) bereit(); };
  if (typeof W.addEventListener === "function") {
    W.addEventListener("pointerdown", wecken, { passive: true });
    W.addEventListener("keydown", wecken);
  }

  // Ein Ton: Frequenz (auch gleitend), Hüllkurve, Wellenform
  function ton(hz, ab, dauer, o) {
    o = o || {};
    const t = ac.currentTime + ab, osz = ac.createOscillator(), g = ac.createGain();
    osz.type = o.typ || "sine";
    osz.frequency.setValueAtTime(hz, t);
    if (o.bis) osz.frequency.exponentialRampToValueAtTime(o.bis, t + dauer);
    if (o.verstimmt) osz.detune.value = o.verstimmt;
    const laut = o.laut == null ? 0.3 : o.laut, ein = o.an || 0.008;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(laut, t + ein);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    let ziel = haupt;
    if (o.filter) { const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.filter; f.connect(haupt); ziel = f; }
    osz.connect(g); g.connect(ziel);
    osz.start(t); osz.stop(t + dauer + 0.02);
  }
  // Rauschen durch einen Filter (Pappe, Wusch, Regen, Laken)
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
    if (o.halten) g.gain.setValueAtTime(laut, t + o.halten);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    q.connect(f); f.connect(g); g.connect(haupt);
    q.start(t, Math.random() * 1.5); q.stop(t + dauer + 0.02);
  }
  const akkord = (hzs, ab, dauer, o) => hzs.forEach(h => ton(h, ab, dauer, o));
  const zufall = (a, b) => a + Math.random() * (b - a);

  const KLANG = {
    // dumpfe Pappe: tiefer Schlag plus kurzes, tiefes Rauschen; st = Aufprallstärke 0..1
    plumps(st) {
      st = Math.max(0.05, Math.min(1, st == null ? 0.6 : st));
      ton(zufall(95, 125), 0, 0.12 + st * 0.1, { laut: 0.12 + st * 0.3, bis: 55 });
      zisch(0, 0.08 + st * 0.08, { hz: zufall(350, 500), art: "lowpass", q: 0.8, laut: 0.08 + st * 0.3 });
      if (st > 0.6) zisch(0.01, 0.05, { hz: 1600, q: 2, laut: 0.06 * st });
    },
    dreh() { ton(1800, 0, 0.03, { typ: "square", laut: 0.05, filter: 3500 }); ton(1200, 0.025, 0.03, { typ: "square", laut: 0.04, filter: 3000 }); },
    schieb() { ton(900, 0, 0.025, { typ: "triangle", laut: 0.04 }); },
    fall() { zisch(0, 0.25, { hz: 2500, bis: 500, q: 1.4, laut: 0.18, an: 0.03 }); },
    // Knarzen: rauer Sägezahn, leicht schwankende Tonhöhe, gefiltert
    knarz(st) {
      st = st == null ? 0.6 : Math.max(0.2, Math.min(1, st));
      const b = zufall(110, 160);
      for (let i = 0; i < 3; i++) ton(b * (1 + i * 0.07), i * 0.07, 0.11, { typ: "sawtooth", laut: 0.05 * st + 0.02, bis: b * zufall(0.8, 1.3), filter: 900 });
      zisch(0, 0.25, { hz: 700, q: 6, laut: 0.05 * st });
    },
    bruch() {
      ton(80, 0, 0.35, { laut: 0.35, bis: 38 });
      zisch(0, 0.35, { hz: 400, bis: 90, art: "lowpass", laut: 0.35 });
      for (let i = 0; i < 9; i++) {
        const h = zufall(2400, 6200), a = 0.03 + i * zufall(0.02, 0.05);
        ton(h, a, zufall(0.08, 0.25), { typ: "sine", laut: 0.07 });
        zisch(a, 0.06, { hz: h, q: 8, laut: 0.1 });
      }
    },
    // schief und laut: verstimmte Töne, harter Anschlag
    klavier() {
      const t = [130.8, 155.6, 185, 207.7, 261.6, 311.1];
      t.forEach((h, i) => {
        ton(h, i * 0.008, 1.6, { typ: "triangle", laut: 0.16, verstimmt: zufall(-45, 45), an: 0.005 });
        ton(h * 2, i * 0.008, 0.9, { typ: "sawtooth", laut: 0.03, verstimmt: zufall(-30, 30), filter: 1800 });
      });
      ton(65, 0, 0.6, { laut: 0.3, bis: 40 });
      zisch(0, 0.12, { hz: 300, art: "lowpass", laut: 0.25 });
    },
    miau() {
      ton(520, 0, 0.18, { typ: "sawtooth", laut: 0.09, bis: 820, filter: 2400, an: 0.04 });
      ton(820, 0.16, 0.35, { typ: "sawtooth", laut: 0.09, bis: 430, filter: 1800 });
      ton(1040, 0, 0.5, { typ: "sine", laut: 0.04, bis: 900 });
    },
    regen() {
      zisch(0, 2, { hz: 5000, art: "highpass", q: 0.5, laut: 0.12, an: 0.3, halten: 1.5 });
      zisch(0, 2, { hz: 900, q: 0.6, laut: 0.06, an: 0.3, halten: 1.5 });
      for (let i = 0; i < 14; i++) ton(zufall(1500, 3500), zufall(0, 1.8), 0.03, { laut: 0.03 });
    },
    laken() { for (let i = 0; i < 5; i++) zisch(i * 0.11, 0.1, { hz: zufall(500, 1000), q: 1, laut: 0.16, an: 0.03 }); },
    karte() { ton(988, 0, 0.12, { typ: "triangle", laut: 0.18 }); ton(1319, 0.08, 0.3, { typ: "triangle", laut: 0.18 }); ton(2637, 0.08, 0.2, { laut: 0.04 }); },
    // fieses Tröten: schräge Sägezähne abwärts
    gemein() {
      ton(330, 0, 0.22, { typ: "sawtooth", laut: 0.09, filter: 1500, verstimmt: 30 });
      ton(311, 0, 0.22, { typ: "sawtooth", laut: 0.09, filter: 1500 });
      ton(233, 0.22, 0.4, { typ: "sawtooth", laut: 0.1, bis: 175, filter: 1200 });
      ton(220, 0.22, 0.4, { typ: "square", laut: 0.05, bis: 165, filter: 900 });
    },
    hilfe() { [523, 659, 784, 1047].forEach((h, i) => ton(h, i * 0.06, 0.25, { typ: "triangle", laut: 0.15 })); },
    ziel() {
      [523, 659, 784].forEach((h, i) => ton(h, i * 0.09, 0.14, { typ: "square", laut: 0.06, filter: 2500 }));
      akkord([523, 784, 1047], 0.27, 0.5, { typ: "triangle", laut: 0.13 });
    },
    countdown() { ton(660, 0, 0.12, { typ: "square", laut: 0.07, filter: 2500 }); },
    start() { ton(1320, 0, 0.3, { typ: "square", laut: 0.08, filter: 3000 }); },
    sieg() {
      [392, 523, 659, 784].forEach((h, i) => ton(h, i * 0.12, 0.2, { typ: "sawtooth", laut: 0.08, filter: 2200 }));
      akkord([523, 659, 784, 1047], 0.5, 1.1, { typ: "triangle", laut: 0.13 });
    }
  };

  let zuletzt = {};
  W.SG_KLANG = {
    get an() { return an; },
    umschalten() {
      an = !an;
      try { W.localStorage.setItem("sg:ton", an ? "an" : "aus"); } catch (e) {}
      if (an && bereit()) { try { KLANG.dreh(); } catch (e) {} }
      return an;
    },
    // Derselbe Klang höchstens alle 50 ms, und nur, wenn das Handy den Tab zeigt
    spiel(name, staerke) {
      if (!an || !KLANG[name] || (W.document && W.document.visibilityState === "hidden")) return;
      const jetzt = Date.now();
      if (zuletzt[name] && jetzt - zuletzt[name] < 50) return;
      zuletzt[name] = jetzt;
      if (!bereit()) return;
      try { KLANG[name](staerke); } catch (e) {}
    },
    namen: Object.keys(KLANG)
  };
})(typeof window !== "undefined" ? window : globalThis);
