/*
 * Erzeugt die App-Symbole selbst — keine fremden Bilder, keine Bibliothek.
 *
 * Aufruf: node werkzeuge/icons-erzeugen.mjs
 * Ergebnis: public/icons/symbol-192.png, -512.png, -maskable-512.png
 *
 * Das Bild ist bewusst schlicht: vier farbige Kacheln auf dunklem Grund —
 * die Spielesammlung als Bild.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(HIER, '..', 'public', 'icons');

const GRUND = [11, 15, 20];
const KACHELN = [
  [125, 211, 252], // hellblau
  [240, 180, 41], // gelb
  [167, 139, 250], // violett
  [110, 231, 183], // grün
];

// --- PNG schreiben ---------------------------------------------------------

const crcTabelle = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(daten) {
  let c = 0xffffffff;
  for (const b of daten) c = crcTabelle[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function block(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const inhalt = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const pruefsumme = Buffer.alloc(4);
  pruefsumme.writeUInt32BE(crc32(inhalt));
  return Buffer.concat([laenge, inhalt, pruefsumme]);
}

function png(breite, hoehe, pixel) {
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(breite, 0);
  kopf.writeUInt32BE(hoehe, 4);
  kopf[8] = 8; // 8 Bit je Kanal
  kopf[9] = 6; // RGBA
  kopf[10] = 0;
  kopf[11] = 0;
  kopf[12] = 0;

  // Jede Zeile bekommt ein Filterbyte (0 = kein Filter) davor.
  const roh = Buffer.alloc(hoehe * (breite * 4 + 1));
  for (let y = 0; y < hoehe; y++) {
    const von = y * breite * 4;
    roh[y * (breite * 4 + 1)] = 0;
    pixel.copy(roh, y * (breite * 4 + 1) + 1, von, von + breite * 4);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    block('IHDR', kopf),
    block('IDAT', deflateSync(roh, { level: 9 })),
    block('IEND', Buffer.alloc(0)),
  ]);
}

// --- Zeichnen --------------------------------------------------------------

/** Liegt der Punkt in einem Rechteck mit runden Ecken? */
function inRundemRechteck(x, y, links, oben, breite, hoehe, radius) {
  const rechts = links + breite;
  const unten = oben + hoehe;
  if (x < links || x >= rechts || y < oben || y >= unten) return false;

  const dx = x < links + radius ? links + radius - x : x > rechts - radius ? x - (rechts - radius) : 0;
  const dy = y < oben + radius ? oben + radius - y : y > unten - radius ? y - (unten - radius) : 0;
  return dx * dx + dy * dy <= radius * radius;
}

function zeichnen(groesse, { rand, vollflaechig = false }) {
  const S = 2; // doppelt zeichnen und verkleinern = glatte Kanten
  const g = groesse * S;
  const gross = Buffer.alloc(g * g * 4);

  const aussen = rand * S;
  const feld = g - 2 * aussen;
  const luecke = Math.round(feld * 0.06);
  const kachel = (feld - luecke) / 2;
  const radius = kachel * 0.28;

  for (let y = 0; y < g; y++) {
    for (let x = 0; x < g; x++) {
      let farbe = GRUND;
      let deckung = 1;

      if (!inRundemRechteck(x, y, aussen, aussen, feld, feld, feld * 0.22)) {
        // Maskierbare Fassung: Android schneidet selbst zurecht, deshalb muss
        // die ganze Fläche gefüllt sein.
        deckung = vollflaechig ? 1 : 0;
      } else {
        for (let i = 0; i < 4; i++) {
          const kx = aussen + (i % 2) * (kachel + luecke);
          const ky = aussen + Math.floor(i / 2) * (kachel + luecke);
          if (inRundemRechteck(x, y, kx, ky, kachel, kachel, radius)) {
            farbe = KACHELN[i];
            break;
          }
        }
      }

      const p = (y * g + x) * 4;
      gross[p] = farbe[0];
      gross[p + 1] = farbe[1];
      gross[p + 2] = farbe[2];
      gross[p + 3] = deckung * 255;
    }
  }

  // Verkleinern: je vier Punkte zu einem mitteln.
  const klein = Buffer.alloc(groesse * groesse * 4);
  for (let y = 0; y < groesse; y++) {
    for (let x = 0; x < groesse; x++) {
      const summe = [0, 0, 0, 0];
      for (let dy = 0; dy < S; dy++) {
        for (let dx = 0; dx < S; dx++) {
          const p = ((y * S + dy) * g + (x * S + dx)) * 4;
          for (let k = 0; k < 4; k++) summe[k] += gross[p + k];
        }
      }
      const p = (y * groesse + x) * 4;
      for (let k = 0; k < 4; k++) klein[p + k] = Math.round(summe[k] / (S * S));
    }
  }

  return png(groesse, groesse, klein);
}

mkdirSync(ZIEL, { recursive: true });
writeFileSync(join(ZIEL, 'symbol-192.png'), zeichnen(192, { rand: 8 }));
writeFileSync(join(ZIEL, 'symbol-512.png'), zeichnen(512, { rand: 22 }));
// Maskierbar: mehr Luft am Rand, weil Android das Bild rund beschneidet.
writeFileSync(
  join(ZIEL, 'symbol-maskable-512.png'),
  zeichnen(512, { rand: 92, vollflaechig: true }),
);

console.log('Symbole erzeugt in public/icons/');
