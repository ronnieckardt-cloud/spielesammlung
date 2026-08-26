extends Node
## Gibt die Vielecke der drei Figuren als JSON aus. **Nicht Teil des Spiels.**
##
##     godot --headless --path . scenes/musterblatt.tscn
##
## Wozu: Eine Figur lässt sich nicht im Kopf beurteilen. Godot rendert im
## Headless-Betrieb aber nichts, was man ansehen könnte — also kommen die Zahlen
## hier heraus und ein Betrachter draußen macht ein Bild daraus.
##
## Wichtig dabei: Die Geometrie kommt aus `Gestalt` selbst. Ein Vorschau-Bild,
## das die Formen noch einmal nachbaut, zeigt irgendwann etwas anderes als das
## Spiel — und dann sieht man beim Prüfen einen Fehler nicht, der da ist.

func _ready() -> void:
	var alle: Array = []

	for variante in Charaktere.liste:
		var teile: Array = []
		for teil in Gestalt.teile(variante):
			var punkte: Array = []
			for p in teil.punkte:
				punkte.append([snappedf(p.x, 0.01), snappedf(p.y, 0.01)])
			teile.append({
				"punkte": punkte,
				"farbe": teil.farbe.to_html(false),
				"deckung": snappedf(teil.farbe.a, 0.01),
				"rand": teil.rand_breite,
				"kontur": teil.kontur.to_html(false),
			})

		var kasten := Gestalt.abmessungen(variante)
		alle.append({
			"id": String(variante.id),
			"name": variante.name,
			"staerke": variante.staerke,
			"kasten": [kasten.position.x, kasten.position.y, kasten.size.x, kasten.size.y],
			"teile": teile,
		})

	print("MUSTERBLATT " + JSON.stringify(alle))
	get_tree().quit()
