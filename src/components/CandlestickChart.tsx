/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { Candle, EMAData, BollingerData, SupportResistanceZone, PriceAlert, TechnicalReport } from '../types/market.ts';
import { calculateEMASeries, calculateRSISeries, calculateMACDSeries, calculateStochasticSeries } from '../services/quantitative-engine.ts';
import { getAssetDecimals } from '../services/market/custom-assets.ts';

interface CandlestickChartProps {
  candles: Candle[];
  symbol: string;
  timeframe: string;
  zones?: SupportResistanceZone[];
  alerts?: PriceAlert[];
  onOpenAlerts?: () => void;
  report?: TechnicalReport | null;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  symbol,
  timeframe,
  zones = [],
  alerts = [],
  onOpenAlerts,
  report,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(60);
  const [showIndicators, setShowIndicators] = useState({
    ema: true,
    bollinger: true,
    sr: true,
    rsi: true,
    macd: true,
    stochastic: true,
    alerts: true,
    volumeProfile: true,
    tradeSetup: true,
    vwapPoc: true,
    fvgOb: true,
  });
  const [setupNotice, setSetupNotice] = useState<string | null>(null);

  const activeSymbolAlerts = useMemo(() => {
    return alerts.filter((a) => a.isActive && a.symbol === symbol);
  }, [alerts, symbol]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Take the slice of visible candles from the end
  const displayCandles = useMemo(() => {
    return candles.slice(-visibleCount);
  }, [candles, visibleCount]);

  // Pre-calculate full-series indicators to align with display slice
  const fullEma20 = useMemo(() => calculateEMASeries(candles, 20), [candles]);
  const fullEma50 = useMemo(() => calculateEMASeries(candles, 50), [candles]);
  const fullEma200 = useMemo(() => calculateEMASeries(candles, 200), [candles]);
  const fullRsi = useMemo(() => calculateRSISeries(candles, 14), [candles]);
  const fullMacd = useMemo(() => calculateMACDSeries(candles), [candles]);
  const fullStochastic = useMemo(() => calculateStochasticSeries(candles, 14, 3, 3), [candles]);

  const startIndex = Math.max(0, candles.length - visibleCount);

  const displayEma20 = useMemo(() => fullEma20.slice(startIndex), [fullEma20, startIndex]);
  const displayEma50 = useMemo(() => fullEma50.slice(startIndex), [fullEma50, startIndex]);
  const displayEma200 = useMemo(() => fullEma200.slice(startIndex), [fullEma200, startIndex]);
  const displayRsi = useMemo(() => fullRsi.slice(startIndex), [fullRsi, startIndex]);
  const displayMacd = useMemo(() => ({
    macd: fullMacd.macdLine.slice(startIndex),
    signal: fullMacd.signalLine.slice(startIndex),
    hist: fullMacd.histogram.slice(startIndex),
  }), [fullMacd, startIndex]);
  const displayStochastic = useMemo(() => ({
    k: fullStochastic.k.slice(startIndex),
    d: fullStochastic.d.slice(startIndex),
  }), [fullStochastic, startIndex]);

  // Chart Dimensions
  const chartWidth = 900;
  const mainHeight = 360;
  const rsiHeight = 90;
  const macdHeight = 90;
  const stochHeight = 90;
  const paddingRight = 65; // price axis
  const paddingLeft = 10;
  const plotWidth = chartWidth - paddingRight - paddingLeft;

  // Price Extents in main pane
  const { minPrice, maxPrice } = useMemo(() => {
    if (displayCandles.length === 0) return { minPrice: 0, maxPrice: 100 };
    let min = Math.min(...displayCandles.map((c) => c.low));
    let max = Math.max(...displayCandles.map((c) => c.high));

    // If tradeSetup overlay is enabled and setup exists, expand min/max so SL and TP1/TP2 are visible!
    if (showIndicators.tradeSetup && report?.tradeSetup?.hasSetup) {
      const s = report.tradeSetup;
      if (typeof s.stopLoss === 'number' && s.stopLoss > 0) {
        min = Math.min(min, s.stopLoss);
        max = Math.max(max, s.stopLoss);
      }
      if (s.entryZone) {
        if (s.entryZone.min > 0) min = Math.min(min, s.entryZone.min);
        if (s.entryZone.max > 0) max = Math.max(max, s.entryZone.max);
      }
      if (Array.isArray(s.targets) && s.targets.length > 0) {
        // Include first two targets to keep scale reasonable and avoid extreme distortion
        const toCheck = s.targets.slice(0, 2);
        for (const t of toCheck) {
          if (typeof t === 'number' && t > 0) {
            min = Math.min(min, t);
            max = Math.max(max, t);
          }
        }
      }
    }

    // Allow margin
    const margin = (max - min) * 0.08 || 1;
    return { minPrice: min - margin, maxPrice: max + margin };
  }, [displayCandles, showIndicators.tradeSetup, report?.tradeSetup]);

  const priceDecimals = useMemo(() => {
    return getAssetDecimals(symbol, maxPrice);
  }, [symbol, maxPrice]);

  // Coordinate mapping functions
  const getY = (price: number): number => {
    if (maxPrice === minPrice) return mainHeight / 2;
    return mainHeight - ((price - minPrice) / (maxPrice - minPrice)) * mainHeight;
  };

  const candleWidth = displayCandles.length > 0 ? plotWidth / displayCandles.length : 10;
  const barWidth = Math.max(2, candleWidth * 0.7);

  const getX = (index: number): number => {
    return paddingLeft + index * candleWidth + candleWidth / 2;
  };

  // RSI Y Mapper (0 to 100)
  const getRsiY = (val: number): number => {
    return rsiHeight - (val / 100) * rsiHeight;
  };

  // Stochastic Y Mapper (0 to 100)
  const getStochY = (val: number): number => {
    return stochHeight - (val / 100) * stochHeight;
  };

  // MACD Y Mapper
  const { maxMacdAbs } = useMemo(() => {
    let maxAbs = 0.5;
    for (let i = 0; i < displayMacd.macd.length; i++) {
      const m = displayMacd.macd[i];
      const s = displayMacd.signal[i];
      const h = displayMacd.hist[i];
      if (m !== null) maxAbs = Math.max(maxAbs, Math.abs(m));
      if (s !== null) maxAbs = Math.max(maxAbs, Math.abs(s));
      if (h !== null) maxAbs = Math.max(maxAbs, Math.abs(h));
    }
    return { maxMacdAbs: maxAbs * 1.15 };
  }, [displayMacd]);

  const getMacdY = (val: number): number => {
    return (macdHeight / 2) - (val / maxMacdAbs) * (macdHeight / 2);
  };

  // Build SVG path for series
  const buildLinePath = (values: (number | null)[], yMapper: (v: number) => number): string => {
    let d = '';
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      if (val !== null) {
        const x = getX(i);
        const y = yMapper(val);
        if (!d) d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        else d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    }
    return d;
  };

  // Volume Profile (Volume by Price) Computation
  const volumeProfileData = useMemo(() => {
    if (!showIndicators.volumeProfile || displayCandles.length === 0) return null;
    const bucketCount = 22;
    const priceRange = maxPrice - minPrice;
    if (priceRange <= 0) return null;

    const bucketSize = priceRange / bucketCount;
    const buckets: { priceMin: number; priceMax: number; midPrice: number; volume: number }[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const pMin = minPrice + i * bucketSize;
      const pMax = pMin + bucketSize;
      buckets.push({ priceMin: pMin, priceMax: pMax, midPrice: (pMin + pMax) / 2, volume: 0 });
    }

    let maxVol = 0;
    for (const c of displayCandles) {
      const vol = c.volume > 0 ? c.volume : Math.abs(c.close - c.open) + 1;
      const cLow = Math.max(minPrice, c.low);
      const cHigh = Math.min(maxPrice, c.high);
      let overlapCount = 0;
      for (const b of buckets) {
        if (cHigh >= b.priceMin && cLow <= b.priceMax) overlapCount++;
      }
      const splitVol = vol / Math.max(1, overlapCount);
      for (const b of buckets) {
        if (cHigh >= b.priceMin && cLow <= b.priceMax) {
          b.volume += splitVol;
          if (b.volume > maxVol) maxVol = b.volume;
        }
      }
    }

    let poc = buckets[0];
    for (const b of buckets) {
      if (b.volume > poc.volume) poc = b;
    }

    return { buckets, maxVol: Math.max(1, maxVol), pocPrice: poc.midPrice };
  }, [showIndicators.volumeProfile, displayCandles, minPrice, maxPrice]);

  const hoveredCandle = hoverIndex !== null && displayCandles[hoverIndex] ? displayCandles[hoverIndex] : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d121f] p-4 text-slate-200">
      {/* Chart Top Controls & Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-white tracking-wide">{symbol}</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-semibold">{timeframe}</span>
          <span className="text-xs text-slate-400 font-mono">
            {displayCandles.length} شمعة معروضة
          </span>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setShowIndicators(p => ({ ...p, ema: !p.ema }))}
            className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
              showIndicators.ema ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800/50 text-slate-400 border border-transparent'
            }`}
          >
            EMA (20/50/200)
          </button>
          <button
            onClick={() => setShowIndicators(p => ({ ...p, sr: !p.sr }))}
            className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
              showIndicators.sr ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800/50 text-slate-400 border border-transparent'
            }`}
          >
            الدعوم والمقاومات
          </button>
          <button
            onClick={() => setShowIndicators(p => ({ ...p, rsi: !p.rsi }))}
            className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
              showIndicators.rsi ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-slate-800/50 text-slate-400 border border-transparent'
            }`}
          >
            مؤشر RSI
          </button>
          <button
            onClick={() => setShowIndicators(p => ({ ...p, macd: !p.macd }))}
            className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
              showIndicators.macd ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-slate-800/50 text-slate-400 border border-transparent'
            }`}
          >
            مؤشر MACD
          </button>
          <button
            onClick={() => setShowIndicators(p => ({ ...p, stochastic: !p.stochastic }))}
            className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
              showIndicators.stochastic ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800/50 text-slate-400 border border-transparent'
            }`}
            title="مؤشر الاستوكاستك Stochastic Oscillator (%K, %D)"
          >
            مؤشر الاستوكاستك (Stochastic)
          </button>
          <button
            onClick={() => setShowIndicators(p => ({ ...p, volumeProfile: !p.volumeProfile }))}
            className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
              showIndicators.volumeProfile
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-slate-800/50 text-slate-400 border border-transparent'
            }`}
            title="توزيع السيولة الحجمية على المحور الرأسي وتحديد نقطة السيطرة POC"
          >
            توزيع السيولة (Volume Profile)
          </button>
          {activeSymbolAlerts.length > 0 && (
            <button
              onClick={() => setShowIndicators(p => ({ ...p, alerts: !p.alerts }))}
              className={`px-2.5 py-1 rounded transition cursor-pointer font-medium flex items-center gap-1.5 ${
                showIndicators.alerts
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'bg-slate-800/50 text-slate-400 border border-transparent'
              }`}
              title="إظهار / إخفاء خطوط التنبيهات على الرسم"
            >
              <span>🔔 خطوط التنبيهات</span>
              <span className="font-mono text-[10px] font-bold px-1 rounded bg-amber-500/30 text-amber-200">
                {activeSymbolAlerts.length}
              </span>
            </button>
          )}

          {/* Institutional Overlay Toggles */}
          {report?.tradeSetup ? (
            <button
              onClick={() => {
                const nextVal = !showIndicators.tradeSetup;
                setShowIndicators((p) => ({ ...p, tradeSetup: nextVal }));
                if (nextVal) {
                  if (report.tradeSetup.hasSetup) {
                    setSetupNotice(
                      `تم تفعيل إسقاط مستويات الصفقة على الشارت: ${report.tradeSetup.bias === 'شراء' ? 'شراء (BUY) 🟢' : 'بيع (SELL) 🔴'} — الدخول (${report.tradeSetup.entryZone.min.toFixed(priceDecimals)})، الوقف (${report.tradeSetup.stopLoss.toFixed(priceDecimals)})، الأهداف (${report.tradeSetup.targets.map(t => t.toFixed(priceDecimals)).join(' | ')}).`
                    );
                  } else {
                    setSetupNotice(
                      `صفقة التقرير: لا توجد صفقة نشطة حالياً لهذا الأصل (حياد / مراقبة). السبب: ${report.tradeSetup.reasoning}`
                    );
                  }
                  setTimeout(() => setSetupNotice(null), 6500);
                } else {
                  setSetupNotice('تم إخفاء إسقاط صفقة التقرير عن الشارت.');
                  setTimeout(() => setSetupNotice(null), 2500);
                }
              }}
              className={`px-2.5 py-1 rounded transition cursor-pointer font-medium flex items-center gap-1.5 ${
                showIndicators.tradeSetup
                  ? report.tradeSetup.hasSetup
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'bg-slate-800/50 text-slate-400 border border-transparent'
              }`}
              title="إسقاط مستويات الدخول، وقف الخسارة، والأهداف المحسوبة بالصفقة"
            >
              <span>🎯 صفقة التقرير</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  report.tradeSetup.hasSetup
                    ? report.tradeSetup.bias === 'شراء'
                      ? 'bg-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/30 text-rose-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {report.tradeSetup.hasSetup
                  ? report.tradeSetup.bias === 'شراء'
                    ? 'شراء 🟢'
                    : 'بيع 🔴'
                  : 'حياد ⚪'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                setSetupNotice('لم يتم توليد التقرير الفني بعد. اضغط على زر «تحليل شامل» في الأعلى لبناء التقرير واستخراج الصفقة.');
                setTimeout(() => setSetupNotice(null), 5000);
              }}
              className="px-2.5 py-1 rounded transition cursor-pointer font-medium flex items-center gap-1.5 bg-slate-800/40 text-slate-400 border border-slate-700/40"
              title="يتطلب إجراء التحليل الشامل أولاً"
            >
              <span>🎯 صفقة التقرير</span>
              <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400">بانتظار التحليل</span>
            </button>
          )}

          {report?.indicators?.volume && (
            <button
              onClick={() => setShowIndicators(p => ({ ...p, vwapPoc: !p.vwapPoc }))}
              className={`px-2.5 py-1 rounded transition cursor-pointer font-medium flex items-center gap-1 ${
                showIndicators.vwapPoc
                  ? 'bg-pink-500/25 text-pink-300 border border-pink-500/40 shadow-sm'
                  : 'bg-slate-800/50 text-slate-400 border border-transparent'
              }`}
              title="إسقاط خطوط VWAP ونقطة السيطرة POC"
            >
              <span>💧 السيولة (VWAP/POC)</span>
            </button>
          )}

          {report?.schools?.priceAction && (
            <button
              onClick={() => setShowIndicators(p => ({ ...p, fvgOb: !p.fvgOb }))}
              className={`px-2.5 py-1 rounded transition cursor-pointer font-medium flex items-center gap-1 ${
                showIndicators.fvgOb
                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-slate-800/50 text-slate-400 border border-transparent'
              }`}
              title="إسقاط فجوات القيمة العادلة FVG وكتل الأوامر OB"
            >
              <span>📦 كتل الفجوات (FVG/OB)</span>
            </button>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-800/70 rounded p-0.5 border border-slate-700/60">
            <button
              onClick={() => setVisibleCount(Math.min(180, visibleCount + 20))}
              className="px-2 py-0.5 hover:text-white transition font-mono font-bold"
              title="تصغير / إظهار شموع أكثر"
            >
              -
            </button>
            <span className="text-[10px] text-slate-400 font-mono px-1">مدى</span>
            <button
              onClick={() => setVisibleCount(Math.max(30, visibleCount - 20))}
              className="px-2 py-0.5 hover:text-white transition font-mono font-bold"
              title="تكبير / تركيز على الشموع الأخيرة"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Setup Status Banner / Notification */}
      {setupNotice && (
        <div className="my-2 p-2.5 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-xs text-indigo-200 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-base shrink-0">🎯</span>
            <span className="leading-relaxed">{setupNotice}</span>
          </div>
          <button
            onClick={() => setSetupNotice(null)}
            className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded text-[11px] shrink-0 hover:bg-slate-800/60 transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Candlestick Crosshair Info Box */}
      <div className="h-7 flex items-center text-xs font-mono text-slate-300 gap-4 overflow-x-auto py-1">
        {hoveredCandle ? (
          <>
            <span className="text-slate-400">التوقيت: <strong className="text-white">{new Date(hoveredCandle.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</strong></span>
            <span>افتتاح: <strong className="text-white">{hoveredCandle.open.toFixed(priceDecimals)}</strong></span>
            <span>أعلى: <strong className="text-emerald-400">{hoveredCandle.high.toFixed(priceDecimals)}</strong></span>
            <span>أدنى: <strong className="text-rose-400">{hoveredCandle.low.toFixed(priceDecimals)}</strong></span>
            <span>إغلاق: <strong className={hoveredCandle.close >= hoveredCandle.open ? 'text-emerald-400' : 'text-rose-400'}>{hoveredCandle.close.toFixed(priceDecimals)}</strong></span>
            <span className="text-slate-400">حجم: <strong className="text-slate-200">{hoveredCandle.volume.toLocaleString()}</strong></span>
          </>
        ) : (
          <span className="text-slate-500 italic">مرر الفأرة فوق الرسم البياني لعرض تفاصيل الشمعة بدقة</span>
        )}
      </div>

      {/* Main Candlestick Chart Area */}
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${mainHeight}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * chartWidth;
            const index = Math.floor((x - paddingLeft) / candleWidth);
            if (index >= 0 && index < displayCandles.length) {
              setHoverIndex(index);
            }
          }}
        >
          <defs>
            <linearGradient id="bullCandleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="bearCandleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
            const y = mainHeight * ratio;
            const p = maxPrice - (ratio * (maxPrice - minPrice));
            return (
              <g key={ratio}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#1f2937"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={chartWidth - paddingRight + 6}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                >
                  {p.toFixed(priceDecimals)}
                </text>
              </g>
            );
          })}

          {/* Volume Profile (Volume by Price) Bars & Point of Control (POC) */}
          {showIndicators.volumeProfile && volumeProfileData && (
            <g opacity="0.7">
              {volumeProfileData.buckets.map((b, idx) => {
                const yTop = getY(b.priceMax);
                const yBottom = getY(b.priceMin);
                const barH = Math.max(2, Math.abs(yBottom - yTop) - 1);
                const w = (b.volume / volumeProfileData.maxVol) * 110;
                const isPoc = Math.abs(b.midPrice - volumeProfileData.pocPrice) < (b.priceMax - b.priceMin) / 2;
                return (
                  <rect
                    key={`vp-${idx}`}
                    x={paddingLeft}
                    y={Math.min(yTop, yBottom)}
                    width={Math.max(2, w)}
                    height={barH}
                    fill={isPoc ? '#F59E0B' : '#3B82F6'}
                    opacity={isPoc ? 0.85 : 0.3}
                    rx="1"
                  />
                );
              })}
              {/* POC Golden Line */}
              <line
                x1={paddingLeft}
                y1={getY(volumeProfileData.pocPrice)}
                x2={chartWidth - paddingRight}
                y2={getY(volumeProfileData.pocPrice)}
                stroke="#F59E0B"
                strokeDasharray="3 3"
                strokeWidth="1.2"
                opacity="0.85"
              />
              <text
                x={paddingLeft + 115}
                y={getY(volumeProfileData.pocPrice) - 4}
                fill="#F59E0B"
                fontSize="9"
                fontFamily="JetBrains Mono"
                fontWeight="bold"
              >
                POC: {volumeProfileData.pocPrice.toFixed(1)}
              </text>
            </g>
          )}

          {/* Price Action: FVG and Order Blocks Layer */}
          {showIndicators.fvgOb && report?.schools?.priceAction && (
            <g className="fvg-ob-layer">
              {/* Unmitigated Fair Value Gaps */}
              {report.schools.priceAction.fairValueGaps
                .filter((f) => !f.mitigated)
                .map((fvg, idx) => {
                  const yTop = getY(fvg.top);
                  const yBottom = getY(fvg.bottom);
                  if (Math.min(yTop, yBottom) > mainHeight || Math.max(yTop, yBottom) < 0) return null;
                  const rectY = Math.min(yTop, yBottom);
                  const rectH = Math.max(2, Math.abs(yBottom - yTop));
                  const isBull = fvg.type === 'bullish_fvg';
                  return (
                    <g key={`fvg-${idx}`}>
                      <rect
                        x={paddingLeft}
                        y={rectY}
                        width={plotWidth}
                        height={rectH}
                        fill={isBull ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'}
                        stroke={isBull ? '#10B981' : '#EF4444'}
                        strokeWidth="0.8"
                        strokeDasharray="4 2"
                      />
                      <text
                        x={paddingLeft + 8}
                        y={rectY + 10}
                        fill={isBull ? '#6EE7B7' : '#FCA5A5'}
                        fontSize="9"
                        fontFamily="JetBrains Mono"
                        fontWeight="bold"
                      >
                        FVG {isBull ? 'صاعد' : 'هابط'} ({fvg.bottom.toFixed(priceDecimals)} - {fvg.top.toFixed(priceDecimals)})
                      </text>
                    </g>
                  );
                })}

              {/* Untested Order Blocks */}
              {report.schools.priceAction.orderBlocks
                .filter((ob) => !ob.tested)
                .map((ob, idx) => {
                  const yTop = getY(ob.high);
                  const yBottom = getY(ob.low);
                  if (Math.min(yTop, yBottom) > mainHeight || Math.max(yTop, yBottom) < 0) return null;
                  const rectY = Math.min(yTop, yBottom);
                  const rectH = Math.max(2, Math.abs(yBottom - yTop));
                  const isBull = ob.type === 'bullish_ob';
                  return (
                    <g key={`ob-${idx}`}>
                      <rect
                        x={paddingLeft}
                        y={rectY}
                        width={plotWidth}
                        height={rectH}
                        fill={isBull ? 'rgba(56, 189, 248, 0.14)' : 'rgba(244, 63, 94, 0.14)'}
                        stroke={isBull ? '#38BDF8' : '#F43F5E'}
                        strokeWidth="1"
                      />
                      <text
                        x={paddingLeft + 8}
                        y={rectY + 10}
                        fill={isBull ? '#7DD3FC' : '#FDA4AF'}
                        fontSize="9"
                        fontFamily="JetBrains Mono"
                        fontWeight="bold"
                      >
                        OB {isBull ? 'طلب' : 'عرض'} ({ob.low.toFixed(priceDecimals)} - {ob.high.toFixed(priceDecimals)})
                      </text>
                    </g>
                  );
                })}
            </g>
          )}

          {/* Support and Resistance Horizontal Zones */}
          {showIndicators.sr && zones.map((z, idx) => {
            const y = getY(z.price);
            if (y < 0 || y > mainHeight) return null;
            const color = z.type === 'support' ? '#10B981' : '#EF4444';
            return (
              <g key={`zone-${idx}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke={color}
                  strokeDasharray="5 3"
                  strokeWidth="1.2"
                  opacity="0.75"
                />
                <rect
                  x={chartWidth - paddingRight + 4}
                  y={y - 8}
                  width="54"
                  height="16"
                  rx="3"
                  fill={z.type === 'support' ? '#064e3b' : '#7f1d1d'}
                />
                <text
                  x={chartWidth - paddingRight + 8}
                  y={y + 4}
                  fill="#ffffff"
                  fontSize="9"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  {z.price.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Active Price Alerts Horizontal Lines */}
          {showIndicators.alerts && activeSymbolAlerts.map((alt) => {
            const y = getY(alt.targetPrice);
            if (y < 0 || y > mainHeight) return null;
            return (
              <g
                key={`alert-line-${alt.id}`}
                className="cursor-pointer group"
                onClick={onOpenAlerts}
              >
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#F59E0B"
                  strokeDasharray="6 3"
                  strokeWidth="1.5"
                  opacity="0.9"
                />
                <rect
                  x={chartWidth - paddingRight + 4}
                  y={y - 8}
                  width="62"
                  height="16"
                  rx="3"
                  fill="#78350F"
                  stroke="#F59E0B"
                  strokeWidth="0.8"
                />
                <text
                  x={chartWidth - paddingRight + 8}
                  y={y + 4}
                  fill="#FEF3C7"
                  fontSize="9"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  🔔 {alt.targetPrice.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Institutional Volume Levels: VWAP & POC */}
          {showIndicators.vwapPoc && report?.indicators?.volume && (
            <g className="volume-levels-layer">
              {/* VWAP Line */}
              {report.indicators.volume.vwap && (() => {
                const y = getY(report.indicators.volume.vwap);
                if (y < 0 || y > mainHeight) return null;
                return (
                  <g key="vwap-line">
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke="#EC4899"
                      strokeWidth="1.8"
                      strokeDasharray="5 3"
                    />
                    <rect
                      x={chartWidth - paddingRight + 4}
                      y={y - 8}
                      width="60"
                      height="16"
                      rx="3"
                      fill="#831843"
                      stroke="#EC4899"
                      strokeWidth="0.8"
                    />
                    <text
                      x={chartWidth - paddingRight + 8}
                      y={y + 4}
                      fill="#FCE7F3"
                      fontSize="9"
                      fontFamily="JetBrains Mono"
                      fontWeight="bold"
                    >
                      VWAP {report.indicators.volume.vwap.toFixed(priceDecimals)}
                    </text>
                  </g>
                );
              })()}

              {/* POC Line */}
              {report.indicators.volume.poc && (() => {
                const y = getY(report.indicators.volume.poc);
                if (y < 0 || y > mainHeight) return null;
                return (
                  <g key="poc-line">
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke="#F59E0B"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                    <rect
                      x={chartWidth - paddingRight + 4}
                      y={y - 8}
                      width="60"
                      height="16"
                      rx="3"
                      fill="#78350F"
                      stroke="#F59E0B"
                      strokeWidth="0.8"
                    />
                    <text
                      x={chartWidth - paddingRight + 8}
                      y={y + 4}
                      fill="#FEF3C7"
                      fontSize="9"
                      fontFamily="JetBrains Mono"
                      fontWeight="bold"
                    >
                      POC {report.indicators.volume.poc.toFixed(priceDecimals)}
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Trade Setup Overlay (Entry Zone, Stop Loss, Targets, and HUD Card) */}
          {showIndicators.tradeSetup && report?.tradeSetup?.hasSetup && (() => {
            const setup = report.tradeSetup;
            const yEntryMin = getY(setup.entryZone.min);
            const yEntryMax = getY(setup.entryZone.max);
            const yStop = getY(setup.stopLoss);

            const entryTop = Math.min(yEntryMin, yEntryMax);
            const entryH = Math.max(3, Math.abs(yEntryMax - yEntryMin));

            return (
              <g className="trade-setup-layer">
                {/* Entry Zone band */}
                <rect
                  x={paddingLeft}
                  y={entryTop}
                  width={plotWidth}
                  height={entryH}
                  fill="rgba(14, 165, 233, 0.18)"
                  stroke="#0EA5E9"
                  strokeWidth="1.2"
                  strokeDasharray="4 2"
                />
                <text
                  x={paddingLeft + 14}
                  y={entryTop - 4}
                  fill="#38BDF8"
                  fontSize="9.5"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  📥 نطاق الدخول [{setup.entryZone.min.toFixed(priceDecimals)} - {setup.entryZone.max.toFixed(priceDecimals)}]
                </text>
                <rect
                  x={chartWidth - paddingRight + 4}
                  y={entryTop - 2}
                  width="60"
                  height="16"
                  rx="3"
                  fill="#0369A1"
                  stroke="#38BDF8"
                  strokeWidth="0.8"
                />
                <text
                  x={chartWidth - paddingRight + 8}
                  y={entryTop + 10}
                  fill="#E0F2FE"
                  fontSize="9"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  دخول {setup.entryZone.min.toFixed(priceDecimals)}
                </text>

                {/* Stop Loss Line */}
                {yStop >= 0 && yStop <= mainHeight && (
                  <g key="setup-sl">
                    <line
                      x1={paddingLeft}
                      y1={yStop}
                      x2={chartWidth - paddingRight}
                      y2={yStop}
                      stroke="#EF4444"
                      strokeWidth="2.2"
                    />
                    <text
                      x={paddingLeft + 14}
                      y={yStop - 5}
                      fill="#EF4444"
                      fontSize="9.5"
                      fontFamily="JetBrains Mono"
                      fontWeight="bold"
                    >
                      🛑 وقف الخسارة SL ({setup.stopLoss.toFixed(priceDecimals)})
                    </text>
                    <rect
                      x={chartWidth - paddingRight + 4}
                      y={yStop - 8}
                      width="60"
                      height="16"
                      rx="3"
                      fill="#991B1B"
                      stroke="#F87171"
                      strokeWidth="0.8"
                    />
                    <text
                      x={chartWidth - paddingRight + 8}
                      y={yStop + 4}
                      fill="#FEE2E2"
                      fontSize="9"
                      fontFamily="JetBrains Mono"
                      fontWeight="bold"
                    >
                      SL {setup.stopLoss.toFixed(priceDecimals)}
                    </text>
                  </g>
                )}

                {/* Target Lines */}
                {setup.targets.map((targetPrice, idx) => {
                  const yTp = getY(targetPrice);
                  if (yTp < 0 || yTp > mainHeight) return null;
                  return (
                    <g key={`setup-tp-${idx}`}>
                      <line
                        x1={paddingLeft}
                        y1={yTp}
                        x2={chartWidth - paddingRight}
                        y2={yTp}
                        stroke="#10B981"
                        strokeWidth="2"
                        strokeDasharray="5 2"
                      />
                      <text
                        x={paddingLeft + 14}
                        y={yTp - 5}
                        fill="#10B981"
                        fontSize="9.5"
                        fontFamily="JetBrains Mono"
                        fontWeight="bold"
                      >
                        🎯 الهدف TP{idx + 1} ({targetPrice.toFixed(priceDecimals)})
                      </text>
                      <rect
                        x={chartWidth - paddingRight + 4}
                        y={yTp - 8}
                        width="60"
                        height="16"
                        rx="3"
                        fill="#065F46"
                        stroke="#34D399"
                        strokeWidth="0.8"
                      />
                      <text
                        x={chartWidth - paddingRight + 8}
                        y={yTp + 4}
                        fill="#D1FAE5"
                        fontSize="9"
                        fontFamily="JetBrains Mono"
                        fontWeight="bold"
                      >
                        TP{idx + 1} {targetPrice.toFixed(priceDecimals)}
                      </text>
                    </g>
                  );
                })}

                {/* On-Chart Trade Setup HUD Card */}
                <g key="setup-hud-card" className="pointer-events-none">
                  <rect
                    x={paddingLeft + 10}
                    y={10}
                    width={265}
                    height={70}
                    rx={7}
                    fill="rgba(11, 15, 25, 0.92)"
                    stroke={setup.bias === 'شراء' ? '#10B981' : '#EF4444'}
                    strokeWidth="1.4"
                  />
                  <text
                    x={paddingLeft + 20}
                    y={28}
                    fill={setup.bias === 'شراء' ? '#34D399' : '#F87171'}
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="Tajawal, sans-serif"
                  >
                    🎯 صفقة التقرير: {setup.bias === 'شراء' ? 'شراء (BUY / LONG) 🟢' : 'بيع (SELL / SHORT) 🔴'}
                  </text>
                  <text
                    x={paddingLeft + 20}
                    y={46}
                    fill="#94A3B8"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    الدخول: <tspan fill="#38BDF8" fontWeight="bold">{setup.entryZone.min.toFixed(priceDecimals)}</tspan> · الوقف: <tspan fill="#F87171" fontWeight="bold">{setup.stopLoss.toFixed(priceDecimals)}</tspan>
                  </text>
                  <text
                    x={paddingLeft + 20}
                    y={64}
                    fill="#94A3B8"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    الهدف 1: <tspan fill="#34D399" fontWeight="bold">{setup.targets[0]?.toFixed(priceDecimals)}</tspan> · R:R: <tspan fill="#FBBF24" fontWeight="bold">1:{setup.riskRewardRatio}</tspan>
                  </text>
                </g>
              </g>
            );
          })()}

          {/* On-Chart Inactive / Neutral Setup Notice Overlay */}
          {showIndicators.tradeSetup && report?.tradeSetup && !report.tradeSetup.hasSetup && (
            <g key="setup-hud-neutral" className="pointer-events-none">
              <rect
                x={paddingLeft + 10}
                y={10}
                width={360}
                height={54}
                rx={7}
                fill="rgba(15, 23, 42, 0.94)"
                stroke="#64748B"
                strokeWidth="1.2"
              />
              <text
                x={paddingLeft + 20}
                y={28}
                fill="#FCD34D"
                fontSize="11"
                fontWeight="bold"
                fontFamily="Tajawal, sans-serif"
              >
                ⚪ صفقة التقرير: حياد / مراقبة (لا توجد إشارة شراء أو بيع حالياً)
              </text>
              <text
                x={paddingLeft + 20}
                y={46}
                fill="#CBD5E1"
                fontSize="9.5"
                fontFamily="Tajawal, sans-serif"
              >
                {report.tradeSetup.reasoning.length > 55
                  ? report.tradeSetup.reasoning.slice(0, 55) + '...'
                  : report.tradeSetup.reasoning}
              </text>
            </g>
          )}

          {/* On-Chart Pending Analysis Overlay */}
          {showIndicators.tradeSetup && !report && (
            <g key="setup-hud-noreport" className="pointer-events-none">
              <rect
                x={paddingLeft + 10}
                y={10}
                width={280}
                height={48}
                rx={7}
                fill="rgba(15, 23, 42, 0.94)"
                stroke="#475569"
                strokeWidth="1.2"
              />
              <text
                x={paddingLeft + 20}
                y={28}
                fill="#94A3B8"
                fontSize="11"
                fontWeight="bold"
                fontFamily="Tajawal, sans-serif"
              >
                🎯 صفقة التقرير: بانتظار تشغيل التحليل
              </text>
              <text
                x={paddingLeft + 20}
                y={44}
                fill="#64748B"
                fontSize="9.5"
                fontFamily="Tajawal, sans-serif"
              >
                انقر على زر «تحليل شامل» لحساب مستويات الصفقة
              </text>
            </g>
          )}

          {/* EMA Lines */}
          {showIndicators.ema && (
            <>
              {/* EMA 20 (Amber) */}
              <path
                d={buildLinePath(displayEma20, getY)}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* EMA 50 (Blue) */}
              <path
                d={buildLinePath(displayEma50, getY)}
                fill="none"
                stroke="#0EA5E9"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* EMA 200 (Purple) */}
              <path
                d={buildLinePath(displayEma200, getY)}
                fill="none"
                stroke="#A855F7"
                strokeWidth="1.8"
                strokeDasharray="3 3"
              />
            </>
          )}

          {/* Candlesticks rendering */}
          {displayCandles.map((c, i) => {
            const x = getX(i);
            const isBull = c.close >= c.open;
            const yHigh = getY(c.high);
            const yLow = getY(c.low);
            const yOpen = getY(c.open);
            const yClose = getY(c.close);

            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

            const isHovered = hoverIndex === i;

            return (
              <g key={`candle-${c.time}-${i}`}>
                {/* Candle Wick */}
                <line
                  x1={x}
                  y1={yHigh}
                  x2={x}
                  y2={yLow}
                  stroke={isBull ? '#10B981' : '#EF4444'}
                  strokeWidth="1.2"
                />
                {/* Candle Body */}
                <rect
                  x={x - barWidth / 2}
                  y={bodyTop}
                  width={barWidth}
                  height={bodyHeight}
                  rx="1.5"
                  fill={isBull ? 'url(#bullCandleGrad)' : 'url(#bearCandleGrad)'}
                  stroke={isHovered ? '#ffffff' : 'none'}
                  strokeWidth={isHovered ? '1.5' : '0'}
                />
              </g>
            );
          })}

          {/* Interactive Crosshair */}
          {hoverIndex !== null && displayCandles[hoverIndex] && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={0}
                x2={getX(hoverIndex)}
                y2={mainHeight}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <line
                x1={paddingLeft}
                y1={getY(displayCandles[hoverIndex].close)}
                x2={chartWidth - paddingRight}
                y2={getY(displayCandles[hoverIndex].close)}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <rect
                x={chartWidth - paddingRight + 4}
                y={getY(displayCandles[hoverIndex].close) - 9}
                width="56"
                height="18"
                rx="3"
                fill="#3b82f6"
              />
              <text
                x={chartWidth - paddingRight + 8}
                y={getY(displayCandles[hoverIndex].close) + 4}
                fill="#ffffff"
                fontSize="10"
                fontFamily="JetBrains Mono"
                fontWeight="bold"
              >
                {displayCandles[hoverIndex].close.toFixed(2)}
              </text>
            </g>
          )}
        </svg>

        {/* Legend Indicator Tags */}
        <div className="absolute top-2 left-3 flex items-center gap-3 text-[11px] font-mono pointer-events-none bg-slate-900/70 backdrop-blur-sm px-2.5 py-1 rounded border border-slate-800">
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2.5 h-0.5 bg-amber-400 inline-block"></span> EMA 20
          </span>
          <span className="flex items-center gap-1.5 text-sky-400">
            <span className="w-2.5 h-0.5 bg-sky-400 inline-block"></span> EMA 50
          </span>
          <span className="flex items-center gap-1.5 text-purple-400">
            <span className="w-2.5 h-0.5 bg-purple-400 inline-block"></span> EMA 200
          </span>
        </div>
      </div>

      {/* Sub-Pane 1: RSI (Relative Strength Index) */}
      {showIndicators.rsi && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs pb-1">
            <span className="font-semibold text-purple-300 font-mono">مؤشر القوة النسبية RSI (14)</span>
            <span className="font-mono text-purple-200">
              {hoverIndex !== null && displayRsi[hoverIndex] !== null
                ? displayRsi[hoverIndex]?.toFixed(2)
                : displayRsi[displayRsi.length - 1]?.toFixed(2) ?? '-'}
            </span>
          </div>
          <svg viewBox={`0 0 ${chartWidth} ${rsiHeight}`} className="w-full h-auto bg-[#0a0e17] rounded">
            {/* 70 & 30 threshold lines */}
            <line x1={paddingLeft} y1={getRsiY(70)} x2={chartWidth - paddingRight} y2={getRsiY(70)} stroke="#ef4444" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />
            <text x={chartWidth - paddingRight + 6} y={getRsiY(70) + 3} fill="#ef4444" fontSize="9" fontFamily="JetBrains Mono">70</text>

            <line x1={paddingLeft} y1={getRsiY(30)} x2={chartWidth - paddingRight} y2={getRsiY(30)} stroke="#10b981" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />
            <text x={chartWidth - paddingRight + 6} y={getRsiY(30) + 3} fill="#10b981" fontSize="9" fontFamily="JetBrains Mono">30</text>

            {/* Middle 50 line */}
            <line x1={paddingLeft} y1={getRsiY(50)} x2={chartWidth - paddingRight} y2={getRsiY(50)} stroke="#334155" strokeDasharray="2 2" strokeWidth="1" />

            {/* RSI curve */}
            <path d={buildLinePath(displayRsi, getRsiY)} fill="none" stroke="#a855f7" strokeWidth="1.8" />
          </svg>
        </div>
      )}

      {/* Sub-Pane 2: MACD */}
      {showIndicators.macd && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs pb-1">
            <span className="font-semibold text-blue-300 font-mono">مؤشر الماكد MACD (12, 26, 9)</span>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-blue-400">MACD: {displayMacd.macd[displayMacd.macd.length - 1]?.toFixed(2) ?? '-'}</span>
              <span className="text-amber-400">Signal: {displayMacd.signal[displayMacd.signal.length - 1]?.toFixed(2) ?? '-'}</span>
            </div>
          </div>
          <svg viewBox={`0 0 ${chartWidth} ${macdHeight}`} className="w-full h-auto bg-[#0a0e17] rounded">
            {/* Zero Axis */}
            <line x1={paddingLeft} y1={macdHeight / 2} x2={chartWidth - paddingRight} y2={macdHeight / 2} stroke="#334155" strokeWidth="1" />

            {/* Histogram Bars */}
            {displayMacd.hist.map((h, idx) => {
              if (h === null) return null;
              const x = getX(idx);
              const yZero = macdHeight / 2;
              const yVal = getMacdY(h);
              const top = Math.min(yZero, yVal);
              const height = Math.abs(yZero - yVal);
              const isPositive = h >= 0;

              return (
                <rect
                  key={`hist-${idx}`}
                  x={x - barWidth / 3}
                  y={top}
                  width={barWidth * 0.66}
                  height={Math.max(1, height)}
                  fill={isPositive ? '#10b981' : '#ef4444'}
                  opacity="0.8"
                />
              );
            })}

            {/* MACD Line */}
            <path d={buildLinePath(displayMacd.macd, getMacdY)} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
            {/* Signal Line */}
            <path d={buildLinePath(displayMacd.signal, getMacdY)} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
          </svg>
        </div>
      )}

      {/* Sub-Pane 3: Stochastic Oscillator (%K, %D) */}
      {showIndicators.stochastic && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs pb-1">
            <span className="font-semibold text-amber-300 font-mono flex items-center gap-2">
              <span>مؤشر الاستوكاستك Stochastic (14, 3, 3)</span>
              <span className="text-[10px] text-slate-400">
                {displayStochastic.k[displayStochastic.k.length - 1] !== null && (displayStochastic.k[displayStochastic.k.length - 1]! >= 80 ? '(ذروة شراء 🔴)' : displayStochastic.k[displayStochastic.k.length - 1]! <= 20 ? '(ذروة بيع 🟢)' : '(منطقة معتدلة)')}
              </span>
            </span>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-amber-400 font-bold">
                %K: {hoverIndex !== null && displayStochastic.k[hoverIndex] !== null
                  ? displayStochastic.k[hoverIndex]?.toFixed(2)
                  : displayStochastic.k[displayStochastic.k.length - 1]?.toFixed(2) ?? '-'}
              </span>
              <span className="text-cyan-400 font-bold">
                %D: {hoverIndex !== null && displayStochastic.d[hoverIndex] !== null
                  ? displayStochastic.d[hoverIndex]?.toFixed(2)
                  : displayStochastic.d[displayStochastic.d.length - 1]?.toFixed(2) ?? '-'}
              </span>
            </div>
          </div>
          <svg viewBox={`0 0 ${chartWidth} ${stochHeight}`} className="w-full h-auto bg-[#0a0e17] rounded">
            {/* 80 & 20 threshold lines */}
            <line x1={paddingLeft} y1={getStochY(80)} x2={chartWidth - paddingRight} y2={getStochY(80)} stroke="#ef4444" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />
            <text x={chartWidth - paddingRight + 6} y={getStochY(80) + 3} fill="#ef4444" fontSize="9" fontFamily="JetBrains Mono">80</text>

            <line x1={paddingLeft} y1={getStochY(20)} x2={chartWidth - paddingRight} y2={getStochY(20)} stroke="#10b981" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />
            <text x={chartWidth - paddingRight + 6} y={getStochY(20) + 3} fill="#10b981" fontSize="9" fontFamily="JetBrains Mono">20</text>

            {/* Middle 50 line */}
            <line x1={paddingLeft} y1={getStochY(50)} x2={chartWidth - paddingRight} y2={getStochY(50)} stroke="#334155" strokeDasharray="2 2" strokeWidth="1" />

            {/* %K line (amber) */}
            <path d={buildLinePath(displayStochastic.k, getStochY)} fill="none" stroke="#f59e0b" strokeWidth="1.8" />
            {/* %D line (cyan) */}
            <path d={buildLinePath(displayStochastic.d, getStochY)} fill="none" stroke="#06b6d4" strokeWidth="1.6" />
          </svg>
        </div>
      )}
    </div>
  );
};
