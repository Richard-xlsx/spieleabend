// Pinselpost (früher Stille Post mit Bildern): Verbindung (Handy des Spielleiters ist der Server, PeerJS) und Oberfläche.
(function () {
  const P = window.SP;
  const app = document.getElementById("app");
  const PREFIX = "fmwsp-";
  const ZEICHEN = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
  const FARBEN = ["#16161D", "#E23B2E", "#2F6FDE", "#2E9B4F", "#F2B705", "#8B5A2B", "#E86FB0", "#FFFFFF"];
  const DICKE = { 1: 5, 2: 12, 3: 28 };
  // Weitere Farben in der aufklappbaren Palette (Striche speichern dann den Farbcode statt der Nummer)
  const PALETTE = ["#7A1F1F", "#B22222", "#FF6B5B", "#FFB3A7", "#C2410C", "#F97316", "#FDBA74", "#FFE8C2",
    "#A16207", "#FACC15", "#FEF08A", "#3F6212", "#65A30D", "#A3E635", "#BBF7D0", "#0F766E",
    "#14B8A6", "#99F6E4", "#1E3A8A", "#0EA5E9", "#7DD3FC", "#4C1D95", "#8B5CF6", "#C4B5FD",
    "#9D174D", "#DB2777", "#F9A8D4", "#5C3A1E", "#D2B48C", "#FDDCC4", "#E8B48A", "#C68642",
    "#8D5524", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#F3F4F6"];
  const farbWert = f => typeof f === "string" ? f : (FARBEN[f] || FARBEN[0]);
  // Malzustand, der ein Neuzeichnen der Seite übersteht
  let malFarbe = 0, malDicke = 2, eigeneFarbe = null, paletteOffen = false, ansicht = { key: "", z: 1, x: 0, y: 0 };
  const VORSCHLAEGE = ["Ein Pinguin verschläft seine eigene Hochzeit", "Oma gewinnt ein Rap-Battle", "Ein Hai macht Yoga am Strand",
    "Der Döner fliegt ins All", "Zwei Tauben streiten sich um ein Croissant", "Ein Einhorn steht im Stau",
    "Mein Mitbewohner kocht Nudeln in der Kaffeemaschine", "Ein Vampir beim Zahnarzt", "Ein Hund macht die Steuererklärung",
    "Ein Dinosaurier auf dem Festival", "Die Katze bestellt heimlich Pizza", "Ein Alien tankt an der Tankstelle",
    "Ein Schneemann im Hochsommer am Pool", "Ein Lehrer surft auf einem Brot", "Der Weihnachtsmann im Fitnessstudio",
    "Ein Frosch mit Sonnenbrille fährt Roller", "Ein Igel bei der Massage", "Die Polizei verhaftet einen Gartenzwerg",
    "Ein Toaster verliebt sich in eine Waffel", "Ein Bär klaut einen Picknickkorb", "Ein Pirat verliert sein Handy",
    "Ein Elefant versteckt sich hinter einer Laterne", "Eine Kuh fährt Achterbahn", "Ein Roboter backt Plätzchen",
    "Ein Influencer filmt sein Frühstück", "Ein Zauberer zaubert aus Versehen seinen Chef weg", "Ein Koala schläft im Hörsaal ein",
    "Zwei Gurken auf einem Date", "Ein Ritter wartet auf den Bus", "Ein Goldfisch geht Gassi", "Ein Hamster gewinnt Olympia-Gold",
    "Ein Gespenst singt Karaoke", "Eine Ananas demonstriert gegen Pizza", "Ein Astronaut hat seinen Schlüssel vergessen",
    "Ein Kaktus will kuscheln", "Ein Tiger an der Supermarktkasse", "Eine Giraffe in einem Kleinwagen", "Die Sonne trägt eine Sonnenbrille",
    "Ein Eichhörnchen hortet Klopapier", "Ein Zombie beim Vorstellungsgespräch", "Ein Oktopus spielt Schlagzeug",
    "Ein Baby fährt einen Bagger", "Ein Kamel in der Sauna", "Ein Angler fängt einen Stiefel", "Eine Schnecke gewinnt ein Wettrennen",
    "Ein Drache grillt Würstchen", "Ein Papagei verrät ein Geheimnis", "Ein Sofa läuft weg", "Ein Wal in der Badewanne",
    "Ein Schaf zählt Menschen zum Einschlafen"];
  const PEER_OPT = window.SPIELEABEND_PEER ? window.SPIELEABEND_PEER() : { debug: 0 };   // TURN-Server siehe ../netz.js
  const params = new URLSearchParams(location.search);
  const T = params.get("test") ? "-" + params.get("test") : "";
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k + T)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k + T, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k + T); } catch (e) {} }
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let PID = ls.get("slf:pid"); if (!PID) { PID = Math.random().toString(36).slice(2, 10); ls.set("slf:pid", PID); }
  let name = ls.get("slf:name") || "";
  let code = (params.get("raum") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  let rolle = null, S = null, K = {}, peer = null, hostConn = null, verbunden = false, offlineSeit = null, fehlerText = "";
  const conns = new Map();
  let tickTimer = null, retryTimer = null, token = 0, versuch = 0, letzteSig = "";
  let entwurf = null, letzteAbgabe = null, autoGesendet = "";

  const hostId = ep => PREFIX + code + "-" + ep;
  const link = () => location.origin + location.pathname + "?raum=" + code;
  const testTeil = () => (params.get("test") ? "&test=" + params.get("test") : "");

  // ---------- Bildschirm wach halten ----------
  let wake = null;
  async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wachHalten(); if (rolle === "client" && !hostConn) verbindeZumHost(); } });
  document.addEventListener("click", wachHalten);

  // ---------- Spielleiter ----------
  function speichernHost() { ls.set("sp:host:" + code, { S, K }); }
  function sendeAlle(m) { for (const c of conns.values()) { try { c.send(m); } catch (e) {} } }
  function hostStarten(z) {
    rolle = "host"; S = z.S; K = z.K || {}; S.host = PID;
    if (S.spieler[PID]) S.spieler[PID].name = name || S.spieler[PID].name;
    speichernHost(); oeffneHostPeer();
    if (!tickTimer) tickTimer = setInterval(() => { if (rolle === "host") anwenden(P.tick(S, K)); }, 1000);
    render();
  }
  function anwenden(r, stumm) {
    if (r.S === S && !r.neu.length) return false;
    S = r.S; K = r.K;
    for (const k of r.neu) sendeAlle({ t: "eintrag", nr: S.spielNr, key: k, e: K[k] });
    if (!stumm) geaendert();
    return true;
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
    if (m.t === "hallo") {
      conns.set(m.pid, c);
      anwenden(P.aktion(S, K, m.pid, m), true);
      const bekannt = new Set(m.nr === S.spielNr ? (m.bekannt || []) : []);
      for (const k in K) if (!bekannt.has(k)) { try { c.send({ t: "eintrag", nr: S.spielNr, key: k, e: K[k] }); } catch (e) {} }
      geaendert();
      return;
    }
    if (!anwenden(P.aktion(S, K, m.pid, m))) geaendert();
  }
  function geaendert() {
    S.online = [PID].concat([...conns.keys()]);
    speichernHost();
    sendeAlle({ t: "zustand", s: S });
    render();
  }

  // ---------- Mitspieler ----------
  function speichernKopie() { ls.set("sp:kopie:" + code, { S, K }); }
  function clientStarten() {
    rolle = "client";
    const k = ls.get("sp:kopie:" + code); if (k) { S = k.S; K = k.K || {}; }
    letzteAbgabe = ls.get("sp:letzte:" + code);
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
      const letzte = letzteAbgabe && S && letzteAbgabe.nr === S.spielNr ? letzteAbgabe : null;
      c.send({ t: "hallo", pid: PID, name, nr: S ? S.spielNr : null, bekannt: Object.keys(K), letzte });
      render();
    });
    c.on("data", m => {
      if (!m) return;
      if (m.t === "zustand") {
        const alt = S; S = m.s;
        if (!alt || alt.spielNr !== S.spielNr) K = {};
        speichernKopie(); render();
      } else if (m.t === "eintrag") {
        if (S && m.nr !== S.spielNr) return;
        K[m.key] = m.e; speichernKopie();
        if (S && (S.phase === "show" || S.phase === "ende")) { letzteSig = ""; render(); }
        else if (S && S.phase === "runde" && entwurf && document.getElementById("vorlage-fehlt")) { letzteSig = ""; render(); }
      }
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
    clearTimeout(retryTimer);
    retryTimer = setTimeout(verbindeZumHost, 2000);
  }
  function verloren() { verbunden = false; hostConn = null; if (!offlineSeit) offlineSeit = Date.now(); render(); fehlschlag(token); }
  function uebernehmen() {
    if (!S) return;
    const s = JSON.parse(JSON.stringify(S)); s.epoch += 1;
    ls.del("sp:kopie:" + code);
    clearTimeout(retryTimer); token++;
    if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
    hostStarten({ S: s, K });
  }
  function fortsetzenAlsHost(gespeichert) {
    rolle = "pruefen"; render();
    const probe = new Peer(undefined, PEER_OPT);
    let fertig = false;
    const ende = alsClient => {
      if (fertig) return; fertig = true;
      try { probe.destroy(); } catch (e) {}
      if (alsClient) { ls.del("sp:host:" + code); ls.set("sp:kopie:" + code, gespeichert); clientStarten(); }
      else hostStarten(gespeichert);
    };
    probe.on("open", () => { const c = probe.connect(hostId(gespeichert.S.epoch + 1), { serialization: "json" }); c.on("open", () => ende(true)); });
    probe.on("error", () => ende(false));
    setTimeout(() => ende(false), 4000);
  }

  // ---------- Aktionen ----------
  function tun(m) {
    if (rolle === "host") { if (!anwenden(P.aktion(S, K, PID, m))) geaendert(); }
    else if (hostConn && hostConn.open) { try { hostConn.send(Object.assign({ pid: PID }, m)); } catch (e) {} }
  }
  function meineAufgabe() { return S ? P.aufgabe(S, PID) : null; }
  function entwurfLaden(a) {
    const e = ls.get("sp:entwurf:" + code);
    entwurf = e && e.nr === S.spielNr && e.schritt === a.schritt ? e : { nr: S.spielNr, schritt: a.schritt, text: "", striche: [] };
  }
  function entwurfSpeichern() { if (entwurf) ls.set("sp:entwurf:" + code, entwurf); }
  function abgeben() {
    const a = meineAufgabe(); if (!a) return;
    if (!entwurf || entwurf.nr !== S.spielNr || entwurf.schritt !== a.schritt) entwurfLaden(a);
    const inhalt = a.typ === "text" ? { text: entwurf.text } : { striche: entwurf.striche };
    letzteAbgabe = { nr: S.spielNr, schritt: a.schritt, inhalt }; ls.set("sp:letzte:" + code, letzteAbgabe);
    tun({ t: "abgabe", schritt: a.schritt, inhalt });
  }
  function neuesSpiel(tempo, durchgaenge) {
    code = (window.ABEND && ABEND.neuerRaum()) || Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
    history.replaceState(null, "", "?raum=" + code + testTeil());
    hostStarten({ S: P.neu(code, PID, name, { tempo, durchgaenge }), K: {} });
  }
  function verlassen() {
    for (const k of ["sp:host:", "sp:kopie:", "sp:entwurf:", "sp:letzte:"]) ls.del(k + code);
    location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : "");
  }

  // ---------- Malen ----------
  function zeichne(ctx, w, h, striche, bisPunkte) {
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const sx = w / 1000, sy = h / 750; let rest = bisPunkte == null ? Infinity : bisPunkte;
    for (const s of striche || []) {
      if (rest <= 0) break;
      ctx.strokeStyle = farbWert(s.f); ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = (DICKE[s.d] || 5) * sx;
      const n = Math.min(s.p.length / 2, rest); rest -= n;
      if (n === 1) { ctx.beginPath(); ctx.arc(s.p[0] * sx, s.p[1] * sy, ctx.lineWidth / 2, 0, 7); ctx.fill(); continue; }
      ctx.beginPath(); ctx.moveTo(s.p[0] * sx, s.p[1] * sy);
      for (let i = 1; i < n; i++) ctx.lineTo(s.p[2 * i] * sx, s.p[2 * i + 1] * sy);
      ctx.stroke();
    }
  }
  function leinwand(box) {
    const cv = document.createElement("canvas"); box.appendChild(cv);
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = box.clientWidth || 320, h = Math.round(w * 0.75);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px";
    return cv;
  }
  function bildAnzeigen(box, striche, animieren) {
    const cv = leinwand(box), ctx = cv.getContext("2d");
    const gesamt = (striche || []).reduce((a, s) => a + s.p.length / 2, 0);
    if (!animieren || !gesamt || matchMedia("(prefers-reduced-motion: reduce)").matches) { zeichne(ctx, cv.width, cv.height, striche); return; }
    const t0 = performance.now(), dauer = Math.min(3500, 800 + gesamt * 3);
    const schritt = t => { const f = Math.min(1, (t - t0) / dauer); zeichne(ctx, cv.width, cv.height, striche, Math.ceil(gesamt * f)); if (f < 1 && cv.isConnected) requestAnimationFrame(schritt); };
    requestAnimationFrame(schritt);
  }
  function malen(box) {
    const cv = leinwand(box), ctx = cv.getContext("2d");
    cv.className = "malen";
    const breite = parseFloat(cv.style.width), hoehe = parseFloat(cv.style.height), dpr = Math.min(2, window.devicePixelRatio || 1);
    let aktuell = null;
    const punkte = () => entwurf.striche.reduce((a, s) => a + s.p.length / 2, 0);
    const neu = () => zeichne(ctx, cv.width, cv.height, entwurf.striche);
    // Zoom: zwei Finger auf der Fläche verschieben und vergrößern, ein Finger malt
    const key = entwurf.nr + ":" + entwurf.schritt;
    if (ansicht.key !== key) ansicht = { key, z: 1, x: 0, y: 0 };
    const zz = document.getElementById("zoomzurueck");
    const zeigen = () => {
      cv.style.transform = `translate(${ansicht.x}px,${ansicht.y}px) scale(${ansicht.z})`;
      if (zz) zz.hidden = ansicht.z <= 1.01;
    };
    const schaerfen = () => {                  // nach dem Zoomen in passender Auflösung neu zeichnen
      const f = Math.min(4, dpr * ansicht.z), w = Math.round(breite * f), h = Math.round(hoehe * f);
      if (cv.width !== w) { cv.width = w; cv.height = h; neu(); }
    };
    cv.style.transformOrigin = "0 0"; zeigen(); schaerfen(); neu();
    if (zz) zz.onclick = () => { ansicht.z = 1; ansicht.x = 0; ansicht.y = 0; zeigen(); schaerfen(); };
    const finger = new Map(); let zwick = null, gesperrt = false;
    const mitte = () => { const [a, b] = [...finger.values()], r = box.getBoundingClientRect(); return { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; };
    const pos = ev => { const r = cv.getBoundingClientRect(); return [Math.round((ev.clientX - r.left) / r.width * 1000), Math.round((ev.clientY - r.top) / r.height * 750)]; };
    box.addEventListener("gesturestart", ev => ev.preventDefault());
    cv.addEventListener("pointerdown", ev => {
      ev.preventDefault();
      finger.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (finger.size === 2) {                 // zweiter Finger: Malen abbrechen, Zoomen beginnen
        if (aktuell) {
          if (aktuell.p.length <= 16 && entwurf.striche[entwurf.striche.length - 1] === aktuell) entwurf.striche.pop();
          aktuell = null; entwurfSpeichern(); neu(); aktualisiere();
        }
        const m = mitte(); zwick = { m, z: ansicht.z, x: ansicht.x, y: ansicht.y }; gesperrt = true;
        return;
      }
      if (finger.size > 2 || gesperrt) return;
      if (punkte() >= P.MAX_PUNKTE) { voll(); return; }
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
      aktuell = { f: malFarbe, d: malDicke, p: pos(ev), id: ev.pointerId }; entwurf.striche.push(aktuell); neu();
    });
    cv.addEventListener("pointermove", ev => {
      if (finger.has(ev.pointerId)) finger.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (zwick && finger.size >= 2) {
        ev.preventDefault();
        const m = mitte(), z = Math.max(1, Math.min(4, zwick.z * m.d / zwick.m.d));
        const cx = (zwick.m.x - zwick.x) / zwick.z, cy = (zwick.m.y - zwick.y) / zwick.z;   // Punkt unter den Fingern bleibt dort
        ansicht.z = z;
        ansicht.x = Math.min(0, Math.max(breite - breite * z, m.x - cx * z));
        ansicht.y = Math.min(0, Math.max(hoehe - hoehe * z, m.y - cy * z));
        zeigen(); return;
      }
      if (!aktuell || ev.pointerId !== aktuell.id) return; ev.preventDefault();
      const [x, y] = pos(ev), n = aktuell.p.length;
      if (Math.hypot(x - aktuell.p[n - 2], y - aktuell.p[n - 1]) < 4 / ansicht.z) return;
      if (punkte() >= P.MAX_PUNKTE) { voll(); aktuell = null; return; }
      aktuell.p.push(Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(750, y)));
      const sx = cv.width / 1000, sy = cv.height / 750;
      ctx.strokeStyle = farbWert(aktuell.f); ctx.lineWidth = DICKE[aktuell.d] * sx; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(aktuell.p[n - 2] * sx, aktuell.p[n - 1] * sy); ctx.lineTo(aktuell.p[n] * sx, aktuell.p[n + 1] * sy); ctx.stroke();
    });
    const ende = ev => {
      finger.delete(ev.pointerId);
      if (zwick && finger.size < 2) { zwick = null; schaerfen(); }
      if (!finger.size) gesperrt = false;
      if (aktuell && ev.pointerId === aktuell.id) { delete aktuell.id; aktuell = null; entwurfSpeichern(); aktualisiere(); }
    };
    cv.addEventListener("pointerup", ende); cv.addEventListener("pointercancel", ende);
    cv.addEventListener("pointerleave", ev => { if (!aktuell || ev.pointerId === aktuell.id) ende(ev); });
    const voll = () => { const h = document.getElementById("voll"); if (h) h.hidden = false; };
    // Farben: Grundfarben, aufklappbare Palette und freie Farbwahl
    const farbeWaehlen = f => {
      malFarbe = f;
      if (typeof f === "string") { eigeneFarbe = f; const e = document.getElementById("eigene"); if (e) { e.hidden = false; e.style.background = f; e.dataset.farbe = f; } }
      document.querySelectorAll("[data-farbe]").forEach(x => x.classList.toggle("an", x.dataset.farbe === String(f)));
    };
    document.querySelectorAll("[data-farbe]").forEach(b => b.onclick = () => farbeWaehlen(/^#/.test(b.dataset.farbe) ? b.dataset.farbe : +b.dataset.farbe));
    const pt = document.getElementById("palettetaste"), pl = document.getElementById("palette");
    if (pt && pl) pt.onclick = () => { paletteOffen = !paletteOffen; pl.hidden = !paletteOffen; pt.setAttribute("aria-expanded", paletteOffen); };
    const frei = document.getElementById("freiefarbe");
    if (frei) frei.oninput = () => farbeWaehlen(frei.value.toUpperCase());
    document.querySelectorAll("[data-dicke]").forEach(b => b.onclick = () => { malDicke = +b.dataset.dicke; document.querySelectorAll("[data-dicke]").forEach(x => x.classList.toggle("an", x === b)); });
    const z = document.getElementById("rueckgaengig"); if (z) z.onclick = () => { entwurf.striche.pop(); entwurfSpeichern(); neu(); aktualisiere(); };
    const l = document.getElementById("loeschen");
    if (l) l.onclick = () => {
      if (l.dataset.sicher !== "1") { l.dataset.sicher = "1"; l.textContent = "Wirklich löschen?"; setTimeout(() => { l.dataset.sicher = ""; l.textContent = "Alles löschen"; }, 2500); return; }
      entwurf.striche = []; entwurfSpeichern(); neu(); aktualisiere(); l.dataset.sicher = ""; l.textContent = "Alles löschen";
    };
  }

  // ---------- Oberfläche ----------
  const sp = p => (S && S.spieler[p]) || { name: "?" };
  const online = p => !!(S && S.online && S.online.includes(p));
  const zeit = s => s == null ? "" : Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  const tempoText = { entspannt: "Entspannt", normal: "Normal", schnell: "Schnell", test: "Test" };
  const durchgangText = d => (d ? d + "×" : "Auto");
  const ablaufText = d => (d ? "Satz" + " → Bild → Satz".repeat(d) : "Jeder ist bei jeder Kette einmal dran");

  function sig() {
    if (!rolle) return "start:" + (code ? "name" : "neu");
    if (rolle === "pruefen" || !S) return "warte";
    if (S.phase === "runde") return ["runde", S.spielNr, S.schritt, S.teilnehmer.includes(PID), S.abgegeben.includes(PID)].join(":");
    if (S.phase === "show") return ["show", S.spielNr, S.show.kette, S.show.eintrag].join(":");
    return [S.phase, S.spielNr, S.phase === "lobby" ? S.aenderung : ""].join(":");
  }
  function render() {
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
      st.querySelector("button").hidden = !(rolle === "client" && S && offlineSeit && Date.now() - offlineSeit > 20000);
    }
    if (!S) return;
    const z = document.getElementById("zeit"); if (z) { z.textContent = zeit(S.rest); z.classList.toggle("knapp", S.rest != null && S.rest <= 10); }
    const pl = document.getElementById("spielerliste");
    if (pl) pl.innerHTML = S.reihenfolge.filter(p => S.spieler[p]).map(p => `<li><i class="punkt ${online(p) ? "an" : ""}"></i>${esc(sp(p).name)}${p === S.host ? " <small>Spielleiter</small>" : ""}${p === PID ? " <small>du</small>" : ""}</li>`).join("");
    const wl = document.getElementById("warteliste");
    if (wl && S.phase === "runde") {
      const offen = S.teilnehmer.filter(p => !S.abgegeben.includes(p));
      wl.innerHTML = `<b>${S.abgegeben.length} von ${S.teilnehmer.length} fertig.</b> ${offen.length ? "Noch dabei: " + offen.map(p => esc(sp(p).name)).join(", ") : ""}`;
    }
    const ab = document.getElementById("abgeben");
    if (ab && entwurf) { const a = meineAufgabe(); ab.disabled = a && (a.typ === "text" ? !entwurf.text.trim() : !entwurf.striche.length); }
    document.querySelectorAll("[data-herz]").forEach(b => {
      const l = (S.herzen && S.herzen[b.dataset.herz]) || [];
      b.classList.toggle("an", l.includes(PID)); b.querySelector("span").textContent = l.length || "";
    });
    // kurz vor Ablauf automatisch abgeben, was da ist
    if (S.phase === "runde" && S.teilnehmer.includes(PID) && !S.abgegeben.includes(PID) && S.rest != null && S.rest <= 2 && entwurf) {
      const k = S.spielNr + ":" + S.schritt;
      if (autoGesendet !== k) { autoGesendet = k; abgeben(); }
    }
  }
  setInterval(aktualisiere, 1000);

  function baue() {
    let h = `<div class="status" id="status" hidden><span></span><button class="klein" id="uebernehmen" hidden>Spielleitung übernehmen</button></div>`;
    if (!rolle) h += code ? bildschirmName() : bildschirmStart();
    else if (rolle === "pruefen" || !S) h += `<div class="mitte"><p class="leise">${window.ABEND ? ABEND.warten() : "Verbinde …"}</p></div>`;
    else h += ({ lobby: bildschirmLobby, runde: bildschirmRunde, show: bildschirmShow, ende: bildschirmEnde }[S.phase] || (() => ""))();
    app.innerHTML = h;
    binden();
  }
  // Banner: aus „Grillen im Park“ wird ein Bild und daraus „Lagerfeuer mit Freunden“
  const TITELBILD = '<svg class="titelbild" viewBox="0 0 320 150" role="img" aria-label="Aus dem Satz „Grillen im Park“ wird eine Zeichnung mit Grill, Rauch und Leuten, und daraus wird „Lagerfeuer mit Freunden“"> <defs><pattern id="pp-luftpost" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="16" height="16" fill="#F5F0E6"/><rect width="5" height="16" fill="#D9473A"/><rect x="8" width="5" height="16" fill="#2F5DA8"/></pattern></defs> <rect x="2" y="2" width="316" height="146" rx="20" fill="url(#pp-luftpost)"/> <rect x="9" y="9" width="302" height="132" rx="14" fill="#22324F"/> <g fill="none" stroke="#F5F0E6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M93 76h18M105 70l6 6-6 6"/><path d="M211 76h18M223 70l6 6-6 6"/></g> <g transform="rotate(-5 50 76)"> <rect x="14" y="40" width="74" height="70" rx="4" fill="#FFFBF0" stroke="#14181E" stroke-width="2"/> <rect x="68" y="45" width="15" height="17" fill="#F4C95D" stroke="#14181E" stroke-width="1.4" stroke-dasharray="2 1.2"/> <g font-family="Caveat,cursive" font-weight="700" font-size="18" fill="#2B4FA8"><text x="20" y="80">Grillen</text><text x="20" y="98">im Park</text></g> </g> <g transform="rotate(3 167 76)"> <rect x="121" y="28" width="92" height="94" rx="3" fill="#FFFFFF" stroke="#14181E" stroke-width="2"/> <g fill="none" stroke="#22202A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M126 110q20-3 40 0t42-1" stroke="#6CC497" stroke-width="2.4"/> <path d="M134 108v-22" stroke="#8B5A2B" stroke-width="2.6"/><circle cx="134" cy="76" r="11" fill="#8FD19E"/> <path d="M203 108v-18" stroke="#8B5A2B" stroke-width="2.6"/><circle cx="203" cy="81" r="9" fill="#8FD19E"/> <path d="M152 86q15 18 30 0z" fill="#3A3F48"/> <path d="M150 86h34"/> <path d="M160 96l-5 13M174 96l5 13M167 98v11"/> <path d="M158 85q2-7 5-2q2-8 5-1q3-6 5 1q3-5 5 2" fill="#FF9E3D" stroke="#E0533D" stroke-width="1.6"/> <path d="M163 76q-5-6 0-11t0-12M172 74q5-6 0-11t1-11" stroke="#9AA3AD" stroke-width="1.8"/> <circle cx="143" cy="88" r="3.6" fill="#FFFFFF"/><path d="M143 92v9M143 101l-3 7M143 101l3 7M143 95l6-3M143 95l-4 4"/> <circle cx="192" cy="88" r="3.6" fill="#FFFFFF"/><path d="M192 92v9M192 101l-3 7M192 101l3 7M192 95l-6-4M192 95l4 4"/> </g> </g> <g transform="rotate(4 270 76)"> <rect x="234" y="40" width="74" height="70" rx="4" fill="#FFFBF0" stroke="#14181E" stroke-width="2"/> <rect x="288" y="45" width="15" height="17" fill="#F4C95D" stroke="#14181E" stroke-width="1.4" stroke-dasharray="2 1.2"/> <g font-family="Caveat,cursive" font-weight="700" font-size="16" fill="#C6362F"><text x="239" y="76">Lagerfeuer</text><text x="239" y="91">mit</text><text x="239" y="105">Freunden</text></g> </g> </svg>';
  function bildschirmStart() {
    return `<header class="titel">${TITELBILD}<h1 class="wortmarke">Pinselpost</h1><p class="leise">Stille Post mit Bildern: Satz, Bild, Satz, Bild … jeder auf seinem Handy. Am Ende seht ihr, was daraus geworden ist.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
      <div class="karte"><h2>Neues Spiel</h2>
        <div class="wahl" id="wTempo">${["entspannt", "normal", "schnell"].map(t => `<button data-v="${t}" class="${t === "normal" ? "an" : ""}">${tempoText[t]}</button>`).join("")}</div>
        <p class="leise klein">Normal: 40 Sekunden zum Schreiben, 80 zum Malen. Für 3 bis 8 Leute.</p>
        <p class="etikett">Wie oft Bild → Satz?</p>
        <div class="wahl" id="wDurchgaenge" style="gap:6px">${P.DURCHGAENGE.map(d => `<button data-v="${d}" class="${d === 0 ? "an" : ""}" style="padding:8px 4px">${durchgangText(d)}</button>`).join("")}</div>
        <p class="leise klein" id="ablauf">${ablaufText(0)}</p>
        <button class="knopf" id="neu">Raum erstellen</button></div>
      <div class="karte"><h2>Mitspielen</h2>
        <label class="feld">Raumcode<input id="code" maxlength="4" autocapitalize="characters" placeholder="z. B. K7M2"></label>
        <button class="knopf zweit" id="beitreten">Beitreten</button></div>
      <a class="link" href="../">Alle Spiele</a>`;
  }
  function bildschirmName() {
    return `<header class="titel">${TITELBILD}<h1 class="wortmarke">Pinselpost</h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
      <button class="knopf" id="mitspielen">Mitspielen</button>`;
  }
  function bildschirmLobby() {
    const host = rolle === "host", n = S.reihenfolge.filter(p => S.spieler[p] && online(p)).length;
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
    return `<header class="titel"><p class="etikett">Pinselpost · Raumcode</p><div class="code">${esc(code)}</div></header>
      ${qr ? `<div class="qr">${qr}</div>` : ""}
      <div class="reihe"><button class="knopf zweit" id="teilen">Link teilen</button><button class="knopf zweit" id="kopieren">Link kopieren</button></div>
      <div class="karte"><h2>Im Raum (${n})</h2><ul class="spieler" id="spielerliste"></ul></div>
      <div class="karte"><h2>So geht's</h2><p class="leise klein">Jeder schreibt einen Satz. Der Nächste malt ihn, der Nächste beschreibt das Bild, und so weiter, ${S.durchgaenge ? `bis jede Kette ${S.durchgaenge}× „Bild → Satz“ hinter sich hat (${ablaufText(S.durchgaenge)}).` : "bis jede Kette einmal herum ist."} Danach zeigt die Diashow, was aus euren Sätzen geworden ist. Tempo: ${tempoText[S.tempo]}.</p></div>
      ${host ? `<div class="unten"><button class="knopf" id="start" ${n < 3 ? "disabled" : ""}>${n < 3 ? "Warte auf Mitspieler (mind. 3) …" : "Spiel starten"}</button></div>`
        : `<p class="leise mitte">Warte, bis ${esc(sp(S.host).name)} das Spiel startet.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }
  function kopfRunde() {
    return `<div class="spielkopf"><div><p class="etikett">Schritt ${S.schritt + 1} von ${S.schritte}</p></div><div class="zeit" id="zeit"></div></div>`;
  }
  function bildschirmRunde() {
    if (!S.teilnehmer.includes(PID)) return `<header class="titel"><h2>Hier läuft gerade ein Spiel</h2><p class="leise">Beim nächsten Spiel bist du dabei.</p></header><p class="leise" id="warteliste"></p>`;
    if (S.abgegeben.includes(PID)) return kopfRunde() + `<div class="karte mitte"><h2>Abgegeben ✓</h2><p class="leise" id="warteliste"></p></div>`;
    const a = meineAufgabe(); entwurfLaden(a);
    const vorher = a.vorher ? K[a.vorher] : null;
    let h = kopfRunde();
    if (a.schritt === 0) {
      h += `<div class="karte"><h2>Schreib einen Satz, den jemand malen soll</h2>
        <input class="gross" id="text" maxlength="120" value="${esc(entwurf.text)}" placeholder="z. B. Ein Pinguin verschläft seine Hochzeit" autocomplete="off">
        <button class="klein" id="vorschlag">Vorschlag würfeln</button></div>`;
    } else if (a.typ === "bild") {
      h += `<div class="karte"><p class="etikett">Male das</p>${!vorher ? `<p class="leise" id="vorlage-fehlt">Lädt …</p>` : vorher.leer ? `<h2>Hier fehlt etwas. Mal, was du willst!</h2>` : `<h2 class="zitat">„${esc(vorher.text)}“</h2>`}</div>
        <div class="malbox" id="malbox"></div>
        <p class="leise klein zoomhinweis">Mit zwei Fingern heranzoomen und verschieben. <button class="klein" id="zoomzurueck" hidden>Ganzes Bild</button></p>
        <div class="werkzeug">${FARBEN.map((f, i) => `<button class="farbe ${malFarbe === i ? "an" : ""}" data-farbe="${i}" style="background:${f}" aria-label="${i === FARBEN.length - 1 ? "Radiergummi" : "Farbe " + (i + 1)}">${i === FARBEN.length - 1 ? "⌫" : ""}</button>`).join("")}
          <button class="farbe ${typeof malFarbe === "string" ? "an" : ""}" id="eigene" ${eigeneFarbe ? `data-farbe="${eigeneFarbe}" style="background:${eigeneFarbe}"` : "hidden"} aria-label="Zuletzt gewählte Palettenfarbe"></button>
          <button class="farbe palettetaste" id="palettetaste" aria-expanded="${paletteOffen}" aria-controls="palette" aria-label="Mehr Farben">+</button></div>
        <div class="palette" id="palette" ${paletteOffen ? "" : "hidden"}>
          <div class="palettenraster">${PALETTE.map(f => `<button class="farbe ${malFarbe === f ? "an" : ""}" data-farbe="${f}" style="background:${f}" aria-label="Farbe ${f}"></button>`).join("")}</div>
          <label class="freiefarbe">Eigene Farbe mischen <input type="color" id="freiefarbe" value="${eigeneFarbe || "#3366CC"}"></label></div>
        <div class="werkzeug">${[1, 2, 3].map(d => `<button class="klein ${d === malDicke ? "an" : ""}" data-dicke="${d}">${["Fein", "Mittel", "Dick"][d - 1]}</button>`).join("")}
          <button class="klein" id="rueckgaengig">Rückgängig</button><button class="klein" id="loeschen">Alles löschen</button></div>
        <p class="leise klein" id="voll" hidden>Das Bild ist voll. Rückgängig macht wieder Platz.</p>`;
    } else {
      h += `<div class="karte"><p class="etikett">Was ist auf dem Bild?</p><div class="bildbox" id="vorlagebild">${!vorher ? `<p class="leise" id="vorlage-fehlt">Lädt …</p>` : vorher.leer ? `<p class="leise">Hier wurde nichts gemalt. Denk dir einen Satz aus!</p>` : ""}</div></div>
        <div class="karte"><h2>Beschreib es in einem Satz</h2><input class="gross" id="text" maxlength="120" value="${esc(entwurf.text)}" placeholder="Ich sehe …" autocomplete="off"></div>`;
    }
    h += `<div class="unten"><button class="knopf" id="abgeben" disabled>Abgeben</button><p class="leise klein mitte">Läuft die Zeit ab, wird abgegeben, was da ist.</p></div>`;
    return h;
  }
  function eintragHtml(k, e, i) {
    const wer = esc(sp(e.von).name), ich = e.von === PID;
    const inhalt = e.leer ? `<p class="leise">${e.typ === "bild" ? "(nicht gemalt)" : "(nichts geschrieben)"}</p>`
      : e.typ === "text" ? `<p class="zitat">„${esc(e.text)}“</p>` : `<div class="bildbox" data-bild="${k}"></div>`;
    return `<div class="karte eintrag"><p class="etikett">${i === 0 ? "Startsatz" : e.typ === "bild" ? "gemalt" : "beschrieben"} von ${wer}</p>${inhalt}
      ${ich || e.leer ? "" : `<button class="klein herz" data-herz="${k}">♥ <span></span></button>`}</div>`;
  }
  function bildschirmShow() {
    const { kette, eintrag } = S.show, besitzer = S.teilnehmer[kette];
    let h = `<header class="titel"><p class="etikett">Kette ${kette + 1} von ${S.teilnehmer.length}</p><h2>Angefangen von ${esc(sp(besitzer).name)}</h2></header>`;
    for (let i = 0; i <= eintrag; i++) {
      const k = P.key(kette, i), e = K[k];
      h += e ? eintragHtml(k, e, i) : `<div class="karte"><p class="leise">Lädt …</p></div>`;
    }
    const letzte = kette === S.teilnehmer.length - 1 && eintrag === S.schritte - 1;
    h += rolle === "host" ? `<div class="unten reihe"><button class="knopf zweit" id="zurueck" ${kette === 0 && eintrag === 0 ? "disabled" : ""}>Zurück</button><button class="knopf" id="vor">${letzte ? "Zur Wertung" : eintrag === S.schritte - 1 ? "Nächste Kette" : "Weiter"}</button></div>`
      : `<p class="leise mitte klein">${esc(sp(S.host).name)} blättert weiter. ♥ für alles, was dir gefällt.</p>`;
    return h;
  }
  function bildschirmEnde() {
    const z = P.herzenJeSpieler(S, K);
    const rang = S.teilnehmer.slice().sort((a, b) => (z[b] || 0) - (z[a] || 0));
    const top = Object.keys(S.herzen).filter(k => K[k] && S.herzen[k].length).sort((a, b) => S.herzen[b].length - S.herzen[a].length).slice(0, 3);
    return `<header class="titel"><p class="etikett">Die meisten Herzen</p><h1>${esc(sp(rang[0]).name)}</h1></header>
      <ol class="rang">${rang.map((p, i) => `<li><span class="platz">${i + 1}</span><span class="n">${esc(sp(p).name)}</span><b>♥ ${z[p] || 0}</b></li>`).join("")}</ol>
      ${top.length ? `<p class="etikett">Publikumslieblinge</p>${top.map(k => eintragHtml(k, K[k], +k.split(":")[1])).join("")}` : ""}
      ${rolle === "host" ? `<div class="unten"><button class="knopf" id="nochmal">Nochmal spielen</button></div>` : ""}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }

  function binden() {
    const $ = id => document.getElementById(id);
    const nameAus = () => { const n = ($("name").value || "").trim().slice(0, 20); if (!n) { $("name").focus(); return null; } name = n; ls.set("slf:name", n); return n; };
    if ($("uebernehmen")) $("uebernehmen").onclick = uebernehmen;
    document.querySelectorAll(".wahl").forEach(w => w.querySelectorAll("button").forEach(b => b.onclick = () => { w.querySelectorAll("button").forEach(x => x.classList.remove("an")); b.classList.add("an"); }));
    if ($("wDurchgaenge")) $("wDurchgaenge").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { $("ablauf").textContent = ablaufText(+b.dataset.v); }));
    if ($("neu")) $("neu").onclick = () => { if (nameAus()) neuesSpiel(document.querySelector("#wTempo .an").dataset.v, +document.querySelector("#wDurchgaenge .an").dataset.v); };
    if ($("beitreten")) $("beitreten").onclick = () => {
      if (!nameAus()) return;
      const c = ($("code").value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.length !== 4) { $("code").focus(); return; }
      code = c; history.replaceState(null, "", "?raum=" + code + testTeil()); clientStarten();
    };
    if ($("mitspielen")) $("mitspielen").onclick = () => { if (nameAus()) clientStarten(); };
    if ($("teilen")) $("teilen").onclick = () => { if (navigator.share) navigator.share({ title: "Pinselpost", text: "Spiel mit! Raum " + code, url: link() }).catch(() => {}); else kopieren(); };
    if ($("kopieren")) $("kopieren").onclick = kopieren;
    const starten = () => tun({ t: "start", teilnehmer: S.reihenfolge.filter(p => S.spieler[p] && online(p)) });
    if ($("start")) $("start").onclick = starten;
    if ($("nochmal")) $("nochmal").onclick = starten;
    if ($("verlassen")) $("verlassen").onclick = verlassen;
    if ($("vor")) $("vor").onclick = () => tun({ t: "zeigen", richtung: 1 });
    if ($("zurueck")) $("zurueck").onclick = () => tun({ t: "zeigen", richtung: -1 });
    if ($("text")) $("text").oninput = () => { entwurf.text = $("text").value; entwurfSpeichern(); aktualisiere(); };
    if ($("vorschlag")) $("vorschlag").onclick = () => { const v = VORSCHLAEGE[Math.floor(Math.random() * VORSCHLAEGE.length)]; $("text").value = v; entwurf.text = v; entwurfSpeichern(); aktualisiere(); };
    if ($("abgeben")) $("abgeben").onclick = abgeben;
    if ($("malbox")) malen($("malbox"));
    if ($("vorlagebild") && S) { const a = meineAufgabe(), v = a && a.vorher && K[a.vorher]; if (v && !v.leer) bildAnzeigen($("vorlagebild"), v.striche, false); }
    const neuster = S && S.phase === "show" ? P.key(S.show.kette, S.show.eintrag) : null;
    document.querySelectorAll("[data-bild]").forEach(b => { const e = K[b.dataset.bild]; if (e) bildAnzeigen(b, e.striche, b.dataset.bild === neuster); });
    document.querySelectorAll("[data-herz]").forEach(b => b.onclick = () => tun({ t: "herz", key: b.dataset.herz }));
    if (S && S.phase === "show") { const l = document.querySelectorAll(".eintrag"); if (l.length) l[l.length - 1].scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  }
  function kopieren() {
    const b = document.getElementById("kopieren");
    const fertig = () => { if (b) { b.textContent = "Kopiert"; setTimeout(() => { b.textContent = "Link kopieren"; }, 1500); } };
    try { navigator.clipboard.writeText(link()).then(fertig, () => prompt("Link kopieren:", link())); } catch (e) { prompt("Link kopieren:", link()); }
  }

  // ---------- Start ----------
  if (typeof Peer === "undefined") { app.innerHTML = `<div class="mitte"><p>Die Verbindungsbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.</p></div>`; return; }
  if (code) {
    const gespeichert = ls.get("sp:host:" + code);
    if (gespeichert) fortsetzenAlsHost(gespeichert);
    else if (name) clientStarten();
    else render();
  } else render();
  window.__sp = { get S() { return S; }, get K() { return K; }, get rolle() { return rolle; }, get verbunden() { return verbunden; }, PID,
    tun: params.get("test") ? tun : undefined };
})();
