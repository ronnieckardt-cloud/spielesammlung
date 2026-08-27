class_name AuswahlAtmo
extends Node2D
## Der Hintergrund der Charakterauswahl: dunkle Arena-Atmosphäre statt einer
## flachen Fläche. Alles über `_draw()` und Godot-Bordmittel, kein Shader,
## keine Bilddatei — dieselbe Handschrift wie der Rest des Projekts
## (`arena.gd`s Boden-Verlauf, `Formanzeige`s Radialverlauf im Körper).
##
## Vier Schichten, in Zeichenreihenfolge (jede spätere liegt über der
## vorherigen, wie überall sonst im Projekt): Verlauf, Lichtkegel, ein sehr
## langsam wanderndes Raster, Vignette an den vier Ecken.
##
## **Nur das Raster bewegt sich, und zwar kaum wahrnehmbar.** Die
## Aufgabenstellung erlaubt „sehr langsame Bewegung" — keine Deko, die vom
## Titel oder den Karten ablenkt. Bei 96 Pixeln Linienabstand und 3,2 Pixel
## je Sekunde braucht ein voller Durchlauf 30 Sekunden.

const GROESSE := Vector2(1152, 648)

const RASTER_TEMPO := 3.2
const RASTER_ABSTAND := 96.0
const RASTER_FARBE := Color(0.55, 0.7, 1.0, 0.07)

## Zwei weiche Lichtkegel wie Flutlicht über einer nächtlichen Arena — Position,
## Reichweite und Farbton bewusst leicht asymmetrisch, sonst wirkt es wie ein
## exakt gespiegeltes Muster statt wie echtes Licht.
const LICHTKEGEL := [
	{"mitte": Vector2(230.0, 120.0), "radius": 440.0, "farbe": Color(0.55, 0.72, 1.0, 0.16)},
	{"mitte": Vector2(950.0, 90.0), "radius": 380.0, "farbe": Color(0.75, 0.55, 1.0, 0.13)},
]

const VIGNETTE_STUFEN := 6
const VIGNETTE_RADIUS := 420.0

var _versatz := 0.0


func _process(delta: float) -> void:
	# Nur rechnen und neu zeichnen, während die Auswahl überhaupt zu sehen
	# ist — unsichtbar wäre jede weitere Bewegung verschenkte Arbeit. Die
	# ganze Auswahl hängt unter `Oberflaeche` (ALWAYS), läuft also auch
	# während der Pause weiter, in der sie ja überhaupt erst zu sehen ist.
	if not is_visible_in_tree():
		return
	_versatz = fmod(_versatz + delta * RASTER_TEMPO, RASTER_ABSTAND)
	queue_redraw()


func _draw() -> void:
	_verlauf_zeichnen()
	for kegel in LICHTKEGEL:
		_lichtkegel_zeichnen(kegel["mitte"], kegel["radius"], kegel["farbe"])
	_raster_zeichnen()
	_vignette_zeichnen()


## Vier Eckpunkte, vier Farben — dieselbe Technik wie `Arena`s Boden
## (`vertex_colors`), nur von Hand über `draw_polygon` mit einer Farbe je
## Eckpunkt. Dunkles Indigo oben, ein Hauch Violett unten: eine
## Stadion-bei-Nacht-Stimmung, kein Farbton, der mit einer Spielfigur oder
## einem Hindernis verwechselt werden könnte.
func _verlauf_zeichnen() -> void:
	var ecken := PackedVector2Array([
		Vector2.ZERO, Vector2(GROESSE.x, 0.0), GROESSE, Vector2(0.0, GROESSE.y),
	])
	var farben := PackedColorArray([
		Color("0a0e1c"), Color("120a1e"), Color("1a1024"), Color("120e22"),
	])
	draw_polygon(ecken, farben)


## Weiche Kreise ohne Shader: von außen (großer Radius, kaum sichtbar) nach
## innen (kleiner Radius, etwas kräftiger) — dieselbe Näherung an einen
## Gauß-Verlauf, die die Spielesammlung nebenan für ihre Deko-Flecken
## benutzt, nur hier aus Ringen zusammengesetzt statt über CSS-`blur`.
func _lichtkegel_zeichnen(mitte: Vector2, radius: float, farbe: Color) -> void:
	const STUFEN := 7
	for i in STUFEN:
		var t := float(i) / float(STUFEN - 1)
		var r := lerpf(radius, radius * 0.18, t)
		var deckung := farbe.a * (0.12 + 0.88 * t) / float(STUFEN)
		draw_circle(mitte, r, Color(farbe.r, farbe.g, farbe.b, deckung))


func _raster_zeichnen() -> void:
	var x := -RASTER_ABSTAND + _versatz
	while x < GROESSE.x:
		draw_line(Vector2(x, 0.0), Vector2(x, GROESSE.y), RASTER_FARBE, 1.0)
		x += RASTER_ABSTAND

	var y := -RASTER_ABSTAND + _versatz
	while y < GROESSE.y:
		draw_line(Vector2(0.0, y), Vector2(GROESSE.x, y), RASTER_FARBE, 1.0)
		y += RASTER_ABSTAND


## Vier dunkle Ecken statt eines echten Shaders — dieselbe Ring-Technik wie
## der Lichtkegel oben, nur dunkel und an den vier Bildecken verankert statt
## an der Mitte. Bei 420 Pixeln Radius auf einer 1152×648-Fläche überlappen
## sich benachbarte Ecken nicht (840 > 1152 wäre nötig, tatsächlich bleibt
## deutlich Luft), die Mitte bleibt also klar.
func _vignette_zeichnen() -> void:
	var ecken := [Vector2.ZERO, Vector2(GROESSE.x, 0.0), GROESSE, Vector2(0.0, GROESSE.y)]
	for ecke in ecken:
		for i in VIGNETTE_STUFEN:
			var t := float(i) / float(VIGNETTE_STUFEN - 1)
			var r := lerpf(VIGNETTE_RADIUS, VIGNETTE_RADIUS * 0.35, t)
			var deckung := (0.05 + 0.16 * t) / float(VIGNETTE_STUFEN)
			draw_circle(ecke, r, Color(0.0, 0.0, 0.0, deckung))
