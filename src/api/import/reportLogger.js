// File: src/api/import/reportLogger.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, '../../../logs');
const logFile = path.join(logsDir, 'import-reports.json');

export function saveImportReport(report) {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    let existingReports = [];
    if (fs.existsSync(logFile)) {
        const raw = fs.readFileSync(logFile, 'utf-8');
        try {
            existingReports = JSON.parse(raw);
        } catch {
            existingReports = [];
        }
    }
    existingReports.push(report);
    fs.writeFileSync(logFile, JSON.stringify(existingReports.slice(-20), null, 2)); // keep only last 20
}

export function getImportReports() {
    if (!fs.existsSync(logFile)) return [];
    try {
        return JSON.parse(fs.readFileSync(logFile, 'utf-8'));
    } catch {
        return [];
    }
}
