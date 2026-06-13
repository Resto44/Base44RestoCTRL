import { base44 } from '@/api/base44Client';
import { getSaleCash, getSaleNetwork } from '@/lib/helpers';

/**
 * Fetches and processes sales data for a given period and branch.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<Array>} Processed sales data.
 */
export async function fetchSalesData(ownerFilter, fromDate, toDate, branchKey = 'all') {
  let query = base44.entities.DailySales.filter(ownerFilter || {}, '-date', 1000);

  // Apply date and branch filters
  query = query.filter(s => s.date >= fromDate && s.date <= toDate);
  if (branchKey !== 'all') {
    query = query.filter(s => s.branch === branchKey);
  }
  return query;
}

/**
 * Calculates total sales for a given period.
 * @param {Array} sales - Array of DailySales records.
 * @returns {number} Total sales amount.
 */
export function calculateTotalSales(sales) {
  return sales.reduce((sum, record) => {
    return sum + getSaleCash(record) + getSaleNetwork(record) + (Number(record.credit) || 0);
  }, 0);
}

/**
 * Calculates sales trend percentage compared to a previous period.
 * @param {number} currentSales - Total sales for the current period.
 * @param {number} previousSales - Total sales for the previous period.
 * @returns {number} Percentage change.
 */
export function calculateSalesTrend(currentSales, previousSales) {
  if (previousSales === 0) return currentSales > 0 ? 100 : 0;
  return ((currentSales - previousSales) / previousSales) * 100;
}

/**
 * Calculates sales by payment method.
 * @param {Array} sales - Array of DailySales records.
 * @returns {object} Sales breakdown by payment method.
 */
export function calculateSalesByPaymentMethod(sales) {
  const paymentMethods = {
    cash: 0,
    network: 0,
    credit: 0,
  };

  sales.forEach(record => {
    paymentMethods.cash += getSaleCash(record);
    paymentMethods.network += getSaleNetwork(record);
    paymentMethods.credit += (Number(record.credit) || 0);
  });

  return paymentMethods;
}

/**
 * Calculates sales by POS device.
 * @param {Array} sales - Array of DailySales records.
 * @returns {object} Sales breakdown by POS device.
 */
export function calculateSalesByPOSDevice(sales) {
  const posSales = {};

  sales.forEach(record => {
    const deviceId = record.restaurant_network_account_id || record.network_account_id || 'Unknown';
    posSales[deviceId] = (posSales[deviceId] || 0) + getSaleNetwork(record);
  });

  return posSales;
}

/**
 * Calculates daily sales trend data for charting.
 * @param {Array} sales - Array of DailySales records.
 * @returns {Array} Array of objects with date and total sales.
 */
export function calculateDailySalesTrend(sales) {
  const dailyData = {};
  sales.forEach(s => {
    const date = s.date;
    dailyData[date] = (dailyData[date] || 0) + getSaleCash(s) + getSaleNetwork(s) + (Number(s.credit) || 0);
  });

  return Object.entries(dailyData)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, totalSales]) => ({ date, totalSales }));
}
