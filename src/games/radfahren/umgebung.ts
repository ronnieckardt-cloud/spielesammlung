import { bodenHoehe, lueckeBei, lueckeEnde, lueckeKante } from './logik';
import type { Gelaende } from './logik';
import { mischen } from './farben';

/**
 * Die Umgebung von Flow MTB: Himmel, Boden-Details, Wegmarken.
 *
 * **Eine eiserne Regel, aus drei Rückmeldungen gewachsen:** Der Hintergrund
 * bewegt sich nicht mit. „Ich will gar nicht, dass man den Himmel sieht und
 * dass da Berge und Bäume sind, das sieht doof aus" — später: „Überleg dir
 * für den Hintergrund noch was Cooles, das schön aussieht, aber sich nicht
 * mitbewegt, weil das sonst doof aussieht und irritiert." Himmel, Sonne,
 * Wolken und Sterne stehen deshalb in **Bildschirmkoordinaten**; in ihrer
 * Rechnung kommt kein `kameraX` vor, sie können sich also strukturell nicht
 * mitbewegen. Berge und Bäume gibt es weiterhin nicht.
 *
 * Alles, was zur Strecke gehört und deshalb mitläuft — Gras, Blumen, Steine
 * im Boden, Distanztafeln — steht dagegen in Weltkoordinaten und kommt aus
 * reinen Hashfunktionen der Position (nie `Math.random`): Bei derselben
 * Stelle steht immer dasselbe da, ganz gleich wie das Bild gerade
 * aufgebaut wird.
 *
 * Vier **Umgebungen** (Biome) geben der Strecke einen eigenen Ton. Sie hängen
 * allein an der Saat (`biomVon` in `logik.ts`) und ändern keine Regel.
 */

export type Palette = {
  name: string;
  /** Himmelsverlauf von oben nach unten (Stopps bei 0, 0,42, 0,78, 1). */
  himmel: readonly [string, string, string, string];
  sonne: { x: number; y: number; r: number; kern: string; hof: string; staerke: number };
  wolke: { hell: string; dunkel: string; alpha: number };
  sterne: boolean;
  gras: readonly [string, string, string];
  boden: { saum: string; oben: string; rost: string; tief: string };
  stein: string;
  blumen: readonly string[];
  /** Ein leichter Farbton über dem ganzen Bild (Abendlicht, Mondlicht). */
  grading: string;
  vignette: number;
  nacht: boolean;
};

export const PALETTEN: readonly Palette[] = [
  {
    name: 'Wiese',
    himmel: ['#2f6fb0', '#5faee2', '#a9dcf1', '#e3f4fa'],
    sonne: { x: 0.78, y: 0.15, r: 0.34, kern: '#fffbe8', hof: '#fff1c4', staerke: 1 },
    wolke: { hell: '#ffffff', dunkel: '#c4d9ea', alpha: 0.92 },
    sterne: false,
    gras: ['#5f9a46', '#7bb85a', '#4a8238'],
    boden: { saum: '#b69267', oben: '#8a6a45', rost: '#6d4f33', tief: '#3b2a1a' },
    stein: '#7a7168',
    blumen: ['#ffffff', '#ffd93d', '#ff8fb8', '#b497ff'],
    grading: 'rgba(255,240,210,0.06)',
    vignette: 0.28,
    nacht: false,
  },
  {
    name: 'Abendrot',
    himmel: ['#2d2f6e', '#b5527a', '#f59a68', '#ffd7a0'],
    sonne: { x: 0.68, y: 0.3, r: 0.46, kern: '#fff0c8', hof: '#ff9a52', staerke: 1.35 },
    wolke: { hell: '#ffc2a0', dunkel: '#8e4a74', alpha: 0.85 },
    sterne: false,
    gras: ['#8a9a45', '#a9b455', '#6d7c34'],
    boden: { saum: '#c18a5c', oben: '#8a5a3c', rost: '#6a3f2c', tief: '#2f1c17' },
    stein: '#87624d',
    blumen: ['#ffe28a', '#ffb347', '#ff7a9a'],
    grading: 'rgba(255,150,90,0.12)',
    vignette: 0.34,
    nacht: false,
  },
  {
    name: 'Nacht',
    himmel: ['#050a1f', '#0e1a44', '#1d2f66', '#34508a'],
    sonne: { x: 0.24, y: 0.14, r: 0.2, kern: '#f4f8ff', hof: '#9db8ff', staerke: 0.9 },
    wolke: { hell: '#4a5f94', dunkel: '#1b2850', alpha: 0.5 },
    sterne: true,
    gras: ['#3c6b55', '#4f8a6c', '#2c5240'],
    boden: { saum: '#59627a', oben: '#3b4258', rost: '#2c3144', tief: '#10121b' },
    stein: '#4e5670',
    blumen: ['#7ef0d8', '#a9c1ff'],
    grading: 'rgba(60,90,200,0.14)',
    vignette: 0.42,
    nacht: true,
  },
  {
    name: 'Herbst',
    himmel: ['#4a6f96', '#8fb2c6', '#dcd0b0', '#f6e6c4'],
    sonne: { x: 0.22, y: 0.2, r: 0.36, kern: '#fff6dc', hof: '#ffdc9a', staerke: 1.1 },
    wolke: { hell: '#fff8ea', dunkel: '#cdbfa3', alpha: 0.9 },
    sterne: false,
    gras: ['#b0883b', '#c9a24a', '#8f6a2c'],
    boden: { saum: '#c39a62', oben: '#94603a', rost: '#734528', tief: '#341f14' },
    stein: '#8a6f58',
    blumen: ['#e8742f', '#d94b2b', '#f2b134'],
    grading: 'rgba(255,190,110,0.1)',
    vignette: 0.3,
    nacht: false,
  },
];

/** Alles, was die Zeichnung der Umgebung braucht — ein Bündel statt zwölf Parameter. */
export type Buehne = {
  ctx: CanvasRenderingContext2D;
  breite: number;
  hoehe: number;
  proMeter: number;
  kameraX: number;
  g: Gelaende;
  p: Palette;
  uhr: number;
  bx: (x: number) => number;
  by: (y: number) => number;
};

/** Fester Wert zwischen 0 und 1 aus einer Zahl — dieselbe Eingabe, derselbe Wert. */
export function streu(n: number, k = 0): number {
  const v = Math.sin(n * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

// ---------------------------------------------------------------------
// Himmel — fest am Bildschirm
// ---------------------------------------------------------------------
export function himmelZeichnen(b: Buehne) {
  const { ctx, breite, hoehe, p } = b;
  const himmel = ctx.createLinearGradient(0, 0, 0, hoehe);
  himmel.addColorStop(0, p.himmel[0]);
  himmel.addColorStop(0.42, p.himmel[1]);
  himmel.addColorStop(0.78, p.himmel[2]);
  himmel.addColorStop(1, p.himmel[3]);
  ctx.fillStyle = himmel;
  ctx.fillRect(0, 0, breite, hoehe);

  // Sterne (nur nachts): fest, mit sehr langsamem Funkeln — unter 0,2 Hz.
  if (p.sterne) {
    for (let i = 0; i < 90; i++) {
      const x = streu(i, 1) * breite;
      const y = streu(i, 2) * hoehe * 0.62;
      const gr = 0.6 + streu(i, 3) * 1.4;
      const a = (0.45 + 0.4 * Math.sin(b.uhr * 0.7 + i * 1.7)) * (1 - y / (hoehe * 0.7));
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, a).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, gr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Sonne oder Mond: weicher Hof, dann Scheibe. Der Hof wird addiert, nicht
  // darübergelegt — so leuchtet der Himmel dort, statt dass ein heller Fleck
  // draufliegt.
  const sx = breite * p.sonne.x;
  const sy = hoehe * p.sonne.y;
  const sr = breite * p.sonne.r;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const hof = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
  hof.addColorStop(0, withAlpha(p.sonne.hof, 0.55 * p.sonne.staerke));
  hof.addColorStop(0.35, withAlpha(p.sonne.hof, 0.2 * p.sonne.staerke));
  hof.addColorStop(1, withAlpha(p.sonne.hof, 0));
  ctx.fillStyle = hof;
  ctx.fillRect(0, 0, breite, hoehe);
  ctx.restore();
  const scheibe = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 0.14);
  scheibe.addColorStop(0, p.sonne.kern);
  scheibe.addColorStop(0.8, p.sonne.kern);
  scheibe.addColorStop(1, withAlpha(p.sonne.kern, 0));
  ctx.fillStyle = scheibe;
  ctx.beginPath();
  ctx.arc(sx, sy, sr * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // Lichtstrahlen: drei breite, sehr blasse Keile von der Sonne aus.
  if (!p.nacht) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, br] of [
      [1.9, 0.5],
      [2.15, 0.34],
      [2.45, 0.42],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(w) * hoehe * 1.4 - br * 60, sy + Math.sin(w) * hoehe * 1.4);
      ctx.lineTo(sx + Math.cos(w) * hoehe * 1.4 + br * 60, sy + Math.sin(w) * hoehe * 1.4);
      ctx.closePath();
      ctx.fillStyle = withAlpha(p.sonne.hof, 0.05 * p.sonne.staerke);
      ctx.fill();
    }
    ctx.restore();
  }

  // Wolken: weiche Ballen, oben hell und unten im Schatten — fest am Himmel.
  const wolke = (px: number, py: number, r: number) => {
    const ballen: readonly (readonly [number, number, number])[] = [
      [0, 0, 1],
      [0.85, 0.12, 0.72],
      [-0.8, 0.16, 0.6],
      [0.3, -0.35, 0.62],
      [-0.35, -0.22, 0.5],
    ];
    for (const [dx, dy, k] of ballen) {
      const cx = px + dx * r;
      const cy = py + dy * r;
      const rr = r * k;
      const gr = ctx.createRadialGradient(cx - rr * 0.25, cy - rr * 0.4, rr * 0.1, cx, cy, rr);
      gr.addColorStop(0, withAlpha(p.wolke.hell, p.wolke.alpha));
      gr.addColorStop(0.7, withAlpha(mischen(p.wolke.hell, p.wolke.dunkel, 0.4), p.wolke.alpha * 0.9));
      gr.addColorStop(1, withAlpha(p.wolke.dunkel, p.wolke.alpha * 0.75));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  wolke(breite * 0.24, hoehe * 0.12, 26);
  wolke(breite * 0.7, hoehe * 0.2, 20);
  wolke(breite * 0.48, hoehe * 0.34, 14);
}

/** Hängt einer `#rrggbb`-Farbe einen Alphawert an. */
export function withAlpha(farbe: string, a: number): string {
  const h = farbe.startsWith('#') ? farbe : mischen(farbe, farbe, 0);
  let r = 0;
  let g = 0;
  let bl = 0;
  if (h.startsWith('#')) {
    r = parseInt(h.slice(1, 3), 16);
    g = parseInt(h.slice(3, 5), 16);
    bl = parseInt(h.slice(5, 7), 16);
  } else {
    const t = h.slice(4, -1).split(',').map(Number);
    r = t[0] ?? 0;
    g = t[1] ?? 0;
    bl = t[2] ?? 0;
  }
  return `rgba(${r},${g},${bl},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

// ---------------------------------------------------------------------
// Körnung im Boden — ein Muster, das mit der Welt wandert
// ---------------------------------------------------------------------
const musterZwischenspeicher = new Map<string, HTMLCanvasElement>();

/**
 * Eine kachelbare Körnung für die Erdschichten: feine helle und dunkle Punkte
 * und ein paar Steinchen. Eine flache Farbfläche ist Pappe; Erde hat Korn.
 * Je Umgebung einmal gezeichnet, danach nur noch als Füllmuster benutzt.
 */
export function bodenMuster(p: Palette): HTMLCanvasElement {
  const vorhanden = musterZwischenspeicher.get(p.name);
  if (vorhanden) return vorhanden;
  const S = 192;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const x = c.getContext('2d')!;
  let seed = p.name.length * 7919 + 13;
  const w = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 1100; i++) {
    const hell = w() < 0.45;
    x.fillStyle = hell ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.12)';
    const px = Math.floor(w() * S);
    const py = Math.floor(w() * S);
    const s = w() < 0.2 ? 3 : 2;
    // Auch über den Rand hinaus zeichnen, damit die Kachel nahtlos bleibt.
    for (const dx of [0, -S]) for (const dy of [0, -S]) x.fillRect(px + dx, py + dy, s, s);
  }
  for (let i = 0; i < 26; i++) {
    const px = w() * S;
    const py = w() * S;
    const rx = 2 + w() * 5;
    const ry = rx * (0.6 + w() * 0.3);
    for (const dx of [0, -S]) {
      for (const dy of [0, -S]) {
        x.fillStyle = mischen(p.stein, '#000000', 0.15);
        x.beginPath();
        x.ellipse(px + dx, py + dy, rx, ry, 0, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = 'rgba(255,255,255,0.18)';
        x.beginPath();
        x.ellipse(px + dx - rx * 0.25, py + dy - ry * 0.3, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2);
        x.fill();
      }
    }
  }
  musterZwischenspeicher.set(p.name, c);
  return c;
}

// ---------------------------------------------------------------------
// Gras, Blumen
// ---------------------------------------------------------------------

/**
 * Gras und Blumen entlang der Oberfläche. Kommt aus Hashwerten der
 * Weltposition und setzt an Kickern aus (dort liegt kahle, festgefahrene
 * Erde). Alle Halme einer Farbe werden in **einem** Pfad gestrichen — ein
 * paar hundert Striche je Bild, aber nur drei Zeichenaufrufe.
 */
export function grasZeichnen(b: Buehne, aufKicker: (wx: number) => boolean, sicht: number) {
  const { ctx, proMeter: m, p } = b;
  const von = b.kameraX - sicht * 0.55;
  const bis = b.kameraX + sicht * 0.55;
  const SCHRITT = 0.13;
  const start = Math.floor(von / SCHRITT) * SCHRITT;
  const wind = Math.sin(b.uhr * 1.3) * 0.5;
  for (let f = 0; f < 3; f++) {
    ctx.strokeStyle = p.gras[f]!;
    ctx.lineWidth = Math.max(1, 0.028 * m);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let wx = start; wx < bis; wx += SCHRITT) {
      if (wx <= 14 || aufKicker(wx)) continue;
      const n = Math.round(wx / SCHRITT);
      if (Math.floor(streu(n, 4) * 3) !== f) continue;
      const len = (0.1 + streu(n, 5) * 0.16) * m;
      const lehn = (streu(n, 6) - 0.5) * 0.1 * m + wind * 0.04 * m * (len / (0.26 * m));
      const x0 = b.bx(wx);
      const y0 = b.by(bodenHoehe(b.g, wx)) + 0.02 * m;
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + lehn * 0.4, y0 - len * 0.6, x0 + lehn, y0 - len);
    }
    ctx.stroke();
  }

  // Blumen: dünner Stiel, bunter Kopf.
  const BSCHRITT = 1.05;
  const bstart = Math.floor(von / BSCHRITT) * BSCHRITT;
  for (let wx = bstart; wx < bis; wx += BSCHRITT) {
    if (wx <= 16 || aufKicker(wx)) continue;
    const n = Math.round(wx / BSCHRITT);
    if (streu(n, 7) > 0.5) continue;
    const bx0 = wx + (streu(n, 8) - 0.5) * 0.6;
    const hoeheB = (0.16 + streu(n, 9) * 0.2) * m;
    const x0 = b.bx(bx0);
    const y0 = b.by(bodenHoehe(b.g, bx0)) + 0.02 * m;
    const lehn = Math.sin(b.uhr * 1.6 + n) * 0.025 * m;
    ctx.strokeStyle = p.gras[2]!;
    ctx.lineWidth = Math.max(1, 0.016 * m);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + lehn * 0.3, y0 - hoeheB * 0.55, x0 + lehn, y0 - hoeheB);
    ctx.stroke();
    const farbe = p.blumen[Math.floor(streu(n, 10) * p.blumen.length)]!;
    const kr = (0.034 + streu(n, 11) * 0.03) * m;
    if (p.nacht) {
      // Leuchtpilze: ein Hof um den Kopf.
      const gl = ctx.createRadialGradient(x0 + lehn, y0 - hoeheB, 0, x0 + lehn, y0 - hoeheB, kr * 4);
      gl.addColorStop(0, withAlpha(farbe, 0.55));
      gl.addColorStop(1, withAlpha(farbe, 0));
      ctx.fillStyle = gl;
      ctx.fillRect(x0 + lehn - kr * 4, y0 - hoeheB - kr * 4, kr * 8, kr * 8);
    }
    ctx.fillStyle = farbe;
    ctx.beginPath();
    ctx.arc(x0 + lehn, y0 - hoeheB, kr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(x0 + lehn - kr * 0.3, y0 - hoeheB - kr * 0.3, kr * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------
// Steine im Boden
// ---------------------------------------------------------------------
export function bodenSteine(b: Buehne, aufKicker: (wx: number) => boolean, sicht: number) {
  const { ctx, proMeter: m, p } = b;
  const SCHRITT = 2.4;
  const von = b.kameraX - sicht * 0.55;
  const bis = b.kameraX + sicht * 0.55;
  const start = Math.floor(von / SCHRITT) * SCHRITT;
  for (let wx = start; wx < bis; wx += SCHRITT) {
    if (wx <= 16) continue;
    const n = Math.round(wx / SCHRITT);
    const w = streu(n, 20);
    if (w > 0.7) continue;
    const px = wx + (streu(n, 21) - 0.5) * 1.6;
    const oberfl = bodenHoehe(b.g, px);
    const tiefe = 0.18 + streu(n, 22) * 1.1;
    const rx = (0.07 + streu(n, 23) * 0.2) * m;
    const ry = rx * (0.55 + streu(n, 24) * 0.3);
    const x0 = b.bx(px);
    const y0 = b.by(oberfl) + tiefe * m;
    ctx.fillStyle = mischen(p.stein, '#000000', 0.1 + streu(n, 25) * 0.2);
    ctx.beginPath();
    ctx.ellipse(x0, y0, rx, ry, (streu(n, 26) - 0.5) * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.ellipse(x0 - rx * 0.25, y0 - ry * 0.3, rx * 0.55, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x0 + rx * 0.2, y0 + ry * 0.45, rx * 0.8, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  void aufKicker;
}

// ---------------------------------------------------------------------
// Wegmarken: Distanztafeln, Start, Ziel
// ---------------------------------------------------------------------

/** Eine Distanztafel an einem Holzpfosten. */
function tafel(b: Buehne, wx: number, text: string) {
  const { ctx, proMeter: m } = b;
  const x = b.bx(wx);
  const y = b.by(bodenHoehe(b.g, wx)) + 0.02 * m;
  const pfostenH = 1.05 * m;
  // Pfosten
  const pg = ctx.createLinearGradient(x - 0.04 * m, 0, x + 0.04 * m, 0);
  pg.addColorStop(0, '#b98a58');
  pg.addColorStop(1, '#6b4a2b');
  ctx.fillStyle = pg;
  ctx.fillRect(x - 0.035 * m, y - pfostenH, 0.07 * m, pfostenH);
  // Tafel
  const tw = 0.78 * m;
  const th = 0.38 * m;
  const ty = y - pfostenH - th * 0.2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - tw / 2 + 0.03 * m, ty + 0.03 * m, tw, th);
  ctx.fillStyle = '#f6f2e8';
  ctx.fillRect(x - tw / 2, ty, tw, th);
  ctx.strokeStyle = '#3d6b55';
  ctx.lineWidth = Math.max(1, 0.03 * m);
  ctx.strokeRect(x - tw / 2 + 0.03 * m, ty + 0.03 * m, tw - 0.06 * m, th - 0.06 * m);
  ctx.fillStyle = '#243b34';
  ctx.font = `800 ${Math.max(8, 0.2 * m)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, ty + th / 2 + 0.01 * m);
}

export function wegmarken(b: Buehne, sicht: number) {
  const von = b.kameraX - sicht * 0.55;
  const bis = b.kameraX + sicht * 0.55;
  const laenge = b.g.laenge;
  for (let wx = Math.ceil(von / 100) * 100; wx < bis; wx += 100) {
    if (wx <= 0 || wx >= laenge - 20) continue;
    // Eine Tafel im Graben stünde sieben Meter tiefer im Nichts.
    if (lueckeBei(b.g, wx) || lueckeBei(b.g, wx - 1.5) || lueckeBei(b.g, wx + 1.5)) continue;
    tafel(b, wx, `${wx} m`);
  }
}

/** Start- und Zieltor: zwei Pfosten und ein Banner mit Schachbrett. */
export function tor(b: Buehne, wx: number, ziel: boolean) {
  const { ctx, proMeter: m } = b;
  const x = b.bx(wx);
  const y = b.by(bodenHoehe(b.g, wx)) + 0.02 * m;
  const breiteT = 3.4 * m;
  const hoch = 3.2 * m;
  for (const s of [-1, 1]) {
    const px = x + s * breiteT * 0.5;
    const pg = ctx.createLinearGradient(px - 0.07 * m, 0, px + 0.07 * m, 0);
    pg.addColorStop(0, '#e9edf2');
    pg.addColorStop(1, '#8b95a3');
    ctx.fillStyle = pg;
    ctx.fillRect(px - 0.06 * m, y - hoch, 0.12 * m, hoch);
  }
  // Banner
  const bh = 0.62 * m;
  const by0 = y - hoch;
  ctx.fillStyle = ziel ? '#101418' : '#1d4d5c';
  ctx.fillRect(x - breiteT * 0.5, by0, breiteT, bh);
  if (ziel) {
    const feld = bh / 3;
    const n = Math.round(breiteT / feld);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#f8fafc' : '#111827';
        ctx.fillRect(x - breiteT * 0.5 + i * feld, by0 + j * feld, feld + 0.5, feld + 0.5);
      }
    }
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.font = `800 ${Math.max(9, 0.34 * m)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', x, by0 + bh / 2);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - breiteT * 0.5, by0 + bh, breiteT, 0.05 * m);
}

// ---------------------------------------------------------------------
// Lücken: Graben, Rampe, Warnschild
// ---------------------------------------------------------------------

/**
 * Das Dunkel im Graben. Muss **vor** dem Erdkörper gezeichnet werden: Der Boden
 * deckt nur ab, wo er ist — im Graben läge sonst der Himmel frei, und die
 * Lücke sähe aus wie ein Fenster ins Blaue.
 *
 * Die Oberkante liegt auf der Höhe der **niedrigeren** Seite: Darüber ist
 * offener Himmel (an der Rampe ragt die Kante höher auf), darunter schaut man
 * in den Schnitt der Erde.
 */
export function grabenZeichnen(b: Buehne, sicht: number) {
  const { ctx, proMeter: m, g, p, hoehe } = b;
  const von = b.kameraX - sicht * 0.6;
  const bis = b.kameraX + sicht * 0.6;
  for (const l of g.luecken) {
    const kante = lueckeKante(l);
    const ende = lueckeEnde(l);
    if (ende < von || kante > bis) continue;
    const rand = Math.min(bodenHoehe(g, kante - 1e-4), bodenHoehe(g, ende + 1e-6));
    const x0 = b.bx(kante);
    const x1 = b.bx(ende);
    const yOben = b.by(rand);
    const unten = Math.max(yOben + 80, hoehe + 20);
    const gr = ctx.createLinearGradient(0, yOben, 0, unten);
    gr.addColorStop(0, mischen(p.boden.tief, '#000000', 0.3));
    gr.addColorStop(0.3, mischen(p.boden.tief, '#000000', 0.62));
    gr.addColorStop(1, '#030407');
    ctx.fillStyle = gr;
    ctx.fillRect(x0, yOben, x1 - x0, unten - yOben);

    // Die Wände werfen Schatten in den Graben: Er wirkt tief, nicht wie eine Fläche.
    for (const [xw, richtung] of [
      [x0, 1],
      [x1, -1],
    ] as const) {
      const breiteSchatten = 1.1 * m;
      const sg = ctx.createLinearGradient(xw, 0, xw + richtung * breiteSchatten, 0);
      sg.addColorStop(0, 'rgba(0,0,0,0.6)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(Math.min(xw, xw + richtung * breiteSchatten), yOben, breiteSchatten, unten - yOben);
    }

    // Ein schwacher Lichtstreifen von oben: Dort scheint der Himmel hinein.
    const lg = ctx.createLinearGradient(0, yOben, 0, yOben + 3 * m);
    lg.addColorStop(0, withAlpha(p.himmel[3], 0.16));
    lg.addColorStop(1, withAlpha(p.himmel[3], 0));
    ctx.fillStyle = lg;
    ctx.fillRect(x0, yOben, x1 - x0, 3 * m);
  }
}

/**
 * Die Rampe aus Holz und die Kante: Bretter mit Fugen, eine Kappe in
 * Warnfarben an der Kante, eine helle Lippe an der Gegenseite. Man erkennt eine
 * Lücke schon an der Rampe, bevor man den Graben sieht.
 */
export function rampeZeichnen(b: Buehne, sicht: number) {
  const { ctx, proMeter: m, g } = b;
  const von = b.kameraX - sicht * 0.6;
  const bis = b.kameraX + sicht * 0.6;
  for (const l of g.luecken) {
    const kante = lueckeKante(l);
    const ende = lueckeEnde(l);
    if (ende + l.hang < von || l.x0 > bis) continue;

    // --- Die Rampe ---
    const anfang = l.x0 + 0.4;
    const schritt = Math.max(0.12, 4 / m);
    const oben: [number, number][] = [];
    for (let wx = anfang; wx < kante; wx += schritt) oben.push([b.bx(wx), b.by(bodenHoehe(g, wx))]);
    oben.push([b.bx(kante), b.by(bodenHoehe(g, kante - 1e-4))]);
    const dicke = 0.2 * m;
    ctx.beginPath();
    ctx.moveTo(oben[0]![0], oben[0]![1]);
    for (const [px, py] of oben) ctx.lineTo(px, py);
    for (let i = oben.length - 1; i >= 0; i--) ctx.lineTo(oben[i]![0], oben[i]![1] + dicke);
    ctx.closePath();
    const holz = ctx.createLinearGradient(0, oben[oben.length - 1]![1], 0, oben[oben.length - 1]![1] + dicke * 3);
    holz.addColorStop(0, '#d9a465');
    holz.addColorStop(0.35, '#a8723a');
    holz.addColorStop(1, '#5a3a1c');
    ctx.fillStyle = holz;
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,22,8,0.75)';
    ctx.lineWidth = Math.max(1, 0.035 * m);
    ctx.lineJoin = 'round';
    ctx.stroke();
    // Fugen zwischen den Brettern: alle 0,55 m.
    ctx.strokeStyle = 'rgba(40,22,8,0.55)';
    ctx.lineWidth = Math.max(1, 0.025 * m);
    ctx.beginPath();
    for (let wx = anfang + 0.35; wx < kante - 0.2; wx += 0.55) {
      const y = b.by(bodenHoehe(g, wx));
      ctx.moveTo(b.bx(wx), y);
      ctx.lineTo(b.bx(wx), y + dicke);
    }
    ctx.stroke();
    // Helle Oberkante: das Licht fällt von links oben auf die Bretter.
    ctx.strokeStyle = 'rgba(255,236,190,0.7)';
    ctx.lineWidth = Math.max(1, 0.03 * m);
    ctx.beginPath();
    ctx.moveTo(oben[0]![0], oben[0]![1] - 0.01 * m);
    for (const [px, py] of oben) ctx.lineTo(px, py - 0.01 * m);
    ctx.stroke();

    // --- Die Kappe an der Kante: schräge Warnstreifen ---
    const kx = b.bx(kante);
    const ky = b.by(bodenHoehe(g, kante - 1e-4));
    const kappeH = 0.42 * m;
    ctx.save();
    ctx.beginPath();
    ctx.rect(kx - 0.16 * m, ky - 0.03 * m, 0.16 * m, kappeH);
    ctx.clip();
    ctx.fillStyle = '#ffc928';
    ctx.fillRect(kx - 0.16 * m, ky - 0.03 * m, 0.16 * m, kappeH);
    ctx.strokeStyle = '#1b1b1f';
    ctx.lineWidth = 0.07 * m;
    for (let i = -2; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(kx - 0.3 * m, ky + i * 0.11 * m);
      ctx.lineTo(kx + 0.1 * m, ky + i * 0.11 * m - 0.4 * m);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(30,18,6,0.8)';
    ctx.lineWidth = Math.max(1, 0.03 * m);
    ctx.strokeRect(kx - 0.16 * m, ky - 0.03 * m, 0.16 * m, kappeH);

    // --- Die Gegenseite: eine helle Lippe an der Oberkante der Wand ---
    const gx = b.bx(ende);
    const gy = b.by(bodenHoehe(g, ende + 1e-6));
    ctx.fillStyle = '#e9c88e';
    ctx.fillRect(gx, gy - 0.03 * m, 0.5 * m, 0.1 * m);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(gx, gy + 0.07 * m, 0.5 * m, 0.04 * m);
  }
}

/** Ein Warnschild kurz vor der Rampe: gelbe Raute mit Ausrufezeichen auf einem Pfosten. */
export function warnschilder(b: Buehne, sicht: number) {
  const { ctx, proMeter: m, g } = b;
  const von = b.kameraX - sicht * 0.6;
  const bis = b.kameraX + sicht * 0.6;
  for (const l of g.luecken) {
    const wx = l.x0 - 9;
    if (wx < von - 2 || wx > bis + 2) continue;
    const x = b.bx(wx);
    const y = b.by(bodenHoehe(g, wx)) + 0.02 * m;
    const pfosten = 1.35 * m;
    const pg = ctx.createLinearGradient(x - 0.04 * m, 0, x + 0.04 * m, 0);
    pg.addColorStop(0, '#c9ced6');
    pg.addColorStop(1, '#6b7380');
    ctx.fillStyle = pg;
    ctx.fillRect(x - 0.035 * m, y - pfosten, 0.07 * m, pfosten);
    const r = 0.42 * m;
    const cy = y - pfosten - r * 0.55;
    ctx.save();
    ctx.translate(x, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-r * 0.7 + 0.04 * m, -r * 0.7 + 0.04 * m, r * 1.4, r * 1.4);
    ctx.fillStyle = '#ffc928';
    ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
    ctx.strokeStyle = '#1b1b1f';
    ctx.lineWidth = Math.max(1.5, 0.05 * m);
    ctx.strokeRect(-r * 0.58, -r * 0.58, r * 1.16, r * 1.16);
    ctx.restore();
    ctx.fillStyle = '#1b1b1f';
    ctx.font = `900 ${Math.max(10, 0.46 * m)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x, cy + 0.02 * m);
  }
}
