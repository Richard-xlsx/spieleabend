// Tapetenwechsel: Verbindung (Handy des Spielleiters ist der Server, PeerJS), Uhrabgleich, Bildschirme, 3D-Runde
// (Verstecken, Suchen, Zuschauen, Auflösung), Austausch der Verstecke, Blickrichtungen, Herzklopfen und Bots.
import * as THREE from "three";
import { neueWelt } from "./welt.js";
import { Klecks } from "./klecks.js";
import { versteckenStarten } from "./verstecken.js";
import { suchenStarten, markieren } from "./suchen.js";
import { aufloesungStarten } from "./aufloesung.js";
import { botVerstecken, tarnwert, neuerSucher, sucherSchritt, botPose } from "./bot.js";

const R = window.TW;
const K = window.TW_KLANG || { spiel() {}, an: false, umschalten() { return false; } };
const app = document.getElementById("app");
const PREFIX = "fmwtw-";
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
const FARBEN = ["#E4572E", "#2E86DE", "#F3B700", "#3BB273", "#8E5CC4", "#EC4E9B", "#17A2B8", "#8D6E63"];
const uhr = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

let PID = ls.get("slf:pid"); if (!PID) { PID = Math.random().toString(36).slice(2, 10); ls.set("slf:pid", PID); }
let name = ls.get("slf:name") || "";
let code = (params.get("raum") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
let rolle = null, S = null, peer = null, hostConn = null, verbunden = false, offlineSeit = null, fehlerText = "", offline = false;
const conns = new Map();
let retryTimer = null, token = 0, versuch = 0, hinweis = "", hinweisTimer = null, letztesHtml = "";

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
let beruehrt = false;
window.addEventListener("pointerdown", () => { beruehrt = true; }, { passive: true, once: true });
const brumm = muster => { try { if (beruehrt && navigator.vibrate && document.visibilityState === "visible") navigator.vibrate(muster); } catch (e) {} };

// ---------- Verstecke und Blicke (nicht im Zustand S, weil groß bzw. häufig) ----------
const V = {};            // V[nr][pid] = { d, bild, farben }
const blicke = {};       // pid → [x, y, z, yaw, pitch, fov]
const galerie = {};      // pid → [{ bild, h, k }] alle Kleckse des Abends
function versteckMerken(nr, pid, x) {
  (V[nr] = V[nr] || {})[pid] = x;
  const g = galerie[pid] = galerie[pid] || [];
  const i = g.findIndex(e => e.nr === nr); const e = { nr, bild: x.bild, h: x.d.h, k: x.d.k };
  if (i >= 0) g[i] = e; else g.push(e);
}

// ---------- Spielleiter ----------
function speichernHost() { if (!offline) ls.set("tw:host:" + code, S); }
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
function senden(c, m) { try { c.send(m); } catch (e) {} }
function versteckeSenden(c, nr) {
  const v = V[nr]; if (!v) return;
  for (const [pid, x] of Object.entries(v)) senden(c, { t: "versteck1", nr, pid, d: x.d, bild: x.bild });
}
function vonClient(c, m) {
  if (!m || !m.pid) return;
  if (m.t === "ping") { senden(c, { t: "pong", c: m.c, h: Date.now() }); return; }
  if (m.t === "blick") { blicke[m.pid] = m.b; return; }
  if (m.t === "versteck") { versteckAngekommen(m); return; }
  if (m.t === "hallo") conns.set(m.pid, c);
  const r = R.aktion(S, m.pid, m, Date.now());
  if (!r.ok && r.fehler && m.t !== "hallo") senden(c, { t: "fehler", text: r.fehler });
  if (m.t === "hallo" && S.r && (S.r.teil === "suchen" || S.r.teil === "aufloesung")) versteckeSenden(c, S.r.nr);
  if (m.t === "hallo" && S.r && S.r.teil === "verstecken" && V[S.r.nr] && V[S.r.nr][m.pid]) { const x = V[S.r.nr][m.pid]; senden(c, { t: "dein", nr: S.r.nr, d: x.d, bild: x.bild }); }
  if (r.ok || m.t === "hallo") geaendert();
}
function versteckAngekommen(m) {
  if (!S.r || m.nr !== S.r.nr) return;
  versteckMerken(m.nr, m.pid, { d: m.d, bild: m.bild, farben: m.farben });
  if (m.ende) { const r = R.aktion(S, PID, { t: "versteckt", pid: m.pid, farben: m.farben || 0 }, Date.now()); if (r.ok) geaendert(); }
  // Wer zu spät kommt (Suche läuft schon), wird noch an alle verteilt
  if (S.r.teil === "suchen" || S.r.teil === "aufloesung") for (const [, c] of conns) senden(c, { t: "versteck1", nr: m.nr, pid: m.pid, d: m.d, bild: m.bild });
  if (S.r.teil !== "verstecken") rundeAktualisieren();
}
let verteiltNr = null;
function geaendert() {
  S.online = [PID].concat([...conns.keys()]);
  speichernHost();
  if (S.r && S.r.teil === "suchen" && verteiltNr !== S.r.nr) {       // Suche beginnt: alle Verstecke an alle
    verteiltNr = S.r.nr;
    for (const [, c] of conns) versteckeSenden(c, S.r.nr);
  }
  for (const [pid, c] of conns) senden(c, { t: "zustand", s: R.sicht(S, pid) });
  render();
}
setInterval(() => { if (rolle === "host" && S && R.takt(S, Date.now())) geaendert(); }, 150);
// Blicke weiterreichen
setInterval(() => {
  if (rolle !== "host" || !S || !S.r || S.r.teil !== "suchen") return;
  for (const [, c] of conns) senden(c, { t: "blicke", d: blicke });
}, 110);

// ---------- Mitspieler ----------
function clientStarten() {
  rolle = "client";
  const k = ls.get("tw:kopie:" + code); if (k) S = k;
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
    if (m.t === "zustand") { S = m.s; ls.set("tw:kopie:" + code, S); render(); }
    else if (m.t === "versteck1") { versteckMerken(m.nr, m.pid, { d: m.d, bild: m.bild }); rundeAktualisieren(); }
    else if (m.t === "dein") { if (!eigenGespeichert(m.nr)) ls.set("tw:mein:" + code, { nr: m.nr, d: m.d, bild: m.bild }); }
    else if (m.t === "blicke") Object.assign(blicke, m.d);
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
  ls.del("tw:kopie:" + code); clearTimeout(retryTimer); token++;
  if (hostConn) { try { hostConn.close(); } catch (e) {} hostConn = null; }
  hostStarten(s);
}
function fortsetzenAlsHost(gespeichert) {
  rolle = "pruefen"; render();
  const probe = new Peer(undefined, PEER_OPT); let fertig = false;
  const ende = alsClient => {
    if (fertig) return; fertig = true; try { probe.destroy(); } catch (e) {}
    if (alsClient) { ls.del("tw:host:" + code); ls.set("tw:kopie:" + code, gespeichert); clientStarten(); }
    else { R.neustart(gespeichert, Date.now()); hostStarten(gespeichert); }
  };
  probe.on("open", () => { const c = probe.connect(hostId(gespeichert.epoch + 1), { serialization: "json" }); c.on("open", () => ende(true)); });
  probe.on("error", () => ende(false));
  setTimeout(() => ende(false), 4000);
}

// ---------- Aktionen ----------
function tun(m, leise) {
  if (rolle === "host") { const r = R.aktion(S, PID, m, Date.now()); if (r.ok) geaendert(); else if (r.fehler && !leise) zeigeHinweis(r.fehler); return r; }
  if (hostConn && hostConn.open) senden(hostConn, Object.assign({ pid: PID }, m));
  else if (!leise) zeigeHinweis("Keine Verbindung zum Spielleiter.");
}
function anHost(m) {           // Daten, die nicht über die Spiellogik laufen
  m.pid = m.pid || PID;
  if (rolle === "host") { if (m.t === "versteck") versteckAngekommen(m); else if (m.t === "blick") blicke[m.pid] = m.b; }
  else if (hostConn && hostConn.open) senden(hostConn, m);
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
function verlassen() { if (!offline) { ls.del("tw:host:" + code); ls.del("tw:kopie:" + code); ls.del("tw:mein:" + code); } location.href = location.pathname + (params.get("test") ? "?test=" + params.get("test") : ""); }

// ---------- Bausteine ----------
const sp = p => (S && S.spieler[p]) || { name: "?", farbe: 0, punkte: 0 };
const farbe = p => FARBEN[sp(p).farbe % 8];
const anfang = p => (sp(p).name || "?").trim().charAt(0).toUpperCase() || "?";
const marke = p => `<span class="marke" style="--f:${farbe(p)}">${esc(anfang(p))}</span>`;
const da = p => R.da(S, p);
const eigenGespeichert = nr => { const x = ls.get("tw:mein:" + code); return x && x.nr === nr ? x : null; };

// =====================================================================
// 3D-Runde
// =====================================================================
let W = null, rn = null, schonGezeigt = new Set();
function welt() {
  if (!W) {
    const cv = document.createElement("canvas"); cv.id = "welt"; cv.setAttribute("aria-label", "Zimmer in 3D");
    document.body.prepend(cv);
    try { W = neueWelt(cv); } catch (e) { W = null; cv.remove(); zeigeHinweis("3D geht auf diesem Gerät leider nicht (WebGL fehlt)."); }
  }
  return W;
}
function rundeBildschirm() {
  return `<div class="runde">
    <div class="oben"><span class="zimmer" id="zimmerName"></span><span class="zeit" id="zeit"></span><span class="info" id="info"></span><span class="knoepfe" id="obenKnoepfe"></span></div>
    <div class="ui" id="ui"></div>
    <div class="mitte-gross" id="gross" hidden></div>
    <div class="meldungen" id="meldungen" aria-live="polite"></div>
    <div class="herz" id="herz"></div>
    <div class="hochkant">Bitte das Handy quer halten ↻</div>
  </div>`;
}
const istVerstecker = p => S.r && S.r.verstecker.includes(p);
const istSucher = p => S.r && S.r.sucher.includes(p);

// Baut die Runde passend zum Zustand auf (einmal pro Runde und Teil)
function rundeAktualisieren() {
  if (!S || S.phase !== "runde" || !S.r || !W) return;
  const r = S.r, ui = document.getElementById("ui"); if (!ui) return;
  if (!rn || rn.nr !== r.nr) {
    if (rn) rundeAufraeumen();
    W.laden(r.zimmer, r.seed);
    rn = { nr: r.nr, teil: null, vs: null, ss: null, af: null, kleckse: new Map(), evn: 0, botSucher: {}, botsVersteckt: false, gesendet: 0, fertig: false, blickZeit: 0, herzZeit: 0, zuschauIdx: 0 };
    rn.evn = Math.max(0, ...r.ev.map(e => e.n));
    document.getElementById("zimmerName").textContent = R.ZIMMER_NAMEN[r.zimmer] || "";
  }
  const teil = r.teil === "warten" ? "verstecken" : r.teil;
  // Kleckse für Suche und Auflösung aus den Verstecken bauen
  if (r.teil === "suchen" || r.teil === "aufloesung") {
    const v = V[r.nr] || {};
    for (const p of r.verstecker) {
      if (rn.kleckse.has(p)) continue;
      let x = v[p]; if (!x && p === PID) x = eigenGespeichert(r.nr);
      if (!x) continue;
      const kl = new Klecks(); kl.anwenden(x.d); kl.ladeBild(x.bild).then(() => { if (rolle === "host") e.tarn = tarnwert(W, kl); });
      W.szene.add(kl.gruppe);
      const e = { pid: p, klecks: kl, gefunden: !!r.funde[p], tarn: 0.6 };
      if (e.gefunden) markieren(kl, farbe(r.funde[p].von));
      rn.kleckse.set(p, e);
    }
  }
  if (teil !== rn.teil) {
    const alt = rn.teil; rn.teil = teil;
    if (rn.vs && teil !== "verstecken") { eigenesAbschicken(true); rn.vs.aus(); W.szene.remove(rn.vs.klecks.gruppe); rn.vs = null; }
    if (rn.ss && teil !== "suchen") { rn.ss.aus(); rn.ss = null; }
    if (rn.af && teil !== "aufloesung") { rn.af.aus(); rn.af = null; }
    ui.className = "ui " + teil;
    if (teil === "verstecken") {
      if (istVerstecker(PID)) {
        const start = eigenGespeichert(r.nr);
        rn.vs = versteckenStarten(W, ui, { K, abpausen: S.einst.abpausen, start, onFertig: () => { if (rn.fertig) return; rn.fertig = true; tun({ t: "fertig" }); eigenesAbschicken(true); rn.vs.sperren(); K.spiel("fertig"); meldung("Fertig! Warte auf die anderen …"); } });
      } else { ui.innerHTML = ""; rn.warteKamera = 0; }
    }
    if (teil === "suchen") {
      rn.ss = suchenStarten(W, ui, { K, ich: PID, darf: istSucher(PID), kleckse: () => [...rn.kleckse.values()], onTipp: getippt });
      if (alt !== "suchen") K.spiel("start");
    }
    if (teil === "aufloesung") {
      const n = r.verstecker.length, start = r.aufloesungEnde - R.ZEIT.aufloesung - R.ZEIT.proVersteck * n;
      const reihe = (r.rundflug || r.verstecker).filter(p => rn.kleckse.has(p)).map(p => {
        const f = r.funde[p];
        return { pid: p, klecks: rn.kleckse.get(p).klecks, name: esc(sp(p).name), farbe: f ? farbe(f.von) : farbe(p),
          text: f ? `gefunden von ${esc(sp(f.von).name)} nach ${uhr(f.t != null ? f.t : f.ms)}` : "nie gefunden! 🎉" };
      });
      rn.af = aufloesungStarten(W, ui, { reihe, start, intro: 2000, pro: R.ZEIT.proVersteck * n / Math.max(1, reihe.length), jetzt: hostJetzt, K });
    }
  }
  if (r.teil === "warten" && rn.vs && !rn.gesendetEnde) { eigenesAbschicken(true); rn.vs.sperren(); }
  // Ereignisse
  for (const e of r.ev) {
    if (e.n <= rn.evn) continue; rn.evn = e.n;
    if (e.t === "fund") {
      const k = rn.kleckse.get(e.pid); if (k) { k.gefunden = true; markieren(k.klecks, farbe(e.von)); }
      if (e.pid === PID) { meldung(`<b style="color:${farbe(e.von)}">${esc(sp(e.von).name)}</b> hat dich gefunden!`, true); K.spiel("kuckuck"); brumm([60, 50, 120]); }
      else if (e.von === PID) { meldung(`Gefunden: <b style="color:${farbe(e.pid)}">${esc(sp(e.pid).name)}</b>! +${S.r.art === "einer" ? 2 : 3}`, true); K.spiel("kuckuck"); brumm(80); }
      else { meldung(`<b style="color:${farbe(e.von)}">${esc(sp(e.von).name)}</b> hat <b style="color:${farbe(e.pid)}">${esc(sp(e.pid).name)}</b> gefunden.`); K.spiel("gefunden"); }
    } else if (e.t === "niesen") {
      const k = rn.kleckse.get(e.pid); if (k && rn.ss && !k.gefunden) rn.ss.niesen(k.klecks);
      if (e.pid === PID) meldung("Hatschi! Du hast geniest …");
    } else if (e.t === "daneben" && e.pid === PID) {
      if (rn.ss) rn.ss.sperre(r.art === "alle" ? e.bis : 0);
      if (r.art === "einer") meldung("Daneben! 5 Sekunden weniger.");
    }
  }
  obenKnoepfe();
}
function obenKnoepfe() {
  const el = document.getElementById("obenKnoepfe"); if (!el || !S.r) return;
  const r = S.r, host = rolle === "host";
  let h = "";
  if (r.teil === "aufloesung" && host) h += `<button id="weiter" class="klein">Weiter ▸</button>`;
  if (r.teil === "suchen" && !istSucher(PID) && r.sucher.length > 1) h += `<button id="sichtWechsel" class="klein">Andere Sicht</button>`;
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; const w = document.getElementById("weiter"); if (w) w.onclick = () => tun({ t: "weiter" }); const s = document.getElementById("sichtWechsel"); if (s) s.onclick = () => { if (rn) rn.zuschauIdx++; }; }
}
function getippt(pid) {
  const r = S.r;
  if (pid === "selbst") { meldung("Das bist du selbst 😉"); return; }
  if (pid) { tun({ t: "fund", ziel: pid, ms: Math.round(hostJetzt() - r.suchStart) }, true); return; }
  K.spiel("daneben"); brumm(40);
  if (r.art === "alle" && rn.ss) rn.ss.sperre(Date.now() + R.ZEIT.sperre);
  tun({ t: "daneben" }, true);
}
function eigenesAbschicken(ende) {
  if (!rn || !rn.vs || !S.r) return;
  if (ende && rn.gesendetEnde) return;
  const x = { nr: S.r.nr, d: rn.vs.daten(), bild: rn.vs.bild(), farben: rn.vs.farben() };
  ls.set("tw:mein:" + code, x);
  anHost(Object.assign({ t: "versteck", ende: !!ende }, x));
  if (ende) rn.gesendetEnde = true;
}
function rundeAufraeumen() {
  if (!rn) return;
  if (rn.vs) { rn.vs.aus(); W.szene.remove(rn.vs.klecks.gruppe); }
  if (rn.ss) rn.ss.aus(); if (rn.af) rn.af.aus();
  for (const k of rn.kleckse.values()) { W.szene.remove(k.klecks.gruppe); k.klecks.entsorgen(); }
  rn = null;
}
const meldungen = [];
function meldung(html, wichtig) {
  meldungen.push({ html, bis: Date.now() + (wichtig ? 4000 : 2800), wichtig });
  if (meldungen.length > 4) meldungen.shift();
  meldungenZeigen();
}
function meldungenZeigen() {
  const el = document.getElementById("meldungen"); if (!el) return;
  const jetzt = Date.now(); while (meldungen.length && meldungen[0].bis < jetzt) meldungen.shift();
  const h = meldungen.map(m => `<div class="meldung ${m.wichtig ? "wichtig" : ""}">${m.html}</div>`).join("");
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}

// ---------- Bots (beim Spielleiter) ----------
function botsTakt(dt) {
  if (rolle !== "host" || !S.r || !rn) return;
  const r = S.r, jetzt = Date.now();
  if (r.teil === "verstecken" && jetzt >= r.versteckStart + 1500) {
    // nacheinander, damit das Handy nicht hängt
    const offen = r.verstecker.filter(p => R.istBot(S, p) && !(V[r.nr] && V[r.nr][p]));
    if (offen.length && (!rn.botZeit || jetzt > rn.botZeit)) {
      const p = offen[0], seed = (r.seed ^ (p.charCodeAt(3) * 7919)) >>> 0;
      const rng = mulberry(seed), x = botVerstecken(W, rng, 0.5 + rng() * 0.35);
      versteckMerken(r.nr, p, x);
      R.aktion(S, p, { t: "fertig" }, Date.now());
      R.aktion(S, PID, { t: "versteckt", pid: p, farben: x.farben }, Date.now());
      rn.botZeit = Date.now() + 600; geaendert();
    }
  }
  if (r.teil === "suchen" && jetzt >= r.suchStart) {
    const anteil = Math.min(1, (jetzt - r.suchStart) / r.dauer);
    for (const p of r.sucher) {
      if (!R.istBot(S, p)) continue;
      const b = rn.botSucher[p] = rn.botSucher[p] || neuerSucher(W, mulberry((r.seed + p.length * 131 + p.charCodeAt(4)) >>> 0), 0.45 + Math.random() * 0.35);
      const e = sucherSchritt(W, b, dt, [...rn.kleckse.values()], p, anteil);
      blicke[p] = botPose(b);
      if (e && e.fund) { const res = R.aktion(S, p, { t: "fund", ziel: e.fund, ms: jetzt - r.suchStart }, jetzt); if (res.ok) geaendert(); }
      else if (e && e.daneben) { const res = R.aktion(S, p, { t: "daneben" }, jetzt); if (res.ok) geaendert(); }
    }
  }
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- Herzklopfen ----------
function herzklopfen(dt) {
  const el = document.getElementById("herz"); if (!el) return;
  let st = 0;
  const r = S.r, ich = rn && rn.kleckse.get(PID);
  if (r && r.teil === "suchen" && ich && !ich.gefunden && hostJetzt() >= r.suchStart) {
    const m = ich.klecks.mitteWelt();
    for (const p of r.sucher) {
      if (p === PID || !blicke[p]) continue;
      const b = blicke[p], auge = new THREE.Vector3(b[0], b[1], b[2]);
      const blick = new THREE.Vector3(Math.sin(b[3]) * Math.cos(b[4]), Math.sin(b[4]), Math.cos(b[3]) * Math.cos(b[4]));
      const v = m.clone().sub(auge), d = v.length(), w = Math.acos(Math.max(-1, Math.min(1, v.normalize().dot(blick))));
      const grenze = 0.42 * (b[5] || 60) / 60;
      if (d < 5.5 && w < grenze) st = Math.max(st, (1 - d / 5.5) * (1 - w / grenze) * 1.6);
    }
  }
  st = Math.min(1, st);
  rn && (rn.herzZeit -= dt);
  if (st > 0.05 && rn && rn.herzZeit <= 0) {
    rn.herzZeit = 1.1 - 0.65 * st; K.spiel("herz", 0.3 + 0.7 * st); if (st > 0.5) brumm(25);
    el.style.setProperty("--st", st.toFixed(2)); el.classList.remove("puls"); void el.offsetWidth; el.classList.add("puls");
  }
}

// ---------- Bildschleife ----------
let zuletzt = performance.now(), tickZuletzt = -1;
function bild(ms) {
  requestAnimationFrame(bild);
  const dt = Math.min(0.05, (ms - zuletzt) / 1000); zuletzt = ms;
  if (!W || !S || S.phase !== "runde" || !rn) { if (W && S && S.phase === "ende" && aus) { aus.schritt(dt); W.render(); } return; }
  const r = S.r, jetzt = hostJetzt();
  if (rn.vs) rn.vs.schritt(dt);
  else if (rn.ss) {
    if (!istSucher(PID)) {             // Zuschauen durch die Augen eines Suchers
      const su = r.sucher.filter(p => blicke[p]); const p = su.length ? su[rn.zuschauIdx % su.length] : null;
      rn.ss.zuschauen(p ? blicke[p] : null);
      const info = document.getElementById("info"); if (info && p) info.innerHTML = `Du schaust ${marke(p)} <b>${esc(sp(p).name)}</b> zu`;
    }
    rn.ss.schritt(dt);
  } else if (rn.af) rn.af.schritt(dt);
  else {                               // Sucher wartet vor der Tür: langsamer Rundblick
    const Z = W.Z, c = new THREE.Vector3((Z.raum.x0 + Z.raum.x1) / 2, 1.2, (Z.raum.z0 + Z.raum.z1) / 2), w = ms / 9000;
    W.kamera.position.set(c.x + Math.sin(w) * 1.5, 1.7, c.z + Math.cos(w) * 1.0); W.kamera.lookAt(c.x - Math.sin(w) * 3, 0.8, c.z - Math.cos(w) * 3);
  }
  W.render();
  botsTakt(dt);
  // eigene Blickrichtung melden
  if (rn.ss && istSucher(PID) && jetzt >= r.suchStart) {
    rn.blickZeit -= dt;
    if (rn.blickZeit <= 0) { rn.blickZeit = r.art === "einer" ? 0.1 : 0.2; const b = rn.ss.pose(); blicke[PID] = b; anHost({ t: "blick", b }); }
  }
  // Zwischenspeichern beim Verstecken
  if (rn.vs && !rn.fertig && Date.now() - (rn.gesendet || 0) > 15000 && jetzt > r.versteckStart + 5000) { rn.gesendet = Date.now(); eigenesAbschicken(false); }
  herzklopfen(dt);
  anzeigen(jetzt);
}
requestAnimationFrame(bild);
function anzeigen(jetzt) {
  const r = S.r, z = document.getElementById("zeit"), info = document.getElementById("info"), gr = document.getElementById("gross");
  if (!z) return;
  let zt = "", it = null, groß = "";
  if (r.teil === "verstecken" || r.teil === "warten") {
    if (jetzt < r.versteckStart) groß = `<small>Runde ${r.nr + 1}${S.tag ? " von " + S.tag.plan.length : ""} · ${esc(R.ARTEN[r.art].name)}</small>${esc(R.ZIMMER_NAMEN[r.zimmer])}<small>${istVerstecker(PID) ? "Versteck dich und mal dich an!" : "Du suchst! Die anderen verstecken sich …"}</small>`;
    else if (r.teil === "warten") groß = `<small>Zeit um!</small>Alle Kleckse kleben fest …`;
    zt = r.teil === "warten" ? "⏱ 0:00" : "⏱ " + uhr(r.versteckEnde - Math.max(jetzt, r.versteckStart));
    if (!istVerstecker(PID)) it = "Augen zu und bis 90 zählen!";
    const rest = Math.ceil((r.versteckEnde - jetzt) / 1000);
    if (r.teil === "verstecken" && rest <= 10 && rest > 0 && rest !== tickZuletzt && jetzt > r.versteckStart) { tickZuletzt = rest; K.spiel("tick"); }
  } else if (r.teil === "suchen") {
    if (jetzt < r.suchStart) groß = istSucher(PID) ? `Ich komme!<small>Tippe auf Kleckse, die du entdeckst.</small>` : `Gleich wird gesucht!<small>Nicht bewegen …</small>`;
    zt = "🔍 " + uhr(Math.min(r.suchEnde - jetzt, r.dauer));
    const offen = r.verstecker.filter(p => !r.funde[p]).length;
    if (istSucher(PID)) it = `noch ${offen} versteckt · ${Object.values(r.funde).filter(f => f.von === PID).length} gefunden`;
    else if (!rn.ss || istSucher(PID)) it = `noch ${offen} versteckt`;
    if (r.art === "alle" && r.funde[PID]) it += " · du bist entdeckt";
  } else if (r.teil === "aufloesung") {
    zt = "Auflösung"; it = "";
    const n = r.verstecker.length, start = r.aufloesungEnde - R.ZEIT.aufloesung - R.ZEIT.proVersteck * n;
    if (jetzt > start + 2000 + R.ZEIT.proVersteck * n && r.punkte) groß = zwischenstand();
  }
  if (z.textContent !== zt) z.textContent = zt;
  if (it != null && info.textContent !== it) info.textContent = it;
  if (gr.dataset.h !== groß) { gr.dataset.h = groß; gr.innerHTML = groß; gr.hidden = !groß; }
  meldungenZeigen();
}
function zwischenstand() {
  const r = S.r, liste = S.reihe.filter(p => S.spieler[p]).sort((a, b) => sp(b).punkte - sp(a).punkte);
  const tk = r.tarnkuenstler ? `<p class="tk">Tarnkünstler der Runde: ${marke(r.tarnkuenstler)} <b>${esc(sp(r.tarnkuenstler).name)}</b></p>` : "";
  return `<div class="stand"><small>Runde ${r.nr + 1}${S.tag ? " von " + S.tag.plan.length : ""}</small>${tk}<ol>${liste.map(p => `<li>${marke(p)}<span>${esc(sp(p).name)}</span><b>${sp(p).punkte}</b><i>${r.punkte && r.punkte[p] ? "+" + r.punkte[p] : ""}</i></li>`).join("")}</ol></div>`;
}

// =====================================================================
// Ausstellung (Siegerehrung): alle Kleckse des Abends auf Regalbrettern
// =====================================================================
let aus = null;
function ausstellung() {
  if (aus || !welt()) return;
  rundeAufraeumen();
  const W2 = W, sz = new THREE.Group(); W2.szene.add(sz);
  if (W2.Z) W2.Z.gruppe.visible = false;
  const holz = new THREE.MeshLambertMaterial({ color: 0xB07A45 }), wand = new THREE.MeshLambertMaterial({ color: 0xF1E3C8 });
  const w0 = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), wand); w0.position.set(0, 2, -0.4); sz.add(w0);
  const reihe = S.reihe.filter(p => S.spieler[p] && galerie[p] && galerie[p].length);
  const kl = [];
  reihe.forEach((p, i) => {
    const y = i * 0.75, brett = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 0.6), holz); brett.position.set(0, y - 0.03, 0); sz.add(brett);
    const schild = namensSchild(sp(p).name, farbe(p)); schild.position.set(-2.4, y + 0.2, 0.15); sz.add(schild);
    galerie[p].forEach((g, j) => {
      const k = new Klecks(); k.form(g.h, g.k); k.ladeBild(g.bild); k.setzen(new THREE.Vector3(-1.6 + j * 0.62, y, 0), new THREE.Vector3(0, 1, 0), 0);
      k.augen.visible = true; sz.add(k.gruppe); kl.push(k);
    });
  });
  const h = Math.max(1, reihe.length) * 0.75;
  aus = {
    schritt(dt) {
      const t = performance.now() / 1000;
      W2.kamera.fov = 50; W2.kamera.updateProjectionMatrix();
      W2.kamera.position.set(Math.sin(t / 4) * 1.2, h / 2 + 0.2, 2.2 + h * 0.9); W2.kamera.lookAt(0, h / 2 - 0.2, 0);
      kl.forEach((k, i) => { k.gruppe.rotation.y = Math.sin(t * 1.3 + i) * 0.35; });
    },
    weg() { W2.szene.remove(sz); kl.forEach(k => k.entsorgen()); if (W2.Z) W2.Z.gruppe.visible = true; aus = null; }
  };
}
function namensSchild(text, f) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d");
  g.fillStyle = f; g.beginPath(); g.roundRect(4, 4, 248, 56, 14); g.fill();
  g.fillStyle = "#fff"; g.font = "bold 34px Inter, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text.slice(0, 12), 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), new THREE.MeshBasicMaterial({ map: t, transparent: true })); return m;
}

// =====================================================================
// Bildschirme
// =====================================================================
function statusZeile() {
  if (offline) return "";
  if (rolle === "host") return verbunden ? "" : (fehlerText || "Raum wird geöffnet …");
  if (rolle === "client" && !verbunden) return S ? "Verbindung zum Spielleiter weg, verbinde neu …" : (fehlerText || (window.ABEND && ABEND.aktiv ? "" : "Verbinde mit Raum " + code + " …"));
  return "";
}
function titelbild() {
  return `<svg class="titelbild" viewBox="0 0 300 150" role="img" aria-label="Ein Wohnzimmer mit Blümchentapete, auf dem Sofa sitzt ein fast unsichtbarer Klecks">
    <defs><pattern id="tap" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#E9D8B4"/><circle cx="5" cy="5" r="2.4" fill="#D9738B"/><circle cx="15" cy="15" r="2.4" fill="#7FA36B"/></pattern></defs>
    <rect width="300" height="150" fill="url(#tap)"/><rect y="112" width="300" height="38" fill="#A86E3D"/><path d="M0 112h300" stroke="#5C3B1E" stroke-width="3"/>
    <rect x="200" y="20" width="60" height="44" rx="3" fill="#C9A227" stroke="#5C3B1E" stroke-width="3"/><rect x="206" y="26" width="48" height="32" fill="#6E8FB0"/><path d="M206 52l14-12 10 8 12-14 12 18z" fill="#4F7A4A"/>
    <path d="M60 112v-30q0-10 10-10h110q10 0 10 10v30z" fill="#7A3E3A" stroke="#3B1E1C" stroke-width="3"/><rect x="48" y="84" width="22" height="34" rx="8" fill="#8A4844" stroke="#3B1E1C" stroke-width="3"/><rect x="180" y="84" width="22" height="34" rx="8" fill="#8A4844" stroke="#3B1E1C" stroke-width="3"/>
    <g class="tb-klecks"><path d="M112 96q-2-22 14-30q4-6 6-12q2 6 6 12q16 8 14 30z" fill="#7F4440" opacity=".92"/><circle cx="126" cy="80" r="3.4" fill="#fff"/><circle cx="138" cy="80" r="3.4" fill="#fff"/><circle cx="126.6" cy="80.6" r="1.6" fill="#1a1a1a"/><circle cx="138.6" cy="80.6" r="1.6" fill="#1a1a1a"/></g>
    <g fill="#F3F0E8" stroke="#2B2B2B" stroke-width="2.5"><path d="M30 112q-2-18 10-24q3-5 4-10q2 5 5 10q12 6 10 24z"/></g><circle cx="40" cy="98" r="2.2" fill="#2B2B2B"/><circle cx="49" cy="98" r="2.2" fill="#2B2B2B"/>
    <text x="252" y="104" font-family="Permanent Marker, cursive" font-size="16" fill="#3B1E1C" text-anchor="middle">wo?</text></svg>`;
}
function bildschirmStart() {
  return `<header class="titel">${titelbild()}<h1>Tapetenwechsel</h1><p class="leise">Versteckspiel in 3D: Such dir im Zimmer einen Platz, knete dich in Form und mal dich so an wie die Tapete. Dann wird gesucht!</p></header>
    <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Richard"></label>
    <div class="karte-box"><h2>Neues Spiel</h2><p class="leise klein">Für 2 bis 8 Leute, jeder am eigenen Handy. Quer halten.</p><button class="knopf" id="neu">Raum erstellen</button></div>
    <div class="karte-box"><h2>Mitspielen</h2><label class="feld">Raumcode<input id="code" maxlength="6" autocapitalize="characters" placeholder="z. B. K7M2"></label><button class="knopf zweit" id="beitreten">Beitreten</button></div>
    <div class="karte-box"><h2>Üben</h2><p class="leise klein">Allein ohne Netz gegen Bots: Such die Bots oder lass dich von ihnen suchen.</p><button class="knopf zweit" id="allein">Allein üben</button></div>
    <a class="link" href="../">Alle Spiele</a>`;
}
function bildschirmName() {
  return `<header class="titel"><h1>Tapetenwechsel</h1><p class="leise">Du wurdest in Raum <b>${esc(code)}</b> eingeladen.</p></header>
    <label class="feld">Dein Name<input id="name" maxlength="20" value="${esc(name)}" autocomplete="nickname" placeholder="z. B. Lena"></label>
    <button class="knopf" id="mitspielen">Mitspielen</button>`;
}
function bildschirmLobby() {
  const host = rolle === "host", leute = S.reihe.filter(p => S.spieler[p] && da(p)), weg = S.reihe.filter(p => S.spieler[p] && !da(p)), e = S.einst;
  let qr = "";
  if (!offline) try { if (window.qrcode) { const q = qrcode(0, "M"); q.addData(link()); q.make(); qr = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } } catch (x) {}
  const zeile = p => `<li>${marke(p)}<span class="nm">${esc(sp(p).name)}${p === S.host && !offline ? " <small>Spielleitung</small>" : ""}${p === PID ? " <small>du</small>" : ""}${R.istBot(S, p) ? " <small>Bot</small>" : ""}</span>${host && R.istBot(S, p) ? `<button class="mini" data-botweg="${p}" aria-label="Bot entfernen">✕</button>` : ""}</li>`;
  const meine = sp(PID).farbe, dis = host ? "" : "disabled";
  const farben = FARBEN.map((f, i) => { const belegt = Object.entries(S.spieler).some(([q, s]) => q !== PID && s.farbe === i); return `<button class="farbe ${i === meine ? "an" : ""}" data-farbe="${i}" style="--f:${f}" ${belegt ? "disabled" : ""} aria-label="Farbe ${i + 1}"></button>`; }).join("");
  const arten = Object.entries(R.ARTEN).map(([k, a]) => `<button class="art ${e.art === k ? "an" : ""}" data-art="${k}" ${dis}><span class="haken">${e.art === k ? "●" : ""}</span><span><b>${esc(a.name)}</b><small>${esc(a.kurz)}</small></span></button>`).join("");
  const laengen = e.art === "alle" ? `<div class="laengen">${Object.entries(R.LAENGEN).map(([k, l]) => `<button class="wahl ${e.laenge === k ? "an" : ""}" data-laenge="${k}" ${dis}><b>${l.name}</b><small>${l.n} Runden</small></button>`).join("")}</div>` : `<p class="leise klein">Jeder sucht einmal: ${leute.length >= 6 ? Math.ceil(leute.length / 2) : leute.length} Runden.</p>`;
  const zimmer = Object.entries(R.ZIMMER_NAMEN).map(([k, n]) => `<button class="wahl ${e.zimmer[k] ? "an" : ""}" data-zimmer="${k}" ${dis}><b>${esc(n)}</b></button>`).join("");
  const zeiten = R.VERSTECKZEITEN.map(s => `<button class="wahl ${e.versteck === s ? "an" : ""}" data-versteck="${s}" ${dis}><b>${s} s</b></button>`).join("");
  const pausen = [["einmal", "1× pro Runde"], ["frei", "beliebig"], ["aus", "aus"]].map(([k, n]) => `<button class="wahl ${e.abpausen === k ? "an" : ""}" data-pausen="${k}" ${dis}><b>${n}</b></button>`).join("");
  return `${offline ? `<header class="titel"><p class="etikett">Tapetenwechsel · Üben</p></header>` : `<header class="titel"><p class="etikett">Tapetenwechsel · Raumcode</p><div class="code">${esc(code)}</div></header>
    <div class="karte-box einladen">${qr ? `<div class="qr">${qr}</div>` : ""}<div><p class="leise klein">Scannen oder Link teilen:</p><button class="knopf zweit klein-knopf" id="teilen">Link kopieren</button></div></div>`}
    <div class="spalten">
    <div class="karte-box"><h2>Kleckse (${leute.length})</h2><ul class="liste">${leute.map(zeile).join("")}</ul>
      ${weg.length ? `<p class="leise klein">Nicht verbunden: ${weg.map(p => esc(sp(p).name)).join(", ")}</p>` : ""}
      ${host ? `<div class="reihe"><button class="knopf zweit klein-knopf" id="botDazu">+ Bot</button></div>` : ""}
      <h3>Deine Farbe</h3><div class="farben">${farben}</div></div>
    <div class="karte-box"><h2>Hausbesuch</h2><div class="arten">${arten}</div>${laengen}
      <h3>Zimmer</h3><div class="laengen">${zimmer}</div>
      <h3>Zeit zum Verstecken</h3><div class="laengen">${zeiten}</div>
      <h3>Abpausen</h3><div class="laengen">${pausen}</div>
      <label class="schalter"><input type="checkbox" id="niesen" ${e.niesen ? "checked" : ""} ${dis}> Niesen (Hinweise in der zweiten Hälfte)</label>
      ${host ? `<button class="knopf" id="start">Hausbesuch starten</button>` : `<p class="leise mitte">Die Spielleitung startet.</p>`}</div>
    </div>
    <div class="karte-box"><h2>So geht's</h2><ul class="regeln">
      <li><b>Platz:</b> Tippe auf eine Fläche, dann hüpft dein Klecks hin, auch an Wände und Decke.</li>
      <li><b>Kneten:</b> flach oder hoch, rund oder kantig.</li>
      <li><b>Malen:</b> Mit der <b>Pipette</b> eine Farbe aus dem Zimmer nehmen und mit dem Finger auf den Klecks malen. Mit dem <b>Probeblick</b> siehst du dich wie die Sucher.</li>
      <li><b>Suchen:</b> Laufen mit dem Joystick, umschauen durch Ziehen, zwei Finger zoomen. Kurz auf einen Klecks <b>tippen</b>. Daneben tippen kostet Zeit.</li>
      <li>Schaut ein Sucher in deine Richtung, bekommst du <b>Herzklopfen</b>.</li></ul></div>
    <button class="link" id="verlassen">${offline ? "Zurück" : "Raum verlassen"}</button>`;
}
function bildschirmEnde() {
  const E = S.ehrung || { stand: [], titel: [] }, host = rolle === "host";
  const podest = [2, 1, 3].map(pl => { const w = E.stand.filter(x => x.platz === pl); return `<div class="stufe s${pl}">${w.map(x => `<div class="sieger">${marke(x.pid)}<b>${esc(sp(x.pid).name)}</b><small>${x.punkte} Punkte</small></div>`).join("")}<div class="block">${w.length ? pl : ""}</div></div>`; }).join("");
  const rest = E.stand.filter(x => x.platz > 3).map(x => `<li><span class="platz">${x.platz}.</span>${marke(x.pid)}<span class="nm">${esc(sp(x.pid).name)}</span><span class="punkte">${x.punkte}</span></li>`).join("");
  const titel = E.titel.map(t => `<li><b>${esc(t.name)}</b><span>${esc(sp(t.pid).name)}</span><small>${esc(t.text)}</small></li>`).join("");
  const erster = E.stand.filter(x => x.platz === 1).map(x => esc(sp(x.pid).name)).join(" und ");
  return `<div class="ende"><div class="ausstellung-rahmen"><p class="etikett">Die Ausstellung</p></div><div class="ende-text">
    <header class="titel"><p class="etikett">Hausbesuch vorbei</p><h1>Meister der Tarnung</h1><p class="gross">${erster}</p></header>
    <div class="podest">${podest}</div>${rest ? `<ol class="liste">${rest}</ol>` : ""}
    ${titel ? `<div class="karte-box"><h2>Ehrentitel</h2><ul class="titelliste">${titel}</ul></div>` : ""}
    ${host ? `<button class="knopf" id="nochmal">Noch ein Hausbesuch</button><button class="link" id="zurLobby">Zurück in die Lobby</button>` : `<p class="leise mitte">Die Spielleitung kann einen neuen Hausbesuch starten.</p>`}
    <button class="link" id="verlassen">${offline ? "Zurück" : "Raum verlassen"}</button></div></div>`;
}

// ---------- Klänge aus dem Zustand ----------
let vorher = null;
function klaenge() {
  if (!S) return;
  const j = { phase: S.phase, nr: S.r ? S.r.nr : null };
  const v = vorher; vorher = j; if (!v) return;
  if (j.phase === "ende" && v.phase !== "ende") { K.spiel("sieg"); brumm([80, 60, 80, 60, 200]); }
  if (j.phase === "runde" && (v.phase !== "runde" || v.nr !== j.nr)) brumm(120);
}

function render() {
  klaenge();
  const st = statusZeile(), ueb = rolle === "client" && S && offlineSeit && Date.now() - offlineSeit > 20000;
  const statusHtml = `<div class="status" ${st ? "" : "hidden"}><span>${esc(st)}</span>${ueb ? `<button class="klein" id="uebernehmen">Spielleitung übernehmen</button>` : ""}</div>`;
  const inRunde = !!(S && S.phase === "runde" && S.r && rolle && rolle !== "pruefen");
  const inEnde = !!(S && S.phase === "ende" && rolle && rolle !== "pruefen");
  document.body.classList.toggle("in-runde", inRunde);
  document.body.classList.toggle("in-ende", inEnde);
  if (inRunde) {
    if (aus) aus.weg();
    if (!welt()) return;
    if (!app.querySelector(".runde")) { app.innerHTML = statusHtml + rundeBildschirm(); letztesHtml = ""; if (rn) rundeAufraeumen(); }
    else { const s = app.querySelector(".status"); if (s && s.outerHTML !== statusHtml) { s.outerHTML = statusHtml; } }
    const u = document.getElementById("uebernehmen"); if (u) u.onclick = uebernehmen;
    const alt = app.querySelector(".toast"); if (alt && !hinweis) alt.remove();
    if (hinweis && !alt) app.insertAdjacentHTML("beforeend", `<div class="toast" role="status">${esc(hinweis)}</div>`);
    rundeAktualisieren();
    return;
  }
  if (rn) rundeAufraeumen();
  if (inEnde) ausstellung(); else if (aus) aus.weg();
  let h = statusHtml;
  if (!rolle) h += code ? bildschirmName() : bildschirmStart();
  else if (rolle === "pruefen" || !S) h += `<div class="mitte"><p class="leise">${window.ABEND ? ABEND.warten() : "Verbinde …"}</p></div>`;
  else if (S.phase === "ende") h += bildschirmEnde();
  else h += bildschirmLobby();
  if (hinweis) h += `<div class="toast" role="status">${esc(hinweis)}</div>`;
  if (h === letztesHtml) return;
  letztesHtml = h;
  app.innerHTML = h;
  binden();
}
setInterval(() => { if (rolle === "client" && offlineSeit) render(); }, 5000);

function binden() {
  const $ = id => document.getElementById(id);
  const nameAus = () => { const el = $("name"); if (el) { name = el.value.trim().slice(0, 20); ls.set("slf:name", name); if (window.ABEND && ABEND.nameGeaendert) try { ABEND.nameGeaendert(name); } catch (e) {} } };
  if ($("name")) $("name").onchange = nameAus;
  if ($("neu")) $("neu").onclick = () => { nameAus(); if (!name) return zeigeHinweis("Bitte gib deinen Namen ein."); neuesSpiel(0); };
  if ($("allein")) $("allein").onclick = () => { nameAus(); neuesSpiel(3, true); };
  if ($("beitreten")) $("beitreten").onclick = () => {
    nameAus(); const c = ($("code").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!name) return zeigeHinweis("Bitte gib deinen Namen ein."); if (c.length < 4) return zeigeHinweis("Bitte den Raumcode eingeben.");
    code = c; history.replaceState(null, "", "?raum=" + code + testTeil()); clientStarten();
  };
  if ($("mitspielen")) $("mitspielen").onclick = () => { nameAus(); if (!name) return zeigeHinweis("Bitte gib deinen Namen ein."); clientStarten(); };
  if ($("uebernehmen")) $("uebernehmen").onclick = uebernehmen;
  if ($("verlassen")) $("verlassen").onclick = verlassen;
  if ($("teilen")) $("teilen").onclick = async () => { try { if (navigator.share) await navigator.share({ title: "Tapetenwechsel", url: link() }); else { await navigator.clipboard.writeText(link()); zeigeHinweis("Link kopiert."); } } catch (e) {} };
  if ($("botDazu")) $("botDazu").onclick = () => tun({ t: "bot", dazu: true });
  if ($("start")) $("start").onclick = () => { if (!welt()) return; tun({ t: "start" }); };
  if ($("nochmal")) $("nochmal").onclick = () => tun({ t: "neustart" });
  if ($("zurLobby")) $("zurLobby").onclick = () => tun({ t: "lobby" });
  if ($("niesen")) $("niesen").onchange = e => tun({ t: "einst", niesen: e.target.checked });
  document.querySelectorAll("[data-botweg]").forEach(b => b.onclick = () => tun({ t: "bot", weg: b.dataset.botweg }));
  document.querySelectorAll("[data-farbe]").forEach(b => b.onclick = () => tun({ t: "farbe", farbe: +b.dataset.farbe }));
  document.querySelectorAll("[data-art]").forEach(b => b.onclick = () => tun({ t: "einst", art: b.dataset.art }));
  document.querySelectorAll("[data-laenge]").forEach(b => b.onclick = () => tun({ t: "einst", laenge: b.dataset.laenge }));
  document.querySelectorAll("[data-zimmer]").forEach(b => b.onclick = () => tun({ t: "einst", zimmer: b.dataset.zimmer }));
  document.querySelectorAll("[data-versteck]").forEach(b => b.onclick = () => tun({ t: "einst", versteck: +b.dataset.versteck }));
  document.querySelectorAll("[data-pausen]").forEach(b => b.onclick = () => tun({ t: "einst", abpausen: b.dataset.pausen }));
}

// Ton-Knopf
const tonKnopf = document.createElement("button");
tonKnopf.className = "tonknopf"; tonKnopf.type = "button";
const tonText = () => { tonKnopf.textContent = K.an ? "🔊" : "🔇"; tonKnopf.setAttribute("aria-label", K.an ? "Ton aus" : "Ton an"); };
tonKnopf.onclick = () => { K.umschalten(); tonText(); };
tonText(); document.body.appendChild(tonKnopf);

// ---------- Start ----------
if (typeof Peer === "undefined" && !params.has("allein")) { app.innerHTML = `<div class="mitte"><p>Die Verbindungsbibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.</p></div>`; }
else if (params.has("allein")) {
  // Üben ohne Netz: ?allein zeigt die Übungs-Lobby mit 3 Bots; &bots=n, &art=alle|einer, &zimmer=…, &los startet gleich
  if (!name) name = "Ich";
  neuesSpiel(Math.min(7, params.has("bots") ? +params.get("bots") : 3), true);
  if (params.get("art")) tun({ t: "einst", art: params.get("art") });
  if (params.get("zimmer")) { const z = {}; for (const k of Object.keys(R.ZIMMER_NAMEN)) z[k] = k === params.get("zimmer"); tun({ t: "einst", zimmer: z }); }
  if (params.get("zeit")) tun({ t: "einst", versteck: +params.get("zeit") });
  if (params.has("los")) tun({ t: "start" });
} else if (code) {
  const gespeichert = ls.get("tw:host:" + code);
  if (gespeichert) fortsetzenAlsHost(gespeichert);
  else if (name) clientStarten();
  else render();
} else if (params.get("bots")) {
  if (!name) name = "Testperson";
  neuesSpiel(Math.min(7, +params.get("bots")));
} else render();
window.__tw = { get S() { return S; }, get rolle() { return rolle; }, get W() { return W; }, get rn() { return rn; }, V, blicke, PID, tun: params.get("test") || params.has("allein") ? tun : undefined };
