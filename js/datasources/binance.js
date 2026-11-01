// Binance 공개 시세 (data-api.binance.vision — 키 없이, 브라우저에서 직접 호출 가능)
import { fetchJSON } from '../util.js';
import { ReconnectingSocket } from './socket.js';

const REST = 'https://data-api.binance.vision/api/v3';
const WS = 'wss://data-stream.binance.vision';
const QUOTES = ['USDT', 'FDUSD', 'USDC', 'TUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY', 'BRL', 'JPY', 'DAI'];
const IV = { '1m': '1m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w' };

const toBar = (k) => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] });

function splitPair(sym) {
  for (const q of QUOTES) if (sym.endsWith(q) && sym.length > q.length) return [sym.slice(0, -q.length), q];
  return [sym, ''];
}

let symbolCache = null;

export const binance = {
  id: 'binance',
  label: '바이낸스',
  intervals: Object.keys(IV),
  realtime: true,
  history: true,

  info(symbol) {
    const [base, quote] = splitPair(symbol);
    return { name: quote ? `${base}/${quote}` : symbol, currency: quote === 'USDT' ? 'USD' : quote };
  },

  async candles(symbol, interval, { end, limit = 1000 } = {}) {
    let url = `${REST}/klines?symbol=${symbol}&interval=${IV[interval]}&limit=${limit}`;
    if (end) url += `&endTime=${Math.floor(end * 1000) - 1}`; // end보다 앞의 캔들만
    const rows = await fetchJSON(url);
    return rows.map(toBar);
  },

  subscribe(symbol, interval, onBar) {
    const sock = new ReconnectingSocket(`${WS}/ws/${symbol.toLowerCase()}@kline_${IV[interval]}`, {
      name: 'binance-kline',
      onMessage: (m) => {
        const k = m.k;
        if (!k) return;
        onBar({ time: k.t / 1000, open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v });
      },
    });
    return () => sock.close();
  },

  async symbols() {
    if (!symbolCache) {
      const rows = await fetchJSON(`${REST}/ticker/price`);
      symbolCache = rows.map((r) => r.symbol);
    }
    return symbolCache;
  },

  async search(q) {
    const list = await this.symbols();
    const Q = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!Q) return [];
    const hits = list.filter((s) => s.includes(Q));
    hits.sort((a, b) => (b.startsWith(Q) - a.startsWith(Q)) || (b.endsWith('USDT') - a.endsWith('USDT')) || a.length - b.length);
    return hits.slice(0, 40).map((s) => ({ key: `binance:${s}`, symbol: s, name: this.info(s).name, sub: '' }));
  },

  async quotes(symbols) {
    if (!symbols.length) return {};
    const rows = await fetchJSON(`${REST}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}&type=MINI`);
    const out = {};
    for (const r of rows) {
      const price = +r.lastPrice, open = +r.openPrice;
      out[r.symbol] = { price, changePct: open ? ((price - open) / open) * 100 : null };
    }
    return out;
  },

  // 관심종목 실시간: 1초마다 오는 24시간 요약
  subscribeQuotes(symbols, onQuote) {
    if (!symbols.length) return () => {};
    const streams = symbols.map((s) => `${s.toLowerCase()}@miniTicker`).join('/');
    const sock = new ReconnectingSocket(`${WS}/stream?streams=${streams}`, {
      name: 'binance-mini',
      onMessage: (m) => {
        const d = m.data;
        if (!d) return;
        const price = +d.c, open = +d.o;
        onQuote(d.s, { price, changePct: open ? ((price - open) / open) * 100 : null });
      },
    });
    return () => sock.close();
  },
};
