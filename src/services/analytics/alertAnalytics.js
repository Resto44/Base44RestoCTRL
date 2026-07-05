/**
 * alertAnalytics.js — Compatibility shim.
 * Provides generateOperationalAlerts and ALERT_SEVERITY used by OperationalAlerts.
 */

import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { formatDate, getDateRange } from '@/lib/helpers';

export const ALERT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
};

export async function generateOperationalAlerts(ownerFilter, branches = []) {
  const alerts = [];
  try {
    const dr = getDateRange('month');
    const fromStr = formatDate(dr.from);
    const toStr = formatDate(dr.to);

    const [sales, expenses, inventory] = await Promise.all([
      base44.entities.DailySales.filter(ownerFilter || {}, '-date', 500),
      base44.entities.Expense.filter(ownerFilter || {}, '-date', 500),
      base44.entities.Inventory.list('-date', 500),
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

    const filteredSales = sales.filter(s => s.date >= fromStr && s.date <= toStr);
    const revenue = filteredSales.reduce((s, x) => s + (x.cash || 0) + (x.network || 0) + (x.credit || 0), 0);
    const creditSales = filteredSales.reduce((s, x) => s + (x.credit || 0), 0);
    const purchaseCost = purchases.reduce((s, x) => s + (x.total_amount || 0), 0);
    const expenseCost = expenses.filter(e => e.date >= fromStr && e.date <= toStr).reduce((s, x) => s + (x.amount || 0), 0);
    const netProfit = revenue - purchaseCost - expenseCost;

    // Credit ratio alert
    if (revenue > 0 && (creditSales / revenue) > 0.3) {
      alerts.push({
        id: 'high_credit',
        severity: ALERT_SEVERITY.WARNING,
        title: 'High Credit Sales',
        message: `Credit sales are ${((creditSales / revenue) * 100).toFixed(1)}% of revenue`,
        value: creditSales,
        threshold: revenue * 0.3,
      });
    }

    // Profit alert
    if (netProfit < 0) {
      alerts.push({
        id: 'negative_profit',
        severity: ALERT_SEVERITY.CRITICAL,
        title: 'Negative Profit',
        message: `Net profit is negative this month`,
        value: netProfit,
        threshold: 0,
      });
    }

    // Food cost alert
    if (revenue > 0 && (purchaseCost / revenue) > 0.4) {
      alerts.push({
        id: 'high_food_cost',
        severity: ALERT_SEVERITY.WARNING,
        title: 'High Food Cost',
        message: `Purchase cost is ${((purchaseCost / revenue) * 100).toFixed(1)}% of revenue`,
        value: purchaseCost,
        threshold: revenue * 0.4,
      });
    }

    // Low stock alerts
    const lowStockItems = inventory.filter(i => (i.current_stock || 0) <= (i.low_stock_threshold || 0));
    if (lowStockItems.length > 0) {
      alerts.push({
        id: 'low_stock',
        severity: ALERT_SEVERITY.WARNING,
        title: 'Low Stock',
        message: `${lowStockItems.length} items below reorder level`,
        value: lowStockItems.length,
        threshold: 0,
        items: lowStockItems.map(i => i.product_name || i.name || ''),
      });
    }
  } catch (e) {
    // silently return empty on error
  }
  return alerts;
}
