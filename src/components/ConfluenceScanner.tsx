/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MarketSymbol, TimeFrame, Candle, TechnicalReport } from '../types/market.ts';
import { Layers, TrendingUp, TrendingDown, Minus, ShieldCheck } from 'lucide-react';

export interface ConfluenceScannerProps {
  symbol: MarketSymbol;
  currentTimeframe: TimeFrame;
  report: TechnicalReport | null;
  candles?: Candle[];
  currentCandles?: Candle[];
}

export const ConfluenceScanner: React.FC<ConfluenceScannerProps> = ({
  symbol,
  report,
  candles,
  currentCandles,
}) => {
  const candleList = currentCandles || candles || [];
  if (!report || candleList.length < 15) return null;

  // Derive quantitative signals from the current data
  const { indicators, schools, tradeSetup } = report;
  const rsiVal = indicators.rsi?.value ?? 50;
  const ema20 = indicators.ema?.ema20 ?? null;
  const ema50 = indicators.ema?.ema50 ?? null;
  const ema200 = indicators.ema?.ema200 ?? null;
  const latestPrice = candleList[candleList.length - 1].close;

  // Trend stack
  const isEmaBullishStack = ema20 !== null && ema50 !== null && ema200 !== null ? (ema20 > ema50 && ema50 > ema200) : false;
  const isEmaBearishStack = ema20 !== null && ema50 !== null && ema200 !== null ? (ema20 < ema50 && ema50 < ema200) : false;
  const isAboveEma200 = ema200 !== null ? latestPrice > ema200 : true;

  // Schools agreement
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  // Check classical
  if (schools.classical.trend === 'صاعد') bullishCount++;
  else if (schools.classical.trend === 'هابط') bearishCount++;
  else neutralCount++;

  // Check price action
  if (schools.priceAction.marketStructure.includes('صاعد')) bullishCount++;
  else if (schools.priceAction.marketStructure.includes('هابط')) bearishCount++;
  else neutralCount++;

  // Check MACD
  if (indicators.macd.trend === 'bullish') bullishCount++;
  else if (indicators.macd.trend === 'bearish') bearishCount++;
  else neutralCount++;

  // Check Harmonic
  const harmonicBias = schools.harmonic.detectedPatterns.some(p => p.type === 'bullish') ? 'bullish' :
                       schools.harmonic.detectedPatterns.some(p => p.type === 'bearish') ? 'bearish' : 'neutral';
  if (harmonicBias === 'bullish') bullishCount++;
  else if (harmonicBias === 'bearish') bearishCount++;
  else neutralCount++;

  // Check Trade Setup
  if (tradeSetup.bias === 'شراء') bullishCount++;
  else if (tradeSetup.bias === 'بيع') bearishCount++;
  else neutralCount++;

  const totalFactors = 5;
  const dominantDirection = bullishCount >= 3 ? 'صاعد قوي (Bullish)' : bearishCount >= 3 ? 'هابط قوي (Bearish)' : 'مختلط / حيادي (Range)';
  const confluencePercent = Math.round((Math.max(bullishCount, bearishCount) / totalFactors) * 100);

  // Higher timeframe / macro bias
  const htfBias = isAboveEma200 ? 'صاعد (أعلى EMA 200)' : 'هابط (أسفل EMA 200)';

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0d121f] p-4 md:p-5 text-slate-200 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>ماسح التوافق والزخم المؤسسي (Trend Confluence)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                {symbol}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              قياس درجة التوافق بين اتجاه السعر، ترتيب المتوسطات، والمؤشرات الكمية
            </p>
          </div>
        </div>

        {/* Confluence Badge */}
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">معدل التوافق:</span>
          <span className={`text-sm font-black font-mono ${
            confluencePercent >= 60 ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {confluencePercent}%
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
            confluencePercent >= 60 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
          }`}>
            {confluencePercent >= 60 ? 'توافق قوي' : 'تشتت نسبي'}
          </span>
        </div>
      </div>

      {/* Grid of Confluence Dimensions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Metric 1: EMA Structure */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-400 block font-mono">هيكل المتوسطات (EMA Stack)</span>
          <div className="flex items-center gap-1.5 font-bold">
            {isEmaBullishStack ? (
              <>
                <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-emerald-300">ترتيب صاعد مثالي</span>
              </>
            ) : isEmaBearishStack ? (
              <>
                <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-rose-300">ترتيب هابط مثالي</span>
              </>
            ) : (
              <>
                <Minus className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-amber-300">تداخل في المتوسطات</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-mono block">
            {isAboveEma200 ? 'السعر أعلى EMA 200' : 'السعر أسفل EMA 200'}
          </span>
        </div>

        {/* Metric 2: Momentum / RSI */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-400 block font-mono">الزخم النسبي RSI (14)</span>
          <div className="flex items-center gap-1.5 font-bold">
            <span className="font-mono text-white text-sm">{rsiVal.toFixed(1)}</span>
            <span className={`text-[11px] ${
              rsiVal > 70 ? 'text-rose-400' : rsiVal < 30 ? 'text-emerald-400' : 'text-slate-300'
            }`}>
              {rsiVal > 70 ? '(ذروة شراء)' : rsiVal < 30 ? '(ذروة بيع)' : '(منطقة معتدلة)'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block">
            {rsiVal > 50 ? 'الزخم يميل للمشترين' : 'الزخم يميل للبائعين'}
          </span>
        </div>

        {/* Metric 3: Schools Alignment */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-400 block font-mono">إجماع المحاور الفنية</span>
          <div className="flex items-center gap-2 font-bold text-slate-200">
            <span className="text-emerald-400 font-mono">🟢 {bullishCount}</span>
            <span className="text-rose-400 font-mono">🔴 {bearishCount}</span>
            <span className="text-slate-400 font-mono">⚪ {neutralCount}</span>
          </div>
          <span className="text-[10px] text-amber-400 font-medium block truncate">
            {dominantDirection}
          </span>
        </div>

        {/* Metric 4: Institutional Advice */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-400 block font-mono">فلتر الأمان المؤسسي</span>
          <div className="flex items-center gap-1.5 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-300">جاهز للتنفيذ</span>
          </div>
          <span className="text-[10px] text-slate-400 block truncate font-mono">
            {htfBias}
          </span>
        </div>
      </div>
    </div>
  );
};
