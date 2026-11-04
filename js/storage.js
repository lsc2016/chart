// 브라우저 저장소(localStorage) 읽기·쓰기, 내보내기·불러오기
import { DEFAULT_INDICATORS, DEFAULT_WATCHLIST, DEFAULT_INTERVAL } from './config.js';

const PREFIX = 'chart.';
const SCHEMA_VERSION = 1;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('저장 실패', e);
  }
}

// 저장 형식이 바뀌면 여기서 옛 데이터를 새 형식으로 바꾼다
function migrate() {
  const v = read('version', 0);
  if (v < 1) {
    // 첫 실행: 할 일 없음
  }
  write('version', SCHEMA_VERSION);
}
migrate();

export const store = {
  getWatchlist: () => read('watchlist', DEFAULT_WATCHLIST.slice()),
  setWatchlist: (list) => write('watchlist', list),

  getIndicators: () => {
    const saved = read('indicators', null);
    if (!saved) return structuredClone(DEFAULT_INDICATORS);
    // 새로 생긴 항목은 기본값으로 채움
    return { ...structuredClone(DEFAULT_INDICATORS), ...saved };
  },
  setIndicators: (cfg) => write('indicators', cfg),

  getDrawings: (key) => read('drawings.' + key, []),
  setDrawings: (key, list) => {
    if (list.length) write('drawings.' + key, list);
    else localStorage.removeItem(PREFIX + 'drawings.' + key);
  },

  getPrefs: () => ({ interval: DEFAULT_INTERVAL, colors: 'kr', watchOpen: true, ...read('prefs', {}) }),
  setPrefs: (p) => write('prefs', p),
};

export function exportAll() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(PREFIX)) data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
  }
  return { app: 'chart', schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data };
}

// mode: 'replace' 덮어쓰기 | 'merge' 합치기
export function importAll(file, mode) {
  if (!file || file.app !== 'chart' || typeof file.data !== 'object') throw new Error('chart 설정 파일이 아닙니다');
  const d = file.data;
  if (mode === 'replace') {
    // 지우기 전에 지금 저장값을 그대로 들고 있다가, 쓰는 도중 실패하면(저장 공간 부족 등) 되돌린다
    const backup = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).map((k) => [k, localStorage.getItem(k)]);
    try {
      for (const [k] of backup) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(d)) localStorage.setItem(PREFIX + k, JSON.stringify(v));
    } catch (e) {
      for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
      for (const [k, raw] of backup) { try { localStorage.setItem(k, raw); } catch {} }
      throw new Error('저장 공간이 부족해 덮어쓰지 못했습니다. 원래 설정은 그대로입니다');
    }
  } else {
    for (const [k, v] of Object.entries(d)) {
      if (k === 'watchlist') {
        const cur = store.getWatchlist();
        write(k, [...cur, ...v.filter((x) => !cur.includes(x))]);
      } else if (k.startsWith('drawings.')) {
        const cur = read(k, []);
        const ids = new Set(cur.map((x) => x.id));
        write(k, [...cur, ...v.filter((x) => !ids.has(x.id))]);
      } else {
        write(k, v);
      }
    }
  }
  migrate();
}
