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
    // Ring um den Buchstaben leert sich mit der Zeit; nach STOPP zählt er die letzten Sekunden
    const ring = document.getElementById("uhrrest"), uhrEl = document.getElementById("uhr");
    if (ring && S.rest != null) {
      const gesamt = S.phase === "stopp" ? (L.STOPP_SEKUNDEN || 10) : S.rundenzeit, anteil = Math.max(0, Math.min(1, S.rest / gesamt));
      ring.style.strokeDashoffset = String(100 - anteil * 100);
      uhrEl.classList.toggle("knapp", S.phase === "stopp" || S.rest <= 30);
    }
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

  // Titelbild: Spielzettel auf Karopapier (Blatt | Strand | Nuss), Kronkorken mit Buchstabe, Stoppuhr
  const TITELBILD = '<svg class="titelbild" viewBox="0 0 320 150" role="img" aria-label="Ein Spielzettel auf Karopapier mit den Spalten Blatt, Strand und Nuss, ein Kronkorken mit dem Buchstaben E und eine Stoppuhr"><defs><pattern id="karo" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="#BFD6EC" stroke-width=".8"/></pattern></defs><rect x="2" y="2" width="316" height="146" rx="20" fill="#CDEBF7"/><g transform="rotate(-2.5 136 78)"><rect x="22" y="16" width="228" height="124" rx="3" fill="#FFFFFF" stroke="#2A1A12" stroke-width="2.4"/><rect x="23.2" y="17.2" width="225.6" height="121.6" fill="url(#karo)"/><circle cx="36" cy="16" r="3" fill="#CDEBF7" stroke="#2A1A12" stroke-width="1.6"/><circle cx="56" cy="16" r="3" fill="#CDEBF7" stroke="#2A1A12" stroke-width="1.6"/><circle cx="76" cy="16" r="3" fill="#CDEBF7" stroke="#2A1A12" stroke-width="1.6"/><circle cx="96" cy="16" r="3" fill="#CDEBF7" stroke="#2A1A12" stroke-width="1.6"/><circle cx="116" cy="16" r="3" fill="#CDEBF7" stroke="#2A1A12" stroke-width="1.6"/><circle cx="136" cy="16" r="3" fill="#CDEBF7" stroke="#2A1A12" stroke-width="1.6"/><circle cx="156" cy="16" r="3" fill="#CDEBF7" stroke="#2A1A12" stroke-width="1.6"/><circle cx="176" cy="16" r="3" fill="#CDEBF7" stroke="#2A1A12" stroke-width="1.6"/><circle cx="196" cy="16" r="3" fill="#CDEBF7" stroke="#2A1A12" stroke-width="1.6"/><circle cx="216" cy="16" r="3" fill="#CDEBF7" stroke="#2A1A12" stroke-width="1.6"/><circle cx="236" cy="16" r="3" fill="#CDEBF7" stroke="#2A1A12" stroke-width="1.6"/><path d="M28 50 H244" stroke="#2B4FA8" stroke-width="2" stroke-linecap="round"/><path d="M48 28 V132" stroke="#2B4FA8" stroke-width="1.8" stroke-linecap="round"/><path d="M112 28 V132" stroke="#2B4FA8" stroke-width="1.8" stroke-linecap="round"/><path d="M180 28 V132" stroke="#2B4FA8" stroke-width="1.8" stroke-linecap="round"/><text x="80.0" y="45" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="700" font-size="19">Blatt</text><text x="146.0" y="45" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="700" font-size="19">Strand</text><text x="213.0" y="45" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="700" font-size="19">Nuss</text><circle cx="37" cy="67" r="8" fill="none" stroke="#2B4FA8" stroke-width="1.5"/><text x="37" y="72" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="700" font-size="16">K</text><text x="80.0" y="72" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="600" font-size="15">Klee</text><text x="146.0" y="72" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="600" font-size="15">Krabbe</text><text x="213.0" y="72" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="600" font-size="15">Kokos</text><circle cx="37" cy="92" r="8" fill="none" stroke="#2B4FA8" stroke-width="1.5"/><text x="37" y="97" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="700" font-size="16">M</text><text x="80.0" y="97" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="600" font-size="15">Minze</text><text x="146.0" y="97" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="600" font-size="15">Muschel</text><text x="213.0" y="97" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="600" font-size="13.5">Macadamia</text><circle cx="37" cy="117" r="8" fill="none" stroke="#2B4FA8" stroke-width="1.5"/><text x="37" y="122" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="700" font-size="16">E</text><text x="80.0" y="122" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="600" font-size="15">Efeu</text><text x="146.0" y="122" text-anchor="middle" font-family="Caveat,Segoe Print,cursive" fill="#2B4FA8" font-weight="600" font-size="15">Eim</text></g><g transform="rotate(70 165.5 122)" stroke="#2A1A12" stroke-width="2" stroke-linejoin="round"><rect x="160" y="74" width="11" height="38" rx="2" fill="#2B4FA8"/><rect x="160" y="74" width="11" height="8" fill="#FFFDF7"/><path d="M160 112h11l-5.5 10z" fill="#F3E6CC"/><path d="M164.3 118h2.4l-1.2 4z" fill="#2A1A12" stroke="none"/><rect x="169" y="70" width="3" height="16" rx="1.5" fill="#9AA8C8"/></g><g transform="rotate(10 284 46)"><polygon points="308.0,46.0 304.4,49.1 306.9,53.1 302.6,55.0 303.8,59.5 299.1,60.0 299.0,64.8 294.3,63.9 292.8,68.3 288.6,66.1 285.8,69.9 282.5,66.6 278.7,69.4 276.5,65.2 272.0,66.8 271.1,62.1 266.4,62.3 266.9,57.6 262.4,56.4 264.3,52.1 260.3,49.6 263.4,46.0 260.3,42.4 264.3,39.9 262.4,35.6 266.9,34.4 266.4,29.7 271.1,29.9 272.0,25.2 276.5,26.8 278.7,22.6 282.5,25.4 285.8,22.1 288.6,25.9 292.8,23.7 294.3,28.1 299.0,27.2 299.1,32.0 303.8,32.5 302.6,37.0 306.9,38.9 304.4,42.9" fill="#1F6B42" stroke="#2A1A12" stroke-width="2.2" stroke-linejoin="round"/><circle cx="284" cy="46" r="17.8" fill="#2F8F5B"/><text x="284" y="55.1" text-anchor="middle" font-family="Unbounded,Segoe UI,system-ui,sans-serif" font-weight="800" font-size="25.2" fill="#FFFDF7">E</text></g><g><rect x="275" y="81" width="10" height="6" rx="1.5" fill="#2A1A12"/><rect x="277.5" y="86" width="5" height="5" fill="#2A1A12"/><circle cx="280" cy="112" r="22" fill="#FFFDF7" stroke="#2A1A12" stroke-width="3"/><path d="M280 112V94A18 18 0 0 1 296.9 118.2z" fill="#E8692E" opacity=".55"/><line x1="280.0" y1="92.0" x2="280.0" y2="96.0" stroke="#2A1A12" stroke-width="1.6" stroke-linecap="round"/><line x1="290.0" y1="94.7" x2="288.0" y2="98.1" stroke="#2A1A12" stroke-width="1.6" stroke-linecap="round"/><line x1="297.3" y1="102.0" x2="293.9" y2="104.0" stroke="#2A1A12" stroke-width="1.6" stroke-linecap="round"/><line x1="300.0" y1="112.0" x2="296.0" y2="112.0" stroke="#2A1A12" stroke-width="1.6" stroke-linecap="round"/><line x1="297.3" y1="122.0" x2="293.9" y2="120.0" stroke="#2A1A12" stroke-width="1.6" stroke-linecap="round"/><line x1="290.0" y1="129.3" x2="288.0" y2="125.9" stroke="#2A1A12" stroke-width="1.6" stroke-linecap="round"/><line x1="280.0" y1="132.0" x2="280.0" y2="128.0" stroke="#2A1A12" stroke-width="1.6" stroke-linecap="round"/><line x1="270.0" y1="129.3" x2="272.0" y2="125.9" stroke="#2A1A12" stroke-width="1.6" stroke-linecap="round"/><line x1="262.7" y1="122.0" x2="266.1" y2="120.0" stroke="#2A1A12" stroke-width="1.6" stroke-linecap="round"/><line x1="260.0" y1="112.0" x2="264.0" y2="112.0" stroke="#2A1A12" stroke-width="1.6" stroke-linecap="round"/><line x1="262.7" y1="102.0" x2="266.1" y2="104.0" stroke="#2A1A12" stroke-width="1.6" stroke-linecap="round"/><line x1="270.0" y1="94.7" x2="272.0" y2="98.1" stroke="#2A1A12" stroke-width="1.6" stroke-linecap="round"/><line x1="280" y1="112" x2="294.1" y2="117.1" stroke="#2A1A12" stroke-width="2.4" stroke-linecap="round"/><circle cx="280" cy="112" r="2.4" fill="#2A1A12"/></g></svg>';
  // Der gezogene Buchstabe sitzt auf einem Kronkorken
  const KRONKORKEN = '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="100.0,50.0 92.5,56.4 97.8,64.7 88.7,68.7 91.3,78.2 81.5,79.2 81.2,89.1 71.5,87.2 68.3,96.5 59.6,91.9 53.7,99.9 46.8,92.9 38.9,98.7 34.3,90.0 25.0,93.3 23.2,83.6 13.3,84.0 14.5,74.2 5.0,71.7 8.9,62.7 0.6,57.5 7.0,50.0 0.6,42.5 8.9,37.3 5.0,28.3 14.5,25.8 13.3,16.0 23.2,16.4 25.0,6.7 34.3,10.0 38.9,1.3 46.8,7.1 53.7,0.1 59.6,8.1 68.3,3.5 71.5,12.8 81.2,10.9 81.5,20.8 91.3,21.8 88.7,31.3 97.8,35.3 92.5,43.6" fill="#1F6B42" stroke="#2A1A12" stroke-width="2.5" stroke-linejoin="round"/><circle cx="50" cy="50" r="37" fill="#2F8F5B"/><circle cx="50" cy="50" r="37" fill="none" stroke="#9BE0B6" stroke-width="2" stroke-dasharray="3 5" opacity=".7"/></svg>';
  function bildschirmStart() {
    return `<header class="titel">${TITELBILD}<h1 class="wortmarke"><span class="w1">Blatt,</span> <span class="w2">Strand,</span> <span class="w3">Nuss</span></h1><p class="leise">Stadt, Land, Fluss mit Überraschung: ein Buchstabe, fünf gemischte Kategorien, jeder auf seinem Handy.</p></header>
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
    return `<header class="titel">${TITELBILD}<h1 class="wortmarke"><span class="w1">Blatt,</span> <span class="w2">Strand,</span> <span class="w3">Nuss</span></h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
      <button class="knopf" id="mitspielen">Mitspielen</button>`;
  }
  function bildschirmLobby() {
    const host = rolle === "host", n = S.reihenfolge.filter(p => S.spieler[p]).length;
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
    return `<header class="titel"><p class="etikett">Blatt, Strand, Nuss · Raumcode</p><div class="code">${esc(code)}</div></header>
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
    return `<div class="spielkopf"><div class="uhr" id="uhr"><svg class="ring" viewBox="0 0 140 140" aria-hidden="true"><circle class="bahn" cx="70" cy="70" r="64"/><circle class="rest" id="uhrrest" cx="70" cy="70" r="64" pathLength="100"/></svg><div class="buchstabe" role="img" aria-label="Buchstabe ${esc(S.buchstabe)}">${KRONKORKEN}<span>${esc(S.buchstabe)}</span></div></div>
        <div><p class="etikett">Runde ${S.runde} von ${S.runden}</p><div class="zeit" id="zeit"></div></div></div>
      <div class="stoppinfo" id="stoppinfo" hidden></div>
      <div class="felder zettel">${S.kategorien.map((k, i) => `<label class="feld">${esc(k)}<input id="w${i}" data-i="${i}" maxlength="80" autocomplete="off" autocapitalize="sentences" value="${esc(meineWerte[i] || "")}" placeholder="${esc(S.buchstabe)} …"></label>`).join("")}</div>
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
      code = c; location.replace("?raum=" + code + (params.get("test") ? "&test=" + params.get("test") : ""));   // neu laden: war ich hier Spielleiter, geht es als Spielleiter weiter
    };
    if ($("mitspielen")) $("mitspielen").onclick = () => { if (nameAus()) clientStarten(); };
    if ($("teilen")) $("teilen").onclick = () => { if (navigator.share) navigator.share({ title: "Blatt, Strand, Nuss", text: "Spiel mit! Raum " + code, url: link() }).catch(() => {}); else kopieren(); };
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
