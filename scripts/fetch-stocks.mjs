// 주식 시세 수집 (GitHub Actions가 실행). config/stocks.json의 종목을 Yahoo Finance에서 받아 data/stocks/에 저장
// 실행: node scripts/fetch-stocks.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'data/stocks');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'config/stocks.json'), 'utf8'));

// 앱의 시간 단위 → Yahoo 요청값 (Yahoo는 15분봉 최근 60일, 1시간봉 최근 730일까지만 줌)
const PLAN = {
  '15m': { interval: '15m', range: '60d' },
  '1h': { interval: '60m', range: '730d' },
  '1d': { interval: '1d', range: '10y' },
  '1w': { interval: '1wk', range: 'max' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fileName = (s) => s.replace(/[^A-Za-z0-9._-]/g, '_');
const round = (v, d) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

async function yahoo(symbol, interval, range) {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastErr;
  for (let i = 0; i < 4; i++) {
    const url = `https://${hosts[i % 2]}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; chart-app-fetcher)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const r = j.chart?.result?.[0];
      if (!r) throw new Error(j.chart?.error?.description || '결과 없음');
      return r;
    } catch (e) {
      lastErr = e;
      await sleep(1000 * (i + 1));
    }
  }
  throw lastErr;
}

function toCandles(r, iv) {
  const ts = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
  const off = r.meta.gmtoffset || 0;
  const daily = iv === '1d' || iv === '1w';
  const dec = r.meta.currency === 'KRW' ? 0 : 4;
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.open[i] == null || q.close[i] == null) continue;
    // 일·주봉은 거래소 날짜의 00:00 UTC로 맞춤 (화면에서 날짜가 하루 밀리지 않게)
    const t = daily ? Math.floor((ts[i] + off) / 86400) * 86400 : ts[i];
    const row = [t, round(q.open[i], dec), round(q.high[i], dec), round(q.low[i], dec), round(q.close[i], dec), q.volume[i] || 0];
    if (out.length && out[out.length - 1][0] === t) out[out.length - 1] = row; // 같은 시각이 두 번 오면 나중 것
    else out.push(row);
  }
  return out;
}

await mkdir(OUT, { recursive: true });
const indexPath = path.join(OUT, 'index.json');
const prevIndex = existsSync(indexPath) ? JSON.parse(await readFile(indexPath, 'utf8')) : { stocks: [] };
const intervals = (cfg.intervals || Object.keys(PLAN)).filter((i) => PLAN[i]);
const index = [];
let ok = 0, fail = 0;

for (const s of cfg.stocks) {
  const dir = path.join(OUT, fileName(s.symbol));
  await mkdir(dir, { recursive: true });
  let entry = prevIndex.stocks.find((x) => x.symbol === s.symbol) || {};
  entry = { ...entry, symbol: s.symbol, name: s.name, market: s.market };
  for (const iv of intervals) {
    try {
      const r = await yahoo(s.symbol, PLAN[iv].interval, PLAN[iv].range);
      const candles = toCandles(r, iv);
      if (!candles.length) throw new Error('캔들 없음');
      await writeFile(path.join(dir, `${iv}.json`), JSON.stringify({ symbol: s.symbol, interval: iv, gmtoffset: r.meta.gmtoffset || 0, currency: r.meta.currency, candles }));
      if (iv === '1d') {
        const m = r.meta;
        const price = m.regularMarketPrice ?? candles.at(-1)[4];
        const lastDay = Math.floor(((m.regularMarketTime || 0) + (m.gmtoffset || 0)) / 86400) * 86400;
        const prev = candles.at(-1)[0] === lastDay ? candles.at(-2)?.[4] : candles.at(-1)[4];
        entry = { ...entry, currency: m.currency, price, prevClose: prev, changePct: prev ? round(((price - prev) / prev) * 100, 2) : null, time: m.regularMarketTime };
      }
      ok++;
      console.log(`✓ ${s.symbol} ${iv} (${candles.length}개)`);
    } catch (e) {
      fail++;
      console.log(`✗ ${s.symbol} ${iv}: ${e.message} — 이전 파일 유지`);
    }
    await sleep(400);
  }
  index.push(entry);
}

await writeFile(indexPath, JSON.stringify({ updatedAt: new Date().toISOString(), intervals, stocks: index }, null, 1));
console.log(`완료: 성공 ${ok}, 실패 ${fail}`);
if (ok === 0 && cfg.stocks.length) process.exit(1);
