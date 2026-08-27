class_name KartenGlanz
extends Node2D
## Die „Lichtkante" einer Charakterkarte: ein heller Streifen nah der
## Oberkante, an beiden Enden ausgeblendet, plus zwei kleine Eckwinkel oben —
## dieselbe Sprache wie der innere Rand und die Eckmarken der Arena selbst
## (`arena.gd`: `RandInnen`/`Ecken`), nur auf Kartengröße herunterskaliert.
## Rein dekorativ, kennt keine Spielregel und keinen Charakter.
##
## Liegt als erstes Kind in der Karte, zeichnet also **unter** Figur, Name
## und Werte — wichtig ist nur die Oberkante, dort überschneidet sich nichts.

const RAND := 14.0
const ECKE_LAENGE := 22.0
const ECKE_FARBE := Color(0.75, 0.82, 1.0, 0.55)

## Startwert für die Editor-Vorschau; `_ready()` liest die echte Kartenbreite
## aus dem Elternknoten, sonst müsste diese Zahl bei jeder Kartengrößen-
## Änderung von Hand nachgezogen werden.
var _breite := 320.0


func _ready() -> void:
	var eltern := get_parent()
	if eltern is Control:
		_breite = (eltern as Control).size.x
	queue_redraw()


func _draw() -> void:
	# Lichtstreifen: hell in der Mitte, an beiden Enden auf 0 ausgeblendet —
	# `draw_polyline_colors` blendet zwischen den Punktfarben selbst weich,
	# kein Shader nötig, dieselbe Technik wie `Formanzeige._verlauf`.
	var punkte := PackedVector2Array([
		Vector2(RAND, RAND), Vector2(_breite * 0.5, RAND), Vector2(_breite - RAND, RAND),
	])
	var farben := PackedColorArray([
		Color(1.0, 1.0, 1.0, 0.0), Color(1.0, 1.0, 1.0, 0.5), Color(1.0, 1.0, 1.0, 0.0),
	])
	draw_polyline_colors(punkte, farben, 2.0, true)

	_ecke(Vector2(RAND, RAND), Vector2(1.0, 1.0))
	_ecke(Vector2(_breite - RAND, RAND), Vector2(-1.0, 1.0))


func _ecke(punkt: Vector2, richtung: Vector2) -> void:
	var linie := PackedVector2Array([
		punkt + Vector2(richtung.x * ECKE_LAENGE, 0.0), punkt, punkt + Vector2(0.0, richtung.y * ECKE_LAENGE),
	])
	draw_polyline(linie, ECKE_FARBE, 2.0, true)
