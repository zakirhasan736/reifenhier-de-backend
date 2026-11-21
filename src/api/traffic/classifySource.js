/**
 * Where did a visitor come from? Classifies referrer + UTM into
 *   channel: ai | search | social | email | paid | referral | direct
 *   source:  ChatGPT, Perplexity, Claude, Gemini, Copilot, Grok, Google, Bing, …
 * ChatGPT adds utm_source=chatgpt.com to links it shows; most AI assistants send
 * their domain as referrer.
 */
const AI = [
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/, 'ChatGPT'],
  [/(^|\.)perplexity\.ai$/, 'Perplexity'],
  [/(^|\.)claude\.ai$/, 'Claude'],
  [/(^|\.)(gemini\.google\.com|bard\.google\.com)$/, 'Gemini'],
  [/(^|\.)copilot\.microsoft\.com$|(^|\.)copilot\.cloud\.microsoft$/, 'Copilot'],
  [/(^|\.)(grok\.com|x\.ai)$/, 'Grok'],
  [/(^|\.)deepseek\.com$/, 'DeepSeek'],
  [/(^|\.)mistral\.ai$/, 'Mistral Le Chat'],
  [/(^|\.)meta\.ai$/, 'Meta AI'],
  [/(^|\.)you\.com$/, 'You.com'],
  [/(^|\.)phind\.com$/, 'Phind'],
  [/(^|\.)poe\.com$/, 'Poe'],
]
const SEARCH = [
  [/(^|\.)google\.[a-z.]+$/, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)ecosia\.org$/, 'Ecosia'],
  [/(^|\.)yahoo\.[a-z.]+$/, 'Yahoo'],
  [/(^|\.)search\.brave\.com$/, 'Brave Search'],
  [/(^|\.)qwant\.com$/, 'Qwant'],
  [/(^|\.)startpage\.com$/, 'Startpage'],
  [/(^|\.)yandex\.[a-z.]+$/, 'Yandex'],
  [/(^|\.)baidu\.com$/, 'Baidu'],
  [/(^|\.)(suche\.web\.de|search\.web\.de|suche\.gmx\.net|search\.gmx\.net)$/, 'WEB.DE/GMX Suche'],
  [/(^|\.)t-online\.de$/, 't-online Suche'],
  [/(^|\.)kagi\.com$/, 'Kagi'],
]
const SOCIAL = [
  [/(^|\.)(facebook\.com|fb\.com|l\.facebook\.com|m\.facebook\.com)$/, 'Facebook'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X (Twitter)'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)pinterest\.[a-z.]+$/, 'Pinterest'],
  [/(^|\.)reddit\.com$/, 'Reddit'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
  [/(^|\.)motor-talk\.de$/, 'motor-talk'],
]
/** utm_source values → same names */
const UTM = [
  [/chatgpt|openai/, 'ChatGPT', 'ai'],
  [/perplexity/, 'Perplexity', 'ai'],
  [/claude|anthropic/, 'Claude', 'ai'],
  [/gemini|bard/, 'Gemini', 'ai'],
  [/copilot/, 'Copilot', 'ai'],
  [/grok/, 'Grok', 'ai'],
  [/deepseek/, 'DeepSeek', 'ai'],
  [/^google$/, 'Google', 'search'],
  [/^bing$/, 'Bing', 'search'],
  [/facebook|^fb$/, 'Facebook', 'social'],
  [/instagram|^ig$/, 'Instagram', 'social'],
  [/youtube/, 'YouTube', 'social'],
  [/tiktok/, 'TikTok', 'social'],
  [/newsletter|mail/, 'Newsletter', 'email'],
]

const match = (list, host) => list.find(([re]) => re.test(host))?.[1]

export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function classifySource({ referrer = '', utmSource = '', utmMedium = '', ownHost = 'reifexa.de' } = {}) {
  const host = hostOf(referrer)
  const us = String(utmSource || '').toLowerCase().trim()
  const um = String(utmMedium || '').toLowerCase().trim()

  if (/^(cpc|ppc|paid|paidsearch|display|ads?)$/.test(um)) {
    return { channel: 'paid', source: us ? us.replace(/\.(com|de)$/, '') : host || 'Paid', referrerHost: host }
  }
  if (us) {
    const u = UTM.find(([re]) => re.test(us))
    if (u) return { channel: u[2], source: u[1], referrerHost: host }
  }
  if (host && (host === ownHost || host.endsWith(`.${ownHost}`))) {
    return { channel: 'internal', source: 'Reifexa', referrerHost: host }
  }
  if (host) {
    const ai = match(AI, host)
    if (ai) return { channel: 'ai', source: ai, referrerHost: host }
    const se = match(SEARCH, host)
    if (se) return { channel: 'search', source: se, referrerHost: host }
    const so = match(SOCIAL, host)
    if (so) return { channel: 'social', source: so, referrerHost: host }
    if (/(^|\.)(mail\.|webmail|outlook\.|gmx\.|web\.de$)/.test(host)) return { channel: 'email', source: 'E-Mail', referrerHost: host }
    return { channel: 'referral', source: host, referrerHost: host }
  }
  if (us) return { channel: um === 'email' ? 'email' : 'referral', source: us, referrerHost: '' }
  return { channel: 'direct', source: 'Direkt / unbekannt', referrerHost: '' }
}
