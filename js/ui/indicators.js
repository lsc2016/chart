// 지표 설정 판
import { el, uid } from '../util.js';
import { openSheet } from './sheet.js';
import { DEFAULT_INDICATORS } from '../config.js';

const num = (value, onchange, { min = 1, max = 500, step = 1 } = {}) =>
  el('input', { type: 'number', inputmode: 'decimal', value, min, max, step, class: 'num', onchange: (e) => onchange(e.target.value) });

const toggle = (on, onchange) => {
  const i = el('input', { type: 'checkbox', checked: on, onchange: (e) => onchange(e.target.checked) });
  return el('label', { class: 'switch' }, i, el('span'));
};

const color = (value, onchange) => el('input', { type: 'color', value, class: 'color', onchange: (e) => onchange(e.target.value) });

export function openIndicators({ getCfg, setCfg }) {
  const body = el('div', { class: 'ind' });
  const apply = (fn) => { const c = getCfg(); fn(c); setCfg(c); render(); };

  function render() {
    const c = getCfg();
    const maRows = c.mas.map((m, idx) => el('div', { class: 'ind-row' },
      toggle(m.on, (v) => apply((x) => (x.mas[idx].on = v))),
      el('select', { onchange: (e) => apply((x) => (x.mas[idx].type = e.target.value)) },
        el('option', { value: 'SMA', selected: m.type === 'SMA', text: 'MA (단순)' }),
        el('option', { value: 'EMA', selected: m.type === 'EMA', text: 'EMA (지수)' })),
      el('span', { class: 'lbl', text: '기간' }), num(m.period, (v) => apply((x) => (x.mas[idx].period = Math.max(1, Math.round(+v) || 1)))),
      color(m.color, (v) => apply((x) => (x.mas[idx].color = v))),
      el('button', { class: 'icon-btn sm danger', 'aria-label': '빼기', text: '✕', onclick: () => apply((x) => x.mas.splice(idx, 1)) })));

    body.replaceChildren(
      el('section', {},
        el('h3', { text: '이동평균' }),
        el('p', { class: 'hint', text: '정해진 기간의 평균 가격을 이은 선. EMA는 최근 값에 더 무게를 둡니다.' }),
        ...maRows,
        el('button', { class: 'text-btn', text: '＋ 이동평균 추가', onclick: () => apply((x) => x.mas.push({ id: 'ma' + uid(), type: 'SMA', period: 120, color: '#e07a5f', on: true })) })),
      el('section', {},
        el('h3', {}, '볼린저밴드 ', toggle(c.bb.on, (v) => apply((x) => (x.bb.on = v)))),
        el('p', { class: 'hint', text: '평균선 위아래로 가격이 흔들리는 폭(표준편차 × 배수)을 그린 띠.' }),
        el('div', { class: 'ind-row' },
          el('span', { class: 'lbl', text: '기간' }), num(c.bb.period, (v) => apply((x) => (x.bb.period = +v))),
          el('span', { class: 'lbl', text: '배수' }), num(c.bb.mult, (v) => apply((x) => (x.bb.mult = +v)), { min: 0.5, max: 5, step: 0.5 }),
          color(c.bb.color, (v) => apply((x) => (x.bb.color = v))))),
      el('section', {},
        el('h3', {}, '거래량 ', toggle(c.volume.on, (v) => apply((x) => (x.volume.on = v)))),
        el('p', { class: 'hint', text: '캔들 아래쪽에 막대로 표시합니다.' })),
      el('section', {},
        el('h3', {}, 'RSI ', toggle(c.rsi.on, (v) => apply((x) => (x.rsi.on = v)))),
        el('p', { class: 'hint', text: '0~100 사이 값. 보통 70 이상이면 많이 오른 상태(과매수), 30 이하면 많이 내린 상태(과매도)로 봅니다.' }),
        el('div', { class: 'ind-row' },
          el('span', { class: 'lbl', text: '기간' }), num(c.rsi.period, (v) => apply((x) => (x.rsi.period = +v))),
          el('span', { class: 'lbl', text: '위' }), num(c.rsi.upper, (v) => apply((x) => (x.rsi.upper = +v)), { max: 100 }),
          el('span', { class: 'lbl', text: '아래' }), num(c.rsi.lower, (v) => apply((x) => (x.rsi.lower = +v)), { max: 100 }))),
      el('section', {},
        el('h3', {}, 'MACD ', toggle(c.macd.on, (v) => apply((x) => (x.macd.on = v)))),
        el('p', { class: 'hint', text: '짧은 평균과 긴 평균의 차이(MACD선)와 그 평균(시그널선). 막대는 둘의 차이입니다.' }),
        el('div', { class: 'ind-row' },
          el('span', { class: 'lbl', text: '짧게' }), num(c.macd.fast, (v) => apply((x) => (x.macd.fast = +v))),
          el('span', { class: 'lbl', text: '길게' }), num(c.macd.slow, (v) => apply((x) => (x.macd.slow = +v))),
          el('span', { class: 'lbl', text: '시그널' }), num(c.macd.signal, (v) => apply((x) => (x.macd.signal = +v))))),
      el('button', { class: 'text-btn muted', text: '기본값으로 되돌리기', onclick: () => { setCfg(structuredClone(DEFAULT_INDICATORS)); render(); } }),
    );
  }
  render();
  openSheet('지표', body);
}
