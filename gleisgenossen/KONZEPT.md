# Gleisgenossen (neu): offene Welt mit Modellbahn

Stand 16.11.2026. Ersetzt das bisherige Gleisgenossen (Monatsrunden auf Sechsecken). Die alte Fassung liegt in Git
(letzter Stand: Commit c0f542e „Gleisgenossen: Gleise abreißen“).

## Entscheidungen
- **Gemeinsame Welt:** Alle bauen auf derselben Karte.
- **Gemeinsame Kasse.**
- **Spielstand:** Man kann speichern und später weiterspielen. Wer ohne Speichern schließt, verwirft den Stand.
  Im Mehrspieler-Spiel speichert das Handy des Spielleiters.
- **Ordner und Name bleiben** (`gleisgenossen/`), damit alte Links weiter gehen.

## Spielidee
Man startet mit einem kleinen Gleiskreis, auf dem eine kleine Dampflok mit einem Wagen Runden fährt.
Jeder gefahrene Meter bringt Geld. Davon kauft man Gleisteile, Land und Verbesserungen für den Zug.
Es gibt kein Ende und kein Verlieren: Ziel ist eine immer größere, abwechslungsreichere Strecke.

### Warum die Strecke zählt
Bei reinem Geld pro Meter wäre die Form der Strecke egal (gleiches Tempo, gleiches Geld). Deshalb:
- **Kurven haben ein Tempolimit.** Der Zug bremst vor Kurven und beschleunigt danach wieder.
  Lange Geraden lassen ihn sein Höchsttempo erreichen und bringen so mehr Geld pro Minute.
- Später (Schritt 2): Bahnhöfe zahlen nach Entfernung, Bauwerke geben Boni beim Vorbeifahren, Steigungen bremsen.

### Karte
- Quadratisches Raster, 64 × 64 Felder, ein Feld = 10 m.
- Gelände: Wiese, Wald (bebaubar, Roden kostet extra), Wasser und Berge (erst mit Brücke und Tunnel in Schritt 2),
  Dörfer (Häuser, nicht bebaubar; in Schritt 2 mit Bahnhof).
- Die Karte ist in Grundstücke zu 8 × 8 Feldern geteilt. Man besitzt am Anfang die 2 × 2 in der Mitte und kauft
  angrenzende Grundstücke dazu. Jedes weitere wird teurer.

### Gleisteile (wie bei einer Holzeisenbahn)
| Teil | Preis | Lagen |
|---|---|---|
| Gerade | 20 T | 2 |
| Kurve (Viertelkreis) | 25 T | 4 |
| Kreuzung | 60 T | 1 |

- Feld antippen: Teil wird gebaut und so gedreht, dass es möglichst an vorhandene Gleise passt.
- Gleis antippen (gleiches Teil gewählt): drehen, kostenlos. Anderes Teil gewählt: ersetzen.
- Abreißen gibt die Hälfte zurück. Unter dem Zug kann man nicht bauen, drehen oder abreißen.
- Endet das Gleis, bremst der Zug und wartet am Ende. „Wenden“ dreht ihn um.

### Zug-Verbesserungen
| Stufe | Wirkung |
|---|---|
| Kessel | höheres Höchsttempo |
| Zugkraft | schneller beschleunigen (nach Kurven wichtig) |
| Kurvenlauf | schneller durch Kurven |
| Bremsen | später bremsen, länger schnell fahren |
| Wagen | +1 Wagen: mehr Geld pro Meter, aber schwerer (beschleunigt langsamer) |

Preise steigen mit jeder Stufe.

## Schritt 2 (16.11.2026, gebaut)
- **Geld:** 2 T + 1 T je Wagen pro 10 m (vorher 1 + 0,5 je Wagen), Startkasse 80 T.
- **Weiche** (80 T, 8 Lagen): Stamm, gerader und abzweigender Zweig. Mit „Schauen“ antippen stellt sie um,
  eine Lampe zeigt die Stellung (grün geradeaus, gelb abbiegen). Von den Zweigen kommend fährt der Zug immer durch.
- **Bahnhof** (150 T, wie eine Gerade): Der Zug hält 2,5 s. Es steigen bis zu 3 + 2 × Häuser im Umkreis von 2 Feldern ein
  (höchstens 6 Plätze je Wagen). Sie zahlen am nächsten **anderen** Bahnhof 0,5 T pro Feld Fahrt.
- **Brücke und Tunnel:** Eine Gerade auf Wasser wird zur Brücke (+100 T), im Berg zum Tunnel (+180 T).
- **Bauwerke** neben der Strecke, wirken einmal pro Durchfahrt der Lok im Umkreis:
  | Bauwerk | Preis | Umkreis | Wirkung |
  |---|---|---|---|
  | Wasserturm | 150 T | 1 | 20 s lang 30 % schneller |
  | Windmühle | 300 T | 2 | 8 Felder Fahrgeld extra |
  | Burg | 900 T | 3 | 20 Felder Fahrgeld extra |
  | Riesenrad | 2.200 T | 3 | 45 Felder Fahrgeld extra |
  Kette: Bauwerke innerhalb von 200 m nacheinander geben je +25 % (höchstens × 2).
- **Ziele:** 16 Ziele mit Belohnung (1 km fahren, Bahnhof bauen, zwei Dörfer verbinden, Brücke, Tunnel, 100 km/h …),
  das nächste offene steht als gelbe Leiste oben.
- Große Kurven sind verschoben (sie würden mehrere Felder belegen); Kurvenlauf als Verbesserung deckt das Tempo ab.

## Schritte
1. **Kern (dieser Stand):** Karte, Startkreis, fahrender Zug, Geld pro Meter, Kurven bremsen, Gleisteile bauen,
   drehen, ersetzen, abreißen, Zug-Verbesserungen, Land kaufen, Speichern und Fortsetzen. Ein Handy.
2. **Ausbau (gebaut, siehe oben):** Weichen, Bahnhöfe in Dörfern (Fahrgäste zahlen nach Entfernung), Brücken über Wasser,
   Tunnel durch Berge, kaufbare Sehenswürdigkeiten (Wasserturm, Burg, Windmühle, Aussichtspunkt) mit Boni,
   Aufträge und Meilensteine.
3. **Mehrspieler:** Gemeinsame Welt auf mehreren Handys (Lobby wie bei den anderen Spielen), mehrere Züge,
   Signale gegen Zusammenstöße. Das Handy des Spielleiters rechnet und speichert.

## Simulation (Bot kauft immer die billigste Zug-Verbesserung, baut nichts)
| | 1 Min | 10 Min | 30 Min |
|---|---|---|---|
| Schritt 1, Startkreis 3 × 3 | 68 T/Min | 93 T/Min | 212 T/Min |
| Schritt 1, großer Kreis 12 × 5 | 87 T/Min | 194 T/Min | 404 T/Min |
| Schritt 2, Startkreis 3 × 3 | 137 T/Min | 306 T/Min | 610 T/Min |
| Schritt 2, großer Kreis 12 × 5 | 190 T/Min | 605 T/Min | 1.213 T/Min |

Die Streckenform zählt: lange Geraden verdoppeln etwa die Einnahmen. Bahnhöfe und Bauwerke kommen noch dazu.
