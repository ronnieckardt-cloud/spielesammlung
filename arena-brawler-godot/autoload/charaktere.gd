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


## Die Farben, mit denen `Gestalt` die Figur zeichnet.
##
## Getrennt von `farbe`/`akzent`: Die beiden sind die **Erkennungsfarben** des
## Charakters (Geschoss, Kachel, später der Auswahlbildschirm) und dürfen sich
## nicht danach richten, was in der Figur gerade gut aussieht.
##
## Positionaler Konstruktor mit Absicht: Ein vergessenes Feld ist damit ein
## Fehler beim Start und nicht eine Figur, an der still ein Teil schwarz bleibt.
class Anstrich extends RefCounted:
	var panzer: Color      ## Anzug: Rumpf, Arme
	var platte: Color      ## Schulterstücke und Rückenmodul — die Erkennungsfläche
	var brust: Color       ## Brustplatte, die größte einzelne Fläche von oben
	var helm: Color
	var leuchten: Color    ## Visier und schmale Lichtkanten
	var dunkel: Color      ## Stiefel, Handschuhe, Waffe
	var kontur: Color      ## Umriss um jedes Teil

	func _init(
		p_panzer: Color, p_platte: Color, p_brust: Color, p_helm: Color,
		p_leuchten: Color, p_dunkel: Color, p_kontur: Color,
	) -> void:
		panzer = p_panzer
		platte = p_platte
		brust = p_brust
		helm = p_helm
		leuchten = p_leuchten
		dunkel = p_dunkel
		kontur = p_kontur


## Werte einer Variante. Ein eigener Typ statt eines Dictionary, damit ein
## Tippfehler im Feldnamen beim Start auffliegt und nicht erst im Spiel.
class Variante extends RefCounted:
	var id: StringName
	var name: String
	var staerke: String
	var farbe: Color
	var akzent: Color
	var anstrich: Anstrich

	var leben: int
	var tempo: float
	var schuss_pause: float      ## Sekunden zwischen zwei Schüssen
	var reichweite: float
	var unverwundbar: float      ## Sekunden nach einem Treffer

	func _init(
		p_id: StringName, p_name: String, p_staerke: String,
		p_farbe: Color, p_akzent: Color, p_anstrich: Anstrich,
		p_leben: int, p_tempo: float, p_schuss_pause: float,
		p_reichweite: float, p_unverwundbar: float,
	) -> void:
		id = p_id
		name = p_name
		staerke = p_staerke
		farbe = p_farbe
		akzent = p_akzent
		anstrich = p_anstrich
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
			# Blau/Weiß: Das Weiß liegt auf der Brustplatte — von oben die
			# größte Fläche der Figur — und nicht auf dem Helm. Ein weißer
			# Helm war der erste Versuch und wurde zur hellsten Scheibe im
			# Bild: Man sah einen Kopf und darum herum Beiwerk.
			Anstrich.new(
				Color("2f5aa0"), Color("3d8bf2"), Color("eef4ff"), Color("6f9ede"),
				Color("8ff0ff"), Color("16233d"), Color("0a1424"),
			),
			5, 260.0, 0.25, 460.0, 0.9,
		),
		Variante.new(
			&"schnell", "Schnell", "Läuft allen davon, hält aber wenig aus",
			Color("ff8a00"), Color("2b2b35"),
			# „Schwarz/Orange", aber der Anzug ist Anthrazit und nicht Schwarz:
			# Der Arenaboden ist #232634. Eine wirklich schwarze Figur darauf
			# hat keinen Umriss mehr — genau der Fehler, der im
			# Phaser-Prototyp schon einmal drin war. Das Schwarz steckt in
			# `dunkel` und `kontur`, wo es Kanten setzt statt Flächen.
			Anstrich.new(
				Color("3c3c4a"), Color("ff8a00"), Color("ff8a00"), Color("2f2f3c"),
				Color("ffd166"), Color("1c1c24"), Color("0b0b11"),
			),
			4, 355.0, 0.215, 380.0, 0.9,
		),
		Variante.new(
			&"tank", "Tank", "Steckt viel ein, ist dafür schwerfällig",
			Color("74a03c"), Color("333941"),
			# Dasselbe beim Dunkelgrau: #333941 liegt zu dicht am Boden, der
			# Panzer ist deshalb eine Stufe heller.
			#
			# Grün sitzt nur auf Schulterstücken und Rückenmodul — also
			# außen, wo die Breite entsteht. Die Mitte bleibt grau. Der
			# erste Versuch hatte auch die Brust grün, und dann war die
			# Figur einfach grün: „Grün/Dunkelgrau" war nicht mehr zu sehen,
			# und Schulter und Brust verschmolzen zu einer Fläche.
			Anstrich.new(
				Color("4a525e"), Color("74a03c"), Color("5f6874"), Color("98a2b2"),
				Color("c9e88a"), Color("22262c"), Color("0e1218"),
			),
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
