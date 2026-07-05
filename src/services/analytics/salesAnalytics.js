/**
 * salesAnalytics.js — Compatibility shim.
 * Re-exports helpers from salesAnalyticsEngine so existing dashboard
 * components continue to compile without modification.
 */

import { base44 } from '@/api/base44Client';
import { formatDate, getDateRange } from '@/lib/helpers';

// ── calculateTotalSales ────────────────────────────────────────────────────────
export function calculateTotalSales(sales = []) {
  return sales.reduce((sum, s) => sum + (s.cash || 0) + (s.network || 0) + (s.credit || 0), 0);
}

// ── calculateSalesTrend ────────────────────────────────────────────────────────
export function calculateSalesTrend(currentSales = [], previousSales = []) {
  const current = calculateTotalSales(currentSales);
  const previous = calculateTotalSales(previousSales);
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// ── calculateDailySalesTrend ───────────────────────────────────────────────────
export function calculateDailySalesTrend(sales = []) {
  const map = {};
  for (const s of sales) {
    const date = s.date || '';
    if (!map[date]) map[date] = { date, totalSales: 0, cash: 0, network: 0, credit: 0 };
    map[date].totalSales += (s.cash || 0) + (s.network || 0) + (s.credit || 0);
    map[date].cash += s.cash || 0;
    map[date].network += s.network || 0;
    map[date].credit += s.credit || 0;
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}
