// Upbit 공개 시세 (원화 마켓) — 키 없이, 브라우저에서 직접 호출 가능
import { fetchJSON, sleep, bucketStart } from '../util.js';
import { INTERVAL_SEC } from '../config.js';
import { ReconnectingSocket } from './socket.js';

const REST = 'https://api.upbit.com/v1';
const WS = 'wss://api.upbit.com/websocket/v1';
const PATH = { '1m': 'minutes/1', '15m': 'minutes/15', '1h': 'minutes/60', '4h': 'minutes/240', '1d': 'days', '1w': 'weeks' };

// Upbit는 1초에 몇 번만 허용 → 요청 사이 간격을 둔다
let last = 0;
async function call(url) {
  const wait = last + 150 - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  // 호출 제한(429)에 걸리면 응답에 허용 표시가 빠져 브라우저엔 'Failed to fetch'로 보임 → 간격을 늘려 다시 시도
  try {
    return await fetchJSON(url, { retries: 3, backoff: 1000 });
  } catch (e) {
    throw new Error(/fetch|429/i.test(e.message) ? '업비트가 응답하지 않습니다 (잠깐 호출 제한일 수 있음)' : e.message);
  }
}

const toBar = (c) => ({
  time: Date.parse(c.candle_date_time_utc + 'Z') / 1000,
  open: c.opening_price, high: c.high_price, low: c.low_price, close: c.trade_price,
  volume: c.candle_acc_trade_volume,
});

let marketCache = null;

export const upbit = {
  id: 'upbit',
  label: '업비트',
  intervals: Object.keys(PATH),
  realtime: true,
  history: true,

  info(symbol) {
    const m = marketCache?.find((x) => x.market === symbol);
    const [quote, base] = symbol.split('-');
    return { name: m ? `${m.korean_name}` : `${base}/${quote}`, sub: `${base}/${quote}`, currency: quote };
  },

  // 한 번에 200개까지 → 필요한 만큼 이어 받기
  async candles(symbol, interval, { end, limit = 400 } = {}) {
    let out = [];
    let to = end ? end : null;
    while (out.length < limit) {
      let url = `${REST}/candles/${PATH[interval]}?market=${symbol}&count=200`;
      if (to) url += `&to=${new Date(to * 1000).toISOString().replace(/\.\d+Z$/, 'Z')}`;
      const rows = await call(url);
      if (!rows.length) break;
      const bars = rows.map(toBar).reverse();
      out = [...bars, ...out];
      if (rows.length < 200) break;
      to = bars[0].time;
    }
    return out;
  },

  // 체결 내역으로 캔들을 직접 갱신
  subscribe(symbol, interval, onBar) {
    const ivSec = INTERVAL_SEC[interval];
    let cur = null;
    const sock = new ReconnectingSocket(WS, {
      name: 'upbit-trade',
      onOpen: () => sock.send([{ ticket: 'chart-' + Date.now() }, { type: 'trade', codes: [symbol] }, { format: 'DEFAULT' }]),
      onMessage: (m) => {
        if (m.type !== 'trade') return;
        const t = bucketStart(m.trade_timestamp / 1000, ivSec);
        const p = m.trade_price, v = m.trade_volume;
        if (!cur || t > cur.time) cur = { time: t, open: p, high: p, low: p, close: p, volume: v, fresh: true };
        else if (t === cur.time) {
          cur.high = Math.max(cur.high, p); cur.low = Math.min(cur.low, p); cur.close = p; cur.volume += v;
        } else return;
        onBar({ ...cur });
      },
    });
    return () => sock.close();
  },

  async markets() {
    if (!marketCache) marketCache = await call(`${REST}/market/all?isDetails=false`);
    return marketCache;
  },

  async search(q) {
    const list = await this.markets();
    const Q = q.trim().toUpperCase();
    if (!Q) return [];
    const hits = list.filter((m) => m.market.includes(Q) || m.korean_name.includes(q.trim()) || m.english_name.toUpperCase().includes(Q));
    hits.sort((a, b) => (b.market.startsWith('KRW') - a.market.startsWith('KRW')));
    return hits.slice(0, 40).map((m) => ({ key: `upbit:${m.market}`, symbol: m.market, name: m.korean_name, sub: m.market }));
  },

  async quotes(symbols) {
    if (!symbols.length) return {};
    const rows = await call(`${REST}/ticker?markets=${symbols.join(',')}`);
    const out = {};
    for (const r of rows) out[r.market] = { price: r.trade_price, changePct: r.signed_change_rate * 100 };
    return out;
  },

  subscribeQuotes(symbols, onQuote) {
    if (!symbols.length) return () => {};
    const sock = new ReconnectingSocket(WS, {
      name: 'upbit-ticker',
      onOpen: () => sock.send([{ ticket: 'chart-q-' + Date.now() }, { type: 'ticker', codes: symbols }, { format: 'DEFAULT' }]),
      onMessage: (m) => {
        if (m.type === 'ticker') onQuote(m.code, { price: m.trade_price, changePct: m.signed_change_rate * 100 });
      },
    });
    return () => sock.close();
  },
};
