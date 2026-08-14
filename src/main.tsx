import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

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
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
