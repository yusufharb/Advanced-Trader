/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Candle, BacktestResult } from '../types/market.ts';
import { StrategyType, runBacktest } from '../services/backtesting/backtest-engine.ts';
import { Play, TrendingUp, AlertTriangle, Scale, CheckCircle2, RefreshCw } from 'lucide-react';

interface BacktestPanelProps {
  candles: Candle[];
  symbol: string;
}

export const BacktestPanel: React.FC<BacktestPanelProps> = ({ candles, symbol }) => {
  const [strategy, setStrategy] = useState<StrategyType>('EMA_Cross_Trend');
  const [inSampleRatio, setInSampleRatio] = useState<number>(0.70);
  const [riskRewardTarget, setRiskRewardTarget] = useState<number>(2.0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const handleRunBacktest = async () => {
    if (candles.length < 50) return;
    setIsRunning(true);
    try {
      let backtestResult: BacktestResult | null = null;
      try {
        const res = await fetch('/api/technical/backtest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candles,
            strategy,
            inSampleRatio,
            riskRewardTarget,
            slippageAndCommissionPercent: 0.05,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.result) {
            backtestResult = data.result;
          }
        }
      } catch {
        // Fallback to client-side backtesting engine
      }

      if (!backtestResult) {
        backtestResult = runBacktest(candles, {
          strategy,
          inSampleRatio,
          riskRewardTarget,
          slippageAndCommissionPercent: 0.05,
        });
      }

      setResult(backtestResult);
    } catch (err: any) {
      console.error(err);
      alert(`خطأ أثناء تشغيل الاختبار: ${err.message || err}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d121f] p-5 text-slate-200 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <span>الاختبار التاريخي وتقييم الاستراتيجيات (Backtesting Engine)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            محاكاة رياضية خالية من تسرب البيانات المستقبلية (Look-Ahead Bias) مع فصل العينات خارج العينة (Out-of-Sample).
          </p>
        </div>

        <button
          onClick={handleRunBacktest}
          disabled={isRunning || candles.length < 50}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-lg ${
            candles.length >= 50 && !isRunning
              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer shadow-amber-500/20'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جاري المحاكاة...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>تشغيل الاختبار التاريخي ({candles.length} شمعة)</span>
            </>
          )}
        </button>
      </div>

      {/* Configuration Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Strategy Selector */}
        <div className="bg-[#111827] p-3 rounded-lg border border-slate-800 space-y-1.5">
          <label className="text-slate-400 block font-semibold">استراتيجية التداول:</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as StrategyType)}
            className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
          >
            <option value="EMA_Cross_Trend">تقاطع المتوسطات EMA 20/50 مع تأكيد RSI</option>
            <option value="PriceAction_Breakout">اختراق نطاقات القمم والقيعان مع وقف ATR</option>
            <option value="RSI_MeanReversion">ارتداد التشبع لمؤشر RSI (Mean Reversion)</option>
          </select>
        </div>

        {/* Train/Test Split */}
        <div className="bg-[#111827] p-3 rounded-lg border border-slate-800 space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span className="font-semibold">تقسيم العينة (In/Out Sample):</span>
            <span className="font-mono text-amber-400 font-bold">{(inSampleRatio * 100).toFixed(0)}% / {((1 - inSampleRatio) * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.50"
            max="0.85"
            step="0.05"
            value={inSampleRatio}
            onChange={(e) => setInSampleRatio(parseFloat(e.target.value))}
            className="w-full accent-amber-500"
          />
          <span className="text-[10px] text-slate-500 block">
            فصل البيانات لمنع فرط التخصيص (Curve Fitting) واختبار كفاءة النموذج.
          </span>
        </div>

        {/* Target Risk:Reward */}
        <div className="bg-[#111827] p-3 rounded-lg border border-slate-800 space-y-1.5">
          <label className="text-slate-400 block font-semibold">نسبة الهدف إلى المخاطرة (R:R):</label>
          <select
            value={riskRewardTarget}
            onChange={(e) => setRiskRewardTarget(parseFloat(e.target.value))}
            className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
          >
            <option value="1.5">1 : 1.5</option>
            <option value="2.0">1 : 2.0 (المعيار المتوازن)</option>
            <option value="2.5">1 : 2.5</option>
            <option value="3.0">1 : 3.0</option>
          </select>
        </div>
      </div>

      {/* Results Display */}
      {result && (
        <div className="space-y-4 pt-2">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">إجمالي الصفقات</span>
              <strong className="text-base font-bold text-white font-mono">{result.totalTrades}</strong>
            </div>

            <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">نسبة النجاح (Win Rate)</span>
              <strong className={`text-base font-bold font-mono ${result.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {result.winRate}%
              </strong>
            </div>

            <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">معامل الربح (Profit Factor)</span>
              <strong className={`text-base font-bold font-mono ${result.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-slate-200'}`}>
                {result.profitFactor}
              </strong>
            </div>

            <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">التوقع الرياضي (Expectancy)</span>
              <strong className={`text-base font-bold font-mono ${result.expectancyPercent > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.expectancyPercent > 0 ? `+${result.expectancyPercent}%` : `${result.expectancyPercent}%`}
              </strong>
            </div>

            <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">أقصى تراجع (Max Drawdown)</span>
              <strong className="text-base font-bold text-rose-400 font-mono">
                {result.maxDrawdownPercent}%
              </strong>
            </div>
          </div>

          {/* In-Sample vs Out-of-Sample Comparison Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-200 mb-2">
              <Scale className="w-4 h-4 text-amber-400" />
              <span>مقارنة العينة التدريبية (In-Sample) مقابل العينة الحقيقية خارج العينة (Out-of-Sample):</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded bg-[#111827] border border-slate-800/80 flex items-center justify-between">
                <span>داخل العينة ({result.inSampleTrades} صفقة):</span>
                <strong className={`font-mono ${result.inSampleReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {result.inSampleReturn > 0 ? `+${result.inSampleReturn}%` : `${result.inSampleReturn}%`}
                </strong>
              </div>

              <div className="p-3 rounded bg-[#111827] border border-slate-800/80 flex items-center justify-between">
                <span>خارج العينة ({result.outOfSampleTrades} صفقة):</span>
                <strong className={`font-mono font-bold ${result.outOfSampleReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {result.outOfSampleReturn > 0 ? `+${result.outOfSampleReturn}%` : `${result.outOfSampleReturn}%`}
                </strong>
              </div>
            </div>
          </div>

          {/* Recent Trades Table */}
          {result.trades.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 block">سجل الصفقات المنفذة الأخيرة:</span>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#111827] text-slate-400 text-[11px] font-mono">
                    <tr>
                      <th className="p-2.5">النوع</th>
                      <th className="p-2.5">سعر الدخول</th>
                      <th className="p-2.5">سعر الخروج</th>
                      <th className="p-2.5">سبب الإغلاق</th>
                      <th className="p-2.5">الربح / الخسارة (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                    {result.trades.slice(-8).map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.type === 'buy' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                            {t.type === 'buy' ? 'شراء' : 'بيع'}
                          </span>
                        </td>
                        <td className="p-2.5">{t.entryPrice.toFixed(2)}</td>
                        <td className="p-2.5">{t.exitPrice.toFixed(2)}</td>
                        <td className="p-2.5">
                          <span className={t.reason === 'TP' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {t.reason === 'TP' ? 'هدف (TP)' : 'وقف (SL)'}
                          </span>
                        </td>
                        <td className={`p-2.5 font-bold ${t.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.pnlPercent > 0 ? `+${t.pnlPercent}%` : `${t.pnlPercent}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
