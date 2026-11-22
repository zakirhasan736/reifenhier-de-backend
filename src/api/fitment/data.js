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

export function validFitment(record) {
  return Boolean(record && normalizeSize(record.size) &&
    typeof record.variant === 'string' && record.variant.trim() && record.variant.length <= 160 &&
    Number.isInteger(record.yearFrom) && Number.isInteger(record.yearTo) &&
    record.yearFrom >= 1950 && record.yearTo <= new Date().getUTCFullYear() + 1 && record.yearFrom <= record.yearTo &&
    ['front', 'rear', 'both'].includes(record.axle) &&
    typeof record.source === 'string' && record.source.trim() && record.source.length <= 500)
}

export function normalizeFitment({ size, variant, yearFrom, yearTo, axle, source }) {
  return { size: normalizeSize(size), variant: variant.trim(), yearFrom, yearTo, axle, source: source.trim() }
}

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
  }],
  reviewed: { type: Boolean, default: false },
}, { timestamps: true })
fitmentSchema.index({ reviewed: 1, 'fitments.size': 1 })

export const Vehicle = mongoose.model('FitmentVehicle', fitmentSchema)

export const plans = {
  free: { price: 0, models: 25, ips: 1, daily: 100 },
  pro: { price: 29, models: 150, ips: 2, daily: 2500 },
  advanced: { price: 79, models: 300, ips: 5, daily: 10000 },
}

const accessSchema = new mongoose.Schema({
  email: { type: String, required: true },
  plan: { type: String, enum: Object.keys(plans), required: true },
  requestedIps: [String],
  termsVersion: String,
  status: { type: String, enum: ['pending', 'active', 'revoked'], default: 'pending' },
  keyHash: { type: String, unique: true, sparse: true, select: false },
  usageDate: String,
  requests: { type: Number, default: 0 },
}, { timestamps: true })

export const Access = mongoose.model('FitmentAccess', accessSchema)
export const termsVersion = '2026-11-22'
