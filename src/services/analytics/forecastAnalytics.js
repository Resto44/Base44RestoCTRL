/**
 * forecastAnalytics.js — Compatibility shim.
 * Provides getRevenueForecast and getCashFlowForecast used by CashFlowAnalytics.
 */

import { base44 } from '@/api/base44Client';
import { formatDate, getDateRange } from '@/lib/helpers';

// ── getRevenueForecast ────────────────────────────────────────────────────────
export async function getRevenueForecast(ownerFilter, branchKey = 'all', days = 7) {
  try {
    const dr = getDateRange('month');
    const sales = await base44.entities.DailySales.filter(ownerFilter || {}, '-date', 500);
    const filtered = sales.filter(s =>
      s.date >= formatDate(dr.from) && s.date <= formatDate(dr.to) &&
      (branchKey === 'all' || s.branch === branchKey)
    );
    const total = filtered.reduce((s, x) => s + (x.cash || 0) + (x.network || 0) + (x.credit || 0), 0);
    const avgDaily = filtered.length > 0 ? total / filtered.length : 0;

    const forecast = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i + 1);
      return { date: formatDate(d), expected: avgDaily, optimistic: avgDaily * 1.1, pessimistic: avgDaily * 0.9 };
    });
    return { forecast, avgDaily, confidence: 0.75 };
  } catch {
    return { forecast: [], avgDaily: 0, confidence: 0 };
  }
}

// ── getCashFlowForecast ───────────────────────────────────────────────────────
export async function getCashFlowForecast(ownerFilter, branchKey = 'all', days = 7) {
  try {
    const { forecast, avgDaily } = await getRevenueForecast(ownerFilter, branchKey, days);
    return {
      expectedCase: forecast.map(d => ({ date: d.date, value: d.expected })),
      optimisticCase: forecast.map(d => ({ date: d.date, value: d.optimistic })),
      pessimisticCase: forecast.map(d => ({ date: d.date, value: d.pessimistic })),
      avgDaily,
    };
  } catch {
    return { expectedCase: [], optimisticCase: [], pessimisticCase: [], avgDaily: 0 };
  }
}
