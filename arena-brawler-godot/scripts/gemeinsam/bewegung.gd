class_name Bewegung
extends RefCounted
## Die Rechenteile der Bewegung — **reine Funktionen, kein Node, keine Uhr**.
##
## Warum getrennt: Ein `CharacterBody2D` lässt sich nur mit laufender Szene und
## Physikschritt prüfen. Diese Funktionen bekommen ihre Eingaben gereicht und
## geben ein Ergebnis zurück; sie lassen sich damit einzeln durchrechnen, und
## ein Vorzeichenfehler fällt beim Prüfen auf statt beim Spielen.
##
## Dieselbe Trennung wie in der Spielesammlung (`logik.ts` neben der
## React-Komponente) und im Phaser-Prototyp (`wellen.js` neben der Szene).


## Richtungsvektor aus vier gedrückten Tasten, auf Länge 1 gebracht.
##
## Das Normieren ist nicht Kosmetik: Ohne es läuft man diagonal um den Faktor
## 1,41 schneller als geradeaus — der klassische Fehler, den man im Spiel als
## „schräg ist schneller" merkt, ohne zu wissen warum.
static func richtung_aus_tasten(links: bool, rechts: bool, hoch: bool, runter: bool) -> Vector2:
	var v := Vector2(
		(1.0 if rechts else 0.0) - (1.0 if links else 0.0),
		(1.0 if runter else 0.0) - (1.0 if hoch else 0.0),
	)
	return v.normalized() if v.length_squared() > 0.0 else Vector2.ZERO


## Richtung aus einem Stick-Ausschlag: unter der Totzone still, darüber
## anteilig bis zum vollen Ausschlag.
##
## Volles Tempo schon bei 70 % Ausschlag — ein Daumen wird selten bis an den
## Rand gezogen, und unbemerkt halb so schnell zu laufen ist die häufigste
## Enttäuschung an einem streng proportionalen Stick.
static func richtung_aus_stick(versatz: Vector2, radius: float, totzone: float = 10.0) -> Vector2:
	var laenge := versatz.length()
	if laenge < totzone or radius <= 0.0:
		return Vector2.ZERO

	var staerke := minf(1.0, minf(laenge, radius) / (radius * 0.7))
	return versatz / laenge * staerke


## Eine Position in die Arena zurückholen. `rand` ist der halbe Durchmesser der
## Figur — ohne ihn steckt sie zur Hälfte in der Wand.
static func in_arena(punkt: Vector2, arena: Rect2, rand: float) -> Vector2:
	return Vector2(
		clampf(punkt.x, arena.position.x + rand, arena.end.x - rand),
		clampf(punkt.y, arena.position.y + rand, arena.end.y - rand),
	)


## Nächstes Ziel innerhalb der Reichweite, oder `null`.
##
## Nimmt eine Liste von Positionen statt von Knoten: Damit lässt sich das
## Zielen durchrechnen, ohne dass ein einziger Gegner in der Szene existiert.
static func naechstes_ziel(von: Vector2, ziele: PackedVector2Array, reichweite: float) -> Variant:
	var bestes: Variant = null
	var beste := reichweite

	for ziel in ziele:
		var abstand := von.distance_to(ziel)
		if abstand < beste:
			beste = abstand
			bestes = ziel

	return bestes


## Richtung von einem Punkt zu einem anderen, auf Länge 1 gebracht — der
## Rechenkern eines einfachen Verfolgers. Getrennt von `naechstes_ziel` (das
## sucht unter mehreren Zielen das nächste): Ein Verfolger hat sein Ziel
## schon, er muss nur noch wissen, in welche Richtung es liegt.
static func richtung_zu(von: Vector2, ziel: Vector2) -> Vector2:
	var unterschied := ziel - von
	return unterschied.normalized() if unterschied.length_squared() > 0.0 else Vector2.ZERO


## Der nächste Punkt auf (oder in) einem Rechteck zu einem gegebenen Punkt —
## der Rechenkern von `richtung_um_hindernisse` unten.
static func naechster_randpunkt(rechteck: Rect2, punkt: Vector2) -> Vector2:
	return Vector2(
		clampf(punkt.x, rechteck.position.x, rechteck.end.x),
		clampf(punkt.y, rechteck.position.y, rechteck.end.y),
	)


## Die Richtung zu `ziel`, sanft um nahe Hindernisse herum gelenkt.
##
## **Warum das nötig ist, kein Feinschliff:** Ein Verfolger, der stur
## `richtung_zu(von, ziel)` nimmt, bleibt an einer flachen Hindernis-Wand
## mittig stecken, sobald das Ziel genau auf der anderen Seite steht —
## Anziehung zum Ziel und die Kollision mit der Wand heben sich dort exakt
## auf, `move_and_slide()` gleitet dann bestenfals ziellos am Rand entlang.
## Gefunden in der simulierten Runde (`rundenprobe.tscn`): Nach Einführung
## der Kreuz-Karte blieben mehrere Gegner zwanzig Sekunden lang ohne einen
## einzigen weiteren Treffer stehen — derselbe Fehlertyp wie ein Bot, der für
## immer an einem Steigungswinkel hängen bleibt (siehe Flow MTB): Erst die
## simulierte Probe deckt ihn auf, nicht das bloße Ansehen im Editor.
##
## Die Lösung ist keine Wegfindung, nur genug, um an einer einzelnen,
## konvexen Wand nicht steckenzubleiben: Für jedes Hindernis näher als
## `einfluss` (gemessen zum nächsten Randpunkt, aufgeweitet um `rand` — den
## eigenen Körperradius) kommt eine Fluchtrichtung vom Hindernis weg dazu,
## gewichtet danach, wie nah.
##
## **Reine Flucht allein reicht nicht.** Steht man exakt auf der Senkrechten
## zur Wandmitte (das Ziel also exakt geradeaus dahinter), zeigt die
## Fluchtrichtung exakt entgegengesetzt zur Zielrichtung — beide heben sich
## beim Addieren zu einem kürzeren Vektor **derselben** Richtung auf, keine
## seitliche Ablenkung entsteht, und genau das war der ursprüngliche Fehler
## nur eine Formel weiter verschoben. Deshalb kommt zur Flucht noch eine
## **Tangente** dazu (die Fluchtrichtung um 90° gedreht, immer in dieselbe
## Richtung) — sie bricht die Symmetrie zuverlässig in eine Richtung, statt
## sich in ihr aufzuheben. Weg von der Wand bleibt der stärkere Anteil, die
## Tangente sorgt nur dafür, dass daraus auch bei exakter Symmetrie ein
## echter seitlicher Schwenk statt eines bloßen Abbremsens wird.
static func richtung_um_hindernisse(
	von: Vector2, ziel: Vector2, hindernisse: Array[Rect2], einfluss: float, rand: float,
) -> Vector2:
	var richtung := richtung_zu(von, ziel)
	if hindernisse.is_empty() or einfluss <= 0.0:
		return richtung

	var ablenkung := Vector2.ZERO
	for h in hindernisse:
		var erweitert := h.grow(rand)
		var randpunkt := naechster_randpunkt(erweitert, von)
		var unterschied := von - randpunkt
		var abstand := unterschied.length()

		if abstand < 0.01:
			# Steckt (fast) mittendrin -- kommt über die echte Kollision
			# regulär nicht vor, eine feste Richtung ist trotzdem besser als
			# eine Division durch nahezu null.
			ablenkung += Vector2.UP
			continue

		if abstand < einfluss:
			var weg := unterschied / abstand
			var tangente := Vector2(-weg.y, weg.x)
			var staerke := 1.0 - abstand / einfluss
			ablenkung += (weg + tangente * 0.5) * staerke

	var ergebnis := richtung + ablenkung
	return ergebnis.normalized() if ergebnis.length_squared() > 0.0 else richtung


## Einen Punkt aus jedem überlappenden Hindernis heraus an den nächsten Rand
## schieben — gebraucht, wenn ein Kartenwechsel mitten in der Runde ein neues
## Hindernis genau dort erscheinen lässt, wo der Spieler gerade steht (die
## Runde ist zu dem Zeitpunkt pausiert, seine Position also „eingefroren" von
## der vorherigen Karte). `rand` ist derselbe halbe Durchmesser wie bei
## `in_arena` — ohne ihn stünde die Figur nach dem Schieben nur mit dem
## Mittelpunkt außerhalb, zur Hälfte aber immer noch im Hindernis.
static func aus_hindernissen_geschoben(punkt: Vector2, hindernisse: Array[Rect2], rand: float) -> Vector2:
	var ergebnis := punkt
	for h in hindernisse:
		var erweitert := h.grow(rand)
		if not erweitert.has_point(ergebnis):
			continue

		var links := ergebnis.x - erweitert.position.x
		var rechts := erweitert.end.x - ergebnis.x
		var oben := ergebnis.y - erweitert.position.y
		var unten := erweitert.end.y - ergebnis.y
		var kleinste := minf(minf(links, rechts), minf(oben, unten))

		if kleinste == links:
			ergebnis.x = erweitert.position.x - 0.5
		elif kleinste == rechts:
			ergebnis.x = erweitert.end.x + 0.5
		elif kleinste == oben:
			ergebnis.y = erweitert.position.y - 0.5
		else:
			ergebnis.y = erweitert.end.y + 0.5
	return ergebnis
