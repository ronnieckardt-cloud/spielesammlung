extends Node
## Simuliert eine echte Runde über mehrere Sekunden — Bewegung, Schießen,
## Gegnertod, Wellenwechsel, Aufwertungsauswahl. **Nicht Teil des Spiels**,
## nur zum Ansehen ohne Editor:
##
##     godot --headless --path . scenes/rundenprobe.tscn
##
## `pruefen.gd` prüft Momentaufnahmen; hier läuft die Zeit wirklich, damit
## sichtbar wird, was sich nur über mehrere Bilder zeigt: Läuft ein Gegner
## tatsächlich auf den Spieler zu, trifft ein Schuss, wechselt die Welle,
## wirkt eine gewählte Aufwertung wirklich am Spieler?
##
## `Spieler._physics_process` liest `Input.is_action_pressed` — das lässt
## sich ohne echtes Fenster nicht auslösen. Diese Probe schaltet den
## eingebauten Physik-Takt des Spielers deshalb ab und steuert ihn
## stattdessen selbst: auf den nächsten Gegner zu, durchgehend schießend.
## Gegner und Wellenleiter laufen unangetastet über ihren eigenen, normalen
## Takt — nur für sie gibt es ja keine Eingabe zu ersetzen.
##
## Die Aufwertungsauswahl läuft ebenfalls **echt**: `main.gd` pausiert den
## Baum, zeigt die Meldung, zeigt die Karten — diese Probe wartet einfach
## lange genug und tippt dann die erste an (`Aufwertungsauswahl._bei_druck`
## direkt aufgerufen, so wie ein Tippen auf die echte Fläche es auslöste).
## Das funktioniert auch während der Pause, weil es über ein Signal und
## einen `SceneTreeTimer` läuft, nicht über einen eigenen `_process` — siehe
## den langen Kommentar dazu in `main.gd`.
##
## Die Charakterauswahl vor der ersten Welle läuft genauso echt und braucht
## deshalb denselben Kniff, nur ohne Wartezeit — die Karten stehen schon
## beim Laden da, es gibt keine Meldung davor abzuwarten. Ohne diesen Tipp
## bliebe der Baum für die ganze Probe pausiert und nichts würde sich
## bewegen.

const DAUER := 30.0
const AUFWERTUNG_WARTEZEIT := 1.6  ## etwas mehr als WELLENMELDUNG_DAUER in main.gd

var _spieler: Spieler
var _wellenleiter: Wellenleiter
var _aufwertungsauswahl: Aufwertungsauswahl
var _zeit := 0.0


func _ready() -> void:
	var haupt: Node = load("res://scenes/main.tscn").instantiate()
	add_child(haupt)
	_spieler = haupt.get_node("Spieler")
	_wellenleiter = haupt.get_node("Wellenleiter")
	_aufwertungsauswahl = haupt.get_node("Oberflaeche/Aufwertungsauswahl")
	_spieler.set_physics_process(false)

	var charakterauswahl: Charakterauswahl = haupt.get_node("Oberflaeche/Charakterauswahl")
	charakterauswahl._bei_druck(Spielstand.charakter_id)
	print("Charakter gewaehlt: %s" % Spielstand.charakter_id)

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
	_wellenleiter.welle_geschafft.connect(_welle_geschafft)
	_spieler.getroffen.connect(func(leben: int) -> void:
		print("[%5.2fs] Spieler getroffen — %d Leben" % [_zeit, leben])
	)
	_spieler.gestorben.connect(func() -> void:
		# Nach dem Tod pausiert `main.gd` den Baum dauerhaft, bis jemand
		# tippt (siehe `Rundenende`) — hier tippt niemand, also müsste die
		# Probe sonst bis zum äußeren Zeitlimit hängen bleiben. Eigenes Ende
		# statt auf `DAUER` zu warten, das durch die Pause ohnehin nie
		# erreicht würde.
		print("[%5.2fs] Spieler gestorben — Welle %d, %d Punkte" % [
			_zeit, _wellenleiter.welle, _wellenleiter.punkte,
		])
		get_tree().quit()
	)


## Wartet, bis `main.gd` die Meldung gezeigt und die Karten aufgebaut hat,
## und tippt dann die erste an — ein echter Spieler würde eine davon wählen,
## welche ist für die Probe zweitrangig.
func _welle_geschafft(welle: int) -> void:
	print("[%5.2fs] Welle %d geschafft!" % [_zeit, welle])
	await get_tree().create_timer(AUFWERTUNG_WARTEZEIT).timeout

	if not is_instance_valid(_aufwertungsauswahl) or not _aufwertungsauswahl.visible:
		print("[%5.2fs] (keine Karten sichtbar — Runde wohl inzwischen vorbei)" % _zeit)
		return

	var gewaehlte := _aufwertungsauswahl._angebotene_arten[0]
	_aufwertungsauswahl._bei_druck(0)
	print("[%5.2fs] Aufwertung gewaehlt: %s -> Tempo %.0f, Schusspause %.2fs, Reichweite %.0f, Schaden %d" % [
		_zeit, gewaehlte.titel,
		_spieler.effektives_tempo(), _spieler.effektive_schuss_pause(),
		_spieler.effektive_reichweite(), _spieler.effektiver_schaden(),
	])


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
		# Zum nächsten Gegner hinlaufen, ganz gleich wie weit weg — sonst
		# bliebe die Probe bei einem gerade erst gespawnten, noch fernen
		# Gegner einfach stehen. Über Hindernisse hinweg lenken, aus
		# demselben Grund wie bei einem echten Gegner (siehe
		# `Bewegung.richtung_um_hindernisse`) — sonst bliebe die Probe selbst
		# an der Kreuz-Karte stecken, nicht nur die Gegner.
		var naechster: Node2D = gegner[0]
		var beste := INF
		for g in gegner:
			var d: float = _spieler.global_position.distance_to(g.global_position)
			if d < beste:
				beste = d
				naechster = g
		var hindernisse := Karten.fuer_welle(_wellenleiter.welle).hindernisse
		richtung = Bewegung.richtung_um_hindernisse(
			_spieler.global_position, naechster.global_position, hindernisse, 55.0, Spieler.RADIUS,
		)

	_spieler.velocity = richtung * _spieler.effektives_tempo()
	_spieler.move_and_slide()
	_spieler.global_position = Bewegung.in_arena(_spieler.global_position, _spieler.arena, Spieler.RADIUS)

	# Schießen läuft über dieselbe Auto-Ziel-Funktion wie das echte Spiel —
	# nur *in* Reichweite wird wirklich geschossen, auch wenn die Probe
	# gerade auf einen noch fernen Gegner zuläuft.
	var positionen := PackedVector2Array()
	for g in gegner:
		positionen.append(g.global_position)
	var ziel: Variant = Bewegung.naechstes_ziel(
		_spieler.global_position, positionen, _spieler.effektive_reichweite(),
	)
	_spieler._schiessen(ziel)
