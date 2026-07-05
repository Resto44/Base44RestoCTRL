import { subDays, subWeeks, subMonths, subYears, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';

export function formatDate(d) {
  if (!d) return '';
  return format(d, 'yyyy-MM-dd');
}

export function getDateRange(type) {
  const today = new Date();
  switch (type) {
    case 'week':
      return { from: startOfWeek(today, { weekStartsOn: 6 }), to: endOfWeek(today, { weekStartsOn: 6 }) };
    case 'month':
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case 'year':
      return { from: startOfYear(today), to: endOfYear(today) };
    default:
      return { from: startOfMonth(today), to: endOfMonth(today) };
  }
}

export function getPreviousDateRange(type, customFrom, customTo) {
  const current = getDateRange(type);
  const diffMs = current.to - current.from;
  return {
    from: new Date(current.from - diffMs - 86400000),
    to: new Date(current.from - 86400000),
  };
}

// Normalised field accessors — prefer restaurant_ fields (new schema),
// fall back to legacy cash / network for older records.
export const getSaleCash    = r => Number(r.restaurant_cash    ?? r.cash    ?? 0);
export const getSaleNetwork = r => Number(r.restaurant_network ?? r.network ?? 0);

/**
 * computeDashboardMetrics
 *
 * rangeType: 'day' | 'week' | 'month' | 'year'
 *
 * Fixed-expense deduction rule (Phase 3):
 *  - 'day' or 'week' → fixed expenses are NOT deducted (they are monthly overhead).
 *    Net Profit = Gross Profit (Revenue − COGS) only.
 *  - 'month' | 'year' | undefined → fixed expenses ARE deducted.
 *
 * Variable expenses (non-fixed) are always deducted regardless of range.
 * An expense is considered fixed when its category has is_fixed = true.
 * If category info is not available, fall back to deducting all expenses.
 */
export function computeDashboardMetrics(sales, purchases, expenses = [], rangeType = 'month', revenueSources = []) {
  let totalSales = 0;
  let totalCash = 0;
  let totalNetwork = 0;
  let totalCredit = 0;
  let totalCustomSources = 0;

  sales.forEach(r => {
    const revenue = calculateSalesRevenue(r, revenueSources);
    totalSales += revenue.total;
    totalCash += revenue.cash;
    totalNetwork += revenue.network;
    totalCredit += revenue.credit;
    totalCustomSources += revenue.customSources;
  });
  const totalPurchaseCost = purchases.reduce((s, r) => s + (Number(r.total_amount) || (r.qty || 0) * (r.used_price || r.current_price || 0)), 0);
  const totalAdditionalSources = totalCustomSources;

  // Separate fixed vs variable expenses
  const isShortRange = rangeType === 'day' || rangeType === 'week';
  const variableExpenses = expenses.filter(e => !e._is_fixed);
  const fixedExpenses    = expenses.filter(e => !!e._is_fixed);

  const totalVariableExpenses = variableExpenses.reduce((s, r) => s + (r.amount || 0), 0);
  const totalFixedExpenses    = fixedExpenses.reduce((s, r) => s + (r.amount || 0), 0);

  // On short ranges (day/week), exclude fixed expenses from net profit
  const totalExpenses = isShortRange
    ? totalVariableExpenses
    : totalVariableExpenses + totalFixedExpenses;

  // Always report the full expense total for display purposes
  const totalExpensesAll = totalVariableExpenses + totalFixedExpenses;

  const grossProfit = totalSales - totalPurchaseCost;
  const netProfit = totalSales - totalPurchaseCost - totalExpenses;
  const margin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
  const netMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
  const creditPct = totalSales > 0 ? (totalCredit / totalSales) * 100 : 0;

  return {
    totalSales,
    totalCredit,
    totalCash,
    totalNetwork,
    totalAdditionalSources,  // custom sources from sales_sources_json
    totalPurchaseCost,
    totalExpenses,           // expenses actually deducted from net profit
    totalExpensesAll,        // all expenses (for display)
    totalFixedExpenses,
    totalVariableExpenses,
    fixedExpensesExcluded: isShortRange && totalFixedExpenses > 0,
    profit: grossProfit,
    netProfit,
    margin,
    netMargin,
    creditPct,
  };
}

export function computeBranchMetrics(sales, purchases, expenses, branchKey) {
  const bs = sales.filter(s => s.branch === branchKey);
  const bp = purchases.filter(p => p.branch === branchKey);
  const be = expenses.filter(e => e.branch === branchKey || e.branch === 'all');
  return computeDashboardMetrics(bs, bp, be);
}

export function formatCurrency(val, currency = '$') {
  if (val === undefined || val === null) return `${currency}0`;
  return `${currency}${Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatPct(val) {
  if (val === undefined || val === null) return '0%';
  return `${Number(val).toFixed(1)}%`;
}

/**
 * calculateSalesRevenue
 *
 * Calculates total revenue from a single sales record, respecting SalesSource configuration.
 * Parses sales_sources_json and applies included_in_revenue flags.
 *
 * @param {Object} record - Sales record with restaurant_cash, restaurant_network, credit, sales_sources_json
 * @param {Array} revenueSources - Array of SalesSource objects with included_in_revenue flags
 * @returns {Object} { cash, network, credit, customSources, total }
 */
export function calculateSalesRevenue(record, revenueSources = []) {
  const cash = getSaleCash(record);
  const network = getSaleNetwork(record);
  const credit = Number(record.credit) || 0;

  // Check if base sources should be included in revenue
  const cashIncluded = !revenueSources.length || revenueSources.find(s => s.system_key === 'cash')?.included_in_revenue !== false;
  const networkIncluded = !revenueSources.length || revenueSources.find(s => s.system_key === 'network')?.included_in_revenue !== false;
  const creditIncluded = !revenueSources.length || revenueSources.find(s => s.system_key === 'credit')?.included_in_revenue !== false;

  const baseSales = (cashIncluded ? cash : 0) + (networkIncluded ? network : 0) + (creditIncluded ? credit : 0);

  // Parse custom sources from sales_sources_json
  let customSources = 0;
  if (record.sales_sources_json) {
    try {
      const entries = JSON.parse(record.sales_sources_json);
      entries.forEach(e => {
        const sourceId = e.source_id || e.source_key;
        const sourceConfig = revenueSources.find(s => s.id === sourceId || s.source_key === sourceId);
        // Include if no config found (default) or if explicitly included
        if (!sourceConfig || sourceConfig.included_in_revenue !== false) {
          customSources += Number(e.amount) || 0;
        }
      });
    } catch (err) {
      console.warn('Failed to parse sales_sources_json:', err);
    }
  }

  const total = baseSales + customSources;

  return {
    cash: cashIncluded ? cash : 0,
    network: networkIncluded ? network : 0,
    credit: creditIncluded ? credit : 0,
    customSources,
    total,
    // Raw values for reference
    rawCash: cash,
    rawNetwork: network,
    rawCredit: credit,
  };
}

export function buildDailyProfitTrend(sales, purchases, revenueSources = []) {
  const map = {};
  sales.forEach(s => {
    if (!map[s.date]) map[s.date] = { sales: 0, cost: 0 };
    const revenue = calculateSalesRevenue(s, revenueSources);
    map[s.date].sales += revenue.total;
  });
  purchases.forEach(p => {
    if (!map[p.date]) map[p.date] = { sales: 0, cost: 0 };
    map[p.date].cost += (p.qty || 0) * (p.used_price || p.current_price || 0);
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, profit: v.sales - v.cost, sales: v.sales, cost: v.cost }));
}
