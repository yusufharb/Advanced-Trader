/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Candle, ClassicalAnalysis, SwingPoint, SupportResistanceZone, BreakoutSignal } from '../../types/market.ts';
import { roundPrice } from '../quantitative-engine.ts';

export function evaluateClassicalSchool(
  candles: Candle[],
  swings: { highs: SwingPoint[]; lows: SwingPoint[] },
  zones: SupportResistanceZone[],
  breakouts: BreakoutSignal[]
): ClassicalAnalysis {
  if (candles.length < 20) {
    return {
      status: 'غير متاحة',
      trend: 'عرضي (تذبذب)',
      supports: [],
      resistances: [],
      breakouts: [],
      invalidationLevel: 0,
      summary: 'البيانات غير كافية لتحليل المدرسة الكلاسيكية (يتطلب 20 شمعة على الأقل).',
    };
  }

  const currentPrice = candles[candles.length - 1].close;
  const recentHighs = swings.highs.slice(-4);
  const recentLows = swings.lows.slice(-4);

  // Determine Dow Trend Structure:
  // Bullish: Higher Highs (HH) and Higher Lows (HL)
  // Bearish: Lower Highs (LH) and Lower Lows (LL)
  let isHigherHighs = false;
  let isHigherLows = false;
  let isLowerHighs = false;
  let isLowerLows = false;

  if (recentHighs.length >= 2) {
    isHigherHighs = recentHighs[recentHighs.length - 1].price > recentHighs[recentHighs.length - 2].price;
    isLowerHighs = recentHighs[recentHighs.length - 1].price < recentHighs[recentHighs.length - 2].price;
  }
  if (recentLows.length >= 2) {
    isHigherLows = recentLows[recentLows.length - 1].price > recentLows[recentLows.length - 2].price;
    isLowerLows = recentLows[recentLows.length - 1].price < recentLows[recentLows.length - 2].price;
  }

  let trend: 'صاعد' | 'هابط' | 'عرضي (تذبذب)' = 'عرضي (تذبذب)';
  if (isHigherHighs && isHigherLows) {
    trend = 'صاعد';
  } else if (isLowerHighs && isLowerLows) {
    trend = 'هابط';
  }

  // Detect Classical Patterns (Double Top / Double Bottom)
  let primaryPattern: string | undefined = undefined;
  let patternStatus: 'مكتمل' | 'قيد التكوين' | 'لا يوجد' = 'لا يوجد';

  if (recentHighs.length >= 2) {
    const h1 = recentHighs[recentHighs.length - 2].price;
    const h2 = recentHighs[recentHighs.length - 1].price;
    const diff = Math.abs(h1 - h2) / Math.max(h1, h2);
    if (diff <= 0.006) {
      primaryPattern = 'نموذج القمة المزدوجة (Double Top)';
      const lowestBetween = Math.min(...candles.slice(recentHighs[recentHighs.length - 2].index, recentHighs[recentHighs.length - 1].index + 1).map(c => c.low));
      patternStatus = currentPrice < lowestBetween ? 'مكتمل' : 'قيد التكوين';
    }
  }

  if (!primaryPattern && recentLows.length >= 2) {
    const l1 = recentLows[recentLows.length - 2].price;
    const l2 = recentLows[recentLows.length - 1].price;
    const diff = Math.abs(l1 - l2) / Math.max(l1, l2);
    if (diff <= 0.006) {
      primaryPattern = 'نموذج القاع المزدوج (Double Bottom)';
      const highestBetween = Math.max(...candles.slice(recentLows[recentLows.length - 2].index, recentLows[recentLows.length - 1].index + 1).map(c => c.high));
      patternStatus = currentPrice > highestBetween ? 'مكتمل' : 'قيد التكوين';
    }
  }

  const supports = zones.filter(z => z.type === 'support').map(z => z.price);
  const resistances = zones.filter(z => z.type === 'resistance').map(z => z.price);

  // Invalidation level:
  // For bullish trend: latest swing low break
  // For bearish trend: latest swing high break
  let invalidationLevel = currentPrice;
  if (trend === 'صاعد' && recentLows.length > 0) {
    invalidationLevel = recentLows[recentLows.length - 1].price;
  } else if (trend === 'هابط' && recentHighs.length > 0) {
    invalidationLevel = recentHighs[recentHighs.length - 1].price;
  } else {
    invalidationLevel = supports.length > 0 ? supports[0] : currentPrice * 0.98;
  }

  const roundedInvalidation = roundPrice(invalidationLevel, currentPrice);
  const summary = `الاتجاه الكلاسيكي: ${trend}. تم تحديد ${supports.length} مستويات دعم و ${resistances.length} مستويات مقاومة.${primaryPattern ? ` تم رصد ${primaryPattern} بحالة (${patternStatus}).` : ' لا توجد نماذج انعكاسية كلاسيكية كبيرة مكتملة.'} مستوى إبطال الاتجاه عند ${roundedInvalidation}.`;

  return {
    status: 'مكتملة',
    trend,
    primaryPattern,
    patternStatus,
    supports,
    resistances,
    breakouts,
    invalidationLevel: roundedInvalidation,
    summary,
  };
}
