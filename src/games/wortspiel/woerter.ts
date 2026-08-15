/**
 * Der Wortpool — reine Daten, keine Logik. Rechtschreibtraining für 10- bis
 * 12-Jährige: ein richtig geschriebenes Wort unter drei plausiblen
 * Fehlschreibungen erkennen. Jedes Wort hat vier Antworten (`richtig` ist
 * der Index der korrekten Schreibweise) und eine kurze Regel, die nach der
 * Antwort erklärt, warum die Schreibweise so ist — unabhängig davon, ob
 * richtig oder falsch geklickt wurde.
 *
 * `stufe` steuert die Schwierigkeit: 1 = kurze, häufige Wörter, 2 = mittel
 * (Umlaute, Doppelkonsonanten, Dehnungs-h), 3 = lang oder mit Fremdwort-
 * bzw. Fugenlaut-Tücken.
 *
 * Neue Wörter hier ergänzen — an der Logik ändert sich dadurch nichts.
 */

export type Wort = {
  antworten: readonly [string, string, string, string];
  richtig: 0 | 1 | 2 | 3;
  kategorie: string;
  regel: string;
  stufe: 1 | 2 | 3;
};

export const WOERTER: readonly Wort[] = [
  // Stufe 1 — kurze, häufige Wörter
  { kategorie: 'Tiere', antworten: ['Hund', 'Hunt', 'Hundt', 'Huhnd'], richtig: 0, stufe: 1, regel: 'Am Wortende hört man ein "t", geschrieben wird aber "d" — das zeigt die Mehrzahl "Hunde".' },
  { kategorie: 'Tiere', antworten: ['Katse', 'Katze', 'Kaze', 'Kadze'], richtig: 1, stufe: 1, regel: 'Nach kurzem Vokal steht "tz", nicht nur "z".' },
  { kategorie: 'Tiere', antworten: ['Fogel', 'Vogl', 'Vogel', 'Vokel'], richtig: 2, stufe: 1, regel: 'Man spricht das "V" hier wie ein "f", geschrieben wird trotzdem "V".' },
  { kategorie: 'Tiere', antworten: ['Mauss', 'Mous', 'Mauß', 'Maus'], richtig: 3, stufe: 1, regel: 'Am Wortende steht nach langem Vokal ein einfaches "s", kein "ß" und kein Doppel-s.' },
  { kategorie: 'Tiere', antworten: ['Fisch', 'Fisc', 'Visch', 'Fich'], richtig: 0, stufe: 1, regel: '"sch" bleibt immer zusammen, nie "sc" oder nur "s".' },
  { kategorie: 'Schule', antworten: ['Schuhle', 'Schule', 'Schuele', 'Schulle'], richtig: 1, stufe: 1, regel: 'Kein Dehnungs-h nach dem "u" — "Schule" schreibt man ohne "h".' },
  { kategorie: 'Schule', antworten: ['Heff', 'Häft', 'Heft', 'Heeft'], richtig: 2, stufe: 1, regel: 'Am Wortende steht "ft", nicht "ff" — das hört man in "Hefte".' },
  { kategorie: 'Schule', antworten: ['Taffel', 'Dafel', 'Tavel', 'Tafel'], richtig: 3, stufe: 1, regel: 'Nur ein "f", kein Doppel-f, und am Anfang ein "T", kein "D".' },
  { kategorie: 'Schule', antworten: ['Pause', 'Pauze', 'Bause', 'Pausse'], richtig: 0, stufe: 1, regel: 'Am Anfang steht ein "P", kein "B", und in der Mitte "us", kein "uz".' },
  { kategorie: 'Schule', antworten: ['Leerer', 'Lehrer', 'Lerer', 'Lehrrer'], richtig: 1, stufe: 1, regel: 'Dehnungs-h nach dem "e", weil der Vokal lang gesprochen wird.' },
  { kategorie: 'Alltag', antworten: ['Waser', 'Wassa', 'Wasser', 'Vasser'], richtig: 2, stufe: 1, regel: 'Nach kurzem Vokal steht "ss", kein einfaches "s".' },
  { kategorie: 'Alltag', antworten: ['Tich', 'Disch', 'Tisc', 'Tisch'], richtig: 3, stufe: 1, regel: '"sch" bleibt zusammen, und am Anfang steht "T", kein "D".' },
  { kategorie: 'Alltag', antworten: ['Fenster', 'Venster', 'Fänster', 'Fenser'], richtig: 0, stufe: 1, regel: 'Am Anfang steht ein "F", kein "V", der Vokal in der Mitte bleibt "e".' },
  { kategorie: 'Alltag', antworten: ['Zimer', 'Zimmer', 'Cimmer', 'Zimmär'], richtig: 1, stufe: 1, regel: 'Nach kurzem Vokal steht "mm", das Doppel-m, nicht nur ein "m".' },
  // „Kühe" stand hier als Fehlschreibung von „Küche" — es ist aber der
  // völlig korrekt geschriebene Plural von Kuh. Ein Kind, das das weiß,
  // wurde für richtiges Wissen bestraft. Ersetzt durch „Kücke", eine
  // echte Falle (ck statt ch).
  { kategorie: 'Alltag', antworten: ['Kueche', 'Küsche', 'Küche', 'Kücke'], richtig: 2, stufe: 1, regel: '"ü" mit Umlautpunkten, nicht "ue", und in der Mitte "ch" — nicht "sch" und nicht "ck".' },
  { kategorie: 'Natur', antworten: ['Bawm', 'Boum', 'Baumm', 'Baum'], richtig: 3, stufe: 1, regel: '"au" bleibt zusammen als ein Laut, kein "aw" oder "ou".' },
  { kategorie: 'Natur', antworten: ['Blume', 'Bluhme', 'Plume', 'Blumme'], richtig: 0, stufe: 1, regel: 'Kein Dehnungs-h nach dem "u", und nur ein "m".' },
  { kategorie: 'Natur', antworten: ['Sone', 'Sonne', 'Zonne', 'Sonnä'], richtig: 1, stufe: 1, regel: 'Nach kurzem Vokal steht "nn", das Doppel-n.' },
  { kategorie: 'Natur', antworten: ['Wollke', 'Volke', 'Wolke', 'Wolge'], richtig: 2, stufe: 1, regel: 'Am Anfang steht "W", kein "V", und nur ein "l".' },
  { kategorie: 'Natur', antworten: ['Rehgen', 'Reegen', 'Rägen', 'Regen'], richtig: 3, stufe: 1, regel: 'Kein Dehnungs-h und kein Doppel-e — der lange Vokal wird einfach geschrieben.' },
  { kategorie: 'Essen', antworten: ['Apfel', 'Appfel', 'Abfel', 'Apfell'], richtig: 0, stufe: 1, regel: 'Nur ein "p", kein Doppel-p.' },
  { kategorie: 'Essen', antworten: ['Broht', 'Brot', 'Brod', 'Prot'], richtig: 1, stufe: 1, regel: 'Am Ende steht "t", kein "d" — das zeigt die Mehrzahl "Brote".' },
  { kategorie: 'Essen', antworten: ['Milsch', 'Mielch', 'Milch', 'Milg'], richtig: 2, stufe: 1, regel: '"ch" nach dem "l", nicht "sch".' },
  { kategorie: 'Essen', antworten: ['Supe', 'Zuppe', 'Suppä', 'Suppe'], richtig: 3, stufe: 1, regel: 'Nach kurzem Vokal steht "pp", das Doppel-p.' },
  { kategorie: 'Essen', antworten: ['Kuchen', 'Kuhchen', 'Kuggen', 'Kuchän'], richtig: 0, stufe: 1, regel: 'Kein Dehnungs-h nach dem "u" — nur "Kuchen", nicht "Kuhchen".' },
  { kategorie: 'Körper', antworten: ['Hant', 'Hand', 'Handt', 'Hend'], richtig: 1, stufe: 1, regel: 'Am Ende steht "d", kein "t" — das zeigt die Mehrzahl "Hände".' },
  { kategorie: 'Körper', antworten: ['Kopv', 'Kopph', 'Kopf', 'Copf'], richtig: 2, stufe: 1, regel: 'Am Ende steht "pf", nicht "v" oder "ph".' },
  { kategorie: 'Gefühle', antworten: ['fro', 'vroh', 'froch', 'froh'], richtig: 3, stufe: 1, regel: 'Nach dem langen "o" steht ein Dehnungs-h.' },
  { kategorie: 'Gefühle', antworten: ['müde', 'mühde', 'mide', 'müede'], richtig: 0, stufe: 1, regel: '"ü" mit Umlautpunkten, kein Dehnungs-h nötig.' },
  { kategorie: 'Gefühle', antworten: ['lawt', 'laut', 'lauth', 'laud'], richtig: 1, stufe: 1, regel: '"au" bleibt zusammen, am Ende steht "t", kein "d".' },

  // Stufe 2 — Umlaute, Doppelkonsonanten, Dehnungs-h
  { kategorie: 'Technik', antworten: ['Farrad', 'Fahrad', 'Fahrrad', 'Farhad'], richtig: 2, stufe: 2, regel: 'Zusammengesetzt aus "fahren" und "Rad" — deshalb zwei "r" und ein Dehnungs-h.' },
  { kategorie: 'Alltag', antworten: ['Bäker', 'Bäckär', 'Bäkker', 'Bäcker'], richtig: 3, stufe: 2, regel: '"ä" mit Umlautpunkten, und nach kurzem Vokal steht "ck".' },
  { kategorie: 'Sport', antworten: ['Fußball', 'Fussball', 'Fusball', 'Fuhsball'], richtig: 0, stufe: 2, regel: 'Nach langem "u" steht "ß", kein Doppel-s.' },
  { kategorie: 'Alltag', antworten: ['Strasse', 'Straße', 'Strase', 'Strahse'], richtig: 1, stufe: 2, regel: 'Nach langem "a" steht "ß", kein "ss".' },
  { kategorie: 'Essen', antworten: ['Schokolate', 'Zschokolade', 'Schokolade', 'Schokollade'], richtig: 2, stufe: 2, regel: 'Am Anfang nur "Sch", kein zusätzliches "Z", und am Ende "de", kein Doppel-l.' },
  { kategorie: 'Familie', antworten: ['Geschwiester', 'Geschvister', 'Geschwistär', 'Geschwister'], richtig: 3, stufe: 2, regel: 'Kein Dehnungs-e, und am Anfang "Ge-schw-", nicht "Ge-schv-".' },
  { kategorie: 'Familie', antworten: ['Freund', 'Freundt', 'Freud', 'Fräund'], richtig: 0, stufe: 2, regel: 'Am Ende steht "nd", nicht nur "d" — das zeigt die Mehrzahl "Freunde".' },
  { kategorie: 'Natur', antworten: ['Wise', 'Wiese', 'Wihese', 'Wiesse'], richtig: 1, stufe: 2, regel: '"ie" klingt lang wie "i", aber geschrieben wird immer "ie".' },
  { kategorie: 'Schule', antworten: ['Papir', 'Papiehr', 'Papier', 'Pappier'], richtig: 2, stufe: 2, regel: 'Am Ende steht "ier", kein einfaches "ir" und kein Dehnungs-h.' },
  { kategorie: 'Schule', antworten: ['Ferihen', 'Verien', 'Ferrien', 'Ferien'], richtig: 3, stufe: 2, regel: 'Am Anfang steht "F", kein "V", und kein Dehnungs-h in der Mitte.' },
  { kategorie: 'Familie', antworten: ['Familie', 'Famielie', 'Vamilie', 'Familje'], richtig: 0, stufe: 2, regel: 'Am Ende steht "ie", nicht "je", und in der Mitte kein Dehnungs-i.' },
  { kategorie: 'Familie', antworten: ['Geburzstag', 'Geburtstag', 'Gebuhrtstag', 'Geburtstagg'], richtig: 1, stufe: 2, regel: 'Zusammengesetzt aus "Geburt" und "Tag" — "burts", nicht "burz".' },
  { kategorie: 'Technik', antworten: ['Vernseher', 'Fernzeher', 'Fernseher', 'Fehrnseher'], richtig: 2, stufe: 2, regel: 'Am Anfang steht "F", kein "V", in der Mitte "se", kein "ze".' },
  { kategorie: 'Schule', antworten: ['Bleistieft', 'Bleystift', 'Bleisstift', 'Bleistift'], richtig: 3, stufe: 2, regel: 'In der Mitte steht "stift", nicht "stieft", und nur ein "s" davor.' },
  { kategorie: 'Schule', antworten: ['Rucksack', 'Ruckzack', 'Rucksak', 'Rukzack'], richtig: 0, stufe: 2, regel: 'Zusammengesetzt aus "Rücken" und "Sack" — deshalb "ck" in der Mitte.' },
  { kategorie: 'Essen', antworten: ['Löfel', 'Löffel', 'Loeffel', 'Löffell'], richtig: 1, stufe: 2, regel: 'Nach kurzem Vokal steht "ff", das Doppel-f.' },
  { kategorie: 'Essen', antworten: ['Gabbel', 'Gabhel', 'Gabel', 'Gabäl'], richtig: 2, stufe: 2, regel: 'Am Anfang steht "G", kein "K", und kein Dehnungs-h.' },
  { kategorie: 'Essen', antworten: ['Teler', 'Dehler', 'Tellär', 'Teller'], richtig: 3, stufe: 2, regel: 'Nach kurzem Vokal steht "ll", das Doppel-l.' },
  { kategorie: 'Alltag', antworten: ['Treppe', 'Trepe', 'Träppe', 'Treppä'], richtig: 0, stufe: 2, regel: 'Nach kurzem Vokal steht "pp", das Doppel-p.' },
  { kategorie: 'Alltag', antworten: ['Schranck', 'Schrank', 'Schrang', 'Schrangk'], richtig: 1, stufe: 2, regel: 'Am Ende steht "nk", nicht "ng" oder "ngk".' },
  { kategorie: 'Alltag', antworten: ['Spigel', 'Spiehgel', 'Spiegel', 'Spiegäl'], richtig: 2, stufe: 2, regel: '"ie" klingt lang, wird aber immer als "ie" geschrieben.' },
  { kategorie: 'Technik', antworten: ['Farzeug', 'Fahrtzeug', 'Fahrzoig', 'Fahrzeug'], richtig: 3, stufe: 2, regel: 'Zusammengesetzt aus "fahren" und "Zeug" — "rz", nicht nur "r".' },
  { kategorie: 'Natur', antworten: ['Gewitter', 'Gevitter', 'Gewiter', 'Gewittär'], richtig: 0, stufe: 2, regel: 'Am Anfang steht "Ge-w-", kein "Ge-v-".' },
  { kategorie: 'Tiere', antworten: ['Schmätterling', 'Schmetterling', 'Schmetterlink', 'Schmeterling'], richtig: 1, stufe: 2, regel: '"e" statt "ä" in der ersten Silbe, das lernt man am besten auswendig.' },
  { kategorie: 'Tiere', antworten: ['Eichhörnchän', 'Eichörnchen', 'Eichhörnchen', 'Eichhörnschen'], richtig: 2, stufe: 2, regel: 'Zusammengesetzt aus "Eiche" und "Hörnchen" — deshalb "hh" in der Mitte.' },
  { kategorie: 'Jahreszeiten', antworten: ['Fruehling', 'Frühlingk', 'Frühlink', 'Frühling'], richtig: 3, stufe: 2, regel: '"ü" mit Umlautpunkten, kein "ue", am Ende "ng", kein "nk".' },
  { kategorie: 'Jahreszeiten', antworten: ['Herbst', 'Herpst', 'Härbst', 'Herbszt'], richtig: 0, stufe: 2, regel: 'In der Mitte steht "b", kein "p" — das hört man in "herbstlich".' },
  { kategorie: 'Essen', antworten: ['Gemühse', 'Gemüse', 'Gemyse', 'Gemüsse'], richtig: 1, stufe: 2, regel: '"ü" mit Umlautpunkten, am Ende ein einfaches "s".' },
  { kategorie: 'Essen', antworten: ['Zwibel', 'Tswiebel', 'Zwiebel', 'Zwiebäl'], richtig: 2, stufe: 2, regel: '"ie" bleibt zusammen, am Anfang "Zw-", kein "Tsw-".' },
  { kategorie: 'Essen', antworten: ['Ertbeere', 'Erdbehre', 'Erdbeerä', 'Erdbeere'], richtig: 3, stufe: 2, regel: 'Zusammengesetzt aus "Erde" und "Beere" — deshalb "rdb", kein "rtb".' },

  // Stufe 3 — lange Wörter, Fremdwörter, Fugenlaute
  { kategorie: 'Technik', antworten: ['Fotografie', 'Photographie', 'Fotografi', 'Fotokrafie'], richtig: 0, stufe: 3, regel: 'Die moderne Schreibweise ist mit "F", nicht mit "Ph".' },
  { kategorie: 'Technik', antworten: ['Telephon', 'Telefon', 'Teleffon', 'Telefonn'], richtig: 1, stufe: 3, regel: 'Die moderne Schreibweise ist mit "f", nicht mit "ph".' },
  { kategorie: 'Alltag', antworten: ['Situazion', 'Sittuation', 'Situation', 'Situatsion'], richtig: 2, stufe: 3, regel: 'Am Ende steht "tion", nicht "zion" oder "tsion".' },
  { kategorie: 'Schule', antworten: ['Informazion', 'Informattion', 'Informasjon', 'Information'], richtig: 3, stufe: 3, regel: 'Am Ende steht "tion", nicht "zion", "ttion" oder "sjon".' },
  { kategorie: 'Schule', antworten: ['Bibliothek', 'Biliothek', 'Bibliotek', 'Bibliothäk'], richtig: 0, stufe: 3, regel: 'In der Mitte steht "bli", mit zwei "b", und am Ende "ek", kein Umlaut.' },
  { kategorie: 'Schule', antworten: ['Matematik', 'Mathematik', 'Mathematick', 'Mathhematik'], richtig: 1, stufe: 3, regel: 'Am Anfang steht "th", nicht nur "t".' },
  { kategorie: 'Musik', antworten: ['Rytmus', 'Rhytmus', 'Rhythmus', 'Rhythmuss'], richtig: 2, stufe: 3, regel: 'Ein besonders schwieriges Wort: am Anfang "Rh", in der Mitte "th", kein Doppel-s am Ende.' },
  { kategorie: 'Alltag', antworten: ['Restorant', 'Restaurannt', 'Restaurand', 'Restaurant'], richtig: 3, stufe: 3, regel: 'Ein Fremdwort aus dem Französischen — wird so geschrieben, wie es übernommen wurde.' },
  { kategorie: 'Technik', antworten: ['Computer', 'Kompjuter', 'Computa', 'Kommputer'], richtig: 0, stufe: 3, regel: 'Ein englisches Fremdwort — wird auf Deutsch genauso geschrieben wie im Original.' },
  { kategorie: 'Technik', antworten: ['Innternet', 'Internet', 'Intärnet', 'Internett'], richtig: 1, stufe: 3, regel: 'Nur ein "n" am Anfang, am Ende ein einfaches "t".' },
  { kategorie: 'Sport', antworten: ['Farradhelm', 'Fahrradhelmm', 'Fahrradhelm', 'Fahrrathelm'], richtig: 2, stufe: 3, regel: 'Zusammengesetzt aus "Fahrrad" und "Helm" — beide Teile bleiben ganz erhalten.' },
  { kategorie: 'Alltag', antworten: ['Hantschuhe', 'Handschue', 'Handtschuhe', 'Handschuhe'], richtig: 3, stufe: 3, regel: 'Zusammengesetzt aus "Hand" und "Schuhe" — deshalb "nd" in der Mitte.' },
  { kategorie: 'Alltag', antworten: ['Nachbarschaft', 'Nachbahrschaft', 'Nachparschaft', 'Nachbarshaft'], richtig: 0, stufe: 3, regel: 'Zusammengesetzt aus "Nachbar" und "-schaft" — "bar", nicht "bahr" oder "par".' },
  { kategorie: 'Schule', antworten: ['Wörtärbuch', 'Wörterbuch', 'Wörterbuh', 'Wörtebuch'], richtig: 1, stufe: 3, regel: 'Zusammengesetzt aus "Wörter" und "Buch" — beide Teile bleiben ganz erhalten.' },
  { kategorie: 'Alltag', antworten: ['Verapredung', 'Verabredunk', 'Verabredung', 'Ferabredung'], richtig: 2, stufe: 3, regel: 'Am Anfang "Ver-", in der Mitte "b", kein "p".' },
  { kategorie: 'Sprache', antworten: ['entschuldigän', 'entschultigen', 'entschuldiegen', 'entschuldigen'], richtig: 3, stufe: 3, regel: 'In der Mitte steht "schuld", wie im Wort "Schuld", kein "t" davor.' },
  { kategorie: 'Technik', antworten: ['Geschwindigkeit', 'Geschwindichkeit', 'Geschwintigkeit', 'Geschwindigkeitt'], richtig: 0, stufe: 3, regel: 'In der Mitte steht "digkeit", kein "dichkeit" oder "tigkeit".' },
  { kategorie: 'Alltag', antworten: ['Verantworttung', 'Verantwortung', 'Verantwordung', 'Verantwortunk'], richtig: 1, stufe: 3, regel: 'Zusammengesetzt aus "ver-" und "Antwort" — "wort", nicht "word".' },
  { kategorie: 'Schule', antworten: ['Wisenschaft', 'Wissenschafft', 'Wissenschaft', 'Wissentschaft'], richtig: 2, stufe: 3, regel: 'Nach kurzem Vokal steht "ss", am Ende nur ein "ft", kein Doppel-f oder "t" davor.' },
  { kategorie: 'Körper', antworten: ['Gesundheid', 'Gezundheit', 'Gesuntheit', 'Gesundheit'], richtig: 3, stufe: 3, regel: 'Am Ende steht "heit", nicht "heid", und in der Mitte "s", kein "z".' },
  { kategorie: 'Familie', antworten: ['Freundschaft', 'Freuntschaft', 'Fröindschaft', 'Freundschafd'], richtig: 0, stufe: 3, regel: 'Zusammengesetzt aus "Freund" und "-schaft" — beide Teile bleiben ganz erhalten.' },
  { kategorie: 'Alltag', antworten: ['Uberraschung', 'Überraschung', 'Überaschung', 'Überraschunk'], richtig: 1, stufe: 3, regel: 'Am Anfang steht "Ü" mit Umlautpunkten, nicht nur "U".' },
  { kategorie: 'Sprache', antworten: ['Entschuldigunk', 'Entschultigung', 'Entschuldigung', 'Endschuldigung'], richtig: 2, stufe: 3, regel: 'Wie bei "entschuldigen" steht in der Mitte "schuld", kein "t" davor.' },
  { kategorie: 'Alltag', antworten: ['Selbststendig', 'Selpstständig', 'Selbstständich', 'Selbstständig'], richtig: 3, stufe: 3, regel: 'Zusammengesetzt aus "selbst" und "ständig" — deshalb tatsächlich drei "s" hintereinander.' },
  { kategorie: 'Sprache', antworten: ['Verabschiedung', 'Verapschiedung', 'Verabschidung', 'Verabschiedunk'], richtig: 0, stufe: 3, regel: 'Am Anfang "Ver-", in der Mitte "b", kein "p", und "schied" wie in "Abschied".' },
  { kategorie: 'Jahreszeiten', antworten: ['Jahrezeiten', 'Jahreszeiten', 'Jahreszeitn', 'Jahrezeitten'], richtig: 1, stufe: 3, regel: 'Zusammengesetzt aus "Jahr" und "Zeiten" — mit "s" als Fugenlaut dazwischen.' },
  { kategorie: 'Jahreszeiten', antworten: ['Weinachten', 'Weyhnachten', 'Weihnachten', 'Weihnachtän'], richtig: 2, stufe: 3, regel: 'Nach dem "W" kommt "eih" mit Dehnungs-h, ein besonders unregelmäßiges Wort.' },
  { kategorie: 'Jahreszeiten', antworten: ['Geschänke', 'Geschenkte', 'Geschennke', 'Geschenke'], richtig: 3, stufe: 3, regel: 'Der Vokal in der Mitte bleibt "e", wird nicht zu "ä".' },
  { kategorie: 'Alltag', antworten: ['Lieblingsfarbe', 'Liblingsfarbe', 'Lieblingsvarbe', 'Lieblingsfarbä'], richtig: 0, stufe: 3, regel: 'Zusammengesetzt aus "Lieblings-" und "Farbe" — "Lieblings" braucht das "e" vor dem "b".' },
  { kategorie: 'Schule', antworten: ['Klasenzimmer', 'Klassenzimmer', 'Klassenzimer', 'Klassenzimmär'], richtig: 1, stufe: 3, regel: 'Zusammengesetzt aus "Klasse" und "Zimmer" — beide Teile behalten ihren Doppelkonsonanten.' },
];
