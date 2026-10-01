import * as THREE from 'three';

/**
 * Die Werkstoffe von Rad und Fahrer.
 *
 * Aus der 2-D-Zeichnung übernommen sind die **Farben** — das Rad ist rot, der Fahrer
 * türkis, Helm weiß mit rot —, geändert hat sich, was daraus wird: Statt eines
 * aufgemalten Verlaufs entscheidet jetzt das Material, wie Licht auf ein Teil fällt.
 * Lack glänzt scharf, Gummi nimmt Licht schluckend auf, Stoff streut weich.
 *
 * **Spiegelung gibt es je Werkstoff, nicht für die ganze Szene** — dieselbe Lehre wie
 * bei Dash City: Eine gemeinsame Umgebung liefert nicht nur Spiegelbilder, sondern auch
 * Grundlicht, und die Figur wird blass wie unter einer Dunstglocke. Metall und Lack
 * bekommen viel Spiegelung, Stoff fast keine.
 */

export type Stoffe = ReturnType<typeof stoffeBauen>;

export function stoffeBauen(umgebung: THREE.Texture | null) {
  const liste: { stoff: THREE.MeshStandardMaterial; basis: number }[] = [];
  const std = (
    farbe: string,
    rauheit: number,
    metall: number,
    spiegelung: number,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {},
  ) => {
    const m = new THREE.MeshStandardMaterial({ color: farbe, roughness: rauheit, metalness: metall, ...extra });
    if (umgebung && spiegelung > 0) {
      m.envMap = umgebung;
      m.envMapIntensity = spiegelung;
    }
    liste.push({ stoff: m, basis: spiegelung });
    return m;
  };

  const rad = {
    /** Lack: der Rahmen. Mittel rau, damit der Glanz als Streifen steht und nicht als Punkt. */
    rahmen: std('#d92d20', 0.34, 0.25, 1.1),
    rahmenDunkel: std('#8c1710', 0.4, 0.25, 0.9),
    akzent: std('#38d9a9', 0.35, 0.2, 0.8),
    /** Standrohre: poliertes Metall. */
    chrom: std('#c9ced6', 0.2, 0.95, 1.6),
    /** Tauchrohre und Brücken: eloxiert, matter. */
    eloxal: std('#3d434d', 0.38, 0.75, 1.2),
    schwarzMetall: std('#20242a', 0.45, 0.7, 1.0),
    gummi: std('#17171b', 0.95, 0, 0.1),
    profil: std('#2a2a31', 0.9, 0, 0.1),
    felge: std('#8d939e', 0.3, 0.9, 1.4),
    nabe: std('#c3c8d0', 0.25, 0.9, 1.4),
    scheibe: std('#7c828c', 0.35, 0.9, 1.2, { side: THREE.DoubleSide }),
    kette: std('#3d424b', 0.5, 0.8, 0.9),
    sattel: std('#16161a', 0.55, 0, 0.35),
    griff: std('#101014', 0.8, 0, 0.1),
    feder: std('#38d9a9', 0.4, 0.4, 0.9),
    speichen: new THREE.LineBasicMaterial({ color: 0xcfd6df, transparent: true, opacity: 0.72 }),
  };

  const fahrer = {
    haut: std('#e2ab84', 0.62, 0, 0.1),
    trikot: std('#14b8a6', 0.72, 0, 0.18),
    trikotDunkel: std('#0b6e69', 0.78, 0, 0.12),
    weiss: std('#e6eaef', 0.7, 0, 0.18),
    hose: std('#3e4a62', 0.82, 0, 0.1),
    hoseDunkel: std('#1d2433', 0.85, 0, 0.1),
    schoner: std('#1a1e27', 0.5, 0.1, 0.3),
    schonerKappe: std('#454d5e', 0.4, 0.2, 0.5),
    socke: std('#e3e8ee', 0.8, 0, 0.1),
    schuh: std('#dde3ea', 0.5, 0, 0.3),
    schuhDunkel: std('#171a21', 0.8, 0, 0.1),
    rot: std('#d92d20', 0.5, 0, 0.3),
    handschuh: std('#33383f', 0.7, 0, 0.15),
    helm: std('#dfe5ec', 0.3, 0.05, 0.75),
    helmRot: std('#d92d20', 0.35, 0.05, 0.7),
    helmTeal: std('#14b8a6', 0.35, 0.05, 0.7),
    brille: std('#171e29', 0.3, 0.2, 0.9),
    linse: std('#1b6d8f', 0.08, 0.3, 1.8, { emissive: new THREE.Color('#1b8fa8'), emissiveIntensity: 0.35 }),
    rucksack: std('#232937', 0.7, 0, 0.15),
  };

  return {
    rad,
    fahrer,
    /** Dreht die Spiegelung aller Werkstoffe zusammen herauf oder herunter (Nacht = weniger). */
    spiegelung: (faktor: number) => {
      for (const { stoff, basis } of liste) stoff.envMapIntensity = basis * faktor;
    },
  };
}
