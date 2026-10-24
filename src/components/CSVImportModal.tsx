/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, X, FileText, RefreshCw } from 'lucide-react';
import { parseGoldCSV, CSVParseResult, GoldDataAdapter } from '../services/market/gold-adapter.ts';
import { Candle } from '../types/market.ts';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (candles: Candle[], audit: CSVParseResult, sourceName: string) => void;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [auditResult, setAuditResult] = useState<CSVParseResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      // Run immediate client-side validation
      const audit = parseGoldCSV(text);
      setAuditResult(audit);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCsvContent(val);
    if (!fileName) setFileName('بيانات_ملصقة.csv');
    if (val.trim().length > 30) {
      const audit = parseGoldCSV(val);
      setAuditResult(audit);
    } else {
      setAuditResult(null);
    }
  };

  const handleApply = async () => {
    if (!csvContent || !auditResult || !auditResult.success) return;

    setIsSubmitting(true);
    const targetName = fileName || 'ملف_الذهب_المستورد.csv';
    try {
      let serverApplied = false;
      try {
        const res = await fetch('/api/market/gold/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            csvText: csvContent,
            fileName: targetName,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            GoldDataAdapter.setImportedData(data.candles, targetName, auditResult.detectedFormat);
            onImportSuccess(data.candles, data.audit, targetName);
            onClose();
            serverApplied = true;
          }
        }
      } catch {
        // Server unreachable, use client-side storage
      }

      if (!serverApplied) {
        GoldDataAdapter.setImportedData(auditResult.candles, targetName, auditResult.detectedFormat);
        onImportSuccess(auditResult.candles, auditResult, targetName);
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      alert(`حدث خطأ أثناء معالجة الملف: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0f172a] p-6 shadow-2xl text-right">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-amber-400" />
              <span>استيراد ملف شموع الذهب (XAUUSD)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              يدعم ملفات CSV المصدرة من منصات MetaTrader 4 و MetaTrader 5 و TradingView مع فحص متقدم لسلامة الشموع.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Zone */}
        <div className="mt-4 space-y-4">
          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-xl bg-slate-900/60 cursor-pointer transition">
            <UploadCloud className="w-8 h-8 text-amber-400 mb-2" />
            <span className="text-sm font-semibold text-slate-200">
              {fileName ? fileName : 'انقر لاختيار ملف CSV أو اسحبه هنا'}
            </span>
            <span className="text-xs text-slate-500 mt-1">صيغة .csv أو .txt (ميتاتريدر / تريدنج فيو)</span>
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          {/* Paste Raw Data Option */}
          <div>
            <div className="flex items-center justify-between text-xs pb-1 text-slate-400">
              <span>أو الصق نص الشموع مباشرة هنا:</span>
              {fileName && <span className="font-mono text-amber-400">{fileName}</span>}
            </div>
            <textarea
              value={csvContent}
              onChange={handleTextChange}
              rows={4}
              placeholder="مثال: 2024.01.15,10:00,2045.50,2048.20,2044.10,2047.80,120..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Audit & Inspection Report */}
          {auditResult && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  تقرير فحص وتدقيق البيانات:
                </span>
                <span className={`px-2 py-0.5 rounded font-mono font-semibold ${auditResult.success ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                  {auditResult.success ? 'بيانات صالحة' : 'بيانات ناقصة / غير مقبولة'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">المنصة المكتشفة</span>
                  <strong className="text-amber-400 font-mono">{auditResult.detectedFormat}</strong>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">الشموع الصالحة</span>
                  <strong className="text-emerald-400 font-mono">{auditResult.validRows}</strong>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">المكررات المستبعدة</span>
                  <strong className="text-slate-300 font-mono">{auditResult.duplicatesRemoved}</strong>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">الفجوات الزمنية</span>
                  <strong className={auditResult.timeGapsDetected > 0 ? 'text-amber-400 font-mono' : 'text-slate-300 font-mono'}>
                    {auditResult.timeGapsDetected}
                  </strong>
                </div>
              </div>

              {auditResult.startDate && auditResult.endDate && (
                <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded">
                  <span>من: {new Date(auditResult.startDate).toLocaleDateString('ar-EG')}</span>
                  <span>إلى: {new Date(auditResult.endDate).toLocaleDateString('ar-EG')}</span>
                </div>
              )}

              {auditResult.errors.length > 0 && (
                <div className="p-2.5 rounded bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>ملاحظات التدقيق والاستبعاد:</span>
                  </div>
                  {auditResult.errors.map((e, idx) => (
                    <div key={idx} className="text-[11px] leading-tight">• {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            إلغاء
          </button>
          <button
            onClick={handleApply}
            disabled={!auditResult?.success || isSubmitting}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition ${
              auditResult?.success && !isSubmitting
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري المعالجة...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>اعتماد الشموع وتحليل الذهب</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
