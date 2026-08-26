import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

// Ambient-Deklarationen für 'node:fs'/'node:path' (statt einer zusätzlichen
// @types/node-Abhängigkeit) stehen in node-shim.d.ts — ein `declare module`
// direkt hier würde TypeScript als Erweiterung eines *vorhandenen* Moduls
// lesen (diese Datei hat selbst `import`/`export`, zählt also als Modul),
// nicht als neue Deklaration. Nur in einer separaten `.d.ts`-Datei ohne
// eigene Imports gilt es als global.

/**
 * Alle Dateien unter einem Verzeichnis, rekursiv, als `/`-Pfade relativ zu
 * `basis` — versteckte Dateien (`.gitkeep` und Ähnliches) bleiben draußen,
 * die tragen keinen Inhalt, den ein Vorrat lohnt.
 */
function dateienUnter(verzeichnis: string, basis: string): string[] {
  const ergebnis: string[] = [];
  for (const eintrag of readdirSync(verzeichnis)) {
    if (eintrag.startsWith('.')) continue;
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) {
      ergebnis.push(...dateienUnter(pfad, basis));
    } else {
      ergebnis.push(`/${relative(basis, pfad).split(sep).join('/')}`);
    }
  }
  return ergebnis;
}

/**
 * Schreibt nach dem Bauen eine Liste aller erzeugten Dateien nach
 * `dist/dateiliste.json`.
 *
 * **Warum das nötig ist.** Der Service Worker legte bisher nur `/`,
 * `/index.html` und das Manifest von sich aus in den Vorrat; alles andere
 * kam erst beim ersten Abruf hinein. Solange es genau ein JavaScript-Bündel
 * gab, fiel das nicht auf — das wurde ja beim ersten Laden geholt.
 *
 * Seit Dash City gibt es einen **zweiten** Brocken (three.js), der erst
 * geladen wird, wenn jemand das Spiel öffnet. Ohne diese Liste wäre genau
 * dieses eine Spiel offline nicht da: Wer die App installiert, aber Dash
 * City nie mit Netz gestartet hat, bekäme im Flugzeug einen schwarzen
 * Bildschirm. Jetzt holt sich der Service Worker beim Einrichten alles auf
 * einmal.
 *
 * Die Dateinamen tragen einen Prüfwert im Namen, ändern sich also bei jedem
 * Bau — deshalb muss die Liste erzeugt und darf nicht von Hand gepflegt
 * werden.
 *
 * **Seit Arena Brawler zusätzlich `public/arena-brawler/`.** Diese Dateien
 * gehen nicht durch Rollup (sie werden unverändert aus `public/` nach
 * `dist/` kopiert), `generateBundle`s `buendel` weiß also nichts von ihnen —
 * ohne diesen Zusatz bliebe der Prototyp offline für immer leer, ganz
 * gleich wie oft er schon besucht wurde. `Cache.addAll` im Service Worker
 * ist alles-oder-nichts: Jeder hier gelistete Pfad muss beim Bau wirklich
 * existieren, sonst reißt er den *gesamten* Vorrat mit sich, nicht nur den
 * Prototyp — deshalb wird direkt von der Festplatte gelesen, nicht geraten.
 */
function dateiliste(): Plugin {
  return {
    name: 'dateiliste-fuer-serviceworker',
    apply: 'build',
    generateBundle(_optionen, buendel) {
      const dateien = new Set(
        Object.keys(buendel)
          .filter((name) => !name.endsWith('.map'))
          .map((name) => `/${name}`),
      );

      for (const pfad of dateienUnter('public/arena-brawler', 'public')) {
        dateien.add(pfad);
      }

      this.emitFile({
        type: 'asset',
        fileName: 'dateiliste.json',
        source: JSON.stringify([...dateien].sort(), null, 2),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), dateiliste()],
  server: { port: 5180, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        /**
         * three.js bekommt einen eigenen Brocken mit sprechendem Namen.
         *
         * Ohne das landet die Bibliothek im selben Brocken wie die Szene und
         * heißt dann nach ihr — beim Nachsehen der Größen ist dann nicht
         * mehr zu erkennen, was davon three.js ist und was eigener Code.
         * Genau diese Zahl will man im Blick behalten.
         */
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Der Lösbarkeits-Suchlauf im Farbsortierer braucht bei vielen Levelnummern
    // hintereinander mehr als die Standard-5s.
    testTimeout: 15000,
  },
});
