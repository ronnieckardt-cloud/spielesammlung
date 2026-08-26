# Arena Brawler (Godot 4)

Moderner 2D-Arena-Brawler in Godot 4 mit GDScript.

> **Eigenständiges Projekt.** Es hat nichts mit der React-Spielesammlung im
> übergeordneten Verzeichnis zu tun und nichts mit dem Phaser-Prototyp in
> `arena-brawler-mini/` — kein gemeinsamer Code, keine gemeinsamen Abhängigkeiten.
> Es liegt nur im selben Repository.

Stand: **Fundament**. Arena, Spieler, Bewegung, Schießen und drei
Charaktervarianten mit eigenen Figuren stehen. Wellen, Aufwertungen, Gegner und
Oberfläche kommen später — erst soll das Fundament stabil sein.

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
│   ├── main.tscn            Hauptszene: Arena + Spieler + Kamera + Kopfzeile
│   ├── arena.tscn           Boden, Rand, Wände
│   ├── geschoss.tscn
│   ├── pruefen.tscn         Prüfszene (nicht Teil des Spiels)
│   └── musterblatt.tscn     gibt die Figuren als JSON aus (Werkzeug)
├── characters/
│   └── spieler.tscn
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
│   │   └── arena.gd
│   ├── pruefen.gd
│   └── musterblatt.gd
├── enemies/               (noch leer)
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

Alle drei sind aus demselben Baukasten gebaut — Schatten, Stiefel, Rumpf,
Rücken- und Brustplatte, Arme mit Handschuh, Schulterstücke, Waffe, Helm,
Visier —, unterscheiden sich aber in Proportion und Farbverteilung. Zweite
Überarbeitungsrunde: schärfere, asymmetrischere Silhouetten statt der
anfänglich eher rundlichen Fassung.

| | halbe Breite | Merkmal |
|---|---|---|
| Ausgewogen | 18,0 | V-Taper von der Brust zur Hüfte, klingenförmige Schulterstücke, dickerer Brust-Kontraststreifen |
| Schnell | 14,8 | schlankerer, gestreckterer Rumpf, weit vorgezogener Keil, zwei gestaffelte Streamer statt einem Schal |
| Tank | 21,2 | sechseckige Schulterplatten mit je zwei Nieten, grüner Saum verbindet Schulter und Brust |

Der Sprinter ist jetzt deutlich schmaler als vorher (15,0 → 14,8 wirkt gleich,
aber der Rumpf selbst ist um 7 % schlanker — die Differenz steckt in der
Schulterflosse, die enger am Körper liegt statt weit auszuladen), das
Bollwerk entsprechend breiter (20,5 → 21,2, knapp unter der 21,6-Grenze aus
der Trefferflächen-Prüfung unten). Der Abstand zwischen allen dreien ist
absichtlich groß: Ein Blick auf den Umriss allein soll reichen, um zu sagen,
welcher der drei gerade auf dem Feld steht — auch bei kleiner Darstellung und
aus jedem Drehwinkel, das ist der Grund für die beiden Prüfungen zu Länge und
Breite weiter unten.

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

## Prüfungen

```bash
godot --headless --path . scenes/pruefen.tscn
```

62 Prüfungen: die reine Rechnung in `bewegung.gd`, die Charakterdaten, die
Umrisse aus `gestalt.gd`, der Spielstand — und eine **Rauchprobe an den echten
Szenen**. Die ist bewusst
dabei: Die häufigste Art, ein Godot-Projekt kaputtzumachen, ist ein Knotenpfad,
der nicht mehr stimmt. Reine Rechnung zu prüfen fängt das nicht; ein Start mit
leerer Szene fällt sonst erst beim Spielen auf.

Die Prüfszene läuft als eigene Szene und nicht über `--script`, weil sie die
Autoloads braucht — die richtet Godot nur für eine laufende Szene ein.

## Was als Nächstes fehlt

Gegner, Wellen, Aufwertungen, Auswahlbildschirm, Touch-Bedienung, Ton. Alles
bewusst noch nicht gebaut: erst das stabile Fundament. Der Auswahlbildschirm
braucht dafür nichts Neues mehr — `Figur` lässt sich dort einfach hinstellen
und über `scale` größer ziehen.
