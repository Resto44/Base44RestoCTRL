/**
 * useInventoryEngine — Business Mode Aware Inventory Hook
 *
 * Provides inventory operations that automatically adapt to the current
 * business mode (Restaurant or Retail). All components should use this
 * hook instead of calling the inventory service directly.
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBusinessMode } from '@/lib/BusinessModeContext';
import { useTenant } from '@/lib/TenantContext';
import * as inventoryService from '@/services/inventoryService';
import { toast } from 'sonner';

export function useInventoryEngine() {
  const { activeMode, isRetail, isRestaurant } = useBusinessMode();
  const { activeRestaurantId, managerBranch } = useTenant();
  const queryClient = useQueryClient();

  const activeBranchId = managerBranch || activeRestaurantId;

  // ── Queries ─────────────────────────────────────────────────────────────────

  const {
    data: inventory = [],
    isLoading: loadingInventory,
    refetch: refetchInventory,
  } = useQuery({
    queryKey: ['inventory', activeBranchId, activeMode],
    queryFn: () => inventoryService.getBranchInventory(activeBranchId, activeRestaurantId),
    enabled: !!activeBranchId,
    staleTime: 30_000,
  });

  const {
    data: expiringBatches = [],
    isLoading: loadingExpiring,
  } = useQuery({
    queryKey: ['expiring-batches', activeRestaurantId],
    queryFn: () => inventoryService.getExpiringBatches(activeRestaurantId, 30),
    enabled: !!activeRestaurantId && isRetail,
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const processSaleMutation = useMutation({
    mutationFn: ({ saleId, saleItems, createdBy }) =>
      inventoryService.processSaleConsumption(
        saleId,
        activeBranchId,
        activeMode,
        saleItems,
        createdBy
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      if (result.errors?.length > 0) {
        toast.warning(`Sale processed with ${result.errors.length} inventory warning(s)`);
      }
    },
    onError: (err) => {
      toast.error(`Inventory consumption failed: ${err.message}`);
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: ({ productId, delta, reason, metadata }) =>
      inventoryService.adjustStock(productId, activeBranchId, delta, reason, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Stock updated');
    },
    onError: (err) => {
      toast.error(`Stock adjustment failed: ${err.message}`);
    },
  });

  const addBatchMutation = useMutation({
    mutationFn: (batchData) =>
      inventoryService.addInventoryBatch({
        ...batchData,
        restaurant_id: activeRestaurantId,
        branch_id: activeBranchId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['expiring-batches'] });
      toast.success('Batch added to inventory');
    },
    onError: (err) => {
      toast.error(`Failed to add batch: ${err.message}`);
    },
  });

  // ── Computed Values ──────────────────────────────────────────────────────────

  const lowStockItems = inventory.filter(item => {
    const threshold = item.low_stock_threshold || item.products?.reorder_point || 5;
    return (item.opening_stock || 0) <= threshold;
  });

  const totalInventoryValue = inventory.reduce((total, item) => {
    return total + ((item.opening_stock || 0) * (item.products?.default_cost || 0));
  }, 0);

  const getStockForProduct = useCallback((productId) => {
    const item = inventory.find(i => i.product_id === productId);
    return item?.opening_stock || 0;
  }, [inventory]);

  return {
    // State
    inventory,
    loadingInventory,
    expiringBatches,
    loadingExpiring,
    lowStockItems,
    totalInventoryValue,
    activeMode,
    isRetail,
    isRestaurant,

    // Queries
    refetchInventory,
    getStockForProduct,

    // Mutations
    processSale: processSaleMutation.mutate,
    processSaleAsync: processSaleMutation.mutateAsync,
    processingASale: processSaleMutation.isPending,

    adjustStock: adjustStockMutation.mutate,
    adjustingStock: adjustStockMutation.isPending,

    addBatch: addBatchMutation.mutate,
    addingBatch: addBatchMutation.isPending,
  };
}

export default useInventoryEngine;
