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

  // Titelbild: erschrockene Haselnuss rutscht übers Glatteis auf eine Pfandflasche zu, Kronkorken mit Buchstaben
  const TITELBILD = '<svg class="titelbild" viewBox="0 0 320 150" role="img" aria-label="Eine erschrockene Haselnuss rutscht übers Glatteis auf eine Pfandflasche zu, daneben Kronkorken mit Buchstaben"><rect x="2" y="2" width="316" height="146" rx="20" fill="#CDEBF7"/><ellipse cx="150" cy="124" rx="132" ry="18" fill="#EEF9FE" stroke="#2A1A12" stroke-width="2.2"/><path d="M40 122l26-6M118 130l30-5M196 126l24-5" stroke="#9ED8F0" stroke-width="3.2" stroke-linecap="round"/><path d="M30 94h26M22 106h30M36 82h18" stroke="#2A1A12" stroke-width="2.6" stroke-linecap="round" opacity=".35"/><g transform="translate(92 94) rotate(-18) scale(1.05)"><path d="M0 -26c14 0 24 12 22 28-2 14-11 24-22 24S-20 16-22 2C-24-14-14-26 0-26z" fill="#C98A4B" stroke="#2A1A12" stroke-width="2.4"/><path d="M-21-6c2-14 10-20 21-20s19 6 21 20c-12 5-30 5-42 0z" fill="#8A5328" stroke="#2A1A12" stroke-width="2.4" stroke-linejoin="round"/><path d="M-14-12l4 4M-5-16l3 5M5-16l-2 5M14-12l-4 4" stroke="#5E3618" stroke-width="1.8" stroke-linecap="round"/><path d="M0-26l3-8" stroke="#2A1A12" stroke-width="2.6" stroke-linecap="round"/><circle cx="-7" cy="5" r="2.6" fill="#2A1A12"/><circle cx="7" cy="5" r="2.6" fill="#2A1A12"/><ellipse cx="0" cy="14" rx="3.2" ry="4" fill="#2A1A12"/><path d="M-12-1l-4-3M12-1l4-3" stroke="#2A1A12" stroke-width="1.8" stroke-linecap="round"/></g><g transform="translate(232 96) rotate(8)"><path d="M-9-62h18v16c0 8 13 12 13 26v62a8 8 0 0 1-8 8h-28a8 8 0 0 1-8-8v-62c0-14 13-18 13-26z" fill="#3FA56B" stroke="#2A1A12" stroke-width="2.6" stroke-linejoin="round"/><path d="M-15-6v44" stroke="#9BE0B6" stroke-width="4" stroke-linecap="round" opacity=".8"/><rect x="-22" y="0" width="44" height="28" rx="3" fill="#FFFDF7" stroke="#2A1A12" stroke-width="2.2"/><g transform="translate(-10 3) scale(.75)"><path d="M-9 14a9 9 0 1 1 3 6.7" fill="none" stroke="#2F8F5B" stroke-width="2.6" stroke-linecap="round"/><path d="M-9.5 21.5l3.6-1.2-1-3.8" fill="none" stroke="#2F8F5B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g><text x="9" y="17.5" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="7" fill="#2A1A12">25ct</text><rect x="-10" y="-68" width="20" height="8" rx="2" fill="#2A1A12"/></g><g transform="rotate(-12 150 42)"><polygon points="167.0,42.0 164.5,44.2 166.2,47.0 163.2,48.3 164.0,51.6 160.7,51.9 160.6,55.3 157.3,54.7 156.2,57.8 153.3,56.3 151.3,59.0 148.9,56.6 146.2,58.6 144.7,55.6 141.5,56.7 140.9,53.4 137.5,53.6 137.9,50.2 134.7,49.4 136.0,46.3 133.2,44.5 135.4,42.0 133.2,39.5 136.0,37.7 134.7,34.6 137.9,33.8 137.5,30.4 140.9,30.6 141.5,27.3 144.7,28.4 146.2,25.4 148.9,27.4 151.3,25.0 153.3,27.7 156.2,26.2 157.3,29.3 160.6,28.7 160.7,32.1 164.0,32.4 163.2,35.7 166.2,37.0 164.5,39.8" fill="#1F6B42" stroke="#2A1A12" stroke-width="2.2" stroke-linejoin="round"/><circle cx="150" cy="42" r="12.6" fill="#2F8F5B"/><text x="150" y="48.4" text-anchor="middle" font-family="Unbounded,Segoe UI,system-ui,sans-serif" font-weight="800" font-size="17.9" fill="#FFFDF7">G</text></g><g transform="rotate(14 286 40)"><polygon points="300.0,40.0 297.9,41.8 299.4,44.1 296.8,45.2 297.6,47.9 294.8,48.2 294.7,50.9 292.0,50.4 291.1,53.0 288.7,51.7 287.0,54.0 285.1,52.0 282.9,53.6 281.6,51.2 279.0,52.1 278.5,49.4 275.7,49.5 276.1,46.8 273.4,46.1 274.5,43.5 272.2,42.1 274.0,40.0 272.2,37.9 274.5,36.5 273.4,33.9 276.1,33.2 275.7,30.5 278.5,30.6 279.0,27.9 281.6,28.8 282.9,26.4 285.1,28.0 287.0,26.0 288.7,28.3 291.1,27.0 292.0,29.6 294.7,29.1 294.8,31.8 297.6,32.1 296.8,34.8 299.4,35.9 297.9,38.2" fill="#8A5328" stroke="#2A1A12" stroke-width="2.2" stroke-linejoin="round"/><circle cx="286" cy="40" r="10.4" fill="#C98A4B"/><text x="286" y="45.3" text-anchor="middle" font-family="Unbounded,Segoe UI,system-ui,sans-serif" font-weight="800" font-size="14.7" fill="#FFFDF7">N</text></g><g transform="rotate(-30 176 118)"><polygon points="187.0,118.0 185.4,119.4 186.5,121.2 184.5,122.1 185.1,124.2 182.9,124.4 182.9,126.6 180.7,126.2 180.0,128.2 178.1,127.2 176.8,129.0 175.3,127.4 173.6,128.7 172.5,126.8 170.5,127.5 170.1,125.4 167.9,125.5 168.2,123.3 166.1,122.8 167.0,120.8 165.1,119.6 166.5,118.0 165.1,116.4 167.0,115.2 166.1,113.2 168.2,112.7 167.9,110.5 170.1,110.6 170.5,108.5 172.5,109.2 173.6,107.3 175.3,108.6 176.8,107.0 178.1,108.8 180.0,107.8 180.7,109.8 182.9,109.4 182.9,111.6 185.1,111.8 184.5,113.9 186.5,114.8 185.4,116.6" fill="#B24A1C" stroke="#2A1A12" stroke-width="1.8" stroke-linejoin="round"/><circle cx="176" cy="118" r="8.1" fill="#E8692E"/><text x="176" y="122.2" text-anchor="middle" font-family="Unbounded,Segoe UI,system-ui,sans-serif" font-weight="800" font-size="11.6" fill="#FFFDF7">P</text></g><path d="M118 64l8-9M128 72l11-5" stroke="#2A1A12" stroke-width="2.4" stroke-linecap="round"/></svg>';
  // Der gezogene Buchstabe sitzt auf einem Kronkorken
  const KRONKORKEN = '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="100.0,50.0 92.5,56.4 97.8,64.7 88.7,68.7 91.3,78.2 81.5,79.2 81.2,89.1 71.5,87.2 68.3,96.5 59.6,91.9 53.7,99.9 46.8,92.9 38.9,98.7 34.3,90.0 25.0,93.3 23.2,83.6 13.3,84.0 14.5,74.2 5.0,71.7 8.9,62.7 0.6,57.5 7.0,50.0 0.6,42.5 8.9,37.3 5.0,28.3 14.5,25.8 13.3,16.0 23.2,16.4 25.0,6.7 34.3,10.0 38.9,1.3 46.8,7.1 53.7,0.1 59.6,8.1 68.3,3.5 71.5,12.8 81.2,10.9 81.5,20.8 91.3,21.8 88.7,31.3 97.8,35.3 92.5,43.6" fill="#1F6B42" stroke="#2A1A12" stroke-width="2.5" stroke-linejoin="round"/><circle cx="50" cy="50" r="37" fill="#2F8F5B"/><circle cx="50" cy="50" r="37" fill="none" stroke="#9BE0B6" stroke-width="2" stroke-dasharray="3 5" opacity=".7"/></svg>';
  function bildschirmStart() {
    return `<header class="titel">${TITELBILD}<h1 class="wortmarke"><span class="w1">Glatt,</span> <span class="w2">Pfand,</span> <span class="w3">Nuss</span></h1><p class="leise">Stadt, Land, Fluss mit Überraschung: ein Buchstabe, fünf gemischte Kategorien, jeder auf seinem Handy.</p></header>
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
    return `<header class="titel">${TITELBILD}<h1 class="wortmarke"><span class="w1">Glatt,</span> <span class="w2">Pfand,</span> <span class="w3">Nuss</span></h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
      <button class="knopf" id="mitspielen">Mitspielen</button>`;
  }
  function bildschirmLobby() {
    const host = rolle === "host", n = S.reihenfolge.filter(p => S.spieler[p]).length;
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
    return `<header class="titel"><p class="etikett">Glatt, Pfand, Nuss · Raumcode</p><div class="code">${esc(code)}</div></header>
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
    return `<div class="spielkopf"><div class="buchstabe" role="img" aria-label="Buchstabe ${esc(S.buchstabe)}">${KRONKORKEN}<span>${esc(S.buchstabe)}</span></div>
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
    if ($("teilen")) $("teilen").onclick = () => { if (navigator.share) navigator.share({ title: "Glatt, Pfand, Nuss", text: "Spiel mit! Raum " + code, url: link() }).catch(() => {}); else kopieren(); };
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
