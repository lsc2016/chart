# chart — 에이전트 안내

## 이 프로젝트는
- 브라우저만으로 돌아가는 개인용 시세 차트 웹앱. 서버 없이 GitHub Pages(https://lsc2016.github.io/chart/)에 올려 맥북·폰에서 쓴다.
- 코인(바이낸스·업비트)은 브라우저가 직접 받고 실시간 갱신, 주식(미국·한국)은 GitHub Actions가 30분마다 Yahoo에서 받아 `data/stocks/`에 저장한 파일을 읽는다.
- 지표(이동평균·볼린저·RSI·MACD·거래량), 선 긋기(수평선·추세선·메모), 관심종목. 저장은 그 기기 브라우저(localStorage)에만.

## 폴더 지도
| 폴더·파일 | 무엇 |
|---|---|
| `index.html` | 화면 하나. 모든 기능이 이 위에서 돈다 |
| `css/app.css` | 다크 테마, 화면 크기별 배치 |
| `js/main.js` | 시작점: 화면 조립, 주소(`#/출처/기호/시간단위`) 처리, 로고 → 첫 화면(`goHome`) |
| `js/config.js` | 시간 단위·기본 관심종목·색·기본 지표값 |
| `js/storage.js` | 브라우저 저장, 설정 내보내기/불러오기 |
| `js/quotes.js` | 관심종목 현재가 모아 받기 |
| `js/util.js` | `fetchJSON`(재시도·429 대기), 숫자 형식 등 |
| `js/datasources/` | 출처별 같은 모양(`candles`/`search`/`quotes`…): `binance.js`, `upbit.js`, `stocks.js`(받아 둔 JSON 읽기), `socket.js`(다시 붙는 WebSocket), `index.js`(출처 모음, 열쇠 `출처:기호`) |
| `js/chart/` | `chartView.js`(차트·창 나누기), `theme.js`(색) |
| `js/indicators/calc.js` | 지표 계산 |
| `js/drawings/` | `manager.js`(그리기 저장·선택), `layer.js`(그리기 화면) |
| `js/ui/` | 관심종목·검색·지표·설정 판, `sheet.js`(아래에서 올라오는 판) |
| `js/future/` | 나중 기능 자리(README만) |
| `config/stocks.json` | ★ 받을 주식 목록. 이것만 고쳐 main에 올리면 다시 수집 |
| `scripts/fetch-stocks.mjs` | Actions가 돌리는 주식 수집 프로그램 |
| `tools/` | 데이터 출처 시험(`probe.sh`, `probe-ws.mjs`), 화면 점검(`smoke.mjs`), 지표 시험(`test-indicators.mjs`) |
| `.github/workflows/` | `deploy`(main → Pages 배포), `update-stocks`(주식 수집·커밋·배포), `check`(PR 때 문법·지표 점검), `smoke`(실제 브라우저 점검, 수동), `probe-sources`(출처 시험, 수동) |
| `data/stocks/` | ⛔ Actions가 자동으로 채우는 주식 시세. 손대지 않음 |
| `vendor/lightweight-charts/` | ⛔ 차트 라이브러리 원본 그대로(남의 코드, Apache-2.0) |
| `설계.md` | 설계서(결정·출처 시험 결과·나중 계획). 5장 폴더 구조는 실제와 조금 다름(아래 "모르는 것") |
| `README.md` | 쉬운 사용법 |

## 시작점
- 빌드(변환 과정) 없음. 저장소 폴더에서 `python3 -m http.server 8000` → `http://localhost:8000/`. (작업 환경에선 거래소 접속이 막혀 시세가 안 뜰 수 있음)
- 배포는 main에 올리면 자동(`deploy.yml`).
- 점검: `node --check <파일>`, `node tools/test-indicators.mjs`.
- 읽는 순서: `README.md` → `설계.md` 1·3·11장 → `js/main.js` → 필요한 `js/datasources/*`.

## 고치는 규칙
- 있는 것을 지우고 새로 만들지 말고, 더하고 보완하기.
- 사람이 승인하기 전에 데이터 파일·설정 파일을 지우거나 덮어쓰지 않기. (`data/stocks/`, `config/stocks.json`)
- 삭제 명령(rm -rf 등)은 쓰지 않기.
- 어느 화면에서든 첫 화면으로 돌아갈 길(왼쪽 위 `chart` 로고 → `goHome()`)을 없애지 않기.
- 비밀값(API 키·토큰)은 코드·저장소에 두지 않는다(설계 원칙). 쓰는 출처는 모두 키가 필요 없다.
- `vendor/`는 고치지 않는다. 라이브러리 표기(TradingView 로고·NOTICE)를 지우지 않는다.

## 읽는 양 줄이기
| 이런 일이면 | 이 파일만 읽어라 |
|---|---|
| 받을 주식 추가·삭제 | `config/stocks.json` |
| 주식 수집이 실패함 | `scripts/fetch-stocks.mjs`, `.github/workflows/update-stocks.yml` |
| 코인 차트·실시간이 안 됨 | `js/datasources/binance.js` 또는 `upbit.js`, `socket.js`, `js/util.js` |
| 주식 차트가 안 뜸 | `js/datasources/stocks.js` |
| 지표 추가·계산 | `js/indicators/calc.js`, `js/ui/indicators.js`, `js/chart/chartView.js`, `js/config.js`(기본값) |
| 선 긋기 | `js/drawings/manager.js`, `js/drawings/layer.js` |
| 관심종목·현재가 | `js/ui/watchlist.js`, `js/quotes.js` |
| 저장·내보내기 | `js/storage.js`, `js/ui/settings.js` |
| 화면 배치·색 | `index.html`, `css/app.css`, `js/chart/theme.js` |
| 주소·첫 화면 | `js/main.js` |

**열지 말 것**: `data/`(자동 수집 시세, 약 3MB), `vendor/`(라이브러리 원본), `.git/`.

## 용어
| 우리말 | 코드 |
|---|---|
| 출처 | `source` (`binance`, `upbit`, `stock`) |
| 종목 열쇠 | `key` = `출처:기호` (예: `binance:BTCUSDT`, `upbit:KRW-BTC`, `stock:005930.KS`) |
| 시간 단위 | `interval` (`1m 15m 1h 4h 1d 1w`) |
| 캔들(봉) | `candles`, 화면에선 `{time, open, high, low, close, volume}` |
| 관심종목 | `watchlist` |
| 그리기 | `drawings` |
| 첫 화면 | `goHome()` (관심종목 첫 종목 · 1시간봉) |
| 판(바텀시트) | `sheet` |

## 다른 프로젝트와의 연결
- 지금은 없음. 다른 저장소의 파일을 읽거나 쓰지 않는다.
- 나중 계획(설계.md 9장, `js/future/README.md`): freqtrade 거래 기록·백테스트 결과를 불러와 차트에 표시 (`/home/user/freqtrade` 와 연결될 예정, 아직 코드 없음).

## 저장소 밖
- 거래소 공개 주소: `data-api.binance.vision`, `data-stream.binance.vision`, `api.upbit.com`, Yahoo Finance(`query1/2.finance.yahoo.com`, Actions에서만).
- 저장소 설정: Settings → Pages → Source = "GitHub Actions" (사용자가 한 번 해 둬야 함).
- 비밀값·`.env` 없음.

## 모르는 것 (확인 필요)
- 한국에서 맥북·폰으로 직접 열어 본 확인이 끝났는지 (설계.md 11장 "남은 확인").
- `설계.md` 5장 폴더 구조(`state.js`, `staticStocks.js`, `indicators/ma.js` …)는 실제 파일과 다름 — 실제 파일이 기준.
- 수집 커밋이 30분마다 쌓여 저장소가 커지는 문제를 언제 "커밋 없이 배포 때만 생성" 방식으로 바꿀지.
