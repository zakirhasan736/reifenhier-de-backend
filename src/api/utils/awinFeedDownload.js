/**
 * Batch-wise AWIN feed download — one shop (feed id) at a time.
 *
 *  1. Read the feed list (productdata.awin.com/datafeed/list/apikey/<key>):
 *     every advertiser feed with "Feed ID", "Last Imported", "No of products".
 *  2. For each feed in AWIN_CSV_URL (/fid/…) — or every active feed when the
 *     URL has no /fid/ — download that shop's CSV alone, with retries. The
 *     URL keeps your cid/columns/format settings; only /fid/ changes.
 *  3. Shops whose "Last Imported" did not change since the last run are not
 *     downloaded again: their CSV is reused from the on-disk cache.
 *  4. All shop CSVs are combined into one file for the import (offers are
 *     grouped by EAN across shops, so the import needs all of them).
 *
 * Any problem with the feed list → falls back to the single full download.
 */
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import AdmZip from "adm-zip";

const CACHE_DIR = process.env.AWIN_FEED_CACHE_DIR || path.join(os.tmpdir(), "awin-feed-cache");
const DOWNLOAD_TIMEOUT_MS = Number(process.env.AWIN_DOWNLOAD_TIMEOUT_MS || 10 * 60 * 1000);
const RETRIES = Number(process.env.AWIN_DOWNLOAD_RETRIES || 3);
const PAUSE_MS = Number(process.env.AWIN_FEED_PAUSE_MS || 1500); // be gentle with AWIN between shops

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** /datafeed/download/apikey/K/language/de/cid/566/fid/1,2/… → { prefix, params: Map } */
export function parseFeedUrl(url) {
    const u = new URL(url);
    const marker = "/datafeed/download/";
    const i = u.pathname.indexOf(marker);
    if (i < 0) return null;
    const segs = u.pathname.slice(i + marker.length).split("/").filter(Boolean);
    const params = new Map();
    for (let k = 0; k + 1 < segs.length; k += 2) params.set(segs[k], segs[k + 1]);
    return { origin: u.origin, base: u.pathname.slice(0, i + marker.length), params, search: u.search };
}

export function buildFeedUrl(parsed, overrides = {}) {
    const params = new Map(parsed.params);
    for (const [k, v] of Object.entries(overrides)) params.set(k, v);
    const segs = [...params.entries()].flatMap(([k, v]) => [k, v]);
    return `${parsed.origin}${parsed.base}${segs.join("/")}/${parsed.search || ""}`;
}

/** Minimal CSV line parser for the feed list (quoted fields, commas). */
function parseCsvLine(line) {
    const out = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') q = false;
            else cur += c;
        } else if (c === '"') q = true;
        else if (c === ",") { out.push(cur); cur = ""; }
        else cur += c;
    }
    out.push(cur);
    return out;
}

export function parseFeedList(text) {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const head = parseCsvLine(lines[0]).map((h) => h.trim());
    return lines.slice(1).map((l) => {
        const v = parseCsvLine(l);
        return Object.fromEntries(head.map((h, i) => [h, (v[i] ?? "").trim()]));
    });
}

async function fetchBuffer(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return Buffer.from(await res.arrayBuffer());
    } finally {
        clearTimeout(t);
    }
}

async function fetchWithRetry(url, label, log) {
    let lastErr;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
        try {
            return await fetchBuffer(url);
        } catch (e) {
            lastErr = e;
            log?.(`  ${label}: download failed (${e.message}) — attempt ${attempt}/${RETRIES}`);
            if (attempt < RETRIES) await sleep(5000 * attempt);
        }
    }
    throw lastErr;
}

export function unpackCsv(buf) {
    if (buf.slice(0, 2).toString() === "PK") {
        const entry = new AdmZip(buf).getEntries().find((e) => /\.csv$/i.test(e.entryName));
        if (!entry) throw new Error("No CSV inside ZIP");
        return entry.getData();
    }
    if (buf[0] === 0x1f && buf[1] === 0x8b) return zlib.gunzipSync(buf);
    return buf;
}

function firstLine(buf) {
    const s = buf.slice(0, 8000).toString("utf8").replace(/^﻿/, "");
    return s.split(/\r?\n/)[0];
}

/** Write CSVs into one file: header from the first, data rows of all. */
function combine(files, out) {
    const fd = fs.openSync(out, "w");
    let header = null;
    let rows = 0;
    try {
        for (const f of files) {
            const buf = fs.readFileSync(f);
            const text = buf.toString("utf8").replace(/^﻿/, "");
            const nl = text.indexOf("\n");
            if (nl < 0) continue;
            const h = text.slice(0, nl).replace(/\r$/, "");
            const body = text.slice(nl + 1);
            if (header === null) {
                header = h;
                fs.writeSync(fd, h + "\n");
            } else if (h !== header) {
                throw new Error(`Feed ${path.basename(f)} has different columns than the first feed`);
            }
            if (body.length) {
                fs.writeSync(fd, body.endsWith("\n") ? body : body + "\n");
                rows += (body.match(/\n/g) || []).length + (body.endsWith("\n") ? 0 : 1);
            }
        }
    } finally {
        fs.closeSync(fd);
    }
    return { header, rows };
}

/**
 * Download the AWIN feed shop by shop. Returns
 * { file, mode: "per-feed"|"single", feeds: [{fid, name, status, rows, bytes}] }.
 */
export async function downloadAwinFeed(feedUrl, { outDir = os.tmpdir(), log = console.log } = {}) {
    if (!feedUrl) throw new Error("AWIN_CSV_URL is not set");
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `awin-${Date.now()}.csv`);

    const single = async (reason) => {
        log(`[AWIN] Single full download (${reason})…`);
        const buf = unpackCsv(await fetchWithRetry(feedUrl, "full feed", log));
        fs.writeFileSync(out, buf);
        return { file: out, mode: "single", feeds: [] };
    };

    const parsed = (() => {
        try {
            return parseFeedUrl(feedUrl);
        } catch {
            return null;
        }
    })();
    const apikey = parsed?.params.get("apikey");
    if (!parsed || !apikey) return single("feed URL has no /apikey/");
    if (process.env.AWIN_PER_FEED_DOWNLOAD === "0") return single("AWIN_PER_FEED_DOWNLOAD=0");

    // 1) feed list
    let list;
    try {
        const listUrl = `${parsed.origin}/datafeed/list/apikey/${apikey}`;
        list = parseFeedList((await fetchWithRetry(listUrl, "feed list", log)).toString("utf8"));
    } catch (e) {
        return single(`feed list unavailable: ${e.message}`);
    }
    if (!list.length || !("Feed ID" in list[0])) return single("feed list has no 'Feed ID' column");

    // 2) which feeds
    const wanted = (parsed.params.get("fid") || "")
        .split(/,|%2C/i)
        .map((s) => s.trim())
        .filter(Boolean);
    const lang = parsed.params.get("language");
    let feeds = wanted.length
        ? list.filter((f) => wanted.includes(String(f["Feed ID"])))
        : list.filter(
              (f) =>
                  /^\s*(active|joined)\s*$/i.test(f["Membership Status"] || "") &&
                  (!lang || !f["Language"] || f["Language"].toLowerCase().startsWith(lang.toLowerCase()))
          );
    if (wanted.length && feeds.length < wanted.length) {
        const missing = wanted.filter((id) => !feeds.some((f) => String(f["Feed ID"]) === id));
        log(`[AWIN] ⚠ Feed ids in AWIN_CSV_URL not in your feed list (not joined?): ${missing.join(", ")}`);
    }
    if (!feeds.length) return single("no matching feeds in feed list");

    log(`[AWIN] Downloading ${feeds.length} shop feeds one by one…`);
    const files = [];
    const report = [];
    for (const f of feeds) {
        const fid = String(f["Feed ID"]);
        const name = f["Advertiser Name"] || f["Feed Name"] || fid;
        const stamp = f["Last Imported"] || "";
        const cacheCsv = path.join(CACHE_DIR, `${fid}.csv`);
        const cacheMeta = path.join(CACHE_DIR, `${fid}.json`);
        let prev = null;
        try {
            prev = JSON.parse(fs.readFileSync(cacheMeta, "utf8"));
        } catch {
            /* no cache */
        }

        if (prev && stamp && prev.lastImported === stamp && prev.url === buildFeedUrl(parsed, { fid }) && fs.existsSync(cacheCsv)) {
            files.push(cacheCsv);
            report.push({ fid, name, status: "unverändert (Cache)", rows: prev.rows, bytes: fs.statSync(cacheCsv).size });
            continue;
        }

        const url = buildFeedUrl(parsed, { fid });
        const t0 = Date.now();
        try {
            const csv = unpackCsv(await fetchWithRetry(url, name, log));
            const header = firstLine(csv);
            if (!/aw_deep_link/.test(header) || !/merchant_name/.test(header)) throw new Error("unexpected columns");
            fs.writeFileSync(cacheCsv, csv);
            const rows = Math.max(0, (csv.toString("utf8").match(/\n/g) || []).length - 1);
            fs.writeFileSync(cacheMeta, JSON.stringify({ lastImported: stamp, url, rows, at: new Date().toISOString() }));
            files.push(cacheCsv);
            report.push({ fid, name, status: `neu geladen (${((Date.now() - t0) / 1000).toFixed(0)}s)`, rows, bytes: csv.length });
        } catch (e) {
            if (fs.existsSync(cacheCsv)) {
                files.push(cacheCsv);
                report.push({ fid, name, status: `FEHLER, alte Kopie genutzt (${e.message})`, rows: prev?.rows ?? 0, bytes: fs.statSync(cacheCsv).size });
            } else {
                report.push({ fid, name, status: `FEHLER, übersprungen (${e.message})`, rows: 0, bytes: 0 });
            }
        }
        log(`  ${report[report.length - 1].name}: ${report[report.length - 1].status}, ${report[report.length - 1].rows} Zeilen`);
        await sleep(PAUSE_MS);
    }

    if (report.every((r) => r.status.startsWith("FEHLER"))) return single("every shop feed failed");
    const skipped = report.filter((r) => r.status.startsWith("FEHLER, übersprungen"));
    if (skipped.length) {
        // Importing without a shop would remove all of its offers from every product.
        throw new Error(
            `Feed download failed for ${skipped.map((r) => r.name).join(", ")} and no earlier copy exists — import aborted, current data kept.`
        );
    }

    const { rows } = combine(files, out);
    log(`[AWIN] Combined ${files.length} shop feeds → ${rows.toLocaleString("de-DE")} rows`);
    return { file: out, mode: "per-feed", feeds: report };
}
