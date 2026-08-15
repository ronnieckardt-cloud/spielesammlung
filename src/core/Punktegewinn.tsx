import { useEffect, useRef, useState } from 'react';

/**
 * Das „+N" über dem Spielfeld.
 *
 * Der Baustein `.punkte-auftauchen` liegt seit Block Burst in `index.css`
 * bereit — benutzt hat ihn danach kein weiteres Spiel, obwohl in mehreren
 * die Punktedifferenz ohnehin schon ausgerechnet wird. Bei Ghost Chase und
 * Star Dash gab es überhaupt keine sichtbare Rückmeldung auf einen
 * Punktgewinn, nur einen Ton.
 *
 * Hier steckt beides zusammen: der Hook, der Zuwächse erkennt, und die
 * Anzeige. Ein Spiel braucht damit nur noch zwei Zeilen.
 *
 * Die Anzeige liegt **über** dem Feld (`absolute inset-0`) und kostet keine
 * Höhe — auf den kleinen Handys ist dafür kein Platz mehr.
 */

/** Wie lange ein Popup steht, bevor es verschwindet. */
const DAUER_MS = 900;

type Gewinn = { id: number; text: string };

/**
 * Meldet einen Zuwachs des Punktestands als kurzes „+N".
 *
 * `schwelle` blendet Kleinkram aus: In Ghost Chase gibt jeder eingesammelte
 * Punkt zehn Zähler — ein Popup je Punkt wäre ein Dauerflimmern quer über
 * das Labyrinth. Erst die Kraftpille (50) und der gefressene Geist (200)
 * sind eine Meldung wert.
 */
export function usePunktegewinn(punkte: number, schwelle = 1): Gewinn | null {
  const [gewinn, setGewinn] = useState<Gewinn | null>(null);
  const vorherRef = useRef(punkte);
  const zaehlerRef = useRef(0);

  useEffect(() => {
    const differenz = punkte - vorherRef.current;
    vorherRef.current = punkte;
    if (differenz < schwelle) return;

    // Eigene laufende Nummer statt der Punktzahl als Schlüssel: Zwei
    // gleich große Zuwächse hintereinander sollen die Animation neu
    // starten, nicht stehen lassen.
    zaehlerRef.current += 1;
    const id = zaehlerRef.current;
    setGewinn({ id, text: `+${differenz}` });
    const uhr = window.setTimeout(() => {
      setGewinn((alt) => (alt?.id === id ? null : alt));
    }, DAUER_MS);
    return () => window.clearTimeout(uhr);
  }, [punkte, schwelle]);

  return gewinn;
}

/** Zeigt den Zuwachs an. Gehört in einen Behälter mit `position: relative`. */
export function Punktegewinn({ gewinn }: { gewinn: Gewinn | null }) {
  if (!gewinn) return null;
  return (
    <div
      // Der Schlüssel ist der Auslöser: Bei jedem neuen Gewinn wird das
      // Element neu eingehängt und die Animation läuft von vorn.
      key={gewinn.id}
      aria-hidden="true"
      className="punkte-auftauchen pointer-events-none absolute inset-0 z-10 grid place-items-center text-4xl font-extrabold text-fokus"
      style={{ textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}
    >
      {gewinn.text}
    </div>
  );
}
