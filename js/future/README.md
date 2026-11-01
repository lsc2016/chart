# 나중 단계 기능 자리 (1단계에서는 만들지 않음)

| 폴더 | 기능 | 메모 |
|---|---|---|
| `alerts/` | 가격 알림 | 화면이 열려 있을 때: 브라우저 알림(Notification). 닫혀 있어도 받으려면 Actions가 주기적으로 확인 → 텔레그램/메일 (토큰은 GitHub Secrets에만) |
| `strategies/` | 내 전략 매수·매도 표시 | freqtrade 거래 기록 JSON → `createSeriesMarkers`로 ▲▼ 표시. 데이터는 `data/strategies/` 또는 파일 불러오기 |
| `backtest/` | 백테스트 결과 보기 | `#/backtest` 화면. freqtrade 백테스트 결과 파일 → 수익 곡선(LineSeries)·거래 목록 |

연결 지점: `js/main.js`의 `load()` 끝(차트가 그려진 뒤), `ChartView.candles`(표시를 붙일 캔들 시리즈).
