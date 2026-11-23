import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const savedFile = path.join(backendRoot, 'secrets', 'ga4.json')

export const GA4_MEASUREMENT_ID = 'G-PMPVT55453'

export function serviceAccountFile() {
  const configured = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '').trim()
  if (!configured) return ''
  const file = path.isAbsolute(configured) ? configured : path.resolve(backendRoot, configured)
  return fs.existsSync(file) ? file : ''
}

export function serviceAccountEmail() {
  const file = serviceAccountFile()
  if (!file) return ''
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'))
    return String(json.client_email || '')
  } catch {
    return ''
  }
}

export function propertyId() {
  const fromEnv = String(process.env.GA4_PROPERTY_ID || '').trim()
  if (/^\d+$/.test(fromEnv)) return fromEnv
  try {
    const saved = JSON.parse(fs.readFileSync(savedFile, 'utf8'))
    const id = String(saved.propertyId || '').trim()
    return /^\d+$/.test(id) ? id : ''
  } catch {
    return ''
  }
}

export function savePropertyId(value) {
  const id = String(value || '').trim()
  if (!/^\d+$/.test(id)) return ''
  fs.mkdirSync(path.dirname(savedFile), { recursive: true })
  fs.writeFileSync(savedFile, JSON.stringify({ propertyId: id }))
  process.env.GA4_PROPERTY_ID = id
  return id
}

export function analyticsStatus() {
  const email = serviceAccountEmail()
  const id = propertyId()
  return {
    measurementId: GA4_MEASUREMENT_ID,
    propertyId: id,
    serviceAccountEmail: email,
    serviceAccountReady: Boolean(email),
    connected: Boolean(id && email),
    urls: {
      analytics: 'https://analytics.google.com/analytics/web/',
      propertySettings: 'https://analytics.google.com/analytics/web/#/a0p0/admin/property/settings',
      propertyAccess: 'https://analytics.google.com/analytics/web/#/a0p0/admin/property/access-management',
      dataApi: 'https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=233189692291',
    },
  }
}
