extends Node
## Simuliert eine echte Runde über mehrere Sekunden — Bewegung, Schießen,
## Gegnertod, Wellenwechsel. **Nicht Teil des Spiels**, nur zum Ansehen ohne
## Editor:
##
##     godot --headless --path . scenes/rundenprobe.tscn
##
## `pruefen.gd` prüft Momentaufnahmen; hier läuft die Zeit wirklich, damit
## sichtbar wird, was sich nur über mehrere Bilder zeigt: Läuft ein Gegner
## tatsächlich auf den Spieler zu, trifft ein Schuss, wechselt die Welle?
##
## `Spieler._physics_process` liest `Input.is_action_pressed` — das lässt
## sich ohne echtes Fenster nicht auslösen. Diese Probe schaltet den
## eingebauten Physik-Takt des Spielers deshalb ab und steuert ihn
## stattdessen selbst: auf den nächsten Gegner zu, durchgehend schießend.
## Gegner und Wellenleiter laufen unangetastet über ihren eigenen, normalen
## Takt — nur für sie gibt es ja keine Eingabe zu ersetzen.

const DAUER := 16.0

var _spieler: Spieler
var _wellenleiter: Wellenleiter
var _zeit := 0.0


func _ready() -> void:
	var haupt: Node = load("res://scenes/main.tscn").instantiate()
	add_child(haupt)
	_spieler = haupt.get_node("Spieler")
	_wellenleiter = haupt.get_node("Wellenleiter")
	_spieler.set_physics_process(false)

	print("Start: Welle %d, Spieler bei %s, Leben %d" % [
		_wellenleiter.welle, _spieler.global_position, _spieler.leben,
	])

	_wellenleiter.welle_gestartet.connect(func(w: int) -> void:
		print("[%5.2fs] Welle %d gestartet, %d Gegner unterwegs" % [
			_zeit, w, get_tree().get_nodes_in_group(&"gegner").size(),
		])
	)
	_wellenleiter.punkte_geaendert.connect(func(p: int) -> void:
		print("[%5.2fs] Gegner erlegt — %d Punkte" % [_zeit, p])
	)
	_spieler.getroffen.connect(func(leben: int) -> void:
		print("[%5.2fs] Spieler getroffen — %d Leben" % [_zeit, leben])
	)
	_spieler.gestorben.connect(func() -> void:
		print("[%5.2fs] Spieler gestorben" % _zeit)
	)


func _physics_process(delta: float) -> void:
	if _zeit >= DAUER:
		return

	_zeit += delta
	if _zeit >= DAUER:
		print("Ende nach %.1fs: Welle %d, Leben %d, Punkte %d, %d Gegner uebrig" % [
			_zeit, _wellenleiter.welle, _spieler.leben, _wellenleiter.punkte,
			get_tree().get_nodes_in_group(&"gegner").size(),
		])
		get_tree().quit()
		return

	if not is_instance_valid(_spieler) or _spieler.leben <= 0:
		return

	var gegner := get_tree().get_nodes_in_group(&"gegner")
	var richtung := Vector2.ZERO
	if not gegner.is_empty():
		var naechster: Node2D = gegner[0]
		var beste := INF
		for g in gegner:
			var d: float = _spieler.global_position.distance_to(g.global_position)
			if d < beste:
				beste = d
				naechster = g
		richtung = Bewegung.richtung_zu(_spieler.global_position, naechster.global_position)

	_spieler.velocity = richtung * _spieler.variante.tempo
	_spieler.move_and_slide()
	_spieler.global_position = Bewegung.in_arena(_spieler.global_position, _spieler.arena, Spieler.RADIUS)
	_spieler._schiessen(richtung)
