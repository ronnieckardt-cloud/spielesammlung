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
