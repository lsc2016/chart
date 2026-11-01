// 주식: GitHub Actions가 정해진 시간마다 받아 둔 JSON 파일을 읽는다 (브라우저에서 직접 시세 사이트 호출 불가)
import { fetchJSON } from '../util.js';

const BASE = new URL('../../data/stocks/', import.meta.url).href;

let indexCache = null;
let indexAt = 0;

async function index(force = false) {
  if (!indexCache || force || Date.now() - indexAt > 5 * 60 * 1000) {
    try {
      indexCache = await fetchJSON(`${BASE}index.json?t=${Math.floor(Date.now() / 60000)}`);
    } catch {
      indexCache = indexCache || { stocks: [], updatedAt: null };
    }
    indexAt = Date.now();
  }
  return indexCache;
}

const fileName = (symbol) => symbol.replace(/[^A-Za-z0-9._-]/g, '_');

// 1시간봉 4개씩 묶어 4시간봉 만들기 (거래소 기준 하루 안에서만)
function to4h(bars, gmtoffset = 0) {
  const out = [];
  let day = null, n = 0, cur = null;
  for (const b of bars) {
    const d = Math.floor((b.time + gmtoffset) / 86400);
    if (d !== day) { day = d; n = 0; }
    if (n % 4 === 0) { cur = { ...b }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; cur.volume += b.volume; }
    n++;
  }
  return out;
}

export const stocks = {
  id: 'stock',
  label: '주식',
  intervals: ['15m', '1h', '4h', '1d', '1w'],
  realtime: false,
  history: false,
  index,

  info(symbol) {
    const s = indexCache?.stocks?.find((x) => x.symbol === symbol);
    return { name: s?.name || symbol, sub: symbol, currency: s?.currency || (/\.(KS|KQ)$/.test(symbol) ? 'KRW' : 'USD'), updatedAt: s?.time || indexCache?.updatedAt };
  },

  async candles(symbol, interval) {
    await index();
    const src = interval === '4h' ? '1h' : interval;
    const f = await fetchJSON(`${BASE}${fileName(symbol)}/${src}.json?t=${Math.floor(Date.now() / 60000)}`, { retries: 0 }).catch(() => null);
    if (!f) throw new Error('아직 받아 둔 데이터가 없습니다 (config/stocks.json에 있는지, 수집이 돌았는지 확인)');
    const bars = f.candles.map((c) => ({ time: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] }));
    return interval === '4h' ? to4h(bars, f.gmtoffset) : bars;
  },

  async search(q) {
    const { stocks: list = [] } = await index();
    const Q = q.trim().toUpperCase();
    if (!Q) return list.map((s) => ({ key: `stock:${s.symbol}`, symbol: s.symbol, name: s.name, sub: s.symbol }));
    return list
      .filter((s) => s.symbol.toUpperCase().includes(Q) || s.name.includes(q.trim()))
      .map((s) => ({ key: `stock:${s.symbol}`, symbol: s.symbol, name: s.name, sub: s.symbol }));
  },

  async quotes(symbols, force) {
    const { stocks: list = [] } = await index(force);
    const out = {};
    for (const s of list) if (symbols.includes(s.symbol)) out[s.symbol] = { price: s.price, changePct: s.changePct, asOf: s.time };
    return out;
  },
};
