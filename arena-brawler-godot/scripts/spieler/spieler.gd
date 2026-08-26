class_name Spieler
extends CharacterBody2D
## Der Spieler: Eingaben entgegennehmen, anzeigen, Geschosse abschicken.
##
## **Hier steht bewusst keine Rechnung.** Richtung, Zielsuche und Arena-Grenze
## kommen aus `Bewegung` (reine Funktionen, ohne Node prüfbar), die Startwerte
## aus `Charaktere`. Dieses Skript verbindet nur: Tasten lesen, Ergebnis an die
## Physik geben, Aussehen setzen.
##
## Der Anzeigeknoten ist absichtlich getrennt vom Kollisionskörper: Die Figur
## darf später größer oder kleiner aussehen als ihre Trefferfläche, ohne dass
## sich am Spielgefühl etwas ändert. Genau daran ist der Phaser-Prototyp einmal
## fast hängengeblieben — die Anzeige wuchs, die Hitbox schrumpfte still mit.

signal getroffen(leben_uebrig: int)
signal gestorben

const GESCHOSS := preload("res://scenes/geschoss.tscn")

## Halber Durchmesser der Trefferfläche. Passt zum CollisionShape2D in
## `spieler.tscn` — beide zusammen ändern, sonst steckt die Figur in der Wand.
const RADIUS := 16.0

@export var charakter_id: StringName = &"ausgewogen"

var variante: Charaktere.Variante
var leben: int = 0
var arena: Rect2 = Rect2(Vector2.ZERO, Vector2(1152, 648))

var _naechster_schuss: float = 0.0
var _unverwundbar_bis: float = 0.0

## Stapel je Aufwertungsart (`Aufwertungen.FEUERRATE` usw.) — nur die vier
## wiederholbaren, Leben läuft nicht darüber (siehe `Aufwertungen`). Startet
## bei jeder neuen Instanz leer: Ein „Nochmal" nach Game-Over mountet den
## Spieler über `reload_current_scene()` komplett neu, genau das setzt alle
## Boni zurück — hier muss nichts eigens aufgeräumt werden.
var _aufwertungen: Dictionary = {}

@onready var _anzeige: Node2D = $Anzeige
@onready var _figur: Figur = $Anzeige/Figur


func _ready() -> void:
	uebernehmen(Charaktere.nach_id(charakter_id))


## Charakter setzen und alles daran Hängende neu aufbauen. Auch zur Laufzeit
## aufrufbar — das Durchschalten mit Tab benutzt genau diesen Weg.
func uebernehmen(neue: Charaktere.Variante) -> void:
	if neue == null:
		neue = Charaktere.standard()

	variante = neue
	charakter_id = neue.id
	leben = neue.leben

	# Das Aussehen kommt vollständig aus der Variante — hier steht keine Farbe
	# und keine Form. Sonst gälte für einen Wert der Charakter und für den
	# nächsten die alte Zahl, derselbe Fehler wie bei den Startwerten.
	_figur.zeigen(neue)


func _physics_process(delta: float) -> void:
	var richtung := Bewegung.richtung_aus_tasten(
		Input.is_action_pressed(&"links"),
		Input.is_action_pressed(&"rechts"),
		Input.is_action_pressed(&"hoch"),
		Input.is_action_pressed(&"runter"),
	)

	velocity = richtung * effektives_tempo()
	move_and_slide()

	# Zusätzlich zur Kollision mit den Wänden: Bei sehr hohem Tempo kann ein
	# Körper in einem Schritt durch eine dünne Wand rutschen. Die harte Grenze
	# kostet nichts und schließt das sicher aus.
	global_position = Bewegung.in_arena(global_position, arena, RADIUS)

	if richtung != Vector2.ZERO:
		# Die Anzeige dreht sich, der Körper nicht: Ein gedrehter
		# Kollisionskörper macht aus einem sauberen Kreis eine wackelige Form.
		_anzeige.rotation = lerp_angle(_anzeige.rotation, richtung.angle() + PI / 2.0, 12.0 * delta)

	if Input.is_action_pressed(&"schiessen"):
		_schiessen(richtung)

	if Input.is_action_just_pressed(&"charakter_wechseln"):
		var naechste := Charaktere.naechste(charakter_id)
		Spielstand.charakter_setzen(naechste.id)
		uebernehmen(naechste)


func _schiessen(richtung: Vector2) -> void:
	var jetzt := Time.get_ticks_msec() / 1000.0
	if jetzt < _naechster_schuss:
		return
	_naechster_schuss = jetzt + effektive_schuss_pause()

	var flug := richtung if richtung != Vector2.ZERO else Vector2.from_angle(_anzeige.rotation - PI / 2.0)

	var geschoss := GESCHOSS.instantiate()
	geschoss.global_position = global_position
	geschoss.starten(flug, effektive_reichweite(), variante.farbe, effektiver_schaden())
	# An den Elternknoten hängen, nicht an den Spieler: Ein Geschoss soll
	# stehenbleiben, wo es ist, und nicht mitwandern, wenn der Spieler läuft.
	get_parent().add_child(geschoss)


## Eine gewählte Aufwertungskarte anwenden. Leben wirkt sofort und direkt auf
## den laufenden Wert (gedeckelt); die vier anderen erhöhen nur ihren
## Stapelzähler — die eigentliche Wirkung lesen `effektives_tempo()` &
## Geschwister bei jedem Aufruf frisch daraus ab, es gibt also keinen
## zweiten Ort, an dem „das aktuelle Tempo" stehen könnte.
func aufwertung_anwenden(art_id: StringName) -> void:
	if art_id == Aufwertungen.LEBEN:
		leben = mini(Aufwertungen.LEBEN_MAX, leben + Aufwertungen.LEBEN_SCHRITT)
		return

	var bisher: int = _aufwertungen.get(art_id, 0)
	_aufwertungen[art_id] = Aufwertungen.naechster_stapel(bisher, art_id)


## Welche Karten dem Spieler gerade angeboten werden dürften — reicht die
## eigenen Stapel und das aktuelle Leben nur weiter an `Aufwertungen`.
func verfuegbare_aufwertungen() -> Array[Aufwertungen.Art]:
	return Aufwertungen.verfuegbare_arten(_aufwertungen, leben)


func effektives_tempo() -> float:
	return variante.tempo * Aufwertungen.tempo_faktor(_aufwertungen.get(Aufwertungen.TEMPO, 0))


func effektive_schuss_pause() -> float:
	return variante.schuss_pause * Aufwertungen.feuerrate_faktor(_aufwertungen.get(Aufwertungen.FEUERRATE, 0))


func effektive_reichweite() -> float:
	return variante.reichweite * Aufwertungen.reichweite_faktor(_aufwertungen.get(Aufwertungen.REICHWEITE, 0))


func effektiver_schaden() -> int:
	return Aufwertungen.schaden(_aufwertungen.get(Aufwertungen.SCHADEN, 0))


func ist_unverwundbar() -> bool:
	return Time.get_ticks_msec() / 1000.0 < _unverwundbar_bis


func schaden_nehmen(menge: int = 1) -> void:
	if ist_unverwundbar() or leben <= 0:
		return

	leben -= menge
	_unverwundbar_bis = Time.get_ticks_msec() / 1000.0 + variante.unverwundbar

	getroffen.emit(leben)
	if leben <= 0:
		gestorben.emit()
