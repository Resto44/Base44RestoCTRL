/**
 * Inventory Service — Single Source of Truth
 *
 * This service is the ONLY place where inventory levels are read or modified.
 * No component, dashboard, or module may calculate inventory independently.
 *
 * Dual-Mode Consumption Logic:
 *   Restaurant Mode: Sales consume recipe ingredients (BOM explosion).
 *   Retail Mode:     Sales consume sold products directly.
 *
 * Architecture Rules:
 *   - Dashboard must NEVER calculate inventory independently.
 *   - All modules must use this service for inventory operations.
 *   - This service reads BusinessMode to determine consumption logic.
 */

import { supabase } from '@/api/supabaseClient';

// ── Core Inventory Operations ─────────────────────────────────────────────────

/**
 * Get current stock level for a product at a branch.
 */
export async function getStockLevel(productId, branchId) {
  const { data, error } = await supabase
    .from('inventory')
    .select('opening_stock, unit, low_stock_threshold, batch_number, expiry_date')
    .eq('product_id', productId)
    .eq('branch', branchId)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || { opening_stock: 0, unit: '', low_stock_threshold: 5 };
}

/**
 * Get all inventory for a branch with product details.
 */
export async function getBranchInventory(branchId, restaurantId) {
  const { data, error } = await supabase
    .from('inventory')
    .select(`
      *,
      products!inner(
        id, name, unit, barcode, sku, batch_tracked, expiry_tracked, serial_tracked,
        reorder_point, reorder_quantity, is_variant, parent_product_id
      )
    `)
    .eq('branch', branchId)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Adjust stock level (add or subtract).
 * @param {string} productId
 * @param {string} branchId
 * @param {number} delta - Positive for addition, negative for deduction
 * @param {string} reason - 'sale', 'purchase', 'adjustment', 'waste', 'transfer'
 * @param {object} metadata - Additional context (batch, serial, etc.)
 */
export async function adjustStock(productId, branchId, delta, reason = 'adjustment', metadata = {}) {
  // Get current stock
  const current = await getStockLevel(productId, branchId);
  const newStock = (current.opening_stock || 0) + delta;

  // Update inventory record
  const { error: updateError } = await supabase
    .from('inventory')
    .upsert({
      product_id: productId,
      branch: branchId,
      opening_stock: Math.max(0, newStock),
      date: new Date().toISOString().split('T')[0],
      ...metadata,
    }, { onConflict: 'product_id,branch' });

  if (updateError) throw updateError;

  // Log the transaction
  const { error: logError } = await supabase
    .from('inventory_transactions')
    .insert({
      product_id: productId,
      branch: branchId,
      quantity: delta,
      transaction_type: reason,
      notes: metadata.notes || '',
      created_by: metadata.created_by || '',
    });

  if (logError) console.warn('[InventoryService] Failed to log transaction:', logError);

  return { success: true, newStock: Math.max(0, newStock) };
}

// ── Sale Consumption Engine ───────────────────────────────────────────────────

/**
 * Process inventory consumption after an approved sale.
 * This is the core dual-mode engine.
 *
 * @param {string} saleId - The sale/invoice ID
 * @param {string} branchId - The branch where the sale occurred
 * @param {string} businessMode - 'restaurant' | 'retail'
 * @param {Array} saleItems - [{product_id, quantity, recipe_id?}]
 * @param {string} createdBy - User email
 */
export async function processSaleConsumption(saleId, branchId, businessMode, saleItems, createdBy) {
  const results = [];
  const errors = [];

  for (const item of saleItems) {
    try {
      if (businessMode === 'retail') {
        // ── RETAIL MODE: Direct product consumption ──────────────────────────
        await adjustStock(
          item.product_id,
          branchId,
          -(item.quantity || 1),
          'sale',
          { notes: `Sale ${saleId}`, created_by: createdBy }
        );

        // Handle batch tracking
        if (item.batch_id) {
          await supabase
            .from('inventory_batches')
            .update({ quantity: supabase.rpc('greatest', [0, 'quantity - ' + item.quantity]) })
            .eq('id', item.batch_id);
        }

        // Handle serial tracking
        if (item.serial_id) {
          await supabase
            .from('product_serials')
            .update({ status: 'sold', sale_date: new Date().toISOString().split('T')[0], sale_id: saleId })
            .eq('id', item.serial_id);
        }

        results.push({ product_id: item.product_id, consumed: item.quantity, mode: 'retail' });

      } else {
        // ── RESTAURANT MODE: Recipe/BOM ingredient consumption ───────────────
        if (!item.recipe_id) {
          // No recipe linked — skip ingredient deduction
          results.push({ product_id: item.product_id, consumed: 0, mode: 'restaurant', note: 'no_recipe' });
          continue;
        }

        // Fetch recipe ingredients
        const { data: recipe, error: recipeError } = await supabase
          .from('recipes')
          .select('ingredients, menu_item')
          .eq('id', item.recipe_id)
          .single();

        if (recipeError || !recipe) {
          errors.push({ item, error: 'Recipe not found' });
          continue;
        }

        let ingredients = [];
        try {
          ingredients = typeof recipe.ingredients === 'string'
            ? JSON.parse(recipe.ingredients)
            : (recipe.ingredients || []);
        } catch {
          errors.push({ item, error: 'Invalid recipe ingredients JSON' });
          continue;
        }

        // Deduct each ingredient
        for (const ingredient of ingredients) {
          const qtyToDeduct = (ingredient.qty || 0) * (item.quantity || 1);
          if (qtyToDeduct <= 0) continue;

          await adjustStock(
            ingredient.product_id,
            branchId,
            -qtyToDeduct,
            'sale',
            {
              notes: `Sale ${saleId} — Recipe: ${recipe.menu_item}`,
              created_by: createdBy,
            }
          );

          results.push({
            ingredient_id: ingredient.product_id,
            ingredient_name: ingredient.product_name,
            consumed: qtyToDeduct,
            unit: ingredient.unit,
            mode: 'restaurant',
          });
        }
      }
    } catch (err) {
      errors.push({ item, error: err.message });
    }
  }

  return { success: errors.length === 0, results, errors };
}

// ── Batch / Lot Operations (Retail) ──────────────────────────────────────────

/**
 * Get all batches for a product at a branch.
 */
export async function getProductBatches(productId, branchId) {
  const { data, error } = await supabase
    .from('inventory_batches')
    .select('*')
    .eq('product_id', productId)
    .eq('branch_id', branchId)
    .eq('status', 'active')
    .order('expiry_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get batches expiring within N days.
 */
export async function getExpiringBatches(restaurantId, daysAhead = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const { data, error } = await supabase
    .from('inventory_batches')
    .select(`
      *,
      products!inner(name, sku, barcode)
    `)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'active')
    .lte('expiry_date', futureDate.toISOString().split('T')[0])
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Add a new batch to inventory.
 */
export async function addInventoryBatch(batchData) {
  const { data, error } = await supabase
    .from('inventory_batches')
    .insert(batchData)
    .select()
    .single();

  if (error) throw error;

  // Also update main inventory stock
  await adjustStock(
    batchData.product_id,
    batchData.branch_id,
    batchData.quantity,
    'purchase',
    { batch_number: batchData.batch_number, created_by: batchData.created_by }
  );

  return data;
}

// ── Serial Number Operations (Retail) ────────────────────────────────────────

/**
 * Register serial numbers for a product.
 */
export async function registerSerialNumbers(productId, branchId, restaurantId, serials, metadata = {}) {
  const records = serials.map(serial => ({
    product_id: productId,
    branch_id: branchId,
    restaurant_id: restaurantId,
    serial_number: serial,
    status: 'in_stock',
    ...metadata,
  }));

  const { data, error } = await supabase
    .from('product_serials')
    .insert(records)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Look up a serial number.
 */
export async function findSerial(serialNumber, productId = null) {
  let query = supabase
    .from('product_serials')
    .select(`
      *,
      products!inner(name, sku, barcode)
    `)
    .eq('serial_number', serialNumber);

  if (productId) query = query.eq('product_id', productId);

  const { data, error } = await query.single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ── Inventory Analytics ───────────────────────────────────────────────────────

/**
 * Get low stock alerts for a branch.
 */
export async function getLowStockAlerts(branchId) {
  const { data, error } = await supabase
    .from('inventory')
    .select(`
      *,
      products!inner(name, sku, barcode, reorder_point, reorder_quantity)
    `)
    .eq('branch', branchId)
    .filter('opening_stock', 'lte', 'low_stock_threshold');

  if (error) throw error;
  return data || [];
}

/**
 * Get inventory valuation for a branch.
 * @returns {number} Total inventory value
 */
export async function getInventoryValuation(branchId) {
  const { data, error } = await supabase
    .from('inventory')
    .select(`
      opening_stock,
      products!inner(default_cost)
    `)
    .eq('branch', branchId);

  if (error) throw error;

  return (data || []).reduce((total, item) => {
    return total + (item.opening_stock * (item.products?.default_cost || 0));
  }, 0);
}

export default {
  getStockLevel,
  getBranchInventory,
  adjustStock,
  processSaleConsumption,
  getProductBatches,
  getExpiringBatches,
  addInventoryBatch,
  registerSerialNumbers,
  findSerial,
  getLowStockAlerts,
  getInventoryValuation,
};
