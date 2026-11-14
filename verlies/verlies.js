// Verlies zu dritt: Verbindung (Handy des Spielleiters ist der Server, PeerJS) und Oberfläche.
// Verbindung wie bei Stille Post: Spielleiter hält den Zustand, alle anderen schicken nur Eingaben.
(function () {
  const V = window.VL, VB = window.VB;
  const app = document.getElementById("app");
  const PREFIX = "fmwvl-";
  const ZEICHEN = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
  const PEER_OPT = { debug: 0 };
  const params = new URLSearchParams(location.search);
  const TEST = params.get("test");
  const T = TEST ? "-" + TEST : "";
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k + T)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k + T, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k + T); } catch (e) {} }
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let PID = ls.get("slf:pid"); if (!PID) { PID = Math.random().toString(36).slice(2, 10); ls.set("slf:pid", PID); }
  let name = ls.get("slf:name") || "";
  let code = (params.get("raum") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  let rolle = null, S = null, peer = null, hostConn = null, verbunden = false, offlineSeit = null, fehlerText = "";
  const conns = new Map();
  let retryTimer = null, token = 0, versuch = 0, letzteSig = "";
  let auswahl = null;            // gewählte Aktion, die noch ein Ziel braucht
  let zeigeFaehigkeiten = false; // eigener Bildschirm zum Verbessern (nur außerhalb des Kampfes)
  // Kampfbühne: jede ausgewertete Runde (S.letzte) wird einmal abgespielt. Beim ersten Stand nach dem Laden nicht,
  // damit nach Neuladen nichts doppelt läuft.
  let gespielt = null, wiedergabe = false, ueberspringen = false;
  let karteOffen = false;
  let talentAst = null, talentFokus = null;   // Talentbaum: angezeigter Ast und angetippter Knoten
  let tonAn = ls.get("vl:ton") !== false, schnell = !!ls.get("vl:schnell");

  const hostId = ep => PREFIX + code + "-" + ep;
  const link = () => location.origin + location.pathname + "?raum=" + code;
  const testTeil = () => (TEST ? "&test=" + TEST : "");

  // ---------- Bildschirm wach halten ----------
  let wake = null;
  async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wachHalten(); if (rolle === "client" && !hostConn) verbindeZumHost(); } });
  document.addEventListener("click", wachHalten);

  // ---------- Spielleiter ----------
  function speichernHost() { ls.set("vl:host:" + code, { S }); }
  function sendeAlle(m) { for (const c of conns.values()) { try { c.send(m); } catch (e) {} } }
  function hostStarten(z) {
    rolle = "host"; S = z.S; S.host = PID;
    if (S.spieler[PID]) S.spieler[PID].name = name || S.spieler[PID].name;
    speichernHost(); oeffneHostPeer(); geaendert();
  }
  function anwenden(neuS) { if (neuS === S) return false; S = neuS; geaendert(); return true; }
  function oeffneHostPeer() {
    if (peer) { try { peer.destroy(); } catch (e) {} }
    verbunden = false;
    const p = peer = new Peer(hostId(S.epoch), PEER_OPT);
    p.on("open", () => { if (p !== peer) return; verbunden = true; fehlerText = ""; render(); });
    p.on("connection", c => {
      c.on("data", m => vonClient(c, m));
      c.on("close", () => { for (const [k, x] of conns) if (x === c) conns.delete(k); geaendert(); });
      c.on("error", () => {});
    });
    p.on("disconnected", () => { if (p !== peer) return; verbunden = false; render(); setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} }, 2000); });
    p.on("error", e => {
      if (p !== peer) return;
      verbunden = false;
      fehlerText = e.type === "unavailable-id" ? "Der Raum ist noch belegt, gleich geht es weiter …" : "Keine Verbindung zum Vermittlungsdienst, neuer Versuch …";
      render();
      if (["unavailable-id", "network", "server-error", "socket-error", "socket-closed"].includes(e.type)) setTimeout(() => { if (p === peer) oeffneHostPeer(); }, 3000);
    });
  }
  function vonClient(c, m) {
    if (!m || !m.pid) return;
    if (m.t === "hallo") conns.set(m.pid, c);
    if (!anwenden(V.aktion(S, m.pid, m))) geaendert();
  }
  function geaendert() {
    S.online = [PID].concat([...conns.keys()]);
    speichernHost();
    sendeAlle({ t: "zustand", s: S });
    render();
  }

  // ---------- Mitspieler ----------
  function clientStarten() {
    rolle = "client";
    const k = ls.get("vl:kopie:" + code); if (k) S = k.S;
    if (peer) { try { peer.destroy(); } catch (e) {} }
    const p = peer = new Peer(undefined, PEER_OPT);
    p.on("open", () => { if (p === peer && !hostConn) verbindeZumHost(); });
    p.on("disconnected", () => { if (p !== peer) return; setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} }, 2000); });
    p.on("error", e => {
      if (p !== peer) return;
      if (e.type === "peer-unavailable") fehlschlag(token);
      else if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) verloren();
    });
    render();
  }
  function verbindeZumHost() {
    if (!peer || peer.destroyed || !peer.open || (hostConn && hostConn.open)) return;
    clearTimeout(retryTimer);
    const t = ++token;
    const basis = S ? S.epoch : 0, ep = basis + (versuch % 2);
    const c = peer.connect(hostId(ep), { serialization: "json", reliable: true });
    c.on("open", () => {
      if (t !== token) { try { c.close(); } catch (e) {} return; }
      hostConn = c; versuch = 0; verbunden = true; offlineSeit = null; fehlerText = "";
      c.send({ t: "hallo", pid: PID, name });
      render();
    });
    c.on("data", m => {
      if (!m || m.t !== "zustand") return;
      S = m.s; ls.set("vl:kopie:" + code, { S }); render();
    });
    c.on("close", () => { if (hostConn === c) { hostConn = null; verloren(); } });
    c.on("error", () => {});
    retryTimer = setTimeout(() => { if (t === token && hostConn !== c) { try { c.close(); } catch (e) {} fehlschlag(t); } }, 5000);
  }
  function fehlschlag(t) {
    if (t !== token) return;
    token++; versuch++;
    if (!offlineSeit) offlineSeit = Date.now();
    verbunden = false; render();
    clearTimeout(retryTimer);
    retryTimer = setTimeout(verbindeZumHost, 2000);
  }
  function verloren() { verbunden = false; hostConn = null; if (!offlineSeit) offlineSeit = Date.now(); render(); fehlschlag(token); }
  function uebernehmen() {
    if (!S) return;
    const s = JSON.parse(JSON.stringify(S)); s.epoch += 1;
    ls.del("vl:kopie:" + code);
    clearTimeout(retryTimer); token++;
    if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
    hostStarten({ S: s });
  }
  function fortsetzenAlsHost(gespeichert) {
    rolle = "pruefen"; render();
    const probe = new Peer(undefined, PEER_OPT);
    let fertig = false;
    const ende = alsClient => {
      if (fertig) return; fertig = true;
      try { probe.destroy(); } catch (e) {}
      if (alsClient) { ls.del("vl:host:" + code); ls.set("vl:kopie:" + code, gespeichert); clientStarten(); }
      else hostStarten(gespeichert);
    };
    probe.on("open", () => { const c = probe.connect(hostId(gespeichert.S.epoch + 1), { serialization: "json" }); c.on("open", () => ende(true)); });
    probe.on("error", () => ende(false));
    setTimeout(() => ende(false), 4000);
  }

  // ---------- Aktionen ----------
  function tun(m) {
    if (rolle === "host") anwenden(V.aktion(S, PID, m));
    else if (hostConn && hostConn.open) { try { hostConn.send(Object.assign({ pid: PID }, m)); } catch (e) {} }
  }
  function neuesSpiel() {
    code = Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
    history.replaceState(null, "", "?raum=" + code + testTeil());
    hostStarten({ S: V.neu(code, PID, name, Math.floor(Math.random() * 4294967296)) });
  }
  function verlassen() {
    for (const k of ["vl:host:", "vl:kopie:"]) ls.del(k + code);
    location.href = location.pathname + (TEST ? "?test=" + TEST : "");
  }

  // ---------- Hilfen für die Oberfläche ----------
  const sp = p => (S && S.spieler[p]) || { name: "?" };
  const online = p => !!(S && S.online && S.online.includes(p));
  const ich = () => S && S.helden && S.helden[PID];
  const mitspieler = () => S && S.teilnehmer.includes(PID);

  function faehigkeitenKnopf() {
    if (!mitspieler()) return "";
    const h = ich();
    return `<button class="knopf ${h.punkte ? "" : "zweit"}" id="faehigkeiten">${h.punkte ? `Talentbaum (${h.punkte} ${h.punkte === 1 ? "Punkt" : "Punkte"} frei)` : `Stufe ${h.stufe} · Talentbaum ansehen`}</button>`;
  }
  function balken(hp, max) {
    const q = max ? hp / max : 0;
    return `<div class="balken ${q <= 0.3 ? "knapp" : q <= 0.6 ? "mittel" : ""}"><i style="width:${Math.max(0, Math.round(q * 100))}%"></i></div>`;
  }
  function fortschritt() {
    let h = "";
    const hier = S.entscheidung && S.entscheidung.art === "karte" ? S.raumNr + 1 : S.raumNr;
    for (let i = 1; i <= V.RAEUME; i++) h += `<i class="${i < hier ? "da" : i === hier ? "hier" : ""} ${i === V.RAEUME ? "boss" : ""}"></i>`;
    const sl = S.karte && S.karte.schluessel ? `<span class="marke schluessel">${S.karte.schluessel === 1 ? "1 Schlüssel" : S.karte.schluessel + " Schlüssel"}</span>` : "";
    const eb = (S.ebenen || 1) > 1 ? `<span class="marke ebene">Ebene ${S.ebene}/${S.ebenen}</span>` : "";
    return `<div class="kopf">${eb}<div class="fortschritt" aria-label="Ebene ${S.ebene || 1}, Raum ${S.raumNr} von ${V.RAEUME}">${h}</div>${sl}<span class="gold">${mitspieler() ? ich().gold + " Gold" : V.goldSumme(S) + " Gold gesamt"}</span></div>`;
  }
  // Karte: zum Abstimmen groß, sonst zum Aufklappen
  const namen = () => Object.fromEntries(S.teilnehmer.map(p => [p, sp(p).name]));
  function karteAufklappen() {
    if (!S.karte) return "";
    return `<details class="kartenklapp" id="kartenklapp" ${karteOffen ? "open" : ""}><summary>Karte ansehen</summary><div class="seite kartenblatt">${VKarte.svg(S, { namen: namen() })}${VKarte.legende()}</div></details>`;
  }
  function bildschirmKarte() {
    const e = S.entscheidung, meine = e.stimmen[PID];
    const offen = S.teilnehmer.filter(p => e.stimmen[p] === undefined);
    const kuerzel = p => sp(p).name.slice(0, 2);
    const stimmen = {};
    e.optionen.forEach((o, i) => { const w = S.teilnehmer.filter(p => e.stimmen[p] === i).map(kuerzel); if (w.length) stimmen[o.knoten] = (stimmen[o.knoten] || []).concat(w); });
    let h = fortschritt();
    h += `<article class="seite kartenblatt"><h2>${esc(S.seite.titel)}</h2><p>${esc(S.seite.text[0])}</p>
      ${VKarte.svg(S, { optionen: e.optionen.map((o, i) => ({ knoten: o.knoten, i, gesperrt: o.gesperrt, geheim: o.geheim })), meine, stimmen, klickbar: mitspieler(), namen: namen() })}
      ${VKarte.legende()}</article>`;
    h += `<h2>${esc(e.frage)}</h2><p class="leise klein">Tippe auf der Karte auf einen Raum mit rotem Ring oder wähle hier.${V.sicht(S) > 2 ? " Dank eures Spähers seht ihr drei Reihen weit." : ""}</p>
      <div class="optionen">${e.optionen.map((o, i) => {
        const wer = S.teilnehmer.filter(p => e.stimmen[p] === i).map(p => esc(sp(p).name));
        return `<button class="option ${meine === i ? "meins" : ""} ${o.gesperrt ? "gesperrt" : ""}" data-stimme="${i}" ${mitspieler() && !o.gesperrt ? "" : "disabled"}><b>${esc(o.text)}</b>${o.hinweis ? `<i>${esc(o.hinweis)}</i>` : ""}<span class="stimmen">${wer.join(", ")}</span></button>`;
      }).join("")}</div>
      <p class="leise klein mitte">${offen.length ? "Warte auf: " + offen.map(p => esc(sp(p).name)).join(", ") : ""}${e.optionen.length > 1 ? " · Bei Gleichstand entscheidet das Los." : ""}</p>
      ${rolle === "host" && offen.length && Object.keys(e.stimmen).length ? `<button class="link" id="beenden">Nicht warten, jetzt entscheiden</button>` : ""}`;
    h += faehigkeitenKnopf() + `<h3>Gruppe</h3>${heldenLeiste(false, false)}`;
    return h;
  }
  function buchseite(seite) {
    if (!seite) return "";
    const [erster, ...rest] = seite.text;
    return `<article class="seite">${VB.bild(seite.bild)}<h2>${esc(seite.titel)}</h2><p>${esc(erster)}</p>${rest.map(t => `<p class="erg">${esc(t)}</p>`).join("")}</article>`;
  }

  // ---------- Bildschirme ----------
  function sig() {
    if (!rolle) return "start:" + (code ? "name" : "neu");
    if (rolle === "pruefen" || !S) return "warte";
    return [S.phase, S.spielNr, S.aenderung, auswahl ? auswahl.id : "", zeigeFaehigkeiten ? "f" : ""].join(":");
  }
  let letzteRunde = "";
  function render() {
    if (S && gespielt === null) gespielt = S.letzte ? S.letzte.id : "";
    if (wiedergabe) { aktualisiere(); return; }
    if (S && S.letzte && S.letzte.id !== gespielt && rolle && rolle !== "pruefen") { starteWiedergabe(S.letzte); return; }
    // wechselt die Runde (oder das Spiel), ist eine halb gewählte Aktion hinfällig
    const r = S && S.kampf ? S.spielNr + ":" + S.kampf.runde : "";
    if (r !== letzteRunde) { letzteRunde = r; auswahl = null; }
    if (S && S.phase !== "erkunden" && S.phase !== "lager") zeigeFaehigkeiten = false;
    const s = sig();
    if (s !== letzteSig) { letzteSig = s; baue(); }
    aktualisiere();
  }
  function statusZeile() {
    if (rolle === "host") return verbunden ? "" : (fehlerText || "Raum wird geöffnet …");
    if (rolle === "client" && !verbunden) return S ? "Verbindung zum Spielleiter weg, verbinde neu …" : (fehlerText || "Verbinde mit Raum " + code + " …");
    return "";
  }
  function aktualisiere() {
    const st = document.getElementById("status");
    if (st) {
      const t = statusZeile(); st.hidden = !t; st.querySelector("span").textContent = t;
      st.querySelector("button").hidden = !(rolle === "client" && S && offlineSeit && Date.now() - offlineSeit > 20000);
    }
  }
  setInterval(aktualisiere, 1000);

  async function starteWiedergabe(Lz) {
    wiedergabe = true; ueberspringen = false;
    const nr = Lz.runde;
    app.innerHTML = `<div class="status" id="status" hidden><span></span><button id="uebernehmen" hidden>Spielleitung übernehmen</button></div>
      <div class="kopf"><h2>${esc(Lz.titel || "Kampf")} · Runde ${nr}</h2></div>
      <div class="buehne" id="buehne"></div>
      <div class="chronik" id="wchronik" aria-live="polite"><p>…</p></div>
      <button class="knopf zweit" id="ueberspringen">Überspringen</button>
      ${einstellungenHtml()}`;
    window.scrollTo(0, 0);
    document.getElementById("ueberspringen").onclick = () => { ueberspringen = true; };
    bindeEinstellungen();
    if ($("uebernehmen")) $("uebernehmen").onclick = uebernehmen;
    aktualisiere();
    try {
      await VBuehne.abspielen(document.getElementById("buehne"), Lz, {
        name: p => sp(p).name, rolle: p => (S.helden[p] || {}).rolle,
        get tempo() { return schnell ? .55 : 1; }, get ton() { return tonAn; },
        abbruch: () => ueberspringen,
        sag: t => { const c = document.getElementById("wchronik"); if (c) c.innerHTML = (t || []).map(x => `<p>${esc(x)}</p>`).join("") || "<p>…</p>"; }
      });
      if (!ueberspringen) await new Promise(r => setTimeout(r, 500));
    } catch (e) { if (window.console) console.error(e); }
    gespielt = Lz.id; wiedergabe = false; letzteSig = "";
    render();
  }
  const $ = id => document.getElementById(id);
  function einstellungenHtml() {
    return `<div class="einstellungen"><button id="e-ton" class="${tonAn ? "an" : ""}">${tonAn ? "Ton an" : "Ton aus"}</button><button id="e-schnell" class="${schnell ? "an" : ""}">${schnell ? "Animation schnell" : "Animation normal"}</button></div>`;
  }
  function bindeEinstellungen() {
    if ($("e-ton")) $("e-ton").onclick = e => { tonAn = !tonAn; ls.set("vl:ton", tonAn); e.target.classList.toggle("an", tonAn); e.target.textContent = tonAn ? "Ton an" : "Ton aus"; if (tonAn) VBuehne.audio(); };
    if ($("e-schnell")) $("e-schnell").onclick = e => { schnell = !schnell; ls.set("vl:schnell", schnell); e.target.classList.toggle("an", schnell); e.target.textContent = schnell ? "Animation schnell" : "Animation normal"; };
  }
  // Daten für die ruhende Bühne im Kampf
  function buehnenDaten(zielModus) {
    const k = S.kampf;
    return {
      gegner: S.gegner.map(g => ({ id: g.id, art: g.art, name: g.name, hp: g.hp, max: g.max, giftR: g.giftR, markiert: g.markiert, starr: g.starr, zustand: V.zustand(S, g) })),
      helden: S.teilnehmer.map(p => { const x = S.helden[p];
        const m = [x.gefallen ? "gefallen" : x.hp <= 0 ? "bewusstlos" : k.wahl[p] ? "✓ bereit" : !online(p) ? "nicht verbunden" : "", x.giftR > 0 && x.hp > 0 ? (x.giftArt === "Brand" ? "brennt" : "vergiftet") : "", x.netz && x.hp > 0 ? "im Netz" : "", x.lauer ? "lauert" : "", x.segen ? "gesegnet" : ""].filter(Boolean).join(" · ");
        return { id: p, rolle: x.rolle, name: sp(p).name, hp: x.hp, max: x.max, marken: m }; }),
      absicht: k.absicht || {}, ebene: S.ebene || 1,
      zielModus: zielModus === "anderer" ? "held" : zielModus,
      zielHelden: S.teilnehmer.filter(p => zielModus === "held" || (zielModus === "anderer" && p !== PID && S.helden[p].hp > 0))
    };
  }

  function baue() {
    let h = `<div class="status" id="status" hidden><span></span><button id="uebernehmen" hidden>Spielleitung übernehmen</button></div>`;
    if (!rolle) h += code ? bildschirmName() : bildschirmStart();
    else if (rolle === "pruefen" || !S) h += `<div class="mitte"><p class="leise">Verbinde …</p></div>`;
    else if (zeigeFaehigkeiten && mitspieler() && (S.phase === "erkunden" || S.phase === "lager")) h += bildschirmFaehigkeiten();
    else h += ({ lobby: bildschirmLobby, erkunden: bildschirmErkunden, lager: bildschirmLager, kampf: bildschirmKampf, ende: bildschirmEnde }[S.phase] || (() => ""))();
    const y = window.scrollY;
    app.innerHTML = h;
    window.scrollTo(0, y);
    binden();
  }

  function bildschirmStart() {
    return `<header class="titel"><h1>Verlies zu dritt</h1><p class="leise">Drei Helden steigen gemeinsam hinab: acht Räume, ein Händler mit Waffen und neuen Fähigkeiten, und ganz unten der Knochenkönig. Jeder spielt auf seinem Handy, gewonnen wird zusammen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
      <div class="karte"><h2>Neues Spiel</h2><p class="leise klein">Für 3 Leute gedacht, geht auch zu zweit (dann schwerer). Etwa 25 Minuten. Runde für Runde, ohne Zeitdruck.</p>
        <button class="knopf" id="neu">Raum erstellen</button></div>
      <div class="karte"><h2>Mitspielen</h2>
        <label class="feld">Raumcode<input id="code" maxlength="4" autocapitalize="characters" placeholder="z. B. K7M2"></label>
        <button class="knopf zweit" id="beitreten">Beitreten</button></div>
      <a class="link" href="../">Alle Spiele</a>`;
  }
  function bildschirmName() {
    return `<header class="titel"><h1>Verlies zu dritt</h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
      <button class="knopf" id="mitspielen">Mitspielen</button>`;
  }

  function rollenKarten() {
    const voll = Object.keys(S.rollen).filter(p => S.spieler[p] && (online(p) || p === PID)).length >= V.MAX_HELDEN;
    return `<div class="rollen">${V.ROLLEN_REIHE.map(r => {
      const R = V.ROLLEN[r];
      const wer = Object.keys(S.rollen).find(p => S.rollen[p] === r && S.spieler[p] && (online(p) || p === PID));
      const meins = wer === PID, belegt = wer && !meins, gesperrt = belegt || (!S.rollen[PID] && voll);
      return `<button class="rolle ${meins ? "meins" : ""} ${gesperrt ? "belegt" : ""}" data-rolle="${r}" ${gesperrt ? "disabled" : ""}>
        ${VB.held(r)}<b>${R.name}</b><small>${R.hp} Leben · ${R.kurz}</small>
        <span class="wer">${meins ? "Das bist du ✓" : belegt ? esc(sp(wer).name) : voll ? "" : "frei"}</span></button>`;
    }).join("")}</div>`;
  }
  function startbereit() {
    const da = Object.keys(S.rollen).filter(p => S.spieler[p] && online(p));
    return da.length >= (TEST ? 1 : 2);
  }
  // Partielänge: der Spielleiter wählt, alle sehen die Wahl
  function laengeHtml(host) {
    const DAUER = { 1: "1 Ebene, etwa 30 Minuten", 2: "2 Ebenen, etwa 1 Stunde", 3: "3 Ebenen, etwa 1½ Stunden" };
    const n = S.laenge || 2;
    return `<div class="karte"><h3>Partielänge</h3><div class="laengen">${[1, 2, 3].map(i => `<button class="laenge ${i === n ? "an" : ""}" data-laenge="${i}" ${host ? "" : "disabled"} aria-pressed="${i === n}"><b>${V.LAENGEN[i]}</b><small>${DAUER[i]}</small></button>`).join("")}</div>
      <p class="leise klein">${V.EBENEN.slice(0, n).map(e => esc(e.name)).join(" → ")}${host ? "" : ` · wählt ${esc(sp(S.host).name)}`}</p></div>`;
  }
  // Schwierigkeit: ebenso vom Spielleiter gewählt
  function schwereHtml(host) {
    const n = S.schwere || 2, W = V.SCHWERE[n];
    const text = { 1: `Gegner schwächer, mehr Gold, die Rast heilt ${Math.round(V.SCHWERE[1].rast * 100)} %. Bewusstlose stehen nach dem Kampf mit halben Leben auf.`,
      2: "So wie bisher. Bewusstlose stehen nach dem Kampf mit 5 Leben auf.",
      3: `Gegner zäher und stärker, weniger Gold, mehr Elite-Räume, die Rast heilt nur ${Math.round(V.SCHWERE[3].rast * 100)} %.`,
      4: "Noch härter als Held. Wer am Ende eines Kampfes bewusstlos ist, ist gefallen und schaut für den Rest der Partie zu." };
    return `<div class="karte"><h3>Schwierigkeit</h3><div class="laengen vier">${[1, 2, 3, 4].map(i => `<button class="laenge ${i === n ? "an" : ""}" data-schwere="${i}" ${host ? "" : "disabled"} aria-pressed="${i === n}"><b>${V.SCHWERE[i].name}</b><small>${esc(V.SCHWERE[i].kurz)}</small></button>`).join("")}</div>
      <p class="leise klein">${esc(W.name)}: ${text[n]}${host ? "" : ` · wählt ${esc(sp(S.host).name)}`}</p></div>`;
  }
  function bildschirmLobby() {
    const host = rolle === "host";
    const leute = S.reihenfolge.filter(p => S.spieler[p] && (online(p) || p === PID));
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
    const ohneRolle = leute.filter(p => !S.rollen[p]);
    return `<header class="titel"><p class="etikett">Verlies · Raumcode</p><div class="code">${esc(code)}</div></header>
      ${qr ? `<div class="qr">${qr}</div>` : ""}
      <div class="reihe"><button class="knopf zweit" id="teilen">Link teilen</button><button class="knopf zweit" id="kopieren">Link kopieren</button></div>
      <div class="karte"><h2>Wähle deine Rolle</h2><p class="leise klein">Sechs Rollen, zwei bis vier gehen hinab. Neue Fähigkeiten lernt jeder im Talentbaum.</p>${rollenKarten()}
        ${ohneRolle.length ? `<p class="leise klein">Noch ohne Rolle: ${ohneRolle.map(p => esc(sp(p).name)).join(", ")}${leute.length > V.MAX_HELDEN ? ". Wer keine Rolle hat, schaut zu." : ""}</p>` : ""}</div>
      ${laengeHtml(host)}
      ${schwereHtml(host)}
      <div class="karte"><h3>So geht's</h3><p class="leise klein">Auf der Karte stimmt ihr ab, welchen Raum ihr als Nächstes nehmt. Im Kampf wählt jeder in Ruhe seinen Zug, ausgeführt wird, wenn alle gewählt haben. Heilende Fähigkeiten holen Bewusstlose zurück. Beim Händler kauft jeder mit seinem eigenen Gold, Talentpunkte gibt es mit jeder Stufe. Am Ende jeder Ebene wartet ein Endgegner, danach ein Lager mit voller Heilung. Wenn alle fallen, ist das Spiel verloren.</p></div>
      ${host ? `<div class="unten"><button class="knopf" id="start" ${startbereit() ? "" : "disabled"}>${startbereit() ? "Abstieg beginnen" : "Mindestens 2 brauchen eine Rolle …"}</button></div>`
        : `<p class="leise mitte">Warte, bis ${esc(sp(S.host).name)} das Spiel startet.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }

  // eine Zeile je Held; im Kampf mit Zustandsmarken und als Ziel antippbar
  function heldZeile(p, imKampf, ziel) {
    const x = S.helden[p], k = S.kampf;
    const marken = x.gefallen ? `<span class="marke">gefallen, schaut zu</span>` : imKampf ? [x.hp <= 0 ? `<span class="marke">bewusstlos</span>` : "", x.giftR > 0 && x.hp > 0 ? `<span class="marke gift">${x.giftArt === "Brand" ? "brennt" : "vergiftet"}</span>` : "", x.netz && x.hp > 0 ? `<span class="marke">im Netz</span>` : "",
      x.lauer ? `<span class="marke schatten">lauert</span>` : "", x.segen ? `<span class="marke">gesegnet</span>` : "",
      k && k.wahl[p] ? `<span class="marke ok">bereit</span>` : ""].join("") : "";
    const ast = V.hauptast(x);
    const unter = `${V.ROLLEN[x.rolle].name}${ast ? " · " + ast.name : ""} · Stufe ${x.stufe}${online(p) ? "" : " · nicht verbunden"}${imKampf ? "" : ` · ${x.gold} Gold · ${x.traenke} ${x.traenke === 1 ? "Trank" : "Tränke"}`}`;
    return `<button class="heldzeile ${x.hp <= 0 && !ziel ? "weg" : ""} ${ziel ? "ziel" : ""}" ${ziel ? `data-ziel="${p}"` : "disabled"}>
      ${VB.held(x.rolle)}<span class="mitte-sp"><span class="kopfzeile"><b>${esc(sp(p).name)}</b><small>${unter}</small></span>${balken(x.hp, x.max)}${marken ? `<span class="marken">${marken}</span>` : ""}</span>
      <span class="hp">${x.hp}<small>/${x.max}</small></span></button>`;
  }
  // zielArt: "held" (jeder), "anderer" (lebende andere) oder nichts
  function heldenLeiste(imKampf, zielArt) {
    const istZiel = p => zielArt === "held" || (zielArt === "anderer" && p !== PID && S.helden[p].hp > 0);
    return `<div class="heldenliste">${S.teilnehmer.map(p => heldZeile(p, imKampf, istZiel(p))).join("")}</div>`;
  }

  function bildschirmErkunden() {
    const e = S.entscheidung;
    if (e && e.art === "karte" && S.karte) return bildschirmKarte();
    let h = fortschritt() + buchseite(S.seite);
    if (e) {
      const meine = e.stimmen[PID];
      const offen = S.teilnehmer.filter(p => e.stimmen[p] === undefined);
      h += `${e.frage ? `<h2>${esc(e.frage)}</h2>` : ""}<div class="optionen">${e.optionen.map((o, i) => {
        const wer = S.teilnehmer.filter(p => e.stimmen[p] === i).map(p => esc(sp(p).name));
        return `<button class="option ${meine === i ? "meins" : ""}" data-stimme="${i}" ${mitspieler() ? "" : "disabled"}><b>${esc(o.text)}</b>${o.hinweis ? `<i>${esc(o.hinweis)}</i>` : ""}<span class="stimmen">${wer.join(", ")}</span></button>`;
      }).join("")}</div>
      <p class="leise klein mitte">${offen.length ? "Warte auf: " + offen.map(p => esc(sp(p).name)).join(", ") : ""}${e.optionen.length > 1 ? " · Bei Gleichstand entscheidet das Los." : ""}</p>
      ${rolle === "host" && offen.length && Object.keys(e.stimmen).length ? `<button class="link" id="beenden">Nicht warten, jetzt entscheiden</button>` : ""}`;
    }
    h += faehigkeitenKnopf() + karteAufklappen() + `<h3>Gruppe</h3>${heldenLeiste(false, false)}`;
    return h;
  }

  function bildschirmKampf() {
    const k = S.kampf, mh = ich(), lebt = mh && mh.hp > 0;
    const meineWahl = k.wahl[PID];
    const zielModus = auswahl && auswahl.ziel;
    let h = fortschritt();
    h += `<div class="kopf"><h2>${esc(S.seite.titel)} · Runde ${k.runde}</h2></div>`;
    if (k.runde === 1 && S.seite) h += `<div class="chronik"><p>${esc(S.seite.text[0])}</p></div>`;
    // Bühne: Gegner oben mit angekündigtem Zug, Helden unten; Ziele werden hier angetippt
    h += `<div class="buehne" id="buehne"></div>`;
    // Was die Gegner besonders macht (Erklärung zu den Schildern auf der Bühne)
    const zst = V.gegnerLebend(S).flatMap(g => V.zustand(S, g));
    const eig = [...new Set(V.gegnerLebend(S).flatMap(g => V.eigenschaften(g.art)).concat(zst.includes("fliegt") ? ["fliegend"] : [], zst.includes("Wut") ? ["schnell"] : []))], schild = S.gegner.some(g => V.knochenschild(S, g));
    if (eig.length || schild) h += `<details class="chronik gegnerkunde"${k.runde === 1 || schild ? " open" : ""}><summary class="etikett">Gegner-Eigenschaften</summary>${schild ? `<p><b>Knochenschild:</b> Der Knochenkönig nimmt nur halben Schaden, solange ein Skelett steht.</p>` : ""}${eig.map(e => { const [n, t] = V.EIGENSCHAFTEN[e]; return `<p><b>${esc(n.charAt(0).toUpperCase() + n.slice(1))}:</b> ${esc(t)}</p>`; }).join("")}</details>`;
    if (S.log && S.log.length) h += `<details class="chronik"><summary class="etikett">Was in Runde ${k.runde - 1} geschah</summary>${S.log.map(t => `<p>${esc(t)}</p>`).join("")}</details>`;
    // Eigene Wahl
    if (!mitspieler()) h += `<p class="leise mitte">Du schaust zu.</p>`;
    else if (!lebt) h += `<div class="hinweis">Du bist bewusstlos. Nur eine heilende Fähigkeit kann dich zurückholen.</div>`;
    else if (meineWahl && !auswahl) {
      const a0 = V.aktionenVon(mh).find(x => x.id === meineWahl.a), a = a0 ? { name: a0.name } : { name: meineWahl.a };
      const zn = meineWahl.ziel ? (S.gegner.find(g => g.id === meineWahl.ziel) || {}).name || sp(meineWahl.ziel).name : "";
      h += `<div class="karte"><p class="etikett">Dein Zug</p><h2>${esc(a.name)}${zn ? " → " + esc(zn) : ""}</h2><button class="knopf zweit" id="aendern">Ändern</button></div>`;
    } else {
      if (zielModus) h += `<div class="hinweis">${esc(auswahl.name)}: Tippe auf der Bühne auf ${zielModus === "gegner" ? "einen Gegner" : zielModus === "anderer" ? "einen anderen Helden" : "einen Helden"} (gelb umrandet).</div>`;
      h += `<p class="etikett">Dein Zug</p><div class="aktionen">${V.aktionenVon(mh).map(a => {
        const cd = mh.cd[a.id] || 0, meister = a.meister && cd > 50;
        const ohneZiel = a.ziel === "anderer" && !S.teilnehmer.some(p => p !== PID && S.helden[p].hp > 0);
        return `<button class="aktion ${auswahl && auswahl.id === a.id ? "an" : ""}" data-aktion="${a.id}" ${cd || ohneZiel ? "disabled" : ""}><b>${a.meister ? "★ " : ""}${esc(a.name)}${a.id === "trank" ? ` (${mh.traenke})` : ""}</b><small>${meister ? "Schon eingesetzt, im nächsten Kampf wieder" : cd ? `Wieder bereit in ${cd} ${cd === 1 ? "Runde" : "Runden"}` : esc(a.text) + V.aktionZusatz(mh, a)}</small></button>`;
      }).join("")}</div>
      ${auswahl ? `<button class="link" id="abbrechen">Abbrechen</button>` : ""}`;
    }
    const fehlen = V.lebend(S).filter(p => !k.wahl[p]);
    if (fehlen.length) h += `<p class="leise klein mitte">Warte auf: ${fehlen.map(p => esc(sp(p).name)).join(", ")}</p>`;
    if (rolle === "host" && fehlen.some(p => !online(p))) h += `<button class="link" id="auto">Für nicht Verbundene automatisch ziehen</button>`;
    h += einstellungenHtml();
    return h;
  }

  // ---------- Talentbaum ----------
  // Oben der gezeichnete Baum (drei Äste, sechs Rauten), darunter der gewählte Ast als Liste.
  // Antippen einer Raute zeigt sie in der Liste, nochmal antippen lernt sie (wenn möglich).
  function talentBaumSvg(h) {
    const aeste = V.AESTE[h.rolle], X = [58, 165, 272], Y = i => 236 - i * 38;
    let s = `<svg class="talentbaum" viewBox="0 0 330 290" role="group" aria-label="Talentbaum">`;
    s += `<path d="M165 266V254" stroke="#2A2118" stroke-width="8" stroke-linecap="round"/><path d="M150 268q15-6 30 0" fill="none" stroke="#2A2118" stroke-width="3" stroke-linecap="round"/>`;
    X.forEach(x => { s += `<path d="M165 266Q165 252 ${x} 252V${Y(0)}" fill="none" stroke="#2A2118" stroke-width="${x === 165 ? 6 : 4.5}" stroke-linecap="round"/>`; });
    aeste.forEach((a, ai) => {
      const x = X[ai];
      for (let i = 1; i < 6; i++) { const an = h.talente.includes(a.knoten[i - 1]) && h.talente.includes(a.knoten[i]); s += `<path d="M${x} ${Y(i - 1)}V${Y(i)}" stroke="${an ? "#C99A2E" : "#8C7A6B"}" stroke-width="${an ? 4 : 2.5}" ${an ? "" : 'stroke-dasharray="4 4"'}/>`; }
      a.knoten.forEach((id, i) => {
        const t = V.TALENT[id], hat = h.talente.includes(id), frei = !hat && V.talentWaehlbar(h, id), r = i === 5 ? 17 : 12;
        const fill = hat ? "#E8C24A" : frei ? "#FBF3E2" : "#D9CBB0", stroke = hat ? "#2A2118" : frei ? "#FF6B57" : "#8C7A6B";
        s += `<g class="t-knoten ${frei && h.punkte ? "t-frei" : ""} ${talentFokus === id ? "fokus" : ""}" data-tknoten="${id}" role="button" tabindex="0" aria-label="${esc(t.name)}${hat ? ", gelernt" : frei ? ", wählbar" : ", gesperrt"}" transform="translate(${x} ${Y(i)})">
          <circle r="${r + 8}" fill="transparent"/>${talentFokus === id ? `<rect x="${-r - 6}" y="${-r - 6}" width="${2 * r + 12}" height="${2 * r + 12}" rx="3" transform="rotate(45)" fill="none" stroke="#2A2118" stroke-width="1.5" stroke-dasharray="3 3"/>` : ""}
          <rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" rx="3" transform="rotate(45)" fill="${fill}" stroke="${stroke}" stroke-width="${frei ? 3 : 2}"/>
          ${i === 5 ? `<path d="M0-8l2.4 5 5.6.8-4 3.9 1 5.5L0 9.6l-5 2.6 1-5.5-4-3.9 5.6-.8z" fill="${hat ? "#B83A2A" : "#8C7A6B"}"/>` : hat ? `<path d="M-5 0l3.5 3.5L5-4" fill="none" stroke="#2A2118" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ""}</g>`;
      });
      s += `<text x="${x}" y="282" text-anchor="middle" font-family="Alegreya, Georgia, serif" font-weight="700" font-size="14" fill="#2A2118">${esc(a.name)}</text>`;
    });
    return s + `</svg>`;
  }
  function bildschirmFaehigkeiten() {
    const h = ich(), st = h.stufe, naechste = V.EP_STUFEN[st];
    const von = V.EP_STUFEN[st - 1], q = naechste ? (h.ep - von) / (naechste - von) : 1;
    const aeste = V.AESTE[h.rolle];
    if (talentAst === null) { const ha = V.hauptast(h); talentAst = ha ? Math.max(0, aeste.findIndex(a => a.name === ha.name)) : 0; }
    const ast = aeste[talentAst];
    const meisterGewaehlt = V.talenteVon(h).find(t => t.e.meister);
    const boni = Object.keys(V.STUFENBONUS).filter(x => st >= +x).map(x => V.STUFENBONUS[x]);
    return `<header class="titel"><p class="etikett">${V.ROLLEN[h.rolle].name} · ${esc(name)}</p><h1>Stufe ${st}</h1>
        <div class="balken"><i style="width:${Math.round(q * 100)}%"></i></div>
        <p class="leise klein">${naechste ? `${h.ep} von ${naechste} Erfahrung bis Stufe ${st + 1}` : `Höchste Stufe erreicht (${h.ep} Erfahrung)`} · Jede Stufe: +3 Höchstleben und 1 Talentpunkt. Stufe 5, 10, 15 und 20 bringen noch etwas extra.${boni.length ? " Du hast: " + boni.join(", ") + "." : ""}</p></header>
      <div class="hinweis">${h.punkte ? `Du hast ${h.punkte} ${h.punkte === 1 ? "Talentpunkt" : "Talentpunkte"}. Tippe eine Raute an, nochmal antippen lernt sie.` : "Keine Punkte frei. Neue gibt es mit der nächsten Stufe oder beim Üben an der Rast."}</div>
      <div class="seite talentblatt">${talentBaumSvg(h)}</div>
      <div class="ast-reiter">${aeste.map((a, i) => `<button class="${i === talentAst ? "an" : ""}" data-tast="${i}">${esc(a.name)}<small>${a.knoten.filter(id => h.talente.includes(id)).length}/6</small></button>`).join("")}</div>
      <p class="leise klein mitte">${esc(ast.kurz)}</p>
      <div class="waren">${ast.knoten.map((id, i) => {
        const t = V.TALENT[id], hat = h.talente.includes(id), frei = !hat && V.talentWaehlbar(h, id);
        const grund = hat ? "✓" : frei ? (h.punkte ? "1 Punkt" : "kein Punkt") : i === 5 && meisterGewaehlt ? "nur eine" : "gesperrt";
        return `<button class="ware talent ${hat ? "gelernt" : ""} ${talentFokus === id ? "fokus" : ""} ${t.e.meister ? "meister" : ""}" data-talent="${id}" ${frei && h.punkte ? "" : "disabled"}>
          <b>${i + 1}. ${t.e.meister ? "★ " : ""}${esc(t.name)}</b><span class="preis ${hat || (frei && h.punkte) ? "" : "leise-preis"}">${grund}</span><small>${esc(t.text)}${i === 5 && meisterGewaehlt && !hat ? ` Du hast schon ${esc(meisterGewaehlt.name)} als Meisterfähigkeit.` : ""}</small></button>`;
      }).join("")}</div>
      <h3>Deine Fähigkeiten</h3>
      <div class="faehigkeitsliste">${V.aktionenVon(h).filter(a => a.id !== "trank").map(a => `<p><b>${a.meister ? "★ " : ""}${esc(a.name)}</b> <span class="leise">${esc(a.text)}${esc(V.aktionZusatz(h, a))}</span></p>`).join("")}</div>
      ${amSchrein() ? umverteilenHtml(h) : ""}
      <div class="unten"><button class="knopf" id="zurueck-f">Zurück</button></div>`;
  }
  const amSchrein = () => S.phase === "erkunden" && S.entscheidung && S.entscheidung.art === "schrein";
  function umverteilenHtml(h) {
    const vergeben = h.talente.length;
    return `<div class="karte"><h2>Am Schrein</h2><p class="leise klein">Alle Talente vergessen: Du bekommst deine ${vergeben} Punkte zurück und verteilst sie neu.</p>
      <button class="knopf zweit" id="umverteilen" ${vergeben && h.gold >= V.UMVERTEILEN ? "" : "disabled"}>Punkte neu verteilen (${V.UMVERTEILEN} Gold)</button>
      ${!vergeben ? `<p class="leise klein">Du hast noch keine Punkte vergeben.</p>` : h.gold < V.UMVERTEILEN ? `<p class="leise klein">Du hast nicht genug Gold.</p>` : ""}</div>`;
  }

  function bildschirmLager() {
    const L = S.lager, mh = ich(), fertig = L.fertig[PID];
    const offen = S.teilnehmer.filter(p => !L.fertig[p]);
    let h = fortschritt() + buchseite(S.seite);
    if (mitspieler()) {
      const gelernt = [];
      h += `<div class="karte"><div class="kopf"><h2>Dein Einkauf</h2><span class="gold">${mh.gold} Gold</span></div>
        <div class="ausruestung"><span class="marke">Waffe +${mh.waffe}</span><span class="marke">Rüstung −${mh.ruestung}</span><span class="marke">${mh.hp}/${mh.max} Leben</span><span class="marke">${mh.traenke} ${mh.traenke === 1 ? "Trank" : "Tränke"}</span>${gelernt.map(n => `<span class="marke schatten">${esc(n)}</span>`).join("")}</div>
        <div class="waren">${V.angebot(mh).map(w => `<button class="ware ${w.faehigkeit ? "faehigkeit" : ""} ${w.aus ? "aus" : ""}" data-kauf="${w.id}" ${w.aus || w.preis > mh.gold || fertig ? "disabled" : ""}>
          <b>${esc(w.name)}</b><span class="preis">${w.aus ? "✓" : w.preis + " G"}</span><small>${esc(w.text)}</small></button>`).join("")}</div></div>`;
      h += `<div class="unten"><button class="knopf ${fertig ? "zweit" : ""}" id="fertig">${fertig ? "Doch noch einkaufen" : S.ebeneFertig ? "Fertig, weiter hinab" : "Fertig, weiterziehen"}</button>
        <p class="leise klein mitte">${offen.length ? "Noch beim Händler: " + offen.map(p => esc(sp(p).name)).join(", ") : ""}</p>
        ${rolle === "host" && offen.length && offen.length < S.teilnehmer.length ? `<button class="link" id="beenden">Nicht warten, weiterziehen</button>` : ""}</div>`;
    } else h += `<p class="leise mitte">Die Helden kaufen ein. Noch beim Händler: ${offen.map(p => esc(sp(p).name)).join(", ")}</p>`;
    h += faehigkeitenKnopf() + karteAufklappen();
    if (L.kaeufe.length) h += `<p class="kaeufe">${L.kaeufe.slice(-6).map(k => `${esc(sp(k.pid).name)}: ${esc(k.name)}`).join(" · ")}</p>`;
    h += `<h3>Gruppe</h3>${heldenLeiste(false, null)}`;
    return h;
  }

  function bildschirmEnde() {
    const sieg = S.ergebnis === "sieg";
    return `<p class="etikett mitte">${sieg ? "Sieg" : "Niederlage"} · ${(S.ebenen || 1) > 1 ? `Ebene ${S.ebene} von ${S.ebenen}, ` : ""}Raum ${S.raumNr} von ${V.RAEUME} · ${V.SCHWERE[S.schwere || 2].name}</p>${buchseite(S.seite)}${karteAufklappen()}
      <div class="karte"><h2>Die Helden</h2>
        <table class="werte"><tr><th>Held</th><th>Schaden</th><th>Geheilt</th><th>K.&nbsp;o.</th><th>Gold</th></tr>
        ${S.teilnehmer.map(p => { const x = S.helden[p]; return `<tr><td>${esc(sp(p).name)}<br><span class="leise klein">${V.ROLLEN[x.rolle].name} · Stufe ${x.stufe}</span></td><td>${x.stats.schaden}</td><td>${x.stats.geheilt}</td><td>${x.stats.umgefallen}</td><td>${x.gold}</td></tr>`; }).join("")}</table></div>
      ${rolle === "host" ? laengeHtml(true) + schwereHtml(true) : ""}
      ${rolle === "host" ? `<div class="unten"><button class="knopf" id="nochmal">Nochmal hinab</button><button class="knopf zweit" id="lobby">Rollen neu wählen</button></div>` : `<p class="leise mitte">${esc(sp(S.host).name)} kann eine neue Runde starten.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }

  function binden() {
    if ($("buehne") && S && S.phase === "kampf" && !wiedergabe) VBuehne.zeichne($("buehne"), buehnenDaten(auswahl && auswahl.ziel));
    bindeEinstellungen();
    const nameAus = () => { const n = ($("name").value || "").trim().slice(0, 20); if (!n) { $("name").focus(); return null; } name = n; ls.set("slf:name", n); return n; };
    if ($("uebernehmen")) $("uebernehmen").onclick = uebernehmen;
    if ($("neu")) $("neu").onclick = () => { if (nameAus()) neuesSpiel(); };
    if ($("beitreten")) $("beitreten").onclick = () => {
      if (!nameAus()) return;
      const c = ($("code").value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.length !== 4) { $("code").focus(); return; }
      code = c; history.replaceState(null, "", "?raum=" + code + testTeil()); clientStarten();
    };
    if ($("mitspielen")) $("mitspielen").onclick = () => { if (nameAus()) clientStarten(); };
    if ($("teilen")) $("teilen").onclick = () => { if (navigator.share) navigator.share({ title: "Verlies zu dritt", text: "Komm mit ins Verlies! Raum " + code, url: link() }).catch(() => {}); else kopieren(); };
    if ($("kopieren")) $("kopieren").onclick = kopieren;
    document.querySelectorAll("[data-rolle]").forEach(b => b.onclick = () => tun({ t: "rolle", rolle: S.rollen[PID] === b.dataset.rolle ? null : b.dataset.rolle }));
    const starten = () => tun({ t: "start", anwesend: S.reihenfolge.filter(p => online(p)), mindestens: TEST ? 1 : 2 });
    if ($("start")) $("start").onclick = starten;
    if ($("nochmal")) $("nochmal").onclick = starten;
    if ($("lobby")) $("lobby").onclick = () => tun({ t: "neustart" });
    document.querySelectorAll("[data-schwere]").forEach(b => b.onclick = () => tun({ t: "schwere", n: +b.dataset.schwere }));
    document.querySelectorAll("[data-laenge]").forEach(b => b.onclick = () => tun({ t: "laenge", n: +b.dataset.laenge }));
    if ($("verlassen")) $("verlassen").onclick = verlassen;
    document.querySelectorAll("[data-stimme]").forEach(b => {
      b.onclick = () => tun({ t: "stimme", i: +b.dataset.stimme, nr: S.spielNr });
      if (b.tagName !== "BUTTON") b.onkeydown = ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); b.onclick(); } };
    });
    if ($("beenden")) $("beenden").onclick = () => tun({ t: "beenden" });
    document.querySelectorAll("[data-kauf]").forEach(b => b.onclick = () => tun({ t: "kaufen", id: b.dataset.kauf, nr: S.spielNr }));
    if ($("faehigkeiten")) $("faehigkeiten").onclick = () => { zeigeFaehigkeiten = true; talentAst = null; talentFokus = null; letzteSig = ""; window.scrollTo(0, 0); render(); };
    if ($("zurueck-f")) $("zurueck-f").onclick = () => { zeigeFaehigkeiten = false; letzteSig = ""; window.scrollTo(0, 0); render(); };
    const lernen = id => { tun({ t: "talent", id, nr: S.spielNr }); talentFokus = id; letzteSig = ""; render(); };
    document.querySelectorAll("[data-talent]").forEach(b => b.onclick = () => lernen(b.dataset.talent));
    document.querySelectorAll("[data-tast]").forEach(b => b.onclick = () => { talentAst = +b.dataset.tast; talentFokus = null; letzteSig = ""; render(); });
    document.querySelectorAll("[data-tknoten]").forEach(b => {
      b.onclick = () => {
        const id = b.dataset.tknoten, h = ich();
        if (talentFokus === id && h.punkte && V.talentWaehlbar(h, id)) { lernen(id); return; }
        talentFokus = id; talentAst = V.AESTE[h.rolle].findIndex(a => a.knoten.includes(id)); letzteSig = ""; render();
        const z = document.querySelector(`[data-talent="${id}"]`); if (z) z.scrollIntoView({ block: "nearest", behavior: "smooth" });
      };
      b.onkeydown = ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); b.onclick(); } };
    });
    if ($("kartenklapp")) $("kartenklapp").ontoggle = e => { karteOffen = e.target.open; };
    if ($("umverteilen")) $("umverteilen").onclick = () => tun({ t: "umverteilen", nr: S.spielNr });
    if ($("fertig")) $("fertig").onclick = () => tun({ t: "fertig", wert: !S.lager.fertig[PID], nr: S.spielNr });
    if ($("auto")) $("auto").onclick = () => tun({ t: "auto" });
    // Kampf
    const waehlen = (a, ziel) => { auswahl = null; tun({ t: "wahl", runde: S.kampf.runde, a, ziel }); letzteSig = ""; render(); };
    document.querySelectorAll("[data-aktion]").forEach(b => b.onclick = () => {
      const a = V.aktionenVon(ich()).find(x => x.id === b.dataset.aktion);
      if (!a) return;
      if (!a.ziel) { waehlen(a.id, null); return; }
      const lebendeGegner = V.gegnerLebend(S);
      if (a.ziel === "gegner" && lebendeGegner.length === 1) { waehlen(a.id, lebendeGegner[0].id); return; }
      const andere = S.teilnehmer.filter(p => p !== PID && S.helden[p].hp > 0);
      if (a.ziel === "anderer" && andere.length === 1) { waehlen(a.id, andere[0]); return; }
      auswahl = a; letzteSig = ""; render();
    });
    document.querySelectorAll("[data-ziel]").forEach(b => b.onclick = () => { if (auswahl) waehlen(auswahl.id, b.dataset.ziel); });
    if ($("abbrechen")) $("abbrechen").onclick = () => { auswahl = null; letzteSig = ""; render(); };
    if ($("aendern")) $("aendern").onclick = () => { tun({ t: "wahl", runde: S.kampf.runde, a: null }); letzteSig = ""; render(); };
  }
  function kopieren() {
    const b = document.getElementById("kopieren");
    const fertig = () => { if (b) { b.textContent = "Kopiert"; setTimeout(() => { b.textContent = "Link kopieren"; }, 1500); } };
    try { navigator.clipboard.writeText(link()).then(fertig, () => prompt("Link kopieren:", link())); } catch (e) { prompt("Link kopieren:", link()); }
  }

  // ---------- Start ----------
  if (typeof Peer === "undefined") { app.innerHTML = `<div class="mitte"><p>Die Verbindungsbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.</p></div>`; return; }
  if (code) {
    const gespeichert = ls.get("vl:host:" + code);
    if (gespeichert) fortsetzenAlsHost(gespeichert);
    else if (name) clientStarten();
    else render();
  } else render();
  window.__vl = { get S() { return S; }, get rolle() { return rolle; }, get verbunden() { return verbunden; }, PID, tun: TEST ? tun : undefined };
})();
