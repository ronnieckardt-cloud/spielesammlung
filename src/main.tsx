import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

/*
 * Läuft die App als installierte PWA?
 *
 * Apple hat dafür seit jeher `navigator.standalone`; der Standardweg ist
 * die Medienabfrage `display-mode: standalone`. Beide werden geprüft, weil
 * genau hier ein Unterschied sichtbar wird: Im Browser muss unten Platz
 * für Safaris schwebende Adressleiste bleiben, in der installierten App
 * wäre derselbe Platz ein toter schwarzer Streifen.
 */
const eigenstaendig =
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);
document.documentElement.classList.toggle('eigenstaendig', eigenstaendig);

const wurzel = document.getElementById('wurzel');
if (!wurzel) throw new Error('Element #wurzel fehlt in index.html');

createRoot(wurzel).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline-Betrieb nur in der gebauten Fassung — beim Entwickeln würde der
// Zwischenspeicher ständig alte Dateien ausliefern.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Ob beim Start schon ein Service Worker die Seite führte — nur dann ist
  // ein späterer Wechsel wirklich eine *neue* Fassung und kein Ersteinbau.
  const hatteSchonEinenWorker = !!navigator.serviceWorker.controller;
  let neuGeladen = false;

  // Sobald eine neue Fassung übernommen hat (Service Worker ruft
  // skipWaiting()/clients.claim()), automatisch neu laden — ohne dass
  // jemand von Hand Speicher oder Browserdaten löschen muss. Das war
  // vorher der Fall: Deploys kamen auf installierten Geräten oft tagelang
  // nicht an, weil dafür ein manueller Cache-Reset nötig war.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteSchonEinenWorker || neuGeladen) return;
    neuGeladen = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Aktiv nach einer neuen Fassung fragen statt nur auf die (oft seltene)
      // automatische Prüfung des Browsers zu warten.
      void registration.update();

      // Kommt die App aus dem Hintergrund zurück (z. B. Tab-Wechsel auf dem
      // iPad), gleich nochmal nachfragen.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update();
      });
    });
  });
}
