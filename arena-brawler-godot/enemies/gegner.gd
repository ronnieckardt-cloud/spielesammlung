class_name Gegner
extends CharacterBody2D
## Ein Verfolger: läuft geradewegs auf sein Ziel zu. Keine Wegfindung, kein
## Ausweichen — das gilt für **alle** Typen gleich (`Gegnertypen`), nur Tempo,
## Leben, Trefferfläche und Aussehen unterscheiden sich.
##
## **Hier steht bewusst keine Richtungs-Rechnung.** Die kommt aus
## `Bewegung.richtung_zu` (reine Funktion, ohne Node prüfbar), genau wie beim
## Spieler. Dieses Skript verbindet nur: Ziel kennen, Ergebnis an die Physik
## geben, Berührung mit dem Ziel melden — und jetzt zusätzlich: welcher Typ
## das gerade ist.

signal gestorben

## Grundwerte, solange `einrichten()` nie aufgerufen wurde — etwa beim
## direkten Instanziieren in einer Prüfung. Entsprechen dem Verfolger, dem
## bisherigen einzigen Typ, damit sich ohne `einrichten()` nichts ändert.
const TEMPO := 95.0
const LEBEN := 1

## Kurzes Aufblitzen bei einem Treffer, der nicht tötet — sonst ist ein
## Treffer, der einen Panzer-Verfolger nur ankratzt, optisch unsichtbar und
## man weiß nicht, ob der Schuss überhaupt ankam.
const AUFBLITZ_DAUER := 0.09
const AUFBLITZ_FARBE := Color(2.4, 2.4, 2.4, 1)

## Tod: erst ein kurzer, hellerer Blitz, dann ausblenden und wachsen — ein
## einzelnes Verblassen war schwer vom bloßen Aufblitzen zu unterscheiden.
const STERBE_BLITZ_DAUER := 0.05
const STERBE_DAUER := 0.22

## Gesetzt vom Wellenleiter direkt nach dem Instanziieren, vor dem ersten
## `_physics_process` — dieselbe Reihenfolge wie bei `Spieler.arena`.
var ziel: Node2D
var tempo_faktor: float = 1.0

var _art: Gegnertypen.Art
var _leben: int = LEBEN
var _stirbt := false
var _tween: Tween
var _blitz_tween: Tween

@onready var _form: CollisionShape2D = $Form
@onready var _anzeige: Formanzeige = $Anzeige
@onready var _beruehrung: Area2D = $Beruehrung
@onready var _beruehrung_form: CollisionShape2D = $Beruehrung/BeruehrungForm


func _ready() -> void:
	add_to_group(&"gegner")


## Vom Wellenleiter aufgerufen, **nach** `add_child` — die Kollisionsformen
## und die Anzeige sind `@onready`-Felder und erst dann gesetzt (Godot ruft
## `_ready()` beim Einhängen in den Baum auf). Ohne `einrichten()` bleibt ein
## Gegner ein Verfolger mit den Grundwerten oben, siehe `_form`/`_beruehrung`
## in `gegner.tscn`.
##
## **Die Kollisionsformen sind `resource_local_to_scene`.** Ohne das würde
## `_form.shape.radius = art.radius` hier die Form **aller** gleichzeitig
## existierenden Gegner ändern — `preload`/`instantiate()` teilen sich sonst
## dieselbe `CircleShape2D`-Ressource, das ist keine Kopie je Instanz. Ein
## Test in `pruefen.gd` sichert genau das ab: zwei gleichzeitige Gegner
## unterschiedlichen Typs müssen unterschiedliche Trefferflächen behalten.
func einrichten(art: Gegnertypen.Art, p_tempo_faktor: float = 1.0) -> void:
	_art = art
	_leben = art.leben
	tempo_faktor = p_tempo_faktor

	(_form.shape as CircleShape2D).radius = art.radius
	(_beruehrung_form.shape as CircleShape2D).radius = art.radius + 1.0

	_anzeige.zeigen_teile(Gegnergestalt.teile(art))


## Nur für Prüfungen: welcher Typ das ist. Ohne `einrichten()` der Verfolger,
## derselbe Fallback wie bei den Grundwerten oben.
func art_id() -> StringName:
	return _art.id if _art != null else Gegnertypen.VERFOLGER


func _physics_process(_delta: float) -> void:
	if _stirbt:
		return

	if ziel != null:
		var grundtempo := _art.tempo if _art != null else TEMPO
		var richtung := Bewegung.richtung_zu(global_position, ziel.global_position)
		velocity = richtung * grundtempo * tempo_faktor
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
	else:
		_aufblitzen()


## Ein Treffer, der nicht tötet — vor allem beim Panzer-Verfolger wichtig
## (mehrere Treffer nötig, ohne Rückmeldung sähe ein Schuss aus, als wäre er
## wirkungslos verpufft).
func _aufblitzen() -> void:
	if _blitz_tween != null and _blitz_tween.is_valid():
		_blitz_tween.kill()

	_anzeige.modulate = Color(1, 1, 1, 1)
	_blitz_tween = create_tween()
	_blitz_tween.tween_property(_anzeige, "modulate", AUFBLITZ_FARBE, 0.02)
	_blitz_tween.tween_property(_anzeige, "modulate", Color(1, 1, 1, 1), AUFBLITZ_DAUER)


func _sterben() -> void:
	_stirbt = true
	# Sofort aus der Gruppe raus, nicht erst nach dem Aufblitzen: Der
	# Wellenleiter zählt „noch da" über die Gruppe, und der Treffer, nicht das
	# Verblassen, ist der Moment, der zählt.
	remove_from_group(&"gegner")
	gestorben.emit()

	if _blitz_tween != null and _blitz_tween.is_valid():
		_blitz_tween.kill()

	# Erst ein kurzer, heller Blitz (derselbe Trick wie beim Aufblitzen, nur
	# stärker), dann Ausblenden und Wachsen gleichzeitig — das macht den
	# tödlichen Treffer von einem bloßen Ankratzen unterscheidbar, nicht nur
	# in der Anzahl der Treffer, auch in der Anzeige selbst.
	_tween = create_tween()
	_tween.tween_property(_anzeige, "modulate", Color(2.6, 2.6, 2.6, 1), STERBE_BLITZ_DAUER)
	_tween.set_parallel(true)
	_tween.tween_property(_anzeige, "modulate", Color(1, 1, 1, 0), STERBE_DAUER)
	_tween.tween_property(self, "scale", Vector2(1.6, 1.6), STERBE_DAUER) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	await _tween.finished
	queue_free()


## Falls der Knoten mitten im Verblassen aus dem Baum verschwindet — die
## Runde endet im selben Moment neu (`Main.reload_current_scene`), oder ein
## Test räumt sofort auf: Ohne das hängt ein Tween als nicht abgeschlossene
## Coroutine in der Luft, statt sauber aufzuräumen.
func _exit_tree() -> void:
	if _tween != null and _tween.is_valid():
		_tween.kill()
	if _blitz_tween != null and _blitz_tween.is_valid():
		_blitz_tween.kill()
