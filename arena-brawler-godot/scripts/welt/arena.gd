class_name Arena
extends Node2D
## Boden und Begrenzung des Spielfelds.
##
## Die Wände werden **aus der Größe erzeugt**, nicht in der Szene von Hand
## gezeichnet: Sonst muss man bei jeder Änderung an vier Stellen dieselbe Zahl
## nachziehen, und die vierte vergisst man. `groesse` ist die einzige Quelle.
## Raster und Eckmarken entstehen aus demselben Grund ebenfalls hier und
## nicht als von Hand gesetzte Punkte in der Szene.
##
## **Der Boden war eine einzige flache Fläche, keine einzige Struktur.**
## Zwei Griffe beheben das, beide billig (kein Shader, keine Bilddatei):
## `vertex_colors` auf dem Boden-Polygon geben ihm denselben diagonalen
## Licht-oben-links-Verlauf wie jede Figur im Spiel (`Formanzeige.LICHT`),
## und ein dünnes, sehr blasses Liniengitter (`Raster`) macht die Fläche
## lesbar als Boden mit Ausdehnung, nicht als Farbfeld ohne Maßstab.

## Dicke der Wandkörper. Deutlich mehr als ein Haar: Ein zu dünner
## Kollisionskörper wird bei hohem Tempo in einem Physikschritt übersprungen.
const WANDDICKE := 64.0

## Abstand der Rasterlinien — grob eine Spielfigur-Länge mal drei, spürbar
## als Maßstab, ohne bei jedem Schritt eine neue Linie zu zeigen.
const RASTER_ABSTAND := 96.0
const RASTER_BREITE := 1.5
const RASTER_FARBE := Color(1, 1, 1, 0.05)

## Ein Stück innerhalb des Randes: eine zweite, kühlere Linie plus vier
## nach innen zeigende Eckmarken — das Gegenstück zum wärmeren, dickeren
## Außenrand, zusammen liest sich das als „Energiefeld" statt als bloße
## Wand.
const RAND_INNEN_ABSTAND := 14.0
const RAND_INNEN_FARBE := Color(0.55, 0.75, 1.0, 0.28)
const ECKE_LAENGE := 28.0
const ECKE_BREITE := 3.0
const ECKE_FARBE := Color(0.55, 0.75, 1.0, 0.85)

@export var groesse := Vector2(1152, 648):
	set(wert):
		groesse = wert
		if is_inside_tree():
			aufbauen()

@export var bodenfarbe := Color("232634")
@export var randfarbe := Color("4a5570")

@onready var _boden: Polygon2D = $Boden
@onready var _rand: Line2D = $Rand
@onready var _rand_innen: Line2D = $RandInnen
@onready var _raster: Node2D = $Raster
@onready var _ecken: Node2D = $Ecken
@onready var _waende: StaticBody2D = $Waende


func _ready() -> void:
	aufbauen()


## Der Bereich, in dem sich Figuren aufhalten dürfen — in Weltkoordinaten.
func flaeche() -> Rect2:
	return Rect2(global_position, groesse)


func aufbauen() -> void:
	var ecken_punkte := PackedVector2Array([
		Vector2.ZERO, Vector2(groesse.x, 0), groesse, Vector2(0, groesse.y),
	])

	_boden.polygon = ecken_punkte
	_boden.color = bodenfarbe
	# Licht oben links, wie überall sonst im Spiel (`Formanzeige.LICHT`) —
	# dieselbe Konvention, nur diesmal auf vier Eckpunkten statt auf einem
	# Vieleck mit vielen. Ohne eigene `vertex_colors` würde Godot sonst
	# `_boden.color` an allen vier Ecken gleich einfärben, exakt die flache
	# Fläche, die hier behoben werden soll.
	_boden.vertex_colors = PackedColorArray([
		bodenfarbe.lightened(0.05), bodenfarbe.lightened(0.015),
		bodenfarbe.darkened(0.05), bodenfarbe.darkened(0.015),
	])

	_rand.points = PackedVector2Array([
		Vector2.ZERO, Vector2(groesse.x, 0), groesse, Vector2(0, groesse.y), Vector2.ZERO,
	])
	_rand.default_color = randfarbe

	var einzug := RAND_INNEN_ABSTAND
	_rand_innen.points = PackedVector2Array([
		Vector2(einzug, einzug), Vector2(groesse.x - einzug, einzug),
		Vector2(groesse.x - einzug, groesse.y - einzug), Vector2(einzug, groesse.y - einzug),
		Vector2(einzug, einzug),
	])
	_rand_innen.default_color = RAND_INNEN_FARBE
	_rand_innen.width = 2.0

	_raster_zeichnen()
	_ecken_zeichnen(ecken_punkte)
	_waende_setzen()


## Dünne, sehr blasse Linien quer über den Boden — als Kind-Knoten erzeugt,
## nicht als ein einziges `_draw()`: `Line2D` übernimmt Rundung und
## Kappen-Rechnung selbst, und die Zahl der Linien bleibt hier ohnehin klein
## (bei 1152×648 und 96 Abstand rund ein Dutzend).
func _raster_zeichnen() -> void:
	for kind in _raster.get_children():
		kind.queue_free()

	var x := RASTER_ABSTAND
	while x < groesse.x - 1.0:
		_raster.add_child(_linie(PackedVector2Array([Vector2(x, 0), Vector2(x, groesse.y)])))
		x += RASTER_ABSTAND

	var y := RASTER_ABSTAND
	while y < groesse.y - 1.0:
		_raster.add_child(_linie(PackedVector2Array([Vector2(0, y), Vector2(groesse.x, y)])))
		y += RASTER_ABSTAND


func _linie(punkte: PackedVector2Array) -> Line2D:
	var l := Line2D.new()
	l.points = punkte
	l.width = RASTER_BREITE
	l.default_color = RASTER_FARBE
	return l


## Vier nach innen zeigende „L"-Marken, je eine an jeder Ecke — derselbe
## Kniff wie ein Kamera- oder Ziel-Sucher: Er sagt „hier ist die Grenze",
## ohne die ganze Kante nachzuzeichnen.
func _ecken_zeichnen(ecken_punkte: PackedVector2Array) -> void:
	for kind in _ecken.get_children():
		kind.queue_free()

	# Für jede Ecke, in welche Richtung (x, y) ihre beiden Schenkel von der
	# Ecke aus nach innen zeigen.
	var richtungen := [Vector2(1, 1), Vector2(-1, 1), Vector2(-1, -1), Vector2(1, -1)]

	for i in ecken_punkte.size():
		var p := ecken_punkte[i]
		var r: Vector2 = richtungen[i]
		var l := Line2D.new()
		l.points = PackedVector2Array([
			p + Vector2(r.x * ECKE_LAENGE, 0), p, p + Vector2(0, r.y * ECKE_LAENGE),
		])
		l.width = ECKE_BREITE
		l.default_color = ECKE_FARBE
		_ecken.add_child(l)


func _waende_setzen() -> void:
	for kind in _waende.get_children():
		kind.queue_free()

	var h := WANDDICKE / 2.0
	# oben, unten, links, rechts — jeweils Mittelpunkt und halbe Ausdehnung
	var seiten := [
		[Vector2(groesse.x / 2.0, -h), Vector2(groesse.x / 2.0 + WANDDICKE, h)],
		[Vector2(groesse.x / 2.0, groesse.y + h), Vector2(groesse.x / 2.0 + WANDDICKE, h)],
		[Vector2(-h, groesse.y / 2.0), Vector2(h, groesse.y / 2.0 + WANDDICKE)],
		[Vector2(groesse.x + h, groesse.y / 2.0), Vector2(h, groesse.y / 2.0 + WANDDICKE)],
	]

	for seite in seiten:
		var form := RectangleShape2D.new()
		form.size = seite[1] * 2.0

		var kollision := CollisionShape2D.new()
		kollision.shape = form
		kollision.position = seite[0]
		_waende.add_child(kollision)
