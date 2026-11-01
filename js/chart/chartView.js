// 차트 화면: lightweight-charts를 감싸서 캔들·거래량·지표·시간 변환을 관리
import {
  createChart, CandlestickSeries, LineSeries, HistogramSeries, CrosshairMode, LineStyle,
} from '../../vendor/lightweight-charts/lightweight-charts.standalone.production.mjs';
import { INTERVAL_SEC, isIntraday } from '../config.js';
import { pricePrecision } from '../util.js';
import { sma, ema, bollinger, rsi, macd } from '../indicators/calc.js';
import { THEME, alpha } from './theme.js';

export class ChartView {
  constructor(container, { colors }) {
    this.el = container;
    this.colors = colors;
    this.bars = [];
    this.times = []; // 차트 시간(화면용으로 옮긴 시간)
    this.interval = '1h';
    this.shift = 0;
    this.ind = { cfg: null, series: [] };
    this._needMoreCbs = [];
    this._crossCbs = [];

    this.chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: THEME.bg },
        textColor: THEME.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
        attributionLogo: true, // TradingView 표기 (라이선스 조건)
        panes: { separatorColor: THEME.border, separatorHoverColor: THEME.borderHover },
      },
      grid: { vertLines: { color: THEME.grid }, horzLines: { color: THEME.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: THEME.border },
      timeScale: { borderColor: THEME.border, rightOffset: 6, timeVisible: true, secondsVisible: false },
      localization: { locale: 'ko-KR', dateFormat: 'yyyy-MM-dd' },
    });

    this.candles = this.chart.addSeries(CandlestickSeries, this._candleColors());
    this.volume = null;

    this.chart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
      if (r && r.from < 15 && this.bars.length) this._needMoreCbs.forEach((cb) => cb());
    });
    this.chart.subscribeCrosshairMove((p) => this._crossCbs.forEach((cb) => cb(p)));
  }

  _candleColors() {
    const { up, down } = this.colors;
    return { upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down };
  }

  setColors(colors) {
    this.colors = colors;
    this.candles.applyOptions(this._candleColors());
    this._refreshIndicators(true);
  }

  onNeedMore(cb) { this._needMoreCbs.push(cb); }
  onCrosshair(cb) { this._crossCbs.push(cb); }

  // ── 시간 변환 ─────────────────────────────
  // 분·시간봉은 내 기기 시간대로 보이게 옮기고, 일·주봉은 날짜 그대로
  toChart(t) { return t + this.shift; }
  fromChart(t) { return t - this.shift; }

  _barSpacing() {
    const ts = this.chart.timeScale();
    const x0 = ts.logicalToCoordinate(0), x1 = ts.logicalToCoordinate(1);
    return x0 == null || x1 == null ? null : { x0, w: x1 - x0 };
  }

  // 실제 시간(초) → 화면 x. 캔들 사이나 바깥의 시간도 계산
  timeToX(t) {
    const n = this.times.length, s = this._barSpacing();
    if (!n || !s) return null;
    const ct = this.toChart(t), iv = INTERVAL_SEC[this.interval];
    let logical;
    if (ct <= this.times[0]) logical = (ct - this.times[0]) / iv;
    else if (ct >= this.times[n - 1]) logical = n - 1 + (ct - this.times[n - 1]) / iv;
    else {
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.times[m] <= ct) lo = m; else hi = m; }
      logical = lo + (ct - this.times[lo]) / (this.times[hi] - this.times[lo]);
    }
    return s.x0 + logical * s.w;
  }

  xToTime(x) {
    const n = this.times.length, s = this._barSpacing();
    if (!n || !s) return null;
    const logical = (x - s.x0) / s.w, iv = INTERVAL_SEC[this.interval];
    let ct;
    if (logical <= 0) ct = this.times[0] + logical * iv;
    else if (logical >= n - 1) ct = this.times[n - 1] + (logical - (n - 1)) * iv;
    else {
      const i = Math.floor(logical), f = logical - i;
      ct = this.times[i] + f * (this.times[i + 1] - this.times[i]);
    }
    return this.fromChart(ct);
  }

  priceToY(p) { return this.candles.priceToCoordinate(p); }
  yToPrice(y) { return this.candles.coordinateToPrice(y); }
  paneHeight() { return this.chart.panes()[0]?.getHeight() ?? this.el.clientHeight; }
  paneWidth() { return this.chart.timeScale().width(); }

  // ── 데이터 ─────────────────────────────
  _mapBar(b) { return { time: this.toChart(b.time), open: b.open, high: b.high, low: b.low, close: b.close }; }
  _mapVol(b) { return { time: this.toChart(b.time), value: b.volume, color: alpha(b.close >= b.open ? this.colors.up : this.colors.down, 0.45) }; }

  setData(bars, { interval, currency }) {
    this.interval = interval;
    this.shift = isIntraday(interval) ? -new Date().getTimezoneOffset() * 60 : 0;
    this.bars = bars.slice();
    this.times = this.bars.map((b) => this.toChart(b.time));
    const last = bars[bars.length - 1]?.close ?? 1;
    const precision = pricePrecision(last, currency);
    this.candles.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } });
    this.chart.applyOptions({ timeScale: { timeVisible: isIntraday(interval) } });
    this.candles.setData(this.bars.map((b) => this._mapBar(b)));
    this._refreshIndicators(true);
  }

  prepend(older) {
    const first = this.bars[0]?.time ?? Infinity;
    const add = older.filter((b) => b.time < first);
    if (!add.length) return 0;
    const ts = this.chart.timeScale();
    const r = ts.getVisibleLogicalRange();
    this.bars = [...add, ...this.bars];
    this.times = this.bars.map((b) => this.toChart(b.time));
    this.candles.setData(this.bars.map((b) => this._mapBar(b)));
    this._refreshIndicators(false);
    if (r) ts.setVisibleLogicalRange({ from: r.from + add.length, to: r.to + add.length });
    return add.length;
  }

  // 실시간 한 개 갱신
  update(bar) {
    const n = this.bars.length;
    if (!n) return;
    const last = this.bars[n - 1];
    if (bar.time < last.time) return;
    if (bar.time === last.time) this.bars[n - 1] = bar;
    else { this.bars.push(bar); this.times.push(this.toChart(bar.time)); }
    this.candles.update(this._mapBar(bar));
    if (this.volume) this.volume.update(this._mapVol(bar));
    clearTimeout(this._indTimer);
    this._indTimer = setTimeout(() => this._updateIndicatorsLast(), 400);
  }

  lastBar() { return this.bars[this.bars.length - 1]; }

  showRecent(count = 150) {
    const n = this.bars.length;
    if (!n) return;
    this.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - count), to: n + 5 });
    this.candles.priceScale().applyOptions({ autoScale: true });
  }

  // ── 지표 ─────────────────────────────
  setIndicators(cfg) {
    this.ind.cfg = structuredClone(cfg);
    this._refreshIndicators(true);
  }

  _clearIndicators() {
    for (const s of this.ind.series) this.chart.removeSeries(s.api);
    this.ind.series = [];
    if (this.volume) { this.chart.removeSeries(this.volume); this.volume = null; }
  }

  _line(pane, color, width = 1.5, extra = {}) {
    return this.chart.addSeries(LineSeries, {
      color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...extra,
    }, pane);
  }

  // 계산 결과 묶음: [{api, key, values(배열)}]
  _compute() {
    const cfg = this.ind.cfg, closes = this.bars.map((b) => b.close);
    const out = {};
    for (const m of cfg.mas) if (m.on) out[m.id] = (m.type === 'EMA' ? ema : sma)(closes, Math.max(1, +m.period));
    if (cfg.bb.on) {
      const b = bollinger(closes, Math.max(2, +cfg.bb.period), +cfg.bb.mult);
      out.bbU = b.upper; out.bbM = b.mid; out.bbL = b.lower;
    }
    if (cfg.rsi.on) out.rsi = rsi(closes, Math.max(2, +cfg.rsi.period));
    if (cfg.macd.on) {
      const m = macd(closes, +cfg.macd.fast, +cfg.macd.slow, +cfg.macd.signal);
      out.macdL = m.line; out.macdS = m.signal; out.macdH = m.hist;
    }
    return out;
  }

  _point(key, v, i) {
    const time = this.times[i];
    if (v == null) return { time };
    if (key === 'macdH') return { time, value: v, color: alpha(v >= 0 ? this.colors.up : this.colors.down, 0.6) };
    return { time, value: v };
  }

  _refreshIndicators(rebuild) {
    const cfg = this.ind.cfg;
    if (!cfg) return;
    if (rebuild) {
      this._clearIndicators();
      let pane = 1;
      if (cfg.volume.on) {
        this.volume = this.chart.addSeries(HistogramSeries, {
          priceScaleId: 'vol', priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false,
        }, 0);
        this.volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      }
      for (const m of cfg.mas) if (m.on) this.ind.series.push({ key: m.id, label: `${m.type === 'EMA' ? 'EMA' : 'MA'}${m.period}`, api: this._line(0, m.color) });
      if (cfg.bb.on) {
        const c = cfg.bb.color;
        this.ind.series.push({ key: 'bbU', label: 'BB상', api: this._line(0, c, 1) });
        this.ind.series.push({ key: 'bbM', label: 'BB중', api: this._line(0, alpha(c, 0.6), 1, { lineStyle: LineStyle.Dashed }) });
        this.ind.series.push({ key: 'bbL', label: 'BB하', api: this._line(0, c, 1) });
      }
      if (cfg.rsi.on) {
        const api = this._line(pane, cfg.rsi.color, 1.5, { lastValueVisible: true, priceFormat: { type: 'price', precision: 1, minMove: 0.1 } });
        api.createPriceLine({ price: +cfg.rsi.upper, color: THEME.muted, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
        api.createPriceLine({ price: +cfg.rsi.lower, color: THEME.muted, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
        this.ind.series.push({ key: 'rsi', label: `RSI${cfg.rsi.period}`, api, pane });
        pane++;
      }
      if (cfg.macd.on) {
        const fmt = { lastValueVisible: true };
        this.ind.series.push({ key: 'macdH', label: 'MACD막대', api: this.chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane), pane });
        this.ind.series.push({ key: 'macdL', label: 'MACD', api: this._line(pane, '#4ea1ff', 1.5, fmt), pane });
        this.ind.series.push({ key: 'macdS', label: '시그널', api: this._line(pane, '#ff9f43', 1.5, fmt), pane });
        pane++;
      }
      // 아래 지표 창은 작게
      const panes = this.chart.panes();
      panes.forEach((p, i) => p.setStretchFactor(i === 0 ? 3 : 1));
    }
    if (this.volume) this.volume.setData(this.bars.map((b) => this._mapVol(b)));
    const vals = this._compute();
    for (const s of this.ind.series) s.api.setData((vals[s.key] || []).map((v, i) => this._point(s.key, v, i)));
  }

  _updateIndicatorsLast() {
    if (!this.ind.cfg || !this.bars.length) return;
    const vals = this._compute(), i = this.bars.length - 1;
    for (const s of this.ind.series) {
      const arr = vals[s.key];
      if (arr) s.api.update(this._point(s.key, arr[i], i));
    }
  }

  // 십자선 위치의 지표 값 (범례용)
  legendValues(param) {
    return this.ind.series
      .filter((s) => !s.key.startsWith('bbM') && s.key !== 'macdH')
      .map((s) => {
        let d = param?.seriesData?.get(s.api);
        if (!param) { const all = s.api.data(); d = all[all.length - 1]; }
        return { label: s.label, value: d?.value, color: s.api.options().color };
      });
  }
}
