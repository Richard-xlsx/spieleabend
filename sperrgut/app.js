// Sperrgut: Verbindung (Handy des Spielleiters ist der Server, PeerJS), Uhrabgleich, Bildschirme, eigener Turm,
// kleine Türme der anderen, Karten, Bots und der gemeinsame WG-Turm (rechnet der Spielleiter).
(function () {
  const R = window.SG, ST = window.SG_TEILE, TU = window.SG_TURM, BOT = window.SG_BOT, SP = window.SG_SPIEL;
  const K = window.SG_KLANG || { spiel() {}, an: false, umschalten() { return false; } };
  const Z = () => window.SG_ZEICHNEN;
  const app = document.getElementById("app");
  const PREFIX = "fmwsg-";
  const ZEICHEN = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
  const PEER_OPT = window.SPIELEABEND_PEER ? window.SPIELEABEND_PEER() : { debug: 0 };
  const params = new URLSearchParams(location.search);
  const T = params.get("test") ? "-" + params.get("test") : "";
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k + T)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k + T, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k + T); } catch (e) {} }
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const FARBEN = () => (Z() && Z().FARBEN) || ["#E4572E", "#2E86DE", "#F3B700", "#3BB273", "#8E5CC4", "#EC4E9B", "#17A2B8", "#6D4C41"];

  let PID = ls.get("slf:pid"); if (!PID) { PID = Math.random().toString(36).slice(2, 10); ls.set("slf:pid", PID); }
  let name = ls.get("slf:name") || "";
  let code = (params.get("raum") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  let rolle = null, S = null, peer = null, hostConn = null, verbunden = false, offlineSeit = null, fehlerText = "", offline = false;
  const conns = new Map();
  let retryTimer = null, token = 0, versuch = 0, hinweis = "", hinweisTimer = null, letztesHtml = "";
  let knoepfe = ls.get("sg:knoepfe") === true;

  const hostId = ep => PREFIX + code + "-" + ep;
  const link = () => location.origin + location.pathname + "?raum=" + code;
  const testTeil = () => (params.get("test") ? "&test=" + params.get("test") : "");

  // ---------- Uhr ----------
  let versatz = 0, besteLaufzeit = Infinity;
  const hostJetzt = () => Date.now() + (rolle === "host" ? 0 : versatz);
  function pingen(n) { for (let i = 0; i < n; i++) setTimeout(() => { if (hostConn && hostConn.open) { try { hostConn.send({ t: "ping", pid: PID, c: Date.now() }); } catch (e) {} } }, i * 250); }
  function pong(m) {
    const jetzt = Date.now(), lauf = jetzt - m.c;
    if (lauf < 0 || lauf > 5000) return;
    if (lauf <= besteLaufzeit * 1.2) { besteLaufzeit = Math.min(besteLaufzeit, lauf); versatz = m.h + lauf / 2 - jetzt; }
  }
  setInterval(() => { besteLaufzeit *= 1.5; pingen(3); }, 20000);

  // ---------- Bildschirm wach halten ----------
  let wake = null;
  async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wachHalten(); if (rolle === "client" && !hostConn) verbindeZumHost(); } });
  document.addEventListener("click", wachHalten);

  // ---------- Spielleiter ----------
  function speichernHost() { if (!offline) ls.set("sg:host:" + code, S); }
  function hostStarten(s) {
    rolle = "host"; S = s; S.host = PID;
    if (S.spieler[PID]) S.spieler[PID].name = name || S.spieler[PID].name;
    speichernHost(); if (!offline) oeffneHostPeer(); else verbunden = true; geaendert();
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
    if (m.t === "snap") { snaps[m.pid] = m.d; return; }
    if (m.t === "wg") { wgEingabe(m.pid, m.k); return; }
    if (m.t === "hallo") conns.set(m.pid, c);
    const r = R.aktion(S, m.pid, m, Date.now());
    if (!r.ok && r.fehler && m.t !== "hallo") { try { c.send({ t: "fehler", text: r.fehler }); } catch (e) {} }
    if ((r.ok && !r.leise) || m.t === "hallo") geaendert();
  }
  function geaendert() {
    S.online = [PID].concat([...conns.keys()]);
    speichernHost();
    for (const [pid, c] of conns) { try { c.send({ t: "zustand", s: R.sicht(S, pid) }); } catch (e) {} }
    render();
  }
  // Takt: Zeiten und Ablauf beim Spielleiter
  setInterval(() => { if (rolle === "host" && S && R.takt(S, Date.now())) geaendert(); }, 200);
  // Stände der Türme sammeln und weiterreichen (für die kleinen Türme)
  const snaps = {};
  setInterval(() => {
    if (rolle !== "host" || !S || S.phase !== "auftrag" || !S.a || S.a.modus === "wg") return;
    if (turm && turmNr === S.a.nr) snaps[PID] = turm.momentaufnahme();
    const d = {}; for (const p of S.a.tn) if (snaps[p]) d[p] = snaps[p];
    for (const [, c] of conns) { try { c.send({ t: "tuerme", d }); } catch (e) {} }
    fremde = d;
  }, 400);

  // ---------- Mitspieler ----------
  function clientStarten() {
    rolle = "client";
    const k = ls.get("sg:kopie:" + code); if (k) S = k;
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
      if (m.t === "zustand") { S = m.s; ls.set("sg:kopie:" + code, S); render(); }
      else if (m.t === "tuerme") fremde = m.d;
      else if (m.t === "wgbild") wgBild = m.d;
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
  function uebernehmen() {
    if (!S) return;
    const s = JSON.parse(JSON.stringify(S)); s.epoch += 1;
    R.neustart(s, Date.now());
    ls.del("sg:kopie:" + code); clearTimeout(retryTimer); token++;
    if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
    hostStarten(s);
  }
  function fortsetzenAlsHost(gespeichert) {
    rolle = "pruefen"; render();
    const probe = new Peer(undefined, PEER_OPT); let fertig = false;
    const ende = alsClient => {
      if (fertig) return; fertig = true; try { probe.destroy(); } catch (e) {}
      if (alsClient) { ls.del("sg:host:" + code); ls.set("sg:kopie:" + code, gespeichert); clientStarten(); }
      else { R.neustart(gespeichert, Date.now()); hostStarten(gespeichert); }
    };
    probe.on("open", () => { const c = probe.connect(hostId(gespeichert.epoch + 1), { serialization: "json" }); c.on("open", () => ende(true)); });
    probe.on("error", () => ende(false));
    setTimeout(() => ende(false), 4000);
  }

  // ---------- Aktionen ----------
  function tun(m, leise) {
    if (rolle === "host") { const r = R.aktion(S, PID, m, Date.now()); if (r.ok && !r.leise) geaendert(); else if (!r.ok && r.fehler && !leise) zeigeHinweis(r.fehler); return r; }
    if (hostConn && hostConn.open) { try { hostConn.send(Object.assign({ pid: PID }, m)); } catch (e) {} }
    else if (!leise) zeigeHinweis("Keine Verbindung zum Spielleiter.");
  }
  function zeigeHinweis(t) { hinweis = t; render(); clearTimeout(hinweisTimer); hinweisTimer = setTimeout(() => { hinweis = ""; render(); }, 2600); }
  function neuesSpiel(bots, alleinModus) {
    offline = !!alleinModus;
    code = offline ? "ALLEIN" : (window.ABEND && ABEND.neuerRaum()) || Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
    if (!offline) history.replaceState(null, "", "?raum=" + code + testTeil());
    const s = R.neu(code, PID, name || "Ich");
    hostStarten(s);
    for (let i = 0; i < bots; i++) R.aktion(S, PID, { t: "bot", dazu: true }, Date.now());
    geaendert();
  }
  function verlassen() { if (!offline) { ls.del("sg:host:" + code); ls.del("sg:kopie:" + code); } location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : ""); }

  // ---------- Bausteine ----------
  const sp = p => (S && S.spieler[p]) || { name: "?", farbe: 0, punkte: 0 };
  const farbe = p => FARBEN()[sp(p).farbe % 8];
  const anfang = p => (sp(p).name || "?").trim().charAt(0).toUpperCase() || "?";
  const marke = p => `<span class="marke" style="--f:${farbe(p)}">${esc(anfang(p))}</span>`;
  const da = p => R.da(S, p);

  // =====================================================================
  // Eigener Turm während eines Auftrags
  // =====================================================================
  let turm = null, turmNr = null, turmModus = null, ansicht = null, steuer = null, fremde = {}, wgBild = null;
  let laufZuletzt = 0, haltSeit = null, fertigGemeldet = false, standZuletzt = 0, snapZuletzt = 0, angewendet = new Set(), effekte = { laken: 0, regen: 0 };
  let zielwahl = null, wunschWahl = null, meldungen = [];
  const TEMPO = { hoch: g => Math.min(3, 1.5 + 0.12 * Math.floor(g / 8)), kaputt: g => Math.min(4, 1.6 + 0.25 * Math.floor(g / 5)), wagen: () => 1.7 };

  function turmVorbereiten() {
    const a = S && S.phase === "auftrag" && S.a;
    if (!a) { if (turm) { turm = null; turmNr = null; } return; }
    if (turmNr === a.nr && turmModus === a.modus) return;
    turmNr = a.nr; turmModus = a.modus; haltSeit = null; fertigGemeldet = false; angewendet = new Set(); effekte = { laken: 0, regen: 0 }; zielwahl = null; wunschWahl = null; fremde = {}; wgBild = null; meldungen = [];
    for (const k in snaps) delete snaps[k];
    turm = null;
    if (a.modus !== "wg" && a.tn.includes(PID)) {
      turm = TU.neu({ modus: a.modus, folge: ST.folge(a.seed, 400), dach: a.dach, max: a.modus === "kaputt" ? R.TEILE_KAPUTT : 0 });
    }
    botsVorbereiten();
  }
  function laufen(jetztMs) {
    const a = S && S.phase === "auftrag" && S.a;
    const dt = Math.min(0.1, (jetztMs - laufZuletzt) / 1000); laufZuletzt = jetztMs;
    if (!a || !turm || turmNr !== a.nr) return;
    const hj = hostJetzt();
    if (hj < a.start) return;
    const s = a.st[PID];
    turm.tempo = TEMPO[a.modus](turm.gesetzt);
    turm.schritt(dt);
    // Ereignisse
    for (const e of turm.ereignisse) {
      if (e.art === "plumps") K.spiel("plumps", e.staerke);
      else if (e.art === "bruch") { K.spiel("bruch"); if (ansicht) ansicht.bruch(e.x, e.y); brumm(60); standZuletzt = 0; }
      else if (e.art === "pizza") { tun({ t: "pizza" }, true); K.spiel("karte"); }
      else if (e.art === "fall") K.spiel("fall");
      else if (e.art === "miau") K.spiel("miau");
    }
    turm.ereignisse.length = 0;
    if (!turm.ende) {
      if (a.modus === "hoch") {
        if (turm.hoehe >= a.fenster) { if (haltSeit == null) haltSeit = hj; if (hj - haltSeit >= R.ZEIT.halten) { fertigMelden({ ziel: haltSeit + R.ZEIT.halten }); K.spiel("ziel"); } }
        else haltSeit = null;
      } else if (a.modus === "kaputt") {
        if (turm.bruch >= R.LEBEN) fertigMelden({});
        else if (turm.max && turm.i >= turm.max && !turm.aktiv && !turm.vorne.length) { if (haltSeit == null) haltSeit = hj; if (hj - haltSeit > 2500) fertigMelden({ fertig: true }); }
      } else if (a.modus === "wagen" && turm.dachVoll) fertigMelden({ voll: true });
    }
    if (s && (s.fertig != null || s.raus) && !turm.ende) turm.stopp();
    if (hj - standZuletzt > 300) { standZuletzt = hj; standSenden({}); }
    if (rolle === "client" && hj - snapZuletzt > 400 && hostConn && hostConn.open) { snapZuletzt = hj; try { hostConn.send({ t: "snap", pid: PID, d: turm.momentaufnahme() }); } catch (e) {} }
    // Gemeinheiten und Hilfen, die mich treffen
    for (const ev of a.ev) {
      const k = a.nr + ":" + ev.id;
      if (angewendet.has(k)) continue;
      if (!angewendet.has("m" + k)) {
        angewendet.add("m" + k);
        const K2 = R.KARTEN[ev.art];
        if (ev.an === PID && ev.von !== PID) { melden(`<b style="color:${farbe(ev.von)}">${esc(sp(ev.von).name)}</b> schickt dir: ${esc(K2.name)}!`, true); K.spiel("gemein"); brumm([50, 40, 120]); }
        else if (ev.von === PID && ev.an !== PID) melden(`${esc(K2.name)} fliegt zu <b style="color:${farbe(ev.an)}">${esc(sp(ev.an).name)}</b>.`);
        else if (ev.an !== PID) melden(`${esc(sp(ev.von).name)} → ${esc(sp(ev.an).name)}: ${esc(K2.name)}`);
      }
      if (ev.an !== PID || hj < ev.ab) continue;
      angewendet.add(k);
      wirkung(turm, ev.art, true);
    }
  }
  // Karte auf einen Turm anwenden (eigener Turm oder ein Bot beim Spielleiter)
  function wirkung(t, art, ich) {
    const jetzt = performance.now();
    if (art === "klavier") { t.einfuegen("klavier"); if (ich) K.spiel("klavier"); }
    else if (art === "katze") t.katze();
    else if (art === "regen") { t.regen(3); if (ich) { effekte.regen = jetzt + 6000; K.spiel("regen"); } }
    else if (art === "ball") t.einfuegen("ball");
    else if (art === "laken") { if (ich) { effekte.laken = jetzt + 8000; K.spiel("laken"); } else t._laken = t.zeit + 8; }
    else if (art === "schwager") t.verdrehtBis = t.zeit + 8;
    else if (art === "festhalten") { t.festhalten(10); if (ich) K.spiel("hilfe"); }
    else if (art === "gurt") { t.spanngurt(); if (ich) K.spiel("hilfe"); }
    else if (art === "kisten") { t.einfuegen("kiste", 2); if (ich) K.spiel("hilfe"); }
    else if (art === "atmen") { t.langsam(3); if (ich) K.spiel("hilfe"); }
    else if (art === "wunsch") {
      if (!ich) { t.wunsch("O"); return; }
      const alle = ["O", "I", "kiste", "T", "kuehlschrank", "matratze", "L", "J"];
      const wahl = []; while (wahl.length < 3) { const x = alle[Math.floor(Math.random() * alle.length)]; if (!wahl.includes(x)) wahl.push(x); }
      wunschWahl = wahl; K.spiel("hilfe"); aufbauFuss();
    }
  }
  function standDaten() {
    const t = turm, z = t.liste().filter(e => e.zerbrechlich && e.im && !e.aktiv).length;
    return { t: "stand", h: Math.round(t.hoehe * 10) / 10, b: t.bruch, g: t.gesetzt, w: t.inWagen, z };
  }
  function standSenden(extra) { if (!turm) return; tun(Object.assign(standDaten(), extra), true); }
  function fertigMelden(extra) {
    if (fertigGemeldet) return;
    fertigGemeldet = true; turm.stopp(); standSenden(extra); brumm([60, 50, 160]);
  }
  function melden(html, wichtig) {
    meldungen.push({ html, bis: performance.now() + (wichtig ? 3500 : 2600), wichtig });
    if (meldungen.length > 3) meldungen.shift();
    zeigeMeldungen();
  }

  // ---------- Bots beim Spielleiter ----------
  let bots = {};
  function botsVorbereiten() {
    bots = {};
    const a = S.a;
    if (rolle !== "host" || a.modus === "wg") return;
    let n = 0;
    for (const p of a.tn) if (R.istBot(S, p)) {
      n++;
      const rng = ST.rng(a.seed + n * 977);
      bots[p] = { t: TU.neu({ modus: a.modus, folge: ST.folge(a.seed, 400), dach: a.dach, max: a.modus === "kaputt" ? R.TEILE_KAPUTT : 0, planck: window.planck }), rng, geschick: 0.45 + rng() * 0.4, halt: null, fertig: false, karteAb: 0, angewendet: new Set(), stand: 0 };
    }
  }
  setInterval(() => {
    if (rolle !== "host" || !S || S.phase !== "auftrag" || !S.a || S.a.modus === "wg") return;
    const a = S.a, jetzt = Date.now();
    if (jetzt < a.start) return;
    let anders = false;
    for (const p in bots) {
      const b = bots[p], t = b.t, s = a.st[p];
      if (!s) continue;
      t.tempo = TEMPO[a.modus](t.gesetzt);
      if (!t.ende) BOT.steuern(t, 0.05, { modus: a.modus, rng: b.rng, geschick: b.geschick });
      t.schritt(0.05);
      for (const e of t.ereignisse) if (e.art === "pizza") { R.aktion(S, p, { t: "pizza" }, jetzt); b.karteAb = jetzt + 1500 + b.rng() * 3000; anders = true; }
      t.ereignisse.length = 0;
      if (!b.fertig) {
        let extra = null;
        if (a.modus === "hoch") { if (t.hoehe >= a.fenster) { if (b.halt == null) b.halt = jetzt; if (jetzt - b.halt >= R.ZEIT.halten) extra = { ziel: b.halt + R.ZEIT.halten }; } else b.halt = null; }
        else if (a.modus === "kaputt") { if (t.bruch >= R.LEBEN) extra = {}; else if (t.i >= t.max && !t.aktiv && !t.vorne.length) { if (b.halt == null) b.halt = jetzt; if (jetzt - b.halt > 2500) extra = { fertig: true }; } }
        else if (a.modus === "wagen" && t.dachVoll) extra = { voll: true };
        if (extra) { b.fertig = true; t.stopp(); }
        if (extra || jetzt - b.stand > 300) {
          b.stand = jetzt;
          const z = t.liste().filter(e => e.zerbrechlich && e.im && !e.aktiv).length;
          const r = R.aktion(S, p, Object.assign({ t: "stand", h: Math.round(t.hoehe * 10) / 10, b: t.bruch, g: t.gesetzt, w: t.inWagen, z }, extra || {}), jetzt);
          if (r.ok && !r.leise) anders = true;
        }
      }
      if ((s.fertig != null || s.raus) && !t.ende) t.stopp();
      // Karten benutzen
      const k = a.karten[p];
      if (k && k.length && b.karteAb && jetzt > b.karteAb) { R.aktion(S, p, { t: "karte", i: 0 }, jetzt); b.karteAb = jetzt + 2500; anders = true; }
      for (const ev of a.ev) if (ev.an === p && jetzt >= ev.ab && !b.angewendet.has(ev.id)) { b.angewendet.add(ev.id); wirkung(t, ev.art, false); }
      snaps[p] = t.momentaufnahme();
    }
    if (anders) geaendert();
  }, 50);

  // ---------- WG-Umzug: gemeinsamer Turm beim Spielleiter ----------
  let wg = null, wgNr = null, wgZug = null;
  function wgEingabe(pid, k) {
    if (rolle !== "host" || !wg || !S.a || !S.a.wg || S.a.wg.dran !== pid || S.a.wg.schritt !== "zielen") return;
    if (k === "l") wg.schieben(-1); else if (k === "r") wg.schieben(1); else if (k === "d") wg.drehen(); else if (k === "f") wg.fallen(); else if (k === "s1") wg.schnell(true); else if (k === "s0") wg.schnell(false);
  }
  setInterval(() => {
    if (rolle !== "host" || !S || S.phase !== "auftrag" || !S.a || S.a.modus !== "wg") { wg = null; return; }
    const a = S.a, g = a.wg, jetzt = Date.now();
    if (wgNr !== a.nr) { wgNr = a.nr; wg = TU.neu({ modus: "wg", folge: ST.folge(a.seed, 300, { pizza: false }), manuell: true, planck: window.planck }); wg.tempo = 1.4; wgZug = null; }
    if (jetzt < a.start) return;
    // neuer Zug: ein Teil erscheint
    if (g.schritt === "zielen" && wgZug !== g.dran + ":" + g.zugBis) { wgZug = g.dran + ":" + g.zugBis; wg.bereit = true; wg.pause = 0.2; wg._botPlan = null; }
    if (g.schritt === "zielen" && jetzt > g.zugBis && wg.aktiv && !wg.aktiv.sturz) wg.fallen();
    if (g.schritt === "zielen" && R.istBot(S, g.dran)) BOT.steuern(wg, 0.033, { modus: "hoch", geschick: 0.75 });
    wg.schritt(0.033);
    let anders = false;
    for (const e of wg.ereignisse) {
      if (e.art === "plumps") { if (R.aktion(S, PID, { t: "wgGesetzt" }, jetzt).ok) anders = true; }
      else if (e.art === "bruch") { if (R.aktion(S, PID, { t: "wgBruch" }, jetzt).ok) anders = true; }
    }
    wg.ereignisse.length = 0;
    // Bild an alle (15-mal pro Sekunde)
    wgTick = (wgTick + 1) % 2;
    if (wgTick === 0) {
      const lot = wg.lot();
      const d = { teile: wg.momentaufnahme(), lot: lot ? [lot.x0, lot.x1, lot.y, lot.unten].map(v => Math.round(v * 100) / 100) : null, h: wg.hoehe, o: wg.oben, z: jetzt };
      wgBild = d;
      for (const [, c] of conns) { try { c.send({ t: "wgbild", d }); } catch (e) {} }
    }
    if (anders) geaendert();
  }, 33);
  let wgTick = 0;
  // Ansicht des gemeinsamen Turms aus dem Bild des Spielleiters
  const wgTurm = {
    get hoehe() { return wgBild ? wgBild.h : 0; }, get oben() { return wgBild ? wgBild.o : 0; }, dach: 8,
    liste() { return wgBild ? TU.lesen(wgBild.teile) : []; },
    lot() { if (!wgBild || !wgBild.lot) return null; const [x0, x1, y, unten] = wgBild.lot; return { x0, x1, y, unten }; },
    katzePos() { return null; }
  };

  // =====================================================================
  // Bildschirme
  // =====================================================================
  function statusZeile() {
    if (offline) return "";
    if (rolle === "host") return verbunden ? "" : (fehlerText || "Raum wird geöffnet …");
    if (rolle === "client" && !verbunden) return S ? "Verbindung zum Spielleiter weg, verbinde neu …" : (fehlerText || (window.ABEND && ABEND.aktiv ? "" : "Verbinde mit Raum " + code + " …"));
    return "";
  }
  let beruehrt = false;
  window.addEventListener("pointerdown", () => { beruehrt = true; }, { passive: true, once: true });
  const brumm = muster => { try { if (beruehrt && navigator.vibrate && document.visibilityState === "visible") navigator.vibrate(muster); } catch (e) {} };

  function titelbild() {
    // Kartonturm vor einem Altbaufenster
    const k = (x, y, w, h, f, t) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="#C8965A" stroke="#2A1D14" stroke-width="2"/><rect x="${x + w / 2 - 3}" y="${y}" width="6" height="${h}" fill="${f}"/>${t ? `<text x="${x + 6}" y="${y + h - 6}" font-family="Permanent Marker,cursive" font-size="8" fill="#2A1D14">${t}</text>` : ""}</g>`;
    return `<svg class="titelbild" viewBox="0 0 300 160" role="img" aria-label="Ein wackliger Turm aus Umzugskartons und einem Sofa vor dem offenen Fenster eines Altbaus">
      <rect x="0" y="0" width="300" height="160" fill="#F1E3C8"/><rect x="170" y="14" width="56" height="62" rx="3" fill="#7FB6D9" stroke="#2A1D14" stroke-width="2.5"/>
      <path d="M170 14h56v8h-56z" fill="#E7D3AE" stroke="#2A1D14" stroke-width="2"/><path d="M176 22q8 26 0 54M220 22q-8 26 0 54" stroke="#FFFFFF" stroke-width="5" fill="none" opacity=".9"/>
      <rect x="164" y="74" width="68" height="7" rx="2" fill="#E7D3AE" stroke="#2A1D14" stroke-width="2"/><path d="M0 74h300" stroke="#D9542B" stroke-width="2" stroke-dasharray="6 6"/>
      <rect x="10" y="22" width="40" height="50" rx="3" fill="#7FB6D9" stroke="#2A1D14" stroke-width="2.5" opacity=".7"/>
      <rect x="0" y="146" width="300" height="14" fill="#9C8C7C"/><path d="M0 146h300" stroke="#2A1D14" stroke-width="2"/>
      <rect x="80" y="138" width="130" height="8" fill="#B07A45" stroke="#2A1D14" stroke-width="2"/>
      ${k(88, 112, 50, 26, "#E4572E", "Küche")}${k(140, 106, 40, 32, "#2E86DE", "Kram")}${k(182, 116, 24, 22, "#F3B700")}
      <g transform="rotate(-4 140 100)"><path d="M96 86h82v18h-82z" fill="#6D8F4E" stroke="#2A1D14" stroke-width="2"/><rect x="92" y="78" width="12" height="26" rx="4" fill="#5C7A40" stroke="#2A1D14" stroke-width="2"/><rect x="172" y="78" width="12" height="26" rx="4" fill="#5C7A40" stroke="#2A1D14" stroke-width="2"/></g>
      <g transform="rotate(7 150 60)">${k(122, 44, 32, 30, "#3BB273", "Bücher")}${k(156, 50, 22, 24, "#E4572E")}</g>
      <g class="tb-wackel"><rect x="138" y="20" width="16" height="26" rx="2" fill="#F4F4F4" stroke="#2A1D14" stroke-width="2"/><path d="M141 30h10" stroke="#2A1D14" stroke-width="2"/></g>
      <g transform="translate(244 104)"><rect x="0" y="0" width="54" height="36" rx="3" fill="#2E86DE" stroke="#2A1D14" stroke-width="2"/><circle cx="12" cy="40" r="6" fill="#2A1D14"/><circle cx="42" cy="40" r="6" fill="#2A1D14"/></g></svg>`;
  }
  function bildschirmStart() {
    return `<header class="titel">${titelbild()}<h1>Sperrgut</h1><p class="leise">Umzugstag! Der Aufzug ist kaputt, also stapelt jeder seinen Hausrat bis zum Fenster der neuen Wohnung. Es wackelt, es rutscht, und der Nachbar bringt noch sein Klavier.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
      <div class="karte-box"><h2>Neues Spiel</h2><p class="leise klein">Für 2 bis 8 Leute, jeder am eigenen Handy.</p><button class="knopf" id="neu">Raum erstellen</button></div>
      <div class="karte-box"><h2>Mitspielen</h2><label class="feld">Raumcode<input id="code" maxlength="6" autocapitalize="characters" placeholder="z. B. K7M2"></label><button class="knopf zweit" id="beitreten">Beitreten</button></div>
      <div class="karte-box"><h2>Üben</h2><p class="leise klein">Allein ohne Netz, auf Wunsch mit Bots.</p><button class="knopf zweit" id="allein">Allein üben</button></div>
      <a class="link" href="../">Alle Spiele</a>`;
  }
  function bildschirmName() {
    return `<header class="titel"><h1>Sperrgut</h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
      <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
      <button class="knopf" id="mitspielen">Mitspielen</button>`;
  }
  function bildschirmLobby() {
    const host = rolle === "host", leute = S.reihe.filter(p => S.spieler[p] && da(p)), weg = S.reihe.filter(p => S.spieler[p] && !da(p));
    let qr = "";
    if (!offline) try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
    const zeile = p => `<li>${marke(p)}<span class="nm">${esc(sp(p).name)}${p === S.host && !offline ? " <small>Spielleitung</small>" : ""}${p === PID ? " <small>du</small>" : ""}${R.istBot(S, p) ? " <small>Bot</small>" : ""}</span></li>`;
    const meine = sp(PID).farbe;
    const farben = FARBEN().map((f, i) => { const belegt = Object.entries(S.spieler).some(([q, s]) => q !== PID && s.farbe === i); return `<button class="farbe ${i === meine ? "an" : ""}" data-farbe="${i}" style="--f:${f}" ${belegt ? "disabled" : ""} aria-label="Farbe ${i + 1}"></button>`; }).join("");
    const laengen = Object.entries(R.LAENGEN).map(([k, l]) => `<button class="wahl ${S.einst.laenge === k ? "an" : ""}" data-laenge="${k}" ${host ? "" : "disabled"}><b>${l.name}</b><small>${l.n} Aufträge</small></button>`).join("");
    const arten = Object.entries(R.ARTEN).map(([k, a]) => `<button class="art ${S.einst.arten[k] ? "an" : ""}" data-art="${k}" ${host ? "" : "disabled"}><span class="haken">${S.einst.arten[k] ? "✓" : ""}</span><span><b>${esc(a.name)}</b><small>${esc(a.kurz)}</small></span></button>`).join("");
    const ueben = host ? Object.entries(R.ARTEN).map(([k, a]) => `<button class="knopf zweit klein-knopf" data-einzeln="${k}">${esc(a.name)}</button>`).join("") : "";
    return `${offline ? `<header class="titel"><p class="etikett">Sperrgut · Üben</p></header>` : `<header class="titel"><p class="etikett">Sperrgut · Raumcode</p><div class="code">${esc(code)}</div></header>
      <div class="karte-box einladen">${qr ? `<div class="qr">${qr}</div>` : ""}<div><p class="leise klein">Scannen oder Link teilen:</p><button class="knopf zweit klein-knopf" id="teilen">Link kopieren</button></div></div>`}
      <div class="karte-box"><h2>Umzugsteam (${leute.length})</h2><ul class="liste">${leute.map(zeile).join("")}</ul>
        ${weg.length ? `<p class="leise klein">Nicht verbunden: ${weg.map(p => esc(sp(p).name)).join(", ")}</p>` : ""}
        ${host ? `<div class="reihe"><button class="knopf zweit klein-knopf" id="botDazu">+ Bot</button><button class="knopf zweit klein-knopf" id="botWeg">− Bot</button></div>` : ""}</div>
      <div class="karte-box"><h2>Deine Farbe fürs Paketband</h2><div class="farben">${farben}</div></div>
      <div class="karte-box"><h2>Umzugstag</h2><div class="laengen">${laengen}</div><div class="arten">${arten}</div>
        ${host ? `<button class="knopf" id="start">Umzugstag starten</button>` : `<p class="leise mitte">Die Spielleitung startet den Umzugstag.</p>`}</div>
      ${host ? `<div class="karte-box"><h2>Nur ein Auftrag</h2><p class="leise klein">Zum Ausprobieren, ohne Wertung über den Tag.</p><div class="reihe umbruch">${ueben}</div></div>` : ""}
      <div class="karte-box"><h2>So geht's</h2><ul class="regeln"><li><b>Ziehen</b> nach links oder rechts schiebt das Teil.</li><li><b>Tippen</b> dreht es.</li><li><b>Nach unten wischen</b> lässt es fallen, <b>gedrückt halten</b> macht es schneller.</li><li>Bleibt ein <b>Pizza-Karton</b> liegen, ziehst du eine Karte: eine Hilfe für dich oder eine Gemeinheit für die anderen.</li></ul>
        <label class="schalter"><input type="checkbox" id="knoepfeAn" ${knoepfe ? "checked" : ""}> Lieber mit Knöpfen steuern</label></div>
      <button class="link" id="verlassen">${offline ? "Zurück" : "Raum verlassen"}</button>`;
  }

  // ---------- Auftrag ----------
  function bildschirmAuftrag() {
    const a = S.a, A = R.ARTEN[a.modus];
    return `<div class="auftrag" data-nr="${a.nr}" data-modus="${a.modus}">
      <div class="kopf"><div class="info"><b>${esc(A.name)}</b><span id="infozeile"></span></div><div class="minis" id="minis"></div></div>
      <div class="buehne" id="buehne"><canvas id="turm" aria-label="Dein Turm"></canvas>
        <div class="meldungen" id="meldungen" aria-live="polite"></div>
        <div class="countdown" id="countdown"></div><div class="ueber" id="ueber" hidden></div></div>
      <div class="fuss" id="fuss"></div></div>`;
  }
  // Teile des Auftragsbildschirms, die sich ändern, ohne die Bühne neu zu bauen
  function aufbauFuss() {
    const f = document.getElementById("fuss"); if (!f || !S || !S.a) return;
    const a = S.a;
    if (a.modus === "wg") {
      const g = a.wg, ich = g.dran === PID && g.schritt === "zielen";
      f.innerHTML = ich ? knopfLeiste() : `<p class="leise mitte">${g.dran ? `${marke(g.dran)} <b>${esc(sp(g.dran).name)}</b> ist dran` : ""}</p>`;
      f.dataset.key = "wg" + ich;
      bindeKnopfLeiste(); return;
    }
    const karten = a.karten[PID] || [], key = JSON.stringify([karten, knoepfe, wunschWahl, zielwahl && zielwahl.i, turm && turm.naechsterTyp()]);
    if (f.dataset.key === key) return;
    f.dataset.key = key;
    if (wunschWahl) {
      f.innerHTML = `<div class="wunsch"><span class="leise klein">Wunschteil:</span>${wunschWahl.map(t => `<button class="vorschau knopfteil" data-wunsch="${t}"><canvas data-typ="${t}" width="80" height="60"></canvas><small>${esc(ST.TEILE[t].name)}</small></button>`).join("")}</div>`;
    } else {
      const slot = i => { const k = karten[i]; if (!k) return `<div class="karte leer"><small>Pizza-Karton verbauen</small></div>`; const KK = R.KARTEN[k]; return `<button class="karte ${KK.gemein ? "gemein" : "hilfe"} ${zielwahl && zielwahl.i === i ? "zielt" : ""}" data-karte="${i}" title="${esc(KK.text)}"><b>${esc(KK.name)}</b><small>${KK.gemein ? "Gemeinheit" : "Hilfe"}</small></button>`; };
      const naechst = turm ? turm.naechsterTyp() : null;
      f.innerHTML = `<div class="karten">${slot(0)}${slot(1)}</div>${knoepfe ? knopfLeiste() : ""}<div class="vorschau"><small>als Nächstes</small><canvas id="naechstes" data-typ="${naechst || ""}" width="90" height="64"></canvas></div>`;
    }
    f.querySelectorAll("canvas[data-typ]").forEach(cv => { const typ = cv.dataset.typ; if (!typ) return; const g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height); if (Z() && Z().vorschau) Z().vorschau(g, typ, cv.width, cv.height, { farbe: farbe(PID) }); else { g.save(); const s = Math.min(cv.width, cv.height) / (ST.radius(typ) * 2.3); g.translate(cv.width / 2, cv.height / 2); g.fillStyle = "#C8965A"; const T = ST.TEILE[typ]; if (T.kreis) { g.beginPath(); g.arc(0, 0, T.kreis * s, 0, 7); g.fill(); } else for (const [x, y, w, h] of T.rects) g.fillRect(x * s, y * s, w * s - 1, h * s - 1); g.restore(); } });
    f.querySelectorAll("[data-karte]").forEach(b => b.onclick = () => karteTippen(+b.dataset.karte));
    f.querySelectorAll("[data-wunsch]").forEach(b => b.onclick = () => { if (turm) turm.wunsch(b.dataset.wunsch); wunschWahl = null; aufbauFuss(); });
    bindeKnopfLeiste();
  }
  const knopfLeiste = () => `<div class="knopfleiste"><button data-k="l" aria-label="links">◀</button><button data-k="d" aria-label="drehen">⟳</button><button data-k="r" aria-label="rechts">▶</button><button data-k="f" aria-label="fallen lassen">⤓</button></div>`;
  function bindeKnopfLeiste() {
    document.querySelectorAll(".knopfleiste [data-k]").forEach(b => {
      b.onpointerdown = e => { e.preventDefault(); const z = ziel(); const k = b.dataset.k; if (k === "l") z.schieben(-1); else if (k === "r") z.schieben(1); else if (k === "d") z.drehen(); else z.fallen(); };
    });
  }
  function karteTippen(i) {
    const a = S.a, k = (a.karten[PID] || [])[i]; if (!k) return;
    if (!R.KARTEN[k].gemein) { tun({ t: "karte", i }); K.spiel("hilfe"); return; }
    if (zielwahl && zielwahl.i === i) { clearTimeout(zielwahl.timer); tun({ t: "karte", i }); zielwahl = null; K.spiel("gemein"); aufbauFuss(); minisZeichnen(true); return; }
    clearTimeout(zielwahl && zielwahl.timer);
    zielwahl = { i, timer: setTimeout(() => { if (zielwahl && zielwahl.i === i) { tun({ t: "karte", i }); zielwahl = null; aufbauFuss(); minisZeichnen(true); } }, 4000) };
    melden("Tippe oben auf einen Turm, sonst trifft es den Führenden.");
    aufbauFuss(); minisZeichnen(true);
  }
  // Steuerung: eigener Turm oder (im WG-Umzug) Eingaben an den Spielleiter
  function ziel() {
    const a = S && S.a;
    if (a && a.modus === "wg") {
      const send = k => { if (!a.wg || a.wg.dran !== PID) return; if (rolle === "host") wgEingabe(PID, k); else if (hostConn && hostConn.open) try { hostConn.send({ t: "wg", pid: PID, k }); } catch (e) {} };
      return { schieben: r => { send(r < 0 ? "l" : "r"); K.spiel("schieb"); }, drehen: () => { send("d"); K.spiel("dreh"); }, fallen: () => send("f"), schnell: an => send(an ? "s1" : "s0"), proFeld: () => (ansicht ? ansicht.s : 30) };
    }
    return {
      schieben: r => { if (turm && turm.schieben(r)) K.spiel("schieb"); },
      drehen: () => { if (turm && turm.drehen()) K.spiel("dreh"); },
      fallen: () => { if (turm) turm.fallen(); },
      schnell: an => { if (turm) turm.schnell(an); },
      proFeld: () => (ansicht ? ansicht.s : 30)
    };
  }
  let miniKey = "";
  function minisZeichnen(neu) {
    const el = document.getElementById("minis"); if (!el || !S || !S.a) return;
    const a = S.a, andere = a.modus === "wg" ? a.wg.reihe.concat(a.wg.raus) : a.tn.filter(p => p !== PID);
    const key = andere.join(",") + (zielwahl ? "z" : "") + JSON.stringify(andere.map(p => [a.st[p] && a.st[p].fertig != null, a.st[p] && a.st[p].raus, a.modus === "wg" && a.wg.dran === p]));
    if (neu || key !== miniKey) {
      miniKey = key;
      el.innerHTML = andere.map(p => {
        const s = a.st[p] || {};
        const zusatz = a.modus === "wg" ? (a.wg.dran === p ? "dran" : s.raus ? "raus" : "") : s.fertig != null ? "fertig" : s.raus ? "raus" : "";
        return `<button class="mini ${zielwahl && !s.raus && s.fertig == null ? "zielbar" : ""} ${zusatz}" data-ziel="${p}" style="--f:${farbe(p)}" aria-label="${esc(sp(p).name)}">${a.modus === "wg" ? "" : `<canvas></canvas>`}<span class="mname">${marke(p)}<i></i></span></button>`;
      }).join("");
      el.querySelectorAll("[data-ziel]").forEach(b => b.onclick = () => {
        if (!zielwahl || a.modus === "wg") return;
        clearTimeout(zielwahl.timer); tun({ t: "karte", i: zielwahl.i, ziel: b.dataset.ziel }); zielwahl = null; K.spiel("gemein"); aufbauFuss(); minisZeichnen(true);
      });
    }
    el.querySelectorAll("[data-ziel]").forEach(b => {
      const p = b.dataset.ziel, s = a.st[p] || {}, cv = b.querySelector("canvas"), i = b.querySelector("i");
      const text = a.modus === "hoch" ? (s.fertig != null ? "✓" : (s.h || 0).toFixed(1)) : a.modus === "kaputt" ? (s.raus ? "raus" : "♥".repeat(s.l || 0)) : a.modus === "wagen" ? (s.w || 0) + (s.raus ? " ✓" : "") : (s.raus ? "raus" : a.wg.dran === p ? "dran" : "");
      if (i && i.textContent !== text) i.textContent = text;
      if (cv) SP.mini(cv, TU.lesen(fremde[p]), { farbe: farbe(p), fenster: a.fenster, modus: a.modus, dach: a.dach });
    });
  }
  function zeigeMeldungen() {
    const el = document.getElementById("meldungen"); if (!el) return;
    const jetzt = performance.now();
    meldungen = meldungen.filter(m => m.bis > jetzt);
    const h = meldungen.map(m => `<div class="meldung ${m.wichtig ? "wichtig" : ""}">${m.html}</div>`).join("");
    if (el.innerHTML !== h) el.innerHTML = h;
  }
  function infoZeile() {
    const a = S.a, hj = hostJetzt(), s = a.st[PID];
    let t = "";
    const rest = Math.max(0, Math.ceil((a.ende - hj) / 1000));
    if (a.modus === "hoch") t = turm ? `Höhe ${turm.hoehe.toFixed(1)} von ${a.fenster}` + (a.erster ? ` · noch ${Math.max(0, Math.ceil((a.erster + R.ZEIT.nach - hj) / 1000))} s` : ` · ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, "0")}`) : "Du schaust zu";
    else if (a.modus === "kaputt") t = turm ? `${"♥".repeat(Math.max(0, R.LEBEN - turm.bruch))}${"♡".repeat(Math.min(R.LEBEN, turm.bruch))} · Teil ${Math.min(turm.i, R.TEILE_KAPUTT)} von ${R.TEILE_KAPUTT}` : "";
    else if (a.modus === "wagen") t = turm ? `${turm.inWagen} Teile im Wagen · ${rest} s` : "";
    else if (a.modus === "wg") { const g = a.wg; t = g.dran === PID && g.schritt === "zielen" ? `Du bist dran · ${Math.max(0, Math.ceil((g.zugBis - hj) / 1000))} s` : g.schritt === "pause" && g.letzterRaus ? `${esc(sp(g.letzterRaus).name)} zahlt die Pizza!` : g.dran ? `${esc(sp(g.dran).name)} ist dran` : ""; }
    if (s && s.fertig != null && a.modus === "hoch") t = "Geschafft! Warte auf die anderen …";
    return t;
  }
  function auftragAktualisieren() {
    const a = S.a, hj = hostJetzt();
    const inf = document.getElementById("infozeile"); if (inf) { const t = infoZeile(); if (inf.innerHTML !== t) inf.innerHTML = t; }
    aufbauFuss(); minisZeichnen(false); zeigeMeldungen();
    const cd = document.getElementById("countdown");
    if (cd) {
      const r = Math.ceil((a.start - hj) / 1000), txt = hj < a.start ? (r > 3 ? R.ARTEN[a.modus].kurz : String(r)) : hj < a.start + 700 ? "Los!" : "";
      if (cd.textContent !== txt) { cd.textContent = txt; cd.className = "countdown" + (r > 3 && hj < a.start ? " text" : txt ? " puls" : ""); if (txt === "Los!") K.spiel("start"); else if (/^[123]$/.test(txt)) K.spiel("countdown"); }
    }
    const ue = document.getElementById("ueber"), s = a.st[PID];
    let u = "";
    if (!a.tn.includes(PID)) u = "Du steigst beim nächsten Auftrag ein.";
    else if (a.modus === "hoch" && s.fertig != null) u = "Geschafft! 🎉";
    else if (a.modus === "kaputt" && s.raus) u = "Dreimal Bruch, du bist raus.";
    else if (a.modus === "kaputt" && s.fertigK) u = "Alle Teile verbaut!";
    else if (a.modus === "wagen" && s.raus) u = "Wagen voll!";
    else if (a.modus === "wg" && s.raus) u = "Du zahlst die Pizza 🍕";
    if (ue) { ue.hidden = !u; if (ue.textContent !== u) ue.textContent = u; }
  }

  // Zeichnen in jedem Bild
  (function bild(ms) {
    try {
      if (S && S.phase === "auftrag" && S.a) {
        laufen(ms);
        const cv = document.getElementById("turm");
        if (cv) {
          if (!ansicht || ansicht.cv !== cv) { ansicht = SP.ansicht(cv); ansicht.cv = cv; }
          const a = S.a, t = a.modus === "wg" ? wgTurm : turm || (fremde && null);
          const jetzt = performance.now();
          if (t) ansicht.zeichnen(t, { farbe: a.modus === "wg" ? "#8E5CC4" : farbe(PID), modus: a.modus, fenster: a.fenster, tag: a.tag, laken: jetzt < effekte.laken, regen: jetzt < effekte.regen || (turm && turm.aktiv && turm.aktiv.nass), jetzt });
          else { const g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height); }
        }
      }
    } catch (e) { console.error(e); }
    requestAnimationFrame(bild);
  })(0);
  setInterval(() => { if (S && S.phase === "auftrag" && S.a && document.querySelector(".auftrag")) auftragAktualisieren(); }, 150);

  // ---------- Ergebnis und Siegerehrung ----------
  function wertText(modus, e) {
    if (modus === "hoch") return e.fertig != null ? `oben nach ${(e.fertig / 1000).toFixed(1)} s` : `Höhe ${e.h.toFixed(1)}`;
    if (modus === "kaputt") return `${e.l} ♥ · ${Math.max(0, e.g - e.b)} Teile`;
    if (modus === "wagen") return `${e.w} Teile im Wagen`;
    return e.platz === 1 ? "hat durchgehalten" : "zahlt die Pizza";
  }
  function bildschirmErgebnis() {
    const e = S.erg, host = rolle === "host", T = S.tag;
    const zeilen = e.liste.map(x => `<li class="${x.pid === PID ? "ich" : ""}"><span class="platz">${x.platz}.</span>${marke(x.pid)}<span class="nm">${esc(sp(x.pid).name)}<small>${esc(wertText(e.modus, x))}${x.bonus ? ` · ${x.bonus} heil (Glas)` : ""}</small></span><span class="punkte">+${x.punkte}</span></li>`).join("");
    const stand = S.reihe.filter(p => S.spieler[p]).sort((x, y) => sp(y).punkte - sp(x).punkte).map(p => `<li>${marke(p)}<span class="nm">${esc(sp(p).name)}</span><span class="punkte">${sp(p).punkte}</span></li>`).join("");
    const mehr = T && T.nr + 1 < T.plan.length;
    return `<header class="titel"><p class="etikett">Auftrag ${T ? T.nr + 1 : 1} von ${T ? T.plan.length : 1}</p><h1>${esc(R.ARTEN[e.modus].name)}</h1></header>
      <div class="karte-box"><ol class="liste ergebnis">${zeilen}</ol></div>
      ${T && T.plan.length > 1 ? `<div class="karte-box"><h2>Stand des Umzugstags</h2><ol class="liste">${stand}</ol></div>` : ""}
      ${mehr ? `<p class="leise mitte">Als Nächstes: <b>${esc(R.ARTEN[T.plan[T.nr + 1]].name)}</b> <span class="uhr" data-bis="${S.weiterAb}"></span></p>` : `<p class="leise mitte">Gleich kommt die Siegerehrung <span class="uhr" data-bis="${S.weiterAb}"></span></p>`}
      ${host ? `<button class="knopf" id="weiter">${mehr ? "Weiter" : "Zur Siegerehrung"}</button><button class="link" id="zurLobby">Zurück in die Lobby</button>` : ""}`;
  }
  function bildschirmEnde() {
    const E = S.ehrung || { stand: [], titel: [] }, host = rolle === "host";
    const podest = [2, 1, 3].map(pl => { const w = E.stand.filter(x => x.platz === pl); return `<div class="stufe s${pl}">${w.map(x => `<div class="sieger">${marke(x.pid)}<b>${esc(sp(x.pid).name)}</b><small>${x.punkte} Punkte</small></div>`).join("")}<div class="block">${w.length ? pl : ""}</div></div>`; }).join("");
    const rest = E.stand.filter(x => x.platz > 3).map(x => `<li><span class="platz">${x.platz}.</span>${marke(x.pid)}<span class="nm">${esc(sp(x.pid).name)}</span><span class="punkte">${x.punkte}</span></li>`).join("");
    const titel = E.titel.map(t => `<li><b>${esc(t.name)}</b><span>${t.wer.map(p => esc(sp(p).name)).join(", ")}</span><small>${esc(t.text)}</small></li>`).join("");
    const erster = E.stand.filter(x => x.platz === 1).map(x => esc(sp(x.pid).name)).join(" und ");
    return `<header class="titel"><p class="etikett">Feierabend</p><h1>Umzugsprofi des Tages</h1><p class="gross">${erster}</p></header>
      <div class="podest">${podest}</div>${rest ? `<ol class="liste">${rest}</ol>` : ""}
      ${titel ? `<div class="karte-box"><h2>Ehrentitel</h2><ul class="titelliste">${titel}</ul></div>` : ""}
      <div class="konfetti" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 7) * 0.25}s;--f:${FARBEN()[i % 8]}"></i>`).join("")}</div>
      ${host ? `<button class="knopf" id="zurLobby">Neuer Umzugstag</button>` : `<p class="leise mitte">Die Spielleitung kann einen neuen Umzugstag starten.</p>`}
      <button class="link" id="verlassen">${offline ? "Zurück" : "Raum verlassen"}</button>`;
  }

  // ---------- Klänge aus dem Zustand ----------
  let vorher = null;
  function klaenge() {
    if (!S) return;
    const jetzt = { phase: S.phase, nr: S.a ? S.a.nr : null, dran: S.a && S.a.wg ? S.a.wg.dran + S.a.wg.zugBis : null, karten: S.a && S.a.karten[PID] ? S.a.karten[PID].length : 0 };
    const v = vorher; vorher = jetzt;
    if (!v) return;
    if (jetzt.phase === "ende" && v.phase !== "ende") { K.spiel("sieg"); brumm([80, 60, 80, 60, 200]); }
    if (jetzt.phase === "auftrag" && (v.phase !== "auftrag" || v.nr !== jetzt.nr)) brumm(120);
    if (jetzt.dran && jetzt.dran !== v.dran && S.a.wg.dran === PID) { K.spiel("karte"); brumm([70, 60, 140]); }
  }

  function render() {
    klaenge();
    turmVorbereiten();
    const st = statusZeile(), ueb = rolle === "client" && S && offlineSeit && Date.now() - offlineSeit > 20000;
    const statusHtml = `<div class="status" ${st ? "" : "hidden"}><span>${esc(st)}</span>${ueb ? `<button class="klein" id="uebernehmen">Spielleitung übernehmen</button>` : ""}</div>`;
    document.body.classList.toggle("im-auftrag", !!(S && S.phase === "auftrag" && S.a && rolle && rolle !== "pruefen"));
    if (S && S.phase === "auftrag" && S.a && rolle && rolle !== "pruefen") {
      const el = app.querySelector(".auftrag");
      if (!el || +el.dataset.nr !== S.a.nr || el.dataset.modus !== S.a.modus) {
        app.innerHTML = statusHtml + bildschirmAuftrag() + (hinweis ? `<div class="toast" role="status">${esc(hinweis)}</div>` : "");
        letztesHtml = "";
        if (steuer) steuer.weg();
        steuer = SP.steuerung(document.getElementById("buehne"), { schieben: r => ziel().schieben(r), drehen: () => ziel().drehen(), fallen: () => ziel().fallen(), schnell: an => ziel().schnell(an), proFeld: () => ziel().proFeld() });
        miniKey = ""; document.getElementById("fuss").dataset.key = "";
        binden();
      } else {
        const s = app.querySelector(".status"); if (s && s.outerHTML !== statusHtml) { s.outerHTML = statusHtml; binden(); }
        const alt = app.querySelector(".toast"); if (alt && !hinweis) alt.remove();
        if (hinweis && !alt) app.insertAdjacentHTML("beforeend", `<div class="toast" role="status">${esc(hinweis)}</div>`);
      }
      auftragAktualisieren();
      return;
    }
    if (steuer) { steuer.weg(); steuer = null; }
    let h = statusHtml;
    if (!rolle) h += code ? bildschirmName() : bildschirmStart();
    else if (rolle === "pruefen" || !S) h += `<div class="mitte"><p class="leise">${window.ABEND ? ABEND.warten() : "Verbinde …"}</p></div>`;
    else if (S.phase === "ergebnis" && S.erg) h += bildschirmErgebnis();
    else if (S.phase === "ende") h += bildschirmEnde();
    else h += bildschirmLobby();
    if (hinweis) h += `<div class="toast" role="status">${esc(hinweis)}</div>`;
    if (h === letztesHtml) return;
    letztesHtml = h;
    app.innerHTML = h;
    binden();
    zeitenAnzeigen();
  }
  setInterval(() => { if (rolle === "client" && offlineSeit) render(); }, 5000);
  function zeitenAnzeigen() {
    const jetzt = hostJetzt();
    document.querySelectorAll("[data-bis]").forEach(el => { const r = Math.max(0, Math.ceil((+el.dataset.bis - jetzt) / 1000)); const t = r + " s"; if (el.textContent !== t) el.textContent = t; });
  }
  setInterval(zeitenAnzeigen, 250);

  function binden() {
    const $ = id => document.getElementById(id);
    const nameAus = () => { const el = $("name"); if (el) { name = el.value.trim().slice(0, 20); ls.set("slf:name", name); if (window.ABEND && ABEND.nameGeaendert) try { ABEND.nameGeaendert(name); } catch (e) {} } };
    if ($("name")) $("name").onchange = nameAus;
    if ($("neu")) $("neu").onclick = () => { nameAus(); if (!name) return zeigeHinweis("Bitte gib deinen Namen ein."); neuesSpiel(0); };
    if ($("allein")) $("allein").onclick = () => { nameAus(); neuesSpiel(0, true); };
    if ($("beitreten")) $("beitreten").onclick = () => {
      nameAus(); const c = ($("code").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!name) return zeigeHinweis("Bitte gib deinen Namen ein."); if (c.length < 4) return zeigeHinweis("Bitte den Raumcode eingeben.");
      code = c; history.replaceState(null, "", "?raum=" + code + testTeil()); clientStarten();
    };
    if ($("mitspielen")) $("mitspielen").onclick = () => { nameAus(); if (!name) return zeigeHinweis("Bitte gib deinen Namen ein."); clientStarten(); };
    if ($("uebernehmen")) $("uebernehmen").onclick = uebernehmen;
    if ($("verlassen")) $("verlassen").onclick = verlassen;
    if ($("teilen")) $("teilen").onclick = async () => { try { if (navigator.share) await navigator.share({ title: "Sperrgut", url: link() }); else { await navigator.clipboard.writeText(link()); zeigeHinweis("Link kopiert."); } } catch (e) {} };
    if ($("botDazu")) $("botDazu").onclick = () => tun({ t: "bot", dazu: true });
    if ($("botWeg")) $("botWeg").onclick = () => tun({ t: "bot", dazu: false });
    if ($("start")) $("start").onclick = () => { if (!planckDa()) return; tun({ t: "start" }); };
    if ($("weiter")) $("weiter").onclick = () => tun({ t: "weiter" });
    if ($("zurLobby")) $("zurLobby").onclick = () => tun({ t: "lobby" });
    if ($("knoepfeAn")) $("knoepfeAn").onchange = e => { knoepfe = e.target.checked; ls.set("sg:knoepfe", knoepfe); };
    document.querySelectorAll("[data-farbe]").forEach(b => b.onclick = () => tun({ t: "farbe", farbe: +b.dataset.farbe }));
    document.querySelectorAll("[data-laenge]").forEach(b => b.onclick = () => tun({ t: "einst", laenge: b.dataset.laenge }));
    document.querySelectorAll("[data-art]").forEach(b => b.onclick = () => tun({ t: "einst", art: b.dataset.art }));
    document.querySelectorAll("[data-einzeln]").forEach(b => b.onclick = () => { if (!planckDa()) return; tun({ t: "einzeln", modus: b.dataset.einzeln }); });
  }
  function planckDa() { if (window.planck) return true; zeigeHinweis("Die Physik-Bibliothek konnte nicht geladen werden. Bitte Internet prüfen und neu laden."); return false; }

  // Ton-Knopf oben rechts
  const tonKnopf = document.createElement("button");
  tonKnopf.className = "tonknopf"; tonKnopf.type = "button";
  const tonText = () => { tonKnopf.textContent = K.an ? "🔊" : "🔇"; tonKnopf.setAttribute("aria-label", K.an ? "Ton aus" : "Ton an"); };
  tonKnopf.onclick = () => { K.umschalten(); tonText(); };
  tonText(); document.body.appendChild(tonKnopf);

  // ---------- Start ----------
  if (typeof Peer === "undefined" && !params.has("allein")) { app.innerHTML = `<div class="mitte"><p>Die Verbindungsbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.</p></div>`; return; }
  if (params.has("allein")) {
    // Übungsmodus ohne Netz: ?allein startet gleich „Hoch hinaus“, ?allein=lobby zeigt die Übungs-Lobby, &bots=2 mit Bots
    if (!name) name = "Ich";
    neuesSpiel(Math.min(7, +params.get("bots") || 0), true);
    const art = params.get("auftrag") || (params.get("allein") === "lobby" ? null : "hoch");
    if (art && R.ARTEN[art] && window.planck) { tun({ t: "einzeln", modus: art }); }
  } else if (code) {
    const gespeichert = ls.get("sg:host:" + code);
    if (gespeichert) fortsetzenAlsHost(gespeichert);
    else if (name) clientStarten();
    else render();
  } else if (params.get("bots")) {
    if (!name) name = "Testperson";
    neuesSpiel(Math.min(7, +params.get("bots")));
    const art = params.get("auftrag");
    if (art && R.ARTEN[art]) tun({ t: "einzeln", modus: art });
  } else render();
  window.__sg = { get S() { return S; }, get rolle() { return rolle; }, get turm() { return turm; }, get wg() { return wg; }, PID, tun: params.get("test") || params.has("allein") ? tun : undefined };
})();
