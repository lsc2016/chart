// 실시간(WebSocket) 시험: 몇 초 안에 메시지가 오는지
const tests = [
  ['binance ws', 'wss://stream.binance.com:9443/ws/btcusdt@kline_1m', null],
  ['binance.vision ws', 'wss://data-stream.binance.vision/ws/btcusdt@kline_1m', null],
  ['upbit ws', 'wss://api.upbit.com/websocket/v1', JSON.stringify([{ticket:'t'},{type:'ticker',codes:['KRW-BTC']}])],
  ['bybit ws', 'wss://stream.bybit.com/v5/public/spot', JSON.stringify({op:'subscribe',args:['kline.1.BTCUSDT']})],
];
for (const [name, url, sub] of tests) {
  const r = await new Promise((res) => {
    let done = false; const fin = (m) => { if (!done) { done = true; try { ws.close(); } catch {} res(m); } };
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { if (sub) ws.send(sub); };
    ws.onmessage = (e) => { const d = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data); fin('OK 메시지: ' + d.slice(0, 150)); };
    ws.onerror = (e) => fin('ERROR ' + (e.message || ''));
    ws.onclose = (e) => fin('CLOSED code=' + e.code);
    setTimeout(() => fin('TIMEOUT 8s'), 8000);
  });
  console.log(`### ${name}\n${url}\n${r}\n`);
}
