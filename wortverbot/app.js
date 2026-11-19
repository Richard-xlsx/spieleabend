// Umschreiben (früher Wortverbot): Verbindung (Handy des Spielleiters ist der Server, PeerJS) und Oberfläche. Regeln in logic.js (window.WV).
// Die Karte kennt nur der Spielleiter; jeder Mitspieler bekommt mit WV.sicht() seine eigene Fassung des Zustands.
// In Zeichen-Runden schickt der Zeichner sein ganzes Bild alle 150 ms, der Spielleiter reicht es an alle weiter.
(function () {
  const WV = window.WV;
  const app = document.getElementById("app");
  const PREFIX = "fmwwv-";
  const ZEICHEN = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
  const FARBEN = ["#16161D", "#E23B2E", "#2F6FDE", "#2E9B4F", "#F2B705", "#8B5A2B", "#FFFFFF"];   // alte Farbnummern
  const farbWert = f => typeof f === "string" ? f : (FARBEN[f] || FARBEN[0]);
  const DICKE = { 1: 5, 2: 12, 3: 28 };
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
  let B = { k: 0, striche: [] };      // Bild der aktuellen Karte (nur in Zeichen-Runden)
  let malFarbe = MALHILFE.STANDARD, malDicke = 2, schmutzig = false, toastTimer = null, getippt = -1;

  const hostId = ep => PREFIX + code + "-" + ep;
  const link = () => location.origin + location.pathname + "?raum=" + code;
  const testTeil = () => (params.get("test") ? "&test=" + params.get("test") : "");
  const ichZeichne = () => S && S.erklaerer === PID && S.phase === "spielen" && S.art === "zeichnen";

  // ---------- Bildschirm wach halten ----------
  let wake = null;
  async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wachHalten(); if (rolle === "client" && !hostConn) verbindeZumHost(); } });
  document.addEventListener("click", wachHalten);

  // ---------- Töne: Summer bei „Erwischt“, Ticken in den letzten Sekunden, Gong am Ende ----------
  let audio = null;
  document.addEventListener("pointerdown", () => { try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch (e) {} }, true);
  function ton(freq, dauer, art, laut) {
    if (!audio || audio.state !== "running") return;
    try {
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      o.type = art || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(laut || 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + dauer);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + dauer);
    } catch (e) {}
  }
  const summer = () => { ton(140, 0.5, "sawtooth", 0.2); ton(147, 0.5, "square", 0.08); try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) {} };
  const ding = () => { ton(880, 0.18); setTimeout(() => ton(1320, 0.25), 90); };
  const gong = () => { ton(392, 0.9, "triangle", 0.25); setTimeout(() => ton(262, 1.2, "triangle", 0.25), 250); try { navigator.vibrate && navigator.vibrate(300); } catch (e) {} };
  let vorher = null;
  function geraeusche() {
    const a = vorher, n = S; vorher = n && { phase: n.phase, zug: n.zug, k: n.karten ? n.karten.length : 0, rest: n.rest, letzte: n.karten && n.karten.length ? n.karten[n.karten.length - 1].e : null };
    if (!a || !n) return;
    if (a.phase === "spielen" && n.phase !== "spielen") { gong(); return; }
    if (n.phase !== "spielen" || a.phase !== "spielen" || a.zug !== n.zug) return;
    if (n.karten.length > a.k) { const e = n.karten[n.karten.length - 1].e; if (e === "erwischt") summer(); else if (e === "richtig") ding(); }
    if (n.rest !== a.rest && n.rest > 0 && n.rest <= 5) ton(1000, 0.06, "square", 0.08);
  }

  // ---------- Spielleiter ----------
  function speichernHost(sofort) {
    clearTimeout(speicherTimer);
    const f = () => ls.set("wv:host:" + code, { S, B });
    if (sofort) f(); else speicherTimer = setTimeout(f, 800);
  }
  function hostStarten(z) {
    rolle = "host"; S = z.S; B = z.B || { k: S.k, striche: [] }; S.host = PID;
    if (S.spieler[PID]) S.spieler[PID].name = name || S.spieler[PID].name;
    speichernHost(true); oeffneHostPeer();
    if (!tickTimer) tickTimer = setInterval(() => { if (rolle === "host") { const n = WV.tick(S); if (n !== S) setze(n); } }, 1000);
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
  function setze(neu) {
    S = neu;
    if (B.k !== S.k) B = { k: S.k, striche: [] };
    geaendert();
  }
  function vonClient(c, m) {
    if (!m || !m.pid) return;
    if (m.t === "hallo") {
      conns.set(m.pid, c);
      const r = WV.aktion(S, m.pid, m); if (r.ok) S = r.S;
      geaendert();
      if (S.phase === "spielen" && S.art === "zeichnen") sende(c, { t: "bild", k: B.k, striche: B.striche });
      return;
    }
    if (m.t === "bild") return bildVomZeichner(m.pid, m);
    const r = WV.aktion(S, m.pid, m);
    if (!r.ok) { sende(c, { t: "fehler", text: r.fehler }); return; }
    setze(r.S);
  }
  function bildVomZeichner(pid, m) {
    if (!S || S.phase !== "spielen" || S.art !== "zeichnen" || pid !== S.erklaerer || m.k !== S.k) return;
    if (pid !== PID) { B = { k: S.k, striche: WV.striche(m.striche) }; bildZeichnen(); }
    anAlle({ t: "bild", k: B.k, striche: B.striche }, pid);
    speichernHost();
  }
  function geaendert() {
    S.online = [PID].concat([...conns.keys()]);
    speichernHost();
    for (const [p, c] of conns) sende(c, { t: "zustand", s: WV.sicht(S, p) });
    geraeusche();
    render();
  }

  // ---------- Mitspieler ----------
  function clientStarten() {
    rolle = "client";
    const k = ls.get("wv:kopie:" + code); if (k) S = k;
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
        S = m.s; ls.set("wv:kopie:" + code, S);
        if (B.k !== S.k) { B = { k: S.k, striche: [] }; schmutzig = false; }
        geraeusche();
        render();
      } else if (m.t === "bild") bildEmpfangen(m);
      else if (m.t === "fehler") toast(m.text);
    });
    c.on("close", () => { if (hostConn === c) { hostConn = null; verloren(); } });
    c.on("error", () => {});
    retryTimer = setTimeout(() => { if (t === token && hostConn !== c) { try { c.close(); } catch (e) {} fehlschlag(t); } }, window.SPIELEABEND_WARTEN || 12000);
  }
  function bildEmpfangen(m) {
    if (m.k !== B.k) return;
    // Der Zeichner nach dem Neuladen: sein Bild ist leer, also das vom Spielleiter übernehmen
    if (ichZeichne()) { if ((m.striche || []).length > B.striche.length) { B.striche = m.striche; zeichenflaecheNeu(); } return; }
    B.striche = m.striche || [];
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
    const s = WV.uebernahme(S);
    ls.del("wv:kopie:" + code); clearTimeout(retryTimer); token++;
    if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
    hostStarten({ S: s });
  }
  function fortsetzenAlsHost(gespeichert) {
    rolle = "pruefen"; render();
    const probe = new Peer(undefined, PEER_OPT); let fertig = false;
    const ende = alsClient => {
      if (fertig) return; fertig = true; try { probe.destroy(); } catch (e) {}
      if (alsClient) { ls.del("wv:host:" + code); ls.set("wv:kopie:" + code, WV.sicht(gespeichert.S, PID)); clientStarten(); }
      else hostStarten(gespeichert);
    };
    probe.on("open", () => { const c = probe.connect(hostId(gespeichert.S.epoch + 1), { serialization: "json" }); c.on("open", () => ende(true)); });
    probe.on("error", () => ende(false));
    setTimeout(() => ende(false), 4000);
  }

  // ---------- Aktionen ----------
  function tun(m) {
    if (rolle === "host") {
      const r = WV.aktion(S, PID, m);
      if (!r.ok) { toast(r.fehler); return; }
      setze(r.S);
    } else if (hostConn && hostConn.open) sende(hostConn, Object.assign({ pid: PID }, m));
    else toast("Keine Verbindung zum Spielleiter.");
  }
  // Karten-Knöpfe: pro Karte nur einmal tippen (doppeltes Tippen würde sonst die nächste Karte treffen)
  // Nach jedem Tipp kurz sperren: ein Doppeltipp soll nicht die nächste Karte ungesehen mitnehmen
  let sperreBis = 0;
  function karteTippen(t) {
    if (!S || S.phase !== "spielen" || getippt === S.k || Date.now() < sperreBis) return;
    getippt = S.k; sperreBis = Date.now() + 700;
    document.querySelectorAll("[data-karte]").forEach(b => { b.disabled = true; });
    tun({ t, k: S.k });
  }
  function toast(t, art) {
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.className = "toast " + (art || ""); el.textContent = t; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }
  function neuesSpiel(einst) {
    code = (window.ABEND && ABEND.neuerRaum()) || Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
    history.replaceState(null, "", "?raum=" + code + testTeil());
    hostStarten({ S: WV.neu(code, PID, name, einst) });
  }
  function verlassen() {
    for (const k of ["wv:host:", "wv:kopie:"]) ls.del(k + code);
    location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : "");
  }
  // Bild an den Spielleiter, solange sich etwas geändert hat
  setInterval(() => {
    if (!schmutzig || !ichZeichne()) return;
    schmutzig = false;
    const m = { t: "bild", k: S.k, striche: B.striche.map(s => ({ f: s.f, d: s.d, p: s.p.slice() })) };
    if (rolle === "host") bildVomZeichner(PID, m);
    else if (hostConn && hostConn.open) sende(hostConn, Object.assign({ pid: PID }, m));
    else schmutzig = true;
  }, 150);

  // ---------- Zeichnen und Anzeigen ----------
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
    if (!cv) { cv = leinwand(box); MALHILFE.zoom(box, cv, { key: "wv-bild-" + B.nr, neu: bildZeichnen }); }
    zeichne(cv.getContext("2d"), cv.width, cv.height, B.striche);
  }
  let zeichenflaecheNeu = () => {};
  function malen(box) {
    const cv = leinwand(box), ctx = cv.getContext("2d");
    let aktuell = null;
    const punkte = () => B.striche.reduce((a, s) => a + s.p.length / 2, 0);
    const neu = zeichenflaecheNeu = () => zeichne(ctx, cv.width, cv.height, B.striche);
    const pos = ev => { const r = cv.getBoundingClientRect(); return [Math.round((ev.clientX - r.left) / r.width * 1000), Math.round((ev.clientY - r.top) / r.height * 750)]; };
    neu();
    const zm = MALHILFE.zoom(box, cv, { key: "wv-mal-" + S.nr, malen: true, neu, abbrechen: () => {
      if (!aktuell) return;
      if (aktuell.p.length <= 16 && B.striche[B.striche.length - 1] === aktuell) B.striche.pop();
      aktuell = null; schmutzig = true; neu();
    } });
    cv.addEventListener("pointerdown", ev => {
      ev.preventDefault();
      if (zm.gesperrt() || aktuell || !ichZeichne()) return;
      if (punkte() >= WV.MAX_PUNKTE) { toast("Das Bild ist voll. Rückgängig macht wieder Platz."); return; }
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
      aktuell = { f: malFarbe, d: malDicke, p: pos(ev), id: ev.pointerId }; B.striche.push(aktuell); neu(); schmutzig = true;
    });
    cv.addEventListener("pointermove", ev => {
      if (!aktuell || ev.pointerId !== aktuell.id || zm.gesperrt()) return; ev.preventDefault();
      const [x, y] = pos(ev), n = aktuell.p.length;
      if (Math.hypot(x - aktuell.p[n - 2], y - aktuell.p[n - 1]) < 4 / zm.z) return;
      if (punkte() >= WV.MAX_PUNKTE) return;
      aktuell.p.push(Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(750, y)));
      const sx = cv.width / 1000, sy = cv.height / 750;
      ctx.strokeStyle = farbWert(aktuell.f); ctx.lineWidth = DICKE[aktuell.d] * sx; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(aktuell.p[n - 2] * sx, aktuell.p[n - 1] * sy); ctx.lineTo(aktuell.p[n] * sx, aktuell.p[n + 1] * sy); ctx.stroke();
      schmutzig = true;
    });
    const ende = ev => { if (aktuell && ev.pointerId === aktuell.id) { delete aktuell.id; aktuell = null; schmutzig = true; } };
    cv.addEventListener("pointerup", ende); cv.addEventListener("pointercancel", ende); cv.addEventListener("pointerleave", ende);
    MALHILFE.farbenBinden(f => { malFarbe = f; });
    document.querySelectorAll("[data-dicke]").forEach(b => b.onclick = () => { malDicke = +b.dataset.dicke; document.querySelectorAll("[data-dicke]").forEach(x => x.classList.toggle("an", x === b)); });
    const z = document.getElementById("rueckgaengig");
    if (z) z.onclick = () => { if (aktuell) return; B.striche.pop(); schmutzig = true; neu(); };
    const l = document.getElementById("loeschen");
    if (l) l.onclick = () => { B.striche = []; schmutzig = true; neu(); };
  }

  // ---------- Oberfläche ----------
  const sp = p => (S && S.spieler[p]) || { name: "?" };
  const online = p => !!(S && S.online && S.online.includes(p));
  const ansicht = () => (rolle === "host" ? WV.sicht(S, PID) : S);      // der Spielleiter sieht im Spiel nur, was sein Team sehen darf
  const zeit = s => s == null ? "" : Math.floor(s / 60) + ":" + String(Math.max(0, s) % 60).padStart(2, "0");
  const teamName = t => WV.TEAMS[t].zeichen + " " + WV.TEAMS[t].name;
  const meinTeam = () => S && S.team ? S.team[PID] : undefined;
  // Was ich gerade bin: erklaerer, rater (mein Team ist dran) oder waechter (anderes Team, sieht die Karte)
  const rolleImZug = () => !S || !["bereit", "spielen"].includes(S.phase) ? "" : S.erklaerer === PID ? "erklaerer" : meinTeam() === S.teamDran ? "rater" : "waechter";

  function statusZeile() {
    if (rolle === "host") return verbunden ? "" : (fehlerText || "Raum wird geöffnet …");
    if (rolle === "client" && !verbunden) return S ? "Verbindung zum Spielleiter weg, verbinde neu …" : (fehlerText || (window.ABEND && ABEND.aktiv ? "" : "Verbinde mit Raum " + code + " …"));
    return "";
  }
  function sig() {
    if (!rolle) return "start:" + (code ? "name" : "neu");
    if (rolle === "pruefen" || !S) return "warte";
    return [rolle, S.phase, S.zug, S.phase === "spielen" ? S.k : "", rolleImZug(), meinTeam(), ["lobby", "bereit", "ende"].includes(S.phase) ? S.aenderung + "/" + (S.online || []).join(",") : ""].join(":");
  }
  function render() {
    const s = sig();
    if (s !== letzteSig) { letzteSig = s; baue(); }
    aktualisiere();
  }
  const kartenListe = karten => karten.length ? karten.map(k => `<li class="${k.e}"><span>${esc(k.w)}</span><b>${k.e === "richtig" ? "✓ richtig" : k.e === "erwischt" ? "✗ erwischt" + (k.von ? " von " + esc(sp(k.von).name) : "") : "übersprungen"}</b></li>`).join("") : `<li class="leise">Noch keine Karte.</li>`;
  function aktualisiere() {
    const st = document.getElementById("status");
    if (st) {
      const t = statusZeile(); st.hidden = !t; st.querySelector("span").textContent = t;
      st.querySelector("button").hidden = !(rolle === "client" && S && offlineSeit && Date.now() - offlineSeit > 20000);
    }
    if (!S || rolle === "pruefen") return;
    const z = document.getElementById("zeit");
    if (z) { z.textContent = zeit(S.rest); z.classList.toggle("knapp", S.phase === "spielen" && S.rest <= 10); }
    const st2 = document.getElementById("stand");
    if (st2) {
      const html = [0, 1].map(t => `<div class="teamstand t${t} ${["bereit", "spielen"].includes(S.phase) && S.teamDran === t ? "dran" : ""}"><span>${teamName(t)}</span><b>${S.punkte[t]}</b></div>`).join("");
      if (st2.innerHTML !== html) st2.innerHTML = html;
    }
    const kl = document.getElementById("kartenliste");
    if (kl) { const html = kartenListe(S.karten.slice().reverse()); if (kl.innerHTML !== html) kl.innerHTML = html; }
  }
  setInterval(() => { if (rolle === "client" && offlineSeit) aktualisiere(); }, 5000);

  function kopf() {
    return `<div class="status" id="status" hidden><span></span><button class="klein" id="uebernehmen" hidden>Spielleitung übernehmen</button></div>`;
  }
  function baue() {
    let h = kopf();
    if (!rolle) h += code ? bildschirmName() : bildschirmStart();
    else if (rolle === "pruefen" || !S) h += `<div class="mitte"><p class="leise">${window.ABEND ? ABEND.warten() : "Verbinde …"}</p></div>`;
    else h += ({ lobby: bildschirmLobby, bereit: bildschirmBereit, spielen: bildschirmSpielen, ende: bildschirmEnde }[S.phase] || (() => ""))();
    app.innerHTML = h;
    binden();
  }

  // Titelbild: Karte mit durchgestrichenen Wörtern, Sanduhr und Summer
  const TITELBILD = `<svg class="titelbild" viewBox="0 0 320 150" role="img" aria-label="Eine Silbermedaille mit durchgestrichenem Wort und eine Goldmedaille mit Sprechblase">
    <rect x="2" y="2" width="316" height="146" rx="20" fill="#262D36"/>
    <g fill="#E9B949"><path d="M268 34l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path d="M286 98l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" opacity=".8"/><path d="M44 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#C3CBD3" opacity=".8"/></g>
    <g transform="rotate(-9 104 92)">
      <path d="M82 10h14l14 48h-14z" fill="#7FB2FF" stroke="#14181E" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M126 10h-14l-14 48h14z" fill="#5E8ED6" stroke="#14181E" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="104" cy="94" r="36" fill="#C3CBD3" stroke="#14181E" stroke-width="2.6"/>
      <circle cx="104" cy="94" r="28" fill="#DDE3E8" stroke="#8E98A3" stroke-width="2"/>
      <rect x="84" y="86" width="40" height="8" rx="4" fill="#8E98A3"/>
      <rect x="90" y="100" width="28" height="6" rx="3" fill="#B2BBC4"/>
      <path d="M80 98l48-16" stroke="#E05A4E" stroke-width="4" stroke-linecap="round"/>
    </g>
    <g transform="rotate(6 196 88)">
      <path d="M170 6h18l16 46h-18z" fill="#FF8A3D" stroke="#14181E" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M222 6h-18l-16 46h18z" fill="#E86E25" stroke="#14181E" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="196" cy="94" r="44" fill="#E9B949" stroke="#14181E" stroke-width="2.6"/>
      <circle cx="196" cy="94" r="35" fill="#F4D27A" stroke="#B8862B" stroke-width="2"/>
      <path d="M176 78h40a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6h-24l-10 8 2-8h-8a6 6 0 0 1-6-6V84a6 6 0 0 1 6-6z" fill="#FFF8E6" stroke="#14181E" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M180 93c4-7 8-7 12 0s8 7 12 0 8-7 12 0" fill="none" stroke="#B8862B" stroke-width="3" stroke-linecap="round"/>
    </g>
  </svg>`;
  const wahlKnoepfe = (id, werte, an, text) => `<div class="wahl" id="${id}">${werte.map(w => `<button data-v="${w}" class="${String(w) === String(an) ? "an" : ""}">${text(w)}</button>`).join("")}</div>`;
  const ARTEN_WAHL = ["nein", "ja"], artenText = w => w === "ja" ? "Mit Zeichnen & Pantomime" : "Nur Erklären";
  function bildschirmStart() {
    return `<header class="titel">${TITELBILD}<h1 class="wortmarke"><span class="silber">Reden ist Silber,</span> <span class="gold">Umschreiben ist Gold</span></h1><p class="leise">Zwei Teams. Erklär deinem Team Begriffe, ohne die verbotenen Wörter zu sagen. Das andere Team liest mit und drückt den Summer.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
      <div class="karte"><h2>Neues Spiel</h2>
        <p class="leise klein">Zeit pro Zug</p>${wahlKnoepfe("wZeit", WV.ZEITEN, 90, w => w + " s")}
        <p class="leise klein">Jeder ist dran</p>${wahlKnoepfe("wDurch", WV.DURCHGAENGE, 1, w => w + "×")}
        <p class="leise klein">Runden</p>${wahlKnoepfe("wArt", ARTEN_WAHL, "nein", artenText)}
        <button class="knopf" id="neu">Raum erstellen</button></div>
      <div class="karte"><h2>Mitspielen</h2>
        <label class="feld">Raumcode<input id="code" maxlength="4" autocapitalize="characters" placeholder="z. B. K7M2"></label>
        <button class="knopf zweit" id="beitreten">Beitreten</button></div>
      <a class="link" href="../">Alle Spiele</a>`;
  }
  function bildschirmName() {
    return `<header class="titel">${TITELBILD}<h1 class="wortmarke"><span class="silber">Reden ist Silber,</span> <span class="gold">Umschreiben ist Gold</span></h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
      <button class="knopf" id="mitspielen">Mitspielen</button>`;
  }
  const regeln = () => `<div class="karte"><h2>So geht's</h2><ul class="regeln">
      <li>Die Teams sind abwechselnd dran. Einer erklärt, sein Team ruft laut, was es meint.</li>
      <li>Der Erklärer darf den Begriff und die <b>verbotenen Wörter</b> nicht sagen, auch keine Teile davon. Kein Zeigen, kein Englisch.</li>
      <li>Das andere Team sieht die Karte mit. Fällt ein verbotenes Wort, tippt es auf <b>Erwischt</b>: ein Punkt für sie.</li>
      <li>Erraten bringt einen Punkt, Überspringen kostet nichts.</li>
      ${S.gemischt ? `<li>Die Runden wechseln: <b>Erklären, Zeichnen, Pantomime</b>. Beim Zeichnen keine Buchstaben, bei der Pantomime kein Wort.</li>` : ""}</ul></div>`;
  function bildschirmLobby() {
    const host = rolle === "host";
    const anz = t => WV.mitglieder(S, t).filter(online).length;
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
    const spalte = t => `<div class="team t${t}"><h2>${teamName(t)} <small>${anz(t)}</small></h2><ul>${WV.mitglieder(S, t).map(p => `<li><button class="person ${online(p) ? "" : "weg"}" data-person="${esc(p)}" ${host || p === PID ? "" : "disabled"}>${esc(sp(p).name)}${p === PID ? " <small>du</small>" : ""}</button></li>`).join("") || `<li class="leise klein">noch niemand</li>`}</ul></div>`;
    const bereit = anz(0) >= 2 && anz(1) >= 2;
    return `<header class="titel"><p class="etikett">Umschreiben · Raumcode</p><div class="code">${esc(code)}</div></header>
      ${qr ? `<div class="qr">${qr}</div>` : ""}
      <div class="reihe"><button class="knopf zweit" id="teilen">Link teilen</button><button class="knopf zweit" id="kopieren">Link kopieren</button></div>
      <div class="karte"><div class="teams">${spalte(0)}${spalte(1)}</div>
        <p class="leise klein">${host ? "Tipp auf einen Namen, um ihn ins andere Team zu schieben." : "Tipp auf deinen Namen, um das Team zu wechseln."}</p>
        ${host ? `<button class="knopf zweit" id="mischen">Teams auslosen</button>` : ""}</div>
      <div class="karte"><h2>Einstellungen</h2>
        ${host ? `<p class="leise klein">Zeit pro Zug</p>${wahlKnoepfe("eZeit", WV.ZEITEN, S.zeit, w => w + " s")}<p class="leise klein">Jeder ist dran</p>${wahlKnoepfe("eDurch", WV.DURCHGAENGE, S.durchgaenge, w => w + "×")}<p class="leise klein">Runden</p>${wahlKnoepfe("eArt", ARTEN_WAHL, S.gemischt ? "ja" : "nein", artenText)}`
          : `<p class="leise">${S.zeit} Sekunden pro Zug · jeder ist ${S.durchgaenge}× dran · ${S.gemischt ? "Erklären, Zeichnen und Pantomime" : "nur Erklären"}</p>`}</div>
      ${regeln()}
      ${host ? `<div class="unten"><button class="knopf" id="start" ${bereit ? "" : "disabled"}>${bereit ? "Spiel starten" : "Jedes Team braucht zwei …"}</button></div>`
        : `<p class="leise mitte">Warte, bis ${esc(sp(S.host).name)} das Spiel startet.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }
  const stand = () => `<div class="stand" id="stand" aria-label="Punktestand"></div>`;
  const zugText = () => `Zug ${Math.min(S.zug + 1, S.zuege)} von ${S.zuege}`;
  const host = () => rolle === "host";
  const artHinweis = {
    erklaeren: "Erklären mit Worten. Verbotene Wörter, Teile davon und Englisch gelten nicht.",
    zeichnen: "Zeichnen auf dem Handy, dein Team sieht es live. Keine Buchstaben, keine Zahlen, nicht sprechen.",
    pantomime: "Pantomime: nur vorspielen, kein Wort und kein Geräusch."
  };
  // Rückblick auf den letzten Zug: Erklärer und Spielleiter können Vertipper korrigieren
  function rueckblick() {
    const v = S.verlauf[S.verlauf.length - 1]; if (!v || (S.phase === "ende" && !v.karten.length)) return "";
    const darf = host() || v.erklaerer === PID, r = v.karten.filter(k => k.e === "richtig").length;
    return `<div class="karte"><h2>Letzter Zug: ${esc(sp(v.erklaerer).name)} <small class="leise">${teamName(v.team)} · ${r} erraten</small></h2>
      ${v.karten.length ? `<ul class="kartenliste">${v.karten.map((k, i) => `<li class="${k.e}">${darf ? `<button class="korr" data-korr="${i}">` : ""}<span>${esc(k.w)}</span><b>${k.e === "richtig" ? "✓ richtig" : k.e === "erwischt" ? "✗ erwischt" : "übersprungen"}</b>${darf ? "</button>" : ""}</li>`).join("")}</ul>
        ${darf ? `<p class="leise klein">Vertippt? Tipp auf eine Karte, um sie zu ändern.</p>` : ""}` : `<p class="leise">Keine Karte.</p>`}</div>`;
  }
  function bildschirmBereit() {
    const r = rolleImZug(), wer = esc(sp(S.erklaerer).name), team = teamName(S.teamDran);
    const kopfzeile = `${stand()}<p class="etikett mitte">${zugText()} · ${WV.ART_NAME[S.art]}</p>`;
    let mitte;
    if (r === "erklaerer") mitte = `<div class="karte bereitkarte t${S.teamDran}"><h1>Du bist dran!</h1><p>${artHinweis[S.art]}</p><p class="leise">Dein Team ratet laut. Halte das Handy so, dass nur du es siehst.</p>
        <button class="knopf gross" id="los">Los, Uhr starten</button></div>`;
    else if (r === "rater") mitte = `<div class="karte bereitkarte t${S.teamDran}"><h1>${wer} ${S.art === "zeichnen" ? "zeichnet" : S.art === "pantomime" ? "spielt vor" : "erklärt"}</h1><p>Für euch, ${team}! Ihr ratet laut.${S.art === "zeichnen" ? " Das Bild erscheint gleich auf euren Handys." : ""}</p><p class="leise">Gleich geht es los, sobald ${wer} startet.</p></div>`;
    else mitte = `<div class="karte bereitkarte t${S.teamDran}"><h1>${wer} ${S.art === "zeichnen" ? "zeichnet" : S.art === "pantomime" ? "spielt vor" : "erklärt"}</h1><p>Für ${team}. Ihr seht die Karte mit und passt auf.</p><p class="leise">Fällt ein verbotenes Wort, tippt auf <b>Erwischt</b>.</p></div>`;
    return `${kopfzeile}${mitte}${rueckblick()}
      ${host() ? `<div class="reihe"><button class="knopf zweit" id="anderer">Anderer erklärt</button><button class="knopf zweit" id="ueberspringen">Zug überspringen</button></div>` : ""}`;
  }
  const kartenAnzeige = (k, art) => `<div class="spielkarte"><p class="begriff">${esc(k.w)}</p>${art === "erklaeren" ? `<ul class="tabu">${k.tabu.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="verbot">${art === "zeichnen" ? "Keine Buchstaben, kein Wort" : "Kein Wort, kein Geräusch"}</p>`}</div>`;
  function bildschirmSpielen() {
    const v = ansicht(), r = rolleImZug(), wer = esc(sp(S.erklaerer).name);
    const kopf = `${stand()}<div class="spielkopf"><div><p class="etikett">${WV.ART_NAME[S.art]} · ${teamName(S.teamDran)}</p><h2>${r === "erklaerer" ? "Du bist dran" : wer + (S.art === "zeichnen" ? " zeichnet" : S.art === "pantomime" ? " spielt vor" : " erklärt")}</h2></div><div class="zeit" id="zeit"></div></div>`;
    const liste = `<div class="karte"><h2>Dieser Zug</h2><ul class="kartenliste" id="kartenliste"></ul></div>`;
    const hostLeiste = host() ? `<button class="link" id="ueberspringen">Zug beenden</button>` : "";
    if (r === "erklaerer") {
      if (!v.karte) return `${kopf}<p class="leise mitte">Karte kommt …</p>`;
      const knoepfe = `<div class="reihe"><button class="knopf zweit" data-karte="weiter">Überspringen</button><button class="knopf gut" data-karte="richtig">Richtig ✓</button></div>`;
      if (S.art === "zeichnen") return `${kopf}${kartenAnzeige(v.karte, S.art)}
        <div class="malbox" id="malbox"></div>
        <p class="leise klein">Mit zwei Fingern heranzoomen und verschieben.</p>
        ${MALHILFE.farbKnoepfe(malFarbe)}
        <div class="werkzeug">          ${[1, 2, 3].map(d => `<button class="klein ${d === malDicke ? "an" : ""}" data-dicke="${d}">${["Fein", "Mittel", "Dick"][d - 1]}</button>`).join("")}
          <button class="klein" id="rueckgaengig">Rückgängig</button><button class="klein" id="loeschen">Leeren</button></div>
        <div class="unten">${knoepfe}</div>${liste}${hostLeiste}`;
      return `${kopf}${kartenAnzeige(v.karte, S.art)}<div class="unten">${knoepfe}</div>${liste}${hostLeiste}`;
    }
    if (r === "waechter") return `${kopf}${v.karte ? kartenAnzeige(v.karte, S.art) : ""}
      ${S.art === "zeichnen" ? `<div class="bildbox" id="bild"></div>` : ""}
      <div class="unten"><button class="knopf erwischt" data-karte="erwischt">Erwischt!</button></div>
      <p class="leise klein mitte">${S.art === "erklaeren" ? "Fällt eins der roten Wörter, ein Teil davon oder Englisch?" : S.art === "zeichnen" ? "Malt " + wer + " Buchstaben oder spricht?" : "Spricht " + wer + " oder macht Geräusche?"}</p>${liste}${hostLeiste}`;
    return `${kopf}${S.art === "zeichnen" ? `<div class="bildbox" id="bild"></div>` : `<div class="karte ratekarte t${S.teamDran}"><p class="gross">${S.art === "pantomime" ? "Schaut hin" : "Hört zu"} und ruft laut!</p><p class="leise">${wer} ${S.art === "pantomime" ? "spielt vor" : "erklärt"} für euch.</p></div>`}
      ${liste}${hostLeiste}`;
  }
  function bildschirmEnde() {
    const [a, b] = S.punkte, sieger = a === b ? null : a > b ? 0 : 1;
    // Wer hat wie viel erklärt und wer hat wen erwischt
    const erklaert = {}, erwischt = {};
    for (const v of S.verlauf) for (const k of v.karten) {
      if (k.e === "richtig") erklaert[v.erklaerer] = (erklaert[v.erklaerer] || 0) + 1;
      if (k.e === "erwischt" && k.von) erwischt[k.von] = (erwischt[k.von] || 0) + 1;
    }
    const top = o => Object.keys(o).filter(p => S.spieler[p]).sort((x, y) => o[y] - o[x]).slice(0, 3);
    return `<header class="titel"><p class="etikett">Endstand</p><h1>${sieger === null ? "Unentschieden!" : teamName(sieger) + " gewinnen"}</h1></header>
      ${stand()}
      ${top(erklaert).length ? `<div class="karte"><h2>Am meisten erklärt</h2><ol class="rang">${top(erklaert).map((p, i) => `<li><span class="platz">${i + 1}</span><span class="n">${esc(sp(p).name)}</span><b>${erklaert[p]}</b></li>`).join("")}</ol></div>` : ""}
      ${top(erwischt).length ? `<div class="karte"><h2>Am schärfsten aufgepasst</h2><ol class="rang">${top(erwischt).map((p, i) => `<li><span class="platz">${i + 1}</span><span class="n">${esc(sp(p).name)}</span><b>${erwischt[p]}×</b></li>`).join("")}</ol></div>` : ""}
      ${rueckblick()}
      ${host() ? `<div class="unten"><button class="knopf" id="nochmal">Nochmal spielen</button></div>` : `<p class="leise mitte">${esc(sp(S.host).name)} kann eine neue Runde starten.</p>`}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }

  function binden() {
    const $ = id => document.getElementById(id);
    const nameAus = () => { const n = ($("name").value || "").trim().slice(0, 20); if (!n) { $("name").focus(); return null; } name = n; ls.set("slf:name", n); return n; };
    const gewaehlt = id => document.querySelector("#" + id + " .an").dataset.v;
    if ($("uebernehmen")) $("uebernehmen").onclick = uebernehmen;
    document.querySelectorAll(".wahl").forEach(w => w.querySelectorAll("button").forEach(b => b.onclick = () => {
      w.querySelectorAll("button").forEach(x => x.classList.remove("an")); b.classList.add("an");
      if (w.id === "eZeit") tun({ t: "einstellungen", zeit: +b.dataset.v });
      if (w.id === "eDurch") tun({ t: "einstellungen", durchgaenge: +b.dataset.v });
      if (w.id === "eArt") tun({ t: "einstellungen", gemischt: b.dataset.v === "ja" });
    }));
    if ($("neu")) $("neu").onclick = () => { if (nameAus()) neuesSpiel({ zeit: +gewaehlt("wZeit"), durchgaenge: +gewaehlt("wDurch"), gemischt: gewaehlt("wArt") === "ja" }); };
    if ($("beitreten")) $("beitreten").onclick = () => {
      if (!nameAus()) return;
      const c = ($("code").value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.length !== 4) { $("code").focus(); return; }
      code = c; history.replaceState(null, "", "?raum=" + code + testTeil()); clientStarten();
    };
    if ($("mitspielen")) $("mitspielen").onclick = () => { if (nameAus()) clientStarten(); };
    if ($("teilen")) $("teilen").onclick = () => { if (navigator.share) navigator.share({ title: "Umschreiben", text: "Spiel mit! Raum " + code, url: link() }).catch(() => {}); else kopieren(); };
    if ($("kopieren")) $("kopieren").onclick = kopieren;
    document.querySelectorAll("[data-person]").forEach(b => b.onclick = () => tun({ t: "team", p: b.dataset.person }));
    if ($("mischen")) $("mischen").onclick = () => tun({ t: "mischen" });
    if ($("start")) $("start").onclick = () => tun({ t: "start" });
    if ($("los")) $("los").onclick = () => tun({ t: "los" });
    if ($("anderer")) $("anderer").onclick = () => tun({ t: "andererErklaerer" });
    if ($("nochmal")) $("nochmal").onclick = () => tun({ t: "neustart" });
    if ($("ueberspringen")) $("ueberspringen").onclick = () => tun({ t: "ueberspringen" });
    if ($("verlassen")) $("verlassen").onclick = verlassen;
    document.querySelectorAll("[data-karte]").forEach(b => { b.disabled = getippt === S.k; b.onclick = () => karteTippen(b.dataset.karte); });
    document.querySelectorAll("[data-korr]").forEach(b => b.onclick = () => tun({ t: "korrigieren", i: +b.dataset.korr }));
    if ($("malbox")) malen($("malbox"));
    if ($("bild")) bildZeichnen();
  }
  function kopieren() {
    const b = document.getElementById("kopieren");
    const fertig = () => { if (b) { b.textContent = "Kopiert"; setTimeout(() => { b.textContent = "Link kopieren"; }, 1500); } };
    try { navigator.clipboard.writeText(link()).then(fertig, () => prompt("Link kopieren:", link())); } catch (e) { prompt("Link kopieren:", link()); }
  }
  let groesse = window.innerWidth;
  window.addEventListener("resize", () => { if (Math.abs(window.innerWidth - groesse) < 40) return; groesse = window.innerWidth; letzteSig = ""; render(); });

  // ---------- Start ----------
  if (typeof Peer === "undefined") { app.innerHTML = `<div class="mitte"><p>Die Verbindungsbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.</p></div>`; return; }
  if (code) {
    const gespeichert = ls.get("wv:host:" + code);
    if (gespeichert && gespeichert.S) fortsetzenAlsHost(gespeichert);
    else if (name) clientStarten();
    else render();
  } else render();
  window.__wv = { get S() { return S; }, get B() { return B; }, get rolle() { return rolle; }, get verbunden() { return verbunden; }, PID, tun: params.get("test") ? tun : undefined };
})();
