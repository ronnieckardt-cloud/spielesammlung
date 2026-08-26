class_name Gegnergestalt
extends RefCounted
## Wie die drei Gegnertypen aussehen — **reine Geometrie, kein Node, keine
## Uhr**. Das Gegenstück zu `Gestalt`, nur für Gegner statt Charaktere.
##
## Bewusst eine eigene Datei statt eines Zusatzes an `Gestalt`: Ein Gegner
## ist kein `Charaktere.Variante`, und `Gestalt.teile()` verzweigt bereits
## über `variante.id` — ein vierter, fünfter Zweig für Gegnertypen dort würde
## zwei völlig verschiedene Dinge (spielbare Charaktere, Gegner) in einer
## Funktion vermischen. Was sich beide teilen, ist einzig die Anzeige
## (`Formanzeige`) und der Teil-Datentyp (`Gestalt.Teil`) — beide bewusst
## wiederverwendet, keine zweite Zeichenlogik.
##
## ## Schattenriss zuerst
##
## Dieselbe Anforderung wie bei den drei Charakteren: Deckt man alle drei
## Gegnertypen komplett schwarz ab, muss man sie trotzdem auseinanderhalten.
## Der Verfolger ist ein Stern (spitz, acht Zacken — unverändert seit der
## ersten Fassung), der Panzer ein breites, kaum verjüngtes Achteck mit
## seitlichen Platten, der Flinke ein schlanker, deutlich länger als breiter
## Rumpf mit zwei Widerhaken am Bug. Drei grundverschiedene Umrisse, keine
## Variation über dieselbe Grundform.


## Halbe Breite des breitesten Gegners (Panzer). Für Prüfungen, dieselbe
## Rolle wie `Gestalt.HALBE_BREITE`.
const HALBE_BREITE := 21.0


static func teile(art: Gegnertypen.Art) -> Array[Gestalt.Teil]:
	if art == null:
		return []

	match art.id:
		&"panzer":
			return _panzer(art)
		&"flink":
			return _flink(art)
		_:
			return _verfolger(art)


## Umschließendes Rechteck aller Teile ohne den Schatten (Index 0) — für
## Prüfungen, dieselbe Konvention wie `Gestalt.abmessungen`.
static func abmessungen(art: Gegnertypen.Art) -> Rect2:
	var alle := teile(art)
	var kasten := Rect2()
	var erster := true

	for i in range(1, alle.size()):
		for punkt in alle[i].punkte:
			if erster:
				kasten = Rect2(punkt, Vector2.ZERO)
				erster = false
			else:
				kasten = kasten.expand(punkt)

	return kasten


# ── Bausteine (eigenständig, nicht mit Gestalt geteilt — siehe Kommentar oben) ──

static func _kreis(mitte: Vector2, radius: float, ecken: int = 12) -> PackedVector2Array:
	var p := PackedVector2Array()
	for i in ecken:
		p.append(mitte + Vector2.from_angle(TAU * float(i) / float(ecken)) * radius)
	return p


static func _gespiegelt(punkte: PackedVector2Array) -> PackedVector2Array:
	var p := PackedVector2Array()
	for i in range(punkte.size() - 1, -1, -1):
		p.append(Vector2(-punkte[i].x, punkte[i].y))
	return p


static func _paar(liste: Array[Gestalt.Teil], punkte: PackedVector2Array, farbe: Color,
		rand: float, kontur: Color, schattiert: bool = true) -> void:
	liste.append(Gestalt.Teil.new(punkte, farbe, rand, kontur, schattiert))
	liste.append(Gestalt.Teil.new(_gespiegelt(punkte), farbe, rand, kontur, schattiert))


static func _schatten(radius: float, versatz: float, deckung: float) -> Gestalt.Teil:
	return Gestalt.Teil.new(_kreis(Vector2(0, versatz), radius, 16), Color(0, 0, 0, deckung), 0.0, Color.BLACK, false)


static func _glanz(mitte: Vector2, radius_x: float, radius_y: float, farbe: Color) -> Gestalt.Teil:
	var p := PackedVector2Array()
	for i in 10:
		var t := TAU * float(i) / 10.0
		p.append(mitte + Vector2(cos(t) * radius_x, sin(t) * radius_y))
	return Gestalt.Teil.new(p, farbe, 0.0, Color.BLACK, false)


# ── Die drei Gegnertypen ────────────────────────────────────────────────────

## Verfolger — der Grundtyp. Der Stern blieb unverändert (acht Zacken, seit
## jeher „spitz und warnfarben"), neu sind Schatten, ein schattierter Kern
## und ein Glanzpunkt: Vorher zwei flache `Polygon2D` ohne jede Rundung, das
## war der auffälligste Teil des „wirkt noch flach"-Befunds.
##
## Der Stern bleibt bewusst **flach** (kein Verlauf): Er ist konkav (acht
## wechselnde Zacken- und Kerbenpunkte), und ein Eckfarben-Verlauf würde an
## den Kerben sichtbar knicken — dieselbe Falle, vor der `Gestalt`s
## Konvex-Regel bei den Charakteren schützt. Der runde Kern darüber ist
## konvex und trägt den Verlauf stattdessen.
static func _verfolger(art: Gegnertypen.Art) -> Array[Gestalt.Teil]:
	var t: Array[Gestalt.Teil] = []
	t.append(_schatten(13.0, 3.0, 0.30))

	t.append(Gestalt.Teil.new(PackedVector2Array([
		Vector2(0, -14), Vector2(5, -5), Vector2(14, 0), Vector2(5, 5),
		Vector2(0, 14), Vector2(-5, 5), Vector2(-14, 0), Vector2(-5, -5),
	]), art.koerper, 1.8, art.kontur, false))

	t.append(Gestalt.Teil.new(_kreis(Vector2.ZERO, 6.4, 10), art.kern, 1.4, art.kontur))
	t.append(_glanz(Vector2(-2.4, -3.2), 2.4, 1.8, art.kern.lightened(0.4)))

	return t


## Panzer-Verfolger — das Gegenstück zum Stern: breit, kaum verjüngt, nirgends
## spitz. Ein Achteck als Rumpf plus zwei seitliche, gepaarte Platten, die
## über den Rumpf hinausragen — genau die ragen macht die Silhouette
## erkennbar breiter als jeden anderen Typ, nicht nur der größere
## Kollisionsradius allein.
static func _panzer(art: Gegnertypen.Art) -> Array[Gestalt.Teil]:
	var t: Array[Gestalt.Teil] = []
	t.append(_schatten(17.0, 3.5, 0.32))

	t.append(Gestalt.Teil.new(PackedVector2Array([
		Vector2(-9, -14), Vector2(9, -14), Vector2(15, -7), Vector2(15, 7),
		Vector2(9, 14), Vector2(-9, 14), Vector2(-15, 7), Vector2(-15, -7),
	]), art.koerper, 2.2, art.kontur))

	_paar(t, PackedVector2Array([
		Vector2(-14, -8), Vector2(-21, -3), Vector2(-21, 3), Vector2(-14, 8),
	]), art.kern, 1.8, art.kontur)

	t.append(Gestalt.Teil.new(_kreis(Vector2.ZERO, 5.5, 8), art.kern, 1.4, art.kontur))
	t.append(_glanz(Vector2(-3.2, -6.0), 3.6, 2.4, art.kern.lightened(0.4)))

	return t


## Flink — lang und schmal statt breit, das genaue Gegenteil des Panzers.
## Zwei Widerhaken am Bug, gepaart, sind das Erkennungsmerkmal: Sie zeigen
## nach hinten-außen, wie bei einem Pfeil, der schon geflogen ist.
static func _flink(art: Gegnertypen.Art) -> Array[Gestalt.Teil]:
	var t: Array[Gestalt.Teil] = []
	t.append(_schatten(10.0, 2.5, 0.26))

	t.append(Gestalt.Teil.new(PackedVector2Array([
		Vector2(0, -15), Vector2(4, -6), Vector2(4, 10),
		Vector2(0, 15), Vector2(-4, 10), Vector2(-4, -6),
	]), art.koerper, 1.6, art.kontur))

	_paar(t, PackedVector2Array([
		Vector2(-4, -4), Vector2(-10, 0), Vector2(-4, 4),
	]), art.kern, 1.2, art.kontur)

	t.append(Gestalt.Teil.new(_kreis(Vector2(0, -3), 3.6, 8), art.kern, 1.0, art.kontur))
	t.append(_glanz(Vector2(-1.4, -8.0), 1.8, 2.6, art.kern.lightened(0.4)))

	return t
