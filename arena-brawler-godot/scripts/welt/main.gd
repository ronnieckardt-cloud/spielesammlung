extends Node2D
## Hauptszene: setzt Arena, Spieler und Kamera zusammen.
##
## Hier steht nur das Zusammenstecken. Wie sich der Spieler bewegt, weiß der
## Spieler; wie groß die Arena ist, weiß die Arena. Diese Datei kennt beide,
## aber keine ihrer Rechnungen — sonst wandert Logik dorthin, wo sie am
## schwersten zu prüfen ist.

@onready var _arena: Arena = $Arena
@onready var _spieler: Spieler = $Spieler
@onready var _kamera: Camera2D = $Spieler/Kamera
@onready var _kopfzeile: Label = $Oberflaeche/Kopfzeile


func _ready() -> void:
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
	Spielstand.charakter_gewechselt.connect(_kopfzeile_setzen.unbind(1))
	_kopfzeile_setzen()


func _kopfzeile_setzen() -> void:
	_kopfzeile.text = "%s · %d Leben    [Tab] Charakter wechseln    %s" % [
		_spieler.variante.name,
		_spieler.leben,
		Spielstand.rekord_zeile(),
	]
