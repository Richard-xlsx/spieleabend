// Kerker-Kart: Strecken aus Abschnitten.
// Ein Rundkurs besteht aus 6 Abschnitten. Jeder Abschnitt hat feste Anfangs- und Endpunkte (Knoten) und 1 bis 3 Varianten.
// Vor jedem Rennen wird gewürfelt, welche Variante drankommt. Alle Handys bauen aus demselben Streckencode dieselbe Strecke.
//
// Eine Variante besteht aus Zwischenpunkten (x, z) und Dingen, die an Stellen des Abschnitts stehen.
// Stellen sind Anteile u von 0 (Anfang des Abschnitts) bis 1 (Ende). Seiten: +1 / -1 quer zur Fahrtrichtung,
// "innen" heißt: zur Innenseite der Kurve (wird beim Bauen ausgerechnet).

const KERKER_KNOTEN = [[0, 0], [150, -8], [196, -150], [92, -236], [-64, -226], [-170, -112]];

const KERKER = [
  { name: "Start", varianten: [
    { name: "Wachstube, lange Gerade", punkte: [[75, -4]],
      dinge: [{ art: "haus", bei: .45, seite: 1, w: 24, h: 8, d: 12, farbe: "#6E655C", schild: "WACHSTUBE" }], truhen: [.75] },
    { name: "Wachstube mit Fass-Schikane", punkte: [[46, -1], [76, -9], [108, 1]],
      dinge: [{ art: "haus", bei: .3, seite: 1, w: 24, h: 8, d: 12, farbe: "#6E655C", schild: "WACHSTUBE" },
        { art: "faesser", stuecke: [[.42, 3.5], [.45, 2.2], [.62, -3.6], [.65, -2.2], [.8, 3.4]] }], truhen: [.92] }
  ] },
  { name: "Zellengang", varianten: [
    { name: "Zellengang mit Fallgitter-Gabelung", punkte: [[192, -38], [206, -96]],
      dinge: [{ art: "haus", bei: .5, seite: 1, w: 20, h: 9, d: 12, farbe: "#655C54", schild: "VERLIES", gitter: true },
        { art: "gabel", von: .3, bis: .72 }], truhen: [.12] },
    { name: "Lorenbahn-Abkürzung", punkte: [[188, -34], [214, -84], [210, -122]],
      dinge: [{ art: "lore", seite: "innen", von: .12, weiche: .5, bis: .86 }], truhen: [.92] },
    { name: "Folterkammer mit Pendelbeilen", punkte: [[178, -40], [206, -78], [200, -118]],
      dinge: [{ art: "haus", bei: .55, seite: "aussen", w: 18, h: 8, d: 12, farbe: "#5B514A", schild: "FOLTERKAMMER" },
        { art: "pendel", bei: [.38, .5, .62] }], truhen: [.15] }
  ] },
  { name: "Abstieg", varianten: [
    { name: "Treppe hinab mit Sprung", punkte: [[182, -204], [138, -236]],
      dinge: [{ art: "rampe", von: .2, bis: .28, h: 2.4 }], truhen: [.6] },
    { name: "Rutsche durch den Abfluss", punkte: [[206, -206], [164, -250], [124, -246]],
      dinge: [{ art: "nass", von: .12, bis: .88 }], truhen: [.95] }
  ] },
  { name: "Thronsaal", varianten: [
    { name: "Thronsaal des Knochenkönigs", punkte: [[14, -244]],
      dinge: [{ art: "rampe", von: .38, bis: .45, h: 2.1, treppe: true }, { art: "koenig", bei: .47, seite: "aussen" },
        { art: "haus", bei: .62, seite: "aussen", w: 40, h: 14, d: 16, farbe: "#5E564F", schild: "THRONSAAL" }], truhen: [.85] }
  ] },
  { name: "Gewölbe", varianten: [
    { name: "Schatzkammer mit brüchiger Wand", punkte: [[-118, -226], [-160, -196]],
      dinge: [{ art: "wand", von: .25, bis: .62 }, { art: "haus", bei: .48, seite: "aussen", w: 22, h: 10, d: 14, farbe: "#6A5F55", schild: "SCHATZKAMMER" }], truhen: [.85] },
    { name: "Trollhöhle mit Bauch-Sprung", punkte: [[-150, -236], [-196, -220], [-190, -184], [-128, -182], [-112, -150]],
      dinge: [{ art: "troll", bei: .16 }], truhen: [.66] },
    { name: "Waffenkammer mit Rüstungen", punkte: [[-112, -232], [-156, -204]],
      dinge: [{ art: "haus", bei: .5, seite: "aussen", w: 16, h: 9, d: 22, farbe: "#5F5850", schild: "WAFFENKAMMER" },
        { art: "ruestung", stuecke: [[.3, 2.6], [.42, -3.2], [.55, .4], [.68, 3.4], [.78, -2.4]] }], truhen: [.12] }
  ] },
  { name: "Heimweg", varianten: [
    { name: "Burggraben-Brücke", punkte: [[-150, -44], [-86, -2]],
      dinge: [{ art: "bruecke", von: .3, bis: .62 }], truhen: [.82] },
    { name: "Kanalisation mit Ratten", punkte: [[-182, -52], [-128, -8], [-64, 6]],
      dinge: [{ art: "nass", von: .15, bis: .7, kanal: true }, { art: "ratten", bei: [.3, .55] }], truhen: [.85] }
  ] }
];

// Spinnengrotte: Leuchtpilze, Netze, Schluchten. Wer in eine Schlucht fällt, wird von Fledermäusen zurückgetragen.
const GROTTE_KNOTEN = [[0, 0], [160, 10], [225, -95], [190, -220], [30, -250], [-110, -150]];
const GROTTE = [
  { name: "Start", varianten: [
    { name: "Pilzhain", punkte: [[80, 8]],
      dinge: [{ art: "pilzhaus", bei: .45, seite: 1 }], truhen: [.75] },
    { name: "Tropfstein-Slalom", punkte: [[50, 4], [85, -4], [120, 10]],
      dinge: [{ art: "tropfstein", stuecke: [[.38, 3.4], [.44, 1.8], [.6, -3.5], [.66, -1.8], [.82, 3]] }], truhen: [.93] }
  ] },
  { name: "Schlucht", varianten: [
    { name: "Schluchtkante", punkte: [[205, -10], [228, -50]],
      dinge: [{ art: "schlucht", von: .15, bis: .85, seite: "aussen" }], truhen: [.1] },
    { name: "Pilzsprung über die Schlucht", punkte: [[205, 22], [265, 22], [292, -8], [268, -42], [232, -50]],
      dinge: [{ art: "schlucht", von: .08, bis: .78, seite: "innen" }, { art: "pilzsprung", bei: .17 }], truhen: [.88] }
  ] },
  { name: "Tiefe", varianten: [
    { name: "Netztunnel", punkte: [[248, -150], [230, -200]],
      dinge: [{ art: "tunnel", von: .22, bis: .7 }], truhen: [.9] },
    { name: "Ufer am Höhlensee", punkte: [[262, -142], [240, -210]],
      dinge: [{ art: "nass", von: .12, bis: .88, see: true }], truhen: [.95] }
  ] },
  { name: "Nest", varianten: [
    { name: "Nest der Spinnenkönigin", punkte: [[110, -252]],
      dinge: [{ art: "koenigin", bei: .5, seite: "aussen" }, { art: "nestdeko", bei: .5 }], truhen: [.85] }
  ] },
  { name: "Brut", varianten: [
    { name: "Eierkammer", punkte: [[-30, -240], [-80, -205]],
      dinge: [{ art: "spinnen", bei: [.35, .6] }, { art: "eier", bei: .48, seite: "aussen" }], truhen: [.85] },
    { name: "Hängebrücke über die Schlucht", punkte: [[-40, -246], [-85, -200]],
      dinge: [{ art: "haengebruecke", von: .3, bis: .66 }], truhen: [.86] }
  ] },
  { name: "Heimweg", varianten: [
    { name: "Kristallhöhle", punkte: [[-105, -75], [-60, -20]],
      dinge: [{ art: "kristall", stuecke: [[.3, 3.2], [.42, -3], [.55, .3], [.68, 3.3], [.78, -2.6]] }], truhen: [.12] },
    { name: "Tropfende Decke", punkte: [[-120, -80], [-70, -15]],
      dinge: [{ art: "tropfen", bei: [.3, .42, .54, .66] }], truhen: [.12] }
  ] }
];

// Glutschlund: Lava, Obsidian, rotes Licht. Wer in die Lava fährt, wird von Fledermäusen herausgeholt.
const GLUT_KNOTEN = [[0, 0], [150, 0], [230, -110], [170, -240], [10, -255], [-120, -140]];
const GLUT = [
  { name: "Start", varianten: [
    { name: "Obsidiantor", punkte: [[75, -3]],
      dinge: [{ art: "haus", bei: .45, seite: 1, w: 24, h: 8, d: 12, farbe: "#3A2F33", schild: "SCHMIEDE" }], truhen: [.75] },
    { name: "Lavafall-Gerade", punkte: [[50, 3], [105, -3]],
      dinge: [{ art: "lava", von: .3, bis: .8, seite: 1 }], truhen: [.92] }
  ] },
  { name: "Lavasee", varianten: [
    { name: "Uferweg am Lavasee", punkte: [[200, -18], [228, -58]],
      dinge: [{ art: "lava", von: .15, bis: .85, seite: "aussen" }], truhen: [.1] },
    { name: "Geysirsprung über den Lavasee", punkte: [[200, 20], [262, 22], [292, -10], [270, -48], [236, -60]],
      dinge: [{ art: "lava", von: .08, bis: .8, seite: "innen" }, { art: "geysirsprung", bei: .19 }], truhen: [.9] }
  ] },
  { name: "Glutfelder", varianten: [
    { name: "Geysirfeld", punkte: [[244, -160], [218, -215]],
      dinge: [{ art: "geysire", stuecke: [[.26, -3], [.4, 3.2], [.54, -.4], [.68, 3.4], [.8, -3.2]] }], truhen: [.1] },
    { name: "Sinkende Steine", punkte: [[234, -140], [254, -144], [272, -158], [274, -176], [258, -190], [236, -192], [226, -214]],
      dinge: [{ art: "lava", von: .13, bis: .66, seite: "innen" }, { art: "steine", bei: .14 }], truhen: [.9] }
  ] },
  { name: "Drachenhorst", varianten: [
    { name: "Horst des Glutdrachen", punkte: [[90, -264]],
      dinge: [{ art: "drache", bei: .45, seite: "aussen" }, { art: "lava", von: .62, bis: .9, seite: "innen" }], truhen: [.25] }
  ] },
  { name: "Schlund", varianten: [
    { name: "Einstürzende Brücke", punkte: [[-15, -258], [-24, -278], [-42, -294], [-64, -294], [-78, -278], [-74, -260], [-90, -232]],
      dinge: [{ art: "lava", von: .09, bis: .56, seite: "innen" }, { art: "einsturz", bei: .1 }], truhen: [.8] },
    { name: "Schlackehalde", punkte: [[-50, -240], [-98, -200]],
      dinge: [{ art: "obsidian", stuecke: [[.3, 3.2], [.42, -3], [.55, .3], [.68, 3.3], [.78, -2.6]] }], truhen: [.12] }
  ] },
  { name: "Heimweg", varianten: [
    { name: "Kettenbrücke über die Glut", punkte: [[-140, -60], [-80, -5]],
      dinge: [{ art: "bruecke", von: .3, bis: .62 }], truhen: [.82] },
    { name: "Aschegang mit Lavaspalte", punkte: [[-150, -70], [-95, -12], [-45, 2]],
      dinge: [{ art: "rampe", von: .3, bis: .38, h: 2.4 }, { art: "spalte", bei: .38 }], truhen: [.85] }
  ] }
];

export const WELTEN = {
  kerker: { name: "Kerker", code: "KERKER", knoten: KERKER_KNOTEN, abschnitte: KERKER },
  grotte: { name: "Spinnengrotte", code: "GROTTE", knoten: GROTTE_KNOTEN, abschnitte: GROTTE },
  glut: { name: "Glutschlund", code: "GLUT", knoten: GLUT_KNOTEN, abschnitte: GLUT },
};

// Zufall mit Startwert (für alle Handys gleich)
export function rng(seed) { let s = (seed >>> 0) % 2147483646 + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// Plan: welche Variante je Abschnitt plus Startwert für Kleinkram (Deko, Mimiks, Gitter-Takt)
export function planWuerfeln(welt, zufall = Math.random) {
  if (!WELTEN[welt]) welt = Object.keys(WELTEN)[Math.floor(zufall() * Object.keys(WELTEN).length)];
  return { w: welt, v: WELTEN[welt].abschnitte.map(a => Math.floor(zufall() * a.varianten.length)), s: Math.floor(zufall() * 65536) };
}
// Streckencode wie KERKER-1203-7F3A: Ziffern = Varianten, dahinter der Startwert
export function planCode(p) { return (WELTEN[p.w] || WELTEN.kerker).code + "-" + p.v.join("") + "-" + p.s.toString(16).toUpperCase().padStart(4, "0"); }
export function planAusCode(c) {
  const m = /^([A-Z]+)-(\d{6})-([0-9A-F]{1,4})$/i.exec(String(c || "").trim());
  if (!m) return null;
  const w = Object.keys(WELTEN).find(k => WELTEN[k].code === m[1].toUpperCase()); if (!w) return null;
  const v = [...m[2]].map(Number);
  if (v.some((x, i) => x >= WELTEN[w].abschnitte[i].varianten.length)) return null;
  return { w, v, s: parseInt(m[3], 16) };
}
// Kontrollpunkte des Rundkurses und je Abschnitt der Index des ersten Punktes
const MASS = .85;      // alle Punkte werden so verkleinert (eine Runde dauert dann etwa 40 Sekunden)
export function kontrollpunkte(p) {
  const kp = [], start = [];
  const W = WELTEN[p.w] || WELTEN.kerker;
  W.abschnitte.forEach((a, i) => { start.push(kp.length); kp.push(W.knoten[i]); kp.push(...a.varianten[p.v[i]].punkte); });
  return { kp: kp.map(([x, z]) => [x * MASS, z * MASS]), start };
}
