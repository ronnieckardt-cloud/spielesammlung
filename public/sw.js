/*
 * Offline-Betrieb, von Hand — ohne Zusatzbibliothek.
 *
 * Gedanke: Beim ersten Besuch wird alles Geladene mitgespeichert. Danach
 * funktioniert die App ohne Internet. Die SPA-Seite selbst versucht zuerst
 * das Netz (damit eine neue Fassung ankommt) und fällt sonst auf den
 * Speicher zurück; alles andere — eigene Dateien wie JavaScript und Stil,
 * und seit Arena Brawler auch eigenständige Unterseiten außerhalb der SPA
 * unter `/arena-brawler/` — nimmt zuerst den Speicher, siehe `fetch` unten.
 *
 * Beim Veröffentlichen einer neuen Fassung die Zahl in SPEICHER erhöhen.
 */

const SPEICHER = 'flow-games-v74';
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

// Unterpfade außerhalb der eigentlichen Ein-Seiten-App (bisher nur der
// Phaser-Prototyp Arena Brawler) — die haben eine **eigene** `index.html`
// und dürfen mit der der SPA nicht verwechselt werden, siehe unten.
const EIGENSTAENDIGE_PFADE = ['/arena-brawler/'];

function istEigenstaendig(pfad) {
  return EIGENSTAENDIGE_PFADE.some((praefix) => pfad.startsWith(praefix));
}

self.addEventListener('fetch', (e) => {
  const anfrage = e.request;
  if (anfrage.method !== 'GET') return;

  const adresse = new URL(anfrage.url);
  if (adresse.origin !== self.location.origin) return;

  // Seitenaufruf der SPA selbst: neue Fassung bevorzugen, ohne Netz die
  // gespeicherte nehmen. Nur echte SPA-Adressen laufen hier durch — welche
  // Ansicht gerade dran ist, steht ohnehin hinter dem Rautezeichen, das
  // bekommt der Server nie zu sehen, jede SPA-Navigation sieht für ihn
  // gleich aus. Ein eigenständiger Unterpfad wie `/arena-brawler/` ist eine
  // **andere** Seite mit eigener `index.html`: Liefe die hier durch, würde
  // ihr HTML das gespeicherte SPA-`index.html` überschreiben — genau das
  // ist einmal passiert, bevor diese Prüfung dazukam, und äußerte sich als
  // "die App zeigt beim Öffnen ohne Netz plötzlich Arena Brawler".
  if (anfrage.mode === 'navigate' && !istEigenstaendig(adresse.pathname)) {
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

  // Alles andere: erst Speicher, dann Netz. Das gilt für JavaScript, Stil
  // und Symbole genauso wie jetzt für eigenständige Unterseiten — die
  // ändern sich selten, "möglichst verfügbar" wiegt hier mehr als "immer
  // die neueste Fassung", anders als bei der SPA-Seite oben.
  //
  // Ein Seitenaufruf auf `/arena-brawler/` (Ordnerpfad, keine Datei) landet
  // beim Server als genau diese Anfrage, im Vorrat liegt aber die Datei
  // selbst unter `/arena-brawler/index.html` (siehe `dateiliste.json`) —
  // ohne diese Umrechnung des Cache-Schlüssels fände `caches.match` sie nie.
  const schluessel =
    anfrage.mode === 'navigate' && anfrage.url.endsWith('/') ? anfrage.url + 'index.html' : anfrage;

  e.respondWith(
    caches.match(schluessel).then(
      (treffer) =>
        treffer ||
        fetch(anfrage).then((antwort) => {
          if (antwort.ok && antwort.type === 'basic') {
            const kopie = antwort.clone();
            caches.open(SPEICHER).then((speicher) => speicher.put(schluessel, kopie));
          }
          return antwort;
        }),
    ),
  );
});
