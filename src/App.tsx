import { useCallback, useEffect, useState } from 'react';
import { spielFinden } from './core/registry';
import { sfxEinstellen } from './core/sfx';
import type { Einstellungen } from './core/types';
import { StartSeite } from './shell/StartSeite';
import { SpieleSeite } from './shell/SpieleSeite';
import { FortschrittSeite } from './shell/FortschrittSeite';
import { MehrSeite } from './shell/MehrSeite';
import { Spielrahmen } from './shell/Spielrahmen';
import { EinstellungenSeite } from './shell/EinstellungenSeite';
import { BestenlisteSeite } from './shell/BestenlisteSeite';
import { KontoSeite } from './shell/KontoSeite';
import { AvatarSeite } from './shell/AvatarSeite';
import { StatistikSeite } from './shell/StatistikSeite';
import { DuellSeite } from './shell/DuellSeite';
import { Unternavigation, type NavZiel } from './shell/Unternavigation';
import { AbenteuerSeite } from './abenteuer/AbenteuerSeite';
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
  | { art: 'abenteuer' }
  | { art: 'spiele' }
  | { art: 'fortschritt' }
  | { art: 'mehr' }
  | { art: 'spiel'; id: string }
  | { art: 'einstellungen' }
  | { art: 'bestenliste' }
  | { art: 'konto' }
  | { art: 'avatar' }
  | { art: 'statistik' }
  | { art: 'duelle' }
  | { art: 'duell'; id: string };

function ansichtAusAdresse(): Ansicht {
  const teile = window.location.hash.replace(/^#\/?/, '').split('/');
  if (teile[0] === 'spiel' && teile[1] && spielFinden(teile[1])) {
    return { art: 'spiel', id: teile[1] };
  }
  if (teile[0] === 'abenteuer') return { art: 'abenteuer' };
  if (teile[0] === 'spiele') return { art: 'spiele' };
  if (teile[0] === 'fortschritt') return { art: 'fortschritt' };
  if (teile[0] === 'mehr') return { art: 'mehr' };
  if (teile[0] === 'einstellungen') return { art: 'einstellungen' };
  if (teile[0] === 'bestenliste') return { art: 'bestenliste' };
  if (teile[0] === 'konto') return { art: 'konto' };
  if (teile[0] === 'avatar') return { art: 'avatar' };
  if (teile[0] === 'statistik') return { art: 'statistik' };
  if (teile[0] === 'duelle') return { art: 'duelle' };
  if (teile[0] === 'duell' && teile[1]) return { art: 'duell', id: teile[1] };
  return { art: 'menue' };
}

function adresseFuer(ansicht: Ansicht): string {
  switch (ansicht.art) {
    case 'spiel':
      return `#/spiel/${ansicht.id}`;
    case 'abenteuer':
      return '#/abenteuer';
    case 'spiele':
      return '#/spiele';
    case 'fortschritt':
      return '#/fortschritt';
    case 'mehr':
      return '#/mehr';
    case 'einstellungen':
      return '#/einstellungen';
    case 'bestenliste':
      return '#/bestenliste';
    case 'konto':
      return '#/konto';
    case 'avatar':
      return '#/avatar';
    case 'statistik':
      return '#/statistik';
    case 'duelle':
      return '#/duelle';
    case 'duell':
      return `#/duell/${ansicht.id}`;
    default:
      return '#/';
  }
}

/**
 * Welcher Punkt der unteren Leiste zu welcher Ansicht gehört.
 *
 * Konto, Einstellungen und Duelle liegen hinter „Mehr" und lassen deshalb
 * dessen Punkt leuchten. Sonst stünde man auf der Kontoseite vor einer
 * Leiste, in der **nichts** hervorgehoben ist — und die Frage „wo bin ich?",
 * die eine Navigation beantworten soll, bliebe offen.
 */
function navZielFuer(ansicht: Ansicht): NavZiel {
  switch (ansicht.art) {
    case 'spiele':
      return 'spiele';
    case 'bestenliste':
      return 'bestenliste';
    case 'fortschritt':
      return 'fortschritt';
    case 'mehr':
    case 'konto':
    case 'avatar':
    case 'statistik':
    case 'einstellungen':
    case 'duelle':
      return 'mehr';
    default:
      return 'start';
  }
}

const NAV_ANSICHT: Record<NavZiel, Ansicht> = {
  start: { art: 'menue' },
  spiele: { art: 'spiele' },
  bestenliste: { art: 'bestenliste' },
  fortschritt: { art: 'fortschritt' },
  mehr: { art: 'mehr' },
};

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
  const zumAvatar = useCallback(() => zeige({ art: 'avatar' }), [zeige]);
  const zurStatistik = useCallback(() => zeige({ art: 'statistik' }), [zeige]);
  const zuMehr = useCallback(() => zeige({ art: 'mehr' }), [zeige]);
  const spielen = useCallback((id: string) => zeige({ art: 'spiel', id }), [zeige]);

  useEffect(() => {
    einstellungenSchreiben(einstellungen);
    sfxEinstellen({ an: einstellungen.sound });
    document.documentElement.classList.toggle('ruhig', einstellungen.reducedMotion);
  }, [einstellungen]);

  const spiel = ansicht.art === 'spiel' ? spielFinden(ansicht.id) : undefined;

  useEffect(() => {
    document.title = spiel ? `${spiel.title} — Flow Games` : 'Flow Games';
  }, [spiel]);

  /*
   * Ein laufendes Spiel bekommt den ganzen Bildschirm — ohne Leiste. Sie
   * würde bei Dash City oder Ghost Chase wertvolle Höhe kosten, und wer
   * mitten im Sprung versehentlich „Rangliste" trifft, verliert die Runde.
   * Der Ausstieg läuft dort über den Zurück-Knopf in der Kopfzeile.
   */
  if (spiel) {
    return (
      <Spielrahmen key={spiel.id} spiel={spiel} einstellungen={einstellungen} onExit={zumMenue} />
    );
  }

  /*
   * Florianville bekommt den ganzen Bildschirm — wie ein Spiel und aus
   * demselben Grund: Die Leiste würde Höhe kosten, und wer beim Springen
   * versehentlich „Rangliste" trifft, verliert seinen Lauf.
   */
  if (ansicht.art === 'abenteuer') {
    return <AbenteuerSeite einstellungen={einstellungen} onZurueck={zumMenue} />;
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

  const inhalt = (() => {
    switch (ansicht.art) {
      case 'spiele':
        return <SpieleSeite onSpielen={spielen} />;
      case 'fortschritt':
        return <FortschrittSeite onStatistik={zurStatistik} />;
      case 'mehr':
        return (
          <MehrSeite
            konto={konto}
            onKonto={zumKonto}
            onAvatar={zumAvatar}
            onDuelle={() => zeige({ art: 'duelle' })}
            onEinstellungen={() => zeige({ art: 'einstellungen' })}
          />
        );
      case 'einstellungen':
        return (
          <EinstellungenSeite
            einstellungen={einstellungen}
            onAendern={setEinstellungen}
            onZurueck={zuMehr}
          />
        );
      case 'bestenliste':
        return <BestenlisteSeite konto={konto} onZurueck={zumMenue} onKonto={zumKonto} />;
      case 'konto':
        return <KontoSeite konto={konto} onZurueck={zuMehr} onAvatar={zumAvatar} />;
      case 'avatar':
        return <AvatarSeite onZurueck={zumKonto} />;
      case 'statistik':
        return <StatistikSeite onZurueck={() => zeige({ art: 'fortschritt' })} />;
      case 'duelle':
        return (
          <DuellSeite
            konto={konto}
            onZurueck={zuMehr}
            onKonto={zumKonto}
            onSpielen={(id) => zeige({ art: 'duell', id })}
          />
        );
      default:
        return (
          <StartSeite
            konto={konto}
            onSpielen={spielen}
            onAlleSpiele={() => zeige({ art: 'spiele' })}
            onAbenteuer={() => zeige({ art: 'abenteuer' })}
            onKonto={zumKonto}
          />
        );
    }
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
       * Die Seite scrollt in **ihrem eigenen** Bereich, die Leiste steht
       * daneben im Layout. Ein `position: fixed` an der Leiste würde am
       * Seitenende Inhalt verdecken, den man mit einem Abstandhalter wieder
       * freiräumen müsste — der auf iPhones mit Aussparung dann falsch hoch
       * ist. So kann das gar nicht passieren.
       *
       * Der `key` setzt beim Seitenwechsel zweierlei zurück: die
       * Scrollposition (sonst landet man auf der neuen Seite in der Mitte)
       * und den Auftritt, damit er wirklich jedes Mal läuft.
       */}
      <div key={ansicht.art} className="min-h-0 flex-1 overflow-y-auto">
        {inhalt}
      </div>
      <Unternavigation
        aktiv={navZielFuer(ansicht)}
        onWechsel={(ziel) => zeige(NAV_ANSICHT[ziel])}
      />
    </div>
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
      <p className="grid flex-1 place-items-center p-6 text-sm text-gedaempft">
        Duell wird geladen …
      </p>
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
