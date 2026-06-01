import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const TenantContext = createContext({
  restaurants: [], loadingRestaurants: false, activeRestaurant: null, activeRestaurantId: null,
  setActiveRestaurant: () => {}, branches: [], allBranches: [], createRestaurant: async () => {},
  updateRestaurantBranches: async () => {}, refetchRestaurants: () => {},
  orgId: '', orgFilter: {}, restaurantFilter: null,
  managerBranch: null, isManager: false,
});

export function TenantProvider({ children }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Active restaurant id stored in localStorage per user
  const [activeRestaurantId, setActiveRestaurantIdRaw] = useState(() =>
    localStorage.getItem(`rc_restaurant_${user?.email || 'default'}`) || null
  );

  const isManagerRole = user?.role === 'manager';

  const { data: restaurants = [], isLoading: loadingRestaurants, refetch: refetchRestaurants } = useQuery({
    queryKey: ['restaurants', user?.email, user?.role],
    queryFn: async () => {
      if (!user?.email) return [];
      if (isManagerRole) {
        // Managers don't own restaurants — fetch via their ManagerInvite to find the owner's restaurant
        const invites = await base44.entities.ManagerInvite.filter({ email: user.email });
        const active = invites.find(i => i.status !== 'revoked');
        if (active?.restaurant_id) {
          // Return a minimal restaurant stub so TenantContext has something to work with
          const rests = await base44.entities.Restaurant.filter({ org_id: active.owner_email }, 'name', 10);
          const match = rests.find(r => r.id === active.restaurant_id) || rests[0];
          return match ? [match] : [];
        }
        return [];
      }
      return base44.entities.Restaurant.filter({ org_id: user.email }, 'name', 50);
    },
    enabled: !!user?.email,
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

  // Parse branches from active restaurant
  const branches = React.useMemo(() => {
    if (!activeRestaurant?.branches) return [];
    try {
      return JSON.parse(activeRestaurant.branches).filter(b => b.is_active !== false);
    } catch { return []; }
  }, [activeRestaurant]);

  const allBranches = React.useMemo(() => {
    if (!activeRestaurant?.branches) return [];
    try { return JSON.parse(activeRestaurant.branches); } catch { return []; }
  }, [activeRestaurant]);

  const createRestaurant = useCallback(async (data) => {
    const r = await base44.entities.Restaurant.create({ ...data, org_id: user.email });
    refetchRestaurants();
    return r;
  }, [user?.email, refetchRestaurants]);

  const updateRestaurantBranches = useCallback(async (branchesArr) => {
    if (!activeRestaurant) return;
    await base44.entities.Restaurant.update(activeRestaurant.id, { branches: JSON.stringify(branchesArr) });
    refetchRestaurants();
    queryClient.invalidateQueries({ queryKey: ['restaurants'] });
  }, [activeRestaurant, refetchRestaurants, queryClient]);

  // org_id filter for all data queries — always scope to current user's org
  const orgFilter = { org_id: user?.email || '' };
  const restaurantFilter = activeRestaurant ? { org_id: user?.email || '', restaurant_id: activeRestaurant.id } : null;

  // Manager branch isolation
  const isManager = user?.role === 'manager';

  // Single lookup: hydrate branch + owner from ManagerInvite
  const [hydratedBranch, setHydratedBranch] = React.useState(null);
  const [inviteHydrated, setInviteHydrated] = React.useState(false);

  React.useEffect(() => {
    if (!isManager || !user?.email || inviteHydrated) return;
    if (user?.branch) { setHydratedBranch(user.branch); setInviteHydrated(true); return; }
    setInviteHydrated(true);
    base44.entities.ManagerInvite.filter({ email: user.email })
      .then(invites => {
        const active = invites.find(i => i.status !== 'revoked');
        if (active?.branch_key) {
          setHydratedBranch(active.branch_key);
          base44.auth.updateMe({ branch: active.branch_key }).catch(() => {});
          base44.entities.ManagerInvite.update(active.id, { status: 'accepted' }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [isManager, user?.email, user?.branch, inviteHydrated]);

  const managerBranch = isManager ? (user?.branch || hydratedBranch || null) : null;

  // TENANT ISOLATION: scope ALL entity queries to this owner.
  // For managers: also scope to their assigned branch so they never see other branches' data.
  // '__none__' ensures no records leak when email is missing (impossible match).
  const ownerFilter = React.useMemo(() => {
    if (isManager) {
      // Use '__none__' branch until hydrated — prevents cross-tenant leak during hydration
      return { branch: managerBranch || '__none__' };
    }
    return { created_by: user?.email || '__none__' };
  }, [user?.email, isManager, managerBranch]);

  // On user CHANGE (not initial mount), clear ALL cached queries and localStorage restaurant
  // selection to prevent cross-tenant data leaks.
  const prevEmailRef = React.useRef(undefined);
  React.useEffect(() => {
    const email = user?.email;
    if (prevEmailRef.current !== undefined && prevEmailRef.current !== email) {
      // Remove all queries so stale data from previous tenant never appears
      queryClient.removeQueries();
      // Also clear the restaurant selection for the previous user from localStorage
      if (prevEmailRef.current) {
        localStorage.removeItem(`rc_restaurant_${prevEmailRef.current}`);
      }
    }
    prevEmailRef.current = email;
  }, [user?.email, queryClient]);

  // For managers: restrict branches list to only their assigned branch
  const effectiveBranches = React.useMemo(() => {
    if (isManager && managerBranch) {
      return branches.filter(b => b.key === managerBranch);
    }
    return branches;
  }, [branches, isManager, managerBranch]);

  return (
    <TenantContext.Provider value={{
      restaurants,
      loadingRestaurants,
      activeRestaurant,
      activeRestaurantId: activeRestaurant?.id || null,
      setActiveRestaurant,
      branches: effectiveBranches,
      allBranches,
      createRestaurant,
      updateRestaurantBranches,
      refetchRestaurants,
      orgId: user?.email || '',
      orgFilter,
      restaurantFilter,
      ownerFilter,
      managerBranch,
      isManager,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  // Context has a default value so this always returns something safe
  return ctx;
}