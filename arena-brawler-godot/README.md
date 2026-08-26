# Arena Brawler (Godot 4)

Moderner 2D-Arena-Brawler in Godot 4 mit GDScript.

> **Eigenständiges Projekt.** Es hat nichts mit der React-Spielesammlung im
> übergeordneten Verzeichnis zu tun und nichts mit dem Phaser-Prototyp in
> `arena-brawler-mini/` — kein gemeinsamer Code, keine gemeinsamen Abhängigkeiten.
> Es liegt nur im selben Repository.

Stand: **erste spielbare Runde**. Arena, Spieler, Bewegung, Schießen, drei
Charaktervarianten mit eigenen Figuren, ein Verfolger-Gegner und ein
Wellensystem stehen — man kann eine Runde von Anfang bis Game-Over
durchspielen. Aufwertungen, Auswahlbildschirm und Touch-Bedienung kommen
später.

## Öffnen und starten

1. [Godot 4](https://godotengine.org/download) installieren (entwickelt und
   geprüft mit **4.3 stable**).
2. Godot starten → **Import** → diese `project.godot` auswählen → **Import & Edit**.
   Beim ersten Öffnen legt Godot den Ordner `.godot/` an; der gehört nicht ins
   Repository und steht in der `.gitignore`.
3. **F5** startet das Spiel (die Hauptszene ist in `project.godot` gesetzt, es
   kommt also keine Rückfrage).

Ohne Editor, direkt aus der Kommandozeile:

```bash
godot --path . # startet die Hauptszene
godot --headless --path . scenes/pruefen.tscn # lässt die Prüfungen laufen
```

## Steuerung

| | |
|---|---|
| Bewegen | WASD oder Pfeiltasten |
| Schießen | Leertaste (gedrückt halten geht) |
| Charakter wechseln | Tab |

Touch ist vorbereitet, aber noch nicht angeschlossen: `Bewegung.richtung_aus_stick`
rechnet den Ausschlag eines virtuellen Sticks bereits um und ist geprüft — es
fehlt nur die Bedienoberfläche dazu.

## Ordner

```
arena-brawler-godot/
├── project.godot          Projekt, Autoloads, Eingaben, Kollisionsebenen
├── icon.svg
├── autoload/              global, immer da
│   ├── charaktere.gd        die drei Varianten (reine Daten)
│   └── spielstand.gd        gewählter Charakter + Bestleistung, speichert nach user://
├── scenes/
│   ├── main.tscn            Hauptszene: Arena + Spieler + Wellenleiter + Kamera + Kopfzeile + Rundenende
│   ├── arena.tscn           Boden, Rand, Wände
│   ├── geschoss.tscn
│   ├── pruefen.tscn         Prüfszene (nicht Teil des Spiels)
│   ├── musterblatt.tscn     gibt die Figuren als JSON aus (Werkzeug)
│   └── rundenprobe.tscn     spielt eine Runde mehrere Sekunden durch (Werkzeug)
├── characters/
│   └── spieler.tscn
├── enemies/
│   ├── gegner.tscn
│   └── gegner.gd
├── scripts/
│   ├── gemeinsam/
│   │   ├── bewegung.gd      reine Rechnung, ohne Node und ohne Uhr
│   │   ├── gestalt.gd       die Vielecke der drei Figuren, ebenso rein
│   │   └── figur.gd         zeichnet sie — der einzige Knoten dafür
│   ├── spieler/
│   │   ├── spieler.gd
│   │   └── geschoss.gd
│   ├── welt/
│   │   ├── main.gd
│   │   ├── arena.gd
│   │   ├── wellen.gd        Steigerung über die Wellen, reine Rechnung
│   │   └── wellenleiter.gd  spawnt Gegner, wartet, startet die nächste Welle
│   ├── pruefen.gd
│   ├── musterblatt.gd
│   └── rundenprobe.gd
├── ui/                    (noch leer)
└── assets/
    ├── sprites/  audio/  fonts/   (noch leer)
```

## Trennung von Logik und Darstellung

Der wichtigste Punkt im Aufbau, und der Grund für den Ordner `scripts/gemeinsam/`:

**`bewegung.gd` enthält nur statische Funktionen** — kein Node, keine Uhr, kein
Zugriff auf die Szene. Richtung aus Tasten, Richtung aus einem Stick-Ausschlag,
Grenze der Arena, Suche nach dem nächsten Ziel. Alles bekommt seine Eingaben
gereicht und gibt ein Ergebnis zurück.

Ein `CharacterBody2D` lässt sich nur mit laufender Szene und Physikschritt
prüfen. Diese Funktionen lassen sich einzeln durchrechnen — und genau dort
sitzen die Fehler, die man im Spiel nur als Gefühl merkt. Beispiel aus der
Prüfliste: Ohne Normieren läuft man diagonal um den Faktor 1,41 schneller als
geradeaus. Im Spiel merkt man „schräg ist irgendwie schneller" und sucht lange;
in einer Prüfung steht es in einer Zeile.

`spieler.gd` verbindet deshalb nur: Tasten lesen, Ergebnis an die Physik geben,
Aussehen setzen. `main.gd` steckt Arena, Spieler und Kamera zusammen und kennt
keine ihrer Rechnungen.

Dieselbe Trennung wie in der Spielesammlung (`logik.ts` neben der
React-Komponente) und im Phaser-Prototyp (`wellen.js` neben der Szene).

## Charaktere

| | Leben | Tempo | Schusspause | Reichweite | Unverwundbar |
|---|---|---|---|---|---|
| Ausgewogen | 5 | 260 | 0,25 s | 460 | 0,9 s |
| Schnell | 4 | 355 | 0,215 s | 380 | 0,9 s |
| Tank | 7 | 215 | 0,3 s | 460 | 1,3 s |

Der Tank bekommt eine **längere** Unverwundbarkeit, keine kürzere: Eine kürzere
wäre für ihn ein Nachteil und das Gegenteil seiner Rolle. Wer viel einsteckt,
soll nach einem Treffer Zeit haben, sich zu lösen.

Die Werte liegen in `autoload/charaktere.gd` und **nirgends sonst**. Stünde ein
Startwert im Spielercode noch einmal fest verdrahtet, gälte für einen Wert der
Charakter und für den nächsten die alte Zahl — und das fällt erst beim Spielen
auf, nicht beim Lesen.

`Variante` ist eine eigene Klasse und kein `Dictionary`: Ein Tippfehler im
Feldnamen fliegt so beim Start auf statt still `null` zu liefern.

## Wie die Figuren aufgebaut sind

Alles im Code gezeichnet, **keine einzige Bilddatei**. `gestalt.gd` liefert je
Variante eine Liste von Teilen (Vieleck + Fläche + Umriss), `figur.gd` malt sie
in einem `_draw()`. Dieselbe Trennung wie bei der Bewegung, mit demselben
Gewinn: Der Umriss lässt sich durchrechnen, ohne dass etwas läuft, und ein
Auswahlbildschirm kann später dieselbe Figur zeigen, ohne einen Spieler zu bauen.

**Blick von oben — vorn ist −Y.** Das ist die Entscheidung, an der alles hängt:
`spieler.gd` dreht die Anzeige auf `richtung.angle() + PI/2`, bei Drehung 0
schaut die Figur also nach oben. Vorlagen aus der Seitenansicht müssen deshalb
übersetzt werden, sonst zeichnet man ein Bild, das es aus dieser Kamera gar
nicht gibt:

| Seitenansicht | von oben |
|---|---|
| aufrechte Haltung | kompakter, symmetrischer Umriss |
| nach vorn gebeugt | lang und vorn spitz |
| breite Schultern | echte Breite in X, Schulterstücke außen |

**Dritte Überarbeitungsrunde: Silhouette zuerst.** Die ersten beiden Runden
verbesserten Proportion und Schattierung, ließen aber den Grundfehler stehen —
alle drei waren letztlich derselbe abgerundete, getonnte Torso mit
austauschbaren Kapsel-Armen, Kapsel-Beinen und einer Kapsel-Waffe daran. Der
Prüfstein, den Ronni dafür genannt hat: „Deckt man alle drei komplett schwarz
ab, muss man sie trotzdem sofort auseinanderhalten." Das bestand die
zweite Fassung nicht — drei ähnlich getonte Tonnen unterschieden sich vor
allem über die Farbe, nicht über die Form.

Jetzt hat jede Figur einen **grundverschiedenen** Rumpf, und die Gliedmaßen,
die sich zwischen allen dreien fast gleich anfühlten, sind bis auf die Beine
ersatzlos raus — eine Klinge, eine Finne oder eine Schulterplatte trägt die
Aussage „hier ist die Schulter" allein, ohne einen Arm dahinter:

| | Rumpf | halbe Breite | Markenzeichen |
|---|---|---|---|
| Ausgewogen | Sechseck, vorn **und** hinten spitz (ein Schild von oben) | 18,0 | klingenförmige Schulterstücke nach vorn-außen, große weiße Brustraute |
| Schnell | langer Pfeil, Nase bis y = −20 | 14,0 | Finne nach **hinten**-außen gefegt (Gegenentwurf zur Klinge), ein breites Streamer-Band |
| Tank | Achteck mit geraden Kanten, kaum verjüngt | 21,0 | massive blockige Schulterplatten, dicht an der 21,6-Grenze unten |

Als reiner schwarzer Schattenriss (Farbe komplett weg) ergibt das ein
Sechseck mit zwei Flügeln, einen Pfeil mit gegabeltem Schwanz und einen
breiten, flachschultrigen Block — drei Formen, die sich nicht verwechseln
lassen, geprüft mit einem eigenen Silhouetten-Rendering vor dem Commit, nicht
nur behauptet.

Weniger Teile als vorher (13–14 statt 16–17), aber jedes größer: eine
einzelne große Fläche liest sich bei 32 bis 40 Pixel Darstellungsgröße noch
klar, ein halbes Dutzend kleiner Rundungen verschwimmt zu Matsch. Die Beine
sind jetzt eckige Trapeze statt gerundeter Kapseln, Arme, Handschuhe und
Waffen sind komplett weg — `_kapsel()` steht nur noch einmal im Code, für den
schmalen Rennstreifen auf der Brustraute des Ausgewogenen.

**Verlauf statt flacher Fläche — dritte Runde.** Eine einzige Farbe je Teil
sah aus wie ein Aufkleber, egal wie durchdacht der Umriss war: „Das sieht
immer noch aus wie in den Achtzigern, nicht wie ein modernes App-Store-Spiel."
Genau das ist die Lektion, die die Spielesammlung nebenan beim Sternenschlucker
schon gelernt hat — „Radialverlauf im Körper, Licht oben links, dazu ein
einzelner harter Glanzpunkt." Jetzt gilt dieselbe Formel hier:

- `Gestalt.Teil` trägt ein Feld `schattiert`. Ist es an (Standard), bekommt
  das Vieleck keine flache Füllung mehr, sondern eine Farbe **je Eckpunkt** —
  hell zur Lichtseite, dunkel zur Gegenseite —, die Godots `draw_polygon`
  selbst weich über die Fläche verläuft. Panzerung, Helm und Gliedmaßen
  wirken dadurch rund statt ausgeschnitten.
- Flach bleibt bewusst, was selbst wie Licht wirken soll: Visier,
  Kontrollleuchten, dünne Zierstreifen. Ein Verlauf darauf würde genau die
  Leuchtwirkung wieder auffressen, die sie haben sollen.
- Jede Figur bekommt zusätzlich ein bis zwei **Glanzpunkte** (`_glanz()`) —
  kleine, opake Ellipsen in einem aufgehellten Ton auf Brustplatte und Helm.
  Bewusst opak statt halbdurchsichtig: Eine helle Ellipse an der richtigen
  Stelle liest sich schon als Glanzlicht, und die Prüfung unten verlangt
  ohnehin, dass nur der Schatten durchsichtig ist.
- Die Lichtrichtung (`Figur.LICHT`) steht in **lokalen** Koordinaten der
  Figur, nicht der Welt — dreht sich die Anzeige mit der Laufrichtung, dreht
  sich der Glanz mit. Das ist kein Kompromiss: Top-Down-Actionspiele zeigen
  das durchweg so, ein weltfestes Licht müsste bei jeder Drehung neu
  gerechnet werden, ohne dass es sichtbar etwas brächte.

Kostet nichts an Bilddateien oder Bibliotheken — `draw_polygon` mit einer
Farbe je Eckpunkt ist eingebautes Godot, kein Shader.

Drei Sachen, die im Bild nicht auffallen und deshalb geprüft werden:

- **Jedes Teil ist konvex.** Ein konkaves Vieleck malt seinen Umriss quer durch
  die eigene Fläche; im Kleinen liest sich das als Kratzer, nicht als Fehler.
- **Keine Figur ist breiter als das 1,35-fache der Trefferfläche.** Größer
  aussehen als man zählt ist die verzeihende Richtung — man weicht Geschossen
  aus, die einen ohnehin verfehlt hätten. Beliebig größer wird daraus aber ein
  Spiel, das sich unehrlich anfühlt.
- **Keine Flächenfarbe verschwindet im Arenaboden.** Der Bodenwert wird für die
  Prüfung aus `arena.tscn` gelesen, nicht noch einmal hingeschrieben. Der Anlass
  ist echt: Im Phaser-Prototyp nebenan war der Anzug einmal fast so dunkel wie
  der Boden, und die Figur war schlicht weg. Deshalb ist „Schwarz/Orange" hier
  ein Anthrazit-Anzug — das Schwarz steckt in Umriss und Kleinteilen, wo es
  Kanten setzt statt Flächen.

Ansehen kann man sie ohne Editor so:

```bash
godot --headless --path . scenes/musterblatt.tscn
```

Das gibt die Vielecke als JSON aus; ein Betrachter draußen macht ein Bild
daraus. Wichtig dabei: Die Geometrie kommt aus `Gestalt` selbst. Ein
Vorschaubild, das die Formen nachbaut, zeigt irgendwann etwas anderes als das
Spiel — und dann sieht man beim Prüfen einen Fehler nicht, der da ist.

## Gegner, Wellen und Kampf

**Der Gegner ist bewusst der einfachste denkbare Verfolger.** `enemies/gegner.gd`
kennt keine Wegfindung und kein Ausweichen — er läuft in jedem Bild geradewegs
auf sein Ziel zu. Die Richtung dafür kommt aus `Bewegung.richtung_zu` (reine
Funktion, genau wie beim Spieler): eine Richtung von A nach B, auf Länge 1
gebracht. Alles, was den Gegner zu einem Gegner macht — Trefferfläche, Ebenen,
Berührung, Tod — steht in `gegner.gd` selbst; für einen so kleinen Umfang lohnt
sich keine eigene `Gestalt`/`Figur`-Trennung wie beim Spieler. Die Figur ist
zweckmäßig, nicht ambitioniert: ein achtzackiger dunkelroter Stern (Silhouette)
mit hellerem rotem Kern, eigens gewählt, um auf den ersten Blick „Gegner"
statt „Spielfigur" zu sagen — spitz und warnfarben gegen die klaren
geometrischen Formen der Charaktere.

**Berührung wird jeden Schritt neu geprüft, nicht nur beim ersten Kontakt.**
Ein `Area2D`-Kind (`Beruehrung`, Ebene der Spielfigur im Zielraster) meldet in
jedem `_physics_process`, wen der Gegner gerade berührt — nicht nur über das
einmalige `body_entered`-Signal. Ein Verfolger bleibt am Spieler kleben,
sobald er ihn erreicht hat; mit einem einmaligen Signal käme der zweite
Treffer erst, wenn beide sich kurz trennen und neu berühren. Die **bestehende**
Unverwundbarkeit in `Spieler.schaden_nehmen` bremst die Wiederholung dabei
schon von selbst ab — dafür musste an `spieler.gd` nichts geändert werden.
Geschosse treffen Gegner genau umgekehrt über dieselbe Schnittstelle: Ein
Geschoss ruft `schaden_nehmen(1)` auf jedem Körper auf, den es trifft, egal ob
das der Spieler oder ein Gegner ist — `Gegner.schaden_nehmen` hat also absichtlich
dieselbe Form wie beim Spieler.

**Tod ist ein kurzes Aufblitzen, kein lautloses Verschwinden.** Ein Treffer, der
tötet, entfernt den Gegner **sofort** aus der Gruppe `"gegner"` (darüber zählt
der Wellenleiter „noch da") und feuert `gestorben`, aber der Knoten selbst
bleibt noch `STERBE_DAUER` (180 ms) stehen, blendet aus und wächst leicht, bevor
er sich wirklich entfernt. Zählung und Anzeige sind damit bewusst getrennt: Der
Wellenleiter darf die nächste Welle vorbereiten, während der letzte Treffer
gerade noch zu sehen ist.

**Der Wellenleiter startet nicht von selbst.** Als Kind von `Main` liefe sein
eigenes `_ready()` **vor** dem von `Main` — Godot ruft `_ready()` von unten
nach oben auf, Arena und Spieler wären in dem Moment noch gar nicht gesetzt.
`main.gd` ruft deshalb `Wellenleiter.starten(...)` explizit auf, nachdem es
selbst alles andere aufgebaut hat. Wie viele Gegner eine Welle hat und wie
schnell sie laufen, steht **reingerechnet** in `wellen.gd`
(`Wellen.gegner_fuer_welle`, `Wellen.tempo_faktor_fuer_welle`, beide mit
Deckel) — der Wellenleiter selbst kennt nur die Uhr: warten, bis die Gruppe
`"gegner"` leer ist, kurze Pause, nächste Welle.

**Gegner spawnen am eingerückten Rand der Arena, nicht im Feld.**
`Wellen.punkt_am_rand(flaeche, t, rand)` ist ebenfalls reine Rechnung: `t`
läuft einmal um den ganzen Umfang, `rand` schiebt den Punkt so weit nach innen,
dass niemand halb in der Wand steckt. Der Zufall bleibt draußen — der
Wellenleiter würfelt `t`, die Funktion rechnet nur nach, und lässt sich damit
für 40 Werte auf einmal durchprüfen, ohne dass eine Szene läuft.

**Game-Over friert mit einer einzigen Zeile ein.** `get_tree().paused = true`
hält Spieler, Gegner, Geschosse und den Wellenleiter gleichzeitig an, statt
jedes System einzeln zu stoppen. Damit trotzdem noch etwas auf den Neustart
reagiert, bekommt `Main` selbst `process_mode = PROCESS_MODE_ALWAYS` — nur
diese eine Datei läuft während der Pause weiter, und ihr `_unhandled_input`
nimmt Taste, Maus oder Bildschirmberührung entgegen und lädt die Szene neu
(`reload_current_scene()`, nachdem `paused` wieder auf `false` steht). Die
Rundenende-Fläche selbst bekommt `mouse_filter = 2` (Ignorieren) — ein
`Control` blockiert Mausklicks sonst standardmäßig, bevor sie `Main` überhaupt
erreichen.

**Punkte und Welle laufen in dieselbe Bestenliste ein wie schon vorbereitet**:
Am Rundenende ruft `main.gd` `Spielstand.runde_melden(punkte, welle)` auf —
dieselbe Funktion, die vorher schon existierte, nur jetzt zum ersten Mal mit
echten Werten aus einer echten Runde gefüttert.

Ansehen kann man eine ganze Runde ohne Editor so — die Probe steuert den
Spieler selbst (er zielt auf den jeweils nächsten Gegner und schießt
durchgehend) und gibt jedes Ereignis mit Zeitstempel aus:

```bash
godot --headless --path . scenes/rundenprobe.tscn
```

## Prüfungen

```bash
godot --headless --path . scenes/pruefen.tscn
```

85 Prüfungen: die reine Rechnung in `bewegung.gd` und `wellen.gd`, die
Charakterdaten, die Umrisse aus `gestalt.gd`, der Spielstand, der Gegner für
sich allein — und eine **Rauchprobe an den echten Szenen**. Die ist bewusst
dabei: Die häufigste Art, ein Godot-Projekt kaputtzumachen, ist ein Knotenpfad,
der nicht mehr stimmt. Reine Rechnung zu prüfen fängt das nicht; ein Start mit
leerer Szene fällt sonst erst beim Spielen auf.

Die Prüfszene läuft als eigene Szene und nicht über `--script`, weil sie die
Autoloads braucht — die richtet Godot nur für eine laufende Szene ein.

## Was als Nächstes fehlt

Aufwertungen nach jeder Welle, ein Auswahlbildschirm vor dem Start,
Touch-Bedienung, Ton, weitere Gegnertypen (bisher nur der eine Verfolger).
Alles bewusst noch nicht gebaut: Erst sollte eine ganze Runde von Anfang bis
Game-Over stehen. Der Auswahlbildschirm braucht dafür nichts Neues mehr —
`Figur` lässt sich dort einfach hinstellen und über `scale` größer ziehen.
