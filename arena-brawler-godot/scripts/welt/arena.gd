class_name Arena
extends Node2D
## Boden und Begrenzung des Spielfelds.
##
## Die Wände werden **aus der Größe erzeugt**, nicht in der Szene von Hand
## gezeichnet: Sonst muss man bei jeder Änderung an vier Stellen dieselbe Zahl
## nachziehen, und die vierte vergisst man. `groesse` ist die einzige Quelle.

## Dicke der Wandkörper. Deutlich mehr als ein Haar: Ein zu dünner
## Kollisionskörper wird bei hohem Tempo in einem Physikschritt übersprungen.
const WANDDICKE := 64.0

@export var groesse := Vector2(1152, 648):
	set(wert):
		groesse = wert
		if is_inside_tree():
			aufbauen()

@export var bodenfarbe := Color("232634")
@export var randfarbe := Color("4a5570")

@onready var _boden: Polygon2D = $Boden
@onready var _rand: Line2D = $Rand
@onready var _waende: StaticBody2D = $Waende


func _ready() -> void:
	aufbauen()


## Der Bereich, in dem sich Figuren aufhalten dürfen — in Weltkoordinaten.
func flaeche() -> Rect2:
	return Rect2(global_position, groesse)


func aufbauen() -> void:
	_boden.polygon = PackedVector2Array([
		Vector2.ZERO, Vector2(groesse.x, 0), groesse, Vector2(0, groesse.y),
	])
	_boden.color = bodenfarbe

	_rand.points = PackedVector2Array([
		Vector2.ZERO, Vector2(groesse.x, 0), groesse, Vector2(0, groesse.y), Vector2.ZERO,
	])
	_rand.default_color = randfarbe

	_waende_setzen()


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
