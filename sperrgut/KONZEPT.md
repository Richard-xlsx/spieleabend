# Sperrgut: Stapelspiel am Umzugstag (Konzept und Plan)

Stand 27.11.2026. Noch nichts gebaut. Ordner `sperrgut/`, für 1 bis 8 Leute, jeder am eigenen Handy, dazu Bots.

Umzugstag in der Altstadt. Der Möbelaufzug ist kaputt, also stapelt jeder seinen Hausrat vor dem Haus so hoch, dass er
durchs Fenster der neuen Wohnung passt. Jeder baut auf seinem Handy einen eigenen Turm aus Kartons und Möbeln mit
echter Physik: Es wackelt, rutscht und kippt. Wer zuerst oben ist, gewinnt den Auftrag. Unterwegs schickt man sich
Gemeinheiten: Der Nachbar bringt sein Klavier, die Katze springt auf den Turm, und dann fängt es auch noch an zu regnen.

---

## 1. Ziele

- **Lachen und Fluchen am Tisch:** Türme kippen sichtbar und laut, Gemeinheiten kommen mit Absender („Lena schickt dir ein Klavier!“).
- **Sofort verstanden:** Teil ziehen, tippen zum Drehen, wischen zum Fallenlassen. Nach 20 Sekunden kann es jeder.
- **Gerecht:** Alle bekommen dieselben Teile in derselben Reihenfolge. Jedes Handy rechnet seinen Turm selbst, eine langsame Verbindung verwackelt also nichts.
- **Bis zum Schluss offen:** Wer hinten liegt, zieht stärkere Karten. Ein Turm ist schnell gebaut und genauso schnell eingestürzt.
- **Kurz:** Ein Auftrag dauert 1 bis 3 Minuten, ein ganzer Umzugstag 10 bis 20 Minuten.

## 2. Thema und Aussehen

- **Ort:** Kopfsteinpflaster vor einem Altbau mit Stuck, Laterne, Umzugswagen am Straßenrand. Seitenansicht in 2D.
- **Höhe:** Die Stockwerke des Altbaus sind die Höhenskala. Das Ziel ist das offene Fenster der neuen Wohnung.
- **Kartons:** braune Pappe, Paketband in der Farbe des Spielers, Beschriftung in Filzstift-Schrift („Küche“, „Bücher (schwer!)“, „Kram“, „Omas Geschirr“, „NICHT STÜRZEN“).
- **Tageszeit:** Der Umzugstag läuft mit. Der erste Auftrag ist am Morgen, der letzte im Abendrot, dann gehen in den Fenstern die Lichter an.
- **Farben:** Putz in Ocker und Hellgrau, Backsteinrot, Pappbraun, dazu kräftige Spielerfarben für das Paketband.
- **Ton:** Synthesizer-Klänge wie in Orbit: dumpfes Plumpsen von Pappe, Knarzen beim Wackeln, Klirren bei Bruch, ein schiefer Klavierakkord, ein Miau, Regenrauschen.
- **Hochkant:** Das Handy wird hochkant gehalten, das passt zu einem Turm. Die Ansicht fährt mit, wenn der Turm wächst.

---

## 3. Bauen

### 3.1 Steuerung
- **Ziehen nach links oder rechts:** Das fallende Teil folgt dem Finger in halben Feldern.
- **Tippen:** Das Teil dreht sich um 90 Grad.
- **Nach unten wischen:** Das Teil fällt sofort bis zum Turm. **Gedrückt halten** lässt es schneller sinken.
- Ein **Lot** (gestrichelte Linie mit Schatten) zeigt, wo das Teil landet. Oben rechts steht das nächste Teil.
- Wer lieber Knöpfe mag, schaltet auf eine Leiste mit ◀ ▶ ⟳ ⬇ um. Das Handy merkt sich die Wahl.
- Am Rechner gehen auch Pfeiltasten und Leertaste.

### 3.2 Physik
- Solange das Teil fällt, ist es gesteuert: Es sinkt gleichmäßig und lässt sich verschieben und drehen, aber nicht in andere Teile hinein.
- Sobald es den Turm oder den Boden berührt, übernimmt die Physik. Ab dann kann es rutschen, kippen und andere mitreißen.
- Gebaut wird auf einer **Europalette** (6 Felder breit). Teile dürfen überstehen, aber was vom Turm fällt, ist **Bruch**: Es klirrt, das Teil ist weg und wird gezählt.
- **Höhe** ist die Oberkante des höchsten Teils, das ruhig im Turm liegt. Das gerade fallende Teil zählt nicht.
- Die Teile fallen anfangs mit 1,5 Feldern pro Sekunde und werden im Lauf eines Auftrags schneller.

### 3.3 Teile
Alle bekommen dieselbe Reihenfolge (gemeinsamer Startwert vom Spielleiter).

**Kartons** (etwa 3 von 4 Teilen): sieben Formen aus je vier Feldern, mit Paketband zusammengeklebt:
Langkarton (4 × 1), großer Karton (2 × 2), T, L, J, S und Z. Normales Gewicht, gute Reibung.

**Möbel** (etwa jedes fünfte Teil), jedes mit einer Eigenheit:

| Möbel | Form | Eigenheit |
|---|---|---|
| Kühlschrank | 1 × 2 stehend | schwer, guter Unterbau |
| Sofa | U-Form, 3 breit mit zwei Lehnen | sperrig, aber oben eine Mulde |
| Stehlampe | dünn, 3 hoch, oben breiter Schirm | leicht und kippelig |
| Matratze | 4 × ½ flach | weich, federt ein wenig |
| Gummibaum | Topf 1 × 1 mit breiter, leichter Krone | Lücke unter der Krone |
| Stuhl | Sitz mit vier Beinen | Lücken zwischen den Beinen |

**Besondere Teile:**
- **Goldfischglas:** rund, rollt und ist zerbrechlich.
- **Zerbrechlich-Karton** (etwa jedes zwölfte Teil, mit Glas-Symbol): Liegt er am Ende des Auftrags noch heil im Turm, gibt es 1 Zusatzpunkt.
- **Pizza-Karton** (etwa jedes siebte Teil, mit Pizza-Aufkleber): Bleibt er 2 Sekunden liegen, zieht man eine **Karte** (siehe 4).

---

## 4. Karten: Gemeinheiten und Hilfen

Umzugshelfer arbeiten für Pizza. Wer einen Pizza-Karton sicher verbaut, zieht eine Karte. Man hält höchstens zwei Karten,
die Karten liegen unten links.

- **Hilfe:** antippen, sie wirkt sofort auf den eigenen Turm.
- **Gemeinheit:** antippen und dann den kleinen Turm eines Mitspielers oben antippen. Ohne Wahl innerhalb von 4 Sekunden trifft sie den Führenden.
- Das Opfer sieht eine Sekunde vorher, was von wem kommt. Alle anderen sehen es in der Meldungszeile.
- **Schonfrist:** Wer gerade eine Gemeinheit abbekommen hat, ist 5 Sekunden lang geschützt.
- **Ausgleich:** Was man zieht, hängt vom Platz ab. Wer vorn liegt, zieht leichte und mittlere Karten, wer hinten liegt, mittlere und starke. Den Zufall zieht der Spielleiter.

| Gemeinheit | Wirkung | Stärke |
|---|---|---|
| **Klavier** | Der Nachbar gibt sein Klavier mit: Das nächste Teil ist ein Klavier (3 × 2, sehr schwer). | stark |
| **Katze** | Eine Katze springt auf die Turmspitze, läuft hin und her und springt nach 4 Sekunden wieder ab. | stark |
| **Platzregen** | Die nächsten 3 Teile sind nass und rutschen fast ohne Reibung. | mittel |
| **Gymnastikball** | Das nächste Teil ist ein großer Ball, der rollt. | mittel |
| **Bettlaken** | Ein Laken weht 8 Sekunden lang vor die Turmspitze, man sieht nur noch das Lot. | leicht |
| **Ansage vom Schwager** | Er ruft „links!“ und meint rechts: 8 Sekunden lang sind links und rechts vertauscht. | leicht |

| Hilfe | Wirkung | Stärke |
|---|---|---|
| **Festhalten** | Die Helfer halten den Turm 10 Sekunden lang starr. | stark |
| **Wunschteil** | Ein Helfer bringt eins von drei Teilen zur Wahl. | stark |
| **Spanngurt** | Die obersten 4 Teile halten fest zusammen. | mittel |
| **Kleine Kisten** | Die nächsten 2 Teile sind kleine Einzelkisten (1 × 1) zum Lückenfüllen. | leicht |
| **Tief durchatmen** | Die nächsten 3 Teile fallen halb so schnell. | leicht |

---

## 5. Aufträge (Spielarten)

| Auftrag | Worum es geht | Ende und Wertung |
|---|---|---|
| **Hoch hinaus** (Wettrennen) | Stapeln bis zum offenen Fenster der neuen Wohnung (je nach Länge 1., 2. oder 3. Stock). | Wer zuerst über dem Fensterbrett ist und dort 3 Sekunden ruhig stehen bleibt, ist durch. Die Reihenfolge entscheidet, spätestens nach 3 Minuten zählt die Höhe. |
| **Bloß nichts kaputt** (Überleben) | 30 Teile für alle, jedes Teil, das herunterfällt, ist ein Bruch. Nach drei Bruch ist man raus. Die Teile fallen immer schneller. | Platz nach übrigen Leben, dann nach verbauten Teilen, dann nach Höhe. |
| **Wagen beladen** (Packen) | Der Laderaum des Umzugswagens hat ein Dach und eine Rückwand, die Ladeklappe ist offen. So viele Teile wie möglich unter das Dach packen, ohne dass etwas hinten herausfällt. | Berührt ein ruhendes Teil das Dach, ist der Wagen voll. Es zählt die Zahl der Teile im Wagen, nach 2 Minuten ist Schluss. |
| **WG-Umzug** (ein Turm für alle) | Alle bauen reihum an einem gemeinsamen Turm und sehen auf dem Handy live zu. 10 Sekunden pro Teil. | Fällt etwas herunter, während man dran ist oder in den 3 Sekunden danach, ist man raus und zahlt die Pizza. Wer zuletzt übrig ist, gewinnt. |

Bei „Hoch hinaus“, „Bloß nichts kaputt“ und „Wagen beladen“ baut jeder für sich und sieht die anderen klein am Rand.
Karten gibt es dort in allen drei Arten. Beim WG-Umzug gibt es keine Karten, dort reicht die Spannung.

## 6. Umzugstag (Turnier)

- **Länge:** Kurz 3 Aufträge (ca. 8 min), Normal 5 (ca. 15 min), Lang 7 (ca. 20 min).
- Die Aufträge wechseln sich ab. Der Spielleiter kann in der Lobby Spielarten abwählen.
- **Punkte je Platz** nach Spielerzahl wie in Orbit (zum Beispiel zu viert 10, 7, 4, 2), dazu je 1 Punkt für jeden heil gebliebenen Zerbrechlich-Karton.
- **Siegerehrung** vor dem Umzugswagen: „Umzugsprofi des Tages“ auf dem Podest, dazu Ehrentitel ohne Punkte:
  - **Hochstapler:** der höchste Turm des Tages
  - **Scherbenkönig:** die meisten Bruch
  - **Ruhige Hand:** die wenigsten Bruch
  - **Klavierträger:** die meisten Gemeinheiten abbekommen
  - **Nervensäge:** die meisten Gemeinheiten verschickt
- **Nachzügler** steigen beim nächsten Auftrag ein und bekommen den Durchschnitt der bisherigen Punkte.

---

## 7. Bildschirm

**Handy (hochkant):**
- **Oben:** Auftrag, Zeit oder übrige Teile, daneben die kleinen Türme der anderen. Jeder Turm erscheint mit Farbe, Anfangsbuchstabe und Ziellinie, zum Antippen für Gemeinheiten.
- **Mitte:** der eigene Turm vor dem Altbau.
- **Unten:** die zwei Kartenplätze links und das nächste Teil rechts. Auf Wunsch erscheint hier die Knopfleiste.
- **Meldungen** mit der Farbe des Absenders: „Lena schickt dir ein Klavier!“, „Kai hat das Fenster erreicht.“

**Tablet und Laptop (quer):** Der eigene Turm steht in der Mitte, die anderen größer daneben.

**Später:** eine Fernseher-Ansicht wie in Orbit (`?tv=1`) mit allen Türmen nebeneinander.

---

## 8. Technik

### 8.1 Dateien
```
sperrgut/
  index.html     Bildschirme und Stil
  logic.js       Lobby, Umzugstag, Aufträge, Punkte, Karten ziehen (je nach Platz), Gemeinheiten verteilen, Schonfrist,
                 Reihenfolge und Ehrentitel – ohne Netz und ohne Physik, mit node testbar
  turm.js        Ein Turm mit planck.js: Teile und Formen, gesteuertes Fallen, Übergang in die Physik, Höhe, Bruch,
                 Kleben, Festhalten, Katze, Regen; läuft auch ohne Bildschirm (Bots und Tests)
  bot.js         Bots: Platz für das nächste Teil suchen und wie ein Mensch etwas ungenau steuern
  zeichnen.js    Altbau, Gehweg, Wagen, Kartons mit Beschriftung, Möbel, Tageszeit
  app.js         Verbindung (PeerJS wie die anderen Spiele), Uhrabgleich, Bildschirme, Eingabe, kleine Türme
  klang.js       Synthesizer-Klänge
  tests/         logik.js und turm.js (node)
```

### 8.2 Physik
- **Bibliothek:** planck.js 1.4.2 vom CDN, dieselbe wie die Mondbasis in Orbit. Ohne planck.js kann man nicht spielen, das Spiel sagt das dann deutlich.
- **Maße und Takt:** 1 Feld entspricht 1 Einheit in planck. Gerechnet wird in festen Schritten (60 pro Sekunde) mit mehr Rechendurchgängen als üblich, damit Stapel ruhig stehen.
- **Fallendes Teil:**
  - Es ist „kinematisch“, sinkt also gleichmäßig und wird von nichts angeschoben.
  - Verschieben und Drehen gehen nur, wenn das Teil an der neuen Stelle nichts überschneidet.
  - Bei der ersten Berührung wird es zu einem normalen Körper mit seiner Fallgeschwindigkeit.
- **Höhe:** Es zählen nur Teile, die seit 0,5 Sekunden fast stillstehen.
- **Bruch:** Ein Teil gilt als heruntergefallen, wenn es unter die Palette rutscht oder seitlich weit genug weg ist.
- **Spanngurt:** feste Verbindungen zwischen sich berührenden Teilen.
- **Festhalten:** Die Teile werden 10 Sekunden lang unbeweglich.
- **Bots** rechnen auf dem Handy des Spielleiters je einen eigenen Turm ohne Zeichnung. Auf schwachen Handys rechnen sie mit halbem Takt.

### 8.3 Wer rechnet was
- **Spielleiter:** Lobby, Start jedes Auftrags (gemeinsamer Zeitpunkt nach abgeglichener Uhr), Startwert für die Teile,
  Karten ziehen, Gemeinheiten mit Startzeit verteilen, Reihenfolge und Punkte. Die Uhr wird abgeglichen wie in Orbit:
  5 Pings, die kürzeste Laufzeit zählt.
- **Jedes Handy:** rechnet seinen eigenen Turm.
  - Etwa 4-mal pro Sekunde meldet es seinen Stand: Höhe, Teile, Bruch, Leben und eine knappe Momentaufnahme der Teile, die sich bewegt haben.
  - Alle 2 Sekunden schickt es eine vollständige Momentaufnahme.
  - Das Erreichen des Fensters meldet es mit Zeitstempel.
- **Kleine Türme:** Der Spielleiter reicht die Stände weiter, und jedes Handy zeichnet daraus die kleinen Türme.
- **WG-Umzug:** Hier rechnet der Spielleiter den gemeinsamen Turm.
  - Er rechnet 30-mal pro Sekunde und schickt 15-mal pro Sekunde den Stand, geglättet wie in Orbit.
  - Wer dran ist, schickt nur seine Eingaben.
  - Weil man nacheinander baut, stört die Laufzeit kaum.
- **Neuladen mitten im Auftrag:** Das Handy baut den Turm aus der letzten vollständigen Momentaufnahme wieder auf.
- **Ausfall des Spielleiters:** Ein anderes Handy übernimmt wie bei den anderen Spielen. Der laufende Auftrag beginnt neu, die Punkte bleiben.
- **Mogeln:** Jedes Handy meldet seinen Turm selbst, Mogeln wäre also möglich. Unter Freunden ist das egal, wie bei Greifarm und Bordküche in Orbit.
- **Wake Lock:** Der Bildschirm bleibt während des Umzugstags an.
- **Gemeinsamer Abend:** Das Spiel lädt `../abend.js` mit `data-spiel="sperrgut"` und bekommt eine Karte auf der Startseite.

### 8.4 Testen
- `?allein` ist der Übungsmodus für einen Spieler ohne Netz, zugleich der Prototyp aus Schritt 1.
- `?bots=3` fügt Mitspieler hinzu, `?auftrag=hoch|kaputt|wagen|wg` startet einen Auftrag direkt.
- **node:**
  - **logic.js:** Punkte, Karten je Platz, Schonfrist, Nachzügler, Reihenfolge.
  - **turm.js:** Ein sauberer Stapel bleibt stehen, ein großer Überhang kippt, Höhe und Bruch werden richtig erkannt, der Spanngurt hält, und Bots erreichen das Fenster in vernünftiger Zeit.
- **Playwright:** mehrere Browser-Fenster als Spieler, Bildschirmfotos im iPhone-Format, keine JS-Fehler.

---

## 9. Umsetzungsplan

Nach jedem Schritt wird getestet, hochgeladen und ist online spielbar.

| Schritt | Inhalt | Danach |
|---|---|---|
| **1. Prototyp** | Palette, die sieben Kartons, Steuerung (Ziehen, Tippen, Wischen, Knopfleiste, Lot), Physik, Höhe, Bruch, „Hoch hinaus“ allein auf Zeit. Noch einfache Zeichnung. | Unter `…/sperrgut/?allein` am echten Handy ausprobieren: Fühlt es sich gut an? Danach werden Reibung, Fallgeschwindigkeit und Palettenbreite eingestellt. |
| **2. Mehrspieler** | Lobby, Uhrabgleich, gemeinsamer Start, gleiche Teile, kleine Türme, Ergebnis, einfache Bots, Übernahme. | Karte auf der Startseite mit dem Hinweis „im Aufbau“. |
| **3. Möbel und Karten** | Möbel, Goldfischglas, Zerbrechlich- und Pizza-Kartons, alle Gemeinheiten und Hilfen, Ziel antippen, Ausgleich nach Platz. | Ein Wettrennen mit allem Drum und Dran. |
| **4. Aufträge und Turnier** | „Bloß nichts kaputt“, „Wagen beladen“, „WG-Umzug“, Umzugstag mit Punkten, Siegerehrung und Ehrentiteln. | Ein ganzer Umzugstag ist spielbar. |
| **5. Feinschliff** | Zeichnungen (Altbau, Tageszeit, Wagen, Beschriftungen), Klänge, stärkere Bots, Tablet-Ansicht, gemeinsamer Abend, LIESMICH. | Der Hinweis „im Aufbau“ fällt weg. |
| später | Fernseher-Ansicht mit allen Türmen nebeneinander | |

Schritt 1 ist der wichtigste: Wenn sich Steuerung und Wackeln nicht gut anfühlen, hilft der Rest nicht. Deshalb gibt
es dort eine Testpause, bevor es weitergeht.

## 10. Festgelegt (änderbar, wird im Prototyp eingestellt)

- **Palette:** 6 Felder breit, sichtbar sind etwa 12 Felder.
- **Fenster:** im 1., 2. oder 3. Stock, etwa 10, 16 oder 22 Felder hoch.
- **Fallen:** Start mit 1,5 Feldern pro Sekunde, schneller nach jedem zehnten Teil. Das nächste Teil kommt 0,4 Sekunden nach der Berührung.
- **Häufigkeiten:** Möbel etwa jedes fünfte Teil, Pizza-Karton etwa jedes siebte, Zerbrechlich-Karton etwa jedes zwölfte.
- **Zeiten:** 3 Sekunden über dem Fensterbrett halten. Schonfrist nach einer Gemeinheit 5 Sekunden. Zielwahl für eine Gemeinheit 4 Sekunden. WG-Umzug 10 Sekunden pro Teil und 3 Sekunden Nachwackeln.
- **Vorbild und Abgrenzung:** Das Grundprinzip, mit Physik gegeneinander zu stapeln, kennt man aus Spielen wie Tricky Towers.
  Sperrgut hat ein eigenes Thema und eigene Bilder. Es gibt Möbel mit Eigenheiten, einen Packauftrag mit Wänden,
  einen gemeinsamen WG-Turm, gezielte Gemeinheiten mit Absender und Karten, die vom Platz abhängen. Zauberei kommt nicht vor.
