import { schritt } from '../../core/rng';

/**
 * Even Cut — die reine Geometrie.
 *
 * Hier steckt der ganze knifflige Teil des Spiels: eine Form an einer
 * Geraden zerteilen und die beiden Flächeninhalte ausrechnen. Beides ohne
 * React, ohne Browser und ohne Uhr — und damit vollständig prüfbar.
 *
 * **Alle Formen sind konvex.** Das ist keine Bequemlichkeit, sondern die
 * Bedingung dafür, dass ein gerader Schnitt **genau zwei** Teile ergibt.
 * Bei einer eingedellten Form (Stern, Mond) kann dieselbe Gerade drei oder
 * mehr Stücke abtrennen — dann stimmt weder die Anzeige noch die Wertung,
 * und der Aufwand wäre ein Vielfaches. Abwechslung entsteht stattdessen
 * über Eckenzahl, Streckung und Drehung.
 */

export type Punkt = { x: number; y: number };
export type Form = readonly Punkt[];

/**
 * Auf welcher Seite der Geraden a→b liegt p?
 *
 * Größer null heißt links, kleiner null rechts, null genau darauf. Das ist
 * das Kreuzprodukt der beiden Richtungsvektoren — der Betrag ist außerdem
 * das doppelte Dreiecksflächenmaß, wir brauchen aber nur das Vorzeichen.
 */
export function seite(p: Punkt, a: Punkt, b: Punkt): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

/** Flächeninhalt über die Schnürsenkelformel. Immer positiv. */
export function flaeche(form: Form): number {
  let summe = 0;
  for (let i = 0; i < form.length; i++) {
    const p = form[i]!;
    const q = form[(i + 1) % form.length]!;
    summe += p.x * q.y - q.x * p.y;
  }
  return Math.abs(summe) / 2;
}

/** Der Mittelpunkt der Fläche — dorthin fliegt das Stück nach dem Schnitt. */
export function schwerpunkt(form: Form): Punkt {
  let flaechenmass = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < form.length; i++) {
    const p = form[i]!;
    const q = form[(i + 1) % form.length]!;
    const kreuz = p.x * q.y - q.x * p.y;
    flaechenmass += kreuz;
    x += (p.x + q.x) * kreuz;
    y += (p.y + q.y) * kreuz;
  }
  // Entartete Form (alle Punkte auf einer Linie): dann das schlichte Mittel.
  if (Math.abs(flaechenmass) < 1e-9) {
    const n = Math.max(1, form.length);
    return {
      x: form.reduce((s, p) => s + p.x, 0) / n,
      y: form.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  return { x: x / (3 * flaechenmass), y: y / (3 * flaechenmass) };
}

/** Schnittpunkt der Strecke p→q mit der Geraden a→b. */
function schnittpunkt(p: Punkt, q: Punkt, a: Punkt, b: Punkt): Punkt {
  const sp = seite(p, a, b);
  const sq = seite(q, a, b);
  // sp und sq haben verschiedene Vorzeichen, der Nenner ist also nie null.
  const anteil = sp / (sp - sq);
  return { x: p.x + (q.x - p.x) * anteil, y: p.y + (q.y - p.y) * anteil };
}

/**
 * Schneidet alles weg, was auf der falschen Seite der Geraden liegt
 * (Verfahren nach Sutherland und Hodgman).
 *
 * Punkte **genau auf** der Geraden gehören zu beiden Seiten — sonst
 * entstünde bei einem Schnitt exakt durch eine Ecke eine Lücke.
 */
function klippen(form: Form, a: Punkt, b: Punkt, linkeSeite: boolean): Punkt[] {
  const drin = (wert: number) => (linkeSeite ? wert >= 0 : wert <= 0);
  const raus: Punkt[] = [];
  for (let i = 0; i < form.length; i++) {
    const p = form[i]!;
    const q = form[(i + 1) % form.length]!;
    const pDrin = drin(seite(p, a, b));
    const qDrin = drin(seite(q, a, b));
    if (pDrin) raus.push(p);
    // Nur wenn die Kante die Gerade wirklich kreuzt, kommt ein neuer Punkt
    // dazu — bei „beide drin" oder „beide draußen" nicht.
    if (pDrin !== qDrin) raus.push(schnittpunkt(p, q, a, b));
  }
  return raus;
}

/** Die beiden Stücke, die ein Schnitt entlang a→b hinterlässt. */
export function schneiden(form: Form, a: Punkt, b: Punkt): { links: Punkt[]; rechts: Punkt[] } {
  return {
    links: klippen(form, a, b, true),
    rechts: klippen(form, a, b, false),
  };
}

/**
 * Wie gut war der Schnitt? 0 = ein Stück ist alles, 100 = beide gleich groß.
 *
 * Verfehlt der Schnitt die Form ganz, ist ein Stück leer und es gibt 0.
 */
export function genauigkeit(links: Form, rechts: Form): number {
  const a = flaeche(links);
  const b = flaeche(rechts);
  const gesamt = a + b;
  if (gesamt <= 0) return 0;
  return (1 - Math.abs(a - b) / gesamt) * 100;
}

/**
 * Punkte für einen Schnitt.
 *
 * Absichtlich streng: Ein Schnitt „irgendwo durch" soll sich nicht schon
 * wie ein Treffer anfühlen. Wer 10 % danebenliegt, bekommt gar nichts mehr
 * — genau das macht den letzten Millimeter interessant.
 */
export function punkteFuerSchnitt(genau: number): number {
  const abweichung = 100 - genau;
  if (abweichung <= 0.5) return 100; // praktisch perfekt
  return Math.max(0, Math.round(100 - abweichung * 10));
}

// ---------------------------------------------------------------------
// Formen erzeugen
// ---------------------------------------------------------------------

/** Alle Formen liegen um den Nullpunkt und passen in diesen Halbmesser. */
export const FORM_GROESSE = 38;

/**
 * Eine konvexe Form aus der Levelnummer.
 *
 * Der Trick für „konvex, aber unregelmäßig": Punkte werden über den Kreis
 * verteilt und nur ihr **Abstand** zum Mittelpunkt wird verändert, nie ihre
 * Reihenfolge. Winkelmäßig aufsteigende Punkte auf einem Kreis ergeben immer
 * ein konvexes Vieleck — bei gleichem Abstand ohnehin, und ein gedehnter
 * Kreis (Ellipse) bleibt es auch.
 *
 * Ein Zufallshaufen von Punkten wäre nicht konvex, und dafür bräuchte es
 * eine Hüllenberechnung, die hier niemand gebraucht.
 */
export function formErzeugen(saat: number, level: number): Form {
  const a = schritt(saat);
  const b = schritt(a.saat);
  const c = schritt(b.saat);

  // 3 bis 8 Ecken; ab 12 Ecken wirkt es rund und ist zu leicht zu treffen.
  const ecken = 3 + Math.floor(a.wert * 6);

  // Streckung: Je höher das Level, desto schmaler darf die Form werden.
  // Eine gestreckte Form hat weniger offensichtliche Halbierungslinien.
  const maxDehnung = Math.min(0.55, 0.12 + level * 0.045);
  const dehnung = 1 - b.wert * maxDehnung;

  // Drehung: Ohne sie liegt bei jeder Form eine Symmetrieachse waagerecht
  // oder senkrecht, und man könnte immer stumpf gerade durchziehen.
  const drehung = c.wert * 2 * Math.PI;

  const punkte: Punkt[] = [];
  for (let i = 0; i < ecken; i++) {
    const winkel = drehung + (i / ecken) * 2 * Math.PI;
    punkte.push({
      x: Math.cos(winkel) * FORM_GROESSE,
      y: Math.sin(winkel) * FORM_GROESSE * dehnung,
    });
  }
  return punkte;
}

/** Prüfhilfe: Ist die Form konvex? Alle Kreuzprodukte haben dasselbe Vorzeichen. */
export function istKonvex(form: Form): boolean {
  let vorzeichen = 0;
  for (let i = 0; i < form.length; i++) {
    const p = form[i]!;
    const q = form[(i + 1) % form.length]!;
    const r = form[(i + 2) % form.length]!;
    const kreuz = seite(r, p, q);
    if (Math.abs(kreuz) < 1e-9) continue;
    const dieses = kreuz > 0 ? 1 : -1;
    if (vorzeichen === 0) vorzeichen = dieses;
    else if (vorzeichen !== dieses) return false;
  }
  return true;
}
