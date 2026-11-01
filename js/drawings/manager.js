// 그리기 관리: 도구 선택, 클릭·끌기 처리, 종목별 저장
import { store } from '../storage.js';
import { uid } from '../util.js';
import { DrawingLayer } from './layer.js';

export const TOOL_COLORS = { hline: '#f5c542', trend: '#4ea1ff', note: '#e6edf3' };

export class DrawingManager {
  constructor(view, { onChange } = {}) {
    this.view = view;
    this.onChange = onChange || (() => {});
    this.key = null;
    this.currency = '';
    this.items = [];
    this.mode = 'cursor';
    this.selectedId = null;
    this.pending = null; // 추세선 첫 점
    this.preview = null;
    this.drag = null;

    this.layer = new DrawingLayer(view, this);
    view.candles.attachPrimitive(this.layer);

    const chart = view.chart;
    chart.subscribeCrosshairMove((p) => this._move(p));

    const el = view.el;
    el.addEventListener('pointerdown', (e) => this._down(e), true);
    window.addEventListener('pointermove', (e) => this._dragMove(e));
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', () => { this._tapStart = null; this._up(null); });
    el.addEventListener('pointermove', (e) => this._hover(e));
  }

  setKey(key, currency) {
    this.key = key;
    this.currency = currency;
    this.items = store.getDrawings(key);
    this.selectedId = null;
    this.pending = this.preview = null;
    this.redraw();
  }

  setMode(mode) {
    this.mode = mode;
    this.pending = this.preview = null;
    if (mode !== 'cursor') this.selectedId = null;
    this.view.el.style.cursor = mode === 'cursor' ? '' : 'crosshair';
    this.redraw();
  }

  get selected() { return this.items.find((d) => d.id === this.selectedId) || null; }

  save() { if (this.key) store.setDrawings(this.key, this.items); }
  redraw() { this.layer.requestUpdate(); this.onChange(this); }

  deleteSelected() {
    if (!this.selectedId) return;
    this.items = this.items.filter((d) => d.id !== this.selectedId);
    this.selectedId = null;
    this.save(); this.redraw();
  }

  clearAll() {
    this.items = []; this.selectedId = null;
    this.save(); this.redraw();
  }

  editSelectedNote() {
    const d = this.selected;
    if (!d || d.type !== 'note') return;
    const text = prompt('메모 고치기', d.text);
    if (text == null) return;
    d.text = text.trim() || d.text;
    this.save(); this.redraw();
  }

  _pt(point) {
    const t = this.view.xToTime(point.x), price = this.view.yToPrice(point.y);
    return t == null || price == null ? null : { t, price };
  }

  // 짧게 누르고 뗀 것(탭) — 라이브러리의 클릭 이벤트는 빠른 연속 클릭을 놓치므로 직접 판정
  _tap(point) {
    const m = this.mode;
    if (m === 'cursor') {
      const hit = this.layer.hitTest(point.x, point.y);
      this.selectedId = hit?.id || null;
      return this.redraw();
    }
    const pt = this._pt(point);
    if (!pt) return;
    if (m === 'hline') {
      this._add({ id: uid(), type: 'hline', price: pt.price, color: TOOL_COLORS.hline });
    } else if (m === 'trend') {
      if (!this.pending) {
        this.pending = pt;
        this.preview = { id: '_p', type: 'trend', p1: pt, p2: null, color: TOOL_COLORS.trend, preview: true };
        this.redraw();
      } else {
        this._add({ id: uid(), type: 'trend', p1: this.pending, p2: pt, color: TOOL_COLORS.trend });
      }
    } else if (m === 'note') {
      const text = prompt('메모 내용');
      if (text && text.trim()) this._add({ id: uid(), type: 'note', p: pt, text: text.trim(), color: TOOL_COLORS.note });
    }
  }

  _add(d) {
    this.items.push(d);
    this.pending = this.preview = null;
    this.selectedId = d.id;
    this.mode = 'cursor';
    this.view.el.style.cursor = '';
    this.save(); this.redraw();
  }

  _move(p) {
    if (this.mode === 'trend' && this.pending && p.point) {
      const pt = this._pt(p.point);
      if (pt) { this.preview = { ...this.preview, p2: pt }; this.layer.requestUpdate(); }
    }
  }

  _local(e) {
    const r = this.view.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _hover(e) {
    if (this.mode !== 'cursor' || this.drag || e.pointerType !== 'mouse') return;
    const { x, y } = this._local(e);
    const hit = y < this.view.paneHeight() ? this.layer.hitTest(x, y) : null;
    this.view.el.style.cursor = hit ? (hit.part === 'body' ? 'move' : 'grab') : '';
  }

  // 그림을 잡아 끌기: 잡는 순간 차트 이동을 잠시 끈다
  _down(e) {
    if (e.button > 0) return;
    const { x, y } = this._local(e);
    if (y > this.view.paneHeight() || x > this.view.paneWidth()) return;
    this._tapStart = { x, y, at: Date.now(), id: e.pointerId };
    if (this.mode !== 'cursor') return;
    const hit = this.layer.hitTest(x, y);
    if (!hit) return;
    const d = this.items.find((i) => i.id === hit.id);
    this.selectedId = d.id;
    this.drag = { d, part: hit.part, start: this._pt({ x, y }), orig: structuredClone(d), moved: false, sx: x, sy: y };
    this.view.chart.applyOptions({ handleScroll: false, handleScale: false });
    e.preventDefault();
    this.redraw();
  }

  _dragMove(e) {
    const g = this.drag;
    if (!g) return;
    const { x, y } = this._local(e);
    if (!g.moved && Math.hypot(x - g.sx, y - g.sy) < 3) return;
    g.moved = true;
    const now = this._pt({ x, y });
    if (!now || !g.start) return;
    const dt = now.t - g.start.t, dp = now.price - g.start.price, o = g.orig, d = g.d;
    if (d.type === 'hline') d.price = o.price + dp;
    else if (d.type === 'note') d.p = { t: o.p.t + dt, price: o.p.price + dp };
    else if (d.type === 'trend') {
      if (g.part === 'p1') d.p1 = now;
      else if (g.part === 'p2') d.p2 = now;
      else { d.p1 = { t: o.p1.t + dt, price: o.p1.price + dp }; d.p2 = { t: o.p2.t + dt, price: o.p2.price + dp }; }
    }
    this.layer.requestUpdate();
  }

  _up(e) {
    const ts = this._tapStart;
    this._tapStart = null;
    if (this.drag) {
      if (this.drag.moved) this.save();
      this.drag = null;
      this.view.chart.applyOptions({ handleScroll: true, handleScale: true });
      this.redraw();
      return;
    }
    if (!ts || !e || e.pointerId !== ts.id) return;
    const { x, y } = this._local(e);
    if (Math.hypot(x - ts.x, y - ts.y) < 8 && Date.now() - ts.at < 700) this._tap({ x, y });
  }
}
