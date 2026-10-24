/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MarketSymbol, TimeFrame, AssetConfig } from '../types/market.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { UniversalSymbolSearch } from './UniversalSymbolSearch.tsx';
import { getCustomWatchedAssets, inferAssetMetadata } from '../services/market/custom-assets.ts';
import { Sparkles, RefreshCw, BarChart2, FileText, Activity, Bell, Calculator, Layers, Globe, Smartphone, Send } from 'lucide-react';
import { SUPPORTED_ASSETS } from '../types/market.ts';

export type AppViewMode = 'chart_and_schools' | 'scanner' | 'macro' | 'report' | 'backtest';

interface NavbarProps {
  symbol: MarketSymbol;
  onSelectSymbol: (s: MarketSymbol) => void;
  timeframe: TimeFrame;
  onSelectTimeframe: (tf: TimeFrame) => void;
  activeView: AppViewMode;
  onSelectView: (v: AppViewMode) => void;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
  activeAlertsCount?: number;
  onOpenAlertsModal?: () => void;
  onOpenAlertSettings?: () => void;
  onOpenRiskCalculator?: () => void;
  onOpenAndroidApk?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  symbol,
  onSelectSymbol,
  timeframe,
  onSelectTimeframe,
  activeView,
  onSelectView,
  onRunAnalysis,
  isAnalyzing,
  activeAlertsCount = 0,
  onOpenAlertsModal,
  onOpenAlertSettings,
  onOpenRiskCalculator,
  onOpenAndroidApk,
}) => {
  const timeframes: TimeFrame[] = ['5m', '15m', '30m', '1h', '4h', '1d'];
  const [customAssets, setCustomAssets] = useState<AssetConfig[]>(() => getCustomWatchedAssets());

  useEffect(() => {
    const syncCustom = () => setCustomAssets(getCustomWatchedAssets());
    window.addEventListener('custom-assets-updated', syncCustom);
    return () => window.removeEventListener('custom-assets-updated', syncCustom);
  }, []);

  const isSymbolInLists =
    SUPPORTED_ASSETS.some((a) => a.symbol === symbol) ||
    customAssets.some((a) => a.symbol === symbol);
  const activeCustomFallback = !isSymbolInLists ? inferAssetMetadata(symbol) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0B0F19]/95 backdrop-blur-md px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Zone 1: Wordmark & Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Activity className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight leading-tight">
              المحلل الفني المتقدم
            </h1>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider block">
              Advanced Market Analyst
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links & Asset / Timeframe Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Multi-Asset Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2 py-1 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 hidden sm:inline font-medium">الأصل:</span>
            <select
              value={symbol}
              onChange={(e) => onSelectSymbol(e.target.value as MarketSymbol)}
              className="bg-slate-950 text-amber-400 font-bold text-xs rounded-lg px-2.5 py-1 border border-slate-700/80 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {(customAssets.length > 0 || activeCustomFallback) && (
                <optgroup label="⭐ أصول مخصصة مضافة (أسهم / فوركس / كريبتو / مؤشرات)">
                  {activeCustomFallback && (
                    <option value={activeCustomFallback.symbol}>
                      {activeCustomFallback.nameAr} ({activeCustomFallback.symbol})
                    </option>
                  )}
                  {customAssets.map((asset) => (
                    <option key={asset.symbol} value={asset.symbol}>
                      {asset.nameAr} ({asset.symbol})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="🪙 المعادن الثمينة والسلع">
                {SUPPORTED_ASSETS.filter((a) => a.category === 'commodity').map((asset) => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {asset.nameAr} ({asset.symbol})
                  </option>
                ))}
              </optgroup>
              <optgroup label="💱 أزواج العملات الأجنبية الرئيسية (الفوركس)">
                {SUPPORTED_ASSETS.filter((a) => a.category === 'forex').map((asset) => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {asset.nameAr} ({asset.symbol})
                  </option>
                ))}
              </optgroup>
              <optgroup label="⚡ العملات المشفرة الكبرى">
                {SUPPORTED_ASSETS.filter((a) => a.category === 'crypto' || a.category === 'proxy').map((asset) => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {asset.nameAr} ({asset.symbol})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Universal Symbol Search Box */}
          <UniversalSymbolSearch
            currentSymbol={symbol}
            onSelectSymbol={onSelectSymbol}
            onCustomAssetsChanged={(updated) => setCustomAssets(updated)}
            compact={true}
          />

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe(tf)}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                  timeframe === tf
                    ? 'bg-slate-700 text-amber-400 shadow-inner'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* View Mode Tabs */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onSelectView('chart_and_schools')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeView === 'chart_and_schools'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>الرسم والمدارس</span>
            </button>
            <button
              onClick={() => onSelectView('scanner')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeView === 'scanner'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                  : 'text-amber-400/90 hover:text-amber-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>ماسح الفرص</span>
            </button>
            <button
              onClick={() => onSelectView('macro')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeView === 'macro'
                  ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                  : 'text-sky-400/90 hover:text-sky-300'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>الاقتصاد الكلي</span>
            </button>
            <button
              onClick={() => onSelectView('report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeView === 'report'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>التقرير الفني</span>
            </button>
            <button
              onClick={() => onSelectView('backtest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeView === 'backtest'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>الاختبار التاريخي</span>
            </button>
          </div>
        </div>

        {/* Zone 3: Actions, Alerts & PWA Install */}
        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenAlertsModal && (
            <button
              onClick={onOpenAlertsModal}
              className="relative flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              title="إدارة التنبيهات السعرية"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>التنبيهات</span>
              {activeAlertsCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 font-mono text-[10px] font-bold text-slate-950">
                  {activeAlertsCount}
                </span>
              )}
            </button>
          )}

          {onOpenAlertSettings && (
            <button
              onClick={onOpenAlertSettings}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:text-white hover:bg-indigo-500/20 transition cursor-pointer"
              title="إعدادات إرسال تنبيهات Telegram و Webhook"
            >
              <Send className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden xl:inline">Telegram & Webhook</span>
              <span className="xl:hidden">إشارات</span>
            </button>
          )}

          {onOpenRiskCalculator && (
            <button
              onClick={() => onOpenRiskCalculator()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              title="حاسبة المخاطر وحجم اللوت"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">حاسبة المخاطر</span>
            </button>
          )}

          {onOpenAndroidApk && (
            <button
              onClick={onOpenAndroidApk}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 transition cursor-pointer shadow-sm"
              title="نسخة وتثبيت تطبيق أندرويد (APK / WebAPK)"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">تطبيق أندرويد (APK)</span>
              <span className="sm:hidden font-mono font-black">APK</span>
            </button>
          )}

          <PWAInstallButton />

          <button
            onClick={onRunAnalysis}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-lg ${
              isAnalyzing
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer shadow-amber-500/20'
            }`}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                <span>جاري الحساب...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>تحليل شامل</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Responsive Fixed Bottom Navigation Bar */}
      <nav
        aria-label="التنقل الرئيسي للشاشات الصغيرة"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 no-print bg-[#0B0F19]/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl"
      >
        <button
          onClick={() => onSelectView('chart_and_schools')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg transition-all text-[11px] font-bold ${
            activeView === 'chart_and_schools'
              ? 'text-amber-400 bg-amber-500/15 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>الرسم والمدارس</span>
        </button>

        <button
          onClick={() => onSelectView('scanner')}
          className={`relative flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg transition-all text-[11px] font-bold ${
            activeView === 'scanner'
              ? 'text-emerald-400 bg-emerald-500/15 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>الماسح</span>
        </button>

        <button
          onClick={() => onSelectView('macro')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg transition-all text-[11px] font-bold ${
            activeView === 'macro'
              ? 'text-sky-400 bg-sky-500/15 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>الاقتصاد الكلي</span>
        </button>

        <button
          onClick={() => onSelectView('report')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg transition-all text-[11px] font-bold ${
            activeView === 'report'
              ? 'text-white bg-slate-800 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>التقرير</span>
        </button>

        <button
          onClick={() => onSelectView('backtest')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg transition-all text-[11px] font-bold ${
            activeView === 'backtest'
              ? 'text-white bg-slate-800 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>الباكتيست</span>
        </button>

        {onOpenAndroidApk && (
          <button
            onClick={onOpenAndroidApk}
            className="flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-lg transition-all text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
            title="تثبيت نسخة Android APK"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>APK</span>
          </button>
        )}
      </nav>
    </header>
  );
};

