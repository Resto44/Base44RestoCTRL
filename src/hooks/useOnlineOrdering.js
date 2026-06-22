/**
 * useOnlineOrdering — React hook for Online Ordering V2
 * Provides real-time order state, mutations, and subscriptions.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import {
  placeOrder,
  updateOrderStatus,
  updateKitchenStatus,
  assignDriver,
  updateDriverLocation,
  validatePromoCode,
  awardLoyaltyPoints,
  subscribeToOrder,
  subscribeToOrderTracking,
  subscribeToDriverLocation,
  subscribeToBranchOrders,
  ORDER_STATUS,
  KITCHEN_STATUS,
} from '@/lib/onlineOrderingService';

// ── useOrderRealtime — subscribe to a single order ─────────────────────────
export function useOrderRealtime(orderId) {
  const qc = useQueryClient();
  const channelRef = useRef(null);

  useEffect(() => {
    if (!orderId) return;

    const orderSub = subscribeToOrder(orderId, (payload) => {
      qc.invalidateQueries({ queryKey: ['order', orderId] });
    });

    const trackingSub = subscribeToOrderTracking(orderId, (payload) => {
      qc.invalidateQueries({ queryKey: ['order_tracking', orderId] });
    });

    const locationSub = subscribeToDriverLocation(orderId, (payload) => {
      qc.invalidateQueries({ queryKey: ['driver_location', orderId] });
    });

    return () => {
      orderSub?.unsubscribe?.();
      trackingSub?.unsubscribe?.();
      locationSub?.unsubscribe?.();
    };
  }, [orderId, qc]);

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => base44.entities.Order.get(orderId),
    enabled: !!orderId,
    refetchInterval: 5000,
  });

  const { data: tracking = [] } = useQuery({
    queryKey: ['order_tracking', orderId],
    queryFn: () => base44.entities.OrderTracking.filter({ order_id: orderId }),
    enabled: !!orderId,
    refetchInterval: 5000,
  });

  const { data: driverLocation } = useQuery({
    queryKey: ['driver_location', orderId],
    queryFn: async () => {
      const locs = await base44.entities.DriverLocation.filter({ order_id: orderId });
      return locs?.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] || null;
    },
    enabled: !!orderId,
    refetchInterval: 3000,
  });

  return { order, tracking, driverLocation };
}

// ── useBranchOrders — real-time orders for a branch ───────────────────────
export function useBranchOrders(branchId, statusFilter = null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!branchId) return;
    const sub = subscribeToBranchOrders(branchId, () => {
      qc.invalidateQueries({ queryKey: ['branch_orders', branchId] });
    });
    return () => sub?.unsubscribe?.();
  }, [branchId, qc]);

  return useQuery({
    queryKey: ['branch_orders', branchId, statusFilter],
    queryFn: async () => {
      const orders = await base44.entities.Order.filter({ branch_id: branchId });
      if (statusFilter) return orders.filter(o => statusFilter.includes(o.status));
      return orders;
    },
    enabled: !!branchId,
    refetchInterval: 5000,
  });
}

// ── useKitchenOrders — real-time kitchen queue ─────────────────────────────
export function useKitchenOrders(branchId) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!branchId) return;
    const sub = subscribeToBranchOrders(branchId, () => {
      qc.invalidateQueries({ queryKey: ['kitchen_orders', branchId] });
    });
    return () => sub?.unsubscribe?.();
  }, [branchId, qc]);

  return useQuery({
    queryKey: ['kitchen_orders', branchId],
    queryFn: async () => {
      const orders = await base44.entities.Order.filter({ branch_id: branchId });
      return orders.filter(o =>
        [ORDER_STATUS.PENDING, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.COOKING, ORDER_STATUS.READY]
          .includes(o.status)
      );
    },
    enabled: !!branchId,
    refetchInterval: 5000,
  });
}

// ── useDriverOrders — real-time driver order queue ─────────────────────────
export function useDriverOrders(driverId) {
  const qc = useQueryClient();

  return useQuery({
    queryKey: ['driver_orders', driverId],
    queryFn: async () => {
      const orders = await base44.entities.Order.filter({ driver_id: driverId });
      return orders.filter(o =>
        [ORDER_STATUS.ASSIGNED, ORDER_STATUS.PICKED_UP, ORDER_STATUS.ON_THE_WAY, ORDER_STATUS.ARRIVED]
          .includes(o.status)
      );
    },
    enabled: !!driverId,
    refetchInterval: 5000,
  });
}

// ── useCustomerOrders — customer order history ─────────────────────────────
export function useCustomerOrders(customerId) {
  return useQuery({
    queryKey: ['customer_orders', customerId],
    queryFn: () => base44.entities.Order.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
}

// ── usePlaceOrder mutation ─────────────────────────────────────────────────
export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: placeOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer_orders'] });
      qc.invalidateQueries({ queryKey: ['branch_orders'] });
      qc.invalidateQueries({ queryKey: ['kitchen_orders'] });
    },
  });
}

// ── useKitchenActions mutation ─────────────────────────────────────────────
export function useKitchenActions(orgId, restaurantId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, kitchenStatus, actorId }) =>
      updateKitchenStatus(orderId, kitchenStatus, actorId, orgId, restaurantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kitchen_orders'] });
      qc.invalidateQueries({ queryKey: ['branch_orders'] });
    },
  });
}

// ── useDriverActions mutation ──────────────────────────────────────────────
export function useDriverActions(orgId, restaurantId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status, actorId }) =>
      updateOrderStatus(orderId, status, actorId, 'driver', orgId, restaurantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver_orders'] });
    },
  });
}

// ── useDriverLocationUpdate — GPS tracking ────────────────────────────────
export function useDriverLocationUpdate(driverId, activeOrderId) {
  const [isTracking, setIsTracking] = useState(false);
  const watchRef = useRef(null);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation || !activeOrderId) return;
    setIsTracking(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        updateDriverLocation(
          driverId,
          activeOrderId,
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.heading,
          pos.coords.speed
        );
      },
      (err) => console.warn('[GPS]', err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 5000 }
    );
  }, [driverId, activeOrderId]);

  const stopTracking = useCallback(() => {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => stopTracking();
  }, [stopTracking]);

  return { isTracking, startTracking, stopTracking };
}

// ── usePromoCode validation ────────────────────────────────────────────────
export function usePromoCode() {
  const [promoResult, setPromoResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback(async (code, subtotal) => {
    setIsValidating(true);
    const result = await validatePromoCode(code, subtotal);
    setPromoResult(result);
    setIsValidating(false);
    return result;
  }, []);

  const clear = useCallback(() => setPromoResult(null), []);

  return { promoResult, isValidating, validate, clear };
}

// ── useCart — local cart state ─────────────────────────────────────────────
export function useCart() {
  const [items, setItems] = useState([]);

  const addItem = useCallback((product, quantity = 1, modifiers = [], notes = '') => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === product.id && JSON.stringify(i.modifiers) === JSON.stringify(modifiers));
      if (existing) {
        return prev.map(i =>
          i === existing ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        unit_price: product.price || product.default_price || 0,
        quantity,
        modifiers,
        notes,
      }];
    });
  }, []);

  const removeItem = useCallback((productId, modifiers = []) => {
    setItems(prev => prev.filter(i =>
      !(i.product_id === productId && JSON.stringify(i.modifiers) === JSON.stringify(modifiers))
    ));
  }, []);

  const updateQuantity = useCallback((productId, quantity, modifiers = []) => {
    if (quantity <= 0) {
      removeItem(productId, modifiers);
      return;
    }
    setItems(prev => prev.map(i =>
      i.product_id === productId && JSON.stringify(i.modifiers) === JSON.stringify(modifiers)
        ? { ...i, quantity }
        : i
    ));
  }, [removeItem]);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, subtotal, itemCount };
}
