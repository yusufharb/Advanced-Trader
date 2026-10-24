/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PriceAlert, MarketSymbol, TechnicalReport } from '../types/market.ts';
import {
  Bell,
  X,
  Plus,
  Trash2,
  Volume2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';

interface PriceAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: PriceAlert[];
  currentPrice: number;
  currentSymbol: MarketSymbol;
  report: TechnicalReport | null;
  onAddAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'isActive'>) => void;
  onRemoveAlert: (id: string) => void;
  onToggleAlert: (id: string) => void;
  onImportReportLevels: (report: TechnicalReport) => void;
  onClearTriggered: () => void;
  onPlayTestSound: () => void;
  notificationPermission?: NotificationPermission | 'unsupported';
  onRequestPermission?: () => void;
}

export const PriceAlertsModal: React.FC<PriceAlertsModalProps> = ({
  isOpen,
  onClose,
  alerts,
  currentPrice,
  currentSymbol,
  report,
  onAddAlert,
  onRemoveAlert,
  onToggleAlert,
  onImportReportLevels,
  onClearTriggered,
  onPlayTestSound,
  notificationPermission = 'unsupported',
  onRequestPermission,
}) => {
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [symbol, setSymbol] = useState<MarketSymbol>(currentSymbol);
  const [condition, setCondition] = useState<PriceAlert['condition']>('cross_above');
  const [levelType, setLevelType] = useState<PriceAlert['levelType']>('resistance');
  const [label, setLabel] = useState<string>('');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(targetPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    onAddAlert({
      symbol,
      targetPrice: priceNum,
      condition,
      levelType,
      label: label.trim() || `تنبيه عند السعر ${priceNum.toFixed(2)}`,
    });

    setTargetPrice('');
    setLabel('');
  };

  const activeAlerts = alerts.filter((a) => a.isActive);
  const triggeredAlerts = alerts.filter((a) => !a.isActive && a.triggeredAt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0f172a] p-6 shadow-2xl text-right space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">إدارة التنبيهات السعرية الفورية</h3>
              <p className="text-xs text-slate-400">
                إطلاق نغمة صوتية وإشعار عند ملامسة أو اختراق مستويات الدعم والمقاومة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onPlayTestSound}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/70 text-slate-300 hover:text-white text-xs transition cursor-pointer"
              title="تجربة النغمة الصوتية"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              <span>تجربة الصوت</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* System Notification Permission Status */}
        {notificationPermission === 'default' && onRequestPermission && (
          <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-blue-200">
              <Bell className="w-4 h-4 text-blue-400 shrink-0" />
              <span>هل ترغب باستلام إشعارات منبثقة عند ملامسة السعر للمستويات أثناء تصفحك؟</span>
            </div>
            <button
              onClick={onRequestPermission}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition cursor-pointer text-xs"
            >
              تفعيل إشعارات المتصفح
            </button>
          </div>
        )}

        {notificationPermission === 'granted' && (
          <div className="px-3 py-2 rounded-xl bg-emerald-950/30 border border-emerald-900/60 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>إشعارات المتصفح والنظام نشطة (سيتم إطلاق تنبيه صوتي وإشعار منبثق فوري عند تحقيق الشروط).</span>
          </div>
        )}

        {/* 1-Click Auto Import from Technical Report */}
        {report && (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-200">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                توليد تنبيهات تلقائية لجميع دعوم ومقاومات ووقف وأهداف تقرير <strong>{report.symbol}</strong>
              </span>
            </div>
            <button
              onClick={() => onImportReportLevels(report)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition cursor-pointer shadow-sm"
            >
              <span>تفعيل مستويات التقرير</span>
            </button>
          </div>
        )}

        {/* Custom Alert Creation Form */}
        <form onSubmit={handleCreate} className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3 text-xs">
          <div className="flex items-center justify-between text-slate-300 font-bold">
            <span className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>إضافة تنبيه مخصص:</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              السعر اللحظي: <strong className="text-white">{currentPrice > 0 ? currentPrice.toFixed(2) : '-'} USD</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Symbol */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">الأصل:</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value as MarketSymbol)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="BTCUSDT">BTCUSDT (البيتكوين)</option>
                <option value="XAUUSD">XAUUSD (الذهب)</option>
              </select>
            </div>

            {/* Target Price */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">السعر المستهدف (USD):</label>
              <input
                type="number"
                step="any"
                required
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder={currentPrice > 0 ? currentPrice.toFixed(2) : '0.00'}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2 font-mono text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Condition */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">شرط الإطلاق:</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as PriceAlert['condition'])}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="cross_above">اختراق للأعلى (&gt;=)</option>
                <option value="cross_below">كسر للأسفل (&lt;=)</option>
                <option value="touch">ملامسة المستوى (تقارب)</option>
              </select>
            </div>

            {/* Level Type */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">تصنيف المستوى:</label>
              <select
                value={levelType}
                onChange={(e) => setLevelType(e.target.value as PriceAlert['levelType'])}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="resistance">مستوى مقاومة</option>
                <option value="support">مستوى دعم</option>
                <option value="target">هدف ربحي (TP)</option>
                <option value="stop_loss">وقف خسارة (SL)</option>
                <option value="custom">مخصص</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="وصف التنبيه (مثال: مقاومة الذهب اليومية 2060)"
              className="flex-1 rounded-lg bg-slate-900 border border-slate-800 p-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition cursor-pointer"
            >
              حفظ التنبيه
            </button>
          </div>
        </form>

        {/* Alerts List Tabs / View */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
            <span className="font-bold text-slate-300">
              التنبيهات النشطة ({activeAlerts.length})
            </span>
            {triggeredAlerts.length > 0 && (
              <button
                onClick={onClearTriggered}
                className="text-[11px] text-slate-500 hover:text-rose-400 transition cursor-pointer"
              >
                مسح التنبيهات المنفذة ({triggeredAlerts.length})
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 rounded-xl bg-slate-950 border border-slate-800/80">
                لا توجد تنبيهات سعرية حالياً. انقر على «تفعيل مستويات التقرير» أو أضف تنبيهاً يدوياً أعلاه.
              </div>
            ) : (
              alerts.map((alt) => {
                const isTriggered = !alt.isActive && alt.triggeredAt;
                return (
                  <div
                    key={alt.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition ${
                      isTriggered
                        ? 'bg-slate-950/60 border-slate-800/50 opacity-60'
                        : 'bg-[#111827] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onToggleAlert(alt.id)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                          alt.isActive
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}
                        title={alt.isActive ? 'تعطيل التنبيه' : 'إعادة تفعيل التنبيه'}
                      >
                        <Bell className="w-3.5 h-3.5" />
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-white font-mono text-sm">
                            {alt.targetPrice.toFixed(2)} USD
                          </strong>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {alt.symbol}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              alt.levelType === 'support'
                                ? 'bg-emerald-950 text-emerald-400'
                                : alt.levelType === 'resistance'
                                ? 'bg-rose-950 text-rose-400'
                                : alt.levelType === 'stop_loss'
                                ? 'bg-red-950 text-red-400'
                                : 'bg-blue-950 text-blue-400'
                            }`}
                          >
                            {alt.levelType === 'support'
                              ? 'دعم'
                              : alt.levelType === 'resistance'
                              ? 'مقاومة'
                              : alt.levelType === 'stop_loss'
                              ? 'وقف'
                              : alt.levelType === 'target'
                              ? 'هدف'
                              : 'مخصص'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {alt.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left text-[11px] font-mono">
                        {isTriggered ? (
                          <span className="text-amber-400">
                            تم الإطلاق {new Date(alt.triggeredAt!).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-slate-500 flex items-center gap-1">
                            {alt.condition === 'cross_above' ? (
                              <>
                                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                                <span>اختراق للأعلى</span>
                              </>
                            ) : alt.condition === 'cross_below' ? (
                              <>
                                <ArrowDownRight className="w-3 h-3 text-rose-400" />
                                <span>كسر للأسفل</span>
                              </>
                            ) : (
                              <span>ملامسة</span>
                            )}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onRemoveAlert(alt.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                        title="حذف التنبيه"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700 hover:text-white transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Floating Alert Notification Toast when price hits a level
 */
export const PriceAlertToast: React.FC<{
  toast: { alert: PriceAlert; price: number; timestamp: number } | null;
  onDismiss: () => void;
}> = ({ toast, onDismiss }) => {
  if (!toast) return null;

  return (
    <div className="fixed top-20 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-bounce duration-500">
      <div className="p-4 rounded-2xl bg-[#0f172a] border-2 border-amber-500 shadow-2xl shadow-amber-500/30 text-right space-y-2">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold">
              <Bell className="w-4 h-4 animate-spin" />
            </span>
            <strong className="text-white text-xs">تنبيه وصول السعر للمستوى الفني!</strong>
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-mono">{toast.alert.symbol}</span>
            <span className="text-base font-bold font-mono text-amber-400">
              {toast.price.toFixed(2)} USD
            </span>
          </div>
          <p className="text-slate-200 text-xs font-semibold">
            {toast.alert.label}
          </p>
          <span className="text-[10px] text-slate-500 block">
            المستوى المستهدف: {toast.alert.targetPrice.toFixed(2)} USD
          </span>
        </div>

        <button
          onClick={onDismiss}
          className="mt-2 w-full py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition cursor-pointer"
        >
          تمت المشاهدة
        </button>
      </div>
    </div>
  );
};
