class_name Figur
extends Node2D
## Zeichnet die Gestalt eines Charakters. **Kennt keine Spielregel.**
##
## Die Aufteilung ist dieselbe wie überall in diesem Projekt: `Gestalt` rechnet
## die Vielecke aus (ohne Node, prüfbar), dieser Knoten malt sie hin. Dadurch
## kann derselbe Knoten im Spiel am Spieler hängen und später auf dem
## Auswahlbildschirm stehen — dort mit `scale`, sonst nichts anders.
##
## Bewusst ein `_draw()` und nicht mehrere `Polygon2D`-Kinder: Ein Wechsel des
## Charakters mitten im Spiel müsste sonst Knoten anlegen und wegwerfen. So ist
## es ein Neuzeichnen.

## Startwert. Zur Laufzeit geht der Wechsel über `zeigen()` — bewusst **kein**
## Setter darauf: `zeigen()` schreibt selbst wieder in dieses Feld, ein Setter
## würde sich damit endlos selbst aufrufen.
@export var charakter_id: StringName = &"ausgewogen"

var _teile: Array[Gestalt.Teil] = []


func _ready() -> void:
	if _teile.is_empty():
		zeigen(Charaktere.nach_id(charakter_id))


## Eine Variante anzeigen. Unbekannt oder `null` fällt auf den Standard zurück —
## eine unsichtbare Figur wäre die schlechtere Antwort auf einen alten
## Spielstand.
func zeigen(variante: Charaktere.Variante) -> void:
	if variante == null:
		variante = Charaktere.standard()

	charakter_id = variante.id
	_teile = Gestalt.teile(variante)
	queue_redraw()


## Nur für Prüfungen: wie viele Teile gerade gezeichnet werden.
func teile_anzahl() -> int:
	return _teile.size()


func _draw() -> void:
	for teil in _teile:
		draw_colored_polygon(teil.punkte, teil.farbe)

		if teil.rand_breite <= 0.0:
			continue

		# `draw_polyline` schließt nicht von selbst — ohne den angehängten
		# ersten Punkt bleibt eine Lücke an der Naht.
		var ring := teil.punkte.duplicate()
		ring.append(teil.punkte[0])
		draw_polyline(ring, teil.kontur, teil.rand_breite, true)
