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
aufgenommen: React, Tailwind, Vitest — und **three.js**, ausdrücklich von
Ronni freigegeben („wenn 3-D, dann auch gleich richtiges, keine halben
Sachen"). Es wird **nur für Dash City nachgeladen**, siehe unten.

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
| `sfx(name, halbtoene?)` | Kurze Töne. Das zweite Argument hebt den Ton an — für Serien. |
| `rng(saat)` / `schritt(saat)` / `saatAus(...)` | Zufall aus einer Startzahl. `rng` für laufende Nutzung, `schritt` für reine Logik, die ihre Saat selbst mitführt. **Nie `Math.random`** — sonst ergibt dieselbe Levelnummer nicht dasselbe Rätsel. |
| `sfx(name)` | Kurze Töne über die Web Audio API, keine Dateien. Ob Ton erlaubt ist, meldet die Hülle über `sfxEinstellen`. |
| `<Steuerkreuz onRichtung aktiv>` | Vier Tasten zum Antippen (oben/unten/links/rechts), mit Wiederholung bei Halten — Ergänzung zum Wischen, nicht Ersatz. Auf Handys ist eine Taste oft zuverlässiger als eine Wischgeste. |
| `<Startbildschirm titel untertitel bestScore verlauf deko Symbol knopfFarbe onStart>` | Das Titelbild eines Spiels. Acht Spiele hatten sich denselben Aufbau einzeln zusammengesetzt, vier hatten gar keinen. |
| `<Punktegewinn>` + `usePunktegewinn(punkte, schwelle?)` | Das „+N" über dem Feld. Erkennt Zuwächse selbst und zeigt sie an. |
| `<Komboherz kombo ruhig>` | Serien-Anzeige: ein pochendes Herz mit der Zahl darin, das **mit der Serie wächst**. Benutzt von Block Burst (`kombo`) und Line Fall (`vierfachStreak`). |

Zum Kombo-Herz: Der Schlag ist ein echter Doppelschlag (laut, leise,
Pause), kein gleichmäßiges Auf und Ab — erst dadurch liest es sich als
Herzschlag statt als zappelndes Symbol. Knapp ein Schlag je Sekunde, also
weit unter der 1,7-Hz-Grenze. Beide Spiele hängen es als Aufsatz über die
obere rechte Ecke des Feldes und **nicht** in die Kopfzeile: Dort ist der
Platz nach oben knapp, und 86 Pixel feste Höhe hätten auf einem kleinen
Handy genau das Scrollen zurückgebracht, das mühsam abgestellt wurde.

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
| `messerwurf` | Blade Toss |
| `viererreihe` | Drop Four |
| `farbringe` | Ring Rise |
| `halbieren` | Even Cut |
| `verbinden` | Flow Link |
| `tempo` | Tap Rush |
| `kistenschieben` | Box Push |
| `laufen` | Dash City |

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

Außer der Reihe dazwischengeschoben, weil Ronni die Idee selbst hatte:

17b. ✅ Blade Toss — Messer in einen drehenden Holzstamm werfen.

Dazu ausgewählt aus einer zweiten Ideenliste — nach der Frage „was brauchen
wir am meisten und kostet nicht zu viel Aufwand". Die vier schließen je eine
Lücke, die keines der bisherigen Spiele abdeckt:

18. ✅ Drop Four — vier in einer Reihe **gegen den Computer**. Bis hierher
    spielt man in allen Spielen allein gegen sich selbst; das ist die
    größte Lücke in der Sammlung. Nicht „Vier gewinnt": Das ist in
    Deutschland ein geschützter Handelsname, dieselbe Überlegung wie bei
    Pair Up.
19. ✅ Box Push — Kisten auf Zielfelder schieben. Siehe eigenen Abschnitt.
20. Schatzsuche — Minensuchen mit Kristallen statt Bomben. Reines
    Schlussfolgern aus Zahlen.
21. Wortsuche — versteckte Wörter im Buchstabengitter. Kleiner Aufwand,
    ergänzt Word Play um etwas Ruhiges.

Bewusst zurückgestellt, obwohl gut bewertet: **Pixel Paint** (Nonogramme) —
sehr schönes Rätsel, aber es braucht einen Löser, der für jedes erzeugte
Bild beweist, dass es genau *eine* Lösung hat. Das ist die aufwendigste
Einzelsache auf der ganzen Liste.

Vorgezogen, weil Ronni es ausdrücklich zuerst wollte:

22. ✅ Anmeldung mit Namen + Passwort, geräteübergreifende Bestenliste, wer
    ist der/die Beste. Siehe eigenen Abschnitt „Anmeldung und Bestenliste"
    weiter unten.

Von Ronni selbst ausgesucht, aus einer Liste von Vorschlägen:

23. ✅ Ring Rise — Kugel durch drehende Farbringe (Vorbild: Color Switch).
24. ✅ Even Cut — mit einem Wisch eine Form in zwei gleiche Hälften
    schneiden (Vorbild: Perfect Slice).
25. ✅ Flow Link — gleichfarbige Punkte verbinden, ohne sich zu kreuzen,
    am Ende ist das Gitter voll (Vorbild: Flow Free).
26. ✅ **Duell** — zwei Angemeldete spielen dasselbe Level, wer mehr Punkte
    hat, gewinnt. Siehe eigenen Abschnitt unten.
27. ✅ **Tap Rush** — Zeit wählen, so oft wie möglich tippen. Siehe unten.

Danach, in dieser Reihenfolge:

23. Qualität der bestehenden Spiele — der Feinschliff, der beim schnellen
    Bauen liegen geblieben ist.
24. Die drei offenen Spiele oben (Box Push, Schatzsuche, Wortsuche).
25. Battle: zwei Angemeldete treten im selben Spiel gegeneinander an.
    Baut auf der Anmeldung auf; die Tabellen dafür stehen noch nicht.
26. Avatare, die mit dem Level mehr Teile freischalten.

Und dann die große Richtung, die Ronni vorgegeben hat: **3-D-Spiele** und
**Retro-Klassiker** in eigener Umsetzung. Von ihm selbst genannt:

- **Öl Imperium** (C64/Amiga, 1984) — Wirtschaftsspiel: Land kaufen, bohren,
  Öl verkaufen, Preise schwanken. Reines Rechnen und Entscheiden, kein
  Reaktionsspiel — passt gut zu einem Handy und ist technisch billig.
  Wäre das erste Spiel der Sammlung, das über mehrere Runden läuft.
- **Wings of Fury** (Amiga, 1987) — Seitenscroller mit Flugzeug vom
  Flugzeugträger. Deutlich aufwendiger: Scrolling, Physik, Gegner.

Weitere Kandidaten aus derselben Ecke, noch nicht mit Ronni besprochen:
Boulder Dash (Graben und Steine), Lode Runner (Leitern und Löcher),
Pipe Mania (Rohre legen), Bomberman-Prinzip, Kaiser (Handelsspiel wie Öl
Imperium), Archon. Bei allen gilt die Namensregel oben: Prinzip frei,
Name und Optik nicht.

**Zu 3-D:** Nachgemessen, nicht geschätzt (Bericht vom 15.08.2026).

**Isometrie ist für einen Läufer die falsche Technik** — hier stand das
vorher falsch. Isometrie ist eine *Parallel*projektion, sie hat keinen
Fluchtpunkt: Eine Figur, die in die Tiefe läuft, würde dabei nicht kleiner.
Was ein Endlosläufer braucht, ist eine **Zentralprojektion** — dieselbe
Rechnung wie in Pole Position und OutRun, und die läuft auf Canvas 2D.

Die Zahlen zu three.js:

| | gzip |
|---|---|
| App heute (React + Hülle + alle Spiele) | 141 kB |
| davon eigener Code (Hülle + 19 Spiele) | 81 kB |
| three.js, sparsamster Import | **133 kB** |

three.js allein wäre also **1,6-mal so groß wie das gesamte selbst
geschriebene Projekt** und würde die App fast verdoppeln. Ein Teilimport
hilft nicht: `WebGLRenderer` zieht die ganze Shader-Bibliothek nach — die
sparsame Fassung war in der Messung sechs Byte **größer** als „alles
importieren".

Dazu: WebGL auf älterem iOS-Safari hat bekannte Einbrüche (bis zu
zwanzigfache Bildzeiten) und verliert beim App-Wechsel den Zeichenkontext.
Und die Rechenkerne lägen in der Bibliothek statt in einem getesteten
`geometrie.ts` — das bricht die Projektregel „Spiellogik in reinen,
testbaren Funktionen" wirksamer als jede Dateigröße.

**Also Zentralprojektion auf Canvas 2D.** Belegt: eine gerade Strecke sind
rund 200 Zeilen, ein komplettes Spiel rund 700 (Referenzen: Jake Gordons
JavaScript-Racer, Frank Force' HueJumper2k). Etwa 75 Polygonfüllungen je
Bild — für ein altes iPad keine Last.

**Es gibt bisher kein einziges Canvas-Spiel im Projekt** (`getContext` kommt
in `src/` nirgends vor), obwohl oben seit jeher „Canvas 2D für Spiele mit
fortlaufender Bewegung" steht. Ein Läufer wäre das erste.

Drei Fallen, die vorher feststehen müssen:

1. `bildY` mit **`breite/2`** skalieren, nicht mit `hoehe/2`. Jake Gordons
   Racer nimmt die Höhe — im Hochformat wäre das mehr als das Doppelte, und
   jede Kiste sähe hochgezogen aus. Gleicher Faktor in beiden Achsen, sonst
   ist ein Würfel kein Würfel.
2. Der Horizont gehört bei etwa 35 % der Höhe, nicht in die Mitte — sonst
   fehlt unten der Platz für Straße und Figur.
3. Punkte mit `z - kameraZ <= nahgrenze` verwerfen, nicht erst bei `<= 0`.
   Sonst schießt die Skalierung gegen unendlich und ein Trapez explodiert
   über den ganzen Bildschirm.

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
- **Farben in Hell und Dunkel geteilt** (`farben.ts`). Vorher lagen alle
  acht auf derselben Helligkeitsstufe — nebeneinander im Röhrchen sah das
  flau aus, weil sich nur der Farbton unterschied. Rückmeldung: „mehr
  Kontraste, so hellgelb und dunkellila, nicht nur so normale Farben."
  `farbpaletteFuerLevel` zieht jetzt **abwechselnd** aus beiden Töpfen,
  jedes Level hat also von sich aus beide Stufen; würde einfach aus allen
  acht gezogen, käme irgendwann ein Level mit vier dunklen Farben heraus.
  Wichtig dabei: `dunkel` ist nur das untere Ende des Verlaufs **innerhalb**
  einer Schicht, keine zweite Farbe. Bei den hellen Tönen bleibt es deshalb
  hell — mit einem kräftigen Absacker wurde aus Hellgelb unten ein Oliv,
  und der ganze Sinn der Aufteilung war dahin.
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
- Ein Fehlgriff bekommt einen **roten Rand mit weichem Schein**
  (`.karte-falsch`), solange die beiden Karten offen liegen — also knapp
  eine Sekunde. Vorher unterschied er sich optisch in nichts von einem
  Treffer, man merkte ihn nur am Ton. Bewusst als Übergang und nicht als
  Keyframe-Animation: Der Rand soll genau so lange stehen, wie die Karten
  liegen, und nicht nach fester Zeit ablaufen.
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

## Blade Toss — Besonderheiten

Ronnis eigene Idee: ein Holzstamm von vorn (also die runde Schnittfläche),
er dreht sich, man wirft von unten Messer hinein. Trifft man ein schon
steckendes Messer, ist die Runde vorbei. Der Name ist bewusst nicht der des
bekannten Vorbilds — dieselbe Regel wie bei Pair Up.

- **Steckwinkel statt Koordinaten.** Ein steckendes Messer wird in
  *Stammkoordinaten* gespeichert (`steck = ANKUNFT − stammwinkel`), nicht
  als Position. Dadurch dreht es sich von allein mit, die Kollisionsprüfung
  ist ein simpler Winkelvergleich, und die Anzeige braucht nur **eine**
  Drehung um den Mittelpunkt statt einer Positionsrechnung je Messer.
- Winkel 0 zeigt nach rechts und wächst im Uhrzeigersinn, weil y auf dem
  Bildschirm nach unten wächst. Das Messer kommt immer von unten, trifft
  also bei `ANKUNFT = π/2`.
- **Drei Stellschrauben für die Schwierigkeit**, alle aus der Levelnummer:
  mehr Messer (`messerFuerLevel`, gedeckelt bei 9), schon steckende Messer
  ab Level 3 (`vorgestecktFuerLevel`, gedeckelt bei 4) und das Drehmuster
  (`musterFuerLevel`). Bis Level 4 dreht der Stamm gleichmäßig, **ab Level 5
  wechselt er die Richtung** in unregelmäßigen Abständen — genau das macht
  das Vorhalten schwer, weil man sich auf keinen Rhythmus mehr verlassen
  kann. Ein Test prüft für Level 1 bis 40, dass alle Messer eines Levels
  rechnerisch überhaupt auf den Umfang passen.
- Der Einschlag prüft **erst den Apfel, dann die Messer**: Ein Treffer
  zerteilt den Apfel, das Messer fliegt weiter und steckt trotzdem — aber
  ein Apfel schützt nicht vor einem Messer dahinter. Beides ist getestet.
- **Eigener Tastatur-Listener statt `useInput`.** `useInput` erkennt ein
  Antippen erst beim *Loslassen*. Zusammen mit dem `onPointerDown` (das den
  Wurf im Moment der Berührung auslöst, weil sich alles andere träge
  anfühlt) käme pro Tipp zweimal ein Wurf an — der zweite, sobald der erste
  schon eingeschlagen ist. Das kostete jedes Mal ein Messer. Hier gibt es
  ohnehin nur eine Handlung, die sieben Aktionen von `useInput` werden also
  nicht gebraucht.
- Gezeichnet wird **Stamm zuerst, Messer darüber**. Ein erster Versuch legte
  die Messer unter den Stamm, damit die Klinge „im Holz verschwindet" —
  dann waren alle Messer unsichtbar, sobald sie nach oben zeigten.
- Die Logik kennt keine Uhr für den Levelwechsel im engeren Sinne, aber
  einen `pauseRest`: Nach dem letzten Messer vergeht eine kurze Pause, bevor
  der neue Stamm kommt. Ohne sie wirft ein noch tippender Finger sofort ins
  frische Level.

## Drop Four — Besonderheiten

Das erste Spiel der Sammlung, bei dem ein Gegner zurückspielt. Bis dahin
spielte man überall allein gegen sich selbst — das war die größte Lücke.
Der Name ist bewusst nicht „Vier gewinnt": ein geschützter Handelsname,
dieselbe Überlegung wie bei Pair Up.

- **Die Rechenkunst steht getrennt** in `gegner.ts`, die Spielregeln in
  `logik.ts`. Beide rein und ohne React, beide getestet.
- Verfahren: **Minimax mit Alpha-Beta-Beschneidung**. Suchtiefe 2 / 4 / 6 je
  Stufe. Sieben Spalten hoch sechs wären ohne Beschneidung 117 649
  Stellungen; mit Alpha-Beta und Zugsortierung von der Mitte nach außen ist
  es ein Bruchteil davon und läuft auch auf einem alten iPad in
  Millisekunden. **Die Sortierung ist keine Kosmetik** — Alpha-Beta
  beschneidet umso mehr, je früher der beste Zug geprüft wird, und das ist
  hier fast immer ein mittlerer.
- Die Stellungsbewertung zählt über 69 vorab berechnete Vierer-Fenster. Die
  Liste wird **einmal** aufgebaut, nicht bei jedem Aufruf — sie läuft im
  innersten Teil der Suche und wird zehntausendfach gebraucht.
- **Die Drohungen des Gegners wiegen schwerer als die eigenen Chancen**
  (80 gegen 50, 12 gegen 10). Ohne dieses Übergewicht baut der Computer
  lieber die eigene Reihe weiter, statt zu blocken, und verliert gegen
  jeden, der stur drei nebeneinander legt. Dafür gibt es einen eigenen Test.
- Ein Sieg wird um die Resttiefe verringert: Ein Sieg in zwei Zügen ist mehr
  wert als derselbe Sieg in vier — sonst schiebt der Computer einen sicheren
  Gewinn beliebig vor sich her.
- **Streuung nur auf der leichten Stufe** (`NACHSICHT`): Ohne sie spielt der
  Computer bei gleicher Lage immer exakt dieselbe Partie. Einen sicheren
  Sieg oder eine nötige Abwehr streut sie aber nie — sonst übersähe die
  leichte Stufe einen Vierer, der direkt vor ihr liegt, und das wirkt kaputt
  statt leicht.
- Der aussagekräftigste Test lässt **die schwere Stufe gegen die leichte**
  eine ganze Partie spielen; die schwere muss gewinnen. Das ist der einzige
  Beleg dafür, dass die Suchtiefe wirklich etwas bringt.
- **Punkte nach Stufe gestaffelt** (150 / 400 / 900 plus Bonus für einen
  schnellen Sieg), sonst lohnt es sich, immer auf „leicht" zu spielen, und
  die Bestenliste sagt nichts mehr aus. Niederlage null, Remis ein Drittel.
- Die Stufe wird auf dem Startbildschirm gewählt und ist danach fest —
  mitten in der Partie umzuschalten würde die Wertung sinnlos machen.
- Der Computer hat eine **Bedenkzeit** von einer halben Sekunde. Ohne sie
  käme sein Stein im selben Augenblick wie der eigene an, und man sähe gar
  nicht, dass jemand geantwortet hat.
- Mensch und Computer unterscheiden sich in **Farbe und Form** (blauer
  Kreis gegen orange Raute). Bei einem Spiel, in dem man ständig „wem gehört
  dieser Stein?" beantwortet, reicht Farbe allein nicht.
- Die ganze **Spalte** ist anklickbar, nicht nur die freie Zelle — ein Kind
  tippt irgendwo in die Spalte, nicht auf ein bestimmtes Loch.


## Was aus dem großen Audit umgesetzt wurde

Drei Agenten haben Konsistenz, Startseite und Technik durchgesehen. Die
wichtigsten Umsetzungen und **warum sie so und nicht anders sind**:

**Der Farb-Bruch** (`shell/spielfarbe.ts`). Die Spielfelder wirkten grau,
während Startseite und Startbildschirme bunt sind. Die Ursache war nicht der
Grundton — der liegt schon leicht im Blau —, sondern die fehlende
*Zuordnung*. Gelöst mit zwei Griffen an zwei Dateien: Die Kopfzeile bekommt
einen Verlauf in der Spielfarbe (genau an dieser Kante passierte der Bruch),
und die vier Farbtokens werden lokal mit 8 % der Spielfarbe gemischt. Das
wirkt in jedem Element, **ohne dass ein einziges Spiel angefasst wird**.

Dabei zwei Fallen: Die Beimischung muss gegen `--basis-*` rechnen, nicht
gegen `--color-*` — sonst bezieht sie sich auf ihr eigenes Ergebnis und
schaukelt sich bei jedem verschachtelten Element weiter auf. Und drei Spiele
brauchen eine Ersatzfarbe (`ERSATZFARBE`), weil ihr `accent` schon belegt
ist: Quiz Time (das Richtig-Grün), Star Dash (die Fokusfarbe), Ghost Chase
(weder Blau noch Rot sind frei).

**Leitplanke:** Farbe gehört hinter, neben und über das Brett, **nie auf die
Brettfläche**. Bei Block Burst unterscheiden sich vier Zustände einer Zelle
fast nur über die Helligkeit; die leere Zelle muss der dunkelste Punkt im
Bild bleiben.

**Bubble Pop zielte auf dem Handy nicht.** Der Schuss hing an
`pointerdown` — die Kugel war also unterwegs, bevor je ein `pointermove`
ankam, und die gerechnete Flugbahn mit den Abprallern war auf dem Hauptgerät
**nie zu sehen**. Mit Maus fiel es nicht auf, weil der Zeiger schon vor dem
Klick über dem Feld liegt. Jetzt: beim Berühren zielen, beim Loslassen
schießen.

**Wischen löst jetzt während der Bewegung aus**, nicht erst beim Loslassen
(`core/useInput.ts`). Ein Kind wischt 150 bis 400 ms — genau so lange
passierte vorher nichts. `ausgeloest` sperrt den Zeiger danach bis zum
Loslassen, damit ein langer Wisch **einen** Zug macht und nicht bei jeder
weiteren Fingerbewegung noch einen. Dazu erkennt ein kurzer, schneller
Schnipser (halbe Strecke in unter 90 ms) ebenfalls als Wischen, und die
Tipp-Grenze ist von 350 auf 700 ms hoch — in Line Fall ist Tippen das
Drehen, und ein länger liegender Finger fiel vorher stillschweigend durch.

**Das Steuerkreuz nimmt die ganze Fläche.** Vorher war es ein 3×3-Raster mit
fünf leeren Feldern: Wer die Ecke zwischen „oben" und „rechts" traf, löste
nichts aus — über die halbe Fläche. Jetzt entscheidet der Winkel zur Mitte,
mit einem kleinen Totbereich in der Mitte (sonst löst ein aufgelegter Daumen
eine zufällige Richtung aus).

**Ghost Chase war die teuerste Stelle im Projekt.** 462 Zellen, sechzigmal je
Sekunde neu abgeglichen, für ein Raster, das sich fast nie ändert — rund
28 000 React-Elemente je Sekunde. Ein `useMemo` auf `[labyrinth, punkte,
kraftpillen]` senkt das um über 95 %.

**Tonhöhe steigt mit der Serie.** `sfx` nimmt ein optionales zweites
Argument in Halbtönen, gedeckelt bei einer Oktave. Rückwärtskompatibel, alle
bisherigen Aufrufe klingen unverändert. Benutzt von Block Burst (Kombo),
Line Fall (Vierfach-Serie) und Pair Up (gefundene Paare).

Nebenbei: `sfx` prüft jetzt auf `state !== 'running'` statt nur auf
`suspended` — iOS versetzt die Tonausgabe beim App-Wechsel in `interrupted`,
und danach blieb die App stumm.

**Der Punktestand in der Kopfzeile zählt hoch**, statt zu springen
(`useHochzaehlen` in `Spielrahmen.tsx`). Eine Datei, wirkt in allen Spielen.
Nur nach oben — eine rückwärts zählende Zahl sähe aus wie ein Fehler.
Vorgelesen wird der echte Wert, nicht die Zwischenzahlen.

**Textauswahl und iOS-Lupe** sind global unterdrückt (`user-select`,
`-webkit-touch-callout`). Wer beim schnellen Tippen zu lange liegen bleibt,
bekam sonst die Lupe über dem Spielfeld.

## Die Startseite

Der Titel heißt „Florians Spielesammlung" und ist **zweizeilig**. Nicht aus
Geschmack: Einzeilig passt er auf einem 375 Pixel breiten iPhone nur bis
29,5 Pixel Schriftgröße — kleiner als die 30 Pixel vorher. Der längere Name
hätte den Titel also schrumpfen lassen.

Die räumliche Wirkung kommt aus **zwei Ebenen** (`.wortmarke-wort` in
`index.css`): Das Grundelement macht Seitenflächen aus gestapelten Schatten
plus eine dunkle Kontur, `::after` legt die Verlaufsfläche darüber. Beides
auf einem Element geht nicht — `text-shadow` wird hinter der Füllung
gezeichnet, und bei durchsichtiger Füllung (die braucht der eingeclippte
Verlauf) scheint die Extrusion durch den Buchstaben. Keine externe
Schriftdatei, die App läuft offline.

Alles ist **mittig**, auch die letzte Kachelreihe — linksbündig hing sie
sichtbar schief im Regal. Die Kachelgröße wächst mit dem Bildschirm
(`--kachel`), gedeckelt bei 80 Pixel; darüber wirken sie nicht mehr wie
App-Symbole. Die Untergrenze ist so gewählt, dass auf einem 375er-iPhone
**vier** Kacheln je Reihe passen: Bei drei bräuchten vierzehn Spiele fünf
Reihen, und die Seite fing an zu scrollen.

Einstellungen ist ein Zahnrad ohne Rahmen (44 × 44 bleibt), die Bestenliste
ein Band unter dem Regal, der Tastatur-Hinweis nur noch auf breiten Geräten.
Damit endet der Inhalt bei 705 von 812 Pixeln — **107 Pixel Reserve** statt
vorher 39, genug für die Aussparung auf einem iPhone mit Notch.

Beim Öffnen fliegen Kopf, Weiterspielen-Karte und Kacheln gestaffelt ein.
Zwei Fallen dabei: `.ruhig` kürzt nur die Dauer, **nicht die Verzögerung** —
die muss eigens auf 0, sonst steht eine Kachel erst unsichtbar herum und
springt dann auf. Und der Auftritt gehört an die Kachel-Umhüllung, nicht an
den Knopf: Tailwind setzt `active:scale-95` über die eigenständige
`scale`-Eigenschaft, eine Animation darauf würde sie überschreiben.


## Aufgeräumt nach dem Audit

**Alle vierzehn Spiele haben jetzt einen Startbildschirm.** Der gemeinsame
Teil steht in `core/Startbildschirm.tsx`; ein Spiel liefert nur noch
Verlauf, Deko-Teile und Untertitel. Vorher hatten acht Spiele denselben
Aufbau je einzeln abgetippt (mit kleinen Abweichungen: mal `<h1>`, mal
`<h2>`, mal mit 🏆, mal ohne `autoFocus`), und vier hatten gar keinen —
obwohl `bestScore` und `istErsteRunde` längst in `GameProps` bereitliegen.
Die Schnittstelle musste dafür nicht angefasst werden, die Felder wurden nur
nie benutzt.

**Das „+N" über dem Feld** ist jetzt ein Baustein (`core/Punktegewinn.tsx`)
und läuft in Block Burst, Line Fall, Ghost Chase und Snake Rush. Bei Ghost
Chase mit Schwelle 50: Jeder eingesammelte Punkt gibt zehn Zähler, ein Popup
je Punkt wäre ein Dauerflimmern quer über das Labyrinth — erst Kraftpille
und gefressener Geist sind eine Meldung wert. Line Fall zeigte die Punktzahl
vorher überhaupt nicht im Spielbereich.

**Ein Knopfstil statt fünf.** `.spielknopf` bringt jetzt Radius, Rand,
Fläche, Antipp-Reaktion und die Deaktiv-Blässe selbst mit; die Spiele setzen
nur noch die Klasse. **Wichtig: `inline-flex`, nicht `inline-grid`** — ein
Knopf wie „← Zurück" hat zwei Kinder, und ein Raster stapelt sie
untereinander. `.spielknopf-gross` ist die Variante für den Weiter-Knopf,
ohne Rand (die Knöpfe bringen ihre eigene kräftige Füllung mit).

**Ein Brett-Look statt vier.** `.spielbrett-rahmen` gibt allen Brettern
denselben Radius und Rahmen. Der Rahmen ist ein **innerer Schatten**, kein
`border`: `.spielbrett` rechnet seine Breite aus `100cqw`/`100cqh`, und ein
echter Rand addiert zwei Pixel — auf 375 × 560 kann genau das den Ausschlag
geben. Die Rahmenfarbe kommt aus `--spielfarbe`.

**Color Pour benutzt endlich das gemeinsame Gerüst** (`.spielseite`,
`.spielbuehne`/`.spielbrett`, `.nur-bei-platz`). Es war das einzige Spiel,
das scrollen durfte, und rechnete seine Brettgröße selbst.

**Die nachgebauten Steuerkreuze sind weg.** Snake Rush und Merge Up hatten
den Baustein von Hand kopiert, weil sie eine flachere Anordnung brauchen —
den Kopien fehlten `touch-none`, `select-none` und die Unterdrückung des
Kontextmenüs, und dadurch öffnete langes Drücken auf einem Pfeil das
iPhone-Auswahlmenü. `Steuerkreuz` kennt die Anordnung jetzt selbst
(`kompakt`). Die Winkel-Trefffläche gibt es dort bewusst nicht: In der
flachen Anordnung liegt die Mitte des Kastens genau auf dem Pfeil nach
unten.

Nachgemessen: **alle vierzehn Spiele passen auf 375 × 560 ohne Scrollen.**

## Dash City — der 3-D-Läufer

Ronnis Wunsch, wörtlich: „ein richtiges 3-D-Spiel, so was wie Subway
Surfers" — und ausdrücklich kein Pseudo-3-D. Damit ist **three.js** die
einzige größere Bibliothek im Projekt neben React.

**Der Preis trifft nur dieses eine Spiel.** `szene.ts` wird in
`DashCity.tsx` per `await import(...)` nachgeladen und landet in einem
eigenen Brocken:

| Brocken | gzip | wann geladen |
|---|---|---|
| Hauptbündel (Hülle + 19 andere Spiele) | 146 kB | immer |
| `three` | 130 kB | nur bei Dash City |
| `szene` | 2 kB | nur bei Dash City |

Wer Snake Rush spielt, lädt three.js nie. Das war die Bedingung, unter der
die Bibliothek überhaupt vertretbar ist.

**Dafür musste der Service Worker umgebaut werden.** Er legte bisher nur
`/`, `index.html` und das Manifest in den Vorrat; alles andere kam beim
ersten Abruf dazu. Solange es genau ein Bündel gab, fiel das nicht auf.
Mit einem zweiten, erst später geladenen Brocken wäre Dash City das einzige
Spiel gewesen, das **offline fehlt** — installiert, aber nie mit Netz
gestartet, und im Flugzeug bleibt der Bildschirm schwarz. Jetzt erzeugt
`vite.config.ts` beim Bauen eine `dateiliste.json` (die Dateinamen tragen
einen Prüfwert und ändern sich bei jedem Bau), und der Service Worker holt
beim Einrichten alles auf einmal. Schlägt das fehl, bricht die Einrichtung
**nicht** ab — dann bleibt es beim alten Verhalten.

Weitere Entscheidungen:

- **`szene.ts` ist der einzige Ort im Projekt, der three.js kennt, und
  enthält keine einzige Spielregel.** Sie bekommt einen `Lauf` gereicht und
  stellt ihn dar. Alles Rechnende steht in `logik.ts` und ist ohne Browser
  geprüft. Genau diese Trennung war die eigentliche Bedingung — nicht die
  Dateigröße: Läge die Spiellogik in der Bibliothek, wäre sie der Prüfung
  entzogen, und das bricht die Kernregel des Projekts.
- **Der Fairness-Test ist der wichtigste.** Ein Endlosläufer wird schneller,
  bis er unspielbar ist. Erzeugt er dabei ein Muster, das gar nicht mehr zu
  schaffen ist, stirbt man durch Zufall statt durch eigenen Fehler.
  `istPassierbar` prüft zweierlei: nie alle drei Spuren durch Mauern dicht,
  und nie Hürde und Balken auf derselben Spur (springen und rutschen zugleich
  geht nicht). Der Test läuft über **15 000 Abschnitte**.
- Hindernisse entstehen aus der **Abschnittsnummer**, nie aus der
  verstrichenen Zeit. Nur so ergibt derselbe Lauf mit derselben Eingabefolge
  immer dasselbe Ergebnis — dafür gibt es einen eigenen Test.
- **Der Zeitschritt ist auf 50 ms gedeckelt.** Nach einem App-Wechsel wäre
  er sonst mehrere Sekunden groß, und die Figur führe blind durch ein Dutzend
  Hindernisse.
- **Der Lauf liegt in einer Ref, nicht im React-Zustand.** 60 Bilder je
  Sekunde als `setState` hieße 60-mal je Sekunde den Baum durchrechnen,
  während three.js daneben zeichnet. Nach außen gemeldet wird viermal je
  Sekunde.
- Fürs alte iPad: `devicePixelRatio` auf 1,5 gedeckelt, keine
  Kantenglättung, keine echten Schatten (ein dunkler Fleck unter der Figur,
  der beim Springen kleiner wird — daran sieht man die Höhe), geteilte
  Geometrien und Werkstoffe, fester Vorrat wiederverwendeter Körper statt
  ständigem Neuanlegen.
- `aufraeumen()` gibt beim Verlassen **alles** frei. Ohne das bliebe bei
  jedem „Nochmal" ein kompletter Satz Geometrien im Grafikspeicher liegen —
  auf einem iPad nach ein paar Runden das Ende.
- Die Kamera stand zuerst zu dicht hinter der Figur; sie nahm das untere
  Drittel ein und man sah kaum Straße voraus. Bei einem Läufer ist Sichtweite
  nach vorn gleichbedeutend mit **Reaktionszeit** — das ist kein Geschmack,
  sondern Spielbarkeit.
- **Nicht duellfähig**: keine Levelnummer.

## Box Push — Besonderheiten

Das erste Spiel, in dem man einen Zug wirklich **verbauen** kann: Kisten
lassen sich nur schieben, nie ziehen. Steht eine in der Ecke, bleibt sie
dort.

- **Die Level sind von Hand gebaut, nicht gewürfelt** (`level.ts`, als
  Textraster wie das Labyrinth in Ghost Chase). Gute Schiebe-Rätsel leben
  von einer Idee — „die Kiste muss erst nach links, obwohl sie nach rechts
  soll" —, und die kann kein Zufall. Ein Erzeuger liefert entweder Triviales
  oder Unlösbares.
- Dafür beweist ein **Suchlauf im Test**, dass jedes Level lösbar ist. Beim
  ersten Durchlauf waren prompt vier von zwölf kaputt — beim Selbertesten
  hätte ich das erst nach zwanzig Minuten Grübeln gemerkt, und ein Kind
  schriebe den Fehler sich selbst zu.
- **Der Suchlauf geht über Schübe, nicht über Einzelschritte.** Das ist kein
  Feinschliff, sondern der Unterschied zwischen „läuft" und „läuft nicht":
  Über Schritte kam er bei vier Kisten auf über eine Million Zustände und
  gab auf, obwohl das Level lösbar war. Der Kniff: Wo genau der Spieler
  steht, ist egal — es zählt nur, welchen Bereich er erreicht. Als
  Kennzeichen dient das kleinste erreichbare Feld.
- **Zurück ist Teil der Regeln, nicht Komfort.** Ohne ihn müsste ein Kind
  bei jeder verschobenen Kiste von vorn anfangen, und Fehler sind hier der
  Normalfall. Er zählt als eigener Zug — sonst könnte man beliebig lange
  probieren und trotzdem die volle Punktzahl abräumen.
- Schub und Schritt klingen verschieden. Daran hört man, dass man etwas
  bewegt hat, ohne hinzusehen.
- **Duellfähig**, und zwar besonders sauber: Die Level stehen fest, gleiche
  Nummer heißt also wirklich dasselbe Rätsel.

## Tap Rush — Besonderheiten

Ronnis Idee, samt Farbverlauf: „Am Anfang rot, umso mehr du tippst wird's
grün, hellblau ist schon gut, und Regenbogen heißt übelst schnell."

- **Die Uhr startet mit dem ersten Tipp**, nicht mit dem Öffnen. Sonst
  verliert man Zeit, während man sich zurechtsetzt — bei fünf Sekunden wäre
  das die halbe Runde. Dafür gibt es einen eigenen Test.
- Das Tempo kommt aus einem **gleitenden Fenster** über die letzten 1,2
  Sekunden. Kürzer, und die Farbe zappelt bei jedem einzelnen Tipp; länger,
  und sie hinkt hinterher, sodass man den Zusammenhang gar nicht mehr merkt.
  Das Fenster wirft alte Tipps laufend weg — die Liste bleibt kurz, auch
  über eine ganze Minute.
- **Punkte sind Tipps je zehn Sekunden**, nicht die reine Anzahl. Sonst
  gewönne in der Bestenliste immer, wer die Minute gewählt hat, und die
  Liste sagte nur noch aus, wer am längsten gespielt hat. So sind alle vier
  Längen vergleichbar — ein Test prüft genau das.
- Die Grenzen (2,5 / 4,5 / 6,5 Tipps je Sekunde) sind an einem Kind
  ausgerichtet, nicht an einem Rekordhalter. Wären sie höher, bliebe das
  Feld die ganze Runde rot, und die Farbe wäre keine Rückmeldung mehr,
  sondern nur Deko.
- **Der Regenbogen wandert seitlich, die Helligkeit bleibt gleich.** Das ist
  Pflicht, nicht Geschmack: Ganzflächige Hell-Dunkel-Wechsel sind im ganzen
  Projekt tabu, und das Feld nimmt hier den halben Bildschirm ein. Ein
  Durchlauf dauert drei Sekunden — 0,33 Hz, weit unter der 1,7-Hz-Grenze.
- **Die große Zahl färbt mit** (Ronnis Zusatzwunsch) und wird mit jeder
  Stufe heller — auf der höchsten selbst zum Regenbogen, aber **gegenläufig**
  zum Grund. Gleichläufig verschwand sie genau dann, wenn man am schnellsten
  war. Und kein `text-shadow` an der eingeclippten Zahl: Der wird hinter der
  durchsichtigen Füllung gezeichnet und scheint durch — dieselbe Falle wie
  bei der Wortmarke auf der Startseite. Der dunkle Rand kommt über
  `filter: drop-shadow`.
- **Nicht duellfähig**: Es gibt keine Levelnummer. Ein Duell bräuchte hier
  nur dieselbe Rundenlänge — eine eigene Sache, bewusst nicht mit
  hineingemischt.

## Das Duell

Zwei Angemeldete spielen **dasselbe Level**, der höhere Punktestand gewinnt.
Rundenbasiert, nicht gleichzeitig: Niemand muss warten, bis der andere online
ist — und es kommt ohne Dauerverbindung aus, also ohne den einen Baustein,
den dieses Projekt bewusst nicht hat.

**Die Schnittstelle wurde dafür erweitert**, zum zweiten Mal überhaupt (nach
`gewonnen` bei `onGameOver`). Beide Zusätze sind optional und ändern für
bestehende Spiele nichts:

- `GameProps.level?: number` — ein **festgelegtes** Level. Ist es gesetzt,
  spielt das Spiel genau dieses, merkt sich hinterher **kein** nächstes und
  sperrt seine Level-Pfeile.
- `GameApi.duellFaehig?: boolean` — sagt der Hülle, dass dieses Spiel
  `level` auch wirklich auswertet.

**Nur duellfähige Spiele werden angeboten**, zurzeit sieben: Color Pour,
Quiz Time, Brain Blitz, Word Play, Pair Up, Even Cut, Flow Link. Bei einem
Spiel mit frischem Zufall je Runde (Snake Rush, Block Burst, Ring Rise) hinge
der Sieg am Glück statt am Können, und ein Duell wäre nichts wert. Blade Toss
fällt ebenfalls raus: Dort steigt das Level **innerhalb** einer Runde.

Weitere Entscheidungen und warum:

- **Das Level würfelt der Server**, nicht die App. Käme es von dort, könnte
  man sich sein Lieblingslevel aussuchen und dem Gegner ein schweres geben.
- **Kein „Nochmal" im Duell.** Jede Seite spielt ihr Level genau einmal,
  sonst könnte man beliebig oft nachbessern. Die Funktion
  `spiel_duell_melden` lehnt einen zweiten Versuch derselben Person ab —
  die App-Seite allein wäre keine Sicherung.
- **Duelle laufen nicht über die Ausgangsschlange.** Ein Ergebnis später
  nachzureichen klingt erst gut, wäre aber heikel: Der Gegner sähe tagelang
  „hat noch nicht gespielt", obwohl längst gespielt wurde. Ein Duell braucht
  im Moment des Meldens Netz, und wenn keins da ist, sagt die App das offen.
  Die normale Bestenliste bleibt voll offline-fähig.
- Eine Duellrunde zählt **zusätzlich** ganz normal für die Bestenliste.
  Gespielt ist gespielt.
- Höchstens zehn offene Herausforderungen je Person — sonst könnte jemand
  einem anderen hundert Duelle in die Liste schütten.
- `spiel_duell` hat **keine** insert/update-Regel. Angelegt und geändert wird
  ausschließlich über die beiden `security definer`-Funktionen, die selbst
  prüfen, wer da ruft. Der Sicherheitsprüfer meldet die beiden deshalb als
  Warnung — das ist hier genau die Absicht, wie bei `spiel_ergebnis_melden`.
- `shell/duell.ts` rechnet die **Sicht** aus: Dieselbe Zeile bedeutet für den
  Herausforderer etwas anderes als für den Gegner. Genau da entstehen sonst
  die Fehler, bei denen jemand „gewonnen" liest, obwohl er verloren hat —
  dafür gibt es eigene Tests.

## Anmeldung und Bestenliste über alle Geräte

Mehrere Kinder, ein Spielname statt einer E-Mail-Adresse, eine Bestenliste
über alle. Läuft über **Supabase**, und zwar im schon vorhandenen
FitHold-Projekt (`wotdzumntewqmwrtykyb`) — Ronnis Wunsch, kein zweites
Projekt. Alles Eigene trägt deshalb das Präfix `spiel_`; FitHolds Tabellen
werden nicht angefasst.

**Der eiserne Grundsatz: `localStorage` ist die Wahrheit, der Server ist ein
Spiegel.** Kein Spielablauf wartet je auf das Netz, und wer sich nie
anmeldet, bekommt exakt die App von vorher. `GameApi`/`GameProps` sind
unverändert geblieben — kein einziges Spiel weiß von alldem.

Vier Dateien, klar getrennt:

| Datei | Darf | Darf nicht |
|---|---|---|
| `shell/server.ts` | HTTP zu Supabase | irgendetwas speichern |
| `shell/speicher.ts` | `localStorage` | ins Netz |
| `shell/konto.ts` | beides zusammenbinden | anzeigen |
| `shell/KontoSeite.tsx` | anzeigen | rechnen |

Die wichtigsten Entscheidungen und **warum**:

- **Kein `@supabase/supabase-js`.** Gebraucht werden fünf Endpunkte. Der
  entscheidende Grund ist aber nicht die Größe: Die Bibliothek legt ihre
  Sitzung in eigenen `localStorage`-Schlüsseln ab und bringt einen eigenen
  Erneuerungs-Zeitgeber mit. Das bricht die Regel, dass `speicher.ts` der
  einzige Ort mit `localStorage`-Zugriff ist. Man müsste ihr also ohnehin
  einen eigenen Speicher unterschieben — und hätte dann die Bibliothek
  *und* den Eigenbau.
- **Der Name wird zur Adresse** (`jörg` → `joerg@spieler.klarvorteil.de`).
  Supabase Auth kennt Passwörter nur zusammen mit einer E-Mail-Adresse. Die
  Umlaut-Abbildung in `alsAdresse` muss **verlässlich** sein: Aus „Jörg"
  muss immer dieselbe Adresse werden, sonst kommt er nach einem
  Browserwechsel nicht mehr in sein Konto.
- **Registriert wird über eine Edge Function** (`spiel-registrieren`), nicht
  direkt. Nur mit dem Dienstschlüssel lässt sich ein Konto ohne
  Bestätigungsmail anlegen — die Adresse ist ja erfunden, niemand bekäme je
  eine Mail. Der Dienstschlüssel darf niemals ins ausgelieferte JavaScript.
  Dort wird auch der Einladungscode geprüft (`FLORIAN2026`, höchstens fünf
  neue Konten am Tag).
- **Der öffentliche Schlüssel steht im Bundle und das ist richtig so.** Was
  jemand damit darf, entscheiden allein die Zugriffsregeln in der Datenbank.
  `auth.users` ist projektweit — die Regeln hängen deshalb an der
  Mitgliedschaft in `spiel_profil`, **nicht** an „ist angemeldet".
  Sonst käme jedes FitHold-Konto an die Spieldaten.
- **Ausgangsschlange statt Warten.** `ergebnisEintragen` schreibt die Runde
  sofort lokal *und* in eine Warteschlange und gibt deren Schlüssel zurück.
  Der Rahmen fragt damit den Platz ab; klappt es nicht, bleibt der Eintrag
  liegen und geht beim nächsten Start, beim `online`-Ereignis oder beim
  Zurückkommen in die App mit hoch. Jeder Eintrag hat einen eigenen
  Schlüssel und der Server darauf eine Eindeutigkeitsregel — ein zweiter
  Versuch ist deshalb völlig ungefährlich.
- Der Schlüssel muss **von der Runde** kommen, nicht „irgendeiner dieses
  Spiels aus der Schlange". Sonst zeigt der Dialog den Platz einer alten,
  offline aufgelaufenen Runde.
- **Die Sperre in `abgleichen` steht vor dem ersten `await`.** Dahinter wäre
  sie wirkungslos — Start, Netzrückkehr und Rundenende können in derselben
  Millisekunde auslösen.
- **Abmelden steht klein und unten.** Ohne E-Mail-Adresse gibt es kein
  „Passwort vergessen". Wer sich abmeldet und das Passwort nicht mehr weiß,
  kommt nicht zurück. Aus demselben Grund lässt „alle Punktestände löschen"
  die Sitzung ausdrücklich stehen — dafür gibt es einen Test.
- **Wenn die Anmeldung direkt nach dem Anlegen scheitert**, bekommt das Kind
  einen eigenen Satz („Dein Konto ist fertig … melde dich an"). Ohne den
  liefe der zweite Versuch auf „Diesen Namen hat schon jemand", und niemand
  verstünde warum.
- Die Bestenlisten-Seite holt alles in **drei** Anfragen nebeneinander, nicht
  in sechzehn hintereinander: Gesamtwertung, die besten Drei **aller** Spiele
  auf einmal (`platz=lte.3` — Postgres schiebt keine Bedingung durch eine
  Fensterfunktion, die Plätze stimmen also) und die eigenen Plätze.
  Der letzte Stand liegt im Speicher; ohne Netz steht eine echte Liste da
  und darunter „Stand: gestern 18:04" statt eines hängenden Ladekreisels.
- Spiele **ohne** Eintrag stehen nicht als vierzehn leere Kästen da, sondern
  unten in einer Zeile („Hier ist der erste Platz noch frei: …").
- `bestwert()` ist jetzt das Maximum aus Gerät und Server. Die Bedeutung
  ändert sich (über alle Geräte statt nur dieses), die Signatur nicht — für
  Block Bursts Startbildschirm bleibt alles wie es war.

**Ein Fund nebenbei, der alle Spiele betraf:** Das Rundenende lag *unter*
dem Spielbrett. `.spielbuehne > *` gibt dem Brett `z-index: 1`, und ein
positioniertes Element mit Stufe 1 wird über einem mit `auto` gezeichnet —
ganz gleich, was weiter unten im Baum steht. Der Dialog in `Spielrahmen.tsx`
braucht deshalb ein eigenes `z-20`.

**Noch nicht gebaut:** Battle, Co-op, Avatare. Die Tabellen dafür gibt es
noch nicht.

## Ring Rise — Besonderheiten

Ronnis Wunsch nach einem Spiel „wie Color Switch". Der Name ist bewusst ein
anderer — „Color Switch" heißt ein bekanntes Vorbild, und hier gilt die
Regel oben: das Prinzip ist frei, der Name nicht. Interne `id` ist
`farbringe`.

- **Die Welt wächst nach oben.** In der ganzen Logik ist ein größeres `y`
  weiter oben; erst die Anzeige dreht das um (`bildY` in `RingRise.tsx`).
  Das spart die Vorzeichenfehler, die sonst zwischen „fällt" und „steigt"
  ständig entstehen.
- **Ein Ring ist ein Tor, kein Schlauch.** Die erste Fassung prüfte unten
  *und* oben — und war damit unspielbar: Unten und oben liegen einander
  gegenüber, das sind bei vier Bögen immer **zwei verschiedene** Farben.
  Beide zu treffen ginge nur, wenn sich der Ring während der Durchquerung um
  exakt eine halbe Umdrehung dreht. Jetzt zählt nur der untere Rand, und
  zwei kleine weiße Striche zeigen diese Stelle an — eine Regel, die man
  erraten muss, fühlt sich unfair an, auch wenn sie es nicht ist.
- **Der Farbwechsler hängt direkt über seinem Ring**, nicht in der Mitte
  zwischen zweien. In der Mitte bekam man die neue Farbe siebzehn Einheiten
  vor dem nächsten Tor — weniger, als ein Sprung trägt. Man konnte gar nicht
  mehr abwarten, sondern raste zwangsläufig hinein.
- **Farbe ist nicht das einzige Merkmal.** Jede der vier Farben hat ein
  eigenes Strichmuster (durchgezogen, lang, kurz, gepunktet), und die Kugel
  trägt dasselbe Muster als Ring um sich herum. Bei einem Spiel, das aus der
  einen Frage „passt meine Farbe dorthin?" besteht, wäre reine
  Farbunterscheidung für farbfehlsichtige Kinder unspielbar — und Rot/Grün
  ist die häufigste Schwäche.
- **Der wichtigste Test ist ein einfacher Spieler.** Er schwebt unter dem
  nächsten Ring und schießt erst hoch, wenn seine Farbe unten steht. Beide
  Konstruktionsfehler oben hat genau dieser Test aufgedeckt, nicht das
  Ausprobieren im Browser: Er kam über einen einzigen Ring nicht hinaus.
  Jetzt schafft er je nach Saat 4 bis 42 Ringe.
- Eigener Tastatur-Listener statt `useInput`, gleiche Begründung wie bei
  Blade Toss: `useInput` meldet ein Antippen erst beim Loslassen, zusammen
  mit `onPointerDown` käme jeder Tipp zweimal an — und ein doppelter Sprung
  wirft die Kugel viel zu hoch.

## Even Cut — Besonderheiten

Eine Form, ein Wisch, zwei möglichst gleiche Hälften. Vorbild ist Perfect
Slice; der Name ist wie immer ein eigener. Interne `id` ist `halbieren`.

- **Alle Formen sind konvex, und das ist eine Bedingung, keine
  Bequemlichkeit.** Nur bei einer konvexen Form ergibt ein gerader Schnitt
  **genau zwei** Teile. Bei einer eingedellten Form (Stern, Mond) kann
  dieselbe Gerade drei oder mehr Stücke abtrennen — dann stimmt weder die
  Anzeige noch die Wertung. Abwechslung kommt stattdessen über Eckenzahl,
  Streckung und Drehung.
- Der Erzeuger verteilt die Ecken **winkelmäßig aufsteigend** auf einem
  gedehnten Kreis und ändert nur ihren Abstand zur Mitte. Damit ist die Form
  von selbst konvex; ein Zufallshaufen von Punkten bräuchte eine
  Hüllenberechnung, die niemand gebraucht.
- **Ohne Drehung wäre das Spiel trivial** — bei jeder ungedrehten Form liegt
  eine Symmetrieachse waagerecht oder senkrecht, man könnte immer stumpf
  gerade durchziehen.
- Der schärfste Test ist „**nichts darf verloren gehen**": 40 Formen mal 12
  zufällige Geraden, und jedes Mal muss die Summe der beiden Stücke wieder
  die ganze Fläche ergeben. Ein Fehler in der Klipp-Schleife fällt bei einem
  einzelnen sauberen Schnitt gar nicht auf, hier sofort.
- Dazu ein Test, der für **jede** Form per Einschachtelung eine wirklich
  halbierende Gerade findet — ohne diese Zusicherung wäre das Spiel unfair.
- Punkte sind absichtlich streng: Ab zehn Prozent Abweichung gibt es nichts
  mehr. Ein Schnitt „irgendwo durch" soll sich nicht schon wie ein Treffer
  anfühlen.

## Flow Link — Besonderheiten

Gleichfarbige Punkte verbinden, ohne sich zu kreuzen — und am Ende muss
jedes Feld belegt sein. Interne `id` ist `verbinden`.

- **Erst die Lösung bauen, dann die Aufgabe daraus ableiten.** Ein
  ausgedachtes Rätsel kann unlösbar sein (beim Farbsortierer braucht es
  dafür einen eigenen Suchlauf). Hier wird zuerst ein Weg gebaut, der jedes
  Feld genau einmal berührt, dann in Stücke zerschnitten; die Stückenden
  werden die Punkte. Lösbar **und** vollständig füllbar, ohne einen einzigen
  Suchlauf.
- Der Weg entsteht aus dem Schlangenweg plus vielen **Rückbissen**
  („backbite"): ein Wegende nehmen, einen beliebigen Gitternachbarn suchen,
  das Stück dahinter umdrehen. Das Ergebnis ist immer wieder ein gültiger
  Weg — das Verfahren **kann** gar keinen ungültigen Zustand erzeugen. Genau
  deshalb ist es hier richtig.
- Jedes Stück bekommt mindestens zwei Felder, sonst lägen beide Punkte eines
  Paares aufeinander.
- **„Alle Felder voll" ist die eigentliche Aufgabe.** Ohne diese Bedingung
  wäre fast jedes Brett mit ein paar geraden Strichen erledigt.
- Läuft man über einen fremden Weg, wird der dort **gekappt** statt den Zug
  zu verbieten. Alles andere fühlt sich an, als klemme das Spiel.
- Farbe ist nicht das einzige Merkmal: Jeder Punkt trägt ein Zeichen (Kreis,
  Quadrat, Dreieck, Raute, Kreuz, Stern). Die beiden Punkte eines Paares
  liegen weit auseinander — man kann sie also nicht nebeneinanderhalten und
  Farbtöne vergleichen.
- Dass es neben dem gedachten Weg noch andere Lösungen geben kann, ist
  ausdrücklich in Ordnung: Für ein Kind zählt „alle verbunden und alles
  voll". Bei Nonogrammen wäre das anders — deshalb steht Pixel Paint
  weiterhin auf der zurückgestellten Liste.

## Wenn Animationen „einfach weg" sind

Ronni meldete drei Dinge auf einmal: In Block Burst löse sich keine Reihe
mehr auf („nur kurz einmal rausgezoomt"), in Color Pour komme kein Konfetti,
und der Hinweis-Puls sei verschwunden. Dahinter steckten **zwei** Ursachen,
und beide sind es wert, gemerkt zu werden.

**1. Die Systemeinstellung hat den Schalter überstimmt.** Neben `.ruhig`
stand in `index.css` eine ungefilterte
`@media (prefers-reduced-motion: reduce)`-Regel. Auf einem iPhone mit
„Bewegung reduzieren" waren damit **alle** Animationen tot — und der
Schalter in den Einstellungen konnte sie nicht zurückholen. Die Regel ist
weg; die Systemeinstellung wirkt weiterhin, aber nur noch als **Startwert**
des Schalters (`einstellungenLesen`). Wer die Systemeinstellung an hat, darf
in dieser einen App trotzdem Bewegung erlauben.

*Merksatz:* Gibt es für etwas einen Schalter in der App, darf keine
Medienabfrage daneben dasselbe unabänderlich festlegen.

**2. Block Burst zerbröselte in Weiß.** `setBlitzZellen` und `setZ` landen
im selben Rendern — das Feld ist beim Start der Animation also längst leer,
und übrig blieb ein weißes Quadrat, das kurz aufblitzte. Die Steine
verschwanden schlagartig; genau das beschreibt „die Animation ist komplett
weg". Die abgeräumten Zellen führen ihre **Farbe** jetzt mit, wie Line Fall
es mit `geloescht.zeilen[].farben` seit jeher macht. Nachgemessen: 16
zerbröselnde Zellen in vier verschiedenen Farben statt nur Weiß.

**3. Der Hinweis-Puls war da, aber unsichtbar.** `.linie-moeglich` pulste
über einen **äußeren** Schein. Im Raster stoßen die Zellen aneinander, die
Nachbarn rechts und unten kommen später im Baum und übermalen ihn einfach.
Jetzt ein innerer Ring. *Merksatz:* In einem dichten Raster ist ein äußerer
`box-shadow` verlorene Mühe.

**4. Das Rundenende lag unter dem Spielbrett.** `.spielbuehne > *` gibt dem
Brett `z-index: 1`, und ein positioniertes Element mit Stufe 1 wird über
einem mit `auto` gezeichnet — ganz gleich, was weiter unten im Baum steht.
Der Dialog in `Spielrahmen.tsx` hat deshalb `z-20`. Das betraf **jedes**
Spiel mit Bühne, aufgefallen ist es bei Blade Toss, weil dort der Stamm
groß und mittig sitzt.

## Color Pour — Glas und Gießen

- **Oben bleibt Luft** (`LUFTRAUM_OBEN` in `geometrie.ts`). Ein randvolles
  Glas liest sich als farbiger Balken, nicht als Flüssigkeit. Die Schichthöhe
  kommt jetzt aus **einer** Funktion (`schichthoehe(kapazitaet)`), die
  Anzeige und Gieß-Animation gemeinsam benutzen — zwei getrennte Formeln
  wären irgendwann auseinandergedriftet.
- **Das Gießen dauert länger.** Vorher lag der Gieß-Abschnitt zwischen 0,52
  und 0,78 von knapp einer Sekunde, also rund eine Viertelsekunde. In der
  Zeit war der sinkende Füllstand nicht zu sehen; es wirkte, als sei die
  Quelle erst am Schluss schlagartig leer. Jetzt über ein Drittel der Zeit.
- **Die Flüssigkeit rutscht zur Öffnung** (`zumRandGeneigt` an `Roehrchen`).
  Vorher klebte sie beim Ausgießen am **geschlossenen** Ende — also oben,
  während unten an der Ausgusskante leeres Glas stand. Stufenlos mit dem
  Kippwinkel, nicht als Umschalter bei 90°: Ein Sprung mitten im Kippen wäre
  auffälliger als der Fehler, den er behebt.

## Ausliefern

Läuft auf dem **Hetzner-Webpaket** unter `spiele.klarvorteil.de`, nicht mehr
auf Netlify. Grund: Das Netlify-Freikontingent lief am 15.08.2026 voll — die
Seite antwortete mit HTTP 503 (`usage_exceeded`) und Deploys wurden
abgelehnt. Das Webpaket ist ohnehin bezahlt und hat kein Kontingent.

`.github/workflows/ausliefern.yml` baut bei jedem Push auf `main`, lässt die
Tests laufen und lädt `dist/` per FTPS hoch. Die Zugangsdaten liegen als
GitHub-Secrets (`FTP_HOST`, `FTP_BENUTZER`, `FTP_PASSWORT`, `FTP_ZIEL`).

**Vorsicht beim `FTP_ZIEL`:** Der Abgleich löscht auf dem Server alles, was
nicht mehr im Bau vorkommt. Zeigt der Pfad aufs Stammverzeichnis, löscht er
die ganze Webseite — deshalb der Prüfschritt im Ablauf.

`public/.htaccess` setzt die eine Regel, auf die es ankommt: `no-cache` für
`sw.js`, `index.html` und das Manifest. Kommt die `sw.js` aus dem
Zwischenspeicher, bemerkt ein installiertes iPad eine neue Fassung nicht.
Eine Umschreibung auf `index.html` braucht die App **nicht** — die Adresse
steht hinter dem Rautezeichen, der Server sieht immer nur `/`.

`netlify.toml` bleibt vorerst liegen, damit während des Umzugs beide Wege
funktionieren.

## Befehle

```bash
npm run dev     # Entwicklungsserver auf http://localhost:5180
npm test        # Tests einmal durchlaufen
npm run build   # Typprüfung und fertige Fassung nach dist/
node werkzeuge/icons-erzeugen.mjs   # App-Symbole neu erzeugen
```
