#!/usr/bin/env bash
# 데이터 출처 시험: 브라우저에서 직접 부를 수 있는지(CORS 헤더) + 실제 데이터가 오는지 확인
ORIGIN="https://lsc2016.github.io"
probe() {
  local name="$1" url="$2"
  local hdr body code acao
  hdr=$(mktemp); body=$(mktemp)
  code=$(curl -sS -m 20 -A "Mozilla/5.0" -H "Origin: $ORIGIN" -D "$hdr" -o "$body" -w "%{http_code}" "$url" 2>&1)
  acao=$(grep -i '^access-control-allow-origin' "$hdr" | tr -d '\r' | cut -d' ' -f2-)
  echo "### $name"
  echo "URL: $url"
  echo "HTTP: $code | ACAO: ${acao:-(없음)}"
  echo "BODY: $(head -c 220 "$body" | tr '\n' ' ')"
  echo
}
probe "binance klines"        "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=2"
probe "binance ticker24h"     "https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22%5D"
probe "binance exchangeInfo"  "https://api.binance.com/api/v3/exchangeInfo?symbol=BTCUSDT"
probe "binance.vision klines" "https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=2"
probe "binance.vision ticker" "https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT"
probe "upbit candles"         "https://api.upbit.com/v1/candles/minutes/60?market=KRW-BTC&count=2"
probe "upbit ticker"          "https://api.upbit.com/v1/ticker?markets=KRW-BTC,KRW-ETH"
probe "bybit kline"           "https://api.bybit.com/v5/market/kline?category=spot&symbol=BTCUSDT&interval=60&limit=2"
probe "okx candles"           "https://www.okx.com/api/v5/market/candles?instId=BTC-USDT&bar=1H&limit=2"
probe "coinbase candles"      "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=3600"
probe "kraken ohlc"           "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=60"
probe "yahoo chart US"        "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=5d"
probe "yahoo chart KR"        "https://query1.finance.yahoo.com/v8/finance/chart/005930.KS?interval=1d&range=5d"
probe "yahoo chart 1h"        "https://query2.finance.yahoo.com/v8/finance/chart/AAPL?interval=60m&range=5d"
probe "stooq csv"             "https://stooq.com/q/d/l/?s=aapl.us&i=d"
probe "nasdaq api"            "https://api.nasdaq.com/api/quote/AAPL/chart?assetclass=stocks"
probe "naver m.stock basic"   "https://m.stock.naver.com/api/stock/005930/basic"
probe "naver api chart"       "https://api.stock.naver.com/chart/domestic/item/005930/day?startDateTime=202610010000&endDateTime=202611010000"
probe "naver fchart"          "https://fchart.stock.naver.com/sise.nhn?symbol=005930&timeframe=day&count=3&requestType=0"
probe "jsdelivr lwc"          "https://cdn.jsdelivr.net/npm/lightweight-charts@5/dist/lightweight-charts.standalone.production.js"
probe "gist api"              "https://api.github.com/gists/public?per_page=1"
