import { useState } from 'react';
import { Seite } from './Seite';
import { abmelden, anmelden, registrieren } from './konto';
import type { Konto } from './konto';

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

type Modus = 'anmelden' | 'neu';

export function KontoSeite({ konto, onZurueck }: { konto: Konto | null; onZurueck: () => void }) {
  const [modus, setModus] = useState<Modus>('anmelden');
  const [name, setName] = useState('');
  const [passwort, setPasswort] = useState('');
  const [code, setCode] = useState('');
  const [zeigePasswort, setZeigePasswort] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  if (konto) {
    return (
      <Seite titel="Dein Konto" onZurueck={onZurueck}>
        <div className="mx-auto flex max-w-sm flex-col gap-5 text-center">
          <div className="rounded-karte border border-rand bg-flaeche p-6">
            <p className="text-sm text-gedaempft">Angemeldet als</p>
            <p className="mt-1 text-2xl font-black">{konto.name}</p>
          </div>
          <p className="text-sm text-gedaempft">
            Deine Ergebnisse landen jetzt auf allen deinen Geräten und in der
            Bestenliste.
          </p>
          {/* Klein und unten: Wer sich abmeldet und sein Passwort vergisst,
              kommt ohne Hilfe nicht mehr in sein Konto. */}
          <button
            type="button"
            onClick={abmelden}
            className="text-sm text-gedaempft underline underline-offset-4"
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
    <Seite titel={modus === 'neu' ? 'Neues Konto' : 'Anmelden'} onZurueck={onZurueck}>
      <form onSubmit={absenden} className="mx-auto flex max-w-sm flex-col gap-4">
        <p className="text-sm text-gedaempft">
          {modus === 'neu'
            ? 'Such dir einen Spielnamen aus — nicht deinen echten Namen.'
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
          Passwort
          <span className="flex gap-2">
            <input
              value={passwort}
              onChange={(e) => setPasswort(e.target.value)}
              type={zeigePasswort ? 'text' : 'password'}
              autoComplete={modus === 'neu' ? 'new-password' : 'current-password'}
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

        {modus === 'neu' && (
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
              Den bekommst du von Ronni.
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
          {laeuft ? 'Einen Moment …' : modus === 'neu' ? 'Konto anlegen' : 'Anmelden'}
        </button>

        <button
          type="button"
          onClick={() => {
            setModus(modus === 'neu' ? 'anmelden' : 'neu');
            setFehler(null);
          }}
          className="text-sm text-gedaempft underline underline-offset-4"
        >
          {modus === 'neu' ? 'Ich habe schon ein Konto' : 'Ich brauche ein neues Konto'}
        </button>
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
