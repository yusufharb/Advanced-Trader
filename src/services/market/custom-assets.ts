/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type AssetConfig,
  type AssetCategory,
  type MarketSymbol,
  SUPPORTED_ASSETS,
  type SymbolSearchResult,
} from '../../types/market.ts';

export const CUSTOM_ASSETS_STORAGE_KEY = 'custom_watched_assets';

// In-memory store for SSR / Node test environments where window.localStorage is unavailable
let memoryCustomAssets: AssetConfig[] = [];

const ISO_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
  'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'PLN', 'TRY', 'ZAR',
  'MXN', 'CNH', 'CNY', 'INR', 'BRL', 'AED', 'SAR', 'KWD', 'EGP',
]);

/**
 * Built-in reference dictionary for Egyptian Exchange (EGX / البورصة المصرية) equities
 */
export const EGX_STOCKS_DIRECTORY: Record<string, { nameAr: string; nameEn: string }> = {
  AMII: { nameAr: 'العربية للصناعات المعدنية والاستثمارات الصناعية (AMII)', nameEn: 'Arabian Metal Industries & Industrial Investments' },
  MAII: { nameAr: 'العربية للصناعات المعدنية والاستثمارات الصناعية (AMII)', nameEn: 'Arabian Metal Industries & Industrial Investments' },
  COMI: { nameAr: 'البنك التجاري الدولي - مصر (CIB)', nameEn: 'Commercial International Bank (Egypt)' },
  FWRY: { nameAr: 'فوري لتكنولوجيا البنوك والمدفوعات (Fawry)', nameEn: 'Fawry for Banking Technology' },
  TMGH: { nameAr: 'مجموعة طلعت مصطفى القابضة (TMG)', nameEn: 'Talaat Moustafa Group Holding' },
  SWDY: { nameAr: 'السويدي إليكتريك (Elsewedy Electric)', nameEn: 'Elsewedy Electric Co' },
  HRHO: { nameAr: 'إي إف جي القابضة - هيرميس (EFG Holding)', nameEn: 'EFG Holding SAE' },
  AMOC: { nameAr: 'الإسكندرية للزيوت المعدنية (أموك)', nameEn: 'Alexandria Mineral Oils Co' },
  ABUK: { nameAr: 'أبو قير للأسمدة والصناعات الكيماوية', nameEn: 'Abu Qir Fertilizers' },
  MFPC: { nameAr: 'مصر لإنتاج الأسمدة (موبكو)', nameEn: 'Misr Fertilizers Production (MOPCO)' },
  ESRS: { nameAr: 'حديد عز (Ezz Steel)', nameEn: 'Ezz Steel Co' },
  ETEL: { nameAr: 'المصرية للاتصالات (WE)', nameEn: 'Telecom Egypt' },
  EAST: { nameAr: 'الشرقية للدخان (إيسترن كومباني)', nameEn: 'Eastern Company SAE' },
  EFIH: { nameAr: 'إي فاينانس للاستثمارات المالية والرقمية', nameEn: 'e-finance for Digital & Financial Investments' },
  HELI: { nameAr: 'مصر الجديدة للإسكان والتعمير', nameEn: 'Heliopolis Housing and Development' },
  PHDC: { nameAr: 'بالم هيلز للتعمير (Palm Hills)', nameEn: 'Palm Hills Developments' },
  ORAS: { nameAr: 'أوراسكوم كونستراكشون بي إل سي', nameEn: 'Orascom Construction PLC' },
  GBCO: { nameAr: 'جي بي كورب (غبور أوتو)', nameEn: 'GB Corp SAE' },
  ADIB: { nameAr: 'مصرف أبوظبي الإسلامي - مصر', nameEn: 'Abu Dhabi Islamic Bank Egypt' },
  EKHO: { nameAr: 'القابضة المصرية الكويتية (دولار)', nameEn: 'Egypt Kuwait Holding' },
  EKHOA: { nameAr: 'القابضة المصرية الكويتية (جنيه)', nameEn: 'Egypt Kuwait Holding (EGP)' },
  CIEB: { nameAr: 'بنك كريدي أجريكول - مصر', nameEn: 'Credit Agricole Egypt' },
  CLHO: { nameAr: 'مستشفيات كليوباترا', nameEn: 'Cleopatra Hospital Company' },
  JUFO: { nameAr: 'جهينة للصناعات الغذائية', nameEn: 'Juhayna Food Industries' },
  SIDI: { nameAr: 'سيدي كرير للبتروكيماويات (سيدبك)', nameEn: 'Sidi Kerir Petrochemicals' },
  SKPC: { nameAr: 'سيدي كرير للبتروكيماويات', nameEn: 'Sidi Kerir Petrochemicals (SKPC)' },
  ISPH: { nameAr: 'ابن سينا فارما', nameEn: 'Ibnsina Pharma SAE' },
  MASR: { nameAr: 'مدينة مصر للإسكان والتعمير', nameEn: 'Madinet Masr for Housing' },
  EMFD: { nameAr: 'إعمار مصر للتنمية', nameEn: 'Emaar Misr for Development' },
  ORWE: { nameAr: 'النساجون الشرقيون للسجاد', nameEn: 'Oriental Weavers Carpets' },
  BTFH: { nameAr: 'بلتون القابضة (Beltone)', nameEn: 'Beltone Financial Holding' },
  CCAP: { nameAr: 'القلعة للاستشارات المالية', nameEn: 'Qalaa Holdings SAE' },
  RAYA: { nameAr: 'راية القابضة للاستثمارات المالية', nameEn: 'Raya Holding for Financial Investments' },
  TALM: { nameAr: 'تعليم لخدمات الإدارة', nameEn: 'Taaleem Management Services' },
  DOMT: { nameAr: 'الصناعات الغذائية العربية (دومتي)', nameEn: 'Arabian Food Industries (Domty)' },
  EGAL: { nameAr: 'مصر للألومنيوم', nameEn: 'Egypt Aluminum' },
  EGCH: { nameAr: 'الصناعات الكيماوية المصرية (كيما)', nameEn: 'Egyptian Chemical Industries (KIMA)' },
  EXPA: { nameAr: 'البنك المصري لتنمية الصادرات', nameEn: 'Export Development Bank of Egypt' },
  FAIT: { nameAr: 'بنك فيصل الإسلامي المصري', nameEn: 'Faisal Islamic Bank of Egypt' },
  HDBK: { nameAr: 'بنك التعمير والإسكان', nameEn: 'Housing & Development Bank' },
  QNBA: { nameAr: 'بنك قطر الوطني الأهلي (QNB)', nameEn: 'QNB Alahli' },
  CIRA: { nameAr: 'القاهرة للاستثمار والتنمية العقارية (سيرا)', nameEn: 'Cairo for Investment and Real Estate' },
  EFID: { nameAr: 'إيديتا للصناعات الغذائية', nameEn: 'Edita Food Industries' },
};

const COMMODITY_ALIASES: Record<string, { nameAr: string; nameEn: string; decimals: number; providerSymbol: string }> = {
  OIL: { nameAr: 'نفط خام غرب تكساس (WTI)', nameEn: 'WTI Crude Oil', decimals: 2, providerSymbol: 'CL=F' },
  USOIL: { nameAr: 'نفط خام غرب تكساس (USOIL)', nameEn: 'WTI Crude Oil', decimals: 2, providerSymbol: 'CL=F' },
  WTI: { nameAr: 'نفط خام غرب تكساس (WTI)', nameEn: 'WTI Crude Oil', decimals: 2, providerSymbol: 'CL=F' },
  'CL=F': { nameAr: 'عقود النفط الخام (CL=F)', nameEn: 'Crude Oil Futures', decimals: 2, providerSymbol: 'CL=F' },
  BRENT: { nameAr: 'نفط برنت القياسي (Brent)', nameEn: 'Brent Crude Oil', decimals: 2, providerSymbol: 'BZ=F' },
  UKOIL: { nameAr: 'نفط برنت (UKOIL)', nameEn: 'Brent Crude Oil', decimals: 2, providerSymbol: 'BZ=F' },
  'BZ=F': { nameAr: 'عقود نفط برنت (BZ=F)', nameEn: 'Brent Crude Futures', decimals: 2, providerSymbol: 'BZ=F' },
  NATGAS: { nameAr: 'الغاز الطبيعي (Natural Gas)', nameEn: 'Natural Gas', decimals: 3, providerSymbol: 'NG=F' },
  'NG=F': { nameAr: 'عقود الغاز الطبيعي (NG=F)', nameEn: 'Natural Gas Futures', decimals: 3, providerSymbol: 'NG=F' },
  COPPER: { nameAr: 'النحاس (Copper)', nameEn: 'Copper Futures', decimals: 4, providerSymbol: 'HG=F' },
  'HG=F': { nameAr: 'عقود النحاس (HG=F)', nameEn: 'Copper Futures', decimals: 4, providerSymbol: 'HG=F' },
  PLATINUM: { nameAr: 'البلاتين (Platinum)', nameEn: 'Platinum Spot', decimals: 2, providerSymbol: 'PL=F' },
  XPTUSD: { nameAr: 'البلاتين مقابل الدولار', nameEn: 'Platinum / USD', decimals: 2, providerSymbol: 'PL=F' },
};

const INDEX_ALIASES: Record<string, { nameAr: string; nameEn: string; decimals: number; providerSymbol: string }> = {
  NAS100: { nameAr: 'مؤشر ناسداك 100 (NAS100)', nameEn: 'Nasdaq 100 Index', decimals: 2, providerSymbol: '^NDX' },
  NDX: { nameAr: 'مؤشر ناسداك 100 (NDX)', nameEn: 'Nasdaq 100 Index', decimals: 2, providerSymbol: '^NDX' },
  USTEC: { nameAr: 'مؤشر ناسداك التكنولوجي (USTEC)', nameEn: 'Nasdaq 100', decimals: 2, providerSymbol: '^NDX' },
  US100: { nameAr: 'مؤشر التكنولوجيا الأمريكي 100', nameEn: 'US Tech 100', decimals: 2, providerSymbol: '^NDX' },
  '^NDX': { nameAr: 'مؤشر ناسداك 100 (^NDX)', nameEn: 'Nasdaq 100 Index', decimals: 2, providerSymbol: '^NDX' },
  SPX: { nameAr: 'مؤشر إس آند بي 500 (S&P 500)', nameEn: 'S&P 500 Index', decimals: 2, providerSymbol: '^GSPC' },
  US500: { nameAr: 'مؤشر إس آند بي 500 (US500)', nameEn: 'S&P 500 Index', decimals: 2, providerSymbol: '^GSPC' },
  SP500: { nameAr: 'مؤشر إس آند بي 500 (SP500)', nameEn: 'S&P 500 Index', decimals: 2, providerSymbol: '^GSPC' },
  '^GSPC': { nameAr: 'مؤشر إس آند بي 500 (^GSPC)', nameEn: 'S&P 500 Index', decimals: 2, providerSymbol: '^GSPC' },
  DJI: { nameAr: 'مؤشر داو جونز الصناعي (DJI)', nameEn: 'Dow Jones Industrial', decimals: 2, providerSymbol: '^DJI' },
  US30: { nameAr: 'مؤشر داو جونز 30 (US30)', nameEn: 'Dow Jones 30', decimals: 2, providerSymbol: '^DJI' },
  DJ30: { nameAr: 'مؤشر داو جونز 30 (DJ30)', nameEn: 'Dow Jones 30', decimals: 2, providerSymbol: '^DJI' },
  '^DJI': { nameAr: 'مؤشر داو جونز الصناعي (^DJI)', nameEn: 'Dow Jones Industrial', decimals: 2, providerSymbol: '^DJI' },
  DAX: { nameAr: 'مؤشر داكس الألماني 40 (DAX)', nameEn: 'Germany DAX 40', decimals: 2, providerSymbol: '^GDAXI' },
  GER40: { nameAr: 'مؤشر ألمانيا 40 (GER40)', nameEn: 'Germany 40', decimals: 2, providerSymbol: '^GDAXI' },
  '^GDAXI': { nameAr: 'مؤشر داكس الألماني (^GDAXI)', nameEn: 'DAX Performance Index', decimals: 2, providerSymbol: '^GDAXI' },
  DXY: { nameAr: 'مؤشر الدولار الأمريكي (DXY)', nameEn: 'US Dollar Index', decimals: 3, providerSymbol: 'DX-Y.NYB' },
};

export const POPULAR_US_STOCKS: Record<string, { nameAr: string; nameEn: string }> = {
  NVDA: { nameAr: 'سهم إنفيديا (NVIDIA)', nameEn: 'NVIDIA Corp' },
  AAPL: { nameAr: 'سهم أبل (Apple)', nameEn: 'Apple Inc' },
  TSLA: { nameAr: 'سهم تسلا (Tesla)', nameEn: 'Tesla Inc' },
  MSFT: { nameAr: 'سهم مايكروسوفت (Microsoft)', nameEn: 'Microsoft Corp' },
  AMZN: { nameAr: 'سهم أمازون (Amazon)', nameEn: 'Amazon.com Inc' },
  META: { nameAr: 'سهم ميتا (Meta)', nameEn: 'Meta Platforms' },
  GOOGL: { nameAr: 'سهم ألفابت جوجل (Google)', nameEn: 'Alphabet Inc' },
  GOOG: { nameAr: 'سهم ألفابت جوجل (GOOG)', nameEn: 'Alphabet Inc Class C' },
  AMD: { nameAr: 'سهم إيه إم دي (AMD)', nameEn: 'Advanced Micro Devices' },
  NFLX: { nameAr: 'سهم نتفليكس (Netflix)', nameEn: 'Netflix Inc' },
  COIN: { nameAr: 'سهم كوين بيس (Coinbase)', nameEn: 'Coinbase Global' },
  MSTR: { nameAr: 'سهم مايكروستراتيجي (MicroStrategy)', nameEn: 'MicroStrategy Inc' },
  INTC: { nameAr: 'سهم إنتل (Intel)', nameEn: 'Intel Corp' },
  IBM: { nameAr: 'سهم آي بي إم (IBM)', nameEn: 'IBM Corp' },
  ORCL: { nameAr: 'سهم أوراكل (Oracle)', nameEn: 'Oracle Corp' },
  BA: { nameAr: 'سهم بوينج (Boeing)', nameEn: 'Boeing Co' },
  DIS: { nameAr: 'سهم ديزني (Disney)', nameEn: 'Walt Disney Co' },
  JPM: { nameAr: 'سهم جي بي مورجان (JPMorgan)', nameEn: 'JPMorgan Chase' },
  V: { nameAr: 'سهم فيزا (Visa)', nameEn: 'Visa Inc' },
  MA: { nameAr: 'سهم ماستركارد (Mastercard)', nameEn: 'Mastercard Inc' },
  WMT: { nameAr: 'سهم وول مارت (Walmart)', nameEn: 'Walmart Inc' },
  KO: { nameAr: 'سهم كوكاكولا (Coca-Cola)', nameEn: 'Coca-Cola Co' },
  PEP: { nameAr: 'سهم بيبسيكو (PepsiCo)', nameEn: 'PepsiCo Inc' },
  XOM: { nameAr: 'سهم إكسون موبيل (ExxonMobil)', nameEn: 'Exxon Mobil Corp' },
  CVX: { nameAr: 'سهم شيفرون (Chevron)', nameEn: 'Chevron Corp' },
  PFE: { nameAr: 'سهم فايزر (Pfizer)', nameEn: 'Pfizer Inc' },
  LLY: { nameAr: 'سهم إيلي ليلي (Eli Lilly)', nameEn: 'Eli Lilly and Co' },
  UNH: { nameAr: 'سهم يونايتد هيلث (UnitedHealth)', nameEn: 'UnitedHealth Group' },
  'BRK-B': { nameAr: 'سهم بيركشاير هاثاواي (Berkshire)', nameEn: 'Berkshire Hathaway' },
  SPY: { nameAr: 'صندوق S&P 500 (SPY ETF)', nameEn: 'SPDR S&P 500 ETF' },
  QQQ: { nameAr: 'صندوق ناسداك 100 (QQQ ETF)', nameEn: 'Invesco QQQ Trust' },
  PLTR: { nameAr: 'سهم بالانتير (Palantir)', nameEn: 'Palantir Technologies' },
  AVGO: { nameAr: 'سهم برودكوم (Broadcom)', nameEn: 'Broadcom Inc' },
  BABA: { nameAr: 'سهم علي بابا (Alibaba)', nameEn: 'Alibaba Group' },
  TSM: { nameAr: 'سهم تايوان لأشباه الموصلات (TSMC)', nameEn: 'Taiwan Semiconductor' },
};

/**
 * Strips .CA suffix so AMII and AMII.CA always map to the same canonical display symbol 'AMII'
 */
export function normalizeDisplaySymbol(rawSymbol: string): string {
  const clean = rawSymbol.trim().toUpperCase();
  if (clean.endsWith('.CA') && clean.length > 3) {
    return clean.slice(0, -3);
  }
  return clean;
}

export function isKnownUsStock(symbol: string): boolean {
  const clean = symbol.trim().toUpperCase();
  return clean in POPULAR_US_STOCKS;
}

export function isEgxStockSymbol(symbol: string): boolean {
  const clean = symbol.trim().toUpperCase();
  if (clean.endsWith('.CA') && clean.length > 3) return true;
  const base = normalizeDisplaySymbol(clean);
  if (base in EGX_STOCKS_DIRECTORY) return true;
  const saved = getCustomWatchedAssets().find((a) => a.symbol === base);
  if (saved && (saved.market === 'EGX' || saved.providerSymbol?.endsWith('.CA'))) {
    return true;
  }
  return false;
}

export function isForexPairSymbol(symbol: string): boolean {
  const clean = symbol.trim().toUpperCase().replace('=X', '');
  if (!/^[A-Z]{6}$/.test(clean)) return false;
  if (clean.endsWith('USDT') || clean.endsWith('BUSD') || clean.endsWith('USDC')) return false;
  const base = clean.slice(0, 3);
  const quote = clean.slice(3, 6);
  return ISO_CURRENCIES.has(base) && ISO_CURRENCIES.has(quote);
}

export function isCryptoPairSymbol(symbol: string): boolean {
  const clean = symbol.trim().toUpperCase();
  return (
    clean.endsWith('USDT') ||
    clean.endsWith('BUSD') ||
    clean.endsWith('USDC') ||
    clean.endsWith('FDUSD') ||
    (clean.endsWith('BTC') && clean.length >= 6)
  );
}

export function inferAssetMetadata(
  rawSymbol: string,
  referencePrice?: number,
  options?: { forceEgx?: boolean }
): AssetConfig {
  const rawClean = rawSymbol.trim().toUpperCase();
  const displaySym = normalizeDisplaySymbol(rawClean);

  // 1. Check built-in SUPPORTED_ASSETS first
  const builtIn = SUPPORTED_ASSETS.find((a) => a.symbol === displaySym);
  if (builtIn) {
    return {
      ...builtIn,
      providerSymbol: builtIn.providerSymbol || builtIn.symbol,
      market:
        builtIn.category === 'crypto' || builtIn.category === 'proxy'
          ? 'CRYPTO'
          : builtIn.category === 'forex'
          ? 'FOREX'
          : 'COMMODITIES',
      currency: builtIn.symbol.endsWith('USDT')
        ? 'USDT'
        : builtIn.symbol === 'USDJPY'
        ? 'JPY'
        : builtIn.symbol === 'USDCHF'
        ? 'CHF'
        : builtIn.symbol === 'USDCAD'
        ? 'CAD'
        : 'USD',
    };
  }

  // 2. Check custom saved assets
  const saved = getCustomWatchedAssets().find((a) => a.symbol === displaySym);
  if (saved && !options?.forceEgx) {
    return saved;
  }

  // 3. Check Egyptian Exchange (EGX) stocks (.CA suffix or in EGX_STOCKS_DIRECTORY or forceEgx)
  if (rawClean.endsWith('.CA') || displaySym in EGX_STOCKS_DIRECTORY || options?.forceEgx) {
    const egxInfo = EGX_STOCKS_DIRECTORY[displaySym];
    return {
      symbol: displaySym,
      providerSymbol: `${displaySym}.CA`,
      nameAr: egxInfo ? egxInfo.nameAr : `سهم ${displaySym} (البورصة المصرية)`,
      nameEn: egxInfo ? egxInfo.nameEn : `${displaySym} (EGX Equity)`,
      category: 'stock',
      market: 'EGX',
      currency: 'EGP',
      decimals: 2,
      isLiveSupported: false,
      descriptionAr: `${egxInfo ? egxInfo.nameAr : `سهم ${displaySym}`} - البورصة المصرية (EGX / الجنيه المصري EGP).`,
      provider: 'yahoo',
      isCustom: true,
    };
  }

  // 4. Check commodity aliases
  if (rawClean in COMMODITY_ALIASES) {
    const info = COMMODITY_ALIASES[rawClean];
    return {
      symbol: rawClean,
      providerSymbol: info.providerSymbol,
      nameAr: info.nameAr,
      nameEn: info.nameEn,
      category: 'commodity',
      market: 'COMMODITIES',
      currency: 'USD',
      decimals: info.decimals,
      isLiveSupported: true,
      descriptionAr: `${info.nameAr} - بيانات سوق السلع العالمية المباشرة.`,
      provider: 'yahoo',
      isCustom: true,
    };
  }

  // 5. Check index aliases
  if (rawClean in INDEX_ALIASES || rawClean.startsWith('^')) {
    const info = INDEX_ALIASES[rawClean] || {
      nameAr: `مؤشر ${rawClean}`,
      nameEn: `${rawClean} Index`,
      decimals: 2,
      providerSymbol: rawClean,
    };
    return {
      symbol: rawClean,
      providerSymbol: info.providerSymbol,
      nameAr: info.nameAr,
      nameEn: info.nameEn,
      category: 'index',
      market: 'GLOBAL_INDEX',
      currency: 'USD',
      decimals: info.decimals,
      isLiveSupported: true,
      descriptionAr: `${info.nameAr} - بيانات المؤشرات العالمية الحية.`,
      provider: 'yahoo',
      isCustom: true,
    };
  }

  // 6. Check Forex 6-letter cross pairs
  if (isForexPairSymbol(rawClean)) {
    const cleanPair = rawClean.replace('=X', '');
    const base = cleanPair.slice(0, 3);
    const quote = cleanPair.slice(3, 6);
    const decimals = quote === 'JPY' ? 3 : 5;
    return {
      symbol: cleanPair,
      providerSymbol: `${cleanPair}=X`,
      nameAr: `زوج ${base} / ${quote}`,
      nameEn: `${base}/${quote}`,
      category: 'forex',
      market: 'FOREX',
      currency: quote,
      decimals,
      isLiveSupported: true,
      descriptionAr: `زوج العملات الأجنبية ${base}/${quote} - بيانات سوق الفوركس الفورية.`,
      provider: 'yahoo',
      isCustom: true,
    };
  }

  // 7. Check Crypto pairs
  if (isCryptoPairSymbol(rawClean)) {
    const baseCoin = rawClean.replace(/(USDT|BUSD|USDC|FDUSD)$/, '');
    const decimals =
      referencePrice !== undefined && referencePrice > 0
        ? referencePrice < 2
          ? 5
          : referencePrice < 10
          ? 4
          : referencePrice < 200
          ? 3
          : 2
        : ['XRP', 'DOGE', 'ADA', 'TRX', 'SHIB', 'PEPE', 'XLM', 'HBAR', 'ALGO'].includes(baseCoin)
        ? 5
        : 2;
    return {
      symbol: rawClean,
      providerSymbol: rawClean,
      nameAr: `عملة ${baseCoin}`,
      nameEn: `${baseCoin} / USDT`,
      category: 'crypto',
      market: 'CRYPTO',
      currency: 'USDT',
      decimals,
      isLiveSupported: true,
      descriptionAr: `الأصل الرقمي ${rawClean} - تدفق حي من منصة Binance Spot.`,
      provider: 'binance',
      isCustom: true,
    };
  }

  // 8. Standard US / Global Stock / ETF
  const stockInfo = POPULAR_US_STOCKS[displaySym];
  return {
    symbol: displaySym,
    providerSymbol: displaySym,
    nameAr: stockInfo ? stockInfo.nameAr : `سهم ${displaySym}`,
    nameEn: stockInfo ? stockInfo.nameEn : `${displaySym} Equity`,
    category: 'stock',
    market: 'US',
    currency: 'USD',
    decimals: 2,
    isLiveSupported: true,
    descriptionAr: `${stockInfo ? stockInfo.nameAr : `سهم ${displaySym}`} - بيانات البورصة العالمية المباشرة.`,
    provider: 'yahoo',
    isCustom: true,
  };
}

/**
 * Retrieves custom watched assets saved by the user in localStorage (or memory in Node tests)
 */
export function getCustomWatchedAssets(): AssetConfig[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [...memoryCustomAssets];
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_ASSETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const result: AssetConfig[] = [];
    for (const item of parsed) {
      if (!item || typeof item.symbol !== 'string' || !item.symbol.trim()) continue;
      const canonical = normalizeDisplaySymbol(item.symbol);
      if (SUPPORTED_ASSETS.some((core) => core.symbol === canonical)) continue;
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      result.push({
        ...item,
        symbol: canonical,
      });
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Saves custom watched assets list to localStorage (and memory fallback)
 */
export function saveCustomWatchedAssets(assets: AssetConfig[]): void {
  memoryCustomAssets = [...assets];
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(CUSTOM_ASSETS_STORAGE_KEY, JSON.stringify(assets));
    window.dispatchEvent(new CustomEvent('custom-assets-updated'));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Adds or updates a custom asset in localStorage and returns the updated list.
 * Ensures that 'AMII' and 'AMII.CA' map to the exact same canonical symbol ('AMII') with providerSymbol 'AMII.CA'.
 */
export function addCustomWatchedAsset(
  input: AssetConfig | SymbolSearchResult | string
): AssetConfig[] {
  const current = getCustomWatchedAssets();
  let config: AssetConfig;

  if (typeof input === 'string') {
    config = inferAssetMetadata(input);
  } else if ('descriptionAr' in input) {
    const canonical = normalizeDisplaySymbol(input.symbol);
    const isEgx =
      input.market === 'EGX' ||
      input.symbol.toUpperCase().endsWith('.CA') ||
      input.providerSymbol?.toUpperCase().endsWith('.CA') ||
      canonical in EGX_STOCKS_DIRECTORY;
    config = {
      ...input,
      symbol: canonical,
      providerSymbol: isEgx ? `${canonical}.CA` : input.providerSymbol || canonical,
      market: isEgx ? 'EGX' : input.market || 'US',
      currency: isEgx ? 'EGP' : input.currency || 'USD',
      isCustom: true,
    };
  } else {
    const canonical = normalizeDisplaySymbol(input.symbol);
    const isEgx =
      input.market === 'EGX' ||
      input.symbol.toUpperCase().endsWith('.CA') ||
      input.providerSymbol?.toUpperCase().endsWith('.CA') ||
      canonical in EGX_STOCKS_DIRECTORY;
    config = {
      symbol: canonical,
      providerSymbol: isEgx ? `${canonical}.CA` : input.providerSymbol || canonical,
      nameAr: input.nameAr,
      nameEn: input.nameEn,
      category: input.category,
      market: isEgx ? 'EGX' : input.market || (input.category === 'crypto' ? 'CRYPTO' : 'US'),
      currency: isEgx ? 'EGP' : input.currency || (input.category === 'crypto' ? 'USDT' : 'USD'),
      decimals: input.decimals,
      isLiveSupported: !isEgx,
      descriptionAr: `${input.nameAr} (${canonical}) - أصل مخصص مضاف عبر الباحث الذكي.`,
      provider: input.provider,
      isCustom: true,
    };
  }

  // If it's already in core SUPPORTED_ASSETS, no need to duplicate
  if (SUPPORTED_ASSETS.some((a) => a.symbol === config.symbol)) {
    return current;
  }

  const filtered = current.filter(
    (a) => normalizeDisplaySymbol(a.symbol) !== config.symbol
  );
  const updated = [config, ...filtered].slice(0, 30);
  saveCustomWatchedAssets(updated);
  return updated;
}

/**
 * Removes a custom asset from localStorage
 */
export function removeCustomWatchedAsset(symbol: MarketSymbol): AssetConfig[] {
  const canonical = normalizeDisplaySymbol(symbol);
  const current = getCustomWatchedAssets();
  const updated = current.filter((a) => normalizeDisplaySymbol(a.symbol) !== canonical);
  saveCustomWatchedAssets(updated);
  return updated;
}

/**
 * Returns all watched assets (15 core + user custom watched assets)
 */
export function getAllWatchedAssets(): AssetConfig[] {
  return [...SUPPORTED_ASSETS, ...getCustomWatchedAssets()];
}

/**
 * Returns dynamic decimal precision for any symbol
 */
export function getAssetDecimals(symbol: MarketSymbol, currentPrice?: number): number {
  const canonical = normalizeDisplaySymbol(symbol);
  const all = getAllWatchedAssets();
  const found = all.find((a) => a.symbol === canonical);
  if (found && (!currentPrice || found.category !== 'crypto')) {
    return found.decimals;
  }
  if (currentPrice !== undefined && currentPrice > 0) {
    if (currentPrice < 2) return 5;
    if (currentPrice < 10) return 4;
    if (currentPrice < 200) return 3;
    return 2;
  }
  return inferAssetMetadata(symbol).decimals;
}
