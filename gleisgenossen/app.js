// Gleisgenossen: Verbindung (Handy des Spielleiters ist der Server, PeerJS), Lobby und Bedienleiste über der 3D-Welt.
import { Welt } from "./welt.js";

const G = window.GG;
const app = document.getElementById("app"), weltEl = document.getElementById("welt"), hud = document.getElementById("hud");
const PREFIX = "fmwgg-";
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
const zahl = n => Math.round(n).toLocaleString("de-DE");

let PID = ls.get("slf:pid"); if (!PID) { PID = Math.random().toString(36).slice(2, 10); ls.set("slf:pid", PID); }
let name = ls.get("slf:name") || "";
let code = (params.get("raum") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
let rolle = null, S = null, peer = null, hostConn = null, verbunden = false, offlineSeit = null, fehlerText = "";
const conns = new Map();
let retryTimer = null, token = 0, versuch = 0, hinweis = "", hinweisTimer = null;
let welt = null, muenzenGezeigt = null;
// Bedienzustand nur auf diesem Handy
const ui = { modus: "schauen", info: null, bau: [], zug: null, menue: false, ereignis: false };

const hostId = ep => PREFIX + code + "-" + ep;
const link = () => location.origin + location.pathname + "?raum=" + code;
const testTeil = () => (params.get("test") ? "&test=" + params.get("test") : "");

// ---------- Bildschirm wach halten ----------
let wake = null;
async function wachHalten() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wachHalten(); if (rolle === "client" && !hostConn) verbindeZumHost(); } });
document.addEventListener("click", wachHalten);

// ---------- Spielleiter ----------
function speichernHost() { ls.set("gg:host:" + code, S); }
function hostStarten(s) {
  rolle = "host"; S = G.nachruesten(s); S.host = PID;
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
  const r = G.aktion(S, m.pid, m);
  if (r.ok) S = r.S;
  else if (m.t !== "hallo") { try { c.send({ t: "fehler", text: r.fehler }); } catch (e) {} }
  geaendert();
}
function geaendert() {
  S.online = [PID].concat([...conns.keys()]);
  const w = G.weiterWennBereit(S, S.online); if (w) S = w;
  speichernHost();
  for (const [, c] of conns) { try { c.send({ t: "zustand", s: S }); } catch (e) {} }
  render();
}

// ---------- Mitspieler ----------
function clientStarten() {
  rolle = "client";
  const k = ls.get("gg:kopie:" + code); if (k) S = G.nachruesten(k);
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
    if (m.t === "zustand") { S = G.nachruesten(m.s); ls.set("gg:kopie:" + code, S); render(); }
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
  ls.del("gg:kopie:" + code); clearTimeout(retryTimer); token++;
  if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
  hostStarten(s);
}
function fortsetzenAlsHost(gespeichert) {
  rolle = "pruefen"; render();
  const probe = new Peer(undefined, PEER_OPT); let fertig = false;
  const ende = alsClient => {
    if (fertig) return; fertig = true; try { probe.destroy(); } catch (e) {}
    if (alsClient) { ls.del("gg:host:" + code); ls.set("gg:kopie:" + code, gespeichert); clientStarten(); }
    else hostStarten(gespeichert);
  };
  probe.on("open", () => { const c = probe.connect(hostId(gespeichert.epoch + 1), { serialization: "json" }); c.on("open", () => ende(true)); });
  probe.on("error", () => ende(false));
  setTimeout(() => ende(false), 4000);
}

// ---------- Aktionen ----------
function tun(m) {
  if (rolle === "host") { const r = G.aktion(S, PID, m); if (r.ok) { S = r.S; geaendert(); } else zeigeHinweis(r.fehler); }
  else if (hostConn && hostConn.open) { try { hostConn.send(Object.assign({ pid: PID }, m)); } catch (e) {} }
  else zeigeHinweis("Keine Verbindung zum Spielleiter.");
}
function zeigeHinweis(t) { hinweis = t; render(); clearTimeout(hinweisTimer); hinweisTimer = setTimeout(() => { hinweis = ""; render(); }, 2800); }
function neuesSpiel() {
  code = Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join("");
  history.replaceState(null, "", "?raum=" + code + testTeil());
  hostStarten(G.neu(code, PID, name));
}
function verlassen() { ls.del("gg:host:" + code); ls.del("gg:kopie:" + code); location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : ""); }

// ---------- Hilfen ----------
const sp = p => (S && S.spieler[p]) || { name: "?" };
const online = p => !!(S && S.online && S.online.includes(p));
const anwesend = () => (S.online || []).filter(p => S.spieler[p]);
const ortName = z => { const o = G.ortBei(S, z); return o ? o.name : "Feld"; };
const ladungName = l => G.LADUNG[l].name;
function statusZeile() {
  if (rolle === "host") return verbunden ? "" : (fehlerText || "Raum wird geöffnet …");
  if (rolle === "client" && !verbunden) return S ? "Verbindung zum Spielleiter weg, verbinde neu …" : (fehlerText || "Verbinde mit Raum " + code + " …");
  return "";
}
function statusHtml() {
  const st = statusZeile(), ueb = rolle === "client" && S && offlineSeit && Date.now() - offlineSeit > 20000;
  return st ? `<div class="status"><span>${esc(st)}</span>${ueb ? `<button id="uebernehmen">Spielleitung übernehmen</button>` : ""}</div>` : "";
}

// ---------- Darstellung ----------
function render() {
  const imSpiel = S && S.karte && S.phase !== "lobby" && (rolle === "host" || rolle === "client");
  document.body.classList.toggle("spiel", !!imSpiel); document.documentElement.classList.toggle("spiel", !!imSpiel);
  weltEl.hidden = !imSpiel; hud.hidden = !imSpiel;
  if (imSpiel) { spielRender(); return; }
  let h = statusHtml();
  if (!rolle) h += code ? bildschirmName() : bildschirmStart();
  else if (rolle === "pruefen" || !S) h += `<div class="mitte"><p class="leise">Verbinde …</p></div>`;
  else h += bildschirmLobby();
  if (hinweis) h += `<div class="toast" role="status">${esc(hinweis)}</div>`;
  app.innerHTML = h;
  binden();
}
setInterval(() => { if (rolle === "client" && offlineSeit) render(); }, 5000);

// Titelbild: Dampfzug auf einer Brücke über Sechseck-Hügel, Münzen fliegen
const TITELBILD = `<svg class="titelbild" viewBox="0 0 320 150" role="img" aria-label="Ein Dampfzug fährt über eine Brücke durch eine Landschaft aus Sechsecken">
<rect x="2" y="2" width="316" height="146" rx="20" fill="#BFE3F2"/>
<g stroke="#1C1A33" stroke-width="2" stroke-linejoin="round">
<path d="M2 96 L40 76 L78 96 L116 76 L154 96 L192 76 L230 96 L268 76 L318 100 V128 a20 20 0 0 1-20 20 H22 a20 20 0 0 1-20-20z" fill="#9BD45A"/>
<path d="M232 76 l20-34 l20 34z" fill="#8E8B84"/><path d="M245 54 l7-12 l7 12 l-7 4z" fill="#F7F7FA"/>
<path d="M262 80 l22-38 l22 38z" fill="#9C9C8E"/><path d="M276 56 l8-14 l8 14 l-8 4z" fill="#F7F7FA"/>
<path d="M20 86 l8-18 l8 18z M34 90 l7-15 l7 15z" fill="#2F8A4A"/>
<path d="M118 112 q30 -8 60 0 v36 h-60z" fill="#4F86D9"/>
</g>
<path d="M0 118 C70 108 110 98 160 98 S260 108 320 96" fill="none" stroke="#6B4A32" stroke-width="9"/>
<path d="M0 118 C70 108 110 98 160 98 S260 108 320 96" fill="none" stroke="#E8DCC2" stroke-width="9" stroke-dasharray="2 5"/>
<g fill="none" stroke="#2F6FDE" stroke-width="3"><path d="M118 104 L178 104 M118 104 l10 -14 l10 14 l10 -14 l10 14 l10 -14 l10 14 M120 90 h50"/></g>
<g stroke="#1C1A33" stroke-width="2.2" stroke-linejoin="round">
<rect x="58" y="88" width="34" height="18" rx="3" fill="#F3E6CC"/><rect x="58" y="96" width="34" height="4" fill="#E2453A"/>
<rect x="96" y="86" width="34" height="18" rx="3" fill="#F3E6CC"/><rect x="96" y="94" width="34" height="4" fill="#E2453A"/>
<rect x="134" y="78" width="40" height="18" rx="9" fill="#E2453A"/><rect x="164" y="66" width="22" height="30" rx="3" fill="#E2453A"/>
<rect x="160" y="62" width="30" height="6" rx="2" fill="#1C1A33"/><rect x="140" y="64" width="8" height="15" fill="#1C1A33"/>
<rect x="168" y="72" width="12" height="8" rx="1" fill="#BFE3F2"/>
<circle cx="146" cy="99" r="6" fill="#1C1A33"/><circle cx="162" cy="99" r="6" fill="#1C1A33"/><circle cx="178" cy="99" r="6" fill="#1C1A33"/>
<circle cx="66" cy="107" r="4" fill="#1C1A33"/><circle cx="84" cy="107" r="4" fill="#1C1A33"/><circle cx="104" cy="105" r="4" fill="#1C1A33"/><circle cx="122" cy="105" r="4" fill="#1C1A33"/>
</g>
<g fill="#FFFFFF" stroke="#1C1A33" stroke-width="2" opacity=".95"><circle cx="144" cy="54" r="8"/><circle cx="132" cy="40" r="10"/><circle cx="114" cy="28" r="12"/></g>
<g stroke="#1C1A33" stroke-width="2"><circle cx="214" cy="40" r="11" fill="#FFD447"/><circle cx="236" cy="22" r="8" fill="#FFD447"/><circle cx="196" cy="20" r="7" fill="#FFD447"/></g>
<text x="214" y="45" text-anchor="middle" font-family="Unbounded,system-ui,sans-serif" font-weight="800" font-size="12" fill="#1C1A33">T</text>
</svg>`;

function bildschirmStart() {
  return `<header class="titel">${TITELBILD}<h1>Gleisgenossen</h1><p class="leise">Ihr seid eine Eisenbahn-Genossenschaft mit gemeinsamer Kasse. Baut Strecken, kauft Züge und bringt Fahrgäste, Kohle und Holz ans Ziel. Allein oder mit bis zu sechs Leuten, jeder auf seinem Handy.</p></header>
    <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
    <div class="karte-box"><h2>Neues Spiel</h2><p class="leise klein">Du öffnest einen Raum, die anderen kommen per Code, Link oder QR-Code dazu.</p>
      <button class="knopf" id="neu">Raum erstellen</button></div>
    <div class="karte-box"><h2>Mitspielen</h2>
      <label class="feld">Raumcode<input id="code" maxlength="4" autocapitalize="characters" placeholder="z. B. K7M2"></label>
      <button class="knopf zweit" id="beitreten">Beitreten</button></div>
    <a class="link" href="../">Alle Spiele</a>`;
}
function bildschirmName() {
  return `<header class="titel">${TITELBILD}<h1>Gleisgenossen</h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
    <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
    <button class="knopf" id="mitspielen">Mitspielen</button>`;
}
function bildschirmLobby() {
  const host = rolle === "host", da = anwesend();
  const groesse = da.length <= 2 ? "14 × 11 Felder, 4 Orte" : da.length <= 4 ? "16 × 12 Felder, 5 Orte" : "18 × 13 Felder, 6 Orte";
  let qr = "";
  try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (e) {}
  return `<header class="titel"><p class="etikett">Gleisgenossen · Raumcode</p><div class="code">${esc(code)}</div></header>
    ${qr ? `<div class="qr">${qr}</div>` : ""}
    <div class="reihe"><button class="knopf zweit" id="teilen">Link teilen</button><button class="knopf zweit" id="kopieren">Link kopieren</button></div>
    <div class="karte-box"><h2>Genossenschaft (${da.length})</h2><ul class="spieler">${S.reihenfolge.filter(p => S.spieler[p]).map(p =>
      `<li><i class="punkt ${online(p) ? "an" : ""}"></i>${esc(sp(p).name)}${p === S.host ? " <small>Spielleitung</small>" : ""}${p === PID ? " <small>du</small>" : ""}</li>`).join("")}</ul>
      <p class="leise klein">Karte für ${da.length} ${da.length === 1 ? "Person" : "Personen"}: ${groesse}. Auch später kann noch jemand dazukommen.</p></div>
    <div class="karte-box"><h2>Spieldauer</h2>
      <div class="wahl">${G.MONATE.map(m => `<button data-monate="${m}" class="${S.monate === m ? "an" : ""}" ${host ? "" : "disabled"}>${m} Monate</button>`).join("")}</div>
      <p class="leise klein">Ein Monat dauert etwa 3–5 Minuten.</p></div>
    <div class="karte-box"><h2>So geht's</h2><ul class="regeln">
      <li>Alle planen <b>gleichzeitig</b> mit einer <b>gemeinsamen Kasse</b>: Gleise bauen, Züge kaufen, Linien festlegen.</li>
      <li><b>Gleis bauen:</b> Start antippen (Ort oder Gleis), dann das Ziel. Der günstigste Weg erscheint mit Kosten. Wiese 20 T, Wald 40, Hügel 60, Brücke 150, Tunnel 250 pro Feld. Erreicht das Gleis einen Ort, entsteht dort ein Bahnhof (100 T).</li>
      <li><b>Zweigleisig ausbauen:</b> Teilen sich Züge ein eingleisiges Stück, warten sie aufeinander und schaffen weniger Fahrten. Zweigleisige Strecken lösen das.</li>
      <li><b>Abreißen:</b> Unter „Gleis bauen“ → „Abreißen“ Anfang und Ende antippen. Es gibt 40 % der Baukosten zurück, die Wartung fällt weg. Strecken, über die ein Zug fährt, lassen sich nicht abreißen.</li>
      <li><b>Züge:</b> Lok und Ladung wählen, dann die Bahnhöfe der Reihe nach antippen. Der Zug pendelt hin und her. Gibt es einen Gleiskreis, macht den ersten Bahnhof nochmal antippen einen <b>Rundkurs</b>: kein Wenden, etwas mehr Fahrten.</li>
      <li><b>Fahrgäste</b> fahren zwischen Orten, <b>Kohle</b> von der Zeche zum Kraftwerk, <b>Holz</b> vom Holzfäller zum Sägewerk. Je weiter, desto mehr Geld.</li>
      <li><b>Kohle in einen Ort</b> füllt euer Kohlenlager: Damit fahren eure Loks, sonst muss Kohle teuer zugekauft werden.</li>
      <li>Das Sägewerk macht aus Holz <b>Bretter</b>. Bretter in einen Ort lassen ihn <b>wachsen</b>: mehr Fahrgäste.</li>
      <li><b>Aufträge</b> bringen Belohnung und Ruf. Verpasst ihr die Frist, sinkt der Ruf. Bei null Sternen ist das Spiel verloren.</li>
      <li>Jeden Monat gibt es ein <b>Ereignis</b>: Hochwasser, Stadtfest, Schneesturm, Fördergeld …</li>
      <li>Sind alle fertig, wird abgerechnet. Wer ins Minus rutscht, ist pleite. Zur Not hilft ein <b>Kredit</b> (5 % Zinsen pro Monat).</li>
      <li>Am Ende zählt der Wert der Genossenschaft (Kasse plus halber Zugwert). Dafür gibt es bis zu drei Sterne.</li></ul></div>
    ${host ? `<div class="unten"><button class="knopf" id="start">Spiel starten${da.length === 1 ? " (allein)" : ` (${da.length} Personen)`}</button></div>`
      : `<p class="leise mitte">Warte, bis ${esc(sp(S.host).name)} das Spiel startet.</p>`}
    <button class="link" id="verlassen">Raum verlassen</button>`;
}

// ---------- Spielansicht ----------
function spielRender() {
  if (!welt) {
    welt = new Welt(weltEl);
    welt.onTap = feldGetippt;
  }
  welt.groesse();
  welt.karteSetzen(S.karte);
  const adj = G.netz(S);
  welt.netzSetzen(S, adj);
  welt.zuegeSetzen(S, G.linienWeg, G.LOKS, stehendeZuege());
  if (S.phase !== "planen") { ui.modus = "schauen"; ui.bau = []; ui.zug = null; }
  if (ui.zug && ui.zug.id && !S.zuege.some(z => z.id === ui.zug.id)) ui.zug = null;
  ui.bau = ui.bau.filter(i => i >= 0 && i < S.karte.B * S.karte.H);
  if (ui.bau.length === 1 && !G.darfStarten(S, ui.bau[0])) ui.bau = [];
  // Vorschau und Markierungen
  const marken = [];
  if (ui.modus === "bauen" && ui.bau.length) {
    welt.vorschau(ui.bau, ui.abriss ? 0xD7263D : ui.ausbau ? 0x2F6FDE : 0xFF6B57);
    marken.push({ zelle: ui.bau[0], farbe: 0xFFD447, text: ui.bau.length === 1 ? "Start" : "" });
    if (ui.bau.length > 1) marken.push({ zelle: ui.bau[ui.bau.length - 1], farbe: 0xFF6B57, text: "Ziel", bg: "#FF6B57" });
  } else if (ui.modus === "zuege" && ui.zug) {
    const w = ui.zug.linie.length >= 2 ? G.linienWeg(S, ui.zug.linie, null, ui.zug.rund) : null;
    welt.vorschau(w ? w.pfad : null, 0xFFD447, ui.zug.rund);
    ui.zug.linie.forEach((z, k) => marken.push({ zelle: z, text: String(k + 1) }));
    S.bahnhoefe.filter(b => !ui.zug.linie.includes(b)).forEach(b => marken.push({ zelle: b, farbe: 0xF3F0FF }));
  } else {
    welt.vorschau(null);
    if (ui.info !== null && ui.modus === "schauen") marken.push({ zelle: ui.info, farbe: 0xFFD447 });
  }
  welt.markieren(marken);
  if ((S.phase === "bericht" || S.phase === "ende") && S.bericht && muenzenGezeigt !== S.code + S.bericht.monat + S.historie.length) {
    muenzenGezeigt = S.code + S.bericht.monat + S.historie.length;
    welt.muenzen(S.bericht.muenzen);
  }
  // Bedienleiste (Scrollstand der Tafel merken)
  const altPanel = hud.querySelector(".panel"), scroll = altPanel ? altPanel.scrollTop : 0;
  hud.innerHTML = hudHtml();
  const neuPanel = hud.querySelector(".panel"); if (neuPanel) neuPanel.scrollTop = scroll;
  hudBinden();
}
// Züge, die wegen des Ereignisses in diesem Monat nicht fahren
function stehendeZuege() {
  const st = new Set(), ev = S.phase === "planen" ? S.ereignis : null;
  if (!ev) return st;
  if (ev.typ === "lokschaden") st.add(ev.zug);
  if (ev.typ === "hochwasser") S.zuege.forEach(z => { const w = G.linienWeg(S, z.linie, null, z.rund); if (w && w.pfad.some(i => S.karte.g[i] === "~")) st.add(z.id); });
  return st;
}
const rufSterne = r => "★".repeat(r) + "☆".repeat(G.RUF_MAX - r);
function hudHtml() {
  const phasen = { planen: "Planen", bericht: "Abrechnung", ende: S.ergebnis && S.ergebnis.pleite ? "Pleite" : "Geschafft" };
  let h = `<div>${statusHtml()}<div class="hud-oben">
    <div class="chip gross"><small>${S.phase === "ende" ? "Spielende" : `Monat ${S.monat} / ${S.monate}`} <span class="ruf" title="Ruf">${rufSterne(S.ruf)}</span></small><b>${phasen[S.phase] || ""}</b></div>
    <div class="chip ${S.kasse < 0 ? "minus" : ""}"><small>Kasse</small><b>${zahl(S.kasse)} T</b></div>
    <button class="rund" id="kamera" aria-label="Ganze Karte zeigen">⌖</button>
    <button class="rund" id="menue" aria-label="Menü" aria-expanded="${ui.menue}">☰</button></div>
    ${S.phase === "planen" && S.ereignis && S.ereignis.typ !== "ruhig" ? `<button class="ereignis" id="ereignisknopf">⚡ ${esc(S.ereignis.titel)}</button>` : ""}</div>`;
  // Beim Auswählen auf der Karte nur die schmale Tafel zeigen, damit die Karte frei bleibt
  const waehlen = S.phase === "planen" && !ui.menue && ((ui.modus === "bauen" && ui.bau.length) || (ui.modus === "zuege" && ui.zug));
  h += `<div class="hud-unten">${panelHtml()}${S.phase === "planen" && !waehlen ? werkzeugeHtml() : ""}${waehlen ? "" : fertigHtml()}</div>`;
  if (hinweis) h += `<div class="toast" role="status">${esc(hinweis)}</div>`;
  return h;
}
function werkzeugeHtml() {
  const b = (m, i, t) => `<button data-modus="${m}" class="${ui.modus === m ? "an" : ""}"><i>${i}</i>${t}</button>`;
  const neu = S.angebote.length && S.auftraege.length < G.MAX_AUFTRAEGE ? `<em>${S.angebote.length}</em>` : "";
  return `<div class="werkzeuge">${b("bauen", "⛏", "Gleis bauen")}${b("zuege", "🚂", "Züge")}${b("auftraege", "📜", "Aufträge" + neu)}${b("bilanz", "📊", "Kasse")}</div>`;
}
function fertigHtml() {
  if (S.phase === "ende") return "";
  const da = anwesend(), n = da.filter(p => S.bereit[p]).length, ich = !!S.bereit[PID];
  const text = S.phase === "planen" ? (ich ? "Doch noch nicht fertig" : "Monat beenden") : (ich ? "Warte auf die anderen …" : (S.monat >= S.monate ? "Zum Ergebnis" : `Weiter zu Monat ${S.monat + 1}`));
  const nichtWarten = rolle === "host" && ich && n < da.length;
  return `<div class="fertig"><button class="knopf ${ich ? "bereit" : ""}" id="bereit">${text}${da.length > 1 ? ` · ${n}/${da.length}` : ""}</button>
    ${nichtWarten ? `<button class="knopf zweit klein" id="erzwingen" style="background:var(--glas)">Nicht warten</button>` : ""}</div>`;
}
function panelHtml() {
  if (ui.menue) return menuePanel();
  if (S.phase === "bericht") return berichtPanel();
  if (S.phase === "ende") return endePanel();
  if (ui.modus === "bauen") return bauPanel();
  if (ui.modus === "zuege") return zugPanel();
  if (ui.modus === "bilanz") return bilanzPanel();
  if (ui.modus === "auftraege") return auftragPanel();
  if (ui.ereignis && S.ereignis) return `<div class="panel"><div class="kopf"><h3>⚡ ${esc(S.ereignis.titel)}</h3><button class="zu" id="ereigniszu" aria-label="Schließen">✕</button></div><p class="klein">${esc(S.ereignis.text)}</p></div>`;
  if (ui.info !== null) return infoPanel(ui.info);
  if (S.monat === 1 && !Object.keys(S.gleise).length && !ui.willkommenZu) return `<div class="panel kompakt"><div class="kopf"><h3>Willkommen, Gleisgenossen!</h3><button class="zu" id="willkommenzu" aria-label="Schließen">✕</button></div><p class="leise klein">Feld antippen zeigt Infos. Ein Finger verschiebt, zwei Finger zoomen und drehen. Los geht es mit „Gleis bauen“.</p></div>`;
  return "";
}
function infoPanel(i) {
  const K = S.karte, t = K.g[i], o = G.ortBei(S, i), deko = K.orte.find(x => x.deko.includes(i));
  const zeilen = [];
  let titel = G.GELAENDE[t].name;
  if (o) {
    titel = o.name;
    if (o.typ === "stadt") {
      zeilen.push(`${["", "Kleiner Ort", "Ort", "Stadt", "Großstadt"][o.groesse]}: etwa ${Math.round(G.produktion(o, S) * (.7 + .1 * S.ruf))} Fahrgäste pro Monat (je nach Ruf).`);
      const n = G.WACHSTUM[o.groesse];
      zeilen.push(n ? `Wächst mit Brettern: ${S.wachstum[o.id] || 0} / ${n}.` : "Größer geht es nicht.");
      zeilen.push("Kohle, die hierher kommt, geht ins Kohlenlager für eure Loks.");
    } else if (o.typ === "saegewerk") zeilen.push(`Nimmt Holz an und macht daraus Bretter für den nächsten Monat. Bretter bereit: ${S.bretter[o.id] || 0}.`);
    else if (o.typ === "kraftwerk") zeilen.push("Kauft Kohle, so viel ihr bringt. Je weiter der Weg, desto mehr Geld.");
    else zeilen.push(`Liefert ${G.produktion(o, S)} ${ladungName(G.ORTE[o.typ].liefert[0])} pro Monat.`);
    zeilen.push(S.bahnhoefe.includes(i) ? "Bahnhof vorhanden." : `Noch kein Bahnhof. Er entsteht, sobald ein Gleis hierher führt (${G.BAHNHOF} T).`);
    const zuege = S.zuege.filter(z => z.linie.includes(i));
    if (zuege.length) zeilen.push("Hier halten: " + zuege.map(z => "Zug " + z.nr).join(", "));
  } else if (deko) zeilen.push(`Gehört zu ${esc(deko.name)}. Hier kann kein Gleis hin.`);
  else zeilen.push(`Gleisbau über dieses Feld: etwa ${G.GELAENDE[t].kosten} T${t === "~" ? " (Brücke)" : t === "b" ? " (Tunnel)" : ""}.`);
  if (G.imNetz(S, i) && !o) zeilen.push(G.nachbarn(S.karte, i).some(n => S.doppel[G.kante(i, n)]) ? "Hier liegt eine zweigleisige Strecke." : "Hier liegt ein Gleis (eingleisig).");
  const bauen = S.phase === "planen" && G.darfStarten(S, i);
  return `<div class="panel"><div class="kopf"><h3>${esc(titel)}</h3><button class="zu" id="infozu" aria-label="Schließen">✕</button></div>
    ${zeilen.map(z => `<p class="klein">${z}</p>`).join("")}
    ${bauen ? `<button class="knopf klein" id="vonhier">Von hier ein Gleis bauen</button>` : ""}</div>`;
}
function bauPanel() {
  const b = ui.bau, letzter = S.baulog[S.baulog.length - 1];
  const zurueck = letzter && letzter.monat === S.monat && letzter.pid === PID ? `<button class="link" id="rueckgaengig">${letzter.abriss ? `Letzten eigenen Abriss zurücknehmen (−${zahl(-letzter.kosten)} T)` : `Letzten eigenen Bau zurücknehmen (+${zahl(letzter.kosten)} T)`}</button>` : "";
  const art = `<div class="wahl"><button data-bauart="neu" class="${ui.ausbau || ui.abriss ? "" : "an"}">Neues Gleis</button><button data-bauart="ausbau" class="${ui.ausbau ? "an" : ""}">Zweigleisig</button><button data-bauart="abriss" class="${ui.abriss ? "an" : ""}">Abreißen</button></div>`;
  if (!b.length) return `<div class="panel"><div class="kopf"><h3>Gleis bauen</h3><button class="zu" id="modzu" aria-label="Schließen">✕</button></div>
    ${art}
    <p class="klein">${ui.abriss ? "Tippe auf den <b>Anfang</b> des Gleisstücks, das weg soll, dann auf das Ende. Ihr bekommt 40 % der Baukosten zurück und spart die Wartung. Bahnhöfe ohne Gleis verschwinden mit. Strecken, über die ein Zug fährt, bleiben stehen." : ui.ausbau ? "Tippe auf den <b>Anfang</b> eines vorhandenen Gleises, dann auf das Ende. Zweigleisige Strecken teilen sich Züge ohne Warten, jede Richtung hat ihr eigenes Gleis. Kosten: 60 % vom Neubau." : "Tippe auf den <b>Start</b>: einen Ort, eine Zeche, ein Werk oder ein vorhandenes Gleis."}</p>${zurueck}</div>`;
  if (ui.abriss) {
    if (b.length === 1) return `<div class="panel kompakt"><div class="kopf"><h3>Abriss ab ${esc(ortName(b[0]) === "Feld" ? "hier" : ortName(b[0]))}</h3><button class="zu" id="bauweg" aria-label="Verwerfen">✕</button></div><p class="klein">Tippe auf das <b>Ende</b> des Abschnitts, der abgerissen werden soll.</p></div>`;
    const a = G.abrissWert(S, b), sperre = a.fehler || a.zug;
    const teile = a.fehler ? [] : [`${a.kanten.length} Gleisstücke${a.doppel.length ? `, davon ${a.doppel.length} zweigleisig` : ""}`].concat(a.bahnhoefe.map(z => "Bahnhof " + ortName(z)));
    return `<div class="panel kompakt"><div class="kopf"><h3>Abriss: ${esc(ortName(b[0]) === "Feld" ? "Gleis" : ortName(b[0]))} → ${esc(ortName(b[b.length - 1]) === "Feld" ? "Gleis" : ortName(b[b.length - 1]))}</h3><button class="zu" id="bauweg" aria-label="Verwerfen">✕</button></div>
      <p class="leise klein">${a.fehler ? `<span class="warn">${esc(a.fehler)}</span>` : esc(teile.join(" · ")) + (a.zug ? ` · <span class="warn">${esc(a.zug)} fährt hier. Erst seine Linie ändern oder ihn verkaufen.</span>` : "")}</p>
      <button class="knopf" id="abreissen" ${sperre ? "disabled" : ""}>Abreißen · +${zahl(a.erloes || 0)} T</button></div>`;
  }
  if (ui.ausbau) {
    if (b.length === 1) return `<div class="panel kompakt"><div class="kopf"><h3>Ausbau ab ${esc(ortName(b[0]) === "Feld" ? "hier" : ortName(b[0]))}</h3><button class="zu" id="bauweg" aria-label="Verwerfen">✕</button></div><p class="klein">Tippe auf das <b>Ende</b> des Abschnitts, der zweigleisig werden soll.</p></div>`;
    const a = G.ausbauKosten(S, b), teuer = !a.fehler && a.kosten > S.kasse;
    return `<div class="panel kompakt"><div class="kopf"><h3>Ausbau: ${esc(ortName(b[0]) === "Feld" ? "Gleis" : ortName(b[0]))} → ${esc(ortName(b[b.length - 1]) === "Feld" ? "Gleis" : ortName(b[b.length - 1]))}</h3><button class="zu" id="bauweg" aria-label="Verwerfen">✕</button></div>
      <p class="leise klein">${a.fehler ? `<span class="warn">${esc(a.fehler)}</span>` : a.kanten.length ? `${a.kanten.length} Gleisstücke werden zweigleisig${teuer ? ` · <span class="warn">Kasse reicht nicht</span>` : ""}` : "Hier ist schon alles zweigleisig."}</p>
      <button class="knopf" id="ausbauen" ${a.fehler || teuer || !a.kanten.length ? "disabled" : ""}>Ausbauen · ${zahl(a.kosten || 0)} T</button></div>`;
  }
  if (b.length === 1) return `<div class="panel kompakt"><div class="kopf"><h3>Start: ${esc(ortName(b[0]) === "Feld" ? "Gleis" : ortName(b[0]))}</h3><button class="zu" id="bauweg" aria-label="Verwerfen">✕</button></div>
    <p class="klein">Tippe jetzt auf das <b>Ziel</b>. Der günstigste Weg wird vorgeschlagen. Weitere Felder verlängern ihn.</p><button class="schalterchip ${ui.bauNeu ? "an" : ""}" id="bauneu" aria-pressed="${!!ui.bauNeu}">${ui.bauNeu ? "✓ " : ""}Neue Trasse (nicht über vorhandene Gleise, z. B. für einen Kreis)</button></div>`;
  const k = G.pfadKosten(S, b);
  if (k.fehler) return `<div class="panel"><p class="warn">${esc(k.fehler)}</p><button class="knopf zweit klein" id="bauweg">Verwerfen</button></div>`;
  const gleis = k.kosten - k.bahnhoefe.length * G.BAHNHOF, teuer = k.kosten > S.kasse;
  const gel = {}; for (let i = 1; i < b.length; i++) if (!S.gleise[G.kante(b[i - 1], b[i])]) { const t = S.karte.g[b[i]]; gel[t] = (gel[t] || 0) + 1; }
  const arten = Object.entries(gel).map(([t, n]) => `${n}× ${t === "~" ? "Brücke" : t === "b" ? "Tunnel" : G.GELAENDE[t].name}`).join(", ");
  const teile = [`${k.kanten.length} Gleisstücke${arten ? " (" + arten + ")" : ""}`].concat(k.bahnhoefe.map(z => "Bahnhof " + ortName(z)));
  return `<div class="panel kompakt"><div class="kopf"><h3>${esc(ortName(b[0]) === "Feld" ? "Gleis" : ortName(b[0]))} → ${esc(ortName(b[b.length - 1]))}</h3><button class="zu" id="bauweg" aria-label="Verwerfen">✕</button></div>
    <p class="leise klein">${esc(teile.join(" · "))}${teuer ? ` · <span class="warn">Kasse reicht nicht</span>` : ""}</p>
    <button class="schalterchip ${ui.bauNeu ? "an" : ""}" id="bauneu" aria-pressed="${!!ui.bauNeu}">${ui.bauNeu ? "✓ " : ""}Neue Trasse (nicht über vorhandene Gleise, z. B. für einen Kreis)</button>
    <button class="knopf" id="bauen" ${teuer || (!k.kanten.length && !k.bahnhoefe.length) ? "disabled" : ""}>Bauen · ${zahl(k.kosten)} T</button></div>`;
}
function lokText(l) { const L = G.LOKS[l]; return `<b>${L.name}</b>${zahl(L.preis)} T · ${L.tempo} Felder/Tag<br>${L.wagen} Wagen (${L.wagen * G.WAGEN_PLATZ} Plätze)<br>Betrieb ${L.betrieb} T + ${L.kohle} Kohle/Monat`; }
function linieText(z) { const n = z.linie.map(ortName).map(esc); return z.rund ? "↻ Rundkurs: " + n.join(" → ") + " → " + n[0] : n.join(" ⇄ "); }
const halteChips = f => `<div class="halte">${f.linie.map((z, k) => `<span>${k + 1} ${esc(ortName(z))}</span>`).join("")}${f.rund ? `<span class="kreis">↻ zurück nach ${esc(ortName(f.linie[0]))}</span>` : ""}</div>`;
function zugPanel() {
  const f = ui.zug;
  if (f) {
    const ok = f.linie.length >= 2 ? G.linieOk(S, f.linie, f.rund) : { fehler: "" };
    const info = ok.ok ? G.linieInfo(S, f.linie, f.ladung) : null;
    const zug = f.id ? S.zuege.find(z => z.id === f.id) : null;
    const preis = zug ? 0 : G.LOKS[f.lok].preis, teuer = preis > S.kasse;
    const kaufen = `<button class="knopf" id="zugok" ${ok.ok && !teuer ? "" : "disabled"}>${zug ? "Linie speichern" : `Kaufen · ${zahl(preis)} T`}</button>`;
    if (!f.offen) return `<div class="panel kompakt"><div class="kopf"><h3>${zug ? `Zug ${zug.nr}` : G.LOKS[f.lok].name} · ${ladungName(f.ladung)}</h3><button class="link" id="zugwahl" style="padding:0 6px">ändern</button><button class="zu" id="formzu" aria-label="Abbrechen">✕</button></div>
      ${f.linie.length ? halteChips(f) : `<p class="klein">Tippe die <b>Bahnhöfe</b> der Reihe nach an (weiß umrandet).</p>`}
      ${ok.fehler ? `<p class="warn klein">${esc(ok.fehler)}</p>` : info ? `<p class="klein ${info.ok ? "leise" : "warn"}">${esc(info.text)}</p>` : f.linie.length === 1 ? `<p class="leise klein">Jetzt den nächsten Bahnhof antippen. Den letzten nochmal antippen nimmt ihn heraus.</p>` : ""}
      ${f.linie.length >= 2 && !f.rund && !ok.fehler ? `<p class="leise klein">${f.linie.length >= 2 && G.linienWeg(S, f.linie, null, true) ? "Tipp: Ersten Bahnhof nochmal antippen = Rundkurs, der Zug fährt im Kreis statt hin und her." : "Pendelzug: fährt hin und her. Für einen Rundkurs braucht es einen Gleiskreis zurück zum Start."}</p>` : ""}
      ${teuer ? `<p class="warn klein">Dafür reicht die Kasse nicht.</p>` : ""}
      ${kaufen}</div>`;
    return `<div class="panel"><div class="kopf"><h3>${zug ? `Zug ${zug.nr}: neue Linie` : "Neuer Zug"}</h3><button class="zu" id="formzu" aria-label="Abbrechen">✕</button></div>
      ${zug ? "" : `<div class="lokwahl">${Object.keys(G.LOKS).map(l => `<button data-lok="${l}" class="${f.lok === l ? "an" : ""}">${lokText(l)}</button>`).join("")}</div>`}
      <div class="wahl">${Object.keys(G.LADUNG).map(l => `<button data-ladung="${l}" class="${f.ladung === l ? "an" : ""}">${ladungName(l)}</button>`).join("")}</div>
      ${S.bahnhoefe.length < 2 ? `<p class="warn klein">Es gibt noch keine zwei Bahnhöfe. Baut zuerst ein Gleis zwischen zwei Orten.</p>` :
        `<p class="klein">Tippe die <b>Bahnhöfe</b> der Reihe nach auf der Karte an (weiß umrandet).</p>`}
      ${f.linie.length ? `${halteChips(f)}<button class="link" id="halteweg" style="align-self:flex-start;padding:0">Letzten Halt entfernen</button>` : ""}
      ${ok.fehler ? `<p class="warn klein">${esc(ok.fehler)}</p>` : ""}
      ${info ? `<p class="klein ${info.ok ? "" : "warn"}">${esc(info.text)}</p>` : ""}
      ${teuer ? `<p class="warn klein">Dafür reicht die Kasse nicht.</p>` : ""}
      <div class="aktion"><button class="knopf" id="halteweiter">Weiter: Bahnhöfe auf der Karte antippen</button></div></div>`;
  }
  const beh = G.behinderung(S);
  return `<div class="panel"><div class="kopf"><h3>Züge (${S.zuege.length})</h3><button class="zu" id="modzu" aria-label="Schließen">✕</button></div>
    ${S.zuege.length ? `<div class="zuglist">${S.zuege.map(z => {
      const L = G.LOKS[z.lok], e = z.letzter, st = beh[z.id] || 1;
      return `<div class="zugkarte"><div class="titel2"><i class="farbe" style="background:${z.farbe}"></i>Zug ${z.nr} · ${L.name} · ${ladungName(z.ladung)}</div>
        <div class="klein leise">${linieText(z)}</div>
        ${st > 1.04 ? `<div class="klein warn">Teilt eingleisige Strecken mit anderen Zügen: etwa −${Math.round((1 - 1 / st) * 100)} % Fahrten. Zweigleisig ausbauen hilft.</div>` : ""}
        ${e ? `<div class="klein">Letzter Monat: ${e.menge} ${ladungName(z.ladung)} · <span class="plus">+${zahl(e.einnahmen)} T</span>${e.hinweis ? ` · <span class="warn">${esc(e.hinweis)}</span>` : ""}</div>` : `<div class="klein leise">Fährt ab diesem Monat.</div>`}
        <div class="knoepfe"><button data-zeigen="${z.id}">Auf Karte</button><button data-linie="${z.id}">Linie ändern</button><button data-verkaufen="${z.id}">Verkaufen +${zahl(G.zugWert(S, z))} T</button></div></div>`;
    }).join("")}</div>` : `<p class="leise klein">Noch keine Züge. Ein Zug braucht eine Linie aus mindestens zwei Bahnhöfen.</p>`}
    <div class="aktion"><button class="knopf" id="neuerzug">Neuen Zug kaufen</button></div></div>`;
}
function berichtZeilen(b) {
  const k = b.kohle || { kosten: 0 };
  return `${(b.auftraege || []).filter(a => a.ok).map(a => `<div class="zeile"><span>✓ Auftrag ${esc(auftragText(a))}</span><span class="plus">+${zahl(a.belohnung)}</span></div>`).join("")}
    ${b.zuege.map(e => { const z = S.zuege.find(x => x.id === e.id); return `<div class="zeile"><span>${z ? `<i class="farbe" style="background:${z.farbe}"></i> Zug ${z.nr}: ${e.menge} ${ladungName(z.ladung)}` : "Verkaufter Zug"}${e.hinweis ? ` <span class="warn">· ${esc(e.hinweis)}</span>` : ""}</span><span class="plus">+${zahl(e.einnahmen)}</span></div>`; }).join("")}
    <div class="zeile"><span>Betrieb der Züge</span><span class="minus">−${zahl(b.betrieb)}</span></div>
    <div class="zeile"><span>Wartung von Gleisen und Bahnhöfen</span><span class="minus">−${zahl(b.wartung)}</span></div>
    ${k.bedarf ? `<div class="zeile"><span>Kohle für die Loks: ${k.ausLager} aus dem Lager${k.zukauf ? `, ${k.zukauf} zugekauft (je ${k.preis} T)` : ""}</span><span class="minus">−${zahl(k.kosten)}</span></div>` : ""}
    ${b.zinsen ? `<div class="zeile"><span>Zinsen für den Kredit</span><span class="minus">−${zahl(b.zinsen)}</span></div>` : ""}
    <div class="zeile"><b>Kasse</b><b>${zahl(b.kasse)} T</b></div>`;
}
function berichtPanel() {
  const b = S.bericht, h = S.historie[S.historie.length - 1] || { einnahmen: 0, kosten: 0 }, saldo = h.einnahmen - h.kosten;
  const verpasst = (b.auftraege || []).filter(a => !a.ok), erfuellt = (b.auftraege || []).filter(a => a.ok);
  const ev = S.naechstes;
  return `<div class="panel"><h3>Abrechnung Monat ${b.monat}: <span class="${saldo >= 0 ? "plus" : "minus"}">${saldo >= 0 ? "+" : "−"}${zahl(Math.abs(saldo))} T</span></h3>
    ${erfuellt.length ? `<p class="klein plus">Auftrag erfüllt! Ruf steigt.</p>` : ""}
    ${verpasst.map(a => `<p class="klein warn">✗ Auftrag verpasst: ${esc(auftragText(a))} (${a.stand}/${a.menge}). Ruf sinkt.</p>`).join("")}
    ${(b.gewachsen || []).map(id => `<p class="klein plus">🏠 ${esc(S.karte.orte[id].name)} ist gewachsen und hat jetzt mehr Fahrgäste.</p>`).join("")}
    ${b.zuege.length ? "" : `<p class="leise klein">Noch kein Zug unterwegs, nur Wartungskosten.</p>`}${berichtZeilen(b)}
    <div class="zeile"><span>Kohlenlager</span><span>${b.kohle ? b.kohle.lager : S.lager} Kohle</span></div>
    ${ev ? `<div class="karteEreignis"><small>Nächster Monat</small><b>${esc(ev.titel)}</b><span>${esc(ev.text)}</span></div>` : ""}
    ${S.angebote.length && S.phase === "bericht" ? `<p class="leise klein">📜 ${S.angebote.length} neue Auftragsangebote warten.</p>` : ""}</div>`;
}
const auftragText = a => `${a.menge} ${ladungName(a.ladung)} ${a.ladung === "fahrgaeste" ? "nach" : a.ladung === "bretter" ? "nach" : "zum"} ${S.karte.orte[a.ort].name}`;
function auftragPanel() {
  const voll = S.auftraege.length >= G.MAX_AUFTRAEGE;
  const karte = (a, aktiv) => `<div class="zugkarte"><div class="titel2">${esc(auftragText(a))}</div>
    <div class="klein leise">Bis Ende Monat ${a.frist}${aktiv ? ` · noch ${a.frist - S.monat + 1} ${a.frist - S.monat + 1 === 1 ? "Monat" : "Monate"}` : ""} · Belohnung <span class="plus">${zahl(a.belohnung)} T</span> und Ruf +1</div>
    ${aktiv ? `<div class="balken"><i style="width:${Math.round(a.stand / a.menge * 100)}%"></i></div><div class="klein">${a.stand} / ${a.menge} geliefert</div>`
      : `<div class="knoepfe"><button data-annehmen="${a.id}" ${voll ? "disabled" : ""}>Annehmen</button><button data-zeigen-ort="${a.ort}">Auf Karte</button></div>`}</div>`;
  return `<div class="panel"><div class="kopf"><h3>Aufträge</h3><button class="zu" id="modzu" aria-label="Schließen">✕</button></div>
    <p class="leise klein">Ruf ${rufSterne(S.ruf)}: Mehr Ruf bringt mehr Fahrgäste und mehr Kredit. Verpasste Aufträge kosten einen Stern, bei null Sternen ist das Spiel verloren.</p>
    ${S.auftraege.length ? `<p class="etikett">Angenommen (${S.auftraege.length}/${G.MAX_AUFTRAEGE})</p><div class="zuglist">${S.auftraege.map(a => karte(a, true)).join("")}</div>` : ""}
    <p class="etikett">Angebote</p>
    ${S.angebote.length ? `<div class="zuglist">${S.angebote.map(a => karte(a, false)).join("")}</div><p class="leise klein">Nicht angenommene Angebote verfallen am Monatsende.</p>` : `<p class="leise klein">Im Moment keine neuen Angebote. Nächsten Monat kommen neue.</p>`}</div>`;
}
function bilanzPanel() {
  const h = S.historie, b = S.bericht, gr = G.sterneGrenzen(S), w = G.wert(S);
  const rahmen = G.kreditRahmen(S), bedarf = S.zuege.reduce((a, z) => a + G.LOKS[z.lok].kohle, 0);
  return `<div class="panel"><div class="kopf"><h3>Kasse</h3><button class="zu" id="modzu" aria-label="Schließen">✕</button></div>
    <div class="zeile"><span>Kredit (${Math.round(G.ZINS * 100)} % Zinsen pro Monat)</span><b>${zahl(S.kredit)} T</b></div>
    <div class="reihe"><button class="knopf zweit klein" id="leihen" ${S.kredit + G.KREDIT_SCHRITT > rahmen ? "disabled" : ""}>+${zahl(G.KREDIT_SCHRITT)} T leihen</button><button class="knopf zweit klein" id="tilgen" ${!S.kredit || S.kasse < Math.min(G.KREDIT_SCHRITT, S.kredit) ? "disabled" : ""}>${zahl(Math.min(G.KREDIT_SCHRITT, S.kredit || G.KREDIT_SCHRITT))} T zurückzahlen</button></div>
    <p class="leise klein">Die Bank leiht bei eurem Ruf bis zu ${zahl(rahmen)} T.</p>
    <div class="zeile"><span>Kohlenlager (für eure Loks)</span><b>${S.lager} / ${G.LAGER_MAX}</b></div>
    <p class="leise klein">Eure Loks brauchen ${bedarf} Kohle im Monat. Fehlt sie im Lager, wird sie für ${G.KOHLE_PREIS} T pro Stück zugekauft. Kohle in einen Ort bringen füllt das Lager.</p>
    <div class="zeile"><span>Wert der Genossenschaft (Kasse − Kredit + halber Zugwert)</span><b>${zahl(w)} T</b></div>
    <p class="leise klein">Ziel nach ${S.monate} Monaten: ★ ${zahl(gr[0])} · ★★ ${zahl(gr[1])} · ★★★ ${zahl(gr[2])} T</p>
    <div class="balken"><i style="width:${Math.min(100, Math.max(0, w / gr[2] * 100))}%"></i></div>
    ${b ? `<p class="etikett">Letzter Monat</p>${berichtZeilen(b)}` : `<p class="leise klein">Die erste Abrechnung kommt am Ende dieses Monats.</p>`}
    ${h.length > 1 ? `<p class="etikett">Verlauf</p>${h.map(x => `<div class="zeile"><span>Monat ${x.monat}</span><span><span class="plus">+${zahl(x.einnahmen)}</span> <span class="minus">−${zahl(x.kosten)}</span> → ${zahl(x.kasse)} T</span></div>`).join("")}` : ""}</div>`;
}
function endePanel() {
  const e = S.ergebnis || {}, host = rolle === "host";
  const sterne = [0, 1, 2].map(i => `<span class="${i < e.sterne ? "" : "aus"}">★</span>`).join("");
  return `<div class="panel"><h3>${e.grund === "ruf" ? "Der Ruf ist ruiniert." : e.pleite ? "Die Genossenschaft ist pleite." : "Geschafft!"}</h3>
    <div class="sterne">${sterne}</div>
    <div class="zeile"><span>Wert der Genossenschaft</span><b>${zahl(e.wert)} T</b></div>
    <p class="leise klein">${e.grund === "ruf" ? "Zu viele Aufträge verpasst, niemand will mehr mit euch fahren." : e.pleite ? "Die Kasse ist ins Minus gerutscht. Nächstes Mal vorsichtiger bauen oder rechtzeitig einen Kredit aufnehmen!" : `Sterne ab ${(e.grenzen || []).map(zahl).join(" / ")} T. ${S.zuege.length} Züge, ${Object.keys(S.gleise).length} Gleisstücke, ${S.bahnhoefe.length} Bahnhöfe.`}</p>
    ${S.bericht ? `<p class="etikett">Letzte Abrechnung</p>${berichtZeilen(S.bericht)}` : ""}
    ${host ? `<button class="knopf" id="nochmal">Neues Spiel</button>` : `<p class="leise klein mitte">${esc(sp(S.host).name)} kann ein neues Spiel starten.</p>`}</div>`;
}
function menuePanel() {
  const da = S.reihenfolge.filter(p => S.spieler[p]);
  return `<div class="panel"><div class="kopf"><h3>Raum ${esc(code)}</h3><button class="zu" id="menuezu" aria-label="Schließen">✕</button></div>
    <div class="mitglieder">${da.map(p => `<span class="${S.bereit[p] ? "ok" : ""}"><i class="punkt ${online(p) ? "an" : ""}"></i>${esc(sp(p).name)}${p === PID ? " (du)" : ""}${S.bereit[p] ? " ✓" : ""}</span>`).join("")}</div>
    <div class="reihe"><button class="knopf zweit klein" id="teilen">Einladen</button><button class="knopf zweit klein" id="kopieren">Link kopieren</button></div>
    ${rolle === "host" ? `<button class="knopf zweit klein" id="abbrechen">Spiel beenden, zurück zur Lobby</button>` : ""}
    <button class="link" id="verlassen">Raum verlassen</button></div>`;
}

// ---------- Tippen auf die Karte ----------
function feldGetippt(i) {
  if (!S || !S.karte) return;
  if (ui.menue) { ui.menue = false; render(); return; }
  if (S.phase !== "planen") return;
  if (ui.modus === "bauen") return bauTippen(i);
  if (ui.modus === "zuege" && ui.zug) return halteTippen(i);
  ui.modus = "schauen";
  ui.info = ui.info === i ? null : i;
  render();
}
// Der Bauweg entsteht aus den angetippten Punkten; zwischen ihnen wird jeweils der günstigste Weg gesucht.
function bauBerechnen(punkte) {
  let p = [punkte[0]];
  for (let k = 1; k < punkte.length; k++) { const w = ui.ausbau || ui.abriss ? G.streckenWeg(S, p[p.length - 1], punkte[k]) : G.bauWeg(S, p[p.length - 1], punkte[k], ui.bauNeu); if (!w || w.length < 2) return null; p = p.concat(w.slice(1)); }
  return p;
}
function bauTippen(i) {
  const b = ui.bau;
  if (!b.length) {
    if ((ui.ausbau || ui.abriss) && !G.imNetz(S, i)) return zeigeHinweis(ui.abriss ? "Abreißen geht nur auf vorhandenen Gleisen." : "Ausbauen geht nur auf vorhandenen Gleisen.");
    if (!G.darfStarten(S, i)) return zeigeHinweis("Gleise beginnen an einem Ort, einer Zeche, einem Werk oder einem vorhandenen Gleis.");
    ui.bau = [i]; ui.bauP = [i];
  } else {
    const k = b.indexOf(i);
    if (k >= 0) {
      const P = (ui.bauP || [b[0]]).filter(x => b.indexOf(x) >= 0 && b.indexOf(x) <= k);
      if (P[P.length - 1] !== i) P.push(i);
      ui.bauP = P; ui.bau = bauBerechnen(P) || b.slice(0, k + 1);
    } else {
      const P = (ui.bauP || [b[0]]).concat(i), p = bauBerechnen(P);
      if (!p) return zeigeHinweis(ui.ausbau || ui.abriss ? "Dorthin führt kein vorhandenes Gleis." : S.karte.g[i] === "x" ? "Bebaute Felder bleiben frei." : ui.bauNeu ? "Ohne vorhandene Gleise kommt man dort nicht hin." : "Dorthin kann kein Gleis führen.");
      ui.bauP = P; ui.bau = p;
    }
  }
  render();
}
function halteTippen(i) {
  const f = ui.zug;
  if (!S.bahnhoefe.includes(i)) return zeigeHinweis(G.ortBei(S, i) ? "Hier gibt es noch keinen Bahnhof. Erst ein Gleis hierher bauen." : "Halte sind nur an Bahnhöfen möglich.");
  f.offen = false;
  // ersten Bahnhof nochmal antippen schließt den Kreis (oder öffnet ihn wieder)
  if (f.rund) { if (i === f.linie[0]) { f.rund = false; render(); return; } return zeigeHinweis("Der Rundkurs ist geschlossen. Ersten Bahnhof antippen öffnet ihn wieder."); }
  if (f.linie.length >= 2 && i === f.linie[0]) {
    if (G.linienWeg(S, f.linie, null, true)) { f.rund = true; render(); return; }
    return zeigeHinweis("Für einen Rundkurs muss ein zweites Gleis zurück nach " + ortName(i) + " führen.");
  }
  if (f.linie[f.linie.length - 1] === i) { f.linie.pop(); render(); return; }
  if (f.linie.length >= G.MAX_HALTE) return zeigeHinweis("Höchstens " + G.MAX_HALTE + " Halte.");
  f.linie.push(i);
  if (f.linie.length >= 2 && !G.linienWeg(S, f.linie)) { f.linie.pop(); return zeigeHinweis("Zwischen diesen Bahnhöfen gibt es keine Gleisverbindung."); }
  render();
}

function hudBinden() {
  const $ = id => document.getElementById(id), an = (id, f) => { const e = $(id); if (e) e.onclick = f; };
  an("uebernehmen", uebernehmen);
  an("kamera", () => welt && welt.uebersicht(true));
  an("menue", () => { ui.menue = !ui.menue; render(); });
  an("menuezu", () => { ui.menue = false; render(); });
  an("teilen", teilen); an("kopieren", kopieren);
  an("verlassen", () => { if (confirm("Raum wirklich verlassen?")) verlassen(); });
  an("abbrechen", () => { if (confirm("Spiel für alle beenden und zurück in die Lobby?")) { ui.menue = false; tun({ t: "neustart" }); } });
  an("bereit", () => tun({ t: "bereit", wert: !S.bereit[PID] }));
  an("erzwingen", () => tun({ t: "erzwingen" }));
  an("nochmal", () => tun({ t: "neustart" }));
  document.querySelectorAll("[data-modus]").forEach(b => b.onclick = () => {
    const m = b.dataset.modus; ui.modus = ui.modus === m ? "schauen" : m; ui.info = null; ui.zug = null; ui.bau = []; ui.ereignis = false; render();
  });
  an("modzu", () => { ui.modus = "schauen"; ui.bau = []; ui.zug = null; render(); });
  an("infozu", () => { ui.info = null; render(); });
  an("willkommenzu", () => { ui.willkommenZu = true; render(); });
  an("vonhier", () => { ui.modus = "bauen"; ui.bau = [ui.info]; ui.bauP = [ui.info]; ui.info = null; render(); });
  an("bauneu", () => {
    ui.bauNeu = !ui.bauNeu;
    if (ui.bauP && ui.bauP.length > 1) { const p = bauBerechnen(ui.bauP); if (p) ui.bau = p; else { ui.bauNeu = !ui.bauNeu; zeigeHinweis("Ohne vorhandene Gleise geht dieser Weg nicht."); return; } }
    render();
  });
  an("bauweg", () => { ui.bau = []; render(); }); an("bauweg2", () => { ui.bau = []; render(); });
  an("ausbauen", () => { const p = ui.bau; ui.bau = []; ui.bauP = []; tun({ t: "ausbauen", pfad: p }); render(); });
  document.querySelectorAll("[data-bauart]").forEach(b => b.onclick = () => { ui.ausbau = b.dataset.bauart === "ausbau"; ui.abriss = b.dataset.bauart === "abriss"; ui.bau = []; ui.bauP = []; render(); });
  an("abreissen", () => { const p = ui.bau; ui.bau = []; ui.bauP = []; tun({ t: "abreissen", pfad: p }); render(); });
  an("bauen", () => { const p = ui.bau; ui.bau = []; tun({ t: "bauen", pfad: p }); render(); });
  an("rueckgaengig", () => tun({ t: "rueckgaengig" }));
  an("leihen", () => tun({ t: "kredit" }));
  an("tilgen", () => tun({ t: "tilgen" }));
  an("ereignisknopf", () => { ui.ereignis = !ui.ereignis; ui.modus = "schauen"; ui.info = null; render(); });
  an("ereigniszu", () => { ui.ereignis = false; render(); });
  document.querySelectorAll("[data-annehmen]").forEach(b => b.onclick = () => tun({ t: "annehmen", id: b.dataset.annehmen }));
  document.querySelectorAll("[data-zeigen-ort]").forEach(b => b.onclick = () => { const o = S.karte.orte[+b.dataset.zeigenOrt]; if (o && welt) welt.hinfliegen(o.zelle); });
  an("neuerzug", () => { ui.zug = { lok: "feld", ladung: "fahrgaeste", linie: [], id: null, offen: true }; render(); });
  an("zugwahl", () => { ui.zug.offen = true; render(); });
  an("halteweiter", () => { ui.zug.offen = false; render(); });
  an("formzu", () => { ui.zug = null; render(); });
  an("halteweg", () => { if (ui.zug.rund) ui.zug.rund = false; else ui.zug.linie.pop(); render(); });
  an("zugok", () => {
    const f = ui.zug; ui.zug = null;
    tun(f.id ? { t: "linie", id: f.id, linie: f.linie, rund: !!f.rund, ladung: f.ladung } : { t: "zugKaufen", lok: f.lok, ladung: f.ladung, linie: f.linie, rund: !!f.rund });
    render();
  });
  document.querySelectorAll("[data-lok]").forEach(b => b.onclick = () => { ui.zug.lok = b.dataset.lok; render(); });
  document.querySelectorAll("[data-ladung]").forEach(b => b.onclick = () => { ui.zug.ladung = b.dataset.ladung; render(); });
  document.querySelectorAll("[data-linie]").forEach(b => b.onclick = () => { const z = S.zuege.find(x => x.id === b.dataset.linie); ui.zug = { lok: z.lok, ladung: z.ladung, linie: [], id: z.id, offen: false }; render(); });
  document.querySelectorAll("[data-verkaufen]").forEach(b => b.onclick = () => { const z = S.zuege.find(x => x.id === b.dataset.verkaufen); if (confirm(`Zug ${z.nr} für ${zahl(G.zugWert(S, z))} T verkaufen?`)) tun({ t: "verkaufen", id: z.id }); });
  document.querySelectorAll("[data-zeigen]").forEach(b => b.onclick = () => { const z = S.zuege.find(x => x.id === b.dataset.zeigen); if (z && welt) welt.hinfliegen(z.linie[0]); });
}

// ---------- Lobby ----------
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
  if ($("teilen")) $("teilen").onclick = teilen;
  if ($("kopieren")) $("kopieren").onclick = kopieren;
  if ($("start")) $("start").onclick = () => tun({ t: "start", anzahl: anwesend().length });
  if ($("verlassen")) $("verlassen").onclick = verlassen;
  document.querySelectorAll("[data-monate]").forEach(b => b.onclick = () => tun({ t: "einstellungen", monate: +b.dataset.monate }));
}
function teilen() { if (navigator.share) navigator.share({ title: "Gleisgenossen", text: "Bau mit uns Strecken! Raum " + code, url: link() }).catch(() => {}); else kopieren(); }
function kopieren() {
  const b = document.getElementById("kopieren");
  const fertig = () => { if (b) { b.textContent = "Kopiert"; setTimeout(() => { b.textContent = "Link kopieren"; }, 1500); } };
  try { navigator.clipboard.writeText(link()).then(fertig, () => prompt("Link kopieren:", link())); } catch (e) { prompt("Link kopieren:", link()); }
}

// ---------- Start ----------
if (typeof Peer === "undefined") app.innerHTML = `<div class="mitte"><p>Die Verbindungsbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.</p></div>`;
else if (code) {
  const gespeichert = ls.get("gg:host:" + code);
  if (gespeichert) fortsetzenAlsHost(gespeichert);
  else if (name) clientStarten();
  else render();
} else render();
window.__gg = { get S() { return S; }, get rolle() { return rolle; }, get verbunden() { return verbunden; }, get welt() { return welt; }, ui, PID, tun: params.get("test") ? tun : undefined, render };
