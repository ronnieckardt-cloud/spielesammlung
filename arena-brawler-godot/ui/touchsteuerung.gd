class_name Touchsteuerung
extends CanvasLayer
## Container für Stick und Feuerknopf — zeigt beide nur, wenn Touch
## tatsächlich infrage kommt (`Eingabe.touch_verfuegbar`), und blendet sie
## während jeder Pause aus (Auswahl, Aufwertungen, Game-Over): `main.gd`
## ruft dafür `pause_setzen()` an genau den Stellen auf, an denen es auch
## `get_tree().paused` setzt.
##
## **Bewusst keine `ALWAYS`.** Das wäre hier auch funktional falsch: Stick
## und Feuerknopf sollen während der Pause ja gerade **nicht** reagieren,
## nicht trotzdem weiterlaufen wie die Aufwertungskarten. Ohne `ALWAYS`
## bekommen `Stick`/`Feuerknopf` während einer Pause von selbst keine
## Eingaben mehr — `pause_setzen()` blendet sie zusätzlich sichtbar aus, ein
## rein optischer Griff obendrauf (siehe `_aktualisieren`), sonst stünden
## sie sichtbar, aber tot da.

var _pausiert := false


func _ready() -> void:
	if not Eingabe.touch_verfuegbar:
		Eingabe.touch_erkannt.connect(_aktualisieren)
	_aktualisieren()


func pause_setzen(pausiert: bool) -> void:
	_pausiert = pausiert
	_aktualisieren()


func _aktualisieren() -> void:
	visible = Eingabe.touch_verfuegbar and not _pausiert
