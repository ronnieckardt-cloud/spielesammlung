class_name Stick
extends Control
## Der virtuelle Bewegungs-Stick: links unten, fest positioniert (nicht dort,
## wo der Finger zuerst aufsetzt — anders als beim Phaser-Prototyp nebenan,
## hier ausdrücklich so gewünscht). Schreibt seine Richtung nach
## `Eingabe.stick_richtung`; `Spieler._physics_process` liest sie nur, wenn
## gerade keine Taste gedrückt ist.
##
## **Eigener `_input()` statt `_gui_input()`.** Ein Godot-Control bekommt
## `_gui_input` nur, solange der Finger innerhalb der eigenen Fläche bleibt —
## ein Stick muss aber weit über seine sichtbare Basis hinaus gezogen werden
## können, sonst fühlt er sich beim ersten hastigen Ausschlag wie
## "losgelassen" an. `_input()` läuft unabhängig von Bounds, dafür muss
## dieser Knoten sein Aktivierungsfeld selbst nachrechnen: welcher Finger
## (`event.index`) hat innerhalb von `AKTIVIERUNGS_RADIUS` um die
## Basis-Mitte aufgesetzt. Das ist auch der Grund, warum der Stick den
## Feuerknopf nie stiehlt — der sitzt weit außerhalb dieses Radius.
##
## **Läuft nicht während der Pause.** Dieser Knoten erbt `Main`s normalen
## `process_mode` (keine `ALWAYS`) — genau umgekehrt zu den Pause-Karten,
## siehe `rundenende.gd`: Der Stick soll während Auswahl, Aufwertungen und
## Game-Over ja gerade **nicht** reagieren, nicht trotzdem weiterlaufen.

const AKTIVIERUNGS_RADIUS := 100.0
## Wirksamer Ausschlagsradius für `Bewegung.richtung_aus_stick` — nicht
## derselbe Wert wie der sichtbare Ring, der darf kleiner bleiben.
const STICK_RADIUS := 70.0

const BASIS_RADIUS := 62.0
const KNOPF_RADIUS := 32.0

const FARBE_BASIS := Color(1, 1, 1, 0.16)
const FARBE_BASIS_RAND := Color(1, 1, 1, 0.32)
const FARBE_KNOPF := Color(1, 1, 1, 0.55)
const FARBE_KNOPF_AKTIV := Color(1, 1, 1, 0.88)
const FARBE_SCHATTEN := Color(0, 0, 0, 0.28)

var _finger := -1
var _versatz := Vector2.ZERO
var _aktiv := false


func _basis_mitte() -> Vector2:
	return global_position + size / 2.0


func _input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return

	if event is InputEventScreenTouch:
		if event.pressed:
			if _finger == -1 and event.position.distance_to(_basis_mitte()) <= AKTIVIERUNGS_RADIUS:
				_finger = event.index
				_greifen(event.position)
		elif event.index == _finger:
			_loslassen()

	elif event is InputEventScreenDrag and event.index == _finger:
		_greifen(event.position)


func _greifen(beruehrung: Vector2) -> void:
	_aktiv = true
	_versatz = beruehrung - _basis_mitte()
	Eingabe.stick_richtung = Bewegung.richtung_aus_stick(_versatz, STICK_RADIUS)
	queue_redraw()


func _loslassen() -> void:
	_finger = -1
	_aktiv = false
	_versatz = Vector2.ZERO
	Eingabe.stick_richtung = Vector2.ZERO
	queue_redraw()


## Falls der Stick mitten im Ziehen aus dem Baum verschwindet (Neustart) —
## sonst bliebe `Eingabe.stick_richtung` auf dem letzten Ausschlag stehen,
## und die frische Runde liefe von allein los, bevor jemand den Bildschirm
## berührt hat.
func _exit_tree() -> void:
	Eingabe.stick_richtung = Vector2.ZERO


func _draw() -> void:
	var mitte := size / 2.0

	draw_circle(mitte + Vector2(0, 4), BASIS_RADIUS, FARBE_SCHATTEN)
	draw_circle(mitte, BASIS_RADIUS, FARBE_BASIS)
	draw_arc(mitte, BASIS_RADIUS, 0.0, TAU, 40, FARBE_BASIS_RAND, 2.5)

	# Rein optische Klemmung des Knaufs auf den sichtbaren Ring — unabhängig
	# von der tatsächlichen, in `Bewegung.richtung_aus_stick` berechneten
	# Bewegungsstärke, die ihre eigene, sanftere Kurve fährt (Totzone,
	# Teiltempo bis 70 %). Der Knauf soll bei einem weiten Ausschlag nicht
	# über die Basis hinausschießen, mehr will diese Zeile nicht.
	var knopf_versatz := _versatz.limit_length(STICK_RADIUS * 0.62)
	var knopf_mitte := mitte + knopf_versatz
	draw_circle(knopf_mitte + Vector2(0, 3), KNOPF_RADIUS, FARBE_SCHATTEN)
	draw_circle(knopf_mitte, KNOPF_RADIUS, FARBE_KNOPF_AKTIV if _aktiv else FARBE_KNOPF)
