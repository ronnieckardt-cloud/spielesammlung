class_name Gegner
extends CharacterBody2D
## Ein einfacher Verfolger: läuft geradewegs auf sein Ziel zu. Keine
## Wegfindung, kein Ausweichen — genau das macht ihn zum einfachsten
## Gegnertyp und zum Grundbaustein für alles, was später dazukommt.
##
## **Hier steht bewusst keine Richtungs-Rechnung.** Die kommt aus
## `Bewegung.richtung_zu` (reine Funktion, ohne Node prüfbar), genau wie beim
## Spieler. Dieses Skript verbindet nur: Ziel kennen, Ergebnis an die Physik
## geben, Berührung mit dem Ziel melden.

signal gestorben

## Grundtempo. Deutlich unter jedem Charakter-Tempo (215 bis 355, siehe
## `Charaktere`) — ein einzelner Verfolger soll nie uneinholbar sein, erst
## viele gleichzeitig sollen Druck machen.
const TEMPO := 95.0
const LEBEN := 1

## Kurzes Aufblitzen beim Tod statt lautlosem Verschwinden — sonst ist ein
## Treffer nur eine Zahl weniger auf dem Feld, kein Ereignis.
const STERBE_DAUER := 0.18

## Gesetzt vom Wellenleiter direkt nach dem Instanziieren, vor dem ersten
## `_physics_process` — dieselbe Reihenfolge wie bei `Spieler.arena`.
var ziel: Node2D
var tempo_faktor: float = 1.0

var _leben: int = LEBEN
var _stirbt := false
var _tween: Tween

@onready var _anzeige: Node2D = $Anzeige
@onready var _beruehrung: Area2D = $Beruehrung


func _ready() -> void:
	add_to_group(&"gegner")


func _physics_process(_delta: float) -> void:
	if _stirbt:
		return

	if ziel != null:
		var richtung := Bewegung.richtung_zu(global_position, ziel.global_position)
		velocity = richtung * TEMPO * tempo_faktor
		if richtung != Vector2.ZERO:
			_anzeige.rotation = richtung.angle() + PI / 2.0

	move_and_slide()

	# Berührung wird jeden Schritt neu geprüft statt nur beim ersten Kontakt
	# (`body_entered`): Ein Verfolger bleibt am Spieler kleben, sobald er ihn
	# erreicht hat. Mit nur einem einmaligen Signal käme der zweite Treffer
	# erst, wenn beide sich kurz trennen und neu berühren — die bestehende
	# Unverwundbarkeit in `Spieler.schaden_nehmen` bremst die Wiederholung
	# ohnehin schon ab, das braucht keine zweite Sperre hier.
	for koerper in _beruehrung.get_overlapping_bodies():
		if koerper.has_method(&"schaden_nehmen"):
			koerper.schaden_nehmen(1)


## Von Geschossen aufgerufen (siehe `Geschoss._on_body_entered`) — dieselbe
## Schnittstelle wie beim Spieler, deshalb funktioniert derselbe Geschoss-Code
## für beide Seiten, ohne dass das Geschoss weiß, wen es trifft.
func schaden_nehmen(menge: int = 1) -> void:
	if _stirbt:
		return

	_leben -= menge
	if _leben <= 0:
		_sterben()


func _sterben() -> void:
	_stirbt = true
	# Sofort aus der Gruppe raus, nicht erst nach dem Aufblitzen: Der
	# Wellenleiter zählt „noch da" über die Gruppe, und der Treffer, nicht das
	# Verblassen, ist der Moment, der zählt.
	remove_from_group(&"gegner")
	gestorben.emit()

	_tween = create_tween()
	_tween.set_parallel(true)
	_tween.tween_property(_anzeige, "modulate", Color(1, 1, 1, 0), STERBE_DAUER)
	_tween.tween_property(self, "scale", Vector2(1.5, 1.5), STERBE_DAUER)
	await _tween.finished
	queue_free()


## Falls der Knoten mitten im Verblassen aus dem Baum verschwindet — die
## Runde endet im selben Moment neu (`Main.reload_current_scene`), oder ein
## Test räumt sofort auf: Ohne das hängt der Tween als nicht abgeschlossene
## Coroutine in der Luft, statt sauber aufzuräumen.
func _exit_tree() -> void:
	if _tween != null and _tween.is_valid():
		_tween.kill()
