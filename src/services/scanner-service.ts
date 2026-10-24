/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MarketSymbol,
  TimeFrame,
  MultiAssetOpportunity,
  ScannerDirectionBias,
  SUPPORTED_ASSETS,
} from '../types/market.ts';
import { fetchBinanceKlines, fetchBinance24hTicker } from './market/binance-adapter.ts';
import { GoldDataAdapter } from './market/gold-adapter.ts';
import { fetchForexMetalsKlines } from './market/forex-metals-adapter.ts';
import { getAllWatchedAssets, isCryptoPairSymbol } from './market/custom-assets.ts';
import { analyzeMarketDeterministic } from './market-analyst.ts';

/**
 * Scans all 15 supported assets plus any user custom watched assets for trading opportunities
 * across the 6 analytical schools using real market data.
 * Strictly deterministic — never invokes Gemini or any external LLM service.
 */
export async function scanMultiAssetOpportunities(
  timeframe: TimeFrame = '1h',
  onProgress?: (completed: number, total: number, currentSymbol: MarketSymbol) => void
): Promise<MultiAssetOpportunity[]> {
  const assets = getAllWatchedAssets();
  const results: MultiAssetOpportunity[] = [];

  for (let i = 0; i < assets.length; i++) {
    const config = assets[i];
    if (onProgress) {
      onProgress(i, assets.length, config.symbol);
    }

    try {
      if (config.symbol === 'XAUUSD') {
        // 1. Gold Spot (XAUUSD): check for imported CSV data or live PAXG proxy
        try {
          const goldData = await GoldDataAdapter.getGoldData(timeframe);
          const report = analyzeMarketDeterministic(
            goldData.candles,
            'XAUUSD',
            timeframe,
            goldData.dataSource,
            goldData.isLive
          );

          const lastCandle = goldData.candles[goldData.candles.length - 1];
          let changePercent = 0;

          if (goldData.isProxy) {
            try {
              const ticker24 = await fetchBinance24hTicker('PAXGUSDT');
              changePercent = ticker24.priceChangePercent;
            } catch {
              const prevCandle = goldData.candles[goldData.candles.length - 2] || lastCandle;
              changePercent = prevCandle.close > 0 ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100 : 0;
            }
          } else {
            const prevCandle = goldData.candles[goldData.candles.length - 2] || lastCandle;
            changePercent = prevCandle.close > 0 ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100 : 0;
          }

          const { bias, confluenceScore, dominantSchools } = deriveConfluence(report);

          results.push({
            symbol: 'XAUUSD',
            nameAr: config.nameAr,
            nameEn: config.nameEn,
            category: config.category,
            price: lastCandle.close,
            priceChangePercent24h: Number(changePercent.toFixed(2)),
            timeframe,
            bias,
            confluenceScore,
            dominantSchools,
            schoolsSummary: {
              classical: report.schools.classical.summary,
              priceAction: report.schools.priceAction.summary,
              harmonic: report.schools.harmonic.summary,
              elliott: report.schools.elliott.summary,
              numerical: report.schools.numerical.summary,
              astro: report.schools.astro.lunarPhase,
            },
            tradeSetup: report.tradeSetup.hasSetup
              ? {
                  hasSetup: true,
                  bias: report.tradeSetup.bias,
                  entryMin: report.tradeSetup.entryZone.min,
                  entryMax: report.tradeSetup.entryZone.max,
                  stopLoss: report.tradeSetup.stopLoss,
                  target1: report.tradeSetup.targets[0] || report.tradeSetup.entryZone.max,
                  riskRewardRatio: report.tradeSetup.riskRewardRatio,
                  reasoning: report.tradeSetup.reasoning,
                }
              : undefined,
            dataSource: goldData.dataSource,
            isLive: goldData.isLive,
            lastUpdated: new Date().toLocaleTimeString('ar-EG'),
            status: 'ready',
          });
        } catch (goldErr: any) {
          // If no gold data exists or CSV is required
          results.push({
            symbol: 'XAUUSD',
            nameAr: config.nameAr,
            nameEn: config.nameEn,
            category: config.category,
            price: 0,
            priceChangePercent24h: 0,
            timeframe,
            bias: 'حياد',
            confluenceScore: 0,
            dominantSchools: [],
            schoolsSummary: {
              classical: 'بانتظار استيراد ملف شموع الذهب CSV',
              priceAction: 'غير متوفر',
              harmonic: 'غير متوفر',
              elliott: 'غير متوفر',
              numerical: 'غير متوفر',
              astro: 'غير متوفر',
            },
            dataSource: 'يتطلب استيراد ملف CSV من MT4/MT5/TradingView',
            isLive: false,
            lastUpdated: 'غير متاح',
            status: 'requires_import',
            errorMessage: goldErr.message || 'يرجى استيراد ملف CSV لفحص فرص الذهب XAUUSD',
          });
        }
      } else if (!isCryptoPairSymbol(config.symbol)) {
        // 2. Silver (XAGUSD), Forex Majors & Crosses, Global Stocks (NVDA, AAPL), Commodities (OIL), and Indices (NAS100, SPX)
        await new Promise((r) => setTimeout(r, 60));

        try {
          let effectiveTf: TimeFrame = timeframe;
          let candleResult;
          try {
            candleResult = await fetchForexMetalsKlines(config.symbol, timeframe, 150);
          } catch (tfErr: any) {
            if ((tfErr?.code === 'TIMEFRAME_UNSUPPORTED' || tfErr?.timeframeUnsupported) && timeframe !== '1d') {
              effectiveTf = '1d';
              candleResult = await fetchForexMetalsKlines(config.symbol, '1d', 150);
            } else {
              throw tfErr;
            }
          }
          const last = candleResult.candles[candleResult.candles.length - 1];
          const first = candleResult.candles[0];
          const ticker24hChange = first && first.close > 0 ? ((last.close - first.close) / first.close) * 100 : 0;

          const report = analyzeMarketDeterministic(
            candleResult.candles,
            config.symbol,
            effectiveTf,
            candleResult.dataSource,
            candleResult.isLive
          );

          const { bias, confluenceScore, dominantSchools } = deriveConfluence(report);

          results.push({
            symbol: config.symbol,
            nameAr: config.nameAr,
            nameEn: config.nameEn,
            category: config.category,
            price: report.currentPrice,
            priceChangePercent24h: Number(ticker24hChange.toFixed(2)),
            timeframe,
            bias,
            confluenceScore,
            dominantSchools,
            schoolsSummary: {
              classical: report.schools.classical.summary,
              priceAction: report.schools.priceAction.summary,
              harmonic: report.schools.harmonic.summary,
              elliott: report.schools.elliott.summary,
              numerical: report.schools.numerical.summary,
              astro: report.schools.astro.lunarPhase,
            },
            tradeSetup: report.tradeSetup.hasSetup
              ? {
                  hasSetup: true,
                  bias: report.tradeSetup.bias,
                  entryMin: report.tradeSetup.entryZone.min,
                  entryMax: report.tradeSetup.entryZone.max,
                  stopLoss: report.tradeSetup.stopLoss,
                  target1: report.tradeSetup.targets[0] || report.tradeSetup.entryZone.max,
                  riskRewardRatio: report.tradeSetup.riskRewardRatio,
                  reasoning: report.tradeSetup.reasoning,
                }
              : undefined,
            dataSource: candleResult.dataSource,
            isLive: candleResult.isLive,
            lastUpdated: new Date().toLocaleTimeString('ar-EG'),
            status: 'ready',
          });
        } catch (forexErr: any) {
          results.push({
            symbol: config.symbol,
            nameAr: config.nameAr,
            nameEn: config.nameEn,
            category: config.category,
            price: 0,
            priceChangePercent24h: 0,
            timeframe,
            bias: 'حياد',
            confluenceScore: 0,
            dominantSchools: [],
            schoolsSummary: {
              classical: 'تعذر جلب الشموع الحقيقية',
              priceAction: 'غير متوفر',
              harmonic: 'غير متوفر',
              elliott: 'غير متوفر',
              numerical: 'غير متوفر',
              astro: 'غير متوفر',
            },
            dataSource: 'مزود السوق الحقيقي (غير متاح حالياً / السوق مغلق)',
            isLive: false,
            lastUpdated: 'تعذر التحديث',
            status: 'error',
            errorMessage: forexErr.message || 'فشل جلب بيانات الشموع الحقيقية',
          });
        }
      } else {
        // 3. Crypto Majors (BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, PAXGUSDT)
        await new Promise((r) => setTimeout(r, 60));

        try {
          const candleResult = await fetchBinanceKlines(config.symbol, timeframe, 150);
          const last = candleResult.candles[candleResult.candles.length - 1];

          // Use real 24h ticker for accurate price change percent
          let change24h = 0;
          try {
            const ticker = await fetchBinance24hTicker(config.symbol);
            change24h = ticker.priceChangePercent;
          } catch {
            const first = candleResult.candles[0];
            change24h = first && first.close > 0 ? ((last.close - first.close) / first.close) * 100 : 0;
          }

          const report = analyzeMarketDeterministic(
            candleResult.candles,
            config.symbol,
            timeframe,
            candleResult.dataSource,
            candleResult.isLive
          );

          const { bias, confluenceScore, dominantSchools } = deriveConfluence(report);

          results.push({
            symbol: config.symbol,
            nameAr: config.nameAr,
            nameEn: config.nameEn,
            category: config.category,
            price: report.currentPrice,
            priceChangePercent24h: Number(change24h.toFixed(2)),
            timeframe,
            bias,
            confluenceScore,
            dominantSchools,
            schoolsSummary: {
              classical: report.schools.classical.summary,
              priceAction: report.schools.priceAction.summary,
              harmonic: report.schools.harmonic.summary,
              elliott: report.schools.elliott.summary,
              numerical: report.schools.numerical.summary,
              astro: report.schools.astro.lunarPhase,
            },
            tradeSetup: report.tradeSetup.hasSetup
              ? {
                  hasSetup: true,
                  bias: report.tradeSetup.bias,
                  entryMin: report.tradeSetup.entryZone.min,
                  entryMax: report.tradeSetup.entryZone.max,
                  stopLoss: report.tradeSetup.stopLoss,
                  target1: report.tradeSetup.targets[0] || report.tradeSetup.entryZone.max,
                  riskRewardRatio: report.tradeSetup.riskRewardRatio,
                  reasoning: report.tradeSetup.reasoning,
                }
              : undefined,
            dataSource: candleResult.dataSource,
            isLive: candleResult.isLive,
            lastUpdated: new Date().toLocaleTimeString('ar-EG'),
            status: 'ready',
          });
        } catch (cryptoErr: any) {
          results.push({
            symbol: config.symbol,
            nameAr: config.nameAr,
            nameEn: config.nameEn,
            category: config.category,
            price: 0,
            priceChangePercent24h: 0,
            timeframe,
            bias: 'حياد',
            confluenceScore: 0,
            dominantSchools: [],
            schoolsSummary: {
              classical: 'تعذر جلب الشموع من Binance',
              priceAction: 'غير متوفر',
              harmonic: 'غير متوفر',
              elliott: 'غير متوفر',
              numerical: 'غير متوفر',
              astro: 'غير متوفر',
            },
            dataSource: 'Binance Spot REST API (خطأ اتصال)',
            isLive: false,
            lastUpdated: 'تعذر التحديث',
            status: 'error',
            errorMessage: cryptoErr.message || 'تعذر جلب شموع العملة الرقمية من Binance',
          });
        }
      }
    } catch (err: any) {
      console.error(`[ScannerService] Unexpected scan error for ${config.symbol}:`, err);
      results.push({
        symbol: config.symbol,
        nameAr: config.nameAr,
        nameEn: config.nameEn,
        category: config.category,
        price: 0,
        priceChangePercent24h: 0,
        timeframe,
        bias: 'حياد',
        confluenceScore: 0,
        dominantSchools: [],
        schoolsSummary: {
          classical: 'خطأ أثناء المعالجة',
          priceAction: 'خطأ',
          harmonic: 'خطأ',
          elliott: 'خطأ',
          numerical: 'خطأ',
          astro: 'خطأ',
        },
        dataSource: 'خطأ في معالجة الأصل',
        isLive: false,
        lastUpdated: 'تعذر التحديث',
        status: 'error',
        errorMessage: err.message || 'تعذر جلب البيانات',
      });
    }
  }

  if (onProgress) {
    onProgress(assets.length, assets.length, assets[assets.length - 1].symbol);
  }

  // Sort by confluence score descending by default
  return results.sort((a, b) => b.confluenceScore - a.confluenceScore);
}

/**
 * Calculates quantitative confluence and bias across the schools
 */
function deriveConfluence(report: any): {
  bias: ScannerDirectionBias;
  confluenceScore: number;
  dominantSchools: string[];
} {
  const { indicators, schools, tradeSetup } = report;
  let bullishPoints = 0;
  let bearishPoints = 0;
  const dominantSchools: string[] = [];

  // EMA trend stack
  if (indicators.ema.ema20 && indicators.ema.ema50) {
    if (indicators.ema.ema20 > indicators.ema.ema50) {
      bullishPoints += 15;
      dominantSchools.push('المتوسطات المتحركة EMA');
    } else {
      bearishPoints += 15;
      dominantSchools.push('المتوسطات المتحركة EMA');
    }
  }

  // RSI Momentum
  if (indicators.rsi.value) {
    if (indicators.rsi.value > 52 && indicators.rsi.value < 70) {
      bullishPoints += 15;
      dominantSchools.push('الزخم النسبي RSI');
    } else if (indicators.rsi.value < 48 && indicators.rsi.value > 30) {
      bearishPoints += 15;
      dominantSchools.push('الزخم النسبي RSI');
    }
  }

  // MACD
  if (indicators.macd.trend === 'bullish') {
    bullishPoints += 15;
    dominantSchools.push('MACD');
  } else if (indicators.macd.trend === 'bearish') {
    bearishPoints += 15;
    dominantSchools.push('MACD');
  }

  // Classical
  if (schools.classical.trend === 'صاعد') {
    bullishPoints += 20;
    dominantSchools.push('المدرسة الكلاسيكية');
  } else if (schools.classical.trend === 'هابط') {
    bearishPoints += 20;
    dominantSchools.push('المدرسة الكلاسيكية');
  }

  // Price Action
  if (schools.priceAction.marketStructure.includes('صاعد')) {
    bullishPoints += 20;
    dominantSchools.push('السلوك السعري (Price Action)');
  } else if (schools.priceAction.marketStructure.includes('هابط')) {
    bearishPoints += 20;
    dominantSchools.push('السلوك السعري (Price Action)');
  }

  // Trade Setup Boost
  if (tradeSetup.hasSetup) {
    if (tradeSetup.bias === 'شراء') bullishPoints += 15;
    else if (tradeSetup.bias === 'بيع') bearishPoints += 15;
  }

  const maxPoints = Math.max(bullishPoints, bearishPoints);
  const confluenceScore = Math.min(100, Math.round(maxPoints));

  let bias: ScannerDirectionBias = 'حياد';
  if (bullishPoints >= 70 && bullishPoints > bearishPoints + 30) {
    bias = 'شراء قوي';
  } else if (bullishPoints >= 50 && bullishPoints > bearishPoints + 15) {
    bias = 'شراء';
  } else if (bearishPoints >= 70 && bearishPoints > bullishPoints + 30) {
    bias = 'بيع قوي';
  } else if (bearishPoints >= 50 && bearishPoints > bullishPoints + 15) {
    bias = 'بيع';
  } else {
    bias = 'حياد';
  }

  return {
    bias,
    confluenceScore,
    dominantSchools: Array.from(new Set(dominantSchools)),
  };
}
