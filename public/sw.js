/*
 * Offline-Betrieb, von Hand — ohne Zusatzbibliothek.
 *
 * Gedanke: Beim ersten Besuch wird alles Geladene mitgespeichert. Danach
 * funktioniert die App ohne Internet. Seitenaufrufe versuchen zuerst das Netz
 * (damit eine neue Fassung ankommt) und fallen sonst auf den Speicher zurück.
 *
 * Beim Veröffentlichen einer neuen Fassung die Zahl in SPEICHER erhöhen.
 */

const SPEICHER = 'flow-games-v61';
const GRUNDGERUEST = ['/', '/index.html', '/manifest.webmanifest'];

/**
 * Beim Einrichten **alles** holen, was der Bau erzeugt hat.
 *
 * Vorher kam nur das Grundgerüst in den Vorrat, alles andere erst beim
 * ersten Abruf. Das ging gut, solange es genau ein JavaScript-Bündel gab —
 * das wird ja beim ersten Laden ohnehin geholt.
 *
 * Seit Dash City gibt es einen **zweiten** Brocken (three.js), der erst
 * beim Öffnen dieses Spiels geladen wird. Ohne das hier wäre genau dieses
 * Spiel offline nicht da: installiert, aber nie mit Netz gestartet = im
 * Flugzeug ein schwarzer Bildschirm.
 *
 * Die Liste erzeugt `vite.config.ts` beim Bauen (`dateiliste.json`), weil
 * die Dateinamen einen Prüfwert tragen und sich bei jedem Bau ändern.
 *
 * Schlägt das Holen fehl (kein Netz beim allerersten Besuch), wird die
 * Einrichtung **nicht** abgebrochen — das Grundgerüst steht, und der Rest
 * kommt wie früher beim ersten Abruf dazu.
 */
async function vorratFuellen() {
  const speicher = await caches.open(SPEICHER);
  await speicher.addAll(GRUNDGERUEST);
  try {
    const antwort = await fetch('/dateiliste.json', { cache: 'no-cache' });
    if (!antwort.ok) return;
    const dateien = await antwort.json();
    if (Array.isArray(dateien) && dateien.length > 0) {
      await speicher.addAll(dateien);
    }
  } catch {
    /* Ohne Netz bleibt es beim Grundgerüst. */
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(vorratFuellen().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((namen) =>
        Promise.all(namen.filter((name) => name !== SPEICHER).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const anfrage = e.request;
  if (anfrage.method !== 'GET') return;
  if (new URL(anfrage.url).origin !== self.location.origin) return;

  // Seitenaufruf: neue Fassung bevorzugen, ohne Netz die gespeicherte nehmen.
  if (anfrage.mode === 'navigate') {
    e.respondWith(
      fetch(anfrage)
        .then((antwort) => {
          const kopie = antwort.clone();
          caches.open(SPEICHER).then((speicher) => speicher.put('/index.html', kopie));
          return antwort;
        })
        .catch(() => caches.match('/index.html').then((treffer) => treffer || Response.error())),
    );
    return;
  }

  // Alles andere (JavaScript, Stil, Symbole): erst Speicher, dann Netz.
  e.respondWith(
    caches.match(anfrage).then(
      (treffer) =>
        treffer ||
        fetch(anfrage).then((antwort) => {
          if (antwort.ok && antwort.type === 'basic') {
            const kopie = antwort.clone();
            caches.open(SPEICHER).then((speicher) => speicher.put(anfrage, kopie));
          }
          return antwort;
        }),
    ),
  );
});
