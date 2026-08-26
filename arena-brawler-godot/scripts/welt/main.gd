extends Node2D
## Hauptszene: setzt Arena, Spieler, Wellenleiter und Kamera zusammen.
##
## Hier steht nur das Zusammenstecken. Wie sich der Spieler bewegt, weiß der
## Spieler; wie viele Gegner eine Welle hat, weiß `Wellen`; wann eine Runde
## vorbei ist, weiß niemand außer dieser Datei — das ist der eine Punkt, an
## dem alle drei zusammenlaufen müssen, und deshalb gehört er hierher und
## nirgendwo sonst hin.

@onready var _arena: Arena = $Arena
@onready var _spieler: Spieler = $Spieler
@onready var _kamera: Camera2D = $Spieler/Kamera
@onready var _wellenleiter: Wellenleiter = $Wellenleiter
@onready var _kopfzeile: Label = $Oberflaeche/Kopfzeile
@onready var _rundenende: Control = $Oberflaeche/Rundenende
@onready var _rundenende_text: Label = $Oberflaeche/Rundenende/Text

var _vorbei := false


func _ready() -> void:
	# Läuft immer weiter, auch wenn der Baum gleich pausiert wird (siehe
	# `_runde_beenden`) — sonst käme der Neustart-Tipp gar nicht mehr an.
	process_mode = Node.PROCESS_MODE_ALWAYS

	_spieler.uebernehmen(Spielstand.charakter())
	_spieler.arena = _arena.flaeche()
	_spieler.global_position = _arena.flaeche().get_center()

	# Die Kamera darf nicht über den Rand hinausfahren, sonst schaut man ins
	# Leere neben der Arena. Die Grenzen kommen aus der Arena selbst, damit sie
	# beim Ändern ihrer Größe nicht nachgezogen werden müssen.
	var flaeche := _arena.flaeche()
	_kamera.limit_left = int(flaeche.position.x)
	_kamera.limit_top = int(flaeche.position.y)
	_kamera.limit_right = int(flaeche.end.x)
	_kamera.limit_bottom = int(flaeche.end.y)

	_spieler.getroffen.connect(_kopfzeile_setzen.unbind(1))
	_spieler.gestorben.connect(_runde_beenden)
	Spielstand.charakter_gewechselt.connect(_kopfzeile_setzen.unbind(1))

	_wellenleiter.welle_gestartet.connect(_kopfzeile_setzen.unbind(1))
	# `starten()` statt eines eigenen `_ready()` im Wellenleiter: Der säße
	# unter `Main` und liefe damit **vor** diesem `_ready()` (Godot ruft von
	# unten nach oben auf) — Arena und Spieler wären in dem Moment noch nicht
	# gesetzt. Explizit aufrufen umgeht die Reihenfolge komplett.
	_wellenleiter.starten(flaeche, _spieler, self)

	_kopfzeile_setzen()


func _kopfzeile_setzen() -> void:
	_kopfzeile.text = "Leben: %d    Welle: %d" % [_spieler.leben, _wellenleiter.welle]


func _unhandled_input(event: InputEvent) -> void:
	if not _vorbei:
		return

	var neustart: bool = (
		(event is InputEventKey and event.pressed)
		or (event is InputEventMouseButton and event.pressed)
		or (event is InputEventScreenTouch and event.pressed)
	)
	if neustart:
		get_tree().paused = false
		get_tree().reload_current_scene()


func _runde_beenden() -> void:
	if _vorbei:
		return
	_vorbei = true

	_wellenleiter.anhalten()

	var rekord := Spielstand.runde_melden(_wellenleiter.punkte, _wellenleiter.welle)
	_rundenende_text.text = "Vorbei\n\n%d Punkte · Welle %d\n%s\n\nTaste oder Bildschirm antippen" % [
		_wellenleiter.punkte,
		_wellenleiter.welle,
		"🏆 Neuer Rekord!" if rekord else Spielstand.rekord_zeile(),
	]
	_rundenende.visible = true

	# Friert Spieler, Gegner, Geschosse und den Wellenleiter mit einer
	# einzigen Zeile ein, statt jedes System einzeln anzuhalten — `Main`
	# selbst läuft dank `PROCESS_MODE_ALWAYS` oben trotzdem weiter.
	get_tree().paused = true
