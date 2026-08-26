class_name Arena
extends Node2D
## Boden und Begrenzung des Spielfelds.
##
## Die Wände werden **aus der Größe erzeugt**, nicht in der Szene von Hand
## gezeichnet: Sonst muss man bei jeder Änderung an vier Stellen dieselbe Zahl
## nachziehen, und die vierte vergisst man. `groesse` ist die einzige Quelle.
## Raster und Eckmarken entstehen aus demselben Grund ebenfalls hier und
## nicht als von Hand gesetzte Punkte in der Szene.
##
## **Der Boden war eine einzige flache Fläche, keine einzige Struktur.**
## Zwei Griffe beheben das, beide billig (kein Shader, keine Bilddatei):
## `vertex_colors` auf dem Boden-Polygon geben ihm denselben diagonalen
## Licht-oben-links-Verlauf wie jede Figur im Spiel (`Formanzeige.LICHT`),
## und ein dünnes, sehr blasses Liniengitter (`Raster`) macht die Fläche
## lesbar als Boden mit Ausdehnung, nicht als Farbfeld ohne Maßstab.

## Dicke der Wandkörper. Deutlich mehr als ein Haar: Ein zu dünner
## Kollisionskörper wird bei hohem Tempo in einem Physikschritt übersprungen.
const WANDDICKE := 64.0

## Abstand der Rasterlinien — grob eine Spielfigur-Länge mal drei, spürbar
## als Maßstab, ohne bei jedem Schritt eine neue Linie zu zeigen.
const RASTER_ABSTAND := 96.0
const RASTER_BREITE := 1.5
const RASTER_FARBE := Color(1, 1, 1, 0.05)

## Ein Stück innerhalb des Randes: eine zweite, kühlere Linie plus vier
## nach innen zeigende Eckmarken — das Gegenstück zum wärmeren, dickeren
## Außenrand, zusammen liest sich das als „Energiefeld" statt als bloße
## Wand.
const RAND_INNEN_ABSTAND := 14.0
const RAND_INNEN_FARBE := Color(0.55, 0.75, 1.0, 0.28)
const ECKE_LAENGE := 28.0
const ECKE_BREITE := 3.0
const ECKE_FARBE := Color(0.55, 0.75, 1.0, 0.85)

## Optik der Hindernisse — dieselbe Handschrift wie der Rest der Arena:
## Licht oben links (`vertex_colors`, wie beim Boden), ein echter, aber
## billiger Schatten als versetzte, dunkle Kopie der Fläche statt eines
## Shaders, dazu eine helle Kante wie beim äußeren Arenarand.
const HINDERNIS_FARBE := Color(0.30, 0.34, 0.46)
const HINDERNIS_KANTE_FARBE := Color(0.58, 0.66, 0.86, 0.9)
const HINDERNIS_SCHATTEN_FARBE := Color(0, 0, 0, 0.32)
const HINDERNIS_SCHATTEN_VERSATZ := Vector2(5, 6)

@export var groesse := Vector2(1152, 648):
	set(wert):
		groesse = wert
		if is_inside_tree():
			aufbauen()

@export var bodenfarbe := Color("232634")
@export var randfarbe := Color("4a5570")

## Feste Blöcke innerhalb der Arena, in arena-lokalen Koordinaten (0,0 bis
## `groesse`) — dieselbe Herkunft wie `Karten.Karte.hindernisse`. Leer heißt
## „offene Arena", genau wie die Karte „Offen".
@export var hindernisse: Array[Rect2] = []:
	set(wert):
		hindernisse = wert
		if is_inside_tree():
			_hindernisse_aufbauen()

@onready var _boden: Polygon2D = $Boden
@onready var _rand: Line2D = $Rand
@onready var _rand_innen: Line2D = $RandInnen
@onready var _raster: Node2D = $Raster
@onready var _ecken: Node2D = $Ecken
@onready var _waende: StaticBody2D = $Waende
@onready var _hindernis_koerper: StaticBody2D = $HindernisKoerper
@onready var _hindernis_anzeige: Node2D = $HindernisAnzeige


func _ready() -> void:
	aufbauen()


## Der Bereich, in dem sich Figuren aufhalten dürfen — in Weltkoordinaten.
func flaeche() -> Rect2:
	return Rect2(global_position, groesse)


## `hindernisse` in Weltkoordinaten — für Code außerhalb der Arena, der mit
## globalen Spielerpositionen rechnet (siehe `main.gd` beim Kartenwechsel).
func hindernisse_welt() -> Array[Rect2]:
	var ergebnis: Array[Rect2] = []
	for r in hindernisse:
		ergebnis.append(Rect2(r.position + global_position, r.size))
	return ergebnis


func aufbauen() -> void:
	var ecken_punkte := PackedVector2Array([
		Vector2.ZERO, Vector2(groesse.x, 0), groesse, Vector2(0, groesse.y),
	])

	_boden.polygon = ecken_punkte
	_boden.color = bodenfarbe
	# Licht oben links, wie überall sonst im Spiel (`Formanzeige.LICHT`) —
	# dieselbe Konvention, nur diesmal auf vier Eckpunkten statt auf einem
	# Vieleck mit vielen. Ohne eigene `vertex_colors` würde Godot sonst
	# `_boden.color` an allen vier Ecken gleich einfärben, exakt die flache
	# Fläche, die hier behoben werden soll.
	_boden.vertex_colors = PackedColorArray([
		bodenfarbe.lightened(0.05), bodenfarbe.lightened(0.015),
		bodenfarbe.darkened(0.05), bodenfarbe.darkened(0.015),
	])

	_rand.points = PackedVector2Array([
		Vector2.ZERO, Vector2(groesse.x, 0), groesse, Vector2(0, groesse.y), Vector2.ZERO,
	])
	_rand.default_color = randfarbe

	var einzug := RAND_INNEN_ABSTAND
	_rand_innen.points = PackedVector2Array([
		Vector2(einzug, einzug), Vector2(groesse.x - einzug, einzug),
		Vector2(groesse.x - einzug, groesse.y - einzug), Vector2(einzug, groesse.y - einzug),
		Vector2(einzug, einzug),
	])
	_rand_innen.default_color = RAND_INNEN_FARBE
	_rand_innen.width = 2.0

	_raster_zeichnen()
	_ecken_zeichnen(ecken_punkte)
	_waende_setzen()
	_hindernisse_aufbauen()


## Dünne, sehr blasse Linien quer über den Boden — als Kind-Knoten erzeugt,
## nicht als ein einziges `_draw()`: `Line2D` übernimmt Rundung und
## Kappen-Rechnung selbst, und die Zahl der Linien bleibt hier ohnehin klein
## (bei 1152×648 und 96 Abstand rund ein Dutzend).
func _raster_zeichnen() -> void:
	for kind in _raster.get_children():
		kind.queue_free()

	var x := RASTER_ABSTAND
	while x < groesse.x - 1.0:
		_raster.add_child(_linie(PackedVector2Array([Vector2(x, 0), Vector2(x, groesse.y)])))
		x += RASTER_ABSTAND

	var y := RASTER_ABSTAND
	while y < groesse.y - 1.0:
		_raster.add_child(_linie(PackedVector2Array([Vector2(0, y), Vector2(groesse.x, y)])))
		y += RASTER_ABSTAND


func _linie(punkte: PackedVector2Array) -> Line2D:
	var l := Line2D.new()
	l.points = punkte
	l.width = RASTER_BREITE
	l.default_color = RASTER_FARBE
	return l


## Vier nach innen zeigende „L"-Marken, je eine an jeder Ecke — derselbe
## Kniff wie ein Kamera- oder Ziel-Sucher: Er sagt „hier ist die Grenze",
## ohne die ganze Kante nachzuzeichnen.
func _ecken_zeichnen(ecken_punkte: PackedVector2Array) -> void:
	for kind in _ecken.get_children():
		kind.queue_free()

	# Für jede Ecke, in welche Richtung (x, y) ihre beiden Schenkel von der
	# Ecke aus nach innen zeigen.
	var richtungen := [Vector2(1, 1), Vector2(-1, 1), Vector2(-1, -1), Vector2(1, -1)]

	for i in ecken_punkte.size():
		var p := ecken_punkte[i]
		var r: Vector2 = richtungen[i]
		var l := Line2D.new()
		l.points = PackedVector2Array([
			p + Vector2(r.x * ECKE_LAENGE, 0), p, p + Vector2(0, r.y * ECKE_LAENGE),
		])
		l.width = ECKE_BREITE
		l.default_color = ECKE_FARBE
		_ecken.add_child(l)


func _waende_setzen() -> void:
	for kind in _waende.get_children():
		kind.queue_free()

	var h := WANDDICKE / 2.0
	# oben, unten, links, rechts — jeweils Mittelpunkt und halbe Ausdehnung
	var seiten := [
		[Vector2(groesse.x / 2.0, -h), Vector2(groesse.x / 2.0 + WANDDICKE, h)],
		[Vector2(groesse.x / 2.0, groesse.y + h), Vector2(groesse.x / 2.0 + WANDDICKE, h)],
		[Vector2(-h, groesse.y / 2.0), Vector2(h, groesse.y / 2.0 + WANDDICKE)],
		[Vector2(groesse.x + h, groesse.y / 2.0), Vector2(h, groesse.y / 2.0 + WANDDICKE)],
	]

	for seite in seiten:
		var form := RectangleShape2D.new()
		form.size = seite[1] * 2.0

		var kollision := CollisionShape2D.new()
		kollision.shape = form
		kollision.position = seite[0]
		_waende.add_child(kollision)


## Kollision **und** Optik für jedes Hindernis, aus derselben Rechteckliste.
## Ein eigener Kollisionskörper (`_hindernis_koerper`, Ebene "hindernis") statt
## der Wände auf Ebene "welt": Geschosse sollen an Hindernissen abprallen,
## am äußeren Arenarand bisher aber nicht (der begrenzt sie schon über die
## eigene Reichweite) — zwei getrennte Ebenen halten diese Entscheidung
## auseinander, ohne bestehendes Verhalten am Rand zu ändern.
func _hindernisse_aufbauen() -> void:
	# `queue_free()`, nicht `.free()` — genau umgekehrt zur ersten Fassung.
	# Ein Kartenwechsel läuft in echtem Spielbetrieb mitten in Godots
	# normaler Bildverarbeitung, potenziell überlappend mit einer noch
	# laufenden Physik-Abfrage (`move_and_slide()`, Kollisionssignale). Ein
	# sofortiges `.free()` einer Kollisionsform genau in diesem Moment
	# meldete real: „Can't change this state while flushing queries." —
	# reproduzierbar in der simulierten Runde (`rundenprobe.tscn`), nicht in
	# den synchronen Kopflos-Prüfungen, die nie einen echten Bildschritt
	# laufen lassen. `queue_free()` ist der sichere, im ganzen Projekt sonst
	# ohnehin übliche Weg (siehe `_raster_zeichnen`/`_ecken_zeichnen`/
	# `_waende_setzen` oben) — ein Bild lang bestehen alte und neue
	# Hindernisse nebeneinander, unsichtbar, weil neue Formen einfach
	# darüber gezeichnet werden.
	for kind in _hindernis_koerper.get_children():
		kind.queue_free()
	for kind in _hindernis_anzeige.get_children():
		kind.queue_free()

	for rechteck in hindernisse:
		var mitte := rechteck.position + rechteck.size / 2.0

		var form := RectangleShape2D.new()
		form.size = rechteck.size
		var kollision := CollisionShape2D.new()
		kollision.shape = form
		kollision.position = mitte
		_hindernis_koerper.add_child(kollision)

		var punkte := _rechteck_punkte(rechteck.size)

		# Schatten zuerst, versetzt nach unten rechts — dieselbe Reihenfolge
		# wie überall sonst im Projekt: erst die dunkle Fläche, dann das
		# eigentliche Teil darüber.
		var schatten := Polygon2D.new()
		schatten.polygon = punkte
		schatten.position = mitte + HINDERNIS_SCHATTEN_VERSATZ
		schatten.color = HINDERNIS_SCHATTEN_FARBE
		_hindernis_anzeige.add_child(schatten)

		var flaeche := Polygon2D.new()
		flaeche.polygon = punkte
		flaeche.position = mitte
		# Dasselbe Licht-oben-links wie der Boden (siehe `aufbauen()`), nur
		# etwas kräftiger — ein kleiner Block braucht mehr Kontrast als die
		# große Bodenfläche, um überhaupt als Körper zu wirken.
		flaeche.vertex_colors = PackedColorArray([
			HINDERNIS_FARBE.lightened(0.16), HINDERNIS_FARBE.lightened(0.04),
			HINDERNIS_FARBE.darkened(0.1), HINDERNIS_FARBE.darkened(0.02),
		])
		_hindernis_anzeige.add_child(flaeche)

		var kante := Line2D.new()
		var umriss := punkte.duplicate()
		umriss.append(punkte[0])
		kante.points = umriss
		kante.position = mitte
		kante.width = 2.0
		kante.default_color = HINDERNIS_KANTE_FARBE
		_hindernis_anzeige.add_child(kante)


## Die vier Eckpunkte eines Rechtecks, mittig um den Ursprung — dieselbe
## lokale Form für Kollision (übers `position`-Feld verschoben) und Optik.
func _rechteck_punkte(groesse_stueck: Vector2) -> PackedVector2Array:
	var h := groesse_stueck / 2.0
	return PackedVector2Array([
		Vector2(-h.x, -h.y), Vector2(h.x, -h.y), Vector2(h.x, h.y), Vector2(-h.x, h.y),
	])
