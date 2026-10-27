#!/usr/bin/env node
/**
 * Publishes three SEO articles for the 2026/27 winter season.
 *
 *   node scripts/seed-blogs-reifen-2026.mjs --dry   # print, write nothing
 *   node scripts/seed-blogs-reifen-2026.mjs         # upsert by slug
 *
 * Facts verified against ADAC (Winterreifentest 22.09.2026,
 * Ganzjahresreifentest 23.06.2026) and the StVO rules on winter tyres.
 * Text links use "[Text](/pfad)" — rendered as internal links by the site.
 * Cover images: upload later via the blog admin (update endpoint).
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Blog from "../src/models/Blog.js";

dotenv.config();

const h2 = (text) => ({ type: "heading", level: "h2", text });
const h3 = (text) => ({ type: "heading", level: "h3", text });
const p = (text) => ({ type: "paragraph", text });
const ul = (items) => ({ type: "list", style: "ul", items });
const ol = (items) => ({ type: "list", style: "ol", items });

const posts = [
  // ------------------------------------------------------------------ 1
  {
    slug: "winterreifenpflicht-2026-alpine-symbol-bussgeld",
    coverImage: "/images/blogs/winterreifenpflicht-2026.webp",
    title: "Winterreifenpflicht 2026: Alpine-Symbol, Bußgeld und Profiltiefe – alle Regeln",
    metaDescription:
      "Winterreifenpflicht 2026 in Deutschland: Wann Winterreifen Pflicht sind, warum M+S nicht mehr reicht, welche Bußgelder drohen und wie viel Profil nötig ist.",
    tags: ["Winterreifenpflicht", "Winterreifen", "Alpine-Symbol", "Bußgeld", "Ratgeber"],
    contentBlocks: [
      [
        p(
          "Die ersten Nachtfröste sind da, und mit ihnen die Frage: Muss ich jetzt Winterreifen aufziehen? In Deutschland gibt es kein festes Datum, sondern eine situative Winterreifenpflicht. Was genau gilt, warum ältere M+S-Reifen nicht mehr ausreichen und welche Strafen drohen, lesen Sie hier – kompakt und aktuell für den Winter 2026/27."
        ),
      ],
      [
        h2("Was bedeutet situative Winterreifenpflicht?"),
        p(
          "Geregelt ist die Pflicht in § 2 Absatz 3a der Straßenverkehrs-Ordnung (StVO). Danach dürfen Sie bei Glatteis, Schneeglätte, Schneematsch, Eisglätte oder Reifglätte nur mit Reifen fahren, die für winterliche Verhältnisse zugelassen sind. Entscheidend ist also das Wetter auf der Straße – nicht der Kalender."
        ),
        p(
          "Die bekannte Faustregel „von O bis O“ (Oktober bis Ostern) ist deshalb keine Vorschrift, sondern eine praktische Empfehlung: In diesem Zeitraum muss man jederzeit mit Glätte rechnen. Wer im Oktober noch mit [Sommerreifen](/sommerreifen) unterwegs ist und morgens Reifglätte vorfindet, verstößt bereits gegen die Pflicht."
        ),
      ],
      [
        h2("Alpine-Symbol statt M+S: Was seit Oktober 2024 gilt"),
        p(
          "Als Winterreifen zählen nur noch Reifen mit dem Alpine-Symbol – dem Bergpiktogramm mit Schneeflocke (3PMSF). Es zeigt, dass der Reifen einen genormten Test auf Schnee bestanden hat. Die alte Kennzeichnung M+S (Matsch und Schnee) ist dagegen kein Qualitätsnachweis, sie darf der Hersteller selbst aufbringen."
        ),
        p(
          "Für reine M+S-Reifen, die bis Ende 2017 hergestellt wurden, gab es eine Übergangsfrist. Sie ist am 30. September 2024 abgelaufen. Seit dem 1. Oktober 2024 erfüllen Reifen nur mit M+S-Kennung die Winterreifenpflicht nicht mehr – egal, wie viel Profil sie noch haben."
        ),
        ul([
          "Prüfen Sie die Reifenflanke: Fehlt das Bergpiktogramm mit Schneeflocke, ist der Reifen kein Winterreifen im Sinne der StVO.",
          "[Ganzjahresreifen](/ganzjahresreifen) sind erlaubt, wenn sie das Alpine-Symbol tragen.",
          "Das Alter steht in der DOT-Nummer: Die letzten vier Ziffern nennen Produktionswoche und -jahr, „4023“ heißt zum Beispiel 40. Woche 2023.",
        ]),
      ],
      [
        h2("Bußgeld: Was ohne Winterreifen droht"),
        p(
          "Wer bei winterlichen Verhältnissen mit falschen Reifen fährt, zahlt laut Bußgeldkatalog mindestens 60 Euro und erhält einen Punkt in Flensburg. Die Beträge steigen, wenn andere dadurch beeinträchtigt werden:"
        ),
        ul([
          "Fahren ohne geeignete Reifen: 60 € und 1 Punkt",
          "mit Behinderung anderer: 80 € und 1 Punkt",
          "mit Gefährdung anderer: 100 € und 1 Punkt",
          "mit Unfall: 120 € und 1 Punkt",
          "Halter, der die Fahrt zulässt: 75 € und 1 Punkt",
        ]),
        p(
          "Teurer als das Bußgeld kann der Versicherungsschutz werden: Bei einem Unfall mit Sommerreifen auf Schnee kann die Kaskoversicherung wegen grober Fahrlässigkeit kürzen."
        ),
      ],
      [
        h2("Wie viel Profil brauchen Winterreifen?"),
        p(
          "Gesetzlich vorgeschrieben sind 1,6 Millimeter Restprofil – für alle Reifen. Auf Schnee reicht das aber nicht für sicheren Grip. Der ADAC empfiehlt, Winterreifen bei weniger als vier Millimetern zu ersetzen, weil die Leistung mit sinkender Profiltiefe deutlich nachlässt."
        ),
        p(
          "Auch das Alter zählt: Die Gummimischung härtet mit den Jahren aus. Der ADAC rät, Winterreifen spätestens nach acht Jahren zu tauschen – unabhängig vom Profil."
        ),
        h3("Profil schnell selbst prüfen"),
        ol([
          "Eine 1-Euro-Münze in die Hauptrille stecken.",
          "Der goldene Rand ist etwa 3 mm breit: Ist er noch sichtbar, liegt das Profil unter 3 mm – Winterreifen ersetzen.",
          "Verschwindet der Rand ganz, genau nachmessen: Für Winterreifen sollten es mindestens 4 mm sein.",
        ]),
      ],
      [
        h2("Welche Winterreifen passen zu meinem Auto?"),
        p(
          "Die zulässigen Größen stehen in der Zulassungsbescheinigung Teil I und im CoC-Papier. Die häufigsten Größen in Deutschland sind etwa [205/55 R16](/reifen/205-55-r16), [195/65 R15](/reifen/195-65-r15) und [225/45 R17](/reifen/225-45-r17). Ein Sonderfall: Winterreifen dürfen einen niedrigeren Geschwindigkeitsindex haben als im Fahrzeugschein steht – dann muss ein Hinweisaufkleber mit der Höchstgeschwindigkeit im Sichtfeld kleben."
        ),
        p(
          "Was Winterreifen für Ihr Modell heute kosten, zeigt unser [Reifen-Preisrechner](/artikel/reifenpreise-2026-preisrechner): Automarke und Modell wählen, fertig."
        ),
        p(
          "Welche Modelle im aktuellen Test gut abschneiden, lesen Sie im Artikel [ADAC Winterreifentest 2026](/artikel/adac-winterreifentest-2026-testsieger). Die aktuellen Preise aller Händler finden Sie in unserem [Winterreifen-Preisvergleich](/winterreifen)."
        ),
      ],
      [
        h2("Das Wichtigste in Kürze"),
        ul([
          "Winterreifen sind bei Glätte, Schnee und Matsch Pflicht – ein festes Datum gibt es nicht.",
          "Seit 1. Oktober 2024 zählt nur das Alpine-Symbol; reine M+S-Reifen reichen nicht mehr.",
          "Bußgeld ab 60 € plus 1 Punkt, für Halter 75 € plus 1 Punkt.",
          "Gesetzlich 1,6 mm Profil, empfohlen mindestens 4 mm; nach spätestens acht Jahren tauschen.",
        ]),
      ],
    ],
  },

  // ------------------------------------------------------------------ 2
  {
    slug: "adac-winterreifentest-2026-testsieger",
    coverImage: "/images/blogs/winterreifentest-2026.webp",
    title: "ADAC Winterreifentest 2026: Testsieger, Verlierer und alle Noten",
    metaDescription:
      "ADAC Winterreifentest 2026: Continental, Pirelli, Michelin und Goodyear vorn, neun Reifen mangelhaft. Alle Noten für 185/65 R15 und 225/50 R17 im Überblick.",
    tags: ["Winterreifen Test 2026", "ADAC", "Winterreifen", "Reifentest", "Testsieger"],
    contentBlocks: [
      [
        p(
          "Der ADAC hat am 22. September 2026 seinen Winterreifentest veröffentlicht: 32 Reifen in zwei Größen, geprüft auf trockener, nasser, verschneiter und vereister Fahrbahn sowie bei Verschleiß, Abrieb und Effizienz. Das Ergebnis ist deutlich – neun Reifen fallen mit „mangelhaft“ durch, und nur sechs Modelle erreichen die Note „gut“."
        ),
      ],
      [
        h2("Getestete Größen"),
        ul([
          "[185/65 R15](/reifen/185-65-r15) – typisch für Kleinwagen wie VW Polo, Renault Clio, Opel Corsa, Peugeot 208 oder Seat Ibiza (16 Reifen)",
          "[225/50 R17](/reifen/225-50-r17) – typisch für die Mittelklasse wie Audi A4, BMW 3er oder Mercedes C-Klasse (16 Reifen)",
        ]),
        p(
          "Die Schneeprüfungen fanden in Finnland statt. Bewertet wird zu 70 Prozent die Fahrsicherheit und zu 30 Prozent die Umweltbilanz. Ist ein Reifen in einer sicherheitsrelevanten Disziplin schwach, wertet der ADAC die Gesamtnote ab – ein guter Schneereifen mit schlechtem Nassbremsweg kann also nicht gut abschneiden."
        ),
      ],
      [
        h2("Ergebnisse 185/65 R15 (Kleinwagen)"),
        p(
          "Nur zwei von 16 Reifen sind „gut“. Neun Modelle bewertet der ADAC mit „ausreichend“ oder „mangelhaft“ und spricht für sie keine Empfehlung aus."
        ),
        ol([
          "[Continental](/marken/continental) WinterContact TS 870 – 2,2 (gut), Testsieger",
          "[Michelin](/marken/michelin) Alpin 7 – 2,5 (gut)",
          "Hankook Winter i*cept RS3 – 3,1 (befriedigend)",
          "Linglong Sport Master Winter – 3,1 (befriedigend)",
          "Optimo Winter Touring OW41 – 3,2 (befriedigend)",
          "Goodyear UltraGrip Performance 3 – 3,3 (befriedigend)",
          "GT Radial WinterPro2 Evo – 3,5 (befriedigend)",
          "Bridgestone Blizzak LM 005, Nokian Tyres Snowproof 2, Vredestein Wintrac, Barum Polaris 6 – je 3,8 (ausreichend)",
          "Kumho WinterCraft WP52+, Viking WinTech NewGen – je 3,9 (ausreichend)",
          "Sunny Winter-max NW611 – 4,8 (mangelhaft)",
          "Atlas Polarbear HP, Rockblade Rock 868S – je 5,5 (mangelhaft)",
        ]),
        p(
          "Die drei mangelhaften Reifen scheitern an schwacher Fahrsicherheit. Auffällig ist der chinesische Linglong Sport Master Winter, der sich mit 3,1 vor mehreren Premiumreifen platziert."
        ),
      ],
      [
        h2("Ergebnisse 225/50 R17 (Mittelklasse)"),
        p(
          "In der größeren Dimension erreichen vier Reifen die Note „gut“ – aber sechs fallen durch. Der ADAC begründet das mit fehlender Ausgewogenheit: In mindestens einer Disziplin sind die Leistungen so schwach, dass sie die Sicherheit gefährden."
        ),
        ol([
          "Pirelli Cinturato Winter 3 – 2,2 (gut), Testsieger, besonders stark auf nasser Fahrbahn",
          "[Continental](/marken/continental) WinterContact TS 870 – 2,3 (gut)",
          "Goodyear UltraGrip Performance 3 – 2,4 (gut)",
          "[Michelin](/marken/michelin) Alpin 7 – 2,5 (gut)",
          "Bridgestone Blizzak 6 – 2,6 (befriedigend)",
          "Hankook Winter i*cept RS3 und ESA+TECAR Supergrip Pro2 (nur in der Schweiz erhältlich) – je 2,7 (befriedigend)",
          "Dunlop Winter – 2,9 (befriedigend)",
          "Yokohama BluEarth Winter V906, Vredestein Wintrac Pro+ – je 3,1 (befriedigend)",
          "Falken Eurowinter HS02 Pro – 4,8 (mangelhaft)",
          "Toyo Tires Observe EWS1 – 5,3 (mangelhaft)",
          "Tracmax Ice-Plus S210, Aptany RW211 – je 5,4 (mangelhaft)",
          "Royal Black Royalwinter UHP, Sunwide Snowide – je 5,5 (mangelhaft)",
        ]),
      ],
      [
        h2("Was der Test für Ihren Reifenkauf bedeutet"),
        h3("1. Der Continental ist die sichere Wahl in beiden Größen"),
        p(
          "Der WinterContact TS 870 ist der einzige Reifen, der in beiden Dimensionen unter den besten zwei landet. Wer keine Experimente will, liegt mit ihm richtig. Auch der Michelin Alpin 7 ist in beiden Größen „gut“."
        ),
        h3("2. Testergebnisse gelten nur für die getestete Größe"),
        p(
          "Der Goodyear UltraGrip Performance 3 zeigt es deutlich: In 225/50 R17 ist er mit 2,4 „gut“, in 185/65 R15 nur „befriedigend“ (3,3). Achten Sie deshalb auf Tests in Ihrer Größe oder einer ähnlichen."
        ),
        h3("3. Ganz billig wird oft teuer"),
        p(
          "Fast alle mangelhaften Reifen stammen aus dem Budgetsegment. Sie sind oft auf einem Untergrund passabel, haben aber gravierende Schwächen auf einem anderen – etwa beim Bremsen auf nasser Straße. Gute Mittelklasse-Alternativen wie Hankook oder Linglong zeigen aber, dass sicher nicht automatisch teuer heißt."
        ),
        h3("4. Laufleistung im Blick behalten"),
        p(
          "Die Kleinwagenreifen erreichen im Schnitt eine prognostizierte Laufleistung von rund 31.000 Kilometern, die Mittelklassereifen über 45.000 Kilometer. Vielfahrer sollten neben der Sicherheit auf hohe Laufleistung und geringen Abrieb achten."
        ),
      ],
      [
        h2("Testsieger günstig kaufen"),
        p(
          "Derselbe Reifen kostet bei verschiedenen Händlern oft unterschiedlich viel – bei vier Reifen plus Versand lohnt sich der Vergleich. In unserem Preisvergleich sehen Sie alle Angebote nebeneinander: [Winterreifen 185/65 R15](/reifen/185-65-r15), [Winterreifen 225/50 R17](/reifen/225-50-r17) oder alle [Winterreifen](/winterreifen) nach Ihrer Größe."
        ),
        p(
          "Noch schneller geht es mit unserem [Reifen-Preisrechner](/artikel/reifenpreise-2026-preisrechner): Automarke und Modell wählen und sofort die heutigen Bestpreise für die Testsieger in Ihrer Größe sehen."
        ),
        p(
          "Was beim Kauf rechtlich gilt – Alpine-Symbol, Profiltiefe und Bußgelder – haben wir im Ratgeber zur [Winterreifenpflicht 2026](/artikel/winterreifenpflicht-2026-alpine-symbol-bussgeld) zusammengefasst."
        ),
      ],
    ],
  },

  // ------------------------------------------------------------------ 3
  {
    slug: "ganzjahresreifen-oder-winterreifen-2026",
    coverImage: "/images/blogs/ganzjahresreifen-oder-winterreifen-2026.webp",
    title: "Ganzjahresreifen oder Winterreifen? Der ADAC-Test 2026 und für wen sich Allwetterreifen lohnen",
    metaDescription:
      "Ganzjahresreifen oder Winterreifen? ADAC-Test 2026: nur ein Reifen gut, fünf mangelhaft. Vor- und Nachteile und für wen sich Allwetterreifen lohnen.",
    tags: ["Ganzjahresreifen", "Allwetterreifen", "Ganzjahresreifen Test 2026", "Winterreifen", "ADAC"],
    contentBlocks: [
      [
        p(
          "Ganzjahresreifen sind beliebt: Kein Wechsel im Frühjahr und Herbst, keine Einlagerung, nur ein Satz Reifen. Doch der aktuelle ADAC-Test zeigt, dass zwischen gut und gefährlich viel Spielraum liegt. Wir erklären, für wen sich Allwetterreifen lohnen und welche Modelle im Test 2026 überzeugen."
        ),
      ],
      [
        h2("Der ADAC-Ganzjahresreifentest 2026"),
        p(
          "Getestet wurden 16 Reifen der Kleinwagengröße [185/65 R15](/reifen/185-65-r15), veröffentlicht am 23. Juni 2026. Nur ein einziger Reifen erreicht die Note „gut“, acht Modelle erhalten keine Empfehlung, fünf davon sind „mangelhaft“."
        ),
        ol([
          "[Continental](/marken/continental) AllSeasonContact 2 – 2,3 (gut), einziger guter Reifen",
          "Pirelli Cinturato All Season SF 3 – 2,6 (befriedigend)",
          "[Michelin](/marken/michelin) CrossClimate 2 – 2,6 (befriedigend)",
          "Vredestein Quatrac – 2,9 (befriedigend)",
          "Hankook Kinergy 4S 2 – 3,0 (befriedigend)",
          "Goodyear Vector 4Seasons Gen-3, Nokian Tyres Seasonproof 2 – je 3,1 (befriedigend)",
          "GT Radial ClimateActive – 3,2 (befriedigend)",
          "Nexen N'Blue 4Season 2 – 3,6, Dunlop All Season 2 – 3,7, Milever All Season Versat MC545 – 4,0 (alle ausreichend, keine Empfehlung)",
          "Norauto 4 Seasons 2 – 4,9 (mangelhaft)",
          "Bridgestone Weather Control A005-Evo, Mastersteel All Weather 2 – je 5,3 (mangelhaft)",
          "Roadhog RGAS02 – 5,4, Tomason Allseason – 5,5 (mangelhaft)",
        ]),
        p(
          "Die mangelhaften Reifen sind laut ADAC auf winterlicher Fahrbahn überfordert und zeigen zusätzlich Schwächen in mindestens einer weiteren Disziplin. Überraschend: Der Dunlop All Season 2 ist auf Schnee der Beste im Feld, fällt aber wegen schwacher Leistungen auf trockener Straße zurück."
        ),
      ],
      [
        h2("Laufleistung: Hohe Kilometer sind kein Qualitätsbeweis"),
        p(
          "Die prognostizierte Laufleistung reicht von 32.400 bis 46.000 Kilometern. Ausgerechnet der mangelhafte Norauto 4 Seasons 2 hält am längsten. Der ADAC betont deshalb: Eine hohe Laufleistung allein sagt nichts über die Sicherheit. Gute Kompromisse bieten Michelin CrossClimate 2 und Vredestein Quatrac mit je 43.600 Kilometern sowie der Pirelli mit 43.100 Kilometern."
        ),
      ],
      [
        h2("Ganzjahresreifen oder Winterreifen – für wen lohnt sich was?"),
        h3("Ganzjahresreifen passen, wenn Sie …"),
        ul([
          "eher wenig fahren, zum Beispiel unter 10.000 bis 15.000 Kilometer im Jahr,",
          "vor allem in der Stadt oder auf Landstraßen unterwegs sind,",
          "in einer Region mit milden Wintern wohnen,",
          "bei starkem Schneefall das Auto auch einmal stehen lassen können.",
        ]),
        h3("Getrennte Sommer- und Winterreifen sind besser, wenn Sie …"),
        ul([
          "viel Autobahn fahren oder oft schwer beladen sind,",
          "in schneereichen Regionen oder im Mittelgebirge wohnen,",
          "im Sommer oft bei großer Hitze unterwegs sind,",
          "präzises Fahrverhalten und kurze Bremswege bei jedem Wetter wollen.",
        ]),
        p(
          "Der ADAC fasst es ähnlich zusammen: Wer viel Autobahn fährt, oft bei großer Hitze unterwegs ist oder schwer lädt, ist mit spezialisierten [Sommerreifen](/sommerreifen) und [Winterreifen](/winterreifen) besser bedient. Ganzjahresreifen sind ein Kompromiss – sie erreichen in keiner Jahreszeit ganz das Niveau eines Spezialreifens."
        ),
      ],
      [
        h2("Rechnet sich ein Ganzjahresreifen?"),
        p(
          "Ein Satz Ganzjahresreifen spart den zweiten Reifensatz, die Kosten für zwei Wechsel pro Jahr und eventuell die Einlagerung. Dafür nutzt er sich schneller ab, weil er das ganze Jahr läuft. Für Wenigfahrer ist die Rechnung meist positiv, für Vielfahrer gleicht sich der Vorteil durch den höheren Verschleiß weitgehend aus."
        ),
        p(
          "Was ein Satz Ganzjahres- oder Winterreifen für Ihr Auto konkret kostet, berechnet unser [Reifen-Preisrechner](/artikel/reifenpreise-2026-preisrechner) mit den aktuellen Händlerpreisen."
        ),
        p(
          "Wichtig für den Winter: Auch Ganzjahresreifen müssen das Alpine-Symbol tragen, um die Winterreifenpflicht zu erfüllen. Reine M+S-Reifen reichen seit Oktober 2024 nicht mehr aus – Details im Ratgeber zur [Winterreifenpflicht 2026](/artikel/winterreifenpflicht-2026-alpine-symbol-bussgeld)."
        ),
      ],
      [
        h2("Fazit"),
        p(
          "Für Wenigfahrer in der Stadt ist ein guter Ganzjahresreifen eine bequeme und sichere Lösung – vorausgesetzt, Sie wählen ein Modell aus dem oberen Testfeld wie den Continental AllSeasonContact 2, den Pirelli Cinturato All Season SF 3 oder den Michelin CrossClimate 2. Von den mangelhaften Billigreifen sollten Sie die Finger lassen. Die aktuellen Preise aller Händler vergleichen Sie in unserem [Ganzjahresreifen-Preisvergleich](/ganzjahresreifen); wer lieber Spezialreifen fährt, findet die Ergebnisse im [ADAC Winterreifentest 2026](/artikel/adac-winterreifentest-2026-testsieger)."
        ),
      ],
    ],
  },
  // ------------------------------------------------------------------ 4
  {
    slug: "reifenpreise-2026-preisrechner",
    coverImage: "/images/blogs/reifenpreise-2026-preisrechner.webp",
    title: "Reifenpreise 2026: Was kosten Reifen für mein Auto? Mit Preisrechner",
    metaDescription:
      "Was kosten Reifen für Golf, Polo, 3er & Co.? Automarke und Modell wählen und die heute günstigsten Winter-, Sommer- und Ganzjahresreifen aller Händler sehen.",
    tags: ["Reifenpreise", "Reifen Preis berechnen", "Was kosten Winterreifen", "Preisrechner", "Reifen günstig"],
    contentBlocks: [
      [
        p(
          "Was kostet ein Satz neuer Reifen für mein Auto? Die ehrliche Antwort: Es hängt von Größe, Marke, Reifenart – und vom Händler ab. Derselbe Reifen kostet in verschiedenen Shops oft unterschiedlich viel. Mit unserem Preisrechner sehen Sie in wenigen Sekunden, was Reifen für Ihr Modell heute kosten und wo das beste Angebot liegt."
        ),
        { type: "widget", widget: "reifen-preisrechner" },
      ],
      [
        h2("So funktioniert der Reifen-Preisrechner"),
        ol([
          "Automarke wählen, zum Beispiel VW, Opel oder BMW.",
          "Modell wählen – der Rechner schlägt die häufigsten Serien-Reifengrößen vor.",
          "Reifenart wählen: Winter-, Sommer- oder Ganzjahresreifen. Voreingestellt ist die aktuelle Saison.",
          "Sie sehen den günstigsten Reifen von heute, einen Preis-Leistungs-Tipp mit besserer Nasshaftung und weitere Angebote mit Händler und Preis.",
        ]),
        p(
          "Die Preise stammen aus den Produktdaten der Händler und werden mehrmals täglich aktualisiert. Die angezeigte Größe ist ein Vorschlag – maßgeblich sind die Felder 15.1 und 15.2 Ihrer Zulassungsbescheinigung Teil I oder die Angabe auf der Reifenflanke."
        ),
      ],
      [
        h2("Wovon hängt der Reifenpreis ab?"),
        h3("1. Reifengröße"),
        p(
          "Der größte Preistreiber ist die Dimension. Kleinwagenreifen wie [185/65 R15](/reifen/185-65-r15) sind deutlich günstiger als Mittelklasse- oder SUV-Größen wie [225/50 R17](/reifen/225-50-r17). Je größer Felgendurchmesser und Breite, desto teurer wird es in der Regel."
        ),
        h3("2. Marke und Segment"),
        p(
          "Premiummarken wie [Continental](/marken/continental) oder [Michelin](/marken/michelin) kosten mehr als Budgetreifen – schneiden in Tests aber meist besser ab. Im [ADAC Winterreifentest 2026](/artikel/adac-winterreifentest-2026-testsieger) waren fast alle mangelhaften Reifen günstige Budgetmodelle. Gleichzeitig zeigen Mittelklasse-Marken, dass sicher nicht automatisch teuer heißt."
        ),
        h3("3. Reifenart"),
        p(
          "[Winterreifen](/winterreifen) und [Ganzjahresreifen](/ganzjahresreifen) sind wegen der aufwendigeren Lamellen und Gummimischung oft etwas teurer als [Sommerreifen](/sommerreifen) gleicher Größe. Ob sich ein Allwetterreifen für Sie rechnet, lesen Sie in unserem Vergleich [Ganzjahresreifen oder Winterreifen](/artikel/ganzjahresreifen-oder-winterreifen-2026)."
        ),
        h3("4. Händler und Zeitpunkt"),
        p(
          "Preise schwanken zwischen den Shops und über die Saison. Kurz vor dem ersten Schnee steigt die Nachfrage nach Winterreifen stark – wer früher vergleicht, hat mehr Auswahl in seiner Größe."
        ),
      ],
      [
        h2("Die Gesamtkosten im Blick"),
        p("Zum Reifenpreis kommen beim Kauf meist noch weitere Posten hinzu:"),
        ul([
          "Versandkosten des Händlers (teils ab einem Bestellwert kostenlos)",
          "Montage, Auswuchten und gegebenenfalls neue Ventile in der Werkstatt",
          "bei Fahrzeugen mit Reifendruck-Kontrollsystem (RDKS) eventuell das Anlernen der Sensoren",
          "Einlagerung des zweiten Reifensatzes, falls Sie getrennte Sommer- und Winterreifen fahren",
        ]),
        p(
          "Viele Online-Händler bieten den Versand direkt an eine Partnerwerkstatt an. Vergleichen Sie deshalb nicht nur den Stückpreis, sondern auch Versand und Montage."
        ),
      ],
      [
        h2("5 Tipps, um beim Reifenkauf zu sparen"),
        ol([
          "Preise vergleichen: Derselbe Reifen kostet je nach Händler unterschiedlich viel.",
          "Nicht zum billigsten Reifen greifen: Ein Testsieger aus dem Vorjahr oder ein guter Mittelklasse-Reifen bietet oft das beste Preis-Leistungs-Verhältnis.",
          "Auf das EU-Reifenlabel achten: Nasshaftung und Rollwiderstand beeinflussen Sicherheit und Spritverbrauch über die gesamte Lebensdauer.",
          "Rechtzeitig kaufen: Vor dem ersten Wintereinbruch ist die Auswahl in allen Größen am größten.",
          "DOT-Nummer prüfen: Die letzten vier Ziffern zeigen Woche und Jahr der Herstellung. Neue Reifen sollten nicht unnötig alt sein.",
        ]),
      ],
      [
        h2("Häufige Fragen zu Reifenpreisen"),
        h3("Was kosten Winterreifen für einen VW Golf?"),
        p(
          "Das hängt von der Größe ab – beim Golf meist [205/55 R16](/reifen/205-55-r16) oder 225/45 R17. Wählen Sie im Preisrechner oben VW und Golf, um die heutigen Preise aller Händler zu sehen."
        ),
        h3("Lohnen sich teure Markenreifen?"),
        p(
          "Bei sicherheitsrelevanten Eigenschaften wie Bremsweg auf nasser Straße oder Grip auf Schnee liegen Markenreifen in Tests meist vorn. Ganz billige No-Name-Reifen fallen häufig durch. Ein guter Kompromiss ist der Preis-Leistungs-Tipp im Rechner: bessere Nasshaftung für höchstens 25 Prozent Aufpreis gegenüber dem günstigsten Reifen."
        ),
        h3("Wie oft werden die Preise aktualisiert?"),
        p(
          "Die Händlerpreise werden mehrmals täglich abgeglichen. Maßgeblich ist immer der Preis im Shop des Händlers zum Zeitpunkt Ihrer Bestellung."
        ),
      ],
    ],
  },
];

const dry = process.argv.includes("--dry");

if (dry) {
  for (const post of posts) {
    const words = post.contentBlocks.flat().flatMap((b) => [b.text || "", ...(b.items || [])]).join(" ").split(/\s+/).length;
    console.log(`\n${post.title}\n  /artikel/${post.slug}\n  ${post.metaDescription.length} chars meta · ~${words} words`);
  }
  process.exit(0);
}

await mongoose.connect(process.env.MONGODB_URI);
for (const post of posts) {
  const res = await Blog.findOneAndUpdate(
    { slug: post.slug },
    { $set: post },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`✔ ${res.slug}`);
}
await mongoose.disconnect();
