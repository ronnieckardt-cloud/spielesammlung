class_name Charakterauswahl
extends CanvasLayer
## Die Auswahl vor dem Rundenstart: drei Karten mit der echten Figur, dem
## Namen und den Kurzwerten jeder Variante.
##
## **Zeigt nur an und meldet die Wahl — wendet sie nicht selbst an.** Dieselbe
## Aufteilung wie bei `Aufwertungsauswahl`: `main.gd` reicht die Wahl an
## `Spielstand.charakter_setzen()` weiter und startet danach erst die Runde.
## Diese Datei kennt keine Spielregel, nur die drei Karten und das Antippen.
##
## **Die Werte kommen bei jedem `zeigen()` frisch aus `Charaktere.liste`**,
## stehen nirgends noch einmal abgetippt — stünde „260" hier fest im Text,
## änderte sich ein Tempowert in `charaktere.gd`, und die Karte zeigte die
## alte Zahl weiter, ohne dass es beim Lesen auffiele.
##
## Die Figur je Karte ist derselbe `Figur`-Knoten wie am Spieler, nur größer
## skaliert — keine zweite Zeichenlogik, wie in `figur.gd` selbst als Zweck
## schon vorgesehen („kann später auf dem Auswahlbildschirm stehen — dort mit
## `scale`, sonst nichts anders").
##
## Braucht `process_mode = ALWAYS` — geerbt vom Elternknoten `Oberflaeche` in
## `main.tscn` (siehe die Erklärung in `rundenende.gd`), sonst kämen während
## der Pause, in der diese Auswahl ja überhaupt erst zu sehen ist, gar keine
## Antippen mehr an. Aus demselben Grund laufen auch `Tween` und
## `CPUParticles2D` hier während der Pause weiter, siehe `_auswahl_animieren`.

signal gewaehlt(charakter_id: StringName)

## Wie lange sich die Auswahl-Rückmeldung Zeit lässt, bevor die Runde
## tatsächlich losgeht — lang genug, um Feder, Leuchten und Funken wirklich
## zu sehen, kurz genug, um sich nicht wie eine Wartezeit anzufühlen.
const AUSWAHL_ANIMATION_DAUER := 0.42

## Eine Karte je Variante, in derselben Reihenfolge wie `Charaktere.liste`.
@onready var _karten: Array[Button] = [$KarteAusgewogen, $KarteSchnell, $KarteTank]
@onready var _rekord_zeile: Label = $Rekord
@onready var _tonknopf: Button = $Tonknopf


func _ready() -> void:
	for i in _karten.size():
		var variante := Charaktere.liste[i]
		var karte := _karten[i]

		# Die eigene charakter_id im Karten-Kind ist nur der Startwert für
		# die Editor-Vorschau — maßgeblich ist diese Zuweisung hier, damit
		# beide garantiert dieselbe Quelle (`Charaktere.liste`) zeigen.
		var figur: Figur = karte.get_node("Figur")
		figur.zeigen(variante)

		karte.get_node("Name").text = variante.name
		karte.get_node("Werte").text = "%d Leben · Tempo %d · Schuss %.2fs" % [
			variante.leben, int(variante.tempo), variante.schuss_pause,
		]

		# Die Karte soll aus ihrer **Mitte** federn, nicht aus der oberen
		# linken Ecke — Godots Standard-Drehpunkt für ein `Control`. Ohne das
		# wandert die ganze Karte beim Schrumpfen sichtbar nach oben-links,
		# statt sich einfach zusammenzuziehen.
		karte.pivot_offset = karte.size / 2.0

		karte.pressed.connect(_bei_druck.bind(variante.id))

	_tonknopf.pressed.connect(_ton_umschalten)
	_atmen_starten()


## Von `main.gd` aufgerufen, bevor die Auswahl sichtbar wird — auch nach
## einem Neustart wieder, deshalb hier und nicht nur einmalig in `_ready()`:
## Der zuletzt gespielte Charakter und die Bestleistung können sich seit dem
## letzten Mal geändert haben.
func zeigen() -> void:
	var aktuelle_id := Spielstand.charakter_id
	for i in _karten.size():
		var markiert: bool = Charaktere.liste[i].id == aktuelle_id
		_karten[i].get_node("Marke").visible = markiert
		# Jede Karte könnte von einer abgebrochenen Auswahl her noch
		# deaktiviert sein (siehe `_bei_druck`) — ein frisches `zeigen()`
		# räumt das immer auf, auch wenn der reguläre Ablauf das nie
		# tatsächlich offen lässt.
		_karten[i].disabled = false
		_karten[i].scale = Vector2.ONE
		# Nicht nur das kleine Abzeichen, auch der ganze Kartenrahmen hebt
		# die zuletzt gespielte Karte hervor — leichter zu sehen als eine
		# einzelne Textzeile unten in der Karte.
		if markiert:
			_karten[i].add_theme_stylebox_override("normal", _markierter_stil())
		else:
			_karten[i].remove_theme_stylebox_override("normal")

	_rekord_zeile.text = Spielstand.rekord_zeile()
	_tonknopf_aktualisieren()
	visible = true


func _bei_druck(charakter_id: StringName) -> void:
	# Während die Auswahl-Rückmeldung läuft, soll kein zweiter Tipp mehr
	# etwas auslösen — sonst könnte ein hastiger zweiter Tipp auf eine
	# andere Karte mitten in der ersten Animation die Wahl noch einmal
	# ändern, während die erste Karte noch feiert.
	for karte in _karten:
		karte.disabled = true

	Ton.abspielen(&"ui_klick")

	var index := _index_von(charakter_id)
	if index >= 0:
		await _auswahl_animieren(index, charakter_id)

	visible = false
	gewaehlt.emit(charakter_id)


func _index_von(charakter_id: StringName) -> int:
	for i in Charaktere.liste.size():
		if Charaktere.liste[i].id == charakter_id:
			return i
	return -1


## Die eigentliche Rückmeldung: Die angetippte Karte federt kurz ein und
## zurück, die Figur leuchtet auf und dreht sich einmal leicht, und ein
## kleiner Funkenregen in der Charakterfarbe platzt aus ihrer Mitte. Muss
## sich wie eine echte Auswahl anfühlen, nicht wie ein stummer
## Bildschirmwechsel.
##
## **Drei unabhängige `Tween`s statt eines einzigen.** Karte, Figur-Leuchten
## und Figur-Drehung sind drei verschiedene Eigenschaften an zwei
## verschiedenen Knoten, die alle gleichzeitig, aber jede für sich in zwei
## Schritten laufen (hin, dann zurück) — drei einfache, rein sequenzielle
## Tweens sind hier klarer als ein Versuch, das in einem einzigen Tween mit
## `set_parallel`/`chain` nachzubilden.
func _auswahl_animieren(index: int, charakter_id: StringName) -> void:
	var karte := _karten[index]
	var figur: Figur = karte.get_node("Figur")
	var burst: CPUParticles2D = karte.get_node("Burst")
	var variante := Charaktere.nach_id(charakter_id)

	burst.color = variante.farbe
	burst.restart()

	# `TWEEN_PAUSE_PROCESS`, nicht der Standard: `main.gd` pausiert den Baum
	# in genau dem Moment, in dem diese Auswahl zu sehen ist — ohne das
	# bliebe die ganze Rückmeldung mitten in der Bewegung hängen.
	var feder := create_tween()
	feder.set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	feder.tween_property(karte, "scale", Vector2(0.93, 0.93), 0.08).set_trans(Tween.TRANS_SINE)
	feder.tween_property(karte, "scale", Vector2(1.0, 1.0), 0.28) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

	var leuchten := create_tween()
	leuchten.set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	leuchten.tween_property(figur, "modulate", Color(1.7, 1.7, 1.7, 1.0), 0.1)
	leuchten.tween_property(figur, "modulate", Color(1.0, 1.0, 1.0, 1.0), 0.3)

	var drehen := create_tween()
	drehen.set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	drehen.tween_property(figur, "rotation", deg_to_rad(16.0), 0.14).set_trans(Tween.TRANS_SINE)
	drehen.tween_property(figur, "rotation", 0.0, 0.24) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)

	await get_tree().create_timer(AUSWAHL_ANIMATION_DAUER).timeout


## Sanftes Atmen statt starrer Figuren — läuft endlos im Hintergrund, sobald
## die Auswahl einmal aufgebaut ist, unabhängig davon, ob sie gerade
## sichtbar ist. Bewusst sehr klein (±1,5 % der jeweiligen Kartenskalierung)
## und langsam (3,4 Sekunden je voller Zyklus, deutlich unter jeder Grenze
## für auffälliges Blinken): Es soll nur „lebendig" wirken, nicht auffallen.
func _atmen_starten() -> void:
	for karte in _karten:
		var figur: Figur = karte.get_node("Figur")
		var basis := figur.scale
		var atem := create_tween()
		atem.set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
		atem.set_loops()
		atem.tween_property(figur, "scale", basis * 1.015, 1.7) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		atem.tween_property(figur, "scale", basis * 0.985, 1.7) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


## Einziger Ort mit einem Ein/Aus-Schalter für Ton — auf dieser Karte, weil
## `zeigen()` sie vor **jeder** Runde neu einblendet (kein separater
## Einstellungs-Bildschirm nötig, siehe Aufgabenstellung „nicht
## überkomplizieren"). Absichtlich kein Klick-Ton beim Ausschalten: Die
## Stille selbst ist die Rückmeldung, dass es jetzt aus ist.
func _ton_umschalten() -> void:
	Ton.an_setzen(not Ton.an)
	_tonknopf_aktualisieren()
	if Ton.an:
		Ton.abspielen(&"ui_klick")


func _tonknopf_aktualisieren() -> void:
	_tonknopf.text = "🔊" if Ton.an else "🔇"


## Ein eigener, kräftigerer Rahmen für die zuletzt gespielte Karte — als
## Programmcode statt eines zweiten SubResource in `main.tscn`, weil sich
## eine benannte SubResource von hier aus nicht ansprechen lässt (ihre ID
## gilt nur innerhalb derselben `.tscn`-Datei). Bei jedem `zeigen()` neu
## gebaut statt zwischengespeichert: Drei kleine `StyleBoxFlat`-Objekte
## kosten nichts, ein zusätzliches statisches Feld nur für den Cache wäre
## mehr Zustand, als das hier wert ist. Dieselbe grüne Farbe wie das
## Abzeichen darunter — beide sollen als **eine** Aussage gelesen werden.
## Tiefe passend zur neuen `StyleBoxFlat_charakterkarte_aktiv` gehalten
## (Randbreite 3, Ecken 26, kräftiger Schatten) — sonst wirkte die
## markierte Karte flacher als die drei unmarkierten daneben.
func _markierter_stil() -> StyleBoxFlat:
	var stil := StyleBoxFlat.new()
	stil.bg_color = Color(0.164706, 0.203922, 0.172549, 0.97)
	stil.set_border_width_all(3)
	stil.border_color = Color(0.62, 0.86, 0.6, 0.9)
	stil.set_corner_radius_all(26)
	stil.shadow_color = Color(0.4, 0.8, 0.4, 0.28)
	stil.shadow_size = 24
	stil.shadow_offset = Vector2(0.0, 8.0)
	return stil
