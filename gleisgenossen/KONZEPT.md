# Gleisgenossen (neu): offene Welt mit Modellbahn

Stand 16.11.2026. Ersetzt das bisherige Gleisgenossen (Monatsrunden auf Sechsecken). Die alte Fassung liegt in Git
(letzter Stand: Commit c0f542e „Gleisgenossen: Gleise abreißen“).

## Entscheidungen
- **Gemeinsame Welt:** Alle bauen auf derselben Karte.
- **Eigener Start, später zusammentun** (Änderung vom 16.11.2026, ersetzt „gemeinsame Kasse“): Jeder startet als eigene
  Bahn mit Startbereich, Gleiskreis, Zug und Kasse. Bahnen können sich zu einer Genossenschaft zusammentun.
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

## Schritt 3 (16.11.2026, gebaut): zusammen spielen
- **Karte nach Spielerzahl:** allein 64 × 64, zu zweit 80 × 80, zu dritt und viert 96 × 96, zu fünft und sechst 112 × 112 Felder.
  Startbereiche (2 × 2 Grundstücke) liegen gleichmäßig im Kreis um die Mitte, ohne Wasser, Berge und Dörfer.
- **Jede Bahn für sich:** eigene Kasse (80 T), eigenes Land, eigene Ziele, eigener Zug in der Spielerfarbe.
  Bauen, Abreißen und Weichen stellen nur auf eigenem Land; Züge fahren nur auf Gleisen ihrer Bahn.
- **Zusammentun (👥):** Eine Bahn lädt ein, die andere nimmt an. Die einladende Bahn nimmt die andere auf:
  Kassen, Land, Gleise, erreichte Ziele und Zähler werden zusammengelegt, der Name wird „Genossenschaft …“.
  Ab dann fahren alle Züge im ganzen gemeinsamen Netz. Der Landpreis zählt nur zugekauftes Land.
- **Mehrere Züge in einem Netz:** Ein Zug hält vor einem Feld, auf dem ein anderer Zug steht. Bei Gegenverkehr warten
  beide; dann hilft „Zug wenden“.
- **Verbindung:** Lobby mit Code, Link und QR-Code (bis 6 Bahnen). Das Handy des Spielleiters rechnet und schickt
  alle 0,3 s Züge und Kassen, nach jeder Aktion den ganzen Stand. Mitspieler rechnen dazwischen selbst weiter.
  Lädt der Spielleiter neu, öffnet er den Raum mit dem laufenden Spiel wieder (Sitzung im Tab).
  Mitspieler, die neu laden, kommen automatisch zurück. Wer in ein laufendes Spiel kommt, übernimmt eine Bahn,
  die gerade niemand steuert, oder schaut zu.
- **Leitung übernehmen** (16.11.2026): Die Verbindungs-ID des Spielleiters ist Raumcode + Leitungsnummer.
  Ist der Spielleiter länger als 8 s nicht erreichbar (oder hat er beendet), erscheint bei allen Mitspielern
  „Leitung übernehmen“. Wer tippt, macht mit seiner Kopie des Spielstands unter der nächsten Nummer weiter;
  die anderen probieren abwechselnd alte und nächste Nummer und finden ihn von selbst. Tippen zwei gleichzeitig,
  wird der zweite wieder Mitspieler. Ein alter Spielleiter, der zurückkommt (Neuladen) oder ohne Mitspieler dasteht,
  prüft alle 15 s, ob es schon eine neue Leitung gibt, und spielt dann als Mitspieler weiter.
- **Speichern:** nur der Spielleiter (oder wer allein spielt). „Raum öffnen und weiterspielen“ öffnet den gespeicherten
  Stand im selben Raumcode; Mitspieler finden ihre Bahn über ihre Geräte-ID oder übernehmen sie.
- Alte Spielstände (Schritt 1 und 2) werden beim Laden zu einer Bahn umgebaut.

## Schritt 4 (Plan vom 16.11.2026, noch nicht gebaut): schönere Welt, Hügel, Mitfahren
Schwächen des jetzigen Aussehens: Der Boden ist ein Schachbrett aus Klötzen, alles liegt auf einer Höhe, Berge sind Kegelhaufen,
Wasser hat eckige Ränder, die Startwiese ist leer, und am Kartenrand endet die Welt wie eine Tischkante.

**4a Landschaft und Hügel**
- Boden als ein durchgehendes Gelände mit weichen Farbverläufen (Wiese hell und dunkel, Sand am Ufer, Erde unter Bäumen).
  Raster nur beim Bauen; fremdes Land nur beim Bauen abgedunkelt.
- Wasser bewegt, mit Ufer, Schilf, Enten. Mehrere Baumarten, die sich im Wind wiegen. Berge als Felsmassiv mit Schnee.
- Rund um die Karte eine Landschaft, die im Dunst verschwindet; Himmel mit ziehenden Wolken.
- Hügel technisch: ganzzahlige Höhen an den Feldecken, benachbarte Ecken unterscheiden sich höchstens um 1.
  Die Gleishöhe an einer Feldkante ist der Mittelwert ihrer zwei Ecken, dazwischen linear. Damit passen alle Teile
  ohne Extra-Rampen, Kreuzungen treffen sich in der Mitte auf gleicher Höhe, und eine Gerade steigt höchstens 1 Stufe.
  Bahnhöfe brauchen gleiche Höhe an beiden Enden. Fluss und Wasser liegen auf Höhe 0 (Täler), Berge bleiben Tunnelfelder.
- Fahren: bergauf langsamer, bergab schneller (etwas über Höchsttempo). Aussicht: je Höhenstufe etwa +10 % Geld pro Meter.
  Bauwerke auf einer Kuppe wirken ein Feld weiter. Ein kleiner Hügel in jedem Startbereich. Alte Spielstände bleiben flach.

**4b Mitfahren und Kameras** (🎥 wechselt: Frei → Folgen → Mitfahren → Kino)
- Mitfahren: Blick vom Führerstand, Kessel und Schlot im Bild, Kamera schaut in Kurven voraus und neigt sich mit der Steigung (gedämpft).
  Tunnel innen dunkel mit Lampen. Anzeige: Tacho, nächster Bahnhof, Knopf für die nächste eigene Weiche, Pfeife.
- Kino: wechselnde Blickwinkel am Gleis, von Brücken und Hügeln, hinterher; für den Fernseher am Spieleabend.
- Bei anderen mitfahren: Zug antippen.

**4c Details an der Strecke**
- Prellbock an Gleisenden, Telegrafenmasten, Weichenhebel, Bauvorschau, Teile „plumpsen“ mit Staubwolke hin.
- Bahnhöfe mit Bank, Uhr, Lampen und sichtbar wartenden Fahrgästen; Bahnhof wächst mit den Fahrgästen
  (Haltestelle → Bahnhofshaus → Uhrturm). Leute in den Wagenfenstern.
- Dörfer mit Kirche, Gärten, Zäunen, Wegen, Schornsteinrauch. Feldwege zwischen Dörfern, Bahnübergang mit Schranke.
- Felder, Heuballen, Kühe und Schafe, Vögel.

**4d Stimmung**
- Tag und Nacht (für alle gleich, aus der Spielzeit), Fenster, Laternen und Loklampe leuchten. Wetter und Jahreszeiten optisch.
- Geräusche im Browser erzeugt (abschaltbar): Schnaufen nach Tempo, Pfeife, Schienenstöße, Brücke, Vögel.
- Deko kaufen (5–30 T); Deko nahe Bahnhof lockt etwas mehr Fahrgäste. Dörfer mit Bahnanschluss wachsen langsam.

**Leistung:** Grafikstufe „Einfach / Schön“, die sich selbst wählt (Schatten, Wind, Wolken nur bei „Schön“).
Das durchgehende Gelände ist billiger als die Klötze jetzt. Keine neuen Bibliotheken.

## Schritte
1. **Kern (dieser Stand):** Karte, Startkreis, fahrender Zug, Geld pro Meter, Kurven bremsen, Gleisteile bauen,
   drehen, ersetzen, abreißen, Zug-Verbesserungen, Land kaufen, Speichern und Fortsetzen. Ein Handy.
2. **Ausbau (gebaut, siehe oben):** Weichen, Bahnhöfe in Dörfern (Fahrgäste zahlen nach Entfernung), Brücken über Wasser,
   Tunnel durch Berge, kaufbare Sehenswürdigkeiten (Wasserturm, Burg, Windmühle, Aussichtspunkt) mit Boni,
   Aufträge und Meilensteine.
3. **Mehrspieler (gebaut, siehe oben):** jeder mit eigener Bahn, später zusammentun; Züge halten vor anderen Zügen.
   Leitung übernehmen, wenn der Spielleiter weg ist. Echte Signale und Ausweichstellen könnten später kommen.
4. **Schönere Welt (Plan, siehe oben):** Landschaft mit Hügeln, Mitfahren und Kino, Details, Stimmung.

## Simulation (Bot kauft immer die billigste Zug-Verbesserung, baut nichts)
| | 1 Min | 10 Min | 30 Min |
|---|---|---|---|
| Schritt 1, Startkreis 3 × 3 | 68 T/Min | 93 T/Min | 212 T/Min |
| Schritt 1, großer Kreis 12 × 5 | 87 T/Min | 194 T/Min | 404 T/Min |
| Schritt 2, Startkreis 3 × 3 | 137 T/Min | 306 T/Min | 610 T/Min |
| Schritt 2, großer Kreis 12 × 5 | 190 T/Min | 605 T/Min | 1.213 T/Min |

Die Streckenform zählt: lange Geraden verdoppeln etwa die Einnahmen. Bahnhöfe und Bauwerke kommen noch dazu.
