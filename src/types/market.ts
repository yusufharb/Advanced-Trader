/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CoreMarketSymbol =
  // Precious Metals & Commodities (المعادن والسلع)
  | 'XAUUSD'
  | 'XAGUSD'
  // Major Forex Currency Pairs (أزواج العملات الأجنبية الرئيسية)
  | 'EURUSD'
  | 'GBPUSD'
  | 'USDJPY'
  | 'USDCHF'
  | 'USDCAD'
  | 'AUDUSD'
  | 'NZDUSD'
  // Crypto Majors (العملات الرقمية الكبرى)
  | 'BTCUSDT'
  | 'ETHUSDT'
  | 'SOLUSDT'
  | 'BNBUSDT'
  | 'XRPUSDT'
  | 'PAXGUSDT';

export type MarketSymbol = CoreMarketSymbol | (string & {});

export type TimeFrame = '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export type DataSourceType = 'binance_live' | 'gold_feed' | 'forex_metals_live' | 'imported_csv';

export type AssetCategory = 'crypto' | 'commodity' | 'forex' | 'proxy' | 'stock' | 'index';

export interface AssetConfig {
  symbol: MarketSymbol;
  providerSymbol?: string;
  nameAr: string;
  nameEn: string;
  category: AssetCategory;
  market?: string;
  currency?: string;
  decimals: number;
  isLiveSupported: boolean;
  descriptionAr: string;
  provider?: 'binance' | 'yahoo' | 'gold';
  isCustom?: boolean;
}

export interface SymbolSearchResult {
  symbol: string;
  providerSymbol?: string;
  nameAr: string;
  nameEn: string;
  category: AssetCategory;
  market?: string;
  currency?: string;
  provider: 'binance' | 'yahoo';
  decimals: number;
  price?: number;
  exchange?: string;
  dataAvailable?: boolean;
}

export const SUPPORTED_ASSETS: AssetConfig[] = [
  // 1. Precious Metals
  {
    symbol: 'XAUUSD',
    nameAr: 'الذهب (سبوت)',
    nameEn: 'Gold Spot',
    category: 'commodity',
    decimals: 2,
    isLiveSupported: true,
    descriptionAr: 'المعدن الأصفر - يدعم بيانات حية عبر الأصل المالي أو استيراد ملفات CSV من MT4/MT5/TradingView.',
  },
  {
    symbol: 'XAGUSD',
    nameAr: 'الفضة (سبوت)',
    nameEn: 'Silver Spot',
    category: 'commodity',
    decimals: 3,
    isLiveSupported: true,
    descriptionAr: 'المعدن الأبيض الفضي - بيانات حية وتدفق لحظي مع فحص فني شامل لكافة المدارس.',
  },
  // 2. Forex Majors (أزواج العملات العالمية الرئيسية السبعة)
  {
    symbol: 'EURUSD',
    nameAr: 'اليورو / دولار',
    nameEn: 'EUR/USD',
    category: 'forex',
    decimals: 5,
    isLiveSupported: true,
    descriptionAr: 'الزوج الرئيسي الأول عالمياً - اليورو مقابل الدولار الأمريكي - تدفق مباشر للأسعار والشموع.',
  },
  {
    symbol: 'GBPUSD',
    nameAr: 'الباوند / دولار',
    nameEn: 'GBP/USD',
    category: 'forex',
    decimals: 5,
    isLiveSupported: true,
    descriptionAr: 'الكيبل - الجنيه الإسترليني مقابل الدولار الأمريكي - حركة سيولة عالية وتحليل متعدد المدارس.',
  },
  {
    symbol: 'USDJPY',
    nameAr: 'الدولار / ين',
    nameEn: 'USD/JPY',
    category: 'forex',
    decimals: 3,
    isLiveSupported: true,
    descriptionAr: 'الدولار الأمريكي مقابل الين الياباني - شديد التأثر بعوائد السندات والسياسة النقدية.',
  },
  {
    symbol: 'USDCHF',
    nameAr: 'الدولار / فرنك',
    nameEn: 'USD/CHF',
    category: 'forex',
    decimals: 5,
    isLiveSupported: true,
    descriptionAr: 'الدولار الأمريكي مقابل الفرنك السويسري - ملاذ استثماري كلاسيكي.',
  },
  {
    symbol: 'USDCAD',
    nameAr: 'الدولار / كندي',
    nameEn: 'USD/CAD',
    category: 'forex',
    decimals: 5,
    isLiveSupported: true,
    descriptionAr: 'الدولار الأمريكي مقابل الدولار الكندي (اللوناي) - متأثر بحركة النفط وأسواق الطاقة.',
  },
  {
    symbol: 'AUDUSD',
    nameAr: 'الأسترالي / دولار',
    nameEn: 'AUD/USD',
    category: 'forex',
    decimals: 5,
    isLiveSupported: true,
    descriptionAr: 'الدولار الأسترالي مقابل الدولار الأمريكي (الأوسي) - مقياس رغبة المخاطرة والسلع.',
  },
  {
    symbol: 'NZDUSD',
    nameAr: 'النيوزيلندي / دولار',
    nameEn: 'NZD/USD',
    category: 'forex',
    decimals: 5,
    isLiveSupported: true,
    descriptionAr: 'الدولار النيوزيلندي مقابل الدولار الأمريكي (الكيوي) - مرتبط بالتجارة العالمية وأسواق المحيط الهادئ.',
  },
  // 3. Crypto Majors
  {
    symbol: 'BTCUSDT',
    nameAr: 'بيتكوين',
    nameEn: 'Bitcoin',
    category: 'crypto',
    decimals: 2,
    isLiveSupported: true,
    descriptionAr: 'العملة الرقمية الأولى عالمياً - بيانات لحظية من منصة Binance Spot.',
  },
  {
    symbol: 'ETHUSDT',
    nameAr: 'إيثيريوم',
    nameEn: 'Ethereum',
    category: 'crypto',
    decimals: 2,
    isLiveSupported: true,
    descriptionAr: 'منصة العقود الذكية الرائدة - بيانات حية من Binance Spot.',
  },
  {
    symbol: 'SOLUSDT',
    nameAr: 'سولانا',
    nameEn: 'Solana',
    category: 'crypto',
    decimals: 2,
    isLiveSupported: true,
    descriptionAr: 'شبكة المعاملات فائقة السرعة - بيانات حية من Binance Spot.',
  },
  {
    symbol: 'BNBUSDT',
    nameAr: 'بينانس كوين',
    nameEn: 'BNB',
    category: 'crypto',
    decimals: 2,
    isLiveSupported: true,
    descriptionAr: 'عملة منظومة Binance وBNB Chain - بيانات حية من Binance Spot.',
  },
  {
    symbol: 'XRPUSDT',
    nameAr: 'ريبل',
    nameEn: 'XRP',
    category: 'crypto',
    decimals: 4,
    isLiveSupported: true,
    descriptionAr: 'بروتوكول التسويات المالية والمدفوعات - بيانات حية من Binance Spot.',
  },
  {
    symbol: 'PAXGUSDT',
    nameAr: 'PAXG (ذهب رقمي)',
    nameEn: 'Pax Gold',
    category: 'proxy',
    decimals: 2,
    isLiveSupported: true,
    descriptionAr: 'أصل رقمي مدعوم بذهب حقيقي بنسبة 1:1 في خزائن برينكس - بيانات حية من Binance Spot.',
  },
];

export interface Candle {
  time: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed?: boolean; // Whether the candle has completed its period
}

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: 'high' | 'low';
}

export interface EMAData {
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
}

export interface RSIData {
  value: number | null;
  state: 'overbought' | 'oversold' | 'neutral';
  divergence?: 'bullish' | 'bearish' | null;
}

export interface MACDData {
  macdLine: number | null;
  signalLine: number | null;
  histogram: number | null;
  trend: 'bullish' | 'bearish' | 'neutral';
  cross: 'bullish_cross' | 'bearish_cross' | 'none';
}

export interface BollingerData {
  upper: number | null;
  middle: number | null;
  lower: number | null;
  bandwidth: number | null;
  percentB: number | null;
}

export interface ATRData {
  value: number | null;
  volatilityPercent: number | null;
}

export interface StochasticData {
  k: number | null;
  d: number | null;
  state: 'overbought' | 'oversold' | 'neutral';
  cross: 'bullish_cross' | 'bearish_cross' | 'none';
}

export interface ADXData {
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
  regime: 'strong_trend' | 'trend' | 'ranging'; // >=25 trend, >=40 strong_trend, <20 ranging
}

export interface IchimokuData {
  tenkanSen: number | null; // 9 periods
  kijunSen: number | null; // 26 periods
  senkouSpanA: number | null;
  senkouSpanB: number | null; // 52 periods
  cloudBias: 'bullish_above_cloud' | 'bearish_below_cloud' | 'inside_cloud_neutral';
  tkCross: 'bullish' | 'bearish' | 'none';
}

export interface VolumeAnalysisData {
  vwap: number | null;
  volumeSMA20: number | null;
  relativeVolume: number | null; // RVOL
  poc: number | null; // Point of Control (أعلى مستوى سعري تداولاً في آخر 100 شمعة)
  liquidityState: 'high_participation' | 'normal' | 'low_liquidity';
}

export interface PivotLevels {
  type: 'classic' | 'fibonacci';
  p: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface FibonacciLevels {
  swingHigh: number;
  swingLow: number;
  direction: 'up' | 'down';
  levels: {
    ratio: number;
    price: number;
    label: string;
  }[];
}

export interface SupportResistanceZone {
  price: number;
  type: 'support' | 'resistance';
  touches: number;
  strength: 'strong' | 'moderate' | 'weak';
}

export interface DivergenceSignal {
  type: 'bullish' | 'bearish';
  indicator: 'RSI' | 'MACD';
  startPrice: number;
  endPrice: number;
  startTime: number;
  endTime: number;
  description: string;
}

export interface BreakoutSignal {
  level: number;
  type: 'breakout_up' | 'breakout_down' | 'fakeout_up' | 'fakeout_down';
  candleTime: number;
  price: number;
  confirmed: boolean;
}

export type SchoolStatus = 'مكتملة' | 'تجريبية' | 'غير متاحة';

export interface ClassicalAnalysis {
  status: SchoolStatus;
  trend: 'صاعد' | 'هابط' | 'عرضي (تذبذب)';
  primaryPattern?: string;
  patternStatus?: 'مكتمل' | 'قيد التكوين' | 'لا يوجد';
  supports: number[];
  resistances: number[];
  breakouts: BreakoutSignal[];
  invalidationLevel: number;
  summary: string;
}

export interface PriceActionAnalysis {
  status: SchoolStatus;
  marketStructure: 'BOS صاعد' | 'BOS هابط' | 'CHoCH تغيير اتجاه' | 'توازن نطاقي';
  fairValueGaps: {
    top: number;
    bottom: number;
    type: 'bullish_fvg' | 'bearish_fvg';
    mitigated: boolean;
  }[];
  orderBlocks: {
    high: number;
    low: number;
    type: 'bullish_ob' | 'bearish_ob';
    tested: boolean;
  }[];
  invalidationLevel: number;
  summary: string;
}

export interface HarmonicPattern {
  name: 'Gartley' | 'Bat' | 'Butterfly' | 'Crab';
  type: 'bullish' | 'bearish';
  points: {
    X: { price: number; time: number };
    A: { price: number; time: number };
    B: { price: number; time: number };
    C: { price: number; time: number };
    D: { price: number; time: number };
  };
  bRatio: number;
  dRatio: number;
  prz: { start: number; end: number }; // Potential Reversal Zone
  invalidationLevel: number;
  isComplete: boolean;
}

export interface HarmonicAnalysis {
  status: SchoolStatus;
  detectedPatterns: HarmonicPattern[];
  fibonacciRetracements: FibonacciLevels | null;
  summary: string;
}

export interface ElliottWaveAnalysis {
  status: SchoolStatus;
  probableCount: string;
  alternateCount?: string;
  currentWave: string;
  isConclusive: boolean;
  rulesValidated: boolean;
  invalidationLevel: number;
  summary: string;
}

export interface AstroMarketEvent {
  id: string;
  date: string; // YYYY-MM-DD
  timeUtc: string; // HH:mm UTC
  timestampMs: number;
  titleAr: string;
  titleEn: string;
  eventType: 'solar_eclipse' | 'lunar_eclipse' | 'planetary_aspect' | 'retrograde_station' | 'solstice_equinox' | 'supermoon' | 'planetary_ingress';
  celestialBodies: string[]; // e.g. ['الشمس', 'القمر'] or ['المشتري', 'زحل']
  impactLevel: 'extreme' | 'strong' | 'above_average'; // الأقوى، قوي، أعلى من المتوسط
  marketCorrelation: string;
  historicalPrecedent: string;
  affectedAssets: string[];
}

export interface NumericalTimeAnalysis {
  status: SchoolStatus;
  anchorPoint: { price: number; time: number } | null;
  gannLevels: number[];
  squareOfNineHarmonics: number[];
  timeCycleDays: number[];
  gannAngles?: { angleName: string; priceLevel: number; degree: number; significance: string }[];
  priceTimeSquareStatus?: { isSquared: boolean; currentBarCount: number; currentPrice: number; explanation: string };
  lucasTimeCycles?: number[];
  murreyMathOctaves?: { octave: string; price: number; meaning: string }[];
  keyVibrationalConfluence?: { level: number; weight: number; label: string }[];
  summary: string;
}

export interface AstroAnalysis {
  status: SchoolStatus;
  isHypothesisOnly: true;
  disclaimer: string;
  lunarPhase: string;
  lunarIlluminationPercent?: number;
  planetaryCycleAspect: string;
  historicalCorrelationNote: string;
  upcomingMajorAstroEvents?: AstroMarketEvent[];
  activePlanetaryInfluence?: string;
  gannSeasonalPosition?: string;
  mercuryRetrogradeStatus?: { isRetrograde: boolean; phaseDescription: string; stationDate?: string };
}

export interface TradeSetup {
  hasSetup: boolean;
  bias: 'شراء' | 'بيع' | 'حياد / مراقبة';
  entryZone: { min: number; max: number };
  stopLoss: number;
  targets: number[];
  riskRewardRatio: number;
  reasoning: string;
}

export interface TechnicalReport {
  symbol: MarketSymbol;
  timeframe: TimeFrame;
  lastUpdated: string;
  lastCandleTime: string;
  dataSource: string;
  isLive: boolean;
  currentPrice: number;
  candleCount: number;
  isCandleClosed: boolean;

  // Quantitative state
  indicators: {
    ema: EMAData;
    rsi: RSIData;
    macd: MACDData;
    bollinger: BollingerData;
    atr: ATRData;
    pivots: PivotLevels;
    stochastic: StochasticData;
    adx: ADXData;
    ichimoku: IchimokuData;
    volume: VolumeAnalysisData;
  };

  // Schools Matrix
  schools: {
    classical: ClassicalAnalysis;
    priceAction: PriceActionAnalysis;
    harmonic: HarmonicAnalysis;
    elliott: ElliottWaveAnalysis;
    numerical: NumericalTimeAnalysis;
    astro: AstroAnalysis;
  };

  // Trade Setup & Synthesized Analysis
  scenarios: {
    bullish: {
      description: string;
      triggerCondition: string;
      invalidationLevel: number;
      target1: number;
      target2: number;
    };
    bearish: {
      description: string;
      triggerCondition: string;
      invalidationLevel: number;
      target1: number;
      target2: number;
    };
    neutral: {
      description: string;
      range: { low: number; high: number };
    };
  };

  tradeSetup: TradeSetup;

  risksAndDisclaimers: string[];
  executiveConclusion: string;
  aiCommentary?: string;
  aiMeta?: AICommentaryMeta;

  // Axis 3: Macroeconomic Context & Calendar integration
  macroContext?: MacroAnalysisReport;
}

export type GeminiDiagnosticStatus =
  | 'CONFIG_MISSING'
  | 'PERMISSION_DENIED'
  | 'UNAUTHENTICATED'
  | 'MODEL_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'AI_AVAILABLE';

export interface AICommentaryMeta {
  usedAI: boolean;
  status: GeminiDiagnosticStatus | 'DETERMINISTIC_ONLY';
  model?: string;
  noticeAr?: string;
  checkedAt?: string;
}

export interface GeminiDiagnosticResult {
  status: GeminiDiagnosticStatus;
  ok: boolean;
  httpStatus?: number;
  model: string;
  messageAr: string;
  technicalReason: string;
  checkedAt: string;
}


export interface BacktestTrade {
  entryIndex: number;
  exitIndex: number;
  entryTime: number;
  exitTime: number;
  type: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  pnlPercent: number;
  pnlAmount: number;
  reason: 'TP' | 'SL' | 'SignalExit';
}

export interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // percentage e.g. 55.4%
  profitFactor: number;
  expectancyPercent: number;
  totalReturnPercent: number;
  maxDrawdownPercent: number;
  inSampleTrades: number;
  outOfSampleTrades: number;
  inSampleReturn: number;
  outOfSampleReturn: number;
  trades: BacktestTrade[];
}

export interface PriceAlert {
  id: string;
  symbol: MarketSymbol;
  targetPrice: number;
  condition: 'cross_above' | 'cross_below' | 'touch';
  levelType: 'support' | 'resistance' | 'stop_loss' | 'target' | 'custom';
  label: string;
  isActive: boolean;
  createdAt: number;
  triggeredAt?: number;
}

// ==========================================
// Axis 1: Multi-Asset Scanner Interfaces
// ==========================================

export type ScannerDirectionBias = 'شراء قوي' | 'شراء' | 'حياد' | 'بيع' | 'بيع قوي';

export interface MultiAssetOpportunity {
  symbol: MarketSymbol;
  nameAr: string;
  nameEn: string;
  category: AssetCategory;
  price: number;
  priceChangePercent24h: number;
  timeframe: TimeFrame;
  bias: ScannerDirectionBias;
  confluenceScore: number; // 0 - 100
  dominantSchools: string[];
  schoolsSummary: {
    classical: string;
    priceAction: string;
    harmonic: string;
    elliott: string;
    numerical: string;
    astro: string;
  };
  tradeSetup?: {
    hasSetup: boolean;
    bias: 'شراء' | 'بيع' | 'حياد / مراقبة';
    entryMin: number;
    entryMax: number;
    stopLoss: number;
    target1: number;
    riskRewardRatio: number;
    reasoning: string;
  };
  dataSource: string;
  isLive: boolean;
  lastUpdated: string;
  status: 'ready' | 'loading' | 'error' | 'requires_import';
  errorMessage?: string;
}

// ==========================================
// Axis 3: Macroeconomic & Calendar Interfaces
// ==========================================

export interface MacroIndicator {
  id: string;
  nameAr: string;
  nameEn: string;
  currentValue: string | number;
  previousValue: string | number;
  unit: string;
  lastUpdated: string;
  trend: 'up' | 'down' | 'neutral';
  goldImpact: 'إيجابي (صاعد)' | 'سلبي (هابط)' | 'حيادي';
  silverImpact?: 'إيجابي (صاعد)' | 'سلبي (هابط)' | 'حيادي';
  forexImpact?: 'إيجابي للدولار (ضاغط للعملات)' | 'سلبي للدولار (داعم للعملات)' | 'حيادي';
  cryptoImpact: 'إيجابي (صاعد)' | 'سلبي (هابط)' | 'حيادي';
  mechanismExplanation: string;
  source: string;
  sourceUrl?: string;
  isLive?: boolean;
}

export interface MacroAssetImpactItem {
  indicatorId: string;
  indicatorName: string;
  impactOnGold: 'صاعد' | 'هابط' | 'محايد';
  impactOnSilver: 'صاعد' | 'هابط' | 'محايد';
  impactOnForex: 'صاعد للدولار (ضاغط للعملات)' | 'سلبي للدولار (داعم للعملات)' | 'محايد';
  impactOnCrypto: 'صاعد' | 'هابط' | 'محايد';
  transmissionChannel: string;
}

export interface EconomicCalendarEvent {
  id: string;
  titleAr: string;
  country: string;
  currency: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm UTC
  timestampMs: number; // Exact UNIX millisecond timestamp for countdowns and alerts
  importance: 'high' | 'medium' | 'low';
  forecast: string;
  previous: string;
  actual?: string;
  status: 'completed' | 'today' | 'upcoming';
  deviationImpact?: string;
  affectedAssets: (MarketSymbol | string)[];
  goldMechanisticImpact: string;
  silverMechanisticImpact?: string;
  forexMechanisticImpact?: string;
  cryptoMechanisticImpact: string;
}

export interface CalendarEventAlarm {
  eventId: string;
  leadTimeMinutes: number; // e.g. 5, 15, 30, 60 minutes
  enabled: boolean;
  notifiedAt?: number;
}

export interface MacroAnalysisReport {
  lastUpdated: string;
  keyIndicators: MacroIndicator[];
  upcomingEvents: EconomicCalendarEvent[];
  monetaryPolicyState: {
    fedFundsRate: string;
    bias: 'تشديد نقدي (Hawkish)' | 'تيسير نقدي (Dovish)' | 'تريث وتثبيت (Neutral)';
    summary: string;
  };
  goldMacroSynthesis: {
    bias: 'صاعد' | 'هابط' | 'حيادي';
    alignmentWithTechnical: 'داعم للتحليل الفني' | 'معاكس للتحليل الفني' | 'محايد';
    factualData: string[];
    economicMechanism: string[];
    probabilisticHypothesis: string[];
  };
  silverMacroSynthesis: {
    bias: 'صاعد' | 'هابط' | 'حيادي';
    alignmentWithTechnical: 'داعم للتحليل الفني' | 'معاكس للتحليل الفني' | 'محايد';
    factualData: string[];
    economicMechanism: string[];
    probabilisticHypothesis: string[];
  };
  forexMacroSynthesis: {
    bias: 'صاعد' | 'هابط' | 'حيادي';
    alignmentWithTechnical: 'داعم للتحليل الفني' | 'معاكس للتحليل الفني' | 'محايد';
    factualData: string[];
    economicMechanism: string[];
    probabilisticHypothesis: string[];
  };
  cryptoMacroSynthesis: {
    bias: 'صاعد' | 'هابط' | 'حيادي';
    alignmentWithTechnical: 'داعم للتحليل الفني' | 'معاكس للتحليل الفني' | 'محايد';
    factualData: string[];
    economicMechanism: string[];
    probabilisticHypothesis: string[];
  };
  overallMarketRegime: 'شهية مخاطرة مرتفعة (Risk-On)' | 'عزوف عن المخاطرة (Risk-Off)' | 'ترقب وحذر (Wait & See)';
  highImpactWarning?: string;
  macroScoreBySector?: {
    gold: number; // -100 to +100
    silver: number;
    forex: number;
    crypto: number;
  };
  crossAssetImpactMatrix?: MacroAssetImpactItem[];
}


