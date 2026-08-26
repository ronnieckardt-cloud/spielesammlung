class_name Figur
extends Node2D
## Zeichnet die Gestalt eines Charakters. **Kennt keine Spielregel.**
##
## Die Aufteilung ist dieselbe wie überall in diesem Projekt: `Gestalt` rechnet
## die Vielecke aus (ohne Node, prüfbar), dieser Knoten malt sie hin. Dadurch
## kann derselbe Knoten im Spiel am Spieler hängen und später auf dem
## Auswahlbildschirm stehen — dort mit `scale`, sonst nichts anders.
##
## Bewusst ein `_draw()` und nicht mehrere `Polygon2D`-Kinder: Ein Wechsel des
## Charakters mitten im Spiel müsste sonst Knoten anlegen und wegwerfen. So ist
## es ein Neuzeichnen.
##
## ## Warum ein Verlauf und keine flache Farbe
##
## Eine einzige Flächenfarbe je Teil sieht aus wie ein Aufkleber, kein Körper
## — dieselbe Lektion, die die Spielesammlung nebenan beim Sternenschlucker
## schon gelernt hat: „Radialverlauf im Körper, Licht oben links, dazu ein
## einzelner harter Glanzpunkt." Jedes schattierte Teil bekommt hier deshalb
## keine flache Fläche, sondern einen Verlauf von hell (zur Lichtseite) nach
## dunkel (zur Gegenseite) — über Godots `draw_polygon` mit einer Farbe je
## Eckpunkt statt einer Farbe fürs ganze Vieleck.

## Wohin das Licht fällt — in **lokalen** Koordinaten der Figur, nicht der
## Welt. Dreht sich die Anzeige mit der Laufrichtung, dreht sich der Glanz
## mit: Das Licht sitzt gedanklich an der Figur, nicht an der Arena. Genau so
## machen es Top-Down-Actionspiele durchweg — ein Licht, das an der Welt
## hinge, müsste bei jeder Drehung neu gerechnet werden und brächte für den
## Aufwand keinen sichtbaren Gewinn.
const LICHT := Vector2(-0.6, -0.8)

## Startwert. Zur Laufzeit geht der Wechsel über `zeigen()` — bewusst **kein**
## Setter darauf: `zeigen()` schreibt selbst wieder in dieses Feld, ein Setter
## würde sich damit endlos selbst aufrufen.
@export var charakter_id: StringName = &"ausgewogen"

var _teile: Array[Gestalt.Teil] = []


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
	_teile = Gestalt.teile(variante)
	queue_redraw()


## Nur für Prüfungen: wie viele Teile gerade gezeichnet werden.
func teile_anzahl() -> int:
	return _teile.size()


func _draw() -> void:
	for teil in _teile:
		if teil.schattiert:
			draw_polygon(teil.punkte, _verlauf(teil.punkte, teil.farbe))
		else:
			# Flach bleibt, was selbst schon wie Licht wirken soll (Visier,
			# Streifen, Glanzpunkt) oder zu klein für einen sichtbaren
			# Verlauf ist — ein Verlauf auf drei Pixeln ist nur Rauschen.
			draw_colored_polygon(teil.punkte, teil.farbe)

		if teil.rand_breite <= 0.0:
			continue

		# `draw_polyline` schließt nicht von selbst — ohne den angehängten
		# ersten Punkt bleibt eine Lücke an der Naht.
		var ring := teil.punkte.duplicate()
		ring.append(teil.punkte[0])
		draw_polyline(ring, teil.kontur, teil.rand_breite, true)


## Je Eckpunkt eine eigene Farbe statt einer für die ganze Fläche: hell dort,
## wo der Punkt zur Lichtrichtung zeigt, dunkel auf der Gegenseite. `draw_polygon`
## blendet zwischen den Eckfarben selbst weich über die Fläche — das ist der
## ganze Trick, kein Shader nötig.
func _verlauf(punkte: PackedVector2Array, basis: Color) -> PackedColorArray:
	var mitte := Vector2.ZERO
	for p in punkte:
		mitte += p
	mitte /= punkte.size()

	var hell := basis.lightened(0.34)
	var dunkel := basis.darkened(0.32)
	var farben := PackedColorArray()

	for p in punkte:
		var richtung := p - mitte
		# Punkte nah der Mitte (z. B. bei sehr kleinen Teilen) hätten sonst
		# eine beliebige, wackelige Richtung — 0,5 heißt schlicht „neutral".
		var t := 0.5
		if richtung.length_squared() > 0.01:
			t = clampf(0.5 + richtung.normalized().dot(LICHT) * 0.6, 0.0, 1.0)
		farben.append(dunkel.lerp(hell, t))

	return farben
