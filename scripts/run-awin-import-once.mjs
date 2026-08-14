/**
 * One-shot AWIN import: download ZIP → extract CSV → import to MongoDB.
 * Use after clearing ImportMeta or when cron is not running.
 *
 * Usage: node scripts/run-awin-import-once.mjs [--force]
 */
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import ImportMeta from '../src/models/ImportMeta.js';
import {
  startCsvImportAsync,
  waitForImportToFinish,
} from '../src/api/product/importAWINCsv.js';
import { parseAwinFeedMeta } from '../src/api/utils/awinCsv.js';

dotenv.config();

const force = process.argv.includes('--force');
const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
const TEMP_DIR = path.join(os.tmpdir(), 'awin-csvs');

async function waitForImportMetaStart(timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const meta = await ImportMeta.findOne({ source: 'AWIN' }).lean();
    if (meta?.isRunning) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  if (!AWIN_CSV_URL) {
    console.error('❌ AWIN_CSV_URL is not set in .env');
    process.exit(1);
  }

  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  let meta = await ImportMeta.findOne({ source: 'AWIN' });
  if (meta?.isRunning) {
    if (force) {
      console.warn('[AWIN] Resetting stuck isRunning=true (--force)');
      await ImportMeta.updateOne({ source: 'AWIN' }, { $set: { isRunning: false } });
    } else {
      console.error('❌ Import already marked as running. Use --force to reset.');
      process.exit(1);
    }
  }

  const feedMeta = parseAwinFeedMeta(AWIN_CSV_URL);
  console.log(`[AWIN] Campaign cid=${feedMeta.cid || 'n/a'}`);
  console.log('[STEP 1] Downloading feed…');

  const res = await fetch(AWIN_CSV_URL);
  if (!res.ok) {
    console.error('❌ Download failed:', res.status, res.statusText);
    process.exit(1);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`[STEP 1] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

  const zip = new AdmZip(buffer);
  const csvEntry = zip.getEntries().find((e) => e.entryName.endsWith('.csv'));
  if (!csvEntry) {
    console.error('❌ No CSV file inside ZIP');
    process.exit(1);
  }

  const tmpPath = path.join(TEMP_DIR, `awin-manual-${Date.now()}.csv`);
  fs.writeFileSync(tmpPath, zip.readFile(csvEntry));
  const lineCount = fs.readFileSync(tmpPath, 'utf8').split(/\r?\n/).length - 1;
  console.log(`[STEP 2] Extracted CSV → ${tmpPath} (~${lineCount} rows)`);

  console.log('[STEP 3] Starting MongoDB import…');
  startCsvImportAsync(tmpPath);

  const started = await waitForImportMetaStart();
  if (!started) {
    console.error('❌ Import did not start (isRunning never became true).');
    process.exit(1);
  }

  console.log('[STEP 3] Import running — this can take 15–45 min for large feeds…');
  const waitStart = Date.now();
  await waitForImportToFinish();
  const mins = ((Date.now() - waitStart) / 60000).toFixed(1);
  console.log(`[STEP 3] Import process finished (${mins} min).`);

  meta = await ImportMeta.findOne({ source: 'AWIN' }).lean();

  const imported = meta?.imported ?? 0;
  const updated = meta?.updated ?? 0;
  const total = meta?.total ?? 0;
  const deleted = meta?.deleted ?? 0;

  console.log(`
📊 AWIN IMPORT SUMMARY
────────────────────────────
🆕 Imported:   ${imported}
🔁 Updated:    ${updated}
🚫 Deleted:    ${deleted}
📦 Total rows: ${total}
🕒 Finished:   ${meta?.lastSuccess ? new Date(meta.lastSuccess).toLocaleString() : 'n/a'}
────────────────────────────
`);

  if (!meta?.lastSuccess) {
    console.warn('⚠️  Import finished but lastSuccess not set — check logs for errors.');
  } else {
    console.log('✅ Import completed successfully.');
  }

  setTimeout(() => {
    try {
      fs.unlinkSync(tmpPath);
      console.log('[CLEANUP] Temp CSV deleted.');
    } catch {
      // ignore
    }
    mongoose.disconnect().finally(() => process.exit(meta?.lastSuccess ? 0 : 1));
  }, 3000);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
