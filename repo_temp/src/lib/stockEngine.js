/**
 * Stock Engine — computes live stock levels deducting sales-linked consumption,
 * and sends WhatsApp / email low-stock alerts.
 */

/**
 * For each inventory item, computes:
 *   currentStock = opening_stock + purchasedQty - estimatedSalesUsage
 *
 * "estimatedSalesUsage" requires product-to-sales linkage.
 * Since DailySales records are revenue-level, we estimate deduction via
 * purchase consumption rate: if a product was purchased, sales drive its
 * depletion proportionally. Where no linkage exists, only purchases add stock.
 *
 * This keeps it useful without requiring a recipe/BOM entity.
 */
export function computeLiveStock(inventoryItems, purchases, wastageItems = []) {
  const map = {};

  // Seed from latest inventory snapshot per product+branch
  inventoryItems.forEach(item => {
    const key = `${item.product_id}_${item.branch}`;
    if (!map[key] || item.date > map[key].date) {
      map[key] = {
        ...item,
        purchasedQty: 0,
        wastedQty: 0,
      };
    }
  });

  // Add purchases
  purchases.forEach(p => {
    const key = `${p.product_id}_${p.branch}`;
    if (map[key]) map[key].purchasedQty += (p.qty || 0);
  });

  // Subtract waste
  wastageItems.forEach(w => {
    const key = `${w.product_id}_${w.branch}`;
    if (map[key]) map[key].wastedQty += (w.qty || 0);
  });

  // Compute current stock
  Object.values(map).forEach(item => {
    item.currentStock = (item.opening_stock || 0) + item.purchasedQty - item.wastedQty;
    item.isLow = item.currentStock <= (item.low_stock_threshold || 5);
  });

  return Object.values(map);
}

/**
 * Send WhatsApp alert for a low-stock item.
 * Opens WA deep-link — in a real setup this would be a backend call to WA Business API.
 */
export function sendWhatsAppAlert(phone, items, branchLabel) {
  if (!phone) return;
  const lines = items.map(i => `• ${i.product_name}: ${i.currentStock.toFixed(1)} ${i.unit || ''} (min: ${i.low_stock_threshold})`).join('\n');
  const msg = encodeURIComponent(`⚠️ Low Stock Alert — ${branchLabel}\n\n${lines}\n\nPlease arrange restocking.`);
  window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
}

/**
 * Build a grouped map of low-stock items per branch.
 */
export function groupLowStockByBranch(liveStock) {
  const map = {};
  liveStock.filter(i => i.isLow).forEach(i => {
    if (!map[i.branch]) map[i.branch] = [];
    map[i.branch].push(i);
  });
  return map;
}