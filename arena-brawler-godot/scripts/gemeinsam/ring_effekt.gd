class_name RingEffekt
extends Node2D
## Kurzer Ring plus Funken — dieselbe Rückmeldung für Treffer, Tod und
## Powerup-Einsammeln, damit alles einheitlich wirkt. Reine `_draw()`-
## Zeichnung und ein Tween, keine Kollision und kein Bild; räumt sich nach
## ~0,4 s selbst weg.

const DAUER := 0.38

var _t := 0.0
var _farbe := Color.WHITE
var _radius := 34.0


## Legt den Effekt an `eltern` an. Ein reines Node2D (keine Physikfläche),
## deshalb auch mitten in einer Physik-Abfrage unbedenklich.
static func erzeugen(eltern: Node, position: Vector2, farbe: Color, radius: float = 34.0) -> void:
	var e := RingEffekt.new()
	e._farbe = farbe
	e._radius = radius
	e.z_index = 5
	eltern.add_child(e)
	e.global_position = position
	var tw := e.create_tween()
	tw.tween_property(e, "_t", 1.0, DAUER).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_callback(e.queue_free)


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	var a := 1.0 - _t
	var r := lerpf(6.0, _radius, _t)
	draw_arc(Vector2.ZERO, r, 0.0, TAU, 32, Color(_farbe, a * 0.9), 3.0 * a + 1.0, true)
	for i in 8:
		var w := TAU * float(i) / 8.0 + 0.2
		var d := Vector2.from_angle(w)
		draw_line(d * r * 0.7, d * (r * 0.7 + 9.0 * a), Color(_farbe.lightened(0.4), a), 2.0, true)
