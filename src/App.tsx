import { useCallback, useEffect, useState } from 'react';
import { spielFinden } from './core/registry';
import { sfxEinstellen } from './core/sfx';
import type { Einstellungen } from './core/types';
import { Kachelmenue } from './shell/Kachelmenue';
import { Spielrahmen } from './shell/Spielrahmen';
import { EinstellungenSeite } from './shell/EinstellungenSeite';
import { BestenlisteSeite } from './shell/BestenlisteSeite';
import { einstellungenLesen, einstellungenSchreiben } from './shell/speicher';

/**
 * Die Hülle. Sie entscheidet, was zu sehen ist, und hält die Einstellungen.
 * Welche Ansicht gerade dran ist, steht in der Adresszeile (#/spiel/xyz) —
 * dadurch funktioniert der Zurück-Knopf des Browsers und des Handys.
 */

export type Ansicht =
  | { art: 'menue' }
  | { art: 'spiel'; id: string }
  | { art: 'einstellungen' }
  | { art: 'bestenliste' };

function ansichtAusAdresse(): Ansicht {
  const teile = window.location.hash.replace(/^#\/?/, '').split('/');
  if (teile[0] === 'spiel' && teile[1] && spielFinden(teile[1])) {
    return { art: 'spiel', id: teile[1] };
  }
  if (teile[0] === 'einstellungen') return { art: 'einstellungen' };
  if (teile[0] === 'bestenliste') return { art: 'bestenliste' };
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
    default:
      return '#/';
  }
}

export default function App() {
  const [ansicht, setAnsicht] = useState<Ansicht>(ansichtAusAdresse);
  const [einstellungen, setEinstellungen] = useState<Einstellungen>(einstellungenLesen);

  // Die Adresszeile ist der Maßstab: wir ändern sie, sie meldet die Änderung zurück.
  useEffect(() => {
    const beiWechsel = () => setAnsicht(ansichtAusAdresse());
    window.addEventListener('hashchange', beiWechsel);
    return () => window.removeEventListener('hashchange', beiWechsel);
  }, []);

  const zeige = useCallback((ziel: Ansicht) => {
    const adresse = adresseFuer(ziel);
    if (window.location.hash === adresse) setAnsicht(ziel);
    else window.location.hash = adresse;
  }, []);

  const zumMenue = useCallback(() => zeige({ art: 'menue' }), [zeige]);

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
    return <BestenlisteSeite onZurueck={zumMenue} />;
  }

  return (
    <Kachelmenue
      onSpielen={(id) => zeige({ art: 'spiel', id })}
      onEinstellungen={() => zeige({ art: 'einstellungen' })}
      onBestenliste={() => zeige({ art: 'bestenliste' })}
    />
  );
}
