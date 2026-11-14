// Mau-Mau: Verbindung (Handy des Spielleiters ist der Server, PeerJS) und Oberfläche.
// Handkarten gehen nur an ihren Besitzer; alle anderen sehen nur die Anzahl.
(function () {
  const M = window.MM, HZ = window.HOLZ;
  const app = document.getElementById("app");
  const PREFIX = "fmwmm-";
  const ZEICHEN = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
  const PEER_OPT = window.SPIELEABEND_PEER ? window.SPIELEABEND_PEER() : { debug: 0 };   // TURN-Server siehe ../netz.js
  const params = new URLSearchParams(location.search);
  const T = params.get("test") ? "-" + params.get("test") : "";
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k + T)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k + T, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k + T); } catch (e) {} }
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const FARBNAME = { kreuz: "Kreuz", pik: "Pik", herz: "Herz", karo: "Karo" };
  const WERTNAME = { B: "Bube", D: "Dame", K: "König", A: "Ass" };

  let PID = ls.get("slf:pid"); if (!PID) { PID = Math.random().toString(36).slice(2, 10); ls.set("slf:pid", PID); }
  let name = ls.get("slf:name") || "";
  let code = (params.get("raum") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  let rolle = null, S = null, H = M.leerH(), hand = [], peer = null, hostConn = null, verbunden = false, offlineSeit = null, fehlerText = "";
  const conns = new Map();
  let retryTimer = null, token = 0, versuch = 0, wunschFuer = null, hinweis = "", hinweisTimer = null, auswahl = null;

  const hostId = ep => PREFIX + code + "-" + ep;
  const link = () => location.origin + location.pathname + "?raum=" + code;
  const testTeil = () => (params.get("test") ? "&test=" + params.get("test") : "");

  // ---------- Karten zeichnen (zwischengespeichert) ----------
  const svgCache = {};
  function kartenSvg(k) { const { f, w } = M.teile(k); const key = f + w; return svgCache[key] || (svgCache[key] = HZ.karte(f, w)); }
  let rueckSvg = null;
  const rueck = () => rueckSvg || (rueckSvg = HZ.rueckseite("schwarz"));
  const sortiert = h => h.slice().sort((a, b) => { const x = M.teile(a), y = M.teile(b); return M.FARBEN.indexOf(x.f) - M.FARBEN.indexOf(y.f) || M.WERTE.indexOf(x.w) - M.WERTE.indexOf(y.w); });
  const kartenText = k => { const { f, w } = M.teile(k); return FARBNAME[f] + " " + (WERTNAME[w] || w); };

  // ---------- Bildschirm wach halten ----------
  let wake = null;
  async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wachHalten(); if (rolle === "client" && !hostConn) verbindeZumHost(); } });
  document.addEventListener("click", wachHalten);

  // ---------- Spielleiter ----------
  function speichernHost() { ls.set("mm:host:" + code, { S, H }); }
  function hostStarten(z) {
    rolle = "host"; S = z.S; H = z.H || M.leerH(); S.host = PID;
    if (S.spieler[PID]) S.spieler[PID].name = name || S.spieler[PID].name;
    speichernHost(); oeffneHostPeer();
    // nach Übernahme ohne geheime Karten: Runde neu geben
    if (S.phase === "spiel" && !Object.keys(H.hand || {}).length) { const r = M.aktion(S, H, PID, { t: "neustartRunde" }); if (r.ok) { S = r.S; H = r.H; } }
    geaendert();
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
    const r = M.aktion(S, H, m.pid, m);
    if (r.ok) { S = r.S; H = r.H; }
    else if (m.t !== "hallo") { try { c.send({ t: "fehler", text: r.fehler }); } catch (e) {} }
    geaendert();
  }
  function geaendert() {
    S.online = [PID].concat([...conns.keys()]);
    hand = (H.hand && H.hand[PID]) || [];
    speichernHost();
    for (const [p, c] of conns) { try { c.send({ t: "zustand", s: S }); c.send({ t: "hand", nr: S.spielNr, runde: S.runde, karten: (H.hand && H.hand[p]) || [] }); } catch (e) {} }
    render();
  }

  // ---------- Mitspieler ----------
  function clientStarten() {
    rolle = "client";
    const k = ls.get("mm:kopie:" + code); if (k) { S = k.S; hand = k.hand || []; }
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
    const t = ++token, basis = S ? S.epoch : 0, ep = basis + (versuch % 2);
    const c = peer.connect(hostId(ep), { serialization: "json", reliable: true });
    c.on("open", () => {
      if (t !== token) { try { c.close(); } catch (e) {} return; }
      hostConn = c; versuch = 0; verbunden = true; offlineSeit = null; fehlerText = "";
      c.send({ t: "hallo", pid: PID, name }); render();
    });
    c.on("data", m => {
      if (!m) return;
      if (m.t === "zustand") { S = m.s; ls.set("mm:kopie:" + code, { S, hand }); render(); }
      else if (m.t === "hand") { if (!S || m.nr === S.spielNr) { hand = m.karten; ls.set("mm:kopie:" + code, { S, hand }); render(); } }
      else if (m.t === "fehler") zeigeHinweis(m.text);
    });
    c.on("close", () => { if (hostConn === c) { hostConn = null; verloren(); } });
    c.on("error", () => {});
    retryTimer = setTimeout(() => { if (t === token && hostConn !== c) { try { c.close(); } catch (e) {} fehlschlag(t); } }, window.SPIELEABEND_WARTEN || 12000);
  }
  function fehlschlag(t) {
    if (t !== token) return;
    token++; versuch++;
    if (!offlineSeit) offlineSeit = Date.now();
    verbunden = false; render();
    clearTimeout(retryTimer); retryTimer = setTimeout(verbindeZumHost, 2000);
  }
  function verloren() { verbunden = false; hostConn = null; if (!offlineSeit) offlineSeit = Date.now(); render(); fehlschlag(token); }
  function uebernehmen() {
    if (!S) return;
    const s = JSON.parse(JSON.stringify(S)); s.epoch += 1;
    ls.del("mm:kopie:" + code); clearTimeout(retryTimer); token++;
    if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
    hostStarten({ S: s, H: M.leerH() });
  }
  function fortsetzenAlsHost(gespeichert) {
    rolle = "pruefen"; render();
    const probe = new Peer(undefined, PEER_OPT); let fertig = false;
    const ende = alsClient => {
      if (fertig) return; fertig = true; try { probe.destroy(); } catch (e) {}
      if (alsClient) { ls.del("mm:host:" + code); ls.set("mm:kopie:" + code, { S: gespeichert.S, hand: [] }); clientStarten(); }
      else hostStarten(gespeichert);
    };
    probe.on("open", () => { const c = probe.connect(hostId(gespeichert.S.epoch + 1), { serialization: "json" }); c.on("open", () => ende(true)); });
    probe.on("error", () => ende(false));
    setTimeout(() => ende(false), 4000);
  }

  // ---------- Aktionen ----------
  function tun(m) {
    if (rolle === "host") { const r = M.aktion(S, H, PID, m); if (r.ok) { S = r.S; H = r.H; geaendert(); } else zeigeHinweis(r.fehler); }
    else if (hostConn && hostConn.open) { try { hostConn.send(Object.assign({ pid: PID }, m)); } catch (e) {} }
    else zeigeHinweis("Keine Verbindung zum Spielleiter.");
  }
  function zeigeHinweis(t) { hinweis = t; render(); clearTimeout(hinweisTimer); hinweisTimer = setTimeout(() => { hinweis = ""; render(); }, 2500); }
  function neuesSpiel(runden) {
    code = Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
    history.replaceState(null, "", "?raum=" + code + testTeil());
    hostStarten({ S: M.neu(code, PID, name, { runden }), H: M.leerH() });
  }
  function verlassen() { ls.del("mm:host:" + code); ls.del("mm:kopie:" + code); location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : ""); }
  // Tippen wählt eine Karte aus (hebt sie an, ohne zu verraten, ob sie passt), nochmal Tippen wählt ab. Gelegt wird nur mit „Legen“.
  function karteTippen(k) {
    if (!S || S.phase !== "spiel") return;
    auswahl = auswahl === k ? null : k; render();   // Tippen wählt aus bzw. wieder ab; gelegt wird nur über „Legen“
  }
  function legen() {
    const k = auswahl; if (!k || S.dran !== PID) return;
    auswahl = null;
    if (M.teile(k).w === "B" && M.erlaubt(S, k)) { wunschFuer = k; render(); return; }
    tun({ t: "legen", karte: k }); render();
  }

  // ---------- Oberfläche ----------
  const sp = p => (S && S.spieler[p]) || { name: "?", punkte: 0 };
  const online = p => !!(S && S.online && S.online.includes(p));
  const symbol = (f, cls) => `<svg viewBox="0 0 20 20" class="${cls || "sym"}" aria-hidden="true">${window.FIGUREN2.SYM[f]}</svg>`;
  function statusZeile() {
    if (rolle === "host") return verbunden ? "" : (fehlerText || "Raum wird geöffnet …");
    if (rolle === "client" && !verbunden) return S ? "Verbindung zum Spielleiter weg, verbinde neu …" : (fehlerText || "Verbinde mit Raum " + code + " …");
    return "";
  }
  function render() {
    const st = statusZeile(), ueb = rolle === "client" && S && offlineSeit && Date.now() - offlineSeit > 20000;
    let h = `<div class="status" ${st ? "" : "hidden"}><span>${esc(st)}</span>${ueb ? `<button class="klein" id="uebernehmen">Spielleitung übernehmen</button>` : ""}</div>`;
    if (!rolle) h += code ? bildschirmName() : bildschirmStart();
    else if (rolle === "pruefen" || !S) h += `<div class="mitte"><p class="leise">Verbinde …</p></div>`;
    else h += ({ lobby: bildschirmLobby, spiel: bildschirmSpiel, rundenende: bildschirmRundenende, ende: bildschirmEnde }[S.phase] || (() => ""))();
    if (hinweis) h += `<div class="toast" role="status">${esc(hinweis)}</div>`;
    if (wunschFuer) h += `<div class="modal"><div class="modalbox"><h2>Welche Farbe wünschst du dir?</h2><div class="wunschwahl">${M.FARBEN.map(f => `<button data-wunsch="${f}" class="${f === "herz" || f === "karo" ? "rot" : ""}">${symbol(f, "sym gross")}<span>${FARBNAME[f]}</span></button>`).join("")}</div><button class="link" id="wunschzurueck">Abbrechen</button></div></div>`;
    const scrollHand = document.querySelector(".handscroll"); const sx = scrollHand ? scrollHand.scrollLeft : 0;
    app.innerHTML = h;
    binden();
    const neu = document.querySelector(".handscroll"); if (neu) neu.scrollLeft = sx;
    handAnpassen();
  }
  // Die Hand nutzt den freien Platz unter dem Tisch: Kartenbreite aus der verbleibenden Bildschirmhöhe
  let kartenBreite = 76;
  const HEBEN = .3;                            // ausgewählte Karte wird um 30 % der Kartenbreite angehoben (nicht vergrößert)
  const handHoehe = kw => Math.round(kw * (1.4 + HEBEN) + 10);
  function handAnpassen() {
    const hand = document.querySelector(".hand"); if (!hand) return;
    const ohneHand = document.body.offsetHeight - hand.offsetHeight;   // body: Inhaltshöhe (das html-Element ist mindestens so hoch wie der Bildschirm)
    const frei = window.innerHeight - ohneHand;
    const kw = Math.round(Math.max(76, Math.min(150, (frei - 10) / (1.4 + HEBEN))));
    if (Math.abs(kw - kartenBreite) < 3) return;
    kartenBreite = kw; render();
  }
  setInterval(() => { if (rolle === "client" && offlineSeit) render(); }, 5000);

  // Banner: Kartenfächer aus dem Holzschnitt-Blatt auf grünem Filz, daneben der Stapel und ein „Mau!“
  let bannerSvg = null;
  function titelbild() {
    if (bannerSvg) return bannerSvg;
    const karte = (svg, x, y, w, dreh, tief = 0) => `<g transform="rotate(${dreh} ${x + w / 2} ${y + w * 1.4 + tief})">${svg.replace(/^<svg class="karte"/, `<svg x="${x}" y="${y}" width="${w}" height="${(w * 1.4).toFixed(1)}"`)}</g>`;
    const r = HZ.rueckseite("schwarz");
    const facher = [["kreuz", "7", -24], ["pik", "8", -12], ["herz", "B", 0], ["karo", "A", 12], ["herz", "D", 24]]
      .map(([f, w, d]) => karte(HZ.karte(f, w), 136, 34, 60, d * .8, 60)).join("");
    return (bannerSvg = `<svg class="titelbild" viewBox="0 0 320 150" role="img" aria-label="Kartenfächer mit Bube, Ass und Dame auf grünem Tisch">
      <defs><radialGradient id="bn-filz" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#2A8A60"/><stop offset="1" stop-color="#1A5C40"/></radialGradient></defs>
      <rect x="2" y="2" width="316" height="146" rx="20" fill="url(#bn-filz)"/>
      ${karte(r, 34, 46, 50, -8)}${karte(r, 38, 42, 50, -4)}${karte(r, 42, 38, 50, 0)}
      ${facher}
      <g transform="rotate(8 268 40)"><path d="M232 18h70a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10h-36l-14 12 2-12h-22a10 10 0 0 1-10-10V28a10 10 0 0 1 10-10z" fill="#FF6B5B" stroke="#1C1A33" stroke-width="2.5" stroke-linejoin="round"/>
        <text x="267" y="47" text-anchor="middle" font-family="Unbounded,Segoe UI,system-ui,sans-serif" font-weight="800" font-size="19" fill="#1C1A33">Mau!</text></g>
    </svg>`);
  }
  function bildschirmStart() {
    return `<header class="titel">${titelbild()}<h1>Mau-Mau</h1><p class="leise">Mit dem Holzschnitt-Blatt. Jeder hat seine Karten auf dem eigenen Handy.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
      <div class="karte-box"><h2>Neues Spiel</h2>
        <div class="wahl" id="wRunden">${[3, 5, 8].map(r => `<button data-v="${r}" class="${r === 5 ? "an" : ""}">${r} Runden</button>`).join("")}</div>
        <button class="knopf" id="neu">Raum erstellen</button></div>
      <div class="karte-box"><h2>Mitspielen</h2>
        <label class="feld">Raumcode<input id="code" maxlength="4" autocapitalize="characters" placeholder="z. B. K7M2"></label>
        <button class="knopf zweit" id="beitreten">Beitreten</button></div>
      <a class="link" href="../">Alle Spiele</a>`;
  }
  function bildschirmName() {
    return `<header class="titel">${titelbild()}<h1>Mau-Mau</h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
      <button class="knopf" id="mitspielen">Mitspielen</button>`;
  }
  function bildschirmLobby() {
    const host = rolle === "host", da = S.reihenfolge.filter(p => S.spieler[p] && online(p));
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
    return `<header class="titel"><p class="etikett">Mau-Mau · Raumcode</p><div class="code">${esc(code)}</div></header>
      ${qr ? `<div class="qr">${qr}</div>` : ""}
      <div class="reihe"><button class="knopf zweit" id="teilen">Link teilen</button><button class="knopf zweit" id="kopieren">Link kopieren</button></div>
      <div class="karte-box"><h2>Im Raum (${da.length})</h2><ul class="spieler">${S.reihenfolge.filter(p => S.spieler[p]).map(p => `<li><i class="punkt ${online(p) ? "an" : ""}"></i>${esc(sp(p).name)}${p === S.host ? " <small>Spielleiter</small>" : ""}${p === PID ? " <small>du</small>" : ""}</li>`).join("")}</ul></div>
      <div class="karte-box"><h2>Regeln</h2>
        <ul class="regeln"><li><b>7:</b> Der Nächste zieht 2. Wer selbst eine 7 hat, gibt weiter.</li><li><b>8:</b> Der Nächste setzt aus.</li>
        <li><b>Bube:</b> passt auf alles außer auf einen Buben. Du wünschst dir eine Farbe.</li><li><b>Ass:</b> ${S.regeln.ass ? "Du bist gleich noch einmal dran." : "keine Sonderregel"}</li>
        <li><b>Mau:</b> Wer nur noch eine Karte hat, muss vorher „Mau“ getippt haben. Merkt das jemand und tippt bei dir „Erwischt?“, ziehst du 2. Zu frühes Mau (mehr als 2 Karten) kostet 1 Strafkarte, falscher Alarm beim Erwischen auch.</li>
        <li><b>Falsche Karte:</b> ${S.regeln.strafe === false ? "wird einfach nicht angenommen." : "Wer eine unpassende Karte legt, nimmt sie zurück und zieht 1 Strafkarte."}</li>
        <li><b>Legen:</b> Karte antippen, dann „Legen“. Nochmal antippen wählt sie wieder ab.</li>
        <li><b>Punkte:</b> Wer fertig ist, bekommt 0. Alle anderen bekommen Minuspunkte für ihre Karten (Ass 11, Bilder und 10 je 10, sonst der Wert). Nach ${S.runden} Runden gewinnt, wer die wenigsten hat.</li></ul>
        ${host ? `<div class="wahl" id="wRunden2">${[3, 5, 8].map(r => `<button data-runden="${r}" class="${r === S.runden ? "an" : ""}">${r} Runden</button>`).join("")}</div>
          <label class="schalter"><input type="checkbox" id="assregel" ${S.regeln.ass ? "checked" : ""}> Ass: nochmal dran</label>
          <label class="schalter"><input type="checkbox" id="strafregel" ${S.regeln.strafe === false ? "" : "checked"}> Strafkarte für falsche Karte</label>` : ""}</div>
      ${host ? `<div class="unten"><button class="knopf" id="start" ${da.length < 2 ? "disabled" : ""}>${da.length < 2 ? "Warte auf Mitspieler …" : "Spiel starten"}</button></div>`
        : `<p class="leise mitte">Warte, bis ${esc(sp(S.host).name)} das Spiel startet.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }
  function handHtml(meinZug) {
    const karten = sortiert(hand), n = karten.length;
    if (!n) return `<p class="leise mitte">Keine Karten.</p>`;
    const breite = Math.min(app.clientWidth || 340, 520), nutzbar = breite - 24;
    // so groß, wie die Höhe erlaubt, aber nur so breit, dass alle Karten ohne Wischen nebeneinander passen
    const kw = Math.round(Math.max(76, Math.min(kartenBreite, nutzbar / (1 + .3 * (n - 1)))));
    // Abstand zwischen den Karten: mindestens so viel, dass Wert und Farbe in der Ecke lesbar bleiben
    const minSchritt = Math.round(kw * .3);
    let schritt = n > 1 ? Math.min(kw * .58, (nutzbar - kw) / (n - 1)) : 0, scroll = false;
    if (n > 1 && schritt < minSchritt) { schritt = minSchritt; scroll = true; }
    const gesamt = kw + schritt * (n - 1), start = scroll ? 4 : (breite - gesamt) / 2, dreh = scroll ? 0 : Math.min(2, 12 / Math.max(n, 1));
    if (auswahl && !karten.includes(auswahl)) auswahl = null;
    return `<div class="handscroll${scroll ? " scroll" : ""}"><div class="hand" style="width:${scroll ? gesamt + 8 : breite}px;height:${handHoehe(kartenBreite)}px;--kw:${kw}px">${karten.map((k, j) =>
      `<button class="handkarte${k === auswahl ? " gewaehlt" : ""}" data-karte="${k}" aria-pressed="${k === auswahl}" aria-label="${esc(kartenText(k))}"
        style="left:${(start + j * schritt).toFixed(1)}px;transform:rotate(${((j - (n - 1) / 2) * dreh).toFixed(1)}deg)">${kartenSvg(k)}</button>`).join("")}</div></div>`;
  }
  function bildschirmSpiel() {
    if (!S.teilnehmer.includes(PID)) return `<header class="titel"><h2>Hier läuft gerade eine Runde</h2><p class="leise">${esc(S.meldung)}</p><p class="leise">Ab dem nächsten Spiel bist du dabei.</p></header>`;
    const meinZug = S.dran === PID, i = S.teilnehmer.indexOf(PID), n = S.teilnehmer.length;
    const andere = Array.from({ length: n - 1 }, (_, k) => S.teilnehmer[(i + 1 + k) % n]);
    const gegner = andere.map(p => `<div class="gegner ${p === S.dran ? "dran" : ""} ${online(p) ? "" : "weg"}"><b>${esc(sp(p).name)}</b>
        <span class="anz"><i class="mini"></i>${S.anzahl[p] || 0}${S.mau[p] ? ` <em class="maubadge">Mau</em>` : ""}</span>
        <small>${p === S.dran ? "ist dran" : online(p) ? "" : "nicht verbunden"}</small>
        <button class="erwischt" data-erwischt="${p}" aria-label="Erwischt: ${esc(sp(p).name)} hat nicht Mau gesagt">Erwischt?</button></div>`).join("");
    const erwischen = "", meinMau = "";
    const dranOffline = rolle === "host" && S.dran !== PID && !online(S.dran);
    return `<div class="gegnerreihe">${gegner}</div>
      <p class="meldung">${esc(S.meldung)}</p>
      <div class="tisch">
        <button class="stapel" id="stapel" ${meinZug && (!S.gezogen || S.zieh > 0) ? "" : "disabled"} aria-label="Ziehstapel, ${S.stapelAnzahl} Karten">${rueck()}<span>${S.stapelAnzahl}</span></button>
        <div class="ablage">${S.oben ? kartenSvg(S.oben) : ""}
          ${S.wunsch ? `<div class="wunsch ${S.wunsch === "herz" || S.wunsch === "karo" ? "rot" : ""}">Wunsch ${symbol(S.wunsch)}</div>` : ""}
          ${S.zieh > 0 ? `<div class="zieh">+${S.zieh}</div>` : ""}</div>
      </div>
      ${erwischen}${meinMau}
      <p class="zug ${meinZug ? "du" : ""}">${meinZug ? (S.zieh > 0 ? `Du bist dran. Auf dem Tisch liegt +${S.zieh}.` : S.gezogen ? "Du hast gezogen. Legen oder „Weiter“." : "Du bist dran.") : esc(sp(S.dran).name) + " ist dran."}</p>
      ${handHtml(meinZug)}
      <div class="unten knoepfe">
        ${meinZug && S.gezogen && !S.zieh ? `<button class="knopf zweit" id="weiter">Weiter</button>`
          : `<button class="knopf zweit" id="ziehen" ${meinZug ? "" : "disabled"}>${S.zieh > 0 && meinZug ? S.zieh + " ziehen" : "Ziehen"}</button>`}
        ${meinZug && auswahl ? `<button class="knopf" id="legen">Legen</button>` : ""}
        <button class="knopf mau" id="mau" ${S.mau[PID] ? "disabled" : ""}>${S.mau[PID] ? "Mau gesagt" : "Mau!"}</button>
      </div>
      ${dranOffline ? `<button class="link" id="auslassen">${esc(sp(S.dran).name)} ist nicht verbunden: auslassen</button>` : ""}`;
  }
  function tabelle(minus) {
    const rang = S.teilnehmer.slice().sort((a, b) => sp(a).punkte - sp(b).punkte);
    return `<ol class="rang">${rang.map((p, i) => `<li><span class="platz">${i + 1}</span><span class="n">${esc(sp(p).name)}</span>${minus ? `<span class="plus">${minus[p] ? "−" + minus[p] : "0"}</span>` : ""}<b>${sp(p).punkte}</b></li>`).join("")}</ol>`;
  }
  function restkarten() {
    const e = S.ergebnis; if (!e) return "";
    return S.teilnehmer.filter(p => e.haende[p] && e.haende[p].length).map(p => `<div class="rest"><small>${esc(sp(p).name)}</small><div class="restkarten">${sortiert(e.haende[p]).map(k => `<span class="restkarte">${kartenSvg(k)}</span>`).join("")}</div></div>`).join("");
  }
  function bildschirmRundenende() {
    return `<header class="titel"><p class="etikett">Runde ${S.runde} von ${S.runden}</p><h1>Mau-Mau!</h1><p class="leise">${esc(sp(S.ergebnis.gewinner).name)} ist zuerst fertig. Minuspunkte gesamt, wenig ist gut:</p></header>
      ${tabelle(S.ergebnis.minus)}${restkarten()}
      ${rolle === "host" ? `<div class="unten"><button class="knopf" id="start">Nächste Runde</button></div>` : `<p class="leise mitte">Gleich geht es weiter.</p>`}`;
  }
  function bildschirmEnde() {
    const rang = S.teilnehmer.slice().sort((a, b) => sp(a).punkte - sp(b).punkte);
    return `<header class="titel"><p class="etikett">Endstand nach ${S.runden} Runden</p><h1>${esc(sp(rang[0]).name)} gewinnt</h1></header>${tabelle(S.ergebnis && S.ergebnis.minus)}${restkarten()}
      ${rolle === "host" ? `<div class="unten"><button class="knopf" id="nochmal">Nochmal spielen</button></div>` : ""}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }

  function binden() {
    const $ = id => document.getElementById(id);
    const nameAus = () => { const n = ($("name").value || "").trim().slice(0, 20); if (!n) { $("name").focus(); return null; } name = n; ls.set("slf:name", n); return n; };
    if ($("uebernehmen")) $("uebernehmen").onclick = uebernehmen;
    document.querySelectorAll("#wRunden button").forEach(b => b.onclick = () => { document.querySelectorAll("#wRunden button").forEach(x => x.classList.remove("an")); b.classList.add("an"); });
    if ($("neu")) $("neu").onclick = () => { if (nameAus()) neuesSpiel(+document.querySelector("#wRunden .an").dataset.v); };
    if ($("beitreten")) $("beitreten").onclick = () => {
      if (!nameAus()) return;
      const c = ($("code").value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.length !== 4) { $("code").focus(); return; }
      code = c; history.replaceState(null, "", "?raum=" + code + testTeil()); clientStarten();
    };
    if ($("mitspielen")) $("mitspielen").onclick = () => { if (nameAus()) clientStarten(); };
    if ($("teilen")) $("teilen").onclick = () => { if (navigator.share) navigator.share({ title: "Mau-Mau", text: "Spiel mit! Raum " + code, url: link() }).catch(() => {}); else kopieren(); };
    if ($("kopieren")) $("kopieren").onclick = kopieren;
    document.querySelectorAll("[data-runden]").forEach(b => b.onclick = () => tun({ t: "einstellungen", runden: +b.dataset.runden }));
    if ($("assregel")) $("assregel").onchange = () => tun({ t: "einstellungen", ass: $("assregel").checked });
    const starten = () => tun({ t: "start", teilnehmer: S.reihenfolge.filter(p => S.spieler[p] && online(p)) });
    if ($("start")) $("start").onclick = starten;
    if ($("nochmal")) $("nochmal").onclick = starten;
    if ($("verlassen")) $("verlassen").onclick = verlassen;
    if ($("stapel")) $("stapel").onclick = () => { auswahl = null; tun({ t: "ziehen" }); };
    if ($("ziehen")) $("ziehen").onclick = () => { auswahl = null; tun({ t: "ziehen" }); };
    if ($("weiter")) $("weiter").onclick = () => { auswahl = null; tun({ t: "weiter" }); };
    if ($("legen")) $("legen").onclick = legen;
    if ($("strafregel")) $("strafregel").onchange = () => tun({ t: "einstellungen", strafe: $("strafregel").checked });
    if ($("mau")) $("mau").onclick = () => tun({ t: "mau" });
    if ($("auslassen")) $("auslassen").onclick = () => tun({ t: "auslassen", ziel: S.dran });
    document.querySelectorAll("[data-karte]").forEach(b => b.onclick = () => karteTippen(b.dataset.karte));
    document.querySelectorAll("[data-erwischt]").forEach(b => b.onclick = () => tun({ t: "erwischt", ziel: b.dataset.erwischt }));
    document.querySelectorAll("[data-wunsch]").forEach(b => b.onclick = () => { const k = wunschFuer; wunschFuer = null; tun({ t: "legen", karte: k, wunsch: b.dataset.wunsch }); render(); });
    if ($("wunschzurueck")) $("wunschzurueck").onclick = () => { wunschFuer = null; render(); };
  }
  function kopieren() {
    const b = document.getElementById("kopieren");
    const fertig = () => { if (b) { b.textContent = "Kopiert"; setTimeout(() => { b.textContent = "Link kopieren"; }, 1500); } };
    try { navigator.clipboard.writeText(link()).then(fertig, () => prompt("Link kopieren:", link())); } catch (e) { prompt("Link kopieren:", link()); }
  }
  window.addEventListener("resize", () => { if (S && S.phase === "spiel") render(); });

  // ---------- Start ----------
  if (typeof Peer === "undefined") { app.innerHTML = `<div class="mitte"><p>Die Verbindungsbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.</p></div>`; return; }
  if (code) {
    const gespeichert = ls.get("mm:host:" + code);
    if (gespeichert) fortsetzenAlsHost(gespeichert);
    else if (name) clientStarten();
    else render();
  } else render();
  window.__mm = { get S() { return S; }, get H() { return H; }, get hand() { return hand; }, get rolle() { return rolle; }, get verbunden() { return verbunden; }, PID, tun: params.get("test") ? tun : undefined };
})();
