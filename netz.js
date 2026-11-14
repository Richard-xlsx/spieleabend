// Gemeinsame Verbindungseinstellungen für alle Spiele (wird von jedem Spiel vor dessen Code geladen).
//
// Die Handys verbinden sich direkt miteinander (WebRTC über PeerJS). Sind sie in verschiedenen Netzen,
// zum Beispiel beide in mobilen Daten, klappt das oft nur über einen Umleitungsserver (TURN).
// Hier die Zugangsdaten eines TURN-Dienstes eintragen, z. B. von metered.ca:
//   Konto anlegen → im Dashboard eine TURN-App anlegen → „ICE Servers Array“ kopieren
//   und die Einträge mit "turn:" bzw. "turns:" unten in TURN einfügen.
// Achtung: Diese Datei ist öffentlich (GitHub Pages). Die Zugangsdaten sind dann für jeden lesbar;
// das ist bei TURN-Diensten für Webseiten so vorgesehen, verbraucht aber euer Kontingent, falls jemand sie kopiert.
// Bleibt die Liste leer, gelten die eingebauten Server von PeerJS (im selben WLAN reicht das).
window.SPIELEABEND_TURN = [
  // { urls: "turn:global.relay.metered.ca:80", username: "…", credential: "…" },
  // { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: "…", credential: "…" },
  // { urls: "turn:global.relay.metered.ca:443", username: "…", credential: "…" },
  // { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: "…", credential: "…" },
];

// Optionen für new Peer(…): mit eigenen TURN-Servern, sonst die Standardwerte von PeerJS
window.SPIELEABEND_PEER = function () {
  const turn = (window.SPIELEABEND_TURN || []).filter(s => s && s.urls && s.username);
  if (!turn.length) return { debug: 0 };
  return { debug: 0, config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.relay.metered.ca:80" }].concat(turn) } };
};
// Wie lange ein Mitspieler auf die Verbindung zum Spielleiter wartet, bevor er neu ansetzt (über TURN dauert es länger)
window.SPIELEABEND_WARTEN = 12000;
