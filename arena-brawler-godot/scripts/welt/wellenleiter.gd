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

const GEGNER := preload("res://enemies/gegner.tscn")
const PUNKTE_JE_GEGNER := 10

## Abstand der Spawnpunkte vom Rand — mehr als die Trefferfläche eines
## Gegners (12, siehe `gegner.tscn`), sonst spawnt er halb in der Wand.
const SPAWN_ABSTAND := 24.0

var welle: int = 0
var punkte: int = 0

var _arena_flaeche: Rect2
var _spieler: Node2D
var _eltern: Node
var _laeuft := false
var _wartet_auf_naechste := false


## `eltern` ist der Knoten, unter dem gespawnte Gegner landen — nicht `self`:
## Ein pausierter oder entfernter Wellenleiter soll seine Gegner nicht mit
## sich reißen. Dieselbe Überlegung wie bei `Spieler._schiessen`, das seine
## Geschosse ebenfalls an den Elternknoten hängt.
func starten(arena_flaeche: Rect2, spieler: Node2D, eltern: Node) -> void:
	_arena_flaeche = arena_flaeche
	_spieler = spieler
	_eltern = eltern
	_laeuft = true
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
	if not _laeuft or _wartet_auf_naechste:
		return

	if get_tree().get_nodes_in_group(&"gegner").is_empty():
		_wartet_auf_naechste = true
		welle_geschafft.emit(welle)


func _naechste_welle_starten() -> void:
	welle += 1
	var anzahl := Wellen.gegner_fuer_welle(welle)
	var tempo_faktor := Wellen.tempo_faktor_fuer_welle(welle)
	var gewichte := Wellen.gegnertyp_gewichte_fuer_welle(welle)

	for _i in anzahl:
		var punkt := Wellen.punkt_am_rand(_arena_flaeche, randf(), SPAWN_ABSTAND)
		var art := Gegnertypen.nach_id(Wellen.gegnertyp_auswaehlen(gewichte, randf()))

		var g: Gegner = GEGNER.instantiate()
		g.ziel = _spieler
		g.gestorben.connect(_gegner_gestorben)
		_eltern.add_child(g)
		# Erst nach add_child: einrichten() braucht die @onready-Felder des
		# Gegners (Kollisionsform, Anzeige), die gibt es erst, sobald der
		# Knoten im Baum hängt.
		g.einrichten(art, tempo_faktor)
		g.global_position = punkt

	welle_gestartet.emit(welle)


func _gegner_gestorben() -> void:
	punkte += PUNKTE_JE_GEGNER
	punkte_geaendert.emit(punkte)
