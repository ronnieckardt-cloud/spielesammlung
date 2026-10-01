import { POP_FENSTER, POP_VOLL, TEMPO_MAX, bodenHoehe, bodenSteigung, lueckeBei, lueckeKante } from './logik';
import type { Lauf } from './logik';
import { mischen } from './farben';
import { streu, withAlpha } from './umgebung';
import type { Buehne } from './umgebung';

/**
 * Was auf der Strecke liegt und was um das Rad herum aufstiebt: Münzen,
 * Boost-Streifen, Absprungmarken, Schatten, Erdbrocken, Funken. Reine
 * Darstellung — `logik.ts` entscheidet, was eingesammelt ist; hier wird nur
 * gezeigt, dass es so ist.
 *
 * **Kein `Math.random`.** Streuung kommt aus einem festen Zahlengenerator
 * (Partikel) oder aus Hashwerten der Position (Strecke). Dasselbe Gesetz wie
 * bei der Spiellogik, hier aus einem anderen Grund: Wer zwei Läufe
 * nebeneinanderlegt, soll dasselbe Bild sehen, wenn dasselbe passiert.
 */

// ---------------------------------------------------------------------
// Münzen
// ---------------------------------------------------------------------

/** Halbmesser einer Münze in Metern — etwas größer als nötig, damit man sie bei Tempo sieht. */
const MUENZ_R = 0.34;

export function muenzenZeichnen(b: Buehne, lauf: Lauf, sicht: number) {
  const { ctx, proMeter: m, g, uhr } = b;
  const von = b.kameraX - sicht * 0.6;
  const bis = b.kameraX + sicht * 0.6;
  const r = MUENZ_R * m;

  // Der Hof um alle sichtbaren Münzen in einem Rutsch (additiv): ein weiches
  // Leuchten, das die Münze vom Hintergrund löst, ohne dass jede einzeln einen
  // eigenen Zeichenmodus braucht.
  const sichtbar: number[] = [];
  for (let i = 0; i < g.muenzen.length; i++) {
    const c = g.muenzen[i]!;
    if (c.x < von || c.x > bis || lauf.geholt.has(i)) continue;
    sichtbar.push(i);
  }
  if (sichtbar.length === 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const i of sichtbar) {
    const c = g.muenzen[i]!;
    const wipp = Math.sin(uhr * 2.2 + i * 0.9) * 0.07;
    const x = b.bx(c.x);
    const y = b.by(c.y + wipp);
    const gl = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4);
    gl.addColorStop(0, 'rgba(255,205,70,0.34)');
    gl.addColorStop(1, 'rgba(255,205,70,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
  }
  ctx.restore();

  for (const i of sichtbar) {
    const c = g.muenzen[i]!;
    const wipp = Math.sin(uhr * 2.2 + i * 0.9) * 0.07;
    const x = b.bx(c.x);
    const y = b.by(c.y + wipp);
    // Die Münze dreht sich um die Hochachse: Breite = |cos|, nie ganz null,
    // damit sie auch von der Kante noch als Münze zu sehen ist.
    const dreh = uhr * 2.6 + i * 0.7;
    const breite = Math.max(0.2, Math.abs(Math.cos(dreh)));
    const vorn = Math.cos(dreh) >= 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(breite, 1);
    // Schlagschatten, leicht versetzt — Licht kommt von oben links.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(r * 0.1, r * 0.12, r, 0, Math.PI * 2);
    ctx.fill();

    const koerper = ctx.createLinearGradient(-r, -r, r, r);
    koerper.addColorStop(0, '#fff3b0');
    koerper.addColorStop(0.45, '#ffc933');
    koerper.addColorStop(1, '#c47a0a');
    ctx.fillStyle = koerper;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a5206';
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.stroke();

    // Prägering und Stern: Auf der Rückseite derselbe Ring, der Stern fehlt
    // — so sieht man beim Drehen, dass die Münze zwei Seiten hat.
    ctx.strokeStyle = 'rgba(255,248,205,0.8)';
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    if (vorn) {
      ctx.fillStyle = 'rgba(147,86,6,0.85)';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const w = (k / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = k % 2 === 0 ? r * 0.46 : r * 0.2;
        const px = Math.cos(w) * rr;
        const py = Math.sin(w) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    // Glanzpunkt oben links.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.2, r * 0.1, -0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------
// Absprungmarken
// ---------------------------------------------------------------------

/**
 * Die Absprungmarken: drei Pfeile auf dem Boden vor jeder Kante, auf der ein Pop
 * etwas bringt. Sie atmen langsam (0,8 Hz) — genug, um das Auge zu führen, weit
 * unter der 1,7-Hz-Grenze. Passierte Marken verblassen.
 *
 * **Vor einer Lücke liegt zusätzlich die Tipp-Zone**: ein leuchtendes Band auf
 * dem Boden, genau so lang wie das Zeitfenster des Pop bei Höchsttempo
 * (`POP_FENSTER` mal `TEMPO_MAX`, gut fünf Meter). Der helle Teil vorn ist das
 * Fenster für den vollen Pop, der blasse davor für den etwas schwächeren. Wer
 * mit dem Vorderrad in das Band fährt und dann antippt, trifft immer — man
 * muss nichts schätzen. Eine Regel, die man erraten muss, fühlt sich unfair an.
 * Solange man sich in der Zone befindet, leuchtet sie stärker.
 */
export function absprungMarken(b: Buehne, lauf: Lauf, sicht: number) {
  const { ctx, proMeter: m, g, uhr } = b;
  const von = b.kameraX - sicht * 0.6;
  const bis = b.kameraX + sicht * 0.6;
  for (const a of g.absprung) {
    if (a < von || a - 6 > bis) continue;
    const istLuecke = g.luecken.some((l) => Math.abs(lueckeKante(l) - a) < 0.01);
    const vorbei = a < lauf.x - 1;
    const atmen = 0.65 + 0.35 * Math.sin(uhr * Math.PI * 1.6);
    const alpha = vorbei ? 0.12 : 0.55 + 0.35 * atmen;

    if (istLuecke && !vorbei) {
      const laengeZone = TEMPO_MAX * POP_FENSTER;
      const laengeVoll = TEMPO_MAX * POP_VOLL;
      const imFenster = lauf.amBoden && lauf.x >= a - lauf.vx * POP_FENSTER && lauf.x < a;
      const staerke = imFenster ? 1 : 0.7 + 0.12 * atmen;
      /*
       * Ein **Lichtvorhang** über dem Boden, kein flaches Band: Er steht senkrecht
       * und ist von weitem zu sehen, auch wenn der Boden dahinter dunkel oder
       * bunt ist. Hinten blass und niedrig (schwächerer Pop), vorn hell und hoch
       * (voller Pop), an der Kante am kräftigsten. Jede Spalte hat ihren eigenen
       * senkrechten Verlauf, damit der Vorhang der Rampe folgt.
       */
      const SPALTEN = 22;
      for (let k = 0; k < SPALTEN; k++) {
        const t = k / SPALTEN;
        const dA = laengeZone * (1 - t);
        const dB = laengeZone * (1 - (k + 1) / SPALTEN);
        const voll = dA <= laengeVoll;
        const wxA = a - dA;
        const wxB = a - dB;
        const yA = b.by(bodenHoehe(g, wxA));
        const yB = b.by(bodenHoehe(g, wxB));
        const hoch = (voll ? 0.5 + 0.9 * (1 - dA / laengeVoll) : 0.28) * m;
        const alphaUnten = (voll ? 0.55 + 0.3 * (1 - dA / laengeVoll) : 0.3) * staerke;
        const yMitte = (yA + yB) / 2;
        const gr = ctx.createLinearGradient(0, yMitte, 0, yMitte - hoch);
        gr.addColorStop(0, `rgba(255,196,40,${Math.min(0.95, alphaUnten * 1.25).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(255,196,40,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(b.bx(wxA), yA + 0.03 * m);
        ctx.lineTo(b.bx(wxB), yB + 0.03 * m);
        ctx.lineTo(b.bx(wxB), yB - hoch);
        ctx.lineTo(b.bx(wxA), yA - hoch);
        ctx.closePath();
        ctx.fill();
      }
      // Ein heller Saum am Boden und Marken an Anfang und Beginn des vollen Fensters.
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,240,170,${(0.85 * staerke).toFixed(3)})`;
      ctx.lineWidth = Math.max(2, 0.07 * m);
      ctx.beginPath();
      for (let k = 0; k <= SPALTEN; k++) {
        const wx = a - laengeZone * (1 - k / SPALTEN);
        const px = b.bx(wx);
        const py = b.by(bodenHoehe(g, wx)) - 0.02 * m;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      for (const [dist, hoeheLinie, al] of [
        [laengeZone, 0.5, 0.65],
        [laengeVoll, 0.9, 0.9],
      ] as const) {
        const wx = a - dist;
        const y = b.by(bodenHoehe(g, wx));
        ctx.strokeStyle = `rgba(255,240,170,${(al * (imFenster ? 1 : 0.85)).toFixed(3)})`;
        ctx.lineWidth = Math.max(2, 0.06 * m);
        ctx.beginPath();
        ctx.moveTo(b.bx(wx), y + 0.02 * m);
        ctx.lineTo(b.bx(wx), y - hoeheLinie * m);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (let k = 0; k < 3; k++) {
      const wx = a - 0.4 - k * 0.62;
      const steigung = bodenSteigung(g, wx);
      const w = -Math.atan(steigung);
      const x = b.bx(wx);
      const y = b.by(bodenHoehe(g, wx)) - 0.035 * m;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(w);
      // Je näher an der Kante, desto heller: Die Pfeile laufen auf sie zu.
      const stufe = 1 - k * 0.22;
      ctx.globalAlpha = Math.min(1, alpha * stufe);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const h = 0.15 * m;
      const t = 0.17 * m;
      // Heller Kern, dunklere Kontur darunter: lesbar auf hellem wie dunklem Grund.
      for (const [farbe, breite] of [
        ['rgba(60,28,0,0.55)', Math.max(3, 0.1 * m)],
        ['#ffc233', Math.max(2, 0.06 * m)],
      ] as const) {
        ctx.strokeStyle = farbe;
        ctx.lineWidth = breite;
        ctx.beginPath();
        ctx.moveTo(-t, -h);
        ctx.lineTo(t * 0.5, 0);
        ctx.lineTo(-t, h);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------
// Boost-Streifen
// ---------------------------------------------------------------------

export function padsZeichnen(b: Buehne, lauf: Lauf, sicht: number) {
  const { ctx, proMeter: m, g, uhr } = b;
  const von = b.kameraX - sicht * 0.6;
  const bis = b.kameraX + sicht * 0.6;
  for (let i = 0; i < g.pads.length; i++) {
    const pad = g.pads[i]!;
    if (pad.x + pad.laenge < von || pad.x > bis) continue;
    const genommen = lauf.padsGenommen.has(i);
    const SCHRITTE = 14;
    // Das Band folgt dem Boden: ein Streifen aus kurzen Teilstücken.
    const oben: [number, number][] = [];
    const unten: [number, number][] = [];
    for (let k = 0; k <= SCHRITTE; k++) {
      const wx = pad.x + (pad.laenge * k) / SCHRITTE;
      const y = b.by(bodenHoehe(g, wx));
      oben.push([b.bx(wx), y - 0.09 * m]);
      unten.push([b.bx(wx), y + 0.02 * m]);
    }
    ctx.save();
    ctx.globalAlpha = genommen ? 0.4 : 1;
    ctx.beginPath();
    ctx.moveTo(oben[0]![0], oben[0]![1]);
    for (const [x, y] of oben) ctx.lineTo(x, y);
    for (let k = unten.length - 1; k >= 0; k--) ctx.lineTo(unten[k]![0], unten[k]![1]);
    ctx.closePath();
    const grund = ctx.createLinearGradient(0, oben[0]![1], 0, unten[0]![1]);
    grund.addColorStop(0, '#16c4d6');
    grund.addColorStop(1, '#0a5d78');
    ctx.fillStyle = grund;
    ctx.fill();
    ctx.strokeStyle = 'rgba(5,40,60,0.7)';
    ctx.lineWidth = Math.max(1, 0.02 * m);
    ctx.stroke();

    // Wandernde Pfeile: eine feste Teilung, die Phase läuft mit der Uhr —
    // 1,1 Pfeile je Sekunde, ruhig genug, um nicht zu stören.
    ctx.clip();
    if (!genommen) {
      const teilung = 0.85;
      const phase = (uhr * 0.95) % 1;
      ctx.strokeStyle = 'rgba(235,252,255,0.95)';
      ctx.lineWidth = Math.max(1.5, 0.045 * m);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let wx = pad.x - teilung + phase * teilung; wx < pad.x + pad.laenge; wx += teilung) {
        if (wx < pad.x - 0.1) continue;
        const x = b.bx(wx);
        const y = b.by(bodenHoehe(g, wx)) - 0.035 * m;
        ctx.beginPath();
        ctx.moveTo(x - 0.1 * m, y - 0.07 * m);
        ctx.lineTo(x + 0.07 * m, y);
        ctx.lineTo(x - 0.1 * m, y + 0.07 * m);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Ein heller Schein über dem Streifen, solange er noch nicht genommen ist.
    if (!genommen) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const mx = b.bx(pad.x + pad.laenge / 2);
      const my = b.by(bodenHoehe(g, pad.x + pad.laenge / 2));
      const gl = ctx.createRadialGradient(mx, my, 0, mx, my, pad.laenge * 0.8 * m);
      gl.addColorStop(0, 'rgba(60,220,255,0.22)');
      gl.addColorStop(1, 'rgba(60,220,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(mx - pad.laenge * 0.8 * m, my - pad.laenge * 0.8 * m, pad.laenge * 1.6 * m, pad.laenge * 1.6 * m);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------
// Schatten
// ---------------------------------------------------------------------

/**
 * Der Schatten des Rades auf dem Boden. Er ist mehr als Zierde: In der Luft
 * zeigt er, **wo man landet** und wie hoch man ist — der Schatten wird mit der
 * Höhe kleiner und blasser. Am Boden sitzt er als kurzer dunkler Fleck unter
 * den Reifen und gibt dem Rad Gewicht.
 *
 * Licht kommt von links oben, der Schatten fällt deshalb ein Stück nach rechts.
 */
export function schattenZeichnen(b: Buehne, lauf: Lauf, radstand: number, groesse: number) {
  const { ctx, proMeter: m, g } = b;
  const hoeheUeber = Math.max(0, lauf.y - bodenHoehe(g, lauf.x));
  const luft = Math.min(1, hoeheUeber / 7);
  const alpha = (lauf.amBoden ? 0.34 : 0.3 * (1 - luft * 0.75)) * (b.p.nacht ? 0.7 : 1);
  if (alpha < 0.02) return;
  const wx = lauf.x + 0.28 + hoeheUeber * 0.12;
  // Über einem Graben fiele der Schatten sieben Meter tiefer — dort zeigt er nichts mehr.
  if (lueckeBei(g, wx)) return;
  const steigung = bodenSteigung(g, wx);
  const bodenY = bodenHoehe(g, wx);
  const breite = radstand * groesse * (1.15 - luft * 0.35) * m;
  ctx.save();
  ctx.translate(b.bx(wx), b.by(bodenY) + 0.02 * m);
  ctx.rotate(-Math.atan(steigung));
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, breite * 0.5);
  gr.addColorStop(0, `rgba(0,0,0,${alpha.toFixed(3)})`);
  gr.addColorStop(0.65, `rgba(0,0,0,${(alpha * 0.55).toFixed(3)})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.scale(1, 0.14);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(0, 0, breite * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------
// Teilchen
// ---------------------------------------------------------------------

type Art = 'erde' | 'funke' | 'ring' | 'staub';
type Teilchen = {
  art: Art;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alter: number;
  leben: number;
  /** Halbmesser in Metern (bei `ring`: der Endhalbmesser). */
  r: number;
  farbe: string;
};

export type Teilchensystem = {
  erde: (x: number, y: number, n: number, tempo: number, farbe: string, stark?: number) => void;
  staub: (x: number, y: number, n: number, farbe: string) => void;
  funken: (x: number, y: number, n: number, farbe: string, stark?: number) => void;
  ring: (x: number, y: number, farbe: string) => void;
  schritt: (dt: number) => void;
  zeichnen: (b: Buehne, art: 'boden' | 'licht') => void;
  leeren: () => void;
};

const MAX_TEILCHEN = 140;

export function teilchensystemBauen(): Teilchensystem {
  let liste: Teilchen[] = [];
  // Fester Zahlengenerator, siehe oben.
  let z = 0x2545f491;
  const zufall = () => {
    z = (Math.imul(z, 1664525) + 1013904223) >>> 0;
    return z / 4294967296;
  };
  const dazu = (t: Teilchen) => {
    liste.push(t);
    if (liste.length > MAX_TEILCHEN) liste.shift();
  };

  return {
    erde(x, y, n, tempo, farbe, stark = 1) {
      // Erdbrocken: kleine, schwere Krümel, die in einem Bogen wegfliegen und
      // die Farbe des Bodens tragen. Keine Wolke — Rückmeldung zur ersten
      // Fassung: „sieht komisch aus".
      for (let i = 0; i < n; i++) {
        dazu({
          art: 'erde',
          x: x + (zufall() - 0.5) * 0.3,
          y: y + 0.04,
          vx: -tempo * (0.12 + zufall() * 0.2) + (zufall() - 0.5) * 2.2 * stark,
          vy: (1.1 + zufall() * 2.2) * stark,
          alter: 0,
          leben: 0.35 + zufall() * 0.3,
          r: 0.028 + zufall() * 0.032,
          farbe: mischen(farbe, zufall() < 0.6 ? '#000000' : '#ffffff', zufall() * 0.18),
        });
      }
    },
    staub(x, y, n, farbe) {
      // Ein weicher Hauch, nur beim echten Einschlag: wenige, blasse Kreise,
      // die langsam aufsteigen.
      for (let i = 0; i < n; i++) {
        dazu({
          art: 'staub',
          x: x + (zufall() - 0.5) * 0.9,
          y: y + 0.05,
          vx: (zufall() - 0.5) * 2.4,
          vy: 0.25 + zufall() * 0.5,
          alter: 0,
          leben: 0.5 + zufall() * 0.25,
          r: 0.09 + zufall() * 0.08,
          farbe,
        });
      }
    },
    funken(x, y, n, farbe, stark = 1) {
      for (let i = 0; i < n; i++) {
        const w = zufall() * Math.PI * 2;
        const v = (1.4 + zufall() * 2.6) * stark;
        dazu({
          art: 'funke',
          x,
          y,
          vx: Math.cos(w) * v,
          vy: Math.sin(w) * v + 0.6,
          alter: 0,
          leben: 0.3 + zufall() * 0.25,
          r: 0.035 + zufall() * 0.03,
          farbe,
        });
      }
    },
    ring(x, y, farbe) {
      dazu({ art: 'ring', x, y, vx: 0, vy: 0, alter: 0, leben: 0.4, r: 0.9, farbe });
    },
    schritt(dt) {
      for (const t of liste) {
        t.alter += dt;
        if (t.art === 'ring') continue;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        if (t.art === 'erde') {
          t.vy -= 9 * dt;
          t.vx *= 1 - 0.8 * dt;
        } else if (t.art === 'funke') {
          t.vy -= 5 * dt;
          t.vx *= 1 - 1.4 * dt;
        } else {
          t.vx *= 1 - 1.6 * dt;
        }
      }
      liste = liste.filter((t) => t.alter < t.leben);
    },
    zeichnen(b, art) {
      const { ctx, proMeter: m } = b;
      ctx.save();
      if (art === 'licht') ctx.globalCompositeOperation = 'lighter';
      for (const t of liste) {
        if ((t.art === 'funke' || t.art === 'ring') !== (art === 'licht')) continue;
        const k = 1 - t.alter / t.leben;
        const x = b.bx(t.x);
        const y = b.by(t.y);
        if (t.art === 'erde') {
          ctx.globalAlpha = Math.min(1, k * 1.8);
          ctx.fillStyle = t.farbe;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1, t.r * m), 0, Math.PI * 2);
          ctx.fill();
        } else if (t.art === 'staub') {
          ctx.globalAlpha = k * 0.26;
          ctx.fillStyle = t.farbe;
          ctx.beginPath();
          ctx.arc(x, y, t.r * m * (1.2 - k * 0.5), 0, Math.PI * 2);
          ctx.fill();
        } else if (t.art === 'funke') {
          ctx.globalAlpha = Math.min(1, k * 1.6);
          ctx.fillStyle = t.farbe;
          const r = Math.max(1.2, t.r * m * (0.5 + k * 0.5));
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          // Ein kleiner Schweif in Flugrichtung.
          ctx.strokeStyle = t.farbe;
          ctx.lineWidth = Math.max(1, r * 0.8);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - t.vx * 0.03 * m, y + t.vy * 0.03 * m);
          ctx.stroke();
        } else {
          // Ring: wächst auf seinen Endhalbmesser und verblasst.
          const lauf = 1 - k;
          ctx.globalAlpha = k * 0.85;
          ctx.strokeStyle = t.farbe;
          ctx.lineWidth = Math.max(1.5, 0.07 * m * k + 1);
          ctx.beginPath();
          ctx.ellipse(x, y, t.r * m * (0.25 + 0.75 * lauf), t.r * m * (0.25 + 0.75 * lauf) * 0.4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
    leeren() {
      liste = [];
    },
  };
}

// ---------------------------------------------------------------------
// Bildabschluss: Vignette, Licht, Tempo
// ---------------------------------------------------------------------

/** Dunkle Ränder und ein leichter Farbton über dem ganzen Bild. */
export function bildAbschluss(b: Buehne) {
  const { ctx, breite, hoehe, p } = b;
  const vig = ctx.createRadialGradient(
    breite * 0.5,
    hoehe * 0.55,
    Math.min(breite, hoehe) * 0.35,
    breite * 0.5,
    hoehe * 0.55,
    Math.hypot(breite, hoehe) * 0.62,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, `rgba(0,0,0,${p.vignette})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, breite, hoehe);
  ctx.fillStyle = p.grading;
  ctx.fillRect(0, 0, breite, hoehe);
}

/**
 * Der Scheinwerfer in der Nacht: ein Lichtkegel vom Lenker nach vorn, additiv.
 * Er folgt der Neigung des Rades — wer in der Luft nach vorn kippt, sieht den
 * Kegel auf den Boden fallen, noch bevor er landet.
 */
export function scheinwerfer(b: Buehne, lauf: Lauf, vorneX: number, vorneY: number) {
  if (!b.p.nacht) return;
  const { ctx, proMeter: m } = b;
  const x = b.bx(lauf.x + vorneX * Math.cos(lauf.winkel) - vorneY * Math.sin(lauf.winkel));
  const y = b.by(lauf.y + vorneX * Math.sin(lauf.winkel) + vorneY * Math.cos(lauf.winkel));
  const richtung = -lauf.winkel + 0.12;
  const laenge = 9 * m;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(richtung);
  ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createLinearGradient(0, 0, laenge, 0);
  gr.addColorStop(0, 'rgba(255,244,205,0.5)');
  gr.addColorStop(0.5, 'rgba(255,240,200,0.14)');
  gr.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(0, -0.04 * m);
  ctx.lineTo(laenge, -laenge * 0.22);
  ctx.lineTo(laenge, laenge * 0.22);
  ctx.lineTo(0, 0.04 * m);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Tempostriche — nur bei einem Boost. Dünne helle Linien, die von rechts nach
 * links durchs Bild ziehen. Sie sind an den Boost gebunden und nicht an das
 * Tempo, weil sie sonst ständig laufen und ihre Aussage verlieren.
 */
export function tempoStriche(b: Buehne, staerke: number) {
  if (staerke <= 0.02) return;
  const { ctx, breite, hoehe, uhr } = b;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const lauf = (uhr * (1.1 + streu(i, 40) * 0.8) + streu(i, 41)) % 1;
    const y = hoehe * (0.28 + streu(i, 42) * 0.5);
    const laenge = breite * (0.12 + streu(i, 43) * 0.16);
    const x = breite * (1.1 - lauf * 1.4);
    ctx.strokeStyle = `rgba(210,245,255,${(staerke * 0.22 * (1 - Math.abs(lauf - 0.5) * 1.2)).toFixed(3)})`;
    ctx.lineWidth = 1 + streu(i, 44) * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + laenge, y);
    ctx.stroke();
  }
  ctx.restore();
}

export { withAlpha };
