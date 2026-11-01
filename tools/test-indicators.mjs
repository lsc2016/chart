// 지표 계산 점검: node tools/test-indicators.mjs
import { sma, ema, rsi, bollinger, macd } from '../js/indicators/calc.js';
import assert from 'node:assert/strict';
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
assert.deepEqual(sma(v, 3).slice(0, 3), [null, null, 2]);
near(sma(v, 3)[9], 9);
near(ema(v, 3)[2], 2); near(ema(v, 3)[3], 3); // 일정하게 오르면 EMA = 값 - 1
near(rsi(v, 3)[9], 100);
const flat = Array(30).fill(5);
near(bollinger(flat, 20, 2).upper[29], 5);
// 위키 예시 RSI(14) — 14번째 값 ≈ 70.53
const w = [44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28];
near(rsi(w, 14)[14], 70.46, 0.1);
const m = macd(v.concat(v), 3, 6, 2);
assert.equal(m.line.length, 20);
console.log('지표 계산 점검 통과');
