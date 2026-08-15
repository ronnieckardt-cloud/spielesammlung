/** Eigene Optik, keine Anlehnung ans Original — weder Formen noch Farben. */
export const WAND_FARBE = '#334155';
export const PUNKT_FARBE = '#facc15';
export const PILLE_FARBE = '#fb923c';

/**
 * Blau gegen Rot: Der Spieler ist die einzige kalte Farbe im Labyrinth,
 * die Verfolger die einzigen warmen. Vorher war der Spieler grün und die
 * Geister lila/gelb/türkis/rosa — bunt, aber ohne Aussage, und der grüne
 * Spieler ging zwischen den vier Farben unter. Rückmeldung: „den Geist
 * irgendwie rot machen, weil es fällt dann besser auf. Blau und Rot passt".
 */
export const SPIELER_FARBE = '#38bdf8';
/** Dunkleres Blau für die Hose — muss sich vom Hemd absetzen, aber auf
 *  fast schwarzem Grund noch zu sehen sein. */
export const SPIELER_HOSE = '#3b82f6';

/**
 * Vier Abstufungen derselben warmen Familie: Rot, Rose, Pink, Fuchsia.
 * Bewusst nicht viermal dasselbe Rot — die Geister verhalten sich
 * unterschiedlich, das darf man auch sehen. Und bewusst kein Orange oder
 * Gelb: Das ist für Punkte und Kraftpillen reserviert.
 */
export const GEIST_FARBEN: readonly string[] = ['#ef4444', '#f43f5e', '#ec4899', '#d946ef'];
