/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Candle, NumericalTimeAnalysis, SwingPoint } from '../../types/market.ts';
import { roundPrice } from '../quantitative-engine.ts';

/**
 * Advanced W.D. Gann, Square of Nine, and Numerical-Time Harmonics Engine
 */
export function evaluateNumericalSchool(
  candles: Candle[],
  swings: { highs: SwingPoint[]; lows: SwingPoint[] }
): NumericalTimeAnalysis {
  if (candles.length < 20) {
    return {
      status: 'غير متاحة',
      anchorPoint: null,
      gannLevels: [],
      squareOfNineHarmonics: [],
      timeCycleDays: [],
      summary: 'البيانات غير كافية لحساب الزوايا الرقمية والمحاور الزمنية.',
    };
  }

  const currentPrice = candles[candles.length - 1].close;
  const currentBarIndex = candles.length - 1;

  // Find most significant recent swing anchor
  const allSwings: SwingPoint[] = [...swings.highs, ...swings.lows];
  let anchor: SwingPoint | null = null;
  let anchorBarIndex = 0;

  if (allSwings.length > 0) {
    // Pick highest swing or lowest swing as reference anchor
    anchor = allSwings.reduce((prev, curr) => {
      const prevDiff = Math.abs(prev.price - currentPrice);
      const currDiff = Math.abs(curr.price - currentPrice);
      return currDiff > prevDiff ? curr : prev;
    }, allSwings[0]);

    // Find its approximate bar index
    const foundIdx = candles.findIndex((c) => Math.abs(c.time - anchor!.time) < 1000);
    anchorBarIndex = foundIdx >= 0 ? foundIdx : Math.max(0, currentBarIndex - 30);
  } else {
    anchorBarIndex = Math.max(0, currentBarIndex - 30);
  }

  const anchorPrice = anchor ? anchor.price : currentPrice;
  // Normalize anchor price to avoid collapsing Square of Nine with small-decimal assets (Forex, XRP)
  const scaleFactor = anchorPrice < 2 ? 10000 : anchorPrice < 20 ? 1000 : anchorPrice < 200 ? 100 : 1;
  const scaledPrice = anchorPrice * scaleFactor;
  const sqrtPrice = Math.sqrt(Math.max(1, scaledPrice));
  const barsElapsed = Math.max(1, currentBarIndex - anchorBarIndex);

  // 1. Square of Nine Angles (مربع التسعة التفاعلي)
  // Cardinal Cross (0°, 90°, 180°, 270°, 360°)
  // Fixed Cross (45°, 135°, 225°, 315°)
  // Trine Angles (120°, 240°)
  const anglesToCalc = [
    { deg: 45, type: 'fixed' },
    { deg: 90, type: 'cardinal' },
    { deg: 120, type: 'trine' },
    { deg: 135, type: 'fixed' },
    { deg: 180, type: 'cardinal' },
    { deg: 225, type: 'fixed' },
    { deg: 240, type: 'trine' },
    { deg: 270, type: 'cardinal' },
    { deg: 315, type: 'fixed' },
    { deg: 360, type: 'cardinal' },
  ];

  const squareOfNineHarmonics: number[] = [];

  for (const { deg } of anglesToCalc) {
    const factor = deg / 180;
    const upLevel = Math.pow(sqrtPrice + factor, 2) / scaleFactor;
    const downLevel = Math.pow(Math.max(0.1, sqrtPrice - factor), 2) / scaleFactor;
    squareOfNineHarmonics.push(roundPrice(upLevel, anchorPrice));
    if (downLevel > 0) {
      squareOfNineHarmonics.push(roundPrice(downLevel, anchorPrice));
    }
  }

  squareOfNineHarmonics.sort((a, b) => a - b);

  // 2. Gann Geometric Angles (1x8, 1x4, 1x2, 1x1, 2x1, 4x1, 8x1)
  // 1x1 is 45 degrees (Price Unit = Time Unit)
  const isUptrendFromAnchor = currentPrice >= anchorPrice;
  // Calculate price vibration scale per bar
  const priceRange = Math.abs(currentPrice - anchorPrice);
  const unitScale = Math.max(0.001, priceRange / barsElapsed);

  const gannAngleDefs = [
    { name: '1x8 (82.5°)', ratio: 8.0, significance: 'زاوية صعود/هبوط فائق الشدة (تسارع غير مستدام)' },
    { name: '1x4 (75.0°)', ratio: 4.0, significance: 'زاوية زخم حاد جداً (اندفاع موجي قوي)' },
    { name: '1x2 (63.75°)', ratio: 2.0, significance: 'زاوية اتجاه قوي أعلى من المتوسط' },
    { name: '1x1 (45.0°)', ratio: 1.0, significance: 'زاوية التوازن الهندسي الكبرى (خط الحياة والاتجاه المتوازن لغان)' },
    { name: '2x1 (26.25°)', ratio: 0.5, significance: 'زاوية دعم اتجاه هادئ / تصحيحي' },
    { name: '4x1 (15.0°)', ratio: 0.25, significance: 'زاوية مسار ضعيف أو بداية كسر اتجاه' },
    { name: '8x1 (7.5°)', ratio: 0.125, significance: 'أدنى زوايا غان، فقدان شبه كامل للزخم' },
  ];

  const gannAngles = gannAngleDefs.map((def) => {
    const priceDelta = def.ratio * unitScale * barsElapsed;
    const priceLevel = isUptrendFromAnchor
      ? anchorPrice + priceDelta
      : Math.max(0.0001, anchorPrice - priceDelta);

    return {
      angleName: def.name,
      priceLevel: roundPrice(priceLevel, anchorPrice),
      degree: def.name.includes('45') ? 45 : def.ratio > 1 ? 45 + def.ratio * 5 : 45 - (1 / def.ratio) * 5,
      significance: def.significance,
    };
  });

  // 3. Murrey Math Octaves (أوكتافات موري الرياضية 0/8 إلى 8/8)
  const octaveHigh = Math.max(...candles.slice(-64).map((c) => c.high));
  const octaveLow = Math.min(...candles.slice(-64).map((c) => c.low));
  const octaveRange = Math.max(0.0001, octaveHigh - octaveLow);
  const octaveStep = octaveRange / 8;

  const murreyOctaves = [
    { octave: '8/8', price: roundPrice(octaveHigh, anchorPrice), meaning: 'القمة الرئيسية للنطاق (منطقة ذروة شرائية ومقاومة حاسمة)' },
    { octave: '7/8', price: roundPrice(octaveLow + octaveStep * 7, anchorPrice), meaning: 'مستوى التوقف والضعف (Weak Fast Reverse)' },
    { octave: '6/8', price: roundPrice(octaveLow + octaveStep * 6, anchorPrice), meaning: 'محور دوران علوي حاسم (Pivot Reverse)' },
    { octave: '5/8', price: roundPrice(octaveLow + octaveStep * 5, anchorPrice), meaning: 'قمة نطاق التذبذب العرضي (Top of Trading Range)' },
    { octave: '4/8', price: roundPrice(octaveLow + octaveStep * 4, anchorPrice), meaning: 'نقطة التوازن الكبرى 50% (Major 50% Equilibrium Level)' },
    { octave: '3/8', price: roundPrice(octaveLow + octaveStep * 3, anchorPrice), meaning: 'قاع نطاق التذبذب العرضي (Bottom of Trading Range)' },
    { octave: '2/8', price: roundPrice(octaveLow + octaveStep * 2, anchorPrice), meaning: 'محور دوران سفلي حاسم (Pivot Reverse)' },
    { octave: '1/8', price: roundPrice(octaveLow + octaveStep * 1, anchorPrice), meaning: 'مستوى التوقف والقاع الضعيف (Weak Fast Reverse)' },
    { octave: '0/8', price: roundPrice(octaveLow, anchorPrice), meaning: 'القاع الرئيسي للنطاق (منطقة ذروة بيعية ودعم حاسم)' },
  ];

  // 4. Squaring of Price and Time Diagnostic (تربيع السعر والزمن)
  // Check if bars elapsed = sqrt(anchorPrice) or bars elapsed = anchorPrice / scale
  const isSqrtSquared = Math.abs(barsElapsed - Math.round(sqrtPrice)) <= 2;
  const isDirectSquared = Math.abs((barsElapsed % 36) - (Math.round(currentPrice) % 36)) <= 1;
  const isPriceTimeSquared = isSqrtSquared || isDirectSquared;

  const priceTimeSquareStatus = {
    isSquared: isPriceTimeSquared,
    currentBarCount: barsElapsed,
    currentPrice,
    explanation: isPriceTimeSquared
      ? `تحقق تربيع السعر والزمن (Squaring of Price & Time): الشمعة الحالية (${barsElapsed}) تتناغم مع الجذر التربيعي ومضاعفات زوايا الارتكاز ${anchorPrice.toFixed(1)}، مما يشير إلى احتمالية عالية لحدوث انعكاس اتجاهي أو تسارع سعري نوعي.`
      : `السعر والزمن في حالة حركة تفاضلية: ${barsElapsed} شمعة منذ آخر قاع/قمة ارتكازية دون اكتمال تربيع هندسي تام حتى الآن.`,
  };

  // 5. Fibonacci and Lucas Time Cycles (دورات فيبوناتشي ولوكاس الزمنية)
  const timeCycleDays: number[] = [8, 13, 21, 34, 55, 89, 144];
  const lucasTimeCycles: number[] = [7, 11, 18, 29, 47, 76, 123];

  // 6. Classical Gann Geometric Levels
  const gannRange = anchorPrice * 0.08;
  const gannLevels: number[] = [
    Number((anchorPrice - gannRange * 2).toFixed(2)),
    Number((anchorPrice - gannRange).toFixed(2)),
    Number(anchorPrice.toFixed(2)),
    Number((anchorPrice + gannRange).toFixed(2)),
    Number((anchorPrice + gannRange * 2).toFixed(2)),
  ];

  // 7. Key Vibrational Confluences (تلاقي مستويات غان ومربع التسعة وموري ماث)
  const keyVibrationalConfluence: { level: number; weight: number; label: string }[] = [];
  const nearbyLevels = [...squareOfNineHarmonics, ...murreyOctaves.map((m) => m.price)];

  nearbyLevels.forEach((lvl) => {
    if (Math.abs(lvl - currentPrice) / currentPrice < 0.04) {
      const matchCount = nearbyLevels.filter((other) => Math.abs(other - lvl) / lvl < 0.008).length;
      if (matchCount >= 2 && !keyVibrationalConfluence.some((c) => Math.abs(c.level - lvl) / lvl < 0.01)) {
        keyVibrationalConfluence.push({
          level: lvl,
          weight: matchCount,
          label: lvl > currentPrice ? 'مقاومة اهتزازية متوافقة' : 'دعم اهتزازي متوافق',
        });
      }
    }
  });

  const summary = `التحليل الرقمي والزمني المتقدم: ارتكاز عند ${anchorPrice.toFixed(2)} (${barsElapsed} شمعة سابقة). زاوية التوازن $1\\times 1$ عند ${gannAngles.find(a => a.angleName.includes('1x1'))?.priceLevel || '-'}. محور التوازن لموري ماث (4/8) عند ${murreyOctaves.find(o => o.octave === '4/8')?.price || '-'}. حالة التربيع: ${isPriceTimeSquared ? 'متحقق بنجاح (نافذة تحول محتملة)' : 'قيد التشكل'}.`;

  return {
    status: 'مكتملة',
    anchorPoint: anchor ? { price: anchor.price, time: anchor.time } : null,
    gannLevels,
    squareOfNineHarmonics,
    timeCycleDays,
    gannAngles,
    priceTimeSquareStatus,
    lucasTimeCycles,
    murreyMathOctaves: murreyOctaves,
    keyVibrationalConfluence,
    summary,
  };
}
