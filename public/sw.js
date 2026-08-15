/*
 * Offline-Betrieb, von Hand — ohne Zusatzbibliothek.
 *
 * Gedanke: Beim ersten Besuch wird alles Geladene mitgespeichert. Danach
 * funktioniert die App ohne Internet. Seitenaufrufe versuchen zuerst das Netz
 * (damit eine neue Fassung ankommt) und fallen sonst auf den Speicher zurück.
 *
 * Beim Veröffentlichen einer neuen Fassung die Zahl in SPEICHER erhöhen.
 */

const SPEICHER = 'spielesammlung-v6';
const GRUNDGERUEST = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SPEICHER)
      .then((speicher) => speicher.addAll(GRUNDGERUEST))
      .then(() => self.skipWaiting()),
  );
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
