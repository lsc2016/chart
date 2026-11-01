// 현재가·등락률 모음: 관심종목 + 지금 보는 종목. 코인은 실시간, 주식은 5분마다 파일 확인
import { SOURCES, parseKey } from './datasources/index.js';
import { debounce } from './util.js';

const data = new Map(); // key → {price, changePct, asOf}
const listeners = new Set();
let keys = [];
let unsubs = [];
let stockTimer = null;

function emit(key, q) {
  data.set(key, { ...data.get(key), ...q });
  listeners.forEach((fn) => fn(key, data.get(key)));
}

export const quotes = {
  get: (key) => data.get(key),
  on: (fn) => listeners.add(fn),
  setKeys: debounce((list) => {
    const next = [...new Set(list)].sort();
    if (next.join('|') === keys.join('|')) return;
    keys = next;
    restart();
  }, 300),
};

function restart() {
  unsubs.forEach((u) => u());
  unsubs = [];
  clearInterval(stockTimer);
  const bySrc = {};
  for (const k of keys) {
    const p = parseKey(k);
    if (p) (bySrc[p.source.id] ||= []).push(p.symbol);
  }
  for (const [id, syms] of Object.entries(bySrc)) {
    const src = SOURCES[id];
    const pull = (force) => src.quotes(syms, force).then((r) => Object.entries(r).forEach(([s, q]) => emit(`${id}:${s}`, q))).catch(() => {});
    pull();
    if (src.subscribeQuotes) unsubs.push(src.subscribeQuotes(syms, (s, q) => emit(`${id}:${s}`, q)));
    else stockTimer = setInterval(() => pull(true), 5 * 60 * 1000);
  }
}
