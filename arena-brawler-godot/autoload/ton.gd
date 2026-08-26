extends Node
## Kurze, im Code erzeugte Toneffekte — keine Audiodateien, kein Addon.
##
## Dieselbe Idee wie `sfx.ts` in der React-Spielesammlung (CLAUDE.md: „Kurze
## Töne über die Web Audio API, keine Dateien"), nur mit Godots Bordmitteln:
## Jeder Effekt ist ein von Hand geschriebener `AudioStreamWAV`-Puffer (Sinus-
## oder Rechteckwelle mit Tonhöhenverlauf, teils mit Rauschen gemischt), einmal
## in `_ready()` erzeugt und danach nur noch abgespielt. Keine externen
## Samples, kein Jingle, der einem bekannten Spiel ähnelt — jeder Ton ist ein
## einfacher, generischer Sweep oder eine kurze Tonfolge.
##
## **ALWAYS, wie `Eingabe`.** Die Wellenmeldung, die Aufwertungskarten und der
## Rundenende-Bildschirm lösen ihre Töne genau in den Momenten aus, in denen
## die Runde pausiert ist (`Oberflaeche` hat selbst ALWAYS, siehe main.gd) —
## ein `AudioStreamPlayer` mit dem sonst ererbten PAUSABLE würde in genau
## diesen Momenten verstummen. Spielinterne Töne (Schuss, Treffer, Tod,
## Schaden) lösen dagegen ohnehin nie während einer Pause aus, weil der
## auslösende Code selbst (Spieler, Gegner) unter `Main` hängt und dort
## mitpausiert — `ALWAYS` am Player ändert daran nichts, es öffnet nur die
## Möglichkeit für die Fälle, die es wirklich brauchen.
##
## Ob Ton läuft, wird wie der Highscore gespeichert (`ConfigFile`, eigener
## kleiner Speicherort statt eines neuen Feldes in `Spielstand`, das mit
## „Charakter + Rekord" nichts zu tun hat).

const SPEICHERPFAD := "user://ton.cfg"

## 22 050 Hz reicht für kurze, einfache SFX locker und halbiert die
## Puffergröße gegenüber 44 100 — bei Effekten unter einer Viertelsekunde
## ohnehin nicht hörbar, aber weniger Rechnung bei der einmaligen Erzeugung.
const ABTASTRATE := 22050

var an: bool = true

## Kleiner Pool statt eines einzigen Players: Zwei Treffer im selben Bild
## (z. B. zwei Geschosse, die gleichzeitig einschlagen) sollen beide hörbar
## sein, nicht der zweite den ersten abwürgen.
const SPIELER_ANZAHL := 6
var _spieler_pool: Array[AudioStreamPlayer] = []
var _naechster_spieler := 0

var _cache: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	laden()

	for _i in SPIELER_ANZAHL:
		var p := AudioStreamPlayer.new()
		p.process_mode = Node.PROCESS_MODE_ALWAYS
		add_child(p)
		_spieler_pool.append(p)

	# Alle Effekte einmalig beim Start erzeugen, nicht erst beim ersten
	# Gebrauch — sonst würde ausgerechnet der allererste Schuss oder der
	# allererste Treffer eine (wenn auch winzige) Erzeugungspause riskieren.
	# Die Erzeugung braucht kein Netz und keine Datei, kostet also insgesamt
	# nur wenige Millisekunden reiner Rechnung, lange bevor die Charakter-
	# auswahl überhaupt zu sehen ist.
	for name in EFFEKTE:
		_cache[name] = _erzeugen(name)


## Spielt einen benannten Effekt ab, sofern Ton an ist. Ein unbekannter Name
## tut still nichts — das kann bei einem Tippfehler im Aufrufer passieren und
## soll dann nicht abstürzen.
func abspielen(name: StringName) -> void:
	if not an:
		return
	var stream: AudioStreamWAV = _cache.get(name)
	if stream == null:
		return

	var p := _spieler_pool[_naechster_spieler]
	_naechster_spieler = (_naechster_spieler + 1) % _spieler_pool.size()
	p.stream = stream
	p.play()


func an_setzen(wert: bool) -> void:
	an = wert
	speichern()


func speichern() -> void:
	var datei := ConfigFile.new()
	datei.set_value("ton", "an", an)
	var fehler := datei.save(SPEICHERPFAD)
	if fehler != OK:
		# Nicht abbrechen: Ein Prototyp darf am Speichern nicht scheitern.
		push_warning("Ton-Einstellung konnte nicht gespeichert werden (Fehler %d)" % fehler)


func laden() -> void:
	var datei := ConfigFile.new()
	if datei.load(SPEICHERPFAD) != OK:
		return  # Noch nichts da — der Startwert oben (an) gilt.
	an = bool(datei.get_value("ton", "an", true))


## Ohne das bleiben die einmalig erzeugten Klangpuffer und ihre zuletzt
## gespielten Wiedergabe-Objekte beim Beenden als ObjectDB-„Leck" stehen —
## für ein laufendes Spiel harmlos (das Betriebssystem räumt beim echten
## Prozessende ohnehin auf), aber sichtbares Rauschen in den Kopflos-
## Prüfungen, das einen echten Fehler verdecken könnte. Derselbe Kniff wie
## `Gegner._exit_tree()` bei seinen Tweens: aufräumen, sobald der Knoten
## selbst den Baum verlässt.
func _exit_tree() -> void:
	for p in _spieler_pool:
		p.stop()
		p.stream = null
	_cache.clear()


## Namen aller Effekte — **einzige** Stelle, die sie auflistet. `_ready()`
## erzeugt sie hierüber alle im Voraus, `pruefen.gd` prüft über dieselbe
## Liste, dass jeder einen echten Puffer bekommt — kein zweiter, von Hand
## gepflegter Aufzählung, die beim Hinzufügen eines neuen Effekts leicht
## vergessen wird.
##
## `dauer`/`lautstaerke` in `_erzeugen()` sind bewusst kurz und leise
## gehalten: Schuss und Treffer können pro Sekunde mehrfach auftreten, ein
## langer oder lauter Ton würde sich bei schnellem Spiel zu Dauerrauschen
## aufsummieren.
const EFFEKTE: Array[StringName] = [
	&"schuss", &"gegner_treffer", &"gegner_tod", &"spieler_schaden",
	&"welle_geschafft", &"aufwertung_gewaehlt", &"game_over", &"ui_klick",
	&"powerup", &"schild_bricht",
]


func _erzeugen(name: StringName) -> AudioStreamWAV:
	match name:
		&"schuss":
			# Kurzer, tiefer werdender Rechteckton — knapp und synthetisch,
			# absichtlich leise: Bei hoher Feuerrate reiht sich das, ohne zu
			# nerven.
			return _wav(_sweep(880.0, 380.0, 0.06, 0.22, true))
		&"gegner_treffer":
			# Kurzes, helles Rauschticken — ein Treffer, der nicht tötet
			# (vor allem beim Panzer-Verfolger wichtig, siehe gegner.gd).
			return _wav(_rauschen(0.045, 0.3, 1.0))
		&"gegner_tod":
			# Rauschen plus ein abfallender Ton übereinander — liest sich als
			# „Poff", deutlich von einem bloßen Treffer unterscheidbar.
			return _wav(_mischen(
				_rauschen(0.16, 0.3, 0.35),
				_sweep(520.0, 140.0, 0.16, 0.3, false),
			))
		&"spieler_schaden":
			# Eigene, härtere Klangfarbe (Rechteck statt Sinus) als die
			# Gegner-Töne — das ist die eine Rückmeldung, die wirklich
			# wichtig ist, sie darf nicht wie „irgendein Treffer" klingen.
			return _wav(_sweep(340.0, 160.0, 0.14, 0.42, true))
		&"welle_geschafft":
			# Drei aufsteigende Töne — kurz, klar positiv, keine bekannte
			# Melodie.
			return _wav(_folge([
				{"von": 520.0, "bis": 520.0, "dauer": 0.09, "lautstaerke": 0.34},
				{"von": 660.0, "bis": 660.0, "dauer": 0.09, "lautstaerke": 0.34},
				{"von": 880.0, "bis": 880.0, "dauer": 0.18, "lautstaerke": 0.38},
			]))
		&"aufwertung_gewaehlt":
			# Kurzer Zweiklang-Blip nach oben — „aufgesammelt", nicht so
			# feierlich wie eine geschaffte Welle.
			return _wav(_folge([
				{"von": 600.0, "bis": 600.0, "dauer": 0.055, "lautstaerke": 0.3},
				{"von": 920.0, "bis": 920.0, "dauer": 0.09, "lautstaerke": 0.34},
			]))
		&"game_over":
			# Kurz absteigend, zwei Töne — bewusst nicht lang oder dramatisch,
			# unter 350 ms insgesamt.
			return _wav(_folge([
				{"von": 420.0, "bis": 320.0, "dauer": 0.14, "lautstaerke": 0.32, "rechteck": true},
				{"von": 300.0, "bis": 190.0, "dauer": 0.16, "lautstaerke": 0.28, "rechteck": true},
			]))
		&"ui_klick":
			# Sehr kurz und leise — ein Antippen, keine Ansage.
			return _wav(_sweep(700.0, 700.0, 0.02, 0.16, true))
		&"powerup":
			# Heller Doppel-Blip, deutlich höher als "aufwertung_gewaehlt" —
			# ein Powerup ist ein Fund am Boden, keine gewählte Karte, die
			# beiden Rückmeldungen sollen sich nicht gleich anhören.
			return _wav(_folge([
				{"von": 760.0, "bis": 760.0, "dauer": 0.05, "lautstaerke": 0.3},
				{"von": 1140.0, "bis": 1140.0, "dauer": 0.1, "lautstaerke": 0.36},
			]))
		&"schild_bricht":
			# Rauschen plus ein kurzer, hoher Sinus-"Klirr" — ein Schild, der
			# einen Treffer abfängt, klingt nach Glas, nicht nach Schaden.
			return _wav(_mischen(
				_rauschen(0.09, 0.28, 0.5),
				_sweep(1400.0, 900.0, 0.09, 0.3, false),
			))
		_:
			return null


func _wav(puffer: PackedByteArray) -> AudioStreamWAV:
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = ABTASTRATE
	wav.stereo = false
	wav.data = puffer
	return wav


## Ein einzelner Ton mit gleitender Tonhöhe (Sweep) und weicher Hüllkurve —
## der Baustein für die meisten Effekte. Gleiche Start-/Endfrequenz ergibt
## einen reinen Ton, unterschiedliche ein Auf- oder Abgleiten. `rechteck`
## klingt härter/synthetischer als Sinus — passend für Schuss und Schaden.
## Ein kurzer linearer Anstieg (`ANSTIEG`) verhindert ein Knacken beim
## Einsetzen, der anschließende exponentielle Abfall macht aus jedem Ton
## einen kurzen Stoß statt eines abrupt abgeschnittenen Blocks.
func _sweep(frequenz_von: float, frequenz_bis: float, dauer: float, lautstaerke: float, rechteck: bool) -> PackedByteArray:
	const ANSTIEG := 0.004
	var anzahl := maxi(1, int(ABTASTRATE * dauer))
	var puffer := PackedByteArray()
	puffer.resize(anzahl * 2)

	var phase := 0.0
	for i in anzahl:
		var t := float(i) / ABTASTRATE
		var anteil := t / dauer
		var frequenz := lerpf(frequenz_von, frequenz_bis, anteil)
		phase += frequenz / ABTASTRATE

		var roh := sin(phase * TAU)
		if rechteck:
			roh = 1.0 if roh >= 0.0 else -1.0

		var huelle := minf(1.0, t / ANSTIEG) * exp(-3.5 * anteil)
		puffer.encode_s16(i * 2, int(clampf(roh * huelle * lautstaerke, -1.0, 1.0) * 32767.0))

	return puffer


## Weißes Rauschen mit demselben Hüllkurven-Aufbau wie `_sweep` — der
## Baustein für Treffer/Tod. `daempfung` glättet zwischen 0 (kein Filter,
## hell/scharf) und 1 (starker gleitender Mittelwert, dumpf/rund) — ein
## einfacher Ein-Pol-Tiefpass reicht für so kurze Effekte völlig.
func _rauschen(dauer: float, lautstaerke: float, daempfung: float) -> PackedByteArray:
	const ANSTIEG := 0.002
	var anzahl := maxi(1, int(ABTASTRATE * dauer))
	var puffer := PackedByteArray()
	puffer.resize(anzahl * 2)

	var voriger := 0.0
	for i in anzahl:
		var t := float(i) / ABTASTRATE
		var anteil := t / dauer
		var roh := randf_range(-1.0, 1.0)
		var gefiltert := lerpf(roh, voriger, daempfung)
		voriger = gefiltert

		var huelle := minf(1.0, t / ANSTIEG) * exp(-6.0 * anteil)
		puffer.encode_s16(i * 2, int(clampf(gefiltert * huelle * lautstaerke, -1.0, 1.0) * 32767.0))

	return puffer


## Mehrere `_sweep`-Schritte hintereinander — der Baustein für kurze Ton-
## folgen (Welle geschafft, Aufwertung, Game Over). Jedes Element ist ein
## Dictionary mit `von`/`bis`/`dauer`/`lautstaerke`, optional `rechteck`.
func _folge(schritte: Array) -> PackedByteArray:
	var gesamt := PackedByteArray()
	for schritt in schritte:
		gesamt.append_array(_sweep(
			schritt["von"], schritt["bis"], schritt["dauer"], schritt["lautstaerke"],
			schritt.get("rechteck", false),
		))
	return gesamt


## Addiert zwei Puffer sample-genau übereinander (kürzerer wird mit Stille
## aufgefüllt) — der Baustein für „Rauschen plus Ton gleichzeitig" beim
## Gegner-Tod. `clampi` verhindert ein Überlaufen, falls beide Quellen an
## derselben Stelle laut sind.
func _mischen(a: PackedByteArray, b: PackedByteArray) -> PackedByteArray:
	var laenge := maxi(a.size(), b.size())
	var ergebnis := PackedByteArray()
	ergebnis.resize(laenge + (laenge % 2))

	var i := 0
	while i < ergebnis.size():
		var wa := a.decode_s16(i) if i + 1 < a.size() else 0
		var wb := b.decode_s16(i) if i + 1 < b.size() else 0
		ergebnis.encode_s16(i, clampi(wa + wb, -32768, 32767))
		i += 2

	return ergebnis
