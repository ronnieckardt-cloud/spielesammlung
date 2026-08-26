class_name Gegnertypen
extends RefCounted
## Die drei Gegnertypen — **reine Daten, kein Verhalten**. Dieselbe
## Aufteilung wie bei `Charaktere`: Welche Werte ein Typ mitbringt, steht
## genau hier und nirgends sonst. Wann welcher Typ in einer Welle auftaucht,
## weiß `Wellen`; wie er aussieht, weiß `Gegnergestalt`; was er im Spiel tut,
## weiß `Gegner` — diese Datei kennt keinen Knoten, keine Uhr, keinen Zufall.

## Ein Gegnertyp. Eigener Typ statt `Dictionary`, aus demselben Grund wie bei
## `Charaktere.Variante`: Ein Tippfehler im Feldnamen fliegt beim Start auf,
## nicht erst beim Spawnen.
class Art extends RefCounted:
	var id: StringName
	var name: String

	var leben: int
	var tempo: float     ## Grundtempo, bevor `Wellen.tempo_faktor_fuer_welle` draufmultipliziert
	var radius: float    ## Trefferfläche — bestimmt Kollisionsform **und** Größe der Silhouette

	## Rot-/Orangetöne, klar als „Gegner" lesbar und mit hohem Kontrast zum
	## Arenaboden — siehe die Kontrast-Prüfung in `pruefen.gd`.
	var koerper: Color
	var kern: Color
	var kontur: Color

	func _init(
		p_id: StringName, p_name: String, p_leben: int, p_tempo: float, p_radius: float,
		p_koerper: Color, p_kern: Color, p_kontur: Color,
	) -> void:
		id = p_id
		name = p_name
		leben = p_leben
		tempo = p_tempo
		radius = p_radius
		koerper = p_koerper
		kern = p_kern
		kontur = p_kontur


const VERFOLGER := &"verfolger"
const PANZER := &"panzer"
const FLINK := &"flink"


## Als Funktion statt `const`-Liste, weil `Art.new(...)` kein
## Konstantenausdruck ist — dieselbe Einschränkung wie bei
## `Aufwertungen.alle_arten()`.
static func alle_arten() -> Array[Art]:
	return [
		# Verfolger: der bisherige, einfachste Typ. Normales Tempo, ein
		# Leben — der Grundbaustein, ab Welle 1 immer dabei.
		Art.new(
			VERFOLGER, "Verfolger", 1, 95.0, 12.0,
			Color(0.55, 0.08, 0.1), Color(0.85, 0.15, 0.15), Color(0.05, 0.02, 0.02),
		),
		# Panzer-Verfolger: breiter, blockiger, spürbar zäher — drei Treffer
		# statt einem, dafür langsamer. Genau der Typ, gegen den „Stärkere
		# Kugeln" endlich einen Unterschied macht: Ohne die Karte drei
		# Schüsse, mit ein bis zwei Stapeln nur noch einer oder zwei.
		Art.new(
			PANZER, "Panzer-Verfolger", 3, 72.0, 17.0,
			Color(0.5, 0.22, 0.05), Color(0.88, 0.42, 0.08), Color(0.04, 0.02, 0.01),
		),
		# Flink: schlanker, schneller, hält aber nur einen Treffer aus —
		# das Gegenstück zum Panzer. Erst in späten Wellen dabei, wenn der
		# Spieler durch Aufwertungen längst nicht mehr beim Grundtempo steht.
		Art.new(
			FLINK, "Flink", 1, 112.0, 9.0,
			Color(0.62, 0.10, 0.04), Color(0.95, 0.30, 0.08), Color(0.05, 0.02, 0.01),
		),
	]


static func nach_id(id: StringName) -> Art:
	for a in alle_arten():
		if a.id == id:
			return a
	return alle_arten()[0]
