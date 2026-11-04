#!/usr/bin/env node
/**
 * Two SEO articles for winter 2026/27 about using the product page:
 * price history, best price, dealer comparison, price alert, load/speed
 * index variants, related tyres, specs and EU label.
 *
 *   node scripts/seed-blogs-winter-preise-2026.mjs --dry            # print, write nothing
 *   node scripts/seed-blogs-winter-preise-2026.mjs                  # upsert both articles by slug
 *   node scripts/seed-blogs-winter-preise-2026.mjs --link-existing  # also add a "Weiterlesen"
 *        block with links to the new articles to the 2026 winter articles (once; skipped if present)
 *
 * Load index / speed index values are the standard ETRTO/ECE tables.
 * The winter-tyre speed exception (sticker in the driver's view) follows § 36 StVZO.
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

const SLUG_PREIS = "winterreifen-guenstig-kaufen-preisverlauf-preisalarm-2026";
const SLUG_INDEX = "lastindex-geschwindigkeitsindex-winterreifen-91h-94v-xl";

const posts = [
  // ------------------------------------------------------------------ 1
  {
    slug: SLUG_PREIS,
    coverImage: "/images/blogs/winterreifen-preisverlauf-preisalarm-2026.webp",
    title: "Winterreifen günstig kaufen 2026: Preisverlauf & Preisalarm",
    metaDescription:
      "Winterreifen 2026 günstig kaufen: So lesen Sie Preisverlauf und Bestpreis, vergleichen Händler richtig und lassen sich per Preisalarm benachrichtigen.",
    tags: [
      "Winterreifen",
      "Preisvergleich",
      "Preisverlauf",
      "Preisalarm",
      "Reifen kaufen",
      "Ratgeber",
    ],
    contentBlocks: [
      [
        p(
          "Derselbe Winterreifen, dieselbe Größe – und trotzdem liegen zwischen dem günstigsten und dem teuersten Shop oft mehrere Euro pro Reifen. Beim Satz aus vier Reifen wird daraus schnell ein zweistelliger Betrag. Dazu kommt: Reifenpreise sind nicht fest. Sie ändern sich mit der Saison, mit dem Lagerbestand der Händler und manchmal mehrmals pro Woche."
        ),
        p(
          "In diesem Ratgeber zeigen wir Schritt für Schritt, wie Sie auf der Produktseite von Reifexa den besten Preis erkennen, den Preisverlauf richtig lesen und mit dem Preisalarm keinen Preisrutsch mehr verpassen. Als Beispiel nehmen wir einen der beliebtesten Winterreifen in der Golf-Größe [205/55 R16](/reifen/205-55-r16)."
        ),
      ],
      [
        h2("Warum Winterreifen-Preise schwanken"),
        p(
          "Reifenpreise folgen Angebot und Nachfrage. Im Spätsommer haben die Händler volle Lager und wenig Käufer. Mit dem ersten Nachtfrost im Oktober steigt die Nachfrage sprunghaft – und mit ihr die Gefahr, dass gefragte Größen knapp werden. Dazu kommen Aktionen einzelner Shops, neue Testergebnisse wie der [ADAC Winterreifentest 2026](/artikel/adac-winterreifentest-2026-testsieger) und Modellwechsel der Hersteller."
        ),
        ul([
          "Saison: Vor dem ersten Schnee ist die Auswahl am größten, kurz danach wird es in beliebten Größen eng.",
          "Händler: Jeder Shop kalkuliert anders – Versand, Lagerbestand und Aktionen machen den Unterschied.",
          "Modellwechsel: Läuft ein Reifenmodell aus, wird der Vorgänger oft günstiger.",
          "Testergebnisse: Testsieger sind nach Veröffentlichung schnell gefragt.",
        ]),
        p(
          "Wer also nur einmal kurz in einen Shop schaut, sieht eine Momentaufnahme. Wer den Verlauf kennt, kauft gezielter."
        ),
      ],
      [
        h2("Der beste Preis auf einen Blick"),
        p(
          "Ganz oben auf jeder Produktseite steht der Kasten „Bester Preis“. Er zeigt den niedrigsten aktuellen Preis aller lieferbaren Angebote, den Händler dazu und darunter die Zeile „Angebote ab … bei … Händlern“. Ausverkaufte Angebote zählen nicht mit – so sehen Sie nie einen Preis, den Sie gar nicht bestellen können."
        ),
        ul([
          "Durchgestrichener Preis: das teuerste aktuelle Angebot zum Vergleich.",
          "Prozent-Badge: so viel sparen Sie gegenüber diesem teuersten Angebot.",
          "Mini-Verlauf: die kleine Kurve zeigt, wie sich der Bestpreis in den letzten 30 Tagen entwickelt hat.",
          "Versand und Lieferzeit: direkt neben dem Händlernamen, damit Sie den Endpreis abschätzen können.",
        ]),
        p(
          "Ein Tipp auf „Zum Angebot“ führt direkt zum Shop mit dem besten Preis. Beim Scrollen bleibt eine schmale Leiste mit Bestpreis und Button unten am Bildschirm stehen – Sie müssen also nicht zurück nach oben."
        ),
      ],
      [
        h2("Händler vergleichen: mehr als nur der Stückpreis"),
        p(
          "Unter „Bestes Angebot“ listet die Produktseite alle Händler, standardmäßig sortiert nach Preis. Das günstigste Angebot ist markiert. Zu jedem Händler sehen Sie Lieferzeit, Versandkosten und – wo vorhanden – die Zahlungsarten."
        ),
        h3("Rechenbeispiel: vier Winterreifen, fünf Händler"),
        p(
          "Angenommen, ein Winterreifen kostet beim günstigsten Händler 69,49 € und beim teuersten 76,20 € (Beispielpreise). Pro Reifen sind das 6,71 €, beim Satz aus vier Reifen 26,84 € Unterschied – für exakt denselben Reifen. Bei größeren Dimensionen wie [225/45 R17](/reifen/225-45-r17) oder SUV-Größen fällt die Spanne oft noch größer aus."
        ),
        ol([
          "Stückpreis vergleichen – aber immer mal vier rechnen.",
          "Versandkosten prüfen: Viele Shops liefern Reifen versandkostenfrei, nicht alle.",
          "Lieferzeit beachten: Kurz vor dem Wintereinbruch zählen ein paar Tage.",
          "Montage einplanen: Viele Händler liefern direkt an eine Partnerwerkstatt.",
        ]),
        p(
          "Was Montage, Auswuchten und RDKS zusätzlich kosten, erklären wir im Artikel [Reifenpreise 2026](/artikel/reifenpreise-2026-preisrechner)."
        ),
      ],
      [
        h2("Den Preisverlauf richtig lesen"),
        p(
          "Weiter unten auf der Produktseite finden Sie die Preisentwicklung. Die blaue Linie zeigt den besten Preis über alle Händler, die farbigen Linien die Preise der einzelnen Shops. Über dem Diagramm wählen Sie den Zeitraum: 30 Tage, 90 Tage oder 1 Jahr."
        ),
        ul([
          "Bester Preis heute: der aktuelle Tiefstpreis über alle lieferbaren Angebote.",
          "Tiefster Preis: der niedrigste Bestpreis im gewählten Zeitraum.",
          "Höchster Preis: der höchste Bestpreis im gewählten Zeitraum.",
          "Veränderung: wie stark der Bestpreis gestiegen oder gefallen ist.",
        ]),
        p(
          "Liegt der heutige Preis auf dem Tiefstand des Zeitraums, erscheint der grüne Hinweis „Aktuell der günstigste Preis der letzten 90 Tage“ – ein gutes Zeichen, dass jetzt ein günstiger Moment zum Kaufen ist."
        ),
        h3("Einzelne Händler hervorheben"),
        p(
          "Fahren Sie mit der Maus über einen Händler in der Legende, über eine Linie im Diagramm oder über eine Zeile in „Preise heute im Vergleich“: Die Linie dieses Händlers wird dicker und rückt nach vorn, alle anderen werden blass. Auf dem Smartphone tippen Sie dafür auf den Händler in der Preisliste. So sehen Sie sofort, ob ein Shop dauerhaft günstig ist oder nur gerade eine Aktion hat."
        ),
        h3("Drei Muster, die Sie erkennen sollten"),
        ul([
          "Fallende Treppe: Der Preis sinkt Schritt für Schritt – Warten kann sich lohnen, ein Preisalarm ist sinnvoll.",
          "Tiefpunkt heute: Der Preis liegt am unteren Rand – zugreifen, besonders vor dem ersten Schnee.",
          "Steigende Linie im Oktober: typischer Saisoneffekt – nicht zu lange warten, sonst wird die Größe knapp.",
        ]),
      ],
      [
        h2("Preisalarm: Wir melden uns, wenn es günstiger wird"),
        p(
          "Sie möchten nicht jeden Tag nachsehen? Dann aktivieren Sie unter dem Button „Zum Angebot“ den Preisalarm. Sie erhalten eine Benachrichtigung im Browser, sobald sich beim Preis des Reifens etwas tut. Ein Kundenkonto brauchen Sie dafür nicht – nur Ihre Zustimmung zu Benachrichtigungen."
        ),
        ol([
          "Produktseite des gewünschten Winterreifens öffnen.",
          "Auf „Preisalarm“ tippen und Benachrichtigungen erlauben.",
          "Der Button zeigt jetzt „Preisalarm aktiv“ – fertig.",
        ]),
        p(
          "Ergänzend können Sie Reifen über das Herz-Symbol auf Ihre [Merkliste](/favoriten) setzen und mit „Vergleichen“ mehrere Modelle nebeneinander stellen."
        ),
      ],
      [
        h2("Der beste Zeitpunkt für den Winterreifen-Kauf"),
        p(
          "Eine Garantie gibt es nicht, aber eine bewährte Strategie: Ab September die Preise beobachten, den Preisalarm setzen und spätestens kaufen, wenn die erste Kälte angekündigt ist. Denn gesetzlich zählt das Wetter, nicht der Kalender – bei Glätte und Schnee sind Winterreifen Pflicht. Was genau gilt, lesen Sie im Ratgeber [Winterreifenpflicht 2026](/artikel/winterreifenpflicht-2026-alpine-symbol-bussgeld)."
        ),
        p(
          "Sie sind unsicher, ob es überhaupt ein Winterreifen sein muss? Für Wenigfahrer im Flachland kann ein Allwetterreifen reichen – die Vor- und Nachteile vergleicht unser Artikel [Ganzjahresreifen oder Winterreifen](/artikel/ganzjahresreifen-oder-winterreifen-2026)."
        ),
      ],
      [
        h2("Checkliste: So kaufen Sie Winterreifen zum besten Preis"),
        ol([
          "Reifengröße aus dem Fahrzeugschein oder vom alten Reifen ablesen, zum Beispiel 205/55 R16 91H.",
          "In der [Winterreifen-Übersicht](/winterreifen) nach Größe filtern.",
          "Modelle vergleichen – Testergebnisse, EU-Reifenlabel und Preis zusammen betrachten.",
          "Auf der Produktseite Bestpreis, Händler und Versand prüfen.",
          "Preisverlauf ansehen: Liegt der Preis am Tiefpunkt?",
          "Andere Last- und Geschwindigkeitsindizes prüfen – manchmal ist die Variante günstiger.",
          "Preisalarm setzen oder direkt kaufen.",
        ]),
        p(
          "Welcher Index für Ihr Auto passt und warum 91H, 91T oder 94V XL unterschiedlich viel kosten, erklären wir ausführlich im Ratgeber [Lastindex und Geschwindigkeitsindex bei Winterreifen](/artikel/" +
            SLUG_INDEX +
            ")."
        ),
      ],
      [
        h2("Häufige Fragen"),
        h3("Wie oft werden die Preise aktualisiert?"),
        p(
          "Die Händlerpreise werden mehrmals täglich abgeglichen. Verbindlich ist immer der Preis im Shop zum Zeitpunkt Ihrer Bestellung."
        ),
        h3("Warum sehe ich manchmal einen höheren Preis als in der Liste?"),
        p(
          "Preise können sich zwischen zwei Aktualisierungen ändern, oder ein Angebot ist inzwischen ausverkauft. Ausverkaufte Angebote zählen nicht für den Bestpreis."
        ),
        h3("Ist der günstigste Reifen auch der beste?"),
        p(
          "Nicht unbedingt. Vergleichen Sie Reifen derselben Klasse. Marken wie [Continental](/marken/continental) oder [Michelin](/marken/michelin) liegen in Tests meist vorn – und sind im Preisvergleich oft günstiger als gedacht. Der Preisvergleich hilft Ihnen, Ihren Wunschreifen beim günstigsten Händler zu kaufen."
        ),
        h3("Kostet der Preisvergleich etwas?"),
        p(
          "Nein. Der [Reifenpreisvergleich](/reifenpreisvergleich) auf Reifexa ist kostenlos. Sie kaufen direkt beim Händler."
        ),
      ],
    ],
  },

  // ------------------------------------------------------------------ 2
  {
    slug: SLUG_INDEX,
    coverImage: "/images/blogs/lastindex-geschwindigkeitsindex-winterreifen.webp",
    title: "Lastindex & Geschwindigkeitsindex: 91H, 91T oder 94V XL?",
    metaDescription:
      "91H, 91T oder 94V XL? Lastindex und Geschwindigkeitsindex bei Winterreifen einfach erklärt – mit Tabellen, Regeln für den Fahrzeugschein und Preisunterschieden.",
    tags: [
      "Lastindex",
      "Geschwindigkeitsindex",
      "Winterreifen",
      "XL-Reifen",
      "Reifengröße",
      "Ratgeber",
    ],
    contentBlocks: [
      [
        p(
          "Auf der Reifenflanke steht mehr als die Größe. Hinter „205/55 R16“ folgen meist eine Zahl und ein Buchstabe, zum Beispiel 91H. Diese Angabe entscheidet, ob ein Reifen für Ihr Auto zugelassen ist – und sie erklärt, warum derselbe Winterreifen in derselben Größe unterschiedlich viel kosten kann."
        ),
        p(
          "In diesem Ratgeber lernen Sie, den Reifencode zu lesen, den richtigen Last- und Geschwindigkeitsindex zu wählen und auf der Produktseite die günstigste passende Variante zu finden."
        ),
      ],
      [
        h2("Den Reifencode lesen: 205/55 R16 91H"),
        ul([
          "205 – Reifenbreite in Millimetern.",
          "55 – Querschnitt: Die Flankenhöhe beträgt 55 % der Breite.",
          "R – Radialbauweise, heute Standard bei Pkw-Reifen.",
          "16 – Felgendurchmesser in Zoll.",
          "91 – Lastindex: maximale Tragfähigkeit pro Reifen.",
          "H – Geschwindigkeitsindex: zulässige Höchstgeschwindigkeit.",
        ]),
        p(
          "Die Größe allein reicht also nicht. Zwei Reifen in [205/55 R16](/reifen/205-55-r16) können sich in Tragfähigkeit und Höchstgeschwindigkeit unterscheiden – und damit im Preis."
        ),
      ],
      [
        h2("Lastindex: wie viel ein Reifen tragen darf"),
        p(
          "Der Lastindex ist eine Kennzahl für die maximale Last pro Reifen bei korrektem Luftdruck. Für die häufigsten Pkw-Größen gelten diese Werte:"
        ),
        ul([
          "84 = 500 kg",
          "86 = 530 kg",
          "88 = 560 kg",
          "91 = 615 kg",
          "92 = 630 kg",
          "94 = 670 kg",
          "95 = 690 kg",
          "96 = 710 kg",
          "98 = 750 kg",
          "100 = 800 kg",
        ]),
        p(
          "Ein Reifen mit Lastindex 94 trägt also 55 kg mehr als einer mit 91 – pro Reifen. Bei vier Reifen sind das 220 kg mehr Reserve."
        ),
        h3("Was bedeutet XL?"),
        p(
          "XL steht für Extra Load (auch „Reinforced“). Diese Reifen sind verstärkt und haben in derselben Größe einen höheren Lastindex, zum Beispiel 94 statt 91. Sie sind sinnvoll für schwere Fahrzeuge, Kombis, Elektroautos mit hohem Akkugewicht oder wenn der Fahrzeugschein es verlangt. XL-Reifen benötigen oft einen etwas höheren Luftdruck – die Werte stehen in der Betriebsanleitung."
        ),
      ],
      [
        h2("Geschwindigkeitsindex: wie schnell Sie fahren dürfen"),
        p("Der Buchstabe nennt die zulässige Höchstgeschwindigkeit des Reifens:"),
        ul([
          "Q = 160 km/h",
          "R = 170 km/h",
          "S = 180 km/h",
          "T = 190 km/h",
          "H = 210 km/h",
          "V = 240 km/h",
          "W = 270 km/h",
          "Y = 300 km/h",
        ]),
      ],
      [
        h2("Welcher Index ist für mein Auto erlaubt?"),
        p(
          "Maßgeblich sind die Angaben in der Zulassungsbescheinigung Teil I (Fahrzeugschein) und im CoC-Dokument. Zwei Regeln sollten Sie kennen:"
        ),
        ol([
          "Lastindex: Er darf nie niedriger sein als im Fahrzeugschein angegeben. Ein höherer Lastindex, etwa ein XL-Reifen, ist erlaubt.",
          "Geschwindigkeitsindex: Grundsätzlich muss er zur Höchstgeschwindigkeit des Autos passen. Für Winterreifen gilt eine Ausnahme: Sie dürfen langsamer zugelassen sein, wenn im Sichtfeld des Fahrers ein Aufkleber mit der zulässigen Höchstgeschwindigkeit angebracht ist (§ 36 StVZO). Diese Geschwindigkeit dürfen Sie dann nicht überschreiten.",
        ]),
        p(
          "Genau deshalb finden Sie viele Winterreifen in Varianten mit T (190 km/h) und H (210 km/h). Wer ohnehin selten schneller als 190 km/h fährt, kann mit Aufkleber oft zur günstigeren T-Variante greifen. Im Zweifel fragen Sie Ihre Werkstatt."
        ),
      ],
      [
        h2("Gleiche Größe, anderer Index: so finden Sie die günstigste Variante"),
        p(
          "Auf jeder Produktseite von Reifexa steht direkt unter dem Produktnamen der Bereich „Andere Last-/Geschwindigkeitsindex“. Dort sehen Sie alle Varianten desselben Reifenmodells in derselben Größe – jeweils mit dem aktuellen Bestpreis. Die Variante, die Sie gerade ansehen, ist hervorgehoben."
        ),
        h3("Beispiel: ein Winterreifen in 205/55 R16"),
        ul([
          "91H – 615 kg, 210 km/h: 69,49 €",
          "91T – 615 kg, 190 km/h: 71,40 €",
          "94V XL – 670 kg, 240 km/h: 74,90 €",
        ]),
        p(
          "(Beispielpreise.) Das Beispiel zeigt: Der „kleinere“ Index ist nicht automatisch billiger. Je nach Händler und Lagerbestand kann die H-Variante günstiger sein als die T-Variante. Ein Blick auf die Index-Auswahl lohnt sich deshalb immer, bevor Sie kaufen."
        ),
        h3("Mehr Auswahl: gleiche Größe, gleiche Marke"),
        p(
          "Direkt darunter führt die Zeile „Mehr“ zu zwei Übersichten: alle Reifen in derselben Größe und alle Reifen derselben Marke. So springen Sie mit einem Tipp von einem Modell zu allen Winterreifen in 205/55 R16 oder zu allen Modellen von [Continental](/marken/continental), [Michelin](/marken/michelin), [Goodyear](/marken/goodyear), [Bridgestone](/marken/bridgestone), [Hankook](/marken/hankook) oder [Pirelli](/marken/pirelli)."
        ),
      ],
      [
        h2("Ähnliche Winterreifen vergleichen"),
        p(
          "Weiter unten auf der Produktseite zeigt der Bereich „Ähnliche Produkte“ Winterreifen anderer Hersteller in derselben Größe – mit Bestpreis, EU-Label-Werten, Mini-Preisverlauf und den drei günstigsten Händlern. Ideal, wenn Sie zwischen zwei, drei Modellen schwanken. Mit „Vergleichen“ stellen Sie die Kandidaten direkt nebeneinander."
        ),
        p(
          "Welche Modelle im Test überzeugen, lesen Sie im [ADAC Winterreifentest 2026](/artikel/adac-winterreifentest-2026-testsieger)."
        ),
      ],
      [
        h2("Alle Details: Produktinformation, Beschreibung und EU-Reifenlabel"),
        p(
          "Im Kasten „Produktinformation“ stehen alle technischen Daten auf einen Blick: Reifentyp, Marke, Größe, Lastindex, Geschwindigkeitsindex, Kraftstoffeffizienz, Nasshaftung, Rollgeräusch und die EAN. Die EAN ist praktisch, wenn Sie genau dieses Modell bei Ihrer Werkstatt bestellen möchten."
        ),
        h3("Das EU-Reifenlabel verstehen"),
        ul([
          "Kraftstoffeffizienz (A bis E): Wie stark der Rollwiderstand den Verbrauch beeinflusst.",
          "Nasshaftung (A bis E): Wie gut der Reifen auf nasser Fahrbahn bremst – im Winter besonders wichtig.",
          "Rollgeräusch in Dezibel und Klasse A bis C: Wie laut der Reifen von außen ist.",
          "Schnee- und Eis-Symbol: Das Alpine-Symbol zeigt geprüfte Wintertauglichkeit.",
        ]),
        p(
          "Ein Beispiel: Ein Reifen mit Kraftstoffeffizienz C, Nasshaftung B und 71 dB ist ein solider Allrounder. Achten Sie beim Winterreifen vor allem auf die Nasshaftung – nasse, kalte Straßen sind im deutschen Winter häufiger als Schnee. Nicht auf dem Label stehen allerdings Schnee- und Eisgrip; dafür lohnt der Blick in unabhängige Tests."
        ),
        p(
          "Pflicht ist im Winter das Alpine-Symbol – reine M+S-Reifen reichen seit Oktober 2024 nicht mehr. Alle Regeln finden Sie im Ratgeber [Winterreifenpflicht 2026](/artikel/winterreifenpflicht-2026-alpine-symbol-bussgeld)."
        ),
      ],
      [
        h2("Checkliste: den richtigen Winterreifen finden"),
        ol([
          "Größe, Lastindex und Geschwindigkeitsindex im Fahrzeugschein nachsehen.",
          "Lastindex mindestens wie im Fahrzeugschein wählen, XL bei schweren Autos.",
          "Geschwindigkeitsindex wählen – bei Winterreifen mit Aufkleber auch niedriger möglich.",
          "Auf der Produktseite die Index-Varianten und ihre Preise vergleichen.",
          "Ähnliche Produkte und EU-Label prüfen.",
          "Preisverlauf ansehen und den besten Händler wählen – wie das geht, zeigt unser Ratgeber [Winterreifen günstig kaufen](/artikel/" +
            SLUG_PREIS +
            ").",
        ]),
      ],
      [
        h2("Häufige Fragen"),
        h3("Darf ich einen höheren Lastindex fahren?"),
        p(
          "Ja. Ein höherer Lastindex als im Fahrzeugschein ist erlaubt, ein niedrigerer nicht."
        ),
        h3("Darf ich 91T statt 91H fahren?"),
        p(
          "Bei Winterreifen ja, wenn ein Aufkleber mit 190 km/h im Sichtfeld klebt und Sie diese Geschwindigkeit nicht überschreiten. Bei Sommerreifen muss der Geschwindigkeitsindex zur Höchstgeschwindigkeit des Autos passen."
        ),
        h3("Sind XL-Reifen besser?"),
        p(
          "Nicht automatisch. XL-Reifen tragen mehr, sind etwas steifer und oft teurer. Nötig sind sie, wenn der Fahrzeugschein den höheren Lastindex verlangt; sonst entscheidet Ihr Bedarf."
        ),
        h3("Wo finde ich alle Winterreifen in meiner Größe?"),
        p(
          "In der [Winterreifen-Übersicht](/winterreifen) filtern Sie nach Breite, Querschnitt und Zoll – oder Sie öffnen direkt eine Größenseite wie [205/55 R16](/reifen/205-55-r16), [195/65 R15](/reifen/195-65-r15) oder [225/45 R17](/reifen/225-45-r17). Was Reifen für Ihr Modell kosten, zeigt der [Reifen-Preisrechner](/artikel/reifenpreise-2026-preisrechner)."
        ),
      ],
    ],
  },
];

// "Weiterlesen" block added to the existing winter articles (internal links)
const EXISTING = [
  "winterreifenpflicht-2026-alpine-symbol-bussgeld",
  "adac-winterreifentest-2026-testsieger",
  "ganzjahresreifen-oder-winterreifen-2026",
  "reifenpreise-2026-preisrechner",
];
const readMore = [
  h2("Weiterlesen"),
  ul([
    `[Winterreifen günstig kaufen: Preisverlauf lesen und Preisalarm nutzen](/artikel/${SLUG_PREIS})`,
    `[Lastindex & Geschwindigkeitsindex: 91H, 91T oder 94V XL?](/artikel/${SLUG_INDEX})`,
    "[Alle Winterreifen im Preisvergleich](/winterreifen)",
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
  if (linkExisting) console.log(`\nWould add "Weiterlesen" to: ${EXISTING.join(", ")}`);
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
    const already = JSON.stringify(blog.contentBlocks || []).includes(SLUG_PREIS);
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
