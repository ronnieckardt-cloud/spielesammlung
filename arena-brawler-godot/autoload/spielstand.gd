extends Node
## Was eine Runde überdauert: gewählter Charakter und Bestleistung.
##
## Autoload und damit von überall erreichbar — deshalb hält es bewusst **nur**
## das, was wirklich über die Runde hinaus gilt. Punkte, Leben und Wellen
## gehören der laufenden Runde und haben hier nichts zu suchen; sonst wird ein
## Autoload über die Zeit zur Abstellkammer, in der niemand mehr weiß, wer was
## setzt.
##
## Gespeichert wird nach `user://`, nicht neben das Projekt: Das ist der einzige
## Ort, auf den ein exportiertes Spiel auf jedem System schreiben darf.

signal charakter_gewechselt(variante)
signal rekord_aufgestellt(punkte: int, welle: int)

const SPEICHERPFAD := "user://spielstand.cfg"

var charakter_id: StringName = &"ausgewogen"
var beste_punkte: int = 0
var beste_welle: int = 0


func _ready() -> void:
	laden()


func charakter() -> Charaktere.Variante:
	var v := Charaktere.nach_id(charakter_id)
	return v if v != null else Charaktere.standard()


func charakter_setzen(id: StringName) -> void:
	if Charaktere.nach_id(id) == null:
		push_warning("Unbekannter Charakter: %s — bleibe bei %s" % [id, charakter_id])
		return
	charakter_id = id
	charakter_gewechselt.emit(charakter())


## Meldet eine beendete Runde. Punkte und Welle zählen **getrennt**: Man kann
## dieselbe Welle erreichen und dabei mehr Gegner erwischt haben — das ist ein
## Punkterekord ohne Wellenrekord, und beides ist eine eigene Leistung.
func runde_melden(punkte: int, welle: int) -> bool:
	var ist_rekord := punkte > beste_punkte or welle > beste_welle
	if not ist_rekord:
		return false

	beste_punkte = maxi(beste_punkte, punkte)
	beste_welle = maxi(beste_welle, welle)
	speichern()
	rekord_aufgestellt.emit(beste_punkte, beste_welle)
	return true


func speichern() -> void:
	var datei := ConfigFile.new()
	datei.set_value("spieler", "charakter", String(charakter_id))
	datei.set_value("rekord", "punkte", beste_punkte)
	datei.set_value("rekord", "welle", beste_welle)

	var fehler := datei.save(SPEICHERPFAD)
	if fehler != OK:
		# Nicht abbrechen: Ein Prototyp darf am Speichern nicht scheitern.
		push_warning("Spielstand konnte nicht geschrieben werden (Fehler %d)" % fehler)


func laden() -> void:
	var datei := ConfigFile.new()
	if datei.load(SPEICHERPFAD) != OK:
		return  # Noch nichts da — die Startwerte oben gelten.

	# Gespeichertes ist nie vertrauenswürdig: ältere Fassung, halb geschrieben,
	# von Hand verändert. Deshalb jeden Wert prüfen statt blind übernehmen.
	var gelesene_id := StringName(datei.get_value("spieler", "charakter", String(STANDARD)))
	charakter_id = gelesene_id if Charaktere.nach_id(gelesene_id) != null else STANDARD

	beste_punkte = maxi(0, int(datei.get_value("rekord", "punkte", 0)))
	beste_welle = maxi(0, int(datei.get_value("rekord", "welle", 0)))


const STANDARD := &"ausgewogen"


func rekord_zeile() -> String:
	if beste_punkte == 0 and beste_welle == 0:
		return "Noch kein Lauf gewertet"
	return "Bester Lauf: %d Punkte · Welle %d" % [beste_punkte, beste_welle]
