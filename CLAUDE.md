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
| `radfahren` | Flow MTB |

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
- **`renderer.dispose()` gibt den WebGL-Kontext nicht frei — das war ein
  echter Fehler mit Meldung beim Nutzer.** Ronni: „Dash City lässt sich nicht
  mehr laden, da steht was von einem sehr alten Browser, alle anderen Spiele
  laufen weiter." Die Auslieferung war in Ordnung (alle vier Dateien
  antworteten mit 200), das Gerät auch. Ursache: `dispose()` räumt nur die
  Puffer der Bibliothek ab; der Zeichenkontext der Leinwand bleibt am Leben,
  bis der Browser ihn irgendwann selbst einsammelt — und Safari lässt sich
  damit sehr viel Zeit. Jedes „Nochmal" mountet neu und legt einen neuen an,
  Browser erlauben aber nur acht bis sechzehn gleichzeitig. Danach wirft
  `new WebGLRenderer()`, und man landet in der Fehlermeldung „Der 3-D-Teil
  lässt sich hier nicht starten" — obwohl alles heil ist. `forceContextLoss()`
  vor `dispose()` gibt ihn sofort zurück. *Merksatz:* Wer einen Renderer je
  Runde anlegt, muss den Kontext je Runde erzwungen zurückgeben.
- **Die Kamera ist die wichtigste Einzelentscheidung im ganzen Bild.** Sie
  stand erst zu dicht (Figur im unteren Drittel, kaum Straße voraus), danach
  zu hoch: 3,9 Meter Höhe mit Blick auf 1,2 — also fast zwanzig Grad nach
  unten. Genau das war Ronnis „dreidimensional sieht es noch nicht richtig
  aus": Eine Aufsicht flacht **jede** Perspektive ab, man sah der Figur auf
  den Scheitel, und die Straße lag als riesige graue Fläche im Bild. Jetzt
  2,5 Meter Höhe, 6,2 Meter Abstand, Blick auf 1,75 in 18 Meter Entfernung —
  also beinahe waagerecht. Dadurch türmen sich die Häuser, die Fluchtlinien
  werden steil, und man sieht der Figur auf den **Rücken**. Sichtweite nach
  vorn bleibt trotzdem gleichbedeutend mit **Reaktionszeit** — das ist kein
  Geschmack, sondern Spielbarkeit.
- **Laternen und Bäume am Bordstein sind der zweitwichtigste Griff.** Ein
  Läufer wirkt schnell und räumlich, wenn dicht an der Kamera etwas
  vorbeizieht. Häuser sind dafür zu weit weg, Hindernisse zu selten. Beide
  stehen **neben** der Fahrbahn und können deshalb nie mit einem Hindernis
  verwechselt werden — ein Torbogen über der Straße wäre der naheliegende
  Griff gewesen, aber der sähe aus wie der Balken, unter dem man durchmuss.
- **Eigene Steuerung statt `useInput`** — und das war ein echter Fehler,
  nicht Geschmack. `useInput` ist für Rasterspiele gebaut: Ein schneller
  oder weiter Wisch nach unten wird dort zu `drop` statt zu `down`. Beim
  Läufer ist genau das aber das Ducken — es kam schlicht **nie** an. Dazu
  bedeutet Antippen dort `select`; bei einem Läufer erwartet jeder, dass
  Tippen springt, und ohne das findet man das Springen gar nicht. Ronnis
  Rückmeldung war entsprechend: „ich kann nicht springen, nicht ducken, gar
  nichts." Jetzt: eigener Zeiger-Listener mit kleinerer Schwelle (18 statt
  24 Pixel), Tippen springt, und ein Hinweis im Bild sagt die drei Gesten
  an — er verschwindet mit der ersten Geste oder nach 4,5 Sekunden.
- Der frühere Hinweistext stand unter dem Spielfeld in `.nur-bei-platz` —
  also genau dort, wo ihn die Regel für kurze Bildschirme ausblendet.
- **Häuser sind Beton, nicht bunt.** Eine Zwischenfassung hatte sie in
  Regenbogenfarben; Rückmeldung: Hochhäuser sollen nach Hochhäusern
  aussehen. Farbe gehört dorthin, wo sie etwas bedeutet — auf Hindernisse
  und Münzen. Sind die Häuser genauso bunt, sucht das Auge länger nach dem,
  worauf es ankommt.
- **Die Figur ist ein Körper, keine Sammlung von Teilen.** Die erste Fassung
  hängte die Arme an Drehpunkte außerhalb des Rumpfes, dazwischen klaffte
  Luft. Bei Grundkörpern ohne Skelett ist **Überlappung** das einzige
  Mittel: Schultern, Schulterbalken, Hals, Gelenkkugeln an jedem Ansatz und
  Hände. Wo zwei Kugeln sich schneiden, sieht das Auge eine durchgehende
  Form.
- **„Es soll keine Windel anhaben."** Die Zwischenfassung hatte an der Hüfte
  eine *quergelegte Kapsel* in Hosenfarbe — einen Körper, der genau dort
  **breiter** war als der Rumpf und nach beiden Seiten ausbeulte. Dazu endete
  der Rumpf selbst in einer Halbkugel. Zwei Wölbungen übereinander an der
  Hüfte ergeben unweigerlich dieses Bild. Drei Griffe beheben es: Der Rumpf
  ist ein **Zylinder** mit waagerechtem Saum, die Hüfte ist **schmaler** als
  der Rumpf und verjüngt sich nach unten, und **jedes Bein hat sein eigenes
  Hosenbein**, das mitschwingt — man sieht den Spalt zwischen den Beinen, und
  ein Spalt ist das genaue Gegenteil einer Windel.
- **Der Rucksack macht den Rücken lesbar.** Man sieht die Figur den ganzen
  Lauf über von hinten; ein Rücken ohne alles ist die langweiligste Ansicht,
  die es gibt. Erster Versuch: heller Kasten mit dunklem Quadrat — das las
  sich als **Haushaltsgerät**. Ein rechteckiger weißer Block mit dunkler
  Klappe *ist* nun mal eine Waschmaschine. Was ihn zum Rucksack macht: eine
  gewölbte Oberseite, ein durchlaufender Gurt und ein **dunkler** Korpus, von
  dem sich die hellen Teile absetzen — nicht umgekehrt.
- **Ein Körper, der knapp innen liegt, stößt durch.** Das Haar war ein
  plattgedrücktes Ei zwei Millimeter unter der Kopfoberfläche. Rechnerisch
  innen — aber eine Kugel aus zwanzig Segmenten liegt an ihrer breitesten
  Stelle rund **drei** Millimeter innerhalb der echten Kugelfläche. Also
  stieß das Haar an zwei Stellen durch den Kopf, und die Figur hatte
  aufgemalte Augenbrauen. Jetzt eine Kugelkappe **sechs Millimeter außen**,
  gedreht in den Nacken: gleichmäßiger Abstand, das kann nicht passieren.
  *Merksatz:* Bei facettierten Körpern nie knapp innen liegen — außen legen.
- **Jedes Hindernis sagt über seine Form, was zu tun ist**, nicht über die
  Farbe: Hürde = flache Absperrung mit Beinen (drüber), Balken = Schild an
  zwei Pfosten, unten offen (drunter), Mauer = geschlossener Container mit
  dunklen Bändern (ausweichen). Wer die Bedeutung erst aus der Farbe
  erschließen muss, erschließt sie bei Tempo 20 zu spät.
- **Während des Laufens rendert React gar nicht.** Punkte, Münzen und
  Tempobalken werden direkt ins DOM geschrieben. Ein `setState` mitten in
  die Zeichenschleife war der Grund, warum es sich nicht ganz flüssig
  anfühlte. Nur der Punktestand für die Kopfzeile der Hülle geht zweimal je
  Sekunde nach außen — das kostet ein paar Textknoten, nicht die Leinwand.
- **Die Steuerung war seitenverkehrt** — und die Ursache steckt tief:
  Die Kamera blickt in **+z**, dadurch liegt Welt-Rechts auf dem Bildschirm
  **links**. Wischen nach links schickte die Figur nach rechts. Gespiegelt
  wird jetzt an genau einer Stelle beim Zeichnen (`bildX` in `szene.ts`);
  die Logik behält ihr Koordinatensystem, dort ist es richtig und die Tests
  hängen daran.
- **Alle Texturen sind im Code gezeichnet** (`texturen.ts`), keine
  Bilddateien. Das ist nicht Sparsamkeit um ihrer selbst willen: Jede Datei
  müsste in den Service-Worker-Vorrat, könnte fehlschlagen und verlängerte
  die erste Ladezeit. Und Texturen sind der größte Einzelsprung in der
  Bildqualität — eine einfarbige Hauswand sieht nach Klotz aus, dieselbe
  Wand mit Fenstern nach Stadt.
- **Die Fahrbahnstreifen sind Teil einer Textur**, nicht mehr 52 einzelne
  Körper. Das Vorbeiziehen entsteht durch Verschieben der Textur — eine
  einzige Zahl je Bild statt 52 Positionen. Das Minuszeichen dabei ist
  wichtig: Ein wachsender Versatz schöbe das Muster sonst von uns weg statt
  auf uns zu.
- **Belag und Markierung sind aber zwei getrennte Ebenen**, und das ist
  keine Kosmetik: Beide brauchen eine völlig andere Wiederholrate. Der Grus
  muss alle vier Meter neu anfangen, ein Strich-Lücke-Takt alle acht. Solange
  beides in *einem* Bild steckte, gaben die Striche die Kachelgröße vor — ein
  Kachelbild war fünfundzwanzig Meter lang, und die Körnung darin so weit
  auseinandergezogen, dass aus Grus Flecken wurden.
- **`(i * 97) % 256` ist kein Zufall.** So wurde die Asphaltkörnung gestreut.
  Beide Achsen wiederholen sich nach 256 Schritten — aus 2600 Durchläufen
  kamen also nur 256 verschiedene Punkte heraus, und der Belag hatte in
  Wahrheit ein regelmäßiges Gitter statt einer Körnung. Jetzt ein richtiger
  Kongruenzgenerator mit fester Saat (`wuerfel` in `texturen.ts`) —
  deterministisch wie gefordert, aber wirklich gestreut.
- **Eine Münze ist eine Scheibe mit Prägung, kein Ring.** Als Torus sah eine
  Reihe davon aus dieser Kameraperspektive aus wie eine Kette Donuts. Jetzt
  ein flacher Zylinder, dessen Geometrie einmal gekippt wird, damit die
  Stirnflächen zur Seite zeigen; die Drehung um die Hochachse lässt ihn
  abwechselnd flach und hochkant erscheinen.
- **Beim Balken lag der weiße Rahmen vor dem roten Schild.** Das Schild stand
  auf `z = +0.04`, der Rahmen bei `z = 0` mit 0,1 Tiefe — dessen vordere
  Fläche lag also einen Zentimeter näher an der Kamera. Von vorn sah man eine
  weiße Platte. Ausgerechnet das Hindernis, das am stärksten über seine Farbe
  auffällt, war dadurch farblos. Die Kamera blickt in **+z**, „vorn" ist also
  **−z** — das gilt für jedes Teil, das vor einem anderen liegen soll.
- `MeshPhongMaterial` statt `MeshLambertMaterial`, Kantenglättung an,
  filmische Tonwertkurve (`ACESFilmicToneMapping`). Bei einer Figur aus
  lauter Kugeln ist der leichte Glanz der Unterschied zwischen „Spielfigur
  aus Kunststoff" und „Pappe".
- **Nicht duellfähig**: keine Levelnummer.

### Die Figur bekam Gelenke

Rückmeldung: „Mach das Männchen realistischer, das soll aussehen wie bei
Subway Surfers." Danach mehrere Runden Feinschliff an derselben Figur,
jede aus einer konkreten Beobachtung:

- **Arme und Beine sind zweiteilig.** Vorher ein einziger starrer
  Drehpunkt an Schulter/Hüfte — eine Steckfigur, egal wie fein die
  Einzelkörper waren. Jetzt ein zweiter Drehpunkt an Ellbogen/Knie: Die
  Ellbogen bleiben beim Laufen dauerhaft angewinkelt, die Knie beugen sich
  im Schritttakt, die Ferse schlägt nach dem Abstoß hinten aus.
- **Schmal in der Taille, breit an den Schultern, nicht umgekehrt.**
  Rückmeldung: „Der Oberkörper sieht aus wie ein Bierfass." Die Breite
  gehört in die Schultern, nicht in den Bauch.
- **Der Armansatz wanderte zweimal.** Beim breiten Rumpf standen die Arme
  als Stummel ab, enger gestellt. Nach dem Verschlanken des Rumpfes
  steckten sie dann *im* Körper — „die Arme sind ja sozusagen im Körper."
  Der richtige Wert hängt an der Rumpfbreite, nicht an sich selbst:
  Schulterkugel-Radius plus Brustradius minus gewollte Überlappung.
- **Schultern und Hüfte waren zu dick.** Der Schulterbalken (verbindet
  linke und rechte Armkugel) musste lang genug sein, um bis in die Kugeln
  hineinzureichen, durfte dafür aber nicht dicker werden — Länge und Dicke
  sind zwei unabhängige Werte, die beim ersten Versuch beide zu groß
  standen. Ebenso an der Hüfte: Beinansatz plus Schenkelradius muss bündig
  mit der Hüftbreite liegen, sonst „springen die Hosenbeine seitlich über
  die Hüfte hinaus".
- **Schuhe sind eine gestauchte Kugel, kein Kasten.** Zwei Fehlversuche:
  ein schmaler Kasten (verschwand hinterm Hosenbein, man sah nur Sohlen),
  dann ein breiter Kasten — „das sind nur Platten, es sollen Schuhe sein."
  Ein Ellipsoid hat die runde Kappe von selbst.
- **Das Haar ist eine große Schale, die direkt unterm Mützenrand
  beginnt.** Vorher ein kleiner Fleck tief im Nacken — zwischen Mütze und
  Haaransatz blitzte ein Streifen nackter Kopf hervor.
- *Merksatz, wieder bestätigt:* Jede dieser Korrekturen war eine
  **einzelne Zahl** (ein Radius, ein Ansatzpunkt), keine neue Geometrie —
  Proportionen sind bei einer Figur aus Grundkörpern die ganze Arbeit.
- **Der Ellbogen schwingt jetzt spürbar mit.** Rückmeldung: „nicht die
  ganze Zeit mit eingewinkelten [Armen] — ein bisschen realistischer."
  Der Ausschlag war nur 0,18 rad (rund 10°) um eine feste Grundbeugung —
  bei jeder Bildrate praktisch ein eingefrorener Winkel. Jetzt 0,6 rad im
  selben Rhythmus wie das Bein derselben Seite.
- **Ordentliche Hände statt Kugeln.** Rückmeldung: „kannst Du auch
  ordentliche Hände dranmachen?" Eine reine Kugel liest sich als Murmel.
  Jetzt eine gestauchte Faustform (0,88/0,8/1,05 statt gleichmäßig rund)
  plus ein kleiner Daumen — derselbe Kniff wie bei den Schuhen, nur eine
  Nummer kleiner. Der Daumen sitzt **auf der Dreh-Achse des Ellbogens**,
  sonst würde er bei jedem Armschwung durch die Hand hindurchwandern statt
  an ihr zu kleben.
- **Rumpf und Kopf standen fest, während die Gliedmaßen liefen.**
  Rückmeldung: „das Laufen noch realistischer machen." Genau das fehlte:
  Arme und Beine hatten Gelenke, aber der Oberkörper drehte sich nie mit —
  ein echter Läufer verdreht Schultern und Becken gegenläufig zueinander.
  `figurBauen` bekam dafür eine eigene Zwischen-Gruppe `oberkoerper`
  (Rumpf, Kopf, Rucksack, beide Arme), **innerhalb** von `gruppe`, aber
  **außerhalb** bleibt die Hüfte — sie ist der ruhende Bezugspunkt, an dem
  die Beine hängen, sonst entstünde beim Twist ein Spalt zwischen Hüfte
  und Hose. Der Oberkörper dreht sich jetzt im Lauftakt (0,1 rad, knapp
  bemessen — mehr sähe nach Tanzschritt aus), dazu eine leichte
  Vorlehnung beim Laufen und Springen, die es vorher gar nicht gab (die
  Figur stand kerzengerade). *Merksatz:* Bei einer Figur aus starren
  Grundkörpern sitzt Lebendigkeit nicht nur in den Gliedmaßen — der Rumpf
  braucht seine eigene, wenn auch kleinere, Bewegung.

### Schübe — Turbo und Sprungschub

Rückmeldung: „ich will 'n paar Sachen einsammeln, zum Beispiel, dass man
dann schneller ist, wo man höher springt oder so was, irgendwas
Besonderes." Zwei Arten in `logik.ts` (`Schub`/`Schubart`), seltener als
Münzen (`SCHUB_CHANCE`, nicht jeder Abschnitt), zeitlich befristet
(`TURBO_DAUER`/`SPRUNGSCHUB_DAUER`), keine Überschneidung — beide können
gleichzeitig aktiv sein.

- **Turbo multipliziert das Tempo, ersetzt es nicht.** `tempoBei(strecke)`
  bleibt die einzige Quelle für den Geschwindigkeitsanstieg über die
  Strecke; Turbo legt `TURBO_FAKTOR` obendrauf. Sonst hätte sich der
  Effekt am Anfang des Laufs viel stärker angefühlt als am Ende.
- **Sprungschub öffnet einen zweiten Weg an einem Hindernis, das sonst nur
  einen kennt.** Normal gilt bei einem Balken: Springen macht es
  schlimmer, nur Rutschen hilft. Mit aktivem Sprungschub gilt in
  `kollision()` stattdessen dieselbe Regel wie bei der Hürde — ein
  ausreichend hoher Sprung trägt darüber. Rückmeldung, wörtlich: „dass man
  dann auch über die Hürden, wo man drunter durchkriegen muss, drüber
  springen kann, wenn man dann irgendwas einsammelt."
- **Die Regel allein reichte nicht — es fehlte das Gefühl.** Rückmeldung
  danach: „Das Symbol ist mega, aber es bringt ja überhaupt nichts, man
  kommt trotzdem nicht über die großen Absperrungen." Die Regel *stimmte*
  bereits, jeder normale Sprung kam durch. Aber ein normal hoher Sprung
  sieht neben dem hüfthoch hängenden Schild nicht nach „darüber geflogen"
  aus, sondern nach Zufall. `springen()` gibt mit aktivem Sprungschub
  deshalb echten Kraft-Bonus (v₀ × 1,35, also fast 70 % mehr
  Scheitelhöhe). *Merksatz:* Wenn eine Regel bereits erlaubt, was der
  Spieler will, er es aber trotzdem nicht glaubt, ist nicht die Regel
  falsch, sondern ihre sichtbare Auswirkung zu klein.
- **Punkte-Doppler (`doppel`) — Ronnis eigene Idee**, wörtlich: „so 'n
  Mal-zwei-Zeichen, das macht dann den Score für ein paar Sekunden doppelt
  so schnell hoch." Wichtig dabei: Er verdoppelt den **Punktwert** der
  Münzen, nicht ihre **Zahl**. Eine mit Doppler eingesammelte Münze zählt
  weiterhin einfach in `muenzenZahl` und `muenzSerie` (sonst spränge die
  Serie in Zweierschritten und der Münzton käme aus dem Takt) und legt
  ihren Bonus in einen eigenen Topf `doppelPunkte`, der nur in `punkte()`
  obendrauf kommt. Der Topf wird nie geleert: Was man sich verdient hat,
  darf nicht wieder verschwinden, sonst fiele der Punktestand mitten im
  Lauf sichtbar zurück. Als Form ein vierzackiger Funke (kein Icon-Vorbild
  wie bei Blitz/Pfeil) in Pink — eine „×2"-Beschriftung wäre bei 44 Pixeln
  Bildgröße zu Matsch geworden.
- **Der Schub wirkt noch im selben Bild, in dem er eingesammelt wird.**
  Die Einsammel-Prüfung steht in `takt()` bewusst **vor** der
  Hindernisprüfung und schreibt in dieselbe `zwischen`-Variable — ein
  Sprungschub genau auf Höhe eines Balkens hilft sofort, nicht erst ein
  Bild später.
- **Kein Höhenfenster beim Einsammeln**, anders als bei Münzen: Ein Schub
  soll nicht ausgerechnet dann verpasst werden, wenn man gerade springt
  oder rutscht, um einem Hindernis auszuweichen.
- **Zwei Formen statt zweier Farben derselben Form.** Bei Tempo 20 bleibt
  keine Zeit, eine Beschriftung zu lesen — die Silhouette muss allein
  sagen, was man einsammelt. Dieselbe Farbe taucht als Bodenring unter der
  Figur und als Badge in der Kopfzeile wieder auf, damit die Verbindung
  „das habe ich eingesammelt, das wirkt gerade" ohne Text ankommt.
- **Kegel und Diamant waren die ersten Formen — Rückmeldung: „da passt die
  Form ja nicht dazu."** Statt selbst zu entscheiden, bekam Ronni je drei
  Vorschläge gezeigt (Turbo: Blitz/Doppelpfeil/Rakete; Sprungschub:
  Aufwärtspfeil/Doppelpfeil/Flügel) und sich für **Blitz** und
  **Aufwärtspfeil** entschieden. Beide sind keine Grundkörper mehr,
  sondern ein `THREE.Shape` mit den Eckpunkten der altbekannten
  Feather-Icons „zap" und „arrow-up", extrudiert wie eine Münze (eine
  flache 2-D-Form mit etwas Tiefe) statt als Kegel oder Oktaeder — kein
  selbst erfundenes Vieleck, das sich beim nächsten Ändern als sich selbst
  überschneidend erweisen könnte. *Merksatz:* Bei einer Entscheidung, die
  rein optisch ist und keinen Rechenweg hat, lohnt sich ein sichtbarer
  Vorschlag mit Auswahl mehr als eine eigene Wahl vorwegzunehmen.
- **Eine eigene Uhr für den Laufschritt (`schrittZeit`), getrennt von
  `laufzeit`.** Mit Turbo sollen die Beine sichtbar schneller pumpen —
  aber ein Sprung im *Faktor* an der Verwendungsstelle risse den Schritt
  mitten in der Bewegung um. Ein Sprung in der *Geschwindigkeit der Uhr*
  nicht: Die Phase läuft weiter, sie beschleunigt nur.
- Ein eigener Ton (`sfx('stufe')` statt `sfx('gut')`) und ein Doppel-Stups
  (`haptik('jubel')`), damit sich ein Schub von einer Münze auch ohne
  Hinsehen unterscheidet.

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

## Fortschritt: Erfahrung, Stufe, Erfolge

Stufe 1 des großen Qualitäts-Umbaus („aus der App ein richtiges Game
machen"). `shell/fortschritt.ts` ist rein und getestet, `speicher.ts`
speichert, `Spielrahmen.tsx` verbucht am Rundenende.

**Kein Spiel weiß davon, und das war die Bedingung.** An `GameApi`/
`GameProps` hängen zwanzig fertige Spiele; die Schnittstelle ist in der
ganzen Projektgeschichte zweimal erweitert worden. Für Erfahrungspunkte ist
das nicht nötig: Die Hülle kennt am Rundenende ohnehin Punkte, Sieg-Merkmal
und die Bestleistung davor — mehr braucht die Rechnung nicht. Zwanzig Spiele
anzufassen hätte genau das riskiert, was funktioniert.

**Erfahrung kommt nicht aus Punkten.** Dieselbe Falle wie bei den Sternen:
Quiz Time geht von 0 bis 10, Block Burst in die Tausende. Gäbe es Erfahrung
je Punkt, wäre Block Burst hundertmal so viel wert, und die Stufe sagte nur
noch aus, *welches* Spiel jemand spielt. Gezählt wird deshalb, was überall
dasselbe bedeutet:

| | XP |
|---|---|
| Runde gespielt | 10 |
| je Stern (die messen schon gegen die eigene Bestleistung) | 10 |
| echter Sieg | 15 |
| neue persönliche Bestleistung | 25 |
| Spiel zum ersten Mal gespielt | 50 |

Eine Runde bringt damit 20 bis 120 XP.

**Die Stufenkosten steigen linear, nicht exponentiell** (`100 + (n-1)·50`).
Eine Verdopplung je Stufe sieht nach kurzer Zeit so aus, als ginge gar nichts
mehr — bei einem Kind ist das der Moment, in dem der Balken aufhört, etwas zu
bedeuten.

**Keine Uhr in `fortschritt.ts`.** Der Tag wird als `JJJJ-MM-TT` gereicht.
Sonst ließe sich die Serienzählung („fünf Tage hintereinander") überhaupt
nicht testen, ohne die Systemuhr zu verstellen. `heute()` ist die einzige
Stelle mit `new Date()`, und sie rechnet **Ortszeit**: Wer abends um 23 Uhr
spielt, hat *heute* gespielt. Der Tagesabstand rechnet dagegen mit `T12:00Z`
— mit `T00:00Z` kippt er westlich von Greenwich um einen Tag, und aus
„gestern gespielt" würde „vorgestern"; die Serie risse ohne Grund.

**Erfolge werden nach dem Verbuchen geprüft, gegen den neuen Stand.**
Andersherum hinkte jeder Erfolg eine Runde hinterher: Die zehnte Partie
löste „Warmgelaufen" erst bei der elften aus. Dafür gibt es einen Test.

**Alles Gespeicherte geht durch `fortschrittBereinigen`.** Der Speicher ist
nicht vertrauenswürdig — ältere Fassung, halb geschrieben, von Hand
verändert. Ein fehlendes Feld darf nicht die halbe Startseite weiß werden
lassen.

`bestenlisteLoeschen()` räumt den Fortschritt mit weg: Stufe 12 zu behalten,
während alle Punkte gelöscht sind, wäre ein Widerspruch.

## Designsystem

Schatten, Zeiten und Kurven standen vorher überall einzeln im Code, jede
Stelle ein bisschen anders — daran erkennt man eine zusammengestückelte
Oberfläche. Jetzt eine Leiter in `index.css`:

- `--schatten-1` bis `-4` sind **Ebenen**, keine Pixelwerte: 1 liegt flach
  auf, 2 ist angehoben, 3 schwebt, 4 ist ein Dialog über allem. Wer eine
  Fläche baut, wählt die Ebene.
- `--zeit-kurz/mittel/lang` (120/240/400 ms). Alles über 450 ms fühlt sich
  auf einem Handy nach Warten an.
- `--kurve-raus` federt am Ende leicht über — der Unterschied zwischen
  „erscheint" und „ploppt auf".
- Zustandsfarben (`--color-erfolg/warnung/fehler`) sind von den Akzentfarben
  der Spiele getrennt: Ein grüner Haken darf nicht zufällig die Spielfarbe
  von Snake Rush sein.
- `--color-xp` ist violett, weil sonst nichts im Bild violett ist —
  Erfahrung soll man auf einen Blick von Punkten unterscheiden.

**`.druckbar` und `.kippbar` statt Hover.** Florian spielt auf iPad und
iPhone; dort gibt es keinen Zeiger, der über etwas schwebt. Ein Entwurf, der
seine Räumlichkeit aus Hover-Effekten bezieht, ist auf dem Zielgerät
unsichtbar. Die Tiefe steckt deshalb im **Drücken**: Die Fläche sinkt ein,
ihr Schatten wird flacher, sie federt zurück. `perspective` gehört dabei ans
Elternelement (`.buehne-3d`) — sonst bekommt jede Karte ihren eigenen
Fluchtpunkt und die Reihe wirkt auseinandergerissen.

`.schimmer` ist der Ladeplatzhalter (1,4 s Durchlauf = 0,7 Hz, weit unter
der 1,7-Hz-Grenze des Projekts). Eine leere Fläche liest sich als Fehler,
ein Platzhalter in der Form dessen, was gleich kommt, als „gleich da".

## Navigation und Seitenaufteilung

Stufe 2 des Qualitäts-Umbaus. Lange stand hier bewusst **keine**
Reiterleiste: Bei elf Spielen hätte sie sieben davon hinter einem Klick
versteckt, und die App passte auf einen Bildschirm. Diese Rechnung hat sich
umgedreht.

Nachgemessen bei zwanzig Spielen: Die Startseite scrollte, die Wortmarke
schob sich beim Scrollen **unter die Statusleiste**, und Bestenliste und
Duelle lagen als schmale Zeilen unter der Falz. Dazu kamen Fortschritt und
Erfolge als eigene Bereiche. Ab hier kostet eine Leiste weniger, als sie
einbringt.

Fünf Punkte: **Start, Spiele, Rangliste, Fortschritt, Mehr.** Ab sechs wird
jedes Ziel schmaler als ein Daumen. Konto, Einstellungen und Duelle liegen
deshalb hinter „Mehr" — und lassen dessen Punkt leuchten, sonst stünde man
auf der Kontoseite vor einer Leiste, in der nichts hervorgehoben ist.

Der aktive Punkt ist an **drei** Dingen erkennbar: Farbe, gefülltes Symbol
und ein Kissen dahinter. Farbe allein wäre für ein farbfehlsichtiges Kind
kein Merkmal — und „wo bin ich?" ist genau die Frage, die eine Navigation
beantworten muss.

**Die Startseite ist jetzt eine Zentrale, kein Regal.** Sie beantwortet von
oben nach unten vier Fragen in der Reihenfolge, in der ein Kind sie stellt:
„Bin ich das?" (Begrüßung, Stufe) — „Wo war ich?" (Weiterspielen, der
größte Knopf der Seite) — „Was kann ich als Nächstes holen?" (drei offene
Ziele) — „Was gibt's noch?" (acht Kacheln, der Rest hinter einem Knopf).
Das vollständige Raster liegt auf einer eigenen Seite; die Reihenfolge dort
bleibt fest.

**Sterne statt „Neu".** Vorher trug jede ungespielte Kachel ein oranges
„Neu" — bei zwanzig Spielen zwanzig Fähnchen gleichzeitig, die lauter
schrien als die Symbole darunter. Wenn alles neu ist, ist nichts neu. Jetzt
stehen dort die verdienten Sterne. Der Unterschied ist grundsätzlich: „Neu"
beschreibt eine **Abwesenheit** und verschwindet, sobald man etwas tut;
Sterne beschreiben einen **Besitz** und wachsen. Drei blasse Sterne sagen
genauso deutlich „hier ist noch nichts" — und zusätzlich, wie viel es zu
holen gibt.

**Der Farbbruch ist zu.** Die Hüllenseiten (`Seite.tsx`) lagen auf fast
schwarzem Grund, während die Startseite kräftig bunt war — der auffälligste
Bruch der ganzen App, es wirkte wie zwei Programme. Sie bekommen jetzt einen
gedämpften Abkömmling desselben Verlaufs. Bewusst dunkel gehalten und nicht
der volle Verlauf: Ihre Farbtokens (`text-gedaempft`, `border-rand`) sind
für dunklen Grund ausgelegt und wären auf dem hellen kontrastarm.

### Die Falle, die eine ganze Stunde gekostet hätte

**`body` braucht `height`, nicht `min-height` — und `#wurzel` muss die
Flex-Kette weiterreichen.**

Die Leiste war zunächst schlicht unsichtbar. Sie stand brav am Ende des
Inhalts, und der war zweieinhalb Bildschirme lang. Zwei Ursachen, beide
lehrreich:

1. Mit `min-height: 100dvh` wächst der Körper mit seinem Inhalt. Ein Kind
   mit `flex: 1` bekommt dadurch **nie** eine feste Höhe, und ein
   `overflow-y: auto` darin hat nichts, woran es sich begrenzen könnte —
   statt innen zu scrollen, schiebt der Inhalt die Seite auseinander.
2. `#wurzel` war ein gewöhnlicher `div` ohne Stil. Damit war die Flex-Kette
   zwischen `body` und der App unterbrochen, und jedes `flex-1` darunter
   lief ins Leere. Dazu gehört `min-height: 0` — Flex-Kinder haben von sich
   aus `min-height: auto` und schrumpfen deshalb nie unter ihren Inhalt.

*Merksatz:* Ein innerer Scrollbereich funktioniert nur, wenn **jedes**
Glied der Kette von `body` bis dorthin eine begrenzte Höhe hat.

Nebenbei ist damit auch verlässlich, dass ein Spiel genau eine
Bildschirmhöhe bekommt — vorher hing das daran, dass der Inhalt zufällig
hineinpasste.

**Ein laufendes Spiel bekommt keine Leiste.** Sie würde bei Dash City oder
Ghost Chase Höhe kosten, und wer mitten im Sprung versehentlich „Rangliste"
trifft, verliert die Runde.

Nachgemessen bei 375, 768 und 1920 Pixeln: kein waagerechter Überlauf,
nichts ragt heraus, die Leiste sitzt auf allen fünf Seiten exakt auf der
Unterkante.

## Die Rangliste

Stufe 3 des Qualitäts-Umbaus. Zwei Dinge waren hier grundlegend falsch.

**Die Gesamtwertung war eine nummerierte Liste.** Jetzt ein Podest: Gold
steht **in der Mitte und am höchsten**, Silber links, Bronze rechts. Das ist
der ganze Unterschied — eine Liste liest man von oben nach unten und muss
Zahlen vergleichen; ein Podest sieht man auf einen Blick, weil die *Höhe*
die Information ist. Stünde Platz 1 links, wäre es wieder eine Liste, nur
waagerecht. Ab Platz 4 geht es als Zeilen weiter, dort ist Höhe kein
sinnvolles Mittel mehr.

Die Reihenfolge im Markup bleibt **1, 2, 3** und wird nur optisch
umsortiert. Sonst liest ein Vorleseprogramm „Silber, Gold, Bronze".

*Ein Fehler, den nur das Hinsehen findet:* Die Stufenhöhen standen zuerst in
der **Anzeige**reihenfolge (Silber, Gold, Bronze), abgegriffen wurden sie
aber mit dem **Platz**index. Silber bekam dadurch die höchste Stufe — das
Podest sagte das Gegenteil dessen aus, was es zeigen soll. Im Code fällt so
etwas überhaupt nicht auf, im Bild sofort.

**„Nur ich" war die schwächste Seite der App.** Sie zeigte alle zwanzig
Spiele untereinander, und auf den meisten stand „Noch nichts gespielt." —
zwanzig fast identische dunkle Kästen, die nichts sagten. Jetzt stehen dort
nur Spiele **mit** Ergebnissen, jeweils mit ihrer Sternzahl; der Rest steht
in einer Zeile am Ende („Diese warten noch auf dich"), und die liest sich
als Einladung statt als Mangelliste. Darüber drei Zahlen: Ergebnisse,
Spiele, Sterne.

*Merksatz dazu:* Eine Kopfzahl muss zu ihrer eigenen Liste passen. Zuerst
stand dort die Rundenzahl aus dem Fortschritt — die zählt aber erst, seit es
den Fortschritt gibt, und auf einem Gerät mit älteren Ergebnissen stand dann
„2 Runden" über sieben aufgelisteten Ergebnissen. Beide Zahlen stimmten für
sich; zusammen sahen sie nach einem Fehler aus.

**Der Ladezustand ist ein Gerüst, kein Satz.** „Wird geladen …" auf leerer
Fläche liest sich als Fehler. Ein Platzhalter in der Form dessen, was gleich
kommt (`.schimmer`), liest sich als „gleich da" — und wenn die Daten
eintreffen, springt nichts, weil die Höhe schon stimmt.

## Feiern, Spielstart, Haptik

Stufe 4 des Qualitäts-Umbaus — der Feinschliff, der „native App" ausmacht.

**Der Spielstart ist inszeniert, ohne dass ein Spiel angefasst wurde.** Der
Wechsel vom Startbildschirm ins Spiel war der einzige Moment der App ganz
ohne Übergang — ausgerechnet der wichtigste. Die Regel hängt an
`.spielbuehne` **selbst** und wirkt dadurch in allen zwanzig Spielen; sie
läuft auch bei „Nochmal", weil die Bühne dann neu eingehängt wird. 340 ms
und keine Verzögerung: Wer auf „Spielen" tippt, will spielen.

**Konfetti gibt es bei genau drei Anlässen** (`core/Feier.tsx`): neue Stufe,
frisch freigeschalteter Erfolg, neue persönliche Bestleistung. Jede Runde zu
feiern macht das Feiern wertlos — und wer gerade nach drei Sekunden verloren
hat, mit Konfetti überschüttet zu werden, wirkt sogar hämisch.

Zwei Punkte dazu, die beim Bauen wichtig waren:

- **Es ist nicht das `.konfetti` aus Color Pour.** Das sind SVG-Teilchen
  (`transform-box: fill-box`) innerhalb einer Zeichnung; hier liegen normale
  Elemente über einem Dialog. Zwei verschiedene Sachen mit demselben Namen
  wären schlimmer als zwei Namen.
- **Die Streuung kommt aus dem Index, nicht aus `Math.random`.** Das ist
  hier nicht Regeltreue um ihrer selbst willen: React rendert eine
  Komponente auch mehrfach (im Entwicklungsmodus absichtlich doppelt), und
  mit Zufall bekäme jedes Teilchen dabei eine neue Flugbahn — das Konfetti
  spränge mitten im Flug.

`gefeiert` wird aus `ende` **abgeleitet** und nicht im Zustand gemerkt: Platz
und Duellstand kommen später vom Server nach und setzen `ende` neu; eine
gespeicherte Marke würde mitkopiert und das Konfetti liefe ein zweites Mal
los, mitten im schon offenen Dialog.

**Haptik (`core/haptik.ts`) tut auf Florians Geräten nichts — und das steht
dort auch so.** Safari kennt `navigator.vibrate` nicht, weder auf dem iPhone
noch auf dem iPad; Apple hat es nie eingebaut. Auf Android funktioniert es.
Zwanzig Zeilen, die nichts kaputt machen können und dort richtig wirken, wo
es sie gibt — aber es darf nicht so getan werden, als wäre das Hauptgerät
gemeint. Drei Anlässe (`ende`, `jubel`, `fehler`), bewusst nicht bei jedem
Antippen: Das ist die Sorte Aufmerksamkeit, die nach zwei Minuten nur noch
lästig ist. Kein eigener Schalter — Vibration ist systemweit abschaltbar,
und zwei Stellen, die dasselbe festlegen, sind genau die Falle aus dem
Abschnitt „Wenn Animationen einfach weg sind".

**Lade- und Leerzustände** auf der Duell-Seite: ein Gerüst mit `.schimmer`
in der Form der Liste statt „Wird geladen …", und für „kein Netz" bzw. „noch
kein Duell" je ein eigener Kasten mit Zeichen, Überschrift und einem Satz,
der weiterhilft.

*Beim Prüfen fast einen Fehler gemeldet, der keiner war:* Der
Rundenende-Dialog zeigte kurz **0** Punkte. Das ist die hochzählende Zahl am
Anfang ihres Laufs (`useHochzaehlen`) — ein Bildschirmfoto trifft sie leicht.
Wer hier etwas ändert: erst das zweite Foto abwarten.

## Tagesaufgaben

Stufe 5 des Qualitäts-Umbaus — und die einzige, bei der die Frage war,
*welche* Art von Spieltiefe überhaupt fehlt.

**Schwierigkeitsstufen wären der falsche Griff gewesen.** Nachgesehen: Fast
jedes Spiel hat längst eine. Quiz Time, Word Play, Brain Blitz, Color Pour,
Pair Up, Blade Toss, Box Push, Even Cut und Flow Link steigern sich über die
Levelnummer; Snake Rush, Block Burst, Line Fall, Ghost Chase, Ring Rise,
Bubble Pop und Dash City werden im Lauf einer Runde schwerer; Drop Four und
Tap Rush lassen sogar direkt wählen. Ein aufgesetzter Stufenschalter hätte
in zwanzig Spielen die Bestenlisten zerteilt — ein Ergebnis auf „leicht" ist
mit einem auf „schwer" nicht vergleichbar — und dafür kaum etwas
hinzugefügt.

Was wirklich fehlte, ist ein **Grund, heute zu spielen**, und zwar einer,
der über alle Spiele hinweg gilt. `shell/herausforderungen.ts`, rein und
getestet (19 Tests).

**Drei Aufgaben je Tag, aus dem Datum gewürfelt.** Gleicher Tag → dieselben
Aufgaben, überall, ohne dass irgendetwas abgestimmt werden müsste. Ein
Server wäre dafür nicht nur unnötig, er würde das Offline-Versprechen
brechen. Sechs Arten: Runden, Sterne, verschiedene Spiele, Siege,
Bestleistungen, und „spiele eine Runde *X*" — die letzte schickt einen in
Ecken der Sammlung, in die man von allein nie geht, und genau darum geht es
bei zwanzig Spielen.

**Eine Aufgabe ist immer dabei, die sich durch bloßes Spielen erledigt**
(„Spiele N Runden"). Ohne diese Garantie könnte ein Tag drei Aufgaben
bringen, von denen keine sicher zu schaffen ist — dann ist das Ganze Frust
statt Anreiz. Dafür gibt es einen Test über sechzig Tage.

**Kein Spiel weiß davon.** Alle sechs Arten lassen sich aus dem ableiten,
was die Hülle am Rundenende ohnehin kennt: welches Spiel, wie viele Sterne,
gewonnen oder nicht, Bestleistung oder nicht. Damit bleibt die Schnittstelle
zum dritten Mal in Folge unangetastet.

Zwei Feinheiten, die beim Bauen wichtig waren:

- **Der Tageswechsel passiert beim Verbuchen, nicht beim Lesen.** Sonst
  müsste jede anzeigende Stelle daran denken, und eine, die es vergisst,
  zeigt gestrige Zähler unter heutigen Aufgaben. `standFuerHeute` ist die
  Absicherung für die Anzeige.
- **Die Erfahrung der Aufgaben kommt oben drauf, und die Stufe wird danach
  neu gerechnet.** Eine geschaffte Aufgabe kann für sich schon eine Stufe
  heben; würde `ausbeute.neueStufe` aus dem Rundenteil übernommen, bliebe
  genau dieser Aufstieg unbemerkt.

**Geschaffte Aufgaben verschwinden nicht, sie werden grün abgehakt.** Was
verschwindet, wirkt, als hätte man es sich eingebildet — und die Liste wäre
am Abend leer statt voller Häkchen.

*Eine Farbfalle nebenbei:* Die Erfahrungsbeträge standen zuerst in
`--color-xp`. Im Rundenende ist das richtig (dunkler Grund, sonst nichts
Violettes im Bild) — auf der **Startseite** ist der Hintergrund selbst
violett, und die Zahl verschwand darin fast. *Merksatz:* Eine Farbe, die an
einer Stelle Bedeutung trägt, muss an einer anderen trotzdem lesbar bleiben;
im Zweifel gewinnt die Lesbarkeit.

## Florianville — das Cartoon-Abenteuer (`src/abenteuer/`)

Ronnis großer Auftrag: ein eigenes Cartoon-Adventure mit Stadt, Missionen,
NPCs, Fahrzeugen, Arcade-Modus und Bossen. **Das ist Monatsarbeit**, und es
wird nach seinem eigenen §59 gebaut: erst ein Vertical Slice, der sich schon
wie ein fertiges Spiel anfühlt, dann die Welt erweitern.

**Kein zweiter Spiel-Motor.** Phaser wäre eine zweite Engine für dasselbe
Problem gewesen. three.js liegt bereits als eigener Brocken bereit (Dash
City), kann 3-D *und* 2.5-D und ist offline abgesichert. Die beiden
`szene.ts` teilen sich denselben `three`-Brocken; wer Snake Rush spielt,
lädt weiterhin nichts davon.

**Eigener Bereich, kein einundzwanzigstes Spiel.** Florianville hängt
**nicht** an `GameApi` — ein offenes Abenteuer hat keine „Runde", die mit
`onGameOver` endet. Es hat eine eigene Adresse (`#/abenteuer`), einen eigenen
Vollbildmodus ohne Leiste und eine eigene Einstiegskarte über der
Weiterspielen-Karte. Die Sammlung bleibt unangetastet.

Dieselbe Dreiteilung wie bei Dash City:

| Datei | Kennt | Kennt nicht |
|---|---|---|
| `welt.ts` | Geometrie der Zone | three.js, React |
| `logik.ts` | Bewegung, Kollision, Aufsammeln | three.js, React, Uhr |
| `szene.ts` | three.js | Spielregeln |
| `AbenteuerSeite.tsx` | Schleife, Eingaben, Anzeige | beides |

30 Tests auf Welt und Bewegung. Sie haben schon vor dem ersten Bild drei
echte Fehler gefunden: **zweimal stand ein NPC in einer Hauswand** (von Hand
gesetzte Koordinaten neben von Hand gesetzten Gebäuden), und ein
Sammelstück, das eigentlich einen Sprung kosten sollte, war vom Boden aus
erreichbar.

### Was dabei gelernt wurde

**Ein Hochformat-Handy hat kaum waagerechtes Sichtfeld — und das bestimmt
den Grundriss.** Der erste Entwurf stellte acht Häuser auf x = ±18; am
Rechner ein Viertel, auf dem iPhone war **kein einziges Haus im Bild**. Bei
58° senkrecht und Seitenverhältnis 0,68 bleiben waagerecht 20,6° übrig, die
nächste Hausecke lag bei 23°. Zwei Grad. Behoben mit 66° Sichtfeld *und*
Häusern bei x = ±11,5. *Merksatz:* Für ein Handy muss eine Stadt **eng**
gebaut sein — was ohnehin besser zu einem Cartoon passt als Vorortabstände.

**Feste Kamerarichtung, weltbezogene Steuerung.** Der erste Entwurf ließ die
Kamera hinter der Figur mitschwenken. Zusammen mit weltbezogenem Stick ergibt
das eine Rückkopplung: Die Figur dreht sich zur Laufrichtung, die Kamera
dreht hinterher, dadurch verschiebt sich, was „oben" heißt — man könnte gar
nicht mehr gezielt abbiegen. Jetzt bleibt Norden Norden.

**Beim Herausschieben aus einem Hindernis braucht es einen Hauch Luft.** Ohne
ihn landet die Figur *exakt* auf dem Radius, das zählt als Berührung, und die
Auflösungsschleife kommt nie zur Ruhe. Ein Zehntelmillimeter beendet das.

**Cartoon-Optik: drei Griffe.** `MeshToonMaterial` (Schattierung in Stufen
statt stufenlos), Konturlinien über die umgestülpte Hülle (`side: BackSide`,
leicht vergrößert — eine echte Zeichenkontur ohne zweiten Renderdurchgang,
nur an Figuren), und viel Grundhelligkeit. Ein dunkles Bild sieht nach
Realismus aus, auch wenn die Formen rund sind.

**Der Dunst muss zur Weltgröße passen.** Bei 55–110 Metern über einem nur 44
Meter großen Viertel hatte er nichts zu tun, und statt eines Horizonts sah
man die **Kante der Bodenfläche** als harten Strich. Jetzt 34–72.

### Stand und was fehlt

**Fertig:** Zone „Ahornweg" (vier Häuser, Zäune mit Gartentoren, Bäume,
Laternen, Hecken, Mülltonnen), Bewegung mit Gehen/Rennen/Springen,
Kollision, feste Kamera, zwölf Sammelstücke (zwei nur per Sprung), drei NPCs
mit eigenem Aussehen, Touch-Stick und Sprungknopf, Tastatur, Ladezustand,
Fehlerzustand.

**Fehlt noch** (Ronnis Phasen 9 bis 21): Dialogsystem, Missionen, XP-Anschluss
an den bestehenden Fortschritt, Speichern des Weltzustands, Fahrzeug,
Minispiel, Gegner, Boss, Arcade-Modus, Story, weitere Zonen.

## Der Avatar

Eine menschliche Figur aus acht Teilen — Hautfarbe, Frisur, Haarfarbe,
Oberteil-Schnitt, Oberteil-Farbe, Hosen-Schnitt, Hosen-Farbe, Extra —, die mit
der Stufe wächst. `shell/avatar.ts` (reine Logik, welche Optionen ab welcher
Stufe offen sind), `shell/AvatarBild.tsx` (das SVG), `shell/AvatarSeite.tsx`
(der Baukasten), erreichbar über „Mehr" und von der Kontoseite aus.

**War ursprünglich ein runder Blob mit Augen.** Rückmeldung: „Sieht das
nicht nur aus wie ein Wassertropfen? Ich will, dass die Avatare richtig
Menschen sind, die man anziehen kann." Seither eine echte Figur mit Kopf,
Rumpf, Armen, Beinen, Schuhen statt eines Fantasiewesens.

**Schnitt und Farbe stehen bei Kleidung bewusst getrennt.** Rückmeldung:
„nicht nur ein T-Shirt, sondern langärmlig, kurzärmlig … kurze, lange,
breite, dünne Hosen." Ein Unterhemd gab es zwischenzeitlich auch als
Oberteil-Schnitt, ist aber auf Ronnis Wunsch wieder raus („das brauchen wir
nicht") — seitdem reicht ein einziger, vollständig ausgeschriebener
Rumpf-Pfad für alle verbliebenen Schnitte.

**Datei heißt `AvatarBild.tsx`, nicht `Avatar.tsx`.** macOS' Dateisystem ist
serienmäßig nicht zwischen Groß-/Kleinschreibung unterscheidend — `Avatar.tsx`
und `avatar.ts` wären auf der Platte **dieselbe Datei** gewesen. Das fiel
nicht beim Schreiben auf (beide Editoren zeigten anstandslos ihren eigenen
Inhalt), sondern erst beim Typprüfen, mit einer Fehlermeldung, die die
Ursache nicht beim Namen nennt. Merksatz: Ein Dateiname darf sich in diesem
Projekt in nichts als der Groß-/Kleinschreibung von einem anderen unterscheiden.

**Nie dynamisch zusammengesetzte SVG-Pfade.** Ein früher Versuch, den
Rumpf-Umriss aus zwei Teil-Strings zusammenzukleben, ergab eine
selbstüberschneidende Form (eine blaue Fahne quer aus der Seite der Figur) —
nur durch Screenshot entdeckt, nicht durch einen Test. Seither ist jeder
Pfad vollständig von Hand ausgeschrieben, nie komponiert.

**Die Cap statt einer Mütze.** Rückmeldung: „Könnten wir schwarze Cappy
machen? Auch eine weiße und eine grüne." Drei Farben als drei eigene
`accessoire`-Optionen statt eines neunten Teils. Dieselben drei noch einmal
mit `-hinten` — Rückmeldung: „dass man die Kappe andersrum anziehen kann" —
dieselbe Kuppel, nur ohne den Schirm vorn (er zeigt von der Kamera weg),
mit zwei kleinen Riemen-Tabs seitlich statt des Schirms.

**Schuhe übernehmen den dunklen Hosenton statt einer festen Farbe** —
Rückmeldung: „verschiedene Schuhe". Kein eigenes neuntes Teil dafür, nur
`hose.dunkel` als Füllung.

**Bewusst lokal, nicht über den Server.** Der Avatar ist Kür, kein
Spielstand — er speichert wie der Fortschritt in `speicher.ts`, offline
verfügbar, ohne einen weiteren Baustein, der scheitern kann. Dadurch ist er
nur auf dem eigenen Gerät sichtbar, auch für andere Spieler in der
Bestenliste (dort zeigt nur die **eigene** Zeile den echten Avatar, alle
anderen weiterhin den Anfangsbuchstaben) — eine bewusste Einschränkung der
ersten Fassung, kein Versehen.

**Gesperrte Teile stehen blass da, mit der Stufe, ab der sie zu haben
sind** — dieselbe Regel wie bei den Erfolgen auf der Fortschrittsseite.
`avatarBereinigen` sorgt dafür, dass ein gespeicherter Wert nie eine Option
zurückgibt, die bei der aktuellen Stufe eigentlich gesperrt ist — dieselbe
Vorsicht wie bei `fortschrittBereinigen`.

**Die Hautfarbe ist als einziges Teil nie gesperrt** — alle Optionen ab
Stufe 1. Sie ist keine Belohnung, sondern eine Wahl, wer man sein möchte,
und muss deshalb von Anfang an vollständig offenstehen.

## Die Statistik-Seite

Eine Zeile je Spiel — Runden, Siege, Sterne, Bestwert, zuletzt gespielt —,
erreichbar über einen Knopf auf der Fortschrittsseite. Erhebt **keine
einzige neue Zahl**: Die vier Werte stehen längst in `fortschritt.jeSpiel`,
das Datum ist das jüngste aus der ohnehin gespeicherten Bestenliste. Die
Rechnung dafür steht in `statistik.ts`, unabhängig vom Bildschirm testbar.

**„Gespielt" heißt nicht nur `partien > 0`.** Runden zählt der Fortschritt,
das Datum kommt aus der Bestenliste — zwei verschiedene Speicherorte. Bei
Color Pour lief das schon einmal auseinander: ein echter Bestenlisten-
Eintrag von vor der Fortschritt-Funktion, aber `partien` stand noch auf 0.
Die Karte zeigte ein Datum und behauptete im selben Atemzug „noch nicht
gespielt". Jetzt entscheiden beide Werte zusammen, ob eine Karte als
gespielt gilt.

Bewusst **keine Rangliste zwischen den Spielen**: Die Skalen sind
unvergleichbar (Quiz Time 0 bis 10, Block Burst in den Tausenden) — genau
der Grund, aus dem die Fortschrittsseite selbst keine Gesamtpunktzahl zeigt.

## Ausliefern

Läuft auf **Netlify** unter `florian-spielesammlung.netlify.app`. Das ist
die Adresse, die Florian benutzt.

**Hier stand vorübergehend, die App laufe auf dem Hetzner-Webpaket unter
`spiele.klarvorteil.de`. Das war nie wahr, und der Irrtum ist es wert,
festgehalten zu werden.** Auslöser war ein echtes Problem: Am 15.08.2026
antwortete Netlify mit HTTP 503 (`usage_exceeded`), das Freikontingent war
voll. Daraufhin wurde der Umzug vorbereitet *und gleich als erledigt
notiert*. Nachgemessen war davon nichts fertig:

- `spiele.klarvorteil.de` gab es gar nicht — **NXDOMAIN**, kein
  DNS-Eintrag.
- Der Hochlade-Schritt in `ausliefern.yml` hängt an
  `vars.HETZNER_AKTIV == 'ja'`; die Variable war nie gesetzt, ebenso wenig
  die vier FTP-Secrets. Jeder Lauf meldete brav „success", weil nur der
  Prüfteil lief — der Hochlade-Job stand daneben auf **skipped**.
- Das Kontingent bei Netlify hatte sich längst wieder gefangen: HTTP 200.

Es liefen also drei Deploys „erfolgreich" ins Leere, und Florians Gerät
blieb auf v35 stehen. *Merksatz: Ein grüner Haken bei GitHub sagt nur, dass
kein Schritt fehlgeschlagen ist — nicht, dass einer gelaufen ist.
Übersprungene Jobs zählen als Erfolg.* Nach einem Deploy gehört deshalb
immer eine Gegenprobe an der **echten Adresse** dazu:

```bash
curl -s https://florian-spielesammlung.netlify.app/sw.js | grep -o "spielesammlung-v[0-9]*"
```

Zweiter Fund derselben Art: `.netlify/state.json` im Projekt zeigte auf
`bright-malabi-4b190b` — eine leere Wegwerf-Seite, die mit 404 antwortet.
Ein Deploy von Hand aus diesem Ordner wäre dort gelandet, nicht bei
Florian. Steht jetzt richtig auf `florian-spielesammlung`
(`9d35f7b3-64b4-4d7d-ae3c-3c1a31855ae5`).

Ausgeliefert wird von Hand, weil Ronni ausdrücklich nichts selbst anstoßen
will („ich will nichts selber anstoßen"). Sein Netlify-Token liegt lokal
unter `~/Library/Preferences/netlify/config.json`, das CLI läuft über
`npx`:

```bash
npm test && npm run build
npx netlify-cli deploy --prod --dir=dist
```

Der Weg über das Hetzner-Webpaket bleibt vorbereitet, ist aber **nicht in
Betrieb**. Zum Scharfschalten fehlen: ein DNS-Eintrag für
`spiele.klarvorteil.de`, die vier Secrets (`FTP_HOST`, `FTP_BENUTZER`,
`FTP_PASSWORT`, `FTP_ZIEL`) und die Variable `HETZNER_AKTIV=ja`. Alle drei
kann nur Ronni setzen.

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

## Die zweite große Prüfrunde

Zwanzig Agenten haben je ein Spiel durchgesehen, danach hat je ein zweiter
versucht, die Befunde zu **widerlegen**. 117 Befunde behoben, 26
Beanstandungen aus der Gegenprüfung. Was daraus gelernt wurde:

**Eine Prüfung, die dieselbe Rechnung benutzt wie der geprüfte Code,
prüft nichts.** Die neuen Kontrast-Tests in Merge Up importieren `kontrast`
aus `farben.ts` — und `kachelTextFarbe` benutzt genau diese Funktion. Wäre
die Luminanz-Formel falsch, wären Test und Umsetzung gemeinsam falsch und
trotzdem grün. Der Test sichert die **Farbliste** ab, nicht die Rechnung;
die musste von Hand gegen WCAG nachgerechnet werden.

**Ein Test über die Aufgabe deckt die Antworten nicht mit ab.** Brain Blitz
prüfte die sichtbare Zahlenfolge — die war immer sauber. Die drei
**Ablenker** daneben nicht: Bei fallenden Folgen richtete sich ihr Abstand
nach der Schrittweite (bis 20), die richtige Antwort lag aber nur zwischen
5 und 30. Level 33 zeigte unter „29, 23, 17, 11, ?" die Auswahl
−1 / 5 / 1 / 11. Gefunden wurde das erst über 12 000 durchgerechnete
Aufgaben mit den **echten** Saaten aus `saatAus` — mit ausgedachten Saaten
wäre der Test grün gewesen, während das Spiel den Fehler zeigt.

**Die Leertaste war ein Zug.** `useInput` bildet Space auf `drop` ab, und
Box Push wie Merge Up deuteten `drop` selbst zu „nach unten" um — weil ein
schneller Abwärtswisch ebenfalls als `drop` ankommt. Damit erbten sie
stillschweigend die Taste. In Box Push kostet jeder Zug Punkte, ein
versehentlicher Druck also vier. Behoben mit der neuen Option
`wurf` (Gegenstück zu `tippen`): Wer `wurf: 'down'` setzt, bekommt die
**Geste** und nicht die Taste. Die Umdeutung im Spiel entfällt.

**Ein Updater darf keine Nebenwirkungen haben.** In Box Push stand
`haptik('fehler')` innerhalb der `setZ`-Funktion. React ruft Updater
mehrfach auf, unter `<StrictMode>` in der Entwicklung grundsätzlich — der
Stups kam zweimal. Der Updater rechnet jetzt nur noch und merkt sich den
Ausgang; gemeldet wird danach, genau einmal je Zug.

**Ein Auffangnetz, das nichts auffangen kann, ist nur eine Nebenwirkung.**
Am Steuerkreuz von Box Push stand neben `bereitRef` eine Zeitsperre von
110 ms, begründet als Absicherung gegen ein ausbleibendes `pointerup`. Das
konnte sie nie sein: Bleibt das `pointerup` aus, steht `bereitRef` dauerhaft
auf `false` und **kein** Zug kommt mehr durch. Übrig blieb, dass ab etwa
neun Tipps je Sekunde jeder zweite lautlos verfiel.

**Ein Übergang schlägt eine Animation.** In Brain Blitz stand `scale` in der
`transition`-Liste der Antwortknöpfe. Im Moment der Antwort wird der Knopf
`disabled`, die Antipp-Stauchung fällt weg, und der Übergang ließ `scale`
100 ms lang zurücklaufen — genau über den Anfang der Aufplopp-Animation
(Höhepunkt bei 119 ms). Ergebnis: ein sichtbarer Ruck bei der wichtigsten
Rückmeldung des Spiels. `scale` gehört dort nicht hinein.

**`-1` bezeichnet das Ende des expliziten Rasters.** Beim Versuch, das
Querformat umzubauen, ergab `grid-row: 1 / -1` eine Zeile der Höhe null —
alle Zeilen entstanden erst durch automatische Platzierung, waren also
implizit. Siehe den Block „Handy im Querformat" in `index.css`; der Umbau
selbst ist begründet zurückgestellt.

**Zwei Leistungsstellen, beide über eine Eigenschaft, die nicht auf die
Grafikeinheit geht.** Der pulsierende Spielen-Knopf animierte `box-shadow`,
das Regenbogenfeld von Tap Rush `background-position` — beides erzwingt
Neuzeichnen, das Feld über den halben Bildschirm, sechzigmal je Sekunde.
Der Knopf hat jetzt einen festen Schatten, das Feld eine überbreite Ebene
im `::before`, die per `transform` wandert. Gleiches Bild, reine
Zusammensetzungsarbeit. Die **Zahl** darüber bleibt bewusst bei
`background-position`: Ihre Fläche ist der Text selbst
(`background-clip: text`), sie kann nicht auf eine eigene Ebene ausweichen
— und ein paar Ziffern kosten nichts.

**Das Punktgewinn-Popup war bei „weniger Bewegung" unsichtbar.**
`.punkte-auftauchen` endet mit `opacity: 0` und `forwards`; `.ruhig` kürzt
nur die Dauer, das Schlussbild bleibt. Wer weniger Bewegung wollte, bekam in
fünf Spielen gar keine Rückmeldung mehr. Das Verschwinden übernimmt ohnehin
JavaScript nach 900 ms — die Animation darf unter `.ruhig` ersatzlos
entfallen.

**Der I-Stein saß als einziger tiefer.** `MiniTeil` in Line Fall rechnete
Breite und Höhe aus dem **größten** dx/dy, nicht aus der Spanne. Beim
I-Stein liegen alle vier Zellen auf `dy = 1` — sein Vorschaukasten bekam
eine leere Kopfzeile. Jetzt wird auf den kleinsten Wert normiert.

**Was ein Agent nicht anfassen darf, muss jemand anders nachziehen.** Alle
zwanzig arbeiteten ausschließlich in ihrem eigenen `src/games/<id>/`. Alles
darüber hinaus — CLAUDE.md, `index.css`, `core/useInput.ts`,
`shell/spielfarbe.ts` — haben sie gemeldet statt geändert. Das ist die
richtige Regel; sie erzeugt aber eine Nachliste, und die ist Teil der
Arbeit, nicht ihr Rest.

## Flow MTB — Besonderheiten

Ronnis Wunsch: „ein physikbasiertes 2D-Mountainbike-Spiel … Speed + Airtime
+ Control + Landing." Interne `id` ist `radfahren`. **Das erste
Canvas-2D-Spiel im Projekt** — `CLAUDE.md` sah das für Spiele mit
fortlaufender Bewegung schon immer vor (siehe „Zu 3-D" weiter oben), nur
gab es bis hierhin keins. Dieselbe Dreiteilung wie bei Dash City:
`logik.ts` (reine Physik, ohne Browser geprüft), `zeichnen.ts` (Canvas,
kennt keine Spielregel), `FlowMtb.tsx` (verbindet nur Uhr, Eingabe,
Anzeige).

### Das Gelände: von einer Kette großer Sprünge zu vier Abschnittsarten

Die Strecke ist ein analytisches Höhenfeld — Sinuswellen plus Gauß-Glocken
für die Sprungschanzen (Kicker), mit von Hand hergeleiteter exakter
Ableitung (`bodenSteigung`) statt eines numerischen Differenzenquotienten:
Der Absprungwinkel hängt direkt daran, und ein rauschender Wert hieße ein
zufälliger Absprung.

`gelaendeBauen` ist in dieser einen Session **viermal** umgebaut worden,
jedes Mal auf eine konkrete Rückmeldung hin:

1. Hügel mit vereinzelten Kickern und großzügigem Flachstück dazwischen.
2. Rückmeldung: „Nicht so viele geraden Ebenen, die Sprünge müssen groß
   sein, sodass du in andere Sprünge springst." → eine ununterbrochene
   Kette großer Kicker.
3. Rückmeldung: „Jetzt spring ich ja wirklich nur in die Sprünge an, das
   sind einfach nur Zickzack … ich bin immer wieder an der gleichen Stelle
   aufgekommen." → **vier gewürfelte Abschnittsarten** statt einer festen
   Kette: `ruhig` (kein Kicker, nur Erholung und neuer Schwung), `doppel`
   (zwei kleine, eigenständige Buckel mit klarer Lücke dazwischen — ein
   „Double" im BMX-Sinn, Ronni: „kleine Hubbel, wo du versuchen musst, den
   anderen zu überspringen"), `kicker` (eine kurze Kette von zwei bis vier
   normalen Sprüngen) und `mega` (ein einzelner, deutlich größerer Sprung
   mit großzügiger Landezone — „ein paar Sprünge, die dich mega hoch
   kicken … aber nicht immer", daher der Würfel statt einer festen Abfolge).
4. Ein vierter, unsichtbarer Umbau: eine Obergrenze für die Steigung jedes
   Kickers, siehe unten — keine neue Abschnittsart, aber die wichtigste
   Korrektur von allen.

### Der wichtigste gefundene Fehler: eine Steigung, an der man für immer hängen bleibt

Der Fairness-Test (unten) blieb nach der dritten Fassung auf mehreren
Strecken rot — nicht durch Absturz, sondern weil der Bot **nie ankam**.
Ein Blick auf den mitgeloggten Verlauf zeigte: `vx` sank sanft gegen null
und blieb dort, exakt am selben `x`, für den Rest der 300 simulierten
Sekunden.

Der Grund ist reine Mathematik: Bergauf gilt
`vx -= sin(hangWinkel) · SCHWERKRAFT · dt`, bei vollem Gas kommt
`+ ANTRIEB · dt` dazu. Bei `ANTRIEB` = 11,5 und `SCHWERKRAFT` = 22 gibt es
einen exakten Winkel (`asin(ANTRIEB / SCHWERKRAFT)` ≈ 31,5°), an dem sich
beide **exakt aufheben** — ein stabiler Fixpunkt der Simulation, kein
Zufall. Ein Kicker, dessen Steigung diesen Winkel irgendwo auf seiner
Anfahrt überschreitet, hat zwangsläufig genau diesen einen Punkt, und ein
Fahrer, der dort mit zu wenig Schwung ankommt, konvergiert dorthin und
bleibt hängen.

Zwei Korrekturen zusammen beheben das:

- **`RUECKROLL_MAX`**: `vx` darf jetzt negativ werden (gedeckelt, nicht bei
  null abgeschnitten) — Ronni, unabhängig davon beobachtet: „Wenn man auf
  'nem Berg stehen bleiben sollte, sollte man auch zurückrollen, sonst
  sieht's komisch aus, wenn man einfach stehen bleibt, ohne die Bremse zu
  ziehen." Ohne diese Änderung fror `vx` am Fixpunkt komplett ein; damit
  kann die Schwerkraft einen wieder herunterziehen, sobald das Gas
  losgelassen wird.
- **`MAX_KICKER_STEIGUNG`**: Die Steigung von `kicker`- und
  `doppel`-Kickern ist jetzt strukturell gedeckelt (Sicherheitsabstand
  0,78 unter dem kritischen Winkel) — Höhe kommt seitdem aus einer
  **breiteren** Glocke, nicht aus einer steileren. Wichtig dabei: Nur das
  Rückrollen allein reichte nicht. Zwei benachbarte, beide zu steile
  Kicker (eine ganz normale Kicker-Kette) ließen den Bot endlos zwischen
  ihnen pendeln, weil der Boden dazwischen selbst zu steil war, um Schwung
  aufzubauen. Auch `mega`-Kicker bekamen die Decke, aus demselben Grund:
  Der Würfel verbietet nicht, dass zwei Mega-Abschnitte kurz hintereinander
  fallen, und genau diese Nachbarschaft war die eigentliche Falle, nicht
  die Höhe eines einzelnen Kickers für sich.

*Merksatz:* Wenn ein Bot an einer Stelle für immer hängen bleibt statt zu
stürzen, lohnt sich die Frage „gibt es hier einen Winkel, an dem sich zwei
Kräfte exakt aufheben?", bevor man an Bot-Verhalten oder Landeschwellen
herumjustiert — beides hätte hier nur Symptome behandelt.

### Der Fairness-Bot musste zweimal klüger werden — beide Male, um wie ein normaler Fahrer zu reagieren, nicht um besser zu spielen

Der Bot in `logik.test.ts` steht für „ein einfacher Fahrer, der es
trotzdem schafft" — wird er rot, ist eine Fahrwert-Änderung schiefgegangen,
nicht der Test. Zwei Nachbesserungen, keine davon macht ihn geschickter:

- **Zurückrollen statt stur Gas geben.** Ein Bot, der auf einem zu steilen
  Hang (siehe oben) stur Gas gibt, bleibt exakt am Fixpunkt hängen — genau
  das würde kein echter Fahrer tun. Mit einer einzigen Schwelle
  („Steigung > X → loslassen") wackelte das Gas aber bei jedem Bildschritt
  um genau diesen Winkel, ohne Boden gutzumachen. Erst zwei Schwellen mit
  Hysterese (loslassen über 0,55 Radiant, erst unter 0,2 wieder Gas geben)
  ließen ihn wirklich zurückrollen und neuen Anlauf holen, statt am Fuß
  desselben Stücks sofort wieder anzudrücken.
- **Vorausschau, die mit der Flugzeit wächst.** Die feste Vorausschau von
  0,3 s beim Zielen auf den Landewinkel passte zu kurzen Standard-Hüpfern,
  war aber bei einem Mega-Sprung (bis zu 1,6 s Flugzeit) viel zu
  kurzsichtig — der Bot zielte weit vor die tatsächliche Landestelle und
  stürzte zuverlässig. `vorausschau = 0.3 + luftZeit * 0.5` löst das: Wer
  spürt, dass er gerade lange fliegt statt kurz hoppelt, schaut weiter
  voraus — das ist eine Frage der Aufmerksamkeit, kein Können.

### Fahrgefühl

- **Lehnen in der Luft ist jetzt doppelt so stark** (`LUFT_DREHUNG`: 4,2 →
  8,5) — Rückmeldung: „Das Kippen nach vorne oder hinten muss leichter,
  heißt schneller gehen. Wenn ich nur kurz drauf tippe, soll sich schon
  gut was bewegen." Bei 4,2 baute ein kurzer, 100-ms-Antipper kaum mehr
  als 15° Drehung auf.
- **Die Steuerrichtung war einmal falsch herum** — echter Physik-Fehler,
  keine Geschmacksfrage. `Lauf.winkel` ist „positiv = Vorderrad hoch";
  Gewicht nach hinten (`lehnen = −1`) muss das Vorderrad anheben, genau wie
  bei jedem Trials- oder Hügel-Spiel. Rückmeldung: „Wenn ich den Pfeil nach
  hinten drücke, geht das Körpergewicht nicht nach hinten, sondern nach
  vorne." Ein fehlendes Minuszeichen bei `drehen -= e.lehnen * ...`
  reichte.
- **Ein Sturz bricht nicht mehr schlagartig ab.** Rückmeldung: „Falls man
  stürzt, soll es nicht im letzten Moment abbrechen, sondern man soll
  sehen, wie der Typ stürzt." Vorher fror `vx` im Sturzmoment hart auf
  null, und die Zusatzdrehung beim Zeichnen (`sturzDreh`) erreichte ihren
  Deckel schon nach 0,44 s — für den Rest der 1,1-Sekunden-Verzögerung bis
  zum Rundenende-Bildschirm stand die Szene dann einfach still. Jetzt
  behält der Sturz einen Rest Schwung (`vx * 0.35`), der über die
  Sturzuhr ausrollt, und die Drehung läuft über die **ganze**
  Verzögerung weiter statt nur über deren ersten Drittel. Der Punktestand
  ist davon unberührt: `FlowMtb.tsx` liest ihn genau einmal, im selben
  Bild, in dem `vorbei` wahr wird.

### Der Hintergrund: kompakt und ausdrücklich unbeweglich

Rückmeldung, nachdem die Sprünge größer wurden und mehr Weitsicht
brauchten: „Ich will gar nicht, dass man den Himmel sieht und dass da
Berge und Bäume sind, das sieht doof aus … nur den Grünstreifen von der
Wiese und darunter eine hellere und eine dunklere Schicht Erde." Die
komplette Parallax-Bergkette, Bäume und Steine sind deshalb weg.

Später durfte der Himmel wieder etwas werden — aber mit einer harten
Bedingung: „Überleg dir für den Hintergrund noch was Cooles, das schön
aussieht, aber sich nicht mitbewegt, weil das sonst doof aussieht und
irritiert." Himmel-Verlauf, ein festes Sonnenlicht und zwei Wolken stehen
deshalb **in Bildschirmkoordinaten**, nicht in Weltkoordinaten — kein
`kameraX` kommt in ihrer Rechnung vor, sie können sich also strukturell
nicht mitbewegen, ganz gleich was auf der Strecke passiert.

Der Boden selbst durfte dagegen Struktur bekommen, weil er Teil der
Strecke ist und zwangsläufig mitläuft: Recherche zu anderen 2D-Bike-Spielen
(Trials, Bike Mayhem, Mad Skills BMX 2) zeigte durchgehend drei bis vier
Erdschichten statt zweier, dazu einen hellen Saum direkt unter der
Grasnarbe („Sonne trifft die Kuppe"). Beides jetzt über zusätzliche Aufrufe
derselben `bodenFlaeche()`-Funktion. **Die Reihenfolge dieser Aufrufe ist
keine Nebensache**: Jede Schicht füllt von ihrem eigenen `versatz` bis zum
unteren Bildrand, eine später gezeichnete Schicht übermalt also alles
darüber. Sichtbar bleibt von jeder Schicht nur das Band bis zur
**nächsten** — die Aufrufe müssen deshalb nach aufsteigendem `versatz`
sortiert sein, sonst verschluckt eine weiter oben ansetzende, aber später
gezeichnete Schicht alle vorherigen sofort wieder (genau das ist beim
ersten Versuch passiert).

Kein Staub, kein Rauch beim Aufschlagen — testweise drin, Rückmeldung:
„sieht komisch aus." Ersatzlos raus, die Federung zeigt den Einschlag
schon deutlich genug.

### Der Fahrer: Gelenkscheiben gegen Lücken in der Silhouette

Rumpf, Arme und Beine sind wie bei Dash Citys Läufer keine Rohre, sondern
weiche Kapseln mit rundem Ansatz und Gelenk (`glied()`), der Rumpf ein
geschlossener Umriss mit unterschiedlicher Wölbung von Rücken- und
Bauchseite.

**Ein echter Geometrie-Fehler, kein Geschmacksurteil:** Rückmeldung: „Bei
dem Fahrer gibt's einen Fehler, an der Schulter ist dann kurz nichts, da
ist was raus." Der Rumpf rundet die Schulter nur über einen Halbkreis ab
(die andere Hälfte gehört den Kurven zur Hüfte), und an der Hüfte endet er
mit einer geraden Kante (`closePath()` zieht dort nur eine Sehne, keinen
Bogen). Arm- und Beinansatz decken mit ihrer eigenen Kapsel-Rundung zwar
das meiste davon ab, aber nicht den vollen Kreis — bei der Schulter blieb
ein schmaler Keil übrig, durch den der Himmel durchschien. Eine einfache
gefüllte Scheibe an Hüfte und Schulter, unter Arm/Hals bzw. schon unter dem
Bein gezeichnet, schließt die Lücke **unabhängig vom genauen Winkel** —
robuster, als die Kurven nur für die aktuelle Körperhaltung enger
zusammenzuziehen. Kleinere Geschwister davon sitzen jetzt auch an Ellbogen
und Knie, wo der Übergang zwischen den beiden Kapseln eines Glieds sonst
als Knick statt als Gelenk gelesen wird — dieselbe Lücken-Anfälligkeit,
nur unauffälliger.

Recherche zu Fahrerfiguren in anderen 2D-Bike-Spielen (Trials, Bike Mayhem,
Mad Skills BMX 2, Happy Wheels) bestätigt: **Ein sichtbar dünner Hals ist
einer der zuverlässigsten Gründe, warum eine Figur aus Grundformen nach
Strichmännchen statt nach Körper aussieht.**

### Der Fahrer, zweite Runde: breiter, mit echter Gelenk-IK

Trotz der Gelenkscheiben blieb die Rückmeldung: „Sieht immer noch aus wie
ein kleines Strichmännchen — viel breiter mit Schultern und so weiter."
Diesmal ein größerer Umbau statt einzelner Korrekturen:

- **Rumpftiefe deutlich größer** (`breitSchulter` 0,15 m → 0,24 m,
  `breitHuefte` 0,115 m → 0,17 m) und alle Gliedmaßen-Kapseln um rund
  40 % dicker. Wichtig für das Verständnis: In der Seitenansicht dieses
  Spiels ist „breite Schultern" keine Links-Rechts-Breite (die sieht man
  von der Seite nie), sondern die Tiefe des Rumpfs an der Schulterstelle
  — genau der Wert, der hier wächst.
- **Zwei-Knochen-IK für Arm und Bein doch noch gebaut**, obwohl zuerst als
  „struktureller Umbau, kein Fehler" zurückgestellt: Mit den jetzt viel
  dickeren Gliedmaßen fiel eine feste Ellbogen-/Knie-Position (das zweite
  Segment „atmete" in der Länge, um trotzdem Lenker/Pedal zu erreichen)
  deutlich mehr auf als vorher. `zweiKnochenIK()` hält beide
  Segmentlängen fest und berechnet das Gelenk über den Kosinussatz.
- **Reine IK reicht beim Bein nicht.** Anders als der Lenker (bleibt
  ungefähr an einem Fleck) läuft das Pedal einmal ganz im Kreis um das
  Tretlager. Eine feste Biegeseite relativ zur mitdrehenden Hüfte-Pedal-
  Linie heißt dann: Das Knie klappt einmal je Kurbelumdrehung auf die
  andere Seite um. Rückmeldung: „Die Bewegung vom Bein ist unnatürlich …
  das soll nicht die ganze Zeit umknicken." Behoben, indem **beide**
  Lösungen des Kosinussatzes berechnet und die mit dem kleineren `y`
  (bildschirmoben) genommen wird — die Seite, zu der ein echtes Knie beim
  Treten tatsächlich ausweicht, unabhängig von der Pedalstellung. An der
  Stelle völliger Streckung fallen beide Lösungen ohnehin zusammen, der
  Wechsel ist dort unsichtbar.
- **Die Kurbel drehte sich viel zu schnell** (Faktor 0,55 auf die
  Rad-Umdrehung, über drei Umdrehungen je Sekunde bei Höchsttempo) —
  bei den jetzt kräftigeren, sichtbareren Beinen las sich das nicht mehr
  als Treten, sondern als Zittern. Auf 0,22 gesenkt (Rückmeldung: „die
  Beinbewegung kann langsamer sein").
- **Der Hals wanderte zweimal.** Erste Korrektur: kräftiger, aber gleich
  lang — blieb als eigenständiger Stab zwischen Helm und Rumpf sichtbar.
  Der eigentliche Fehler war die **Länge**, nicht die Dicke: Beide
  Ansatzpunkte lagen weit draußen vor Helm- und Rumpfkontur. Jetzt beginnt
  der Hals innerhalb der Schulterkontur und endet innerhalb der
  Helmschale, dazu ein Kragen in Trikotfarbe am Ansatz. Zweite Korrektur,
  nachdem das den Hals zwar kürzte, ihn aber „vor die Schulter" schob:
  **Zeichenreihenfolge.** Der Hals wurde nach dem Arm gezeichnet und
  malte sich dadurch über dessen Schulteransatz. Jetzt kommt der Hals
  gleich nach dem Rumpf; Schulterscheibe, Rückenprotektor und Arm werden
  **danach** gezeichnet und übermalen seinen Ansatz wieder — sichtbar
  bleibt nur das kurze Stück zwischen Kragen und Helm. *Merksatz:* Bei
  gestapelten Canvas-Formen entscheidet die Zeichenreihenfolge genauso
  über das Ergebnis wie die Geometrie selbst — eine an sich richtige Form
  kann trotzdem falsch aussehen, wenn sie zur falschen Zeit gezeichnet wird.

### Schwerer, weil Steuern jetzt wirklich nötig ist

Rückmeldung: „Das kann viel schwerer werden — ich muss überhaupt nicht
Gewicht nach vorne oder hinten legen, wenn ich einfach die ganze Zeit auf
Gas drücke, kriege ich meine Punkte." Der Grund: `drehen` (die Drehrate)
stand beim Abheben immer exakt bei null. Ein Sprung ganz ohne Eingabe
behielt dadurch einfach den Absprungwinkel bis zur Landung bei — und der
liegt bei vielen Kickern zufällig schon nahe am Landewinkel.

**Erster Versuch, gescheitert:** die tatsächliche Drehrate der Kuppe beim
Abheben mit in die Luft nehmen — ob als diskrete Differenz aus der
Anlege-Dämpfung oder als exakte analytische Formel aus Krümmung und Tempo,
beide Fassungen rissen den Bildraten-Fairness-Test auf 70 bis 80 %
Abweichung. Der Grund lag nicht an der Formel, sondern **wann** genau
abgehoben wird: eine Schwellwert-Prüfung, die einmal je Bild läuft, und der
erkannte Absprungpunkt liegt bei 30 und 60 Bildern je Sekunde immer ein
kleines Stück auseinander. Eine Winkel*position* verzeiht das (der Fehler
bleibt über den ganzen Flug konstant); eine Winkel*geschwindigkeit*, die
sich über eine mehrsekündige Flugbahn aufsummiert, verstärkt genau diesen
kleinen Unterschied — und weil Landequalität eine Schwelle ist
(gut/hart/Sturz), kippt daraus schon mal ein Sturz bei der einen Bildrate,
der bei der anderen keiner ist.

**Die tatsächliche Lösung stand an einer ganz anderen Stelle:** eine
**feste** Drehbeschleunigung nach unten (`NATUR_NICKEN`), die während der
ganzen Flugzeit wirkt — genau derselbe Aufbau wie der `lehnen`-Steuerterm
selbst, der diesen Test nie gestört hat, statt eines einmaligen Werts beim
Absprung. Zusammen mit der vorhandenen Dämpfung pendelt sich die Drehrate
ohne Gegensteuern auf eine feste Sink-Rate ein — über eine mehrsekündige
Flugbahn dreht die Nase spürbar nach unten. Wer landen will, muss aktiv
gegenhalten. Ein eigener Test (`hält den Absprungwinkel ohne Eingabe nicht
von selbst`) sichert genau das ab: Nach einer Sekunde Flug ohne jede
Eingabe muss `winkel` um mehr als 0,15 Radiant gedriftet sein.

*Merksatz, zweimal in dieser Session bestätigt:* Wenn ein Fairness-Test bei
einer Physik-Änderung ausschlägt, die um Größenordnungen über der üblichen
Rundungstoleranz liegt, ist meist nicht die Formel falsch, sondern **wo**
im Ablauf sie ansetzt — an einer diskreten Schwellwert-Prüfung oder an
einem einmaligen Übergabepunkt hängt Bildraten-Sensitivität, die an einem
kontinuierlich wirkenden Term (wie der bestehenden `lehnen`-Steuerung)
nicht entsteht.

### Sounds

Ausdrücklich keine Toneffekte — Rückmeldung: „Macht die Sounds weg."
`sfx()` ist komplett raus; `haptik()` bleibt (kein Ton, auf Florians
Geräten ohnehin stumm, siehe „Feiern, Spielstart, Haptik" weiter oben),
gemeldet wird nur noch der Sturz und ein gewonnener Lauf.

### Tricks — der Punktetopf, den es schon in der ersten Spielbeschreibung gab

Ronnis eigene Vorgabe für die Punkte nannte von Anfang an „Score entsteht
aus … Distanz, **Tricks**, perfekte Landungen, Flow" — nur gab es dafür nie
eine Zählung. Ein Salto brachte nicht mehr Punkte als derselbe Sprung ohne.

- **Volle Drehungen zählen exakt, ohne eigene Zählschleife**, weil
  `winkel` in der Luft unbeschränkt ist (siehe `winkelKuerzen`s Kommentar
  zu Saltos): Die reine Differenz zwischen Absprungwinkel
  (`luftDrehStart`, beim Abheben gemerkt) und Landewinkel, geteilt durch
  2π, ist die Zahl der vollen Umdrehungen — abgerundet, ganz gleich wie
  „krumm" die Landung war.
- **Nur wer die Landung steht, bekommt den Trick.** Ein Sturz zählt nicht
  — dieselbe Regel wie beim Skaten oder Snowboarden: Der Trick ist erst
  „geschafft", wenn man ihn auch fährt. `hart` zählt dagegen mit (der
  Tempoverlust bestraft die unsaubere Landung schon selbst).
- **Eigener Punktetopf** (`trickPunkte`), nie geleert — dieselbe Regel wie
  `doppelPunkte` bei Dash City: Was man sich verdient hat, darf nicht
  wieder verschwinden.
- Anzeige als eigenes Badge unter dem Flow-Zähler (Pink statt Teal, klare
  Unterscheidung), Grad-Angabe wie im echten Sprachgebrauch der Szene
  (`360°`, `720°`) statt „×1 Drehung".

### Boden-Textur: Gefälle-Tönung und kahle Kicker

Zwei Punkte aus der Umgebungs-Recherche zu anderen 2D-Bike-Spielen
nachgezogen, beide ohne neue Zeichentechnik:

- **`bodenOben` wird segmentweise statt in einer Fläche gefüllt**, mit dem
  Ton aus der tatsächlichen Steigung an der Stelle (`bodenSteigung`, exakt
  vorhanden, nicht geschätzt) — steile Anstiege liegen dunkler, als läge
  dort ein eigener Schatten. Bewusst nur diese eine Schicht segmentiert,
  nicht alle fünf Erdschichten: Sie macht den größten Teil des sichtbaren
  Bodens aus, der Zusatzaufwand für die übrigen vier stünde in keinem
  Verhältnis zum zusätzlichen Bild.
- **Der Grasstrich setzt an Kickern aus.** Trials, Bike Mayhem und Mad
  Skills BMX 2 zeigen an Sprungschanzen durchgehend kahle, festgefahrene
  Erde statt Gras. Ohne den Unterschied liest sich ein Kicker wie ein
  normaler Hügel und wird erst in der eigenen Flugbahn als Sprung
  erkennbar, nicht schon vorher im Bild. `aufKicker(wx)` prüft den Abstand
  zu jeder Kickermitte; der Grasstrich wird dafür in Teilstücke zerlegt
  (`grasOffen`-Muster, dieselbe Technik wie bei der Feder-Wendel weiter
  oben) statt als ein durchgehender Pfad.
- **Kleine Steine direkt in der Grasnarbe verankert**, deterministisch aus
  einer reinen Hash-Funktion der Weltposition (`streuWert(x)`, Sinus-Rausch-
  Trick, kein `Math.random()`) — ohne dass dafür ein eigenes Feld in
  `Gelaende` nötig wäre. Bei derselben Weltposition liegt also immer
  derselbe Stein, unabhängig vom Bildaufbau. Bewusst **keine** eigene
  Saat aus `core/rng.ts`: Die Position eines Steins ist reine Deko ohne
  Einfluss auf Spielregeln oder die Strecken-Wiederholbarkeit über
  Levelnummern, die feste Projekt-Regel „nie `Math.random`" gilt für
  genau diesen Fall (Gelände, Aufgaben, alles Regelhafte) — nicht für
  jede Zeile Zeichencode.
- **Noch offen aus derselben Recherche:** eine echte Körnungs-Textur
  (Canvas-Pattern, Vorbild `laufen/texturen.ts`). Fleißarbeit, keine
  schwierige Entscheidung — nachziehbar, wenn noch mehr Bodendetail
  gewünscht ist.

### Kamera-Wackeln bei harten Landungen

Rückmeldung nach der ersten Bewertungsrunde: Es fehlte „echte
Kamera-Dramatik". Dieselbe Stoß-Erkennung, die schon die Federung
antreibt (`vyVorher − vy`, siehe oben), löst jetzt zusätzlich ein kurzes
Wackeln aus — ein Sturz braucht dafür **keinen eigenen Sonderfall**: `vy`
springt beim Aufsetzen in beiden Fällen (harte Landung wie Sturz)
gleichermaßen auf null, der Stoß sieht also identisch aus.

- Nur ab einer echt harten Landung (`kraft > 0,35`), nicht bei jedem
  normalen Aufsetzen — sonst zittert das Bild dauernd mit und die
  Landungsqualität hätte kein sichtbares Gefälle mehr.
- **Vor dem Gelände-Umriss berechnet, nicht erst beim Rad** — damit
  wackelt bei einem harten Einschlag das ganze Bild (Boden und Rad
  zusammen) synchron, nicht das Rad einen Bildschritt später als der
  Hintergrund.
- `Math.random()` für den Zitter-Ausschlag ist hier absichtlich in
  Ordnung: reine Bildschirm-Deko ohne jede Auswirkung auf Spielregeln,
  anders als beim Gelände selbst.

### Die Fairness-Tests

`läuft bei jeder Bildrate praktisch gleich weit` und
`lässt einen einfachen Fahrer zehn verschiedene Strecken schaffen` sind
die wichtigsten im Spiel — dieselbe Rolle wie `istPassierbar` bei Dash
City. Beide liefen während dieser Session mehrfach rot, nie wegen eines
Fehlers im Test selbst, sondern weil eine Fahrwert- oder
Gelände-Änderung eine der beiden Garantien gebrochen hatte (siehe oben).
Ein temporäres Debug-Skript mit Sekunden-für-Sekunden-Ausgabe (`console.log`
je simulierter Sekunde, `--reporter=verbose` nötig, sonst unterdrückt
Vitest die Ausgabe) war beide Male der schnellste Weg zur Diagnose —
schneller als Vermutungen im Code nachzuverfolgen.

### „Nur Gas geben" darf nicht ans Ziel führen — die zweite Fairness-Garantie

Rückmeldung, nachdem die erste 9-von-10-Bewertungsrunde (Tricks,
Bodentextur, Kamera-Wackeln, Steine — siehe oben) live gespielt wurde,
wörtlich: „Man muss nichts machen — wenn ich nur Gas gebe, komme ich auch
ans Ziel, so sollte das nicht sein. Es sollte immer notwendig sein, sich
je nach Sprung richtig zu bewegen." Bis dahin hielt `winkel` in der Luft
ohne jede `lehnen`-Eingabe exakt den Absprungwinkel — bei den meisten
Kickern reicht das zufällig für eine gute Landung, Steuern war reine
Kür, keine Pflicht.

Das ist die **Umkehrung** der Fairness-Garantie oben: Dort muss ein
**aktiver** Bot immer durchkommen, hier darf ein **passiver** Bot (Gas
halten, nie lehnen) es nicht zuverlässig schaffen. Beide Anforderungen
gleichzeitig zu erfüllen war die aufwendigste Änderung der ganzen
Session, weil jeder Parameter, der die eine Garantie stärkt, die andere
schwächt.

**Erster Versuch, verworfen: `drehen` beim Abheben mitnehmen.** Die
naheliegende Idee — den `drehen`-Wert vom Boden einfach mit in die Luft
übernehmen, statt ihn beim Abheben auf null zu setzen — brach die
Bildraten-Unabhängigkeit katastrophal (bis zu 80 % Wegabweichung
zwischen 30 und 60 fps). Grund: „Abheben" ist eine einmalige,
Bild-diskrete Schwellenwert-Prüfung (`vy` überschreitet einen Grenzwert),
und der exakt erkannte Bild-Zeitpunkt verschiebt sich je nach `dt` um
einen Bruchteil eines Bildes. Eine **Position** an dieser Stelle
mitzunehmen ist unkritisch (der Fehler ist winzig und bleibt es), aber
eine **Rate** mitzunehmen (`drehen`, wirkt über die gesamte folgende
Flugzeit) verstärkt genau diesen winzigen Zeitunterschied über mehrere
Sekunden Flug hinweg — und ob ein Lauf stürzt oder nicht, ist wieder ein
harter Schwellenwert, der bei der einen Bildrate kippen kann und bei der
anderen nicht. **Lehrstück:** Ein Zustand, der an einem einzelnen,
diskreten Ereignis „eingefroren" wird, darf nie eine Rate sein, nur eine
Position — sonst multipliziert sich ein Bild-Rundungsfehler über die Zeit
zu einem Verhaltensunterschied.

**Zweiter, erfolgreicher Ansatz: `NATUR_NICKEN`.** Eine feste
Drehbeschleunigung nach unten, die während der **gesamten** Flugzeit
wirkt — strukturell identisch zum längst framerate-stabilen
`lehnen`-Term, nicht an ein einzelnes Bild gebunden, deshalb kein
Diskretisierungsproblem. Der Wert brauchte einen langen empirischen
Sweep über alle 10 Testtracks gleichzeitig gegen zwei Kennzahlen (aktiver
Bot muss 10/10 schaffen, passives Gas darf höchstens 2/10 schaffen):

| `NATUR_NICKEN` | passives Gas | Beobachtung |
| --- | --- | --- |
| 2–5 | 9–10 / 10 | Zu schwach: Kicker-Absprünge drehen ohnehin meist nasenauf, und die zufällige Nicken-Richtung trifft die Landung „aus Versehen" fast immer richtig. |
| 7–10 | 0–4 / 10 | Ab hier kippt das Verhältnis spürbar. |
| **8** | **1 / 10** | Gewählter Wert — beide Garantien gleichzeitig grün. |

**Die eigentliche Falle lag aber nicht bei `NATUR_NICKEN`, sondern bei
`LUFT_DREHUNG`.** Um sicherzustellen, dass aktives Gegenlenken die
passive Drift klar dominiert, wurde `LUFT_DREHUNG` (wie schnell `lehnen`
das Rad dreht) zwischenzeitlich von 8,5 auf 16 angehoben. Das brach
prompt den Fairness-Bot: Bei so hohem Antrieb je `lehnen`-Einheit
überschoss ein reiner Proportionalregler (`lehnen = -unterschied · Kp`)
sein Ziel regelmäßig um mehrere zehn Grad — beobachtete Ausschläge von
+0,43 auf −1,15 Radiant innerhalb von 0,5 s, direkt gefolgt von einem
Sturz. Des Rätsels Lösung stand die ganze Zeit schon in einem anderen
Test (`hält den Absprungwinkel ohne Eingabe nicht von selbst`): Der prüft
nur das **Vorzeichen** der Drehung, keinen Betrag — `LUFT_DREHUNG` muss
`NATUR_NICKEN` bloß übersteigen, nicht um den Faktor Zwei. Zurückgesetzt
auf `10` (weiterhin klar über `NATUR_NICKEN` = 8) verschwand ein Großteil
des Überschießens von selbst, weil die Regelstrecke insgesamt weniger
aggressiv reagiert.

**Der Rest des Überschießens brauchte einen echten PD-Regler — und ein
falsches Vorzeichen sah lange wie „Dämpfung hilft nicht" aus.** `winkel`
und `drehen` bilden eine Kette aus zwei Integratoren (`lehnen` verändert
`drehen`, `drehen` verändert `winkel`); ein reiner P-Regler auf `winkel`
bremst diese Kette strukturell nicht rechtzeitig ab, bevor sie am Ziel
vorbeischießt. Der naheliegende Dämpfungsterm `- drehen · Kd` machte es
in jedem Sweep **schlechter**, nie besser — bis klar wurde, warum: `lehnen`
wirkt über `drehen -= lehnen · LUFT_DREHUNG · dt`, positives `lehnen`
macht `drehen` also *kleiner*. Ist `drehen` bereits negativ (Nase dreht
schon abwärts), addiert `- drehen · Kd` einen *positiven* Beitrag zu
`lehnen` und beschleunigt damit die ohnehin laufende Drehung weiter,
statt sie zu bremsen — das exakte Gegenteil des gewünschten Effekts. Mit
dem korrigierten Vorzeichen (`+ drehen · Kd`) schafft derselbe Bot
zuverlässig alle 10 Strecken, wo vorher bei bestem Tuning nur 7 von 10
standen; siehe die ausführliche Herleitung direkt im Bot-Code in
`logik.test.ts`.

**Endstand:** `LUFT_DREHUNG = 10`, `NATUR_NICKEN = 8`, Fairness-Bot mit
`lehnen = -unterschied · 2 + drehen · 1,2` (echter PD-Regler, richtiges
Vorzeichen). Beide Fairness-Tests grün, dazu ein neuer dritter Test
(`kommt mit reinem Gasgeben nicht zuverlässig ins Ziel`), der Ronnis
Anforderung direkt in Code fasst — die genaue Schwelle wurde in der
nächsten Runde noch einmal angepasst, siehe unten.

Der Bildraten-Test (`läuft bei jeder Bildrate praktisch gleich weit`)
läuft seitdem **mit dem aktiven Bot**, nicht mehr mit purem Gas — reines
Gas stürzt jetzt (gewollt) irgendwann, und ein Sturz ist ein
Bild-diskreter Schwellenwert, dessen exakter Zeitpunkt naturgemäß
zwischen 30 und 60 fps leicht schwankt. Das ist kein Fehler, sondern die
gewollte Folge der neuen Schwierigkeit — es sagt nur nichts mehr über die
eigentliche Physik-Integration aus. Der zuverlässig durchkommende Bot
bleibt dagegen aussagekräftig, siehe Kommentar direkt im Test.

### „Leider nicht spielbar" — als die Theorie auf ein echtes Gerät traf

Direkt nach dem Deploy der obigen Änderung, live auf einem Touchscreen
getestet: „Leider nicht spielbar." Zwei **unabhängige** Ursachen, beide
gefunden und behoben, nicht nur eine:

**1) Ein echter Multitouch-Bug.** Rückmeldung: „Ich kann nur eine Taste
drücken um zu fahren, dann funktioniert die Taste für Vorne/Hinten
nicht mehr." Der Bühnenbereich (`buehneRef`) hatte `touch-action: none`,
aber die einzelnen Steuerknöpfe selbst nicht — nur vom Elternbereich
„geerbt". Auf iOS Safari reicht das nicht zuverlässig: Setzt ein zweiter
Finger auf einem anderen Element auf, während der erste noch hält, wertet
der Browser das mitunter als Beginn einer Mehrfinger-Geste statt als
zwei unabhängige Tastendrücke — „Gas" bleibt gedrückt, „Vorne"/„Hinten"
reagiert nicht mehr. **Fix:** `touch-action: none` zusätzlich direkt an
jedem einzelnen Knopf (`Knopf`-Komponente in `FlowMtb.tsx`), nicht nur am
Elternbereich.

**2) Die Physik war nur gegen einen unrealistischen Bot geprüft.** Der
Fairness-Bot in `logik.test.ts` steuert **analog** (`lehnen` ist ein
Fließkommawert zwischen −1 und 1, kontinuierlich neu berechnet). Ein
echter Spieler kann das nicht — `lehnen` ist im ganzen Spiel immer binär
(−1, 0 oder 1, siehe `FlowMtb.tsx`, Tastatur wie Bildschirmknöpfe), dazu
kommt echte menschliche Reaktionszeit. Ein Debug-Bot, der genau das
nachbildet (binäre Entscheidung, nur alle paar Bilder neu bewertet, ~100
ms Reaktionszeit), schaffte bei der scharfen Abstimmung von oben nur 3–7
von 10 Strecken — nicht „Steuern nötig", sondern „mit echter Eingabe
kaum zu schaffen". Der Multitouch-Bug oben hat das vermutlich zusätzlich
verschärft: Solange nur „Gas" ankam, WAR die Eingabe praktisch der reine
Passiv-Fall, der jetzt fast überall crasht.

**Zwei Physik-Anpassungen beheben das, ohne die Kernanforderung
aufzugeben:**

- **`NATUR_NICKEN_GRENZE`** deckelt, wie weit die passive Drift den
  Absprungwinkel höchstens verschlechtert (`0,55` Radiant), statt endlos
  weiterzubeschleunigen. Ohne Deckel wächst die nötige Korrektur bei
  langen Sprüngen (Mega-Kicker, ~1,6 s) schneller, als ein Mensch mit
  Reaktionszeit sie einholen kann — nicht mehr fordernd, sondern
  unmöglich. Mit Deckel pendelt sich das Rad (durch die Dämpfung) auf der
  Schräglage ein, statt sich weiterzudrehen — ein realistischer,
  verzögert reagierender Spieler-Bot kommt damit wieder auf 9–10 von 10
  Strecken.
- **`NATUR_NICKEN_VERZOEGERUNG`** (eine Gnadenfrist nach dem Abheben, bevor
  die Drift überhaupt einsetzt) wurde dabei probiert und wieder auf `0`
  zurückgesetzt: Sie nahm ausgerechnet den **kurzen** Kicker-Hüpfern (oft
  nur 0,3–0,5 s Flugzeit) einen Großteil ihrer ohnehin schon kurzen
  Drift-Zeit weg, wodurch reines Gasgeben auf genau diesen Sprüngen wieder
  fast immer gewann (10/10 statt der angestrebten Minderheit). Der Deckel
  allein trifft den Kompromiss besser: Er wirkt sofort (kurze Sprünge
  bleiben ein Risiko), aber nie unbegrenzt (lange Sprünge werden nicht
  unmöglich).
- Die Test-Schwelle in `kommt mit reinem Gasgeben nicht zuverlässig ins
  Ziel` wurde von „< 3 von 10" auf „< 6 von 10" gelockert — ehrlich
  benannt als der Punkt, an dem beide echten Anforderungen gleichzeitig
  gelten: reines Gasgeben verliert verlässlich seinen Status als
  Gewinnstrategie (Mehrheit scheitert), aber ein realistischer Spieler
  mit binärer, verzögerter Eingabe bekommt weiterhin eine faire Chance.
  Die vollständige Herleitung („< 3" verlangte eine Präzision, die nur
  ein Bot mit Analogsteuerung und Null-Latenz aufbringen kann) steht
  direkt im Testkommentar.

**Lehrstück:** Ein Fairness-Bot ist nur so aussagekräftig wie sein
Eingabemodell. Ein Bot mit Fähigkeiten, die der echte Spieler strukturell
nicht hat (hier: Analogsteuerung statt Tastendruck, Reaktion ohne
Verzögerung), beweist Spielbarkeit für einen Spieler, den es nicht gibt.

### Game-Feel-Runde: weiche Lehnen-Rampe, Landungs-Haptik

Auftrag: Steuerung soll sich weicher anfühlen, ohne die Physik-Grundstruktur
umzubauen, und Landungen sollen spürbarer sein.

- **`lehnen` läuft jetzt über eine Rampe in `FlowMtb.tsx`**, nicht mehr
  direkt von Taste/Knopf in `takt()`. Ein neues Ref (`lehnenZielRef`) hält
  das eigentliche Ziel (weiterhin binär, −1/0/1 — die Eingabe selbst bleibt
  ein Schalter, siehe `NATUR_NICKEN_VERZOEGERUNG`); der tatsächliche
  `eingabeRef.current.lehnen`-Wert nähert sich diesem Ziel jedes Bild ein
  Stück an (volle Auslenkung in `RAMPZEIT` = 0,1 s). `takt()` selbst
  bekommt dadurch **nie** einen Sprung mehr zu sehen, nur eine stetig
  veränderliche Zahl — dieselbe Eingabeform, die der Fairness-Bot in
  `logik.test.ts` ohnehin schon nutzt. `logik.ts` musste dafür nicht
  angefasst werden.
- **Die Rampe kostet spürbar Reaktionsgeschwindigkeit**, gemessen am
  selben realistischen Bot-Modell wie oben (binär + Reaktionsverzögerung),
  jetzt zusätzlich mit derselben 0,1-s-Rampe wie die echte UI: Bei den
  alten Werten (`LUFT_DREHUNG=10`, `NATUR_NICKEN=8`) fiel die Erfolgsquote
  streckenweise auf 3–4 von 10. **`LUFT_DREHUNG` auf 9, `NATUR_NICKEN` auf
  7 gesenkt** (beide um denselben Betrag, derselbe Sicherheitsabstand wie
  vorher) gleicht das wieder aus, ohne die Fairness-Garantie (aktiver Bot
  10/10) oder die Mehrheit-scheitert-Anforderung (passiv 5/10) zu
  gefährden. `LUFT_DREHUNG=9 > NATUR_NICKEN=7` bleibt dabei zwingend nötig
  — sonst reißt „dreht das Rad in der Luft, wenn man lehnt".
- **Landungs-Haptik:** `core/haptik.ts` bekam drei neue, Flow-MTB-eigene
  Anlässe (`perfekt`/`gut`/`hart`, 8/14/30 ms) zusätzlich zu den
  ursprünglichen drei projektweiten (`ende`/`jubel`/`fehler`, die andere
  Spiele unverändert weiternutzen). `FlowMtb.tsx` löst sie beim Wechsel
  der Landungsart aus — Landungen sind bereits diskrete Ereignisse (nicht
  jedes Bild), das reicht als Drosselung, ohne extra Cooldown.
- **Dezenter visueller Impact:** ein sehr kurzer (~150 ms), sehr
  schwacher (12 % Deckkraft) weißer Vollbild-Blitz in `zeichnen.ts` bei
  einer perfekten Landung — das optische Gegenstück zum bestehenden
  Kamera-Wackeln bei harten Landungen. Bewusst **kein Text**, siehe oben
  (Ronni: „PERFEKT!" wurde ausdrücklich entfernt, das bleibt so).

## Befehle

```bash
npm run dev     # Entwicklungsserver auf http://localhost:5180
npm test        # Tests einmal durchlaufen
npm run build   # Typprüfung und fertige Fassung nach dist/
node werkzeuge/icons-erzeugen.mjs   # App-Symbole neu erzeugen
```
