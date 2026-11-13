// Bildkarten, zweiter Versuch: dieselben Figuren, drei Zeichenstile (tusche, holzschnitt, kuli).
// Jede Figur ist eine Liste von Teilen mit Rolle; der Stil entscheidet, wie eine Rolle gezeichnet wird.
// Koordinaten: obere Kartenhälfte, Kasten 64 x 60, wird bei (18, 10) eingesetzt und für unten gespiegelt.
(function () {
  const SYM = {
    herz: '<path d="M10 18.5C4 13.5 0 10 0 5.8 0 2.6 2.4.6 5.1.6c2 0 3.8 1.1 4.9 3 1.1-1.9 2.9-3 4.9-3C17.6.6 20 2.6 20 5.8 20 10 16 13.5 10 18.5z"/>',
    karo: '<path d="M10 0l8 10-8 10-8-10z"/>',
    pik: '<path d="M10 0c4 5 10 8.4 10 12.6 0 2.8-2.2 4.4-4.6 4.4-1.8 0-3.4-1-4.4-2.4.3 2 1.2 3.8 2.5 5.4h-7c1.3-1.6 2.2-3.4 2.5-5.4-1 1.4-2.6 2.4-4.4 2.4C2.2 17 0 15.4 0 12.6 0 8.4 6 5 10 0z"/>',
    kreuz: '<circle cx="10" cy="5" r="4.6"/><circle cx="4.9" cy="11.6" r="4.6"/><circle cx="15.1" cy="11.6" r="4.6"/><path d="M8.7 12h2.6l1.8 8H6.9z"/>'
  };
  const FARBE = { kreuz: "#1B1B22", pik: "#1B1B22", herz: "#C8282B", karo: "#C8282B" };

  // ---------- Figuren ----------
  const AUGEN = [
    ["linie", "M24 20.6C25.2 19.6 27 19.6 28.2 20.6M31.8 20.6C33 19.6 34.8 19.6 36 20.6"],
    ["pupille", "M26.1 21.2m-.95 0a.95 .95 0 1 0 1.9 0a.95 .95 0 1 0-1.9 0M33.9 21.2m-.95 0a.95 .95 0 1 0 1.9 0a.95 .95 0 1 0-1.9 0"],
  ];
  const FIGUR = {
    K: [
      ["kleid", "M2 60V53C3.4 47.4 10 43.4 18.5 41.2C22 44.2 26 45.6 30 45.6S38 44.2 41.5 41.2C50 43.4 56.6 47.4 58 53V60Z"],
      ["falten", "M11 50.5c.8 3.4 1 6.4.8 9.5M19 47.6c.6 4 .8 8 .6 12.4M41 47.6c-.6 4-.8 8-.6 12.4M49 50.5c-.8 3.4-1 6.4-.8 9.5"],
      ["kragen", "M15.5 41.5C20 47.5 40 47.5 44.5 41.5C43 39 41 37.6 39.5 37.2C36 41.2 24 41.2 20.5 37.2C19 37.6 17 39 15.5 41.5Z"],
      ["tupfen", "M20.2 42.6v2M25 44.2v2M30 44.8v2M35 44.2v2M39.8 42.6v2"],
      ["haar", "M20.6 14.5C18.2 18 17.6 23.5 19 28.5C19.8 26 20.4 24 21 22.5ZM39.4 14.5C41.8 18 42.4 23.5 41 28.5C40.2 26 39.6 24 39 22.5Z"],
      ["haut", "M21 15.5C21 11.5 39 11.5 39 15.5L39.4 24C39.4 30 35.6 34.2 30 34.2S20.6 30 20.6 24Z"],
      ["bart", "M20.8 25.5C20.8 33 24 41 30 45C36 41 39.2 33 39.2 25.5C37.4 29.6 34.2 31.6 30 31.6S22.6 29.6 20.8 25.5Z"],
      ["straehnen", "M25 33c.8 3 2 6 3.2 8.5M30 33.5v9M35 33c-.8 3-2 6-3.2 8.5M23 30c.4 2 1 3.6 1.8 5M37 30c-.4 2-1 3.6-1.8 5"],
      ["bart", "M24.6 28.4C26.8 26.6 28.8 27 30 28.3C31.2 27 33.2 26.6 35.4 28.4C33.8 29.6 31.6 29.6 30 29C28.4 29.6 26.2 29.6 24.6 28.4Z"],
      ...AUGEN,
      ["braue", "M23.4 18C25 16.9 27 16.9 28.4 17.7M31.6 17.7C33 16.9 35 16.9 36.6 18"],
      ["linie", "M30.2 20.6C29.8 22.8 29.2 24.4 28.7 25.4C29.5 26 30.7 26 31.4 25.5"],
      ["gold", "M19.6 13L18.2 2.5L23.2 7.2L26 .8L30 6.4L34 .8L36.8 7.2L41.8 2.5L40.4 13Z"],
      ["linie", "M19.6 10.4h20.8"],
      ["akzentpunkt", "M24.5 11.8m-1.1 0a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0M30 11.8m-1.1 0a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0M35.5 11.8m-1.1 0a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0"],
      ["stab", "M51.6 7.6L48 60"],
      ["gold", "M51.6 5.2m-3.3 0a3.3 3.3 0 1 0 6.6 0a3.3 3.3 0 1 0-6.6 0"],
      ["linie", "M51.6-.6v2.6M50.3.6h2.6"],
      ["haut", "M44.6 43.8c1.6-2.6 6.4-2.8 7.6-.4.9 1.9-.6 4.2-3.6 4.4-2.4.2-4.6-1.4-4-4z"],
      ["linie", "M46.4 44.4c1.4.4 3 .3 4.4-.3"]
    ],
    D: [
      ["haar", "M18.6 22C17 10 23 6 30 6S43 10 41.4 22C42 30 44 37 47.4 41.4C41.6 41.4 39.4 37.6 38.8 33.4H21.2C20.6 37.6 18.4 41.4 12.6 41.4C16 37 18 30 18.6 22Z"],
      ["kleid", "M4 60V54C5.4 48.4 11.6 44.4 20.6 42.4C24 46 36 46 39.4 42.4C48.4 44.4 54.6 48.4 56 54V60Z"],
      ["falten", "M13 51c.8 3 1 6 .8 9M22 49.6c.4 3.6.6 7 .4 10.4M38 49.6c-.4 3.6-.6 7-.4 10.4M47 51c-.8 3-1 6-.8 9"],
      ["haut", "M26.6 32.6v6.8C28.6 40.8 31.4 40.8 33.4 39.4V32.6Z"],
      ["kragen", "M20.6 42.4C24 46 36 46 39.4 42.4L41.2 44.8C37 49.6 23 49.6 18.8 44.8Z"],
      ["tupfen", "M21.6 46v.1M25 47.6v.1M28.4 48.4v.1M31.6 48.4v.1M35 47.6v.1M38.4 46v.1"],
      ["haut", "M22 16C22 11.6 38 11.6 38 16L38.4 24C38.2 30.4 34.6 33.6 30 33.6S21.8 30.4 21.6 24Z"],
      ["haar", "M21.8 17.4C24 12 27.6 10.4 30.4 10.4C33.2 10.4 36.4 12 38.4 17.4C35.4 14.8 32.8 14.2 30.2 14.8C27.6 14.2 24.8 14.8 21.8 17.4Z"],
      ["linie", "M24.3 21.2C25.4 20.2 27.1 20.2 28.2 21.2M31.8 21.2C32.9 20.2 34.6 20.2 35.7 21.2M24.3 21.2l-1.1-.9M35.7 21.2l1.1-.9"],
      ["pupille", "M26.2 21.8m-.9 0a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0-1.8 0M33.8 21.8m-.9 0a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0-1.8 0"],
      ["linie", "M24 18.6C25.4 17.8 27 17.8 28.2 18.4M31.8 18.4C33 17.8 34.6 17.8 36 18.6"],
      ["linie", "M30.2 21.6C30 23.4 29.6 24.6 29.2 25.4C29.8 25.8 30.6 25.8 31 25.5"],
      ["lippe", "M27.6 28.8C28.8 28.1 29.5 28.4 30 28.8C30.5 28.4 31.2 28.1 32.4 28.8C31.3 30.2 28.7 30.2 27.6 28.8Z"],
      ["perlen", "M24 45.6v.1M26.8 46.6v.1M29.6 47v.1M32.4 46.9v.1M35.2 46.2v.1"],
      ["gold", "M23 12.6L24.6 7.6L27.6 10.6L30 5.2L32.4 10.6L35.4 7.6L37 12.6Z"],
      ["stiel", "M47 39C46 45 45.4 51 46.4 60"],
      ["blatt", "M46.2 48C49.6 46.4 52 47.2 53 49.4C49.6 50.6 47.6 50 46.2 48Z"],
      ["bluete", "M43.6 35C43.2 31.6 46 29.8 48.6 30.6C51.4 31.4 52 34.6 50.4 36.8C48.6 39 44.4 38.6 43.6 35Z"],
      ["linie", "M47.6 32.6C49.4 32.8 49.8 35 48 35.6C46.6 36 45.8 34.6 46.8 33.6"],
      ["haut", "M43.4 41.4c1.4-2.2 5.6-2.4 6.6-.4.8 1.6-.6 3.6-3.2 3.8-2 .2-4-1.2-3.4-3.4z"]
    ],
    B: [
      ["kleid", "M2 60V52.6C3.6 47 10.4 43.4 19.4 41.4C22.6 44.4 26.4 45.6 30 45.6S37.4 44.4 40.6 41.4C49.6 43.4 56.4 47 58 52.6V60Z"],
      ["falten", "M6 51.6c3-2.2 7-2.4 11 0M43 51.6c4-2.4 8-2.2 11 0M24 47.4V60M30 46.4V60M36 47.4V60"],
      ["haut", "M26.4 33.4v5.4l3.6 2.4 3.6-2.4v-5.4Z"],
      ["kragen", "M20 39.4L30 46.6L40 39.4L37 37.4L30 41.6L23 37.4Z"],
      ["haar", "M21 13.6C19 17 18.6 21.6 20 25.6C20.6 23 21 21 21.6 19.6ZM39 13.6C41 17 41.4 21.6 40 25.6C39.4 23 39 21 38.4 19.6Z"],
      ["haut", "M21.4 15.6C21.4 11.8 38.6 11.8 38.6 15.6L39 24C39 30 35.4 34 30 34S21 30 21 24Z"],
      ...AUGEN,
      ["braue", "M23.6 18.2C25 17.4 27 17.3 28.4 18M31.6 18C33 17.3 35 17.4 36.4 18.2"],
      ["linie", "M30.2 20.8C29.8 22.8 29.2 24.4 28.8 25.2C29.6 25.8 30.6 25.8 31.2 25.4M27.4 29.2C28.8 30.4 31.2 30.4 32.6 29.2"],
      ["kleid", "M16.4 14.6C16.4 7.4 23.4 3.6 31.4 4C39.6 4.4 45 7.8 45 12.6C38 15.6 24.8 16.6 16.4 14.6Z"],
      ["linie", "M16.4 14.6C25 16.6 38 15.6 45 12.6"],
      ["feder", "M38.8 9.6C43.6 2.4 51.6-.6 57.4.2C53.6 3.4 49.4 8.4 41.6 11.6Z"],
      ["linie", "M40 10.4C45 6 50 2.6 56 .8M45 6.4l1.4 2M48.6 3.8l1.2 2M52.4 1.8l1 1.8"],
      ["stab", "M53 5V60"],
      ["metall", "M53 8.4L59.2 6.4C60.4 10 60.4 13.6 59.2 16.8L53 14.6ZM53 8.4L51.4 2.4L53 .2L54.6 2.4Z"],
      ["haut", "M49.6 42.4c1.6-2.4 6-2.6 7-.4.8 1.8-.6 3.8-3.4 4-2.2.2-4.2-1.2-3.6-3.6z"],
      ["linie", "M51.2 43.2c1.3.4 2.8.3 4-.3"]
    ]
  };

  // ---------- Stile ----------
  const TINTE = "#22202A", PAPIER = "#FFFDF7", GOLD = "#F2B705";
  function stilTeil(stil, rolle, d, col) {
    const hell = col === FARBE.kreuz ? "#5B5966" : col;
    const s = (st, w, extra) => `stroke="${st}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra || ""}`;
    if (stil === "kuli") {
      const blau = "#2541B2", marker = (c, o) => `<path d="${d}" fill="${c}" fill-opacity="${o}" stroke="none" transform="translate(.6 .5)"/>`;
      const strich = (w) => `<path d="${d}" fill="none" ${s(blau, w)}/><path d="${d}" fill="none" ${s(blau, w * .7, ' opacity=".45"')} transform="translate(.35 .3)"/>`;
      switch (rolle) {
        case "kleid": return marker(hell === "#5B5966" ? "#7A8AA8" : col, .38) + `<path d="${d}" fill="url(#kschraff)"/>` + strich(.85);
        case "haar": case "bart": return `<path d="${d}" fill="url(#kschraff2)"/>` + strich(.85);
        case "gold": return marker("#FFE14D", .75) + strich(.85);
        case "bluete": case "lippe": return marker("#E8314A", .55) + strich(.7);
        case "blatt": return marker("#5CC26A", .6) + strich(.7);
        case "akzentpunkt": case "pupille": case "perlen": case "tupfen": return `<path d="${d}" fill="${blau}" ${s(blau, rolle === "perlen" || rolle === "tupfen" ? 1.6 : .4)}/>`;
        case "stab": case "stiel": return strich(1.3);
        case "braue": return strich(1.2);
        default: return strich(rolle === "linie" || rolle === "falten" || rolle === "straehnen" ? .7 : .85);
      }
    }
    if (stil === "holzschnitt") {
      switch (rolle) {
        case "kleid": return `<path d="${d}" fill="${col}" ${s(TINTE, 1.5)}/>`;
        case "falten": return `<path d="${d}" fill="none" ${s(PAPIER, 1.1)}/>`;
        case "haar": case "bart": return `<path d="${d}" fill="${TINTE}" ${s(TINTE, 1.2)}/>`;
        case "straehnen": return `<path d="${d}" fill="none" ${s(PAPIER, .9)}/>`;
        case "kragen": case "feder": case "haut": return `<path d="${d}" fill="${PAPIER}" ${s(TINTE, 1.4)}/>`;
        case "tupfen": case "perlen": return `<path d="${d}" fill="none" ${s(rolle === "perlen" ? GOLD : TINTE, 2)}/>`;
        case "gold": return `<path d="${d}" fill="${GOLD}" ${s(TINTE, 1.4)}/>`;
        case "metall": return `<path d="${d}" fill="#C9CCD3" ${s(TINTE, 1.3)}/>`;
        case "bluete": case "lippe": case "akzentpunkt": return `<path d="${d}" fill="${col === FARBE.kreuz ? "#C8282B" : col}" ${s(TINTE, rolle === "akzentpunkt" ? .5 : 1.1)}/>`;
        case "blatt": return `<path d="${d}" fill="#2E7D3A" ${s(TINTE, 1)}/>`;
        case "pupille": return `<path d="${d}" fill="${TINTE}"/>`;
        case "stab": case "stiel": return `<path d="${d}" fill="none" ${s(rolle === "stiel" ? "#2E7D3A" : TINTE, 2.4)}/>`;
        case "braue": return `<path d="${d}" fill="none" ${s(TINTE, 1.8)}/>`;
        default: return `<path d="${d}" fill="none" ${s(TINTE, 1.2)}/>`;
      }
    }
    // tusche
    switch (rolle) {
      case "kleid": return `<path d="${d}" fill="${hell}" fill-opacity=".2" ${s(TINTE, .9)}/><path d="${d}" fill="url(#kreuzschraff)"/>`;
      case "falten": return `<path d="${d}" fill="none" ${s(TINTE, .7, ' opacity=".55"')}/>`;
      case "haar": return `<path d="${d}" fill="url(#dicht)" ${s(TINTE, .9)}/>`;
      case "bart": return `<path d="${d}" fill="${PAPIER}" ${s(TINTE, .9)}/><path d="${d}" fill="url(#fein)"/>`;
      case "kragen": case "feder": case "haut": return `<path d="${d}" fill="${PAPIER}" ${s(TINTE, .9)}/>`;
      case "tupfen": return `<path d="${d}" fill="none" ${s(TINTE, 1.5)}/>`;
      case "perlen": return `<path d="${d}" fill="none" ${s("#C9A227", 1.8)}/>`;
      case "gold": return `<path d="${d}" fill="${GOLD}" fill-opacity=".5" ${s(TINTE, .9)}/><path d="${d}" fill="url(#fein)"/>`;
      case "metall": return `<path d="${d}" fill="${PAPIER}" ${s(TINTE, .9)}/><path d="${d}" fill="url(#fein)"/>`;
      case "bluete": case "lippe": case "akzentpunkt": return `<path d="${d}" fill="#C8282B" fill-opacity="${rolle === "akzentpunkt" ? 1 : .75}" ${s(TINTE, rolle === "akzentpunkt" ? .4 : .8)}/>`;
      case "blatt": return `<path d="${d}" fill="#3C8A4A" fill-opacity=".6" ${s(TINTE, .8)}/>`;
      case "pupille": return `<path d="${d}" fill="${TINTE}"/>`;
      case "stab": return `<path d="${d}" fill="none" ${s(TINTE, 1.7)}/>`;
      case "stiel": return `<path d="${d}" fill="none" ${s("#2E6B3A", 1.3)}/>`;
      case "braue": return `<path d="${d}" fill="none" ${s(TINTE, 1.2)}/>`;
      default: return `<path d="${d}" fill="none" ${s(TINTE, rolle === "straehnen" ? .6 : .85)}/>`;
    }
  }

  const DEFS = `<defs>
    <filter id="rau" x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale=".9"/></filter>
    <pattern id="kreuzschraff" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0v2.6" stroke="${TINTE}" stroke-width=".35" opacity=".45"/></pattern>
    <pattern id="dicht" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(70)"><path d="M0 0v1.6" stroke="${TINTE}" stroke-width=".55"/></pattern>
    <pattern id="fein" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)"><path d="M0 0v2" stroke="${TINTE}" stroke-width=".25" opacity=".55"/></pattern>
    <pattern id="kschraff" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0v3" stroke="#2541B2" stroke-width=".4" opacity=".55"/></pattern>
    <pattern id="kschraff2" width="1.8" height="1.8" patternUnits="userSpaceOnUse" patternTransform="rotate(65)"><path d="M0 0v1.8" stroke="#2541B2" stroke-width=".5" opacity=".9"/></pattern>
    <pattern id="liniert" width="100" height="7" patternUnits="userSpaceOnUse"><rect width="100" height="7" fill="#FCFCF6"/><path d="M0 6.6h100" stroke="#AFC8E8" stroke-width=".5"/></pattern>
  </defs>`;

  function haelfte(wert, stil, col) {
    return FIGUR[wert].map(([r, d]) => stilTeil(stil, r, d, col)).join("");
  }
  function ecke(w, farbe, stil) {
    const col = stil === "kuli" ? (farbe === "herz" || farbe === "karo" ? "#C8282B" : "#2541B2") : FARBE[farbe];
    return `<text x="11" y="20" text-anchor="middle" font-family="${stil === "kuli" ? "'Segoe Print','Comic Sans MS',cursive" : "Inter,'Segoe UI',system-ui,sans-serif"}" font-weight="700" font-size="17" fill="${col}">${w}</text>
      <g transform="translate(5.5 27.5) scale(.55)" fill="${col}">${SYM[farbe]}</g>`;
  }
  function karte(farbe, wert, stil) {
    const col = FARBE[farbe];
    const grund = stil === "kuli" ? `<rect x="1" y="1" width="98" height="138" rx="9" fill="url(#liniert)" stroke="#D9D4C7" stroke-width="1.2"/><path d="M16 1v138" stroke="#F0A6A6" stroke-width=".7"/>`
      : `<rect x="1" y="1" width="98" height="138" rx="9" fill="${PAPIER}" stroke="#D9D4C7" stroke-width="1.2"/>`;
    const rahmenFarbe = stil === "kuli" ? "#2541B2" : col;
    const rahmen = stil === "holzschnitt"
      ? `<rect x="18" y="10" width="64" height="120" rx="4" fill="none" stroke="${TINTE}" stroke-width="1.6"/>`
      : `<rect x="18" y="10" width="64" height="120" rx="6" fill="none" stroke="${rahmenFarbe}" stroke-width=".9" opacity=".6"/>`;
    const fig = haelfte(wert, stil, col);
    const filter = stil === "holzschnitt" ? ' filter="url(#rau)"' : "";
    const clip = `<clipPath id="rahmenclip"><rect x="18" y="10" width="64" height="120" rx="6"/></clipPath>`;
    const e = ecke(wert, farbe, stil);
    return `<svg class="karte" viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">${DEFS}${clip}${grund}
      <g clip-path="url(#rahmenclip)"${filter}><g transform="translate(18 10)">${fig}</g><g transform="rotate(180 50 70)"><g transform="translate(18 10)">${fig}</g></g></g>
      <path d="M18 70.8L82 69.2" stroke="${stil === "holzschnitt" ? TINTE : rahmenFarbe}" stroke-width="${stil === "holzschnitt" ? 1.4 : .8}" opacity=".7"/>
      ${rahmen}${e}<g transform="rotate(180 50 70)">${e}</g></svg>`;
  }
  window.FIGUREN2 = { karte, FIGUR, stilTeil, SYM, FARBE, DEFS };
})();
