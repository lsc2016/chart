// 설정: 색, 내보내기·불러오기, 데이터 출처·라이선스 안내
import { el, toast } from '../util.js';
import { openSheet, closeSheet } from './sheet.js';
import { COLOR_SCHEMES } from '../config.js';
import { exportAll, importAll } from '../storage.js';
import { stocks } from '../datasources/stocks.js';

export function openSettings({ prefs, setPrefs, onImported }) {
  const fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  let importMode = 'merge';
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    try {
      importAll(JSON.parse(await f.text()), importMode);
      toast(importMode === 'replace' ? '설정을 덮어썼습니다' : '설정을 합쳤습니다');
      closeSheet();
      onImported();
    } catch (e) {
      toast('불러오기 실패: ' + e.message);
    }
    fileInput.value = '';
  });

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `chart-설정-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const colorRadios = Object.entries(COLOR_SCHEMES).map(([id, s]) => el('label', { class: 'radio' },
    el('input', { type: 'radio', name: 'colors', value: id, checked: prefs.colors === id, onchange: () => setPrefs({ colors: id }) }),
    el('span', { class: 'swatch', style: { background: s.up } }), el('span', { class: 'swatch', style: { background: s.down } }),
    el('span', { text: s.label })));

  const stockInfo = el('p', { class: 'hint', text: '주식 데이터 확인 중…' });
  stocks.index(true).then((i) => {
    stockInfo.textContent = i.updatedAt
      ? `주식 시세 마지막 수집: ${new Date(i.updatedAt).toLocaleString('ko-KR')} (${i.stocks.length}종목)`
      : '아직 수집된 주식 데이터가 없습니다.';
  });

  const body = el('div', { class: 'settings' },
    el('section', {}, el('h3', { text: '오름·내림 색' }), ...colorRadios),
    el('section', {},
      el('h3', { text: '설정 옮기기 (맥북 ↔ 폰)' }),
      el('p', { class: 'hint', text: '관심종목·지표·그린 선·메모는 이 기기의 브라우저에만 저장됩니다. 다른 기기로 옮기려면 파일로 내보낸 뒤 그 기기에서 불러오세요 (AirDrop·iCloud 드라이브·메일 등으로 전달).' }),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', text: '⤓ 내보내기', onclick: doExport }),
        el('button', { class: 'btn', text: '⤒ 불러오기 (합치기)', onclick: () => { importMode = 'merge'; fileInput.click(); } }),
        el('button', { class: 'btn ghost', text: '⤒ 불러오기 (덮어쓰기)', onclick: () => { if (confirm('지금 기기의 설정을 모두 지우고 파일 내용으로 바꿉니다. 계속할까요?')) { importMode = 'replace'; fileInput.click(); } } })),
      fileInput),
    el('section', {},
      el('h3', { text: '데이터 출처' }),
      el('ul', { class: 'hint' },
        el('li', { text: '코인(바이낸스): data-api.binance.vision — 실시간' }),
        el('li', { text: '코인(업비트 원화): api.upbit.com — 실시간' }),
        el('li', { text: '주식(미국·한국): Yahoo Finance 시세를 GitHub Actions가 장중 30분마다 받아 둔 파일 — 실시간 아님, 15~20분 늦을 수 있음' })),
      stockInfo),
    el('section', {},
      el('h3', { text: '라이선스' }),
      el('p', { class: 'hint' },
        'Charts by ', el('a', { href: 'https://www.tradingview.com/', target: '_blank', rel: 'noopener', text: 'TradingView' }),
        ' Lightweight Charts™ — Copyright (c) 2025 TradingView, Inc. Apache License 2.0. ',
        el('a', { href: 'vendor/lightweight-charts/LICENSE', target: '_blank', text: '라이선스 전문' }), ' · ',
        el('a', { href: 'vendor/lightweight-charts/NOTICE', target: '_blank', text: 'NOTICE' }))),
  );
  openSheet('설정', body);
}
