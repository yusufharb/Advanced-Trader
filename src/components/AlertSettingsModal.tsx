import React, { useState, useEffect } from 'react';
import {
  AlertSettings,
  loadAlertSettings,
  saveAlertSettings,
  testTelegramConnection,
  testWebhookConnection,
} from '../services/alert-dispatcher.ts';

interface AlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (settings: AlertSettings) => void;
}

export const AlertSettingsModal: React.FC<AlertSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'telegram' | 'webhook'>('telegram');
  const [settings, setSettings] = useState<AlertSettings>(loadAlertSettings());
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveFeedback, setSaveFeedback] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(loadAlertSettings());
      setTestResult(null);
      setSaveFeedback(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveAlertSettings(settings);
    setSaveFeedback(true);
    if (onSaved) onSaved(settings);
    setTimeout(() => {
      setSaveFeedback(false);
      onClose();
    }, 900);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (activeTab === 'telegram') {
        const res = await testTelegramConnection(
          settings.telegram.botToken,
          settings.telegram.chatId
        );
        setTestResult(res);
      } else {
        const res = await testWebhookConnection(
          settings.webhook.url,
          settings.webhook.secret
        );
        setTestResult(res);
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء الاختبار.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
    >
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-sm">
              📡
            </span>
            <div>
              <h2 id="alert-modal-title" className="text-base font-semibold text-white tracking-tight">
                إعدادات تنبيهات الصفقات اللحظية
              </h2>
              <p className="text-xs text-slate-400">
                إرسال الإشارات الفنية تلقائياً أو يدوياً إلى Telegram و Webhooks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        {/* Channel Switcher Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800/80 bg-slate-900/40">
          <button
            onClick={() => {
              setActiveTab('telegram');
              setTestResult(null);
            }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'telegram'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📱</span>
            <span>بوت Telegram</span>
            {settings.telegram.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="مفعّل" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('webhook');
              setTestResult(null);
            }}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'webhook'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🔗</span>
            <span>رابط Webhook (HTTP POST)</span>
            {settings.webhook.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="مفعّل" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-right">
          {activeTab === 'telegram' ? (
            <div className="space-y-4">
              {/* Telegram Enabled Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-800">
                <div>
                  <label htmlFor="telegram-enabled-toggle" className="text-sm font-medium text-slate-200 block cursor-pointer">
                    تفعيل إرسال تنبيهات Telegram
                  </label>
                  <span className="text-xs text-slate-400">
                    إرسال بطاقات الصفقات المنسقة إلى مجموعتك أو قناتك الخاصة
                  </span>
                </div>
                <input
                  id="telegram-enabled-toggle"
                  type="checkbox"
                  checked={settings.telegram.enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      telegram: { ...settings.telegram, enabled: e.target.checked },
                    })
                  }
                  className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
                />
              </div>

              {/* Bot Token Field */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  رمز البوت (Telegram Bot Token):
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                    value={settings.telegram.botToken}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        telegram: { ...settings.telegram, botToken: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute left-3 top-2.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    {showToken ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  يمكنك الحصول عليه مجاناً عبر التحدث مع <code>@BotFather</code> في تيليغرام.
                </p>
              </div>

              {/* Chat ID Field */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  معرّف المحادثة أو القناة (Chat ID):
                </label>
                <input
                  type="text"
                  placeholder="مثال: -1001234567890 أو معرّف حسابك"
                  value={settings.telegram.chatId}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      telegram: { ...settings.telegram, chatId: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  يمكنك معرفة الـ Chat ID بإضافة البوت لقناتك وإرسال رسالة ثم فحص <code>@userinfobot</code>.
                </p>
              </div>

              {/* Auto Dispatch Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-800/60">
                <div>
                  <label htmlFor="telegram-auto-dispatch-toggle" className="text-xs font-medium text-slate-300 block cursor-pointer">
                    الإرسال التلقائي الفوري فور اكتمال التحليل
                  </label>
                  <span className="text-[11px] text-slate-400">
                    عند تفعيله، سيتم إرسال أي صفقة جديدة مكتملة الشروط آلياً دون الحاجة للنقر اليدوي.
                  </span>
                </div>
                <input
                  id="telegram-auto-dispatch-toggle"
                  type="checkbox"
                  checked={settings.telegram.autoDispatch}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      telegram: { ...settings.telegram, autoDispatch: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Webhook Enabled Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-800">
                <div>
                  <label htmlFor="webhook-enabled-toggle" className="text-sm font-medium text-slate-200 block cursor-pointer">
                    تفعيل إرسال إشعارات Webhook
                  </label>
                  <span className="text-xs text-slate-400">
                    إرسال كائن JSON عبر POST إلى أنظمة التداول الآلي أو خادمك الخاص
                  </span>
                </div>
                <input
                  id="webhook-enabled-toggle"
                  type="checkbox"
                  checked={settings.webhook.enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      webhook: { ...settings.webhook, enabled: e.target.checked },
                    })
                  }
                  className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
                />
              </div>

              {/* Webhook URL Field */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  رابط نقطة النهاية (Webhook URL):
                </label>
                <input
                  type="url"
                  placeholder="https://api.yourdomain.com/trading-alerts"
                  value={settings.webhook.url}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      webhook: { ...settings.webhook, url: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Secret Key Field */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  مفتاح التحقق السري (اختياري - X-Webhook-Secret):
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="رمز مصادقة اختياري للترويسة"
                    value={settings.webhook.secret || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        webhook: { ...settings.webhook, secret: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute left-3 top-2.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    {showSecret ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>
              </div>

              {/* Auto Dispatch Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-800/60">
                <div>
                  <label htmlFor="webhook-auto-dispatch-toggle" className="text-xs font-medium text-slate-300 block cursor-pointer">
                    الإرسال التلقائي للـ Webhook فور صدور الصفقة
                  </label>
                  <span className="text-[11px] text-slate-400">
                    تغذية خوارزميات التداول أو خدمات الأتمتة فوراً ببيانات الصفقة الصالحة.
                  </span>
                </div>
                <input
                  id="webhook-auto-dispatch-toggle"
                  type="checkbox"
                  checked={settings.webhook.autoDispatch}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      webhook: { ...settings.webhook, autoDispatch: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Test Feedback Notice */}
          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs border transition-all ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="font-semibold mb-0.5">
                {testResult.success ? '✓ نجح الاتصال:' : '✗ فشل الاتصال:'}
              </div>
              <p>{testResult.message}</p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <span>{testing ? '⏳' : '⚡'}</span>
            <span>{testing ? 'جارٍ التحقق...' : 'اختبار الاتصال الآن'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>{saveFeedback ? '✓' : '💾'}</span>
              <span>{saveFeedback ? 'تم الحفظ!' : 'حفظ الإعدادات'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
