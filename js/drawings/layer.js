// 그리기 그림판: 캔들 시리즈에 붙는 "덧그리기(primitive)". 수평선·추세선·메모를 그린다
import { fmtPrice } from '../util.js';

const HIT = 7; // 손가락·마우스로 잡히는 거리(px)

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = dx * dx + dy * dy;
  let t = len ? ((px - x1) * dx + (py - y1) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export class DrawingLayer {
  constructor(view, mgr) {
    this.view = view; // ChartView (좌표 변환)
    this.mgr = mgr;   // DrawingManager (그림 목록·선택)
    this._req = null;
    const self = this;
    this._paneView = { zOrder: () => 'top', renderer: () => ({ draw: (t) => self._draw(t) }) };
  }

  attached({ requestUpdate }) { this._req = requestUpdate; }
  detached() { this._req = null; }
  requestUpdate() { this._req?.(); }
  updateAllViews() {}
  paneViews() { return [this._paneView]; }

  // 수평선 가격을 오른쪽 가격 축에 표시
  priceAxisViews() {
    const v = this.view, cur = this.mgr.currency;
    return this.mgr.items
      .filter((d) => d.type === 'hline')
      .map((d) => ({
        coordinate: () => v.priceToY(d.price) ?? -100,
        text: () => fmtPrice(d.price, cur),
        textColor: () => '#fff',
        backColor: () => d.color,
        visible: () => v.priceToY(d.price) != null,
      }));
  }

  // 화면 좌표로 바꾼 그림들
  _geom(d) {
    const v = this.view;
    if (d.type === 'hline') return { y: v.priceToY(d.price) };
    if (d.type === 'trend') return { x1: v.timeToX(d.p1.t), y1: v.priceToY(d.p1.price), x2: d.p2 ? v.timeToX(d.p2.t) : null, y2: d.p2 ? v.priceToY(d.p2.price) : null };
    if (d.type === 'note') return { x: v.timeToX(d.p.t), y: v.priceToY(d.p.price) };
    return {};
  }

  _noteBox(ctx, d, g) {
    const lines = String(d.text || '').split('\n').slice(0, 6);
    ctx.font = '12px -apple-system, "Apple SD Gothic Neo", sans-serif';
    const w = Math.min(240, Math.max(...lines.map((l) => ctx.measureText(l).width), 20)) + 14;
    const h = lines.length * 16 + 8;
    return { lines, x: g.x + 8, y: g.y - h - 8, w, h };
  }

  // 그 자리에 무엇이 있나: {id, part}
  hitTest(x, y) {
    const items = this.mgr.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const d = items[i], g = this._geom(d);
      if (d.type === 'note' && g.x != null && g.y != null) {
        const ctx = document.createElement('canvas').getContext('2d');
        const b = this._noteBox(ctx, d, g);
        if (Math.hypot(x - g.x, y - g.y) < HIT + 3 || (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)) return { id: d.id, part: 'body' };
      }
      if (d.type === 'trend' && g.x1 != null && g.x2 != null && g.y1 != null && g.y2 != null) {
        if (Math.hypot(x - g.x1, y - g.y1) < HIT + 4) return { id: d.id, part: 'p1' };
        if (Math.hypot(x - g.x2, y - g.y2) < HIT + 4) return { id: d.id, part: 'p2' };
        if (distToSeg(x, y, g.x1, g.y1, g.x2, g.y2) < HIT) return { id: d.id, part: 'body' };
      }
      if (d.type === 'hline' && g.y != null && Math.abs(y - g.y) < HIT) return { id: d.id, part: 'body' };
    }
    return null;
  }

  _draw(target) {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const W = mediaSize.width;
      const sel = this.mgr.selectedId;
      const all = [...this.mgr.items];
      if (this.mgr.preview) all.push(this.mgr.preview);
      for (const d of all) {
        const g = this._geom(d), on = d.id === sel;
        ctx.strokeStyle = d.color;
        ctx.fillStyle = d.color;
        ctx.lineWidth = on ? 2.5 : 1.5;
        ctx.setLineDash([]);
        if (d.type === 'hline' && g.y != null) {
          ctx.beginPath(); ctx.moveTo(0, g.y); ctx.lineTo(W, g.y); ctx.stroke();
          if (on) this._handle(ctx, W / 2, g.y, d.color);
        } else if (d.type === 'trend' && g.x1 != null && g.y1 != null) {
          if (g.x2 != null && g.y2 != null) {
            if (d.preview) ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke();
            ctx.setLineDash([]);
          }
          if (on || d.preview || !d.p2) { this._handle(ctx, g.x1, g.y1, d.color); if (g.x2 != null) this._handle(ctx, g.x2, g.y2, d.color); }
        } else if (d.type === 'note' && g.x != null && g.y != null) {
          const b = this._noteBox(ctx, d, g);
          ctx.beginPath(); ctx.arc(g.x, g.y, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(b.x + 4, b.y + b.h); ctx.stroke();
          ctx.fillStyle = 'rgba(22,27,35,0.92)';
          ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill();
          ctx.lineWidth = on ? 2 : 1; ctx.stroke();
          ctx.fillStyle = '#e6edf3';
          ctx.textBaseline = 'top';
          b.lines.forEach((l, i) => ctx.fillText(l, b.x + 7, b.y + 5 + i * 16, b.w - 12));
        }
      }
    });
  }

  _handle(ctx, x, y, color) {
    ctx.save();
    ctx.fillStyle = '#0f1218'; ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
