/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MarketSymbol,
  SymbolSearchResult,
  AssetCategory,
  AssetConfig,
} from '../types/market.ts';
import {
  addCustomWatchedAsset,
  getCustomWatchedAssets,
  removeCustomWatchedAsset,
  inferAssetMetadata,
  isCryptoPairSymbol,
  isForexPairSymbol,
  isEgxStockSymbol,
  isKnownUsStock,
  normalizeDisplaySymbol,
} from '../services/market/custom-assets.ts';
import { Search, Plus, X, Loader2, Trash2, Globe, TrendingUp } from 'lucide-react';

interface UniversalSymbolSearchProps {
  currentSymbol: MarketSymbol;
  onSelectSymbol: (symbol: MarketSymbol) => void;
  onCustomAssetsChanged?: (assets: AssetConfig[]) => void;
  compact?: boolean;
}

const QUICK_SUGGESTIONS: SymbolSearchResult[] = [
  { symbol: 'COMI', providerSymbol: 'COMI.CA', nameAr: 'البنك التجاري الدولي - مصر (CIB)', nameEn: 'Commercial International Bank', category: 'stock', market: 'EGX', currency: 'EGP', provider: 'yahoo', decimals: 2 },
  { symbol: 'FWRY', providerSymbol: 'FWRY.CA', nameAr: 'فوري لتكنولوجيا البنوك (Fawry)', nameEn: 'Fawry Banking Tech', category: 'stock', market: 'EGX', currency: 'EGP', provider: 'yahoo', decimals: 2 },
  { symbol: 'TMGH', providerSymbol: 'TMGH.CA', nameAr: 'طلعت مصطفى القابضة (TMG)', nameEn: 'Talaat Moustafa Group', category: 'stock', market: 'EGX', currency: 'EGP', provider: 'yahoo', decimals: 2 },
  { symbol: 'SWDY', providerSymbol: 'SWDY.CA', nameAr: 'السويدي إليكتريك (Elsewedy)', nameEn: 'Elsewedy Electric', category: 'stock', market: 'EGX', currency: 'EGP', provider: 'yahoo', decimals: 2 },
  { symbol: 'AMII', providerSymbol: 'AMII.CA', nameAr: 'الملتقى العربي للاستثمارات (AMII)', nameEn: 'Arab Moltaqa Investments', category: 'stock', market: 'EGX', currency: 'EGP', provider: 'yahoo', decimals: 2 },
  { symbol: 'NVDA', providerSymbol: 'NVDA', nameAr: 'سهم إنفيديا (NVIDIA)', nameEn: 'NVIDIA Corp', category: 'stock', market: 'US', currency: 'USD', provider: 'yahoo', decimals: 2 },
  { symbol: 'AAPL', providerSymbol: 'AAPL', nameAr: 'سهم أبل (Apple)', nameEn: 'Apple Inc', category: 'stock', market: 'US', currency: 'USD', provider: 'yahoo', decimals: 2 },
  { symbol: 'TSLA', providerSymbol: 'TSLA', nameAr: 'سهم تسلا (Tesla)', nameEn: 'Tesla Inc', category: 'stock', market: 'US', currency: 'USD', provider: 'yahoo', decimals: 2 },
  { symbol: 'GBPJPY', providerSymbol: 'GBPJPY=X', nameAr: 'الباوند / ين ياباني (المجنون)', nameEn: 'GBP/JPY', category: 'forex', market: 'FOREX', currency: 'JPY', provider: 'yahoo', decimals: 3 },
  { symbol: 'DOGEUSDT', providerSymbol: 'DOGEUSDT', nameAr: 'دوجكوين (Dogecoin)', nameEn: 'DOGE/USDT', category: 'crypto', market: 'CRYPTO', currency: 'USDT', provider: 'binance', decimals: 5 },
  { symbol: 'OIL', providerSymbol: 'CL=F', nameAr: 'نفط خام غرب تكساس (WTI Oil)', nameEn: 'WTI Crude Oil', category: 'commodity', market: 'COMMODITIES', currency: 'USD', provider: 'yahoo', decimals: 2 },
  { symbol: 'NAS100', providerSymbol: '^NDX', nameAr: 'مؤشر ناسداك 100 (NAS100)', nameEn: 'Nasdaq 100', category: 'index', market: 'GLOBAL_INDEX', currency: 'USD', provider: 'yahoo', decimals: 2 },
];

export const UniversalSymbolSearch: React.FC<UniversalSymbolSearchProps> = ({
  currentSymbol,
  onSelectSymbol,
  onCustomAssetsChanged,
  compact = true,
}) => {
  const [query, setQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [customAssets, setCustomAssets] = useState<AssetConfig[]>(() => getCustomWatchedAssets());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncCustom = () => setCustomAssets(getCustomWatchedAssets());
    window.addEventListener('custom-assets-updated', syncCustom);
    return () => window.removeEventListener('custom-assets-updated', syncCustom);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search query
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success && Array.isArray(json.results)) {
            setResults(json.results);
            setIsSearching(false);
            return;
          }
        }
      } catch {
        // Fallback client-side inference if server unreachable
      }

      if (!cancelled) {
        const clean = trimmed.toUpperCase().replace(/[^A-Z0-9^=.-]/g, '');
        const fallbackList: SymbolSearchResult[] = [];
        if (clean.length >= 2) {
          const meta = inferAssetMetadata(clean);
          fallbackList.push({
            symbol: meta.symbol,
            providerSymbol: meta.providerSymbol || meta.symbol,
            nameAr: meta.nameAr,
            nameEn: meta.nameEn,
            category: meta.category,
            market: meta.market,
            currency: meta.currency,
            provider: meta.provider === 'binance' ? 'binance' : 'yahoo',
            decimals: meta.decimals,
          });
          // Only suggest crypto USDT pair if it's NOT an EGX stock, NOT a known US stock, and NOT Forex
          if (
            !isEgxStockSymbol(clean) &&
            !isKnownUsStock(clean) &&
            !isCryptoPairSymbol(clean) &&
            !isForexPairSymbol(clean) &&
            clean.length <= 5 &&
            !clean.endsWith('.CA')
          ) {
            const egxMeta = inferAssetMetadata(`${clean}.CA`, undefined, { forceEgx: true });
            fallbackList.push({
              symbol: egxMeta.symbol,
              providerSymbol: egxMeta.providerSymbol,
              nameAr: egxMeta.nameAr,
              nameEn: egxMeta.nameEn,
              category: 'stock',
              market: 'EGX',
              currency: 'EGP',
              provider: 'yahoo',
              decimals: 2,
            });
          }
        }
        setResults(fallbackList);
        setIsSearching(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSelectResult = (item: SymbolSearchResult) => {
    const canonicalSym = normalizeDisplaySymbol(item.symbol);
    const updated = addCustomWatchedAsset({
      ...item,
      symbol: canonicalSym,
    });
    setCustomAssets(updated);
    if (onCustomAssetsChanged) {
      onCustomAssetsChanged(updated);
    }
    onSelectSymbol(canonicalSym);
    setQuery('');
    setIsOpen(false);
  };

  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = query.trim().toUpperCase().replace(/[^A-Z0-9^=.-]/g, '');
    if (!clean) return;

    if (results.length > 0) {
      handleSelectResult(results[0]);
      return;
    }

    const meta = inferAssetMetadata(clean);
    const updated = addCustomWatchedAsset(meta);
    setCustomAssets(updated);
    if (onCustomAssetsChanged) {
      onCustomAssetsChanged(updated);
    }
    onSelectSymbol(meta.symbol);
    setQuery('');
    setIsOpen(false);
  };

  const handleRemoveCustom = (e: React.MouseEvent, sym: MarketSymbol) => {
    e.stopPropagation();
    const updated = removeCustomWatchedAsset(sym);
    setCustomAssets(updated);
    if (onCustomAssetsChanged) {
      onCustomAssetsChanged(updated);
    }
  };

  const getCategoryLabel = (cat: AssetCategory, market?: string) => {
    if (market === 'EGX') {
      return { text: 'سهم مصري (EGX)', color: 'text-amber-400' };
    }
    switch (cat) {
      case 'crypto':
        return { text: 'عملة رقمية', color: 'text-emerald-400' };
      case 'forex':
        return { text: 'فوركس', color: 'text-sky-400' };
      case 'stock':
        return { text: 'سهم عالمي', color: 'text-violet-400' };
      case 'index':
        return { text: 'مؤشر سوق', color: 'text-amber-400' };
      case 'commodity':
        return { text: 'سلعة / معدن', color: 'text-yellow-400' };
      default:
        return { text: 'أصل مالي', color: 'text-slate-400' };
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleDirectSubmit} className="flex items-center">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          <input
            type="text"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            placeholder={
              compact
                ? 'ابحث عن رمز (COMI, AMII, NVDA, GBPJPY...)'
                : 'اكتب كود أي سهم مصري (COMI, FWRY, AMII) أو أمريكي (NVDA, AAPL) أو عملة أو مؤشر...'
            }
            className={`${
              compact ? 'w-48 sm:w-64' : 'w-full sm:w-80'
            } bg-slate-950 text-white placeholder-slate-500 text-xs rounded-xl pr-8 pl-7 py-1.5 border border-slate-700/80 focus:outline-none focus:border-amber-500 font-mono transition`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute left-2 text-slate-400 hover:text-white cursor-pointer"
              title="مسح البحث"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </form>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-700/90 bg-[#0d1322] shadow-2xl z-50 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/70">
            <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>الباحث الذكي (البورصة المصرية EGX • أسهم أمريكية • كريبتو • فوركس)</span>
            </span>
            {isSearching && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/70">
            {query.trim().length > 0 ? (
              results.length > 0 ? (
                results.map((item) => {
                  const catInfo = getCategoryLabel(item.category, item.market);
                  return (
                    <button
                      key={`${item.symbol}_${item.providerSymbol || item.provider}`}
                      type="button"
                      onClick={() => handleSelectResult(item)}
                      className="w-full px-3.5 py-2.5 text-right hover:bg-slate-800/80 transition flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-xs text-white">
                            {item.symbol}
                          </span>
                          {item.providerSymbol && item.providerSymbol !== item.symbol && (
                            <span className="text-[10px] font-mono text-slate-400">
                              ({item.providerSymbol})
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500">·</span>
                          <span className={`text-[10px] font-semibold ${catInfo.color}`}>
                            {catInfo.text}
                          </span>
                          {item.currency && (
                            <>
                              <span className="text-[10px] text-slate-500">·</span>
                              <span className="text-[10px] font-mono text-slate-300">
                                {item.currency}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-slate-300 truncate mt-0.5">
                          {item.nameAr}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.price !== undefined && item.price > 0 && (
                          <span className="font-mono text-xs text-emerald-400 font-bold">
                            {item.price.toFixed(item.decimals)}
                          </span>
                        )}
                        <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : !isSearching ? (
                <div className="p-4 text-center space-y-2">
                  <p className="text-xs text-slate-400">
                    اضغط Enter لتحميل الرمز{' '}
                    <span className="font-mono font-bold text-amber-400">
                      {normalizeDisplaySymbol(query)}
                    </span>{' '}
                    مباشرة
                  </p>
                  <button
                    type="button"
                    onClick={handleDirectSubmit}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>جلب وتحليل {normalizeDisplaySymbol(query)} الآن</span>
                  </button>
                </div>
              ) : null
            ) : (
              <>
                {customAssets.length > 0 && (
                  <div className="p-3 space-y-2 bg-slate-950/50">
                    <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                      <span>أصولك المخصصة المحفوظة ({customAssets.length}):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {customAssets.map((ca) => (
                        <div
                          key={ca.symbol}
                          onClick={() => {
                            onSelectSymbol(ca.symbol);
                            setIsOpen(false);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer border transition ${
                            currentSymbol === ca.symbol
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          <span>{ca.symbol}</span>
                          {ca.market === 'EGX' && (
                            <span className="text-[9px] text-amber-400 font-sans">EGX</span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleRemoveCustom(e, ca.symbol)}
                            className="text-slate-500 hover:text-rose-400 transition cursor-pointer"
                            title="حذف من القائمة المخصصة"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    <span>اختصارات سريعة (البورصة المصرية EGX • أسهم أمريكية • فوركس • كريبتو):</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_SUGGESTIONS.map((item) => {
                      const catInfo = getCategoryLabel(item.category, item.market);
                      return (
                        <button
                          key={item.symbol}
                          type="button"
                          onClick={() => handleSelectResult(item)}
                          className="p-2 rounded-xl border border-slate-800/90 bg-slate-900/60 hover:bg-slate-800/90 hover:border-slate-700 text-right transition flex items-center justify-between gap-1 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-white">
                                {item.symbol}
                              </span>
                              <span className={`text-[9px] ${catInfo.color}`}>{catInfo.text}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {item.nameAr}
                            </div>
                          </div>
                          <Plus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
