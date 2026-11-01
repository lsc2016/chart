// 다크 테마 색
export const THEME = {
  bg: '#0f1218',
  panel: '#161b23',
  text: '#c9d1d9',
  muted: '#5c6773',
  grid: 'rgba(255,255,255,0.045)',
  border: '#262d38',
  borderHover: '#3a4454',
  accent: '#4ea1ff',
};

export function alpha(hex, a) {
  if (!hex.startsWith('#')) return hex;
  const h = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1, 7);
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
