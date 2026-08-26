class_name Aufwertungsauswahl
extends CanvasLayer
## Die drei Karten nach einer geschafften Welle.
##
## **Zeigt nur an und meldet die Wahl — wendet sie nicht selbst an.** Das
## macht `Spieler.aufwertung_anwenden()`; diese Datei kennt nur die Karten
## und das Antippen, keine einzige Spielregel. Dieselbe Trennung wie überall
## im Projekt: Was eine Aufwertung bewirkt, steht rein in `Aufwertungen`, wie
## sie angeboten wird, steht hier.
##
## Braucht `process_mode = ALWAYS` (gesetzt am Elternknoten `Oberflaeche` in
## `main.tscn`, siehe die Erklärung in `rundenende.gd`), sonst würden die
## Karten während der Pause, in der sie überhaupt erst zu sehen sind, gar
## keine Antippen mehr entgegennehmen.

signal gewaehlt(art_id: StringName)

@onready var _karten: Array[Button] = [$Karte1, $Karte2, $Karte3]

var _angebotene_arten: Array[Aufwertungen.Art] = []


func _ready() -> void:
	visible = false
	for i in _karten.size():
		_karten[i].pressed.connect(_bei_druck.bind(i))


## Zeigt bis zu drei zufällige Karten aus dem, was für `spieler` gerade noch
## etwas bewirken würde (`Spieler.verfuegbare_aufwertungen`). Sind schon fast
## alle Arten ausgereizt, erscheinen entsprechend weniger — nie eine Karte,
## die wirkungslos wäre, und nie dieselbe Art doppelt.
func zeigen(spieler: Spieler) -> void:
	var verfuegbar := spieler.verfuegbare_aufwertungen()
	verfuegbar.shuffle()
	_angebotene_arten = verfuegbar.slice(0, mini(3, verfuegbar.size()))

	for i in _karten.size():
		if i < _angebotene_arten.size():
			var art := _angebotene_arten[i]
			# Zwei eigene Labels statt eines einzigen Button-Texts: Nur so
			# lässt sich der Titel größer/fett und die Beschreibung kleiner/
			# gedämpft setzen — ein reiner `Button.text` kennt nur eine
			# einzige Schriftgröße für den ganzen Block.
			_karten[i].get_node("Titel").text = art.titel
			_karten[i].get_node("Beschreibung").text = art.beschreibung
			_karten[i].visible = true
			_karten[i].disabled = false
		else:
			_karten[i].visible = false

	visible = true


func _bei_druck(index: int) -> void:
	if index >= _angebotene_arten.size():
		return

	var art_id := _angebotene_arten[index].id
	Ton.abspielen(&"aufwertung_gewaehlt")
	visible = false
	gewaehlt.emit(art_id)
