// Orbit: Verbindung (Handy des Spielleiters ist der Server, PeerJS), Uhrabgleich, Bots und Bildschirme.
// Regeln und Ablauf stehen in logic.js, die Missionen in missionen/*.js.
(function () {
  const R = window.RM, UI = window.ORBIT_UI || {}, B = window.ORBIT_BRETT, LIVE = window.ORBIT_LIVE, SN = window.ORBIT_SENSOR;
  const K = window.ORBIT_KLANG || { spiel() {}, an: false, umschalten() { return false; } };
  const app = document.getElementById("app");
  const PREFIX = "fmwob-";
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

  let PID = ls.get("slf:pid"); if (!PID) { PID = Math.random().toString(36).slice(2, 10); ls.set("slf:pid", PID); }
  let name = ls.get("slf:name") || "";
  let code = (params.get("raum") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  let rolle = null, S = null, peer = null, hostConn = null, verbunden = false, offlineSeit = null, fehlerText = "";
  const conns = new Map();
  let laenge = "normal";
  let retryTimer = null, token = 0, versuch = 0, hinweis = "", hinweisTimer = null, letztesHtml = "";

  const hostId = ep => PREFIX + code + "-" + ep;
  const link = () => location.origin + location.pathname + "?raum=" + code;
  const testTeil = () => (params.get("test") ? "&test=" + params.get("test") : "");

  // ---------- Uhr: Zeit des Spielleiters ----------
  // Jedes Handy pingt den Spielleiter und merkt sich die Antwort mit der kürzesten Laufzeit.
  let versatz = 0, besteLaufzeit = Infinity;
  const hostJetzt = () => Date.now() + (rolle === "host" ? 0 : versatz);
  function pingen(n) {
    for (let i = 0; i < n; i++) setTimeout(() => { if (hostConn && hostConn.open) { try { hostConn.send({ t: "ping", pid: PID, c: Date.now() }); } catch (e) {} } }, i * 250);
  }
  function pong(m) {
    const jetzt = Date.now(), lauf = jetzt - m.c;
    if (lauf < 0 || lauf > 5000) return;
    if (lauf <= besteLaufzeit * 1.2) { besteLaufzeit = Math.min(besteLaufzeit, lauf); versatz = m.h + lauf / 2 - jetzt; }
  }
  setInterval(() => { besteLaufzeit *= 1.5; pingen(3); }, 20000);   // Uhren laufen auseinander: ab und zu neu abgleichen

  // ---------- Bildschirm wach halten ----------
  let wake = null;
  async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wachHalten(); if (rolle === "client" && !hostConn) verbindeZumHost(); } });
  document.addEventListener("click", wachHalten);

  // ---------- Spielleiter ----------
  function speichernHost() { ls.set("ob:host:" + code, S); }
  function hostStarten(s) {
    rolle = "host"; S = s; S.host = PID;
    if (S.seed == null) S.seed = Math.floor(Math.random() * 2 ** 31);
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
    if (m.t === "ping") { try { c.send({ t: "pong", c: m.c, h: Date.now() }); } catch (e) {} return; }
    if (m.t === "ein") { if (LIVE) LIVE.eingang(m.pid, m); return; }   // Live-Eingabe, 20-mal pro Sekunde
    if (m.t === "hallo") conns.set(m.pid, c);
    const r = R.aktion(S, m.pid, m, Date.now());
    if (!r.ok && r.fehler && m.t !== "hallo") { try { c.send({ t: "fehler", text: r.fehler }); } catch (e) {} }
    if (r.ok || m.t === "hallo") geaendert();
  }
  function geaendert() {
    S.online = [PID].concat([...conns.keys()]);
    speichernHost();
    for (const [pid, c] of conns) { try { c.send({ t: "zustand", s: R.sicht(S, pid) }); } catch (e) {} }
    render();
  }
  // Takt: Zeiten, Bots und Missionsablauf laufen beim Spielleiter
  setInterval(() => { if (rolle === "host" && S && R.takt(S, Date.now())) geaendert(); }, 200);
  // Live-Missionen: 30-mal pro Sekunde rechnen, jedes zweite Mal ein Bild an alle
  const liveAktiv = () => !!(S && S.phase === "mission" && S.mission && S.mission.schritt === "spiel" && R.MISSIONEN[S.mission.id] && R.MISSIONEN[S.mission.id].live);
  let liveTick = 0;
  setInterval(() => {
    if (rolle !== "host" || !liveAktiv() || !LIVE) return;
    const jetzt = Date.now(), nr = S.mission.nr;
    if (S.mission.tn.includes(PID)) LIVE.eigeneEingabe(PID, LIVE.eingabe(R.MISSIONEN[S.mission.id].lenkung), jetzt);
    const anders = R.liveSchritt(S, jetzt, LIVE.eingaben(jetzt));
    if (++liveTick % 2 === 0 || anders) {
      const b = R.liveBild(S);
      if (b) {
        for (const [pid, c] of conns) { try { c.send({ t: "live", nr, b: R.liveBildFuer(S, b, pid), h: jetzt }); } catch (e) {} }
        LIVE.empfang(nr, R.liveBildFuer(S, b, PID), jetzt);
      }
    }
    if (anders) geaendert();
  }, 33);
  // Handys schicken ihre Steuerung 20-mal pro Sekunde
  setInterval(() => {
    if (rolle !== "client" || !liveAktiv() || !LIVE || !hostConn || !hostConn.open || !S.mission.tn.includes(PID)) return;
    try { hostConn.send(Object.assign({ t: "ein", pid: PID, l: isFinite(besteLaufzeit) ? Math.round(besteLaufzeit) : 0 }, LIVE.eingabe(R.MISSIONEN[S.mission.id].lenkung))); } catch (e) {}
  }, 50);

  // ---------- Mitspieler ----------
  function clientStarten() {
    rolle = "client";
    const k = ls.get("ob:kopie:" + code); if (k) S = k;
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
      c.send({ t: "hallo", pid: PID, name }); besteLaufzeit = Infinity; pingen(5); render();
    });
    c.on("data", m => {
      if (!m) return;
      if (m.t === "zustand") { S = m.s; ls.set("ob:kopie:" + code, S); render(); }
      else if (m.t === "live") { if (LIVE) LIVE.empfang(m.nr, m.b, m.h); }
      else if (m.t === "pong") pong(m);
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
  // Spielleitung übernehmen: Eine laufende Mission beginnt von vorn, die Energie bleibt.
  function uebernehmen() {
    if (!S) return;
    const s = JSON.parse(JSON.stringify(S)); s.epoch += 1;
    s.seed = Math.floor(Math.random() * 2 ** 31);   // der Startwert des alten Spielleiters ist geheim
    R.missionNeustart(s, Date.now());
    ls.del("ob:kopie:" + code); clearTimeout(retryTimer); token++;
    if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
    hostStarten(s);
  }
  function fortsetzenAlsHost(gespeichert) {
    rolle = "pruefen"; render();
    const probe = new Peer(undefined, PEER_OPT); let fertig = false;
    const ende = alsClient => {
      if (fertig) return; fertig = true; try { probe.destroy(); } catch (e) {}
      if (alsClient) { ls.del("ob:host:" + code); ls.set("ob:kopie:" + code, gespeichert); clientStarten(); }
      else hostStarten(gespeichert);
    };
    probe.on("open", () => { const c = probe.connect(hostId(gespeichert.epoch + 1), { serialization: "json" }); c.on("open", () => ende(true)); });
    probe.on("error", () => ende(false));
    setTimeout(() => ende(false), 4000);
  }

  // ---------- Aktionen ----------
  function tun(m) {
    if (rolle === "host") { const r = R.aktion(S, PID, m, Date.now()); if (r.ok) geaendert(); else if (r.fehler) zeigeHinweis(r.fehler); }
    else if (hostConn && hostConn.open) { try { hostConn.send(Object.assign({ pid: PID }, m)); } catch (e) {} }
    else zeigeHinweis("Keine Verbindung zum Spielleiter.");
  }
  function zeigeHinweis(t) { hinweis = t; render(); clearTimeout(hinweisTimer); hinweisTimer = setTimeout(() => { hinweis = ""; render(); }, 2500); }
  function neuesSpiel(bots, mission, partie) {
    code = (window.ABEND && ABEND.neuerRaum()) || Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
    history.replaceState(null, "", "?raum=" + code + testTeil());
    const s = R.neu(code, PID, name);
    hostStarten(s);
    for (let i = 0; i < bots; i++) R.aktion(S, PID, { t: "bot", dazu: true }, Date.now());
    if (mission) R.aktion(S, PID, { t: "mission", id: mission, einzelner: params.get("alien") === "ich" ? PID : undefined }, Date.now());
    else if (partie) R.aktion(S, PID, { t: "partie", laenge: R.LAENGEN[partie] ? partie : "kurz" }, Date.now());
    geaendert();
  }
  function verlassen() { ls.del("ob:host:" + code); ls.del("ob:kopie:" + code); location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : ""); }

  // ---------- Bausteine ----------
  const sp = p => (S && S.spieler[p]) || { name: "?", farbe: 0, energie: 0 };
  const online = p => !!(S && S.online && S.online.includes(p));
  const da = p => R.istBot(S, p) || online(p);
  const farbe = p => (R.FARBEN[sp(p).farbe] || R.FARBEN[0]).f;
  // Astronautenhelm in der Spielerfarbe, im Visier der Anfangsbuchstabe
  function helmInnen(f, buchstabe) {
    return `<path d="M20 2.5v3" stroke="${f}" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="2.6" r="1.8" fill="${f}"/>
      <circle cx="20" cy="21" r="16" fill="${f}" stroke="#060A1C" stroke-width="2.4"/><rect x="7.5" y="13" width="25" height="15" rx="7.5" fill="#0A1030" stroke="#060A1C" stroke-width="1.6"/>
      <path d="M11 17.5q2-2.8 6-3" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <text x="20" y="25.2" text-anchor="middle" font-family="Exo 2,Inter,system-ui,sans-serif" font-weight="900" font-size="11" fill="${f}">${esc(buchstabe)}</text>`;
  }
  const helmSvg = (f, buchstabe, klasse) => `<svg class="helm ${klasse || ""}" viewBox="0 0 40 40" aria-hidden="true">${helmInnen(f, buchstabe)}</svg>`;
  const anfang = p => (sp(p).name || "?").trim().charAt(0).toUpperCase() || "?";
  const helm = (p, klasse) => helmSvg(farbe(p), anfang(p), klasse);
  const uhr = bis => `<span class="uhr" data-bis="${bis}">${Math.max(0, Math.ceil((bis - hostJetzt()) / 1000))}</span>`;
  const ctxUI = () => {
    const m = S.mission;
    return { PID, S, esc, helm, uhr, tun, name: p => sp(p).name, dabei: !!(m && m.tn.includes(PID)), jetzt: hostJetzt, neu: () => { letztesHtml = ""; render(); },
      nr: m && m.nr, farbe, anfang, klang: K.spiel, laufzeit: rolle === "host" ? 0 : (isFinite(besteLaufzeit) ? besteLaufzeit : 100), host: rolle === "host" };
  };
  const ctxBrett = () => ({ S, PID, R, esc, helm, helmInnen: p => helmInnen(farbe(p), anfang(p)), name: p => sp(p).name, farbe, uhr, jetzt: hostJetzt, tun, host: rolle === "host", da });

  // ---------- Bildschirme ----------
  function statusZeile() {
    if (rolle === "host") return verbunden ? "" : (fehlerText || "Raum wird geöffnet …");
    if (rolle === "client" && !verbunden) return S ? "Verbindung zum Spielleiter weg, verbinde neu …" : (fehlerText || (window.ABEND && ABEND.aktiv ? "" : "Verbinde mit Raum " + code + " …"));
    return "";
  }
  // Klänge: aus dem Unterschied zwischen altem und neuem Stand (gilt für Spielleiter und Mitspieler gleich)
  let vorher = null;
  function klaenge() {
    if (!S) return;
    const P = S.partie, m = S.mission, ich = S.spieler[PID] || {}, z = P && P.zug;
    const jetzt = {
      phase: S.phase, ps: P && P.schritt, wurf: !!(P && P.wurf && P.wurf[PID]), zug: z ? z.pid + ":" + z.start : "",
      energie: ich.energie || 0, kristalle: ich.kristalle || 0, ms: m ? m.nr + ":" + m.schritt : "",
      wahl: !!(P && P.wahl && P.wahl.wer === PID && !P.wahl.gewaehlt), frage: !!(z && z.pid === PID && z.frage)
    };
    const v = vorher; vorher = jetzt;
    if (!v) return;
    if (jetzt.wurf && !v.wurf) K.spiel("wuerfel");
    if (jetzt.zug && jetzt.zug !== v.zug && S.phase === "brett") {
      // Schritte über das Brett, im Takt der Figur
      const n = z.pfad.length, takt = R.ZEIT ? R.ZEIT.schritt : 280;
      for (let i = 1; i <= n; i++) { const t = z.start + i * takt - hostJetzt(); if (t > -100) setTimeout(() => K.spiel("schritt"), Math.max(0, t)); }
    }
    if (jetzt.kristalle > v.kristalle) K.spiel("kristall");
    else if (jetzt.energie > v.energie && jetzt.phase === v.phase && jetzt.ms === v.ms) K.spiel("energie");
    else if (jetzt.energie < v.energie && jetzt.phase === v.phase && jetzt.phase === "brett") K.spiel("verlust");
    if ((jetzt.wahl && !v.wahl) || (jetzt.frage && !v.frage)) K.spiel("dran");
    else if (jetzt.ps !== v.ps && (jetzt.ps === "wahl" || jetzt.ps === "wetten")) K.spiel("glocke");
    if (jetzt.phase === "ende" && v.phase !== "ende") K.spiel("fanfare");
    if (jetzt.ms !== v.ms && m) {
      if (m.schritt === "anleitung") K.spiel("auftakt");
      else if (m.schritt === "ergebnis" && m.tn.includes(PID)) {
        const e = (m.ergebnis || []).find(x => x.pid === PID);
        K.spiel(e && e.platz === 1 ? "sieg" : "ende");
      }
    }
  }
  function render() {
    klaenge();
    const st = statusZeile(), ueb = rolle === "client" && S && offlineSeit && Date.now() - offlineSeit > 20000;
    let h = `<div class="status" ${st ? "" : "hidden"}><span>${esc(st)}</span>${ueb ? `<button class="klein" id="uebernehmen">Spielleitung übernehmen</button>` : ""}</div>`;
    if (!rolle) h += code ? bildschirmName() : bildschirmStart();
    else if (rolle === "pruefen" || !S) h += `<div class="mitte"><p class="leise">${window.ABEND ? ABEND.warten() : "Verbinde …"}</p></div>`;
    else if (S.phase === "mission" && S.mission) h += bildschirmMission();
    else if (S.phase === "brett" && S.partie && B) h += B.html(ctxBrett());
    else if (S.phase === "ende" && S.partie && B) h += B.ende(ctxBrett());
    else h += bildschirmLobby();
    if (hinweis) h += `<div class="toast" role="status">${esc(hinweis)}</div>`;
    if (h === letztesHtml) return;
    letztesHtml = h;
    app.innerHTML = h;
    binden();
    zeitenAnzeigen();
  }
  setInterval(() => { if (rolle === "client" && offlineSeit) render(); }, 5000);
  // Uhren und Countdown ohne neues Zeichnen weiterzählen
  function zeitenAnzeigen() {
    const jetzt = hostJetzt();
    if (B && S && S.phase === "brett") B.bewegen(ctxBrett());
    document.querySelectorAll("[data-bis]").forEach(el => {
      const r = Math.max(0, Math.ceil((+el.dataset.bis - jetzt) / 1000));
      if (el.textContent !== String(r)) el.textContent = r;
      el.classList.toggle("knapp", r <= 5);
    });
    const cd = document.getElementById("countdown");
    if (cd) {
      const r = Math.ceil((+cd.dataset.ende - jetzt) / 1000), t = r > 3 ? "" : r >= 1 ? String(r) : "Los!";
      if (cd.textContent !== t) { cd.textContent = t; cd.classList.remove("puls"); void cd.offsetWidth; cd.classList.add("puls"); if (t) K.spiel(t === "Los!" ? "los" : "tick"); }
    }
  }
  setInterval(zeitenAnzeigen, 100);
  // Missionen mit Bewegung zeichnen bei jedem Bild des Bildschirms
  let spielNr = null;
  (function bild() {
    const m = S && S.phase === "mission" && S.mission;
    if (m && m.schritt === "spiel") {
      if (spielNr !== m.nr) { spielNr = m.nr; if (SN) SN.nullen(); if (LIVE && rolle === "host") LIVE.leeren(); }
      if (UI[m.id] && UI[m.id].bewegen) { try { UI[m.id].bewegen(m.d, ctxUI()); } catch (e) { console.error(e); } }
    }
    requestAnimationFrame(bild);
  })();

  // Titelbild: Raumstation im Orbit um einen Ringplaneten
  function titelbild() {
    const sterne = [[14, 18], [48, 9], [92, 30], [150, 12], [214, 22], [258, 8], [286, 40], [30, 70], [270, 92], [12, 118], [200, 120], [120, 6], [178, 44]]
      .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.1 : 1.8}" fill="#EAF2FF" opacity="${i % 2 ? .6 : .95}"/>`).join("");
    const module = Array.from({ length: 12 }, (_, i) => {
      const w = i / 12 * Math.PI * 2, x = 150 + Math.cos(w) * 62, y = 78 + Math.sin(w) * 22, f = ["#2EC4B6", "#FF7A2F", "#FFD23F", "#A57BFF"][i % 4];
      return `<rect x="${(x - 7).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="14" height="10" rx="3" fill="${f}" stroke="#060A1C" stroke-width="1.6"/>`;
    });
    const hinten = module.filter((_, i) => i >= 7 || i === 0).join(""), vorn = module.filter((_, i) => i > 0 && i < 7).join("");
    return `<svg class="titelbild" viewBox="0 0 300 150" role="img" aria-label="Raumstation mit Modulen im Orbit um einen Ringplaneten">${sterne}
      <circle cx="262" cy="128" r="44" fill="#FF7A2F"/><path d="M226 104q36 10 74 0M220 124q40 10 82 0M224 144q36 8 70 0" stroke="#C4501A" stroke-width="5" fill="none" opacity=".55"/>
      <ellipse cx="262" cy="128" rx="70" ry="12" fill="none" stroke="#FFD23F" stroke-width="3" opacity=".85" transform="rotate(-12 262 128)"/>
      ${hinten}<ellipse cx="150" cy="78" rx="62" ry="22" fill="none" stroke="#9AA7D1" stroke-width="5"/><ellipse cx="150" cy="78" rx="62" ry="22" fill="none" stroke="#26305E" stroke-width="1.5"/>
      <path d="M150 78L98 72M150 78L202 72M150 78L150 56M150 78L150 100" stroke="#9AA7D1" stroke-width="2.4"/>
      <circle cx="150" cy="76" r="15" fill="#141B3D" stroke="#EAF2FF" stroke-width="2.4"/><circle cx="150" cy="76" r="6" fill="#2EC4B6"/><circle cx="150" cy="76" r="10" fill="none" stroke="#2EC4B6" stroke-width="1.4" class="tb-puls"/>
      ${vorn}<path d="M150 61V40" stroke="#EAF2FF" stroke-width="2"/><circle cx="150" cy="38" r="3" fill="#FF5C9A" class="tb-blink"/></svg>`;
  }
  function bildschirmStart() {
    return `<header class="titel">${titelbild()}<h1>Orbit</h1><p class="leise">Eine Raumstation als Spielbrett: würfeln, durch die Module ziehen, Energie sammeln und Sternkristalle kaufen. Nach jeder Runde eine Mission für alle, mal geheim, mal live, mal im Team.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
      <div class="karte-box"><h2>Neues Spiel</h2><p class="leise klein">Für 2 bis 8 Leute, jeder am eigenen Handy.</p>
        <button class="knopf" id="neu">Raum erstellen</button></div>
      <div class="karte-box"><h2>Mitspielen</h2>
        <label class="feld">Raumcode<input id="code" maxlength="6" autocapitalize="characters" placeholder="z. B. K7M2"></label>
        <button class="knopf zweit" id="beitreten">Beitreten</button></div>
      <div class="karte-box"><h2>Üben</h2><p class="leise klein">Mit drei Bots als Crew, ganz ohne Mitspieler.</p>
        <button class="knopf zweit" id="allein">Mit Bots üben</button></div>
      <a class="link" href="../">Alle Spiele</a>`;
  }
  function bildschirmName() {
    return `<header class="titel"><h1>Orbit</h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
      <button class="knopf" id="mitspielen">Mitspielen</button>`;
  }
  function bildschirmLobby() {
    const host = rolle === "host", crew = S.reihenfolge.filter(p => S.spieler[p] && da(p)), n = crew.length;
    const weg = S.reihenfolge.filter(p => S.spieler[p] && !da(p));
    let qr = "";
    try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
    const hatEnergie = S.reihenfolge.some(p => S.spieler[p] && S.spieler[p].energie);
    const zeile = p => `<li>${helm(p)}<span class="nm">${esc(sp(p).name)}${p === S.host ? " <small>Spielleiter</small>" : ""}${p === PID ? " <small>du</small>" : ""}${R.istBot(S, p) ? " <small>Bot</small>" : ""}</span>${hatEnergie ? `<span class="energie">${sp(p).energie}<i>⚡</i></span>` : ""}</li>`;
    const missionen = Object.values(R.MISSIONEN).map(m => {
      const geht = n >= (m.ab || 1);
      return `<div class="mission"><div><b>${esc(m.name)}</b><small>${esc(m.art)} · ${esc(m.eingabe)} · ab ${m.ab || 1}</small><p class="leise klein">${esc(m.kurz)}</p></div>
        ${host ? `<button class="knopf klein-knopf" data-mission="${m.id}" ${geht ? "" : "disabled"}>${geht ? "Starten" : `ab ${m.ab}`}</button>` : ""}</div>`;
    }).join("");
    const letzte = S.letzte && R.MISSIONEN[S.letzte.id] ? `<p class="leise klein">Zuletzt: ${esc(R.MISSIONEN[S.letzte.id].name)}. Gewonnen hat ${S.letzte.ergebnis.filter(e => e.platz === 1).map(e => esc(sp(e.pid).name)).join(" und ") || "niemand"}.</p>` : "";
    return `<header class="titel"><p class="etikett">Orbit · Raumcode</p><div class="code">${esc(code)}</div></header>
      ${qr ? `<div class="qr">${qr}</div>` : ""}
      <div class="reihe"><button class="knopf zweit" id="teilen">Link teilen</button><button class="knopf zweit" id="kopieren">Link kopieren</button></div>
      <div class="karte-box"><h2>Crew (${n})</h2><ul class="spieler">${(hatEnergie ? R.stand(S).filter(p => da(p)) : crew).map(zeile).join("")}</ul>
        ${weg.length ? `<p class="leise klein">Nicht verbunden: ${weg.map(p => esc(sp(p).name)).join(", ")}</p>` : ""}${letzte}
        ${host ? `<div class="reihe"><button class="knopf zweit" id="botDazu" ${n >= R.MAX ? "disabled" : ""}>+ Bot</button><button class="knopf zweit" id="botWeg" ${crew.some(p => R.istBot(S, p)) ? "" : "disabled"}>− Bot</button></div>` : ""}</div>
      ${farbWahl()}
      <div class="karte-box"><h2>Partie</h2>
        <p class="leise klein">Würfeln, durch die Station ziehen, Energie sammeln und beim Händlerschiff Sternkristalle kaufen. Nach jeder Runde eine Mission.</p>
        ${host ? `<div class="laengen" role="group" aria-label="Länge">${[["kurz", "Kurz", "5 Runden · ca. 15 min"], ["normal", "Normal", "8 Runden · ca. 25 min"], ["lang", "Lang", "12 Runden · ca. 40 min"]].map(([k, t, u]) =>
          `<button class="laenge ${laenge === k ? "an" : ""}" data-laenge="${k}" aria-pressed="${laenge === k}"><b>${t}</b><small>${u}</small></button>`).join("")}</div>
          <button class="knopf" id="partie" ${n >= 2 ? "" : "disabled"}>${n >= 2 ? "Partie starten" : "Ab 2 Leuten (oder Bots dazunehmen)"}</button>`
          : `<p class="mitte">${esc(sp(S.host).name)} startet die Partie.</p>`}</div>
      <details class="karte-box uebung"><summary><h2>Einzelne Mission üben</h2></summary>${missionen}
        <p class="leise klein">Ohne Brett, die Energie zählt nur zum Spaß.</p></details>
      ${host && hatEnergie ? `<button class="link" id="nullen">Energie auf 0 setzen</button>` : ""}
      <button class="link" id="verlassen">Raum verlassen</button>`;
  }
  function farbWahl() {
    const mein = sp(PID).farbe;
    const wer = i => S.reihenfolge.find(p => p !== PID && da(p) && S.spieler[p].farbe === i);
    return `<div class="karte-box"><h2>Dein Helm</h2><div class="farbwahl">${R.FARBEN.map((f, i) => {
      const an = mein === i, belegt = !an && wer(i);
      return `<button class="farbknopf ${an ? "an" : ""}" data-farbe="${i}" ${belegt ? "disabled" : ""} aria-pressed="${an}" aria-label="${f.name}${belegt ? ", hat " + esc(sp(belegt).name) : ""}">${helmSvg(f.f, (name || "?").charAt(0).toUpperCase())}<small>${belegt ? esc(sp(belegt).name) : f.name}</small></button>`;
    }).join("")}</div></div>`;
  }
  function bildschirmMission() {
    const m = S.mission, M = R.MISSIONEN[m.id], host = rolle === "host", dabei = m.tn.includes(PID);
    const P = m.partie && S.partie;
    const kopf = `<header class="missionstitel"><p class="etikett">${P ? `Runde ${P.runde} von ${P.runden} · Mission` : `Mission ${m.nr}`}${dabei ? "" : " · du schaust zu"}</p><h1>${esc(M ? M.name : m.id)}</h1>${m.faktor > 1 ? `<p class="doppeltzeile">Letzte Runde: doppelte Energie</p>` : ""}</header>`;
    const abbrechen = host && m.schritt !== "ergebnis" ? `<button class="link" id="abbrechen">Mission abbrechen</button>` : "";
    if (!M) return kopf + `<p class="leise mitte">Diese Mission kennt dein Handy noch nicht. Bitte neu laden.</p>` + abbrechen;
    if (m.schritt === "anleitung") {
      const offen = m.tn.filter(p => !m.bereit[p] && da(p));
      return kopf + `<div class="karte-box"><div class="anleitungskopf">${gestenBild(M.eingabe)}<div class="chips"><span>${esc(M.art)}</span><span>${esc(M.eingabe)}</span></div></div>
          <ul class="regeln">${M.anleitung.map(z => `<li>${z}</li>`).join("")}</ul></div>
        ${m.teams ? teamZeilen(m) : `<div class="helmreihe">${m.tn.map(p => `<span class="${m.bereit[p] ? "" : "blass"}" title="${esc(sp(p).name)}">${helm(p)}</span>`).join("")}</div>`}
        <p class="leise mitte klein">${offen.length ? `Warte auf ${offen.map(p => esc(sp(p).name)).join(", ")} · Start spätestens in ${uhr(m.bis)} s` : "Alle bereit."}</p>
        ${dabei && !m.bereit[PID] ? `<div class="unten"><button class="knopf" id="bereit">Bereit</button></div>` : ""}${abbrechen}`;
    }
    if (m.schritt === "countdown") return kopf + `<div class="countdown" id="countdown" data-ende="${m.bis}" aria-live="assertive"></div><p class="leise mitte">${esc(M.kurz)}</p>`;
    if (m.schritt === "spiel") {
      const ui = UI[m.id];
      return kopf + `<div class="missionsfeld">${ui ? ui.html(m.d, ctxUI()) : ""}</div>${abbrechen}`;
    }
    // Ergebnis
    const ui = UI[m.id], e = m.ergebnis || [];
    const platz = x => x.platz ? x.platz + "." : "–";
    return kopf + (ui && m.d ? `<details class="rueckblick"><summary>Letzter Durchgang</summary>${ui.html(m.d, ctxUI())}</details>` : "") +
      `<div class="karte-box"><h2>Ergebnis</h2>${einerSatz(e)}${teamSatz(m)}<ol class="ergebnis">${e.map(x => `<li class="${x.platz === 1 ? "erster" : ""} ${x.pid === PID ? "ich" : ""}"><span class="pl">${platz(x)}</span>${helm(x.pid)}<span class="nm">${esc(sp(x.pid).name)}<small>${x.wert === null ? "nicht dabei" : x.text ? esc(x.text) : String(x.wert).replace(".", ",") + " " + esc(M.einheit || "")}</small></span><span class="plus">+${x.energie}<i>⚡</i></span></li>`).join("")}</ol></div>
      ${wettErgebnis(m)}
      ${P ? (host ? `<div class="unten"><button class="knopf" id="weiter">Zurück zur Station (${uhr(m.bis)})</button></div>` : `<p class="leise mitte">Weiter zur Station in ${uhr(m.bis)} s</p>`)
        : host ? `<div class="unten"><button class="knopf" id="weiter">Zurück zur Crew</button></div>` : `<p class="leise mitte">${esc(sp(S.host).name)} geht weiter.</p>`}`;
  }
  // Anleitungsbild: ein Handy mit der Bewegung, die man in der Mission macht (je nach Eingabe, bewegt sich in Schleife)
  function gestenBild(eingabe) {
    const e = eingabe || "", teile = [];
    const neigen = /Neigen/.test(e), daumen = /Daumen/.test(e), wischen = /Wischen/.test(e), ziehen = /Ziehen/.test(e);
    const lr = /links\/rechts/.test(e), tippen = /Tippen/.test(e) && !lr;
    let bild = "";
    if (daumen) bild += `<circle cx="${neigen ? 32 : 40}" cy="58" r="11" fill="none" stroke="#9AA7D1" stroke-width="2"/><circle class="gb-knauf" cx="${neigen ? 32 : 40}" cy="58" r="5.5" fill="#2EC4B6"/>`;
    if (wischen) bild += `<path d="M40 64V22" stroke="#2EC4B6" stroke-width="3" stroke-dasharray="3 5" stroke-linecap="round" opacity=".5"/><circle class="gb-wisch" cx="40" cy="64" r="6" fill="#EAF2FF"/>`;
    if (ziehen) bild += `<rect class="gb-zieh" x="33" y="28" width="14" height="9" rx="2" fill="#FFD23F"/><circle class="gb-zieh" cx="40" cy="44" r="6" fill="#EAF2FF"/><rect x="22" y="62" width="36" height="4" rx="2" fill="#9AA7D1"/>`;
    if (lr) bild += `<circle class="gb-tipp" cx="28" cy="52" r="6" fill="#EAF2FF"/><circle class="gb-tipp zwei" cx="52" cy="52" r="6" fill="#EAF2FF"/>`;
    if (tippen) bild += `<circle class="gb-ring" cx="${neigen ? 50 : 40}" cy="${neigen ? 60 : 44}" r="6" fill="none" stroke="#EAF2FF" stroke-width="2"/><circle class="gb-tipp" cx="${neigen ? 50 : 40}" cy="${neigen ? 60 : 44}" r="6" fill="#EAF2FF"/>`;
    if (neigen && !tippen && !daumen) bild += `<circle class="gb-kugel" cx="40" cy="44" r="6" fill="#FF7A2F"/>`;
    teile.push(`<g class="${neigen ? "gb-neigen" : ""}"><rect x="18" y="8" width="44" height="72" rx="8" fill="#141B3D" stroke="#EAF2FF" stroke-width="2.4"/><rect x="34" y="12" width="12" height="2.4" rx="1.2" fill="#2A3568"/>${bild}</g>`);
    return `<svg class="gestenbild" viewBox="0 0 80 88" role="img" aria-label="So steuerst du: ${esc(e)}">${teile.join("")}</svg>`;
  }
  // Teams: ausgelost, mit Helmen (blass, wer noch nicht bereit ist)
  function teamZeilen(m) {
    return `<div class="teamzeilen">${m.teams.map((t, i) => `<div class="teamzeile team${i} ${t.includes(PID) ? "meins" : ""}"><b>Team ${R.TEAMNAMEN[i]}${t.includes(PID) ? " (du)" : ""}</b>
      <div class="helmreihe">${t.map(p => `<span class="${m.bereit[p] ? "" : "blass"}" title="${esc(sp(p).name)}">${helm(p)}</span>`).join("")}</div></div>`).join("")}</div>`;
  }
  function teamSatz(m) {
    if (!m.teams || m.sieger === undefined) return "";
    return `<p class="einersatz teamsatz team${m.sieger}">${m.sieger === -1 ? "Gleichstand!" : `Team ${R.TEAMNAMEN[m.sieger]} gewinnt!`}</p>`;
  }
  // Einer gegen alle: wer hat gewonnen?
  function einerSatz(e) {
    const ein = e.find(x => x.rolle === "einzeln");
    if (!ein) return "";
    return `<p class="einersatz ${ein.platz === 1 ? "alien" : "crew"}">${ein.platz === 1 ? `${esc(sp(ein.pid).name)} gewinnt als Alien!` : "Die Crew gewinnt!"}</p>`;
  }
  function wettErgebnis(m) {
    if (!m.wetten || !m.wetten.length) return "";
    return `<div class="karte-box"><h2>Wetten</h2><ul class="wettliste">${m.wetten.map(w => `<li class="${w.richtig ? "richtig" : ""}">${helm(w.pid)}<span class="nm">${esc(sp(w.pid).name)}<small>tippt auf ${esc(sp(w.auf).name)}${w.einsatz ? `, ${w.einsatz} ⚡` : ""}${w.gratis ? ", Gratiswette" : ""}</small></span><span class="plus">${w.richtig ? `+${w.gewinn}<i>⚡</i>` : "–"}</span></li>`).join("")}</ul></div>`;
  }

  function binden() {
    const $ = id => document.getElementById(id);
    const nameAus = () => { const n = ($("name").value || "").trim().slice(0, 20); if (!n) { $("name").focus(); return null; } name = n; ls.set("slf:name", n); return n; };
    if ($("uebernehmen")) $("uebernehmen").onclick = uebernehmen;
    if ($("neu")) $("neu").onclick = () => { if (nameAus()) neuesSpiel(0); };
    if ($("allein")) $("allein").onclick = () => { if (nameAus()) neuesSpiel(3); };
    if ($("beitreten")) $("beitreten").onclick = () => {
      if (!nameAus()) return;
      const c = ($("code").value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.length < 4) { $("code").focus(); return; }
      code = c; location.replace("?raum=" + code + testTeil());
    };
    if ($("mitspielen")) $("mitspielen").onclick = () => { if (nameAus()) clientStarten(); };
    if ($("teilen")) $("teilen").onclick = () => { if (navigator.share) navigator.share({ title: "Orbit", text: "Spiel mit! Raum " + code, url: link() }).catch(() => {}); else kopieren(); };
    if ($("kopieren")) $("kopieren").onclick = kopieren;
    if ($("botDazu")) $("botDazu").onclick = () => tun({ t: "bot", dazu: true });
    if ($("botWeg")) $("botWeg").onclick = () => tun({ t: "bot", dazu: false });
    if ($("nullen")) $("nullen").onclick = () => { if (confirm("Energie aller Spieler auf 0 setzen?")) tun({ t: "punkteNull" }); };
    if ($("verlassen")) $("verlassen").onclick = verlassen;
    if ($("bereit")) $("bereit").onclick = () => {
      const M = S && S.mission && R.MISSIONEN[S.mission.id];
      if (SN && M && /Neigen/.test(M.eingabe || "") && SN.brauchtErlaubnis()) SN.erlauben();   // iOS fragt nur nach einem Tippen
      tun({ t: "bereit" });
    };
    if ($("weiter")) $("weiter").onclick = () => tun({ t: "weiter" });
    if ($("abbrechen")) $("abbrechen").onclick = () => { if (confirm("Mission abbrechen? Es gibt keine Energie.")) tun({ t: "abbrechen" }); };
    document.querySelectorAll("[data-farbe]").forEach(b => b.onclick = () => tun({ t: "farbe", n: +b.dataset.farbe }));
    document.querySelectorAll("[data-mission]").forEach(b => b.onclick = () => tun({ t: "mission", id: b.dataset.mission }));
    document.querySelectorAll("[data-laenge]").forEach(b => b.onclick = () => { laenge = b.dataset.laenge; letztesHtml = ""; render(); });
    if ($("partie")) $("partie").onclick = () => tun({ t: "partie", laenge });
    if (B && S && (S.phase === "brett" || S.phase === "ende")) B.binden(ctxBrett());
    const m = S && S.mission;
    if (m && m.schritt === "spiel" && UI[m.id] && UI[m.id].binden) UI[m.id].binden(ctxUI());
  }
  function kopieren() {
    const b = document.getElementById("kopieren");
    const fertig = () => { if (b) { b.textContent = "Kopiert"; setTimeout(() => { b.textContent = "Link kopieren"; }, 1500); } };
    try { navigator.clipboard.writeText(link()).then(fertig, () => prompt("Link kopieren:", link())); } catch (e) { prompt("Link kopieren:", link()); }
  }

  app.addEventListener("pointerdown", e => { if (e.target.closest && e.target.closest(".missionsfeld button, .steuerleiste button")) K.spiel("tipp"); }, { passive: true });
  // Ton an/aus: fester Knopf oben rechts, bleibt beim Neuzeichnen stehen
  (function tonKnopf() {
    const b = document.createElement("button");
    b.className = "tonknopf"; b.type = "button";
    const zeigen = () => { b.textContent = K.an ? "🔊" : "🔇"; b.setAttribute("aria-label", K.an ? "Ton ausschalten" : "Ton einschalten"); b.setAttribute("aria-pressed", String(!K.an)); };
    b.onclick = () => { K.umschalten(); zeigen(); };
    zeigen(); document.body.appendChild(b);
  })();

  // ---------- Start ----------
  if (typeof Peer === "undefined") { app.innerHTML = `<div class="mitte"><p>Die Verbindungsbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.</p></div>`; return; }
  if (code) {
    const gespeichert = ls.get("ob:host:" + code);
    if (gespeichert) fortsetzenAlsHost(gespeichert);
    else if (name) clientStarten();
    else render();
  } else if (params.get("bots") || params.get("mission") || params.get("partie")) {
    // Testlinks: ?bots=3 erstellt sofort einen Raum mit Bots, ?mission=funkfrequenz startet die Mission direkt,
    // ?partie=kurz startet gleich eine Partie auf dem Brett (mit 3 Bots, wenn nichts anderes angegeben ist)
    if (!name) { name = "Testpilot"; }
    const schnell = params.get("mission") || params.get("partie");
    neuesSpiel(Math.min(7, +params.get("bots") || (schnell ? 3 : 0)), params.get("mission"), params.get("partie"));
  } else render();
  window.__ob = { get S() { return S; }, get rolle() { return rolle; }, get verbunden() { return verbunden; }, get versatz() { return versatz; }, PID, tun: params.get("test") ? tun : undefined };
})();
