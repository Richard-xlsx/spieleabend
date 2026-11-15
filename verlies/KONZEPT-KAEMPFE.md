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

## 6. Stand der Umsetzung

**Schritt 1 und 2 fertig (15.11.2026).** Abweichungen vom Plan oben:

- **Bots:** Die klugen Bots erstarren Gegner, die Verstärkung, Beben oder Netz ankündigen, mit Eis oder Ranken. Bei
  zwei solchen Gegnern nutzen sie Ewigen Winter oder Zeitstillstand. Die Kampfwerte zeigt `tests/simulation.js` jetzt
  am Ende selbst an, ein eigenes `kampfwerte.js` war nicht nötig.
- **Gruppengröße:**
  - Leben der Gegner ×1,3 / ×1,5 / ×1,7 bei 4 / 5 / 6 Helden.
  - Schaden der Gegner ×1,15 / ×1,4 / ×1,45.
  - Zusätzliche Gegner: +1 / +1 / +2. Ab 4 Helden stehen höchstens 5 Gegner auf der Bühne.
  - Endgegner machen 2 / 2 / 3 Züge. Die Zusatzangriffe treffen andere Helden, die Ankündigung zeigt „+1 Angriff“.
    Ist der Endgegner erstarrt, fallen auch die Zusatzangriffe aus (Standhaft folgt in Schritt 3).
- **Wut-Uhr:** Ab Runde 12 statt 10, +10 % Schaden je Runde. Als „Zorn +X %“ am Endgegner sichtbar.
- **Endgegner-Leben:** Die Wut-Uhr allein machte die langen Bosskämpfe auch zu dritt tödlich, bei Abenteurer nur noch
  38 % Siege. Deshalb haben Endgegner jetzt für alle Gruppengrößen weniger Leben:
  - Ebene 1: ×0,8.
  - Ab Ebene 2: ×0,5.
  - Held und Legende erhöhen die Endgegner-Leben nur halb so stark wie die der anderen Gegner (×1,125 bzw. ×1,25).

Simulation (Normal, 2 Ebenen):

| | Bosskampf Ebene 1 vorher → jetzt | Bosskampf Ebene 2 vorher → jetzt | Siege vorher → jetzt |
|---|---|---|---|
| 3 Helden, Abenteurer | 14 → 12 Runden | 29 → 15 Runden | 85 → 89 % |
| 4 Helden, Abenteurer | 16 → 12 | 33 → 15 | 93 → 81 % |
| 5 Helden, Abenteurer | 21 → 9 | 42 → 13 | 89 → 94 % |
| 6 Helden, Abenteurer | 24 → 8 | 45 → 10 | 83 → 93 % |
| 3 Helden: Wanderer / Held / Legende | | | 100 / 59 / 24 → 100 / 58 / 21 % |

Eure Runde (5 Helden, Lang, Held, Wild + Rachsucht + Verstärkung):
- Bosskämpfe: vorher 25 / 60 / 44 Runden, jetzt 10 / 17 / 13 Runden.
- Normale Kämpfe in Ebene 3: vorher 13, jetzt 8 Runden.

**Schritt 3 und 4 fertig (15.11.2026).** Abweichungen vom Plan oben:

- **Standhaft:** Endgegner und Elite. Erstarren verhindert ihren Angriff (auch die Zusatzangriffe). Ein angekündigter
  Spezialzug (Verstärkung, Flächenangriff, Netz) kommt eine Runde später.
- **Auftauen:** gilt für alle Gegner, nicht nur für normale. Sonst hätten zwei Eiswerfer einen Endgegner dauerhaft
  festhalten und seinen Spezialzug immer weiter verschieben können. Plakette „taut auf“.
- **Takt:** Jeder Gegner hat seinen eigenen Takt. Der erste Spezialzug kommt nach 1 bis 3 Runden, danach alle 2 bis 4.
  Die Spinnenkönigin wechselt zwischen Brut und Netz.
- **Unterbrechen:**
  - Verstärkung und Flächenangriffe von Endgegnern und Elite lassen sich abbrechen.
  - Die Schwelle liegt bei 10 % der Höchstleben (Endgegner) bzw. 20 % (Elite). Mit 15 % / 35 % schafften die Bots es
    fast nie.
  - Angezeigt wird sie als „✋ 51“ in der Sprechblase und als Hinweis über den Knöpfen.
  - Die Bots brechen jetzt etwa 40 % der großen Endgegner-Züge ab.
- **Rüstung:** halbiert einen Treffer höchstens. Durchschlag (geht durch jede Rüstung) haben Obsidian-Golem und
  Ork-Häuptling. Der Glutdrache bekommt keinen Durchschlag: Mit seinen Zusatzangriffen war er damit zu viert und zu
  fünft fast unschlagbar.
- **Kurve:** Der Schaden steigt weniger stark als geplant, sonst fielen die Siegquoten zu viert und zu fünft um 15 bis
  20 Punkte.

  | Ebene | Leben bisher → neu | Schaden bisher → neu |
  |---|---|---|
  | 2 | ×2,8 → ×2,4 | ×1,9 → ×2,0 |
  | 3 | ×3,4 → ×2,9 | ×2,2 → ×2,3 |

- **Flüche erwachen:** Wild (+7,5 % statt +15 %) und Rachsucht wirken in Ebene 1 halb.
- **Wunden:**
  - Wer in einem Kampf bewusstlos war, verliert 10 % Höchstleben, höchstens dreimal. Auf Wanderer gibt es keine Wunden.
  - Heilung gibt es beim „Ausruhen“ in der Rast, im Lager zwischen den Ebenen und mit „Verbände“ beim Händler
    (12 Gold).
  - Die Wunden stehen an der Heldenzeile.

Simulation (Abenteurer, 3 Ebenen, kluge Bots, je 40 Partien pro Gruppe):

| Gruppe | Siege vorher → jetzt | K.o.-Kämpfe Ebene-3-Elite | Endgegner Ebene 2 / 3, Runden |
|---|---|---|---|
| 2 Helden | 88 → 89 % | | |
| 3 Helden | 79 → 85 % | 0 → 0 % | 15 / 14 → 12 / 10 |
| 4 Helden | 64 → 66 % | | |
| 5 Helden | 88 → 85 % | 0 → 2 % | 13 / 11 → 11 / 10 |
| 3 Helden, 2 Ebenen: Wanderer / Abenteurer / Held / Legende | 100 / 88 / 59 / 22 → 99 / 88 / 57 / 19 % | | |

Eure Runde (5 Helden, Lang, Held, Wild + Rachsucht + Verstärkung):
- Siege: 16 → 14 %.
- Ebene 1 ist leichter geworden: In 56 % der Bosskämpfe gibt es ein K.o., vorher 72 %.
- Ebene 3 ist schwerer geworden: In 59 % der Elite-Kämpfe gibt es ein K.o., vorher 21 %.
- Die Schwierigkeit verschiebt sich damit wie gewünscht nach hinten.
- Endgegner in Ebene 3 sind für kleine Gruppen eher harmloser geworden. Das soll Schritt 5 (Vernichtungsschlag)
  ändern.

**Schritt 5 fertig (15.11.2026).** Abweichungen vom Plan oben:

- **Vernichtungsschlag:**
  - Kommt erstmals in Runde 4 oder 5, danach alle 4 bis 5 Runden. Er wird eine Runde vorher angekündigt: „💀 Vernichtung → Lena“ in der Sprechblase und ein Hinweis über den Knöpfen.
  - Schaden: 80–95 % der Höchstleben des Ziels. In Ebene 1 sind es 50–65 %, zu zweit ×0,8. Rüstung zählt nicht.
  - Ab 5 Helden trifft er zwei Ziele.
  - Erstarren hilft nicht, Abbrechen auch nicht.
  - Schildwall und Spott ziehen den Schlag auf den Kämpfer (Schildwall halbiert ihn). Beschützen fängt ihn mit halbem Schaden ab. Obhut, Arkaner Schild, Fels und Wall halten ihn ganz ab. Wer versteckt ist, wird nicht gefunden.
  - Die Zusatzangriffe gegen große Gruppen kommen trotzdem. Ist der Endgegner erstarrt, entfallen sie.
- **Seelenernte (Knochenkönig):** Solange ein Held bewusstlos ist, bekommt der König jede Runde +3 % seiner Leben. Das gilt pauschal, nicht je bewusstlosem Helden. Mit 5 % je Held wurde aus jedem K.o. eine Niederlage, vor allem für Gruppen ohne Heilerin und Paladin, die niemanden zurückholen können.
- **Eier und Kokon (Spinnenkönigin):**
  - Statt Brut legt sie zwei Eier. Ein Ei hat 6 Leben. Nach 2 Runden schlüpft daraus Spinnenbrut.
  - Statt eines Netzes spinnt sie einen Helden in einen Kokon. Der Kokon ist ein eigenes Ziel mit 12 Leben. Der Held kann nur „Im Kokon zappeln“, bis die anderen den Kokon zerschlagen.
  - Zu zweit bleibt es beim Netz, sonst verloren Zweiergruppen dort dreimal so oft.
  - Eier und Kokons geben keine Erfahrung, zählen nicht für Rachsucht und zerfallen, wenn kein echter Gegner mehr steht.
- **Atem und Lava (Glutdrache):**
  - Der Flammenatem war seit Schritt 3 schon angekündigt und abbrechbar. Daran hat sich nichts geändert.
  - Neu ist die Lava in Phase 3: Am Rundenende verlieren alle Helden 2 Leben, jede Runde 1 mehr. Rüstung zählt nicht, Schutz schon.
  - Der Lavaschaden wächst nicht mit der Ebene. Mit dem Ebenen-Schaden (×2,3) starben dreimal so viele Gruppen am Drachen.
- **Endgegner haben weniger Leben, damit die neuen Gefahren die Siegquote nicht einbrechen lassen:**
  - Ebene 1: ×0,7 statt ×0,8.
  - Ab Ebene 2: ×0,45 statt ×0,5.
  - Zu fünft: zusätzlich ×0,9.
- **Bots:** Sie schützen das Ziel des Vernichtungsschlags (oder heilen es voll) und zerschlagen Kokons und Eier mit dem einfachen Angriff.

Simulation (Abenteurer, 3 Ebenen, kluge Bots, je 40 Partien pro Gruppe):

| Gruppe | Siege vorher → jetzt | Endgegner mit K.o. (Ebene 1 / 2 / 3) | Runden Endgegner (Ebene 1 / 2 / 3) |
|---|---|---|---|
| 2 Helden | 89 → 76 % | 13 / 15 / 17 % | 9 / 9 / 7 |
| 3 Helden | 85 → 79 % | 22 / 18 / 16 % | 12 / 12 / 10 |
| 4 Helden | 66 → 61 % | 38 / 34 / 33 % | 11 / 12 / 10 |
| 5 Helden | 85 → 73 % | 47 / 65 / 56 % | 9 / 9 / 8 |
| 6 Helden | 78 → 78 % | 40 / 68 / 84 % | 8 / 10 / 8 |

- Zu dritt machen 59 % der Vernichtungsschläge Schaden und 9 % schicken jemanden zu Boden. Zu fünft sind es 71 % und 34 %, denn dort trifft er zwei Helden.
- Eure Runde (5 Helden, Lang, Held, Wild + Rachsucht + Verstärkung): Siege 16 → 18 %. Bosskämpfe mit K.o.: Ebene 1 58 → 64 %, Ebene 2 66 → 75 %, Ebene 3 65 → 79 %. Die Bosskämpfe sind kürzer, in Ebene 2 zum Beispiel 14,5 → 11,4 Runden.
- Offen: Zu zweit und zu fünft verlieren die Bots jetzt öfter, vor allem in Ebene 1. Kleine Gruppen haben dort kaum Schutzfähigkeiten. Echte Spieler, die sich absprechen, schützen vermutlich besser als die Bots.
