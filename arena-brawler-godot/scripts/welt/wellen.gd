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

## Pause zwischen zwei Wellen in Sekunden — kurz genug, um nicht zu warten,
## lang genug, um zu merken „geschafft, gleich geht's weiter".
const PAUSE_ZWISCHEN_WELLEN := 2.0


static func gegner_fuer_welle(welle: int) -> int:
	return mini(MAX_ANZAHL, GRUND_ANZAHL + (welle - 1) * ANZAHL_JE_WELLE)


static func tempo_faktor_fuer_welle(welle: int) -> float:
	return minf(MAX_TEMPO_FAKTOR, GRUND_TEMPO_FAKTOR + (welle - 1) * TEMPO_JE_WELLE)


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
