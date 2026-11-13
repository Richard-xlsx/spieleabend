// Verlies zu dritt: Spielregeln ohne Netzwerk und ohne Oberfläche.
// Der ganze Spielstand steckt in S (wird nach jeder Änderung an alle geschickt). Zufall kommt aus S.rng,
// damit ein übernehmender Spielleiter genau dort weitermacht, wo der alte aufgehört hat.
// Ablauf: Lobby (Rolle wählen, 6 Rollen, höchstens 3 Helden) → 7 Räume (vor jedem Raum Abstimmung über zwei Türen)
// → Endgegner in Raum 8. Nach Raum 2, 4 und 7 schlägt ein Händler sein Lager auf; jeder kauft mit seinem eigenen Gold.
(function () {
  const RAEUME = 8;
  const LAGER_NACH = [2, 4, 7];
  const MAX_HELDEN = 3;
  const kopie = x => JSON.parse(JSON.stringify(x));

  // ---------- Zufall ----------
  function zufall(S) {
    let t = S.rng = (S.rng + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const wurf = (S, a, b) => a + Math.floor(zufall(S) * (b - a + 1));
  const chance = (S, p) => zufall(S) < p;
  const eins = (S, l) => l[Math.floor(zufall(S) * l.length)];

  // ---------- Helden ----------
  const ROLLEN = {
    kaempfer: { name: "Kämpfer", hp: 34, kurz: "Hält viel aus, zieht Angriffe auf sich" },
    dieb: { name: "Dieb", hp: 29, kurz: "Hoher Schaden, Gift, versteckt sich" },
    heilerin: { name: "Heilerin", hp: 26, kurz: "Heilt und holt Bewusstlose zurück" },
    magierin: { name: "Magierin", hp: 23, kurz: "Feuer gegen alle, Eis lähmt Gegner" },
    waldlaeufer: { name: "Waldläufer", hp: 28, kurz: "Pfeile, markiert Ziele für alle" },
    paladin: { name: "Paladin", hp: 32, kurz: "Beschützt andere, heilt ein wenig" }
  };
  const ROLLEN_REIHE = ["kaempfer", "paladin", "dieb", "waldlaeufer", "magierin", "heilerin"];
  // ziel: "gegner" = einen Gegner antippen, "held" = einen Helden antippen, "anderer" = einen anderen Helden,
  // null = ohne Ziel. cd = Abklingzeit in Runden. Heilende Fähigkeiten wecken Bewusstlose.
  const AKTIONEN = {
    kaempfer: [
      { id: "schlag", name: "Schwerthieb", ziel: "gegner", text: "6–8 Schaden" },
      { id: "schild", name: "Schildwall", ziel: null, cd: 2, text: "Alle Gegner greifen dich an, du nimmst nur halben Schaden" },
      { id: "wirbel", name: "Wirbelschlag", ziel: null, cd: 2, text: "4 Schaden an allen Gegnern" }
    ],
    dieb: [
      { id: "dolch", name: "Dolchstich", ziel: "gegner", text: "6–8 Schaden, jeder dritte trifft doppelt" },
      { id: "gift", name: "Giftklinge", ziel: "gegner", cd: 2, text: "3 Schaden, dann 3 Runden je 3 Gift" },
      { id: "verstecken", name: "In die Schatten", ziel: null, cd: 3, text: "Niemand greift dich an, dein nächster Dolchstich trifft dreifach" }
    ],
    heilerin: [
      { id: "stab", name: "Lichtstab", ziel: "gegner", text: "4–6 Schaden" },
      { id: "heilen", name: "Heilen", ziel: "held", text: "+10 Leben, weckt Bewusstlose" },
      { id: "segen", name: "Segen", ziel: null, cd: 3, text: "Alle +6 Leben, nächster Angriff +3" }
    ],
    magierin: [
      { id: "funken", name: "Funkenstrahl", ziel: "gegner", text: "5–7 Schaden" },
      { id: "feuerball", name: "Feuerball", ziel: null, cd: 2, text: "5 Schaden an allen Gegnern" },
      { id: "eis", name: "Eislanze", ziel: "gegner", cd: 3, text: "7–9 Schaden, das Ziel erstarrt und greift diese Runde nicht an" }
    ],
    waldlaeufer: [
      { id: "pfeil", name: "Pfeilschuss", ziel: "gegner", text: "6–8 Schaden" },
      { id: "doppel", name: "Doppelschuss", ziel: null, cd: 2, text: "Zwei Pfeile, je 5 Schaden an zufälligen Gegnern" },
      { id: "markieren", name: "Markieren", ziel: "gegner", cd: 3, text: "4 Schaden, 3 Runden lang trifft jeder dieses Ziel +3" }
    ],
    paladin: [
      { id: "hammer", name: "Hammerschlag", ziel: "gegner", text: "5–7 Schaden" },
      { id: "handauflegen", name: "Handauflegen", ziel: "held", cd: 2, text: "+8 Leben, weckt Bewusstlose" },
      { id: "beschuetzen", name: "Beschützen", ziel: "anderer", cd: 2, text: "Angriffe auf diesen Helden treffen dich, 2 Schaden weniger" }
    ]
  };
  // beim Händler lernbar (je Rolle zwei, Preis in Gold)
  const LERNBAR = {
    kaempfer: [
      { id: "vernichten", name: "Vernichtender Hieb", ziel: "gegner", cd: 3, preis: 35, text: "13–17 Schaden" },
      { id: "kriegsschrei", name: "Kriegsschrei", ziel: null, cd: 3, preis: 45, text: "Alle: nächster Angriff +3, du +6 Leben" }
    ],
    dieb: [
      { id: "taschendieb", name: "Taschendieb", ziel: "gegner", cd: 2, preis: 30, text: "4 Schaden und 6–10 Gold für dich" },
      { id: "rauch", name: "Rauchbombe", ziel: null, cd: 4, preis: 45, text: "Diese Runde geht jeder zweite Gegnerangriff daneben" }
    ],
    heilerin: [
      { id: "laeutern", name: "Läuterung", ziel: null, cd: 2, preis: 35, text: "Alle +6 Leben, Gift wird geheilt" },
      { id: "wiedergeburt", name: "Wiedergeburt", ziel: null, cd: 5, preis: 50, text: "Bewusstlose stehen mit halben Leben auf, alle anderen +5" }
    ],
    magierin: [
      { id: "arkan", name: "Arkaner Schild", ziel: "held", cd: 3, preis: 35, text: "Dieser Held nimmt diese Runde keinen Schaden" },
      { id: "meteor", name: "Meteor", ziel: null, cd: 4, preis: 50, text: "11 Schaden an allen Gegnern" }
    ],
    waldlaeufer: [
      { id: "hagel", name: "Pfeilhagel", ziel: null, cd: 3, preis: 40, text: "Vier Pfeile, je 5 Schaden an zufälligen Gegnern" },
      { id: "kraeuter", name: "Kräuterkunde", ziel: "held", cd: 2, preis: 30, text: "+9 Leben und Gift weg, weckt Bewusstlose" }
    ],
    paladin: [
      { id: "licht", name: "Heiliges Licht", ziel: null, cd: 3, preis: 40, text: "5 Schaden an allen Gegnern, alle Helden +4" },
      { id: "fels", name: "Unerschütterlich", ziel: null, cd: 4, preis: 45, text: "Alle Gegner greifen dich an, du nimmst keinen Schaden" }
    ]
  };
  const TRANK = { id: "trank", name: "Heiltrank", ziel: null, text: "+14 Leben für dich" };

  // ---------- Erfahrung, Stufen, Ränge ----------
  // EP_STUFEN[i] = EP, ab denen Stufe i+1 erreicht ist. Jede neue Stufe: +3 Höchstleben und 1 Fähigkeitspunkt.
  const EP_STUFEN = [0, 15, 35, 60, 90, 125, 165, 210];
  const MAX_STUFE = EP_STUFEN.length;
  const MAX_RANG = 3;
  // Was ein Rang bringt: schaden = +n Schaden je Rang über I, heil = +n Leben, cd = Abklingzeit −1, gift = +1 Gift je Runde
  const RANG = {
    schlag: ["schaden", 2], vernichten: ["schaden", 3], dolch: ["schaden", 2], stab: ["schaden", 2], funken: ["schaden", 2],
    pfeil: ["schaden", 2], hammer: ["schaden", 2], eis: ["schaden", 2], markieren: ["schaden", 2], taschendieb: ["schaden", 2],
    wirbel: ["schaden", 2], feuerball: ["schaden", 2], meteor: ["schaden", 3], licht: ["schaden", 2], doppel: ["schaden", 1], hagel: ["schaden", 1],
    heilen: ["heil", 3], handauflegen: ["heil", 3], kraeuter: ["heil", 3], segen: ["heil", 2], laeutern: ["heil", 2],
    gift: ["gift", 1],
    schild: ["cd"], verstecken: ["cd"], rauch: ["cd"], arkan: ["cd"], beschuetzen: ["cd"], fels: ["cd"], kriegsschrei: ["cd"], wiedergeburt: ["cd"]
  };
  const rangVon = (h, id) => (h.rang && h.rang[id]) || 1;
  const rangPlus = (h, id, art) => { const r = RANG[id]; return r && r[0] === art ? (rangVon(h, id) - 1) * (r[1] || 1) : 0; };
  function cdVon(h, a) {
    if (!a.cd) return 0;
    return RANG[a.id] && RANG[a.id][0] === "cd" ? Math.max(1, a.cd - (rangVon(h, a.id) - 1)) : a.cd;
  }
  // Text für den nächsten Rang (oder null, wenn es keinen gibt)
  function rangText(h, a) {
    const r = RANG[a.id]; if (!r) return null;
    if (r[0] === "schaden") return `+${r[1]} Schaden${a.id === "doppel" || a.id === "hagel" ? " je Pfeil" : ""}`;
    if (r[0] === "heil") return `+${r[1]} Leben`;
    if (r[0] === "gift") return "+1 Gift je Runde";
    return cdVon(h, a) > 1 ? "1 Runde schneller wieder bereit" : null;
  }
  function stufeAus(ep) { let st = 1; for (let i = 0; i < EP_STUFEN.length; i++) if (ep >= EP_STUFEN[i]) st = i + 1; return st; }
  const alleAktionen = rolle => AKTIONEN[rolle].concat(LERNBAR[rolle]);
  function aktionenVon(h) {
    const l = AKTIONEN[h.rolle].concat(LERNBAR[h.rolle].filter(a => h.gelernt.includes(a.id)));
    if (h.traenke > 0) l.push(TRANK);
    return l;
  }

  // ---------- Händler ----------
  const MAX = { waffe: 4, ruestung: 3, leben: 3, traenke: 3 };
  function angebot(h) {
    const l = [
      { id: "waffe", name: "Waffe schärfen", text: `+1 Schaden bei jedem Angriff (jetzt +${h.waffe})`, preis: 15 + 15 * h.waffe, aus: h.waffe >= MAX.waffe },
      { id: "ruestung", name: "Rüstung verstärken", text: `−1 Schaden pro Treffer (jetzt −${h.ruestung})`, preis: 15 + 15 * h.ruestung, aus: h.ruestung >= MAX.ruestung },
      { id: "leben", name: "Stärkungselixier", text: `+6 Höchstleben (jetzt ${h.max})`, preis: 25, aus: h.leben >= MAX.leben },
      { id: "trank", name: "Heiltrank", text: `+14 Leben im Kampf (du hast ${h.traenke}, höchstens ${MAX.traenke})`, preis: 10, aus: h.traenke >= MAX.traenke }
    ];
    for (const a of LERNBAR[h.rolle]) l.push({ id: "lernen:" + a.id, name: "Lernen: " + a.name, text: a.text + (a.cd ? `, alle ${a.cd + 1} Runden` : ""), preis: a.preis, aus: h.gelernt.includes(a.id), faehigkeit: true });
    return l;
  }

  // ---------- Gegner ----------
  const GEGNER = {
    ratte: { name: "Riesenratte", hp: 15, dmg: [3, 4], ep: 8 },
    goblin: { name: "Goblin", hp: 19, dmg: [3, 5], ep: 10 },
    spinne: { name: "Höhlenspinne", hp: 19, dmg: [3, 4], gift: true, ep: 11 },
    skelett: { name: "Skelett", hp: 30, dmg: [5, 7], ep: 15 },
    schamane: { name: "Goblin-Schamane", hp: 20, dmg: [3, 4], heiler: true, ep: 14 },
    ork: { name: "Ork", hp: 48, dmg: [7, 9], ep: 22 },
    koenig: { name: "Der Knochenkönig", hp: 260, dmg: [9, 13], boss: true, ep: 0 }
  };
  const GRUPPEN = [
    [["ratte", "ratte"], ["goblin", "ratte"], ["spinne", "ratte"]],
    [["skelett", "goblin"], ["spinne", "spinne"], ["ork"], ["goblin", "goblin", "ratte"]],
    [["ork", "skelett"], ["skelett", "skelett", "schamane"], ["ork", "schamane"], ["spinne", "skelett", "goblin"]]
  ];
  const stufe = nr => (nr <= 3 ? 0 : nr <= 5 ? 1 : 2);
  function gegnerErzeugen(S, art) {
    // zu zweit schwächer; je tiefer, desto zäher (Helden steigen ja auch auf)
    const g = GEGNER[art], f = (S.teilnehmer.length === 2 ? 0.55 : 1) * (g.boss ? 1 : 1 + 0.06 * Math.max(0, S.raumNr - 1));
    const hp = Math.max(4, Math.round(g.hp * f));
    S.gegnerNr = (S.gegnerNr || 0) + 1;
    return { id: "g" + S.gegnerNr, art, name: g.name, hp, max: hp, gift: 0, giftR: 0, starr: 0, markiert: 0 };
  }

  // ---------- Räume ----------
  const TUERTYPEN = [["kampf", 50], ["schatz", 15], ["rast", 13], ["ereignis", 22]];
  const TUERBILD = {
    kampf: ["Kratzspuren am Holz, dahinter Knurren", "Frische Spuren im Staub", "Waffengeklirr hinter der Tür", "Ein fauliger Geruch"],
    schatz: ["Ein goldener Schimmer unter der Tür", "Ein Schloss mit Edelsteinbesatz", "Es klimpert leise"],
    rast: ["Warme Luft und Holzrauch", "Leises Wasserplätschern", "Eine Tür mit eingeritzter Sonne"],
    ereignis: ["Seltsame Zeichen am Türrahmen", "Eine Stimme flüstert", "Die Tür ist halb offen, Licht flackert"]
  };
  const TEXTE = {
    eingang: ["Feuchte Stufen führen hinab. Hinter euch fällt das Gitter ins Schloss. Irgendwo tief unten sitzt der Knochenkönig auf seinem Thron, und er erwartet keine Gäste."],
    kampf: ["Kaum seid ihr drin, rührt sich etwas in der Dunkelheit.", "Knochen knirschen unter euren Stiefeln. Ihr seid nicht allein.",
      "Eine Fackel flammt auf und zeigt, wer hier wohnt.", "Ein Hinterhalt! Sie haben auf euch gewartet."],
    schatz: ["Mitten im Raum steht eine schwere, beschlagene Truhe.", "In einer Nische wartet eine staubige Truhe. Das Schloss ist alt, aber kunstvoll."],
    rast: ["Ein stiller Raum mit einer kalten Feuerstelle. Ihr macht Feuer, verbindet eure Wunden und atmet durch.",
      "Eine Quelle sprudelt aus dem Fels. Das Wasser ist klar und kalt. Für einen Moment ist es ruhig."],
    boss: ["Ein Thronsaal aus Gebeinen. Grünes Licht flackert in leeren Augenhöhlen. Der Knochenkönig erhebt sich: „Noch mehr Knochen für meine Sammlung.“"],
    lager: ["Zwischen zwei Gängen brennt eine Laterne. Ein Händler mit Kapuze hat seinen Karren abgestellt: „Klingen, Rüstung, Tränke. Und ein paar Kniffe, die man nicht in Büchern findet.“",
      "Der Kapuzenhändler wartet schon. „Ihr lebt noch? Gut fürs Geschäft.“",
      "Vor dem großen Tor hat der Händler ein letztes Mal sein Lager aufgeschlagen. „Da drin braucht ihr alles, was ihr tragen könnt.“"]
  };
  const EREIGNISSE = {
    brunnen: { titel: "Ein alter Brunnen", text: "Moos überwuchert die Steine. Das Wasser leuchtet schwach blau.", optionen: ["Daraus trinken", "Lieber nicht"] },
    troll: { titel: "Ein schlafender Troll", text: "Er schnarcht vor einem Haufen Münzen. Sein Atem riecht nach Zwiebeln.", optionen: ["Vorbeischleichen und Gold nehmen", "Leise umkehren"] },
    haendler: { titel: "Ein Händler in Kapuze", text: "„Tränke, frisch gebraut! 8 Gold das Stück, heute günstiger.“ Er zeigt keine Hände.", optionen: ["Jeder kauft einen Trank", "Weitergehen"] },
    altar: { titel: "Ein Altar mit Inschrift", text: "„Gib Gold, und das Leben wird stärker.“ Eine Schale wartet.", optionen: ["Jeder opfert 15 Gold", "Nichts geben"] },
    bruecke: { titel: "Eine wackelige Brücke", text: "Unter euch nur Dunkelheit. Die Seile ächzen.", optionen: ["Vorsichtig hinübertasten", "Hinüberrennen"] }
  };

  // ---------- Neues Spiel ----------
  function neu(code, hostPid, hostName, seed) {
    return {
      v: 2, spiel: "verlies", code, epoch: 0, host: hostPid, phase: "lobby",
      spieler: { [hostPid]: { name: hostName } }, reihenfolge: [hostPid], rollen: {},
      teilnehmer: [], helden: {}, gegner: [], raumNr: 0, seite: null, entscheidung: null, kampf: null, lager: null,
      log: [], benutzt: [], rng: (seed >>> 0) || 1, spielNr: 0, aenderung: Date.now()
    };
  }
  const lebend = S => S.teilnehmer.filter(p => S.helden[p].hp > 0);
  const gegnerLebend = S => S.gegner.filter(g => g.hp > 0);
  const heldName = (S, p) => (S.spieler[p] ? S.spieler[p].name : "?");
  const goldSumme = S => S.teilnehmer.reduce((a, p) => a + S.helden[p].gold, 0);

  function heldHeilen(S, p, n) {
    const h = S.helden[p], war = h.hp;
    h.hp = Math.min(h.max, h.hp + n);
    return h.hp - war;
  }
  // Gold für jeden: gibt Text zurück
  function goldFuerJeden(S, a, b) {
    const n = wurf(S, a, b);
    for (const p of S.teilnehmer) S.helden[p].gold += n;
    return `+${n} Gold für jeden.`;
  }

  // ---------- Entscheidungen (Türen, Ereignisse, Weiter) ----------
  function entscheiden(S, art, frage, optionen, extra) {
    S.entscheidung = Object.assign({ art, frage, optionen, stimmen: {} }, extra || {});
  }
  const EREIGNISSE_FREI = S => Object.keys(EREIGNISSE).filter(e => !S.benutzt.includes(e));
  function tuerenZeigen(S) {
    const nr = S.raumNr + 1;
    S.phase = "erkunden";
    if (nr >= RAEUME) {
      S.seite = { bild: "boss-tuer", titel: "Das große Tor", text: ["Vor euch ragt ein Tor aus schwarzem Eisen auf. Dahinter: der Thronsaal."] };
      entscheiden(S, "tuer", "Bereit für den Endkampf?", [{ text: "Tor aufstoßen", typ: "boss" }]);
      return;
    }
    const typen = [];
    while (typen.length < 2) {
      let r = zufall(S) * 100, t = "kampf";
      for (const [x, w] of TUERTYPEN) { if (r < w) { t = x; break; } r -= w; }
      if (t === "ereignis" && !EREIGNISSE_FREI(S).length) t = "kampf";
      if (typen.includes(t) && t !== "kampf") continue;
      if (typen.length === 1 && t === typen[0] && t === "kampf" && chance(S, 0.5)) continue;
      typen.push(t);
    }
    S.seite = { bild: "tueren", titel: `Raum ${nr} von ${RAEUME}`, text: ["Zwei Türen. Was liegt dahinter?"] };
    entscheiden(S, "tuer", "Welche Tür?", typen.map((t, i) => ({ text: (i ? "Rechte" : "Linke") + " Tür", hinweis: eins(S, TUERBILD[t]), typ: t })));
  }
  function weiterziehen(S) {
    S.log = [];
    if (LAGER_NACH.includes(S.raumNr) && !(S.lagerBesucht || []).includes(S.raumNr)) lagerOeffnen(S);
    else tuerenZeigen(S);
  }
  function lagerOeffnen(S) {
    S.lagerBesucht = (S.lagerBesucht || []).concat(S.raumNr);
    const i = LAGER_NACH.indexOf(S.raumNr);
    S.phase = "lager";
    S.entscheidung = null;
    S.lager = { fertig: {}, kaeufe: [] };
    S.seite = { bild: "haendler", titel: "Das Händlerlager", text: [TEXTE.lager[Math.max(0, i)]] };
  }

  function raumBetreten(S, typ) {
    S.raumNr += 1;
    S.log = [];
    if (typ === "boss") {
      S.seite = { bild: "koenig", titel: "Der Thronsaal", text: [TEXTE.boss[0]] };
      kampfStarten(S, ["koenig"]);
    } else if (typ === "kampf") {
      const gruppe = eins(S, GRUPPEN[stufe(S.raumNr)]);
      S.seite = { bild: gruppe[0], titel: `Raum ${S.raumNr}`, text: [eins(S, TEXTE.kampf)] };
      kampfStarten(S, gruppe);
    } else if (typ === "schatz") {
      S.seite = { bild: "truhe", titel: `Raum ${S.raumNr}: Eine Truhe`, text: [eins(S, TEXTE.schatz)] };
      entscheiden(S, "truhe", "Öffnen?", [{ text: "Truhe öffnen" }, { text: "Liegen lassen" }]);
    } else if (typ === "rast") {
      const log = [eins(S, TEXTE.rast)];
      for (const p of S.teilnehmer) { const h = S.helden[p]; heldHeilen(S, p, Math.ceil(h.max * 0.4)); h.cd = {}; }
      log.push("Alle erholen sich um 40 % ihrer Leben. Alle Fähigkeiten sind wieder bereit.");
      S.seite = { bild: "feuer", titel: `Raum ${S.raumNr}: Rast`, text: log };
      entscheiden(S, "weiter", "", [{ text: "Weiterziehen" }]);
    } else {
      const frei = EREIGNISSE_FREI(S), id = eins(S, frei);
      S.benutzt.push(id);
      const e = EREIGNISSE[id];
      S.seite = { bild: id, titel: `Raum ${S.raumNr}: ${e.titel}`, text: [e.text] };
      entscheiden(S, "ereignis", "Was tut ihr?", e.optionen.map(t => ({ text: t })), { id });
    }
    S.phase = S.kampf ? "kampf" : "erkunden";
  }

  function ereignisAusfuehren(S, id, wahl) {
    const t = [], alle = S.teilnehmer, dieb = alle.find(p => S.helden[p].rolle === "dieb" || S.helden[p].rolle === "waldlaeufer");
    if (id === "brunnen") {
      if (wahl === 0) for (const p of alle) {
        const h = S.helden[p];
        if (chance(S, 0.55)) { const n = heldHeilen(S, p, 9); h.max += 2; h.hp += 2; t.push(`${heldName(S, p)} fühlt sich gestärkt: +${n + 2} Leben, Höchstwert +2.`); }
        else { const n = Math.min(4, h.hp - 1); h.hp -= n; t.push(`${heldName(S, p)} wird übel: −${n} Leben.`); }
      } else t.push("Ihr lasst den Brunnen in Ruhe.");
    } else if (id === "troll") {
      if (wahl === 0) {
        if (chance(S, dieb ? 0.85 : 0.5)) t.push(`${dieb ? heldName(S, dieb) + " führt euch lautlos" : "Mit angehaltenem Atem schleicht ihr"} vorbei. ` + goldFuerJeden(S, 12, 18));
        else { t.push("Ein Stein knirscht. Der Troll schlägt im Halbschlaf um sich, bevor ihr flieht."); for (const p2 of alle) { const h = S.helden[p2]; const n = Math.min(6, h.hp - 1); h.hp -= n; t.push(`${heldName(S, p2)}: −${n} Leben.`); } }
      } else t.push("Ihr lasst den Troll schlafen.");
    } else if (id === "haendler") {
      if (wahl === 0) for (const p of alle) {
        const h = S.helden[p];
        if (h.gold >= 8 && h.traenke < MAX.traenke) { h.gold -= 8; h.traenke += 1; t.push(`${heldName(S, p)} kauft einen Trank.`); }
        else t.push(`${heldName(S, p)}: ${h.gold < 8 ? "nicht genug Gold" : "kann keinen Trank mehr tragen"}.`);
      } else t.push("Der Händler zuckt mit den Schultern und verschwindet im Dunkeln.");
    } else if (id === "altar") {
      if (wahl === 0) for (const p of alle) {
        const h = S.helden[p];
        if (h.gold >= 15) { h.gold -= 15; h.max += 5; h.hp += 5; t.push(`${heldName(S, p)}: Höchstwert +5 Leben.`); }
        else t.push(`${heldName(S, p)} hat keine 15 Gold.`);
      } else t.push("Ihr geht am Altar vorbei.");
    } else if (id === "bruecke") {
      for (const p of alle) {
        const h = S.helden[p];
        const n = Math.min(wahl === 0 ? 3 : (chance(S, 0.5) ? 0 : 8), h.hp - 1);
        h.hp -= n; t.push(n ? `${heldName(S, p)} stolpert: −${n} Leben.` : `${heldName(S, p)} kommt heil hinüber.`);
      }
    }
    return t;
  }

  function truheOeffnen(S, wahl) {
    const t = [];
    if (wahl !== 0) { t.push("Ihr lasst die Truhe stehen. Vielleicht besser so."); return t; }
    const dieb = S.teilnehmer.find(p => S.helden[p].rolle === "dieb");
    if (dieb) t.push(`${heldName(S, dieb)} entschärft eine Nadelfalle im Schloss.`);
    else if (chance(S, 0.4)) {
      const p = eins(S, S.teilnehmer), h = S.helden[p], n = Math.min(6, h.hp - 1);
      h.hp -= n; t.push(`Eine Giftnadel! ${heldName(S, p)}: −${n} Leben.`);
    }
    t.push(dieb ? goldFuerJeden(S, 18, 26) : goldFuerJeden(S, 14, 22));
    t.push(...beute(S, 0.6, 0.35));
    return t;
  }
  function beute(S, pTrank, pTeil) {
    const t = [];
    if (chance(S, pTrank)) {
      const frei = S.teilnehmer.filter(p => S.helden[p].traenke < MAX.traenke);
      if (frei.length) { const p = eins(S, frei); S.helden[p].traenke += 1; t.push(`${heldName(S, p)} findet einen Heiltrank.`); }
    }
    if (chance(S, pTeil)) {
      const p = S.teilnehmer.slice().sort((a, b) => (S.helden[a].waffe + S.helden[a].ruestung) - (S.helden[b].waffe + S.helden[b].ruestung))[0];
      const h = S.helden[p];
      if (h.waffe < MAX.waffe && (h.ruestung >= MAX.ruestung || chance(S, 0.5))) { h.waffe += 1; t.push(`${heldName(S, p)} findet eine bessere Waffe: +1 Schaden.`); }
      else if (h.ruestung < MAX.ruestung) { h.ruestung += 1; t.push(`${heldName(S, p)} findet ein Rüstungsteil: −1 Schaden pro Treffer.`); }
    }
    return t;
  }

  // ---------- Kampf ----------
  function kampfStarten(S, gruppe) {
    S.gegner = gruppe.map(a => gegnerErzeugen(S, a));
    S.kampf = { runde: 1, wahl: {}, bossRuf: false, nebel: false };
    for (const p of S.teilnehmer) Object.assign(S.helden[p], { schild: false, versteckt: false, lauer: false, segen: 0, gift: 0, giftR: 0, immun: false, fels: false, beschuetzt: null });
    S.entscheidung = null;
    S.log = [];
  }

  function wahlGueltig(S, pid, m) {
    const h = S.helden[pid];
    if (!h || h.hp <= 0) return false;
    const a = aktionenVon(h).find(x => x.id === m.a);
    if (!a) return false;
    if (a.cd && (h.cd[a.id] || 0) > 0) return false;
    if (a.ziel === "gegner" && !S.gegner.some(g => g.id === m.ziel && g.hp > 0)) return false;
    if (a.ziel === "held" && !S.helden[m.ziel]) return false;
    if (a.ziel === "anderer" && (!S.helden[m.ziel] || m.ziel === pid || S.helden[m.ziel].hp <= 0)) return false;
    return true;
  }
  const HEILEND = { heilen: 1, handauflegen: 1, kraeuter: 1 };
  function standardWahl(S, pid) {
    const h = S.helden[pid], ziel = gegnerLebend(S).sort((a, b) => a.hp - b.hp)[0];
    const heil = aktionenVon(h).find(a => HEILEND[a.id] && !(h.cd[a.id] > 0));
    if (heil) {
      const schwach = S.teilnehmer.filter(p => S.helden[p].hp < S.helden[p].max * 0.5).sort((a2, b) => S.helden[a2].hp - S.helden[b].hp)[0];
      if (schwach) return { a: heil.id, ziel: schwach };
    }
    return { a: AKTIONEN[h.rolle][0].id, ziel: ziel && ziel.id };
  }

  // Schaden eines Helden an einem Gegner (mit Waffe, Segen, Markierung)
  function schadenAnGegner(S, pid, g, n, log, wie, ohneBonus) {
    if (!g || g.hp <= 0) { g = gegnerLebend(S)[0]; if (!g) return; }
    const h = S.helden[pid];
    if (!ohneBonus) { n += h.waffe + (h.segen ? 3 : 0); h.segen = 0; }
    if (g.markiert > 0) n += 3;
    const echt = Math.min(n, g.hp);
    g.hp -= echt; h.stats.schaden += echt;
    log.push(`${heldName(S, pid)} ${wie} ${g.name}: ${n} Schaden${g.hp <= 0 ? ". " + g.name + " fällt!" : "."}`);
  }
  // Flächenschaden: Waffe und Segen zählen einmal, Markierung je Ziel
  function flaeche(S, pid, n, log, text) {
    const h = S.helden[pid];
    n += h.waffe + (h.segen ? 3 : 0); h.segen = 0;
    const getroffen = gegnerLebend(S);
    for (const g of getroffen) { const e = Math.min(n + (g.markiert > 0 ? 3 : 0), g.hp); g.hp -= e; h.stats.schaden += e; }
    log.push(`${heldName(S, pid)} ${text}: ${n} Schaden an allen.` + getroffen.filter(g => g.hp <= 0).map(g => ` ${g.name} fällt!`).join(""));
  }
  function pfeile(S, pid, anzahl, n, log, text) {
    const h = S.helden[pid];
    const bonus = h.waffe + (h.segen ? 3 : 0); h.segen = 0;
    const teile = [];
    for (let i = 0; i < anzahl; i++) {
      const ziele = gegnerLebend(S); if (!ziele.length) break;
      const g = eins(S, ziele), d = n + bonus + (g.markiert > 0 ? 3 : 0), e = Math.min(d, g.hp);
      g.hp -= e; h.stats.schaden += e;
      teile.push(`${g.name} ${d}${g.hp <= 0 ? " (fällt!)" : ""}`);
    }
    log.push(`${heldName(S, pid)} ${text}: ${teile.join(", ")}.`);
  }
  function heilenAuf(S, von, ziel, n, log, wie) {
    const z = S.helden[ziel], war = z.hp, e = heldHeilen(S, ziel, n);
    S.helden[von].stats.geheilt += e;
    log.push(war === 0 ? `${heldName(S, von)} holt ${heldName(S, ziel)} zurück: ${z.hp} Leben.` : `${heldName(S, von)} ${wie} ${ziel === von ? "sich" : heldName(S, ziel)}: +${e} Leben.`);
  }
  function alleHeilen(S, von, n, wecken) {
    let summe = 0;
    for (const q of S.teilnehmer) if (wecken || S.helden[q].hp > 0) summe += heldHeilen(S, q, n);
    S.helden[von].stats.geheilt += summe;
  }

  function rundeAuswerten(S) {
    const log = [], k = S.kampf;
    const reihe = S.teilnehmer.filter(p => S.helden[p].hp > 0 && k.wahl[p]);
    const cd = (h, w) => { const a = alleAktionen(h.rolle).find(x => x.id === w.a); if (a && a.cd) h.cd[a.id] = cdVon(h, a); };
    const rs = (h, id) => rangPlus(h, id, "schaden"), rh = (h, id) => rangPlus(h, id, "heil");
    // 1. Schutz, Heilung und Vorbereitung zuerst, damit sie noch in dieser Runde wirken
    for (const p of reihe) {
      const h = S.helden[p], w = k.wahl[p], n = heldName(S, p);
      cd(h, w);
      switch (w.a) {
        case "schild": h.schild = true; log.push(`${n} hebt den Schild und ruft die Gegner zu sich.`); break;
        case "fels": h.fels = true; h.immun = true; log.push(`${n} steht wie ein Fels. Alle Gegner wenden sich gegen ihn.`); break;
        case "verstecken": h.versteckt = true; h.lauer = true; log.push(`${n} verschwindet in den Schatten.`); break;
        case "rauch": k.nebel = true; log.push(`${n} wirft eine Rauchbombe. Die Gegner sehen kaum noch etwas.`); break;
        case "trank": { h.traenke -= 1; const e = heldHeilen(S, p, 14); log.push(`${n} trinkt einen Heiltrank: +${e} Leben.`); break; }
        case "heilen": heilenAuf(S, p, w.ziel, 10 + rh(h, "heilen"), log, "heilt"); break;
        case "handauflegen": heilenAuf(S, p, w.ziel, 8 + rh(h, "handauflegen"), log, "legt die Hände auf"); break;
        case "kraeuter": { const z = S.helden[w.ziel]; z.gift = 0; z.giftR = 0; heilenAuf(S, p, w.ziel, 9 + rh(h, "kraeuter"), log, "versorgt mit Kräutern"); break; }
        case "segen": { const x = 6 + rh(h, "segen"); alleHeilen(S, p, x); for (const q of lebend(S)) S.helden[q].segen = 1; log.push(`${n} spricht einen Segen: alle +${x} Leben, nächster Angriff +3.`); break; }
        case "laeutern": { const x = 6 + rh(h, "laeutern"); alleHeilen(S, p, x); for (const q of S.teilnehmer) { S.helden[q].gift = 0; S.helden[q].giftR = 0; } log.push(`${n} läutert die Gruppe: alle +${x} Leben, kein Gift mehr.`); break; }
        case "wiedergeburt": {
          const weg = S.teilnehmer.filter(q => S.helden[q].hp <= 0);
          for (const q of S.teilnehmer) { const z = S.helden[q]; h.stats.geheilt += heldHeilen(S, q, z.hp <= 0 ? Math.ceil(z.max / 2) : 5); }
          log.push(`${n} ruft das Leben zurück${weg.length ? ": " + weg.map(q => heldName(S, q)).join(" und ") + " steh" + (weg.length > 1 ? "en" : "t") + " wieder auf" : ""}. Alle anderen +5.`); break;
        }
        case "kriegsschrei": for (const q of lebend(S)) S.helden[q].segen = 1; heldHeilen(S, p, 6); log.push(`${n} brüllt einen Kriegsschrei: alle nächster Angriff +3.`); break;
        case "arkan": S.helden[w.ziel].immun = true; log.push(`${n} legt einen arkanen Schild um ${w.ziel === p ? "sich" : heldName(S, w.ziel)}.`); break;
        case "beschuetzen": S.helden[w.ziel].beschuetzt = p; log.push(`${n} stellt sich vor ${heldName(S, w.ziel)}.`); break;
        case "licht": alleHeilen(S, p, 4); break;     // Schaden folgt unten
      }
    }
    // 2. Angriffe
    for (const p of reihe) {
      if (!gegnerLebend(S).length) break;
      const h = S.helden[p], w = k.wahl[p], ziel = S.gegner.find(g => g.id === w.ziel);
      switch (w.a) {
        case "schlag": schadenAnGegner(S, p, ziel, wurf(S, 6, 8) + rs(h, "schlag"), log, "trifft"); break;
        case "vernichten": schadenAnGegner(S, p, ziel, wurf(S, 13, 17) + rs(h, "vernichten"), log, "spaltet"); break;
        case "stab": schadenAnGegner(S, p, ziel, wurf(S, 4, 6) + rs(h, "stab"), log, "brennt Licht in"); break;
        case "funken": schadenAnGegner(S, p, ziel, wurf(S, 5, 7) + rs(h, "funken"), log, "schleudert Funken auf"); break;
        case "pfeil": schadenAnGegner(S, p, ziel, wurf(S, 6, 8) + rs(h, "pfeil"), log, "schießt auf"); break;
        case "hammer": schadenAnGegner(S, p, ziel, wurf(S, 5, 7) + rs(h, "hammer"), log, "schmettert den Hammer auf"); break;
        case "dolch": {
          let d = wurf(S, 6, 8) + rs(h, "dolch"), wie = "sticht";
          if (h.lauer) { d *= 3; h.lauer = false; wie = "springt aus dem Schatten auf"; }
          else if (chance(S, 0.33)) { d *= 2; wie = "trifft genau"; }
          schadenAnGegner(S, p, ziel, d, log, wie); break;
        }
        case "gift": {
          const z = ziel && ziel.hp > 0 ? ziel : gegnerLebend(S)[0];
          schadenAnGegner(S, p, z, 3, log, "vergiftet");
          if (z && z.hp > 0) { z.gift = 3 + rangPlus(h, "gift", "gift"); z.giftR = 3; }
          break;
        }
        case "taschendieb": {
          const z = ziel && ziel.hp > 0 ? ziel : gegnerLebend(S)[0];
          schadenAnGegner(S, p, z, 4 + rs(h, "taschendieb"), log, "rempelt");
          const g = wurf(S, 6, 10); h.gold += g; log.push(`${heldName(S, p)} erbeutet dabei ${g} Gold.`); break;
        }
        case "eis": {
          const z = ziel && ziel.hp > 0 ? ziel : gegnerLebend(S)[0];
          schadenAnGegner(S, p, z, wurf(S, 7, 9) + rs(h, "eis"), log, "durchbohrt mit Eis");
          if (z && z.hp > 0) { z.starr = 1; log.push(`${z.name} erstarrt.`); }
          break;
        }
        case "markieren": {
          const z = ziel && ziel.hp > 0 ? ziel : gegnerLebend(S)[0];
          schadenAnGegner(S, p, z, 4 + rs(h, "markieren"), log, "markiert und trifft");
          if (z && z.hp > 0) z.markiert = 4;          // zählt am Rundenende herunter: 3 volle Runden
          break;
        }
        case "wirbel": flaeche(S, p, 4 + rs(h, "wirbel"), log, "wirbelt herum"); break;
        case "feuerball": flaeche(S, p, 5 + rs(h, "feuerball"), log, "wirft einen Feuerball"); break;
        case "meteor": flaeche(S, p, 11 + rs(h, "meteor"), log, "ruft einen Meteor herab"); break;
        case "licht": flaeche(S, p, 5 + rs(h, "licht"), log, "lässt heiliges Licht strahlen (alle Helden +4)"); break;
        case "doppel": pfeile(S, p, 2, 5 + rs(h, "doppel"), log, "schießt zwei Pfeile"); break;
        case "hagel": pfeile(S, p, 4, 5 + rs(h, "hagel"), log, "lässt Pfeile regnen"); break;
      }
    }
    // 3. Gift auf Gegnern
    for (const g of gegnerLebend(S)) if (g.giftR > 0) {
      const e = Math.min(g.gift, g.hp); g.hp -= e; g.giftR -= 1;
      const dieb = S.teilnehmer.find(p => S.helden[p].rolle === "dieb"); if (dieb) S.helden[dieb].stats.schaden += e;
      log.push(`Das Gift frisst an ${g.name}: ${e} Schaden${g.hp <= 0 ? ". " + g.name + " fällt!" : "."}`);
    }
    // 4. Endgegner ruft Verstärkung
    const koenig = S.gegner.find(g => g.art === "koenig");
    if (koenig && koenig.hp > 0 && !k.bossRuf && koenig.hp <= koenig.max / 2) {
      k.bossRuf = true;
      S.gegner.push(gegnerErzeugen(S, "skelett"), gegnerErzeugen(S, "skelett"));
      log.push("Der Knochenkönig hebt die Arme. Zwei Skelette kriechen aus dem Boden!");
    }
    // 5. Gegner handeln
    for (const g of gegnerLebend(S)) {
      const art = GEGNER[g.art];
      if (g.starr > 0) { log.push(`${g.name} ist erstarrt und kann nicht angreifen.`); continue; }
      if (art.heiler) {
        const verletzt = gegnerLebend(S).filter(x => x !== g && x.hp < x.max * 0.6).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
        if (verletzt) { const n = Math.min(7, verletzt.max - verletzt.hp); verletzt.hp += n; log.push(`${g.name} murmelt einen Zauber: ${verletzt.name} +${n} Leben.`); continue; }
      }
      if (art.boss && k.runde % 3 === 0) {
        log.push("Der Knochenkönig stampft auf: Der Boden bebt!");
        for (const p of lebend(S)) treffer(S, p, 5, log, null);
        continue;
      }
      if (k.nebel && chance(S, 0.5)) { log.push(`${g.name} schlägt im Rauch ins Leere.`); continue; }
      const zieher = lebend(S).filter(p => S.helden[p].schild || S.helden[p].fels);
      const ziele = lebend(S).filter(p => !S.helden[p].versteckt);
      let p = zieher.length ? eins(S, zieher) : (ziele.length ? eins(S, ziele) : null);
      if (!p) { log.push(`${g.name} sucht vergeblich nach einem Ziel.`); continue; }
      let minus = 0;
      const b = S.helden[p].beschuetzt;
      if (!zieher.length && b && S.helden[b].hp > 0) { log.push(`${heldName(S, b)} fängt den Angriff auf ${heldName(S, p)} ab.`); p = b; minus = 2; }
      treffer(S, p, wurf(S, art.dmg[0], art.dmg[1]) - minus, log, g.name);
      if (art.gift && S.helden[p].hp > 0 && !S.helden[p].immun && chance(S, 0.4)) { S.helden[p].gift = 2; S.helden[p].giftR = 2; log.push(`${heldName(S, p)} ist vergiftet.`); }
    }
    // 6. Gift auf Helden, Rundenende
    for (const p of lebend(S)) {
      const h = S.helden[p];
      if (h.giftR > 0) { const n = Math.min(h.gift, h.hp); h.hp -= n; h.giftR -= 1; log.push(`Gift: ${heldName(S, p)} −${n} Leben${h.hp <= 0 ? " und bricht zusammen!" : "."}`); if (h.hp <= 0) h.stats.umgefallen += 1; }
    }
    for (const p of S.teilnehmer) {
      const h = S.helden[p];
      Object.assign(h, { schild: false, versteckt: false, immun: false, fels: false, beschuetzt: null });
      const benutzt = k.wahl[p] && k.wahl[p].a;
      for (const c in h.cd) if (h.cd[c] > 0 && c !== benutzt) h.cd[c] -= 1;
    }
    for (const g of S.gegner) { if (g.starr > 0) g.starr -= 1; if (g.markiert > 0) g.markiert -= 1; }
    k.nebel = false;
    S.log = log;
    k.wahl = {};
    k.runde += 1;

    if (!gegnerLebend(S).length) kampfGewonnen(S);
    else if (!lebend(S).length) { S.phase = "ende"; S.ergebnis = "niederlage"; S.seite = { bild: "grab", titel: "Ihr seid gefallen", text: ["Die Dunkelheit schließt sich über euch. Der Knochenkönig bekommt neue Knochen für seine Sammlung."] }; S.kampf = null; }
  }
  function treffer(S, p, n, log, von) {
    const h = S.helden[p], wer = heldName(S, p);
    if (h.immun) { log.push(von ? `${von} trifft ${wer}, doch der Schlag prallt ab.` : `${wer} bleibt unversehrt.`); return; }
    n = Math.max(1, n - h.ruestung);
    if (h.schild) n = Math.ceil(n / 2);
    const echt = Math.min(n, h.hp);
    h.hp -= echt;
    log.push((von ? `${von} trifft ${wer}: ` : `${wer}: `) + `−${n} Leben${h.hp <= 0 ? ". " + wer + " bricht zusammen!" : "."}`);
    if (h.hp <= 0) h.stats.umgefallen += 1;
  }
  // EP für alle Helden; gibt Texte zu Stufenaufstiegen zurück
  function erfahrung(S, ep) {
    const t = [];
    if (ep <= 0) return t;
    t.push(`+${ep} Erfahrung für jeden.`);
    for (const p of S.teilnehmer) {
      const h = S.helden[p], vorher = h.stufe;
      h.ep += ep;
      h.stufe = stufeAus(h.ep);
      for (let st = vorher + 1; st <= h.stufe; st++) { h.max += 3; h.hp = Math.min(h.max, h.hp + 3); h.punkte += 1; }
      if (h.stufe > vorher) t.push(`${heldName(S, p)} erreicht Stufe ${h.stufe}: +${3 * (h.stufe - vorher)} Höchstleben, ${h.stufe - vorher === 1 ? "1 Fähigkeitspunkt" : (h.stufe - vorher) + " Fähigkeitspunkte"}.`);
    }
    return t;
  }

  function kampfGewonnen(S) {
    const boss = S.gegner.some(g => g.art === "koenig");
    const t = [];
    const ep = S.gegner.reduce((a, g) => a + (GEGNER[g.art].ep || 0), 0);
    S.kampf = null;
    for (const p of S.teilnehmer) {
      const h = S.helden[p]; h.gift = 0; h.giftR = 0; h.segen = 0; h.lauer = false;
      if (h.hp <= 0) { h.hp = 5; t.push(`${heldName(S, p)} kommt mit 5 Leben wieder zu sich.`); }
    }
    if (boss) {
      const g = goldFuerJeden(S, 40, 50);
      S.phase = "ende"; S.ergebnis = "sieg";
      S.seite = { bild: "krone", titel: "Der Knochenkönig ist besiegt!", text: ["Sein Thron zerfällt zu Staub. Unter den Trümmern: sein Schatz.", g].concat(t) };
      return;
    }
    const s = stufe(S.raumNr);
    S.seite = { bild: "sieg", titel: `Raum ${S.raumNr}: geschafft`, text: ["Alle Gegner sind besiegt. " + goldFuerJeden(S, 9 + 9 * s, 13 + 11 * s)].concat(erfahrung(S, ep), t, beute(S, 0.4, 0.15)) };
    S.phase = "erkunden";
    entscheiden(S, "weiter", "", [{ text: "Weiterziehen" }]);
  }

  function entscheidungAufloesen(S) {
    const e = S.entscheidung, zaehl = e.optionen.map(() => 0);
    for (const p in e.stimmen) if (e.optionen[e.stimmen[p]]) zaehl[e.stimmen[p]]++;
    const max = Math.max(...zaehl);
    const beste = zaehl.map((z, i) => (z === max ? i : -1)).filter(i => i >= 0);
    const wahl = beste.length === 1 ? beste[0] : eins(S, beste);
    S.entscheidung = null;
    if (e.art === "tuer") { raumBetreten(S, e.optionen[wahl].typ); return; }
    if (e.art === "weiter") { weiterziehen(S); return; }
    const t = e.art === "truhe" ? truheOeffnen(S, wahl) : ereignisAusfuehren(S, e.id, wahl);
    t.push(...erfahrung(S, 8));            // auch Truhen und Ereignisse bringen etwas Erfahrung
    S.seite = Object.assign({}, S.seite, { text: S.seite.text.concat([`Ihr entscheidet: ${e.optionen[wahl].text}.`], t) });
    entscheiden(S, "weiter", "", [{ text: "Weiterziehen" }]);
  }

  function kaufen(S, pid, id) {
    const h = S.helden[pid];
    const w = angebot(h).find(x => x.id === id);
    if (!w || w.aus || h.gold < w.preis) return false;
    h.gold -= w.preis;
    if (id === "waffe") h.waffe += 1;
    else if (id === "ruestung") h.ruestung += 1;
    else if (id === "leben") { h.leben += 1; h.max += 6; h.hp += 6; }
    else if (id === "trank") h.traenke += 1;
    else if (w.faehigkeit) h.gelernt.push(id.slice(7));
    S.lager.kaeufe.push({ pid, name: w.name });
    return true;
  }

  // ---------- Aktionen ----------
  // gibt den neuen Zustand zurück, oder S0 selbst, wenn sich nichts ändert
  function aktion(S0, pid, m) {
    const S = kopie(S0), istHost = pid === S.host;
    switch (m.t) {
      case "hallo": case "join": {
        const name = String(m.name || "").trim().slice(0, 20) || "Gast";
        if (!S.spieler[pid]) { S.spieler[pid] = { name }; S.reihenfolge.push(pid); } else S.spieler[pid].name = name;
        break;
      }
      case "rolle": {
        if (S.phase !== "lobby" && S.phase !== "ende") return S0;
        if (m.rolle === null) { delete S.rollen[pid]; break; }
        if (!ROLLEN[m.rolle]) return S0;
        const aktiv = p => p !== pid && S.spieler[p] && (!S.online || S.online.includes(p));
        if (Object.keys(S.rollen).some(p => aktiv(p) && S.rollen[p] === m.rolle)) return S0;
        if (!S.rollen[pid] && Object.keys(S.rollen).filter(aktiv).length >= MAX_HELDEN) return S0;
        S.rollen[pid] = m.rolle;
        break;
      }
      case "start": {
        if (!istHost || !(S.phase === "lobby" || S.phase === "ende")) return S0;
        const anwesend = new Set(m.anwesend || S.reihenfolge);
        const t = ROLLEN_REIHE.map(r => Object.keys(S.rollen).find(p => S.rollen[p] === r && S.spieler[p] && anwesend.has(p))).filter(Boolean).slice(0, MAX_HELDEN);
        if (t.length < (m.mindestens || 2)) return S0;
        S.teilnehmer = t;
        S.helden = {};
        for (const p of t) {
          const r = ROLLEN[S.rollen[p]];
          S.helden[p] = { rolle: S.rollen[p], hp: r.hp, max: r.hp, traenke: 1, waffe: 0, ruestung: 0, leben: 0, gold: 10, gelernt: [], cd: {},
            schild: false, versteckt: false, lauer: false, segen: 0, gift: 0, giftR: 0, immun: false, fels: false, beschuetzt: null,
            ep: 0, stufe: 1, punkte: 0, rang: {},
            stats: { schaden: 0, geheilt: 0, umgefallen: 0 } };
        }
        Object.assign(S, { raumNr: 0, gegner: [], kampf: null, lager: null, lagerBesucht: [], log: [], benutzt: [], ergebnis: null, gegnerNr: 0, spielNr: (S.spielNr || 0) + 1 });
        S.phase = "erkunden";
        S.seite = { bild: "eingang", titel: "Der Abstieg", text: [TEXTE.eingang[0]] };
        entscheiden(S, "weiter", "", [{ text: "Hinabsteigen" }]);
        break;
      }
      case "stimme": {
        const e = S.entscheidung;
        if (S.phase !== "erkunden" || !e || !S.teilnehmer.includes(pid) || !e.optionen[m.i] || m.nr !== S.spielNr) return S0;
        e.stimmen[pid] = m.i;
        if (S.teilnehmer.every(p => e.stimmen[p] !== undefined)) entscheidungAufloesen(S);
        break;
      }
      case "beenden": {                    // Spielleiter: Abstimmung oder Lager ohne die Fehlenden beenden
        if (!istHost) return S0;
        if (S.phase === "erkunden" && S.entscheidung) entscheidungAufloesen(S);
        else if (S.phase === "lager") { S.lager = null; tuerenZeigen(S); }
        else return S0;
        break;
      }
      case "kaufen": {
        if (S.phase !== "lager" || !S.teilnehmer.includes(pid) || m.nr !== S.spielNr || S.lager.fertig[pid]) return S0;
        if (!kaufen(S, pid, m.id)) return S0;
        break;
      }
      case "fertig": {
        if (S.phase !== "lager" || !S.teilnehmer.includes(pid) || m.nr !== S.spielNr) return S0;
        if (m.wert === false) delete S.lager.fertig[pid]; else S.lager.fertig[pid] = true;
        if (S.teilnehmer.every(p => S.lager.fertig[p])) { S.lager = null; tuerenZeigen(S); }
        break;
      }
      case "wahl": {
        if (S.phase !== "kampf" || !S.kampf || m.runde !== S.kampf.runde) return S0;
        if (m.a === null) { delete S.kampf.wahl[pid]; break; }
        if (!wahlGueltig(S, pid, m)) return S0;
        S.kampf.wahl[pid] = { a: m.a, ziel: m.ziel || null };
        if (lebend(S).every(p => S.kampf.wahl[p])) rundeAuswerten(S);
        break;
      }
      case "auto": {                       // Spielleiter: für Helden ohne Wahl (z. B. nicht verbunden) Standardzug wählen
        if (!istHost || S.phase !== "kampf" || !S.kampf) return S0;
        for (const p of lebend(S)) if (!S.kampf.wahl[p]) S.kampf.wahl[p] = standardWahl(S, p);
        rundeAuswerten(S);
        break;
      }
      case "verbessern": {               // Fähigkeitspunkt ausgeben (nicht im Kampf)
        const h = S.helden[pid];
        if (!h || S.phase === "kampf" || S.phase === "lobby" || S.phase === "ende" || h.punkte < 1 || m.nr !== S.spielNr) return S0;
        const a = aktionenVon(h).find(x => x.id === m.id);
        if (!a || a.id === "trank" || rangVon(h, a.id) >= MAX_RANG || !rangText(h, a)) return S0;
        h.rang[a.id] = rangVon(h, a.id) + 1;
        h.punkte -= 1;
        break;
      }
      case "neustart": {
        if (!istHost) return S0;
        Object.assign(S, { phase: "lobby", teilnehmer: [], helden: {}, gegner: [], kampf: null, lager: null, entscheidung: null, seite: null, log: [], ergebnis: null, spielNr: (S.spielNr || 0) + 1 });
        break;
      }
      default: return S0;
    }
    S.aenderung = Date.now();
    return S;
  }

  window.VL = { RAEUME, MAX_HELDEN, LAGER_NACH, ROLLEN, ROLLEN_REIHE, AKTIONEN, LERNBAR, TRANK, GEGNER, EP_STUFEN, MAX_STUFE, MAX_RANG,
    neu, aktion, aktionenVon, angebot, standardWahl, lebend, gegnerLebend, goldSumme, rangVon, rangText, cdVon };
})();
