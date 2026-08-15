# Spielesammlung

Kleine Spiele für den Browser. Läuft offline, lässt sich auf dem Handy wie
eine App installieren, funktioniert mit Finger und mit Tastatur.

## Starten

```bash
npm install
npm run dev
```

Dann <http://localhost:5180> öffnen.

## Was drin ist

| Spiel | Stand |
|---|---|
| **Star Dash** (Platzhalter) | spielbar |
| **Color Pour** | spielbar |
| **Block Burst** | spielbar |
| **Line Fall** | spielbar |
| **Ghost Chase** | spielbar |
| **Quiz Time** | spielbar |
| **Gehirnjogging** | spielbar |
| **Word Play** | spielbar |

Der Platzhalter ist kein richtiges Spiel, sondern der Beweis, dass das
Grundgerüst trägt: Er benutzt alle gemeinsamen Bausteine und meldet Punkte
und Spielende genauso, wie es die echten Spiele später tun.

## Steuerung

| | |
|---|---|
| Bewegen | Pfeiltasten oder WASD, am Handy wischen |
| Drehen | X |
| Fallen lassen | Leertaste, am Handy schnell nach unten wischen |
| Auswählen | Eingabetaste, am Handy tippen |
| Zurück ins Menü | Esc |

## Aufbau

```
src/
  core/    gemeinsame Bausteine: Spieluhr, Eingabe, Zufall, Töne
  shell/   Menü, Kopfzeile, Einstellungen, Bestenliste, Speicher
  games/   ein Ordner je Spiel
```

Jedes Spiel ist von außen nur über eine schmale Schnittstelle sichtbar und
kommt an Speicher oder Adresszeile nicht heran. Dadurch kann ein neues Spiel
kein bestehendes kaputtmachen. Einzelheiten stehen in `CLAUDE.md`.

## Befehle

```bash
npm run dev      # Entwicklungsserver
npm test         # Tests
npm run build    # Typprüfung und fertige Fassung nach dist/
```

## Regeln

- Keine fremden Bilder, Töne oder Spielinhalte. Töne werden im Browser
  erzeugt, die Symbole von `werkzeuge/icons-erzeugen.mjs`.
- Keine persönlichen Daten, keine Anmeldung. Punktestände bleiben im Browser.
- Die Spielprinzipien sind frei, Namen und Optik der Vorbilder nicht —
  deshalb durchgehend eigene Namen und ein eigenes Aussehen.
