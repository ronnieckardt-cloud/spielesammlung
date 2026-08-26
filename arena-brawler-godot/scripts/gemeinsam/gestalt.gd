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
##
## `schattiert` entscheidet, ob `Figur` einen Verlauf zeichnet (hell zur
## Lichtseite, dunkel zur Gegenseite — „wirkt rund") oder eine flache Fläche
## („ist schon selbst Licht" oder zu klein für einen sichtbaren Verlauf).
## Standard ist an: Panzerung, Helm, Gliedmaßen sollen wie Körper wirken, nicht
## wie ausgeschnittenes Papier. Flach bleibt bewusst: Visier, dünne
## Zierstreifen, Glanzpunkte — die sollen selbst leuchten, nicht beleuchtet
## werden.
class Teil extends RefCounted:
	var punkte: PackedVector2Array
	var farbe: Color
	var rand_breite: float
	var kontur: Color
	var schattiert: bool

	func _init(p_punkte: PackedVector2Array, p_farbe: Color,
			p_rand_breite: float = 0.0, p_kontur: Color = Color.BLACK,
			p_schattiert: bool = true) -> void:
		punkte = p_punkte
		farbe = p_farbe
		rand_breite = p_rand_breite
		kontur = p_kontur
		schattiert = p_schattiert


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
		rand: float, kontur: Color, schattiert: bool = true) -> void:
	liste.append(Teil.new(punkte, farbe, rand, kontur, schattiert))
	liste.append(Teil.new(_gespiegelt(punkte), farbe, rand, kontur, schattiert))


static func _schatten(radius: float, versatz: float, deckung: float) -> Teil:
	# Flach: Ein Schatten ist per Definition keine beleuchtete Fläche.
	return Teil.new(_kreis(Vector2(0, versatz), radius, 20), Color(0, 0, 0, deckung), 0.0, Color.BLACK, false)


## Kleiner, opaker Lichtreflex — die letzte Zutat aus der Sternenschlucker-
## Formel („dazu ein einzelner harter Glanzpunkt"). Bewusst **opak** und nicht
## halbdurchsichtig: Eine Ellipse in einem hellen Farbton liest sich schon als
## Glanz, ohne dass es Transparenz braucht — und `pruefen.gd` verlangt, dass
## einzig der Schatten durchsichtig ist. Eine Ellipse aus Kreispunkten mit
## unabhängig skalierter x/y-Achse bleibt konvex, genau wie ein Kreis.
static func _glanz(mitte: Vector2, radius_x: float, radius_y: float, farbe: Color) -> Teil:
	var p := PackedVector2Array()
	for i in 12:
		var t := TAU * float(i) / 12.0
		p.append(mitte + Vector2(cos(t) * radius_x, sin(t) * radius_y))
	return Teil.new(p, farbe, 0.0, Color.BLACK, false)


# ── Die drei Figuren ────────────────────────────────────────────────────────

## Ausgewogen — der Wächter. Symmetrisch, aber nicht mehr tonnenförmig: Der
## Rumpf verjüngt sich sichtbar von der breiten Brust zur schmalen Hüfte — von
## oben das Gegenstück zu einer V-Form in der Seitenansicht. Halbe Breite 18 —
## die Mitte zwischen Sprinter und Bollwerk, mit Abstand zu beiden.
static func _ausgewogen(a: Charaktere.Anstrich) -> Array[Teil]:
	var t: Array[Teil] = []
	t.append(_schatten(17.0, 4.0, 0.28))

	_paar(t, _kapsel(Vector2(-6, 9.5), 4.2, Vector2(-6.5, 16.5), 3.6), a.dunkel, 1.8, a.kontur)

	# Rumpf: breit an der Brust (y ≈ −13), schmal an der Hüfte (y ≈ 10) —
	# derselbe Umriss wie vorher, nur mit dem Gewicht spürbar nach vorn
	# verschoben statt gleichmäßig rund.
	t.append(Teil.new(PackedVector2Array([
		Vector2(-13.5, -10.5), Vector2(-15, -2), Vector2(-10, 9.5),
		Vector2(0, 12.5), Vector2(10, 9.5), Vector2(15, -2),
		Vector2(13.5, -10.5), Vector2(6.5, -13.5), Vector2(-6.5, -13.5),
	]), a.panzer, 2.2, a.kontur))

	t.append(Teil.new(PackedVector2Array([
		Vector2(-8, 3), Vector2(8, 3), Vector2(9, 12), Vector2(-9, 12),
	]), a.platte, 1.9, a.kontur))

	# Brustplatte: größer als vorher und mit geradem, breitem Oberrand — die
	# Fläche, die den Blau/Weiß-Kontrast tragen soll, war zuvor zu klein, um
	# ihn wirklich zu zeigen.
	t.append(Teil.new(PackedVector2Array([
		Vector2(-10.5, -13), Vector2(10.5, -13), Vector2(12, -3),
		Vector2(7.5, 2.5), Vector2(-7.5, 2.5), Vector2(-12, -3),
	]), a.brust, 2.0, a.kontur))

	# Die Streifen liegen auf der weißen Brustplatte und sind deshalb blau,
	# nicht in der Leuchtfarbe: Hellcyan auf Weiß ist kein Streifen mehr.
	# Dicker und enger an der Mitte als vorher — ein Rennstreifen, keine Naht.
	# Flach: Ein Rennstreifen soll scharf und einfarbig wirken, kein Verlauf.
	_paar(t, _kapsel(Vector2(-9.5, -10.5), 1.7, Vector2(-7.8, -1), 1.6), a.platte, 0.0, a.kontur, false)

	# Glanzpunkt auf der Brustplatte — der „einzelne harte Glanzpunkt" aus der
	# Sternenschlucker-Formel. Liegt oben links, wo auch der Verlauf am
	# hellsten wird, und verstärkt genau diese Stelle noch einmal deutlich.
	t.append(_glanz(Vector2(-4.5, -8.5), 2.8, 1.8, a.brust.lightened(0.5)))

	_paar(t, _kapsel(Vector2(-13.5, -1), 4.6, Vector2(-11, -13), 3.7), a.panzer, 2.0, a.kontur)
	_paar(t, _kreis(Vector2(-11, -13), 3.5, 12), a.dunkel, 1.5, a.kontur)

	# Schulterklinge: nach vorn-außen geschwungen statt rundlich — dieselbe
	# Fünfeck-Grundform, aber mit dem Ausleger weiter nach vorn gezogen, damit
	# sie wie eine Klinge und nicht wie ein Polster wirkt.
	_paar(t, PackedVector2Array([
		Vector2(-12, -12.5), Vector2(-17.5, -8.5), Vector2(-18, 0.5),
		Vector2(-12.5, 4), Vector2(-11, -2.5),
	]), a.platte, 2.2, a.kontur)

	t.append(Teil.new(_kapsel(Vector2(7, -7), 3.4, Vector2(8.5, -15.5), 3.0), a.dunkel, 1.8, a.kontur))
	t.append(Teil.new(_kapsel(Vector2(8.5, -15.5), 2.3, Vector2(9, -22), 1.9), a.dunkel, 1.6, a.kontur))

	t.append(Teil.new(_kreis(Vector2(0, -4), 6.8), a.helm, 2.1, a.kontur))
	# Visier flach: Es soll selbst wie eine Lichtquelle wirken, nicht wie eine
	# beleuchtete Fläche — ein Verlauf darauf würde genau das wieder auffressen.
	t.append(Teil.new(PackedVector2Array([
		Vector2(-4.8, -7.2), Vector2(4.8, -7.2), Vector2(3.4, -11.8), Vector2(-3.4, -11.8),
	]), a.leuchten, 1.6, a.kontur, false))
	t.append(_glanz(Vector2(-2.6, -5.6), 1.5, 1.1, a.helm.lightened(0.55)))

	return t


## Schnell — der Sprinter. „Nach vorn gebeugt" heißt von oben: lang und vorn
## spitz. Halbe Breite nur 14 — schmaler als vorher, dafür reicht er mit
## wehenden Streamern bis y = +25. Die einzige der drei, die deutlich länger
## als breit ist, und mit Abstand die schmalste — genau das soll man ihr schon
## an der Silhouette ansehen, nicht erst am Tempo merken.
static func _schnell(a: Charaktere.Anstrich) -> Array[Teil]:
	var t: Array[Teil] = []
	t.append(_schatten(13.5, 4.0, 0.26))

	# Zwei Streamer statt einem: ein langer äußerer in der Schulterfarbe, ein
	# kürzerer innerer in der Leuchtfarbe darüber — das liest sich als
	# aufgefächertes Band im Wind, nicht als einzelner starrer Lappen.
	_paar(t, PackedVector2Array([
		Vector2(-3.5, 7), Vector2(-7, 8), Vector2(-12.5, 25), Vector2(-8, 21.5),
	]), a.platte, 1.7, a.kontur)
	# Flach: Der innere Streamer ist die Leuchtfarbe obendrauf, kein
	# beleuchteter Stoff — er soll wie eine helle Kante im Wind aufblitzen.
	_paar(t, PackedVector2Array([
		Vector2(-3, 7.5), Vector2(-5.5, 8.5), Vector2(-8, 19), Vector2(-5.8, 17),
	]), a.leuchten, 0.0, a.kontur, false)

	_paar(t, _kapsel(Vector2(-4.5, 8.5), 3.0, Vector2(-4.5, 15), 2.4), a.dunkel, 1.5, a.kontur)

	# Rumpf: um rund 7 % schmaler als vorher (die Zahl, an der die Halbbreite
	# hängt) und etwas länger — schlanker und gestreckter statt breit-kompakt.
	t.append(Teil.new(PackedVector2Array([
		Vector2(-8.4, -13), Vector2(-10.2, -3), Vector2(-8.4, 10),
		Vector2(0, 13.5), Vector2(8.4, 10), Vector2(10.2, -3),
		Vector2(8.4, -13), Vector2(3.7, -16.5), Vector2(-3.7, -16.5),
	]), a.panzer, 2.0, a.kontur))

	t.append(Teil.new(PackedVector2Array([
		Vector2(-6, 4), Vector2(6, 4), Vector2(6.5, 11), Vector2(-6.5, 11),
	]), a.dunkel, 1.7, a.kontur))

	# Keil statt Platte, jetzt merklich weiter vorgezogen: Die Spitze zeigt
	# nach vorn und sagt schon im Stand, wohin die Figur schaut. Ein Winkel
	# (Chevron) wäre schöner, wäre aber konkav — siehe oben.
	t.append(Teil.new(PackedVector2Array([
		Vector2(0, -19), Vector2(9, -6.5), Vector2(0, -1), Vector2(-9, -6.5),
	]), a.brust, 1.9, a.kontur))

	t.append(_glanz(Vector2(-3.2, -11), 2.2, 3.2, a.brust.lightened(0.5)))

	# Flach: Die Zierstreifen längs des Rumpfs sind kein Verlauf, sondern
	# scharfe Leuchtkanten — dieselbe Rolle wie der Rennstreifen beim
	# Ausgewogenen, nur schmaler.
	_paar(t, _kapsel(Vector2(-8.6, -8), 1.4, Vector2(-7.4, 5), 1.4), a.leuchten, 0.0, a.kontur, false)

	_paar(t, _kapsel(Vector2(-9.8, -2), 3.4, Vector2(-7.6, -11.5), 2.7), a.panzer, 1.8, a.kontur)
	_paar(t, _kreis(Vector2(-7.6, -11.5), 2.6, 12), a.dunkel, 1.4, a.kontur)

	# Schulterflosse: weiter nach hinten-außen geschwungen als vorher — ein
	# nach hinten gezogenes Blatt liest sich als Fahrtwind, nicht als Polster.
	_paar(t, PackedVector2Array([
		Vector2(-8.5, -10.5), Vector2(-13.5, -5.5), Vector2(-14.8, 3),
		Vector2(-10, 3.5), Vector2(-9, -2),
	]), a.platte, 1.9, a.kontur)

	t.append(Teil.new(_kapsel(Vector2(5.5, -8), 2.5, Vector2(6.5, -16.5), 2.1), a.dunkel, 1.6, a.kontur))

	t.append(Teil.new(_kreis(Vector2(0, -5.5), 5.4), a.helm, 1.9, a.kontur))
	t.append(Teil.new(PackedVector2Array([
		Vector2(-3.8, -7.8), Vector2(3.8, -7.8), Vector2(2.6, -11.8), Vector2(-2.6, -11.8),
	]), a.leuchten, 1.4, a.kontur, false))
	t.append(_glanz(Vector2(-2.2, -7), 1.3, 1.0, a.helm.lightened(0.55)))

	return t


## Tank — das Bollwerk. Breit und kurz, die Schulterstücke tragen die
## Silhouette. Halbe Breite 20,5 gegen 16 Trefferradius: Die Figur sieht
## breiter aus, als sie zählt. Das ist die verzeihende Richtung — man wird
## seltener getroffen, als man erwartet, nie öfter.
static func _tank(a: Charaktere.Anstrich) -> Array[Teil]:
	var t: Array[Teil] = []
	t.append(_schatten(19.0, 3.0, 0.30))

	# Stiefel: rund 15 % dicker als bei den anderen beiden — schwere Stiefel
	# statt einer verkleinerten Kopie derselben Kapsel.
	_paar(t, _kapsel(Vector2(-8, 8), 5.4, Vector2(-8.5, 14), 4.5), a.dunkel, 2.0, a.kontur)

	# Rumpf: rund 8 % breiter, dafür oben und unten etwas gestaucht —
	# gedrungener statt nur größer skaliert. Genau das ist der Unterschied
	# zwischen „massiv" und „einfach hochskaliert".
	t.append(Teil.new(PackedVector2Array([
		Vector2(-15, -8.5), Vector2(-17.5, 0), Vector2(-14, 9.5),
		Vector2(0, 12), Vector2(14, 9.5), Vector2(17.5, 0),
		Vector2(15, -8.5), Vector2(7.5, -11), Vector2(-7.5, -11),
	]), a.panzer, 2.4, a.kontur))

	t.append(Teil.new(PackedVector2Array([
		Vector2(-11.5, 3), Vector2(11.5, 3), Vector2(12.5, 11.5), Vector2(-12.5, 11.5),
	]), a.platte, 1.9, a.kontur))

	t.append(Teil.new(PackedVector2Array([
		Vector2(-12, -10.5), Vector2(12, -10.5), Vector2(14, -1.5),
		Vector2(8.5, 3), Vector2(-8.5, 3), Vector2(-14, -1.5),
	]), a.brust, 2.1, a.kontur))

	t.append(_glanz(Vector2(-5.5, -6), 3.2, 1.8, a.brust.lightened(0.45)))

	# Grüner Saum am unteren Rand der Brustplatte: bindet das Schulter-Grün
	# in die Mitte ein, ohne die Brust selbst grün zu färben — Schulter und
	# Brust bleiben zwei getrennte Flächen, nur der Rand verbindet sie. Flach,
	# wie ein aufgesetztes Band, kein Verlauf auf drei Pixeln Höhe.
	t.append(Teil.new(PackedVector2Array([
		Vector2(-8.5, 2.2), Vector2(8.5, 2.2), Vector2(9.3, 4.6), Vector2(-9.3, 4.6),
	]), a.platte, 1.5, a.kontur, false))

	# Kontrollleuchten flach — dieselbe Rolle wie das Visier: selbst leuchtend.
	_paar(t, _kapsel(Vector2(-11, -8), 1.7, Vector2(-9.3, -0.5), 1.7), a.leuchten, 0.0, a.kontur, false)

	_paar(t, _kapsel(Vector2(-15.5, 1.5), 5.8, Vector2(-13, -10.5), 4.7), a.panzer, 2.2, a.kontur)
	_paar(t, _kreis(Vector2(-13, -10.5), 4.4, 12), a.dunkel, 1.6, a.kontur)

	# Schulterplatte: sechseckig statt fünfeckig — eine zusätzliche Kante
	# macht sie eckiger, gepanzerter, weniger wie ein rundes Polster.
	_paar(t, PackedVector2Array([
		Vector2(-13, -11), Vector2(-18.5, -9), Vector2(-21, -3),
		Vector2(-20.5, 3), Vector2(-14, 5.5), Vector2(-12, -1.5),
	]), a.platte, 2.4, a.kontur)

	# Zwei Nieten je Schulterplatte statt einer — bei der jetzt größeren
	# Fläche wirkte eine einzelne verloren.
	_paar(t, _kreis(Vector2(-17.5, -5), 1.8, 10), a.dunkel, 0.0, a.kontur)
	_paar(t, _kreis(Vector2(-16.5, 1), 1.8, 10), a.dunkel, 0.0, a.kontur)

	t.append(Teil.new(_kapsel(Vector2(7.5, -6.5), 4.0, Vector2(8.5, -16), 3.5), a.dunkel, 2.0, a.kontur))

	t.append(Teil.new(_kreis(Vector2(0, -2.5), 7.0), a.helm, 2.2, a.kontur))
	t.append(Teil.new(PackedVector2Array([
		Vector2(-5.4, -5), Vector2(5.4, -5), Vector2(4.3, -9.8), Vector2(-4.3, -9.8),
	]), a.leuchten, 1.6, a.kontur, false))
	t.append(_glanz(Vector2(-2.8, -4.2), 1.6, 1.2, a.helm.lightened(0.5)))

	return t
