// 작은 도우미 함수들
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) e.append(c);
  return e;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchJSON(url, { retries = 1, timeout = 15000 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (res.status === 429) { lastErr = new Error('호출이 너무 잦습니다(429)'); await sleep(600 * (i + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < retries) await sleep(400 * (i + 1));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

// 가격 자릿수: 큰 숫자는 적게, 작은 숫자는 많이
export function pricePrecision(price, currency) {
  const p = Math.abs(price || 0);
  if (currency === 'KRW') return p >= 100 ? 0 : p >= 1 ? 2 : 4;
  if (p >= 1000) return 2;
  if (p >= 1) return p >= 100 ? 2 : 3;
  if (p >= 0.01) return 5;
  return 8;
}

export function fmtPrice(price, currency) {
  if (price == null || !isFinite(price)) return '-';
  const d = pricePrecision(price, currency);
  return price.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtPct(pct) {
  if (pct == null || !isFinite(pct)) return '';
  return (pct > 0 ? '+' : '') + pct.toFixed(2) + '%';
}

export function fmtTime(sec) {
  const d = new Date(sec * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 시간(초)을 시간 단위의 시작 시각으로 내림. 주봉은 월요일 00:00 UTC 기준
export function bucketStart(sec, ivSec) {
  if (ivSec === 604800) {
    const MON = 4 * 86400; // 1970-01-01은 목요일 → 월요일까지 4일
    return Math.floor((sec - MON) / ivSec) * ivSec + MON;
  }
  return Math.floor(sec / ivSec) * ivSec;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function toast(msg, ms = 2600) {
  const box = document.getElementById('toast');
  if (!box) return;
  box.textContent = msg;
  box.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => box.classList.remove('show'), ms);
}
