#!/usr/bin/env node
/**
 * Two SEO articles (November 2026):
 *  1. Reifenpreisvergleich / Reifen-Vergleichsportal – what a good tyre comparison
 *     site must show (total price incl. shipping, price history, alerts, EU label),
 *     the kinds of portals in Germany, and a 5-step price check on Reifexa.
 *     Targets: "reifenpreisvergleich", "reifen vergleichsportal", "reifen vergleichen",
 *     "reifenpreise vergleichen", "reifen preisvergleich online".
 *  2. Reifencheck – check tyres yourself in 5 minutes (tread depth, age/DOT,
 *     pressure, damage, size) and what to do when new tyres are due.
 *     Targets: "reifencheck", "reifen check", "reifen prüfen", "profiltiefe messen",
 *     "reifen selbst prüfen".
 *
 *   node scripts/seed-blogs-vergleich-reifencheck-2026.mjs --dry            # print, write nothing
 *   node scripts/seed-blogs-vergleich-reifencheck-2026.mjs                  # upsert both articles by slug
 *   node scripts/seed-blogs-vergleich-reifencheck-2026.mjs --link-existing  # also add a "Weiterlesen"
 *        block linking to the new articles to the existing 2026 articles (once; skipped if present)
 *
 * Facts and sources:
 *  - Mindestprofiltiefe 1,6 mm (§ 36 Abs. 2 StVZO); Bußgeld Fahrer 60 € + 1 Punkt,
 *    mit Gefährdung 75 €, mit Unfall 90 €; Halter 75 € + 1 Punkt (bussgeldkatalog.org).
 *  - ADAC-Empfehlung: mind. 3 mm Sommer, mind. 4 mm Winter-/Ganzjahresreifen; goldener Rand
 *    der 1-Euro-Münze knapp über 3 mm; TWI-Stege (adac.de, Reifenprofil).
 *  - Reifendruck: ADAC rät, etwa alle zwei Wochen und nur am kalten Reifen zu prüfen (adac.de).
 * Example prices in the text are marked as examples.
 * Text links use "[Text](/pfad)" — rendered as internal links by the site.
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

const SLUG_VERGLEICH = "reifenpreisvergleich-reifen-vergleichsportal-2026";
const SLUG_CHECK = "reifencheck-2026-reifen-selbst-pruefen-checkliste";

// existing articles (see the other seed scripts)
const A = {
  pflicht: "/artikel/winterreifenpflicht-2026-alpine-symbol-bussgeld",
  adac: "/artikel/adac-winterreifentest-2026-testsieger",
  ganzjahr: "/artikel/ganzjahresreifen-oder-winterreifen-2026",
  preise: "/artikel/reifenpreise-2026-preisrechner",
  alter: "/artikel/wie-alt-duerfen-winterreifen-sein-dot-nummer-reifenalter",
  preisalarm: "/artikel/winterreifen-guenstig-kaufen-preisverlauf-preisalarm-2026",
  index: "/artikel/lastindex-geschwindigkeitsindex-winterreifen-91h-94v-xl",
};

const posts = [
  // ------------------------------------------------------------------ 1
  {
    slug: SLUG_VERGLEICH,
    coverImage: "/images/blogs/reifenpreisvergleich-vergleichsportal-2026.webp",
    title: "Reifenpreisvergleich 2026: Das beste Reifen-Vergleichsportal finden",
    metaDescription:
      "Reifen vergleichen, aber richtig: Woran Sie ein gutes Reifen-Vergleichsportal erkennen – Gesamtpreis mit Versand, Preisverlauf, Preisalarm und EU-Label.",
    tags: [
      "Reifenpreisvergleich",
      "Reifen Vergleichsportal",
      "Reifen vergleichen",
      "Reifenpreise",
      "Reifen online kaufen",
      "Preisvergleich",
      "Ratgeber",
    ],
    contentBlocks: [
      [
        p(
          "Wer neue Reifen braucht, sucht meist zuerst nach einem Reifenpreisvergleich. Das ist eine gute Idee: Für denselben Reifen in derselben Größe verlangen Online-Shops oft deutlich unterschiedliche Preise. Beim Satz aus vier Reifen kommen so schnell 30, 50 oder mehr Euro Unterschied zusammen. Doch Vergleichsportal ist nicht gleich Vergleichsportal. Manche zeigen nur den Stückpreis, andere verschweigen Versandkosten, und kaum eines verrät, ob der Preis gerade günstig oder teuer ist."
        ),
        p(
          "In diesem Ratgeber erfahren Sie, woran Sie ein gutes Reifen-Vergleichsportal erkennen, welche Arten von Portalen es in Deutschland gibt und wie Sie in fünf Schritten den wirklich günstigsten Reifen finden – am Beispiel der beliebten Golf-Größe [205/55 R16](/reifen/205-55-r16)."
        ),
      ],
      [
        h2("Was ein Reifenpreisvergleich leisten muss"),
        p(
          "Ein Reifenpreisvergleich soll Ihnen Arbeit abnehmen: Statt zehn Shops einzeln zu öffnen, sehen Sie alle Angebote für Ihren Reifen auf einer Seite. Damit der Vergleich wirklich hilft, sollte er diese sieben Punkte erfüllen:"
        ),
        ol([
          "Gesamtpreis statt Stückpreis: Der günstigste Stückpreis ist wertlos, wenn hohe Versandkosten dazukommen. Gute Portale lassen sich nach Preis inklusive Versand sortieren.",
          "Nur lieferbare Angebote: Ein Bestpreis, den man nicht bestellen kann, führt in die Irre. Ausverkaufte Angebote sollten markiert oder ausgeblendet sein.",
          "Exakt derselbe Reifen: Größe, Lastindex und Geschwindigkeitsindex müssen übereinstimmen – 91H ist nicht 94V XL. Mehr dazu im Ratgeber zu [Lastindex und Geschwindigkeitsindex](" + A.index + ").",
          "Preisverlauf: Erst der Verlauf der letzten 30 bis 90 Tage zeigt, ob der heutige Preis ein gutes Angebot ist.",
          "Preisalarm: Sie legen einen Reifen fest und werden benachrichtigt, sobald der Preis sinkt.",
          "EU-Reifenlabel: Rollwiderstand, Nasshaftung und Rollgeräusch gehören neben den Preis.",
          "Transparenz: Ein unabhängiges Portal sagt offen, wie es Geld verdient – meist über Provisionen der Händler, ohne Aufpreis für Sie.",
        ]),
      ],
      [
        h2("Welche Reifen-Vergleichsportale gibt es in Deutschland?"),
        p(
          "Grob lassen sich die Angebote in vier Gruppen einteilen. Jede hat Stärken – und blinde Flecken."
        ),
        h3("1. Große Vergleichsportale mit Montage-Service"),
        p(
          "Bekannte Portale wie CHECK24 Reifen verbinden den Reifenkauf mit der Montage in einer Partnerwerkstatt. Praktisch, wenn Sie alles aus einer Hand möchten. Der Vergleich findet hier allerdings vor allem zwischen den eigenen Partnern des Portals statt."
        ),
        h3("2. Test-orientierte Portale"),
        p(
          "Seiten wie Reifenlab verknüpfen Preise mit Testergebnissen von ADAC, Auto Bild & Co. Ideal, wenn Sie vor allem wissen wollen, welcher Reifen im Test vorne liegt. Für die eigentliche Preisentwicklung über mehrere Wochen bieten solche Seiten meist weniger Details."
        ),
        h3("3. Allgemeine Preissuchmaschinen"),
        p(
          "Preissuchmaschinen wie idealo, billiger.de oder guenstiger.de vergleichen Reifen neben Fernsehern und Kaffeemaschinen. Die Auswahl ist groß, aber reifenspezifische Filter – etwa nach Lastindex, Alpine-Symbol oder EU-Label – fehlen oft oder sind schwer zu finden."
        ),
        h3("4. Spezialisierte Reifenpreisvergleiche"),
        p(
          "Portale wie Reifexa konzentrieren sich nur auf Reifen. Hier stehen Händlerpreise, Versandkosten, Lieferzeit, Preisverlauf und EU-Label direkt nebeneinander, und Sie können Reifen per Größe, Marke und Saison filtern. Gekauft wird anschließend beim Händler Ihrer Wahl – zum Beispiel bei reifen.com, ReifenDirekt oder Reifen24."
        ),
        p(
          "Tipp: Nutzen Sie ruhig zwei Quellen. Ein Testportal sagt Ihnen, welcher Reifen gut ist. Ein spezialisierter Reifenpreisvergleich sagt Ihnen, wo und wann Sie ihn am günstigsten bekommen."
        ),
      ],
      [
        h2("In 5 Schritten zum günstigsten Reifen"),
        p(
          "So gehen Sie bei Reifexa vor – das Prinzip gilt für jedes gute Vergleichsportal."
        ),
        ol([
          "Reifengröße eingeben: Die Größe steht auf der Reifenflanke, etwa 205/55 R16 91H. Im Suchfeld auf der Startseite wählen Sie Reifentyp, Breite, Höhe und Zoll – oder Sie springen direkt in die Übersicht aller [Reifengrößen von A bis Z](/reifen).",
          "Saison wählen: [Winterreifen](/winterreifen), [Sommerreifen](/sommerreifen) oder [Ganzjahresreifen](/ganzjahresreifen). Bei Schnee, Eis und Glätte brauchen Sie in Deutschland Reifen mit Alpine-Symbol – alle Regeln im Ratgeber zur [Winterreifenpflicht 2026](" + A.pflicht + ").",
          "Filtern und sortieren: Grenzen Sie nach Marke, Preis oder EU-Label ein und sortieren Sie nach Preis. Jede Produktkarte zeigt bereits die günstigsten Händler.",
          "Alle Angebote öffnen: Auf der Produktseite sehen Sie jeden Händler mit Preis, Versandkosten, Lieferzeit und Zahlungsarten. Sortieren Sie nach „Preis mit Versand“ – erst dann sehen Sie den echten Endpreis.",
          "Preisverlauf prüfen oder Preisalarm setzen: Liegt der Preis im unteren Bereich der letzten 90 Tage, können Sie zugreifen. Wenn nicht, aktivieren Sie den Preisalarm und lassen sich benachrichtigen, sobald er fällt.",
        ]),
      ],
      [
        h2("Rechenbeispiel: Warum der Versand entscheidet"),
        p(
          "Ein vereinfachtes Beispiel (Beispielpreise, keine Live-Angebote) für vier Winterreifen in 205/55 R16:"
        ),
        ul([
          "Händler A: 90,00 € pro Reifen + 20,00 € Versand = 380,00 €",
          "Händler B: 94,00 € pro Reifen, versandkostenfrei = 376,00 €",
          "Händler C: 88,00 € pro Reifen + 30,00 € Versand = 382,00 €",
        ]),
        p(
          "Händler C hat den günstigsten Stückpreis – und ist am Ende der teuerste. Wer nur auf den Stückpreis achtet, zahlt drauf. Genau deshalb sollte ein Reifenpreisvergleich immer den Gesamtpreis für vier Reifen zeigen. Was Reifen für Ihr Auto ungefähr kosten, berechnen Sie mit dem Preisrechner im Ratgeber [Reifenpreise 2026](" + A.preise + ")."
        ),
        { type: "widget", widget: "reifen-preisrechner" },
      ],
      [
        h2("Der richtige Zeitpunkt: Preisverlauf und Preisalarm"),
        p(
          "Reifenpreise schwanken mit der Saison. Vor dem ersten Frost sind die Lager voll, kurz danach werden gefragte Größen knapp und teurer. Ein Blick auf den Preisverlauf zeigt, ob der aktuelle Bestpreis eher am unteren oder oberen Ende liegt. Wie Sie die Kurve richtig lesen und den Preisalarm auf dem Handy einrichten, erklären wir Schritt für Schritt im Ratgeber [Winterreifen günstig kaufen: Preisverlauf & Preisalarm](" + A.preisalarm + ")."
        ),
        p(
          "Übrigens: Reifexa lässt sich wie eine App auf den Home-Bildschirm Ihres Smartphones legen. Gespeicherte Lieblingsreifen finden Sie dann unter „Favoriten“, und Preisalarme kommen als Push-Nachricht."
        ),
      ],
      [
        h2("Mehr als der Preis: EU-Label und Tests"),
        p(
          "Der günstigste Reifen ist nicht automatisch die beste Wahl. Achten Sie auf das EU-Reifenlabel: Die Klasse für Nasshaftung (A ist am besten) sagt viel über den Bremsweg auf nasser Straße, der Rollwiderstand über den Verbrauch und die Dezibel-Angabe über das Abrollgeräusch. Mit dem Reifenvergleich auf Reifexa stellen Sie bis zu vier Reifen nebeneinander – die besten Werte sind farblich markiert."
        ),
        p(
          "Für Winterreifen lohnt zusätzlich ein Blick auf den [ADAC Winterreifentest 2026](" + A.adac + "). Unsicher, ob es überhaupt ein Winterreifen sein muss? Die Entscheidungshilfe finden Sie unter [Ganzjahresreifen oder Winterreifen](" + A.ganzjahr + ")."
        ),
      ],
      [
        h2("Häufige Fragen zum Reifenpreisvergleich"),
        h3("Ist ein Reifenpreisvergleich kostenlos?"),
        p(
          "Ja. Reifexa und die meisten anderen Vergleichsportale sind für Sie kostenlos. Sie finanzieren sich über Provisionen der Händler, wenn Sie über einen Link kaufen – der Preis für Sie bleibt gleich."
        ),
        h3("Kaufe ich bei Reifexa direkt ein?"),
        p(
          "Nein. Reifexa ist ein Preisvergleich. Mit einem Klick auf „Zum Angebot“ gelangen Sie zum Händler und bestellen dort. Preis und Verfügbarkeit sollten Sie vor dem Kauf beim Händler noch einmal prüfen."
        ),
        h3("Wie finde ich meine Reifengröße?"),
        p(
          "Die Größe steht auf der Reifenflanke (zum Beispiel 205/55 R16 91H) und in der Zulassungsbescheinigung Teil I. Wie Sie die Angaben lesen, zeigt unser Ratgeber zu [Lastindex und Geschwindigkeitsindex](" + A.index + ")."
        ),
        h3("Wann sind Reifen am günstigsten?"),
        p(
          "Häufig vor Saisonbeginn – für Winterreifen also im Spätsommer und frühen Herbst. Weil sich Preise aber auch kurzfristig ändern, ist ein Preisalarm der sicherste Weg, keinen Preisrutsch zu verpassen."
        ),
      ],
      [
        h2("Fazit"),
        p(
          "Ein guter Reifenpreisvergleich zeigt Ihnen nicht nur den niedrigsten Stückpreis, sondern den Gesamtpreis mit Versand, den Preisverlauf und das EU-Label – für genau Ihren Reifen. So sparen Sie Geld, ohne bei der Sicherheit Kompromisse zu machen. Starten Sie direkt mit Ihrer Größe, zum Beispiel [205/55 R16](/reifen/205-55-r16), [195/65 R15](/reifen/195-65-r15) oder [225/45 R17](/reifen/225-45-r17), oder lesen Sie, [wie der Reifenpreisvergleich bei Reifexa funktioniert](/reifenpreisvergleich)."
        ),
      ],
    ],
  },

  // ------------------------------------------------------------------ 2
  {
    slug: SLUG_CHECK,
    coverImage: "/images/blogs/reifencheck-2026-checkliste.webp",
    title: "Reifencheck 2026: Reifen in 5 Minuten selbst prüfen (Checkliste)",
    metaDescription:
      "Reifencheck selbst gemacht: Profiltiefe mit der 1-Euro-Münze messen, Reifenalter (DOT) lesen, Reifendruck und Schäden prüfen – plus was neue Reifen kosten.",
    tags: [
      "Reifencheck",
      "Reifen prüfen",
      "Profiltiefe",
      "Reifenalter",
      "Reifendruck",
      "Checkliste",
      "Ratgeber",
    ],
    contentBlocks: [
      [
        p(
          "Reifen sind die einzige Verbindung zwischen Auto und Straße – jeder einzelne hat nur etwa die Fläche einer Postkarte Kontakt zum Asphalt. Trotzdem schauen viele Autofahrer erst hin, wenn die Werkstatt Alarm schlägt. Dabei dauert ein Reifencheck keine fünf Minuten und gelingt ganz ohne Werkzeug."
        ),
        p(
          "In diesem Ratgeber zeigen wir die fünf Punkte, die Sie regelmäßig prüfen sollten: Profiltiefe, Reifenalter, Reifendruck, Schäden und die richtige Reifengröße. Am Ende steht eine kurze Checkliste – und was zu tun ist, wenn neue Reifen fällig sind."
        ),
      ],
      [
        h2("1. Profiltiefe messen – mit der 1-Euro-Münze"),
        p(
          "Gesetzlich vorgeschrieben sind in Deutschland mindestens 1,6 Millimeter Profiltiefe im Hauptprofil (§ 36 StVZO). Das ist allerdings nur das absolute Minimum. Der ADAC empfiehlt mindestens 3 Millimeter für Sommerreifen und mindestens 4 Millimeter für Winter- und Ganzjahresreifen, denn mit sinkender Profiltiefe wird der Bremsweg auf nasser und verschneiter Fahrbahn deutlich länger."
        ),
        ul([
          "1-Euro-Münze: Der goldene Rand ist knapp über 3 Millimeter breit. Stecken Sie die Münze in eine der Hauptrillen in der Mitte der Lauffläche. Verschwindet der goldene Rand ganz, hat der Reifen noch mindestens etwa 3 mm.",
          "Ist ein Teil des goldenen Rands sichtbar, sollten Sie bald über neue Reifen nachdenken – bei Winterreifen erst recht.",
          "Verschleißanzeiger (TWI): In den Rillen sitzen kleine Stege. Gehen sie ohne Absatz in die Profilblöcke über, ist die gesetzliche Grenze erreicht. Dann darf der Reifen nicht mehr gefahren werden.",
          "Genauer geht es mit einem Profiltiefenmesser für wenige Euro. Messen Sie an mehreren Stellen und an allen vier Reifen.",
        ]),
        p(
          "Wer mit zu wenig Profil erwischt wird, zahlt 60 Euro und bekommt einen Punkt in Flensburg; mit Gefährdung sind es 75 Euro, bei einem Unfall 90 Euro. Auch der Halter kann belangt werden. Alle Regeln für die kalte Jahreszeit finden Sie im Ratgeber zur [Winterreifenpflicht 2026](" + A.pflicht + ")."
        ),
      ],
      [
        h2("2. Reifenalter prüfen – die DOT-Nummer"),
        p(
          "Auch ein Reifen mit viel Profil kann zu alt sein. Gummi härtet mit den Jahren aus, die Haftung lässt nach – besonders bei Kälte. Das Herstellungsdatum steht als vierstellige Zahl am Ende der DOT-Nummer auf der Flanke: „4523“ bedeutet zum Beispiel Kalenderwoche 45 im Jahr 2023."
        ),
        p(
          "Ein gesetzliches Höchstalter gibt es für Pkw-Reifen nicht. Viele Experten raten aber, Reifen nach spätestens acht bis zehn Jahren zu ersetzen, und Winterreifen verlieren schon früher an Griffigkeit. Wie Sie die DOT-Nummer lesen und ab wann es kritisch wird, erklärt unser Ratgeber [Wie alt dürfen Winterreifen sein?](" + A.alter + ")"
        ),
      ],
      [
        h2("3. Reifendruck kontrollieren"),
        p(
          "Zu wenig Luft erhöht den Verbrauch, lässt den Reifen schneller verschleißen und verschlechtert das Fahrverhalten. Der ADAC rät, den Reifendruck etwa alle zwei Wochen zu prüfen – und zwar am kalten Reifen, also bevor Sie längere Strecken gefahren sind."
        ),
        ul([
          "Den richtigen Wert finden Sie meist im Tankdeckel, an der Fahrertür (B-Säule) oder in der Betriebsanleitung.",
          "Mit voller Beladung oder Anhänger gilt in der Regel ein höherer Wert.",
          "Bei Kälte sinkt der Druck – im Winter also öfter nachmessen.",
          "Das Reifendruckkontrollsystem (RDKS) warnt bei Druckverlust, ersetzt aber nicht die regelmäßige Kontrolle an der Tankstelle.",
        ]),
      ],
      [
        h2("4. Schäden erkennen"),
        p(
          "Gehen Sie einmal um das Auto herum und schauen Sie sich jede Reifenflanke und die Lauffläche genau an. Diese Warnzeichen sollten Sie ernst nehmen:"
        ),
        ul([
          "Beulen oder Blasen an der Flanke – oft nach einem Bordsteinkontakt. Hier kann die Karkasse beschädigt sein: sofort in die Werkstatt.",
          "Risse und poröse Stellen im Gummi, besonders bei älteren Reifen.",
          "Eingefahrene Nägel, Schrauben oder Steine.",
          "Ungleichmäßiger Abrieb: Innen oder außen stärker abgefahren deutet auf eine verstellte Spur oder falschen Luftdruck hin.",
        ]),
        p(
          "Im Zweifel gilt: lieber einmal mehr von einer Fachwerkstatt prüfen lassen. Ein beschädigter Reifen kann bei hoher Geschwindigkeit plötzlich versagen."
        ),
      ],
      [
        h2("5. Passen Größe, Index und Saison?"),
        p(
          "Zum Reifencheck gehört auch ein Blick auf die Angaben auf der Flanke. Die Reifengröße, zum Beispiel 205/55 R16, muss zu Ihrem Auto passen – die zulässigen Größen stehen in der Zulassungsbescheinigung Teil I. Dahinter folgen Lastindex und Geschwindigkeitsindex, etwa 91H. Was die Zahlen und Buchstaben bedeuten, lesen Sie im Ratgeber [Lastindex & Geschwindigkeitsindex](" + A.index + ")."
        ),
        p(
          "Für den Winter wichtig: Seit dem 1. Oktober 2024 erfüllen in Deutschland nur noch Reifen mit Alpine-Symbol (Bergpiktogramm mit Schneeflocke) die situative Winterreifenpflicht. Reifen, die nur mit M+S gekennzeichnet sind, reichen nicht mehr aus. Ob Winter- oder Ganzjahresreifen für Sie besser passen, zeigt der Vergleich [Ganzjahresreifen oder Winterreifen](" + A.ganzjahr + ")."
        ),
      ],
      [
        h2("Ihre Reifencheck-Checkliste"),
        ul([
          "Profiltiefe: Sommer mindestens 3 mm, Winter/Ganzjahr mindestens 4 mm empfohlen (gesetzlich 1,6 mm).",
          "Reifenalter: DOT-Nummer lesen; ab etwa acht Jahren besonders kritisch prüfen.",
          "Reifendruck: alle zwei Wochen, am kalten Reifen, Wert aus Tankdeckel oder Türholm.",
          "Schäden: Beulen, Risse, Fremdkörper, ungleichmäßiger Abrieb.",
          "Größe & Kennzeichnung: passende Reifengröße, Last-/Geschwindigkeitsindex, im Winter Alpine-Symbol.",
          "Ersatzrad oder Pannenset nicht vergessen.",
        ]),
      ],
      [
        h2("Neue Reifen fällig? So machen Sie den Preis-Check"),
        p(
          "Fällt der Reifencheck durch, steht der nächste Check an: der Preis. Für denselben Reifen verlangen Online-Händler oft sehr unterschiedliche Preise – und erst mit den Versandkosten zeigt sich, wer wirklich am günstigsten ist."
        ),
        ol([
          "Reifengröße von der Flanke ablesen, zum Beispiel 205/55 R16 91H.",
          "Größe auf Reifexa eingeben oder direkt aufrufen: [205/55 R16](/reifen/205-55-r16), [195/65 R15](/reifen/195-65-r15), [205/60 R16](/reifen/205-60-r16) oder [225/45 R17](/reifen/225-45-r17).",
          "Saison wählen – [Winterreifen](/winterreifen), [Sommerreifen](/sommerreifen) oder [Ganzjahresreifen](/ganzjahresreifen) – und nach Marke filtern, etwa [Continental](/marken/continental) oder [Michelin](/marken/michelin).",
          "Auf der Produktseite alle Händler nach „Preis mit Versand“ sortieren und den Preisverlauf der letzten 90 Tage prüfen.",
          "Kein guter Moment? Preisalarm aktivieren – Sie werden benachrichtigt, sobald der Preis sinkt.",
        ]),
        p(
          "Worauf es beim Vergleichen ankommt und welche Portale es gibt, lesen Sie im Ratgeber [Reifenpreisvergleich 2026: Das beste Reifen-Vergleichsportal finden](/artikel/" + SLUG_VERGLEICH + ")."
        ),
      ],
      [
        h2("Häufige Fragen zum Reifencheck"),
        h3("Wie oft sollte ich meine Reifen prüfen?"),
        p(
          "Den Reifendruck etwa alle zwei Wochen und vor langen Fahrten. Profil, Alter und Schäden spätestens bei jedem Reifenwechsel im Frühjahr und Herbst – besser einmal im Monat."
        ),
        h3("Was kostet ein Reifencheck in der Werkstatt?"),
        p(
          "Viele Werkstätten und Reifenhändler prüfen Reifen beim saisonalen Reifenwechsel ohnehin mit. Den einfachen Check aus diesem Ratgeber können Sie jederzeit selbst und kostenlos machen."
        ),
        h3("Reicht die 1-Euro-Münze als Messwerkzeug?"),
        p(
          "Für eine schnelle Einschätzung ja: Der goldene Rand zeigt, ob noch etwa 3 mm Profil vorhanden sind. Für millimetergenaue Werte – etwa bei Winterreifen nahe der 4-mm-Empfehlung – lohnt ein günstiger Profiltiefenmesser."
        ),
        h3("Muss ich alle vier Reifen auf einmal tauschen?"),
        p(
          "Nicht zwingend, mindestens aber paarweise pro Achse. Die Reifen mit mehr Profil gehören dabei in der Regel auf die Hinterachse. Bei Allradfahrzeugen sind die Herstellerangaben zu beachten."
        ),
      ],
    ],
  },
];

const EXISTING = [
  "winterreifenpflicht-2026-alpine-symbol-bussgeld",
  "adac-winterreifentest-2026-testsieger",
  "ganzjahresreifen-oder-winterreifen-2026",
  "reifenpreise-2026-preisrechner",
  "wie-alt-duerfen-winterreifen-sein-dot-nummer-reifenalter",
  "winterreifen-guenstig-kaufen-preisverlauf-preisalarm-2026",
  "lastindex-geschwindigkeitsindex-winterreifen-91h-94v-xl",
];
const readMore = [
  h2("Auch interessant"),
  ul([
    `[Reifencheck 2026: Reifen in 5 Minuten selbst prüfen](/artikel/${SLUG_CHECK})`,
    `[Reifenpreisvergleich 2026: Das beste Reifen-Vergleichsportal finden](/artikel/${SLUG_VERGLEICH})`,
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
    const already = JSON.stringify(blog.contentBlocks || []).includes(SLUG_CHECK);
    if (already) {
      console.log(`= ${slug} already links, skipped`);
      continue;
    }
    blog.contentBlocks = [...(blog.contentBlocks || []), readMore];
    blog.markModified("contentBlocks");
    await blog.save();
    console.log(`✔ linked from ${slug}`);
  }
}
await mongoose.disconnect();
