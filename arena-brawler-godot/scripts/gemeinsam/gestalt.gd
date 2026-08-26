class_name Gestalt
extends RefCounted
## Wie die drei Charaktere aussehen — **reine Geometrie, kein Node, keine Uhr**.
##
## Getrennt vom zeichnenden Knoten aus demselben Grund wie `bewegung.gd`: So
## lassen sich Umriss, Breite und Länge durchrechnen, ohne dass eine Szene
## läuft. Und der Auswahlbildschirm zeichnet später dieselbe Figur, ohne dass
## dafür ein Spieler gebaut werden muss.
##
## ## Blick von oben — vorn ist −Y
##
## Das ist die Entscheidung, an der alles andere hängt. `spieler.gd` dreht die
## Anzeige auf `richtung.angle() + PI/2`; bei Drehung 0 schaut die Figur also
## nach **oben**. Eine Vorlage aus der Seitenansicht muss deshalb übersetzt
## werden, sonst zeichnet man ein Bild, das es aus dieser Kamera gar nicht gibt:
##
## | Seitenansicht | von oben |
## |---|---|
## | aufrechte Haltung | kompakter, symmetrischer Umriss |
## | nach vorn gebeugt | lang und spitz zulaufend |
## | breite Schultern | echte Breite in X, Schulterstücke außen |
##
## ## Warum Vielecke und keine Sprites
##
## Alles im Code gezeichnet, keine Bilddatei — dieselbe Regel wie in der
## Spielesammlung nebenan. Ein Vieleck skaliert verlustfrei, lässt sich
## durchrechnen (siehe `abmessungen`) und die Farbe kommt aus den Charakterdaten
## statt aus einer Datei, die dazu passen müsste.
##
## Jedes Teil ist **konvex**. Das ist keine Zierde: Ein konkaves Vieleck muss
## beim Zeichnen zerlegt werden, und der Umriss aus `draw_polyline` läuft dann
## sichtbar quer durch die Fläche.


## Ein gezeichnetes Teil: Fläche plus Umriss. `rand_breite` 0 heißt „ohne
## Umriss" — für den Schatten und für Kleinteile, die sonst nur noch Rand wären.
class Teil extends RefCounted:
	var punkte: PackedVector2Array
	var farbe: Color
	var rand_breite: float
	var kontur: Color

	func _init(p_punkte: PackedVector2Array, p_farbe: Color,
			p_rand_breite: float = 0.0, p_kontur: Color = Color.BLACK) -> void:
		punkte = p_punkte
		farbe = p_farbe
		rand_breite = p_rand_breite
		kontur = p_kontur


## Halbe Breite der breitesten Figur (Tank). Der Auswahlbildschirm kann damit
## alle drei auf dieselbe Größe bringen, ohne die Teile selbst zu vermessen.
const HALBE_BREITE := 20.5


## Alle Teile einer Variante, in Zeichenreihenfolge: von hinten nach vorn.
##
## Die Reihenfolge ist Teil des Bildes, nicht Nebensache — genau wie bei den
## Erdschichten in Flow MTB. Der Helm gehört über die Brustplatte, das Visier
## über den Helm, und die Waffe vor den Arm, der sie hält.
static func teile(variante: Charaktere.Variante) -> Array[Teil]:
	if variante == null:
		return []

	match variante.id:
		&"schnell":
			return _schnell(variante.anstrich)
		&"tank":
			return _tank(variante.anstrich)
		_:
			return _ausgewogen(variante.anstrich)


## Umschließendes Rechteck aller Teile — ohne den Schatten, der ist kein Teil
## der Figur. Für Prüfungen und zum Einpassen in eine Kachel.
static func abmessungen(variante: Charaktere.Variante) -> Rect2:
	var alle := teile(variante)
	var kasten := Rect2()
	var erster := true

	# Der Schatten liegt an Stelle 0 und wird übersprungen: Er ist bewusst
	# größer als die Figur, als Umriss würde er jede Messung verfälschen.
	for i in range(1, alle.size()):
		for punkt in alle[i].punkte:
			if erster:
				kasten = Rect2(punkt, Vector2.ZERO)
				erster = false
			else:
				kasten = kasten.expand(punkt)

	return kasten


# ── Bausteine ───────────────────────────────────────────────────────────────

static func _kreis(mitte: Vector2, radius: float, ecken: int = 18) -> PackedVector2Array:
	var p := PackedVector2Array()
	for i in ecken:
		p.append(mitte + Vector2.from_angle(TAU * float(i) / float(ecken)) * radius)
	return p


## Kapsel zwischen zwei Punkten, an beiden Enden unterschiedlich dick.
##
## Der Verlauf von dick nach dünn ist der ganze Unterschied zwischen „Arm" und
## „Rohr" — dieselbe Erfahrung wie beim Fahrer in Flow MTB.
static func _kapsel(a: Vector2, radius_a: float, b: Vector2, radius_b: float,
		ecken: int = 9) -> PackedVector2Array:
	var richtung := b - a
	if richtung.length_squared() < 0.0001:
		return _kreis(a, maxf(radius_a, radius_b), ecken * 2)

	var winkel := richtung.angle()
	var p := PackedVector2Array()

	for i in ecken + 1:
		var t := winkel + PI / 2.0 + PI * float(i) / float(ecken)
		p.append(a + Vector2.from_angle(t) * radius_a)
	for i in ecken + 1:
		var t := winkel - PI / 2.0 + PI * float(i) / float(ecken)
		p.append(b + Vector2.from_angle(t) * radius_b)

	return p


## Ein Teil an der Mittelachse gespiegelt. Die Reihenfolge dreht sich dabei um,
## sonst läuft der Umriss verkehrt herum und die Kante flackert.
##
## Bewusst überall benutzt, wo es ein linkes und ein rechtes Gegenstück gibt:
## Zwei von Hand getippte Hälften driften auseinander, und eine Figur, die von
## oben schief ist, sieht beim Drehen nach einem Fehler aus.
static func _gespiegelt(punkte: PackedVector2Array) -> PackedVector2Array:
	var p := PackedVector2Array()
	for i in range(punkte.size() - 1, -1, -1):
		p.append(Vector2(-punkte[i].x, punkte[i].y))
	return p


static func _paar(liste: Array[Teil], punkte: PackedVector2Array, farbe: Color,
		rand: float, kontur: Color) -> void:
	liste.append(Teil.new(punkte, farbe, rand, kontur))
	liste.append(Teil.new(_gespiegelt(punkte), farbe, rand, kontur))


static func _schatten(radius: float, versatz: float, deckung: float) -> Teil:
	return Teil.new(_kreis(Vector2(0, versatz), radius, 20), Color(0, 0, 0, deckung))


# ── Die drei Figuren ────────────────────────────────────────────────────────

## Ausgewogen — der Wächter. Symmetrisch und kompakt: Was von oben „aufrecht"
## heißt, ist ein Umriss, der nach vorn und hinten gleich weit reicht.
## Halbe Breite 17,5 — die Mitte zwischen Sprinter und Bollwerk.
static func _ausgewogen(a: Charaktere.Anstrich) -> Array[Teil]:
	var t: Array[Teil] = []
	t.append(_schatten(16.5, 4.0, 0.28))

	_paar(t, _kapsel(Vector2(-6, 9), 4.0, Vector2(-6.5, 15.5), 3.4), a.dunkel, 1.6, a.kontur)

	t.append(Teil.new(PackedVector2Array([
		Vector2(-12, -10), Vector2(-13.5, -1), Vector2(-11, 11), Vector2(0, 14),
		Vector2(11, 11), Vector2(13.5, -1), Vector2(12, -10),
		Vector2(6, -13), Vector2(-6, -13),
	]), a.panzer, 2.0, a.kontur))

	t.append(Teil.new(PackedVector2Array([
		Vector2(-8.5, 3.5), Vector2(8.5, 3.5), Vector2(9.5, 12), Vector2(-9.5, 12),
	]), a.platte, 1.8, a.kontur))

	t.append(Teil.new(PackedVector2Array([
		Vector2(-9.5, -12), Vector2(9.5, -12), Vector2(11, -3),
		Vector2(7, 2), Vector2(-7, 2), Vector2(-11, -3),
	]), a.brust, 1.8, a.kontur))

	# Die beiden Streifen liegen auf der weißen Brustplatte und sind deshalb
	# blau, nicht in der Leuchtfarbe: Hellcyan auf Weiß ist kein Streifen mehr.
	_paar(t, _kapsel(Vector2(-8.6, -9), 1.3, Vector2(-7.2, -1), 1.3), a.platte, 0.0, a.kontur)

	_paar(t, _kapsel(Vector2(-12.5, -1), 4.4, Vector2(-10, -12.5), 3.5), a.panzer, 1.8, a.kontur)
	_paar(t, _kreis(Vector2(-10, -12.5), 3.4, 12), a.dunkel, 1.4, a.kontur)

	_paar(t, PackedVector2Array([
		Vector2(-11, -11.5), Vector2(-16, -8), Vector2(-17.5, 0.5),
		Vector2(-12, 3.5), Vector2(-10.5, -2),
	]), a.platte, 2.0, a.kontur)

	t.append(Teil.new(_kapsel(Vector2(6.5, -6.5), 3.2, Vector2(8, -14), 2.8), a.dunkel, 1.6, a.kontur))
	t.append(Teil.new(_kapsel(Vector2(8, -14), 2.2, Vector2(8.5, -20), 1.8), a.dunkel, 1.4, a.kontur))

	t.append(Teil.new(_kreis(Vector2(0, -3.5), 6.2), a.helm, 1.9, a.kontur))
	t.append(Teil.new(PackedVector2Array([
		Vector2(-4.4, -6.6), Vector2(4.4, -6.6), Vector2(3.2, -10.8), Vector2(-3.2, -10.8),
	]), a.leuchten, 1.4, a.kontur))

	return t


## Schnell — der Sprinter. „Nach vorn gebeugt" heißt von oben: lang und vorn
## spitz. Halbe Breite nur 15, dafür reicht er mit wehendem Schal bis y = +21 —
## die einzige der drei, die deutlich länger als breit ist.
static func _schnell(a: Charaktere.Anstrich) -> Array[Teil]:
	var t: Array[Teil] = []
	t.append(_schatten(14.5, 4.0, 0.26))

	# Der Schal liegt ganz hinten und zeigt nach hinten weg. Er ist das
	# Tempo-Merkmal der Figur: Ein Umriss, der hinten ausläuft, sieht auch im
	# Stand nach Bewegung aus.
	_paar(t, PackedVector2Array([
		Vector2(-3.5, 6.5), Vector2(-8, 7.5), Vector2(-12, 21), Vector2(-7.5, 19),
	]), a.platte, 1.6, a.kontur)

	_paar(t, _kapsel(Vector2(-5, 8.5), 3.3, Vector2(-5, 15), 2.7), a.dunkel, 1.5, a.kontur)

	t.append(Teil.new(PackedVector2Array([
		Vector2(-9, -13), Vector2(-11, -3), Vector2(-9, 10), Vector2(0, 13),
		Vector2(9, 10), Vector2(11, -3), Vector2(9, -13),
		Vector2(4, -16), Vector2(-4, -16),
	]), a.panzer, 1.9, a.kontur))

	t.append(Teil.new(PackedVector2Array([
		Vector2(-6.5, 4), Vector2(6.5, 4), Vector2(7, 11), Vector2(-7, 11),
	]), a.dunkel, 1.6, a.kontur))

	# Keil statt Platte: Die Spitze zeigt nach vorn und sagt schon im Stand,
	# wohin die Figur schaut. Ein Winkel (Chevron) wäre schöner, wäre aber
	# konkav — siehe oben.
	t.append(Teil.new(PackedVector2Array([
		Vector2(0, -16.5), Vector2(8.5, -6), Vector2(0, -1.5), Vector2(-8.5, -6),
	]), a.brust, 1.8, a.kontur))

	_paar(t, _kapsel(Vector2(-9.3, -8), 1.3, Vector2(-8, 5), 1.3), a.leuchten, 0.0, a.kontur)

	_paar(t, _kapsel(Vector2(-10.5, -2), 3.8, Vector2(-8, -12), 3.0), a.panzer, 1.7, a.kontur)
	_paar(t, _kreis(Vector2(-8, -12), 2.9, 12), a.dunkel, 1.3, a.kontur)

	_paar(t, PackedVector2Array([
		Vector2(-9, -11), Vector2(-14.5, -6.5), Vector2(-15, 1), Vector2(-10.5, 2),
	]), a.platte, 1.8, a.kontur)

	t.append(Teil.new(_kapsel(Vector2(6, -8), 2.6, Vector2(7, -15.5), 2.2), a.dunkel, 1.5, a.kontur))

	t.append(Teil.new(_kreis(Vector2(0, -5), 5.6), a.helm, 1.8, a.kontur))
	t.append(Teil.new(PackedVector2Array([
		Vector2(-3.8, -7.4), Vector2(3.8, -7.4), Vector2(2.6, -11.2), Vector2(-2.6, -11.2),
	]), a.leuchten, 1.3, a.kontur))

	return t


## Tank — das Bollwerk. Breit und kurz, die Schulterstücke tragen die
## Silhouette. Halbe Breite 20,5 gegen 16 Trefferradius: Die Figur sieht
## breiter aus, als sie zählt. Das ist die verzeihende Richtung — man wird
## seltener getroffen, als man erwartet, nie öfter.
static func _tank(a: Charaktere.Anstrich) -> Array[Teil]:
	var t: Array[Teil] = []
	t.append(_schatten(18.5, 3.0, 0.30))

	_paar(t, _kapsel(Vector2(-7.5, 8), 4.8, Vector2(-8, 14), 4.0), a.dunkel, 1.8, a.kontur)

	t.append(Teil.new(PackedVector2Array([
		Vector2(-14, -9), Vector2(-16, 0), Vector2(-13, 10), Vector2(0, 13),
		Vector2(13, 10), Vector2(16, 0), Vector2(14, -9),
		Vector2(7, -12), Vector2(-7, -12),
	]), a.panzer, 2.2, a.kontur))

	t.append(Teil.new(PackedVector2Array([
		Vector2(-11, 3), Vector2(11, 3), Vector2(12, 11.5), Vector2(-12, 11.5),
	]), a.platte, 1.8, a.kontur))

	t.append(Teil.new(PackedVector2Array([
		Vector2(-11.5, -11), Vector2(11.5, -11), Vector2(13.5, -2),
		Vector2(8, 3), Vector2(-8, 3), Vector2(-13.5, -2),
	]), a.brust, 2.0, a.kontur))

	_paar(t, _kapsel(Vector2(-10.5, -8.5), 1.5, Vector2(-9, -1), 1.5), a.leuchten, 0.0, a.kontur)

	_paar(t, _kapsel(Vector2(-14.5, 1), 5.2, Vector2(-12, -11), 4.2), a.panzer, 2.0, a.kontur)
	_paar(t, _kreis(Vector2(-12, -11), 4.0, 12), a.dunkel, 1.5, a.kontur)

	_paar(t, PackedVector2Array([
		Vector2(-12, -11.5), Vector2(-19.5, -8), Vector2(-20.5, 1.5),
		Vector2(-13.5, 5), Vector2(-11, -1),
	]), a.platte, 2.2, a.kontur)

	# Nieten auf den Schulterstücken. Kleinteile ohne Umriss — bei 1,7 Pixel
	# Radius wäre ein 2-Pixel-Rand nichts als Rand.
	_paar(t, _kreis(Vector2(-16.2, -4), 1.7, 10), a.dunkel, 0.0, a.kontur)

	t.append(Teil.new(_kapsel(Vector2(7, -7), 3.7, Vector2(8, -16), 3.2), a.dunkel, 1.8, a.kontur))

	t.append(Teil.new(_kreis(Vector2(0, -3), 6.6), a.helm, 2.0, a.kontur))
	t.append(Teil.new(PackedVector2Array([
		Vector2(-5, -5.6), Vector2(5, -5.6), Vector2(4, -10), Vector2(-4, -10),
	]), a.leuchten, 1.4, a.kontur))

	return t
