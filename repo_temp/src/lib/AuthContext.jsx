import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

// Simple timeout wrapper
const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    checkAppState();
    // Keep auth state in sync with Supabase session changes
    // NOTE: skip INITIAL_SESSION — checkAppState() is already called above
    let initialFired = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted.current) return;
      if (_event === 'INITIAL_SESSION') { initialFired = true; return; }
      if (session) {
        checkAppState();
      } else {
        setUser(null);
        setIsAuthenticated(false);
        if (mounted.current) {
          setIsLoadingAuth(false);
          setIsLoadingPublicSettings(false);
        }
      }
    });
    return () => { mounted.current = false; subscription.unsubscribe(); };
  }, []);

  const checkAppState = async () => {
    try {
      if (mounted.current) setIsLoadingPublicSettings(true);
      if (mounted.current) setAuthError(null);

      // Try to get auth state — with a hard 8s timeout to prevent infinite loading
      try {
        const currentUser = await withTimeout(base44.auth.me(), 8000);
        if (!mounted.current) return;

        if (currentUser) {
          // Only auto-assign 'admin' role if the user has no role AND there is no pending invite token.
          // Pending invite tokens mean the user just signed up via an invite — the invite page will
          // assign the correct role (driver/employee/manager). We must NOT overwrite it with 'admin'.
          const hasPendingInvite =
            sessionStorage.getItem('pending_invite_token') ||
            sessionStorage.getItem('pending_driver_invite_token') ||
            sessionStorage.getItem('pending_employee_invite_token') ||
            sessionStorage.getItem('pending_kitchen_invite_token') ||
            localStorage.getItem('pending_invite_token') ||
            localStorage.getItem('pending_driver_invite_token') ||
            localStorage.getItem('pending_employee_invite_token') ||
            localStorage.getItem('pending_kitchen_invite_token');
          if (!currentUser.role && !hasPendingInvite) {
            await withTimeout(base44.auth.updateMe({ role: 'admin' }), 5000).catch(() => {});
            const updated = await withTimeout(base44.auth.me(), 5000).catch(() => currentUser);
            if (!mounted.current) return;
            setUser(updated || currentUser);
          } else {
            setUser(currentUser);
          }
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        }
      } catch (e) {
        if (!mounted.current) return;
        // timeout or auth error — treat as unauthenticated
        setIsAuthenticated(false);
        if (e.status === 403) {
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        }
      }
    } catch (error) {
      if (!mounted.current) return;
      console.error('[AuthContext] Unexpected error:', error);
      setIsAuthenticated(false);
    } finally {
      if (mounted.current) {
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    }
  };

  const checkUserAuth = async () => {
    if (!mounted.current) return;
    setIsLoadingAuth(true);
    try {
      const currentUser = await withTimeout(base44.auth.me(), 8000);
      if (!mounted.current) return;
      const hasPendingInvite =
        sessionStorage.getItem('pending_invite_token') ||
        sessionStorage.getItem('pending_driver_invite_token') ||
        sessionStorage.getItem('pending_employee_invite_token') ||
        sessionStorage.getItem('pending_kitchen_invite_token') ||
        localStorage.getItem('pending_invite_token') ||
        localStorage.getItem('pending_driver_invite_token') ||
        localStorage.getItem('pending_employee_invite_token') ||
        localStorage.getItem('pending_kitchen_invite_token');
      if (!currentUser.role && !hasPendingInvite) {
        await withTimeout(base44.auth.updateMe({ role: 'admin' }), 5000).catch(() => {});
        const updated = await withTimeout(base44.auth.me(), 5000).catch(() => currentUser);
        if (!mounted.current) return;
        setUser(updated || currentUser);
      } else {
        setUser(currentUser);
      }
      setIsAuthenticated(true);
    } catch (error) {
      if (!mounted.current) return;
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
    } finally {
      if (mounted.current) {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    supabase.auth.signOut().then(() => { window.location.href = '/auth'; });
  };

  const navigateToLogin = () => {
    const next = encodeURIComponent(window.location.href);
    window.location.href = `/auth?next=${next}`;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};