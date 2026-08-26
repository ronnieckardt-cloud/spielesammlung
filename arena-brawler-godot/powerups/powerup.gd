class_name Powerup
extends Area2D
## Ein aufsammelbares Powerup: liegt am Boden, bis der Spieler es berührt.
##
## Kennt seine eigene Wirkung nicht — die steht in `Powerups` (reine Daten)
## und wird vom Spieler selbst angewendet (`Spieler.powerup_einsammeln`),
## genau wie eine Aufwertungskarte ihre Wirkung nicht selbst kennt, nur
## meldet, welche gewählt wurde.
##
## Eigene Zeichnung statt Kind-Polygonen — dieselbe Überlegung wie bei
## `Formanzeige`: Drei Formen für drei Arten sind als `match` in einem
## `_draw()` kürzer als drei Sätze Kind-Knoten, und `art_id` steht ohnehin
## erst nach `einrichten()` fest.

signal eingesammelt(art_id: StringName, position: Vector2)

## Sanftes Auf-und-Ab, damit ein am Boden liegendes Powerup auffällt, ohne
## über die 1,7-Hz-Grenze des Projekts für Dauerpulse zu gehen — ein
## Durchlauf dauert 1,3 s, das sind rund 0,77 Hz.
const SCHWEBE_HOEHE := 5.0
const SCHWEBE_TAKT := 1.3

const FARBEN := {
	Powerups.SCHILD: Color(0.42, 0.74, 1.0),
	Powerups.TEMPO: Color(0.55, 0.95, 0.35),
	Powerups.SCHNELLFEUER: Color(1.0, 0.56, 0.16),
}

var art_id: StringName = Powerups.SCHILD

var _zeit := 0.0


func _ready() -> void:
	add_to_group(&"powerup")


## **Bewusst wird hier `global_position` nie berührt** — nur `queue_redraw()`.
## Das Schweben lebt komplett in `_draw()` über `draw_set_transform()`, eine
## reine Zeichenoperation ohne jede Wirkung auf die Kollisionsform. Der erste
## Versuch bewegte stattdessen `global_position` selbst jedes Bild — das
## rührt bei einer `Area2D` auch ihre beim Physikserver registrierte
## Transformation an, und genau das brach real, reproduzierbar in der
## simulierten Runde (`rundenprobe.tscn`, nie in den synchronen Kopflos-
## Prüfungen, die nie einen echten Bildschritt laufen lassen): „Can't change
## this state while flushing queries" — eine laufende Kollisionsabfrage
## (z. B. der Spieler, der gerade eine andere Fläche berührt) verträgt keine
## Positionsänderung einer überwachenden `Area2D` mittendrin. Die Kollisions-
## form steht deshalb ab `einrichten()`/dem Setzen von `global_position` ein
## einziges Mal fest und rührt sich nie wieder.
func _process(delta: float) -> void:
	_zeit += delta
	queue_redraw()


## Vom Wellenleiter aufgerufen, direkt nach dem Instanziieren — dieselbe
## Reihenfolge wie bei `Gegner.einrichten`.
func einrichten(p_art_id: StringName) -> void:
	art_id = p_art_id
	queue_redraw()


func _draw() -> void:
	# Nur die Zeichnung schwebt, siehe Kommentar oben bei `_process` — die
	# tatsächliche Position (und damit die Kollisionsform) bleibt unberührt.
	draw_set_transform(Vector2(0.0, sin(_zeit * TAU / SCHWEBE_TAKT) * SCHWEBE_HOEHE))

	var farbe: Color = FARBEN.get(art_id, Color.WHITE)

	# Ring als Untergrund — dieselbe „Bodenring"-Idee wie bei Dash Citys
	# Schüben (siehe CLAUDE.md): Die Farbe taucht am Ring UND in der Form
	# wieder auf, das verbindet „das habe ich eingesammelt, das wirkt jetzt"
	# ohne ein einziges Wort.
	draw_arc(Vector2.ZERO, 16.0, 0.0, TAU, 28, farbe, 2.5, true)

	match art_id:
		Powerups.SCHILD:
			_schild_zeichnen(farbe)
		Powerups.TEMPO:
			_tempo_zeichnen(farbe)
		Powerups.SCHNELLFEUER:
			_schnellfeuer_zeichnen(farbe)


## Ein Schild-Umriss (Fünfeck mit gerundeter Spitze nach unten) — dieselbe
## Silhouette, die auch am Spieler erscheint, während der Schild aktiv ist
## (siehe `Spieler._draw`), damit „das habe ich eingesammelt" und „das wirkt
## gerade" zusammengehören.
func _schild_zeichnen(farbe: Color) -> void:
	var punkte := PackedVector2Array([
		Vector2(0, -9), Vector2(7, -5), Vector2(7, 3), Vector2(0, 10), Vector2(-7, 3), Vector2(-7, -5),
	])
	draw_colored_polygon(punkte, farbe)
	var rand := punkte.duplicate()
	rand.append(punkte[0])
	draw_polyline(rand, farbe.lightened(0.5), 1.5, true)


## Ein nach oben zeigender Chevron — „schneller", ohne Text.
func _tempo_zeichnen(farbe: Color) -> void:
	var punkte := PackedVector2Array([Vector2(0, -9), Vector2(8, 6), Vector2(0, 1), Vector2(-8, 6)])
	draw_colored_polygon(punkte, farbe)


## Drei kleine, nach rechts weisende Dreiecke — „mehrfach, schnell
## hintereinander", dieselbe Aussage wie eine Salve.
func _schnellfeuer_zeichnen(farbe: Color) -> void:
	for i in 3:
		var x := -8.0 + i * 8.0
		var punkte := PackedVector2Array([Vector2(x, -6), Vector2(x + 6, 0), Vector2(x, 6)])
		draw_colored_polygon(punkte, farbe)


func _on_body_entered(koerper: Node2D) -> void:
	if not koerper.has_method(&"powerup_einsammeln"):
		return
	koerper.powerup_einsammeln(art_id)
	Ton.abspielen(&"powerup")
	eingesammelt.emit(art_id, global_position)

	# `call_deferred(&"queue_free")`, nicht `queue_free()` direkt: Godot
	# versucht beim Entfernen einer überwachenden `Area2D`, ihre Formen sofort
	# beim Physikserver abzumelden — mitten in der gerade laufenden
	# Kollisionsabfrage (aus der dieser Aufruf selbst stammt) ist das
	# verboten ("Can't change this state while flushing queries"), real
	# aufgetreten in der simulierten Runde bei mehreren gleichzeitigen
	# Kollisionen. Aufschieben verschiebt schon das *Anmelden* zum Entfernen
	# hinter das Ende der Abfrage, nicht nur das eigentliche Löschen.
	call_deferred(&"queue_free")
