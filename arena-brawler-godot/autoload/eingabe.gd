extends Node
## Laufzeit-Eingabe, die nicht über feste InputMap-Aktionen läuft — bisher
## nur der Stick-Ausschlag. `Bewegung.richtung_aus_stick` liefert eine echte
## analoge Richtung (inklusive Teiltempo unter 70 % Ausschlag); das lässt
## sich nicht verlustfrei auf die vier festen Tasten-Aktionen "links"/
## "rechts"/"hoch"/"runter" abbilden, ohne genau diese Abstufung zu
## verlieren. Der Feuerknopf braucht das nicht: Der spielt einfach die
## bestehende "schiessen"-Aktion nach, siehe `ui/feuerknopf.gd`.
##
## **Autoload statt Knotenpfad.** `Touchsteuerung` hängt unter `Main`,
## `Spieler` ist ihr Geschwisterknoten — ein direkter Pfad zwischen beiden
## würde `main.tscn` zwingen, von beiden Seiten zu wissen. So schreibt die
## eine Seite (`ui/stick.gd`), die andere liest (`spieler.gd`), ohne dass
## `main.gd` irgendetwas verbinden müsste.
##
## **`ALWAYS`, obwohl sonst nirgends in diesem Autoload eine Spielregel
## steht.** Nur so lässt sich eine Berührung erkennen, die während einer
## Pause ankommt — und die allererste Berührung überhaupt landet fast immer
## auf der Charakterauswahl, nicht mitten im leeren Spielfeld. Ein Autoload
## hängt ohnehin nicht unter `Main`, `ALWAYS` kaskadiert hier also an nichts
## Spielrelevantes weiter (anders als bei `Main` selbst, siehe dessen
## Kommentar dazu).

signal touch_erkannt

var stick_richtung := Vector2.ZERO

## Ob Touch-Bedienung angeboten wird: entweder meldet die Plattform selbst
## einen Touchscreen, oder eine erste echte Berührung ist schon angekommen
## (z. B. wenn `DisplayServer.is_touchscreen_available()` auf einer
## Zwischenschicht einmal falsch liegt). Der Setter emittiert nur beim
## Übergang von falsch auf wahr — ein zweites Mal "erkannt" zu melden wäre
## Rauschen, und `Touchsteuering.zeigen()`/Tests dürfen den Wert trotzdem
## jederzeit zurücksetzen (dann läuft es einfach über den else-Zweig ohne
## Signal).
var touch_verfuegbar := false:
	set(wert):
		if wert and not touch_verfuegbar:
			touch_verfuegbar = true
			touch_erkannt.emit()
		else:
			touch_verfuegbar = wert


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	touch_verfuegbar = DisplayServer.is_touchscreen_available()


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		touch_verfuegbar = true
