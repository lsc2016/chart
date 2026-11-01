// 아래에서 올라오는 판(폰) / 가운데 창(큰 화면) — 한 번에 하나만
import { el } from '../util.js';

let current = null;

export function openSheet(title, body, { onClose, wide } = {}) {
  closeSheet();
  const close = () => closeSheet();
  const panel = el('div', { class: 'sheet' + (wide ? ' wide' : ''), role: 'dialog', 'aria-label': title },
    el('div', { class: 'sheet-head' },
      el('div', { class: 'sheet-grip' }),
      el('h2', { text: title }),
      el('button', { class: 'icon-btn', 'aria-label': '닫기', onclick: close, text: '✕' })),
    el('div', { class: 'sheet-body' }, body));
  const backdrop = el('div', { class: 'backdrop', onclick: (e) => { if (e.target === backdrop) close(); } }, panel);
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('show'));
  current = { backdrop, onClose };
  return panel;
}

export function closeSheet() {
  if (!current) return;
  const { backdrop, onClose } = current;
  current = null;
  backdrop.remove();
  onClose?.();
}

export const sheetOpen = () => !!current;

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
