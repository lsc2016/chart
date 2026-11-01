// 앱 전체에서 쓰는 고정값
export const APP_NAME = 'chart';

// 시간 단위: id → 초
export const INTERVALS = [
  { id: '1m', label: '1분', sec: 60 },
  { id: '15m', label: '15분', sec: 900 },
  { id: '1h', label: '1시간', sec: 3600 },
  { id: '4h', label: '4시간', sec: 14400 },
  { id: '1d', label: '1일', sec: 86400 },
  { id: '1w', label: '1주', sec: 604800 },
];
export const INTERVAL_SEC = Object.fromEntries(INTERVALS.map((i) => [i.id, i.sec]));
export const isIntraday = (iv) => INTERVAL_SEC[iv] < 86400;

export const DEFAULT_INTERVAL = '1h';

export const DEFAULT_WATCHLIST = [
  'binance:BTCUSDT',
  'binance:ETHUSDT',
  'upbit:KRW-BTC',
  'stock:AAPL',
  'stock:NVDA',
  'stock:005930.KS',
];

export const COLOR_SCHEMES = {
  kr: { up: '#f04452', down: '#3182f6', label: '한국식 (오름 빨강 · 내림 파랑)' },
  intl: { up: '#26a69a', down: '#ef5350', label: '해외식 (오름 초록 · 내림 빨강)' },
};

export const DEFAULT_INDICATORS = {
  version: 1,
  mas: [
    { id: 'ma1', type: 'SMA', period: 20, color: '#f5c542', on: true },
    { id: 'ma2', type: 'SMA', period: 60, color: '#b06cf0', on: true },
    { id: 'ma3', type: 'EMA', period: 12, color: '#3fd0c9', on: false },
  ],
  bb: { on: false, period: 20, mult: 2, color: '#8a9bb4' },
  volume: { on: true },
  rsi: { on: false, period: 14, upper: 70, lower: 30, color: '#c792ea' },
  macd: { on: false, fast: 12, slow: 26, signal: 9 },
};
