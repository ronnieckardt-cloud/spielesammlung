class_name ArenaStimmung
extends Node2D
## Lebendigerer Arenaboden: ein weicher Lichtfleck in der Mitte (atmet sehr
## langsam) und dunkle Ecken. Gleiche Ring-Technik wie `AuswahlAtmo`, ohne
## Shader und ohne Bild. Bewusst schwach gehalten — Figuren und Hindernisse
## müssen darauf lesbar bleiben. Zeichnet unter allen Spielfiguren (Arena
## kommt im Baum vor ihnen).

const GROESSE := Vector2(1152, 648)
const ATEM_TAKT := 6.0

var _zeit := 0.0


func _process(delta: float) -> void:
	_zeit += delta
	queue_redraw()


func _draw() -> void:
	var atem := 0.85 + 0.15 * sin(_zeit * TAU / ATEM_TAKT)
	for i in 8:
		var t := float(i) / 7.0
		draw_circle(GROESSE / 2.0, lerpf(380.0, 70.0, t), Color(0.55, 0.7, 1.0, 0.012 * atem * (0.4 + t)))
	for ecke in [Vector2.ZERO, Vector2(GROESSE.x, 0.0), GROESSE, Vector2(0.0, GROESSE.y)]:
		for i in 6:
			var t := float(i) / 5.0
			draw_circle(ecke, lerpf(300.0, 100.0, t), Color(0, 0, 0, 0.022))
