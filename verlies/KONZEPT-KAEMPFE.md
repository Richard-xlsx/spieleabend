# Verlies der Helden: Kämpfe kürzer, gefährlicher, vielfältiger

Konzept vom 15.11.2026, nach dem Spieleabend zu fünft (Lang, Held, Flüche Wild + Rachsucht + Verstärkung).

## 0. Was ihr erlebt habt und was die Simulation dazu sagt

Eure Eindrücke:

1. In Ebene 1, noch ohne Talente, waren die Gegner sehr stark. Man musste ständig jemanden wiederbeleben.
2. Ab Ebene 2 waren alle durch ihre Talente so stark, dass kaum noch jemand umfiel.
3. Kündigt ein Gegner „ruft Verstärkung“ an, friert man ihn mit der Eislanze ein, und er ruft nie.
4. Die Gegner sind zu gleichförmig: Sie sind vor allem stark, weil sie viel Leben haben.
5. Bosse hatten sehr viele Leben, und die Kämpfe zogen sich. Beim Endgegner der Ebene 3 bestand trotzdem kaum Gefahr.

Ich habe eure Runde nachsimuliert: 5 Helden, Lang, Held, dieselben drei Flüche, 240 Partien. Zum Vergleich steht
eine Dreiergruppe auf Held, Lang, ohne Flüche, daneben.

| Kampf | Runden zu fünft | K.o. je Kampf zu fünft | Runden zu dritt | K.o. je Kampf zu dritt |
|---|---|---|---|---|
| Ebene 1 normal | 7 | 0,5 | 4 | 0,0 |
| Ebene 1 Elite | 13 | 4,7 | 9 | 0,3 |
| Ebene 1 Endgegner | **25** | 5,2 | 17 | 1,3 |
| Ebene 2 normal | 9 | 0,8 | 5 | 0,0 |
| Ebene 2 Elite | 19 | 3,8 | 14 | 0,4 |
| Ebene 2 Endgegner | **60** | 7,5 | 39 | 0,4 |
| Ebene 3 normal | 13 | 0,2 | 6 | 0,0 |
| Ebene 3 Elite | 22 | 5,5 | 11 | 0,1 |
| Ebene 3 Endgegner | **44** | 7,5 | 35 | 3,2 |

Die Endgegner haben zu fünft in Ebene 2 und 3 **rund 3.000 Leben**. Ein Bosskampf dauert dort 45 bis 60 Runden. Bei
etwa 20 bis 30 Sekunden pro Runde sind das 15 bis 30 Minuten für einen einzigen Kampf.

Die Rundenzahlen sind realistisch. Die K.o.-Zahlen sind zu hoch, weil die Bots schlechter spielen als ihr. Sie
gewinnen in dieser Einstellung nur 8 % der Partien, denn sie kontern angekündigte Züge nicht gezielt, etwa mit Eis
auf den Rufer. Dass ihr gewonnen habt, bestätigt gerade Punkt 3: Wer die Ankündigungen liest, nimmt den Gegnern
ihre gefährlichen Züge.

## 1. Die fünf Ursachen

**1. Mehr Helden bedeuten dickere statt mehr Gegner.**
- Zu fünft haben Gegner das 2,7-Fache an Leben, die Gruppe macht aber nur etwa das 1,7-Fache an Schaden. Daher sind
  die Kämpfe zu fünft 50 bis 80 % länger als zu dritt.
- Der Gegnerschaden steigt nur auf das 1,45-Fache und verteilt sich auf fünf Köpfe. Ein Einzelangriff trifft jeden
  Helden also seltener als zu dritt.
- Ein Boss hat genau einen Zug pro Runde, die Gruppe hat fünf.

**2. Erstarren schaltet alles ab, und der Takt ist fest.**
- Spezialzüge kommen immer in jeder 3. Runde: Verstärkung, Beben, Flammenatem, Netz.
- Eislanze und Ranken haben genau 3 Runden Abklingzeit. Eine Magierin kann damit jeden einzelnen Spezialzug
  verhindern, auch beim Boss. Erstarren unterbricht bisher jeden Gegnerzug, auch den eines Bosses.

**3. Flache Rüstung frisst kleine Treffer.**
- Rüstung vom Händler (bis −5), Talente (−1 bis −2) und Stufe 10 (−1) ziehen von *jedem* Treffer etwas ab.
- Ein Treffer macht bisher immer mindestens 1 Schaden. Ab Ebene 2 werden dadurch alle normalen Gegner mit kleinen
  Treffern harmlos: Zu dritt fällt in normalen Kämpfen der Ebenen 2 und 3 praktisch niemand mehr um.

**4. Fast jeder Trick hat dieselbe Antwort.**
- Gegen Heiler, Beschwörer, Schildträger und Langfinger gilt dieselbe Lösung: „Zuerst ausschalten“ oder „Erstarren“.
- Es gibt kaum Gegner, die die Gruppe zu *Absprache* zwingen. Damit sind Fragen gemeint wie: Wer schützt wen? Wer
  hebt sich seine Fähigkeit auf?

**5. Bosse haben keinen Zug, der wirklich bedroht.**
- Ein Boss greift einzeln an und macht alle 3 Runden einen Flächenangriff. Zu fünft sind Heilerin und Paladin fast
  immer beide dabei, denn es fehlt nur eine der sechs Rollen. Beides lässt sich dann bequem wegheilen.
- Die Kämpfe werden lang, aber nicht spannend.

Hinzu kommt die **Kurve über die Ebenen**: Die Flüche wirken ab dem ersten Raum voll, die Helden haben dort aber noch
keine Talente. Ab Ebene 2 wachsen die Helden schneller als die Gegner, vor allem durch die Rüstung.

## 2. Ziele (messbar, per Simulation geprüft)

| | normaler Kampf | Elite | Endgegner |
|---|---|---|---|
| Runden, **unabhängig von der Gruppengröße** | 3–6 | 6–9 | 10–15 |
| Kämpfe mit mindestens einem K.o. (Held) | 10–20 % | 30–50 % | 50–70 % |

- Die K.o.-Quote soll **von Ebene zu Ebene ungefähr gleich bleiben** und nicht ab Ebene 2 einbrechen.
- Die Siegquote soll sich von 2 bis 6 Spielern um höchstens 10 Prozentpunkte unterscheiden.
- Ein Bosskampf soll höchstens etwa 6 bis 8 Minuten dauern.

## 3. Maßnahmen

### A. Gruppengröße: mehr Gegner und mehr Züge statt mehr Leben

- **Leben pro Gegner** steigt mit der Gruppengröße deutlich weniger. Vorschlag:

  | Helden | 4 | 5 | 6 |
  |---|---|---|---|
  | bisher | ×1,65 | ×2,7 | ×3,8 |
  | neu | ×1,3 | ×1,5 | ×1,7 |

- **Mehr Gegner:** Ab 4 Helden steht in normalen Kämpfen und Elite-Kämpfen ein Gegner mehr, ab 6 Helden zwei.
  Dafür bekommt die Bühne Platz für 5 Gegner. Der Fluch „Verstärkung“ kommt obendrauf.
- **Bosse handeln öfter:** Ab 4 Helden macht ein Boss 2 Züge pro Runde, ab 6 Helden 3. Ein Zug ist immer der
  angekündigte Spezialzug oder Angriff, der andere ein normaler Angriff auf ein anderes Ziel. Dafür sinken die Leben
  des Bosses wie oben.
- **Wut-Uhr bei allen Bossen:** Ab Runde 10 steigt der Bossschaden jede Runde um 10 %, auf der Bühne als Glut oder
  Aura sichtbar. Wer trödelt, bekommt Gefahr statt Langeweile. Das sichert die Obergrenze der Kampflänge ab.

### B. Erstarren und Takt neu

- **Standhaft:** Bosse und Elite-Gegner sind standhaft. Erstarren verhindert bei ihnen nur den normalen Angriff.
  Ein angekündigter Spezialzug wird **um eine Runde verschoben**, nicht gestrichen.
  - Erstarren bleibt nützlich, weil es Zeit verschafft.
  - Es ist aber kein Ausschalter mehr.
- **Auftauen bei normalen Gegnern:** Wer erstarrt war, kann in der nächsten Runde nicht wieder erstarren. Plakette:
  „taut auf“. Dauerstarre durch zwei Eiswerfer ist damit vorbei.
- **Unterbrechen durch Schaden:** Große Züge werden als **Aufladen** angekündigt, zum Beispiel „Der Totenbeschwörer
  beginnt ein Ritual“ oder „Der Drache holt Luft“.
  - Ein Balken zeigt die Schwelle, etwa „Unterbrechen: 60 Schaden in dieser Runde“.
  - Schafft die Gruppe die Schwelle in der Runde gemeinsam, ist der Zug abgebrochen.
  - So wird aus *einem* Knopf eine Absprache der ganzen Gruppe: Alle auf den Beschwörer?
- **Kein fester Takt mehr:** Spezialzüge kommen nach 2 bis 4 Runden statt immer in jeder 3. Runde. Sie werden wie
  bisher eine Runde vorher angekündigt.

### C. Rüstung

- Rüstung kann einen Treffer **höchstens halbieren**, statt ihn bis auf 1 Schaden zu drücken. Kleine Gegner bleiben
  damit lästig, große werden durch Rüstung spürbar schwächer.
- Neue Eigenschaft **Durchschlag** für einige Gegner ab Ebene 2 (Golem, Ork-Häuptling, Drache): Ihre Treffer
  ignorieren die Rüstung.

### D. Neue Gegner-Eigenschaften: auf andere Art stark

Jede Eigenschaft verlangt eine andere Antwort als „mehr Schaden“ oder „Erstarren“:

| Eigenschaft | Wirkung | Was hilft |
|---|---|---|
| **Jäger** | greift immer den Helden mit den wenigsten Leben an | Spott, Schildwall, Beschützen |
| **Meuchler** | ignoriert Spott und Schildwall, sucht sich die Heilerin | Verstecken, Obhut, Arkaner Schild |
| **Wundbrand** | Getroffene können 2 Runden lang nicht geheilt werden | vorher schützen statt hinterher heilen |
| **Todesmal** | markiert einen Helden, in 2 Runden trifft ihn ein schwerer Schlag (fast seine vollen Leben) | Schild, Beschützen, Obhut, Verstecken |
| **Stille** | ein Held kann nächste Runde nur angreifen, keine Fähigkeiten | Reihenfolge absprechen, wer seine Fähigkeit vorher nutzt |
| **Zorn** | +2 Schaden für jede Runde, die er lebt | Tempo, ihn zuerst angreifen |
| **Seelenband** | zwei Gegner, die in derselben Runde fallen müssen, sonst steht der andere wieder auf | Schaden aufteilen und absprechen |
| **Leibwächter** | zieht alle Angriffe auf sich, solange er steht | Flächenschaden, Gift, Pfeile auf die Hinteren |
| **Wechselhaut** | abwechselnd immun gegen Nahkampf bzw. gegen Zauber (angekündigt) | Ziele tauschen, die richtige Rolle greift an |
| **Zeitfresser** | verlängert bei einem Helden alle Abklingzeiten um 1 | Fähigkeiten früh nutzen, ihn zuerst ausschalten |
| **Fluchträger** | solange er lebt: Heilung an Helden halbiert | zuerst ausschalten, Schaden vermeiden |

**Elite-Zusätze (zufällig):** Jeder Elite-Gegner bekommt ab Ebene 2 einen zufälligen Zusatz, auf Legende zwei.
Möglich sind: *Eisig* (kann nicht erstarren), *Vampirisch* (heilt sich um die Hälfte seines Schadens), *Zornig*,
*Geschwind* (schnell), *Wächter* (Leibwächter für die anderen) und *Fluchträger*. Der Zusatz steht als Plakette am
Gegner. Das bringt viel Abwechslung, ohne neue Zeichnungen zu brauchen.

Die neuen Eigenschaften verteile ich auf die bestehenden Gegner, ein paar bekommen neue Gestalten. Beispiele:
- Ghul: Wundbrand
- Netzweberin: Stille
- Ork-Krieger: Zorn
- Lavaschnecken als Paar: Seelenband
- Kerkerwärter: Leibwächter
- Fledermausschwarm: Jäger

### E. Bosse mit echter Gefahr

Alle Bosse bekommen den **Vernichtungsschlag**:
- Er wird angekündigt und trifft 1 Helden, ab 5 Helden 2.
- Der Schaden liegt bei etwa 80 bis 100 % der Höchstleben des Ziels.
- Abwehr: Schild, Obhut, Beschützen, Verstecken, Arkaner Schild, oder Spott lenkt ihn auf den Kämpfer um.
- Erstarren hilft nicht.

Jeder Bosskampf fordert so mehrmals eine Absprache („Wer schützt Lena?“). Ein K.o. ist dabei immer möglich, aber
vermeidbar.

Dazu bekommt jeder Boss eine eigene Mechanik:

- **Knochenkönig – Seelenernte:** Liegt ein Held bewusstlos, heilt das den König jede Runde um 5 %. Man muss also
  schnell wiederbeleben, statt in Ruhe weiterzukämpfen. Phase 2 bleibt mit Knochenschild und Skeletten.
- **Spinnenkönigin – Eier und Kokon:**
  - Sie legt Eier. Das sind eigene, schwache Ziele mit einer Brutzeit von 2 Runden. Ein Treffer reicht, sonst
    schlüpft Brut.
  - Ein eingesponnener Held kann sich nicht selbst befreien, das muss ein anderer tun.
  - In Phase 2 hängt sie an der Decke (fliegend).
- **Glutdrache – Atem und Lava:**
  - Der Flammenatem lädt sich eine Runde lang auf und kann nur durch Schaden unterbrochen werden (Schwelle, siehe B).
    Gelingt das nicht, trifft er alle und setzt sie in Brand.
  - In Phase 3 steigt die Lava: Jede Runde nehmen alle 2 Schaden, danach jede Runde 1 mehr.

### F. Kurve über die Ebenen

- **Flüche erwachen:** Wild und Rachsucht wirken in Ebene 1 nur halb so stark, ab Ebene 2 voll. In der Lobby steht
  das am Fluch dabei.
- **Gegner der tieferen Ebenen schlagen härter, haben aber weniger Leben:**

  | Ebene | Leben bisher | Leben neu | Schaden bisher | Schaden neu |
  |---|---|---|---|---|
  | 2 | ×2,8 | ×2,2 | ×1,9 | ×2,2 |
  | 3 | ×3,4 | ×2,6 | ×2,2 | ×2,7 |

  Zusammen mit der Rüstungsregel aus C bleiben die Kämpfe in Ebene 2 und 3 kurz und gefährlich.
- **Wunden:**
  - Wer in einem Kampf bewusstlos war, hat bis zur nächsten Rast 10 % weniger Höchstleben, höchstens −30 %.
  - Ein K.o. bleibt damit spürbar, ohne dass jemand ausscheidet.
  - Die Rast und der Händler mit „Verbände“ heilen Wunden.

### G. Bessere Bots für die Simulation

Die Bots müssen spielen wie ihr: Ankündigungen kontern, beim Vernichtungsschlag schützen, Rufer zuerst angreifen und
Schwellen gemeinsam knacken. Sonst stimmen die Werte nicht. Das Messskript aus dieser Auswertung zählt Runden,
K.o. und tiefsten Gruppenstand je Ebene und Raumart. Es kommt mit ins Repo (tests/kampfwerte.js).

## 4. Reihenfolge der Umsetzung

| Schritt | Inhalt | spürbarer Effekt | Aufwand |
|---|---|---|---|
| 1 | Bots schlauer machen, Messskript (G) | Grundlage für alles | klein |
| 2 | Gruppengröße und Wut-Uhr (A) | Kämpfe zu fünft deutlich kürzer | klein |
| 3 | Standhaft, Auftauen, Takt 2–4, Unterbrechen per Schwelle (B) | Eis-Trick weg, mehr Absprache | mittel |
| 4 | Rüstung halbiert höchstens, Kurve, Flüche erwachen, Wunden (C, F) | Ebene 2–3 bleiben gefährlich, Ebene 1 fairer | klein |
| 5 | Vernichtungsschlag und eigene Mechanik je Boss (E) | Bosse spannend statt lang | mittel |
| 6 | Neue Eigenschaften und Elite-Zusätze (D) | Vielfalt | groß |

Nach jedem Schritt prüfe ich die Ziele aus Abschnitt 2 per Simulation für 2 bis 6 Spieler. Die Werte passe ich an,
bis sie stimmen.

## 5. Offene Fragen

1. Wie lang darf ein Bosskampf höchstens sein: eher 10 oder eher 15 Runden?
2. Wunden (−10 % Höchstleben bis zur Rast): gut, oder zu viel Strafe?
3. Elite-Zusätze zufällig, oder lieber feste Gegner mit festen Eigenschaften, damit man sie wiedererkennt?
4. Soll der Fluch „Verstärkung“ bleiben, wenn ab 4 Helden ohnehin mehr Gegner kommen? Oder soll er stattdessen den
   Gegnern einen Elite-Zusatz geben?
