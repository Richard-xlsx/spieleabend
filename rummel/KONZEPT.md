# Rummel: Minispiel-Party (Konzept)

Stand 25.11.2026. Noch nicht gebaut. Arbeitstitel **„Rummel“**, Ordner `rummel/`.

Idee: kurze Minispiele von 20 bis 40 Sekunden, bei denen man das Handy schüttelt, neigt, dreht, wischt oder einfach
schnell tippt. Alle spielen gleichzeitig auf dem eigenen Handy, danach gibt es eine Punktetafel. So entsteht das
Wii-Gefühl, nur ohne Konsole und Fernseher.

---

## 1. Ziele

- **Sofort verstanden.** Jedes Minispiel lässt sich in einem Satz erklären. Vor dem Start gibt es eine kurze Anleitung mit Bild, mehr nicht.
- **Kurz und knackig.** Ein Minispiel dauert höchstens 40 Sekunden. Eine ganze Partie dauert 10 bis 25 Minuten.
- **Jeder kann gewinnen.** Es gibt eine Mischung aus Bewegung, Geschick, Reaktion, Beobachten und etwas Glück. Oma soll gegen den Neffen eine echte Chance haben.
- **Lachen am Tisch.** Alle schütteln gleichzeitig wie wild oder halten den Atem an, wenn die Wurst gleich verbrennt.
- **Gerecht trotz Internet.** Jedes Handy misst sein Ergebnis selbst. Eine langsame Verbindung kostet deshalb keine Punkte.
- **Leicht erweiterbar.** Jedes Minispiel, hier „Bude“ genannt, ist eine eigene Datei. Neue Buden kommen einfach dazu.

---

## 2. Thema: Jahrmarkt

Ein Rummelplatz in der Abenddämmerung mit Lichterketten, gestreiften Markisen, Holzschildern und Drehorgelmusik.
Jedes Minispiel ist eine Bude. Gewinne gibt es in Form von **Losen**, und am Ende werden sie in der Preisbude eingelöst.

- **Stil:** wie ein altes Jahrmarktsplakat. Farben Creme, Karminrot, Petrol und Gold, mit kräftiger Schrift.
- **Technik:** 2D-Zeichnungen statt 3D. Das läuft auch auf älteren Handys flüssig.
- **Ton:** ein Drehorgel-Jingle, der wie die Kart-Musik direkt im Browser erzeugt wird, dazu Geräusche je Bude.
- **Vibration:** nur auf Android. Das iPhone erlaubt sie Webseiten nicht.

---

## 3. Ablauf einer Partie

1. **Lobby:** Name und Farbe wählen. Auf dem iPhone tippt man einmal auf **„Bewegung erlauben“** und testet mit „Wackel mal kurz ✓“, ob es klappt. Der Spielleiter wählt die Länge.
2. **Rundgang:** Eine Übersichtskarte des Rummelplatzes mit allen Buden. **Wer gerade Letzter ist, wählt aus 3 zufälligen Buden die nächste.** Das ist eine Aufholhilfe und gibt allen das Gefühl, mitzubestimmen. Nach 10 Sekunden wählt das Spiel selbst.
3. **Anleitung:** Höchstens 15 Sekunden mit einem Satz und einem kleinen bewegten Bild, zum Beispiel einer schüttelnden Hand. Wer bereit ist, tippt auf „Bereit“. Bei Bewegungsspielen wird dabei die Neigung genullt, denn jeder hält sein Handy anders.
4. **Countdown 3-2-1:** Er startet auf allen Handys im selben Moment (siehe 6.2).
5. **Spiel:** 20 bis 40 Sekunden. Oben läuft die Uhr, bei Live-Buden sieht man auch die anderen.
6. **Ergebnis:** Rangliste der Bude. Die Lose fliegen auf die Gesamttafel, und neue Rekorde werden gefeiert.
7. Danach geht es zurück zum Rundgang. Die **letzte Bude ist das Finale** und gibt doppelte Lose.
8. **Preisbude:** Siegerehrung wie in Kerker-Kart. Der Sieger bekommt den Riesenteddy, der Letzte einen Plastikring als Trostpreis. Dazu kommen Auszeichnungen wie „Schnellste Hand“, „Schüttelkönig“ oder „Ruhigste Hand“.

### Längen
| Länge | Buden | Dauer |
|---|---|---|
| Kurz | 5 | ca. 10 min |
| Normal | 8 | ca. 15 min |
| Lang | 12 | ca. 25 min |

### Lose je Bude
| Platz | 1 | 2 | 3 | 4 | 5 | 6 | 7–8 |
|---|---|---|---|---|---|---|---|
| Lose | 10 | 7 | 5 | 4 | 3 | 2 | 1 |

Bei Gleichstand gibt es die gleichen Lose. Mitmachen bringt immer mindestens 1 Los. Zu zweit gibt es 10 und 5 Lose.

### Weitere Spielweisen
- **Allein üben:** Jede Bude ist einzeln spielbar, mit persönlichem Rekord auf dem Handy. Das ist auch zum Testen praktisch.
- **Gemeinsamer Abend:** Rummel macht beim Abend mit (`abend.js`) wie die anderen Spiele.
- **Später:** „Eine Bude zwischendurch“ als Pause zwischen zwei großen Spielen des Abends.
- **Nachzügler:** Wer später kommt, schaut bei der laufenden Bude zu und spielt ab der nächsten mit.

---

## 4. Die Buden

Jede Bude nutzt eine andere Eingabe, damit es abwechslungsreich bleibt. Für jedes Bewegungsspiel gibt es einen
**Ersatz zum Tippen oder Ziehen**, für Handys ohne Sensor, eine abgelehnte Erlaubnis oder den Laptop. Der Ersatz ist so
abgestimmt, dass er etwa gleich stark ist.

### Paket 1: sechs Buden zum Start

| Bude | Eingabe | Dauer | Worum es geht |
|---|---|---|---|
| **Milchshake-Mixer** | Schütteln | 10 s | So schnell wie möglich schütteln, der Becher schäumt über. Zählt die Schüttler. |
| **Startschuss** | Reaktion | 3 Durchgänge | Auf die Glocke warten, dann sofort tippen. Wer zu früh tippt, verliert den Durchgang. Ab Durchgang 2 gibt es Täuschungen: Eine Hupe statt der Glocke heißt „nicht tippen!“. |
| **Entenangeln** | Neigen | 30 s | Den Haken durch Neigen über die schwimmenden Enten lenken und kurz stillhalten, dann beißt die Ente an. Unten auf den Enten stehen 1 bis 3 Punkte, die goldene Ente zählt 5. |
| **Dosenwerfen** | Wischen | 5 Bälle | Nach oben wischen, um zu werfen. Richtung und Tempo des Wischens bestimmen Ziel und Wucht. Gezählt werden die gefallenen Dosen, wer alle abräumt, bekommt einen Bonus. |
| **Bratwurst-Mutprobe** | Halten | 3 Würste | Finger drauflassen, dann grillt die Wurst. Loslassen nimmt sie vom Grill. Goldbraun gibt die meisten Punkte, verbrannt gibt null. Jede Wurst braucht anders lang. Hinweise sind Farbe, Zischen und Rauch. |
| **Hütchenspiel** | Beobachten | 3 Durchgänge | Die Kugel liegt unter einem von drei Hütchen, die immer schneller getauscht werden. Dann tippt man auf das richtige Hütchen. Ganz ohne Sensor, ideal für alle Generationen. |

Bei allen Buden in Paket 1 gilt: **Alle bekommen exakt dieselbe Aufgabe**, also dieselben Enten, Würste und
Hütchen-Wechsel. Das ist gerecht und macht das Vergleichen spannend.

### Paket 2: sechs weitere Buden, darunter Live-Buden und Teams

| Bude | Eingabe | Worum es geht |
|---|---|---|
| **Schießbude** | Zielen mit dem ganzen Handy (Kreisel), Tippen zum Schießen | Das Fadenkreuz folgt dem Handy wie der Zeiger bei der Wii. Man trifft Blechsterne und Windräder, wer den Teddy trifft, bekommt Abzug. Geschossen wird mit Korken, nicht mit Waffen. |
| **Zuckerwatte** | Handy im Kreis drehen | Dreht man gleichmäßig, wickelt sich die Watte auf. Dreht man zu schnell, reißt sie ab. Es gewinnt die größte Wolke. |
| **Kamelrennen** (live) | Wischen | Man rollt Kugeln in Löcher mit 1, 2 oder 3 Punkten, dann läuft das eigene Kamel weiter. **Alle Kamele laufen auf jedem Handy sichtbar nebeneinander.** Wer zuerst im Ziel ist, gewinnt. |
| **Tauziehen** (Teams, live) | Schütteln oder Tippen | Zwei Teams ziehen am Seil, wobei der Durchschnitt pro Person zählt, damit ungleiche Teams fair sind. Es geht über drei Durchgänge, und der Seilknoten wandert live. |
| **Glücksrad** | Tippen im richtigen Moment | Das Rad dreht sich, und man tippt, um es zu bremsen. Es rollt noch nach, deshalb muss man den Moment abpassen. Es gibt 3 Versuche, ein bisschen Glück gehört dazu. |
| **Riesenrad-Gedächtnis** | Beobachten | Gondeln mit Bildern fahren vorbei. Danach kommen Fragen wie „Welche Farbe hatte die Gondel mit dem Herz?“. |

### Paket 3: die großen Brocken und Extras

| Bude | Eingabe | Worum es geht |
|---|---|---|
| **Autoscooter** (live) | Neigen | Alle fahren in einer Arena und rempeln sich gegenseitig an. Es zählen Treffer, wer an die Bande gedrückt wird, verliert Punkte. Technik ähnlich wie bei Kerker-Kart. |
| **Geisterbahn** | Neigen | Es ist dunkel, und man lenkt den Lichtkegel einer Taschenlampe. Darin tauchen Gespenster auf, die man antippt. Kleine Schreckmomente, aber kindgerecht. |
| **Hau den Lukas** | Schütteln, dann Tippen | 3 Sekunden Schwung holen und im richtigen Moment zuschlagen. Erreicht man die Glocke, gibt es einen Bonus. |
| **Sackhüpfen** | Hüpfen mit Handy in der Hand | Wer schafft die meisten Hüpfer in 15 Sekunden? Das ist albern und laut. Der Spielleiter kann es ausschalten. |
| **Luftballon** | Pusten ins Mikrofon (Ersatz: Finger halten) | Den Ballon aufblasen, aber bevor er platzt aufhören. Die Grenze kennt niemand. Das Mikrofon braucht eine extra Erlaubnis, deshalb ist die Bude abschaltbar. |

---

## 5. Sicherheit und für alle spielbar

- **Kein Werfen und kein Schleudern.** Alle Bewegungen kommen aus dem Handgelenk. Vor jeder Bewegungs-Bude steht der Hinweis **„Handy gut festhalten!“**, und beim Schütteln zeigt das Bild beide Hände.
- **Hüpfen und Pusten lassen sich abschalten.** Nicht jeder will im Wohnzimmer hüpfen.
- **Große Tippflächen, klare Symbole** und Farben, die man auch mit Farbschwäche auseinanderhält, etwa zusätzlich Muster bei den Enten.
- **Bildschirm bleibt an:** Während der Partie verhindert die Seite, dass der Bildschirm ausgeht (Wake Lock). Ein gesperrtes Handy würde mitten in der Bude aussteigen.

---

## 6. Technik

### 6.1 Aufbau
```
rummel/
  index.html      Bildschirme, Stil, Skripte
  logic.js        Ablauf ohne Netz und Oberfläche: Phasen, Rundgang, Lose, Auszeichnungen (testbar mit node)
  app.js          Verbindung (PeerJS wie die anderen Spiele), Bildschirme, Uhrabgleich
  sensoren.js     Erlaubnis, Nullstellung, Schüttelzähler, Neigung, Drehung, Ersatz-Eingaben
  buden/*.js      eine Datei pro Bude, alle mit derselben Schnittstelle
```

Jede Bude meldet sich so an: `RUMMEL.bude({ id, name, eingabe, dauer, anleitung, besser: "hoch" | "niedrig", start(ctx), stopp() })`.
`ctx` liefert Zeichenfläche, Sensoren, Zufall mit gemeinsamem Startwert, Ton und `fertig(ergebnis)`.

### 6.2 Gerecht trotz Netz
- **Uhrabgleich:** Jedes Handy pingt den Spielleiter fünfmal und merkt sich die Antwort mit der kürzesten Laufzeit. So kennt es seinen Zeitunterschied zum Spielleiter auf wenige Millisekunden genau.
- **Gemeinsamer Start:** Der Spielleiter sagt „Start um 18:42:07,000 Spielleiter-Zeit“, und alle Handys zählen bis dahin herunter.
- **Jedes Handy rechnet selbst** und schickt am Ende nur sein Ergebnis. Eine Reaktionszeit wird also auf dem Handy gemessen, nicht beim Spielleiter.
- **Gleiche Aufgabe für alle:** Der Spielleiter verteilt einen Startwert für den Zufall. Daraus berechnen alle Handys dieselben Enten, Würste und Hütchen.
- **Plausibilitätsprüfung:** Ergebnisse jenseits des Möglichen, etwa 30 Schüttler pro Sekunde oder 50 ms Reaktionszeit, werden gekappt. Wer zu spät ist (Dauer + 5 s), bekommt 0.
- **Live-Buden** (Kamelrennen, Tauziehen, Autoscooter) schicken 10 bis 15 Mal pro Sekunde ihren Stand an den Spielleiter, der ihn an alle verteilt, so wie bei Kerker-Kart.

### 6.3 Sensoren
- **Erlaubnis:** Auf dem iPhone wird sie einmal in der Lobby per Tipp abgefragt. Ohne Erlaubnis gelten die Ersatz-Eingaben.
- **Schütteln:** Gezählt werden die Richtungswechsel, die über einer Schwelle liegen, nicht die rohe Stärke. Handys messen nämlich verschieden stark, und so ist es gerecht.
- **Neigen:** Die Neigung wird bei „Bereit“ genullt, mit etwas Glättung, damit nichts zittert.
- **Drehen und Zielen:** Über den Kreiselsensor. Das Fadenkreuz lässt sich jederzeit neu ausrichten, indem man zwei Finger auflegt.
- **Am Laptop:** Maus und Pfeiltasten statt Sensoren, praktisch zum Testen.

### 6.4 Testen
- `?test` als eigener Raumbereich, wie bei den anderen Spielen.
- `?bude=entenangeln&allein` startet eine Bude direkt.
- `?bots=3` fügt drei Mitspieler mit zufälligen, aber plausiblen Ergebnissen hinzu. Damit lässt sich eine ganze Partie ohne vier Handys durchspielen.
- Mit `node` lassen sich `logic.js` testen (Lose, Gleichstand, Rundgang, Nachzügler) und die Zähler in `sensoren.js` mit aufgezeichneten Bewegungsdaten.

---

## 7. Pakete

| Paket | Inhalt |
|---|---|
| **1** | Grundgerüst: Lobby, Abend, Rundgang, Anleitung, Countdown mit Uhrabgleich, Ergebnis, Preisbude, Sensoren mit Ersatz, Allein-Üben. Dazu die **6 Buden** aus Paket 1. Danach ist das Spiel fertig spielbar. |
| **2** | 6 weitere Buden mit Live-Buden und Teams, Auszeichnungen, Rekordliste je Bude. |
| **3** | Autoscooter, Geisterbahn, Hau den Lukas, Sackhüpfen und Luftballon, dazu „Eine Bude zwischendurch“ im gemeinsamen Abend. |

---

## 8. Offene Entscheidungen

1. **Thema und Name:**
   - **A** (Vorschlag): eigener Jahrmarkt „Rummel“.
   - **B**: Jahrmarkt im Verlies, bei dem die Helden aus Dungeons & Disappointments als Spielfiguren mitmachen, wie in Kerker-Kart.
2. **Wer wählt die nächste Bude:**
   - der Letzte (Vorschlag, als Aufholhilfe),
   - der Sieger der letzten Bude,
   - der Zufall
   - oder der Spielleiter.
3. **Hüpfen und Pusten:** Sollen diese Buden standardmäßig an oder aus sein?
4. **Spielfiguren:** Reichen Name und Farbe, oder soll jeder eine kleine Figur bekommen?
