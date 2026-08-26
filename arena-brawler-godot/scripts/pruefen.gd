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
	_pruefe_geschoss_schaden()
	_pruefe_aufwertungen_am_spieler()

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

	# Charakter wechseln muss wirklich alle Werte mitziehen, nicht nur die Farbe
	var vorher: float = spieler.variante.tempo
	spieler.uebernehmen(Charaktere.nach_id(&"tank"))
	_pruefe_wahr("Charakterwechsel zieht Tempo und Leben mit",
		spieler.variante.tempo != vorher and spieler.leben == 7)
	_pruefe_wahr("und die Figur wechselt mit",
		figur != null and figur.charakter_id == &"tank")

	# Der Wellenleiter startet nicht von selbst (siehe seinen Kommentar dazu),
	# `Main._ready()` ruft `starten()` deshalb explizit auf — genau das prüft
	# dieser Block: Ohne den Aufruf stünde `welle` bei 0 und kein einziger
	# Gegner wäre gespawnt.
	var wellenleiter: Wellenleiter = haupt.get_node_or_null("Wellenleiter")
	_pruefe_wahr("Hauptszene hat einen Wellenleiter", wellenleiter != null)
	_pruefe("Welle 1 laeuft nach dem Start", wellenleiter.welle, 1)

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

	# `.free()` statt `queue_free()`: `haupt` trägt noch drei lebendige,
	# gruppierte Gegner. `queue_free()` wirkt erst am Ende des Bildes — bis
	# dahin stünden sie in `_pruefe_wellenleiter_ablauf` weiter in der
	# globalen Gruppe "gegner" und verfälschten dort die Leer-Prüfung. Genau
	# das ist einmal passiert, bevor hier auf `.free()` umgestellt wurde.
	haupt.free()


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
