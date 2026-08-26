class_name Formanzeige
extends Node2D
## Zeichnet eine beliebige, schon fertig berechnete Teileliste
## (`Gestalt.Teil`). **Kennt keine Spielregel und keine bestimmte Figur** —
## das ist der ganze Witz: Sowohl der Spieler (`Figur`, mit Charakteren aus
## `Gestalt`/`Charaktere`) als auch die Gegner (`Gegnergestalt`) benutzen
## denselben Knoten zum Malen, keine zweite Zeichenlogik für „sieht fast
## gleich aus, ist aber ein Gegner".
##
## Bewusst ein `_draw()` und nicht mehrere `Polygon2D`-Kinder: Ein Wechsel
## der angezeigten Teile mitten im Spiel müsste sonst Knoten anlegen und
## wegwerfen. So ist es ein Neuzeichnen.
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

var _teile: Array[Gestalt.Teil] = []


## Eine schon fertig berechnete Teileliste anzeigen. `anzeige_id` ist rein
## fürs Nachschlagen bei Prüfungen (siehe `Figur.charakter_id`) — hier selbst
## wird sie nicht benutzt.
func zeigen_teile(teile: Array[Gestalt.Teil]) -> void:
	_teile = teile
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
