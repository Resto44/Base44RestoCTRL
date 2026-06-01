import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { audit } from '@/lib/auditLogger';

/**
 * ROLE SYSTEM
 * -----------
 * user.role values → internal role:
 *   'admin'         → owner          (full access)
 *   'restaurant_admin' → restaurant_admin (full access minus billing/brand)
 *   'sponsor'       → sponsor        (settlement/treasury view only)
 *   'manager'       → manager        (branch-scoped operations)
 *   'staff'         → staff          (upload-only: sales + purchases)
 *   anything else   → staff          (safest default)
 */

export const ROLES = {
  OWNER:            'owner',
  RESTAURANT_ADMIN: 'restaurant_admin',
  SPONSOR:          'sponsor',
  MANAGER:          'manager',
  STAFF:            'staff',
  DRIVER:           'driver',
  EMPLOYEE:         'employee',
  KITCHEN:          'kitchen',
  CUSTOMER:         'customer',
};

// Which route each role lands on after login
export const ROLE_HOME = {
  owner:            '/',
  restaurant_admin: '/',
  sponsor:          '/sponsor-dashboard',
  manager:          '/manager-dashboard',
  staff:            '/staff-upload',
  driver:           '/driver',
  employee:         '/employee',
  kitchen:          '/kitchen',
  customer:         '/customer',
};

// Roles that must never be redirected to onboarding
export const NON_OWNER_ROLES = new Set(['manager', 'staff', 'sponsor', 'driver', 'employee', 'kitchen', 'customer']);

// Pages each role is allowed to visit (whitelist approach for restricted roles)
const SPONSOR_ALLOWED   = new Set(['/sponsor-treasury', '/sponsor-dashboard']);
const STAFF_ALLOWED     = new Set(['/staff-upload', '/sales', '/purchases', '/employee-attendance']);
const DRIVER_ALLOWED    = new Set(['/driver', '/driver-invite', '/driver-dashboard', '/auth/driver-login']);
const EMPLOYEE_ALLOWED  = new Set(['/employee', '/employee-invite', '/employee-dashboard', '/auth/employee-login']);
const KITCHEN_ALLOWED   = new Set(['/kitchen', '/kitchen-dashboard']);
const CUSTOMER_ALLOWED  = new Set(['/customer', '/customer-dashboard']);

const RoleContext = createContext();

// ─── Permission matrix ───────────────────────────────────────────────────────
function buildCan(role) {
  const is = (...r) => r.includes(role);
  return {
    // Navigation / pages
    viewDashboard:      is('owner', 'restaurant_admin', 'manager'),
    viewSales:          is('owner', 'restaurant_admin', 'manager', 'staff'),
    viewPurchases:      is('owner', 'restaurant_admin', 'manager', 'staff'),
    viewExpenses:       is('owner', 'restaurant_admin', 'manager'),
    viewInventory:      is('owner', 'restaurant_admin', 'manager'),
    viewSuppliers:      is('owner', 'restaurant_admin', 'manager'),
    viewReports:        is('owner', 'restaurant_admin'),
    viewTreasury:       is('owner', 'restaurant_admin'),
    viewSponsorTreasury:is('owner', 'restaurant_admin', 'sponsor'),
    viewPayroll:        is('owner', 'restaurant_admin'),
    viewEmployees:      is('owner', 'restaurant_admin'),
    viewBilling:        is('owner'),
    viewBrandSettings:  is('owner'),
    viewAlerts:         is('owner', 'restaurant_admin', 'manager'),
    viewTasks:          is('owner', 'restaurant_admin', 'manager', 'staff'),
    viewNetworkAccounts:is('owner', 'restaurant_admin', 'manager'),
    viewNetworkAnalytics:is('owner', 'restaurant_admin'),
    viewDebts:          is('owner', 'restaurant_admin', 'manager'),
    viewStaffAttendance:is('owner', 'restaurant_admin', 'manager'),
    viewDelivery:       is('owner', 'restaurant_admin', 'manager'),
    viewDriverPortal:   is('driver'),
    recordAttendance:   is('owner', 'restaurant_admin', 'manager', 'staff'),
    viewEmployeeControl:is('owner', 'restaurant_admin', 'manager'),
    approveAdvances:    is('owner', 'restaurant_admin'),
    viewApprovalPolicy: is('owner', 'restaurant_admin'),
    viewActivityLogs:   is('owner', 'restaurant_admin'),

    // Actions
    exportPDF:          is('owner', 'restaurant_admin'),
    manageUsers:        is('owner'),
    manageSettings:     is('owner', 'restaurant_admin'),
    uploadSales:        true,   // all roles (filtered by their own branch)
    uploadPurchases:    is('owner', 'restaurant_admin', 'manager', 'staff'),
    uploadProof:        true,

    // Support
    viewSupport:            true,  // all roles can submit support

    // Sponsor-specific
    viewSponsorSettlements: is('owner', 'restaurant_admin', 'sponsor'),
    viewSponsorBalance:     is('owner', 'restaurant_admin', 'sponsor'),
  };
}

// logSecurityEvent is fire-and-forget via auditLogger
function logSecurityEvent(_user, _type, detail) {
  // use the module-level audit helper (already initialized in auditLogger)
  audit.securityViolation(detail, _user?.role || 'unknown');
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function RoleProvider({ children }) {
  const { user } = useAuth();

  const role = useMemo(() => {
    if (!user) return ROLES.OWNER; // unauthenticated renders nothing — safe default
    switch (user.role) {
      case 'admin':            return ROLES.OWNER;
      case 'restaurant_admin': return ROLES.RESTAURANT_ADMIN;
      case 'sponsor':          return ROLES.SPONSOR;
      case 'manager':          return ROLES.MANAGER;
      case 'staff':            return ROLES.STAFF;
      case 'driver':           return ROLES.DRIVER;
      case 'employee':         return ROLES.EMPLOYEE;
      case 'kitchen':          return ROLES.KITCHEN;
      case 'customer':         return ROLES.CUSTOMER;
      // Any unrecognized/null role → OWNER (never send unknown users to staff pages)
      default:                 return ROLES.OWNER;
    }
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
  // Safe fallback — if used outside RoleProvider, return safe defaults instead of crashing
  if (!ctx) return { role: ROLES.OWNER, can: buildCan(ROLES.OWNER), user: null };
  return ctx;
}

// ─── Route guard hook (use inside Router context) ─────────────────────────────
export function useRouteGuard() {
  const { role, user } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Don't enforce routes until we know who the user is
    if (!user) return;

    const path = location.pathname;

    if (role === ROLES.SPONSOR && !SPONSOR_ALLOWED.has(path)) {
      logSecurityEvent(user, 'unauthorized_access_attempt',
        `Sponsor tried to access: ${path}`);
      navigate('/sponsor-dashboard', { replace: true });
      return;
    }

    if (role === ROLES.STAFF && !STAFF_ALLOWED.has(path)) {
      logSecurityEvent(user, 'unauthorized_access_attempt',
        `Staff tried to access: ${path}`);
      navigate('/staff-upload', { replace: true });
      return;
    }

    if (role === ROLES.DRIVER && !DRIVER_ALLOWED.has(path)) {
      logSecurityEvent(user, 'unauthorized_access_attempt',
        `Driver tried to access: ${path}`);
      navigate('/driver', { replace: true });
      return;
    }

    if (role === ROLES.EMPLOYEE && !EMPLOYEE_ALLOWED.has(path)) {
      logSecurityEvent(user, 'unauthorized_access_attempt',
        `Employee tried to access: ${path}`);
      navigate('/employee', { replace: true });
      return;
    }

    if (role === ROLES.KITCHEN && !KITCHEN_ALLOWED.has(path)) {
      logSecurityEvent(user, 'unauthorized_access_attempt',
        `Kitchen staff tried to access: ${path}`);
      navigate('/kitchen', { replace: true });
      return;
    }

    if (role === ROLES.CUSTOMER && !CUSTOMER_ALLOWED.has(path)) {
      navigate('/customer', { replace: true });
      return;
    }
  }, [location.pathname, role, user]);
}