extends Node
## Die drei spielbaren Varianten — **reine Daten, kein Verhalten**.
##
## Autoload, weil sowohl Spieler als auch spätere Auswahl-Oberfläche und
## Spielstand darauf zugreifen. Es hält bewusst keinen Zustand: Was gerade
## gewählt ist, weiß der Spielstand, nicht diese Liste.
##
## Der Grund für die Trennung ist derselbe wie im Phaser-Prototyp: Steht ein
## Startwert im Spielercode noch einmal fest verdrahtet, gilt für einen Wert der
## Charakter und für den nächsten die alte Zahl — und das fällt erst beim
## Spielen auf, nicht beim Lesen.


## Werte einer Variante. Ein eigener Typ statt eines Dictionary, damit ein
## Tippfehler im Feldnamen beim Start auffliegt und nicht erst im Spiel.
class Variante extends RefCounted:
	var id: StringName
	var name: String
	var staerke: String
	var farbe: Color
	var akzent: Color

	var leben: int
	var tempo: float
	var schuss_pause: float      ## Sekunden zwischen zwei Schüssen
	var reichweite: float
	var unverwundbar: float      ## Sekunden nach einem Treffer

	func _init(
		p_id: StringName, p_name: String, p_staerke: String,
		p_farbe: Color, p_akzent: Color,
		p_leben: int, p_tempo: float, p_schuss_pause: float,
		p_reichweite: float, p_unverwundbar: float,
	) -> void:
		id = p_id
		name = p_name
		staerke = p_staerke
		farbe = p_farbe
		akzent = p_akzent
		leben = p_leben
		tempo = p_tempo
		schuss_pause = p_schuss_pause
		reichweite = p_reichweite
		unverwundbar = p_unverwundbar


var liste: Array[Variante] = []

const STANDARD_ID := &"ausgewogen"


func _ready() -> void:
	liste = [
		Variante.new(
			&"ausgewogen", "Ausgewogen", "Kann alles ein bisschen — gut zum Anfangen",
			Color("3d8bf2"), Color("f4f8ff"),
			5, 260.0, 0.25, 460.0, 0.9,
		),
		Variante.new(
			&"schnell", "Schnell", "Läuft allen davon, hält aber wenig aus",
			Color("ff8a00"), Color("2b2b35"),
			4, 355.0, 0.215, 380.0, 0.9,
		),
		Variante.new(
			&"tank", "Tank", "Steckt viel ein, ist dafür schwerfällig",
			Color("74a03c"), Color("333941"),
			# Längere Unverwundbarkeit statt kürzerer: Eine kürzere wäre für
			# einen Tank ein Nachteil und das Gegenteil seiner Rolle. Wer viel
			# einsteckt, soll nach einem Treffer Zeit haben, sich zu lösen.
			7, 215.0, 0.3, 460.0, 1.3,
		),
	]


func nach_id(id: StringName) -> Variante:
	for v in liste:
		if v.id == id:
			return v
	return null


func standard() -> Variante:
	return nach_id(STANDARD_ID)


## Die Variante nach der aktuellen — für das Durchschalten mit Tab.
func naechste(id: StringName) -> Variante:
	for i in liste.size():
		if liste[i].id == id:
			return liste[(i + 1) % liste.size()]
	return standard()
