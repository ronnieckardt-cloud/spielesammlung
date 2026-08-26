# Arena Brawler (Godot 4)

Moderner 2D-Arena-Brawler in Godot 4 mit GDScript.

> **Eigenständiges Projekt.** Es hat nichts mit der React-Spielesammlung im
> übergeordneten Verzeichnis zu tun und nichts mit dem Phaser-Prototyp in
> `arena-brawler-mini/` — kein gemeinsamer Code, keine gemeinsamen Abhängigkeiten.
> Es liegt nur im selben Repository.

Stand: **spielbare Runde mit Charakterauswahl, drei Gegnertypen und
Aufwertungen**. Arena, Spieler, Bewegung, Schießen, drei Charaktervarianten
mit eigenen Figuren, drei Gegnertypen (Verfolger, Panzer-Verfolger, Flink),
ein Wellensystem mit steigender Typenmischung und eine Kartenauswahl nach
jeder geschafften Welle stehen — man wählt vor jeder Runde erst einen
Charakter auf einem eigenen Bildschirm, spielt dann von Anfang bis Game-Over,
wird dabei stärker, und ein Neustart führt sauber zurück zur Auswahl.
Touch-Bedienung kommt später.

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
| Charakter wählen (vor Rundenstart) | Karte antippen/anklicken |

Tab bleibt der schnelle Wechsel mitten in der Runde, ist aber nicht mehr der
Hauptweg — der ist jetzt die Auswahl vor dem Start, siehe unten.

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
│   ├── main.tscn            Hauptszene: Arena + Spieler + Wellenleiter + Kamera + Kopfzeile + Rundenende + Charakterauswahl
│   ├── arena.tscn           Boden (mit Verlauf), Raster, Rand (außen + innen + Eckmarken), Wände
│   ├── geschoss.tscn        Schweif + Bild + Kern
│   ├── pruefen.tscn         Prüfszene (nicht Teil des Spiels)
│   ├── musterblatt.tscn     gibt die Figuren als JSON aus (Werkzeug)
│   └── rundenprobe.tscn     spielt eine Runde mehrere Sekunden durch (Werkzeug)
├── characters/
│   └── spieler.tscn
├── enemies/
│   ├── gegner.tscn          Form + Anzeige (Formanzeige) + Beruehrung, alle drei Typen
│   └── gegner.gd
├── scripts/
│   ├── gemeinsam/
│   │   ├── bewegung.gd      reine Rechnung, ohne Node und ohne Uhr
│   │   ├── gestalt.gd       die Vielecke der drei Charaktere, ebenso rein
│   │   ├── gegnergestalt.gd die Vielecke der drei Gegnertypen, ebenso rein
│   │   ├── formanzeige.gd   zeichnet eine Teileliste — der einzige Knoten dafür, Charaktere **und** Gegner
│   │   └── figur.gd         `Formanzeige` + Charakter-Startwert (`@export charakter_id`) für den Spieler
│   ├── spieler/
│   │   ├── spieler.gd
│   │   └── geschoss.gd
│   ├── welt/
│   │   ├── main.gd
│   │   ├── arena.gd
│   │   ├── wellen.gd           Steigerung über die Wellen + Typenmischung, reine Rechnung
│   │   ├── wellenleiter.gd     spawnt Gegner, meldet geschaffte Wellen
│   │   ├── gegnertypen.gd      die drei Gegnertypen (reine Daten), das Gegenstück zu `charaktere.gd`
│   │   ├── aufwertungen.gd     die fünf Karten, reine Rechnung
│   │   └── rundenende.gd       Neustart-Erkennung, siehe „Pause" unten
│   ├── pruefen.gd
│   ├── musterblatt.gd
│   └── rundenprobe.gd
├── ui/
│   ├── aufwertungsauswahl.gd   die drei Karten nach einer Welle
│   └── charakterauswahl.gd     die drei Karten vor dem Rundenstart
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

## Prüfungen

```bash
godot --headless --path . scenes/pruefen.tscn
```

153 Prüfungen: die reine Rechnung in `bewegung.gd`, `wellen.gd` und
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

## Was als Nächstes fehlt

Touch-Bedienung, Ton. Beides bewusst noch nicht gebaut: Erst sollte eine
ganze Runde mit echter Steigerung, einem Einstieg davor und einem Gegenüber,
das nicht nach drei Wellen langweilig wird, stehen.

Denkbare nächste Ausbaustufen für die Gegner selbst: ein Fernkämpfer (bisher
läuft jeder Typ nur geradewegs auf sein Ziel zu, kein einziger schießt
zurück), ein eigenes Modul für Gegner-Geschosse (`Geschoss.gd` kennt bisher
nur den Spieler als Absender), und ein spürbares Boss-Ereignis in größeren
Abständen statt einer reinen Typenmischung.
