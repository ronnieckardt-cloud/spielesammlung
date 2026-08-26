class_name Geschoss
extends Area2D
## Ein Schuss des Spielers.
##
## `Area2D` und nicht `CharacterBody2D`: Ein Geschoss soll nichts wegschieben,
## nur melden, dass es etwas berührt hat.
##
## Es räumt sich nach der zurückgelegten Strecke selbst weg, nicht nach einer
## festen Zeit. Damit hängt die Reichweite wirklich an der Reichweite des
## Charakters und nicht daran, wie schnell das Geschoss zufällig fliegt.

const TEMPO := 620.0

var _richtung := Vector2.RIGHT
var _reichweite := 460.0
var _geflogen := 0.0
var _schaden := 1

@onready var _bild: Polygon2D = $Bild
@onready var _kern: Polygon2D = $Kern
@onready var _schweif: Polygon2D = $Schweif


## `schaden` mit Standardwert 1, damit ein Aufruf ohne den Parameter (etwa
## aus einem älteren Test) weiterhin das alte Verhalten bekommt.
func starten(richtung: Vector2, reichweite: float, farbe: Color, schaden: int = 1) -> void:
	_richtung = richtung.normalized() if richtung != Vector2.ZERO else Vector2.RIGHT
	_reichweite = reichweite
	_schaden = schaden
	rotation = _richtung.angle()

	# Die Farbe kommt vom Charakter: Man soll sehen, dass das der eigene Schuss
	# ist — später fliegen auch gegnerische Geschosse herum. Kern und Schweif
	# ziehen dieselbe Farbe nach, nicht ihre eigene: heller für den glühenden
	# Kopf, halbdurchsichtig für den Schweif dahinter — beides bleibt an den
	# Charakter gebunden statt an eine feste zweite Farbe.
	if _bild != null:
		_bild.color = farbe
	if _kern != null:
		_kern.color = farbe.lightened(0.6)
	if _schweif != null:
		var schweiffarbe := farbe
		schweiffarbe.a = 0.35
		_schweif.color = schweiffarbe


func _physics_process(delta: float) -> void:
	var schritt := TEMPO * delta
	position += _richtung * schritt
	_geflogen += schritt

	if _geflogen >= _reichweite:
		# `call_deferred(&"queue_free")`, nicht `queue_free()` direkt — auch
		# hier, aus demselben Grund wie in `_on_body_entered`: Die Physik-
		# Engine kann sich mitten in einem Bildschritt in einer laufenden
		# Kollisionsabfrage befinden (ein anderes Geschoss oder der Spieler
		# berührt gerade etwas), und das Abmelden einer überwachenden
		# `Area2D` mittendrin ist verboten ("Can't change this state while
		# flushing queries"). Das Erreichen der Reichweite ist ein sehr
		# häufiges Ereignis (jedes Geschoss, das nicht trifft), deshalb hier
		# genauso wichtig wie beim Treffer selbst.
		call_deferred(&"queue_free")


func _on_body_entered(koerper: Node2D) -> void:
	# Der Treffer selbst gehört dem Getroffenen — hier wird nur weitergereicht.
	if koerper.has_method(&"schaden_nehmen"):
		koerper.schaden_nehmen(_schaden)

	# `call_deferred(&"queue_free")`, nicht `queue_free()` direkt — dieselbe
	# Begründung wie in `powerups/powerup.gd`: Seit Hindernisse und Powerups
	# dazukamen, überlappen sich mehr gleichzeitige Kollisionen als vorher,
	# und ein Geschoss, das sich mitten in der eigenen `body_entered`-Abfrage
	# selbst entfernt, kann diese Abfrage stören ("Can't change this state
	# while flushing queries"), real beobachtet in der simulierten Runde.
	call_deferred(&"queue_free")
