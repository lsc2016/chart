// 실제 브라우저(Chromium)로 앱을 열어 실제 시세가 뜨는지 확인
// 사용: node tools/smoke.mjs http://localhost:8000/
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8000/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', (e) => problems.push(e.message));
let wsMsgs = 0;
page.on('websocket', (ws) => ws.on('framereceived', () => wsMsgs++));

const check = async (hash, label) => {
  await page.goto(BASE + hash);
  await page.waitForTimeout(6000);
  const r = await page.evaluate(() => ({
    name: document.querySelector('#symName').textContent,
    price: document.querySelector('#symPrice').textContent,
    chg: document.querySelector('#symChg').textContent,
    bars: window.chartApp.view.bars.length,
    status: document.querySelector('#status').hidden ? '' : document.querySelector('#status').textContent,
  }));
  console.log(`${label}: ${JSON.stringify(r)}`);
  await page.screenshot({ path: `smoke-${label}.png` });
  return r;
};
const results = [
  await check('#/binance/BTCUSDT/1h', 'binance'),
  await check('#/upbit/KRW-BTC/15m', 'upbit'),
  await check('#/stock/AAPL/1d', 'stock-us'),
  await check('#/stock/005930.KS/4h', 'stock-kr'),
];
console.log('WebSocket 메시지 수:', wsMsgs);
console.log('오류:', problems.length ? problems : '없음');
await browser.close();
if (results.some((r) => !r.bars) || problems.length) process.exit(1);
