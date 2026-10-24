/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MarketSymbol, TimeFrame, Candle, TechnicalReport, TradeSetup } from './types/market.ts';
import { Navbar } from './components/Navbar.tsx';
import { DataStatusBar } from './components/DataStatusBar.tsx';
import { CandlestickChart } from './components/CandlestickChart.tsx';
import { SchoolsMatrix } from './components/SchoolsMatrix.tsx';
import { ConfluenceScanner } from './components/ConfluenceScanner.tsx';
import { MultiAssetScanner } from './components/MultiAssetScanner.tsx';
import { MacroPanel } from './components/MacroPanel.tsx';
import { TradingReportView } from './components/TradingReportView.tsx';
import { BacktestPanel } from './components/BacktestPanel.tsx';
import { CSVImportModal } from './components/CSVImportModal.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { PriceAlertsModal, PriceAlertToast } from './components/PriceAlertsModal.tsx';
import { RiskCalculatorModal } from './components/RiskCalculatorModal.tsx';
import { AndroidApkModal } from './components/AndroidApkModal.tsx';
import { AlertSettingsModal } from './components/AlertSettingsModal.tsx';
import { loadAlertSettings, dispatchReportAlerts } from './services/alert-dispatcher.ts';
import { usePriceAlerts } from './hooks/usePriceAlerts.ts';
import { fetchBinanceKlines } from './services/market/binance-adapter.ts';
import { GoldDataAdapter } from './services/market/gold-adapter.ts';
import { fetchForexMetalsKlines, fetchForexMetalsPrice } from './services/market/forex-metals-adapter.ts';
import { isCryptoPairSymbol, normalizeDisplaySymbol } from './services/market/custom-assets.ts';
import { analyzeMarket, analyzeMarketDeterministic } from './services/market-analyst.ts';
import { AlertTriangle, UploadCloud, RefreshCw, Info } from 'lucide-react';
import { AppViewMode } from './components/Navbar.tsx';

export default function App() {
  const [symbol, setSymbol] = useState<MarketSymbol>('BTCUSDT');
  const [timeframe, setTimeframe] = useState<TimeFrame>('1h');
  const [activeView, setActiveView] = useState<AppViewMode>('chart_and_schools');

  const [candles, setCandles] = useState<Candle[]>([]);
  const [dataSource, setDataSource] = useState<string>('');
  const [isLive, setIsLive] = useState<boolean>(true);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [report, setReport] = useState<TechnicalReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [requiresGoldImport, setRequiresGoldImport] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState<boolean>(false);
  const [isAlertSettingsOpen, setIsAlertSettingsOpen] = useState<boolean>(false);
  const [isRiskCalcOpen, setIsRiskCalcOpen] = useState<boolean>(false);
  const [isAndroidApkModalOpen, setIsAndroidApkModalOpen] = useState<boolean>(false);
  const [selectedTradeSetup, setSelectedTradeSetup] = useState<TradeSetup | null>(null);

  const requestIdRef = useRef<number>(0);

  // Current price from latest candle
  const latestPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const lastCandleTime = candles.length > 0 ? candles[candles.length - 1].time : 0;
  const isCandleClosed = candles.length > 0 ? Boolean(candles[candles.length - 1].isClosed) : true;

  // Real-time price alerts engine hook
  const {
    alerts,
    activeToast,
    dismissToast,
    addAlert,
    addSingleLevelAlert,
    removeAlert,
    toggleAlert,
    clearTriggeredAlerts,
    importReportLevels,
    playTestSound,
    notificationPermission,
    requestNotificationPermission,
  } = usePriceAlerts(latestPrice, symbol);

  // 2. Perform Quantitative & School Analysis (hybrid: server API with client fallback)
  const triggerAnalysis = useCallback(async (
    currentCandles: Candle[],
    sym: MarketSymbol,
    tf: TimeFrame,
    src: string,
    live: boolean,
    expectedReqId?: number
  ) => {
    if (currentCandles.length < 15) {
      setReport(null);
      return;
    }
    setIsAnalyzing(true);
    try {
      // 1. Compute and display deterministic multi-school analysis immediately (0ms latency, never blocked by AI)
      const deterministicReport = analyzeMarketDeterministic(currentCandles, sym, tf, src, live);
      if (expectedReqId === undefined || expectedReqId === requestIdRef.current) {
        setReport(deterministicReport);
      }

      // 2. Request server-side analysis (which includes optional server-only Gemini synthesis & aiMeta diagnostics)
      let reportData: TechnicalReport | null = null;
      try {
        const res = await fetch('/api/technical/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candles: currentCandles,
            symbol: sym,
            timeframe: tf,
            dataSource: src,
            isLive: live,
            includeAI: true,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.report) {
            reportData = data.report;
          }
        }
      } catch {
        // Fallback to deterministic report already computed
      }

      if (!reportData) {
        reportData = deterministicReport;
      }

      if (expectedReqId !== undefined && expectedReqId !== requestIdRef.current) {
        return;
      }

      if (reportData) {
        setReport(reportData);

        // Auto-dispatch alerts if enabled
        if (reportData.tradeSetup) {
          const alertCfg = loadAlertSettings();
          if (
            (alertCfg.telegram.enabled && alertCfg.telegram.autoDispatch) ||
            (alertCfg.webhook.enabled && alertCfg.webhook.autoDispatch)
          ) {
            dispatchReportAlerts(reportData, alertCfg).catch((err) =>
              console.warn('Auto dispatch alerts failed:', err)
            );
          }
        }
      }
    } catch (err) {
      console.warn('Analysis request warning:', err);
    } finally {
      if (expectedReqId === undefined || expectedReqId === requestIdRef.current) {
        setIsAnalyzing(false);
      }
    }
  }, []);

  // 1. Fetch market candles (hybrid: server endpoint with direct client fallback)
  const loadMarketData = useCallback(async (sym: MarketSymbol, tf: TimeFrame, preserveNotice?: string) => {
    const cleanSym = normalizeDisplaySymbol(sym);
    const reqId = ++requestIdRef.current;

    setIsLoadingData(true);
    setErrorMessage(null);
    setInfoNotice(preserveNotice || null);
    setRequiresGoldImport(false);

    try {
      let candlesData: Candle[] = [];
      let source = '';
      let live = false;
      let serverLoaded = false;
      let serverResponded = false;
      let effectiveTf: TimeFrame = tf;
      let autoSwitchedNotice: string | null = preserveNotice || null;
      let serverErrorMsg: string | null = null;

      // Try server endpoint first
      try {
        const endpoint = `/api/market/candles?symbol=${encodeURIComponent(cleanSym)}&timeframe=${tf}&limit=200`;
        const res = await fetch(endpoint);
        const data = await res.json().catch(() => null);

        if (reqId !== requestIdRef.current) return;

        if (data !== null) {
          serverResponded = true;
        }

        if (res.ok && data) {
          if (data.success && Array.isArray(data.candles) && data.candles.length > 0) {
            candlesData = data.candles;
            source = data.dataSource;
            live = data.isLive;
            serverLoaded = true;
          } else if (data.requiresImport) {
            setCandles([]);
            setReport(null);
            setDataSource('');
            setIsLive(false);
            setRequiresGoldImport(true);
            setErrorMessage(data.error);
            setIsLoadingData(false);
            return;
          }
        } else if (data && data.timeframeUnsupported && data.suggestedTimeframe && tf !== data.suggestedTimeframe) {
          const suggestedTf = data.suggestedTimeframe as TimeFrame;
          effectiveTf = suggestedTf;
          autoSwitchedNotice =
            'البيانات اللحظية غير متاحة لهذا السهم من المصدر المجاني؛ يتم عرض الشارت اليومي (1d) ببيانات الإغلاق التاريخية.';
          setTimeframe(suggestedTf);
          setInfoNotice(autoSwitchedNotice);

          // Immediately fetch the suggested daily timeframe
          const retryRes = await fetch(
            `/api/market/candles?symbol=${encodeURIComponent(cleanSym)}&timeframe=${suggestedTf}&limit=200`
          );
          const retryData = await retryRes.json().catch(() => null);
          if (reqId !== requestIdRef.current) return;
          if (retryRes.ok && retryData && retryData.success && Array.isArray(retryData.candles) && retryData.candles.length > 0) {
            candlesData = retryData.candles;
            source = retryData.dataSource;
            live = retryData.isLive;
            serverLoaded = true;
          } else if (retryData && retryData.error) {
            serverErrorMsg = retryData.error;
          }
        } else if (data && data.error) {
          serverErrorMsg = data.error;
        }
      } catch {
        // Server unreachable or running as pure static client
      }

      if (reqId !== requestIdRef.current) return;

      // If server responded with a structured market error, handle it cleanly in UI state without redundant browser CORS fetch
      if (!serverLoaded && serverResponded && serverErrorMsg) {
        setCandles([]);
        setReport(null);
        setDataSource('');
        setIsLive(false);
        if (cleanSym === 'XAUUSD' && !GoldDataAdapter.hasValidData()) {
          setRequiresGoldImport(true);
        }
        setErrorMessage(serverErrorMsg);
        return;
      }

      // Seamless direct client-side fallback (only when server is unreachable)
      if (!serverLoaded) {
        if (cleanSym === 'XAUUSD') {
          const gold = await GoldDataAdapter.getGoldData(effectiveTf);
          candlesData = gold.candles;
          source = gold.dataSource;
          live = gold.isLive;
        } else if (isCryptoPairSymbol(cleanSym)) {
          const direct = await fetchBinanceKlines(cleanSym, effectiveTf, 200);
          candlesData = direct.candles;
          source = direct.dataSource;
          live = direct.isLive;
        } else {
          try {
            const forexOrEquity = await fetchForexMetalsKlines(cleanSym, effectiveTf, 200);
            candlesData = forexOrEquity.candles;
            source = forexOrEquity.dataSource;
            live = forexOrEquity.isLive;
          } catch (adapterErr: any) {
            if (
              (adapterErr.code === 'TIMEFRAME_UNSUPPORTED' || adapterErr.timeframeUnsupported) &&
              effectiveTf !== '1d'
            ) {
              effectiveTf = '1d';
              autoSwitchedNotice =
                'البيانات اللحظية غير متاحة لهذا السهم من المصدر المجاني؛ يتم عرض الشارت اليومي (1d) ببيانات الإغلاق التاريخية.';
              setTimeframe('1d');
              setInfoNotice(autoSwitchedNotice);
              const dailyFallback = await fetchForexMetalsKlines(cleanSym, '1d', 200);
              candlesData = dailyFallback.candles;
              source = dailyFallback.dataSource;
              live = dailyFallback.isLive;
            } else {
              throw adapterErr;
            }
          }
        }
      }

      if (reqId !== requestIdRef.current) return;

      if (candlesData.length > 0) {
        setCandles(candlesData);
        setDataSource(source);
        setIsLive(live);

        if (candlesData.length < 15) {
          setReport(null);
          setInfoNotice(
            `تم عرض المتاح من الشموع (${candlesData.length} شمعة)، وهو أقل من الحد الأدنى المطلوب لإصدار التقرير الكمي الكامل (15 شمعة).`
          );
        } else {
          if (autoSwitchedNotice) {
            setInfoNotice(autoSwitchedNotice);
          }
          triggerAnalysis(candlesData, cleanSym, effectiveTf, source, live, reqId);
        }
      } else {
        setCandles([]);
        setReport(null);
        setDataSource('');
        setIsLive(false);
        setErrorMessage(
          serverErrorMsg ||
            `تعذر العثور على بيانات للرمز (${cleanSym}) في أي من مزودي السوق المجانيين (Binance / Yahoo Finance). يمكنك رفع ملف CSV لتحليله.`
        );
      }
    } catch (err: any) {
      if (reqId !== requestIdRef.current) return;
      console.warn('[MarketData]', err?.message || err);
      // Clear stale candles and report from previous symbol so they never masquerade as the failed symbol
      setCandles([]);
      setReport(null);
      setDataSource('');
      setIsLive(false);

      if (cleanSym === 'XAUUSD' && !GoldDataAdapter.hasValidData()) {
        setRequiresGoldImport(true);
      }
      setErrorMessage(
        err.message ||
          `تعذر العثور على بيانات للرمز (${cleanSym}) في أي من مزودي السوق (Binance / Yahoo Finance). يرجى التأكد من صحة الرمز أو استيراد ملف CSV.`
      );
    } finally {
      if (reqId === requestIdRef.current) {
        setIsLoadingData(false);
      }
    }
  }, [triggerAnalysis]);

  // Initial load & when symbol or timeframe changes
  useEffect(() => {
    loadMarketData(symbol, timeframe);
  }, [symbol, timeframe, loadMarketData]);

  // Periodic lightweight live price polling for live assets to trigger alerts instantaneously
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(async () => {
      try {
        let price = 0;
        let found = false;

        try {
          const res = await fetch(`/api/market/price?symbol=${symbol}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && typeof data.price === 'number' && data.price > 0) {
              price = data.price;
              found = true;
            }
          }
        } catch {
          // Direct fallback
        }

        if (!found) {
          if (symbol === 'XAUUSD') {
            if (GoldDataAdapter.hasValidData()) {
              const { candles: gCandles } = GoldDataAdapter.getImportedData();
              const last = gCandles[gCandles.length - 1];
              if (last) {
                price = last.close;
                found = true;
              }
            } else {
              const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
              if (res.ok) {
                const data = await res.json();
                price = parseFloat(data.price);
                found = true;
              }
            }
          } else if (isCryptoPairSymbol(symbol)) {
            const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
            if (res.ok) {
              const data = await res.json();
              price = parseFloat(data.price);
              found = true;
            }
          } else {
            const pData = await fetchForexMetalsPrice(symbol);
            if (pData.price > 0) {
              price = pData.price;
              found = true;
            }
          }
        }

        if (found && price > 0) {
          setCandles((prevCandles) => {
            if (prevCandles.length === 0) return prevCandles;
            const lastIdx = prevCandles.length - 1;
            const lastCandle = prevCandles[lastIdx];
            if (lastCandle.close === price) return prevCandles;

            const updatedLast = {
              ...lastCandle,
              close: price,
              high: Math.max(lastCandle.high, price),
              low: Math.min(lastCandle.low, price),
            };
            const nextList = [...prevCandles];
            nextList[lastIdx] = updatedLast;
            return nextList;
          });
        }
      } catch {
        // Ticker polling silent error handler
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [symbol, isLive]);

  // Direct Binance WebSocket streaming for sub-second live candlestick updates on any Binance crypto pair
  useEffect(() => {
    if (!isLive) return;

    // Connect Binance WebSocket strictly for crypto pairs (prevents USDT pollution on Forex/Gold/Stocks)
    const wsSymbol = isCryptoPairSymbol(symbol) ? symbol.toLowerCase() : null;
    if (!wsSymbol) return;
    const wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${timeframe}`;

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.e === 'kline' && payload.k) {
            const k = payload.k;
            const candleTime = Number(k.t);
            const openPrice = parseFloat(k.o);
            const highPrice = parseFloat(k.h);
            const lowPrice = parseFloat(k.l);
            const closePrice = parseFloat(k.c);
            const vol = parseFloat(k.v);
            const isClosed = Boolean(k.x);

            setCandles((prevCandles) => {
              if (prevCandles.length === 0) return prevCandles;
              const lastIdx = prevCandles.length - 1;
              const lastCandle = prevCandles[lastIdx];

              if (lastCandle.time === candleTime) {
                // Update active candle in real time
                const updated = {
                  ...lastCandle,
                  open: openPrice,
                  high: Math.max(lastCandle.high, highPrice),
                  low: Math.min(lastCandle.low, lowPrice),
                  close: closePrice,
                  volume: vol,
                  isClosed,
                };
                const nextList = [...prevCandles];
                nextList[lastIdx] = updated;
                return nextList;
              } else if (candleTime > lastCandle.time) {
                // New candle initiated
                return [
                  ...prevCandles,
                  {
                    time: candleTime,
                    open: openPrice,
                    high: highPrice,
                    low: lowPrice,
                    close: closePrice,
                    volume: vol,
                    isClosed,
                  },
                ];
              }
              return prevCandles;
            });
          }
        } catch {
          // Silent WS parse handler
        }
      };

      socket.onerror = () => {
        // Fallback polling will smoothly take over if WS is restricted
      };
    } catch {
      // WS unsupported or offline
    }

    return () => {
      if (socket) {
        try {
          socket.close();
        } catch {
          // Ignore close error
        }
      }
    };
  }, [symbol, timeframe, isLive]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-300 pb-20 lg:pb-0">
      {/* Top Navbar with Alerts Counter & Modal Trigger */}
      <Navbar
        symbol={symbol}
        onSelectSymbol={(s) => setSymbol(normalizeDisplaySymbol(s))}
        timeframe={timeframe}
        onSelectTimeframe={(tf) => setTimeframe(tf)}
        activeView={activeView}
        onSelectView={(v) => setActiveView(v)}
        onRunAnalysis={() => triggerAnalysis(candles, symbol, timeframe, dataSource, isLive)}
        isAnalyzing={isAnalyzing}
        activeAlertsCount={alerts.filter((a) => a.isActive).length}
        onOpenAlertsModal={() => setIsAlertsModalOpen(true)}
        onOpenAlertSettings={() => setIsAlertSettingsOpen(true)}
        onOpenRiskCalculator={() => {
          setSelectedTradeSetup(report?.tradeSetup || null);
          setIsRiskCalcOpen(true);
        }}
        onOpenAndroidApk={() => setIsAndroidApkModalOpen(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Market Status Bar */}
        <DataStatusBar
          symbol={symbol}
          timeframe={timeframe}
          currentPrice={latestPrice}
          dataSource={dataSource}
          isLive={isLive}
          lastCandleTime={lastCandleTime}
          isCandleClosed={isCandleClosed}
          candleCount={candles.length}
          isLoadingData={isLoadingData}
          onRefreshData={() => loadMarketData(symbol, timeframe)}
          onOpenImportModal={() => setIsImportModalOpen(true)}
        />

        {/* Info Notice (Auto-switch to 1d or < 15 candles notice) */}
        {infoNotice && !errorMessage && (
          <div className="p-3.5 rounded-xl bg-sky-950/35 border border-sky-800/70 text-xs text-sky-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{infoNotice}</span>
            </div>
            <button
              onClick={() => setInfoNotice(null)}
              className="text-[11px] text-sky-300/80 hover:text-white px-2 py-0.5 rounded bg-sky-900/40 cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Notice / Warning Message */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/80 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{requiresGoldImport ? 'استيراد ملف CSV للذهب' : `استيراد ملف CSV لـ ${symbol}`}</span>
            </button>
          </div>
        )}

        {/* View 1: Chart and Schools Matrix */}
        {activeView === 'chart_and_schools' && (
          <div className="space-y-6">
            {candles.length > 0 ? (
              <>
                <CandlestickChart
                  candles={candles}
                  symbol={symbol}
                  timeframe={timeframe}
                  report={report}
                  zones={(() => {
                    const res: import('./types/market.ts').SupportResistanceZone[] = [];
                    if (report) {
                      for (const p of report.schools.classical.supports) {
                        res.push({ price: p, type: 'support', touches: 2, strength: 'moderate' });
                      }
                      for (const p of report.schools.classical.resistances) {
                        res.push({ price: p, type: 'resistance', touches: 2, strength: 'moderate' });
                      }
                    }
                    return res;
                  })()}
                  alerts={alerts}
                  onOpenAlerts={() => setIsAlertsModalOpen(true)}
                />

                {/* Multi-Timeframe Confluence Scanner */}
                {candles.length >= 15 && (
                  <ConfluenceScanner
                    symbol={symbol}
                    currentTimeframe={timeframe}
                    currentCandles={candles}
                    report={report}
                  />
                )}

                {report && <SchoolsMatrix report={report} />}
              </>
            ) : isLoadingData ? (
              <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-12 text-center space-y-4">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                <h3 className="text-base font-bold text-white">جاري جلب شموع وبيانات السوق ({symbol})...</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  يتم الاتصال بمزود البيانات الموثق للتأكد من سلامة الشموع والأسعار قبل بدء الحسابات الفنية.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-12 text-center space-y-4">
                <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                <h3 className="text-base font-bold text-white">لا تتوفر بيانات شموع حالياً للرمز ({symbol})</h3>
                <p className="text-xs text-slate-400 max-w-lg mx-auto">
                  {errorMessage ||
                    'تعذر جلب بيانات تاريخية أو لحظية لهذا الرمز من المزود المجاني. يمكنك التبديل إلى الإطار اليومي (1d) أو استيراد ملف CSV لتحليله كاملاً.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  {timeframe !== '1d' && (
                    <button
                      onClick={() => setTimeframe('1d')}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 transition cursor-pointer"
                    >
                      التبديل إلى الإطار اليومي (1d)
                    </button>
                  )}
                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>استيراد ملف CSV لـ {symbol}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* View 2: Multi-Asset Opportunity Scanner (المحور الأول) */}
        {activeView === 'scanner' && (
          <MultiAssetScanner
            selectedSymbol={symbol}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onSelectAsset={(selectedSym, selectedTf) => {
              const normSym = normalizeDisplaySymbol(selectedSym);
              setSymbol(normSym);
              setTimeframe(selectedTf);
              setActiveView('chart_and_schools');
              loadMarketData(normSym, selectedTf);
            }}
          />
        )}

        {/* View 3: Macroeconomic & Economic Calendar Panel (المحور الثالث) */}
        {activeView === 'macro' && (
          <MacroPanel />
        )}

        {/* View 4: Full Trading Report with Interactive Levels & Alerts */}
        {activeView === 'report' && (
          <div>
            {report ? (
              <TradingReportView
                report={report}
                onImportReportLevels={(r) => importReportLevels(r)}
                onAddSingleAlert={(price, type, label) => addSingleLevelAlert(price, type, label)}
                onOpenAlertsModal={() => setIsAlertsModalOpen(true)}
                onOpenAlertSettings={() => setIsAlertSettingsOpen(true)}
                onOpenRiskCalculator={(setup) => {
                  setSelectedTradeSetup(setup || report.tradeSetup || null);
                  setIsRiskCalcOpen(true);
                }}
                activeAlerts={alerts}
              />
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-12 text-center space-y-4">
                <h3 className="text-base font-bold text-white">لم يتم توليد التقرير بعد</h3>
                <p className="text-xs text-slate-400">
                  انقر على زر «تحليل شامل» في الشريط العلوي لمعالجة المؤشرات وتوليد التقرير العربي الشامل.
                </p>
                <button
                  onClick={() => triggerAnalysis(candles, symbol, timeframe, dataSource, isLive)}
                  disabled={candles.length < 15 || isAnalyzing}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition"
                >
                  توليد التقرير الفني الآن
                </button>
              </div>
            )}
          </div>
        )}

        {/* View 5: Backtest Panel */}
        {activeView === 'backtest' && (
          <BacktestPanel candles={candles} symbol={symbol} />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print border-t border-slate-800/80 bg-[#070a12] py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>المحلل الفني المتقدم – Advanced Market Analyst © {new Date().getFullYear()}</span>
          <span>منصة تحليل مالي كمي متكاملة باللغة العربية · تنبيهات فورية · PWA Offline Ready</span>
        </div>
      </footer>

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(importedCandles, audit, srcName) => {
          setCandles(importedCandles);
          setDataSource(`ملف مستورد (${audit.detectedFormat}) - ${srcName}`);
          setIsLive(false);
          setErrorMessage(null);
          setInfoNotice(null);
          setRequiresGoldImport(false);
          if (importedCandles.length >= 15) {
            triggerAnalysis(importedCandles, symbol, timeframe, `ملف مستورد (${audit.detectedFormat})`, false);
          } else {
            setReport(null);
            setInfoNotice(
              `تم استيراد وعرض (${importedCandles.length} شمعة) للرمز ${symbol}، وهو أقل من الحد الأدنى المطلوب لإصدار التقرير الكمي الكامل (15 شمعة).`
            );
          }
        }}
      />

      {/* Real-time Price Alerts Modal */}
      <PriceAlertsModal
        isOpen={isAlertsModalOpen}
        onClose={() => setIsAlertsModalOpen(false)}
        alerts={alerts}
        currentPrice={latestPrice}
        currentSymbol={symbol}
        report={report}
        onAddAlert={addAlert}
        onRemoveAlert={removeAlert}
        onToggleAlert={toggleAlert}
        onImportReportLevels={importReportLevels}
        onClearTriggered={clearTriggeredAlerts}
        onPlayTestSound={playTestSound}
        notificationPermission={notificationPermission}
        onRequestPermission={requestNotificationPermission}
      />

      {/* Institutional Risk Management & Position Sizing Calculator Modal */}
      <RiskCalculatorModal
        isOpen={isRiskCalcOpen}
        onClose={() => setIsRiskCalcOpen(false)}
        symbol={symbol}
        currentPrice={latestPrice}
        tradeSetup={selectedTradeSetup}
      />

      {/* Instant Floating Toast when Price Reaches Target Level */}
      <PriceAlertToast
        toast={activeToast}
        onDismiss={dismissToast}
      />

      {/* Android APK & WebAPK Standalone Installation Modal */}
      <AndroidApkModal
        isOpen={isAndroidApkModalOpen}
        onClose={() => setIsAndroidApkModalOpen(false)}
      />

      {/* Telegram & Webhook Alert Settings Modal */}
      <AlertSettingsModal
        isOpen={isAlertSettingsOpen}
        onClose={() => setIsAlertSettingsOpen(false)}
      />

      {/* Offline Toast Indicator */}
      <OfflineIndicator />
    </div>
  );
}
