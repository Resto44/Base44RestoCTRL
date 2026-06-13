import { base44 } from '@/api/base44Client';

/**
 * Fetches inventory data.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<Array>} Inventory records.
 */
export async function fetchInventoryData(ownerFilter, branchKey = 'all') {
  let query = base44.entities.Inventory.filter(ownerFilter || {}, 'product_name', 500);
  if (branchKey !== 'all') {
    query = query.filter(item => item.branch === branchKey);
  }
  return query;
}

/**
 * Fetches purchase data for inventory analysis.
 * @param {object} ownerFilter - The tenant/owner filter object.
 * @param {string} fromDate - Start date (YYYY-MM-DD).
 * @param {string} toDate - End date (YYYY-MM-DD).
 * @param {string} branchKey - Optional branch key to filter by.
 * @returns {Promise<Array>} Purchase records.
 */
export async function fetchPurchaseDataForInventory(ownerFilter, fromDate, toDate, branchKey = 'all') {
  let query = base44.entities.Purchase.filter(ownerFilter || {}, '-date', 1000);
  query = query.filter(p => p.date >= fromDate && p.date <= toDate);
  if (branchKey !== 'all') {
    query = query.filter(p => p.branch === branchKey);
  }
  return query;
}

/**
 * Calculates total inventory value.
 * @param {Array} inventory - Array of Inventory records.
 * @returns {number} Total value.
 */
export function calculateTotalInventoryValue(inventory) {
  // Assuming 'cost_price' is available in a related 'products' entity or directly in inventory
  // For now, we'll use a placeholder or assume a default value if not present.
  // In a real scenario, we'd join with a products table to get accurate cost prices.
  return inventory.reduce((sum, item) => sum + (item.quantity || 0) * (item.cost_price || 1), 0);
}

/**
 * Predicts low-stock products based on recent consumption.
 * @param {Array} inventory - Array of Inventory records.
 * @param {Array} purchases - Array of Purchase records (representing consumption).
 * @param {number} daysToPredict - Number of days to predict stock for.
 * @returns {Array} List of low-stock predictions.
 */
export function predictLowStock(inventory, purchases, daysToPredict = 14) {
  const predictions = [];
  const now = new Date();
  const cutoff = new Date(now.setDate(now.getDate() - 30)); // Look at last 30 days of purchases

  inventory.forEach(inv => {
    const recentPurchases = purchases.filter(p =>
      p.product_id === inv.product_id &&
      p.branch === inv.branch &&
      new Date(p.date) >= cutoff
    );

    if (recentPurchases.length === 0) return; // No recent purchases to base prediction on

    const totalConsumed = recentPurchases.reduce((s, p) => s + (p.qty || 0), 0);
    const dailyRate = totalConsumed / 30; // Average daily consumption over last 30 days
    if (dailyRate <= 0) return;

    const currentStock = inv.quantity || 0;
    const daysLeft = Math.floor(currentStock / dailyRate);

    if (daysLeft <= daysToPredict) {
      predictions.push({
        product_name: inv.product_name,
        branch: inv.branch,
        daysLeft,
        dailyRate: dailyRate.toFixed(2),
        unit: inv.unit,
        currentStock,
        minStockLevel: inv.min_stock_level || 0,
        severity: daysLeft <= (inv.min_stock_level || 0) ? 'critical' : daysLeft <= daysToPredict ? 'warning' : 'info',
      });
    }
  });

  return predictions.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Calculates inventory turnover rate.
 * @param {number} cogs - Cost of Goods Sold for the period.
 * @param {number} averageInventory - Average inventory value for the period.
 * @returns {number} Inventory turnover rate.
 */
export function calculateInventoryTurnover(cogs, averageInventory) {
  if (averageInventory === 0) return 0;
  return cogs / averageInventory;
}
