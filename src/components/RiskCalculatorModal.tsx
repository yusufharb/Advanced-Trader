/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MarketSymbol, TradeSetup } from '../types/market.ts';
import { roundPrice } from '../services/quantitative-engine.ts';
import { isForexPairSymbol, inferAssetMetadata } from '../services/market/custom-assets.ts';
import {
  Calculator,
  Shield,
  TrendingUp,
  AlertCircle,
  Copy,
  Check,
  X,
  DollarSign,
  Percent,
  Sliders,
  Award,
} from 'lucide-react';

interface RiskCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: MarketSymbol;
  currentPrice: number;
  tradeSetup?: TradeSetup | null;
  initialSetup?: TradeSetup | null;
}

export const RiskCalculatorModal: React.FC<RiskCalculatorModalProps> = ({
  isOpen,
  onClose,
  symbol,
  currentPrice,
  tradeSetup,
  initialSetup,
}) => {
  const activeSetup = tradeSetup || initialSetup;

  // Account settings
  const [accountBalance, setAccountBalance] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1.5); // 1.5%
  
  // Trade setup inputs
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [entryPrice, setEntryPrice] = useState<number>(currentPrice || 2000);
  const [stopLoss, setStopLoss] = useState<number>(0);
  const [target1, setTarget1] = useState<number>(0);
  const [target2, setTarget2] = useState<number>(0);

  const [copied, setCopied] = useState<boolean>(false);

  // Sync when activeSetup or currentPrice changes
  useEffect(() => {
    if (activeSetup && activeSetup.hasSetup) {
      setTradeType(activeSetup.bias === 'بيع' ? 'SELL' : 'BUY');
      const avgEntry = activeSetup.entryZone
        ? roundPrice((activeSetup.entryZone.min + activeSetup.entryZone.max) / 2, currentPrice)
        : currentPrice;
      setEntryPrice(avgEntry || currentPrice);
      setStopLoss(activeSetup.stopLoss);
      setTarget1(activeSetup.targets?.[0] || 0);
      setTarget2(activeSetup.targets?.[1] || 0);
    } else if (currentPrice > 0) {
      setEntryPrice(currentPrice);
      const isForex = isForexPairSymbol(symbol);
      const offsetRatio = symbol === 'XAUUSD' || isForex ? 0.006 : 0.015;
      const offset = currentPrice * offsetRatio;
      setStopLoss(roundPrice(currentPrice - offset, currentPrice));
      setTarget1(roundPrice(currentPrice + offset * 1.8, currentPrice));
      setTarget2(roundPrice(currentPrice + offset * 3.2, currentPrice));
    }
  }, [initialSetup, activeSetup, currentPrice, symbol]);

  if (!isOpen) return null;

  // Quantitative Calculations
  const riskAmountUsd = (accountBalance * riskPercent) / 100;
  const slDistance = Math.abs(entryPrice - stopLoss);
  const slDistancePercent = entryPrice > 0 ? (slDistance / entryPrice) * 100 : 0;

  const isForex = isForexPairSymbol(symbol);
  const assetMeta = inferAssetMetadata(symbol, currentPrice);
  const isJpyPair = isForex && symbol.replace('=X', '').endsWith('JPY');

  // Lot size / Position size calculation
  let calculatedPositionSize = 0;
  let positionSizeUnit = '';

  if (slDistance > 0) {
    if (symbol === 'XAUUSD') {
      // Gold: 1 Standard Lot = 100 oz
      const lossPerLot = 100 * slDistance;
      calculatedPositionSize = lossPerLot > 0 ? riskAmountUsd / lossPerLot : 0;
      positionSizeUnit = 'عقد ذهب قياسي (Lots)';
    } else if (symbol === 'XAGUSD') {
      // Silver: 1 Standard Lot = 5,000 oz
      const lossPerLot = 5000 * slDistance;
      calculatedPositionSize = lossPerLot > 0 ? riskAmountUsd / lossPerLot : 0;
      positionSizeUnit = 'عقد فضة قياسي (Lots)';
    } else if (isForex) {
      // Forex Majors & Crosses: 1 Standard Lot = 100,000 base currency units
      let pipValuePerLot = 10;
      let pipSize = 0.0001;
      if (isJpyPair) {
        pipSize = 0.01;
        pipValuePerLot = currentPrice > 0 ? (1000 / currentPrice) * 10 : 7;
      }
      const pipsAtRisk = slDistance / pipSize;
      const totalLossPerLot = pipsAtRisk * pipValuePerLot;
      calculatedPositionSize = totalLossPerLot > 0 ? riskAmountUsd / totalLossPerLot : 0;
      positionSizeUnit = 'عقد فوركس قياسي (Lots)';
    } else if (assetMeta.category === 'stock') {
      calculatedPositionSize = riskAmountUsd / slDistance;
      positionSizeUnit = `سهم (${symbol})`;
    } else if (assetMeta.category === 'index') {
      calculatedPositionSize = riskAmountUsd / slDistance;
      positionSizeUnit = `عقد مؤشر (${symbol})`;
    } else {
      // Crypto & Commodities
      calculatedPositionSize = riskAmountUsd / slDistance;
      positionSizeUnit = `وحدة (${symbol.replace('USDT', '')})`;
    }
  }

  // Targets reward calculations
  const multiplier =
    symbol === 'XAUUSD'
      ? 100
      : symbol === 'XAGUSD'
      ? 5000
      : isForex
      ? 100000
      : 1;

  const tp1Distance = Math.abs(target1 - entryPrice);
  const tp1RewardUsd = multiplier === 100000
    ? calculatedPositionSize * (tp1Distance / (isJpyPair ? 0.01 : 0.0001)) * 10
    : calculatedPositionSize * multiplier * tp1Distance;
  const tp1RrRatio = slDistance > 0 ? tp1Distance / slDistance : 0;

  const tp2Distance = target2 > 0 ? Math.abs(target2 - entryPrice) : 0;
  const tp2RewardUsd = target2 > 0
    ? (multiplier === 100000
        ? calculatedPositionSize * (tp2Distance / (isJpyPair ? 0.01 : 0.0001)) * 10
        : calculatedPositionSize * multiplier * tp2Distance)
    : 0;
  const tp2RrRatio = target2 > 0 && slDistance > 0 ? tp2Distance / slDistance : 0;

  // Quality of risk assessment
  const isHealthyRr = tp1RrRatio >= 1.5;
  const isSafeRisk = riskPercent <= 2.5;

  const handleCopySummary = () => {
    const text = `
🎯 خطة إدارة المخاطر والصفقة – ${symbol}
━━━━━━━━━━━━━━━━━━
• النوع: ${tradeType === 'BUY' ? 'شراء (LONG) 🟢' : 'بيع (SHORT) 🔴'}
• سعر الدخول المقترح: ${entryPrice.toLocaleString()} USD
• وقف الخسارة (SL): ${stopLoss.toLocaleString()} USD (مخاطرة ${slDistancePercent.toFixed(2)}%)
• الهدف الأول (TP1): ${target1.toLocaleString()} USD (R:R = 1:${tp1RrRatio.toFixed(2)})
${target2 > 0 ? `• الهدف الثاني (TP2): ${target2.toLocaleString()} USD (R:R = 1:${tp2RrRatio.toFixed(2)})\n` : ''}
━━━━━━━━━━━━━━━━━━
💼 إدارة رأس المال:
• حجم الحساب: $${accountBalance.toLocaleString()}
• نسبة المخاطرة: ${riskPercent}% ($${riskAmountUsd.toFixed(2)})
• حجم العقد المحسوب: ${calculatedPositionSize.toFixed(symbol === 'XAUUSD' ? 2 : 4)} ${positionSizeUnit}
• الربح المتوقع للهدف الأول: +$${tp1RewardUsd.toFixed(2)}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-[#0B0F19] p-6 text-slate-100 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>حاسبة إدارة المخاطر وتحديد حجم العقد</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">
                  {symbol}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                حساب رياضي كمي دقيق لحجم اللوت والمخاطرة المالية قبل فتح الصفقة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Account & Risk Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              <span>رأس مال المحفظة (USD)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="100"
                step="500"
                value={accountBalance}
                onChange={(e) => setAccountBalance(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
              />
              <span className="absolute left-3 top-2 text-xs font-mono text-slate-500">$</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-amber-400" />
              <span>نسبة المخاطرة القصوى للصفقة</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.5"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Math.max(0.1, Number(e.target.value)))}
                className="w-24 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
              />
              <div className="flex gap-1">
                {[1, 1.5, 2, 3].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setRiskPercent(pct)}
                    className={`px-2 py-1 text-xs rounded font-mono cursor-pointer transition ${
                      riskPercent === pct
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-400 mt-1 block">
              قيمة المخاطرة المسموحة: <strong className="text-amber-400">${riskAmountUsd.toFixed(2)}</strong>
            </span>
          </div>
        </div>

        {/* Section 2: Trade Entry & Level Inputs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">محددات الصفقة وأسعار الدخول:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTradeType('BUY')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  tradeType === 'BUY'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                شراء (BUY / LONG)
              </button>
              <button
                type="button"
                onClick={() => setTradeType('SELL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  tradeType === 'SELL'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                بيع (SELL / SHORT)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">سعر الدخول (Entry)</label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-rose-400 mb-1">وقف الخسارة (SL)</label>
              <input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-rose-800/80 text-rose-200 font-mono text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-emerald-400 mb-1">الهدف الأول (TP1)</label>
              <input
                type="number"
                step="any"
                value={target1}
                onChange={(e) => setTarget1(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-emerald-800/80 text-emerald-200 font-mono text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-sky-400 mb-1">الهدف الثاني (TP2)</label>
              <input
                type="number"
                step="any"
                value={target2}
                onChange={(e) => setTarget2(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-sky-800/80 text-sky-200 font-mono text-xs focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Calculation Results Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Position Size */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 text-right space-y-1">
            <span className="text-[11px] font-semibold text-amber-300 block">
              حجم العقد الموصى به (Position Size)
            </span>
            <div className="text-2xl font-black font-mono text-amber-400">
              {calculatedPositionSize > 0
                ? calculatedPositionSize.toFixed(symbol === 'XAUUSD' ? 2 : 4)
                : '0.00'}
            </div>
            <span className="text-[10px] text-slate-400 font-mono block">
              {positionSizeUnit}
            </span>
          </div>

          {/* Card 2: Risk to Reward Ratio */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-right space-y-1">
            <span className="text-[11px] font-semibold text-slate-300 block">
              نسبة العائد إلى المخاطرة (R:R)
            </span>
            <div className={`text-2xl font-black font-mono ${isHealthyRr ? 'text-emerald-400' : 'text-amber-400'}`}>
              1 : {tp1RrRatio.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400 font-mono block">
              {isHealthyRr ? '✓ نسبة ربح/خسارة مجزية مؤسسياً' : '⚠ العائد أقل من 1:1.5'}
            </span>
          </div>

          {/* Card 3: Expected Reward */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-right space-y-1">
            <span className="text-[11px] font-semibold text-emerald-300 block">
              الربح المتوقع عند الهدف الأول
            </span>
            <div className="text-2xl font-black font-mono text-emerald-400">
              +${tp1RewardUsd.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400 font-mono block">
              مقابل مخاطرة ${riskAmountUsd.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Section 4: Institutional Risk Rule Feedback */}
        <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center gap-2">
            <Shield className={`w-4 h-4 shrink-0 ${isSafeRisk ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className="font-bold text-slate-200">معايير حماية رأس المال الصارمة:</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            وفقاً لقواعد إدارة المخاطر المتقدمة، يُوصى بعدم تجاوز نسبة المخاطرة <strong>2%</strong> في أي صفقة منفردة،
            مع الالتزام بالخروج الفوري عند ضرب وقف الخسارة لحماية المحفظة من التراجعات الحادة (Drawdowns).
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-slate-700 transition cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم نسخ خطة الصفقة!' : 'نسخ ملخص الصفقة للحافظة'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer"
          >
            إغلاق الحاسبة
          </button>
        </div>
      </div>
    </div>
  );
};
