// Gleisgenossen: Startseite, Lobby, Verbindung (Handy des Spielleiters rechnet, PeerJS), Bedienleiste über der 3D-Welt.
// Allein: ohne Raum, alles auf diesem Handy. Die Regeln stehen in logic.js (window.GG), die Welt in welt.js.
import { Welt } from "./welt.js?v=2026-11-16f";

const G = window.GG;
const app = document.getElementById("app"), weltEl = document.getElementById("welt"), hud = document.getElementById("hud");
const params = new URLSearchParams(location.search);
const T = params.get("test") ? "-" + params.get("test") : "";
const SPEICHER = "gg2:stand" + T;
const PREFIX = "fmwgg2-", ZEICHEN = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
const PEER_OPT = window.SPIELEABEND_PEER ? window.SPIELEABEND_PEER() : { debug: 0 };   // TURN-Server siehe ../netz.js
const TAKT = 300;                 // ms zwischen zwei Zug-Abgleichen vom Spielleiter
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const ss = {      // Sitzung: übersteht Neuladen im selben Tab, nicht das Schließen
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
};
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const zahl = n => Math.floor(n).toLocaleString("de-DE");
const dauer = s => { s = Math.floor(s); const h = s / 3600 | 0, m = (s % 3600) / 60 | 0; return h ? `${h} Std. ${m} Min.` : `${m} Min.`; };
const strecke = m => m < 1000 ? Math.floor(m) + " m" : (m / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " km";
const vor = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "gerade eben" : m < 60 ? `vor ${m} Min.` : new Date(t).toLocaleString("de-DE", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }); };

let PID = ls.get("gg2:pid" + T); if (!PID) { PID = Math.random().toString(36).slice(2, 10); ls.set("gg2:pid" + T, PID); }
let name = ls.get("gg2:name" + T) || "";
let code = (params.get("raum") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// rolle: null (Startseite), "allein", "host", "client"
let rolle = null, S = null, lobby = null, welt = null, gespeichertUm = null, hinweisTimer = null, proMinute = 0;
let peer = null, hostConn = null, verbunden = false, fehlerText = "", retryTimer = null, token = 0;
let versuch = 0, offlineSeit = null, uebernahme = false, pruefTimer = null;
// Verbindungs-ID des Spielleiters: Raumcode + Leitungsnummer (epoch). Übernimmt jemand, zählt sie eins hoch.
const epoch = () => (S && S.epoch) || 0;
const hostId = ep => PREFIX + code + "-" + ep;
const UEBERNEHMEN_NACH = 8000;     // ms ohne Spielleiter, bis „Leitung übernehmen“ erscheint
const conns = new Map();          // pid → Verbindung (nur Spielleiter)
const verlauf = [];               // [zeit, verdient] der letzten Minute für „pro Minute“
const ui = { modus: "schauen", teil: "g", bau: "turm", panel: null };
let letzteSim = performance.now();

let wake = null;
async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { if (S) wachHalten(); if (rolle === "client" && !hostConn) verbindeZumHost(); } });

const meine = () => S && G.gruppeVon(S, PID);
const gruppe = () => S && meine() && S.gruppen[meine()];
const meinZug = () => S && S.zuege[PID];
const online = p => rolle === "allein" || p === PID || (S && (S.online || []).includes(p));
const link = () => location.origin + location.pathname + "?raum=" + code + (params.get("test") ? "&test=" + params.get("test") : "");

// ---------- Bilder ----------
const TITELBILD = `<svg class="titelbild" viewBox="0 0 320 150" role="img" aria-label="Ein kleiner Dampfzug fährt auf einem Gleiskreis durch eine grüne Landschaft">
<rect x="2" y="2" width="316" height="146" rx="20" fill="#BFE3F2"/>
<g stroke="#1C1A33" stroke-width="2" stroke-linejoin="round">
<path d="M2 92 L60 74 L120 88 L190 70 L250 86 L318 72 V128 a20 20 0 0 1-20 20 H22 a20 20 0 0 1-20-20z" fill="#9BD45A"/>
<path d="M240 74 l20-34 l20 34z" fill="#8E8B84"/><path d="M253 52 l7-12 l7 12 l-7 4z" fill="#F7F7FA"/>
<path d="M272 78 l22-38 l22 38z" fill="#9C9C8E"/><path d="M286 54 l8-14 l8 14 l-8 4z" fill="#F7F7FA"/>
<path d="M22 84 l8-18 l8 18z M36 88 l7-15 l7 15z" fill="#2F8A4A"/>
</g>
<ellipse cx="160" cy="112" rx="112" ry="26" fill="none" stroke="#B9A68A" stroke-width="14"/>
<ellipse cx="160" cy="112" rx="112" ry="26" fill="none" stroke="#6B4A32" stroke-width="10" stroke-dasharray="2 5"/>
<ellipse cx="160" cy="112" rx="112" ry="26" fill="none" stroke="#8C8F99" stroke-width="2"/>
<g stroke="#1C1A33" stroke-width="2.2" stroke-linejoin="round">
<rect x="86" y="114" width="34" height="18" rx="3" fill="#2F6FDE"/><rect x="86" y="120" width="34" height="5" fill="#F3F0FF"/>
<rect x="124" y="108" width="40" height="18" rx="9" fill="#E2453A"/><rect x="154" y="96" width="22" height="30" rx="3" fill="#E2453A"/>
<rect x="150" y="92" width="30" height="6" rx="2" fill="#1C1A33"/><rect x="130" y="94" width="8" height="15" fill="#1C1A33"/>
<rect x="158" y="102" width="12" height="8" rx="1" fill="#BFE3F2"/>
<circle cx="136" cy="129" r="6" fill="#1C1A33"/><circle cx="152" cy="129" r="6" fill="#1C1A33"/><circle cx="168" cy="129" r="6" fill="#1C1A33"/>
<circle cx="94" cy="133" r="4" fill="#1C1A33"/><circle cx="112" cy="133" r="4" fill="#1C1A33"/>
</g>
<g fill="#FFFFFF" stroke="#1C1A33" stroke-width="2" opacity=".95"><circle cx="134" cy="84" r="8"/><circle cx="122" cy="70" r="10"/><circle cx="104" cy="56" r="12"/></g>
<g stroke="#1C1A33" stroke-width="2"><circle cx="214" cy="40" r="11" fill="#FFD447"/><circle cx="236" cy="22" r="8" fill="#FFD447"/><circle cx="196" cy="20" r="7" fill="#FFD447"/></g>
<text x="214" y="45" text-anchor="middle" font-family="Unbounded,system-ui,sans-serif" font-weight="800" font-size="12" fill="#1C1A33">T</text>
</svg>`;
const SCHIENE = `stroke="#C8CBD6" stroke-width="1.6" fill="none"`;
const TEIL_BILD = {
  g: `<svg viewBox="0 0 34 34"><rect x="11" y="1" width="12" height="32" fill="#B9A68A"/><g fill="#6B4A32">${[4, 10, 16, 22, 28].map(y => `<rect x="9" y="${y}" width="16" height="2.5"/>`).join("")}</g><path d="M14 1v32M20 1v32" ${SCHIENE}/></svg>`,
  k: `<svg viewBox="0 0 34 34"><path d="M17 33 A16 16 0 0 1 33 17" fill="none" stroke="#B9A68A" stroke-width="12"/><path d="M14 33 A19 19 0 0 1 33 14 M20 33 A13 13 0 0 1 33 20" ${SCHIENE}/></svg>`,
  s: `<svg viewBox="0 0 34 34"><rect x="11" y="1" width="12" height="32" fill="#B9A68A"/><path d="M17 33 A16 16 0 0 1 33 17" fill="none" stroke="#B9A68A" stroke-width="12"/><path d="M14 1v32M20 1v32" ${SCHIENE}/><path d="M14 33 A19 19 0 0 1 33 14 M20 33 A13 13 0 0 1 33 20" ${SCHIENE}/><circle cx="6" cy="28" r="3.5" fill="#5BD69A"/></svg>`,
  x: `<svg viewBox="0 0 34 34"><rect x="11" y="1" width="12" height="32" fill="#B9A68A"/><rect x="1" y="11" width="32" height="12" fill="#B9A68A"/><path d="M14 1v32M20 1v32M1 14h32M1 20h32" ${SCHIENE}/></svg>`,
  b: `<svg viewBox="0 0 34 34"><rect x="6" y="1" width="11" height="32" fill="#B9A68A"/><path d="M9 1v32M14 1v32" ${SCHIENE}/><rect x="20" y="4" width="9" height="26" rx="1" fill="#D8CFC0"/><rect x="19" y="10" width="12" height="14" rx="2" fill="#C9553D"/></svg>`
};
const BAU_BILD = { turm: "💧", muehle: "🌾", burg: "🏰", rad: "🎡" };

// ---------- Startseite ----------
function startseite() {
  rolle = null; S = null; lobby = null;
  document.documentElement.classList.remove("spiel"); document.body.classList.remove("spiel");
  weltEl.hidden = true; hud.hidden = true; app.hidden = false;
  const g = ls.get(SPEICHER), mehrere = g && g.S.spieler && Object.keys(g.S.spieler).length > 1;
  app.innerHTML = `<header class="titel">${TITELBILD}<h1>Gleisgenossen</h1>
      <p class="leise">Ein kleiner Zug fährt im Kreis, und jeder Meter bringt Geld. Kauft Gleise und Land, verbessert den Zug und baut eure Strecke in einer großen Landschaft aus. Zusammen startet jeder mit einer eigenen Bahn, später könnt ihr euch zu einer Genossenschaft zusammentun.</p></header>
    <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
    ${g ? `<div class="karte-box"><h2>Weiterspielen</h2>
      <p class="stand">Gespeichert ${esc(vor(g.um))} · ${mehrere ? Object.keys(g.S.spieler).length + " Bahnen" : "allein"} · Spielzeit ${dauer(g.S.zeit || 0)}</p>
      <button class="knopf" id="weiter">${mehrere ? "Raum öffnen und weiterspielen" : "Weiterspielen"}</button></div>` : ""}
    <div class="karte-box"><h2>Zusammen spielen</h2>
      <p class="leise klein">Du öffnest einen Raum, die anderen kommen per Code, Link oder QR-Code dazu. Jeder bekommt einen eigenen Startbereich mit Zug und Kasse.</p>
      <button class="knopf" id="raum">Raum erstellen</button>
      <label class="feld">Raumcode<input id="code" maxlength="4" autocapitalize="characters" placeholder="z. B. K7M2"></label>
      <button class="knopf zweit" id="beitreten">Beitreten</button></div>
    <div class="karte-box"><h2>Allein spielen</h2>
      <p class="leise klein">Ohne Raum, nur auf diesem Handy. Speichert über das Menü, um später weiterzuspielen. Wer ohne Speichern schließt, verwirft den Spielstand.</p>
      <button class="knopf zweit" id="allein">Neue Welt allein</button></div>
    <a class="link" href="../">Alle Spiele</a>`;
  const nameLesen = () => { name = document.getElementById("name").value.trim().slice(0, 20); ls.set("gg2:name" + T, name); return name; };
  if (g) document.getElementById("weiter").onclick = () => { nameLesen(); const s = G.auffrischen(g.S, PID); mehrere ? raumOeffnen(s, g.um) : alleinSpielen(s, g.um); };
  document.getElementById("allein").onclick = () => { nameLesen(); alleinSpielen(G.neu(null, [{ pid: PID, name }]), null); };
  document.getElementById("raum").onclick = () => { if (!nameLesen()) return hinweis("Bitte gib zuerst deinen Namen ein."); raumOeffnen(null, null); };
  document.getElementById("beitreten").onclick = () => {
    if (!nameLesen()) return hinweis("Bitte gib zuerst deinen Namen ein.");
    code = document.getElementById("code").value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 4) return hinweis("Der Raumcode hat 4 Zeichen.");
    history.replaceState(null, "", "?raum=" + code + (params.get("test") ? "&test=" + params.get("test") : ""));
    clientStarten();
  };
}
function einladungSeite() {
  app.innerHTML = `<header class="titel">${TITELBILD}<h1>Gleisgenossen</h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
    <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
    <button class="knopf" id="mitspielen">Mitspielen</button><a class="link" href="./">Eigenes Spiel starten</a>`;
  document.getElementById("mitspielen").onclick = () => {
    name = document.getElementById("name").value.trim().slice(0, 20); ls.set("gg2:name" + T, name);
    if (!name) return hinweis("Bitte gib zuerst deinen Namen ein.");
    clientStarten();
  };
}

// ---------- Allein ----------
function alleinSpielen(stand, um) {
  rolle = "allein"; gespeichertUm = um;
  if (stand.spieler[PID] && name) stand.spieler[PID].name = name;
  spielZeigen(stand);
}

// ---------- Spielleiter ----------
function raumOeffnen(stand, um) {
  rolle = "host"; gespeichertUm = um;
  code = (stand && stand.code) || code || Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
  history.replaceState(null, "", "?raum=" + code + (params.get("test") ? "&test=" + params.get("test") : ""));
  if (stand) { stand.code = code; if (stand.spieler[PID] && name) stand.spieler[PID].name = name; S = stand; lobby = null; }
  else { S = null; lobby = { spieler: [{ pid: PID, name }] }; }
  oeffneHostPeer();
  if (S) spielZeigen(S); else lobbyZeigen();
  sitzungSichern();
}
function sitzungSichern() { if (rolle === "host") ss.set("gg2:sitzung:" + code + T, { S, lobby, um: gespeichertUm }); }
function oeffneHostPeer() {
  if (peer) { try { peer.destroy(); } catch (e) {} }
  verbunden = false;
  const p = peer = new Peer(hostId(epoch()), PEER_OPT);
  if (T) { console.log("öffne Raum", hostId(epoch())); p.on("open", id => console.log("Raum offen", id)); p.on("error", e => console.log("Raumfehler", e.type)); p.on("disconnected", () => console.log("Raum getrennt")); }
  p.on("open", () => { if (p !== peer) return; verbunden = true; fehlerText = ""; if (uebernahme) { uebernahme = false; hinweis("Du leitest jetzt das Spiel."); } neuZeichnen(); });
  p.on("connection", c => {
    c.on("data", m => vonClient(c, m));
    c.on("close", () => { for (const [k, x] of conns) if (x === c) conns.delete(k); onlineMelden(); });
    c.on("error", () => {});
  });
  p.on("disconnected", () => { if (p !== peer) return; verbunden = false; setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} }, 2000); });
  p.on("error", e => {
    if (p !== peer) return;
    verbunden = false;
    if (e.type === "unavailable-id" && uebernahme) {      // jemand anderes hat gerade übernommen: wieder mitspielen
      uebernahme = false; rolle = "client"; conns.clear(); ss.del("gg2:sitzung:" + code + T);
      try { p.destroy(); } catch (x) {}
      hinweis("Jemand anderes hat die Leitung schon übernommen.");
      return clientNeuVerbinden();
    }
    fehlerText = e.type === "unavailable-id" ? "Der Raum ist noch belegt, gleich geht es weiter …" : "Keine Verbindung zum Vermittlungsdienst, neuer Versuch …";
    neuZeichnen();
    if (["unavailable-id", "network", "server-error", "socket-error", "socket-closed"].includes(e.type)) setTimeout(() => { if (p === peer) oeffneHostPeer(); }, 3000);
  });
}
const senden = (c, m) => { try { if (c && c.open) c.send(m); } catch (e) {} };
const anAlle = m => { for (const [, c] of conns) senden(c, m); };
// Ganzer Stand an alle. Die Karte (Gelände und Höhen, bis 25 KB) geht nur, wenn sie sich geändert hat,
// und in Stücken, weil zu große Nachrichten unterwegs verloren gehen.
const STUECK = 9000;
function standAnAlle() {
  const kt = JSON.stringify(S.karte); let kh = kt.length;
  for (let i = 0; i < kt.length; i++) kh = (kh * 31 + kt.charCodeAt(i)) | 0;
  const m = { t: "stand", s: Object.assign({}, S, { karte: null }), kh };
  for (const [, c] of conns) {
    if (c.karteH !== kh) {
      const n = Math.ceil(kt.length / STUECK);
      for (let k = 0; k < n; k++) senden(c, { t: "karte", kh, k, n, d: kt.slice(k * STUECK, (k + 1) * STUECK) });
      c.karteH = kh;
    }
    senden(c, m);
  }
}
function vonClient(c, m) {
  if (!m || !m.pid) return;
  if (m.t === "hallo") {
    conns.set(m.pid, c);
    if (lobby) {
      if (!lobby.spieler.some(s => s.pid === m.pid)) {
        if (lobby.spieler.length >= G.MAX_SPIELER) senden(c, { t: "fehler", text: "Der Raum ist voll (höchstens " + G.MAX_SPIELER + " Bahnen)." });
        else lobby.spieler.push({ pid: m.pid, name: m.name || "Gast" });
      } else lobby.spieler.find(s => s.pid === m.pid).name = m.name || "Gast";
    } else if (S && S.spieler[m.pid] && m.name) S.spieler[m.pid].name = m.name;
    onlineMelden();
    return;
  }
  if (!S) return;
  if (m.t === "platz") {
    if (S.spieler[m.pid] || !S.spieler[m.alt] || online(m.alt)) return senden(c, { t: "fehler", text: "Dieser Platz ist nicht mehr frei." });
    G.platzUebernehmen(S, m.alt, m.pid, m.name);
    return geaendert();
  }
  if (m.t === "aktion") {
    const r = G.aktion(S, m.pid, m.m);
    if (r.fehler) return senden(c, { t: "fehler", text: r.fehler });
    senden(c, { t: "ok", typ: m.m.typ, r });
    geaendert();
  }
}
function onlineMelden() {
  const liste = [PID].concat([...conns.keys()]);
  if (S) { S.online = liste; geaendert(); }
  else { lobby.online = liste; anAlle({ t: "lobby", lobby, code }); sitzungSichern(); neuZeichnen(); }
}
// Ganzen Stand an alle (nach Aktionen, Zielen, Einladungen)
function geaendert() {
  if (rolle !== "host" || !S) return;
  S.online = [PID].concat([...conns.keys()]);
  standAnAlle();
  sitzungSichern();
  welt.setzen(S, PID); render();
}
function spielStarten() {
  S = G.neu(null, lobby.spieler.map(s => ({ pid: s.pid, name: s.name })));
  S.code = code; lobby = null;
  spielZeigen(S);
  geaendert();
}
// Zug-Abgleich: Spielleiter schickt regelmäßig Züge und Kassen
setInterval(() => {
  if (rolle !== "host" || !S || !conns.size) return;
  const g = {}; for (const k in S.gruppen) g[k] = S.gruppen[k];
  anAlle({ t: "takt", z: S.zuege, g, zeit: S.zeit });
}, TAKT);
setInterval(() => sitzungSichern(), 5000);

// ---------- Mitspieler ----------
function clientStarten() {
  rolle = "client"; S = null; lobby = null;
  clientNeuVerbinden();
}
// Neue Peer-Verbindung als Mitspieler; der bisherige Spielstand (S) bleibt als Kopie für eine Übernahme erhalten
function clientNeuVerbinden() {
  rolle = "client"; hostConn = null; verbunden = false;
  if (peer) { try { peer.destroy(); } catch (e) {} }
  const p = peer = new Peer(undefined, PEER_OPT);
  p.on("open", () => { if (p === peer && !hostConn) verbindeZumHost(); });
  p.on("disconnected", () => { if (p !== peer) return; setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} }, 2000); });
  p.on("error", e => {
    if (p !== peer) return;
    if (e.type === "peer-unavailable") fehlschlag(token);
    else if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) verloren();
  });
  neuZeichnen();
}
function verbindeZumHost() {
  if (!peer || peer.destroyed || !peer.open || (hostConn && hostConn.open)) return;
  clearTimeout(retryTimer);
  const t = ++token, c = peer.connect(hostId(epoch() + (versuch % 2)), { serialization: "json", reliable: true });   // abwechselnd alte und nächste Leitung
  if (T) console.log("verbinde", hostId(epoch() + (versuch % 2)), "token", t);
  c.on("open", () => {
    if (t !== token) { try { c.close(); } catch (e) {} return; }
    hostConn = c; verbunden = true; fehlerText = ""; versuch = 0; offlineSeit = null;
    c.send({ t: "hallo", pid: PID, name }); neuZeichnen();
  });
  c.on("data", vomHost);
  c.on("close", () => { if (hostConn === c) { hostConn = null; verloren(); } });
  c.on("error", () => {});
  retryTimer = setTimeout(() => { if (t === token && hostConn !== c) { try { c.close(); } catch (e) {} fehlschlag(t); } }, window.SPIELEABEND_WARTEN || 12000);
}
function fehlschlag(t) {
  if (T) console.log("fehlschlag", t, token);
  if (t !== token) return;
  token++; versuch++; verbunden = false;
  if (!offlineSeit) { offlineSeit = Date.now(); setTimeout(neuZeichnen, UEBERNEHMEN_NACH + 100); }
  fehlerText = "Spielleiter nicht erreichbar, neuer Versuch …"; neuZeichnen();
  clearTimeout(retryTimer); retryTimer = setTimeout(verbindeZumHost, 2500);
}
function verloren() { verbunden = false; hostConn = null; if (!offlineSeit) { offlineSeit = Date.now(); setTimeout(neuZeichnen, UEBERNEHMEN_NACH + 100); } fehlerText = "Spielleiter nicht erreichbar, neuer Versuch …"; neuZeichnen(); fehlschlag(token); }
let karteEmpfang = null, karteDa = null;
function vomHost(m) {
  if (!m) return;
  if (T && m.t !== "takt") console.log("vom Host", m.t);
  if (m.t === "lobby") { lobby = m.lobby; S = null; neuZeichnen(); }
  else if (m.t === "karte") {
    if (!karteEmpfang || karteEmpfang.kh !== m.kh) karteEmpfang = { kh: m.kh, teile: [] };
    karteEmpfang.teile[m.k] = m.d;
    if (karteEmpfang.teile.filter(x => x != null).length === m.n) { karteDa = { kh: m.kh, k: JSON.parse(karteEmpfang.teile.join("")) }; karteEmpfang = null; }
  } else if (m.t === "stand") {
    if (!m.s.karte) {
      if (karteDa && karteDa.kh === m.kh) m.s.karte = karteDa.k;
      else if (S && S.karte) m.s.karte = S.karte;
      else return;
    }
    const vorher = S;
    S = G.auffrischen(m.s, PID); lobby = null;
    if (!vorher || hud.hidden) { if (S.spieler[PID]) spielZeigen(S); else platzWahl(); return; }
    if (!S.spieler[PID]) return platzWahl();
    meldungenVergleichen(vorher, S);
    welt.setzen(S, PID); render();
  } else if (m.t === "takt" && S) {
    const vorher = { gruppen: G.kopie(S.gruppen) };
    for (const p in m.z) { const z = m.z[p]; S.zuege[p] = z; }
    for (const k in m.g) S.gruppen[k] = m.g[k];
    meldungenVergleichen(vorher, S);
    if (Object.keys(m.z).some(p => welt && welt.zuege[p] && welt.zuege[p].teile.length !== 2 + m.z[p].stufen.wagen)) welt.setzen(S, PID);
  } else if (m.t === "fehler") hinweis(m.text);
  else if (m.t === "weg") { offlineSeit = Date.now() - UEBERNEHMEN_NACH; hinweis("Der Spielleiter hat das Spiel verlassen. Jemand kann die Leitung übernehmen."); }
  else if (m.t === "ok" && m.typ === "weiche") hinweis(m.r.st ? "Weiche: abbiegen" : "Weiche: geradeaus");
}
// Neue Ziele und Einladungen beim Mitspieler anzeigen (der Spielleiter sieht sie direkt)
function meldungenVergleichen(alt, neu) {
  const gid = G.gruppeVon(neu, PID), a = alt.gruppen && alt.gruppen[gid], n = neu.gruppen[gid];
  if (a && n) {
    const neuZ = G.ZIELE.filter(z => n.ziele[z.id] && !a.ziele[z.id]);
    if (neuZ.length) zielMeldung(neuZ);
  }
  if (alt.einladungen) {
    const ein = (neu.einladungen || []).filter(e => e.an === gid && !alt.einladungen.some(x => x.von === e.von && x.an === e.an));
    ein.forEach(e => hinweis(`${neu.gruppen[e.von] ? neu.gruppen[e.von].name : "Eine Bahn"} möchte sich mit euch zusammentun. Antippen: 👥`));
  }
  if (alt.gruppen && gid && alt.gruppen[gid] && alt.gruppen[gid].mitglieder.length !== n.mitglieder.length) hinweis(`Ihr seid jetzt die ${n.name}.`);
}
function platzWahl() {
  hud.hidden = true; weltEl.hidden = true; app.hidden = false;
  document.documentElement.classList.remove("spiel"); document.body.classList.remove("spiel");
  const frei = Object.keys(S.spieler).filter(p => !(S.online || []).includes(p));
  app.innerHTML = `<header class="titel"><h1>Gleisgenossen</h1><p class="leise">Dieses Spiel läuft schon. Spielst du eine der Bahnen weiter, die gerade niemand steuert?</p></header>
    <div class="karte-box">${frei.length ? frei.map(p => `<button class="knopf zweit" data-platz="${p}">Als ${esc(S.spieler[p].name)} (${esc(S.gruppen[S.spieler[p].gruppe].name)})</button>`).join("") : `<p class="leise">Gerade ist keine Bahn frei.</p>`}
    <button class="knopf zweit" id="zuschauen">Nur zuschauen</button></div>`;
  app.querySelectorAll("[data-platz]").forEach(b => b.onclick = () => senden(hostConn, { t: "platz", pid: PID, alt: b.dataset.platz, name }));
  document.getElementById("zuschauen").onclick = () => spielZeigen(S);
}

// ---------- Leitung übernehmen ----------
// Ein Mitspieler macht mit seiner Kopie des Spielstands als Spielleiter unter der nächsten Leitungsnummer weiter.
function uebernehmen() {
  if (!S || rolle !== "client") return;
  if (!confirm("Leitung übernehmen? Dein Handy rechnet dann für alle und speichert. Nur tun, wenn der Spielleiter wirklich weg ist.")) return;
  S.epoch = epoch() + 1; uebernahme = true;
  clearTimeout(retryTimer); token++;
  if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
  rolle = "host"; offlineSeit = null; fehlerText = ""; gespeichertUm = null;
  oeffneHostPeer(); sitzungSichern(); render();
}
// Spielleiter ohne Mitspieler schaut regelmäßig, ob inzwischen jemand anderes übernommen hat (z. B. nach Funkloch)
function leitungPruefen(dann) {
  if (!S) return dann && dann(false);
  const probe = new Peer(undefined, PEER_OPT); let fertig = false;
  const ende = gibt => { if (T && !fertig) console.log("Prüfung", hostId(epoch() + 1), gibt); if (fertig) return; fertig = true; try { probe.destroy(); } catch (e) {} if (dann) dann(gibt); };
  // Gibt es die ID nicht, meldet der Vermittlungsdienst schnell „peer-unavailable“. Kommt diese Meldung nicht, gibt es sie.
  const start = Date.now();
  probe.on("open", () => {
    if (T) console.log("Prüfpeer offen nach", Date.now() - start);
    const c = probe.connect(hostId(epoch() + 1), { serialization: "json" });
    c.on("open", () => ende(true));
    setTimeout(() => ende(true), 5000);
  });
  probe.on("error", e => { if (T) console.log("Prüffehler", e.type); ende(false); });
  setTimeout(() => ende(false), 15000);
}
function alsMitspielerWeiter() {
  hinweis("Inzwischen leitet ein anderes Handy das Spiel. Du spielst als Mitspieler weiter.");
  ss.del("gg2:sitzung:" + code + T); conns.clear();
  S.epoch = epoch() + 1; versuch = 0;
  clientNeuVerbinden();
}
setInterval(() => {
  if (rolle !== "host" || !S || conns.size || pruefTimer) return;
  pruefTimer = true;
  leitungPruefen(gibt => { pruefTimer = false; if (gibt && rolle === "host" && !conns.size) alsMitspielerWeiter(); });
}, 15000);

// ---------- Lobby ----------
function lobbyZeigen() {
  document.documentElement.classList.remove("spiel"); document.body.classList.remove("spiel");
  weltEl.hidden = true; hud.hidden = true; app.hidden = false;
  const host = rolle === "host", l = lobby || { spieler: [] };
  let qr = "";
  try { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) {}
  app.innerHTML = `<header class="titel"><h1>Gleisgenossen</h1><p class="leise">${host ? "Die anderen kommen mit diesem Code dazu." : "Warte, bis der Spielleiter startet."}</p></header>
    ${fehlerText ? `<p class="stand">${esc(fehlerText)}</p>` : ""}
    <div class="karte-box mitte"><p class="etikett">Raumcode</p><div class="code">${esc(code)}</div>${host && qr ? `<div class="qr">${qr}</div>` : ""}
      ${host ? `<button class="knopf zweit klein" id="teilen" style="align-self:center">Link teilen</button>` : ""}</div>
    <div class="karte-box"><h2>Bahnen (${l.spieler.length} von ${G.MAX_SPIELER})</h2>
      <ul class="spieler">${l.spieler.map((s, k) => `<li><span class="farbe" style="background:${G.FARBEN[k % G.FARBEN.length]}"></span>${esc(s.name)}${s.pid === PID ? " <small>(du)</small>" : ""}</li>`).join("")}</ul>
      <p class="leise klein">Jeder startet mit eigenem Land, Gleiskreis, Zug und eigener Kasse. Die Karte wird größer, je mehr mitspielen. Später könnt ihr euch zusammentun.</p></div>
    ${host ? `<button class="knopf" id="los">Spiel starten</button>` : ""}
    <button class="link" id="weg">Verlassen</button>`;
  const on = (id, f) => { const el = document.getElementById(id); if (el) el.onclick = f; };
  on("los", spielStarten);
  on("teilen", async () => { try { if (navigator.share) await navigator.share({ title: "Gleisgenossen", url: link() }); else { await navigator.clipboard.writeText(link()); hinweis("Link kopiert."); } } catch (e) {} });
  on("weg", verlassen);
}
function verlassen() {
  if (rolle === "host" && S && !confirm("Raum schließen? Was seit dem letzten Speichern passiert ist, geht verloren.")) return;
  ss.del("gg2:sitzung:" + code + T);
  try { if (peer) peer.destroy(); } catch (e) {}
  peer = null; hostConn = null; conns.clear();
  location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : "");
}
function neuZeichnen() {
  if (rolle === "client" && !S && !lobby) {
    document.documentElement.classList.remove("spiel"); document.body.classList.remove("spiel");
    weltEl.hidden = true; hud.hidden = true; app.hidden = false;
    app.innerHTML = `<header class="titel"><h1>Gleisgenossen</h1><p class="leise">Verbinde mit Raum <b>${esc(code)}</b> …</p></header>
      ${fehlerText ? `<p class="stand">${esc(fehlerText)}</p>` : ""}<button class="link" id="weg">Abbrechen</button>`;
    document.getElementById("weg").onclick = verlassen;
    return;
  }
  if (lobby && !S) return lobbyZeigen();
  if (S && !hud.hidden) {           // im Spiel nur die Statuszeile auffrischen, damit Knöpfe nicht unter dem Finger verschwinden
    const el = document.getElementById("statuszeile"), neu = statusZeile();
    if (!el) return render();
    if (el.innerHTML !== neu) { el.innerHTML = neu; const b = document.getElementById("uebernehmen"); if (b) b.onclick = uebernehmen; }
  }
}

// ---------- Spiel ----------
function spielZeigen(stand) {
  S = stand; verlauf.length = 0; proMinute = 0;
  Object.assign(ui, { modus: "schauen", teil: "g", bau: "turm", panel: null });
  app.hidden = true; weltEl.hidden = false; hud.hidden = false;
  document.documentElement.classList.add("spiel"); document.body.classList.add("spiel");
  if (!welt) {
    welt = new Welt(weltEl);
    welt.onTap = feldGetippt;
    welt.onFolgenAus = () => render();
    welt.vorBild = () => simulieren();
    setInterval(zahlenAuffrischen, 250);
    setInterval(() => { if (performance.now() - letzteSim > 600) simulieren(); }, 500);   // Hintergrund: weiterrechnen
  }
  welt.groesse();
  welt.setzen(S, PID);
  const sp = S.spieler[PID] || Object.values(S.spieler)[0];
  welt.blick(sp.start.x, sp.start.y, 30);
  welt.markieren(null);
  wachHalten();
  render();
}
// Spielleiter und Allein rechnen verbindlich; Mitspieler rechnen zur Vorschau mit und werden vom Takt berichtigt
function simulieren() {
  const jetzt = performance.now(); let dt = Math.min(5, (jetzt - letzteSim) / 1000); letzteSim = jetzt;
  if (!S || hud.hidden) return;
  while (dt > 0) {
    const d = Math.min(.05, dt); dt -= d;
    G.schritt(S, d).ereignisse.forEach(ereignis);
  }
}

function tun(m) {
  if (rolle === "client") {
    if (!hostConn || !hostConn.open) { hinweis("Keine Verbindung zum Spielleiter."); return { fehler: true }; }
    const vorschau = G.aktion(G.kopie(S), PID, m);       // Fehler gleich zeigen, Ergebnis kommt vom Spielleiter
    if (vorschau.fehler) { hinweis(vorschau.fehler); return vorschau; }
    senden(hostConn, { t: "aktion", pid: PID, m });
    return vorschau;
  }
  const r = G.aktion(S, PID, m);
  if (r.fehler) { hinweis(r.fehler); return r; }
  if (rolle === "host") geaendert(); else { welt.setzen(S, PID); render(); }
  if (m.typ === "weiche") hinweis(r.st ? "Weiche: abbiegen" : "Weiche: geradeaus");
  return r;
}

function feldGetippt(i) {
  if (!S || !meine()) return;
  if (!G.darf(S, PID, i)) {
    if (G.besitzer(S, i)) { const g = S.gruppen[G.besitzer(S, i)]; hinweis(`Hier baut ${g ? g.name : "eine andere Bahn"}.`); welt.markieren(i); return; }
    ui.panel = { art: "land", p: G.parzelle(i) }; welt.markieren(i); render(); return;
  }
  if (ui.modus === "bauen") { welt.markieren(i); tun({ typ: "bauen", i, t: ui.teil }); return; }
  if (ui.modus === "bauten") { welt.markieren(i); tun({ typ: "bauwerk", i, t: ui.bau }); return; }
  if (ui.modus === "abreissen") { welt.markieren(i); tun({ typ: "abreissen", i }); return; }
  ui.panel = { art: "feld", i }; welt.markieren(i);
  if (S.gleise[i] && S.gleise[i].t === "s") tun({ typ: "weiche", i });
  render();
}

function speichern() {
  const alt = ls.get(SPEICHER);
  if (alt && alt.S.seed !== S.seed && !confirm("Es gibt schon einen gespeicherten Spielstand aus einer anderen Welt. Überschreiben?")) return;
  const um = Date.now();
  if (ls.set(SPEICHER, { S, um })) { gespeichertUm = um; sitzungSichern(); hinweis("Gespeichert. Ihr könnt jederzeit weiterspielen."); render(); }
  else hinweis("Speichern hat nicht geklappt (Speicher des Browsers voll oder gesperrt).");
}
function beenden() {
  if (rolle === "client") { if (confirm("Spiel verlassen? Der Spielleiter spielt weiter, du kannst wieder beitreten.")) verlassen(); return; }
  if (!confirm(gespeichertUm ? "Beenden? Was seit dem letzten Speichern passiert ist, geht verloren." : "Beenden? Diese Welt ist nicht gespeichert und geht verloren.")) return;
  ss.del("gg2:sitzung:" + code + T);
  if (rolle === "host") { anAlle({ t: "weg" }); try { peer.destroy(); } catch (e) {} peer = null; conns.clear(); }
  welt.markieren(null);
  history.replaceState(null, "", location.pathname + (params.get("test") ? "?test=" + params.get("test") : ""));
  startseite();
}

// ---------- Bedienleiste ----------
function hinweis(t) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = t; el.hidden = false;
  clearTimeout(hinweisTimer); hinweisTimer = setTimeout(() => { el.hidden = true; }, 3200);
}
function zielMeldung(liste) {
  const l = welt.lokBei(PID);
  if (l) liste.forEach((z, k) => setTimeout(() => welt.schweben(l.x, l.y, `Ziel erreicht: +${zahl(z.geld)} T`, "ziel"), k * 700));
  hinweis(`Ziel erreicht: ${liste[0].text}. +${zahl(liste.reduce((s, z) => s + z.geld, 0))} T`);
}

function render() {
  if (!S || hud.hidden) return;
  welt.bauModus(["bauen", "bauten", "abreissen"].includes(ui.modus) && !(ui.panel && ["zug", "menue", "ziele", "bahnen"].includes(ui.panel.art)));
  const g = gruppe(), z = meinZug(), gid = meine();
  if (!g || !z) {     // Zuschauer
    hud.innerHTML = `<div><div class="hud-oben"><div class="chip gross"><small>Zuschauen</small><b>${Object.keys(S.gruppen).length} Bahnen</b></div>
      <button class="rund" id="bahnen" aria-label="Bahnen">👥</button><button class="rund" id="menue" aria-label="Menü">☰</button></div><div id="statuszeile">${statusZeile()}</div></div>
      <div class="hud-unten">${ui.panel && ui.panel.art === "bahnen" ? bahnenPanel() : ui.panel && ui.panel.art === "menue" ? menuePanel() : ""}</div>`;
    knoepfe(); return;
  }
  const w = G.werte(z), ziel = G.offeneZiele(S, gid)[0], zugOffen = ui.panel && ui.panel.art === "zug";
  const anfragen = S.einladungen.filter(e => e.an === gid).length;
  hud.innerHTML = `
    <div>
      <div class="hud-oben">
        <div class="chip gross"><small>Kasse</small><b id="kasse">${zahl(g.kasse)} T</b></div>
        <div class="chip"><small>pro Minute</small><b id="promin">${zahl(proMinute)} T</b></div>
        <div class="chip"><small>Tempo</small><b id="tempo">${G.kmh(z.v)} km/h</b></div>
        <button class="rund ${welt.folgen ? "an" : ""}" id="folgen" aria-label="Kamera folgt dem Zug" title="Zug folgen">🎥</button>
        ${Object.keys(S.spieler).length > 1 ? `<button class="rund ${anfragen ? "an" : ""}" id="bahnen" aria-label="Bahnen">👥</button>` : ""}
        <button class="rund" id="menue" aria-label="Menü">☰</button>
      </div>
      <div id="statuszeile">${statusZeile()}</div>
      ${ziel ? `<button class="ziel" id="ziele"><span>Ziel</span> ${esc(ziel.text)} <em>+${zahl(ziel.geld)} T</em></button>` : ""}
    </div>
    <div class="hud-unten">
      ${panelHtml(w, z, g)}
      <div class="werkzeuge">
        ${[["schauen", "👆", "Schauen"], ["bauen", "🛤️", "Gleise"], ["bauten", "🏰", "Bauten"], ["abreissen", "⛏️", "Abreißen"], ["zug", "🚂", "Zug"]].map(([m, i, t]) =>
          `<button data-modus="${m}" class="${zugOffen ? (m === "zug" ? "an" : "") : (ui.modus === m && !(ui.panel && ["menue", "land", "ziele", "bahnen"].includes(ui.panel.art)) ? "an" : "")}"><i>${i}</i>${t}</button>`).join("")}
      </div>
    </div>`;
  knoepfe();
}
function statusZeile() {
  if (rolle === "client" && !verbunden) {
    const darf = S && S.spieler && offlineSeit && Date.now() - offlineSeit >= UEBERNEHMEN_NACH;
    return `<p class="status"><span>${esc(fehlerText || "Keine Verbindung zum Spielleiter …")}</span>${darf ? `<button id="uebernehmen">Leitung übernehmen</button>` : ""}</p>`;
  }
  if (rolle === "host" && !verbunden && fehlerText) return `<p class="status">${esc(fehlerText)}</p>`;
  return "";
}
function knoepfe() {
  hud.querySelectorAll("[data-modus]").forEach(b => b.onclick = () => {
    const m = b.dataset.modus;
    if (m === "zug") ui.panel = ui.panel && ui.panel.art === "zug" ? null : { art: "zug" };
    else { ui.modus = m; ui.panel = null; welt.markieren(null); }
    render();
  });
  hud.querySelectorAll("[data-teil]").forEach(b => b.onclick = () => { ui.teil = b.dataset.teil; render(); });
  hud.querySelectorAll("[data-bau]").forEach(b => b.onclick = () => { ui.bau = b.dataset.bau; render(); });
  hud.querySelectorAll("[data-stufe]").forEach(b => b.onclick = () => tun({ typ: "stufe", k: b.dataset.stufe }));
  hud.querySelectorAll("[data-einladen]").forEach(b => b.onclick = () => { const r = tun({ typ: "einladen", an: b.dataset.einladen }); if (!r.fehler) hinweis("Einladung geschickt."); });
  hud.querySelectorAll("[data-annehmen]").forEach(b => b.onclick = () => { if (confirm("Zusammentun? Kasse, Land, Gleise und Ziele werden geteilt, alle Züge fahren im gemeinsamen Netz.")) tun({ typ: "annehmen", von: b.dataset.annehmen }); });
  hud.querySelectorAll("[data-ablehnen]").forEach(b => b.onclick = () => tun({ typ: "ablehnen", von: b.dataset.ablehnen }));
  hud.querySelectorAll("[data-hin]").forEach(b => b.onclick = () => { const sp = S.spieler[b.dataset.hin]; const l = welt.lokBei(b.dataset.hin) || { x: sp.start.x, y: sp.start.y }; welt.folgen = false; welt.blick(l.x, l.y, 30); ui.panel = null; render(); });
  const on = (id, f) => { const el = document.getElementById(id); if (el) el.onclick = f; };
  on("folgen", () => { welt.folgen = !welt.folgen; render(); });
  on("menue", () => { ui.panel = ui.panel && ui.panel.art === "menue" ? null : { art: "menue" }; render(); });
  on("bahnen", () => { ui.panel = ui.panel && ui.panel.art === "bahnen" ? null : { art: "bahnen" }; render(); });
  on("ziele", () => { ui.panel = ui.panel && ui.panel.art === "ziele" ? null : { art: "ziele" }; render(); });
  on("zu", () => { ui.panel = null; welt.markieren(null); render(); });
  on("wenden", () => { tun({ typ: "wenden" }); });
  on("stellen", () => tun({ typ: "weiche", i: ui.panel.i }));
  on("land", () => { const r = tun({ typ: "land", p: ui.panel.p }); if (!r.fehler) { ui.panel = null; welt.markieren(null); render(); hinweis("Neues Land gekauft."); } });
  on("speichern", speichern);
  on("beenden", beenden);
  on("uebernehmen", uebernehmen);
  on("teilen", async () => { try { if (navigator.share) await navigator.share({ title: "Gleisgenossen", url: link() }); else { await navigator.clipboard.writeText(link()); hinweis("Link kopiert."); } } catch (e) {} });
  zahlenAuffrischen();
}

const kopf = t => `<div class="kopf"><h3>${t}</h3><button class="zu" id="zu" aria-label="Schließen">✕</button></div>`;
function menuePanel() {
  const g = gruppe();
  return `<div class="panel">${kopf("Menü")}
    ${g ? `<p class="stand">${esc(g.name)}: ${strecke(g.meter)} gefahren · ${zahl(g.verdient)} T verdient · ${g.gebaut} Gleisteile gebaut · Spielzeit ${dauer(S.zeit)}</p>` : ""}
    ${rolle === "client" ? `<p class="hinweis">Gespeichert wird auf dem Handy des Spielleiters.</p>` :
      `<p class="hinweis">${gespeichertUm ? "Zuletzt gespeichert " + esc(vor(gespeichertUm)) + "." : "Diese Welt ist noch nicht gespeichert."} Wer ohne Speichern beendet, verwirft den Spielstand.</p>`}
    ${rolle === "host" ? `<p class="hinweis">Raumcode <b>${esc(code)}</b>: Weitere Mitspieler können eine Bahn übernehmen, die gerade niemand steuert, oder zuschauen.</p>` : ""}
    <div class="knopfreihe">${rolle !== "client" ? `<button class="knopf" id="speichern">Speichern</button>` : ""}${rolle === "host" ? `<button class="knopf zweit" id="teilen">Link teilen</button>` : ""}<button class="knopf zweit" id="beenden">${rolle === "client" ? "Verlassen" : "Beenden"}</button></div>
    <p class="hinweis"><b>So geht's:</b> Kurven bremsen den Zug, auf langen Geraden wird er schnell und verdient mehr.
      Bahnhöfe: Fahrgäste steigen ein und zahlen am nächsten anderen Bahnhof nach Entfernung, neben Dörfern steigen mehr ein.
      Weichen stellt ihr mit „Schauen“ durch Antippen um. Bauwerke neben der Strecke geben bei jeder Durchfahrt Geld,
      mehrere kurz hintereinander bis doppelt so viel.${Object.keys(S.spieler).length > 1 ? " Über 👥 könnt ihr euch mit anderen Bahnen zusammentun: dann teilt ihr Kasse, Land und Gleise, und alle Züge fahren im gemeinsamen Netz." : ""}</p>
  </div>`;
}
function bahnenPanel() {
  const gid = meine();
  return `<div class="panel">${kopf("Bahnen")}
    <div class="stufen">${Object.keys(S.gruppen).map(k => {
      const g = S.gruppen[k], ich = k === gid;
      const an = S.einladungen.find(e => e.von === k && e.an === gid), raus = S.einladungen.find(e => e.von === gid && e.an === k);
      const knopf = !gid || ich ? "" : an ? `<button data-annehmen="${k}">Annehmen</button>` : raus ? `<button disabled>Eingeladen</button>` : `<button data-einladen="${k}">Zusammentun</button>`;
      return `<div class="stufe"><div><b><span class="farbe" style="background:${G.FARBEN[g.farbe]}"></span> ${esc(g.name)}${ich ? " (ihr)" : ""}</b>
          <small>${g.mitglieder.map(p => `${online(p) ? "●" : "○"} ${esc(S.spieler[p] ? S.spieler[p].name : "?")}`).join(" · ")} · ${zahl(g.kasse)} T · ${strecke(g.meter)}</small>
          <small>${g.mitglieder.map(p => `<a href="#" data-hin="${p}" class="hinlink">${esc(S.spieler[p] ? S.spieler[p].name : "?")} ansehen</a>`).join(" ")}</small></div>
        ${knopf}${an ? `<button class="zweit" data-ablehnen="${k}">Nein</button>` : ""}</div>`;
    }).join("")}</div>
    <p class="hinweis">Zusammentun: Kasse, Land, Gleise und Ziele werden geteilt, und alle Züge fahren im gemeinsamen Netz. Die andere Bahn muss zustimmen.</p>
  </div>`;
}

function panelHtml(w, z, g) {
  const p = ui.panel, gid = meine();
  if (p && p.art === "menue") return menuePanel();
  if (p && p.art === "bahnen") return bahnenPanel();
  if (p && p.art === "ziele") {
    return `<div class="panel">${kopf("Ziele")}
      <div class="stufen">${G.alleZiele().map(zz => `<div class="stufe ${g.ziele[zz.id] ? "erledigt" : ""}"><div><b>${g.ziele[zz.id] ? "✓ " : ""}${esc(zz.text)}</b></div><small>+${zahl(zz.geld)} T</small></div>`).join("")}</div>
    </div>`;
  }
  if (p && p.art === "land") {
    const kaufbar = G.landKaufbar(S, gid, p.p), preis = G.landPreis(S, gid);
    return `<div class="panel kompakt">${kopf("Grundstück")}
      <p class="hinweis">${kaufbar ? `8 × 8 Felder. Danach könnt ihr hier bauen.` : "Kaufen geht nur direkt neben eigenem Land (gelbe Linie)."}</p>
      ${kaufbar ? `<button class="knopf" id="land" data-preis="${preis}">Kaufen für ${zahl(preis)} T</button>` : ""}
    </div>`;
  }
  if (p && p.art === "zug") {
    const st = z.stufen, wagen = 1 + st.wagen;
    const was = {
      tempo: `${G.kmh(w.vmax)} km/h → ${G.kmh(w.vmax + .3)} km/h`,
      kraft: `+22 % Beschleunigung`,
      kurve: `${G.kmh(w.vk)} km/h → ${G.kmh(w.vk + .12)} km/h in Kurven`,
      bremse: `+22 % Bremskraft`,
      wagen: `${wagen} → ${wagen + 1} Wagen: ${w.geld} → ${w.geld + 1} T pro 10 m, ${w.plaetze} → ${w.plaetze + G.PLAETZE} Plätze`
    };
    return `<div class="panel">${kopf("Dein Zug")}
      <p class="hinweis">${z.wartet === "ende" ? "<b>Der Zug steht am Gleisende.</b> Baut weiter oder wendet ihn. " : z.wartet === "zug" ? "<b>Ein anderer Zug steht im Weg.</b> Wartet oder wendet. " : ""}Jede 10 m bringen ${w.geld} T${G.aussicht(S, z) > 1.001 ? `, hier oben mit Aussicht ${Math.round((G.aussicht(S, z) - 1) * 100)} % mehr` : ""}. ${w.plaetze} Plätze für Fahrgäste. Bergauf fährt der Zug langsamer, Zugkraft hilft.${z.schub > 0 ? " Volldampf vom Wasserturm!" : ""}</p>
      <div class="stufen">${Object.keys(G.STUFEN).map(k => {
        const d = G.STUFEN[k], voll = st[k] >= d.max, preis = G.stufenPreis(z, k);
        return `<div class="stufe"><div><b>${d.name} · Stufe ${st[k]}</b><small>${voll ? "ganz ausgebaut" : was[k]}</small></div>
          <button data-stufe="${k}" ${voll ? "disabled" : `data-preis="${preis}"`}>${voll ? "fertig" : zahl(preis) + " T"}</button></div>`;
      }).join("")}</div>
      <button class="knopf zweit" id="wenden">Zug wenden</button>
    </div>`;
  }
  if (p && p.art === "feld") {
    const gel = S.karte.g[p.i], t = S.gleise[p.i], b = S.bauten[p.i];
    if (b) { const d = G.BAUTEN[b.t], rad = G.bauRadius(p.i, b.t); return `<div class="panel kompakt">${kopf(d.name)}<p class="hinweis">${d.text}, wenn eine Lok bis ${rad} Feld${rad > 1 ? "er" : ""} entfernt vorbeifährt.${rad > d.radius ? " Auf der Anhöhe sieht man es weiter." : ""}</p></div>`; }
    if (t && t.t === "s") return `<div class="panel kompakt">${kopf("Weiche")}<p class="hinweis">Gestellt auf <b>${t.st ? "abbiegen" : "geradeaus"}</b> (Lampe ${t.st ? "gelb" : "grün"}). Züge von den Zweigen fahren immer durch.</p><button class="knopf" id="stellen">Umstellen</button></div>`;
    if (t && t.t === "b") return `<div class="panel kompakt">${kopf("Bahnhof " + esc(G.bahnhofName(S, p.i)))}<p class="hinweis">${G.haeuser(S, p.i)} Häuser in der Nähe: bis zu ${G.nachfrage(S, p.i)} Fahrgäste steigen ein. Sie zahlen am nächsten anderen Bahnhof ${G.FAHRPREIS.toLocaleString("de-DE")} T pro Feld Fahrt.</p></div>`;
    const nm = t ? (gel === "~" ? "Brücke" : gel === "b" ? "Tunnel" : G.TEILE[t.t].name) : G.GELAENDE[gel];
    return `<div class="panel kompakt">${kopf(nm)}
      <p class="hinweis">${t ? "Zum Drehen oder Ersetzen auf „Gleise“ tippen, zum Entfernen auf „Abreißen“." :
        gel === "w" ? "Wald. Bauen kostet 15 T mehr fürs Roden." : gel === "~" ? `Wasser. Eine Gerade wird hier zur Brücke (+${G.BRUECKE} T).` : gel === "b" ? `Berg. Eine Gerade wird hier zum Tunnel (+${G.TUNNEL} T).` : gel === "h" ? "Ein Dorf. Ein Bahnhof daneben bringt viele Fahrgäste." : "Freie Wiese, hier könnt ihr bauen."}${S.karte.hoehe ? ` Höhe ${(Math.round(G.feldHoehe(p.i) * 10) / 10).toLocaleString("de-DE")}${G.eben(p.i) ? ", eben" : ", am Hang"}${G.anhoehe(p.i) ? " (Anhöhe)" : ""}.` : ""}</p>
    </div>`;
  }
  if (ui.modus === "bauen") {
    return `<div class="panel kompakt">
      <div class="teile">${Object.keys(G.TEILE).map(k => `<button data-teil="${k}" class="${ui.teil === k ? "an" : ""}">${TEIL_BILD[k]}${G.TEILE[k].name}<small>${G.TEILE[k].preis} T</small></button>`).join("")}</div>
      <p class="hinweis">Feld antippen: bauen. Gleis antippen: drehen (kostenlos) oder ersetzen. Eine Gerade auf Wasser wird zur Brücke (+${G.BRUECKE} T), im Berg zum Tunnel (+${G.TUNNEL} T). Gleise folgen den Hügeln, Bahnhöfe brauchen ebenen Boden.</p>
    </div>`;
  }
  if (ui.modus === "bauten") {
    const d = G.BAUTEN[ui.bau];
    return `<div class="panel kompakt">
      <div class="teile">${Object.keys(G.BAUTEN).map(k => `<button data-bau="${k}" class="${ui.bau === k ? "an" : ""}"><i class="emoji">${BAU_BILD[k]}</i>${G.BAUTEN[k].name}<small>${zahl(G.BAUTEN[k].preis)} T</small></button>`).join("")}</div>
      <p class="hinweis"><b>${d.name}:</b> ${d.text}, wenn eine Lok bis ${d.radius} Feld${d.radius > 1 ? "er" : ""} entfernt vorbeifährt. Auf einer Anhöhe ein Feld weiter. Feld neben der Strecke antippen.</p>
    </div>`;
  }
  if (ui.modus === "abreissen") return `<div class="panel kompakt"><p class="hinweis">Gleis oder Bauwerk antippen: abreißen. Ihr bekommt die Hälfte des Preises zurück.</p></div>`;
  return "";
}

// Ereignisse aus der Fahrt als aufsteigender Text (eigene Züge, fremde nur leise)
function ereignis(e) {
  const x = e.i % G.B + .5, y = (e.i / G.B | 0) + .5, eigen = G.gruppeVon(S, e.pid) === meine();
  if (!eigen) return;
  if (e.art === "halt") welt.schweben(x, y, e.geld ? `+${zahl(e.geld)} T · ${e.leute} Fahrgäste` : e.gleicher ? "Fahrgäste wollen woanders hin" : "Fahrgäste steigen ein", e.geld ? "geld" : "info");
  if (e.art === "bonus") welt.schweben(x, y, `+${zahl(e.geld)} T ${e.name}${e.kette > 1 ? " · ×" + e.faktor.toLocaleString("de-DE") : ""}`);
  if (e.art === "schub") welt.schweben(x, y, "Volldampf! 20 s schneller", "info");
}

function zahlenAuffrischen() {
  if (!S || hud.hidden) return;
  if (rolle !== "client") {
    const neu = G.zielePruefen(S);
    if (neu.length) {
      const meins = neu.filter(n => n.gid === meine()).map(n => n.ziel);
      if (meins.length) zielMeldung(meins);
      if (rolle === "host") geaendert(); else render();
      return;
    }
  }
  const g = gruppe(), z = meinZug(); if (!g || !z) return;
  const jetzt = S.zeit;
  verlauf.push([jetzt, g.verdient]);
  while (verlauf.length > 2 && jetzt - verlauf[0][0] > 60) verlauf.shift();
  const [t0, v0] = verlauf[0];
  if (jetzt - t0 > 3) proMinute = Math.max(0, (g.verdient - v0) / (jetzt - t0) * 60);
  const set = (id, t) => { const el = document.getElementById(id); if (el && el.textContent !== t) el.textContent = t; };
  set("kasse", zahl(g.kasse) + " T"); set("promin", zahl(proMinute) + " T"); set("tempo", G.kmh(z.v) + " km/h");
  hud.querySelectorAll("[data-preis]").forEach(b => b.classList.toggle("teuer", g.kasse < +b.dataset.preis));
}

// ---------- Start ----------
if (T) window.__gg = { get S() { return S; }, get welt() { return welt; }, ui, get rolle() { return rolle; }, PID };
(function los() {
  if (code) {
    const sitzung = ss.get("gg2:sitzung:" + code + T);
    if (sitzung) {          // Spielleiter hat neu geladen: Raum wieder öffnen
      rolle = "host"; gespeichertUm = sitzung.um;
      if (sitzung.S) {
        S = G.auffrischen(sitzung.S, PID); lobby = null; spielZeigen(S);
        leitungPruefen(gibt => gibt ? alsMitspielerWeiter() : oeffneHostPeer());
      }
      else { lobby = sitzung.lobby; oeffneHostPeer(); lobbyZeigen(); }
      return;
    }
    if (name) return clientStarten();
    return einladungSeite();
  }
  startseite();
})();
