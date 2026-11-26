// Orbit: Probierfeld in der Anleitung. Solange die Anleitung offen ist, kann man die Steuerung der Mission schon testen:
// Neigen (Kugel rollt, gleich mit Nullstellung), Daumen (Joystick), Wischen (Puck fliegt), Ziehen (Block schieben),
// Tippen links/rechts (Schiff fährt) und Tippen (Ringe). Der Zustand überlebt das Neuzeichnen der Anleitung.
//   ORBIT_PROBIER.html(eingabe) → HTML, ORBIT_PROBIER.binden(eingabe) nach dem Einsetzen ins DOM
(function () {
  const W = window, SN = W.ORBIT_SENSOR;
  const BR = 300, HO = 130;          // Zeichenfläche in CSS-Pixeln (wird skaliert)
  const z = { x: BR / 2, y: HO / 2, vx: 0, vy: 0, ringe: [], tipps: 0, art: "", block: BR / 2, zieht: false };
  const arten = e => {
    e = e || "";
    return { neigen: /Neigen/.test(e), daumen: /Daumen/.test(e), wischen: /Wischen/.test(e), ziehen: /Ziehen/.test(e),
      lr: /links\/rechts/.test(e), tippen: /Tippen/.test(e) && !/links\/rechts/.test(e) };
  };
  function html(eingabe) {
    const a = arten(eingabe), daumenModus = a.daumen && !a.neigen || (a.neigen && SN && SN.modus === "daumen");
    const hinweis = a.lr ? "Halte links oder rechts gedrückt" : a.wischen ? "Wische über das Feld" : a.ziehen ? "Zieh den Block hin und her"
      : a.neigen && !daumenModus ? "Neige das Handy" + (a.tippen ? ", tippe aufs Feld" : "") : a.neigen || a.daumen ? "Zieh am Daumenfeld" + (a.tippen ? ", tippe aufs Feld" : "") : "Tippe aufs Feld";
    return `<div class="probier"><p class="etikett">Probier es aus · ${hinweis}</p>
      <canvas id="probierfeld" class="probierfeld" width="${BR * 2}" height="${HO * 2}" aria-label="Probierfeld: ${hinweis}"></canvas>
      ${daumenModus ? `<div class="probierleiste"><div class="daumenfeld klein" id="probierdaumen"><div class="knauf"></div></div>
        ${a.neigen ? `<button class="link" id="probierNeigen">Lieber neigen</button>` : ""}</div>` : ""}
      ${a.neigen && !daumenModus ? `<div class="probierleiste">${SN && SN.brauchtErlaubnis() ? `<button class="knopf zweit klein-knopf" id="probierErlauben">Neigen erlauben</button>` : ""}<button class="link" id="probierNull">Gerade halten = Mitte</button><button class="link" id="probierDaumen">Lieber Daumen</button></div>` : ""}
      ${a.lr ? `<div class="lenkknoepfe probierlenk"><button class="lenkknopf" id="probierL" aria-label="links"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button class="lenkknopf" id="probierR" aria-label="rechts"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>` : ""}
    </div>`;
  }
  let neu = null;
  function binden(eingabe, neuZeichnen) {
    const cv = document.getElementById("probierfeld");
    if (!cv) return;
    neu = neuZeichnen;
    const a = arten(eingabe);
    if (z.art !== eingabe) Object.assign(z, { art: eingabe, x: BR / 2, y: HO / 2, vx: 0, vy: 0, ringe: [], tipps: 0, block: BR / 2 });
    const $ = id => document.getElementById(id);
    if (SN && $("probierdaumen")) SN.daumen($("probierdaumen"));
    if (SN && $("probierL")) { SN.lenkknopf($("probierL"), -1); SN.lenkknopf($("probierR"), 1); }
    if ($("probierErlauben")) $("probierErlauben").onclick = async () => { await SN.erlauben(); SN.setzeModus("neigen"); if (neu) neu(); };
    if ($("probierNull")) $("probierNull").onclick = () => { SN.nullen(); z.vx = z.vy = 0; z.x = BR / 2; z.y = HO / 2; };
    if ($("probierDaumen")) $("probierDaumen").onclick = () => { SN.setzeModus("daumen"); if (neu) neu(); };
    if ($("probierNeigen")) $("probierNeigen").onclick = async () => { if (SN.brauchtErlaubnis()) await SN.erlauben(); SN.setzeModus("neigen"); if (neu) neu(); };
    const punkt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * BR, (e.clientY - r.top) / r.height * HO]; };
    if (a.tippen) cv.onpointerdown = e => { const [x, y] = punkt(e); z.ringe.push({ x, y, t: performance.now() }); z.tipps++; if (W.ORBIT_KLANG) W.ORBIT_KLANG.spiel("tipp"); };
    if (a.wischen && SN) SN.wischen(cv, w => { const r = cv.getBoundingClientRect(), f = BR / r.width; z.x = BR / 2; z.y = HO - 18; z.vx = w.dx * f * 0.06 * Math.min(3, w.v); z.vy = w.dy * f * 0.06 * Math.min(3, w.v); if (W.ORBIT_KLANG) W.ORBIT_KLANG.spiel("wurf"); });
    if (a.ziehen) {
      cv.onpointerdown = e => { z.zieht = true; cv.setPointerCapture(e.pointerId); z.block = punkt(e)[0]; };
      cv.onpointermove = e => { if (z.zieht) z.block = Math.max(20, Math.min(BR - 20, punkt(e)[0])); };
      cv.onpointerup = cv.onpointercancel = () => { z.zieht = false; };
    }
  }
  let zuletzt = performance.now();
  function bild(jetzt) {
    requestAnimationFrame(bild);
    const cv = document.getElementById("probierfeld"), dt = Math.min(0.05, (jetzt - zuletzt) / 1000); zuletzt = jetzt;
    if (!cv) return;
    const a = arten(z.art), g = cv.getContext("2d");
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, BR, HO);
    // Kugel: Neigen/Daumen beschleunigen, Wischen schiebt an, alles mit Reibung und Bande
    if (a.neigen || a.daumen) {
      const r = !SN ? { x: 0, y: 0 } : a.daumen && !a.neigen ? SN.daumenRichtung() : SN.richtung();
      z.vx += r.x * 520 * dt; z.vy += r.y * 520 * dt; z.vx *= 0.96; z.vy *= 0.96;
    } else if (a.lr) {
      const r = SN ? SN.knopfRichtung() : { x: 0 };
      z.vx += r.x * 700 * dt; z.vx *= 0.9; z.y = HO / 2 + 10; z.vy = 0;
    } else if (a.wischen) { z.vx *= 0.985; z.vy *= 0.985; }
    if (a.neigen || a.daumen || a.lr || a.wischen) {
      z.x += z.vx * dt; z.y += z.vy * dt;
      if (z.x < 12) { z.x = 12; z.vx = Math.abs(z.vx) * 0.6; } if (z.x > BR - 12) { z.x = BR - 12; z.vx = -Math.abs(z.vx) * 0.6; }
      if (z.y < 12) { z.y = 12; z.vy = Math.abs(z.vy) * 0.6; } if (z.y > HO - 12) { z.y = HO - 12; z.vy = -Math.abs(z.vy) * 0.6; }
    }
    // Feld
    g.strokeStyle = "#2A3568"; g.lineWidth = 1; g.setLineDash([3, 5]);
    g.beginPath(); g.moveTo(BR / 2, 8); g.lineTo(BR / 2, HO - 8); g.moveTo(8, HO / 2); g.lineTo(BR - 8, HO / 2); g.stroke(); g.setLineDash([]);
    if (a.ziehen) {
      g.fillStyle = "#9AA7D1"; g.fillRect(16, HO - 16, BR - 32, 5);
      g.fillStyle = "#FFD23F"; g.strokeStyle = "#060A1C"; g.lineWidth = 2;
      g.beginPath(); g.roundRect ? g.roundRect(z.block - 22, HO - 46, 44, 28, 5) : g.rect(z.block - 22, HO - 46, 44, 28); g.fill(); g.stroke();
    }
    if (a.neigen || a.daumen || a.wischen) {
      g.fillStyle = a.wischen ? "#EAF2FF" : "#FF7A2F"; g.strokeStyle = "#060A1C"; g.lineWidth = 2;
      g.beginPath(); g.arc(z.x, z.y, 11, 0, 7); g.fill(); g.stroke();
    }
    if (a.lr) {
      g.fillStyle = "#2EC4B6"; g.strokeStyle = "#060A1C"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(z.x, z.y - 16); g.lineTo(z.x + 12, z.y + 10); g.lineTo(z.x - 12, z.y + 10); g.closePath(); g.fill(); g.stroke();
    }
    if (a.tippen) {
      z.ringe = z.ringe.filter(r => jetzt - r.t < 700);
      for (const r of z.ringe) { const k = (jetzt - r.t) / 700; g.strokeStyle = `rgba(234,242,255,${1 - k})`; g.lineWidth = 3; g.beginPath(); g.arc(r.x, r.y, 8 + k * 30, 0, 7); g.stroke(); }
      if (z.tipps) { g.fillStyle = "#9AA7D1"; g.font = "700 12px Inter, sans-serif"; g.textAlign = "right"; g.fillText(z.tipps + "× getippt", BR - 10, 18); }
    }
  }
  requestAnimationFrame(bild);
  W.ORBIT_PROBIER = { html, binden };
})();
