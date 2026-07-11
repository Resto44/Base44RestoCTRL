/**
 * OwnerDashboard — Next Generation Executive Dashboard
 *
 * Architecture: Modular, component-based widgets, real-time calculations,
 * lazy loading, memoized calculations, responsive mobile-first layout,
 * skeleton loading, error boundaries, optimistic updates.
 *
 * BUSINESS RULES (NEVER MODIFY):
 *   Sales Revenue must NEVER be modified.
 *   Purchases must NEVER modify Sales.
 *   Operating Result = Sales − Approved Purchases.
 *   Cash Shortage is NOT Sales. Cash Shortage is NOT Profit.
 *   Cash Shortage must create Owner Capital Contribution only.
 *   Dashboard values must always be calculated from database records.
 *   No manual calculations. No duplicated logic. Single source of truth.
 *
 * SECTIONS:
 *   0. Branch Selector  (NEW — always at top)
 *   1. Executive Summary
 *   2. Operating Result  (NEVER REMOVE)
 *   3. Cash Reconciliation
 *   4. Sales Analytics
 *   5. Purchase Analytics
 *   6. Inventory Analytics
 *   7. Cash Flow
 *   8. Product Price Intelligence
 *   9. Alerts
 */
import React, { useState, useMemo, useCallback, memo } from 'react';
import { useBusinessMode } from '@/lib/BusinessModeContext';
import ModeBadge from '@/components/shared/ModeBadge';
import { ModeSpecificDashboardSection } from '@/components/dashboard/DashboardWidgetRegistry';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { useNetworkSettlement } from '@/hooks/useNetworkSettlement';
import { useNotify } from '@/lib/useNotify';
import { getSaleCash, getSaleNetwork, calculateSalesRevenue, computeDashboardMetrics, computeProductQuantityAnalytics } from '@/lib/helpers';
import { computeAdditionalSources } from '@/services/salesAnalyticsEngine';
import { useSalesSources } from '@/hooks/useSalesSources';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
// SalesForm removed to enforce single ERP workspace entry point
import PriceChangesWidget from '@/components/dashboard/PriceChangesWidget';
import { toast } from 'sonner';
import {
  generateSalesInvoiceNumber,
  createSalesInvoice,
  generateAndUploadPDF,
} from '@/lib/salesInvoiceService';
import { computeProcurementKPIs, getOverdueInfo } from '@/lib/procurementEngine';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package,
  Users, Truck, AlertTriangle, Wifi, Plus, CreditCard, Wallet,
  Receipt, Banknote, ArrowDownLeft, BarChart3,
  PackagePlus, ArrowLeftRight, FileText, ShoppingBag, Activity,
  Scale, Target, Zap, ChevronRight, ArrowUpRight, ArrowDownRight,
  CheckCircle2, XCircle, AlertCircle,
  LayoutDashboard, Layers, Clock, MapPin, Globe, ChevronDown,
  Building2,
} from 'lucide-react';
import {
  format, startOfMonth, startOfWeek, startOfYear,
  subDays, subWeeks, subMonths, getDaysInMonth,
} from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonCard = memo(() => (
  <Card className="border border-border/50">
    <CardContent className="p-4">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-7 w-32 mb-1" />
      <Skeleton className="h-3 w-20" />
    </CardContent>
  </Card>
));

const SectionHeader = memo(({ icon: Icon, title, subtitle, action, color = 'blue' }) => {
  const colorMap = {
    blue:   'bg-blue-100 dark:bg-blue-900/40 text-blue-600',
    green:  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600',
    amber:  'bg-amber-100 dark:bg-amber-900/40 text-amber-600',
    red:    'bg-red-100 dark:bg-red-900/40 text-red-600',
    purple: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600',
    cyan:   'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600',
    orange: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600',
    slate:  'bg-slate-100 dark:bg-slate-800 text-slate-600',
  };
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color] || colorMap.blue}`}>
          {Icon && <Icon className="w-4 h-4" />}
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground leading-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground leading-tight">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <button onClick={action.onClick} className="flex items-center gap-1 text-xs text-primary hover:underline">
          {action.label} <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
});

const MetricCard = memo(({
  title, value, subtitle, icon: Icon, color = 'blue',
  onClick, trend, trendLabel, large = false,
}) => {
  const colorMap = {
    blue:   { bg: 'bg-blue-50 dark:bg-blue-950/50',     icon: 'text-blue-600',    border: 'border-blue-100 dark:border-blue-900/60',    val: 'text-blue-700 dark:text-blue-400' },
    green:  { bg: 'bg-emerald-50 dark:bg-emerald-950/50', icon: 'text-emerald-600', border: 'border-emerald-100 dark:border-emerald-900/60', val: 'text-emerald-700 dark:text-emerald-400' },
    amber:  { bg: 'bg-amber-50 dark:bg-amber-950/50',   icon: 'text-amber-600',   border: 'border-amber-100 dark:border-amber-900/60',   val: 'text-amber-700 dark:text-amber-400' },
    red:    { bg: 'bg-red-50 dark:bg-red-950/50',       icon: 'text-red-600',     border: 'border-red-100 dark:border-red-900/60',      val: 'text-red-700 dark:text-red-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950/50', icon: 'text-purple-600',  border: 'border-purple-100 dark:border-purple-900/60', val: 'text-purple-700 dark:text-purple-400' },
    cyan:   { bg: 'bg-cyan-50 dark:bg-cyan-950/50',     icon: 'text-cyan-600',    border: 'border-cyan-100 dark:border-cyan-900/60',    val: 'text-cyan-700 dark:text-cyan-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-950/50', icon: 'text-orange-600',  border: 'border-orange-100 dark:border-orange-900/60', val: 'text-orange-700 dark:text-orange-400' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/50', icon: 'text-indigo-600',  border: 'border-indigo-100 dark:border-indigo-900/60', val: 'text-indigo-700 dark:text-indigo-400' },
    slate:  { bg: 'bg-slate-50 dark:bg-slate-900/50',   icon: 'text-slate-600',   border: 'border-slate-200 dark:border-slate-700',     val: 'text-slate-700 dark:text-slate-300' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <Card
      className={`border ${c.border} ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.98]' : ''} transition-all duration-200`}
      onClick={onClick}
    >
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between mb-2">
          <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${c.icon}`} />
          </div>
          {trend !== undefined && (
            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
        <p className={`font-black leading-tight ${large ? 'text-xl' : 'text-lg'} ${c.val}`}>{value}</p>
        <p className="text-[11px] font-medium text-muted-foreground mt-0.5 leading-tight">{title}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">{subtitle}</p>}
        {trendLabel && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{trendLabel}</p>}
      </CardContent>
    </Card>
  );
});

const LedgerRow = memo(({ label, value, color = 'default', bold = false, separator = false }) => {
  const colorMap = {
    default: 'text-foreground',
    green:   'text-emerald-600 dark:text-emerald-400',
    red:     'text-red-600 dark:text-red-400',
    amber:   'text-amber-600 dark:text-amber-400',
    blue:    'text-blue-600 dark:text-blue-400',
    purple:  'text-purple-600 dark:text-purple-400',
    muted:   'text-muted-foreground',
  };
  return (
    <>
      {separator && <div className="border-t border-border/60 my-1.5" />}
      <div className={`flex items-center justify-between py-1.5 px-1 rounded ${bold ? 'bg-muted/30' : ''}`}>
        <span className={`text-xs ${bold ? 'font-semibold' : 'font-medium'} text-muted-foreground`}>{label}</span>
        <span className={`text-sm ${bold ? 'font-black' : 'font-semibold'} ${colorMap[color]}`}>{value}</span>
      </div>
    </>
  );
});

const AlertRow = memo(({ icon: Icon, title, count, severity = 'amber', onClick }) => {
  const severityMap = {
    critical: { bg: 'bg-red-50 dark:bg-red-950/40',    border: 'border-red-200 dark:border-red-800',    icon: 'text-red-600',    badge: 'bg-red-500' },
    high:     { bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800', icon: 'text-orange-600', badge: 'bg-orange-500' },
    amber:    { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-600',  badge: 'bg-amber-500' },
    blue:     { bg: 'bg-blue-50 dark:bg-blue-950/40',   border: 'border-blue-200 dark:border-blue-800',  icon: 'text-blue-600',   badge: 'bg-blue-500' },
    green:    { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', icon: 'text-emerald-600', badge: 'bg-emerald-500' },
  };
  const s = severityMap[severity] || severityMap.amber;
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border ${s.border} ${s.bg} ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''} transition-all`}
      onClick={onClick}
    >
      <Icon className={`w-4 h-4 shrink-0 ${s.icon}`} />
      <span className="flex-1 text-xs font-medium text-foreground leading-tight">{title}</span>
      <span className={`text-white text-xs font-bold rounded-full px-2.5 py-0.5 ${s.badge} shrink-0 min-w-[24px] text-center`}>{count}</span>
    </div>
  );
});



// ─────────────────────────────────────────────────────────────────────────────
// BRANCH SELECTOR COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const BranchSelector = memo(({ branches, selectedBranch, onSelect }) => {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (selectedBranch === 'all') return 'All Branches';
    const b =  (branches || []).find(br => (br.key || br.id) === selectedBranch);
    return b ? (b.name || b.key || selectedBranch) : selectedBranch;
  }, [selectedBranch, branches]);

  const isAll = selectedBranch === 'all';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] transition-all"
      >
        <div className="flex items-center gap-2">
          {isAll
            ? <Globe className="w-4 h-4 text-primary shrink-0" />
            : <MapPin className="w-4 h-4 text-primary shrink-0" />
          }
          <div className="text-left">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Selected Branch</p>
            <p className="text-sm font-bold text-foreground leading-tight">{selectedLabel}</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-background border border-border rounded-xl shadow-xl overflow-hidden">
          {/* All Branches option */}
          <button
            className={`w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/60 transition-colors ${selectedBranch === 'all' ? 'bg-primary/10' : ''}`}
            onClick={() => { onSelect('all'); setOpen(false); }}
          >
            <Globe className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">All Branches</p>
              <p className="text-[10px] text-muted-foreground">Aggregate data from every branch</p>
            </div>
            {selectedBranch === 'all' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0" />}
          </button>

          {/* Divider */}
          { (branches || []).length > 0 && <div className="border-t border-border/60 mx-3" />}

          {/* Individual branches */}
          { (branches || []).map((br) => {
            const key = br.key || br.id;
            const name = br.name || br.key || key;
            const isSelected = selectedBranch === key;
            return (
              <button
                key={key}
                className={`w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/60 transition-colors ${isSelected ? 'bg-primary/10' : ''}`}
                onClick={() => { onSelect(key); setOpen(false); }}
              >
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{name}</p>
                  {br.address && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{br.address}</p>}
                </div>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0" />}
              </button>
            );
          })}

          { (branches || []).length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground">No branches configured.</div>
          )}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────
class WidgetErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/30">
          <CardContent className="p-4 flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-xs font-medium">Widget failed to load. Please refresh.</span>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export default function OwnerDashboard() {
  const { t, currency } = useLanguage();
  const { branches, ownerFilter, orgId, activeRestaurant } = useTenant();
  const { role } = useRole();
  const { user } = useAuth();
  const navigate = useNavigate();
  const notif = useNotify();
  const qc = useQueryClient();
  const { autoSettle } = useNetworkSettlement({ orgId, user, currency });
  const { revenueSources } = useSalesSources();

  // ── BRANCH SELECTION STATE ────────────────────────────────────────────────
  // 'all' means aggregate all branches; any other value is a branch key/id
  const [selectedBranch, setSelectedBranch] = useState('all');

  // Build the effective filter: owner-scoped + optional branch filter
  // When 'all' is selected: use ownerFilter as-is (all branches)
  // When a branch is selected: add branch key to the filter
  const branchFilter = useMemo(() => {
    if (!activeRestaurant?.id) return null;
    const baseFilter = { restaurant_id: activeRestaurant.id };
    if (selectedBranch === 'all') return baseFilter;
    // Map internal branch ID to the 'branch' text field in daily_sales
    const branchObj = (branches || []).find(b => (b.key || b.id) === selectedBranch);
    const branchKey = branchObj?.key || selectedBranch;
    return { ...baseFilter, branch: branchKey };
  }, [activeRestaurant, selectedBranch, branches]);

  // EXPENSE-SPECIFIC branch filter: expenses table uses 'branch_key' (not 'branch')
  // This is the root cause fix for Task 1 — DO NOT merge with branchFilter
  const expenseBranchFilter = useMemo(() => {
    if (!activeRestaurant?.id) return null;
    const baseFilter = { restaurant_id: activeRestaurant.id };
    if (selectedBranch === 'all') return baseFilter;
    const branchObj = (branches || []).find(b => (b.key || b.id) === selectedBranch);
    const branchKey = branchObj?.key || selectedBranch;
    return { ...baseFilter, branch_key: branchKey };
  }, [activeRestaurant, selectedBranch, branches]);

  // Branch display info for the badge
  const selectedBranchLabel = useMemo(() => {
    if (selectedBranch === 'all') return 'All Branches';
    const b =  (branches || []).find(br => (br.key || br.id) === selectedBranch);
    return b ? (b.name || b.key || selectedBranch) : selectedBranch;
  }, [selectedBranch, branches]);

  const today       = format(new Date(), 'yyyy-MM-dd');
  const yesterday   = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const weekStart   = format(startOfWeek(new Date(), { weekStartsOn: 6 }), 'yyyy-MM-dd');
  const monthStart  = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const yearStart   = format(startOfYear(new Date()), 'yyyy-MM-dd');
  const prevWeekStart  = format(subWeeks(new Date(), 1), 'yyyy-MM-dd');
  const prevMonthStart = format(subMonths(new Date(), 1), 'yyyy-MM-dd');

  const enabled = !!(activeRestaurant?.id);

  const fmt = useCallback((n) =>
    `${currency}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, [currency]);
  const fmtPct = useCallback((n) =>
    `${n >= 0 ? '+' : ''}${(n || 0).toFixed(1)}%`, []);

  // ── DATA QUERIES — all use branchFilter + selectedBranch in queryKey ──────
  // This ensures React Query invalidates and refetches when branch changes.

  const { data: todaySales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['sales_today', branchFilter, today, selectedBranch],
    queryFn: () => base44.entities.DailySales.filter({ ...(branchFilter || {}), date: today }, '-date', 100),
    staleTime: 15000,
    enabled,
  });

  const { data: yesterdaySales = [] } = useQuery({
    queryKey: ['sales_yesterday', branchFilter, yesterday, selectedBranch],
    queryFn: () => base44.entities.DailySales.filter({ ...(branchFilter || {}), date: yesterday }, '-date', 100),
    staleTime: 60000,
    enabled,
  });

  const { data: weekSales = [] } = useQuery({
    queryKey: ['sales_week', branchFilter, weekStart, selectedBranch],
    queryFn: () => base44.entities.DailySales.filter(branchFilter || {}, '-date', 500),
    staleTime: 60000,
    enabled,
    select: (d) => d.filter(s => s.date >= weekStart),
  });

  const { data: monthSales = [] } = useQuery({
    queryKey: ['sales_month', branchFilter, monthStart, selectedBranch],
    queryFn: () => base44.entities.DailySales.filter(branchFilter || {}, '-date', 1000),
    staleTime: 60000,
    enabled,
    select: (d) => d.filter(s => s.date >= monthStart),
  });

  const { data: yearSales = [] } = useQuery({
    queryKey: ['sales_year', branchFilter, yearStart, selectedBranch],
    queryFn: () => base44.entities.DailySales.filter(branchFilter || {}, '-date', 5000),
    staleTime: 120000,
    enabled,
    select: (d) => d.filter(s => s.date >= yearStart),
  });

  const { data: prevWeekSales = [] } = useQuery({
    queryKey: ['sales_prev_week', branchFilter, prevWeekStart, weekStart, selectedBranch],
    queryFn: () => base44.entities.DailySales.filter(branchFilter || {}, '-date', 500),
    staleTime: 120000,
    enabled,
    select: (d) => d.filter(s => s.date >= prevWeekStart && s.date < weekStart),
  });

  const { data: prevMonthSales = [] } = useQuery({
    queryKey: ['sales_prev_month', branchFilter, prevMonthStart, monthStart, selectedBranch],
    queryFn: () => base44.entities.DailySales.filter(branchFilter || {}, '-date', 1000),
    staleTime: 120000,
    enabled,
    select: (d) => d.filter(s => s.date >= prevMonthStart && s.date < monthStart),
  });

  const { data: weekPurchases = [] } = useQuery({
    queryKey: ['purchases_week', branchFilter, weekStart, selectedBranch],
    queryFn: () => base44.entities.Purchase.filter(branchFilter || {}, '-date', 500),
    staleTime: 60000,
    enabled,
    select: (d) => d.filter(p => p.date >= weekStart),
  });

  const { data: monthPurchases = [] } = useQuery({
    queryKey: ['purchases_month', branchFilter, monthStart, selectedBranch],
    queryFn: () => base44.entities.Purchase.filter(branchFilter || {}, '-date', 1000),
    staleTime: 60000,
    enabled,
    select: (d) => d.filter(p => p.date >= monthStart),
  });

  const { data: todayExpenses = [] } = useQuery({
    queryKey: ['expenses_today', expenseBranchFilter, today, selectedBranch],
    queryFn: () => base44.entities.Expense.filter({ ...(expenseBranchFilter || {}), date: today }, '-date', 200),
    staleTime: 15000,
    enabled,
  });

  const { data: monthExpenses = [] } = useQuery({
    queryKey: ['expenses_month', expenseBranchFilter, monthStart, selectedBranch],
    queryFn: () => base44.entities.Expense.filter(expenseBranchFilter || {}, '-date', 500),
    staleTime: 60000,
    enabled,
    select: (d) => d.filter(e => e.date >= monthStart),
  });

  // Previous month expenses — needed for Product Consumption Analytics
  const { data: prevMonthExpenses = [] } = useQuery({
    queryKey: ['expenses_prev_month', expenseBranchFilter, prevMonthStart, monthStart, selectedBranch],
    queryFn: () => base44.entities.Expense.filter(expenseBranchFilter || {}, '-date', 500),
    staleTime: 120000,
    enabled,
    select: (d) => d.filter(e => e.date >= prevMonthStart && e.date < monthStart),
  });

  // Expense categories — needed to tag fixed vs variable expenses
  // IMPORTANT: filter by restaurant_id to avoid cross-restaurant category pollution
  const { data: expenseCategories = [] } = useQuery({
    queryKey: ['expense_categories_dash', activeRestaurant?.id],
    queryFn: () => base44.entities.ExpenseCategory
      ? base44.entities.ExpenseCategory.filter(
          activeRestaurant?.id ? { restaurant_id: activeRestaurant.id } : {},
          'sort_order', 500
        )
      : Promise.resolve([]),
    staleTime: 300000,
    enabled,
  });

  const { data: supplierInvoices = [] } = useQuery({
    queryKey: ['supplier_invoices', ownerFilter],
    queryFn: async () => {
      let q = supabase.from('supplier_invoices').select('*').order('date', { ascending: false }).limit(5000);
      if (ownerFilter?.created_by) q = q.eq('created_by', ownerFilter.created_by);
      const { data, error } = await q;
      if (error) { console.warn('[OwnerDashboard] supplier_invoices fetch error:', error.message); return []; }
      return data || [];
    },
    staleTime: 15000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  const { data: customerDebts = [] } = useQuery({
    queryKey: ['debts_customer_dash', branchFilter, selectedBranch],
    queryFn: () => base44.entities.DebtRecord.filter(
      { ...(branchFilter || {}), type: 'receivable', party_type: 'customer' },
      '-date', 500
    ),
    staleTime: 30000,
    enabled,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory_dash', branchFilter, selectedBranch],
    queryFn: () => base44.entities.Inventory.filter(branchFilter || {}, 'product_name', 500),
    staleTime: 60000,
    enabled,
  });

  const { data: networkAccounts = [] } = useQuery({
    queryKey: ['network_accounts_dash', branchFilter, selectedBranch],
    queryFn: () => base44.entities.NetworkAccount.filter(branchFilter || {}),
    staleTime: 120000,
    enabled,
  });

  const { data: walletTransactions = [] } = useQuery({
    queryKey: ['wallet_transactions_dash', branchFilter, selectedBranch],
    queryFn: () => base44.entities.WalletTransaction.filter(branchFilter || {}, '-transaction_date', 1000),
    staleTime: 30000,
    enabled,
  });

  const { data: todayInvoices = [] } = useQuery({
    queryKey: ['sales_invoices_today', branchFilter, today, selectedBranch],
    queryFn: () => base44.entities.SalesInvoice
      ? base44.entities.SalesInvoice.filter({ ...(branchFilter || {}), sale_date: today }, '-created_date', 100)
      : Promise.resolve([]),
    staleTime: 15000,
    enabled,
  });

  const { data: priceHistory = [] } = useQuery({
    queryKey: ['price_history_dash', user?.email || ownerFilter?.created_by],
    queryFn: async () => {
      const createdBy = user?.email || ownerFilter?.created_by;
      if (!createdBy) return [];
      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('product_price_history')
        .select('*')
        .eq('created_by', createdBy)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: false })
        .limit(50);
      if (error) { console.warn('price history error:', error.message); return []; }
      return data || [];
    },
    staleTime: 60000,
    enabled: !!(user?.email || ownerFilter?.created_by),
  });

  // ── MEMOIZED CALCULATIONS ─────────────────────────────────────────────────────

  const sumSales = useCallback((arr) =>
     (arr || []).reduce((s, r) => s + (calculateSalesRevenue(r, revenueSources)?.total || 0), 0), [revenueSources]);

  const sumPurchaseCost = useCallback((arr) =>
     (arr || []).reduce((s, p) => s + ((p.qty || 0) * (p.used_price || p.current_price || 0)), 0), []);

  // ── Section 1: Executive Summary ──────────────────────────────────────────────
  const execSummary = useMemo(() => {
    const todayRevenue = (todaySales || []).reduce((acc, r) => {
      const rev = calculateSalesRevenue(r, revenueSources);
      return {
        cash: acc.cash + rev.cash,
        network: acc.network + rev.network,
        credit: acc.credit + rev.credit,
        custom: acc.custom + rev.customSources,
        total: acc.total + rev.total
      };
    }, { cash: 0, network: 0, credit: 0, custom: 0, total: 0 });

    const cashSalesToday = todayRevenue.cash;
    const networkSalesToday = todayRevenue.network;
    const creditSalesToday = todayRevenue.credit;
    const customSalesToday = todayRevenue.custom;
    const salesToday = todayRevenue.total;

    // Today's Purchases = approved supplier invoices for today (filtered by branch)
    const branchObj = (branches || []).find(b => (b.key || b.id) === selectedBranch);
    const branchKey = branchObj?.key || selectedBranch;

    const purchasesToday = supplierInvoices
      .filter(inv => {
        const isApproved = ['approved', 'auto_approved'].includes(inv.approval_status) || ['approved', 'paid', 'partial', 'unpaid'].includes(inv.status) || !inv.approval_status;
        const isToday = inv.date === today;
        const isBranchMatch = selectedBranch === 'all' || inv.branch === branchKey;
        return isApproved && isToday && isBranchMatch;
      })
      .reduce((s, inv) => s + (Number(inv.total_amount || inv.amount) || 0), 0);

    // ── EXPENSE SEPARATION: Fixed Monthly vs Daily Operating ──────────────────
    // Build category lookup map
    const catMap = {};
    (expenseCategories || []).forEach(c => { catMap[c.id] = c; });

    const realDaysInMonth = getDaysInMonth(new Date());

    // FIXED MONTHLY EXPENSES: sourced from monthExpenses (rent/salary entered once per month)
    // Tag month expenses with _is_fixed flag
    const taggedMonthExpenses = (monthExpenses || []).map(e => ({
      ...e,
      _is_fixed: !!(catMap[e.category_id]?.is_fixed || catMap[e.expense_category_id]?.is_fixed),
    }));
    const fixedMonthExpenses = taggedMonthExpenses.filter(e => e._is_fixed);
    // Total monthly fixed = full amount (rent + salaries for the whole month)
    // Filtered by branch in monthExpenses already, but ensuring it matches selectedBranch
    // branchObj and branchKey are already declared above for purchasesToday

    // DB query already filters by branch_key via expenseBranchFilter;
    // no additional in-memory branch filter needed here.
    const filteredFixedMonthExpenses = fixedMonthExpenses;

    const totalMonthlyFixed = filteredFixedMonthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    // Daily fixed allocation = monthly fixed / real calendar days in month
    const dailyFixedAllocation = totalMonthlyFixed > 0 ? totalMonthlyFixed / realDaysInMonth : 0;


    // DAILY OPERATING EXPENSES: only non-fixed expenses entered today
    const taggedTodayExpenses = (todayExpenses || []).map(e => ({
      ...e,
      _is_fixed: !!(catMap[e.category_id]?.is_fixed || catMap[e.expense_category_id]?.is_fixed),
    }));
    const variableTodayExpenses = taggedTodayExpenses.filter(e => !e._is_fixed);
    const totalVariableToday = variableTodayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // TODAY TOTAL EXPENSE = daily variable + prorated daily fixed allocation
    const expensesToday = totalVariableToday + dailyFixedAllocation;
    const expensesTodayRaw = (todayExpenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // KPI FIX: Net Profit = (Cash + Network + Credit) - Purchases - Expenses
    const grossProfit = salesToday - purchasesToday;
    const netProfit   = salesToday - purchasesToday - expensesToday;

    const latestSale = todaySales.length > 0
      ?  (todaySales || []).reduce((latest, s) =>
          (!latest || (s.created_date || s.date) > (latest.created_date || latest.date)) ? s : latest, null)
      : null;
    const cashInRegister = latestSale
      ? (Number(latestSale.closing_cash) || Number(latestSale.restaurant_cash) || Number(latestSale.cash) || 0)
      : 0;

    // NETWORK BALANCE — Today / Yesterday / Month (POS/Network only, no cash, no credit)
    const networkToday = (todaySales || []).reduce((s, r) =>
      s + (Number(r.restaurant_network) || Number(r.network) || 0), 0);

    const networkYesterday = (yesterdaySales || []).reduce((s, r) =>
      s + (Number(r.restaurant_network) || Number(r.network) || 0), 0);

    const networkMonth = (monthSales || []).reduce((s, r) =>
      s + (Number(r.restaurant_network) || Number(r.network) || 0), 0);

    // Keep legacy networkBalance for any other widgets that may reference it
    const networkBalance = networkMonth;

    // KPI FIX: Customer Credit = total open receivables (live balance from DebtRecord)
    const customerCredit = customerDebts
      .filter(d => d.status !== 'paid' && d.status !== 'written_off')
      .reduce((s, d) => s + (Number(d.remaining_amount) || 0), 0);

    const inventoryValue =  (inventory || []).reduce((s, item) =>
      s + ((item.quantity || 0) * (item.unit_cost || item.avg_cost || item.cost_price || 0)), 0);

    // USE EXACT SAME HELPER AS PROCUREMENT DASHBOARD FOR PAYABLES
    // branchObj and branchKey already defined above in this memo
    const branchFilteredForPayables = selectedBranch === 'all' 
      ? supplierInvoices 
      : supplierInvoices.filter(inv => inv.branch === branchKey);
    const payablesKpis = computeProcurementKPIs(branchFilteredForPayables, []);
    const supplierPayables = payablesKpis.outstandingPayables;
    


    const ownerCapitalToday =  (todaySales || []).reduce((s, r) => s + (Number(r.owner_cash_injection) || 0), 0);

    const cashShortageToday = todaySales
      .filter(r => (Number(r.cash_difference) || 0) < 0)
      .reduce((s, r) => s + Math.abs(Number(r.cash_difference) || 0), 0);
    const cashOverageToday = todaySales
      .filter(r => (Number(r.cash_difference) || 0) > 0)
      .reduce((s, r) => s + (Number(r.cash_difference) || 0), 0);

    return {
      salesToday, cashSalesToday, networkSalesToday, creditSalesToday, customSalesToday,
      purchasesToday, expensesToday, expensesTodayRaw,
      dailyFixedAllocation, totalVariableToday, totalMonthlyFixed, realDaysInMonth,
      grossProfit, netProfit,
      cashInRegister, networkBalance, networkToday, networkYesterday, networkMonth, customerCredit,
      inventoryValue, supplierPayables,
      ownerCapitalToday, cashShortageToday, cashOverageToday,
    };
  }, [todaySales, yesterdaySales, todayExpenses, monthExpenses, expenseCategories, supplierInvoices, customerDebts, inventory, today, monthSales, walletTransactions, monthStart, selectedBranch, revenueSources]);

  // ── Section 2: Operating Result (NEVER REMOVE) ───────────────────────────────
  const operatingResult = useMemo(() => {
    const salesRevenue      = execSummary.salesToday;
    const approvedPurchases = execSummary.purchasesToday;
    const result            = salesRevenue - approvedPurchases;
    return { salesRevenue, approvedPurchases, result };
  }, [execSummary]);

  // ── Section 3: Cash Reconciliation ───────────────────────────────────────────
  const cashRecon = useMemo(() => {
    const openingCash  =  (todaySales || []).reduce((s, r) => s + (Number(r.opening_cash) || 0), 0);
    const cashSales    = execSummary.cashSalesToday;
    const ownerContrib = execSummary.ownerCapitalToday;
    const expensesOut  =  (todayExpenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const expectedCash = openingCash + cashSales + ownerContrib - expensesOut;
    const actualCash   = execSummary.cashInRegister;
    const cashDiff     = actualCash - expectedCash;
    const remainingDiff = cashDiff - ownerContrib;
    const closingCash  = actualCash;
    return { openingCash, expectedCash, actualCash, cashDiff, ownerContrib, remainingDiff, closingCash };
  }, [todaySales, todayExpenses, execSummary]);

  // ── Section 4: Sales Analytics ────────────────────────────────────────────────
  const salesAnalytics = useMemo(() => {
    const calcSales = (arr) =>  (arr || []).reduce((s, r) =>
      s + (calculateSalesRevenue(r, revenueSources)?.total || 0), 0);

    const todayAmt     = execSummary.salesToday;
    const yesterdayAmt = calcSales(yesterdaySales);
    const weekAmt      = calcSales(weekSales);
    const monthAmt     = calcSales(monthSales);
    const yearAmt      = calcSales(yearSales);
    const prevWeekAmt  = calcSales(prevWeekSales);
    const prevMonthAmt = calcSales(prevMonthSales);

    const weekGrowth  = prevWeekAmt  > 0 ? ((weekAmt  - prevWeekAmt)  / prevWeekAmt)  * 100 : 0;
    const monthGrowth = prevMonthAmt > 0 ? ((monthAmt - prevMonthAmt) / prevMonthAmt) * 100 : 0;

    const daysInMonth = monthSales.length > 0 ? new Set( (monthSales || []).map(s => s.date)).size : 1;
    const avgDailySales = daysInMonth > 0 ? monthAmt / daysInMonth : 0;

    const dailyTotals = {};
    monthSales.forEach(r => {
      const d = r.date;
      dailyTotals[d] = (dailyTotals[d] || 0) + (calculateSalesRevenue(r, revenueSources)?.total || 0);
    });
    const dailyArr = Object.values(dailyTotals);
    const highestDay = dailyArr.length > 0 ? Math.max(...dailyArr) : 0;
    const lowestDay  = dailyArr.length > 0 ? Math.min(...dailyArr) : 0;

    return { todayAmt, yesterdayAmt, weekAmt, monthAmt, yearAmt, weekGrowth, monthGrowth, avgDailySales, highestDay, lowestDay };
  }, [execSummary, yesterdaySales, weekSales, monthSales, yearSales, prevWeekSales, prevMonthSales, revenueSources]);

  // ── Monthly Expenses (Fixed + Variable) ──────────────────────────────────────
  // Total Monthly Expenses = Full monthly fixed expenses + all daily expenses in current month
  const totalMonthlyExpenses = useMemo(() => {
    const catMap = {};
    (expenseCategories || []).forEach(c => { catMap[c.id] = c; });

    // DB query already filters by branch_key via expenseBranchFilter;
    // no additional in-memory branch filter needed here.

    // Tag each expense with is_fixed from its category
    const tagged = (monthExpenses || []).map(e => ({
      ...e,
      _is_fixed: !!(catMap[e.category_id]?.is_fixed),
    }));

    // Fixed monthly expenses: use FULL amount (not prorated) for monthly total
    const fixedExpenses = tagged.filter(e => e._is_fixed);
    const variableExpenses = tagged.filter(e => !e._is_fixed);
    const totalFixed = fixedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const totalVariable = variableExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    // Total Monthly Expenses = Full fixed expenses + all variable/daily expenses
    const total = totalFixed + totalVariable;

    // Monthly Net Profit = Month Sales - Month Purchases - Total Monthly Expenses
    const monthSalesAmt = salesAnalytics.monthAmt;
    const branchPurchObj = (branches || []).find(b => (b.key || b.id) === selectedBranch);
    const branchPurchKey = branchPurchObj?.key || selectedBranch;

    const monthPurchasesAmt = supplierInvoices
      .filter(inv => {
        const isApproved = ['approved', 'auto_approved'].includes(inv.approval_status) || ['approved', 'paid', 'partial', 'unpaid'].includes(inv.status) || !inv.approval_status;
        const isBranchMatch = selectedBranch === 'all' || inv.branch === branchPurchKey;
        return isApproved && isBranchMatch && inv.date >= monthStart && inv.date <= today;
      })
      .reduce((s, inv) => s + (Number(inv.total_amount || inv.amount) || 0), 0);
    const monthNetProfit = monthSalesAmt - monthPurchasesAmt - total;

    return { total, totalFixed, totalVariable, monthNetProfit, monthPurchasesAmt };
  }, [monthExpenses, expenseCategories, salesAnalytics.monthAmt, supplierInvoices, selectedBranch, monthStart, today]);

  // ── Additional Sales Sources (dynamic, no hardcoded names) ───────────────────
  const additionalSources = useMemo(() => {
    // Use all month+today+yesterday sales for the branch-filtered data
    // computeAdditionalSources auto-detects from sales_sources_json
    const allSalesForSources = [
      ...monthSales,
      // todaySales and yesterdaySales may already be in monthSales; dedup by id
    ];
    const seenIds = new Set(monthSales.map(s => s.id));
    todaySales.forEach(s => { if (!seenIds.has(s.id)) allSalesForSources.push(s); });
    yesterdaySales.forEach(s => { if (!seenIds.has(s.id)) allSalesForSources.push(s); });

    // Get all custom (non-system) sources with today/yesterday/month/growth
    const sources = computeAdditionalSources(allSalesForSources, revenueSources);

    // Add growth % calculation
    return sources.map(src => ({
      ...src,
      growth: src.yesterday > 0
        ? ((src.today - src.yesterday) / src.yesterday) * 100
        : src.today > 0 ? 100 : 0,
    }));
  }, [monthSales, todaySales, yesterdaySales, revenueSources]);

  // ── Section 5: Purchase Analytics ────────────────────────────────────────────
  const purchaseAnalytics = useMemo(() => {
    // Filter invoices by branch for procurement KPIs
    const branchPurchAnObj = (branches || []).find(b => (b.key || b.id) === selectedBranch);
    const branchPurchAnKey = branchPurchAnObj?.key || selectedBranch;

    // Filter by branch to match Procurement Dashboard
    const branchFilteredInvoices = selectedBranch === 'all' 
      ? supplierInvoices 
      : supplierInvoices.filter(inv => inv.branch === branchPurchAnKey);

    // USE EXACT SAME HELPER AS PROCUREMENT DASHBOARD
    const kpis = computeProcurementKPIs(branchFilteredInvoices, []);



    // Calculate additional metrics for backward compatibility
    const startOfW = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const approvedInvoicesForBranch = branchFilteredInvoices.filter(inv => 
      ['approved', 'auto_approved'].includes(inv.approval_status) || 
      ['approved', 'paid', 'partial'].includes(inv.status)
    );

    const weekAmt = approvedInvoicesForBranch
      .filter(inv => inv.date >= startOfW && inv.date <= today)
      .reduce((s, inv) => s + (Number(inv.total_amount) || 0), 0);

    // Supplier ranking by total purchase amount (all approved, branch-filtered)
    const supplierMap = {};
    approvedInvoicesForBranch.forEach(inv => {
      const name = inv.supplier_name || 'Unknown';
      if (!supplierMap[name]) supplierMap[name] = { amount: 0, count: 0 };
      supplierMap[name].amount += (Number(inv.total_amount) || 0);
      supplierMap[name].count += 1;
    });
    const supplierRanking = Object.entries(supplierMap)
      .map(([name, v]) => [name, v.amount, v.count])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const allAmounts = approvedInvoicesForBranch.map(inv => Number(inv.total_amount) || 0);
    const largestPurchase = allAmounts.length > 0 ? Math.max(...allAmounts) : 0;
    const avgPurchase     = allAmounts.length > 0 ? allAmounts.reduce((s, v) => s + v, 0) / allAmounts.length : 0;

    return { 
      todayAmt: kpis.purchasesToday, 
      todayCount: approvedInvoicesForBranch.filter(inv => inv.date === today).length,
      weekAmt, 
      monthAmt: kpis.purchasesThisMonth, 
      monthCount: approvedInvoicesForBranch.filter(inv => inv.date >= format(startOfMonth(new Date()), 'yyyy-MM-dd') && inv.date <= today).length,
      supplierRanking, 
      largestPurchase, 
      avgPurchase,
      outstandingPayables: kpis.outstandingPayables,
      overduePayables: kpis.overduePayables,
    };
  }, [supplierInvoices, selectedBranch, today, branches]);

  // ── Section 5b: Product Quantity Analytics (ERP) ──────────────────────────────
  const productQuantityAnalytics = useMemo(() => {
    const branchObj = (branches || []).find(b => (b.key || b.id) === selectedBranch);
    const branchKey = branchObj?.key || selectedBranch;
    return computeProductQuantityAnalytics(
      supplierInvoices,
      branchKey,
      today,
      monthStart,
      prevMonthStart,
      monthStart  // prevMonthEnd is exclusive = current monthStart
    );
  }, [supplierInvoices, selectedBranch, today, monthStart, prevMonthStart, branches]);

  // ── Section 6: Inventory Analytics ───────────────────────────────────────────
  const inventoryAnalytics = useMemo(() => {
    const inventoryValue = execSummary.inventoryValue;

    const lowStock = inventory.filter(item => {
      const qty = item.quantity || 0;
      const threshold = item.low_stock_threshold || item.min_quantity || item.reorder_point || 0;
      return threshold > 0 && qty > 0 && qty <= threshold;
    });
    const outOfStock = inventory.filter(item => (item.quantity || 0) <= 0);
    const deadStock  = inventory.filter(item => {
      const qty = item.quantity || 0;
      const threshold = item.low_stock_threshold || item.min_quantity || item.reorder_point || 0;
      return qty > 0 && threshold === 0;
    }).slice(0, 3);
    const slowMoving = inventory
      .filter(item => (item.quantity || 0) > (item.low_stock_threshold || item.min_quantity || 0) * 3)
      .slice(0, 3);
    const fastMoving = inventory
      .filter(item => (item.quantity || 0) > 0 && (item.reorder_point || item.min_quantity || 0) > 0)
      .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
      .slice(0, 3);

    return { inventoryValue, fastMoving, slowMoving, lowStock, outOfStock, deadStock };
  }, [inventory, execSummary]);

  // ── Section 7: Cash Flow ─────────────────────────────────────────────────────
  const cashFlow = useMemo(() => {
    const moneyIn      = execSummary.salesToday;
    const expenses     =  (todayExpenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const moneyOut     = execSummary.purchasesToday + expenses;
    const ownerCapital = execSummary.ownerCapitalToday;
    const netCashFlow  = moneyIn - moneyOut + ownerCapital;
    return { moneyIn, moneyOut, ownerCapital, expenses, netCashFlow };
  }, [execSummary, todayExpenses]);

  // ── Section 8: Product Price Intelligence ────────────────────────────────────
  const priceIntelligence = useMemo(() => {
    const map = {};
    for (const row of priceHistory) {
      if (!map[row.product_id]) map[row.product_id] = [];
      map[row.product_id].push(row);
    }
    return Object.entries(map).slice(0, 5).map(([pid, rows]) => {
      const sorted   = rows.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
      const latest   = sorted[0];
      const previous = sorted[1];
      const diff     = latest && previous ? (latest.new_price || 0) - (previous.new_price || 0) : 0;
      const pct      = previous?.new_price > 0 ? (diff / previous.new_price) * 100 : 0;
      const since7d  = subDays(new Date(), 7).toISOString();
      const since30d = subDays(new Date(), 30).toISOString();
      return {
        product_id:    pid,
        product_name:  latest?.product_name || 'Unknown',
        latestPrice:   latest?.new_price || 0,
        previousPrice: previous?.new_price || latest?.old_price || 0,
        diff, pct,
        weeklyTrend:  rows.filter(r => r.recorded_at >= since7d).length,
        monthlyTrend: rows.filter(r => r.recorded_at >= since30d).length,
        yearlyTrend:  rows.length,
      };
    });
  }, [priceHistory]);

  // ── Section 9: Alerts ─────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const salesDays    = new Set( (monthSales || []).map(s => s.date));
    const purchaseDays = new Set( (monthPurchases || []).map(p => p.date));
    const missingPurchaseDays = [...salesDays].filter(d => !purchaseDays.has(d)).length;
    const cashShortage        = todaySales.filter(r => (Number(r.cash_difference) || 0) < 0).length;
    const negativeProfit      = execSummary.netProfit < 0 ? 1 : 0;
    const inventoryAlerts     = inventoryAnalytics.lowStock.length + inventoryAnalytics.outOfStock.length;
    const customerCreditAlerts = customerDebts.filter(d => d.status !== 'paid' && d.status !== 'written_off').length;
    const supplierDueAlerts   = supplierInvoices.filter(inv => inv.status !== 'paid' && inv.due_date && inv.due_date <= today).length;
    return { missingPurchaseDays, cashShortage, negativeProfit, inventoryAlerts, customerCreditAlerts, supplierDueAlerts };
  }, [monthSales, monthPurchases, todaySales, execSummary, inventoryAnalytics, customerDebts, supplierInvoices, today]);

  const totalAlerts = useMemo(() => Object.values(alerts).reduce((s, v) => s + v, 0), [alerts]);



  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-28 max-w-2xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-black text-foreground tracking-tight">Executive Dashboard</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-7">{format(new Date(), 'EEEE, MMMM d yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          {totalAlerts > 0 && (
            <button
              onClick={() => navigate('/alerts')}
              className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5 transition-colors cursor-pointer active:scale-95"
              aria-label={`${totalAlerts} alerts`}
            >
              {totalAlerts} alerts
            </button>
          )}
          <ModeBadge />
          <Badge variant="outline" className="text-xs capitalize">{role}</Badge>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 0 — BRANCH SELECTOR  (always at top)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <BranchSelector
          branches={branches}
          selectedBranch={selectedBranch}
          onSelect={setSelectedBranch}
        />
        {/* Branch badge below selector */}
        <div className="flex items-center gap-1.5 px-1">
          {selectedBranch === 'all'
            ? <Globe className="w-3.5 h-3.5 text-primary" />
            : <MapPin className="w-3.5 h-3.5 text-primary" />
          }
          <span className="text-[11px] text-muted-foreground">
            Showing data for:{' '}
            <strong className="text-foreground">
              {selectedBranch === 'all' ? '🌐 All Branches' : `📍 ${selectedBranchLabel}`}
            </strong>
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — EXECUTIVE SUMMARY
      ══════════════════════════════════════════════════════════════════════ */}
      <WidgetErrorBoundary>
        <section>
          <SectionHeader icon={LayoutDashboard} title="Executive Summary" subtitle="Today's key performance indicators" color="blue" />
          {loadingSales ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard title="Today's Sales"      value={fmt(execSummary.salesToday)}       subtitle={`Cash ${fmt(execSummary.cashSalesToday)} · Net ${fmt(execSummary.networkSalesToday)} · Credit ${fmt(execSummary.creditSalesToday)}`} icon={DollarSign}   color="green"  large onClick={() => navigate('/sales')} />
              <MetricCard title="Today's Purchases"  value={fmt(execSummary.purchasesToday)}   subtitle="Approved invoices"          icon={ShoppingCart}  color="amber"  large onClick={() => navigate('/enterprise-purchases')} />
              <MetricCard title="Gross Profit"       value={fmt(execSummary.grossProfit)}      subtitle="Sales − Purchases"          icon={execSummary.grossProfit >= 0 ? TrendingUp : TrendingDown} color={execSummary.grossProfit >= 0 ? 'green' : 'red'} onClick={() => navigate('/profit-loss')} />
              <MetricCard title="Net Profit"         value={fmt(execSummary.netProfit)}        subtitle="Sales − Purchases − Expenses" icon={execSummary.netProfit >= 0 ? TrendingUp : TrendingDown} color={execSummary.netProfit >= 0 ? 'green' : 'red'} onClick={() => navigate('/profit-loss')} />
              <MetricCard title="Cash in Register"   value={fmt(execSummary.cashInRegister)}   subtitle="Latest closing cash"        icon={Banknote}      color="blue"   onClick={() => navigate('/sales')} />
              {/* DAILY EXPENSES KPI — variable + prorated daily fixed */}
              <MetricCard
                title="Daily Expenses"
                value={fmt(execSummary.expensesToday || 0)}
                subtitle={execSummary.dailyFixedAllocation > 0
                  ? `Variable Today + Daily Fixed Allocation`
                  : 'Daily operating expenses'}
                icon={Receipt}
                color="amber"
                onClick={() => navigate('/expenses')}
              />
              {/* TOTAL MONTHLY EXPENSES — full fixed + all variable */}
              <MetricCard
                title="Monthly Expenses"
                value={fmt(execSummary.totalMonthlyFixed)}
                subtitle={`Total Monthly Fixed Expenses`}
                icon={Receipt}
                color={execSummary.totalMonthlyFixed > 0 ? 'red' : 'green'}
                onClick={() => navigate('/expenses')}
              />
              {/* NETWORK BALANCE — 3-column row: Today / Yesterday / Month */}
              <div className="col-span-2 grid grid-cols-3 gap-2">
                <MetricCard title="Network Today"     value={fmt(execSummary.networkToday)}     subtitle="POS/Network today"          icon={Wifi}  color="cyan"   onClick={() => navigate('/network-management')} />
                <MetricCard title="Network Yesterday" value={fmt(execSummary.networkYesterday)} subtitle="POS/Network yesterday"      icon={Wifi}  color="cyan"   onClick={() => navigate('/network-management')} />
                <MetricCard title="Month Network"     value={fmt(execSummary.networkMonth)}     subtitle="POS/Network month-to-date"  icon={Wifi}  color="cyan"   onClick={() => navigate('/network-management')} />
              </div>
              <MetricCard title="Customer Credit"    value={fmt(execSummary.customerCredit)}   subtitle="Outstanding receivables"    icon={CreditCard}    color="purple" onClick={() => navigate('/debt-management')} />
              <MetricCard title="Inventory Value"    value={fmt(execSummary.inventoryValue)}   subtitle="At cost price"              icon={Package}       color="indigo" onClick={() => navigate('/inventory')} />
              <MetricCard title="Supplier Payables"  value={fmt(execSummary.supplierPayables)} subtitle="Outstanding invoices"       icon={Truck}         color="orange" onClick={() => navigate('/suppliers')} />
              <MetricCard title="Owner Capital Today" value={fmt(execSummary.ownerCapitalToday)} subtitle="Cash injected today"     icon={Wallet}        color="slate" />
              <MetricCard title="Cash Shortage Today" value={fmt(execSummary.cashShortageToday)} subtitle="Not sales · Not profit"  icon={AlertTriangle} color={execSummary.cashShortageToday > 0 ? 'red' : 'green'} />
              <MetricCard title="Cash Overage Today"  value={fmt(execSummary.cashOverageToday)}  subtitle="Excess cash on hand"     icon={CheckCircle2}  color={execSummary.cashOverageToday > 0 ? 'green' : 'slate'} />
            </div>
          )}
        </section>
      </WidgetErrorBoundary>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — OPERATING RESULT  (NEVER REMOVE THIS WIDGET)
      ══════════════════════════════════════════════════════════════════════ */}
      <WidgetErrorBoundary>
        <section>
          <SectionHeader icon={Scale} title="Operating Result" subtitle="Sales Revenue − Approved Purchases" color="green" />
          <Card className={`border-2 ${operatingResult.result >= 0 ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'}`}>
            <CardContent className="p-4 space-y-1">
              <LedgerRow label="Sales Revenue"      value={fmt(operatingResult.salesRevenue)}      color="green" bold />
              <LedgerRow label="Approved Purchases" value={`− ${fmt(operatingResult.approvedPurchases)}`} color="amber" />
              <LedgerRow label="Operating Result"   value={fmt(operatingResult.result)}            color={operatingResult.result >= 0 ? 'green' : 'red'} bold separator />
            </CardContent>
          </Card>
        </section>
      </WidgetErrorBoundary>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — CASH RECONCILIATION
      ══════════════════════════════════════════════════════════════════════ */}
      <WidgetErrorBoundary>
        <section>
          <SectionHeader icon={Wallet} title="Cash Reconciliation" subtitle="Today's cash position" color="amber" action={{ label: 'Treasury', onClick: () => navigate('/treasury') }} />
          <Card>
            <CardContent className="p-4 space-y-1">
              <LedgerRow label="Opening Cash"        value={fmt(cashRecon.openingCash)}   color="blue" />
              <LedgerRow label="Expected Cash"       value={fmt(cashRecon.expectedCash)}  color="blue" />
              <LedgerRow label="Actual Cash"         value={fmt(cashRecon.actualCash)}    color={cashRecon.actualCash >= cashRecon.expectedCash ? 'green' : 'red'} />
              <LedgerRow label="Cash Difference"     value={fmt(cashRecon.cashDiff)}      color={cashRecon.cashDiff === 0 ? 'green' : cashRecon.cashDiff > 0 ? 'green' : 'red'} separator />
              <LedgerRow label="Owner Contribution"  value={fmt(cashRecon.ownerContrib)}  color="purple" />
              <LedgerRow label="Remaining Difference" value={fmt(cashRecon.remainingDiff)} color={cashRecon.remainingDiff === 0 ? 'green' : 'red'} />
              <LedgerRow label="Closing Cash"        value={fmt(cashRecon.closingCash)}   color="green" bold separator />
            </CardContent>
          </Card>
        </section>
      </WidgetErrorBoundary>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4 — SALES ANALYTICS
      ══════════════════════════════════════════════════════════════════════ */}
      <WidgetErrorBoundary>
        <section>
          <SectionHeader icon={BarChart3} title="Sales Analytics" subtitle="Multi-period sales performance" color="green" action={{ label: 'Reports', onClick: () => navigate('/reports') }} />
          <div className="grid grid-cols-2 gap-3">
            <MetricCard title="Today"            value={fmt(salesAnalytics.todayAmt)}     icon={DollarSign}    color="green" />
            <MetricCard title="Yesterday"        value={fmt(salesAnalytics.yesterdayAmt)} icon={Clock}         color="slate" />
            <MetricCard title="This Week"        value={fmt(salesAnalytics.weekAmt)}      icon={Activity}      color="blue"   trend={salesAnalytics.weekGrowth}  trendLabel="vs last week" />
            <MetricCard title="This Month"       value={fmt(salesAnalytics.monthAmt)}     icon={BarChart3}     color="purple" trend={salesAnalytics.monthGrowth} trendLabel="vs last month" />
            <MetricCard title="This Year"        value={fmt(salesAnalytics.yearAmt)}      icon={TrendingUp}    color="indigo" />
            <MetricCard title="Growth %"         value={fmtPct(salesAnalytics.monthGrowth)} icon={TrendingUp}  color={salesAnalytics.monthGrowth >= 0 ? 'green' : 'red'} />
            <MetricCard title="Avg Daily Sales"  value={fmt(salesAnalytics.avgDailySales)} icon={Target}       color="cyan" />
            <MetricCard title="Highest Sales Day" value={fmt(salesAnalytics.highestDay)}  icon={ArrowUpRight}  color="green" />
            <MetricCard title="Lowest Sales Day"  value={fmt(salesAnalytics.lowestDay)}   icon={ArrowDownRight} color="amber" />
          </div>
        </section>
      </WidgetErrorBoundary>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4B — ADDITIONAL SALES SOURCES
          Dynamic cards — no hardcoded names — reads from sales_sources_json
          Respects branch filter and included_in_dashboard_kpi flag
      ══════════════════════════════════════════════════════════════════════ */}
      {additionalSources.length > 0 && (
        <WidgetErrorBoundary>
          <section>
            <SectionHeader
              icon={Building2}
              title="Additional Sales Sources"
              subtitle="Delivery, Catering, Talabat, HungerStation & custom channels"
              color="purple"
              action={{ label: 'Reports', onClick: () => navigate('/reports') }}
            />
            <div className="grid grid-cols-2 gap-3">
              {additionalSources.map((src, i) => {
                const colors = ['purple', 'cyan', 'orange', 'indigo', 'green', 'amber', 'blue', 'red'];
                const color = colors[i % colors.length];
                return (
                  <MetricCard
                    key={src.key || src.name}
                    title={src.name}
                    value={fmt(src.today)}
                    subtitle={`Yesterday: ${fmt(src.yesterday)} · Month: ${fmt(src.month)}`}
                    icon={ShoppingBag}
                    color={color}
                    trend={src.growth}
                    trendLabel="vs yesterday"
                  />
                );
              })}
            </div>
          </section>
        </WidgetErrorBoundary>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 5 — PURCHASE ANALYTICS
      ══════════════════════════════════════════════════════════════════════ */}
      <WidgetErrorBoundary>
        <section>
          <SectionHeader icon={ShoppingCart} title="Purchase Analytics" subtitle="Approved invoices · branch-filtered" color="amber" action={{ label: 'Purchases', onClick: () => navigate('/enterprise-purchases') }} />
          <div className="grid grid-cols-2 gap-3">
            {/* A) Today's Purchases Card — approved invoices only */}
            <MetricCard
              title="Today's Purchases"
              value={fmt(purchaseAnalytics.todayAmt)}
              subtitle={`${purchaseAnalytics.todayCount} invoice${purchaseAnalytics.todayCount !== 1 ? 's' : ''} · approved`}
              icon={ShoppingCart}
              color="amber"
              large
              onClick={() => navigate('/enterprise-purchases')}
            />
            {/* B) Monthly Purchases Card — with branch filter */}
            <MetricCard
              title="Monthly Purchases"
              value={fmt(purchaseAnalytics.monthAmt)}
              subtitle={`${purchaseAnalytics.monthCount} invoices · ${selectedBranch === 'all' ? 'All branches' : selectedBranchLabel}`}
              icon={BarChart3}
              color="purple"
              large
              onClick={() => navigate('/enterprise-purchases')}
            />
            <MetricCard title="Weekly Purchases"  value={fmt(purchaseAnalytics.weekAmt)}         icon={Activity}     color="blue" />
            <MetricCard title="Largest Invoice"   value={fmt(purchaseAnalytics.largestPurchase)} icon={ArrowUpRight} color="red" />
            <MetricCard title="Avg Invoice"       value={fmt(purchaseAnalytics.avgPurchase)}     icon={Target}       color="slate" />
            {/* Supplier Payables = unpaid approved invoices */}
            <MetricCard
              title="Supplier Payables"
              value={fmt(purchaseAnalytics.outstandingPayables)}
              subtitle="Unpaid approved invoices"
              icon={CreditCard}
              color="orange"
              onClick={() => navigate('/enterprise-purchases')}
            />
            {/* Overdue Payables */}
            <MetricCard
              title="Overdue Payables"
              value={fmt(purchaseAnalytics.overduePayables)}
              subtitle="Past due date"
              icon={AlertTriangle}
              color={purchaseAnalytics.overduePayables > 0 ? 'red' : 'green'}
              onClick={() => navigate('/enterprise-purchases')}
            />
            {/* Monthly Net Profit = Month Sales − Month Purchases − Monthly Expenses */}
            <MetricCard
              title="Month Net Profit"
              value={fmt(totalMonthlyExpenses.monthNetProfit)}
              subtitle="Sales − Purch − Exp"
              icon={totalMonthlyExpenses.monthNetProfit >= 0 ? TrendingUp : TrendingDown}
              color={totalMonthlyExpenses.monthNetProfit >= 0 ? 'green' : 'red'}
              onClick={() => navigate('/reports')}
            />
          </div>
          {purchaseAnalytics.supplierRanking.length > 0 && (
            <Card className="mt-3">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Supplier Ranking (Approved)</p>
                <div className="space-y-1.5">
                  {purchaseAnalytics.supplierRanking.map(([name, amount, count], i) => (
                    <div key={name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-400' : 'bg-gray-400'}`}>{i + 1}</span>
                        <span className="text-xs font-medium text-foreground truncate max-w-[110px]">{name}</span>
                        <span className="text-[10px] text-muted-foreground">{count}x</span>
                      </div>
                      <span className="text-xs font-bold text-amber-600">{fmt(amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </WidgetErrorBoundary>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 5b — PRODUCT CONSUMPTION ANALYTICS (ERP)
      ══════════════════════════════════════════════════════════════════════ */}
      <WidgetErrorBoundary>
        <section>
          <SectionHeader
            icon={BarChart3}
            title="Product Consumption Analytics"
            subtitle={`Purchase items · ${selectedBranch === 'all' ? 'All branches' : selectedBranchLabel}`}
            color="purple"
            action={{ label: 'Purchases', onClick: () => navigate('/enterprise-purchases') }}
          />

          {/* ── ERP KPI Summary Cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {productQuantityAnalytics.topConsumedToday && (
              <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
                <CardContent className="p-3">
                  <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-1">Top Today</p>
                  <p className="text-xs font-bold text-foreground truncate">{productQuantityAnalytics.topConsumedToday.productName}</p>
                  <p className="text-[11px] font-black text-purple-700 dark:text-purple-400">
                    {productQuantityAnalytics.topConsumedToday.totalQuantity % 1 === 0
                      ? productQuantityAnalytics.topConsumedToday.totalQuantity
                      : productQuantityAnalytics.topConsumedToday.totalQuantity.toFixed(2)
                    } {productQuantityAnalytics.topConsumedToday.unit}
                  </p>
                </CardContent>
              </Card>
            )}
            {productQuantityAnalytics.topConsumedMonth && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="p-3">
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1">Top This Month</p>
                  <p className="text-xs font-bold text-foreground truncate">{productQuantityAnalytics.topConsumedMonth.productName}</p>
                  <p className="text-[11px] font-black text-blue-700 dark:text-blue-400">
                    {productQuantityAnalytics.topConsumedMonth.totalQuantity % 1 === 0
                      ? productQuantityAnalytics.topConsumedMonth.totalQuantity
                      : productQuantityAnalytics.topConsumedMonth.totalQuantity.toFixed(2)
                    } {productQuantityAnalytics.topConsumedMonth.unit}
                  </p>
                </CardContent>
              </Card>
            )}
            {productQuantityAnalytics.topConsumedPrevMonth && (
              <Card className="border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
                <CardContent className="p-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Top Prev Month</p>
                  <p className="text-xs font-bold text-foreground truncate">{productQuantityAnalytics.topConsumedPrevMonth.productName}</p>
                  <p className="text-[11px] font-black text-slate-600 dark:text-slate-400">
                    {productQuantityAnalytics.topConsumedPrevMonth.totalQuantity % 1 === 0
                      ? productQuantityAnalytics.topConsumedPrevMonth.totalQuantity
                      : productQuantityAnalytics.topConsumedPrevMonth.totalQuantity.toFixed(2)
                    } {productQuantityAnalytics.topConsumedPrevMonth.unit}
                  </p>
                </CardContent>
              </Card>
            )}
            {productQuantityAnalytics.highestCostMonth && (
              <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
                <CardContent className="p-3">
                  <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-1">Highest Cost</p>
                  <p className="text-xs font-bold text-foreground truncate">{productQuantityAnalytics.highestCostMonth.productName}</p>
                  <p className="text-[11px] font-black text-orange-700 dark:text-orange-400">{fmt(productQuantityAnalytics.highestCostMonth.totalCost)}</p>
                </CardContent>
              </Card>
            )}
            {productQuantityAnalytics.fastestGrowing && (
              <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardContent className="p-3">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Fastest Growing ↑</p>
                  <p className="text-xs font-bold text-foreground truncate">{productQuantityAnalytics.fastestGrowing.productName}</p>
                  <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                    +{productQuantityAnalytics.fastestGrowing.diff % 1 === 0
                      ? productQuantityAnalytics.fastestGrowing.diff
                      : productQuantityAnalytics.fastestGrowing.diff.toFixed(2)
                    } {productQuantityAnalytics.fastestGrowing.unit}
                  </p>
                </CardContent>
              </Card>
            )}
            {productQuantityAnalytics.mostReduced && (
              <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                <CardContent className="p-3">
                  <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-1">Most Reduced ↓</p>
                  <p className="text-xs font-bold text-foreground truncate">{productQuantityAnalytics.mostReduced.productName}</p>
                  <p className="text-[11px] font-black text-red-700 dark:text-red-400">
                    {productQuantityAnalytics.mostReduced.diff % 1 === 0
                      ? productQuantityAnalytics.mostReduced.diff
                      : productQuantityAnalytics.mostReduced.diff.toFixed(2)
                    } {productQuantityAnalytics.mostReduced.unit}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Full ERP Product Table: Today / This Month / Prev Month / Diff / Trend ── */}
          {productQuantityAnalytics.combinedProducts.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="p-4 text-center">
                <Package className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">No purchase items recorded</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1 px-3 py-1">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Product</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-right w-12">Today</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-right w-14">This Mo.</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-right w-14">Prev Mo.</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-right w-10">Trend</p>
              </div>
              {productQuantityAnalytics.combinedProducts.slice(0, 15).map((p) => {
                const trendColor = p.trend === '↑' ? 'text-emerald-600' : p.trend === '↓' ? 'text-red-500' : 'text-muted-foreground';
                const fmtQty = (q) => q % 1 === 0 ? String(q) : q.toFixed(1);
                return (
                  <div key={p.productId} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1 items-center px-3 py-2.5 rounded-xl border border-border/60 bg-background hover:bg-muted/30 transition-colors">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{p.productName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-muted-foreground">{p.unit}</span>
                        <span className="text-[9px] text-muted-foreground">Cost: {fmt(p.monthCost)}</span>
                        {p.prevMonthCost > 0 && (
                          <span className="text-[9px] text-muted-foreground">Prev: {fmt(p.prevMonthCost)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right w-12">
                      <p className="text-[11px] font-bold text-purple-700 dark:text-purple-400">{p.todayQty > 0 ? fmtQty(p.todayQty) : '—'}</p>
                    </div>
                    <div className="text-right w-14">
                      <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400">{p.monthQty > 0 ? fmtQty(p.monthQty) : '—'}</p>
                    </div>
                    <div className="text-right w-14">
                      <p className="text-[11px] font-semibold text-muted-foreground">{p.prevMonthQty > 0 ? fmtQty(p.prevMonthQty) : '—'}</p>
                    </div>
                    <div className="text-right w-10">
                      <span className={`text-sm font-black ${trendColor}`}>{p.trend}</span>
                      {p.diff !== 0 && (
                        <p className={`text-[8px] font-semibold ${trendColor}`}>
                          {p.diff > 0 ? '+' : ''}{fmtQty(p.diff)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Weekly Trend ─────────────────────────────────────────────────── */}
          {productQuantityAnalytics.weeklyTrend.some(d => d.totalQuantity > 0) && (
            <Card className="border-border/60 mt-3">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">7-Day Quantity Trend</p>
                <div className="flex items-end gap-1 h-16">
                  {productQuantityAnalytics.weeklyTrend.map((d) => {
                    const maxQty = Math.max(...productQuantityAnalytics.weeklyTrend.map(x => x.totalQuantity), 1);
                    const heightPct = maxQty > 0 ? (d.totalQuantity / maxQty) * 100 : 0;
                    const isToday = d.date === today;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-t-sm transition-all ${
                            isToday ? 'bg-purple-500' : 'bg-purple-200 dark:bg-purple-800'
                          }`}
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                          title={`${d.date}: ${d.totalQuantity} units, ${fmt(d.totalCost)}`}
                        />
                        <p className={`text-[8px] font-medium ${
                          isToday ? 'text-purple-600 font-bold' : 'text-muted-foreground'
                        }`}>
                          {d.date.slice(8)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </WidgetErrorBoundary>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 6 — INVENTORY ANALYTICS
      ══════════════════════════════════════════════════════════════════════ */}
      <WidgetErrorBoundary>
        <section>
          <SectionHeader icon={Package} title="Inventory Analytics" subtitle="Stock health overview" color="indigo" action={{ label: 'Inventory', onClick: () => navigate('/inventory') }} />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <MetricCard title="Inventory Value"  value={fmt(inventoryAnalytics.inventoryValue)} icon={Package}       color="indigo" large />
            <MetricCard title="Low Stock Items"  value={inventoryAnalytics.lowStock.length}      icon={AlertTriangle} color={inventoryAnalytics.lowStock.length > 0 ? 'amber' : 'green'} large onClick={() => navigate('/inventory')} />
            <MetricCard title="Out of Stock"     value={inventoryAnalytics.outOfStock.length}    icon={XCircle}       color={inventoryAnalytics.outOfStock.length > 0 ? 'red' : 'green'} onClick={() => navigate('/inventory')} />
            <MetricCard title="Dead Stock Items" value={inventoryAnalytics.deadStock.length}     icon={Layers}        color="slate" />
          </div>
          {inventoryAnalytics.lowStock.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">Low Stock Items</p>
                <div className="space-y-1">
                  { (inventoryAnalytics.lowStock || []).slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="text-xs text-foreground truncate max-w-[160px]">{item.product_name}</span>
                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">{item.quantity} left</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {inventoryAnalytics.outOfStock.length > 0 && (
            <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 mt-2">
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">Out of Stock</p>
                <div className="space-y-1">
                  { (inventoryAnalytics.outOfStock || []).slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="text-xs text-foreground truncate max-w-[160px]">{item.product_name}</span>
                      <Badge variant="destructive" className="text-[10px]">0 units</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </WidgetErrorBoundary>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 7 — CASH FLOW
      ══════════════════════════════════════════════════════════════════════ */}
      <WidgetErrorBoundary>
        <section>
          <SectionHeader icon={Activity} title="Cash Flow" subtitle="Today's money movement" color="cyan" action={{ label: 'Treasury', onClick: () => navigate('/treasury') }} />
          <Card>
            <CardContent className="p-4 space-y-1">
              <LedgerRow label="Money In"      value={fmt(cashFlow.moneyIn)}                  color="green" />
              <LedgerRow label="Money Out"     value={`− ${fmt(cashFlow.moneyOut)}`}          color="red" />
              <LedgerRow label="Owner Capital" value={fmt(cashFlow.ownerCapital)}             color="purple" />
              <LedgerRow label="Expenses"      value={`− ${fmt(cashFlow.expenses)}`}          color="amber" />
              <LedgerRow label="Net Cash Flow" value={fmt(cashFlow.netCashFlow)}              color={cashFlow.netCashFlow >= 0 ? 'green' : 'red'} bold separator />
            </CardContent>
          </Card>
        </section>
      </WidgetErrorBoundary>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 8 — PRODUCT PRICE INTELLIGENCE
      ══════════════════════════════════════════════════════════════════════ */}
      <WidgetErrorBoundary>
        <section>
          <SectionHeader icon={TrendingUp} title="Product Price Intelligence" subtitle="Price changes & trends (last 30 days)" color="purple" action={{ label: 'Products', onClick: () => navigate('/product-management') }} />
          {priceIntelligence.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-xs text-muted-foreground">
                No price changes recorded in the last 30 days.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              { (priceIntelligence || []).map(item => (
                <Card key={item.product_id} className="border border-border/60">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground truncate max-w-[160px]">{item.product_name}</span>
                      <span className={`text-xs font-bold flex items-center gap-0.5 ${item.diff > 0 ? 'text-red-600' : item.diff < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {item.diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : item.diff < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
                        {item.pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <p className="text-muted-foreground">Latest</p>
                        <p className="font-bold text-foreground">{fmt(item.latestPrice)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Previous</p>
                        <p className="font-semibold text-muted-foreground">{fmt(item.previousPrice)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Difference</p>
                        <p className={`font-bold ${item.diff > 0 ? 'text-red-600' : item.diff < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {item.diff >= 0 ? '+' : ''}{fmt(item.diff)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span>Weekly: <strong>{item.weeklyTrend}</strong></span>
                      <span>Monthly: <strong>{item.monthlyTrend}</strong></span>
                      <span>Yearly: <strong>{item.yearlyTrend}</strong></span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </WidgetErrorBoundary>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 9 — ALERTS
      ══════════════════════════════════════════════════════════════════════ */}
      <WidgetErrorBoundary>
        <section>
          <SectionHeader icon={AlertTriangle} title="Alerts" subtitle={`${totalAlerts} active alert${totalAlerts !== 1 ? 's' : ''}`} color="red" />
          <div className="space-y-2">
            <AlertRow icon={ShoppingBag}  title="Missing Purchases"       count={alerts.missingPurchaseDays}    severity={alerts.missingPurchaseDays > 0 ? 'amber' : 'green'}    onClick={() => navigate('/enterprise-purchases')} />
            <AlertRow icon={AlertTriangle} title="Cash Shortage (today)"  count={alerts.cashShortage}           severity={alerts.cashShortage > 0 ? 'critical' : 'green'}        onClick={() => navigate('/sales')} />
            <AlertRow icon={TrendingDown}  title="Negative Profit"        count={alerts.negativeProfit}         severity={alerts.negativeProfit > 0 ? 'critical' : 'green'}      onClick={() => navigate('/profit-loss')} />
            <AlertRow icon={Package}       title="Inventory Alerts"       count={alerts.inventoryAlerts}        severity={alerts.inventoryAlerts > 0 ? 'amber' : 'green'}        onClick={() => navigate('/inventory')} />
            <AlertRow icon={Users}         title="Customer Credit Alerts" count={alerts.customerCreditAlerts}   severity={alerts.customerCreditAlerts > 0 ? 'blue' : 'green'}    onClick={() => navigate('/debt-management')} />
            <AlertRow icon={Truck}         title="Supplier Due Alerts"    count={alerts.supplierDueAlerts}      severity={alerts.supplierDueAlerts > 0 ? 'high' : 'green'}       onClick={() => navigate('/suppliers')} />
          </div>
        </section>
      </WidgetErrorBoundary>



            {/* ── Price Changes Widget (existing component preserved) ── */}
      <WidgetErrorBoundary>
        <PriceChangesWidget />
      </WidgetErrorBoundary>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 10 — MODE-SPECIFIC WIDGETS (Auto-switches by Business Type)
      ══════════════════════════════════════════════════════════════════════ */}
      <WidgetErrorBoundary>
        <section>
          <SectionHeader
            icon={Layers}
            title="Mode-Specific Insights"
            subtitle="Widgets adapt automatically to your Business Type"
            color="indigo"
          />
          <ModeSpecificDashboardSection
            lowStockItems={alerts.inventoryAlerts > 0 ? [] : []}
            expiryAlerts={[]}
            pendingOrders={[]}
          />
        </section>
      </WidgetErrorBoundary>
    </div>
  );
}
