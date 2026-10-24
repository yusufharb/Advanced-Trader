/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { TechnicalReport, SchoolStatus, AstroMarketEvent } from '../types/market.ts';
import { ASTRO_MARKET_EVENTS_2026_2028 } from '../services/schools/astro-school.ts';
import {
  BookOpen,
  Activity,
  Compass,
  Waves,
  Hash,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Flame,
  Zap,
  Filter,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  Moon,
  Sun,
  Orbit,
  Maximize2,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';

interface SchoolsMatrixProps {
  report: TechnicalReport;
}

export const SchoolsMatrix: React.FC<SchoolsMatrixProps> = ({ report }) => {
  const [activeTab, setActiveTab] = useState<string>('numerical');
  const schools = report.schools;

  // Astro Calendar Explorer Filters
  const [astroImpactFilter, setAstroImpactFilter] = useState<'all' | 'extreme' | 'strong' | 'above_average'>('all');
  const [astroYearFilter, setAstroYearFilter] = useState<'all' | '2026' | '2027' | '2028'>('all');
  const [astroBodyFilter, setAstroBodyFilter] = useState<string>('all');
  const [astroSearchQuery, setAstroSearchQuery] = useState<string>('');
  const [expandedAstroEventId, setExpandedAstroEventId] = useState<string | null>(null);

  const getStatusBadge = (status: SchoolStatus) => {
    switch (status) {
      case 'مكتملة':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            <span>مكتملة</span>
          </span>
        );
      case 'تجريبية':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/70 border border-amber-800/80 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" />
            <span>تجريبية</span>
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
            غير متاحة
          </span>
        );
    }
  };

  const tabs = [
    { id: 'classical', label: 'المدرسة الكلاسيكية', icon: BookOpen, status: schools.classical.status },
    { id: 'priceAction', label: 'السلوك السعري (Price Action)', icon: Activity, status: schools.priceAction.status },
    { id: 'harmonic', label: 'الهارمونيك وفيبوناتشي', icon: Compass, status: schools.harmonic.status },
    { id: 'elliott', label: 'موجات إليوت', icon: Waves, status: schools.elliott.status },
    { id: 'numerical', label: 'التحليل الرقمي والزمني (غان)', icon: Hash, status: schools.numerical.status },
    { id: 'astro', label: 'التحليل الفلكي والأحداث الكونية حتى 2028', icon: Sparkles, status: schools.astro.status },
  ];

  // Filtered Astro Events
  const filteredAstroEvents = useMemo(() => {
    return ASTRO_MARKET_EVENTS_2026_2028.filter((ev) => {
      // Year filter
      if (astroYearFilter !== 'all' && !ev.date.startsWith(astroYearFilter)) {
        return false;
      }

      // Impact filter
      if (astroImpactFilter !== 'all' && ev.impactLevel !== astroImpactFilter) {
        return false;
      }

      // Body filter
      if (astroBodyFilter !== 'all' && !ev.celestialBodies.includes(astroBodyFilter)) {
        return false;
      }

      // Search query
      if (astroSearchQuery.trim()) {
        const q = astroSearchQuery.toLowerCase();
        const matchesTitle = ev.titleAr.toLowerCase().includes(q) || ev.titleEn.toLowerCase().includes(q);
        const matchesCorr = ev.marketCorrelation.toLowerCase().includes(q);
        const matchesAssets = ev.affectedAssets.some((a) => a.toLowerCase().includes(q));
        if (!matchesTitle && !matchesCorr && !matchesAssets) {
          return false;
        }
      }

      return true;
    });
  }, [astroYearFilter, astroImpactFilter, astroBodyFilter, astroSearchQuery]);

  const nowMs = Date.now();

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d121f] p-5 text-slate-200 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>مصفوفة المدارس الفنية والتحليل المتعدد المتقدم</span>
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              تكامل كمي ورقمي وفلكي
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            فحص حركة السعر عبر 6 مدارس تحليلية مستقلة مع التركيز المؤسسي على معادلات غان ومربع التسعة والتقويم الفلكي المالي حتى 31/12/2028.
          </p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 pb-2 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300 shadow-sm'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              {getStatusBadge(t.status)}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-5">
        {/* 1. Classical School */}
        {activeTab === 'classical' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-sm font-bold text-slate-100">نتائج التحليل الكلاسيكي ونظرية داو</span>
              <span className="text-xs text-slate-400">
                مستوى إبطال الاتجاه: <strong className="font-mono text-amber-400">{schools.classical.invalidationLevel.toFixed(2)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-400 block">الاتجاه الكلاسيكي</span>
                <strong
                  className={`text-base font-bold ${
                    schools.classical.trend === 'صاعد'
                      ? 'text-emerald-400'
                      : schools.classical.trend === 'هابط'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {schools.classical.trend}
                </strong>
              </div>
              <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-400 block">النموذج السعري المرصود</span>
                <strong className="text-xs text-slate-200 font-semibold">
                  {schools.classical.primaryPattern || 'لا توجد قمة/قاع مزدوج قاطع'}
                </strong>
              </div>
              <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-400 block">حالة النموذج</span>
                <span className="text-xs font-mono text-amber-400 font-bold">
                  {schools.classical.patternStatus || 'غير محدد'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1 font-semibold text-emerald-400">مستويات الدعم الرئيسية المحسوبة:</span>
                <div className="flex flex-wrap gap-2">
                  {schools.classical.supports.length > 0 ? (
                    schools.classical.supports.map((s, idx) => (
                      <span key={idx} className="font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300">
                        {s.toFixed(2)}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">لا توجد مستويات دعم متكتلة قريبة</span>
                  )}
                </div>
              </div>

              <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1 font-semibold text-rose-400">مستويات المقاومة الرئيسية المحسوبة:</span>
                <div className="flex flex-wrap gap-2">
                  {schools.classical.resistances.length > 0 ? (
                    schools.classical.resistances.map((r, idx) => (
                      <span key={idx} className="font-mono px-2 py-0.5 rounded bg-rose-950/70 border border-rose-800 text-rose-300">
                        {r.toFixed(2)}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">لا توجد مستويات مقاومة متكتلة قريبة</span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              {schools.classical.summary}
            </p>
          </div>
        )}

        {/* 2. Price Action School */}
        {activeTab === 'priceAction' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-sm font-bold text-slate-100">سلوك السعر وهيكل السيولة المؤسسية (SMC / Price Action)</span>
              <span className="text-xs text-slate-400">
                مستوى الإبطال: <strong className="font-mono text-amber-400">{schools.priceAction.invalidationLevel.toFixed(2)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">هيكل السوق (Market Structure):</span>
                <strong className="text-sm font-bold text-sky-400 block">
                  {schools.priceAction.marketStructure}
                </strong>
              </div>

              <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">كتل الأوامر (Order Blocks):</span>
                <span className="font-mono text-slate-200">
                  {schools.priceAction.orderBlocks.length} مناطق مفحوصة
                </span>
              </div>
            </div>

            <div className="bg-[#111827] p-3 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 block mb-1">الفجوات السعرية العادلة (Fair Value Gaps - FVG):</span>
              <div className="flex flex-wrap gap-2">
                {schools.priceAction.fairValueGaps.length > 0 ? (
                  schools.priceAction.fairValueGaps.map((fvg, idx) => (
                    <span
                      key={idx}
                      className={`font-mono px-2 py-0.5 rounded text-[11px] border ${
                        fvg.type === 'bullish_fvg'
                          ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                          : 'bg-rose-950/60 border-rose-800 text-rose-300'
                      }`}
                    >
                      [{fvg.bottom.toFixed(2)} - {fvg.top.toFixed(2)}] {fvg.type === 'bullish_fvg' ? 'صاعدة' : 'هابطة'}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">لا توجد فجوات FVG نشطة غير ممتلئة</span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              {schools.priceAction.summary}
            </p>
          </div>
        )}

        {/* 3. Harmonic School */}
        {activeTab === 'harmonic' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-sm font-bold text-slate-100">الهارمونيك ومستويات فيبوناتشي الهندسية</span>
              <span className="text-xs text-slate-400">
                الأنماط المرصودة: <strong className="font-mono text-amber-400">{schools.harmonic.detectedPatterns.length}</strong>
              </span>
            </div>

            {schools.harmonic.detectedPatterns.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {schools.harmonic.detectedPatterns.map((pat, idx) => (
                  <div key={idx} className="bg-[#111827] p-3.5 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{pat.name} ({pat.type === 'bullish' ? 'صاعد' : 'هابط'})</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {pat.isComplete ? 'مكتمل' : 'قيد التشكل'}
                      </span>
                    </div>
                    <div className="text-slate-300 space-y-1 font-mono text-[11px]">
                      <div>منطقة الانعكاس المحتملة PRZ: <strong className="text-emerald-400">[{pat.prz.start.toFixed(2)} - {pat.prz.end.toFixed(2)}]</strong></div>
                      <div>نسبة النقطة B: <strong className="text-sky-400">{pat.bRatio.toFixed(3)}</strong> | نسبة النقطة D: <strong className="text-sky-400">{pat.dRatio.toFixed(3)}</strong></div>
                      <div>مستوى إبطال النموذج: <strong className="text-rose-400">{pat.invalidationLevel.toFixed(2)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                لم يتم رصد نموذج هارمونيك متوافق مع نسب فيبوناتشي الصارمة في النطاق السعري الحالي.
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              {schools.harmonic.summary}
            </p>
          </div>
        )}

        {/* 4. Elliott Wave School */}
        {activeTab === 'elliott' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-sm font-bold text-slate-100">موجات إليوت والترقيم الاحتمالي</span>
              <span className="text-xs text-slate-400">
                مستوى الإبطال: <strong className="font-mono text-amber-400">{schools.elliott.invalidationLevel.toFixed(2)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">العد الموجي المرجح:</span>
                <strong className="text-sm font-bold text-amber-300 block">
                  {schools.elliott.probableCount}
                </strong>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  الموجة الحالية: <strong className="text-slate-200">{schools.elliott.currentWave}</strong>
                </span>
              </div>

              <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">السيناريو البديل:</span>
                <strong className="text-xs text-slate-300 block">
                  {schools.elliott.alternateCount || 'لا يوجد سيناريو بديل موازٍ'}
                </strong>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  مطابقة القواعد الصارمة: <strong className={schools.elliott.rulesValidated ? 'text-emerald-400' : 'text-amber-400'}>{schools.elliott.rulesValidated ? 'مدققة بالكامل' : 'احتمالية غير مؤكدة'}</strong>
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              {schools.elliott.summary}
            </p>
          </div>
        )}

        {/* 5. Enhanced Numerical and Time Analysis School (غان، مربع التسعة، موري ماث) */}
        {activeTab === 'numerical' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Hash className="w-4 h-4 text-amber-400" />
                  <span>التحليل الرقمي والزمني المتقدم (W.D. Gann, Square of 9, Murrey Math)</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  تكامل زوايا غان الهندسية، شبكة مربع التسعة التفاعلية، أوكتافات موري الرياضية 0/8 - 8/8، واختبار تربيع السعر والزمن.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                نقطة الارتكاز: <strong className="text-amber-400">{schools.numerical.anchorPoint ? schools.numerical.anchorPoint.price.toFixed(2) : '-'}</strong>
              </span>
            </div>

            {/* Price-Time Squaring Banner */}
            {schools.numerical.priceTimeSquareStatus && (
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                  schools.numerical.priceTimeSquareStatus.isSquared
                    ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">تربيع السعر والزمن (Squaring of Price and Time):</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                        schools.numerical.priceTimeSquareStatus.isSquared
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {schools.numerical.priceTimeSquareStatus.isSquared ? 'متحقق بالكامل ✓' : 'قيد التشكل التناسبي'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {schools.numerical.priceTimeSquareStatus.explanation}
                  </p>
                </div>
              </div>
            )}

            {/* Murrey Math Octaves Ladder (0/8 to 8/8) */}
            {schools.numerical.murreyMathOctaves && (
              <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    <span>سلم أوكتافات موري ماث الرياضي (Murrey Math Octaves 0/8 - 8/8):</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">نظام التوازن الهندسي ذو الـ 8 أجزاء</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs font-mono">
                  {schools.numerical.murreyMathOctaves.map((oct, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border flex flex-col justify-between ${
                        oct.octave === '4/8'
                          ? 'bg-sky-950/40 border-sky-600/60 text-sky-200'
                          : oct.octave === '8/8' || oct.octave === '0/8'
                          ? 'bg-amber-950/30 border-amber-600/40 text-amber-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-amber-400">{oct.octave}</span>
                        <span className="font-bold text-white text-xs">{oct.price.toFixed(2)}</span>
                      </div>
                      <span className="text-[10px] font-sans text-slate-400 leading-tight">
                        {oct.meaning}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gann Geometric Angles (1x8 to 8x1) */}
            {schools.numerical.gannAngles && (
              <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>مروحة زوايا غان الهندسية (W.D. Gann Angle Grid):</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    زاوية التوازن $1\times 1$ تمثل 45°
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-mono">
                  {schools.numerical.gannAngles.map((angle, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border ${
                        angle.angleName.includes('1x1')
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-amber-300">{angle.angleName}</span>
                        <strong className="text-white text-xs">{angle.priceLevel.toFixed(2)}</strong>
                      </div>
                      <p className="text-[10px] font-sans text-slate-400 leading-snug">
                        {angle.significance}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Square of 9 Angles & Time Cycles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Square of Nine Harmonics */}
              <div className="bg-[#111827] p-3.5 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-amber-400 block">
                  مستويات زوايا مربع التسعة التفاعلي (Square of 9):
                </span>
                <p className="text-[11px] text-slate-400">
                  المحاور الكاردينالية (90°, 180°, 270°, 360°) والصلبان الثابتة (45°, 135°, 225°, 315°):
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {schools.numerical.squareOfNineHarmonics.map((num, idx) => (
                    <span
                      key={idx}
                      className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-200 font-bold"
                    >
                      {num.toFixed(1)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Fibonacci & Lucas Time Cycles */}
              <div className="bg-[#111827] p-3.5 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-sky-400 block">
                  دورات فيبوناتشي ولوكاس الزمنية المتوقعة (Time Harmonics):
                </span>
                <p className="text-[11px] text-slate-400">
                  إسقاط النوافذ الانعكاسية (شمعة / يوم تداول) انطلاقاً من نقطة الارتكاز:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {schools.numerical.timeCycleDays.map((days, idx) => (
                    <span
                      key={idx}
                      className="font-mono text-xs px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/80 text-sky-300 font-bold"
                    >
                      فيبو +{days}
                    </span>
                  ))}
                  {schools.numerical.lucasTimeCycles?.map((days, idx) => (
                    <span
                      key={`l-${idx}`}
                      className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 font-bold"
                    >
                      لوكاس +{days}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
              {schools.numerical.summary}
            </p>
          </div>
        )}

        {/* 6. Comprehensive Astro-Financial School & Astronomical Events Database Through 2028 */}
        {activeTab === 'astro' && (
          <div className="space-y-5">
            {/* Scientific Disclaimer */}
            <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-900/50 text-xs text-amber-200/90 space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>الضوابط المنهجية والأخلاقية لتحليل دورات الكواكب لـ W.D. Gann:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {schools.astro.disclaimer}
              </p>
            </div>

            {/* Current Real-Time Planetary & Lunar Diagnostics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Lunar Phase with illumination progress bar */}
              <div className="bg-[#111827] p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5 font-bold">
                    <Moon className="w-4 h-4 text-amber-300" />
                    <span>الطور القمري الحالي:</span>
                  </span>
                  <span className="font-mono font-bold text-amber-400">
                    {schools.astro.lunarIlluminationPercent ?? 50}%
                  </span>
                </div>
                <strong className="text-xs font-bold text-white block leading-snug">
                  {schools.astro.lunarPhase}
                </strong>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-400 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${schools.astro.lunarIlluminationPercent ?? 50}%` }}
                  />
                </div>
              </div>

              {/* Solar Longitude & Gann Seasonal Turning Point */}
              <div className="bg-[#111827] p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-slate-400 flex items-center gap-1.5 font-bold">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>موقع الشمس وبوابات غان الفصلية:</span>
                </span>
                <strong className="text-xs font-bold text-white block leading-snug">
                  {schools.astro.planetaryCycleAspect}
                </strong>
                <span className="text-[10px] text-slate-400 block font-mono">
                  {schools.astro.gannSeasonalPosition || 'بين المحاور الفصلية الأربعة'}
                </span>
              </div>

              {/* Mercury Retrograde Status */}
              <div className="bg-[#111827] p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5 font-bold">
                    <Orbit className="w-4 h-4 text-sky-400" />
                    <span>حالة عطارد (Mercury Motion):</span>
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      schools.astro.mercuryRetrogradeStatus?.isRetrograde
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {schools.astro.mercuryRetrogradeStatus?.isRetrograde ? 'تراجع نشط' : 'حركة مباشرة'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {schools.astro.mercuryRetrogradeStatus?.phaseDescription}
                </p>
              </div>
            </div>

            {/* Astronomical Market Events Explorer Through Dec 31, 2028 */}
            <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">
                      موسوعة الأحداث الفلكية الكبرى المؤثرة على أسواق المال حتى 31/12/2028
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      قاعدة بيانات موثقة فلكياً تشمل الكسوفات الشمسية والقمرية الكبرى، الاقترانات الكوكبية العظمى، ومحطات التراجع حتى نهاية 2028.
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  {filteredAstroEvents.length} حدث كوني مفحوص
                </span>
              </div>

              {/* Filtering Controls: Year, Impact, Celestial Body, Search */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                {/* Year Filter */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 px-1 font-bold">السنة:</span>
                  {(['all', '2026', '2027', '2028'] as const).map((yr) => (
                    <button
                      key={yr}
                      onClick={() => setAstroYearFilter(yr)}
                      className={`flex-1 py-1 rounded-lg font-mono font-bold transition cursor-pointer text-center ${
                        astroYearFilter === yr
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {yr === 'all' ? 'الكل' : yr}
                    </button>
                  ))}
                </div>

                {/* Impact Filter */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 px-1 font-bold">التأثير:</span>
                  <button
                    onClick={() => setAstroImpactFilter('all')}
                    className={`px-2 py-1 rounded-lg font-bold text-[10px] transition cursor-pointer ${
                      astroImpactFilter === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setAstroImpactFilter('extreme')}
                    className={`px-2 py-1 rounded-lg font-bold text-[10px] transition cursor-pointer ${
                      astroImpactFilter === 'extreme'
                        ? 'bg-rose-500 text-white'
                        : 'text-rose-400 hover:text-white'
                    }`}
                  >
                    🔴 الأقوى
                  </button>
                  <button
                    onClick={() => setAstroImpactFilter('strong')}
                    className={`px-2 py-1 rounded-lg font-bold text-[10px] transition cursor-pointer ${
                      astroImpactFilter === 'strong'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'text-amber-400 hover:text-white'
                    }`}
                  >
                    🟡 قوي
                  </button>
                  <button
                    onClick={() => setAstroImpactFilter('above_average')}
                    className={`px-2 py-1 rounded-lg font-bold text-[10px] transition cursor-pointer ${
                      astroImpactFilter === 'above_average'
                        ? 'bg-sky-500 text-white'
                        : 'text-sky-400 hover:text-white'
                    }`}
                  >
                    🔵 أعلى من المتوسط
                  </button>
                </div>

                {/* Celestial Body Filter */}
                <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">الجرم:</span>
                  <select
                    value={astroBodyFilter}
                    onChange={(e) => setAstroBodyFilter(e.target.value)}
                    className="w-full bg-transparent text-slate-200 text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-slate-900">كافة الأجرام والكواكب</option>
                    <option value="الشمس" className="bg-slate-900">☀️ الشمس (كسوف / اعتدال / انقلاب)</option>
                    <option value="القمر" className="bg-slate-900">🌙 القمر (خسوف / بدر دموي / حضيض)</option>
                    <option value="عطارد" className="bg-slate-900">☿️ عطارد (تراجع وانطلاق مباشر)</option>
                    <option value="الزهرة" className="bg-slate-900">♀️ الزهرة (كوكب المال والذهب)</option>
                    <option value="المريخ" className="bg-slate-900">♂️ المريخ (زوايا التوتر والضغط)</option>
                    <option value="المشتري" className="bg-slate-900">♃ المشتري (التوسع والسيولة الكبرى)</option>
                    <option value="زحل" className="bg-slate-900">♄ زحل (إعادة الهيكلة والنظام المالي)</option>
                    <option value="أورانوس" className="bg-slate-900">♅ أورانوس (طفرات الكريبتو والتكنولوجيا)</option>
                    <option value="نبتون" className="bg-slate-900">♆ نبتون (السيولة والضبابية النقدية)</option>
                    <option value="بلوتو" className="bg-slate-900">♇ بلوتو (صراع القوة الاقتصادية والتحول)</option>
                  </select>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="بحث في الأحداث أو الأصول المتأثرة..."
                    value={astroSearchQuery}
                    onChange={(e) => setAstroSearchQuery(e.target.value)}
                    className="w-full pr-8 pl-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              {/* Events Cards / Table */}
              <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
                {filteredAstroEvents.map((ev) => {
                  const isExpanded = expandedAstroEventId === ev.id;
                  const diffDays = Math.round((ev.timestampMs - nowMs) / (24 * 60 * 60 * 1000));
                  const isNear = Math.abs(diffDays) <= 14;

                  return (
                    <div
                      key={ev.id}
                      className={`p-3.5 rounded-xl border transition ${
                        ev.impactLevel === 'extreme'
                          ? 'bg-rose-950/20 border-rose-900/60 hover:border-rose-700'
                          : ev.impactLevel === 'strong'
                          ? 'bg-amber-950/15 border-amber-900/50 hover:border-amber-700'
                          : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Impact Badge */}
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold font-mono ${
                                ev.impactLevel === 'extreme'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 font-black'
                                  : ev.impactLevel === 'strong'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/50'
                              }`}
                            >
                              {ev.impactLevel === 'extreme'
                                ? '🔴 الأقوى تأثيراً'
                                : ev.impactLevel === 'strong'
                                ? '🟡 تأثير قوي'
                                : '🔵 أعلى من المتوسط'}
                            </span>

                            {/* Date & UTC time */}
                            <span className="font-mono text-xs text-slate-300 font-bold flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-amber-400" />
                              <span>{ev.date}</span>
                              <span className="text-[10px] text-slate-500">({ev.timeUtc} UTC)</span>
                            </span>

                            {/* Countdown / timing indicator */}
                            {diffDays > 0 ? (
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isNear ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'}`}>
                                متبقي {diffDays} يوم
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-500">
                                مرّ قبل {Math.abs(diffDays)} يوم
                              </span>
                            )}
                          </div>

                          <h6 className="text-xs font-bold text-white leading-snug pt-0.5">
                            {ev.titleAr}
                          </h6>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {ev.titleEn}
                          </span>
                        </div>

                        {/* Expand / Collapse Button */}
                        <button
                          onClick={() => setExpandedAstroEventId(isExpanded ? null : ev.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <span>{isExpanded ? 'طي التفاصيل' : 'التحليل المالي'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Celestial Bodies & Affected Assets Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2">
                        <span className="text-[10px] text-slate-500 font-mono">الأجرام:</span>
                        {ev.celestialBodies.map((b, i) => (
                          <span key={i} className="px-1.5 py-0.2 rounded bg-slate-950 text-slate-300 border border-slate-800 text-[10px]">
                            {b}
                          </span>
                        ))}
                        <span className="text-slate-600 px-1">|</span>
                        <span className="text-[10px] text-slate-500 font-mono">الأصول المتأثرة:</span>
                        {ev.affectedAssets.map((asset, i) => (
                          <span key={i} className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px]">
                            {asset}
                          </span>
                        ))}
                      </div>

                      {/* Expanded Financial Correlation & Historical Precedent */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                            <span className="font-bold text-amber-400 block text-[11px] flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5" />
                              <span>الأثر المالي المتوقع ونافذة الانعكاس (Market Correlation):</span>
                            </span>
                            <p className="text-[11px] text-slate-200 leading-relaxed">
                              {ev.marketCorrelation}
                            </p>
                          </div>

                          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                            <span className="font-bold text-sky-400 block text-[11px] flex items-center gap-1">
                              <Info className="w-3.5 h-3.5" />
                              <span>السابقة التاريخية المسجلة في أسواق المال (Historical Precedent):</span>
                            </span>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              {ev.historicalPrecedent}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-slate-400 italic bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 leading-relaxed">
              {schools.astro.historicalCorrelationNote}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
