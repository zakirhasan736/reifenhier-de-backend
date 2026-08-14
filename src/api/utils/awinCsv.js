import fs from 'fs'

/**
 * AWIN feeds may use comma or semicolon delimiters (see delimiter/ in feed URL).
 */
export function detectCsvSeparator(source) {
  const firstLine =
    typeof source === 'string' && !source.includes('\n')
      ? fs.readFileSync(source, 'utf8').split(/\r?\n/)[0] || ''
      : String(source).split(/\r?\n/)[0] || ''

  const semi = (firstLine.match(/;/g) || []).length
  const comma = (firstLine.match(/,/g) || []).length
  return semi > comma ? ';' : ','
}

export function parseAwinFeedMeta(feedUrl = '') {
  const cid = feedUrl.match(/\/cid\/(\d+)/)?.[1] || null
  const delimiterEnc = feedUrl.match(/\/delimiter\/([^/]+)/)?.[1] || null
  return { cid, delimiterEnc }
}

/** Infer separator from AWIN feed download URL (delimiter/%2C or delimiter/%3B). */
export function csvSeparatorFromFeedUrl(feedUrl = '') {
  const { delimiterEnc } = parseAwinFeedMeta(feedUrl)
  if (!delimiterEnc) return null
  const decoded = decodeURIComponent(delimiterEnc)
  if (decoded === ',') return ','
  if (decoded === ';') return ';'
  return null
}
