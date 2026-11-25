// Orbit: gemeinsame Technik für Live-Missionen.
//   Spielleiter: sammelt die letzte Eingabe jedes Handys (20-mal pro Sekunde), rechnet 30-mal pro Sekunde
//   (RM.liveSchritt) und schickt 15-mal pro Sekunde ein Bild (RM.liveBild). Die eigene Eingabe des Spielleiters
//   wird um die halbe mittlere Laufzeit der anderen verzögert, damit er keinen Vorteil hat.
//   Handys: puffern die Bilder und zeichnen etwas in der Vergangenheit (glatt zwischen zwei Bildern); die eigene Figur
//   wird nach vorn gerechnet, damit die Steuerung nicht hinterherhinkt.
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  const L = W.ORBIT_LIVE = {};
  const VERZUG = 100;   // so weit zeichnen die Handys in der Vergangenheit (ms)
  const zahl = v => { v = +v; return isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0; };

  // ---------- Spielleiter ----------
  let eingang = {}, laufzeit = {}, eigene = [];
  L.eingang = (pid, m) => {
    eingang[pid] = { x: zahl(m.x), y: zahl(m.y), k: m.k | 0 };
    if (m.l > 0 && m.l < 3000) laufzeit[pid] = m.l;
  };
  L.verzoegerung = () => {
    const l = Object.values(laufzeit);
    return l.length ? Math.min(250, l.reduce((a, b) => a + b, 0) / l.length / 2) : 0;
  };
  L.eigeneEingabe = (pid, e, jetzt) => {
    eigene.push({ t: jetzt, pid, e: { x: zahl(e.x), y: zahl(e.y), k: e.k | 0 } });
    while (eigene.length > 2 && eigene[1].t <= jetzt - 1000) eigene.shift();
  };
  L.eingaben = jetzt => {
    const out = Object.assign({}, eingang), grenze = jetzt - L.verzoegerung();
    for (const x of eigene) if (x.t <= grenze) out[x.pid] = x.e;
    return out;
  };
  L.leeren = () => { eingang = {}; eigene = []; };

  // ---------- Handys ----------
  let puffer = [], nr = null;
  L.empfang = (missionNr, bild, h) => {
    if (missionNr !== nr) { puffer = []; nr = missionNr; }
    if (puffer.length && h <= puffer[puffer.length - 1].h) return;
    puffer.push({ h, b: bild });
    if (puffer.length > 30) puffer.shift();
  };
  // Zwei Bilder um den Zeitpunkt t und der Anteil f dazwischen
  L.zwischen = (missionNr, jetzt) => {
    if (missionNr !== nr || !puffer.length) return null;
    const t = jetzt - VERZUG;
    let i = puffer.length - 1;
    while (i > 0 && puffer[i - 1].h > t) i--;
    const a = puffer[Math.max(0, i - 1)], b = puffer[i];
    if (t >= b.h || a === b) return { a: b.b, b: b.b, f: 0, letztes: puffer[puffer.length - 1] };
    return { a: a.b, b: b.b, f: Math.max(0, Math.min(1, (t - a.h) / (b.h - a.h))), letztes: puffer[puffer.length - 1] };
  };
  L.mix = (a, b, f) => a + (b - a) * f;

  // Aktionsknopf (Rammen, Öl …): ein Zähler, damit kein Druck verloren geht
  let k = 0;
  L.druck = () => { k += 1; };
  L.eingabe = () => {
    const r = W.ORBIT_SENSOR ? W.ORBIT_SENSOR.richtung() : { x: 0, y: 0 };
    return { x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100, k };
  };
})();
