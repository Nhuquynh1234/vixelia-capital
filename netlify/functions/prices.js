/* GET /api/prices?tickers=FPT,VCB,REE&from=2021-09-01&to=2026-09-30
 * Returns month-start adjusted closes aligned across tickers (same method as the group's Excel).
 * Provider: SSI iBoard chart history (unofficial, adjusted closes, thousand VND), DNSE/Entrade as fallback.
 * VNDirect finfo v4 stopped responding (timeout) in 10/2026.
 * Checked against data/prices_case.json: SSI matches the group's Excel (HPG/REE/VCB/FPT 0.0%, VEA ≤3.7%).
 * If both break, only fetchDaily() needs replacing. */
const TICKER = /^[A-Z][A-Z0-9]{2,3}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TICKERS = 12, MIN_MONTHS = 24;

const PROVIDERS = [
  { name: 'SSI iBoard', url: (code, a, b) => `https://iboard-api.ssi.com.vn/statistics/charts/history?resolution=1D&symbol=${code}&from=${a}&to=${b}`, pick: j => j.data },
  { name: 'DNSE Entrade', url: (code, a, b) => `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?resolution=1D&symbol=${code}&from=${a}&to=${b}`, pick: j => j },
];
const unix = d => Math.floor(Date.parse(d) / 1000);
const vnDate = t => new Date((t + 7 * 3600) * 1000).toISOString().slice(0, 10); // timestamps -> Vietnam calendar day

async function fetchFrom(prov, code, from, to, fetchImpl) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetchImpl(prov.url(code, unix(from), unix(to) + 86399), { signal: ctl.signal, headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (VixeliaCapital)' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = prov.pick(await r.json()) || {};
    const rows = (d.t || []).map((ts, i) => ({ date: vnDate(Number(ts)), p: Number(d.c[i]) }))
      .filter(x => x.p > 0 && x.date >= from && x.date <= to);
    if (!rows.length) throw new Error('empty');
    return rows;
  } finally { clearTimeout(t); }
}

async function fetchDaily(code, from, to, fetchImpl = fetch) {
  let err;
  for (const prov of PROVIDERS) {
    try { const rows = await fetchFrom(prov, code, from, to, fetchImpl); rows.source = prov.name; return rows; }
    catch (e) { err = e; }
  }
  throw err;
}

// first trading day of each month (input may be in any order)
function monthStart(rows) {
  const m = new Map();
  for (const { date, p } of rows) {
    const k = date.slice(0, 7), cur = m.get(k);
    if (!cur || date < cur.date) m.set(k, { date, p });
  }
  return m;
}

function align(perTicker) {
  const tickers = Object.keys(perTicker);
  let keys = [...perTicker[tickers[0]].keys()];
  for (const t of tickers.slice(1)) keys = keys.filter(k => perTicker[t].has(k));
  keys.sort();
  const prices = {}; for (const t of tickers) prices[t] = keys.map(k => perTicker[t].get(k).p);
  return { dates: keys.map(k => perTicker[tickers[0]].get(k).date), prices };
}

const res = (code, body, extra = {}) => ({ statusCode: code, headers: { 'content-type': 'application/json; charset=utf-8', ...extra }, body: JSON.stringify(body) });

async function handler(event, _ctx, deps = {}) {
  const q = event.queryStringParameters || {};
  const tickers = [...new Set((q.tickers || '').toUpperCase().split(',').map(s => s.trim()).filter(Boolean))];
  if (tickers.length < 2 || tickers.length > MAX_TICKERS || !tickers.every(t => TICKER.test(t)))
    return res(400, { error: `Cần 2–${MAX_TICKERS} mã hợp lệ, ví dụ tickers=FPT,VCB,REE` });
  const to = DAY.test(q.to || '') ? q.to : new Date().toISOString().slice(0, 10);
  // default: first day of the same month 5 years earlier, so the first month is a real month start
  const from = DAY.test(q.from || '') ? q.from : `${Number(to.slice(0, 4)) - 5}${to.slice(4, 7)}-01`;
  const get = deps.fetchDaily || fetchDaily;
  const out = {}, failed = [], used = new Set();
  await Promise.all(tickers.map(async t => {
    try { const rows = await get(t, from, to); if (rows.source) used.add(rows.source); if (rows.length) out[t] = monthStart(rows); else failed.push(t); }
    catch { failed.push(t); }
  }));
  if (failed.length) return res(502, { error: 'Không lấy được dữ liệu cho: ' + failed.join(', ') + '. Kiểm tra mã hoặc thử lại.' });
  const months = Object.fromEntries(tickers.map(t => [t, out[t].size]));
  const a = align(out);
  if (a.dates.length < MIN_MONTHS) return res(422, { error: `Chỉ có ${a.dates.length} tháng dữ liệu chung (cần tối thiểu ${MIN_MONTHS}).`, months });
  return res(200, { source: [...used].join(' + ') || 'SSI iBoard', from, to, months, ...a },
    { 'cache-control': 'public, max-age=3600, s-maxage=86400' });
}
exports.handler = handler;
exports._test = { monthStart, align, fetchDaily };
