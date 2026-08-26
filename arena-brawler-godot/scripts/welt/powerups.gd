class_name Powerups
extends RefCounted
## Die drei Powerup-Arten — reine Daten und Rechnung, kein Node, keine Uhr,
## kein Zufall. Dieselbe Aufteilung wie bei `Aufwertungen`/`Gegnertypen`: Was
## ein Powerup bewirkt und wie lange, steht hier; wer es wirklich aufsammelt
## und anzeigt, steht in `powerups/powerup.gd`, `spieler.gd` und `main.gd`.

const SCHILD := &"schild"
const TEMPO := &"tempo"
const SCHNELLFEUER := &"schnellfeuer"

const ALLE_ARTEN: Array[StringName] = [SCHILD, TEMPO, SCHNELLFEUER]

const NAMEN := {
	SCHILD: "Schild",
	TEMPO: "Tempo-Boost",
	SCHNELLFEUER: "Schnellfeuer",
}

## Wirkdauer der beiden zeitlich befristeten Arten — Schild wirkt bis zum
## nächsten abgefangenen Treffer, hat also keine eigene Dauer.
const TEMPO_DAUER := 5.0
const SCHNELLFEUER_DAUER := 5.0

const TEMPO_FAKTOR := 1.35
const SCHNELLFEUER_FAKTOR := 0.55  ## kürzere Schusspause, wie bei der Aufwertung

## Wie selten ein sterbender Gegner eins fallen lässt — bewusst niedrig,
## „nicht spam" ist eine ausdrückliche Vorgabe der Aufgabe.
const DROP_CHANCE := 0.09

## Zeitgesteuerter Nachschub, falls lange keiner gefallen ist — greift nur,
## wenn gerade keins auf dem Feld liegt (siehe `wellenleiter.gd`), damit sich
## nie mehr als eins gleichzeitig ansammelt.
const ZEITGESTEUERT_ALLE_SEKUNDEN := 22.0


static func name_von(art_id: StringName) -> String:
	return NAMEN.get(art_id, "")


static func ist_gueltige_art(art_id: StringName) -> bool:
	return ALLE_ARTEN.has(art_id)


## `t` kommt vom Aufrufer (`randf()`) — diese Funktion würfelt selbst nicht,
## dieselbe Aufteilung wie `Wellen.gegnertyp_auswaehlen`.
static func zufaellige_art(t: float) -> StringName:
	var index := int(clampf(t, 0.0, 0.999999) * ALLE_ARTEN.size())
	return ALLE_ARTEN[index]
