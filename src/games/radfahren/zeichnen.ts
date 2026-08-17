import { ANLAUF, bodenHoehe, bodenSteigung } from './logik';
import type { Landung, Lauf } from './logik';

/**
 * Flow MTB — die Darstellung. **Enthält keine einzige Spielregel.**
 *
 * Sie bekommt einen `Lauf` gereicht und zeichnet ihn. Alles Rechnende
 * steht in `logik.ts` und ist ohne Browser geprüft — dieselbe Trennung wie
 * bei Dash City (`szene.ts`), und aus demselben Grund: Läge die Physik im
 * Zeichencode, wäre sie der Prüfung entzogen.
 *
 * **Warum Canvas und nicht SVG.** Alle anderen Spiele hier zeichnen SVG,
 * und für Raster und Karten ist das richtig. Ein durchgehendes Gelände ist
 * es nicht: Der Geländeumriss allein sind mehrere hundert Punkte, die sich
 * in **jedem** Bild ändern. Als SVG hieße das, sechzigmal je Sekunde einen
 * mehrere Kilobyte langen Pfad-String zu bauen und den DOM-Knoten
 * auszutauschen. `CLAUDE.md` sieht für Spiele mit fortlaufender Bewegung
 * ohnehin Canvas vor — dies ist das erste, das es wirklich braucht.
 *
 * Was hier eigenen Zustand hat und **nicht** in `logik.ts` gehört: die
 * Federung, die Raddrehung, der Staub und die Kamera. Das ist alles reine
 * Optik — es beeinflusst nichts, was über Sieg oder Niederlage entscheidet,
 * und hätte in der geprüften Logik nichts zu suchen.
 */

export type Zeichner = {
  zeichnen: (lauf: Lauf, dt: number) => void;
  groesseAendern: (breite: number, hoehe: number) => void;
};

/*
 * Die Farben.
 *
 * Das Bike war zuerst schwarz — Rückmeldung: „Das Fahrrad ist ein
 * kompletter Reinfall, das ist ein Fahrrad mit drei Strichen … Macht das
 * Fahrrad rot." Rot ist dabei nicht nur Geschmack: Ein schwarzer Rahmen
 * vor dunklem Waldhintergrund verschwindet, und alles, was man dann noch
 * sieht, sind die Umrisse — genau der „drei Striche"-Eindruck. Rot trennt
 * das Rad vom Hintergrund, und erst dadurch werden die Einzelteile
 * überhaupt als Fahrrad lesbar.
 */
const FARBEN = {
  /*
   * Rückmeldung: „Ich will gar nicht, dass man den Himmel sieht und dass
   * da Berge sind und Bäume, das sieht doof aus … nur den Grünstreifen
   * von der Wiese und darunter eine hellere und eine dunklere Schicht
   * Erde." `bodenOben`/`bodenTief` sind seitdem Erdtöne, kein Grün mehr —
   * das steckt allein noch im schmalen Grasstrich `bodenKante` obenauf.
   *
   * Der Himmel selbst durfte später wieder etwas werden — Rückmeldung:
   * „überleg dir beim Hintergrund noch was Cooles, das schön aussieht,
   * aber sich nicht mitbewegt." `himmelOben`/`himmelUnten` sind deshalb
   * ein Verlauf statt einer Fläche, dazu ein festes Sonnenlicht (siehe
   * `zeichnen`) — beides in Bildschirmkoordinaten, ohne `kameraX` in der
   * Rechnung, bewegt sich also nie mit.
   */
  himmelOben: '#3d7bab',
  himmelUnten: '#bfe3f0',
  bodenOben: '#8a6a45',
  bodenTief: '#3b2a1a',
  bodenKante: '#6ea653',
  /** Rahmen in drei Tönen — Grundfläche, Lichtkante, Schattenkante. */
  rahmen: '#d92d20',
  rahmenHell: '#ff6b5e',
  rahmenDunkel: '#8c1710',
  /** Federelemente: helles Standrohr, dunkles Tauchrohr. */
  federHell: '#c9ced6',
  federDunkel: '#3d434d',
  reifen: '#16161a',
  profil: '#26262c',
  felge: '#8d939e',
  nabe: '#c3c8d0',
  helm: '#f4f6f8',
  helmSchatten: '#c9ced6',
  visier: '#1e2a33',
  /*
   * Das Trikot war zuerst fast schwarz (#1b1b22) — vor dem dunklen
   * Waldhintergrund verschmolz der Fahrer damit zu einem Klumpen, an dem
   * nur der Helm zu erkennen war. Ronni hatte die schwarze Kleidung zwar
   * ursprünglich gewünscht, aber später ausdrücklich freigegeben („ist mir
   * egal, ob das jetzt schwarz sein soll"). Jetzt ein helles Blaugrau: Es
   * hebt sich vom Hintergrund ab, ohne dem roten Rahmen die Aufmerksamkeit
   * zu nehmen.
   */
  kleidung: '#4a5566',
  hose: '#232830',
  haut: '#e8b48a',
  akzent: '#38d9a9',
};

/**
 * Wie viele Meter quer ins Bild passen — bei Tempo etwas mehr.
 *
 * **Deutlich weniger als beim ersten Versuch (15 m).** Rückmeldung: „Das
 * ist alles viel zu klein … der Hintergrund so riesig und die Person so
 * klein. Guck dir Hill Climb Racing an." Genau das ist der Unterschied:
 * Dort füllt das Fahrzeug einen guten Teil des Bildes, hier war es ein
 * Fleck vor viel Landschaft. Bei 9 m Sichtweite nimmt das Rad rund ein
 * Achtel der Bildbreite ein statt einem Zwanzigstel.
 */
/*
 * Rückmeldung, nachdem die Sprünge größer wurden: „Kameraperspektive ein
 * bisschen weiter nach hinten, dass ich mehr sehe." Bei großen,
 * aneinandergereihten Sprüngen ist Weitsicht keine Kosmetik mehr,
 * sondern Voraussetzung — sonst sieht man die nächste Kuppe nicht mehr
 * rechtzeitig, um sich in der Luft danach auszurichten.
 */
/*
 * Feinschliff: die Spanne zwischen Ruhig und Schnell etwas weiter
 * gezogen (12–16 → 11,5–17,5) — der Tempo-Zoom war vorhanden, aber kaum
 * zu bemerken. Am unteren Ende etwas näher dran (mehr „mittendrin" bei
 * gemütlichem Tempo), am oberen Ende etwas weiter zurück (mehr sichtbare
 * Vorwarnung bei Höchsttempo) — beide Richtungen der ursprünglichen
 * Begründung oben bleiben erhalten, nur deutlicher spürbar.
 */
const SICHT_RUHIG = 11.5;
const SICHT_SCHNELL = 17.5;

/**
 * Mischt zwei Farben — gebraucht für die Verlaufsstopps der Rohre.
 *
 * Nimmt nur `#rrggbb` entgegen, weil hier nur die eigenen Konstanten
 * hineingehen; ein voller Farbparser wäre für vier Aufrufe unangemessen.
 */
function mischen(a: string, b: string, anteil: number): string {
  const zahl = (s: string) => [
    parseInt(s.slice(1, 3), 16),
    parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = zahl(a);
  const [r2, g2, b2] = zahl(b);
  const misch = (x: number, y: number) => Math.round(x + (y - x) * anteil);
  return `rgb(${misch(r1!, r2!)},${misch(g1!, g2!)},${misch(b1!, b2!)})`;
}

/**
 * Ein rein deterministischer Wert zwischen 0 und 1 aus einer Weltposition
 * — für Steine (siehe unten), ohne `Math.random()` und ohne ein eigenes
 * Feld in `Gelaende` zu brauchen. Bei derselben Weltposition kommt immer
 * derselbe Wert heraus, unabhängig vom Bildaufbau oder der Kamera — genau
 * die Eigenschaft, die aus einem zufällig wirkenden Muster ein Stück der
 * Strecke selbst macht statt eines bei jedem Bild neu gewürfelten.
 */
function streuWert(meter: number): number {
  const n = Math.sin(meter * 127.1) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Maße des Rades in Metern.
 *
 * **Bewusst keine echten Maße.** Ein 29-Zoll-Laufrad hat 0,37 m Radius bei
 * 1,20 m Radstand — genau das sah aus wie „ein normales Rennrad", so
 * Ronnis Urteil zur ersten Fassung. Spiele wie Hill Climb Racing
 * übertreiben die Räder deutlich; erst dadurch liest sich ein Fahrzeug
 * auf den ersten Blick als geländegängig.
 *
 * **Zweiter Feinschliff, etwas näher an echten Proportionen.** Die erste
 * Fassung (0,92 m Raddurchmesser bei 1,12 m Radstand) wirkte mit fast
 * gleich großem Rad und Achsabstand kompakt bis spielzeughaft. Kleinere
 * Räder (0,84 m) bei größerem Radstand (1,18 m) lassen dasselbe Rad
 * erwachsener/länger wirken, ohne die geländegängige Übertreibung ganz
 * aufzugeben.
 */
const RAD_R = 0.42;
const RADSTAND = 1.18;

export function zeichnerBauen(leinwand: HTMLCanvasElement): Zeichner {
  const ctx = leinwand.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D nicht verfügbar');

  let breite = leinwand.width;
  let hoehe = leinwand.height;
  let pixelDichte = 1;

  /*
   * Der eigene Darstellungszustand. Alles hier ist gedämpft und läuft der
   * Physik hinterher — genau das erzeugt den Eindruck von Masse.
   */
  /** Kameraposition in Weltkoordinaten, folgt dem Rad weich. */
  let kameraX = 0;
  let kameraY = 0;
  /**
   * Beim allerersten Bild springt die Kamera auf ihre Zielposition, statt
   * hinzugleiten.
   *
   * Ohne das stand sie bei null, während das Rad schon bei x = 4 losfährt
   * — im ersten Bild ragte das Rad dadurch halb aus dem rechten Bildrand
   * heraus und glitt erst danach sichtbar in die Bildmitte. Ein weiches
   * Nachziehen ist im Lauf richtig, beim Bildaufbau ist es ein Fehler.
   */
  let kameraGesetzt = false;
  /** Einfederung 0 bis 1, vorne und hinten getrennt. */
  let federVorn = 0;
  let federHinten = 0;
  /**
   * Kamera-Wackeln 0 bis 1 — dieselbe Stoß-Erkennung wie die Federung,
   * nur als kurzer Bildschirm-Ruck statt einer Rad-Bewegung. Ronni wollte
   * mehr „Kamera-Dramatik" bei harten Landungen; ein Sturz löst denselben
   * Stoß aus wie eine harte Landung (`vy` springt beim Aufsetzen in
   * beiden Fällen auf null), braucht also keinen eigenen Sonderfall.
   */
  let schuettelStaerke = 0;
  /** Gesamtdrehung der Laufräder in Radiant. */
  let radDrehung = 0;
  /**
   * Staub — **zweiter Anlauf.** Der erste (Rückmeldung: „sieht komisch
   * aus", ersatzlos raus) warf offenbar zu viel auf einmal auf; hier sind
   * es bewusst nur einzelne, kleine Punkte statt einer Wolke: ein paar
   * beim harten Einschlag (derselbe `kraft > 0,35`-Schwellenwert wie das
   * Kamera-Wackeln, kein eigener Sonderfall), dazu höchstens alle 0,15 s
   * ein einzelnes Staubkorn hinterm Hinterrad bei hohem Tempo am Boden.
   * Jedes Korn lebt kaum eine halbe Sekunde. Sollte sich das wieder
   * seltsam anfühlen, ist die Regel dieselbe wie beim ersten Mal:
   * ersatzlos raus, nicht kleiner drehen.
   */
  type Staubkorn = { x: number; y: number; vx: number; vy: number; alter: number; lebenszeit: number; groesse: number };
  let staub: Staubkorn[] = [];
  /** Seit dem letzten Trag-Staubkorn vergangene Zeit. */
  let staubUhr = 0;
  /** Für die Federung: die senkrechte Geschwindigkeit des letzten Bildes. */
  let vyVorher = 0;
  /**
   * Kurzer, sehr dezenter Lichtblitz bei einer perfekten Landung — das
   * optische Gegenstück zum Kamera-Wackeln oben: Das Wackeln sagt „harter
   * Einschlag", der Blitz sagt „genau richtig gemacht". Bewusst kein Text
   * (siehe `FlowMtb.tsx`, „PERFEKT!" wurde ausdrücklich entfernt) — nur
   * ein kaum wahrnehmbares Aufhellen des ganzen Bildes, das binnen eines
   * Wimpernschlags wieder verschwindet.
   */
  let blitzStaerke = 0;
  /** Für die Blitz-Erkennung: die Landungsart des letzten Bildes. */
  let landungVorher: Landung | null = null;

  const groesseAendern = (b: number, h: number) => {
    // Bildpunktzahl deckeln — dieselbe Vorsicht wie bei Dash City, ein
    // altes iPad zeichnet sonst viermal so viele Punkte wie nötig.
    pixelDichte = Math.min(window.devicePixelRatio || 1, 2);
    breite = b;
    hoehe = h;
    leinwand.width = Math.round(b * pixelDichte);
    leinwand.height = Math.round(h * pixelDichte);
    leinwand.style.width = `${b}px`;
    leinwand.style.height = `${h}px`;
  };

  const zeichnen = (lauf: Lauf, dt: number) => {
    const g = lauf.gelaende;

    // --- Kamera ---------------------------------------------------
    /*
     * Bei Tempo etwas weiter weg. Das ist nicht nur Optik: Wer schnell
     * fährt, braucht mehr Vorwarnung, sonst ist der nächste Kicker nicht
     * mehr rechtzeitig zu sehen. Ronni: „Bei hoher Geschwindigkeit leichte
     * Zoom-Anpassung."
     */
    const tempoAnteil = Math.min(1, Math.max(0, lauf.vx / 16));
    const sicht = SICHT_RUHIG + (SICHT_SCHNELL - SICHT_RUHIG) * tempoAnteil;
    const proMeter = breite / sicht;

    /*
     * Das Rad steht bei 34 % von links, nicht in der Mitte: Nach vorn
     * braucht man Sicht, nach hinten nicht. Die Kamera folgt gedämpft —
     * hart mitzuziehen wirkt hektisch.
     *
     * **Etwas mehr Nachlauf als vorher** (Faktor 7 → 5,5): Bei 7 hatte
     * die Kamera das Rad praktisch schon nach einem Zehntel Sekunde
     * eingeholt — kaum als eigene Bewegung spürbar, eher wie starr
     * angeheftet. Ein spürbarerer Nachlauf gibt der Kamera ein Stück
     * eigenes Gewicht, ohne bei normalen Richtungswechseln hektisch zu
     * wirken (dafür bleibt sie mit 5,5 immer noch deutlich schneller als
     * das Rad selbst reagieren kann).
     */
    const zielX = lauf.x + sicht * 0.16;
    const zielY = lauf.y + 1.1;
    if (!kameraGesetzt) {
      kameraX = zielX;
      kameraY = zielY;
      kameraGesetzt = true;
    } else {
      const folgen = Math.min(1, dt * 5.5);
      kameraX += (zielX - kameraX) * folgen;
      kameraY += (zielY - kameraY) * folgen;
    }

    /*
     * Federung und Kamera-Wackeln reagieren auf den **Wechsel** der
     * senkrechten Geschwindigkeit, nicht auf ihren Wert — ein sanftes
     * Abbremsen federt nicht, ein plötzlicher Stopp (Landung, Sturz)
     * schon. Absichtlich schon hier berechnet, vor dem Gelände-Umriss:
     * Damit wackelt bei einem harten Einschlag das **ganze** Bild
     * (Boden und Rad zusammen), nicht nur das Rad einen Bildschritt
     * später als der Boden.
     */
    const stoss = Math.max(0, vyVorher - lauf.vy);
    vyVorher = lauf.vy;
    if (lauf.amBoden && stoss > 1) {
      const kraft = Math.min(1, stoss / 14);
      federVorn = Math.min(1, federVorn + kraft);
      federHinten = Math.min(1, federHinten + kraft * 1.15);
      // Erst ab einer echt harten Landung wackeln, nicht bei jedem
      // normalen Aufsetzen — sonst zittert das Bild ständig mit.
      if (kraft > 0.35) {
        schuettelStaerke = Math.min(1, schuettelStaerke + kraft);
        // Eine Handvoll Staubkörner beim Einschlag — derselbe Schwellenwert,
        // kein eigener Sonderfall. Bewusst wenige (3–5), keine Wolke.
        const anzahl = 3 + Math.floor(kraft * 3);
        for (let i = 0; i < anzahl; i++) {
          staub.push({
            x: lauf.x + (Math.random() - 0.5) * 0.6,
            y: 0.05,
            vx: (Math.random() - 0.5) * 3.5,
            vy: 1 + Math.random() * 1.8,
            alter: 0,
            lebenszeit: 0.3 + Math.random() * 0.25,
            groesse: 0.05 + Math.random() * 0.05,
          });
        }
      }
    }
    // Lichtblitz beim Wechsel auf eine perfekte Landung auslösen — nur
    // beim Wechsel, sonst bliebe er die ganze Landungsanzeige über an.
    if (lauf.letzteLandung === 'perfekt' && landungVorher !== 'perfekt') {
      blitzStaerke = 1;
    }
    landungVorher = lauf.letzteLandung;

    // Zurückfedern bzw. Ausklingen.
    federVorn = Math.max(0, federVorn - dt * 3.4);
    federHinten = Math.max(0, federHinten - dt * 3.1);
    schuettelStaerke = Math.max(0, schuettelStaerke - dt * 5);
    // Schnell ausklingend — rund 150 ms, ein Wimpernschlag, kein Dauerglühen.
    blitzStaerke = Math.max(0, blitzStaerke - dt * 6.5);

    /*
     * Einzelne Staubkörner hinterm Hinterrad bei zügigem Tempo am Boden —
     * höchstens eins alle 0,15 s, nicht bei jedem Bild. Bewusst dieselbe
     * Kornform wie beim Einschlag, nur seltener und schwächer geworfen.
     */
    staubUhr += dt;
    if (lauf.amBoden && lauf.vx > 9 && staubUhr > 0.15) {
      staubUhr = 0;
      staub.push({
        x: lauf.x - RADSTAND * 0.5,
        y: 0.03,
        vx: -lauf.vx * 0.15 + (Math.random() - 0.5) * 0.6,
        vy: 0.6 + Math.random() * 0.5,
        alter: 0,
        lebenszeit: 0.35,
        groesse: 0.04,
      });
    }
    // Bewegen, altern (durchsichtiger, siehe Zeichnung unten) und
    // aussortieren, sobald ein Korn seine Lebenszeit überschritten hat.
    // Eine leichte, rein dekorative Fallbeschleunigung — bewusst kein
    // Bezug zu `SCHWERKRAFT` aus `logik.ts`, das wäre Physik für einen
    // Effekt, der keine ist.
    for (const korn of staub) {
      korn.x += korn.vx * dt;
      korn.y += korn.vy * dt;
      korn.vy -= 6 * dt;
      korn.alter += dt;
    }
    staub = staub.filter((korn) => korn.alter < korn.lebenszeit && korn.y > -0.5);
    // Zufällig statt gerichtet — reines Bildschirm-Zittern, keine
    // Spielregel, deshalb ist `Math.random()` hier genau richtig
    // (anders als im Gelände, das aus der Saat kommen muss).
    const schuettelX = schuettelStaerke > 0 ? (Math.random() - 0.5) * schuettelStaerke * 14 : 0;
    const schuettelY = schuettelStaerke > 0 ? (Math.random() - 0.5) * schuettelStaerke * 10 : 0;

    /**
     * Weltkoordinaten → Bildpunkte. `y` wird dabei umgedreht.
     *
     * Der Bezugspunkt liegt bei 74 % der Bildhöhe, nicht bei 62 %: Unter
     * dem Rad braucht man nur so viel Boden, dass er nicht abgeschnitten
     * wirkt — darüber dagegen die ganze Flugbahn. Bei 62 % blieb im
     * Hochformat ein Viertel des Bildes leere grüne Fläche.
     */
    const bx = (x: number) => (x - kameraX) * proMeter + breite * 0.5 + schuettelX;
    const by = (y: number) => hoehe * 0.74 - (y - kameraY) * proMeter + schuettelY;

    ctx.setTransform(pixelDichte, 0, 0, pixelDichte, 0, 0);
    ctx.clearRect(0, 0, breite, hoehe);

    /*
     * --- Himmel und Boden — bewusst kompakt ---------------------------
     *
     * Rückmeldung: „Ich will gar nicht, dass man den Himmel sieht und
     * dass da irgendwelche Berge sind und dass neben der Strecke
     * irgendwelche Bäume sind, das sieht doof aus. Man sollte nur den
     * Grünstreifen von der Wiese sehen und darunter dann die Erde, kurz
     * so eine hellere Schicht Erde und dann eine dunklere Schicht Erde."
     *
     * Weg sind damit: die drei Parallax-Bergketten, die Bäume am Wegrand
     * und der weiche Verlauf im Boden. Übrig bleiben eine flache
     * Himmelfläche, zwei flache Erdflächen und der grüne Grasstrich.
     *
     * Zwei Wolken durften bleiben — Rückmeldung: „vielleicht noch ein,
     * zwei Wolken, aber der Hintergrund darf sich am besten nicht
     * bewegen." Deshalb stehen sie **in Bildschirmkoordinaten**, nicht in
     * Weltkoordinaten: keine Parallaxe, kein `kameraX` in der Rechnung,
     * einfach zwei feste Flecken am Himmel.
     */
    const himmel = ctx.createLinearGradient(0, 0, 0, hoehe);
    himmel.addColorStop(0, FARBEN.himmelOben);
    himmel.addColorStop(1, FARBEN.himmelUnten);
    ctx.fillStyle = himmel;
    ctx.fillRect(0, 0, breite, hoehe);

    // Festes Sonnenlicht, oben rechts — ein warmer Lichtfleck, der den
    // sonst leeren Himmel belebt, ohne eine erkennbare Form (Sonne, Berg)
    // zu sein, die als „Motiv" mitgezählt hätte werden müssen.
    const sonneX = breite * 0.78;
    const sonneY = hoehe * 0.15;
    const sonneR = breite * 0.34;
    const sonne = ctx.createRadialGradient(sonneX, sonneY, 0, sonneX, sonneY, sonneR);
    sonne.addColorStop(0, 'rgba(255,246,220,0.55)');
    sonne.addColorStop(0.4, 'rgba(255,246,220,0.2)');
    sonne.addColorStop(1, 'rgba(255,246,220,0)');
    ctx.fillStyle = sonne;
    ctx.fillRect(0, 0, breite, hoehe);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [wx, wy, wr] of [
      [0.24, 0.12, 1] as const,
      [0.7, 0.2, 0.78] as const,
    ]) {
      const px = breite * wx;
      const py = hoehe * wy;
      const r = 24 * wr;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.arc(px + r * 0.8, py + r * 0.1, r * 0.72, 0, Math.PI * 2);
      ctx.arc(px - r * 0.75, py + r * 0.15, r * 0.58, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Das Gelände ----------------------------------------------
    /*
     * Der Umriss wird alle vier Bildpunkte abgetastet, nicht je Meter:
     * So ist die Linie immer glatt, egal wie weit die Kamera weg ist,
     * und die Zahl der Punkte hängt an der Bildbreite statt an der
     * Sichtweite.
     */
    const umriss: [number, number, number][] = [];
    for (let px = -12; px <= breite + 12; px += 4) {
      const wx = kameraX + (px - breite * 0.5) / proMeter;
      umriss.push([px, by(bodenHoehe(g, wx)), wx]);
    }

    /** Füllt die Fläche unter dem Geländeumriss, um `versatz` nach unten
        verschoben — dieselbe Abtastung dient allen drei Schichten. */
    const bodenFlaeche = (farbe: string, versatz: number) => {
      ctx.fillStyle = farbe;
      ctx.beginPath();
      ctx.moveTo(umriss[0]![0], umriss[0]![1] + versatz);
      for (const [px, py] of umriss) ctx.lineTo(px, py + versatz);
      ctx.lineTo(breite + 12, hoehe);
      ctx.lineTo(-12, hoehe);
      ctx.closePath();
      ctx.fill();
    };

    /*
     * Nah an einem Kicker? Steuert zwei Dinge weiter unten: den Grasstrich
     * (setzt an einem Kicker aus, kahle Erde statt Wiese) und die spätere
     * Landemarkierung. `1.3×` Breite deckt sowohl die Anfahrt als auch die
     * Landeseite der Glocke ab, nicht nur den Gipfel selbst.
     */
    const aufKicker = (wx: number) => g.kicker.some((k) => Math.abs(wx - k.x) < k.breite * 1.3);


    /*
     * Erdschichten. Ursprünglich zwei Flächen (dunkler Grund, heller
     * Streifen obenauf) — Recherche zu anderen 2D-Bike-Spielen (Trials,
     * Bike Mayhem) zeigt durchgehend **drei bis vier** Farbflächen
     * übereinander, nie nur zwei: ein geschichteter Fels-Look statt zweier
     * Aufkleber, dazu ein schmaler heller Saum direkt unter der
     * Grasnarbe — derselbe „Sonne trifft die Kuppe"-Effekt, den jedes
     * recherchierte Spiel an der Geländekante zeigt.
     *
     * **Die Reihenfolge ist hier kein Zufall.** Jede Schicht füllt von
     * ihrem eigenen `versatz` bis zum unteren Bildrand — eine später
     * gezeichnete Schicht übermalt also alles darüber, bis zurück zu
     * ihrem eigenen `versatz`. Sichtbar bleibt von jeder Schicht deshalb
     * nur das Band zwischen ihrem `versatz` und dem der **nächsten**
     * Schicht. Damit das aufgeht, müssen die `versatz`-Werte hier
     * **aufsteigend** gezeichnet werden — sonst verschluckt eine später
     * gezeichnete, aber weiter oben ansetzende Schicht alle vorherigen
     * sofort wieder.
     */
    bodenFlaeche(FARBEN.bodenTief, 0); // Sicherheitsgrund, wird komplett überdeckt
    bodenFlaeche(mischen(FARBEN.bodenOben, '#ffffff', 0.3), -0.08 * proMeter); // heller Saum

    /*
     * `bodenOben` segmentweise statt in einer Fläche — die einzige Schicht,
     * die das lohnt, weil sie den größten Teil des sichtbaren Bodens
     * ausmacht. Jedes Segment bekommt seinen Ton aus der tatsächlichen
     * Steigung an dieser Stelle (`bodenSteigung`, exakt, nicht geschätzt):
     * flache Abschnitte bleiben hell, steile Anstiege — vor allem die
     * Kicker-Kuppen selbst — liegen dunkler, wie im eigenen Schatten.
     * Recherche zu anderen 2D-Bike-Spielen nannte das den billigsten Griff
     * für mehr Relief, weil `bodenSteigung` ohnehin schon berechnet wird.
     */
    {
      const versatz = -0.05 * proMeter;
      for (let i = 0; i < umriss.length - 1; i++) {
        const [px1, py1, wx1] = umriss[i]!;
        const [px2, py2, wx2] = umriss[i + 1]!;
        const steigung = bodenSteigung(g, (wx1 + wx2) / 2);
        const ton = Math.min(0.35, Math.abs(steigung) * 0.18);
        ctx.fillStyle = mischen(FARBEN.bodenOben, '#000000', ton);
        ctx.beginPath();
        ctx.moveTo(px1, py1 + versatz);
        ctx.lineTo(px2, py2 + versatz);
        ctx.lineTo(px2, hoehe);
        ctx.lineTo(px1, hoehe);
        ctx.closePath();
        ctx.fill();
      }
    }

    bodenFlaeche(mischen(FARBEN.bodenOben, FARBEN.bodenTief, 0.45), 0.6 * proMeter); // Rostband
    const erdVersatz = 1.3 * proMeter;
    bodenFlaeche(FARBEN.bodenTief, erdVersatz);

    /*
     * Der grüne Grasstrich obendrauf — ohne ihn sieht der Boden aus wie
     * bloße Erde, nicht wie eine Wiese. **Setzt an Kickern aus**: Trials,
     * Bike Mayhem und Mad Skills BMX 2 zeigen an Sprungschanzen
     * durchgehend kahle, festgefahrene Erde statt Gras — in der Fiktion
     * fährt dort ständig jemand drüber. Ohne diesen Unterschied sieht ein
     * Kicker aus wie ein normaler Hügel und ist erst an der eigenen
     * Flugbahn als Sprung zu erkennen, nicht schon vorher am Bild.
     */
    ctx.strokeStyle = FARBEN.bodenKante;
    ctx.lineWidth = Math.max(4, 0.12 * proMeter);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let grasOffen = false;
    for (const [px, py, wx] of umriss) {
      if (aufKicker(wx)) {
        if (grasOffen) {
          ctx.stroke();
          ctx.beginPath();
          grasOffen = false;
        }
        continue;
      }
      if (!grasOffen) {
        ctx.moveTo(px, py);
        grasOffen = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    if (grasOffen) ctx.stroke();

    /*
     * Kleine Steine, direkt in der Grasnarbe verankert — Recherche zu
     * anderen 2D-Bike-Spielen: Deko, die zur Strecke selbst gehört, nicht
     * zu einem zweiten, separat scrollenden Hintergrund. Weltposition
     * kommt aus einer reinen Hash-Funktion von `x` (`streuWert`), nicht
     * aus `Math.random()` — bei gleicher Weltposition liegt also immer
     * derselbe Stein da, unabhängig vom Bildaufbau, ohne dass dafür ein
     * eigenes Feld in `Gelaende` nötig wäre.
     */
    const STEIN_ABSTAND = 2.6;
    const ersterStein = Math.floor((kameraX - sicht * 0.5) / STEIN_ABSTAND) * STEIN_ABSTAND;
    for (let wx = ersterStein; wx < kameraX + sicht * 0.5 + STEIN_ABSTAND; wx += STEIN_ABSTAND) {
      if (wx <= ANLAUF || aufKicker(wx)) continue; // nicht auf der Startgeraden, nicht auf Kickern
      const wuerfel = streuWert(wx);
      if (wuerfel > 0.4) continue; // nicht an jeder Stelle einer
      const groesse = (0.05 + streuWert(wx + 0.5) * 0.07) * proMeter;
      const boden = by(bodenHoehe(g, wx + streuWert(wx + 1) * 1.4 - 0.7));
      ctx.fillStyle = mischen(FARBEN.bodenTief, '#000000', 0.15);
      ctx.beginPath();
      ctx.ellipse(bx(wx), boden - groesse * 0.3, groesse, groesse * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Ziellinie -------------------------------------------------
    if (kameraX + sicht > g.laenge - 4) {
      const zx = bx(g.laenge);
      const zy = by(bodenHoehe(g, g.laenge));
      const hoch = 3.4 * proMeter;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(zx - 3, zy - hoch, 6, hoch);
      // Karomuster als Querbalken oben.
      const feld = Math.max(6, proMeter * 0.28);
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? '#f8fafc' : '#111827';
          ctx.fillRect(zx - 3 + i * feld, zy - hoch + j * feld, feld, feld);
        }
      }
    }

    // --- Staub -------------------------------------------------------
    // Vor dem Rad gezeichnet, damit kein Korn optisch vor dem Fahrer
    // schwebt — Bewegung/Alterung sind oben schon berechnet.
    for (const korn of staub) {
      const durchsichtig = 1 - korn.alter / korn.lebenszeit;
      ctx.fillStyle = `rgba(138,106,69,${(durchsichtig * 0.5).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(bx(korn.x), by(korn.y), korn.groesse * proMeter, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Räder --------------------------------------------------------
    // Federung und Kamera-Wackeln sind schon berechnet (siehe oben, vor
    // dem Gelände-Umriss). Räder drehen sich mit dem Tempo — Umfang 2πr.
    // Bei Rückwärtsrollen (negatives `vx`, siehe `logik.ts`) läuft das
    // von selbst rückwärts.
    radDrehung += (lauf.vx / RAD_R) * dt;

    // --- Fahrrad und Fahrer ----------------------------------------
    radFahrerZeichnen(ctx, lauf, {
      px: bx(lauf.x),
      py: by(lauf.y),
      proMeter,
      federVorn,
      federHinten,
      radDrehung,
    });

    // --- Lichtblitz bei perfekter Landung, ganz zum Schluss ---------
    // In Bildschirmkoordinaten (nicht Weltkoordinaten) — er soll das
    // ganze Bild gleichmäßig aufhellen, nicht mit der Kamera mitwandern.
    if (blitzStaerke > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(blitzStaerke * 0.12).toFixed(3)})`;
      ctx.fillRect(0, 0, breite, hoehe);
    }
  };

  return { zeichnen, groesseAendern };
}

/**
 * Zeichnet Rad und Fahrer.
 *
 * Ronnis Prioritäten, wörtlich: „1. Fahrrad, 2. Fahrer, 3. Animation."
 *
 * **Die erste Fassung war ein Strichfahrrad — und genau so sah sie aus.**
 * Rückmeldung: „Das ist ein Fahrrad mit drei Strichen. Das ist nicht gut."
 * Der Fehler war, alles mit `stroke` zu zeichnen: Eine Linie hat überall
 * dieselbe Breite und kein Volumen, egal wie dick man sie macht. Jetzt ist
 * jedes Teil eine **gefüllte Fläche** mit eigener Licht- und Schattenkante
 * — Rohre verjüngen sich, Reifen haben Profil, die Federelemente bestehen
 * aus zwei ineinander laufenden Rohren.
 *
 * Die Federung ist dabei kein Beiwerk: „Das Fahrrad soll eine Federung
 * richtig haben, vorne und hinten." Vorn taucht das Standrohr sichtbar ins
 * Tauchrohr ein, hinten schwingt der ganze Hinterbau um das Tretlager und
 * staucht dabei den Dämpfer. Beides bewegt sich bei jeder Landung.
 */
function radFahrerZeichnen(
  ctx: CanvasRenderingContext2D,
  lauf: Lauf,
  o: {
    px: number;
    py: number;
    proMeter: number;
    federVorn: number;
    federHinten: number;
    radDrehung: number;
  },
) {
  const { px, py, proMeter, federVorn, federHinten, radDrehung } = o;
  const m = proMeter;

  ctx.save();
  ctx.translate(px, py);
  /*
   * Rückmeldung: „Falls man stürzt, soll es nicht im letzten Moment
   * abbrechen, sondern man soll sehen, wie der Typ stürzt." Der erste
   * Versuch drehte schnell auf 1,5 Radiant hoch (in 0,44 s) und blieb
   * dann bis zum Rundenende-Bildschirm bei `FlowMtb.tsx` (1,1 s
   * Verzögerung) einfach stehen — genau das las sich wie ein Abbruch,
   * nicht wie ein Sturz. Jetzt dreht es über die **ganze** Verzögerung
   * weiter, zusammen mit dem Ausrutschen aus `takt`.
   */
  const sturzDreh = lauf.vorbei && !lauf.gewonnen ? Math.min(5.6, lauf.sturzZeit * 5.1) : 0;
  // Bildschirm-y zeigt nach unten, Physik-y nach oben — deshalb das Minus.
  ctx.rotate(-lauf.winkel + sturzDreh);

  const radR = RAD_R * m;
  const hintenX = -RADSTAND * 0.52 * m;
  const vornX = RADSTAND * 0.48 * m;
  const nabeY = -radR;

  /** Federweg vorn: das Standrohr taucht ein, das Vorderrad rückt hoch. */
  const wegVorn = federVorn * 0.11 * m;
  /** Federweg hinten: der Rahmen sinkt, der Hinterbau schwingt. */
  const wegHinten = federHinten * 0.1 * m;

  /**
   * Ein Rohr — mit **Querverlauf**, und genau daran hängt alles.
   *
   * Die erste Fassung füllte einfarbig und setzte eine helle Linie an die
   * Oberkante. Eine einfarbige Fläche ist aber ein Band, kein Rohr, egal
   * wie gut die Geometrie stimmt — das war der eigentliche Grund für den
   * „drei Striche"-Eindruck.
   *
   * Zwei Dinge machen daraus ein rundes Rohr:
   *
   * 1. **Der Verlauf läuft quer zur Rohrachse**, nicht längs. Die
   *    Normale `(−dy, dx)/L` steht senkrecht auf der Achse; entlang dieser
   *    Achse ändert sich der Verlaufswert nicht, quer dazu voll.
   * 2. **Das Glanzband sitzt bei 18 %, nicht am Rand.** Ein Zylinder hat
   *    seinen hellsten Streifen nicht an der Silhouette — dort fällt das
   *    Licht schon wieder ab. Genau diese Asymmetrie liest das Auge als
   *    Wölbung; ein gleichmäßiger Verlauf von hell nach dunkel wirkt
   *    weiter flach, nur schräg beleuchtet.
   *
   * Dazu eine dunkle Kontur: erst den Pfad dick dunkel stricheln, dann
   * die Füllung darüber. Der Strich ragt zur Hälfte nach außen, innen
   * deckt ihn die Füllung ab — das ergibt eine gleichmäßige Umrandung
   * statt zweier sichtbarer Bänder.
   */
  const rohr = (
    ax: number,
    ay: number,
    bx2: number,
    by2: number,
    dickeA: number,
    dickeB: number,
    grund: string,
    kontur = true,
  ) => {
    const dx = bx2 - ax;
    const dy = by2 - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const pfad = () => {
      ctx.beginPath();
      ctx.moveTo(ax + nx * dickeA, ay + ny * dickeA);
      ctx.lineTo(bx2 + nx * dickeB, by2 + ny * dickeB);
      ctx.lineTo(bx2 - nx * dickeB, by2 - ny * dickeB);
      ctx.lineTo(ax - nx * dickeA, ay - ny * dickeA);
      ctx.closePath();
    };

    if (kontur) {
      pfad();
      ctx.strokeStyle = '#0b0d11';
      ctx.lineWidth = Math.max(1.5, dickeA * 0.42);
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    /*
     * Die Verlaufsachse wird an der **festen Lichtrichtung** (oben links)
     * ausgerichtet: `seite` ist das Skalarprodukt aus Normale und Licht.
     * Ohne das glänzt jedes Rohr für sich, und das Rad zerfällt in lauter
     * einzeln beleuchtete Teile — dieselbe Regel wie bei den App-Symbolen
     * in `core/AppSymbol.tsx`.
     */
    const seite = nx * -0.55 + ny * -0.84 >= 0 ? 1 : -1;
    const mx = (ax + bx2) / 2;
    const my = (ay + by2) / 2;
    const dM = ((dickeA + dickeB) / 2) * seite;
    const g2 = ctx.createLinearGradient(mx + nx * dM, my + ny * dM, mx - nx * dM, my - ny * dM);
    g2.addColorStop(0, mischen(grund, '#ffffff', 0.1));
    g2.addColorStop(0.18, mischen(grund, '#ffffff', 0.5));
    g2.addColorStop(0.45, grund);
    g2.addColorStop(0.82, mischen(grund, '#000000', 0.42));
    g2.addColorStop(1, mischen(grund, '#000000', 0.6));

    pfad();
    ctx.fillStyle = g2;
    ctx.fill();
  };

  // ---------------------------------------------------------------
  // Laufräder
  // ---------------------------------------------------------------
  const laufrad = (rx: number, ry: number) => {
    // Die Reifenbasis zuerst — die Stollen kommen später obendrauf.
    // Andersherum (Stollen zuerst) verschluckt die breite Lauffläche eine
    // innere Stollenreihe komplett, weil sie darüber gezeichnet würde.
    ctx.strokeStyle = FARBEN.reifen;
    ctx.lineWidth = radR * 0.22;
    ctx.beginPath();
    ctx.arc(rx, ry, radR * 0.87, 0, Math.PI * 2);
    ctx.stroke();

    // Seitenwand: ein schmaler, hellerer Ring zwischen Lauffläche und
    // Felge — ohne ihn ist der Reifen eine reine Silhouette ohne Flanke.
    ctx.strokeStyle = mischen(FARBEN.reifen, '#ffffff', 0.3);
    ctx.lineWidth = Math.max(1, radR * 0.03);
    ctx.beginPath();
    ctx.arc(rx, ry, radR * 0.81, 0, Math.PI * 2);
    ctx.stroke();

    /*
     * Stollenprofil in **zwei** Reihen statt einer: außen größere
     * Schulterstollen ganz am Rand, innen kleinere, um eine halbe
     * Teilung versetzte Stollen dazwischen. Ein einzelner Kranz aus
     * Zacken liest sich eher wie ein Zahnrad als wie ein Reifen — das
     * Doppelmuster ist, was einen MTB-Reifen von einem glatten Ring
     * unterscheidet.
     */
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(radDrehung);
    ctx.fillStyle = FARBEN.profil;
    const stollen = 16;
    const stollenReihe = (radius: number, versatz: number, laenge: number, breite: number) => {
      for (let i = 0; i < stollen; i++) {
        const w = ((i + versatz) / stollen) * Math.PI * 2;
        ctx.save();
        ctx.translate(Math.cos(w) * radius, Math.sin(w) * radius);
        ctx.rotate(w);
        ctx.fillRect(-laenge * 0.25, -breite / 2, laenge, breite);
        ctx.restore();
      }
    };
    // Äußere Reihe: große Schulterstollen, deutlich über die Lauffläche hinaus.
    stollenReihe(radR * 0.96, 0, radR * 0.21, radR * 0.22);
    // Innere Reihe: kleinere, versetzte Mittelstollen.
    stollenReihe(radR * 0.9, 0.5, radR * 0.15, radR * 0.17);
    ctx.restore();

    // Felge.
    ctx.strokeStyle = FARBEN.felge;
    ctx.lineWidth = radR * 0.09;
    ctx.beginPath();
    ctx.arc(rx, ry, radR * 0.74, 0, Math.PI * 2);
    ctx.stroke();

    /*
     * Speichen — **versetzt angesetzt, nicht durch die Mitte.**
     *
     * Der erste Versuch zog sechs Linien als volle Durchmesser durch die
     * Nabe. Das liest sich als Stern, nicht als Laufrad, und beim Drehen
     * passiert optisch fast nichts, weil ein Stern aus Durchmessern
     * punktsymmetrisch ist. Eine echte Speiche läuft **schräg** von der
     * Nabe zur Felge; zehn davon, jede um denselben Winkel versetzt,
     * ergeben das typische Muster.
     */
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(radDrehung);
    ctx.strokeStyle = 'rgba(226,231,238,0.8)';
    ctx.lineWidth = Math.max(0.8, radR * 0.035);
    const speichen = 10;
    ctx.beginPath();
    for (let i = 0; i < speichen; i++) {
      const w = (i / speichen) * Math.PI * 2;
      // Der Versatz von 0,3 Radiant an der Nabe ist die Schrägstellung.
      ctx.moveTo(Math.cos(w + 0.3) * radR * 0.14, Math.sin(w + 0.3) * radR * 0.14);
      ctx.lineTo(Math.cos(w) * radR * 0.72, Math.sin(w) * radR * 0.72);
    }
    ctx.stroke();
    /*
     * Bremsscheibe: gefüllt statt nur ein Kreis-Strich, mit Schlitzen —
     * ein reiner Ring liest sich als dünner Reifenaufkleber, keine Scheibe.
     */
    ctx.fillStyle = '#8a909a';
    ctx.beginPath();
    ctx.arc(0, 0, radR * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c6169';
    ctx.lineWidth = Math.max(0.8, radR * 0.02);
    ctx.stroke();

    const schlitze = 8;
    ctx.strokeStyle = '#3a3d43';
    ctx.lineWidth = Math.max(1, radR * 0.035);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < schlitze; i++) {
      const w = (i / schlitze) * Math.PI * 2;
      ctx.moveTo(Math.cos(w) * radR * 0.16, Math.sin(w) * radR * 0.16);
      ctx.lineTo(Math.cos(w) * radR * 0.32, Math.sin(w) * radR * 0.32);
    }
    ctx.stroke();

    // Zentrumsloch, wo die Nabe drübersitzt.
    ctx.fillStyle = FARBEN.profil;
    ctx.beginPath();
    ctx.arc(0, 0, radR * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Nabe.
    ctx.fillStyle = FARBEN.nabe;
    ctx.beginPath();
    ctx.arc(rx, ry, radR * 0.13, 0, Math.PI * 2);
    ctx.fill();
  };

  const nabeHinten = nabeY + wegHinten * 0.35;
  const nabeVorn = nabeY + wegVorn;
  laufrad(hintenX, nabeHinten);
  laufrad(vornX, nabeVorn);

  // ---------------------------------------------------------------
  // Rahmengeometrie
  // ---------------------------------------------------------------
  /** Das Tretlager — der Punkt, um den der Hinterbau schwingt. */
  const tretlager = { x: -0.08 * m, y: nabeY - 0.05 * m + wegHinten };
  /** Oben am Sattelrohr. */
  const sattel = { x: -0.44 * m, y: tretlager.y - 0.54 * m };
  /** Steuerkopf — hier sitzt die Gabel. */
  const steuerkopf = { x: vornX - 0.1 * m, y: tretlager.y - 0.5 * m };
  /** Oberes Ende der Gabel, knapp unter dem Steuerkopf. */
  const gabelOben = { x: steuerkopf.x + 0.02 * m, y: steuerkopf.y + 0.06 * m };

  /*
   * --- Doppelbrücken-Federgabel ---
   *
   * Ronnis ausdrücklicher Wunsch: „Das Fahrrad soll eine Doppelfedergabel
   * haben." Das ist die Downhill-Bauart: Die Standrohre laufen **oben am
   * Steuerkopf vorbei** und sind dort von *zwei* Brücken gehalten — einer
   * unter und einer über dem Steuerrohr. Genau diese zweite Brücke über
   * dem Steuerkopf unterscheidet sie von jeder normalen Gabel und macht
   * sie auf den ersten Blick erkennbar.
   *
   * Der Aufbau von unten nach oben: dickes Tauchrohr am Rad, darin das
   * dünnere Standrohr, das beim Einfedern darin verschwindet. Der
   * sichtbare Rest des Standrohrs **ist** der Federweg.
   */
  /*
   * Der sichtbare Federweg. Deutlich länger als beim ersten Versuch
   * (0,34 m) — Rückmeldung: „Das Fahrrad soll eine viel größere
   * Federgabel vorne haben." Eine echte Downhill-Gabel hat rund 200 mm
   * Federweg und entsprechend lange Rohre; das ist das Bauteil, an dem
   * man ein Downhill-Rad überhaupt erkennt.
   */
  const gabelOffen = 0.52 * m - wegVorn;
  /** Wo das Standrohr aus dem Tauchrohr kommt. */
  const tauchOben = {
    x: vornX + (gabelOben.x - vornX) * 0.46,
    y: nabeVorn + (gabelOben.y - nabeVorn) * 0.46,
  };
  /** Das obere Ende der Standrohre, über dem Steuerkopf. */
  const standOben = { x: gabelOben.x + 0.02 * m, y: gabelOben.y - gabelOffen * 0.45 };

  // Tauchrohr (unten, dick, dunkel).
  rohr(
    vornX,
    nabeVorn,
    tauchOben.x,
    tauchOben.y,
    0.075 * m,
    0.08 * m,
    FARBEN.federDunkel,
  );
  // Kleiner Decal-Sticker aufs Tauchrohr — reine Markenzeichen-Anmutung,
  // sitzt schräg entlang der Rohrachse wie ein echter Federgabel-Aufkleber.
  {
    const dx = tauchOben.x - vornX;
    const dy = tauchOben.y - nabeVorn;
    ctx.save();
    ctx.translate(vornX + dx * 0.42, nabeVorn + dy * 0.42);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = FARBEN.akzent;
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.05 * m, 0.017 * m, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Standrohr (oben, dünner, glänzend hell) — läuft bis über den Steuerkopf.
  rohr(
    tauchOben.x,
    tauchOben.y,
    standOben.x,
    standOben.y,
    0.056 * m,
    0.056 * m,
    FARBEN.federHell,
  );
  // Untere Brücke, direkt unter dem Steuerrohr. Etwas massiver als beim
  // ersten Wurf (0,05 m → 0,062 m dick, ±0,085 m → ±0,095 m breit), damit
  // sie klar als eigenes Bauteil auffällt statt als bloße Rohrverdickung.
  rohr(
    gabelOben.x - 0.095 * m,
    gabelOben.y + 0.02 * m,
    gabelOben.x + 0.095 * m,
    gabelOben.y + 0.005 * m,
    0.062 * m,
    0.062 * m,
    FARBEN.rahmenDunkel,
  );
  // **Obere Brücke** — das Erkennungsmerkmal der Doppelbrückengabel,
  // ebenfalls etwas kräftiger als zuvor.
  rohr(
    standOben.x - 0.095 * m,
    standOben.y + 0.015 * m,
    standOben.x + 0.095 * m,
    standOben.y,
    0.055 * m,
    0.055 * m,
    FARBEN.rahmenDunkel,
  );

  // --- Hinterbau: Kettenstrebe und Sitzstrebe ---
  rohr(
    tretlager.x,
    tretlager.y,
    hintenX,
    nabeHinten,
    0.055 * m,
    0.035 * m,
    FARBEN.rahmenDunkel,
  );
  const sitzstrebeOben = { x: sattel.x + 0.1 * m, y: sattel.y + 0.2 * m };
  rohr(
    hintenX,
    nabeHinten,
    sitzstrebeOben.x,
    sitzstrebeOben.y,
    0.032 * m,
    0.042 * m,
    FARBEN.rahmenDunkel,
  );

  // --- Der Dämpfer, sichtbar gestaucht ---
  /*
   * Er sitzt schräg im Hauptdreieck und wird beim Einfedern kürzer. Weil
   * `sitzstrebeOben` am Hinterbau hängt und der mit `wegHinten` schwingt,
   * ergibt sich die Stauchung von selbst — sie muss nicht extra gerechnet
   * werden.
   */
  const daempferA = { x: tretlager.x - 0.04 * m, y: tretlager.y - 0.14 * m };
  const daempferB = { x: sattel.x + 0.16 * m, y: sattel.y + 0.3 * m };
  // Der Dämpferkörper selbst wird **zwischen** den beiden Federhälften
  // gezeichnet, siehe unten — nicht hier davor.
  /*
   * --- Die Schraubenfeder um den Dämpfer ---
   *
   * Ronni: „hinten eine Spirale." Sie ist als echte Wendel gezeichnet,
   * nicht als Zickzack: Jede Windung ist ein halber Bogen, dessen Breite
   * quer zum Dämpfer steht. Dadurch sieht man beim Einfedern, wie die
   * Windungen **enger zusammenrücken** — genau das macht eine Feder
   * sichtbar, ein Zickzack tut das nicht.
   */
  const fedDx = daempferB.x - daempferA.x;
  const fedDy = daempferB.y - daempferA.y;
  const fedLen = Math.hypot(fedDx, fedDy) || 1;
  const ux = fedDx / fedLen;
  const uy = fedDy / fedLen;
  // Einheitsvektor quer zur Federachse.
  const qx = -uy;
  const qy = ux;
  const fedRadius = 0.1 * m;
  /**
   * **Die Windungszahl ist fest — nur der Abstand ändert sich.**
   *
   * Das ist der ganze Unterschied zwischen „Feder" und „Gummiband". Beim
   * Einfedern rücken die Windungen zusammen, es werden nie weniger. Die
   * erste Fassung interpolierte stattdessen die Punkte über die
   * Dämpferlänge — dabei wurde die Feder beim Einfedern nur kürzer, und
   * genau die Bewegung, die man sehen will, fehlte.
   */
  const windungen = 6;
  const federPunkte: { x: number; y: number; tiefe: number }[] = [];
  const schritte = windungen * 14;
  for (let i = 0; i <= schritte; i++) {
    const t = i / schritte;
    const winkel = t * windungen * Math.PI * 2;
    federPunkte.push({
      x: daempferA.x + ux * (t * fedLen) + qx * Math.cos(winkel) * fedRadius,
      y: daempferA.y + uy * (t * fedLen) + qy * Math.cos(winkel) * fedRadius,
      // Größer null heißt: diese Windung läuft gerade vor dem Dämpfer
      // vorbei, kleiner null dahinter.
      tiefe: Math.sin(winkel),
    });
  }

  /*
   * In drei Lagen zeichnen: hintere Windungshälften, dann der
   * Dämpferkörper, dann die vorderen. Erst dadurch wickelt sich die Feder
   * sichtbar **um** den Dämpfer, statt daneben zu liegen.
   */
  const federTeil = (vorne: boolean, farbe: string, dicke: number) => {
    ctx.strokeStyle = farbe;
    ctx.lineWidth = dicke;
    ctx.lineCap = 'round';
    let offen = false;
    ctx.beginPath();
    for (const p of federPunkte) {
      const dran = vorne ? p.tiefe >= 0 : p.tiefe < 0;
      if (!dran) {
        // Am Vorzeichenwechsel den Strich absetzen, sonst zieht eine
        // Linie quer durch den Dämpfer.
        if (offen) {
          ctx.stroke();
          ctx.beginPath();
          offen = false;
        }
        continue;
      }
      if (!offen) {
        ctx.moveTo(p.x, p.y);
        offen = true;
      } else ctx.lineTo(p.x, p.y);
    }
    if (offen) ctx.stroke();
  };

  // Etwas kräftiger als beim ersten Wurf (Dicke + vorderer Multiplikator
  // beide angehoben, vorderer Bogen zusätzlich leicht aufgehellt) — die
  // Akzentfarbe soll auf den ersten Blick als Feder erkennbar sein, nicht
  // nur bei genauem Hinsehen.
  const federDicke = Math.max(2, 0.034 * m);
  federTeil(false, mischen(FARBEN.akzent, '#000000', 0.42), federDicke);
  rohr(daempferA.x, daempferA.y, daempferB.x, daempferB.y, 0.05 * m, 0.05 * m, FARBEN.federDunkel);
  federTeil(true, mischen(FARBEN.akzent, '#ffffff', 0.08), federDicke * 1.3);

  // Federteller oben und unten — ohne sie schwebt die Wendel frei.
  ctx.fillStyle = '#8d939e';
  for (const p of [daempferA, daempferB]) {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, fedRadius * 1.2, 0.03 * m, Math.atan2(fedDy, fedDx), 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Hauptrahmen: Unterrohr, Oberrohr, Sattelrohr ---
  rohr(
    tretlager.x,
    tretlager.y,
    steuerkopf.x,
    steuerkopf.y + 0.14 * m,
    0.07 * m,
    0.055 * m,
    FARBEN.rahmen,
  );
  /*
   * Dünner Teal-Akzentstreifen aufs Unterrohr — sitzt auf derselben
   * Lichtseite wie `rohr()`s Glanzband, damit er wie aufgeklebt wirkt
   * statt wie eine zweite Kontur.
   */
  {
    const ax = tretlager.x;
    const ay = tretlager.y;
    const bx = steuerkopf.x;
    const by = steuerkopf.y + 0.14 * m;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const seite = nx * -0.55 + ny * -0.84 >= 0 ? 1 : -1;
    const off = 0.07 * m * 0.45 * seite;
    ctx.strokeStyle = FARBEN.akzent;
    ctx.lineWidth = Math.max(1.2, 0.07 * m * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax + nx * off, ay + ny * off);
    ctx.lineTo(bx + nx * off, by + ny * off);
    ctx.stroke();
  }
  rohr(
    sattel.x,
    sattel.y,
    steuerkopf.x,
    steuerkopf.y,
    0.055 * m,
    0.05 * m,
    FARBEN.rahmen,
  );
  rohr(
    tretlager.x,
    tretlager.y,
    sattel.x,
    sattel.y,
    0.05 * m,
    0.042 * m,
    FARBEN.rahmen,
  );
  // Steuerrohr.
  rohr(
    steuerkopf.x,
    steuerkopf.y - 0.02 * m,
    gabelOben.x,
    gabelOben.y,
    0.055 * m,
    0.05 * m,
    FARBEN.rahmen,
  );

  /*
   * --- Sattel ---
   * Eine erkennbare Sattelform statt einer reinen Ellipse: hinten breiter
   * für die Sitzfläche, mit rundem Heck, vorn spitz zulaufend zur Nase —
   * die Nase zeigt zum Lenker, wie bei einem echten Sattel.
   */
  {
    const sx = sattel.x - 0.02 * m;
    const sy = sattel.y - 0.04 * m;
    const rot = -0.12;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    // Punkt im sattel-eigenen Koordinatensystem: lx nach vorn (zur Nase),
    // ly quer zur Sitzfläche.
    const pt = (lx: number, ly: number) => ({
      x: sx + lx * cos - ly * sin,
      y: sy + lx * sin + ly * cos,
    });
    const heck = pt(-0.15 * m, 0);
    const hintenO = pt(-0.11 * m, -0.05 * m);
    const hintenU = pt(-0.11 * m, 0.05 * m);
    const mitteO = pt(0.04 * m, -0.045 * m);
    const mitteU = pt(0.04 * m, 0.045 * m);
    const naseO = pt(0.15 * m, -0.014 * m);
    const naseU = pt(0.15 * m, 0.014 * m);
    const naseSpitze = pt(0.19 * m, 0);

    ctx.fillStyle = '#1a1a20';
    ctx.beginPath();
    ctx.moveTo(hintenO.x, hintenO.y);
    ctx.quadraticCurveTo(heck.x, heck.y, hintenU.x, hintenU.y);
    ctx.quadraticCurveTo(mitteU.x, mitteU.y, naseU.x, naseU.y);
    ctx.quadraticCurveTo(naseSpitze.x, naseSpitze.y, naseO.x, naseO.y);
    ctx.quadraticCurveTo(mitteO.x, mitteO.y, hintenO.x, hintenO.y);
    ctx.closePath();
    ctx.fill();
  }

  // --- Lenker und Vorbau ---
  // Der Vorbau sitzt auf der **oberen** Brücke, nicht am Steuerkopf —
  // bei einer Doppelbrückengabel ist das der einzige Platz dafür.
  const lenker = { x: standOben.x + 0.06 * m, y: standOben.y - 0.16 * m };
  rohr(
    standOben.x,
    standOben.y - 0.01 * m,
    lenker.x,
    lenker.y,
    0.038 * m,
    0.032 * m,
    FARBEN.federDunkel,
  );
  ctx.fillStyle = '#101014';
  ctx.beginPath();
  ctx.arc(lenker.x, lenker.y, 0.055 * m, 0, Math.PI * 2);
  ctx.fill();

  // --- Antrieb: Kettenblatt, Kurbel, Pedal, Kette ---
  ctx.fillStyle = '#7a8089';
  ctx.beginPath();
  ctx.arc(tretlager.x, tretlager.y, 0.11 * m, 0, Math.PI * 2);
  ctx.fill();
  // Kassette am Hinterrad.
  ctx.fillStyle = '#7a8089';
  ctx.beginPath();
  ctx.arc(hintenX, nabeHinten, 0.07 * m, 0, Math.PI * 2);
  ctx.fill();
  // Die Kette als zwei Trume zwischen beiden.
  ctx.strokeStyle = '#4c525b';
  ctx.lineWidth = Math.max(1, 0.022 * m);
  ctx.beginPath();
  ctx.moveTo(tretlager.x, tretlager.y - 0.1 * m);
  ctx.lineTo(hintenX, nabeHinten - 0.065 * m);
  ctx.moveTo(tretlager.x, tretlager.y + 0.1 * m);
  ctx.lineTo(hintenX, nabeHinten + 0.065 * m);
  ctx.stroke();

  /*
   * Die Kurbel dreht sich mit dem Tempo — mit deutlich kleinerem Faktor
   * als die Laufräder selbst (0,55 → 0,22). Rückmeldung: „Die
   * Beinbewegung kann langsamer sein, das sieht sehr komisch aus, wenn
   * es so megaschnell ist." Bei voller Fahrt drehte die Kurbel vorher
   * über drei Umdrehungen je Sekunde — nach dem Umbau auf die jetzt viel
   * kräftigere, sichtbarere Beinform (siehe unten) las sich das nicht
   * mehr als Treten, sondern als Zittern. Real tritt niemand deutlich
   * über zwei Umdrehungen je Sekunde; 0,22 bleibt selbst bei Höchsttempo
   * knapp darunter.
   */
  const pedalWinkel = radDrehung * 0.22;
  const pedalX = tretlager.x + Math.cos(pedalWinkel) * 0.17 * m;
  const pedalY = tretlager.y + Math.sin(pedalWinkel) * 0.17 * m;
  rohr(
    tretlager.x,
    tretlager.y,
    pedalX,
    pedalY,
    0.028 * m,
    0.025 * m,
    '#3a3f47',
  );
  ctx.fillStyle = '#22252a';
  ctx.fillRect(pedalX - 0.055 * m, pedalY - 0.018 * m, 0.11 * m, 0.036 * m);

  // ---------------------------------------------------------------
  // Der Fahrer
  // ---------------------------------------------------------------
  /*
   * Die Haltung folgt dem, was passiert: In der Luft und bei harter
   * Landung geht der Fahrer tief, sonst steht er über dem Sattel. `hocke`
   * ist das eine Maß dafür.
   */
  /*
   * **Der Fahrer ist aus Körperformen gebaut, nicht aus Rohren.**
   *
   * Rückmeldung: „Ich will, dass der Mensch deutlich menschlicher
   * aussieht." Vorher liefen Rumpf, Arme und Beine durch dieselbe
   * `rohr()`-Funktion wie der Rahmen — mit demselben Metallglanz und
   * derselben harten Kontur. Ein Körper hat aber keine Rohre: Der Rumpf
   * ist an den Schultern breit und an der Taille schmal, Gliedmaßen sind
   * am Ansatz dicker als am Gelenk, und alle Übergänge sind rund.
   *
   * Deshalb bekommt der Fahrer eine eigene `glied()`-Funktion mit runden
   * Enden und einen Rumpf als geschlossenen Umriss.
   */
  const hocke = Math.min(1, (federVorn + federHinten) * 0.5 + (lauf.amBoden ? 0 : 0.4));
  const huefte = { x: sattel.x + 0.1 * m, y: sattel.y - 0.14 * m + hocke * 0.13 * m };
  const schulter = { x: huefte.x + 0.36 * m, y: huefte.y - 0.5 * m + hocke * 0.17 * m };
  const kopf = { x: schulter.x + 0.15 * m, y: schulter.y - 0.25 * m };

  /** Ein Körperglied: weiche Kapsel mit runden Enden, kein Metallrohr. */
  const glied = (
    ax: number,
    ay: number,
    bx2: number,
    by2: number,
    dickeA: number,
    dickeB: number,
    farbe: string,
  ) => {
    const dx = bx2 - ax;
    const dy = by2 - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const winkel = Math.atan2(dy, dx);
    ctx.beginPath();
    // Halbkreis am Ansatz, gerade Seiten, Halbkreis am Gelenk — das ist
    // der Unterschied zwischen Arm und Rohr.
    ctx.arc(ax, ay, dickeA, winkel + Math.PI / 2, winkel - Math.PI / 2);
    ctx.lineTo(bx2 + nx * -dickeB, by2 + ny * -dickeB);
    ctx.arc(bx2, by2, dickeB, winkel - Math.PI / 2, winkel + Math.PI / 2);
    ctx.closePath();
    ctx.strokeStyle = '#12141a';
    ctx.lineWidth = Math.max(1.2, dickeA * 0.3);
    ctx.lineJoin = 'round';
    ctx.stroke();
    // Weicher Verlauf quer zum Glied — heller oben, dunkler unten.
    const gg = ctx.createLinearGradient(
      (ax + bx2) / 2 + nx * dickeA,
      (ay + by2) / 2 + ny * dickeA,
      (ax + bx2) / 2 - nx * dickeA,
      (ay + by2) / 2 - ny * dickeA,
    );
    gg.addColorStop(0, mischen(farbe, '#ffffff', 0.28));
    gg.addColorStop(0.55, farbe);
    gg.addColorStop(1, mischen(farbe, '#000000', 0.35));
    ctx.fillStyle = gg;
    ctx.fill();
  };

  /*
   * Ein Gelenk: runde Scheibe mit demselben Licht-Schatten-Verlauf wie
   * `glied()`, nicht mehr eine flache Einfarb-Fläche.
   *
   * Rückmeldung: „Der Mensch sieht immer noch schlecht aus." Die
   * ursprünglichen Gelenkscheiben (Schulter, Hüfte, Knie, Ellbogen) waren
   * jede für sich ein reiner `fillStyle`-Kreis ohne Verlauf — direkt neben
   * den weich schattierten Gliedern (`glied()`) und dem Rumpf (eigener
   * Verlauf) fiel das als aufgesetzte, flache „Kugel" auf, nicht als
   * Gelenk aus demselben Material. Ein Radialverlauf mit Licht oben links
   * behebt genau das, unabhängig vom Winkel der angrenzenden Glieder.
   */
  const gelenkKugel = (mx: number, my: number, radius: number, farbe: string) => {
    const gk = ctx.createRadialGradient(
      mx - radius * 0.35,
      my - radius * 0.35,
      radius * 0.1,
      mx,
      my,
      radius,
    );
    gk.addColorStop(0, mischen(farbe, '#ffffff', 0.32));
    gk.addColorStop(0.65, farbe);
    gk.addColorStop(1, mischen(farbe, '#000000', 0.32));
    ctx.beginPath();
    ctx.arc(mx, my, radius, 0, Math.PI * 2);
    ctx.fillStyle = gk;
    ctx.fill();
  };

  /*
   * **Zwei-Knochen-IK für Arm und Bein.**
   *
   * Vorher stand das Gelenk (Ellbogen/Knie) an einem festen Versatz von
   * der Basis (Schulter/Hüfte) — das zweite Segment musste dann in der
   * Länge „atmen", um trotzdem am beweglichen Ziel (Lenker, Pedal)
   * anzukommen, das sich mit Federung und Kurbelumlauf unabhängig bewegt.
   * Bei genauem Hinsehen sieht das wie ein Gummiglied aus, nicht wie ein
   * Gelenk. Diese Funktion hält beide Segmentlängen fest und berechnet
   * die Gelenkposition über den Kosinussatz — dieselbe Formel, die auch
   * im echten Kosinussatz-Dreieck aus Ober- und Untersegment plus
   * Ziel-Abstand steckt. `biegung` legt fest, auf welcher Seite der
   * direkten Basis-Ziel-Linie das Gelenk liegt, damit es nicht bei jedem
   * Bild zufällig auf die andere Seite springen kann.
   */
  const zweiKnochenIK = (
    basisX: number,
    basisY: number,
    zielX: number,
    zielY: number,
    laenge1: number,
    laenge2: number,
    biegung: 1 | -1,
  ) => {
    const dx = zielX - basisX;
    const dy = zielY - basisY;
    const dRoh = Math.hypot(dx, dy) || 0.0001;
    // Nie weiter strecken oder stauchen, als die beiden Segmente hergeben.
    const d = Math.min(laenge1 + laenge2 - 0.001, Math.max(Math.abs(laenge1 - laenge2) + 0.001, dRoh));
    const zielWinkel = Math.atan2(dy, dx);
    const cosInnen = (laenge1 * laenge1 + d * d - laenge2 * laenge2) / (2 * laenge1 * d);
    const innenWinkel = Math.acos(Math.min(1, Math.max(-1, cosInnen)));
    const gelenkWinkel = zielWinkel + biegung * innenWinkel;
    return { x: basisX + Math.cos(gelenkWinkel) * laenge1, y: basisY + Math.sin(gelenkWinkel) * laenge1 };
  };

  /*
   * --- Bein: Hüfte → Knie → Pedal ---
   *
   * **Reine Zwei-Knochen-IK mit fester Biegerichtung reicht hier nicht.**
   * Anders als der Lenker (der ungefähr an einem Fleck bleibt) läuft das
   * Pedal einmal ganz im Kreis um das Tretlager herum — eine feste
   * Biegeseite relativ zur (mitdrehenden) Hüfte-Pedal-Linie heißt dann,
   * dass das Knie einmal je Kurbelumdrehung auf die andere Seite
   * umklappt. Rückmeldung: „Die Bewegung vom Bein ist unnatürlich … das
   * soll nicht die ganze Zeit umknicken." Ein echtes Knie beugt sich
   * dagegen immer zur selben Seite (nach oben/vorn, nie nach unten
   * durch). Deshalb werden **beide** Lösungen des Kosinussatzes
   * berechnet und die mit dem kleineren `y` (in Bildschirmkoordinaten:
   * die höher liegende) genommen — das ist genau die Seite, zu der ein
   * Knie beim Treten tatsächlich ausweicht, ganz gleich wo das Pedal
   * gerade steht. Am Punkt völliger Streckung fallen beide Lösungen
   * ohnehin zusammen, der Wechsel ist dort unsichtbar.
   */
  const OBERSCHENKEL = 0.4 * m;
  const UNTERSCHENKEL = 0.36 * m;
  const pedalZielY = pedalY - 0.04 * m;
  const knieA = zweiKnochenIK(huefte.x, huefte.y, pedalX, pedalZielY, OBERSCHENKEL, UNTERSCHENKEL, 1);
  const knieB = zweiKnochenIK(huefte.x, huefte.y, pedalX, pedalZielY, OBERSCHENKEL, UNTERSCHENKEL, -1);
  const knie = knieA.y <= knieB.y ? knieA : knieB;
  glied(huefte.x, huefte.y, knie.x, knie.y, 0.115 * m, 0.086 * m, FARBEN.hose);
  glied(knie.x, knie.y, pedalX, pedalZielY, 0.084 * m, 0.064 * m, FARBEN.hose);
  // Kleine Gelenkscheibe am Knie — ohne sie liest sich der Übergang
  // zwischen den beiden Bein-Kapseln als Knick, nicht als Gelenk.
  gelenkKugel(knie.x, knie.y, 0.09 * m, FARBEN.hose);
  // Schuh: Sohle und Spann getrennt, damit er nicht wie ein Klumpen wirkt.
  ctx.fillStyle = '#15161b';
  ctx.beginPath();
  ctx.ellipse(pedalX + 0.024 * m, pedalY - 0.05 * m, 0.1 * m, 0.058 * m, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a0b0e';
  ctx.fillRect(pedalX - 0.07 * m, pedalY - 0.017 * m, 0.19 * m, 0.032 * m);

  /*
   * --- Der Rumpf als geschlossener Umriss ---
   *
   * Vier Punkte, mit Kurven verbunden: breite Schulter, eingezogene
   * Taille auf der Bauchseite, gewölbter Rücken. Eine gerade Kapsel von
   * Hüfte zu Schulter — wie vorher — liest sich als Rohr; erst die
   * unterschiedliche Wölbung von Vorder- und Rückseite macht daraus
   * einen Oberkörper.
   *
   * **Rumpftiefe deutlich größer als vorher** (`breitSchulter` 0,15 m →
   * 0,24 m, `breitHuefte` 0,115 m → 0,17 m) — Rückmeldung: „Der Fahrer
   * muss echt besser aussehen … das ist noch so ein kleines
   * Strichmännchen, viel breiter mit Schultern." In der Seitenansicht
   * dieses Spiels ist „breite Schultern" keine Links-Rechts-Breite (die
   * sieht man von der Seite nie), sondern die Tiefe des Rumpfs an dieser
   * Stelle — genau der Wert, der hier wächst.
   */
  const rDx = schulter.x - huefte.x;
  const rDy = schulter.y - huefte.y;
  const rLen = Math.hypot(rDx, rDy) || 1;
  const rNx = -rDy / rLen;
  const rNy = rDx / rLen;
  const breitSchulter = 0.24 * m;
  const breitHuefte = 0.17 * m;
  ctx.beginPath();
  ctx.moveTo(huefte.x + rNx * breitHuefte, huefte.y + rNy * breitHuefte);
  // Rückenseite: nach außen gewölbt.
  ctx.quadraticCurveTo(
    (huefte.x + schulter.x) / 2 + rNx * breitSchulter * 1.35,
    (huefte.y + schulter.y) / 2 + rNy * breitSchulter * 1.35,
    schulter.x + rNx * breitSchulter,
    schulter.y + rNy * breitSchulter,
  );
  ctx.arc(
    schulter.x,
    schulter.y,
    breitSchulter,
    Math.atan2(rNy, rNx),
    Math.atan2(-rNy, -rNx),
    false,
  );
  // Bauchseite: leicht eingezogen.
  ctx.quadraticCurveTo(
    (huefte.x + schulter.x) / 2 - rNx * breitHuefte * 0.75,
    (huefte.y + schulter.y) / 2 - rNy * breitHuefte * 0.75,
    huefte.x - rNx * breitHuefte,
    huefte.y - rNy * breitHuefte,
  );
  ctx.closePath();
  ctx.strokeStyle = '#12141a';
  ctx.lineWidth = Math.max(1.5, 0.032 * m);
  ctx.lineJoin = 'round';
  ctx.stroke();
  const rumpfG = ctx.createLinearGradient(
    (huefte.x + schulter.x) / 2 + rNx * breitSchulter,
    (huefte.y + schulter.y) / 2 + rNy * breitSchulter,
    (huefte.x + schulter.x) / 2 - rNx * breitSchulter,
    (huefte.y + schulter.y) / 2 - rNy * breitSchulter,
  );
  rumpfG.addColorStop(0, mischen(FARBEN.kleidung, '#ffffff', 0.3));
  rumpfG.addColorStop(0.5, FARBEN.kleidung);
  rumpfG.addColorStop(1, mischen(FARBEN.kleidung, '#000000', 0.4));
  ctx.fillStyle = rumpfG;
  ctx.fill();

  /*
   * Teal-Akzentstreifen aufs Trikot — dieselbe Akzentfarbe wie am
   * Unterrohr und am Tauchrohr des Rads. Rückmeldung: „Der Mensch sieht
   * immer noch schlecht aus." Ein Grund dafür: Kleidung, Hose und die
   * (jetzt schattierten) Gelenke sind alle nah beieinanderliegende
   * Grautöne — der Rumpf liest sich als einfarbige Fläche, nicht als
   * Kleidungsstück. Ein einzelner diagonaler Streifen über die Bauchseite
   * bricht das auf und verbindet Fahrer und Rad optisch, ohne dass die
   * Silhouette selbst angefasst werden muss.
   */
  {
    const t1 = 0.22;
    const t2 = 0.62;
    const p1x = huefte.x + rDx * t1 - rNx * breitHuefte * 0.55;
    const p1y = huefte.y + rDy * t1 - rNy * breitHuefte * 0.55;
    const p2x = huefte.x + rDx * t2 - rNx * breitSchulter * 0.5;
    const p2y = huefte.y + rDy * t2 - rNy * breitSchulter * 0.5;
    ctx.strokeStyle = FARBEN.akzent;
    ctx.lineWidth = Math.max(2, 0.045 * m);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.stroke();
  }

  /*
   * Hals — ohne ihn sitzt der Helm direkt auf den Schultern.
   *
   * **Muss vor Schulterscheibe und Arm gezeichnet werden, nicht danach.**
   * Rückmeldung zum ersten Versuch: „Der Hals guckt raus, er sitzt jetzt
   * vor der Schulter." Genau das passiert, wenn der Hals **nach** dem Arm
   * gezeichnet wird — seine helle Hautfarbe malt sich dann über den
   * Schulteransatz des Arms und wirkt wie ein Fremdkörper davor. Jetzt
   * kommt der Hals gleich nach dem Rumpf; Schulterscheibe, Rückenprotektor
   * und Arm werden alle **danach** gezeichnet und übermalen seinen Ansatz
   * wieder — sichtbar bleibt nur das kurze Stück zwischen Kragen und Helm.
   */
  glied(
    schulter.x + 0.01 * m,
    schulter.y + 0.05 * m,
    kopf.x - 0.02 * m,
    kopf.y + 0.03 * m,
    0.08 * m,
    0.075 * m,
    FARBEN.haut,
  );
  // Kragen: ein Streifen Trikotfarbe, der am Halsansatz hochsteht — auch
  // er liegt unter der Schulterscheibe und dem Arm, deckt also nur noch
  // den Übergang zwischen Rumpf und dem sichtbaren Halsstück ab.
  ctx.beginPath();
  ctx.ellipse(
    schulter.x + 0.02 * m,
    schulter.y + 0.02 * m,
    0.11 * m,
    0.06 * m,
    Math.atan2(rDy, rDx),
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = mischen(FARBEN.kleidung, '#000000', 0.08);
  ctx.fill();

  /*
   * **Gelenkscheiben an Hüfte und Schulter.**
   *
   * Rückmeldung: „Bei dem Fahrer gibt's einen Fehler, an der Schulter ist
   * dann kurz nichts, da ist was raus." Der Grund: Der Rumpf rundet die
   * Schulter nur über einen Halbkreis ab (die andere Hälfte gehört den
   * Kurven zur Hüfte), und das Bein hört an der Hüfte mit einer geraden
   * Kante auf (`closePath()` zieht dort nur eine Sehne, keinen Bogen).
   * Arm- und Beinansatz decken mit ihrer eigenen Rundung zwar das meiste
   * davon ab, aber nicht den ganzen Kreis — übrig blieb ein schmaler
   * Keil, durch den der Himmel durchschien. Eine einfache gefüllte
   * Scheibe an beiden Gelenken, unter Arm/Hals bzw. schon unter dem Bein
   * gezeichnet, schließt die Lücke unabhängig vom genauen Winkel — robuster
   * als die Kurven noch enger aneinander zu ziehen, das nur bei genau
   * dieser Körperhaltung gepasst hätte.
   */
  // Radius jeweils etwas größer als der Kapsel-Ansatz an dieser Stelle
  // (Bein 0,115 m, Arm 0,10 m) — sonst reicht die Scheibe selbst nicht
  // bis zum sichtbaren Rand der jetzt dickeren Gliedmaßen und die Lücke
  // wird größer statt kleiner. `gelenkKugel()` statt einer flachen
  // Scheibe, siehe die Herleitung dort.
  gelenkKugel(huefte.x, huefte.y, 0.135 * m, FARBEN.kleidung);
  gelenkKugel(schulter.x, schulter.y, 0.115 * m, FARBEN.kleidung);

  // Rückenprotektor, als aufgesetzte Platte auf dem Rücken.
  ctx.fillStyle = 'rgba(20,22,28,0.55)';
  ctx.beginPath();
  ctx.ellipse(
    (huefte.x + schulter.x) / 2 + rNx * 0.06 * m,
    (huefte.y + schulter.y) / 2 + rNy * 0.06 * m,
    0.17 * m,
    0.085 * m,
    Math.atan2(rDy, rDx),
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // --- Arm: Schulter → Ellbogen → Lenker, dieselbe Zwei-Knochen-IK ---
  const OBERARM = 0.3 * m;
  const UNTERARM = 0.27 * m;
  const ellbogen = zweiKnochenIK(schulter.x, schulter.y, lenker.x, lenker.y, OBERARM, UNTERARM, 1);
  glied(schulter.x, schulter.y, ellbogen.x, ellbogen.y, 0.1 * m, 0.076 * m, FARBEN.kleidung);
  glied(ellbogen.x, ellbogen.y, lenker.x, lenker.y, 0.074 * m, 0.06 * m, FARBEN.kleidung);
  // Kleine Gelenkscheibe am Ellbogen — dieselbe Überlegung wie am Knie.
  gelenkKugel(ellbogen.x, ellbogen.y, 0.082 * m, FARBEN.kleidung);
  // Handschuh am Lenker.
  ctx.fillStyle = '#2a2d36';
  ctx.strokeStyle = '#12141a';
  ctx.lineWidth = Math.max(1, 0.022 * m);
  ctx.beginPath();
  ctx.arc(lenker.x, lenker.y, 0.075 * m, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  /*
   * --- Der Fullface-Helm ---
   *
   * Rückmeldung: „Der Typ soll einen besseren Helm anhaben." Vorher war es
   * ein Kreis mit einem Fleck davor. Ein Fullface hat drei Merkmale, an
   * denen man ihn erkennt, und alle drei sind hier einzeln gebaut: die
   * Schale mit Nackenschutz hinten, der **Kinnbügel**, der weit nach vorn
   * ragt, und der Schirm oben. Ohne den Kinnbügel ist es ein Halbschalen-
   * helm, ohne den Schirm ein Motorradhelm.
   */
  const hr = 0.2 * m;
  ctx.save();
  ctx.translate(kopf.x, kopf.y);
  // Der Kopf ist leicht nach vorn geneigt — der Fahrer schaut die Strecke
  // hinunter, nicht geradeaus.
  ctx.rotate(0.22);

  // Schale samt Nackenschutz.
  ctx.fillStyle = FARBEN.helm;
  ctx.beginPath();
  ctx.moveTo(-hr * 0.95, hr * 0.2);
  ctx.quadraticCurveTo(-hr * 1.1, -hr * 0.95, 0, -hr * 1.02);
  ctx.quadraticCurveTo(hr * 1.05, -hr * 0.95, hr * 1.0, hr * 0.05);
  ctx.quadraticCurveTo(hr * 0.95, hr * 0.5, hr * 0.5, hr * 0.62);
  ctx.lineTo(-hr * 0.5, hr * 0.72);
  ctx.quadraticCurveTo(-hr * 1.0, hr * 0.7, -hr * 0.95, hr * 0.2);
  ctx.closePath();
  ctx.fill();

  // Der Kinnbügel — das Erkennungsmerkmal.
  ctx.fillStyle = FARBEN.helm;
  ctx.beginPath();
  ctx.moveTo(hr * 0.45, hr * 0.15);
  ctx.quadraticCurveTo(hr * 1.35, hr * 0.3, hr * 1.2, hr * 0.72);
  ctx.quadraticCurveTo(hr * 0.9, hr * 0.9, hr * 0.35, hr * 0.7);
  ctx.closePath();
  ctx.fill();

  // Schattenkante unten, damit die Schale rund wirkt.
  ctx.strokeStyle = FARBEN.helmSchatten;
  ctx.lineWidth = Math.max(1.2, hr * 0.1);
  ctx.beginPath();
  ctx.moveTo(-hr * 0.85, hr * 0.35);
  ctx.quadraticCurveTo(-hr * 0.2, hr * 0.85, hr * 0.5, hr * 0.66);
  ctx.stroke();

  // Visieröffnung.
  ctx.fillStyle = FARBEN.visier;
  ctx.beginPath();
  ctx.moveTo(hr * 0.2, -hr * 0.3);
  ctx.quadraticCurveTo(hr * 1.0, -hr * 0.22, hr * 0.95, hr * 0.18);
  ctx.quadraticCurveTo(hr * 0.5, hr * 0.24, hr * 0.15, hr * 0.12);
  ctx.closePath();
  ctx.fill();

  // Der Schirm oben.
  ctx.fillStyle = FARBEN.rahmen;
  ctx.beginPath();
  ctx.moveTo(hr * 0.05, -hr * 0.82);
  ctx.quadraticCurveTo(hr * 1.15, -hr * 1.0, hr * 1.32, -hr * 0.52);
  ctx.quadraticCurveTo(hr * 0.9, -hr * 0.62, hr * 0.2, -hr * 0.6);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.restore();
}
