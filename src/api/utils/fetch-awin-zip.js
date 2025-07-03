// src/api/utils/fetch-and-import-awin.js
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { startCsvImportAsync } from '../product/importAWINCsv.js';
import dotenv from 'dotenv';

dotenv.config();

export async function fetchAndImportAWINZip() {
    try {
        const url = process.env.AWIN_CSV_URL;
        if (!url) throw new Error('Missing AWIN_CSV_URL in .env');

        console.log('[AWIN] Downloading ZIP...');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ZIP: ${res.statusText}`);

        const buffer = await res.buffer();
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();

        const csvEntry = entries.find(e => e.entryName.endsWith('.csv'));
        if (!csvEntry) throw new Error('No CSV file found in ZIP');

        const tmpCsvPath = path.join(os.tmpdir(), `awin-${Date.now()}.csv`);
        fs.writeFileSync(tmpCsvPath, zip.readFile(csvEntry));

        console.log(`[AWIN] CSV extracted to ${tmpCsvPath}`);
        startCsvImportAsync(tmpCsvPath);
    } catch (err) {
        console.error('[AWIN] Error fetching/importing ZIP:', err.message);
    }
}
