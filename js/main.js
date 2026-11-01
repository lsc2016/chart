// 시작점: 화면 조립, 주소(#/출처/기호/시간단위) 처리, 데이터 연결
import { INTERVALS, COLOR_SCHEMES, DEFAULT_WATCHLIST } from './config.js';
import { $, $$, el, fmtPrice, fmtPct, fmtTime, toast } from './util.js';
import { store } from './storage.js';
import { parseKey, describe, SOURCES } from './datasources/index.js';
import { ChartView } from './chart/chartView.js';
import { DrawingManager } from './drawings/manager.js';
import { quotes } from './quotes.js';
import { Watchlist } from './ui/watchlist.js';
import { openSearch } from './ui/search.js';
import { openIndicators } from './ui/indicators.js';
import { openSettings } from './ui/settings.js';
import { closeSheet, sheetOpen } from './ui/sheet.js';

const HOME_INTERVAL = '1h';
const FALLBACK_KEY = 'binance:BTCUSDT';

const prefs = store.getPrefs();
const state = { key: null, interval: prefs.interval, loaded: false };
let loadSeq = 0, unsubRT = null, loadingMore = false, exhausted = false, hiddenAt = 0;

// ── 색 ────────────────────────────────────
function applyColors() {
  const c = COLOR_SCHEMES[prefs.colors] || COLOR_SCHEMES.kr;
  document.documentElement.style.setProperty('--up', c.up);
  document.documentElement.style.setProperty('--down', c.down);
  return c;
}

// ── 차트·그리기·관심종목 ────────────────────
const view = new ChartView($('#chart'), { colors: applyColors() });
view.setIndicators(store.getIndicators());
const drawings = new DrawingManager(view, { onChange: paintDrawbar });
window.chartApp = { view, drawings }; // 브라우저 개발자 도구에서 살펴보기용
const watch = new Watchlist($('#watch'), {
  onPick: (key) => { setWatchOpen(false, true); navigate(key, state.interval); },
  getCurrent: () => state.key,
  onListChange: () => { syncQuoteKeys(); paintHeader(); },
});

function syncQuoteKeys() { quotes.setKeys([...store.getWatchlist(), state.key].filter(Boolean)); }
quotes.on((key) => { if (key === state.key) paintHeader(); });

// ── 주소 처리 ────────────────────────────────
function hashFor(key, iv) {
  const p = parseKey(key);
  return `#/${p.source.id}/${encodeURIComponent(p.symbol)}/${iv}`;
}

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const key = `${parts[0]}:${decodeURIComponent(parts[1])}`;
  return parseKey(key) ? { key, interval: parts[2] } : null;
}

function validInterval(key, iv) {
  const src = parseKey(key).source;
  if (src.intervals.includes(iv)) return iv;
  return src.intervals.includes(HOME_INTERVAL) ? HOME_INTERVAL : src.intervals[0];
}

function navigate(key, interval, { replace = false } = {}) {
  const iv = validInterval(key, interval);
  const h = hashFor(key, iv);
  if (location.hash === h) return load(key, iv);
  if (replace) { history.replaceState(null, '', h); load(key, iv); } else location.hash = h;
}

function route() {
  const r = parseHash();
  if (!r) return goHome();
  const iv = validInterval(r.key, r.interval);
  if (iv !== r.interval) return navigate(r.key, iv, { replace: true });
  if (r.key === state.key && iv === state.interval && state.loaded) return;
  load(r.key, iv);
}
window.addEventListener('hashchange', route);

// 로고: 첫 화면 = 관심종목 첫 종목 · 1시간봉 · 차트 위치 초기화, 열린 판 닫기
function goHome() {
  closeSheet();
  setWatchOpen(false, true);
  setDrawOpen(false);
  drawings.setMode('cursor');
  const key = store.getWatchlist().find((k) => parseKey(k)) || FALLBACK_KEY;
  state.loaded = false;
  navigate(key, HOME_INTERVAL, { replace: true });
}
$('#logo').addEventListener('click', (e) => { e.preventDefault(); goHome(); });

// ── 불러오기 ─────────────────────────────────
async function load(key, interval) {
  const my = ++loadSeq;
  unsubRT?.(); unsubRT = null;
  exhausted = false;
  Object.assign(state, { key, interval, loaded: false });
  Object.assign(prefs, { interval, lastKey: key });
  store.setPrefs(prefs);

  const p = parseKey(key);
  const d = describe(key);
  paintHeader(); paintIntervals(); watch.render(); syncQuoteKeys();
  setStatus('불러오는 중…');

  let bars;
  try {
    bars = await p.source.candles(p.symbol, interval);
  } catch (e) {
    if (my !== loadSeq) return;
    view.setData([], { interval, currency: d.currency });
    drawings.setKey(key, d.currency);
    paintHeader();
    // 잠시 뒤 한 번 더 자동으로 시도 (그사이 다른 종목으로 옮겼으면 안 함)
    setTimeout(() => { if (my === loadSeq) load(key, interval); }, 15000);
    return setStatus(`불러오지 못했습니다 — ${e.message} · 15초 뒤 다시 시도`, 'error');
  }
  if (my !== loadSeq) return;
  const d2 = describe(key);
  view.setData(bars, { interval, currency: d2.currency });
  view.showRecent();
  drawings.setKey(key, d2.currency);
  state.loaded = true;
  if (!bars.length) setStatus('데이터가 없습니다', 'error');
  else if (!p.source.realtime) setStatus(`주식 시세 · ${d2.updatedAt ? fmtTime(d2.updatedAt) + ' 기준' : '수집 전'} · 장중 30분마다 자동 수집 (실시간 아님)`, 'info');
  else setStatus('');
  paintHeader(); paintLegend();

  if (p.source.realtime) {
    unsubRT = p.source.subscribe(p.symbol, interval, (bar) => {
      if (my !== loadSeq) return;
      view.update(bar);
      if (!quotes.get(key)) paintHeader();
      if (!legendHover) paintLegend();
    });
  }
}

// 왼쪽 끝까지 끌면 옛날 캔들 더 받기
view.onNeedMore(async () => {
  const p = parseKey(state.key || '');
  if (!p || !p.source.history || loadingMore || exhausted || !state.loaded) return;
  loadingMore = true;
  const my = loadSeq;
  try {
    const older = await p.source.candles(p.symbol, state.interval, { end: view.bars[0].time });
    if (my === loadSeq && !view.prepend(older)) exhausted = true;
  } catch { /* 다음에 다시 */ }
  loadingMore = false;
});

// 폰에서 화면을 다시 켜면 빠진 캔들 채우기
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  if (!state.loaded || Date.now() - hiddenAt < 20000) return;
  const p = parseKey(state.key);
  if (!p.source.realtime) return load(state.key, state.interval);
  const my = loadSeq;
  try {
    const recent = await p.source.candles(p.symbol, state.interval, { limit: 200 });
    if (my !== loadSeq) return;
    const last = view.lastBar();
    if (!last || !recent.length || recent[0].time > last.time) return load(state.key, state.interval);
    recent.filter((b) => b.time >= last.time).forEach((b) => view.update(b));
  } catch { /* 무시 */ }
});

// ── 머리(헤더) ───────────────────────────────
function paintHeader() {
  if (!state.key) return;
  const d = describe(state.key);
  const q = quotes.get(state.key);
  const price = q?.price ?? (state.loaded ? view.lastBar()?.close : null);
  $('#symName').textContent = d.name;
  $('#symSub').textContent = `${d.sourceLabel} · ${d.sub}`;
  $('#symPrice').textContent = price != null ? fmtPrice(price, d.currency) : '';
  const chg = $('#symChg');
  chg.textContent = fmtPct(q?.changePct);
  chg.className = 'sym-chg ' + (q?.changePct > 0 ? 'up' : q?.changePct < 0 ? 'down' : '');
  const inList = watch.has(state.key);
  const star = $('#starBtn');
  star.textContent = inList ? '★' : '☆';
  star.classList.toggle('on', inList);
  star.title = inList ? '관심종목에서 빼기' : '관심종목에 추가';
  document.title = `${d.name} ${price != null ? fmtPrice(price, d.currency) : ''} · chart`;
}

$('#symbolBtn').addEventListener('click', () => openSearch({ onPick: (k) => navigate(k, state.interval), watchlist: store.getWatchlist() }));
$('#starBtn').addEventListener('click', () => { watch.toggle(state.key); toast(watch.has(state.key) ? '관심종목에 추가했습니다' : '관심종목에서 뺐습니다'); });

function paintIntervals() {
  const src = state.key ? parseKey(state.key).source : null;
  $('#intervals').replaceChildren(...INTERVALS.map((iv) => {
    const ok = !src || src.intervals.includes(iv.id);
    return el('button', {
      class: 'iv' + (iv.id === state.interval ? ' active' : ''), disabled: !ok,
      title: ok ? '' : '주식은 30분마다 받아 두는 방식이라 1분봉이 없습니다',
      onclick: () => navigate(state.key, iv.id), text: iv.label,
    });
  }));
}

// ── 범례 (왼쪽 위: 시가·고가·저가·종가, 지표 값) ─────
let legendHover = false;
function paintLegend(param) {
  if (!state.key) return;
  const d = describe(state.key);
  let bar = param?.seriesData?.get(view.candles);
  legendHover = !!bar;
  if (!bar) bar = view.lastBar();
  const lbl = INTERVALS.find((i) => i.id === state.interval)?.label;
  const f = (v) => fmtPrice(v, d.currency);
  const cls = bar && bar.close >= bar.open ? 'up' : 'down';
  const parts = [el('div', { class: 'lg-title', text: `${d.name} · ${lbl}` })];
  if (bar) parts.push(el('div', { class: 'lg-ohlc ' + cls },
    el('span', {}, '시 ', el('b', { text: f(bar.open) })), el('span', {}, '고 ', el('b', { text: f(bar.high) })),
    el('span', {}, '저 ', el('b', { text: f(bar.low) })), el('span', {}, '종 ', el('b', { text: f(bar.close) }))));
  const vals = view.legendValues(param);
  if (vals.length) parts.push(el('div', { class: 'lg-ind' }, ...vals.map((v) => el('span', { style: { color: v.color } }, `${v.label} `, el('b', { text: v.value != null ? f(v.value) : '' })))));
  $('#legend').replaceChildren(...parts);
}
view.onCrosshair((p) => paintLegend(p.time ? p : null));

// 안내 문구: 기본 문구(주식 수집 시각 등) 위에 그리기 안내를 잠시 덮어 씀
let baseStatus = ['', ''];
function setStatus(msg, kind = '', { hint = false } = {}) {
  if (!hint) baseStatus = [msg, kind];
  const s = $('#status');
  s.textContent = msg;
  s.className = 'status ' + kind;
  s.hidden = !msg;
}

// ── 그리기 도구 막대 ─────────────────────────
function paintDrawbar(mgr) {
  $$('#drawbar [data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mgr.mode));
  const sel = mgr.selected;
  $('#drawDelete').disabled = !sel;
  $('#drawEdit').disabled = !sel || sel.type !== 'note';
  $('#drawClear').disabled = !mgr.items.length;
  const hint = { hline: '차트를 눌러 수평선을 놓으세요', trend: mgr.pending ? '끝점을 누르세요' : '시작점을 누르세요', note: '메모를 붙일 곳을 누르세요' }[mgr.mode];
  if (hint) setStatus(hint, 'info', { hint: true }); else setStatus(...baseStatus);
}
$$('#drawbar [data-mode]').forEach((b) => b.addEventListener('click', () => drawings.setMode(drawings.mode === b.dataset.mode ? 'cursor' : b.dataset.mode)));
$('#drawDelete').addEventListener('click', () => drawings.deleteSelected());
$('#drawEdit').addEventListener('click', () => drawings.editSelectedNote());
$('#drawClear').addEventListener('click', () => { if (confirm('이 종목에 그린 것을 모두 지울까요?')) drawings.clearAll(); });

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select') || sheetOpen()) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && drawings.selected) { e.preventDefault(); drawings.deleteSelected(); }
  if (e.key === 'Escape') drawings.setMode('cursor');
  if (e.key === '/' ) { e.preventDefault(); $('#symbolBtn').click(); }
});

// ── 열고 닫는 판 ─────────────────────────────
const isNarrow = () => matchMedia('(max-width: 767px)').matches;
function setWatchOpen(open, onlyNarrow = false) {
  if (onlyNarrow && !isNarrow()) return;
  document.body.classList.toggle('watch-open', open);
  if (!isNarrow()) { prefs.watchOpen = open; store.setPrefs(prefs); }
}
function setDrawOpen(open) { document.body.classList.toggle('draw-open', open); }
if (!isNarrow() && prefs.watchOpen) document.body.classList.add('watch-open');

$('#watchToggle').addEventListener('click', () => setWatchOpen(!document.body.classList.contains('watch-open')));
$('#mWatch').addEventListener('click', () => setWatchOpen(!document.body.classList.contains('watch-open')));
$('#watchBackdrop').addEventListener('click', () => setWatchOpen(false));
$('#mDraw').addEventListener('click', () => { setDrawOpen(!document.body.classList.contains('draw-open')); if (!document.body.classList.contains('draw-open')) drawings.setMode('cursor'); });

const indicatorOpts = {
  getCfg: () => store.getIndicators(),
  setCfg: (c) => { store.setIndicators(c); view.setIndicators(c); paintLegend(); },
};
$('#indBtn').addEventListener('click', () => openIndicators(indicatorOpts));
$('#mInd').addEventListener('click', () => { setWatchOpen(false); openIndicators(indicatorOpts); });
$('#settingsBtn').addEventListener('click', () => openSettings({
  prefs,
  setPrefs: (p) => { Object.assign(prefs, p); store.setPrefs(prefs); view.setColors(applyColors()); paintLegend(); },
  onImported: () => location.reload(),
}));

// ── 시작 ─────────────────────────────────────
if (!store.getWatchlist().length && !localStorage.getItem('chart.watchlist')) store.setWatchlist(DEFAULT_WATCHLIST.slice());
// 이름표(한글 종목명 등)를 받아 오면 다시 그리기
Promise.allSettled([SOURCES.upbit.markets(), SOURCES.stock.index()]).then(() => { watch.render(); paintHeader(); paintLegend(); });

if (parseHash()) route();
else if (prefs.lastKey && parseKey(prefs.lastKey)) navigate(prefs.lastKey, prefs.interval, { replace: true });
else goHome();
