/**
 * BusinessModeContext — Dual Business Mode Engine
 *
 * This context is the single source of truth for the active business mode.
 * It reads the business_mode from the currently active restaurant/tenant
 * and provides it to the entire component tree.
 *
 * Architecture Rules:
 *   - All mode-specific behavior MUST be driven by this context.
 *   - No component may hard-code restaurant or retail behavior.
 *   - Inventory Service reads this context to determine consumption logic.
 *   - Dashboard reads this context to load the correct widget set.
 *   - Navigation reads this context to show/hide mode-specific routes.
 *
 * Business Modes:
 *   'restaurant' — Menu, Recipe/BOM, Ingredient Inventory, Kitchen, Tables, Delivery
 *   'retail'     — Barcode, SKU, Variants, Batch/Lot, Expiry, Serial Numbers
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useTenant } from '@/lib/TenantContext';

// ── Constants ─────────────────────────────────────────────────────────────────
export const BUSINESS_MODES = {
  RESTAURANT: 'restaurant',
  RETAIL: 'retail',
};

// ── Module Registry ───────────────────────────────────────────────────────────
// Each module declares which modes it is available in.
// 'all' = shared, available in both modes.
export const MODULE_REGISTRY = {
  // ── Shared Modules (always available) ──────────────────────────────────────
  authentication:        { modes: 'all', label: 'Authentication' },
  dashboard:             { modes: 'all', label: 'Owner Dashboard' },
  branch_management:     { modes: 'all', label: 'Branch Management' },
  employee_management:   { modes: 'all', label: 'Employee Management' },
  customer_management:   { modes: 'all', label: 'Customer Management' },
  supplier_management:   { modes: 'all', label: 'Supplier Management' },
  product_management:    { modes: 'all', label: 'Product Management' },
  inventory:             { modes: 'all', label: 'Inventory' },
  purchase:              { modes: 'all', label: 'Purchase' },
  sales:                 { modes: 'all', label: 'Sales' },
  treasury:              { modes: 'all', label: 'Treasury' },
  cash_register:         { modes: 'all', label: 'Cash Register' },
  network_settlement:    { modes: 'all', label: 'Network Settlement' },
  expenses:              { modes: 'all', label: 'Expenses' },
  accounting:            { modes: 'all', label: 'Accounting' },
  reports:               { modes: 'all', label: 'Reports' },
  notifications:         { modes: 'all', label: 'Notifications' },
  ai_analytics:          { modes: 'all', label: 'AI Analytics' },
  multi_branch:          { modes: 'all', label: 'Multi-Branch' },
  multi_currency:        { modes: 'all', label: 'Multi-Currency' },
  multi_language:        { modes: 'all', label: 'Multi-Language' },

  // ── Restaurant Mode Modules ─────────────────────────────────────────────────
  menu_management:       { modes: 'restaurant', label: 'Menu Management' },
  recipe_bom:            { modes: 'restaurant', label: 'Recipe / BOM' },
  ingredient_inventory:  { modes: 'restaurant', label: 'Ingredient Inventory' },
  kitchen:               { modes: 'restaurant', label: 'Kitchen' },
  table_service:         { modes: 'restaurant', label: 'Table Service' },
  dine_in:               { modes: 'restaurant', label: 'Dine-In' },
  takeaway:              { modes: 'restaurant', label: 'Takeaway' },
  delivery:              { modes: 'restaurant', label: 'Delivery' },
  waste_management:      { modes: 'restaurant', label: 'Waste Management' },
  production:            { modes: 'restaurant', label: 'Production' },
  food_cost:             { modes: 'restaurant', label: 'Food Cost' },

  // ── Retail Mode Modules ─────────────────────────────────────────────────────
  barcode:               { modes: 'retail', label: 'Barcode' },
  sku_management:        { modes: 'retail', label: 'SKU Management' },
  product_variants:      { modes: 'retail', label: 'Product Variants' },
  batch_lot_tracking:    { modes: 'retail', label: 'Batch / Lot Tracking' },
  expiry_tracking:       { modes: 'retail', label: 'Expiry Tracking' },
  serial_numbers:        { modes: 'retail', label: 'Serial Numbers' },
  direct_inventory:      { modes: 'retail', label: 'Direct Inventory' },
};

// ── Context ───────────────────────────────────────────────────────────────────
const BusinessModeContext = createContext({
  activeMode: BUSINESS_MODES.RESTAURANT,
  isRestaurant: true,
  isRetail: false,
  isModuleEnabled: () => true,
  getModulesForMode: () => [],
  modeLabel: 'Restaurant',
  modeIcon: '🍽️',
  modeColor: 'orange',
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function BusinessModeProvider({ children }) {
  const { activeRestaurant } = useTenant();

  const activeMode = useMemo(() => {
    return activeRestaurant?.business_mode || BUSINESS_MODES.RESTAURANT;
  }, [activeRestaurant?.business_mode]);

  const isRestaurant = activeMode === BUSINESS_MODES.RESTAURANT;
  const isRetail = activeMode === BUSINESS_MODES.RETAIL;

  /**
   * Check if a specific module is enabled for the current business mode.
   * @param {string} moduleKey - Key from MODULE_REGISTRY
   * @returns {boolean}
   */
  const isModuleEnabled = (moduleKey) => {
    const module = MODULE_REGISTRY[moduleKey];
    if (!module) return false;
    if (module.modes === 'all') return true;
    return module.modes === activeMode;
  };

  /**
   * Get all modules available for the current mode.
   * @returns {Array<{key: string, label: string}>}
   */
  const getModulesForMode = () => {
    return Object.entries(MODULE_REGISTRY)
      .filter(([, mod]) => mod.modes === 'all' || mod.modes === activeMode)
      .map(([key, mod]) => ({ key, label: mod.label }));
  };

  const modeLabel = isRetail ? 'Retail' : 'Restaurant';
  const modeIcon = isRetail ? '🏪' : '🍽️';
  const modeColor = isRetail ? 'blue' : 'orange';

  const value = useMemo(() => ({
    activeMode,
    isRestaurant,
    isRetail,
    isModuleEnabled,
    getModulesForMode,
    modeLabel,
    modeIcon,
    modeColor,
  }), [activeMode, isRestaurant, isRetail]);

  return (
    <BusinessModeContext.Provider value={value}>
      {children}
    </BusinessModeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useBusinessMode() {
  return useContext(BusinessModeContext);
}

// ── HOC: withModeGuard ────────────────────────────────────────────────────────
/**
 * Higher-order component that renders a fallback if the current mode
 * does not match the required mode.
 */
export function withModeGuard(Component, requiredMode, FallbackComponent = null) {
  return function ModeGuardedComponent(props) {
    const { activeMode } = useBusinessMode();
    if (activeMode !== requiredMode) {
      return FallbackComponent ? <FallbackComponent /> : null;
    }
    return <Component {...props} />;
  };
}

// ── ModeGuard Component ───────────────────────────────────────────────────────
/**
 * Conditionally renders children based on business mode.
 *
 * Usage:
 *   <ModeGuard mode="restaurant">
 *     <KitchenDashboard />
 *   </ModeGuard>
 *
 *   <ModeGuard mode="retail">
 *     <BarcodeScanner />
 *   </ModeGuard>
 *
 *   <ModeGuard mode="all">
 *     <SharedComponent />
 *   </ModeGuard>
 */
export function ModeGuard({ mode, children, fallback = null }) {
  const { activeMode } = useBusinessMode();
  if (mode === 'all') return children;
  if (activeMode !== mode) return fallback;
  return children;
}

export default BusinessModeContext;
