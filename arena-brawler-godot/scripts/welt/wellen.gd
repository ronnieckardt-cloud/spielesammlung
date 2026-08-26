class_name Wellen
extends RefCounted
## Die Steigerung über die Wellen — **reine Funktionen, kein Node, keine Uhr**.
##
## Dieselbe Trennung wie bei `Bewegung`: Wie viele Gegner eine Welle hat und
## wie schnell sie laufen, lässt sich ohne laufende Szene durchrechnen. Wer
## den Ablauf wirklich steuert (Uhr, Spawnen, Aufräumen), steht in
## `wellenleiter.gd` — der kennt diese Zahlen, rechnet sie aber nicht selbst.

## Grundzahl in Welle 1, plus zwei je weiterer Welle — gedeckelt, damit eine
## sehr späte Welle nicht mehr Gegner spawnt, als gleichzeitig noch Sinn
## ergeben (und die Arena nicht zustellt).
const GRUND_ANZAHL := 3
const ANZAHL_JE_WELLE := 2
const MAX_ANZAHL := 14

## Tempo-Vervielfacher, nicht die Grundgeschwindigkeit selbst — die steht am
## einzelnen Gegner (`Gegner.TEMPO`), genau wie beim Spieler die Charaktere
## ihr eigenes Tempo mitbringen. Gedeckelt bei 1,6: Schneller als der
## langsamste Charakter (Tank, Faktor der Verfolgerbasis bleibt darunter)
## soll ein Verfolger nie werden, sonst gibt es kein Entkommen mehr.
const GRUND_TEMPO_FAKTOR := 1.0
const TEMPO_JE_WELLE := 0.06
const MAX_TEMPO_FAKTOR := 1.6


## Ab welcher Welle sich ein zäherer Typ einmischt, und mit welchem Gewicht
## er dann neben dem Verfolger im Lostopf liegt. Der Verfolger bleibt immer
## dabei (`VERFOLGER_GEWICHT`) — selbst in einer sehr späten Welle soll nicht
## ausschließlich der zäheste Typ kommen, sonst wäre das ein Austauschen,
## kein Steigern mehr.
const PANZER_AB_WELLE := 4
const PANZER_GEWICHT := 2
const FLINK_AB_WELLE := 7
const FLINK_GEWICHT := 2
const VERFOLGER_GEWICHT := 3


static func gegner_fuer_welle(welle: int) -> int:
	return mini(MAX_ANZAHL, GRUND_ANZAHL + (welle - 1) * ANZAHL_JE_WELLE)


static func tempo_faktor_fuer_welle(welle: int) -> float:
	return minf(MAX_TEMPO_FAKTOR, GRUND_TEMPO_FAKTOR + (welle - 1) * TEMPO_JE_WELLE)


## Welche Gegnertypen ab dieser Welle im Lostopf liegen, mit ihrem Gewicht
## darin (`StringName` → `int`). Reine Rechnung — der eigentliche Wurf
## (welcher der verfügbaren Typen wird's diesmal) bleibt beim Aufrufer, siehe
## `gegnertyp_auswaehlen`.
static func gegnertyp_gewichte_fuer_welle(welle: int) -> Dictionary:
	var gewichte := {Gegnertypen.VERFOLGER: VERFOLGER_GEWICHT}
	if welle >= PANZER_AB_WELLE:
		gewichte[Gegnertypen.PANZER] = PANZER_GEWICHT
	if welle >= FLINK_AB_WELLE:
		gewichte[Gegnertypen.FLINK] = FLINK_GEWICHT
	return gewichte


## Einen Typ aus den Gewichten ziehen. `t` liegt in `[0, 1)` und kommt vom
## Aufrufer (dort steckt der echte Zufall, `randf()`) — diese Funktion würfelt
## selbst nicht, sie rechnet nur nach, genau wie `punkt_am_rand` es mit dem
## Rand tut. Godot-Dictionaries behalten die Einfügereihenfolge, dieselben
## Gewichte ergeben bei demselben `t` deshalb immer denselben Typ.
static func gegnertyp_auswaehlen(gewichte: Dictionary, t: float) -> StringName:
	var gesamt := 0
	for gewicht in gewichte.values():
		gesamt += int(gewicht)
	if gesamt <= 0:
		return Gegnertypen.VERFOLGER

	var schwelle := clampf(t, 0.0, 0.999999) * gesamt
	var summe := 0
	for id in gewichte:
		summe += int(gewichte[id])
		if schwelle < summe:
			return id

	return Gegnertypen.VERFOLGER


## Ein Punkt auf dem Rand der Arena, `rand` nach innen versetzt (sonst steckt
## der Gegner beim Spawnen halb in der Wand). `t` läuft einmal um den ganzen
## Umfang, `0` an der linken oberen Ecke, im Uhrzeigersinn — der Zufall bleibt
## draußen: Der Aufrufer würfelt `t`, diese Funktion rechnet nur nach.
##
## Warum am Rand und nicht irgendwo im Feld: Ein Gegner, der neben dem
## Spieler auftaucht, ist kein Spielzug mehr, sondern ein Überfall. Der Rand
## lässt genug Zeit, ihn kommen zu sehen.
static func punkt_am_rand(flaeche: Rect2, t: float, rand: float) -> Vector2:
	var breite := maxf(0.0, flaeche.size.x - rand * 2.0)
	var hoehe := maxf(0.0, flaeche.size.y - rand * 2.0)
	var umfang := 2.0 * (breite + hoehe)

	var s := fmod(t, 1.0)
	if s < 0.0:
		s += 1.0
	s *= umfang

	var ecke := flaeche.position + Vector2(rand, rand)

	if s < breite:
		return ecke + Vector2(s, 0.0)
	s -= breite
	if s < hoehe:
		return ecke + Vector2(breite, s)
	s -= hoehe
	if s < breite:
		return ecke + Vector2(breite - s, hoehe)
	s -= breite
	return ecke + Vector2(0.0, hoehe - s)
