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
  function balken(hp, max) {
    const q = max ? hp / max : 0;
    return `<div class="balken ${q <= 0.3 ? "knapp" : q <= 0.6 ? "mittel" : ""}"><i style="width:${Math.max(0, Math.round(q * 100))}%"></i></div>`;
  }
  function fortschritt() {
    let h = "";
    const hier = S.entscheidung && S.entscheidung.art === "tuer" ? S.raumNr + 1 : S.raumNr;
    for (let i = 1; i <= V.RAEUME; i++) h += `<i class="${i < hier ? "da" : i === hier ? "hier" : ""} ${i === V.RAEUME ? "boss" : ""}"></i>`;
    return `<div class="kopf"><div class="fortschritt" aria-label="Raum ${S.raumNr} von ${V.RAEUME}">${h}</div><span class="gold">${S.gold} Gold</span></div>`;
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
    return [S.phase, S.spielNr, S.aenderung, auswahl ? auswahl.id : ""].join(":");
  }
  let letzteRunde = "";
  function render() {
    // wechselt die Runde (oder das Spiel), ist eine halb gewählte Aktion hinfällig
    const r = S && S.kampf ? S.spielNr + ":" + S.kampf.runde : "";
    if (r !== letzteRunde) { letzteRunde = r; auswahl = null; }
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

  function baue() {
    let h = `<div class="status" id="status" hidden><span></span><button id="uebernehmen" hidden>Spielleitung übernehmen</button></div>`;
    if (!rolle) h += code ? bildschirmName() : bildschirmStart();
    else if (rolle === "pruefen" || !S) h += `<div class="mitte"><p class="leise">Verbinde …</p></div>`;
    else h += ({ lobby: bildschirmLobby, erkunden: bildschirmErkunden, kampf: bildschirmKampf, ende: bildschirmEnde }[S.phase] || (() => ""))();
    const y = window.scrollY;
    app.innerHTML = h;
    window.scrollTo(0, y);
    binden();
  }

  function bildschirmStart() {
    return `<header class="titel"><h1>Verlies zu dritt</h1><p class="leise">Kämpfer, Dieb und Heilerin steigen gemeinsam hinab. Acht Räume, ein Knochenkönig. Jeder spielt auf seinem Handy, gewonnen wird zusammen.</p></header>
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
    return `<div class="rollen">${V.ROLLEN_REIHE.map(r => {
      const R = V.ROLLEN[r];
      const wer = Object.keys(S.rollen).find(p => S.rollen[p] === r && S.spieler[p] && (online(p) || p === PID));
      const meins = wer === PID, belegt = wer && !meins;
      const fk = V.AKTIONEN[r].map(a => a.name).join(" · ");
      return `<button class="rolle ${meins ? "meins" : ""} ${belegt ? "belegt" : ""}" data-rolle="${r}" ${belegt ? "disabled" : ""}>
        ${VB.held(r)}<b>${R.name}</b><small>${R.hp} Leben · ${fk}</small>
        <span class="wer">${meins ? "Das bist du ✓" : belegt ? esc(sp(wer).name) : "frei"}</span></button>`;
    }).join("")}</div>`;
  }
  function startbereit() {
    const da = Object.keys(S.rollen).filter(p => S.spieler[p] && online(p));
    return da.length >= (TEST ? 1 : 2);
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
      <div class="karte"><h2>Wähle deine Rolle</h2>${rollenKarten()}
        ${ohneRolle.length ? `<p class="leise klein">Noch ohne Rolle: ${ohneRolle.map(p => esc(sp(p).name)).join(", ")}${leute.length > 3 ? ". Wer keine Rolle hat, schaut zu." : ""}</p>` : ""}</div>
      <div class="karte"><h3>So geht's</h3><p class="leise klein">Vor jedem Raum stimmt ihr ab, welche Tür ihr nehmt. Im Kampf wählt jeder in Ruhe seinen Zug, ausgeführt wird, wenn alle gewählt haben. Bewusstlose kann die Heilerin zurückholen. Wenn alle fallen, ist das Spiel verloren.</p></div>
      ${host ? `<div class="unten"><button class="knopf" id="start" ${startbereit() ? "" : "disabled"}>${startbereit() ? "Abstieg beginnen" : "Mindestens 2 brauchen eine Rolle …"}</button></div>`
        : `<p class="leise mitte">Warte, bis ${esc(sp(S.host).name)} das Spiel startet.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }

  // eine Zeile je Held; im Kampf mit Zustandsmarken und als Ziel antippbar
  function heldZeile(p, imKampf, ziel) {
    const x = S.helden[p], k = S.kampf;
    const marken = imKampf ? [x.hp <= 0 ? `<span class="marke">bewusstlos</span>` : "", x.giftR > 0 && x.hp > 0 ? `<span class="marke gift">vergiftet</span>` : "",
      x.lauer ? `<span class="marke schatten">lauert</span>` : "", x.segen ? `<span class="marke">gesegnet</span>` : "",
      k && k.wahl[p] ? `<span class="marke ok">bereit</span>` : ""].join("") : "";
    const unter = `${V.ROLLEN[x.rolle].name}${online(p) ? "" : " · nicht verbunden"}${imKampf ? "" : ` · ${x.traenke} ${x.traenke === 1 ? "Trank" : "Tränke"}`}`;
    return `<button class="heldzeile ${x.hp <= 0 && !ziel ? "weg" : ""} ${ziel ? "ziel" : ""}" ${ziel ? `data-ziel="${p}"` : "disabled"}>
      ${VB.held(x.rolle)}<span class="mitte-sp"><span class="kopfzeile"><b>${esc(sp(p).name)}</b><small>${unter}</small></span>${balken(x.hp, x.max)}${marken ? `<span class="marken">${marken}</span>` : ""}</span>
      <span class="hp">${x.hp}<small>/${x.max}</small></span></button>`;
  }
  function heldenLeiste(imKampf, ziel) { return `<div class="heldenliste">${S.teilnehmer.map(p => heldZeile(p, imKampf, ziel)).join("")}</div>`; }

  function bildschirmErkunden() {
    const e = S.entscheidung;
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
    h += `<h3>Gruppe</h3>${heldenLeiste(false, false)}`;
    return h;
  }

  function bildschirmKampf() {
    const k = S.kampf, mh = ich(), lebt = mh && mh.hp > 0;
    const meineWahl = k.wahl[PID];
    const zielModus = auswahl && auswahl.ziel;
    let h = fortschritt();
    h += `<div class="kopf"><h2>${esc(S.seite.titel)} · Runde ${k.runde}</h2></div>`;
    if (k.runde === 1 && S.seite) h += `<div class="chronik"><p>${esc(S.seite.text[0])}</p></div>`;
    // Gegner
    h += `<div class="reihe-k">${S.gegner.map(g => {
      const ziel = zielModus === "gegner" && g.hp > 0;
      return `<button class="figur ${g.hp <= 0 ? "weg" : ""} ${ziel ? "ziel" : ""}" ${ziel ? `data-ziel="${g.id}"` : "disabled"} aria-label="${esc(g.name)}">
        ${VB.bild(g.art, "kbild")}<b>${esc(g.name)}</b>${balken(g.hp, g.max)}<span class="zahl">${g.hp <= 0 ? "besiegt" : g.hp + " / " + g.max}</span>
        <span class="marken">${g.giftR > 0 && g.hp > 0 ? `<span class="marke gift">Gift ${g.giftR}</span>` : ""}</span></button>`;
    }).join("")}</div>`;
    // Was zuletzt geschah
    if (S.log && S.log.length) h += `<div class="chronik"><p class="etikett">Runde ${k.runde - 1}</p>${S.log.map(t => `<p>${esc(t)}</p>`).join("")}</div>`;
    // Helden
    h += `<h3>Gruppe</h3>${heldenLeiste(true, zielModus === "held")}`;
    // Eigene Wahl
    if (!mitspieler()) h += `<p class="leise mitte">Du schaust zu.</p>`;
    else if (!lebt) h += `<div class="hinweis">Du bist bewusstlos. Nur die Heilerin kann dich zurückholen.</div>`;
    else if (meineWahl && !auswahl) {
      const a = V.aktionenVon(mh).find(x => x.id === meineWahl.a) || { name: meineWahl.a };
      const zn = meineWahl.ziel ? (S.gegner.find(g => g.id === meineWahl.ziel) || {}).name || sp(meineWahl.ziel).name : "";
      h += `<div class="karte"><p class="etikett">Dein Zug</p><h2>${esc(a.name)}${zn ? " → " + esc(zn) : ""}</h2><button class="knopf zweit" id="aendern">Ändern</button></div>`;
    } else {
      if (zielModus) h += `<div class="hinweis">${esc(auswahl.name)}: Tippe oben auf ${zielModus === "gegner" ? "einen Gegner" : "einen Helden"}.</div>`;
      h += `<p class="etikett">Dein Zug</p><div class="aktionen">${V.aktionenVon(mh).map(a => {
        const cd = a.cd ? (mh.cd[a.id] || 0) : 0;
        return `<button class="aktion ${auswahl && auswahl.id === a.id ? "an" : ""}" data-aktion="${a.id}" ${cd ? "disabled" : ""}><b>${esc(a.name)}${a.id === "trank" ? ` (${mh.traenke})` : ""}</b><small>${cd ? `Wieder bereit in ${cd} ${cd === 1 ? "Runde" : "Runden"}` : esc(a.text)}</small></button>`;
      }).join("")}</div>
      ${auswahl ? `<button class="link" id="abbrechen">Abbrechen</button>` : ""}`;
    }
    const fehlen = V.lebend(S).filter(p => !k.wahl[p]);
    if (fehlen.length) h += `<p class="leise klein mitte">Warte auf: ${fehlen.map(p => esc(sp(p).name)).join(", ")}</p>`;
    if (rolle === "host" && fehlen.some(p => !online(p))) h += `<button class="link" id="auto">Für nicht Verbundene automatisch ziehen</button>`;
    return h;
  }

  function bildschirmEnde() {
    const sieg = S.ergebnis === "sieg";
    return `<p class="etikett mitte">${sieg ? "Sieg" : "Niederlage"} · Raum ${S.raumNr} von ${V.RAEUME}</p>${buchseite(S.seite)}
      <div class="karte"><h2>${S.gold} Gold erbeutet</h2>
        <table class="werte"><tr><th>Held</th><th>Schaden</th><th>Geheilt</th><th>K.&nbsp;o.</th></tr>
        ${S.teilnehmer.map(p => { const x = S.helden[p]; return `<tr><td>${esc(sp(p).name)} <span class="leise klein">${V.ROLLEN[x.rolle].name}</span></td><td>${x.stats.schaden}</td><td>${x.stats.geheilt}</td><td>${x.stats.umgefallen}</td></tr>`; }).join("")}</table></div>
      ${rolle === "host" ? `<div class="unten"><button class="knopf" id="nochmal">Nochmal hinab</button><button class="knopf zweit" id="lobby">Rollen neu wählen</button></div>` : `<p class="leise mitte">${esc(sp(S.host).name)} kann eine neue Runde starten.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }

  function binden() {
    const $ = id => document.getElementById(id);
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
    if ($("verlassen")) $("verlassen").onclick = verlassen;
    document.querySelectorAll("[data-stimme]").forEach(b => b.onclick = () => tun({ t: "stimme", i: +b.dataset.stimme, nr: S.spielNr }));
    if ($("beenden")) $("beenden").onclick = () => tun({ t: "beenden" });
    if ($("auto")) $("auto").onclick = () => tun({ t: "auto" });
    // Kampf
    const waehlen = (a, ziel) => { auswahl = null; tun({ t: "wahl", runde: S.kampf.runde, a, ziel }); letzteSig = ""; render(); };
    document.querySelectorAll("[data-aktion]").forEach(b => b.onclick = () => {
      const a = V.aktionenVon(ich()).find(x => x.id === b.dataset.aktion);
      if (!a) return;
      if (!a.ziel) { waehlen(a.id, null); return; }
      const lebendeGegner = V.gegnerLebend(S);
      if (a.ziel === "gegner" && lebendeGegner.length === 1) { waehlen(a.id, lebendeGegner[0].id); return; }
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
