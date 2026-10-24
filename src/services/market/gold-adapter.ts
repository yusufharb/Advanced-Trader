/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Candle, TimeFrame } from '../../types/market.ts';

export interface CSVParseResult {
  success: boolean;
  candles: Candle[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicatesRemoved: number;
  timeGapsDetected: number;
  detectedFormat: 'MetaTrader 4' | 'MetaTrader 5' | 'TradingView' | 'Generic CSV' | 'غير معروف';
  startDate: string | null;
  endDate: string | null;
  errors: string[];
}

/**
 * Parses and strictly validates CSV candles exported from MT4, MT5, or TradingView.
 */
export function parseGoldCSV(csvText: string): CSVParseResult {
  const lines = csvText.trim().split(/\r?\n/);
  const errors: string[] = [];

  if (lines.length < 5) {
    return {
      success: false,
      candles: [],
      totalRows: lines.length,
      validRows: 0,
      invalidRows: lines.length,
      duplicatesRemoved: 0,
      timeGapsDetected: 0,
      detectedFormat: 'غير معروف',
      startDate: null,
      endDate: null,
      errors: ['الملف فارغ أو يحتوي على أسطر غير كافية لإنشاء شموع (أقل من 5 أسطر).'],
    };
  }

  // Detect delimiter: comma, semicolon, or tab
  const sampleLine = lines[0].includes('\t') ? lines[0] : (lines[1] || lines[0]);
  let delimiter = ',';
  if (sampleLine.includes('\t')) delimiter = '\t';
  else if (sampleLine.includes(';') && !sampleLine.includes(',')) delimiter = ';';

  // Check header
  let startIndex = 0;
  const firstLineLower = lines[0].toLowerCase();
  let detectedFormat: CSVParseResult['detectedFormat'] = 'Generic CSV';

  if (firstLineLower.includes('<date>') || firstLineLower.includes('<open>')) {
    detectedFormat = 'MetaTrader 5';
    startIndex = 1;
  } else if (firstLineLower.includes('time') || firstLineLower.includes('date') || firstLineLower.includes('open')) {
    detectedFormat = firstLineLower.includes('tradingview') ? 'TradingView' : 'Generic CSV';
    startIndex = 1;
  } else {
    // If no explicit header, MT4 often starts immediately with rows like 2024.01.15,10:00,2045.5...
    detectedFormat = 'MetaTrader 4';
    startIndex = 0;
  }

  const rawCandles: Candle[] = [];
  let invalidRows = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length < 5) {
      invalidRows++;
      continue;
    }

    let timestamp = 0;
    let open = NaN;
    let high = NaN;
    let low = NaN;
    let close = NaN;
    let volume = 0;

    // Check if separate Date and Time columns (standard MT4/MT5: Date at 0, Time at 1, Open at 2...)
    if (parts.length >= 6 && isDateString(parts[0]) && isTimeString(parts[1])) {
      const datePart = parts[0].replace(/\./g, '-');
      const timePart = parts[1];
      const dt = new Date(`${datePart}T${timePart}Z`);
      timestamp = dt.getTime();
      open = parseFloat(parts[2]);
      high = parseFloat(parts[3]);
      low = parseFloat(parts[4]);
      close = parseFloat(parts[5]);
      volume = parts.length > 6 ? parseFloat(parts[6]) || 0 : 0;
    } else {
      // Single datetime column (TradingView or ISO): Date/Time at 0, Open at 1, High at 2, Low at 3, Close at 4
      const dt = parseFlexibleDateTime(parts[0]);
      timestamp = dt;
      open = parseFloat(parts[1]);
      high = parseFloat(parts[2]);
      low = parseFloat(parts[3]);
      close = parseFloat(parts[4]);
      volume = parts.length > 5 ? parseFloat(parts[5]) || 0 : 0;
    }

    // Strict numerical and OHLC integrity checks
    if (isNaN(timestamp) || timestamp <= 0 || isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
      invalidRows++;
      continue;
    }

    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
      invalidRows++;
      continue;
    }

    if (low > high || high < Math.max(open, close) || low > Math.min(open, close)) {
      invalidRows++;
      errors.push(`شمعة غير صالحة تم تجاهلها في السطر ${i + 1}: تعارض في أسعار OHLC (High=${high}, Low=${low}, Open=${open}, Close=${close})`);
      continue;
    }

    rawCandles.push({
      time: timestamp,
      open,
      high,
      low,
      close,
      volume,
      isClosed: true,
    });
  }

  if (rawCandles.length === 0) {
    return {
      success: false,
      candles: [],
      totalRows: lines.length - startIndex,
      validRows: 0,
      invalidRows,
      duplicatesRemoved: 0,
      timeGapsDetected: 0,
      detectedFormat,
      startDate: null,
      endDate: null,
      errors: ['فشل استخراج أي شمعة صالحة. يرجى التحقق من توافق تنسيق ملف CSV مع صيغ MT4 أو MT5 أو TradingView.'],
    };
  }

  // 1. Sort chronologically
  rawCandles.sort((a, b) => a.time - b.time);

  // 2. Remove duplicate timestamps
  const uniqueCandles: Candle[] = [];
  let duplicatesRemoved = 0;
  for (let i = 0; i < rawCandles.length; i++) {
    if (i > 0 && rawCandles[i].time === rawCandles[i - 1].time) {
      duplicatesRemoved++;
      continue;
    }
    uniqueCandles.push(rawCandles[i]);
  }

  // 3. Detect time gaps
  let timeGapsDetected = 0;
  if (uniqueCandles.length > 2) {
    // Estimate typical time delta from median of first few candles
    const deltas: number[] = [];
    for (let i = 1; i < Math.min(10, uniqueCandles.length); i++) {
      deltas.push(uniqueCandles[i].time - uniqueCandles[i - 1].time);
    }
    deltas.sort((a, b) => a - b);
    const medianDelta = deltas[Math.floor(deltas.length / 2)];

    if (medianDelta > 0) {
      for (let i = 1; i < uniqueCandles.length; i++) {
        const gap = uniqueCandles[i].time - uniqueCandles[i - 1].time;
        if (gap > medianDelta * 3.5) {
          timeGapsDetected++;
        }
      }
    }
  }

  return {
    success: uniqueCandles.length >= 10,
    candles: uniqueCandles,
    totalRows: lines.length - startIndex,
    validRows: uniqueCandles.length,
    invalidRows,
    duplicatesRemoved,
    timeGapsDetected,
    detectedFormat,
    startDate: new Date(uniqueCandles[0].time).toISOString(),
    endDate: new Date(uniqueCandles[uniqueCandles.length - 1].time).toISOString(),
    errors: errors.slice(0, 5),
  };
}

function isDateString(str: string): boolean {
  return /^\d{4}[\.\-\/]\d{1,2}[\.\-\/]\d{1,2}$/.test(str);
}

function isTimeString(str: string): boolean {
  return /^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(str);
}

function parseFlexibleDateTime(str: string): number {
  if (/^\d{10,13}$/.test(str)) {
    const num = parseInt(str, 10);
    return num < 10000000000 ? num * 1000 : num;
  }
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return parsed;

  const parts = str.split(/[ T]/);
  if (parts.length >= 2) {
    const d = parts[0].replace(/\./g, '-');
    return Date.parse(`${d}T${parts[1]}Z`);
  }
  return NaN;
}

const STORAGE_KEY_CANDLES = 'xauusd_imported_candles';
const STORAGE_KEY_META = 'xauusd_imported_meta';

/**
 * Independent Gold Data Adapter class.
 * Allows adding live API providers or loading validated CSV datasets.
 */
export class GoldDataAdapter {
  private static importedCandles: Candle[] = [];
  private static importMetadata: {
    sourceName: string;
    importedAt: number;
    format: string;
  } | null = null;
  private static storageInitialized = false;

  private static ensureStorageInitialized() {
    if (this.storageInitialized) return;
    this.storageInitialized = true;
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        const savedCandles = window.localStorage.getItem(STORAGE_KEY_CANDLES);
        const savedMeta = window.localStorage.getItem(STORAGE_KEY_META);
        if (savedCandles && savedMeta) {
          const parsed = JSON.parse(savedCandles);
          if (Array.isArray(parsed) && parsed.length >= 15) {
            this.importedCandles = parsed;
            this.importMetadata = JSON.parse(savedMeta);
          }
        }
      } catch (e) {
        console.warn('[GoldDataAdapter] Failed to load imported candles from localStorage:', e);
      }
    }
  }

  public static setImportedData(candles: Candle[], sourceName: string, format: string) {
    this.importedCandles = candles;
    this.importMetadata = {
      sourceName,
      importedAt: Date.now(),
      format,
    };

    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY_CANDLES, JSON.stringify(candles));
        window.localStorage.setItem(STORAGE_KEY_META, JSON.stringify(this.importMetadata));
      } catch (e) {
        console.warn('[GoldDataAdapter] Failed to save imported candles to localStorage:', e);
      }
    }
  }

  public static getImportedData(): { candles: Candle[]; metadata: typeof GoldDataAdapter.importMetadata } {
    this.ensureStorageInitialized();
    return {
      candles: this.importedCandles,
      metadata: this.importMetadata,
    };
  }

  public static hasValidData(): boolean {
    this.ensureStorageInitialized();
    return this.importedCandles.length >= 15;
  }

  public static detectOriginalTimeframeMs(candles: Candle[]): number {
    if (!candles || candles.length < 2) return 3600000;
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const deltas: number[] = [];
    for (let i = 1; i < Math.min(30, sorted.length); i++) {
      const d = sorted[i].time - sorted[i - 1].time;
      if (d > 0) deltas.push(d);
    }
    if (deltas.length === 0) return 3600000;
    deltas.sort((a, b) => a - b);
    return deltas[Math.floor(deltas.length / 2)] || 3600000;
  }

  public static formatTimeframeDuration(ms: number): string {
    if (ms <= 300000 * 1.2) return '5m';
    if (ms <= 900000 * 1.2) return '15m';
    if (ms <= 1800000 * 1.2) return '30m';
    if (ms <= 3600000 * 1.2) return '1h';
    if (ms <= 14400000 * 1.2) return '4h';
    return '1d';
  }

  /**
   * Mathematically aggregates candles into the requested timeframe period.
   * If target timeframe is smaller than the original imported timeframe,
   * returns the original candles without inverse splitting or fake relabeling.
   */
  public static resampleCandles(candles: Candle[], targetTimeframe: TimeFrame): Candle[] {
    if (!candles || candles.length === 0) return [];

    const timeframeMsMap: Record<TimeFrame, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };

    const bucketMs = timeframeMsMap[targetTimeframe] || 60 * 60 * 1000;
    const nativeIntervalMs = this.detectOriginalTimeframeMs(candles);

    // If requested timeframe is smaller than the file's original resolution (e.g. file is 1h and user chose 5m or 15m),
    // do not inversely resample or fake higher resolution; return candles with their native timeframe
    if (bucketMs < nativeIntervalMs * 0.8) {
      return [...candles].sort((a, b) => a.time - b.time);
    }

    const sorted = [...candles].sort((a, b) => a.time - b.time);

    // Group into buckets
    const buckets = new Map<number, Candle[]>();
    for (const c of sorted) {
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
   * Fetches real gold data or returns explicit error status.
   * If user has imported CSV, returns the imported data resampled to target timeframe
   * (or preserved in its native resolution if target is smaller).
   * Otherwise checks public PAXGUSDT spot feed with explicit isProxy: true.
   */
  public static async getGoldData(timeframe: TimeFrame = '1h'): Promise<{
    candles: Candle[];
    dataSource: string;
    isLive: boolean;
    isProxy: boolean;
  }> {
    this.ensureStorageInitialized();

    // 1. If user uploaded a valid CSV file, use it as priority
    if (this.hasValidData()) {
      const timeframeMsMap: Record<TimeFrame, number> = {
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
      };
      const requestedBucketMs = timeframeMsMap[timeframe] || 3600000;
      const nativeMs = this.detectOriginalTimeframeMs(this.importedCandles);
      const nativeLabel = this.formatTimeframeDuration(nativeMs);

      // Check if user requested a timeframe smaller than the file's native resolution
      if (requestedBucketMs < nativeMs * 0.8) {
        return {
          candles: this.importedCandles,
          dataSource: `ملف شموع مستورد من (${this.importMetadata?.format || 'منصة التداول'}) - ${this.importMetadata?.sourceName} [الإطار الأصلي للملف: ${nativeLabel} - تعذر التجميع العكسي لإطار أصغر ${timeframe}]`,
          isLive: false,
          isProxy: false,
        };
      }

      const resampled = this.resampleCandles(this.importedCandles, timeframe);
      const effectiveCandles = resampled.length >= 10 ? resampled : this.importedCandles;

      return {
        candles: effectiveCandles,
        dataSource: `ملف شموع مستورد من (${this.importMetadata?.format || 'منصة التداول'}) - ${this.importMetadata?.sourceName} [إطار مجمع ${timeframe}]`,
        isLive: false,
        isProxy: false,
      };
    }

    // 2. Fetch PAXGUSDT as a real physical gold-backed asset proxy from Binance
    try {
      const intervalMap: Record<TimeFrame, string> = {
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '4h': '4h',
        '1d': '1d',
      };
      const interval = intervalMap[timeframe] || '1h';
      const url = `https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${interval}&limit=200`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw) && raw.length > 20) {
          const timeframeMs = intervalMap[timeframe] === '5m' ? 300000 : intervalMap[timeframe] === '15m' ? 900000 : intervalMap[timeframe] === '30m' ? 1800000 : intervalMap[timeframe] === '1h' ? 3600000 : intervalMap[timeframe] === '4h' ? 14400000 : 86400000;
          const now = Date.now();

          const candles: Candle[] = [];
          for (let i = 0; i < raw.length; i++) {
            const r = raw[i];
            const t = Number(r[0]);
            const o = parseFloat(r[1]);
            const h = parseFloat(r[2]);
            const l = parseFloat(r[3]);
            const c = parseFloat(r[4]);
            const v = parseFloat(r[5]);

            if (isNaN(t) || isNaN(o) || isNaN(h) || isNaN(l) || isNaN(c) || o <= 0 || h <= 0 || l <= 0 || c <= 0) {
              continue;
            }
            if (l > h || h < Math.max(o, c) || l > Math.min(o, c)) {
              continue;
            }

            candles.push({
              time: t,
              open: o,
              high: h,
              low: l,
              close: c,
              volume: v,
              isClosed: t + timeframeMs <= now,
            });
          }

          candles.sort((a, b) => a.time - b.time);

          if (candles.length >= 15) {
            const lastCandle = candles[candles.length - 1];
            const isStale = now - lastCandle.time > 3 * timeframeMs;

            return {
              candles,
              dataSource: isStale
                ? 'بيانات الذهب المرجعية البديلة عبر PAXG/USDT (بيانات متوقفة أو قديمة)'
                : 'بيانات الذهب المرجعية البديلة عبر أصل PAXG/USDT (الذهب الرقمي البديل من باكسوس) – مع مراعاة السبريد وفروق الأسعار مقارنة بعقد XAUUSD لدى الوسيط',
              isLive: !isStale,
              isProxy: true,
            };
          }
        }
      }
    } catch (e) {
      console.warn('[GoldDataAdapter] Proxy feed unavailable:', e);
    }

    // If neither exists, throw explicit requirement to import CSV
    throw new Error(
      'لا تتوفر بيانات حقيقية مباشرة للذهب حالياً. يرجى استيراد ملف شموع CSV من منصة ميتاتريدر (MT4/MT5) أو تريدنج فيو عبر زر "استيراد ملف CSV" لإجراء التحليل الفني بدقة.'
    );
  }
}
