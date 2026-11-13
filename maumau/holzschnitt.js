// Ganzes Blatt im Holzschnitt-Stil (32 Karten: 7 bis Ass in Kreuz, Pik, Herz, Karo) plus Rückseiten.
// Bildkarten aus figuren2.js. Zahlenkarten: geschnitzte Medaille, große Ziffer in der Mitte, die Symbole als Kranz darum.
(function () {
  const F = window.FIGUREN2;
  const TINTE = "#22202A", PAPIER = "#FFFDF7", ROT = "#C8282B", GOLD = "#F2B705";
  const istRot = f => f === "herz" || f === "karo";

  // Schnitzmuster: Kartenfarbe mit weißen, unterbrochenen Hohleisen-Spuren
  const MUSTER = `
    <pattern id="hs-rot" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="3.4" height="3.4" fill="${ROT}"/><path d="M0 1.7h3.4" stroke="${PAPIER}" stroke-width=".55" stroke-dasharray="2 1.4" opacity=".85"/></pattern>
    <pattern id="hs-schwarz" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="3.4" height="3.4" fill="${TINTE}"/><path d="M0 1.7h3.4" stroke="${PAPIER}" stroke-width=".5" stroke-dasharray="2 1.4" opacity=".55"/></pattern>
    <pattern id="hs-papier" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="6" height="6" fill="${PAPIER}"/><path d="M0 3h6" stroke="${TINTE}" stroke-width=".35" stroke-dasharray="1.2 4.8" opacity=".35"/></pattern>
    <filter id="druck" x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="1" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1"/></filter>`;

  function symbol(farbe, x, y, groesse, drehung, dicke) {
    const s = groesse / 20, muster = istRot(farbe) ? "url(#hs-rot)" : "url(#hs-schwarz)";
    return `<g transform="translate(${x} ${y}) rotate(${drehung || 0}) scale(${s}) translate(-10 -10)" fill="${muster}" stroke="${TINTE}" stroke-width="${(dicke || 1.3) / s}" stroke-linejoin="round">${F.SYM[farbe]}</g>`;
  }
  // feste Pseudo-Zufallszahlen, damit jede Karte immer gleich aussieht
  function zufall(seed) { let x = seed * 9301 + 49297; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); }
  function hohleisen(seed) {
    const r = zufall(seed); let s = "";
    for (let i = 0; i < 14; i++) {
      const ecke = i % 4, x0 = ecke % 2 ? 66 + r() * 12 : 21 + r() * 12, y0 = ecke < 2 ? 14 + r() * 12 : 104 + r() * 12;
      const l = 3 + r() * 5, w = (r() - .5) * 1.2;
      s += `M${x0.toFixed(1)} ${y0.toFixed(1)}q${(l / 2).toFixed(1)} ${w.toFixed(1)} ${l.toFixed(1)} ${(w * .3).toFixed(1)}`;
    }
    return `<path d="${s}" fill="none" stroke="${TINTE}" stroke-width=".9" stroke-linecap="round" opacity=".55"/>`;
  }
  function ecke(farbe, wert) {
    const col = istRot(farbe) ? ROT : TINTE;
    return `<text x="10.5" y="20" text-anchor="middle" font-family="Unbounded, 'Segoe UI', system-ui, sans-serif" font-weight="800" font-size="${wert === "10" ? 12 : 15}" fill="${col}" letter-spacing="${wert === "10" ? -.6 : 0}">${wert}</text>
      <g transform="translate(5 26) scale(.55)" fill="${col}">${F.SYM[farbe]}</g>`;
  }
  const rahmen = `<rect x="18" y="10" width="64" height="120" rx="4" fill="none" stroke="${TINTE}" stroke-width="1.6"/>`;
  const papier = `<rect x="1" y="1" width="98" height="138" rx="9" fill="${PAPIER}" stroke="#D9D4C7" stroke-width="1.2"/>`;

  function zahlkarte(farbe, wert) {
    const n = +wert, rx = 24, ry = 45, col = istRot(farbe) ? ROT : TINTE;
    let kranz = "";
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n, x = 50 + rx * Math.cos(a), y = 70 + ry * Math.sin(a);
      kranz += symbol(farbe, x.toFixed(2), y.toFixed(2), 11.5, (a * 180 / Math.PI + 90).toFixed(1));
    }
    const fs = wert === "10" ? 19 : 33;
    return `<rect x="18" y="10" width="64" height="120" rx="4" fill="url(#hs-papier)"/>
      ${hohleisen(n * 7 + (istRot(farbe) ? 3 : 0) + farbe.length)}
      <ellipse cx="50" cy="70" rx="${rx}" ry="${ry}" fill="none" stroke="${TINTE}" stroke-width=".9" stroke-dasharray="1.6 2.6"/>
      <ellipse cx="50" cy="70" rx="15.5" ry="23.5" fill="${PAPIER}" stroke="${TINTE}" stroke-width="1.5"/>
      <text x="50" y="${70 + fs * .36}" text-anchor="middle" font-family="Unbounded, 'Segoe UI', system-ui, sans-serif" font-weight="800" font-size="${fs}" letter-spacing="${wert === "10" ? -1.2 : 0}"
        fill="${istRot(farbe) ? "url(#hs-rot)" : "url(#hs-schwarz)"}" stroke="${TINTE}" stroke-width="1.2" paint-order="stroke">${wert}</text>
      ${kranz}`;
  }
  function asskarte(farbe) {
    let strahlen = "";
    for (let i = 0; i < 24; i++) {
      const a1 = i * Math.PI / 12, a2 = a1 + Math.PI / 30;
      strahlen += `M50 70L${(50 + 90 * Math.cos(a1)).toFixed(1)} ${(70 + 90 * Math.sin(a1)).toFixed(1)}L${(50 + 90 * Math.cos(a2)).toFixed(1)} ${(70 + 90 * Math.sin(a2)).toFixed(1)}Z`;
    }
    return `<clipPath id="asclip"><rect x="18" y="10" width="64" height="120" rx="4"/></clipPath>
      <g clip-path="url(#asclip)"><rect x="18" y="10" width="64" height="120" fill="${PAPIER}"/><path d="${strahlen}" fill="${TINTE}" opacity=".9"/></g>
      <circle cx="50" cy="70" r="27" fill="${PAPIER}" stroke="${TINTE}" stroke-width="1.8"/>
      <circle cx="50" cy="70" r="23.5" fill="none" stroke="${TINTE}" stroke-width=".8" stroke-dasharray="1.4 2"/>
      ${symbol(farbe, 50, 69, 30, 0, 1.6)}
      <text x="50" y="121" text-anchor="middle" font-family="Unbounded, 'Segoe UI', system-ui, sans-serif" font-weight="800" font-size="7" fill="${PAPIER}" letter-spacing="2" stroke="${TINTE}" stroke-width="2.2" paint-order="stroke">ASS</text>
      <text x="50" y="25" text-anchor="middle" font-family="Unbounded, 'Segoe UI', system-ui, sans-serif" font-weight="800" font-size="7" fill="${PAPIER}" letter-spacing="2" stroke="${TINTE}" stroke-width="2.2" paint-order="stroke" transform="rotate(180 50 22.5)">ASS</text>`;
  }
  function bildkarte(farbe, wert) {
    const col = F.FARBE[farbe], fig = F.FIGUR[wert].map(([r, d]) => F.stilTeil("holzschnitt", r, d, col)).join("");
    return `<clipPath id="rahmenclip"><rect x="18" y="10" width="64" height="120" rx="4"/></clipPath>
      <g clip-path="url(#rahmenclip)" filter="url(#rau)"><g transform="translate(18 10)">${fig}</g><g transform="rotate(180 50 70)"><g transform="translate(18 10)">${fig}</g></g></g>
      <path d="M18 70.8L82 69.2" stroke="${TINTE}" stroke-width="1.4" opacity=".7"/>`;
  }

  function karte(farbe, wert) {
    const mitte = wert === "A" ? asskarte(farbe) : ["B", "D", "K"].includes(wert) ? bildkarte(farbe, wert) : zahlkarte(farbe, wert);
    const e = ecke(farbe, wert);
    return `<svg class="karte" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${wert} ${farbe}">
      ${F.DEFS.replace("</defs>", MUSTER + "</defs>")}${papier}<g filter="url(#druck)">${mitte}</g>${rahmen}${e}<g transform="rotate(180 50 70)">${e}</g></svg>`;
  }

  function rueckseite(variante) {
    const grund = variante === "rot" ? ROT : TINTE, linie = variante === "rot" ? TINTE : PAPIER;
    let gitter = "";
    for (let i = -140; i < 240; i += 9) gitter += `M${i} 0l140 140M${i + 140} 0l-140 140`;
    return `<svg class="karte" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Rückseite">
      <defs>${MUSTER}<clipPath id="rclip"><rect x="7" y="7" width="86" height="126" rx="5"/></clipPath></defs>${papier}
      <g filter="url(#druck)"><g clip-path="url(#rclip)"><rect x="7" y="7" width="86" height="126" fill="${grund}"/>
        <path d="${gitter}" stroke="${linie}" stroke-width="1.1" stroke-dasharray="5 1.6" opacity=".8"/></g>
        <rect x="7" y="7" width="86" height="126" rx="5" fill="none" stroke="${TINTE}" stroke-width="1.6"/>
        <circle cx="50" cy="70" r="19" fill="${PAPIER}" stroke="${TINTE}" stroke-width="1.8"/>
        <circle cx="50" cy="70" r="15.5" fill="none" stroke="${TINTE}" stroke-width=".8" stroke-dasharray="1.4 2"/>
        <text x="50" y="78.5" text-anchor="middle" font-family="Unbounded, 'Segoe UI', system-ui, sans-serif" font-weight="800" font-size="23" fill="url(#hs-rot)" stroke="${TINTE}" stroke-width="1.2" paint-order="stroke">M</text></g></svg>`;
  }

  window.HOLZ = { karte, rueckseite, FARBEN: ["kreuz", "pik", "herz", "karo"], WERTE: ["7", "8", "9", "10", "B", "D", "K", "A"] };
})();
