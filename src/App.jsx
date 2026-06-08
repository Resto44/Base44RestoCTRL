import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { LanguageProvider } from '@/lib/LanguageContext';
import { SubscriptionProvider, useSubscription } from '@/lib/SubscriptionContext';
import { RoleProvider } from '@/lib/RoleContext';
import RoleGuard from '@/components/rbac/RoleGuard';
import { TenantProvider, useTenant } from '@/lib/TenantContext';
import RestaurantManager from '@/pages/RestaurantManager';
import Onboarding from '@/pages/Onboarding';
import NotificationCenter from '@/pages/NotificationCenter';
import AppLayout from '@/components/layout/AppLayout';
import PaywallScreen from '@/components/subscription/PaywallScreen';
import Dashboard from './pages/Dashboard';
import KitchenDashboard from './pages/KitchenDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import SponsorDashboard from './pages/SponsorDashboard';
import Sales from './pages/Sales';
import Purchases from '@/pages/Purchases';
import Products from '@/pages/Products';
import SettingsPage from '@/pages/SettingsPage';
import Expenses from '@/pages/Expenses';
import Tasks from '@/pages/Tasks';
import Alerts from '@/pages/Alerts';
import Reports from '@/pages/Reports';
import Inventory from '@/pages/Inventory';
import Suppliers from '@/pages/Suppliers';
import BrandSettings from '@/pages/BrandSettings';
import Billing from '@/pages/Billing';
import InventoryTransfer from '@/pages/InventoryTransfer';
import ScheduledReports from '@/pages/ScheduledReports';
import PurchaseOrders from '@/pages/PurchaseOrders';
import InventoryWaste from '@/pages/InventoryWaste';
import StaffAttendance from '@/pages/StaffAttendance';
import ActivityLogs from '@/pages/ActivityLogs';
import PriceOptimization from '@/pages/PriceOptimization';
import SalesDashboard from '@/pages/SalesDashboard';
import Recipes from '@/pages/Recipes';
import ProfitLoss from '@/pages/ProfitLoss';
import CashFlow from '@/pages/CashFlow';
import InventoryForecast from '@/pages/InventoryForecast';
import Payroll from '@/pages/Payroll';
import Employees from '@/pages/Employees';
import EmployeeControl from '@/pages/EmployeeControl';
import EmployeeAttendance from '@/pages/EmployeeAttendance';
import Treasury from '@/pages/Treasury';
import SponsorTreasury from '@/pages/SponsorTreasury';
import ApprovalPolicy from '@/pages/ApprovalPolicy';
import NetworkAccounts from '@/pages/NetworkAccounts';
import NetworkAnalytics from '@/pages/NetworkAnalytics';
import DebtManagement from '@/pages/DebtManagement';
import SuperAdmin from '@/pages/SuperAdmin';
import BranchManagement from '@/pages/BranchManagement';
import { NotificationProvider } from '@/lib/NotificationContext';
import StaffUpload from '@/pages/StaffUpload.jsx';
import CategoryManager from '@/pages/CategoryManager.jsx';
import Support from '@/pages/Support';
import { useRole, ROLES, ROLE_HOME } from '@/lib/RoleContext';
import { Toaster } from 'sonner';
import { base44 } from '@/api/base44Client';
import InvitePage from '@/pages/InvitePage';
import DriverInvitePage from '@/pages/DriverInvitePage';
import DeliveryOrders from '@/pages/DeliveryOrders';
import MenuProducts from '@/pages/MenuProducts';
import DriverSettlements from '@/pages/DriverSettlements';
import DriverPortal from '@/pages/DriverPortal';
import EmployeePortal from '@/pages/EmployeePortal';
import EmployeeInvitePage from '@/pages/EmployeeInvitePage';
import KitchenInvitePage from '@/pages/KitchenInvitePage';
import AuthPage from '@/pages/AuthPage';
import TelegramSettings from '@/pages/TelegramSettings';

// Route-level error boundary — catches crashes in individual pages
class RouteErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e, info) { console.error('[RouteErrorBoundary]', e, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
          <p className="text-muted-foreground mb-4">This page failed to load.</p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
            onClick={() => { this.setState({ hasError: false }); }}
          >Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Onboarding gate: redirects owners without restaurants to /onboarding ──────
function OnboardingGate({ children }) {
  const { restaurants, loadingRestaurants } = useTenant();
  const { user } = useAuth();
  const location = window.location;

  if (loadingRestaurants) return null; // wait — don't render children yet

  // Non-owner roles NEVER go through owner onboarding
  const restrictedRole = [ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.DRIVER, ROLES.SPONSOR, ROLES.KITCHEN, ROLES.CUSTOMER].includes(user?.role);
  if (restrictedRole) return children;

  // 'owner' is the platform role for the account owner
  const isOwner = user?.role === ROLES.OWNER || !user?.role;
  const needsOnboarding = isOwner && restaurants.length === 0;
  const onOnboardingPage = location.pathname === '/onboarding';

  if (needsOnboarding && !onOnboardingPage) {
    // Hard redirect to /onboarding — survives refreshes
    window.location.replace('/onboarding');
    return null;
  }

  if (!needsOnboarding && onOnboardingPage) {
    // Already onboarded — redirect away from onboarding
    window.location.replace('/');
    return null;
  }

  return children;
}

// ─── Role-based home redirect (runs once per login, only after onboarding) ────
function RoleHomeRedirect() {
  const { role } = useRole();
  const { restaurants, loadingRestaurants } = useTenant();
  const home = ROLE_HOME[role] || '/';

  React.useEffect(() => {
    if (loadingRestaurants) return;
    if (restaurants.length === 0) return; // don't redirect until onboarded
    if (window.location.pathname === '/' && home !== '/') {
      window.location.replace(home);
    }
  }, [home, loadingRestaurants, restaurants.length]);
  return null;
}

const SubscribedRoutes = () => {
  const { isActive, loading } = useSubscription();
  const { loadingRestaurants } = useTenant();

  const isLoading = loading || loadingRestaurants;

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // When subscription is not active, show paywall for all routes except /billing and /onboarding
  if (!isActive) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding onComplete={() => window.location.replace('/')} />} />
        <Route element={<AppLayout />}>
          <Route path="/billing" element={<Billing />} />
        </Route>
        <Route path="*" element={<PaywallScreen />} />
      </Routes>
    );
  }

  return (
    <RouteErrorBoundary>
    <OnboardingGate>
    <Routes>
      {/* Onboarding — always accessible, no AppLayout chrome */}
      <Route path="/onboarding" element={<Onboarding onComplete={() => window.location.replace('/')} />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<RoleGuard permission="viewDashboard"><Dashboard /></RoleGuard>} />
          <Route path="/staff-upload" element={<RoleGuard permission="uploadSales"><StaffUpload /></RoleGuard>} />
          <Route path="/sales" element={<RoleGuard permission="viewSales"><Sales /></RoleGuard>} />
          <Route path="/purchases" element={<RoleGuard permission="viewPurchases"><Purchases /></RoleGuard>} />
          <Route path="/products" element={<RoleGuard permission="viewInventory"><Products /></RoleGuard>} />
          <Route path="/settings" element={<RoleGuard permission="manageSettings"><SettingsPage /></RoleGuard>} />
          <Route path="/expenses" element={<RoleGuard permission="viewExpenses"><Expenses /></RoleGuard>} />
          <Route path="/tasks" element={<RoleGuard permission="viewTasks"><Tasks /></RoleGuard>} />
          <Route path="/alerts" element={<RoleGuard permission="viewAlerts"><Alerts /></RoleGuard>} />
          <Route path="/reports" element={<RoleGuard permission="viewReports"><Reports /></RoleGuard>} />
          <Route path="/inventory" element={<RoleGuard permission="viewInventory"><Inventory /></RoleGuard>} />
          <Route path="/inventory-transfers" element={<RoleGuard permission="viewInventory"><InventoryTransfer /></RoleGuard>} />
          <Route path="/suppliers" element={<RoleGuard permission="viewSuppliers"><Suppliers /></RoleGuard>} />
          <Route path="/brand" element={<RoleGuard permission="viewBrandSettings"><BrandSettings /></RoleGuard>} />
          <Route path="/billing" element={<RoleGuard permission="viewBilling"><Billing /></RoleGuard>} />
          <Route path="/scheduled-reports" element={<RoleGuard permission="exportPDF"><ScheduledReports /></RoleGuard>} />
          <Route path="/purchase-orders" element={<RoleGuard permission="viewSuppliers"><PurchaseOrders /></RoleGuard>} />
          <Route path="/inventory-waste" element={<RoleGuard permission="viewInventory"><InventoryWaste /></RoleGuard>} />
          {/* /staff-attendance redirects to unified attendance page */}
          <Route path="/staff-attendance" element={<RoleGuard permission="viewStaffAttendance"><EmployeeAttendance /></RoleGuard>} />
          <Route path="/restaurants" element={<RoleGuard permission="viewBrandSettings"><RestaurantManager /></RoleGuard>} />
          <Route path="/notifications" element={<RoleGuard permission="viewAlerts"><NotificationCenter /></RoleGuard>} />
          <Route path="/activity-logs" element={<RoleGuard permission="viewActivityLogs"><ActivityLogs /></RoleGuard>} />
          <Route path="/price-optimization" element={<RoleGuard permission="viewReports"><PriceOptimization /></RoleGuard>} />
          <Route path="/sales-dashboard" element={<RoleGuard permission="viewReports"><SalesDashboard /></RoleGuard>} />
          <Route path="/recipes" element={<RoleGuard permission="viewInventory"><Recipes /></RoleGuard>} />
          <Route path="/profit-loss" element={<RoleGuard permission="viewReports"><ProfitLoss /></RoleGuard>} />
          <Route path="/cashflow" element={<RoleGuard permission="viewReports"><CashFlow /></RoleGuard>} />
          <Route path="/inventory-forecast" element={<InventoryForecast />} />
          <Route path="/payroll" element={<RoleGuard permission="viewPayroll"><Payroll /></RoleGuard>} />
          <Route path="/employees" element={<RoleGuard permission="viewEmployees"><Employees /></RoleGuard>} />
          <Route path="/employee-control" element={<RoleGuard permission="viewEmployeeControl"><EmployeeControl /></RoleGuard>} />
          <Route path="/employee-attendance" element={<RoleGuard permission="recordAttendance"><EmployeeAttendance /></RoleGuard>} />
          <Route path="/treasury" element={<RoleGuard permission="viewTreasury"><Treasury /></RoleGuard>} />
          <Route path="/sponsor-treasury" element={<RoleGuard permission="viewSponsorTreasury"><SponsorTreasury /></RoleGuard>} />
          <Route path="/approval-policy" element={<RoleGuard permission="viewBrandSettings"><ApprovalPolicy /></RoleGuard>} />
          <Route path="/network-accounts" element={<RoleGuard permission="viewNetworkAccounts"><NetworkAccounts /></RoleGuard>} />
          <Route path="/network-analytics" element={<RoleGuard permission="viewNetworkAnalytics"><NetworkAnalytics /></RoleGuard>} />
          <Route path="/debts" element={<RoleGuard permission="viewDebts"><DebtManagement /></RoleGuard>} />
          <Route path="/categories" element={<RoleGuard permission="manageSettings"><CategoryManager /></RoleGuard>} />
          <Route path="/support" element={<Support />} />
          <Route path="/super-admin" element={<SuperAdmin />} />
          <Route path="/branch-management" element={<RoleGuard permission="viewBrandSettings"><BranchManagement /></RoleGuard>} />
          <Route path="/telegram-settings" element={<RoleGuard permission="viewBrandSettings"><TelegramSettings /></RoleGuard>} />
          <Route path="/delivery" element={<RoleGuard permission="viewDelivery"><DeliveryOrders /></RoleGuard>} />
          <Route path="/menu-products" element={<RoleGuard permission="viewDelivery"><MenuProducts /></RoleGuard>} />
          <Route path="/driver-settlements" element={<RoleGuard permission="viewDelivery"><DriverSettlements /></RoleGuard>} />
          
          {/* Dashboard aliases — role-specific named routes */}
          <Route path="/owner-dashboard" element={<RoleGuard permission="viewDashboard"><Dashboard /></RoleGuard>} />
          <Route path="/manager-dashboard" element={<RoleGuard permission="viewDashboard"><Dashboard /></RoleGuard>} />
          <Route path="/employee-dashboard" element={<EmployeePortal />} />
          <Route path="/driver-dashboard" element={<DriverPortal />} />
          <Route path="/sponsor-dashboard" element={<SponsorDashboard />} />
          <Route path="/kitchen-dashboard" element={<KitchenDashboard />} />
          <Route path="/customer-dashboard" element={<CustomerDashboard />} />
          
          {/* Legacy/Shortcut paths */}
          <Route path="/employee" element={<EmployeePortal />} />
          <Route path="/driver" element={<DriverPortal />} />
          <Route path="/kitchen" element={<KitchenDashboard />} />
          <Route path="/customer" element={<CustomerDashboard />} />
        </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </OnboardingGate>
    </RouteErrorBoundary>
  );
};

// ManagerRoleApplier: safety net — fires when a user lands on '/' with a pending invite token.
// The InvitePage handles this itself, but this is a safety net for users who land on '/' after login.
function ManagerRoleApplier() {
  const { user } = useAuth();
  React.useEffect(() => {
    if (!user?.email) return;

    // Only apply for roles that should not have manager access yet
    const safeRoles = new Set(['user', ROLES.OWNER, null, undefined, '']);
    if (!safeRoles.has(user.role)) return;

    // Check all invite token types
    const pendingToken =
      sessionStorage.getItem('pending_invite_token') ||
      localStorage.getItem('pending_invite_token') ||
      sessionStorage.getItem('pending_kitchen_invite_token') ||
      localStorage.getItem('pending_kitchen_invite_token');
    if (!pendingToken) return;

    sessionStorage.removeItem('pending_invite_token');
    localStorage.removeItem('pending_invite_token');
    localStorage.removeItem('pending_invite_return_url');
    console.log('[ManagerRoleApplier] Found pending invite token, applying…');

    base44.functions.invoke('acceptInvite', { token: pendingToken })
      .then(res => {
        const data = res?.data;
        if (data?.success) {
          console.log('[ManagerRoleApplier] Role applied, reloading…');
          window.location.reload();
        }
      })
      .catch(e => console.warn('[ManagerRoleApplier]', e));
  }, [user?.email, user?.role]);
  return null;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, []);

  // isLoadingPublicSettings always resolves together with isLoadingAuth — one gate is enough
  const isLoading = isLoadingAuth;

  // If we're not loading but have no user and no error, we should probably redirect to login
  // though AuthContext should have set an authError.type === 'auth_required'
  const noUser = !isLoading && !useAuth().user && !useAuth().authError;

  if (noUser) {
    navigateToLogin();
    return null;
  }

  if (isLoading && timedOut) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-semibold text-foreground">App is taking too long to load</p>
        <p className="text-sm text-muted-foreground">This may be a network or session issue.</p>
        <button
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
          onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }}
        >Reset &amp; Reload</button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <SubscriptionProvider>
      <RoleProvider>
        <TenantProvider>
          <NotificationProvider>
            <ManagerRoleApplier />
            <RoleHomeRedirect />
            <SubscribedRoutes />
          </NotificationProvider>
        </TenantProvider>
      </RoleProvider>
    </SubscriptionProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LanguageProvider>
          <Router>
            <Routes>
              {/* Public routes — NO auth/subscription/onboarding checks */}
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/invite" element={<InvitePage />} />
              {/* Aliases for invite routes */}
              <Route path="/manager-invite" element={<InvitePage />} />
              <Route path="/auth/invite" element={<InvitePage />} />
              <Route path="/auth/manager-login" element={<InvitePage />} />
              <Route path="/driver-invite" element={<DriverInvitePage />} />
              <Route path="/auth/driver-login" element={<DriverInvitePage />} />
              <Route path="/employee-invite" element={<EmployeeInvitePage />} />
              <Route path="/auth/employee-login" element={<EmployeeInvitePage />} />
              <Route path="/kitchen-invite" element={<KitchenInvitePage />} />
              <Route path="/auth/activate" element={<InvitePage />} />
              {/* All other routes go through the normal auth/subscription flow */}
              <Route path="*" element={<AuthenticatedApp />} />
            </Routes>
          </Router>
          <Toaster />
        </LanguageProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App