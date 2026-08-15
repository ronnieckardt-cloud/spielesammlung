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

## Die Schnittstelle

Der wichtigste Punkt im ganzen Projekt. Ein Spiel liegt in
`src/games/<name>/` und ist von außen **nur** hierüber sichtbar
(`src/core/types.ts`):

```ts
type GameApi = {
  id: string;
  title: string;
  blurb: string;   // ein Satz fürs Kachelmenü
  accent: string;  // Farbe der Kachel
  symbol: string;  // Zeichen der Kachel — Farbe ist nie das einzige Merkmal
  Component: React.FC<GameProps>;
};

type GameProps = {
  onScore: (score: number) => void;     // laufender Punktestand
  onGameOver: (score: number) => void;  // genau einmal pro Runde
  onExit: () => void;
  settings: { sound: boolean; reducedMotion: boolean };
};
```

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
Durchgehend eigene Namen verwenden (Farbsortierer, Blockblitz, Reihenfall,
Geisterjagd) und sich optisch **nicht** an die Originale anlehnen — keine
gelbe Kreisfigur, keine originalen Steinfarben.

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
7. ⬜ Gehirnjogging — **mehrere Varianten im Wechsel: Kopfrechnen,
   Merk-Folgen (Farbfolge nachtippen), Muster erkennen. 90 Level (und
   mehr), aus der Levelnummer erzeugt wie beim Farbsortierer** — welche
   der drei Varianten ein Level bekommt, per festem Rhythmus über die
   Levelnummer (z. B. reihum), Schwierigkeit steigt mit dem Level.
8. ⬜ Wortspiel — Konzept noch offen
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

## Befehle

```bash
npm run dev     # Entwicklungsserver auf http://localhost:5180
npm test        # Tests einmal durchlaufen
npm run build   # Typprüfung und fertige Fassung nach dist/
node werkzeuge/icons-erzeugen.mjs   # App-Symbole neu erzeugen
```
