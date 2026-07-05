import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
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
    queryKey: ['restaurants', user?.email, user?.role],
    queryFn: async () => {
      if (!user?.email) return [];
      
      if (isOwner) {
        return base44.entities.Restaurant.filter({ org_id: user.email }, 'name', 50);
      }

      // Non-owners: find the restaurant via their invite or assignment
      // We'll look for any active assignment to find the owner_email
      const [mgr, emp, kit, drv] = await Promise.all([
        base44.entities.ManagerInvite.filter({ email: user.email }),
        base44.entities.Employee.filter({ email: user.email }),
        base44.entities.Employee.filter({ email: user.email, position: 'Kitchen' }), // heuristic
        base44.entities.Employee.filter({ email: user.email, is_driver: true }),
      ]);

      const assignment = mgr.find(i => i.status !== 'revoked') || 
                         emp.find(e => e.is_active !== false) ||
                         kit.find(k => k.is_active !== false) ||
                         drv.find(d => d.is_active !== false);

      if (assignment) {
        const ownerEmail = assignment.owner_email || assignment.created_by;
        if (ownerEmail) {
          return base44.entities.Restaurant.filter({ org_id: ownerEmail }, 'name', 10);
        }
      }
      
      return [];
    },
    enabled: !!user?.email && !isLoadingAuth,
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

  const updateRestaurant = useCallback(async (id, data) => {
    const r = await base44.entities.Restaurant.update(id, data);
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
  const restaurantFilter = activeRestaurant ? { org_id: user?.email || '', restaurant_id: activeRestaurant.id } : null;

  // Branch isolation for all staff roles
  const isStaffRole = [ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.DRIVER, ROLES.KITCHEN].includes(user?.role);

  const [hydratedBranch, setHydratedBranch] = React.useState(null);
  const [inviteHydrated, setInviteHydrated] = React.useState(false);

  React.useEffect(() => {
    if (!isStaffRole || !user?.email || inviteHydrated) return;
    if (user?.branch) { setHydratedBranch(user.branch); setInviteHydrated(true); return; }
    setInviteHydrated(true);
    
    // Attempt to find branch assignment across multiple sources
    const findBranch = async () => {
      const [mgr, emp] = await Promise.all([
        base44.entities.ManagerInvite.filter({ email: user.email }),
        base44.entities.Employee.filter({ email: user.email })
      ]);
      
      const active = mgr.find(i => i.status !== 'revoked') || emp.find(e => e.is_active !== false);
      if (active?.branch_key || active?.branch) {
        const b = active.branch_key || active.branch;
        setHydratedBranch(b);
        base44.auth.updateMe({ branch: b }).catch(() => {});
        if (active.invite_token) {
           base44.entities.ManagerInvite.update(active.id, { status: 'accepted' }).catch(() => {});
        }
      }
    };
    findBranch();
  }, [isStaffRole, user?.email, user?.branch, inviteHydrated]);

  const assignedBranch = isStaffRole ? (user?.branch || hydratedBranch || null) : null;

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
    if (isManager && assignedBranch) {
      return branches.filter(b => b.key === assignedBranch);
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
  // Context has a default value so this always returns something safe
  return ctx;
}