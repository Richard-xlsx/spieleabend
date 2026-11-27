// Tapetenwechsel: Klänge aus dem Synthesizer (Web Audio), keine Tondateien.
// TW_KLANG.spiel("name", staerke, pan) spielt einen Klang, TW_KLANG.an sagt, ob der Ton an ist (gespeichert im Handy unter "tw:ton").
// pan (-1 links … 1 rechts) wirkt beim Niesen („hatschi“), damit man hört, aus welcher Richtung es kommt.
(function (W) {
  let ac = null, haupt = null, rauschen = null;
  let an = true;
  try { an = W.localStorage ? W.localStorage.getItem("tw:ton") !== "aus" : true; } catch (e) {}

  function bereit() {
    if (!an) return null;
    try {
      if (!ac) {
        const AC = W.AudioContext || W.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        haupt = ac.createGain(); haupt.gain.value = 0.45;
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

  // Ein Ton: Frequenz (auch gleitend), Hüllkurve, Wellenform; o.ziel = eigener Ausgang (z. B. Panner)
  function ton(hz, ab, dauer, o) {
    o = o || {};
    const t = ac.currentTime + ab, osz = ac.createOscillator(), g = ac.createGain();
    osz.type = o.typ || "sine";
    osz.frequency.setValueAtTime(hz, t);
    if (o.bis) osz.frequency.exponentialRampToValueAtTime(o.bis, t + (o.gleit || dauer));
    if (o.verstimmt) osz.detune.value = o.verstimmt;
    const laut = o.laut == null ? 0.3 : o.laut, ein = o.an || 0.008;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, laut), t + ein);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    let ziel = o.ziel || haupt;
    if (o.filter) { const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.filter; f.connect(ziel); ziel = f; }
    osz.connect(g); g.connect(ziel);
    osz.start(t); osz.stop(t + dauer + 0.02);
  }
  // Rauschen durch einen Filter (Pinsel, Wusch, Schritt, Niesen)
  function zisch(ab, dauer, o) {
    o = o || {};
    const t = ac.currentTime + ab, q = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    q.buffer = rauschen; q.loop = true;
    f.type = o.art || "bandpass"; f.Q.value = o.q || 1.2;
    f.frequency.setValueAtTime(o.hz || 1200, t);
    if (o.bis) f.frequency.exponentialRampToValueAtTime(o.bis, t + dauer);
    const laut = o.laut == null ? 0.3 : o.laut;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, laut), t + (o.an || 0.01));
    if (o.halten) g.gain.setValueAtTime(laut, t + o.halten);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    q.connect(f); f.connect(g); g.connect(o.ziel || haupt);
    q.start(t, Math.random() * 1.5); q.stop(t + dauer + 0.02);
  }
  const akkord = (hzs, ab, dauer, o) => hzs.forEach(h => ton(h, ab, dauer, o));
  const zufall = (a, b) => a + Math.random() * (b - a);
  const klemme = (x, a, b, d) => Math.max(a, Math.min(b, x == null || isNaN(x) ? d : x));
  // Ausgang mit Stereo-Richtung (fällt ohne StereoPanner auf die Mitte zurück)
  function richtung(pan) {
    if (!ac.createStereoPanner) return haupt;
    const p = ac.createStereoPanner(); p.pan.value = klemme(+pan, -1, 1, 0); p.connect(haupt);
    return p;
  }

  const KLANG = {
    // weiches Patschen: Ton fällt nach unten, dazu ein dumpfes Rauschen
    hupf(st) {
      st = klemme(st, 0.2, 1, 0.7);
      ton(zufall(300, 360), 0, 0.14, { laut: 0.16 * st, bis: 140 });
      ton(zufall(620, 700), 0.005, 0.06, { typ: "triangle", laut: 0.05 * st, bis: 300 });
      zisch(0.03, 0.08, { hz: 500, art: "lowpass", q: 0.7, laut: 0.12 * st });
    },
    // Gummi-Quietschen beim Kneten: kurzer, schwankender Ton
    quietsch(st) {
      st = klemme(st, 0.2, 1, 0.6);
      const b = zufall(700, 1100);
      ton(b, 0, 0.12, { typ: "triangle", laut: 0.06 * st + 0.02, bis: b * zufall(1.25, 1.6), filter: 3000 });
      ton(b * 2.02, 0, 0.09, { laut: 0.015 * st, bis: b * 2.6 });
    },
    // Pinselstrich: ganz kurzes, weiches Rauschen
    pinsel(st) {
      st = klemme(st, 0.2, 1, 0.5);
      const h = zufall(2200, 3600);
      zisch(0, 0.07, { hz: h, bis: h * 0.7, q: 0.9, laut: 0.035 * st + 0.01, an: 0.02 });
    },
    // Pipette: Plopp nach oben
    plopp() {
      ton(420, 0, 0.09, { laut: 0.2, bis: 1100, gleit: 0.06 });
      ton(1400, 0.05, 0.05, { typ: "triangle", laut: 0.04 });
    },
    // Eimer: Farbe gluckert heraus und klatscht auf
    eimer() {
      for (let i = 0; i < 4; i++) ton(zufall(250, 420), i * 0.05, 0.07, { laut: 0.1, bis: zufall(500, 800) });
      zisch(0.18, 0.3, { hz: 900, bis: 300, art: "lowpass", q: 0.6, laut: 0.22, an: 0.01 });
      ton(150, 0.18, 0.18, { laut: 0.15, bis: 80 });
    },
    // Rückgängig: kleiner Pieps nach unten
    rueck() { ton(880, 0, 0.06, { typ: "triangle", laut: 0.1 }); ton(620, 0.05, 0.08, { typ: "triangle", laut: 0.09 }); },
    // Uhr in den letzten 10 Sekunden
    tick() { ton(2600, 0, 0.025, { typ: "square", laut: 0.035, filter: 4500 }); zisch(0, 0.02, { hz: 4000, q: 4, laut: 0.04 }); },
    // „Ich komme!“: drei steigende Töne und ein heller Schluss
    start() {
      [392, 494, 587].forEach((h, i) => ton(h, i * 0.13, 0.16, { typ: "square", laut: 0.05, filter: 2400 }));
      akkord([784, 988, 1175], 0.42, 0.55, { typ: "triangle", laut: 0.1 });
      ton(784, 0.42, 0.55, { typ: "sine", laut: 0.05, bis: 830 });
    },
    // Fertig: zwei freundliche Töne
    fertig() { ton(659, 0, 0.14, { typ: "triangle", laut: 0.14 }); ton(988, 0.1, 0.3, { typ: "triangle", laut: 0.14 }); },
    // Herzschlag „ba-bumm“; st = Lautstärke 0..1
    herz(st) {
      st = klemme(st, 0, 1, 0.6);
      if (st < 0.02) return;
      ton(62, 0, 0.13, { laut: 0.45 * st, bis: 42, an: 0.012, filter: 300 });
      ton(55, 0.17, 0.2, { laut: 0.55 * st, bis: 36, an: 0.012, filter: 260 });
    },
    // Niesen: Einatmen („ha-“) und plötzliches Rauschen („tschi!“), mit Richtung
    hatschi(st, pan) {
      st = klemme(st, 0.1, 1, 0.8);
      const z = richtung(pan);
      zisch(0, 0.32, { hz: 900, bis: 1800, q: 2, laut: 0.06 * st, an: 0.25, ziel: z });
      ton(zufall(330, 390), 0.06, 0.26, { typ: "sawtooth", laut: 0.03 * st, bis: zufall(520, 600), filter: 1300, an: 0.15, ziel: z });
      zisch(0.34, 0.28, { hz: 5200, bis: 2600, q: 0.8, laut: 0.3 * st, an: 0.006, ziel: z });
      zisch(0.34, 0.16, { hz: 1500, bis: 700, q: 1.5, laut: 0.12 * st, an: 0.006, ziel: z });
      ton(zufall(240, 280), 0.34, 0.12, { typ: "triangle", laut: 0.05 * st, bis: 160, ziel: z });
    },
    // Kuckucksuhr: zwei Töne (große Terz abwärts) mit Holz-Klick
    kuckuck() {
      zisch(0, 0.02, { hz: 2000, q: 3, laut: 0.06 });
      const ruf = (h, a) => { ton(h, a, 0.26, { typ: "triangle", laut: 0.16, an: 0.02 }); ton(h * 2, a, 0.18, { laut: 0.03, an: 0.02 }); };
      ruf(784, 0.03); ruf(622, 0.33);
    },
    // daneben: weiches „Bonk“ und ein wenig Nebel
    daneben() {
      ton(220, 0, 0.18, { typ: "triangle", laut: 0.14, bis: 150, filter: 900 });
      zisch(0.02, 0.35, { hz: 1200, bis: 600, q: 0.6, laut: 0.05, an: 0.08 });
    },
    // jemand anderes hat einen Klecks gefunden: kurzes Glöckchen
    gefunden() { ton(1319, 0, 0.35, { laut: 0.08 }); ton(1760, 0.07, 0.4, { laut: 0.06 }); ton(2637, 0.07, 0.2, { laut: 0.02 }); },
    // leiser Schritt
    schritt(st) {
      st = klemme(st, 0.1, 1, 0.5);
      zisch(0, 0.07, { hz: zufall(280, 420), art: "lowpass", q: 0.8, laut: 0.06 * st });
      ton(zufall(80, 100), 0, 0.06, { laut: 0.05 * st, bis: 60 });
    },
    sieg() {
      [392, 523, 659, 784].forEach((h, i) => ton(h, i * 0.12, 0.2, { typ: "sawtooth", laut: 0.07, filter: 2200 }));
      akkord([523, 659, 784, 1047], 0.5, 1.1, { typ: "triangle", laut: 0.12 });
    },
    // Auflösung: Wusch, wenn die Kamera zum Versteck fliegt
    zeigen() {
      zisch(0, 0.5, { hz: 400, bis: 2400, q: 1.1, laut: 0.12, an: 0.2 });
      ton(1568, 0.42, 0.25, { laut: 0.04 });
    }
  };

  // Mindestabstand je Klang (ms); Pinsel und Schritte kommen sehr oft
  const ABSTAND = { pinsel: 83, schritt: 220, quietsch: 90, tick: 300 };
  let zuletzt = {};
  W.TW_KLANG = {
    get an() { return an; },
    umschalten() {
      an = !an;
      try { W.localStorage.setItem("tw:ton", an ? "an" : "aus"); } catch (e) {}
      if (an && bereit()) { try { KLANG.plopp(); } catch (e) {} }
      return an;
    },
    // Derselbe Klang höchstens alle 50 ms (Pinsel ~12-mal pro Sekunde), und nur, wenn das Handy den Tab zeigt
    spiel(name, staerke, pan) {
      if (!an || !KLANG[name] || (W.document && W.document.visibilityState === "hidden")) return;
      const jetzt = Date.now();
      if (zuletzt[name] && jetzt - zuletzt[name] < (ABSTAND[name] || 50)) return;
      zuletzt[name] = jetzt;
      if (!bereit()) return;
      try { KLANG[name](staerke, pan); } catch (e) {}
    },
    namen: Object.keys(KLANG)
  };
})(typeof window !== "undefined" ? window : globalThis);
