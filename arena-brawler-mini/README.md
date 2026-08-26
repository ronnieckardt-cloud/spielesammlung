# Arena Brawler Mini

Vereinfachtes 2D-Arena-Kampf-Minispiel inspiriert von klassischen Brawler-Mechaniken.
Kein Bezug zu bestehenden Marken.

> Eigenständiger Prototyp in diesem Unterordner, gebaut mit Phaser 3. Läuft
> unabhängig von der Spielesammlung im übergeordneten Verzeichnis (eigenes
> `index.html`, kein Vite-Build, kein TypeScript) und ist nicht Teil davon.

## Starten

Einfach `index.html` im Browser öffnen oder mit einem Live-Server starten.

## Steuerung

Zielgerät ist der Touchscreen (iPhone, iPad) — die Tastatur ist nur die
Zugabe fürs Testen am Rechner.

**Touch**

- Bewegen: Finger irgendwo aufs Spielfeld legen und ziehen. Der Stick
  erscheint dort, wo der Finger aufsetzt — es gibt keine falsche Stelle.
- Schießen: läuft von selbst auf den nächsten Gegner in Reichweite.

Damit reicht **ein** Finger. Das ist Absicht: Zwei gleichzeitige Finger sind
auf iOS Safari eine verlässliche Fehlerquelle (siehe die Flow-MTB-Notizen in
der `CLAUDE.md` der Spielesammlung).

**Tastatur**

- Bewegen: WASD oder Pfeiltasten
- Schießen: Leertaste (zusätzlich zum Auto-Feuer)

## Charaktere

Vor jeder Runde wählt man einen von dreien. Die Werte gelten für die ganze
Runde; die Wellen-Aufwertungen rechnen darauf **auf**, ersetzen sie also
nicht — „Mehr Tempo" macht den Schnellen schneller als den Tank.

| | Aussehen | Leben | Tempo | Schusspause | Reichweite | Unverwundbar |
|---|---|---|---|---|---|---|
| Ausgewogen | blau, weiße Schulter- und Brustplatten, aufrecht | 5 | 200 | 250 ms | 460 | 900 ms |
| Schnell | dunkler Anzug, orange Akzente, vorgeneigt | 4 | 275 | 215 ms | 380 | 900 ms |
| Tank | olivgrün, graue Schulterpanzer, sehr breit | 7 | 165 | 300 ms | 460 | 1300 ms |

Alles ist **eckig** gezeichnet: Vielecke mit geraden Kanten, keine Kreise und
keine abgerundeten Balken. Das ist eine Folge der Größe, nicht des Geschmacks
— eine Rundung braucht mehrere Pixel, um als Rundung zu lesen, und wird bei
30 physischen Pixeln zu Matsch. Eine Kante bleibt eine Kante.

Aus demselben Grund wenige, große Farbflächen statt vieler kleiner Teile.
`Charaktere.teile()` liefert die Figur als Liste von Vielecken, getrennt vom
Zeichnen — so lässt sich die Gestalt lesen, ohne durch Grafikaufrufe zu waten.

Jede Figur wird **einmal** in eine 96er-Textur gezeichnet; Auswahlkarte und
Spielfeld benutzen dieselbe, nur in unterschiedlicher Größe. Damit können
Karte und Spiel nicht auseinanderlaufen — die Karte zeigt wirklich die Figur,
die man gleich steuert.

Groß zeichnen und klein anzeigen ist dabei kein Umweg: Im Spiel ist die Figur
48 Pixel breit, auf einem iPhone im Querformat noch rund 30 physische. Direkt
in dieser Größe gezeichnet franst jede Kante aus. Und alles Erkennbare steckt
im **Umriss** — Breite, Stand, Neigung —, weil bei dieser Größe kein Detail
mehr ankommt; dieselbe Lehre wie beim Männchen in Ghost Chase, wo mehr
Realismus die Figur schlechter erkennbar gemacht hätte.

**Auf dunklem Grund trennt eine dunkle Kontur gar nichts — das leisten nur die
hellen Flächen.** Der Schnelle war in einer Zwischenfassung ein schwarzer
Anzug mit schwarzer Kontur auf dem fast schwarzen Arenaboden und schlicht
nicht zu finden. Er trägt jetzt Orange an Helmkamm, Brustschräge, Unterarmen
und Stiefeln, und der Anzug ist Anthrazit statt Schwarz. Beim Tank deckte
umgekehrt eine graue Brustplatte über die volle Rumpfhöhe sein Grün zu; sie
ist auf ein schmales Band eingedampft.

Das Orange des Schnellen ist bewusst gelbstichig gewählt. Die Gegner sind rot
(`0xe74c3c`), und bei Tempo 275 quer über die Arena entscheidet der
Farbabstand mit darüber, ob man sich selbst noch wiederfindet. Aus demselben
Grund ist `farbe` (Kartenrand, Farbband) getrennt von `anzug`: Ein schwarzer
Kartenrand wäre unsichtbar.

**Die Anzeige ist größer als die Trefferfläche** (48 gegen 32). Der Umriss
braucht Fläche, die Spielregeln sollen sich aber nicht mit ändern. Achtung
beim Ändern: `body.setSize` rechnet in *Textur*pixeln und wird danach mit der
Sprite-Skalierung multipliziert — ein glattes `setSize(32, 32)` ergäbe hier
13 × 13, und der Spieler wäre plötzlich kaum noch zu treffen, ohne dass eine
Regel angefasst wurde. Deshalb wird gegengerechnet, und ein Test hält die
32 × 32 fest.

Der Tank bekommt eine **längere** Unverwundbarkeit, nicht wie ursprünglich
angedacht eine kürzere: Eine kürzere wäre für ihn ein Nachteil und das genaue
Gegenteil seiner Rolle. Wer viel einsteckt, soll nach einem Treffer auch Zeit
haben, sich aus dem Getümmel zu lösen.

Auch der langsamste Charakter läuft mit 165 noch klar schneller als der
schnellste Gegner (100, gedeckelt) — sonst wäre der Tank ab Welle 10 nicht
schwer, sondern unspielbar. Ein Test sichert diesen Abstand ab.

**Nach dem Game Over geht es zurück zur Charakterwahl**, nicht direkt in
dieselbe Runde. Der Prototyp hat keinen Menüknopf, mit dem man zurück zur Wahl
käme; wer einmal „Tank" getippt hat, bliebe sonst für immer beim Tank, und der
ganze Sinn dreier Charaktere wäre weg. Damit schnelles Weiterspielen trotzdem
schnell bleibt, ist der zuletzt gespielte Charakter markiert — man sucht ihn
nicht, man sieht ihn.

## Charakterbilder aus `assets/images/`

Liegen dort `char-ausgewogen.png`, `char-schnell.png` und `char-tank.png`,
werden sie als Sprites benutzt — auf der Auswahlkarte **und** im Spiel, beide
über dieselbe Weiche (`Charaktere.bildSchluessel`), damit sie nicht
auseinanderlaufen können.

Fehlt eine Datei, fällt die Figur auf die gezeichnete Fassung zurück. Das ist
kein Beiwerk: Der Prototyp lief lange ganz ohne Bilddateien und soll das weiter
tun. Ohne Rückfall bekäme jeder, der ihn ohne die PNGs auscheckt, drei
unsichtbare Sprites und ein Spiel, das aussieht wie kaputt. Der Browser
protokolliert in dem Fall den fehlgeschlagenen Abruf — das ist erwartet, nicht
kaputt.

Bilder müssen **nicht quadratisch** sein: `Charaktere.einpassen` skaliert über
die längere Kante, das Seitenverhältnis bleibt erhalten und die Transparenz
sowieso. Die Trefferfläche wird dabei je Achse gegengerechnet und bleibt
32 × 32 — bei einem nicht-quadratischen Bild sind `scaleX` und `scaleY`
verschieden, und eine Gegenrechnung über nur eine Achse ergäbe eine krumme
Hitbox.

**Über `file://` lädt Safari keine Bilder** („access control checks"). Zum
Ausprobieren mit echten Bildern deshalb einen kleinen Server nehmen, etwa
`python3 -m http.server` im Ordner — mit `index.html` direkt im Browser greift
sonst immer der Rückfall.

## Regeln

- Die Lebenspunkte kommen vom Charakter (4 bis 7) und stehen als Herzen oben
  rechts. Ein verbrauchtes Herz bleibt als Umriss stehen, statt zu
  verschwinden — so sieht man, wie viel man hatte.
- Ein Gegner hält **2 Treffer** aus. Der erste lässt ihn aufblitzen und
  zurückweichen, der zweite erledigt ihn. Jeder besiegte Gegner gibt
  **100 Punkte**.
- Eine Berührung kostet **1 Lebenspunkt**, danach ist der Spieler kurz
  unverwundbar und blinkt (900 ms, beim Tank 1300). Ohne diese Pause wäre man
  nach einer einzigen Berührung sofort tot, weil die Kollision in jedem Bild
  erneut auslöst.
- Bei 0 Lebenspunkten: Game Over mit Punktestand und erreichter Welle,
  Tippen startet neu.

## Wellen

Sind alle Gegner einer Welle besiegt, erscheint „Welle X geschafft" und nach
1,7 Sekunden beginnt die nächste.

| Welle | 1 | 2 | 3 | 4 | 5 | 6+ |
|---|---|---|---|---|---|---|
| Gegner | 3 | 4 | 6 | 7 | 9 | 10 |
| Tempo | 60 | 64 | 68 | 72 | 76 | bis 100 |

Beide Werte sind gedeckelt, und das ist keine Willkür: Ab etwa zehn
Verfolgern auf 960 × 540 ist kein Ausweichen mehr möglich, und ein Tempo nahe
den 200 des Spielers hieße, dass man sich gar nicht mehr lösen kann. Die
Rechnung dafür steht in `js/spiel/wellen.js` als reine Funktionen, damit sich
nachrechnen lässt, ob Welle 7 fair ist, ohne siebenmal zu sterben.

Gegner erscheinen am Rand der Arena, nie direkt beim Spieler
(`Mindestabstand`), und ihr Körper ist während der Einblendung abgeschaltet —
sonst kostet ein Gegner im Moment des Auftauchens ein Leben ohne Vorwarnung.

## Aufwertungen

Nach jeder geschafften Welle stehen drei Karten zur Wahl; die Runde ist
solange pausiert. Die Boni stapeln sich über die Runde und werden beim
Neustart wieder zurückgesetzt — sie gelten für die Runde, nicht für das Gerät.

| Karte | Wirkung je Stufe | Stufen | Grenze |
|---|---|---|---|
| +1 Leben | ein Herz mehr, sofort aufgefüllt | 3 | — |
| Schnellere Schüsse | Schusspause −35 ms | 4 | 110 ms |
| Mehr Tempo | +18 Tempo | 5 | 290 |
| Stärkere Kugeln | ein Treffer erledigt einen Gegner | 1 | — |
| Größere Reichweite | +90 Reichweite | 4 | 820 |

Die Werte sind **Zuschläge auf die Charakterwerte**, keine festen Zielwerte:
Der Tank startet bei Tempo 165 und kommt mit „Mehr Tempo" auf 183. Die Grenze
in der letzten Spalte gilt dabei für alle gleich — der Schnelle steht schon bei
275 und landet mit einer Stufe deshalb auf 290 statt auf 293.

„Stärkere Kugeln" hat bewusst nur eine Stufe: Ein Gegner hält zwei Treffer
aus, mehr als zwei Schaden wäre also wirkungslos — und eine Karte, die nichts
mehr tut, darf nicht in der Auswahl stehen. Ausgereizte Karten fallen aus der
Auswahl heraus; ist gar nichts mehr offen, beginnt die nächste Welle direkt.

Welche Karten kommen, entscheidet ein Kongruenzgenerator mit einer Saat je
Runde — kein `Math.random` beim Ziehen. Die Auswahl ist eine Spielregel, und
dieselbe Runde soll sich nachstellen lassen; ein Fehlerbericht wie „in Welle 4
stand da eine Karte, die nichts tat" ist sonst nicht nachvollziehbar.

## Darstellung auf kleinen Geräten

Das Spielfeld ist intern immer 960 × 540 — alle Positionen im Code rechnen mit
diesen Zahlen. Phaser skaliert die Leinwand mit `Scale.FIT` auf den
verfügbaren Platz und zentriert sie (`CENTER_BOTH`); das Seitenverhältnis
bleibt unangetastet, schwarze Ränder sind eingeplant.

Vorher stand dort gar kein Modus, also `NONE`. Die Leinwand war 960 × 540
CSS-Pixel groß und wurde nur vom `max-width: 100%` im Stylesheet optisch
verkleinert — **Phaser wusste davon nichts.** `scale.displaySize` meldete
weiterhin 960, während die Leinwand auf dem iPhone tatsächlich 390 breit war.
Merksatz: Größe darf nicht an zwei Stellen gleichzeitig festgelegt werden,
sonst weiß keiner mehr, welche gilt.

Im Hochformat erscheint unten ein Hinweis aufs Querformat. Er steht im DOM und
nicht im Spielfeld: Im Hochformat ist die Leinwand nur rund 220 Pixel hoch, ein
Hinweis darin wäre mitskaliert und gerade dort am kleinsten, wo er gebraucht
wird. Er hat `pointer-events: none` — ohne das schluckt er genau den Tipp, der
ihn wegblenden soll. Beim Drehen blendet ihn eine Medienabfrage von selbst aus,
dafür braucht es kein JavaScript. Gespielt werden kann im Hochformat trotzdem;
es ist ein Hinweis, keine Sperre.

## Bestleistung

Der beste Punktestand und die weiteste Welle werden lokal gespeichert und
überleben das Schließen der Seite. Sie stehen dezent unter der Überschrift der
Charakterwahl und beim Game Over.

Punkte und Welle zählen **getrennt**: Man kann dieselbe Welle erreichen und
dabei mehr Gegner erwischt haben — das ist ein Punkterekord ohne Wellenrekord,
und beides ist eine eigene Leistung. Bei einem Rekord steht dort „Neuer
Rekord!" statt der bisherigen Bestleistung; eine Zeile „Bester: dasselbe
nochmal" wäre nur Rauschen.

`js/spiel/rekord.js` ist die **einzige** Stelle im Prototyp, die
`localStorage` anfasst — abgeschaut von der Spielesammlung, wo das nur
`shell/speicher.ts` darf. Dann gibt es genau einen Ort, an dem der
Schlüsselname steht, und genau einen, der abgesichert sein muss.

Rechnen und Speichern sind getrennt: `bereinigen` und `vergleichen` sind reine
Funktionen ohne Browser. Gerade die Frage „ist das ein Rekord?" will man nicht
nur dadurch geprüft haben, dass man zufällig gut gespielt hat.

Alle Zugriffe liegen in `try`/`catch` und fallen auf den leeren Stand zurück.
Das deckt drei verschiedene Fälle ab, nicht nur einen: gar kein
`localStorage`, ein Schreibversuch der scheitert (Safari im privaten Modus —
der Speicher ist da, das Schreiben wirft trotzdem), und unlesbarer oder von
Hand veränderter Inhalt. Ein Prototyp darf an einer Bestenliste nicht
scheitern.

## Status

Prototyp Phase 8 – gezeichnete Charaktere, Bestleistung, Wellen, Aufwertungen,
Punktestand, Lebenspunkte, Game-Over und Neustart.

Offen für spätere Ausbaustufen: Ton, gezeichnete Gegner (noch schlichte Rechtecke),
mehr Gegnerarten, geräteübergreifende Bestenliste.
