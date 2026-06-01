/**
 * Smart Analytics Engine
 * Generates AI-like insights from raw data without external API calls.
 */
import { computeDashboardMetrics, computeBranchMetrics } from './helpers';

/**
 * Detect branches with declining profit and explain why.
 */
export function analyzeBranchPerformance(branches, sales, purchases, expenses, waste, prevSales, prevPurchases) {
  return branches.map(branch => {
    const key = branch.key;
    const cur = computeBranchMetrics(sales, purchases, expenses, key);
    const prev = computeBranchMetrics(prevSales, prevPurchases, [], key);
    const branchWaste = waste.filter(w => w.branch === key).reduce((s, w) => s + (w.total_loss || 0), 0);
    const branchSales = sales.filter(s => s.branch === key);
    const creditPct = cur.creditPct;

    const issues = [];
    const profitChange = prev.profit > 0 ? ((cur.profit - prev.profit) / prev.profit) * 100 : 0;

    if (profitChange < -15) issues.push({ type: 'profit_drop', label: 'Profit dropped', detail: `${Math.abs(profitChange).toFixed(0)}% vs last period`, severity: 'critical' });
    if (cur.totalExpenses > cur.totalSales * 0.35) issues.push({ type: 'high_expenses', label: 'High expenses', detail: `Expenses = ${((cur.totalExpenses / (cur.totalSales || 1)) * 100).toFixed(0)}% of sales`, severity: 'warning' });
    if (creditPct > 40) issues.push({ type: 'high_credit', label: 'High credit risk', detail: `${creditPct.toFixed(0)}% sales on credit`, severity: 'critical' });
    if (cur.totalSales < prev.totalSales * 0.8 && prev.totalSales > 0) issues.push({ type: 'low_sales', label: 'Low sales', detail: `Sales down ${((1 - cur.totalSales / prev.totalSales) * 100).toFixed(0)}%`, severity: 'warning' });
    if (branchWaste > cur.totalSales * 0.05) issues.push({ type: 'high_waste', label: 'High waste', detail: `Waste = ${((branchWaste / (cur.totalSales || 1)) * 100).toFixed(0)}% of sales`, severity: 'warning' });

    const score = computeScore(cur, prev, branchWaste, creditPct);

    return {
      key,
      label: branch.label,
      metrics: cur,
      prevMetrics: prev,
      issues,
      profitChange,
      wasteTotal: branchWaste,
      score,
    };
  }).sort((a, b) => b.score - a.score);
}

function computeScore(cur, prev, waste, creditPct) {
  let score = 100;
  if (cur.profit < 0) score -= 30;
  else if (prev.profit > 0) score += Math.max(-20, Math.min(20, ((cur.profit - prev.profit) / (prev.profit || 1)) * 20));
  if (creditPct > 40) score -= 20;
  else if (creditPct > 25) score -= 10;
  if (cur.totalExpenses > cur.totalSales * 0.4) score -= 15;
  if (waste > cur.totalSales * 0.05) score -= 10;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Predict low-stock products based on recent consumption.
 */
export function predictLowStock(inventory, purchases, daysToPredict = 14) {
  const predictions = [];
  const now = new Date();
  const cutoff = new Date(now - 30 * 86400000);

  inventory.forEach(inv => {
    const recentPurchases = purchases.filter(p =>
      p.product_id === inv.product_id &&
      p.branch === inv.branch &&
      new Date(p.date) >= cutoff
    );

    if (recentPurchases.length === 0) return;

    const totalConsumed = recentPurchases.reduce((s, p) => s + (p.qty || 0), 0);
    const dailyRate = totalConsumed / 30;
    if (dailyRate <= 0) return;

    const currentStock = inv.opening_stock || 0;
    const daysLeft = Math.floor(currentStock / dailyRate);

    if (daysLeft <= daysToPredict) {
      predictions.push({
        product_name: inv.product_name,
        branch: inv.branch,
        daysLeft,
        dailyRate: dailyRate.toFixed(2),
        unit: inv.unit,
        currentStock,
        threshold: inv.low_stock_threshold || 5,
        severity: daysLeft <= 3 ? 'critical' : daysLeft <= 7 ? 'warning' : 'info',
      });
    }
  });

  return predictions.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Detect unusual expense spikes vs previous period.
 */
export function detectExpenseSpikes(curExpenses, prevExpenses) {
  const curByCategory = {};
  const prevByCategory = {};

  curExpenses.forEach(e => { curByCategory[e.category] = (curByCategory[e.category] || 0) + (e.amount || 0); });
  prevExpenses.forEach(e => { prevByCategory[e.category] = (prevByCategory[e.category] || 0) + (e.amount || 0); });

  const spikes = [];
  Object.entries(curByCategory).forEach(([cat, amt]) => {
    const prev = prevByCategory[cat] || 0;
    if (prev === 0) return;
    const pct = ((amt - prev) / prev) * 100;
    if (pct >= 20) {
      spikes.push({ category: cat, current: amt, previous: prev, pct: pct.toFixed(0), severity: pct >= 50 ? 'critical' : 'warning' });
    }
  });

  return spikes.sort((a, b) => b.pct - a.pct);
}

/**
 * Generate a daily summary object.
 */
export function generateDailySummary(branches, sales, purchases, expenses, waste) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter(s => s.date === today);
  const todayPurchases = purchases.filter(p => p.date === today);
  const todayExpenses = expenses.filter(e => e.date === today);
  const todayWaste = waste.filter(w => w.date === today);

  const totalSales = todaySales.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0);
  const totalCost = todayPurchases.reduce((s, p) => s + ((p.qty || 0) * (p.used_price || p.current_price || 0)), 0);
  const totalExpenses = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalWaste = todayWaste.reduce((s, w) => s + (w.total_loss || 0), 0);
  const netProfit = totalSales - totalCost - totalExpenses;

  const branchSales = {};
  todaySales.forEach(s => {
    branchSales[s.branch] = (branchSales[s.branch] || 0) + (s.cash || 0) + (s.network || 0) + (s.credit || 0);
  });

  const sortedBranches = Object.entries(branchSales).sort(([, a], [, b]) => b - a);
  const bestBranch = sortedBranches[0] ? sortedBranches[0][0] : null;
  const worstBranch = sortedBranches.length > 1 ? sortedBranches[sortedBranches.length - 1][0] : null;

  const alerts = [];
  if (netProfit < 0) alerts.push({ type: 'critical', msg: `Net loss today: ${netProfit.toFixed(0)}` });
  if (totalWaste > totalSales * 0.05) alerts.push({ type: 'warning', msg: `High waste: ${totalWaste.toFixed(0)}` });
  const creditTotal = todaySales.reduce((s, r) => s + (r.credit || 0), 0);
  if (totalSales > 0 && (creditTotal / totalSales) > 0.4) alerts.push({ type: 'warning', msg: `High credit ratio: ${((creditTotal / totalSales) * 100).toFixed(0)}%` });

  return { date: today, totalSales, totalCost, totalExpenses, totalWaste, netProfit, bestBranch, worstBranch, alerts, branchSales };
}