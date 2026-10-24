/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Candle,
  EMAData,
  RSIData,
  MACDData,
  BollingerData,
  ATRData,
  PivotLevels,
  FibonacciLevels,
  SwingPoint,
  SupportResistanceZone,
  DivergenceSignal,
  BreakoutSignal,
  StochasticData,
  ADXData,
  IchimokuData,
  VolumeAnalysisData,
} from '../types/market.ts';

/**
 * Dynamically rounds price levels based on asset magnitude to avoid truncating Forex and low-priced assets.
 */
export function roundPrice(value: number, referencePrice?: number): number {
  const ref = Math.abs(referencePrice ?? value);
  if (ref === 0 || !Number.isFinite(ref)) return 0;
  const decimals = ref < 2 ? 5 : ref < 10 ? 4 : ref < 200 ? 3 : 2;
  return Number(value.toFixed(decimals));
}

/**
 * Calculates Exponential Moving Average (EMA).
 * Formula: multiplier = 2 / (period + 1)
 * EMA_t = (Close_t * multiplier) + (EMA_{t-1} * (1 - multiplier))
 */
export function calculateEMASeries(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) {
    return result;
  }

  // Initial SMA seed
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let currentEMA = sum / period;
  result[period - 1] = currentEMA;

  const multiplier = 2 / (period + 1);

  for (let i = period; i < candles.length; i++) {
    currentEMA = (candles[i].close * multiplier) + (currentEMA * (1 - multiplier));
    result[i] = currentEMA;
  }

  return result;
}

export function calculateEMA(candles: Candle[]): EMAData {
  const ema20Series = calculateEMASeries(candles, 20);
  const ema50Series = calculateEMASeries(candles, 50);
  const ema200Series = calculateEMASeries(candles, 200);

  const lastIdx = candles.length - 1;
  return {
    ema20: lastIdx >= 0 ? ema20Series[lastIdx] : null,
    ema50: lastIdx >= 0 ? ema50Series[lastIdx] : null,
    ema200: lastIdx >= 0 ? ema200Series[lastIdx] : null,
  };
}

/**
 * Calculates Relative Strength Index (RSI) using Wilder's Smoothing.
 * Period: 14 default.
 */
export function calculateRSISeries(candles: Candle[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) {
    return result;
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      rs = avgGain / avgLoss;
      result[i] = 100 - (100 / (1 + rs));
    }
  }

  return result;
}

export function calculateRSI(candles: Candle[], period: number = 14): RSIData {
  const series = calculateRSISeries(candles, period);
  const lastVal = series.length > 0 ? series[series.length - 1] : null;

  let state: 'overbought' | 'oversold' | 'neutral' = 'neutral';
  if (lastVal !== null) {
    if (lastVal >= 70) state = 'overbought';
    else if (lastVal <= 30) state = 'oversold';
  }

  return {
    value: lastVal !== null ? Number(lastVal.toFixed(2)) : null,
    state,
  };
}

/**
 * Calculates Moving Average Convergence Divergence (MACD).
 * Fast: 12, Slow: 26, Signal: 9
 */
export function calculateMACDSeries(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macdLine: (number | null)[];
  signalLine: (number | null)[];
  histogram: (number | null)[];
} {
  const emaFast = calculateEMASeries(candles, fastPeriod);
  const emaSlow = calculateEMASeries(candles, slowPeriod);

  const macdLine: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = 0; i < candles.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine[i] = (emaFast[i] as number) - (emaSlow[i] as number);
    }
  }

  // Calculate EMA of MACD line for Signal Line
  const validMacdValues: { index: number; value: number }[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) {
      validMacdValues.push({ index: i, value: macdLine[i] as number });
    }
  }

  const signalLine: (number | null)[] = new Array(candles.length).fill(null);
  const histogram: (number | null)[] = new Array(candles.length).fill(null);

  if (validMacdValues.length >= signalPeriod) {
    let sum = 0;
    for (let i = 0; i < signalPeriod; i++) {
      sum += validMacdValues[i].value;
    }
    let currentSignal = sum / signalPeriod;
    const startIdx = validMacdValues[signalPeriod - 1].index;
    signalLine[startIdx] = currentSignal;
    histogram[startIdx] = (macdLine[startIdx] as number) - currentSignal;

    const multiplier = 2 / (signalPeriod + 1);
    for (let i = signalPeriod; i < validMacdValues.length; i++) {
      const idx = validMacdValues[i].index;
      currentSignal = (validMacdValues[i].value * multiplier) + (currentSignal * (1 - multiplier));
      signalLine[idx] = currentSignal;
      histogram[idx] = (macdLine[idx] as number) - currentSignal;
    }
  }

  return { macdLine, signalLine, histogram };
}

export function calculateMACD(candles: Candle[]): MACDData {
  const { macdLine, signalLine, histogram } = calculateMACDSeries(candles);
  const last = candles.length - 1;

  const currentMacd = last >= 0 ? macdLine[last] : null;
  const currentSignal = last >= 0 ? signalLine[last] : null;
  const currentHist = last >= 0 ? histogram[last] : null;

  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (currentHist !== null) {
    trend = currentHist > 0 ? 'bullish' : currentHist < 0 ? 'bearish' : 'neutral';
  }

  let cross: 'bullish_cross' | 'bearish_cross' | 'none' = 'none';
  if (last >= 1 && histogram[last] !== null && histogram[last - 1] !== null) {
    const prevH = histogram[last - 1] as number;
    const currH = histogram[last] as number;
    if (prevH <= 0 && currH > 0) cross = 'bullish_cross';
    else if (prevH >= 0 && currH < 0) cross = 'bearish_cross';
  }

  return {
    macdLine: currentMacd !== null ? Number(currentMacd.toFixed(3)) : null,
    signalLine: currentSignal !== null ? Number(currentSignal.toFixed(3)) : null,
    histogram: currentHist !== null ? Number(currentHist.toFixed(3)) : null,
    trend,
    cross,
  };
}

/**
 * Calculates Average True Range (ATR) with Wilder's smoothing.
 */
export function calculateATRSeries(candles: Candle[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) return result;

  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const prevC = candles[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    trs.push(tr);
  }

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trs[i];
  }
  let currentATR = sum / period;
  result[period - 1] = currentATR;

  for (let i = period; i < candles.length; i++) {
    currentATR = (currentATR * (period - 1) + trs[i]) / period;
    result[i] = currentATR;
  }

  return result;
}

export function calculateATR(candles: Candle[], period: number = 14): ATRData {
  const series = calculateATRSeries(candles, period);
  const last = candles.length - 1;
  const val = last >= 0 ? series[last] : null;
  const close = last >= 0 ? candles[last].close : 1;

  return {
    value: val !== null ? roundPrice(val, close) : null,
    volatilityPercent: val !== null && close > 0 ? Number(((val / close) * 100).toFixed(2)) : null,
  };
}

/**
 * Calculates Bollinger Bands (20 period, 2 std dev).
 */
export function calculateBollingerBands(candles: Candle[], period: number = 20, multiplier: number = 2): BollingerData {
  if (candles.length < period) {
    return { upper: null, middle: null, lower: null, bandwidth: null, percentB: null };
  }

  const slice = candles.slice(-period);
  const mean = slice.reduce((acc, c) => acc + c.close, 0) / period;

  // Sample standard deviation
  const variance = slice.reduce((acc, c) => acc + Math.pow(c.close - mean, 2), 0) / (period - 1);
  const std = Math.sqrt(variance);

  const upper = mean + (multiplier * std);
  const lower = mean - (multiplier * std);
  const bandwidth = mean > 0 ? ((upper - lower) / mean) * 100 : 0;

  const currentPrice = candles[candles.length - 1].close;
  const percentB = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;

  return {
    upper: roundPrice(upper, currentPrice),
    middle: roundPrice(mean, currentPrice),
    lower: roundPrice(lower, currentPrice),
    bandwidth: Number(bandwidth.toFixed(2)),
    percentB: Number(percentB.toFixed(2)),
  };
}

/**
 * Calculates Pivot Points (Classic and Fibonacci).
 * Derived from the previous completed period or recent bar distribution.
 */
export function calculatePivots(candles: Candle[]): PivotLevels {
  if (candles.length === 0) {
    return { type: 'classic', p: 0, r1: 0, r2: 0, r3: 0, s1: 0, s2: 0, s3: 0 };
  }

  // Use the prior reference candle or recent range
  const refIndex = Math.max(0, candles.length - 2);
  const c = candles[refIndex];
  const high = c.high;
  const low = c.low;
  const close = c.close;

  const p = (high + low + close) / 3;
  const diff = high - low;

  // Classic Floor Pivots
  const r1 = (2 * p) - low;
  const s1 = (2 * p) - high;
  const r2 = p + diff;
  const s2 = p - diff;
  const r3 = high + (2 * (p - low));
  const s3 = low - (2 * (high - p));

  return {
    type: 'classic',
    p: roundPrice(p, close),
    r1: roundPrice(r1, close),
    r2: roundPrice(r2, close),
    r3: roundPrice(r3, close),
    s1: roundPrice(s1, close),
    s2: roundPrice(s2, close),
    s3: roundPrice(s3, close),
  };
}

/**
 * Detects Fractal Swing Highs and Lows.
 * Uses a symmetric window around candle i.
 */
export function findPivotSwings(candles: Candle[], windowSize: number = 3): { highs: SwingPoint[]; lows: SwingPoint[] } {
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];

  for (let i = windowSize; i < candles.length - windowSize; i++) {
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;

    let isHigh = true;
    let isLow = true;

    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j === i) continue;
      if (candles[j].high >= currentHigh) isHigh = false;
      if (candles[j].low <= currentLow) isLow = false;
    }

    if (isHigh) {
      highs.push({
        index: i,
        time: candles[i].time,
        price: currentHigh,
        type: 'high',
      });
    }

    if (isLow) {
      lows.push({
        index: i,
        time: candles[i].time,
        price: currentLow,
        type: 'low',
      });
    }
  }

  return { highs, lows };
}

/**
 * Computes Fibonacci Retracement Levels between major swing high & low.
 */
export function calculateFibonacciRetracements(
  swingHigh: number,
  swingLow: number,
  direction: 'up' | 'down' = 'up'
): FibonacciLevels {
  const diff = swingHigh - swingLow;
  const ratios = [
    { ratio: 0.0, label: '0.0% (القمة)' },
    { ratio: 0.236, label: '23.6%' },
    { ratio: 0.382, label: '38.2%' },
    { ratio: 0.500, label: '50.0% (التوازن)' },
    { ratio: 0.618, label: '61.8% (النسبة الذهبية)' },
    { ratio: 0.786, label: '78.6%' },
    { ratio: 1.0, label: '100.0% (القاع)' },
    { ratio: 1.618, label: '161.8% (امتداد)' },
  ];

  const levels = ratios.map((r) => {
    const price = direction === 'up'
      ? swingHigh - (diff * r.ratio)
      : swingLow + (diff * r.ratio);
    return {
      ratio: r.ratio,
      price: roundPrice(price, swingHigh),
      label: r.label,
    };
  });

  return {
    swingHigh: roundPrice(swingHigh),
    swingLow: roundPrice(swingLow),
    direction,
    levels,
  };
}

/**
 * Clusters Swing Points to identify prominent Support & Resistance zones.
 */
export function detectSupportResistance(
  candles: Candle[],
  swings: { highs: SwingPoint[]; lows: SwingPoint[] }
): SupportResistanceZone[] {
  if (candles.length === 0) return [];

  const currentPrice = candles[candles.length - 1].close;
  const tolerancePercent = 0.004; // 0.4% clustering threshold

  const allPoints = [...swings.highs, ...swings.lows];
  const clusters: { priceSum: number; count: number; points: SwingPoint[] }[] = [];

  for (const p of allPoints) {
    let placed = false;
    for (const cluster of clusters) {
      const avg = cluster.priceSum / cluster.count;
      if (Math.abs(p.price - avg) / avg <= tolerancePercent) {
        cluster.priceSum += p.price;
        cluster.count += 1;
        cluster.points.push(p);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({ priceSum: p.price, count: 1, points: [p] });
    }
  }

  // Filter clusters touched at least twice or prominent swing
  const zones: SupportResistanceZone[] = clusters
    .map((c) => {
      const avgPrice = c.priceSum / c.count;
      const type = avgPrice > currentPrice ? ('resistance' as const) : ('support' as const);
      const strength = c.count >= 3 ? ('strong' as const) : c.count === 2 ? ('moderate' as const) : ('weak' as const);
      return {
        price: roundPrice(avgPrice, currentPrice),
        type,
        touches: c.count,
        strength,
      };
    })
    .sort((a, b) => b.touches - a.touches)
    .slice(0, 6);

  return zones;
}

/**
 * Detects Regular RSI Divergences (Bullish and Bearish).
 */
export function detectDivergences(
  candles: Candle[],
  rsiSeries: (number | null)[],
  swings: { highs: SwingPoint[]; lows: SwingPoint[] }
): DivergenceSignal[] {
  const signals: DivergenceSignal[] = [];

  // Check Bearish Divergence (Higher High in Price, Lower High in RSI)
  const recentHighs = swings.highs.slice(-3);
  if (recentHighs.length >= 2) {
    const p1 = recentHighs[recentHighs.length - 2];
    const p2 = recentHighs[recentHighs.length - 1];
    const rsi1 = rsiSeries[p1.index];
    const rsi2 = rsiSeries[p2.index];

    if (rsi1 !== null && rsi2 !== null) {
      if (p2.price > p1.price && rsi2 < rsi1) {
        signals.push({
          type: 'bearish',
          indicator: 'RSI',
          startPrice: p1.price,
          endPrice: p2.price,
          startTime: p1.time,
          endTime: p2.time,
          description: `انحراف سلبي (Bearish Divergence): قمة سعرية أعلى (${p2.price.toFixed(2)}) يقابلها قمة RSI أدنى (${rsi2.toFixed(1)} < ${rsi1.toFixed(1)})`,
        });
      }
    }
  }

  // Check Bullish Divergence (Lower Low in Price, Higher Low in RSI)
  const recentLows = swings.lows.slice(-3);
  if (recentLows.length >= 2) {
    const p1 = recentLows[recentLows.length - 2];
    const p2 = recentLows[recentLows.length - 1];
    const rsi1 = rsiSeries[p1.index];
    const rsi2 = rsiSeries[p2.index];

    if (rsi1 !== null && rsi2 !== null) {
      if (p2.price < p1.price && rsi2 > rsi1) {
        signals.push({
          type: 'bullish',
          indicator: 'RSI',
          startPrice: p1.price,
          endPrice: p2.price,
          startTime: p1.time,
          endTime: p2.time,
          description: `انحراف إيجابي (Bullish Divergence): قاع سعري أدنى (${p2.price.toFixed(2)}) يقابله قاع RSI أعلى (${rsi2.toFixed(1)} > ${rsi1.toFixed(1)})`,
        });
      }
    }
  }

  return signals;
}

/**
 * Detects Breakouts and Fakeouts against prominent S/R levels.
 */
export function detectBreakouts(candles: Candle[], zones: SupportResistanceZone[]): BreakoutSignal[] {
  const signals: BreakoutSignal[] = [];
  if (candles.length < 3) return signals;

  const currentCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  // Calculate 20-candle average volume
  const volWindow = Math.min(20, candles.length);
  let totalVol = 0;
  for (let i = candles.length - volWindow; i < candles.length; i++) {
    const v = typeof candles[i].volume === 'number' && Number.isFinite(candles[i].volume) ? candles[i].volume : 0;
    totalVol += v;
  }
  const avgVol = volWindow > 0 ? totalVol / volWindow : 0;
  const isClosed = currentCandle.isClosed !== false;
  const currVol = typeof currentCandle.volume === 'number' && Number.isFinite(currentCandle.volume) ? currentCandle.volume : 0;
  // Volume is supporting if current candle volume is at least 90% of 20-SMA volume (or if provider provides zero volume)
  const volumeSupported = avgVol === 0 || currVol >= avgVol * 0.9;
  const isBreakoutConfirmed = isClosed && volumeSupported;

  for (const zone of zones) {
    // Breakout above resistance
    if (zone.type === 'resistance') {
      if (prevCandle.close <= zone.price && currentCandle.close > zone.price) {
        signals.push({
          level: zone.price,
          type: 'breakout_up',
          candleTime: currentCandle.time,
          price: roundPrice(currentCandle.close, currentCandle.close),
          confirmed: isBreakoutConfirmed,
        });
      } else if (currentCandle.high > zone.price && currentCandle.close < zone.price) {
        // High pierced level but closed below -> Fakeout
        signals.push({
          level: zone.price,
          type: 'fakeout_up',
          candleTime: currentCandle.time,
          price: roundPrice(currentCandle.high, currentCandle.close),
          confirmed: isClosed,
        });
      }
    }

    // Breakdown below support
    if (zone.type === 'support') {
      if (prevCandle.close >= zone.price && currentCandle.close < zone.price) {
        signals.push({
          level: zone.price,
          type: 'breakout_down',
          candleTime: currentCandle.time,
          price: roundPrice(currentCandle.close, currentCandle.close),
          confirmed: isBreakoutConfirmed,
        });
      } else if (currentCandle.low < zone.price && currentCandle.close > zone.price) {
        // Low pierced level but closed above -> Fakeout
        signals.push({
          level: zone.price,
          type: 'fakeout_down',
          candleTime: currentCandle.time,
          price: roundPrice(currentCandle.low, currentCandle.close),
          confirmed: isClosed,
        });
      }
    }
  }

  return signals;
}

/**
 * Calculates Stochastic Oscillator (%K, %D).
 * Standard parameters: kPeriod = 14, smoothK = 3, dPeriod = 3
 */
export function calculateStochasticSeries(
  candles: Candle[],
  kPeriod: number = 14,
  smoothK: number = 3,
  dPeriod: number = 3
): {
  k: (number | null)[];
  d: (number | null)[];
} {
  const n = candles.length;
  const rawK: (number | null)[] = new Array(n).fill(null);
  const kLine: (number | null)[] = new Array(n).fill(null);
  const dLine: (number | null)[] = new Array(n).fill(null);

  if (n < kPeriod) {
    return { k: kLine, d: dLine };
  }

  // 1. Calculate raw %K
  for (let i = kPeriod - 1; i < n; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;

    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].high > highestHigh) highestHigh = candles[j].high;
      if (candles[j].low < lowestLow) lowestLow = candles[j].low;
    }

    const range = highestHigh - lowestLow;
    if (range === 0) {
      rawK[i] = 50;
    } else {
      rawK[i] = ((candles[i].close - lowestLow) / range) * 100;
    }
  }

  // 2. Smooth raw %K with SMA of smoothK
  for (let i = 0; i < n; i++) {
    if (i < kPeriod - 1 + smoothK - 1) continue;

    let sum = 0;
    let valid = true;
    for (let j = i - smoothK + 1; j <= i; j++) {
      if (rawK[j] === null) {
        valid = false;
        break;
      }
      sum += rawK[j]!;
    }

    if (valid) {
      kLine[i] = Number((sum / smoothK).toFixed(2));
    }
  }

  // 3. Calculate %D as SMA of kLine over dPeriod
  for (let i = 0; i < n; i++) {
    if (i < kPeriod - 1 + smoothK - 1 + dPeriod - 1) continue;

    let sum = 0;
    let valid = true;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      if (kLine[j] === null) {
        valid = false;
        break;
      }
      sum += kLine[j]!;
    }

    if (valid) {
      dLine[i] = Number((sum / dPeriod).toFixed(2));
    }
  }

  return { k: kLine, d: dLine };
}

export function calculateStochastic(
  candles: Candle[],
  kPeriod: number = 14,
  smoothK: number = 3,
  dPeriod: number = 3
): StochasticData {
  const { k, d } = calculateStochasticSeries(candles, kPeriod, smoothK, dPeriod);
  const lastIdx = candles.length - 1;
  const currentK = lastIdx >= 0 ? k[lastIdx] : null;
  const currentD = lastIdx >= 0 ? d[lastIdx] : null;
  const prevK = lastIdx >= 1 ? k[lastIdx - 1] : null;
  const prevD = lastIdx >= 1 ? d[lastIdx - 1] : null;

  let state: 'overbought' | 'oversold' | 'neutral' = 'neutral';
  if (currentK !== null) {
    if (currentK >= 80) state = 'overbought';
    else if (currentK <= 20) state = 'oversold';
  }

  let cross: 'bullish_cross' | 'bearish_cross' | 'none' = 'none';
  if (prevK !== null && prevD !== null && currentK !== null && currentD !== null) {
    if (prevK <= prevD && currentK > currentD) {
      cross = 'bullish_cross';
    } else if (prevK >= prevD && currentK < currentD) {
      cross = 'bearish_cross';
    }
  }

  return {
    k: currentK,
    d: currentD,
    state,
    cross,
  };
}

/**
 * Calculates Average Directional Index (ADX) and Directional Movement (+DI, -DI)
 * using Wilder's Smoothing method.
 */
export function calculateADX(candles: Candle[], period: number = 14): ADXData {
  if (candles.length < period + 1) {
    return {
      adx: null,
      plusDI: null,
      minusDI: null,
      regime: 'ranging',
    };
  }

  const trSeries: number[] = [];
  const plusDMSeries: number[] = [];
  const minusDMSeries: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];

    const upMove = current.high - prev.high;
    const downMove = prev.low - current.low;

    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;

    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );

    trSeries.push(tr);
    plusDMSeries.push(plusDM);
    minusDMSeries.push(minusDM);
  }

  if (trSeries.length < period) {
    return {
      adx: null,
      plusDI: null,
      minusDI: null,
      regime: 'ranging',
    };
  }

  // Initial sum for first period
  let smoothTR = 0;
  let smoothPlusDM = 0;
  let smoothMinusDM = 0;

  for (let i = 0; i < period; i++) {
    smoothTR += trSeries[i];
    smoothPlusDM += plusDMSeries[i];
    smoothMinusDM += minusDMSeries[i];
  }

  const dxSeries: number[] = [];

  const addDX = (tr: number, pDM: number, mDM: number) => {
    const plusDI = tr > 0 ? (pDM / tr) * 100 : 0;
    const minusDI = tr > 0 ? (mDM / tr) * 100 : 0;
    const sumDI = plusDI + minusDI;
    const dx = sumDI > 0 ? (Math.abs(plusDI - minusDI) / sumDI) * 100 : 0;
    dxSeries.push(dx);
    return { plusDI, minusDI };
  };

  let lastPlusDI = 0;
  let lastMinusDI = 0;
  const initial = addDX(smoothTR, smoothPlusDM, smoothMinusDM);
  lastPlusDI = initial.plusDI;
  lastMinusDI = initial.minusDI;

  // Wilder's smoothing for subsequent steps
  for (let i = period; i < trSeries.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trSeries[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDMSeries[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDMSeries[i];

    const step = addDX(smoothTR, smoothPlusDM, smoothMinusDM);
    lastPlusDI = step.plusDI;
    lastMinusDI = step.minusDI;
  }

  let finalADX: number | null = null;
  if (dxSeries.length >= period) {
    let adxSum = 0;
    for (let i = 0; i < period; i++) {
      adxSum += dxSeries[i];
    }
    let currentADX = adxSum / period;

    for (let i = period; i < dxSeries.length; i++) {
      currentADX = (currentADX * (period - 1) + dxSeries[i]) / period;
    }
    finalADX = Number(currentADX.toFixed(2));
  } else if (dxSeries.length > 0) {
    const avg = dxSeries.reduce((a, b) => a + b, 0) / dxSeries.length;
    finalADX = Number(avg.toFixed(2));
  }

  let regime: 'strong_trend' | 'trend' | 'ranging' = 'ranging';
  if (finalADX !== null) {
    if (finalADX >= 40) regime = 'strong_trend';
    else if (finalADX >= 25) regime = 'trend';
    else regime = 'ranging';
  }

  return {
    adx: finalADX,
    plusDI: Number(lastPlusDI.toFixed(2)),
    minusDI: Number(lastMinusDI.toFixed(2)),
    regime,
  };
}

/**
 * Calculates Ichimoku Kinko Hyo components:
 * Tenkan-sen (9), Kijun-sen (26), Senkou Span A, Senkou Span B (52), Cloud bias, and TK Cross.
 */
export function calculateIchimoku(candles: Candle[]): IchimokuData {
  const n = candles.length;
  if (n < 9) {
    return {
      tenkanSen: null,
      kijunSen: null,
      senkouSpanA: null,
      senkouSpanB: null,
      cloudBias: 'inside_cloud_neutral',
      tkCross: 'none',
    };
  }

  const getExtremes = (len: number, endIdx: number) => {
    const start = Math.max(0, endIdx - len + 1);
    let hh = -Infinity;
    let ll = Infinity;
    for (let i = start; i <= endIdx; i++) {
      if (candles[i].high > hh) hh = candles[i].high;
      if (candles[i].low < ll) ll = candles[i].low;
    }
    return { hh, ll };
  };

  const lastIdx = n - 1;
  const currentPrice = candles[lastIdx].close;
  const t9 = getExtremes(9, lastIdx);
  const tenkanSen = roundPrice((t9.hh + t9.ll) / 2, currentPrice);

  let kijunSen: number | null = null;
  if (n >= 26) {
    const k26 = getExtremes(26, lastIdx);
    kijunSen = roundPrice((k26.hh + k26.ll) / 2, currentPrice);
  }

  let senkouSpanA: number | null = null;
  if (tenkanSen !== null && kijunSen !== null) {
    senkouSpanA = roundPrice((tenkanSen + kijunSen) / 2, currentPrice);
  }

  let senkouSpanB: number | null = null;
  if (n >= 52) {
    const s52 = getExtremes(52, lastIdx);
    senkouSpanB = roundPrice((s52.hh + s52.ll) / 2, currentPrice);
  }

  // Cloud bias:
  // Under standard Ichimoku rules, the cloud projected ahead from 26 bars ago corresponds to the current price.
  let cloudBias: 'bullish_above_cloud' | 'bearish_below_cloud' | 'inside_cloud_neutral' = 'inside_cloud_neutral';
  if (n >= 78) {
    const dispIdx = lastIdx - 26;
    const t9Disp = getExtremes(9, dispIdx);
    const k26Disp = getExtremes(26, dispIdx);
    const s52Disp = getExtremes(52, dispIdx);

    const spanADisp = ((t9Disp.hh + t9Disp.ll) / 2 + (k26Disp.hh + k26Disp.ll) / 2) / 2;
    const spanBDisp = (s52Disp.hh + s52Disp.ll) / 2;

    const cloudTop = Math.max(spanADisp, spanBDisp);
    const cloudBottom = Math.min(spanADisp, spanBDisp);

    if (currentPrice > cloudTop) {
      cloudBias = 'bullish_above_cloud';
    } else if (currentPrice < cloudBottom) {
      cloudBias = 'bearish_below_cloud';
    } else {
      cloudBias = 'inside_cloud_neutral';
    }
  } else if (senkouSpanA !== null && senkouSpanB !== null) {
    const cloudTop = Math.max(senkouSpanA, senkouSpanB);
    const cloudBottom = Math.min(senkouSpanA, senkouSpanB);
    if (currentPrice > cloudTop) {
      cloudBias = 'bullish_above_cloud';
    } else if (currentPrice < cloudBottom) {
      cloudBias = 'bearish_below_cloud';
    } else {
      cloudBias = 'inside_cloud_neutral';
    }
  }

  // TK Cross with historical crossover check
  let tkCross: 'bullish' | 'bearish' | 'none' = 'none';
  if (tenkanSen !== null && kijunSen !== null) {
    if (n >= 27) {
      const prevT9 = getExtremes(9, lastIdx - 1);
      const prevK26 = getExtremes(26, lastIdx - 1);
      const prevTenkan = (prevT9.hh + prevT9.ll) / 2;
      const prevKijun = (prevK26.hh + prevK26.ll) / 2;

      if ((prevTenkan <= prevKijun && tenkanSen > kijunSen) || tenkanSen > kijunSen) {
        tkCross = 'bullish';
      } else if ((prevTenkan >= prevKijun && tenkanSen < kijunSen) || tenkanSen < kijunSen) {
        tkCross = 'bearish';
      }
    } else {
      if (tenkanSen > kijunSen) {
        tkCross = 'bullish';
      } else if (tenkanSen < kijunSen) {
        tkCross = 'bearish';
      }
    }
  }

  return {
    tenkanSen,
    kijunSen,
    senkouSpanA,
    senkouSpanB,
    cloudBias,
    tkCross,
  };
}

/**
 * Calculates Volume Analysis:
 * VWAP, Volume SMA20, Relative Volume (RVOL), POC (Point of Control), and Liquidity State.
 */
export function calculateVolumeAnalysis(candles: Candle[]): VolumeAnalysisData {
  const n = candles.length;
  if (n === 0) {
    return {
      vwap: null,
      volumeSMA20: null,
      relativeVolume: null,
      poc: null,
      liquidityState: 'normal',
    };
  }

  const currentPrice = candles[n - 1].close;

  // 1. VWAP (with zero-volume safe handling)
  let sumTPV = 0;
  let sumVol = 0;
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const vol = typeof c.volume === 'number' && Number.isFinite(c.volume) && c.volume > 0 ? c.volume : 0;
    const typicalPrice = (c.high + c.low + c.close) / 3;
    sumTPV += typicalPrice * vol;
    sumVol += vol;
  }
  const vwap = sumVol > 0 ? roundPrice(sumTPV / sumVol, currentPrice) : null;

  // 2. Volume SMA20
  const smaWindow = Math.min(20, n);
  let volSum = 0;
  for (let i = n - smaWindow; i < n; i++) {
    const vol = typeof candles[i].volume === 'number' && Number.isFinite(candles[i].volume) && candles[i].volume > 0 ? candles[i].volume : 0;
    volSum += vol;
  }
  const volumeSMA20 = smaWindow > 0 && volSum > 0 ? Number((volSum / smaWindow).toFixed(2)) : null;

  // 3. Relative Volume (RVOL)
  const lastVol = typeof candles[n - 1].volume === 'number' && Number.isFinite(candles[n - 1].volume) ? candles[n - 1].volume : 0;
  const relativeVolume = volumeSMA20 && volumeSMA20 > 0 ? Number((lastVol / volumeSMA20).toFixed(2)) : 1.0;

  // 4. Point of Control (POC) over last min(100, n) candles
  const pocWindow = Math.min(100, n);
  let minP = Infinity;
  let maxP = -Infinity;
  let hasVolumeInWindow = false;

  for (let i = n - pocWindow; i < n; i++) {
    if (candles[i].low < minP) minP = candles[i].low;
    if (candles[i].high > maxP) maxP = candles[i].high;
    if (candles[i].volume > 0) hasVolumeInWindow = true;
  }

  let poc: number | null = null;
  if (Number.isFinite(minP) && Number.isFinite(maxP) && minP < maxP) {
    if (hasVolumeInWindow) {
      const bins = 20;
      const binSize = (maxP - minP) / bins;
      const binVolumes = new Array(bins).fill(0);

      for (let i = n - pocWindow; i < n; i++) {
        const c = candles[i];
        const vol = typeof c.volume === 'number' && Number.isFinite(c.volume) && c.volume > 0 ? c.volume : 0;
        const typical = (c.high + c.low + c.close) / 3;
        const binIdx = Math.min(bins - 1, Math.max(0, Math.floor((typical - minP) / binSize)));
        binVolumes[binIdx] += vol;
      }

      let maxBinIdx = 0;
      let maxBinVol = -1;
      for (let b = 0; b < bins; b++) {
        if (binVolumes[b] > maxBinVol) {
          maxBinVol = binVolumes[b];
          maxBinIdx = b;
        }
      }

      poc = roundPrice(minP + (maxBinIdx + 0.5) * binSize, currentPrice);
    } else {
      poc = roundPrice((minP + maxP) / 2, currentPrice);
    }
  } else if (Number.isFinite(minP)) {
    poc = roundPrice(minP, currentPrice);
  }

  // 5. Liquidity State
  let liquidityState: 'high_participation' | 'normal' | 'low_liquidity' = 'normal';
  if (relativeVolume >= 1.5) {
    liquidityState = 'high_participation';
  } else if (relativeVolume < 0.6) {
    liquidityState = 'low_liquidity';
  }

  return {
    vwap,
    volumeSMA20,
    relativeVolume,
    poc,
    liquidityState,
  };
}

