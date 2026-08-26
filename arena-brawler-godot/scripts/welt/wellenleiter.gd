class_name Wellenleiter
extends Node
## Steuert den Wellenablauf: spawnt Gegner, wartet, bis alle tot sind, meldet
## „Welle geschafft" und wartet dann auf ein äußeres Startsignal für die
## nächste. Wie viele Gegner und wie schnell — das steht in `Wellen` (reine
## Funktionen); hier steht nur die Uhr und das Zusammenspiel mit der Szene.
##
## **Startet nicht von selbst.** Ein Node unter `Main` bekäme sein `_ready()`
## vor dem von `Main` selbst (Godot ruft `_ready()` von unten nach oben auf) —
## `arena`/`spieler` wären in dem Moment noch nicht gesetzt. `Main` ruft
## deshalb `starten()` explizit auf, nachdem es beides selbst aufgebaut hat.
##
## **Schaltet nach einer geschafften Welle ebenfalls nicht von selbst weiter.**
## Früher lief hier eine feste Pause von zwei Sekunden ab; jetzt übernimmt die
## Aufwertungsauswahl in `main.gd` diese Pause (Meldung, dann drei Karten,
## dann Wahl) — die Dauer hängt jetzt davon ab, wie lange jemand zum Wählen
## braucht, nicht mehr von einer festen Zahl. `Main` ruft deshalb
## `naechste_welle_erzwingen()` auf, sobald die Wahl getroffen ist.

signal welle_gestartet(welle: int)
signal welle_geschafft(welle: int)
signal punkte_geaendert(punkte: int)

## Wird genau dann ausgelöst, wenn die Welle mit einer **anderen** Karte
## startet als die vorherige (siehe `Karten.fuer_welle`) — nicht bei jeder
## Welle, nur beim tatsächlichen Wechsel. `main.gd` hört darauf und reicht
## die neuen Hindernisse an `Arena` weiter.
signal karte_gewechselt(karte: Karten.Karte)

const GEGNER := preload("res://enemies/gegner.tscn")
const POWERUP := preload("res://scenes/powerup.tscn")
const PUNKTE_JE_GEGNER := 10

## Abstand der Spawnpunkte vom Rand — mehr als die Trefferfläche eines
## Gegners (12, siehe `gegner.tscn`), sonst spawnt er halb in der Wand.
const SPAWN_ABSTAND := 24.0

## Wie weit ein zeitgesteuertes Powerup mindestens vom Arenarand entfernt
## erscheint — großzügig, damit es nie halb hinter der Außenwand liegt.
const POWERUP_RAND_EINZUG := 80.0

var welle: int = 0
var punkte: int = 0

var _arena_flaeche: Rect2
var _spieler: Node2D
var _eltern: Node
var _laeuft := false
var _wartet_auf_naechste := false

## Leerer StringName als Startwert, keine echte Karten-Id — dadurch löst
## schon die allererste Welle einen „Wechsel" aus (auf die erste Karte),
## statt dass `Arena` ohne jede Hindernis-Zuweisung bliebe.
var _aktuelle_karte_id: StringName = &""

## Absoluter Zeitpunkt (`Time.get_ticks_msec()/1000.0`), ab dem ein
## zeitgesteuertes Powerup fällig ist, sofern gerade keins auf dem Feld
## liegt. Gesetzt in `starten()`, nicht schon als Feld-Startwert — Wellen
## laufen sonst mit „0" los, und ein Powerup erschiene sofort in Welle 1,
## noch bevor überhaupt ein Gegner tot ist.
var _naechstes_zeitgesteuertes_powerup: float = 0.0


## `eltern` ist der Knoten, unter dem gespawnte Gegner landen — nicht `self`:
## Ein pausierter oder entfernter Wellenleiter soll seine Gegner nicht mit
## sich reißen. Dieselbe Überlegung wie bei `Spieler._schiessen`, das seine
## Geschosse ebenfalls an den Elternknoten hängt.
func starten(arena_flaeche: Rect2, spieler: Node2D, eltern: Node) -> void:
	_arena_flaeche = arena_flaeche
	_spieler = spieler
	_eltern = eltern
	_laeuft = true
	_naechstes_zeitgesteuertes_powerup = Time.get_ticks_msec() / 1000.0 + Powerups.ZEITGESTEUERT_ALLE_SEKUNDEN
	_naechste_welle_starten()


## Vom Rundenende aufgerufen: keine neuen Wellen mehr, aber bestehende Gegner
## bleiben stehen, wo sie sind — sie werden gleich sowieso eingefroren
## (`Main` pausiert den ganzen Baum), ein Wegräumen hier wäre doppelte Arbeit.
func anhalten() -> void:
	_laeuft = false


## Von `Main` aufgerufen, nachdem die „Welle geschafft"-Meldung und die
## Aufwertungsauswahl durch sind. Kein automatischer Weg dorthin: Der Spieler
## soll so lange wählen dürfen, wie er möchte, nicht so lange, wie eine feste
## Uhr erlaubt.
func naechste_welle_erzwingen() -> void:
	if not _laeuft:
		return
	_wartet_auf_naechste = false
	_naechste_welle_starten()


func _process(_delta: float) -> void:
	if not _laeuft:
		return

	if not _wartet_auf_naechste and get_tree().get_nodes_in_group(&"gegner").is_empty():
		_wartet_auf_naechste = true
		welle_geschafft.emit(welle)

	_powerup_zeitgesteuert_pruefen()


func _naechste_welle_starten() -> void:
	welle += 1

	var karte := Karten.fuer_welle(welle)
	if karte.id != _aktuelle_karte_id:
		_aktuelle_karte_id = karte.id
		karte_gewechselt.emit(karte)

	var anzahl := Wellen.gegner_fuer_welle(welle)
	var tempo_faktor := Wellen.tempo_faktor_fuer_welle(welle)
	var gewichte := Wellen.gegnertyp_gewichte_fuer_welle(welle)

	for _i in anzahl:
		var punkt := Wellen.punkt_am_rand(_arena_flaeche, randf(), SPAWN_ABSTAND)
		var art := Gegnertypen.nach_id(Wellen.gegnertyp_auswaehlen(gewichte, randf()))

		var g: Gegner = GEGNER.instantiate()
		g.ziel = _spieler
		g.hindernisse = karte.hindernisse
		g.gestorben.connect(_gegner_gestorben)
		_eltern.add_child(g)
		# Erst nach add_child: einrichten() braucht die @onready-Felder des
		# Gegners (Kollisionsform, Anzeige), die gibt es erst, sobald der
		# Knoten im Baum hängt.
		g.einrichten(art, tempo_faktor)
		g.global_position = punkt

	welle_gestartet.emit(welle)


func _gegner_gestorben(position: Vector2) -> void:
	punkte += PUNKTE_JE_GEGNER
	punkte_geaendert.emit(punkte)

	# Selten, und nur, wenn gerade keins auf dem Feld liegt — „nicht spam"
	# ist eine ausdrückliche Vorgabe. Genau an der Todesstelle: Ein Powerup,
	# das aus dem gerade Erlegten „herausfällt", liest sich als Belohnung für
	# den Treffer, nicht als beliebiger Fund irgendwo im Feld.
	if get_tree().get_nodes_in_group(&"powerup").is_empty() and randf() < Powerups.DROP_CHANCE:
		_powerup_erzeugen(position)


## Zeitgesteuerter Nachschub, falls lange keiner gefallen ist — greift nur,
## wenn gerade keins auf dem Feld liegt, aus demselben Grund wie oben.
func _powerup_zeitgesteuert_pruefen() -> void:
	if Time.get_ticks_msec() / 1000.0 < _naechstes_zeitgesteuertes_powerup:
		return
	# Auch ohne Spawn die Uhr weiterstellen, sonst würde bei einem dauerhaft
	# belegten Feld (ein Powerup liegt lange ungenutzt) jedes einzelne Bild
	# erneut geprüft, statt bis zum nächsten fälligen Zeitpunkt zu warten.
	_naechstes_zeitgesteuertes_powerup = Time.get_ticks_msec() / 1000.0 + Powerups.ZEITGESTEUERT_ALLE_SEKUNDEN

	if not get_tree().get_nodes_in_group(&"powerup").is_empty():
		return

	_powerup_erzeugen(_zufaelliger_offener_punkt())


## `call_deferred`, nicht direkt aufgerufen: Der gefährliche Aufrufpfad ist
## `_gegner_gestorben`, das seinerseits aus `Geschoss._on_body_entered`
## stammt — einem Physik-Signal, das **mitten in einer laufenden
## Kollisionsabfrage** feuert. Ein brandneues, überwachendes `Area2D`
## (`Powerup`) synchron per `add_child` in genau diesem Moment einzuhängen,
## meldet real dieselbe Physik-Fehlermeldung wie ein synchrones
## `queue_free()`: „Can't change this state while flushing queries" — nur
## beim **Hinzufügen** statt beim Entfernen einer überwachenden Fläche. Drei
## andere Stellen (beide `queue_free()` bei Treffern, siehe `geschoss.gd`
## und `powerup.gd`) wurden aus demselben Grund schon aufgeschoben; diese
## vierte, das eigentliche Neuanlegen, war der tatsächliche Auslöser — real
## bestätigt, weil der Fehler nach den ersten drei Korrekturen weiterhin
## auftrat und erst mit dieser vierten verschwand.
func _powerup_erzeugen(position: Vector2) -> void:
	call_deferred(&"_powerup_erzeugen_jetzt", position)


func _powerup_erzeugen_jetzt(position: Vector2) -> void:
	var p: Powerup = POWERUP.instantiate()
	_eltern.add_child(p)
	p.einrichten(Powerups.zufaellige_art(randf()))
	p.global_position = position


## Ein zufälliger Punkt gut innerhalb der Arena, aus jedem Hindernis der
## aktuellen Karte herausgeschoben (`Bewegung.aus_hindernissen_geschoben`,
## derselbe Kniff wie beim Spieler nach einem Kartenwechsel) — ein Powerup
## soll nie halb in einer Wand liegen.
func _zufaelliger_offener_punkt() -> Vector2:
	var einzug := POWERUP_RAND_EINZUG
	var punkt := Vector2(
		randf_range(_arena_flaeche.position.x + einzug, _arena_flaeche.end.x - einzug),
		randf_range(_arena_flaeche.position.y + einzug, _arena_flaeche.end.y - einzug),
	)
	return Bewegung.aus_hindernissen_geschoben(punkt, Karten.fuer_welle(welle).hindernisse, 20.0)
