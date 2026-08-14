import type { Einstellungen } from '../core/types';
import { sfx } from '../core/sfx';
import { Seite } from './Seite';
import { bestenlisteLoeschen } from './speicher';

function Schalter({
  titel,
  erklaerung,
  an,
  onAendern,
}: {
  titel: string;
  erklaerung: string;
  an: boolean;
  onAendern: (an: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-karte border border-rand bg-flaeche p-4">
      <input
        type="checkbox"
        checked={an}
        onChange={(e) => onAendern(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-fokus"
      />
      <span>
        <span className="block font-medium">{titel}</span>
        <span className="block text-sm text-gedaempft">{erklaerung}</span>
      </span>
    </label>
  );
}

export function EinstellungenSeite({
  einstellungen,
  onAendern,
  onZurueck,
}: {
  einstellungen: Einstellungen;
  onAendern: (neu: Einstellungen) => void;
  onZurueck: () => void;
}) {
  return (
    <Seite titel="Einstellungen" onZurueck={onZurueck}>
      <div className="flex flex-col gap-3">
        <Schalter
          titel="Töne"
          erklaerung="Kurze Klänge bei Treffern und beim Spielende."
          an={einstellungen.sound}
          onAendern={(an) => {
            onAendern({ ...einstellungen, sound: an });
            if (an) sfx('klick');
          }}
        />
        <Schalter
          titel="Weniger Bewegung"
          erklaerung="Blenden und Wackeln weglassen. Ist die Systemeinstellung schon so gesetzt, ist das von Anfang an an."
          an={einstellungen.reducedMotion}
          onAendern={(an) => onAendern({ ...einstellungen, reducedMotion: an })}
        />

        <div className="mt-4 rounded-karte border border-rand bg-flaeche p-4">
          <h2 className="font-medium">Bestenlisten</h2>
          <p className="mt-1 text-sm text-gedaempft">
            Alle Punktestände liegen nur in diesem Browser. Es wird nichts verschickt.
          </p>
          <button
            type="button"
            onClick={() => {
              if (confirm('Wirklich alle Punktestände löschen?')) bestenlisteLoeschen();
            }}
            className="mt-3 rounded-lg border border-rand px-3 py-2 text-sm hover:bg-flaeche-hoch"
          >
            Alle Punktestände löschen
          </button>
        </div>
      </div>
    </Seite>
  );
}
