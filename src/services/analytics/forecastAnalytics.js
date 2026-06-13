import { base44 } from '@/api/base44Client';
import { getProfitAndLoss } from './profitAnalytics';
import { getDailyCashFlow } from './cashflowAnalytics';
import { predictLowStock } from './inventoryAnalytics';
import { calculateOutstandingReceivables } from './receivableAnalytics';

/**
 * Generates a simple linear forecast for a given metric.
 * @param {Array} historicalData - Array of { date: string, value: number } objects.
 * @param {number} daysToForecast - Number of days to forecast.
 * @returns {Array} Forecasted data points.
 */
function simpleLinearForecast(historicalData, daysToForecast) {
  if (historicalData.length < 2) return [];

  const lastDataPoint = historicalData[historicalData.length - 1];
  const secondLastDataPoint = historicalData[historicalData.length - 2];

  const lastDate = new Date(lastDataPoint.date);
  const secondLastDate = new Date(secondLastDataPoint.date);

  const slope = (lastDataPoint.value - secondLastDataPoint.value) / ((lastDate - secondLastDate) / (1000 * 60 * 60 * 24));
  const forecast = [];

  for (let i = 1; i <= daysToForecast; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setDate(lastDate.getDate() + i);
    const forecastedValue = lastDataPoint.value + slope * i;
    forecast.push({ date: forecastDate.toISOString().split('T')[0], value: Math.max(0, forecastedValue) });
  }
  return forecast;
}

/**
 * Generates a revenue forecast.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date for historical data (YYYY-MM-DD).
 * @param {string} toDate - End date for historical data (YYYY-MM-DD).
 * @param {number} daysToForecast - Number of days to forecast.
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<object>} Revenue forecast for best, expected, and worst cases.
 */
export async function getRevenueForecast(ownerFilter, fromDate, toDate, daysToForecast, branchKey = 'all') {
  const { sales } = await base44.entities.DailySales.filter(ownerFilter || {}, '-date', 1000);
  const historicalSales = sales
    .filter(s => s.date >= fromDate && s.date <= toDate && (branchKey === 'all' || s.branch === branchKey))
    .map(s => ({ date: s.date, value: (s.cash || 0) + (s.network || 0) + (s.credit || 0) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const expectedCase = simpleLinearForecast(historicalSales, daysToForecast);
  const bestCase = expectedCase.map(f => ({ ...f, value: f.value * 1.1 })); // +10%
  const worstCase = expectedCase.map(f => ({ ...f, value: f.value * 0.9 })); // -10%

  return { bestCase, expectedCase, worstCase };
}

/**
 * Generates a cash flow forecast.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date for historical data (YYYY-MM-DD).
 * @param {string} toDate - End date for historical data (YYYY-MM-DD).
 * @param {number} daysToForecast - Number of days to forecast.
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<object>} Cash flow forecast for best, expected, and worst cases.
 */
export async function getCashFlowForecast(ownerFilter, fromDate, toDate, daysToForecast, branchKey = 'all') {
  const historicalCashFlow = await getDailyCashFlow(ownerFilter, fromDate, toDate, branchKey);
  const historicalNetFlow = historicalCashFlow.map(d => ({ date: d.date, value: d.net }));

  const expectedCase = simpleLinearForecast(historicalNetFlow, daysToForecast);
  const bestCase = expectedCase.map(f => ({ ...f, value: f.value * 1.1 }));
  const worstCase = expectedCase.map(f => ({ ...f, value: f.value * 0.9 }));

  return { bestCase, expectedCase, worstCase };
}

/**
 * Generates an inventory forecast (low-stock predictions).
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date for historical purchases (YYYY-MM-DD).
 * @param {string} toDate - End date for historical purchases (YYYY-MM-DD).
 * @param {number} daysToForecast - Number of days to predict low stock for.
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<Array>} Inventory low-stock predictions.
 */
export async function getInventoryForecast(ownerFilter, fromDate, toDate, daysToForecast, branchKey = 'all') {
  const inventory = await base44.entities.Inventory.filter(ownerFilter || {}, 'product_name', 500);
  const purchases = await base44.entities.Purchase.filter(ownerFilter || {}, '-date', 1000);

  const filteredInventory = branchKey === 'all' ? inventory : inventory.filter(item => item.branch === branchKey);
  const filteredPurchases = purchases.filter(p => p.date >= fromDate && p.date <= toDate && (branchKey === 'all' || p.branch === branchKey));

  return predictLowStock(filteredInventory, filteredPurchases, daysToForecast);
}

/**
 * Generates a collections forecast.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date for historical debt records (YYYY-MM-DD).
 * @param {string} toDate - End date for historical debt records (YYYY-MM-DD).
 * @param {number} daysToForecast - Number of days to forecast.
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<object>} Collections forecast for best, expected, and worst cases.
 */
export async function getCollectionsForecast(ownerFilter, fromDate, toDate, daysToForecast, branchKey = 'all') {
  const historicalDebtRecords = await base44.entities.DebtRecord.filter(ownerFilter || {}, '-date', 1000);
  const filteredDebtRecords = historicalDebtRecords.filter(d => d.type === 'receivable' && d.date >= fromDate && d.date <= toDate && (branchKey === 'all' || d.branch === branchKey));

  const historicalOutstanding = filteredDebtRecords.map(d => ({ date: d.date, value: d.remaining_amount || 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const expectedCase = simpleLinearForecast(historicalOutstanding, daysToForecast);
  const bestCase = expectedCase.map(f => ({ ...f, value: f.value * 1.1 }));
  const worstCase = expectedCase.map(f => ({ ...f, value: f.value * 0.9 }));

  return { bestCase, expectedCase, worstCase };
}
