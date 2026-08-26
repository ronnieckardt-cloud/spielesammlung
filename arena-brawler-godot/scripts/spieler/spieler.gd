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
signal powerup_eingesammelt(art_id: StringName)

const GESCHOSS := preload("res://scenes/geschoss.tscn")

## Halber Durchmesser der Trefferfläche. Passt zum CollisionShape2D in
## `spieler.tscn` — beide zusammen ändern, sonst steckt die Figur in der Wand.
const RADIUS := 16.0

## Wie schnell die Figur während der Unverwundbarkeit blinkt, und wie blass
## der dunkle Takt ist. Kein Tween: Die Unverwundbarkeit selbst läuft schon
## über einen Zeitpunkt (`_unverwundbar_bis`), ein zweiter, unabhängiger Takt
## aus derselben Uhr braucht keinen eigenen Zustand, der beim nächsten
## Treffer erst zurückgesetzt werden müsste.
const BLINK_TAKT := 0.09
const BLINK_DECKUNG := 0.35

@export var charakter_id: StringName = &"ausgewogen"

var variante: Charaktere.Variante
var leben: int = 0
var arena: Rect2 = Rect2(Vector2.ZERO, Vector2(1152, 648))

var _naechster_schuss: float = 0.0
var _unverwundbar_bis: float = 0.0

## Powerup-Zustand — dieselbe "bis wann"-Uhr wie `_unverwundbar_bis`, aus
## demselben Grund: kein eigener Timer-Knoten nötig, nur ein Zeitpunkt, gegen
## den bei Bedarf verglichen wird. Schild hat keine eigene Dauer, es wirkt
## bis zum nächsten abgefangenen Treffer, deshalb ein reines `bool` statt
## einer Uhr.
var _schild_aktiv := false
var _tempo_boost_bis: float = 0.0
var _schnellfeuer_bis: float = 0.0

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

	# Der Stick liefert eine echte analoge Richtung (Teiltempo unter 70 %
	# Ausschlag) — das würde beim Umweg über die vier Tasten-Aktionen
	# verlorengehen, deshalb kommt er über einen eigenen Kanal
	# (`Eingabe.stick_richtung`, siehe dessen Kommentar) statt über
	# InputMap. Die Taste gewinnt, wenn beide gleichzeitig etwas liefern —
	# das passiert nur beim Testen am Rechner mit sichtbarem Touch-Layer,
	# nie im echten Spiel auf einem einzelnen Gerät.
	if richtung == Vector2.ZERO:
		richtung = Eingabe.stick_richtung

	velocity = richtung * effektives_tempo()
	move_and_slide()

	# Zusätzlich zur Kollision mit den Wänden: Bei sehr hohem Tempo kann ein
	# Körper in einem Schritt durch eine dünne Wand rutschen. Die harte Grenze
	# kostet nichts und schließt das sicher aus.
	global_position = Bewegung.in_arena(global_position, arena, RADIUS)

	# Auto-Ziel: Der nächste Gegner in Reichweite bestimmt Blickrichtung UND
	# Schuss — unabhängig von der Laufrichtung. Genau das macht Touch
	# überhaupt spielbar: Ein Finger auf dem Stick reicht, ohne sich
	# zusätzlich exakt zum Gegner drehen zu müssen. `Bewegung.naechstes_ziel`
	# ist dieselbe reine Funktion, die auch die Prüfungen direkt durchrechnen.
	var ziel: Variant = Bewegung.naechstes_ziel(
		global_position, _gegnerpositionen(), effektive_reichweite(),
	)

	if ziel != null:
		var zielrichtung: Vector2 = Bewegung.richtung_zu(global_position, ziel)
		_anzeige.rotation = lerp_angle(_anzeige.rotation, zielrichtung.angle() + PI / 2.0, 12.0 * delta)
	elif richtung != Vector2.ZERO:
		# Kein Gegner in Reichweite: Die Figur folgt stattdessen der
		# Laufrichtung, wie bisher — sonst friert sie beim Loslaufen in eine
		# alte Blickrichtung ein, nur weil gerade nichts zu bekämpfen da ist.
		_anzeige.rotation = lerp_angle(_anzeige.rotation, richtung.angle() + PI / 2.0, 12.0 * delta)

	# Feuerknopf/Leertaste feuern weiterhin nur, solange sie gehalten werden.
	# Auto-Feuer (Standard auf Touch) feuert von selbst, sobald ein Ziel da
	# ist — die eine Zutat, die noch fehlte, damit ein Finger auf dem Stick
	# fürs ganze Spiel reicht, ohne den zweiten für den Feuerknopf zu
	# brauchen. Auf Tastatur bleibt es bei Leertaste, absichtlich: Wer am
	# Rechner testet, hat ohnehin beide Hände frei.
	if ziel != null and (Input.is_action_pressed(&"schiessen") or Eingabe.touch_verfuegbar):
		_schiessen(ziel)

	if Input.is_action_just_pressed(&"charakter_wechseln"):
		var naechste := Charaktere.naechste(charakter_id)
		Spielstand.charakter_setzen(naechste.id)
		uebernehmen(naechste)

	_blinken_aktualisieren()


## Positionen aller lebenden Gegner — als reine Werte statt Knoten, damit
## `Bewegung.naechstes_ziel` (eine reine Funktion ohne Node-Wissen) sie direkt
## verwenden kann.
func _gegnerpositionen() -> PackedVector2Array:
	var positionen := PackedVector2Array()
	for gegner in get_tree().get_nodes_in_group(&"gegner"):
		positionen.append(gegner.global_position)
	return positionen


## Sichtbares Blinken während der Unverwundbarkeit — vorher gab es dafür gar
## keine Anzeige, `ist_unverwundbar()` war reine Rechnung ohne Rückmeldung.
## Ohne sie sieht ein verschenkter Treffer während der Schutzzeit wie ein
## Fehler aus, nicht wie eine Regel.
func _blinken_aktualisieren() -> void:
	if not ist_unverwundbar():
		_anzeige.modulate.a = 1.0
		return

	var takt := int(Time.get_ticks_msec() / 1000.0 / BLINK_TAKT)
	_anzeige.modulate.a = BLINK_DECKUNG if takt % 2 == 0 else 1.0


## `ziel` ist die Weltposition des per Auto-Ziel gewählten Gegners. `null`
## heißt: kein gültiges Ziel in Reichweite — dann wird nicht geschossen, auch
## nicht in die zuletzt gelaufene Richtung. Genau das behebt „Schuss ins
## Leere": Vorher feuerte ein gehaltener Feuerknopf ohne Gegner in der Nähe
## einfach in die Laufrichtung, jetzt passiert ohne echtes Ziel gar nichts.
func _schiessen(ziel: Variant) -> void:
	if ziel == null:
		return

	var jetzt := Time.get_ticks_msec() / 1000.0
	if jetzt < _naechster_schuss:
		return
	_naechster_schuss = jetzt + effektive_schuss_pause()
	Ton.abspielen(&"schuss")

	var richtung: Vector2 = Bewegung.richtung_zu(global_position, ziel)

	var geschoss := GESCHOSS.instantiate()
	geschoss.global_position = global_position
	geschoss.starten(richtung, effektive_reichweite(), variante.farbe, effektiver_schaden())
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
	var basis := variante.tempo * Aufwertungen.tempo_faktor(_aufwertungen.get(Aufwertungen.TEMPO, 0))
	if Time.get_ticks_msec() / 1000.0 < _tempo_boost_bis:
		basis *= Powerups.TEMPO_FAKTOR
	return basis


func effektive_schuss_pause() -> float:
	var basis := variante.schuss_pause * Aufwertungen.feuerrate_faktor(_aufwertungen.get(Aufwertungen.FEUERRATE, 0))
	if Time.get_ticks_msec() / 1000.0 < _schnellfeuer_bis:
		basis *= Powerups.SCHNELLFEUER_FAKTOR
	return basis


func effektive_reichweite() -> float:
	return variante.reichweite * Aufwertungen.reichweite_faktor(_aufwertungen.get(Aufwertungen.REICHWEITE, 0))


func effektiver_schaden() -> int:
	return Aufwertungen.schaden(_aufwertungen.get(Aufwertungen.SCHADEN, 0))


func ist_unverwundbar() -> bool:
	return Time.get_ticks_msec() / 1000.0 < _unverwundbar_bis


func schaden_nehmen(menge: int = 1) -> void:
	if ist_unverwundbar() or leben <= 0:
		return

	# Ein aktiver Schild fängt genau einen Treffer ab: kein Lebensverlust,
	# aber dieselbe kurze Unverwundbarkeit wie nach einem echten Treffer —
	# sonst könnte im selben Bild sofort der nächste Schuss durchkommen und
	# der Schild wäre gegen einen dichten Schwarm wertlos.
	if _schild_aktiv:
		_schild_aktiv = false
		_unverwundbar_bis = Time.get_ticks_msec() / 1000.0 + variante.unverwundbar
		Ton.abspielen(&"schild_bricht")
		queue_redraw()
		return

	leben -= menge
	_unverwundbar_bis = Time.get_ticks_msec() / 1000.0 + variante.unverwundbar
	Ton.abspielen(&"spieler_schaden")

	getroffen.emit(leben)
	if leben <= 0:
		gestorben.emit()


## Von `Powerup._on_body_entered` aufgerufen. Tempo/Schnellfeuer setzen ihre
## Uhr auf die volle Dauer — ein zweites Einsammeln während der ersten
## Wirkung **verlängert** nicht, sondern **erneuert** nur (dieselbe Zeit ab
## jetzt), das ist die geforderte klare Stapel-Regel: nie unbegrenzt länger.
func powerup_einsammeln(art_id: StringName) -> void:
	var jetzt := Time.get_ticks_msec() / 1000.0
	match art_id:
		Powerups.SCHILD:
			_schild_aktiv = true
			queue_redraw()
		Powerups.TEMPO:
			_tempo_boost_bis = jetzt + Powerups.TEMPO_DAUER
		Powerups.SCHNELLFEUER:
			_schnellfeuer_bis = jetzt + Powerups.SCHNELLFEUER_DAUER
		_:
			push_warning("Unbekanntes Powerup: %s" % art_id)
			return

	powerup_eingesammelt.emit(art_id)


## Der Schild als sichtbarer Ring um die Trefferfläche — ohne ihn wüsste man
## nie, ob er noch aktiv ist oder gerade schon verbraucht wurde. Auf `self`
## (dem unrotierten Körper), nicht auf `_anzeige`: Der dreht sich zum
## Auto-Ziel, ein Ring soll aber ein stabiler Kreis bleiben, keine mit
## drehende Form.
func _draw() -> void:
	if _schild_aktiv:
		draw_arc(Vector2.ZERO, RADIUS + 6.0, 0.0, TAU, 32, Color(0.42, 0.74, 1.0, 0.85), 3.0, true)
