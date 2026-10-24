/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  TechnicalReport,
  GeminiDiagnosticStatus,
  GeminiDiagnosticResult,
  AICommentaryMeta,
} from '../types/market.ts';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export const AI_UNAVAILABLE_NOTICE_AR =
  'التحليل الفني يعمل، لكن خدمة التفسير الذكي غير متاحة حاليًا. تحقق من صلاحيات Gemini API أو إعداد مفتاح الخدمة.';

export type GeminiTestTransport = (params: {
  model: string;
  prompt: string;
  systemInstruction?: string;
}) => Promise<{ text?: string }>;

let customTestTransport: GeminiTestTransport | null = null;
let geminiCallCounter = 0;

// Circuit breaker for fatal auth/permission errors (401 / 403) so we never spam retries on a forbidden key
let cachedAuthFailure: {
  keyFingerprint: string;
  status: 'PERMISSION_DENIED' | 'UNAUTHENTICATED';
  messageAr: string;
  technicalReason: string;
  timestamp: number;
} | null = null;

export function setGeminiTestTransport(transport: GeminiTestTransport | null): void {
  customTestTransport = transport;
}

export function getGeminiCallCount(): number {
  return geminiCallCounter;
}

export function resetGeminiTestState(): void {
  geminiCallCounter = 0;
  cachedAuthFailure = null;
  customTestTransport = null;
}

/**
 * Safely retrieves the server-side GEMINI_API_KEY without ever exposing its value.
 */
function getServerGeminiApiKey(): string | undefined {
  if (typeof window !== 'undefined') {
    return undefined;
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env.GEMINI_API_KEY;
  }
  return undefined;
}

/**
 * Computes a non-reversible internal fingerprint to detect if the env var changed in memory.
 */
function getKeyFingerprint(apiKey: string): string {
  return `len:${apiKey.length}:c0:${apiKey.charCodeAt(0) || 0}:cN:${apiKey.charCodeAt(apiKey.length - 1) || 0}`;
}

/**
 * Checks whether a raw GEMINI_API_KEY value is present and not a placeholder.
 */
export function validateGeminiApiKeyConfig(rawKey?: string): {
  valid: boolean;
  status?: 'CONFIG_MISSING';
  messageAr?: string;
  technicalReason?: string;
} {
  const trimmed = (rawKey || '').trim();
  if (
    !trimmed ||
    trimmed === 'MY_GEMINI_API_KEY' ||
    trimmed === 'YOUR_GEMINI_API_KEY' ||
    trimmed === 'YOUR_API_KEY' ||
    trimmed === 'undefined' ||
    trimmed === 'null'
  ) {
    return {
      valid: false,
      status: 'CONFIG_MISSING',
      messageAr: AI_UNAVAILABLE_NOTICE_AR,
      technicalReason: !trimmed
        ? 'GEMINI_API_KEY is missing or empty in server environment'
        : 'GEMINI_API_KEY is set to a default placeholder value',
    };
  }
  return { valid: true };
}

/**
 * Scrubs any potential API key patterns from error strings so secrets never leak to logs or clients.
 */
export function sanitizeGeminiErrorText(rawMessage: string, apiKey?: string): string {
  let clean = String(rawMessage || 'Unknown Gemini API error');
  if (apiKey && apiKey.trim().length > 4) {
    clean = clean.split(apiKey.trim()).join('[REDACTED_KEY]');
  }
  clean = clean.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]');
  clean = clean.replace(/key=[0-9A-Za-z_-]{15,}/gi, 'key=[REDACTED_KEY]');
  return clean;
}

/**
 * Classifies any Gemini SDK or HTTP error into one of the standard diagnostic statuses.
 */
export function classifyGeminiError(
  error: any,
  apiKey?: string
): {
  status: GeminiDiagnosticStatus;
  httpStatus?: number;
  messageAr: string;
  technicalReason: string;
} {
  const rawStatus =
    typeof error?.status === 'number'
      ? error.status
      : typeof error?.statusCode === 'number'
      ? error.statusCode
      : typeof error?.code === 'number'
      ? error.code
      : undefined;

  const rawMsg = sanitizeGeminiErrorText(
    error?.message || error?.error?.message || String(error || ''),
    apiKey
  );
  const lower = rawMsg.toLowerCase();

  if (
    rawStatus === 403 ||
    lower.includes('permission_denied') ||
    lower.includes('permission denied') ||
    lower.includes('403') ||
    lower.includes('forbidden') ||
    lower.includes('caller does not have permission')
  ) {
    return {
      status: 'PERMISSION_DENIED',
      httpStatus: 403,
      messageAr: AI_UNAVAILABLE_NOTICE_AR,
      technicalReason: `HTTP 403 PERMISSION_DENIED: ${rawMsg}`,
    };
  }

  if (
    rawStatus === 401 ||
    lower.includes('unauthenticated') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('401') ||
    lower.includes('invalid authentication credentials')
  ) {
    return {
      status: 'UNAUTHENTICATED',
      httpStatus: 401,
      messageAr: AI_UNAVAILABLE_NOTICE_AR,
      technicalReason: `HTTP 401 UNAUTHENTICATED: ${rawMsg}`,
    };
  }

  if (
    rawStatus === 404 ||
    lower.includes('not_found') ||
    lower.includes('model not found') ||
    lower.includes('is not found for api version') ||
    lower.includes('404')
  ) {
    return {
      status: 'MODEL_NOT_FOUND',
      httpStatus: 404,
      messageAr: 'النموذج المحدد للتفسير الذكي غير متاح حالياً في هذا المسار؛ تم استخدام التقرير الفني الحتمي.',
      technicalReason: `HTTP 404 MODEL_NOT_FOUND: ${rawMsg}`,
    };
  }

  if (
    rawStatus === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('too many requests') ||
    lower.includes('429')
  ) {
    return {
      status: 'RATE_LIMITED',
      httpStatus: 429,
      messageAr: 'تم الوصول إلى الحد المجاني المؤقت لطلبات التفسير الذكي (Rate Limit)؛ يستمر التحليل الفني الحتمي بالعمل بشكل طبيعي.',
      technicalReason: `HTTP 429 RATE_LIMITED: ${rawMsg}`,
    };
  }

  return {
    status: 'UPSTREAM_UNAVAILABLE',
    httpStatus: rawStatus || 503,
    messageAr: AI_UNAVAILABLE_NOTICE_AR,
    technicalReason: `UPSTREAM_UNAVAILABLE (${rawStatus || 503}): ${rawMsg}`,
  };
}

/**
 * Executes a single server-side call to Gemini without automatic retries on 401/403.
 */
async function invokeServerGemini(params: {
  apiKey: string;
  model: string;
  prompt: string;
  systemInstruction?: string;
  timeoutMs?: number;
}): Promise<{ text?: string }> {
  geminiCallCounter++;

  if (customTestTransport) {
    return customTestTransport({
      model: params.model,
      prompt: params.prompt,
      systemInstruction: params.systemInstruction,
    });
  }

  const genaiModuleName = '@google/genai';
  const { GoogleGenAI, ThinkingLevel } = await import(/* @vite-ignore */ genaiModuleName);
  const ai = new GoogleGenAI({
    apiKey: params.apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const generatePromise = ai.models.generateContent({
    model: params.model,
    contents: params.prompt,
    config: {
      ...(params.systemInstruction ? { systemInstruction: params.systemInstruction } : {}),
      temperature: 0.2,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    },
  });

  const timeoutMs = params.timeoutMs ?? 8000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Upstream AI service latency threshold exceeded')), timeoutMs)
  );

  const response = await Promise.race([generatePromise, timeoutPromise]);
  return { text: response.text };
}

/**
 * Manual server-side diagnostic check for Gemini connectivity and permissions.
 * Never exposes the API key and is only invoked on explicit diagnostic request.
 */
export async function diagnoseGeminiConnection(options?: {
  overrideApiKey?: string;
}): Promise<GeminiDiagnosticResult> {
  const checkedAt = new Date().toISOString();

  if (typeof window !== 'undefined') {
    return {
      status: 'CONFIG_MISSING',
      ok: false,
      model: DEFAULT_GEMINI_MODEL,
      messageAr: AI_UNAVAILABLE_NOTICE_AR,
      technicalReason: 'Gemini diagnostics must be executed on the server, not in the browser.',
      checkedAt,
    };
  }

  const apiKey = options?.overrideApiKey !== undefined ? options.overrideApiKey : getServerGeminiApiKey();
  const keyValidation = validateGeminiApiKeyConfig(apiKey);
  if (!keyValidation.valid || !apiKey) {
    return {
      status: 'CONFIG_MISSING',
      ok: false,
      model: DEFAULT_GEMINI_MODEL,
      messageAr: keyValidation.messageAr || AI_UNAVAILABLE_NOTICE_AR,
      technicalReason: keyValidation.technicalReason || 'GEMINI_API_KEY is not configured',
      checkedAt,
    };
  }

  try {
    const response = await invokeServerGemini({
      apiKey,
      model: DEFAULT_GEMINI_MODEL,
      prompt: 'أجب بكلمة: جاهز',
      timeoutMs: 6000,
    });

    const text = response.text?.trim();
    if (text) {
      cachedAuthFailure = null;
      return {
        status: 'AI_AVAILABLE',
        ok: true,
        httpStatus: 200,
        model: DEFAULT_GEMINI_MODEL,
        messageAr: 'خدمة التفسير الذكي (Gemini API) متصلة وتعمل بنجاح على الخادم.',
        technicalReason: 'HTTP 200 OK: Gemini API responded normally.',
        checkedAt,
      };
    }

    return {
      status: 'UPSTREAM_UNAVAILABLE',
      ok: false,
      httpStatus: 503,
      model: DEFAULT_GEMINI_MODEL,
      messageAr: AI_UNAVAILABLE_NOTICE_AR,
      technicalReason: 'Empty response from Gemini model.',
      checkedAt,
    };
  } catch (error: any) {
    const classified = classifyGeminiError(error, apiKey);
    if (classified.status === 'PERMISSION_DENIED' || classified.status === 'UNAUTHENTICATED') {
      cachedAuthFailure = {
        keyFingerprint: getKeyFingerprint(apiKey),
        status: classified.status,
        messageAr: classified.messageAr,
        technicalReason: classified.technicalReason,
        timestamp: Date.now(),
      };
    }
    return {
      status: classified.status,
      ok: false,
      httpStatus: classified.httpStatus,
      model: DEFAULT_GEMINI_MODEL,
      messageAr: classified.messageAr,
      technicalReason: classified.technicalReason,
      checkedAt,
    };
  }
}

/**
 * Synthesizes an Arabic technical analysis report with full diagnostic metadata.
 * Strictly server-side only; falls back immediately to deterministic commentary if unavailable.
 */
export async function generateAIReportCommentaryWithMeta(
  report: TechnicalReport
): Promise<{ commentary: string; meta: AICommentaryMeta }> {
  const checkedAt = new Date().toISOString();

  // Never execute Gemini SDK in the browser
  if (typeof window !== 'undefined') {
    return {
      commentary: generateDeterministicCommentary(report),
      meta: {
        usedAI: false,
        status: 'DETERMINISTIC_ONLY',
        model: DEFAULT_GEMINI_MODEL,
        checkedAt,
      },
    };
  }

  const apiKey = getServerGeminiApiKey();
  const keyValidation = validateGeminiApiKeyConfig(apiKey);
  if (!keyValidation.valid || !apiKey) {
    return {
      commentary: generateDeterministicCommentary(report),
      meta: {
        usedAI: false,
        status: 'CONFIG_MISSING',
        model: DEFAULT_GEMINI_MODEL,
        noticeAr: AI_UNAVAILABLE_NOTICE_AR,
        checkedAt,
      },
    };
  }

  const fingerprint = getKeyFingerprint(apiKey);
  if (cachedAuthFailure && cachedAuthFailure.keyFingerprint === fingerprint) {
    return {
      commentary: generateDeterministicCommentary(report),
      meta: {
        usedAI: false,
        status: cachedAuthFailure.status,
        model: DEFAULT_GEMINI_MODEL,
        noticeAr: AI_UNAVAILABLE_NOTICE_AR,
        checkedAt,
      },
    };
  }

  try {
    const structuredPayload = {
      الأصل: report.symbol,
      الإطار_الزمني: report.timeframe,
      السعر_الحالي: report.currentPrice,
      مصدر_البيانات: report.dataSource,
      وقت_آخر_شمعة: report.lastCandleTime,
      المؤشرات: {
        EMA20: report.indicators.ema.ema20,
        EMA50: report.indicators.ema.ema50,
        EMA200: report.indicators.ema.ema200,
        RSI_14: report.indicators.rsi.value,
        حالة_RSI: report.indicators.rsi.state,
        MACD_خط: report.indicators.macd.macdLine,
        MACD_إشارة: report.indicators.macd.signalLine,
        MACD_هيستوجرام: report.indicators.macd.histogram,
        بولينجر_علوي: report.indicators.bollinger.upper,
        بولينجر_سفلي: report.indicators.bollinger.lower,
        بولينجر_عرض_النطاق: report.indicators.bollinger.bandwidth,
        ATR_14: report.indicators.atr.value,
        الاستوكاستك_K: report.indicators.stochastic?.k,
        الاستوكاستك_D: report.indicators.stochastic?.d,
        حالة_الاستوكاستك: report.indicators.stochastic?.state,
        تقاطع_الاستوكاستك: report.indicators.stochastic?.cross,
        المحور_الرئيسي: report.indicators.pivots.p,
        مقاومة_1: report.indicators.pivots.r1,
        دعم_1: report.indicators.pivots.s1,
        ADX_14: report.indicators.adx?.adx,
        '+DI': report.indicators.adx?.plusDI,
        '-DI': report.indicators.adx?.minusDI,
        نمط_السوق: report.indicators.adx?.regime,
        إيشيموكو_Tenkan: report.indicators.ichimoku?.tenkanSen,
        إيشيموكو_Kijun: report.indicators.ichimoku?.kijunSen,
        حالة_السحابة: report.indicators.ichimoku?.cloudBias,
        تقاطع_TK: report.indicators.ichimoku?.tkCross,
        متوسط_السعر_المرجح_VWAP: report.indicators.volume?.vwap,
        نقطة_التحكم_POC: report.indicators.volume?.poc,
        الحجم_النسبي_RVOL: report.indicators.volume?.relativeVolume,
        حالة_السيولة: report.indicators.volume?.liquidityState,
      },
      نتائج_المدارس: {
        الكلاسيكية: {
          الاتجاه: report.schools.classical.trend,
          النموذج: report.schools.classical.primaryPattern || 'لا يوجد',
          مستوى_الإبطال: report.schools.classical.invalidationLevel,
          الملخص: report.schools.classical.summary,
        },
        السلوك_السعري: {
          بنية_السوق: report.schools.priceAction.marketStructure,
          فجوات_FVG: report.schools.priceAction.fairValueGaps.length,
          كتل_الأوامر: report.schools.priceAction.orderBlocks.length,
          مستوى_الإبطال: report.schools.priceAction.invalidationLevel,
          الملخص: report.schools.priceAction.summary,
        },
        الهارمونيك_وفيبوناتشي: {
          النماذج_المرصودة: report.schools.harmonic.detectedPatterns.map(p => ({
            النموذج: p.name,
            النوع: p.type,
            منطقة_الانعكاس: p.prz,
            الإبطال: p.invalidationLevel,
          })),
          الملخص: report.schools.harmonic.summary,
        },
        موجات_إليوت: {
          العد_المرجح: report.schools.elliott.probableCount,
          الموجة_الحالية: report.schools.elliott.currentWave,
          مستوى_الإبطال: report.schools.elliott.invalidationLevel,
          الملخص: report.schools.elliott.summary,
        },
        الرقمي_والزمني: {
          الملخص: report.schools.numerical.summary,
        },
      },
      إعداد_الصفقة_المحسوب: report.tradeSetup,
      السيناريوهات: report.scenarios,
      السياق_الاقتصادي_الكلي: report.macroContext
        ? {
            نظام_السوق: report.macroContext.overallMarketRegime,
            السياسة_النقدية: report.macroContext.monetaryPolicyState,
            تأثير_الذهب: report.macroContext.goldMacroSynthesis.bias,
            تأثير_العملات_المشفرة: report.macroContext.cryptoMacroSynthesis.bias,
            تحذيرات_الأحداث_القادمة: report.macroContext.highImpactWarning,
          }
        : undefined,
    };

    const systemInstruction = `أنت كبير المحللين الماليين المعتمدين (Chartered Market Technician - CMT).
مهمتك كتابة تقرير فني تحليلي رصين وشامل باللغة العربية الفصحى يفسر نتائج المحركات الحسابية وسياق الاقتصاد الكلي المرفقة لك بصيغة JSON.
قواعد غير قابلة للتفاوض:
1. التزم حصرياً بالأرقام والمؤشرات والمستويات المذكورة في البيانات المنظمة المرفقة.
2. يُحظر تماماً اختلاق أي أرقام أو أسعار مستهدفة أو أخبار أو احتمالات نجاح مئوية لم تُذكر في البيانات.
3. وضّح بوضوح الإشارات المتوافقة والإشارات المتعارضة بين المدارس الفنية.
4. اعرض السيناريو الصاعد والسيناريو الهابط وشروط إبطال كل سيناريو بدقة.
5. وضّح باقتضاب تأثير الاقتصاد الكلي (الفائدة/الدولار/التضخم) وما إذا كان داعماً أو معاكساً للاتجاه الفني.
6. في حال عدم وجود فرصة تستوفي شروط إدارة المخاطر، انصح صراحةً بالتريث والانتظار.
7. اختم بفقرة تلخيصية تنفيذية موجزة توضح القرار التداولي الأنسب وظروف السوق.`;

    const response = await invokeServerGemini({
      apiKey,
      model: DEFAULT_GEMINI_MODEL,
      prompt: `حلل البيانات الفنية المنظمة التالية وصغ التقرير الفني المالي:\n${JSON.stringify(structuredPayload, null, 2)}`,
      systemInstruction,
      timeoutMs: 8000,
    });

    const generatedText = response.text?.trim();
    if (!generatedText) {
      return {
        commentary: generateDeterministicCommentary(report),
        meta: {
          usedAI: false,
          status: 'UPSTREAM_UNAVAILABLE',
          model: DEFAULT_GEMINI_MODEL,
          noticeAr: AI_UNAVAILABLE_NOTICE_AR,
          checkedAt,
        },
      };
    }

    return {
      commentary: generatedText,
      meta: {
        usedAI: true,
        status: 'AI_AVAILABLE',
        model: DEFAULT_GEMINI_MODEL,
        checkedAt,
      },
    };
  } catch (error: any) {
    const classified = classifyGeminiError(error, apiKey);
    // Remember 401/403 so we do not retry repeatedly on forbidden/unauthenticated credentials
    if (classified.status === 'PERMISSION_DENIED' || classified.status === 'UNAUTHENTICATED') {
      cachedAuthFailure = {
        keyFingerprint: fingerprint,
        status: classified.status,
        messageAr: classified.messageAr,
        technicalReason: classified.technicalReason,
        timestamp: Date.now(),
      };
    }

    return {
      commentary: generateDeterministicCommentary(report),
      meta: {
        usedAI: false,
        status: classified.status,
        model: DEFAULT_GEMINI_MODEL,
        noticeAr: AI_UNAVAILABLE_NOTICE_AR,
        checkedAt,
      },
    };
  }
}

/**
 * Backwards-compatible wrapper that returns the synthesized or deterministic commentary string.
 */
export async function generateAIReportCommentary(report: TechnicalReport): Promise<string> {
  const result = await generateAIReportCommentaryWithMeta(report);
  return result.commentary;
}


function formatReportPrice(val: number | null | undefined, refPrice: number): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  const decimals = refPrice < 2 ? 5 : refPrice < 10 ? 4 : refPrice < 200 ? 3 : 2;
  return val.toFixed(decimals);
}

/**
 * Fallback deterministic report generator that strictly stitches verified numbers
 * without reliance on an active external LLM connection.
 */
export function generateDeterministicCommentary(report: TechnicalReport): string {
  const current = report.currentPrice;
  const ema20 = report.indicators.ema.ema20;
  const rsi = report.indicators.rsi.value;
  const trend = report.schools.classical.trend;
  const setup = report.tradeSetup;
  const macro = report.macroContext;
  const adx = report.indicators.adx;
  const ichimoku = report.indicators.ichimoku;
  const vol = report.indicators.volume;

  return `### تقرير التحليل الفني الموسع للأصل ${report.symbol} (${report.timeframe})

**1. قراءة الاتجاه والزخم:**
يتداول الأصل حالياً عند المستوى السعري **${formatReportPrice(current, current)}**، مع اتجاه كلاسيكي عام يصنف كـ **${trend}**.
- مؤشر القوة النسبية RSI(14) يقف عند **${rsi ?? 'غير متاح'}** مما يشير إلى حالة ${report.indicators.rsi.state === 'overbought' ? 'تشبع شرائي يستوجب الحذر' : report.indicators.rsi.state === 'oversold' ? 'تشبع بيعي يوفر فرص ارتداد محتملة' : 'توازن نسبي في الزخم'}.
- مؤشر الاستوكاستك Stochastic (14,3,3) يسجل %K: **${report.indicators.stochastic?.k ?? 'غير متاح'}** و %D: **${report.indicators.stochastic?.d ?? 'غير متاح'}** في حالة **${report.indicators.stochastic?.state === 'overbought' ? 'ذروة شراء' : report.indicators.stochastic?.state === 'oversold' ? 'ذروة بيع' : 'تذبذب معتدل'}**${report.indicators.stochastic?.cross === 'bullish_cross' ? ' مع تقاطع صاعد إيجابي' : report.indicators.stochastic?.cross === 'bearish_cross' ? ' مع تقاطع هابط سلبي' : ''}.
- متوسط EMA 20 يستقر عند **${ema20 ? formatReportPrice(ema20, current) : 'غير متاح'}**، حيث يتحرك السعر ${ema20 && current > ema20 ? 'أعلى المتوسط داعماً الزخم الإيجابي' : 'أدنى المتوسط مشيراً لضغط تصحيحي'}.

**2. المؤشرات المؤسسية ومسارات السيولة:**
- **مؤشر قوة الاتجاه ADX(14):** يسجل **${adx?.adx ?? 'غير متاح'}** (+DI: ${adx?.plusDI ?? '—'} / -DI: ${adx?.minusDI ?? '—'})، مما يوضح نمط سوق يمثل **${adx?.regime === 'strong_trend' ? 'اتجاه قوي جداً' : adx?.regime === 'trend' ? 'اتجاه نشط' : 'نطاق تذبذب عرضي'}**.
- **منظومة إيشيموكو (Ichimoku Cloud):** خط التحويل Tenkan عند **${ichimoku?.tenkanSen !== null && ichimoku?.tenkanSen !== undefined ? formatReportPrice(ichimoku.tenkanSen, current) : '—'}** وخط الأساس Kijun عند **${ichimoku?.kijunSen !== null && ichimoku?.kijunSen !== undefined ? formatReportPrice(ichimoku.kijunSen, current) : '—'}**؛ يتمركز السعر **${ichimoku?.cloudBias === 'bullish_above_cloud' ? 'أعلى سحابة كومو (زخم صاعد إيجابي)' : ichimoku?.cloudBias === 'bearish_below_cloud' ? 'أسفل سحابة كومو (ضغط هابط سلبي)' : 'داخل السحابة (منطقة تذبذب حيادية)'}**${ichimoku?.tkCross === 'bullish' ? ' مع تقاطع صاعد' : ichimoku?.tkCross === 'bearish' ? ' مع تقاطع هابط' : ''}.
- **تدفق السيولة وحجم التداول:** متوسط السعر المرجح بحجم التداول (VWAP) عند **${vol?.vwap !== null && vol?.vwap !== undefined ? formatReportPrice(vol.vwap, current) : '—'}**، ومستوى نقطة التحكم السعرية (POC) عند **${vol?.poc !== null && vol?.poc !== undefined ? formatReportPrice(vol.poc, current) : '—'}**، مع حجم تداول نسبي RVOL يبلغ **${vol?.relativeVolume ?? '—'}x** بحالة مشاركة **${vol?.liquidityState === 'high_participation' ? 'مشاركة مؤسسية عالية' : vol?.liquidityState === 'low_liquidity' ? 'سيولة منخفضة وتداول ضعيف' : 'مشاركة طبيعية'}**.

**3. مخرجات المدارس التحليلية:**
- **المدرسة الكلاسيكية:** ${report.schools.classical.summary}
- **السلوك السعري (Price Action):** ${report.schools.priceAction.summary}
- **الهارمونيك وفيبوناتشي:** ${report.schools.harmonic.summary}
- **موجات إليوت:** ${report.schools.elliott.summary}
- **التحليل الرقمي والزمني:** ${report.schools.numerical.summary}

**4. سياق الاقتصاد الكلي والأجندة الاقتصادية:**
${macro ? `- **نظام السوق السائد:** ${macro.overallMarketRegime}.
- **السياسة النقدية الأمريكية:** ${macro.monetaryPolicyState.summary} (الفائدة: ${macro.monetaryPolicyState.fedFundsRate}).
- **التوافق مع الأصل:** ${report.symbol.includes('XAU') || report.symbol.includes('PAXG') ? `الذهب: اتجاه كلي ${macro.goldMacroSynthesis.bias} (${macro.goldMacroSynthesis.alignmentWithTechnical})` : `العملات المشفرة: اتجاه كلي ${macro.cryptoMacroSynthesis.bias} (${macro.cryptoMacroSynthesis.alignmentWithTechnical})`}.
- **تنبيه الأحداث:** ${macro.highImpactWarning || 'لا توجد أحداث مرتفعة التذبذب في الساعات القليلة القادمة.'}` : 'السياق الكلي محايد.'}

**5. خطة العمل وإدارة المخاطر:**
- **الانحياز الفني:** ${setup.bias}.
${setup.hasSetup ? `- **نطاق الدخول المشروط:** بين ${formatReportPrice(setup.entryZone.min, current)} و ${formatReportPrice(setup.entryZone.max, current)}.
- **وقف الخسارة الإلزامي:** ${formatReportPrice(setup.stopLoss, current)} (مستوى إلغاء الفرضية).
- **الأهداف المرحلية:** ${setup.targets.map(t => formatReportPrice(t, current)).join(' ثم ')}.
- **نسبة العائد إلى المخاطرة (R:R):** ${setup.riskRewardRatio.toFixed(2)}:1.` : '- **التوصية:** لا توجد فرصة استثمارية مكتملة الشروط الفنية في الوقت الراهن؛ يُفضل البقاء على الحياد ومراقبة رد فعل السعر حول المستويات المحورية.'}

**الخلاصة:**
مستوى الإبطال المحوري العام محدد عند **${formatReportPrice(report.schools.classical.invalidationLevel, current)}**. تداول بانضباط كامل واحرص على عدم تجاوز نسبة المخاطرة 1-2% من إجمالي المحفظة.`;
}
