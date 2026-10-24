/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Candle, TimeFrame } from '../../types/market.ts';

const INTERVAL_MAP: Record<TimeFrame, string> = {
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

// In-memory cache to prevent spamming Binance API (cache for 15 seconds)
interface CacheEntry {
  timestamp: number;
  candles: Candle[];
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15_000;

export function getTimeframeMs(timeframe: TimeFrame): number {
  switch (timeframe) {
    case '5m':
      return 5 * 60 * 1000;
    case '15m':
      return 15 * 60 * 1000;
    case '30m':
      return 30 * 60 * 1000;
    case '1h':
      return 60 * 60 * 1000;
    case '4h':
      return 4 * 60 * 60 * 1000;
    case '1d':
      return 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}

export async function fetchBinanceKlines(
  symbol: string = 'BTCUSDT',
  timeframe: TimeFrame = '1h',
  limit: number = 200
): Promise<{ candles: Candle[]; dataSource: string; isLive: boolean }> {
  const cleanSymbol = symbol.toUpperCase().trim();
  const interval = INTERVAL_MAP[timeframe] || '1h';
  const cacheKey = `${cleanSymbol}_${interval}_${limit}`;
  const now = Date.now();
  const timeframeMs = getTimeframeMs(timeframe);

  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    const last = cached.candles[cached.candles.length - 1];
    const isStale = last ? now - last.time > 3 * timeframeMs : false;
    return {
      candles: cached.candles,
      dataSource: `Binance Spot REST API (ذاكرة مؤقتة لـ ${cleanSymbol})`,
      isLive: !isStale,
    };
  }

  const url = `https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Binance API error for ${cleanSymbol}: HTTP ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`لم يتم استلام أي بيانات شموع صالحة لـ ${cleanSymbol} من Binance`);
    }

    const rawCandles: Candle[] = [];
    const currentTime = Date.now();

    for (let i = 0; i < data.length; i++) {
      const raw = data[i];
      // Binance format: [openTime, open, high, low, close, volume, closeTime, ...]
      const openTime = Number(raw[0]);
      const open = parseFloat(raw[1]);
      const high = parseFloat(raw[2]);
      const low = parseFloat(raw[3]);
      const close = parseFloat(raw[4]);
      const volume = parseFloat(raw[5]);

      // Strict integrity checks: reject NaN and non-positive prices
      if (
        isNaN(openTime) ||
        openTime <= 0 ||
        isNaN(open) ||
        isNaN(high) ||
        isNaN(low) ||
        isNaN(close) ||
        isNaN(volume) ||
        open <= 0 ||
        high <= 0 ||
        low <= 0 ||
        close <= 0
      ) {
        continue;
      }

      // Check OHLC consistency: low <= high and extremes cover open & close
      if (low > high || high < Math.max(open, close) || low > Math.min(open, close)) {
        console.warn(`[BinanceAdapter] Invalid OHLC candle discarded for ${cleanSymbol} at ${openTime}`);
        continue;
      }

      // Calculate isClosed based on openTime + timeframeMs <= currentTime
      const isClosed = openTime + timeframeMs <= currentTime;

      rawCandles.push({
        time: openTime,
        open,
        high,
        low,
        close,
        volume,
        isClosed,
      });
    }

    // Sort chronologically ascending
    rawCandles.sort((a, b) => a.time - b.time);

    // Prevent duplicate timestamps
    const candles: Candle[] = [];
    for (let i = 0; i < rawCandles.length; i++) {
      if (i > 0 && rawCandles[i].time === rawCandles[i - 1].time) {
        continue;
      }
      candles.push(rawCandles[i]);
    }

    if (candles.length < 15) {
      throw new Error(`عدد الشموع المتاحة لـ ${cleanSymbol} (${candles.length}) غير كافٍ لإجراء تحليل موثوق`);
    }

    // Staleness Check: if last candle is older than 3x the timeframe duration, mark isLive as false
    const lastCandle = candles[candles.length - 1];
    const isStale = currentTime - lastCandle.time > 3 * timeframeMs;
    const isLive = !isStale;

    // Save to cache
    cache.set(cacheKey, { timestamp: now, candles });

    return {
      candles,
      dataSource: isStale
        ? `Binance Spot REST API (${cleanSymbol} - بيانات قديمة/متوقفة)`
        : `Binance Spot REST API (${cleanSymbol} مباشر)`,
      isLive,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`[BinanceAdapter] Fetch error for ${cleanSymbol}:`, err);
    throw new Error(`تعذر جلب شموع ${cleanSymbol} من Binance: ${err.message || err}`);
  }
}

export interface Binance24hTicker {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  lastPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
}

/**
 * Fetches 24h ticker summary (price and % change) for symbols
 */
export async function fetchBinance24hTicker(symbol: string): Promise<Binance24hTicker> {
  const cleanSymbol = symbol.toUpperCase().trim();
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${cleanSymbol}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Ticker error HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      symbol: data.symbol,
      priceChange: parseFloat(data.priceChange) || 0,
      priceChangePercent: parseFloat(data.priceChangePercent) || 0,
      lastPrice: parseFloat(data.lastPrice) || 0,
      highPrice: parseFloat(data.highPrice) || 0,
      lowPrice: parseFloat(data.lowPrice) || 0,
      volume: parseFloat(data.volume) || 0,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw new Error(`فشل جلب ملخص 24h لـ ${cleanSymbol}: ${err.message || err}`);
  }
}

/**
 * Sequential throttled fetch to prevent rate limits during multi-asset scans
 */
export async function throttledFetchCandles(
  symbols: string[],
  timeframe: TimeFrame,
  limit: number = 200,
  delayMs: number = 120
): Promise<Map<string, Candle[]>> {
  const results = new Map<string, Candle[]>();

  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    try {
      const data = await fetchBinanceKlines(sym, timeframe, limit);
      results.set(sym, data.candles);
    } catch (e) {
      console.warn(`[BinanceAdapter] Throttled fetch failed for ${sym}:`, e);
    }

    if (i < symbols.length - 1 && delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
}
