/**
 * Minimal LLM client for Searchlight (no SDK dependency).
 * Provider: SEARCHLIGHT_PROVIDER=anthropic|openai (default: anthropic when
 * ANTHROPIC_API_KEY is set, else openai). Models are configurable:
 *   SEARCHLIGHT_MODEL (text), SEARCHLIGHT_VISION_MODEL (photos).
 * The AI only understands the visitor and writes short explanations – it never
 * chooses products or prices (that is scoring.js on our own data).
 */
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

export function provider() {
  const p = (process.env.SEARCHLIGHT_PROVIDER || '').toLowerCase()
  if (p === 'anthropic' || p === 'openai') return p
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return null
}

export function llmAvailable() {
  const p = provider()
  return p === 'anthropic' ? Boolean(process.env.ANTHROPIC_API_KEY) : p === 'openai' ? Boolean(process.env.OPENAI_API_KEY) : false
}

function model(kind) {
  const p = provider()
  if (kind === 'vision' && process.env.SEARCHLIGHT_VISION_MODEL) return process.env.SEARCHLIGHT_VISION_MODEL
  if (process.env.SEARCHLIGHT_MODEL) return process.env.SEARCHLIGHT_MODEL
  return p === 'anthropic' ? 'claude-haiku-5-5' : 'gpt-4.1-mini'
}

/** Extract the first JSON object/array from a model reply. */
export function parseJson(text) {
  const s = String(text || '')
  const start = s.search(/[[{]/)
  if (start < 0) return null
  for (let end = s.length; end > start; end--) {
    const ch = s[end - 1]
    if (ch !== '}' && ch !== ']') continue
    try {
      return JSON.parse(s.slice(start, end))
    } catch {
      /* keep shrinking */
    }
  }
  return null
}

/**
 * Ask for JSON. `image` = { mediaType, base64 } (optional).
 * Returns the parsed object or null (never throws on model errors).
 */
export async function llmJson({ system, prompt, image, maxTokens = 600, kind = 'text', timeoutMs = 20000 }) {
  const p = provider()
  if (!llmAvailable()) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    let text = ''
    if (p === 'anthropic') {
      const content = []
      if (image) content.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } })
      content.push({ type: 'text', text: prompt })
      const r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: model(kind), max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
      })
      if (!r.ok) {
        console.error('[searchlight] anthropic', r.status, (await r.text()).slice(0, 300))
        return null
      }
      const j = await r.json()
      text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n')
    } else {
      const content = [{ type: 'text', text: prompt }]
      if (image) content.push({ type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.base64}` } })
      const r = await fetch(OPENAI_URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: model(kind),
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content },
          ],
        }),
      })
      if (!r.ok) {
        console.error('[searchlight] openai', r.status, (await r.text()).slice(0, 300))
        return null
      }
      const j = await r.json()
      text = j.choices?.[0]?.message?.content || ''
    }
    return parseJson(text)
  } catch (err) {
    console.error('[searchlight] llm failed:', err?.name === 'AbortError' ? 'timeout' : err?.message || err)
    return null
  } finally {
    clearTimeout(timer)
  }
}
