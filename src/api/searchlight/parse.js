/**
 * Fast, deterministic reading of a visitor's sentence (no AI needed):
 * "Winterreifen für Golf 7 bis 400 €", "205 55 16 leise", "Continental 225/45R17 94W XL".
 * The AI is only asked when this finds neither a size nor a car.
 */

const CAR_MAKES = [
  ['VW', ['vw', 'volkswagen']], ['Mercedes', ['mercedes-benz', 'mercedes', 'benz']], ['BMW', ['bmw']], ['Audi', ['audi']],
  ['Opel', ['opel']], ['Ford', ['ford']], ['Skoda', ['skoda', 'škoda']], ['Seat', ['seat']], ['Cupra', ['cupra']],
  ['Renault', ['renault']], ['Toyota', ['toyota']], ['Hyundai', ['hyundai']], ['Kia', ['kia']], ['Fiat', ['fiat']],
  ['Peugeot', ['peugeot']], ['Citroen', ['citroen', 'citroën']], ['Dacia', ['dacia']], ['Mazda', ['mazda']],
  ['Nissan', ['nissan']], ['Volvo', ['volvo']], ['Mini', ['mini']], ['Tesla', ['tesla']], ['Suzuki', ['suzuki']],
  ['Porsche', ['porsche']], ['Honda', ['honda']], ['Mitsubishi', ['mitsubishi']], ['Smart', ['smart']], ['MG', ['mg']],
  ['Jeep', ['jeep']], ['Land Rover', ['land rover', 'landrover', 'range rover']], ['Alfa Romeo', ['alfa romeo', 'alfa']],
  ['Lexus', ['lexus']], ['Jaguar', ['jaguar']], ['Subaru', ['subaru']], ['BYD', ['byd']], ['Polestar', ['polestar']],
  ['DS', ['ds']], ['Chevrolet', ['chevrolet']], ['Lancia', ['lancia']], ['Saab', ['saab']], ['Abarth', ['abarth']],
]

const TYRE_BRANDS = [
  'Michelin', 'Continental', 'Bridgestone', 'Goodyear', 'Pirelli', 'Dunlop', 'Hankook', 'Nokian', 'Vredestein',
  'Falken', 'Toyo', 'Yokohama', 'Kumho', 'BFGoodrich', 'Uniroyal', 'Semperit', 'Barum', 'Fulda', 'Firestone',
  'Kleber', 'Cooper', 'Nexen', 'General', 'Maxxis', 'Sava', 'Debica', 'Matador', 'Giti', 'Laufenn', 'Avon',
  'Apollo', 'Kormoran', 'Riken', 'Tigar', 'Nankang', 'Imperial', 'Tristar', 'Triangle', 'Linglong', 'Sailun',
]

const STOP = new Set([
  'für', 'fuer', 'mein', 'meinen', 'meine', 'meinem', 'ein', 'einen', 'eine', 'den', 'die', 'das', 'der', 'und', 'oder',
  'mit', 'bis', 'unter', 'max', 'maximal', 'reifen', 'winterreifen', 'sommerreifen', 'ganzjahresreifen', 'allwetterreifen',
  'günstig', 'guenstig', 'billig', 'leise', 'sicher', 'suche', 'brauche', 'baujahr', 'bj', 'von', 'auf', 'neue', 'neu',
  'euro', 'eur', 'pro', 'stück', 'stueck', 'satz', 'ich', 'habe', 'fahre', 'beste', 'besten', 'gute', 'guten', 'zoll',
])

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Size: 205/55 R16 · 205/55R16 · 205 55 16 · 205-55-16 · 2055516 · 225/45 ZR17 94W */
export function parseSize(text) {
  const t = String(text || '')
  const m =
    /\b(1[2-9]5|2[0-9]5|3[0-3]5)\s*[/\-\s]\s*([2-8][05])\s*(?:[/\-\s]|\s*Z?R\s*|\s*-?\s*)\s*(1[2-9]|2[0-3])\b(?:\s*(\d{2,3})\s*([A-Z]{1,2})\b)?/i.exec(t) ||
    /\b(1[2-9]5|2[0-9]5|3[0-3]5)([2-8][05])(1[2-9]|2[0-3])\b/.exec(t)
  if (!m) return null
  return {
    width: m[1],
    height: m[2],
    diameter: m[3],
    minLoadIndex: m[4] && Number(m[4]) >= 60 && Number(m[4]) <= 130 ? Number(m[4]) : 0,
    minSpeed: m[5] && /^[L-Y]$|^ZR$/i.test(m[5]) ? m[5].toUpperCase() : '',
  }
}

export function parseSeason(text) {
  const t = norm(text)
  if (/ganzjahr|allwetter|all.?season|4.?jahreszeit|vierjahreszeit/.test(t)) return 'ganzjahr'
  if (/winter|schnee|m\+s|3pmsf|eis\b|glätte|glaette/.test(t)) return 'winter'
  if (/sommer|summer/.test(t)) return 'sommer'
  return null
}

/** "bis 400 €" → 400 for four tyres; "unter 90 € pro Reifen" → 360. */
export function parseBudget(text) {
  const t = norm(text)
  const m = /(?:bis|unter|max(?:imal)?|höchstens|hoechstens|budget|<)\s*(?:zu\s*)?(\d{2,4})(?:[.,]\d{1,2})?\s*(?:€|euro|eur)?/.exec(t) ||
    /(\d{2,4})(?:[.,]\d{1,2})?\s*(?:€|euro|eur)(?=$|[\s.,!?)])/.exec(t)
  if (!m) return 0
  const n = Number(m[1])
  if (!(n >= 20 && n <= 4000)) return 0
  const perTyre = /pro\s*(reifen|stück|stueck|stk)|je\s*reifen|das\s*stück|\/\s*stück/.test(t)
  const perSet = /für\s*(alle\s*)?(4|vier)|satz|komplett|zusammen|insgesamt/.test(t)
  if (perTyre) return n * 4
  if (perSet) return n
  return n <= 160 ? n * 4 : n
}

export function parsePriority(text) {
  const t = norm(text)
  if (/sicher|sicherheit|nass|regen|bremsweg|familie|kinder|aquaplaning|beste\s*qualität|premium|testsieger/.test(t)) return 'safety'
  if (/leise|ruhig|geräusch|geraeusch|sparsam|verbrauch|reichweite|e-?auto|elektro|\bev\b|hybrid/.test(t)) return 'quiet'
  if (/günstig|guenstig|billig|preiswert|sparen|budget|wenig geld|kostengünstig/.test(t)) return 'cheap'
  if (/preis.?leistung|ausgewogen|allround/.test(t)) return 'balanced'
  return null
}

export function parseBrand(text) {
  const t = norm(text)
  return TYRE_BRANDS.find(b => new RegExp(`\\b${b.toLowerCase()}\\b`).test(t)) || ''
}

export function parseExtras(text) {
  const t = norm(text)
  return {
    runflat: /run.?flat|\brft\b|\brsc\b|\bssr\b|\brof\b|notlauf/.test(t),
    xl: /\bxl\b|verstärkt|verstaerkt|reinforced/.test(t),
  }
}

/** "Golf 7 Variant 2018" → { make:'VW', model:'Golf 7 Variant', year:'2018' } */
export function parseCar(text) {
  const raw = String(text || '')
  const t = norm(raw)
  for (const [make, aliases] of CAR_MAKES) {
    for (const a of aliases) {
      const re = new RegExp(`(^|[^a-zäöüß])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-zäöüß])`)
      const m = re.exec(t)
      if (!m) continue
      const after = t.slice(m.index + m[0].length).replace(/[,.;!?]/g, ' ').split(' ').filter(Boolean)
      const words = []
      for (const w of after) {
        if (/^(19|20)\d{2}$/.test(w)) break
        if (STOP.has(w) || /€|euro/.test(w)) break
        if (/^\d{3}\/\d{2}/.test(w)) break
        words.push(w)
        if (words.length >= 3) break
      }
      const year = (/\b(19[89]\d|20[0-3]\d)\b/.exec(t) || [])[1] || ''
      const model = words.map(w => (/^[a-z]{1,3}-?\d+[a-z]?$/.test(w) ? w.toUpperCase() : /^\d/.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join(' ')
      return model ? { make, model, year } : { make, model: '', year }
    }
  }
  return null
}

/** Everything we can read without AI. Empty fields are left out. */
export function parseQuery(text) {
  const out = {}
  const size = parseSize(text)
  if (size) Object.assign(out, size)
  const season = parseSeason(text)
  if (season) out.season = season
  const budget = parseBudget(text)
  if (budget) out.budgetPer4 = budget
  const priority = parsePriority(text)
  if (priority) out.priority = priority
  const brand = parseBrand(text)
  if (brand) out.brand = brand
  const extras = parseExtras(text)
  if (extras.runflat) out.runflat = true
  if (extras.xl) out.xl = true
  if (!size) {
    const car = parseCar(text)
    if (car) out.car = car
  }
  return out
}

/** Season people buy for right now in Germany (Sep–Feb winter, else summer). */
export function seasonForDate(d = new Date()) {
  const m = d.getMonth() + 1
  return m >= 9 || m <= 2 ? 'winter' : 'sommer'
}
