// Malalarm (früher Kritzelraten): Verbindung (Handy des Spielleiters ist der Server, PeerJS) und Oberfläche. Regeln in logic.js (window.KR).
// Das Bild wandert Strich für Strich: Der Maler schickt „ab Strich n diese Striche“, der Spielleiter reicht es weiter.
// Den Begriff kennt nur der Spielleiter; jeder Mitspieler bekommt mit KR.sicht() seine eigene Fassung des Zustands.
(function () {
  const KR = window.KR;
  const app = document.getElementById("app");
  const PREFIX = "fmwkr-";
  const ZEICHEN = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
  const FARBEN = ["#16161D", "#E23B2E", "#2F6FDE", "#2E9B4F", "#F2B705", "#8B5A2B", "#E86FB0", "#FFFFFF"];
  const DICKE = { 1: 5, 2: 12, 3: 28 };
  const farbWert = f => typeof f === "string" ? f : (FARBEN[f] || FARBEN[0]);
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
  let rolle = null, S = null, peer = null, hostConn = null, verbunden = false, offlineSeit = null, fehlerText = "";
  const conns = new Map();
  let tickTimer = null, retryTimer = null, token = 0, versuch = 0, letzteSig = "", speicherTimer = null;
  let B = { nr: 0, striche: [] };     // Bild des aktuellen Zugs
  let G = [];                          // fertige Bilder dieses Spiels (für die Galerie am Ende)
  let malFarbe = MALHILFE.STANDARD, malDicke = 2, gesendet = 0, schmutzig = false, toastText = "", toastArt = "", toastTimer = null;

  const hostId = ep => PREFIX + code + "-" + ep;
  const link = () => location.origin + location.pathname + "?raum=" + code;
  const testTeil = () => (params.get("test") ? "&test=" + params.get("test") : "");
  const ichMale = () => S && S.maler === PID && S.phase === "malen";

  // ---------- Bildschirm wach halten ----------
  let wake = null;
  async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wachHalten(); if (rolle === "client" && !hostConn) verbindeZumHost(); } });
  document.addEventListener("click", wachHalten);

  // ---------- Spielleiter ----------
  function speichernHost(sofort) {
    clearTimeout(speicherTimer);
    const f = () => ls.set("kr:host:" + code, { S, B, G });
    if (sofort) f(); else speicherTimer = setTimeout(f, 800);
  }
  function hostStarten(z) {
    rolle = "host"; S = z.S; B = z.B || { nr: S.nr, striche: [] }; G = z.G || []; S.host = PID;
    if (S.spieler[PID]) S.spieler[PID].name = name || S.spieler[PID].name;
    speichernHost(true); oeffneHostPeer();
    if (!tickTimer) tickTimer = setInterval(() => { if (rolle === "host") { const n = KR.tick(S); if (n !== S) setze(n); } }, 1000);
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
  const sende = (c, m) => { try { c.send(m); } catch (e) {} };
  const anAlle = (m, ausser) => { for (const [p, c] of conns) if (p !== ausser) sende(c, m); };
  // Neuer Zustand beim Spielleiter: Bilder fertiger Züge in die Galerie, neues leeres Bild
  function setze(neu) {
    const alt = S; S = neu;
    if (alt.phase === "lobby" && neu.phase !== "lobby") G = [];
    if (alt.nr !== neu.nr) {
      if (alt.wort && B.nr === alt.nr && B.striche.length) G.push({ wort: KR.anzeige(alt.wort), maler: alt.maler, striche: B.striche });
      B = { nr: neu.nr, striche: [] };
      anAlle({ t: "bild", nr: B.nr, ab: 0, striche: [] });
    }
    if (neu.phase === "ende" && alt.phase !== "ende") anAlle({ t: "galerie", g: G });
    geaendert();
  }
  function vonClient(c, m) {
    if (!m || !m.pid) return;
    if (m.t === "hallo") {
      conns.set(m.pid, c);
      const r = KR.aktion(S, m.pid, m); if (r.ok) S = r.S;
      geaendert();
      sende(c, { t: "bild", nr: B.nr, ab: 0, striche: B.striche });
      if (S.phase === "ende") sende(c, { t: "galerie", g: G });
      return;
    }
    if (m.t === "striche") return bildVomMaler(m.pid, m);
    if (m.t === "bildbitte") return sende(c, { t: "bild", nr: B.nr, ab: 0, striche: B.striche });
    const r = KR.aktion(S, m.pid, m);
    if (!r.ok) { sende(c, { t: "fehler", text: r.fehler }); return; }
    if (r.ergebnis) sende(c, { t: "ergebnis", e: r.ergebnis });
    setze(r.S);
  }
  function bildVomMaler(pid, m) {
    if (!S || S.phase !== "malen" || pid !== S.maler || m.nr !== S.nr || B.nr !== S.nr) return;
    // Malt der Spielleiter selbst, ist B schon sein Bild: nur weiterreichen
    if (pid === PID) { anAlle({ t: "bild", nr: B.nr, ab: m.ab, striche: m.striche }); speichernHost(); return; }
    const ab = Math.max(0, Math.min(B.striche.length, m.ab | 0));
    B.striche = KR.striche(B.striche.slice(0, ab).concat(m.striche || []));
    anAlle({ t: "bild", nr: B.nr, ab, striche: B.striche.slice(ab) }, pid);
    speichernHost();
    bildZeichnen();
  }
  function geaendert() {
    S.online = [PID].concat([...conns.keys()]);
    speichernHost();
    for (const [p, c] of conns) sende(c, { t: "zustand", s: KR.sicht(S, p) });
    render();
  }

  // ---------- Mitspieler ----------
  function clientStarten() {
    rolle = "client";
    const k = ls.get("kr:kopie:" + code); if (k) S = k;
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
      if (m.t === "zustand") {
        S = m.s; ls.set("kr:kopie:" + code, S);
        if (B.nr !== S.nr) { B = { nr: S.nr, striche: [] }; gesendet = 0; }
        if (S.phase === "lobby") G = [];
        render();
      } else if (m.t === "bild") bildEmpfangen(m);
      else if (m.t === "galerie") { G = m.g || []; letzteSig = ""; render(); }
      else if (m.t === "ergebnis") toast(m.e === "richtig" ? "Richtig!" : "Knapp daneben!", m.e === "richtig" ? "gut" : "");
      else if (m.t === "fehler") toast(m.text);
    });
    c.on("close", () => { if (hostConn === c) { hostConn = null; verloren(); } });
    c.on("error", () => {});
    retryTimer = setTimeout(() => { if (t === token && hostConn !== c) { try { c.close(); } catch (e) {} fehlschlag(t); } }, window.SPIELEABEND_WARTEN || 12000);
  }
  function bildEmpfangen(m) {
    // Beim Malen ist das eigene Bild maßgeblich: nach einer Unterbrechung alles noch einmal schicken
    if (S && S.maler === PID && m.nr === B.nr && S.phase === "malen") {
      // Nach dem Neuladen ist das eigene Bild leer: das vom Spielleiter übernehmen
      if (m.ab === 0 && (m.striche || []).length > B.striche.length) { B.striche = m.striche; gesendet = B.striche.length; letzteSig = ""; render(); }
      else { gesendet = 0; schmutzig = true; }
      return;
    }
    if (m.nr !== B.nr) B = { nr: m.nr, striche: [] };
    if (m.ab > B.striche.length) { if (hostConn) sende(hostConn, { t: "bildbitte", pid: PID }); return; }
    B.striche = B.striche.slice(0, m.ab).concat(m.striche || []);
    bildZeichnen();
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
    const s = JSON.parse(JSON.stringify(S)); s.epoch += 1; s.gebraucht = s.gebraucht || [];
    // Den Begriff kannte nur der alte Spielleiter: laufenden Zug auflösen und mit dem nächsten weitermachen
    if (["waehlen", "malen"].includes(s.phase)) { s.phase = "aufloesung"; s.rest = 3; s.wort = null; s.auswahl = null; s.letzte = { nr: s.nr, wort: "?", maler: s.maler, malerPunkte: 0, geraten: s.geraten || {} }; }
    ls.del("kr:kopie:" + code); clearTimeout(retryTimer); token++;
    if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
    hostStarten({ S: s, B, G });
  }
  function fortsetzenAlsHost(gespeichert) {
    rolle = "pruefen"; render();
    const probe = new Peer(undefined, PEER_OPT); let fertig = false;
    const ende = alsClient => {
      if (fertig) return; fertig = true; try { probe.destroy(); } catch (e) {}
      if (alsClient) { ls.del("kr:host:" + code); ls.set("kr:kopie:" + code, KR.sicht(gespeichert.S, PID)); clientStarten(); }
      else hostStarten(gespeichert);
    };
    probe.on("open", () => { const c = probe.connect(hostId(gespeichert.S.epoch + 1), { serialization: "json" }); c.on("open", () => ende(true)); });
    probe.on("error", () => ende(false));
    setTimeout(() => ende(false), 4000);
  }

  // ---------- Aktionen ----------
  function tun(m) {
    if (rolle === "host") {
      const r = KR.aktion(S, PID, m);
      if (!r.ok) { toast(r.fehler); return; }
      if (r.ergebnis) toast(r.ergebnis === "richtig" ? "Richtig!" : "Knapp daneben!", r.ergebnis === "richtig" ? "gut" : "");
      setze(r.S);
    } else if (hostConn && hostConn.open) sende(hostConn, Object.assign({ pid: PID }, m));
    else toast("Keine Verbindung zum Spielleiter.");
  }
  function toast(t, art) {
    toastText = t; toastArt = art || "";
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.className = "toast " + toastArt; el.textContent = t; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }
  function neuesSpiel(zeit, durchgaenge) {
    code = (window.ABEND && ABEND.neuerRaum()) || Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
    history.replaceState(null, "", "?raum=" + code + testTeil());
    hostStarten({ S: KR.neu(code, PID, name, { zeit, durchgaenge }) });
  }
  function verlassen() {
    for (const k of ["kr:host:", "kr:kopie:"]) ls.del(k + code);
    location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : "");
  }
  // Striche an den Spielleiter: ab dem ersten, den er noch nicht sicher hat
  function striche_senden() {
    if (!schmutzig || !ichMale()) return;
    schmutzig = false;
    const ab = Math.min(gesendet, B.striche.length);
    const m = { t: "striche", nr: S.nr, ab, striche: B.striche.slice(ab).map(s => ({ f: s.f, d: s.d, p: s.p.slice() })) };
    const offen = B.striche.length && B.striche[B.striche.length - 1].id !== undefined;
    gesendet = B.striche.length - (offen ? 1 : 0);
    if (rolle === "host") bildVomMaler(PID, m);
    else if (hostConn && hostConn.open) sende(hostConn, Object.assign({ pid: PID }, m));
    else { gesendet = 0; schmutzig = true; }
  }
  setInterval(striche_senden, 120);

  // ---------- Malen und Anzeigen ----------
  function zeichne(ctx, w, h, striche) {
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const sx = w / 1000, sy = h / 750;
    for (const s of striche || []) {
      ctx.strokeStyle = farbWert(s.f); ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = (DICKE[s.d] || 5) * sx;
      const n = s.p.length / 2;
      if (n === 1) { ctx.beginPath(); ctx.arc(s.p[0] * sx, s.p[1] * sy, ctx.lineWidth / 2, 0, 7); ctx.fill(); continue; }
      ctx.beginPath(); ctx.moveTo(s.p[0] * sx, s.p[1] * sy);
      for (let i = 1; i < n; i++) ctx.lineTo(s.p[2 * i] * sx, s.p[2 * i + 1] * sy);
      ctx.stroke();
    }
  }
  function leinwand(box) {
    box.innerHTML = "";
    const cv = document.createElement("canvas"); box.appendChild(cv);
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = box.clientWidth || 320, h = Math.round(w * 0.75);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px";
    return cv;
  }
  function bildZeichnen() {
    const box = document.getElementById("bild"); if (!box) return;
    let cv = box.querySelector("canvas");
    if (!cv) { cv = leinwand(box); MALHILFE.zoom(box, cv, { key: "kr-bild-" + B.nr, neu: bildZeichnen }); }
    zeichne(cv.getContext("2d"), cv.width, cv.height, B.striche);
  }
  function malen(box) {
    const cv = leinwand(box), ctx = cv.getContext("2d");
    cv.className = "malen";
    let aktuell = null;
    const punkte = () => B.striche.reduce((a, s) => a + s.p.length / 2, 0);
    const neu = () => zeichne(ctx, cv.width, cv.height, B.striche);
    const pos = ev => { const r = cv.getBoundingClientRect(); return [Math.round((ev.clientX - r.left) / r.width * 1000), Math.round((ev.clientY - r.top) / r.height * 750)]; };
    neu();
    const zm = MALHILFE.zoom(box, cv, { key: "kr-mal-" + S.nr, malen: true, neu, abbrechen: () => {
      if (!aktuell) return;
      if (aktuell.p.length <= 16 && B.striche[B.striche.length - 1] === aktuell) B.striche.pop();
      aktuell = null; schmutzig = true; neu();
    } });
    cv.addEventListener("pointerdown", ev => {
      ev.preventDefault();
      if (zm.gesperrt() || aktuell || !ichMale()) return;
      if (punkte() >= KR.MAX_PUNKTE) { toast("Das Bild ist voll. Rückgängig macht wieder Platz."); return; }
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
      aktuell = { f: malFarbe, d: malDicke, p: pos(ev), id: ev.pointerId }; B.striche.push(aktuell); neu(); schmutzig = true;
    });
    cv.addEventListener("pointermove", ev => {
      if (!aktuell || ev.pointerId !== aktuell.id || zm.gesperrt()) return; ev.preventDefault();
      const [x, y] = pos(ev), n = aktuell.p.length;
      if (Math.hypot(x - aktuell.p[n - 2], y - aktuell.p[n - 1]) < 4 / zm.z) return;
      if (punkte() >= KR.MAX_PUNKTE) return;
      aktuell.p.push(Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(750, y)));
      const sx = cv.width / 1000, sy = cv.height / 750;
      ctx.strokeStyle = farbWert(aktuell.f); ctx.lineWidth = DICKE[aktuell.d] * sx; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(aktuell.p[n - 2] * sx, aktuell.p[n - 1] * sy); ctx.lineTo(aktuell.p[n] * sx, aktuell.p[n + 1] * sy); ctx.stroke();
      schmutzig = true;
    });
    const ende = ev => { if (aktuell && ev.pointerId === aktuell.id) { delete aktuell.id; aktuell = null; schmutzig = true; } };
    cv.addEventListener("pointerup", ende); cv.addEventListener("pointercancel", ende);
    cv.addEventListener("pointerleave", ende);
    MALHILFE.farbenBinden(f => { malFarbe = f; });
    document.querySelectorAll("[data-dicke]").forEach(b => b.onclick = () => { malDicke = +b.dataset.dicke; document.querySelectorAll("[data-dicke]").forEach(x => x.classList.toggle("an", x === b)); });
    const z = document.getElementById("rueckgaengig");
    if (z) z.onclick = () => { if (aktuell) return; B.striche.pop(); gesendet = Math.min(gesendet, B.striche.length); schmutzig = true; neu(); };
    const l = document.getElementById("loeschen");
    if (l) l.onclick = () => {
      if (l.dataset.sicher !== "1") { l.dataset.sicher = "1"; l.textContent = "Wirklich löschen?"; setTimeout(() => { l.dataset.sicher = ""; l.textContent = "Alles löschen"; }, 2500); return; }
      B.striche = []; gesendet = 0; schmutzig = true; neu(); l.dataset.sicher = ""; l.textContent = "Alles löschen";
    };
  }

  // ---------- Oberfläche ----------
  const sp = p => (S && S.spieler[p]) || { name: "?", punkte: 0 };
  const online = p => !!(S && S.online && S.online.includes(p));
  const ansicht = () => (rolle === "host" ? KR.sicht(S, PID) : S);      // der Spielleiter sieht im Spiel nur, was alle sehen
  const zeit = s => s == null ? "" : Math.floor(s / 60) + ":" + String(Math.max(0, s) % 60).padStart(2, "0");
  const rangliste = () => S.reihenfolge.filter(p => S.spieler[p]).sort((a, b) => sp(b).punkte - sp(a).punkte);
  const geraten = () => S && S.geraten && S.geraten[PID] !== undefined;

  function statusZeile() {
    if (rolle === "host") return verbunden ? "" : (fehlerText || "Raum wird geöffnet …");
    if (rolle === "client" && !verbunden) return S ? "Verbindung zum Spielleiter weg, verbinde neu …" : (fehlerText || (window.ABEND && ABEND.aktiv ? "" : "Verbinde mit Raum " + code + " …"));
    return "";
  }
  function sig() {
    if (!rolle) return "start:" + (code ? "name" : "neu");
    if (rolle === "pruefen" || !S) return "warte";
    return [rolle, S.phase, S.nr, S.maler === PID, geraten(), ["lobby", "aufloesung", "ende"].includes(S.phase) ? S.aenderung : "", S.phase === "ende" ? G.length : ""].join(":");
  }
  function render() {
    const s = sig();
    if (s !== letzteSig) { letzteSig = s; baue(); }
    aktualisiere();
  }
  function aktualisiere() {
    const st = document.getElementById("status");
    if (st) {
      const t = statusZeile(); st.hidden = !t; st.querySelector("span").textContent = t;
      st.querySelector("button").hidden = !(rolle === "client" && S && offlineSeit && Date.now() - offlineSeit > 20000);
    }
    if (!S || rolle === "pruefen") return;
    const v = ansicht();
    const z = document.getElementById("zeit");
    if (z) { z.textContent = zeit(v.rest); const k = v.phase === "malen" && v.rest <= 10; z.classList.toggle("knapp", k); const w = document.getElementById("wecker"); if (w) w.classList.toggle("knapp", k); }
    const mk = document.getElementById("maske");
    if (mk && v.maske) {
      const buchst = v.maske.filter(c => c !== " " && c !== "-").length;
      mk.innerHTML = (v.wort && v.maler !== PID ? [...v.wort] : v.maske).map(c => c === " " ? `<span class="leer"></span>` : `<span class="${c !== "_" ? "auf" : ""}">${c === "_" ? "&nbsp;" : esc(c)}</span>`).join("") + `<span class="anzahl">${buchst}</span>`;
      mk.setAttribute("aria-label", v.wort ? "Lösung: " + v.wort : "Gesucht: " + buchst + " Buchstaben" + (v.maske.some(c => c !== "_" && c !== " ") ? ", aufgedeckt: " + v.maske.map(c => c === "_" ? "?" : c).join("") : ""));
    }
    const tl = document.getElementById("tippliste");
    if (tl) {
      const html = (v.tipps || []).slice().reverse().map(t => `<li><b>${esc(sp(t.p).name)}</b>${t.richtig ? `<span class="richtig">hat es erraten!</span>` : t.knapp ? `<span class="knapp">ist ganz nah dran</span>` : `<span>${esc(t.text)}</span>`}</li>`).join("") || `<li class="leise">Noch keine Tipps.</li>`;
      if (tl.innerHTML !== html) tl.innerHTML = html;
    }
    const le = document.getElementById("leiste");
    if (le) {
      const html = S.reihenfolge.filter(p => S.spieler[p]).map(p => `<div class="mitspieler ${p === v.maler && v.phase !== "ende" ? "maler" : ""} ${v.geraten && v.geraten[p] !== undefined ? "hat" : ""} ${online(p) ? "" : "weg"}"><span>${p === v.maler && v.phase !== "ende" ? "✏️ " : ""}${esc(sp(p).name)}</span><b>${sp(p).punkte}</b></div>`).join("");
      if (le.innerHTML !== html) le.innerHTML = html;
    }
  }
  setInterval(() => { if (rolle === "client" && offlineSeit) aktualisiere(); }, 5000);

  function kopf() {
    return `<div class="status" id="status" hidden><span></span><button class="klein" id="uebernehmen" hidden>Spielleitung übernehmen</button></div>`;
  }
  function baue() {
    let h = kopf();
    if (!rolle) h += code ? bildschirmName() : bildschirmStart();
    else if (rolle === "pruefen" || !S) h += `<div class="mitte"><p class="leise">${window.ABEND ? ABEND.warten() : "Verbinde …"}</p></div>`;
    else h += ({ lobby: bildschirmLobby, waehlen: bildschirmWaehlen, malen: bildschirmMalen, aufloesung: bildschirmAufloesung, ende: bildschirmEnde }[S.phase] || (() => ""))();
    app.innerHTML = h;
    binden();
  }

  // Titelbild: klingelnder Wecker mit Buntstiften als Zeigern, daneben ein Zettel mit misslungener Katze
  const TITELBILD = `<svg class="titelbild" viewBox="0 0 320 150" role="img" aria-label="Ein klingelnder Wecker mit zwei Buntstiften als Zeigern, daneben ein Zettel mit einer gekritzelten Katze"><rect x="2" y="2" width="316" height="146" rx="20" fill="#2A3150"/><g transform="rotate(5 232 82)"><rect x="182" y="40" width="102" height="84" rx="4" fill="#FFFFFF" stroke="#141826" stroke-width="2.4"/></g><g transform="translate(232 82) rotate(6) scale(.62) translate(-96 -84)" fill="none" stroke="#16161D" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M86 112c-14-2-20-16-14-30 4-10 14-14 24-14 10 0 20 4 24 14 6 14 0 28-14 30z"/><path d="M78 74l-4-18 14 10M114 74l4-18-14 10"/><circle cx="88" cy="86" r="2.6" fill="#16161D" stroke="none"/><circle cx="104" cy="88" r="2.6" fill="#16161D" stroke="none"/><path d="M93 94l3 2 3-2" stroke="#E05A4E"/><path d="M72 92l-14-2M72 97l-13 3M120 92l14-2M120 97l13 3" stroke-width="2.2"/><path d="M124 110c14 0 22-8 20-20"/></g><path d="M135.1 114.7L125.4 128.1" stroke="#141826" stroke-width="4.199999999999999" stroke-linecap="round"/><path d="M80.9 114.7L90.6 128.1" stroke="#141826" stroke-width="4.199999999999999" stroke-linecap="round"/><g transform="translate(75.0 45.4) rotate(-42)"><path d="M-18.5 5.3A18.5 18.5 0 0 1 18.5 5.3z" fill="#FBF7EF" stroke="#141826" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="-14.5" r="3.5" fill="#141826"/></g><g transform="translate(141.0 45.4) rotate(42)"><path d="M-18.5 5.3A18.5 18.5 0 0 1 18.5 5.3z" fill="#FBF7EF" stroke="#141826" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="-14.5" r="3.5" fill="#141826"/></g><path d="M108 38V28.32" stroke="#141826" stroke-width="3" stroke-linecap="round"/><circle cx="108" cy="26.6" r="4.0" fill="#141826"/><circle cx="108" cy="82" r="44" fill="#FBF7EF" stroke="#141826" stroke-width="3"/><circle cx="108" cy="82" r="37.0" fill="none" stroke="#D9CDB8" stroke-width="1.7999999999999998"/><line x1="108.0" y1="47.7" x2="108.0" y2="53.0" stroke="#141826" stroke-width="1.7999999999999998" stroke-linecap="round"/><line x1="125.2" y1="52.3" x2="123.8" y2="54.6" stroke="#141826" stroke-width="1.7999999999999998" stroke-linecap="round"/><line x1="137.7" y1="64.8" x2="135.4" y2="66.2" stroke="#141826" stroke-width="1.7999999999999998" stroke-linecap="round"/><line x1="142.3" y1="82.0" x2="137.0" y2="82.0" stroke="#141826" stroke-width="1.7999999999999998" stroke-linecap="round"/><line x1="137.7" y1="99.2" x2="135.4" y2="97.8" stroke="#141826" stroke-width="1.7999999999999998" stroke-linecap="round"/><line x1="125.2" y1="111.7" x2="123.8" y2="109.4" stroke="#141826" stroke-width="1.7999999999999998" stroke-linecap="round"/><line x1="108.0" y1="116.3" x2="108.0" y2="111.0" stroke="#141826" stroke-width="1.7999999999999998" stroke-linecap="round"/><line x1="90.8" y1="111.7" x2="92.2" y2="109.4" stroke="#141826" stroke-width="1.7999999999999998" stroke-linecap="round"/><line x1="78.3" y1="99.2" x2="80.6" y2="97.8" stroke="#141826" stroke-width="1.7999999999999998" stroke-linecap="round"/><line x1="73.7" y1="82.0" x2="79.0" y2="82.0" stroke="#141826" stroke-width="1.7999999999999998" stroke-linecap="round"/><line x1="78.3" y1="64.8" x2="80.6" y2="66.2" stroke="#141826" stroke-width="1.7999999999999998" stroke-linecap="round"/><line x1="90.8" y1="52.3" x2="92.2" y2="54.6" stroke="#141826" stroke-width="1.7999999999999998" stroke-linecap="round"/><line x1="47.6" y1="44.2" x2="40.8" y2="40.0" stroke="#E05A4E" stroke-width="2.7" stroke-linecap="round"/><line x1="31.8" y1="57.3" x2="26.0" y2="55.4" stroke="#E05A4E" stroke-width="2.7" stroke-linecap="round"/><line x1="168.4" y1="44.2" x2="175.2" y2="40.0" stroke="#E05A4E" stroke-width="2.7" stroke-linecap="round"/><line x1="184.2" y1="57.3" x2="190.0" y2="55.4" stroke="#E05A4E" stroke-width="2.7" stroke-linecap="round"/><g transform="translate(108 82) rotate(-58)" stroke="#141826" stroke-width="1.8" stroke-linejoin="round"><rect x="-3.2" y="-15.200000000000003" width="6.4" height="11.200000000000003" rx="1" fill="#4F72B8"/><path d="M-3.2 -15.200000000000003L0 -24.200000000000003L3.2 -15.200000000000003z" fill="#EAD9BC"/><path d="M-1 -21.200000000000003L0 -24.200000000000003L1 -21.200000000000003z" fill="#4F72B8" stroke="none"/></g><g transform="translate(108 82) rotate(52)" stroke="#141826" stroke-width="1.8" stroke-linejoin="round"><rect x="-3.2" y="-26.200000000000003" width="6.4" height="22.200000000000003" rx="1" fill="#E05A4E"/><path d="M-3.2 -26.200000000000003L0 -35.2L3.2 -26.200000000000003z" fill="#EAD9BC"/><path d="M-1 -32.2L0 -35.2L1 -32.2z" fill="#E05A4E" stroke="none"/></g><circle cx="108" cy="82" r="3.5" fill="#141826"/></svg>`;
  const WECKER = '<svg class="weckersymbol" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.6M4 6.2 6.6 3.8M20 6.2 17.4 3.8M7 19.6 5.6 21M17 19.6l1.4 1.4"/></svg>';
  const wahlKnoepfe = (id, werte, an, text) => `<div class="wahl" id="${id}">${werte.map(w => `<button data-v="${w}" class="${w === an ? "an" : ""}">${text(w)}</button>`).join("")}</div>`;
  function bildschirmStart() {
    return `<header class="titel">${TITELBILD}<h1>Malalarm</h1><p class="leise">Reihum malt einer einen Begriff, alle anderen raten auf ihrem Handy. Wer schneller rät, bekommt mehr Punkte.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
      <div class="karte"><h2>Neues Spiel</h2>
        <p class="leise klein">Zeit zum Malen</p>${wahlKnoepfe("wZeit", KR.ZEITEN, 80, w => w + " s")}
        <p class="leise klein">Jeder malt</p>${wahlKnoepfe("wDurch", KR.DURCHGAENGE, 1, w => w + "×")}
        <button class="knopf" id="neu">Raum erstellen</button></div>
      <div class="karte"><h2>Mitspielen</h2>
        <label class="feld">Raumcode<input id="code" maxlength="4" autocapitalize="characters" placeholder="z. B. K7M2"></label>
        <button class="knopf zweit" id="beitreten">Beitreten</button></div>
      <a class="link" href="../">Alle Spiele</a>`;
  }
  function bildschirmName() {
    return `<header class="titel">${TITELBILD}<h1>Malalarm</h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
      <button class="knopf" id="mitspielen">Mitspielen</button>`;
  }
  function bildschirmLobby() {
    const host = rolle === "host", da = S.reihenfolge.filter(p => S.spieler[p] && online(p));
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
    return `<header class="titel"><p class="etikett">Malalarm · Raumcode</p><div class="code">${esc(code)}</div></header>
      ${qr ? `<div class="qr">${qr}</div>` : ""}
      <div class="reihe"><button class="knopf zweit" id="teilen">Link teilen</button><button class="knopf zweit" id="kopieren">Link kopieren</button></div>
      <div class="karte"><h2>Im Raum (${da.length})</h2><ul class="spieler">${S.reihenfolge.filter(p => S.spieler[p]).map(p => `<li><i class="punkt ${online(p) ? "an" : ""}"></i>${esc(sp(p).name)}${p === S.host ? " <small>Spielleiter</small>" : ""}${p === PID ? " <small>du</small>" : ""}</li>`).join("")}</ul></div>
      <div class="karte"><h2>Einstellungen</h2>
        ${host ? `<p class="leise klein">Zeit zum Malen</p>${wahlKnoepfe("eZeit", KR.ZEITEN, S.zeit, w => w + " s")}<p class="leise klein">Jeder malt</p>${wahlKnoepfe("eDurch", KR.DURCHGAENGE, S.durchgaenge, w => w + "×")}`
          : `<p class="leise">${S.zeit} Sekunden zum Malen · jeder malt ${S.durchgaenge}×</p>`}</div>
      <div class="karte"><h2>So geht's</h2><ul class="regeln">
        <li>Wer dran ist, wählt einen von drei Begriffen: <b>leicht, mittel oder schwer</b>. Die anderen sehen nur die Lücken.</li>
        <li>Alle anderen tippen ihre Tipps ein. Falsche Tipps sehen alle, richtige nicht. Bei „ganz nah dran“ fehlt nur ein Buchstabe oder zwei.</li>
        <li>Richtig geraten bringt <b>100 bis 40 Punkte</b>, je schneller, desto mehr. Der Maler bekommt bis zu 100, je mehr es erraten.</li>
        <li>Bei halber und bei einem Viertel der Zeit wird ein Buchstabe aufgedeckt.</li></ul></div>
      ${host ? `<div class="unten"><button class="knopf" id="start" ${da.length < 2 ? "disabled" : ""}>${da.length < 2 ? "Warte auf Mitspieler …" : "Spiel starten"}</button></div>`
        : `<p class="leise mitte">Warte, bis ${esc(sp(S.host).name)} das Spiel startet.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }
  const leiste = () => `<div class="leiste" id="leiste" aria-label="Punkte"></div>`;
  const zugText = () => `Zug ${Math.min(S.zug + 1, S.reihe.length)} von ${S.reihe.length}`;
  const ueberspringen = text => rolle === "host" ? `<button class="link" id="ueberspringen">${text}</button>` : "";
  function bildschirmWaehlen() {
    const v = ansicht();
    if (v.maler === PID) return `${leiste()}<div class="spielkopf"><div><p class="etikett">${zugText()}</p><h2>Du malst! Such dir einen Begriff aus</h2></div><div class="wecker" id="wecker">${WECKER}<span class="zeit" id="zeit"></span></div></div>
      <div class="auswahl">${(v.auswahl || []).map((a, i) => `<button data-wahl="${i}"><span>${esc(a.w)}</span><small>${a.st}</small></button>`).join("")}</div>
      <p class="leise klein mitte">Wählst du nicht, wird gelost.</p>${ueberspringen("Diesen Zug überspringen")}`;
    return `${leiste()}<div class="spielkopf"><div><p class="etikett">${zugText()}</p><h2>${esc(sp(v.maler).name)} sucht sich einen Begriff aus …</h2></div><div class="wecker" id="wecker">${WECKER}<span class="zeit" id="zeit"></span></div></div>
      <div class="bildbox" id="bild"></div>
      <p class="leise mitte">Gleich wird gemalt. Halte die Finger bereit!</p>${ueberspringen(`${esc(sp(v.maler).name)} überspringen`)}`;
  }
  function bildschirmMalen() {
    const v = ansicht();
    if (v.maler === PID) return `<div class="spielkopf"><div><p class="etikett">Male</p><div class="malwort">${esc(v.wort)}</div></div><div class="wecker" id="wecker">${WECKER}<span class="zeit" id="zeit"></span></div></div>
      <div class="malbox" id="malbox"></div>
      <p class="leise klein">Mit zwei Fingern heranzoomen und verschieben.</p>
      ${MALHILFE.farbKnoepfe(malFarbe)}
      <div class="werkzeug">${[1, 2, 3].map(d => `<button class="klein ${d === malDicke ? "an" : ""}" data-dicke="${d}">${["Fein", "Mittel", "Dick"][d - 1]}</button>`).join("")}
        <button class="klein" id="rueckgaengig">Rückgängig</button><button class="klein" id="loeschen">Alles löschen</button></div>
      <p class="leise klein">Keine Buchstaben oder Zahlen malen, das wäre geschummelt.</p>
      <div class="karte"><h2>Die Tipps der anderen</h2><ul class="tippliste" id="tippliste"></ul></div>
      ${leiste()}${ueberspringen("Zug beenden")}`;
    return `${leiste()}<div class="spielkopf"><div><p class="etikett">${esc(sp(v.maler).name)} malt</p></div><div class="wecker" id="wecker">${WECKER}<span class="zeit" id="zeit"></span></div></div>
      <div class="maske" id="maske" role="img"></div>
      <div class="bildbox" id="bild"></div>
      ${geraten() ? `<div class="karte mitte"><h2>Richtig: ${esc(v.wort)} ✓</h2><p class="leise">+${v.geraten[PID]} Punkte. Mal sehen, wer es noch errät …</p></div>`
        : `<form class="raten" id="raten" autocomplete="off"><input id="tipp" maxlength="40" placeholder="Dein Tipp …" autocomplete="off" autocapitalize="sentences" enterkeyhint="send" aria-label="Dein Tipp"><button class="knopf" type="submit">Raten</button></form>`}
      <div class="karte"><ul class="tippliste" id="tippliste"></ul></div>${ueberspringen("Zug beenden")}`;
  }
  function bildschirmAufloesung() {
    const l = S.letzte || {}, wer = Object.keys(l.geraten || {}).sort((a, b) => l.geraten[b] - l.geraten[a]);
    return `${leiste()}<p class="etikett mitte">${esc(sp(l.maler).name)} hat gemalt</p><p class="loesung">${esc(l.wort)}</p>
      <div class="bildbox" id="bild"></div>
      <div class="karte">${wer.length ? `<ul class="spieler">${wer.map(p => `<li>${esc(sp(p).name)} <small>+${l.geraten[p]}</small></li>`).join("")}<li>✏️ ${esc(sp(l.maler).name)} <small>+${l.malerPunkte}</small></li></ul>`
        : `<p class="leise">Diesmal hat es niemand erraten.</p>`}</div>
      <p class="leise mitte">${S.zug + 1 >= S.reihe.length ? "Gleich kommt der Endstand …" : "Gleich ist der Nächste dran …"}</p>${ueberspringen("Weiter")}`;
  }
  function bildschirmEnde() {
    const r = rangliste();
    return `<header class="titel"><p class="etikett">Endstand</p><h1>${esc(sp(r[0]).name)} gewinnt</h1></header>
      <ol class="rang">${r.map((p, i) => `<li><span class="platz">${i + 1}</span><span class="n">${esc(sp(p).name)}</span><b>${sp(p).punkte}</b></li>`).join("")}</ol>
      ${G.length ? `<div class="karte"><h2>Alle Bilder</h2><div class="galerie">${G.map((g, i) => `<figure><div class="bildbox" data-galerie="${i}"></div><figcaption><b>${esc(g.wort)}</b> von ${esc(sp(g.maler).name)}</figcaption></figure>`).join("")}</div></div>` : ""}
      ${rolle === "host" ? `<div class="unten"><button class="knopf" id="nochmal">Nochmal spielen</button></div>` : `<p class="leise mitte">${esc(sp(S.host).name)} kann eine neue Runde starten.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }

  function binden() {
    const $ = id => document.getElementById(id);
    const nameAus = () => { const n = ($("name").value || "").trim().slice(0, 20); if (!n) { $("name").focus(); return null; } name = n; ls.set("slf:name", n); return n; };
    const gewaehlt = id => +document.querySelector("#" + id + " .an").dataset.v;
    if ($("uebernehmen")) $("uebernehmen").onclick = uebernehmen;
    document.querySelectorAll(".wahl").forEach(w => w.querySelectorAll("button").forEach(b => b.onclick = () => {
      w.querySelectorAll("button").forEach(x => x.classList.remove("an")); b.classList.add("an");
      if (w.id === "eZeit") tun({ t: "einstellungen", zeit: +b.dataset.v });
      if (w.id === "eDurch") tun({ t: "einstellungen", durchgaenge: +b.dataset.v });
    }));
    if ($("neu")) $("neu").onclick = () => { if (nameAus()) neuesSpiel(gewaehlt("wZeit"), gewaehlt("wDurch")); };
    if ($("beitreten")) $("beitreten").onclick = () => {
      if (!nameAus()) return;
      const c = ($("code").value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.length !== 4) { $("code").focus(); return; }
      code = c; location.replace("?raum=" + code + testTeil());   // neu laden: war ich hier Spielleiter, geht es als Spielleiter weiter
    };
    if ($("mitspielen")) $("mitspielen").onclick = () => { if (nameAus()) clientStarten(); };
    if ($("teilen")) $("teilen").onclick = () => { if (navigator.share) navigator.share({ title: "Malalarm", text: "Spiel mit! Raum " + code, url: link() }).catch(() => {}); else kopieren(); };
    if ($("kopieren")) $("kopieren").onclick = kopieren;
    if ($("start")) $("start").onclick = () => tun({ t: "start", teilnehmer: S.reihenfolge.filter(p => S.spieler[p] && online(p)) });
    if ($("nochmal")) $("nochmal").onclick = () => tun({ t: "neustart" });
    if ($("ueberspringen")) $("ueberspringen").onclick = () => tun({ t: "ueberspringen" });
    if ($("verlassen")) $("verlassen").onclick = verlassen;
    document.querySelectorAll("[data-wahl]").forEach(b => b.onclick = () => tun({ t: "waehlen", nr: S.nr, i: +b.dataset.wahl }));
    if ($("raten")) $("raten").onsubmit = ev => {
      ev.preventDefault();
      const i = $("tipp"), t = (i.value || "").trim(); if (!t) return;
      tun({ t: "tipp", nr: S.nr, text: t }); i.value = ""; i.focus();
    };
    if ($("malbox")) malen($("malbox"));
    if ($("bild")) bildZeichnen();
    document.querySelectorAll("[data-galerie]").forEach(b => { const g = G[+b.dataset.galerie]; if (g) { const cv = leinwand(b); zeichne(cv.getContext("2d"), cv.width, cv.height, g.striche); } });
  }
  function kopieren() {
    const b = document.getElementById("kopieren");
    const fertig = () => { if (b) { b.textContent = "Kopiert"; setTimeout(() => { b.textContent = "Link kopieren"; }, 1500); } };
    try { navigator.clipboard.writeText(link()).then(fertig, () => prompt("Link kopieren:", link())); } catch (e) { prompt("Link kopieren:", link()); }
  }
  // Fenstergröße geändert: Leinwände in neuer Breite aufbauen (das Bild bleibt erhalten)
  let groesse = window.innerWidth;
  window.addEventListener("resize", () => { if (Math.abs(window.innerWidth - groesse) < 40) return; groesse = window.innerWidth; letzteSig = ""; render(); });

  // ---------- Start ----------
  if (typeof Peer === "undefined") { app.innerHTML = `<div class="mitte"><p>Die Verbindungsbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.</p></div>`; return; }
  if (code) {
    const gespeichert = ls.get("kr:host:" + code);
    if (gespeichert && gespeichert.S) fortsetzenAlsHost(gespeichert);
    else if (name) clientStarten();
    else render();
  } else render();
  window.__kr = { get S() { return S; }, get B() { return B; }, get G() { return G; }, get rolle() { return rolle; }, get verbunden() { return verbunden; }, PID, tun: params.get("test") ? tun : undefined };
})();
