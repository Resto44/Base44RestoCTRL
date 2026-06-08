import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { audit } from '@/lib/auditLogger';

/**
 * ROLE SYSTEM (Implementation Specification)
 * ----------------------------------------
 * 1. Owner
 * 2. Manager
 * 3. Employee
 * 4. Driver
 * 5. Sponsor (Kafeel)
 * 6. Kitchen
 * 7. Customer
 */

export const ROLES = {
  OWNER:    'owner',
  MANAGER:  'manager',
  EMPLOYEE: 'employee',
  DRIVER:   'driver',
  SPONSOR:  'sponsor',
  KITCHEN:  'kitchen',
  CUSTOMER: 'customer',
};

// Which route each role lands on after login
export const ROLE_HOME = {
  [ROLES.OWNER]:    '/',
  [ROLES.MANAGER]:  '/manager-dashboard',
  [ROLES.EMPLOYEE]: '/employee-dashboard',
  [ROLES.DRIVER]:   '/driver-dashboard',
  [ROLES.SPONSOR]:  '/sponsor-dashboard',
  [ROLES.KITCHEN]:  '/kitchen-dashboard',
  [ROLES.CUSTOMER]: '/customer-dashboard',
};

// Roles that must never be redirected to onboarding
export const NON_OWNER_ROLES = new Set([
  ROLES.MANAGER, 
  ROLES.EMPLOYEE, 
  ROLES.DRIVER, 
  ROLES.SPONSOR, 
  ROLES.KITCHEN, 
  ROLES.CUSTOMER
]);

const RoleContext = createContext();

// ─── Permission matrix ───────────────────────────────────────────────────────
function buildCan(role) {
  const is = (...r) => r.includes(role);
  
  // Owner has full access
  if (role === ROLES.OWNER) {
    return Object.keys(PERMISSIONS_LIST).reduce((acc, key) => ({ ...acc, [key]: true }), {});
  }

  return {
    // Navigation / pages
    viewDashboard:      is(ROLES.OWNER, ROLES.MANAGER),
    viewSales:          is(ROLES.OWNER, ROLES.MANAGER),
    viewPurchases:      is(ROLES.OWNER, ROLES.MANAGER),
    viewInventory:      is(ROLES.OWNER, ROLES.MANAGER),
    viewOrders:         is(ROLES.OWNER, ROLES.MANAGER, ROLES.KITCHEN, ROLES.CUSTOMER),
    viewStaff:          is(ROLES.OWNER, ROLES.MANAGER),
    viewAttendance:     is(ROLES.OWNER, ROLES.MANAGER, ROLES.EMPLOYEE),
    viewReports:        is(ROLES.OWNER, ROLES.MANAGER, ROLES.SPONSOR),
    
    // Financials
    viewFinancials:     is(ROLES.OWNER),
    viewProfitLoss:     is(ROLES.OWNER),
    
    // Employee Specific
    recordAttendance:   is(ROLES.OWNER, ROLES.MANAGER, ROLES.EMPLOYEE),
    viewSchedule:       is(ROLES.OWNER, ROLES.MANAGER, ROLES.EMPLOYEE),
    viewTasks:          is(ROLES.OWNER, ROLES.MANAGER, ROLES.EMPLOYEE),
    viewSalary:         is(ROLES.OWNER, ROLES.EMPLOYEE),
    manageLoans:        is(ROLES.OWNER, ROLES.EMPLOYEE),
    viewProfile:        is(ROLES.OWNER, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.DRIVER, ROLES.CUSTOMER),
    
    // Driver Specific
    viewDeliveries:     is(ROLES.OWNER, ROLES.MANAGER, ROLES.DRIVER),
    updateDelivery:     is(ROLES.OWNER, ROLES.MANAGER, ROLES.DRIVER),
    viewEarnings:       is(ROLES.OWNER, ROLES.DRIVER),
    
    // Sponsor Specific
    viewWallet:         is(ROLES.OWNER, ROLES.SPONSOR),
    manageTransactions: is(ROLES.OWNER, ROLES.SPONSOR),
    viewSponsored:      is(ROLES.OWNER, ROLES.SPONSOR),
    
    // Kitchen Specific
    viewKitchenQueue:   is(ROLES.OWNER, ROLES.MANAGER, ROLES.KITCHEN),
    updatePrepStatus:   is(ROLES.OWNER, ROLES.MANAGER, ROLES.KITCHEN),
    
    // Customer Specific
    placeOrders:        is(ROLES.CUSTOMER),
    trackOrders:        is(ROLES.CUSTOMER),
    
    // Settings / Management
    manageSettings:     is(ROLES.OWNER),
    manageBranches:     is(ROLES.OWNER),
    manageUsers:        is(ROLES.OWNER),
    manageRoles:        is(ROLES.OWNER),
    manageCustomers:    is(ROLES.OWNER),
    manageDrivers:      is(ROLES.OWNER),
    manageKitchen:      is(ROLES.OWNER),
    manageSponsors:     is(ROLES.OWNER),
    
    // Legacy / Misc
    uploadSales:        is(ROLES.OWNER, ROLES.MANAGER),
    viewAlerts:         is(ROLES.OWNER, ROLES.MANAGER),
    viewSupport:        true,
  };
}

const PERMISSIONS_LIST = {
  viewDashboard: false, viewSales: false, viewPurchases: false, viewInventory: false,
  viewOrders: false, viewStaff: false, viewAttendance: false, viewReports: false,
  viewFinancials: false, viewProfitLoss: false, recordAttendance: false,
  viewSchedule: false, viewTasks: false, viewSalary: false, manageLoans: false,
  viewProfile: false, viewDeliveries: false, updateDelivery: false, viewEarnings: false,
  viewWallet: false, manageTransactions: false, viewSponsored: false,
  viewKitchenQueue: false, updatePrepStatus: false, placeOrders: false,
  trackOrders: false, manageSettings: false, manageBranches: false, manageUsers: false,
  manageRoles: false, manageCustomers: false, manageDrivers: false, manageKitchen: false,
  manageSponsors: false, uploadSales: false, viewAlerts: false, viewSupport: true
};

// logSecurityEvent is fire-and-forget via auditLogger
function logSecurityEvent(_user, _type, detail) {
  audit.securityViolation(detail, _user?.role || 'unknown');
}

export function RoleProvider({ children }) {
  const { user } = useAuth();

  const role = useMemo(() => {
    if (!user) return ROLES.OWNER; 
    // Normalize role strings to match our ROLES constant
    const r = (user.role || '').toLowerCase();
    if (Object.values(ROLES).includes(r)) return r;
    if (r === 'admin' || r === 'restaurant_admin') return ROLES.OWNER;
    if (r === 'staff') return ROLES.EMPLOYEE;
    return ROLES.OWNER; // Safe default
  }, [user]);

  const can = useMemo(() => buildCan(role), [role]);

  return (
    <RoleContext.Provider value={{ role, can, user }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) return { role: ROLES.OWNER, can: buildCan(ROLES.OWNER), user: null };
  return ctx;
}

export function useRouteGuard() {
  const { role, user } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    const path = location.pathname;
    
    // Whitelist bypass for home, auth, and onboarding
    if (['/', '/auth', '/onboarding', '/support'].includes(path)) return;

    // Check if the role is allowed to be on this specific dashboard
    if (path.endsWith('-dashboard')) {
      const dashboardRole = path.replace('/', '').replace('-dashboard', '');
      if (dashboardRole !== role && role !== ROLES.OWNER) {
        navigate(ROLE_HOME[role] || '/', { replace: true });
      }
    }
  }, [location.pathname, role, user]);
}
