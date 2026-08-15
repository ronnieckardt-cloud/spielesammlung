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
  iconVollflaechig?: boolean;  // true = fertiges App-Symbol, füllt die Kachel selbst
  Component: React.FC<GameProps>;
};

type GameProps = {
  onScore: (score: number) => void;               // laufender Punktestand
  onGameOver: (score: number, gewonnen?: boolean) => void;  // genau einmal pro Runde
  onExit: () => void;
  settings: { sound: boolean; reducedMotion: boolean };
  bestScore: number;  // bisherige Bestleistung, schreibgeschützt, 0 = noch nie gespielt
  istErsteRunde: boolean;  // false nach „Nochmal" — Startbildschirm dann überspringen
};
```

`gewonnen` ist optional — nur Spiele mit einer echten Sieg-Bedingung (nicht
nur "Leben aufgebraucht", siehe Geisterjagd) geben es mit. Die Hülle zeigt
dann „🎉 Gewonnen!" statt „Vorbei" im Rundenende-Bildschirm.

`bestScore` kommt aus `Spielrahmen.tsx` (`bestwert(spiel.id)`, frisch bei
jedem Rendern gelesen) — kein Zugriff aufs Storage selbst, nur diese eine
Zahl. Gedacht für einen eigenen Startbildschirm wie bei Block Burst
(„Beste Punktzahl: X" anzeigen, ohne die Bestenliste-Regel zu brechen).

`istErsteRunde` ist `runde === 0` aus `Spielrahmen.tsx`. „Nochmal" mountet
das Spiel per `key={runde}` komplett neu (frischer Zustand, gewollt) — ohne
diese Zusatzinfo kann ein Spiel nicht unterscheiden, ob es gerade betreten
oder nur neu gestartet wurde, und zeigt dann nach jeder Runde wieder seinen
Startbildschirm. Spiele mit Startbildschirm machen deshalb
`useState(!istErsteRunde)`. Zurück ins Menü und erneut hinein setzt `runde`
zurück auf 0, der Startbildschirm kommt also wie gewünscht wieder.

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
| `gehirnjogging` | Brain Blitz |
| `wortspiel` | Word Play |
| `schlange` | Snake Rush |
| `mergeup` | Merge Up |
| `bubblepop` | Bubble Pop |
| `paare` | Pair Up |

Die `id` bleibt immer die alte, deutsche — daran hängt die Bestenliste in
`localStorage`. Nur `title` ändert sich, sonst nichts.

Kachel-Symbole sind eigene SVG-Icons (`games/<name>/Icon.tsx`), keine Emojis.
Zwei Zwischenstufen, die es nicht mehr gibt: erst einfarbige Strichzeichen
(`stroke="currentColor"` — Rückmeldung: altbacken), dann kleine bunte
Zeichen mittig auf der Akzentfarbe (Rückmeldung: „einfach nur son kleines
Symbol draufgemacht"). Heute hat jedes Spiel ein fertiges App-Symbol, siehe
Abschnitt unten.

Das Kachelmenü zeigt Symbol **und** Name (Name als kleine Beschriftung unter
der Kachel, kein Beschreibungstext mehr) — nach kurzem Test ganz ohne Namen
war die Rückmeldung, dass man dann nicht erkennt, was ein Symbol bedeutet.
Bestwert steht weiterhin nur im `aria-label` für Screenreader, nicht sichtbar.

Die `accent`-Farbe wird bei den fertigen App-Symbolen nur noch für den
farbigen Schlagschatten unter der Kachel und für den Rand in der
Bestenliste gebraucht — der Kachel-Farbverlauf daraus (`color-mix()`) ist
der Fallback für Spiele ohne eigenes App-Symbol. Ein wandernder
Lichtschimmer war testweise drin, wurde aber wieder entfernt (Rückmeldung:
lenkt ab, wenn er ständig hintereinander über die Kacheln läuft).

**App-Symbole (`core/AppSymbol.tsx`).** Rückmeldung zu den früheren kleinen
Zeichen auf farbigem Grund: „einfach nur son kleines Symbol draufgemacht …
ich will, dass es aussieht wie eine echte App, mit dem Schriftzug und so."
Inzwischen hat **jedes** Spiel ein fertiges App-Symbol: eigener Farbverlauf,
eigene runde Ecken, ein kleiner Einblick ins Spiel, unten ein Band mit dem
Schriftzug. Es füllt die Kachel ganz aus, die Hülle legt keinen Verlauf mehr
darunter (nur noch den farbigen Schatten aus `accent`).

Der immer gleiche Teil steht **einmal** in `core/AppSymbol.tsx` — Verlauf,
Lichtschein, Ecken, Schriftband. Ein Icon liefert nur noch den Einblick:

```tsx
<AppSymbol id="snakerush" verlauf={[...]} schriftzug="SNAKE RUSH" className={className}>
  …der Einblick, im Bereich y = 0 bis 44…
</AppSymbol>
```

Zu beachten:

- Koordinatensystem ist immer `0 0 64 64`. Unterhalb von `BAND_OBEN` (44)
  liegt das Schriftband — der Einblick muss darüber bleiben.
- `rx="16"` bei 64 Breite entspricht genau `rounded-2xl` auf der 64px-Kachel
  und skaliert überall mit.
- `id` muss je Spiel eindeutig sein, daraus werden die SVG-internen ids für
  Verlauf und clipPath. Sie sind absichtlich fest und nicht zufällig: Ein
  Symbol kann mehrfach auf einer Seite stehen (Menü und Bestenliste), die
  Definitionen sind dann identisch und das Bild überall gleich.
- Der Schriftzug bekommt `textLength` + `lengthAdjust="spacingAndGlyphs"`,
  passt also auch, wenn ein Gerät eine andere Schrift einsetzt. Ab zwölf
  Zeichen wird die Schrift kleiner — die Grenze liegt bei elf, damit
  „BLOCK BURST" unverändert bleibt. Seit „Gehirnjogging" zu „Brain Blitz"
  geworden ist, liegt kein Name mehr darüber; die Regel greift also gerade
  nirgends, bleibt aber die Absicherung für den nächsten langen Namen.
- `GlanzBlock` ist der gemeinsame Baustein für glänzende Spielsteine
  (Schatten unten, Farbe, Lichtkante oben) — benutzt von Block Burst und
  Line Fall.
- Der Einblick soll wirklich das Spiel zeigen, nicht irgendein Motiv: Merge
  Up holt die Kachelfarben aus dem eigenen `farben.ts`, Star Dash zeichnet
  denselben Sternenschlucker wie im Spiel. Einzelne leere Rasterfelder sahen bei großer
  Anzeige wie Lücken aus — Bretter also möglichst voll zeichnen.
- Was im Symbol steht, muss zum Namen passen: Word Play zeigte erst die
  Buchstaben „WORT" über dem Schriftzug „WORD PLAY", das las sich wie ein
  Tippfehler.
- Neues Spiel: `iconVollflaechig: true` in `index.ts` setzen.
  `Kachelmenue.tsx` und `BestenlisteSeite.tsx` prüfen das Feld selbst, dort
  ist nichts zu tun. Der Startbildschirm zeigt das Symbol freistehend
  (`<Icon className="relative size-32 rounded-[2rem] shadow-2xl" />`) statt
  in einem mattierten Kasten.

Kachelmenü ist bewusst `flex flex-wrap` mit **fester** Kachelgröße
(`size-16`), keine responsive Grid-Spaltenzahl mehr — Rückmeldung: Kacheln
wirkten auf breiteren Bildschirmen zu groß, sollen wie normale App-Symbole
aussehen, nicht wie Kacheln, die die volle Breite ausfüllen. Der Name steht
in einer eigenen, etwas breiteren Box (`w-20`) und darf bei Bedarf
zweizeilig umbrechen (`leading-tight`, kein `truncate`) — sonst wurden
längere Namen wie „Gehirnjogging" oder „Ghost Chase" abgeschnitten.

**Weiterspielen-Karte und „Neu"-Abzeichen.** Über dem Kachelraster steht
eine große Karte mit dem zuletzt geöffneten Spiel (`Weiterkarte` in
`Kachelmenue.tsx`), darunter das Raster in **immer derselben** Reihenfolge.
Das Raster darf sich ausdrücklich nicht umsortieren: Florian lernt „Snake
Rush ist das grüne unten links" und tippt es beim zehnten Mal blind — ein
Raster, das sich nach jedem Spielen neu ordnet, nimmt genau diese
Sicherheit weg, und das ausgerechnet beim Lieblingsspiel. Also Dynamik
oben, feste Ordnung unten.

`zuletztGespieltMerken` / `zuletztGespielt` in `speicher.ts` führen dafür
einen eigenen Schlüssel (`zuletzt`). Das `datum` in der Bestenliste taugt
**nicht**: Dort überleben nur die fünf besten Ergebnisse, eine schwache
Runde von gestern fliegt wieder raus. Gesetzt wird der Wert beim
**Betreten** des Spiels (`Spielrahmen.tsx`), nicht erst am Rundenende —
eine abgebrochene Runde ist beim Kind der Normalfall, und genau dann will
man beim nächsten Öffnen dort weitermachen. `bestenlisteLoeschen()` ohne
Argument räumt den Schlüssel mit weg.

Kacheln ohne Bestenlisten-Eintrag tragen ein „Neu"-Abzeichen — als **Wort**,
nicht als farbiger Punkt (Farbe nie als einziges Merkmal). Nicht am Spiel
der Weiterspielen-Karte: „Weiterspielen" und „Neu" gleichzeitig
widerspricht sich, und genau das passiert bei einer abgebrochenen Runde
ohne Punkte. In der Kopfzeile steht statt „Läuft auch ohne Internet."
der Fortschritt („8 von 11 Spielen ausprobiert"), sobald das erste Spiel
Punkte hat.

Bewusst **nicht** übernommen, obwohl echte Spielesammlungen das haben:
Reiter zum Umschalten (versteckt bei elf Spielen sieben hinter einem
Klick — lohnt erst ab etwa 20), Suchleiste, Gesamtpunktzahl (die
Punkteskalen sind unvergleichbar, Quiz 0–10 gegen Block Burst in den
Tausenden), Streak-Zähler, Werbung und Bewertungsanzeigen.

Die Startseite selbst (`Kachelmenue.tsx`) liegt auf einem eigenen,
kräftigen Farbverlauf (Indigo→Violett→Pink) mit vier großen, sehr weichen
Farbflecken (`DEKO_FLECKEN`, stark `blur`, `opacity-20`) — sie sollen den
Hintergrund beleben, aber nie mit den Kacheln konkurrieren. Die Kacheln
sitzen auf einer mattierten Karte (`bg-white/10 backdrop-blur-sm`), damit
es wie ein Spiele-Regal wirkt statt wie lose verstreute Symbole. Kopfzeile
und Beschriftungen sind entsprechend auf Weiß-Töne umgestellt (nicht mehr
`text-gedaempft`, das ist für dunklen Grund gedacht). Ausdrücklicher
Wunsch: Nicht nur die Startbildschirme der einzelnen Spiele, sondern
gerade die Startseite soll nach „richtigem Spiel" aussehen.

Die frühere Ausnahme für Star Dash (gelbe Kreisfigur mit Kerbe als „Katze")
ist **weggefallen** — sie sah zu sehr nach einem bekannten
Spielhallen-Klassiker aus. Die Figur ist jetzt der **Sternenschlucker**
(`games/platzhalter/Figur.tsx`): ein erfundenes Wesen, dessen ganze
Oberseite ein offenes Maul ist, mit den Augen darunter am Bauch. Wunsch war
ausdrücklich „nicht irgendwie eine Katze oder 'n Hund, sondern irgendwas
selber erfunden … was es halt noch nicht gibt" und explizit auch kein
Emoji-Monster (also kein runder Klecks mit einem Auge und Hörnern).

Die Figur ist inzwischen räumlich gebaut (Rückmeldung: „irgendwie son
dreidimensionales Ding"). Zwei Griffe, beide wichtig:

1. **Das Maul ist ein Trichter, keine Scheibe.** Vorderer Rand dick und
   hell, hinterer dünn und dunkel, Schlund nach hinten versetzt. Genau
   diese Asymmetrie lässt eine Ellipse als Loch lesen — vorher war der Rand
   rundum gleich dick und das Maul wirkte wie ein Aufkleber.
2. **Radialverlauf im Körper**, Licht oben links, Tiefe unten rechts, dazu
   ein einzelner harter Glanzpunkt. Der Verlauf war nötig: Zwei
   aufeinandergelegte Ellipsen für Licht- und Schattenseite gingen zuerst
   über den Rand hinaus (Flecken auf dem Hintergrund), und selbst nach dem
   Beschneiden auf die Körperform sah man ihre Kante quer über den Bauch
   laufen. Eine sichtbare Kante zerstört die Wölbung sofort wieder.

Lichtquelle ist durchgehend oben links — wer daran dreht, muss Verlauf und
Glanzpunkt gemeinsam anfassen. Der Bodenschatten lässt sich über
`mitBodenschatten={false}` abschalten; das App-Symbol tut das, dort schwebt
die Figur vor dem Nachthimmel.

Die Datei zeichnet die Figur **einmal** als `SternenschluckerTeile`
(Koordinaten 0…100, ohne eigenes `<svg>`), damit Spiel und App-Symbol
dieselbe Figur zeigen: das Spiel über den Wrapper `Sternenschlucker`, das
Symbol über `<g transform="translate(…) scale(…)">`.

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

Danach außer der Reihe dazugekommen (alle drei auf einmal gewünscht):

9. ✅ Snake Rush
10. ✅ Merge Up
11. ✅ Bubble Pop

Dazwischen lag eine lange Runde Feinschliff (App-Symbole, Startseite,
Handy-Größen, Apple-Anpassung, Animationen, räumlichere Figuren) — siehe
die Abschnitte oben. Damit sind **alle elf Spiele fertig**.

Als Nächstes die zweite Sechser-Staffel. Ronni hat alle sechs auf einmal
freigegeben („Die find ich alle perfekt, die fänd ich mega, wenn Du die
alle machst"), sie dürfen also wie Schritt 9 bis 11 hintereinander gebaut
werden — trotzdem nach jedem Spiel selbst testen und kurz zusammenfassen.
Reihenfolge nach Aufwand und Abwechslung:

12. ✅ Pair Up — Kartenpaare aufdecken. **Nicht** „Memory Match": „Memory"
    ist in Deutschland ein eingetragener Markenname für genau dieses Spiel,
    und hier gilt die Regel oben (Prinzip frei, Name nicht).
13. Tower Stack — schwingende Blöcke stapeln, Überstand fällt weg.
14. Tap Rhythm — im Takt tippen.
15. Sudoku Junior — 4×4 und 6×6 statt 9×9.
16. Flow Connect — gleichfarbige Punkte verbinden, ohne sich zu kreuzen.
17. Mini Golf — Winkel und Stärke, Bande, Loch.

Erst danach:

18. Anmeldung mit Namen + Passwort, geräteübergreifende Bestenliste, wer ist
    der/die Beste. Braucht Supabase (bringt fertige Anmeldung mit) — war von
    Anfang an als "später" vorgesehen. Das ist ein Eingriff in die Hülle
    (`shell/`), nicht in ein einzelnes Spiel: erst angehen, wenn die Spiele
    durch sind, dann mit Ronni gemeinsam planen (welche Daten genau, wie
    Kinder-tauglich das Passwort sein muss).

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
- **Schwierigkeit über Level 5 hinaus:** Die Farbzahl ist bei
  `MAX_FARBEN = 5` gedeckelt (darüber wird der Lösbarkeits-Suchlauf auf dem
  Handy spürbar langsam — eine Messung mit 6 und 7 Farben lief in die
  Zeitgrenze, der alte Kommentar dort stimmt also weiterhin). Dadurch änderte
  sich ab Level 5 gar nichts mehr; Rückmeldung: „ab Level sechs, sieben wird's
  nicht mehr richtig schwerer". Die Schwierigkeit steigt jetzt über zwei
  andere, für den Suchlauf billige Stellschrauben weiter:
  `leereRoehrchenFuerLevel` (ab Level 8 nur noch **ein** leeres Röhrchen statt
  zwei — ein großer Sprung, weil man mit nur einem Zwischenlager viel weiter
  vorausdenken muss) und `extraRoehrchenFuerLevel` (ab Level 15 keine
  Notbremse mehr). Ein Test prüft für Level 1 bis 30, dass jedes Brett lösbar
  bleibt und die Schwierigkeit nie zurückgeht.
- Ein fertig sortiertes Röhrchen bekommt einen **Deckel** aufgesetzt, danach
  stiebt seitlich **Konfetti** heraus (`.deckel-drauf`, `.konfetti`). Vorher
  sah ein fertiges Röhrchen genauso aus wie ein halb sortiertes. Wichtig: Das
  Feiern wartet, bis `guss` durch ist — der Zustand meldet das Röhrchen schon
  beim Anklicken als fertig, zu sehen ist es aber erst, wenn die Flüssigkeit
  angekommen ist.
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
- **Volle Zeilen zerbröseln** (`ZerbroeselndeZeilen` in `Reihenfall.tsx`).
  Das war die auffälligste Lücke im ganzen Projekt: Der Kern des Spiels
  passierte optisch überhaupt nicht — `einrasten` rechnete die vollen
  Zeilen aus und warf sie sofort weg. Jetzt führt der `Zustand` ein Feld
  `geloescht` mit den betroffenen Zeilen **samt Inhalt vor dem Entfernen**
  (aus dem Feld ist er ja weg) und einem `tick`, der bei jeder Löschung
  hochzählt. Ohne den `tick` wäre eine zweite gleiche Löschung von der
  ersten nicht zu unterscheiden und die Animation liefe kein zweites Mal
  an; die Anzeige benutzt ihn als `key`.
  `.aufloesen-blitz` und `.kruemel` aus Block Burst werden unverändert
  weiterverwendet, gestaffelt von links nach rechts (22 ms je Spalte, bei
  `reducedMotion` selbst auf 0 gesetzt — `.ruhig` kürzt nur die Dauer,
  nicht die Verzögerung). Das Feld ist zu dem Zeitpunkt schon
  zusammengefallen; bei rund 400 ms Gesamtlauf liest sich das als „die
  Zeile ist zerplatzt", und die nach unten wegfliegenden Krümel
  unterstützen den Zusammenfall sogar.
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
  Spielfigur (ein kleines Männchen, `figuren.tsx`), eigene
  Geister-Silhouette und -Farben (`farben.ts`).
- **Blau gegen Rot** (`farben.ts`). Der Spieler ist die einzige kalte Farbe
  im Labyrinth, die vier Geister die einzigen warmen (Rot, Rose, Pink,
  Fuchsia). Vorher war der Spieler grün und die Geister lila/gelb/türkis/
  rosa — bunt, aber ohne Aussage, und der grüne Spieler ging unter.
  Rückmeldung: „mach den Geist irgendwie rot, dann fällt er besser auf.
  Blau und Rot passt gut." Orange und Gelb bleiben für Punkte und
  Kraftpillen reserviert. Das App-Symbol zieht die Geisterfarbe direkt aus
  `GEIST_FARBEN[0]`, ändert sich also von allein mit.
- **Das Männchen ist nur etwa 17 Pixel groß.** Bei der Größe kommt nur
  Umriss, Kontrast und Bewegung an — mehr Realismus würde es *schlechter*
  erkennbar machen. Deshalb: breiter (nutzt die Kachelbreite jetzt aus,
  vorher 57 %), dunkler Saum um jede Fläche, hellere Hose und Haare (die
  alten Dunkeltöne waren auf fast schwarzem Grund unsichtbar), ein weicher
  Lichthof und eine Laufanimation. In der **Höhe** geht bewusst nichts
  mehr: Die Gänge sind eine Kachel breit, ab etwa 1,25-facher Größe ragt
  die Figur in die Wand und man sieht an einer Kreuzung nicht mehr, in
  welchem Gang sie steht.
- Lichthof und Geister-Wölbung sind **Verläufe**, keine Flächen mit wenig
  Deckkraft. Beide Male war die erste Fassung schlechter als gar nichts:
  Der Hof als Kreis mit 13 % Deckkraft wurde auf dem fast schwarzen Grund
  zu einer dunklen Scheibe mit harter Kante, der Geisterschatten als
  waagerechter Strich zu einem Gürtel quer über den Geist. Der Verlauf für
  die Wölbung arbeitet nur mit Weiß und Schwarz und passt dadurch zu allen
  vier Geisterfarben, ohne dass es vier Verläufe braucht.
- `useLaeuft` in `Geisterjagd.tsx` meldet, ob die Figur seit kurzem die
  Kachel gewechselt hat (Nachlauf 280 ms, ein Schritt dauert je nach Level
  110 bis 160 ms). Steht sie an einer Wand, hört sie nach dem Nachlauf von
  selbst auf zu strampeln. Die Keyframes (`glied-vor`, `glied-zurueck`,
  `laeuft-huepf`) enden alle im Stand — sonst fröre die Figur bei „weniger
  Bewegung" im Ausfallschritt ein.
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

## Antwort-Rückmeldung (Quiz Time, Word Play, Brain Blitz)

Alle drei zeigen vier Antworten und hatten dafür nur `transition-colors` —
zehn Aufgaben je Runde, und zehnmal passierte optisch fast nichts. Zwei
Klassen in `index.css` beheben das in allen drei Spielen gleichzeitig:
`.antwort-richtig` (ploppt kurz auf) und `.antwort-falsch` (wackelt).

Die richtige Antwort ploppt **immer** auf, auch wenn danebengetippt
wurde — sie ist die, die man sich merken soll. Gewackelt wird nur bei der
tatsächlich angetippten falschen. Beide Keyframes enden im Ruhezustand
(siehe Snake Rush), und das bloße Setzen der Klasse startet die Animation;
es braucht keinen Schlüsselwechsel wie bei `.punkte-bumsen`.

Die vorgeführte Kachel bei den Merk-Folgen (`MerkfolgenAnzeige.tsx`)
bekommt zusätzlich einen weißen Ring und deutlich mehr Helligkeit — das ist
die Kernmechanik des Aufgabentyps und wirkte mit 8 % Vergrößerung viel zu
lasch. Bewusst als reiner Übergang, nicht als Keyframe-Animation: Unter
`.ruhig` entfällt dann nur die Überblendung, der Zustand bleibt richtig.

**Grenze für alle neuen Dauerpulse: höchstens 1,7 Hz, und über Deckkraft
oder Helligkeit in einem engen Band statt über An/Aus oder Farbwechsel.**
Der Angst-Blink der Geister in Ghost Chase liegt mit rund 2,5 Hz bei hohem
Kontrast auf bis zu vier Figuren schon dicht an der Grenze, ab der Blinken
unangenehm bis gefährlich wird — diese eine Stelle darf weder schneller
noch flächiger werden, und das Muster gehört nirgendwo sonst hin.
Ganzflächige Hell-Dunkel-Wechsel sind grundsätzlich tabu.

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

## Snake Rush — Besonderheiten

- `logik.ts`: Bewegung läuft über `zeitFortschritt(z, dt)` — die Zeit wird
  angesammelt, bis ein voller Takt (`taktS`) zusammen ist, dann geht es ein
  Feld weiter. Dadurch ist das Tempo unabhängig von der Bildrate. Die
  Schleife holt mehrere fällige Takte nach, falls es einmal geruckelt hat;
  `useGameLoop` deckelt das ohnehin schon.
- An den Rändern läuft die Schlange auf der anderen Seite weiter, statt zu
  sterben — bewusst gnädiger als das Original, weil es sich flüssiger
  spielt und den einzigen echten Fehler (in sich selbst laufen) klarer macht.
- Der Kopf darf auf das Feld ziehen, das der Schwanz im selben Schritt
  freigibt. Deshalb wird in `feldWechseln` erst gekürzt und dann auf
  Kollision geprüft — andersherum stirbt man bei jeder engen Kurve.
- Richtungswechsel werden gepuffert (`gepuffert`) und erst beim nächsten
  Feldwechsel gültig; die Gegenrichtung wird verworfen. Geprüft wird gegen
  die *aktuelle* Richtung, nicht gegen eine schon gepufferte — sonst
  schluckt eine schnelle Doppeleingabe (rechts, dann hoch) die zweite.
- Goldstücke erscheinen alle `GOLD_JE_FUTTER` Futter, geben Zusatzpunkte und
  verschwinden nach `GOLD_DAUER_SCHRITTE` Schritten wieder. Immer nur eines
  gleichzeitig, sonst häufen sie sich bei schnellem Spiel.
- `freiesFeld` zählt erst alle freien Felder und wählt dann eines, statt
  blind zu würfeln und bei Treffern zu wiederholen — begrenzter Aufwand auch
  bei fast vollem Feld, und für eine gegebene Saat immer dasselbe Ergebnis.
- Das Brett ist **ein SVG**, keine 289 Kacheln. Die Schlange bestand vorher
  aus einzelnen Kacheln mit einer Fuge dazwischen — sie konnten sich also
  gar nicht berühren, und übrig blieb ein grüner Streifen. Jetzt ist der
  Körper ein durchgehender Linienzug aus vier Schichten (Schatten, dunkle
  Kante, Fläche, helle Lichtkante leicht nach oben versetzt); die Kurven
  entstehen von selbst durch `stroke-linejoin="round"`, es braucht keine
  Eckvarianten. Dazu Querringe auf den geraden Gliedern, ein Kopf mit zwei
  Augen und Zunge, ein spitz auslaufender Schwanz. Ronni hat die Machart aus
  vier gerenderten Varianten ausgewählt.
- `geometrie.ts` trägt den kniffligen Teil: `versatz` rechnet einen
  Rand-Umschlag als **einen** Schritt (16 → 0 ist +1, nicht −16), `laeufe`
  zerlegt die Kette an Umschlägen in Teilstücke. Ohne das malt ein einziger
  Pfad beim Tunneln quer über das ganze Feld. 17 Tests dazu.
- **Zeichenreihenfolge beachten:** erst alle dunklen Kanten, dann alle
  Flächen. Zeichnet man den Schwanz stückweise fertig, malt dessen schmale
  Kante einen sichtbaren Ring quer über den breiten Körper.
- Das Goldstück ist ein **Stern**, der Apfel ein Kreis. Vorher waren beide
  Kreise und nur an der Farbe zu unterscheiden — das verstieß gegen die
  Regel, dass Farbe nie das einzige Merkmal sein darf.
- Die Keyframes `schlange-zuengelt` und `schlange-schluckt` enden bei 100 %
  im Ruhezustand. `.ruhig` kürzt nur die Dauer, das Element bleibt auf dem
  Schlussbild stehen — stünde die Zunge dort draußen, hinge sie bei
  „weniger Bewegung" dauerhaft heraus. Zusätzlich setzt die Anzeige die
  Klassen bei `reducedMotion` gar nicht erst.

## Merge Up — Besonderheiten

- Kacheln tragen eine **Stufe**, nicht den angezeigten Wert: Stufe 3 wird als
  8 angezeigt (`wertVonStufe` = 2^Stufe). Verschmelzen ist dadurch ein
  simples `stufe + 1`, und die Farbzuordnung ist ein Griff in eine Liste.
- Alle vier Richtungen laufen durch **eine** Funktion (`reiheSchieben`, immer
  nach links). `schieben` dreht das Raster vorher passend und danach zurück.
  Das spart drei fast gleiche Fassungen, in denen sich leicht ein Fehler
  versteckt. Achtung beim Ändern: `drehen` dreht **gegen** den Uhrzeigersinn,
  dabei wird aus „hoch" **eine** Drehung und aus „runter" **drei** — genau da
  war in der ersten Fassung ein Vertauscher drin, den erst die Tests fanden.
- Jede Kachel verschmilzt nur einmal pro Zug (2,2,2,2 → 4,4, nicht 8), und
  das vordere Paar zuerst — beides ist getestet.
- Ein Zug, der nichts bewegt, ist kein Zug: es kommt keine neue Kachel dazu.
  Sonst wäre wiederholtes Drücken gegen eine Wand eine Strafe.
- 2048 setzt `gewonnen`, beendet die Runde aber **nicht** — man darf
  weiterspielen, solange noch ein Zug geht. `onGameOver` bekommt `gewonnen`
  mit, die Hülle zeigt dann „🎉 Gewonnen!".
- Farben in `farben.ts` sind bewusst eine eigene, kräftige Reihe (Blau →
  Grün → Gelb → Rot → Violett), nicht die beigen Töne des Originals.

## Bubble Pop — Besonderheiten

- Wabenraster im „odd-r"-Versatz: jede ungerade Zeile ist eine halbe Kugel
  nach rechts versetzt. Die gesamte Nachbarschaftslogik steckt in **einer**
  Funktion (`nachbarn` in `logik.ts`) — der Versatz entscheidet, ob die
  oberen/unteren Nachbarn nach links oder rechts greifen. Ein
  Vorzeichenfehler fällt im Spiel kaum auf, deshalb prüft ein Test, dass die
  Nachbarschaft **gegenseitig** ist (wer mein Nachbar ist, hat mich auch als
  Nachbarn). Das ist der eigentliche Prüfstein bei Wabenrastern.
- `geometrie.ts` rechnet die Flugbahn Schritt für Schritt ab und spiegelt an
  den Seitenwänden — als reine Funktion, damit sich das Abprallen ohne
  Browser testen lässt. Ein Test schießt viele Winkel durch und prüft, dass
  keiner in einem schon belegten Feld landet.
- `naechstesFeld` prüft die geschätzte Zeile **und ihre Nachbarzeilen** — der
  Versatz macht eine direkte Umrechnung unzuverlässig.
- Nach dem Platzen einer Gruppe fallen alle Kugeln, die den Halt zur
  obersten Zeile verlieren (`haengendeKugeln`, Flutfüllung von oben). Sie
  geben doppelte Punkte — das belohnt Schüsse, die eine tragende Kugel
  treffen, statt nur die größte Gruppe zu suchen.
- Nachschub von oben kommt nur nach Schüssen **ohne** Treffer
  (`NACHSCHUB_NACH_SCHUESSEN`) — ein Treffer soll belohnt werden, nicht
  zusätzlich die Wabe herunterdrücken.
- Neue Kugeln werden nur aus Farben gezogen, die noch im Feld liegen
  (`vorhandeneFarben`) — sonst bekommt man irgendwann eine Farbe ins Rohr,
  die es gar nicht mehr gibt, und der Schuss ist zwangsläufig verschenkt.

## Pair Up — Besonderheiten

- **Der Name ist bewusst nicht „Memory".** Das ist in Deutschland ein
  eingetragener Markenname für genau dieses Spiel; hier gilt die Regel
  oben — das Prinzip ist frei, der Name nicht. Interne `id` ist `paare`.
- Level = Runde wie beim Quiz. Aus der Levelnummer entsteht immer dieselbe
  Verteilung. Anders als beim Farbsortierer geht „Nochmal" nach einem Sieg
  ins **nächste** Level: Dasselbe Feld noch einmal zu spielen ist bei einem
  Merkspiel sinnlos, man weiß ja noch, wo alles liegt.
- Feldgröße wächst alle zwei Level eine Stufe (`STUFEN` in `logik.ts`) und
  ist bei 6×5 gedeckelt — darüber passt es auf einem schmalen Handy nicht
  mehr ohne Scrollen, und fünfzehn Paare sind für ein Kind ohnehin viel.
  Ein Test prüft für Level 1 bis 40, dass jede Stufe eine **gerade**
  Kartenzahl hat (sonst bliebe eine Karte übrig) und nie mehr Paare
  verlangt, als es Motive gibt.
- **Die Logik kennt keine Uhr.** Ein Fehlgriff setzt nur `fehlgriff: true`;
  die Anzeige wartet `ZUDECKEN_MS` und ruft dann `schliessen`. Solange
  zwei Karten offen liegen, sind weitere Tipps wirkungslos — sonst könnte
  man sich durch schnelles Tippen das ganze Feld ansehen, ohne einen
  einzigen Zug zu verbrauchen. Dafür gibt es einen eigenen Test.
- Die fünfzehn Motive (`motive.tsx`) unterscheiden sich in **Form und**
  Farbe, nicht nur in der Farbe. Bei einem Spiel, das ausschließlich aus
  „sind diese beiden gleich?" besteht, wäre reine Farbunterscheidung für
  farbfehlsichtige Spieler unlösbar. Jede aufgedeckte Karte trägt zusätzlich
  den Motivnamen im `aria-label`. `fillRule="evenodd"` ist bei Kreis,
  Schlüssel und Würfel nötig — sonst füllt der Browser ihre Löcher mit.
- Die Karten schlagen um (`.karte-huelle`/`.karte-dreher`/`.karte-seite` in
  `index.css`): Behälter mit `perspective`, darin ein Dreher mit
  `transform-style: preserve-3d`, darin zwei Seiten mit
  `backface-visibility: hidden`. **Die Abblendung gefundener Karten sitzt an
  der Hülle, nicht am Dreher**: `opacity` unter 1 zwingt `transform-style`
  auf `flat`. Am Dreher verlor der dadurch seine Räumlichkeit, und bei jedem
  gefundenen Paar schien die Rückseite seitenverkehrt durch statt des
  Motivs. Genau so ist es beim ersten Versuch passiert.
- `--vz` rechnet sich hier aus Spalten mal 3 zu Zeilen mal 4, weil die
  Karten hochkant sind (Verhältnis 3:4) — sonst quetscht `.spielbrett` sie
  zu Quadraten.

## Befehle

```bash
npm run dev     # Entwicklungsserver auf http://localhost:5180
npm test        # Tests einmal durchlaufen
npm run build   # Typprüfung und fertige Fassung nach dist/
node werkzeuge/icons-erzeugen.mjs   # App-Symbole neu erzeugen
```
