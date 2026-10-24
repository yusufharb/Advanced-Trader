/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import {
  Smartphone,
  Download,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  X,
  FileCode,
  ShieldCheck,
  FolderOpen,
  Info,
  Terminal,
} from 'lucide-react';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'direct_install' | 'apk_builder' | 'apk_location'>('direct_install');

  if (!isOpen) return null;

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-mafxptwvm6kicxtlm5kj5o-478064852571.europe-west2.run.app';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleDownloadManifest = () => {
    const element = document.createElement('a');
    element.href = '/manifest.json';
    element.download = 'manifest.json';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#0d121f] text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#111827]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  نسخة وتثبيت تطبيق أندرويد (Android APK & WebAPK)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Android Standalone
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تثبيت التطبيق رسمياً كحزمة APK على هواتف أندرويد، ومكان تخزينه في النظام، وكيفية تصديره.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-800 bg-slate-900/60 p-2 gap-2 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('direct_install')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'direct_install'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>1. التثبيت الفوري التلقائي (Google WebAPK)</span>
          </button>
          <button
            onClick={() => setActiveTab('apk_location')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'apk_location'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>2. أين مكان ملف الـ APK في الهاتف؟</span>
          </button>
          <button
            onClick={() => setActiveTab('apk_builder')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'apk_builder'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>3. استخراج ملف APK منفصل (PWABuilder)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed">
          {/* TAB 1: Direct Install */}
          {activeTab === 'direct_install' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/50 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>كيف ينشئ نظام Android ملف APK تلقائياً؟</span>
                </div>
                <p className="text-slate-300">
                  المنصة مبنية ومجهزة وفق معايير <strong>Google Progressive Web App (PWA)</strong>. عند فتح الرابط من أي هاتف أندرويد عبر متصفح <strong>Google Chrome</strong> أو <strong>Samsung Internet</strong>، يقوم خادم جوجل تلقائياً بتجميع وتوليد ملف APK رسمي وموقع (Signed WebAPK) مخصص لجهازك، ويقوم نظام أندرويد بتثبيته كتطبيق مستقل تماماً دون الحاجة لتنزيل ملفات خارجية غير آمنة!
                </p>
              </div>

              {/* Install Now Button if Installable */}
              {isInstallable ? (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-2">
                  <span className="text-slate-300 font-bold block">
                    متصفحك يدعم التثبيت الفوري الآن:
                  </span>
                  <button
                    onClick={() => {
                      install();
                      onClose();
                    }}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center gap-2 mx-auto"
                  >
                    <Download className="w-4 h-4" />
                    <span>تثبيت تطبيق أندرويد الآن على هذا الجهاز</span>
                  </button>
                </div>
              ) : isInstalled ? (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center font-bold text-emerald-400">
                  ✓ التطبيق مثبت بالفعل كـ Standalone App على هذا الجهاز!
                </div>
              ) : (
                <div className="space-y-3 bg-[#111827] p-4 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-white text-xs">خطوات التثبيت على أي هاتف Android في 3 ثوانٍ:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-slate-300 text-[11px]">
                    <li>
                      افتح الرابط التالي في متصفح <strong>Google Chrome</strong> على هاتفك:
                      <div className="flex items-center gap-2 mt-1.5 p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px]">
                        <span className="truncate flex-1 text-amber-400">{appUrl}</span>
                        <button
                          onClick={handleCopyUrl}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                        </button>
                      </div>
                    </li>
                    <li>
                      اضغط على قائمة الخيارات (الثلاث نقاط الرأسية <strong>⋮</strong> في أعلى زاوية المتصفح).
                    </li>
                    <li>
                      اختر <strong>«تثبيت التطبيق» (Install app)</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.
                    </li>
                    <li>
                      يقوم نظام أندرويد فورياً بإنشاء حزمة الـ APK وتثبيت التطبيق في شاشة التطبيقات بجانب تطبيقاتك العادية!
                    </li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: APK Location on Android OS */}
          {activeTab === 'apk_location' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                  <FolderOpen className="w-4 h-4" />
                  <span>المسار الدقيق لملف الـ APK داخل نظام تشغيل Android:</span>
                </div>
                <p className="text-slate-300">
                  عند تثبيت التطبيق على هاتف أندرويد عبر Chrome، يقوم نظام التشغيل بإنشاء الحزمة في المسار التالي:
                </p>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-emerald-400 text-[11px] select-all break-all">
                  /data/app/org.chromium.webapk.a_c6df3231.../base.apk
                </div>
                <p className="text-slate-400 text-[11px]">
                  * ملاحظة تقنية: مسار <code>/data/app/</code> هو المسار الرسمي والمحمي لجميع تطبيقات أندرويد المثبتة من متجر Google Play. لا يتطلب منك نقل الملف يدوياً؛ حيث يتعامل نظام أندرويد مع التطبيق كأي تطبيق أصيل تماماً (Native Android App).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-[11px]">
                <h5 className="font-bold text-white">مميزات حزمة الـ WebAPK المثبتة على جهازك:</h5>
                <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                  <li><strong>أيقونة مستقلة</strong> في درج التطبيقات والشاشة الرئيسية للهاتف بجودة عالية (512x512 Maskable).</li>
                  <li><strong>شاشة بدء (Splash Screen)</strong> مستقلة باللون الداكن <code>#0B0F19</code>.</li>
                  <li><strong>تشغيل كامل الشاشة (Standalone)</strong> مع إخفاء شريط أدوات المتصفح بالكامل.</li>
                  <li><strong>دعم العمل دون اتصال بالإنترنت (Offline Mode)</strong> بفضل تقنية تخزين Service Worker.</li>
                  <li><strong>إشعارات الأسعار والأخبار اللحظية</strong> مباشرة على شريط إشعارات الهاتف.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: Standalone APK Extractor / PWABuilder */}
          {activeTab === 'apk_builder' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-900/50 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sky-400 text-sm">
                  <FileCode className="w-4 h-4" />
                  <span>توليد ملف APK خام منفصل (Standalone APK / Google Play Package)</span>
                </div>
                <p className="text-slate-300">
                  إذا كنت ترغب في الحصول على ملف <code>.apk</code> خام منفصل لتثبيته يدوياً (Sideloading) أو رفعه على متجر <strong>Google Play Console</strong>، يمكنك توليده مباشرة باستخدام منصة <strong>PWABuilder</strong> المعتمدة رسمياً من Google و Microsoft:
                </p>
              </div>

              <div className="space-y-3 bg-[#111827] p-4 rounded-xl border border-slate-800">
                <h5 className="font-bold text-white text-xs">طريقة توليد ملف APK المنفصل في 30 ثانية:</h5>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 text-[11px]">
                  <li>
                    انسخ رابط المنصة:
                    <button
                      onClick={handleCopyUrl}
                      className="inline-flex items-center gap-1 mx-1.5 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono text-[10px] cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                      <span>{copiedLink ? 'تم النسخ' : 'اضغط لنسخ الرابط'}</span>
                    </button>
                  </li>
                  <li>
                    توجه إلى موقع <strong>PWABuilder.com</strong> (خدمة مجانية رسمية لتحويل PWA إلى APK).
                  </li>
                  <li>
                    الصق الرابط واضغط على <strong>Start</strong> ثم اختر <strong>Android Package (APK)</strong> واضغط <strong>Download Package</strong>.
                  </li>
                  <li>
                    ستحصل فوراً على ملف <code>app-release-signed.apk</code> جاهز للتشغيل أو المشاركة.
                  </li>
                </ol>

                <div className="pt-2 flex flex-wrap gap-2">
                  <a
                    href={`https://www.pwabuilder.com/publish?url=${encodeURIComponent(appUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5"
                  >
                    <span>فتح PWABuilder لتوليد APK تلقائياً</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={handleDownloadManifest}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل ملف manifest.json</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#111827] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>متوافق مع جميع هواتف Samsung, Xiaomi, Pixel, Huawei</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
