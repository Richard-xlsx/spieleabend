// Verlies der Helden: Spielregeln ohne Netzwerk und ohne Oberfläche.
// Der ganze Spielstand steckt in S (wird nach jeder Änderung an alle geschickt). Zufall kommt aus S.rng,
// damit ein übernehmender Spielleiter genau dort weitermacht, wo der alte aufgehört hat.
// Ablauf: Lobby (Rolle wählen, 6 Rollen, 2 bis 6 Helden) → Karte mit 7 Reihen; vor jedem Raum stimmt die Gruppe
// auf der Karte ab, wohin es geht → Endgegner in Reihe 8. Händler stehen als Räume auf der Karte, vor dem Thronsaal
// schlägt der Händler immer noch einmal sein Lager auf. Jeder kauft mit seinem eigenen Gold.
(function () {
  const RAEUME = 8;                   // 7 Reihen Räume + Thronsaal
  const REIHEN = RAEUME - 1;
  const LAGER_NACH = [REIHEN];
  const MAX_HELDEN = 6;
  const MAX_GERUFEN = 8;                  // je Kampf höchstens so viele gerufene Gegner, damit kein Kampf endlos dauert
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
      { id: "dolch", name: "Dolchstich", ziel: "gegner", text: "7–9 Schaden, jeder dritte trifft doppelt" },
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
      { id: "pfeil", name: "Pfeilschuss", ziel: "gegner", text: "7–9 Schaden" },
      { id: "doppel", name: "Doppelschuss", ziel: null, cd: 2, text: "Zwei Pfeile, je 5 Schaden an zufälligen Gegnern" },
      { id: "markieren", name: "Markieren", ziel: "gegner", cd: 3, text: "4 Schaden, 3 Runden lang trifft jeder dieses Ziel +3" }
    ],
    paladin: [
      { id: "hammer", name: "Hammerschlag", ziel: "gegner", text: "5–7 Schaden" },
      { id: "handauflegen", name: "Handauflegen", ziel: "held", cd: 2, text: "+8 Leben, weckt Bewusstlose" },
      { id: "beschuetzen", name: "Beschützen", ziel: "anderer", cd: 2, text: "Angriffe auf diesen Helden treffen dich, 2 Schaden weniger" }
    ]
  };
  // Fähigkeiten, die erst ein Talent freischaltet. meister: Meisterfähigkeit, einmal pro Kampf.
  const NEUE = {};
  [
    ["vernichten", "Vernichtender Hieb", "gegner", 3, "13–17 Schaden"],
    ["kriegsschrei", "Kriegsschrei", null, 3, "Alle: nächster Angriff +3, du +6 Leben"],
    ["spott", "Spott", "gegner", 2, "3 Schaden, dieser Gegner muss diese Runde dich angreifen"],
    ["taktik", "Taktik", "anderer", 4, "Alle Fähigkeiten dieses Helden sind sofort wieder bereit (außer Meisterfähigkeiten)"],
    ["bollwerk", "Bollwerk", null, 0, "Diese Runde nimmt die ganze Gruppe nur halben Schaden", 1],
    ["raserei", "Raserei", null, 0, "Drei wilde Hiebe auf zufällige Gegner, je 10 Schaden", 1],
    ["schlachtruf", "Schlachtruf", null, 0, "Alle +8 Leben, nächster Angriff aller +6", 1],
    ["fels", "Unerschütterlich", null, 4, "Alle Gegner greifen dich an, du nimmst keinen Schaden"],
    ["licht", "Heiliges Licht", null, 3, "5 Schaden an allen Gegnern, alle Helden +4"],
    ["gnadenlicht", "Gnadenlicht", null, 3, "Alle +7 Leben, weckt Bewusstlose"],
    ["wall", "Heiliger Wall", null, 0, "Diese Runde nimmt kein Held Schaden", 1],
    ["gottesurteil", "Gottesurteil", "gegner", 0, "30 Schaden; Untote (außer Endgegnern) sind sofort vernichtet", 1],
    ["auferstehung", "Auferstehung", null, 0, "Bewusstlose stehen mit vollen Leben auf, alle anderen +10", 1],
    ["taschendieb", "Taschendieb", "gegner", 2, "4 Schaden und 6–10 Gold für dich"],
    ["rauch", "Rauchbombe", null, 4, "Diese Runde geht jeder zweite Gegnerangriff daneben"],
    ["giftwolke", "Giftwolke", null, 3, "2 Schaden an allen, dann 3 Runden je 3 Gift"],
    ["todesstoss", "Todesstoß", "gegner", 0, "Ein Gegner unter 30 % Leben fällt sofort (Endgegner: 20 Schaden), sonst 15 Schaden", 1],
    ["seuche", "Seuche", null, 0, "5 Schaden an allen, dann 3 Runden je 5 Gift", 1],
    ["meisterdieb", "Meisterdieb", "gegner", 0, "12 Schaden, dazu 25 Gold und ein Heiltrank für dich", 1],
    ["hagel", "Pfeilhagel", null, 3, "Vier Pfeile, je 5 Schaden an zufälligen Gegnern"],
    ["kraeuter", "Kräuterkunde", "held", 2, "+9 Leben und Gift weg, weckt Bewusstlose"],
    ["kopfschuss", "Kopfschuss", "gegner", 2, "12–15 Schaden"],
    ["ranken", "Ranken", "gegner", 3, "5 Schaden, das Ziel erstarrt und greift diese Runde nicht an"],
    ["durchschuss", "Durchschuss", null, 0, "14 Schaden an allen Gegnern", 1],
    ["treibjagd", "Treibjagd", null, 0, "6 Schaden an allen, alle sind 3 Runden markiert", 1],
    ["wolfsrudel", "Wolfsrudel", null, 0, "Wölfe beißen dreimal zufällige Gegner, je 10 Schaden", 1],
    ["arkan", "Arkaner Schild", "held", 3, "Dieser Held nimmt diese Runde keinen Schaden"],
    ["meteor", "Meteor", null, 4, "11 Schaden an allen Gegnern"],
    ["frost", "Frost", null, 3, "Alle Gegner machen diese Runde 3 Schaden weniger"],
    ["inferno", "Inferno", null, 0, "20 Schaden an allen Gegnern", 1],
    ["winter", "Ewiger Winter", null, 0, "6 Schaden an allen, alle Gegner erstarren diese Runde", 1],
    ["zeitriss", "Zeitriss", null, 0, "Alle Abklingzeiten der Gruppe sind vorbei, nächster Angriff aller +5", 1],
    ["laeutern", "Läuterung", null, 2, "Alle +6 Leben, Gift wird geheilt"],
    ["wiedergeburt", "Wiedergeburt", null, 5, "Bewusstlose stehen mit halben Leben auf, alle anderen +5"],
    ["obhut", "Obhut", "held", 3, "Dieser Held nimmt diese Runde keinen Schaden"],
    ["sonnenstrahl", "Sonnenstrahl", null, 3, "6 Schaden an allen Gegnern"],
    ["erloesung", "Erlösung", null, 0, "Alle Helden voll geheilt, Bewusstlose stehen auf", 1],
    ["heiligtum", "Heiligtum", null, 0, "Alle +10 Leben, in den nächsten zwei Runden je +8", 1],
    ["sonnenzorn", "Sonnenzorn", null, 0, "15 Schaden an allen Gegnern, alle Helden +5", 1],
    // Aufstieg (ab Stufe 20): zweite Meisterfähigkeit, je Spezialisierung eine
    ["ansturm", "Ansturm", null, 0, "12 Schaden an allen Gegnern, nächster Angriff aller +4", 1],
    ["klingensturm", "Klingensturm", null, 0, "Fünf Hiebe auf zufällige Gegner, je 9 Schaden", 1],
    ["feuerweihe", "Läuterndes Feuer", null, 0, "18 heiliger Schaden an allen Gegnern (Untote doppelt), alle Helden +6", 1],
    ["ewigschild", "Ewiger Schild", null, 0, "Diese und die nächste Runde nimmt die ganze Gruppe nur halben Schaden", 1],
    ["schattentanz", "Schattentanz", null, 0, "Vier Dolchstöße auf zufällige Gegner, je 11 Schaden, dann verschwindest du in den Schatten", 1],
    ["schwarztod", "Schwarzer Tod", null, 0, "8 Schaden an allen, dann 3 Runden je 8 Gift", 1],
    ["sternschuss", "Sternschuss", "gegner", 0, "40 Schaden an einem Gegner", 1],
    ["wildnis", "Ruf der Wildnis", null, 0, "Tiere greifen sechsmal zufällige Gegner an, je 9 Schaden, alle Helden +6", 1],
    ["sternenfall", "Sternenfall", null, 0, "28 Schaden an allen Gegnern", 1],
    ["zeitstillstand", "Zeitstillstand", null, 0, "8 Schaden an allen, alle Gegner erstarren diese und nächste Runde", 1],
    ["gnade", "Göttliche Gnade", null, 0, "Alle voll geheilt, Bewusstlose stehen auf, kein Gift, nächster Angriff aller +4", 1],
    ["lebensquell", "Lebensquell", null, 0, "Alle +12 Leben (weckt Bewusstlose), in den nächsten drei Runden je +10", 1]
  ].forEach(([id, name, ziel, cd, text, meister]) => { NEUE[id] = Object.assign({ id, name, ziel, text }, cd ? { cd } : {}, meister ? { meister: true } : {}); });
  const TRANK = { id: "trank", name: "Heiltrank", ziel: null, text: "+14 Leben für dich" };
  const BEFREIEN = { id: "befreien", name: "Aus dem Netz befreien", ziel: null, text: "Du hängst im Netz fest und setzt diese Runde aus." };

  // ---------- Talentbaum ----------
  // Je Rolle 3 Äste mit 6 Knoten. Ein Knoten braucht den darunter im selben Ast. Ganz oben die Meisterfähigkeit:
  // nur eine pro Held. Wirkung: plus (Fähigkeit stärker: schaden, heil, cd = Runden früher bereit), passiv, neu, meister.
  const TALENTE = {
    kaempfer: [
      ["beschuetzer", "Beschützer", "Hält die Gruppe am Leben", [
        ["Schneller Schild", "Schildwall ist 1 Runde früher wieder bereit.", { plus: "schild", cd: 1 }],
        ["Eiserne Haut", "Immer: −1 Schaden pro Treffer.", { passiv: "ruestung", n: 1 }],
        ["Spott", "Neue Fähigkeit: 3 Schaden, dieser Gegner muss dich angreifen.", { neu: "spott" }],
        ["Zäh", "Immer: +8 Höchstleben.", { passiv: "leben", n: 8 }],
        ["Stachelpanzer", "Immer: Wer dich trifft, bekommt 2 Schaden zurück.", { passiv: "dornen", n: 2 }],
        ["Bollwerk", "Meisterfähigkeit: Eine Runde lang nimmt die ganze Gruppe nur halben Schaden.", { meister: "bollwerk" }]]],
      ["berserker", "Berserker", "Macht den meisten Schaden", [
        ["Wuchtiger Hieb", "Schwerthieb +2 Schaden.", { plus: "schlag", schaden: 2 }],
        ["Blutrausch", "Immer: Unter halben Leben +3 Schaden.", { passiv: "blutrausch", n: 3 }],
        ["Vernichtender Hieb", "Neue Fähigkeit: 13–17 Schaden.", { neu: "vernichten" }],
        ["Schlächter", "Immer: Einzelangriffe treffen mit 20 % Chance doppelt.", { passiv: "krit", n: 20 }],
        ["Siegeshunger", "Immer: Jeder Gegner, den du besiegst, heilt dich um 5.", { passiv: "todheil", n: 5 }],
        ["Raserei", "Meisterfähigkeit: Drei wilde Hiebe, je 10 Schaden.", { meister: "raserei" }]]],
      ["feldherr", "Feldherr", "Stärkt die ganze Gruppe", [
        ["Kriegsschrei", "Neue Fähigkeit: Alle nächster Angriff +3, du +6 Leben.", { neu: "kriegsschrei" }],
        ["Weiter Schwung", "Wirbelschlag +2 Schaden.", { plus: "wirbel", schaden: 2 }],
        ["Sammeln", "Immer: Nach jedem Kampf alle +4 Leben.", { passiv: "siegheil", n: 4 }],
        ["Ermutigung", "Kriegsschrei heilt zusätzlich alle um 5.", { plus: "kriegsschrei", heil: 5 }],
        ["Taktik", "Neue Fähigkeit: Alle Fähigkeiten eines anderen Helden sofort wieder bereit.", { neu: "taktik" }],
        ["Schlachtruf", "Meisterfähigkeit: Alle +8 Leben, nächster Angriff aller +6.", { meister: "schlachtruf" }]]]
    ],
    paladin: [
      ["schutzherr", "Schutzherr", "Fängt Schläge für andere ab", [
        ["Wachsam", "Beschützen ist 1 Runde früher wieder bereit.", { plus: "beschuetzen", cd: 1 }],
        ["Geweihte Rüstung", "Immer: −1 Schaden pro Treffer.", { passiv: "ruestung", n: 1 }],
        ["Unerschütterlich", "Neue Fähigkeit: Alle Gegner greifen dich an, du nimmst keinen Schaden.", { neu: "fels" }],
        ["Treuer Schild", "Immer: Beschützen fängt 3 Schaden mehr ab.", { passiv: "schutzplus", n: 3 }],
        ["Standhaft", "Immer: +8 Höchstleben.", { passiv: "leben", n: 8 }],
        ["Heiliger Wall", "Meisterfähigkeit: Eine Runde lang nimmt kein Held Schaden.", { meister: "wall" }]]],
      ["raecher", "Rächer", "Heiliger Schaden, stark gegen Untote", [
        ["Schwerer Hammer", "Hammerschlag +2 Schaden.", { plus: "hammer", schaden: 2 }],
        ["Heiliges Licht", "Neue Fähigkeit: 5 Schaden an allen Gegnern, alle Helden +4.", { neu: "licht" }],
        ["Untotenjäger", "Immer: +4 Schaden gegen Untote (Skelette und Knochenwesen).", { passiv: "untot", n: 4 }],
        ["Gleißendes Licht", "Heiliges Licht +3 Schaden.", { plus: "licht", schaden: 3 }],
        ["Richtspruch", "Hammerschlag +2 Schaden.", { plus: "hammer", schaden: 2 }],
        ["Gottesurteil", "Meisterfähigkeit: 30 Schaden, Untote sind sofort vernichtet.", { meister: "gottesurteil" }]]],
      ["gnade", "Gnade", "Heilt einzeln und alle zusammen", [
        ["Warme Hände", "Handauflegen +4 Leben.", { plus: "handauflegen", heil: 4 }],
        ["Unermüdlich", "Handauflegen ist 1 Runde früher wieder bereit.", { plus: "handauflegen", cd: 1 }],
        ["Barmherzigkeit", "Immer: Deine Heilungen auf einen Helden +2.", { passiv: "heilplus", n: 2 }],
        ["Gnadenlicht", "Neue Fähigkeit: Alle +7 Leben, weckt Bewusstlose.", { neu: "gnadenlicht" }],
        ["Dankgebet", "Immer: Nach jedem Kampf alle +5 Leben.", { passiv: "siegheil", n: 5 }],
        ["Auferstehung", "Meisterfähigkeit: Bewusstlose stehen mit vollen Leben auf, alle anderen +10.", { meister: "auferstehung" }]]]
    ],
    dieb: [
      ["assassine", "Assassine", "Schnelle, tödliche Einzelangriffe", [
        ["Scharfe Klinge", "Dolchstich +2 Schaden.", { plus: "dolch", schaden: 2 }],
        ["Hinterhalt", "Immer: In der ersten Runde jedes Kampfes +5 Schaden.", { passiv: "erste", n: 5 }],
        ["Schattengänger", "In die Schatten ist 1 Runde früher wieder bereit.", { plus: "verstecken", cd: 1 }],
        ["Schwachstelle", "Immer: Einzelangriffe treffen 15 % öfter doppelt.", { passiv: "krit", n: 15 }],
        ["Blutzoll", "Immer: Jeder Gegner, den du besiegst, heilt dich um 4.", { passiv: "todheil", n: 4 }],
        ["Todesstoß", "Meisterfähigkeit: Ein Gegner unter 30 % Leben fällt sofort.", { meister: "todesstoss" }]]],
      ["giftmischer", "Giftmischer", "Gift auf alle Gegner", [
        ["Starkes Gift", "Immer: Dein Gift +1 Schaden je Runde.", { passiv: "giftplus", n: 1 }],
        ["Flinke Finger", "Giftklinge ist 1 Runde früher wieder bereit.", { plus: "gift", cd: 1 }],
        ["Giftwolke", "Neue Fähigkeit: 2 Schaden an allen, dann 3 Runden je 3 Gift.", { neu: "giftwolke" }],
        ["Tödliches Gift", "Immer: Dein Gift +1 Schaden je Runde.", { passiv: "giftplus", n: 1 }],
        ["Dichte Wolke", "Giftwolke ist 1 Runde früher wieder bereit.", { plus: "giftwolke", cd: 1 }],
        ["Seuche", "Meisterfähigkeit: 5 Schaden an allen, dann 3 Runden je 5 Gift.", { meister: "seuche" }]]],
      ["gauner", "Gauner", "Gold, Tränke und Tricks", [
        ["Taschendieb", "Neue Fähigkeit: 4 Schaden und 6–10 Gold für dich.", { neu: "taschendieb" }],
        ["Langfinger", "Immer: +25 % Gold aus Kämpfen, Truhen und Funden.", { passiv: "gold", n: 25 }],
        ["Rauchbombe", "Neue Fähigkeit: Diese Runde geht jeder zweite Gegnerangriff daneben.", { neu: "rauch" }],
        ["Grober Rempler", "Taschendieb +3 Schaden.", { plus: "taschendieb", schaden: 3 }],
        ["Panscher", "Immer: Deine Heiltränke heilen +6.", { passiv: "trankplus", n: 6 }],
        ["Meisterdieb", "Meisterfähigkeit: 12 Schaden, 25 Gold und ein Heiltrank.", { meister: "meisterdieb" }]]]
    ],
    waldlaeufer: [
      ["scharfschuetze", "Scharfschütze", "Starke Einzelschüsse", [
        ["Langbogen", "Pfeilschuss +2 Schaden.", { plus: "pfeil", schaden: 2 }],
        ["Ruhige Hand", "Immer: Einzelangriffe treffen mit 25 % Chance doppelt.", { passiv: "krit", n: 25 }],
        ["Kopfschuss", "Neue Fähigkeit: 12–15 Schaden.", { neu: "kopfschuss" }],
        ["Federpfeile", "Pfeilschuss +2 Schaden.", { plus: "pfeil", schaden: 2 }],
        ["Adlerauge", "Kopfschuss +4 Schaden.", { plus: "kopfschuss", schaden: 4 }],
        ["Durchschuss", "Meisterfähigkeit: 14 Schaden an allen Gegnern.", { meister: "durchschuss" }]]],
      ["jaeger", "Jäger", "Markiert Beute für die ganze Gruppe", [
        ["Fährtenleser", "Markieren ist 1 Runde früher wieder bereit.", { plus: "markieren", cd: 1 }],
        ["Jagdinstinkt", "Immer: Markierte Gegner nehmen von allen +2 Schaden mehr.", { passiv: "markplus", n: 2 }],
        ["Pfeilhagel", "Neue Fähigkeit: Vier Pfeile, je 5 Schaden.", { neu: "hagel" }],
        ["Schneller Köcher", "Doppelschuss +2 Schaden je Pfeil.", { plus: "doppel", schaden: 2 }],
        ["Pfeilsturm", "Pfeilhagel +2 Schaden je Pfeil.", { plus: "hagel", schaden: 2 }],
        ["Treibjagd", "Meisterfähigkeit: 6 Schaden an allen, alle sind markiert.", { meister: "treibjagd" }]]],
      ["naturkunde", "Naturkunde", "Kräuter, Ranken und Wölfe", [
        ["Kräuterkunde", "Neue Fähigkeit: +9 Leben und Gift weg, weckt Bewusstlose.", { neu: "kraeuter" }],
        ["Heilkräuter", "Kräuterkunde +4 Leben.", { plus: "kraeuter", heil: 4 }],
        ["Ranken", "Neue Fähigkeit: 5 Schaden, das Ziel erstarrt.", { neu: "ranken" }],
        ["Zähigkeit", "Immer: +6 Höchstleben.", { passiv: "leben", n: 6 }],
        ["Lagerfeuer", "Immer: Nach jedem Kampf alle +4 Leben.", { passiv: "siegheil", n: 4 }],
        ["Wolfsrudel", "Meisterfähigkeit: Wölfe beißen dreimal, je 10 Schaden.", { meister: "wolfsrudel" }]]]
    ],
    magierin: [
      ["feuer", "Feuer", "Flächenschaden und Brand", [
        ["Glutkern", "Feuerball +2 Schaden.", { plus: "feuerball", schaden: 2 }],
        ["Funkenregen", "Funkenstrahl +2 Schaden.", { plus: "funken", schaden: 2 }],
        ["Meteor", "Neue Fähigkeit: 11 Schaden an allen Gegnern.", { neu: "meteor" }],
        ["Brand", "Immer: Feuerball, Meteor und Inferno setzen 2 Runden je 2 Brand.", { passiv: "brand", n: 2 }],
        ["Sternenfeuer", "Meteor +3 Schaden.", { plus: "meteor", schaden: 3 }],
        ["Inferno", "Meisterfähigkeit: 20 Schaden an allen Gegnern.", { meister: "inferno" }]]],
      ["eis", "Eis", "Lähmt Gegner, schwächt ihre Angriffe", [
        ["Kalte Hände", "Eislanze ist 1 Runde früher wieder bereit.", { plus: "eis", cd: 1 }],
        ["Eiszapfen", "Eislanze +3 Schaden.", { plus: "eis", schaden: 3 }],
        ["Frost", "Neue Fähigkeit: Alle Gegner machen diese Runde 3 Schaden weniger.", { neu: "frost" }],
        ["Eispanzer", "Immer: −1 Schaden pro Treffer.", { passiv: "ruestung", n: 1 }],
        ["Frostblut", "Immer: +6 Höchstleben.", { passiv: "leben", n: 6 }],
        ["Ewiger Winter", "Meisterfähigkeit: 6 Schaden an allen, alle Gegner erstarren.", { meister: "winter" }]]],
      ["arkan", "Arkan", "Schützt und beschleunigt", [
        ["Arkaner Schild", "Neue Fähigkeit: Ein Held nimmt diese Runde keinen Schaden.", { neu: "arkan" }],
        ["Schnelle Siegel", "Arkaner Schild ist 1 Runde früher wieder bereit.", { plus: "arkan", cd: 1 }],
        ["Arkane Kraft", "Immer: +1 Schaden mit allen Angriffen.", { passiv: "schaden", n: 1 }],
        ["Gebündelte Funken", "Funkenstrahl +2 Schaden.", { plus: "funken", schaden: 2 }],
        ["Zauberfluss", "Feuerball ist 1 Runde früher wieder bereit.", { plus: "feuerball", cd: 1 }],
        ["Zeitriss", "Meisterfähigkeit: Alle Abklingzeiten der Gruppe vorbei, nächster Angriff aller +5.", { meister: "zeitriss" }]]]
    ],
    heilerin: [
      ["licht", "Licht", "Starke Heilung", [
        ["Lichtgebet", "Heilen +4 Leben.", { plus: "heilen", heil: 4 }],
        ["Großer Segen", "Segen +3 Leben.", { plus: "segen", heil: 3 }],
        ["Sanfte Hände", "Immer: Deine Heilungen auf einen Helden +2.", { passiv: "heilplus", n: 2 }],
        ["Gesegnet", "Segen ist 1 Runde früher wieder bereit.", { plus: "segen", cd: 1 }],
        ["Wiedergeburt", "Neue Fähigkeit: Bewusstlose stehen mit halben Leben auf, alle anderen +5.", { neu: "wiedergeburt" }],
        ["Erlösung", "Meisterfähigkeit: Alle Helden voll geheilt, Bewusstlose stehen auf.", { meister: "erloesung" }]]],
      ["waechterin", "Wächterin", "Schützt vor Schaden und Gift", [
        ["Läuterung", "Neue Fähigkeit: Alle +6 Leben, Gift wird geheilt.", { neu: "laeutern" }],
        ["Schutzaura", "Immer: −1 Schaden pro Treffer.", { passiv: "ruestung", n: 1 }],
        ["Obhut", "Neue Fähigkeit: Ein Held nimmt diese Runde keinen Schaden.", { neu: "obhut" }],
        ["Reines Licht", "Läuterung +3 Leben.", { plus: "laeutern", heil: 3 }],
        ["Ausdauer", "Immer: +6 Höchstleben.", { passiv: "leben", n: 6 }],
        ["Heiligtum", "Meisterfähigkeit: Alle +10 Leben, in den nächsten zwei Runden je +8.", { meister: "heiligtum" }]]],
      ["kampfpriesterin", "Kampfpriesterin", "Heilt und straft zugleich", [
        ["Schwerer Stab", "Lichtstab +2 Schaden.", { plus: "stab", schaden: 2 }],
        ["Strafendes Licht", "Immer: Wenn du mit Heilen heilst, nimmt ein zufälliger Gegner 4 Schaden.", { passiv: "heilschaden", n: 4 }],
        ["Sonnenstab", "Lichtstab +2 Schaden.", { plus: "stab", schaden: 2 }],
        ["Glaubenskraft", "Immer: +1 Schaden mit allen Angriffen.", { passiv: "schaden", n: 1 }],
        ["Sonnenstrahl", "Neue Fähigkeit: 6 Schaden an allen Gegnern.", { neu: "sonnenstrahl" }],
        ["Sonnenzorn", "Meisterfähigkeit: 15 Schaden an allen Gegnern, alle Helden +5.", { meister: "sonnenzorn" }]]]
    ]
  };
  // Aufstieg ab Stufe 20: je Rolle zwei Spezialisierungen mit 4 Knoten, bezahlt mit Ruhmespunkten.
  // Man wählt nur eine; ihr letzter Knoten ist eine zweite Meisterfähigkeit.
  const AUFSTIEG = {
    kaempfer: [
      ["kriegsherr", "Kriegsherr", "Führt die Gruppe an", [
        ["Feldzeichen", "Immer: Alle Helden +1 Schaden mit allen Angriffen.", { passiv: "aura", n: 1 }],
        ["Eiserner Wille", "Immer: +10 Höchstleben.", { passiv: "leben", n: 10 }],
        ["Sammelruf", "Immer: Nach jedem Kampf alle +6 Leben.", { passiv: "siegheil", n: 6 }],
        ["Ansturm", "Zweite Meisterfähigkeit: 12 Schaden an allen, nächster Angriff aller +4.", { meister: "ansturm" }]]],
      ["klingentaenzer", "Klingentänzer", "Wirbelt durch die Gegner", [
        ["Klingenwirbel", "Wirbelschlag +4 Schaden.", { plus: "wirbel", schaden: 4 }],
        ["Tänzelnd", "Wirbelschlag ist 1 Runde früher wieder bereit.", { plus: "wirbel", cd: 1 }],
        ["Todeskreisel", "Immer: Einzelangriffe treffen 15 % öfter doppelt.", { passiv: "krit", n: 15 }],
        ["Klingensturm", "Zweite Meisterfähigkeit: Fünf Hiebe, je 9 Schaden.", { meister: "klingensturm" }]]]
    ],
    paladin: [
      ["kreuzritter", "Kreuzritter", "Heiliger Zorn", [
        ["Weihehammer", "Hammerschlag +4 Schaden.", { plus: "hammer", schaden: 4 }],
        ["Bannstrahl", "Immer: +4 Schaden gegen Untote.", { passiv: "untot", n: 4 }],
        ["Glaubensstärke", "Immer: +1 Schaden mit allen Angriffen.", { passiv: "schaden", n: 1 }],
        ["Läuterndes Feuer", "Zweite Meisterfähigkeit: 18 heiliger Schaden an allen, alle Helden +6.", { meister: "feuerweihe" }]]],
      ["hueter", "Hüter", "Ein Schild für alle", [
        ["Dicke Platte", "Immer: −1 Schaden pro Treffer.", { passiv: "ruestung", n: 1 }],
        ["Schutzkreis", "Immer: Alle anderen Helden nehmen 1 Schaden weniger pro Treffer.", { passiv: "schutzaura", n: 1 }],
        ["Bollwerk aus Stahl", "Immer: +10 Höchstleben.", { passiv: "leben", n: 10 }],
        ["Ewiger Schild", "Zweite Meisterfähigkeit: Zwei Runden lang nur halber Schaden für die Gruppe.", { meister: "ewigschild" }]]]
    ],
    dieb: [
      ["schattenklinge", "Schattenklinge", "Aus dem Dunkel zuschlagen", [
        ["Giftzahn", "Dolchstich +3 Schaden.", { plus: "dolch", schaden: 3 }],
        ["Lücke finden", "Immer: Einzelangriffe treffen 15 % öfter doppelt.", { passiv: "krit", n: 15 }],
        ["Erster Stich", "Immer: In der ersten Runde jedes Kampfes +6 Schaden.", { passiv: "erste", n: 6 }],
        ["Schattentanz", "Zweite Meisterfähigkeit: Vier Dolchstöße, je 11 Schaden, dann versteckt.", { meister: "schattentanz" }]]],
      ["pestbringer", "Pestbringer", "Gift, das alles zerfrisst", [
        ["Faulgift", "Immer: Dein Gift +2 Schaden je Runde.", { passiv: "giftplus", n: 2 }],
        ["Dicker Nebel", "Giftwolke +3 Schaden.", { plus: "giftwolke", schaden: 3 }],
        ["Schnelle Klinge", "Giftklinge ist 1 Runde früher wieder bereit.", { plus: "gift", cd: 1 }],
        ["Schwarzer Tod", "Zweite Meisterfähigkeit: 8 Schaden an allen, dann 3 Runden je 8 Gift.", { meister: "schwarztod" }]]]
    ],
    waldlaeufer: [
      ["meisterschuetze", "Meisterschütze", "Jeder Pfeil ein Treffer", [
        ["Kriegsbogen", "Pfeilschuss +3 Schaden.", { plus: "pfeil", schaden: 3 }],
        ["Falkenblick", "Immer: Einzelangriffe treffen 15 % öfter doppelt.", { passiv: "krit", n: 15 }],
        ["Schnelle Sehne", "Kopfschuss ist 1 Runde früher wieder bereit.", { plus: "kopfschuss", cd: 1 }],
        ["Sternschuss", "Zweite Meisterfähigkeit: 40 Schaden an einem Gegner.", { meister: "sternschuss" }]]],
      ["tierfreund", "Tierfreund", "Die Wildnis kämpft mit", [
        ["Bärenkraft", "Immer: +8 Höchstleben.", { passiv: "leben", n: 8 }],
        ["Rastplatz", "Immer: Nach jedem Kampf alle +5 Leben.", { passiv: "siegheil", n: 5 }],
        ["Heilmoos", "Kräuterkunde +5 Leben.", { plus: "kraeuter", heil: 5 }],
        ["Ruf der Wildnis", "Zweite Meisterfähigkeit: Sechs Tierangriffe, je 9 Schaden, alle Helden +6.", { meister: "wildnis" }]]]
    ],
    magierin: [
      ["erzmagierin", "Erzmagierin", "Rohe Zauberkraft", [
        ["Feuersturm", "Feuerball +3 Schaden.", { plus: "feuerball", schaden: 3 }],
        ["Machtwort", "Immer: +2 Schaden mit allen Angriffen.", { passiv: "schaden", n: 2 }],
        ["Flammenfluss", "Feuerball ist 1 Runde früher wieder bereit.", { plus: "feuerball", cd: 1 }],
        ["Sternenfall", "Zweite Meisterfähigkeit: 28 Schaden an allen Gegnern.", { meister: "sternenfall" }]]],
      ["chronomantin", "Chronomantin", "Hält die Zeit an", [
        ["Zeitdehnung", "Eislanze ist 1 Runde früher wieder bereit.", { plus: "eis", cd: 1 }],
        ["Zeitpanzer", "Immer: −1 Schaden pro Treffer.", { passiv: "ruestung", n: 1 }],
        ["Langes Leben", "Immer: +8 Höchstleben.", { passiv: "leben", n: 8 }],
        ["Zeitstillstand", "Zweite Meisterfähigkeit: 8 Schaden an allen, alle Gegner erstarren zwei Runden.", { meister: "zeitstillstand" }]]]
    ],
    heilerin: [
      ["hohepriesterin", "Hohepriesterin", "Heilung ohne Grenzen", [
        ["Heilige Hände", "Heilen +6 Leben.", { plus: "heilen", heil: 6 }],
        ["Gnadenreich", "Immer: Deine Heilungen auf einen Helden +3.", { passiv: "heilplus", n: 3 }],
        ["Rascher Segen", "Segen ist 1 Runde früher wieder bereit.", { plus: "segen", cd: 1 }],
        ["Göttliche Gnade", "Zweite Meisterfähigkeit: Alle voll geheilt, kein Gift, nächster Angriff aller +4.", { meister: "gnade" }]]],
      ["lebensweberin", "Lebensweberin", "Heilt über viele Runden", [
        ["Lebensfaden", "Segen +4 Leben.", { plus: "segen", heil: 4 }],
        ["Ruhepol", "Immer: Nach jedem Kampf alle +6 Leben.", { passiv: "siegheil", n: 6 }],
        ["Wurzelkraft", "Immer: +8 Höchstleben.", { passiv: "leben", n: 8 }],
        ["Lebensquell", "Zweite Meisterfähigkeit: Alle +12 Leben, drei Runden lang je +10.", { meister: "lebensquell" }]]]
    ]
  };
  const AUFSTIEG_STUFE = 20;
  // Wahlknoten: Der 2. und 4. Knoten jedes Asts hat eine Alternative (man lernt nur eine von beiden).
  // Schlüssel: Knoten-ID der ersten Wahl; der Weiter-Knoten braucht eine der beiden.
  const WAHL = {
    beschuetzer2: ["Schildstoß", "Immer: Solange dein Schildwall steht, bekommt jeder Angreifer 4 Schaden zurück.", { passiv: "schilddornen", n: 4 }],
    beschuetzer4: ["Unbeugsam", "Immer: Unter halben Leben −3 Schaden pro Treffer.", { passiv: "notpanzer", n: 3 }],
    berserker2: ["Kampflust", "Immer: +2 Schaden mit allen Angriffen.", { passiv: "schaden", n: 2 }],
    berserker4: ["Wucht", "Vernichtender Hieb +4 Schaden und 1 Runde früher wieder bereit.", { plus: "vernichten", schaden: 4, cd: 1 }],
    feldherr2: ["Rascher Wirbel", "Wirbelschlag ist 1 Runde früher wieder bereit.", { plus: "wirbel", cd: 1 }],
    feldherr4: ["Schneller Ruf", "Kriegsschrei ist 1 Runde früher wieder bereit.", { plus: "kriegsschrei", cd: 1 }],
    schutzherr2: ["Dornenrüstung", "Immer: Wer dich trifft, bekommt 2 Schaden zurück.", { passiv: "dornen", n: 2 }],
    schutzherr4: ["Weihe", "Beschützen heilt den Beschützten zusätzlich um 5.", { passiv: "schutzheil", n: 5 }],
    raecher2: ["Heiliger Zorn", "Immer: +2 Schaden mit allen Angriffen (statt Heiliges Licht).", { passiv: "schaden", n: 2 }],
    raecher4: ["Strafender Hammer", "Hammerschlag +4 Schaden.", { plus: "hammer", schaden: 4 }],
    gnade2: ["Lichtfunke", "Handauflegen heilt dich selbst zusätzlich um 4.", { passiv: "selbstheil", n: 4 }],
    gnade4: ["Heilstrom", "Handauflegen +7 Leben (statt Gnadenlicht).", { plus: "handauflegen", heil: 7 }],
    assassine2: ["Giftspitze", "Immer: Dolchstich vergiftet 2 Runden je 3.", { passiv: "dolchgift", n: 3 }],
    assassine4: ["Flinke Klinge", "Dolchstich +3 Schaden.", { plus: "dolch", schaden: 3 }],
    giftmischer2: ["Ätzend", "Giftklinge +5 Schaden beim Treffer.", { plus: "gift", schaden: 5 }],
    giftmischer4: ["Langes Siechen", "Immer: Dein Gift wirkt eine Runde länger.", { passiv: "giftlang", n: 1 }],
    gauner2: ["Ausweichen", "Immer: −1 Schaden pro Treffer.", { passiv: "ruestung", n: 1 }],
    gauner4: ["Goldfinger", "Taschendieb bringt 5 Gold mehr.", { passiv: "taschengold", n: 5 }],
    scharfschuetze2: ["Erster Schuss", "Immer: In der ersten Runde jedes Kampfes +8 Schaden.", { passiv: "erste", n: 8 }],
    scharfschuetze4: ["Kopfjäger", "Kopfschuss ist 1 Runde früher wieder bereit.", { plus: "kopfschuss", cd: 1 }],
    jaeger2: ["Rudeljagd", "Markieren ist 1 Runde früher wieder bereit, markierte Gegner nehmen von allen +1 Schaden mehr.", { plus: "markieren", cd: 1, passiv: "markplus", n: 1 }],
    jaeger4: ["Hagelschauer", "Pfeilhagel ist 1 Runde früher wieder bereit.", { plus: "hagel", cd: 1 }],
    naturkunde2: ["Kräutervorrat", "Kräuterkunde ist 1 Runde früher wieder bereit.", { plus: "kraeuter", cd: 1 }],
    naturkunde4: ["Dornenranken", "Ranken +5 Schaden.", { plus: "ranken", schaden: 5 }],
    feuer2: ["Hitzewelle", "Feuerball ist 1 Runde früher wieder bereit.", { plus: "feuerball", cd: 1 }],
    feuer4: ["Flammenzunge", "Feuerball +3 Schaden (statt Brand).", { plus: "feuerball", schaden: 3 }],
    eis2: ["Kälteschock", "Immer: Eislanze trifft alle anderen Gegner mit 4 Schaden.", { passiv: "eissplitter", n: 4 }],
    eis4: ["Frostaura", "Frost ist 1 Runde früher wieder bereit.", { plus: "frost", cd: 1 }],
    arkan2: ["Spiegelschild", "Arkaner Schild heilt das Ziel zusätzlich um 6.", { passiv: "arkanheil", n: 6 }],
    arkan4: ["Arkaner Fokus", "Immer: Einzelangriffe treffen mit 15 % Chance doppelt.", { passiv: "krit", n: 15 }],
    licht2: ["Zweites Licht", "Immer: Heilen heilt zusätzlich den schwächsten anderen Helden um die Hälfte.", { passiv: "heilsprung", n: 1 }],
    licht4: ["Lichtquelle", "Heilen +4 Leben.", { plus: "heilen", heil: 4 }],
    waechterin2: ["Schutzkreis", "Immer: Alle anderen Helden nehmen 1 Schaden weniger pro Treffer.", { passiv: "schutzaura", n: 1 }],
    waechterin4: ["Wachsam", "Obhut ist 1 Runde früher wieder bereit.", { plus: "obhut", cd: 1 }],
    kampfpriesterin2: ["Heiliger Stab", "Immer: Lichtstab heilt den schwächsten Helden um 3.", { passiv: "stabheil", n: 3 }],
    kampfpriesterin4: ["Lichtschlag", "Immer: Einzelangriffe treffen mit 20 % Chance doppelt.", { passiv: "krit", n: 20 }]
  };
  // Ruhmesboni: ab Stufe 20 bringt jede Stufe einen Ruhmespunkt; jeder Bonus lässt sich mehrmals kaufen
  const RUHM = {
    leben: { name: "Lebenskraft", text: "+5 Höchstleben", max: 99 },
    kraft: { name: "Kraft", text: "+1 Schaden mit allen Angriffen", max: 10 },
    haut: { name: "Hornhaut", text: "−1 Schaden pro Treffer", max: 5 },
    heil: { name: "Heilkraft", text: "Deine Heilungen auf einen Helden +2", max: 5 },
    trank: { name: "Gürteltasche", text: "Ein Heiltrank mehr tragen", max: 2 }
  };
  const TALENT = {};          // Knoten-ID (z. B. "berserker3") → Knoten
  const AESTE = {};           // Rolle → [{ id, name, kurz, knoten: [IDs] }]
  const AUFSTIEG_AESTE = {};  // Rolle → zwei Spezialisierungen, gleicher Aufbau
  const aesteBauen = (Q, Z, extra) => { for (const rolle in Q) Z[rolle] = Q[rolle].map(([ast, name, kurz, knoten]) => ({ id: ast, name, kurz,
    knoten: knoten.map(([kn, text, e], i) => { const id = ast + (i + 1); TALENT[id] = Object.assign({ id, rolle, ast, i, name: kn, text, e }, extra); return id; }) })); };
  aesteBauen(TALENTE, AESTE, {});
  for (const id in WAHL) { const a = TALENT[id], [name, text, e] = WAHL[id]; a.alt = id + "b"; TALENT[id + "b"] = { id: id + "b", rolle: a.rolle, ast: a.ast, i: a.i, name, text, e, alt: id }; }
  // hat der Held diesen Knoten oder seine Alternative?
  const hatKnoten = (h, id) => h.talente.includes(id) || (TALENT[id] && TALENT[id].alt && h.talente.includes(TALENT[id].alt));
  aesteBauen(AUFSTIEG, AUFSTIEG_AESTE, { aufstieg: true });
  const talenteVon = h => (h.talente || []).map(id => TALENT[id]).filter(Boolean);
  const RUHM_PASSIV = { schaden: ["kraft", 1], ruestung: ["haut", 1], heilplus: ["heil", 2] };
  const ruhmVon = (h, id) => (h.ruhmBoni && h.ruhmBoni[id]) || 0;
  const passiv = (h, art) => talenteVon(h).reduce((a, t) => a + (t.e.passiv === art ? t.e.n : 0), 0)
    + (RUHM_PASSIV[art] ? ruhmVon(h, RUHM_PASSIV[art][0]) * RUHM_PASSIV[art][1] : 0);
  const plusVon = (h, id, art) => talenteVon(h).reduce((a, t) => a + (t.e.plus === id ? t.e[art] || 0 : 0), 0);
  function talentWaehlbar(h, id) {
    const t = TALENT[id];
    if (!t || t.rolle !== h.rolle || h.talente.includes(id)) return false;
    if (t.i > 0 && !hatKnoten(h, t.ast + t.i)) return false;
    if (t.alt && h.talente.includes(t.alt)) return false;
    if (t.aufstieg) return h.stufe >= AUFSTIEG_STUFE && !talenteVon(h).some(x => x.aufstieg && x.ast !== t.ast);
    if (t.e.meister && talenteVon(h).some(x => x.e.meister && !x.aufstieg)) return false;
    return true;
  }
  // Hauptast eines Helden (für die Gruppenanzeige): der mit den meisten Talenten
  function hauptast(h) {
    let best = null;
    for (const a of AESTE[h.rolle]) { const n = a.knoten.filter(id => hatKnoten(h, id)).length; if (n && (!best || n > best.n)) best = { name: a.name, n }; }
    const auf = (AUFSTIEG_AESTE[h.rolle] || []).find(a => a.knoten.some(id => h.talente.includes(id)));
    if (auf) return { name: auf.name, n: 99 };
    return best;
  }

  // ---------- Erfahrung und Stufen ----------
  // EP_STUFEN[i] = EP, ab denen Stufe i+1 erreicht ist. Jede neue Stufe: +3 Höchstleben und 1 Talentpunkt.
  // Stufe 5 und 20: +1 Schaden, Stufe 10: −1 Schaden pro Treffer, Stufe 15: ein Trankplatz mehr.
  const EP_STUFEN = [0, 15, 35, 60, 90, 125, 165, 210, 260, 315, 375, 440, 510, 585, 665, 750, 840, 935, 1035, 1140];
  const MAX_STUFE = EP_STUFEN.length;
  const STUFENBONUS = { 5: "+1 Schaden mit allen Angriffen", 10: "−1 Schaden pro Treffer", 15: "ein Trankplatz mehr", 20: "+1 Schaden mit allen Angriffen und der Aufstieg" };
  const stufeBonus = h => ({ schaden: (h.stufe >= 5 ? 1 : 0) + (h.stufe >= 20 ? 1 : 0), ruestung: h.stufe >= 10 ? 1 : 0, traenke: h.stufe >= 15 ? 1 : 0 });
  // Ab Stufe 21 geht es ohne Grenze weiter, jede Stufe braucht 10 Erfahrung mehr als die vorige
  function epFuer(st) {
    if (st <= EP_STUFEN.length) return EP_STUFEN[st - 1];
    let ep = EP_STUFEN[EP_STUFEN.length - 1];
    for (let j = EP_STUFEN.length + 1; j <= st; j++) ep += 105 + 10 * (j - EP_STUFEN.length);
    return ep;
  }
  function stufeAus(ep) { let st = 1; while (ep >= epFuer(st + 1)) st++; return st; }
  const aktionDef = (rolle, id) => AKTIONEN[rolle].find(a => a.id === id) || NEUE[id] || (id === "trank" ? TRANK : null);
  function cdVon(h, a) {
    if (a.meister) return 99;                 // einmal pro Kampf (wird bei Kampfbeginn zurückgesetzt)
    if (!a.cd) return 0;
    return Math.max(1, a.cd - plusVon(h, a.id, "cd"));
  }
  // Was Talente an einer Fähigkeit ändern, als kurzer Text
  function aktionZusatz(h, a) {
    if (a.id === "trank") { const n = passiv(h, "trankplus"); return n ? ` · +${n} durch Talente` : ""; }
    const t = [], s = plusVon(h, a.id, "schaden"), l = plusVon(h, a.id, "heil");
    if (s) t.push(`+${s} Schaden`); if (l) t.push(`+${l} Leben`);
    if (a.meister) t.push("einmal pro Kampf");
    else if (a.cd) t.push(`alle ${cdVon(h, a) + 1} Runden`);
    return t.length ? " · " + t.join(" · ") : "";
  }
  function aktionenVon(h) {
    if (h.netz > 0) return [BEFREIEN];
    const l = AKTIONEN[h.rolle].slice();
    for (const t of talenteVon(h)) { const id = t.e.neu || t.e.meister; if (id) l.push(NEUE[id]); }
    if (h.traenke > 0) l.push(TRANK);
    return l;
  }

  // ---------- Händler ----------
  const MAX = { waffe: 6, ruestung: 5, leben: 5, traenke: 3 };
  const trankMax = h => MAX.traenke + stufeBonus(h).traenke + ruhmVon(h, "trank");
  function angebot(h) {
    const l = [
      { id: "waffe", name: "Waffe schärfen", text: `+1 Schaden bei jedem Angriff (jetzt +${h.waffe})`, preis: 15 + 15 * h.waffe, aus: h.waffe >= MAX.waffe },
      { id: "ruestung", name: "Rüstung verstärken", text: `−1 Schaden pro Treffer (jetzt −${h.ruestung})`, preis: 15 + 15 * h.ruestung, aus: h.ruestung >= MAX.ruestung },
      { id: "leben", name: "Stärkungselixier", text: `+6 Höchstleben (jetzt ${h.max})`, preis: 25, aus: h.leben >= MAX.leben },
      { id: "trank", name: "Heiltrank", text: `+${14 + passiv(h, "trankplus")} Leben im Kampf (du hast ${h.traenke}, höchstens ${trankMax(h)})`, preis: 10, aus: h.traenke >= trankMax(h) }
    ];
    return l;
  }

  // ---------- Gegner ----------
  const GEGNER = {
    // Kerker. Eigenschaften: untot (Licht doppelt, Gift halb), panzer (−n je Treffer außer Gift/Magie/Licht),
    // hinten (Nahkampf halb), rudel (+n Schaden je lebendem Artgenossen), heiler, langfinger, beschwoerer
    ratte: { name: "Riesenratte", hp: 15, dmg: [3, 4], ep: 8 },
    schwarm: { name: "Schwarmratte", bild: "ratte", hp: 10, dmg: [1, 2], ep: 6, rudel: 2 },
    goblin: { name: "Goblin", hp: 19, dmg: [3, 5], ep: 10 },
    langfinger: { name: "Goblin-Langfinger", hp: 16, dmg: [2, 3], ep: 12, langfinger: true },
    schamane: { name: "Goblin-Schamane", hp: 20, dmg: [3, 4], heiler: true, ep: 14 },
    skelett: { name: "Skelett", hp: 30, dmg: [5, 7], ep: 15, untot: true },
    bogenschuetze: { name: "Skelett-Bogenschütze", hp: 22, dmg: [4, 6], ep: 14, untot: true, hinten: true },
    ghul: { name: "Ghul", hp: 40, dmg: [6, 8], ep: 22, untot: true, gift: true },
    koenig: { name: "Der Knochenkönig", hp: 290, dmg: [10, 14], boss: true, ep: 0, untot: true },
    // Elite: stark, mit Begleiter, trägt einen Schlüssel
    kerkerwaerter: { name: "Kerkerwärter", hp: 72, dmg: [7, 9], ep: 40, elite: true, panzer: 3, begleiter: "langfinger",
      wucht: { n: 5, name: "Kettenschlag", text: "Der Kerkerwärter schwingt seine Kette durch den ganzen Raum!" } },
    totenbeschwoerer: { name: "Totenbeschwörer", hp: 52, dmg: [4, 6], ep: 38, elite: true, beschwoerer: "skelett", begleiter: "skelett" },
    // Spinnengrotte (Ebene 2). Werte auf Kerker-Maß, die Ebene macht sie stärker (STAERKE)
    spinne: { name: "Höhlenspinne", hp: 19, dmg: [3, 4], gift: true, ep: 11 },
    brut: { name: "Spinnenbrut", bild: "spinne", hp: 9, dmg: [1, 2], ep: 4, rudel: 1 },
    weberin: { name: "Netzweberin", hp: 18, dmg: [2, 3], ep: 13, netz: true },
    pilzling: { name: "Pilzling", hp: 14, dmg: [2, 3], ep: 10, explosiv: { n: 5, gift: true, text: "Der Pilzling platzt: Eine Sporenwolke hüllt alle ein!" } },
    fledermaus: { name: "Fledermausschwarm", hp: 16, dmg: [2, 3], ep: 12, fliegend: true, schnell: true },
    schleim: { name: "Schleim", hp: 30, dmg: [3, 5], ep: 12, teilt: true },
    hoehlentroll: { name: "Höhlentroll", hp: 80, dmg: [7, 9], ep: 40, elite: true, regeneration: 6, begleiter: "pilzling",
      wucht: { n: 5, name: "Keulenschwung", text: "Der Höhlentroll schwingt seine Keule durch die ganze Höhle!" } },
    spinnenmutter: { name: "Brutmutter", hp: 56, dmg: [4, 6], gift: true, ep: 38, elite: true, beschwoerer: "brut", begleiter: "spinne" },
    koenigin: { name: "Die Spinnenkönigin", hp: 320, dmg: [9, 12], boss: true, ep: 80, gift: true, beschwoerer: "brut", ruf: 2 },
    // Glutschlund (Ebene 3)
    kobold: { name: "Feuerkobold", hp: 16, dmg: [2, 4], ep: 11, schnell: true },
    schnecke: { name: "Lavaschnecke", hp: 30, dmg: [3, 5], ep: 13, panzer: 3 },
    salamander: { name: "Salamander", hp: 22, dmg: [3, 5], ep: 13, brand: true },
    ork: { name: "Ork-Krieger", hp: 40, dmg: [5, 7], ep: 18, ork: true },
    orkschamane: { name: "Ork-Schamane", hp: 24, dmg: [3, 4], ep: 14, ork: true, schildtraeger: true },
    golem: { name: "Obsidian-Golem", hp: 50, dmg: [9, 12], ep: 22, panzer: 5, traege: true },
    orkhaeuptling: { name: "Ork-Häuptling", hp: 70, dmg: [7, 9], ep: 40, elite: true, ork: true, anfuehrer: true, begleiter: "ork",
      wucht: { n: 5, name: "Rundumschlag", text: "Der Ork-Häuptling wirbelt seine Axt im Kreis!" } },
    feuerelementar: { name: "Feuerelementar", hp: 60, dmg: [6, 8], ep: 38, elite: true, brand: true, begleiter: "kobold",
      explosiv: { n: 8, brand: true, text: "Das Feuerelementar zerbirst in einer Feuerwolke!" },
      wucht: { n: 4, name: "Feuerwelle", text: "Eine Welle aus Feuer rollt über euch hinweg!", brand: true } },
    drache: { name: "Der Glutdrache", hp: 270, dmg: [10, 13], boss: true, ep: 0, brand: true }
  };
  // kurze Beschreibung der Eigenschaften (für Plaketten und die Erklärung unter der Bühne)
  const EIGENSCHAFTEN = {
    untot: ["untot", "Licht trifft doppelt, Gift wirkt nur halb."],
    panzer: ["gepanzert", "−3 Schaden pro Treffer, außer durch Gift, Magie, Licht und Dolche (die finden die Lücken)."],
    hinten: ["steht hinten", "Nahkampf macht nur halben Schaden. Pfeile und Zauber treffen voll."],
    rudel: ["Rudel", "+2 Schaden für jeden lebenden Artgenossen. Flächenschaden hilft."],
    heiler: ["Heiler", "Heilt verletzte Gegner. Zuerst ausschalten!"],
    langfinger: ["Langfinger", "Stiehlt Gold und flieht in der 3. Runde. Besiegt ihn vorher, dann gibt es das Gold zurück."],
    beschwoerer: ["Beschwörer", "Ruft regelmäßig Verstärkung. Zuerst ausschalten!"],
    fliegend: ["fliegend", "Nahkampf macht nur halben Schaden. Pfeile und Zauber treffen voll."],
    schnell: ["schnell", "Greift zweimal pro Runde an. Erstarren hilft."],
    regeneration: ["Regeneration", "Heilt sich jede Runde, aber von Runde zu Runde weniger. Feuer stoppt das für 2 Runden."],
    explosiv: ["explosiv", "Trifft beim Tod alle Helden. Vorher Schild oder Schutz!"],
    netz: ["Netz", "Spinnt einen Helden ein: Er setzt eine Runde aus."],
    teilt: ["teilt sich", "Wird er verletzt, teilt er sich einmal in zwei. Flächenschaden hilft."],
    schildtraeger: ["Schildträger", "Legt anderen Gegnern einen Schild um, der 8 Schaden schluckt. Zuerst ausschalten!"],
    anfuehrer: ["Anführer", "Alle Orks machen +2 Schaden, solange er steht."],
    traege: ["träge", "Greift nur jede 2. Runde an, dazwischen sammelt er Kraft."],
    brand: ["Feuer", "Kann Helden in Brand setzen."],
    wucht: ["Flächenangriff", "Trifft jede 3. Runde alle Helden."],
    gift: ["Gift", "Kann Helden vergiften."]
  };
  const eigenschaften = art => Object.keys(EIGENSCHAFTEN).filter(e => GEGNER[art] && GEGNER[art][e]);
  const GRUPPEN_KERKER = [
    [["ratte", "ratte"], ["goblin", "ratte"], ["langfinger", "goblin"], ["skelett"], ["goblin", "goblin"]],
    [["schwarm", "schwarm", "schwarm"], ["skelett", "goblin"], ["bogenschuetze", "skelett"], ["ghul"], ["langfinger", "goblin", "ratte"], ["schamane", "goblin", "ratte"]],
    [["ghul", "skelett"], ["skelett", "skelett", "schamane"], ["bogenschuetze", "bogenschuetze", "ghul"], ["ghul", "schamane"], ["schwarm", "schwarm", "schwarm", "bogenschuetze"], ["langfinger", "skelett", "goblin"]]
  ];
  const EBENEN = [
    { name: "Der Kerker", boss: "koenig", eliten: ["kerkerwaerter", "totenbeschwoerer"], gruppen: GRUPPEN_KERKER, bild: "koenig",
      abstieg: "Feuchte Stufen führen hinab. Hinter euch fällt das Gitter ins Schloss. Irgendwo tief unten sitzt der Knochenkönig auf seinem Thron, und er erwartet keine Gäste.",
      bossTitel: "Der Thronsaal", bossText: "Ein Thronsaal aus Gebeinen. Grünes Licht flackert in leeren Augenhöhlen. Der Knochenkönig erhebt sich: „Noch mehr Knochen für meine Sammlung.“",
      siegTitel: "Der Knochenkönig ist besiegt!", siegText: "Sein Thron zerfällt zu Staub. Unter den Trümmern: sein Schatz.",
      niederlage: "Die Dunkelheit schließt sich über euch. Der Knochenkönig bekommt neue Knochen für seine Sammlung." },
    { name: "Die Spinnengrotte", boss: "koenigin", eliten: ["hoehlentroll", "spinnenmutter"], bild: "koenigin",
      gruppen: [
        [["spinne", "brut", "brut"], ["pilzling", "spinne"], ["fledermaus"], ["weberin", "brut"], ["schleim"]],
        [["spinne", "spinne", "weberin"], ["fledermaus", "pilzling"], ["schleim", "spinne"], ["brut", "brut", "brut", "weberin"], ["pilzling", "pilzling", "spinne"]],
        [["schleim", "weberin", "spinne"], ["fledermaus", "fledermaus"], ["spinne", "spinne", "pilzling"], ["weberin", "weberin", "schleim"], ["brut", "brut", "fledermaus", "spinne"]]],
      abstieg: "Hinter dem Thron führt ein Spalt tiefer in den Fels. Pilze leuchten grün, Fäden kleben an allem. Ganz unten wartet die Spinnenkönigin in ihrem Nest.",
      bossTitel: "Das Nest", bossText: "Ein Gewölbe voller Netze und Eier. Acht Augen leuchten auf. Die Spinnenkönigin lässt sich langsam herab: „Frisches Futter für meine Kinder.“",
      siegTitel: "Die Spinnenkönigin ist besiegt!", siegText: "Ihr Nest fällt in sich zusammen. Zwischen den Fäden glitzert, was frühere Abenteurer zurückgelassen haben.",
      niederlage: "Weiche Fäden legen sich um euch. Die Spinnenkönigin hat Vorräte für den Winter." },
    { name: "Der Glutschlund", boss: "drache", eliten: ["orkhaeuptling", "feuerelementar"], bild: "drache",
      gruppen: [
        [["kobold", "kobold"], ["salamander", "kobold"], ["schnecke"], ["ork"], ["orkschamane", "kobold"]],
        [["ork", "orkschamane"], ["schnecke", "salamander"], ["golem"], ["kobold", "kobold", "salamander"], ["ork", "kobold"]],
        [["ork", "ork", "orkschamane"], ["golem", "salamander"], ["schnecke", "schnecke", "orkschamane"], ["ork", "salamander", "kobold"], ["golem", "kobold", "kobold"]]],
      abstieg: "Unter der Grotte wird es heiß. Der Fels glüht rot, Lava fließt in Rinnen. Aus der Tiefe dröhnt der Atem des Glutdrachen.",
      bossTitel: "Der Drachenhort", bossText: "Ein Berg aus Gold, umspült von Lava. Der Glutdrache breitet die Flügel aus und steigt auf: „Ihr seid weit gekommen. Hier endet es.“",
      siegTitel: "Der Glutdrache ist besiegt!", siegText: "Der Drache stürzt in die Lava. Sein Hort gehört euch, und ihr habt den tiefsten Grund des Verlieses gesehen.",
      niederlage: "Feuer und Asche. Der Glutdrache legt sich wieder auf sein Gold." }
  ];
  // Stärke je Ebene: Leben und Schaden der Gegner, Erfahrung und Gold
  const STAERKE = [{ hp: 1, dmg: 1, ep: 1, gold: 1 }, { hp: 2.8, dmg: 1.9, ep: 2, gold: 1.4 }, { hp: 3.4, dmg: 2.2, ep: 2.8, gold: 1.8 }];
  // Die Tiefe (Partielänge „endlos“): Nach dem Glutschlund beginnt es wieder beim Kerker, jede Ebene stärker
  const TIEFE = { hp: 1.3, dmg: 1.12, ep: 1.12, gold: 1.15 };
  const endlos = S => S.ebenen === 0;
  const ebeneVon = S => EBENEN[((S.ebene || 1) - 1) % EBENEN.length];
  const staerke = S => {
    const e = S.ebene || 1;
    if (e <= STAERKE.length) return STAERKE[e - 1];
    const k = e - STAERKE.length, b = STAERKE[STAERKE.length - 1];
    return { hp: b.hp * TIEFE.hp ** k, dmg: b.dmg * TIEFE.dmg ** k, ep: b.ep * TIEFE.ep ** k, gold: b.gold * TIEFE.gold ** k };
  };
  // In der Tiefe kommt jede dritte Gruppe aus einer anderen Gegend
  function gruppeFuer(S, st) {
    const E = ebeneVon(S);
    if ((S.ebene || 1) > EBENEN.length && chance(S, 1 / 3)) return eins(S, eins(S, EBENEN.filter(x => x !== E)).gruppen[st]);
    return eins(S, E.gruppen[st]);
  }
  // Schwierigkeitsstufen (in der Lobby wählbar): Gegner-Leben und -Schaden, Gold, Rast, Elite-Räume
  const SCHWERE = {
    1: { name: "Wanderer", kurz: "Zum Reinkommen", hp: 0.75, dmg: 0.75, gold: 1.2, rast: 0.6, elite: 1 },
    2: { name: "Abenteurer", kurz: "Der Standard", hp: 1, dmg: 1, gold: 1, rast: 0.4, elite: 1 },
    3: { name: "Held", kurz: "Mehr Elite-Räume", hp: 1.25, dmg: 1.15, gold: 0.9, rast: 0.3, elite: 1.8 },
    4: { name: "Legende", kurz: "Kaum Gnade", hp: 1.5, dmg: 1.3, gold: 0.8, rast: 0.25, elite: 1.8 }
  };
  const schwere = S => SCHWERE[S.schwere || 2];
  // Gruppengröße: zu zweit weniger, ab vier Helden mehr Gegner-Leben und -Schaden
  const GRUPPE = { 1: { hp: 0.4, dmg: 0.7 }, 2: { hp: 0.55, dmg: 0.8, boss: 0.85 }, 3: { hp: 1, dmg: 1 }, 4: { hp: 1.65, dmg: 1.15 },
    5: { hp: 2.7, dmg: 1.45 }, 6: { hp: 3.8, dmg: 1.75 } };
  const gruppe = S => GRUPPE[(S.teilnehmer || []).length] || GRUPPE[3];
  // Flüche: vom Spielleiter in der Lobby gewählt, beliebig kombinierbar, betreffen nur die Gegner.
  // stufe: 1 leicht, 2 mittel, 3 stark (Simulation, Dreiergruppe Abenteurer: ohne Fluch 88 % Siege)
  const FLUECHE = {
    zaeh: { stufe: 2, name: "Zäh", text: "Alle Gegner haben 25 % mehr Leben." },
    wild: { stufe: 3, name: "Wild", text: "Alle Gegner machen 15 % mehr Schaden." },
    regen: { stufe: 1, name: "Regeneration", text: "Jeder Gegner heilt am Ende der Runde 5 % seiner Leben. Feuer stoppt das, in langen Kämpfen lässt es nach." },
    dornen: { stufe: 1, name: "Dornen", text: "Wer einen Gegner mit Schwert, Hammer oder Dolch trifft, verliert selbst 1 Leben, in tieferen Ebenen 2 (nie den letzten)." },
    rache: { stufe: 3, name: "Rachsucht", text: "Jeder gefallene Gegner macht die übrigen in diesem Kampf wütender: +1 Schaden, tiefer mehr (höchstens dreimal)." },
    verstaerkung: { stufe: 1, name: "Verstärkung", text: "In jedem Kampf außer gegen Endgegner steht ein Gegner mehr (höchstens 4)." }
  };
  const fluch = (S, id) => (S.flueche || []).includes(id) || S.tiefenFluch === id;
  const gdmg = (S, n) => Math.round(n * staerke(S).dmg * schwere(S).dmg * gruppe(S).dmg * (fluch(S, "wild") ? 1.15 : 1));
  const racheBonus = S => fluch(S, "rache") && S.kampf ? gdmg(S, Math.min(3, S.kampf.rache || 0)) : 0;
  const LAENGEN = { 1: "Kurz", 2: "Normal", 3: "Lang", 4: "Die Tiefe" };
  const stufe = nr => (nr <= 3 ? 0 : nr <= 5 ? 1 : 2);
  function gegnerErzeugen(S, art) {
    // zu zweit schwächer; je tiefer, desto zäher (Helden steigen ja auch auf)
    const g = GEGNER[art], f = gruppe(S).hp * (g.boss ? gruppe(S).boss || 1 : 1) * schwere(S).hp * (g.boss ? 1 : 1 + 0.11 * Math.max(0, S.raumNr - 1)) * (1 + (S.karte ? S.karte.fluch || 0 : 0)) * (fluch(S, "zaeh") ? 1.25 : 1);
    const hp = Math.max(4, Math.round(g.hp * f * staerke(S).hp));
    S.gegnerNr = (S.gegnerNr || 0) + 1;
    return Object.assign({ id: "g" + S.gegnerNr, art, name: g.name, hp, max: hp, gift: 0, giftR: 0, starr: 0, markiert: 0 }, g.elite ? { elite: true } : {});
  }

  // ---------- Räume ----------
  const TUERBILD = {
    kampf: ["Kratzspuren am Holz, dahinter Knurren", "Frische Spuren im Staub", "Waffengeklirr hinter der Tür", "Ein fauliger Geruch"],
    schatz: ["Ein goldener Schimmer unter der Tür", "Ein Schloss mit Edelsteinbesatz", "Es klimpert leise"],
    rast: ["Warme Luft und Holzrauch", "Leises Wasserplätschern", "Eine Tür mit eingeritzter Sonne"],
    ereignis: ["Seltsame Zeichen am Türrahmen", "Eine Stimme flüstert", "Die Tür ist halb offen, Licht flackert"],
    haendler: ["Eine Laterne und das Knarren eines Karrens", "Jemand pfeift ein Händlerlied"],
    schrein: ["Grünliches Leuchten aus einer Nische", "Ein Steinkreis summt leise"],
    boss: ["Ein Tor aus schwarzem Eisen. Dahinter: der Thronsaal."]
  };
  const TEXTE = {
    eingang: ["Feuchte Stufen führen hinab. Hinter euch fällt das Gitter ins Schloss. Irgendwo tief unten sitzt der Knochenkönig auf seinem Thron, und er erwartet keine Gäste."],
    kampf: ["Kaum seid ihr drin, rührt sich etwas in der Dunkelheit.", "Knochen knirschen unter euren Stiefeln. Ihr seid nicht allein.",
      "Eine Fackel flammt auf und zeigt, wer hier wohnt.", "Ein Hinterhalt! Sie haben auf euch gewartet."],
    schatz: ["Mitten im Raum steht eine schwere, beschlagene Truhe.", "In einer Nische wartet eine staubige Truhe. Das Schloss ist alt, aber kunstvoll."],
    rast: ["Ein stiller Raum mit einer kalten Feuerstelle. Ihr macht Feuer und atmet durch.",
      "Eine Quelle sprudelt aus dem Fels. Das Wasser ist klar und kalt. Für einen Moment ist es ruhig."],
    karte: ["Auf einem Fass liegt ein vergilbter Plan des Kerkers, gezeichnet von einem verschollenen Abenteurer. Die oberen Gänge sind gut zu erkennen, weiter unten ist die Tinte verblasst."],
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

  const SEGEN = {
    leben: { name: "Segen des Lebens", text: "Jeder bekommt +6 Höchstleben." },
    klinge: { name: "Segen der Klinge", text: "Jeder macht +1 Schaden mit allen Angriffen." },
    quelle: { name: "Segen der Quelle", text: "Alle sind voll geheilt, jeder bekommt einen Trank." },
    wissen: { name: "Segen des Wissens", text: "Jeder bekommt 20 Erfahrung." },
    blut: { name: "Blutpakt (Fluch)", text: "Jeder verliert ein Drittel seiner Leben und bekommt dafür 30 Gold." },
    gier: { name: "Gier (Fluch)", text: "Jeder bekommt 40 Gold, aber alle Gegner dieser Ebene haben 12 % mehr Leben, auch der Endgegner." }
  };
  const UMVERTEILEN = 10;   // Gold für neu verteilte Fähigkeitspunkte am Schrein

  // ---------- Karte ----------
  // 7 Reihen mit 2 bis 4 Räumen, Wege ohne Kreuzungen. Erzeugt aus S.rng, also für alle gleich.
  const RAUMNAME = { kampf: "Kampf", elite: "Elite", schatz: "Truhe", rast: "Rast", haendler: "Händler", schrein: "Schrein", ereignis: "Unbekannt", kammer: "Schatzkammer", boss: "Endgegner", eingang: "Eingang" };
  const KARTENTYPEN = {
    erste: [["kampf", 55], ["ereignis", 25], ["schatz", 20]],
    mitte: [["kampf", 40], ["elite", 11], ["ereignis", 18], ["schatz", 8], ["rast", 11], ["haendler", 7], ["schrein", 5]],
    letzte: [["kampf", 50], ["rast", 25], ["ereignis", 25]]
  };
  function gewichtet(S, l) { let r = zufall(S) * l.reduce((a, x) => a + x[1], 0); for (const [x, w] of l) { if (r < w) return x; r -= w; } return l[0][0]; }
  function karteErzeugen(S) {
    const K = { knoten: {}, pos: "e", weg: ["e"], geheimgang: false, schluessel: 0, fluch: 0 };
    K.knoten.e = { id: "e", r: 0, x: 0.5, typ: "eingang", nach: [] };
    const reihen = [["e"]];
    for (let r = 1; r <= REIHEN; r++) {
      const n = r === 1 ? 3 : r === REIHEN ? wurf(S, 2, 3) : wurf(S, 2, 4), ids = [];
      const l = r === 1 ? KARTENTYPEN.erste : r === REIHEN ? KARTENTYPEN.letzte : KARTENTYPEN.mitte.filter(([t]) => r >= 3 || (t !== "elite" && t !== "schrein")).map(([t, w]) => [t, t === "elite" ? Math.round(w * schwere(S).elite) : w]);
      for (let i = 0; i < n; i++) {
        const id = `r${r}n${i}`;
        K.knoten[id] = { id, r, x: Math.round(((i + 0.5) / n + (zufall(S) - 0.5) * 0.06) * 1000) / 1000, typ: gewichtet(S, l), nach: [] };
        ids.push(id);
      }
      reihen.push(ids);
    }
    K.knoten.b = { id: "b", r: REIHEN + 1, x: 0.5, typ: "boss", nach: [] };
    reihen.push(["b"]);
    // Wege: Raum i der oberen Reihe führt zu einem zusammenhängenden Stück der unteren Reihe. Die Stücke überdecken
    // die ganze Reihe und überlappen höchstens an den Rändern, so kreuzen sich keine Wege.
    for (let r = 0; r < reihen.length - 1; r++) {
      const A = reihen[r], B = reihen[r + 1], n = A.length, m = B.length, lo = [], hi = [];
      for (let i = 0; i < n; i++) { lo.push(Math.floor(i * m / n)); hi.push(Math.ceil((i + 1) * m / n) - 1); }
      for (let i = 0; i < n; i++) {
        if (hi[i] + 1 < m && (i === n - 1 || hi[i] + 1 <= lo[i + 1]) && chance(S, 0.3)) hi[i] += 1;
        if (lo[i] > 0 && (i === 0 || lo[i] - 1 >= hi[i - 1]) && chance(S, 0.3)) lo[i] -= 1;
      }
      for (let i = 0; i < n; i++) for (let j = lo[i]; j <= hi[i]; j++) K.knoten[A[i]].nach.push(B[j]);
    }
    const inReihen = (a, b) => reihen.slice(a, b + 1).flat().map(id => K.knoten[id]);
    const sorge = (a, b, typ) => {
      const l = inReihen(a, b);
      if (l.some(k => k.typ === typ)) return;
      const c = l.filter(k => k.typ === "kampf"), z = c.length ? eins(S, c) : eins(S, l.filter(k => k.typ !== "haendler" && k.typ !== "elite"));
      if (z) z.typ = typ;
    };
    sorge(2, 3, "haendler"); sorge(4, 6, "haendler"); sorge(3, 4, "elite"); sorge(3, 6, "schrein");
    // Schatzkammer: ein Raum in Reihe 5 oder 6, an dem jeder Weg auch vorbeiführt (jeder Vorgänger hat noch einen anderen Ausgang)
    const eltern = id => Object.values(K.knoten).filter(k => k.nach.includes(id));
    const kand = inReihen(5, 6).filter(k => k.typ !== "haendler" && k.typ !== "elite" && k.typ !== "schrein" && eltern(k.id).every(e => e.nach.length >= 2));
    if (kand.length) eins(S, kand).typ = "kammer";
    for (const k of Object.values(K.knoten)) if (k.typ === "elite") k.elite = eins(S, (S.ebene || 1) > EBENEN.length ? EBENEN.flatMap(x => x.eliten) : ebeneVon(S).eliten);
    return K;
  }
  // Wie weit die Gruppe auf der Karte sieht: 2 Reihen, mit Waldläufer oder Dieb 3
  const sicht = S => (S.teilnehmer.some(p => S.helden[p].rolle === "waldlaeufer" || S.helden[p].rolle === "dieb") ? 3 : 2);
  const geheimgangMoeglich = S => !S.karte.geheimgang && S.teilnehmer.some(p => S.helden[p].rolle === "dieb" && S.helden[p].hp > 0);
  function raumOption(S, k, geheim) {
    const o = { knoten: k.id, typ: k.typ, text: (geheim ? "Geheimgang: " : "") + RAUMNAME[k.typ] };
    if (k.typ === "boss") { o.text = "Tor zum Thronsaal aufstoßen"; o.hinweis = TUERBILD.boss[0]; }
    else if (k.typ === "elite") { o.text += ": " + GEGNER[k.elite].name; o.hinweis = "Stark, dafür doppelte Erfahrung, Beute und ein Schlüssel."; }
    else if (k.typ === "kammer") {
      o.gesperrt = S.karte.schluessel < 1;
      o.hinweis = o.gesperrt ? "Verschlossen. Elite-Gegner tragen Schlüssel." : "Ihr habt einen Schlüssel. Dahinter wartet ein Schatz.";
    } else o.hinweis = eins(S, TUERBILD[k.typ] || TUERBILD.ereignis);
    if (geheim) { o.geheim = true; o.hinweis = "Der Dieb kennt einen Weg, der eine Reihe überspringt (einmal pro Ebene). " + o.hinweis; }
    return o;
  }
  function karteZeigen(S) {
    const K = S.karte, hier = K.knoten[K.pos];
    S.phase = "erkunden";
    const opt = hier.nach.map(id => raumOption(S, K.knoten[id], false));
    if (hier.r >= 1 && hier.r + 2 <= REIHEN && geheimgangMoeglich(S)) {
      let zwei = [...new Set(hier.nach.flatMap(id => K.knoten[id].nach))].filter(id => K.knoten[id].typ !== "kammer");
      while (zwei.length > 2) zwei.splice(Math.floor(zufall(S) * zwei.length), 1);
      opt.push(...zwei.map(id => raumOption(S, K.knoten[id], true)));
    }
    opt.sort((a, b) => (a.gesperrt ? 1 : 0) - (b.gesperrt ? 1 : 0));
    S.seite = { bild: "tueren", titel: hier.r ? `Nach Raum ${hier.r}` : "Die Karte", text: [hier.r ? "Der Plan zeigt die nächsten Gänge. Wohin jetzt?" : TEXTE.karte[0]] };
    entscheiden(S, "karte", hier.nach[0] === "b" ? "Bereit für den Endkampf?" : "Wohin geht ihr?", opt);
  }

  // ---------- Neues Spiel ----------
  function neu(code, hostPid, hostName, seed) {
    return {
      v: 2, spiel: "verlies", code, epoch: 0, host: hostPid, phase: "lobby",
      spieler: { [hostPid]: { name: hostName } }, reihenfolge: [hostPid], rollen: {},
      teilnehmer: [], helden: {}, gegner: [], raumNr: 0, seite: null, entscheidung: null, kampf: null, lager: null,
      log: [], benutzt: [], rng: (seed >>> 0) || 1, spielNr: 0, laenge: 2, schwere: 2, flueche: [], ebene: 1, ebenen: 2, aenderung: Date.now()
    };
  }
  const lebend = S => S.teilnehmer.filter(p => S.helden[p].hp > 0);
  const gegnerLebend = S => S.gegner.filter(g => g.hp > 0);
  const heldName = (S, p) => (S.spieler[p] ? S.spieler[p].name : "?");
  const goldSumme = S => S.teilnehmer.reduce((a, p) => a + S.helden[p].gold, 0);

  function heldHeilen(S, p, n) {
    const h = S.helden[p], war = h.hp;
    if (h.gefallen) return 0;
    h.hp = Math.min(h.max, h.hp + n);
    return h.hp - war;
  }
  // Gold für jeden: gibt Text zurück
  function goldFuerJeden(S, a, b) {
    const n = Math.round(wurf(S, a, b) * staerke(S).gold * schwere(S).gold), extra = [];
    for (const p of S.teilnehmer) {
      const h = S.helden[p], x = Math.round(n * passiv(h, "gold") / 100);
      h.gold += n + x;
      if (x) extra.push(`${heldName(S, p)} +${x}`);
    }
    return `+${n} Gold für jeden${extra.length ? " (" + extra.join(", ") + " dank Langfinger)" : ""}.`;
  }

  // ---------- Entscheidungen (Türen, Ereignisse, Weiter) ----------
  function entscheiden(S, art, frage, optionen, extra) {
    S.entscheidung = Object.assign({ art, frage, optionen, stimmen: {} }, extra || {});
  }
  const EREIGNISSE_FREI = S => Object.keys(EREIGNISSE).filter(e => !S.benutzt.includes(e));
  // Nächste Ebene: neue Karte, neue Ereignisse, Abstieg
  function neueEbene(S) {
    S.ebene += 1; S.ebeneFertig = false;
    Object.assign(S, { raumNr: 0, gegner: [], lagerBesucht: [], benutzt: [] });
    S.karte = karteErzeugen(S);
    S.phase = "erkunden";
    S.seite = { bild: "eingang", titel: `Ebene ${S.ebene}: ${ebeneVon(S).name}`, text: [ebeneVon(S).abstieg] };
    if (S.ebene > EBENEN.length) {
      // Tiefe: die Gegenden wiederholen sich, stärker, mit gemischten Gegnern und einem eigenen Fluch je Ebene
      const frei = Object.keys(FLUECHE).filter(f => !(S.flueche || []).includes(f));
      S.tiefenFluch = frei.length ? eins(S, frei) : null;
      S.seite = { bild: "eingang", titel: `Ebene ${S.ebene}: ${ebeneVon(S).name} der Tiefe`,
        text: [`Noch tiefer. Die Gänge erinnern an ${ebeneVon(S).name.replace(/^Der /, "den ").replace(/^Die /, "die ")}, aber hier unten ist alles älter, und was hier lebt, ist stärker als alles darüber. Auch Wesen aus anderen Gegenden haben sich hierher verirrt.`]
          .concat(S.tiefenFluch ? [`Fluch der Tiefe auf dieser Ebene: ${FLUECHE[S.tiefenFluch].name}. ${FLUECHE[S.tiefenFluch].text}`] : []) };
    }
    entscheiden(S, "weiter", "", [{ text: "Hinabsteigen" }]);
  }
  function weiterziehen(S) {
    S.log = [];
    if (S.ebeneFertig) { neueEbene(S); return; }
    if (S.raumNr === REIHEN && !(S.lagerBesucht || []).includes(REIHEN)) lagerOeffnen(S, true);
    else karteZeigen(S);
  }
  function lagerOeffnen(S, vorDemTor) {
    if (vorDemTor) S.lagerBesucht = (S.lagerBesucht || []).concat(S.raumNr);
    S.phase = "lager";
    S.entscheidung = null;
    S.lager = { fertig: {}, kaeufe: [] };
    S.seite = vorDemTor ? { bild: "haendler", titel: "Vor dem großen Tor", text: [TEXTE.lager[2]] }
      : { bild: "haendler", titel: `Raum ${S.raumNr}: Der Händler`, text: [eins(S, TEXTE.lager.slice(0, 2))] };
  }

  function kampfRaum(S, gruppe, titel, text) {
    S.seite = { bild: GEGNER[gruppe[0]].bild || gruppe[0], titel, text: [text] };
    kampfStarten(S, gruppe);
  }
  function raumBetreten(S, kid, geheim) {
    const K = S.karte, k = K.knoten[kid], typ = k.typ, n = k.r;
    if (geheim) K.geheimgang = true;
    K.pos = kid; K.weg.push(kid);
    S.raumNr = n;
    S.log = [];
    if (typ === "boss") {
      const E = ebeneVon(S);
      S.seite = { bild: E.bild, titel: E.bossTitel, text: [E.bossText] };
      kampfStarten(S, [E.boss]);
    } else if (typ === "kampf") {
      kampfRaum(S, gruppeFuer(S, stufe(n)), `Raum ${n}`, eins(S, TEXTE.kampf));
    } else if (typ === "elite") {
      const e = GEGNER[k.elite];
      kampfRaum(S, [k.elite, e.begleiter], `Raum ${n}: ${e.name}`, `${e.name} versperrt den Weg. Irgendwo an ihm glänzt ein schwerer Schlüssel.`);
    } else if (typ === "schatz") {
      S.seite = { bild: "truhe", titel: `Raum ${n}: Eine Truhe`, text: [eins(S, TEXTE.schatz)] };
      entscheiden(S, "truhe", "Öffnen?", [{ text: "Truhe öffnen" }, { text: "Liegen lassen" }]);
    } else if (typ === "rast") {
      S.seite = { bild: "feuer", titel: `Raum ${n}: Rast`, text: [eins(S, TEXTE.rast)] };
      entscheiden(S, "rast", "Wie nutzt ihr die Rast?", [
        { text: "Ausruhen", hinweis: "Alle heilen 40 % ihrer Leben, alle Fähigkeiten sind wieder bereit." },
        { text: "Üben", hinweis: "Jeder bekommt 1 Talentpunkt, aber niemand heilt." }]);
    } else if (typ === "haendler") {
      lagerOeffnen(S, false);
    } else if (typ === "schrein") {
      const l = Object.keys(SEGEN), wahl = [];
      while (wahl.length < 2) { const x = eins(S, l); if (!wahl.includes(x)) wahl.push(x); }
      S.seite = { bild: "schrein", titel: `Raum ${n}: Ein Schrein`, text: ["In einer Nische glimmt ein uralter Schrein. Wer hier betet, bekommt etwas, aber nicht immer umsonst.",
        `Solange ihr hier seid, kann jeder im Talentbaum seine Punkte für ${UMVERTEILEN} Gold neu verteilen.`] };
      entscheiden(S, "schrein", "Was erbittet ihr?", wahl.map(id => ({ text: SEGEN[id].name, hinweis: SEGEN[id].text, segen: id }))
        .concat([{ text: "Nichts nehmen", hinweis: "Ihr verneigt euch und geht weiter." }]));
    } else if (typ === "kammer") {
      K.schluessel -= 1;
      const t = ["Der Schlüssel dreht sich schwer im Schloss. Dahinter stapeln sich Gold, Waffen und Tränke.", goldFuerJeden(S, 26, 34)];
      for (const p of S.teilnehmer) {
        const h = S.helden[p];
        if (h.waffe < MAX.waffe && (h.ruestung >= MAX.ruestung || chance(S, 0.55))) { h.waffe += 1; t.push(`${heldName(S, p)} nimmt eine bessere Waffe: +1 Schaden.`); }
        else if (h.ruestung < MAX.ruestung) { h.ruestung += 1; t.push(`${heldName(S, p)} nimmt ein Rüstungsteil: −1 Schaden pro Treffer.`); }
        else { h.max += 6; h.hp += 6; t.push(`${heldName(S, p)} findet ein Amulett: +6 Höchstleben.`); }
        if (h.traenke < trankMax(h)) h.traenke += 1;
      }
      t.push("Jeder steckt einen Heiltrank ein (soweit Platz ist).", ...erfahrung(S, 15));
      S.seite = { bild: "truhe", titel: `Raum ${n}: Die Schatzkammer`, text: t };
      entscheiden(S, "weiter", "", [{ text: "Weiterziehen" }]);
    } else {
      // Unbekannt: Hinterhalt, Fundstück oder eines der Ereignisse
      const frei = EREIGNISSE_FREI(S), r = zufall(S);
      if (r < 0.22 || !frei.length) kampfRaum(S, gruppeFuer(S, stufe(n)), `Raum ${n}: Ein Hinterhalt!`, "Kaum seid ihr drin, fällt hinter euch ein Gitter herab. Aus den Schatten kommen sie.");
      else if (r < 0.32) {
        const t = ["Zwischen alten Knochen liegt ein Lederbeutel.", goldFuerJeden(S, 6, 10)];
        if (!K.schluessel && Object.values(K.knoten).some(x => x.typ === "kammer" && x.r > n)) { K.schluessel += 1; t.push("Darin: ein schwerer, alter Schlüssel."); }
        t.push(...erfahrung(S, 8));
        S.seite = { bild: "truhe", titel: `Raum ${n}: Ein Fundstück`, text: t };
        entscheiden(S, "weiter", "", [{ text: "Weiterziehen" }]);
      } else {
        const id = eins(S, frei);
        S.benutzt.push(id);
        const e = EREIGNISSE[id];
        S.seite = { bild: id, titel: `Raum ${n}: ${e.titel}`, text: [e.text] };
        entscheiden(S, "ereignis", "Was tut ihr?", e.optionen.map(t => ({ text: t })), { id });
      }
    }
    if (S.phase !== "lager") S.phase = S.kampf ? "kampf" : "erkunden";
  }

  function segenAusfuehren(S, id) {
    const t = [];
    for (const p of S.teilnehmer) {
      const h = S.helden[p];
      if (id === "leben") { h.max += 6; h.hp += 6; }
      else if (id === "klinge") h.waffe += 1;
      else if (id === "quelle") { h.hp = h.max; if (h.traenke < trankMax(h)) h.traenke += 1; }
      else if (id === "blut") { h.hp = Math.max(1, h.hp - Math.ceil(h.hp / 3)); h.gold += 30; }
      else if (id === "gier") h.gold += 40;
    }
    if (id === "gier") S.karte.fluch = (S.karte.fluch || 0) + 0.12;
    t.push(`${SEGEN[id].name}: ${SEGEN[id].text}`);
    if (id === "wissen") t.push(...erfahrung(S, 20));
    return t;
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
        if (h.gold >= 8 && h.traenke < trankMax(h)) { h.gold -= 8; h.traenke += 1; t.push(`${heldName(S, p)} kauft einen Trank.`); }
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
      const frei = S.teilnehmer.filter(p => S.helden[p].traenke < trankMax(S.helden[p]));
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
  // Jeder Gegner legt zu Beginn der Runde fest, was er vorhat (wird allen angezeigt).
  // Ausgeführt wird später: Schildwall/Unerschütterlich ziehen den Angriff auf sich, Versteckte werden nicht gefunden.
  function planeGegner(S) {
    const k = S.kampf, a = {}, helden = lebend(S), frei = () => gegnerLebend(S).length < 4 && (k.gerufen || 0) < MAX_GERUFEN;
    const held = () => { const l = helden.filter(p => !S.helden[p].netz); return l.length ? eins(S, l) : helden.length ? eins(S, helden) : null; };
    const angriff = g => Object.assign({ a: "angriff", ziel: held() }, istSchnell(S, g) ? { doppelt: true } : {});
    for (const g of gegnerLebend(S)) {
      const art = GEGNER[g.art], r = k.runde;
      if (art.boss) {
        const diener = gegnerLebend(S).filter(x => x !== g).length;
        if (g.art === "koenig" && r % 3 === 0) a[g.id] = k.bossPhase >= 2 && diener === 0 && frei() ? { a: "ruf" } : { a: "beben" };
        else if (g.art === "koenigin" && r % 3 === 0 && frei()) a[g.id] = { a: "ruf" };
        else if (g.art === "koenigin" && r % 3 === 2) a[g.id] = { a: "netz", ziel: held() };
        else if (g.art === "drache" && r % 3 === 0) a[g.id] = { a: "beben", name: k.bossPhase >= 2 ? "Schwanzhieb" : "Flammenatem" };
        else a[g.id] = angriff(g);
        continue;
      }
      if (art.beschwoerer && r % 3 === 2 && frei()) { a[g.id] = { a: "ruf" }; continue; }
      if (art.langfinger) { a[g.id] = r >= 3 ? { a: "flucht" } : { a: "stehlen", ziel: held() }; continue; }
      if (art.traege && r % 2 === 0) { a[g.id] = { a: "ruhe" }; continue; }
      if (art.netz && r % 3 === 1) { a[g.id] = { a: "netz", ziel: held() }; continue; }
      if (art.wucht && r % 3 === 2) { a[g.id] = { a: "beben", name: art.wucht.name }; continue; }
      if (art.heiler) {
        const v = gegnerLebend(S).filter(x => x !== g && x.hp < x.max * 0.6).sort((x, y) => x.hp / x.max - y.hp / y.max)[0];
        if (v) { a[g.id] = { a: "heilen", ziel: v.id }; continue; }
      }
      if (art.schildtraeger) {
        const v = gegnerLebend(S).filter(x => x !== g && !(x.schutz > 0)).sort((x, y) => x.hp / x.max - y.hp / y.max)[0];
        if (v) { a[g.id] = { a: "schuetzen", ziel: v.id }; continue; }
      }
      a[g.id] = angriff(g);
    }
    k.absicht = a;
  }

  function kampfStarten(S, gruppe) {
    if (fluch(S, "verstaerkung") && gruppe.length < 4 && !gruppe.some(a => GEGNER[a].boss)) {
      const einfach = gruppe.filter(a => !GEGNER[a].elite && !GEGNER[a].langfinger);
      gruppe = gruppe.concat(einfach.length ? eins(S, einfach) : eins(S, ebeneVon(S).gruppen[0].flat().filter(a => !GEGNER[a].langfinger)));
    }
    S.gegner = gruppe.map(a => gegnerErzeugen(S, a));
    S.kampf = { runde: 1, wahl: {}, bossPhase: 1, epTot: 0, nebel: false, absicht: {}, rache: 0 };
    for (const p of S.teilnehmer) { const h = S.helden[p]; for (const id in h.cd) if (NEUE[id] && NEUE[id].meister) delete h.cd[id]; }
    for (const p of S.teilnehmer) Object.assign(S.helden[p], { schild: false, versteckt: false, lauer: false, segen: 0, gift: 0, giftR: 0, immun: false, fels: false, beschuetzt: null, netz: 0 });
    S.entscheidung = null;
    S.log = [];
    planeGegner(S);
  }

  function wahlGueltig(S, pid, m) {
    const h = S.helden[pid];
    if (!h || h.hp <= 0) return false;
    const a = aktionenVon(h).find(x => x.id === m.a);
    if (!a) return false;
    if ((a.cd || a.meister) && (h.cd[a.id] || 0) > 0) return false;   // Meisterfähigkeiten: einmal pro Kampf
    if (a.ziel === "gegner" && !S.gegner.some(g => g.id === m.ziel && g.hp > 0)) return false;
    if (a.ziel === "held" && !S.helden[m.ziel]) return false;
    if (a.ziel === "anderer" && (!S.helden[m.ziel] || m.ziel === pid || S.helden[m.ziel].hp <= 0)) return false;
    return true;
  }
  const HEILEND = { heilen: 1, handauflegen: 1, kraeuter: 1 };
  function standardWahl(S, pid) {
    const h = S.helden[pid], ziel = gegnerLebend(S).sort((a, b) => a.hp - b.hp)[0];
    if (h.netz > 0) return { a: "befreien", ziel: null };
    const heil = aktionenVon(h).find(a => HEILEND[a.id] && !(h.cd[a.id] > 0));
    if (heil) {
      const schwach = S.teilnehmer.filter(p => S.helden[p].hp < S.helden[p].max * 0.5).sort((a2, b) => S.helden[a2].hp - S.helden[b].hp)[0];
      if (schwach) return { a: heil.id, ziel: schwach };
    }
    return { a: AKTIONEN[h.rolle][0].id, ziel: ziel && ziel.id };
  }

  // Bonus eines Helden auf jeden Angriff: Waffe, Segen, Talente, Stufe
  const gruppenPassiv = (S, art, ausser) => S.teilnehmer.reduce((a, q) => a + (q !== ausser && !S.helden[q].gefallen ? passiv(S.helden[q], art) : 0), 0);
  const angriffsBonus = (S, h) => h.waffe + (h.segen || 0) + passiv(h, "schaden") + stufeBonus(h).schaden + gruppenPassiv(S, "aura")
    + (h.hp < h.max / 2 ? passiv(h, "blutrausch") : 0) + (S.kampf && S.kampf.runde === 1 ? passiv(h, "erste") : 0);
  // Bonus gegen ein bestimmtes Ziel: Markierung (Jagdinstinkt gilt für alle), Untotenjäger
  const markPlus = S => Math.max(0, ...S.teilnehmer.map(p => passiv(S.helden[p], "markplus")));
  const zielBonus = (S, h, g) => (g.markiert > 0 ? 3 + markPlus(S) : 0) + (GEGNER[g.art].untot ? passiv(h, "untot") : 0);
  // Art des gerade ausgeführten Angriffs: nah, fern, magie, licht, gift (für Panzer, Untote, hinten Stehende)
  const ANGRIFFSART = {
    stab: "licht", licht: "licht", sonnenstrahl: "licht", sonnenzorn: "licht", gottesurteil: "licht", heilen: "licht",
    funken: "magie", feuerball: "magie", eis: "magie", meteor: "magie", inferno: "magie", winter: "magie", ranken: "magie",
    pfeil: "fern", doppel: "fern", hagel: "fern", markieren: "fern", kopfschuss: "fern", durchschuss: "fern", treibjagd: "fern",
    giftwolke: "gift", seuche: "gift", dolch: "stich", todesstoss: "stich",
    feuerweihe: "licht", schwarztod: "gift", schattentanz: "stich", sternschuss: "fern", wildnis: "fern", sternenfall: "magie", zeitstillstand: "magie"
  };
  let angriffsart = "nah", feuerangriff = false, dornenSchon = false;
  const FEUER = { funken: 1, feuerball: 1, meteor: 1, inferno: 1, sternenfall: 1 };
  // Endgegner wechseln in Phasen: Königin fliegt ab Phase 2, der Drache nur in Phase 1 und wird in Phase 3 schnell
  const istFliegend = (S, g) => !!GEGNER[g.art].fliegend || !!(S.kampf && ((g.art === "koenigin" && S.kampf.bossPhase >= 2) || (g.art === "drache" && S.kampf.bossPhase < 2)));
  const istSchnell = (S, g) => !!GEGNER[g.art].schnell || !!(g.art === "drache" && S.kampf && S.kampf.bossPhase >= 3);
  // Knochenschild: Der Knochenkönig nimmt in Phase 2 halben Schaden, solange einer seiner Diener steht
  const knochenschild = (S, g) => !!(S.kampf && S.kampf.bossPhase >= 2 && g.art === "koenig" && S.gegner.some(x => x !== g && x.hp > 0));
  // Sichtbarer Zustand eines Gegners (Namensschild)
  function zustand(S, g) {
    const art = GEGNER[g.art], z = [];
    if (knochenschild(S, g)) z.push("Knochenschild");
    if (art.boss && istFliegend(S, g)) z.push("fliegt");
    if (art.boss && istSchnell(S, g)) z.push("Wut");
    if (g.schutz > 0) z.push(`Schild ${g.schutz}`);
    if (g.feuer > 0 && (art.regeneration || fluch(S, "regen"))) z.push("brennt");
    if (racheBonus(S)) z.push(`Rache +${racheBonus(S)}`);
    return z;
  }
  function wirkung(S, g, d) {
    const art = GEGNER[g.art];
    if (art.untot && angriffsart === "licht") d *= 2;
    if ((art.hinten || istFliegend(S, g)) && (angriffsart === "nah" || angriffsart === "stich")) d = Math.ceil(d / 2);
    if (feuerangriff) g.feuer = 2;
    if (knochenschild(S, g)) d = Math.ceil(d / 2);
    if (art.panzer && !["gift", "magie", "licht", "stich"].includes(angriffsart)) d -= art.panzer;
    d = Math.max(1, d);
    if (g.schutz > 0) { const x = Math.min(g.schutz, d); g.schutz -= x; d -= x; }
    return d;
  }
  // Schaden wirklich abziehen; wer einen Gegner besiegt, heilt sich mit Siegeshunger/Blutzoll
  function aufGegner(S, pid, g, d, log) {
    const h = S.helden[pid], e = Math.min(d, g.hp);
    g.hp -= e; h.stats.schaden += e;
    // Fluch Dornen: Nahkampf kostet einmal pro Zug selbst Leben, aber nie den letzten
    if (fluch(S, "dornen") && e > 0 && !dornenSchon && (angriffsart === "nah" || angriffsart === "stich") && h.hp > 1) {
      dornenSchon = true;
      const x = Math.min(h.hp - 1, Math.round(staerke(S).dmg));
      if (x > 0) { h.hp -= x; log.push(`${heldName(S, pid)} sticht sich an den Dornen von ${g.name}: −${x} Leben.`); }
    }
    if (g.hp <= 0 && e > 0 && h.hp > 0 && passiv(h, "todheil")) { const x = heldHeilen(S, pid, passiv(h, "todheil")); if (x) log.push(`${heldName(S, pid)} schöpft Kraft: +${x} Leben.`); }
    return e;
  }
  // Schaden eines Helden an einem Gegner (mit Waffe, Segen, Talenten, Markierung)
  function schadenAnGegner(S, pid, g, n, log, wie, ohneBonus, ohneKrit, exakt) {
    if (!g || g.hp <= 0) { g = gegnerLebend(S)[0]; if (!g) return; }
    const h = S.helden[pid];
    if (!ohneBonus) { n += angriffsBonus(S, h); h.segen = 0; }
    n += zielBonus(S, h, g);
    if (!ohneKrit && passiv(h, "krit") && chance(S, passiv(h, "krit") / 100)) { n *= 2; wie = "trifft mit voller Wucht"; }
    if (!exakt) n = wirkung(S, g, n);
    const still = [];
    aufGegner(S, pid, g, n, still);
    log.push(`${heldName(S, pid)} ${wie} ${g.name}: ${n} Schaden${g.hp <= 0 ? ". " + g.name + " fällt!" : "."}`, ...still);
  }
  // Flächenschaden: Bonus zählt einmal, Markierung und Untotenjäger je Ziel
  function flaeche(S, pid, n, log, text) {
    const h = S.helden[pid];
    n += angriffsBonus(S, h); h.segen = 0;
    const getroffen = gegnerLebend(S), still = [];
    for (const g of getroffen) aufGegner(S, pid, g, wirkung(S, g, n + zielBonus(S, h, g)), still);
    log.push(`${heldName(S, pid)} ${text}: ${n} Schaden an allen.` + getroffen.filter(g => g.hp <= 0).map(g => ` ${g.name} fällt!`).join(""));
    log.push(...still);
    return getroffen;
  }
  function pfeile(S, pid, anzahl, n, log, text) {
    const h = S.helden[pid];
    const bonus = angriffsBonus(S, h); h.segen = 0;
    const teile = [], still = [];
    for (let i = 0; i < anzahl; i++) {
      const ziele = gegnerLebend(S); if (!ziele.length) break;
      const g = eins(S, ziele), d = wirkung(S, g, n + bonus + zielBonus(S, h, g));
      aufGegner(S, pid, g, d, still);
      teile.push(`${g.name} ${d}${g.hp <= 0 ? " (fällt!)" : ""}`);
    }
    log.push(`${heldName(S, pid)} ${text}: ${teile.join(", ")}.`, ...still);
  }
  // Gift setzen, ohne ein stärkeres zu überschreiben
  // Untote: Gift wirkt nur halb (Feuer/Brand voll)
  function vergiften(g, n, runden, feuer) {
    if (GEGNER[g.art].untot && !feuer) n = Math.ceil(n / 2);
    if (feuer) g.feuer = 2;
    if (g.hp > 0 && !(g.giftR > 0 && g.gift > n)) { g.gift = n; g.giftR = runden; }
  }
  function heilenAuf(S, von, ziel, n, log, wie) {
    n += passiv(S.helden[von], "heilplus");
    const z = S.helden[ziel], war = z.hp, e = heldHeilen(S, ziel, n);
    S.helden[von].stats.geheilt += e;
    log.push(war === 0 ? `${heldName(S, von)} holt ${heldName(S, ziel)} zurück: ${z.hp} Leben.` : `${heldName(S, von)} ${wie} ${ziel === von ? "sich" : heldName(S, ziel)}: +${e} Leben.`);
  }
  function alleHeilen(S, von, n, wecken) {
    let summe = 0;
    for (const q of S.teilnehmer) if (wecken || S.helden[q].hp > 0) summe += heldHeilen(S, q, n);
    S.helden[von].stats.geheilt += summe;
  }

  const ziel1 = (S, id) => { const z = S.gegner.find(g => g.id === id); return z && z.hp > 0 ? z : gegnerLebend(S)[0]; };
  function rundeAuswerten(S) {
    const log = [], k = S.kampf;
    const reihe = S.teilnehmer.filter(p => S.helden[p].hp > 0 && k.wahl[p]);
    // Ausgangslage und Ereignisse für die Wiedergabe auf allen Handys (Kampfbühne)
    const start = {
      gegner: S.gegner.map(g => ({ id: g.id, art: g.art, name: g.name, hp: g.hp, max: g.max, giftR: g.giftR, markiert: g.markiert, zustand: zustand(S, g) })),
      helden: Object.fromEntries(S.teilnehmer.map(p => { const h = S.helden[p]; return [p, { hp: h.hp, max: h.max, giftR: h.giftR }]; })),
      absicht: kopie(k.absicht || {}), ebene: S.ebene || 1
    };
    const ev = [];
    const schnapp = () => ({ g: Object.fromEntries(S.gegner.map(g => [g.id, g.hp])), h: Object.fromEntries(S.teilnehmer.map(q => [q, S.helden[q].hp])) });
    let vor = null, logAb = 0;
    const beginn = () => { vor = schnapp(); logAb = log.length; };
    const ende = e => {
      const jetzt = schnapp(), d = [];
      for (const id in jetzt.g) if (vor.g[id] !== undefined && jetzt.g[id] !== vor.g[id]) d.push([id, jetzt.g[id] - vor.g[id], jetzt.g[id]]);
      for (const id in jetzt.h) if (jetzt.h[id] !== vor.h[id]) d.push([id, jetzt.h[id] - vor.h[id], jetzt.h[id]]);
      const text = log.slice(logAb);
      if (text.length || d.length) ev.push(Object.assign({ d, text }, e));
    };
    const cd = (h, w) => { const a = aktionDef(h.rolle, w.a); if (a && (a.cd || a.meister)) h.cd[a.id] = cdVon(h, a); };
    const rs = (h, id) => plusVon(h, id, "schaden"), rh = (h, id) => plusVon(h, id, "heil");
    const ohneMeister = h => { for (const id in h.cd) if (!(NEUE[id] && NEUE[id].meister)) delete h.cd[id]; };
    // 1. Schutz, Heilung und Vorbereitung zuerst, damit sie noch in dieser Runde wirken
    for (const p of reihe) {
      const h = S.helden[p], w = k.wahl[p], n = heldName(S, p);
      cd(h, w);
      angriffsart = ANGRIFFSART[w.a] || "nah"; feuerangriff = !!FEUER[w.a]; dornenSchon = false;
      beginn();
      switch (w.a) {
        case "befreien": h.netz = 0; log.push(`${n} reißt sich aus dem Netz los.`); break;
        case "schild": h.schild = true; log.push(`${n} hebt den Schild und ruft die Gegner zu sich.`); break;
        case "fels": h.fels = true; h.immun = true; log.push(`${n} steht wie ein Fels. Alle Gegner wenden sich gegen ihn.`); break;
        case "verstecken": h.versteckt = true; h.lauer = true; log.push(`${n} verschwindet in den Schatten.`); break;
        case "rauch": k.nebel = true; log.push(`${n} wirft eine Rauchbombe. Die Gegner sehen kaum noch etwas.`); break;
        case "trank": { h.traenke -= 1; const e = heldHeilen(S, p, 14 + passiv(h, "trankplus")); log.push(`${n} trinkt einen Heiltrank: +${e} Leben.`); break; }
        case "heilen": {
          heilenAuf(S, p, w.ziel, 10 + rh(h, "heilen"), log, "heilt");
          if (passiv(h, "heilsprung")) {
            const z2 = lebend(S).filter(q => q !== w.ziel && S.helden[q].hp < S.helden[q].max).sort((x, y) => S.helden[x].hp / S.helden[x].max - S.helden[y].hp / S.helden[y].max)[0];
            if (z2) heilenAuf(S, p, z2, Math.ceil((10 + rh(h, "heilen")) / 2) - passiv(h, "heilplus"), log, "lässt Licht überspringen auf");
          }
          const x = passiv(h, "heilschaden"), g = gegnerLebend(S).length ? eins(S, gegnerLebend(S)) : null;
          if (x && g) schadenAnGegner(S, p, g, x, log, "straft mit Licht", true, true);
          break;
        }
        case "handauflegen": {
          heilenAuf(S, p, w.ziel, 8 + rh(h, "handauflegen"), log, "legt die Hände auf");
          const x = passiv(h, "selbstheil"); if (x && w.ziel !== p) { const e = heldHeilen(S, p, x); h.stats.geheilt += e; if (e) log.push(`${n} schöpft selbst Kraft: +${e} Leben.`); }
          break;
        }
        case "kraeuter": { const z = S.helden[w.ziel]; z.gift = 0; z.giftR = 0; heilenAuf(S, p, w.ziel, 9 + rh(h, "kraeuter"), log, "versorgt mit Kräutern"); break; }
        case "segen": { const x = 6 + rh(h, "segen"); alleHeilen(S, p, x); for (const q of lebend(S)) S.helden[q].segen = Math.max(S.helden[q].segen || 0, 3); log.push(`${n} spricht einen Segen: alle +${x} Leben, nächster Angriff +3.`); break; }
        case "laeutern": { const x = 6 + rh(h, "laeutern"); alleHeilen(S, p, x); for (const q of S.teilnehmer) { S.helden[q].gift = 0; S.helden[q].giftR = 0; } log.push(`${n} läutert die Gruppe: alle +${x} Leben, kein Gift mehr.`); break; }
        case "wiedergeburt": {
          const weg = S.teilnehmer.filter(q => S.helden[q].hp <= 0);
          for (const q of S.teilnehmer) { const z = S.helden[q]; h.stats.geheilt += heldHeilen(S, q, z.hp <= 0 ? Math.ceil(z.max / 2) : 5); }
          log.push(`${n} ruft das Leben zurück${weg.length ? ": " + weg.map(q => heldName(S, q)).join(" und ") + " steh" + (weg.length > 1 ? "en" : "t") + " wieder auf" : ""}. Alle anderen +5.`); break;
        }
        case "kriegsschrei": {
          for (const q of lebend(S)) S.helden[q].segen = Math.max(S.helden[q].segen || 0, 3);
          heldHeilen(S, p, 6); const x = rh(h, "kriegsschrei"); if (x) alleHeilen(S, p, x);
          log.push(`${n} brüllt einen Kriegsschrei: alle nächster Angriff +3${x ? `, alle +${x} Leben` : ""}.`); break;
        }
        case "spott": {
          const z = ziel1(S, w.ziel);
          schadenAnGegner(S, p, z, 3, log, "verspottet und trifft");
          if (z && z.hp > 0) { z.spott = p; log.push(`${z.name} schäumt vor Wut und will nur noch ${n}.`); }
          break;
        }
        case "taktik": ohneMeister(S.helden[w.ziel]); log.push(`${n} gibt ${heldName(S, w.ziel)} ein Zeichen: alle Fähigkeiten wieder bereit.`); break;
        case "bollwerk": k.bollwerk = true; log.push(`${n} stemmt sich gegen den Ansturm: Die Gruppe nimmt diese Runde nur halben Schaden.`); break;
        case "schlachtruf": { alleHeilen(S, p, 8); for (const q of lebend(S)) S.helden[q].segen = 6; log.push(`${n} stößt einen Schlachtruf aus: alle +8 Leben, nächster Angriff +6.`); break; }
        case "wall": for (const q of S.teilnehmer) S.helden[q].immun = true; log.push(`${n} errichtet einen heiligen Wall. Kein Schlag dringt hindurch.`); break;
        case "gnadenlicht": { const x = 7 + passiv(h, "heilplus"); alleHeilen(S, p, x, true); log.push(`${n} lässt Gnadenlicht leuchten: alle +${x} Leben.`); break; }
        case "auferstehung": {
          for (const q of S.teilnehmer) { const z = S.helden[q]; h.stats.geheilt += heldHeilen(S, q, z.hp <= 0 ? z.max : 10); }
          log.push(`${n} ruft die Gefallenen zurück: Bewusstlose stehen mit vollen Leben auf, alle anderen +10.`); break;
        }
        case "frost": k.frost = 3; log.push(`${n} lässt Frost über die Gegner kriechen: Ihre Angriffe werden schwächer.`); break;
        case "zeitriss": { for (const q of S.teilnehmer) ohneMeister(S.helden[q]); for (const q of lebend(S)) S.helden[q].segen = 5; log.push(`${n} reißt die Zeit auf: alle Abklingzeiten vorbei, nächster Angriff +5.`); break; }
        case "obhut": S.helden[w.ziel].immun = true; log.push(`${n} nimmt ${w.ziel === p ? "sich selbst" : heldName(S, w.ziel)} in Obhut.`); break;
        case "erloesung": { for (const q of S.teilnehmer) { const z = S.helden[q]; h.stats.geheilt += heldHeilen(S, q, z.max); } log.push(`${n} spricht die Erlösung: Alle sind voll geheilt.`); break; }
        case "heiligtum": { alleHeilen(S, p, 10); k.heiligtum = { von: p, runden: 2 }; log.push(`${n} weiht den Boden: alle +10 Leben, und das Licht bleibt noch zwei Runden.`); break; }
        case "lebensquell": { alleHeilen(S, p, 12, true); k.heiligtum = { von: p, runden: 3, n: 10 }; log.push(`${n} öffnet einen Lebensquell: alle +12 Leben, drei Runden lang je +10.`); break; }
        case "gnade": {
          for (const q of S.teilnehmer) { const z = S.helden[q]; if (z.gefallen) continue; h.stats.geheilt += heldHeilen(S, q, z.max); z.gift = 0; z.giftR = 0; z.segen = Math.max(z.segen || 0, 4); }
          log.push(`${n} ruft die göttliche Gnade herab: Alle sind voll geheilt, das Gift ist fort, nächster Angriff +4.`); break;
        }
        case "ewigschild": k.bollwerk = true; k.bollwerkNoch = 1; log.push(`${n} hebt den ewigen Schild: Zwei Runden lang nimmt die Gruppe nur halben Schaden.`); break;
        case "arkan": {
          S.helden[w.ziel].immun = true; log.push(`${n} legt einen arkanen Schild um ${w.ziel === p ? "sich" : heldName(S, w.ziel)}.`);
          if (passiv(h, "arkanheil") && S.helden[w.ziel].hp > 0) heilenAuf(S, p, w.ziel, passiv(h, "arkanheil") - passiv(h, "heilplus"), log, "stärkt");
          break;
        }
        case "beschuetzen": {
          S.helden[w.ziel].beschuetzt = p; log.push(`${n} stellt sich vor ${heldName(S, w.ziel)}.`);
          if (passiv(h, "schutzheil")) heilenAuf(S, p, w.ziel, passiv(h, "schutzheil") - passiv(h, "heilplus"), log, "segnet");
          break;
        }
        case "licht": alleHeilen(S, p, 4); break;     // Schaden folgt unten
      }
      ende({ von: p, a: w.a, ziel: w.ziel || null, phase: 1 });
    }
    // 2. Angriffe
    const brand = (h, getroffen) => { const x = passiv(h, "brand"); if (!x) return; for (const g of getroffen) vergiften(g, x, 2, true); if (getroffen.some(g => g.hp > 0)) log.push("Die Getroffenen brennen."); };
    for (const p of reihe) {
      if (!gegnerLebend(S).length) break;
      const h = S.helden[p], w = k.wahl[p], ziel = S.gegner.find(g => g.id === w.ziel);
      angriffsart = ANGRIFFSART[w.a] || "nah"; feuerangriff = !!FEUER[w.a]; dornenSchon = false;
      beginn();
      switch (w.a) {
        case "schlag": schadenAnGegner(S, p, ziel, wurf(S, 6, 8) + rs(h, "schlag"), log, "trifft"); break;
        case "vernichten": schadenAnGegner(S, p, ziel, wurf(S, 13, 17) + rs(h, "vernichten"), log, "spaltet"); break;
        case "stab": {
          schadenAnGegner(S, p, ziel, wurf(S, 4, 6) + rs(h, "stab"), log, "brennt Licht in");
          const x = passiv(h, "stabheil"), z = lebend(S).filter(q => S.helden[q].hp < S.helden[q].max).sort((a2, b2) => S.helden[a2].hp / S.helden[a2].max - S.helden[b2].hp / S.helden[b2].max)[0];
          if (x && z) heilenAuf(S, p, z, x - passiv(h, "heilplus"), log, "wärmt mit dem Stab");
          break;
        }
        case "funken": schadenAnGegner(S, p, ziel, wurf(S, 5, 7) + rs(h, "funken"), log, "schleudert Funken auf"); break;
        case "pfeil": schadenAnGegner(S, p, ziel, wurf(S, 7, 9) + rs(h, "pfeil"), log, "schießt auf"); break;
        case "hammer": schadenAnGegner(S, p, ziel, wurf(S, 5, 7) + rs(h, "hammer"), log, "schmettert den Hammer auf"); break;
        case "dolch": {
          let d = wurf(S, 7, 9) + rs(h, "dolch"), wie = "sticht";
          if (h.lauer) { d *= 3; h.lauer = false; wie = "springt aus dem Schatten auf"; }
          else if (chance(S, 0.33 + passiv(h, "krit") / 100)) { d *= 2; wie = "trifft genau"; }
          schadenAnGegner(S, p, ziel, d, log, wie, false, true);
          const dg = passiv(h, "dolchgift"), z = ziel && ziel.hp > 0 ? ziel : null;
          if (dg && z) vergiften(z, dg + passiv(h, "giftplus"), 2 + passiv(h, "giftlang"));
          break;
        }

        case "gift": {
          const z = ziel && ziel.hp > 0 ? ziel : gegnerLebend(S)[0];
          schadenAnGegner(S, p, z, 3 + rs(h, "gift"), log, "vergiftet");
          if (z && z.hp > 0) { z.gift = 0; z.giftR = 0; vergiften(z, 3 + passiv(h, "giftplus"), 3 + passiv(h, "giftlang")); }
          break;
        }
        case "taschendieb": {
          const z = ziel && ziel.hp > 0 ? ziel : gegnerLebend(S)[0];
          schadenAnGegner(S, p, z, 4 + rs(h, "taschendieb"), log, "rempelt");
          const g = wurf(S, 6, 10) + passiv(h, "taschengold"); h.gold += g; log.push(`${heldName(S, p)} erbeutet dabei ${g} Gold.`); break;
        }
        case "eis": {
          const z = ziel && ziel.hp > 0 ? ziel : gegnerLebend(S)[0];
          schadenAnGegner(S, p, z, wurf(S, 7, 9) + rs(h, "eis"), log, "durchbohrt mit Eis");
          if (z && z.hp > 0) { z.starr = 1; log.push(`${z.name} erstarrt.`); }
          const sp = passiv(h, "eissplitter"), andere = gegnerLebend(S).filter(g => g !== z);
          if (sp && andere.length) { const still = []; for (const g of andere) aufGegner(S, p, g, wirkung(S, g, sp), still); log.push(`Eissplitter treffen ${andere.map(g => g.name + (g.hp <= 0 ? " (fällt!)" : "")).join(", ")}: je ${sp} Schaden.`, ...still); }
          break;
        }
        case "markieren": {
          const z = ziel && ziel.hp > 0 ? ziel : gegnerLebend(S)[0];
          schadenAnGegner(S, p, z, 4 + rs(h, "markieren"), log, "markiert und trifft");
          if (z && z.hp > 0) z.markiert = 4;          // zählt am Rundenende herunter: 3 volle Runden
          break;
        }
        case "wirbel": flaeche(S, p, 4 + rs(h, "wirbel"), log, "wirbelt herum"); break;
        case "feuerball": brand(h, flaeche(S, p, 5 + rs(h, "feuerball"), log, "wirft einen Feuerball")); break;
        case "meteor": brand(h, flaeche(S, p, 11 + rs(h, "meteor"), log, "ruft einen Meteor herab")); break;
        case "inferno": brand(h, flaeche(S, p, 20, log, "entfesselt ein Inferno")); break;
        case "durchschuss": flaeche(S, p, 14, log, "schießt einen Pfeil durch alle Reihen"); break;
        case "sonnenstrahl": flaeche(S, p, 6 + rs(h, "sonnenstrahl"), log, "lässt die Sonne herabstrahlen"); break;
        case "sonnenzorn": { flaeche(S, p, 15, log, "ruft den Sonnenzorn herab"); alleHeilen(S, p, 5); log.push("Alle Helden +5 Leben."); break; }
        case "treibjagd": { flaeche(S, p, 6, log, "treibt die Gegner zusammen"); for (const g of gegnerLebend(S)) g.markiert = 4; log.push("Alle Gegner sind markiert."); break; }
        case "winter": { flaeche(S, p, 6, log, "ruft den ewigen Winter"); for (const g of gegnerLebend(S)) g.starr = 1; if (gegnerLebend(S).length) log.push("Alle Gegner erstarren."); break; }
        case "giftwolke": { const x = 3 + passiv(h, "giftplus"); for (const g of flaeche(S, p, 2 + rs(h, "giftwolke"), log, "wirft eine Giftwolke")) vergiften(g, x, 3 + passiv(h, "giftlang")); break; }
        case "seuche": { const x = 5 + passiv(h, "giftplus"); for (const g of flaeche(S, p, 5, log, "verbreitet eine Seuche")) vergiften(g, x, 3 + passiv(h, "giftlang")); break; }
        case "raserei": pfeile(S, p, 3, 10, log, "rast und schlägt dreimal zu"); break;
        case "ansturm": { flaeche(S, p, 12, log, "führt den Ansturm an"); for (const q of lebend(S)) S.helden[q].segen = Math.max(S.helden[q].segen || 0, 4); log.push("Alle: nächster Angriff +4."); break; }
        case "klingensturm": pfeile(S, p, 5, 9, log, "wird zum Klingensturm"); break;
        case "feuerweihe": { flaeche(S, p, 18, log, "entfacht läuterndes Feuer"); alleHeilen(S, p, 6); log.push("Alle Helden +6 Leben."); break; }
        case "schattentanz": { pfeile(S, p, 4, 11, log, "tanzt durch die Schatten"); h.versteckt = true; log.push(`${heldName(S, p)} verschwindet in den Schatten.`); break; }
        case "schwarztod": { const x = 8 + passiv(h, "giftplus"); for (const g of flaeche(S, p, 8, log, "bringt den schwarzen Tod")) vergiften(g, x, 3 + passiv(h, "giftlang")); break; }
        case "sternschuss": schadenAnGegner(S, p, ziel, 40, log, "schießt einen Sternschuss auf"); break;
        case "wildnis": { pfeile(S, p, 6, 9, log, "ruft die Wildnis"); alleHeilen(S, p, 6); log.push("Alle Helden +6 Leben."); break; }
        case "sternenfall": brand(h, flaeche(S, p, 28, log, "lässt Sterne fallen")); break;
        case "zeitstillstand": { flaeche(S, p, 8, log, "hält die Zeit an"); for (const g of gegnerLebend(S)) g.starr = 2; if (gegnerLebend(S).length) log.push("Alle Gegner erstarren für zwei Runden."); break; }
        case "wolfsrudel": pfeile(S, p, 3, 10, log, "lässt die Wölfe los"); break;
        case "kopfschuss": schadenAnGegner(S, p, ziel, wurf(S, 12, 15) + rs(h, "kopfschuss"), log, "zielt genau auf"); break;
        case "ranken": {
          const z = ziel1(S, w.ziel);
          schadenAnGegner(S, p, z, 5 + rs(h, "ranken"), log, "lässt Ranken wachsen um");
          if (z && z.hp > 0) { z.starr = 1; log.push(`${z.name} ist gefesselt.`); }
          break;
        }
        case "gottesurteil": {
          const z = ziel1(S, w.ziel);
          if (z && GEGNER[z.art].untot && !GEGNER[z.art].boss) schadenAnGegner(S, p, z, z.hp, log, "spricht das Gottesurteil über", true, true, true);
          else schadenAnGegner(S, p, z, 30, log, "spricht das Gottesurteil über");
          break;
        }
        case "todesstoss": {
          const z = ziel1(S, w.ziel);
          if (z && !GEGNER[z.art].boss && z.hp <= z.max * 0.3) schadenAnGegner(S, p, z, z.hp, log, "setzt den Todesstoß gegen", true, true, true);
          else schadenAnGegner(S, p, z, z && GEGNER[z.art].boss ? 20 : 15, log, "sticht tief in");
          break;
        }
        case "meisterdieb": {
          schadenAnGegner(S, p, ziel1(S, w.ziel), 12, log, "bestiehlt und verletzt");
          h.gold += 25; const tr = h.traenke < trankMax(h); if (tr) h.traenke += 1;
          log.push(`${heldName(S, p)} erbeutet 25 Gold${tr ? " und einen Heiltrank" : ""}.`); break;
        }
        case "licht": flaeche(S, p, 5 + rs(h, "licht"), log, "lässt heiliges Licht strahlen (alle Helden +4)"); break;
        case "doppel": pfeile(S, p, 2, 5 + rs(h, "doppel"), log, "schießt zwei Pfeile"); break;
        case "hagel": pfeile(S, p, 4, 5 + rs(h, "hagel"), log, "lässt Pfeile regnen"); break;
      }
      ende({ von: p, a: w.a, ziel: w.ziel || null, phase: 2 });
    }
    // 3. Gift auf Gegnern
    for (const g of gegnerLebend(S)) if (g.giftR > 0) {
      beginn();
      const e = Math.min(g.gift, g.hp); g.hp -= e; g.giftR -= 1;
      const dieb = S.teilnehmer.find(p => S.helden[p].rolle === "dieb"); if (dieb) S.helden[dieb].stats.schaden += e;
      log.push(`Das Gift frisst an ${g.name}: ${e} Schaden${g.hp <= 0 ? ". " + g.name + " fällt!" : "."}`);
      ende({ von: g.id, a: "giftTick" });
    }
    angriffsart = "nah"; feuerangriff = false;
    // Ein besiegter Langfinger lässt das gestohlene Gold fallen
    const beuteZurueck = () => {
      for (const g of S.gegner) if (g.hp <= 0 && !g.geflohen && g.beute) {
        beginn();
        const t = Object.keys(g.beute).map(q => { S.helden[q].gold += g.beute[q]; return `${heldName(S, q)} ${g.beute[q]}`; });
        g.beute = null;
        log.push(`${g.name} lässt die Beute fallen. Gold zurück: ${t.join(", ")}.`);
        ende({ von: g.id, a: "beute" });
      }
    };
    beuteZurueck();
    // Besiegte verlassen die Bühne, wenn Verstärkung kommt (ihre Erfahrung bleibt)
    const racheZaehlen = () => { for (const x of S.gegner) if (x.hp <= 0 && !x.geflohen && !x.gezaehlt) { x.gezaehlt = true; k.rache = (k.rache || 0) + 1; } };
    const aufraeumen = () => {
      racheZaehlen();
      for (const x of S.gegner) if (x.hp <= 0 && !x.gerufen && !x.geflohen) k.epTot = (k.epTot || 0) + (GEGNER[x.art].ep || 0);
      S.gegner = S.gegner.filter(x => x.hp > 0);
    };
    const kurz = g => ({ id: g.id, art: g.art, name: g.name, hp: g.hp, max: g.max });
    const rufen = (anzahl, art) => {
      aufraeumen();
      const neu = [];
      for (let i = 0; i < anzahl && gegnerLebend(S).length < 4 && (k.gerufen || 0) < MAX_GERUFEN; i++) { const g = Object.assign(gegnerErzeugen(S, art), { gerufen: true }); S.gegner.push(g); neu.push(g); k.gerufen = (k.gerufen || 0) + 1; }
      return neu.map(kurz);
    };
    // Explosive Gegner reißen beim Tod alle mit
    const explosionen = () => {
      for (const g of S.gegner) {
        const X = GEGNER[g.art].explosiv;
        if (!X || g.hp > 0 || g.explodiert || g.geflohen) continue;
        g.explodiert = true;
        if (!lebend(S).length) continue;
        beginn();
        log.push(X.text);
        for (const p of lebend(S)) { treffer(S, p, gdmg(S, X.n), log, null); const h = S.helden[p]; if ((X.gift || X.brand) && h.hp > 0 && !h.immun) setzeGift(h, gdmg(S, X.brand ? 3 : 2), 2, X.brand); }
        ende({ von: g.id, a: "explosion" });
      }
    };
    explosionen();
    // Schleim teilt sich einmal, sobald er verletzt ist
    for (const g of gegnerLebend(S)) {
      if (!GEGNER[g.art].teilt || g.geteilt || g.hp >= g.max || g.hp < 8 || gegnerLebend(S).length >= 4) continue;
      beginn();
      g.geteilt = true;
      const halb = Math.floor(g.hp / 2); g.hp -= halb;
      aufraeumen();
      const n = Object.assign(gegnerErzeugen(S, g.art), { hp: halb, max: halb, geteilt: true, gerufen: true });
      S.gegner.push(n);
      log.push(`${g.name} wabbelt und teilt sich in zwei!`);
      ende({ von: g.id, a: "ruf", neu: [kurz(n)] });
    }
    // 4. Endgegner wechseln die Phase
    const boss = S.gegner.find(g => GEGNER[g.art].boss && g.hp > 0), q = boss ? boss.hp / boss.max : 1;
    const phase = (nr, text, extra) => { k.bossPhase = nr; beginn(); const neu = extra ? extra() : null; log.push(text); ende(Object.assign({ von: boss.id, a: neu ? "ruf" : "phase", phase: nr }, neu ? { neu } : {})); };
    if (boss && boss.art === "koenig" && k.bossPhase < 2 && q <= 0.5)
      phase(2, "Der Knochenkönig hebt die Arme. Zwei Skelette kriechen aus dem Boden, und Knochen legen sich wie ein Schild um ihn: Solange ein Skelett steht, nimmt er nur halben Schaden!", () => rufen(2, "skelett"));
    if (boss && boss.art === "koenigin" && k.bossPhase < 2 && q <= 0.5)
      phase(2, "Die Spinnenkönigin zieht sich an ihren Fäden zur Decke hinauf! Von dort oben treffen Nahkampfangriffe nur noch halb.");
    if (boss && boss.art === "drache" && k.bossPhase < 2 && q <= 0.5)
      phase(2, "Der Glutdrache stürzt mit zerfetzten Flügeln zu Boden! Jetzt treffen ihn auch Schwerter voll, aber sein Schwanz peitscht.");
    if (boss && boss.art === "drache" && k.bossPhase < 3 && q <= 0.25)
      phase(3, "Der Glutdrache tobt vor Wut: Er greift jetzt zweimal pro Runde an!");
    // 5. Gegner handeln (nach ihrer angekündigten Absicht)
    const RUFTEXT = {
      koenig: "Der Knochenkönig hebt die Hand: Ein neues Skelett kriecht aus dem Boden.",
      totenbeschwoerer: "Der Totenbeschwörer murmelt dunkle Worte: Ein Skelett kriecht aus dem Boden!",
      spinnenmutter: "Die Brutmutter zirpt: Spinnenbrut krabbelt aus allen Ritzen!",
      koenigin: "Die Spinnenkönigin legt Eier. Sofort schlüpft Spinnenbrut!"
    };
    const bossWucht = g => g.art === "koenig" ? { n: 5, text: "Der Knochenkönig stampft auf: Der Boden bebt!" }
      : k.bossPhase < 2 ? { n: 7, text: "Der Glutdrache speit Feuer über euch alle!", brand: true } : { n: 7, text: "Der Glutdrache peitscht mit dem Schwanz durch den Raum!" };
    // ein einzelner Schlag gegen einen Helden (schnelle Gegner schlagen zweimal)
    const hieb = (g, plan) => {
      const art = GEGNER[g.art];
      if (k.nebel && chance(S, 0.5)) { log.push(`${g.name} schlägt im Rauch ins Leere.`); return { a: "daneben", ziel: plan.ziel || null }; }
      const zieher = lebend(S).filter(p => S.helden[p].schild || S.helden[p].fels);
      const ziele = lebend(S).filter(p => !S.helden[p].versteckt);
      const spott = g.spott && ziele.includes(g.spott) ? g.spott : null;
      let p = spott || (zieher.length ? eins(S, zieher) : (plan.ziel && ziele.includes(plan.ziel) ? plan.ziel : (ziele.length ? eins(S, ziele) : null)));
      if (!p) { log.push(`${g.name} sucht vergeblich nach einem Ziel.`); return { a: "keinziel", ziel: plan.ziel || null }; }
      if ((spott || zieher.length) && plan.ziel && p !== plan.ziel && S.helden[plan.ziel] && S.helden[plan.ziel].hp > 0) log.push(`${heldName(S, p)} zieht den Angriff auf sich.`);
      let minus = k.frost || 0;
      const b = S.helden[p].beschuetzt;
      if (!spott && !zieher.length && b && S.helden[b].hp > 0) { log.push(`${heldName(S, b)} fängt den Angriff auf ${heldName(S, p)} ab.`); p = b; minus += 2 + passiv(S.helden[b], "schutzplus"); }
      const rudel = art.rudel ? art.rudel * gegnerLebend(S).filter(x => x !== g && x.art === g.art).length : 0;
      const orks = art.ork && S.gegner.some(x => x !== g && x.hp > 0 && GEGNER[x.art].anfuehrer) ? 2 : 0;
      treffer(S, p, gdmg(S, wurf(S, art.dmg[0], art.dmg[1])) + rudel + orks + racheBonus(S) - minus, log, g.name, g);
      const z = S.helden[p];
      if (art.gift && z.hp > 0 && !z.immun && chance(S, 0.4)) { setzeGift(z, gdmg(S, 2), 2); log.push(`${heldName(S, p)} ist vergiftet.`); }
      if (art.brand && z.hp > 0 && !z.immun && chance(S, 0.4)) { setzeGift(z, gdmg(S, 3), 2, true); log.push(`${heldName(S, p)} steht in Flammen.`); }
      if (art.langfinger && !z.immun && z.gold > 0) {
        const n = Math.min(z.gold, wurf(S, 5, 8));
        z.gold -= n; g.beute = g.beute || {}; g.beute[p] = (g.beute[p] || 0) + n;
        log.push(`${g.name} greift in den Beutel von ${heldName(S, p)}: ${n} Gold weg!`);
        return { a: "stehlen", ziel: p, gold: n };
      }
      return { a: art.gift ? "biss" : "angriff", ziel: p };
    };
    const gegnerZug = g => {
      const art = GEGNER[g.art], plan = (k.absicht || {})[g.id] || {};
      if (g.starr > 0) { log.push(`${g.name} ist erstarrt und kann nicht angreifen.`); return { a: "starr" }; }
      if (plan.a === "ruf" && gegnerLebend(S).length < 4) {
        const neu = rufen(art.ruf || 1, art.beschwoerer || "skelett");
        log.push(RUFTEXT[g.art] || `${g.name} ruft Verstärkung!`);
        return { a: "ruf", neu };
      }
      if (plan.a === "flucht") {
        const summe = Object.values(g.beute || {}).reduce((x, y) => x + y, 0);
        g.geflohen = true; g.hp = 0;
        log.push(summe ? `${g.name} huscht mit ${summe} Gold davon!` : `${g.name} huscht mit leeren Taschen davon.`);
        return { a: "flucht" };
      }
      if (plan.a === "ruhe") { log.push(`${g.name} glüht auf und sammelt Kraft.`); return { a: "ruhe" }; }
      if (plan.a === "netz") {
        const ziele = lebend(S).filter(p => !S.helden[p].versteckt);
        const p = plan.ziel && ziele.includes(plan.ziel) ? plan.ziel : ziele.length ? eins(S, ziele) : null;
        if (!p) { log.push(`${g.name} findet niemanden für ihr Netz.`); return { a: "keinziel" }; }
        if (S.helden[p].immun) { log.push(`Das Netz von ${g.name} prallt an ${heldName(S, p)} ab.`); return { a: "netz", ziel: p }; }
        S.helden[p].netz = 1;
        log.push(`${g.name} spinnt ${heldName(S, p)} ein: nächste Runde nur „Befreien“.`);
        return { a: "netz", ziel: p };
      }
      if (plan.a === "schuetzen") {
        const v = S.gegner.find(x => x.id === plan.ziel && x.hp > 0) || gegnerLebend(S).find(x => x !== g);
        if (v) { v.schutz = gdmg(S, 8); log.push(`${g.name} legt einen Schild um ${v.name}: Er schluckt ${v.schutz} Schaden.`); return { a: "schuetzen", ziel: v.id }; }
      }
      if (art.heiler) {
        const verletzt = gegnerLebend(S).filter(x => x !== g && x.hp < x.max * 0.6).sort((a2, b2) => a2.hp / a2.max - b2.hp / b2.max)[0];
        if (verletzt) { const n = Math.min(gdmg(S, 7), verletzt.max - verletzt.hp); verletzt.hp += n; log.push(`${g.name} murmelt einen Zauber: ${verletzt.name} +${n} Leben.`); return { a: "heilen", ziel: verletzt.id }; }
      }
      const W = plan.a === "beben" ? (art.boss ? bossWucht(g) : art.wucht) : null;
      if (W) {
        log.push(W.text);
        for (const p of lebend(S)) {
          treffer(S, p, gdmg(S, W.n) - (k.frost || 0), log, null);
          const h = S.helden[p];
          if ((W.gift || W.brand) && h.hp > 0 && !h.immun) setzeGift(h, gdmg(S, W.brand ? 3 : 2), 2, W.brand);
        }
        if (W.gift) log.push("Wer noch steht, ist vergiftet.");
        if (W.brand) log.push("Wer noch steht, brennt.");
        return { a: "beben" };
      }
      let erg = hieb(g, plan);
      if (istSchnell(S, g) && lebend(S).length && erg.a !== "keinziel") { const z2 = hieb(g, {}); if (z2.a !== "keinziel") erg = Object.assign({}, erg, { doppelt: true }); }
      return erg;
    };
    racheZaehlen();
    for (const g of gegnerLebend(S)) { if (g.hp <= 0) continue; beginn(); const z = gegnerZug(g); ende(Object.assign({ von: g.id }, z)); }
    beuteZurueck();
    explosionen();
    // 6. Gift auf Helden, Rundenende
    for (const p of lebend(S)) {
      const h = S.helden[p];
      if (h.giftR > 0) { beginn(); const n = Math.min(h.gift, h.hp); h.hp -= n; h.giftR -= 1; log.push(`${h.giftArt || "Gift"}: ${heldName(S, p)} −${n} Leben${h.hp <= 0 ? " und bricht zusammen!" : "."}`); if (h.hp <= 0) h.stats.umgefallen += 1; ende({ von: p, a: "giftTick" }); }
    }
    for (const p of S.teilnehmer) {
      const h = S.helden[p];
      Object.assign(h, { schild: false, versteckt: false, immun: false, fels: false, beschuetzt: null });
      const benutzt = k.wahl[p] && k.wahl[p].a;
      for (const c in h.cd) if (h.cd[c] > 0 && c !== benutzt) h.cd[c] -= 1;
    }
    if (k.heiligtum && k.heiligtum.runden > 0 && lebend(S).length) {
      beginn();
      const von = k.heiligtum.von;
      const x = k.heiligtum.n || 8;
      for (const q of lebend(S)) S.helden[von].stats.geheilt += heldHeilen(S, q, x);
      k.heiligtum.runden -= 1;
      log.push(k.heiligtum.n ? `Der Lebensquell sprudelt: alle +${x} Leben.` : `Das Heiligtum leuchtet: alle +${x} Leben.`);
      ende({ von, a: "heiligtumTick" });
    }
    // Regeneration (Feuer stoppt sie); der Fluch gibt jedem Gegner 5 % seiner Leben dazu
    for (const g of gegnerLebend(S)) {
      const r = GEGNER[g.art].regeneration, f = fluch(S, "regen") ? g.max * 0.05 : 0;
      if ((!r && !f) || g.feuer > 0 || g.hp >= g.max || !lebend(S).length) continue;
      // zu zweit weniger, und mit jeder Runde schwächer (ab Runde 11 gar nicht mehr): kein endloser Kampf
      const n = Math.round(((r ? gdmg(S, r) * Math.min(1, gruppe(S).hp) : 0) + f) * Math.max(0, 1 - (S.kampf.runde - 1) / 10));
      if (n < 1) continue;
      beginn(); const x = Math.min(n, g.max - g.hp); g.hp += x;
      log.push(`${g.name} regeneriert: +${x} Leben.`);
      ende({ von: g.id, a: "regen" });
    }
    for (const g of S.gegner) { if (g.starr > 0) g.starr -= 1; if (g.markiert > 0) g.markiert -= 1; if (g.feuer > 0) g.feuer -= 1; g.spott = null; }
    k.nebel = false; k.frost = 0; k.bollwerk = (k.bollwerkNoch || 0) > 0; if (k.bollwerkNoch) k.bollwerkNoch -= 1;
    S.log = log;
    S.letzte = { id: `${S.spielNr}:${S.raumNr}:${k.runde}`, runde: k.runde, titel: S.seite ? S.seite.titel : "", start, ev };
    k.wahl = {};
    k.runde += 1;

    if (gegnerLebend(S).length && lebend(S).length) planeGegner(S);
    if (!gegnerLebend(S).length) kampfGewonnen(S);
    else if (!lebend(S).length) { S.phase = "ende"; S.ergebnis = "niederlage"; S.seite = { bild: "grab", titel: "Ihr seid gefallen", text: [ebeneVon(S).niederlage] }; S.kampf = null; }
  }
  function setzeGift(h, n, runden, brand) { h.gift = n; h.giftR = runden; h.giftArt = brand ? "Brand" : "Gift"; }
  function treffer(S, p, n, log, von, g) {
    const h = S.helden[p], wer = heldName(S, p);
    if (h.immun) { log.push(von ? `${von} trifft ${wer}, doch der Schlag prallt ab.` : `${wer} bleibt unversehrt.`); return; }
    n = Math.max(1, n - h.ruestung - passiv(h, "ruestung") - stufeBonus(h).ruestung - gruppenPassiv(S, "schutzaura", p));
    if (h.schild) n = Math.ceil(n / 2);
    if (h.hp < h.max / 2) n = Math.max(1, n - passiv(h, "notpanzer"));
    if (S.kampf && S.kampf.bollwerk) n = Math.ceil(n / 2);
    const echt = Math.min(n, h.hp);
    h.hp -= echt;
    log.push((von ? `${von} trifft ${wer}: ` : `${wer}: `) + `−${n} Leben${h.hp <= 0 ? ". " + wer + " bricht zusammen!" : "."}`);
    if (h.hp <= 0) h.stats.umgefallen += 1;
    const d = passiv(h, "dornen") + (h.schild ? passiv(h, "schilddornen") : 0);
    if (g && d && g.hp > 0) {
      const e = Math.min(d, g.hp); g.hp -= e; h.stats.schaden += e;
      log.push(`${g.name} verletzt sich an den Stacheln von ${wer}: ${e} Schaden${g.hp <= 0 ? ". " + g.name + " fällt!" : "."}`);
    }
  }
  // EP für alle Helden; gibt Texte zu Stufenaufstiegen zurück
  function erfahrung(S, ep) {
    const t = [];
    if (ep <= 0) return t;
    ep = Math.round(ep * staerke(S).ep);
    t.push(`+${ep} Erfahrung für jeden.`);
    for (const p of S.teilnehmer) {
      const h = S.helden[p], vorher = h.stufe;
      h.ep += ep;
      h.stufe = stufeAus(h.ep);
      const bonus = [];
      let tp = 0, rp = 0;
      for (let st = vorher + 1; st <= h.stufe; st++) {
        h.max += 3; h.hp = Math.min(h.max, h.hp + 3);
        if (st <= AUFSTIEG_STUFE) tp++;
        if (st >= AUFSTIEG_STUFE) rp++;
        if (STUFENBONUS[st]) bonus.push(STUFENBONUS[st]);
      }
      h.punkte += tp; h.ruhm = (h.ruhm || 0) + rp;
      const pk = [tp ? (tp === 1 ? "1 Talentpunkt" : tp + " Talentpunkte") : "", rp ? (rp === 1 ? "1 Ruhmespunkt" : rp + " Ruhmespunkte") : ""].filter(Boolean).join(", ");
      if (h.stufe > vorher) t.push(`${heldName(S, p)} erreicht Stufe ${h.stufe}: +${3 * (h.stufe - vorher)} Höchstleben, ${pk}${bonus.map(b => ", " + b).join("")}.`);
    }
    return t;
  }

  function kampfGewonnen(S) {
    const boss = S.gegner.some(g => GEGNER[g.art].boss);
    const t = [];
    const ep = (S.kampf.epTot || 0) + S.gegner.filter(g => !g.gerufen && !g.geflohen).reduce((a, g) => a + (GEGNER[g.art].ep || 0), 0);
    S.kampf = null;
    for (const p of S.teilnehmer) {
      const h = S.helden[p]; h.gift = 0; h.giftR = 0; h.segen = 0; h.lauer = false; h.netz = 0;
      if (h.hp <= 0 && !h.gefallen) {
        h.hp = S.schwere === 1 ? Math.ceil(h.max / 2) : (S.schwere || 2) >= 4 ? 1 : 5;
        t.push(`${heldName(S, p)} kommt mit ${h.hp} Leben wieder zu sich.`);
      }
    }
    const sammeln = S.teilnehmer.reduce((a, p) => a + passiv(S.helden[p], "siegheil"), 0);
    if (sammeln) { for (const p of S.teilnehmer) heldHeilen(S, p, sammeln); t.push(`Ihr sammelt euch: alle +${sammeln} Leben.`); }
    if (boss) {
      const E = ebeneVon(S), g = goldFuerJeden(S, 40, 50);
      if (!endlos(S) && S.ebene >= (S.ebenen || 1)) {
        S.phase = "ende"; S.ergebnis = "sieg";
        S.seite = { bild: "krone", titel: E.siegTitel, text: [E.siegText, g].concat(t) };
        return;
      }
      // Lager zwischen zwei Ebenen: volle Heilung, Händler, dann geht es tiefer
      const x = erfahrung(S, ep);
      for (const p of S.teilnehmer) { const h = S.helden[p]; if (!h.gefallen) h.hp = h.max; h.cd = {}; }
      S.ebeneFertig = true;
      lagerOeffnen(S, false);
      S.seite = { bild: "feuer", titel: E.siegTitel, text: [E.siegText, g].concat(x, t, ["Ihr schlagt ein Lager auf und schlaft euch aus: Alle sind voll geheilt. Der Händler ist euch gefolgt."]) };
      return;
    }
    const s = stufe(S.raumNr), elite = S.gegner.some(g => g.elite);
    const extra = [];
    if (elite) { S.karte.schluessel += 1; extra.push("Ihr nehmt den schweren Schlüssel an euch. Irgendwo gibt es eine verschlossene Tür."); }
    S.seite = { bild: "sieg", titel: `Raum ${S.raumNr}: geschafft`, text: ["Alle Gegner sind besiegt. " + (elite ? goldFuerJeden(S, 22 + 6 * s, 30 + 8 * s) : goldFuerJeden(S, 9 + 9 * s, 13 + 11 * s))]
      .concat(extra, erfahrung(S, ep), t, elite ? beute(S, 0.8, 0.8) : beute(S, 0.4, 0.15)) };
    S.phase = "erkunden";
    entscheiden(S, "weiter", "", [{ text: "Weiterziehen" }]);
  }

  function entscheidungAufloesen(S) {
    const e = S.entscheidung, zaehl = e.optionen.map(() => 0);
    for (const p in e.stimmen) if (e.optionen[e.stimmen[p]]) zaehl[e.stimmen[p]]++;
    const offen = zaehl.map((z, i) => i).filter(i => !e.optionen[i].gesperrt);
    const max = Math.max(...offen.map(i => zaehl[i]));
    const beste = offen.filter(i => zaehl[i] === max);
    const wahl = beste.length === 1 ? beste[0] : eins(S, beste);
    S.entscheidung = null;
    if (e.art === "karte") { raumBetreten(S, e.optionen[wahl].knoten, e.optionen[wahl].geheim); return; }
    if (e.art === "weiter") { weiterziehen(S); return; }
    let t;
    if (e.art === "rast") {
      t = [];
      if (wahl === 0) { const q = schwere(S).rast; for (const p of S.teilnehmer) { const h = S.helden[p]; heldHeilen(S, p, Math.ceil(h.max * q)); h.cd = {}; } t.push(`Alle erholen sich um ${Math.round(q * 100)} % ihrer Leben. Alle Fähigkeiten sind wieder bereit.`); }
      else { for (const p of S.teilnehmer) S.helden[p].punkte += 1; t.push("Ihr übt bis spät in die Nacht. Jeder bekommt 1 Talentpunkt."); }
    } else if (e.art === "schrein") t = e.optionen[wahl].segen ? segenAusfuehren(S, e.optionen[wahl].segen) : ["Ihr lasst den Schrein in Frieden."];
    else {
      t = e.art === "truhe" ? truheOeffnen(S, wahl) : ereignisAusfuehren(S, e.id, wahl);
      t.push(...erfahrung(S, 8));            // auch Truhen und Ereignisse bringen etwas Erfahrung
    }
    S.seite = Object.assign({}, S.seite, { text: S.seite.text.concat([`Ihr entscheidet: ${e.optionen[wahl].text}.`], t) });
    entscheiden(S, "weiter", "", [{ text: "Weiterziehen" }]);
  }

  // Talente neu verteilen: am Schrein gegen Gold, in der Tiefe im Lager zwischen zwei Ebenen kostenlos; sonst null
  function umverteilenPreis(S) {
    const e = S.entscheidung;
    if (S.phase === "erkunden" && e && e.art === "schrein") return UMVERTEILEN;
    if (S.phase === "lager" && endlos(S) && S.ebeneFertig) return 0;
    return null;
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
          S.helden[p] = { rolle: S.rollen[p], hp: r.hp, max: r.hp, traenke: 1, waffe: 0, ruestung: 0, leben: 0, gold: 10, cd: {},
            schild: false, versteckt: false, lauer: false, segen: 0, gift: 0, giftR: 0, immun: false, fels: false, beschuetzt: null,
            ep: 0, stufe: 1, punkte: 0, talente: [], ruhm: 0, ruhmBoni: {},
            stats: { schaden: 0, geheilt: 0, umgefallen: 0 } };
        }
        Object.assign(S, { raumNr: 0, gegner: [], kampf: null, lager: null, lagerBesucht: [], log: [], benutzt: [], ergebnis: null, gegnerNr: 0, letzte: null, spielNr: (S.spielNr || 0) + 1,
          ebene: 1, ebenen: S.laenge === 4 ? 0 : S.laenge || 2, ebeneFertig: false, tiefenFluch: null });
        S.karte = karteErzeugen(S);
        S.phase = "erkunden";
        S.seite = { bild: "eingang", titel: "Der Abstieg", text: [EBENEN[0].abstieg] };
        entscheiden(S, "weiter", "", [{ text: "Hinabsteigen" }]);
        break;
      }
      case "laenge": {                     // Spielleiter: Partielänge (1 bis 3 Ebenen)
        if (!istHost || !(S.phase === "lobby" || S.phase === "ende") || !LAENGEN[m.n]) return S0;
        S.laenge = m.n;
        break;
      }
      case "fluch": {                      // Spielleiter: Fluch an- oder abwählen
        if (!istHost || !(S.phase === "lobby" || S.phase === "ende") || !FLUECHE[m.id]) return S0;
        const l = S.flueche || [];
        S.flueche = l.includes(m.id) ? l.filter(x => x !== m.id) : Object.keys(FLUECHE).filter(x => x === m.id || l.includes(x));
        break;
      }
      case "schwere": {                    // Spielleiter: Schwierigkeitsstufe (1 bis 4)
        if (!istHost || !(S.phase === "lobby" || S.phase === "ende") || !SCHWERE[m.n]) return S0;
        S.schwere = m.n;
        break;
      }
      case "stimme": {
        const e = S.entscheidung;
        if (S.phase !== "erkunden" || !e || !S.teilnehmer.includes(pid) || !e.optionen[m.i] || e.optionen[m.i].gesperrt || m.nr !== S.spielNr) return S0;
        e.stimmen[pid] = m.i;
        if (S.teilnehmer.every(p => e.stimmen[p] !== undefined)) entscheidungAufloesen(S);
        break;
      }
      case "beenden": {                    // Spielleiter: Abstimmung oder Lager ohne die Fehlenden beenden
        if (!istHost) return S0;
        if (S.phase === "erkunden" && S.entscheidung) entscheidungAufloesen(S);
        else if (S.phase === "lager") { S.lager = null; weiterziehen(S); }
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
        if (S.teilnehmer.every(p => S.lager.fertig[p])) { S.lager = null; weiterziehen(S); }
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
      case "talent": {                   // Talentpunkt ausgeben (nicht im Kampf)
        const h = S.helden[pid];
        const t = TALENT[m.id];
        if (!h || !t || S.phase === "kampf" || S.phase === "lobby" || S.phase === "ende" || m.nr !== S.spielNr || !talentWaehlbar(h, m.id)) return S0;
        if (t.aufstieg ? (h.ruhm || 0) < 1 : h.punkte < 1) return S0;
        h.talente.push(m.id);
        if (t.aufstieg) h.ruhm -= 1; else h.punkte -= 1;
        if (t.e.passiv === "leben") { h.max += t.e.n; h.hp += t.e.n; }
        break;
      }
      case "ruhm": {                       // Ruhmespunkt für einen Ruhmesbonus ausgeben
        const h = S.helden[pid], R = RUHM[m.id];
        if (!h || !R || S.phase === "kampf" || S.phase === "lobby" || S.phase === "ende" || m.nr !== S.spielNr || (h.ruhm || 0) < 1 || ruhmVon(h, m.id) >= R.max) return S0;
        h.ruhm -= 1; h.ruhmBoni = h.ruhmBoni || {}; h.ruhmBoni[m.id] = ruhmVon(h, m.id) + 1;
        if (m.id === "leben") { h.max += 5; h.hp += 5; }
        break;
      }
      case "umverteilen": {                // am Schrein (Gold) oder im Lager der Tiefe (kostenlos): alle Talente zurück
        const h = S.helden[pid], preis = umverteilenPreis(S);
        if (!h || preis === null || m.nr !== S.spielNr || h.gold < preis) return S0;
        const zurueck = talenteVon(h).filter(t => !t.aufstieg).length, ruhmZurueck = talenteVon(h).filter(t => t.aufstieg).length;
        if (!zurueck && !ruhmZurueck) return S0;
        const leben = passiv(h, "leben");
        h.gold -= preis; h.talente = []; h.punkte += zurueck; h.ruhm = (h.ruhm || 0) + ruhmZurueck;
        h.max -= leben; h.hp = Math.max(1, Math.min(h.hp, h.max));
        for (const id in h.cd) if (!AKTIONEN[h.rolle].some(a => a.id === id)) delete h.cd[id];
        break;
      }
      case "neustart": {
        if (!istHost) return S0;
        Object.assign(S, { karte: null, phase: "lobby", teilnehmer: [], helden: {}, gegner: [], kampf: null, lager: null, entscheidung: null, seite: null, log: [], ergebnis: null, spielNr: (S.spielNr || 0) + 1 });
        break;
      }
      default: return S0;
    }
    // alte Spielstände: früher schied man auf Legende endgültig aus, jetzt steht man wieder auf
    if (S.helden) for (const p in S.helden) { const h = S.helden[p]; if (h.gefallen) { delete h.gefallen; if (!S.kampf && h.hp <= 0) h.hp = 1; } }
    S.aenderung = Date.now();
    return S;
  }

  window.VL = { zustand, SCHWERE, GRUPPE, FLUECHE, hatKnoten, AUFSTIEG_AESTE, AUFSTIEG_STUFE, RUHM, ruhmVon, epFuer, endlos, umverteilenPreis, staerke, BEFREIEN, EBENEN, LAENGEN, ebeneVon, EIGENSCHAFTEN, eigenschaften, knochenschild, RAEUME, REIHEN, RAUMNAME, SEGEN, UMVERTEILEN, sicht, MAX_HELDEN, LAGER_NACH, ROLLEN, ROLLEN_REIHE, AKTIONEN, NEUE, TRANK, GEGNER, EP_STUFEN, MAX_STUFE, STUFENBONUS,
    AESTE, TALENT, talenteVon, talentWaehlbar, hauptast, passiv, stufeBonus, trankMax, aktionZusatz,
    neu, aktion, aktionenVon, angebot, standardWahl, lebend, gegnerLebend, goldSumme, cdVon };
})();
