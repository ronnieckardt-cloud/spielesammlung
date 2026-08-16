import { useState } from 'react';
import { Seite } from './Seite';
import { Avatar } from './AvatarBild';
import { abmelden, anmelden, passwortNeuSetzen, registrieren } from './konto';
import type { Konto } from './konto';
import { avatarLesen, fortschrittLesen } from './speicher';
import { stufeAus } from './fortschritt';

/**
 * Der Einladungscode. Steht auch im Klartext in der Datenbank
 * (`spiel_einladung`); geprüft wird er dort, nicht hier. Diese Zeile ist
 * nur die Anzeige zum Weitergeben — geheim ist er ohnehin nicht, jeder
 * Eingeladene kennt ihn danach.
 */
const EINLADUNGSCODE = 'FLORIAN2026';

/**
 * Anmelden und Registrieren.
 *
 * Bewusst schlicht: zwei Felder, ein Knopf. Für ein Kind gilt bei jeder
 * Entscheidung hier die einfachere Variante.
 *
 * **Keine E-Mail-Adresse.** Supabase kennt Passwörter zwar nur zusammen mit
 * einer Adresse — die bildet die App aber selbst aus dem Namen. Das Kind
 * sieht sie nie.
 *
 * **Kein Abmelde-Knopf an prominenter Stelle.** Ohne E-Mail gibt es keinen
 * „Passwort vergessen"-Link; wer sich abmeldet und das Passwort nicht mehr
 * weiß, kommt nicht zurück. Die Sitzung verlängert sich deshalb endlos, und
 * Abmelden steht klein unten.
 */

type Modus = 'anmelden' | 'neu' | 'vergessen';

/**
 * Der Einladungscode zum Weitergeben.
 *
 * Er steht bewusst **im Klartext auf der Seite** und nicht nur in einer
 * Datenbank: Ronni ist meistens unterwegs, wenn ein Kind fragt, und soll
 * nicht erst irgendwo nachschlagen müssen. Missbrauch ist auch nicht
 * schlimm — der Server lässt höchstens fünf neue Konten am Tag durch, und
 * jeder neue Name ist am Ende nur ein weiterer Eintrag in der Bestenliste.
 *
 * Zwei Knöpfe, weil beides gebraucht wird: Teilen öffnet auf dem Handy
 * direkt WhatsApp und Co., Kopieren ist der Rückfall auf dem Rechner.
 */
function Einladen() {
  const [gemerkt, setGemerkt] = useState(false);

  const adresse = `${window.location.origin}${window.location.pathname}`;
  const nachricht =
    `Komm zu Flow Games! 🎮\n\n${adresse}\n\n` +
    `Tipp oben rechts auf „Anmelden", dann auf „Ich brauche ein neues Konto".\n` +
    `Einladungscode: ${EINLADUNGSCODE}\n\n` +
    `Eine E-Mail-Adresse brauchst du nicht — nur einen Spielnamen und ein Passwort.`;

  const teilen = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Flow Games', text: nachricht });
        return;
      }
      await navigator.clipboard.writeText(nachricht);
      setGemerkt(true);
      window.setTimeout(() => setGemerkt(false), 2500);
    } catch {
      // Abgebrochen oder nicht erlaubt — der Code steht ja trotzdem da.
    }
  };

  return (
    <div className="rounded-karte border border-rand bg-flaeche p-4 text-left">
      <h2 className="font-bold">Freunde einladen</h2>
      <p className="mt-1 text-sm text-gedaempft">
        Wer mitspielen will, braucht diesen Code. Er gilt für bis zu fünf neue Konten am Tag.
      </p>
      <p className="mt-3 rounded-xl bg-grund/60 py-3 text-center text-2xl font-black tracking-[0.2em] select-all">
        {EINLADUNGSCODE}
      </p>
      <button
        type="button"
        onClick={teilen}
        style={{ backgroundColor: 'var(--color-fokus)' }}
        className="spielknopf spielknopf-gross mt-3 w-full text-grund"
      >
        {gemerkt ? '✓ Kopiert' : 'Einladung verschicken'}
      </button>
    </div>
  );
}

export function KontoSeite({
  konto,
  onZurueck,
  onAvatar,
}: {
  konto: Konto | null;
  onZurueck: () => void;
  onAvatar: () => void;
}) {
  const [modus, setModus] = useState<Modus>('anmelden');
  const [name, setName] = useState('');
  const [passwort, setPasswort] = useState('');
  const [code, setCode] = useState('');
  const [zeigePasswort, setZeigePasswort] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  if (konto) {
    // Nur zur Anzeige — der Avatar selbst hängt nicht am Konto, er
    // funktioniert genauso ohne Anmeldung (siehe `avatar.ts`).
    const stufe = stufeAus(fortschrittLesen().xp).stufe;
    const avatar = avatarLesen(stufe);
    return (
      <Seite titel="Dein Konto" onZurueck={onZurueck}>
        <div className="mx-auto flex max-w-sm flex-col gap-5 text-center">
          <div className="rounded-karte border border-rand bg-flaeche p-6">
            <button
              type="button"
              onClick={onAvatar}
              aria-label="Avatar anpassen"
              className="druckbar mx-auto block"
            >
              <Avatar konfig={avatar} className="size-20" />
            </button>
            <p className="mt-3 text-sm text-gedaempft">Angemeldet als</p>
            <p className="mt-1 text-2xl font-black">{konto.name}</p>
            <button
              type="button"
              onClick={onAvatar}
              className="mt-2 inline-flex min-h-11 items-center text-sm text-fokus underline underline-offset-4"
            >
              Avatar anpassen
            </button>
          </div>
          <p className="text-sm text-gedaempft">
            Deine Ergebnisse landen jetzt auf allen deinen Geräten und in der
            Bestenliste.
          </p>

          <Einladen />
          {/* Klein und unten: Wer sich abmeldet und sein Passwort vergisst,
              kommt ohne Hilfe nicht mehr in sein Konto. */}
          <button
            type="button"
            onClick={abmelden}
            className="inline-flex min-h-11 items-center text-sm text-gedaempft underline underline-offset-4"
          >
            Abmelden
          </button>
        </div>
      </Seite>
    );
  }

  const absenden = async (e: React.FormEvent) => {
    e.preventDefault();
    setFehler(null);
    setLaeuft(true);
    try {
      if (modus === 'neu') await registrieren(name.trim(), passwort, code.trim());
      else if (modus === 'vergessen') await passwortNeuSetzen(name.trim(), code.trim(), passwort);
      else await anmelden(name.trim(), passwort);
      // Kein Sprung zurück ins Menü: Die Seite zeigt jetzt von selbst
      // „Angemeldet als …" — für ein Kind die klarere Bestätigung als ein
      // wortloser Wechsel auf die Startseite.
    } catch (ausnahme) {
      setFehler(
        ausnahme instanceof Error && ausnahme.message
          ? uebersetzen(ausnahme.message)
          : 'Das hat gerade nicht geklappt.',
      );
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <Seite
      titel={
        modus === 'neu' ? 'Neues Konto' : modus === 'vergessen' ? 'Neues Passwort' : 'Anmelden'
      }
      onZurueck={onZurueck}
    >
      <form onSubmit={absenden} className="mx-auto flex max-w-sm flex-col gap-4">
        <p className="text-sm text-gedaempft">
          {modus === 'neu'
            ? 'Such dir einen Spielnamen aus — nicht deinen echten Namen.'
            : modus === 'vergessen'
              ? 'Kein Problem — dein Konto und alle Punkte bleiben. Deine Eltern brauchen dafür nur den Einladungscode.'
              : 'Melde dich mit deinem Spielnamen an.'}
        </p>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Spielname
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            autoCapitalize="off"
            required
            className="rounded-xl border border-rand bg-flaeche px-4 py-3 text-base"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          {modus === 'vergessen' ? 'Neues Passwort' : 'Passwort'}
          <span className="flex gap-2">
            <input
              value={passwort}
              onChange={(e) => setPasswort(e.target.value)}
              type={zeigePasswort ? 'text' : 'password'}
              autoComplete={modus === 'anmelden' ? 'current-password' : 'new-password'}
              required
              className="min-w-0 flex-1 rounded-xl border border-rand bg-flaeche px-4 py-3 text-base"
            />
            {/* Ein Kind vertippt sich beim Passwort ständig — der Umschalter
                spart die halben Fehlversuche. */}
            <button
              type="button"
              onClick={() => setZeigePasswort((a) => !a)}
              aria-label={zeigePasswort ? 'Passwort verbergen' : 'Passwort zeigen'}
              className="spielknopf text-lg"
            >
              {zeigePasswort ? '🙈' : '👁'}
            </button>
          </span>
        </label>

        {modus !== 'anmelden' && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Einladungscode
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="characters"
              required
              className="rounded-xl border border-rand bg-flaeche px-4 py-3 text-base"
            />
            <span className="text-xs font-normal text-gedaempft">
              {modus === 'vergessen'
                ? /* Der Code ist hier der Ersatz für die „Passwort
                     vergessen"-Mail, die es ohne echte Adresse nicht geben
                     kann. Weil ihn nur die Eltern kennen, ist ein neues
                     Passwort bewusst eine Erwachsenen-Handlung — sonst
                     könnte jedes Kind das Konto jedes anderen übernehmen. */
                  'Den kennen deine Eltern. Ohne ihn geht es nicht — so kann niemand fremdes dein Konto übernehmen.'
                : 'Den bekommst du von Ronni oder von jemandem, der schon dabei ist.'}
            </span>
          </label>
        )}

        {fehler && (
          <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-300">
            {fehler}
          </p>
        )}

        <button
          type="submit"
          disabled={laeuft}
          // Die Füllung als Stil, nicht als `bg-fokus`: `.spielknopf` steht
          // ohne Ebene in der CSS-Datei und schlägt damit jede Tailwind-Klasse.
          // Genauso macht es der Weiter-Knopf in Quiz Time.
          style={{ backgroundColor: 'var(--color-fokus)' }}
          className="spielknopf spielknopf-gross text-grund"
        >
          {laeuft
            ? 'Einen Moment …'
            : modus === 'neu'
              ? 'Konto anlegen'
              : modus === 'vergessen'
                ? 'Neues Passwort setzen'
                : 'Anmelden'}
        </button>

        <button
          type="button"
          onClick={() => {
            setModus(modus === 'anmelden' ? 'neu' : 'anmelden');
            setFehler(null);
          }}
          className="inline-flex min-h-11 items-center text-sm text-gedaempft underline underline-offset-4"
        >
          {modus === 'anmelden' ? 'Ich brauche ein neues Konto' : 'Ich habe schon ein Konto'}
        </button>

        {/* Nur beim Anmelden — beim Anlegen ergibt „vergessen" keinen Sinn,
            und im Vergessen-Modus führt der Knopf darüber schon zurück. */}
        {modus === 'anmelden' && (
          <button
            type="button"
            onClick={() => {
              setModus('vergessen');
              setPasswort('');
              setFehler(null);
            }}
            className="inline-flex min-h-11 items-center text-sm text-gedaempft underline underline-offset-4"
          >
            Passwort vergessen?
          </button>
        )}
      </form>
    </Seite>
  );
}

/**
 * Server-Meldungen in Sätze übersetzen, die ein Kind versteht.
 *
 * Die Meldungen der eigenen Registrierungs-Funktion sind schon deutsch und
 * kindgerecht; hier geht es nur um die englischen Standardmeldungen von
 * Supabase Auth.
 */
function uebersetzen(meldung: string): string {
  const m = meldung.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'Name oder Passwort stimmt nicht. Schau nochmal genau hin.';
  }
  if (m.includes('email not confirmed')) {
    return 'Mit dem Konto stimmt etwas nicht. Sag Ronni Bescheid.';
  }
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    // Hier geht es ums Anmelden, nicht ums Spielen — ein Hinweis auf
    // gespeicherte Punkte wäre an dieser Stelle nur verwirrend.
    return 'Kein Internet. Spielen geht trotzdem, nur das Anmelden braucht Netz.';
  }
  return meldung;
}
