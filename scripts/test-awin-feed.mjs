import dotenv from 'dotenv';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import {
  appendAwinClickRef,
  buildAwinClickRef,
  extractAwinAffiliateId,
} from '../src/api/utils/awinTracking.js';
import { detectCsvSeparator, parseAwinFeedMeta } from '../src/api/utils/awinCsv.js';

dotenv.config();

const url = process.env.AWIN_CSV_URL;
if (!url) {
  console.error('AWIN_CSV_URL not set');
  process.exit(1);
}

const meta = parseAwinFeedMeta(url);
console.log('Campaign ID (cid):', meta.cid || 'not in URL');
console.log('Delimiter:', decodeURIComponent(meta.delimiterEnc || 'unknown'));
console.log('Env AWIN_CAMPAIGN_ID:', process.env.AWIN_CAMPAIGN_ID || 'not set');
console.log('Env AWIN_AFFILIATE_ID:', process.env.AWIN_AFFILIATE_ID || 'not set');
console.log('Env AWIN_PUBLISHER_ID:', process.env.AWIN_PUBLISHER_ID || 'not set');

const res = await fetch(url);
console.log('Download:', res.status, res.statusText);
if (!res.ok) process.exit(1);

const buf = Buffer.from(await res.arrayBuffer());
const zip = new AdmZip(buf);
const entry = zip.getEntries().find((e) => e.entryName.endsWith('.csv'));
const csvText = zip.readAsText(entry, 'utf8');
const sep = detectCsvSeparator(csvText);
console.log('Detected CSV separator:', JSON.stringify(sep));

const header = csvText.split(/\r?\n/)[0];
const cols = header.split(sep);
const awIdx = cols.indexOf('aw_deep_link');
const sampleLine = csvText.split(/\r?\n/)[1];
const sampleLink = sampleLine.split(sep)[awIdx] || '';
const affId = extractAwinAffiliateId(sampleLink);

console.log('\nSample aw_deep_link:', sampleLink.slice(0, 120) + '...');
console.log('Affiliate id in link (a=):', affId);

const clickRef = buildAwinClickRef({ productId: 'test-ean', from: 'feed-check' });
console.log('Example clickref:', clickRef);
console.log('Redirect URL with clickref:', appendAwinClickRef(sampleLink, clickRef).slice(0, 160) + '...');

if (process.env.AWIN_AFFILIATE_ID && affId !== process.env.AWIN_AFFILIATE_ID) {
  console.warn('\n⚠️  Feed affiliate id does not match AWIN_AFFILIATE_ID in .env');
}

if (process.env.AWIN_CAMPAIGN_ID && meta.cid !== process.env.AWIN_CAMPAIGN_ID) {
  console.warn('\n⚠️  Feed URL cid does not match AWIN_CAMPAIGN_ID in .env');
}

console.log('\n✅ Feed OK — ready for import with comma delimiter.');
