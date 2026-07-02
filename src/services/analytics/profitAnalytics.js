import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { computeDashboardMetrics } from '@/lib/helpers';

/**
 * Fetches and processes data required for P&L calculations.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<{sales: Array, purchases: Array, expenses: Array}>} Raw data.
 */
async function fetchPnlData(ownerFilter, fromDate, toDate, branchKey = 'all') {
  const [allSales, allPurchases, allExpenses] = await Promise.all([
    base44.entities.DailySales.filter(ownerFilter || {}, '-date', 1000),
    supabase
      .from('supplier_invoices')
      .select('*')
      .eq('created_by', ownerFilter?.created_by)
      .in('approval_status', ['approved', 'auto_approved'])
      .order('date', { ascending: false })
      .limit(1000)
      .then(({ data }) => data || []),
    base44.entities.Expense.filter(ownerFilter || {}, '-date', 1000),
  ]);

  let filteredSales = allSales.filter(s => s.date >= fromDate && s.date <= toDate);
  let filteredPurchases = allPurchases.filter(p => p.date >= fromDate && p.date <= toDate);
  let filteredExpenses = allExpenses.filter(e => e.date >= fromDate && e.date <= toDate);

  if (branchKey !== 'all') {
    filteredSales = filteredSales.filter(s => s.branch === branchKey);
    filteredPurchases = filteredPurchases.filter(p => p.branch === branchKey);
    filteredExpenses = filteredExpenses.filter(e => e.branch === branchKey || e.branch === 'all');
  }

  return { sales: filteredSales, purchases: filteredPurchases, expenses: filteredExpenses };
}

/**
 * Calculates P&L metrics for a given period and branch.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<object>} P&L metrics.
 */
export async function getProfitAndLoss(ownerFilter, fromDate, toDate, branchKey = 'all') {
  const { sales, purchases, expenses } = await fetchPnlData(ownerFilter, fromDate, toDate, branchKey);

  const metrics = computeDashboardMetrics(sales, purchases, expenses);

  return {
    revenue: metrics.totalSales,
    cogs: metrics.totalPurchaseCost,
    grossProfit: metrics.profit,
    operatingExpenses: metrics.totalExpenses,
    netProfit: metrics.netProfit,
    profitMargin: metrics.margin,
    netProfitMargin: metrics.netMargin,
  };
}

/**
 * Calculates P&L metrics for today.
 */
export async function getProfitAndLossToday(ownerFilter, branchKey = 'all') {
  const today = new Date().toISOString().split('T')[0];
  return getProfitAndLoss(ownerFilter, today, today, branchKey);
}

/**
 * Calculates P&L metrics for the current week.
 */
export async function getProfitAndLossThisWeek(ownerFilter, branchKey = 'all') {
  const today = new Date();
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toISOString().split('T')[0];
  const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6)).toISOString().split('T')[0];
  return getProfitAndLoss(ownerFilter, startOfWeek, endOfWeek, branchKey);
}

/**
 * Calculates P&L metrics for the current month.
 */
export async function getProfitAndLossThisMonth(ownerFilter, branchKey = 'all') {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  return getProfitAndLoss(ownerFilter, startOfMonth, endOfMonth, branchKey);
}

/**
 * Calculates P&L metrics for the current quarter.
 */
export async function getProfitAndLossThisQuarter(ownerFilter, branchKey = 'all') {
  const today = new Date();
  const quarter = Math.floor((today.getMonth() / 3));
  const startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
  const endOfQuarter = new Date(today.getFullYear(), quarter * 3 + 3, 0).toISOString().split('T')[0];
  return getProfitAndLoss(ownerFilter, startOfQuarter, endOfQuarter, branchKey);
}

/**
 * Calculates P&L metrics for the current year.
 */
export async function getProfitAndLossThisYear(ownerFilter, branchKey = 'all') {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
  const endOfYear = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];
  return getProfitAndLoss(ownerFilter, startOfYear, endOfYear, branchKey);
}
