extends Node2D
## Hauptszene: setzt Arena, Spieler, Wellenleiter und Kamera zusammen, und
## steuert den Ablauf zwischen den Wellen.
##
## Hier steht nur das Zusammenstecken. Wie sich der Spieler bewegt, weiß der
## Spieler; wie viele Gegner eine Welle hat, weiß `Wellen`; was eine
## Aufwertung bewirkt, weiß `Aufwertungen`. Wann eine Welle geschafft ist und
## was dann passiert — Meldung, Karten, weiter —, weiß niemand außer dieser
## Datei, und deshalb gehört es hierher und nirgendwo sonst hin.
##
## **`Main` selbst bekommt kein `PROCESS_MODE_ALWAYS`.** Das säße als
## Vorfahre über allem — Spieler, Gegner, Geschosse eingeschlossen — und die
## würden eine Pause dann einfach mit erben und weiterlaufen. Die zwei
## Stellen, die während der Pause trotzdem reagieren müssen (Rundenende-Tipp,
## Aufwertungskarten), liegen deshalb unter `Oberflaeche`, die in `main.tscn`
## selbst `ALWAYS` bekommt — nur ihre reinen Anzeige-Kinder erben das mit,
## keine einzige Spielfigur hängt dort. Der Rest hier läuft trotzdem weiter,
## wo nötig: `await`s auf ein Signal oder einen Timer werden von der
## Signalquelle wachgerufen, nicht von einem eigenen `_process` — dafür
## braucht `Main` selbst also gar kein `ALWAYS`.
##
## **`Touchsteuerung` (Stick, Feuerknopf) liegt genau umgekehrt: bewusst
## nicht unter `Oberflaeche`, sondern als eigener Geschwisterknoten ohne
## `ALWAYS`.** Sie soll während der Pause ja gerade **nicht** reagieren.
## `_pause_setzen()` ist deshalb der einzige Ort, der `get_tree().paused`
## setzt — er blendet die Touch-Steuerung im selben Zug aus, sonst stünde
## sie sichtbar, aber tot da.

## Wie lange „Welle X geschafft!" steht, bevor die Karten kommen.
const WELLENMELDUNG_DAUER := 1.3

@onready var _arena: Arena = $Arena
@onready var _spieler: Spieler = $Spieler
@onready var _kamera: Camera2D = $Spieler/Kamera
@onready var _wellenleiter: Wellenleiter = $Wellenleiter
@onready var _kopfzeile: Label = $Oberflaeche/Kopfzeile
@onready var _wellenmeldung: Label = $Oberflaeche/Wellenmeldung
@onready var _rundenende: Rundenende = $Oberflaeche/Rundenende
@onready var _rundenende_stats: Label = $Oberflaeche/Rundenende/Karte/Stats
@onready var _rundenende_rekord: Label = $Oberflaeche/Rundenende/Karte/Rekord
@onready var _aufwertungsauswahl: Aufwertungsauswahl = $Oberflaeche/Aufwertungsauswahl
@onready var _charakterauswahl: Charakterauswahl = $Oberflaeche/Charakterauswahl
@onready var _touchsteuerung: Touchsteuerung = $Touchsteuerung

var _vorbei := false
var _flaeche: Rect2


func _ready() -> void:
	_spieler.uebernehmen(Spielstand.charakter())
	_spieler.arena = _arena.flaeche()
	_spieler.global_position = _arena.flaeche().get_center()

	# Die Kamera darf nicht über den Rand hinausfahren, sonst schaut man ins
	# Leere neben der Arena. Die Grenzen kommen aus der Arena selbst, damit sie
	# beim Ändern ihrer Größe nicht nachgezogen werden müssen. `_flaeche` ist
	# ein Feld statt einer lokalen Variable, weil `_charakter_gewaehlt()` sie
	# erst nach der Wahl braucht, deutlich später als dieses `_ready()`.
	_flaeche = _arena.flaeche()
	_kamera.limit_left = int(_flaeche.position.x)
	_kamera.limit_top = int(_flaeche.position.y)
	_kamera.limit_right = int(_flaeche.end.x)
	_kamera.limit_bottom = int(_flaeche.end.y)

	_spieler.getroffen.connect(_kopfzeile_setzen.unbind(1))
	_spieler.gestorben.connect(_runde_beenden)
	Spielstand.charakter_gewechselt.connect(_kopfzeile_setzen.unbind(1))

	_wellenleiter.welle_gestartet.connect(_kopfzeile_setzen.unbind(1))
	_wellenleiter.welle_geschafft.connect(_welle_geschafft)
	_wellenleiter.punkte_geaendert.connect(_kopfzeile_setzen.unbind(1))
	_aufwertungsauswahl.gewaehlt.connect(_aufwertung_gewaehlt)
	_rundenende.neustart_angefordert.connect(_neustart)
	_charakterauswahl.gewaehlt.connect(_charakter_gewaehlt)

	_kopfzeile_setzen()

	# Die Auswahl steht vor jeder Welle, auch der ersten — `starten()` beim
	# Wellenleiter ruft erst `_charakter_gewaehlt()` auf, siehe dort. Bis
	# dahin bleibt alles andere (Wellenleiter, Gegner, Schüsse) stehen,
	# genau wie zwischen zwei Wellen bei der Aufwertungsauswahl.
	_charakterauswahl.zeigen()
	_pause_setzen(true)


func _kopfzeile_setzen() -> void:
	_kopfzeile.text = "Leben %d  ·  Welle %d  ·  %d Punkte" % [
		_spieler.leben, _wellenleiter.welle, _wellenleiter.punkte,
	]


## Einziger Ort, der `get_tree().paused` setzt — der Touch-Steuerung muss
## dabei jedes Mal mitgeteilt werden, sonst bleibt Stick/Feuerknopf sichtbar
## stehen, obwohl sie während der Pause gar nicht mehr reagieren (siehe
## `Touchsteuerung`). Ein eigener Helfer statt fünf einzelner Zuweisungen,
## die man beim nächsten Pause-Zustand leicht vergisst, eine davon
## nachzuziehen.
func _pause_setzen(pausiert: bool) -> void:
	get_tree().paused = pausiert
	_touchsteuerung.pause_setzen(pausiert)


## Von `Charakterauswahl.gewaehlt` aufgerufen — wendet die Wahl an und startet
## erst jetzt die erste Welle. `starten()` statt eines eigenen `_ready()` im
## Wellenleiter: Der säße unter `Main` und liefe damit **vor** diesem
## `_ready()` (Godot ruft von unten nach oben auf) — Arena und Spieler wären
## in dem Moment noch nicht gesetzt. Explizit aufrufen umgeht die Reihenfolge
## komplett, und hier zusätzlich erst nach der Wahl statt gleich beim Laden.
func _charakter_gewaehlt(charakter_id: StringName) -> void:
	Spielstand.charakter_setzen(charakter_id)
	_spieler.uebernehmen(Spielstand.charakter())
	_kopfzeile_setzen()

	_pause_setzen(false)
	_wellenleiter.starten(_flaeche, _spieler, self)


## Kurze Meldung, dann die drei Karten — dazwischen ist das ganze Spiel
## pausiert (siehe Kommentar oben zu `process_mode`). Läuft über `await`,
## nicht über einen eigenen `_process`: Das funktioniert unabhängig vom
## `process_mode` dieses Knotens, weil ein `SceneTreeTimer` per Voreinstellung
## selbst während der Pause weiterläuft (`process_always` ist dort `true`).
func _welle_geschafft(welle: int) -> void:
	if _vorbei:
		return

	_pause_setzen(true)

	_wellenmeldung.text = "Welle %d geschafft!" % welle
	_wellenmeldung.visible = true
	await get_tree().create_timer(WELLENMELDUNG_DAUER).timeout
	_wellenmeldung.visible = false

	if _vorbei:
		return
	_aufwertungsauswahl.zeigen(_spieler)


func _aufwertung_gewaehlt(art_id: StringName) -> void:
	_spieler.aufwertung_anwenden(art_id)
	_kopfzeile_setzen()

	_pause_setzen(false)
	_wellenleiter.naechste_welle_erzwingen()


func _neustart() -> void:
	_pause_setzen(false)
	get_tree().reload_current_scene()


func _runde_beenden() -> void:
	if _vorbei:
		return
	_vorbei = true

	_wellenleiter.anhalten()
	_wellenmeldung.visible = false

	var rekord := Spielstand.runde_melden(_wellenleiter.punkte, _wellenleiter.welle)
	_rundenende_stats.text = "%d Punkte · Welle %d" % [_wellenleiter.punkte, _wellenleiter.welle]
	_rundenende_rekord.text = "🏆 Neuer Rekord!" if rekord else Spielstand.rekord_zeile()
	_rundenende.visible = true

	# Friert Spieler, Gegner, Geschosse und den Wellenleiter mit einer
	# einzigen Zeile ein, statt jedes System einzeln anzuhalten.
	_pause_setzen(true)
