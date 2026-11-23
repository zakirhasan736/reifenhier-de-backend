import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const HEADERS = ["Email", "Status", "Quelle", "IP", "Angemeldet am", "Aktualisiert am"];

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

let tokenCache = { token: "", exp: 0 };
let queue = Promise.resolve();

function enqueue(task) {
    const run = queue.then(task, task);
    queue = run.then(
        () => {},
        () => {}
    );
    return run;
}

function sheetId() {
    const id = String(process.env.GOOGLE_SHEET_ID || "").trim();
    return /^[a-zA-Z0-9-_]+$/.test(id) ? id : "";
}

function tabName() {
    return String(process.env.GOOGLE_SHEET_TAB || "Newsletter").trim() || "Newsletter";
}

function a1(range, tab = tabName()) {
    const safe = String(tab).replace(/'/g, "''");
    return `'${safe}'!${range}`;
}

function autoApiTab() {
    return String(process.env.GOOGLE_SHEET_AUTO_API_TAB || "Auto-API").trim() || "Auto-API";
}

function formatDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
}

export function leadToRow(lead) {
    return [
        String(lead.email || "").trim().toLowerCase(),
        lead.status || "subscribed",
        lead.source || "",
        lead.ip || "",
        formatDate(lead.subscribedAt || lead.createdAt || new Date()),
        formatDate(lead.updatedAt || new Date()),
    ];
}

function loadCredentials() {
    const configured = String(process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "").trim();
    if (!configured) return null;
    const file = path.isAbsolute(configured) ? configured : path.resolve(backendRoot, configured);
    if (!fs.existsSync(file)) {
        console.warn(`[SHEET] Service account file not found: ${configured}`);
        return null;
    }
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!json.client_email || !json.private_key) {
        console.warn("[SHEET] Service account JSON is missing client_email or private_key");
        return null;
    }
    return { email: json.client_email, key: json.private_key };
}

export function isGoogleSheetConfigured() {
    return Boolean(sheetId() && loadCredentials());
}

function signJwt(email, privateKey) {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claim = Buffer.from(
        JSON.stringify({
            iss: email,
            scope: SHEETS_SCOPE,
            aud: TOKEN_URL,
            iat: now,
            exp: now + 3600,
        })
    ).toString("base64url");
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(`${header}.${claim}`);
    signer.end();
    return `${header}.${claim}.${signer.sign(privateKey).toString("base64url")}`;
}

async function accessToken(creds) {
    if (tokenCache.token && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: signJwt(creds.email, creds.key),
        }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body.error_description || body.error || `Google token failed (${response.status})`);
    }
    tokenCache = { token: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 };
    return tokenCache.token;
}

async function sheetsFetch(creds, urlPath, { method = "GET", body } = {}) {
    const token = await accessToken(creds);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId()}${urlPath}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload.error?.message || `Google Sheets failed (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }
    return payload;
}

async function ensureTab(creds, tab = tabName()) {
    const meta = await sheetsFetch(creds, "?fields=sheets.properties.title");
    const titles = (meta.sheets || []).map((sheet) => sheet.properties?.title);
    if (titles.includes(tab)) return;
    await sheetsFetch(creds, ":batchUpdate", {
        method: "POST",
        body: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
}

async function readRows(creds) {
    const range = encodeURIComponent(a1("A:F"));
    try {
        const payload = await sheetsFetch(creds, `/values/${range}`);
        return payload.values || [];
    } catch (err) {
        if (err.status === 400) {
            await ensureTab(creds);
            return [];
        }
        throw err;
    }
}

async function writeRange(creds, range, values) {
    const encoded = encodeURIComponent(a1(range));
    await sheetsFetch(creds, `/values/${encoded}?valueInputOption=RAW`, {
        method: "PUT",
        body: { values },
    });
}

async function writeTable(creds, rows) {
    const existing = await readRows(creds);
    await writeRange(creds, "A1", [HEADERS, ...rows]);
    const written = rows.length + 1;
    if (existing.length > written) {
        await sheetsFetch(creds, `/values/${encodeURIComponent(a1(`A${written + 1}:F`))}:clear`, {
            method: "POST",
        });
    }
}

async function upsertRows(leads) {
    const id = sheetId();
    const creds = loadCredentials();
    if (!id || !creds) {
        console.warn("[SHEET] GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_FILE missing — sheet update skipped");
        return { saved: false, reason: "not_configured" };
    }

    await ensureTab(creds);
    const existing = await readRows(creds);
    const headerOk = existing[0]?.[0] === HEADERS[0];
    const data = headerOk ? existing.slice(1) : existing.filter((row) => String(row[0] || "").trim());
    const byEmail = new Map();
    data.forEach((row, index) => {
        const email = String(row[0] || "").trim().toLowerCase();
        if (email) byEmail.set(email, index);
    });

    for (const lead of leads) {
        const row = leadToRow(lead);
        if (!row[0]) continue;
        const index = byEmail.get(row[0]);
        if (index == null) {
            data.push(row);
            byEmail.set(row[0], data.length - 1);
        } else {
            data[index] = row;
        }
    }

    await writeTable(creds, data);
    return { saved: true, count: data.length };
}

const AUTO_API_HEADERS = ["Email", "Tarif", "Server-IPs", "Anfrage-IP", "Status", "Zeit"];

async function appendAutoApiRow(lead) {
    const id = sheetId();
    const creds = loadCredentials();
    if (!id || !creds) {
        console.warn("[SHEET] GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_FILE missing — Auto-API sheet skipped");
        return { saved: false, reason: "not_configured" };
    }

    const tab = autoApiTab();
    await ensureTab(creds, tab);
    const headerRange = encodeURIComponent(a1("A1:F1", tab));
    let header = [];
    try {
        const payload = await sheetsFetch(creds, `/values/${headerRange}`);
        header = payload.values?.[0] || [];
    } catch (err) {
        if (err.status !== 400) throw err;
    }
    if (header[0] !== AUTO_API_HEADERS[0]) {
        await sheetsFetch(creds, `/values/${encodeURIComponent(a1("A1", tab))}?valueInputOption=RAW`, {
            method: "PUT",
            body: { values: [AUTO_API_HEADERS] },
        });
    }

    const serverIps = Array.isArray(lead.serverIps) ? lead.serverIps.join(", ") : String(lead.serverIps || "");
    await sheetsFetch(
        creds,
        `/values/${encodeURIComponent(a1("A:F", tab))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
            method: "POST",
            body: {
                values: [[
                    String(lead.email || "").trim().toLowerCase(),
                    lead.plan || "",
                    serverIps,
                    lead.ip || "",
                    lead.status || "pending",
                    formatDate(new Date()),
                ]],
            },
        }
    );
    return { saved: true };
}

/** Auto-API checkout rows go to their own tab, not the newsletter tab. */
export function appendAutoApiRequest(lead) {
    return enqueue(() => appendAutoApiRow(lead));
}

export function upsertNewsletterLead(lead) {
    return enqueue(() => upsertRows([lead]));
}

export function replaceNewsletterSheet(leads) {
    return enqueue(async () => {
        const id = sheetId();
        const creds = loadCredentials();
        if (!id || !creds) {
            throw new Error("Set GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_FILE in .env first");
        }
        await ensureTab(creds);
        const rows = leads.map(leadToRow).filter((row) => row[0]);
        await writeTable(creds, rows);
        return { saved: true, count: rows.length };
    });
}
