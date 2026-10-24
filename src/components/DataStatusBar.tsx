/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MarketSymbol, TimeFrame } from '../types/market.ts';
import { getAssetDecimals, isForexPairSymbol, inferAssetMetadata } from '../services/market/custom-assets.ts';
import { RefreshCw, UploadCloud, Clock, Database, AlertCircle, CheckCircle2, Timer } from 'lucide-react';

interface DataStatusBarProps {
  symbol: MarketSymbol;
  timeframe?: TimeFrame;
  currentPrice: number;
  dataSource: string;
  isLive: boolean;
  lastCandleTime: number;
  isCandleClosed: boolean;
  candleCount: number;
  isLoadingData: boolean;
  onRefreshData: () => void;
  onOpenImportModal: () => void;
}

export const DataStatusBar: React.FC<DataStatusBarProps> = ({
  symbol,
  timeframe = '1h',
  currentPrice,
  dataSource,
  isLive,
  lastCandleTime,
  isCandleClosed,
  candleCount,
  isLoadingData,
  onRefreshData,
  onOpenImportModal,
}) => {
  const [countdownText, setCountdownText] = useState<string>('');

  // Real-time countdown timer to current candle close
  useEffect(() => {
    if (!isLive) {
      setCountdownText('');
      return;
    }

    const getPeriodMs = (tf: TimeFrame): number => {
      switch (tf) {
        case '5m': return 5 * 60 * 1000;
        case '15m': return 15 * 60 * 1000;
        case '30m': return 30 * 60 * 1000;
        case '1h': return 60 * 60 * 1000;
        case '4h': return 4 * 60 * 60 * 1000;
        case '1d': return 24 * 60 * 60 * 1000;
        default: return 60 * 60 * 1000;
      }
    };

    const updateTimer = () => {
      const now = Date.now();
      const period = getPeriodMs(timeframe);
      const remainingMs = period - (now % period);
      const totalSec = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;

      if (hours > 0) {
        setCountdownText(`${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      } else {
        setCountdownText(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [timeframe, isLive]);

  const assetMeta = inferAssetMetadata(symbol);
  const quoteUnit = symbol.endsWith('USDT')
    ? 'USDT'
    : isForexPairSymbol(symbol)
    ? symbol.replace('=X', '').slice(3, 6)
    : assetMeta.currency === 'EGP'
    ? 'EGP (ج.م)'
    : assetMeta.currency || 'USD';

  const isImportedCsv = dataSource.includes('مستورد') || dataSource.includes('CSV');
  const statusBadgeText = isLive
    ? 'بيانات حية مباشرة'
    : isImportedCsv
    ? 'بيانات مستوردة (CSV)'
    : 'بيانات إغلاق يومية / تاريخية (EOD)';

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d121f] p-4 text-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Price & Symbol Info */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[11px] font-mono text-slate-400 font-semibold">
                {isLive ? `السعر اللحظي المحسوب (${symbol})` : `آخر سعر إغلاق مسجل (${symbol})`}
              </span>
              {assetMeta.market === 'EGX' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-800/70 font-semibold">
                  EGX · البورصة المصرية
                </span>
              )}
              {isLive && (
                <span className="relative flex h-2 w-2" title="تحديثات لحظية نشطة">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-white flex items-center gap-2">
              <span>
                {currentPrice > 0
                  ? currentPrice.toFixed(getAssetDecimals(symbol, currentPrice))
                  : '---'}
              </span>
              <span className="text-xs font-mono font-normal text-slate-400">
                {quoteUnit}
              </span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>

          {/* Source Status */}
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isLive
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950/80 text-amber-400 border border-amber-800'
              }`}>
                {isLive ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                <span>{statusBadgeText}</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                ({candleCount} شمعة)
              </span>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Database className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate max-w-xs">{dataSource || 'لم يتم جلب البيانات بعد'}</span>
            </div>
          </div>
        </div>

        {/* Timestamps & Countdown */}
        <div className="flex flex-wrap items-center gap-3">
          {countdownText && (
            <div className="text-right text-[11px] font-mono text-amber-300 bg-amber-950/30 px-3 py-1.5 rounded-lg border border-amber-800/60 flex items-center gap-2">
              <Timer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">إغلاق الشمعة بعد:</span>
                <span className="font-bold font-mono tracking-wider">{countdownText}</span>
              </div>
            </div>
          )}

          {lastCandleTime > 0 && (
            <div className="text-right text-[11px] font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 space-y-0.5">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>آخر شمعة: {new Date(lastCandleTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <div className={isCandleClosed ? 'text-emerald-400' : 'text-amber-400'}>
                {isCandleClosed ? '• الشمعة مغلقة' : '• الشمعة قيد التكوين'}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshData}
              disabled={isLoadingData}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 px-3 py-2 text-xs font-semibold text-slate-200 border border-slate-700/80 hover:text-white transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin text-amber-400' : ''}`} />
              <span>تحديث البيانات</span>
            </button>

            <button
              onClick={onOpenImportModal}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-amber-400 border border-slate-700 hover:text-amber-300 transition cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>استيراد CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
