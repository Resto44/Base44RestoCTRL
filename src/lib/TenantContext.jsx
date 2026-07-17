import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useRole, ROLES } from '@/lib/RoleContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const TenantContext = createContext({
  restaurants: [], loadingRestaurants: false, activeRestaurant: null, activeRestaurantId: null,
  setActiveRestaurant: () => {}, branches: [], allBranches: [], createRestaurant: async () => {},
  updateRestaurant: async () => {}, updateRestaurantBranches: async () => {}, refetchRestaurants: () => {},
  orgId: '', orgFilter: {}, restaurantFilter: null,
  managerBranch: null, isManager: false,
});

export function TenantProvider({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const queryClient = useQueryClient();

  // Active restaurant id stored in localStorage per user
  const [activeRestaurantId, setActiveRestaurantIdRaw] = useState(() =>
    localStorage.getItem(`rc_restaurant_${user?.email || 'default'}`) || null
  );

  // Normalize the raw role string the same way RoleContext does so that
  // 'admin' / 'restaurant_admin' users are correctly treated as OWNER.
  const normalizedRole = (() => {
    const r = (user?.role || '').toLowerCase();
    if (Object.values(ROLES).includes(r)) return r;
    if (r === 'admin' || r === 'restaurant_admin') return ROLES.OWNER;
    if (r === 'staff') return ROLES.EMPLOYEE;
    return ROLES.OWNER; // safe default
  })();
  const isOwner = normalizedRole === ROLES.OWNER;
  const isManager = normalizedRole === ROLES.MANAGER;
  const isEmployee = normalizedRole === ROLES.EMPLOYEE;
  const isDriver = normalizedRole === ROLES.DRIVER;
  const isKitchen = normalizedRole === ROLES.KITCHEN;
  const isCustomer = normalizedRole === ROLES.CUSTOMER;
  const isSponsor = normalizedRole === ROLES.SPONSOR;

  const { data: restaurants = [], isLoading: loadingRestaurants, refetch: refetchRestaurants } = useQuery({
    queryKey: ['restaurants', user?.id, user?.role],
    queryFn: async () => {
      if (!user?.id) return [];

      if (isOwner) {
        // Owner: find their restaurant via erp_memberships (most reliable)
        // Fall back to org_id match if needed
        const { data: membership } = await supabase
          .from('erp_memberships')
          .select('restaurant_id')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .eq('status', 'approved')
          .single();

        if (membership?.restaurant_id) {
          const { data } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', membership.restaurant_id)
            .limit(1);
          return data || [];
        }

        // Fallback: try org_id = email (legacy)
        const { data } = await supabase
          .from('restaurants')
          .select('*')
          .eq('org_id', user.email)
          .limit(10);
        return data || [];
      }

      // Non-owners: read restaurant_id directly from their profile
      // This is set atomically by the handle_new_user trigger on registration
      const restaurantId = user?.restaurant_id || user?.organization_id;
      if (restaurantId) {
        const { data } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', restaurantId)
          .limit(1);
        return data || [];
      }

      return [];
    },
    enabled: !!user?.id && !isLoadingAuth,
    staleTime: 60000,
  });

  // Auto-select first restaurant if none selected
  useEffect(() => {
    if (restaurants.length > 0 && !activeRestaurantId) {
      setActiveRestaurantIdRaw(restaurants[0].id);
    }
  }, [restaurants, activeRestaurantId]);

  const activeRestaurant = restaurants.find(r => r.id === activeRestaurantId) || restaurants[0] || null;

  const setActiveRestaurant = useCallback((id) => {
    setActiveRestaurantIdRaw(id);
    localStorage.setItem(`rc_restaurant_${user?.email || 'default'}`, id);
    // Invalidate all data queries when switching restaurant
    queryClient.invalidateQueries();
  }, [user?.email, queryClient]);

  // Load branches from the branches table (not from JSON column)
  const { data: branchesFromDB = [] } = useQuery({
    queryKey: ['branches', activeRestaurant?.id],
    queryFn: async () => {
      if (!activeRestaurant?.id) return [];
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, branch_key, location, is_active, restaurant_id')
        .eq('restaurant_id', activeRestaurant.id)
        .order('name');
      if (error) return [];
      return (data || []).map(b => ({
        ...b,
        key: b.branch_key,
        label: b.name,
      }));
    },
    enabled: !!activeRestaurant?.id,
    staleTime: 60000,
  });

  // Also parse branches from active restaurant JSON column (for backward compat)
  const branchesFromJSON = React.useMemo(() => {
    if (!activeRestaurant?.branches) return [];
    try {
      const parsed = typeof activeRestaurant.branches === 'string'
        ? JSON.parse(activeRestaurant.branches)
        : activeRestaurant.branches;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [activeRestaurant]);

  // Use DB branches if available, fall back to JSON
  const allBranches = branchesFromDB.length > 0 ? branchesFromDB : branchesFromJSON;
  const branches = allBranches.filter(b => b.is_active !== false);

  const createRestaurant = useCallback(async (data) => {
    const { data: r, error } = await supabase
      .from('restaurants')
      .insert({ ...data, org_id: user.email, created_by: user.email })
      .select()
      .single();
    if (error) throw error;
    refetchRestaurants();
    return r;
  }, [user?.email, refetchRestaurants]);

  const updateRestaurant = useCallback(async (id, data) => {
    const { data: r, error } = await supabase
      .from('restaurants')
      .update({ ...data, updated_date: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    refetchRestaurants();
    queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    return r;
  }, [refetchRestaurants, queryClient]);

  const updateRestaurantBranches = useCallback(async (branchesArr) => {
    if (!activeRestaurant) return;
    await updateRestaurant(activeRestaurant.id, { branches: JSON.stringify(branchesArr) });
  }, [activeRestaurant, updateRestaurant]);

  // org_id filter for all data queries — always scope to current user's org
  const orgFilter = { org_id: user?.email || '' };
  const restaurantFilter = activeRestaurant
    ? { org_id: user?.email || '', restaurant_id: activeRestaurant.id }
    : null;

  // Branch isolation for all staff roles
  const isStaffRole = [ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.DRIVER, ROLES.KITCHEN].includes(normalizedRole);

  // For staff roles, use profile.branch (branch_key string) for legacy compat
  const assignedBranch = isStaffRole ? (user?.branch || null) : null;

  // TENANT ISOLATION
  const ownerFilter = React.useMemo(() => {
    if (isStaffRole) {
      return { branch: assignedBranch || '__none__' };
    }
    if (isCustomer) {
      return { customer_email: user?.email || '__none__' };
    }
    return { created_by: user?.email || '__none__' };
  }, [user?.email, isStaffRole, isCustomer, assignedBranch]);

  // On user CHANGE (not initial mount), clear ALL cached queries and localStorage restaurant
  // selection to prevent cross-tenant data leaks.
  const prevEmailRef = React.useRef(undefined);
  React.useEffect(() => {
    const email = user?.email;
    if (prevEmailRef.current !== undefined && prevEmailRef.current !== email) {
      queryClient.removeQueries();
      if (prevEmailRef.current) {
        localStorage.removeItem(`rc_restaurant_${prevEmailRef.current}`);
      }
    }
    prevEmailRef.current = email;
  }, [user?.email, queryClient]);

  // For managers: restrict branches list to only their assigned branch
  const effectiveBranches = React.useMemo(() => {
    if (isManager && assignedBranch) {
      return branches.filter(b => b.key === assignedBranch || b.branch_key === assignedBranch);
    }
    return branches;
  }, [branches, isManager, assignedBranch]);

  return (
    <TenantContext.Provider value={{
      restaurants,
      loadingRestaurants: loadingRestaurants || isLoadingAuth,
      activeRestaurant,
      activeRestaurantId: activeRestaurant?.id || null,
      setActiveRestaurant,
      branches: effectiveBranches,
      allBranches,
      createRestaurant,
      updateRestaurant,
      updateRestaurantBranches,
      refetchRestaurants,
      orgId: user?.email || '',
      orgFilter,
      restaurantFilter,
      ownerFilter,
      managerBranch: assignedBranch,
      isManager,
      isEmployee,
      isDriver,
      isKitchen,
      isCustomer,
      isSponsor,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  return ctx;
}
