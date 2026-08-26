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
## Antippen mehr an.

signal gewaehlt(charakter_id: StringName)

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

		karte.pressed.connect(_bei_druck.bind(variante.id))

	_tonknopf.pressed.connect(_ton_umschalten)


## Von `main.gd` aufgerufen, bevor die Auswahl sichtbar wird — auch nach
## einem Neustart wieder, deshalb hier und nicht nur einmalig in `_ready()`:
## Der zuletzt gespielte Charakter und die Bestleistung können sich seit dem
## letzten Mal geändert haben.
func zeigen() -> void:
	var aktuelle_id := Spielstand.charakter_id
	for i in _karten.size():
		var markiert: bool = Charaktere.liste[i].id == aktuelle_id
		_karten[i].get_node("Marke").visible = markiert
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
	Ton.abspielen(&"ui_klick")
	visible = false
	gewaehlt.emit(charakter_id)


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
func _markierter_stil() -> StyleBoxFlat:
	var stil := StyleBoxFlat.new()
	stil.bg_color = Color(0.176471, 0.211765, 0.180392, 0.96)
	stil.set_border_width_all(3)
	stil.border_color = Color(0.62, 0.86, 0.6, 0.9)
	stil.set_corner_radius_all(20)
	stil.shadow_color = Color(0.4, 0.8, 0.4, 0.22)
	stil.shadow_size = 14
	return stil
