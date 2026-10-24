/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Candle, TimeFrame, MarketSymbol } from '../../types/market.ts';
import { getTimeframeMs } from './binance-adapter.ts';
import {
  isEgxStockSymbol,
  isKnownUsStock,
  normalizeDisplaySymbol,
} from './custom-assets.ts';

// Mapping from system symbol to Yahoo Finance ticker
export const YAHOO_SYMBOL_MAP: Partial<Record<MarketSymbol, string>> = {
  XAGUSD: 'SI=F',
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'USDJPY=X',
  USDCHF: 'USDCHF=X',
  USDCAD: 'USDCAD=X',
  AUDUSD: 'AUDUSD=X',
  NZDUSD: 'NZDUSD=X',
};

const YAHOO_SHORTCUT_ALIASES: Record<string, string> = {
  OIL: 'CL=F',
  USOIL: 'CL=F',
  WTI: 'CL=F',
  CRUDE: 'CL=F',
  BRENT: 'BZ=F',
  UKOIL: 'BZ=F',
  NATGAS: 'NG=F',
  NG: 'NG=F',
  COPPER: 'HG=F',
  HG: 'HG=F',
  PLATINUM: 'PL=F',
  XPTUSD: 'PL=F',
  PALLADIUM: 'PA=F',
  XPDUSD: 'PA=F',
  NAS100: '^NDX',
  NDX: '^NDX',
  USTEC: '^NDX',
  US100: '^NDX',
  SPX: '^GSPC',
  US500: '^GSPC',
  SP500: '^GSPC',
  DJI: '^DJI',
  US30: '^DJI',
  DJ30: '^DJI',
  DOW: '^DJI',
  RUT: '^RUT',
  US2000: '^RUT',
  VIX: '^VIX',
  DXY: 'DX-Y.NYB',
  USDX: 'DX-Y.NYB',
  DAX: '^GDAXI',
  GER40: '^GDAXI',
  DE40: '^GDAXI',
  FTSE: '^FTSE',
  UK100: '^FTSE',
  NIKKEI: '^N225',
  JP225: '^N225',
};

const CRYPTO_BASE_NOT_FOREX = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOG', 'DOT', 'AVAX', 'SHIB',
  'LTC', 'TRX', 'UNI', 'ATOM', 'LINK', 'XLM', 'NEAR', 'APT', 'ARB', 'OP',
  'SUI', 'TON', 'PEPE', 'FIL', 'HBAR', 'ICP', 'VET', 'AAVE', 'ETC', 'BCH',
]);

/**
 * Intelligently resolves any user-entered or standard market symbol into its Yahoo Finance ticker:
 * - Mapped core symbols (e.g. XAGUSD -> SI=F, EURUSD -> EURUSD=X)
 * - Common shortcuts (OIL/USOIL -> CL=F, NAS100/NDX -> ^NDX, SPX/US500 -> ^GSPC, DJI/US30 -> ^DJI)
 * - Egyptian Exchange (EGX) stocks (e.g. AMII -> AMII.CA, COMI -> COMI.CA, FWRY -> FWRY.CA)
 * - 6-letter Latin Forex cross pairs (e.g. GBPJPY -> GBPJPY=X, EURJPY -> EURJPY=X, EURGBP -> EURGBP=X)
 * - Standard US/Global equity tickers (e.g. AAPL, NVDA, TSLA, MSFT, AMZN, META, AMD, GOOGL)
 */
export function resolveYahooTicker(symbol: string): string {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return '';

  if (clean in YAHOO_SYMBOL_MAP) {
    return YAHOO_SYMBOL_MAP[clean as MarketSymbol]!;
  }

  if (clean in YAHOO_SHORTCUT_ALIASES) {
    return YAHOO_SHORTCUT_ALIASES[clean];
  }

  // Already a Yahoo ticker format (e.g. ^NDX, CL=F, EURJPY=X, AMII.CA)
  if (clean.startsWith('^') || clean.endsWith('=X') || clean.endsWith('=F') || clean.endsWith('.CA')) {
    return clean;
  }

  // Known US Stocks never get .CA
  if (isKnownUsStock(clean)) {
    return clean;
  }

  // Egyptian Exchange (EGX) stock check (e.g. AMII, COMI, FWRY, TMGH, SWDY...)
  if (isEgxStockSymbol(clean)) {
    const base = normalizeDisplaySymbol(clean);
    return `${base}.CA`;
  }

  // 6-letter Latin Forex pair (e.g. GBPJPY, EURJPY, EURGBP, AUDJPY, CADJPY, EURAUD)
  // Exclude crypto tickers ending in USDT or known 3-letter crypto bases paired with USD
  if (/^[A-Z]{6}$/.test(clean) && !clean.endsWith('USDT')) {
    const base = clean.slice(0, 3);
    const quote = clean.slice(3, 6);
    if (!CRYPTO_BASE_NOT_FOREX.has(base)) {
      return `${clean}=X`;
    }
    if (quote === 'USD') {
      return `${base}-USD`;
    }
  }

  return clean;
}

// In-memory cache to prevent spamming endpoints and ensure rapid scanning
interface CacheEntry {
  candles: Candle[];
  timestamp: number;
  dataSource: string;
  isLive: boolean;
  providerSymbol?: string;
  market?: string;
  currency?: string;
}

const candleCache = new Map<string, CacheEntry>();
const priceCache = new Map<string, { price: number; change24h: number; timestamp: number }>();
const CACHE_TTL_MS = 25000; // 25 seconds cache

export function clearForexCandleCache(): void {
  candleCache.clear();
  priceCache.clear();
}

/**
 * Known Yahoo Finance ISIN-based tickers for EGX stocks whose short code (.CA) redirects to ISIN on Yahoo Finance
 */
export const EGX_YAHOO_ISIN_FALLBACKS: Record<string, string> = {
  AMII: 'EGS3E1E1C013.CA',
  MAII: 'EGS3E1E1C013.CA',
  ESRS: 'EGS3C251C013-EGP.CA',
  PALM: 'EGS655L1C012.CA',
};

/**
 * Resamples 1-hour candles into 4-hour candles
 */
export function resampleCandlesTo4H(hourlyCandles: Candle[]): Candle[] {
  if (hourlyCandles.length === 0) return [];
  const bucketMs = 4 * 60 * 60 * 1000;
  const buckets = new Map<number, Candle[]>();

  for (const c of hourlyCandles) {
    const bucketTime = Math.floor(c.time / bucketMs) * bucketMs;
    const list = buckets.get(bucketTime);
    if (list) {
      list.push(c);
    } else {
      buckets.set(bucketTime, [c]);
    }
  }

  const resampled: Candle[] = [];
  const now = Date.now();

  for (const [bucketTime, items] of buckets.entries()) {
    if (items.length === 0) continue;
    const open = items[0].open;
    const close = items[items.length - 1].close;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;

    for (const item of items) {
      if (item.high > high) high = item.high;
      if (item.low < low) low = item.low;
      volume += item.volume || 0;
    }

    resampled.push({
      time: bucketTime,
      open,
      high,
      low,
      close,
      volume,
      isClosed: now >= bucketTime + bucketMs,
    });
  }

  resampled.sort((a, b) => a.time - b.time);
  return resampled;
}

/**
 * Resamples intraday (1-hour) candles into Daily (1d) candles when a provider ticker only exposes intraday history
 */
export function resampleCandlesTo1D(hourlyCandles: Candle[]): Candle[] {
  if (hourlyCandles.length === 0) return [];
  const dayMs = 24 * 60 * 60 * 1000;
  const buckets = new Map<number, Candle[]>();

  for (const c of hourlyCandles) {
    const bucketTime = Math.floor(c.time / dayMs) * dayMs;
    const list = buckets.get(bucketTime);
    if (list) {
      list.push(c);
    } else {
      buckets.set(bucketTime, [c]);
    }
  }

  const resampled: Candle[] = [];
  const now = Date.now();

  for (const [bucketTime, items] of buckets.entries()) {
    if (items.length === 0) continue;
    const open = items[0].open;
    const close = items[items.length - 1].close;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;

    for (const item of items) {
      if (item.high > high) high = item.high;
      if (item.low < low) low = item.low;
      volume += item.volume || 0;
    }

    resampled.push({
      time: bucketTime,
      open,
      high,
      low,
      close,
      volume,
      isClosed: now >= bucketTime + dayMs,
    });
  }

  resampled.sort((a, b) => a.time - b.time);
  return resampled;
}

/**
 * Computes median time difference in ms between consecutive candles to verify actual timeframe
 */
export function computeMedianCandleStepMs(candles: Candle[]): number {
  if (candles.length < 2) return 0;
  const diffs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const d = candles[i].time - candles[i - 1].time;
    if (d > 0) diffs.push(d);
  }
  if (diffs.length === 0) return 0;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

/**
 * Parses and validates raw Yahoo chart payload into clean sorted candles
 */
function parseYahooChartCandles(
  result: any,
  timeframeMs: number,
  need4HResample: boolean
): Candle[] {
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const rawCandles: Candle[] = [];
  const currentTime = Date.now();

  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i] * 1000;
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    const v = quote.volume?.[i] || 0;

    if (
      typeof o !== 'number' ||
      typeof h !== 'number' ||
      typeof l !== 'number' ||
      typeof c !== 'number' ||
      isNaN(o) ||
      isNaN(h) ||
      isNaN(l) ||
      isNaN(c) ||
      o <= 0 ||
      h <= 0 ||
      l <= 0 ||
      c <= 0 ||
      l > h ||
      h < Math.max(o, c) ||
      l > Math.min(o, c)
    ) {
      continue;
    }

    const isClosed = t + timeframeMs <= currentTime;

    rawCandles.push({
      time: t,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v,
      isClosed,
    });
  }

  let candlesToUse = rawCandles;
  if (need4HResample && candlesToUse.length > 0) {
    candlesToUse = resampleCandlesTo4H(candlesToUse);
  }

  candlesToUse.sort((a, b) => a.time - b.time);

  const uniqueCandles: Candle[] = [];
  for (let i = 0; i < candlesToUse.length; i++) {
    if (i > 0 && candlesToUse[i].time === candlesToUse[i - 1].time) {
      continue;
    }
    uniqueCandles.push(candlesToUse[i]);
  }

  return uniqueCandles;
}

/**
 * Fetches real market candles for Forex Majors/Crosses, Silver, Global Stocks, EGX Stocks, and Indices.
 * Strictly throws an error on failure without generating any synthetic or artificial candles.
 */
export async function fetchForexMetalsKlines(
  symbol: MarketSymbol,
  timeframe: TimeFrame = '1h',
  limit: number = 150
): Promise<{
  candles: Candle[];
  dataSource: string;
  isLive: boolean;
  providerSymbol?: string;
  market?: string;
  currency?: string;
}> {
  const canonicalSym = normalizeDisplaySymbol(symbol);
  const cacheKey = `${canonicalSym}_${timeframe}`;
  const cached = candleCache.get(cacheKey);
  const now = Date.now();
  const timeframeMs = getTimeframeMs(timeframe);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    const last = cached.candles[cached.candles.length - 1];
    const isStale = last ? now - last.time > 3 * timeframeMs : false;
    return {
      candles: cached.candles.slice(-limit),
      dataSource: cached.dataSource,
      isLive: !isStale && cached.isLive,
      providerSymbol: cached.providerSymbol,
      market: cached.market,
      currency: cached.currency,
    };
  }

  // When running inside the browser, proxy through local server endpoint to bypass CORS restrictions
  if (typeof window !== 'undefined' && window.location && !(globalThis as any).__TEST_DISABLE_PROXY__) {
    try {
      const serverRes = await fetch(
        `/api/market/candles?symbol=${encodeURIComponent(canonicalSym)}&timeframe=${timeframe}&limit=${limit}`
      );
      const json = await serverRes.json().catch(() => null);
      if (json && json.timeframeUnsupported) {
        const tfErr: any = new Error(
          json.error ||
            `البيانات اللحظية (${timeframe}) غير متاحة لـ ${canonicalSym} من المصدر المجاني؛ الفاصل المتاح هو اليومي (1d).`
        );
        tfErr.code = 'TIMEFRAME_UNSUPPORTED';
        tfErr.suggestedTimeframe = json.suggestedTimeframe || '1d';
        throw tfErr;
      }
      if (serverRes.ok && json && json.success && Array.isArray(json.candles) && json.candles.length >= 1) {
        const last = json.candles[json.candles.length - 1];
        const change = json.priceChangePercent24h ?? 0;
        priceCache.set(canonicalSym, { price: last.close, change24h: change, timestamp: Date.now() });

        candleCache.set(cacheKey, {
          candles: json.candles,
          timestamp: Date.now(),
          dataSource: json.dataSource || `بيانات السوق (${canonicalSym})`,
          isLive: Boolean(json.isLive),
          providerSymbol: json.providerSymbol,
          market: json.market,
          currency: json.currency,
        });

        return {
          candles: json.candles.slice(-limit),
          dataSource: json.dataSource || `بيانات السوق (${canonicalSym})`,
          isLive: Boolean(json.isLive),
          providerSymbol: json.providerSymbol,
          market: json.market,
          currency: json.currency,
        };
      }
    } catch (proxyErr: any) {
      if (proxyErr?.code === 'TIMEFRAME_UNSUPPORTED') {
        throw proxyErr;
      }
      // Fallback to direct Yahoo fetch if local server is unreachable
    }
  }

  const primaryTicker = resolveYahooTicker(symbol);
  if (!primaryTicker) {
    throw new Error(`تعذر جلب شموع حقيقية: الرمز ${symbol} غير صالح في محول الأسواق العالمية.`);
  }

  // Build candidate tickers list: if a 3-5 letter stock ticker isn't a known US stock or already .CA, also try .CA as fallback
  const tickersToTry: string[] = [primaryTicker];
  const isinFallback = EGX_YAHOO_ISIN_FALLBACKS[canonicalSym];
  if (isinFallback && !tickersToTry.includes(isinFallback)) {
    tickersToTry.push(isinFallback);
  }
  if (
    !primaryTicker.endsWith('.CA') &&
    !primaryTicker.endsWith('=X') &&
    !primaryTicker.endsWith('=F') &&
    !primaryTicker.startsWith('^') &&
    primaryTicker !== 'DX-Y.NYB' &&
    !isKnownUsStock(primaryTicker) &&
    /^[A-Z]{3,5}$/.test(primaryTicker)
  ) {
    tickersToTry.push(`${primaryTicker}.CA`);
  }

  let interval = '1h';
  let range = '1mo';
  const need4HResample = timeframe === '4h';

  switch (timeframe) {
    case '5m':
      interval = '5m';
      range = '5d';
      break;
    case '15m':
      interval = '15m';
      range = '5d';
      break;
    case '30m':
      interval = '30m';
      range = '5d';
      break;
    case '1h':
      interval = '1h';
      range = '1mo';
      break;
    case '4h':
      interval = '1h'; // Fetch 1h and mathematically resample to 4h
      range = '1mo';
      break;
    case '1d':
      interval = '1d';
      range = '1y';
      break;
  }

  for (const yahooTicker of tickersToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=${interval}&range=${range}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json: any = await res.json();
        const result = json.chart?.result?.[0];
        const metaGranularity = String(result?.meta?.dataGranularity || '').toLowerCase();

        // Parse raw candles without 4h resampling first to check actual step interval
        const unresampled = parseYahooChartCandles(result, timeframeMs, false);
        const medianStepMs = computeMedianCandleStepMs(unresampled);

        // Verify actual candle interval: prevent displaying daily (1d) candles under intraday (5m/15m/30m/1h/4h) labels
        const isIntradayRequest = timeframe !== '1d';
        const isActuallyDailyData =
          metaGranularity === '1d' ||
          metaGranularity === '1wk' ||
          (unresampled.length >= 2 && medianStepMs >= 20 * 60 * 60 * 1000);

        if (isIntradayRequest && isActuallyDailyData && unresampled.length > 0) {
          const tfErr: any = new Error(
            `البيانات اللحظية (${timeframe}) غير متاحة لـ ${canonicalSym} من المصدر المجاني؛ يتم توفير بيانات الإغلاق اليومية (1d) فقط.`
          );
          tfErr.code = 'TIMEFRAME_UNSUPPORTED';
          tfErr.suggestedTimeframe = '1d';
          throw tfErr;
        }

        let uniqueCandles = need4HResample
          ? resampleCandlesTo4H(unresampled)
          : unresampled;

        // If 1d was requested for an EGX ISIN ticker (e.g. EGS3E1E1C013.CA for AMII) and Yahoo returned <= 2 daily bars,
        // aggregate its rich 6-month 1h history into daily (1d) candles
        if (timeframe === '1d' && uniqueCandles.length <= 2 && yahooTicker.endsWith('.CA')) {
          try {
            const hRes = await fetch(
              `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1h&range=6mo`,
              { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }
            );
            if (hRes.ok) {
              const hJson: any = await hRes.json();
              const hResult = hJson?.chart?.result?.[0];
              const hCandles = parseYahooChartCandles(hResult, 3600 * 1000, false);
              const dailyFromHourly = resampleCandlesTo1D(hCandles);
              if (dailyFromHourly.length > uniqueCandles.length) {
                uniqueCandles = dailyFromHourly;
              }
            }
          } catch {
            // Keep existing uniqueCandles if hourly aggregation fails
          }
        }

        // Allow >= 1 candle for chart rendering (decoupled from the 15-candle quantitative analysis threshold)
        if (uniqueCandles.length >= 1) {
          const currentTime = Date.now();
          const last = uniqueCandles[uniqueCandles.length - 1];
          const first = uniqueCandles[0];
          const change =
            first && first.close > 0 ? ((last.close - first.close) / first.close) * 100 : 0;
          priceCache.set(canonicalSym, {
            price: last.close,
            change24h: change,
            timestamp: Date.now(),
          });

          const isEgx =
            yahooTicker.endsWith('.CA') ||
            String(result?.meta?.exchangeName || '').toUpperCase() === 'CAI';
          const isForexTicker = yahooTicker.endsWith('=X');
          const isFuturesTicker = yahooTicker.endsWith('=F');
          const isIndexTicker = yahooTicker.startsWith('^') || yahooTicker === 'DX-Y.NYB';

          // Staleness Check: if last candle age > 3x timeframe duration or if EGX EOD data, never falsely claim Live
          const isStale = currentTime - last.time > 3 * timeframeMs;
          const isLive = isEgx ? false : !isStale;

          const srcLabel = isEgx
            ? `بيانات البورصة المصرية (EGX - ${canonicalSym} / ${yahooTicker} - EGP) - إغلاق يومي / تاريخي (EOD)`
            : isStale
            ? canonicalSym === 'XAGUSD'
              ? 'بيانات الفضة (COMEX Silver Spot / SI=F) - السوق مغلق حالياً / بيانات قديمة'
              : isForexTicker
              ? `بيانات سوق العملات الأجنبية (${canonicalSym} Forex Spot) - عطلة نهاية الأسبوع / السوق مغلق`
              : isFuturesTicker
              ? `بيانات سوق السلع والعقود (${canonicalSym} / ${yahooTicker}) - السوق مغلق حالياً`
              : isIndexTicker
              ? `بيانات المؤشرات العالمية (${canonicalSym} / ${yahooTicker}) - الجلسة مغلقة حالياً`
              : `بيانات الأسهم والأسواق العالمية (${canonicalSym}) - بيانات إغلاق تاريخية / الجلسة مغلقة`
            : canonicalSym === 'XAGUSD'
            ? 'بيانات الفضة اللحظية (COMEX Silver Spot / SI=F مباشر)'
            : isForexTicker
            ? `بيانات سوق العملات الأجنبية الحية (${canonicalSym} Forex Spot)`
            : isFuturesTicker
            ? `بيانات سوق السلع المباشرة (${canonicalSym} / ${yahooTicker})`
            : isIndexTicker
            ? `بيانات المؤشرات العالمية الحية (${canonicalSym} / ${yahooTicker})`
            : `بيانات البورصة والأسهم الحية (${canonicalSym} Equity Direct)`;

          const market = isEgx ? 'EGX' : isForexTicker ? 'FOREX' : 'US';
          const currency = isEgx
            ? 'EGP'
            : String(result?.meta?.currency || 'USD').toUpperCase();

          candleCache.set(cacheKey, {
            candles: uniqueCandles,
            timestamp: Date.now(),
            dataSource: srcLabel,
            isLive,
            providerSymbol: yahooTicker,
            market,
            currency,
          });

          return {
            candles: uniqueCandles.slice(-limit),
            dataSource: srcLabel,
            isLive,
            providerSymbol: yahooTicker,
            market,
            currency,
          };
        }
      }

      // If intraday request for an EGX (.CA) stock returned 0 candles or 404/422, probe 1d to see if daily data exists
      if (timeframe !== '1d' && yahooTicker.endsWith('.CA')) {
        const probeRes = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1y`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }
        );
        if (probeRes.ok) {
          const probeJson: any = await probeRes.json().catch(() => null);
          const probeResult = probeJson?.chart?.result?.[0];
          const probeCandles = parseYahooChartCandles(probeResult, 24 * 3600 * 1000, false);
          if (probeCandles.length >= 1) {
            const tfErr: any = new Error(
              `البيانات اللحظية (${timeframe}) غير متاحة لسهم ${canonicalSym} (${yahooTicker}) من المصدر المجاني؛ يتوفر الشارت اليومي (1d) فقط.`
            );
            tfErr.code = 'TIMEFRAME_UNSUPPORTED';
            tfErr.suggestedTimeframe = '1d';
            throw tfErr;
          }
        }
      }
    } catch (err: any) {
      if (err?.code === 'TIMEFRAME_UNSUPPORTED') {
        throw err;
      }
      console.warn(`[ForexMetalsAdapter] Real feed fetch failed for ${yahooTicker}:`, err.message);
    }
  }

  // Purely fail with clear error - NEVER fabricate random or synthetic candles
  const isEgxTarget = primaryTicker.endsWith('.CA');
  throw new Error(
    isEgxTarget
      ? `تعذر جلب شموع حقيقية لسهم ${canonicalSym} (${primaryTicker}) من مزود Yahoo Finance المجاني (قد يكون الرمز غير مغطى تاريخياً في المزود المجاني أو متوقفاً). يمكنك استيراد ملف CSV للسهم لعرض الشارت وتحليله.`
      : `تعذر جلب شموع حقيقية لـ ${canonicalSym} من مزود السوق المباشر. قد يكون السوق مغلقاً أو الرمز غير متاح حالياً.`
  );
}

/**
 * Quick live price ticker for price alerts and scanner cards.
 * Never returns synthetic or fabricated prices.
 */
export async function fetchForexMetalsPrice(symbol: MarketSymbol): Promise<{
  price: number;
  change24h: number;
  isLive: boolean;
}> {
  const canonicalSym = normalizeDisplaySymbol(symbol);
  const cached = priceCache.get(canonicalSym);
  if (cached && Date.now() - cached.timestamp < 15000) {
    return { price: cached.price, change24h: cached.change24h, isLive: !isEgxStockSymbol(canonicalSym) };
  }

  // When in browser, try local server ticker first to avoid CORS
  if (typeof window !== 'undefined' && window.location && !(globalThis as any).__TEST_DISABLE_PROXY__) {
    try {
      const serverRes = await fetch(`/api/market/forex-ticker?symbol=${encodeURIComponent(canonicalSym)}`);
      if (serverRes.ok) {
        const json = await serverRes.json();
        if (json.success && json.price > 0) {
          priceCache.set(canonicalSym, { price: json.price, change24h: json.change24h || 0, timestamp: Date.now() });
          return { price: json.price, change24h: json.change24h || 0, isLive: Boolean(json.isLive) };
        }
      }
    } catch {
      // Fall through to direct fetch
    }
  }

  try {
    const tf: TimeFrame = isEgxStockSymbol(canonicalSym) ? '1d' : '1h';
    const res = await fetchForexMetalsKlines(canonicalSym, tf, 5);
    const last = res.candles[res.candles.length - 1];
    if (last && last.close > 0) {
      return { price: last.close, change24h: 0, isLive: res.isLive };
    }
  } catch {
    // Graceful error state
  }

  return { price: 0, change24h: 0, isLive: false };
}
