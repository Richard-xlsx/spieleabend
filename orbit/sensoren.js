// Orbit: Sensoren am Handy. Erlaubnis (iOS fragt nur nach einem Tippen), Nullstellung, Neigen, Schütteln, Wischen
// und der Daumen-Ersatz (Joystick zum Ziehen, am Rechner auch Pfeiltasten) für Handys ohne Sensor oder ohne Erlaubnis.
//   ORBIT_SENSOR.erlauben()      → Promise<bool>, im Klick aufrufen
//   ORBIT_SENSOR.nullen()        aktuelle Haltung gilt als „gerade“
//   ORBIT_SENSOR.richtung()      → { x, y } von −1 bis 1 (rechts/unten positiv), je nach Modus aus Neigung oder Daumen
//   ORBIT_SENSOR.modus / setzeModus("neigen"|"daumen"), hatNeigung()
//   ORBIT_SENSOR.beiSchuetteln(fn) → Abmelden-Funktion
//   ORBIT_SENSOR.daumen(el)      macht el zum Joystick
//   ORBIT_SENSOR.wischen(el, fn) fn({ dx, dy, v }) nach einem Wisch
//   ORBIT_SENSOR.lenkknopf(el, −1|1), knopfRichtung() → { x, y: 0 } nur aus Lenkknöpfen und Pfeiltasten
//   ORBIT_SENSOR.daumenRichtung() → { x, y } nur aus Joystick und Pfeiltasten
(function () {
  const W = window;
  const MAXGRAD = 22, TOT = 0.08;
  let roh = null, null0 = null, letzteNeigung = 0, erlaubt = null;
  let modus = null;
  try { modus = localStorage.getItem("ob:steuerung"); } catch (e) {}
  const daumenWert = { x: 0, y: 0 }, tasten = { l: 0, r: 0, o: 0, u: 0 };

  function winkel() { try { return (screen.orientation && screen.orientation.angle) || W.orientation || 0; } catch (e) { return 0; } }
  W.addEventListener("deviceorientation", e => {
    if (e.beta == null || e.gamma == null) return;
    roh = { b: e.beta, g: e.gamma }; letzteNeigung = Date.now();
    if (!null0) null0 = { b: Math.max(10, Math.min(70, e.beta)), g: 0 };
  });
  const hatNeigung = () => Date.now() - letzteNeigung < 1500;

  async function erlauben() {
    let ok = true;
    try {
      if (W.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") ok = (await DeviceOrientationEvent.requestPermission()) === "granted";
      if (W.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === "function") ok = ((await DeviceMotionEvent.requestPermission()) === "granted") && ok;
    } catch (e) { ok = false; }
    erlaubt = ok;
    return ok;
  }
  const brauchtErlaubnis = () => erlaubt === null && !!(W.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function");
  function nullen() { if (roh) null0 = { b: roh.b, g: roh.g }; }

  function begrenzen(v) {
    const l = Math.hypot(v.x, v.y);
    if (l < TOT) return { x: 0, y: 0 };
    const f = Math.min(1, (l - TOT) / (1 - TOT)) / l;
    return { x: v.x * f, y: v.y * f };
  }
  function neigung() {
    if (!roh || !null0) return { x: 0, y: 0 };
    const g = (roh.g - null0.g) / MAXGRAD, b = (roh.b - null0.b) / MAXGRAD;
    const a = ((winkel() % 360) + 360) % 360;
    const v = a === 90 ? { x: b, y: -g } : a === 270 ? { x: -b, y: g } : a === 180 ? { x: -g, y: -b } : { x: g, y: b };
    return begrenzen({ x: Math.max(-1, Math.min(1, v.x)), y: Math.max(-1, Math.min(1, v.y)) });
  }
  const aktuellerModus = () => modus || (hatNeigung() ? "neigen" : "daumen");
  function richtung() {
    const t = { x: tasten.r - tasten.l, y: tasten.u - tasten.o };
    if (t.x || t.y) { const l = Math.hypot(t.x, t.y); return { x: t.x / l, y: t.y / l }; }
    if (aktuellerModus() === "neigen" && hatNeigung()) return neigung();
    return begrenzen(daumenWert);
  }
  // Lenkknöpfe (links/rechts gedrückt halten), am Rechner auch Pfeiltasten. Ohne Neigung und Joystick.
  const knoepfe = new Map();   // pointerId → −1 | 1
  // Nur Joystick und Pfeiltasten (Gestaltwandler: feine Steuerung mit dem Daumen)
  function daumenRichtung() {
    const t = { x: tasten.r - tasten.l, y: tasten.u - tasten.o };
    if (t.x || t.y) { const l = Math.hypot(t.x, t.y); return { x: t.x / l, y: t.y / l }; }
    return begrenzen(daumenWert);
  }
  function knopfRichtung() {
    let x = tasten.r - tasten.l;
    for (const v of knoepfe.values()) x += v;
    return { x: Math.max(-1, Math.min(1, x)), y: 0 };
  }
  function lenkknopf(el, v) {
    if (!el || el.dataset.lenkknopf) return;
    el.dataset.lenkknopf = "1";
    el.addEventListener("pointerdown", e => { knoepfe.set(e.pointerId, v); el.classList.add("gedrueckt"); e.preventDefault(); });
    el.addEventListener("contextmenu", e => e.preventDefault());
  }
  function knopfLos(e) { if (knoepfe.delete(e.pointerId)) document.querySelectorAll(".lenkknopf.gedrueckt").forEach(k => k.classList.remove("gedrueckt")); }
  W.addEventListener("pointerup", knopfLos); W.addEventListener("pointercancel", knopfLos);
  W.addEventListener("blur", () => { knoepfe.clear(); });
  function setzeModus(m) { modus = m; try { localStorage.setItem("ob:steuerung", m); } catch (e) {} if (m === "neigen") nullen(); }

  // Pfeiltasten und WASD am Rechner
  const TASTE = { ArrowLeft: "l", a: "l", ArrowRight: "r", d: "r", ArrowUp: "o", w: "o", ArrowDown: "u", s: "u" };
  W.addEventListener("keydown", e => { const k = TASTE[e.key]; if (k && !/INPUT|TEXTAREA/.test(e.target.tagName)) { tasten[k] = 1; e.preventDefault(); } });
  W.addEventListener("keyup", e => { const k = TASTE[e.key]; if (k) tasten[k] = 0; });
  W.addEventListener("blur", () => { tasten.l = tasten.r = tasten.o = tasten.u = 0; });

  // Schütteln: starke Änderung der Beschleunigung zweimal kurz hintereinander
  const schuettler = new Set();
  let vorher = null, stoss = 0, letzterSchuettel = 0;
  W.addEventListener("devicemotion", e => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    if (vorher) {
      const d = Math.abs(a.x - vorher.x) + Math.abs(a.y - vorher.y) + Math.abs(a.z - vorher.z), jetzt = Date.now();
      if (d > 28) {
        if (jetzt - stoss < 450 && jetzt - letzterSchuettel > 900) { letzterSchuettel = jetzt; schuettler.forEach(fn => { try { fn(); } catch (x) {} }); }
        stoss = jetzt;
      }
    }
    vorher = { x: a.x, y: a.y, z: a.z };
  });
  function beiSchuetteln(fn) { schuettler.add(fn); return () => schuettler.delete(fn); }

  // Daumen-Ersatz: Ziehen auf der Fläche wirkt wie ein Joystick um ihre Mitte. Bewegung und Loslassen hören am Fenster
  // mit, damit der Finger weiter wirkt, auch wenn die Fläche zwischendurch neu gezeichnet wird.
  let finger = null;   // { id, x, y, r }
  function zeigeKnauf() { document.querySelectorAll(".daumenfeld .knauf").forEach(k => { k.style.transform = `translate(${daumenWert.x * 38}px, ${daumenWert.y * 38}px)`; }); }
  function daumenZiehen(e) {
    if (!finger || e.pointerId !== finger.id) return;
    let x = (e.clientX - finger.x) / finger.r, y = (e.clientY - finger.y) / finger.r; const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    daumenWert.x = x; daumenWert.y = y; zeigeKnauf();
  }
  function daumenLos(e) { if (e && finger && e.pointerId !== finger.id) return; finger = null; daumenWert.x = daumenWert.y = 0; zeigeKnauf(); }
  W.addEventListener("pointermove", daumenZiehen, { passive: true });
  W.addEventListener("pointerup", daumenLos); W.addEventListener("pointercancel", daumenLos);
  function daumen(el) {
    if (!el || el.dataset.daumen) return;
    el.dataset.daumen = "1";
    el.addEventListener("pointerdown", e => {
      const r = el.getBoundingClientRect();
      finger = { id: e.pointerId, x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(30, r.width / 2.6) };
      daumenZiehen(e); e.preventDefault();
    });
    zeigeKnauf();
  }

  function wischen(el, fn) {
    if (!el) return;
    let s = null;
    el.addEventListener("pointerdown", e => { s = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener("pointerup", e => {
      if (!s) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y, dt = Math.max(16, performance.now() - s.t); s = null;
      if (Math.hypot(dx, dy) > 30) fn({ dx, dy, v: Math.hypot(dx, dy) / dt });
    });
  }

  W.ORBIT_SENSOR = {
    erlauben, brauchtErlaubnis, nullen, neigung, richtung, knopfRichtung, daumenRichtung, lenkknopf, hatNeigung, beiSchuetteln, daumen, wischen, setzeModus,
    get modus() { return aktuellerModus(); }, get erlaubt() { return erlaubt; }
  };
})();
