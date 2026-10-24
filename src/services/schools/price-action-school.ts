/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Candle, PriceActionAnalysis, SwingPoint } from '../../types/market.ts';
import { roundPrice } from '../quantitative-engine.ts';

export function evaluatePriceActionSchool(
  candles: Candle[],
  swings: { highs: SwingPoint[]; lows: SwingPoint[] }
): PriceActionAnalysis {
  if (candles.length < 20) {
    return {
      status: 'غير متاحة',
      marketStructure: 'توازن نطاقي',
      fairValueGaps: [],
      orderBlocks: [],
      invalidationLevel: 0,
      summary: 'البيانات غير كافية لتحليل سلوك السعر وبنية السوق.',
    };
  }

  const currentPrice = candles[candles.length - 1].close;
  const recentHighs = swings.highs.slice(-4);
  const recentLows = swings.lows.slice(-4);

  // 1. Identify BOS (Break of Structure) vs CHoCH (Change of Character)
  let marketStructure: 'BOS صاعد' | 'BOS هابط' | 'CHoCH تغيير اتجاه' | 'توازن نطاقي' = 'توازن نطاقي';

  if (recentHighs.length >= 2 && recentLows.length >= 2) {
    const lastHigh = recentHighs[recentHighs.length - 1];
    const prevHigh = recentHighs[recentHighs.length - 2];
    const lastLow = recentLows[recentLows.length - 1];
    const prevLow = recentLows[recentLows.length - 2];

    if (currentPrice > lastHigh.price) {
      marketStructure = 'BOS صاعد';
    } else if (currentPrice < lastLow.price) {
      marketStructure = 'BOS هابط';
    } else if (lastHigh.price > prevHigh.price && currentPrice < prevLow.price) {
      marketStructure = 'CHoCH تغيير اتجاه';
    } else if (lastLow.price < prevLow.price && currentPrice > prevHigh.price) {
      marketStructure = 'CHoCH تغيير اتجاه';
    }
  }

  // 2. Detect Fair Value Gaps (FVG) over recent 30 candles
  const fvgs: PriceActionAnalysis['fairValueGaps'] = [];
  const startIdx = Math.max(0, candles.length - 35);

  for (let i = startIdx; i < candles.length - 2; i++) {
    const c1 = candles[i];
    const c2 = candles[i + 1];
    const c3 = candles[i + 2];

    // Bullish FVG: Candle 1 High < Candle 3 Low (Gap)
    if (c3.low > c1.high) {
      const top = c3.low;
      const bottom = c1.high;
      // Check if subsequent candles mitigated the gap
      let mitigated = false;
      for (let j = i + 3; j < candles.length; j++) {
        if (candles[j].low <= top) {
          mitigated = true;
          break;
        }
      }
      fvgs.push({
        top: roundPrice(top, currentPrice),
        bottom: roundPrice(bottom, currentPrice),
        type: 'bullish_fvg',
        mitigated,
      });
    }

    // Bearish FVG: Candle 1 Low > Candle 3 High (Gap)
    if (c1.low > c3.high) {
      const top = c1.low;
      const bottom = c3.high;
      let mitigated = false;
      for (let j = i + 3; j < candles.length; j++) {
        if (candles[j].high >= bottom) {
          mitigated = true;
          break;
        }
      }
      fvgs.push({
        top: roundPrice(top, currentPrice),
        bottom: roundPrice(bottom, currentPrice),
        type: 'bearish_fvg',
        mitigated,
      });
    }
  }

  // 3. Detect Order Blocks (OB)
  const orderBlocks: PriceActionAnalysis['orderBlocks'] = [];
  // Scan for candles preceding impulse expansion
  for (let i = Math.max(1, candles.length - 25); i < candles.length - 2; i++) {
    const prevCandle = candles[i - 1];
    const currCandle = candles[i];
    const nextCandle = candles[i + 1];

    const bodySize = Math.abs(nextCandle.close - nextCandle.open);
    const avgBody = (Math.abs(prevCandle.close - prevCandle.open) + Math.abs(currCandle.close - currCandle.open)) / 2;

    // Bullish OB: Bearish candle followed by strong bullish impulse
    if (currCandle.close < currCandle.open && nextCandle.close > nextCandle.open && bodySize > avgBody * 1.5) {
      let tested = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].low <= currCandle.high && candles[j].low >= currCandle.low) {
          tested = true;
          break;
        }
      }
      orderBlocks.push({
        high: roundPrice(currCandle.high, currentPrice),
        low: roundPrice(currCandle.low, currentPrice),
        type: 'bullish_ob',
        tested,
      });
    }

    // Bearish OB: Bullish candle followed by strong bearish impulse
    if (currCandle.close > currCandle.open && nextCandle.close < nextCandle.open && bodySize > avgBody * 1.5) {
      let tested = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].high >= currCandle.low && candles[j].high <= currCandle.high) {
          tested = true;
          break;
        }
      }
      orderBlocks.push({
        high: roundPrice(currCandle.high, currentPrice),
        low: roundPrice(currCandle.low, currentPrice),
        type: 'bearish_ob',
        tested,
      });
    }
  }

  // Invalidation level
  let invalidationLevel = currentPrice;
  if (marketStructure.includes('صاعد') && recentLows.length > 0) {
    invalidationLevel = recentLows[recentLows.length - 1].price;
  } else if (marketStructure.includes('هابط') && recentHighs.length > 0) {
    invalidationLevel = recentHighs[recentHighs.length - 1].price;
  } else {
    invalidationLevel = recentLows.length > 0 ? recentLows[0].price : currentPrice * 0.98;
  }

  const roundedInvalidation = roundPrice(invalidationLevel, currentPrice);
  const activeFVGs = fvgs.filter(f => !f.mitigated).length;
  const activeOBs = orderBlocks.filter(ob => !ob.tested).length;

  const summary = `بنية السوق الحالية: (${marketStructure}). رُصدت ${activeFVGs} فجوات قيمة عادلة (FVG) غير ممتلئة و ${activeOBs} كتل أوامر (Order Blocks) قيد الاختبار. مستوى إبطال البنية عند ${roundedInvalidation}.`;

  return {
    status: 'مكتملة',
    marketStructure,
    fairValueGaps: fvgs.slice(-4),
    orderBlocks: orderBlocks.slice(-4),
    invalidationLevel: roundedInvalidation,
    summary,
  };
}
