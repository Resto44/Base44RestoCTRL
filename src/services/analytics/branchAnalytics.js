/**
 * branchAnalytics.js — Compatibility shim.
 * Provides getBranchPerformanceRankings used by EnhancedBranchRankings.
 */

import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';

// ── getBranchPerformanceRankings ──────────────────────────────────────────────
export async function getBranchPerformanceRankings(ownerFilter, branches = [], fromStr, toStr) {
  try {
    const [sales, expenses] = await Promise.all([
      base44.entities.DailySales.filter(ownerFilter || {}, '-date', 2000),
      base44.entities.Expense.filter(ownerFilter || {}, '-date', 2000),
    ]);

    let purchases = [];
    if (ownerFilter?.created_by) {
      const { data } = await supabase
        .from('supplier_invoices')
        .select('total_amount, date, branch')
        .eq('created_by', ownerFilter.created_by)
        .in('approval_status', ['approved', 'auto_approved'])
        .gte('date', fromStr)
        .lte('date', toStr);
      purchases = data || [];
    }

    const filteredSales = sales.filter(s => s.date >= fromStr && s.date <= toStr);
    const filteredExpenses = expenses.filter(e => e.date >= fromStr && e.date <= toStr);
    const filteredPurchases = purchases;

    const rankings = branches.map(b => {
      const bSales = filteredSales.filter(s => s.branch === b.key);
      const bExpenses = filteredExpenses.filter(e => e.branch === b.key || e.branch === 'all');
      const bPurchases = filteredPurchases.filter(p => p.branch === b.key);

      const revenue = bSales.reduce((s, x) => s + (x.cash || 0) + (x.network || 0) + (x.credit || 0), 0);
      const purchaseCost = bPurchases.reduce((s, x) => s + (x.total_amount || 0), 0);
      const expenseCost = bExpenses.reduce((s, x) => s + (x.amount || 0), 0);
      const netProfit = revenue - purchaseCost - expenseCost;
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
      const creditSales = bSales.reduce((s, x) => s + (x.credit || 0), 0);
      const creditRatio = revenue > 0 ? (creditSales / revenue) * 100 : 0;

      return {
        key: b.key,
        label: b.label,
        revenue,
        purchaseCost,
        expenseCost,
        netProfit,
        profitMargin,
        creditRatio,
        transactionCount: bSales.length,
        avgTransactionValue: bSales.length > 0 ? revenue / bSales.length : 0,
      };
    });

    return rankings.sort((a, b) => b.revenue - a.revenue);
  } catch {
    return [];
  }
}
