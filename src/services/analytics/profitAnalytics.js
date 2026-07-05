/**
 * profitAnalytics.js — Compatibility shim.
 * Provides getProfitAndLoss functions used by AdvancedKPICards and ExecutivePnL.
 * All computations are done inline from raw Supabase/base44 data.
 */

import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { formatDate, getDateRange } from '@/lib/helpers';

// ── Core P&L builder ──────────────────────────────────────────────────────────
async function buildPnL(ownerFilter, fromStr, toStr, branchKey = 'all') {
  try {
    const [sales, expenses] = await Promise.all([
      base44.entities.DailySales.filter(ownerFilter || {}, '-date', 2000),
      base44.entities.Expense.filter(ownerFilter || {}, '-date', 2000),
    ]);

    let purchases = [];
    if (ownerFilter?.created_by) {
      const { data } = await supabase
        .from('supplier_invoices')
        .select('total_amount, date')
        .eq('created_by', ownerFilter.created_by)
        .in('approval_status', ['approved', 'auto_approved'])
        .gte('date', fromStr)
        .lte('date', toStr);
      purchases = data || [];
    }

    const filteredSales = sales.filter(s =>
      s.date >= fromStr && s.date <= toStr &&
      (branchKey === 'all' || s.branch === branchKey)
    );
    const filteredExpenses = expenses.filter(e =>
      e.date >= fromStr && e.date <= toStr &&
      (branchKey === 'all' || e.branch === branchKey || e.branch === 'all')
    );

    const revenue = filteredSales.reduce((s, x) => s + (x.cash || 0) + (x.network || 0) + (x.credit || 0), 0);
    const cogs = purchases.reduce((s, x) => s + (x.total_amount || 0), 0);
    const operatingExpenses = filteredExpenses.reduce((s, x) => s + (x.amount || 0), 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - operatingExpenses;
    const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return { revenue, cogs, grossProfit, operatingExpenses, netProfit, profitMargin, netProfitMargin };
  } catch {
    return { revenue: 0, cogs: 0, grossProfit: 0, operatingExpenses: 0, netProfit: 0, profitMargin: 0, netProfitMargin: 0 };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function getProfitAndLoss(ownerFilter, fromStr, toStr, branchKey = 'all') {
  return buildPnL(ownerFilter, fromStr, toStr, branchKey);
}

export function getProfitAndLossToday(ownerFilter, branchKey = 'all') {
  const today = formatDate(new Date());
  return buildPnL(ownerFilter, today, today, branchKey);
}

export function getProfitAndLossThisWeek(ownerFilter, branchKey = 'all') {
  const dr = getDateRange('week');
  return buildPnL(ownerFilter, formatDate(dr.from), formatDate(dr.to), branchKey);
}

export function getProfitAndLossThisMonth(ownerFilter, branchKey = 'all') {
  const dr = getDateRange('month');
  return buildPnL(ownerFilter, formatDate(dr.from), formatDate(dr.to), branchKey);
}

export function getProfitAndLossThisQuarter(ownerFilter, branchKey = 'all') {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const from = new Date(now.getFullYear(), q * 3, 1);
  const to = new Date(now.getFullYear(), q * 3 + 3, 0);
  return buildPnL(ownerFilter, formatDate(from), formatDate(to), branchKey);
}

export function getProfitAndLossThisYear(ownerFilter, branchKey = 'all') {
  const year = new Date().getFullYear();
  return buildPnL(ownerFilter, `${year}-01-01`, `${year}-12-31`, branchKey);
}
