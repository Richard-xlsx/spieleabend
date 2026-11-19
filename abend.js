// Ein Raum für den ganzen Abend (wird von der Startseite und von jedem Spiel geladen, nach netz.js).
//
// Ablauf: Auf der Startseite eröffnet einer den Abend (Code wie KRAH), die anderen treten bei.
// Der Abendleiter wählt ein Spiel, alle Handys springen hinein (Spielcode = Abendcode + Zähler, z. B. KRAH2).
// „Zurück zum Abend“ beim Abendleiter holt alle wieder auf die Startseite.
//
// Technik: Das Handy des Abendleiters hält eine eigene Verbindungs-ID (fmwabend-CODE), auf der Startseite
// und auch während eines Spiels. Alle anderen fragen dort nach, wo gerade gespielt wird („Stand“), und folgen.
// So finden auch Nachzügler ins laufende Spiel. Die Spiele selbst verbinden sich wie bisher untereinander.
//
// Gemerkt wird: im Tab (sessionStorage „abend“) der Abendcode, beim Abendleiter der Stand (localStorage „abend:CODE“).
// Ein Spiel bindet die Datei mit <script src="../abend.js" data-spiel="ordnername"> ein.
(function () {
  const skript = document.currentScript;
  const SPIEL = (skript && skript.dataset.spiel) || null;          // null = Startseite
  const params = new URLSearchParams(location.search);
  const TEST = params.get("test") || "";
  const T = TEST ? "-" + TEST : "";
  const PREFIX = "fmwabend-";
  const NAMEN = { buchstabenbattle: "Glatt, Strand, Nuss", stillepost: "Pinselpost", kritzelraten: "Malalarm", wortverbot: "Umschreiben", maumau: "Mau-Mau", viererkette: "Viererkette", gleisgenossen: "Gleisgenossen", verlies: "Verlies der Helden" };
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k + T)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k + T, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k + T); } catch (e) {} }
  };
  const ss = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k + T)); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k + T, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k + T); } catch (e) {} }
  };
  const sauber = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  let PID = ls.get("slf:pid"); if (!PID) { PID = Math.random().toString(36).slice(2, 10); ls.set("slf:pid", PID); }

  // Abend aus dem Link übernehmen (?abend=KRAH), sonst aus dem Tab
  if (params.get("abend")) ss.set("abend", sauber(params.get("abend")));
  let code = ss.get("abend") || "";
  let stand = code ? ls.get("abend:" + code) : null;               // nur beim Abendleiter gespeichert
  let leiter = !!(stand && stand.leiter === PID);
  if (code && !leiter) stand = null;

  let peer = null, conns = new Map(), hostConn = null, verbunden = false, retry = null, token = 0, beendet = false;
  const hoerer = [];

  const A = window.ABEND = {
    NAMEN,
    get aktiv() { return !!code && !beendet; },
    get code() { return code; },
    get leiter() { return !!code && leiter; },
    get stand() { return stand; },
    get verbunden() { return verbunden; },
    get pid() { return PID; },
    name() { return ls.get("slf:name") || ""; },
    beiAenderung(f) { hoerer.push(f); },
    pfad, eroeffnen, beitreten, verlassen, waehle, zurueck, neuerRaum, warten, holen, nameGeaendert, link
  };
  const melden = () => { for (const f of hoerer) { try { f(); } catch (e) { console.error(e); } } };

  // Pfade: von der Startseite „maumau/“, aus einem Spiel „../maumau/“
  function pfad(spiel, raum) {
    const basis = SPIEL ? "../" : "./";
    const q = [];
    if (raum) q.push("raum=" + raum);
    if (TEST) q.push("test=" + encodeURIComponent(TEST));
    return basis + (spiel ? spiel + "/" : "") + (q.length ? "?" + q.join("&") : "");
  }
  function gehe(url) { if (gehe.ziel === url) return; gehe.ziel = url; setTimeout(() => { location.href = url; }, 60); }

  // ---------- Abendleiter ----------
  function speichern() { if (leiter && stand) ls.set("abend:" + code, stand); }
  function eroeffnen(name) {
    const Z = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
    code = Array.from({ length: 4 }, () => Z[Math.floor(Math.random() * Z.length)]).join("");
    leiter = true; beendet = false;
    stand = { code, leiter: PID, spiel: null, raum: null, n: 0, leute: { [PID]: { name } }, seit: Date.now() };
    ss.set("abend", code); speichern(); merken();
    starten();
  }
  function anAlle(m) { for (const c of conns.values()) { try { c.send(m); } catch (e) {} } }
  function senden() {
    if (!leiter) return;
    stand.online = [PID].concat([...conns.keys()]);
    if (stand.leute[PID]) stand.leute[PID].name = A.name() || stand.leute[PID].name;
    speichern();
    anAlle({ t: "stand", s: stand });
    melden();
  }
  // Spiel für alle wählen (Startseite): Mitspieler springen sofort, der Abendleiter landet auf den Einstellungen.
  function waehle(spiel) {
    if (!leiter) return;
    stand.spiel = spiel; stand.n = (stand.n || 0) + 1; stand.raum = code + stand.n; stand.seit = Date.now(); stand.erstellt = false;
    senden();
    setTimeout(() => { location.href = pfad(spiel); }, 350);
  }
  // Code für ein neues Spiel in diesem Abend (vom Spiel beim Erstellen des Raums abgefragt)
  function neuerRaum() {
    if (!code || !leiter || !SPIEL) return null;
    if (stand.spiel !== SPIEL || !stand.raum) { stand.spiel = SPIEL; stand.n = (stand.n || 0) + 1; stand.raum = code + stand.n; stand.seit = Date.now(); }
    stand.erstellt = true; senden();
    return stand.raum;
  }
  // Alle zurück auf die Startseite
  function zurueck() {
    if (!code) { location.href = pfad(null); return; }
    if (leiter) { stand.spiel = null; stand.raum = null; stand.seit = Date.now(); senden(); setTimeout(() => { location.href = pfad(null); }, 350); }
    else location.href = pfad(null);
  }
  function verlassen() {
    if (leiter) { anAlle({ t: "ende" }); ls.del("abend:" + code); }
    else if (hostConn && hostConn.open) { try { hostConn.send({ t: "tschuess", pid: PID }); } catch (e) {} }
    const alt = peer;
    setTimeout(() => { try { if (alt) alt.destroy(); } catch (e) {} }, 300);
    peer = null; hostConn = null; conns.clear();
    ss.del("abend"); ls.del("abend:zuletzt");
    code = ""; stand = null; leiter = false; verbunden = false; clearTimeout(retry);
    melden();
  }
  function oeffneLeiter() {
    if (peer) { try { peer.destroy(); } catch (e) {} }
    verbunden = false;
    const p = peer = new Peer(PREFIX + code, window.SPIELEABEND_PEER ? window.SPIELEABEND_PEER() : { debug: 0 });
    p.on("open", () => { if (p !== peer) return; verbunden = true; senden(); });
    p.on("connection", c => {
      c.on("data", m => {
        if (!m || !m.pid) return;
        if (m.t === "hallo") {
          conns.set(m.pid, c);
          stand.leute[m.pid] = { name: String(m.name || "?").slice(0, 20) };
          senden();
        } else if (m.t === "tschuess") {
          conns.delete(m.pid); delete stand.leute[m.pid]; senden();
        }
      });
      c.on("close", () => { for (const [k, x] of conns) if (x === c) conns.delete(k); senden(); });
      c.on("error", () => {});
    });
    p.on("disconnected", () => { if (p !== peer) return; verbunden = false; melden(); setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} }, 2000); });
    p.on("error", e => {
      if (p !== peer) return;
      verbunden = false; melden();
      if (["unavailable-id", "network", "server-error", "socket-error", "socket-closed"].includes(e.type)) setTimeout(() => { if (p === peer) oeffneLeiter(); }, 2500);
    });
  }

  // ---------- Mitspieler ----------
  function beitreten(c) {
    code = sauber(c); leiter = false; stand = null; beendet = false;
    ss.set("abend", code); merken();
    starten();
  }
  function oeffneGast() {
    if (peer) { try { peer.destroy(); } catch (e) {} }
    const p = peer = new Peer(undefined, window.SPIELEABEND_PEER ? window.SPIELEABEND_PEER() : { debug: 0 });
    p.on("open", () => { if (p === peer) verbinde(); });
    p.on("disconnected", () => { if (p !== peer) return; setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch (e) {} }, 2000); });
    p.on("error", e => {
      if (p !== peer) return;
      if (e.type === "peer-unavailable") nochmal();
      else if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) { verbunden = false; hostConn = null; melden(); nochmal(); }
    });
  }
  function verbinde() {
    if (!peer || peer.destroyed || !peer.open || (hostConn && hostConn.open)) return;
    clearTimeout(retry);
    const t = ++token;
    const c = peer.connect(PREFIX + code, { serialization: "json", reliable: true });
    c.on("open", () => {
      if (t !== token) { try { c.close(); } catch (e) {} return; }
      hostConn = c; verbunden = true;
      c.send({ t: "hallo", pid: PID, name: A.name() });
      melden();
    });
    c.on("data", m => {
      if (!m) return;
      if (m.t === "stand") {
        const vorher = stand;
        stand = m.s;
        // Der Spielleiter hat den Raum gerade erstellt: Das Spiel soll sofort neu anklopfen, statt auf den nächsten Versuch zu warten.
        // (Die Spiele verbinden sich neu, wenn die Seite wieder sichtbar wird; dieses Ereignis lösen wir hier aus.)
        if (SPIEL && stand.erstellt && !(vorher && vorher.erstellt && vorher.raum === stand.raum) && stand.spiel === SPIEL)
          setTimeout(() => document.dispatchEvent(new Event("visibilitychange")), 1200);
        const l = stand.leute && stand.leute[stand.leiter]; if (l) ss.set("abend:chef", l.name);   // für den Wartetext auf der nächsten Seite
        melden(); folgen();
      }
      else if (m.t === "ende") { beendet = true; ss.del("abend"); ls.del("abend:zuletzt"); stand = null; melden(); }
    });
    c.on("close", () => { if (hostConn === c) { hostConn = null; verbunden = false; melden(); nochmal(); } });
    c.on("error", () => {});
    retry = setTimeout(() => { if (t === token && hostConn !== c) { try { c.close(); } catch (e) {} nochmal(); } }, window.SPIELEABEND_WARTEN || 12000);
  }
  function nochmal() { token++; clearTimeout(retry); retry = setTimeout(verbinde, 2500); }
  // Dorthin springen, wo der Abendleiter gerade ist
  function folgen() {
    if (!stand || leiter) return;
    const hier = sauber(new URLSearchParams(location.search).get("raum"));
    if (!stand.spiel) { if (SPIEL) gehe(pfad(null)); return; }
    if (stand.spiel !== SPIEL || stand.raum !== hier) gehe(pfad(stand.spiel, stand.raum));
  }

  // Der Gast folgt sofort; holen() ist für die Startseite, wenn der Gast das laufende Spiel selbst öffnen will
  function holen() { if (stand && stand.spiel) location.href = pfad(stand.spiel, leiter && !stand.erstellt ? null : stand.raum); }
  // Name auf der Startseite neu eingegeben: dem Abendleiter mitteilen
  function nameGeaendert() {
    if (leiter) senden();
    else if (hostConn && hostConn.open) { try { hostConn.send({ t: "hallo", pid: PID, name: A.name() }); } catch (e) {} }
  }
  function warten() {
    if (!A.aktiv) return "Verbinde …";
    const l = stand && stand.leute && stand.leute[stand.leiter], n = l ? l.name : ss.get("abend:chef");
    return (n || "Der Spielleiter") + " stellt das Spiel ein. Gleich geht es los …";
  }
  function link() { return new URL(pfad(null), location.href).href.replace(/\?.*$/, "") + "?abend=" + code; }
  function merken() { ls.set("abend:zuletzt", { code, um: Date.now() }); }

  function starten() {
    if (!code || typeof Peer === "undefined") { melden(); return; }
    document.documentElement.classList.add("abend-an");
    document.documentElement.classList.toggle("abend-leiter", leiter);
    document.documentElement.classList.toggle("abend-gast", !leiter);
    if (leiter) oeffneLeiter(); else oeffneGast();
    melden();
  }
  // Beim Verlassen der Seite die Verbindungs-ID sofort freigeben, damit die nächste Seite sie gleich wieder bekommt
  window.addEventListener("pagehide", () => { try { if (peer) peer.destroy(); } catch (e) {} });

  // ---------- In den Spielen: Knöpfe anpassen ----------
  // Mitspieler folgen dem Abendleiter, deshalb fallen bei ihnen „Raum verlassen“ und „Alle Spiele“ weg.
  // Beim Abendleiter heißen sie „Zurück zum Abend“ und holen alle mit. „Beitreten“ und „Allein spielen“ entfallen.
  if (SPIEL) {
    const css = document.createElement("style");
    css.textContent = `
      html.abend-an :is(.karte,.karte-box):has(#beitreten):not(:has(.knopf:not(#beitreten))),
      html.abend-an #beitreten, html.abend-an label:has(> #code), html.abend-an .karte-box:has(#allein) { display: none !important; }
      html.abend-gast :is(#verlassen, #weg, #beenden, a.link[href="../"], a.link[href="./"]) { display: none !important; }`;
    document.head.appendChild(css);
    const ZURUECK = '#verlassen, #weg, a.link[href="../"]';
    const umbenennen = () => {
      if (!A.leiter) return;
      document.querySelectorAll(ZURUECK).forEach(el => { if (el.textContent !== "Zurück zum Abend") el.textContent = "Zurück zum Abend"; });
    };
    document.addEventListener("click", e => {
      if (!A.leiter) return;
      const el = e.target.closest && e.target.closest(ZURUECK);
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      zurueck();
    }, true);
    const los = () => { umbenennen(); new MutationObserver(umbenennen).observe(document.body, { childList: true, subtree: true }); };
    if (document.body) los(); else document.addEventListener("DOMContentLoaded", los);
  }

  if (code) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", starten); else starten();
  }
  if (TEST) window.__abend = A;
})();
