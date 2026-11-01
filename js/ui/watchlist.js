// 관심종목 목록: 현재가·등락률, 누르면 차트 전환, 편집(순서·삭제)
import { el, fmtPrice, fmtPct, fmtTime } from '../util.js';
import { describe } from '../datasources/index.js';
import { quotes } from '../quotes.js';
import { store } from '../storage.js';

export class Watchlist {
  constructor(root, { onPick, getCurrent, onListChange }) {
    this.root = root;
    this.onPick = onPick;
    this.getCurrent = getCurrent;
    this.onListChange = onListChange;
    this.editing = false;
    this.rows = new Map();
    quotes.on((key, q) => this._paint(key, q));
    this.render();
  }

  get list() { return store.getWatchlist(); }
  set list(v) { store.setWatchlist(v); this.onListChange?.(v); this.render(); }

  has(key) { return this.list.includes(key); }
  toggle(key) { this.list = this.has(key) ? this.list.filter((k) => k !== key) : [...this.list, key]; }

  move(key, dir) {
    const l = this.list, i = l.indexOf(key), j = i + dir;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    this.list = l;
  }

  render() {
    const cur = this.getCurrent();
    this.rows.clear();
    const head = el('div', { class: 'watch-head' },
      el('h2', { text: '관심종목' }),
      el('button', { class: 'text-btn', text: this.editing ? '완료' : '편집', onclick: () => { this.editing = !this.editing; this.render(); } }));
    const items = this.list.map((key) => {
      const d = describe(key);
      const price = el('span', { class: 'w-price' }), chg = el('span', { class: 'w-chg' });
      const tools = this.editing
        ? el('span', { class: 'w-tools' },
          el('button', { class: 'icon-btn sm', 'aria-label': '위로', text: '↑', onclick: (e) => { e.stopPropagation(); this.move(key, -1); } }),
          el('button', { class: 'icon-btn sm', 'aria-label': '아래로', text: '↓', onclick: (e) => { e.stopPropagation(); this.move(key, 1); } }),
          el('button', { class: 'icon-btn sm danger', 'aria-label': '빼기', text: '✕', onclick: (e) => { e.stopPropagation(); this.toggle(key); } }))
        : null;
      const row = el('div', { class: 'w-row' + (key === cur ? ' active' : ''), role: 'button', tabindex: 0, onclick: () => !this.editing && this.onPick(key),
        onkeydown: (e) => { if (e.key === 'Enter') this.onPick(key); } },
      el('span', { class: 'w-name' }, el('b', { text: d.name }), el('small', { text: `${d.sourceLabel} · ${d.sub}` })),
      tools || el('span', { class: 'w-q' }, price, chg));
      this.rows.set(key, { row, price, chg, currency: d.currency, sub: row.querySelector('small'), d });
      this._paint(key, quotes.get(key));
      return row;
    });
    const cur0 = this.getCurrent();
    const add = cur0 && !this.has(cur0)
      ? el('button', { class: 'add-btn', text: `＋ ${describe(cur0).name} 추가`, onclick: () => this.toggle(cur0) })
      : null;
    this.root.replaceChildren(...[head, el('div', { class: 'watch-list' }, items.length ? items : el('p', { class: 'muted pad', text: '비어 있습니다. 차트 위 ☆를 눌러 추가하세요.' })), add].filter(Boolean));
  }

  _paint(key, q) {
    const r = this.rows.get(key);
    if (!r || !q) return;
    r.price.textContent = fmtPrice(q.price, r.currency);
    r.chg.textContent = fmtPct(q.changePct);
    r.chg.className = 'w-chg ' + (q.changePct > 0 ? 'up' : q.changePct < 0 ? 'down' : '');
    if (q.asOf && r.sub) r.sub.textContent = `${r.d.sourceLabel} · ${fmtTime(q.asOf)} 기준`;
  }
}
