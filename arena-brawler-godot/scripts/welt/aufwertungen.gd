class_name Aufwertungen
extends RefCounted
## Die Karten nach einer geschafften Welle — **reine Daten und Funktionen,
## kein Node, keine Uhr**. Dieselbe Trennung wie bei `Wellen`: Welche Karten
## gerade wählbar sind und was ein Stapel bewirkt, lässt sich ohne laufende
## Szene durchrechnen. Wer die drei Karten wirklich anzeigt und die Wahl
## entgegennimmt, steht in `ui/aufwertungsauswahl.gd`; wer die Wirkung wirklich
## anwendet, steht in `Spieler.aufwertung_anwenden` — diese Datei kennt keinen
## Spieler und keinen Knoten, nur die Zahlen.

## Eine Art von Aufwertung: Anzeigetext plus Obergrenze. Ein eigener Typ statt
## eines Dictionary, aus demselben Grund wie bei `Charaktere.Variante` — ein
## falsch geschriebener Schlüssel fliegt beim Start auf, nicht erst beim
## Anzeigen einer Karte.
class Art extends RefCounted:
	var id: StringName
	var titel: String
	var beschreibung: String
	## Für `LEBEN` ungenutzt (dort hängt die Grenze am aktuellen Leben, nicht
	## an einem Stapelzähler — siehe `verfuegbare_arten`).
	var max_stapel: int

	func _init(p_id: StringName, p_titel: String, p_beschreibung: String, p_max_stapel: int) -> void:
		id = p_id
		titel = p_titel
		beschreibung = p_beschreibung
		max_stapel = p_max_stapel


const LEBEN := &"leben"
const FEUERRATE := &"feuerrate"
const TEMPO := &"tempo"
const SCHADEN := &"schaden"
const REICHWEITE := &"reichweite"

## Wieviel ein einzelner Stapel bringt — als Faktor **je Stapel**, nicht
## insgesamt: Fünf Stapel Feuerrate multiplizieren die Schusspause fünfmal
## mit 0,88, nicht einmal mit 0,12. So wächst jede weitere Stufe spürbar,
## aber mit sinkendem Grenznutzen statt eines plötzlichen Sprungs am Ende.
const LEBEN_SCHRITT := 1
const LEBEN_MAX := 8

const FEUERRATE_FAKTOR := 0.88   ## kürzere Schusspause je Stapel
const FEUERRATE_MAX_STAPEL := 5

const TEMPO_FAKTOR := 1.08
const TEMPO_MAX_STAPEL := 5

const REICHWEITE_FAKTOR := 1.12
const REICHWEITE_MAX_STAPEL := 4

const GRUND_SCHADEN := 1
const SCHADEN_SCHRITT := 1
const SCHADEN_MAX_STAPEL := 5


## Alle fünf Arten. Als Funktion statt als `const`-Liste, weil `Art.new(...)`
## kein Konstantenausdruck ist — genau dieselbe Einschränkung, wegen der auch
## `Charaktere.liste` in `_ready()` aufgebaut wird und nicht als `const`.
static func alle_arten() -> Array[Art]:
	return [
		Art.new(LEBEN, "Mehr Leben", "+%d Leben (bis %d)" % [LEBEN_SCHRITT, LEBEN_MAX], LEBEN_MAX),
		Art.new(FEUERRATE, "Schnellere Schüsse", "Schusspause −12 % je Stapel", FEUERRATE_MAX_STAPEL),
		Art.new(TEMPO, "Mehr Tempo", "Lauftempo +8 % je Stapel", TEMPO_MAX_STAPEL),
		Art.new(SCHADEN, "Stärkere Kugeln", "+%d Schaden je Treffer" % SCHADEN_SCHRITT, SCHADEN_MAX_STAPEL),
		Art.new(REICHWEITE, "Größere Reichweite", "Schussweite +12 % je Stapel", REICHWEITE_MAX_STAPEL),
	]


## Welche Arten gerade überhaupt noch etwas bewirken würden. `stapel` zählt
## die vier stapelbaren Arten (Schlüssel = `id`, Wert = bisherige Stapel);
## Leben ist ein Sonderfall, weil seine Grenze am **aktuellen** Leben hängt,
## nicht an einem eigenen Zähler — eine volle Lebensanzeige soll die Karte
## nicht mehr anbieten, ganz gleich wie oft sie vorher schon gewählt wurde.
static func verfuegbare_arten(stapel: Dictionary, aktuelles_leben: int) -> Array[Art]:
	var ergebnis: Array[Art] = []
	for art in alle_arten():
		if art.id == LEBEN:
			if aktuelles_leben < LEBEN_MAX:
				ergebnis.append(art)
		elif int(stapel.get(art.id, 0)) < art.max_stapel:
			ergebnis.append(art)
	return ergebnis


## Einen Stapel um eins erhöhen, gedeckelt bei der Obergrenze der Art. Für
## `LEBEN` liefert das absichtlich `bisheriger_stapel` unverändert zurück —
## Leben läuft nicht über diesen Zähler, siehe oben.
static func naechster_stapel(bisheriger_stapel: int, art_id: StringName) -> int:
	if art_id == LEBEN:
		return bisheriger_stapel
	for art in alle_arten():
		if art.id == art_id:
			return mini(art.max_stapel, bisheriger_stapel + 1)
	return bisheriger_stapel


static func feuerrate_faktor(stapel: int) -> float:
	return pow(FEUERRATE_FAKTOR, stapel)


static func tempo_faktor(stapel: int) -> float:
	return pow(TEMPO_FAKTOR, stapel)


static func reichweite_faktor(stapel: int) -> float:
	return pow(REICHWEITE_FAKTOR, stapel)


static func schaden(stapel: int) -> int:
	return GRUND_SCHADEN + stapel * SCHADEN_SCHRITT
