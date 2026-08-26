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

## Nur für den Wellenleiter-Ablauftest weiter unten — siehe die Erklärung
## dort, warum das kein lokaler Wert sein kann.
var _letzte_gemeldete_welle := -1

## Nur für den `Eingabe.touch_erkannt`-Test — dieselbe Begründung: Eine
## Lambda fängt äußere lokale Variablen wertweise, nicht per Referenz.
var _meldungen_zaehler := 0


func _ready() -> void:
	_pruefe_bewegung()
	_pruefe_charaktere()
	_pruefe_gestalt()
	_pruefe_wellen()
	_pruefe_aufwertungen()
	_pruefe_spielstand()
	_pruefe_szenen()
	_pruefe_wellenleiter_ablauf()
	_pruefe_gegner()
	_pruefe_gegnertypen()
	_pruefe_gegner_getrennte_trefferflaechen()
	_pruefe_gegnertyp_mischung()
	_pruefe_geschoss_schaden()
	_pruefe_aufwertungen_am_spieler()
	_pruefe_eingabe_touch_erkennung()
	_pruefe_stick()
	_pruefe_feuerknopf()
	_pruefe_touch_bewegung()

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

	# Verfolger-Richtung — der Rechenkern hinter jedem Gegner.
	_pruefe("Richtung zu einem Ziel rechts", Bewegung.richtung_zu(Vector2.ZERO, Vector2(50, 0)), Vector2.RIGHT)
	_pruefe("Richtung zu einem Ziel oben", Bewegung.richtung_zu(Vector2.ZERO, Vector2(0, -30)), Vector2.UP)
	_pruefe("dasselbe Ziel ergibt Stillstand", Bewegung.richtung_zu(Vector2(10, 10), Vector2(10, 10)), Vector2.ZERO)
	_pruefe_wahr("Richtung zu einem Ziel ist immer Laenge 1",
		absf(Bewegung.richtung_zu(Vector2.ZERO, Vector2(7, -13)).length() - 1.0) < 0.0001)


## Die Steigerung über die Wellen — reine Zahlen, kein Node.
func _pruefe_wellen() -> void:
	_pruefe("Welle 1 hat die Grundzahl", Wellen.gegner_fuer_welle(1), 3)
	_pruefe("Welle 2 hat mehr als Welle 1", Wellen.gegner_fuer_welle(2), 5)
	_pruefe_wahr("die Gegnerzahl ist gedeckelt",
		Wellen.gegner_fuer_welle(999) <= Wellen.MAX_ANZAHL)
	_pruefe_wahr("die Gegnerzahl faellt nie",
		Wellen.gegner_fuer_welle(9) >= Wellen.gegner_fuer_welle(4))

	_pruefe_wahr("Welle 1 hat das Grundtempo",
		absf(Wellen.tempo_faktor_fuer_welle(1) - Wellen.GRUND_TEMPO_FAKTOR) < 0.0001)
	_pruefe_wahr("spaetere Wellen sind nicht langsamer",
		Wellen.tempo_faktor_fuer_welle(20) >= Wellen.tempo_faktor_fuer_welle(5))
	_pruefe_wahr("das Tempo ist gedeckelt",
		Wellen.tempo_faktor_fuer_welle(999) <= Wellen.MAX_TEMPO_FAKTOR)

	# Rand-Spawnpunkt: eine ganze Umrundung muss wieder am Anfang ankommen,
	# und jeder Punkt muss wirklich auf dem eingerückten Rand liegen, nicht
	# irgendwo im Feld — sonst würde ein Gegner neben dem Spieler auftauchen.
	var flaeche := Rect2(Vector2.ZERO, Vector2(1152, 648))
	_pruefe("t=0 liegt auf der eingerueckten linken oberen Ecke",
		Wellen.punkt_am_rand(flaeche, 0.0, 24.0), Vector2(24, 24))
	_pruefe_wahr("t=1 kommt wieder beim Start an",
		Wellen.punkt_am_rand(flaeche, 1.0, 24.0).is_equal_approx(Wellen.punkt_am_rand(flaeche, 0.0, 24.0)))

	var zufaellige_treffer := 0
	for i in 40:
		var p := Wellen.punkt_am_rand(flaeche, float(i) / 40.0, 24.0)
		var auf_dem_rand := (
			is_equal_approx(p.x, 24.0) or is_equal_approx(p.x, 1128.0)
			or is_equal_approx(p.y, 24.0) or is_equal_approx(p.y, 624.0)
		)
		var im_feld := flaeche.has_point(p)
		if auf_dem_rand and im_feld:
			zufaellige_treffer += 1
	_pruefe("alle 40 Punkte liegen auf dem eingerueckten Rand", zufaellige_treffer, 40)


## Die Karten nach einer geschafften Welle — reine Zahlen und Listen, kein
## Node. Das Wichtigste hier ist nicht „rechnet es richtig", sondern „bietet
## es nie eine Karte an, die nichts mehr bewirken würde".
func _pruefe_aufwertungen() -> void:
	_pruefe("fuenf Arten insgesamt", Aufwertungen.alle_arten().size(), 5)

	_pruefe("ein Stapel unter der Grenze waechst",
		Aufwertungen.naechster_stapel(1, Aufwertungen.TEMPO), 2)
	_pruefe("der Stapel bleibt an der eigenen Obergrenze stehen",
		Aufwertungen.naechster_stapel(Aufwertungen.FEUERRATE_MAX_STAPEL, Aufwertungen.FEUERRATE),
		Aufwertungen.FEUERRATE_MAX_STAPEL)
	# Leben laeuft absichtlich nicht ueber diesen Zaehler (siehe Kommentar am
	# Feld in Aufwertungen.Art) -- ein Aufruf darauf darf trotzdem nicht
	# abstuerzen und soll den Wert einfach unangetastet zurueckgeben.
	_pruefe("Leben aendert seinen Stapelwert nicht",
		Aufwertungen.naechster_stapel(3, Aufwertungen.LEBEN), 3)

	var leer := {}
	_pruefe("bei leeren Staepeln sind alle fuenf Arten verfuegbar",
		Aufwertungen.verfuegbare_arten(leer, 3).size(), 5)

	var voll := {
		Aufwertungen.FEUERRATE: Aufwertungen.FEUERRATE_MAX_STAPEL,
		Aufwertungen.TEMPO: Aufwertungen.TEMPO_MAX_STAPEL,
		Aufwertungen.SCHADEN: Aufwertungen.SCHADEN_MAX_STAPEL,
		Aufwertungen.REICHWEITE: Aufwertungen.REICHWEITE_MAX_STAPEL,
	}
	_pruefe("ausgereizte Arten fallen aus der Auswahl -- nur Leben bleibt",
		Aufwertungen.verfuegbare_arten(voll, 3).size(), 1)
	_pruefe("volles Leben nimmt auch die letzte verbleibende Karte weg",
		Aufwertungen.verfuegbare_arten(voll, Aufwertungen.LEBEN_MAX).size(), 0)

	_pruefe_wahr("kein Stapel laesst das Tempo unangetastet",
		absf(Aufwertungen.tempo_faktor(0) - 1.0) < 0.0001)
	_pruefe_wahr("ein Feuerrate-Stapel verkuerzt die Pause",
		Aufwertungen.feuerrate_faktor(1) < 1.0)
	_pruefe_wahr("zwei Tempo-Staepel wirken staerker als einer",
		Aufwertungen.tempo_faktor(2) > Aufwertungen.tempo_faktor(1))
	_pruefe_wahr("ein Reichweite-Stapel erhoeht den Faktor",
		Aufwertungen.reichweite_faktor(1) > 1.0)
	_pruefe("Schaden waechst um den Schritt je Stapel",
		Aufwertungen.schaden(2), Aufwertungen.GRUND_SCHADEN + 2 * Aufwertungen.SCHADEN_SCHRITT)


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


## Die gezeichneten Figuren. Was hier geprüft wird, sieht man im Bild **nicht**
## oder erst, wenn es zu spät ist: ob ein Vieleck konvex ist, ob die drei
## Umrisse sich wirklich unterscheiden, ob eine Figur heimlich viel größer
## geworden ist als ihre Trefferfläche.
func _pruefe_gestalt() -> void:
	var halbe_breiten := {}

	for v in Charaktere.liste:
		var teile := Gestalt.teile(v)
		_pruefe_wahr("%s: Figur hat genug Teile" % v.id, teile.size() >= 12)

		var duenn := 0
		var krumm := 0
		for teil in teile:
			if teil.punkte.size() < 3:
				duenn += 1
			elif not _ist_konvex(teil.punkte):
				krumm += 1

		_pruefe("%s: kein Teil unter drei Punkten" % v.id, duenn, 0)

		# Ein konkaves Vieleck malt seinen Umriss quer durch die eigene
		# Fläche — im Kleinen sieht das nach einem Kratzer aus, nicht nach
		# einem Fehler. Deshalb geprüft und nicht angeschaut.
		_pruefe("%s: jedes Teil ist konvex" % v.id, krumm, 0)

		var kasten := Gestalt.abmessungen(v)
		var halb := maxf(absf(kasten.position.x), absf(kasten.end.x))
		halbe_breiten[v.id] = halb

		# Die Figur darf breiter aussehen als ihre Trefferfläche (das ist die
		# verzeihende Richtung), aber nicht beliebig: Sonst weicht man
		# Geschossen aus, die einen nie getroffen hätten, und das Spiel
		# fühlt sich unehrlich an.
		_pruefe_wahr("%s: nicht breiter als das 1,35-fache der Trefferflaeche" % v.id,
			halb <= Spieler.RADIUS * 1.35)

		# `abmessungen` überspringt Teil 0 als Schatten. Das stimmt nur,
		# solange der Schatten wirklich vorn steht — schöbe jemand ein Teil
		# davor, würde ab da der Schatten mitgemessen und ein Körperteil
		# nicht. Der Schatten ist das einzige durchsichtige Teil, daran ist
		# er zu erkennen.
		var durchsichtige := 0
		for i in teile.size():
			if teile[i].farbe.a < 1.0:
				durchsichtige += 1
		_pruefe("%s: genau ein durchsichtiges Teil" % v.id, durchsichtige, 1)
		_pruefe_wahr("%s: und das ist der Schatten an Stelle 0" % v.id,
			teile[0].farbe.a < 1.0)

	# Die drei müssen sich im Umriss unterscheiden, sonst ist die Wahl Deko —
	# dieselbe Anforderung wie bei den Startwerten weiter oben.
	_pruefe_wahr("Sprinter ist schmaler als der Ausgewogene",
		halbe_breiten[&"ausgewogen"] - halbe_breiten[&"schnell"] >= 2.0)
	_pruefe_wahr("Bollwerk ist breiter als der Ausgewogene",
		halbe_breiten[&"tank"] - halbe_breiten[&"ausgewogen"] >= 2.0)

	# Und in der Form, nicht nur in der Breite: Der Sprinter ist von oben
	# länger als breit, das Bollwerk breiter als lang.
	var schmal := Gestalt.abmessungen(Charaktere.nach_id(&"schnell"))
	var breit := Gestalt.abmessungen(Charaktere.nach_id(&"tank"))
	_pruefe_wahr("Sprinter ist laenger als breit", schmal.size.y > schmal.size.x * 1.2)
	_pruefe_wahr("Bollwerk ist breiter als lang", breit.size.x > breit.size.y)


## Alle Kreuzprodukte aufeinanderfolgender Kanten müssen dasselbe Vorzeichen
## haben. Fast gerade Ecken (Kreise, Kapseln) rutschen sonst zufällig auf die
## falsche Seite, deshalb die kleine Schwelle.
func _ist_konvex(punkte: PackedVector2Array) -> bool:
	var anzahl := punkte.size()
	var vorzeichen := 0

	for i in anzahl:
		var a := punkte[i]
		var b := punkte[(i + 1) % anzahl]
		var c := punkte[(i + 2) % anzahl]
		var kreuz := (b - a).cross(c - b)

		if absf(kreuz) < 0.0001:
			continue
		var dieses := 1 if kreuz > 0.0 else -1
		if vorzeichen == 0:
			vorzeichen = dieses
		elif dieses != vorzeichen:
			return false

	return true


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

	# Die Figur hängt an der Anzeige und nicht am Körper: Ein gedrehter
	# Kollisionskörper macht aus einem sauberen Kreis eine wackelige Form.
	var figur: Node = haupt.get_node_or_null("Spieler/Anzeige/Figur")
	_pruefe_wahr("Spieler hat eine Figur unter der Anzeige", figur != null)
	_pruefe_wahr("die Figur zeichnet etwas", figur != null and figur.teile_anzahl() > 0)

	# Der eigentliche Grund für diese Prüfung: Im Phaser-Prototyp war der
	# Anzug einmal fast so dunkel wie der Boden, und die Figur verschwand
	# darauf. Der Bodenwert wird deshalb aus der Arena **gelesen** — stünde er
	# hier noch einmal, prüfte er sich gegen sich selbst.
	var boden: Color = arena.get_node("Boden").color
	var zu_nah := 0
	for v in Charaktere.liste:
		for farbe in [v.anstrich.panzer, v.anstrich.platte, v.anstrich.brust]:
			var abstand := Vector3(
				farbe.r - boden.r, farbe.g - boden.g, farbe.b - boden.b).length()
			if abstand < 0.12:
				zu_nah += 1
	_pruefe("keine Flaechenfarbe verschwindet im Arenaboden", zu_nah, 0)

	# Dieselbe Rechnung wie eben, aber umgekehrt verlangt: Gegner sollen
	# nicht nur nicht verschwinden (wie beim Spieler), sondern **hoher**
	# Kontrast war ausdrücklich gefordert ("Farbe klar 'Gegner'"). Die
	# Schwelle liegt deshalb deutlich über der 0,12 von oben.
	var zu_flau := 0
	for a in Gegnertypen.alle_arten():
		for farbe in [a.koerper, a.kern]:
			var abstand := Vector3(
				farbe.r - boden.r, farbe.g - boden.g, farbe.b - boden.b).length()
			if abstand < 0.3:
				zu_flau += 1
	_pruefe("jede Gegnerfarbe hebt sich deutlich vom Arenaboden ab", zu_flau, 0)

	# Charakter wechseln muss wirklich alle Werte mitziehen, nicht nur die Farbe
	var vorher: float = spieler.variante.tempo
	spieler.uebernehmen(Charaktere.nach_id(&"tank"))
	_pruefe_wahr("Charakterwechsel zieht Tempo und Leben mit",
		spieler.variante.tempo != vorher and spieler.leben == 7)
	_pruefe_wahr("und die Figur wechselt mit",
		figur != null and figur.charakter_id == &"tank")

	# Der Wellenleiter startet nicht von selbst (siehe seinen Kommentar dazu),
	# aber jetzt auch `Main._ready()` nicht mehr direkt — dazwischen steht die
	# Charakterauswahl. Genau dieser Ablauf wird hier geprüft: Beim bloßen
	# Laden steht die Auswahl da, der Baum ist angehalten, und keine einzige
	# Welle läuft. Erst ein simuliertes Antippen einer Karte (wie
	# `Aufwertungsauswahl._bei_druck` in `rundenprobe.gd`) setzt den
	# Charakter im Spielstand und startet die erste Welle.
	var wellenleiter: Wellenleiter = haupt.get_node_or_null("Wellenleiter")
	_pruefe_wahr("Hauptszene hat einen Wellenleiter", wellenleiter != null)

	var charakterauswahl: Charakterauswahl = haupt.get_node_or_null("Oberflaeche/Charakterauswahl")
	_pruefe_wahr("Hauptszene hat eine Charakterauswahl", charakterauswahl != null)
	_pruefe_wahr("die Auswahl erscheint zuerst -- nicht sofort Welle 1",
		charakterauswahl != null and charakterauswahl.visible)
	_pruefe("vor der Wahl laeuft noch keine Welle", wellenleiter.welle, 0)
	_pruefe_wahr("und der Baum steht still, solange die Auswahl offen ist",
		get_tree().paused)

	# Karte "Schnell" antippen — absichtlich nicht der Standard
	# ("ausgewogen"), sonst zeigte die nächste Prüfung auch bei einem
	# Fehler zufällig den richtigen Wert.
	charakterauswahl._bei_druck(&"schnell")
	_pruefe("die Wahl setzt den Charakter im Spielstand", Spielstand.charakter_id, &"schnell")
	_pruefe_wahr("und am Spieler selbst", spieler.variante.id == &"schnell")
	_pruefe_wahr("die Auswahl verschwindet nach der Wahl", not charakterauswahl.visible)
	_pruefe_wahr("der Baum laeuft danach wieder", not get_tree().paused)
	_pruefe("Welle 1 laeuft erst jetzt, nach der Wahl", wellenleiter.welle, 1)

	var gegner_in_szene := 0
	var naechster_abstand := INF
	for kind in haupt.get_children():
		if kind.is_in_group(&"gegner"):
			gegner_in_szene += 1
			naechster_abstand = minf(naechster_abstand, kind.global_position.distance_to(spieler.global_position))

	_pruefe("Welle 1 hat die Grundzahl Gegner gespawnt",
		gegner_in_szene, Wellen.gegner_fuer_welle(1))
	# Der eigentliche Punkt der Rand-Spawns: Kein Gegner darf nah am Spieler
	# auftauchen. 200 liegt deutlich unter dem kleinstmöglichen Randabstand
	# (rund 300 bei einer 1152×648-Arena mit Spieler in der Mitte) — Luft
	# genug, um nicht bei jeder Zufallslage knapp durchzufallen, aber immer
	# noch weit von einem echten Überfall entfernt.
	_pruefe_wahr("kein gespawnter Gegner steht nah am Spieler", naechster_abstand > 200.0)

	# Die Pause-Verdrahtung: `Oberflaeche` muss ALWAYS sein (sonst reagiert
	# während der Aufwertungsauswahl gar nichts mehr auf Eingaben), aber genau
	# dort und nirgends sonst — würde `Main` selbst das tragen, erbten Spieler
	# und Gegner es mit und liefen während der Pause einfach weiter.
	var oberflaeche: Node = haupt.get_node_or_null("Oberflaeche")
	_pruefe_wahr("Oberflaeche ist ALWAYS, damit sie waehrend der Pause reagiert",
		oberflaeche != null and oberflaeche.process_mode == Node.PROCESS_MODE_ALWAYS)
	_pruefe_wahr("Main selbst ist es nicht -- sonst erben Spieler und Gegner es mit",
		haupt.process_mode != Node.PROCESS_MODE_ALWAYS)

	var aufwertungsauswahl: Aufwertungsauswahl = haupt.get_node_or_null("Oberflaeche/Aufwertungsauswahl")
	_pruefe_wahr("Hauptszene hat eine Aufwertungsauswahl", aufwertungsauswahl != null)
	_pruefe_wahr("sie hat drei Karten",
		aufwertungsauswahl != null
		and aufwertungsauswahl.has_node("Karte1")
		and aufwertungsauswahl.has_node("Karte2")
		and aufwertungsauswahl.has_node("Karte3"))

	var rundenende: Rundenende = haupt.get_node_or_null("Oberflaeche/Rundenende")
	_pruefe_wahr("Rundenende meldet Neustart-Anfragen ueber ein Signal",
		rundenende != null and rundenende.has_signal(&"neustart_angefordert"))

	# Die Touch-Steuerung liegt genau umgekehrt zu Oberflaeche: keine ALWAYS,
	# sie soll während der Pause ja gerade **nicht** reagieren (siehe deren
	# eigener Kommentar). `Eingabe.touch_verfuegbar` wird für diesen
	# Abschnitt erzwungen, sonst bliebe die Steuerung im Test-Umfeld ohnehin
	# unsichtbar (kein echter Touchscreen hier) und die Pause-Kopplung ließe
	# sich gar nicht beobachten — am Ende zurückgesetzt, damit spätere
	# Prüfungen nichts davon merken.
	var touch_vorher := Eingabe.touch_verfuegbar
	var touchsteuerung: Touchsteuerung = haupt.get_node_or_null("Touchsteuerung")
	_pruefe_wahr("Hauptszene hat eine Touchsteuerung mit Stick und Feuerknopf",
		touchsteuerung != null
		and touchsteuerung.has_node("Stick")
		and touchsteuerung.has_node("Feuerknopf"))
	_pruefe_wahr("sie ist nicht ALWAYS -- sonst reagierte sie waehrend der Pause weiter",
		touchsteuerung != null and touchsteuerung.process_mode != Node.PROCESS_MODE_ALWAYS)

	if touchsteuerung != null:
		Eingabe.touch_verfuegbar = true
		touchsteuerung.pause_setzen(true)
		_pruefe_wahr("waehrend einer Pause bleibt sie ausgeblendet", not touchsteuerung.visible)
		touchsteuerung.pause_setzen(false)
		_pruefe_wahr("ausserhalb einer Pause -- bei erkanntem Touch -- ist sie sichtbar",
			touchsteuerung.visible)

		Eingabe.touch_verfuegbar = false
		touchsteuerung.pause_setzen(false)
		_pruefe_wahr("ohne erkannten Touch bleibt sie ausgeblendet, auch ausserhalb der Pause",
			not touchsteuerung.visible)
	Eingabe.touch_verfuegbar = touch_vorher

	# `.free()` statt `queue_free()`: `haupt` trägt noch drei lebendige,
	# gruppierte Gegner. `queue_free()` wirkt erst am Ende des Bildes — bis
	# dahin stünden sie in `_pruefe_wellenleiter_ablauf` weiter in der
	# globalen Gruppe "gegner" und verfälschten dort die Leer-Prüfung. Genau
	# das ist einmal passiert, bevor hier auf `.free()` umgestellt wurde.
	haupt.free()

	# Neustart nach Game Over ruft `get_tree().reload_current_scene()` auf —
	# das lässt sich hier nicht sinnvoll auslösen, es würde versuchen, diese
	# Prüf-Szene selbst neu zu laden, nicht `main.tscn`. Ein Neustart tut
	# aber nichts anderes, als dieselbe Szene noch einmal frisch zu
	# instanzieren, und genau das steht hier: ein zweites `main.tscn`, jetzt
	# mit einem `Spielstand.charakter_id`, das nicht mehr der Standard ist
	# (siehe die Wahl oben). Zeigte sich die Auswahl nur beim allerersten
	# Laden — etwa weil eine künftige Änderung sie an "noch kein Charakter
	# gewählt" statt an "gerade erst geladen" hängt —, bliebe sie hier aus.
	var haupt2: Node = load("res://scenes/main.tscn").instantiate()
	add_child(haupt2)
	var charakterauswahl2: Node = haupt2.get_node_or_null("Oberflaeche/Charakterauswahl")
	var wellenleiter2: Wellenleiter = haupt2.get_node_or_null("Wellenleiter")
	_pruefe_wahr("nach einem Neustart erscheint die Auswahl erneut",
		charakterauswahl2 != null and charakterauswahl2.visible)
	_pruefe("und Welle 1 laeuft auch da noch nicht", wellenleiter2.welle, 0)
	haupt2.free()


## Der Wellenablauf für sich allein, ohne `main.tscn`. Bewusst **nicht** in
## `_pruefe_szenen` mitgeprüft: Die dortige `haupt`-Instanz hat ihr eigenes
## `main.gd` am `welle_geschafft`-Signal hängen, und das würde bei einem
## manuellen `_process()`-Aufruf hier ungefragt mitlaufen — pausiert den
## ganzen Baum und startet einen Timer für die Meldung, die dann nie zu Ende
## läuft, weil der Test gleich danach beendet. Ein eigener, isolierter
## Wellenleiter ohne `main.gd` drumherum vermeidet das von vornherein.
func _pruefe_wellenleiter_ablauf() -> void:
	var wellenleiter := Wellenleiter.new()
	add_child(wellenleiter)

	var eltern := Node.new()
	add_child(eltern)

	var ziel := Node2D.new()
	add_child(ziel)
	ziel.global_position = Vector2(576, 324)

	wellenleiter.starten(Rect2(Vector2.ZERO, Vector2(1152, 648)), ziel, eltern)
	_pruefe("Welle 1 laeuft nach dem Start", wellenleiter.welle, 1)
	_pruefe("Welle 1 hat die Grundzahl Gegner gespawnt",
		eltern.get_child_count(), Wellen.gegner_fuer_welle(1))

	for kind in eltern.get_children():
		kind.schaden_nehmen(99)

	# Über ein Feld statt einer lokalen Variablen abgreifen: Eine Lambda in
	# GDScript fängt äußere lokale Variablen **wertweise**, nicht per
	# Referenz — eine Zuweisung darin an eine lokale Variable hier draußen
	# käme nie an. Ein Feld auf `self` funktioniert, weil die Lambda `self`
	# selbst hält, nicht nur eine Kopie seines Inhalts.
	_letzte_gemeldete_welle = -1
	wellenleiter.welle_geschafft.connect(func(w: int) -> void: _letzte_gemeldete_welle = w)
	wellenleiter._process(0.016)

	_pruefe("Wellenleiter meldet die geschaffte Welle", _letzte_gemeldete_welle, 1)
	_pruefe("die Welle schaltet nicht von selbst weiter", wellenleiter.welle, 1)

	wellenleiter.naechste_welle_erzwingen()
	_pruefe("erst 'naechste_welle_erzwingen' startet die naechste Welle", wellenleiter.welle, 2)

	# `.free()`, nicht `queue_free()` — `eltern` trägt jetzt fünf lebendige
	# Welle-2-Gegner, die sonst bis zum Bildende in der globalen Gruppe
	# "gegner" stünden. Siehe den Kommentar in `_pruefe_szenen`.
	wellenleiter.free()
	eltern.free()
	ziel.free()


## Der Gegner für sich allein: Ebenen, Gruppe, und dass ein Treffer wirklich
## tötet. Läuft **ohne** die Hauptszene — ein einzelner Gegner lässt sich
## billiger prüfen, ohne dass Arena, Spieler und Wellenleiter mitlaufen
## müssen.
func _pruefe_gegner() -> void:
	var gegner: Gegner = load("res://enemies/gegner.tscn").instantiate()
	add_child(gegner)

	# Ebene 3 = Gegner, Ebene 4 = Spielergeschoss (siehe project.godot) — das
	# Geschoss sucht Ebene 4 nach Ebene 3 ab (siehe oben), stimmt das hier
	# nicht überein, trifft kein Schuss je einen Gegner.
	_pruefe("Gegner liegt auf der Gegnerebene", gegner.collision_layer, 4)
	_pruefe("Gegner kollidiert nur mit der Welt, nicht mit dem Spieler",
		gegner.collision_mask, 1)
	_pruefe_wahr("Gegner steht in der Gruppe 'gegner'", gegner.is_in_group(&"gegner"))

	var beruehrung: Area2D = gegner.get_node("Beruehrung")
	_pruefe("Beruehrung erkennt nur die Spielerebene", beruehrung.collision_mask, 2)

	# Ein Treffer muss sofort aus der Gruppe raus — der Wellenleiter zählt
	# „noch da" darüber, und der Treffer selbst ist der Moment, der zählt,
	# nicht erst das Verblassen danach (siehe Kommentar in `_sterben`).
	gegner.schaden_nehmen(1)
	_pruefe_wahr("ein toedlicher Treffer entfernt den Gegner sofort aus der Gruppe",
		not gegner.is_in_group(&"gegner"))

	gegner.queue_free()


## Die drei Gegnertypen für sich allein — reine Daten, kein Node. Ergänzt
## `_pruefe_gegner()` oben (der prüft nur den Grundtyp/Verfolger-Fallback).
func _pruefe_gegnertypen() -> void:
	_pruefe("drei Gegnertypen", Gegnertypen.alle_arten().size(), 3)

	var v := Gegnertypen.nach_id(Gegnertypen.VERFOLGER)
	var p := Gegnertypen.nach_id(Gegnertypen.PANZER)
	var f := Gegnertypen.nach_id(Gegnertypen.FLINK)

	_pruefe("Verfolger hat 1 Leben", v.leben, 1)
	_pruefe_wahr("Panzer-Verfolger haelt mehrere Treffer aus (2 bis 3 Leben)",
		p.leben >= 2 and p.leben <= 3)
	_pruefe_wahr("Panzer-Verfolger ist langsamer als der Verfolger", p.tempo < v.tempo)
	_pruefe_wahr("Panzer-Verfolger ist breiter als der Verfolger", p.radius > v.radius)
	_pruefe("Flink hat 1 Leben", f.leben, 1)
	_pruefe_wahr("Flink ist schneller als der Verfolger", f.tempo > v.tempo)
	_pruefe_wahr("Flink ist schmaler als der Verfolger", f.radius < v.radius)

	# Schattenriss: dieselbe Anforderung wie bei den drei Charakteren -- die
	# gezeichnete Silhouette muss die Unterschiede tragen, nicht nur die
	# Kollisionszahl `radius`.
	var breite_v := Gegnergestalt.abmessungen(v).size.x
	var breite_p := Gegnergestalt.abmessungen(p).size.x
	var breite_f := Gegnergestalt.abmessungen(f).size.x
	_pruefe_wahr("Panzer-Verfolger ist auch als Silhouette breiter als der Verfolger",
		breite_p > breite_v)
	_pruefe_wahr("Flink ist auch als Silhouette schmaler als der Verfolger",
		breite_f < breite_v)

	for a in Gegnertypen.alle_arten():
		_pruefe_wahr("%s: Figur zeichnet etwas" % a.id, Gegnergestalt.teile(a).size() > 0)

	# Mischung nach Welle -- reine Rechnung, kein echter Zufall dabei.
	_pruefe("vor der Panzer-Welle gibt es nur den Verfolger im Lostopf",
		Wellen.gegnertyp_gewichte_fuer_welle(Wellen.PANZER_AB_WELLE - 1).size(), 1)
	_pruefe_wahr("ab der Panzer-Welle ist der Panzer im Lostopf",
		Wellen.gegnertyp_gewichte_fuer_welle(Wellen.PANZER_AB_WELLE).has(Gegnertypen.PANZER))
	_pruefe("ab der Flink-Welle sind alle drei Typen im Lostopf",
		Wellen.gegnertyp_gewichte_fuer_welle(Wellen.FLINK_AB_WELLE).size(), 3)
	_pruefe_wahr("der Verfolger bleibt auch in einer sehr spaeten Welle im Lostopf",
		Wellen.gegnertyp_gewichte_fuer_welle(999).has(Gegnertypen.VERFOLGER))

	var gewichte := {Gegnertypen.VERFOLGER: 3, Gegnertypen.PANZER: 2}
	_pruefe("t=0 trifft den ersten Eintrag im Lostopf",
		Wellen.gegnertyp_auswaehlen(gewichte, 0.0), Gegnertypen.VERFOLGER)
	_pruefe("t nahe 1 trifft den letzten Eintrag im Lostopf",
		Wellen.gegnertyp_auswaehlen(gewichte, 0.999), Gegnertypen.PANZER)
	_pruefe("ein leerer Lostopf ergibt den Verfolger",
		Wellen.gegnertyp_auswaehlen({}, 0.5), Gegnertypen.VERFOLGER)

	# Balance: Der langsamste Charakter muss selbst dem schnellsten
	# Gegnertyp bei maximaler Wellensteigerung noch entkommen können --
	# sonst gibt es ab einer bestimmten Welle kein Weglaufen mehr, nur noch
	# Zufall. Genau das war ausdrücklich gefordert ("Tank muss noch
	# entkommen können").
	var langsamster_charakter := INF
	for charakter in Charaktere.liste:
		langsamster_charakter = minf(langsamster_charakter, charakter.tempo)

	var schnellster_gegner := 0.0
	for a in Gegnertypen.alle_arten():
		schnellster_gegner = maxf(schnellster_gegner, a.tempo * Wellen.MAX_TEMPO_FAKTOR)

	_pruefe_wahr("der langsamste Charakter entkommt selbst dem schnellsten Gegner in der letzten Welle",
		langsamster_charakter > schnellster_gegner)

	# Der eigentliche Anlass für den Panzer-Verfolger: Gegen den bisherigen
	# 1-Leben-Verfolger tötete jeder Schaden schon beim ersten Treffer, "Stärkere
	# Kugeln" hatte also nie einen sichtbaren Effekt. Gegen 3 Leben sieht man den
	# Unterschied in den nötigen Treffern selbst.
	var treffer_ohne_karte := int(ceil(float(p.leben) / Aufwertungen.schaden(0)))
	var treffer_mit_zwei_stapeln := int(ceil(float(p.leben) / Aufwertungen.schaden(2)))
	_pruefe("ohne 'Staerkere Kugeln' braucht der Panzer-Verfolger volle Treffer",
		treffer_ohne_karte, p.leben)
	_pruefe_wahr("zwei Stapel 'Staerkere Kugeln' senken die noetigen Treffer spuerbar",
		treffer_mit_zwei_stapeln < treffer_ohne_karte)


## Zwei gleichzeitige Gegner unterschiedlichen Typs müssen unterschiedliche
## Trefferflächen behalten. Das ist keine Selbstverständlichkeit: `preload`
## teilt sich dieselbe `CircleShape2D`-Ressource über alle Instanzen einer
## Szene, solange sie nicht `resource_local_to_scene` ist (siehe der lange
## Kommentar an `Gegner.einrichten`). Ohne das würde das Einrichten des
## zweiten Gegners heimlich auch die Trefferfläche des ersten ändern -- ein
## Fehler, der sich nur bemerkbar macht, wenn wirklich zwei Typen
## gleichzeitig im Spiel sind, also frühestens ab der Panzer-Welle.
func _pruefe_gegner_getrennte_trefferflaechen() -> void:
	var g1: Gegner = load("res://enemies/gegner.tscn").instantiate()
	add_child(g1)
	g1.einrichten(Gegnertypen.nach_id(Gegnertypen.VERFOLGER))

	var g2: Gegner = load("res://enemies/gegner.tscn").instantiate()
	add_child(g2)
	g2.einrichten(Gegnertypen.nach_id(Gegnertypen.PANZER))

	var form1: CollisionShape2D = g1.get_node("Form")
	var form2: CollisionShape2D = g2.get_node("Form")
	_pruefe_wahr("zwei gleichzeitige Gegner behalten getrennte Trefferflaechen",
		form1.shape.radius != form2.shape.radius)
	_pruefe("und der zuerst eingerichtete behaelt seinen eigenen Radius",
		form1.shape.radius, Gegnertypen.nach_id(Gegnertypen.VERFOLGER).radius)

	g1.queue_free()
	g2.queue_free()


## Der Wellenablauf über mehrere Wellen hinweg, isoliert wie
## `_pruefe_wellenleiter_ablauf` oben: Ab einer späten Welle müssen
## tatsächlich mehrere Gegnertypen unter den Gespawnten sein, nicht nur der
## Verfolger. Bei bis zu 14 Gegnern je Welle und einem Nicht-Verfolger-Anteil
## von deutlich über der Hälfte im Lostopf ist die Chance auf "zufällig nur
## Verfolger" verschwindend klein (unter einem Millionstel) -- kein
## Flackertest.
func _pruefe_gegnertyp_mischung() -> void:
	var wellenleiter := Wellenleiter.new()
	add_child(wellenleiter)
	var eltern := Node.new()
	add_child(eltern)
	var ziel := Node2D.new()
	add_child(ziel)
	ziel.global_position = Vector2(576, 324)

	wellenleiter.starten(Rect2(Vector2.ZERO, Vector2(1152, 648)), ziel, eltern)
	while wellenleiter.welle < Wellen.FLINK_AB_WELLE:
		for kind in eltern.get_children():
			kind.schaden_nehmen(99)
		wellenleiter._process(0.016)
		wellenleiter.naechste_welle_erzwingen()

	var typen := {}
	for kind in eltern.get_children():
		typen[kind.art_id()] = true
	_pruefe_wahr("in einer spaeten Welle mischen sich mehrere Gegnertypen",
		typen.size() > 1)

	# `.free()`, nicht `queue_free()` -- dieselbe Begründung wie in
	# `_pruefe_wellenleiter_ablauf`: `eltern` trägt noch lebendige,
	# gruppierte Gegner der letzten Welle.
	wellenleiter.free()
	eltern.free()
	ziel.free()


## Ein Geschoss reicht seinen Schaden weiter, statt fest 1 zu nehmen — das
## ist die ganze Verbindung zur „Stärkere Kugeln"-Aufwertung, mehr steckt in
## `geschoss.gd` nicht drin.
func _pruefe_geschoss_schaden() -> void:
	var geschoss: Geschoss = load("res://scenes/geschoss.tscn").instantiate()
	geschoss.starten(Vector2.RIGHT, 100.0, Color.WHITE, 3)

	var ziel: Gegner = load("res://enemies/gegner.tscn").instantiate()
	add_child(ziel)
	ziel._leben = 5  # genug, um den Schuss zu ueberleben und den Schaden zu messen

	geschoss._on_body_entered(ziel)
	_pruefe("Geschoss reicht seinen Schaden an den Getroffenen weiter", ziel._leben, 2)

	# `.free()`: `ziel` überlebt den Schuss und steht danach noch lebendig in
	# der Gruppe "gegner" — siehe den Kommentar in `_pruefe_szenen`.
	ziel.free()


## Aufwertungen wirklich am Spieler angewendet: Die vier stapelbaren ändern
## die *effektiven* Werte, nicht `variante` selbst — die ist über alle
## Charaktere hinweg geteilt, sie zu verändern würde jede künftige Runde mit
## demselben Charakter verfälschen. Leben ist der Sonderfall mit direkter,
## gedeckelter Wirkung.
func _pruefe_aufwertungen_am_spieler() -> void:
	var spieler: Spieler = load("res://characters/spieler.tscn").instantiate()
	add_child(spieler)

	var grund_tempo := spieler.effektives_tempo()
	var grund_pause := spieler.effektive_schuss_pause()
	var grund_reichweite := spieler.effektive_reichweite()
	var grund_schaden := spieler.effektiver_schaden()
	var grund_variante_tempo: float = spieler.variante.tempo

	spieler.aufwertung_anwenden(Aufwertungen.TEMPO)
	_pruefe_wahr("Tempo-Aufwertung erhoeht das effektive Tempo",
		spieler.effektives_tempo() > grund_tempo)
	_pruefe("die geteilte Variante bleibt dabei unangetastet",
		spieler.variante.tempo, grund_variante_tempo)

	spieler.aufwertung_anwenden(Aufwertungen.FEUERRATE)
	_pruefe_wahr("Feuerrate-Aufwertung verkuerzt die effektive Schusspause",
		spieler.effektive_schuss_pause() < grund_pause)

	spieler.aufwertung_anwenden(Aufwertungen.REICHWEITE)
	_pruefe_wahr("Reichweite-Aufwertung erhoeht die effektive Reichweite",
		spieler.effektive_reichweite() > grund_reichweite)

	spieler.aufwertung_anwenden(Aufwertungen.SCHADEN)
	_pruefe("Schaden-Aufwertung erhoeht den effektiven Schaden",
		spieler.effektiver_schaden(), grund_schaden + Aufwertungen.SCHADEN_SCHRITT)

	var leben_vorher := spieler.leben
	spieler.aufwertung_anwenden(Aufwertungen.LEBEN)
	_pruefe("Leben-Aufwertung erhoeht das aktuelle Leben",
		spieler.leben, mini(Aufwertungen.LEBEN_MAX, leben_vorher + Aufwertungen.LEBEN_SCHRITT))

	# Deckel: Leben bis zum Anschlag hochtreiben, dann darf nichts mehr gehen.
	for _i in 20:
		spieler.aufwertung_anwenden(Aufwertungen.LEBEN)
	_pruefe("Leben ist bei der Obergrenze gedeckelt", spieler.leben, Aufwertungen.LEBEN_MAX)

	var hat_leben_karte := false
	for art in spieler.verfuegbare_aufwertungen():
		if art.id == Aufwertungen.LEBEN:
			hat_leben_karte = true
	_pruefe_wahr("volles Leben bietet die Leben-Karte nicht mehr an", not hat_leben_karte)

	spieler.queue_free()


## `Eingabe.touch_verfuegbar` ist ein Setter mit eigener Logik (nur beim
## Übergang von falsch auf wahr wird `touch_erkannt` gemeldet) -- reine
## Zustandsprüfung, kein Node nötig.
func _pruefe_eingabe_touch_erkennung() -> void:
	var vorher := Eingabe.touch_verfuegbar
	Eingabe.touch_verfuegbar = false

	_meldungen_zaehler = 0
	var verbindung := func() -> void: _meldungen_zaehler += 1
	Eingabe.touch_erkannt.connect(verbindung)

	Eingabe.touch_verfuegbar = true
	_pruefe("der Uebergang falsch -> wahr meldet touch_erkannt genau einmal", _meldungen_zaehler, 1)

	Eingabe.touch_verfuegbar = true
	_pruefe("ein zweites Mal wahr meldet nichts erneut", _meldungen_zaehler, 1)

	Eingabe.touch_erkannt.disconnect(verbindung)
	Eingabe.touch_verfuegbar = vorher


## Der virtuelle Stick für sich allein: Ziehen und Loslassen wirken direkt
## auf `Eingabe.stick_richtung`. `_greifen`/`_loslassen` werden hier direkt
## aufgerufen statt über echte `InputEvent`s -- derselbe Griff wie bei
## `Aufwertungsauswahl._bei_druck` oder `Charakterauswahl._bei_druck`, ein
## Antippen auslösen, ohne die echte Eingabe-Pipeline zu brauchen.
func _pruefe_stick() -> void:
	var stick := Stick.new()
	add_child(stick)
	stick.size = Vector2(220, 220)
	stick.visible = true

	Eingabe.stick_richtung = Vector2.ZERO
	stick._greifen(stick.global_position + stick.size / 2.0 + Vector2(50, 0))
	_pruefe_wahr("Ziehen nach rechts ergibt eine Richtung nach rechts",
		Eingabe.stick_richtung.x > 0.0)

	stick._loslassen()
	_pruefe("Loslassen setzt die Richtung zurueck", Eingabe.stick_richtung, Vector2.ZERO)

	# Eine Berührung weit außerhalb der Basis darf den Stick nicht greifen --
	# sonst könnte ein Tipp irgendwo auf dem Feuerknopf versehentlich auch
	# den Stick auslösen ("Nicht mit dem Stick kollidieren").
	var weit_weg := InputEventScreenTouch.new()
	weit_weg.index = 0
	weit_weg.pressed = true
	weit_weg.position = stick.global_position + stick.size / 2.0 + Vector2(500, 0)
	stick._input(weit_weg)
	_pruefe("eine Beruehrung weit ausserhalb greift den Stick nicht",
		Eingabe.stick_richtung, Vector2.ZERO)

	stick.free()
	Eingabe.stick_richtung = Vector2.ZERO


## Der Touch-Feuerknopf: hält/lässt die bestehende "schiessen"-Aktion nach,
## statt eine eigene Feuerlogik zu haben -- genau das wird hier geprüft,
## nicht irgendein eigener Zustand am Knopf selbst.
func _pruefe_feuerknopf() -> void:
	Input.action_release(&"schiessen")

	var knopf := Feuerknopf.new()
	add_child(knopf)

	knopf.button_down.emit()
	_pruefe_wahr("Feuerknopf haelt die Aktion 'schiessen', solange er gedrueckt bleibt",
		Input.is_action_pressed(&"schiessen"))

	knopf.button_up.emit()
	_pruefe_wahr("und laesst wieder los, sobald der Finger sich hebt",
		not Input.is_action_pressed(&"schiessen"))

	# Verschwindet der Knopf mitten im Halten (Neustart waehrend gehaltenem
	# Finger), darf "schiessen" nicht global haengen bleiben -- sonst wuerde
	# die naechste Runde von allein schiessen.
	knopf.button_down.emit()
	knopf.free()
	_pruefe_wahr("verschwindet der Knopf mitten im Halten, wird 'schiessen' trotzdem freigegeben",
		not Input.is_action_pressed(&"schiessen"))


## Die eigentliche Verdrahtung in `Spieler._physics_process`: Ohne gedrückte
## Taste bewegt der Stick, mit gedrückter Taste gewinnt die Taste --
## `Bestehende Tastatursteuerung behalten` ist keine Behauptung, sondern
## hier nachgerechnet.
func _pruefe_touch_bewegung() -> void:
	var spieler: Spieler = load("res://characters/spieler.tscn").instantiate()
	add_child(spieler)
	spieler.arena = Rect2(Vector2.ZERO, Vector2(1152, 648))
	spieler.global_position = Vector2(576, 324)

	Input.action_release(&"rechts")
	Input.action_release(&"links")
	Eingabe.stick_richtung = Vector2.RIGHT
	spieler._physics_process(0.016)
	_pruefe_wahr("der Stick bewegt den Spieler, wenn keine Taste gedrueckt ist",
		spieler.velocity.x > 0.0)

	Input.action_press(&"links")
	Eingabe.stick_richtung = Vector2.RIGHT
	spieler._physics_process(0.016)
	_pruefe_wahr("die Taste hat weiterhin Vorrang vor dem Stick",
		spieler.velocity.x < 0.0)

	Input.action_release(&"links")
	Eingabe.stick_richtung = Vector2.ZERO
	spieler.queue_free()
