/**
 * Der Fragenpool — reine Daten, keine Logik. Allgemeine Wissenserweiterung
 * für 10- bis 12-Jährige, kein enges Fachthema. Jede Frage hat vier
 * Antworten, `richtig` ist der Index der richtigen.
 *
 * Neue Fragen hier ergänzen — an der Logik ändert sich dadurch nichts.
 */

export type Frage = {
  frage: string;
  antworten: readonly [string, string, string, string];
  richtig: 0 | 1 | 2 | 3;
  kategorie: string;
};

export const FRAGEN: readonly Frage[] = [
  // Tiere
  { kategorie: 'Tiere', frage: 'Welches Tier ist das größte Landtier der Erde?', antworten: ['Elefant', 'Nashorn', 'Giraffe', 'Nilpferd'], richtig: 0 },
  { kategorie: 'Tiere', frage: 'Wie viele Beine hat eine Spinne?', antworten: ['6', '8', '10', '4'], richtig: 1 },
  { kategorie: 'Tiere', frage: 'Welches dieser Tiere kann als einziges wirklich fliegen, nicht nur gleiten?', antworten: ['Eichhörnchen', 'Fledermaus', 'Flughörnchen', 'Gleitbeutler'], richtig: 1 },
  { kategorie: 'Tiere', frage: 'Wie nennt man ein Baby-Känguru?', antworten: ['Welpe', 'Kalb', 'Joey', 'Fohlen'], richtig: 2 },
  { kategorie: 'Tiere', frage: 'Welches ist das schnellste Landtier der Welt?', antworten: ['Löwe', 'Gepard', 'Pferd', 'Strauß'], richtig: 1 },
  { kategorie: 'Tiere', frage: 'Wie viele Herzen hat ein Oktopus?', antworten: ['1', '2', '3', '4'], richtig: 2 },
  { kategorie: 'Tiere', frage: 'Welcher Vogel kann nicht fliegen, aber sehr schnell laufen?', antworten: ['Adler', 'Strauß', 'Papagei', 'Falke'], richtig: 1 },
  { kategorie: 'Tiere', frage: 'Welches Tier wechselt seine Farbe, um sich zu tarnen?', antworten: ['Frosch', 'Chamäleon', 'Eidechse', 'Ringelnatter'], richtig: 1 },
  { kategorie: 'Tiere', frage: 'Was fressen Koalas hauptsächlich?', antworten: ['Bambus', 'Eukalyptusblätter', 'Gras', 'Früchte'], richtig: 1 },
  { kategorie: 'Tiere', frage: 'Welches Tier lebt typischerweise in einem Bau und sammelt Nüsse für den Winter?', antworten: ['Eichhörnchen', 'Fuchs', 'Reh', 'Wildschwein'], richtig: 0 },

  // Erde & Geographie
  { kategorie: 'Erde', frage: 'Wie heißt der höchste Berg der Welt?', antworten: ['Mount Everest', 'K2', 'Kilimandscharo', 'Matterhorn'], richtig: 0 },
  { kategorie: 'Erde', frage: 'Welcher Fluss gilt als der längste der Welt?', antworten: ['Amazonas', 'Nil', 'Mississippi', 'Rhein'], richtig: 1 },
  { kategorie: 'Erde', frage: 'Wie viele Kontinente gibt es?', antworten: ['5', '6', '7', '8'], richtig: 2 },
  { kategorie: 'Erde', frage: 'Welches Land ist flächenmäßig das größte der Welt?', antworten: ['Kanada', 'China', 'USA', 'Russland'], richtig: 3 },
  { kategorie: 'Erde', frage: 'Wie heißt die Hauptstadt von Deutschland?', antworten: ['München', 'Berlin', 'Hamburg', 'Köln'], richtig: 1 },
  { kategorie: 'Erde', frage: 'Welcher Ozean ist der größte der Welt?', antworten: ['Atlantik', 'Pazifik', 'Indischer Ozean', 'Nordpolarmeer'], richtig: 1 },
  { kategorie: 'Erde', frage: 'In welchem Land steht die Freiheitsstatue?', antworten: ['Frankreich', 'USA', 'England', 'Kanada'], richtig: 1 },
  { kategorie: 'Erde', frage: 'Wie heißt die größte heiße Wüste der Welt?', antworten: ['Sahara', 'Gobi', 'Kalahari', 'Atacama'], richtig: 0 },
  { kategorie: 'Erde', frage: 'In welchem Land leben Kängurus und Koalas in freier Wildbahn?', antworten: ['Australien', 'Neuseeland', 'Südafrika', 'Brasilien'], richtig: 0 },
  { kategorie: 'Erde', frage: 'Wie heißt das Meer im Norden Deutschlands, an dem zum Beispiel Sylt liegt?', antworten: ['Mittelmeer', 'Nordsee', 'Rotes Meer', 'Adria'], richtig: 1 },

  // Weltraum
  { kategorie: 'Weltraum', frage: 'Wie viele Planeten hat unser Sonnensystem?', antworten: ['7', '8', '9', '10'], richtig: 1 },
  { kategorie: 'Weltraum', frage: 'Welcher Planet wird auch der "Rote Planet" genannt?', antworten: ['Venus', 'Mars', 'Jupiter', 'Saturn'], richtig: 1 },
  { kategorie: 'Weltraum', frage: 'Was ist die Sonne?', antworten: ['Ein Planet', 'Ein Stern', 'Ein Mond', 'Ein Komet'], richtig: 1 },
  { kategorie: 'Weltraum', frage: 'Welcher Planet hat die auffälligsten Ringe?', antworten: ['Jupiter', 'Saturn', 'Uranus', 'Neptun'], richtig: 1 },
  { kategorie: 'Weltraum', frage: 'Wie nennt man eine Gruppe von Sternen, die am Himmel ein Bild ergibt?', antworten: ['Sternbild', 'Galaxie', 'Nebel', 'Komet'], richtig: 0 },
  { kategorie: 'Weltraum', frage: 'Wer betrat 1969 als erster Mensch den Mond?', antworten: ['Juri Gagarin', 'Neil Armstrong', 'Buzz Aldrin', 'Michael Collins'], richtig: 1 },
  { kategorie: 'Weltraum', frage: 'Wie lange braucht die Erde für eine Umrundung der Sonne?', antworten: ['Ein Monat', 'Ein Jahr', 'Ein Tag', 'Zehn Jahre'], richtig: 1 },
  { kategorie: 'Weltraum', frage: 'Wie nennt man den Himmelskörper, der die Erde umkreist und nachts leuchtet?', antworten: ['Mond', 'Stern', 'Komet', 'Planet'], richtig: 0 },
  { kategorie: 'Weltraum', frage: 'Was ist ein Komet?', antworten: ['Ein Planet', 'Ein Klumpen aus Eis und Staub', 'Ein Stern', 'Ein Mond'], richtig: 1 },
  { kategorie: 'Weltraum', frage: 'Welcher ist der größte Planet in unserem Sonnensystem?', antworten: ['Saturn', 'Jupiter', 'Neptun', 'Erde'], richtig: 1 },

  // Körper & Gesundheit
  { kategorie: 'Körper', frage: 'Wie viele Knochen hat ein erwachsener Mensch ungefähr?', antworten: ['106', '206', '306', '406'], richtig: 1 },
  { kategorie: 'Körper', frage: 'Welches Organ pumpt das Blut durch den Körper?', antworten: ['Lunge', 'Herz', 'Leber', 'Magen'], richtig: 1 },
  { kategorie: 'Körper', frage: 'Wie viele Zähne hat ein erwachsener Mensch normalerweise?', antworten: ['28', '30', '32', '36'], richtig: 2 },
  { kategorie: 'Körper', frage: 'Womit atmen wir?', antworten: ['Herz', 'Lunge', 'Magen', 'Niere'], richtig: 1 },
  { kategorie: 'Körper', frage: 'Wie viele Sinne hat der Mensch klassischerweise?', antworten: ['3', '4', '5', '6'], richtig: 2 },
  { kategorie: 'Körper', frage: 'Welches ist das größte Organ des menschlichen Körpers?', antworten: ['Herz', 'Leber', 'Haut', 'Gehirn'], richtig: 2 },
  { kategorie: 'Körper', frage: 'In welchem Obst steckt besonders viel Vitamin C?', antworten: ['Banane', 'Orange', 'Kartoffel', 'Brot'], richtig: 1 },
  { kategorie: 'Körper', frage: 'Wie viele Kammern hat das menschliche Herz?', antworten: ['2', '3', '4', '5'], richtig: 2 },
  { kategorie: 'Körper', frage: 'Welches Organ hilft beim Verdauen der Nahrung?', antworten: ['Herz', 'Magen', 'Lunge', 'Gehirn'], richtig: 1 },
  { kategorie: 'Körper', frage: 'Wie viele Stunden Schlaf brauchen Kinder im Grundschulalter ungefähr pro Nacht?', antworten: ['5 Stunden', '10 Stunden', '15 Stunden', '20 Stunden'], richtig: 1 },

  // Geschichte
  { kategorie: 'Geschichte', frage: 'In welchem Jahrhundert leben wir gerade?', antworten: ['19.', '20.', '21.', '22.'], richtig: 2 },
  { kategorie: 'Geschichte', frage: 'Wer entdeckte 1492 aus europäischer Sicht den amerikanischen Kontinent?', antworten: ['Christoph Kolumbus', 'Marco Polo', 'Vasco da Gama', 'James Cook'], richtig: 0 },
  { kategorie: 'Geschichte', frage: 'Wie heißen die großen Bauwerke der alten Ägypter, in denen Pharaonen bestattet wurden?', antworten: ['Pyramiden', 'Tempel', 'Paläste', 'Türme'], richtig: 0 },
  { kategorie: 'Geschichte', frage: 'Welches Volk baute das Kolosseum in Rom?', antworten: ['Die Griechen', 'Die Römer', 'Die Ägypter', 'Die Wikinger'], richtig: 1 },
  { kategorie: 'Geschichte', frage: 'Wie nannte man die großen Reptilien, die vor Millionen Jahren lebten und heute ausgestorben sind?', antworten: ['Dinosaurier', 'Mammuts', 'Säbelzahntiger', 'Drachen'], richtig: 0 },
  { kategorie: 'Geschichte', frage: 'In welcher Stadt fiel 1989 die Mauer, die Deutschland geteilt hatte?', antworten: ['Berlin', 'München', 'Hamburg', 'Dresden'], richtig: 0 },
  { kategorie: 'Geschichte', frage: 'Wer schrieb bekannte Märchen wie "Aschenputtel" und "Rotkäppchen" auf?', antworten: ['Die Gebrüder Grimm', 'Hans Christian Andersen', 'Astrid Lindgren', 'Erich Kästner'], richtig: 0 },
  { kategorie: 'Geschichte', frage: 'Was waren Ritter im Mittelalter hauptsächlich?', antworten: ['Bauern', 'Berittene Krieger', 'Händler', 'Mönche'], richtig: 1 },
  { kategorie: 'Geschichte', frage: 'Wie hieß das Schiff, das 1912 nach einer Kollision mit einem Eisberg sank?', antworten: ['Titanic', 'Bismarck', 'Santa Maria', 'Mayflower'], richtig: 0 },
  { kategorie: 'Geschichte', frage: 'Wie viele Farben hat die deutsche Flagge?', antworten: ['2', '3', '4', '5'], richtig: 1 },

  // Sport
  { kategorie: 'Sport', frage: 'Wie viele Spieler hat eine Fußballmannschaft auf dem Feld (ohne Auswechselspieler)?', antworten: ['9', '10', '11', '12'], richtig: 2 },
  { kategorie: 'Sport', frage: 'Alle wie viele Jahre finden die Olympischen Sommerspiele statt?', antworten: ['2', '3', '4', '5'], richtig: 2 },
  { kategorie: 'Sport', frage: 'Welcher Sport wird mit Schläger und gelbem Filzball gespielt, unter anderem in Wimbledon?', antworten: ['Tennis', 'Federball', 'Tischtennis', 'Squash'], richtig: 0 },
  { kategorie: 'Sport', frage: 'Wie viele Ringe hat das olympische Symbol?', antworten: ['4', '5', '6', '7'], richtig: 1 },
  { kategorie: 'Sport', frage: 'Welche Sportart wird auf Eis mit Schlittschuhen und einem Puck gespielt?', antworten: ['Eishockey', 'Eiskunstlauf', 'Curling', 'Biathlon'], richtig: 0 },
  { kategorie: 'Sport', frage: 'Wie viele Punkte gibt ein gewöhnlicher Korb beim Basketball normalerweise?', antworten: ['1', '2', '3', '4'], richtig: 1 },
  { kategorie: 'Sport', frage: 'Welches Land hat die Fußball-Weltmeisterschaft der Männer am häufigsten gewonnen?', antworten: ['Deutschland', 'Brasilien', 'Argentinien', 'Italien'], richtig: 1 },
  { kategorie: 'Sport', frage: 'Wie nennt man es beim Schwimmen, wenn man auf dem Rücken liegend schwimmt?', antworten: ['Brustschwimmen', 'Rückenschwimmen', 'Kraulen', 'Delfinschwimmen'], richtig: 1 },

  // Kunst, Musik & Kultur
  { kategorie: 'Kunst', frage: 'Wie viele Saiten hat eine klassische Gitarre normalerweise?', antworten: ['4', '5', '6', '7'], richtig: 2 },
  { kategorie: 'Kunst', frage: 'Welches Instrument hat schwarze und weiße Tasten?', antworten: ['Gitarre', 'Klavier', 'Geige', 'Flöte'], richtig: 1 },
  { kategorie: 'Kunst', frage: 'Wer malte die berühmte "Mona Lisa"?', antworten: ['Pablo Picasso', 'Leonardo da Vinci', 'Vincent van Gogh', 'Michelangelo'], richtig: 1 },
  { kategorie: 'Kunst', frage: 'Welche zwei Farben ergeben zusammengemischt die Farbe Grün?', antworten: ['Rot und Blau', 'Blau und Gelb', 'Rot und Gelb', 'Schwarz und Weiß'], richtig: 1 },
  { kategorie: 'Kunst', frage: 'Wie viele Farben hat ein klassischer Regenbogen?', antworten: ['5', '6', '7', '8'], richtig: 2 },
  { kategorie: 'Kunst', frage: 'In welchem Land steht der Eiffelturm?', antworten: ['Italien', 'Frankreich', 'Spanien', 'England'], richtig: 1 },
  { kategorie: 'Kunst', frage: 'Wie nennt man ein Gemälde, auf dem eine Person dargestellt wird?', antworten: ['Porträt', 'Landschaft', 'Stillleben', 'Skizze'], richtig: 0 },
  { kategorie: 'Kunst', frage: 'Aus welchem Land stammt die Pizza ursprünglich?', antworten: ['Italien', 'Griechenland', 'Spanien', 'Frankreich'], richtig: 0 },

  // Technik & Erfindungen
  { kategorie: 'Technik', frage: 'Wer wird häufig als Erfinder der Glühbirne genannt?', antworten: ['Thomas Edison', 'Albert Einstein', 'Isaac Newton', 'Alexander Graham Bell'], richtig: 0 },
  { kategorie: 'Technik', frage: 'Wer erfand das Telefon?', antworten: ['Thomas Edison', 'Alexander Graham Bell', 'Nikola Tesla', 'Guglielmo Marconi'], richtig: 1 },
  { kategorie: 'Technik', frage: 'Womit kann man heute Nachrichten in Sekundenschnelle um die ganze Welt schicken?', antworten: ['Brief', 'Internet', 'Brieftaube', 'Fax'], richtig: 1 },
  { kategorie: 'Technik', frage: 'Wie nennt man ein Fahrzeug, das ganz ohne Fahrer selbst fahren kann?', antworten: ['Zug', 'Selbstfahrendes Auto', 'U-Bahn', 'Fahrrad'], richtig: 1 },
  { kategorie: 'Technik', frage: 'Was braucht ein Computer unbedingt, um zu funktionieren?', antworten: ['Wasser', 'Strom', 'Luft', 'Sonne'], richtig: 1 },
  { kategorie: 'Technik', frage: 'Wie nennt man das Gerät, mit dem man Fotos macht?', antworten: ['Kamera', 'Drucker', 'Scanner', 'Mikrofon'], richtig: 0 },
  { kategorie: 'Technik', frage: 'Wer gilt als Begründer der Relativitätstheorie?', antworten: ['Isaac Newton', 'Albert Einstein', 'Galileo Galilei', 'Stephen Hawking'], richtig: 1 },
  { kategorie: 'Technik', frage: 'Womit kann man heute Bücher lesen, ohne Papier zu benutzen?', antworten: ['E-Book-Reader', 'Radio', 'Fernseher', 'Wählscheibentelefon'], richtig: 0 },

  // Sprache & Wörter
  { kategorie: 'Sprache', frage: 'Wie viele Buchstaben hat das deutsche Standardalphabet?', antworten: ['24', '25', '26', '27'], richtig: 2 },
  { kategorie: 'Sprache', frage: 'Welches Wort ist das Gegenteil von "groß"?', antworten: ['klein', 'laut', 'schnell', 'hell'], richtig: 0 },
  { kategorie: 'Sprache', frage: 'Wie nennt man ein Wort, das vorwärts und rückwärts gelesen gleich klingt, z. B. "Anna"?', antworten: ['Palindrom', 'Synonym', 'Reim', 'Metapher'], richtig: 0 },
  { kategorie: 'Sprache', frage: 'Welches Satzzeichen steht am Ende einer Frage?', antworten: ['Punkt', 'Ausrufezeichen', 'Fragezeichen', 'Komma'], richtig: 2 },
  { kategorie: 'Sprache', frage: 'Wie viele Fälle (Kasus) gibt es in der deutschen Grammatik?', antworten: ['2', '3', '4', '5'], richtig: 2 },
  { kategorie: 'Sprache', frage: 'Welches Wort bedeutet ungefähr dasselbe wie "froh"?', antworten: ['glücklich', 'traurig', 'müde', 'wütend'], richtig: 0 },

  // Natur & Umwelt
  { kategorie: 'Natur', frage: 'Was brauchen Pflanzen zum Wachsen, neben Wasser und Erde, unbedingt?', antworten: ['Sonnenlicht', 'Salz', 'Zucker', 'Metall'], richtig: 0 },
  { kategorie: 'Natur', frage: 'Wie nennt man den Vorgang, bei dem Pflanzen mit Sonnenlicht ihre Nahrung herstellen?', antworten: ['Fotosynthese', 'Verdauung', 'Atmung', 'Gärung'], richtig: 0 },
  { kategorie: 'Natur', frage: 'Welches Gas atmen Menschen und Tiere zum Leben ein?', antworten: ['Kohlendioxid', 'Sauerstoff', 'Stickstoff', 'Wasserstoff'], richtig: 1 },
  { kategorie: 'Natur', frage: 'In welcher Jahreszeit verlieren die meisten Bäume in Deutschland ihre Blätter?', antworten: ['Frühling', 'Sommer', 'Herbst', 'Winter'], richtig: 2 },
  { kategorie: 'Natur', frage: 'Wie nennt man Regen, Schnee und Hagel zusammengefasst?', antworten: ['Niederschlag', 'Wetter', 'Klima', 'Wolken'], richtig: 0 },
  { kategorie: 'Natur', frage: 'Wie nennt man es, wenn Wasser verdunstet, zu Wolken wird und als Regen zurückfällt?', antworten: ['Wasserkreislauf', 'Gezeiten', 'Erosion', 'Verdunstung'], richtig: 0 },
  { kategorie: 'Natur', frage: 'Welche Jahreszeit kommt in Deutschland direkt nach dem Winter?', antworten: ['Sommer', 'Frühling', 'Herbst', 'Winter'], richtig: 1 },
  { kategorie: 'Natur', frage: 'Wie nennt man Tiere wie Frösche, die sowohl an Land als auch im Wasser leben können?', antworten: ['Reptilien', 'Amphibien', 'Fische', 'Säugetiere'], richtig: 1 },
  { kategorie: 'Natur', frage: 'Was passiert mit Eis, wenn man es erwärmt?', antworten: ['Es wird härter', 'Es schmilzt zu Wasser', 'Es verschwindet einfach', 'Es wird bunt'], richtig: 1 },
  { kategorie: 'Natur', frage: 'Wie nennt man Wälder mit besonders vielen Pflanzen- und Tierarten, zum Beispiel am Amazonas?', antworten: ['Regenwald', 'Nadelwald', 'Laubwald', 'Steppenwald'], richtig: 0 },

  // Zahlen & Mathe-Wissen
  { kategorie: 'Zahlen', frage: 'Wie viele Seiten hat ein Quadrat?', antworten: ['3', '4', '5', '6'], richtig: 1 },
  { kategorie: 'Zahlen', frage: 'Wie viele Minuten hat eine Stunde?', antworten: ['30', '45', '60', '100'], richtig: 2 },
  { kategorie: 'Zahlen', frage: 'Wie viele Tage hat ein normales Jahr (kein Schaltjahr)?', antworten: ['360', '365', '366', '370'], richtig: 1 },
  { kategorie: 'Zahlen', frage: 'Wie nennt man eine Zahl, die nur durch 1 und sich selbst teilbar ist?', antworten: ['Primzahl', 'Quadratzahl', 'Bruchzahl', 'Dezimalzahl'], richtig: 0 },
  { kategorie: 'Zahlen', frage: 'Wie viele Grad hat ein rechter Winkel?', antworten: ['45', '60', '90', '180'], richtig: 2 },
  { kategorie: 'Zahlen', frage: 'Wie viele Zentimeter hat ein Meter?', antworten: ['10', '100', '1000', '50'], richtig: 1 },
  { kategorie: 'Zahlen', frage: 'Wie nennt man ein Dreieck, bei dem alle drei Seiten gleich lang sind?', antworten: ['Rechtwinkliges Dreieck', 'Gleichseitiges Dreieck', 'Gleichschenkliges Dreieck', 'Stumpfes Dreieck'], richtig: 1 },
  { kategorie: 'Zahlen', frage: 'Wie viele Monate hat ein Jahr?', antworten: ['10', '11', '12', '13'], richtig: 2 },
  { kategorie: 'Zahlen', frage: 'Welches ist das kleinste Land der Welt?', antworten: ['Monaco', 'Vatikanstadt', 'Liechtenstein', 'San Marino'], richtig: 1 },
];
