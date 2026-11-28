import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Click from '../../models/click.js';
import PageView from '../../models/pageView.js';
import Product from '../../models/product.js';
import AwinTransaction from '../../models/awinTransaction.js';
import ImportMeta from '../../models/ImportMeta.js';
import AdminPushSubscription from '../../models/adminPushSubscription.js';
import { getLockState } from '../utils/importLock.js';
import { sendAdminPush } from '../adminAlerts/adminAlerts.service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TZ = 'Europe/Berlin';

function berlinParts(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), weekday: get('weekday') };
}

function shiftDate(y, m, d, days) {
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** UTC instant of 00:00 in Europe/Berlin on that calendar day. */
function berlinStart(y, m, d) {
    let t = Date.UTC(y, m - 1, d, 0, 0, 0);
    for (let i = 0; i < 4; i++) {
        const p = berlinParts(new Date(t));
        const want = Date.UTC(y, m - 1, d);
        const got = Date.UTC(p.y, p.m - 1, p.d);
        const dayDiff = Math.round((want - got) / 86400000);
        const hour = Number(new Intl.DateTimeFormat('en-GB', {
            timeZone: TZ, hour: '2-digit', hourCycle: 'h23',
        }).format(new Date(t)));
        t += dayDiff * 86400000 - (hour === 24 ? 0 : hour) * 3600000;
    }
    return new Date(t);
}

function ranges(now = new Date()) {
    const today = berlinParts(now);
    const startToday = berlinStart(today.y, today.m, today.d);
    const yest = shiftDate(today.y, today.m, today.d, -1);
    const startYesterday = berlinStart(yest.y, yest.m, yest.d);
    const d7 = shiftDate(today.y, today.m, today.d, -6);
    const d28 = shiftDate(today.y, today.m, today.d, -27);
    const prevMonth = today.m === 1 ? { y: today.y - 1, m: 12 } : { y: today.y, m: today.m - 1 };
    const monthStart = berlinStart(prevMonth.y, prevMonth.m, 1);
    const monthEnd = berlinStart(today.y, today.m, 1);
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const p = shiftDate(today.y, today.m, today.d, -i);
        const from = berlinStart(p.y, p.m, p.d);
        const next = shiftDate(p.y, p.m, p.d, 1);
        days.push({
            label: berlinParts(from).weekday,
            date: `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`,
            from,
            to: berlinStart(next.y, next.m, next.d),
        });
    }
    return {
        startToday,
        startYesterday,
        last7: berlinStart(d7.y, d7.m, d7.d),
        last28: berlinStart(d28.y, d28.m, d28.d),
        monthStart,
        monthEnd,
        monthLabel: `${prevMonth.y}-${String(prevMonth.m).padStart(2, '0')}`,
        days,
    };
}

const countedSale = { status: { $nin: ['declined', 'deleted'] } };

async function countBetween(Model, field, from, to) {
    const q = { [field]: { $gte: from } };
    if (to) q[field].$lt = to;
    return Model.countDocuments(q);
}

async function salesBetween(from, to) {
    const match = { ...countedSale, transactionDate: { $gte: from } };
    if (to) match.transactionDate.$lt = to;
    const [row] = await AwinTransaction.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                sales: { $sum: 1 },
                amount: { $sum: { $ifNull: ['$saleAmount', 0] } },
                profit: { $sum: { $ifNull: ['$commission', 0] } },
            },
        },
    ]);
    return { sales: row?.sales || 0, amount: row?.amount || 0, profit: row?.profit || 0 };
}

export async function overview(_req, res) {
    const r = ranges();
    const [products, clicks, views, sales, vendors, weekdayClicks] = await Promise.all([
        Product.countDocuments(),
        Promise.all([
            countBetween(Click, 'clicked_at', r.startYesterday, r.startToday),
            countBetween(Click, 'clicked_at', r.last7),
            countBetween(Click, 'clicked_at', r.last28),
            countBetween(Click, 'clicked_at', r.monthStart, r.monthEnd),
        ]),
        Promise.all([
            countBetween(PageView, 'viewed_at', r.startYesterday, r.startToday),
            countBetween(PageView, 'viewed_at', r.last7),
            countBetween(PageView, 'viewed_at', r.last28),
            countBetween(PageView, 'viewed_at', r.monthStart, r.monthEnd),
        ]),
        Promise.all([
            salesBetween(new Date(0)),
            salesBetween(r.startYesterday, r.startToday),
            salesBetween(r.last7),
            salesBetween(r.last28),
            salesBetween(r.monthStart, r.monthEnd),
        ]),
        AwinTransaction.aggregate([
            { $match: countedSale },
            {
                $group: {
                    _id: { $ifNull: ['$merchantName', { $ifNull: ['$merchantId', 'Unknown'] }] },
                    sales: { $sum: 1 },
                    saleAmount: { $sum: { $ifNull: ['$saleAmount', 0] } },
                    commission: { $sum: { $ifNull: ['$commission', 0] } },
                },
            },
            { $sort: { commission: -1 } },
        ]),
        Promise.all(r.days.map((day) => countBetween(Click, 'clicked_at', day.from, day.to))),
    ]);

    const [all, yesterdaySales, weekSales, month28Sales, lastMonthSales] = sales;
    res.json({
        generatedAt: new Date().toISOString(),
        timezone: TZ,
        products,
        clicks: {
            yesterday: clicks[0],
            last7: clicks[1],
            last28: clicks[2],
            lastMonth: clicks[3],
            weekdays: r.days.map((day, i) => ({ label: day.label, date: day.date, clicks: weekdayClicks[i] })),
        },
        views: {
            yesterday: views[0],
            last7: views[1],
            last28: views[2],
            lastMonth: views[3],
        },
        sales: {
            total: all.sales,
            amount: all.amount,
            profit: all.profit,
            yesterday: yesterdaySales,
            last7: weekSales,
            last28: month28Sales,
            lastMonth: lastMonthSales,
        },
        lastMonth: r.monthLabel,
        vendors: vendors.map((v) => ({
            vendor: v._id || 'Unknown',
            sales: v.sales,
            saleAmount: v.saleAmount,
            commission: v.commission,
        })),
    });
}

export async function transactions(req, res) {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const rows = await AwinTransaction.find({})
        .sort({ transactionDate: -1, createdAt: -1 })
        .limit(limit)
        .select('-raw')
        .lean();
    res.json({ transactions: rows });
}

function jobView(meta, alive) {
    if (!meta) return { running: false, alive: false };
    return {
        running: Boolean(meta.isRunning),
        alive,
        lastStarted: meta.lastStarted || null,
        lastSuccess: meta.lastSuccess || null,
        lastError: meta.lastError || '',
        lastErrorAt: meta.lastErrorAt || null,
        progress: meta.progress || 0,
        imported: meta.imported || 0,
        updated: meta.updated || 0,
        deleted: meta.deleted || 0,
    };
}

export async function jobs(_req, res) {
    const [awin, prices, shop] = await Promise.all([
        ImportMeta.findOne({ source: 'AWIN' }).lean(),
        ImportMeta.findOne({ source: 'PRICES' }).lean(),
        ImportMeta.findOne({ source: 'SHOP_PRICES' }).lean(),
    ]);
    const awinLock = await getLockState();
    const beat = (meta) => {
        if (!meta?.isRunning) return false;
        const at = new Date(meta.heartbeatAt || meta.lastStarted || 0).getTime();
        return Date.now() - at < 6 * 3600 * 1000;
    };
    res.json({
        import: jobView(awin, awinLock.alive),
        feedPrices: jobView(prices, beat(prices)),
        shopPrices: jobView(shop, beat(shop)),
    });
}

function startScript(file, args = []) {
    const child = spawn(process.execPath, [file, ...args], {
        cwd: root,
        detached: true,
        stdio: 'ignore',
        env: process.env,
    });
    child.unref();
    return child.pid;
}

export async function rerunImport(_req, res) {
    const lock = await getLockState();
    if (lock.alive) return res.status(409).json({ error: 'import_already_running' });
    const pid = startScript(path.join(root, 'scripts', 'awin-sync-now.mjs'), ['--import-anyway']);
    res.json({ started: true, pid, job: 'import' });
}

export async function runFeedPrices(_req, res) {
    const lock = await getLockState();
    if (lock.alive) return res.status(409).json({ error: 'import_already_running' });
    const pid = startScript(path.join(root, 'src', 'api', 'utils', 'updatePricesIncremental.js'));
    res.json({ started: true, pid, job: 'feed-prices' });
}

export async function runShopPrices(_req, res) {
    const meta = await ImportMeta.findOne({ source: 'SHOP_PRICES' }).lean();
    const beat = meta?.heartbeatAt ? new Date(meta.heartbeatAt).getTime() : 0;
    if (meta?.isRunning && beat && Date.now() - beat < 6 * 3600 * 1000) {
        return res.status(409).json({ error: 'shop_prices_already_running' });
    }
    const pid = startScript(path.join(root, 'src', 'api', 'utils', 'updateAllShopPrices.js'));
    res.json({ started: true, pid, job: 'shop-prices' });
}

export async function subscribePush(req, res) {
    const { subscription, label = 'temp admin' } = req.body || {};
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ error: 'invalid_subscription' });
    }
    await AdminPushSubscription.findOneAndUpdate(
        { endpoint: subscription.endpoint },
        {
            $set: {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
                label: String(label).slice(0, 60),
                userAgent: req.headers['user-agent'] || '',
                notifySales: true,
                notifyClicks: false,
                enabled: true,
                updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
    );
    res.json({ success: true });
}

export async function unsubscribePush(req, res) {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'missing_endpoint' });
    await AdminPushSubscription.deleteOne({ endpoint });
    res.json({ success: true });
}

export async function testPush(_req, res) {
    const r = await sendAdminPush('test', {
        title: 'Reifexa Ops',
        body: 'Push is on. New sales and transaction updates will show up here.',
        tag: `rx-ops-test-${Date.now()}`,
        kind: 'admin_test',
        url: `${(process.env.FRONTEND_URL || 'https://www.reifexa.de').replace(/\/$/, '')}/ops`,
    });
    res.json(r);
}
