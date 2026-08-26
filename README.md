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
| **Brain Blitz** | spielbar |
| **Word Play** | spielbar |
| **Snake Rush** | spielbar |
| **Merge Up** | spielbar |
| **Bubble Pop** | spielbar |

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

## Prototypen außerhalb der Sammlung

`arena-brawler-mini/` (Phaser 3) und `arena-brawler-godot/` (Godot 4) sind
eigenständige Prototypen im selben Repository, aber **nicht Teil dieser
Sammlung** — kein Eintrag in `src/core/registry.ts`, kein gemeinsamer Code,
keine gemeinsame Bestenliste. Näheres in ihren eigenen `README.md`.

`arena-brawler-mini/` ist zusätzlich unverändert nach `public/arena-brawler/`
gespiegelt und dadurch auf der ausgelieferten Netlify-Seite unter

**`/arena-brawler/`**

als eigene, rein statische Seite erreichbar — über die Startseite (Reiter
„Mehr" → „Arena Brawler", klar als Prototyp gekennzeichnet, öffnet dieselbe
Adresse als echten Link) oder direkt über diese URL. Der Link liegt bewusst
nur in `shell/MehrSeite.tsx` als normaler `<a href="/arena-brawler/">` —
kein Eintrag in `src/core/registry.ts`, kein `GameApi`-Wrapper, kein Ordner
unter `src/games/`.
