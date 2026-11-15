// Verlies der Helden: die Karte einer Ebene als Pergament (SVG). Nur Darstellung, die Regeln stehen in verlies-logic.js.
// Oben der Eingang, unten der Thronsaal. Besuchte Räume blass, der gegangene Weg mit Fußspuren, Wahlmöglichkeiten
// mit Korallenring (antippbar: data-stimme), weiter unten liegt Nebel.
(function () {
  const T = "#2A2118", R = "#9E2B1F", KORALLE = "#FF6B57";
  const L = (w = 2.5, c = T) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const F = (c, w = 2) => `fill="${c}" stroke="${T}" stroke-width="${w}" stroke-linejoin="round"`;
  const BREITE = 360, X0 = 40, Y0 = 34, DY = 58;
  const pos = k => ({ x: X0 + k.x * (BREITE - 2 * X0), y: Y0 + k.r * DY });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Zeichen der Raumarten, um (0,0), etwa 22 Einheiten groß
  const ICON = {
    kampf: `<path d="M-8 8L8-8M8 8L-8-8" ${L(2.8)}/><path d="M-9 2l7 7M9 2l-7 7" ${L(2.4)}/>`,
    elite: `<path d="M-9 1a9 9 0 1 1 18 0v4h-3v5h-12v-5h-3z" ${F("#EDE4D0")}/><circle cx="-3.8" cy="0" r="2.6" fill="${T}"/><circle cx="3.8" cy="0" r="2.6" fill="${T}"/><path d="M-2 10v-3M2 10v-3" ${L(1.4)}/>`,
    schatz: `<path d="M-10 9V0h20v9z" ${F("#C79A5B")}/><path d="M-10 0q0-8 10-8t10 8" ${F("#C79A5B")}/><rect x="-2.5" y="-2" width="5" height="5" ${F("#E8C24A", 1.4)}/>`,
    rast: `<path d="M0 10c-9-3-9-12-2-19 0 5 4 6 5 2 5 5 7 13-3 17z" ${F("#E8892F")}/><path d="M0 8c-3-2-3-6 0-9 2 3 4 5 0 9z" ${F("#F5CF4A", 1.3)}/>`,
    haendler: `<path d="M-5-8h10l-2 4q9 5 7 14h-20q-2-9 7-14z" ${F("#C79A5B")}/><path d="M-4-4h8" ${L(1.8)}/><circle cx="0" cy="4" r="3.5" ${F("#E8C24A", 1.3)}/>`,
    schrein: `<path d="M0-11L3-3 11 0 3 3 0 11-3 3-11 0-3-3z" ${F("#7BE3A0")}/>`,
    ereignis: `<text x="0" y="7.5" text-anchor="middle" font-family="Alegreya, Georgia, serif" font-weight="700" font-size="22" fill="${T}">?</text>`,
    kammer: `<path d="M-5-2v-4a5 5 0 0 1 10 0v4" ${L(2.4)}/><rect x="-8" y="-2" width="16" height="12" rx="2" ${F("#E8C24A")}/><circle cx="0" cy="3.5" r="1.8" fill="${T}"/>`,
    eingang: `<path d="M-9 9V-2a9 9 0 0 1 18 0v11z" ${F("#B9AD99")}/><path d="M-4 9V-5M0 9V-8M4 9V-5" ${L(1.5)}/>`,
    boss: `<path d="M-12 7l-2-14 7 6 7-10 7 10 7-6-2 14z" ${F("#E8C24A")}/><circle cx="0" cy="-1" r="2.2" fill="${R}"/>`
  };
  const FARBE = { kaempfer: "#B83A2A", paladin: "#C99A2E", dieb: "#3A2E26", waldlaeufer: "#3E7A55", magierin: "#5B3A6E", heilerin: "#2F7FA8", moench: "#D9792A" };

  // Punkt auf der Kurve zwischen zwei Räumen
  const kurve = (a, b) => `M${a.x} ${a.y}C${a.x} ${a.y + DY * 0.5} ${b.x} ${b.y - DY * 0.5} ${b.x} ${b.y}`;
  function aufKurve(a, b, t) {
    const c1 = { x: a.x, y: a.y + DY * 0.5 }, c2 = { x: b.x, y: b.y - DY * 0.5 }, u = 1 - t;
    const f = (p, q, r, s) => u * u * u * p + 3 * u * u * t * q + 3 * u * t * t * r + t * t * t * s;
    return { x: f(a.x, c1.x, c2.x, b.x), y: f(a.y, c1.y, c2.y, b.y) };
  }

  // o: { optionen: [{ knoten, i, gesperrt, geheim }], meine: Index, stimmen: { knoten: ["Na", …] }, klickbar, namen: { pid: "Name" } }
  function svg(S, o) {
    o = o || {};
    const V = window.VL, K = S.karte, ks = Object.values(K.knoten), hier = K.knoten[K.pos];
    const maxR = hier.r + V.sicht(S);
    const sichtbar = k => k.r <= maxR || k.typ === "boss" || K.weg.includes(k.id);
    const hoehe = Y0 + (V.REIHEN + 1) * DY + 30;
    const gegangen = new Set();
    for (let i = 1; i < K.weg.length; i++) gegangen.add(K.weg[i - 1] + ">" + K.weg[i]);
    const optionen = o.optionen || [];
    const option = id => optionen.find(x => x.knoten === id);

    let s = `<svg class="karte-svg" viewBox="0 0 ${BREITE} ${hoehe}" role="group" aria-label="Karte des Kerkers">
      <defs><linearGradient id="k-nebel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8C7A6B" stop-opacity="0"/><stop offset=".35" stop-color="#8C7A6B" stop-opacity=".22"/><stop offset="1" stop-color="#5A4A3E" stop-opacity=".3"/></linearGradient></defs>`;
    // Nebel unterhalb der Sichtweite
    if (maxR < V.REIHEN) {
      const y = Y0 + (maxR + 0.45) * DY;
      s += `<rect x="0" y="${y}" width="${BREITE}" height="${Y0 + V.REIHEN * DY + DY * 0.5 - y}" fill="url(#k-nebel)"/>`;
      s += `<text x="${BREITE / 2}" y="${Y0 + V.REIHEN * DY + DY * 0.5 - 6}" text-anchor="middle" font-family="Alegreya, Georgia, serif" font-style="italic" font-size="12" fill="#5A4A3E">Hier ist die Tinte verblasst</text>`;
    }
    // Wege
    for (const k of ks) for (const n of k.nach) {
      const a = pos(k), b = pos(K.knoten[n]), z = K.knoten[n];
      if (gegangen.has(k.id + ">" + n)) {
        s += `<path d="${kurve(a, b)}" ${L(3)} opacity=".85"/>`;
        for (const t of [0.32, 0.5, 0.68]) { const p = aufKurve(a, b, t); s += `<ellipse cx="${p.x + (t === 0.5 ? 3 : -3)}" cy="${p.y}" rx="1.8" ry="3" fill="${R}" opacity=".8"/>`; }
      } else if (k.id === K.pos && option(n)) s += `<path d="${kurve(a, b)}" ${L(2.6, KORALLE)} stroke-dasharray="6 5" class="k-weg"/>`;
      else s += `<path d="${kurve(a, b)}" ${L(1.6)} stroke-dasharray="4 5" opacity="${sichtbar(k) && sichtbar(z) ? 0.5 : 0.18}"/>`;
    }
    // Geheimgänge: gepunktet direkt zum Ziel
    for (const op of optionen) if (op.geheim) {
      const a = pos(hier), b = pos(K.knoten[op.knoten]);
      s += `<path d="M${a.x} ${a.y}Q${(a.x + b.x) / 2 + (b.x > a.x ? -30 : 30)} ${(a.y + b.y) / 2} ${b.x} ${b.y}" ${L(2.4, KORALLE)} stroke-dasharray="1 6" class="k-weg"/>`;
    }
    // Räume
    for (const k of ks) {
      const p = pos(k), r = k.typ === "boss" ? 21 : 16, sieht = sichtbar(k), op = option(k.id);
      const besucht = K.weg.includes(k.id) && k.id !== K.pos;
      const klick = op && !op.gesperrt && o.klickbar;
      const titel = sieht ? window.VL.RAUMNAME[k.typ] + (k.elite ? ": " + window.VL.GEGNER[k.elite].name : "") : "im Nebel";
      s += `<g transform="translate(${p.x} ${p.y})" class="k-raum${besucht ? " besucht" : ""}${op ? " wahl" : ""}${op && op.gesperrt ? " gesperrt" : ""}"${klick ? ` data-stimme="${op.i}" role="button" tabindex="0" aria-label="${esc(titel)}"` : ""}>`;
      if (klick) s += `<circle r="${r + 12}" fill="transparent"/>`;
      if (k.id === K.pos) s += `<circle r="${r + 7}" fill="#FFD447" opacity=".6" class="k-puls"/>`;
      if (op) s += `<circle r="${r + 5}" ${L(op.i === o.meine ? 4 : 2.4, KORALLE)}${op.i === o.meine ? "" : ' stroke-dasharray="5 4"'} class="k-ring"/>`;
      s += sieht ? `<circle r="${r}" ${F(k.typ === "elite" || k.typ === "boss" ? "#E9CFA8" : "#FBF3E2", 2.2)}/>` : `<circle r="${r - 2}" fill="#E4D3B4" stroke="#8C7A6B" stroke-width="1.5" stroke-dasharray="3 3"/>`;
      if (sieht) s += k.typ === "boss" ? `<g transform="scale(1.3)">${ICON.boss}</g>` : ICON[k.typ] || "";
      if (op && op.gesperrt) s += `<path d="M${r - 2} ${-r + 2}l-${2 * r - 4} ${2 * r - 4}" ${L(2, R)} opacity=".6"/>`;
      const wer = (o.stimmen || {})[k.id];
      if (wer && wer.length) s += `<text y="${r + 15}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="11" fill="${R}">${esc(wer.join(" "))}</text>`;
      s += `</g>`;
    }
    // Die Helden stehen am aktuellen Raum
    const hp = pos(hier), n = S.teilnehmer.length;
    S.teilnehmer.forEach((p, i) => {
      const h = S.helden[p], x = hp.x + 24 + (n > 4 ? i % 3 : i) * 13, y = hp.y - 14 + (n > 4 ? Math.floor(i / 3) * 14 + (i % 2) * 3 : (i % 2) * 6);
      const name = (o.namen && o.namen[p]) || "?";
      s += `<g transform="translate(${x} ${y})"${h.hp <= 0 ? ' opacity=".45"' : ""}><circle r="7" fill="${FARBE[h.rolle] || T}" stroke="#F3E6CC" stroke-width="1.5"/><text y="3.5" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="9" fill="#F3E6CC">${esc(name.charAt(0).toUpperCase())}</text></g>`;
    });
    return s + `</svg>`;
  }

  function legende() {
    const typen = ["kampf", "elite", "schatz", "rast", "haendler", "schrein", "ereignis", "kammer"];
    return `<div class="legende">${typen.map(t => `<span><svg viewBox="-13 -13 26 26" aria-hidden="true">${ICON[t]}</svg>${esc(window.VL.RAUMNAME[t])}</span>`).join("")}</div>`;
  }

  window.VKarte = { svg, legende, ICON };
})();
