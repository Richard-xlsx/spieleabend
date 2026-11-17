// Verbindung (PeerJS, Handy des Spielleiters ist der Server) und Oberfläche.
(function () {
  const L = window.SLF;
  const app = document.getElementById("app");
  const PREFIX = "fmwslf-";
  const ZEICHEN = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
  const PEER_OPT = window.SPIELEABEND_PEER ? window.SPIELEABEND_PEER() : { debug: 0 };   // TURN-Server siehe ../netz.js
  const params = new URLSearchParams(location.search);
  const T = params.get("test") ? "-" + params.get("test") : "";          // nur zum Testen mehrerer Spieler im selben Browser
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
  let tickTimer = null, retryTimer = null, token = 0, versuch = 0, sendeTimer = null, letzteSig = "";
  let meineWerte = [];

  const hostId = ep => PREFIX + code + "-" + ep;
  const antwKey = () => "slf:antw:" + code + ":" + (S ? S.runde : 0);
  const link = () => location.origin + location.pathname + "?raum=" + code;
  const leer = () => (S && S.kategorien && S.kategorien.length ? S.kategorien : Array(L.ANZAHL || 5).fill("")).map(() => "");

  // ---------- Bildschirm wach halten ----------
  let wake = null;
  async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wachHalten(); if (rolle === "client" && !hostConn) verbindeZumHost(); } });
  document.addEventListener("click", wachHalten);

  // ---------- Spielleiter ----------
  function speichernHost() { ls.set("slf:host:" + code, S); }
  function hostStarten(zustand) {
    rolle = "host"; S = zustand; S.host = PID;
    if (S.spieler[PID]) S.spieler[PID].name = name || S.spieler[PID].name;
    meineWerte = ls.get(antwKey()) || leer();
    speichernHost(); oeffneHostPeer();
    if (!tickTimer) tickTimer = setInterval(() => { if (rolle === "host") { const n = L.tick(S); if (n !== S) { S = n; geaendert(); } } }, 1000);
    render();
  }
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
    S = L.aktion(S, m.pid, m);
    geaendert();
  }
  function geaendert() {
    S.online = [PID].concat([...conns.keys()]);
    speichernHost();
    for (const c of conns.values()) { try { c.send({ t: "zustand", s: S }); } catch (e) {} }
    render();
  }

  // ---------- Mitspieler ----------
  function clientStarten() {
    rolle = "client";
    S = ls.get("slf:kopie:" + code);
    meineWerte = ls.get(antwKey()) || leer();
    if (peer) { try { peer.destroy(); } catch (e) {} }
    const p = peer = new Peer(undefined, PEER_OPT);
    p.on("open", () => { if (p === peer && !hostConn) verbindeZumHost(); });
    p.on("disconnected", () => { if (p !== peer) return; setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} }, 2000); });
    p.on("error", e => {
      if (p !== peer) return;
      if (e.type === "peer-unavailable") fehlschlag(token);
      else if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) { verloren(); }
    });
    render();
  }
  function verbindeZumHost() {
    if (!peer || peer.destroyed || !peer.open || (hostConn && hostConn.open)) return;
    clearTimeout(retryTimer);
    const t = ++token;
    const basis = S ? S.epoch : 0, ep = basis + (versuch % 2);      // abwechselnd: bisheriger und möglicher neuer Spielleiter
    const c = peer.connect(hostId(ep), { serialization: "json", reliable: true });
    c.on("open", () => {
      if (t !== token) { try { c.close(); } catch (e) {} return; }
      hostConn = c; versuch = 0; verbunden = true; offlineSeit = null; fehlerText = "";
      c.send({ t: "hallo", pid: PID, name, runde: S ? S.runde : 0, werte: meineWerte });
      render();
    });
    c.on("data", m => {
      if (!m || m.t !== "zustand") return;
      const alt = S; S = m.s; ls.set("slf:kopie:" + code, S);
      if (!alt || alt.runde !== S.runde) meineWerte = ls.get(antwKey()) || leer();
      render();
    });
    c.on("close", () => { if (hostConn === c) { hostConn = null; verloren(); } });
    c.on("error", () => {});
    retryTimer = setTimeout(() => { if (t === token && !(hostConn === c)) { try { c.close(); } catch (e) {} fehlschlag(t); } }, window.SPIELEABEND_WARTEN || 12000);
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
    const s = JSON.parse(JSON.stringify(S));
    s.epoch += 1;
    ls.del("slf:kopie:" + code);
    clearTimeout(retryTimer); token++;
    if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
    hostStarten(s);
  }

  // Früherer Spielleiter kommt zurück: Hat inzwischen jemand anderes übernommen, wird er normaler Mitspieler.
  function fortsetzenAlsHost(gespeichert) {
    rolle = "pruefen"; render();
    const probe = new Peer(undefined, PEER_OPT);
    let fertig = false;
    const ende = alsClient => {
      if (fertig) return; fertig = true;
      try { probe.destroy(); } catch (e) {}
      if (alsClient) { ls.del("slf:host:" + code); ls.set("slf:kopie:" + code, gespeichert); clientStarten(); }
      else hostStarten(gespeichert);
    };
    probe.on("open", () => {
      const c = probe.connect(hostId(gespeichert.epoch + 1), { serialization: "json" });
      c.on("open", () => ende(true));
    });
    probe.on("error", () => ende(false));
    setTimeout(() => ende(false), 4000);
  }

  // ---------- Aktionen ----------
  function tun(m) {
    if (rolle === "host") { S = L.aktion(S, PID, m); geaendert(); }
    else if (hostConn && hostConn.open) { try { hostConn.send(Object.assign({ pid: PID }, m)); } catch (e) {} }
  }
  function werteSenden(sofort) {
    ls.set(antwKey(), meineWerte);
    clearTimeout(sendeTimer);
    const f = () => tun({ t: "antwort", runde: S.runde, werte: meineWerte });
    if (sofort) f(); else sendeTimer = setTimeout(f, 350);
  }
  function neuesSpiel(runden, rundenzeit) {
    code = (window.ABEND && ABEND.neuerRaum()) || Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
    history.replaceState(null, "", "?raum=" + code + (params.get("test") ? "&test=" + params.get("test") : ""));
    hostStarten(L.neu(code, PID, name, { runden, rundenzeit }));
  }
  function verlassen() {
    ls.del("slf:host:" + code); ls.del("slf:kopie:" + code);
    location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : "");
  }

  // ---------- Oberfläche ----------
  const sp = p => (S && S.spieler[p]) || { name: "?", punkte: 0 };
  const online = p => !!(S && S.online && S.online.includes(p));
  const zeit = s => s == null ? "" : Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  function rangliste() { return S.reihenfolge.filter(p => S.spieler[p]).sort((a, b) => sp(b).punkte - sp(a).punkte); }

  function sig() {
    if (!rolle) return "start:" + (code ? "name" : "neu");
    if (rolle === "pruefen") return "pruefen";
    if (!S) return "warte";
    const ph = S.phase === "stopp" ? "spielen" : S.phase;
    return [rolle, ph, S.runde, ph === "lobby" || ph === "bewerten" || ph === "rundenende" || ph === "ende" ? S.aenderung : ""].join(":");
  }
  let werteRunde = null;
  function render() {
    if (S && S.runde !== werteRunde) { werteRunde = S.runde; meineWerte = ls.get(antwKey()) || leer(); }
    const s = sig();
    if (s !== letzteSig) { letzteSig = s; baue(); }
    aktualisiere();
  }
  function statusZeile() {
    if (rolle === "host") return verbunden ? "" : (fehlerText || "Raum wird geöffnet …");
    if (rolle === "client" && !verbunden) return S ? "Verbindung zum Spielleiter weg, verbinde neu …" : (fehlerText || (window.ABEND && ABEND.aktiv ? "" : "Verbinde mit Raum " + code + " …"));
    return "";
  }
  function aktualisiere() {
    const st = document.getElementById("status");
    if (st) {
      const t = statusZeile(); st.hidden = !t; st.querySelector("span").textContent = t;
      const ub = st.querySelector("button");
      ub.hidden = !(rolle === "client" && S && offlineSeit && Date.now() - offlineSeit > 20000);
    }
    if (!S) return;
    const z = document.getElementById("zeit"); if (z) z.textContent = S.phase === "stopp" ? S.rest + " s" : zeit(S.rest);
    const so = document.getElementById("stoppinfo");
    if (so) { so.hidden = S.phase !== "stopp"; so.textContent = S.phase === "stopp" ? "STOPP von " + sp(S.stopp).name + "! Noch " + S.rest + " s" : ""; }
    const sb = document.getElementById("stopp");
    if (sb) sb.disabled = S.phase !== "spielen" || meineWerte.some(w => !String(w || "").trim());
    const pl = document.getElementById("spielerliste");
    if (pl) pl.innerHTML = S.reihenfolge.filter(p => S.spieler[p]).map(p => `<li><i class="punkt ${online(p) ? "an" : ""}"></i>${esc(sp(p).name)}${p === S.host ? " <small>Spielleiter</small>" : ""}${p === PID ? " <small>du</small>" : ""}</li>`).join("");
  }
  setInterval(aktualisiere, 1000);

  function kopf() {
    return `<div class="status" id="status" hidden><span></span><button class="klein" id="uebernehmen" hidden>Spielleitung übernehmen</button></div>`;
  }
  function baue() {
    let h = kopf();
    if (!rolle) h += code ? bildschirmName() : bildschirmStart();
    else if (rolle === "pruefen" || !S) h += `<div class="mitte"><p class="leise">${window.ABEND ? ABEND.warten() : "Verbinde …"}</p></div>`;
    else h += ({ lobby: bildschirmLobby, spielen: bildschirmSpiel, stopp: bildschirmSpiel, bewerten: bildschirmBewerten, rundenende: bildschirmRundenende, ende: bildschirmEnde }[S.phase] || (() => ""))();
    app.innerHTML = h;
    binden();
  }

  // Titelbild: Stoppuhr mit Buchstaben, gekreuzte Stifte, fliegende Buchstabenkarten
  const TITELBILD = '<svg class="titelbild" viewBox="0 0 320 150" role="img" aria-label="Stoppuhr mit Buchstaben, gekreuzte Stifte und fliegende Buchstabenkarten"><rect x="2" y="2" width="316" height="146" rx="20" fill="#FFD447"/><line x1="40" y1="40" x2="70" y2="46" stroke="#1C1A33" stroke-width="3" stroke-linecap="round" opacity=".3"/><line x1="30" y1="62" x2="64" y2="64" stroke="#1C1A33" stroke-width="3" stroke-linecap="round" opacity=".3"/><line x1="252" y1="104" x2="286" y2="100" stroke="#1C1A33" stroke-width="3" stroke-linecap="round" opacity=".3"/><line x1="250" y1="40" x2="280" y2="34" stroke="#1C1A33" stroke-width="3" stroke-linecap="round" opacity=".3"/><g transform="rotate(-14 52 104)"><rect x="35.0" y="83.9" width="34" height="40.1" rx="5.4" fill="#7DD3FC" stroke="#1C1A33" stroke-width="2.2"/><text x="52" y="112.2" text-anchor="middle" font-family="Unbounded,Segoe UI,system-ui,sans-serif" font-weight="800" font-size="21.1" fill="#1C1A33">K</text></g><g transform="rotate(10 96 40)"><rect x="81.0" y="22.3" width="30" height="35.4" rx="4.8" fill="#A3E635" stroke="#1C1A33" stroke-width="2.2"/><text x="96" y="47.2" text-anchor="middle" font-family="Unbounded,Segoe UI,system-ui,sans-serif" font-weight="800" font-size="18.6" fill="#1C1A33">A</text></g><g transform="rotate(12 232 70)"><rect x="214.0" y="48.8" width="36" height="42.5" rx="5.8" fill="#F9A8D4" stroke="#1C1A33" stroke-width="2.2"/><text x="232" y="78.6" text-anchor="middle" font-family="Unbounded,Segoe UI,system-ui,sans-serif" font-weight="800" font-size="22.3" fill="#1C1A33">M</text></g><g transform="rotate(-8 270 128)"><rect x="257.0" y="112.7" width="26" height="30.7" rx="4.2" fill="#FDBA74" stroke="#1C1A33" stroke-width="2.2"/><text x="270" y="134.2" text-anchor="middle" font-family="Unbounded,Segoe UI,system-ui,sans-serif" font-weight="800" font-size="16.1" fill="#1C1A33">T</text></g><g transform="rotate(-16 240 26)"><rect x="228.0" y="11.8" width="24" height="28.3" rx="3.8" fill="#C4B5FD" stroke="#1C1A33" stroke-width="2.2"/><text x="240" y="31.8" text-anchor="middle" font-family="Unbounded,Segoe UI,system-ui,sans-serif" font-weight="800" font-size="14.9" fill="#1C1A33">S</text></g><g transform="rotate(-40 160 80)" stroke="#1C1A33" stroke-width="2" stroke-linejoin="round"><rect x="153.5" y="16.0" width="13" height="128" rx="1.5" fill="#FF6B5B"/><rect x="153.5" y="16.0" width="13" height="6" fill="#F9A8D4"/><path d="M153.5 144.0h13l-6.5 9z" fill="#F3E6CC"/><path d="M158.6 149.0h2.8l-1.4 4z" fill="#1C1A33" stroke="none"/></g><g transform="rotate(40 160 80)" stroke="#1C1A33" stroke-width="2" stroke-linejoin="round"><rect x="153.5" y="16.0" width="13" height="128" rx="1.5" fill="#2F6FDE"/><rect x="153.5" y="16.0" width="13" height="6" fill="#F9A8D4"/><path d="M153.5 144.0h13l-6.5 9z" fill="#F3E6CC"/><path d="M158.6 149.0h2.8l-1.4 4z" fill="#1C1A33" stroke="none"/></g><rect x="149.5" y="20.4" width="21.0" height="12.6" rx="3.4" fill="#1C1A33"/><rect x="155.8" y="31.3" width="8.4" height="8.4" fill="#1C1A33"/><rect x="186.0" y="38.8" width="10.9" height="7.6" rx="2.1" fill="#1C1A33" transform="rotate(45 191.5 42.6)"/><circle cx="160" cy="80" r="42" fill="#FFFDF7" stroke="#1C1A33" stroke-width="7.1"/><path d="M160 80V47.2A32.8 32.8 0 0 1 185.1 101.1z" fill="#FF6B5B" opacity=".45"/><line x1="160.0" y1="42.2" x2="160.0" y2="50.6" stroke="#1C1A33" stroke-width="3.4" stroke-linecap="round"/><line x1="178.9" y1="47.3" x2="176.6" y2="51.3" stroke="#1C1A33" stroke-width="3.4" stroke-linecap="round"/><line x1="192.7" y1="61.1" x2="188.7" y2="63.4" stroke="#1C1A33" stroke-width="3.4" stroke-linecap="round"/><line x1="197.8" y1="80.0" x2="189.4" y2="80.0" stroke="#1C1A33" stroke-width="3.4" stroke-linecap="round"/><line x1="192.7" y1="98.9" x2="188.7" y2="96.6" stroke="#1C1A33" stroke-width="3.4" stroke-linecap="round"/><line x1="178.9" y1="112.7" x2="176.6" y2="108.7" stroke="#1C1A33" stroke-width="3.4" stroke-linecap="round"/><line x1="160.0" y1="117.8" x2="160.0" y2="109.4" stroke="#1C1A33" stroke-width="3.4" stroke-linecap="round"/><line x1="141.1" y1="112.7" x2="143.4" y2="108.7" stroke="#1C1A33" stroke-width="3.4" stroke-linecap="round"/><line x1="127.3" y1="98.9" x2="131.3" y2="96.6" stroke="#1C1A33" stroke-width="3.4" stroke-linecap="round"/><line x1="122.2" y1="80.0" x2="130.6" y2="80.0" stroke="#1C1A33" stroke-width="3.4" stroke-linecap="round"/><line x1="127.3" y1="61.1" x2="131.3" y2="63.4" stroke="#1C1A33" stroke-width="3.4" stroke-linecap="round"/><line x1="141.1" y1="47.3" x2="143.4" y2="51.3" stroke="#1C1A33" stroke-width="3.4" stroke-linecap="round"/><text x="160" y="95.1" text-anchor="middle" font-family="Unbounded,Segoe UI,system-ui,sans-serif" font-weight="800" font-size="44.1" fill="#1C1A33">B</text></svg>';
  function bildschirmStart() {
    return `<header class="titel">${TITELBILD}<h1>Buch&shy;staben&shy;battle</h1><p class="leise">Ein Buchstabe, fünf Kategorien, jeder auf seinem Handy.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
      <div class="karte"><h2>Neues Spiel</h2>
        <div class="wahl" id="wRunden">${[3, 5, 8].map(r => `<button data-v="${r}" class="${r === 5 ? "an" : ""}">${r} Runden</button>`).join("")}</div>
        <div class="wahl" id="wZeit">${[120, 180, 240].map(r => `<button data-v="${r}" class="${r === 180 ? "an" : ""}">${r / 60} Min</button>`).join("")}</div>
        <button class="knopf" id="neu">Raum erstellen</button></div>
      <div class="karte"><h2>Mitspielen</h2>
        <label class="feld">Raumcode<input id="code" maxlength="4" autocapitalize="characters" placeholder="z. B. K7M2"></label>
        <button class="knopf zweit" id="beitreten">Beitreten</button></div>
      <a class="link" href="../">Alle Spiele</a>`;
  }
  function bildschirmName() {
    return `<header class="titel">${TITELBILD}<h1>Buch&shy;staben&shy;battle</h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
      <button class="knopf" id="mitspielen">Mitspielen</button>`;
  }
  function bildschirmLobby() {
    const host = rolle === "host", n = S.reihenfolge.filter(p => S.spieler[p]).length;
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
    return `<header class="titel"><p class="etikett">Raumcode</p><div class="code">${esc(code)}</div></header>
      ${qr ? `<div class="qr">${qr}</div>` : ""}
      <div class="reihe"><button class="knopf zweit" id="teilen">Link teilen</button><button class="knopf zweit" id="kopieren">Link kopieren</button></div>
      <div class="karte"><h2>Im Raum (${n})</h2><ul class="spieler" id="spielerliste"></ul></div>
      <div class="karte"><h2>Kategorien</h2><p class="leise">${L.ANZAHL || 5} Überraschungskategorien pro Runde, gelost aus ${L.POOL ? L.POOL.length : "vielen"}. Welche es sind, seht ihr erst mit dem Buchstaben.</p>
        <p class="leise klein">${S.runden} Runden · ${S.rundenzeit / 60} Minuten pro Runde</p></div>
      ${host ? `<div class="unten"><button class="knopf" id="start" ${n < 2 ? "disabled" : ""}>${n < 2 ? "Warte auf Mitspieler …" : "Spiel starten"}</button></div>`
        : `<p class="leise mitte">Warte, bis ${esc(sp(S.host).name)} das Spiel startet.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }
  function bildschirmSpiel() {
    return `<div class="spielkopf"><div class="buchstabe" aria-label="Buchstabe">${esc(S.buchstabe)}</div>
        <div><p class="etikett">Runde ${S.runde} von ${S.runden}</p><div class="zeit" id="zeit"></div></div></div>
      <div class="stoppinfo" id="stoppinfo" hidden></div>
      <div class="felder">${S.kategorien.map((k, i) => `<label class="feld">${esc(k)}<input id="w${i}" data-i="${i}" maxlength="80" autocomplete="off" autocapitalize="sentences" value="${esc(meineWerte[i] || "")}" placeholder="${esc(S.buchstabe)} …"></label>`).join("")}</div>
      <div class="unten"><button class="knopf stopp" id="stopp" disabled>STOPP!</button>
      <p class="leise klein mitte">STOPP geht, wenn alle fünf Felder ausgefüllt sind. Danach haben alle noch ${L.STOPP_SEKUNDEN} Sekunden.</p></div>`;
  }
  function bildschirmBewerten() {
    const vorschau = L.auswerten(S), pids = S.reihenfolge.filter(p => S.spieler[p]);
    const veto = (S.bewertung && S.bewertung.veto) || {}, herz = (S.bewertung && S.bewertung.herz) || {};
    return `<header class="titel"><p class="etikett">Runde ${S.runde} · Buchstabe ${esc(S.buchstabe)}</p><h2>Auswertung</h2>
        <p class="leise klein">👎 bei Quatsch-Antworten. Lehnt die Mehrheit ab, gibt es 0 Punkte. ♥ für deine Lieblingsantwort je Kategorie: Die meisten Herzen geben +5.</p></header>
      ${S.kategorien.map((k, i) => `<div class="karte"><h2>${esc(k)}</h2><ul class="antworten">${pids.map(p => {
        const d = vorschau.det[p][i], ich = p === PID, v = (veto[p + "|" + i] || []).includes(PID), h = herz[PID + "|" + i] === p;
        const marke = d.grund === "falscher Buchstabe" ? `<span class="marke">kein ${esc(S.buchstabe)}</span>` : d.doppelt ? `<span class="marke">doppelt</span>` : "";
        return `<li class="${d.gueltig ? "" : "aus"}"><div class="zeile1"><b>${esc(sp(p).name)}</b>${marke}<span class="pkt">${d.punkte + d.bonus ? "+" + (d.punkte + d.bonus) : "0"}</span></div>
          <div class="text">${d.text ? esc(d.text) : "<i>leer</i>"}</div>
          ${ich || !d.text ? "" : `<div class="knoepfe"><button class="klein ${v ? "an" : ""}" data-veto="${p}|${i}">👎 ${d.veto || ""}</button><button class="klein ${h ? "an" : ""}" data-herz="${p}|${i}">♥ ${d.herz || ""}</button></div>`}</li>`;
      }).join("")}</ul></div>`).join("")}
      ${rolle === "host" ? `<div class="unten"><button class="knopf" id="weiter">Runde abschließen</button></div>` : `<p class="leise mitte">${esc(sp(S.host).name)} schließt die Runde ab, wenn alle bewertet haben.</p>`}`;
  }
  function tabelle(mitRunde) {
    return `<ol class="rang">${rangliste().map((p, i) => `<li><span class="platz">${i + 1}</span><span class="n">${esc(sp(p).name)}</span>${mitRunde && S.ergebnis ? `<span class="plus">+${S.ergebnis.summe[p] || 0}</span>` : ""}<b>${sp(p).punkte}</b></li>`).join("")}</ol>`;
  }
  function bildschirmRundenende() {
    return `<header class="titel"><p class="etikett">Runde ${S.runde} von ${S.runden} vorbei</p><h2>Zwischenstand</h2></header>${tabelle(true)}
      ${rolle === "host" ? `<div class="unten"><button class="knopf" id="start">Nächste Runde</button></div>` : `<p class="leise mitte">Gleich geht es weiter.</p>`}`;
  }
  function bildschirmEnde() {
    const r = rangliste();
    return `<header class="titel"><p class="etikett">Endstand</p><h1>${esc(sp(r[0]).name)} gewinnt</h1></header>${tabelle(true)}
      ${rolle === "host" ? `<div class="unten"><button class="knopf" id="neustart">Nochmal mit allen</button></div>` : ""}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }

  function binden() {
    const $ = id => document.getElementById(id);
    const nameAus = () => { const n = ($("name").value || "").trim().slice(0, 20); if (!n) { $("name").focus(); return null; } name = n; ls.set("slf:name", n); return n; };
    if ($("uebernehmen")) $("uebernehmen").onclick = uebernehmen;
    document.querySelectorAll(".wahl").forEach(w => w.querySelectorAll("button").forEach(b => b.onclick = () => { w.querySelectorAll("button").forEach(x => x.classList.remove("an")); b.classList.add("an"); }));
    if ($("neu")) $("neu").onclick = () => { if (!nameAus()) return; neuesSpiel(+document.querySelector("#wRunden .an").dataset.v, +document.querySelector("#wZeit .an").dataset.v); };
    if ($("beitreten")) $("beitreten").onclick = () => {
      if (!nameAus()) return;
      const c = ($("code").value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.length !== 4) { $("code").focus(); return; }
      code = c; history.replaceState(null, "", "?raum=" + code + (params.get("test") ? "&test=" + params.get("test") : "")); clientStarten();
    };
    if ($("mitspielen")) $("mitspielen").onclick = () => { if (nameAus()) clientStarten(); };
    if ($("teilen")) $("teilen").onclick = () => { if (navigator.share) navigator.share({ title: "Buchstabenbattle", text: "Spiel mit! Raum " + code, url: link() }).catch(() => {}); else kopieren(); };
    if ($("kopieren")) $("kopieren").onclick = kopieren;
    if ($("start")) $("start").onclick = () => tun({ t: "start" });
    if ($("weiter")) $("weiter").onclick = () => tun({ t: "weiter" });
    if ($("neustart")) $("neustart").onclick = () => tun({ t: "neustart" });
    if ($("verlassen")) $("verlassen").onclick = verlassen;
    if ($("stopp")) $("stopp").onclick = () => { werteSenden(true); tun({ t: "stopp", runde: S.runde, werte: meineWerte }); };
    document.querySelectorAll(".felder input").forEach(inp => inp.oninput = () => {
      meineWerte[+inp.dataset.i] = inp.value;
      werteSenden(S.phase === "stopp");
      aktualisiere();
    });
    document.querySelectorAll("[data-veto]").forEach(b => b.onclick = () => { const [z, k] = b.dataset.veto.split("|"); tun({ t: "veto", ziel: z, k: +k }); });
    document.querySelectorAll("[data-herz]").forEach(b => b.onclick = () => { const [z, k] = b.dataset.herz.split("|"); tun({ t: "herz", ziel: z, k: +k }); });
  }
  function kopieren() {
    const b = document.getElementById("kopieren");
    const fertig = () => { if (b) { b.textContent = "Kopiert"; setTimeout(() => { b.textContent = "Link kopieren"; }, 1500); } };
    try { navigator.clipboard.writeText(link()).then(fertig, () => prompt("Link kopieren:", link())); } catch (e) { prompt("Link kopieren:", link()); }
  }

  // ---------- Start ----------
  if (typeof Peer === "undefined") { app.innerHTML = `<div class="mitte"><p>Die Verbindungsbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.</p></div>`; return; }
  if (code) {
    const gespeichert = ls.get("slf:host:" + code);
    if (gespeichert) fortsetzenAlsHost(gespeichert);
    else if (name) clientStarten();
    else render();
  } else render();
  window.__slf = { get S() { return S; }, get rolle() { return rolle; }, get verbunden() { return verbunden; }, PID };   // für Tests
})();
