/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { fetchBinanceKlines } from './src/services/market/binance-adapter.ts';
import { GoldDataAdapter, parseGoldCSV } from './src/services/market/gold-adapter.ts';
import { analyzeMarket } from './src/services/market-analyst.ts';
import { diagnoseGeminiConnection } from './src/services/ai-synthesizer.ts';
import { runBacktest } from './src/services/backtesting/backtest-engine.ts';
import {
  type TimeFrame,
  type MarketSymbol,
  SUPPORTED_ASSETS,
  type SymbolSearchResult,
  type AssetCategory,
} from './src/types/market.ts';

import { generateMacroAnalysisReport } from './src/services/macro-service.ts';

import {
  fetchForexMetalsKlines,
  fetchForexMetalsPrice,
  YAHOO_SYMBOL_MAP,
  resolveYahooTicker,
} from './src/services/market/forex-metals-adapter.ts';
import {
  inferAssetMetadata,
  isCryptoPairSymbol,
  isForexPairSymbol,
  isEgxStockSymbol,
  isKnownUsStock,
  normalizeDisplaySymbol,
  EGX_STOCKS_DIRECTORY,
} from './src/services/market/custom-assets.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));

// 0. Universal Smart Symbol Search Endpoint (Crypto on Binance + US/Global/EGX Stocks, Forex, Indices, Commodities on Yahoo Finance)
app.get('/api/market/search', async (req, res) => {
  try {
    const rawQuery = ((req.query.q as string) || '').trim();
    if (!rawQuery) {
      return res.json({ success: true, results: [] });
    }

    const cleanQuery = rawQuery.toUpperCase().replace(/[^A-Z0-9^=.-]/g, '');
    const baseClean = normalizeDisplaySymbol(cleanQuery);
    const results: SymbolSearchResult[] = [];
    const seenSymbols = new Set<string>();

    const pushResult = (item: SymbolSearchResult) => {
      const canonicalKey = normalizeDisplaySymbol(item.symbol);
      if (!seenSymbols.has(canonicalKey)) {
        seenSymbols.add(canonicalKey);
        results.push({
          ...item,
          symbol: canonicalKey,
        });
      }
    };

    // 1) Check Egyptian Exchange (EGX) built-in directory first so EGX stocks like AMII, COMI, FWRY appear at the top
    for (const [egxCode, egxInfo] of Object.entries(EGX_STOCKS_DIRECTORY)) {
      if (
        egxCode.includes(baseClean) ||
        egxInfo.nameAr.includes(rawQuery) ||
        egxInfo.nameEn.toUpperCase().includes(baseClean)
      ) {
        pushResult({
          symbol: egxCode,
          providerSymbol: `${egxCode}.CA`,
          nameAr: egxInfo.nameAr,
          nameEn: egxInfo.nameEn,
          category: 'stock',
          market: 'EGX',
          currency: 'EGP',
          provider: 'yahoo',
          decimals: 2,
          exchange: 'البورصة المصرية (EGX)',
        });
      }
    }

    // 2) Check built-in SUPPORTED_ASSETS matches
    for (const asset of SUPPORTED_ASSETS) {
      if (
        asset.symbol.includes(cleanQuery) ||
        asset.nameAr.includes(rawQuery) ||
        asset.nameEn.toUpperCase().includes(cleanQuery)
      ) {
        pushResult({
          symbol: asset.symbol,
          providerSymbol: asset.providerSymbol || asset.symbol,
          nameAr: asset.nameAr,
          nameEn: asset.nameEn,
          category: asset.category,
          market:
            asset.category === 'crypto' || asset.category === 'proxy'
              ? 'CRYPTO'
              : asset.category === 'forex'
              ? 'FOREX'
              : 'COMMODITIES',
          currency: asset.symbol.endsWith('USDT') ? 'USDT' : 'USD',
          provider: asset.category === 'crypto' || asset.category === 'proxy' ? 'binance' : 'yahoo',
          decimals: asset.decimals,
        });
      }
    }

    // 3) Parallel check: Binance Spot Ticker (only if not an EGX stock or Forex pair) + Yahoo Finance Search API (rawQuery + .CA)
    const isExplicitEgx = cleanQuery.endsWith('.CA') || isEgxStockSymbol(cleanQuery);
    const binanceCandidate = isCryptoPairSymbol(cleanQuery)
      ? cleanQuery
      : !isExplicitEgx &&
        !isKnownUsStock(cleanQuery) &&
        /^[A-Z0-9]{2,8}$/.test(cleanQuery) &&
        !isForexPairSymbol(cleanQuery)
      ? `${cleanQuery}USDT`
      : null;

    const binancePromise = (async () => {
      if (!binanceCandidate) return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      try {
        const bRes = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${binanceCandidate}`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (bRes.ok) {
          const data: any = await bRes.json();
          const price = parseFloat(data.price);
          if (price > 0) {
            const meta = inferAssetMetadata(binanceCandidate, price);
            pushResult({
              symbol: binanceCandidate,
              providerSymbol: binanceCandidate,
              nameAr: meta.nameAr,
              nameEn: meta.nameEn,
              category: 'crypto',
              market: 'CRYPTO',
              currency: 'USDT',
              provider: 'binance',
              decimals: meta.decimals,
              price,
              exchange: 'Binance Spot',
            });
          }
        }
      } catch {
        clearTimeout(timeout);
      }
    })();

    const parseYahooQuotes = (quotes: any[]) => {
      for (const q of quotes) {
        if (!q || !q.symbol) continue;
        const rawSym = String(q.symbol).toUpperCase();
        const qType = String(q.quoteType || '').toUpperCase();
        const exch = String(q.exchange || q.exchDisp || '').toUpperCase();
        const shortName = String(q.shortname || q.longname || rawSym);

        if (rawSym.endsWith('.CA') || exch === 'CAI' || exch.includes('EGX')) {
          const egxBase = normalizeDisplaySymbol(rawSym);
          const egxMeta = inferAssetMetadata(`${egxBase}.CA`);
          pushResult({
            symbol: egxBase,
            providerSymbol: `${egxBase}.CA`,
            nameAr:
              egxMeta.nameAr !== `سهم ${egxBase} (البورصة المصرية)`
                ? egxMeta.nameAr
                : `${shortName} (${egxBase} - البورصة المصرية)`,
            nameEn: shortName,
            category: 'stock',
            market: 'EGX',
            currency: 'EGP',
            provider: 'yahoo',
            decimals: 2,
            exchange: 'البورصة المصرية (EGX)',
          });
          continue;
        }

        let displaySym = rawSym;
        let providerSymbol = rawSym;
        let category: AssetCategory = 'stock';
        let market = 'US';
        let currency = 'USD';
        let decimals = 2;
        let nameAr = `سهم ${shortName}`;

        if (rawSym.endsWith('=X') || qType === 'CURRENCY') {
          displaySym = rawSym.replace('=X', '');
          providerSymbol = `${displaySym}=X`;
          if (displaySym.length === 6) {
            const base = displaySym.slice(0, 3);
            const quote = displaySym.slice(3, 6);
            category = 'forex';
            market = 'FOREX';
            currency = quote;
            decimals = quote === 'JPY' ? 3 : 5;
            nameAr = `زوج ${base}/${quote} (${shortName})`;
          }
        } else if (rawSym.endsWith('=F') || qType === 'FUTURE') {
          category = 'commodity';
          market = 'COMMODITIES';
          decimals = 2;
          nameAr = `عقود ${shortName}`;
        } else if (rawSym.startsWith('^') || qType === 'INDEX') {
          category = 'index';
          market = 'GLOBAL_INDEX';
          decimals = 2;
          nameAr = `مؤشر ${shortName}`;
        } else if (qType === 'CRYPTOCURRENCY') {
          const base = rawSym.replace('-USD', '');
          displaySym = `${base}USDT`;
          providerSymbol = displaySym;
          category = 'crypto';
          market = 'CRYPTO';
          currency = 'USDT';
          decimals = 4;
          nameAr = `عملة ${shortName}`;
        } else {
          category = 'stock';
          market = 'US';
          currency = 'USD';
          decimals = 2;
          const knownMeta = inferAssetMetadata(displaySym);
          nameAr =
            knownMeta.nameAr !== `سهم ${displaySym}`
              ? knownMeta.nameAr
              : `${shortName} (${displaySym})`;
        }

        pushResult({
          symbol: displaySym,
          providerSymbol,
          nameAr,
          nameEn: shortName,
          category,
          market,
          currency,
          provider: category === 'crypto' ? 'binance' : 'yahoo',
          decimals,
          exchange: q.exchDisp || q.exchange || 'Global Market',
        });
      }
    };

    const yahooQueries = [rawQuery];
    if (/^[A-Z]{3,5}$/.test(baseClean) && !isKnownUsStock(baseClean) && !isForexPairSymbol(baseClean)) {
      yahooQueries.push(`${baseClean}.CA`);
    }

    const yahooPromise = Promise.allSettled(
      yahooQueries.map(async (qStr) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
          const yUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
            qStr
          )}&quotesCount=6&newsCount=0`;
          const yRes = await fetch(yUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          });
          clearTimeout(timeout);
          if (yRes.ok) {
            const data: any = await yRes.json();
            const quotes = Array.isArray(data.quotes) ? data.quotes : [];
            parseYahooQuotes(quotes);
          }
        } catch {
          clearTimeout(timeout);
        }
      })
    );

    await Promise.allSettled([binancePromise, yahooPromise]);

    // 4) If user typed a direct symbol or alias not yet in results, infer and include it
    if (baseClean.length >= 2 && !seenSymbols.has(baseClean)) {
      const meta = inferAssetMetadata(cleanQuery);
      pushResult({
        symbol: meta.symbol,
        providerSymbol: meta.providerSymbol || resolveYahooTicker(meta.symbol),
        nameAr: meta.nameAr,
        nameEn: meta.nameEn,
        category: meta.category,
        market: meta.market,
        currency: meta.currency,
        provider: meta.provider === 'binance' ? 'binance' : 'yahoo',
        decimals: meta.decimals,
      });
    }

    return res.json({ success: true, results: results.slice(0, 12) });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'فشل البحث عن الرمز المالي',
      results: [],
    });
  }
});

// 1. Unified Multi-Asset Candles endpoint (Forex Majors & Crosses, Gold, Silver, US & EGX Stocks, Indices, Crypto)
app.get('/api/market/candles', async (req, res) => {
  try {
    const rawSymbol = ((req.query.symbol as string) || 'BTCUSDT').trim().toUpperCase();
    const symbol = normalizeDisplaySymbol(rawSymbol) as MarketSymbol;
    const timeframe = (req.query.timeframe as TimeFrame) || '1h';
    const limit = parseInt(req.query.limit as string, 10) || 200;

    if (symbol === 'XAUUSD') {
      const data = await GoldDataAdapter.getGoldData(timeframe);
      return res.json({ success: true, ...data });
    }

    // 1) If symbol is a Crypto pair (ends with USDT, BTC, BUSD, USDC, FDUSD), route to Binance
    if (isCryptoPairSymbol(symbol)) {
      const data = await fetchBinanceKlines(symbol, timeframe, limit);
      return res.json({ success: true, ...data });
    }

    // 2) For Stocks (US & EGX like NVDA, AAPL, AMII, COMI), Forex Pairs (EURUSD, GBPJPY), Commodities (XAGUSD, OIL), or Indices (NAS100, SPX)
    try {
      const data = await fetchForexMetalsKlines(rawSymbol as MarketSymbol, timeframe, limit);
      let priceChangePercent24h = 0;
      if (data.candles.length >= 2) {
        const last = data.candles[data.candles.length - 1];
        const first = data.candles[0];
        priceChangePercent24h =
          first && first.close > 0
            ? Number((((last.close - first.close) / first.close) * 100).toFixed(2))
            : 0;
      }
      return res.json({
        success: true,
        symbol,
        ...data,
        priceChangePercent24h,
      });
    } catch (yahooErr: any) {
      if (yahooErr?.code === 'TIMEFRAME_UNSUPPORTED') {
        return res.status(200).json({
          success: false,
          timeframeUnsupported: true,
          suggestedTimeframe: yahooErr.suggestedTimeframe || '1d',
          symbol,
          providerSymbol: resolveYahooTicker(rawSymbol),
          error: yahooErr.message,
        });
      }
      throw yahooErr;
    }
  } catch (err: any) {
    console.error('API /api/market/candles error:', err.message);
    res.status(502).json({
      success: false,
      error: err.message || 'فشل جلب شموع الأصل من مزود البيانات. تأكد من صحة الرمز المكتوب.',
    });
  }
});

// 1.5 Forex, Metals, Stocks & Indices Ticker endpoint for scanner and alerts (avoids browser CORS)
app.get('/api/market/forex-ticker', async (req, res) => {
  try {
    const symbol = ((req.query.symbol as string) || 'EURUSD').trim().toUpperCase() as MarketSymbol;
    const ticker = await fetchForexMetalsPrice(symbol);
    res.json({ success: true, symbol, ...ticker });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'فشل جلب سعر الأصل' });
  }
});

// 1.1 Legacy Bitcoin Candles endpoint (Binance REST API)
app.get('/api/market/btc', async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as TimeFrame) || '1h';
    const limit = parseInt(req.query.limit as string, 10) || 200;

    const data = await fetchBinanceKlines('BTCUSDT', timeframe, limit);
    res.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    console.error('API /api/market/btc error:', err);
    res.status(502).json({
      success: false,
      error: err.message || 'فشل جلب بيانات البيتكوين من مزود السوق',
    });
  }
});

// 2. Gold Candles endpoint (Gold Data Adapter / Imported CSV / PAXG proxy)
app.get('/api/market/gold', async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as TimeFrame) || '1h';
    const data = await GoldDataAdapter.getGoldData(timeframe);
    res.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    console.warn('API /api/market/gold note:', err.message);
    res.status(200).json({
      success: false,
      error: err.message || 'بيانات الذهب المباشرة غير متاحة، يرجى استيراد ملف CSV',
      requiresImport: true,
    });
  }
});

// 2.2 Macroeconomic Report & Calendar endpoint (Axis 3)
app.get('/api/macro/report', (req, res) => {
  try {
    const symbol = (req.query.symbol as MarketSymbol) || 'BTCUSDT';
    const report = generateMacroAnalysisReport(symbol);
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'فشل توليد تقرير الاقتصاد الكلي' });
  }
});

// 2.5 Quick Live Price Ticker endpoint for Price Alerts (Universal Crypto, Forex, Stocks, Indices, Commodities)
app.get('/api/market/price', async (req, res) => {
  try {
    const symbol = ((req.query.symbol as string) || 'BTCUSDT').trim().toUpperCase();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    if (symbol === 'XAUUSD') {
      if (GoldDataAdapter.hasValidData()) {
        clearTimeout(timeout);
        const { candles } = GoldDataAdapter.getImportedData();
        const last = candles[candles.length - 1];
        return res.json({
          success: true,
          symbol: 'XAUUSD',
          price: last ? last.close : 0,
          time: last ? last.time : Date.now(),
          isImported: true,
        });
      }

      // PAXG Spot feed as physical gold proxy
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT', {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) {
        const json: any = await response.json();
        return res.json({
          success: true,
          symbol: 'XAUUSD',
          price: parseFloat(json.price),
          time: Date.now(),
          isProxy: true,
        });
      }
    } else if (isCryptoPairSymbol(symbol)) {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) {
        const json: any = await response.json();
        return res.json({
          success: true,
          symbol,
          price: parseFloat(json.price),
          time: Date.now(),
        });
      }
    } else {
      clearTimeout(timeout);
      const resData = await fetchForexMetalsPrice(symbol as MarketSymbol);
      if (resData.price > 0) {
        return res.json({
          success: true,
          symbol,
          price: resData.price,
          time: Date.now(),
          isLive: resData.isLive,
        });
      }
    }

    clearTimeout(timeout);
    res.status(404).json({ success: false, error: 'رمز الأصل غير مدعوم أو غير متاح في المزود' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'فشل جلب سعر الأصل اللحظي' });
  }
});

// 3. Gold CSV Import & Integrity Audit endpoint
app.post('/api/market/gold/import', (req, res) => {
  try {
    const { csvText, fileName } = req.body;
    if (!csvText || typeof csvText !== 'string') {
      res.status(400).json({ success: false, error: 'محتوى ملف CSV غير موجود أو فارغ' });
      return;
    }

    const audit = parseGoldCSV(csvText);
    if (!audit.success) {
      res.status(422).json({
        success: false,
        error: audit.errors[0] || 'فشل التحقق من صحة ملف CSV',
        audit,
      });
      return;
    }

    // Save validated candles in GoldDataAdapter
    GoldDataAdapter.setImportedData(audit.candles, fileName || 'ملف مستورد', audit.detectedFormat);

    res.json({
      success: true,
      message: `تم استيراد ${audit.validRows} شمعة بنجاح من تنسيق ${audit.detectedFormat}`,
      audit,
      candles: audit.candles,
    });
  } catch (err: any) {
    console.error('API /api/market/gold/import error:', err);
    res.status(500).json({ success: false, error: err.message || 'خطأ داخلي أثناء معالجة ملف CSV' });
  }
});

// 4. Quantitative Analysis & Optional Server-Side AI Synthesis endpoint
app.post('/api/technical/analyze', async (req, res) => {
  try {
    const { candles, symbol, timeframe, dataSource, isLive, includeAI } = req.body;
    if (!Array.isArray(candles) || candles.length < 15) {
      res.status(400).json({ success: false, error: 'البيانات المرسلة غير كافية أو تالفة لإجراء التحليل' });
      return;
    }

    const report = await analyzeMarket(
      candles,
      symbol as MarketSymbol,
      timeframe as TimeFrame,
      dataSource || 'غير محدد',
      Boolean(isLive),
      { includeAI: includeAI !== false }
    );

    res.json({
      success: true,
      report,
      aiMeta: report.aiMeta,
    });
  } catch (err: any) {
    console.error('API /api/technical/analyze error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'حدث خطأ أثناء إجراء التحليل الفني متعدد المدارس',
    });
  }
});

// 4b. Safe Manual Server-Side Gemini Diagnostic Endpoint (never exposes API key)
const handleGeminiDiagnostics = async (_req: express.Request, res: express.Response) => {
  try {
    const diagnostic = await diagnoseGeminiConnection();
    res.json({
      success: true,
      diagnostic,
    });
  } catch {
    res.status(500).json({
      success: false,
      diagnostic: {
        status: 'UPSTREAM_UNAVAILABLE',
        ok: false,
        model: 'gemini-3.8-flash',
        messageAr:
          'التحليل الفني يعمل، لكن خدمة التفسير الذكي غير متاحة حاليًا. تحقق من صلاحيات Gemini API أو إعداد مفتاح الخدمة.',
        technicalReason: 'Unexpected error while running server-side Gemini diagnostic check.',
        checkedAt: new Date().toISOString(),
      },
    });
  }
};

app.get('/api/ai/diagnostics', handleGeminiDiagnostics);
app.post('/api/ai/diagnostics', handleGeminiDiagnostics);

// 5. Historical Backtesting endpoint
app.post('/api/technical/backtest', (req, res) => {
  try {
    const { candles, strategy, inSampleRatio, riskRewardTarget, slippageAndCommissionPercent } = req.body;
    if (!Array.isArray(candles) || candles.length < 50) {
      res.status(400).json({
        success: false,
        error: 'يتطلب الاختبار التاريخي 50 شمعة على الأقل لتقسيم العينة ومحاكاة الاستراتيجية',
      });
      return;
    }

    const result = runBacktest(candles, {
      strategy: strategy || 'EMA_Cross_Trend',
      inSampleRatio: inSampleRatio ?? 0.70,
      riskRewardTarget: riskRewardTarget ?? 2.0,
      slippageAndCommissionPercent: slippageAndCommissionPercent ?? 0.05,
    });

    res.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error('API /api/technical/backtest error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'حدث خطأ أثناء تنفيذ الاختبار التاريخي',
    });
  }
});

// 6. Live Macroeconomic Indicators & Verified Sources endpoint
let macroCache: { data: any; timestamp: number } | null = null;
const MACRO_CACHE_TTL = 60 * 1000; // 60 seconds cache

app.get('/api/macro/live', async (_req, res) => {
  try {
    const now = Date.now();
    if (macroCache && now - macroCache.timestamp < MACRO_CACHE_TTL) {
      return res.json({ success: true, ...macroCache.data, cached: true });
    }

    // Default institutional benchmarks
    let dxyPrice = 104.20;
    let us10yYield = 4.32;
    let fearGreedValue = 73;
    let fearGreedClassification = 'طمع (Greed)';
    let goldPrice = 2650;
    let silverPrice = 31.80;

    // Fetch live Fear & Greed
    try {
      const fngRes = await fetch('https://api.alternative.me/fng/?limit=1');
      if (fngRes.ok) {
        const fngJson: any = await fngRes.json();
        const fngItem = fngJson?.data?.[0];
        if (fngItem && fngItem.value) {
          fearGreedValue = parseInt(fngItem.value, 10);
          fearGreedClassification =
            fearGreedValue >= 75
              ? 'طمع شديد (Extreme Greed)'
              : fearGreedValue >= 55
              ? 'طمع (Greed)'
              : fearGreedValue >= 45
              ? 'حيادي (Neutral)'
              : fearGreedValue >= 25
              ? 'خوف (Fear)'
              : 'خوف شديد (Extreme Fear)';
        }
      }
    } catch {
      // Keep benchmark
    }

    // Fetch live DXY & US 10Y Yield from market feeds
    try {
      const dxyRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=5d', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (dxyRes.ok) {
        const dxyData: any = await dxyRes.json();
        const price = dxyData?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof price === 'number' && price > 70 && price < 150) {
          dxyPrice = parseFloat(price.toFixed(2));
        }
      }
    } catch {
      // Keep benchmark
    }

    try {
      const t10Res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=5d', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (t10Res.ok) {
        const t10Data: any = await t10Res.json();
        const yieldVal = t10Data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof yieldVal === 'number' && yieldVal > 1 && yieldVal < 10) {
          us10yYield = parseFloat(yieldVal.toFixed(2));
        }
      }
    } catch {
      // Keep benchmark
    }

    // Live Gold & Silver calculation
    try {
      const paxgRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
      if (paxgRes.ok) {
        const pJson: any = await paxgRes.json();
        goldPrice = parseFloat(pJson.price);
      }

      const slvData = await fetchForexMetalsPrice('XAGUSD');
      if (slvData.isLive && slvData.price > 10) {
        silverPrice = slvData.price;
      }
    } catch {
      // Keep benchmark
    }

    const liveGSR = parseFloat((goldPrice / silverPrice).toFixed(2));

    const responsePayload = {
      isLive: true,
      lastUpdated: new Date().toISOString(),
      liveMetrics: {
        dxyPrice,
        us10yYield,
        fearGreedValue,
        fearGreedClassification,
        goldPrice,
        silverPrice,
        goldSilverRatio: liveGSR,
      },
    };

    macroCache = { data: responsePayload, timestamp: now };
    res.json({ success: true, ...responsePayload, cached: false });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'فشل جلب المؤشرات الكلية الحية' });
  }
});

// Mount Vite or serve static
async function startServer() {
  const httpServer = http.createServer(app);
  const distPath = path.resolve('dist');
  const distIndex = path.join(distPath, 'index.html');
  const isProductionRuntime =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    Boolean(process.env.K_SERVICE);

  if (isProductionRuntime && fs.existsSync(distIndex)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Advanced Market Analyst] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
