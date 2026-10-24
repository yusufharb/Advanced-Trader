/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Candle,
  HarmonicAnalysis,
  HarmonicPattern,
  SwingPoint,
  FibonacciLevels,
} from '../../types/market.ts';
import { calculateFibonacciRetracements, roundPrice } from '../quantitative-engine.ts';

export function evaluateHarmonicSchool(
  candles: Candle[],
  swings: { highs: SwingPoint[]; lows: SwingPoint[] }
): HarmonicAnalysis {
  if (candles.length < 30) {
    return {
      status: 'غير متاحة',
      detectedPatterns: [],
      fibonacciRetracements: null,
      summary: 'البيانات غير كافية لمسح نماذج الهارمونيك ونسب فيبوناتشي.',
    };
  }

  const currentPrice = candles[candles.length - 1].close;

  // Interleave and sort swing points chronologically
  const allSwings: SwingPoint[] = [...swings.highs, ...swings.lows].sort(
    (a, b) => a.index - b.index
  );

  // Filter alternating swings (high -> low -> high -> low)
  const alternatingSwings: SwingPoint[] = [];
  for (const s of allSwings) {
    if (alternatingSwings.length === 0) {
      alternatingSwings.push(s);
    } else {
      const prev = alternatingSwings[alternatingSwings.length - 1];
      if (prev.type !== s.type) {
        alternatingSwings.push(s);
      } else {
        // Keep the more extreme swing if adjacent same type
        if (s.type === 'high' && s.price > prev.price) {
          alternatingSwings[alternatingSwings.length - 1] = s;
        } else if (s.type === 'low' && s.price < prev.price) {
          alternatingSwings[alternatingSwings.length - 1] = s;
        }
      }
    }
  }

  const detectedPatterns: HarmonicPattern[] = [];

  // Scan 5-point sequences (X, A, B, C, D)
  for (let i = 0; i <= alternatingSwings.length - 5; i++) {
    const X = alternatingSwings[i];
    const A = alternatingSwings[i + 1];
    const B = alternatingSwings[i + 2];
    const C = alternatingSwings[i + 3];
    const D = alternatingSwings[i + 4];

    const isBullish = X.type === 'low' && A.type === 'high'; // Bullish M-shape or XABCD
    const isBearish = X.type === 'high' && A.type === 'low'; // Bearish W-shape

    if (!isBullish && !isBearish) continue;

    const xa = Math.abs(A.price - X.price);
    if (xa === 0) continue;

    const bRatio = Math.abs(B.price - A.price) / xa;
    const cRatio = Math.abs(C.price - B.price) / Math.abs(A.price - B.price);
    const dRatio = Math.abs(D.price - X.price) / xa;

    // Validate C within 0.382 and 0.886 of AB
    if (cRatio < 0.35 || cRatio > 0.95) continue;

    let matchedName: 'Gartley' | 'Bat' | 'Butterfly' | 'Crab' | null = null;
    let przTolerance = 0.02;

    // Gartley: B ~ 0.618 (0.58 - 0.65), D ~ 0.786 (0.75 - 0.82)
    if (Math.abs(bRatio - 0.618) <= 0.05 && Math.abs(dRatio - 0.786) <= 0.05) {
      matchedName = 'Gartley';
      przTolerance = 0.015;
    }
    // Bat: B ~ 0.382 to 0.50 (0.35 - 0.53), D ~ 0.886 (0.84 - 0.92)
    else if (bRatio >= 0.35 && bRatio <= 0.55 && Math.abs(dRatio - 0.886) <= 0.05) {
      matchedName = 'Bat';
      przTolerance = 0.015;
    }
    // Butterfly: B ~ 0.786 (0.74 - 0.82), D ~ 1.272 (1.20 - 1.34)
    else if (Math.abs(bRatio - 0.786) <= 0.06 && Math.abs(dRatio - 1.272) <= 0.08) {
      matchedName = 'Butterfly';
      przTolerance = 0.025;
    }
    // Crab: B ~ 0.382 to 0.618 (0.35 - 0.65), D ~ 1.618 (1.52 - 1.70)
    else if (bRatio >= 0.35 && bRatio <= 0.65 && Math.abs(dRatio - 1.618) <= 0.09) {
      matchedName = 'Crab';
      przTolerance = 0.03;
    }

    if (matchedName) {
      const type = isBullish ? ('bullish' as const) : ('bearish' as const);
      const przStart = D.price * (1 - przTolerance);
      const przEnd = D.price * (1 + przTolerance);
      const invalidationLevel = isBullish ? X.price * 0.995 : X.price * 1.005;

      // Completed if price has touched point D and is currently within/near PRZ
      const isComplete = D.index >= candles.length - 12;

      detectedPatterns.push({
        name: matchedName,
        type,
        points: {
          X: { price: X.price, time: X.time },
          A: { price: A.price, time: A.time },
          B: { price: B.price, time: B.time },
          C: { price: C.price, time: C.time },
          D: { price: D.price, time: D.time },
        },
        bRatio: Number(bRatio.toFixed(3)),
        dRatio: Number(dRatio.toFixed(3)),
        prz: {
          start: roundPrice(przStart, currentPrice),
          end: roundPrice(przEnd, currentPrice),
        },
        invalidationLevel: roundPrice(invalidationLevel, currentPrice),
        isComplete,
      });
    }
  }

  // Calculate broader Fibonacci retracement from highest and lowest swing points
  let fibRetracements: FibonacciLevels | null = null;
  if (swings.highs.length > 0 && swings.lows.length > 0) {
    const highest = Math.max(...swings.highs.map((h) => h.price));
    const lowest = Math.min(...swings.lows.map((l) => l.price));
    fibRetracements = calculateFibonacciRetracements(
      highest,
      lowest,
      currentPrice >= (highest + lowest) / 2 ? 'up' : 'down'
    );
  }

  const summary = detectedPatterns.length > 0
    ? `تم رصد نموذج هارمونيك: ${detectedPatterns[0].name} (${detectedPatterns[0].type === 'bullish' ? 'صاعد' : 'هابط'})، نسبة B عند ${(detectedPatterns[0].bRatio * 100).toFixed(1)}% ونسبة D عند ${(detectedPatterns[0].dRatio * 100).toFixed(1)}%. منطقة الانعكاس المحتملة PRZ بين ${detectedPatterns[0].prz.start} و ${detectedPatterns[0].prz.end} مع مستوى إبطال عند ${detectedPatterns[0].invalidationLevel}.`
    : 'لم يتم رصد نموذج هارمونيك كلاسيكي مكتمل حالياً بنسب دقيقة. نسب فيبوناتشي المحورية تعمل كمستويات ارتداد مرجعية.';

  return {
    status: 'مكتملة',
    detectedPatterns: detectedPatterns.slice(-2),
    fibonacciRetracements: fibRetracements,
    summary,
  };
}
