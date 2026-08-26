class_name Figur
extends Formanzeige
## Zeigt einen `Charaktere.Variante` an. **Kennt keine Spielregel.**
##
## Alles Zeichnende (Verlauf, Kontur, Lichtrichtung) steckt in `Formanzeige` —
## dieser Knoten fügt nur das Charakter-Spezifische hinzu: einen Startwert
## fürs Bearbeiten im Editor und die Übersetzung von einer `Variante` in eine
## fertige Teileliste (`Gestalt.teile`). Dadurch kann derselbe Knoten im
## Spiel am Spieler hängen und später auf dem Auswahlbildschirm stehen —
## dort mit `scale`, sonst nichts anders.

## Startwert. Zur Laufzeit geht der Wechsel über `zeigen()` — bewusst **kein**
## Setter darauf: `zeigen()` schreibt selbst wieder in dieses Feld, ein Setter
## würde sich damit endlos selbst aufrufen.
@export var charakter_id: StringName = &"ausgewogen"


func _ready() -> void:
	if _teile.is_empty():
		zeigen(Charaktere.nach_id(charakter_id))


## Eine Variante anzeigen. Unbekannt oder `null` fällt auf den Standard zurück —
## eine unsichtbare Figur wäre die schlechtere Antwort auf einen alten
## Spielstand.
func zeigen(variante: Charaktere.Variante) -> void:
	if variante == null:
		variante = Charaktere.standard()

	charakter_id = variante.id
	zeigen_teile(Gestalt.teile(variante))
