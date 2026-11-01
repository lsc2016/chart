# chart

브라우저에서 시세 차트를 보고, 지표를 얹고, 선을 그어 보는 개인용 웹앱. 서버 없이 GitHub Pages에서 돌아갑니다.

**접속 주소: https://lsc2016.github.io/chart/**

## 쓰는 법

| 하고 싶은 것 | 방법 |
|---|---|
| 종목 바꾸기 | 위쪽 종목 이름을 눌러 검색 (예: `BTC`, `비트코인`, `AAPL`, `삼성`). 큰 화면에선 `/` 키 |
| 시간 단위 | `1분 15분 1시간 4시간 1일 1주` 버튼 |
| 확대·이동 | 마우스: 휠로 확대·축소, 끌어서 이동 / 폰: 두 손가락 벌리기·오므리기, 한 손가락 끌기 |
| 옛날 차트 | 왼쪽 끝까지 끌면 더 옛날 것을 불러옴 (코인) |
| 지표 | `ƒ 지표` → 켜고 끄기, 숫자 바꾸기 |
| 선 긋기 | 왼쪽 막대(폰은 아래 `그리기`) → 수평선(한 번 누름) · 추세선(두 점) · 메모(한 점 + 글) |
| 그린 것 옮기기·지우기 | `선택` 상태에서 선을 잡고 끌기 / 누른 뒤 `지우기` (큰 화면은 Delete 키) |
| 관심종목 | ☆ 눌러 추가, 목록의 `편집`으로 순서·삭제 |
| 처음 화면 | 왼쪽 위 `chart` 로고 |
| 맥북 ↔ 폰 설정 옮기기 | ⚙ 설정 → `내보내기` 파일을 다른 기기로 보내 `불러오기` |

폰에서는 사파리 공유 버튼 → **홈 화면에 추가** 하면 앱처럼 열립니다.

## 데이터

- **코인**: 바이낸스(`data-api.binance.vision`), 업비트(`api.upbit.com`) — 브라우저가 직접 받고 실시간으로 바뀜
- **주식**: 브라우저에서 직접 받을 수 없어서, GitHub Actions가 장중 30분마다 Yahoo Finance에서 받아 `data/stocks/`에 저장 → 화면은 그 파일을 읽음 (실시간 아님, 15~20분 늦을 수 있음)
- **받을 주식 바꾸기**: `config/stocks.json` 한 파일만 고쳐서 main에 올리면 바로 다시 받음
  - 미국: `AAPL` / 코스피: `005930.KS` / 코스닥: `035720.KQ`

## 저장

관심종목·지표 설정·그린 선·메모는 **그 기기 브라우저에만** 저장됩니다 (저장소에 올라가지 않음). 브라우저 데이터를 지우면 함께 지워지니 가끔 `내보내기`로 보관하세요.

## 폴더

```
index.html, css/, js/          화면과 동작
vendor/lightweight-charts/     차트 라이브러리 (원본 그대로)
config/stocks.json             받을 주식 목록
data/stocks/                   자동 수집된 주식 시세 (손대지 않음)
scripts/fetch-stocks.mjs       주식 수집 프로그램
tools/                         데이터 출처 시험·점검 도구
.github/workflows/             배포·주식 수집·점검 자동 작업
설계.md                         설계서
```

## 라이선스 표기

Charts by [TradingView](https://www.tradingview.com/) Lightweight Charts™ — Copyright (c) 2025 TradingView, Inc. Licensed under the Apache License 2.0 ([LICENSE](vendor/lightweight-charts/LICENSE), [NOTICE](vendor/lightweight-charts/NOTICE)).
