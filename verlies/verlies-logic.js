// Verlies zu dritt: Spielregeln ohne Netzwerk und ohne Oberfläche.
// Der ganze Spielstand steckt in S (wird nach jeder Änderung an alle geschickt). Zufall kommt aus S.rng,
// damit ein übernehmender Spielleiter genau dort weitermacht, wo der alte aufgehört hat.
// Ablauf: Lobby (Rolle wählen, 6 Rollen, höchstens 3 Helden) → Karte mit 7 Reihen; vor jedem Raum stimmt die Gruppe
// auf der Karte ab, wohin es geht → Endgegner in Reihe 8. Händler stehen als Räume auf der Karte, vor dem Thronsaal
// schlägt der Händler immer noch einmal sein Lager auf. Jeder kauft mit seinem eigenen Gold.
(function () {
  const RAEUME = 8;                   // 7 Reihen Räume + Thronsaal
  const REIHEN = RAEUME - 1;
  const LAGER_NACH = [REIHEN];
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
    ["sonnenzorn", "Sonnenzorn", null, 0, "15 Schaden an allen Gegnern, alle Helden +5", 1]
  ].forEach(([id, name, ziel, cd, text, meister]) => { NEUE[id] = Object.assign({ id, name, ziel, text }, cd ? { cd } : {}, meister ? { meister: true } : {}); });
  const TRANK = { id: "trank", name: "Heiltrank", ziel: null, text: "+14 Leben für dich" };

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
  const TALENT = {};          // Knoten-ID (z. B. "berserker3") → Knoten
  const AESTE = {};           // Rolle → [{ id, name, kurz, knoten: [IDs] }]
  for (const rolle in TALENTE) AESTE[rolle] = TALENTE[rolle].map(([ast, name, kurz, knoten]) => ({ id: ast, name, kurz,
    knoten: knoten.map(([kn, text, e], i) => { const id = ast + (i + 1); TALENT[id] = { id, rolle, ast, i, name: kn, text, e }; return id; }) }));
  const talenteVon = h => (h.talente || []).map(id => TALENT[id]).filter(Boolean);
  const passiv = (h, art) => talenteVon(h).reduce((a, t) => a + (t.e.passiv === art ? t.e.n : 0), 0);
  const plusVon = (h, id, art) => talenteVon(h).reduce((a, t) => a + (t.e.plus === id ? t.e[art] || 0 : 0), 0);
  function talentWaehlbar(h, id) {
    const t = TALENT[id];
    if (!t || t.rolle !== h.rolle || h.talente.includes(id)) return false;
    if (t.i > 0 && !h.talente.includes(t.ast + t.i)) return false;
    if (t.e.meister && talenteVon(h).some(x => x.e.meister)) return false;
    return true;
  }
  // Hauptast eines Helden (für die Gruppenanzeige): der mit den meisten Talenten
  function hauptast(h) {
    let best = null;
    for (const a of AESTE[h.rolle]) { const n = a.knoten.filter(id => h.talente.includes(id)).length; if (n && (!best || n > best.n)) best = { name: a.name, n }; }
    return best;
  }

  // ---------- Erfahrung und Stufen ----------
  // EP_STUFEN[i] = EP, ab denen Stufe i+1 erreicht ist. Jede neue Stufe: +3 Höchstleben und 1 Talentpunkt.
  // Stufe 5 und 20: +1 Schaden, Stufe 10: −1 Schaden pro Treffer, Stufe 15: ein Trankplatz mehr.
  const EP_STUFEN = [0, 15, 35, 60, 90, 125, 165, 210, 260, 315, 375, 440, 510, 585, 665, 750, 840, 935, 1035, 1140];
  const MAX_STUFE = EP_STUFEN.length;
  const STUFENBONUS = { 5: "+1 Schaden mit allen Angriffen", 10: "−1 Schaden pro Treffer", 15: "ein Trankplatz mehr", 20: "+1 Schaden mit allen Angriffen" };
  const stufeBonus = h => ({ schaden: (h.stufe >= 5 ? 1 : 0) + (h.stufe >= 20 ? 1 : 0), ruestung: h.stufe >= 10 ? 1 : 0, traenke: h.stufe >= 15 ? 1 : 0 });
  function stufeAus(ep) { let st = 1; for (let i = 0; i < EP_STUFEN.length; i++) if (ep >= EP_STUFEN[i]) st = i + 1; return st; }
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
    const l = AKTIONEN[h.rolle].slice();
    for (const t of talenteVon(h)) { const id = t.e.neu || t.e.meister; if (id) l.push(NEUE[id]); }
    if (h.traenke > 0) l.push(TRANK);
    return l;
  }

  // ---------- Händler ----------
  const MAX = { waffe: 4, ruestung: 3, leben: 3, traenke: 3 };
  const trankMax = h => MAX.traenke + stufeBonus(h).traenke;
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
    ratte: { name: "Riesenratte", hp: 15, dmg: [3, 4], ep: 8 },
    goblin: { name: "Goblin", hp: 19, dmg: [3, 5], ep: 10 },
    spinne: { name: "Höhlenspinne", hp: 19, dmg: [3, 4], gift: true, ep: 11 },
    skelett: { name: "Skelett", hp: 30, dmg: [5, 7], ep: 15, untot: true },
    schamane: { name: "Goblin-Schamane", hp: 20, dmg: [3, 4], heiler: true, ep: 14 },
    ork: { name: "Ork", hp: 48, dmg: [7, 9], ep: 22 },
    koenig: { name: "Der Knochenkönig", hp: 310, dmg: [10, 14], boss: true, ep: 0, untot: true },
    // Elite: ein starker Gegner mit Begleiter und Flächenangriff (jede 3. Runde, angekündigt), trägt einen Schlüssel
    orkhaeuptling: { name: "Ork-Häuptling", bild: "ork", hp: 70, dmg: [8, 10], ep: 40, elite: true, begleiter: "goblin",
      wucht: { n: 5, name: "Rundumschlag", text: "Der Ork-Häuptling wirbelt seine Axt im Kreis!" } },
    knochenwaechter: { name: "Knochenwächter", bild: "skelett", hp: 58, dmg: [6, 8], ep: 36, elite: true, untot: true, begleiter: "ratte",
      wucht: { n: 4, name: "Knochensturm", text: "Der Knochenwächter zerbirst fast: Splitter fliegen durch den Raum!" } },
    spinnenmutter: { name: "Spinnenmutter", bild: "spinne", hp: 50, dmg: [4, 6], gift: true, ep: 34, elite: true, begleiter: "spinne",
      wucht: { n: 3, name: "Giftregen", text: "Die Spinnenmutter speit einen Regen aus Gift!", gift: true } }
  };
  const ELITEN = ["orkhaeuptling", "knochenwaechter", "spinnenmutter"];
  const GRUPPEN = [
    [["ratte", "ratte"], ["goblin", "ratte"], ["spinne", "ratte"]],
    [["skelett", "goblin"], ["spinne", "spinne"], ["ork"], ["goblin", "goblin", "ratte"]],
    [["ork", "skelett"], ["skelett", "skelett", "schamane"], ["ork", "schamane"], ["spinne", "skelett", "goblin"]]
  ];
  const stufe = nr => (nr <= 3 ? 0 : nr <= 5 ? 1 : 2);
  function gegnerErzeugen(S, art) {
    // zu zweit schwächer; je tiefer, desto zäher (Helden steigen ja auch auf)
    const g = GEGNER[art], f = (S.teilnehmer.length === 2 ? 0.55 : 1) * (g.boss ? 1 : 1 + 0.11 * Math.max(0, S.raumNr - 1)) * (1 + (S.karte ? S.karte.fluch || 0 : 0));
    const hp = Math.max(4, Math.round(g.hp * f));
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
  const RAUMNAME = { kampf: "Kampf", elite: "Elite", schatz: "Truhe", rast: "Rast", haendler: "Händler", schrein: "Schrein", ereignis: "Unbekannt", kammer: "Schatzkammer", boss: "Thronsaal", eingang: "Eingang" };
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
      const l = r === 1 ? KARTENTYPEN.erste : r === REIHEN ? KARTENTYPEN.letzte : KARTENTYPEN.mitte.filter(([t]) => r >= 3 || (t !== "elite" && t !== "schrein"));
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
    for (const k of Object.values(K.knoten)) if (k.typ === "elite") k.elite = eins(S, ELITEN);
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
    const n = wurf(S, a, b), extra = [];
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
  function weiterziehen(S) {
    S.log = [];
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
      S.seite = { bild: "koenig", titel: "Der Thronsaal", text: [TEXTE.boss[0]] };
      kampfStarten(S, ["koenig"]);
    } else if (typ === "kampf") {
      kampfRaum(S, eins(S, GRUPPEN[stufe(n)]), `Raum ${n}`, eins(S, TEXTE.kampf));
    } else if (typ === "elite") {
      const e = GEGNER[k.elite];
      kampfRaum(S, [k.elite, e.begleiter], `Raum ${n}: ${e.name}`, `${e.name} versperrt den Weg. Am Gürtel baumelt ein schwerer Schlüssel.`);
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
      if (r < 0.22 || !frei.length) kampfRaum(S, eins(S, GRUPPEN[stufe(n)]), `Raum ${n}: Ein Hinterhalt!`, "Kaum seid ihr drin, fällt hinter euch ein Gitter herab. Aus den Schatten kommen sie.");
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
    const k = S.kampf, a = {}, helden = lebend(S);
    for (const g of gegnerLebend(S)) {
      const art = GEGNER[g.art];
      if (art.boss && k.runde % 3 === 0) { a[g.id] = { a: "beben" }; continue; }
      if (art.wucht && k.runde % 3 === 2) { a[g.id] = { a: "beben", name: art.wucht.name }; continue; }
      if (art.heiler) {
        const v = gegnerLebend(S).filter(x => x !== g && x.hp < x.max * 0.6).sort((x, y) => x.hp / x.max - y.hp / y.max)[0];
        if (v) { a[g.id] = { a: "heilen", ziel: v.id }; continue; }
      }
      a[g.id] = { a: "angriff", ziel: helden.length ? eins(S, helden) : null };
    }
    k.absicht = a;
  }

  function kampfStarten(S, gruppe) {
    S.gegner = gruppe.map(a => gegnerErzeugen(S, a));
    S.kampf = { runde: 1, wahl: {}, bossRuf: false, nebel: false, absicht: {} };
    for (const p of S.teilnehmer) { const h = S.helden[p]; for (const id in h.cd) if (NEUE[id] && NEUE[id].meister) delete h.cd[id]; }
    for (const p of S.teilnehmer) Object.assign(S.helden[p], { schild: false, versteckt: false, lauer: false, segen: 0, gift: 0, giftR: 0, immun: false, fels: false, beschuetzt: null });
    S.entscheidung = null;
    S.log = [];
    planeGegner(S);
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

  // Bonus eines Helden auf jeden Angriff: Waffe, Segen, Talente, Stufe
  const angriffsBonus = (S, h) => h.waffe + (h.segen || 0) + passiv(h, "schaden") + stufeBonus(h).schaden
    + (h.hp < h.max / 2 ? passiv(h, "blutrausch") : 0) + (S.kampf && S.kampf.runde === 1 ? passiv(h, "erste") : 0);
  // Bonus gegen ein bestimmtes Ziel: Markierung (Jagdinstinkt gilt für alle), Untotenjäger
  const markPlus = S => Math.max(0, ...S.teilnehmer.map(p => passiv(S.helden[p], "markplus")));
  const zielBonus = (S, h, g) => (g.markiert > 0 ? 3 + markPlus(S) : 0) + (GEGNER[g.art].untot ? passiv(h, "untot") : 0);
  // Schaden wirklich abziehen; wer einen Gegner besiegt, heilt sich mit Siegeshunger/Blutzoll
  function aufGegner(S, pid, g, d, log) {
    const h = S.helden[pid], e = Math.min(d, g.hp);
    g.hp -= e; h.stats.schaden += e;
    if (g.hp <= 0 && e > 0 && h.hp > 0 && passiv(h, "todheil")) { const x = heldHeilen(S, pid, passiv(h, "todheil")); if (x) log.push(`${heldName(S, pid)} schöpft Kraft: +${x} Leben.`); }
    return e;
  }
  // Schaden eines Helden an einem Gegner (mit Waffe, Segen, Talenten, Markierung)
  function schadenAnGegner(S, pid, g, n, log, wie, ohneBonus, ohneKrit) {
    if (!g || g.hp <= 0) { g = gegnerLebend(S)[0]; if (!g) return; }
    const h = S.helden[pid];
    if (!ohneBonus) { n += angriffsBonus(S, h); h.segen = 0; }
    n += zielBonus(S, h, g);
    if (!ohneKrit && passiv(h, "krit") && chance(S, passiv(h, "krit") / 100)) { n *= 2; wie = "trifft mit voller Wucht"; }
    const still = [];
    aufGegner(S, pid, g, n, still);
    log.push(`${heldName(S, pid)} ${wie} ${g.name}: ${n} Schaden${g.hp <= 0 ? ". " + g.name + " fällt!" : "."}`, ...still);
  }
  // Flächenschaden: Bonus zählt einmal, Markierung und Untotenjäger je Ziel
  function flaeche(S, pid, n, log, text) {
    const h = S.helden[pid];
    n += angriffsBonus(S, h); h.segen = 0;
    const getroffen = gegnerLebend(S), still = [];
    for (const g of getroffen) aufGegner(S, pid, g, n + zielBonus(S, h, g), still);
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
      const g = eins(S, ziele), d = n + bonus + zielBonus(S, h, g);
      aufGegner(S, pid, g, d, still);
      teile.push(`${g.name} ${d}${g.hp <= 0 ? " (fällt!)" : ""}`);
    }
    log.push(`${heldName(S, pid)} ${text}: ${teile.join(", ")}.`, ...still);
  }
  // Gift setzen, ohne ein stärkeres zu überschreiben
  function vergiften(g, n, runden) { if (g.hp > 0 && !(g.giftR > 0 && g.gift > n)) { g.gift = n; g.giftR = runden; } }
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
      gegner: S.gegner.map(g => ({ id: g.id, art: g.art, name: g.name, hp: g.hp, max: g.max, giftR: g.giftR, markiert: g.markiert })),
      helden: Object.fromEntries(S.teilnehmer.map(p => { const h = S.helden[p]; return [p, { hp: h.hp, max: h.max, giftR: h.giftR }]; })),
      absicht: kopie(k.absicht || {})
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
      beginn();
      switch (w.a) {
        case "schild": h.schild = true; log.push(`${n} hebt den Schild und ruft die Gegner zu sich.`); break;
        case "fels": h.fels = true; h.immun = true; log.push(`${n} steht wie ein Fels. Alle Gegner wenden sich gegen ihn.`); break;
        case "verstecken": h.versteckt = true; h.lauer = true; log.push(`${n} verschwindet in den Schatten.`); break;
        case "rauch": k.nebel = true; log.push(`${n} wirft eine Rauchbombe. Die Gegner sehen kaum noch etwas.`); break;
        case "trank": { h.traenke -= 1; const e = heldHeilen(S, p, 14 + passiv(h, "trankplus")); log.push(`${n} trinkt einen Heiltrank: +${e} Leben.`); break; }
        case "heilen": {
          heilenAuf(S, p, w.ziel, 10 + rh(h, "heilen"), log, "heilt");
          const x = passiv(h, "heilschaden"), g = gegnerLebend(S).length ? eins(S, gegnerLebend(S)) : null;
          if (x && g) schadenAnGegner(S, p, g, x, log, "straft mit Licht", true, true);
          break;
        }
        case "handauflegen": heilenAuf(S, p, w.ziel, 8 + rh(h, "handauflegen"), log, "legt die Hände auf"); break;
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
        case "arkan": S.helden[w.ziel].immun = true; log.push(`${n} legt einen arkanen Schild um ${w.ziel === p ? "sich" : heldName(S, w.ziel)}.`); break;
        case "beschuetzen": S.helden[w.ziel].beschuetzt = p; log.push(`${n} stellt sich vor ${heldName(S, w.ziel)}.`); break;
        case "licht": alleHeilen(S, p, 4); break;     // Schaden folgt unten
      }
      ende({ von: p, a: w.a, ziel: w.ziel || null, phase: 1 });
    }
    // 2. Angriffe
    const brand = (h, getroffen) => { const x = passiv(h, "brand"); if (!x) return; for (const g of getroffen) vergiften(g, x, 2); if (getroffen.some(g => g.hp > 0)) log.push("Die Getroffenen brennen."); };
    for (const p of reihe) {
      if (!gegnerLebend(S).length) break;
      const h = S.helden[p], w = k.wahl[p], ziel = S.gegner.find(g => g.id === w.ziel);
      beginn();
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
          else if (chance(S, 0.33 + passiv(h, "krit") / 100)) { d *= 2; wie = "trifft genau"; }
          schadenAnGegner(S, p, ziel, d, log, wie, false, true); break;
        }

        case "gift": {
          const z = ziel && ziel.hp > 0 ? ziel : gegnerLebend(S)[0];
          schadenAnGegner(S, p, z, 3, log, "vergiftet");
          if (z && z.hp > 0) { z.gift = 3 + passiv(h, "giftplus"); z.giftR = 3; }
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
        case "feuerball": brand(h, flaeche(S, p, 5 + rs(h, "feuerball"), log, "wirft einen Feuerball")); break;
        case "meteor": brand(h, flaeche(S, p, 11 + rs(h, "meteor"), log, "ruft einen Meteor herab")); break;
        case "inferno": brand(h, flaeche(S, p, 20, log, "entfesselt ein Inferno")); break;
        case "durchschuss": flaeche(S, p, 14, log, "schießt einen Pfeil durch alle Reihen"); break;
        case "sonnenstrahl": flaeche(S, p, 6 + rs(h, "sonnenstrahl"), log, "lässt die Sonne herabstrahlen"); break;
        case "sonnenzorn": { flaeche(S, p, 15, log, "ruft den Sonnenzorn herab"); alleHeilen(S, p, 5); log.push("Alle Helden +5 Leben."); break; }
        case "treibjagd": { flaeche(S, p, 6, log, "treibt die Gegner zusammen"); for (const g of gegnerLebend(S)) g.markiert = 4; log.push("Alle Gegner sind markiert."); break; }
        case "winter": { flaeche(S, p, 6, log, "ruft den ewigen Winter"); for (const g of gegnerLebend(S)) g.starr = 1; if (gegnerLebend(S).length) log.push("Alle Gegner erstarren."); break; }
        case "giftwolke": { const x = 3 + passiv(h, "giftplus"); for (const g of flaeche(S, p, 2 + rs(h, "giftwolke"), log, "wirft eine Giftwolke")) vergiften(g, x, 3); break; }
        case "seuche": { const x = 5 + passiv(h, "giftplus"); for (const g of flaeche(S, p, 5, log, "verbreitet eine Seuche")) vergiften(g, x, 3); break; }
        case "raserei": pfeile(S, p, 3, 10, log, "rast und schlägt dreimal zu"); break;
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
          if (z && GEGNER[z.art].untot && !GEGNER[z.art].boss) schadenAnGegner(S, p, z, z.hp, log, "spricht das Gottesurteil über", true, true);
          else schadenAnGegner(S, p, z, z && GEGNER[z.art].untot ? 45 : 30, log, "spricht das Gottesurteil über");
          break;
        }
        case "todesstoss": {
          const z = ziel1(S, w.ziel);
          if (z && !GEGNER[z.art].boss && z.hp <= z.max * 0.3) schadenAnGegner(S, p, z, z.hp, log, "setzt den Todesstoß gegen", true, true);
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
    // 4. Endgegner ruft Verstärkung
    const koenig = S.gegner.find(g => g.art === "koenig");
    if (koenig && koenig.hp > 0 && !k.bossRuf && koenig.hp <= koenig.max / 2) {
      k.bossRuf = true;
      beginn();
      const neu = [gegnerErzeugen(S, "skelett"), gegnerErzeugen(S, "skelett")];
      S.gegner.push(...neu);
      log.push("Der Knochenkönig hebt die Arme. Zwei Skelette kriechen aus dem Boden!");
      ende({ von: koenig.id, a: "ruf", neu: neu.map(g => ({ id: g.id, art: g.art, name: g.name, hp: g.hp, max: g.max })) });
    }
    // 5. Gegner handeln (nach ihrer angekündigten Absicht)
    const gegnerZug = g => {
      const art = GEGNER[g.art], plan = (k.absicht || {})[g.id] || {};
      if (g.starr > 0) { log.push(`${g.name} ist erstarrt und kann nicht angreifen.`); return { a: "starr" }; }
      if (art.heiler) {
        const verletzt = gegnerLebend(S).filter(x => x !== g && x.hp < x.max * 0.6).sort((a2, b2) => a2.hp / a2.max - b2.hp / b2.max)[0];
        if (verletzt) { const n = Math.min(7, verletzt.max - verletzt.hp); verletzt.hp += n; log.push(`${g.name} murmelt einen Zauber: ${verletzt.name} +${n} Leben.`); return { a: "heilen", ziel: verletzt.id }; }
      }
      if (art.boss && (plan.a ? plan.a === "beben" : k.runde % 3 === 0)) {
        log.push("Der Knochenkönig stampft auf: Der Boden bebt!");
        for (const p of lebend(S)) treffer(S, p, 5 - (k.frost || 0), log, null);
        return { a: "beben" };
      }
      if (art.wucht && plan.a === "beben") {
        log.push(art.wucht.text);
        for (const p of lebend(S)) {
          treffer(S, p, art.wucht.n - (k.frost || 0), log, null);
          const h = S.helden[p];
          if (art.wucht.gift && h.hp > 0 && !h.immun) { h.gift = 2; h.giftR = 2; }
        }
        if (art.wucht.gift) log.push("Wer noch steht, ist vergiftet.");
        return { a: "beben" };
      }
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
      treffer(S, p, wurf(S, art.dmg[0], art.dmg[1]) - minus, log, g.name, g);
      if (art.gift && S.helden[p].hp > 0 && !S.helden[p].immun && chance(S, 0.4)) { S.helden[p].gift = 2; S.helden[p].giftR = 2; log.push(`${heldName(S, p)} ist vergiftet.`); }
      return { a: art.gift ? "biss" : "angriff", ziel: p };
    };
    for (const g of gegnerLebend(S)) { beginn(); const z = gegnerZug(g); ende(Object.assign({ von: g.id }, z)); }
    // 6. Gift auf Helden, Rundenende
    for (const p of lebend(S)) {
      const h = S.helden[p];
      if (h.giftR > 0) { beginn(); const n = Math.min(h.gift, h.hp); h.hp -= n; h.giftR -= 1; log.push(`Gift: ${heldName(S, p)} −${n} Leben${h.hp <= 0 ? " und bricht zusammen!" : "."}`); if (h.hp <= 0) h.stats.umgefallen += 1; ende({ von: p, a: "giftTick" }); }
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
      for (const q of lebend(S)) S.helden[von].stats.geheilt += heldHeilen(S, q, 8);
      k.heiligtum.runden -= 1;
      log.push("Das Heiligtum leuchtet: alle +8 Leben.");
      ende({ von, a: "heiligtumTick" });
    }
    for (const g of S.gegner) { if (g.starr > 0) g.starr -= 1; if (g.markiert > 0) g.markiert -= 1; g.spott = null; }
    k.nebel = false; k.frost = 0; k.bollwerk = false;
    S.log = log;
    S.letzte = { id: `${S.spielNr}:${S.raumNr}:${k.runde}`, runde: k.runde, titel: S.seite ? S.seite.titel : "", start, ev };
    k.wahl = {};
    k.runde += 1;

    if (gegnerLebend(S).length && lebend(S).length) planeGegner(S);
    if (!gegnerLebend(S).length) kampfGewonnen(S);
    else if (!lebend(S).length) { S.phase = "ende"; S.ergebnis = "niederlage"; S.seite = { bild: "grab", titel: "Ihr seid gefallen", text: ["Die Dunkelheit schließt sich über euch. Der Knochenkönig bekommt neue Knochen für seine Sammlung."] }; S.kampf = null; }
  }
  function treffer(S, p, n, log, von, g) {
    const h = S.helden[p], wer = heldName(S, p);
    if (h.immun) { log.push(von ? `${von} trifft ${wer}, doch der Schlag prallt ab.` : `${wer} bleibt unversehrt.`); return; }
    n = Math.max(1, n - h.ruestung - passiv(h, "ruestung") - stufeBonus(h).ruestung);
    if (h.schild) n = Math.ceil(n / 2);
    if (S.kampf && S.kampf.bollwerk) n = Math.ceil(n / 2);
    const echt = Math.min(n, h.hp);
    h.hp -= echt;
    log.push((von ? `${von} trifft ${wer}: ` : `${wer}: `) + `−${n} Leben${h.hp <= 0 ? ". " + wer + " bricht zusammen!" : "."}`);
    if (h.hp <= 0) h.stats.umgefallen += 1;
    const d = passiv(h, "dornen");
    if (g && d && g.hp > 0) {
      const e = Math.min(d, g.hp); g.hp -= e; h.stats.schaden += e;
      log.push(`${g.name} verletzt sich an den Stacheln von ${wer}: ${e} Schaden${g.hp <= 0 ? ". " + g.name + " fällt!" : "."}`);
    }
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
      const bonus = [];
      for (let st = vorher + 1; st <= h.stufe; st++) { h.max += 3; h.hp = Math.min(h.max, h.hp + 3); h.punkte += 1; if (STUFENBONUS[st]) bonus.push(STUFENBONUS[st]); }
      if (h.stufe > vorher) t.push(`${heldName(S, p)} erreicht Stufe ${h.stufe}: +${3 * (h.stufe - vorher)} Höchstleben, ${h.stufe - vorher === 1 ? "1 Talentpunkt" : (h.stufe - vorher) + " Talentpunkte"}${bonus.map(b => ", " + b).join("")}.`);
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
    const sammeln = S.teilnehmer.reduce((a, p) => a + passiv(S.helden[p], "siegheil"), 0);
    if (sammeln) { for (const p of S.teilnehmer) heldHeilen(S, p, sammeln); t.push(`Ihr sammelt euch: alle +${sammeln} Leben.`); }
    if (boss) {
      const g = goldFuerJeden(S, 40, 50);
      S.phase = "ende"; S.ergebnis = "sieg";
      S.seite = { bild: "krone", titel: "Der Knochenkönig ist besiegt!", text: ["Sein Thron zerfällt zu Staub. Unter den Trümmern: sein Schatz.", g].concat(t) };
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
      if (wahl === 0) { for (const p of S.teilnehmer) { const h = S.helden[p]; heldHeilen(S, p, Math.ceil(h.max * 0.4)); h.cd = {}; } t.push("Alle erholen sich um 40 % ihrer Leben. Alle Fähigkeiten sind wieder bereit."); }
      else { for (const p of S.teilnehmer) S.helden[p].punkte += 1; t.push("Ihr übt bis spät in die Nacht. Jeder bekommt 1 Talentpunkt."); }
    } else if (e.art === "schrein") t = e.optionen[wahl].segen ? segenAusfuehren(S, e.optionen[wahl].segen) : ["Ihr lasst den Schrein in Frieden."];
    else {
      t = e.art === "truhe" ? truheOeffnen(S, wahl) : ereignisAusfuehren(S, e.id, wahl);
      t.push(...erfahrung(S, 8));            // auch Truhen und Ereignisse bringen etwas Erfahrung
    }
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
            ep: 0, stufe: 1, punkte: 0, talente: [],
            stats: { schaden: 0, geheilt: 0, umgefallen: 0 } };
        }
        Object.assign(S, { raumNr: 0, gegner: [], kampf: null, lager: null, lagerBesucht: [], log: [], benutzt: [], ergebnis: null, gegnerNr: 0, letzte: null, spielNr: (S.spielNr || 0) + 1 });
        S.karte = karteErzeugen(S);
        S.phase = "erkunden";
        S.seite = { bild: "eingang", titel: "Der Abstieg", text: [TEXTE.eingang[0]] };
        entscheiden(S, "weiter", "", [{ text: "Hinabsteigen" }]);
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
        if (!h || S.phase === "kampf" || S.phase === "lobby" || S.phase === "ende" || h.punkte < 1 || m.nr !== S.spielNr || !talentWaehlbar(h, m.id)) return S0;
        h.talente.push(m.id); h.punkte -= 1;
        const t = TALENT[m.id];
        if (t.e.passiv === "leben") { h.max += t.e.n; h.hp += t.e.n; }
        break;
      }
      case "umverteilen": {                // am Schrein: alle Fähigkeitspunkte zurück, kostet Gold
        const h = S.helden[pid], e = S.entscheidung;
        if (!h || S.phase !== "erkunden" || !e || e.art !== "schrein" || m.nr !== S.spielNr || h.gold < UMVERTEILEN) return S0;
        const zurueck = h.talente.length;
        if (!zurueck) return S0;
        const leben = passiv(h, "leben");
        h.gold -= UMVERTEILEN; h.talente = []; h.punkte += zurueck;
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
    S.aenderung = Date.now();
    return S;
  }

  window.VL = { RAEUME, REIHEN, RAUMNAME, SEGEN, UMVERTEILEN, sicht, MAX_HELDEN, LAGER_NACH, ROLLEN, ROLLEN_REIHE, AKTIONEN, NEUE, TRANK, GEGNER, EP_STUFEN, MAX_STUFE, STUFENBONUS,
    AESTE, TALENT, talenteVon, talentWaehlbar, hauptast, passiv, stufeBonus, trankMax, aktionZusatz,
    neu, aktion, aktionenVon, angebot, standardWahl, lebend, gegnerLebend, goldSumme, cdVon };
})();
