class_name Feuerknopf
extends Button
## Der Touch-Feuerknopf: gedrückt halten löst Dauerfeuer aus, genau wie das
## Halten der Leertaste am Rechner — bewusst **nicht** Auto-Feuer ohne
## Halten. Der Knopf spielt dafür einfach dieselbe InputMap-Aktion nach
## ("schiessen"): `Spieler._physics_process` fragt ohnehin nur
## `Input.is_action_pressed(&"schiessen")` ab und weiß nicht, ob das von der
## Taste oder von diesem Knopf kommt. Keine zweite Feuerlogik nötig, und
## Tastatur und Touch verhalten sich dadurch garantiert identisch — ein
## Auto-Feuer-Modus nur für Touch hieße, zwei unterschiedliche Regeln für
## dieselbe Handlung zu pflegen, je nachdem, wie gerade gespielt wird.
##
## `button_down`/`button_up` statt `pressed`: `pressed` feuert erst nach
## einem vollständigen Tipp-und-Loslassen, hier zählt aber der ganze
## Zeitraum, in dem der Finger liegen bleibt.

func _ready() -> void:
	button_down.connect(func() -> void: Input.action_press(&"schiessen"))
	button_up.connect(func() -> void: Input.action_release(&"schiessen"))


## Falls der Knopf mitten im Halten aus dem Baum verschwindet (Neustart,
## Rundenende während gehaltenem Finger) — sonst bliebe "schiessen" global
## hängen, bis irgendwann zufällig eine echte Taste gedrückt wird, und die
## nächste Runde würde von allein schießen.
func _exit_tree() -> void:
	Input.action_release(&"schiessen")
