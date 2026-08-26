class_name Karten
extends RefCounted
## Die Arena-Layouts — reine Daten, kein Node. Jede Karte ist nur eine Liste
## rechteckiger Hindernisse in arena-lokalen Koordinaten (0,0 bis 1152×648,
## dieselbe Fläche wie `Arena.groesse`) — `arena.gd` zeichnet daraus Kollision
## und Optik, diese Datei kennt weder das eine noch das andere.
##
## **Wechsel automatisch alle `WECHSEL_ALLE_WELLEN` Wellen**, nicht über einen
## Auswahlbildschirm vor der Runde. Ein dritter Bildschirm vor jeder Runde
## (nach der Charakterauswahl) wäre ein zusätzlicher Tipp und eine
## zusätzliche Entscheidung — ausgerechnet auf einem Touch-Zielgerät, wo jeder
## Tipp zählt. Der automatische Wechsel bringt stattdessen Abwechslung
## **innerhalb einer** Runde, genau dort, wo die Wellen ohnehin schon
## automatisch schwerer werden (`Wellen.gegner_fuer_welle` und Geschwister) —
## Kartenwechsel reiht sich in dieselbe Steigerung ein, statt eine zweite,
## eigene Bedienebene zu eröffnen.

class Karte extends RefCounted:
	var id: StringName
	var name: String
	var hindernisse: Array[Rect2]

	func _init(p_id: StringName, p_name: String, p_hindernisse: Array[Rect2]) -> void:
		id = p_id
		name = p_name
		hindernisse = p_hindernisse


const OFFEN := &"offen"
const KREUZ := &"kreuz"
const GASSE := &"gasse"

## Alle X Wellen wechselt die Karte — dieselbe Größenordnung wie das eigene
## Beispiel aus der Aufgabenstellung ("nach Welle 3/6").
const WECHSEL_ALLE_WELLEN := 3

## Sicherheitsabstand jedes Hindernisses zum Arenarand. Gegner spawnen auf
## dem Rand-Ring, `SPAWN_ABSTAND` (24, siehe `wellenleiter.gd`) nach innen
## versetzt — kein Hindernis darf näher als das an den Rand heranreichen,
## sonst könnte ein Spawnpunkt in einem Hindernis liegen. Deutlich großzügiger
## als die 24 selbst: Ein Gegner ist kein Punkt, sondern hat einen eigenen
## Radius (bis 17 beim Panzer-Verfolger), der mit hineinpassen muss.
const RAND_SICHERHEITSABSTAND := 90.0

const ARENA_GROESSE := Vector2(1152, 648)


static func alle_karten() -> Array[Karte]:
	return [
		Karte.new(OFFEN, "Offen", []),
		Karte.new(KREUZ, "Kreuz", _kreuz_hindernisse()),
		Karte.new(GASSE, "Gasse", _gasse_hindernisse()),
	]


## Vier Blöcke, die ein Kreuz um die Mitte bilden — mit einer echten Lücke
## zwischen den Armen (`luecke`), kein durchgehendes Plus: Ein geschlossenes
## Kreuz schottete vier Viertel gegeneinander ab, das hier ist ein Hindernis,
## um das man laufen kann, kein Labyrinth.
##
## Die Zahlen sind kein Zufall: `ist_voll_erreichbar` prüft die begehbare
## Fläche **aufgeweitet um den größten Körper** (bis Radius 17 beim
## Panzer-Verfolger) — die erste Fassung hatte `luecke=70`/`dicke=56` und
## ließ genau an den vier "Ellbogen" zwischen zwei Armen nur rund 4 Pixel
## Luft, deutlich weniger als ein Körper braucht. Der Test schlug fehl, nicht
## das Auge — an einer so schmalen Stelle sieht man im Bild kaum, dass da
## überhaupt ein Engpass ist. `luecke=95`/`dicke=40` lässt an jedem Ellbogen
## rund 37 Pixel Luft.
static func _kreuz_hindernisse() -> Array[Rect2]:
	var mitte := ARENA_GROESSE / 2.0
	var laenge := 125.0
	var dicke := 40.0
	var luecke := 95.0
	var h := dicke / 2.0
	return [
		Rect2(mitte + Vector2(-luecke - laenge, -h), Vector2(laenge, dicke)),
		Rect2(mitte + Vector2(luecke, -h), Vector2(laenge, dicke)),
		Rect2(mitte + Vector2(-h, -luecke - laenge), Vector2(dicke, laenge)),
		Rect2(mitte + Vector2(-h, luecke), Vector2(dicke, laenge)),
	]


## Zwei lange Blöcke links und rechts der Mitte — eine breite Gasse
## dazwischen, durch die man muss, aber an den Seiten bequem vorbeikommt
## (340 Pixel Durchgang, weit mehr als das Doppelte des größten
## Gegner-Durchmessers).
static func _gasse_hindernisse() -> Array[Rect2]:
	var hoehe := 340.0
	var breite := 90.0
	var luecke := 340.0
	var y := (ARENA_GROESSE.y - hoehe) / 2.0
	var mitte_x := ARENA_GROESSE.x / 2.0
	return [
		Rect2(Vector2(mitte_x - luecke / 2.0 - breite, y), Vector2(breite, hoehe)),
		Rect2(Vector2(mitte_x + luecke / 2.0, y), Vector2(breite, hoehe)),
	]


static func nach_id(id: StringName) -> Karte:
	for k in alle_karten():
		if k.id == id:
			return k
	return alle_karten()[0]


## Welche Karte ab dieser Welle gilt — reine Rechnung, kein Zufall: Dieselbe
## Wellenzahl ergibt überall dieselbe Karte, ganz ohne Absprache.
static func fuer_welle(welle: int) -> Karte:
	var karten := alle_karten()
	var index := int((maxi(1, welle) - 1) / float(WECHSEL_ALLE_WELLEN)) % karten.size()
	return karten[index]


## Beweist, dass die begehbare Fläche einer Karte **eine einzige**
## zusammenhängende Region ist — kein Hindernis darf eine Ecke so
## abschotten, dass ein Gegner (der nur um Rechtecke herumgleitet, nicht
## sucht) den Spieler nicht erreichen kann. Ein grobes Rasterfeld
## (Standard 16 Pixel, deutlich unter jedem Gegnerradius) wird von einer
## garantiert freien Ecke aus geflutet — dieselbe Grundidee wie der
## Flutfüllungs-Test in Ghost Chase, nur auf Rechtecken statt auf einem
## Text-Labyrinth. `rand` ist der Radius, um den Hindernisse für die
## Rechnung aufgeweitet werden (der größte vorkommende Gegner- oder
## Spielerradius) — ohne ihn gälte ein Spalt als begehbar, durch den in
## Wahrheit niemand passt.
static func ist_voll_erreichbar(karte: Karte, rand: float, raster: float = 16.0) -> bool:
	var spalten := int(ARENA_GROESSE.x / raster)
	var zeilen := int(ARENA_GROESSE.y / raster)

	var blockierte_zellen := {}
	for sy in zeilen:
		for sx in spalten:
			var p := Vector2((sx + 0.5) * raster, (sy + 0.5) * raster)
			for h in karte.hindernisse:
				if h.grow(rand).has_point(p):
					blockierte_zellen[Vector2i(sx, sy)] = true
					break

	var start := Vector2i(0, 0)
	if blockierte_zellen.has(start):
		return false  # Sollte durch RAND_SICHERHEITSABSTAND nie vorkommen.

	var nachbarschaft: Array[Vector2i] = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]

	var besucht := {start: true}
	var schlange: Array[Vector2i] = [start]
	while not schlange.is_empty():
		var z: Vector2i = schlange.pop_back()
		for versatz in nachbarschaft:
			var n: Vector2i = z + versatz
			if n.x < 0 or n.x >= spalten or n.y < 0 or n.y >= zeilen:
				continue
			if besucht.has(n) or blockierte_zellen.has(n):
				continue
			besucht[n] = true
			schlange.append(n)

	for sy in zeilen:
		for sx in spalten:
			var z := Vector2i(sx, sy)
			if not blockierte_zellen.has(z) and not besucht.has(z):
				return false
	return true
