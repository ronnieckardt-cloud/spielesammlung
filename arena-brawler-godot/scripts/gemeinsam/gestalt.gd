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
#
# Dritte Überarbeitung. Ziel war nicht mehr „runder und glänzender" (das
# erledigt seit der Verlauf-Runde `Figur`), sondern **Silhouette zuerst**:
# Deckt man alle drei komplett schwarz ab, muss man sie trotzdem sofort
# auseinanderhalten. Die drei Rümpfe sind deshalb jetzt grundverschiedene
# Formen — Sechseck-Schild, langer Pfeil, blockiges Achteck — statt dreier
# Varianten desselben getonnten Umrisses. Und was vorher zwischen allen drei
# Figuren fast gleich aussah (Kapsel-Arm, Kapsel-Handschuh, Kapsel-Waffe) ist
# bis auf die Beine ersatzlos raus: eine Klinge, eine Finne oder eine
# Schulterplatte trägt die Aussage „hier ist die Schulter" allein, sie
# braucht keinen Arm dahinter. Übrig bleiben weniger, aber größere und
# eckigere Flächen — genau das liest sich auch bei 32 bis 40 Pixel Breite
# noch als klare Farbfläche, nicht als Matsch aus lauter kleinen Rundungen.

## Ausgewogen — der Wächter. Ein Sechseck, das vorn **und** hinten spitz
## zuläuft (ein Schild von oben) statt eines getonnten Umrisses — dieselbe
## Form ist auch als reiner Schattenriss sofort eine geordnete, symmetrische
## Kontur. Markenzeichen: die beiden klingenförmigen Schulterstücke, die vorn
## aus dem Sechseck herauswachsen, und die große weiße Brustraute, die den
## Blau/Weiß-Kontrast unübersehbar macht. Halbe Breite 18 — die Mitte
## zwischen Sprinter und Bollwerk, mit deutlichem Abstand zu beiden.
static func _ausgewogen(a: Charaktere.Anstrich) -> Array[Teil]:
	var t: Array[Teil] = []
	t.append(_schatten(17.5, 4.0, 0.28))

	# Beine: zwei einfache, leicht gekippte Trapeze statt gerundeter Kapseln —
	# eckig statt weich, wie der Rest der Figur.
	_paar(t, PackedVector2Array([
		Vector2(-7, 8), Vector2(-3, 8), Vector2(-4.5, 17), Vector2(-8.5, 16),
	]), a.dunkel, 1.8, a.kontur)

	# Rumpf: ein Sechseck, vorn und hinten spitz — von oben das Gegenstück zu
	# einer geraden, athletischen Haltung. Eine einzige große Fläche statt
	# mehrerer kleiner hält den Umriss auf den ersten Blick lesbar.
	t.append(Teil.new(PackedVector2Array([
		Vector2(0, -15), Vector2(13, -7), Vector2(8.5, 11),
		Vector2(0, 15), Vector2(-8.5, 11), Vector2(-13, -7),
	]), a.panzer, 2.3, a.kontur))

	# Brustraute: groß genug, um den Blau/Weiß-Kontrast auch bei kleiner
	# Darstellung noch zu zeigen — die Fläche allein ist schon das Merkmal,
	# kein Muster darauf nötig.
	t.append(Teil.new(PackedVector2Array([
		Vector2(0, -13.5), Vector2(8, -4.5), Vector2(0, 5.5), Vector2(-8, -4.5),
	]), a.brust, 2.0, a.kontur))

	# Rennstreifen auf der Raute, blau statt Leuchtfarbe: Hellcyan auf Weiß
	# wäre kein Streifen mehr, sondern nur ein Schimmer. Flach: ein
	# Rennstreifen soll scharf und einfarbig wirken, kein Verlauf.
	_paar(t, _kapsel(Vector2(-4.5, -9.5), 1.7, Vector2(-2.5, 2), 1.5), a.platte, 0.0, a.kontur, false)

	t.append(_glanz(Vector2(-3, -7.5), 2.6, 1.7, a.brust.lightened(0.5)))

	# Schulterklinge — das Markenzeichen. Wächst direkt aus der Schulterecke
	# des Sechsecks nach vorn-außen; eine eigene Armkapsel dahinter würde die
	# Aussage nur verwässern, nicht verstärken.
	_paar(t, PackedVector2Array([
		Vector2(-13, -9), Vector2(-18, -4), Vector2(-15.5, 6), Vector2(-11, 5),
	]), a.platte, 2.3, a.kontur)

	t.append(Teil.new(_kreis(Vector2(0, -7), 7.2), a.helm, 2.1, a.kontur))
	# Visier flach: Es soll selbst wie eine Lichtquelle wirken, nicht wie eine
	# beleuchtete Fläche — ein Verlauf darauf würde genau das wieder auffressen.
	t.append(Teil.new(PackedVector2Array([
		Vector2(-4, -9), Vector2(4, -9), Vector2(3, -13), Vector2(-3, -13),
	]), a.leuchten, 1.6, a.kontur, false))
	t.append(_glanz(Vector2(-2.4, -8.4), 1.4, 1.0, a.helm.lightened(0.55)))

	return t


## Schnell — der Sprinter. Ein langer, vorn extrem spitzer Pfeil statt eines
## rundlichen Tropfens — bewusst die schmalste und zugleich am weitesten nach
## hinten auslaufende Figur der drei, damit „schnell" schon an der reinen
## Kontur ablesbar ist, nicht erst an der Farbe. Markenzeichen: die nach
## hinten-außen gefegte Finne an der Schulter (das genaue Gegenteil der nach
## vorn geschwungenen Klinge beim Ausgewogenen) und ein einzelnes, breites
## Streamer-Band statt der früheren zwei dünnen übereinander. Halbe Breite
## nur 14 — deutlich schmaler als die anderen beiden, das soll man ihr auch
## als schwarzer Schattenriss sofort ansehen.
static func _schnell(a: Charaktere.Anstrich) -> Array[Teil]:
	var t: Array[Teil] = []
	t.append(_schatten(13.5, 4.0, 0.26))

	_paar(t, PackedVector2Array([
		Vector2(-5, 7), Vector2(-2, 7), Vector2(-3, 14), Vector2(-6, 13),
	]), a.dunkel, 1.6, a.kontur)

	# Rumpf: lang und spitz statt kompakt — die Nase reicht bis y = −20, mehr
	# Rumpflänge als bei den anderen beiden Figuren zusammen.
	t.append(Teil.new(PackedVector2Array([
		Vector2(0, -20), Vector2(6, -8), Vector2(7, 6),
		Vector2(0, 12), Vector2(-7, 6), Vector2(-6, -8),
	]), a.panzer, 2.0, a.kontur))

	# Keil: die Spitze fällt fast mit der Rumpfnase zusammen — ein Pfeil im
	# Pfeil, kräftig orange, die auffälligste Fläche der ganzen Figur.
	t.append(Teil.new(PackedVector2Array([
		Vector2(0, -19), Vector2(6, -7), Vector2(0, -1), Vector2(-6, -7),
	]), a.brust, 1.8, a.kontur))

	t.append(_glanz(Vector2(-2.4, -11), 2.0, 2.8, a.brust.lightened(0.5)))

	# Finne: aus der Schulter nach hinten-außen gefegt statt nach vorn — der
	# Gegenentwurf zur Klinge des Ausgewogenen, und genau das macht den
	# Unterschied auch als reiner Schattenriss sofort sichtbar.
	_paar(t, PackedVector2Array([
		Vector2(-6, -9), Vector2(-12, -3), Vector2(-13.5, 8), Vector2(-7, 4),
	]), a.platte, 2.0, a.kontur)

	# Streamer: ein einzelnes breites Band statt zweier dünner übereinander —
	# in der hellen Leuchtfarbe, damit es sich von der Finne klar absetzt und
	# auch bei kleiner Darstellung noch als eigene Fläche zu erkennen ist.
	_paar(t, PackedVector2Array([
		Vector2(-4, 7), Vector2(-8, 9), Vector2(-14, 26), Vector2(-6, 16),
	]), a.leuchten, 1.4, a.kontur, false)

	t.append(Teil.new(_kreis(Vector2(0, -9), 6.0), a.helm, 1.8, a.kontur))
	t.append(Teil.new(PackedVector2Array([
		Vector2(-3.4, -10.8), Vector2(3.4, -10.8), Vector2(2.4, -14), Vector2(-2.4, -14),
	]), a.leuchten, 1.3, a.kontur, false))
	t.append(_glanz(Vector2(-2, -9.6), 1.2, 0.9, a.helm.lightened(0.55)))

	return t


## Tank — das Bollwerk. Ein blockiges, kaum verjüngtes Achteck statt eines
## getaperten Rumpfes — fast eine Wand mit angeschrägten Ecken. Genau diese
## Kantigkeit ist der Unterschied zu den anderen beiden: Wächter und Sprinter
## laufen beide irgendwo spitz zu, das Bollwerk nirgends. Markenzeichen: die
## massiven, blockigen Schulterplatten, die weiter herausragen als bei jeder
## anderen Figur, dazu der dunkle Zierstreifen darauf. Halbe Breite 21 — dicht
## an der Grenze aus der Trefferflächen-Prüfung, mit Absicht: Diese Figur soll
## bis an den Rand dessen gehen, was noch fair ist.
static func _tank(a: Charaktere.Anstrich) -> Array[Teil]:
	var t: Array[Teil] = []
	t.append(_schatten(19.5, 3.0, 0.30))

	_paar(t, PackedVector2Array([
		Vector2(-9, 7), Vector2(-4, 7), Vector2(-5, 15), Vector2(-10, 14),
	]), a.dunkel, 2.0, a.kontur)

	# Rumpf: ein Achteck mit geraden, langen Kanten oben und unten statt eines
	# rundlichen Umrisses — blockig, kaum verjüngt, fast eine Wand.
	t.append(Teil.new(PackedVector2Array([
		Vector2(-10, -12), Vector2(10, -12), Vector2(14, -6), Vector2(14, 8),
		Vector2(10, 13), Vector2(-10, 13), Vector2(-14, 8), Vector2(-14, -6),
	]), a.panzer, 2.4, a.kontur))

	t.append(Teil.new(PackedVector2Array([
		Vector2(-9, -11), Vector2(9, -11), Vector2(9, 1), Vector2(-9, 1),
	]), a.brust, 2.1, a.kontur))

	# Grünes Band unter der Brustplatte: bindet das Schulter-Grün in die Mitte
	# ein, ohne die Brust selbst grün zu färben — Schulter und Brust bleiben
	# zwei getrennte Flächen, nur das Band verbindet sie. Flach, wie ein
	# aufgesetztes Blech, kein Verlauf auf drei Pixeln Höhe.
	t.append(Teil.new(PackedVector2Array([
		Vector2(-9, 1.5), Vector2(9, 1.5), Vector2(9, 4.5), Vector2(-9, 4.5),
	]), a.platte, 1.5, a.kontur, false))

	t.append(_glanz(Vector2(-4, -6.5), 3.0, 1.8, a.brust.lightened(0.45)))

	# Schulterplatte — das Markenzeichen. Ein großer, blockiger Fünfeck-Block
	# statt einer geschwungenen Klinge: schwer, nicht schnittig.
	_paar(t, PackedVector2Array([
		Vector2(-9, -12), Vector2(-19, -9), Vector2(-21, -1),
		Vector2(-15, 4), Vector2(-11, -3),
	]), a.platte, 2.6, a.kontur)

	# Zierstreifen auf der Schulterplatte, dunkel statt hell: ein breites,
	# schräges Band, keine winzige Niete — bei dieser Größe muss ein Detail
	# selbst noch eine Fläche sein, kein Punkt, sonst verschwindet es bei
	# kleiner Darstellung ersatzlos.
	_paar(t, PackedVector2Array([
		Vector2(-19.5, -8), Vector2(-13, -9.5), Vector2(-12, -5), Vector2(-18.5, -3.5),
	]), a.dunkel, 0.0, a.kontur, false)

	t.append(Teil.new(_kreis(Vector2(0, -6), 7.5), a.helm, 2.2, a.kontur))
	t.append(Teil.new(PackedVector2Array([
		Vector2(-5, -8.5), Vector2(5, -8.5), Vector2(4, -13), Vector2(-4, -13),
	]), a.leuchten, 1.6, a.kontur, false))
	t.append(_glanz(Vector2(-2.6, -7.2), 1.6, 1.1, a.helm.lightened(0.5)))

	return t
