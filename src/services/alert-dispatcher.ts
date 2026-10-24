import { TradeSetup, TechnicalReport } from '../types/market.ts';

export interface TelegramAlertConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  autoDispatch: boolean;
}

export interface WebhookAlertConfig {
  url: string;
  secret?: string;
  enabled: boolean;
  autoDispatch: boolean;
}

export interface AlertSettings {
  telegram: TelegramAlertConfig;
  webhook: WebhookAlertConfig;
}

export interface AlertTradePayload {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  tradeSetup: TradeSetup;
  timestamp: number;
}

const STORAGE_KEY = 'ama_alert_settings_v1';

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  telegram: {
    botToken: '',
    chatId: '',
    enabled: false,
    autoDispatch: false,
  },
  webhook: {
    url: '',
    secret: '',
    enabled: false,
    autoDispatch: false,
  },
};

/**
 * Loads alert configuration safely from localStorage.
 */
export function loadAlertSettings(): AlertSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_ALERT_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ALERT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      telegram: {
        ...DEFAULT_ALERT_SETTINGS.telegram,
        ...(parsed.telegram || {}),
      },
      webhook: {
        ...DEFAULT_ALERT_SETTINGS.webhook,
        ...(parsed.webhook || {}),
      },
    };
  } catch {
    return DEFAULT_ALERT_SETTINGS;
  }
}

/**
 * Persists alert configuration to localStorage.
 */
export function saveAlertSettings(settings: AlertSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save alert settings to localStorage:', err);
  }
}

/**
 * Formats a trade setup into an HTML message suitable for Telegram Bot API.
 */
export function formatTelegramTradeMessage(payload: AlertTradePayload): string {
  const { symbol, timeframe, currentPrice, tradeSetup, timestamp } = payload;
  const isBuy = tradeSetup.bias === 'شراء';
  const actionEmoji = isBuy ? '🟢' : tradeSetup.bias === 'بيع' ? '🔴' : '⚪';
  const actionText = isBuy ? 'شراء (BUY)' : tradeSetup.bias === 'بيع' ? 'بيع (SELL)' : 'حياد / مراقبة';
  const dateStr = new Date(timestamp).toLocaleString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  const entryStr = tradeSetup.entryZone.min === tradeSetup.entryZone.max
    ? `${tradeSetup.entryZone.min}`
    : `${tradeSetup.entryZone.min} - ${tradeSetup.entryZone.max}`;

  const targetsStr = tradeSetup.targets.map((t, i) => `TP${i + 1}: <code>${t}</code>`).join(' | ');

  return `
${actionEmoji} <b>إشارة تداول فنية جديدة – المحلل المتقدم</b>
━━━━━━━━━━━━━━━━━━━━
<b>الأصل:</b> <code>${symbol}</code>
<b>الإطار الزمني:</b> <code>${timeframe}</code>
<b>نوع الصفقة:</b> <b>${actionText}</b>
<b>السعر اللحظي:</b> <code>${currentPrice}</code>
━━━━━━━━━━━━━━━━━━━━
<b>نطاق الدخول:</b> <code>${entryStr}</code>
<b>وقف الخسارة (SL):</b> <code>${tradeSetup.stopLoss}</code>
<b>الأهداف الربحية:</b> ${targetsStr || 'غير محدد'}
<b>نسبة العائد/المخاطرة:</b> <code>1:${tradeSetup.riskRewardRatio}</code>
━━━━━━━━━━━━━━━━━━━━
<b>الأساس الفني:</b>
<i>${tradeSetup.reasoning}</i>
━━━━━━━━━━━━━━━━━━━━
⏰ <i>${dateStr}</i>
`.trim();
}

/**
 * Dispatches an alert to Telegram Bot.
 */
export async function sendTelegramAlert(
  config: TelegramAlertConfig,
  payload: AlertTradePayload
): Promise<{ success: boolean; message: string }> {
  if (!config.enabled) {
    return { success: false, message: 'تنبيهات Telegram معطلة في الإعدادات.' };
  }
  const token = config.botToken.trim();
  const chatId = config.chatId.trim();

  if (!token || !chatId) {
    return { success: false, message: 'بيانات Telegram غير مكتملة (Bot Token أو Chat ID مفقود).' };
  }

  const text = formatTelegramTradeMessage(payload);
  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      const errMsg = data?.description || `خطأ خادم Telegram (كود ${res.status})`;
      return { success: false, message: `فشل الإرسال إلى Telegram: ${errMsg}` };
    }

    return { success: true, message: 'تم إرسال إشارة الصفقة بنجاح إلى قناة Telegram!' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `تعذر الاتصال بـ Telegram API: ${errorMsg}` };
  }
}

/**
 * Dispatches a JSON payload to a custom Webhook endpoint.
 */
export async function sendWebhookAlert(
  config: WebhookAlertConfig,
  payload: AlertTradePayload
): Promise<{ success: boolean; message: string }> {
  if (!config.enabled) {
    return { success: false, message: 'تنبيهات Webhook معطلة في الإعدادات.' };
  }
  const url = config.url.trim();
  if (!url) {
    return { success: false, message: 'رابط Webhook URL مفقود.' };
  }

  const bodyData = {
    event: 'TRADE_SIGNAL_ALERT',
    timestamp: payload.timestamp,
    symbol: payload.symbol,
    timeframe: payload.timeframe,
    currentPrice: payload.currentPrice,
    bias: payload.tradeSetup.bias,
    entryZone: payload.tradeSetup.entryZone,
    stopLoss: payload.tradeSetup.stopLoss,
    targets: payload.tradeSetup.targets,
    riskRewardRatio: payload.tradeSetup.riskRewardRatio,
    reasoning: payload.tradeSetup.reasoning,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'AdvancedMarketAnalyst/2.0',
  };

  if (config.secret && config.secret.trim()) {
    headers['X-Webhook-Secret'] = config.secret.trim();
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData),
    });

    if (!res.ok) {
      return {
        success: false,
        message: `استجاب Webhook برمز خطأ: ${res.status} ${res.statusText}`,
      };
    }

    return { success: true, message: 'تم إرسال الإشارة بنجاح إلى Webhook!' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `فشل استدعاء Webhook: ${errorMsg}` };
  }
}

/**
 * Sends a test ping to Telegram to verify credentials.
 */
export async function testTelegramConnection(
  botToken: string,
  chatId: string
): Promise<{ success: boolean; message: string }> {
  const token = botToken.trim();
  const chat = chatId.trim();
  if (!token || !chat) {
    return { success: false, message: 'يرجى إدخال Bot Token و Chat ID أولاً.' };
  }

  const text = `
🤖 <b>اختبار اتصال التنبيهات – المحلل الفني المتقدم</b>
تم ربط البوت بقناتك بنجاح! ستصلك إشارات الصفقات اللحظية المعتمدة فور صدورها.
⏰ <i>${new Date().toLocaleTimeString('ar-EG')}</i>
`.trim();

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return { success: false, message: data?.description || 'فشل الاتصال بـ Telegram' };
    }

    return { success: true, message: 'تم استلام رسالة الاختبار بنجاح في Telegram!' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Sends a test payload to a Webhook endpoint.
 */
export async function testWebhookConnection(
  url: string,
  secret?: string
): Promise<{ success: boolean; message: string }> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    return { success: false, message: 'يرجى إدخال رابط Webhook أولاً.' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret && secret.trim()) {
    headers['X-Webhook-Secret'] = secret.trim();
  }

  try {
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: 'TEST_PING',
        timestamp: Date.now(),
        source: 'Advanced Market Analyst',
      }),
    });

    if (!res.ok) {
      return { success: false, message: `استجاب الرابط برمز: ${res.status} ${res.statusText}` };
    }

    return { success: true, message: 'تم إرسال إشعار الاختبار بنجاح إلى Webhook!' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * High-level dispatch function that triggers both Telegram and Webhook if enabled.
 */
export async function dispatchReportAlerts(
  report: TechnicalReport,
  customSettings?: AlertSettings
): Promise<{
  telegramResult?: { success: boolean; message: string };
  webhookResult?: { success: boolean; message: string };
}> {
  if (!report.tradeSetup) {
    return {};
  }

  const settings = customSettings || loadAlertSettings();
  const payload: AlertTradePayload = {
    symbol: report.symbol,
    timeframe: report.timeframe,
    currentPrice: report.currentPrice,
    tradeSetup: report.tradeSetup,
    timestamp: Date.now(),
  };

  const results: {
    telegramResult?: { success: boolean; message: string };
    webhookResult?: { success: boolean; message: string };
  } = {};

  if (settings.telegram.enabled) {
    results.telegramResult = await sendTelegramAlert(settings.telegram, payload);
  }

  if (settings.webhook.enabled) {
    results.webhookResult = await sendWebhookAlert(settings.webhook, payload);
  }

  return results;
}
