/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MacroAnalysisReport,
  MacroIndicator,
  EconomicCalendarEvent,
  CalendarEventAlarm,
} from '../types/market.ts';
import {
  generateMacroAnalysisReport,
  fetchLiveMacroReport,
  getStoredCalendarAlarms,
  saveStoredCalendarAlarms,
  toggleEventAlarm,
  playEconomicEventChime,
} from '../services/macro-service.ts';
import {
  Globe,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  ShieldCheck,
  Zap,
  Activity,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  Bell,
  BellRing,
  Volume2,
  Flame,
  ExternalLink,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Coins,
  ShieldAlert,
} from 'lucide-react';

export const MacroPanel: React.FC = () => {
  const [report, setReport] = useState<MacroAnalysisReport>(() => generateMacroAnalysisReport());
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(false);
  const [selectedAssetTab, setSelectedAssetTab] = useState<'gold' | 'silver' | 'forex' | 'crypto'>('gold');
  
  // Calendar Filtering
  const [calendarFilter, setCalendarFilter] = useState<'all' | 'high_only' | 'today_only' | 'tomorrow_only'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Alarms State
  const [alarms, setAlarms] = useState<CalendarEventAlarm[]>(() => getStoredCalendarAlarms());
  const [selectedLeadTime, setSelectedLeadTime] = useState<number>(30); // 30 minutes default
  const [activeAlertEvent, setActiveAlertEvent] = useState<EconomicCalendarEvent | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  // Load live macro indicators from backend on mount
  useEffect(() => {
    let isMounted = true;
    const loadLiveData = async () => {
      try {
        setIsLoadingLive(true);
        const liveReport = await fetchLiveMacroReport();
        if (isMounted) {
          setReport(liveReport);
        }
      } catch (err) {
        console.warn('[MacroPanel] Failed to fetch live macro report:', err);
      } finally {
        if (isMounted) setIsLoadingLive(false);
      }
    };

    loadLiveData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefreshLive = async () => {
    setIsLoadingLive(true);
    try {
      const liveReport = await fetchLiveMacroReport();
      setReport(liveReport);
    } finally {
      setIsLoadingLive(false);
    }
  };

  // Keep live second-by-second countdown accurate
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check for upcoming event triggers based on armed alarms
  useEffect(() => {
    const checkAlarms = () => {
      const activeAlarms = alarms.filter((a) => a.enabled);
      if (activeAlarms.length === 0) return;

      const currentNow = Date.now();

      for (const alarm of activeAlarms) {
        const ev = report.upcomingEvents.find((e) => e.id === alarm.eventId);
        if (!ev) continue;

        const timeDiffMs = ev.timestampMs - currentNow;
        const leadMs = alarm.leadTimeMinutes * 60 * 1000;

        // If we are within the warning window and event hasn't passed more than 5 minutes ago
        if (timeDiffMs > 0 && timeDiffMs <= leadMs) {
          // Check if already notified in this session
          if (!alarm.notifiedAt || currentNow - alarm.notifiedAt > 20 * 60 * 1000) {
            // Trigger Alarm!
            playEconomicEventChime(ev.importance === 'high');
            setActiveAlertEvent(ev);

            // Native browser notification if allowed
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`تنبيه خبر اقتصادي عالي الأهمية 🔔`, {
                  body: `يقترب صدور: ${ev.titleAr} خلال ${Math.ceil(timeDiffMs / 60000)} دقيقة! يرجى الحذر من التقلبات السعرية وتوسيع السبريد.`,
                  icon: '/favicon.ico',
                });
              } catch {
                // Ignore notification error
              }
            }

            // Mark as notified
            const updated = alarms.map((a) =>
              a.eventId === alarm.eventId ? { ...a, notifiedAt: currentNow } : a
            );
            setAlarms(updated);
            saveStoredCalendarAlarms(updated);
          }
        }
      }
    };

    const interval = setInterval(checkAlarms, 10000);
    return () => clearInterval(interval);
  }, [alarms, report.upcomingEvents]);

  const handleToggleAlarm = (eventId: string) => {
    const { updatedAlarms } = toggleEventAlarm(eventId, selectedLeadTime);
    setAlarms(updatedAlarms);
  };

  const handleToggleAllHighImpact = () => {
    const highEvents = report.upcomingEvents.filter((e) => e.importance === 'high');
    const allHighEnabled = highEvents.every((e) => alarms.some((a) => a.eventId === e.id && a.enabled));

    let nextAlarms = [...alarms];
    if (allHighEnabled) {
      // Disable all
      nextAlarms = nextAlarms.map((a) =>
        highEvents.some((e) => e.id === a.eventId) ? { ...a, enabled: false } : a
      );
    } else {
      // Enable all high impact
      for (const ev of highEvents) {
        const idx = nextAlarms.findIndex((a) => a.eventId === ev.id);
        if (idx >= 0) {
          nextAlarms[idx] = { ...nextAlarms[idx], enabled: true, leadTimeMinutes: selectedLeadTime };
        } else {
          nextAlarms.push({ eventId: ev.id, leadTimeMinutes: selectedLeadTime, enabled: true });
        }
      }
    }
    setAlarms(nextAlarms);
    saveStoredCalendarAlarms(nextAlarms);
  };

  const requestNotification = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const res = await Notification.requestPermission();
      setNotificationPermission(res);
    }
  };

  // Helper for live countdown display
  const formatCountdown = (targetMs: number): { text: string; isClose: boolean; isPast: boolean; diffMinutes: number } => {
    const diff = targetMs - nowMs;
    const diffMinutes = Math.floor(diff / 60000);

    if (diff <= 0) {
      const pastMin = Math.floor(Math.abs(diff) / 60000);
      return {
        text: pastMin < 60 ? `صدر قبل ${pastMin} دقيقة` : 'تم الصدور',
        isClose: false,
        isPast: true,
        diffMinutes,
      };
    }

    const totalSec = Math.floor(diff / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    const isClose = diff <= selectedLeadTime * 60 * 1000;

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return { text: `بعد ${days} يوم و${hours % 24} ساعة`, isClose: false, isPast: false, diffMinutes };
    }

    const text = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return { text: `متبقي ${text}`, isClose, isPast: false, diffMinutes };
  };

  // Filter events by status, importance, and currency
  const filteredEvents = useMemo(() => {
    return report.upcomingEvents.filter((ev) => {
      // Currency filter
      if (currencyFilter !== 'ALL' && ev.currency !== currencyFilter) {
        return false;
      }

      // Timing / importance filter
      if (calendarFilter === 'high_only') return ev.importance === 'high';
      if (calendarFilter === 'today_only') {
        return ev.date === '2026-10-15';
      }
      if (calendarFilter === 'tomorrow_only') {
        return ev.date === '2026-10-16';
      }
      return true;
    });
  }, [report.upcomingEvents, calendarFilter, currencyFilter]);

  const armedAlarmsCount = alarms.filter((a) => a.enabled).length;

  return (
    <div className="space-y-6">
      {/* Imminent News Alert Toast / Banner */}
      {activeAlertEvent && (
        <div className="p-4 rounded-2xl bg-amber-950/95 border-2 border-amber-500 text-amber-100 flex flex-wrap items-center justify-between gap-4 shadow-2xl animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
              <BellRing className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                  تنبيه اقتراب موعد صدور الخبر
                </span>
                <span className="text-sm font-bold text-white">{activeAlertEvent.titleAr}</span>
              </div>
              <p className="text-xs text-amber-200/90 mt-1">
                العملة: <strong className="text-white">{activeAlertEvent.currency}</strong> • الأصول المتأثرة: {activeAlertEvent.affectedAssets.join(' • ')}
              </p>
              <p className="text-[11px] text-amber-300 font-medium mt-0.5">
                توجيه إدارة المخاطر: اتساع السبريد متوقع أثناء الصدور. يُنصح بمراجعة مواقع وقف الخسارة وتجنب فتح صفقات عشوائية قبل استقرار السعر.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => playEconomicEventChime(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-600/60 hover:bg-amber-600 text-amber-100 text-xs font-bold transition flex items-center gap-1"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>إعادة الصوت</span>
            </button>
            <button
              onClick={() => setActiveAlertEvent(null)}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer transition shadow"
            >
              استوعبت التنبيه ✓
            </button>
          </div>
        </div>
      )}

      {/* 1. Header & Monetary Policy Regime */}
      <div className="bg-[#0d121f] rounded-2xl border border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-slate-950 shadow-lg shadow-sky-500/20 shrink-0">
              <Globe className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  لوحة الاقتصاد الكلي والمفكرة الاقتصادية الذكية (Macroeconomic Intelligence & Calendar)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  بيانات معتمدة ومحدثة
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                بيانات السياسة النقدية الأمريكية والعالمية، عوائد السندات، وتفسير أثرها الميكانيكي على الذهب، الفضة، العملات الأجنبية، والكريبتو مع نظام تنبيهات الأخبار على مدار أسبوع.
              </p>
            </div>
          </div>

          {/* Sync Button & Regime Badge */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshLive}
              disabled={isLoadingLive}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="تحديث فوري لبيانات الاقتصاد الكلي من المصادر الرسمية"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLive ? 'animate-spin text-sky-400' : 'text-slate-400'}`} />
              <span>{isLoadingLive ? 'جارِ التحديث...' : 'تحديث البيانات الحية'}</span>
            </button>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <span className="text-slate-400">نظام السوق الكلي:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{report.overallMarketRegime}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Monetary policy summary card */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200">موقف السياسة النقدية (Federal Reserve):</span>
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {report.monetaryPolicyState.bias}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                المصدر: Board of Governors of the Federal Reserve (FRED)
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {report.monetaryPolicyState.summary}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono">
            <span className="text-[10px] text-slate-400 block">نطاق الفائدة الفيدرالية المستهدف</span>
            <span className="text-amber-400 font-black text-base">{report.monetaryPolicyState.fedFundsRate}</span>
          </div>
        </div>

        {/* Sector Macro Tailwind Scores */}
        {report.macroScoreBySector && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400">🪙 الذهب (XAU):</span>
              <span className="font-bold text-emerald-400">+{report.macroScoreBySector.gold}% صاعد</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400">🥈 الفضة (XAG):</span>
              <span className="font-bold text-emerald-400">+{report.macroScoreBySector.silver}% صاعد قوي</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400">💱 الفوركس (Majors):</span>
              <span className="font-bold text-amber-400">+{report.macroScoreBySector.forex}% محايد/متباين</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400">⚡ الكريبتو (Crypto):</span>
              <span className="font-bold text-emerald-400">+{report.macroScoreBySector.crypto}% صاعد</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Key Macro Indicators Matrix with Verified Sources */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              المؤشرات الاقتصادية الكلية الحاكمة للأسواق (معتمدة من مصادرها الرسمية)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            مصادر معتمدة: FRED • BLS • US Treasury • BEA • ECB • ICE • LBMA • Alternative.me
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {report.keyIndicators.map((ind) => (
            <div
              key={ind.id}
              className="p-4 rounded-2xl bg-[#0d121f] border border-slate-800 space-y-3 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-white leading-snug">{ind.nameAr}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{ind.nameEn}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {ind.trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  ) : ind.trend === 'down' ? (
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                  ) : (
                    <span className="text-slate-500 font-mono text-[10px]">مستقر</span>
                  )}
                </div>
              </div>

              {/* Current Value & Previous */}
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-xl font-black font-mono text-white">{ind.currentValue}</span>
                  <span className="text-[10px] text-slate-400 mr-2 font-mono">
                    (السابق: {ind.previousValue})
                  </span>
                </div>
                {ind.isLive && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
                    لحظي مباشر ●
                  </span>
                )}
              </div>

              {/* Institutional Source Citation */}
              <div className="text-[10px] px-2 py-1 rounded bg-slate-950/70 border border-slate-800/80 text-slate-400 font-mono flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 truncate">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">المصدر: {ind.source}</span>
                </div>
                {ind.sourceUrl && (
                  <a
                    href={ind.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-300 shrink-0"
                    title="الاطلاع على المصدر الرسمي"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>

              {/* Asset Impact Tags */}
              <div className="flex flex-wrap gap-1 font-mono text-[9px] pt-1 border-t border-slate-800/60">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  الذهب: {ind.goldImpact}
                </span>
                {ind.silverImpact && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-400/10 text-slate-300 border border-slate-400/20">
                    الفضة: {ind.silverImpact}
                  </span>
                )}
                {ind.forexImpact && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    الفوركس: {ind.forexImpact}
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  الكريبتو: {ind.cryptoImpact}
                </span>
              </div>

              {/* Economic Mechanism */}
              <p className="text-[11px] text-slate-300 leading-relaxed pt-1 border-t border-slate-800/80">
                {ind.mechanismExplanation}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Cross-Asset Macro Correlation & Transmission Matrix */}
      {report.crossAssetImpactMatrix && (
        <div className="bg-[#0d121f] rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold text-white">
                مصفوفة الارتباط والتأثير الميكانيكي على فئات الأصول (Cross-Asset Transmission Channels)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              كيف تنتقل الصدمات الاقتصادية الكلية وقرارات الفائدة عبر الأصول المختلفة
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#111827] text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">المحرك الاقتصادي الكلي</th>
                  <th className="py-2.5 px-3">الذهب (XAU)</th>
                  <th className="py-2.5 px-3">الفضة (XAG)</th>
                  <th className="py-2.5 px-3">الفوركس (Majors)</th>
                  <th className="py-2.5 px-3">الكريبتو (BTC)</th>
                  <th className="py-2.5 px-3">قناة الانتقال الميكانيكي (Transmission Mechanism)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {report.crossAssetImpactMatrix.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40 transition">
                    <td className="py-3 px-3 font-bold text-white font-sans whitespace-nowrap">
                      {item.indicatorName}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          item.impactOnGold === 'صاعد'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : item.impactOnGold === 'هابط'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.impactOnGold}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          item.impactOnSilver === 'صاعد'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : item.impactOnSilver === 'هابط'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.impactOnSilver}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          item.impactOnForex.includes('صاعد للدولار')
                            ? 'bg-amber-500/10 text-amber-300'
                            : item.impactOnForex.includes('سلبي للدولار')
                            ? 'bg-sky-500/10 text-sky-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.impactOnForex}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          item.impactOnCrypto === 'صاعد'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : item.impactOnCrypto === 'هابط'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.impactOnCrypto}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-sans text-[11px] leading-relaxed">
                      {item.transmissionChannel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. 7-Day Economic Calendar & News Alerts System (المفكرة الاقتصادية على مدار أسبوع ونظام المنبه) */}
      <div className="bg-[#0d121f] rounded-2xl border border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  المفكرة الاقتصادية الأسبوعية ومنبه الأخبار الذكي (7-Day Rolling Calendar & News Alarms)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  15 - 22 أكتوبر 2026
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                جدول زمني شامل لأهم أحداث الأسبوع مع منبه صوتي، إشعارات المتصفح، وعداد تنازلي دقيق بالثواني قبل صدور كل خبر.
              </p>
            </div>
          </div>

          {/* Action Toolbar: Alarm lead time & Arm All */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Lead time selector */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 px-1.5 font-medium">وقت التنبيه المسبق:</span>
              {[5, 15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setSelectedLeadTime(mins)}
                  className={`px-2 py-0.5 rounded-lg font-mono font-bold transition cursor-pointer ${
                    selectedLeadTime === mins
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mins} د
                </button>
              ))}
            </div>

            {/* Arm all high-impact toggle */}
            <button
              onClick={handleToggleAllHighImpact}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition cursor-pointer shadow-sm"
              title="تفعيل التنبيه الصوتي والإشعارات لجميع الأخبار عالية الأهمية للأسبوع"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>تنبيه لكافة أخبار الأسبوع الكبرى</span>
            </button>

            {/* Chime test button */}
            <button
              onClick={() => playEconomicEventChime(false)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="تجربة صوت منبه الأخبار المؤسسي"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              <span>تجربة الرنة</span>
            </button>

            {/* Browser notification permission button */}
            {notificationPermission !== 'granted' && (
              <button
                onClick={requestNotification}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="السماح بإشعارات المتصفح عند اقتراب الخبر"
              >
                <span>إشعارات المتصفح</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls: Date, Importance, and Currency */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCalendarFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                calendarFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              جميع أخبار الأسبوع ({report.upcomingEvents.length})
            </button>
            <button
              onClick={() => setCalendarFilter('high_only')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                calendarFilter === 'high_only'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>عالية التأثير فقط ({report.upcomingEvents.filter((e) => e.importance === 'high').length})</span>
            </button>
            <button
              onClick={() => setCalendarFilter('today_only')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                calendarFilter === 'today_only'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              أخبار اليوم (15 أكتوبر)
            </button>
            <button
              onClick={() => setCalendarFilter('tomorrow_only')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                calendarFilter === 'tomorrow_only'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              أخبار الغد (16 أكتوبر)
            </button>
          </div>

          {/* Currency Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 font-mono text-[11px]">
            <span className="text-slate-400 px-1 text-[10px]">العملة:</span>
            {['ALL', 'USD', 'EUR', 'GBP', 'CNY'].map((curr) => (
              <button
                key={curr}
                onClick={() => setCurrencyFilter(curr)}
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                  currencyFilter === curr
                    ? 'bg-slate-800 text-amber-400 border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {curr === 'ALL' ? 'الكل' : curr}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-slate-400 font-mono">
            المنبهات النشطة: <strong className="text-amber-400">{armedAlarmsCount}</strong> منبهات
          </span>
        </div>

        {/* Calendar Events Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#111827] text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">المنبه</th>
                <th className="py-2.5 px-3">التاريخ والتوقيت (UTC)</th>
                <th className="py-2.5 px-3">الحدث الاقتصادي</th>
                <th className="py-2.5 px-3">العملة</th>
                <th className="py-2.5 px-3">الأهمية</th>
                <th className="py-2.5 px-3">السابق</th>
                <th className="py-2.5 px-3">التقدير</th>
                <th className="py-2.5 px-3">الفعلي</th>
                <th className="py-2.5 px-3">العداد التنازلي</th>
                <th className="py-2.5 px-3 text-center">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {filteredEvents.map((ev) => {
                const alarm = alarms.find((a) => a.eventId === ev.id);
                const isArmed = Boolean(alarm?.enabled);
                const countdown = formatCountdown(ev.timestampMs);
                const isExpanded = expandedEventId === ev.id;

                return (
                  <React.Fragment key={ev.id}>
                    <tr
                      className={`hover:bg-slate-900/50 transition ${
                        isArmed ? 'bg-amber-500/[0.04]' : ''
                      }`}
                    >
                      {/* Alarm Toggle Column */}
                      <td className="py-3 px-3">
                        <button
                          onClick={() => handleToggleAlarm(ev.id)}
                          className={`p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                            isArmed
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400'
                          }`}
                          title={isArmed ? 'إيقاف المنبه' : `تفعيل منبه صوتي قبل الخبر بـ ${selectedLeadTime} دقيقة`}
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span className="text-[10px] hidden sm:inline">
                            {isArmed ? 'مفعّل' : 'تنبيه'}
                          </span>
                        </button>
                      </td>

                      {/* Date and UTC time */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                        <div>
                          <span>{ev.date}</span>
                          <span className="text-amber-400 block text-[10px] font-bold">{ev.time}</span>
                        </div>
                      </td>

                      {/* Title & Affected Assets */}
                      <td className="py-3 px-3 font-sans">
                        <div>
                          <span className="font-bold text-white block leading-snug">{ev.titleAr}</span>
                          <div className="flex flex-wrap gap-1 mt-1 font-mono text-[9px]">
                            {ev.affectedAssets.map((asset, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 border border-slate-800"
                              >
                                {asset}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Currency */}
                      <td className="py-3 px-3 font-bold text-amber-400">{ev.currency}</td>

                      {/* Importance */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-sans ${
                            ev.importance === 'high'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {ev.importance === 'high' ? 'عالي 🔴' : 'متوسط 🟡'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-400">{ev.previous}</td>
                      <td className="py-3 px-3 text-slate-200">{ev.forecast}</td>
                      <td className="py-3 px-3">
                        {ev.actual ? (
                          <span className="font-bold text-emerald-400">{ev.actual}</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      {/* Live Countdown column */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                            countdown.isPast
                              ? 'bg-slate-900 text-slate-500'
                              : countdown.isClose
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                              : 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                          }`}
                        >
                          {countdown.text}
                        </span>
                      </td>

                      {/* Expand Chevron */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                          className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
                          title="عرض التحليل الميكانيكي وأثر الخبر على الأصول"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Mechanistic Impact Details */}
                    {isExpanded && (
                      <tr className="bg-slate-900/80 font-sans">
                        <td colSpan={10} className="p-4 border-t border-slate-800 space-y-3">
                          <h5 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5" />
                            <span>التحليل الميكانيكي لانعكاس {ev.titleAr} على الأسواق:</span>
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                              <span className="text-[11px] font-bold text-amber-400 block">🪙 أثر الذهب (XAU):</span>
                              <p className="text-[11px] text-slate-300 leading-relaxed">{ev.goldMechanisticImpact}</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                              <span className="text-[11px] font-bold text-slate-300 block">🥈 أثر الفضة (XAG):</span>
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                {ev.silverMechanisticImpact || 'تفاعل تماثلي مع تحركات الذهب ببيتا أعلى.'}
                              </p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                              <span className="text-[11px] font-bold text-blue-400 block">💱 أثر أزواج الفوركس:</span>
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                {ev.forexMechanisticImpact || 'تأثير مباشر على مؤشر الدولار DXY والعملات المقابلة.'}
                              </p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                              <span className="text-[11px] font-bold text-emerald-400 block">⚡ أثر الكريبتو (BTC):</span>
                              <p className="text-[11px] text-slate-300 leading-relaxed">{ev.cryptoMechanisticImpact}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Four-Asset Three-Tier Mechanistic Inference Engine (الذهب • الفضة • الفوركس • الكريبتو) */}
      <div className="bg-[#0d121f] rounded-2xl border border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                محرك الاستدلال الاقتصادي ثلاثي المستويات (Three-Tier Mechanistic Inference)
              </h3>
              <p className="text-[11px] text-slate-400">
                الفصل الصارم بين البيانات الواقعية المثبتة، آليات التأثير الاقتصادي، والفرضيات الاحتمالية وسيناريوهات التحوط
              </p>
            </div>
          </div>

          {/* Asset Selection Tabs (Gold, Silver, Forex, Crypto) */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedAssetTab('gold')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedAssetTab === 'gold'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🪙 الذهب XAUUSD</span>
            </button>

            <button
              onClick={() => setSelectedAssetTab('silver')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedAssetTab === 'silver'
                  ? 'bg-slate-200 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🥈 الفضة XAGUSD</span>
            </button>

            <button
              onClick={() => setSelectedAssetTab('forex')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedAssetTab === 'forex'
                  ? 'bg-blue-500 text-white font-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>💱 أزواج الفوركس Majors</span>
            </button>

            <button
              onClick={() => setSelectedAssetTab('crypto')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedAssetTab === 'crypto'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⚡ الكريبتو BTC & Crypto</span>
            </button>
          </div>
        </div>

        {/* Dynamic Content based on selected asset */}
        {(() => {
          const synthesis =
            selectedAssetTab === 'gold'
              ? report.goldMacroSynthesis
              : selectedAssetTab === 'silver'
              ? report.silverMacroSynthesis
              : selectedAssetTab === 'forex'
              ? report.forexMacroSynthesis
              : report.cryptoMacroSynthesis;

          const assetTitle =
            selectedAssetTab === 'gold'
              ? 'الذهب (XAUUSD / PAXG)'
              : selectedAssetTab === 'silver'
              ? 'الفضة الحرة (XAGUSD)'
              : selectedAssetTab === 'forex'
              ? 'أزواج العملات الأجنبية الرئيسية (EURUSD, GBPUSD, USDJPY)'
              : 'العملات الرقمية (Bitcoin & Altcoins)';

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <span className="text-slate-300 font-semibold">
                  الانحياز الاقتصادي الكلي لـ {assetTitle}:
                </span>
                <span
                  className={`font-bold flex items-center gap-1 font-mono ${
                    synthesis.bias === 'صاعد'
                      ? 'text-emerald-400'
                      : synthesis.bias === 'هابط'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>
                    {synthesis.bias} ({synthesis.alignmentWithTechnical})
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Pillar 1: Factual Data */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>1. بيانات واقعية مثبتة وموثقة بالمصادر</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                    {synthesis.factualData.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>

                {/* Pillar 2: Economic Mechanism */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-sky-400">
                    <Info className="w-4 h-4" />
                    <span>2. آلية وقنوات التأثير الاقتصادي</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                    {synthesis.economicMechanism.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>

                {/* Pillar 3: Probabilistic Hypotheses */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                    <span>3. الفرضيات والتوقعات الاحتمالية</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                    {synthesis.probabilisticHypothesis.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
