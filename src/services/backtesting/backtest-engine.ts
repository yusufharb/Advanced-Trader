/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Candle, BacktestResult, BacktestTrade } from '../../types/market.ts';
import { calculateEMASeries, calculateRSISeries, calculateATRSeries } from '../quantitative-engine.ts';

export type StrategyType = 'EMA_Cross_Trend' | 'PriceAction_Breakout' | 'RSI_MeanReversion';

export interface BacktestOptions {
  strategy: StrategyType;
  inSampleRatio?: number; // default 0.70 (70% in-sample, 30% out-of-sample)
  riskRewardTarget?: number; // default 2.0
  slippageAndCommissionPercent?: number; // default 0.05%
}

export function runBacktest(candles: Candle[], options: BacktestOptions): BacktestResult {
  const inSampleRatio = options.inSampleRatio ?? 0.70;
  const targetRR = options.riskRewardTarget ?? 2.0;
  const cost = (options.slippageAndCommissionPercent ?? 0.05) / 100;

  if (candles.length < 50) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      profitFactor: 0,
      expectancyPercent: 0,
      totalReturnPercent: 0,
      maxDrawdownPercent: 0,
      inSampleTrades: 0,
      outOfSampleTrades: 0,
      inSampleReturn: 0,
      outOfSampleReturn: 0,
      trades: [],
    };
  }

  const splitIndex = Math.floor(candles.length * inSampleRatio);

  // Pre-calculate indicators
  const ema20 = calculateEMASeries(candles, 20);
  const ema50 = calculateEMASeries(candles, 50);
  const rsi = calculateRSISeries(candles, 14);
  const atr = calculateATRSeries(candles, 14);

  const trades: BacktestTrade[] = [];
  let inPosition = false;
  let currentTrade: Partial<BacktestTrade> | null = null;
  let currentSL = 0;
  let currentTP = 0;

  // Run sequential simulation (No Look-Ahead Bias)
  for (let i = 50; i < candles.length; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];

    // If currently in position, check SL / TP hits first
    if (inPosition && currentTrade) {
      let exitPrice: number | null = null;
      let exitReason: 'TP' | 'SL' | 'SignalExit' = 'SignalExit';

      if (currentTrade.type === 'buy') {
        if (c.low <= currentSL) {
          exitPrice = currentSL;
          exitReason = 'SL';
        } else if (c.high >= currentTP) {
          exitPrice = currentTP;
          exitReason = 'TP';
        }
      } else if (currentTrade.type === 'sell') {
        if (c.high >= currentSL) {
          exitPrice = currentSL;
          exitReason = 'SL';
        } else if (c.low <= currentTP) {
          exitPrice = currentTP;
          exitReason = 'TP';
        }
      }

      if (exitPrice !== null || i === candles.length - 1) {
        const finalExitPrice = exitPrice ?? c.close;
        const entryPrice = currentTrade.entryPrice!;
        let rawPnl = currentTrade.type === 'buy'
          ? (finalExitPrice - entryPrice) / entryPrice
          : (entryPrice - finalExitPrice) / entryPrice;

        // Deduct round-trip fees and slippage
        rawPnl -= (cost * 2);

        trades.push({
          entryIndex: currentTrade.entryIndex!,
          exitIndex: i,
          entryTime: currentTrade.entryTime!,
          exitTime: c.time,
          type: currentTrade.type as 'buy' | 'sell',
          entryPrice: Number(entryPrice.toFixed(2)),
          exitPrice: Number(finalExitPrice.toFixed(2)),
          pnlPercent: Number((rawPnl * 100).toFixed(2)),
          pnlAmount: Number((rawPnl * 1000).toFixed(2)),
          reason: exitReason,
        });

        inPosition = false;
        currentTrade = null;
        continue;
      }
    }

    // If not in position, scan for entry signal based on selected strategy
    if (!inPosition && i < candles.length - 1) {
      const currentAtr = atr[i] || c.close * 0.01;
      let signal: 'buy' | 'sell' | null = null;

      if (options.strategy === 'EMA_Cross_Trend') {
        // EMA 20 crosses EMA 50
        const prevEma20 = ema20[i - 1];
        const prevEma50 = ema50[i - 1];
        const currEma20 = ema20[i];
        const currEma50 = ema50[i];
        const currRsi = rsi[i];

        if (prevEma20 !== null && prevEma50 !== null && currEma20 !== null && currEma50 !== null && currRsi !== null) {
          if (prevEma20 <= prevEma50 && currEma20 > currEma50 && currRsi > 50) {
            signal = 'buy';
          } else if (prevEma20 >= prevEma50 && currEma20 < currEma50 && currRsi < 50) {
            signal = 'sell';
          }
        }
      } else if (options.strategy === 'RSI_MeanReversion') {
        const currRsi = rsi[i];
        const prevRsi = rsi[i - 1];
        if (currRsi !== null && prevRsi !== null) {
          if (prevRsi < 30 && currRsi >= 30) {
            signal = 'buy';
          } else if (prevRsi > 70 && currRsi <= 70) {
            signal = 'sell';
          }
        }
      } else if (options.strategy === 'PriceAction_Breakout') {
        // Breakout of 20-candle high/low
        const lookbackHigh = Math.max(...candles.slice(i - 20, i).map(k => k.high));
        const lookbackLow = Math.min(...candles.slice(i - 20, i).map(k => k.low));

        if (c.close > lookbackHigh) {
          signal = 'buy';
        } else if (c.close < lookbackLow) {
          signal = 'sell';
        }
      }

      if (signal) {
        const entryPrice = c.close;
        const slDistance = currentAtr * 1.5;
        const tpDistance = slDistance * targetRR;

        if (signal === 'buy') {
          currentSL = entryPrice - slDistance;
          currentTP = entryPrice + tpDistance;
        } else {
          currentSL = entryPrice + slDistance;
          currentTP = entryPrice - tpDistance;
        }

        inPosition = true;
        currentTrade = {
          entryIndex: i,
          entryTime: c.time,
          type: signal,
          entryPrice,
        };
      }
    }
  }

  // Statistical Evaluation
  const totalTrades = trades.length;
  const winningTrades = trades.filter(t => t.pnlPercent > 0).length;
  const losingTrades = trades.filter(t => t.pnlPercent <= 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const grossProfit = trades.filter(t => t.pnlPercent > 0).reduce((acc, t) => acc + t.pnlPercent, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pnlPercent < 0).reduce((acc, t) => acc + t.pnlPercent, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  const totalReturnPercent = trades.reduce((acc, t) => acc + t.pnlPercent, 0);
  const expectancyPercent = totalTrades > 0 ? totalReturnPercent / totalTrades : 0;

  // Max Drawdown calculation over cumulative equity
  let peak = 100;
  let equity = 100;
  let maxDrawdown = 0;

  for (const t of trades) {
    equity *= (1 + (t.pnlPercent / 100));
    if (equity > peak) peak = equity;
    const dd = ((peak - equity) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Split In-Sample vs Out-of-Sample metrics
  const inSampleTradesList = trades.filter(t => t.entryIndex < splitIndex);
  const outOfSampleTradesList = trades.filter(t => t.entryIndex >= splitIndex);

  const inSampleReturn = inSampleTradesList.reduce((acc, t) => acc + t.pnlPercent, 0);
  const outOfSampleReturn = outOfSampleTradesList.reduce((acc, t) => acc + t.pnlPercent, 0);

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRate: Number(winRate.toFixed(1)),
    profitFactor: Number(profitFactor.toFixed(2)),
    expectancyPercent: Number(expectancyPercent.toFixed(2)),
    totalReturnPercent: Number(totalReturnPercent.toFixed(2)),
    maxDrawdownPercent: Number(maxDrawdown.toFixed(2)),
    inSampleTrades: inSampleTradesList.length,
    outOfSampleTrades: outOfSampleTradesList.length,
    inSampleReturn: Number(inSampleReturn.toFixed(2)),
    outOfSampleReturn: Number(outOfSampleReturn.toFixed(2)),
    trades,
  };
}
