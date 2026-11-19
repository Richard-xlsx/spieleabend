// Gemeinsame Malhilfen für Pinselpost, Malalarm und Umschreiben:
// eine feste Farbleiste (nach Farbkreis sortiert) und Zoomen mit zwei Fingern auf Mal- und Anzeigeflächen.
// Striche speichern den Farbcode (#RRGGBB); alte Striche mit Farbnummer zeichnet jedes Spiel mit seiner alten Liste.
(function () {
  const FARBEN = [
    ["#F2B705", "Gelb"], ["#F97316", "Orange"], ["#E23B2E", "Rot"], ["#E86FB0", "Rosa"], ["#8B5CF6", "Lila"],
    ["#2F6FDE", "Blau"], ["#38BDF8", "Hellblau"], ["#2E9B4F", "Grün"], ["#84CC16", "Hellgrün"], ["#8B5A2B", "Braun"],
    ["#F1C27D", "Beige"], ["#9CA3AF", "Grau"], ["#16161D", "Schwarz"], ["#FFFFFF", "Radiergummi"]];
  const STANDARD = "#16161D";
  const esc = s => String(s).replace(/"/g, "&quot;");

  let stilDa = false;
  function stil() {
    if (stilDa) return; stilDa = true;
    const s = document.createElement("style");
    s.textContent = `.farbleiste{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;justify-items:center}
.farbleiste .farbe{width:38px;height:38px;max-width:100%}
.zoombar{position:relative;overflow:hidden}
.zoombar canvas{touch-action:none}
.ganzesbild{position:absolute;right:8px;top:8px;z-index:2;appearance:none;border:0;border-radius:999px;padding:6px 12px;font:600 .8rem system-ui,sans-serif;background:rgba(22,22,29,.78);color:#fff;cursor:pointer}
.ganzesbild[hidden]{display:none}`;
    document.head.appendChild(s);
  }

  // Farbknöpfe; aktiv = gewählter Farbcode
  function farbKnoepfe(aktiv) {
    stil();
    return `<div class="farbleiste">${FARBEN.map(([f, n]) => `<button type="button" class="farbe ${String(aktiv).toUpperCase() === f ? "an" : ""}" data-farbe="${f}" style="background:${f}" aria-label="${esc(n)}" title="${esc(n)}">${n === "Radiergummi" ? "⌫" : ""}</button>`).join("")}</div>`;
  }
  // Klicks auf die Farbknöpfe verbinden; waehle(f) bekommt den Farbcode
  function farbenBinden(waehle) {
    document.querySelectorAll(".farbleiste [data-farbe]").forEach(b => b.onclick = () => {
      document.querySelectorAll(".farbleiste [data-farbe]").forEach(x => x.classList.toggle("an", x === b));
      waehle(b.dataset.farbe);
    });
  }

  // Zoomen: zwei Finger vergrößern und verschieben. Auf reinen Anzeigeflächen (malen: false) verschiebt ein Finger
  // das vergrößerte Bild; ist es nicht vergrößert, scrollt ein Finger die Seite wie gewohnt.
  // o.key: Ansicht bleibt für dieses Bild erhalten, auch wenn die Fläche neu gebaut wird
  // o.neu(): Bild in der aktuellen Leinwandgröße neu zeichnen; o.abbrechen(): angefangenen Strich verwerfen
  const ansichten = new Map();
  function zoom(box, cv, o) {
    stil();
    o = o || {};
    const key = String(o.key || "");
    let a = ansichten.get(key);
    if (!a) { a = { z: 1, x: 0, y: 0 }; ansichten.set(key, a); if (ansichten.size > 30) ansichten.delete(ansichten.keys().next().value); }
    const breite = parseFloat(cv.style.width) || cv.clientWidth, hoehe = parseFloat(cv.style.height) || cv.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    box.classList.add("zoombar");
    let knopf = box.querySelector(".ganzesbild");
    if (!knopf) { knopf = document.createElement("button"); knopf.type = "button"; knopf.className = "ganzesbild"; knopf.textContent = "Ganzes Bild"; box.appendChild(knopf); }
    cv.style.transformOrigin = "0 0";
    const begrenzen = () => {
      a.x = Math.min(0, Math.max(breite - breite * a.z, a.x));
      a.y = Math.min(0, Math.max(hoehe - hoehe * a.z, a.y));
    };
    const zeigen = () => { cv.style.transform = `translate(${a.x}px,${a.y}px) scale(${a.z})`; knopf.hidden = a.z <= 1.01; };
    const schaerfen = () => {                  // nach dem Zoomen in passender Auflösung neu zeichnen
      const f = Math.min(4, dpr * a.z), w = Math.round(breite * f), h = Math.round(hoehe * f);
      if (cv.width !== w) { cv.width = w; cv.height = h; if (o.neu) o.neu(); }
    };
    knopf.onclick = ev => { ev.stopPropagation(); a.z = 1; a.x = 0; a.y = 0; zeigen(); schaerfen(); };
    const finger = new Map(); let zwick = null, schieben = null, gesperrt = false;
    const mitte = () => {
      const [p, q] = [...finger.values()], r = box.getBoundingClientRect();
      return { x: (p.x + q.x) / 2 - r.left, y: (p.y + q.y) / 2 - r.top, d: Math.hypot(p.x - q.x, p.y - q.y) || 1 };
    };
    box.addEventListener("gesturestart", ev => ev.preventDefault());
    cv.addEventListener("pointerdown", ev => {
      if (ev.pointerType === "mouse") return;
      finger.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (finger.size === 2) {
        ev.preventDefault();
        if (o.abbrechen) o.abbrechen();
        zwick = { m: mitte(), z: a.z, x: a.x, y: a.y }; schieben = null; gesperrt = true;
      } else if (finger.size === 1 && !o.malen) {
        schieben = { sx: ev.clientX, sy: ev.clientY, x: a.x, y: a.y, scroll: window.scrollY };
      }
    });
    cv.addEventListener("pointermove", ev => {
      if (!finger.has(ev.pointerId)) return;
      finger.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (zwick && finger.size >= 2) {
        ev.preventDefault();
        const m = mitte(), z = Math.max(1, Math.min(4, zwick.z * m.d / zwick.m.d));
        const cx = (zwick.m.x - zwick.x) / zwick.z, cy = (zwick.m.y - zwick.y) / zwick.z;   // Punkt unter den Fingern bleibt dort
        a.z = z; a.x = m.x - cx * z; a.y = m.y - cy * z; begrenzen(); zeigen();
      } else if (schieben && finger.size === 1) {
        ev.preventDefault();
        const dx = ev.clientX - schieben.sx, dy = ev.clientY - schieben.sy;
        if (a.z > 1.01) { a.x = schieben.x + dx; a.y = schieben.y + dy; begrenzen(); zeigen(); }
        else window.scrollTo(0, schieben.scroll - dy);   // nicht vergrößert: Seite scrollen wie sonst
      }
    });
    const ende = ev => {
      if (!finger.has(ev.pointerId)) return;
      finger.delete(ev.pointerId);
      if (zwick && finger.size < 2) { zwick = null; schaerfen(); }
      if (!finger.size) { gesperrt = false; schieben = null; }
    };
    cv.addEventListener("pointerup", ende); cv.addEventListener("pointercancel", ende);
    zeigen(); schaerfen();
    return { gesperrt: () => gesperrt || finger.size > 1, get z() { return a.z; } };
  }

  window.MALHILFE = { FARBEN, STANDARD, farbKnoepfe, farbenBinden, zoom };
})();
