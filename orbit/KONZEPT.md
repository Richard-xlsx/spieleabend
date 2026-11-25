# Orbit: Brettspiel mit Minispielen auf einer Raumstation (Konzept und Plan)

Stand 25.11.2026. Schritt 1 bis 4 sind gebaut (Brett, drei geheime Missionen, Live-Technik, Asteroid und Rettungskapseln). Ordner `orbit/`, für 2 bis 8 Leute, jeder am eigenen Handy.

Eine Raumstation ist das Spielbrett. Man würfelt, zieht durch die Module des Rings und sammelt **Energiezellen**. Mit
Energie kauft man beim Händlerschiff **Sternkristalle**, und wer am Ende die meisten Kristalle hat, gewinnt. Nach jeder
Runde spielen alle eine **Mission**, also ein Minispiel. Dabei geht es nicht nur um flinke Finger: Man schubst sich vom
zerfallenden Asteroiden, bietet geheim beim Schrotthändler, versteckt sich als Gestaltwandler unter Robotern oder reicht
im Team den Treibstoff weiter.

---

## 1. Ziele

- **Ein ganzer Abendblock:** 15 bis 40 Minuten, je nach Länge.
- **Jeder kann gewinnen:** Brett, Wetten und Glück gleichen aus. Wer bei Geschick schwächer ist, kann bei Bluff, Taktik und Wetten punkten.
- **Niemand sitzt herum:** Wer ausscheidet, spielt weiter, zum Beispiel als Drohne oder als der, der den Alarm auslöst.
- **Sofort verstanden:** Jede Mission lässt sich in einem Satz erklären. Vorher gibt es eine kurze Anleitung mit Bild.
- **Gerecht trotz Internet:** Zeiten werden mit abgeglichener Uhr gemessen, und der Spielleiter hat keinen Vorteil (siehe 5).

## 2. Thema

Eine Raumstation im Orbit um einen fremden Planeten, retro-futuristisch wie ein altes Science-Fiction-Plakat.

- **Farben:** Nachtblau mit Sternen, dazu Neon-Türkis, Signalorange und ein warmes Gelb für Kristalle.
- **Zeichnung:** 2D, damit es auch auf älteren Handys flüssig läuft.
- **Figuren:** ein kleiner Astronautenhelm in der eigenen Farbe mit Anfangsbuchstaben.
- **Ton:** Synthesizer-Klänge und Funkpiepser, direkt im Browser erzeugt wie bei Kerker-Kart.

---

## 3. Das Spielbrett

**Aufbau:** Ein Ringkorridor mit 32 Modulen führt um die Station. In der Mitte liegt die Andockbucht, wo die Missionen
starten. Alle beginnen an der Luftschleuse mit 10 Energiezellen. Jedes Handy zeigt die ganze Station, der eigene Helm ist
hervorgehoben.

**Händlerschiff:** Es dockt an einem Modul des Rings an. Wer daran vorbeizieht oder darauf landet, darf bis zu 3
Sternkristalle für je 20 Energie kaufen. Danach legt das Schiff ab und dockt mindestens 8 Module weiter weg an.

### Ablauf einer Runde
1. **Würfeln:** Alle würfeln gleichzeitig mit zwei Würfeln durch Tippen oder Schütteln. Danach ziehen
   die Helme nacheinander, wer hinten liegt, zuerst. Für Entscheidungen auf einem Feld hat man 10 Sekunden Zeit.
2. **Missionswahl:** Wer gerade Letzter ist, wählt aus 3 Missionen, die zur Spielerzahl passen. Jede Mission kommt erst
   wieder dran, wenn alle anderen gespielt wurden.
3. **Wetten:** Jeder darf bis zu 5 Energie auf den Sieger der gewählten Mission setzen, auch auf sich selbst. Wer richtig
   liegt, bekommt den doppelten Einsatz. Die Wetten der anderen bleiben bis zum Ergebnis verdeckt.
4. **Mission** und danach **Energie:**
   - Jeder gegen jeden: Platz 1 bis 7 bekommt 10, 7, 5, 4, 3, 2 und 1 Energie.
   - Teams: Das Siegerteam bekommt je 8 Energie, das andere Team je 2.
   - Einer gegen alle: Gewinnt der Einzelne, bekommt er 15 Energie. Gewinnen die anderen, bekommen sie je 6.

### Felder
| Feld | Wirkung |
|---|---|
| Versorgungskapsel (türkis) | +3 Energie |
| Meteoritenschauer (orange) | −3 Energie |
| Weltraumpirat | Klau einem Mitspieler deiner Wahl 5 Energie. |
| Teleporter | Tausche den Platz mit einem Mitspieler deiner Wahl. |
| Bordcomputer | Eine Gratiswette auf den Sieger der nächsten Mission. Liegt man richtig, gibt es 8 Energie. |
| Gravitationsanomalie | Der Zufall entscheidet: zwischen −5 und +10 Energie, selten ein Kristall. |
| Alien-Feld | Du bist in der nächsten „Einer gegen alle“-Mission der Einzelne. |
| Wurmloch | Abkürzung zur anderen Seite des Rings für 5 Energie. |

### Länge und Ende
- **Länge:** Kurz 5 Runden (ca. 15 min), Normal 8 Runden (ca. 25 min), Lang 12 Runden (ca. 40 min).
- **Letzte Runde:** Alle Felder und die Mission zählen doppelt.
- **Siegerehrung:** Zum Schluss gibt es 3 Bonus-Kristalle:
  - „Missionsheld“ für die meiste Energie aus Missionen
  - „Glückskind“ für die meisten Versorgungskapseln
  - „Weltenbummler“ für die meisten gezogenen Module

  Es gewinnt, wer die meisten Kristalle hat, bei Gleichstand entscheidet die Energie.
- **Nachzügler:** Wer später kommt, schaut zu und steigt in der nächsten Runde mit dem Durchschnitt an Energie ein.

---

## 4. Die 14 Missionen

Jede Bewegungssteuerung hat einen **Ersatz** zum Tippen oder Ziehen, für Handys ohne Sensor oder ohne Erlaubnis.
Jedes Bewegungsspiel zeigt den Hinweis „Handy gut festhalten“, und niemand muss etwas werfen.

| Mission | Art | Eingabe | ab | Worum es geht |
|---|---|---|---|---|
| **Schrotthändler** | geheim | Tippen | 2 | Fünf seltene Ersatzteile (3, 4, 6, 8 und 12 Punkte, in zufälliger Reihenfolge) werden versteigert, und jeder bietet geheim aus 30 Credits für alle Teile. Bei Gleichstand bekommt keiner das Teil. |
| **Funkfrequenz** | geheim | Tippen | 3 | Jeder wählt geheim eine Frequenz von 1 bis 15. Wer allein auf der höchsten Frequenz sendet, wird gehört und bekommt so viele Punkte. Es geht über drei Durchgänge. |
| **Reaktor-Countdown** | geheim | Tippen | 2 | Die Punkte steigen, solange man am Reaktor bleibt, immer schneller. Man kann jederzeit in die Rettungskapsel springen. Wer bei der Explosion (nach 3 bis 18 Sekunden) noch drin ist, bekommt 0. Wer als Letzter vorher springt, bekommt 25 Bonuspunkte. Drei Durchgänge. |
| **Zerfallender Asteroid** | Arena | Neigen | 2 | Der Asteroid bröckelt, und man schubst die anderen ins All. Wer abtreibt, wird zur Drohne und lässt Ölflecken fallen, auf denen man rutscht. |
| **Terraforming** | Arena | Neigen | 2 | Jeder begrünt den Planeten in seiner Farbe und darf die Flächen der anderen übermalen. Saatbomben helfen, und nach 60 Sekunden gewinnt die größte Fläche. |
| **Ionenspur** | Arena | Tippen links/rechts | 2 | Jeder zieht eine leuchtende Spur hinter sich her. Wer gegen eine Spur fliegt, scheidet aus. |
| **Rettungskapseln** | Arena | Tippen | 3 | Wenn der Alarm losgeht, schnell eine Kapsel antippen, es gibt immer eine zu wenig. Wer raus ist, löst den nächsten Alarm aus und darf dabei täuschen. |
| **Gestaltwandler** | Einer gegen alle | Daumen | 3 | Ein Alien versteckt sich unter 30 Wartungsrobotern und muss 3 Konsolen sabotieren. Die Crew beobachtet das Gewusel und hat 2 Verdächtigungen. |
| **Alien im Frachtraum** | Einer gegen alle | Neigen | 3 | Das Alien schleicht unsichtbar durch den dunklen Frachtraum und sammelt Punkte. Die Crew sucht es mit Helmlampen. |
| **Treibstoffkette** | Teams | Wischen | 4 | Der Kanister wandert wirklich von Handy zu Handy. Wer zu hastig wischt, verursacht ein Leck. |
| **Mondbasis** | Teams | Ziehen | 4 | Die Teams setzen abwechselnd Bauteile auf einen Turm bei schwacher Schwerkraft. Das Team, bei dem der Turm umkippt, verliert. |
| **Planeten-Boule** | reihum | Wischen | 2 | Die Kugel möglichst nah an den Zielmond bringen. Die Schwerkraft kleiner Planeten lenkt die Bahn ab, und man darf die Kugeln der anderen wegschießen. |
| **Greifarm** | jeder für sich | Neigen und Tippen | 1 | Mit dem Greifarm der Station den wertvollsten Weltraumschrott einfangen. Der Griff hält mal besser, mal schlechter. |
| **Bordküche** | jeder für sich | Daumen und Neigen | 1 | Ein Tablett durch die Station tragen. In der Schwerelosigkeit wollen die Becher davonschweben. |

„ab“ ist die Mindestzahl der Spieler. Die Teams werden ausgelost, und bei ungerader Zahl zählt der Durchschnitt pro Person.

---

## 5. Technik

### 5.1 Dateien
```
orbit/
  index.html      Bildschirme und Stil
  logic.js        Brett, Runden, Felder, Energie, Kristalle, Wetten und Missionswahl, ohne Netz (mit node testbar)
  app.js          Verbindung (PeerJS wie die anderen Spiele), Bildschirme, Brett-Zeichnung, Uhrabgleich
  sensoren.js     Erlaubnis, Nullstellung, Neigen, Schütteln, Wischen, Daumen-Ersatz
  live.js         gemeinsame Technik für Live-Missionen: Eingaben sammeln, Takt beim Spielleiter, Zustand verteilen, glätten
  missionen/*.js  eine Datei pro Mission
```
Jede Mission hat einen Teil für den Spielleiter (Regeln, Ablauf, Ergebnis) und einen Teil für jedes Handy (Anzeige und
Eingabe). Der Teil des Spielleiters kommt ohne Oberfläche aus und lässt sich deshalb mit node testen.

### 5.2 Wer rechnet was
- **Geheime Missionen:** Die Handys schicken ihre Wahl, und der Spielleiter wertet aus. Den Zeitpunkt der Reaktor-Explosion kennt nur der Spielleiter.
- **Live-Missionen** (Arena, Alien im Frachtraum, Mondbasis, Planeten-Boule):
  - Der Spielleiter rechnet das Spielfeld 30-mal pro Sekunde und schickt 15-mal pro Sekunde den Stand.
  - Die Handys schicken 20-mal pro Sekunde ihre Eingabe.
  - Die eigene Figur wird auf dem Handy vorausberechnet, damit die Steuerung nicht hinterherhinkt.
  - Die Eingabe des Spielleiters wird um die mittlere Laufzeit der anderen verzögert, damit er keinen Vorteil hat.
- **Gestaltwandler:** Das Gewusel der Roboter entsteht auf jedem Handy gleich aus einem gemeinsamen Startwert. Nur die Position des Aliens wird verschickt.
- **Treibstoffkette:** Jedes Handy rechnet seinen Kanister selbst, und der Spielleiter reicht ihn ans nächste Handy weiter.
- **Jeder für sich** (Greifarm, Bordküche): Jedes Handy rechnet selbst mit dem gleichen Startwert, und am Ende zählt nur das Ergebnis.
- **Uhrabgleich und Zeitstempel:** Jedes Handy pingt den Spielleiter 5-mal und merkt sich die kürzeste Laufzeit. Bei Rettungskapseln und Reaktor-Countdown entscheidet der Zeitstempel, nicht die Ankunft beim Spielleiter.
- **Physik:** Asteroid, Planeten-Boule und Terraforming bekommen eine eigene einfache Kreisphysik. Für die Mondbasis wird planck.js über ein CDN geladen.
- **Ausfall:**
  - Verlässt der Spielleiter das Spiel, übernimmt ein anderes Handy wie bei den anderen Spielen.
  - Eine laufende Mission wird abgebrochen und neu gestartet, der Stand auf dem Brett bleibt erhalten.
- **Wake Lock:** Der Bildschirm bleibt während der Partie an.

### 5.3 Testen
- `?test` als eigener Raumbereich.
- `?bots=3` fügt Mitspieler hinzu, die würfeln, wetten und jede Mission plausibel spielen.
- `?mission=asteroid` startet eine Mission direkt.
- **node:** Tests für logic.js (Felder, Energie, Kristalle, Wetten, Missionswahl je Spielerzahl, Nachzügler) und für die Spielleiter-Teile der Missionen.
- **Playwright:** mehrere Browser-Fenster als Spieler, Bildschirmfotos auf Handygröße, keine JS-Fehler.

---

## 6. Umsetzungsplan

Nach jedem Schritt wird getestet, hochgeladen und ist online spielbar.

| Schritt | Inhalt | Danach |
|---|---|---|
| **1. Gerüst** | Lobby (Name, Farbe), Verbindung, Uhrabgleich, Missionssystem, Bots, `?mission=`. Erste Mission: **Funkfrequenz**. | Eine Mission ist mit Bots durchspielbar, aber noch ohne Brett. |
| **2. Spielbrett** | Station mit Modulen, Würfeln, Händlerschiff, Wetten, Missionswahl durch den Letzten, Siegerehrung, Nachzügler, Übernahme. **Karte auf der Startseite** und Teilnahme am gemeinsamen Abend. | Orbit steht unter Spieleabend, mit dem Hinweis „im Aufbau“. |
| **3. Geheime Missionen** | **Schrotthändler**, **Reaktor-Countdown** | Eine Partie mit 3 Missionen ist komplett spielbar. |
| **4. Live-Technik und Arena 1** | sensoren.js, live.js, **Zerfallender Asteroid** mit Drohnen, **Rettungskapseln** mit Alarmauslöser | Die ersten Bewegungs-Missionen laufen. |
| **5. Arena 2** | **Terraforming**, **Ionenspur** | |
| **6. Einer gegen alle** | **Gestaltwandler**, **Alien im Frachtraum** | |
| **7. Geschick** | **Planeten-Boule**, **Greifarm**, **Bordküche** | |
| **8. Teams** | **Treibstoffkette**, **Mondbasis** | Alle 14 Missionen sind fertig, und der Hinweis „im Aufbau“ fällt weg. |
| **9. Feinschliff** | Synthesizer-Klänge, Abstimmung von Energie und Feldern nach einem Testabend, Anleitungsbilder, LIESMICH | |

Die Reihenfolge geht vom Einfachen zum Schweren. Schritt 4 baut die Live-Technik, auf der die Schritte 5 bis 8 aufsetzen.

## 7. Festgelegt (änderbar)

- Thema Raumstation, Name „Orbit“. Der erste Entwurf als Jahrmarkt „Rummel“ ist damit ersetzt.
- Die nächste Mission wählt der Letzte, gewettet wird danach (man weiß also, worauf man wettet).
- Zwei Würfel und bis zu 3 Kristalle pro Händlerbesuch: Mit einem Würfel kam man in Simulationen kaum am Händler vorbei.
- Ohne Entscheidung in 10 Sekunden gilt: Kristalle kaufen, beim Piraten den Reichsten bestehlen, nicht tauschen, nicht springen.
- Nach dem Missionsergebnis geht es nach 25 Sekunden von selbst zurück aufs Brett.
- Schrotthändler: Übrige Credits zählen am Ende nicht. Wer bei Gleichstand leer ausgeht, zahlt auch nichts.
- Reaktor-Countdown: Wer schon gesprungen ist, sieht man erst bei der Auflösung. Ein Sprung zählt mit dem Zeitstempel des Handys, der aber höchstens 1 Sekunde vor der Ankunft beim Spielleiter liegen darf.
- Zerfallender Asteroid: Es zählt die Zeit auf dem Asteroiden. „Rammen“ gibt einen Stoß (alle 1,8 s). Ab 20 Sekunden schrumpft der ganze Asteroid, damit jede Runde nach etwa 30 bis 60 Sekunden endet (spätestens nach 90). Drohnen lassen alle 2,2 Sekunden Öl fallen.
- Rettungskapseln: Ohne Auslöser kommt der Alarm nach 2,5 bis 6,5 Sekunden. Der Auslöser hat 9 Sekunden und 2 Testalarme. Der Alarm wird 0,4 Sekunden vorher angekündigt und erscheint auf allen Handys gleichzeitig. Beim Testalarm öffnen sich die Kapseln genauso, nur Farbe und Text sind anders.
- Steuerung: Neigen mit Nullstellung zu Beginn jeder Mission, umschaltbar auf einen Daumen-Joystick (die Wahl merkt sich das Handy). Am Rechner gehen auch Pfeiltasten.
- Live-Übertragung: Das Handy zeigt die anderen 0,1 Sekunden in der Vergangenheit, glatt zwischen zwei Bildern. Die eigene Figur wird nach vorn gerechnet.
- Der Startwert einer Mission bleibt beim Spielleiter, damit niemand die Explosion vorausberechnen kann. Missionen, die ihn auf allen Handys brauchen (z. B. Gestaltwandler), geben ihn ausdrücklich frei.
- Figuren sind Astronautenhelme mit Farbe und Anfangsbuchstaben.
