/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  MarketSymbol,
  TimeFrame,
  MultiAssetOpportunity,
  ScannerDirectionBias,
} from '../types/market.ts';
import { scanMultiAssetOpportunities } from '../services/scanner-service.ts';
import { UniversalSymbolSearch } from './UniversalSymbolSearch.tsx';
import {
  Layers,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  BarChart3,
  ExternalLink,
} from 'lucide-react';

interface MultiAssetScannerProps {
  onSelectAsset: (symbol: MarketSymbol, timeframe: TimeFrame) => void;
  onOpenImportModal: () => void;
  selectedSymbol?: MarketSymbol;
}

export const MultiAssetScanner: React.FC<MultiAssetScannerProps> = ({
  onSelectAsset,
  onOpenImportModal,
  selectedSymbol,
}) => {
  const [scanTimeframe, setScanTimeframe] = useState<TimeFrame>('1h');
  const [opportunities, setOpportunities] = useState<MultiAssetOpportunity[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; symbol: string }>({
    current: 0,
    total: 0,
    symbol: '',
  });
  const [filterDirection, setFilterDirection] = useState<'all' | 'buy' | 'sell' | 'with_setup'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'forex' | 'commodity' | 'crypto' | 'stock_index'>('all');
  const [sortBy, setSortBy] = useState<'confluence' | 'change' | 'name'>('confluence');

  const runScan = useCallback(async (tf: TimeFrame) => {
    setIsScanning(true);
    try {
      const results = await scanMultiAssetOpportunities(tf, (completed, total, currentSym) => {
        setScanProgress({ current: completed, total, symbol: currentSym });
      });
      setOpportunities(results);
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Initial scan on mount
  useEffect(() => {
    runScan(scanTimeframe);
  }, [runScan, scanTimeframe]);

  // Filtering
  const filtered = opportunities.filter((item) => {
    // Category filter
    if (filterCategory === 'forex' && item.category !== 'forex') return false;
    if (filterCategory === 'commodity' && item.category !== 'commodity') return false;
    if (filterCategory === 'crypto' && item.category !== 'crypto' && item.category !== 'proxy') return false;
    if (filterCategory === 'stock_index' && item.category !== 'stock' && item.category !== 'index') return false;

    // Direction filter
    if (filterDirection === 'with_setup') {
      return item.tradeSetup && item.tradeSetup.hasSetup;
    }
    if (filterDirection === 'buy') {
      return item.bias === 'شراء' || item.bias === 'شراء قوي';
    }
    if (filterDirection === 'sell') {
      return item.bias === 'بيع' || item.bias === 'بيع قوي';
    }
    return true;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'confluence') {
      return b.confluenceScore - a.confluenceScore;
    }
    if (sortBy === 'change') {
      return b.priceChangePercent24h - a.priceChangePercent24h;
    }
    return a.nameAr.localeCompare(b.nameAr);
  });

  const timeframes: TimeFrame[] = ['15m', '30m', '1h', '4h', '1d'];

  return (
    <div className="space-y-6">
      {/* Scanner Header & Control Toolbar */}
      <div className="bg-[#0d121f] rounded-2xl border border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  ماسح فرص التداول الشامل (Multi-Asset Opportunity Scanner)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  الفوركس • المعادن • الكريبتو
                </span>
              </div>
              <p className="text-xs text-slate-400">
                فحص فني متعدد الأبعاد لأزواج العملات الأجنبية الرئيسية، الذهب، الفضة، والعملات المشفرة عبر المدارس التحليلية الست.
              </p>
            </div>
          </div>

          {/* Timeframe, Custom Asset Search & Refresh Action */}
          <div className="flex flex-wrap items-center gap-2">
            <UniversalSymbolSearch
              currentSymbol={selectedSymbol || 'BTCUSDT'}
              onSelectSymbol={(sym) => onSelectAsset(sym, scanTimeframe)}
              onCustomAssetsChanged={() => runScan(scanTimeframe)}
              compact={true}
            />

            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setScanTimeframe(tf)}
                  disabled={isScanning}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition cursor-pointer ${
                    scanTimeframe === tf
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <button
              onClick={() => runScan(scanTimeframe)}
              disabled={isScanning}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm cursor-pointer ${
                isScanning
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/20'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'جاري الفحص الموازي...' : 'إعادة الفحص الآن'}</span>
            </button>
          </div>
        </div>

        {/* Market Category Selector Tabs (Forex, Metals/Commodities, Crypto, Stocks/Indices) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
          <span className="text-slate-400 text-xs font-semibold ml-1">فئة السوق:</span>
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterCategory === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            جميع الأسواق ({opportunities.length})
          </button>
          <button
            onClick={() => setFilterCategory('forex')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filterCategory === 'forex'
                ? 'bg-blue-500 text-white shadow-sm font-black'
                : 'bg-slate-900/80 text-blue-400/90 border border-slate-800 hover:text-blue-300'
            }`}
          >
            <span>💱 أزواج العملات (الفوركس)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-950/70 border border-blue-800/80 text-blue-200">
              {opportunities.filter((o) => o.category === 'forex').length}
            </span>
          </button>
          <button
            onClick={() => setFilterCategory('commodity')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filterCategory === 'commodity'
                ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                : 'bg-slate-900/80 text-amber-400/90 border border-slate-800 hover:text-amber-300'
            }`}
          >
            <span>🪙 المعادن والسلع</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/70 border border-amber-800/80 text-amber-200">
              {opportunities.filter((o) => o.category === 'commodity').length}
            </span>
          </button>
          <button
            onClick={() => setFilterCategory('crypto')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filterCategory === 'crypto'
                ? 'bg-emerald-500 text-slate-950 shadow-sm font-black'
                : 'bg-slate-900/80 text-emerald-400/90 border border-slate-800 hover:text-emerald-300'
            }`}
          >
            <span>⚡ العملات الرقمية</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/70 border border-emerald-800/80 text-emerald-200">
              {opportunities.filter((o) => o.category === 'crypto' || o.category === 'proxy').length}
            </span>
          </button>
          <button
            onClick={() => setFilterCategory('stock_index')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filterCategory === 'stock_index'
                ? 'bg-violet-500 text-white shadow-sm font-black'
                : 'bg-slate-900/80 text-violet-400/90 border border-slate-800 hover:text-violet-300'
            }`}
          >
            <span>📈 الأسهم والمؤشرات المخصصة</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-violet-950/70 border border-violet-800/80 text-violet-200">
              {opportunities.filter((o) => o.category === 'stock' || o.category === 'index').length}
            </span>
          </button>
        </div>

        {/* Filters and Sorting bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
          {/* Direction filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 text-[11px] font-medium ml-1">تصفية النتائج:</span>
            <button
              onClick={() => setFilterDirection('all')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                filterDirection === 'all'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              جميع الأصول ({opportunities.length})
            </button>
            <button
              onClick={() => setFilterDirection('with_setup')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                filterDirection === 'with_setup'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>صفقات مؤكدة ({opportunities.filter((o) => o.tradeSetup?.hasSetup).length})</span>
            </button>
            <button
              onClick={() => setFilterDirection('buy')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                filterDirection === 'buy'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>شراء ({opportunities.filter((o) => o.bias.includes('شراء')).length})</span>
            </button>
            <button
              onClick={() => setFilterDirection('sell')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                filterDirection === 'sell'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingDown className="w-3 h-3 text-rose-400" />
              <span>بيع ({opportunities.filter((o) => o.bias.includes('بيع')).length})</span>
            </button>
          </div>

          {/* Sorting */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 text-[11px]">ترتيب حسب:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="confluence">درجة التوافق الفني (الأعلى)</option>
              <option value="change">نسبة التغير خلال 24h</option>
              <option value="name">اسم الأصل أبجدياً</option>
            </select>
          </div>
        </div>

        {/* Progress Bar during scan */}
        {isScanning && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>جاري تدقيق الشموع لـ: {scanProgress.symbol}...</span>
              <span className="font-mono">
                {scanProgress.current} من {scanProgress.total}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{
                  width: `${scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Grid of Scanned Opportunities */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((item) => {
          const isSelected = selectedSymbol === item.symbol;
          const isBuy = item.bias === 'شراء' || item.bias === 'شراء قوي';
          const isSell = item.bias === 'بيع' || item.bias === 'بيع قوي';

          return (
            <div
              key={item.symbol}
              className={`rounded-2xl border transition-all p-5 flex flex-col justify-between space-y-4 ${
                isSelected
                  ? 'border-amber-500 bg-[#0e1628] shadow-lg shadow-amber-500/10'
                  : 'border-slate-800 bg-[#0d121f] hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-white">{item.nameAr}</h3>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {item.symbol}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {item.category === 'forex'
                        ? 'أزواج العملات (فوركس)'
                        : item.category === 'commodity'
                        ? 'معدن ثمين / سلعة'
                        : item.category === 'stock'
                        ? 'سهم عالمي'
                        : item.category === 'index'
                        ? 'مؤشر سوق'
                        : item.category === 'proxy'
                        ? 'ذهب رقمي مدعوم'
                        : 'عملة مشفرة'}
                    </span>
                  </div>

                  {/* Direction Badge */}
                  <span
                    className={`text-xs px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 ${
                      isBuy
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : isSell
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {isBuy ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : isSell ? (
                      <TrendingDown className="w-3.5 h-3.5" />
                    ) : (
                      <Minus className="w-3.5 h-3.5" />
                    )}
                    <span>{item.bias}</span>
                  </span>
                </div>

                {/* Price & 24h Change */}
                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    {item.price > 0 ? (
                      <span className="text-xl font-black font-mono text-white">
                        {item.category === 'forex'
                          ? item.symbol.endsWith('JPY')
                            ? `${item.price.toFixed(3)} ¥`
                            : item.price.toFixed(5)
                          : item.price >= 10
                          ? `$${item.price.toLocaleString('en-US', { minimumFractionDigits: item.symbol === 'XAGUSD' ? 3 : 2, maximumFractionDigits: item.symbol === 'XAGUSD' ? 3 : 2 })}`
                          : item.price >= 1
                          ? `$${item.price.toFixed(4)}`
                          : `$${item.price.toFixed(5)}`}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-slate-500 font-mono">غير محدد</span>
                    )}
                  </div>
                  {item.price > 0 && (
                    <span
                      className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                        item.priceChangePercent24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {item.priceChangePercent24h >= 0 ? '+' : ''}
                      {item.priceChangePercent24h}%
                    </span>
                  )}
                </div>

                {/* Confluence Score Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">درجة التوافق الفني:</span>
                    <span
                      className={`font-mono font-bold ${
                        item.confluenceScore >= 70
                          ? 'text-emerald-400'
                          : item.confluenceScore >= 50
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.confluenceScore}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        item.confluenceScore >= 70
                          ? 'bg-emerald-500'
                          : item.confluenceScore >= 50
                          ? 'bg-amber-500'
                          : 'bg-slate-700'
                      }`}
                      style={{ width: `${item.confluenceScore}%` }}
                    />
                  </div>
                </div>

                {/* Dominant Schools Pill List */}
                {item.dominantSchools.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {item.dominantSchools.slice(0, 3).map((school, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800"
                      >
                        ✓ {school}
                      </span>
                    ))}
                  </div>
                )}

                {/* Trade Setup details if found */}
                {item.tradeSetup && item.tradeSetup.hasSetup ? (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-amber-400 font-bold">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>فرصة تداول مقترحة ({item.tradeSetup.bias})</span>
                      </span>
                      <span className="text-[11px] font-mono bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-300">
                        عائد:مخاطرة 1:{item.tradeSetup.riskRewardRatio}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
                      <div className="p-1 rounded bg-slate-950/80">
                        <span className="text-slate-500 block text-[9px]">الدخول</span>
                        <span className="text-slate-200 font-bold">{item.tradeSetup.entryMin}</span>
                      </div>
                      <div className="p-1 rounded bg-slate-950/80">
                        <span className="text-rose-400 block text-[9px]">الوقف (SL)</span>
                        <span className="text-rose-300 font-bold">{item.tradeSetup.stopLoss}</span>
                      </div>
                      <div className="p-1 rounded bg-slate-950/80">
                        <span className="text-emerald-400 block text-[9px]">الهدف (TP)</span>
                        <span className="text-emerald-300 font-bold">{item.tradeSetup.target1}</span>
                      </div>
                    </div>
                  </div>
                ) : item.status === 'requires_import' ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2 text-amber-200">
                    <div className="flex items-center gap-1.5 font-bold">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span>يتطلب استيراد شموع الذهب CSV</span>
                    </div>
                    <p className="text-[11px] text-amber-300/80 leading-relaxed">
                      {item.errorMessage || 'بيانات الذهب XAUUSD غير مباشرة وتعتمد على تدقيق ملفات CSV لضمان صحة الأسعار.'}
                    </p>
                    <button
                      onClick={onOpenImportModal}
                      className="w-full flex items-center justify-center gap-1.5 bg-amber-500 text-slate-950 font-bold py-1.5 rounded-lg text-xs hover:bg-amber-400 transition cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>استيراد ملف CSV لـ XAUUSD</span>
                    </button>
                  </div>
                ) : item.status === 'error' ? (
                  <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/40 text-xs space-y-1.5 text-rose-300">
                    <div className="flex items-center gap-1.5 font-bold text-rose-400">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <span>بيانات الأصل غير متاحة حالياً</span>
                    </div>
                    <p className="text-[11px] text-rose-300/80 leading-relaxed">
                      {item.errorMessage || 'تعذر جلب الشموع الحقيقية من مزود السوق الرسمي.'}
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400">
                    لا يوجد إعداد صفقة مستوفٍ لنسبة الأمان؛ توازن الإشارات الفنية ينصح بالمراقبة.
                  </div>
                )}
              </div>

              {/* Card Footer: Source Status & Action button */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="truncate max-w-[200px]">{item.dataSource}</span>
                  <span className="font-mono">{item.lastUpdated}</span>
                </div>

                <button
                  onClick={() => onSelectAsset(item.symbol, item.timeframe)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition bg-slate-800 text-slate-100 hover:bg-amber-500 hover:text-slate-950 cursor-pointer shadow-sm"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>تحليل هذا الأصل بالمنصة</span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
