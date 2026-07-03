import React, { lazy, Suspense } from 'react';
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
import { BusinessModeProvider } from '@/lib/BusinessModeContext';
import { NotificationProvider } from '@/lib/NotificationContext';
import { useRole, ROLES, ROLE_HOME } from '@/lib/RoleContext';
import { Toaster } from 'sonner';
import { base44 } from '@/api/base44Client';

// ── Core layout (always loaded eagerly) ──────────────────────────────────────
import AppLayout from '@/components/layout/AppLayout';
import PaywallScreen from '@/components/subscription/PaywallScreen';

// ── Lazy-loaded pages (code splitting) ───────────────────────────────────────
const Dashboard           = lazy(() => import('./pages/Dashboard'));
const KitchenDashboard    = lazy(() => import('./pages/KitchenDashboard'));
const CustomerDashboard   = lazy(() => import('./pages/CustomerDashboard'));
const SponsorDashboard    = lazy(() => import('./pages/SponsorDashboard'));
const DriverPortal        = lazy(() => import('./pages/DriverPortal'));
const EmployeePortal      = lazy(() => import('./pages/EmployeePortal'));
const ExecutiveCommandCenter = lazy(() => import('./pages/ExecutiveCommandCenter'));
const OwnerDashboard         = lazy(() => import('./pages/OwnerDashboard'));
const CashRegisterCenter     = lazy(() => import('./pages/CashRegisterCenter'));
const KitchenDisplaySystem   = lazy(() => import('./pages/KitchenDisplaySystem'));
const OnlineOrdering         = lazy(() => import('./pages/OnlineOrdering'));
// ── Online Ordering V2 ──────────────────────────────────────────────────────
const OnlineOrderingV2       = lazy(() => import('./pages/OnlineOrderingV2'));
const KitchenDashboardV2     = lazy(() => import('./pages/KitchenDashboardV2'));
const DriverDashboardV2      = lazy(() => import('./pages/DriverDashboardV2'));
const OrderManagementV2      = lazy(() => import('./pages/OrderManagementV2'));
const PromotionsV2           = lazy(() => import('./pages/PromotionsV2'));
const OrderAnalyticsV2       = lazy(() => import('./pages/OrderAnalyticsV2'));
const LoyaltyProgramV2       = lazy(() => import('./pages/LoyaltyProgramV2'));
const DriverManagement       = lazy(() => import('./pages/DriverManagement'));
const CustomerManagement     = lazy(() => import('./pages/CustomerManagement'));
const BranchCommandCenter    = lazy(() => import('./pages/BranchCommandCenter'));
const InventoryCommandCenter = lazy(() => import('./pages/InventoryCommandCenter'));
const RecipeFoodCosting      = lazy(() => import('./pages/RecipeFoodCosting'));
const SmartAlertCenter       = lazy(() => import('./pages/SmartAlertCenter'));
const AIBusinessCopilot      = lazy(() => import('./pages/AIBusinessCopilot'));
const BICenter               = lazy(() => import('./pages/BICenter'));
const ReservationTableManagement = lazy(() => import('./pages/ReservationTableManagement'));

const Sales               = lazy(() => import('./pages/Sales'));
const SalesInvoices       = lazy(() => import('./pages/SalesInvoices'));
const Purchases           = lazy(() => import('./pages/Purchases'));
const Expenses            = lazy(() => import('@/pages/Expenses'));
const Products            = lazy(() => import('@/pages/Products'));
const ProductManagement   = lazy(() => import('@/pages/ProductManagement'));
const Inventory           = lazy(() => import('@/pages/Inventory'));
const InventoryTransfer   = lazy(() => import('@/pages/InventoryTransfer'));
const InventoryWaste      = lazy(() => import('@/pages/InventoryWaste'));
const InventoryForecast   = lazy(() => import('@/pages/InventoryForecast'));
const Recipes             = lazy(() => import('@/pages/Recipes'));

const Suppliers           = lazy(() => import('@/pages/Suppliers'));
const PurchaseOrders      = lazy(() => import('@/pages/PurchaseOrders'));
const ProcurementDashboard = lazy(() => import('@/pages/ProcurementDashboard'));
const EnterprisePurchaseCommandCenter = lazy(() => import('@/pages/EnterprisePurchaseCommandCenter'));
const SupplierLedger      = lazy(() => import('@/pages/SupplierLedger'));

const Reports             = lazy(() => import('@/pages/Reports'));
const SalesDashboard      = lazy(() => import('@/pages/SalesDashboard'));
const ProfitLoss          = lazy(() => import('@/pages/ProfitLoss'));
const CashFlow            = lazy(() => import('@/pages/CashFlow'));
const PriceOptimization   = lazy(() => import('@/pages/PriceOptimization'));
const ActivityLogs        = lazy(() => import('@/pages/ActivityLogs'));
const ScheduledReports    = lazy(() => import('@/pages/ScheduledReports'));

const Employees           = lazy(() => import('@/pages/Employees'));
const EmployeeControl     = lazy(() => import('@/pages/EmployeeControl'));
const EmployeeAttendance  = lazy(() => import('@/pages/EmployeeAttendance'));
const Payroll             = lazy(() => import('@/pages/Payroll'));

const Treasury            = lazy(() => import('@/pages/Treasury'));
const SponsorTreasury     = lazy(() => import('@/pages/SponsorTreasury'));
const DebtManagement      = lazy(() => import('@/pages/DebtManagement'));
const NetworkManagement   = lazy(() => import('@/pages/NetworkManagement'));

const DeliveryOrders      = lazy(() => import('@/pages/DeliveryOrders'));
const MenuProducts        = lazy(() => import('@/pages/MenuProducts'));
const DriverSettlements   = lazy(() => import('@/pages/DriverSettlements'));
const CustomerPortal      = lazy(() => import('@/pages/CustomerPortal'));
const LoyaltyProgram      = lazy(() => import('@/pages/LoyaltyProgram'));
const AIRecommendations   = lazy(() => import('@/pages/AIRecommendations'));

const SettingsPage        = lazy(() => import('@/pages/SettingsPage'));
const BrandSettings       = lazy(() => import('@/pages/BrandSettings'));
const BranchManagement    = lazy(() => import('@/pages/BranchManagement'));
const RestaurantManager   = lazy(() => import('@/pages/RestaurantManager'));

const EnterpriseCategoryManager = lazy(() => import('@/components/categories/CategoryManager'));
const ApprovalPolicy      = lazy(() => import('@/pages/ApprovalPolicy'));
const SalesSources        = lazy(() => import('@/pages/SalesSources'));
const TelegramSettings    = lazy(() => import('@/pages/TelegramSettings'));
const Billing             = lazy(() => import('@/pages/Billing'));
const Support             = lazy(() => import('@/pages/Support'));
const SuperAdmin          = lazy(() => import('@/pages/SuperAdmin'));

const Tasks               = lazy(() => import('@/pages/Tasks'));
const Alerts              = lazy(() => import('@/pages/Alerts'));
const NotificationCenter  = lazy(() => import('@/pages/NotificationCenter'));
const StaffUpload         = lazy(() => import('@/pages/StaffUpload'));

const Onboarding          = lazy(() => import('@/pages/Onboarding'));

// ── Retail Mode Exclusive Modules ────────────────────────────────────────────
const BarcodeScanner      = lazy(() => import('@/pages/retail/BarcodeScanner'));
const SKUManagement       = lazy(() => import('@/pages/retail/SKUManagement'));
const ProductVariants     = lazy(() => import('@/pages/retail/ProductVariants'));
const BatchTracking       = lazy(() => import('@/pages/retail/BatchTracking'));
const ExpiryTracking      = lazy(() => import('@/pages/retail/ExpiryTracking'));
const SerialNumbers       = lazy(() => import('@/pages/retail/SerialNumbers'));

// ── Restaurant Mode Exclusive Modules ────────────────────────────────────────
const Production          = lazy(() => import('@/pages/Production'));

// ── Public pages (eager — shown before auth) ─────────────────────────────────
import LandingPage         from '@/pages/LandingPage';
import AuthPage            from '@/pages/AuthPage';
import InvitePage          from '@/pages/InvitePage';
import DriverInvitePage    from '@/pages/DriverInvitePage';
import EmployeeInvitePage  from '@/pages/EmployeeInvitePage';
import KitchenInvitePage   from '@/pages/KitchenInvitePage';

// ── Shared page loading fallback ─────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
  </div>
);

// ── Route-level error boundary ────────────────────────────────────────────────
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
            onClick={() => this.setState({ hasError: false })}
          >Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Onboarding gate ───────────────────────────────────────────────────────────
function OnboardingGate({ children }) {
  const { restaurants, loadingRestaurants } = useTenant();
  const { user } = useAuth();
  const location = window.location;

  if (loadingRestaurants) return null;

  const restrictedRole = [ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.DRIVER, ROLES.SPONSOR, ROLES.KITCHEN, ROLES.CUSTOMER].includes(user?.role);
  if (restrictedRole) return children;

  const isOwner = user?.role === ROLES.OWNER || !user?.role;
  const needsOnboarding = isOwner && restaurants.length === 0;
  const onOnboardingPage = location.pathname === '/onboarding';

  if (needsOnboarding && !onOnboardingPage) { window.location.replace('/onboarding'); return null; }
  if (!needsOnboarding && onOnboardingPage) { window.location.replace('/owner-command-center'); return null; }

  return children;
}

// ── Role-based home redirect ──────────────────────────────────────────────────
function RoleHomeRedirect() {
  const { role } = useRole();
  const { restaurants, loadingRestaurants } = useTenant();
  // Use ROLE_HOME directly — all roles now have explicit non-root paths
  const home = ROLE_HOME[role] || '/owner-command-center';

  React.useEffect(() => {
    if (loadingRestaurants) return;
    if (restaurants.length === 0) return;
    const currentPath = window.location.pathname;
    // Redirect from root or auth to the role's home page
    if (currentPath === '/' || currentPath === '/auth' || currentPath === '/dashboard') {
      window.location.replace(home);
    }
  }, [home, loadingRestaurants, restaurants.length]);
  return null;
}

// ── Subscribed routes (all protected pages) ───────────────────────────────────
const SubscribedRoutes = () => {
  const { isActive, loading } = useSubscription();
  const { loadingRestaurants } = useTenant();

  if (loading || loadingRestaurants) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding onComplete={() => window.location.replace('/owner-command-center')} />} />
          <Route element={<AppLayout />}>
            <Route path="/billing" element={<Billing />} />
          </Route>
          <Route path="*" element={<PaywallScreen />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <RouteErrorBoundary>
    <OnboardingGate>
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/onboarding" element={<Onboarding onComplete={() => window.location.replace('/owner-command-center')} />} />
      <Route element={<AppLayout />}>
        {/* ── Primary owner dashboard (canonical entry point) ── */}
        <Route path="/owner-command-center" element={<RoleGuard permission="viewDashboard"><OwnerDashboard /></RoleGuard>} />

        {/* ── Legacy dashboard (manager workspace + first-time owner) ── */}
        <Route path="/dashboard" element={<RoleGuard permission="viewDashboard"><Dashboard /></RoleGuard>} />

        {/* ── Executive analytics view ── */}
        <Route path="/executive-command-center" element={<RoleGuard permission="viewDashboard"><ExecutiveCommandCenter /></RoleGuard>} />

        <Route path="/staff-upload" element={<RoleGuard permission="uploadSales"><StaffUpload /></RoleGuard>} />

        {/* ── Core Operations ── */}
        <Route path="/sales" element={<RoleGuard permission="viewSales"><Sales /></RoleGuard>} />
        <Route path="/sales/invoices" element={<RoleGuard permission="viewSales"><SalesInvoices /></RoleGuard>} />
        <Route path="/purchases" element={<RoleGuard permission="viewPurchases"><Purchases /></RoleGuard>} />
        <Route path="/expenses" element={<RoleGuard permission="viewExpenses"><Expenses /></RoleGuard>} />

        {/* ── Procurement ── */}
        <Route path="/procurement-dashboard" element={<RoleGuard permission="viewPurchases"><ProcurementDashboard /></RoleGuard>} />
        <Route path="/enterprise-purchases" element={<RoleGuard permission="viewPurchases"><EnterprisePurchaseCommandCenter /></RoleGuard>} />
        <Route path="/supplier-ledger" element={<RoleGuard permission="viewSuppliers"><SupplierLedger /></RoleGuard>} />
        <Route path="/purchase-orders" element={<RoleGuard permission="viewSuppliers"><PurchaseOrders /></RoleGuard>} />
        <Route path="/suppliers" element={<RoleGuard permission="viewSuppliers"><Suppliers /></RoleGuard>} />

        {/* ── Inventory ── */}
        <Route path="/product-management" element={<RoleGuard permission="viewInventory"><ProductManagement /></RoleGuard>} />
        <Route path="/products" element={<RoleGuard permission="viewInventory"><Products /></RoleGuard>} />
        <Route path="/inventory" element={<RoleGuard permission="viewInventory"><Inventory /></RoleGuard>} />
        <Route path="/inventory-transfers" element={<RoleGuard permission="viewInventory"><InventoryTransfer /></RoleGuard>} />
        <Route path="/inventory-waste" element={<RoleGuard permission="viewInventory"><InventoryWaste /></RoleGuard>} />
        <Route path="/inventory-forecast" element={<InventoryForecast />} />
        <Route path="/recipes" element={<RoleGuard permission="viewInventory"><Recipes /></RoleGuard>} />

        {/* ── Analytics & Reports ── */}
        <Route path="/reports" element={<RoleGuard permission="viewReports"><Reports /></RoleGuard>} />
        <Route path="/sales-dashboard" element={<RoleGuard permission="viewReports"><SalesDashboard /></RoleGuard>} />
        <Route path="/profit-loss" element={<RoleGuard permission="viewReports"><ProfitLoss /></RoleGuard>} />
        <Route path="/cashflow" element={<RoleGuard permission="viewReports"><CashFlow /></RoleGuard>} />
        <Route path="/price-optimization" element={<RoleGuard permission="viewReports"><PriceOptimization /></RoleGuard>} />
        <Route path="/activity-logs" element={<RoleGuard permission="viewActivityLogs"><ActivityLogs /></RoleGuard>} />
        <Route path="/scheduled-reports" element={<RoleGuard permission="exportPDF"><ScheduledReports /></RoleGuard>} />

        {/* ── People ── */}
        <Route path="/employees" element={<RoleGuard permission="viewEmployees"><Employees /></RoleGuard>} />
        <Route path="/employee-control" element={<RoleGuard permission="viewEmployeeControl"><EmployeeControl /></RoleGuard>} />
        <Route path="/employee-attendance" element={<RoleGuard permission="recordAttendance"><EmployeeAttendance /></RoleGuard>} />
        <Route path="/staff-attendance" element={<RoleGuard permission="viewStaffAttendance"><EmployeeAttendance /></RoleGuard>} />
        <Route path="/payroll" element={<RoleGuard permission="viewPayroll"><Payroll /></RoleGuard>} />

        {/* ── Finance ── */}
        <Route path="/treasury" element={<RoleGuard permission="viewTreasury"><Treasury /></RoleGuard>} />
        <Route path="/sponsor-treasury" element={<RoleGuard permission="viewSponsorTreasury"><SponsorTreasury /></RoleGuard>} />
        <Route path="/debts" element={<RoleGuard permission="viewDebts"><DebtManagement /></RoleGuard>} />
        <Route path="/debt-management" element={<RoleGuard permission="viewDebts"><DebtManagement /></RoleGuard>} />
        <Route path="/network-management" element={<RoleGuard permission="viewNetworkAccounts"><NetworkManagement /></RoleGuard>} />
        {/* Legacy redirects */}
        <Route path="/network-accounts" element={<RoleGuard permission="viewNetworkAccounts"><NetworkManagement /></RoleGuard>} />
        <Route path="/network-analytics" element={<RoleGuard permission="viewNetworkAccounts"><NetworkManagement /></RoleGuard>} />
        <Route path="/network-hub" element={<RoleGuard permission="viewDashboard"><NetworkManagement /></RoleGuard>} />

        {/* ── Delivery ── */}
        <Route path="/delivery" element={<RoleGuard permission="viewDelivery"><DeliveryOrders /></RoleGuard>} />
        <Route path="/menu-products" element={<RoleGuard permission="viewDelivery"><MenuProducts /></RoleGuard>} />
        <Route path="/driver-settlements" element={<RoleGuard permission="viewDelivery"><DriverSettlements /></RoleGuard>} />

        {/* ── Configuration ── */}
        <Route path="/settings" element={<RoleGuard permission="manageSettings"><SettingsPage /></RoleGuard>} />
        <Route path="/brand" element={<RoleGuard permission="viewBrandSettings"><BrandSettings /></RoleGuard>} />
        <Route path="/restaurants" element={<RoleGuard permission="viewBrandSettings"><RestaurantManager /></RoleGuard>} />
        <Route path="/branch-management" element={<RoleGuard permission="viewBrandSettings"><BranchManagement /></RoleGuard>} />

        <Route path="/approval-policy" element={<RoleGuard permission="viewBrandSettings"><ApprovalPolicy /></RoleGuard>} />
        <Route path="/sales-sources" element={<RoleGuard permission="viewBrandSettings"><SalesSources /></RoleGuard>} />
        <Route path="/telegram-settings" element={<RoleGuard permission="viewBrandSettings"><TelegramSettings /></RoleGuard>} />
        <Route path="/billing" element={<RoleGuard permission="viewBilling"><Billing /></RoleGuard>} />
        <Route path="/notifications" element={<RoleGuard permission="viewAlerts"><NotificationCenter /></RoleGuard>} />
        <Route path="/alerts" element={<RoleGuard permission="viewAlerts"><Alerts /></RoleGuard>} />
        <Route path="/tasks" element={<RoleGuard permission="viewTasks"><Tasks /></RoleGuard>} />
        <Route path="/support" element={<Support />} />
        <Route path="/super-admin" element={<SuperAdmin />} />

        {/* ── Role-specific portals ── */}
        <Route path="/manager-dashboard" element={<RoleGuard permission="viewDashboard"><Dashboard /></RoleGuard>} />
        <Route path="/employee-dashboard" element={<EmployeePortal />} />
        <Route path="/driver-dashboard" element={<DriverPortal />} />
        <Route path="/sponsor-dashboard" element={<SponsorDashboard />} />
        <Route path="/kitchen-dashboard" element={<KitchenDashboard />} />
        <Route path="/customer-dashboard" element={<CustomerDashboard />} />

        {/* ── Enterprise Modules ── */}
        <Route path="/cash-register" element={<RoleGuard permission="viewSales"><CashRegisterCenter /></RoleGuard>} />
        <Route path="/kds" element={<RoleGuard permission="viewSales"><KitchenDisplaySystem /></RoleGuard>} />
        <Route path="/online-ordering" element={<RoleGuard permission="viewSales"><OnlineOrdering /></RoleGuard>} />

        {/* ── Online Ordering V2 ── */}
        <Route path="/order" element={<OnlineOrderingV2 />} />
        <Route path="/order/:branchSlug" element={<OnlineOrderingV2 />} />
        <Route path="/order/track/:orderId" element={<OnlineOrderingV2 />} />
        <Route path="/kitchen-v2" element={<KitchenDashboardV2 />} />
        <Route path="/driver-v2" element={<DriverDashboardV2 />} />
        <Route path="/order-management" element={<RoleGuard permission="viewSales"><OrderManagementV2 /></RoleGuard>} />
        <Route path="/promotions" element={<RoleGuard permission="viewSales"><PromotionsV2 /></RoleGuard>} />
        <Route path="/order-analytics" element={<RoleGuard permission="viewReports"><OrderAnalyticsV2 /></RoleGuard>} />
        <Route path="/loyalty-v2" element={<RoleGuard permission="viewDebts"><LoyaltyProgramV2 /></RoleGuard>} />
        <Route path="/driver-management" element={<RoleGuard permission="viewEmployees"><DriverManagement /></RoleGuard>} />
        <Route path="/customer-management" element={<RoleGuard permission="viewDebts"><CustomerManagement /></RoleGuard>} />
        <Route path="/branch-command-center" element={<RoleGuard permission="viewDashboard"><BranchCommandCenter /></RoleGuard>} />
        <Route path="/inventory-command-center" element={<RoleGuard permission="viewInventory"><InventoryCommandCenter /></RoleGuard>} />
        <Route path="/recipe-food-costing" element={<RoleGuard permission="viewInventory"><RecipeFoodCosting /></RoleGuard>} />
        <Route path="/smart-alerts" element={<RoleGuard permission="viewAlerts"><SmartAlertCenter /></RoleGuard>} />
        <Route path="/ai-copilot" element={<RoleGuard permission="viewDashboard"><AIBusinessCopilot /></RoleGuard>} />
        <Route path="/bi-center" element={<RoleGuard permission="viewReports"><BICenter /></RoleGuard>} />
        <Route path="/reservations" element={<RoleGuard permission="viewSales"><ReservationTableManagement /></RoleGuard>} />
        <Route path="/customer-portal" element={<CustomerPortal />} />
        <Route path="/loyalty-program" element={<RoleGuard permission="viewDebts"><LoyaltyProgram /></RoleGuard>} />
        <Route path="/ai-recommendations" element={<AIRecommendations />} />

        {/* ── Short aliases ── */}
        <Route path="/employee" element={<EmployeePortal />} />
        <Route path="/driver" element={<DriverPortal />} />
        <Route path="/kitchen" element={<KitchenDashboard />} />
        <Route path="/customer" element={<CustomerDashboard />} />

        {/* ══════════════════════════════════════════════════════════════════════
            RETAIL MODE EXCLUSIVE ROUTES
            These routes are accessible to all authenticated users but the pages
            themselves enforce Retail Mode via useBusinessMode() guard.
        ══════════════════════════════════════════════════════════════════════ */}
        <Route path="/retail/barcode"  element={<RoleGuard permission="viewInventory"><BarcodeScanner /></RoleGuard>} />
        <Route path="/retail/sku"      element={<RoleGuard permission="viewInventory"><SKUManagement /></RoleGuard>} />
        <Route path="/retail/variants" element={<RoleGuard permission="viewInventory"><ProductVariants /></RoleGuard>} />
        <Route path="/retail/batches"  element={<RoleGuard permission="viewInventory"><BatchTracking /></RoleGuard>} />
        <Route path="/retail/expiry"   element={<RoleGuard permission="viewInventory"><ExpiryTracking /></RoleGuard>} />
        <Route path="/retail/serials"  element={<RoleGuard permission="viewInventory"><SerialNumbers /></RoleGuard>} />

        {/* ══════════════════════════════════════════════════════════════════════
            RESTAURANT MODE EXCLUSIVE ROUTES
            Pages enforce Restaurant Mode via useBusinessMode() guard.
        ══════════════════════════════════════════════════════════════════════ */}
        <Route path="/production"      element={<RoleGuard permission="viewInventory"><Production /></RoleGuard>} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
    </OnboardingGate>
    </RouteErrorBoundary>
  );
};

// ── Manager role applier (invite token safety net) ────────────────────────────
function ManagerRoleApplier() {
  const { user } = useAuth();
  React.useEffect(() => {
    if (!user?.email) return;
    const safeRoles = new Set(['user', ROLES.OWNER, null, undefined, '']);
    if (!safeRoles.has(user.role)) return;
    const pendingToken =
      sessionStorage.getItem('pending_invite_token') ||
      localStorage.getItem('pending_invite_token') ||
      sessionStorage.getItem('pending_kitchen_invite_token') ||
      localStorage.getItem('pending_kitchen_invite_token');
    if (!pendingToken) return;
    sessionStorage.removeItem('pending_invite_token');
    localStorage.removeItem('pending_invite_token');
    localStorage.removeItem('pending_invite_return_url');
    base44.functions.invoke('acceptInvite', { token: pendingToken })
      .then(res => { if (res?.data?.success) window.location.reload(); })
      .catch(e => console.warn('[ManagerRoleApplier]', e));
  }, [user?.email, user?.role]);
  return null;
}

// ── Authenticated app shell ───────────────────────────────────────────────────
const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, navigateToLogin } = useAuth();
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, []);

  const noUser = !isLoadingAuth && !useAuth().user && !useAuth().authError;
  if (noUser) { navigateToLogin(); return null; }

  if (isLoadingAuth && timedOut) {
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

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <SubscriptionProvider>
      <RoleProvider>
        <TenantProvider>
          <BusinessModeProvider>
            <NotificationProvider>
              <ManagerRoleApplier />
              <RoleHomeRedirect />
              <SubscribedRoutes />
            </NotificationProvider>
          </BusinessModeProvider>
        </TenantProvider>
      </RoleProvider>
    </SubscriptionProvider>
  );
};

// ── Root app ──────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <LanguageProvider>
        <Router>
          <AuthProvider>
            <Routes>
              {/* Public routes — no auth required */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/invite" element={<InvitePage />} />
              <Route path="/manager-invite" element={<InvitePage />} />
              <Route path="/auth/invite" element={<InvitePage />} />
              <Route path="/auth/manager-login" element={<InvitePage />} />
              <Route path="/auth/activate" element={<InvitePage />} />
              <Route path="/driver-invite" element={<DriverInvitePage />} />
              <Route path="/auth/driver-login" element={<DriverInvitePage />} />
              <Route path="/employee-invite" element={<EmployeeInvitePage />} />
              <Route path="/auth/employee-login" element={<EmployeeInvitePage />} />
              <Route path="/kitchen-invite" element={<KitchenInvitePage />} />
              {/* All authenticated routes */}
              <Route path="*" element={<AuthenticatedApp />} />
            </Routes>
            <Toaster />
          </AuthProvider>
        </Router>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
