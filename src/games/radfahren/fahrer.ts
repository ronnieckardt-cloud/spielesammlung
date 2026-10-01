import { LICHT_X, LICHT_Y, mischen } from './farben';

/**
 * Der Fahrer — ein Mensch in Seitenansicht, gebaut wie ein Körper und nicht
 * wie ein Gestell aus Rohren.
 *
 * **Was an der Vorgängerfassung falsch war.** Rumpf, Arme und Beine waren
 * Kapseln mit runden Enden, nur ein Bein und ein Arm sichtbar, keine
 * Kleidung, die irgendetwas tat. Ein Mensch auf dem Rad hat zwei Beine und
 * zwei Arme, trägt Schoner, Handschuhe und Rucksack, lehnt sich, federt und
 * wird vom Fahrtwind an den Stoffkanten gezupft. Jede dieser Kleinigkeiten
 * ist für sich kaum zu sehen — zusammen sind sie der Unterschied zwischen
 * „Strichmännchen mit Kleidungsfarbe" und „Fahrer".
 *
 * **Aufbau.**
 *
 * 1. `skelettBerechnen` legt aus Rad und Haltung die Gelenke fest (Hüfte,
 *    Knie, Knöchel, Schulter, Ellbogen, Hand, Kopf). Beine und Arme sind
 *    Zwei-Knochen-IK: Die Längen stimmen immer, das Knie knickt nie um.
 * 2. `fahrerHinten` zeichnet, was **hinter** dem Rad liegt: das ferne Bein
 *    und den fernen Arm, etwas abgedunkelt. Der Aufrufer zeichnet danach den
 *    Rahmen darüber.
 * 3. `fahrerVorn` zeichnet den Rest: nahes Bein, Rumpf mit Rucksack, Kopf,
 *    nahen Arm.
 *
 * **Glieder sind Röhren, keine Kapseln.** Eine Röhre läuft als glatte Kurve
 * durch drei Punkte (Hüfte, Knie, Knöchel) und ändert ihren Querschnitt
 * stetig: Oberschenkel dick, Wade mit Wölbung, Knöchel schmal. Es gibt kein
 * Gelenk, an dem zwei Teile aneinanderstoßen — die Silhouette ist eine
 * Linie. Das ist das ganze Geheimnis hinter organisch aussehenden Beinen.
 *
 * **Form entsteht aus dem Licht, nicht aus der Kontur.** Jedes Teil bekommt
 * einen Verlauf quer zur Achse, ein helles Band auf der Lichtseite und ein
 * dunkles auf der Gegenseite (Licht immer von oben links, wie im ganzen
 * Spiel). Das Band folgt der Röhre, auch um die Ecke.
 */

export type P = { x: number; y: number };

export type FahrerGeo = {
  /** Meter → Bildpunkte. Alle Maße unten sind Meter mal `m`. */
  m: number;
  tretlager: P;
  /** Oberkante des Sattels. */
  sattel: P;
  /** Mitte der Lenkergriffe. */
  lenker: P;
};

export type FahrerPose = {
  /** 0 = sitzend, 1 = stehend (Angriffshaltung). */
  stehen: number;
  /** 0 bis 1: Beugung durch Einfedern und Landen. */
  hocke: number;
  /** −1 = Gewicht hinten, +1 = vorn. */
  gewicht: number;
  /** 0 bis 1: Streckung beim Pop (Beine und Körper gehen hoch). */
  streck: number;
  /** Kurbelwinkel in Radiant. */
  kurbel: number;
  /** 0 bis 1: Fahrtwind — zupft an Trikot und Hose. */
  wind: number;
  /** Laufende Zeit in Sekunden, nur fürs Flattern. */
  zeit: number;
};

export type Skelett = {
  huefte: P;
  schulter: P;
  /** Mitte des Kopfes (der Helm sitzt darum). */
  kopf: P;
  /** Rumpfneigung aus der Senkrechten, Radiant; positiv = nach vorn. */
  lehn: number;
  knieNah: P;
  knieFern: P;
  knoechelNah: P;
  knoechelFern: P;
  pedalNah: P;
  pedalFern: P;
  ellbogenNah: P;
  ellbogenFern: P;
  /** Beide Hände liegen am Griff — eine Stelle, zwei Hände. */
  hand: P;
  /** Nur beim Sturz: die ferne Hand frei, wo sie gerade hinschlägt. */
  handFern?: P;
};

// ---------------------------------------------------------------------
// Farben
// ---------------------------------------------------------------------
const F = {
  haut: '#e2ab84',
  hautDunkel: '#b9805c',
  trikot: '#14b8a6',
  trikotDunkel: '#0b6e69',
  trikotHell: '#7cf0dd',
  weiss: '#f6f8fa',
  hose: '#3e4a62',
  hoseDunkel: '#1d2433',
  schoner: '#1a1e27',
  schonerKappe: '#454d5e',
  socke: '#f3f6f9',
  schuh: '#eef2f6',
  schuhDunkel: '#171a21',
  rot: '#d92d20',
  rotDunkel: '#8c1710',
  helm: '#f5f7f9',
  helmSchatten: '#b7c1cd',
  teal: '#14b8a6',
  brille: '#171e29',
  linseHell: '#8ff3e1',
  linseDunkel: '#1b6d8f',
  rucksack: '#232937',
  kontur: 'rgba(8,10,16,0.6)',
};

// ---------------------------------------------------------------------
// Kleine Rechenhelfer
// ---------------------------------------------------------------------
const plus = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });
const minus = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y });
const mal = (a: P, k: number): P => ({ x: a.x * k, y: a.y * k });
const laenge = (a: P) => Math.hypot(a.x, a.y);
const norm = (a: P): P => {
  const l = laenge(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const lern = (a: number, b: number, t: number) => a + (b - a) * t;
const lernP = (a: P, b: P, t: number): P => ({ x: lern(a.x, b.x, t), y: lern(a.y, b.y, t) });
const begrenzen = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Kürzester Weg zwischen zwei Winkeln, damit eine Kurbel nie „rückwärts" um die Runde dreht. */
function lernWinkel(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/**
 * Zwei-Knochen-IK. Gibt **beide** Lösungen für das Gelenk zurück; der
 * Aufrufer wählt die, die zur Körperhaltung passt (Knie nach vorn, Ellbogen
 * nach oben). Mit fester Biegerichtung klappt ein Gelenk um, sobald das Ziel
 * die Basis überholt.
 */
function ik(basis: P, ziel: P, l1: number, l2: number): [P, P] {
  const d0 = minus(ziel, basis);
  const dRoh = laenge(d0) || 0.0001;
  const d = begrenzen(dRoh, Math.abs(l1 - l2) + 0.001, l1 + l2 - 0.001);
  const winkel = Math.atan2(d0.y, d0.x);
  const cosA = begrenzen((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const a = Math.acos(cosA);
  return [
    { x: basis.x + Math.cos(winkel + a) * l1, y: basis.y + Math.sin(winkel + a) * l1 },
    { x: basis.x + Math.cos(winkel - a) * l1, y: basis.y + Math.sin(winkel - a) * l1 },
  ];
}

// ---------------------------------------------------------------------
// Skelett
// ---------------------------------------------------------------------
/**
 * Körpermaße in Metern, **im Maßstab des Rades**. Das Rad ist gegenüber einem
 * echten Mountainbike um gut 15 Prozent vergrößert (siehe `RAD_R` in
 * `zeichnen.ts`) — ein Fahrer in Normalgröße säße darauf wie ein Kind auf
 * einem Erwachsenenrad. Die Maße hier sind deshalb die eines 1,80-m-Fahrers
 * mal 1,15: Oberschenkel 0,45 → 0,52, Unterschenkel 0,43 → 0,50 und so fort.
 */
const LAENGEN = {
  femur: 0.52,
  tibia: 0.5,
  torso: 0.6,
  oberarm: 0.35,
  unterarm: 0.31,
};

export function skelettBerechnen(g: FahrerGeo, pose: FahrerPose): Skelett {
  const m = g.m;
  const stehen = begrenzen(pose.stehen, 0, 1);
  const hocke = begrenzen(pose.hocke, 0, 1);
  const gewicht = begrenzen(pose.gewicht, -1, 1);
  const streck = begrenzen(pose.streck, 0, 1);

  // Pedale: Wer steht, hält sie waagerecht (das nahe Bein vorn) — nur wer
  // sitzt und tritt, lässt die Kurbel kreisen.
  const kurbel = lernWinkel(pose.kurbel, 0, stehen * 0.92);
  const kl = 0.17 * m;
  const kv: P = { x: Math.cos(kurbel) * kl, y: Math.sin(kurbel) * kl };
  const pedalNah = plus(g.tretlager, kv);
  const pedalFern = minus(g.tretlager, kv);

  // Hüfte: im Sattel oder stehend über und hinter dem Tretlager.
  const sitz: P = { x: g.sattel.x - 0.03 * m, y: g.sattel.y - 0.12 * m + hocke * 0.04 * m };
  const steh: P = {
    // Gewicht neutral: Hüfte knapp hinter dem Tretlager, die Arme leicht
    // gebeugt. Ganz hinten (−1) sind die Arme fast gestreckt, ganz vorn (+1)
    // liegt die Brust über dem Lenker — die beiden Enden sind Grenzen der
    // Reichweite, nicht der Optik: Weiter weg kämen die Hände nicht mehr
    // an den Griff.
    x: g.tretlager.x + (-0.1 + 0.2 * gewicht) * m,
    y: g.tretlager.y - (0.97 - 0.26 * hocke + 0.07 * streck) * m,
  };
  const huefte = lernP(sitz, steh, stehen);

  // Rumpf: Gewicht hinten richtet auf, Gewicht vorn legt sich über den Lenker.
  const lehnGrad = lern(50, 58, stehen) + 15 * gewicht - 7 * hocke;
  const lehn = (lehnGrad * Math.PI) / 180;
  const rumpf: P = { x: Math.sin(lehn), y: -Math.cos(lehn) };
  const schulter = plus(huefte, mal(rumpf, LAENGEN.torso * m));

  const kopfWinkel = lehn * 0.62;
  const kopf = plus(schulter, {
    x: Math.sin(kopfWinkel) * 0.27 * m + 0.01 * m,
    y: -Math.cos(kopfWinkel) * 0.27 * m,
  });

  // Füße: Knöchel über und etwas hinter dem Pedal.
  const fuss: P = { x: -0.04 * m, y: -0.1 * m };
  const knoechelNah = plus(pedalNah, fuss);
  const knoechelFern = plus(pedalFern, fuss);

  // Knie zeigen nach vorn — die Lösung mit dem größeren x.
  const knie = (knoechel: P) => {
    const [a, b] = ik(huefte, knoechel, LAENGEN.femur * m, LAENGEN.tibia * m);
    return a.x >= b.x ? a : b;
  };

  // Ellbogen zeigen nach oben und leicht nach außen.
  const hand = g.lenker;
  const ellbogen = (): P => {
    const [a, b] = ik(schulter, hand, LAENGEN.oberarm * m, LAENGEN.unterarm * m);
    return a.y <= b.y ? a : b;
  };
  const eb = ellbogen();

  return {
    huefte,
    schulter,
    kopf,
    lehn,
    knieNah: knie(knoechelNah),
    knieFern: knie(knoechelFern),
    knoechelNah,
    knoechelFern,
    pedalNah,
    pedalFern,
    ellbogenNah: eb,
    ellbogenFern: lernP(eb, plus(eb, { x: -0.02 * m, y: -0.025 * m }), 1),
    hand,
  };
}

// ---------------------------------------------------------------------
// Röhren
// ---------------------------------------------------------------------
type Rohr = {
  umriss: Path2D;
  mitte: P[];
  tang: P[];
  radius: number[];
};

/**
 * Eine Röhre mit wechselndem Querschnitt, als glatte Kurve durch drei Punkte
 * (quadratische Bézierkurve, die den mittleren Punkt bei t = 0,5 durchläuft)
 * oder zwei Punkte (Gerade). `radius(t)` gibt den Halbmesser entlang der
 * Röhre an. Die Enden sind rund.
 */
function roehre(punkte: readonly P[], radius: (t: number) => number, n = 18): Rohr {
  const mitte: P[] = [];
  const tang: P[] = [];
  const rad: number[] = [];
  const a = punkte[0]!;
  const c = punkte[punkte.length - 1]!;
  const b = punkte.length === 3 ? punkte[1]! : null;
  const ctrl = b ? { x: 2 * b.x - (a.x + c.x) / 2, y: 2 * b.y - (a.y + c.y) / 2 } : null;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let p: P;
    let d: P;
    if (ctrl) {
      const u = 1 - t;
      p = {
        x: u * u * a.x + 2 * u * t * ctrl.x + t * t * c.x,
        y: u * u * a.y + 2 * u * t * ctrl.y + t * t * c.y,
      };
      d = {
        x: 2 * u * (ctrl.x - a.x) + 2 * t * (c.x - ctrl.x),
        y: 2 * u * (ctrl.y - a.y) + 2 * t * (c.y - ctrl.y),
      };
    } else {
      p = lernP(a, c, t);
      d = minus(c, a);
    }
    mitte.push(p);
    tang.push(norm(d));
    rad.push(radius(t));
  }
  const links: P[] = [];
  const rechts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = tang[i]!;
    const nrm = { x: -t.y, y: t.x };
    links.push(plus(mitte[i]!, mal(nrm, rad[i]!)));
    rechts.push(minus(mitte[i]!, mal(nrm, rad[i]!)));
  }
  const pfad = new Path2D();
  pfad.moveTo(links[0]!.x, links[0]!.y);
  for (let i = 1; i <= n; i++) pfad.lineTo(links[i]!.x, links[i]!.y);
  // Rundung am Ende.
  const tE = tang[n]!;
  const nE = { x: -tE.y, y: tE.x };
  for (let k = 1; k <= 6; k++) {
    const phi = (Math.PI * k) / 7;
    const p = plus(
      mitte[n]!,
      plus(mal(nE, Math.cos(phi) * rad[n]!), mal(tE, Math.sin(phi) * rad[n]!)),
    );
    pfad.lineTo(p.x, p.y);
  }
  for (let i = n; i >= 0; i--) pfad.lineTo(rechts[i]!.x, rechts[i]!.y);
  const t0 = tang[0]!;
  const n0 = { x: -t0.y, y: t0.x };
  for (let k = 1; k <= 6; k++) {
    const phi = (Math.PI * k) / 7;
    const p = minus(
      mitte[0]!,
      plus(mal(n0, Math.cos(phi) * rad[0]!), mal(t0, Math.sin(phi) * rad[0]!)),
    );
    pfad.lineTo(p.x, p.y);
  }
  pfad.closePath();
  return { umriss: pfad, mitte, tang, radius: rad };
}

/** Der Lichtvektor quer zur Röhre an Stelle `i` — der Teil des Lichts, der am Querschnitt ankommt. */
function lichtQuer(r: Rohr, i: number): P {
  const t = r.tang[i]!;
  const dot = LICHT_X * t.x + LICHT_Y * t.y;
  const v = { x: LICHT_X - dot * t.x, y: LICHT_Y - dot * t.y };
  const l = laenge(v);
  return l < 0.2 ? { x: -t.y * LICHT_X + t.x * LICHT_Y, y: 0 } : mal(v, 1 / l);
}

/** Ein Band längs der Röhre, zur Lichtseite (`seite` > 0) oder davon weg (< 0) versetzt. */
function band(
  ctx: CanvasRenderingContext2D,
  r: Rohr,
  seite: number,
  breite: number,
  farbe: string,
  von = 0,
  bis = 1,
) {
  ctx.beginPath();
  const n = r.mitte.length - 1;
  let erster = true;
  for (let i = Math.round(von * n); i <= Math.round(bis * n); i++) {
    const l = lichtQuer(r, i);
    const p = plus(r.mitte[i]!, mal(l, seite * r.radius[i]!));
    if (erster) {
      ctx.moveTo(p.x, p.y);
      erster = false;
    } else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = farbe;
  ctx.lineWidth = Math.max(0.8, breite);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/**
 * Füllt eine Röhre als Körper: Verlauf, Licht- und Schattenband, Kontur.
 * `kontur` gibt die Strichstärke in Bildpunkten an (0 = keine).
 */
function rohrFuellen(
  ctx: CanvasRenderingContext2D,
  r: Rohr,
  farbe: string,
  opt: { kontur?: number; dunkler?: number; glanz?: number } = {},
) {
  const dunkler = opt.dunkler ?? 0;
  const glanz = opt.glanz ?? 1;
  const mx = r.mitte[Math.floor(r.mitte.length / 2)]!;
  const rmax = Math.max(...r.radius);
  ctx.save();
  const gr = ctx.createLinearGradient(
    mx.x + LICHT_X * rmax,
    mx.y + LICHT_Y * rmax,
    mx.x - LICHT_X * rmax,
    mx.y - LICHT_Y * rmax,
  );
  gr.addColorStop(0, mischen(farbe, '#ffffff', 0.2 * glanz));
  gr.addColorStop(0.5, farbe);
  gr.addColorStop(1, mischen(farbe, '#000000', 0.42));
  ctx.fillStyle = gr;
  ctx.fill(r.umriss);
  ctx.clip(r.umriss);
  band(ctx, r, 0.55, rmax * 0.3, `rgba(255,255,255,${0.16 * glanz})`);
  band(ctx, r, -0.78, rmax * 0.55, 'rgba(0,0,0,0.26)');
  if (dunkler > 0) {
    // Die ferne Körperhälfte liegt im Schatten des Rades und des Rumpfes.
    ctx.globalAlpha = dunkler;
    ctx.fillStyle = '#000';
    ctx.fill(r.umriss);
  }
  ctx.restore();
  if ((opt.kontur ?? 1) > 0) {
    ctx.strokeStyle = F.kontur;
    ctx.lineWidth = opt.kontur ?? 1;
    ctx.lineJoin = 'round';
    ctx.stroke(r.umriss);
  }
}

/** Zeichnet eine glatte, geschlossene Kurve durch Punkte (über die Mittelpunkte der Kanten). */
function glattPfad(punkte: readonly P[]): Path2D {
  const pfad = new Path2D();
  const n = punkte.length;
  const mitte = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mitte(punkte[n - 1]!, punkte[0]!);
  pfad.moveTo(start.x, start.y);
  for (let i = 0; i < n; i++) {
    const p = punkte[i]!;
    const q = mitte(p, punkte[(i + 1) % n]!);
    pfad.quadraticCurveTo(p.x, p.y, q.x, q.y);
  }
  pfad.closePath();
  return pfad;
}

/** Füllt einen Pfad mit Verlauf, Kontur und optionalem Detail im Zuschnitt. */
function formFuellen(
  ctx: CanvasRenderingContext2D,
  pfad: Path2D,
  mitte: P,
  radius: number,
  farbe: string,
  opt: { kontur?: number; detail?: () => void } = {},
) {
  ctx.save();
  const gr = ctx.createLinearGradient(
    mitte.x + LICHT_X * radius,
    mitte.y + LICHT_Y * radius,
    mitte.x - LICHT_X * radius,
    mitte.y - LICHT_Y * radius,
  );
  gr.addColorStop(0, mischen(farbe, '#ffffff', 0.22));
  gr.addColorStop(0.5, farbe);
  gr.addColorStop(1, mischen(farbe, '#000000', 0.4));
  ctx.fillStyle = gr;
  ctx.fill(pfad);
  ctx.clip(pfad);
  opt.detail?.();
  ctx.restore();
  if ((opt.kontur ?? 1) > 0) {
    ctx.strokeStyle = F.kontur;
    ctx.lineWidth = opt.kontur ?? 1;
    ctx.lineJoin = 'round';
    ctx.stroke(pfad);
  }
}

// ---------------------------------------------------------------------
// Bein
// ---------------------------------------------------------------------
function schuh(
  ctx: CanvasRenderingContext2D,
  g: FahrerGeo,
  knoechel: P,
  fern: boolean,
) {
  const m = g.m;
  const k = Math.max(1, m * 0.011);
  ctx.save();
  ctx.translate(knoechel.x, knoechel.y);
  // Zehen leicht nach oben, Ferse unten — wie auf einem Flatpedal.
  ctx.rotate(-0.08);
  const u = (x: number, y: number): P => ({ x: x * m, y: y * m });
  // Obermaterial: vom Knöchel zur Spitze.
  const oberteil = glattPfad([
    u(-0.075, -0.05),
    u(0.02, -0.075),
    u(0.1, -0.03),
    u(0.2, 0.012),
    u(0.235, 0.075),
    u(0.2, 0.11),
    u(0.02, 0.115),
    u(-0.08, 0.1),
    u(-0.095, 0.03),
  ]);
  formFuellen(ctx, oberteil, u(0.06, 0.03), 0.16 * m, fern ? mischen(F.schuh, '#000000', 0.25) : F.schuh, {
    kontur: k,
    detail: () => {
      // Schnürsenkelstreifen und roter Akzent an der Ferse.
      ctx.strokeStyle = 'rgba(30,34,44,0.55)';
      ctx.lineWidth = Math.max(0.8, m * 0.012);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo((0.0 + i * 0.045) * m, -0.07 * m);
        ctx.lineTo((0.03 + i * 0.045) * m, -0.012 * m);
        ctx.stroke();
      }
      ctx.fillStyle = F.rot;
      ctx.fillRect(-0.1 * m, 0.0, 0.05 * m, 0.1 * m);
    },
  });
  // Sohle.
  const sohle = glattPfad([u(-0.1, 0.1), u(0.0, 0.132), u(0.2, 0.135), u(0.245, 0.11), u(0.235, 0.085), u(0.0, 0.1)]);
  ctx.fillStyle = fern ? '#0d0f14' : F.schuhDunkel;
  ctx.fill(sohle);
  ctx.strokeStyle = F.kontur;
  ctx.lineWidth = k * 0.8;
  ctx.stroke(sohle);
  ctx.restore();
}

function bein(
  ctx: CanvasRenderingContext2D,
  g: FahrerGeo,
  s: Skelett,
  pose: FahrerPose,
  fern: boolean,
) {
  const m = g.m;
  const huefte = s.huefte;
  const knie = fern ? s.knieFern : s.knieNah;
  const knoechel = fern ? s.knoechelFern : s.knoechelNah;
  const dunkel = fern ? 0.3 : 0;
  const k = Math.max(1, m * 0.011);

  // --- Wade und Schienbein (Socke) ---
  const unter = roehre(
    [knie, lernP(knie, knoechel, 0.5), knoechel],
    (t) => (0.07 - 0.028 * t + Math.sin(t * Math.PI) * 0.012) * m,
    14,
  );
  rohrFuellen(ctx, unter, F.socke, { kontur: k, dunkler: dunkel });
  // Farbband an der Socke.
  const bandPunkt = lernP(knie, knoechel, 0.62);
  ctx.save();
  ctx.clip(unter.umriss);
  ctx.strokeStyle = F.teal;
  ctx.lineWidth = Math.max(1, m * 0.03);
  const nq = norm({ x: -(knoechel.y - knie.y), y: knoechel.x - knie.x });
  ctx.beginPath();
  ctx.moveTo(bandPunkt.x + nq.x * m * 0.12, bandPunkt.y + nq.y * m * 0.12);
  ctx.lineTo(bandPunkt.x - nq.x * m * 0.12, bandPunkt.y - nq.y * m * 0.12);
  ctx.stroke();
  ctx.restore();

  // --- Schuh ---
  schuh(ctx, g, knoechel, fern);

  // --- Knieschoner: Kappe über dem Knie, Schiene am Schienbein ---
  const oberRicht = norm(minus(huefte, knie));
  const unterRicht = norm(minus(knoechel, knie));
  const schoner = roehre(
    [plus(knie, mal(oberRicht, 0.07 * m)), knie, plus(knie, mal(unterRicht, 0.15 * m))],
    (t) => (0.082 + Math.sin(t * Math.PI) * 0.01) * m,
    12,
  );
  rohrFuellen(ctx, schoner, F.schoner, { kontur: k, dunkler: dunkel * 0.7 });
  // Harte Kappe auf dem Knie: ein helleres Oval auf der Lichtseite.
  ctx.save();
  ctx.clip(schoner.umriss);
  ctx.fillStyle = `rgba(120,132,156,${fern ? 0.22 : 0.4})`;
  ctx.beginPath();
  ctx.ellipse(knie.x + 0.01 * m, knie.y - 0.015 * m, 0.058 * m, 0.045 * m, Math.atan2(unterRicht.y, unterRicht.x), 0, Math.PI * 2);
  ctx.fill();
  // Klettband am Schoner.
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = Math.max(1, m * 0.018);
  const bp = lernP(knie, knoechel, 0.16);
  const bn = norm({ x: -(knoechel.y - knie.y), y: knoechel.x - knie.x });
  ctx.beginPath();
  ctx.moveTo(bp.x + bn.x * 0.11 * m, bp.y + bn.y * 0.11 * m);
  ctx.lineTo(bp.x - bn.x * 0.11 * m, bp.y - bn.y * 0.11 * m);
  ctx.stroke();
  ctx.restore();

  // --- Oberschenkel in der Hose: weit, mit flatterndem Saum ---
  const flatter = Math.sin(pose.zeit * 19 + (fern ? 1.7 : 0)) * pose.wind;
  const saumEnde = lernP(huefte, knie, 0.8);
  const hosenEnde = plus(saumEnde, { x: -pose.wind * 0.02 * m, y: -pose.wind * 0.012 * m * flatter });
  const hose = roehre(
    [huefte, lernP(huefte, hosenEnde, 0.5), hosenEnde],
    (t) => (0.108 + 0.03 * t + Math.sin(t * Math.PI) * 0.006) * m,
    14,
  );
  rohrFuellen(ctx, hose, fern ? mischen(F.hose, '#000000', 0.15) : F.hose, { kontur: k, dunkler: dunkel });
  // Falten und Nähte: zwei kurze Schattenstriche, dazu der Akzentstreifen.
  ctx.save();
  ctx.clip(hose.umriss);
  band(ctx, hose, 0.15, m * 0.012, F.teal, 0.1, 0.78);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = Math.max(0.8, m * 0.012);
  for (const t of [0.35, 0.6]) {
    const i = Math.round(t * (hose.mitte.length - 1));
    const p = hose.mitte[i]!;
    const nn = { x: -hose.tang[i]!.y, y: hose.tang[i]!.x };
    ctx.beginPath();
    ctx.moveTo(p.x + nn.x * hose.radius[i]! * 0.95, p.y + nn.y * hose.radius[i]! * 0.95);
    ctx.quadraticCurveTo(p.x, p.y + 0.02 * m, p.x - nn.x * hose.radius[i]! * 0.5, p.y - nn.y * hose.radius[i]! * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------
// Arm
// ---------------------------------------------------------------------
function arm(
  ctx: CanvasRenderingContext2D,
  g: FahrerGeo,
  s: Skelett,
  fern: boolean,
) {
  const m = g.m;
  const k = Math.max(1, m * 0.01);
  const schulter = fern ? plus(s.schulter, { x: -0.015 * m, y: 0.01 * m }) : s.schulter;
  const ellbogen = fern ? s.ellbogenFern : s.ellbogenNah;
  const hand = fern ? (s.handFern ?? plus(s.hand, { x: -0.012 * m, y: -0.01 * m })) : s.hand;
  const dunkel = fern ? 0.3 : 0;

  // Handgelenk: kurz vor dem Griff.
  const unterRicht = norm(minus(hand, ellbogen));
  const gelenk = minus(hand, mal(unterRicht, 0.05 * m));

  const aermel = roehre(
    [schulter, ellbogen, gelenk],
    (t) => (0.06 - 0.018 * t + Math.sin(t * Math.PI) * 0.008) * m,
    16,
  );
  rohrFuellen(ctx, aermel, F.trikot, { kontur: k, dunkler: dunkel });
  // Ärmelbündchen und Streifen.
  ctx.save();
  ctx.clip(aermel.umriss);
  const bp = lernP(ellbogen, gelenk, 0.72);
  const bn = norm({ x: -(gelenk.y - ellbogen.y), y: gelenk.x - ellbogen.x });
  ctx.fillStyle = F.weiss;
  ctx.globalAlpha = fern ? 0.7 : 1;
  ctx.beginPath();
  ctx.moveTo(bp.x + bn.x * 0.1 * m, bp.y + bn.y * 0.1 * m);
  ctx.lineTo(bp.x - bn.x * 0.1 * m, bp.y - bn.y * 0.1 * m);
  ctx.lineWidth = Math.max(1, m * 0.025);
  ctx.strokeStyle = F.weiss;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Ellbogenschoner: kleiner, dunkler, am Gelenk.
  const oben = norm(minus(schulter, ellbogen));
  const unten = norm(minus(gelenk, ellbogen));
  const schoner = roehre(
    [plus(ellbogen, mal(oben, 0.05 * m)), ellbogen, plus(ellbogen, mal(unten, 0.075 * m))],
    () => 0.058 * m,
    8,
  );
  rohrFuellen(ctx, schoner, F.schoner, { kontur: k, dunkler: dunkel * 0.6 });

  // --- Handschuh um den Griff ---
  ctx.save();
  const r = Math.atan2(unterRicht.y, unterRicht.x);
  ctx.translate(hand.x, hand.y);
  ctx.rotate(r);
  // Stulpe
  const stulpe = glattPfad([
    { x: -0.085 * m, y: -0.05 * m },
    { x: -0.01 * m, y: -0.056 * m },
    { x: -0.01 * m, y: 0.056 * m },
    { x: -0.085 * m, y: 0.05 * m },
  ]);
  formFuellen(ctx, stulpe, { x: -0.04 * m, y: 0 }, 0.07 * m, fern ? F.rotDunkel : F.rot, { kontur: k });
  // Faust: Handrücken plus vier Finger, die sich um den Griff legen.
  const hand2 = glattPfad([
    { x: -0.02 * m, y: -0.056 * m },
    { x: 0.035 * m, y: -0.068 * m },
    { x: 0.075 * m, y: -0.04 * m },
    { x: 0.082 * m, y: 0.01 * m },
    { x: 0.055 * m, y: 0.062 * m },
    { x: -0.01 * m, y: 0.058 * m },
  ]);
  formFuellen(ctx, hand2, { x: 0.03 * m, y: 0 }, 0.09 * m, fern ? '#5a1a14' : '#33383f', {
    kontur: k,
    detail: () => {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = Math.max(0.8, m * 0.009);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0.04 * m, (-0.035 + i * 0.03) * m);
        ctx.lineTo(0.078 * m, (-0.03 + i * 0.03) * m);
        ctx.stroke();
      }
    },
  });
  ctx.restore();
}

// ---------------------------------------------------------------------
// Rumpf, Kopf
// ---------------------------------------------------------------------
function rumpf(
  ctx: CanvasRenderingContext2D,
  g: FahrerGeo,
  s: Skelett,
  pose: FahrerPose,
) {
  const m = g.m;
  const k = Math.max(1, m * 0.011);
  const d: P = { x: Math.sin(s.lehn), y: -Math.cos(s.lehn) };
  const nv: P = { x: Math.cos(s.lehn), y: Math.sin(s.lehn) };
  const L = LAENGEN.torso * m;
  /** (u, v): u entlang der Wirbelsäule von der Hüfte (0) zur Schulter (1), v zur Brust (+) bzw. zum Rücken (−). */
  const pt = (u: number, v: number): P => plus(plus(s.huefte, mal(d, u * L)), mal(nv, v * m));

  // --- Rucksack (Trinksystem): hinter dem Rücken, nur der Teil, der übersteht ---
  const pack = glattPfad([pt(0.2, -0.12), pt(0.3, -0.21), pt(0.62, -0.24), pt(0.86, -0.2), pt(0.9, -0.14), pt(0.6, -0.12)]);
  formFuellen(ctx, pack, pt(0.55, -0.24), 0.3 * m, F.rucksack, {
    kontur: k,
    detail: () => {
      ctx.strokeStyle = F.teal;
      ctx.lineWidth = Math.max(1, m * 0.016);
      ctx.beginPath();
      const a = pt(0.3, -0.27);
      const b = pt(0.82, -0.255);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    },
  });

  // --- Trikot: Hüfte bis Schulter, Rückenwölbung, eingezogene Taille ---
  const flatter = Math.sin(pose.zeit * 17) * pose.wind;
  const saum = plus(
    pt(0.0, -0.14),
    { x: -pose.wind * 0.1 * m, y: pose.wind * 0.03 * m * (0.6 + 0.4 * flatter) },
  );
  const trikot = glattPfad([
    saum,
    pt(0.22, -0.12),
    pt(0.5, -0.14),
    pt(0.8, -0.155),
    pt(1.02, -0.1),
    pt(1.09, 0.02),
    pt(1.02, 0.1),
    pt(0.8, 0.135),
    pt(0.42, 0.115),
    pt(0.12, 0.11),
    pt(-0.03, 0.095),
  ]);
  formFuellen(ctx, trikot, pt(0.55, 0), 0.3 * m, F.trikot, {
    kontur: k,
    detail: () => {
      // Weißer Streifen quer über die Brust und dunkle Falten am Bauch.
      ctx.strokeStyle = F.weiss;
      ctx.lineWidth = Math.max(1.2, m * 0.05);
      ctx.beginPath();
      const a = pt(0.58, -0.2);
      const b = pt(0.5, 0.2);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = Math.max(0.8, m * 0.013);
      for (const [u, v0, v1] of [
        [0.25, 0.14, 0.02],
        [0.38, 0.15, -0.02],
        [0.2, -0.14, -0.04],
      ] as const) {
        const p0 = pt(u, v0);
        const p1 = pt(u + 0.06, v1);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(pt(u + 0.02, (v0 + v1) / 2 + 0.03).x, pt(u + 0.02, (v0 + v1) / 2 + 0.03).y, p1.x, p1.y);
        ctx.stroke();
      }
      // Rückenschatten: Der Rucksack wirft ihn aufs Trikot.
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.beginPath();
      const q = [pt(0.2, -0.16), pt(0.4, -0.2), pt(0.8, -0.21), pt(0.8, -0.1), pt(0.4, -0.09)];
      ctx.moveTo(q[0]!.x, q[0]!.y);
      for (const p of q.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill();
    },
  });

  // Rückenseitiger Gurt vom Rucksack über die Schulter.
  ctx.strokeStyle = '#11141b';
  ctx.lineWidth = Math.max(1, m * 0.022);
  ctx.lineCap = 'round';
  ctx.beginPath();
  const g1 = pt(0.8, -0.17);
  const g2 = pt(0.92, 0.0);
  const g3 = pt(0.44, 0.115);
  ctx.moveTo(g1.x, g1.y);
  ctx.quadraticCurveTo(g2.x, g2.y, g3.x, g3.y);
  ctx.stroke();
}

function kopfUndHelm(
  ctx: CanvasRenderingContext2D,
  g: FahrerGeo,
  s: Skelett,
  pose: FahrerPose,
) {
  const m = g.m;
  const k = Math.max(1, m * 0.01);

  // --- Hals ---
  const halsOben = plus(s.kopf, { x: -0.03 * m, y: 0.11 * m });
  const halsUnten = plus(s.schulter, { x: -0.01 * m, y: 0.015 * m });
  const hals = roehre([halsUnten, halsOben], () => 0.058 * m, 6);
  rohrFuellen(ctx, hals, F.haut, { kontur: k });
  // Kragen
  ctx.fillStyle = F.trikotDunkel;
  ctx.beginPath();
  ctx.ellipse(halsUnten.x, halsUnten.y, 0.075 * m, 0.045 * m, s.lehn, 0, Math.PI * 2);
  ctx.fill();

  // --- Helm ---
  const hr = 0.2 * m;
  ctx.save();
  ctx.translate(s.kopf.x, s.kopf.y);
  // Der Blick geht die Strecke hinunter: Kopf leicht nach vorn-unten geneigt,
  // bei Gewicht vorn etwas mehr, bei Gewicht hinten hebt er sich.
  ctx.rotate(0.16 + 0.14 * pose.gewicht - 0.1 * pose.streck);
  const u = (x: number, y: number): P => ({ x: x * hr, y: y * hr });

  /*
   * **Ein Fullface-Helm ist eine einzige Form**, kein Dom mit angeklebtem
   * Kinn. Die erste Fassung setzte Schale und Kinnbügel getrennt, und der
   * Bügel sah aus wie eine Blase vor dem Gesicht. Hier läuft die Silhouette
   * in einem Zug: Nacken, Scheitel, Stirn, Wange, Kinn, Kiefer. Die
   * Sichtöffnung für die Brille und das Gesicht sind danach hineingesetzt.
   */
  const helm = glattPfad([
    u(-1.0, 0.52),
    u(-1.13, 0.02),
    u(-0.96, -0.58),
    u(-0.42, -0.98),
    u(0.25, -1.05),
    u(0.82, -0.86),
    u(1.1, -0.46),
    u(1.14, -0.12),
    u(1.1, 0.28),
    u(1.28, 0.5),
    u(1.2, 0.84),
    u(0.74, 0.92),
    u(0.06, 0.64),
    u(-0.5, 0.72),
  ]);
  formFuellen(ctx, helm, u(-0.1, -0.45), 1.3 * hr, F.helm, {
    kontur: k,
    detail: () => {
      // Das Gesicht in der Sichtöffnung: Haut mit Schatten zum Helm hin, eine
      // kleine Nase und die Mundlinie. Bei vierzig Bildpunkten Kopfgröße ist es
      // ein heller Fleck — im Titelbild ist es das, was den Helm bewohnt wirken lässt.
      const gesicht = ctx.createLinearGradient(u(0.3, -0.1).x, u(0.3, -0.1).y, u(1.1, 0.3).x, u(1.1, 0.3).y);
      gesicht.addColorStop(0, F.hautDunkel);
      gesicht.addColorStop(0.45, F.haut);
      gesicht.addColorStop(1, mischen(F.haut, '#ffffff', 0.15));
      ctx.fillStyle = gesicht;
      ctx.beginPath();
      const f1 = u(0.3, -0.18);
      ctx.moveTo(f1.x, f1.y);
      ctx.quadraticCurveTo(u(1.0, -0.22).x, u(1.0, -0.22).y, u(1.04, 0.1).x, u(1.04, 0.1).y);
      ctx.quadraticCurveTo(u(1.0, 0.36).x, u(1.0, 0.36).y, u(0.5, 0.4).x, u(0.5, 0.4).y);
      ctx.quadraticCurveTo(u(0.2, 0.3).x, u(0.2, 0.3).y, f1.x, f1.y);
      ctx.fill();
      // Nase.
      ctx.fillStyle = mischen(F.haut, '#000000', 0.12);
      ctx.beginPath();
      ctx.moveTo(u(1.0, 0.06).x, u(1.0, 0.06).y);
      ctx.quadraticCurveTo(u(1.22, 0.14).x, u(1.22, 0.14).y, u(1.02, 0.22).x, u(1.02, 0.22).y);
      ctx.closePath();
      ctx.fill();
      // Mund.
      ctx.strokeStyle = 'rgba(110,50,40,0.75)';
      ctx.lineWidth = Math.max(0.8, hr * 0.045);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(u(0.78, 0.32).x, u(0.78, 0.32).y);
      ctx.quadraticCurveTo(u(0.92, 0.35).x, u(0.92, 0.35).y, u(1.0, 0.31).x, u(1.0, 0.31).y);
      ctx.stroke();
      // Streifen über den Scheitel: Rot und Türkis.
      ctx.fillStyle = F.rot;
      ctx.beginPath();
      ctx.moveTo(u(-0.78, -0.7).x, u(-0.78, -0.7).y);
      ctx.quadraticCurveTo(u(0.1, -1.2).x, u(0.1, -1.2).y, u(1.0, -0.58).x, u(1.0, -0.58).y);
      ctx.lineTo(u(0.97, -0.42).x, u(0.97, -0.42).y);
      ctx.quadraticCurveTo(u(0.1, -0.98).x, u(0.1, -0.98).y, u(-0.84, -0.5).x, u(-0.84, -0.5).y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = F.teal;
      ctx.beginPath();
      ctx.moveTo(u(-0.84, -0.48).x, u(-0.84, -0.48).y);
      ctx.quadraticCurveTo(u(0.1, -0.96).x, u(0.1, -0.96).y, u(0.97, -0.4).x, u(0.97, -0.4).y);
      ctx.lineTo(u(0.96, -0.34).x, u(0.96, -0.34).y);
      ctx.quadraticCurveTo(u(0.1, -0.88).x, u(0.1, -0.88).y, u(-0.86, -0.4).x, u(-0.86, -0.4).y);
      ctx.closePath();
      ctx.fill();
      // Lüftung: drei schräge Schlitze über dem Ohr.
      ctx.fillStyle = 'rgba(15,20,30,0.8)';
      for (let i = 0; i < 3; i++) {
        const a = u(-0.72 + i * 0.26, -0.34 + i * 0.05);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + 0.17 * hr, a.y - 0.03 * hr);
        ctx.lineTo(a.x + 0.2 * hr, a.y + 0.07 * hr);
        ctx.lineTo(a.x + 0.03 * hr, a.y + 0.11 * hr);
        ctx.closePath();
        ctx.fill();
      }
      // Kinnbügel: ein einzelner dunkler Schlitz vorn und ein roter Rand unten.
      // Mehrere kleine Löcher lasen sich als Gebiss.
      ctx.fillStyle = 'rgba(15,20,30,0.85)';
      ctx.beginPath();
      ctx.ellipse(u(1.12, 0.62).x, u(1.12, 0.62).y, 0.05 * hr, 0.14 * hr, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = F.rot;
      ctx.lineWidth = Math.max(1, hr * 0.07);
      ctx.beginPath();
      ctx.moveTo(u(0.15, 0.7).x, u(0.15, 0.7).y);
      ctx.quadraticCurveTo(u(0.8, 0.98).x, u(0.8, 0.98).y, u(1.22, 0.76).x, u(1.22, 0.76).y);
      ctx.stroke();
      // Glanzfleck oben links.
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(u(-0.3, -0.78).x, u(-0.3, -0.78).y, 0.34 * hr, 0.13 * hr, -0.5, 0, Math.PI * 2);
      ctx.fill();
    },
  });

  // Schirm: sitzt auf der Stirn und zeigt nach vorn-oben.
  const schirm = glattPfad([u(0.5, -0.9), u(1.05, -0.8), u(1.66, -0.62), u(1.64, -0.52), u(1.0, -0.62), u(0.5, -0.66)]);
  formFuellen(ctx, schirm, u(1.0, -0.68), 0.7 * hr, F.rot, { kontur: k * 0.9 });

  // Brille: Band um den Helm, Rahmen, verspiegeltes Glas.
  const band = glattPfad([u(-1.1, -0.2), u(-0.4, -0.38), u(0.4, -0.4), u(0.5, -0.2), u(-0.4, -0.12), u(-1.1, 0.04)]);
  ctx.fillStyle = F.brille;
  ctx.fill(band);
  const rahmen = glattPfad([u(0.28, -0.46), u(0.98, -0.4), u(1.17, -0.08), u(1.1, 0.14), u(0.4, 0.12), u(0.24, -0.16)]);
  ctx.fillStyle = F.brille;
  ctx.fill(rahmen);
  const glas = glattPfad([u(0.38, -0.38), u(0.96, -0.32), u(1.08, -0.08), u(1.02, 0.07), u(0.46, 0.05), u(0.34, -0.15)]);
  const lg = ctx.createLinearGradient(u(0.4, -0.4).x, u(0.4, -0.4).y, u(1.0, 0.08).x, u(1.0, 0.08).y);
  lg.addColorStop(0, F.linseHell);
  lg.addColorStop(0.55, '#3bb5c9');
  lg.addColorStop(1, F.linseDunkel);
  ctx.fillStyle = lg;
  ctx.fill(glas);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(u(0.5, -0.34).x, u(0.5, -0.34).y);
  ctx.lineTo(u(0.76, -0.31).x, u(0.76, -0.31).y);
  ctx.lineTo(u(0.6, 0.02).x, u(0.6, 0.02).y);
  ctx.lineTo(u(0.48, 0.0).x, u(0.48, 0.0).y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = F.kontur;
  ctx.lineWidth = k * 0.8;
  ctx.stroke(rahmen);

  // Kinnriemen
  ctx.strokeStyle = 'rgba(12,14,20,0.9)';
  ctx.lineWidth = Math.max(1, hr * 0.06);
  ctx.beginPath();
  ctx.moveTo(u(-0.1, 0.4).x, u(-0.1, 0.4).y);
  ctx.quadraticCurveTo(u(0.1, 0.82).x, u(0.1, 0.82).y, u(0.5, 0.85).x, u(0.5, 0.85).y);
  ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------
// Aufrufe von außen
// ---------------------------------------------------------------------

/** Was hinter dem Rahmen liegt: fernes Bein samt Pedal, ferner Arm. */
export function fahrerHinten(ctx: CanvasRenderingContext2D, g: FahrerGeo, s: Skelett, pose: FahrerPose) {
  const m = g.m;
  // Ferne Kurbel und Pedal.
  ctx.strokeStyle = '#262a31';
  ctx.lineWidth = Math.max(1.5, 0.045 * m);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(g.tretlager.x, g.tretlager.y);
  ctx.lineTo(s.pedalFern.x, s.pedalFern.y);
  ctx.stroke();
  ctx.fillStyle = '#16181d';
  ctx.fillRect(s.pedalFern.x - 0.055 * m, s.pedalFern.y - 0.016 * m, 0.11 * m, 0.032 * m);
  bein(ctx, g, s, pose, true);
  arm(ctx, g, s, true);
}

/** Alles, was vor dem Rahmen liegt: nahes Bein, Rumpf, Kopf, naher Arm. */
export function fahrerVorn(ctx: CanvasRenderingContext2D, g: FahrerGeo, s: Skelett, pose: FahrerPose) {
  bein(ctx, g, s, pose, false);
  rumpf(ctx, g, s, pose);
  kopfUndHelm(ctx, g, s, pose);
  arm(ctx, g, s, false);
}

/**
 * Der gestürzte Fahrer: ein schlaffer Körper statt der Haltung auf dem Rad.
 *
 * Wer vom Rad fliegt, hat keine Haltung mehr — Arme und Beine schlagen, der
 * Kopf kippt, und sobald er liegt, fallen sie zur Ruhe. `schlaff` (0 = in der
 * Luft, 1 = liegt) blendet das Schlagen aus. Es gibt **keine zweite
 * Zeichnung**: Dieselben Röhren, derselbe Helm, dieselbe Kleidung wie auf dem
 * Rad, nur mit Gelenken, die frei hängen. Dadurch bleibt es dieselbe Figur —
 * ein Fahrer, der im Sturz plötzlich anders aussähe, wäre ein Bruch.
 *
 * Der Aufrufer hat `ctx` schon in die Hüfte verschoben, gedreht und skaliert;
 * hier ist die Hüfte der Nullpunkt und y zeigt nach unten.
 */
export function fahrerSturz(ctx: CanvasRenderingContext2D, m: number, zeit: number, schlaff: number) {
  const g: FahrerGeo = { m, tretlager: { x: 0, y: 0 }, sattel: { x: 0, y: 0 }, lenker: { x: 0, y: 0 } };
  const a = 1 - 0.85 * begrenzen(schlaff, 0, 1);
  const w = 8.5;
  const huefte: P = { x: 0, y: 0 };
  const lehn = 0.12 - 0.2 * schlaff + 0.1 * Math.sin(zeit * 5) * a;
  const schulter = plus(huefte, { x: Math.sin(lehn) * LAENGEN.torso * m, y: -Math.cos(lehn) * LAENGEN.torso * m });
  const kw = lehn * 0.5 - 0.35 * a * (0.5 + 0.5 * Math.sin(zeit * 6));
  const kopf = plus(schulter, { x: Math.sin(kw) * 0.27 * m + 0.01 * m, y: -Math.cos(kw) * 0.27 * m });

  /** Ein Glied in Richtung `winkel` (0 = nach unten, positiv = nach vorn). */
  const glied = (von: P, laengeM: number, winkel: number): P => ({
    x: von.x + Math.sin(winkel) * laengeM * m,
    y: von.y + Math.cos(winkel) * laengeM * m,
  });
  const beinNah = (() => {
    const a1 = 0.55 + 0.4 * Math.sin(zeit * w) * a - 0.25 * schlaff;
    const knie = glied(huefte, LAENGEN.femur, a1);
    return { knie, knoechel: glied(knie, LAENGEN.tibia, a1 - 1.0 - 0.35 * Math.sin(zeit * w + 1) * a) };
  })();
  const beinFern = (() => {
    const a1 = 0.15 + 0.4 * Math.sin(zeit * w + 2.4) * a - 0.1 * schlaff;
    const knie = glied(huefte, LAENGEN.femur, a1);
    return { knie, knoechel: glied(knie, LAENGEN.tibia, a1 - 0.7 - 0.35 * Math.sin(zeit * w + 3.1) * a) };
  })();
  /** Arme: von der Schulter nach oben-vorn, Winkel von der Senkrechten nach oben. */
  const armGlied = (von: P, laengeM: number, winkel: number): P => ({
    x: von.x + Math.sin(winkel) * laengeM * m,
    y: von.y - Math.cos(winkel) * laengeM * m,
  });
  const armNah = (() => {
    const b1 = 1.0 + 0.55 * Math.sin(zeit * 7.4) * a + 0.9 * schlaff;
    const ellbogen = armGlied(schulter, LAENGEN.oberarm, b1);
    return { ellbogen, hand: armGlied(ellbogen, LAENGEN.unterarm, b1 + 0.55 + 0.4 * Math.sin(zeit * 7.4 + 1) * a) };
  })();
  const armFern = (() => {
    const b1 = 0.7 + 0.55 * Math.sin(zeit * 7.4 + 2.2) * a + 1.1 * schlaff;
    const ellbogen = armGlied(schulter, LAENGEN.oberarm, b1);
    return { ellbogen, hand: armGlied(ellbogen, LAENGEN.unterarm, b1 + 0.5 + 0.4 * Math.sin(zeit * 7.4 + 3) * a) };
  })();

  const s: Skelett = {
    huefte,
    schulter,
    kopf,
    lehn,
    knieNah: beinNah.knie,
    knieFern: beinFern.knie,
    knoechelNah: beinNah.knoechel,
    knoechelFern: beinFern.knoechel,
    pedalNah: beinNah.knoechel,
    pedalFern: beinFern.knoechel,
    ellbogenNah: armNah.ellbogen,
    ellbogenFern: armFern.ellbogen,
    hand: armNah.hand,
    handFern: armFern.hand,
  };
  const pose: FahrerPose = { stehen: 1, hocke: 0, gewicht: 0, streck: 0, kurbel: 0, wind: 0.8 * a, zeit };
  bein(ctx, g, s, pose, true);
  arm(ctx, g, s, true);
  bein(ctx, g, s, pose, false);
  rumpf(ctx, g, s, pose);
  kopfUndHelm(ctx, g, s, pose);
  arm(ctx, g, s, false);
}
