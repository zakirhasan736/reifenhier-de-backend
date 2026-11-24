import mongoose from 'mongoose'

const size = /^([1-3]\d{2})[ /-]([2-9]\d)[ -]*Z?R?([1-2]\d)$/i

export function normalizeSize(value) {
  const match = typeof value === 'string' && value.trim().match(size)
  return match ? `${match[1]}/${match[2]} R${match[3]}` : null
}

export function vehicleKey(make, model) {
  const normalize = value => String(value || '').trim().normalize('NFKD')
    .replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const brand = normalize(make)
  return `${({ volkswagen: 'vw', mercedesbenz: 'mercedes' })[brand] || brand}:${normalize(model)}`
}

const LOAD = /^\d{2,3}$/
const SPEED = /^[L-NP-WYZ]$/

export function validFitment(record) {
  return Boolean(record && normalizeSize(record.size) &&
    (record.loadIndex === undefined || record.loadIndex === '' || (LOAD.test(String(record.loadIndex)) && Number(record.loadIndex) >= 60 && Number(record.loadIndex) <= 130)) &&
    (record.speedIndex === undefined || record.speedIndex === '' || SPEED.test(String(record.speedIndex))) &&
    typeof record.variant === 'string' && record.variant.trim() && record.variant.length <= 160 &&
    Number.isInteger(record.yearFrom) && Number.isInteger(record.yearTo) &&
    record.yearFrom >= 1950 && record.yearTo <= new Date().getUTCFullYear() + 1 && record.yearFrom <= record.yearTo &&
    ['front', 'rear', 'both'].includes(record.axle) &&
    typeof record.source === 'string' && record.source.trim() && record.source.length <= 500)
}

export function normalizeFitment({ size, variant, yearFrom, yearTo, axle, source, loadIndex, speedIndex }) {
  return {
    size: normalizeSize(size), variant: variant.trim(), yearFrom, yearTo, axle, source: source.trim(),
    ...(loadIndex ? { loadIndex: String(loadIndex) } : {}),
    ...(speedIndex ? { speedIndex: String(speedIndex).toUpperCase() } : {}),
  }
}

/** Source text of AI-filled records (kept until an admin reviews the model). */
export const AI_SOURCE_PREFIX = 'KI-Vorschlag'

const fitmentSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  make: { type: String, required: true },
  model: { type: String, required: true },
  candidates: { type: [String], default: [] },
  fitments: [{
    _id: false,
    size: { type: String, required: true },
    variant: { type: String, required: true },
    yearFrom: { type: Number, required: true },
    yearTo: { type: Number, required: true },
    axle: { type: String, enum: ['front', 'rear', 'both'], required: true },
    source: { type: String, required: true },
    loadIndex: String,
    speedIndex: String,
  }],
  reviewed: { type: Boolean, default: false },
  // 1 = most common model on German roads (AI estimate × make weight). Plans
  // give access to the top N models, so the most useful cars come first.
  rank: { type: Number, index: true },
  popularity: { type: Number, default: 30 },
  // AI fill (scripts/fitment-ai-fill.mjs, Searchlight): none → filled | failed
  ai: {
    status: { type: String, enum: ['none', 'filled', 'failed'], default: 'none' },
    model: String,
    at: Date,
    attempts: { type: Number, default: 0 },
    error: String,
    origin: { type: String, enum: ['catalogue', 'ai-models', 'visitor'], default: 'catalogue' },
  },
}, { timestamps: true })
fitmentSchema.index({ reviewed: 1, 'fitments.size': 1 })
fitmentSchema.index({ 'fitments.size': 1, rank: 1 })
fitmentSchema.index({ 'ai.status': 1 })

export const Vehicle = mongoose.model('FitmentVehicle', fitmentSchema)

/**
 * Plans (net prices, EUR). models = number of model families (VW Golf, BMW 3er …)
 * with all their generations and tyre sizes, most common in Germany first;
 * null = all. Change prices and limits here only – pages read /api/fitment/plans.
 */
export const plans = {
  free: {
    name: 'Free', price: 0, priceYearly: 0, models: 50, ips: 1, daily: 100,
    bySize: false, indexes: false, commercial: false,
    features: ['Die 50 häufigsten Modelle in Deutschland', 'Alle Generationen mit Baujahren', 'Reifengrößen je Achse', '100 Anfragen pro Tag', '1 Server-IP', 'Zum Testen und für private Projekte'],
  },
  pro: {
    name: 'Pro', price: 29, priceYearly: 290, models: 500, ips: 2, daily: 2500,
    bySize: true, indexes: true, commercial: true,
    features: ['Die 500 häufigsten Modelle', 'Suche nach Reifengröße („Welche Autos fahren 205/55 R16?“)', 'Last- und Geschwindigkeitsindex', '2.500 Anfragen pro Tag', '2 Server-IPs', 'Kommerzielle Nutzung in eigenen Shops und Apps'],
  },
  advanced: {
    name: 'Advanced', price: 79, priceYearly: 790, models: null, ips: 5, daily: 10000,
    bySize: true, indexes: true, commercial: true,
    features: ['Alle Modelle der Datenbank, auch seltene', 'Suche nach Reifengröße', 'Last- und Geschwindigkeitsindex', 'Kennzeichnung geprüfter Datensätze', '10.000 Anfragen pro Tag', '5 Server-IPs', 'Priorisierter Support & Datenkorrekturen'],
  },
}

const accessSchema = new mongoose.Schema({
  email: { type: String, required: true },
  plan: { type: String, enum: Object.keys(plans), required: true },
  billing: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  company: String,
  name: String,
  street: String,
  zip: String,
  city: String,
  country: String,
  vatId: String,
  website: String,
  useCase: String,
  paidUntil: Date,
  adminNote: String,
  lastUsedAt: Date,
  requestedIps: [String],
  requestIp: String,
  termsVersion: String,
  status: { type: String, enum: ['pending', 'active', 'revoked'], default: 'pending' },
  keyHash: { type: String, unique: true, sparse: true, select: false },
  usageDate: String,
  requests: { type: Number, default: 0 },
}, { timestamps: true })

export const Access = mongoose.model('FitmentAccess', accessSchema)
export const termsVersion = '2026-11-25'
