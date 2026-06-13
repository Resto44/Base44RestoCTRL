import { base44 } from '@/api/base44Client';
import { getProfitAndLoss } from './profitAnalytics';
import { predictLowStock } from './inventoryAnalytics';
import { calculateOutstandingPayables } from './supplierAnalytics';
import { calculateOutstandingReceivables } from './receivableAnalytics';

/**
 * Defines alert severity levels.
 */
export const ALERT_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
};

/**
 * Fetches data for alert generation.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<object>} Raw data for alerts.
 */
async function fetchAlertData(ownerFilter, branchKey = 'all') {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];

  const [dailySales, expenses, inventory, supplierInvoices, debtRecords, purchases] = await Promise.all([
    base44.entities.DailySales.filter(ownerFilter || {}, '-date', 1000),
    base44.entities.Expense.filter(ownerFilter || {}, '-date', 1000),
    base44.entities.Inventory.filter(ownerFilter || {}, 'product_name', 500),
    base44.entities.SupplierInvoice.filter(ownerFilter || {}, '-date', 1000),
    base44.entities.DebtRecord.filter(ownerFilter || {}, '-date', 1000),
    base44.entities.Purchase.filter(ownerFilter || {}, '-date', 1000),
  ]);

  const filteredDailySales = branchKey === 'all' ? dailySales : dailySales.filter(s => s.branch === branchKey);
  const filteredExpenses = branchKey === 'all' ? expenses : expenses.filter(e => e.branch === branchKey || e.branch === 'all');
  const filteredInventory = branchKey === 'all' ? inventory : inventory.filter(item => item.branch === branchKey);
  const filteredSupplierInvoices = branchKey === 'all' ? supplierInvoices : supplierInvoices.filter(inv => inv.branch === branchKey);
  const filteredDebtRecords = branchKey === 'all' ? debtRecords : debtRecords.filter(d => d.branch === branchKey);
  const filteredPurchases = branchKey === 'all' ? purchases : purchases.filter(p => p.branch === branchKey);

  return {
    dailySales: filteredDailySales,
    expenses: filteredExpenses,
    inventory: filteredInventory,
    supplierInvoices: filteredSupplierInvoices,
    debtRecords: filteredDebtRecords,
    purchases: filteredPurchases,
    today,
    thirtyDaysAgo,
  };
}

/**
 * Generates real-time operational alerts.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<Array>} List of generated alerts.
 */
export async function generateOperationalAlerts(ownerFilter, branchKey = 'all') {
  const { dailySales, expenses, inventory, supplierInvoices, debtRecords, purchases, today, thirtyDaysAgo } = await fetchAlertData(ownerFilter, branchKey);
  const alerts = [];

  // 1. Low Inventory Alerts
  const lowStockPredictions = predictLowStock(inventory, purchases, 7); // Predict for next 7 days
  lowStockPredictions.forEach(prediction => {
    if (prediction.severity === 'critical' || prediction.severity === 'warning') {
      alerts.push({
        type: 'inventory',
        severity: prediction.severity === 'critical' ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.HIGH,
        message: `Low stock for ${prediction.product_name} in ${prediction.branch}: ${prediction.currentStock} ${prediction.unit} left, will last ${prediction.daysLeft} days.`,
        details: prediction,
      });
    }
  });

  // 2. Overdue Supplier Invoices
  const outstandingPayables = supplierInvoices.filter(inv => inv.status === 'unpaid' && new Date(inv.date) < new Date(today));
  outstandingPayables.forEach(inv => {
    alerts.push({
      type: 'supplier_invoice',
      severity: ALERT_SEVERITY.CRITICAL,
      message: `Overdue supplier invoice from ${inv.supplier_name} for ${inv.amount} on ${inv.date}.`,
      details: inv,
    });
  });

  // 3. Negative Profit Trend (compared to previous period, e.g., last 7 days vs prior 7 days)
  const currentProfitData = await getProfitAndLoss(ownerFilter, thirtyDaysAgo, today, branchKey);
  const prevPeriodStart = new Date(new Date().setDate(new Date().getDate() - 60)).toISOString().split('T')[0];
  const prevPeriodEnd = thirtyDaysAgo;
  const previousProfitData = await getProfitAndLoss(ownerFilter, prevPeriodStart, prevPeriodEnd, branchKey);

  if (currentProfitData.netProfit < 0 && previousProfitData.netProfit > 0) {
    alerts.push({
      type: 'profit_trend',
      severity: ALERT_SEVERITY.CRITICAL,
      message: `Negative profit trend detected: Current period net profit is ${currentProfitData.netProfit.toFixed(2)}, previous period was ${previousProfitData.netProfit.toFixed(2)}.`,
      details: { currentProfit: currentProfitData.netProfit, previousProfit: previousProfitData.netProfit },
    });
  } else if (currentProfitData.netProfit < previousProfitData.netProfit * 0.8 && previousProfitData.netProfit > 0) {
    alerts.push({
      type: 'profit_trend',
      severity: ALERT_SEVERITY.HIGH,
      message: `Significant profit drop: Current period net profit is ${currentProfitData.netProfit.toFixed(2)}, a ${((1 - currentProfitData.netProfit / previousProfitData.netProfit) * 100).toFixed(2)}% decrease.`,
      details: { currentProfit: currentProfitData.netProfit, previousProfit: previousProfitData.netProfit },
    });
  }

  // 4. High Expense Anomaly (compared to average of last 30 days)
  const currentExpenses = expenses.filter(e => e.date === today).reduce((sum, e) => sum + (e.amount || 0), 0);
  const last30DaysExpenses = expenses.filter(e => e.date >= thirtyDaysAgo && e.date < today).reduce((sum, e) => sum + (e.amount || 0), 0);
  const averageDailyExpenses = last30DaysExpenses / 30;

  if (currentExpenses > averageDailyExpenses * 1.5 && averageDailyExpenses > 0) { // 50% higher than average
    alerts.push({
      type: 'expense_anomaly',
      severity: ALERT_SEVERITY.HIGH,
      message: `High expense anomaly detected today: ${currentExpenses.toFixed(2)}, significantly higher than 30-day average of ${averageDailyExpenses.toFixed(2)}.`,
      details: { currentExpenses, averageDailyExpenses },
    });
  }

  // 5. Outstanding Customer Debt
  const outstandingReceivables = calculateOutstandingReceivables(debtRecords.filter(d => d.status === 'open'));
  if (outstandingReceivables > 5000) { // Example threshold
    alerts.push({
      type: 'customer_debt',
      severity: ALERT_SEVERITY.MEDIUM,
      message: `Total outstanding customer receivables: ${outstandingReceivables.toFixed(2)}. Review collections.`,
      details: { outstandingReceivables },
    });
  }

  // 6. Unusual Sales Drop (compared to average of last 7 days)
  const currentSales = dailySales.filter(s => s.date === today).reduce((sum, s) => sum + (s.cash || 0) + (s.network || 0) + (s.credit || 0), 0);
  const last7DaysSales = dailySales.filter(s => s.date >= new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0] && s.date < today).reduce((sum, s) => sum + (s.cash || 0) + (s.network || 0) + (s.credit || 0), 0);
  const averageDailySales = last7DaysSales / 7;

  if (currentSales < averageDailySales * 0.7 && averageDailySales > 0) { // 30% lower than average
    alerts.push({
      type: 'sales_drop',
      severity: ALERT_SEVERITY.HIGH,
      message: `Unusual sales drop today: ${currentSales.toFixed(2)}, significantly lower than 7-day average of ${averageDailySales.toFixed(2)}.`,
      details: { currentSales, averageDailySales },
    });
  }

  // Store alerts in the database (assuming an 'alerts' table exists or will be created)
  // This part would typically involve calling a Supabase function or entity.create for the 'alerts' table.
  // For now, we'll just return the alerts.
  // Example: await base44.entities.Alert.bulkCreate(alerts.map(alert => ({ ...alert, created_by: ownerFilter.created_by })));

  return alerts;
}
