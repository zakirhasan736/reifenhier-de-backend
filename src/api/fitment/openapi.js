import { plans, termsVersion } from './data.js'

const server = () => `${process.env.PUBLIC_API_URL || 'https://api.reifexa.de'}/api/fitment/v1`
const err = (description) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } })
const q = (name, description, example, schema = { type: 'string' }) => ({ name, in: 'query', required: false, description, schema, example })

/** OpenAPI 3 description of the Reifexa Auto-API (public, served at /api/fitment/openapi.json). */
export function openApiSpec() {
  const planText = Object.entries(plans)
    .map(([id, p]) => `${p.name || id}: ${p.models ? `top ${p.models} models` : 'all models'}, ${p.daily} requests/day, ${p.ips} IP(s)${p.bySize ? ', size search' : ''}`)
    .join('; ')
  return {
    openapi: '3.0.3',
    info: {
      title: 'Reifexa Auto-API',
      version: '1.1.0',
      description:
        'Vehicle → tyre-size data for the German market: models with their generations, build years and factory tyre sizes per axle, ' +
        'and the reverse search "which models use 205/55 R16?". Every request needs a bearer key AND must come from a server IP address ' +
        `that Reifexa has approved for that key. Plans – ${planText}. ` +
        'Each vehicle has "verified": true when Reifexa has checked it; other records are AI-generated suggestions. Always check the ' +
        `vehicle papers (CoC) before fitting tyres. Terms version ${termsVersion}.`,
      contact: { name: 'Reifexa Auto-API', url: 'https://www.reifexa.de/auto-api' },
      termsOfService: 'https://www.reifexa.de/auto-api/bedingungen',
    },
    servers: [{ url: server() }],
    security: [{ BearerKey: [] }],
    paths: {
      '/vehicles': {
        get: {
          summary: 'Vehicles with tyre sizes (filter by make, model, year, size)',
          operationId: 'listVehicles',
          parameters: [
            q('make', 'Make, e.g. VW, BMW, Mercedes', 'VW'),
            q('model', 'Model family (requires make). "Golf 7" also finds Golf', 'Golf'),
            q('year', 'Build year – only generations built in that year', '2018'),
            q('size', 'Tyre size, e.g. 205/55 R16 (Pro and Advanced)', '205/55 R16'),
            q('offset', 'Skip this many vehicles', 0, { type: 'integer', default: 0 }),
            q('limit', '1–100', 25, { type: 'integer', default: 25, maximum: 100 }),
          ],
          responses: {
            200: {
              description: 'OK',
              headers: {
                'X-RateLimit-Limit': { schema: { type: 'integer' }, description: 'Requests per day of your plan' },
                'X-RateLimit-Remaining': { schema: { type: 'integer' }, description: 'Requests left today (resets 00:00 UTC)' },
              },
              content: { 'application/json': { schema: { $ref: '#/components/schemas/VehicleList' } } },
            },
            400: err('Invalid filter'),
            401: err('Missing or invalid key'),
            402: err('Subscription expired'),
            403: err('IP address not approved for this key, or size search not in your plan'),
            429: err('Daily limit reached'),
          },
        },
      },
      '/usage': {
        get: {
          summary: 'Your plan, requests today and approved IP addresses',
          operationId: 'usage',
          responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Usage' } } } }, 401: err('Invalid key'), 403: err('IP not approved') },
        },
      },
    },
    components: {
      securitySchemes: { BearerKey: { type: 'http', scheme: 'bearer', description: 'Authorization: Bearer rfx_…' } },
      schemas: {
        Fitment: {
          type: 'object',
          properties: {
            size: { type: 'string', example: '205/55 R16' },
            variant: { type: 'string', example: 'Golf 7 (5G)' },
            yearFrom: { type: 'integer', example: 2012 },
            yearTo: { type: 'integer', example: 2020 },
            axle: { type: 'string', enum: ['both', 'front', 'rear'], example: 'both' },
            loadIndex: { type: 'string', nullable: true, example: '91', description: 'Pro and Advanced' },
            speedIndex: { type: 'string', nullable: true, example: 'V', description: 'Pro and Advanced' },
            source: { type: 'string', example: 'Geprüft von Reifexa (2026-11-25)' },
          },
        },
        Vehicle: {
          type: 'object',
          properties: {
            make: { type: 'string', example: 'VW' },
            model: { type: 'string', example: 'Golf' },
            key: { type: 'string', example: 'vw:golf' },
            verified: { type: 'boolean', example: true },
            fitments: { type: 'array', items: { $ref: '#/components/schemas/Fitment' } },
          },
        },
        VehicleList: {
          type: 'object',
          properties: {
            vehicles: { type: 'array', items: { $ref: '#/components/schemas/Vehicle' } },
            total: { type: 'integer', example: 42 },
            offset: { type: 'integer', example: 0 },
            limit: { type: 'integer', example: 25 },
            plan: { type: 'string', example: 'pro' },
          },
        },
        Usage: {
          type: 'object',
          properties: {
            plan: { type: 'string' }, daily: { type: 'integer' }, usedToday: { type: 'integer' }, remainingToday: { type: 'integer' },
            models: { type: 'integer', nullable: true }, allowedIps: { type: 'array', items: { type: 'string' } },
            paidUntil: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        Error: { type: 'object', properties: { error: { type: 'string', example: 'ip_not_allowed' } } },
      },
    },
  }
}
