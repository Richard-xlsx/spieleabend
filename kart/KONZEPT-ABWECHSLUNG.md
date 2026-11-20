# Kerker-Kart: mehr Abwechslung, mehr Herausforderung

Konzept vom 20.11.2026. Es baut auf `KONZEPT.md` auf (Pakete 1 bis 7 sind fertig, Paket 8 ist noch offen).

---

## 0. Wo das Spiel heute steht

### 0.1 Wie stark sind die Monster? (Messung)

Ich habe 12 Rennen über 3 Runden gegen 5 Monster simulieren lassen, je 4 pro Welt. Gefahren ist der Testfahrer des Spiels. Er lenkt wie ein Monster, driftet nie und nimmt Abkürzungen nur zufällig. Er fuhr einmal mit vollem Tempo und einmal mit 6 % mehr. Die 6 % entsprechen etwa dem, was ein Mensch durch Driftschübe gewinnt.

| Welt | Fahrer | Siege | Abstand zum besten Monster |
|---|---|---|---|
| Kerker | volles Tempo, kein Drift | 2 von 2 | 5 bis 11 Sekunden vorn |
| Kerker | mit Drift-Wirkung | 2 von 2 | 11 bis 17 Sekunden vorn |
| Spinnengrotte | volles Tempo, kein Drift | 0 von 2 (Platz 2) | 2 bis 3 Sekunden hinten |
| Spinnengrotte | mit Drift-Wirkung | 1 von 2 | zwischen 5 hinten und 3 vorn |
| Glutschlund | volles Tempo, kein Drift | 2 von 2 | 3 Sekunden vorn |
| Glutschlund | mit Drift-Wirkung | 2 von 2 | 6 bis 12 Sekunden vorn |

Insgesamt hat der Testfahrer 9 von 12 Rennen gewonnen. Verloren hat er nur in der Grotte, weil er dort mehrmals in die Schlucht stürzte (Runden bis 42 statt 32 Sekunden). Ein Rennen dauert 1:40 bis 2:00 Minuten.

**Warum die Monster so leicht sind:**
- Sie fahren mit 90 bis 97,5 % ihres Höchsttempos, je nach Startplatz.
- Sie driften nie und bekommen deshalb keine Driftschübe. Schneller werden sie nur durch Tränke.
- Sie fahren keine Ideallinie, sondern wechseln alle 2 bis 5 Sekunden zufällig die Spur.
- Abkürzungen nehmen sie nur per Münzwurf: Lore zu 45 %, Troll zu 40 %, Tunnel zu 50 %.
- Das Gummiband gibt ihnen +8 %, wenn sie mehr als 40 m hinter dem führenden Menschen liegen. Damit kommen sie gerade auf das Tempo eines sauberen Fahrers, aber nie darüber.

**Was das heißt:** Wer ein paar Rennen gefahren ist und driftet, gewinnt allein fast immer, meist mit 10 Sekunden Vorsprung oder mehr. Eine Stufe zum Einstellen gibt es nicht.

### 0.2 Warum es sich schnell gleich anfühlt

- **Fester Grundriss:** Jede Welt ist immer dieselbe Schleife durch 6 feste Punkte. Die Varianten (72 im Kerker, je 32 in Grotte und Glutschlund) ändern nur das Innere der Abschnitte. Nach drei Rennen kennt man die Form.
- **Monster ohne Charakter:** Alle sechs fahren gleich. Nur der Goblin setzt Extras schneller ein, und der Pilzling weicht nicht aus. In jeder Welt fahren dieselben sechs.
- **Endgegner im festen Takt:** Runde 1 ist ruhig, ab Runde 2 kommt der Endgegner in festen Abständen, in jedem Rennen gleich.
- **Kein Ton:** Das Spiel ist stumm.
- **Allein fehlt ein Ziel:** Es gibt nur eine Bestzeit pro Held. Medaillen, Aufgaben oder einen Gegner, den man unbedingt schlagen will, gibt es nicht.
- **Noch nicht gebaut aus `KONZEPT.md`:** Hebel mit Fässern, Kronleuchter, Händler, Zuschauer am Rand, Beutel für zwei Extras, Eigenheiten der Monster.

---

## 1. Ziele

1. **Allein ist jede Stufe so schwer, wie sie heißt.** Messbar mit einem neuen „Musterfahrer“-Bot, der driftet und Abkürzungen sicher nimmt (siehe 2.A). Er soll gegen 5 Monster so oft gewinnen:

   | Stufe | Siegquote des Musterfahrers |
   |---|---|
   | Wanderer | über 95 % |
   | Abenteurer | etwa 75 % |
   | Held | etwa 45 % |
   | Legende | etwa 20 % |

2. **Mit Freunden: gute und schwächere Fahrer haben beide Spaß.** Hilfen gibt es pro Person, die anderen werden dafür nicht gebremst.
3. **Jedes Rennen bringt etwas Neues:** einen anderen Grundriss, ein Ereignis, einen anderen Rivalen oder eine Aufgabe.
4. **Allein gibt es Gründe, noch ein Rennen zu fahren:** Medaillen, der eigene Geist, Aufgaben.
5. **Können lohnt sich.** Wer besser fährt, wird belohnt, ohne dass Anfänger gleich abgehängt sind.

---

## 2. Schwierigkeit

### A. Vier Stufen für die Monster

Es gelten dieselben Namen wie im Verlies. Allein wählt man die Stufe im Menü, zu mehreren wählt sie der Spielleiter in der Lobby. Neue Standardstufe ist **Abenteurer**. Das heutige Spiel liegt zwischen Wanderer und Abenteurer.

| | **Wanderer** | **Abenteurer** | **Held** | **Legende** |
|---|---|---|---|---|
| Tempo der Monster | 88 bis 94 % | 95 bis 100 % | 98 bis 103 % | 100 bis 105 % |
| Linie | wechselt zufällig die Spur | grob ideal | Ideallinie | Ideallinie, schneidet Kurven knapp |
| Driften | nie | in langen Kurven, kleiner Schub | oft, großer Schub | fast immer, größter Schub |
| Abkürzungen | selten | jede zweite | meist, und sie klappen | fast immer |
| Extras | zufällig | zielen nach vorn | zielen auf Menschen, heben Schutz für vorne auf | wie Held, werfen auch gezielt nach hinten |
| Ausweichen | kaum | meist | fast immer | immer |
| Gummiband | Monster warten, holen nicht auf | ±6 % | nur Aufholen, +5 % | keins |
| Endgegner | ab Runde 2, selten | wie heute | ab Runde 2, öfter | schon ab Runde 1, Runde 3 doppelt so oft |
| Monsterkräfte (siehe B) | nein | nein | eine pro Rennen | zwei pro Rennen |

Grundlagen dafür:
- **Ideallinie:** Beim Bauen der Strecke berechnet das Spiel einmal eine Linie, die Kurven innen anschneidet. Die Monster fahren je nach Stufe genauer oder ungenauer darauf.
- **Driftende Monster:** Vor engen Kurven driften sie wie Menschen und bekommen den gleichen Schub, je nach Stufe nur den kleinen oder auch den großen.
- **Musterfahrer:** Ein Bot mit Ideallinie, Drift und sicheren Abkürzungen, aber ohne Gummiband. Er ersetzt den heutigen Testfahrer (`?auto`). Damit misst ein Testskript die Siegquoten aus Abschnitt 1 für alle drei Welten. So bleiben die Stufen nach jeder Änderung richtig eingestellt.

### B. Monster mit Eigenheiten und Kräften

Jedes Monster bekommt eine **Eigenheit**, die immer wirkt. Ab der Stufe Held kommt eine **Monsterkraft** dazu, die es ein- oder zweimal pro Rennen einsetzt. Ein kurzer Spruch über dem Monster kündigt sie an, damit man reagieren kann.

| Monster | Eigenheit (immer) | Monsterkraft (ab Held) |
|---|---|---|
| **Goblin** | setzt Extras sofort ein | **Fassbombe:** rollt ein Fass nach hinten, es springt über die Fahrbahn |
| **Skelett** | zerfällt bei Treffern und ist nach einer halben Sekunde wieder ganz | **Knochenregen:** wirft 3 Knochen als Hindernisse hinter sich |
| **Ork** | lenkt gezielt in Karts neben sich | **Sturmangriff:** 2 Sekunden Rammschub, wen er trifft, der dreht sich |
| **Riesenratte** | sehr schnell, leicht, fliegt bei jedem Stoß weit weg | **Rattenloch:** verschwindet in der Mauer und taucht 40 m weiter vorn auf |
| **Schleim** | hinterlässt eine kurze glatte Spur | **Teilen:** spaltet sich 3 Sekunden in zwei Schleime und versperrt die Fahrbahn |
| **Pilzling** | schusselig, fährt manchmal gegen die Wand | **Sporenwolke:** auf das Kart vor ihm, wie der Knallpilz |

**Neue Monster passend zur Welt.** Heute fahren in jeder Welt dieselben sechs. Neu kommt die Heimmannschaft aus den Gegnern des Verlieses dazu:

| Welt | Neue Monster | Eigenheit |
|---|---|---|
| Kerker | **Ghul** (auf einer Bahre), **Kerkerwärter** (Gefangenenwagen) | Ghul: wird schneller, wenn er jemanden überholt · Kerkerwärter: schwer, wirft Ketten (wie das Netz) |
| Grotte | **Höhlenspinne** (krabbelt), **Netzweberin** (Kokon-Wagen) | Spinne: fährt kurz an der Wand entlang · Weberin: lässt Netzfäden fallen |
| Glutschlund | **Feuerkobold** (Funkenrad), **Obsidian-Golem** (rollt selbst) | Kobold: zieht eine kurze Feuerspur · Golem: sehr schwer, bricht die brüchige Wand und schiebt alle weg |

In jedem Rennen fahren etwa zur Hälfte Monster aus der jeweiligen Welt.

### C. Der Rivale

In jedem Rennen ist ein Monster der **Rivale**:
- Er trägt eine goldene Krone, und sein Name steht in Gold.
- Er fährt eine Stufe besser als die anderen Monster.
- Beim Überholen gibt er einen Spruch ab, zum Beispiel „Zu langsam, Held!“ oder „Hehe!“.

Wer vor ihm ins Ziel kommt, bekommt einen **Stern** (siehe F). Im Feldzug bleibt es dreimal derselbe Rivale, und im Ergebnis steht „Rivale: 2:1 für dich“.

**Königsrennen:** Wer einen Feldzug auf Held oder Legende gewinnt, kann es freischalten. Im Glutschlund fahren dann die drei Endgegner selbst mit: der Knochenkönig im Thronwagen, die Spinnenkönigin auf ihren Beinen und der Glutdrache tief über der Fahrbahn. Jeder hat seine Endgegner-Kraft als Monsterkraft.

### D. Können lohnt sich

Diese Dinge machen gute Fahrer schneller. Monster nutzen sie ab den Stufen, die dabeistehen.

| Technik | So geht es | Belohnung | Monster ab |
|---|---|---|---|
| **Blitzstart** | Den Drift-Knopf genau beim „LOS!“ drücken, bis 0,3 Sekunden vorher | 1 Sekunde Schub. Wer zu früh drückt, dreht kurz durch. | Held |
| **Dritte Driftstufe** | Länger driften (über 2,6 Sekunden). Die Funken werden nach Gold, Blau und Rosa lila. | 1,8 Sekunden Schub (heute höchstens 1,2) | Legende |
| **Sprungtrick** | Während eines Sprungs den Drift-Knopf antippen. Das Kart macht eine Rolle. | kleiner Schub bei der Landung | Held |
| **Windschatten** | 1,5 Sekunden dicht hinter einem Kart fahren | Windlinien, dann ein kurzer Schub zum Vorbeiziehen | Abenteurer |

Alle vier Techniken kommen in die Erklärung im Menü. Der Windschatten hält das Feld in Mehrspieler-Rennen zusammen.

### E. Fahrhilfe für gemischte Runden

Am Spieleabend fahren Geübte und Neulinge zusammen. Deshalb gibt es eine **Fahrhilfe pro Person**, die jeder selbst in der Lobby einschaltet:
- **Kein Absturz:** An Schluchten, Lava und Hängebrücken gibt es für diese Person ein unsichtbares Geländer.
- **Lenkhilfe:** Das Kart wird sanft zur Fahrbahnmitte gezogen und schrammt nicht an der Mauer.
- **Abkürzungen** gehen weiterhin. Wer sie verpatzt, fällt trotzdem nicht hinunter, sondern prallt ab.

Neben dem Namen erscheint ein kleines 🛟. Bestzeiten mit Fahrhilfe werden getrennt gespeichert. Allein gibt es die Fahrhilfe auch, zum Beispiel für Kinder.

---

## 3. Abwechslung

### F. Allein: Medaillen, Geist und Aufgaben

**Zeitfahren mit Geist (neuer Modus):**
- Man fährt allein gegen den Geist seiner eigenen Bestfahrt auf genau dieser Strecke. Der Streckencode ist der Schlüssel, und der Geist ist ein durchsichtiges Kart.
- Je Strecke gibt es Medaillen: **Bronze, Silber, Gold** und **Drachenzeit**. Die Zeiten rechnet das Spiel aus der Zeit des Musterfahrers. Gold ist so schnell wie der Musterfahrer, die Drachenzeit 3 % schneller.

**Tagesstrecke:**
- Jeden Tag gibt es einen festen Streckencode, der aus dem Datum berechnet wird. Alle fahren also dieselbe Strecke.
- Im Raum sieht man die Tagesbestzeiten der anderen. Die Bestzeiten bleiben auf dem eigenen Handy, ohne Server.

**Aufgaben mit Sternen:** Je Welt gibt es 8 Aufgaben. Sie stehen im Menü und werden abgehakt. Zum Beispiel:
- Schlag den Rivalen auf Held.
- Gewinne, ohne ein Extra zu benutzen.
- Nimm in einem Rennen dreimal den Pilzsprung.
- Sammle 25 Gold in einem Rennen.
- Fahre eine Runde unter 31 Sekunden.
- Komm ohne Absturz durch den Glutschlund, auf Legende.
- Durchbrich die brüchige Wand mit dem Feuerball.
- Verwandle den Rivalen als Hexe in eine Kröte.

**Was Sterne bringen:** Wimpel-Muster und Kart-Farben, zum Beispiel ein Drachenschuppen-Wimpel für alle Drachenzeiten. Alle Helden und Welten bleiben von Anfang an frei.

### G. Rennereignisse

Einmal pro Rennen passiert in Runde 2 oder 3 etwas Unerwartetes. Es wird 3 Sekunden vorher groß angekündigt. Das ist anders als die Rennflüche, die das ganze Rennen gelten und nur im Feldzug vorkommen.

| Ereignis | Was passiert |
|---|---|
| **Goldregen** | 10 Sekunden lang fällt Gold von der Decke |
| **Händlerkarren** | Ein Händler fährt langsam mit. Wer ihn berührt, bekommt ein starkes Extra. |
| **Goblin-Horde** | Eine Horde rennt an einer Stelle quer über die Fahrbahn, wie die Ratten, nur breiter |
| **Fackeln aus** | 15 Sekunden fast dunkel, nur die Laternen an den Karts leuchten |
| **Geisterkarren** | Ein Geisterkart fährt rückwärts durch das Feld. Wer ihn berührt, dreht sich. |
| **Truhenfieber** | 10 Sekunden lang gibt jede Truhe zwei Extras |
| **Einsturz** | Ein Gang stürzt ein, bis zum Rennende bleibt nur der Umweg (nur auf Strecken mit zwei Wegen) |

Auf Wanderer gibt es nur die freundlichen Ereignisse (Goldregen, Händler, Truhenfieber). Auf Legende können es zwei pro Rennen sein.

### H. Ein zweiter Grundriss je Welt

Jede Welt bekommt eine zweite Schleife mit eigener Form und eigener Reihenfolge. Abschnitte, die zu beiden Formen passen, werden wiederverwendet. Neu sind je Welt 3 Abschnitte.

| Welt | Grundriss A (heute) | Grundriss B (neu) |
|---|---|---|
| Kerker | Wachstube, Zellengang, Abstieg, Thronsaal, Gewölbe, Heimweg | **Ausbruch:** Start im Thronsaal, durch die Kanalisation, über die Wehrgänge auf der Mauer (mit Abgrund nach außen) und zurück durch das Tor |
| Grotte | Pilzhain, Schlucht, Tiefe, Nest, Brut, Heimweg | **Wasserfallhöhle:** Ufer, dann ein Tunnel hinter einem Wasserfall, Pilzsprünge in Serie, ein See mit Stegen |
| Glutschlund | Obsidiantor, Lavasee, Glutfelder, Horst, Schlund, Heimweg | **Vulkanaufstieg:** spiralförmig bergauf und um den Krater, oben der Drachenhorst, dann eine lange Abfahrt mit Sprüngen |

Damit verdoppeln sich die Strecken, und vor allem fühlt sich die Form anders an. Der Streckencode bekommt dafür eine Stelle mehr, alte Codes bleiben gültig.

### I. Leben auf der Strecke und Ton

Hier kommt der Rest aus `KONZEPT.md` 3.4, dazu Klänge:
- **Hebel:** Wer ihn rammt, lässt Fässer eine Rampe herunterrollen.
- **Kronleuchter:** Ein Feuerball holt ihn herunter, dann liegt er eine Runde lang auf der Fahrbahn.
- **Händlerstand:** Wer in der Kurve durchfährt, wird langsamer und bekommt ein Extra.
- **Zuschauer:**
  - Goblins klatschen am Rand.
  - Skelette, die man streift, fallen auseinander.
  - In der Grotte flattern Fledermäuse auf.
- **Beutel:** Mit ihm trägt man zwei Extras.
- **Klänge:** Sie werden wie im Verlies im Handy erzeugt, ohne Dateien.
  - Motorgeräusch je Gefährt, zum Beispiel klapperndes Holz beim Handkarren und Knochenrasseln beim Sarg.
  - Driftfunken, ein eigener Ton für jedes Extra, Treffer, Gelächter beim Mimik, Brüllen der Endgegner, Jubel im Ziel.
  - Leise Musik je Welt, abschaltbar.

### J. Neue Modi für den Spieleabend

Dazu kommen die beiden Modi aus Paket 8 (Flucht aus dem Glutschlund und Schatzjagd).

- **Teamrennen:** zwei Teams (Rot gegen Blau), die Platzpunkte werden addiert. Treffer auf das eigene Team wirken nicht. Die Monster füllen auf, damit beide Teams gleich groß sind.
- **Großer Feldzug:** 5 Rennen, jede Welt einmal mit Grundriss A und einmal mit B, zum Schluss das Königsrennen gegen die drei Endgegner.

---

## 4. Reihenfolge der Umsetzung

Nach jedem Paket ist das Spiel spielbar und am Handy testbar.

| Paket | Inhalt | Ergebnis |
|---|---|---|
| **9** | Ideallinie, driftende Monster, Musterfahrer mit Messskript, **vier Stufen** in Menü und Lobby | Allein endlich eine echte Herausforderung |
| **10** | Eigenheiten und Monsterkräfte, **Rivale**, 6 neue Monster passend zur Welt | Gegner mit Charakter |
| **11** | Blitzstart, dritte Driftstufe, Sprungtrick, Windschatten, **Fahrhilfe** pro Person | mehr Tiefe für Gute, Hilfe für Neue |
| **12** | **Klänge**, Rennereignisse, Hebel, Kronleuchter, Händler, Zuschauer, Beutel | jedes Rennen lebendiger |
| **13** | Zeitfahren mit Geist und Medaillen, Tagesstrecke, Aufgaben und Sterne, Wimpel und Farben | allein lange etwas zu tun |
| **14** | zweiter Grundriss je Welt, Großer Feldzug, Königsrennen | neue Strecken und ein großes Finale |
| **8** | Flucht aus dem Glutschlund, Schatzjagd, Teamrennen | mehr Modi für den Abend |

Am meisten bringt Paket 9 im Verhältnis zur Arbeit. Paket 14 ist am aufwendigsten, weil jede neue Strecke von Hand gebaut und mit dem Musterfahrer geprüft wird.

---

## 5. Offene Fragen

1. **Standardstufe:** Allein Abenteurer, wie vorgeschlagen? Und soll in Mehrspieler-Rennen der Spielleiter die Stufe wählen (Vorschlag: ja, Standard Abenteurer)?
2. **Belohnungen:** Reichen Sterne, Medaillen, Wimpel und Farben? Oder soll es auch Freischaltbares geben, das das Spiel verändert, etwa das Königsrennen erst nach einem Feldzug-Sieg?
3. **Fahrhilfe:** Soll sie gar nichts kosten, oder ein klein wenig Höchsttempo (etwa 3 %)?
4. **Reihenfolge:** Paket 8 (Flucht, Schatzjagd) zuerst oder nach den Paketen 9 bis 11?
5. **Musik:** leise Musik je Welt, oder nur Klänge?
