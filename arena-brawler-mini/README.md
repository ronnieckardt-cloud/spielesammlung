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

## Regeln

- Der Spieler hat **5 Lebenspunkte**, angezeigt als Herzen oben rechts. Ein
  verbrauchtes Herz bleibt als Umriss stehen, statt zu verschwinden — so
  sieht man, wie viel man hatte.
- Ein Gegner hält **2 Treffer** aus. Der erste lässt ihn aufblitzen und
  zurückweichen, der zweite erledigt ihn. Jeder besiegte Gegner gibt
  **100 Punkte**.
- Eine Berührung kostet **1 Lebenspunkt**, danach ist der Spieler 900 ms
  unverwundbar und blinkt. Ohne diese Pause wäre man nach einer einzigen
  Berührung sofort tot, weil die Kollision in jedem Bild erneut auslöst.
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

## Status

Prototyp Phase 3 – Wellen, Punktestand, Lebenspunkte, Game-Over und Neustart.

Offen für spätere Ausbaustufen: Ton, mehr Gegnerarten, Bestenliste.
