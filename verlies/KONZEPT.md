# Verlies zu dritt – Konzept für den großen Ausbau

Stand: 14.11.2026. Bauplan für Karte, Talentbaum, mehr Gegner, Ebenen und Schwierigkeitsstufen.
Grundlage ist das laufende Spiel (8 Räume, 6 Rollen, Händler, Stufen 1–8, Ränge I–III) und die Vorschau der Kampfbühne
(`vorschau-kampf.html`). Was hier steht, ist noch nicht gebaut.

---

## 1. Ziele

- **Mehr Entscheidungen**, die man gemeinsam bespricht: Welchen Weg nehmen wir? Wer spezialisiert sich worauf?
- **Mehr Abwechslung:** Jede Partie sieht anders aus (andere Karte, andere Gegner, andere Talente).
- **Länger spielbar:** kurze Partie an einem Abend oder lange Kampagne über mehrere Abende.
- **Bleibt einfach zu bedienen:** Jeder tippt nur auf seinem Handy, Runde für Runde, ohne Zeitdruck.

---

## 2. Die Karte

### So sieht sie aus

Jede Ebene ist eine Pergamentkarte von oben nach unten. Ihr startet oben am Eingang, unten wartet der Endgegner der Ebene.
Dazwischen liegen 6 Reihen mit je 2 bis 4 Räumen. Von jedem Raum führen 1 bis 3 Wege in die nächste Reihe.

```
                 [Eingang]
               /     |     \
           (⚔)     (?)     (🎁)          Reihe 1
          /   \   /   \     |
        (⚔)  (🔥)    (⚔)   (☠)          Reihe 2   ☠ = Elite
          \   /  \   /      |
          (💰)    (?)     (⚔)            Reihe 3   💰 = Händler
           |    /    \   /
         (⚔)  (✦)    (🔥)               Reihe 4   ✦ = Schrein
           \  /  \    /
           (☠)   (⚔)(?)                  Reihe 5
              \   |  /
               (🔥)(💰)                   Reihe 6
                  \ /
               [ENDGEGNER]
```

### Raumarten

| Zeichen | Raum | Was passiert |
|---|---|---|
| ⚔ | Kampf | normale Gegnergruppe |
| ☠ | Elite | ein starker Gegner mit Sonderfähigkeit, dafür seltene Beute und doppelte Erfahrung |
| 🎁 | Truhe | Gold, Tränke, manchmal ein seltener Gegenstand; Dieb entschärft Fallen |
| 🔥 | Rast | heilen **oder** üben (eine Fähigkeit +1 Rang ohne Punkt) – man muss sich entscheiden |
| 💰 | Händler | Ausrüstung, Tränke, seltene Gegenstände |
| ✦ | Schrein | Segen oder Fluch wählen, oder Talente gegen Gold neu verteilen |
| ? | Unbekannt | Ereignis, Falle, Rätsel, manchmal ein versteckter Kampf |
| 🔒 | Verschlossen | braucht einen Schlüssel (von Elite-Gegnern) und führt zu einer Schatzkammer |

### Regeln

- **Abstimmen auf der Karte:** Jeder tippt den nächsten Raum an, die Mehrheit entscheidet, bei Gleichstand das Los
  (wie jetzt bei den Türen). Der gewählte Weg wird mit Fußspuren eingezeichnet.
- **Nebel:** Man sieht nur die nächsten 2 Reihen genau. Weiter unten stehen nur „?“.
  **Rollenbonus:** Mit Waldläufer oder Dieb in der Gruppe sieht man 3 Reihen weit.
- **Geheimgang:** Der Dieb kann einmal pro Ebene eine Reihe überspringen.
- **Gleiche Karte für alle:** Die Karte wird aus dem Zufallsstartwert im Spielstand erzeugt (wie jetzt `S.rng`).
  Übernimmt jemand die Spielleitung, bleibt sie gleich.

### Darstellung

- Pergament mit Tuschelinien wie die Buchseiten, besuchte Räume ausgegraut, aktueller Raum leuchtet.
- Die drei Heldensymbole wandern als kleine Figuren den Weg entlang.
- Antippen eines Raums zeigt eine Vorschau („Elite: Kerkerwärter, gepanzert“), soweit nicht im Nebel.

---

## 3. Ebenen: länger als 8 Räume

Eine Partie besteht aus **1 bis 3 Ebenen** mit je etwa 7 Räumen plus Endgegner.

| Ebene | Ort | Stimmung | Endgegner |
|---|---|---|---|
| 1 | **Der Kerker** | Steinmauern, Fackeln, Ketten | **Der Knochenkönig** |
| 2 | **Die Spinnengrotte** | Pilze, Netze, grünes Leuchten | **Die Spinnenkönigin** |
| 3 | **Der Glutschlund** | Lava, Obsidian, rotes Licht | **Der Glutdrache** |
| 4 (später) | **Die Tiefe** | Endlosmodus, jede Ebene schwerer | wechselnd |

**Partielänge wählt der Spielleiter in der Lobby:**

| Länge | Ebenen | Räume | Dauer etwa |
|---|---|---|---|
| Kurz | 1 | ~8 | 25–35 Minuten |
| Normal | 2 | ~16 | 50–70 Minuten |
| Lang | 3 | ~24 | 80–110 Minuten, gut über zwei Abende |

Zwischen zwei Ebenen gibt es immer ein **Lager**: volle Heilung, Händler, und der Stand wird gespeichert
(siehe Abschnitt 8). Jede Ebene hat ihre eigene Kampfbühne (Hintergrund, Licht, Farben).

---

## 4. Heldenstufen bis 20

- Die Stufengrenze steigt von 8 auf **20**. In einer kurzen Partie erreicht man etwa Stufe 5–6,
  in einer langen Partie etwa Stufe 14–17. Stufe 20 schafft man nur in der Tiefe oder mit Kampagne.
- **Jede Stufe:** +3 Höchstleben und **1 Talentpunkt**.
- **Stufen 5, 10, 15, 20:** zusätzlich +1 Trankplatz bzw. ein kleiner Grundwert-Bonus (+1 Schaden, −1 Schaden bei Treffern).
- Erfahrungskurve wird etwas steiler (z. B. 15, 35, 60, 90, 125, 165, 210, 260, 315, 375 … je Stufe ca. 10 % mehr Abstand),
  Elite-Gegner und Endgegner geben deutlich mehr Erfahrung.

---

## 5. Der Talentbaum

Der Talentbaum **ersetzt die jetzigen Ränge I–III und die beim Händler lernbaren Fähigkeiten**.
Talentpunkte gibt es mit jeder Stufe; ausgeben kann man sie außerhalb des Kampfes.

### Aufbau

- Jede Rolle hat **3 Äste** (Spezialisierungen) mit je **6 Knoten** übereinander.
- Ein Knoten ist erst wählbar, wenn der darunterliegende im selben Ast gewählt ist.
- Knotenarten:
  - **Verbesserung** einer vorhandenen Fähigkeit (mehr Schaden, mehr Heilung, kürzere Abklingzeit)
  - **Passiv** (wirkt immer, z. B. „unter halbem Leben +3 Schaden“)
  - **Neue Fähigkeit**
  - **Meisterfähigkeit** ganz oben – sehr stark, nur eine pro Held (wer zwei Äste bis oben füllt, muss sich entscheiden)
- 18 Knoten je Rolle, in einer langen Partie bekommt man ~16 Punkte: **Man kann nicht alles haben.**
  Das macht jede Partie anders und lädt zum Absprechen ein („Ich gehe Beschützer, dann kannst du Berserker gehen“).
- **Neu verteilen:** am Schrein gegen Gold.

### Beispiel: Kämpfer (vollständig)

| Stufe im Ast | **Beschützer** | **Berserker** | **Feldherr** |
|---|---|---|---|
| 1 | Schildwall: Abklingzeit −1 | Schwerthieb +2 Schaden | Neu: Kriegsschrei (alle nächster Angriff +3) |
| 2 | Passiv: Eiserne Haut, −1 Schaden pro Treffer | Passiv: Blutrausch, unter 50 % Leben +3 Schaden | Wirbelschlag +2 Schaden |
| 3 | Neu: Spott – ein Gegner muss dich angreifen | Neu: Vernichtender Hieb (13–17) | Passiv: Sammeln – nach jedem Kampf alle +4 Leben |
| 4 | Schildwall: auch Gift prallt ab | Schwerthieb +2 Schaden, trifft 1× pro Kampf doppelt | Kriegsschrei: zusätzlich alle +5 Leben |
| 5 | Passiv: Wer dich trifft, bekommt 2 Schaden zurück | Passiv: Jeder besiegte Gegner heilt dich um 5 | Neu: Taktik – alle Fähigkeiten eines Helden sofort bereit |
| **Meister** | **Bollwerk:** 1 Runde nimmt die ganze Gruppe nur halben Schaden | **Raserei:** 2 Runden lang zwei Angriffe pro Runde | **Schlachtruf:** alle Helden handeln diese Runde zweimal |

### Die anderen Rollen (Äste und Meisterfähigkeiten)

| Rolle | Ast 1 | Ast 2 | Ast 3 |
|---|---|---|---|
| **Paladin** | *Schutzherr* – Beschützen wird stärker, Schild für zwei → **Heiliger Wall:** alle unverwundbar 1 Runde | *Rächer* – Hammer, Heiliges Licht, Licht gegen Untote doppelt → **Gottesurteil:** 30 Schaden, Untote sofort vernichtet | *Gnade* – Handauflegen, Heilung auf alle → **Auferstehung:** alle Bewusstlosen voll geheilt |
| **Dieb** | *Assassine* – Dolch, Hinterhalt, kritische Treffer → **Todesstoß:** besiegt einen Gegner unter 30 % sofort | *Giftmischer* – Gift stärker und auf alle → **Seuche:** Gift springt beim Tod auf andere über | *Gauner* – Gold, Taschendieb, Rauchbombe → **Meisterdieb:** stiehlt einen seltenen Gegenstand aus jedem Elite-Kampf |
| **Waldläufer** | *Scharfschütze* – Pfeilschuss, Kopfschuss → **Durchschuss:** trifft alle Gegner hintereinander | *Jäger* – Markieren, Fallen stellen → **Beute:** markierte Gegner geben doppelt Gold und Erfahrung | *Naturkunde* – Kräuter, Gift heilen, Tiergefährte → **Wolfsrudel:** ein Wolf kämpft 3 Runden mit |
| **Magierin** | *Feuer* – Feuerball, Brand (Schaden über Zeit) → **Inferno:** 20 Schaden an allen | *Eis* – Eislanze, Frost verlangsamt → **Ewiger Winter:** alle Gegner erstarren 1 Runde | *Arkan* – Arkaner Schild, Zauber werfen Abklingzeit zurück → **Zeitriss:** die ganze Gruppe handelt diese Runde zweimal |
| **Heilerin** | *Licht* – Heilen, Segen stärker → **Wiedergeburt:** alle stehen mit voller Gesundheit auf | *Wächterin* – Schutzzauber, Läuterung → **Heiligtum:** 3 Runden lang +8 Leben pro Runde für alle | *Kampfpriesterin* – Lichtstab, Heilen trifft auch Gegner → **Sonnenzorn:** Schaden an allen = geheilte Leben der letzten Runde |

### Darstellung

Ein eigener Bildschirm pro Held: drei Äste als Tuschezeichnung eines Baums, die Knoten als Rauten wie jetzt bei den Rängen.
Gewählte Knoten leuchten gelb, wählbare blinken leicht, gesperrte sind grau. Antippen zeigt die Beschreibung,
zweites Antippen wählt. Die Mitspieler sehen in der Gruppe, wer welchen Ast geht (kleines Symbol neben dem Namen).

---

## 6. Mehr Gegner

### Gegner-Eigenschaften (Schlüsselwörter)

Statt nur mehr Leben bekommen Gegner **Eigenschaften**, auf die man reagieren muss. Jeder Gegner kündigt
seinen nächsten Zug an (gelbes Schild über dem Kopf, wie in der Vorschau).

| Eigenschaft | Wirkung | Was hilft |
|---|---|---|
| **Gepanzert** | −3 Schaden von jedem Treffer | Gift, Magie und Licht ignorieren die Panzerung |
| **Untot** | Licht macht doppelten Schaden, Gift wirkt nicht | Heilerin, Paladin |
| **Fliegend** | Nahkampf macht nur halben Schaden | Pfeile, Zauber |
| **Schnell** | greift zweimal pro Runde an | Eis, Erstarren |
| **Rudel** | +2 Schaden für jeden lebenden Artgenossen | Flächenschaden |
| **Regeneration** | +5 Leben pro Runde | Feuer stoppt es für 2 Runden |
| **Explosiv** | beim Tod 6 Schaden an allen Helden | erst Schild, dann töten |
| **Netz** | ein Held setzt eine Runde aus | Feuer befreit |
| **Beschwörer** | ruft alle 3 Runden Verstärkung | zuerst ausschalten |
| **Heiler / Schildträger** | heilt oder schützt andere Gegner | zuerst ausschalten |
| **Langfinger** | stiehlt Gold und flieht nach 3 Runden | schnell besiegen, dann gibt's das Gold zurück |

### Gegner je Ebene

| Ebene | Normale Gegner | Elite-Gegner | Endgegner |
|---|---|---|---|
| **Kerker** | Riesenratte, Rattenschwarm (Rudel), Goblin, Goblin-Langfinger, Goblin-Schamane (Heiler), Skelett (untot), Skelett-Bogenschütze (untot, steht hinten), Ghul (untot, Gift) | **Kerkerwärter** (gepanzert, trägt den Schlüssel), **Totenbeschwörer** (Beschwörer) | **Knochenkönig**: Beben jede 3. Runde, ruft Skelette, Phase 2 ab halben Leben: Knochenschild |
| **Spinnengrotte** | Höhlenspinne (Gift), Spinnenbrut (Rudel, schwach, viele), Netzweberin (Netz), Pilzling (explosiv, Sporen), Fledermausschwarm (fliegend, schnell), Schleim (teilt sich bei Treffern) | **Höhlentroll** (Regeneration), **Brutmutter** (Beschwörer) | **Spinnenkönigin**: legt Eier, aus denen Brut schlüpft, spinnt Helden ein, Phase 2: hängt an der Decke (fliegend) |
| **Glutschlund** | Feuerkobold (schnell), Lavaschnecke (gepanzert), Salamander (Brand), Ork-Krieger, Ork-Schamane (Schildträger), Obsidian-Golem (sehr gepanzert, greift nur jede 2. Runde an) | **Ork-Häuptling** (stärkt alle Orks), **Feuerelementar** (explosiv, Brand) | **Glutdrache**: fliegend, Flammenatem auf alle, Phase 2 am Boden mit Schwanzhieb, Phase 3 unter 25 %: Wut (schnell) |

Das sind **21 normale Gegner, 6 Elite-Gegner und 3 Endgegner** (jetzt: 6 und 1). Alle bekommen eigene Zeichnungen
für die Kampfbühne, auch eine „holt aus“- und eine „getroffen“-Haltung.

---

## 7. Schwierigkeitsstufen

### Grundstufen (in der Lobby wählbar)

| Stufe | Gegner-Leben | Gegner-Schaden | Gold | Rast heilt | Besonderes |
|---|---|---|---|---|---|
| **Wanderer** | 75 % | 75 % | 120 % | 60 % | Bewusstlose stehen nach dem Kampf mit halben Leben auf |
| **Abenteurer** | 100 % | 100 % | 100 % | 40 % | so wie heute |
| **Held** | 125 % | 115 % | 90 % | 30 % | mehr Elite-Räume, Gegner kündigen nur das Ziel an, nicht die Stärke |
| **Legende** | 150 % | 130 % | 80 % | 25 % | Bewusstlose stehen nach dem Kampf **nicht** von selbst auf (nur Heilung oder Rast) |

Ziel bei der Abstimmung (per Simulation wie bisher): Wanderer gewinnt man fast immer, Abenteurer meistens,
Held etwa jede zweite Partie, Legende nur mit guter Absprache.

### Flüche (für danach): freiwillig schwerer, mehr Ruhm

Wer Legende geschafft hat, kann zusätzlich **Flüche** einschalten. Jeder Fluch macht es schwerer und gibt mehr **Ruhm**
(Punkte für die Ruhmeshalle):

- **Dichter Nebel:** Karte nur 1 Reihe weit sichtbar
- **Hungrig:** Rast heilt nur 15 %
- **Wucher:** Händler 50 % teurer
- **Zähe Brut:** alle Gegner +20 % Leben
- **Wütende Herrscher:** Endgegner bekommen eine zusätzliche Phase
- **Ohne Rückweg:** keine Tränke beim Händler
- **Zeitdruck (optional):** 60 Sekunden pro Kampfrunde, danach Standardzug

---

## 8. Über mehrere Abende (Kampagne)

- **Speichern zwischen Ebenen:** Der Spielstand liegt beim Spielleiter (wie heute im Browser).
  Zusätzlich gibt es einen **Fortsetzungs-Code**, falls jemand anderes nächstes Mal Spielleiter ist.
- **Heldenbuch (pro Spieler, auf dem eigenen Handy):** abgeschlossene Ebenen, besiegte Endgegner, höchste Schwierigkeit,
  Lieblingsrolle. Daraus kommen **Freischaltungen**, z. B. Startausrüstung, weitere Flüche, ein siebter Charakter.
- **Ruhmeshalle:** die besten Läufe mit Gruppe, Schwierigkeit, Flüchen und Dauer.

---

## 9. Optik

- **Kampfbühne** aus der Vorschau für alle Kämpfe, mit eigenem Hintergrund pro Ebene.
- **Karte** als Pergament mit Fußspuren und wandernden Heldenfiguren.
- **Talentbaum** als gezeichneter Baum mit leuchtenden Knoten.
- **Stufenaufstieg:** kurzes Aufleuchten mit Ton, Zahl fliegt hoch.
- **Seltene Gegenstände** mit eigener Farbe (gewöhnlich, selten, episch) wie in vielen Rollenspielen.

---

## 10. Umsetzung in Schritten

Jeder Schritt ist für sich spielbar und wird vor dem nächsten mit euch getestet.

| Schritt | Inhalt | Aufwand etwa |
|---|---|---|
| 1 | Kampfbühne aus der Vorschau ins Spiel, Gegner kündigen ihren Zug an, alle 6 Rollen und 7 Gegner gezeichnet | 1–2 Tage |
| 2 | Karte für eine Ebene, Raumarten Elite, Schrein, Unbekannt, verschlossene Räume | 1 Tag |
| 3 | Talentbaum für alle 6 Rollen (ersetzt Ränge und lernbare Fähigkeiten), Stufen bis 20 | 2 Tage |
| 4 | Gegner-Eigenschaften und neue Gegner für den Kerker, Elite-Gegner, Endgegner mit Phasen | 1–2 Tage |
| 5 | Ebenen 2 und 3 mit Gegnern, Endgegnern und eigener Bühne, Partielänge wählbar | 2 Tage |
| 6 | Schwierigkeitsstufen, später Flüche und Ruhm | 1 Tag |
| 7 | Speichern zwischen Ebenen, Fortsetzungs-Code, Heldenbuch | 1 Tag |

Nach jedem Schritt: Simulation aller Rollenkombinationen für die Balance und ein Browser-Test mit drei Spielern.

---

## 11. Offene Fragen

1. **Partielänge:** Spielt ihr eher kurz (eine Ebene an einem Abend) oder lieber lange Kampagnen?
2. **Legende:** Soll auf der höchsten Stufe ein gefallener Held endgültig ausscheiden, oder reicht „steht nicht von selbst auf“?
3. **Talente neu verteilen:** nur am Schrein gegen Gold, oder jederzeit kostenlos zwischen zwei Partien?
4. **Zeitdruck:** als Fluch interessant, oder lieber nie?
5. **Reihenfolge:** Ist Schritt 1 (Kampfbühne) als Nächstes richtig, oder lieber zuerst Karte oder Talentbaum?
