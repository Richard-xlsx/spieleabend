// Gemeinsame Verbindungseinstellungen für alle Spiele (wird von jedem Spiel vor dessen Code geladen).
//
// Die Handys verbinden sich direkt miteinander (WebRTC über PeerJS). Sind sie in verschiedenen Netzen,
// zum Beispiel beide in mobilen Daten, klappt das oft nur über einen Umleitungsserver (TURN).
// Eingetragen: TURN-Dienst von metered.ca (App „spieleabend-verlies“, Bereich TURN Server → Credentials).
// Neue Zugangsdaten so eintragen:
//   Konto anlegen → im Dashboard eine TURN-App anlegen → „ICE Servers Array“ kopieren
//   und die Einträge mit "turn:" bzw. "turns:" unten in TURN einfügen.
// Achtung: Diese Datei ist öffentlich (GitHub Pages). Die Zugangsdaten sind dann für jeden lesbar;
// das ist bei TURN-Diensten für Webseiten so vorgesehen, verbraucht aber euer Kontingent, falls jemand sie kopiert.
// Bleibt die Liste leer, gelten die eingebauten Server von PeerJS (im selben WLAN reicht das).
window.SPIELEABEND_TURN = [
  { urls: "turn:global.relay.metered.ca:80", username: "94063fcebbbb92e6b9ebb742", credential: "Cxqi9TnB+nZ+mcE2" },
  { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: "94063fcebbbb92e6b9ebb742", credential: "Cxqi9TnB+nZ+mcE2" },
  { urls: "turn:global.relay.metered.ca:443", username: "94063fcebbbb92e6b9ebb742", credential: "Cxqi9TnB+nZ+mcE2" },
  { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: "94063fcebbbb92e6b9ebb742", credential: "Cxqi9TnB+nZ+mcE2" },
];

// Optionen für new Peer(…): mit eigenen TURN-Servern, sonst die Standardwerte von PeerJS
window.SPIELEABEND_PEER = function () {
  const turn = (window.SPIELEABEND_TURN || []).filter(s => s && s.urls && s.username);
  if (!turn.length) return { debug: 0 };
  return { debug: 0, config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.relay.metered.ca:80" }].concat(turn) } };
};
// Wie lange ein Mitspieler auf die Verbindung zum Spielleiter wartet, bevor er neu ansetzt (über TURN dauert es länger)
window.SPIELEABEND_WARTEN = 12000;

// Aufräumen im Handy-Speicher: Jedes Spiel speichert den Spielstand eines Raums (Spielleiter, Kopie, Entwurf …),
// damit Neuladen nichts kaputt macht. Alte Räume blieben bisher für immer liegen; mit vielen Bildern ist der Speicher
// (bei Safari etwa 5 MB für alle Spiele zusammen) irgendwann voll, und neue Spielstände werden nicht mehr gespeichert.
// Darum: merken, wann ein Raum zuletzt gespeichert wurde, Räume nach 12 Stunden löschen und bei vollem Speicher
// sofort alle anderen Räume freigeben.
(function () {
  try {
    const RAUM = /^(sp|kr|wv|mm|slf|vl|vk|wp|ob):[a-z]+:([A-Z0-9]{4})(-.*)?$/, ZEIT = "spieleabend:raumzeit", ALT = 12 * 3600 * 1000;
    const LS = window.localStorage, setzen = Storage.prototype.setItem;
    let zeiten = {}; try { zeiten = JSON.parse(LS.getItem(ZEIT)) || {}; } catch (e) {}
    let timer = null;
    const merken = () => { clearTimeout(timer); timer = setTimeout(() => { try { setzen.call(LS, ZEIT, JSON.stringify(zeiten)); } catch (e) {} }, 1500); };
    const raumVon = k => { const m = RAUM.exec(k); return m ? m[2] + (m[3] || "") : null; };
    function weg(soll) {
      for (let i = LS.length - 1; i >= 0; i--) { const k = LS.key(i); if (k && RAUM.test(k) && soll(k)) { LS.removeItem(k); delete zeiten[k]; } }
      merken();
    }
    // beim Laden: Räume ohne Zeitstempel ab jetzt beobachten, alte löschen
    const jetzt = Date.now();
    for (let i = 0; i < LS.length; i++) { const k = LS.key(i); if (k && RAUM.test(k) && !zeiten[k]) zeiten[k] = jetzt; }
    for (const k in zeiten) if (LS.getItem(k) === null) delete zeiten[k];
    weg(k => jetzt - (zeiten[k] || jetzt) > ALT);
    Storage.prototype.setItem = function (k, v) {
      if (this !== LS || !RAUM.test(k)) return setzen.call(this, k, v);
      zeiten[k] = Date.now(); merken();
      try { return setzen.call(this, k, v); }
      catch (e) {                                  // Speicher voll: alle anderen Räume freigeben, dann nochmal
        const raum = raumVon(k); weg(x => raumVon(x) !== raum);
        return setzen.call(this, k, v);
      }
    };
  } catch (e) {}
})();

// Herzschlag auf jeder Verbindung: Wird ein Handy weggewischt oder verliert das Netz, merkt die Gegenseite das bei
// WebRTC oft lange nicht und hält die tote Verbindung für offen. Darum schicken beide Seiten alle 4 Sekunden ein
// kleines Lebenszeichen; kommt 15 Sekunden lang gar nichts, wird die Verbindung geschlossen, und das Spiel
// verbindet sich wie bei jedem Abbruch neu. Die Lebenszeichen erreichen die Spiele selbst nicht.
(function () {
  if (typeof Peer === "undefined" || Peer.__puls) return;
  Peer.__puls = true;
  const TAKT = 4000, STILLE = 15000;
  function puls(c) {
    if (!c || c.__puls) return c; c.__puls = true;
    let zuletzt = Date.now(), timer = null;
    const emit = c.emit;
    c.emit = function (ev, d) {
      if (ev === "data") { zuletzt = Date.now(); if (d && d.__puls) return true; }
      if (ev === "open") { zuletzt = Date.now(); starten(); }
      if (ev === "close" || ev === "error") { clearInterval(timer); timer = null; }
      return emit.apply(this, arguments);
    };
    function starten() {
      if (timer) return;
      timer = setInterval(() => {
        if (!c.open) return;
        if (Date.now() - zuletzt > STILLE) { clearInterval(timer); timer = null; try { c.close(); } catch (e) {} return; }
        try { c.send({ __puls: 1 }); } catch (e) {}
      }, TAKT);
    }
    // Rückkehr aus dem Hintergrund: eingefrorene Zeit nicht als Stille werten, erst neu messen
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") zuletzt = Math.max(zuletzt, Date.now() - TAKT); });
    if (c.open) starten();
    return c;
  }
  const verbinden = Peer.prototype.connect;
  Peer.prototype.connect = function () { return puls(verbinden.apply(this, arguments)); };
  const emitPeer = Peer.prototype.emit;
  Peer.prototype.emit = function (ev, c) { if (ev === "connection") puls(c); return emitPeer.apply(this, arguments); };
})();
