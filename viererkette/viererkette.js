// Viererkette: Verbindung (Handy des Spielleiters ist der Server, PeerJS) und Oberfläche.
(function () {
  const V = window.VK;
  const app = document.getElementById("app");
  const PREFIX = "fmwvk-";
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
  // Steinfarben in Spielreihenfolge
  // Fünf Steine: jede Farbe hat ihr eigenes Muster, damit man sie auch ohne Farbsehen unterscheidet
  const STEIN = [
    { name: "Koralle", muster: "Punkt", f: "#FF6B57", r: "#9E3326" },
    { name: "Gelb", muster: "Stern", f: "#FFD447", r: "#8F6E0E" },
    { name: "Flieder", muster: "Streifen", f: "#B9A6FF", r: "#5B48B0" },
    { name: "Himmelblau", muster: "Kreuz", f: "#62C6F5", r: "#1E6F99" },
    { name: "Creme", muster: "Raute", f: "#F5EBD6", r: "#7A6A4E" }
  ];
  // Stein n als SVG-Gruppe, Mittelpunkt (cx, cy), Radius rr
  function steinGrafik(n, cx, cy, rr, extra) {
    const t = STEIN[n] || STEIN[0], k = rr / 21, P = (x, y) => `${(cx + x * k).toFixed(1)} ${(cy + y * k).toFixed(1)}`;
    let m = "";
    if (n === 0) m = `<circle cx="${cx}" cy="${cy}" r="${7 * k}" fill="${t.r}"/>`;
    else if (n === 1) m = `<path d="M${[...Array(10)].map((_, i) => { const w = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? 5 : 12; return P(d * Math.cos(w), d * Math.sin(w)); }).join("L")}z" fill="${t.r}"/>`;
    else if (n === 2) m = [-8, 0, 8].map(d => { const h = Math.sqrt(13 * 13 - d * d) / Math.SQRT2, ox = d / Math.SQRT2; return `<path d="M${P(ox - h, -ox - h)}L${P(ox + h, -ox + h)}" stroke="${t.r}" stroke-width="${3.6 * k}" stroke-linecap="round"/>`; }).join("");
    else if (n === 3) m = `<path d="M${P(0, -11)}L${P(0, 11)}M${P(-11, 0)}L${P(11, 0)}" stroke="${t.r}" stroke-width="${5.5 * k}" stroke-linecap="round"/>`;
    else m = `<path d="M${P(0, -12)}L${P(10, 0)}L${P(0, 12)}L${P(-10, 0)}z" fill="${t.r}"/>`;
    return `<g ${extra || ""}><circle cx="${cx}" cy="${cy}" r="${rr}" fill="${t.f}" stroke="${t.r}" stroke-width="${4 * k}"/>${m}</g>`;
  }

  let PID = ls.get("slf:pid"); if (!PID) { PID = Math.random().toString(36).slice(2, 10); ls.set("slf:pid", PID); }
  let name = ls.get("slf:name") || "";
  let code = (params.get("raum") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  let rolle = null, S = null, peer = null, hostConn = null, verbunden = false, offlineSeit = null, fehlerText = "";
  const conns = new Map();
  let retryTimer = null, token = 0, versuch = 0, hinweis = "", hinweisTimer = null, wahl = null, gefallen = "";

  const hostId = ep => PREFIX + code + "-" + ep;
  const link = () => location.origin + location.pathname + "?raum=" + code;
  const testTeil = () => (params.get("test") ? "&test=" + params.get("test") : "");

  // ---------- Bildschirm wach halten ----------
  let wake = null;
  async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wachHalten(); if (rolle === "client" && !hostConn) verbindeZumHost(); } });
  document.addEventListener("click", wachHalten);

  // ---------- Spielleiter ----------
  function speichernHost() { ls.set("vk:host:" + code, S); }
  function hostStarten(s) {
    rolle = "host"; S = s; S.host = PID;
    if (S.spieler[PID]) S.spieler[PID].name = name || S.spieler[PID].name;
    speichernHost(); oeffneHostPeer(); geaendert();
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
    const r = V.aktion(S, m.pid, m);
    if (r.ok) S = r.S;
    else if (m.t !== "hallo") { try { c.send({ t: "fehler", text: r.fehler }); } catch (e) {} }
    geaendert();
  }
  function geaendert() {
    S.online = [PID].concat([...conns.keys()]);
    speichernHost();
    for (const [, c] of conns) { try { c.send({ t: "zustand", s: S }); } catch (e) {} }
    render();
  }

  // ---------- Mitspieler ----------
  function clientStarten() {
    rolle = "client";
    const k = ls.get("vk:kopie:" + code); if (k) S = k;
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
      if (m.t === "zustand") { S = m.s; ls.set("vk:kopie:" + code, S); render(); }
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
    ls.del("vk:kopie:" + code); clearTimeout(retryTimer); token++;
    if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
    hostStarten(s);
  }
  function fortsetzenAlsHost(gespeichert) {
    rolle = "pruefen"; render();
    const probe = new Peer(undefined, PEER_OPT); let fertig = false;
    const ende = alsClient => {
      if (fertig) return; fertig = true; try { probe.destroy(); } catch (e) {}
      if (alsClient) { ls.del("vk:host:" + code); ls.set("vk:kopie:" + code, gespeichert); clientStarten(); }
      else hostStarten(gespeichert);
    };
    probe.on("open", () => { const c = probe.connect(hostId(gespeichert.epoch + 1), { serialization: "json" }); c.on("open", () => ende(true)); });
    probe.on("error", () => ende(false));
    setTimeout(() => ende(false), 4000);
  }

  // ---------- Aktionen ----------
  function tun(m) {
    if (rolle === "host") { const r = V.aktion(S, PID, m); if (r.ok) { S = r.S; geaendert(); } else zeigeHinweis(r.fehler); }
    else if (hostConn && hostConn.open) { try { hostConn.send(Object.assign({ pid: PID }, m)); } catch (e) {} }
    else zeigeHinweis("Keine Verbindung zum Spielleiter.");
  }
  function zeigeHinweis(t) { hinweis = t; render(); clearTimeout(hinweisTimer); hinweisTimer = setTimeout(() => { hinweis = ""; render(); }, 2500); }
  function neuesSpiel() {
    code = Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
    history.replaceState(null, "", "?raum=" + code + testTeil());
    hostStarten(V.neu(code, PID, name));
  }
  function verlassen() { ls.del("vk:host:" + code); ls.del("vk:kopie:" + code); location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : ""); }
  const meinZug = () => S && S.phase === "spiel" && S.teilnehmer[S.dran] === PID;
  // Erster Tipp zeigt den Stein über der Spalte, zweiter Tipp (oder „Einwerfen“) wirft ihn ein
  function spalteTippen(x) {
    if (!meinZug() || !V.spalteFrei(S, x)) return;
    if (wahl !== x) { wahl = x; render(); return; }
    einwerfen();
  }
  function einwerfen() {
    if (wahl === null || !meinZug()) return;
    const x = wahl; wahl = null;
    tun({ t: "setzen", spalte: x, nr: S.spielNr });
  }

  // ---------- Oberfläche ----------
  const sp = p => (S && S.spieler[p]) || { name: "?", siege: 0 };
  const online = p => !!(S && S.online && S.online.includes(p));
  const steinVon = p => { const n = S.stein && S.stein[p]; return n === undefined || n === null ? Math.max(0, S.teilnehmer.indexOf(p)) : n; };
  const stein = (n, gross) => `<svg class="stein${gross ? " gross" : ""}" viewBox="0 0 48 48" aria-hidden="true">${steinGrafik(n, 24, 24, 21)}</svg>`;
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
    else h += S.phase === "lobby" ? bildschirmLobby() : bildschirmSpiel();
    if (hinweis) h += `<div class="toast" role="status">${esc(hinweis)}</div>`;
    app.innerHTML = h;
    binden();
  }
  setInterval(() => { if (rolle === "client" && offlineSeit) render(); }, 5000);

  // Kleines Titelbild: ein Spielbrett mit einer fertigen Reihe
  function titelbild() {
    const B = 7, H = 4, Z = 34, steine = { "1,0": 0, "2,1": 0, "3,2": 0, "4,3": 0, "0,0": 1, "2,0": 3, "3,0": 2, "4,0": 1, "5,0": 4, "3,1": 1, "4,1": 2, "4,2": 3, "1,1": 2, "6,0": 3, "5,1": 4 };
    let s = `<rect x="6" y="20" width="${B * Z + 8}" height="${H * Z + 8}" rx="14" fill="#1F6F64" stroke="#0F3A34" stroke-width="3"/>`;
    for (let x = 0; x < B; x++) for (let y = 0; y < H; y++) {
      const w = steine[x + "," + y], cx = 10 + x * Z + Z / 2, cy = 24 + (H - 1 - y) * Z + Z / 2;
      s += w !== undefined ? steinGrafik(w, cx, cy, 13.5) : `<circle cx="${cx}" cy="${cy}" r="13" fill="#1C1A33"/>`;
    }
    // die schräge Viererreihe in Koralle
    s += `<path d="M${10 + 1.5 * Z} ${24 + 3.5 * Z} L${10 + 4.5 * Z} ${24 + 0.5 * Z}" stroke="#F3F0FF" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 8" opacity=".9"/>`;
    s += steinGrafik(1, 10 + 5.5 * Z, 6, 13.5, 'class="tb-fall"');
    return `<svg class="titelbild" viewBox="0 -14 ${B * Z + 22} ${H * Z + 50}" role="img" aria-label="Spielbrett mit vier Steinen in einer Reihe">${s}</svg>`;
  }
  function bildschirmStart() {
    return `<header class="titel">${titelbild()}<h1>Viererkette</h1><p class="leise">Steine fallen von oben in die Spalten. Wer zuerst vier in einer Reihe hat, waagrecht, senkrecht oder schräg, gewinnt. Zu zweit oder zu dritt, jeder auf seinem Handy.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
      <div class="karte-box"><h2>Neues Spiel</h2><p class="leise klein">Zu zweit auf 7 × 6 Feldern, zu dritt auf einem größeren Brett mit 9 × 7.</p>
        <button class="knopf" id="neu">Raum erstellen</button></div>
      <div class="karte-box"><h2>Mitspielen</h2>
        <label class="feld">Raumcode<input id="code" maxlength="4" autocapitalize="characters" placeholder="z. B. K7M2"></label>
        <button class="knopf zweit" id="beitreten">Beitreten</button></div>
      <a class="link" href="../">Alle Spiele</a>`;
  }
  function bildschirmName() {
    return `<header class="titel"><h1>Viererkette</h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
      <button class="knopf" id="mitspielen">Mitspielen</button>`;
  }
  function bildschirmLobby() {
    const host = rolle === "host", da = S.reihenfolge.filter(p => S.spieler[p] && online(p)), n = Math.min(da.length, V.MAX), f = V.FELD[Math.max(2, n)];
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
    return `<header class="titel"><p class="etikett">Viererkette · Raumcode</p><div class="code">${esc(code)}</div></header>
      ${qr ? `<div class="qr">${qr}</div>` : ""}
      <div class="reihe"><button class="knopf zweit" id="teilen">Link teilen</button><button class="knopf zweit" id="kopieren">Link kopieren</button></div>
      <div class="karte-box"><h2>Im Raum (${da.length})</h2><ul class="spieler">${S.reihenfolge.filter(p => S.spieler[p]).map(p => {
        const i = da.indexOf(p);
        return `<li>${online(p) && S.stein && S.stein[p] !== undefined ? stein(S.stein[p]) : `<i class="punkt ${online(p) ? "an" : ""}"></i>`}${esc(sp(p).name)}${p === S.host ? " <small>Spielleiter</small>" : ""}${p === PID ? " <small>du</small>" : ""}${i >= V.MAX ? " <small>schaut zu</small>" : ""}</li>`; }).join("")}</ul>
        <p class="leise klein">${n >= 3 ? "Zu dritt: großes Brett mit 9 × 7 Feldern." : "Zu zweit: Brett mit 7 × 6 Feldern. Kommt noch jemand dazu, wird es größer."} Höchstens ${V.MAX} spielen, alle weiteren schauen zu.</p></div>
      ${steinWahl()}
      <div class="karte-box"><h2>So geht's</h2><ul class="regeln">
        <li>Wer dran ist, tippt auf eine Spalte. Der Stein schwebt darüber. Noch einmal tippen (oder „Einwerfen“) lässt ihn fallen.</li>
        <li>Wer zuerst <b>vier eigene Steine in einer Reihe</b> hat, waagrecht, senkrecht oder schräg, gewinnt die Runde.</li>
        <li>Ist das Brett voll, endet die Runde unentschieden.</li>
        <li>Jede Runde fängt jemand anderes an.${n >= 3 ? " Zu dritt gilt: Den Nächsten blockieren hilft oft dem Dritten." : ""}</li></ul></div>
      ${host ? `<div class="unten"><button class="knopf" id="start" ${da.length < 2 ? "disabled" : ""}>${da.length < 2 ? "Warte auf Mitspieler …" : `Spiel starten (${f.breite} × ${f.hoehe})`}</button></div>`
        : `<p class="leise mitte">Warte, bis ${esc(sp(S.host).name)} das Spiel startet.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }
  // Jeder wählt seinen Stein; was ein anderer schon hat, ist gesperrt
  function steinWahl() {
    const frei = V.freieSteine(S, PID), mein = S.stein ? S.stein[PID] : undefined;
    const wer = n => Object.keys(S.stein || {}).find(p => p !== PID && S.stein[p] === n && online(p));
    return `<div class="karte-box"><h2>Dein Stein</h2><div class="steinwahl">${STEIN.map((t, n) => {
      const an = mein === n, weg = !an && !frei.includes(n);
      return `<button class="steinknopf ${an ? "an" : ""}" data-stein="${n}" ${weg ? "disabled" : ""} aria-pressed="${an}" aria-label="${t.name} mit ${t.muster}${weg ? ", hat " + esc(sp(wer(n)).name) : ""}">${stein(n, true)}<small>${weg ? esc(sp(wer(n)).name) : t.name}</small></button>`;
    }).join("")}</div><p class="leise klein">Jede Farbe hat ihr eigenes Muster: ${STEIN.map(t => t.name + " " + t.muster).join(", ")}.</p></div>`;
  }
  // Das Brett als SVG: eine Zeile Platz oben für den schwebenden Stein, Spalten zum Antippen
  function brett() {
    const B = S.breite, H = S.hoehe, Z = 50, oben = Z, rand = 8, W = B * Z + 2 * rand, Hh = oben + H * Z + 2 * rand;
    const linie = new Set((S.linie || []).map(([x, y]) => x + "," + y));
    const neuKey = S.spielNr + ":" + S.zuege, fallen = S.letzter && neuKey !== gefallen;
    let s = `<defs><mask id="loecher"><rect x="0" y="${oben}" width="${W}" height="${H * Z + 2 * rand}" fill="#fff"/>`;
    for (let x = 0; x < B; x++) for (let y = 0; y < H; y++) s += `<circle cx="${rand + x * Z + Z / 2}" cy="${oben + rand + (H - 1 - y) * Z + Z / 2}" r="19" fill="#000"/>`;
    s += `</mask></defs>`;
    // Steine (hinter dem Brett, damit sie durch die Löcher schauen)
    for (let x = 0; x < B; x++) for (let y = 0; y < H; y++) {
      const w = S.feld[y * B + x]; if (w === null) continue;
      const n = steinVon(S.teilnehmer[w]), cx = rand + x * Z + Z / 2, cy = oben + rand + (H - 1 - y) * Z + Z / 2;
      const istNeu = fallen && S.letzter.x === x && S.letzter.y === y, aus = S.linie && !linie.has(x + "," + y);
      s += `<g class="${istNeu ? "fall" : ""}" style="${istNeu ? `--h:${cy}px` : ""}" opacity="${aus ? .45 : 1}">${steinGrafik(n, cx, cy, 21)}</g>`;
    }
    s += `<rect x="0" y="${oben}" width="${W}" height="${H * Z + 2 * rand}" rx="16" fill="#1F6F64" mask="url(#loecher)"/>`;
    for (let x = 0; x < B; x++) for (let y = 0; y < H; y++) s += `<circle cx="${rand + x * Z + Z / 2}" cy="${oben + rand + (H - 1 - y) * Z + Z / 2}" r="20" fill="none" stroke="#0F3A34" stroke-width="2.5"/>`;
    // Gewinnreihe
    if (S.linie) {
      const p = ([x, y]) => [rand + x * Z + Z / 2, oben + rand + (H - 1 - y) * Z + Z / 2], a = p(S.linie[0]), b = p(S.linie[S.linie.length - 1]);
      s += `<path class="gewinn" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="#F3F0FF" stroke-width="7" stroke-linecap="round" opacity=".9"/>`;
      for (const q of S.linie) { const [cx, cy] = p(q); s += `<circle cx="${cx}" cy="${cy}" r="23" fill="none" stroke="#F3F0FF" stroke-width="3"/>`; }
    }
    // schwebender Stein und Spalten zum Antippen
    const mz = meinZug();
    if (mz && wahl !== null) { s += steinGrafik(steinVon(PID), rand + wahl * Z + Z / 2, Z / 2, 21, 'class="schwebt"'); s += `<rect x="${rand + wahl * Z + 2}" y="${oben + 2}" width="${Z - 4}" height="${H * Z + 2 * rand - 4}" rx="10" fill="#fff" opacity=".1" pointer-events="none"/>`; }
    if (mz) for (let x = 0; x < B; x++) { const frei = V.spalteFrei(S, x); s += `<rect data-spalte="${x}" x="${rand + x * Z}" y="0" width="${Z}" height="${Hh}" fill="#fff" fill-opacity=".001" ${frei ? 'role="button" tabindex="0"' : ""} aria-label="Spalte ${x + 1}${frei ? "" : ", voll"}" style="cursor:${frei ? "pointer" : "default"}"/>`; }
    if (fallen) gefallen = neuKey;
    return `<svg class="brett" viewBox="0 0 ${W} ${Hh}" role="group" aria-label="Spielbrett ${B} mal ${H}">${s}</svg>`;
  }
  function bildschirmSpiel() {
    const host = rolle === "host", dran = S.teilnehmer[S.dran], ende = S.phase === "ende", dabei = S.teilnehmer.includes(PID);
    if (wahl !== null && (!meinZug() || !V.spalteFrei(S, wahl))) wahl = null;
    const kopf = `<div class="leiste">${S.teilnehmer.map((p, i) => `<div class="mitspieler ${!ende && i === S.dran ? "dran" : ""} ${online(p) ? "" : "weg"}"><span class="oben">${stein(steinVon(p))}<span class="siege">${sp(p).siege}</span></span><b>${esc(sp(p).name)}</b></div>`).join("")}</div>`;
    let zeile;
    if (ende) zeile = S.sieger ? `${stein(steinVon(S.sieger))}<span><b>${S.sieger === PID ? "Du gewinnst" : esc(sp(S.sieger).name) + " gewinnt"}</b> die Runde ${S.runde}!</span>` : `<span>Das Brett ist voll: unentschieden.</span>`;
    else if (meinZug()) zeile = `${stein(steinVon(PID))}<span><b>Du bist dran.</b> ${wahl === null ? "Tippe auf eine Spalte." : "Nochmal tippen oder „Einwerfen“."}</span>`;
    else zeile = `${stein(steinVon(dran))}<span>${esc(sp(dran).name)} ist dran${online(dran) ? "" : " (nicht verbunden)"}.</span>`;
    return `<p class="etikett mitte">Runde ${S.runde}${dabei ? "" : " · du schaust zu"}</p>${kopf}
      <p class="zug ${meinZug() || (ende && S.sieger === PID) ? "du" : ""}" aria-live="polite">${zeile}</p>
      <div class="brettrahmen">${brett()}</div>
      ${meinZug() ? `<div class="unten"><button class="knopf" id="einwerfen" ${wahl === null ? "disabled" : ""}>${wahl === null ? "Spalte wählen" : `In Spalte ${wahl + 1} einwerfen`}</button></div>` : ""}
      ${ende && host ? `<div class="unten"><button class="knopf" id="weiter">Nächste Runde</button></div><button class="link" id="lobby">Zurück in die Lobby</button>` : ""}
      ${ende && !host ? `<p class="leise mitte">${esc(sp(S.host).name)} startet die nächste Runde.</p>` : ""}
      ${!ende && host && dran !== PID && !online(dran) ? `<button class="link" id="auslassen">${esc(sp(dran).name)} ist nicht verbunden: auslassen</button>` : ""}
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
    if ($("teilen")) $("teilen").onclick = () => { if (navigator.share) navigator.share({ title: "Viererkette", text: "Spiel mit! Raum " + code, url: link() }).catch(() => {}); else kopieren(); };
    if ($("kopieren")) $("kopieren").onclick = kopieren;
    if ($("start")) $("start").onclick = () => tun({ t: "start", teilnehmer: S.reihenfolge.filter(p => S.spieler[p] && online(p)) });
    if ($("weiter")) $("weiter").onclick = () => tun({ t: "weiter" });
    if ($("lobby")) $("lobby").onclick = () => tun({ t: "lobby" });
    if ($("verlassen")) $("verlassen").onclick = verlassen;
    if ($("einwerfen")) $("einwerfen").onclick = einwerfen;
    document.querySelectorAll("[data-stein]").forEach(b => b.onclick = () => tun({ t: "stein", n: +b.dataset.stein }));
    if ($("auslassen")) $("auslassen").onclick = () => tun({ t: "auslassen", ziel: S.teilnehmer[S.dran] });
    document.querySelectorAll("[data-spalte]").forEach(r => {
      r.onclick = () => spalteTippen(+r.dataset.spalte);
      r.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); spalteTippen(+r.dataset.spalte); } };
    });
  }
  function kopieren() {
    const b = document.getElementById("kopieren");
    const fertig = () => { if (b) { b.textContent = "Kopiert"; setTimeout(() => { b.textContent = "Link kopieren"; }, 1500); } };
    try { navigator.clipboard.writeText(link()).then(fertig, () => prompt("Link kopieren:", link())); } catch (e) { prompt("Link kopieren:", link()); }
  }

  // ---------- Start ----------
  if (typeof Peer === "undefined") { app.innerHTML = `<div class="mitte"><p>Die Verbindungsbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.</p></div>`; return; }
  if (code) {
    const gespeichert = ls.get("vk:host:" + code);
    if (gespeichert) fortsetzenAlsHost(gespeichert);
    else if (name) clientStarten();
    else render();
  } else render();
  window.__vk = { get S() { return S; }, get rolle() { return rolle; }, get verbunden() { return verbunden; }, PID, tun: params.get("test") ? tun : undefined };
})();
