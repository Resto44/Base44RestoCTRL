/**
 * AI Purchase Forecasting Engine
 * Analyzes past inventory consumption rates and recommends
 * replenishment quantities to maintain 14-day stock levels.
 */

/**
 * Compute recommended purchase quantity per item per branch.
 * @param {Array} inventory - All inventory records
 * @param {Array} purchases - All purchase records (used to infer consumption)
 * @param {number} targetDays - Number of days to stock for (default 14)
 * @param {number} lookbackDays - Days of history to analyze (default 30)
 * @returns {Array} Forecast items sorted by urgency
 */
export function computePurchaseForecast(inventory, purchases, targetDays = 14, lookbackDays = 30) {
  const now = new Date();
  const cutoff = new Date(now - lookbackDays * 86400000);

  // Build latest stock state per product+branch
  const stockMap = {};
  inventory.forEach(inv => {
    const key = `${inv.product_id}__${inv.branch}`;
    if (!stockMap[key] || inv.date > stockMap[key].date) {
      stockMap[key] = { ...inv };
    }
  });

  // Compute current stock by adding all purchases on top of opening stock
  const purchasedMap = {};
  purchases.forEach(p => {
    const key = `${p.product_id}__${p.branch}`;
    purchasedMap[key] = (purchasedMap[key] || 0) + (p.qty || 0);
  });
  Object.entries(stockMap).forEach(([key, inv]) => {
    inv.current_stock = (inv.opening_stock || 0) + (purchasedMap[key] || 0);
  });

  const forecasts = [];

  Object.values(stockMap).forEach(inv => {
    const key = `${inv.product_id}__${inv.branch}`;

    // Recent purchases used as a proxy for consumption
    const recentPurchases = purchases.filter(p =>
      p.product_id === inv.product_id &&
      p.branch === inv.branch &&
      new Date(p.date) >= cutoff
    );

    if (recentPurchases.length === 0) return;

    const totalConsumed = recentPurchases.reduce((s, p) => s + (p.qty || 0), 0);
    const dailyRate = totalConsumed / lookbackDays;
    if (dailyRate <= 0) return;

    const currentStock = inv.current_stock;
    const daysLeft = currentStock > 0 ? Math.floor(currentStock / dailyRate) : 0;
    const targetStock = Math.ceil(dailyRate * targetDays);
    const recommendedQty = Math.max(0, targetStock - currentStock);

    if (daysLeft <= targetDays || recommendedQty > 0) {
      forecasts.push({
        product_id: inv.product_id,
        product_name: inv.product_name || inv.product_id,
        branch: inv.branch,
        unit: inv.unit || '',
        currentStock: Number(currentStock.toFixed(2)),
        dailyRate: Number(dailyRate.toFixed(2)),
        daysLeft,
        targetStock: Number(targetStock.toFixed(2)),
        recommendedQty: Number(recommendedQty.toFixed(2)),
        urgency: daysLeft <= 3 ? 'critical' : daysLeft <= 7 ? 'high' : daysLeft <= 14 ? 'medium' : 'low',
        confidence: recentPurchases.length >= 5 ? 'high' : recentPurchases.length >= 2 ? 'medium' : 'low',
        low_stock_threshold: inv.low_stock_threshold || 5,
      });
    }
  });

  return forecasts.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Group forecast items by branch and build PurchaseOrder draft items payload.
 */
export function buildOrderDraftItems(forecastItems) {
  return forecastItems.map(f => ({
    product_id: f.product_id,
    product_name: f.product_name,
    qty: f.recommendedQty,
    unit: f.unit,
    unit_price: 0, // to be filled by user
  }));
}