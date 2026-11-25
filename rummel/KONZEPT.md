# Rummel: Brettspiel mit Minispielen (Konzept und Plan)

Stand 25.11.2026. Noch nicht gebaut. Ordner `rummel/`, für 2 bis 8 Leute, jeder am eigenen Handy.

Ein Rummelplatz ist das Spielbrett. Man würfelt, zieht über Felder voller Glück, Pech und Gemeinheiten und sammelt Lose.
Mit Losen kauft man Teddys, und wer am Ende die meisten Teddys hat, gewinnt. Nach jeder Runde spielen alle eine Bude, also
ein Minispiel. Dabei geht es nicht nur um flinke Finger: Man schubst sich von der Eisscholle, bietet geheim, blufft als
Taschendieb oder rettet sich gemeinsam mit dem Team.

---

## 1. Ziele

- **Ein ganzer Abendblock:** 15 bis 40 Minuten, je nach Länge.
- **Jeder kann gewinnen:** Das Brett, die Wetten und das Glück gleichen aus. Wer bei Geschick schwächer ist, kann bei Bluff, Taktik und Wetten punkten.
- **Niemand sitzt herum:** Wer ausscheidet, spielt weiter, zum Beispiel als Möwe, als Musikstopper oder als Störenfried.
- **Sofort verstanden:** Jede Bude lässt sich in einem Satz erklären, und vor jeder Bude gibt es eine kurze Anleitung mit Bild.
- **Gerecht trotz Internet:** Zeiten werden mit abgeglichener Uhr gemessen, und der Spielleiter hat keinen Vorteil (siehe 5).

## 2. Thema

Ein Jahrmarkt in der Abenddämmerung mit Lichterketten, gestreiften Markisen und Drehorgelmusik.

- **Stil:** wie ein altes Jahrmarktsplakat. Farben Creme, Karminrot, Petrol und Gold, mit kräftiger Schrift.
- **Zeichnung:** 2D, damit es auch auf älteren Handys flüssig läuft.
- **Figuren:** ein Spielkegel in der eigenen Farbe mit Anfangsbuchstaben.
- **Ton:** Drehorgel-Jingle und Geräusche, direkt im Browser erzeugt wie bei Kerker-Kart.

---

## 3. Das Spielbrett

**Aufbau:** Ein Rundweg mit 32 Feldern führt um den Platz, und in der Mitte stehen die Buden. Alle starten am Eingangstor
mit 10 Losen. Jedes Handy zeigt das ganze Brett, die eigene Figur ist hervorgehoben.

**Teddy-Stand:** Er steht auf einem Feld des Rundwegs. Wer daran vorbeizieht oder darauf landet, darf für 20 Lose einen
Teddy kaufen. Danach wandert der Stand an eine andere Stelle.

### Ablauf einer Runde
1. **Würfeln:** Alle würfeln gleichzeitig durch Schütteln oder Tippen. Danach ziehen die Figuren nacheinander, wer
   hinten liegt, zuerst. Für Entscheidungen auf einem Feld hat man 10 Sekunden Zeit.
2. **Wetten:** Jeder darf bis zu 5 Lose auf den Sieger der nächsten Bude setzen, auch auf sich selbst. Wer richtig liegt,
   bekommt den doppelten Einsatz.
3. **Bude:** Wer gerade Letzter ist, wählt aus 3 Buden, die zur Spielerzahl passen. Jede Bude kommt erst wieder dran,
   wenn alle anderen gespielt wurden.
4. **Lose:**
   - Jeder gegen jeden: Platz 1 bis 7 bekommt 10, 7, 5, 4, 3, 2 und 1 Lose.
   - Teams: Das Siegerteam bekommt je 8 Lose, das andere Team je 2.
   - Einer gegen alle: Gewinnt der Einzelne, bekommt er 15 Lose. Gewinnen die anderen, bekommen sie je 6.

### Felder
| Feld | Wirkung |
|---|---|
| Glück (blau) | +3 Lose |
| Pech (rot) | −3 Lose |
| Taschendieb | Klau einem Mitspieler deiner Wahl 5 Lose. |
| Karussell | Tausche den Platz mit einem Mitspieler deiner Wahl. |
| Wahrsagerin | Eine Gratiswette auf den Sieger der nächsten Bude. Liegt man richtig, gibt es 8 Lose. |
| Glücksrad | Drehen: zwischen −5 und +10 Lose, selten ein Teddy. |
| Zirkuszelt | Du bist in der nächsten „Einer gegen alle“-Bude der Einzelne. |
| Geisterbahn | Abkürzung durch den Tunnel für 5 Lose. |

### Länge und Ende
- **Länge:** Kurz 5 Runden (ca. 15 min), Normal 8 Runden (ca. 25 min), Lang 12 Runden (ca. 40 min).
- **Letzte Runde:** Alle Felder und die Bude zählen doppelt.
- **Preisbude:** Zum Schluss gibt es 3 Bonus-Teddys:
  - „Budenkönig“ für die meisten Lose aus Buden
  - „Glückspilz“ für die meisten Glücksfelder
  - „Wandervogel“ für die meisten gezogenen Felder

  Es gewinnt, wer die meisten Teddys hat, bei Gleichstand entscheiden die Lose.
- **Nachzügler:** Wer später kommt, schaut zu und steigt in der nächsten Runde mit dem Durchschnitt an Losen ein.

---

## 4. Die 14 Buden

Jede Bewegungssteuerung hat einen **Ersatz** zum Tippen oder Ziehen, für Handys ohne Sensor oder ohne Erlaubnis.
Jedes Bewegungsspiel zeigt den Hinweis „Handy gut festhalten“, und niemand muss etwas werfen.

| Bude | Art | Eingabe | ab | Worum es geht |
|---|---|---|---|---|
| **Versteigerung** | geheim | Tippen | 2 | Fünf Preise kommen nacheinander unter den Hammer, und jeder bietet geheim mit einem festen Budget. Bei Gleichstand bekommt keiner den Preis. |
| **Einzelgänger-Zahl** | geheim | Tippen | 3 | Jeder wählt geheim eine Zahl von 1 bis 15. Die höchste Zahl, die nur einer gewählt hat, gewinnt, und es geht über drei Durchgänge. |
| **Achterbahn der Gier** | geheim | Tippen | 2 | Die Punkte steigen, solange man sitzen bleibt, und man kann jederzeit abspringen. Wer beim Absturz noch sitzt, bekommt 0. Wer als Letzter vor dem Absturz abspringt, bekommt einen Bonus. |
| **Eisscholle** | Arena | Neigen | 2 | Die Scholle schmilzt, und man schubst die anderen ins Wasser. Wer reinfällt, fliegt als Möwe weiter und lässt Fische fallen, auf denen man ausrutscht. |
| **Farbrevier** | Arena | Neigen | 2 | Jeder färbt den Platz mit seiner Farbrolle und darf die Flächen der anderen übermalen. Farbbomben helfen, und nach 60 Sekunden gewinnt die größte Fläche. |
| **Leuchtspur** | Arena | Tippen links/rechts | 2 | Jeder zieht eine Linie hinter sich her. Wer gegen eine Spur fährt, scheidet aus. |
| **Reise nach Jerusalem** | Arena | Tippen | 3 | Wenn die Musik stoppt, schnell einen Stuhl antippen, es gibt immer einen zu wenig. Wer ausgeschieden ist, darf die Musik stoppen und dabei die anderen täuschen. |
| **Taschendieb** | Einer gegen alle | Daumen | 3 | Ein Spieler versteckt sich unter 30 Besuchern und muss 3 Geldbeutel klauen. Die anderen beobachten das Gewusel und haben 2 Verdächtigungen. |
| **Geisterbahn-Geist** | Einer gegen alle | Neigen | 3 | Der Geist bewegt sich unsichtbar durch die dunkle Bahn und sammelt Punkte. Die anderen suchen ihn mit Taschenlampen. |
| **Eimerkette** | Teams | Wischen | 4 | Der Eimer wandert wirklich von Handy zu Handy. Wer zu hastig wischt, verschüttet Wasser. |
| **Turmbau** | Teams | Ziehen | 4 | Die Teams setzen abwechselnd Bausteine auf einen wackelnden Turm. Das Team, bei dem der Turm umfällt, verliert. |
| **Boule** | reihum | Wischen | 2 | Die Kugel möglichst nah an die Zielkugel bringen. Man darf die Kugeln der anderen wegschießen. |
| **Greifautomat** | jeder für sich | Neigen und Tippen | 1 | Den Greifer steuern und die wertvollsten Preise herausholen. Der Griff hält mal besser, mal schlechter. |
| **Kellner-Tablett** | jeder für sich | Daumen und Neigen | 1 | Ein volles Tablett durchs Lokal tragen, ohne etwas fallen zu lassen. |

„ab“ ist die Mindestzahl der Spieler. Die Teams werden ausgelost, und bei ungerader Zahl zählt der Durchschnitt pro Person.
Die Buden aus dem ersten Entwurf (Milchshake, Startschuss usw.) fallen weg. Einzelne können später als schnelle
Zwischenrunden zurückkommen.

---

## 5. Technik

### 5.1 Dateien
```
rummel/
  index.html    Bildschirme und Stil
  logic.js      Brett, Runden, Felder, Lose, Teddys, Wetten und Budenwahl, ohne Netz (mit node testbar)
  app.js        Verbindung (PeerJS wie die anderen Spiele), Bildschirme, Brett-Zeichnung, Uhrabgleich
  sensoren.js   Erlaubnis, Nullstellung, Neigen, Schütteln, Wischen, Daumen-Ersatz
  live.js       gemeinsame Technik für Live-Buden: Eingaben sammeln, Takt beim Spielleiter, Zustand verteilen, glätten
  buden/*.js    eine Datei pro Bude
```
Jede Bude hat einen Teil für den Spielleiter (Regeln, Ablauf, Ergebnis) und einen Teil für jedes Handy (Anzeige und
Eingabe). Der Teil des Spielleiters kommt ohne Oberfläche aus und lässt sich deshalb mit node testen.

### 5.2 Wer rechnet was
- **Geheime Buden:** Die Handys schicken ihre Wahl, und der Spielleiter wertet aus. Die Absturzzeit der Achterbahn kennt nur der Spielleiter.
- **Live-Buden** (Arena, Geist, Turmbau, Boule):
  - Der Spielleiter rechnet das Spielfeld 30-mal pro Sekunde und schickt 15-mal pro Sekunde den Stand.
  - Die Handys schicken 20-mal pro Sekunde ihre Eingabe.
  - Die eigene Figur wird auf dem Handy vorausberechnet, damit die Steuerung nicht hinterherhinkt.
  - Die Eingabe des Spielleiters wird um die mittlere Laufzeit der anderen verzögert, damit er keinen Vorteil hat.
- **Taschendieb:** Das Gewusel entsteht auf jedem Handy gleich aus einem gemeinsamen Startwert. Nur die Position des Diebs wird verschickt.
- **Eimerkette:** Jedes Handy rechnet seinen Eimer selbst, und der Spielleiter reicht ihn ans nächste Handy weiter.
- **Jeder für sich** (Greifautomat, Kellner): Jedes Handy rechnet selbst mit dem gleichen Startwert, und am Ende zählt nur das Ergebnis.
- **Uhrabgleich und Zeitstempel:** Jedes Handy pingt den Spielleiter 5-mal und merkt sich die kürzeste Laufzeit. Bei der Reise nach Jerusalem und der Achterbahn entscheidet der Zeitstempel, nicht die Ankunft beim Spielleiter.
- **Physik:** Eisscholle, Boule und Farbrevier bekommen eine eigene einfache Kreisphysik. Für den Turmbau wird planck.js über ein CDN geladen.
- **Ausfall:**
  - Verlässt der Spielleiter das Spiel, übernimmt ein anderes Handy wie bei den anderen Spielen.
  - Eine laufende Bude wird abgebrochen und neu gestartet, der Stand auf dem Brett bleibt erhalten.
- **Wake Lock:** Der Bildschirm bleibt während der Partie an.

### 5.3 Testen
- `?test` als eigener Raumbereich.
- `?bots=3` fügt Mitspieler hinzu, die würfeln, wetten und jede Bude plausibel spielen.
- `?bude=eisscholle` startet eine Bude direkt.
- **node:** Tests für logic.js (Felder, Lose, Teddys, Wetten, Budenwahl je Spielerzahl, Nachzügler) und für die Spielleiter-Teile der Buden.
- **Playwright:** mehrere Browser-Fenster als Spieler, Bildschirmfotos auf Handygröße, keine JS-Fehler.

---

## 6. Umsetzungsplan

Nach jedem Schritt wird getestet, hochgeladen und ist online spielbar.

| Schritt | Inhalt | Danach |
|---|---|---|
| **1. Gerüst** | Ordner, Lobby (Name, Farbe, Länge), Verbindung, Uhrabgleich, Budensystem, Bots, `?bude=`. Erste Bude: **Einzelgänger-Zahl**. | Eine Bude ist mit Bots durchspielbar, aber noch ohne Brett. |
| **2. Spielbrett** | Brett mit Feldern, Würfeln, Teddy-Stand, Wetten, Budenwahl durch den Letzten, Preisbude, Nachzügler, Übernahme. **Karte auf der Startseite** und Teilnahme am gemeinsamen Abend. | Rummel steht unter Spieleabend, mit dem Hinweis „im Aufbau“. |
| **3. Geheime Buden** | **Versteigerung**, **Achterbahn der Gier** | Eine Partie mit 3 Buden ist komplett spielbar. |
| **4. Live-Technik und Arena 1** | sensoren.js, live.js, **Eisscholle** mit Möwen, **Reise nach Jerusalem** mit Musikstopper | Die ersten Bewegungs-Buden laufen. |
| **5. Arena 2** | **Farbrevier**, **Leuchtspur** | |
| **6. Einer gegen alle** | **Taschendieb**, **Geisterbahn-Geist** | |
| **7. Geschick** | **Boule**, **Greifautomat**, **Kellner-Tablett** | |
| **8. Teams** | **Eimerkette**, **Turmbau** | Alle 14 Buden sind fertig, und der Hinweis „im Aufbau“ fällt weg. |
| **9. Feinschliff** | Drehorgel und Geräusche, Abstimmung der Lose und Felder nach einem Testabend, Anleitungsbilder, LIESMICH | |

Die Reihenfolge geht vom Einfachen zum Schweren. Schritt 4 baut die Live-Technik, auf der die Schritte 5 bis 8 aufsetzen.

## 7. Festgelegt (änderbar)

- Thema „Rummel“ statt Verlies-Jahrmarkt.
- Die nächste Bude wählt der Letzte.
- Figuren sind Spielkegel mit Farbe und Anfangsbuchstaben.
- Hüpfen und Pusten entfallen.
