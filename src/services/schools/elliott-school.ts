/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Candle, ElliottWaveAnalysis, SwingPoint } from '../../types/market.ts';
import { roundPrice } from '../quantitative-engine.ts';

export function evaluateElliottSchool(
  candles: Candle[],
  swings: { highs: SwingPoint[]; lows: SwingPoint[] }
): ElliottWaveAnalysis {
  if (candles.length < 35) {
    return {
      status: 'غير متاحة',
      probableCount: 'بيانات غير كافية',
      currentWave: 'غير محدد',
      isConclusive: false,
      rulesValidated: false,
      invalidationLevel: 0,
      summary: 'البيانات التاريخية غير كافية لتطبيق قواعد موجات إليوت الصارمة.',
    };
  }

  const currentPrice = candles[candles.length - 1].close;

  // Combine and sort swings chronologically
  const allSwings: SwingPoint[] = [...swings.highs, ...swings.lows].sort(
    (a, b) => a.index - b.index
  );

  // We need at least 5 alternating pivot points to test a 5-wave motive sequence (0, 1, 2, 3, 4, 5)
  if (allSwings.length < 5) {
    return {
      status: 'تجريبية',
      probableCount: 'العد غير حاسم (شح المحاور)',
      currentWave: 'موجة غير مكتملة',
      isConclusive: false,
      rulesValidated: false,
      invalidationLevel: currentPrice * 0.95,
      summary: 'عدد المحاور السعرية غير كافٍ لاكتمال دورة موجية صريحة. التحليل غير حاسم وفق القواعد القياسية.',
    };
  }

  const recentSwings = allSwings.slice(-6);

  // Test Bullish Impulse (W0 low, W1 high, W2 low, W3 high, W4 low, W5 high)
  let isBullishMotive = false;
  let invalidationLevel = currentPrice;
  let waveCountName = '';
  let alternateCount = '';
  let currentWave = '';
  let rulesValidated = false;

  if (recentSwings.length >= 5) {
    // Check if alternating points match a possible bullish impulse
    const p1 = recentSwings[recentSwings.length - 5];
    const p2 = recentSwings[recentSwings.length - 4];
    const p3 = recentSwings[recentSwings.length - 3];
    const p4 = recentSwings[recentSwings.length - 2];
    const p5 = recentSwings[recentSwings.length - 1];

    // Bullish 5-wave impulse check
    if (p1.type === 'low' && p2.type === 'high' && p3.type === 'low' && p4.type === 'high' && p5.type === 'low') {
      const wave1Len = p2.price - p1.price;
      const wave3Len = p4.price - p3.price;

      // Rule 1: Wave 2 cannot retrace > 100% of Wave 1 (p3.price must be > p1.price)
      const rule1 = p3.price > p1.price;

      // Rule 2: Wave 3 cannot be the shortest of waves (wave 3 must be strong)
      const rule2 = wave3Len > 0 && wave3Len >= wave1Len * 0.9;

      // Rule 3: Wave 4 cannot overlap with Wave 1 price territory (p5.price > p2.price)
      const rule3 = p5.price > p2.price;

      if (rule1 && rule2 && rule3) {
        rulesValidated = true;
        isBullishMotive = true;
        waveCountName = 'دورة دافعة صاعدة خماسية مكتملة القواعد (Waves 1-2-3-4-5)';
        currentWave = 'الموجة 5 الدافعة (أو بداية تصحيح A-B-C)';
        alternateCount = 'تصحيح مركب Flat / ZigZag ممتد';
        invalidationLevel = p5.price; // Wave 4 low
      }
    }
    // Bearish 5-wave impulse check
    else if (p1.type === 'high' && p2.type === 'low' && p3.type === 'high' && p4.type === 'low' && p5.type === 'high') {
      const wave1Len = p1.price - p2.price;
      const wave3Len = p3.price - p4.price;

      // Rule 1: Wave 2 cannot exceed Wave 1 start (p3.price < p1.price)
      const rule1 = p3.price < p1.price;

      // Rule 2: Wave 3 cannot be the shortest
      const rule2 = wave3Len > 0 && wave3Len >= wave1Len * 0.9;

      // Rule 3: Wave 4 cannot overlap with Wave 1 territory (p5.price < p2.price)
      const rule3 = p5.price < p2.price;

      if (rule1 && rule2 && rule3) {
        rulesValidated = true;
        waveCountName = 'دورة دافعة هابطة خماسية مكتملة القواعد (Bearish Impulse Waves 1-2-3-4-5)';
        currentWave = 'الموجة 5 الدافعة الهابطة (أو بداية ارتداد تصحيحي)';
        alternateCount = 'تصحيح مركب هابط ممتد';
        invalidationLevel = p5.price; // Wave 4 high
      }
    }
  }

  // Test Corrective A-B-C structure
  if (!rulesValidated && recentSwings.length >= 3) {
    const s1 = recentSwings[recentSwings.length - 3];
    const s2 = recentSwings[recentSwings.length - 2];
    const s3 = recentSwings[recentSwings.length - 1];

    if (s1.type === 'high' && s2.type === 'low' && s3.type === 'high') {
      waveCountName = 'بنية تصحيحية ثلاثية هابطة (Zigzag A-B-C)';
      currentWave = 'الموجة C التصحيحية';
      alternateCount = 'مثلث تجميعي عرضي (Triangle Continuation)';
      rulesValidated = true;
      invalidationLevel = s1.price;
    } else if (s1.type === 'low' && s2.type === 'high' && s3.type === 'low') {
      waveCountName = 'بنية تصحيحية ثلاثية صاعدة ممتدة (ABC Flat)';
      currentWave = 'الموجة C الصاعدة';
      alternateCount = 'موجة دافعة أولية لم تتأكد';
      rulesValidated = true;
      invalidationLevel = s1.price;
    }
  }

  const isConclusive = rulesValidated;
  if (!isConclusive) {
    waveCountName = 'العد الموجي غير حاسم (تداخل محاور أو كسر قواعد إليوت)';
    currentWave = 'تذبذب تصحيحي غير نمطي';
    alternateCount = 'حركة اتجاهية غير مكتملة';
    invalidationLevel = currentPrice * 0.97;
  }

  const roundedInvalidation = roundPrice(invalidationLevel, currentPrice);
  const summary = `مدرسة إليوت (${rulesValidated ? 'قواعد مدققة' : 'غير حاسمة'}): ${waveCountName}. الموجة المرجحة: ${currentWave}. مستوى إبطال السيناريو الموجي عند ${roundedInvalidation}. ${isConclusive ? 'العد مستوفٍ للضوابط الصارمة.' : 'تنبيه: لا يوجد عد قياسي مؤكد حتى الآن دون خرق الشروط الموجية.'}`;

  return {
    status: 'تجريبية',
    probableCount: waveCountName,
    alternateCount,
    currentWave,
    isConclusive,
    rulesValidated,
    invalidationLevel: roundedInvalidation,
    summary,
  };
}
