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
