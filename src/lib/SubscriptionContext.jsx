import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const SubscriptionContext = createContext();

export const PLAN_LIMITS = {
  starter:    { branches: 3,  restaurants: 1, employees: 20,  ocr: 100,  pdf: 50,  price: 49  },
  pro:        { branches: 15, restaurants: 5, employees: 100, ocr: 500,  pdf: 200, price: 99  },
  enterprise: { branches: 999, restaurants: 999, employees: 999, ocr: 9999, pdf: 9999, price: 299 },
};

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use authenticated user's email as org key — ensures true tenant isolation
  const orgKey = user?.email || null;

  const fetchingRef = useRef(false);
  const fetchSubscription = useCallback(async () => {
    if (fetchingRef.current) return; // prevent concurrent fetches
    fetchingRef.current = true;
    setLoading(true);
    // Hard 8s timeout — never hang forever
    const timeout = setTimeout(() => {
      if (fetchingRef.current) {
        console.warn('[SubscriptionContext] fetch timed out');
        setLoading(false);
        fetchingRef.current = false;
      }
    }, 8000);
    try {
      if (!orgKey) { setLoading(false); fetchingRef.current = false; return; }
      const records = await base44.entities.Subscription.filter({ org_key: orgKey });
      if (records.length > 0) {
        setSubscription(records[0]);
      } else {
        // Auto-create a 14-day trial
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 14);
        const trialEndStr = trialEnd.toISOString().split('T')[0];
        const defaults = PLAN_LIMITS.pro;
        const newSub = await base44.entities.Subscription.create({
          org_key: orgKey,
          plan: 'pro',
          subscription_status: 'trial',
          trial_end: trialEndStr,
          current_period_end: trialEndStr,
          payment_provider: 'none',
          monthly_price: defaults.price,
          max_restaurants: defaults.restaurants,
          max_branches: defaults.branches,
          max_employees: defaults.employees,
          max_ocr_scans: defaults.ocr,
          max_pdf_exports: defaults.pdf,
          used_ocr_scans: 0,
          used_pdf_exports: 0,
        });
        setSubscription(newSub);
      }
    } catch (e) {
      console.warn('[SubscriptionContext] fetch failed:', e);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [orgKey]);

  const { isLoadingAuth } = useAuth();

  useEffect(() => {
    if (user?.email) {
      fetchSubscription();
    } else if (!user && !isLoadingAuth) {
      // If auth check finished and no user, we're not loading subscription
      setLoading(false);
    }
  }, [fetchSubscription, user?.email, user, isLoadingAuth]);

  const effectiveStatus = (() => {
    if (!subscription) return 'trial';
    const { subscription_status, trial_end, current_period_end } = subscription;
    const today = new Date().toISOString().split('T')[0];
    if (subscription_status === 'trial' && trial_end && today > trial_end) return 'canceled';
    if (subscription_status === 'active' && current_period_end && today > current_period_end) return 'past_due';
    return subscription_status;
  })();

  const isActive = effectiveStatus === 'active' || effectiveStatus === 'trial';
  const plan = subscription?.plan || 'pro';
  const planDefaults = PLAN_LIMITS[plan] || PLAN_LIMITS.pro;

  // Merge plan defaults with any per-tenant overrides stored on subscription
  const limits = {
    branches:    subscription?.max_branches    ?? planDefaults.branches,
    restaurants: subscription?.max_restaurants ?? planDefaults.restaurants,
    employees:   subscription?.max_employees   ?? planDefaults.employees,
    ocr:         subscription?.max_ocr_scans   ?? planDefaults.ocr,
    pdf:         subscription?.max_pdf_exports ?? planDefaults.pdf,
  };

  const usedOcr = subscription?.used_ocr_scans || 0;
  const usedPdf = subscription?.used_pdf_exports || 0;

  const updateSubscription = async (data) => {
    if (!subscription) return;
    const updated = await base44.entities.Subscription.update(subscription.id, data);
    setSubscription(updated);
  };

  // Track usage increment
  const trackUsage = async (type) => {
    if (!subscription) return;
    const field = type === 'ocr' ? 'used_ocr_scans' : 'used_pdf_exports';
    const current = subscription[field] || 0;
    await updateSubscription({ [field]: current + 1 });
  };

  // Check if feature is within limits
  const withinLimit = (feature) => {
    if (!isActive) return false;
    if (feature === 'ocr') return usedOcr < limits.ocr;
    if (feature === 'pdf') return usedPdf < limits.pdf;
    return true;
  };

  return (
    <SubscriptionContext.Provider value={{
      subscription,
      effectiveStatus,
      isActive,
      plan,
      limits,
      PLAN_LIMITS,
      loading,
      usedOcr,
      usedPdf,
      orgKey,
      updateSubscription,
      trackUsage,
      withinLimit,
      refetch: fetchSubscription,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) return { isActive: true, loading: false, plan: 'pro', limits: {}, subscription: null, PLAN_LIMITS, usedOcr: 0, usedPdf: 0, withinLimit: () => true, trackUsage: async () => {}, updateSubscription: async () => {}, refetch: async () => {} };
  return ctx;
}