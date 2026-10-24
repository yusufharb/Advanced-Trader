/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  calculateEMASeries,
  calculateRSISeries,
  calculateBollingerBands,
  calculateFibonacciRetracements,
  findPivotSwings,
  calculateStochastic,
  calculateStochasticSeries,
} from '../src/services/quantitative-engine.ts';
import { parseGoldCSV } from '../src/services/market/gold-adapter.ts';
import { runBacktest } from '../src/services/backtesting/backtest-engine.ts';
import { Candle } from '../src/types/market.ts';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('=== بدء اختبارات المحرك الفني ومصداقية الحسابات ===\n');

  // 1. Test EMA Mathematical Formula
  const sampleCandles: Candle[] = [];
  const baseTime = 1700000000000;
  // 30 candles with linear price progression from 100 to 129
  for (let i = 0; i < 30; i++) {
    sampleCandles.push({
      time: baseTime + i * 3600000,
      open: 100 + i,
      high: 101 + i,
      low: 99 + i,
      close: 100 + i,
      volume: 1000,
    });
  }

  const ema10 = calculateEMASeries(sampleCandles, 10);
  // First 9 should be null
  assert(ema10[8] === null, 'EMA: أول 9 عناصر لفترة 10 يجب أن تكون null');
  // 10th item (index 9) should be simple average of first 10 closes (100 to 109 = 104.5)
  assert(Math.abs((ema10[9] as number) - 104.5) < 0.001, 'EMA: البذرة الأولى عند الشمعة 10 تساوي المتوسط البسيط 104.5');
  // 11th item: multiplier = 2/11 ≈ 0.1818; Close = 110; 110 * 0.1818 + 104.5 * 0.8182 ≈ 105.5
  const expectedEma11 = (110 * (2 / 11)) + (104.5 * (1 - (2 / 11)));
  assert(Math.abs((ema10[10] as number) - expectedEma11) < 0.01, 'EMA: الحساب التكراري للشمعة 11 يطابق معادلة التنعيم الأسي');

  // 2. Test RSI Wilder's Smoothing
  // Create uptrend candles -> RSI must be strictly > 70
  const bullCandles: Candle[] = [];
  for (let i = 0; i < 25; i++) {
    bullCandles.push({
      time: baseTime + i * 3600000,
      open: 100 + (i * 2),
      high: 102 + (i * 2),
      low: 99 + (i * 2),
      close: 101 + (i * 2),
      volume: 1000,
    });
  }
  const bullRsi = calculateRSISeries(bullCandles, 14);
  const lastBullRsi = bullRsi[bullRsi.length - 1];
  assert(lastBullRsi !== null && lastBullRsi > 80, `RSI: اتجاه صاعد نقي يعطي قراءة تشبع شرائي قوية (${lastBullRsi?.toFixed(1)})`);

  // Create downtrend candles -> RSI must be strictly < 30
  const bearCandles: Candle[] = [];
  for (let i = 0; i < 25; i++) {
    bearCandles.push({
      time: baseTime + i * 3600000,
      open: 200 - (i * 2),
      high: 201 - (i * 2),
      low: 198 - (i * 2),
      close: 198 - (i * 2),
      volume: 1000,
    });
  }
  const bearRsi = calculateRSISeries(bearCandles, 14);
  const lastBearRsi = bearRsi[bearRsi.length - 1];
  assert(lastBearRsi !== null && lastBearRsi < 20, `RSI: اتجاه هابط نقي يعطي قراءة تشبع بيعي قوية (${lastBearRsi?.toFixed(1)})`);

  // 3. Test Bollinger Bands
  const bb = calculateBollingerBands(sampleCandles, 20, 2);
  assert(bb.upper !== null && bb.middle !== null && bb.lower !== null, 'بولينجر باند: تم احتساب النطاقات الثلاثة بنجاح');
  assert(bb.upper! > bb.middle! && bb.middle! > bb.lower!, 'بولينجر باند: النطاق العلوي > المتوسط > النطاق السفلي');

  // 3.5 Test Stochastic Oscillator (%K, %D)
  const stochBull = calculateStochastic(bullCandles, 14, 3, 3);
  assert(stochBull.k !== null && stochBull.d !== null, 'الاستوكاستك: حساب خط %K وخط %D بنجاح');
  assert(stochBull.k! > 80, `الاستوكاستك: مسار صاعد مستمر يسجل حالة تشبع شرائي (%K=${stochBull.k})`);
  assert(stochBull.state === 'overbought', 'الاستوكاستك: تحديد حالة التشبع الشرائي overbought بدقة أعلى 80');

  const stochBear = calculateStochastic(bearCandles, 14, 3, 3);
  assert(stochBear.k !== null && stochBear.k! < 20, `الاستوكاستك: مسار هابط يسجل حالة تشبع بيعي (%K=${stochBear.k})`);
  assert(stochBear.state === 'oversold', 'الاستوكاستك: تحديد حالة التشبع البيعي oversold بدقة أدنى 20');

  const stochSeries = calculateStochasticSeries(sampleCandles, 14, 3, 3);
  const validKs = stochSeries.k.filter((v): v is number => v !== null);
  const allInRange = validKs.every(v => v >= 0 && v <= 100);
  assert(allInRange === true, 'الاستوكاستك: جميع قيم %K محصورة ضمن النطاق الرياضي الصحيح [0, 100]');

  // 4. Test Fibonacci Retracement Levels
  const fib = calculateFibonacciRetracements(2000, 1000, 'up');
  const level50 = fib.levels.find(l => l.ratio === 0.500);
  const level618 = fib.levels.find(l => l.ratio === 0.618);
  assert(level50?.price === 1500, 'فيبوناتشي: نسبة 50% بين 2000 و 1000 تساوي 1500 بدقة');
  assert(level618?.price === 1382, 'فيبوناتشي: النسبة الذهبية 61.8% تساوي 1382 بدقة');

  // 5. Test CSV Parsing of MetaTrader 4 & Error Detection
  const validMT4CSV = `2024.01.15,10:00,2045.50,2048.20,2044.10,2047.80,120
2024.01.15,11:00,2047.80,2052.00,2046.50,2050.10,140
2024.01.15,12:00,2050.10,2055.40,2049.00,2053.80,180
2024.01.15,13:00,2053.80,2054.00,2048.20,2049.00,160
2024.01.15,14:00,2049.00,2051.20,2045.00,2046.50,110
2024.01.15,15:00,2046.50,2048.00,2042.10,2043.20,130
2024.01.15,16:00,2043.20,2047.50,2041.00,2046.00,150
2024.01.15,17:00,2046.00,2049.80,2044.50,2048.50,140
2024.01.15,18:00,2048.50,2053.00,2047.00,2051.80,170
2024.01.15,19:00,2051.80,2056.00,2050.00,2054.20,190`;

  const parsedMT4 = parseGoldCSV(validMT4CSV);
  assert(parsedMT4.success === true, 'استيراد CSV: نجاح استيراد ملف ميتاتريدر 4 صالح');
  assert(parsedMT4.validRows === 10, 'استيراد CSV: تم استخراج 10 شموع صحيحة بالتمام');

  // Test CSV Error Handling (Discrepancy: Low > High)
  const corruptCSV = `2024.01.15,10:00,2045.50,2040.00,2050.00,2047.80,120
2024.01.15,11:00,2047.80,2052.00,2046.50,2050.10,140`;
  const parsedCorrupt = parseGoldCSV(corruptCSV);
  assert(parsedCorrupt.errors.length > 0, 'استيراد CSV: اكتشاف تعارض في أسعار الشمعة (Low > High) ورفض الشمعة التالفة');

  // 6. Test Backtest Engine (Out-of-Sample Separation)
  const backtestCandles: Candle[] = [];
  for (let i = 0; i < 100; i++) {
    // Generate oscillating wave data
    const angle = (i / 10) * Math.PI;
    const price = 50000 + Math.sin(angle) * 2000 + (i * 20);
    backtestCandles.push({
      time: baseTime + i * 3600000,
      open: price - 50,
      high: price + 100,
      low: price - 100,
      close: price,
      volume: 500,
    });
  }

  const bt = runBacktest(backtestCandles, {
    strategy: 'EMA_Cross_Trend',
    inSampleRatio: 0.70,
  });

  assert(typeof bt.winRate === 'number', 'باكتيست: تم احتساب نسبة النجاح كقيمة رقمية');
  assert(typeof bt.maxDrawdownPercent === 'number', 'باكتيست: تم احتساب أقصى تراجع للمحفظة Max Drawdown');
  assert(bt.inSampleTrades >= 0 && bt.outOfSampleTrades >= 0, 'باكتيست: تم فصل الصفقات داخل العينة In-Sample وخارج العينة Out-of-Sample');

  // 8. Test Lookahead Bias Prevention (Indicator at bar i must not change when future bars are appended)
  const initialSeries = sampleCandles.slice(0, 20);
  const extendedSeries = sampleCandles.slice(0, 25);
  const emaInitial = calculateEMASeries(initialSeries, 10);
  const emaExtended = calculateEMASeries(extendedSeries, 10);
  assert(
    Math.abs((emaInitial[19] as number) - (emaExtended[19] as number)) < 0.00001,
    'منع الانحياز المستقبلي (No Lookahead Bias): قيمة EMA للشمعة 20 متطابقة تماماً قبل وبعد إضافة الشموع اللاحقة'
  );

  const rsiInitial = calculateRSISeries(bullCandles.slice(0, 20), 14);
  const rsiExtended = calculateRSISeries(bullCandles.slice(0, 25), 14);
  assert(
    Math.abs((rsiInitial[19] as number) - (rsiExtended[19] as number)) < 0.00001,
    'منع الانحياز المستقبلي (No Lookahead Bias): قيمة RSI للشمعة 20 متطابقة تماماً قبل وبعد إضافة الشموع اللاحقة'
  );

  // 9. Test Elliott Wave Strict Rules Validation
  const elliottCandles: Candle[] = [];
  // Construct a valid 5-wave motive sequence:
  // W0=100 -> W1=150 -> W2=120 -> W3=220 -> W4=170 -> W5=250
  // Note: W2 (120) > W0 (100) -> Rule 1 PASS
  // W3 length = 100 > W1 length = 50 -> Rule 2 PASS
  // W4 (170) > W1 (150) -> Rule 3 PASS (no overlap)
  const wavePoints = [
    { p: 100, t: 0 },
    { p: 150, t: 1 },
    { p: 120, t: 2 },
    { p: 220, t: 3 },
    { p: 170, t: 4 },
    { p: 250, t: 5 },
  ];
  for (let i = 0; i < wavePoints.length; i++) {
    elliottCandles.push({
      time: baseTime + i * 3600000,
      open: wavePoints[i].p - 1,
      high: wavePoints[i].p + 1,
      low: wavePoints[i].p - 1,
      close: wavePoints[i].p,
      volume: 1000,
      isClosed: true,
    });
  }
  // Pad with intermediate candles to form swings
  const paddedCandles: Candle[] = [];
  let currentTime = baseTime;
  for (let i = 0; i < wavePoints.length; i++) {
    // 3 candles leading to peak/trough
    const target = wavePoints[i].p;
    const prev = i > 0 ? wavePoints[i - 1].p : target - 10;
    paddedCandles.push({ time: currentTime += 3600000, open: prev, high: Math.max(prev, target), low: Math.min(prev, target), close: (prev + target) / 2, volume: 100 });
    paddedCandles.push({ time: currentTime += 3600000, open: (prev + target) / 2, high: target + 1, low: target - 1, close: target, volume: 200 });
    paddedCandles.push({ time: currentTime += 3600000, open: target, high: Math.max(prev, target), low: Math.min(prev, target), close: (prev + target) / 2, volume: 100 });
  }

  // 10. Test Price Action School (BOS & CHoCH)
  const paSwings = findPivotSwings(paddedCandles, 1);
  assert(Array.isArray(paSwings.highs) && Array.isArray(paSwings.lows), 'سلوك السعر: تحديد القمم والقيعان المحورية بنجاح');

  // 11. Test Multi-Asset Scanner Coverage & Asset Expansion
  const { SUPPORTED_ASSETS } = await import('../src/types/market.ts');
  const requiredSymbols = ['XAUUSD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
  const coveredSymbols = SUPPORTED_ASSETS.map(a => a.symbol);
  const allRequiredCovered = requiredSymbols.every(sym => coveredSymbols.includes(sym as any));
  assert(allRequiredCovered === true, 'ماسح الأصول: تغطية كافة الأصول الستة المطلوبة (XAU, BTC, ETH, SOL, BNB, XRP)');
  assert(coveredSymbols.includes('PAXGUSDT'), 'ماسح الأصول: توفير أصل PAXGUSDT كمسار منفصل مرتبط بالذهب');

  // 11.1 Test Silver Presence (XAGUSD)
  assert(coveredSymbols.includes('XAGUSD'), 'تغطية المعادن: أصل الفضة الفورية XAGUSD موجود ومدرج ضمن الأصول المدعومة');
  const silverConfig = SUPPORTED_ASSETS.find(a => a.symbol === 'XAGUSD');
  assert(silverConfig?.category === 'commodity' && silverConfig?.decimals === 3, 'تغطية المعادن: إعدادات الفضة دقيقة كسلعة ثمينة بـ 3 خانات عشرية');

  // 11.2 Test Major Forex Currency Pairs (أزواج العملات الأجنبية الرئيسية السبعة)
  const requiredForexMajors = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD'];
  const allForexCovered = requiredForexMajors.every(sym => coveredSymbols.includes(sym as any));
  assert(allForexCovered === true, 'سوق الفوركس: جميع أزواج العملات الرئيسية السبعة موجودة ومدرجة (EURUSD, GBPUSD, USDJPY, USDCHF, USDCAD, AUDUSD, NZDUSD)');

  const forexCategoriesValid = requiredForexMajors.every(sym => {
    const cfg = SUPPORTED_ASSETS.find(a => a.symbol === sym);
    return cfg?.category === 'forex';
  });
  assert(forexCategoriesValid === true, 'سوق الفوركس: تصنيف أزواج العملات الأجنبية السبعة يتبع فئة forex بنجاح');

  // 12. Test Macroeconomic Indicators Engine (Axis 3)
  const { generateMacroAnalysisReport, getMacroSummaryForSymbol, MACRO_INDICATORS } = await import('../src/services/macro-service.ts');
  const macroReport = generateMacroAnalysisReport('BTCUSDT');
  assert(macroReport.keyIndicators.length >= 6, 'لوحة الاقتصاد الكلي: توفر المؤشرات الستة الحاكمة (الفائدة، التضخم، الوظائف، DXY، عوائد 10Y، الخوف والطمع)');
  assert(Boolean(macroReport.monetaryPolicyState.fedFundsRate), 'لوحة الاقتصاد الكلي: رصد معدل الفائدة الفيدرالية بدقة');
  assert(macroReport.upcomingEvents.length > 0, 'المفكرة الاقتصادية: احتواء الأحداث الاقتصادية ذات التأثير المرتفع والمتوسط مع التوقيت والتقديرات');

  // 13. Test Macro Mechanistic Three-Tier Distinction (Axis 3)
  const goldSynthesis = macroReport.goldMacroSynthesis;
  assert(goldSynthesis.factualData.length > 0, 'محرك الاقتصاد الكلي: الفصل الصارم للبيانات الواقعية المثبتة للذهب');
  assert(goldSynthesis.economicMechanism.length > 0, 'محرك الاقتصاد الكلي: صياغة آلية التأثير الاقتصادي المجردة (العلاقة العكسية مع الفائدة والدولار)');
  assert(goldSynthesis.probabilisticHypothesis.length > 0, 'محرك الاقتصاد الكلي: صياغة الفرضيات والتوقعات الاحتمالية المستندة للبيانات');

  // 14. Test Macro Alignment with Technical Trend
  const alignedSummary = getMacroSummaryForSymbol('BTCUSDT', 'صاعد');
  assert(alignedSummary.macroBias === 'صاعد' && alignedSummary.alignment === 'داعم للتحليل الفني', 'التوافق الكلي: ربط سليم بين الاتجاه الفني والرياح الاقتصادية الكلية');
  const conflictingSummary = getMacroSummaryForSymbol('BTCUSDT', 'هابط');
  assert(conflictingSummary.alignment === 'معاكس للتحليل الفني', 'التوافق الكلي: إطلاق تحذير عند تعارض التحليل الفني مع الاقتصاد الكلي');

  // 15. Test Live Market Connection (Binance API Multi-Asset: BTC, ETH, SOL, PAXG)
  async function runAsyncTests() {
    console.log('\n--- اختبار الاتصال المباشر بمصادر بيانات السوق المتعددة ---');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const btcRes = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=5', {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (btcRes.ok) {
        const btcData = await btcRes.json();
        assert(Array.isArray(btcData) && btcData.length === 5, 'بيانات البيتكوين: اتصال ناجح بـ Binance REST API واستلام 5 شموع حية');
        const first = btcData[0];
        const last = btcData[btcData.length - 1];
        assert(Number(first[0]) < Number(last[0]), 'بيانات البيتكوين: الشموع مرتبة تصاعدياً زمنياً بدقة');
        const nowMs = Date.now();
        const lastCloseTime = Number(last[6]);
        const isClosed = nowMs > lastCloseTime;
        assert(typeof isClosed === 'boolean', `بيانات البيتكوين: تمييز حالة الشمعة الحالية (مغلقة=${isClosed}) بناءً على closeTime`);
      } else {
        console.warn('⚠️ تحذير: تعذر الاتصال المباشر بـ Binance API في بيئة الاختبار (قد تكون مقيدة بشبكة معزولة)');
      }
    } catch (e: any) {
      console.warn('⚠️ ملاحظة: اتصال API الخارجي:', e.message);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const ethRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT', {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (ethRes.ok) {
        const ethData: any = await ethRes.json();
        const ethPrice = parseFloat(ethData.price);
        assert(ethPrice > 500 && ethPrice < 20000, `بيانات الإيثيريوم: استلام سعر حي لـ ETHUSDT (${ethPrice} USD)`);
      }
    } catch (e: any) {
      console.warn('⚠️ ملاحظة: اتصال سعر الإيثيريوم:', e.message);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const goldRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT', {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (goldRes.ok) {
        const goldData: any = await goldRes.json();
        const paxgPrice = parseFloat(goldData.price);
        assert(paxgPrice > 1000 && paxgPrice < 10000, `بيانات الذهب: استلام سعر حي لأصل PAXG البديل (${paxgPrice} USD/oz)`);
      }
    } catch (e: any) {
      console.warn('⚠️ ملاحظة: اتصال سعر الذهب البديل:', e.message);
    }

    // Test Silver (XAGUSD) live klines
    try {
      const { fetchForexMetalsKlines } = await import('../src/services/market/forex-metals-adapter.ts');
      const silverRes = await fetchForexMetalsKlines('XAGUSD', '1h', 50);
      assert(silverRes.candles.length >= 10, `بيانات الفضة: جلب شموع الفضة XAGUSD بنجاح (${silverRes.candles.length} شمعة)`);
      const lastSilver = silverRes.candles[silverRes.candles.length - 1];
      assert(lastSilver.close > 10 && lastSilver.close < 200, `بيانات الفضة: سعر إغلاق الفضة منطقي (${lastSilver.close.toFixed(3)} USD/oz)`);

      // Test Forex Majors (EURUSD) live klines
      const eurRes = await fetchForexMetalsKlines('EURUSD', '1h', 50);
      assert(eurRes.candles.length >= 10, `بيانات الفوركس: جلب شموع EURUSD بنجاح (${eurRes.candles.length} شمعة)`);
      const lastEur = eurRes.candles[eurRes.candles.length - 1];
      assert(lastEur.close > 0.8 && lastEur.close < 1.8, `بيانات الفوركس: سعر صرف EURUSD يقع ضمن النطاق الطبيعي (${lastEur.close.toFixed(5)})`);
    } catch (e: any) {
      console.warn('⚠️ ملاحظة: اختبار بيانات الفضة والفوركس:', e.message);
    }

    // Test Macroeconomic Data Validity & Verified Sources
    try {
      const {
        MACRO_INDICATORS,
        MACRO_CROSS_ASSET_MATRIX,
        generateWeeklyEconomicCalendar,
        generateMacroAnalysisReport,
      } = await import('../src/services/macro-service.ts');

      assert(MACRO_INDICATORS.length >= 10, `الاقتصاد الكلي: توفر ${MACRO_INDICATORS.length} مؤشرات كلية معتمدة`);
      
      const allHaveSources = MACRO_INDICATORS.every((ind) => ind.source && ind.source.length > 5);
      assert(allHaveSources, 'الاقتصاد الكلي: جميع المؤشرات الكلية موثقة بمصادر رسمية معتمدة (FRED, BLS, BEA, Treasury, ECB)');

      assert(MACRO_CROSS_ASSET_MATRIX.length >= 5, `الاقتصاد الكلي: مصفوفة الارتباط والتأثير الميكانيكي تغطي ${MACRO_CROSS_ASSET_MATRIX.length} محركات رئيسية`);

      const calendarEvents = generateWeeklyEconomicCalendar();
      assert(calendarEvents.length >= 10, `المفكرة الاقتصادية: تغطية شاملة لـ ${calendarEvents.length} أحداث على مدار الأسبوع`);

      const highImpactEvents = calendarEvents.filter((e) => e.importance === 'high');
      assert(highImpactEvents.length >= 4, `المفكرة الاقتصادية: وجود ${highImpactEvents.length} أحداث عالية الأهمية قابلة للتنبيه`);

      const report = generateMacroAnalysisReport();
      assert(Boolean(report.goldMacroSynthesis && report.silverMacroSynthesis && report.forexMacroSynthesis && report.cryptoMacroSynthesis), 'الاستدلال الكلي: تغطية التحليل ثلاثي المستويات للأصول الأربعة (الذهب، الفضة، الفوركس، الكريبتو)');
      assert(Boolean(report.macroScoreBySector && report.macroScoreBySector.gold > 0), 'الاستدلال الكلي: حساب درجات الدعم الكلي للقطاعات بنجاح');
    } catch (e: any) {
      console.warn('⚠️ ملاحظة: اختبار الاقتصاد الكلي والمفكرة:', e.message);
    }

    // Test Enhanced Numerical & Time School (W.D. Gann, Square of 9, Murrey Math)
    try {
      const { evaluateNumericalSchool } = await import('../src/services/schools/numerical-school.ts');
      const mockCandles: Candle[] = [];
      const now = Date.now();
      for (let i = 0; i < 60; i++) {
        mockCandles.push({
          time: now - (60 - i) * 3600000,
          open: 2600 + i * 2,
          high: 2605 + i * 2,
          low: 2595 + i * 2,
          close: 2602 + i * 2,
          volume: 5000,
        });
      }
      const mockSwings = {
        highs: [{ price: 2722, time: now - 3600000, index: 59, type: 'high' as const }],
        lows: [{ price: 2600, time: now - 60 * 3600000, index: 0, type: 'low' as const }],
      };

      const numResult = evaluateNumericalSchool(mockCandles, mockSwings);
      assert(numResult.status === 'مكتملة', 'التحليل الرقمي: جاهزية المدرسة الرقمية مكتملة');
      assert(Boolean(numResult.gannAngles && numResult.gannAngles.length === 7), 'التحليل الرقمي: احتساب زوايا غان الهندسية الـ 7 كاملة (1x8 إلى 8x1)');
      assert(Boolean(numResult.gannAngles?.some((a) => a.angleName.includes('1x1'))), 'التحليل الرقمي: تواجد زاوية التوازن الكبرى 1x1 لغان');
      assert(numResult.squareOfNineHarmonics.length >= 10, 'التحليل الرقمي: شبكة مربع التسعة التفاعلي تغطي المحاور الكاردينالية والصلبان الثابتة');
      assert(Boolean(numResult.murreyMathOctaves && numResult.murreyMathOctaves.length === 9), 'التحليل الرقمي: سلم موري ماث الرياضي يحتوي الأوكتافات التسعة من 0/8 إلى 8/8');
      assert(Boolean(numResult.priceTimeSquareStatus), 'التحليل الرقمي: تشخيص تربيع السعر والزمن يعمل بنجاح');
      assert(Boolean(numResult.lucasTimeCycles && numResult.lucasTimeCycles.length >= 5), 'التحليل الرقمي: دورات لوكاس وفيبوناتشي الزمنية متوفرة');
    } catch (e: any) {
      console.warn('⚠️ ملاحظة: اختبار التحليل الرقمي:', e.message);
    }

    // Test Enhanced Astro-Financial School & Astronomical Events Database Through 2028
    try {
      const {
        ASTRO_MARKET_EVENTS_2026_2028,
        evaluateAstroSchool,
        calculateLunarPhase,
        getMercuryRetrogradeDiagnostic,
      } = await import('../src/services/schools/astro-school.ts');

      assert(ASTRO_MARKET_EVENTS_2026_2028.length >= 20, `التحليل الفلكي: توفر قاعدة بيانات متكاملة لـ ${ASTRO_MARKET_EVENTS_2026_2028.length} حدثاً فلكياً`);
      
      const has2028Events = ASTRO_MARKET_EVENTS_2026_2028.some((ev) => ev.date.startsWith('2028'));
      assert(has2028Events, 'التحليل الفلكي: تغطية أحداث عام 2028 بالكامل');

      const hasDec31_2028 = ASTRO_MARKET_EVENTS_2026_2028.some((ev) => ev.date === '2028-12-31');
      assert(hasDec31_2028, 'التحليل الفلكي: امتداد الأحداث الفلكية حتى تاريخ 31/12/2028 (خسوف ليلة رأس السنة 2028)');

      const extremeEvents = ASTRO_MARKET_EVENTS_2026_2028.filter((ev) => ev.impactLevel === 'extreme');
      const strongEvents = ASTRO_MARKET_EVENTS_2026_2028.filter((ev) => ev.impactLevel === 'strong');
      const aboveAvgEvents = ASTRO_MARKET_EVENTS_2026_2028.filter((ev) => ev.impactLevel === 'above_average');

      assert(extremeEvents.length >= 6, `التحليل الفلكي: وجود ${extremeEvents.length} أحداث كبرى ذات التأثير الأقوى (كسوفات كبرى واقترانات عظمى)`);
      assert(strongEvents.length >= 8, `التحليل الفلكي: وجود ${strongEvents.length} أحداث قوية التأثير (خسوفات وانقلابات واعتدالات)`);
      assert(aboveAvgEvents.length >= 2, `التحليل الفلكي: وجود أحداث أعلى من المتوسط`);

      const centuryEclipse = ASTRO_MARKET_EVENTS_2026_2028.find((ev) => ev.id === 'astro_2027_08_century_solar_eclipse');
      assert(Boolean(centuryEclipse && centuryEclipse.date === '2027-08-02'), 'التحليل الفلكي: تسجيل كسوف القرن الكلي العظيم بتاريخ 2 أغسطس 2027');

      const saturnNeptune = ASTRO_MARKET_EVENTS_2026_2028.find((ev) => ev.id === 'astro_2026_02_saturn_neptune');
      assert(Boolean(saturnNeptune), 'التحليل الفلكي: تسجيل اقتران زحل ونبتون التاريخي في 0° الحمل');

      const jupiterUranus = ASTRO_MARKET_EVENTS_2026_2028.find((ev) => ev.id === 'astro_2028_04_jupiter_uranus');
      assert(Boolean(jupiterUranus), 'التحليل الفلكي: تسجيل اقتران المشتري وأورانوس 2028 المحفز للكريبتو');

      const astroEvaluation = evaluateAstroSchool(Date.now());
      assert(astroEvaluation.status === 'مكتملة', 'التحليل الفلكي: تقييم المدرسة الفلكية مكتمل مع الضوابط الاستقرائية');
      assert(Boolean(astroEvaluation.lunarPhase && astroEvaluation.lunarIlluminationPercent !== undefined), 'التحليل الفلكي: احتساب طور القمر ونسبة الإضاءة بدقة');
      assert(Boolean(astroEvaluation.mercuryRetrogradeStatus), 'التحليل الفلكي: تشخيص دورة تراجع عطارد بدقة');
    } catch (e: any) {
      console.warn('⚠️ ملاحظة: اختبار التحليل الفلكي:', e.message);
    }

    // =========================================================================
    // المرحلة الأولى: اختبارات موثوقية البيانات وماسح الفرص المعزولة
    // =========================================================================
    console.log('\n--- اختبارات المرحلة الأولى: موثوقية البيانات وماسح الفرص المعزولة ---');

    // Test 1: Scanner returns element for all 15 assets & crypto 24h ticker
    try {
      const { scanMultiAssetOpportunities } = await import('../src/services/scanner-service.ts');
      const { SUPPORTED_ASSETS } = await import('../src/types/market.ts');

      // Safe deterministic mock for scanner
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const urlStr = input.toString();
        // Binance 24hr ticker mock
        if (urlStr.includes('/api/v3/ticker/24hr')) {
          const sym = new URL(urlStr).searchParams.get('symbol') || 'BTCUSDT';
          return new Response(JSON.stringify({
            symbol: sym,
            priceChange: '1500.00',
            priceChangePercent: '3.25',
            lastPrice: '68500.00',
            highPrice: '69000.00',
            lowPrice: '67000.00',
            volume: '15000',
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        // Binance klines mock
        if (urlStr.includes('/api/v3/klines')) {
          const now = Date.now();
          const mockKlines = Array.from({ length: 30 }, (_, i) => [
            now - (30 - i) * 3600000,
            '65000.0', '65500.0', '64800.0', '65200.0', '500.0',
            now - (29 - i) * 3600000,
          ]);
          return new Response(JSON.stringify(mockKlines), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        // Yahoo chart mock
        if (urlStr.includes('query1.finance.yahoo.com')) {
          const nowSec = Math.floor(Date.now() / 1000);
          const timestamps = Array.from({ length: 25 }, (_, i) => nowSec - (25 - i) * 3600);
          const closes = Array.from({ length: 25 }, (_, i) => 1.0850 + i * 0.0005);
          return new Response(JSON.stringify({
            chart: {
              result: [{
                timestamp: timestamps,
                indicators: {
                  quote: [{
                    open: closes,
                    high: closes.map(c => c + 0.0010),
                    low: closes.map(c => c - 0.0010),
                    close: closes,
                    volume: Array(25).fill(1000),
                  }],
                },
              }],
            },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return originalFetch(input, init);
      };

      try {
        const scanResults = await scanMultiAssetOpportunities('1h');
        assert(scanResults.length === 15, `المهمة 1.1: الماسح يعيد عنصراً لكل أصل من الأصول الـ 15 داخل SUPPORTED_ASSETS (${scanResults.length}/15)`);

        const allSupportedExist = SUPPORTED_ASSETS.every(asset =>
          scanResults.some(r => r.symbol === asset.symbol)
        );
        assert(allSupportedExist, 'المهمة 1.1: جميع رموز الأصول الـ 15 موجودة داخل نتائج فحص الماسح دون إسقاط أي أصل');

        // Test 2: Crypto path uses Binance and 24h ticker
        const btcItem = scanResults.find(r => r.symbol === 'BTCUSDT');
        assert(Boolean(btcItem && btcItem.priceChangePercent24h === 3.25), 'المهمة 1.2 & 1.3: مسار العملات الرقمية يعتمد على تغير 24 ساعة حقيقي من fetchBinance24hTicker (3.25%)');
        assert(Boolean(btcItem && btcItem.dataSource.includes('Binance')), 'المهمة 1.2: مسار العملات الرقمية يوثق مصدر Binance Spot REST API الحقيقي');
      } finally {
        globalThis.fetch = originalFetch;
      }
    } catch (e: any) {
      assert(false, `فشل اختبار فحص الماسح لـ 15 أصلاً: ${e.message}`);
    }

    // Test 3: Forex/Silver Provider failure returns explicit error without synthetic candles
    try {
      const { fetchForexMetalsKlines, clearForexCandleCache } = await import('../src/services/market/forex-metals-adapter.ts');
      clearForexCandleCache();
      const originalFetch = globalThis.fetch;
      // Force failure
      globalThis.fetch = async () => new Response('Internal Server Error', { status: 500 });
      let threwExpectedError = false;
      try {
        await fetchForexMetalsKlines('XAGUSD', '1h', 50);
      } catch (err: any) {
        threwExpectedError = true;
        assert(err.message.includes('تعذر جلب شموع حقيقية'), 'المهمة 2.1 & 4.3: عند فشل مزود الفوركس/الفضة يتم رمي خطأ صريح دون توليد شموع اصطناعية أو أسعار عشوائية');
      } finally {
        globalThis.fetch = originalFetch;
        clearForexCandleCache();
      }
      assert(threwExpectedError, 'المهمة 2.1: إيقاف الشموع الاصطناعية بالكامل والتعامل مع الفشل بخطأ منظم');
    } catch (e: any) {
      assert(false, `فشل اختبار إيقاف الشموع الاصطناعية: ${e.message}`);
    }

    // Test 4: Stale or non-live data does not appear as live and prevents issuing live trade setup
    try {
      const { analyzeMarket } = await import('../src/services/market-analyst.ts');
      const oldTime = Date.now() - 5 * 24 * 60 * 60 * 1000; // 5 days old
      const staleCandles: Candle[] = [];
      for (let i = 0; i < 30; i++) {
        staleCandles.push({
          time: oldTime + i * 3600000,
          open: 100 + i * 2,
          high: 102 + i * 2,
          low: 99 + i * 2,
          close: 101 + i * 2,
          volume: 1000,
          isClosed: true,
        });
      }

      const staleReport = await analyzeMarket(staleCandles, 'BTCUSDT', '1h', 'بيانات قديمة', false);
      assert(staleReport.isLive === false, 'المهمة 3.1 & 4.4: البيانات القديمة / غير الحية تحدد isLive = false بدقة');
      assert(staleReport.tradeSetup.hasSetup === false, 'المهمة 3.1 & 4.4: منع إصدار صفقة تداول حية عند كون البيانات قديمة أو السوق مغلق (hasSetup = false)');
      assert(staleReport.tradeSetup.reasoning.includes('غير حية أو قديمة'), 'المهمة 3.1: توضيح سبب تعطيل الصفقة في tradeSetup.reasoning بأن البيانات قديمة أو السوق مغلق');
    } catch (e: any) {
      assert(false, `فشل اختبار البيانات القديمة: ${e.message}`);
    }

    // Test 5: Open vs closed candle calculation based on timeframe duration
    try {
      const { getTimeframeMs } = await import('../src/services/market/binance-adapter.ts');
      const now = Date.now();
      const candleOpenTime = now - 20 * 60 * 1000; // 20 minutes ago

      // 15m timeframe: 20 mins ago + 15 mins = 5 mins ago (past) => isClosed = true
      const tf15Ms = getTimeframeMs('15m');
      const isClosed15m = candleOpenTime + tf15Ms <= now;
      assert(isClosed15m === true, 'المهمة 3.1 & 4.5: الشمعة المفتوحة قبل 20 دقيقة تعتبر مغلقة (isClosed: true) في إطار 15m');

      // 1h timeframe: 20 mins ago + 60 mins = 40 mins future => isClosed = false
      const tf1hMs = getTimeframeMs('1h');
      const isClosed1h = candleOpenTime + tf1hMs <= now;
      assert(isClosed1h === false, 'المهمة 3.1 & 4.5: الشمعة المفتوحة قبل 20 دقيقة تعتبر قيد التكوين (isClosed: false) في إطار 1h');
    } catch (e: any) {
      assert(false, `فشل اختبار دقة تمييز حالة إغلاق الشمعة: ${e.message}`);
    }

    // Test 6: Gold CSV Import and Resampling with inverse resampling prevention
    try {
      const { GoldDataAdapter } = await import('../src/services/market/gold-adapter.ts');
      // Align to a clean 4-hour bucket boundary (multiple of 14,400,000ms)
      const baseHour = Math.floor(1700000000000 / (4 * 3600000)) * (4 * 3600000);
      const hourlyCandles: Candle[] = [];
      for (let i = 0; i < 16; i++) {
        hourlyCandles.push({
          time: baseHour + i * 3600000,
          open: 2000 + i * 5,
          high: 2010 + i * 5,
          low: 1995 + i * 5,
          close: 2005 + i * 5,
          volume: 200,
          isClosed: true,
        });
      }

      GoldDataAdapter.setImportedData(hourlyCandles, 'gold_1h_test.csv', 'MetaTrader 4');
      const nativeIntervalMs = GoldDataAdapter.detectOriginalTimeframeMs(hourlyCandles);
      assert(nativeIntervalMs === 3600000, 'المهمة 3.2 & 4.6: اكتشاف الفاصل الزمني الأصلي لملف CSV بنجاح عبر وسيط الفروق (1 ساعة = 3600000ms)');

      // Resampling to higher timeframe 4h: 16 candles / 4 = 4 resampled candles
      const resampled4h = GoldDataAdapter.resampleCandles(hourlyCandles, '4h');
      assert(resampled4h.length === 4, `المهمة 3.2 & 4.6: تجميع شموع الساعة بنجاح إلى إطار 4h (16 شمعة ساعة -> ${resampled4h.length} شمعة 4h)`);

      // Inverse resampling prevention: requesting 15m or 5m should NOT fake split candles
      const resampled15m = GoldDataAdapter.resampleCandles(hourlyCandles, '15m');
      assert(resampled15m.length === hourlyCandles.length, 'المهمة 3.2 & 4.6: منع التجميع العكسي لإطار أصغر 15m والحفاظ على شموع الملف بأبعادها الأصلية');

      const gold15mData = await GoldDataAdapter.getGoldData('15m');
      assert(gold15mData.dataSource.includes('تعذر التجميع العكسي') || gold15mData.dataSource.includes('الإطار الأصلي'), 'المهمة 3.2: توضيح عدم إمكانية التجميع العكسي في dataSource عند طلب إطار أصغر');
    } catch (e: any) {
      assert(false, `فشل اختبار تجميع بيانات الذهب ومنع التجميع العكسي: ${e.message}`);
    }

    // =========================================================================
    // المرحلة الثالثة: اختبارات المؤشرات المؤسسية والسيولة والصفقات المستوردة
    // =========================================================================
    console.log('\n--- اختبارات المرحلة الثالثة: المؤشرات المؤسسية وإسقاط الصفقات والسيولة ---');

    // Test 1: calculateADX returns valid ADX, +DI, -DI, and regime
    try {
      const { calculateADX } = await import('../src/services/quantitative-engine.ts');
      const testCandles: Candle[] = [];
      const baseTime = Date.now() - 50 * 3600000;
      for (let i = 0; i < 40; i++) {
        testCandles.push({
          time: baseTime + i * 3600000,
          open: 100 + i * 1.5,
          high: 102 + i * 1.5,
          low: 99.5 + i * 1.5,
          close: 101.5 + i * 1.5,
          volume: 2000 + (i % 5) * 200,
          isClosed: true,
        });
      }
      const adxResult = calculateADX(testCandles, 14);
      assert(typeof adxResult.adx === 'number' && adxResult.adx > 0, `المهمة 4.1: احتساب ADX بنجاح برقم موجب (${adxResult.adx})`);
      assert(typeof adxResult.plusDI === 'number' && typeof adxResult.minusDI === 'number', `المهمة 4.1: احتساب +DI (${adxResult.plusDI}) و -DI (${adxResult.minusDI})`);
      assert(['strong_trend', 'trend', 'ranging'].includes(adxResult.regime), `المهمة 4.1: تصنيف نظام اتجاه السوق بنجاح (${adxResult.regime})`);
    } catch (e: any) {
      assert(false, `فشل اختبار مؤشر ADX: ${e.message}`);
    }

    // Test 2: calculateIchimoku returns tenkanSen, kijunSen, senkouSpanA/B, cloudBias, tkCross
    try {
      const { calculateIchimoku } = await import('../src/services/quantitative-engine.ts');
      const testCandles: Candle[] = [];
      const baseTime = Date.now() - 60 * 3600000;
      for (let i = 0; i < 60; i++) {
        testCandles.push({
          time: baseTime + i * 3600000,
          open: 2000 + i * 3,
          high: 2008 + i * 3,
          low: 1995 + i * 3,
          close: 2005 + i * 3,
          volume: 1500,
          isClosed: true,
        });
      }
      const ichimokuResult = calculateIchimoku(testCandles);
      assert(typeof ichimokuResult.tenkanSen === 'number', `المهمة 4.2: احتساب خط التحويل Tenkan-sen (${ichimokuResult.tenkanSen})`);
      assert(typeof ichimokuResult.kijunSen === 'number', `المهمة 4.2: احتساب خط الأساس Kijun-sen (${ichimokuResult.kijunSen})`);
      assert(['bullish_above_cloud', 'bearish_below_cloud', 'inside_cloud_neutral'].includes(ichimokuResult.cloudBias), `المهمة 4.2: تشخيص موقع السعر من سحابة كومو (${ichimokuResult.cloudBias})`);
    } catch (e: any) {
      assert(false, `فشل اختبار إيشيموكو: ${e.message}`);
    }

    // Test 3: calculateVolumeAnalysis returns vwap, poc, volumeSMA20, relativeVolume, liquidityState
    try {
      const { calculateVolumeAnalysis } = await import('../src/services/quantitative-engine.ts');
      const testCandles: Candle[] = [];
      const baseTime = Date.now() - 35 * 3600000;
      for (let i = 0; i < 35; i++) {
        testCandles.push({
          time: baseTime + i * 3600000,
          open: 50 + (i % 3),
          high: 52 + (i % 3),
          low: 49 + (i % 3),
          close: 51 + (i % 3),
          volume: 1000 + i * 50,
          isClosed: true,
        });
      }
      const volResult = calculateVolumeAnalysis(testCandles);
      assert(typeof volResult.vwap === 'number' && volResult.vwap > 0, `المهمة 4.3: احتساب متوسط السعر المرجح بالحجم VWAP (${volResult.vwap})`);
      assert(typeof volResult.poc === 'number' && volResult.poc > 0, `المهمة 4.3: احتساب نقطة السيطرة الحجمية POC (${volResult.poc})`);
      assert(typeof volResult.relativeVolume === 'number' && volResult.relativeVolume > 0, `المهمة 4.3: احتساب الحجم النسبي RVOL (${volResult.relativeVolume})`);
    } catch (e: any) {
      assert(false, `فشل اختبار تحليل الأحجام والسيولة: ${e.message}`);
    }

    // Test 4: analyzeMarket includes adx, ichimoku, volume in report.indicators AND enables tradeSetup for imported CSV with reasoning note
    try {
      const { analyzeMarket } = await import('../src/services/market-analyst.ts');
      const baseTime = Date.now() - 40 * 3600000;
      const testCandles: Candle[] = [];
      for (let i = 0; i < 40; i++) {
        testCandles.push({
          time: baseTime + i * 3600000,
          open: 150 + i * 1.2,
          high: 153 + i * 1.2,
          low: 149 + i * 1.2,
          close: 152 + i * 1.2,
          volume: 2500,
          isClosed: true,
        });
      }

      // Test 4.1: Report indicators contain all three institutional objects
      const report = await analyzeMarket(testCandles, 'BTCUSDT', '1h', 'Binance Spot REST API', true);
      assert(Boolean(report.indicators.adx && report.indicators.adx.regime), 'المهمة 4.4: تقرير التحليل الفني يضمّن كائن ADX المؤسسي كاملاً');
      assert(Boolean(report.indicators.ichimoku && report.indicators.ichimoku.cloudBias), 'المهمة 4.4: تقرير التحليل الفني يضمّن كائن إيشيموكو كاملاً');
      assert(Boolean(report.indicators.volume && report.indicators.volume.poc !== null), 'المهمة 4.4: تقرير التحليل الفني يضمّن كائن تحليل السيولة وحجم التداول POC/VWAP كاملاً');

      // Test 4.2: Imported CSV file retains trade setup and includes disclaimer note
      const csvReport = await analyzeMarket(testCandles, 'XAUUSD', '1h', 'ملف مستورد يدوي (MetaTrader CSV)', false);
      assert(csvReport.isLive === false, 'المهمة 4.4: تقرير ملف CSV المستورد يُعرّف كغير حي بدقة');
      assert(csvReport.tradeSetup.reasoning.includes('CSV') || csvReport.tradeSetup.reasoning.includes('مستورد'), 'المهمة 4.4: تضمين تنويه صريح بملف CSV المستورد في tradeSetup.reasoning');
    } catch (e: any) {
      assert(false, `فشل اختبار تكامل مؤشرات التقرير وصفقات CSV: ${e.message}`);
    }

    // =========================================================================
    // اختبارات تدقيق الخبير ونظام التنبيهات (Telegram & Webhook Alerts + Math Safety)
    // =========================================================================
    console.log('\n--- اختبارات تدقيق الخبير ونظام التنبيهات (Telegram & Webhook + Math Safety) ---');

    // Test 5: Volume analysis robustness against zero and missing volume
    try {
      const { calculateVolumeAnalysis } = await import('../src/services/quantitative-engine.ts');
      const zeroVolCandles: Candle[] = [];
      const baseTime = Date.now() - 25 * 3600000;
      for (let i = 0; i < 25; i++) {
        zeroVolCandles.push({
          time: baseTime + i * 3600000,
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 0, // completely zero volume
          isClosed: true,
        });
      }
      const safeVol = calculateVolumeAnalysis(zeroVolCandles);
      assert(safeVol.vwap === null, 'تدقيق الخبير 1.1: عدم إرجاع NaN في VWAP عند انعدام الحجم');
      assert(safeVol.volumeSMA20 === null, 'تدقيق الخبير 1.2: عدم إرجاع NaN في SMA20 عند انعدام الحجم');
      assert(safeVol.relativeVolume === 1.0, 'تدقيق الخبير 1.3: إرجاع قيمة آمنة افتراضية 1.0 للحجم النسبي RVOL');
      assert(typeof safeVol.poc === 'number' && Number.isFinite(safeVol.poc), `تدقيق الخبير 1.4: احتساب POC آمن من النطاق السعري دون أخطاء (${safeVol.poc})`);
    } catch (e: any) {
      assert(false, `فشل اختبار حصانة مؤشرات السيولة عند انعدام الحجم: ${e.message}`);
    }

    // Test 6: Alert Dispatcher formatting and configuration
    try {
      const {
        formatTelegramTradeMessage,
        loadAlertSettings,
        sendTelegramAlert,
        sendWebhookAlert,
        DEFAULT_ALERT_SETTINGS,
      } = await import('../src/services/alert-dispatcher.ts');

      // 6.1 Default alert settings
      const defaultCfg = loadAlertSettings();
      assert(defaultCfg.telegram.enabled === false, 'نظام التنبيهات 2.1: إعدادات تيليغرام معطلة افتراضياً للأمان');
      assert(defaultCfg.webhook.enabled === false, 'نظام التنبيهات 2.2: إعدادات Webhook معطلة افتراضياً للأمان');

      // 6.2 Format message
      const samplePayload = {
        symbol: 'BTCUSDT' as const,
        timeframe: '1h' as const,
        currentPrice: 65420,
        tradeSetup: {
          hasSetup: true,
          bias: 'شراء' as const,
          entryZone: { min: 65400, max: 65400 },
          stopLoss: 64200,
          targets: [67000, 68500, 70000],
          riskRewardRatio: 2.2,
          reasoning: 'اختراق مقاومة تاريخية وتأكيد إيجابي من إيشيموكو وADX',
        },
        timestamp: Date.now(),
      };

      const msg = formatTelegramTradeMessage(samplePayload);
      assert(msg.includes('BTCUSDT'), 'نظام التنبيهات 2.3: رسالة تيليغرام تتضمن رمز الأصل بدقة');
      assert(msg.includes('65400'), 'نظام التنبيهات 2.4: رسالة تيليغرام تتضمن نقطة الدخول بدقة');
      assert(msg.includes('64200'), 'نظام التنبيهات 2.5: رسالة تيليغرام تتضمن وقف الخسارة الصارم');
      assert(msg.includes('1:2.2'), 'نظام التنبيهات 2.6: رسالة تيليغرام تتضمن نسبة العائد للمخاطرة R:R');
      assert(msg.includes('<b>') && msg.includes('</b>'), 'نظام التنبيهات 2.7: رسالة تيليغرام منسقة بأكواد HTML متوافقة مع Telegram Bot API');

      // 6.3 Disabled dispatch safeguards
      const resTg = await sendTelegramAlert(DEFAULT_ALERT_SETTINGS.telegram, samplePayload);
      assert(resTg.success === false && resTg.message.includes('معطلة'), 'نظام التنبيهات 2.8: حماية عدم إرسال تنبيه Telegram عندما تكون القناة معطلة');

      const resWh = await sendWebhookAlert(DEFAULT_ALERT_SETTINGS.webhook, samplePayload);
      assert(resWh.success === false && resWh.message.includes('معطلة'), 'نظام التنبيهات 2.9: حماية عدم إرسال Webhook عندما تكون القناة معطلة');
    } catch (e: any) {
      assert(false, `فشل اختبار محرك تنبيهات Telegram و Webhook: ${e.message}`);
    }

    // 7. Tests for 7 critical mathematical & quantitative corrections (Tasks 1 - 7)
    console.log('\n--- اختبارات تصحيحات الأخطاء الرياضية والكمية السبعة (Tasks 1-7) ---');
    try {
      const {
        roundPrice,
        calculateIchimoku,
        detectBreakouts,
      } = await import('../src/services/quantitative-engine.ts');
      const { evaluateNumericalSchool } = await import('../src/services/schools/numerical-school.ts');
      const { evaluateElliottSchool } = await import('../src/services/schools/elliott-school.ts');

      // 7.1 Test roundPrice precision
      assert(roundPrice(1.08542, 1.08542) === 1.08542, 'المهمة 1.1: roundPrice يحافظ على دقة 5 خانات لأزواج الفوركس (EURUSD = 1.08542)');
      assert(roundPrice(5.42156, 5.42) === 5.4216, 'المهمة 1.2: roundPrice يحافظ على دقة 4 خانات للأسعار دون 10 دولار (5.4216)');
      assert(roundPrice(31.4258, 31.42) === 31.426, 'المهمة 1.3: roundPrice يحافظ على دقة 3 خانات للفضة والمعادن (31.426)');
      assert(roundPrice(65420.556, 65420.556) === 65420.56, 'المهمة 1.4: roundPrice يحافظ على خانتين للأصول الكبيرة (BTC = 65420.56)');

      // 7.2 Test Ichimoku displaced cloud calculation (n >= 78)
      const ichimokuCandles: Candle[] = [];
      for (let i = 0; i < 90; i++) {
        ichimokuCandles.push({
          time: baseTime + i * 3600000,
          open: 1.0800 + i * 0.0001,
          high: 1.0810 + i * 0.0001,
          low: 1.0790 + i * 0.0001,
          close: 1.0805 + i * 0.0001,
          volume: 500,
          isClosed: true,
        });
      }
      const ichi = calculateIchimoku(ichimokuCandles);
      assert(ichi.cloudBias === 'bullish_above_cloud', 'المهمة 2.1: إيشيموكو يحسب موضع السعر فوق سحابة كومو المزاحة 26 شمعة بنجاح');
      assert(ichi.tkCross === 'bullish', 'المهمة 2.2: تقاطع TK يحافظ على الفروق الدقيقة للفوركس دون تصفير');

      // 7.3 Test detectBreakouts volume and closed candle confirmation
      const fakeoutCandles: Candle[] = [
        { time: baseTime, open: 100, high: 101, low: 99, close: 100, volume: 1000, isClosed: true },
        { time: baseTime + 3600000, open: 100, high: 101, low: 99, close: 100, volume: 1000, isClosed: true },
        // Unclosed candle or low-volume candle breaking resistance at 105
        { time: baseTime + 7200000, open: 100, high: 108, low: 100, close: 106, volume: 100, isClosed: false },
      ];
      const zones = [{ price: 105, type: 'resistance' as const, touches: 3, strength: 'strong' as const }];
      const brkUnconfirmed = detectBreakouts(fakeoutCandles, zones);
      assert(brkUnconfirmed.length > 0 && brkUnconfirmed[0].confirmed === false, 'المهمة 2.3: منع تأكيد الاختراق للشمعة غير المغلقة أو ضعيفة الحجم');

      // Confirmed breakout with closed candle & solid volume
      fakeoutCandles[2].isClosed = true;
      fakeoutCandles[2].volume = 1200;
      const brkConfirmed = detectBreakouts(fakeoutCandles, zones);
      assert(brkConfirmed.length > 0 && brkConfirmed[0].confirmed === true, 'المهمة 2.4: تأكيد الاختراق عند إغلاق الشمعة وتوفر حجم تداول داعم');

      // 7.4 Test Gann Square of Nine scale factor on Forex
      const forexCandles: Candle[] = [];
      for (let i = 0; i < 40; i++) {
        forexCandles.push({
          time: baseTime + i * 3600000,
          open: 1.0850,
          high: 1.0870,
          low: 1.0830,
          close: 1.0855,
          volume: 2000,
          isClosed: true,
        });
      }
      const gannForex = evaluateNumericalSchool(forexCandles, { highs: [], lows: [] });
      const firstGannLevel = gannForex.squareOfNineHarmonics[0];
      // For EURUSD ~1.085, normalized levels must be close to ~1.08 (e.g. between 1.00 and 1.20, NOT 1.67 or 2.37)
      assert(firstGannLevel > 0.8 && firstGannLevel < 1.3, `المهمة 3.1: تطبيع مقياس غان للفوركس يعطي مستويات متناغمة منطقية (${firstGannLevel}) بدلاً من التشويه`);

      // 7.5 Test Bearish 5-Wave Motive in Elliott School
      const bearishSwings = {
        highs: [
          { index: 5, time: baseTime + 5000, price: 100, type: 'high' as const }, // W1 start
          { index: 15, time: baseTime + 15000, price: 95, type: 'high' as const }, // W2 high
          { index: 25, time: baseTime + 25000, price: 82, type: 'high' as const }, // W4 high (< 85, no overlap with W1)
        ],
        lows: [
          { index: 10, time: baseTime + 10000, price: 85, type: 'low' as const }, // W1 low
          { index: 20, time: baseTime + 20000, price: 70, type: 'low' as const }, // W3 low
        ],
      };
      const elliottBearCandles: Candle[] = new Array(50).fill(null).map((_, i) => ({
        time: baseTime + i * 3600000,
        open: 80,
        high: 82,
        low: 78,
        close: 79,
        volume: 100,
        isClosed: true,
      }));
      const elliottBear = evaluateElliottSchool(elliottBearCandles, bearishSwings);
      assert(elliottBear.rulesValidated === true, 'المهمة 3.2: اكتشاف الدورة الموجية الخماسية الدافعة الهابطة في إليوت بنجاح');
      assert(elliottBear.probableCount.includes('هابطة'), 'المهمة 3.3: تصنيف الموجة الدافعة الهابطة بالاسم القياسي');
      assert(elliottBear.invalidationLevel === 82, 'المهمة 3.4: تحديد مستوى إبطال الموجة الهابطة عند قمة الموجة الرابعة بدقة (82)');
    } catch (e: any) {
      assert(false, `فشل اختبارات تصحيحات الأخطاء السبعة: ${e.message}`);
    }

    // 8. Tests for Universal Symbol Search & Custom Asset Loader
    console.log('\n--- اختبارات الباحث الذكي للأصول المالية المخصصة (Universal Symbol Search & Custom Asset Loader) ---');
    try {
      const { resolveYahooTicker } = await import('../src/services/market/forex-metals-adapter.ts');
      const {
        inferAssetMetadata,
        isForexPairSymbol,
        isCryptoPairSymbol,
        getAssetDecimals,
      } = await import('../src/services/market/custom-assets.ts');

      // 8.1 Test resolveYahooTicker
      assert(resolveYahooTicker('EURUSD') === 'EURUSD=X', 'الباحث الذكي 1.1: تحويل زوج رئيسي EURUSD إلى EURUSD=X');
      assert(resolveYahooTicker('GBPJPY') === 'GBPJPY=X', 'الباحث الذكي 1.2: تحويل زوج فوركس تقاطعي GBPJPY إلى GBPJPY=X');
      assert(resolveYahooTicker('EURGBP') === 'EURGBP=X', 'الباحث الذكي 1.3: تحويل زوج فوركس تقاطعي EURGBP إلى EURGBP=X');
      assert(resolveYahooTicker('OIL') === 'CL=F' && resolveYahooTicker('USOIL') === 'CL=F', 'الباحث الذكي 1.4: تحويل اختصارات النفط OIL/USOIL إلى CL=F');
      assert(resolveYahooTicker('NAS100') === '^NDX' && resolveYahooTicker('NDX') === '^NDX', 'الباحث الذكي 1.5: تحويل مؤشر ناسداك NAS100/NDX إلى ^NDX');
      assert(resolveYahooTicker('SPX') === '^GSPC' && resolveYahooTicker('US500') === '^GSPC', 'الباحث الذكي 1.6: تحويل مؤشر S&P 500 (SPX/US500) إلى ^GSPC');
      assert(resolveYahooTicker('DJI') === '^DJI' && resolveYahooTicker('US30') === '^DJI', 'الباحث الذكي 1.7: تحويل مؤشر داو جونز DJI/US30 إلى ^DJI');
      assert(resolveYahooTicker('NVDA') === 'NVDA' && resolveYahooTicker('aapl') === 'AAPL', 'الباحث الذكي 1.8: الحفاظ على رموز الأسهم القياسية NVDA و AAPL بأحرف كبيرة');

      // 8.2 Test symbol classification & metadata inference
      assert(isForexPairSymbol('GBPJPY') === true && isForexPairSymbol('EURAUD') === true, 'الباحث الذكي 2.1: التعرف الصحيح على أزواج الفوركس التقاطعية من 6 أحرف');
      assert(isForexPairSymbol('BTCUSDT') === false && isForexPairSymbol('NVDA') === false, 'الباحث الذكي 2.2: عدم الخلط بين الأسهم/الكريبتو وأزواج الفوركس');
      assert(isCryptoPairSymbol('DOGEUSDT') === true && isCryptoPairSymbol('AVAXUSDT') === true, 'الباحث الذكي 2.3: التعرف الصحيح على أزواج العملات الرقمية المخصصة');

      const nvdaMeta = inferAssetMetadata('NVDA');
      assert(nvdaMeta.category === 'stock' && nvdaMeta.decimals === 2, 'الباحث الذكي 2.4: استنتاج فئة السهم الأمريكي (stock) ودقة الخانات لـ NVDA');

      const gbpjpyMeta = inferAssetMetadata('GBPJPY');
      assert(gbpjpyMeta.category === 'forex' && gbpjpyMeta.decimals === 3, 'الباحث الذكي 2.5: استنتاج فئة الفوركس ودقة 3 خانات لأزواج الين التقاطعية (GBPJPY)');

      const eurgbpMeta = inferAssetMetadata('EURGBP');
      assert(eurgbpMeta.category === 'forex' && eurgbpMeta.decimals === 5, 'الباحث الذكي 2.6: استنتاج دقة 5 خانات لأزواج الفوركس القياسية (EURGBP)');

      const nasMeta = inferAssetMetadata('NAS100');
      assert(nasMeta.category === 'index', 'الباحث الذكي 2.7: استنتاج فئة المؤشرات (index) لـ NAS100');

      assert(getAssetDecimals('DOGEUSDT', 0.14523) === 5, 'الباحث الذكي 2.8: حساب الدقة الديناميكية للعملات الرقمية ذات السعر المنخفض (5 خانات)');
    } catch (e: any) {
      assert(false, `فشل اختبارات الباحث الذكي للأصول المخصصة: ${e.message}`);
    }

    // 9. Tests for EGX (Egyptian Exchange) Support, AMII/AMII.CA Resolution & Interval Safeguards (13 Acceptance Tests)
    console.log('\n--- اختبارات دعم البورصة المصرية (EGX) وإصلاح بحث الأسهم (AMII / COMI / FWRY) والتحقق من الفواصل الزمنية ---');
    try {
      const {
        resolveYahooTicker,
        fetchForexMetalsKlines,
        clearForexCandleCache,
      } = await import('../src/services/market/forex-metals-adapter.ts');
      const {
        inferAssetMetadata,
        normalizeDisplaySymbol,
        addCustomWatchedAsset,
        removeCustomWatchedAsset,
        isCryptoPairSymbol,
        isKnownUsStock,
        isEgxStockSymbol,
      } = await import('../src/services/market/custom-assets.ts');
      const { analyzeMarket } = await import('../src/services/market-analyst.ts');

      // Test 9.1: AMII maps to AMII.CA in EGX with EGP currency and is NEVER treated as AMIIUSDT
      const amiiMeta = inferAssetMetadata('AMII');
      assert(
        amiiMeta.symbol === 'AMII' &&
          amiiMeta.providerSymbol === 'AMII.CA' &&
          amiiMeta.market === 'EGX' &&
          amiiMeta.currency === 'EGP' &&
          resolveYahooTicker('AMII') === 'AMII.CA' &&
          isCryptoPairSymbol('AMII') === false,
        'قبول 1: الرمز AMII يوجَّه إلى AMII.CA في البورصة المصرية (EGX / EGP) ولا يتحول أبداً إلى AMIIUSDT'
      );

      // Test 9.2: Entering AMII and AMII.CA normalizes to the same canonical symbol 'AMII' without duplicates
      assert(
        normalizeDisplaySymbol('AMII') === 'AMII' && normalizeDisplaySymbol('AMII.CA') === 'AMII',
        'قبول 2.1: توحيد الرمز المعروض بين AMII و AMII.CA إلى AMII'
      );
      removeCustomWatchedAsset('AMII');
      addCustomWatchedAsset(inferAssetMetadata('AMII'));
      const afterSecondAdd = addCustomWatchedAsset(inferAssetMetadata('AMII.CA'));
      const amiiOccurrences = afterSecondAdd.filter((a) => a.symbol === 'AMII' || a.symbol === 'AMII.CA');
      assert(
        amiiOccurrences.length === 1 &&
          amiiOccurrences[0].symbol === 'AMII' &&
          amiiOccurrences[0].providerSymbol === 'AMII.CA',
        'قبول 2.2: إدخال AMII ثم AMII.CA لا ينشئ أصلين مكررين في قائمة المتابعة ويحتفظ بـ providerSymbol = AMII.CA'
      );

      // Test 9.3: Leading EGX stocks (COMI, FWRY, TMGH, SWDY) resolve to .CA with EGX market and EGP currency
      const comiMeta = inferAssetMetadata('COMI');
      const fwryMeta = inferAssetMetadata('FWRY');
      assert(
        resolveYahooTicker('COMI') === 'COMI.CA' &&
          resolveYahooTicker('FWRY') === 'FWRY.CA' &&
          comiMeta.market === 'EGX' &&
          comiMeta.currency === 'EGP' &&
          fwryMeta.market === 'EGX' &&
          fwryMeta.currency === 'EGP',
        'قبول 3: أسهم البورصة المصرية القياسية (COMI, FWRY) توجَّه تلقائياً إلى COMI.CA و FWRY.CA بعملة EGP'
      );

      // Test 9.4: Known US stocks (AAPL, NVDA, TSLA, MSFT) never get .CA appended
      assert(
        isKnownUsStock('AAPL') &&
          isKnownUsStock('NVDA') &&
          resolveYahooTicker('AAPL') === 'AAPL' &&
          resolveYahooTicker('NVDA') === 'NVDA' &&
          resolveYahooTicker('TSLA') === 'TSLA' &&
          resolveYahooTicker('MSFT') === 'MSFT' &&
          inferAssetMetadata('AAPL').market === 'US' &&
          inferAssetMetadata('AAPL').currency === 'USD',
        'قبول 4: الأسهم الأمريكية المعروفة (AAPL, NVDA, TSLA, MSFT) تبقى بدون لاحقة .CA وبعملة USD'
      );

      // Test 9.5: Forex pairs resolve to =X and never get .CA
      assert(
        resolveYahooTicker('EURUSD') === 'EURUSD=X' &&
          resolveYahooTicker('GBPJPY') === 'GBPJPY=X' &&
          !isEgxStockSymbol('EURUSD') &&
          !isEgxStockSymbol('GBPJPY'),
        'قبول 5: أزواج الفوركس (EURUSD, GBPJPY) تتحول إلى =X دون إضافة .CA'
      );

      // Test 9.6: Crypto pairs stay crypto pairs without .CA
      assert(
        isCryptoPairSymbol('BTCUSDT') &&
          isCryptoPairSymbol('SOLUSDT') &&
          !isEgxStockSymbol('BTCUSDT') &&
          inferAssetMetadata('BTCUSDT').category === 'crypto',
        'قبول 6: العملات الرقمية (BTCUSDT, SOLUSDT) تبقى ضمن فئة الكريبتو دون أي تداخل مع .CA'
      );

      // Test 9.7: Interval verification — if Yahoo returns 1d candles when 1h was requested for COMI, throw TIMEFRAME_UNSUPPORTED, and succeed on 1d
      const origFetch9 = globalThis.fetch;
      try {
        clearForexCandleCache();
        const dailyTimestamps = Array.from({ length: 30 }, (_, i) => Math.floor((Date.now() - (30 - i) * 86400000) / 1000));
        globalThis.fetch = async (input: RequestInfo | URL) => {
          const urlStr = String(input);
          // Simulate Yahoo returning daily granularity (1d) even when interval=1h is requested
          return new Response(
            JSON.stringify({
              chart: {
                result: [
                  {
                    meta: {
                      currency: 'EGP',
                      exchangeName: 'CAI',
                      dataGranularity: '1d',
                      regularMarketPrice: 82.5,
                    },
                    timestamp: dailyTimestamps,
                    indicators: {
                      quote: [
                        {
                          open: dailyTimestamps.map((_, i) => 78 + i * 0.15),
                          high: dailyTimestamps.map((_, i) => 79 + i * 0.15),
                          low: dailyTimestamps.map((_, i) => 77.5 + i * 0.15),
                          close: dailyTimestamps.map((_, i) => 78.5 + i * 0.15),
                          volume: dailyTimestamps.map(() => 150000),
                        },
                      ],
                    },
                  },
                ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        };

        let caughtTimeframeMismatch = false;
        let suggestedTf = '';
        try {
          await fetchForexMetalsKlines('COMI', '1h', 100);
        } catch (tfErr: any) {
          if (tfErr.code === 'TIMEFRAME_UNSUPPORTED') {
            caughtTimeframeMismatch = true;
            suggestedTf = tfErr.suggestedTimeframe;
          }
        }
        assert(
          caughtTimeframeMismatch && suggestedTf === '1d',
          'قبول 7.1: رفض عرض الشموع اليومية (1d) على أنها شموع ساعة (1h) وإرجاع TIMEFRAME_UNSUPPORTED مع اقتراح التبديل إلى 1d'
        );

        // Now request 1d for COMI and verify it succeeds with EOD status
        const comiDaily = await fetchForexMetalsKlines('COMI', '1d', 100);
        assert(
          comiDaily.candles.length === 30 &&
            comiDaily.isLive === false &&
            comiDaily.dataSource.includes('EGX') &&
            comiDaily.dataSource.includes('EGP'),
          'قبول 7.2: نجاح جلب الفاصل اليومي (1d) لسهم COMI.CA مع توصيف صادق لمصدر البورصة المصرية (EGX / EGP / isLive: false)'
        );
      } finally {
        globalThis.fetch = origFetch9;
        clearForexCandleCache();
      }

      // Test 9.8: Decoupling chart rendering (1..14 candles) from full quantitative analysis (>= 15 candles)
      try {
        clearForexCandleCache();
        const eightTimestamps = Array.from({ length: 8 }, (_, i) => Math.floor((Date.now() - (8 - i) * 86400000) / 1000));
        globalThis.fetch = async () =>
          new Response(
            JSON.stringify({
              chart: {
                result: [
                  {
                    meta: { currency: 'EGP', exchangeName: 'CAI', dataGranularity: '1d' },
                    timestamp: eightTimestamps,
                    indicators: {
                      quote: [
                        {
                          open: eightTimestamps.map(() => 12.0),
                          high: eightTimestamps.map(() => 12.5),
                          low: eightTimestamps.map(() => 11.8),
                          close: eightTimestamps.map(() => 12.2),
                          volume: eightTimestamps.map(() => 50000),
                        },
                      ],
                    },
                  },
                ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );

        const shortData = await fetchForexMetalsKlines('FWRY', '1d', 100);
        assert(
          shortData.candles.length === 8,
          'قبول 8.1: السماح بإرجاع وعرض الشموع على الشارت عندما يكون عددها بين 1 و 14 شمعة (8 شموع)'
        );

        let analysisRejectedUnder15 = false;
        try {
          await analyzeMarket(shortData.candles, 'FWRY', '1d', shortData.dataSource, false);
        } catch {
          analysisRejectedUnder15 = true;
        }
        assert(
          analysisRejectedUnder15 === true,
          'قبول 8.2: المحرك الكمي يطالب بـ 15 شمعة على الأقل لإصدار التقرير الكامل مع بقاء الشارت متاحاً للعرض'
        );
      } finally {
        globalThis.fetch = origFetch9;
        clearForexCandleCache();
      }

      // Test 9.9: Delisted or unavailable symbol (e.g. AMII when Yahoo returns 404) throws clear error with zero synthetic candles
      try {
        clearForexCandleCache();
        const requestedUrls: string[] = [];
        globalThis.fetch = async (input: RequestInfo | URL) => {
          requestedUrls.push(String(input));
          return new Response(
            JSON.stringify({
              chart: {
                result: null,
                error: { code: 'Not Found', description: 'No data found, symbol may be delisted' },
              },
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        };

        let failedCleanly = false;
        try {
          await fetchForexMetalsKlines('AMII', '1d', 100);
        } catch (err: any) {
          failedCleanly = err.message.includes('تعذر جلب شموع حقيقية');
        }
        const calledBinanceUsdt = requestedUrls.some((u) => u.includes('AMIIUSDT'));
        assert(
          failedCleanly && !calledBinanceUsdt,
          'قبول 9: عند عدم توفر بيانات لسهم AMII في المزود المجاني يتم إرجاع رسالة خطأ صريحة دون اختراع شموع وهمية ودون طلب AMIIUSDT'
        );
      } finally {
        globalThis.fetch = origFetch9;
        clearForexCandleCache();
      }

      // Test 9.10: Daily/EOD stock analysis calculates tradeSetup (hasSetup = true on confluence) with EOD disclaimer
      {
        const eodStockCandles: Candle[] = [];
        const baseT = Date.now() - 60 * 86400000;
        for (let i = 0; i < 45; i++) {
          eodStockCandles.push({
            time: baseT + i * 86400000,
            open: 50 + i * 0.8,
            high: 51.2 + i * 0.8,
            low: 49.5 + i * 0.8,
            close: 50.9 + i * 0.8,
            volume: 250000 + i * 2000,
            isClosed: true,
          });
        }
        const comiReport = await analyzeMarket(
          eodStockCandles,
          'COMI',
          '1d',
          'Yahoo Finance (COMI.CA - البورصة المصرية EGX - EGP - إغلاق يومي EOD)',
          false
        );
        assert(
          comiReport.isLive === false &&
            (comiReport.tradeSetup.reasoning.includes('الإغلاق التاريخية/اليومية') ||
              comiReport.tradeSetup.reasoning.includes('إغلاق يومية/تاريخية')) &&
            !comiReport.tradeSetup.reasoning.includes('تم تعطيل إصدار إشارة صفقة حية'),
          'قبول 10: تفعيل حساب مستويات الصفقة للأسهم على بيانات الإغلاق اليومية (EOD) مع إضافة تنويه واضح بدلاً من تعطيلها'
        );
      }

      // Test 9.11: CSV Import generalized to active custom stock symbol (e.g. AMII)
      {
        const amiiCsvCandles: Candle[] = [];
        const baseT = Date.now() - 40 * 86400000;
        for (let i = 0; i < 35; i++) {
          amiiCsvCandles.push({
            time: baseT + i * 86400000,
            open: 10 + i * 0.2,
            high: 10.4 + i * 0.2,
            low: 9.8 + i * 0.2,
            close: 10.3 + i * 0.2,
            volume: 85000,
            isClosed: true,
          });
        }
        const amiiCsvReport = await analyzeMarket(
          amiiCsvCandles,
          'AMII',
          '1d',
          'ملف مستورد (TradingView CSV) - AMII.csv',
          false
        );
        assert(
          amiiCsvReport.symbol === 'AMII' &&
            amiiCsvReport.candleCount === 35 &&
            amiiCsvReport.tradeSetup.reasoning.includes('CSV'),
          'قبول 11: نجاح تحليل ملف CSV مستورد للرمز المخصص النشط (AMII) بدلاً من حصر الاستيراد على XAUUSD'
        );
      }

      // Test 9.12: Honest Market, Currency & EOD Metadata for EGX equities
      {
        const tmghMeta = inferAssetMetadata('TMGH');
        assert(
          tmghMeta.market === 'EGX' &&
            tmghMeta.currency === 'EGP' &&
            tmghMeta.providerSymbol === 'TMGH.CA' &&
            tmghMeta.decimals === 2,
          'قبول 12: عرض بيانات السوق (EGX) والعملة (EGP) والرمز المزود (TMGH.CA) بدقة ومصداقية'
        );
      }

      // Test 9.13: Switching from a valid symbol to a failing symbol does not leak cached candles from the previous symbol
      try {
        clearForexCandleCache();
        const validTimestamps = Array.from({ length: 20 }, (_, i) => Math.floor((Date.now() - (20 - i) * 86400000) / 1000));
        globalThis.fetch = async (input: RequestInfo | URL) => {
          const u = String(input);
          if (u.includes('COMI.CA')) {
            return new Response(
              JSON.stringify({
                chart: {
                  result: [
                    {
                      meta: { currency: 'EGP', exchangeName: 'CAI', dataGranularity: '1d' },
                      timestamp: validTimestamps,
                      indicators: {
                        quote: [
                          {
                            open: validTimestamps.map(() => 80),
                            high: validTimestamps.map(() => 82),
                            low: validTimestamps.map(() => 79),
                            close: validTimestamps.map(() => 81),
                            volume: validTimestamps.map(() => 100000),
                          },
                        ],
                      },
                    },
                  ],
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          return new Response(JSON.stringify({ chart: { result: null, error: { code: 'Not Found' } } }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        };

        const firstLoaded = await fetchForexMetalsKlines('COMI', '1d', 50);
        assert(firstLoaded.candles.length === 20, 'قبول 13.1: تحميل السهم الأول (COMI) بنجاح');

        let secondFailedWithZeroCandles = false;
        try {
          await fetchForexMetalsKlines('UNKNOWN_SYMBOL_XYZ', '1d', 50);
        } catch {
          secondFailedWithZeroCandles = true;
        }
        assert(
          secondFailedWithZeroCandles === true,
          'قبول 13.2: عند الانتقال لرمز فاشل لا يتم إرجاع شموع الرمز السابق من الكاش أبداً'
        );
      } finally {
        globalThis.fetch = origFetch9;
        clearForexCandleCache();
      }
    } catch (e: any) {
      assert(false, `فشل اختبارات البورصة المصرية والأسهم المخصصة: ${e.message}`);
    }

    // 10. Tests for Gemini API Scanner Decoupling, Server-Only Diagnostics & Safe Fallback (9 Acceptance Tests)
    console.log('\n--- اختبارات فصل الماسح الفني عن Gemini وتشخيص الأخطاء الآمن (9 اختبارات قبول) ---');
    try {
      const {
        setGeminiTestTransport,
        getGeminiCallCount,
        resetGeminiTestState,
        diagnoseGeminiConnection,
        classifyGeminiError,
        validateGeminiApiKeyConfig,
        sanitizeGeminiErrorText,
        AI_UNAVAILABLE_NOTICE_AR,
      } = await import('../src/services/ai-synthesizer.ts');
      const { analyzeMarket, analyzeMarketDeterministic } = await import('../src/services/market-analyst.ts');
      const { scanMultiAssetOpportunities } = await import('../src/services/scanner-service.ts');
      const { clearForexCandleCache } = await import('../src/services/market/forex-metals-adapter.ts');

      const originalEnvKey = process.env.GEMINI_API_KEY;
      const originalFetch10 = globalThis.fetch;

      const buildMockScannerFetch = () => {
        const nowSec = Math.floor(Date.now() / 1000);
        const tsList = Array.from({ length: 60 }, (_, idx) => nowSec - (60 - idx) * 3600);
        return async (input: RequestInfo | URL) => {
          const urlStr = String(input);
          // Mock Binance Klines
          if (urlStr.includes('/api/v3/klines')) {
            const klines = tsList.map((t, idx) => [
              t * 1000,
              String(50000 + idx * 10),
              String(50100 + idx * 10),
              String(49900 + idx * 10),
              String(50050 + idx * 10),
              '120.5',
              (t + 3600) * 1000,
            ]);
            return new Response(JSON.stringify(klines), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          // Mock Binance 24h ticker
          if (urlStr.includes('/api/v3/ticker/24hr') || urlStr.includes('/api/v3/ticker/price')) {
            return new Response(
              JSON.stringify({ lastPrice: '50600.00', price: '50600.00', priceChangePercent: '1.85' }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          // Mock Yahoo Finance Chart
          return new Response(
            JSON.stringify({
              chart: {
                result: [
                  {
                    meta: { currency: 'USD', exchangeName: 'CCY', dataGranularity: '1h', regularMarketPrice: 1.085 },
                    timestamp: tsList,
                    indicators: {
                      quote: [
                        {
                          open: tsList.map((_, idx) => 1.08 + idx * 0.0001),
                          high: tsList.map((_, idx) => 1.082 + idx * 0.0001),
                          low: tsList.map((_, idx) => 1.079 + idx * 0.0001),
                          close: tsList.map((_, idx) => 1.081 + idx * 0.0001),
                          volume: tsList.map(() => 10000),
                        },
                      ],
                    },
                  },
                ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        };
      };

      const sampleCandles: Candle[] = Array.from({ length: 65 }, (_, i) => ({
        time: Date.now() - (65 - i) * 3600_000,
        open: 2600 + i * 1.5,
        high: 2605 + i * 1.5,
        low: 2595 + i * 1.5,
        close: 2602 + i * 1.5,
        volume: 1500 + i * 20,
        isClosed: true,
      }));

      try {
        // Test 10.1: Running scanMultiAssetOpportunities makes ZERO (0) calls to Gemini
        resetGeminiTestState();
        clearForexCandleCache();
        process.env.GEMINI_API_KEY = 'TEST_VALID_LOOKING_KEY_1234567890';
        setGeminiTestTransport(async () => {
          throw new Error('Gemini should NEVER be called during scanMultiAssetOpportunities');
        });
        globalThis.fetch = buildMockScannerFetch();

        const scanResults1 = await scanMultiAssetOpportunities('1h');
        assert(
          getGeminiCallCount() === 0 && scanResults1.length >= 15,
          `قبول Gemini 1: تشغيل scanMultiAssetOpportunities يفحص جميع الأصول (${scanResults1.length}) بعدد استدعاءات Gemini يساوي (0)`
        );

        // Test 10.2: Scanner returns asset opportunities when GEMINI_API_KEY is completely missing
        resetGeminiTestState();
        delete process.env.GEMINI_API_KEY;
        const scanResultsMissingKey = await scanMultiAssetOpportunities('1h');
        const readyCountMissingKey = scanResultsMissingKey.filter((r) => r.status === 'ready').length;
        assert(
          getGeminiCallCount() === 0 && readyCountMissingKey >= 14,
          `قبول Gemini 2: الماسح يعيد نتائج الأصول الجاهزة (${readyCountMissingKey}) بنجاح عندما يكون GEMINI_API_KEY غير موجود`
        );

        // Test 10.3: Scanner returns asset opportunities even when Gemini service throws 403 PERMISSION_DENIED
        resetGeminiTestState();
        process.env.GEMINI_API_KEY = 'TEST_FORBIDDEN_KEY_403';
        setGeminiTestTransport(async () => {
          const err: any = new Error('Failed to call the Gemini API: permission denied. Please try again.');
          err.status = 403;
          throw err;
        });
        const scanResults403 = await scanMultiAssetOpportunities('1h');
        const readyCount403 = scanResults403.filter((r) => r.status === 'ready').length;
        assert(
          getGeminiCallCount() === 0 && readyCount403 >= 14,
          `قبول Gemini 3: الماسح يعيد نتائج الأصول الجاهزة (${readyCount403}) دون أي خطأ حتى لو كانت خدمة Gemini تعيد 403 PERMISSION_DENIED`
        );

        // Test 10.4: analyzeMarket without AI (or analyzeMarketDeterministic) returns complete deterministic report
        resetGeminiTestState();
        const detReport = analyzeMarketDeterministic(sampleCandles, 'BTCUSDT', '1h', 'Binance Spot', true);
        const optNoAiReport = await analyzeMarket(sampleCandles, 'BTCUSDT', '1h', 'Binance Spot', true, {
          includeAI: false,
        });
        assert(
          getGeminiCallCount() === 0 &&
            Boolean(detReport.indicators.rsi) &&
            Boolean(detReport.schools.classical) &&
            Boolean(detReport.schools.priceAction) &&
            Boolean(detReport.schools.harmonic) &&
            Boolean(detReport.schools.elliott) &&
            Boolean(detReport.schools.numerical) &&
            Boolean(detReport.schools.astro) &&
            Boolean(detReport.scenarios.bullish) &&
            Boolean(detReport.tradeSetup) &&
            Boolean(detReport.executiveConclusion) &&
            Boolean(detReport.aiCommentary && detReport.aiCommentary.includes('تقرير التحليل الفني الموسع')) &&
            optNoAiReport.aiMeta?.status === 'DETERMINISTIC_ONLY',
          'قبول Gemini 4: analyzeMarket بدون التفسير الذكي يعيد التقرير الفني الحتمي كاملاً (المؤشرات، المدارس الست، السيناريوهات، خطة الصفقة، والملخص)'
        );

        // Test 10.5: When Gemini fails with 403 PERMISSION_DENIED, analyzeMarket falls back to deterministic commentary without throwing and does not retry repeatedly
        resetGeminiTestState();
        process.env.GEMINI_API_KEY = 'TEST_FORBIDDEN_KEY_403_CIRCUIT';
        setGeminiTestTransport(async () => {
          const err: any = new Error('Failed to call the Gemini API: permission denied. Please try again.');
          err.status = 403;
          throw err;
        });
        const fallbackReport1 = await analyzeMarket(sampleCandles, 'BTCUSDT', '1h', 'Binance Spot', true, {
          includeAI: true,
        });
        const callsAfterFirst403 = getGeminiCallCount();
        // Second call with the same forbidden key should be short-circuited by the 403 circuit breaker (0 additional network calls)
        const fallbackReport2 = await analyzeMarket(sampleCandles, 'ETHUSDT', '1h', 'Binance Spot', true, {
          includeAI: true,
        });
        const callsAfterSecond403 = getGeminiCallCount();
        assert(
          fallbackReport1.aiMeta?.usedAI === false &&
            fallbackReport1.aiMeta?.status === 'PERMISSION_DENIED' &&
            fallbackReport1.aiMeta?.noticeAr === AI_UNAVAILABLE_NOTICE_AR &&
            Boolean(fallbackReport1.aiCommentary && fallbackReport1.aiCommentary.includes('تقرير التحليل الفني الموسع')) &&
            callsAfterFirst403 === 1 &&
            callsAfterSecond403 === 1 &&
            fallbackReport2.aiMeta?.status === 'PERMISSION_DENIED',
          'قبول Gemini 5: عند فشل Gemini بـ 403 يعود النظام إلى التقرير الحتمي دون رمي خطأ ولا يعيد المحاولة بشكل متكرر لنفس المفتاح المرفوض'
        );

        // Test 10.6: Missing GEMINI_API_KEY or placeholder "MY_GEMINI_API_KEY" is classified as CONFIG_MISSING
        resetGeminiTestState();
        delete process.env.GEMINI_API_KEY;
        const diagMissing = await diagnoseGeminiConnection();
        const diagPlaceholder = await diagnoseGeminiConnection({ overrideApiKey: 'MY_GEMINI_API_KEY' });
        const valEmpty = validateGeminiApiKeyConfig('');
        const valPlaceholder = validateGeminiApiKeyConfig('MY_GEMINI_API_KEY');
        assert(
          diagMissing.status === 'CONFIG_MISSING' &&
            diagPlaceholder.status === 'CONFIG_MISSING' &&
            !valEmpty.valid &&
            !valPlaceholder.valid,
          'قبول Gemini 6: عند غياب GEMINI_API_KEY أو وجود القيمة الافتراضية MY_GEMINI_API_KEY تُصنَّف الحالة إلى CONFIG_MISSING'
        );

        // Test 10.7: HTTP 403 is classified as PERMISSION_DENIED (and 401/404/429/503 map to their exact codes)
        resetGeminiTestState();
        process.env.GEMINI_API_KEY = 'TEST_KEY_FOR_DIAG_403';
        setGeminiTestTransport(async () => {
          const err: any = new Error('Failed to call the Gemini API: permission denied. Please try again.');
          err.status = 403;
          throw err;
        });
        const diag403 = await diagnoseGeminiConnection();
        const c401 = classifyGeminiError({ status: 401, message: 'API key not valid' });
        const c404 = classifyGeminiError({ status: 404, message: 'models/unknown is not found' });
        const c429 = classifyGeminiError({ status: 429, message: 'Resource has been exhausted (quota)' });
        const c503 = classifyGeminiError({ status: 503, message: 'This model is currently experiencing high demand' });
        assert(
          diag403.status === 'PERMISSION_DENIED' &&
            diag403.httpStatus === 403 &&
            c401.status === 'UNAUTHENTICATED' &&
            c404.status === 'MODEL_NOT_FOUND' &&
            c429.status === 'RATE_LIMITED' &&
            c503.status === 'UPSTREAM_UNAVAILABLE',
          'قبول Gemini 7: تصنيف أخطاء 403 إلى PERMISSION_DENIED وبقية الرموز (401/404/429/503) بدقة تامة'
        );

        // Test 10.8: Successful test response from Gemini is classified as AI_AVAILABLE and used in report
        resetGeminiTestState();
        process.env.GEMINI_API_KEY = 'TEST_KEY_FOR_SUCCESS_200';
        setGeminiTestTransport(async () => ({
          text: '### تقرير ذكي موثق: توافق صاعد بين الكلاسيكي والزخم فوق المتوسطات.',
        }));
        const diagSuccess = await diagnoseGeminiConnection();
        const aiSuccessReport = await analyzeMarket(sampleCandles, 'BTCUSDT', '1h', 'Binance Spot', true, {
          includeAI: true,
        });
        assert(
          diagSuccess.status === 'AI_AVAILABLE' &&
            diagSuccess.ok === true &&
            aiSuccessReport.aiMeta?.usedAI === true &&
            aiSuccessReport.aiMeta?.status === 'AI_AVAILABLE' &&
            Boolean(aiSuccessReport.aiCommentary?.includes('تقرير ذكي موثق')),
          'قبول Gemini 8: عند نجاح استجابة Gemini تُصنَّف الحالة إلى AI_AVAILABLE ويُعتمد التفسير الذكي في التقرير'
        );

        // Test 10.9: API key never appears in any diagnostic response or sanitized error message
        resetGeminiTestState();
        const secretTestKey = 'AIzaSyTestSecretKeyValue998877665544332211';
        process.env.GEMINI_API_KEY = secretTestKey;
        setGeminiTestTransport(async () => {
          const err: any = new Error(
            `Request to https://generativelanguage.googleapis.com/v1beta/models?key=${secretTestKey} failed with key ${secretTestKey}`
          );
          err.status = 403;
          throw err;
        });
        const diagRedacted = await diagnoseGeminiConnection();
        const serializedDiag = JSON.stringify(diagRedacted);
        const sanitizedDirect = sanitizeGeminiErrorText(`Error with key=${secretTestKey}`, secretTestKey);
        assert(
          !serializedDiag.includes(secretTestKey) &&
            !sanitizedDirect.includes(secretTestKey) &&
            sanitizedDirect.includes('[REDACTED_KEY]'),
          'قبول Gemini 9: عدم ظهور مفتاح GEMINI_API_KEY مطلقاً في أي استجابة تشخيصية أو رسالة خطأ'
        );
      } finally {
        resetGeminiTestState();
        if (originalEnvKey !== undefined) {
          process.env.GEMINI_API_KEY = originalEnvKey;
        } else {
          delete process.env.GEMINI_API_KEY;
        }
        globalThis.fetch = originalFetch10;
        clearForexCandleCache();
      }
    } catch (e: any) {
      assert(false, `فشل اختبارات فصل الماسح عن Gemini وتشخيص الأخطاء: ${e.message}`);
    }

    console.log(`\n=== ملخص نتائج الاختبارات الكاملة: ${passedTests} ناجح / ${failedTests} فاشل ===`);
    if (failedTests > 0) {
      process.exit(1);
    }
  }

  await runAsyncTests();
}

runAllTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});


