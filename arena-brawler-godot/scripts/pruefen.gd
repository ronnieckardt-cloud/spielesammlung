extends Node
## Prüfszene für die reinen Rechenteile. Nicht Teil des Spiels.
##
## Aufruf:
##     godot --headless --path . scenes/pruefen.tscn
##
## Sie läuft als eigene Szene und nicht über `--script`, weil sie die Autoloads
## braucht — die richtet Godot nur für eine laufende Szene ein.
##
## Warum überhaupt: `Bewegung` und die Charakterwerte entscheiden darüber, ob
## sich das Spiel richtig anfühlt. Ein Vorzeichenfehler beim Normieren merkt man
## sonst erst als „schräg läuft man schneller", und dann sucht man lange.

var _berichte: Array[String] = []


func _ready() -> void:
	_pruefe_bewegung()
	_pruefe_charaktere()
	_pruefe_spielstand()
	_pruefe_szenen()

	var durchgefallen := _berichte.filter(func(z: String) -> bool: return z.begins_with("FEHL"))
	for zeile in _berichte:
		print(zeile)
	print("\n%d von %d Prüfungen bestanden." % [_berichte.size() - durchgefallen.size(), _berichte.size()])

	get_tree().quit(1 if durchgefallen.size() > 0 else 0)


func _pruefe(name: String, ist: Variant, soll: Variant) -> void:
	var ok := str(ist) == str(soll)
	_berichte.append("%s %s: %s%s" % [
		"OK  " if ok else "FEHL", name, str(ist),
		"" if ok else "  (erwartet %s)" % str(soll),
	])


func _pruefe_wahr(name: String, ist: bool) -> void:
	_pruefe(name, ist, true)


func _pruefe_bewegung() -> void:
	_pruefe("keine Taste ergibt Stillstand",
		Bewegung.richtung_aus_tasten(false, false, false, false), Vector2.ZERO)
	_pruefe("rechts",
		Bewegung.richtung_aus_tasten(false, true, false, false), Vector2.RIGHT)
	_pruefe("links und rechts heben sich auf",
		Bewegung.richtung_aus_tasten(true, true, false, false), Vector2.ZERO)

	# Der eigentliche Prüfstein: Diagonal darf nicht schneller sein.
	var schraeg := Bewegung.richtung_aus_tasten(false, true, false, true)
	_pruefe_wahr("diagonal ist genauso schnell wie geradeaus",
		absf(schraeg.length() - 1.0) < 0.0001)

	# Stick
	_pruefe("Stick in der Totzone ist still",
		Bewegung.richtung_aus_stick(Vector2(4, 0), 70.0), Vector2.ZERO)
	_pruefe_wahr("Stick bei vollem Ausschlag liefert Laenge 1",
		absf(Bewegung.richtung_aus_stick(Vector2(70, 0), 70.0).length() - 1.0) < 0.0001)
	_pruefe_wahr("Stick erreicht volles Tempo schon bei 70 Prozent",
		absf(Bewegung.richtung_aus_stick(Vector2(49, 0), 70.0).length() - 1.0) < 0.0001)
	_pruefe_wahr("Stick unter 70 Prozent laeuft langsamer",
		Bewegung.richtung_aus_stick(Vector2(25, 0), 70.0).length() < 0.95)

	# Arena-Grenze
	var arena := Rect2(Vector2.ZERO, Vector2(1152, 648))
	_pruefe("weit ausserhalb wird zurueckgeholt",
		Bewegung.in_arena(Vector2(-500, 5000), arena, 16.0), Vector2(16, 632))
	_pruefe("innen bleibt unveraendert",
		Bewegung.in_arena(Vector2(500, 300), arena, 16.0), Vector2(500, 300))

	# Zielsuche
	var ziele := PackedVector2Array([Vector2(100, 0), Vector2(300, 0)])
	_pruefe("das naechste Ziel gewinnt",
		Bewegung.naechstes_ziel(Vector2.ZERO, ziele, 460.0), Vector2(100, 0))
	_pruefe("ausser Reichweite gibt es kein Ziel",
		Bewegung.naechstes_ziel(Vector2.ZERO, ziele, 50.0), null)
	_pruefe("ohne Ziele gibt es kein Ziel",
		Bewegung.naechstes_ziel(Vector2.ZERO, PackedVector2Array(), 460.0), null)


func _pruefe_charaktere() -> void:
	_pruefe("drei Varianten", Charaktere.liste.size(), 3)
	_pruefe("Standard ist der Ausgewogene", Charaktere.standard().id, &"ausgewogen")
	_pruefe("unbekannte Kennung ergibt null", Charaktere.nach_id(&"gibtsnicht"), null)

	var leben: Array[int] = []
	var tempo: Array[float] = []
	for v in Charaktere.liste:
		leben.append(v.leben)
		tempo.append(v.tempo)
	_pruefe("Leben je Variante", leben, [5, 4, 7])

	# Die Werte muessen sich spuerbar unterscheiden, sonst ist die Wahl Deko.
	tempo.sort()
	_pruefe_wahr("Tempo unterscheidet sich um mindestens 15 Prozent",
		tempo[1] / tempo[0] > 1.15 and tempo[2] / tempo[1] > 1.15)

	# Rundlauf beim Durchschalten
	_pruefe("naechste nach ausgewogen", Charaktere.naechste(&"ausgewogen").id, &"schnell")
	_pruefe("naechste nach tank faengt vorne an", Charaktere.naechste(&"tank").id, &"ausgewogen")


func _pruefe_spielstand() -> void:
	var punkte_vorher := Spielstand.beste_punkte
	var welle_vorher := Spielstand.beste_welle

	Spielstand.beste_punkte = 0
	Spielstand.beste_welle = 0

	_pruefe("erster Lauf ist ein Rekord", Spielstand.runde_melden(300, 2), true)
	_pruefe("schwaecherer Lauf ist keiner", Spielstand.runde_melden(100, 1), false)
	_pruefe("Bestwert bleibt stehen", [Spielstand.beste_punkte, Spielstand.beste_welle], [300, 2])

	# Punkte und Welle zaehlen getrennt: gleiche Welle, mehr Gegner erwischt.
	_pruefe("Punkterekord ohne Wellenrekord", Spielstand.runde_melden(500, 2), true)
	_pruefe("je Feld bleibt der bessere Wert",
		[Spielstand.beste_punkte, Spielstand.beste_welle], [500, 2])

	# Ein unbekannter Charakter darf den gesetzten nicht kaputt machen — sonst
	# steht nach einem alten Spielstand plötzlich `null` im Spieler.
	var merk := Spielstand.charakter_id
	Spielstand.charakter_setzen(&"gibtsnicht")
	_pruefe("unbekannter Charakter wird abgelehnt", Spielstand.charakter_id, merk)
	_pruefe_wahr("und der gesetzte bleibt gueltig", Spielstand.charakter() != null)
	Spielstand.charakter_setzen(merk)

	Spielstand.beste_punkte = punkte_vorher
	Spielstand.beste_welle = welle_vorher


## Rauchprobe an den echten Szenen: Bauen sie sich zusammen, hängen die Knoten
## richtig, bekommt der Spieler seine Arena?
##
## Reine Rechnung zu prüfen reicht nicht — die häufigste Art, ein Godot-Projekt
## kaputtzumachen, ist ein Knotenpfad, der nicht mehr stimmt. Das fällt sonst
## erst beim Starten auf, und dann steht man vor einer leeren Szene.
func _pruefe_szenen() -> void:
	var haupt: Node = load("res://scenes/main.tscn").instantiate()
	add_child(haupt)

	var spieler: Node = haupt.get_node_or_null("Spieler")
	var arena: Node = haupt.get_node_or_null("Arena")
	var kamera: Node = haupt.get_node_or_null("Spieler/Kamera")

	_pruefe_wahr("Hauptszene hat Spieler, Arena und Kamera",
		spieler != null and arena != null and kamera != null)
	_pruefe_wahr("Spieler kennt seine Arena", spieler.arena.get_area() > 0.0)
	_pruefe_wahr("Spieler startet mit den Leben seines Charakters",
		spieler.leben == spieler.variante.leben and spieler.leben > 0)
	_pruefe_wahr("Spieler steht in der Arena",
		spieler.arena.has_point(spieler.global_position))
	_pruefe_wahr("Kamera ist auf die Arena begrenzt",
		kamera.limit_right > kamera.limit_left and kamera.limit_bottom > kamera.limit_top)

	# Die Kollisionsebenen entscheiden, ob ein Schuss ueberhaupt treffen kann.
	# Ebene 2 = Spieler, 3 = Gegner, 4 = Spielergeschoss (siehe project.godot).
	_pruefe("Spieler liegt auf der Spielerebene", spieler.collision_layer, 2)

	var geschoss: Node = load("res://scenes/geschoss.tscn").instantiate()
	_pruefe("Geschoss liegt auf der Geschossebene", geschoss.collision_layer, 8)
	_pruefe("Geschoss sucht nur Gegner", geschoss.collision_mask, 4)
	geschoss.free()

	# Charakter wechseln muss wirklich alle Werte mitziehen, nicht nur die Farbe
	var vorher: float = spieler.variante.tempo
	spieler.uebernehmen(Charaktere.nach_id(&"tank"))
	_pruefe_wahr("Charakterwechsel zieht Tempo und Leben mit",
		spieler.variante.tempo != vorher and spieler.leben == 7)

	haupt.queue_free()
