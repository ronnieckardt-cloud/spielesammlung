# Spielesammlung — Hinweise für Claude

Eine Sammlung kleiner Browserspiele als PWA. Wächst schrittweise: neue Spiele
kommen dazu, ohne dass an den bestehenden etwas kaputtgeht.

## Technik

Vite + React + TypeScript + Tailwind. **Kein Spiel-Framework, kein Backend,
keine externen Assets.** DOM und CSS für rastermäßige Spiele, Canvas 2D für
Spiele mit fortlaufender Bewegung.

Läuft offline, installierbar, bedienbar mit Touch und Tastatur. Später auf
einem eigenen Server hinter Caddy, optional mit Supabase für
geräteübergreifende Bestenlisten — **nichts einbauen, was das verbaut, aber
jetzt noch nicht umsetzen.**

**Keine Bibliothek dazunehmen, ohne vorher zu fragen.** Bisher bewusst
aufgenommen: React, Tailwind, Vitest.

**Vor jedem Deploy: `SPEICHER` in `public/sw.js` um eins hochzählen.** Der
Offline-Speicher liefert sonst auf installierten PWAs (vor allem iOS) weiter
die alte Fassung aus, selbst wenn die neue längst auf Netlify liegt — die
Versionsnummer ist der einzige Auslöser, der den Speicher wirklich leert.
Genau das ist einmal passiert (mehrere Deploys ohne Versionssprung, Florians
iPad zeigte tagelang die alte Fassung).

Selbst mit hochgezählter Version kam ein Update auf iOS-Geräten (iPad,
iPhone) trotzdem nicht zuverlässig an — ein einfaches Neuladen half nicht
immer, manuelles Löschen der Website-Daten war der einzige verlässliche Weg.
Deshalb lädt sich die Seite jetzt **selbst** neu, sobald ein neuer Service
Worker übernimmt (`main.tsx`: `controllerchange`-Listener +
`registration.update()` bei jedem Laden und beim Zurückkommen aus dem
Hintergrund) — kein manuelles Eingreifen mehr nötig. Der Schutz
`hatteSchonEinenWorker` verhindert einen unnötigen Neustart beim allerersten
Besuch (da gibt es ja noch nichts Altes zu ersetzen).

## Die Schnittstelle

Der wichtigste Punkt im ganzen Projekt. Ein Spiel liegt in
`src/games/<name>/` und ist von außen **nur** hierüber sichtbar
(`src/core/types.ts`):

```ts
type GameApi = {
  id: string;      // stabil — Bestenlisten hängen daran, title darf sich ändern
  title: string;
  accent: string;  // Farbe der Kachel
  Icon: React.FC<{ className?: string }>;  // eigenes SVG, kein Emoji
  Component: React.FC<GameProps>;
};

type GameProps = {
  onScore: (score: number) => void;               // laufender Punktestand
  onGameOver: (score: number, gewonnen?: boolean) => void;  // genau einmal pro Runde
  onExit: () => void;
  settings: { sound: boolean; reducedMotion: boolean };
  bestScore: number;  // bisherige Bestleistung, schreibgeschützt, 0 = noch nie gespielt
};
```

`gewonnen` ist optional — nur Spiele mit einer echten Sieg-Bedingung (nicht
nur "Leben aufgebraucht", siehe Geisterjagd) geben es mit. Die Hülle zeigt
dann „🎉 Gewonnen!" statt „Vorbei" im Rundenende-Bildschirm.

`bestScore` kommt aus `Spielrahmen.tsx` (`bestwert(spiel.id)`, frisch bei
jedem Rendern gelesen) — kein Zugriff aufs Storage selbst, nur diese eine
Zahl. Gedacht für einen eigenen Startbildschirm wie bei Block Burst
(„Beste Punktzahl: X" anzeigen, ohne die Bestenliste-Regel zu brechen).

**Ein Spiel darf nie direkt auf Bestenliste, Router oder Browser-Speicher
zugreifen — immer nur über diese Props.** Konkret heißt das: in
`src/games/**` kein `localStorage`, kein `window.location`, kein Import aus
`src/shell/`. Erlaubt sind Importe aus `src/core/`.

Ein neues Spiel wird an genau einer Stelle bekannt gemacht:
`src/core/registry.ts`.

## Gemeinsame Bausteine (`src/core/`)

| Baustein | Wozu |
|---|---|
| `useGameLoop(update, { fps, running })` | Fester Zeitschritt über `requestAnimationFrame`. Pausiert selbsttätig bei `visibilitychange` und holt lange Pausen **nicht** auf. Der Rechenkern `takt()` ist rein und getestet. |
| `useInput(beiAktion, optionen)` | Tastatur, Wischen und Antippen vereinheitlicht zu `up/down/left/right/rotate/drop/select`, mit eigener Tastenwiederholung (Verzögerung, dann schnelle Folge). |
| `rng(saat)` / `schritt(saat)` / `saatAus(...)` | Zufall aus einer Startzahl. `rng` für laufende Nutzung, `schritt` für reine Logik, die ihre Saat selbst mitführt. **Nie `Math.random`** — sonst ergibt dieselbe Levelnummer nicht dasselbe Rätsel. |
| `sfx(name)` | Kurze Töne über die Web Audio API, keine Dateien. Ob Ton erlaubt ist, meldet die Hülle über `sfxEinstellen`. |
| `<Steuerkreuz onRichtung aktiv>` | Vier Tasten zum Antippen (oben/unten/links/rechts), mit Wiederholung bei Halten — Ergänzung zum Wischen, nicht Ersatz. Auf Handys ist eine Taste oft zuverlässiger als eine Wischgeste. |

Änderungen an diesen Bausteinen betreffen alle Spiele — **vorher fragen.**

## Die Hülle (`src/shell/`)

Kachelmenü, Kopfzeile mit Punktestand und Zurück-Knopf, Einstellungen,
Bestenliste je Spiel, Dunkelmodus als Standard. `speicher.ts` ist der einzige
Ort im Projekt, der `localStorage` anfassen darf.

Welche Ansicht dran ist, steht in der Adresszeile (`#/spiel/<id>`), damit der
Zurück-Knopf von Browser und Handy funktioniert. Nur `App.tsx` liest und
schreibt das.

## Wie Code hier aussehen soll

- **Spiellogik in reinen Funktionen ohne React** (`logik.ts`), damit sie
  testbar ist. Die React-Komponente zeigt nur an und leitet Eingaben weiter.
- Tests für die kniffligen Teile: Lösbarkeitsprüfung, „passt noch was?",
  Wall Kicks, Zielberechnung der Geister.
- Deutsche Namen im Code, außer wo die Schnittstelle englisch ist
  (`onScore`, `settings` …).
- Kommentare erklären das Warum, nicht das Was.
- Barrierefreiheit als Grundniveau: sichtbarer Tastaturfokus, `reducedMotion`
  beachten, Farbe nie als einziges Unterscheidungsmerkmal.

## Namen und Optik

Die Spielprinzipien sind frei, Namen und Optik der Vorbilder nicht.
Durchgehend eigene Namen verwenden — auf Ronnis Wunsch inzwischen coole,
kurze englische Titel statt der ursprünglichen deutschen Arbeitsnamen (siehe
Tabelle unten) — und sich optisch **nicht** an die Originale anlehnen — keine
gelbe Kreisfigur, keine originalen Steinfarben.

| Interne id (`registry.ts`, Bestenliste) | Angezeigter Titel |
|---|---|
| `platzhalter` | Star Dash |
| `farbsortierer` | Color Pour |
| `blockblitz` | Block Burst |
| `reihenfall` | Line Fall |
| `geisterjagd` | Ghost Chase |
| `quiz` | Quiz Time |
| `gehirnjogging` | Gehirnjogging (Name bewusst unverändert) |
| `wortspiel` | Word Play |

Die `id` bleibt immer die alte, deutsche — daran hängt die Bestenliste in
`localStorage`. Nur `title` ändert sich, sonst nichts.

Kachel-Symbole sind eigene, kleine SVG-Icons (`games/<name>/Icon.tsx`), keine
Emojis, 24×24 Viewbox. Bewusst **nicht** einfarbig (erste Fassung war reines
`stroke="currentColor"` — Rückmeldung: sieht altbacken/zu einfach aus) —
jetzt gefüllte Formen mit zwei bis drei festen Hex-Farben je Icon, wie eine
kleine Mini-Illustration der eigentlichen Spielszene (z. B. Color Pour zeigt
ein Glas mit echten Farbschichten, Block Burst bunte Einzelblöcke). Das
Kachelmenü selbst zeigt Icon **und** Name (Name als kleine Beschriftung unter
der Kachel, kein Beschreibungstext mehr) — nach kurzem Test ganz ohne Namen
war die Rückmeldung, dass man dann nicht erkennt, was ein Symbol bedeutet.
Bestwert steht weiterhin nur im `aria-label` für Screenreader, nicht sichtbar.

Kachel-Hintergrund ist ein Farbverlauf aus der Akzentfarbe (heller/dunkler
über `color-mix()`, kein zweites Hex pro Spiel nötig), dazu ein farbiger
Schlagschatten — sonst wirkte die Startseite zu flach/grau. Ein wandernder
Lichtschimmer war testweise drin, wurde aber wieder entfernt (Rückmeldung:
lenkt ab, wenn er ständig hintereinander über die Kacheln läuft).

Kachelmenü ist bewusst `flex flex-wrap` mit **fester** Kachelgröße
(`size-16`), keine responsive Grid-Spaltenzahl mehr — Rückmeldung: Kacheln
wirkten auf breiteren Bildschirmen zu groß, sollen wie normale App-Symbole
aussehen, nicht wie Kacheln, die die volle Breite ausfüllen. Der Name steht
in einer eigenen, etwas breiteren Box (`w-20`) und darf bei Bedarf
zweizeilig umbrechen (`leading-tight`, kein `truncate`) — sonst wurden
längere Namen wie „Gehirnjogging" oder „Ghost Chase" abgeschnitten.

Ausnahme auf ausdrücklichen Wunsch: Die Spielfigur in Sternenfang
(`games/platzhalter/Platzhalter.tsx`, Komponente `KatzenGesicht`) ist
bewusst eine gelbe Kreisfigur mit angedeutetem Mund — durch Katzenohren
bleibt sie als Katze lesbar. Für Geisterjagd (Schritt 5) gilt die Regel
oben weiterhin uneingeschränkt: eigene Optik, keine Anlehnung.

## Reihenfolge

Ursprünglich: ein Punkt nach dem anderen, erst nach Ronnis Okay weiter. Seit
Schritt 3 hat Ronni das gelockert — Blockblitz und Reihenfall dürfen
hintereinander gebaut werden, ohne auf Rückmeldung zu warten. Trotzdem nach
jedem Spiel gründlich selbst testen (Tests, Typprüfung, Browser-Check) und
kurz zusammenfassen, was fertig ist.

1. ✅ Hülle, gemeinsame Bausteine, Platzhalter-Spiel („Sternenfang")
2. ✅ Farbsortierer — von Grund auf neu gebaut (Ronnis vorhandene Fassung ist
   nie in der Session angekommen)
3. ✅ Blockblitz
4. ✅ Reihenfall
5. ✅ Geisterjagd

Danach zusätzlich geplant:

6. ✅ Quiz (Wissensquiz) — ca. 100 Multiple-Choice-Fragen, Zielgruppe
   10- bis 12-Jährige, allgemeine Wissenserweiterung.
7. ✅ Gehirnjogging — drei Varianten im Wechsel: Kopfrechnen, Merk-Folgen
   (Farbfolge nachtippen), Muster erkennen. Level (und mehr) aus der
   Levelnummer erzeugt wie beim Farbsortierer, Variante reihum per
   Levelnummer, Schwierigkeit steigt mit dem Level.
8. ✅ Wortspiel — Fokus Rechtschreibung: von vier Schreibweisen die richtige
   erkennen, Fehlschreibungen zeigen typische deutsche Rechtschreibfallen
   (ß/ss, ie/i, Doppelkonsonanten, Dehnungs-h, Fremdwörter). Level = Runde
   wie beim Quiz, Schwierigkeit steigt mit dem Level (welcher Teil des
   Wortpools erlaubt ist).
9. Anmeldung mit Namen + Passwort, geräteübergreifende Bestenliste, wer ist
   der/die Beste. Braucht Supabase (bringt fertige Anmeldung mit) — war von
   Anfang an als "später" vorgesehen, jetzt konkret gewünscht. Das ist ein
   Eingriff in die Hülle (`shell/`), nicht in ein einzelnes Spiel: erst
   angehen, wenn die Spiele durch sind, dann mit Ronni gemeinsam planen
   (welche Daten genau, wie Kinder-tauglich das Passwort sein muss).

## Farbsortierer — Besonderheiten

Ein Level ist eine Runde: gelöst → sofort `onGameOver` mit einem Punktestand
nach Zügen (weniger Züge = mehr Punkte), landet in der Bestenliste — passend
zur Idee „gleiche Levelnummer, gleiches Rätsel, vergleichbar". „Nochmal"
versucht deshalb genau dasselbe Level erneut.

- `logik.ts`: Lösbarkeits-Suchlauf ist eine echte Breitensuche (nicht nur
  „garantiert lösbar durch Konstruktion") — genau wie gefordert. Deckel bei
  5 Farben (`MAX_FARBEN`), weil 6 Farben im Test bis zu 10 Versuche à
  mehrere Sekunden brauchten, bevor ein lösbares Brett gefunden war.
- `geometrie.ts`: Röhrchen-Raster und der komplette Bewegungsablauf beim
  Gießen (anheben/hinfliegen/kippen/gießen/aufrichten/zurückstellen) sind
  reine, getestete Funktionen — die Ausgusskante wird per Drehmatrix aus dem
  aktuellen Kippwinkel berechnet, nicht geschätzt.
- Farben kommen aus `farbpaletteFuerLevel(level, anzahl)` — eine aus der
  Levelnummer gemischte Auswahl, damit nicht immer dieselben ersten Farben
  drankommen. Jede Farbe hat eine stabile `id` für Verlaufs-Zuordnung.
- Anzeige merged aufeinanderfolgende gleichfarbige Schichten zu einem
  einzigen Block (`Roehrchen.tsx`) — sonst sieht jede Schichtgrenze wie ein
  Neuanfang aus, auch bei zwei gleichen Farben übereinander.
- Bewusst kein Muster mehr auf den Farbschichten (war testweise drin,
  Rückmeldung: sieht unruhig aus). Nicht-visuelle Unterscheidung läuft über
  die Farbnamen im `aria-label` jedes Röhrchens.
- Die Gieß-Animation läuft immer mit fester Dauer (`GIESS_DAUER_MS`), kein
  Tempo-Knopf mehr. Der frühere Knopf war lokaler `useState`, der bei jeder
  neuen Runde (Komponente wird komplett neu gemountet) auf
  `settings.reducedMotion` zurückgesetzt wurde — auf Geräten, bei denen die
  Systemeinstellung „weniger Bewegung" an ist, stand er dadurch nach jedem
  Level wieder auf „aus" und musste manuell zurückgestellt werden. Jetzt
  läuft die Animation immer, ohne Rücksicht auf diese Einstellung.
- Eigener Startbildschirm (`Startbildschirm` in `Farbsortierer.tsx`,
  gleiche `gestartet`-Vorlage wie Blockblitz): heller Verlauf
  Türkis→Blau→Lila→Pink statt dunklem Hintergrund, schwebende Farbtropfen
  (`DEKO_TROPFEN`), angelehnt an die Optik typischer
  Wassersortier-Puzzles im App Store — eigene Gestaltung, kein Nachbau
  eines bestimmten Spiels.

## Blockblitz — Besonderheiten

- `logik.ts`: 27 Formen (Größe 1 bis 9), alle Drehlagen von L/T/S/Z einzeln
  im Satz, weil im Spiel nicht gedreht wird. Teileziehung ist nach
  Füllstand gewichtet (`gewichtFuerGroesse`) — bei vollerem Feld werden
  kleine Teile wahrscheinlicher, große nie unmöglich.
- Ziehen läuft über rohe Pointer-Events (nicht über `useInput`, das passt
  hier nicht — es geht um „welches von N Teilen an welche von 64 Stellen",
  nicht um vier Richtungen). `platzieren()` liest den Zustand über eine Ref
  statt über sich ständig ändernde Closures, sonst hängt sich der
  Zieh-Effekt nach jedem Zug neu auf.
- Tempo/Position des fliegenden Teils: `zug.y - VERSATZ_Y` hebt es über den
  Finger, `ankerZentriertAuf()` (`geometrie.ts`) zentriert es aufs Ziel.
- Tablett-Kästen sind `size-24` (96px), nicht `size-20` — bei 16px
  Zellgröße plus Zwischenraum braucht das größte Teil (5er-Linie) 88px,
  das passte im alten, kleineren Kasten nicht sauber rein.
- Das fliegende Teil beim Ziehen (`TeilAnzeige` mit `zellgroesse`) benutzt
  jetzt dieselbe gemessene Zellgröße wie das Raster (`rasterZellgroesse`,
  über `getBoundingClientRect()`), nicht mehr eine feste `zellgroesse={24}`
  — vorher wirkte das gezogene Teil kleiner als es später auf dem Feld
  tatsächlich ist.
- Auflösen einer Reihe/Spalte: `blitzZellen` ist eine `Map<Zellenschlüssel,
  Zeitversatz>`, nicht mehr nur ein `Set` — jede Zelle zerbröselt mit
  eigenem, diagonal gestaffeltem Zeitversatz (`(x + y) * ZERBROESELN_VERSATZ_MS`),
  über die CSS-Variable `--verzoegerung` an `animation-delay` gereicht
  (`index.css`). Bei „weniger Bewegung" ist der Versatz 0 — die
  `.ruhig`-Regel kollabiert nur `animation-duration`, nicht `-delay`, das
  muss also selbst auf 0 gesetzt werden.
- Kurzes „+N"-Punkte-Popup (`punkte-auftauchen` in `index.css`) erscheint
  genau beim Auflösen, über dem Spielfeld zentriert — Punkte gab es vorher
  auch schon (`punkteFuerZug`), aber ohne direkte Rückmeldung am Ort des
  Geschehens wirkte es unsichtbar.
- Punktestand steht jetzt groß und hell über dem Feld (`text-6xl`,
  `key={z.punkte}` + `.punkte-bumsen` in `index.css` für einen kurzen Puls
  bei jeder Änderung) statt nur klein in der Kopfzeile der Hülle — die
  Kopfzeile selbst bleibt unverändert (gemeinsamer Baustein, gilt für alle
  Spiele gleich), das ist eine zusätzliche, eigene Anzeige nur in diesem Spiel.
- Tablett-Teile schweben ohne Kasten (kein `border`/`bg-*` mehr am
  Tablett-Button) — beim Anheben nur ein `drop-shadow` und ein leichtes
  Anheben (`-translate-y-1.5`) als Rückmeldung, kein Kasten-Hintergrund.
- Zerbröseln straffer getaktet als in der ersten Fassung (`ZERBROESELN_VERSATZ_MS`
  55 statt 28, Einzeldauer 260ms statt 420ms) — wirkt jetzt wie ein
  schnelles Hintereinander-Wegkrattern statt eines langsamen gemeinsamen
  Aufblitzens. Dazu ein paar gestaffelte, kurze „Kratz"-Klicks
  (`sfx('klick')`), einer je Zeitstufe, nicht je Zelle — sonst wird es bei
  großen Auflösungen zu viel.
- Eigener Startbildschirm vor der ersten Runde (`Startbildschirm` in
  `Blockblitz.tsx`, `gestartet`-State, gleich nach allen Hooks per
  `if (!gestartet) return <Startbildschirm .../>` — Hooks müssen trotzdem
  immer laufen, deshalb kein früherer Ausstieg). Erste Fassung sah aus wie
  eine vergrößerte Menü-Kachel und wurde als „sieht genau gleich aus"
  zurückgewiesen — jetzt ein eigenständiger, kräftig-bunter Farbverlauf
  (nicht der dunkle App-Hintergrund, explizit so gewünscht: „ich will nicht,
  dass es alles mit 'nem schwarzen Hintergrund ist"), schwebende
  Deko-Blöcke (`DEKO_BLOECKE`, feste Liste, `.block-schweben` in
  `index.css`), dickere Schrift mit Schlagschatten, glänzend-pulsierender
  „Spielen"-Knopf (`.startknopf-puls`). `bestScore` kommt aus den Props
  (kein direkter Storage-Zugriff). Bei einem neuen Startbildschirm für ein
  anderes Spiel diesen Aufbau als Vorlage nehmen (siehe Farbsortierer,
  Reihenfall, Quiz — schon so gemacht) — angelehnt an die grobe Stimmung
  bekannter Spiele im selben Genre (verlangt: „so ähnlich, nicht
  hundertprozentig"), nie an deren konkretes Logo/Branding.
- Zieh-Vorschau für eine volle Reihe/Spalte blinkt jetzt deutlich
  (`.vorschau-linie-puls` in `index.css`, ersetzt den vorherigen statischen
  weißen Rand) — Wunsch war „dass man sich das besser merkt". Läuft über
  dieselbe globale `.ruhig`-Kollabierung wie alle anderen Animationen, ohne
  Sonderfall: anders als beim Zerbröseln gibt es hier kein
  `--verzoegerung`, das separat auf 0 gesetzt werden müsste.

## Reihenfall — Besonderheiten

- `logik.ts`: Formen und Wandtritte im SRS-Stil (Standard-Drehsystem), von
  Hand aus der y-nach-oben-Konvention auf dieses Projekts y-nach-unten
  übertragen — beim Ändern vorsichtig sein, ein Vorzeichenfehler bei den
  Kicks fällt im Spiel kaum auf, nur beim genauen Hinsehen.
- Lock Delay: `sperrZeitRest` läuft nur, während der Stein aufliegt; jede
  erfolgreiche Bewegung/Drehung im Aufliegen setzt sie zurück, aber nur
  `MAX_SPERR_VERLAENGERUNGEN`-mal (`verlaengereWennAmBoden`) — danach läuft
  die Zeit ungebremst ab, damit man nicht endlos schweben kann.
- 7-Bag über zwei Ebenen: `beutel` (Rest des aktuellen Beutels) und
  `warteschlange` (die tatsächlich gezeigten nächsten Teile, immer
  mindestens `VORSCHAU_ANZAHL + 1` lang). Sauber trennen, sonst stimmt die
  „jede Sorte einmal pro sieben"-Garantie nicht mehr mit der Vorschau überein.
- Steuerung bewusst über `useInput` (Wischen + Tastatur decken sechs der
  sieben Aktionen ab) plus einen eigenen, schmalen Zusatz-Listener für die
  Taste C (Halten) — dafür reichte in `useInput`s sieben Aktionen kein
  Platz mehr. `Steuerkreuz` wurde absichtlich **nicht** erweitert, siehe
  Kommentar dort.
- Farben bewusst anders zugeordnet als beim Original (`farben.ts`) — jedes
  der sieben Teile hat eine andere Farbe als in der klassischen Zuordnung.
- Eigener Startbildschirm (`Startbildschirm` in `Reihenfall.tsx`, gleiche
  `gestartet`-Vorlage wie Blockblitz): dunkles, aber bewusst nicht
  schwarzes Indigo/Violett mit feinem Neon-Raster
  (`repeating-linear-gradient`) und schwebenden Blöcken in klassischen
  Tetromino-Farben (`DEKO_BLOECKE`) — angelehnt an die Stimmung von Tetris,
  ohne dessen Logo/Branding nachzubauen.

## Geisterjagd — Besonderheiten

- `labyrinth.ts`: Das Labyrinth ist ein reines Textraster (`ROHES_LABYRINTH`)
  — hier ändern, wenn ein anderes Layout gewünscht ist. Alle Zeilen müssen
  gleich lang sein, genau eine Zeile hat an beiden Rändern kein `#` (der
  Tunnel), genau ein `P` und genau vier `G`. Ein Flood-Fill-Test
  (`labyrinth.test.ts`) prüft nach jeder Änderung, dass wirklich jedes
  begehbare Feld erreichbar ist — Tippfehler im Raster fliegen damit sofort
  auf, nicht erst beim Spielen.
- Bewegung ist kachelweise wie bei Sternenfang, nicht in Pixeln.
  „Richtungswechsel nur an Kreuzungen" ergibt sich von selbst, weil jede
  Position ohnehin eine ganze Kachel ist — es gibt kein Zwischen-Kachel.
- Vier eigene Zielberechnungen (`jagdZiel` in `logik.ts`), alle einzeln
  getestet: Geist 0 verfolgt direkt, Geist 1 zielt vier Felder vor den
  Spieler, Geist 2 spiegelt Geist 0 durch einen Punkt vor dem Spieler
  (klassische „Inky"-Formel), Geist 3 verfolgt nur aus der Ferne und zieht
  sich aus der Nähe zurück. Kein Geist kehrt an Kreuzungen um, außer in
  einer echten Sackgasse (`geistRichtungWaehlen`).
- Streuen/Jagen nach eigener Zeittabelle (`MODUS_ZEITTABELLE`), nicht die
  Original-Werte. Beim Wechsel kehren nicht-ängstliche, nicht-heimkehrende
  Geister sofort um — klassisches, absichtlich beibehaltenes Verhalten.
- Auf ausdrücklichen Wunsch trotzdem **keine** Pac-Man-Optik: eigene
  Spielfigur (Pfeil/Chevron, dreht sich in Laufrichtung, `figuren.tsx`),
  eigene Geister-Silhouette und -Farben (`farben.ts`).
- Steuerung über `useInput` (Wischen + Tastatur) **und** den gemeinsamen
  `Steuerkreuz`-Baustein — hier passt er, weil es wirklich nur die vier
  Richtungen braucht.
- Das Labyrinth hat gegenüber der ersten Fassung zusätzliche, kleine
  Wandsegmente in den vormals komplett offenen Bereichen (mehr Abzweigungen,
  weniger "nur kreuzweise laufen") — Layout an sich unverändert (gleiche
  Größe, gleiche Positionen für Spieler, Geister, Kraftpillen), nur ergänzt.
  Jede Ergänzung wurde einzeln gegen den Flood-Fill-Test geprüft.
- Kraftpillen werden als kleine Sterne gezeichnet (SVG-Pfad statt Kreis,
  `PILLE_FARBE` bleibt als Variablenname), sonst identische Mechanik.
- Neue Sieg-Bedingung: Sind nach einem Biss alle vier Geister gleichzeitig
  im Augen-Modus (gerade gefressen, auf dem Heimweg — auch wenn sie über
  mehrere Kraftpillen verteilt dorthin kamen), ist die Runde sofort mit
  `gewonnen: true` vorbei, plus 1000 Bonuspunkte
  (`PUNKTE_ALLE_GEISTER_BONUS`). Absichtlich unabhängig davon, wie viele
  Punkte noch im Labyrinth liegen. Die Hülle zeigt dafür „🎉 Gewonnen!"
  statt „Vorbei" — dafür wurde `GameProps.onGameOver` um ein optionales
  zweites Argument erweitert (siehe „Die Schnittstelle" oben).

## Wissensquiz — Besonderheiten

- `fragen.ts`: reine Daten (ca. 100 Fragen, vier Antworten je Frage), nichts
  Logisches drin — neue Fragen einfach ergänzen. Ein eigener Test prüft nur
  die Struktur (vier nicht-leere Antworten, gültiger Richtig-Index, keine
  Dopplung) — Faktentreue kann kein Test prüfen, das bleibt beim
  sorgfältigen Schreiben.
- Level = Runde, genau wie beim Farbsortierer: aus der Levelnummer werden
  zehn Fragen gemischt gezogen (`neuesLevel` in `logik.ts`), gleiche
  Levelnummer ergibt für alle dieselben zehn Fragen. „Nochmal" nach einer
  Runde startet automatisch das nächste Level; Pfeile im Kopf springen
  gezielt zu einer bestimmten Levelnummer.
- Nach jeder Antwort sofortige Rückmeldung (richtig grün, falsch rot, die
  tatsächlich richtige Antwort wird immer angezeigt) — man lernt auch aus
  falschen Antworten, nicht erst am Rundenende.
- Jede Frage trägt zusätzlich ein `erklaerung`-Feld: ein kurzer
  Wissens-Hinweis ("💡 …"), der unterhalb der Antworten erscheint, sobald
  beantwortet wurde — unabhängig davon, ob richtig oder falsch geklickt
  wurde. So bleibt auch bei einer falschen Antwort ein Lerneffekt. Ein Test
  prüft nur, dass jede Frage eine nicht-leere Erklärung hat.
- Eigener Startbildschirm (`Startbildschirm` in `Quiz.tsx`, gleiche
  `gestartet`-Vorlage wie Blockblitz): kräftiger Blau-Lila-Verlauf mit
  schwebenden geometrischen Formen (Kreis, Quadrat, Dreieck per
  `clip-path`, `DEKO_FORMEN`) — angelehnt an die Optik typischer
  Quiz-Apps im App Store.

## Gehirnjogging — Besonderheiten

- Drei eigenständige, reine Aufgaben-Generatoren (`kopfrechnen.ts`,
  `merkfolgen.ts`, `muster.ts`), jeweils `aufgabe(saat, level)` — gleiche
  Saat und Level ergeben immer dieselbe Aufgabe. `logik.ts` orchestriert nur:
  welche Variante ein Level bekommt (`varianteFuerLevel`, reihum über die
  Levelnummer), Level = Runde mit `AUFGABEN_PRO_LEVEL` Aufgaben derselben
  Variante, generische `aufgabeAbschliessen`/`naechsteAufgabe` für alle drei
  Varianten (genau wie `antwortWaehlen`/`naechsteFrage` beim Quiz).
- Schwierigkeit steigt mit dem Level, nicht mit der Zeit: Kopfrechnen und
  Muster erkennen haben sechs Stufen (`stufeFuerLevel`, alle 15 Level eine
  Stufe höher, gedeckelt), Merk-Folgen verlängert die Folge alle 10 Level um
  eins (gedeckelt bei 9 — mehr sprengt die menschliche Merkspanne).
  Kopfrechnen-Ergebnisse werden nie negativ (auch nicht bei den
  zweischrittigen Aufgaben ab Stufe 5), das ist Absicht, nicht Zufall.
- Kopfrechnen und Muster erkennen teilen sich dieselbe
  Vier-Zahlen-Antworten-Anzeige (`ZahlAntworten.tsx`) — beide haben exakt
  dasselbe Antwortformat (`antworten`/`richtig`), nur der Aufgabentext
  darüber unterscheidet sich.
- Merk-Folgen führt seinen eigenen Zustand (Vorführ-Phase, Eingabe-Phase,
  bisherige Tipps) lokal in `MerkfolgenAnzeige.tsx`, nicht im Runden-Zustand
  — die Runden-Logik bekommt nur das fertige Ergebnis über `onFertig`.
  Reine Prüf-Funktion `merkfolgeTippen` kennt weder Zeit noch UI. Sechs
  eigene Kachel-Farben in einem 3×2-Raster, bewusst nicht die klassische
  Vierteil-Scheibe. Nach jeder Aufgabe wird die richtige Folge als kleine
  Punktereihe gezeigt, auch bei einer falschen Antwort.
- `Gehirnjogging.tsx` hält die aktuell angeklickte Zahl (`ausgewaehlt`) für
  Kopfrechnen/Muster separat vom generischen `Zustand.ergebnis`, weil
  Merk-Folgen das gar nicht braucht. Beim Levelwechsel bleibt der Index
  manchmal bei 0 (z. B. sofort das nächste Level anwählen) — deshalb hängt
  das Zurücksetzen von `ausgewaehlt` an `[z.index, z.level]`, nicht nur am
  Index, und `MerkfolgenAnzeige` bekommt `key={`${z.level}-${z.index}`}`,
  damit sie in genau diesem Fall wirklich neu mountet.

## Wortspiel — Besonderheiten

- `woerter.ts`: reine Daten (ca. 90 Wörter), nichts Logisches drin — Aufbau
  bewusst wie `fragen.ts` beim Quiz: vier Antworten, `richtig` als fester
  Index (nicht zur Laufzeit gemischt). Jedes Wort hat zusätzlich eine
  `stufe` (1-3) und eine `regel` — eine kurze Erklärung, die nach der
  Antwort immer erscheint, richtig oder falsch geklickt. Ein Test prüft nur
  Struktur (vier eindeutige Antworten, gültiger Index, keine doppelt
  vorkommende richtige Schreibweise im ganzen Pool) — Rechtschreibung
  selbst kann kein Test prüfen, das bleibt beim sorgfältigen Schreiben.
- Anders als beim Quiz steigt die Schwierigkeit mit dem Level: bis Level 20
  nur Stufe 1 (kurze, häufige Wörter), bis Level 50 zusätzlich Stufe 2
  (Umlaute, Doppelkonsonanten, Dehnungs-h), danach auch Stufe 3 (lange
  Wörter, Fremdwörter, Fugenlaute) — `maxStufeFuerLevel` in `logik.ts`.
  `neuesLevel` filtert den Pool auf die erlaubte Stufe, bevor gemischt wird.
- Die Fehlschreibungen sind von Hand gebaut, keine zufällig erzeugten
  Buchstabendreher — jede zeigt eine echte, typische deutsche
  Rechtschreibfalle (ß/ss, ie/i, Doppelkonsonanten, Dehnungs-h, v/f,
  Fremdwort-Schreibung). Zufällige Vertauschungen hätten oft unsinnige,
  offensichtlich falsche Wörter ergeben statt lehrreicher Fehler.

## Befehle

```bash
npm run dev     # Entwicklungsserver auf http://localhost:5180
npm test        # Tests einmal durchlaufen
npm run build   # Typprüfung und fertige Fassung nach dist/
node werkzeuge/icons-erzeugen.mjs   # App-Symbole neu erzeugen
```
