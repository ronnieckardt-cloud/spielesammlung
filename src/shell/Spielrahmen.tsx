import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Einstellungen, GameApi } from '../core/types';
import { sfx } from '../core/sfx';
import { Feier } from '../core/Feier';
import { haptik } from '../core/haptik';
import {
  bestwert,
  ergebnisEintragen,
  fortschrittLesen,
  fortschrittSchreiben,
  zuletztGespieltMerken,
} from './speicher';
import { spiele } from '../core/registry';
import {
  heute,
  rundeVerbuchen,
  stufeAus,
  type Erfolg,
  type Stufenstand,
} from './fortschritt';
import {
  rundeVerbuchen as tagesRundeVerbuchen,
  tagesaufgaben,
  type Aufgabe,
} from './herausforderungen';
import { duellMelden, ergebnisMelden } from './konto';
import type { Duell } from './konto';
import { fremdePunkte, standFuer, standText } from './duell';
import { spielfarbenStil, toenung } from './spielfarbe';
import { sterne, sternText } from './sterne';
import type { Sternzahl } from './sterne';

type Ende = {
  punkte: number;
  beste: number;
  /**
   * Die Bestleistung **vor** dieser Runde. `beste` ist der Stand danach und
   * enthält die gerade gespielte Runde schon — damit ließe sich die Wertung
   * nicht rechnen, sie käme bei jeder Bestleistung auf genau 100 %.
   */
  vorher: number;
  rekord: boolean;
  gewonnen: boolean;
  /** Platz unter allen Angemeldeten — kommt erst nach, wenn der Server antwortet. */
  platz?: { platz: number; teilnehmer: number };
  /** Stand des Duells, wenn die Runde eines war. Kommt ebenfalls nach. */
  duell?: Duell;
  /** Was die Runde an Erfahrung gebracht hat, und der Stand danach. */
  xpGewinn: number;
  stand: Stufenstand;
  /** Gesetzt, wenn diese Runde eine Stufe gehoben hat. */
  neueStufe?: number;
  /** Erfolge, die **durch diese Runde** dazugekommen sind. */
  neueErfolge: Erfolg[];
  /** Tagesaufgaben, die **durch diese Runde** fertig geworden sind. */
  fertigeAufgaben: Aufgabe[];
};

/**
 * Rahmen um ein laufendes Spiel: Kopfzeile mit Punktestand und Zurück-Knopf,
 * Eintrag in die Bestenliste am Ende, Neustart.
 *
 * Das Spiel selbst bekommt davon nichts mit — es meldet nur Punkte und
 * Spielende über seine Props.
 */
/** Wie lange die Zahl braucht, um auf den neuen Wert zu laufen. */
const HOCHZAEHLEN_MS = 320;

/**
 * Lässt den Punktestand auf seinen neuen Wert **laufen**, statt zu springen.
 *
 * Sitzt bewusst in der Hülle und nicht in den Spielen: Eine Datei, und es
 * wirkt sofort in allen vierzehn. Bei Quiz Time (0 bis 10) sieht man kaum
 * etwas, bei Block Burst mit Sprüngen über 500 verändert es den Eindruck
 * deutlich.
 *
 * Läuft nur nach oben. Ein Rücksprung (neue Runde, Punktestand zurück auf 0)
 * wird sofort übernommen — eine rückwärts zählende Zahl sähe aus wie ein
 * Fehler.
 */
function useHochzaehlen(ziel: number, ruhig: boolean): number {
  const [gezeigt, setGezeigt] = useState(ziel);
  const vonRef = useRef(ziel);

  useEffect(() => {
    if (ruhig || ziel <= vonRef.current) {
      vonRef.current = ziel;
      setGezeigt(ziel);
      return;
    }
    const von = vonRef.current;
    const start = performance.now();
    let bild = 0;

    const schritt = (jetzt: number) => {
      const anteil = Math.min(1, (jetzt - start) / HOCHZAEHLEN_MS);
      // Am Anfang schnell, zum Ende hin langsam — das liest sich als
      // „läuft aus", nicht als gleichmäßiger Zähler.
      const weich = 1 - (1 - anteil) ** 3;
      setGezeigt(Math.round(von + (ziel - von) * weich));
      if (anteil < 1) bild = requestAnimationFrame(schritt);
      else vonRef.current = ziel;
    };
    bild = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(bild);
  }, [ziel, ruhig]);

  return gezeigt;
}

/**
 * Der Erfahrungsbalken im Rundenende.
 *
 * **Der Balken füllt sich, er steht nicht da.** Das ist der ganze Punkt: Ein
 * fertig gefüllter Balken ist eine Zahl, ein laufender Balken ist eine
 * Belohnung. Er startet dort, wo er vor der Runde stand, und wächst auf den
 * neuen Stand — deshalb bekommt er den Zuwachs gereicht und nicht nur das
 * Ergebnis.
 *
 * Bei „weniger Bewegung" steht er sofort auf dem Endwert. Die Zahl daneben
 * stimmt in beiden Fällen; niemand verliert Information.
 */
function Erfahrungsbalken({
  stand,
  gewinn,
  ruhig,
  verzoegerung,
}: {
  stand: Stufenstand;
  gewinn: number;
  ruhig: boolean;
  verzoegerung: number;
}) {
  // Wo der Balken vor der Runde stand. Ein Stufenaufstieg lässt den Wert
  // negativ werden — dann fing die Stufe bei null an, und genau das ist
  // richtig: Der Balken läuft von links los statt rückwärts zu springen.
  const vorher = Math.max(0, stand.imLevel - gewinn);
  const [breite, setBreite] = useState(ruhig ? stand.anteil : vorher / stand.fuerLevel);

  useEffect(() => {
    if (ruhig) return;
    const uhr = window.setTimeout(() => setBreite(stand.anteil), verzoegerung);
    return () => window.clearTimeout(uhr);
  }, [stand.anteil, ruhig, verzoegerung]);

  return (
    <div
      className="ende-zeile mt-4"
      style={{ '--verzoegerung': `${verzoegerung}ms` } as CSSProperties}
    >
      <div className="mb-1.5 flex items-baseline justify-between text-xs font-bold">
        <span style={{ color: 'var(--color-xp)' }}>Stufe {stand.stufe}</span>
        <span className="text-gedaempft">
          {stand.imLevel} / {stand.fuerLevel} XP
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-white/12"
        role="img"
        aria-label={`Stufe ${stand.stufe}, ${stand.imLevel} von ${stand.fuerLevel} Erfahrungspunkten`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.round(breite * 100)}%`,
            background: 'linear-gradient(90deg, var(--color-xp), var(--color-fokus))',
            // Länger als die Standardzeit: Der Balken ist hier die
            // Belohnung, nicht ein Zustandswechsel nebenbei.
            transition: 'width 900ms var(--kurve)',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Die drei Sterne im Rundenende.
 *
 * Sie kommen **nacheinander** herein, mit gut zwei Zehnteln Abstand. Alle
 * drei auf einmal wären dieselbe Information in einem Bruchteil der Wirkung:
 * Bei drei Sternen entsteht durch die Staffelung eine Steigerung, und bei
 * einem Stern sieht man, dass zwei ausgeblieben sind, statt es nur zu lesen.
 *
 * Nicht erreichte Sterne stehen blass da, statt zu fehlen — sonst wüsste ein
 * Kind nicht, dass es überhaupt mehr zu holen gibt.
 */
function Sterne({ anzahl, verzoegerung }: { anzahl: Sternzahl; verzoegerung: number }) {
  return (
    // `role="img"` ist nötig, nicht schmückend: Alle drei Sterne sind
    // `aria-hidden`, der Absatz hat also gar keinen vorlesbaren Inhalt — und
    // ein `aria-label` an einem Element ohne Rolle wird von manchen
    // Vorleseprogrammen einfach übergangen.
    <p
      role="img"
      aria-label={`${anzahl} von 3 Sternen`}
      className="mt-3 flex justify-center gap-1.5"
    >
      {([1, 2, 3] as const).map((n) => {
        const erreicht = n <= anzahl;
        return (
          <svg
            key={n}
            viewBox="-12 -12 24 24"
            aria-hidden="true"
            className={erreicht ? 'stern-rein size-9' : 'stern-leer size-9'}
            style={
              erreicht
                ? ({ '--verzoegerung': `${verzoegerung + (n - 1) * 210}ms` } as CSSProperties)
                : undefined
            }
          >
            <path
              d={STERN_PFAD}
              fill={erreicht ? '#facc15' : 'currentColor'}
              stroke={erreicht ? '#a16207' : 'none'}
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </p>
  );
}

/** Fünfzackiger Stern, Radien 11 und 4,6, Spitze oben. */
const STERN_PFAD = Array.from({ length: 10 }, (_, i) => {
  const winkel = (i * Math.PI) / 5 - Math.PI / 2;
  const r = i % 2 === 0 ? 11 : 4.6;
  return `${i === 0 ? 'M' : 'L'}${(Math.cos(winkel) * r).toFixed(2)} ${(Math.sin(winkel) * r).toFixed(2)}`;
}).join(' ') + ' Z';

export function Spielrahmen({
  spiel,
  einstellungen,
  duell,
  ichBin,
  onExit,
}: {
  spiel: GameApi;
  einstellungen: Einstellungen;
  /**
   * Gesetzt, wenn diese Runde ein Duell ist. Dann bekommt das Spiel ein
   * **festes Level**, und das Ergebnis geht zusätzlich ans Duell.
   */
  duell?: { id: string; level: number };
  /** Die eigene Benutzer-Id — nur fürs Auswerten des Duellstands. */
  ichBin?: string;
  onExit: () => void;
}) {
  const [punkte, setPunkte] = useState(0);
  const [runde, setRunde] = useState(0);
  const [ende, setEnde] = useState<Ende | null>(null);

  // Schutz davor, dass ein Spiel das Ende versehentlich zweimal meldet.
  const rundeLaeuft = useRef(true);
  // Zählt jede beendete Runde. Eine spät eintreffende Antwort aus einer
  // früheren Runde darf nicht am Dialog der aktuellen kleben.
  const endeMarke = useRef(0);

  const beiPunkten = useCallback((wert: number) => setPunkte(wert), []);

  const beiEnde = useCallback(
    (wert: number, gewonnen = false) => {
      if (!rundeLaeuft.current) return;
      rundeLaeuft.current = false;

      const vorher = bestwert(spiel.id);
      const { liste, schluessel } = ergebnisEintragen(spiel.id, wert);

      /*
       * Erfahrung, Stufe und Erfolge werden **hier** verbucht, in der Hülle.
       * Kein Spiel weiß davon; die Schnittstelle bleibt unverändert. Alles,
       * was dafür nötig ist, liegt ohnehin schon vor: Punkte, Sieg-Merkmal
       * und die Bestleistung vor der Runde.
       */
      const tag = heute();
      const ausbeute = rundeVerbuchen(
        fortschrittLesen(),
        { spielId: spiel.id, punkte: wert, gewonnen, bestwertVorher: vorher, tag },
        spiele.length,
      );

      /*
       * Die Tagesaufgaben laufen **nach** dem Verbuchen: Sie brauchen die
       * Sternzahl und ob es eine Bestleistung war, und beides rechnet die
       * Zeile darüber schon aus. Ihre Erfahrung kommt oben drauf — sonst
       * wäre eine geschaffte Aufgabe eine Meldung ohne Gegenwert.
       */
      const aufgaben = tagesaufgaben(tag, spiele);
      const tagesausbeute = tagesRundeVerbuchen(
        ausbeute.nachher.tages,
        aufgaben,
        {
          spielId: spiel.id,
          gewonnen,
          sterne: ausbeute.sterne,
          bestleistung: ausbeute.bestleistung,
        },
        tag,
      );

      const stand = {
        ...ausbeute.nachher,
        xp: ausbeute.nachher.xp + tagesausbeute.xp,
        tages: tagesausbeute.stand,
      };
      fortschrittSchreiben(stand);

      // Ein Stups im Gerät. Doppelschlag, wenn es etwas zu feiern gab.
      // Auf iPhone und iPad passiert dabei nichts — Safari kennt die
      // Schnittstelle nicht, siehe `core/haptik.ts`.
      haptik(
        ausbeute.neueStufe !== undefined ||
          ausbeute.neueErfolge.length > 0 ||
          tagesausbeute.fertig.length > 0
          ? 'jubel'
          : 'ende',
      );

      /*
       * Die Stufe wird aus dem **Gesamtstand** gerechnet, nicht aus
       * `ausbeute.nachher` — die Aufgaben-Erfahrung kommt erst danach dazu
       * und kann für sich schon eine Stufe heben. Aus demselben Grund wird
       * der Stufenaufstieg hier noch einmal gegen den Stand *vor* der Runde
       * geprüft statt `ausbeute.neueStufe` zu übernehmen.
       */
      const stufeVorher = stufeAus(ausbeute.nachher.xp - ausbeute.xpGewinn).stufe;
      const standNachher = stufeAus(stand.xp);

      setPunkte(wert);
      setEnde({
        punkte: wert,
        beste: liste[0]?.punkte ?? wert,
        vorher,
        rekord: wert > vorher,
        gewonnen,
        xpGewinn: ausbeute.xpGewinn + tagesausbeute.xp,
        stand: standNachher,
        ...(standNachher.stufe > stufeVorher ? { neueStufe: standNachher.stufe } : {}),
        neueErfolge: ausbeute.neueErfolge,
        fertigeAufgaben: tagesausbeute.fertig,
      });

      // Der Platz kommt **nachträglich** dazu. Der Dialog steht sofort, ohne
      // auf das Netz zu warten — das ist der ganze Sinn der Warteschlange.
      // Ohne Konto oder ohne Netz kommt schlicht nichts zurück.
      const marke = ++endeMarke.current;
      void ergebnisMelden(schluessel).then((platz) => {
        if (platz && marke === endeMarke.current) {
          setEnde((alt) => (alt ? { ...alt, platz } : alt));
        }
      });

      // Ein Duell zählt zusätzlich für sich. Die Runde selbst ist ganz
      // normal in der Bestenliste gelandet — gespielt ist gespielt.
      if (duell) {
        void duellMelden(duell.id, wert).then((stand) => {
          if (stand && marke === endeMarke.current) {
            setEnde((alt) => (alt ? { ...alt, duell: stand } : alt));
          }
        });
      }
    },
    [spiel.id, duell],
  );

  const nochmal = useCallback(() => {
    rundeLaeuft.current = true;
    setEnde(null);
    setPunkte(0);
    setRunde((r) => r + 1);
  }, []);

  // Fürs Weiterspielen-Angebot auf der Startseite. Bewusst beim **Betreten**
  // und nicht erst am Rundenende: Eine abgebrochene Runde ist beim Kind der
  // Normalfall, und genau dann will man beim nächsten Öffnen dort weitermachen.
  useEffect(() => {
    zuletztGespieltMerken(spiel.id);
  }, [spiel.id]);

  // Escape führt immer zurück ins Menü.
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [onExit]);

  const Spiel = spiel.Component;
  // Frisch bei jedem Rendern gelesen (billige, synchrone localStorage-
  // Abfrage) — nach beiEnde() steht der neue Rekord schon drin, bevor
  // dieser Wert das nächste Mal gebraucht wird.
  const beste = bestwert(spiel.id);

  const farbe = toenung(spiel.id, spiel.accent);
  const gezeigtePunkte = useHochzaehlen(punkte, einstellungen.reducedMotion);

  const sternzahl = useMemo(
    () => (ende ? sterne(ende.punkte, ende.vorher, ende.gewonnen) : 1),
    [ende],
  );

  /*
   * Die Zahl im Rundenende zählt **verzögert** hoch.
   *
   * Ohne die Verzögerung wäre der Zähler längst durch, bevor die Zeile
   * überhaupt sichtbar wird: Ihr Auftritt beginnt erst nach 460 ms, das
   * Hochzählen dauert 320. Man sähe nur das fertige Ergebnis — der ganze
   * Sinn der Staffelung ginge verloren.
   */
  const [zaehlZiel, setZaehlZiel] = useState(0);
  useEffect(() => {
    if (!ende) {
      setZaehlZiel(0);
      return;
    }
    if (einstellungen.reducedMotion) {
      setZaehlZiel(ende.punkte);
      return;
    }
    const uhr = window.setTimeout(() => setZaehlZiel(ende.punkte), 470);
    return () => window.clearTimeout(uhr);
  }, [ende, einstellungen.reducedMotion]);
  const gezeigtesErgebnis = useHochzaehlen(zaehlZiel, einstellungen.reducedMotion);

  /*
   * Ob diese Runde gefeiert wird. Bewusst hier abgeleitet und nicht in
   * `beiEnde` festgehalten: Der Platz und der Duellstand kommen später vom
   * Server nach und setzen `ende` neu — eine im Zustand gespeicherte
   * Feier-Marke würde dabei mitkopiert und das Konfetti liefe ein zweites
   * Mal los, mitten im schon offenen Dialog.
   */
  const gefeiert =
    !!ende &&
    (ende.neueStufe !== undefined ||
      ende.neueErfolge.length > 0 ||
      ende.fertigeAufgaben.length > 0 ||
      ende.rekord);

  /*
   * Der Jubelton bei drei Sternen.
   *
   * Er kommt **zusätzlich** zum Rundenende-Ton, den jedes Spiel selbst
   * abspielt — der ist absteigend und heißt „vorbei". Genau das war die
   * Beanstandung: Auch nach einer starken Runde klang es nach Niederlage.
   * Ein aufsteigender Dreiklang eine halbe Sekunde später liest sich als
   * Auszeichnung obendrauf, ohne dass ein einziges Spiel angefasst werden
   * muss.
   *
   * Die Sperre über `endeMarke` ist nötig: `ende` bekommt später noch den
   * Platz und den Duellstand angehängt, ist dann ein neues Objekt — und der
   * Ton liefe ein zweites Mal.
   */
  const tonMarke = useRef(-1);
  useEffect(() => {
    if (!ende || sternzahl < 3) return;
    if (tonMarke.current === endeMarke.current) return;
    tonMarke.current = endeMarke.current;
    const uhr = window.setTimeout(() => sfx('stufe'), 640);
    return () => window.clearTimeout(uhr);
  }, [ende, sternzahl]);

  return (
    <div
      // Genau eine Bildschirmhöhe, nicht mehr: Ohne feste Höhe wächst der
      // Rahmen mit seinem Inhalt und schiebt die unterste Reihe aus dem
      // Bild — bei textlastigen Spielen den Weiter-Knopf.
      /*
       * Auf Tablets breiter. `max-w-3xl` (768 px) deckelte **jedes** Spiel:
       * Auf einem 13-Zoll-iPad im Hochformat blieben je Seite rund 130 px
       * ungenutzt, und das Brett konnte nie größer als 744 px werden,
       * obwohl über 1000 zur Verfügung stehen. `.spielbrett` rechnet seine
       * Größe aus der Bühne (`100cqw`/`100cqh`) — es wächst also von allein
       * mit, sobald der Deckel steigt.
       */
      className="mx-auto flex h-dvh min-h-0 w-full max-w-3xl flex-col overflow-hidden md:max-w-5xl"
      // Färbt die vier Grundtokens leicht in der Spielfarbe ein. Wirkt
      // dadurch in jedem Element des Spiels, ohne dass ein Spiel etwas
      // davon wissen muss. Siehe `spielfarbe.ts`.
      style={spielfarbenStil(spiel.id, spiel.accent)}
    >
      <header
        className="flex items-center gap-3 px-4 pb-3"
        style={{
          // Siehe Seite.tsx — Abstand zur Statusleiste bei installierter App auf dem iPhone.
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
          // Genau hier passiert der Bruch: Die Kopfzeile ist das Erste, was
          // nach dem bunten Startbildschirm zu sehen ist. Statt grauer
          // Trennlinie ein flacher Verlauf in der Spielfarbe und eine
          // farbige Unterkante.
          background: `linear-gradient(180deg, color-mix(in srgb, ${farbe} 20%, transparent), transparent)`,
          borderBottom: `1px solid color-mix(in srgb, ${farbe} 40%, var(--color-rand))`,
        }}
      >
        <button
          type="button"
          onClick={onExit}
          className="spielknopf text-sm font-medium"
        >
          <span aria-hidden="true">←</span> Zurück
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold" style={{ color: spiel.accent }}>
          {spiel.title}
        </h1>
        <p className="text-right text-sm text-gedaempft">
          Punkte{' '}
          <output aria-live="polite" className="text-base font-bold text-text tabular-nums">
            {/* Vorgelesen wird der echte Wert, angezeigt der hochzählende —
                sonst läse ein Screenreader jede Zwischenzahl mit. */}
            <span aria-hidden="true">{gezeigtePunkte}</span>
            <span className="sr-only">{punkte}</span>
          </output>
        </p>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col">
        <Spiel
          key={runde}
          onScore={beiPunkten}
          onGameOver={beiEnde}
          onExit={onExit}
          settings={einstellungen}
          bestScore={beste}
          istErsteRunde={runde === 0}
          level={duell?.level}
        />

        {ende && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Spiel beendet"
            // `z-20` ist nicht schmückend, sondern nötig: `.spielbuehne > *`
            // gibt dem Brett `z-index: 1`, und ein positioniertes Element mit
            // Stufe 1 wird über einem mit `auto` gezeichnet — ganz gleich,
            // was weiter unten im Baum steht. Ohne diese Zeile lag das Brett
            // über dem Rundenende, in **jedem** Spiel mit Bühne.
            className="dialog-grund-auf absolute inset-0 z-20 grid place-items-center overflow-hidden bg-grund/85 p-4 backdrop-blur-sm"
          >
            {/* Konfetti nur bei den drei Anlässen, die es wert sind: neue
                Stufe, frischer Erfolg, neue Bestleistung. Bei jeder Runde
                zu feiern macht das Feiern wertlos — und wer gerade nach
                drei Sekunden verloren hat, mit Konfetti überschüttet zu
                werden, wirkt sogar hämisch. */}
            {gefeiert && <Feier ruhig={einstellungen.reducedMotion} />}

            {/* Der Moment, in dem man auf sein Ergebnis schaut — deshalb in
                der Farbe des Spiels statt im grauen Systemkasten. */}
            <div
              className="dialog-auf w-full max-w-sm rounded-karte p-6 text-center shadow-2xl ring-1 ring-white/15"
              style={{
                background: `linear-gradient(160deg, color-mix(in srgb, ${spiel.accent} 34%, var(--color-flaeche)), var(--color-flaeche) 70%)`,
              }}
            >
              <h2 className="ende-zeile text-xl font-black tracking-tight">
                {ende.gewonnen ? '🎉 Gewonnen!' : 'Vorbei'}
              </h2>

              {/* Die Sterne kommen **vor** der Zahl — sie sind das, was ein
                  Kind zuerst sucht, und sie gelten in jedem Spiel gleich.
                  Die Zahl darunter ist der Beleg dazu. */}
              <Sterne anzahl={sternzahl} verzoegerung={160} />

              <p
                className="ende-zeile mt-2 text-6xl leading-none font-black tabular-nums"
                style={{
                  color: spiel.accent,
                  textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                  '--verzoegerung': '460ms',
                } as CSSProperties}
              >
                {/* Zählt von null hoch. Vorgelesen wird der Endwert, sonst
                    läse ein Screenreader jede Zwischenzahl mit. */}
                <span aria-hidden="true">{gezeigtesErgebnis}</span>
                <span className="sr-only">{ende.punkte}</span>
              </p>

              <p
                className="ende-zeile mt-3 text-base font-bold"
                style={{ '--verzoegerung': '620ms' } as CSSProperties}
              >
                {ende.rekord ? (
                  <span style={{ color: '#facc15' }}>★ Neue Bestleistung!</span>
                ) : (
                  <span className="text-sm font-medium text-gedaempft">
                    {sternText(sternzahl)} Beste Punktzahl: {ende.beste}
                  </span>
                )}
              </p>

              {/* Erfahrung. Steht **vor** Platz und Duell: Sie kommt sofort
                  und ohne Netz, die beiden anderen kommen vielleicht nie.
                  Was immer da ist, gehört nach oben. */}
              <Erfahrungsbalken
                stand={ende.stand}
                gewinn={ende.xpGewinn}
                ruhig={einstellungen.reducedMotion}
                verzoegerung={700}
              />
              <p
                className="ende-zeile mt-1.5 text-sm font-bold"
                style={{ '--verzoegerung': '760ms', color: 'var(--color-xp)' } as CSSProperties}
              >
                +{ende.xpGewinn} XP
              </p>

              {/* Der Stufenaufstieg ist das größte Ereignis im Dialog und
                  bekommt deshalb als Einziges einen eigenen farbigen
                  Kasten. Käme er als weitere graue Zeile, wäre er
                  weniger wert als „Beste Punktzahl: 41". */}
              {ende.neueStufe !== undefined && (
                <p
                  className="dialog-auf mt-3 rounded-xl px-3 py-2.5 text-base font-black"
                  style={{
                    background:
                      'linear-gradient(90deg, color-mix(in oklab, var(--color-xp) 32%, transparent), color-mix(in oklab, var(--color-fokus) 26%, transparent))',
                    boxShadow: 'var(--schatten-2)',
                  }}
                >
                  🎉 Stufe {ende.neueStufe} erreicht!
                </p>
              )}

              {/* Geschaffte Tagesaufgaben. Sie stehen **vor** den Erfolgen:
                  Eine Tagesaufgabe ist der Grund, aus dem man heute noch
                  eine Runde spielt — sie gehört an die Stelle, auf die man
                  zuerst schaut. */}
              {ende.fertigeAufgaben.map((aufgabe, i) => (
                <p
                  key={aufgabe.id}
                  className="dialog-auf mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2 text-left"
                  style={{
                    background:
                      'color-mix(in oklab, var(--color-erfolg) 20%, rgb(255 255 255 / 0.08))',
                    boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--color-erfolg) 40%, transparent)',
                    animationDelay: `${860 + i * 130}ms`,
                  }}
                >
                  <span aria-hidden="true" className="text-2xl">
                    {aufgabe.symbol}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold tracking-wide text-white/65 uppercase">
                      Tagesaufgabe geschafft
                    </span>
                    <span className="block text-sm font-bold">{aufgabe.text}</span>
                  </span>
                  <span
                    className="shrink-0 text-sm font-black"
                    style={{ color: 'var(--color-xp)' }}
                  >
                    +{aufgabe.xp}
                  </span>
                </p>
              ))}

              {/* Frisch freigeschaltete Erfolge. Nur die **neuen** — die
                  gesammelten stehen auf der Fortschrittsseite. Ein Dialog,
                  der nach jeder Runde alle vierzehn aufzählt, feiert nichts
                  mehr. */}
              {ende.neueErfolge.map((erfolg, i) => (
                <p
                  key={erfolg.id}
                  className="dialog-auf mt-2 flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2 text-left"
                  style={{ animationDelay: `${900 + i * 140}ms` }}
                >
                  <span aria-hidden="true" className="text-2xl">
                    {erfolg.symbol}
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{erfolg.titel}</span>
                    <span className="block text-xs text-gedaempft">{erfolg.beschreibung}</span>
                  </span>
                </p>
              ))}

              {/* Kommt nach, sobald der Server geantwortet hat — und nur,
                  wenn jemand angemeldet ist. Der Auftritt ist bewusst
                  auffällig: Das ist der ganze Reiz daran, ein Konto zu haben.
                  „Platz 1" bekommt dazu einen eigenen Satz, „Platz 1 von 8"
                  liest sich sonst kleiner als es ist. */}
              {ende.platz && (
                <p className="dialog-auf mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold">
                  {ende.platz.platz === 1 ? (
                    <>🥇 Du bist die Nummer 1 von {ende.platz.teilnehmer}!</>
                  ) : (
                    <>
                      Platz {ende.platz.platz} von {ende.platz.teilnehmer}
                    </>
                  )}
                </p>
              )}

              {/* Der Duellstand. Steht bewusst unter der eigenen Punktzahl
                  und nicht darüber: Erst sieht man, was man selbst geschafft
                  hat, dann was es gegen den anderen wert war. */}
              {ende.duell && ichBin && (
                <p className="dialog-auf mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold">
                  {standText(standFuer(ende.duell, ichBin))}
                  {fremdePunkte(ende.duell, ichBin) !== null &&
                    ` — ${fremdePunkte(ende.duell, ichBin)} für den Gegner`}
                </p>
              )}

              <div
                className="ende-zeile mt-6 flex flex-col gap-2.5"
                style={{ '--verzoegerung': '760ms' } as CSSProperties}
              >
                {/* Im Duell gibt es kein „Nochmal": Jede Seite spielt ihr
                    Level genau einmal, sonst könnte man beliebig oft
                    nachbessern. */}
                {!duell && (
                  <button
                    type="button"
                    autoFocus
                    onClick={nochmal}
                    className="rounded-xl px-4 py-3.5 text-lg font-extrabold text-grund transition-transform active:scale-95"
                    style={{ backgroundColor: spiel.accent }}
                  >
                    Nochmal
                  </button>
                )}
                <button
                  type="button"
                  onClick={onExit}
                  autoFocus={!!duell}
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 font-medium transition-transform hover:bg-white/10 active:scale-95"
                >
                  {duell ? 'Fertig' : 'Zurück zum Menü'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
