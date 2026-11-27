// Sperrgut: Formen und Eigenschaften der Teile (Kartons, Möbel, Gemeinheits-Teile).
// Koordinaten in Feldern, Mittelpunkt bei (0, 0), y zeigt nach UNTEN (wie auf dem Bildschirm).
// Die Physik (turm.js) dreht y für planck um; die Zeichnung (zeichnen.js) nimmt die Werte, wie sie hier stehen.
//   rects: [x, y, breite, hoehe] (linke obere Ecke), kreis: Radius
//   zellen (nur Kartons): die einzelnen 1×1-Felder, aus denen der Karton besteht
//   dichte, reibung, federung: Werte für planck; art: "karton" | "moebel" | "rund" | "sonder"
(function () {
  // Kartons aus vier Feldern: Zellen → um den Mittelpunkt verschoben
  function karton(name, zellen, etikett) {
    const xs = zellen.map(z => z[0]), ys = zellen.map(z => z[1]);
    const mx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, my = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
    const z = zellen.map(([x, y]) => [x - mx, y - my]);
    return { name, art: "karton", zellen: z, rects: z.map(([x, y]) => [x, y, 1, 1]), dichte: 1, reibung: 0.9, federung: 0, etikett };
  }
  const TEILE = {
    I: karton("Langkarton", [[0, 0], [1, 0], [2, 0], [3, 0]], "Bücher (schwer!)"),
    O: karton("Großer Karton", [[0, 0], [1, 0], [0, 1], [1, 1]], "Kram"),
    T: karton("Kartons T", [[0, 0], [1, 0], [2, 0], [1, 1]], "Küche"),
    L: karton("Kartons L", [[0, 0], [0, 1], [0, 2], [1, 2]], "Bad"),
    J: karton("Kartons J", [[1, 0], [1, 1], [1, 2], [0, 2]], "Schuhe"),
    S: karton("Kartons S", [[1, 0], [2, 0], [0, 1], [1, 1]], "Omas Geschirr"),
    Z: karton("Kartons Z", [[0, 0], [1, 0], [1, 1], [2, 1]], "Winterkram"),
    kiste: karton("Kleine Kiste", [[0, 0]], "Kleinkram"),

    kuehlschrank: { name: "Kühlschrank", art: "moebel", rects: [[-0.5, -1, 1, 2]], dichte: 2.5, reibung: 0.6, federung: 0 },
    sofa: { name: "Sofa", art: "moebel", rects: [[-1.5, -0.1, 3, 0.7], [-1.5, -0.6, 0.5, 0.5], [1, -0.6, 0.5, 0.5]], dichte: 0.8, reibung: 0.9, federung: 0 },
    lampe: { name: "Stehlampe", art: "moebel", rects: [[-0.6, -1.5, 1.2, 0.6], [-0.1, -0.9, 0.2, 2.2], [-0.45, 1.3, 0.9, 0.2]], dichte: 0.5, reibung: 0.7, federung: 0 },
    matratze: { name: "Matratze", art: "moebel", rects: [[-2, -0.25, 4, 0.5]], dichte: 0.35, reibung: 0.95, federung: 0.25 },
    gummibaum: { name: "Gummibaum", art: "moebel", rects: [[-0.45, 0, 0.9, 1], [-1, -1, 2, 1]], dichte: 0.6, reibung: 0.85, federung: 0 },
    stuhl: { name: "Stuhl", art: "moebel", rects: [[-0.5, -1, 0.15, 0.9], [-0.5, -0.1, 1, 0.2], [-0.5, 0.1, 0.12, 0.9], [0.38, 0.1, 0.12, 0.9]], dichte: 0.7, reibung: 0.8, federung: 0 },

    glas: { name: "Goldfischglas", art: "rund", kreis: 0.55, dichte: 1.3, reibung: 0.5, federung: 0, zerbrechlich: true },

    // nur über Gemeinheiten
    klavier: { name: "Klavier", art: "sonder", rects: [[-1.5, -1, 3, 1.7], [-1.5, 0.7, 0.25, 0.3], [1.25, 0.7, 0.25, 0.3]], dichte: 3, reibung: 0.7, federung: 0 },
    ball: { name: "Gymnastikball", art: "rund", kreis: 0.9, dichte: 0.25, reibung: 0.6, federung: 0.3 }
  };
  const KARTONS = ["I", "O", "T", "L", "J", "S", "Z"];
  const MOEBEL = ["kuehlschrank", "sofa", "lampe", "matratze", "gummibaum", "stuhl"];

  // Halbe Ausdehnung (für Abstände): Radius des umschließenden Kreises
  function radius(typ) {
    const T = TEILE[typ];
    if (T.kreis) return T.kreis;
    let r = 0;
    for (const [x, y, w, h] of T.rects) for (const [a, b] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) r = Math.max(r, Math.hypot(a, b));
    return r;
  }

  // Zufall mit Startwert (gleich auf allen Handys)
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // Reihenfolge der Teile: Kartons aus einem gemischten Beutel (alle sieben, dann neu), etwa jedes fünfte Teil ein Möbel.
  // Markierungen: pizza (≈ jedes 7.) und zerbrechlich (≈ jedes 12.), nur auf Kartons.
  // opt: { moebel: true, pizza: true, glas: true }
  function folge(seed, n, opt) {
    opt = Object.assign({ moebel: true, pizza: true, glas: true }, opt || {});
    const r = rng(seed), out = [];
    let beutel = [], bisMoebel = 4 + Math.floor(r() * 3), bisPizza = 5 + Math.floor(r() * 4), bisZer = 9 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      let typ;
      if (opt.moebel && i > 2 && --bisMoebel <= 0) {
        bisMoebel = 4 + Math.floor(r() * 3);
        typ = opt.glas && r() < 0.15 ? "glas" : MOEBEL[Math.floor(r() * MOEBEL.length)];
      } else {
        if (!beutel.length) { beutel = KARTONS.slice(); for (let k = beutel.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [beutel[k], beutel[j]] = [beutel[j], beutel[k]]; } }
        typ = beutel.pop();
      }
      const t = { typ };
      if (TEILE[typ].art === "karton") {
        if (opt.pizza && --bisPizza <= 0) { bisPizza = 5 + Math.floor(r() * 4); t.pizza = true; }
        else if (opt.glas && --bisZer <= 0) { bisZer = 9 + Math.floor(r() * 6); t.zerbrechlich = true; }
      }
      out.push(t);
    }
    return out;
  }

  const SG_TEILE = { TEILE, KARTONS, MOEBEL, radius, rng, folge };
  if (typeof module !== "undefined") module.exports = SG_TEILE;
  if (typeof window !== "undefined") window.SG_TEILE = SG_TEILE;
})();
