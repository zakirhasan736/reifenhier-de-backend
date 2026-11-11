#!/usr/bin/env node
/**
 * Two SEO articles for winter 2026/27:
 *   1. Tyre age: DOT number, how old winter tyres may be, storage
 *   2. Winter tyre rules abroad: Austria, Switzerland, Italy, France & more
 *
 *   node scripts/seed-blogs-winter-alter-ausland-2026.mjs --dry            # print, write nothing
 *   node scripts/seed-blogs-winter-alter-ausland-2026.mjs                  # upsert both articles by slug
 *   node scripts/seed-blogs-winter-alter-ausland-2026.mjs --link-existing  # also add an "Auch interessant"
 *        block linking to the new articles from the six existing winter articles (once; skipped if present)
 *
 * Facts checked on 12.11.2026 against ADAC:
 *   - "Wie alt dürfen neue Reifen sein?" (updated 08.10.2026)
 *   - "Winterreifen- und Schneeketten-Pflicht in 21 europäischen Ländern" (30.10.2026)
 * Text links use "[Text](/pfad)" — rendered as internal links by the site.
 * Cover images go to the frontend: public/images/blogs/<file>.webp
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

const SLUG_ALTER = "wie-alt-duerfen-winterreifen-sein-dot-nummer-reifenalter";
const SLUG_AUSLAND = "winterreifenpflicht-ausland-oesterreich-schweiz-italien-frankreich";

const posts = [
  // ------------------------------------------------------------------ 1
  {
    slug: SLUG_ALTER,
    coverImage: "/images/blogs/winterreifen-alter-dot-nummer.webp",
    title: "Wie alt dürfen Winterreifen sein? DOT-Nummer & Reifenalter",
    metaDescription:
      "Wie alt dürfen Winterreifen sein? So lesen Sie die DOT-Nummer, erkennen zu alte Reifen und wissen, wann sich neue Winterreifen lohnen. Mit Lager-Tipps.",
    tags: [
      "Winterreifen",
      "Reifenalter",
      "DOT-Nummer",
      "Profiltiefe",
      "Reifen lagern",
      "Ratgeber",
    ],
    contentBlocks: [
      [
        p(
          "Das Profil sieht noch gut aus, also halten die Winterreifen noch einen Winter – oder? Nicht unbedingt. Gummi altert, auch wenn der Reifen kaum gefahren wurde. Die Mischung wird mit den Jahren härter, und genau die weiche Mischung macht einen Winterreifen bei Kälte, Nässe und Schnee sicher."
        ),
        p(
          "In diesem Ratgeber erfahren Sie, wie Sie das Alter Ihrer Reifen in zehn Sekunden an der DOT-Nummer ablesen, wie alt Winterreifen höchstens sein sollten und woran Sie erkennen, dass ein neuer Satz fällig ist."
        ),
      ],
      [
        h2("Das Wichtigste in Kürze"),
        ul([
          "Ein gesetzliches Höchstalter für Pkw-Reifen gibt es in Deutschland nicht – vorgeschrieben ist nur die Mindestprofiltiefe von 1,6 mm.",
          "Der ADAC rät, Winterreifen nicht länger als acht Jahre zu fahren. Schon ab etwa sechs Jahren lassen die Wintereigenschaften nach.",
          "Das Herstelldatum steht als vierstellige Zahl auf der Reifenflanke: 1024 bedeutet Kalenderwoche 10 im Jahr 2024.",
          "Neureifen sollten beim Kauf laut ADAC höchstens zwei Jahre alt sein.",
          "Unter 4 mm Profil sollten Winterreifen ersetzt werden – unabhängig vom Alter.",
        ]),
      ],
      [
        h2("DOT-Nummer lesen: So finden Sie das Reifenalter"),
        p(
          "Auf jeder Reifenflanke steht die sogenannte DOT-Nummer. Für das Alter zählen nur die letzten vier Ziffern, meist in einem kleinen ovalen Feld. Die ersten zwei Ziffern nennen die Kalenderwoche, die letzten zwei das Jahr der Herstellung."
        ),
        ol([
          "Reifenflanke absuchen, bis Sie die Buchstaben „DOT“ finden.",
          "Den letzten Zahlenblock mit vier Ziffern ablesen, zum Beispiel 1024.",
          "Aufteilen: 10 = Kalenderwoche 10, 24 = Jahr 2024. Der Reifen wurde also im März 2024 gebaut.",
        ]),
        p(
          "Steht die vierstellige Zahl nur auf einer Seite des Reifens, kann sie nach der Montage innen liegen. Dann hilft ein Blick mit der Taschenlampe in den Radkasten – oder Sie prüfen die Zahl beim nächsten Räderwechsel."
        ),
        h3("Beispiele"),
        ul([
          "DOT 4223: Kalenderwoche 42 im Jahr 2023 – im Winter 2026/27 gut drei Jahre alt.",
          "DOT 3620: Kalenderwoche 36 im Jahr 2020 – sechs Jahre alt, ab jetzt jedes Jahr genau prüfen.",
          "DOT 4018: Kalenderwoche 40 im Jahr 2018 – acht Jahre alt, als Winterreifen am Ende der empfohlenen Nutzungsdauer.",
        ]),
      ],
      [
        h2("Wie alt dürfen Winterreifen sein?"),
        p(
          "Rechtlich gibt es keine Altersgrenze. Solange ein Pkw-Reifen keine Schäden hat und mindestens 1,6 mm Profil besitzt, dürfen Sie ihn fahren. Sicher ist das aber nicht in jedem Fall."
        ),
        p(
          "Der ADAC empfiehlt, Winterreifen nicht länger als acht Jahre zu nutzen. Sommerreifen sollten nach acht bis zehn Jahren ersetzt werden, und älter als zehn Jahre sollte kein Pkw-Reifen sein. Bei Winterreifen beginnt der Leistungsverlust früher: Ab etwa sechs Jahren gehen laut ADAC bereits Wintereigenschaften verloren."
        ),
        ul([
          "Bis 5 Jahre: in der Regel unkritisch, wenn Profil und Zustand stimmen.",
          "6 bis 8 Jahre: jedes Jahr vor der Saison auf Risse, Härte und Profil prüfen.",
          "Über 8 Jahre: als Winterreifen ersetzen, auch wenn das Profil noch reicht.",
        ]),
        p(
          "Eine echte gesetzliche Altersregel gibt es nur für Anhänger und Wohnwagen mit Tempo-100-Zulassung: Dort müssen die Reifen nach sechs Jahren ersetzt werden."
        ),
      ],
      [
        h2("Warum alte Winterreifen schlechter bremsen"),
        p(
          "Reifengummi enthält Weichmacher, die mit der Zeit entweichen. Sonne, Ozon und Temperaturwechsel beschleunigen das. Die Lauffläche wird härter – und ein harter Reifen verzahnt sich schlechter mit Schnee und haftet schlechter auf nasser Fahrbahn."
        ),
        p(
          "Der ADAC hat dazu frisch produzierte Reifen mit drei Jahre alten, ungefahrenen Reifen desselben Modells verglichen. Ergebnis: Die Alterung verändert die Eigenschaften messbar zum Schlechteren, vor allem beim Bremsen auf Nässe. Die Reifen waren dabei nur gelagert – im Alltag kommen Sonne, Streusalz und Bordsteinkontakte hinzu."
        ),
      ],
      [
        h2("Wie alt dürfen neue Reifen beim Kauf sein?"),
        p(
          "Auch ein neuer Reifen hat schon ein Alter, denn er lag vor dem Verkauf im Lager. Der Reifenhandel bezeichnet richtig gelagerte Reifen bis drei Jahre als „fabrikneu“ und bis fünf Jahre als „neu“. Der ADAC ist strenger und empfiehlt, dass Neureifen beim Kauf höchstens zwei Jahre alt sind."
        ),
        ul([
          "Nach der Lieferung die DOT-Nummer aller vier Reifen prüfen.",
          "Bei der Bestellung nachfragen, wenn Ihnen ein junges Herstelldatum wichtig ist.",
          "Auffällig günstige Restposten können ältere Lagerware sein – das ist nicht verboten, verkürzt aber die Nutzungsdauer.",
        ]),
        p(
          "Wie Sie Angebote verschiedener Händler richtig vergleichen, zeigen wir im Artikel [Winterreifen günstig kaufen: Preisverlauf & Preisalarm](/artikel/winterreifen-guenstig-kaufen-preisverlauf-preisalarm-2026)."
        ),
      ],
      [
        h2("Alter oder Profil – was zählt mehr?"),
        p(
          "Beides. Ein junger Reifen mit zu wenig Profil ist genauso ungeeignet wie ein alter Reifen mit viel Profil. Gesetzlich reichen 1,6 mm, für Winterreifen empfehlen ADAC und Reifenhersteller aber mindestens 4 mm, weil darunter der Grip auf Schnee und Matsch deutlich nachlässt. In Österreich gelten Winterreifen unter 4 mm rechtlich gar nicht mehr als Winterreifen – mehr dazu im Ratgeber [Winterreifenpflicht im Ausland](/artikel/" +
            SLUG_AUSLAND +
            ")."
        ),
        p(
          "Alle Regeln für Deutschland, vom Alpine-Symbol bis zum Bußgeld, finden Sie im Artikel [Winterreifenpflicht 2026](/artikel/winterreifenpflicht-2026-alpine-symbol-bussgeld)."
        ),
        h3("Fünf Warnzeichen für zu alte Winterreifen"),
        ul([
          "Feine Risse in der Flanke oder zwischen den Profilblöcken.",
          "Die Lauffläche fühlt sich hart und glatt an, die Lamellen geben auf Fingerdruck kaum nach.",
          "Beulen oder Verformungen an der Seitenwand.",
          "Ungleichmäßig abgefahrenes Profil, zum Beispiel nur innen oder außen.",
          "Weniger als 4 mm Restprofil an der flachsten Stelle.",
        ]),
        p(
          "Trifft einer dieser Punkte zu, lassen Sie die Reifen in der Werkstatt prüfen. Altersschäden wie Risse können auch bei der Hauptuntersuchung als Mangel gewertet werden."
        ),
      ],
      [
        h2("Winterreifen richtig lagern: So altern sie langsamer"),
        p(
          "Über den Sommer liegen Winterreifen rund sechs Monate im Keller oder in der Garage. Wie sie dort liegen, entscheidet mit darüber, wie lange sie halten."
        ),
        ul([
          "Kühl, trocken und dunkel lagern – direkte Sonne meiden.",
          "Abstand zu Kraftstoff, Öl, Lösungsmitteln und Reinigungschemie halten.",
          "Nicht neben Elektromotoren oder anderen Geräten lagern, die Ozon erzeugen.",
          "Reifen ohne Felge stehend lagern und nicht verformen oder einklemmen.",
          "Kompletträder liegend stapeln oder an einem Felgenbaum aufhängen.",
          "Vor dem Einlagern waschen, trocknen lassen und die Position am Auto markieren (zum Beispiel VL für vorne links).",
        ]),
      ],
      [
        h2("Neue Winterreifen kaufen: So gehen Sie vor"),
        p(
          "Sind Ihre Reifen zu alt oder zu weit abgefahren, lohnt sich der Vergleich. Derselbe Reifen kostet je nach Händler unterschiedlich viel, und beim Satz aus vier Reifen summiert sich das."
        ),
        ol([
          "Reifengröße vom alten Reifen oder aus dem Fahrzeugschein ablesen, zum Beispiel [205/55 R16](/reifen/205-55-r16), [195/65 R15](/reifen/195-65-r15) oder [225/45 R17](/reifen/225-45-r17).",
          "In der [Winterreifen-Übersicht](/winterreifen) nach Größe filtern und Preise aller Händler vergleichen.",
          "Testergebnisse einbeziehen: Der [ADAC Winterreifentest 2026](/artikel/adac-winterreifentest-2026-testsieger) zeigt, welche Modelle überzeugen.",
          "Lastindex und Geschwindigkeitsindex prüfen – die Erklärung steht im Ratgeber [91H, 91T oder 94V XL?](/artikel/lastindex-geschwindigkeitsindex-winterreifen-91h-94v-xl)",
          "Nach der Lieferung die DOT-Nummer kontrollieren.",
        ]),
        p(
          "Beliebte Marken im Vergleich: [Continental](/marken/continental), [Michelin](/marken/michelin), [Goodyear](/marken/goodyear), [Hankook](/marken/hankook) und [Bridgestone](/marken/bridgestone). Wer wenig fährt und in einer milden Region wohnt, findet im Artikel [Ganzjahresreifen oder Winterreifen?](/artikel/ganzjahresreifen-oder-winterreifen-2026) eine Entscheidungshilfe. Was ein neuer Satz für Ihr Auto ungefähr kostet, zeigt der [Reifen-Preisrechner](/artikel/reifenpreise-2026-preisrechner)."
        ),
      ],
      [
        h2("Häufige Fragen zum Reifenalter"),
        h3("Sind zehn Jahre alte Winterreifen noch erlaubt?"),
        p(
          "Erlaubt ja, solange Profil und Zustand in Ordnung sind. Empfehlenswert ist es nicht: Der ADAC rät bei Winterreifen zu höchstens acht Jahren."
        ),
        h3("Wo steht die DOT-Nummer?"),
        p(
          "Auf der Reifenflanke, hinter den Buchstaben „DOT“. Entscheidend sind die letzten vier Ziffern: Kalenderwoche und Jahr."
        ),
        h3("Prüft der TÜV das Reifenalter?"),
        p(
          "Das Alter allein ist kein Prüfpunkt der Hauptuntersuchung. Altersbedingte Schäden wie Risse oder poröses Gummi können aber dazu führen, dass es keine Plakette gibt."
        ),
        h3("Altern Reifen auch, wenn das Auto kaum bewegt wird?"),
        p(
          "Ja. Die Gummimischung härtet auch ohne gefahrene Kilometer aus. Wenigfahrer erreichen deshalb oft die Altersgrenze, lange bevor das Profil abgefahren ist."
        ),
        h3("Kann ich alte Winterreifen im Sommer auffahren?"),
        p(
          "Erlaubt ist es, sinnvoll selten: Winterreifen haben bei Wärme längere Bremswege und verschleißen schneller. Passende Sommermodelle finden Sie in der [Sommerreifen-Übersicht](/sommerreifen)."
        ),
        p(
          "Quelle der Empfehlungen: ADAC, „Wie alt dürfen neue Reifen sein?“ (Stand Oktober 2026)."
        ),
      ],
    ],
  },

  // ------------------------------------------------------------------ 2
  {
    slug: SLUG_AUSLAND,
    coverImage: "/images/blogs/winterreifenpflicht-ausland-2026.webp",
    title: "Winterreifenpflicht im Ausland: Österreich, Italien & Co.",
    metaDescription:
      "Winterreifenpflicht in Österreich, der Schweiz, Italien und Frankreich 2026/27: Zeiträume, Mindestprofil, Schneeketten und Bußgelder im Überblick.",
    tags: [
      "Winterreifen",
      "Winterreifenpflicht",
      "Winterurlaub",
      "Schneeketten",
      "Österreich",
      "Ratgeber",
    ],
    contentBlocks: [
      [
        p(
          "Skiurlaub in Tirol, Weihnachten in Südtirol, ein Wochenende in den französischen Alpen: Wer im Winter mit dem Auto ins Ausland fährt, muss andere Regeln beachten als zu Hause. In Deutschland gilt die Winterreifenpflicht nur bei winterlichen Straßenverhältnissen. Einige Nachbarländer schreiben dagegen feste Zeiträume, ein höheres Mindestprofil oder Schneeketten im Kofferraum vor."
        ),
        p(
          "Dieser Überblick zeigt, was in den wichtigsten Reiseländern im Winter 2026/27 gilt, was Verstöße kosten und wie Sie Ihr Auto vor der Abfahrt prüfen."
        ),
      ],
      [
        h2("Überblick: Winterreifenregeln der wichtigsten Reiseländer"),
        ul([
          "Österreich: 1. November bis 15. April bei winterlichen Straßenverhältnissen, Mindestprofil 4 mm.",
          "Schweiz: keine generelle Pflicht, aber Bußgeld und Mithaftung bei ungeeigneter Bereifung.",
          "Italien: je nach Provinz und Strecke; in Südtirol auf der Brennerautobahn vom 15. November bis 15. April.",
          "Frankreich: 1. November bis 31. März in den Bergregionen, nur Reifen mit Alpine-Symbol zählen.",
          "Tschechien: 1. November bis 31. März bei winterlichen Verhältnissen, Mindestprofil 4 mm.",
          "Slowenien: 15. November bis 15. März, Mindestprofil 3 mm.",
          "Kroatien: 15. November bis 15. April auf vielen Autobahnen und Hauptstraßen, Mindestprofil 4 mm.",
        ]),
        p(
          "Wichtig: Es gelten immer die Regeln des Landes, durch das Sie gerade fahren – auch im Transit. Wer über Österreich nach Italien reist, muss beide Regelungen erfüllen."
        ),
      ],
      [
        h2("Österreich: Winterreifen von November bis April"),
        p(
          "In Österreich gilt vom 1. November bis 15. April eine situative Winterausrüstungspflicht. Bei Schnee, Schneematsch oder Eis dürfen Pkw nur mit Winterreifen fahren. Anerkannt werden Reifen mit M+S-Kennzeichnung oder Alpine-Symbol."
        ),
        ul([
          "Mindestprofil: 4 mm. Darunter gilt der Reifen in Österreich nicht mehr als Winterreifen.",
          "Schneeketten auf den Antriebsrädern sind als Alternative nur erlaubt, wenn die Fahrbahn weitgehend mit Schnee oder Eis bedeckt ist.",
          "Wo das Schild „Schneeketten vorgeschrieben“ steht, müssen Ketten montiert werden.",
          "Bußgeld: laut ADAC rund 100 € – und deutlich mehr, wenn andere gefährdet werden. Dann sind Strafen von mehreren Tausend Euro möglich.",
        ]),
        p(
          "Die 4-mm-Grenze ist die häufigste Falle für deutsche Urlauber: Ein Winterreifen mit 3 mm Profil ist in Deutschland legal, in Österreich aber nicht mehr als Winterreifen anerkannt."
        ),
      ],
      [
        h2("Schweiz: keine Pflicht, aber volles Risiko"),
        p(
          "Die Schweiz kennt keine gesetzliche Winterreifenpflicht. Das Fahrzeug muss aber jederzeit betriebssicher sein und sich auch auf winterlicher Fahrbahn sicher beherrschen lassen. Wer mit ungeeigneten Reifen liegen bleibt und den Verkehr behindert, muss mit einem Bußgeld rechnen. Nach einem Unfall mit Sommerreifen droht außerdem eine Mithaftung."
        ),
        p(
          "Auf Passstraßen können Schilder Schneeketten vorschreiben. In der Praxis gilt deshalb: Ohne Winterreifen sollten Sie im Winter nicht in die Schweiz fahren."
        ),
      ],
      [
        h2("Italien und Südtirol: jede Provinz regelt selbst"),
        p(
          "In Italien gibt es keine landesweit einheitliche Regel. Die Provinzen legen Zeiträume und Strecken selbst fest und kündigen sie über Schilder an – teils unabhängig vom Wetter, teils nur bei winterlichen Verhältnissen. Anerkannt werden Reifen mit M+S-Kennzeichnung oder Alpine-Symbol."
        ),
        ul([
          "Südtirol: Auf der Brennerautobahn A22 bis Affi und im Stadtgebiet von Bozen gilt vom 15. November bis 15. April eine Winterausrüstungspflicht – unabhängig vom Wetter. Auf den übrigen Straßen der Provinz gilt sie nur bei winterlichen Verhältnissen.",
          "Aostatal: Winterausrüstungspflicht vom 15. Oktober bis 15. April. Sommerreifen mit Schneeketten sind als Alternative möglich.",
          "Schneeketten: Auf einzelnen Strecken per Schild vorgeschrieben, dann gilt höchstens 50 km/h.",
          "Bußgeld: 87 bis 345 € bei Verstoß gegen eine angeordnete Winterreifenpflicht.",
        ]),
        p(
          "Tipp: Prüfen Sie vor der Abfahrt die Regeln der Provinz, in die Sie reisen, und achten Sie unterwegs auf die Beschilderung."
        ),
      ],
      [
        h2("Frankreich: Nur das Alpine-Symbol zählt"),
        p(
          "In Frankreich gilt vom 1. November bis 31. März eine Winterreifenpflicht in den ausgewiesenen Bergzonen vieler Départements, etwa in den Alpen, den Pyrenäen, den Vogesen und im Jura. Auf anderen Straßen kann sie per Schild kurzfristig angeordnet werden."
        ),
        ul([
          "Seit November 2024 zählen nur noch Reifen mit Alpine-Symbol (3PMSF) als Winterreifen. Reifen, die nur M+S tragen, reichen nicht mehr.",
          "Mindestprofil: 3,5 mm.",
          "Alternative: Schneeketten oder Schneesocken mitführen und bei winterlichen Verhältnissen auf der Antriebsachse montieren. Mit Ketten gilt höchstens 50 km/h.",
          "Bußgeld: 135 €. Zusätzlich kann die Weiterfahrt untersagt werden.",
        ]),
      ],
      [
        h2("Tschechien, Slowenien und Kroatien"),
        h3("Tschechien"),
        p(
          "Vom 1. November bis 31. März sind bei Schnee, Eis oder Schneematsch Winterreifen auf allen Rädern vorgeschrieben. Mindestprofil für Pkw: 4 mm. Das Bußgeld liegt bei rund 60 bis 100 €."
        ),
        h3("Slowenien"),
        p(
          "Vom 15. November bis 15. März gilt die Winterausrüstungspflicht generell, außerhalb dieses Zeitraums bei winterlichen Verhältnissen. Erlaubt sind Winterreifen mit mindestens 3 mm Profil oder Sommerreifen mit 3 mm Profil und passenden Schneeketten im Auto. Bußgeld: 40 €, bei Verkehrsbehinderung 500 €."
        ),
        h3("Kroatien"),
        p(
          "Auf vielen Autobahnen, Hauptstraßen und Transitrouten gilt vom 15. November bis 15. April eine Winterreifenpflicht. Verlangt werden mindestens zwei Winterreifen auf der Antriebsachse mit 4 mm Profil und eine Schneeschaufel im Auto. Bußgeld: rund 95 €."
        ),
      ],
      [
        h2("Reichen meine deutschen Winterreifen im Ausland?"),
        p(
          "In den meisten Fällen ja – wenn zwei Punkte stimmen: das Alpine-Symbol und das Profil. Reifen mit Alpine-Symbol und mindestens 4 mm Profil erfüllen die Anforderungen aller hier genannten Länder. Das gilt auch für Ganzjahresreifen mit Alpine-Symbol."
        ),
        ul([
          "Alpine-Symbol prüfen: das Bergpiktogramm mit Schneeflocke auf der Reifenflanke. In Deutschland ist es seit Oktober 2024 Pflicht, Details im Artikel [Winterreifenpflicht 2026](/artikel/winterreifenpflicht-2026-alpine-symbol-bussgeld).",
          "Profil an allen vier Reifen messen: 4 mm sind das Maß für Österreich, Tschechien und Kroatien.",
          "Reifenalter kontrollieren: Wie das geht, steht im Ratgeber [Wie alt dürfen Winterreifen sein?](/artikel/" +
            SLUG_ALTER +
            ")",
        ]),
        p(
          "Ob Ganzjahresreifen für Ihre Urlaubsregion genügen oder echte Winterreifen die bessere Wahl sind, klärt der Artikel [Ganzjahresreifen oder Winterreifen?](/artikel/ganzjahresreifen-oder-winterreifen-2026). Für regelmäßige Fahrten in die Alpen empfehlen sich reine [Winterreifen](/winterreifen); wer nur selten Schnee sieht, findet Alternativen bei den [Ganzjahresreifen](/ganzjahresreifen)."
        ),
      ],
      [
        h2("Schneeketten: wann sie Pflicht sind und worauf Sie achten"),
        p(
          "Ein rundes blaues Schild mit Reifen und Kette bedeutet in allen Alpenländern: Ab hier nur mit montierten Schneeketten. Auf solchen Strecken ersetzen auch die besten Winterreifen keine Ketten."
        ),
        ul([
          "Ketten passend zur Reifengröße kaufen – die Größe steht auf der Verpackung.",
          "Im Fahrzeughandbuch nachsehen, ob Ihr Auto mit der montierten Rad-Reifen-Kombination für Schneeketten freigegeben ist.",
          "Montage einmal zu Hause im Trockenen üben.",
          "Mit Ketten höchstens 50 km/h fahren und sie auf schneefreier Fahrbahn wieder abnehmen.",
          "Schneesocken werden nur in manchen Ländern und unter Bedingungen anerkannt, zum Beispiel in Frankreich.",
        ]),
      ],
      [
        h2("Checkliste vor dem Winterurlaub"),
        ol([
          "Alpine-Symbol auf allen vier Reifen vorhanden?",
          "Mindestens 4 mm Profil an der flachsten Stelle?",
          "Reifen nicht älter als acht Jahre (DOT-Nummer)?",
          "Reifendruck für volle Beladung angepasst?",
          "Schneeketten in der richtigen Größe im Kofferraum, Montage geübt?",
          "Regeln für Ziel- und Transitländer kurz vor der Abfahrt geprüft?",
        ]),
        p(
          "Fehlt Profil oder sind die Reifen zu alt, bleibt vor dem Urlaub noch Zeit für einen neuen Satz. Vergleichen Sie die Preise in Ihrer Größe, zum Beispiel [205/55 R16](/reifen/205-55-r16), [225/45 R17](/reifen/225-45-r17) oder [225/50 R17](/reifen/225-50-r17), und nutzen Sie den [Preisalarm](/artikel/winterreifen-guenstig-kaufen-preisverlauf-preisalarm-2026), wenn Sie noch ein paar Tage warten können. Welche Modelle im Test vorn liegen, zeigt der [ADAC Winterreifentest 2026](/artikel/adac-winterreifentest-2026-testsieger). Alle Angebote finden Sie im [Reifenpreisvergleich](/reifenpreisvergleich)."
        ),
      ],
      [
        h2("Häufige Fragen"),
        h3("Gilt in Österreich eine generelle Winterreifenpflicht?"),
        p(
          "Nein, sie gilt vom 1. November bis 15. April nur bei winterlichen Straßenverhältnissen. Da das Wetter in den Bergen schnell umschlägt, sollten Sie in diesem Zeitraum immer mit Winterreifen fahren."
        ),
        h3("Reichen M+S-Reifen im Ausland?"),
        p(
          "In Österreich und Italien werden M+S-Reifen noch anerkannt, in Frankreich seit November 2024 nicht mehr. Mit Alpine-Symbol sind Sie in allen genannten Ländern richtig ausgerüstet."
        ),
        h3("Muss ich Schneeketten dabeihaben?"),
        p(
          "Mit Winterreifen meist nicht. Pflicht sind sie dort, wo ein Schild sie vorschreibt – das betrifft vor allem Pass- und Bergstraßen. Für Fahrten in Skigebiete sind Ketten im Kofferraum sinnvoll."
        ),
        h3("Gelten die Regeln auch für Mietwagen?"),
        p(
          "Ja, verantwortlich ist der Fahrer. Prüfen Sie bei der Übernahme Reifen und Profil und fragen Sie bei Bedarf nach Schneeketten."
        ),
        p(
          "Quelle: ADAC, „Winterreifen- und Schneeketten-Pflicht in 21 europäischen Ländern“ (Stand Oktober 2026). Alle Angaben ohne Gewähr – Regeln und Bußgelder können sich ändern, bitte vor der Abfahrt aktuell prüfen."
        ),
      ],
    ],
  },
];

// "Auch interessant" block added to the existing winter articles (internal links)
const EXISTING = [
  "winterreifenpflicht-2026-alpine-symbol-bussgeld",
  "adac-winterreifentest-2026-testsieger",
  "ganzjahresreifen-oder-winterreifen-2026",
  "reifenpreise-2026-preisrechner",
  "winterreifen-guenstig-kaufen-preisverlauf-preisalarm-2026",
  "lastindex-geschwindigkeitsindex-winterreifen-91h-94v-xl",
];
const alsoRead = [
  h2("Auch interessant"),
  ul([
    `[Wie alt dürfen Winterreifen sein? DOT-Nummer lesen und Reifenalter prüfen](/artikel/${SLUG_ALTER})`,
    `[Winterreifenpflicht im Ausland: Österreich, Schweiz, Italien und Frankreich](/artikel/${SLUG_AUSLAND})`,
  ]),
];

const dry = process.argv.includes("--dry");
const linkExisting = process.argv.includes("--link-existing");

if (dry) {
  for (const post of posts) {
    const text = post.contentBlocks.flat().flatMap((b) => [b.text || "", ...(b.items || [])]).join(" ");
    const words = text.split(/\s+/).length;
    const links = [...text.matchAll(/\]\((\/[^)]+)\)/g)].map((m) => m[1]);
    console.log(
      `\n${post.title}\n  /artikel/${post.slug}\n  title ${post.title.length} chars · meta ${post.metaDescription.length} chars · ~${words} words · ${links.length} internal links`
    );
    console.log("  " + [...new Set(links)].join("\n  "));
  }
  if (linkExisting) console.log(`\nWould add "Auch interessant" to: ${EXISTING.join(", ")}`);
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
if (linkExisting) {
  for (const slug of EXISTING) {
    const blog = await Blog.findOne({ slug });
    if (!blog) {
      console.log(`– ${slug} not found, skipped`);
      continue;
    }
    const already = JSON.stringify(blog.contentBlocks || []).includes(SLUG_ALTER);
    if (already) {
      console.log(`= ${slug} already links, skipped`);
      continue;
    }
    blog.contentBlocks = [...(blog.contentBlocks || []), alsoRead];
    blog.markModified("contentBlocks");
    await blog.save();
    console.log(`✔ linked from ${slug}`);
  }
}
await mongoose.disconnect();
