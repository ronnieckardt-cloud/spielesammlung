import { useCallback, useEffect, useState } from 'react';
import { spielFinden } from './core/registry';
import { sfxEinstellen } from './core/sfx';
import type { Einstellungen } from './core/types';
import { Kachelmenue } from './shell/Kachelmenue';
import { Spielrahmen } from './shell/Spielrahmen';
import { EinstellungenSeite } from './shell/EinstellungenSeite';
import { BestenlisteSeite } from './shell/BestenlisteSeite';
import { KontoSeite } from './shell/KontoSeite';
import { DuellSeite } from './shell/DuellSeite';
import { einstellungenLesen, einstellungenSchreiben } from './shell/speicher';
import { abgleichen, duelleHolen, kontoBeobachten, kontoLaden } from './shell/konto';
import type { Duell, Konto } from './shell/konto';

/**
 * Die Hülle. Sie entscheidet, was zu sehen ist, und hält die Einstellungen.
 * Welche Ansicht gerade dran ist, steht in der Adresszeile (#/spiel/xyz) —
 * dadurch funktioniert der Zurück-Knopf des Browsers und des Handys.
 */

export type Ansicht =
  | { art: 'menue' }
  | { art: 'spiel'; id: string }
  | { art: 'einstellungen' }
  | { art: 'bestenliste' }
  | { art: 'konto' }
  | { art: 'duelle' }
  | { art: 'duell'; id: string };

function ansichtAusAdresse(): Ansicht {
  const teile = window.location.hash.replace(/^#\/?/, '').split('/');
  if (teile[0] === 'spiel' && teile[1] && spielFinden(teile[1])) {
    return { art: 'spiel', id: teile[1] };
  }
  if (teile[0] === 'einstellungen') return { art: 'einstellungen' };
  if (teile[0] === 'bestenliste') return { art: 'bestenliste' };
  if (teile[0] === 'konto') return { art: 'konto' };
  if (teile[0] === 'duelle') return { art: 'duelle' };
  if (teile[0] === 'duell' && teile[1]) return { art: 'duell', id: teile[1] };
  return { art: 'menue' };
}

function adresseFuer(ansicht: Ansicht): string {
  switch (ansicht.art) {
    case 'spiel':
      return `#/spiel/${ansicht.id}`;
    case 'einstellungen':
      return '#/einstellungen';
    case 'bestenliste':
      return '#/bestenliste';
    case 'konto':
      return '#/konto';
    case 'duelle':
      return '#/duelle';
    case 'duell':
      return `#/duell/${ansicht.id}`;
    default:
      return '#/';
  }
}

export default function App() {
  const [ansicht, setAnsicht] = useState<Ansicht>(ansichtAusAdresse);
  const [einstellungen, setEinstellungen] = useState<Einstellungen>(einstellungenLesen);
  const [konto, setKonto] = useState<Konto | null>(kontoLaden);

  // Die Adresszeile ist der Maßstab: wir ändern sie, sie meldet die Änderung zurück.
  useEffect(() => {
    const beiWechsel = () => setAnsicht(ansichtAusAdresse());
    window.addEventListener('hashchange', beiWechsel);
    return () => window.removeEventListener('hashchange', beiWechsel);
  }, []);

  /**
   * Die Warteschlange abräumen: beim Start, sobald das Netz wiederkommt und
   * beim Zurückkehren in die App. Alles still — schlägt es fehl, bleiben die
   * Runden liegen und es passiert schlicht nichts.
   *
   * `visibilitychange` ist auf dem iPad der wichtigste der drei: Die App
   * wird dort selten wirklich geschlossen, sondern nur weggelegt, und dann
   * gibt es kein `online`-Ereignis, wenn das WLAN zurückkommt.
   */
  useEffect(() => {
    const versuchen = () => void abgleichen();
    versuchen();
    const beiSichtbar = () => {
      if (document.visibilityState === 'visible') versuchen();
    };
    window.addEventListener('online', versuchen);
    document.addEventListener('visibilitychange', beiSichtbar);
    return () => {
      window.removeEventListener('online', versuchen);
      document.removeEventListener('visibilitychange', beiSichtbar);
    };
  }, []);

  useEffect(() => kontoBeobachten(setKonto), []);

  const zeige = useCallback((ziel: Ansicht) => {
    const adresse = adresseFuer(ziel);
    if (window.location.hash === adresse) setAnsicht(ziel);
    else window.location.hash = adresse;
  }, []);

  const zumMenue = useCallback(() => zeige({ art: 'menue' }), [zeige]);
  const zumKonto = useCallback(() => zeige({ art: 'konto' }), [zeige]);

  useEffect(() => {
    einstellungenSchreiben(einstellungen);
    sfxEinstellen({ an: einstellungen.sound });
    document.documentElement.classList.toggle('ruhig', einstellungen.reducedMotion);
  }, [einstellungen]);

  const spiel = ansicht.art === 'spiel' ? spielFinden(ansicht.id) : undefined;

  useEffect(() => {
    document.title = spiel ? `${spiel.title} — Spielesammlung` : 'Spielesammlung';
  }, [spiel]);

  if (spiel) {
    return (
      <Spielrahmen
        key={spiel.id}
        spiel={spiel}
        einstellungen={einstellungen}
        onExit={zumMenue}
      />
    );
  }

  if (ansicht.art === 'einstellungen') {
    return (
      <EinstellungenSeite
        einstellungen={einstellungen}
        onAendern={setEinstellungen}
        onZurueck={zumMenue}
      />
    );
  }

  if (ansicht.art === 'bestenliste') {
    return <BestenlisteSeite konto={konto} onZurueck={zumMenue} onKonto={zumKonto} />;
  }

  if (ansicht.art === 'konto') {
    return <KontoSeite konto={konto} onZurueck={zumMenue} />;
  }

  if (ansicht.art === 'duelle') {
    return (
      <DuellSeite
        konto={konto}
        onZurueck={zumMenue}
        onKonto={zumKonto}
        onSpielen={(id) => zeige({ art: 'duell', id })}
      />
    );
  }

  if (ansicht.art === 'duell') {
    return (
      <Duellrunde
        duellId={ansicht.id}
        konto={konto}
        einstellungen={einstellungen}
        onFertig={() => zeige({ art: 'duelle' })}
      />
    );
  }

  return (
    <Kachelmenue
      konto={konto}
      onSpielen={(id) => zeige({ art: 'spiel', id })}
      onEinstellungen={() => zeige({ art: 'einstellungen' })}
      onBestenliste={() => zeige({ art: 'bestenliste' })}
      onDuelle={() => zeige({ art: 'duelle' })}
      onKonto={zumKonto}
    />
  );
}

/**
 * Eine Duell-Runde: erst das Duell laden, dann ganz normal spielen.
 *
 * Das Laden steht hier und nicht im `Spielrahmen`: Der soll weiterhin nichts
 * vom Netz wissen und einfach ein Spiel anzeigen. Er bekommt am Ende nur
 * Spiel, Level und die Duell-Id gereicht.
 */
function Duellrunde({
  duellId,
  konto,
  einstellungen,
  onFertig,
}: {
  duellId: string;
  konto: Konto | null;
  einstellungen: Einstellungen;
  onFertig: () => void;
}) {
  const [duell, setDuell] = useState<Duell | null | 'fehlt'>(null);

  useEffect(() => {
    let abgemeldet = false;
    void duelleHolen().then((liste) => {
      if (abgemeldet) return;
      setDuell(liste?.find((d) => d.id === duellId) ?? 'fehlt');
    });
    return () => {
      abgemeldet = true;
    };
  }, [duellId]);

  const spiel = duell && duell !== 'fehlt' ? spielFinden(duell.spiel) : undefined;

  if (duell === null) {
    return (
      <p className="grid flex-1 place-items-center p-6 text-sm text-gedaempft">Duell wird geladen …</p>
    );
  }

  if (duell === 'fehlt' || !spiel) {
    return (
      <div className="grid flex-1 place-items-center gap-4 p-6 text-center">
        <p className="text-sm text-gedaempft">
          Dieses Duell ist gerade nicht erreichbar. Vielleicht ist kein Internet da?
        </p>
        <button type="button" onClick={onFertig} className="spielknopf">
          Zurück zu den Duellen
        </button>
      </div>
    );
  }

  return (
    <Spielrahmen
      key={duell.id}
      spiel={spiel}
      einstellungen={einstellungen}
      duell={{ id: duell.id, level: duell.level }}
      ichBin={konto?.benutzerId}
      onExit={onFertig}
    />
  );
}
