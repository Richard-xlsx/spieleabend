// Malalarm (früher Kritzelraten): Spielregeln ohne Netzwerk und ohne Oberfläche (window.KR).
// Reihum malt einer einen Begriff, alle anderen raten per Eingabe. Wer schneller rät, bekommt mehr Punkte.
// Der Begriff steht nur beim Spielleiter im Zustand; an jeden Mitspieler geht mit sicht() eine Fassung ohne Lösung.
// Phasen: lobby → waehlen (Maler wählt aus drei Begriffen) → malen → aufloesung → (nächster Maler) … → ende
(function () {
  // Begriffe: „Hauptwort|weitere richtige Antwort|…“. leicht / mittel / schwer
  const WOERTER = {
    leicht: ("Haus|Baum|Sonne|Mond|Stern|Auto|Ball|Blume|Fisch|Katze|Hund|Apfel|Banane|Brille|Schuh|Hut|Uhr|Tisch|Stuhl|Bett|Buch|" +
      "Schlüssel|Herz|Regenschirm|Wolke|Regenbogen|Schneemann|Eis|Kuchen|Pizza|Tasse|Flasche|Gabel|Löffel|Kerze|Lampe|Fenster|Tür|" +
      "Leiter|Boot|Schiff|Flugzeug|Zug;Eisenbahn;Lok|Fahrrad;Rad|Rakete|Ampel|Brücke|Berg|Insel|Pilz|Ei|Maus|Schnecke|Schlange|Spinne|" +
      "Biene|Vogel|Ente|Schwein|Kuh|Pferd|Hase;Kaninchen|Elefant|Giraffe|Krone|Geschenk|Luftballon;Ballon|Gitarre|Trommel|Handy;Smartphone|" +
      "Fernseher;Fernsehen;TV|Computer;Laptop;PC|Kamera;Fotoapparat|Zahnbürste|Schere|Bleistift;Stift|Hammer|Anker|Schaukel|Zelt|Feuer|" +
      "Blitz|Schneeflocke|Blatt|Kirsche|Birne|Erdbeere|Karotte;Möhre;Mohrrübe|Tomate|Zitrone|Ananas|Würstchen;Wurst|Burger;Hamburger|" +
      "Brezel|Kaktus|Tannenbaum;Weihnachtsbaum;Tanne|Würfel|Socke|Hose|Kleid|Handschuh|Mütze|Auge|Nase|Mund|Hand|Fuß|Zahn|Knochen|" +
      "Frosch|Igel|Eule|Pinguin|Wal|Bär|Schmetterling|Sonnenbrille|Koffer|Rucksack|Krawatte|Pfeil|Fahne;Flagge|Burg;Schloss|Brot").split("|"),
    mittel: ("Leuchtturm|Vulkan|Wasserfall|Pyramide|Kirche|Windmühle|Riesenrad|Achterbahn|Zirkus|Clown|Pirat|Ritter|Hexe|Gespenst;Geist|" +
      "Roboter|Astronaut|Feuerwehrauto;Feuerwehr|Polizist;Polizei|Koch|Zauberer|Meerjungfrau|Einhorn|Dinosaurier;Dino|Krokodil|Krake;Oktopus|" +
      "Qualle|Seestern|Schildkröte|Känguru|Kamel|Affe|Löwe|Tiger|Zebra|Flamingo|Papagei|Fledermaus|Marienkäfer|Regenwurm;Wurm|" +
      "Spinnennetz|Sonnenblume|Palme|Kürbis|Popcorn|Spiegelei|Hotdog|Spaghetti;Nudeln|Torte|Lolli;Lutscher|Zuckerwatte|Kaffeemaschine|" +
      "Waschmaschine|Kühlschrank|Staubsauger|Badewanne|Toilette;Klo;WC|Dusche|Sofa;Couch|Wecker|Briefkasten|Briefmarke|Fußball|" +
      "Skateboard|Ski|Schlitten|Angel|Taucher|Fallschirm|Hubschrauber|U-Boot|Traktor|Bagger|Kran|Wohnwagen|Krankenwagen|Tankstelle|" +
      "Mikrofon|Kopfhörer|Klavier|Geige|Trompete|Glocke|Sanduhr|Kompass|Lupe|Fernglas|Taschenlampe|Batterie|Magnet|Glühbirne|" +
      "Steckdose|Schatztruhe;Schatz;Truhe|Schwert|Maske|Medaille|Pokal|Kinderwagen|Schnuller|Teddybär;Teddy|Iglu|Schneeball|" +
      "Weihnachtsmann|Osterhase|Tornado|Nest|Bienenstock|Pfütze|Gewitter|Lagerfeuer|Hängematte|Geldbeutel;Portemonnaie;Geldbörse|" +
      "Zahnpasta|Seife|Kamm|Föhn;Fön;Haartrockner|Brunnen|Zaun|Schornstein|Gürtel|Ring|Kette;Halskette|Muschel|Sandburg|Baumhaus|" +
      "Gartenzwerg|Vogelscheuche|Gießkanne|Schubkarre|Rasenmäher|Eiffelturm|Ufo|Mumie|Vampir|Superheld|Detektiv|Werwolf").split("|"),
    schwer: ("Sternschnuppe|Seifenblase|Fingerabdruck|Stau|Echo|Schluckauf|Rolltreppe|Fahrstuhl;Aufzug;Lift|Feuerwerk|Hochzeit|Geburtstag|" +
      "Picknick|Spiegelbild|Wackelpudding|Kopfstand|Purzelbaum|Marathon|Polarlicht;Nordlicht|Lawine|Erdbeben|Ritterrüstung;Rüstung|" +
      "Flaschenpost|Schatzkarte|Zahnfee|Strandkorb|Wolkenkratzer;Hochhaus|Freiheitsstatue|Faultier|Chamäleon|Seepferdchen|" +
      "Stachelschwein|Ameisenbär|Libelle|Nilpferd|Kugelfisch|Hamsterrad|Mausefalle|Zebrastreifen|Einkaufswagen|Parkuhr|Drehtür|" +
      "Wäscheleine|Bügeleisen|Nussknacker|Kuckucksuhr|Schaukelstuhl|Kronleuchter|Raumstation|Dirigent|Jongleur|Seiltänzer|" +
      "Zauberwürfel|Gänsehaut|Schlafwandler|Sonnenfinsternis|Muskelkater|Ohrwurm|Kettenkarussell|Tauziehen|Seilspringen|Sandmännchen|" +
      "Tiefkühltruhe|Wasserrutsche|Fußabdruck|Regentanz|Liegestütz|Bauchschmerzen|Kissenschlacht|Sonnenbrand|Weltreise|" +
      "Schneeballschlacht|Spinnweben|Mondlandung|Leuchtreklame|Geisterbahn|Wetterbericht|Heißluftballon|Zahnspange|Brettspiel").split("|")
  };
  const STUFE = { leicht: "leicht", mittel: "mittel", schwer: "schwer" };
  const ZEITEN = [60, 80, 100, 120];
  const DURCHGAENGE = [1, 2, 3];
  const WAEHLEN_S = 15, AUFLOESUNG_S = 7, MAX_TIPPS = 40, MAX_PUNKTE = 4000;
  const kopie = x => JSON.parse(JSON.stringify(x));

  // Vergleich: klein, Umlaute ausgeschrieben, nur Buchstaben und Ziffern
  const norm = s => String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
  function abstand(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    let v = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const w = [i];
      for (let j = 1; j <= b.length; j++) w[j] = Math.min(v[j] + 1, w[j - 1] + 1, v[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      v = w;
    }
    return v[b.length];
  }
  const ENDUNGEN = ["", "e", "n", "en", "s", "er", "es"];
  // „richtig“, „knapp“ oder null
  function pruefen(eintrag, tipp) {
    const t = norm(tipp); if (!t) return null;
    let knapp = false;
    for (const w of eintrag.split(";").map(norm)) {
      // Mehrzahl und Endungen zählen (bei kurzen Wörtern nur „er“, sonst wäre „Eis“ richtig für „Ei“)
      if ((w.length >= 4 ? ENDUNGEN : ["", "er"]).some(e => t === w + e) || (t.length >= 4 && ENDUNGEN.some(e => w === t + e))) return "richtig";
      const d = abstand(t, w);
      if (d <= 1 && w.length >= 6) return "richtig";          // Tippfehler bei langen Wörtern zählen
      if (d <= (w.length >= 5 ? 2 : 1)) knapp = true;
    }
    return knapp ? "knapp" : null;
  }
  const anzeige = eintrag => eintrag.split(";")[0];

  function neu(code, hostPid, hostName, einst) {
    return {
      v: 1, spiel: "kritzelraten", code, epoch: 0, host: hostPid, phase: "lobby",
      zeit: ZEITEN.includes(+(einst && einst.zeit)) ? +einst.zeit : 80,
      durchgaenge: DURCHGAENGE.includes(+(einst && einst.durchgaenge)) ? +einst.durchgaenge : 1,
      spieler: { [hostPid]: { name: hostName, punkte: 0 } }, reihenfolge: [hostPid],
      teilnehmer: [], reihe: [], zug: -1, nr: 0, maler: null, wort: null, stufe: null, auswahl: null,
      rest: null, aufgedeckt: [], geraten: {}, tipps: [], gebraucht: [], verlauf: [], weg: 0, aenderung: Date.now()
    };
  }

  function ziehen(S) {
    const aus = [];
    for (const st of ["leicht", "mittel", "schwer"]) {
      let liste = WOERTER[st].filter(w => !S.gebraucht.includes(w) && !aus.some(a => a.w === w));
      if (!liste.length) liste = WOERTER[st];
      aus.push({ w: liste[Math.floor(Math.random() * liste.length)], st });
    }
    return aus;
  }
  const rater = S => S.teilnehmer.concat(S.reihenfolge.filter(p => !S.teilnehmer.includes(p))).filter(p => S.spieler[p] && p !== S.maler);
  const aktiveRater = S => rater(S).filter(p => (S.online || []).includes(p) || S.geraten[p] !== undefined);

  function naechsterZug(S) {
    S.zug += 1; S.nr += 1;
    S.wort = null; S.stufe = null; S.auswahl = null; S.aufgedeckt = []; S.geraten = {}; S.tipps = []; S.weg = 0;
    while (S.zug < S.reihe.length && !S.spieler[S.reihe[S.zug]]) S.zug += 1;
    if (S.zug >= S.reihe.length) { S.phase = "ende"; S.maler = null; S.rest = null; return; }
    S.maler = S.reihe[S.zug]; S.auswahl = ziehen(S); S.phase = "waehlen"; S.rest = WAEHLEN_S;
  }
  function wortSetzen(S, i) {
    const a = S.auswahl[Math.max(0, Math.min(S.auswahl.length - 1, i | 0))];
    S.wort = a.w; S.stufe = a.st; S.auswahl = null; S.gebraucht.push(a.w);
    S.phase = "malen"; S.rest = S.zeit;
  }
  function aufloesen(S) {
    const r = rater(S).filter(p => S.geraten[p] !== undefined), alle = Math.max(1, aktiveRater(S).length);
    const malerPunkte = r.length ? Math.round(100 * r.length / alle) : 0;
    if (S.spieler[S.maler]) S.spieler[S.maler].punkte += malerPunkte;
    S.letzte = { nr: S.nr, wort: anzeige(S.wort), maler: S.maler, malerPunkte, geraten: Object.assign({}, S.geraten) };
    S.verlauf.push({ nr: S.nr, wort: anzeige(S.wort), maler: S.maler, geraten: r.length });
    S.phase = "aufloesung"; S.rest = AUFLOESUNG_S;
  }
  // Buchstaben aufdecken: bei der Hälfte und bei einem Viertel der Zeit je einer (nie mehr als ein Drittel des Worts)
  function aufdecken(S) {
    const w = anzeige(S.wort), buchst = [...w].map((c, i) => /[A-Za-zÄÖÜäöüß0-9]/.test(c) ? i : -1).filter(i => i >= 0 && !S.aufgedeckt.includes(i));
    const soll = (S.rest <= S.zeit / 2 ? 1 : 0) + (S.rest <= S.zeit / 4 ? 1 : 0);
    const max = Math.floor([...w].filter(c => /[A-Za-zÄÖÜäöüß0-9]/.test(c)).length / 3);
    if (S.aufgedeckt.length < Math.min(soll, max) && buchst.length > 1) S.aufgedeckt.push(buchst[Math.floor(Math.random() * buchst.length)]);
  }

  // Jede Sekunde beim Spielleiter
  function tick(S0) {
    if (!["waehlen", "malen", "aufloesung"].includes(S0.phase)) return S0;
    const S = kopie(S0), malerDa = (S.online || []).includes(S.maler);
    S.rest -= 1;
    if (S.phase === "waehlen") {
      S.weg = malerDa ? 0 : S.weg + 1;
      if (S.weg >= 4) naechsterZug(S);                       // Maler ist nicht da: überspringen
      else if (S.rest <= 0) wortSetzen(S, Math.floor(Math.random() * S.auswahl.length));
    } else if (S.phase === "malen") {
      S.weg = malerDa ? 0 : S.weg + 1;
      aufdecken(S);
      if (S.rest <= 0 || S.weg >= 20) aufloesen(S);
    } else if (S.rest <= 0) naechsterZug(S);
    return S;
  }

  // Aktion anwenden: {ok, S, fehler, ergebnis} (ergebnis bei Tipps: "richtig", "knapp" oder null)
  function aktion(S0, pid, m) {
    const S = kopie(S0), istHost = pid === S.host, nein = fehler => ({ ok: false, S: S0, fehler });
    switch (m.t) {
      case "hallo": case "join": {
        const name = String(m.name || "").trim().slice(0, 20) || "Gast";
        if (!S.spieler[pid]) { S.spieler[pid] = { name, punkte: 0 }; S.reihenfolge.push(pid); } else S.spieler[pid].name = name;
        break;
      }
      case "einstellungen":
        if (!istHost || S.phase !== "lobby") return nein("Nur der Spielleiter stellt das Spiel ein.");
        if (ZEITEN.includes(+m.zeit)) S.zeit = +m.zeit;
        if (DURCHGAENGE.includes(+m.durchgaenge)) S.durchgaenge = +m.durchgaenge;
        break;
      case "start": {
        if (!istHost || S.phase !== "lobby") return nein("Nur der Spielleiter startet.");
        const t = (m.teilnehmer || []).filter(p => S.spieler[p]);
        if (t.length < 2) return nein("Es braucht mindestens zwei.");
        S.teilnehmer = t; S.reihe = [];
        for (let d = 0; d < S.durchgaenge; d++) S.reihe.push(...t);
        for (const p of Object.keys(S.spieler)) S.spieler[p].punkte = 0;
        S.zug = -1; S.verlauf = []; S.letzte = null;
        naechsterZug(S);
        break;
      }
      case "waehlen":
        if (S.phase !== "waehlen" || pid !== S.maler || m.nr !== S.nr) return nein("Gerade nicht.");
        wortSetzen(S, m.i);
        break;
      case "tipp": {
        if (S.phase !== "malen" || m.nr !== S.nr) return nein("Gerade wird nicht geraten.");
        if (pid === S.maler) return nein("Du malst gerade.");
        if (!S.spieler[pid] || S.geraten[pid] !== undefined) return nein("Du hast es schon.");
        const text = String(m.text || "").trim().slice(0, 40); if (!text) return nein("Leer.");
        const e = pruefen(S.wort, text);
        if (e === "richtig") {
          const pkt = 40 + Math.round(60 * Math.max(0, S.rest) / S.zeit);
          S.geraten[pid] = pkt; S.spieler[pid].punkte += pkt;
          S.tipps.push({ p: pid, richtig: true });
          if (aktiveRater(S).every(p => S.geraten[p] !== undefined)) aufloesen(S);
        } else S.tipps.push(e === "knapp" ? { p: pid, knapp: true } : { p: pid, text });
        if (S.tipps.length > MAX_TIPPS) S.tipps = S.tipps.slice(-MAX_TIPPS);
        S.aenderung = Date.now();
        return { ok: true, S, ergebnis: e };
      }
      case "ueberspringen":
        if (!istHost) return nein("Nur der Spielleiter.");
        if (S.phase === "waehlen") naechsterZug(S);
        else if (S.phase === "malen") aufloesen(S);
        else if (S.phase === "aufloesung") naechsterZug(S);
        else return nein("Gerade nicht.");
        break;
      case "neustart":
        if (!istHost) return nein("Nur der Spielleiter.");
        S.phase = "lobby"; S.maler = null; S.wort = null; S.auswahl = null; S.rest = null; S.zug = -1; S.letzte = null;
        break;
      default: return nein("Unbekannt.");
    }
    S.aenderung = Date.now();
    return { ok: true, S };
  }

  // Was ein Mitspieler sehen darf: Lösung nur für den Maler, wer sie schon erraten hat, und nach der Auflösung
  function sicht(S, pid) {
    const v = Object.assign({}, S);
    const kennt = pid === S.maler || (S.geraten && S.geraten[pid] !== undefined);
    if (S.wort) {
      const w = anzeige(S.wort);
      v.maske = [...w].map((c, i) => (/[A-Za-zÄÖÜäöüß0-9]/.test(c) && !S.aufgedeckt.includes(i) ? "_" : c));
      v.wort = kennt ? w : null;
    }
    if (pid !== S.maler) v.auswahl = null;
    else if (S.auswahl) v.auswahl = S.auswahl.map(a => ({ w: anzeige(a.w), st: a.st }));
    v.gebraucht = undefined;
    return v;
  }

  // Bild bereinigen (wie bei Stille Post: Punkte 0..1000 × 0..750, Farbe 0..7 oder #RRGGBB, Dicke 1..3)
  function striche(liste) {
    const aus = []; let punkte = 0;
    for (const s of (liste || []).slice(0, 600)) {
      const p = (s.p || []).slice(0, 2 * (MAX_PUNKTE - punkte)).map(v => Math.max(0, Math.min(1000, Math.round(+v || 0))));
      if (p.length < 2) continue;
      punkte += p.length / 2;
      aus.push({ f: typeof s.f === "string" && /^#[0-9a-f]{6}$/i.test(s.f) ? s.f.toUpperCase() : Math.max(0, Math.min(9, s.f | 0)), d: Math.max(1, Math.min(3, s.d | 0 || 1)), p });
      if (punkte >= MAX_PUNKTE) break;
    }
    return aus;
  }

  window.KR = { WOERTER, ZEITEN, DURCHGAENGE, MAX_PUNKTE, STUFE, neu, tick, aktion, sicht, pruefen, norm, anzeige, striche };
})();
