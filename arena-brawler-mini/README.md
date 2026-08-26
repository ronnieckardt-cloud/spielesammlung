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
  zurückweichen, der zweite erledigt ihn.
- Eine Berührung kostet **1 Lebenspunkt**, danach ist der Spieler 900 ms
  unverwundbar und blinkt. Ohne diese Pause wäre man nach einer einzigen
  Berührung sofort tot, weil die Kollision in jedem Bild erneut auslöst.
- Bei 0 Lebenspunkten: Game Over, Tippen startet neu.

## Status

Prototyp Phase 2 – Lebenspunkte, Game-Over und Neustart stehen.

Offen für spätere Ausbaustufen: Wellen, Punktestand, Ton, mehr Gegnerarten.
