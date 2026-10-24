/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Candle, MarketSymbol, TechnicalReport, TimeFrame } from '../types/market.ts';
import {
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateATR,
  calculateBollingerBands,
  calculatePivots,
  findPivotSwings,
  detectSupportResistance,
  calculateRSISeries,
  detectDivergences,
  detectBreakouts,
  calculateStochastic,
  calculateADX,
  calculateIchimoku,
  calculateVolumeAnalysis,
  roundPrice,
} from './quantitative-engine.ts';
import { evaluateClassicalSchool } from './schools/classical-school.ts';
import { evaluatePriceActionSchool } from './schools/price-action-school.ts';
import { evaluateHarmonicSchool } from './schools/harmonic-school.ts';
import { evaluateElliottSchool } from './schools/elliott-school.ts';
import { evaluateNumericalSchool } from './schools/numerical-school.ts';
import { evaluateAstroSchool } from './schools/astro-school.ts';
import {
  generateAIReportCommentaryWithMeta,
  generateDeterministicCommentary,
} from './ai-synthesizer.ts';
import { generateMacroAnalysisReport, getMacroSummaryForSymbol } from './macro-service.ts';
import { inferAssetMetadata } from './market/custom-assets.ts';

export interface AnalyzeMarketOptions {
  includeAI?: boolean;
}

/**
 * Purely deterministic multi-school & quantitative market analysis.
 * Never calls Gemini or any external LLM service.
 */
export function analyzeMarketDeterministic(
  candles: Candle[],
  symbol: MarketSymbol,
  timeframe: TimeFrame,
  dataSource: string,
  isLive: boolean
): TechnicalReport {
  if (candles.length < 15) {
    throw new Error(`عدد الشموع المتاحة (${candles.length}) غير كافٍ لإجراء تحليل متكامل. الحد الأدنى المطلوب 15 شمعة.`);
  }

  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle.close;

  // 1. Calculate Quantitative Indicators
  const ema = calculateEMA(candles);
  const rsi = calculateRSI(candles, 14);
  const macd = calculateMACD(candles);
  const atr = calculateATR(candles, 14);
  const bollinger = calculateBollingerBands(candles, 20, 2);
  const pivots = calculatePivots(candles);
  const stochastic = calculateStochastic(candles, 14, 3, 3);
  const adx = calculateADX(candles, 14);
  const ichimoku = calculateIchimoku(candles);
  const volume = calculateVolumeAnalysis(candles);

  // 2. Swings and Structural Features
  const swings = findPivotSwings(candles, 3);
  const zones = detectSupportResistance(candles, swings);
  const rsiSeries = calculateRSISeries(candles, 14);
  const divergences = detectDivergences(candles, rsiSeries, swings);
  const breakouts = detectBreakouts(candles, zones);

  // 3. Evaluate Technical Schools
  const classical = evaluateClassicalSchool(candles, swings, zones, breakouts);
  const priceAction = evaluatePriceActionSchool(candles, swings);
  const harmonic = evaluateHarmonicSchool(candles, swings);
  const elliott = evaluateElliottSchool(candles, swings);
  const numerical = evaluateNumericalSchool(candles, swings);
  const astro = evaluateAstroSchool(lastCandle.time);

  // 4. Derive Scenarios & Trade Setup
  const atrVal = atr.value || (currentPrice * 0.015);
  const primarySupport = classical.supports.length > 0 ? classical.supports[0] : currentPrice - (atrVal * 1.5);
  const primaryResistance = classical.resistances.length > 0 ? classical.resistances[0] : currentPrice + (atrVal * 1.5);

  const bullishScenario = {
    description: `استمرار الزخم الصاعد واستهداف مستويات المقاومة التالية في حال الثبات أعلى ${roundPrice(primarySupport, currentPrice)}.`,
    triggerCondition: `إغلاق شمعة صريحة أعلى المستوى ${roundPrice(currentPrice, currentPrice)} أو إعادة اختبار منطقة الدعم بنجاح.`,
    invalidationLevel: roundPrice(primarySupport - (atrVal * 0.5), currentPrice),
    target1: roundPrice(currentPrice + (atrVal * 1.5), currentPrice),
    target2: roundPrice(currentPrice + (atrVal * 3.0), currentPrice),
  };

  const bearishScenario = {
    description: `كسر مستويات الدعم الحالية والتحول نحو مسار تصحيحي هابط باتجاه القيعان السابقة.`,
    triggerCondition: `كسر المستوى ${roundPrice(primarySupport, currentPrice)} بإغلاق شمعة مؤكد دون ارتداد فوري.`,
    invalidationLevel: roundPrice(primaryResistance + (atrVal * 0.5), currentPrice),
    target1: roundPrice(currentPrice - (atrVal * 1.5), currentPrice),
    target2: roundPrice(currentPrice - (atrVal * 3.0), currentPrice),
  };

  const neutralScenario = {
    description: `حركة تذبذب عرضية داخل النطاق المحصور بين الدعم والمقاومة، وتفضيل انتظار تأكيد الاختراق.`,
    range: {
      low: roundPrice(primarySupport, currentPrice),
      high: roundPrice(primaryResistance, currentPrice),
    },
  };

  // Trade Setup Evaluation
  // Evaluate confluence:
  // Bullish signals: EMA20 > EMA50, RSI between 45 and 65, Classical trend صاعد, Harmonic bullish
  let bullishPoints = 0;
  let bearishPoints = 0;

  if (ema.ema20 && ema.ema50 && ema.ema20 > ema.ema50) bullishPoints++;
  if (ema.ema20 && ema.ema50 && ema.ema20 < ema.ema50) bearishPoints++;
  if (rsi.value && rsi.value > 50 && rsi.value < 70) bullishPoints++;
  if (rsi.value && rsi.value < 50 && rsi.value > 30) bearishPoints++;
  if (macd.trend === 'bullish') bullishPoints++;
  if (macd.trend === 'bearish') bearishPoints++;
  if (stochastic.state === 'oversold' || stochastic.cross === 'bullish_cross') bullishPoints++;
  if (stochastic.state === 'overbought' || stochastic.cross === 'bearish_cross') bearishPoints++;
  if (classical.trend === 'صاعد') bullishPoints += 2;
  if (classical.trend === 'هابط') bearishPoints += 2;
  if (priceAction.marketStructure.includes('صاعد')) bullishPoints++;
  if (priceAction.marketStructure.includes('هابط')) bearishPoints++;

  let hasSetup = false;
  let bias: 'شراء' | 'بيع' | 'حياد / مراقبة' = 'حياد / مراقبة';
  let stopLoss = 0;
  let targets: number[] = [];
  let riskRewardRatio = 0;
  let entryZone = { min: currentPrice, max: currentPrice };
  let reasoning = '';

  if (bullishPoints >= 4 && bullishPoints > bearishPoints + 2) {
    hasSetup = true;
    bias = 'شراء';
    entryZone = {
      min: roundPrice(currentPrice - (atrVal * 0.3), currentPrice),
      max: roundPrice(currentPrice, currentPrice),
    };
    stopLoss = roundPrice(primarySupport - (atrVal * 0.5), currentPrice);
    const risk = currentPrice - stopLoss;
    if (risk > 0) {
      targets = [
        roundPrice(currentPrice + (risk * 1.5), currentPrice),
        roundPrice(currentPrice + (risk * 2.5), currentPrice),
      ];
      riskRewardRatio = Number(((targets[0] - currentPrice) / risk).toFixed(2));
      reasoning = 'توافق الإشارات الصاعدة عبر المتوسطات المتحركة وبنية السوق والمدرسة الكلاسيكية مع توفر نسبة عائد لمخاطرة مجدية.';
    } else {
      hasSetup = false;
      bias = 'حياد / مراقبة';
    }
  } else if (bearishPoints >= 4 && bearishPoints > bullishPoints + 2) {
    hasSetup = true;
    bias = 'بيع';
    entryZone = {
      min: roundPrice(currentPrice, currentPrice),
      max: roundPrice(currentPrice + (atrVal * 0.3), currentPrice),
    };
    stopLoss = roundPrice(primaryResistance + (atrVal * 0.5), currentPrice);
    const risk = stopLoss - currentPrice;
    if (risk > 0) {
      targets = [
        roundPrice(currentPrice - (risk * 1.5), currentPrice),
        roundPrice(currentPrice - (risk * 2.5), currentPrice),
      ];
      riskRewardRatio = Number(((currentPrice - targets[0]) / risk).toFixed(2));
      reasoning = 'توافق الإشارات السلبية وضغط المتوسطات وكسر بنية القيعان مع نسبة عائد لمخاطرة متكافئة.';
    } else {
      hasSetup = false;
      bias = 'حياد / مراقبة';
    }
  } else {
    hasSetup = false;
    bias = 'حياد / مراقبة';
    reasoning = 'تعارض أو توازن الإشارات بين المدارس الفنية (عدم وجود تفوق إحصائي حاسم). الأفضلية للتريث ومراقبة ردة فعل السعر.';
  }

  // Strict Staleness and Non-Live Enforcement (Task 3.1 & Phase 2 Task 1.2 & EGX/Stock EOD Support)
  const isImportedCsv = dataSource.includes('مستورد') || dataSource.includes('CSV');
  const assetMeta = inferAssetMetadata(symbol);
  const isDailyOrStockEod =
    assetMeta.category === 'stock' ||
    assetMeta.category === 'index' ||
    timeframe === '1d' ||
    dataSource.includes('إغلاق يومي') ||
    dataSource.includes('EOD') ||
    dataSource.includes('بيانات تاريخية');

  if (!isLive) {
    if (isImportedCsv) {
      if (hasSetup) {
        reasoning += ' (إعداد صفقة محسوب على آخر شمعة في ملف CSV المستورد — يرجى التحقق من تطابق السعر الحالي قبل التنفيذ).';
      } else {
        reasoning += ' (ملف CSV مستورد — يرجى التحقق من تطابق السعر الحالي قبل التنفيذ).';
      }
    } else if (isDailyOrStockEod) {
      if (hasSetup) {
        reasoning += ' (التحليل والمستويات مبنية على بيانات الإغلاق التاريخية/اليومية — يرجى مراعاة سعر الافتتاح الفعلي في الجلسة القادمة).';
      } else {
        reasoning += ' (بيانات إغلاق يومية/تاريخية — يرجى متابعة افتتاح الجلسة القادمة لتأكيد الاتجاه).';
      }
    } else {
      hasSetup = false;
      bias = 'حياد / مراقبة';
      reasoning = 'تم تعطيل إصدار إشارة صفقة حية لأن البيانات غير حية أو قديمة (السوق مغلق حالياً، عطلة نهاية الأسبوع، أو انقطاع البث اللحظي). يرجى التحقق من أحدث الأسعار اللحظية عند افتتاح السوق قبل اتخاذ أي قرار تنفيذي.';
    }
  } else if (dataSource.includes('PAXG') || symbol === 'PAXGUSDT') {
    if (hasSetup) {
      reasoning += ' (تحذير تسعيري: الأسعار مستندة لأصل PAXG البديل وليس عقد XAUUSD الفعلي لدى وسيطك؛ يجب مراعاة فرق السعر والسبريد قبل التنفيذ).';
    }
  }

  // Macroeconomic Analysis & Alignment
  const macroReport = generateMacroAnalysisReport(symbol);
  const macroSummary = getMacroSummaryForSymbol(symbol, classical.trend);

  // Contradictory signals and risks
  const risksAndDisclaimers: string[] = [
    'تداول العملات المشفرة والسلع ينطوي على مخاطر تقلبات سعرية حادة قد تتجاوز النطاقات الفنية المتوقعة.',
    divergences.length > 0 ? divergences[0].description : 'لا توجد انحرافات حادة مسجلة حالياً على مؤشرات التذبذب.',
    lastCandle.isClosed === false ? 'تنبيه زمني: الشمعة الأخيرة قيد التكوين ولم تغلق بعد، وقد تتغير دلالة الإشارة عند الإغلاق الفعلي.' : 'الشمعة الأخيرة مغلقة ومكتملة البيانات.',
    !isLive ? 'تنبيه سلامة البيانات: بيانات السوق المعروضة غير حية حالياً (بيانات قديمة أو السوق في عطلة إغلاق)، ولا يُعتد بها كإشارة تنفيذ حية لحظية.' : '',
    (dataSource.includes('PAXG') || symbol === 'PAXGUSDT') ? 'تحذير مرجعي صريح: بيانات الذهب مستندة إلى توكن PAXG البديل كمرجع تسعيري رقمي وليس عقد الذهب الفوري XAUUSD لدى وسيطك؛ يوجد فرق في السبريد والسعر يجب مراعاته قبل التنفيذ.' : '',
    macroSummary.alignment === 'معاكس للتحليل الفني'
      ? `تحذير اقتصادي كلي: الاتجاه الفني (${classical.trend}) يتعارض جزئياً مع الرياح الكلية (${macroSummary.macroBias}). ${macroSummary.keyImpactText}`
      : `السياق الكلي: ${macroSummary.keyImpactText}`,
    macroReport.highImpactWarning || '',
  ].filter(Boolean);

  const report: TechnicalReport = {
    symbol,
    timeframe,
    lastUpdated: new Date().toISOString(),
    lastCandleTime: new Date(lastCandle.time).toISOString(),
    dataSource,
    isLive,
    currentPrice,
    candleCount: candles.length,
    isCandleClosed: lastCandle.isClosed ?? true,
    indicators: {
      ema,
      rsi,
      macd,
      bollinger,
      atr,
      pivots,
      stochastic,
      adx,
      ichimoku,
      volume,
    },
    schools: {
      classical,
      priceAction,
      harmonic,
      elliott,
      numerical,
      astro,
    },
    scenarios: {
      bullish: bullishScenario,
      bearish: bearishScenario,
      neutral: neutralScenario,
    },
    tradeSetup: {
      hasSetup,
      bias,
      entryZone,
      stopLoss,
      targets,
      riskRewardRatio,
      reasoning,
    },
    risksAndDisclaimers,
    executiveConclusion: hasSetup
      ? `فرصة تداول (${bias}) مشروطة بالدخول بين ${entryZone.min} و ${entryZone.max} مع وقف خسارة صارم عند ${stopLoss}.`
      : 'لا توجد فرصة مستوفية لشروط إدارة المخاطر حالياً؛ التريث والانتظار هو القرار الفني الأسلم.',
    macroContext: macroReport,
  };

  report.aiCommentary = generateDeterministicCommentary(report);
  report.aiMeta = {
    usedAI: false,
    status: 'DETERMINISTIC_ONLY',
    checkedAt: report.lastUpdated,
  };

  return report;
}

/**
 * Full market analysis.
 * - When `options?.includeAI === false` or when running in the browser (`typeof window !== 'undefined'`),
 *   executes 100% deterministically with zero Gemini calls.
 * - When running on the server with `includeAI !== false`, attempts server-side Gemini synthesis
 *   and falls back cleanly to the deterministic report if Gemini is unavailable.
 */
export async function analyzeMarket(
  candles: Candle[],
  symbol: MarketSymbol,
  timeframe: TimeFrame,
  dataSource: string,
  isLive: boolean,
  options?: AnalyzeMarketOptions
): Promise<TechnicalReport> {
  const report = analyzeMarketDeterministic(candles, symbol, timeframe, dataSource, isLive);

  if (options?.includeAI === false || typeof window !== 'undefined') {
    return report;
  }

  // Synthesize AI Commentary on the server via Gemini
  const aiResult = await generateAIReportCommentaryWithMeta(report);
  report.aiCommentary = aiResult.commentary;
  report.aiMeta = aiResult.meta;

  return report;
}
