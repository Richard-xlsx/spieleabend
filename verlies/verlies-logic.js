// Verlies zu dritt: Spielregeln ohne Netzwerk und ohne Oberfläche.
// Der ganze Spielstand steckt in S (wird nach jeder Änderung an alle geschickt). Zufall kommt aus S.rng,
// damit ein übernehmender Spielleiter genau dort weitermacht, wo der alte aufgehört hat.
// Ablauf: Lobby (Rolle wählen) → 7 Räume (vor jedem Raum Abstimmung über zwei Türen) → Endgegner in Raum 8.
(function () {
  const RAEUME = 8;
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
    kaempfer: { name: "Kämpfer", hp: 34, farbe: "#D9583B" },
    heilerin: { name: "Heilerin", hp: 26, farbe: "#4FB98A" },
    dieb: { name: "Dieb", hp: 27, farbe: "#8E7CF0" }
  };
  const ROLLEN_REIHE = ["kaempfer", "dieb", "heilerin"];
  // ziel: "gegner" = einen Gegner antippen, "held" = einen Helden antippen, null = ohne Ziel. cd = Abklingzeit in Runden.
  const AKTIONEN = {
    kaempfer: [
      { id: "schlag", name: "Schwerthieb", ziel: "gegner", text: "6–8 Schaden" },
      { id: "schild", name: "Schildwall", ziel: null, cd: 2, text: "Alle Gegner greifen dich an, du nimmst nur halben Schaden" },
      { id: "wirbel", name: "Wirbelschlag", ziel: null, cd: 2, text: "4 Schaden an allen Gegnern" }
    ],
    dieb: [
      { id: "dolch", name: "Dolchstich", ziel: "gegner", text: "5–7 Schaden, jeder dritte trifft doppelt" },
      { id: "gift", name: "Giftklinge", ziel: "gegner", cd: 2, text: "3 Schaden, dann 3 Runden je 3 Gift" },
      { id: "verstecken", name: "In die Schatten", ziel: null, cd: 3, text: "Niemand greift dich an, dein nächster Dolchstich trifft dreifach" }
    ],
    heilerin: [
      { id: "stab", name: "Lichtstab", ziel: "gegner", text: "4–6 Schaden" },
      { id: "heilen", name: "Heilen", ziel: "held", text: "+10 Leben, weckt Bewusstlose" },
      { id: "segen", name: "Segen", ziel: null, cd: 3, text: "Alle +6 Leben, nächster Angriff +3" }
    ]
  };
  const TRANK = { id: "trank", name: "Heiltrank", ziel: null, text: "+14 Leben für dich" };
  function aktionenVon(h) {
    const l = AKTIONEN[h.rolle].slice();
    if (h.traenke > 0) l.push(TRANK);
    return l;
  }

  // ---------- Gegner ----------
  const GEGNER = {
    ratte: { name: "Riesenratte", hp: 14, dmg: [3, 4] },
    goblin: { name: "Goblin", hp: 18, dmg: [3, 5] },
    spinne: { name: "Höhlenspinne", hp: 18, dmg: [3, 4], gift: true },
    skelett: { name: "Skelett", hp: 24, dmg: [4, 6] },
    schamane: { name: "Goblin-Schamane", hp: 18, dmg: [3, 4], heiler: true },
    ork: { name: "Ork", hp: 38, dmg: [6, 8] },
    koenig: { name: "Der Knochenkönig", hp: 120, dmg: [7, 10], boss: true }
  };
  const GRUPPEN = [
    [["ratte", "ratte"], ["goblin", "ratte"], ["spinne", "ratte"]],
    [["skelett", "goblin"], ["spinne", "spinne"], ["ork"], ["goblin", "goblin", "ratte"]],
    [["ork", "skelett"], ["skelett", "skelett", "schamane"], ["ork", "schamane"], ["spinne", "skelett", "goblin"]]
  ];
  const stufe = nr => (nr <= 3 ? 0 : nr <= 5 ? 1 : 2);
  function gegnerErzeugen(S, art) {
    const g = GEGNER[art], f = S.teilnehmer.length === 2 ? 0.55 : 1;
    const hp = Math.max(4, Math.round(g.hp * f));
    S.gegnerNr = (S.gegnerNr || 0) + 1;
    return { id: "g" + S.gegnerNr, art, name: g.name, hp, max: hp, gift: 0, giftR: 0 };
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
    boss: ["Ein Thronsaal aus Gebeinen. Grünes Licht flackert in leeren Augenhöhlen. Der Knochenkönig erhebt sich: „Noch mehr Knochen für meine Sammlung.“"]
  };
  const EREIGNISSE = {
    brunnen: { titel: "Ein alter Brunnen", text: "Moos überwuchert die Steine. Das Wasser leuchtet schwach blau.", optionen: ["Daraus trinken", "Lieber nicht"] },
    troll: { titel: "Ein schlafender Troll", text: "Er schnarcht vor einem Haufen Münzen. Sein Atem riecht nach Zwiebeln.", optionen: ["Vorbeischleichen und Gold nehmen", "Leise umkehren"] },
    haendler: { titel: "Ein Händler in Kapuze", text: "„Tränke, frisch gebraut! 12 Gold das Stück.“ Er zeigt keine Hände.", optionen: ["Für jeden einen Trank kaufen", "Weitergehen"] },
    altar: { titel: "Ein Altar mit Inschrift", text: "„Gib Gold, und das Leben wird stärker.“ Eine Schale wartet.", optionen: ["20 Gold opfern", "Nichts geben"] },
    bruecke: { titel: "Eine wackelige Brücke", text: "Unter euch nur Dunkelheit. Die Seile ächzen.", optionen: ["Vorsichtig hinübertasten", "Hinüberrennen"] }
  };

  // ---------- Neues Spiel ----------
  function neu(code, hostPid, hostName, seed) {
    return {
      v: 1, spiel: "verlies", code, epoch: 0, host: hostPid, phase: "lobby",
      spieler: { [hostPid]: { name: hostName } }, reihenfolge: [hostPid], rollen: {},
      teilnehmer: [], helden: {}, gegner: [], gold: 0, raumNr: 0, seite: null, entscheidung: null, kampf: null,
      log: [], benutzt: [], rng: (seed >>> 0) || 1, spielNr: 0, aenderung: Date.now()
    };
  }
  const lebend = S => S.teilnehmer.filter(p => S.helden[p].hp > 0);
  const gegnerLebend = S => S.gegner.filter(g => g.hp > 0);
  const heldName = (S, p) => (S.spieler[p] ? S.spieler[p].name : "?");

  function heldHeilen(S, p, n, log) {
    const h = S.helden[p];
    const war = h.hp;
    h.hp = Math.min(h.max, h.hp + n);
    if (log && h.hp > war) log.push(`${heldName(S, p)} ${war === 0 ? "kommt wieder zu sich und hat" : "erhält"} ${war === 0 ? h.hp : "+" + (h.hp - war)} Leben.`);
    return h.hp - war;
  }

  // ---------- Entscheidungen (Türen, Ereignisse, Weiter) ----------
  function entscheiden(S, art, frage, optionen, extra) {
    S.entscheidung = Object.assign({ art, frage, optionen, stimmen: {} }, extra || {});
  }
  function tuerenZeigen(S) {
    const nr = S.raumNr + 1;
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
  const EREIGNISSE_FREI = S => Object.keys(EREIGNISSE).filter(e => !S.benutzt.includes(e));

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
      for (const p of S.teilnehmer) { const h = S.helden[p]; heldHeilen(S, p, Math.ceil(h.max * 0.4), null); h.cd = {}; }
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
    const t = [], alle = S.teilnehmer, dieb = alle.find(p => S.helden[p].rolle === "dieb");
    if (id === "brunnen") {
      if (wahl === 0) for (const p of alle) {
        const h = S.helden[p];
        if (chance(S, 0.55)) { const n = heldHeilen(S, p, 9, null); h.max += 2; h.hp += 2; t.push(`${heldName(S, p)} fühlt sich gestärkt: +${n + 2} Leben, Höchstwert +2.`); }
        else { const n = Math.min(4, h.hp - 1); h.hp -= n; t.push(`${heldName(S, p)} wird übel: −${n} Leben.`); }
      } else t.push("Ihr lasst den Brunnen in Ruhe.");
    } else if (id === "troll") {
      if (wahl === 0) {
        const p = dieb ? 0.85 : 0.5;
        if (chance(S, p)) { const g = wurf(S, 25, 40); S.gold += g; t.push(`${dieb ? "Der Dieb führt euch lautlos" : "Mit angehaltenem Atem schleicht ihr"} vorbei: +${g} Gold.`); }
        else { t.push("Ein Stein knirscht. Der Troll schlägt im Halbschlaf um sich, bevor ihr flieht."); for (const p2 of alle) { const h = S.helden[p2]; const n = Math.min(6, h.hp - 1); h.hp -= n; t.push(`${heldName(S, p2)}: −${n} Leben.`); } }
      } else t.push("Ihr lasst den Troll schlafen.");
    } else if (id === "haendler") {
      if (wahl === 0) {
        let n = 0;
        for (const p of alle) if (S.gold >= 12) { S.gold -= 12; S.helden[p].traenke += 1; n++; }
        t.push(n ? `${n} ${n === 1 ? "Trank" : "Tränke"} gekauft.` + (n < alle.length ? " Für mehr reicht das Gold nicht." : "") : "Ihr habt nicht genug Gold. Der Händler lacht heiser.");
      } else t.push("Der Händler zuckt mit den Schultern und verschwindet im Dunkeln.");
    } else if (id === "altar") {
      if (wahl === 0 && S.gold >= 20) { S.gold -= 20; for (const p of alle) { S.helden[p].max += 5; S.helden[p].hp += 5; } t.push("Die Schale leuchtet auf. Alle: Höchstwert +5 Leben."); }
      else if (wahl === 0) t.push("Ihr habt keine 20 Gold. Der Altar bleibt stumm.");
      else t.push("Ihr geht am Altar vorbei.");
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
    const g = wurf(S, 20, 35) + (dieb ? 10 : 0); S.gold += g; t.push(`+${g} Gold.`);
    t.push(...beute(S, 0.6, 0.35));
    return t;
  }
  function beute(S, pTrank, pTeil) {
    const t = [];
    if (chance(S, pTrank)) { const p = eins(S, S.teilnehmer); S.helden[p].traenke += 1; t.push(`${heldName(S, p)} findet einen Heiltrank.`); }
    if (chance(S, pTeil)) {
      const p = S.teilnehmer.slice().sort((a, b) => (S.helden[a].waffe + S.helden[a].ruestung) - (S.helden[b].waffe + S.helden[b].ruestung))[0];
      const h = S.helden[p];
      if (chance(S, 0.5)) { h.waffe += 1; t.push(`${heldName(S, p)} findet eine bessere Waffe: +1 Schaden.`); }
      else { h.ruestung += 1; t.push(`${heldName(S, p)} findet ein Rüstungsteil: −1 Schaden pro Treffer.`); }
    }
    return t;
  }

  // ---------- Kampf ----------
  function kampfStarten(S, gruppe) {
    S.gegner = gruppe.map(a => gegnerErzeugen(S, a));
    S.kampf = { runde: 1, wahl: {}, bossRuf: false };
    for (const p of S.teilnehmer) Object.assign(S.helden[p], { schild: false, versteckt: false, segen: 0, gift: 0, giftR: 0 });
    entscheidung0(S);
    S.log = [];
  }
  function entscheidung0(S) { S.entscheidung = null; }

  function wahlGueltig(S, pid, m) {
    const h = S.helden[pid];
    if (!h || h.hp <= 0) return false;
    const a = aktionenVon(h).find(x => x.id === m.a);
    if (!a) return false;
    if (a.cd && (h.cd[a.id] || 0) > 0) return false;
    if (a.ziel === "gegner" && !S.gegner.some(g => g.id === m.ziel && g.hp > 0)) return false;
    if (a.ziel === "held" && !S.helden[m.ziel]) return false;
    return true;
  }
  function standardWahl(S, pid) {
    const h = S.helden[pid], ziel = gegnerLebend(S).sort((a, b) => a.hp - b.hp)[0];
    const a = AKTIONEN[h.rolle][0].id;
    if (h.rolle === "heilerin") {
      const schwach = S.teilnehmer.filter(p => S.helden[p].hp < S.helden[p].max * 0.5).sort((a2, b) => S.helden[a2].hp - S.helden[b].hp)[0];
      if (schwach) return { a: "heilen", ziel: schwach };
    }
    return { a, ziel: ziel && ziel.id };
  }

  function schadenAnGegner(S, pid, g, n, log, wie) {
    if (!g || g.hp <= 0) { g = gegnerLebend(S)[0]; if (!g) return; }
    const h = S.helden[pid];
    n = n + h.waffe + (h.segen ? 3 : 0);
    h.segen = 0;
    const echt = Math.min(n, g.hp);
    g.hp -= echt; h.stats.schaden += echt;
    log.push(`${heldName(S, pid)} ${wie} ${g.name}: ${n} Schaden${g.hp <= 0 ? ". " + g.name + " fällt!" : "."}`);
  }

  function rundeAuswerten(S) {
    const log = [], k = S.kampf;
    const reihe = S.teilnehmer.filter(p => S.helden[p].hp > 0 && k.wahl[p]);
    // 1. Schutz und Heilung zuerst, damit sie noch in dieser Runde wirken
    for (const p of reihe) {
      const h = S.helden[p], w = k.wahl[p];
      if (w.a === "schild") { h.schild = true; h.cd.schild = 2; log.push(`${heldName(S, p)} hebt den Schild und ruft die Gegner zu sich.`); }
      else if (w.a === "verstecken") { h.versteckt = true; h.lauer = true; h.cd.verstecken = 3; log.push(`${heldName(S, p)} verschwindet in den Schatten.`); }
      else if (w.a === "trank") { h.traenke -= 1; const n = heldHeilen(S, p, 14, null); log.push(`${heldName(S, p)} trinkt einen Heiltrank: +${n} Leben.`); }
      else if (w.a === "heilen") {
        const z = S.helden[w.ziel], war = z.hp, n = heldHeilen(S, w.ziel, 10, null);
        h.stats.geheilt += n;
        log.push(war === 0 ? `${heldName(S, p)} holt ${heldName(S, w.ziel)} zurück ins Leben: ${z.hp} Leben.` : `${heldName(S, p)} heilt ${w.ziel === p ? "sich" : heldName(S, w.ziel)}: +${n} Leben.`);
      } else if (w.a === "segen") {
        h.cd.segen = 3; let summe = 0;
        for (const q of S.teilnehmer) { if (S.helden[q].hp > 0) { summe += heldHeilen(S, q, 6, null); S.helden[q].segen = 1; } }
        h.stats.geheilt += summe;
        log.push(`${heldName(S, p)} spricht einen Segen: alle +6 Leben, nächster Angriff +3.`);
      }
    }
    // 2. Angriffe
    for (const p of reihe) {
      if (!gegnerLebend(S).length) break;
      const h = S.helden[p], w = k.wahl[p], ziel = S.gegner.find(g => g.id === w.ziel);
      if (w.a === "schlag") schadenAnGegner(S, p, ziel, wurf(S, 6, 8), log, "trifft");
      else if (w.a === "stab") schadenAnGegner(S, p, ziel, wurf(S, 4, 6), log, "brennt Licht in");
      else if (w.a === "dolch") {
        let n = wurf(S, 5, 7), wie = "sticht";
        if (h.lauer) { n *= 3; h.lauer = false; wie = "springt aus dem Schatten auf"; }
        else if (chance(S, 0.33)) { n *= 2; wie = "trifft genau"; }
        schadenAnGegner(S, p, ziel, n, log, wie);
      } else if (w.a === "gift") {
        h.cd.gift = 2;
        const z = ziel && ziel.hp > 0 ? ziel : gegnerLebend(S)[0];
        schadenAnGegner(S, p, z, 3, log, "vergiftet");
        if (z && z.hp > 0) { z.gift = 3; z.giftR = 3; }
      } else if (w.a === "wirbel") {
        h.cd.wirbel = 2;
        const n = 4 + h.waffe + (h.segen ? 3 : 0); h.segen = 0;
        const getroffen = gegnerLebend(S);
        for (const g of getroffen) { const e = Math.min(n, g.hp); g.hp -= e; h.stats.schaden += e; }
        log.push(`${heldName(S, p)} wirbelt herum: ${n} Schaden an allen.` + getroffen.filter(g => g.hp <= 0).map(g => ` ${g.name} fällt!`).join(""));
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
      if (art.heiler) {
        const verletzt = gegnerLebend(S).filter(x => x !== g && x.hp < x.max * 0.6).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
        if (verletzt) { const n = Math.min(7, verletzt.max - verletzt.hp); verletzt.hp += n; log.push(`${g.name} murmelt einen Zauber: ${verletzt.name} +${n} Leben.`); continue; }
      }
      if (art.boss && k.runde % 3 === 0) {
        log.push("Der Knochenkönig stampft auf: Der Boden bebt!");
        for (const p of lebend(S)) treffer(S, p, 5, log, null);
        continue;
      }
      const schild = lebend(S).find(p => S.helden[p].schild);
      const ziele = lebend(S).filter(p => !S.helden[p].versteckt);
      const p = schild || (ziele.length ? eins(S, ziele) : null);
      if (!p) { log.push(`${g.name} sucht vergeblich nach einem Ziel.`); continue; }
      treffer(S, p, wurf(S, art.dmg[0], art.dmg[1]), log, g.name);
      if (art.gift && S.helden[p].hp > 0 && chance(S, 0.4)) { S.helden[p].gift = 2; S.helden[p].giftR = 2; log.push(`${heldName(S, p)} ist vergiftet.`); }
    }
    // 6. Gift auf Helden, Rundenende
    for (const p of lebend(S)) {
      const h = S.helden[p];
      if (h.giftR > 0) { const n = Math.min(h.gift, h.hp); h.hp -= n; h.giftR -= 1; log.push(`Gift: ${heldName(S, p)} −${n} Leben${h.hp <= 0 ? " und bricht zusammen!" : "."}`); if (h.hp <= 0) h.stats.umgefallen += 1; }
    }
    for (const p of S.teilnehmer) {
      const h = S.helden[p];
      h.schild = false; h.versteckt = false;
      for (const c in h.cd) if (h.cd[c] > 0 && !(k.wahl[p] && (k.wahl[p].a === c))) h.cd[c] -= 1;
    }
    S.log = log;
    k.wahl = {};
    k.runde += 1;

    if (!gegnerLebend(S).length) kampfGewonnen(S);
    else if (!lebend(S).length) { S.phase = "ende"; S.ergebnis = "niederlage"; S.seite = { bild: "grab", titel: "Ihr seid gefallen", text: ["Die Dunkelheit schließt sich über euch. Der Knochenkönig bekommt neue Knochen für seine Sammlung."] }; S.kampf = null; }
  }
  function treffer(S, p, n, log, von) {
    const h = S.helden[p];
    n = Math.max(1, n - h.ruestung);
    if (h.schild) n = Math.ceil(n / 2);
    const echt = Math.min(n, h.hp);
    h.hp -= echt;
    if (von) log.push(`${von} trifft ${heldName(S, p)}: −${n} Leben${h.hp <= 0 ? ". " + heldName(S, p) + " bricht zusammen!" : "."}`);
    else log.push(`${heldName(S, p)}: −${n} Leben${h.hp <= 0 ? " und bricht zusammen!" : "."}`);
    if (h.hp <= 0) h.stats.umgefallen += 1;
  }
  function kampfGewonnen(S) {
    const boss = S.gegner.some(g => g.art === "koenig");
    const t = [];
    S.kampf = null;
    for (const p of S.teilnehmer) {
      const h = S.helden[p]; h.gift = 0; h.giftR = 0; h.segen = 0; h.lauer = false;
      if (h.hp <= 0) { h.hp = 5; t.push(`${heldName(S, p)} kommt mit 5 Leben wieder zu sich.`); }
    }
    if (boss) {
      const g = 60; S.gold += g;
      S.phase = "ende"; S.ergebnis = "sieg";
      S.seite = { bild: "krone", titel: "Der Knochenkönig ist besiegt!", text: ["Sein Thron zerfällt zu Staub. Unter den Trümmern: sein Schatz.", `+${g} Gold.`].concat(t) };
      return;
    }
    const g = wurf(S, 8, 14) * (stufe(S.raumNr) + 1); S.gold += g;
    S.seite = { bild: "sieg", titel: `Raum ${S.raumNr}: geschafft`, text: [`Alle Gegner sind besiegt. +${g} Gold.`].concat(t, beute(S, 0.4, 0.2)) };
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
    if (e.art === "weiter") { S.log = []; tuerenZeigen(S); return; }
    const t = e.art === "truhe" ? truheOeffnen(S, wahl) : ereignisAusfuehren(S, e.id, wahl);
    S.seite = Object.assign({}, S.seite, { text: S.seite.text.concat([`Ihr entscheidet: ${e.optionen[wahl].text}.`], t) });
    entscheiden(S, "weiter", "", [{ text: "Weiterziehen" }]);
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
        if (Object.keys(S.rollen).some(p => p !== pid && S.rollen[p] === m.rolle && S.spieler[p] && (!S.online || S.online.includes(p)))) return S0;
        S.rollen[pid] = m.rolle;
        break;
      }
      case "start": {
        if (!istHost || !(S.phase === "lobby" || S.phase === "ende")) return S0;
        const anwesend = new Set(m.anwesend || S.reihenfolge);
        const t = ROLLEN_REIHE.map(r => Object.keys(S.rollen).find(p => S.rollen[p] === r && S.spieler[p] && anwesend.has(p))).filter(Boolean);
        if (t.length < (m.mindestens || 2)) return S0;
        S.teilnehmer = t;
        S.helden = {};
        for (const p of t) {
          const r = ROLLEN[S.rollen[p]];
          S.helden[p] = { rolle: S.rollen[p], hp: r.hp, max: r.hp, traenke: 1, waffe: 0, ruestung: 0, cd: {}, schild: false, versteckt: false, lauer: false, segen: 0, gift: 0, giftR: 0,
            stats: { schaden: 0, geheilt: 0, umgefallen: 0 } };
        }
        Object.assign(S, { gold: 0, raumNr: 0, gegner: [], kampf: null, log: [], benutzt: [], ergebnis: null, gegnerNr: 0, spielNr: (S.spielNr || 0) + 1 });
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
      case "beenden": {                    // Spielleiter: Abstimmung ohne fehlende Stimmen auflösen
        if (!istHost || S.phase !== "erkunden" || !S.entscheidung) return S0;
        entscheidungAufloesen(S);
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
      case "neustart": {
        if (!istHost) return S0;
        Object.assign(S, { phase: "lobby", teilnehmer: [], helden: {}, gegner: [], kampf: null, entscheidung: null, seite: null, log: [], ergebnis: null, spielNr: (S.spielNr || 0) + 1 });
        break;
      }
      default: return S0;
    }
    S.aenderung = Date.now();
    return S;
  }

  window.VL = { RAEUME, ROLLEN, ROLLEN_REIHE, AKTIONEN, TRANK, GEGNER, neu, aktion, aktionenVon, standardWahl, lebend, gegnerLebend };
})();
