# Arena Brawler (Godot 4)

Moderner 2D-Arena-Brawler in Godot 4 mit GDScript.

> **Eigenständiges Projekt.** Es hat nichts mit der React-Spielesammlung im
> übergeordneten Verzeichnis zu tun und nichts mit dem Phaser-Prototyp in
> `arena-brawler-mini/` — kein gemeinsamer Code, keine gemeinsamen Abhängigkeiten.
> Es liegt nur im selben Repository.

Stand: **spielbare Runde mit Charakterauswahl, Auto-Ziel/Auto-Feuer, drei
Gegnertypen, Hindernissen, drei wechselnden Arena-Layouts, Aufwertungen,
Powerups, Touch-Bedienung und Ton**. Arena, Spieler, Bewegung, Schießen, drei
Charaktervarianten mit eigenen Figuren, drei Gegnertypen (Verfolger,
Panzer-Verfolger, Flink), ein Wellensystem mit steigender Typenmischung und
eine Aufwertungsauswahl nach jeder geschafften Welle stehen — man wählt vor
jeder Runde erst einen Charakter auf einem eigenen Bildschirm, spielt dann
von Anfang bis Game-Over, wird dabei stärker, und ein Neustart führt sauber
zurück zur Auswahl. Bedienbar mit Tastatur **und** Touch (virtueller Stick
+ Feuerknopf), die Oberfläche durchgehend mit Karten, Rahmen und Rückmeldung
statt flacher Textzeilen. Zehn kurze, selbst im Code erzeugte Toneffekte
(Schuss, Treffer, Tod, Schaden, Welle, Aufwertung, Game Over, Tipp, Powerup,
Schild-Bruch) lassen sich über einen Knopf auf der Charakterauswahl
abschalten — siehe „Ton" weiter unten.

**Wichtigste Änderung: Zielen und Schießen brauchen keine exakte
Ausrichtung mehr.** Auf Touch musste man sich vorher exakt zum Gegner drehen
— faktisch unspielbar mit einem Daumen auf einem kleinen Bildschirm. Jetzt
übernimmt Auto-Ziel/Auto-Feuer beides: siehe „Auto-Ziel und Auto-Feuer"
weiter unten, das war die Priorität dieser Ausbaustufe.

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
| Bewegen | WASD/Pfeiltasten **oder** virtueller Stick links unten |
| Zielen | automatisch — der nächste Gegner in Reichweite, egal wie man gerade läuft |
| Schießen | auf Touch von selbst, sobald ein Gegner in Reichweite ist (Auto-Feuer) — **oder** Leertaste/Feuerknopf gedrückt halten |
| Charakter wechseln | Tab |
| Charakter wählen (vor Rundenstart) | Karte antippen/anklicken |

Tab bleibt der schnelle Wechsel mitten in der Runde, ist aber nicht mehr der
Hauptweg — der ist jetzt die Auswahl vor dem Start, siehe unten.

**Auf Touch reicht ein einziger Finger auf dem Stick fürs ganze Spiel** —
zielen und schießen laufen von selbst mit, siehe „Auto-Ziel und Auto-Feuer"
weiter unten. Der Feuerknopf bleibt trotzdem da: gehaltene Taste/Knopf
feuern weiterhin unabhängig davon, ob gerade ein Ziel in Reichweite ist,
sobald eins auftaucht.

Touch und Tastatur laufen nebeneinander her, nicht als zwei getrennte
Betriebsarten — siehe „Touch-Steuerung" weiter unten.

## Ordner

```
arena-brawler-godot/
├── project.godot          Projekt, Autoloads, Eingaben, Kollisionsebenen
├── icon.svg
├── autoload/              global, immer da
│   ├── charaktere.gd        die drei Varianten (reine Daten)
│   ├── spielstand.gd        gewählter Charakter + Bestleistung, speichert nach user://
│   └── eingabe.gd           Touch-Stick-Richtung, Touch-Erkennung (siehe „Touch-Steuerung")
├── scenes/
│   ├── main.tscn            Hauptszene: Arena + Spieler + Wellenleiter + Kamera + Touchsteuerung + Kopfzeile + Rundenende + Charakterauswahl
│   ├── arena.tscn           Boden (mit Verlauf), Raster, Rand (außen + innen + Eckmarken), Wände
│   ├── geschoss.tscn        Schweif + Bild + Kern
│   ├── powerup.tscn         aufsammelbares Powerup (Area2D + Kreisform)
│   ├── pruefen.tscn         Prüfszene (nicht Teil des Spiels)
│   ├── musterblatt.tscn     gibt die Figuren als JSON aus (Werkzeug)
│   └── rundenprobe.tscn     spielt eine Runde mehrere Sekunden durch (Werkzeug)
├── characters/
│   └── spieler.tscn
├── enemies/
│   ├── gegner.tscn          Form + Anzeige (Formanzeige) + Beruehrung, alle drei Typen
│   └── gegner.gd
├── powerups/
│   └── powerup.gd            zeichnet, meldet Aufsammeln — kennt die eigene Wirkung nicht
├── scripts/
│   ├── gemeinsam/
│   │   ├── bewegung.gd      reine Rechnung, ohne Node und ohne Uhr — inkl. Auto-Ziel und Hindernis-Ausweichen
│   │   ├── gestalt.gd       die Vielecke der drei Charaktere, ebenso rein
│   │   ├── gegnergestalt.gd die Vielecke der drei Gegnertypen, ebenso rein
│   │   ├── formanzeige.gd   zeichnet eine Teileliste — der einzige Knoten dafür, Charaktere **und** Gegner
│   │   └── figur.gd         `Formanzeige` + Charakter-Startwert (`@export charakter_id`) für den Spieler
│   ├── spieler/
│   │   ├── spieler.gd
│   │   └── geschoss.gd
│   ├── welt/
│   │   ├── main.gd
│   │   ├── arena.gd            Boden, Rand, **und die Hindernis-Blöcke einer Karte**
│   │   ├── wellen.gd           Steigerung über die Wellen + Typenmischung, reine Rechnung
│   │   ├── wellenleiter.gd     spawnt Gegner **und Powerups**, meldet geschaffte Wellen, wechselt Karten
│   │   ├── gegnertypen.gd      die drei Gegnertypen (reine Daten), das Gegenstück zu `charaktere.gd`
│   │   ├── aufwertungen.gd     die fünf Aufwertungskarten, reine Rechnung
│   │   ├── karten.gd           die drei Arena-Layouts (reine Daten) + Erreichbarkeits-Beweis
│   │   ├── powerups.gd         die drei Powerup-Arten (reine Daten), das Gegenstück zu `aufwertungen.gd`
│   │   └── rundenende.gd       Neustart-Erkennung, siehe „Pause" unten
│   ├── pruefen.gd
│   ├── musterblatt.gd
│   └── rundenprobe.gd
├── ui/
│   ├── aufwertungsauswahl.gd   die drei Karten nach einer Welle
│   ├── charakterauswahl.gd     die drei Karten vor dem Rundenstart
│   ├── auswahl_atmo.gd         Hintergrund-Atmosphäre der Charakterauswahl (Verlauf, Lichtkegel, Raster, Vignette)
│   ├── karten_glanz.gd         die „Lichtkante" jeder Charakterkarte (Streifen + Eckwinkel)
│   ├── touchsteuerung.gd       Container für Stick + Feuerknopf, Sichtbarkeit nach Touch/Pause
│   ├── stick.gd                der virtuelle Bewegungs-Stick
│   └── feuerknopf.gd           der Touch-Feuerknopf
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

**Alle Gegnertypen laufen gleich — nur Tempo, Leben, Trefferfläche und
Aussehen unterscheiden sich.** `enemies/gegner.gd` kennt keine Wegfindung und
kein Ausweichen — jeder Typ läuft in jedem Bild geradewegs auf sein Ziel zu.
Die Richtung dafür kommt aus `Bewegung.richtung_zu` (reine Funktion, genau wie
beim Spieler): eine Richtung von A nach B, auf Länge 1 gebracht. Was einen
Gegner zu einem Gegner macht — Trefferfläche, Ebenen, Berührung, Tod — steht
in `gegner.gd` selbst.

**Drei Gegnertypen, dieselbe Trennung wie bei den Charakteren.**
`gegnertypen.gd` (reine Daten, das Gegenstück zu `charaktere.gd`) und
`gegnergestalt.gd` (reine Geometrie, das Gegenstück zu `gestalt.gd`) liefern
Werte und Umriss; `Gegner.einrichten(art, tempo_faktor)` wendet beides an.
Gezeichnet wird über **denselben** Knoten wie beim Spieler
(`Formanzeige.zeigen_teile(...)`, siehe „Wie die Figuren aufgebaut sind" oben)
— keine zweite Zeichenlogik, nur eine zweite Geometrie-Quelle:

| Typ | Leben | Tempo | Trefferfläche | ab Welle | Silhouette |
|---|---|---|---|---|---|
| Verfolger | 1 | 95 | 12 | 1 | Stern, acht Zacken (unverändert) |
| Panzer-Verfolger | 3 | 72 | 17 | 4 | breites, kaum verjüngtes Achteck mit Seitenplatten |
| Flink | 1 | 112 | 9 | 7 | schlank, länger als breit, zwei Widerhaken am Bug |

Deckt man alle drei komplett schwarz ab, muss man sie trotzdem
auseinanderhalten — dieselbe Anforderung wie bei den Charakteren, siehe „Wie
die Figuren aufgebaut sind". Farblich bleiben alle drei in der
Rot-/Orange-Familie (klar „Gegner", nie mit einem Charakter zu verwechseln),
aber deutlich unterscheidbar: der Verfolger dunkelrot, der Panzer rostorange,
der Flinke ein schärferes, helleres Rot-Orange. Ein Test prüft für jede
Gegnerfarbe einen deutlich höheren Mindestabstand zum Arenaboden als bei den
Charakteren — „hoher Kontrast" war für Gegner ausdrücklich gefordert, nicht
nur „verschwindet nicht".

**Der Panzer-Verfolger ist der eigentliche Anlass: Vorher hatte „Stärkere
Kugeln" nie eine sichtbare Wirkung.** Der einzige Gegnertyp hielt genau einen
Treffer aus — jeder Schaden, ob 1 oder 6, tötete beim ersten Schuss, die Karte
war also rein kosmetisch wählbar. Gegen die 3 Leben des Panzers sieht man den
Unterschied jetzt direkt in den nötigen Treffern: ohne die Karte drei
Schüsse, mit zwei Stapeln nur noch einer. Ein Test rechnet genau das nach.

**Die Mischung kommt aus einem gewichteten Lostopf, reine Rechnung in
`wellen.gd`.** `Wellen.gegnertyp_gewichte_fuer_welle(welle)` sagt, welche
Typen ab welcher Welle mit welchem Gewicht im Topf liegen (Panzer ab Welle 4,
Flink ab Welle 7, der Verfolger bleibt immer dabei — sonst wäre es ab einer
Welle ein Austauschen statt eines Steigerns). `Wellen.gegnertyp_auswaehlen(gewichte,
t)` zieht daraus, würfelt aber selbst nicht: `t` kommt vom Aufrufer
(`Wellenleiter`, mit echtem `randf()`), die Funktion rechnet nur nach — genau
dieselbe Aufteilung wie bei `punkt_am_rand`, und aus demselben Grund: So
lässt sich die Verteilung für feste `t`-Werte durchprüfen, ohne echten Zufall
im Test zu brauchen.

**Balance: Der langsamste Charakter muss dem schnellsten Gegner immer noch
entkommen können.** Bei maximaler Wellensteigerung (`Wellen.MAX_TEMPO_FAKTOR`)
kommt der schnellste Typ (Flink) auf 112 × 1,6 ≈ 179 — der Tank, der
langsamste Charakter, läuft mit 215 immer noch klar davon. Ein Test sichert
genau diesen Abstand ab, nicht nur für den aktuellen Flink-Wert, sondern als
Invariante: Würde ein künftiger Gegnertyp diesen Rand unterschreiten, schlägt
die Prüfung an, bevor eine Welle unspielbar wird.

**Eine Ressourcen-Falle, die zwei gleichzeitige Gegnertypen erst zeigen.**
`preload("res://enemies/gegner.tscn")` teilt sich standardmäßig **eine**
`CircleShape2D`-Ressource über alle Instanzen — `_form.shape.radius = art.radius`
in `einrichten()` hätte ohne Gegenmaßnahme also die Trefferfläche **aller**
gleichzeitig existierenden Gegner geändert, nicht nur die des gerade
eingerichteten. Behoben mit `resource_local_to_scene = true` an beiden
`CircleShape2D`-Sub-Ressourcen in `gegner.tscn`: Jede Instanz bekommt dadurch
ihre eigene Kopie. Der Fehler wäre im Spiel erst ab der Panzer-Welle
aufgefallen, wenn wirklich zwei Typen gleichzeitig unterwegs sind — ein
eigener Test spawnt deshalb zwei Gegner verschiedenen Typs nebeneinander und
prüft, dass ihre Trefferflächen getrennt bleiben.

**Treffer und Tod sind nicht mehr dieselbe Anzeige.** Ein Treffer, der nicht
tötet, blitzt kurz hell auf (`_aufblitzen()`, ~90 ms) — ohne diese Rückmeldung
sah ein Schuss auf den 3-Leben-Panzer aus, als hätte er gar nicht getroffen.
Ein tödlicher Treffer bekommt einen eigenen, deutlicheren Ablauf: erst ein
kurzer, hellerer Blitz, dann Ausblenden und Wachsen gleichzeitig (mit
Kubik-Ease statt linear) — dieselbe Grundidee wie vorher, nur klarer vom
bloßen Ankratzen unterscheidbar.

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

**Zählung und Anzeige sind bewusst getrennt.** Ein tödlicher Treffer entfernt
den Gegner **sofort** aus der Gruppe `"gegner"` (darüber zählt der
Wellenleiter „noch da") und feuert `gestorben`, aber der Knoten selbst bleibt
noch `STERBE_BLITZ_DAUER + STERBE_DAUER` (rund 270 ms) stehen und spielt seine
Sterbe-Animation ab, siehe oben. Der Wellenleiter darf die nächste Welle
vorbereiten, während der letzte Treffer gerade noch zu sehen ist.

**Der Wellenleiter startet nicht von selbst.** Als Kind von `Main` liefe sein
eigenes `_ready()` **vor** dem von `Main` — Godot ruft `_ready()` von unten
nach oben auf, Arena und Spieler wären in dem Moment noch gar nicht gesetzt.
`main.gd` ruft deshalb `Wellenleiter.starten(...)` explizit auf, nachdem es
selbst alles andere aufgebaut hat. Wie viele Gegner eine Welle hat und wie
schnell sie laufen, steht **reingerechnet** in `wellen.gd`
(`Wellen.gegner_fuer_welle`, `Wellen.tempo_faktor_fuer_welle`, beide mit
Deckel) — der Wellenleiter selbst kennt nur die Uhr: warten, bis die Gruppe
`"gegner"` leer ist, dann `welle_geschafft` melden.

**Gegner spawnen am eingerückten Rand der Arena, nicht im Feld.**
`Wellen.punkt_am_rand(flaeche, t, rand)` ist ebenfalls reine Rechnung: `t`
läuft einmal um den ganzen Umfang, `rand` schiebt den Punkt so weit nach innen,
dass niemand halb in der Wand steckt. Der Zufall bleibt draußen — der
Wellenleiter würfelt `t`, die Funktion rechnet nur nach, und lässt sich damit
für 40 Werte auf einmal durchprüfen, ohne dass eine Szene läuft.

**Punkte und Welle laufen in dieselbe Bestenliste ein wie schon vorbereitet**:
Am Rundenende ruft `main.gd` `Spielstand.runde_melden(punkte, welle)` auf —
dieselbe Funktion, die vorher schon existierte, nur jetzt zum ersten Mal mit
echten Werten aus einer echten Runde gefüttert.

## Auto-Ziel und Auto-Feuer

**Die eigentliche Priorität dieser Ausbaustufe.** Vorher musste man sich mit
dem Stick exakt zum Gegner drehen und selbst treffen — auf einem Touchscreen
mit einem Daumen praktisch unspielbar, weil derselbe Finger gleichzeitig
laufen **und** zielen sollte. Jetzt übernehmen Blickrichtung **und** Schuss
das automatisch, unabhängig von der Laufrichtung.

**Zwei bereits fertige, reine Funktionen mussten dafür nicht angefasst
werden.** `Bewegung.naechstes_ziel(von, ziele, reichweite)` (das nächste Ziel
innerhalb der Reichweite, oder `null`) und `Bewegung.richtung_zu(von, ziel)`
gab es schon — nur `spieler.gd` wusste bisher nichts von ihnen. Genau diese
Trennung (siehe „Trennung von Logik und Darstellung" oben) zahlt sich hier
aus: Das eigentliche Auto-Ziel ist reine Wiederverdrahtung, keine neue
Rechnung, und war deshalb schon vorher an einer einzigen Stelle geprüft.

**`Spieler._physics_process` bestimmt das Ziel jedes Bild neu**, aus den
Positionen aller lebenden Gegner (`_gegnerpositionen()`, über die Gruppe
`"gegner"`) und der eigenen `effektive_reichweite()`. Gibt es eins, dreht
sich die Anzeige (`_anzeige.rotation`, sanft über `lerp_angle`) darauf —
**nicht** die Kollisionsform, dieselbe Trennung wie beim ursprünglichen
Aufbau (siehe „Trennung von Logik und Darstellung"). Gibt es keins, folgt die
Anzeige stattdessen weiter der Laufrichtung wie bisher, damit sie beim
Loslaufen nicht in einer alten Blickrichtung einfriert.

**Auto-Feuer ist neu, „gedrückt halten" bleibt.** `_schiessen(ziel)` feuert
jetzt, sobald `ziel != null` ist **und** entweder die `"schiessen"`-Aktion
gehalten wird (Taste oder Feuerknopf, unverändert) **oder**
`Eingabe.touch_verfuegbar` wahr ist — auf einem Gerät mit erkanntem
Touchscreen genügt also ein einziger Finger auf dem Stick, ganz ohne den
Feuerknopf zu berühren. Auf Tastatur bleibt es bewusst bei „Leertaste
halten": Wer am Rechner testet, hat ohnehin beide Hände frei, und ein
Dauerfeuer ganz ohne jede Eingabe wäre dort überraschend.

**Kein Schuss mehr ins Leere.** `_schiessen(ziel: Variant)` nimmt jetzt das
Ziel selbst entgegen statt einer Richtung und bricht sofort ab, wenn
`ziel == null` — vorher feuerte ein gehaltener Feuerknopf ohne Gegner in der
Nähe einfach in die zuletzt gelaufene Richtung.

**Die Pause blockiert Auto-Feuer weiterhin, ohne dass dafür eine einzige
Zeile nötig war.** `Spieler` hängt als direktes Kind von `Main` im Baum,
`Main` selbst bekommt bewusst kein `PROCESS_MODE_ALWAYS` (siehe „Wie die
Pause wirklich funktioniert" unten) — der Spieler erbt also ganz regulär
`PROCESS_MODE_INHERIT` und friert mit dem Rest der Runde ein, sobald
`get_tree().paused = true` steht. Ein eigener Test sichert das jetzt explizit
ab (`spieler.process_mode == Node.PROCESS_MODE_INHERIT`), statt sich nur auf
die bestehende Architektur zu verlassen.

## Hindernisse

Feste, rechteckige Blöcke innerhalb der Arena — Kollision für Spieler und
Gegner, eine klare Regel für Geschosse, reine Geometrie für Spawn-Sicherheit.

**Die Regel für Geschosse: blockiert, nicht zerstörbar.** Ein Hindernis
selbst lässt sich durch nichts wegschießen — die Arena-Layouts sind feste,
von Hand entworfene Rätsel (siehe „Karten" unten), ein zerstörbares
Hindernis würde die Karte während der Runde verändern. Ein Geschoss, das ein
Hindernis trifft, verschwindet dort einfach (`Geschoss._on_body_entered`
läuft unverändert, nur meldet ein Hindernis kein `schaden_nehmen` — der
Schuss endet trotzdem an Ort und Stelle, statt hindurchzufliegen).

**Eine eigene Kollisionsebene statt der Wiederverwendung von „welt".**
`project.godot` bekam `2d_physics/layer_5="hindernis"` dazu. Der Grund:
Geschosse ignorieren bislang den äußeren Arenarand (Ebene „welt") komplett —
ihre Reichweite begrenzt sie schon selbst, ein zweiter Mechanismus wäre
doppelt gemoppelt. Läge ein Hindernis auf derselben Ebene, würde genau dieses
bestehende Verhalten unbeabsichtigt mitgeändert. Mit einer eigenen Ebene
bleibt der Rand wie er war, und nur Hindernisse blockieren zusätzlich:
`Geschoss.collision_mask` wurde von `4` (Gegner) auf `4 | 16` erweitert,
`Spieler`/`Gegner` von `1` auf `1 | 16` (Welt **und** Hindernis).

**Optik ohne Bilddatei, dieselbe Handschrift wie der Rest der Arena.**
`arena.gd` zeichnet zu jedem Rechteck einen Schatten (dunkle, versetzte
Kopie), eine Fläche mit demselben Licht-oben-links-Verlauf wie der
Arenaboden (`vertex_colors`, nur kräftiger — ein kleiner Block braucht mehr
Kontrast als die große Bodenfläche) und eine helle Umriss-Kante — dieselbe
Reihenfolge (Schatten zuerst) wie überall sonst im Projekt.

**Gegner laufen jetzt um Hindernisse herum, nicht stur hindurch.** Ein
echter, in der simulierten Runde (`scenes/rundenprobe.tscn`) gefundener
Fehler, kein vorausschauendes Design: Ein Verfolger, der stur
`Bewegung.richtung_zu(von, ziel)` nimmt, bleibt an einer flachen
Hindernis-Wand **mittig stecken**, sobald sein Ziel exakt auf der anderen
Seite steht — Anziehung zum Ziel und die Kollision mit der Wand heben sich
an genau dieser Stelle auf, `move_and_slide()` gleitet dann bestenfalls
ziellos am Rand entlang. Nach Einführung der Kreuz-Karte blieben mehrere
Gegner zwanzig simulierte Sekunden lang ohne einen einzigen weiteren Treffer
stehen — derselbe Fehlertyp wie ein Bot, der für immer an einem
Steigungswinkel hängen bleibt (siehe Flow MTB in `CLAUDE.md`): Erst die
simulierte Probe deckt ihn auf, nicht das bloße Ansehen im Editor.

`Bewegung.richtung_um_hindernisse(von, ziel, hindernisse, einfluss, rand)`
behebt das — keine Wegfindung, nur genug, um an einer einzelnen, konvexen
Wand nicht steckenzubleiben: Für jedes Hindernis näher als `einfluss` kommt
eine Fluchtrichtung vom nächsten Randpunkt weg dazu, gewichtet danach, wie
nah. **Reine Flucht allein reicht dabei nicht** — steht man exakt auf der
Senkrechten zur Wandmitte, zeigt die Fluchtrichtung exakt entgegengesetzt zur
Zielrichtung, beide heben sich beim Addieren zu einem kürzeren Vektor
**derselben** Richtung auf, keine seitliche Ablenkung entsteht, und der
ursprüngliche Fehler wäre nur eine Formel weiter verschoben. Eine feste
**Tangente** (die Fluchtrichtung um 90° gedreht) bricht die Symmetrie
zuverlässig in eine Richtung. Gegner (`gegner.gd`) und Spieler (die simulierte
Probe, siehe unten) benutzen dieselbe Funktion — der Spieler selbst braucht
sie im echten Spiel nicht, er wird ja von der Berührung geführt, nicht vom
Code.

**Ein Hindernis, das genau dort erscheint, wo jemand steht, schiebt ihn
sanft heraus.** Beim Kartenwechsel (siehe unten) ist die Position des
Spielers „eingefroren" von der vorherigen Karte — steht er zufällig genau an
einer Stelle, an der jetzt ein neues Hindernis liegt, holt
`Bewegung.aus_hindernissen_geschoben(punkt, hindernisse, rand)` ihn an den
nächsten freien Rand zurück. Dieselbe Funktion platziert auch
zeitgesteuerte Powerups nie halb in einer Wand (siehe „Powerups" unten).

## Karten

Drei Arena-Layouts, reine Daten in `scripts/welt/karten.gd`
(`Karten.Karte`: `id`, `name`, `hindernisse: Array[Rect2]`) — testbar, ohne
dass eine Szene läuft:

| Id | Name | Hindernisse |
|---|---|---|
| `offen` | Offen | keine — die bisherige, unveränderte Arena |
| `kreuz` | Kreuz | vier Balken um die Mitte, mit echter Lücke an jeder Ecke |
| `gasse` | Gasse | zwei lange Blöcke links/rechts, breiter Durchgang dazwischen |

**Kein durchgehendes Kreuz.** Ein geschlossenes Plus schottete vier Viertel
komplett gegeneinander ab — das hier ist ein Hindernis, um das man laufen
kann, kein Labyrinth. Die Lücke zwischen zwei Armen ist keine
Geschmacksfrage: Die erste Fassung (`luecke=70`, `dicke=56`) ließ an jedem
der vier „Ellbogen" nur rund 4 Pixel Luft — deutlich weniger, als ein Körper
braucht (siehe „Beweist die Erreichbarkeit" unten, das hat genau das
gefunden, nicht das Auge). Jetzt `luecke=95`, `dicke=40`, rund 37 Pixel
Ellbogen-Luft.

**Wechsel automatisch alle drei Wellen** (`Karten.WECHSEL_ALLE_WELLEN`),
nicht über einen Auswahlbildschirm vor der Runde. Bewusste Entscheidung,
nicht die einzige denkbare: Ein dritter Bildschirm vor jeder Runde (nach der
Charakterauswahl) wäre ein zusätzlicher Tipp und eine zusätzliche
Entscheidung — ausgerechnet auf dem einen Zielgerät dieses Projekts, wo
jeder Tipp zählt. Der automatische Wechsel reiht sich stattdessen genau in
die Steigerung ein, die die Wellen ohnehin schon automatisch mitbringen
(`Wellen.gegner_fuer_welle` und Geschwister) — Abwechslung **innerhalb**
einer Runde, keine zweite, eigene Bedienebene. `Karten.fuer_welle(welle)` ist
reine Rechnung: Dieselbe Wellenzahl ergibt überall dieselbe Karte, ganz ohne
Zufall oder Absprache.

**Der Wechsel meldet sich nur, wenn er wirklich passiert.**
`Wellenleiter.karte_gewechselt(karte)` feuert ausschließlich beim
tatsächlichen Wechsel auf eine **andere** Karte, nicht bei jeder Welle —
`main.gd._karte_gewechselt()` reicht die neuen Hindernisse an `Arena` weiter
und schiebt den Spieler heraus, falls nötig (siehe „Hindernisse" oben).
Gegner brauchen dieselbe Behandlung nicht: Eine neue Welle spawnt erst,
nachdem alle Gegner der vorherigen tot sind, es gibt also nie einen
lebenden Gegner, der von einem Kartenwechsel überrascht werden könnte.

**Beweist die Erreichbarkeit, statt sie nur anzunehmen.**
`Karten.ist_voll_erreichbar(karte, rand, raster)` flutet ein grobes
Rasterfeld von einer garantiert freien Ecke aus (dieselbe Grundidee wie der
Flutfüllungs-Test in Ghost Chase, nur auf Rechtecken statt einem
Text-Labyrinth) und prüft, dass **jedes** unblockierte Feld erreicht wird —
kein Hindernis darf eine Ecke so abschotten, dass ein Gegner (der nur um
Rechtecke herumgleitet, nicht sucht) den Spieler nicht erreichen kann. `rand`
weitet jedes Hindernis dabei um den größten vorkommenden Körperradius auf,
sonst gälte ein Spalt als begehbar, durch den in Wirklichkeit niemand passt
— genau der Maßstab, an dem die erste Kreuz-Fassung oben gescheitert ist.

**Sicherheitsabstand zum Rand.** `Karten.RAND_SICHERHEITSABSTAND` (90 Pixel)
hält jedes Hindernis vom Arenarand fern — deutlich mehr als
`Wellenleiter.SPAWN_ABSTAND` (24) selbst, weil ein Gegner kein Punkt ist,
sondern einen eigenen Radius mitbringt (bis 17 beim Panzer-Verfolger), der
am Spawnpunkt noch hineinpassen muss.

## Aufwertungen

Nach jeder geschafften Welle: kurze Meldung, dann genau drei Karten, dann
weiter — Spieler, Gegner und Geschosse stehen währenddessen **vollständig**
still.

**Fünf Arten, reingerechnet in `aufwertungen.gd`** (`Aufwertungen.alle_arten()`):
+1 Leben (Deckel 8), schnellere Schüsse, mehr Tempo, stärkere Kugeln, größere
Reichweite. Vier davon stapeln als Faktor **je Stapel**, nicht insgesamt —
fünf Stapel Feuerrate multiplizieren die Schusspause fünfmal mit 0,88, nicht
einmal mit 0,12. Jede weitere Stufe bringt spürbar etwas, aber mit sinkendem
Grenznutzen statt eines plötzlichen Sprungs am Ende. Leben ist der
Sonderfall: Es läuft nicht über einen Stapelzähler, seine Grenze hängt am
**aktuellen** Leben — eine volle Anzeige bietet die Karte nicht mehr an, ganz
gleich wie oft sie vorher schon gewählt wurde.

**Nie eine Karte, die nichts mehr bewirken würde.**
`Aufwertungen.verfuegbare_arten(stapel, aktuelles_leben)` lässt jede
ausgereizte Art aus dem Angebot fallen; `Aufwertungsauswahl.zeigen()` mischt
diese Liste und zeigt bis zu drei — sind schon fast alle Arten ausgereizt,
erscheinen entsprechend weniger, nie eine doppelt und nie eine wirkungslose.

**Die Wirkung sitzt an *effektiven* Werten auf dem Spieler, nicht an
`variante` selbst.** `Charaktere.Variante`-Objekte sind über alle Runden
und Charaktere hinweg geteilt (`Charaktere.liste`) — sie zu verändern würde
jede künftige Runde mit demselben Charakter verfälschen, auch nach einem
Neustart. `Spieler` hält deshalb einen eigenen `_aufwertungen`-Zähler je
stapelbarer Art und rechnet `effektives_tempo()`, `effektive_schuss_pause()`,
`effektive_reichweite()`, `effektiver_schaden()` bei jedem Aufruf frisch aus
`variante` **plus** diesem Zähler — `_physics_process` und `_schiessen`
benutzen ausschließlich diese vier, nirgends mehr `variante.tempo` direkt.
Leben wirkt dagegen sofort und direkt auf `spieler.leben`.

**Zurücksetzen kostet keine einzige Zeile Code.** `reload_current_scene()`
baut den Spieler komplett neu auf — sein `_aufwertungen`-Zähler startet damit
automatisch wieder leer, genau wie `Wellenleiter.welle`/`.punkte` das schon
vorher taten. Es gibt keinen zweiten Ort, an dem der alte Stand stehen
bliebe.

**Geschoss reicht seinen Schaden weiter, statt fest 1 zu nehmen** — die ganze
Verbindung zur „Stärkere Kugeln"-Karte. `Spieler._schiessen` übergibt
`effektiver_schaden()` an `Geschoss.starten(...)`, das Geschoss ruft
`schaden_nehmen(_schaden)` auf allem, was es trifft. *Ehrlich gesagt hat das
gegen den einzigen bestehenden Gegnertyp noch keine sichtbare Wirkung* — der
Verfolger hat genau 1 Leben und stirbt auch an einem einzigen Grundschuss.
Die Karte ist korrekt verdrahtet und geprüft (siehe unten), wartet aber auf
einen zäheren Gegner, um wirklich etwas zu bringen. Bewusst nicht als Bug
verschwiegen, sondern hier festgehalten.

### Wie die Pause wirklich funktioniert — und wie sie beim ersten Versuch nicht funktioniert hätte

**`Main` selbst bekommt kein `PROCESS_MODE_ALWAYS`.** Der naheliegende erste
Ansatz — Main auf ALWAYS setzen, damit während `get_tree().paused = true`
noch etwas auf Eingaben reagiert — wurde gebaut, empirisch geprüft und
verworfen: Ein `process_mode` mit dem Wert `INHERIT` (der Standard für jeden
neuen Knoten) reicht bis zum **nächsten Vorfahren mit einem gesetzten Wert**
durch. Wäre `Main` ALWAYS, erbten **alle** seine Kinder das mit — Spieler,
Gegner, Geschosse eingeschlossen, weil die alle als direkte Kinder von `Main`
im Baum hängen. Mit einer eigens dafür gebauten Testszene nachgemessen:
Ein Knoten mit `ALWAYS` und ein Enkelkind mit dem Standardwert `INHERIT`
zählten während einer Pause exakt gleich oft ihren eigenen `_process()` —
das Enkelkind lief ungebremst mit.

Die Lösung liegt eine Ebene höher als das Problem: `Oberflaeche`
(`CanvasLayer`, Geschwisterknoten von `Arena`/`Spieler`/`Wellenleiter`, nicht
deren Vorfahre) bekommt `process_mode = ALWAYS`. Ihre Kinder sind
ausschließlich Anzeige-Flächen (Kopfzeile, Wellenmeldung, Rundenende,
Aufwertungsauswahl) — keine einzige Spielfigur hängt dort, das Erben ist
also folgenlos. Zwei Stellen brauchten deshalb ein eigenes kleines Skript,
das vorher in `main.gd` steckte:

- **`rundenende.gd`** erkennt Antippen/Klicken/Tastendruck nur noch selbst
  (`_unhandled_input`) und meldet es über ein Signal
  (`neustart_angefordert`) — `main.gd` selbst braucht dafür kein `ALWAYS`
  mehr.
- **`aufwertungsauswahl.gd`** liegt ebenfalls unter `Oberflaeche` und kann
  darum während der Pause echte `Button.pressed`-Signale entgegennehmen.

`main.gd` selbst braucht trotzdem **kein** `ALWAYS`, obwohl es
`get_tree().paused = true` setzt und danach noch `await`et: Ein
`SceneTreeTimer` (`get_tree().create_timer(...)`) läuft standardmäßig auch
während der Pause weiter (`process_always` ist dort `true`), und ein
`await` auf ein Signal wird von der **Signalquelle** wachgerufen, nicht vom
`process_mode` des wartenden Knotens. Auch das wurde an derselben Testszene
nachgemessen, bevor es in den echten Code kam.

## Powerups

Drei aufsammelbare Arten, reine Daten in `scripts/welt/powerups.gd`
(`Powerups`, das Gegenstück zu `aufwertungen.gd`) — zeitlich begrenzt,
selten, mit klaren Stapel-Regeln:

| Art | Wirkung | Dauer | Stapel-Regel |
|---|---|---|---|
| Schild | fängt genau einen Treffer ab, kein Lebensverlust | bis zum nächsten abgefangenen Treffer | ein zweites Schild während der Wirkung ändert nichts — es bleibt bei „aktiv" |
| Tempo-Boost | Tempo × 1,35 | 5 s | ein zweites Einsammeln **erneuert** die Uhr auf die volle Dauer, verlängert nicht zusätzlich |
| Schnellfeuer | Schusspause × 0,55 | 5 s | dieselbe „erneuert, nicht addiert"-Regel wie Tempo |

Genau die vom Auftrag verlangte klare Regel: nie unbegrenzt länger, egal wie
oft man nachsammelt.

**Selten, an zwei Quellen, nie mehr als eins gleichzeitig.** Ein sterbender
Gegner lässt mit geringer Wahrscheinlichkeit eins fallen
(`Powerups.DROP_CHANCE = 0.09`, „nicht spam" ist eine ausdrückliche Vorgabe
der Aufgabe) — genau an der Todesstelle, damit sich das Finden als Belohnung
für den Treffer liest, nicht als beliebiger Fund irgendwo im Feld. Fällt
lange keins, sorgt ein zeitgesteuerter Nachschub dafür, dass nie ewig nichts
auf dem Feld liegt (`Powerups.ZEITGESTEUERT_ALLE_SEKUNDEN = 22`). Beide
Quellen prüfen zuerst, ob schon eins da ist (`get_tree().get_nodes_in_group(
&"powerup")`) — es liegt also nie mehr als eins gleichzeitig auf dem Feld.

**Aufsammeln per Berührung, wie überall sonst im Projekt.** `Powerup` ist ein
`Area2D` (`collision_mask = 2`, nur die Spieler-Ebene), `_on_body_entered`
ruft `koerper.powerup_einsammeln(art_id)` auf — dieselbe Trennung wie bei
den Aufwertungskarten: Ein Powerup kennt seine eigene Wirkung nicht, die
steht in `Powerups` und wird von `Spieler.powerup_einsammeln()` angewendet.

**Eigene Silhouette und Farbe je Art, keine Bilddatei.** Ein Fünfeck mit
gerundeter Spitze für den Schild, ein Chevron für Tempo, drei kleine Pfeile
für Schnellfeuer — jeweils in `Powerup._draw()` gezeichnet, mit einem
Bodenring in derselben Farbe darunter (dieselbe „Bodenring"-Idee wie bei Dash
Citys Schüben in der React-Sammlung: Die Farbe taucht am Ring **und** in der
Form wieder auf). Ein aktiver Schild erscheint zusätzlich als heller Ring um
die Trefferfläche des Spielers (`Spieler._draw`, dieselbe Farbe) — „das habe
ich eingesammelt" und „das wirkt gerade" gehören damit sichtbar zusammen,
ganz ohne Text.

**Die kurze HUD-Meldung läuft ohne Pause, anders als „Welle geschafft".**
Ein Powerup wird mitten im Kampf eingesammelt, das Spiel darf dafür nicht
anhalten — `main.gd._powerup_eingesammelt()` blendet für 1,1 Sekunden einen
Text wie „Schild!" ein und wieder aus, ohne `get_tree().paused` anzurühren.

### Eine Lehre aus der simulierten Runde: neue Flächen mitten in einer Physik-Abfrage

Die simulierte Runde (`rundenprobe.tscn`) meldete nach dem Einbau der
Powerups gelegentlich `ERROR: Can't change this state while flushing
queries.` — nicht reproduzierbar in den synchronen Kopflos-Prüfungen (die
lassen nie einen echten Bildschritt laufen), nicht spielzerstörend
(`exit=0`, die Runde lief weiter), aber ein echter, unerklärter Fehler, den
dieses Projekt nicht kommentarlos stehen lässt.

Die naheliegende erste Vermutung — `Powerup`s eigenes Schweben bewegt
`global_position` und rührt damit die beim Physikserver registrierte
Fläche an — war nur ein Teil der Wahrheit: Das Schweben lebt seither
komplett in `_draw()`/`draw_set_transform()`, eine reine Zeichenoperation
ohne jede Wirkung auf die Kollisionsform. Der Fehler blieb trotzdem.

Zweiter Verdacht: Ein `Powerup`/`Geschoss`, das sich mitten in der eigenen
`body_entered`-Abfrage per `queue_free()` selbst entfernt, stört die noch
laufende Kollisionsabfrage. Beide Stellen (`Powerup._on_body_entered`,
`Geschoss._on_body_entered`, dazu `Geschoss`s zweiter `queue_free()`-Aufruf
beim Erreichen der Reichweite) bekamen `call_deferred(&"queue_free")` statt
eines direkten Aufrufs. Auch das senkte die Häufigkeit, behob den Fehler
aber nicht vollständig.

**Der eigentliche Auslöser lag beim Neu-Anlegen, nicht beim Entfernen.**
`Wellenleiter._gegner_gestorben()` — verbunden mit `Gegner.gestorben`, das
`Gegner._sterben()` synchron auslöst, aufgerufen aus `schaden_nehmen()`,
aufgerufen aus `Geschoss._on_body_entered()` — legte mit `DROP_CHANCE` eine
komplett **neue** `Powerup`-Instanz per `add_child()` an, mitten in genau
derselben Physik-Signal-Kette. Ein brandneues, überwachendes `Area2D` synchron
in den Baum zu hängen, während der Physikserver noch Kollisionen für den
aktuellen Schritt abarbeitet, meldet dieselbe Fehlermeldung wie ein
synchrones `queue_free()` — nur beim **Hinzufügen** statt beim Entfernen
einer überwachenden Fläche. `_powerup_erzeugen()` schiebt das Anlegen jetzt
über `call_deferred(&"_powerup_erzeugen_jetzt", position)` hinter das Ende
der Abfrage, genau wie die drei `queue_free()`-Stellen zuvor.

*Merksatz:* Bei einem überwachenden `Area2D` ist nicht nur das **Entfernen**
mitten in einer Physik-Abfrage gefährlich, sondern genauso das **Anlegen** —
beides ändert den Satz der beim Physikserver registrierten Flächen, während
er gerade selbst mit ihnen rechnet. Betroffen ist dabei nicht nur die Stelle,
die den Fehler auslöst (`add_child`/`queue_free` selbst), sondern jeder Punkt
in der Aufrufkette davor, der noch innerhalb desselben Physik-Signals läuft
— hier vier Stellen in drei verschiedenen Dateien für ein und denselben
Fehler.

## Charakterauswahl

Vor der ersten Welle steht jetzt ein eigener Bildschirm: drei große Karten,
Ausgewogen/Schnell/Tank, jede mit der echten Figur, Name und Kurzwerten
(Leben, Tempo, Schusspause). Antippen setzt den Charakter im `Spielstand` und
startet erst dann die Runde — vorher läuft keine Welle, kein Gegner, kein
Schuss.

**Keine zweite Zeichenlogik.** Jede Karte trägt denselben `Figur`-Knoten wie
am Spieler, nur mit `scale = Vector2(4, 4)` größer gezogen — genau der Zweck,
für den `figur.gd` von Anfang an vorgesehen war („kann später auf dem
Auswahlbildschirm stehen — dort mit `scale`, sonst nichts anders", siehe
oben). `charakterauswahl.gd` ruft beim Start explizit `Figur.zeigen(variante)`
für jede Karte mit der passenden Variante aus `Charaktere.liste` auf — nicht
nur die im Editor gesetzte `charakter_id` der Karten-Kinder, damit Figur und
Kurzwerte-Text garantiert aus derselben Quelle stammen und nie
auseinanderlaufen können.

**Dieselbe Pause-Architektur wie bei den Aufwertungskarten**, siehe den
Abschnitt oben: `Charakterauswahl` liegt als weiteres Kind unter
`Oberflaeche` (`ALWAYS`), nicht unter `Main` — sonst liefen Spieler, Gegner
und Geschosse während der Auswahl einfach weiter mit. `main.gd` setzt
`get_tree().paused = true`, bevor die Auswahl erscheint, und erst
`_charakter_gewaehlt()` (ausgelöst durch das `gewaehlt`-Signal der Karte)
hebt die Pause wieder auf und ruft `Wellenleiter.starten(...)` — vorher tut
das niemand mehr in `_ready()`.

**Neustart führt automatisch zurück zur Auswahl, ohne eine einzige eigene
Zeile dafür.** `Rundenende._neustart()` ruft weiterhin nur
`get_tree().reload_current_scene()` auf — das baut `main.tscn` komplett neu
auf, und ein frischer Aufbau durchläuft `Main._ready()` von vorn, das die
Auswahl unbedingt zeigt und den Baum pausiert, bevor überhaupt eine Welle
existiert. Genau dieselbe Zeile, die schon Aufwertungen und Wellenzähler beim
Neustart zurücksetzt (siehe „Zurücksetzen kostet keine einzige Zeile Code"
oben), setzt jetzt auch die Auswahl zurück.

**Zuletzt gespielter Charakter und Highscore stehen dezent dabei.**
`Charakterauswahl.zeigen()` markiert die Karte, deren `id` zu
`Spielstand.charakter_id` passt, mit einem kleinen „★ Zuletzt gespielt", und
die Kopfzeile über den Karten zeigt `Spielstand.rekord_zeile()` — „Bester
Lauf: X Punkte · Welle Y" oder „Noch kein Lauf gewertet". Beides frisch bei
jedem `zeigen()`-Aufruf gelesen, nicht nur einmalig in `_ready()`: Nach einem
Neustart kann sich der Rekord seit der letzten Auswahl geändert haben.

Ansehen kann man eine ganze Runde ohne Editor so — die Probe tippt gleich zu
Beginn den zuletzt gespielten Charakter auf der Auswahl an, steuert den
Spieler danach selbst (er zielt auf den jeweils nächsten Gegner und schießt
durchgehend, und tippt nach jeder geschafften Welle die erste angebotene
Karte an) und gibt jedes Ereignis mit Zeitstempel aus:

```bash
godot --headless --path . scenes/rundenprobe.tscn
```

### Optische Überarbeitung: von der Editor-Platzhalter-Fläche zum Titelbildschirm

Befund: Karten und Figuren standen technisch richtig da, aber auf einer
flachen, einfarbigen Fläche (`ColorRect`) — kein Titel, kein Bewegtbild,
keine Rückmeldung beim Antippen. Genau das war die Priorität dieser Runde,
mit derselben Vorgabe wie überall im Projekt: nur Godot-Bordmittel
(`Polygon2D`, `StyleBoxFlat`, `Tween`, `CPUParticles2D`, leichtes `_draw()`),
kein Shader, kein Bild, keine geänderte Hitbox.

**Der Hintergrund (`ui/auswahl_atmo.gd`, ein reines `Node2D` mit `_draw()`)**
ersetzt die alte `ColorRect` durch vier gestapelte Schichten, in
Zeichenreihenfolge:

1. Ein diagonaler Vier-Ecken-Verlauf über `draw_polygon` mit einer Farbe je
   Eckpunkt — dieselbe Technik wie `Arena`s Boden (`vertex_colors`), nur von
   Hand nachgebaut, weil ein `Node2D` kein `Polygon2D`-Kind mit eigenem
   Farbfeld ist. Dunkles Indigo oben, ein Hauch Violett unten: eine
   Stadion-bei-Nacht-Stimmung statt einer Fläche, die mit einer Spielfigur
   verwechselt werden könnte.
2. Zwei weiche „Lichtkegel" wie Flutlicht — keine echte Unschärfe (dafür
   bräuchte es einen Shader), sondern sieben konzentrische Kreise von außen
   (großer Radius, kaum sichtbar) nach innen (kleiner Radius, kräftiger),
   dieselbe Ring-Näherung an einen Gauß-Verlauf, mit der die
   React-Spielesammlung ihre Deko-Flecken über CSS-`blur` erreicht, nur hier
   ohne CSS. Bewusst **nicht** exakt symmetrisch positioniert (verschiedene
   Radien, verschiedene Farbtöne links/rechts) — ein perfekt gespiegeltes
   Muster liest sich als Deko-Vorlage, nicht als Licht.
3. Ein sehr blasses, langsam wanderndes Raster (`_versatz` läuft mit
   3,2 Pixel je Sekunde, ein voller Durchlauf bei 96 Pixeln Linienabstand
   dauert 30 Sekunden) — „sehr langsame Bewegung erlaubt" aus dem Auftrag,
   spürbar lebendig, aber keine Deko, die vom Titel oder den Karten ablenkt.
   **Rechnet und zeichnet nur, solange die Auswahl wirklich sichtbar ist**
   (`is_visible_in_tree()`), sonst liefe das Raster während der ganzen
   restlichen Runde unbemerkt im Hintergrund weiter.
4. Eine leichte Vignette an den vier Bildecken — dieselbe Ring-Technik wie
   die Lichtkegel, nur dunkel und an den Ecken verankert statt an der Mitte.
   Bei 420 Pixeln Radius auf 1152×648 überlappen sich benachbarte Ecken
   nicht, die Mitte bleibt klar.

**Titel „ARENA BRAWLER" plus Unterzeile „Wähle deinen Kämpfer".** Vorher
stand dort nur „Charakter wählen" bei 26 Pixel Schrift. Jetzt 40 Pixel,
golden (dieselbe Farbe wie die Game-Over-Überschrift, damit Titel und
Rundenende als **eine** Bildsprache gelesen werden), mit Kontur **und**
Schatten (`font_outline_color`/`font_shadow_color`) — ohne beides säße die
helle Schrift auf dem Verlauf ohne Halt. Titelzeile, Unterzeile und
Rekordzeile mussten sich dafür den bisherigen Platz vor den Karten neu
teilen (6–104 Pixel statt 36–100) — die Karten selbst behalten ihre alte
Position (ab 118 Pixel), das Layout wird also nicht angefasst.

**Die Karten haben jetzt echte Tiefe statt der von den Aufwertungskarten
mitbenutzten Fläche.** Zwei eigene `StyleBoxFlat`-Ressourcen
(`StyleBoxFlat_charakterkarte`/`_charakterkarte_aktiv`) mit dickerem Rand (3
statt 2 Pixel), größeren Ecken (26 statt 20) und einem deutlich kräftigeren,
nach unten versetzten Schatten (`shadow_size` 22/26 statt 10/12,
`shadow_offset` (0, 8)) — bewusst **eigene** Ressourcen statt einer
Änderung an `StyleBoxFlat_aufwertungskarte`, damit die Aufwertungskarten
zwischen den Wellen unangetastet bleiben, siehe „Was als Nächstes fehlt".
Dazu ein neuer Knoten `Glanz` (`ui/karten_glanz.gd`) als erstes Kind jeder
Karte: ein heller Streifen nah der Oberkante, an beiden Enden über
`draw_polyline_colors` ausgeblendet, plus zwei kleine „L"-Eckwinkel oben —
dieselbe Sprache wie `Arena`s `RandInnen`/`Ecken`, nur auf Kartengröße
herunterskaliert. Das verbindet die Auswahl optisch mit der Arena selbst,
statt eine zweite, unabhängige Bildsprache zu erfinden.

**„Zuletzt gespielt" bleibt eigens hervorgehoben**, jetzt an dieselbe Tiefe
angepasst: `_markierter_stil()` in `charakterauswahl.gd` baut seine eigene
`StyleBoxFlat` mit derselben Randbreite (3), denselben Ecken (26) und einem
grünen Schatten in vergleichbarer Stärke (24) — sonst wirkte die markierte
Karte nach dem Umbau der anderen drei plötzlich flacher statt hervorgehoben.

**Antippen fühlt sich jetzt nach einer echten Auswahl an, nicht nach einem
stummen Bildschirmwechsel.** `_bei_druck()` sperrt zuerst alle drei Karten
(`disabled = true`, sonst könnte ein hastiger zweiter Tipp mitten in der
Animation die Wahl noch ändern), dann laufen drei unabhängige `Tween`s
gleichzeitig: Die angetippte Karte federt kurz ein und zurück
(`TRANS_BACK`/`EASE_OUT`, aus ihrer **Mitte** — `pivot_offset` wird dafür in
`_ready()` einmal auf die halbe Kartengröße gesetzt, sonst würde ein
`Control` von seiner Standard-Ecke oben links aus skalieren und sichtbar
wandern), die Figur leuchtet kurz auf (`modulate` nach hell und zurück) und
dreht sich einmal leicht (`rotation` um 16° und zurück), und ein
`CPUParticles2D`-Knoten „Burst" (18 Teilchen, `one_shot`, `explosiveness=1`,
voller Radialwinkel über `spread=180`) platzt in der **Charakterfarbe**
(`variante.farbe`, erst unmittelbar vor `restart()` gesetzt) aus der Mitte
der Figur. Alle drei Tweens laufen mit `TWEEN_PAUSE_PROCESS`, nicht dem
Standard — `main.gd` hat den Baum in genau diesem Moment pausiert (siehe
oben), ohne die explizite Einstellung bliebe die ganze Rückmeldung mitten in
der Bewegung hängen.

**Figuren stehen nicht mehr starr da.** `_atmen_starten()` legt für jede
Karte einen endlos laufenden `Tween` an (`set_loops()` ohne Argument),
der die Figur zwischen 98,5 % und 101,5 % ihrer eigenen Basisgröße pulsieren
lässt — 3,4 Sekunden je vollem Zyklus, deutlich unter jeder Grenze für
auffälliges Blinken. Die Basisgröße wird bei jedem Kartenaufbau aus
`figur.scale` selbst gelesen (`4 × 4` aus `main.tscn`), nicht noch einmal
fest hingeschrieben — dieselbe Vorsicht wie bei den Werten-Labels weiter
oben.

**Die verzögerte Auswahl hat `_bei_druck()` zu einer echten Koroutine
gemacht — mit einer direkten Folge für die Prüfungen.** Vorher setzte ein
Antippen sofort `visible = false` und feuerte `gewaehlt`; jetzt liegt dazwischen
`await get_tree().create_timer(AUSWAHL_ANIMATION_DAUER).timeout` (0,42 s).
`scripts/pruefen.gd` rief `charakterauswahl._bei_druck(...)` bisher ohne
`await` auf und prüfte den Zustand direkt danach — nach dem Umbau liefen
diese Prüfungen gegen den **alten** Stand, Sekundenbruchteile zu früh, und
wären fälschlich durchgefallen. Behoben, indem sowohl `_pruefe_szenen()`
selbst als auch `_ready()` (das sie aufruft) jetzt `await`en — GDScript
reicht das Warten sauber durch, solange jede Zwischenstufe selbst `await`
enthält. `scripts/rundenprobe.gd` musste dagegen **nicht** angefasst werden:
Es ruft `_bei_druck()` absichtlich ohne `await` auf (ein „Antippen und
weitermachen", genau wie ein echter Tipp auf dem Bildschirm keine Antwort
abwartet) — die Koroutine läuft im Hintergrund weiter und setzt den
Charakter, sobald ihre eigene Verzögerung um ist; die Simulation zeigt das
im Log als eine kurze Pause vor „Welle 1 gestartet".

**Drei eigene Prüfungen wachen jetzt über genau die Punkte, die der Auftrag
nennt.** Erstens ein Regressionsschutz für die Hitbox: `Spieler.RADIUS`
**und** die tatsächlich geladene `CollisionShape2D` in `spieler.tscn` müssen
beide beim dokumentierten Wert (16) bleiben — eine Konstante allein könnte
sich vom geladenen Kollisionskörper entkoppeln, ohne dass es auffiele.
Zweitens: Kein Karten-Text darf die gezeichnete Kartenbreite überragen —
geprüft mit `ThemeDB.fallback_font.get_string_size(...)` gegen die
**tatsächliche** `Button.size.x`, nicht gegen die Bounds eines Labels oder
Containers, der sich dem Text anpassen und das Problem dadurch verstecken
könnte (genau die Falle, vor der der Auftrag ausdrücklich warnt). Drittens
dieselbe Messung für den Titel gegen die volle Bildschirmbreite
(`AuswahlAtmo.GROESSE.x`, dieselbe Konstante wie der Hintergrund selbst).
Godots Schriftmessung funktioniert auch kopflos, ohne laufendes Fenster —
kein Nachbau der Schriftmetrik von Hand nötig.

## Arena, Geschosse und Rückmeldung

Feinschliff-Runde: Der Befund war „wirkt noch flach" — nicht an einer
einzelnen Stelle, sondern am Boden, an den Wänden, am Geschoss und an der
Unverwundbarkeit gleichzeitig. Vier kleine, unabhängige Griffe, alle ohne
Shader und ohne Bilddatei:

- **Der Boden war eine einzige flache Fläche.** `arena.gd` gibt ihm jetzt
  denselben diagonalen Licht-oben-links-Verlauf wie jede Figur im Spiel
  (`Polygon2D.vertex_colors`, dieselbe Konvention wie `Formanzeige.LICHT`)
  und ein dünnes, sehr blasses Liniengitter (`Raster`, 96 Einheiten Abstand)
  — die Fläche liest sich jetzt als Boden mit Maßstab, nicht als Farbfeld.
- **Rand und Wände waren eine einzelne Linie.** Dazugekommen sind eine
  zweite, kühlere Linie ein Stück innerhalb (`RandInnen`) und vier nach innen
  zeigende „L"-Eckmarken (`Ecken`) — derselbe Kniff wie ein Kamera- oder
  Ziel-Sucher, der die Grenze markiert, ohne die ganze Kante nachzuzeichnen.
  Alle drei (Raster, `RandInnen`, Eckmarken) entstehen wie die Wände aus der
  Arena-`groesse` heraus, nicht von Hand in der Szene gesetzt.
- **Das Geschoss war eine einzelne flache Pfeilform.** `geschoss.tscn`
  bekam einen helleren `Kern` (glühender Kopf) und einen halbdurchsichtigen
  `Schweif` dahinter — beide ziehen die Charakterfarbe automatisch nach
  (`starten()` setzt jetzt drei Farben statt einer), keine feste zweite
  Farbe, die aus dem Ruder laufen könnte.
- **Die Spieler-Unverwundbarkeit hatte gar keine Anzeige.** `ist_unverwundbar()`
  war reine Rechnung ohne Rückmeldung — ein verschenkter Treffer während der
  Schutzzeit sah aus wie ein Fehler, nicht wie eine Regel. `Spieler._blinken_aktualisieren()`
  blendet die Anzeige jetzt im Wechsel ab, solange die Schutzzeit läuft
  (`BLINK_TAKT` 90 ms) — kein Tween, sondern direkt aus derselben Uhr
  gerechnet, die auch `_unverwundbar_bis` trägt, also kein eigener Zustand,
  der beim nächsten Treffer zurückgesetzt werden müsste.

## Touch-Steuerung

Virtueller Stick links unten, Feuerknopf rechts unten — beide fest
positioniert, nicht dort, wo der Finger zuerst aufsetzt (anders als beim
Phaser-Prototyp nebenan, hier ausdrücklich so gewünscht).

**Nur sichtbar, wenn Touch tatsächlich infrage kommt.** `autoload/eingabe.gd`
prüft beim Start `DisplayServer.is_touchscreen_available()` und hört danach
auf die allererste echte Berührung (`InputEventScreenTouch`), falls die
Plattformabfrage einmal danebenliegt — auf einem Gerät mit Tastatur und Maus
bleibt die Steuerung dadurch unsichtbar und stört nicht. `ui/touchsteuerung.gd`
(ein `CanvasLayer`, Geschwisterknoten von `Oberflaeche`) fasst diese
Sichtbarkeit mit der Pause zusammen: sichtbar nur, wenn Touch erkannt **und**
gerade nichts pausiert ist.

**Die Pause-Kopplung läuft genau umgekehrt zu `Oberflaeche`.** `Oberflaeche`
braucht `ALWAYS`, damit Aufwertungskarten & Co. *während* der Pause noch
reagieren (siehe „Wie die Pause wirklich funktioniert" unten). Stick und
Feuerknopf sollen während Auswahl, Aufwertungen und Game-Over dagegen
ausdrücklich **nicht** reagieren — `Touchsteuerung` bekommt deshalb bewusst
kein `ALWAYS` und blendet sich zusätzlich sichtbar aus. `main.gd` hat dafür
jetzt genau eine Stelle, die `get_tree().paused` setzt: `_pause_setzen()`
setzt beides im selben Zug, statt fünf einzelne Zuweisungen zu pflegen, von
denen man beim nächsten Pause-Zustand leicht eine vergisst, mit der
Touch-Steuerung nachzuziehen.

**Der Stick ist kein `Bewegung.richtung_aus_stick`-Test mit Bildschirm
drumherum, sondern reine Eingabe-Verdrahtung.** Die eigentliche Rechnung
stand schon vorher fertig und geprüft da (siehe Steuerung oben); `ui/stick.gd`
liefert ihr nur den Versatz von der Basis-Mitte zur Berührung. Bewusst
`_input()` statt `_gui_input()`: Ein Control bekommt `_gui_input` nur,
solange der Finger innerhalb der eigenen Fläche bleibt, ein Stick muss aber
weit über seine sichtbare Basis hinaus gezogen werden können. Der Preis
dafür: Der Knoten muss sein Aktivierungsfeld selbst nachrechnen (welcher
Finger hat innerhalb von `AKTIVIERUNGS_RADIUS` um die Basis-Mitte
aufgesetzt) — genau das verhindert auch, dass der Stick eine Berührung
stiehlt, die eigentlich dem weit entfernten Feuerknopf gilt.

**`Eingabe.stick_richtung` ist ein eigener Kanal, kein Umweg über
InputMap.** Der Stick liefert eine echte analoge Richtung (Teiltempo unter
70 % Ausschlag, siehe `Bewegung.richtung_aus_stick`) — das ließe sich nicht
verlustfrei auf die vier festen Tasten-Aktionen abbilden. Ein Autoload statt
eines Knotenpfads: `Touchsteuerung` hängt unter `Main`, `Spieler` ist ihr
Geschwisterknoten, ein direkter Pfad zwischen beiden würde `main.tscn`
zwingen, von beiden Seiten zu wissen. `Spieler._physics_process` liest den
Kanal nur, wenn keine Taste gedrückt ist — die Tastatur behält also den
Vorrang, ein Test sichert das ab.

**Der Feuerknopf bekommt dagegen keinen eigenen Kanal — er braucht keinen.**
„Gedrückt halten = Dauerfeuer" statt Auto-Feuer ohne Halten war die
bewusste Entscheidung, aus einem einfachen Grund: `ui/feuerknopf.gd` spielt
dafür einfach die bestehende `"schiessen"`-InputMap-Aktion nach
(`Input.action_press`/`action_release`) — `Spieler._physics_process` fragt
ohnehin nur `Input.is_action_pressed(&"schiessen")` ab und weiß nicht, ob
das von der Leertaste oder vom Knopf kommt. Tastatur und Touch verhalten
sich dadurch garantiert identisch, ohne eine zweite Feuerlogik zu pflegen.
Verschwindet der Knopf mitten im Halten (Neustart bei gehaltenem Finger),
gibt `_exit_tree()` die Aktion frei — sonst bliebe „schiessen" global hängen
und die nächste Runde schösse von allein.

### Der hängende Stick — ein echter Bug, kein Geschmacksurteil

Gemeldet von Ronni, auf dem echten iPad: Nach einer Weile — oder nach
bestimmten Aktionen — ließ sich die Figur nicht mehr steuern. Auto-Ziel und
Auto-Feuer räumten unbeirrt weiter Gegner ab (die hängen gar nicht am
Stick), nur Bewegen ging nicht mehr. **Ursache in einem Satz:** `_input()`
warf ganz oben `if not is_visible_in_tree(): return` vor die Tür und
verwarf damit während jeder Pause (Aufwertung, Wellenmeldung,
Charakterauswahl, Game-Over) nicht nur neue Berührungen, sondern auch das
Loslassen eines bereits gegriffenen Fingers — blieb der Daumen ausgerechnet
während einer Pause auf dem Stick liegen (der häufigste Fall: Die
Aufwertungskarten erscheinen, man hält instinktiv still) oder ging er genau
in diesem Moment hoch, kam nie ein Loslass-Ereignis an. `_finger` blieb für
immer belegt, und jeder künftige, echte Griff scheiterte an `_finger == -1`
weiter unten in `_input()` — für immer, bis zum nächsten Neustart.

**Die Lösung trennt zwei Fälle, die vorher denselben Wächter teilten.** Ein
**neuer** Griff braucht weiterhin Sichtbarkeit (sonst ließe sich der Stick
mitten in einer Pause „cheaten"), ein **Loslassen** läuft jetzt immer durch,
unsichtbar oder nicht. Das allein reicht aber nicht: Bleibt der Finger die
ganze Pause über unbewegt liegen, kommt überhaupt kein Touch-Ereignis mehr
an, egal wie großzügig `_input()` gefasst ist. Der eigentliche Fix sitzt
deshalb in `_notification(NOTIFICATION_VISIBILITY_CHANGED)`: Godot feuert
diese Benachrichtigung synchron in dem Moment, in dem sich die **im Baum
wirksame** Sichtbarkeit ändert — auch dann, wenn nicht der Stick selbst,
sondern ein Vorfahre (`Touchsteuerung`, bei jeder Pause) unsichtbar wird.
Ein noch gegriffener Finger wird darüber sofort freigegeben, ganz ohne auf
ein Ereignis zu warten, das vielleicht nie kommt.
`NOTIFICATION_APPLICATION_FOCUS_OUT` fängt denselben Fehler zusätzlich für
den selteneren Fall ab, dass das Gerät mitten im Halten in den Hintergrund
wechselt (Sperrbildschirm, App-Wechsel) — der Stick bleibt dabei sichtbar,
es kommt aber ebenfalls kein Loslass-Ereignis mehr an. `_exit_tree()`
(Neustart) räumt jetzt über dasselbe `_loslassen()` auf statt nur eine
einzelne Zeile direkt zu setzen — eine Aufräumstelle für alle vier
Abbruchwege (Loslassen, Pause, Fokusverlust, Neustart), nicht vier
verschiedene mit demselben Ziel.

**Andere verdächtige Stellen geprüft, nichts gefunden.** `autoload/eingabe.gd`
selbst braucht keine Änderung — `stick_richtung` hat mit dem Stick als
einzigem Schreiber genau einen Weg, unsauber zu bleiben, und der ist jetzt
geschlossen. `main.gd._karte_gewechselt()` (Kartenwechsel,
Spieler-aus-Hindernis-Schieben) rührt weder Touch-Zustand noch Eingabe an.
Der Feuerknopf sitzt weit außerhalb von `AKTIVIERUNGS_RADIUS` und wird nie
vom Stick mitgegriffen (siehe oben) — kein Hinweis auf gestohlene Finger
zwischen beiden.

**Sieben neue Prüfungen sichern genau die Reihenfolge ab, die den Fehler
ausgelöst hat**, nicht nur den Endzustand: ein echter Griff über `_input()`
(nicht `_greifen()` direkt), dann unsichtbar werden **mit noch belegtem
Finger**, dann prüfen, dass sowohl der interne Finger als auch
`Eingabe.stick_richtung` sofort — ganz ohne eigenes Loslass-Ereignis — wieder
frei sind. Dazu: Ein verspätetes Loslassen nach der Freigabe bleibt
folgenlos, während der Pause greift kein neuer Finger, nach der Pause
lässt sich sofort neu greifen, und ein zweiter Finger stiehlt einen
bestehenden Griff nicht. Eine zusätzliche Prüfung baut die echte
Verdrahtung aus `main.tscn` nach (Stick als Kind von `Touchsteuerung`,
`pause_setzen()` statt direkter Sichtbarkeits-Zuweisung) — sie beweist, dass
die Benachrichtigung wirklich auch beim Ausblenden durch einen **Vorfahren**
feuert, nicht nur bei der eigenen `visible`-Zuweisung.

## Ton

Acht kurze Effekte, alle im Code erzeugt (`autoload/ton.gd`) — keine
Audiodateien, kein Addon, kein Sample von Dritten. Dieselbe Idee wie
`sfx.ts` in der React-Spielesammlung nebenan: ein Sinus- oder Rechteckton
mit Tonhöhenverlauf und weicher Hüllkurve, teils mit Rauschen gemischt,
direkt als `AudioStreamWAV`-Puffer geschrieben. Jeder Effekt entsteht genau
einmal, beim Start des Autoloads, und wird danach nur noch abgespielt —
keine Ladezeit während des Spiels, kein Netz nötig.

| Effekt | Wann |
|---|---|
| `schuss` | Bei jedem abgefeuerten Schuss (Taste, Klick oder Feuerknopf) |
| `gegner_treffer` | Ein Treffer, der einen Gegner nicht sofort tötet |
| `gegner_tod` | Ein Gegner stirbt |
| `spieler_schaden` | Der Spieler nimmt Schaden — eigene, härtere Klangfarbe (Rechteck statt Sinus), damit sich das nie wie ein gewöhnlicher Gegnertreffer anhört |
| `welle_geschafft` | Eine Welle ist geschafft (drei aufsteigende Töne) |
| `aufwertung_gewaehlt` | Eine Aufwertungskarte wird angetippt |
| `game_over` | Die Runde endet — kurz absteigend, unter 350 ms, bewusst nicht dramatisch lang |
| `ui_klick` | Eine Charakterkarte wird angetippt (kein Pflichteffekt, aber billig genug für den gleichen Baustein) |

**Keine Musik-Schleife** — spart Größe und die Frage, ob ein selbst
komponierter Loop zufällig einem bekannten Spiel ähnelt. Jeder Effekt ist
unter einer Viertelsekunde und klingt einzeln für sich, nicht als Teil einer
Melodie.

**`ALWAYS`, aus demselben Grund wie `Eingabe`.** Die Wellenmeldung, die
Aufwertungskarten und der Rundenende-Bildschirm lösen ihre Töne genau in
den Momenten aus, in denen die Runde pausiert ist (`Oberflaeche` hat selbst
`ALWAYS`, siehe `main.gd`) — ein `AudioStreamPlayer` mit dem sonst ererbten
`PAUSABLE` würde in genau diesen Momenten verstummen. Spielinterne Töne
(Schuss, Treffer, Tod, Schaden) lösen dagegen nie während einer Pause aus,
weil der auslösende Code selbst (Spieler, Gegner) unter `Main` hängt und
dort mitpausiert — die Runde ist während einer Pause also von sich aus
bereits stumm, ganz ohne Sonderfall dafür.

**Ein kleiner Pool statt eines einzigen `AudioStreamPlayer`** (sechs
Stück, reihum benutzt) — zwei Treffer im selben Bild sollen beide hörbar
sein, nicht der zweite den ersten abwürgen.

**An/Aus statt Lautstärkeregler.** Gespeichert wie die Bestleistung
(`ConfigFile`, eigener kleiner Speicherort `user://ton.cfg` statt eines
Feldes in `Spielstand`, das mit „Charakter + Rekord" nichts zu tun hat).
Der Schalter sitzt als 🔊/🔇-Knopf oben rechts auf der Charakterauswahl —
die erscheint vor jeder einzelnen Runde, ein eigener Einstellungs-Bildschirm
für nur diesen einen Schalter wäre mehr, als die Aufgabe wert ist. Kein
Klickton beim Ausschalten (die Stille selbst ist die Rückmeldung), aber
einer beim Wiedereinschalten.

## Prüfungen

```bash
godot --headless --path . scenes/pruefen.tscn
```

263 Prüfungen: die reine Rechnung in `bewegung.gd`, `wellen.gd` und
`aufwertungen.gd`, die Charakter- und Gegnerdaten, die Umrisse aus
`gestalt.gd` und `gegnergestalt.gd`, der Spielstand, der Gegner und der
Wellenablauf jeweils für sich allein, dass Aufwertungen wirklich am Spieler
wirken (und die geteilte `Variante` unangetastet lassen), dass ein Geschoss
seinen Schaden weiterreicht — und eine **Rauchprobe an den echten Szenen**,
die auch die Pause-Verdrahtung prüft (`Oberflaeche` ALWAYS, `Main` bewusst
nicht). Die Rauchprobe ist bewusst dabei: Die häufigste Art, ein
Godot-Projekt kaputtzumachen, ist ein Knotenpfad, der nicht mehr stimmt.
Reine Rechnung zu prüfen fängt das nicht; ein Start mit leerer Szene fällt
sonst erst beim Spielen auf.

Dazugekommen mit den drei Gegnertypen: dass Panzer-Verfolger und Flink sich
in Leben, Tempo und Silhouette wirklich vom Verfolger unterscheiden, dass der
Lostopf (`gegnertyp_gewichte_fuer_welle`/`gegnertyp_auswaehlen`) ab den
richtigen Wellen die richtigen Typen mit den richtigen Anteilen liefert, dass
sich in einer späten Welle tatsächlich mehrere Typen gleichzeitig spawnen
lassen, dass „Stärkere Kugeln" die nötigen Treffer gegen den Panzer-Verfolger
messbar senkt, die Balance-Invariante (langsamster Charakter entkommt dem
schnellsten Gegner bei maximaler Wellensteigerung), der hohe Farbkontrast
jeder Gegnerfarbe zum Arenaboden — und die `resource_local_to_scene`-Falle:
zwei gleichzeitige Gegner unterschiedlichen Typs müssen getrennte
Trefferflächen behalten, siehe „Gegner, Wellen und Kampf" oben.

Zur Rauchprobe gehört seit der Charakterauswahl ein eigener Ablauf: Beim
bloßen Laden von `main.tscn` steht die Auswahl da, der Baum ist pausiert und
`Wellenleiter.welle` steht bei 0 — erst ein simuliertes Antippen einer Karte
(`Charakterauswahl._bei_druck(...)`, genau wie ein echtes Antippen es
auslöst) setzt `Spielstand.charakter_id`, hebt die Pause auf und startet
Welle 1. Ein zweites, unabhängig instanziertes `main.tscn` danach — mit
einem inzwischen vom Standard abweichenden `charakter_id` — prüft zusätzlich,
dass jede frische Instanz wieder bei der Auswahl beginnt, nicht nur die
allererste: Genau das leistet `reload_current_scene()` bei einem echten
Neustart, lässt sich in der Prüfszene selbst aber nicht auslösen (das würde
versuchen, `pruefen.tscn` neu zu laden statt `main.tscn`).

Der Wellenablauf-Test läuft dabei **nicht** über die geladene `haupt`-Instanz
aus der Rauchprobe, sondern über einen eigenen, isolierten Wellenleiter ohne
`main.gd` drumherum — ein echter Fund beim Bauen, kein vorausschauendes
Design: Die `haupt`-Instanz hat ihr eigenes `main.gd` am
`welle_geschafft`-Signal hängen, ein manueller `_process()`-Aufruf zum Testen
löste also ungefragt den echten Pause-Ablauf mit aus (samt einem
`SceneTreeTimer`, der nie zu Ende lief, weil der Test gleich danach beendete
— sichtbar als „ObjectDB instances leaked at exit"). Isoliert vermeidet das
von vornherein, statt es hinterher aufzuräumen.

Die Prüfszene läuft als eigene Szene und nicht über `--script`, weil sie die
Autoloads braucht — die richtet Godot nur für eine laufende Szene ein.

Dazugekommen mit der Touch-Steuerung: dass `Eingabe.touch_verfuegbar` nur
beim Übergang falsch → wahr `touch_erkannt` meldet, dass Ziehen und
Loslassen am Stick wirklich `Eingabe.stick_richtung` setzen und eine
Berührung weit außerhalb der Basis ihn nicht greift, dass der Feuerknopf die
`"schiessen"`-Aktion hält/freigibt (und beim Verschwinden mitten im Halten
sauber freigibt), dass der Stick den Spieler bewegt, wenn keine Taste
gedrückt ist — und dass die Taste trotzdem Vorrang behält, wenn beide
gleichzeitig etwas liefern. Dazu in der Rauchprobe: `Touchsteuerung` hängt
mit Stick und Feuerknopf in der Hauptszene, ist **nicht** `ALWAYS`, und
bleibt ausgeblendet, solange entweder kein Touch erkannt ist oder gerade
pausiert wird (`Eingabe.touch_verfuegbar` wird dafür extra erzwungen und
am Ende wieder zurückgesetzt, sonst bliebe sie im Testlauf ohnehin
unsichtbar — kein echter Touchscreen hier).

Dazugekommen mit dem Ton: dass jeder der Effekte einen echten,
nicht-leeren Klangpuffer erzeugt, dass ein unbekannter Name nicht abstürzt,
und dass die An/Aus-Einstellung ein erneutes Laden übersteht (dieselbe
`ConfigFile`-Prüfung wie beim Spielstand). Wie ein Effekt klingt, lässt sich
im Kopflos-Modus nicht prüfen — es gibt dort keinen echten Audiotreiber. Aus
demselben Grund erzeugt jedes `AudioStreamPlayer.play()` in dieser Umgebung
ein `AudioStreamPlaybackWAV`, das nie „fertig" meldet (die Dummy-Ausgabe
verarbeitet nichts) und deshalb bis zum Prozessende bestehen bleibt —
sichtbar als dieselbe Art „ObjectDB instances leaked at exit", die schon
beim `SceneTreeTimer` oben auftaucht. `Ton._exit_tree()` gibt seine eigenen
Referenzen trotzdem sauber frei (Pool-Player stoppen, Zwischenspeicher
leeren) — das ist die richtige Hygiene für ein echtes Beenden, ändert an
der Kopflos-Meldung selbst aber nichts, weil die verbliebenen Wiedergabe-
Objekte woanders (im Audio-Server) hängen, nicht in `Ton` selbst. Im
echten Spiel im Browser tritt das nicht auf: Dort läuft ein echter
Audio-Ausgang, der jede beendete Wiedergabe laufend selbst aufräumt.

Dazugekommen mit Auto-Ziel, Hindernissen, Karten und Powerups: dass
Auto-Ziel wirklich den nächsten Gegner in Reichweite wählt (und außerhalb
der Reichweite `null` liefert statt eines Schusses in eine falsche
Richtung), dass Auto-Feuer nur bei Touch **und** vorhandenem Ziel von selbst
feuert, dass eine gehaltene Taste weiterhin auch ohne Touch feuert, und dass
der Spieler wirklich `PROCESS_MODE_INHERIT` von `Main` erbt statt eines
eigenen `ALWAYS` (siehe „Auto-Ziel und Auto-Feuer" oben). Für Hindernisse:
dass ein Hindernis-Rechteck wirklich eine Kollisionsform **und** eine
sichtbare Fläche bekommt, dass ein zweites Setzen von `Arena.hindernisse`
die alten Formen als `is_queued_for_deletion()` markiert statt sie
synchron zu entfernen (`queue_free()` ist absichtlich verzögert, siehe
„Hindernisse" oben), dass `hindernisse_welt()` wirklich in Weltkoordinaten
umrechnet, und dass sowohl `Bewegung.aus_hindernissen_geschoben` als auch
`Bewegung.richtung_um_hindernisse` sich korrekt verhalten (Letzteres mit
`absf(...)`, nicht mit dem rohen Vorzeichen — ein früher Testentwurf prüfte
sonst in die falsche Richtung). Für Karten: dass jede Karte innerhalb ihres
Sicherheitsabstands zum Rand bleibt und **vollständig erreichbar** ist
(`Karten.ist_voll_erreichbar`, siehe oben), und dass `Karten.fuer_welle` die
richtigen Wellen auf die richtigen Karten abbildet. Für Powerups: die Wirkung
und Stapel-Regel jeder der drei Arten am Spieler (Schild fängt genau einen
Treffer ab und dann nicht noch einmal, ein zweites Tempo-Powerup verlängert
nicht zusätzlich), dass Aufsammeln nur bei einem Körper mit
`powerup_einsammeln` auslöst, dass unter genug Toden irgendwann eins fällt
und nie ein zweites dazukommt, solange eins liegt.

Zwei bestehende Prüfungen mussten dabei nachgezogen werden, kein Zufall,
sondern eine echte Nebenwirkung der neuen Powerup-Spawns: Zwei ältere
Schleifen in `_pruefe_wellenleiter_ablauf()` und
`_pruefe_gegnertyp_mischung()` gingen unbedingt davon aus, dass **jedes**
Kind einer Gegner-Gruppe ein Gegner ist (`kind.schaden_nehmen(99)`,
`kind.art_id()`) — sobald ein Powerup zufällig in dieselbe Gruppe von
Kindknoten spawnte, brach das mit „Nonexistent function 'schaden_nehmen' in
base 'Area2D (Powerup)'". Behoben mit `if kind.is_in_group(&"gegner"):` vor
beiden Zugriffen — derselbe Fehlertyp wie die `resource_local_to_scene`-Falle
weiter oben: unsichtbar, solange nur ein einziger Knotentyp im Spiel ist,
und erst durch eine zweite, gleichzeitige Art aufgedeckt.

**Eine wiederkehrende Falle beim Prüfen der Kartenwechsel-Verdrahtung:**
Der erste Testentwurf trieb die **echte** `haupt`-Instanz aus der Rauchprobe
über mehrere echte Wellen, um `karte_gewechselt` zu beobachten — genau die
Falle, die der Wellenablauf-Test oben schon einmal umgangen hatte: `haupt`
hängt `main.gd`s eigenen `welle_geschafft`-Handler am Signal, der pausiert
den Baum echt und wartet auf eine Aufwertungsauswahl, die im Test nie kommt.
Behoben, indem der Test `haupt._karte_gewechselt(testkarte)` direkt aufruft
— derselbe Kniff wie beim Wellenablauf: Godots eigenen asynchronen Ablauf
ganz umgehen, statt ihn hinterher aufzuräumen.

## Web-Export (HTML5)

Das Projekt lässt sich als reines HTML5/WebAssembly-Paket bauen und läuft
dann ganz ohne Godot-Editor im Browser — so kommt es auf Netlify unter
`/arena-brawler-godot/` bei Florian an, parallel zum Phaser-Prototyp unter
`/arena-brawler/`.

**Godot-Version: 4.3** (genau die, mit der das Projekt sonst auch geöffnet
wird — `config/features` in `project.godot` nennt sie explizit).

### Voraussetzung: Web-Export-Templates

Der Editor selbst reicht nicht — er braucht zusätzlich die **Export
Templates** (vorgefertigte Engine-Binärdateien fürs Zielsystem, getrennt vom
Editor, weil sie für jede Plattform anders sind und niemand alle auf einmal
braucht). Ohne sie bricht der Export mit „Cannot export project … due to
configuration errors" ab — diese Meldung nennt die eigentliche Ursache
leider nicht, sie erscheint identisch auch bei einer falschen Export-Option.

**Im Editor:** Menü **Editor → Manage Export Templates…** → „Download and
Install" für Version 4.3.stable. Lädt automatisch das komplette Paket
(alle Plattformen, gut 1 GB) und legt es an der richtigen Stelle ab.

**Ohne Editor-GUI (Kommandozeile), wie in dieser Session gemacht:**

```bash
# Das komplette Vorlagen-Paket für 4.3-stable (~1 GB) laden …
curl -L -o export_templates.tpz \
  https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_export_templates.tpz

# … und an die Stelle entpacken, an der Godot 4.3.stable sie unter Linux
# erwartet. Nur die Web-Dateien werden wirklich gebraucht (die anderen
# Plattformen kosten nur Platz, wenn man sie nie exportiert):
mkdir -p ~/.local/share/godot/export_templates/4.3.stable
unzip -j export_templates.tpz \
  "templates/version.txt" \
  "templates/web_release.zip" \
  "templates/web_debug.zip" \
  "templates/web_nothreads_release.zip" \
  "templates/web_nothreads_debug.zip" \
  -d ~/.local/share/godot/export_templates/4.3.stable
```

`templates/version.txt` muss danach exakt `4.3.stable` enthalten und im
selben Ordner wie die `web_*.zip`-Dateien liegen — der Ordnername *ist* die
Versionsprüfung, Godot vergleicht nichts anderes.

### Preset: `export_presets.cfg`

Liegt fertig im Projekt, von Hand geschrieben wie `project.godot`. Wichtige
Festlegungen darin, mit Begründung direkt im Kommentarkopf der Datei:

- **Export-Pfad** `../public/arena-brawler-godot/index.html` — zeigt bewusst
  aus diesem Projekt heraus in die Spielesammlung, landet dort neben dem
  Phaser-Prototyp.
- **Threads AUS** (`variant/thread_support=false`). Mit Threads bräuchte die
  Seite `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy`-Header
  (SharedArrayBuffer-Pflicht) — CLAUDE.md dokumentiert unter „Zu 3-D" schon
  die WebGL-Einbrüche auf älterem iOS-Safari, und Florians Geräte sind
  ausschließlich iPhone/iPad. Ohne Threads läuft es überall gleich, ohne
  Zusatz-Header, die die restliche Sammlung stören könnten. Nachgemessen im
  gebauten `index.js`: weder `PThread` noch `new Worker` kommen vor, es lädt
  wirklich die `*_nothreads_*`-Vorlage.
- **`vram_texture_compression/for_mobile` bewusst nicht aktiviert** — diese
  eine Option allein ließ den Export in der Prüf-Umgebung mit derselben
  unspezifischen Konfigurationsfehler-Meldung scheitern (offenbar fehlt ein
  Kompressionsmodul im jeweiligen Editor-Build). Kein Verlust: Arena Brawler
  hat keine einzige Bild-Textur, alles ist Code-Zeichnung (Polygon2D,
  `_draw()`) — die Option hätte hier ohnehin nichts zu komprimieren.
- Canvas-Resize-Policy `2` (adaptiv, füllt den Container) passt zum
  `canvas_items`/`expand`-Stretch-Modus, den `project.godot` schon für die
  normale Fensterdarstellung setzt.
- Progressive-Web-App-Unterstützung aus (`progressive_web_app/enabled=false`)
  — die Spielesammlung hat schon einen eigenen Service Worker fürs ganze
  Netlify-Deployment; ein zweiter, verschachtelter unter `/arena-brawler-
  godot/` würde nur verwirren, ohne dass Florian ihn getrennt bräuchte.

### Lokal exportieren

**Im Editor:** Projekt öffnen → **Projekt → Exportieren…** → Preset „Web"
auswählen → „Export Project". Landet automatisch unter
`public/arena-brawler-godot/` der Spielesammlung.

**Über die Kommandozeile** (das Vorgehen dieser Session, reproduzierbar):

```bash
cd arena-brawler-godot
godot --headless --path . --import          # Ressourcen neu einlesen
godot --headless --path . --export-release "Web"
```

Ergebnis: `index.html`, `index.js`, `index.wasm`, `index.pck`,
`index.audio.worklet.js` sowie zwei Icon-PNGs unter
`../public/arena-brawler-godot/` — alles, was der Browser zum Start braucht.

**Nach jeder größeren Änderung am Spiel muss neu exportiert werden** — der
Export ist ein Schnappschuss, kein automatischer Build-Schritt. Die
Spielesammlung selbst baut ihn nicht mit (`npm run build` fasst
`arena-brawler-godot/` nicht an); die fertigen Dateien unter
`public/arena-brawler-godot/` werden wie jede andere Datei unter `public/`
eingecheckt und mitausgeliefert.

## Was als Nächstes fehlt

Ton, Auto-Ziel/Auto-Feuer, Hindernisse, mehrere Arena-Layouts und Powerups
stehen inzwischen alle — dieser Abschnitt ist entsprechend aktualisiert
worden, nachdem er eine Weile hinter dem tatsächlichen Stand
zurückgeblieben war.

Denkbare nächste Ausbaustufen für die Gegner selbst: ein Fernkämpfer (bisher
läuft jeder Typ nur geradewegs auf sein Ziel zu, kein einziger schießt
zurück), ein eigenes Modul für Gegner-Geschosse (`Geschoss.gd` kennt bisher
nur den Spieler als Absender), und ein spürbares Boss-Ereignis in größeren
Abständen statt einer reinen Typenmischung.

Denkbare nächste Ausbaustufen für Karten und Hindernisse: mehr als drei
Layouts, bewegliche oder zerstörbare Hindernisse (bisher ausdrücklich fest
und unzerstörbar, siehe „Hindernisse" oben), und eine Kartenauswahl statt
des automatischen Wechsels — falls sich „alle drei Wellen" im Spielen als
zu unvorhersehbar erweist.
