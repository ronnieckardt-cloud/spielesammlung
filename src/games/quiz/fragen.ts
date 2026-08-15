/**
 * Der Fragenpool — reine Daten, keine Logik. Allgemeine Wissenserweiterung
 * für 10- bis 12-Jährige, kein enges Fachthema. Jede Frage hat vier
 * Antworten, `richtig` ist der Index der richtigen, `erklaerung` ist ein
 * kurzer Wissens-Hinweis, der nach der Antwort angezeigt wird — egal ob
 * richtig oder falsch geklickt wurde.
 *
 * Neue Fragen hier ergänzen — an der Logik ändert sich dadurch nichts.
 */

export type Frage = {
  frage: string;
  antworten: readonly [string, string, string, string];
  richtig: 0 | 1 | 2 | 3;
  kategorie: string;
  erklaerung: string;
};

export const FRAGEN: readonly Frage[] = [
  // Tiere
  { kategorie: 'Tiere', frage: 'Welches Tier ist das größte Landtier der Erde?', antworten: ['Elefant', 'Nashorn', 'Giraffe', 'Nilpferd'], richtig: 0, erklaerung: 'Ein ausgewachsener afrikanischer Elefantenbulle kann über 6 Tonnen wiegen — so schwer wie ein großer Lkw.' },
  { kategorie: 'Tiere', frage: 'Wie viele Beine hat eine Spinne?', antworten: ['6', '8', '10', '4'], richtig: 1, erklaerung: 'Spinnen gehören zu den Spinnentieren, nicht zu den Insekten — Insekten haben nämlich nur sechs Beine.' },
  { kategorie: 'Tiere', frage: 'Welches dieser Tiere kann als einziges wirklich fliegen, nicht nur gleiten?', antworten: ['Eichhörnchen', 'Fledermaus', 'Flughörnchen', 'Gleitbeutler'], richtig: 1, erklaerung: 'Fledermäuse orientieren sich im Dunkeln mit Echoortung: Sie stoßen Töne aus und hören, wie diese zurückkommen.' },
  { kategorie: 'Tiere', frage: 'Wie nennt man ein Baby-Känguru?', antworten: ['Welpe', 'Kalb', 'Joey', 'Fohlen'], richtig: 2, erklaerung: 'Ein neugeborenes Känguru ist winzig, nur wenige Zentimeter groß, und krabbelt gleich in den Beutel der Mutter.' },
  { kategorie: 'Tiere', frage: 'Welches ist das schnellste Landtier der Welt?', antworten: ['Löwe', 'Gepard', 'Pferd', 'Strauß'], richtig: 1, erklaerung: 'Ein Gepard kann in nur drei Sekunden von 0 auf 100 km/h beschleunigen — schneller als die meisten Sportautos.' },
  { kategorie: 'Tiere', frage: 'Wie viele Herzen hat ein Oktopus?', antworten: ['1', '2', '3', '4'], richtig: 2, erklaerung: 'Zwei Herzen pumpen Blut zu den Kiemen, das dritte durch den restlichen Körper.' },
  { kategorie: 'Tiere', frage: 'Welcher Vogel kann nicht fliegen, aber sehr schnell laufen?', antworten: ['Adler', 'Strauß', 'Papagei', 'Falke'], richtig: 1, erklaerung: 'Ein Strauß kann bis zu 70 km/h schnell laufen und mit einem Tritt sogar einen Löwen verletzen.' },
  { kategorie: 'Tiere', frage: 'Welches Tier wechselt seine Farbe, um sich zu tarnen?', antworten: ['Frosch', 'Chamäleon', 'Eidechse', 'Ringelnatter'], richtig: 1, erklaerung: 'Chamäleons wechseln die Farbe nicht nur zur Tarnung, sondern auch, um ihre Stimmung zu zeigen.' },
  { kategorie: 'Tiere', frage: 'Was fressen Koalas hauptsächlich?', antworten: ['Bambus', 'Eukalyptusblätter', 'Gras', 'Früchte'], richtig: 1, erklaerung: 'Eukalyptusblätter sind für die meisten Tiere giftig — Koalas haben sich als eine der wenigen Arten daran angepasst.' },
  { kategorie: 'Tiere', frage: 'Welches Tier lebt typischerweise in einem Bau und sammelt Nüsse für den Winter?', antworten: ['Eichhörnchen', 'Fuchs', 'Reh', 'Wildschwein'], richtig: 0, erklaerung: 'Eichhörnchen vergraben oft Hunderte Nüsse und finden viele davon später gar nicht wieder — so wachsen daraus neue Bäume.' },

  // Erde & Geographie
  { kategorie: 'Erde', frage: 'Wie heißt der höchste Berg der Welt?', antworten: ['Mount Everest', 'K2', 'Kilimandscharo', 'Matterhorn'], richtig: 0, erklaerung: 'Der Mount Everest wächst durch die Bewegung der Erdplatten jedes Jahr um wenige Millimeter weiter.' },
  { kategorie: 'Erde', frage: 'Welcher Fluss gilt als der längste der Welt?', antworten: ['Amazonas', 'Nil', 'Mississippi', 'Rhein'], richtig: 1, erklaerung: 'Der Nil fließt durch mehrere afrikanische Länder und mündet nach über 6.000 Kilometern ins Mittelmeer.' },
  { kategorie: 'Erde', frage: 'Wie viele Kontinente gibt es?', antworten: ['5', '6', '7', '8'], richtig: 2, erklaerung: 'Manche zählen Europa und Asien als einen einzigen Kontinent, Eurasien — dann wären es nur sechs.' },
  { kategorie: 'Erde', frage: 'Welches Land ist flächenmäßig das größte der Welt?', antworten: ['Kanada', 'China', 'USA', 'Russland'], richtig: 3, erklaerung: 'Russland ist so groß, dass es sich über elf verschiedene Zeitzonen erstreckt.' },
  { kategorie: 'Erde', frage: 'Wie heißt die Hauptstadt von Deutschland?', antworten: ['München', 'Berlin', 'Hamburg', 'Köln'], richtig: 1, erklaerung: 'Berlin wurde erst 1990 wieder Hauptstadt von ganz Deutschland, nachdem das Land vorher geteilt war.' },
  { kategorie: 'Erde', frage: 'Welcher Ozean ist der größte der Welt?', antworten: ['Atlantik', 'Pazifik', 'Indischer Ozean', 'Nordpolarmeer'], richtig: 1, erklaerung: 'Der Pazifik ist so groß, dass alle Kontinente der Erde locker hineinpassen würden.' },
  { kategorie: 'Erde', frage: 'In welchem Land steht die Freiheitsstatue?', antworten: ['Frankreich', 'USA', 'England', 'Kanada'], richtig: 1, erklaerung: 'Die Freiheitsstatue war ein Geschenk Frankreichs an die USA und steht seit 1886 in New York.' },
  { kategorie: 'Erde', frage: 'Wie heißt die größte heiße Wüste der Welt?', antworten: ['Sahara', 'Gobi', 'Kalahari', 'Atacama'], richtig: 0, erklaerung: 'Die Sahara ist fast so groß wie ganz Europa und breitet sich in manchen Gebieten weiter aus.' },
  { kategorie: 'Erde', frage: 'In welchem Land leben Kängurus und Koalas in freier Wildbahn?', antworten: ['Australien', 'Neuseeland', 'Südafrika', 'Brasilien'], richtig: 0, erklaerung: 'Australien ist der einzige Kontinent, der komplett von einem einzigen Land eingenommen wird.' },
  { kategorie: 'Erde', frage: 'Wie heißt das Meer im Norden Deutschlands, an dem zum Beispiel Sylt liegt?', antworten: ['Mittelmeer', 'Nordsee', 'Rotes Meer', 'Adria'], richtig: 1, erklaerung: 'In der Nordsee gibt es Ebbe und Flut — zweimal am Tag steigt und sinkt dort der Wasserspiegel.' },

  // Weltraum
  { kategorie: 'Weltraum', frage: 'Wie viele Planeten hat unser Sonnensystem?', antworten: ['7', '8', '9', '10'], richtig: 1, erklaerung: 'Bis 2006 zählte man den Pluto noch als neunten Planeten, heute gilt er als Zwergplanet.' },
  { kategorie: 'Weltraum', frage: 'Welcher Planet wird auch der "Rote Planet" genannt?', antworten: ['Venus', 'Mars', 'Jupiter', 'Saturn'], richtig: 1, erklaerung: 'Der Mars sieht rot aus, weil auf seiner Oberfläche viel Eisenoxid liegt — im Grunde Rost.' },
  { kategorie: 'Weltraum', frage: 'Was ist die Sonne?', antworten: ['Ein Planet', 'Ein Stern', 'Ein Mond', 'Ein Komet'], richtig: 1, erklaerung: 'Die Sonne ist so groß, dass über eine Million Erden hineinpassen würden.' },
  { kategorie: 'Weltraum', frage: 'Welcher Planet hat die auffälligsten Ringe?', antworten: ['Jupiter', 'Saturn', 'Uranus', 'Neptun'], richtig: 1, erklaerung: 'Die Ringe des Saturn bestehen aus Milliarden kleiner Eis- und Gesteinsbrocken.' },
  { kategorie: 'Weltraum', frage: 'Wie nennt man eine Gruppe von Sternen, die am Himmel ein Bild ergibt?', antworten: ['Sternbild', 'Galaxie', 'Nebel', 'Komet'], richtig: 0, erklaerung: 'Sternbilder sehen nur von der Erde aus wie ein Muster — die einzelnen Sterne sind oft viele Lichtjahre voneinander entfernt.' },
  { kategorie: 'Weltraum', frage: 'Wer betrat 1969 als erster Mensch den Mond?', antworten: ['Juri Gagarin', 'Neil Armstrong', 'Buzz Aldrin', 'Michael Collins'], richtig: 1, erklaerung: 'Sein erster Satz auf dem Mond lautete: "Ein kleiner Schritt für einen Menschen, ein großer für die Menschheit."' },
  { kategorie: 'Weltraum', frage: 'Wie lange braucht die Erde für eine Umrundung der Sonne?', antworten: ['Ein Monat', 'Ein Jahr', 'Ein Tag', 'Zehn Jahre'], richtig: 1, erklaerung: 'Andere Planeten brauchen unterschiedlich lang: Der Merkur nur 88 Tage, der Neptun über 160 Jahre.' },
  { kategorie: 'Weltraum', frage: 'Wie nennt man den Himmelskörper, der die Erde umkreist und nachts leuchtet?', antworten: ['Mond', 'Stern', 'Komet', 'Planet'], richtig: 0, erklaerung: 'Der Mond hat kein eigenes Licht — er reflektiert nur das Licht der Sonne.' },
  { kategorie: 'Weltraum', frage: 'Was ist ein Komet?', antworten: ['Ein Planet', 'Ein Klumpen aus Eis und Staub', 'Ein Stern', 'Ein Mond'], richtig: 1, erklaerung: 'Wenn ein Komet der Sonne nahekommt, verdampft ein Teil seines Eises und bildet den charakteristischen Schweif.' },
  { kategorie: 'Weltraum', frage: 'Welcher ist der größte Planet in unserem Sonnensystem?', antworten: ['Saturn', 'Jupiter', 'Neptun', 'Erde'], richtig: 1, erklaerung: 'Jupiter ist so groß, dass alle anderen Planeten unseres Sonnensystems zusammen hineinpassen würden.' },

  // Körper & Gesundheit
  { kategorie: 'Körper', frage: 'Wie viele Knochen hat ein erwachsener Mensch ungefähr?', antworten: ['106', '206', '306', '406'], richtig: 1, erklaerung: 'Babys werden mit etwa 300 Knochen geboren — viele wachsen im Laufe des Lebens zusammen.' },
  { kategorie: 'Körper', frage: 'Welches Organ pumpt das Blut durch den Körper?', antworten: ['Lunge', 'Herz', 'Leber', 'Magen'], richtig: 1, erklaerung: 'Das Herz schlägt bei einem Kind etwa 90-mal pro Minute, bei einem Erwachsenen meist etwas langsamer.' },
  { kategorie: 'Körper', frage: 'Wie viele Zähne hat ein erwachsener Mensch normalerweise?', antworten: ['28', '30', '32', '36'], richtig: 2, erklaerung: 'Kinder haben zunächst nur 20 Milchzähne, bevor die bleibenden Zähne nachwachsen.' },
  { kategorie: 'Körper', frage: 'Womit atmen wir?', antworten: ['Herz', 'Lunge', 'Magen', 'Niere'], richtig: 1, erklaerung: 'Beim Einatmen strömt Luft in die Lunge, wo der Sauerstoff ins Blut übergeht.' },
  { kategorie: 'Körper', frage: 'Wie viele Sinne hat der Mensch klassischerweise?', antworten: ['3', '4', '5', '6'], richtig: 2, erklaerung: 'Manche Forscher zählen inzwischen noch weitere Sinne dazu, etwa den Gleichgewichtssinn.' },
  { kategorie: 'Körper', frage: 'Welches ist das größte Organ des menschlichen Körpers?', antworten: ['Herz', 'Leber', 'Haut', 'Gehirn'], richtig: 2, erklaerung: 'Die Haut eines Erwachsenen wiegt zusammen etwa 3,5 bis 10 Kilogramm.' },
  { kategorie: 'Körper', frage: 'In welchem Obst steckt besonders viel Vitamin C?', antworten: ['Banane', 'Orange', 'Kartoffel', 'Brot'], richtig: 1, erklaerung: 'Auch Paprika und Brokkoli enthalten überraschend viel Vitamin C, sogar mehr als Orangen.' },
  { kategorie: 'Körper', frage: 'Wie viele Kammern hat das menschliche Herz?', antworten: ['2', '3', '4', '5'], richtig: 2, erklaerung: 'Zwei Kammern pumpen Blut zur Lunge, zwei weitere in den restlichen Körper.' },
  { kategorie: 'Körper', frage: 'Welches Organ hilft beim Verdauen der Nahrung?', antworten: ['Herz', 'Magen', 'Lunge', 'Gehirn'], richtig: 1, erklaerung: 'Der Magen zerkleinert die Nahrung mit Magensäure, die so stark ist, dass sie sogar Metall angreifen könnte.' },
  { kategorie: 'Körper', frage: 'Wie viele Stunden Schlaf brauchen Kinder im Grundschulalter ungefähr pro Nacht?', antworten: ['5 Stunden', '10 Stunden', '15 Stunden', '20 Stunden'], richtig: 1, erklaerung: 'Im Schlaf verarbeitet das Gehirn, was am Tag gelernt wurde — deshalb ist genug Schlaf wichtig fürs Lernen.' },

  // Geschichte
  { kategorie: 'Geschichte', frage: 'In welchem Jahrhundert leben wir gerade?', antworten: ['19.', '20.', '21.', '22.'], richtig: 2, erklaerung: 'Das 21. Jahrhundert begann im Jahr 2001, nicht schon im Jahr 2000.' },
  { kategorie: 'Geschichte', frage: 'Wer entdeckte 1492 aus europäischer Sicht den amerikanischen Kontinent?', antworten: ['Christoph Kolumbus', 'Marco Polo', 'Vasco da Gama', 'James Cook'], richtig: 0, erklaerung: 'Kolumbus wollte eigentlich einen neuen Seeweg nach Indien finden und wusste zunächst gar nicht, dass er einen neuen Kontinent erreicht hatte.' },
  { kategorie: 'Geschichte', frage: 'Wie heißen die großen Bauwerke der alten Ägypter, in denen Pharaonen bestattet wurden?', antworten: ['Pyramiden', 'Tempel', 'Paläste', 'Türme'], richtig: 0, erklaerung: 'Die größte Pyramide von Gizeh wurde vor über 4.500 Jahren gebaut und blieb Jahrtausende das höchste Bauwerk der Welt.' },
  { kategorie: 'Geschichte', frage: 'Welches Volk baute das Kolosseum in Rom?', antworten: ['Die Griechen', 'Die Römer', 'Die Ägypter', 'Die Wikinger'], richtig: 1, erklaerung: 'Im Kolosseum passten einst bis zu 50.000 Zuschauer hinein — ähnlich viele wie in einem großen Fußballstadion heute.' },
  { kategorie: 'Geschichte', frage: 'Wie nannte man die großen Reptilien, die vor Millionen Jahren lebten und heute ausgestorben sind?', antworten: ['Dinosaurier', 'Mammuts', 'Säbelzahntiger', 'Drachen'], richtig: 0, erklaerung: 'Dinosaurier lebten vor über 65 Millionen Jahren, lange bevor es Menschen gab.' },
  { kategorie: 'Geschichte', frage: 'In welcher Stadt fiel 1989 die Mauer, die Deutschland geteilt hatte?', antworten: ['Berlin', 'München', 'Hamburg', 'Dresden'], richtig: 0, erklaerung: 'Die Mauer trennte fast 30 Jahre lang Ost- und West-Berlin, bis sie 1989 friedlich geöffnet wurde.' },
  { kategorie: 'Geschichte', frage: 'Wer schrieb bekannte Märchen wie "Aschenputtel" und "Rotkäppchen" auf?', antworten: ['Die Gebrüder Grimm', 'Hans Christian Andersen', 'Astrid Lindgren', 'Erich Kästner'], richtig: 0, erklaerung: 'Die Brüder Jacob und Wilhelm Grimm sammelten über 200 Märchen, die bis heute in viele Sprachen übersetzt wurden.' },
  { kategorie: 'Geschichte', frage: 'Was waren Ritter im Mittelalter hauptsächlich?', antworten: ['Bauern', 'Berittene Krieger', 'Händler', 'Mönche'], richtig: 1, erklaerung: 'Ritter trugen schwere Rüstungen, die oft über 20 Kilogramm wogen.' },
  { kategorie: 'Geschichte', frage: 'Wie hieß das Schiff, das 1912 nach einer Kollision mit einem Eisberg sank?', antworten: ['Titanic', 'Bismarck', 'Santa Maria', 'Mayflower'], richtig: 0, erklaerung: 'Die Titanic galt als unsinkbar — trotzdem sank sie schon auf ihrer ersten Fahrt.' },
  { kategorie: 'Geschichte', frage: 'Wie viele Farben hat die deutsche Flagge?', antworten: ['2', '3', '4', '5'], richtig: 1, erklaerung: 'Schwarz-Rot-Gold ist seit 1949 die Flagge Deutschlands.' },

  // Sport
  { kategorie: 'Sport', frage: 'Wie viele Spieler hat eine Fußballmannschaft auf dem Feld (ohne Auswechselspieler)?', antworten: ['9', '10', '11', '12'], richtig: 2, erklaerung: 'Zusammen mit dem Torwart stehen also elf Spieler pro Team gleichzeitig auf dem Feld.' },
  { kategorie: 'Sport', frage: 'Alle wie viele Jahre finden die Olympischen Sommerspiele statt?', antworten: ['2', '3', '4', '5'], richtig: 2, erklaerung: 'Wegen der Corona-Pandemie fanden die Sommerspiele 2020 ausnahmsweise erst 2021 statt.' },
  { kategorie: 'Sport', frage: 'Welcher Sport wird mit Schläger und gelbem Filzball gespielt, unter anderem in Wimbledon?', antworten: ['Tennis', 'Federball', 'Tischtennis', 'Squash'], richtig: 0, erklaerung: 'Beim Tennis-Turnier in Wimbledon müssen die Spieler traditionell komplett in Weiß spielen.' },
  { kategorie: 'Sport', frage: 'Wie viele Ringe hat das olympische Symbol?', antworten: ['4', '5', '6', '7'], richtig: 1, erklaerung: 'Die fünf Ringe stehen für die fünf bewohnten Kontinente, die bei Olympia teilnehmen.' },
  { kategorie: 'Sport', frage: 'Welche Sportart wird auf Eis mit Schlittschuhen und einem Puck gespielt?', antworten: ['Eishockey', 'Eiskunstlauf', 'Curling', 'Biathlon'], richtig: 0, erklaerung: 'Der Puck beim Eishockey kann über 150 km/h schnell geschossen werden.' },
  { kategorie: 'Sport', frage: 'Wie viele Punkte gibt ein gewöhnlicher Korb beim Basketball normalerweise?', antworten: ['1', '2', '3', '4'], richtig: 1, erklaerung: 'Ein Wurf von weiter weg, hinter der Dreipunktlinie, zählt sogar drei Punkte.' },
  { kategorie: 'Sport', frage: 'Welches Land hat die Fußball-Weltmeisterschaft der Männer am häufigsten gewonnen?', antworten: ['Deutschland', 'Brasilien', 'Argentinien', 'Italien'], richtig: 1, erklaerung: 'Brasilien hat die Fußball-Weltmeisterschaft der Männer bisher fünfmal gewonnen.' },
  { kategorie: 'Sport', frage: 'Wie nennt man es beim Schwimmen, wenn man auf dem Rücken liegend schwimmt?', antworten: ['Brustschwimmen', 'Rückenschwimmen', 'Kraulen', 'Delfinschwimmen'], richtig: 1, erklaerung: 'Beim Rückenschwimmen kann man frei atmen, weil das Gesicht die ganze Zeit über Wasser bleibt.' },

  // Kunst, Musik & Kultur
  { kategorie: 'Kunst', frage: 'Wie viele Saiten hat eine klassische Gitarre normalerweise?', antworten: ['4', '5', '6', '7'], richtig: 2, erklaerung: 'Es gibt auch Bassgitarren mit nur vier Saiten, für tiefere Töne.' },
  { kategorie: 'Kunst', frage: 'Welches Instrument hat schwarze und weiße Tasten?', antworten: ['Gitarre', 'Klavier', 'Geige', 'Flöte'], richtig: 1, erklaerung: 'Ein Klavier hat insgesamt 88 Tasten, davon 52 weiße und 36 schwarze.' },
  { kategorie: 'Kunst', frage: 'Wer malte die berühmte "Mona Lisa"?', antworten: ['Pablo Picasso', 'Leonardo da Vinci', 'Vincent van Gogh', 'Michelangelo'], richtig: 1, erklaerung: 'Die Mona Lisa hängt im Louvre in Paris und ist eines der meistbesuchten Gemälde der Welt.' },
  { kategorie: 'Kunst', frage: 'Welche zwei Farben ergeben zusammengemischt die Farbe Grün?', antworten: ['Rot und Blau', 'Blau und Gelb', 'Rot und Gelb', 'Schwarz und Weiß'], richtig: 1, erklaerung: 'Rot, Gelb und Blau nennt man die drei Grundfarben, aus denen sich viele andere Farben mischen lassen.' },
  { kategorie: 'Kunst', frage: 'Wie viele Farben hat ein klassischer Regenbogen?', antworten: ['5', '6', '7', '8'], richtig: 2, erklaerung: 'Ein Regenbogen entsteht, wenn Sonnenlicht in Regentropfen gebrochen wird.' },
  { kategorie: 'Kunst', frage: 'In welchem Land steht der Eiffelturm?', antworten: ['Italien', 'Frankreich', 'Spanien', 'England'], richtig: 1, erklaerung: 'Der Eiffelturm wurde 1889 gebaut und war ursprünglich nur für kurze Zeit geplant.' },
  { kategorie: 'Kunst', frage: 'Wie nennt man ein Gemälde, auf dem eine Person dargestellt wird?', antworten: ['Porträt', 'Landschaft', 'Stillleben', 'Skizze'], richtig: 0, erklaerung: 'Ein Selbstporträt ist ein Bild, das ein Künstler von sich selbst malt.' },
  { kategorie: 'Kunst', frage: 'Aus welchem Land stammt die Pizza ursprünglich?', antworten: ['Italien', 'Griechenland', 'Spanien', 'Frankreich'], richtig: 0, erklaerung: 'Die berühmte Pizza Margherita soll nach einer italienischen Königin benannt worden sein.' },

  // Technik & Erfindungen
  { kategorie: 'Technik', frage: 'Wer wird häufig als Erfinder der Glühbirne genannt?', antworten: ['Thomas Edison', 'Albert Einstein', 'Isaac Newton', 'Alexander Graham Bell'], richtig: 0, erklaerung: 'Auch andere Erfinder arbeiteten gleichzeitig an der Glühbirne, aber Edison verbesserte sie entscheidend.' },
  { kategorie: 'Technik', frage: 'Wer erfand das Telefon?', antworten: ['Thomas Edison', 'Alexander Graham Bell', 'Nikola Tesla', 'Guglielmo Marconi'], richtig: 1, erklaerung: 'Das erste Telefongespräch von Alexander Graham Bell fand im Jahr 1876 statt.' },
  { kategorie: 'Technik', frage: 'Womit kann man heute Nachrichten in Sekundenschnelle um die ganze Welt schicken?', antworten: ['Brief', 'Internet', 'Brieftaube', 'Fax'], richtig: 1, erklaerung: 'Das Internet verbindet mittlerweile Milliarden Computer weltweit miteinander.' },
  { kategorie: 'Technik', frage: 'Wie nennt man ein Fahrzeug, das ganz ohne Fahrer selbst fahren kann?', antworten: ['Zug', 'Selbstfahrendes Auto', 'U-Bahn', 'Fahrrad'], richtig: 1, erklaerung: 'Selbstfahrende Autos nutzen Kameras und Sensoren, um ihre Umgebung zu erkennen.' },
  { kategorie: 'Technik', frage: 'Was braucht ein Computer unbedingt, um zu funktionieren?', antworten: ['Wasser', 'Strom', 'Luft', 'Sonne'], richtig: 1, erklaerung: 'Ohne Strom kann ein Computer weder rechnen noch etwas speichern.' },
  { kategorie: 'Technik', frage: 'Wie nennt man das Gerät, mit dem man Fotos macht?', antworten: ['Kamera', 'Drucker', 'Scanner', 'Mikrofon'], richtig: 0, erklaerung: 'Die ersten Kameras waren riesig, und ein einziges Foto dauerte damals mehrere Minuten.' },
  { kategorie: 'Technik', frage: 'Wer gilt als Begründer der Relativitätstheorie?', antworten: ['Isaac Newton', 'Albert Einstein', 'Galileo Galilei', 'Stephen Hawking'], richtig: 1, erklaerung: 'Einsteins berühmteste Formel lautet E=mc² und beschreibt den Zusammenhang von Energie und Masse.' },
  { kategorie: 'Technik', frage: 'Womit kann man heute Bücher lesen, ohne Papier zu benutzen?', antworten: ['E-Book-Reader', 'Radio', 'Fernseher', 'Wählscheibentelefon'], richtig: 0, erklaerung: 'Auf einem E-Book-Reader können oft tausende Bücher gleichzeitig gespeichert werden.' },

  // Sprache & Wörter
  { kategorie: 'Sprache', frage: 'Wie viele Buchstaben hat das deutsche Standardalphabet?', antworten: ['24', '25', '26', '27'], richtig: 2, erklaerung: 'Zählt man Umlaute wie Ä, Ö, Ü und das ß dazu, kommen noch ein paar Sonderzeichen hinzu.' },
  { kategorie: 'Sprache', frage: 'Welches Wort ist das Gegenteil von "groß"?', antworten: ['klein', 'laut', 'schnell', 'hell'], richtig: 0, erklaerung: 'Wörter mit gegensätzlicher Bedeutung nennt man Antonyme.' },
  { kategorie: 'Sprache', frage: 'Wie nennt man ein Wort, das vorwärts und rückwärts gelesen gleich klingt, z. B. "Anna"?', antworten: ['Palindrom', 'Synonym', 'Reim', 'Metapher'], richtig: 0, erklaerung: 'Auch Zahlen können Palindrome sein, zum Beispiel die Zahl 12321.' },
  { kategorie: 'Sprache', frage: 'Welches Satzzeichen steht am Ende einer Frage?', antworten: ['Punkt', 'Ausrufezeichen', 'Fragezeichen', 'Komma'], richtig: 2, erklaerung: 'Auf Spanisch steht sogar schon am Anfang einer Frage ein umgedrehtes Fragezeichen.' },
  { kategorie: 'Sprache', frage: 'Wie viele Fälle (Kasus) gibt es in der deutschen Grammatik?', antworten: ['2', '3', '4', '5'], richtig: 2, erklaerung: 'Die vier Fälle heißen Nominativ, Genitiv, Dativ und Akkusativ.' },
  { kategorie: 'Sprache', frage: 'Welches Wort bedeutet ungefähr dasselbe wie "froh"?', antworten: ['glücklich', 'traurig', 'müde', 'wütend'], richtig: 0, erklaerung: 'Wörter mit ähnlicher Bedeutung nennt man Synonyme.' },

  // Natur & Umwelt
  { kategorie: 'Natur', frage: 'Was brauchen Pflanzen zum Wachsen, neben Wasser und Erde, unbedingt?', antworten: ['Sonnenlicht', 'Salz', 'Zucker', 'Metall'], richtig: 0, erklaerung: 'Pflanzen nutzen Sonnenlicht, um aus Wasser und Kohlendioxid ihre eigene Nahrung herzustellen.' },
  { kategorie: 'Natur', frage: 'Wie nennt man den Vorgang, bei dem Pflanzen mit Sonnenlicht ihre Nahrung herstellen?', antworten: ['Fotosynthese', 'Verdauung', 'Atmung', 'Gärung'], richtig: 0, erklaerung: 'Bei der Fotosynthese entsteht als Nebenprodukt auch der Sauerstoff, den wir zum Atmen brauchen.' },
  { kategorie: 'Natur', frage: 'Welches Gas atmen Menschen und Tiere zum Leben ein?', antworten: ['Kohlendioxid', 'Sauerstoff', 'Stickstoff', 'Wasserstoff'], richtig: 1, erklaerung: 'Etwa 21 Prozent der Luft, die wir einatmen, bestehen aus Sauerstoff.' },
  { kategorie: 'Natur', frage: 'In welcher Jahreszeit verlieren die meisten Bäume in Deutschland ihre Blätter?', antworten: ['Frühling', 'Sommer', 'Herbst', 'Winter'], richtig: 2, erklaerung: 'Im Herbst ziehen Bäume die grünen Farbstoffe aus den Blättern zurück, dadurch werden sie bunt.' },
  { kategorie: 'Natur', frage: 'Wie nennt man Regen, Schnee und Hagel zusammengefasst?', antworten: ['Niederschlag', 'Wetter', 'Klima', 'Wolken'], richtig: 0, erklaerung: 'Ob Niederschlag als Regen, Schnee oder Hagel fällt, hängt vor allem von der Temperatur ab.' },
  { kategorie: 'Natur', frage: 'Wie nennt man es, wenn Wasser verdunstet, zu Wolken wird und als Regen zurückfällt?', antworten: ['Wasserkreislauf', 'Gezeiten', 'Erosion', 'Verdunstung'], richtig: 0, erklaerung: 'Das Wasser, das heute vom Himmel fällt, könnte schon vor Millionen Jahren im Meer gewesen sein.' },
  { kategorie: 'Natur', frage: 'Welche Jahreszeit kommt in Deutschland direkt nach dem Winter?', antworten: ['Sommer', 'Frühling', 'Herbst', 'Winter'], richtig: 1, erklaerung: 'Im Frühling werden die Tage länger, und viele Pflanzen beginnen wieder zu wachsen.' },
  { kategorie: 'Natur', frage: 'Wie nennt man Tiere wie Frösche, die sowohl an Land als auch im Wasser leben können?', antworten: ['Reptilien', 'Amphibien', 'Fische', 'Säugetiere'], richtig: 1, erklaerung: 'Frösche atmen als junge Kaulquappen im Wasser mit Kiemen, als erwachsene Tiere dann mit Lungen.' },
  { kategorie: 'Natur', frage: 'Was passiert mit Eis, wenn man es erwärmt?', antworten: ['Es wird härter', 'Es schmilzt zu Wasser', 'Es verschwindet einfach', 'Es wird bunt'], richtig: 1, erklaerung: 'Wasser gefriert bei 0 Grad Celsius und wird bei dieser Temperatur beim Abkühlen auch wieder zu Eis.' },
  { kategorie: 'Natur', frage: 'Wie nennt man Wälder mit besonders vielen Pflanzen- und Tierarten, zum Beispiel am Amazonas?', antworten: ['Regenwald', 'Nadelwald', 'Laubwald', 'Steppenwald'], richtig: 0, erklaerung: 'Im Amazonas-Regenwald lebt schätzungsweise ein Zehntel aller bekannten Tier- und Pflanzenarten der Welt.' },

  // Zahlen & Mathe-Wissen
  { kategorie: 'Zahlen', frage: 'Wie viele Seiten hat ein Quadrat?', antworten: ['3', '4', '5', '6'], richtig: 1, erklaerung: 'Bei einem Quadrat sind zusätzlich alle vier Seiten gleich lang.' },
  { kategorie: 'Zahlen', frage: 'Wie viele Minuten hat eine Stunde?', antworten: ['30', '45', '60', '100'], richtig: 2, erklaerung: 'Eine Minute hat wiederum 60 Sekunden.' },
  { kategorie: 'Zahlen', frage: 'Wie viele Tage hat ein normales Jahr (kein Schaltjahr)?', antworten: ['360', '365', '366', '370'], richtig: 1, erklaerung: 'Alle vier Jahre gibt es ein Schaltjahr mit einem zusätzlichen Tag, dem 29. Februar.' },
  { kategorie: 'Zahlen', frage: 'Wie nennt man eine Zahl, die nur durch 1 und sich selbst teilbar ist?', antworten: ['Primzahl', 'Quadratzahl', 'Bruchzahl', 'Dezimalzahl'], richtig: 0, erklaerung: 'Die kleinste Primzahl ist die 2 — und zugleich die einzige gerade Primzahl überhaupt.' },
  { kategorie: 'Zahlen', frage: 'Wie viele Grad hat ein rechter Winkel?', antworten: ['45', '60', '90', '180'], richtig: 2, erklaerung: 'Ein rechter Winkel sieht aus wie die Ecke eines Blattes Papier.' },
  { kategorie: 'Zahlen', frage: 'Wie viele Zentimeter hat ein Meter?', antworten: ['10', '100', '1000', '50'], richtig: 1, erklaerung: 'Ein Kilometer wiederum hat 1000 Meter.' },
  { kategorie: 'Zahlen', frage: 'Wie nennt man ein Dreieck, bei dem alle drei Seiten gleich lang sind?', antworten: ['Rechtwinkliges Dreieck', 'Gleichseitiges Dreieck', 'Gleichschenkliges Dreieck', 'Stumpfes Dreieck'], richtig: 1, erklaerung: 'Bei einem gleichseitigen Dreieck sind auch alle drei Winkel gleich groß, nämlich je 60 Grad.' },
  { kategorie: 'Zahlen', frage: 'Wie viele Monate hat ein Jahr?', antworten: ['10', '11', '12', '13'], richtig: 2, erklaerung: 'Die Namen der Monate stammen größtenteils aus dem alten Rom.' },
  { kategorie: 'Zahlen', frage: 'Welches ist das kleinste Land der Welt?', antworten: ['Monaco', 'Vatikanstadt', 'Liechtenstein', 'San Marino'], richtig: 1, erklaerung: 'Die Vatikanstadt ist mit nur 0,44 Quadratkilometern kleiner als die meisten Parks.' },
];
