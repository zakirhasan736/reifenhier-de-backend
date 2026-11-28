import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Click from '../../models/click.js';
import PageView from '../../models/pageView.js';
import Product from '../../models/product.js';
import AwinTransaction from '../../models/awinTransaction.js';
import ImportMeta from '../../models/ImportMeta.js';
import AdminPushSubscription from '../../models/adminPushSubscription.js';
import FeaturedSettings from '../../models/FeaturedSettings.js';
import { getLockState } from '../utils/importLock.js';
import { sendAdminPush } from '../adminAlerts/adminAlerts.service.js';
import { publishOpsEvent, subscribeOpsEvents } from './liveFeed.js';

const SEASONS = ['Sommerreifen', 'Winterreifen', 'Ganzjahresreifen'];

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
    const [products, clicks, views, sales, vendors, weekdayClicks, todayRows] = await Promise.all([
        Product.countDocuments(),
        Promise.all([
            countBetween(Click, 'clicked_at', r.startToday),
            countBetween(Click, 'clicked_at', r.startYesterday, r.startToday),
            countBetween(Click, 'clicked_at', r.last7),
            countBetween(Click, 'clicked_at', r.last28),
            countBetween(Click, 'clicked_at', r.monthStart, r.monthEnd),
        ]),
        Promise.all([
            countBetween(PageView, 'viewed_at', r.startToday),
            countBetween(PageView, 'viewed_at', r.startYesterday, r.startToday),
            countBetween(PageView, 'viewed_at', r.last7),
            countBetween(PageView, 'viewed_at', r.last28),
            countBetween(PageView, 'viewed_at', r.monthStart, r.monthEnd),
        ]),
        Promise.all([
            salesBetween(new Date(0)),
            salesBetween(r.startToday),
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
        AwinTransaction.find({ transactionDate: { $gte: r.startToday } })
            .sort({ transactionDate: -1, createdAt: -1 })
            .limit(6)
            .select('-raw')
            .lean(),
    ]);

    const [all, todaySales, yesterdaySales, weekSales, month28Sales, lastMonthSales] = sales;
    res.json({
        generatedAt: new Date().toISOString(),
        timezone: TZ,
        products,
        today: {
            views: views[0],
            clicks: clicks[0],
            sales: todaySales.sales,
            amount: todaySales.amount,
            profit: todaySales.profit,
            transactions: todayRows.map((row) => ({
                transactionId: row.transactionId,
                merchantName: row.merchantName || '',
                saleAmount: row.saleAmount || 0,
                commission: row.commission || 0,
                status: row.status || '',
                transactionDate: row.transactionDate || null,
            })),
        },
        clicks: {
            today: clicks[0],
            yesterday: clicks[1],
            last7: clicks[2],
            last28: clicks[3],
            lastMonth: clicks[4],
            weekdays: r.days.map((day, i) => ({ label: day.label, date: day.date, clicks: weekdayClicks[i] })),
        },
        views: {
            today: views[0],
            yesterday: views[1],
            last7: views[2],
            last28: views[3],
            lastMonth: views[4],
        },
        sales: {
            total: all.sales,
            amount: all.amount,
            profit: all.profit,
            today: todaySales,
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
    const filter = {};
    if (req.query.preset) {
        const range = resolveRange(req.query);
        if (range.error) return res.status(400).json({ error: range.error });
        filter.transactionDate = { $gte: range.from, $lt: range.to };
    }
    const rows = await AwinTransaction.find(filter)
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
    const tag = `rx-ops-test-${Date.now()}`;
    const notice = {
        title: 'Test · reifen DE',
        body: 'Provision 4,20 € · Umsatz 53,08 €',
        tag,
        transactionId: tag,
        vendor: 'reifen DE',
        commission: '4,20 €',
        saleAmount: '53,08 €',
        kind: 'admin_test',
        sound: true,
        url: `${(process.env.FRONTEND_URL || 'https://www.reifexa.de').replace(/\/$/, '')}/ops`,
    };
    publishOpsEvent({ type: 'sale', ...notice, status: 'test' });
    const r = await sendAdminPush('test', notice);
    res.json(r);
}

/** Live sale stream for the open desk. One event per new sale or status change. */
export function stream(req, res) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    let closed = false;
    let ping = null;
    const unsubscribeHolder = { fn: () => undefined };
    const close = () => {
        if (closed) return;
        closed = true;
        if (ping) clearInterval(ping);
        unsubscribeHolder.fn();
    };
    const write = (event) => {
        if (closed) return;
        try {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch {
            close();
        }
    };
    write({ type: 'hello' });
    unsubscribeHolder.fn = subscribeOpsEvents(write);
    ping = setInterval(() => {
        if (closed) return;
        try {
            res.write(': ping\n\n');
        } catch {
            close();
        }
    }, 20000);
    req.on('close', close);
    res.on('close', close);
}

export async function pushStatus(_req, res) {
    const devices = await AdminPushSubscription.countDocuments({ enabled: true, notifySales: true });
    res.json({ devices });
}

const PRESETS = new Set(['today', 'yesterday', 'last7', 'last28', 'custom']);

function bucketKey(date, hourly) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    const y = get('year');
    const m = get('month');
    const d = get('day');
    if (!hourly) return `${y}-${m}-${d}`;
    const hour = get('hour') === '24' ? '00' : get('hour').padStart(2, '0');
    return `${y}-${m}-${d}T${hour}`;
}

/** Inclusive Berlin calendar window. `to` is the exclusive end instant. */
function resolveRange(query, now = new Date()) {
    const preset = PRESETS.has(query.preset) ? query.preset : 'last7';
    const r = ranges(now);
    if (preset === 'today') return { preset, from: r.startToday, to: now, hourly: true };
    if (preset === 'yesterday') return { preset, from: r.startYesterday, to: r.startToday, hourly: true };
    if (preset === 'last7') return { preset, from: r.last7, to: now, hourly: false };
    if (preset === 'last28') return { preset, from: r.last28, to: now, hourly: false };

    const fromParts = String(query.from || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const toParts = String(query.to || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!fromParts || !toParts) return { error: 'Choose a start date and an end date.' };
    const from = berlinStart(Number(fromParts[1]), Number(fromParts[2]), Number(fromParts[3]));
    const next = shiftDate(Number(toParts[1]), Number(toParts[2]), Number(toParts[3]), 1);
    const to = berlinStart(next.y, next.m, next.d);
    if (!(from < to)) return { error: 'The start date has to be before the end date.' };
    if (to.getTime() - from.getTime() > 92 * 86400000) return { error: 'Choose 90 days or fewer.' };
    const days = (to.getTime() - from.getTime()) / 86400000;
    return { preset, from, to: to > now ? now : to, hourly: days <= 2 };
}

function axisKeys(from, to, hourly) {
    if (hourly) {
        const keys = [];
        const end = to.getTime();
        for (let t = from.getTime(); t < end && keys.length < 30; t += 3600000) {
            const key = bucketKey(new Date(Math.min(t + 60 * 1000, end)), true);
            if (keys.some((row) => row.key === key)) continue;
            keys.push({ key, label: `${key.slice(11)}:00` });
        }
        if (!keys.length) {
            const key = bucketKey(from, true);
            keys.push({ key, label: `${key.slice(11)}:00` });
        }
        return keys;
    }
    const start = berlinParts(new Date(from.getTime() + 3600000));
    const end = berlinParts(new Date(to.getTime() - 1000));
    const keys = [];
    let y = start.y;
    let m = start.m;
    let d = start.d;
    for (let i = 0; i < 92; i++) {
        const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        keys.push({ key, label: `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}` });
        if (y === end.y && m === end.m && d === end.d) break;
        const n = shiftDate(y, m, d, 1);
        y = n.y;
        m = n.m;
        d = n.d;
    }
    return keys;
}

async function countSeries(Model, field, from, to, hourly) {
    const format = hourly ? '%Y-%m-%dT%H' : '%Y-%m-%d';
    const rows = await Model.aggregate([
        { $match: { [field]: { $gte: from, $lt: to } } },
        {
            $group: {
                _id: { $dateToString: { format, date: `$${field}`, timezone: TZ } },
                n: { $sum: 1 },
            },
        },
    ]);
    return new Map(rows.map((row) => [row._id, row.n]));
}

async function salesSeries(from, to, hourly) {
    const format = hourly ? '%Y-%m-%dT%H' : '%Y-%m-%d';
    const rows = await AwinTransaction.aggregate([
        { $match: { ...countedSale, transactionDate: { $gte: from, $lt: to } } },
        {
            $group: {
                _id: { $dateToString: { format, date: '$transactionDate', timezone: TZ } },
                sales: { $sum: 1 },
                amount: { $sum: { $ifNull: ['$saleAmount', 0] } },
                profit: { $sum: { $ifNull: ['$commission', 0] } },
            },
        },
    ]);
    return new Map(rows.map((row) => [row._id, row]));
}

async function windowTotals(from, to) {
    const [views, clicks, sales] = await Promise.all([
        PageView.countDocuments({ viewed_at: { $gte: from, $lt: to } }),
        Click.countDocuments({ clicked_at: { $gte: from, $lt: to } }),
        salesBetween(from, to),
    ]);
    return { views, clicks, sales: sales.sales, amount: sales.amount, profit: sales.profit };
}

export async function series(req, res) {
    const range = resolveRange(req.query);
    if (range.error) return res.status(400).json({ error: range.error });
    const { from, to, hourly, preset } = range;
    const span = Math.max(to.getTime() - from.getTime(), 60 * 1000);
    const prevFrom = new Date(from.getTime() - span);
    const prevTo = from;

    const [views, clicks, sales, previous, vendors, statuses, topClicks, topPages] = await Promise.all([
        countSeries(PageView, 'viewed_at', from, to, hourly),
        countSeries(Click, 'clicked_at', from, to, hourly),
        salesSeries(from, to, hourly),
        windowTotals(prevFrom, prevTo),
        AwinTransaction.aggregate([
            { $match: { ...countedSale, transactionDate: { $gte: from, $lt: to } } },
            {
                $group: {
                    _id: { $ifNull: ['$merchantName', { $ifNull: ['$merchantId', 'Unknown'] }] },
                    sales: { $sum: 1 },
                    saleAmount: { $sum: { $ifNull: ['$saleAmount', 0] } },
                    commission: { $sum: { $ifNull: ['$commission', 0] } },
                },
            },
            { $sort: { commission: -1 } },
            { $limit: 8 },
        ]),
        AwinTransaction.aggregate([
            { $match: { transactionDate: { $gte: from, $lt: to } } },
            {
                $group: {
                    _id: { $ifNull: ['$status', 'pending'] },
                    count: { $sum: 1 },
                    amount: { $sum: { $ifNull: ['$saleAmount', 0] } },
                },
            },
            { $sort: { count: -1 } },
        ]),
        Click.aggregate([
            { $match: { clicked_at: { $gte: from, $lt: to }, product_name: { $nin: [null, ''] } } },
            { $group: { _id: '$product_name', clicks: { $sum: 1 } } },
            { $sort: { clicks: -1 } },
            { $limit: 6 },
        ]),
        PageView.aggregate([
            { $match: { viewed_at: { $gte: from, $lt: to }, page: { $nin: [null, ''] } } },
            { $group: { _id: '$page', views: { $sum: 1 } } },
            { $sort: { views: -1 } },
            { $limit: 6 },
        ]),
    ]);

    const points = axisKeys(from, to, hourly).map((bucket) => {
        const sale = sales.get(bucket.key) || {};
        return {
            date: bucket.key,
            label: bucket.label,
            views: views.get(bucket.key) || 0,
            clicks: clicks.get(bucket.key) || 0,
            sales: sale.sales || 0,
            amount: sale.amount || 0,
            profit: sale.profit || 0,
        };
    });
    const totals = points.reduce((acc, point) => ({
        views: acc.views + point.views,
        clicks: acc.clicks + point.clicks,
        sales: acc.sales + point.sales,
        amount: acc.amount + point.amount,
        profit: acc.profit + point.profit,
    }), { views: 0, clicks: 0, sales: 0, amount: 0, profit: 0 });

    res.json({
        preset,
        grain: hourly ? 'hour' : 'day',
        from: from.toISOString(),
        to: to.toISOString(),
        totals,
        previous,
        points,
        vendors: vendors.map((v) => ({
            vendor: v._id || 'Unknown',
            sales: v.sales,
            saleAmount: v.saleAmount,
            commission: v.commission,
        })),
        statuses: statuses.map((row) => ({
            status: row._id || 'pending',
            count: row.count,
            amount: row.amount,
        })),
        topClicks: topClicks.map((row) => ({ name: row._id, clicks: row.clicks })),
        topPages: topPages.map((row) => ({ page: row._id, views: row.views })),
    });
}

async function seasonProducts(category) {
    return Product.aggregate([
        {
            $match: {
                merchant_product_third_category: { $regex: new RegExp(`^${category}$`, 'i') },
            },
        },
        { $sort: { average_rating: -1, createdAt: -1 } },
        { $limit: 800 },
        { $group: { _id: '$brand_name', product: { $first: '$$ROOT' } } },
        { $limit: 10 },
        { $replaceRoot: { newRoot: '$product' } },
        {
            $project: {
                slug: 1,
                product_name: 1,
                brand_name: 1,
                product_image: 1,
                awin_image_url: 1,
                merchant_thumb_url: 1,
                search_price: 1,
                cheapest_offer: 1,
            },
        },
    ]);
}

async function homepagePayload(settings) {
    const category = SEASONS.includes(settings?.category) ? settings.category : 'Winterreifen';
    const products = await seasonProducts(category);
    return {
        title: settings?.section_title || 'Our recommendation',
        category,
        seasons: SEASONS,
        products,
    };
}

export async function homepageSession(_req, res) {
    const settings = await FeaturedSettings.findOne().lean();
    res.json(await homepagePayload(settings));
}

export async function updateHomepageSession(req, res) {
    const category = String(req.body?.category || '');
    const sectionTitle = String(req.body?.section_title || '').trim().slice(0, 120);
    if (!SEASONS.includes(category) || !sectionTitle) {
        return res.status(400).json({ error: 'category_and_title_required' });
    }
    const updated = await FeaturedSettings.findOneAndUpdate(
        {},
        { category, section_title: sectionTitle },
        { upsert: true, new: true }
    ).lean();
    res.json(await homepagePayload(updated));
}
