// 종목 검색
import { el, debounce } from '../util.js';
import { searchAll, describe } from '../datasources/index.js';
import { openSheet, closeSheet } from './sheet.js';

export function openSearch({ onPick, watchlist }) {
  const input = el('input', { class: 'search-input', type: 'search', placeholder: '종목 검색 — 예: BTC, 비트코인, AAPL, 삼성', autocomplete: 'off', autocapitalize: 'characters', enterkeyhint: 'search' });
  const list = el('div', { class: 'search-list' });
  const pick = (key) => { closeSheet(); onPick(key); };

  const row = (r) => el('button', { class: 'search-row', onclick: () => pick(r.key) },
    el('span', { class: 'sr-name', text: r.name }),
    el('span', { class: 'sr-sub', text: r.sub || r.symbol }),
    el('span', { class: 'badge', text: r.source }));

  const showDefault = async () => {
    list.replaceChildren(el('div', { class: 'muted pad', text: '관심종목' }),
      ...watchlist.map((k) => { const d = describe(k); return row({ key: k, name: d.name, sub: d.sub, source: d.sourceLabel }); }));
    const stocks = (await searchAll('')).filter((r) => r.key.startsWith('stock:'));
    if (stocks.length) list.append(el('div', { class: 'muted pad', text: '받아 두는 주식 (config/stocks.json)' }), ...stocks.map(row));
  };

  let seq = 0;
  const run = debounce(async () => {
    const q = input.value.trim();
    const my = ++seq;
    if (!q) return showDefault();
    list.replaceChildren(el('div', { class: 'muted pad', text: '찾는 중…' }));
    const res = await searchAll(q);
    if (my !== seq) return;
    list.replaceChildren(...(res.length ? res.map(row) : [el('div', { class: 'muted pad', text: '찾는 종목이 없습니다. 주식은 config/stocks.json에 적어 둔 것만 나옵니다.' })]));
  }, 250);

  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const first = list.querySelector('.search-row'); if (first) first.click(); }
  });
  openSheet('종목 검색', el('div', { class: 'search' }, input, list));
  showDefault();
  setTimeout(() => input.focus(), 50);
}
