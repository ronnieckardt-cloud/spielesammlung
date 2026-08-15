import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

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
 */
function dateiliste(): Plugin {
  return {
    name: 'dateiliste-fuer-serviceworker',
    apply: 'build',
    generateBundle(_optionen, buendel) {
      const dateien = Object.keys(buendel)
        .filter((name) => !name.endsWith('.map'))
        .map((name) => `/${name}`)
        .sort();
      this.emitFile({
        type: 'asset',
        fileName: 'dateiliste.json',
        source: JSON.stringify(dateien, null, 2),
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
