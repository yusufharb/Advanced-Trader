/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PriceAlert, MarketSymbol, TechnicalReport } from '../types/market.ts';

const STORAGE_KEY = 'advanced_market_analyst_alerts';

function playAlertChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Play a distinct dual-tone ascending harmonic chime
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(784, now); // G5
    osc1.frequency.setValueAtTime(1046.5, now + 0.12); // C6
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);
  } catch (e) {
    console.warn('[PriceAlerts] Audio playback not permitted or unsupported:', e);
  }
}

function triggerVibration() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([250, 100, 250]);
    } catch {}
  }
}

export function usePriceAlerts(currentPrice: number, symbol: MarketSymbol) {
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeToast, setActiveToast] = useState<{
    alert: PriceAlert;
    price: number;
    timestamp: number;
  } | null>(null);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const prevPriceRef = useRef<number>(currentPrice);

  // Save alerts to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch (e) {
      console.warn('Failed to save alerts to localStorage:', e);
    }
  }, [alerts]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        return perm;
      } catch (e) {
        console.warn('Notification permission request error:', e);
      }
    }
    return 'unsupported';
  }, []);

  // Monitor price changes and evaluate active alerts
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;

    const prev = prevPriceRef.current;
    prevPriceRef.current = currentPrice;

    // Skip evaluation if no previous baseline or no movement
    if (!prev || prev === currentPrice) return;

    setAlerts((prevAlerts) => {
      let updated = false;
      const nextAlerts = prevAlerts.map((alt) => {
        if (!alt.isActive || alt.symbol !== symbol) return alt;

        let triggered = false;
        const target = alt.targetPrice;

        if (alt.condition === 'cross_above') {
          if (prev <= target && currentPrice >= target) {
            triggered = true;
          }
        } else if (alt.condition === 'cross_below') {
          if (prev >= target && currentPrice <= target) {
            triggered = true;
          }
        } else if (alt.condition === 'touch') {
          // Touch condition within 0.2% tolerance or crossing
          const threshold = target * 0.002;
          if (Math.abs(currentPrice - target) <= threshold) {
            triggered = true;
          } else if ((prev <= target && currentPrice >= target) || (prev >= target && currentPrice <= target)) {
            triggered = true;
          }
        }

        if (triggered) {
          updated = true;
          // Trigger audio chime & mobile haptic vibration
          playAlertChime();
          triggerVibration();

          // Show in-app toast
          setActiveToast({
            alert: alt,
            price: currentPrice,
            timestamp: Date.now(),
          });

          // Show system web notification if supported & permitted
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`🔔 تنبيه سعري (${alt.symbol}): ${alt.label}`, {
                body: `وصل السعر إلى المستوى المستهدف ${target.toFixed(2)} USD (السعر الحالي: ${currentPrice.toFixed(2)}).`,
                icon: '/icon.svg',
              });
            } catch (err) {
              console.warn('Desktop notification error:', err);
            }
          }

          return {
            ...alt,
            isActive: false,
            triggeredAt: Date.now(),
          };
        }

        return alt;
      });

      return updated ? nextAlerts : prevAlerts;
    });
  }, [currentPrice, symbol]);

  const addAlert = useCallback((newAlert: Omit<PriceAlert, 'id' | 'createdAt' | 'isActive'>) => {
    const alert: PriceAlert = {
      ...newAlert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
      isActive: true,
    };
    setAlerts((prev) => [alert, ...prev]);
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  const addSingleLevelAlert = useCallback((
    targetPrice: number,
    levelType: PriceAlert['levelType'],
    label: string,
    targetSymbol: MarketSymbol = symbol
  ) => {
    // Determine condition intelligently relative to current price
    let condition: PriceAlert['condition'] = 'touch';
    if (levelType === 'support') {
      condition = currentPrice > targetPrice ? 'cross_below' : 'touch';
    } else if (levelType === 'resistance') {
      condition = currentPrice < targetPrice ? 'cross_above' : 'touch';
    } else if (levelType === 'stop_loss') {
      condition = currentPrice > targetPrice ? 'cross_below' : 'cross_above';
    } else if (levelType === 'target') {
      condition = currentPrice < targetPrice ? 'cross_above' : 'cross_below';
    }

    const alert: PriceAlert = {
      id: `alert_${levelType}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: targetSymbol,
      targetPrice,
      condition,
      levelType,
      label,
      isActive: true,
      createdAt: Date.now(),
    };

    setAlerts((prev) => {
      // If already exists with same price & symbol, toggle it active
      const existing = prev.find((a) => a.symbol === targetSymbol && Math.abs(a.targetPrice - targetPrice) < 0.001);
      if (existing) {
        return prev.map((a) => (a.id === existing.id ? { ...a, isActive: true, triggeredAt: undefined } : a));
      }
      return [alert, ...prev];
    });

    requestNotificationPermission();
  }, [currentPrice, symbol, requestNotificationPermission]);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggleAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive, triggeredAt: undefined } : a))
    );
  }, []);

  const clearTriggeredAlerts = useCallback(() => {
    setAlerts((prev) => prev.filter((a) => a.isActive));
  }, []);

  /**
   * One-click automated setup: creates alerts for all identified S/R levels, SL, and TP
   */
  const importReportLevels = useCallback((report: TechnicalReport): number => {
    const newAlerts: PriceAlert[] = [];
    const sym = report.symbol;

    // Supports
    report.schools.classical.supports.slice(0, 3).forEach((sup, idx) => {
      newAlerts.push({
        id: `alert_sup_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        symbol: sym,
        targetPrice: sup,
        condition: 'cross_below',
        levelType: 'support',
        label: `مستوى دعم رئيسي (${sup.toFixed(2)})`,
        isActive: true,
        createdAt: Date.now(),
      });
    });

    // Resistances
    report.schools.classical.resistances.slice(0, 3).forEach((res, idx) => {
      newAlerts.push({
        id: `alert_res_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        symbol: sym,
        targetPrice: res,
        condition: 'cross_above',
        levelType: 'resistance',
        label: `مستوى مقاومة رئيسي (${res.toFixed(2)})`,
        isActive: true,
        createdAt: Date.now(),
      });
    });

    // Trade Setup SL & Targets if present
    if (report.tradeSetup.hasSetup) {
      if (report.tradeSetup.stopLoss > 0) {
        newAlerts.push({
          id: `alert_sl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          symbol: sym,
          targetPrice: report.tradeSetup.stopLoss,
          condition: report.tradeSetup.bias === 'شراء' ? 'cross_below' : 'cross_above',
          levelType: 'stop_loss',
          label: `وقف خسارة الصفقة (${report.tradeSetup.stopLoss.toFixed(2)})`,
          isActive: true,
          createdAt: Date.now(),
        });
      }

      report.tradeSetup.targets.slice(0, 3).forEach((tp, idx) => {
        newAlerts.push({
          id: `alert_tp_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          symbol: sym,
          targetPrice: tp,
          condition: report.tradeSetup.bias === 'شراء' ? 'cross_above' : 'cross_below',
          levelType: 'target',
          label: `هدف الصفقة TP${idx + 1} (${tp.toFixed(2)})`,
          isActive: true,
          createdAt: Date.now(),
        });
      });
    }

    let addedCount = 0;
    setAlerts((prev) => {
      const existingPrices = new Set(prev.filter((p) => p.symbol === sym).map((p) => p.targetPrice));
      const filtered = newAlerts.filter((a) => !existingPrices.has(a.targetPrice));
      addedCount = filtered.length;
      return [...filtered, ...prev];
    });

    requestNotificationPermission();
    return newAlerts.length;
  }, [requestNotificationPermission]);

  return {
    alerts,
    activeToast,
    dismissToast: () => setActiveToast(null),
    addAlert,
    addSingleLevelAlert,
    removeAlert,
    toggleAlert,
    clearTriggeredAlerts,
    importReportLevels,
    playTestSound: playAlertChime,
    notificationPermission,
    requestNotificationPermission,
  };
}
