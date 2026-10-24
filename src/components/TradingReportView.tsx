/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TechnicalReport, PriceAlert, GeminiDiagnosticResult } from '../types/market.ts';
import { AI_UNAVAILABLE_NOTICE_AR } from '../services/ai-synthesizer.ts';
import {
  Printer,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle,
  AlertTriangle,
  FileText,
  Bell,
  Sparkles,
  Check,
  Activity,
  Layers,
  Calculator,
  Copy,
  Globe,
  Calendar,
  Send,
} from 'lucide-react';
import { dispatchReportAlerts, loadAlertSettings } from '../services/alert-dispatcher.ts';

interface TradingReportViewProps {
  report: TechnicalReport;
  onImportReportLevels?: (report: TechnicalReport) => void;
  onAddSingleAlert?: (price: number, type: PriceAlert['levelType'], label: string) => void;
  onOpenAlertsModal?: () => void;
  onOpenAlertSettings?: () => void;
  onOpenRiskCalculator?: (setup?: any) => void;
  activeAlerts?: PriceAlert[];
}

export const TradingReportView: React.FC<TradingReportViewProps> = ({
  report,
  onImportReportLevels,
  onAddSingleAlert,
  onOpenAlertsModal,
  onOpenAlertSettings,
  onOpenRiskCalculator,
  activeAlerts = [],
}) => {
  const [justImported, setJustImported] = useState(false);
  const [copiedSignal, setCopiedSignal] = useState(false);
  const [copiedMt5, setCopiedMt5] = useState(false);
  const [dispatchingAlert, setDispatchingAlert] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [testingAiConnection, setTestingAiConnection] = useState(false);
  const [aiDiagnosticResult, setAiDiagnosticResult] = useState<GeminiDiagnosticResult | null>(null);

  const handleTestAiConnection = async () => {
    setTestingAiConnection(true);
    try {
      const res = await fetch('/api/ai/diagnostics', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (data && data.diagnostic) {
        setAiDiagnosticResult(data.diagnostic as GeminiDiagnosticResult);
      } else {
        setAiDiagnosticResult({
          status: 'UPSTREAM_UNAVAILABLE',
          ok: false,
          model: 'gemini-3.8-flash',
          messageAr: AI_UNAVAILABLE_NOTICE_AR,
          technicalReason: 'تعذر الوصول إلى نقطة فحص خدمة التفسير الذكي على الخادم.',
          checkedAt: new Date().toISOString(),
        });
      }
    } catch {
      setAiDiagnosticResult({
        status: 'UPSTREAM_UNAVAILABLE',
        ok: false,
        model: 'gemini-3.8-flash',
        messageAr: AI_UNAVAILABLE_NOTICE_AR,
        technicalReason: 'تعذر الاتصال بالخادم لفحص حالة Gemini API.',
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setTestingAiConnection(false);
    }
  };

  const handleSendSignalAlert = async () => {
    const settings = loadAlertSettings();
    if (!settings.telegram.enabled && !settings.webhook.enabled) {
      if (onOpenAlertSettings) {
        onOpenAlertSettings();
      } else {
        setDispatchFeedback({
          success: false,
          message: 'يرجى تفعيل بوت Telegram أو رابط Webhook في إعدادات التنبيهات أولاً.',
        });
        setTimeout(() => setDispatchFeedback(null), 4000);
      }
      return;
    }

    setDispatchingAlert(true);
    setDispatchFeedback(null);
    try {
      const results = await dispatchReportAlerts(report, settings);
      const parts: string[] = [];
      let anySuccess = false;

      if (results.telegramResult) {
        if (results.telegramResult.success) anySuccess = true;
        parts.push(`Telegram: ${results.telegramResult.message}`);
      }
      if (results.webhookResult) {
        if (results.webhookResult.success) anySuccess = true;
        parts.push(`Webhook: ${results.webhookResult.message}`);
      }

      setDispatchFeedback({
        success: anySuccess,
        message: parts.join(' | ') || 'تم إرسال التنبيهات بنجاح!',
      });
      setTimeout(() => setDispatchFeedback(null), 4500);
    } catch (err: unknown) {
      setDispatchFeedback({
        success: false,
        message: err instanceof Error ? err.message : 'تعذر إرسال التنبيه.',
      });
      setTimeout(() => setDispatchFeedback(null), 4500);
    } finally {
      setDispatchingAlert(false);
    }
  };

  const formatPriceVal = (val: number | null | undefined): string => {
    if (val === null || val === undefined || !Number.isFinite(val)) return '—';
    const decimals = report.currentPrice < 2 ? 5 : report.currentPrice < 10 ? 4 : report.currentPrice < 200 ? 3 : 2;
    return val.toFixed(decimals);
  };

  const handleCopySignal = () => {
    const s = report.tradeSetup;
    const text = `
📊 إشارة فنية موثقة – ${report.symbol} (${report.timeframe})
━━━━━━━━━━━━━━━━━━━━
• نوع التوصية: ${s.bias === 'شراء' ? 'شراء (LONG) 🟢' : s.bias === 'بيع' ? 'بيع (SHORT) 🔴' : 'مراقبة وحياد ⚪'}
• نطاق الدخول: ${formatPriceVal(s.entryZone.min)} - ${formatPriceVal(s.entryZone.max)}
• وقف الخسارة الصارم (SL): ${formatPriceVal(s.stopLoss)}
• الأهداف الربحية (TP): ${s.targets.map((t, i) => `TP${i + 1}: ${formatPriceVal(t)}`).join(' | ')}
• نسبة العائد للمخاطرة (R:R): 1:${s.riskRewardRatio}
━━━━━━━━━━━━━━━━━━━━
📌 المنطق الفني: ${s.reasoning || report.executiveConclusion}
المصدر: المحلل الفني المتقدم (Advanced Market Analyst)
    `.trim();

    navigator.clipboard.writeText(text);
    setCopiedSignal(true);
    setTimeout(() => setCopiedSignal(false), 2500);
  };

  const handleCopyMt5 = () => {
    const s = report.tradeSetup;
    const text = `
🎯 بطاقة تنفيذ الصفقة (MT4/MT5) – ${report.symbol}
━━━━━━━━━━━━━━━━━━━━
• الإطار الزمني: ${report.timeframe}
• نوع الأمر: ${s.bias === 'شراء' ? 'BUY LIMIT / BUY 🟢' : s.bias === 'بيع' ? 'SELL LIMIT / SELL 🔴' : 'مراقبة وحياد ⚪'}
• منطقة الدخول: ${formatPriceVal(s.entryZone.min)} - ${formatPriceVal(s.entryZone.max)}
• وقف الخسارة (SL): ${formatPriceVal(s.stopLoss)}
• الأهداف الربحية (TP): ${s.targets.map((t, i) => `TP${i + 1}: ${formatPriceVal(t)}`).join(' | ')}
• نسبة العائد للمخاطرة (R:R): 1:${s.riskRewardRatio}
━━━━━━━━━━━━━━━━━━━━
📌 الملاحظات: ${s.reasoning || report.executiveConclusion}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopiedMt5(true);
    setTimeout(() => setCopiedMt5(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleImportAll = () => {
    if (onImportReportLevels) {
      onImportReportLevels(report);
      setJustImported(true);
      setTimeout(() => setJustImported(false), 3500);
    }
  };

  const isLevelAlertActive = (price: number) => {
    return activeAlerts.some((a) => a.isActive && Math.abs(a.targetPrice - price) < 0.01);
  };

  const setup = report.tradeSetup;
  const supports = report.schools.classical.supports;
  const resistances = report.schools.classical.resistances;
  const pivots = report.indicators.pivots;

  return (
    <div className="space-y-6">
      {/* Top Action Bar (hidden when printing) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-[#0d121f] p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <span>التقرير الفني الشامل – {report.symbol} ({report.timeframe})</span>
          </h2>
          <span className="text-xs text-slate-400">
            تقرير تحليلي متعدد المدارس ومثبت بالأرقام الحسابية، جاهز للتصدير والطباعة مع دعم التنبيهات الفورية.
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {onImportReportLevels && (
            <button
              onClick={handleImportAll}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-md cursor-pointer ${
                justImported
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/20'
              }`}
            >
              {justImported ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>تم تفعيل تنبيهات المستويات!</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 text-slate-950" />
                  <span>تفعيل تنبيهات الدعوم والمقاومات</span>
                </>
              )}
            </button>
          )}

          {onOpenAlertsModal && (
            <button
              onClick={onOpenAlertsModal}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <Activity className="w-4 h-4 text-amber-400" />
              <span>إدارة التنبيهات ({activeAlerts.length})</span>
            </button>
          )}

          <button
            onClick={handleCopySignal}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-amber-300 hover:text-white hover:bg-slate-700 shadow-sm transition cursor-pointer"
            title="نسخ ملخص الصفقة والإشارة بتنسيق تيليجرام وواتساب"
          >
            {copiedSignal ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedSignal ? 'تم النسخ بنجاح!' : 'نسخ الإشارة للمجموعات'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-700 shadow-sm transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>طباعة / PDF</span>
          </button>
        </div>
      </div>

      {/* Main Printable Document Sheet */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d121f] print:bg-white print:border-none print:text-black p-6 md:p-8 space-y-6 text-slate-100 print:p-0">
        {/* Document Header */}
        <div className="border-b border-slate-800 print:border-slate-300 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono text-amber-400 print:text-amber-700 tracking-wider font-semibold block">
                تقرير فني متعدد المدارس وموثق
              </span>
              <h1 className="text-2xl font-black text-white print:text-black tracking-tight mt-0.5">
                المحلل الفني المتقدم – {report.symbol}
              </h1>
            </div>

            <div className="text-left font-mono text-xs text-slate-400 print:text-slate-700 space-y-0.5">
              <div>السعر الحالي: <strong className="text-white print:text-black text-base">{report.currentPrice.toFixed(2)}</strong></div>
              <div>الإطار الزمني: <strong>{report.timeframe}</strong></div>
              <div>وقت التحديث: <strong>{new Date(report.lastUpdated).toLocaleString('ar-EG')}</strong></div>
            </div>
          </div>

          <div className="mt-3 text-[11px] font-mono text-slate-400 print:text-slate-600 flex flex-wrap items-center gap-4 bg-slate-950/70 print:bg-slate-100 p-2.5 rounded-lg border border-slate-800/80 print:border-slate-300">
            <span>مصدر البيانات: <strong className="text-amber-300 print:text-amber-800">{report.dataSource}</strong></span>
            <span>حالة الشمعة: <strong className={report.isCandleClosed ? 'text-emerald-400 print:text-emerald-700' : 'text-amber-400 print:text-amber-700'}>{report.isCandleClosed ? 'مكتملة ومغلقة' : 'قيد التكوين'}</strong></span>
            <span>عدد الشموع المحسوبة: <strong className="text-slate-200 print:text-black">{report.candleCount}</strong></span>
          </div>
        </div>

        {/* 1. Quantitative State & Key Indicators Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-amber-400 print:text-amber-800 uppercase tracking-wider">
            01. المؤشرات الكمية المحسوبة قطعيّاً (Deterministic Metrics)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 text-xs">
            <div className="bg-[#111827] print:bg-slate-50 p-3 rounded-lg border border-slate-800 print:border-slate-200">
              <span className="text-slate-400 print:text-slate-600 block text-[11px]">EMA 20 / 50 / 200</span>
              <strong className="font-mono text-slate-100 print:text-black text-[11px] block truncate">
                {report.indicators.ema.ema20?.toFixed(1) ?? '-'} / {report.indicators.ema.ema50?.toFixed(1) ?? '-'} / {report.indicators.ema.ema200?.toFixed(1) ?? '-'}
              </strong>
            </div>

            <div className="bg-[#111827] print:bg-slate-50 p-3 rounded-lg border border-slate-800 print:border-slate-200">
              <span className="text-slate-400 print:text-slate-600 block text-[11px]">مؤشر RSI (14)</span>
              <strong className="font-mono text-slate-100 print:text-black">
                {report.indicators.rsi.value ?? '-'}
              </strong>
              <span className="text-[10px] text-purple-400 block mt-0.5 font-medium">
                {report.indicators.rsi.state === 'overbought' ? 'ذروة شراء' : report.indicators.rsi.state === 'oversold' ? 'ذروة بيع' : 'معتدل'}
              </span>
            </div>

            <div className="bg-[#111827] print:bg-slate-50 p-3 rounded-lg border border-slate-800 print:border-slate-200">
              <span className="text-slate-400 print:text-slate-600 block text-[11px]">مؤشر الماكد MACD</span>
              <strong className="font-mono text-slate-100 print:text-black">
                {report.indicators.macd.macdLine ?? '-'}
              </strong>
              <span className="text-[10px] text-blue-400 block mt-0.5 font-medium">
                {report.indicators.macd.trend === 'bullish' ? 'إيجابي صاعد' : report.indicators.macd.trend === 'bearish' ? 'سلبي هابط' : 'محايد'}
              </span>
            </div>

            <div className="bg-[#111827] print:bg-slate-50 p-3 rounded-lg border border-slate-800 print:border-slate-200">
              <span className="text-slate-400 print:text-slate-600 block text-[11px]">الاستوكاستك Stochastic</span>
              <strong className="font-mono text-amber-300 print:text-black text-[11px] block">
                %K: {report.indicators.stochastic?.k ?? '-'} | %D: {report.indicators.stochastic?.d ?? '-'}
              </strong>
              <span className="text-[10px] text-amber-400 block mt-0.5 font-medium">
                {report.indicators.stochastic?.state === 'overbought' ? 'ذروة شراء' : report.indicators.stochastic?.state === 'oversold' ? 'ذروة بيع' : 'معتدل'}
                {report.indicators.stochastic?.cross === 'bullish_cross' ? ' (تقاطع صاعد)' : report.indicators.stochastic?.cross === 'bearish_cross' ? ' (تقاطع هابط)' : ''}
              </span>
            </div>

            <div className="bg-[#111827] print:bg-slate-50 p-3 rounded-lg border border-slate-800 print:border-slate-200">
              <span className="text-slate-400 print:text-slate-600 block text-[11px]">بولينجر باند Bollinger</span>
              <strong className="font-mono text-slate-100 print:text-black text-[11px] block truncate">
                {report.indicators.bollinger.upper?.toFixed(1) ?? '-'} / {report.indicators.bollinger.lower?.toFixed(1) ?? '-'}
              </strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                عرض: {report.indicators.bollinger.bandwidth?.toFixed(1)}%
              </span>
            </div>

            <div className="bg-[#111827] print:bg-slate-50 p-3 rounded-lg border border-slate-800 print:border-slate-200">
              <span className="text-slate-400 print:text-slate-600 block text-[11px]">متوسط المدى ATR(14)</span>
              <strong className="font-mono text-slate-100 print:text-black">
                {report.indicators.atr.value ?? '-'}
              </strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {report.indicators.atr.volatilityPercent}% تقلب
              </span>
            </div>

            {/* Institutional Metric 1: ADX & Directional Movement */}
            <div className="bg-[#111827] print:bg-slate-50 p-3 rounded-lg border border-slate-800 print:border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 print:text-slate-600 block text-[11px]">قوة الاتجاه (ADX 14)</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  report.indicators.adx?.regime === 'strong_trend'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : report.indicators.adx?.regime === 'trend'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {report.indicators.adx?.regime === 'strong_trend' ? 'اتجاه قوي' : report.indicators.adx?.regime === 'trend' ? 'اتجاه نشط' : 'نطاق تذبذب عرضي'}
                </span>
              </div>
              <strong className="font-mono text-cyan-400 print:text-black text-sm block mt-1">
                ADX: {report.indicators.adx?.adx !== null && report.indicators.adx?.adx !== undefined ? report.indicators.adx.adx : '-'}
              </strong>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                +DI: <span className="text-emerald-400 font-bold">{report.indicators.adx?.plusDI ?? '-'}</span> | -DI: <span className="text-rose-400 font-bold">{report.indicators.adx?.minusDI ?? '-'}</span>
              </span>
            </div>

            {/* Institutional Metric 2: Ichimoku Cloud */}
            <div className="bg-[#111827] print:bg-slate-50 p-3 rounded-lg border border-slate-800 print:border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 print:text-slate-600 block text-[11px]">سحابة إيشيموكو (Ichimoku)</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  report.indicators.ichimoku?.cloudBias === 'bullish_above_cloud'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : report.indicators.ichimoku?.cloudBias === 'bearish_below_cloud'
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}>
                  {report.indicators.ichimoku?.cloudBias === 'bullish_above_cloud'
                    ? 'أعلى السحابة - إيجابي'
                    : report.indicators.ichimoku?.cloudBias === 'bearish_below_cloud'
                    ? 'أسفل السحابة - سلبي'
                    : 'داخل السحابة - حياد'}
                </span>
              </div>
              <strong className="font-mono text-slate-100 print:text-black text-[11px] block mt-1 truncate">
                T: {report.indicators.ichimoku?.tenkanSen ?? '-'} | K: {report.indicators.ichimoku?.kijunSen ?? '-'}
              </strong>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                Span A: {report.indicators.ichimoku?.senkouSpanA ?? '-'} | B: {report.indicators.ichimoku?.senkouSpanB ?? '-'}
              </span>
            </div>

            {/* Institutional Metric 3: Volume & Order Flow */}
            <div className="bg-[#111827] print:bg-slate-50 p-3 rounded-lg border border-slate-800 print:border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 print:text-slate-600 block text-[11px]">السيولة والحجم (Order Flow)</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  report.indicators.volume?.liquidityState === 'high_participation'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : report.indicators.volume?.liquidityState === 'low_liquidity'
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {report.indicators.volume?.liquidityState === 'high_participation' ? 'مشاركة عالية' : report.indicators.volume?.liquidityState === 'low_liquidity' ? 'سيولة منخفضة' : 'طبيعي'}
                </span>
              </div>
              <strong className="font-mono text-amber-300 print:text-black text-[11px] block mt-1 truncate">
                VWAP: {report.indicators.volume?.vwap ?? '-'} | POC: {report.indicators.volume?.poc ?? '-'}
              </strong>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                RVOL: <span className="text-cyan-400 font-bold">{report.indicators.volume?.relativeVolume ?? '-'}x</span> (SMA20: {report.indicators.volume?.volumeSMA20 ? report.indicators.volume.volumeSMA20.toLocaleString() : '-'})
              </span>
            </div>
          </div>
        </div>

        {/* 2. Key Support & Resistance Levels + Price Alerts Triggering */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-amber-400 print:text-amber-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>02. مستويات الدعم والمقاومة وتنبيهات الأسعار الفورية (Price Alerts)</span>
            </h3>

            {onImportReportLevels && (
              <button
                onClick={handleImportAll}
                className="no-print flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/25 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>تفعيل جميع مستويات التقرير فورياً</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Resistances Column */}
            <div className="p-4 rounded-xl bg-[#111827] print:bg-slate-50 border border-slate-800 print:border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="font-bold text-rose-400 print:text-rose-700 flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>مستويات المقاومة المكتشفة (Resistances)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  السعر الحالي: {report.currentPrice.toFixed(2)}
                </span>
              </div>

              {resistances.length === 0 ? (
                <div className="text-slate-500 italic py-2">لم يتم رصد قمم مقاومة واضحة في الإطار الحالي</div>
              ) : (
                <div className="space-y-2">
                  {resistances.slice(0, 3).map((resPrice, idx) => {
                    const isActive = isLevelAlertActive(resPrice);
                    return (
                      <div
                        key={`res-${idx}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 print:bg-slate-100 border border-slate-800/80"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 font-mono text-[10px] font-bold">
                            مقاومة {idx + 1}
                          </span>
                          <strong className="font-mono text-sm text-white print:text-black">
                            {resPrice.toFixed(2)} USD
                          </strong>
                          <span className="text-[10px] font-mono text-slate-400">
                            (+{(((resPrice - report.currentPrice) / report.currentPrice) * 100).toFixed(2)}%)
                          </span>
                        </div>

                        {onAddSingleAlert && (
                          <button
                            onClick={() =>
                              onAddSingleAlert(resPrice, 'resistance', `مقاومة فنية ${idx + 1} (${resPrice.toFixed(2)})`)
                            }
                            className={`no-print flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                              isActive
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                            }`}
                            title={isActive ? 'التنبيه نشط بالفعل' : 'تفعيل تنبيه عند ملامسة المقاومة'}
                          >
                            <Bell className="w-3 h-3 text-amber-400" />
                            <span>{isActive ? 'تنبيه مفعل ✓' : 'تفعيل تنبيه'}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Supports Column */}
            <div className="p-4 rounded-xl bg-[#111827] print:bg-slate-50 border border-slate-800 print:border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="font-bold text-emerald-400 print:text-emerald-700 flex items-center gap-1.5">
                  <ArrowDownRight className="w-4 h-4" />
                  <span>مستويات الدعم المكتشفة (Supports)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  السعر الحالي: {report.currentPrice.toFixed(2)}
                </span>
              </div>

              {supports.length === 0 ? (
                <div className="text-slate-500 italic py-2">لم يتم رصد قيعان دعم واضحة في الإطار الحالي</div>
              ) : (
                <div className="space-y-2">
                  {supports.slice(0, 3).map((supPrice, idx) => {
                    const isActive = isLevelAlertActive(supPrice);
                    return (
                      <div
                        key={`sup-${idx}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 print:bg-slate-100 border border-slate-800/80"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] font-bold">
                            دعم {idx + 1}
                          </span>
                          <strong className="font-mono text-sm text-white print:text-black">
                            {supPrice.toFixed(2)} USD
                          </strong>
                          <span className="text-[10px] font-mono text-slate-400">
                            ({(((supPrice - report.currentPrice) / report.currentPrice) * 100).toFixed(2)}%)
                          </span>
                        </div>

                        {onAddSingleAlert && (
                          <button
                            onClick={() =>
                              onAddSingleAlert(supPrice, 'support', `دعم فني ${idx + 1} (${supPrice.toFixed(2)})`)
                            }
                            className={`no-print flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                              isActive
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                            }`}
                            title={isActive ? 'التنبيه نشط بالفعل' : 'تفعيل تنبيه عند ملامسة الدعم'}
                          >
                            <Bell className="w-3 h-3 text-amber-400" />
                            <span>{isActive ? 'تنبيه مفعل ✓' : 'تفعيل تنبيه'}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pivot Points quick reference */}
          {pivots.p > 0 && (
            <div className="p-3 rounded-xl bg-slate-950/70 print:bg-slate-100 border border-slate-800/80 text-[11px] font-mono flex flex-wrap items-center justify-between gap-3">
              <span className="text-slate-400">
                نقاط الارتكاز الكلاسيكية (Pivots): Pivot: <strong className="text-amber-400">{pivots.p.toFixed(2)}</strong> | R1: <strong className="text-rose-400">{pivots.r1.toFixed(2)}</strong> | S1: <strong className="text-emerald-400">{pivots.s1.toFixed(2)}</strong>
              </span>
              {onAddSingleAlert && (
                <button
                  onClick={() => onAddSingleAlert(pivots.p, 'custom', `نقطة الارتكاز المحورية (${pivots.p.toFixed(2)})`)}
                  className="no-print text-amber-400 hover:text-amber-300 transition text-[11px] font-sans font-semibold cursor-pointer"
                >
                  🔔 تنبيه عند الارتكاز المحوري
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3. Trade Setup Box (Highlights Decision) */}
        <div className={`p-5 rounded-xl border print:border-slate-300 print:bg-slate-50 ${setup.hasSetup ? 'bg-amber-950/20 border-amber-500/40' : 'bg-slate-900/50 border-slate-800'}`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 print:border-slate-300">
            <span className="text-sm font-bold flex items-center gap-2">
              {setup.hasSetup ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
              <span>خطة الدخول وإدارة المخاطر المشروطة:</span>
            </span>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono ${setup.bias === 'شراء' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : setup.bias === 'بيع' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-slate-800 text-slate-300'}`}>
                انحياز: {setup.bias}
              </span>
            </div>
          </div>

          {setup.hasSetup ? (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/60 print:bg-transparent">
                <span className="text-slate-400 print:text-slate-600 block text-[11px]">نطاق الدخول المشروط:</span>
                <strong className="font-mono text-white print:text-black text-sm">
                  {formatPriceVal(setup.entryZone.min)} - {formatPriceVal(setup.entryZone.max)}
                </strong>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 print:bg-transparent">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 print:text-slate-600 block text-[11px]">وقف الخسارة (SL):</span>
                  {onAddSingleAlert && setup.stopLoss > 0 && (
                    <button
                      onClick={() => onAddSingleAlert(setup.stopLoss, 'stop_loss', `وقف الخسارة (${formatPriceVal(setup.stopLoss)})`)}
                      className="no-print text-rose-400 hover:text-rose-300 text-[10px]"
                      title="تفعيل تنبيه وقف الخسارة"
                    >
                      🔔 تنبيه
                    </button>
                  )}
                </div>
                <strong className="font-mono text-rose-400 print:text-rose-700 text-sm">
                  {formatPriceVal(setup.stopLoss)}
                </strong>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 print:bg-transparent">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 print:text-slate-600 block text-[11px]">الأهداف (TP):</span>
                  {onAddSingleAlert && setup.targets.length > 0 && (
                    <button
                      onClick={() => onAddSingleAlert(setup.targets[0], 'target', `الهدف الربحي الأول TP1 (${formatPriceVal(setup.targets[0])})`)}
                      className="no-print text-emerald-400 hover:text-emerald-300 text-[10px]"
                      title="تفعيل تنبيه الهدف"
                    >
                      🔔 تنبيه TP1
                    </button>
                  )}
                </div>
                <strong className="font-mono text-emerald-400 print:text-emerald-700 text-sm">
                  {setup.targets.map(t => formatPriceVal(t)).join(' | ')}
                </strong>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 print:bg-transparent">
                <span className="text-slate-400 print:text-slate-600 block text-[11px]">نسبة العائد للمخاطرة (R:R):</span>
                <strong className="font-mono text-amber-400 print:text-amber-800 text-sm">
                  1 : {setup.riskRewardRatio}
                </strong>
              </div>

              {/* Quick Actions for Setup */}
              <div className="no-print col-span-2 md:col-span-4 flex flex-wrap items-center justify-between gap-2 pt-3 mt-1 border-t border-slate-800/80">
                <div className="text-[11px] text-slate-400">
                  خطة الدخول تتطلب التزاماً صارماً بنسبة المخاطرة وحجم اللوت المحسوب برأس مالك.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSendSignalAlert}
                    disabled={dispatchingAlert}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shadow-sm border border-indigo-500/30"
                    title="إرسال إشارة الصفقة فوراً إلى Telegram أو Webhook"
                  >
                    <Send className="w-3.5 h-3.5 text-indigo-200" />
                    <span>{dispatchingAlert ? 'جارٍ الإرسال...' : 'إرسال الإشارة (Telegram / Webhook)'}</span>
                  </button>

                  <button
                    onClick={handleCopyMt5}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-sm border border-emerald-500/30"
                    title="نسخ ملخص الصفقة جاهزاً للإدخال في منصات MT4 و MT5"
                  >
                    {copiedMt5 ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-emerald-200" />}
                    <span>{copiedMt5 ? 'تم نسخ بطاقة MT4/MT5!' : 'نسخ بطاقة الصفقة (MT4/MT5)'}</span>
                  </button>

                  {onOpenRiskCalculator && (
                    <button
                      onClick={() =>
                        onOpenRiskCalculator({
                          type: setup.bias === 'بيع' ? 'SELL' : 'BUY',
                          entry: (setup.entryZone.min + setup.entryZone.max) / 2,
                          stopLoss: setup.stopLoss,
                          target1: setup.targets[0] || 0,
                          target2: setup.targets[1] || 0,
                        })
                      }
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer shadow-sm"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>حساب حجم اللوت والمخاطرة للمحفظة</span>
                    </button>
                  )}
                </div>

                {dispatchFeedback && (
                  <div
                    className={`w-full mt-2 p-2.5 rounded-lg text-xs border transition-all ${
                      dispatchFeedback.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <span className="font-semibold">{dispatchFeedback.success ? '✓ ' : '✗ '}</span>
                    {dispatchFeedback.message}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-300 print:text-slate-700">
              {setup.reasoning}
            </div>
          )}
        </div>

        {/* 4. Three Market Scenarios (Bullish, Bearish, Neutral) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-amber-400 print:text-amber-800 uppercase tracking-wider">
            03. السيناريوهات الحركية الثلاثة وشروط الإبطال
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Bullish */}
            <div className="p-4 rounded-xl bg-[#111827] print:bg-slate-50 border border-slate-800 print:border-slate-200 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400 print:text-emerald-700">
                <ArrowUpRight className="w-4 h-4" />
                <span>السيناريو الصاعد</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300 print:text-slate-700">
                {report.scenarios.bullish.description}
              </p>
              <div className="pt-2 border-t border-slate-800/80 print:border-slate-200 text-[11px] space-y-1 font-mono">
                <div>الشرط: <span className="text-slate-300 print:text-black">{report.scenarios.bullish.triggerCondition}</span></div>
                <div>الإبطال: <span className="text-rose-400 font-bold">{report.scenarios.bullish.invalidationLevel}</span></div>
                <div>الأهداف: <span className="text-emerald-400 font-bold">{report.scenarios.bullish.target1} - {report.scenarios.bullish.target2}</span></div>
              </div>
            </div>

            {/* Bearish */}
            <div className="p-4 rounded-xl bg-[#111827] print:bg-slate-50 border border-slate-800 print:border-slate-200 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-rose-400 print:text-rose-700">
                <ArrowDownRight className="w-4 h-4" />
                <span>السيناريو الهابط</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300 print:text-slate-700">
                {report.scenarios.bearish.description}
              </p>
              <div className="pt-2 border-t border-slate-800/80 print:border-slate-200 text-[11px] space-y-1 font-mono">
                <div>الشرط: <span className="text-slate-300 print:text-black">{report.scenarios.bearish.triggerCondition}</span></div>
                <div>الإبطال: <span className="text-rose-400 font-bold">{report.scenarios.bearish.invalidationLevel}</span></div>
                <div>الأهداف: <span className="text-emerald-400 font-bold">{report.scenarios.bearish.target1} - {report.scenarios.bearish.target2}</span></div>
              </div>
            </div>

            {/* Neutral */}
            <div className="p-4 rounded-xl bg-[#111827] print:bg-slate-50 border border-slate-800 print:border-slate-200 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-400 print:text-amber-700">
                <Minus className="w-4 h-4" />
                <span>السيناريو المحايد (التذبذب)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300 print:text-slate-700">
                {report.scenarios.neutral.description}
              </p>
              <div className="pt-2 border-t border-slate-800/80 print:border-slate-200 text-[11px] space-y-1 font-mono">
                <div>نطاق التذبذب: <span className="text-slate-200 print:text-black font-bold">{report.scenarios.neutral.range.low} - {report.scenarios.neutral.range.high}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. AI Synthesized Professional Commentary */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-amber-400 print:text-amber-800 uppercase tracking-wider flex items-center gap-2">
              <span>04. التقرير التفسيري المعمّق</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 print:hidden">
                {report.aiMeta?.usedAI ? 'تفسير ذكي متصل (Gemini)' : 'تفسير كمي حتمي موثق'}
              </span>
            </h3>

            <button
              type="button"
              onClick={handleTestAiConnection}
              disabled={testingAiConnection}
              className="no-print flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-amber-500/40 transition cursor-pointer disabled:opacity-50"
              title="فحص يدوي آمن لاتصال خدمة التفسير الذكي عبر الخادم دون كشف المفتاح"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${testingAiConnection ? 'animate-spin' : ''}`} />
              <span>{testingAiConnection ? 'جاري فحص الاتصال...' : 'اختبار اتصال التفسير الذكي'}</span>
            </button>
          </div>

          {!report.aiMeta?.usedAI && (
            <div className="no-print rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-2.5 text-[11px] text-amber-200/90 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{report.aiMeta?.noticeAr || AI_UNAVAILABLE_NOTICE_AR}</span>
              </div>
              {report.aiMeta?.status && report.aiMeta.status !== 'DETERMINISTIC_ONLY' && (
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950/80 border border-amber-500/30 text-amber-300">
                  {report.aiMeta.status}
                </span>
              )}
            </div>
          )}

          {aiDiagnosticResult && (
            <div
              className={`no-print rounded-xl border px-4 py-3 text-[11px] space-y-1 ${
                aiDiagnosticResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-slate-900/90 border-slate-700 text-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">
                  نتيجة فحص خدمة التفسير الذكي (منفصلة عن بيانات السوق): {aiDiagnosticResult.messageAr}
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-300">
                  الحالة: {aiDiagnosticResult.status}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                النموذج: {aiDiagnosticResult.model} | التفصيل التقني: {aiDiagnosticResult.technicalReason}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-[#111827] print:bg-slate-50 border border-slate-800 print:border-slate-200 p-5 text-xs text-slate-200 print:text-black leading-relaxed whitespace-pre-line space-y-3 font-sans">
            {report.aiCommentary || report.executiveConclusion}
          </div>
        </div>

        {/* 6. Macroeconomic Context & Economic Calendar (المحور الثالث) */}
        {report.macroContext && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-amber-400 print:text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-4 h-4" />
              <span>05. السياق الاقتصادي الكلي والأجندة الاقتصادية المرتبطة بالصفقة</span>
            </h3>

            <div className="rounded-xl bg-[#111827] print:bg-slate-50 border border-slate-800 print:border-slate-200 p-5 space-y-4 text-xs">
              {/* Macro Alignment Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">نظام السوق الكلي:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {report.macroContext.overallMarketRegime}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {report.macroContext.monetaryPolicyState.summary} (الفائدة الأمريكية: {report.macroContext.monetaryPolicyState.fedFundsRate})
                  </p>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400">انحياز الأصل الكلي:</span>
                  <span className="font-bold text-emerald-300">
                    {report.symbol.includes('XAU') || report.symbol.includes('PAXG')
                      ? `${report.macroContext.goldMacroSynthesis.bias} (${report.macroContext.goldMacroSynthesis.alignmentWithTechnical})`
                      : `${report.macroContext.cryptoMacroSynthesis.bias} (${report.macroContext.cryptoMacroSynthesis.alignmentWithTechnical})`}
                  </span>
                </div>
              </div>

              {/* Three Pillar Breakdown for the Asset */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 space-y-1">
                  <span className="text-amber-400 font-bold block">البيانات الواقعية وآلية التأثير:</span>
                  <p className="text-slate-300 leading-relaxed">
                    {report.symbol.includes('XAU') || report.symbol.includes('PAXG')
                      ? report.macroContext.goldMacroSynthesis.economicMechanism[0]
                      : report.macroContext.cryptoMacroSynthesis.economicMechanism[0]}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 space-y-1">
                  <span className="text-sky-400 font-bold block">الفرضيات والتوقعات الاحتمالية:</span>
                  <p className="text-slate-300 leading-relaxed">
                    {report.symbol.includes('XAU') || report.symbol.includes('PAXG')
                      ? report.macroContext.goldMacroSynthesis.probabilisticHypothesis[0]
                      : report.macroContext.cryptoMacroSynthesis.probabilisticHypothesis[0]}
                  </p>
                </div>
              </div>

              {/* Upcoming High-Impact Calendar Warnings */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>أهم الأحداث الاقتصادية القادمة ذات الصلة المباشرة:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono">
                  {report.macroContext.upcomingEvents.slice(0, 2).map((ev) => (
                    <div key={ev.id} className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                      <div className="font-bold text-white text-xs">{ev.titleAr}</div>
                      <div className="text-[10px] text-slate-400">
                        {ev.date} {ev.time} | المتوقع: {ev.forecast} (السابق: {ev.previous})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7. Risks and Disclaimers */}
        <div className="p-4 rounded-xl bg-slate-950 print:bg-slate-100 border border-slate-800 print:border-slate-300 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-400 print:text-amber-800">
            <ShieldAlert className="w-4 h-4" />
            <span>المخاطر والتنبيهات المنهجية:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 print:text-slate-700">
            {report.risksAndDisclaimers.map((risk, idx) => (
              <li key={idx}>{risk}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
