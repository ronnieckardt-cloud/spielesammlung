class_name Rundenende
extends Control
## Die Rundenende-Fläche: zeigt nur an und meldet „jemand hat getippt".
##
## **Warum das hier steht und nicht in `main.gd`.** Nach dem Tod ist der ganze
## Baum pausiert (`get_tree().paused = true` in `main.gd`), sonst liefen
## Gegner und Geschosse während der Anzeige einfach weiter. Ein Knoten, der
## trotzdem noch auf Eingaben reagieren soll, braucht `process_mode = ALWAYS`
## — würde man das an `Main` selbst setzen, **erben alle Kinder es mit**
## (Godot reicht einen nicht gesetzten `PROCESS_MODE_INHERIT` bis zum
## nächsten expliziten Vorfahren durch), und plötzlich liefe der ganze
## Spielbereich trotz Pause weiter. Deshalb liegt `ALWAYS` stattdessen auf
## `Oberflaeche` (siehe `main.tscn`) — die hat nur Anzeige-Kinder wie dieses
## hier, keine einzige Spielfigur.

signal neustart_angefordert


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return

	var getippt: bool = (
		(event is InputEventKey and event.pressed)
		or (event is InputEventMouseButton and event.pressed)
		or (event is InputEventScreenTouch and event.pressed)
	)
	if getippt:
		neustart_angefordert.emit()


@onready var _karte: Control = $Karte
@onready var _nochmal: Button = $Karte/Nochmal


func _ready() -> void:
	_nochmal.pressed.connect(neustart_angefordert.emit)
	visibility_changed.connect(_einblenden)
	_karte.pivot_offset = _karte.size / 2.0


## Die Tafel federt beim Erscheinen kurz auf, statt hart einzuspringen —
## läuft mit `TWEEN_PAUSE_PROCESS`, weil der Baum zu diesem Zeitpunkt pausiert ist.
func _einblenden() -> void:
	if not visible:
		return
	_karte.scale = Vector2(0.85, 0.85)
	_karte.modulate.a = 0.0
	var t := create_tween().set_parallel(true)
	t.set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	t.tween_property(_karte, "scale", Vector2.ONE, 0.32).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	t.tween_property(_karte, "modulate:a", 1.0, 0.2)
