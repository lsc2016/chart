// 출처 모음. 종목 열쇠 형식: "출처:기호" (예: binance:BTCUSDT, upbit:KRW-BTC, stock:AAPL)
import { binance } from './binance.js';
import { upbit } from './upbit.js';
import { stocks } from './stocks.js';

export const SOURCES = { binance, upbit, stock: stocks };

export function parseKey(key) {
  const i = key.indexOf(':');
  const source = SOURCES[key.slice(0, i)];
  return source ? { source, symbol: key.slice(i + 1), key } : null;
}

export function describe(key) {
  const p = parseKey(key);
  if (!p) return { name: key, sub: '', currency: '' };
  const info = p.source.info(p.symbol);
  return { ...info, sub: info.sub || p.symbol, sourceLabel: p.source.label };
}

export async function searchAll(q) {
  const tasks = Object.values(SOURCES).map((s) => s.search(q).then((r) => r.map((x) => ({ ...x, source: s.label }))).catch(() => []));
  const res = await Promise.all(tasks);
  return res.flat();
}
