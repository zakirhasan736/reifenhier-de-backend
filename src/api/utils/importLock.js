/**
 * Shared AWIN import lock (ImportMeta.isRunning + heartbeat).
 *
 * A running import writes heartbeatAt every few seconds. A lock whose
 * heartbeat is older than AWIN_LOCK_STALE_MIN (default 10 min) belongs to a
 * process that died (crash, pm2 restart, server reboot) and may be taken over.
 * Before this, a killed import blocked every cron run for 6 hours.
 */
import ImportMeta from "../../models/ImportMeta.js";

export const LOCK_STALE_MS = Number(process.env.AWIN_LOCK_STALE_MIN || 10) * 60 * 1000;

export function lockState(meta, now = Date.now()) {
    if (!meta?.isRunning) return { running: false, alive: false };
    const beat = new Date(meta.heartbeatAt || meta.lastStarted || 0).getTime();
    const started = new Date(meta.lastStarted || meta.heartbeatAt || 0).getTime();
    return {
        running: true,
        alive: now - beat < LOCK_STALE_MS,
        startedMinAgo: Math.round((now - started) / 60000),
        heartbeatSecAgo: Math.round((now - beat) / 1000),
        progress: meta.progress ?? 0,
    };
}

export async function getLockState() {
    return lockState(await ImportMeta.findOne({ source: "AWIN" }).lean());
}

/** Clear a dead lock. Returns true if a stale lock was released. */
export async function releaseStaleLock() {
    const meta = await ImportMeta.findOne({ source: "AWIN" }).lean();
    const s = lockState(meta);
    if (!s.running || s.alive) return false;
    await ImportMeta.updateOne(
        { source: "AWIN", isRunning: true, heartbeatAt: meta.heartbeatAt ?? null },
        { $set: { isRunning: false, lastError: "Stale import lock released (process gone)", lastErrorAt: new Date() } }
    );
    return true;
}

let lastBeat = 0;
/** Throttled heartbeat (at most every 15 s), never throws. */
export function heartbeat(extra = {}) {
    const now = Date.now();
    if (now - lastBeat < 15000 && !Object.keys(extra).length) return;
    lastBeat = now;
    ImportMeta.updateOne({ source: "AWIN" }, { $set: { heartbeatAt: new Date(), ...extra } }).catch(() => {});
}

/** Wait until no live import holds the lock (or it goes stale). */
export async function waitForImportIdle({ timeoutMs = 90 * 60 * 1000, pollMs = 15000, onWait } = {}) {
    const until = Date.now() + timeoutMs;
    for (;;) {
        const s = await getLockState();
        if (!s.running) return { waited: false };
        if (!s.alive) {
            await releaseStaleLock();
            return { waited: false, releasedStale: true };
        }
        if (Date.now() > until) return { waited: true, timedOut: true, state: s };
        onWait?.(s);
        await new Promise((r) => setTimeout(r, pollMs));
        const after = await getLockState();
        if (!after.running) return { waited: true };
    }
}
