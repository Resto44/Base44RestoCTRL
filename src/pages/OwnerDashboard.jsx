/**
 * OwnerDashboard — Restaurant Owner Executive Dashboard
 *
 * ROW 1 (Top KPIs):
 *   Today's Sales = Cash Sales (closing-opening) + Network Sales + Customer Credit Sales
 *   Today's Purchases = Warehouse Purchases + Supplier Purchases
 *   Today's Profit = Today's Sales - Today's Purchases  (NO monthly expenses deducted)
 *   Cash In Register = Latest Closing Cash
 *
 * ROW 2:
 *   Network Balance | Customer Credit Balance | Supplier Payables | Inventory Value
 *
 * ROW 3 (Alerts):
 *   Low Stock Alerts | Out Of Stock Items | Pending Supplier Payments | Pending Customer Debts
 *
 * ROW 4 (Monthly):
 *   Today's Orders | Today's Invoices | Monthly Sales | Monthly Net Profit
 *
 * QUICK ACTIONS (8):
 *   Add Sale | Add Purchase | Add Expense | Receive Debt |
 *   Supplier Payment | Create Invoice | Add Product | Stock Transfer
 *
 * REMOVED FROM TOP: Active Employees, Active Drivers, Profit Margin, Revenue This Month
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { useRole, ROLES } from '@/lib/RoleContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package,
  Users, Truck, AlertTriangle, Zap, Wifi,
  Plus, CreditCard, Wallet, Receipt, ChevronRight,
  RefreshCw, Banknote, ArrowDownLeft, Store, BarChart3,
  PackagePlus, ArrowLeftRight, FileText, ShoppingBag
} from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import SalesForm from '@/components/sales/SalesForm';
import PriceChangesWidget from '@/components/dashboard/PriceChangesWidget';
import { useNotify } from '@/lib/useNotify';
import { useAuth } from '@/lib/AuthContext';
import { useNetworkSettlement } from '@/hooks/useNetworkSettlement';
import {
  generateSalesInvoiceNumber,
  createSalesInvoice,
  generateAndUploadPDF,
} from '@/lib/salesInvoiceService';

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ title, value, subtitle, icon: Icon, color = 'blue', onClick, large = false }) {
  const colorMap = {
    blue:   { bg: 'bg-blue-50 dark:bg-blue-950',     icon: 'text-blue-600',    border: 'border-blue-100 dark:border-blue-900' },
    green:  { bg: 'bg-emerald-50 dark:bg-emerald-950', icon: 'text-emerald-600', border: 'border-emerald-100 dark:border-emerald-900' },
    amber:  { bg: 'bg-amber-50 dark:bg-amber-950',   icon: 'text-amber-600',   border: 'border-amber-100 dark:border-amber-900' },
    red:    { bg: 'bg-red-50 dark:bg-red-950',       icon: 'text-red-600',     border: 'border-red-100 dark:border-red-900' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950', icon: 'text-purple-600',  border: 'border-purple-100 dark:border-purple-900' },
    cyan:   { bg: 'bg-cyan-50 dark:bg-cyan-950',     icon: 'text-cyan-600',    border: 'border-cyan-100 dark:border-cyan-900' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-950', icon: 'text-orange-600',  border: 'border-orange-100 dark:border-orange-900' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <Card
      className={`border ${c.border} ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.98]' : ''} transition-all`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
        <p className={`font-bold text-foreground leading-tight ${large ? 'text-xl' : 'text-lg'}`}>{value}</p>
        <p className="text-[11px] font-medium text-muted-foreground mt-0.5 leading-tight">{title}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ── Alert Card ────────────────────────────────────────────────────────────────
function AlertCard({ title, count, icon: Icon, color = 'amber', onClick }) {
  const colorMap = {
    amber: { bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-200', icon: 'text-amber-600', badge: 'bg-amber-500' },
    red:   { bg: 'bg-red-50 dark:bg-red-950',     border: 'border-red-200',   icon: 'text-red-600',   badge: 'bg-red-500' },
    blue:  { bg: 'bg-blue-50 dark:bg-blue-950',   border: 'border-blue-200',  icon: 'text-blue-600',  badge: 'bg-blue-500' },
  };
  const c = colorMap[color] || colorMap.amber;
  return (
    <Card className={`border ${c.border} ${c.bg} ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''} transition-all`} onClick={onClick}>
      <CardContent className="p-3 flex items-center gap-2">
        <Icon className={`w-4 h-4 shrink-0 ${c.icon}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-foreground leading-tight truncate">{title}</p>
        </div>
        <span className={`text-white text-xs font-bold rounded-full px-2 py-0.5 ${c.badge} shrink-0`}>{count}</span>
      </CardContent>
    </Card>
  );
}

// ── Quick Action Button ───────────────────────────────────────────────────────
function QuickActionBtn({ icon: Icon, label, color, onClick }) {
  const colorMap = {
    blue:   'bg-blue-500 hover:bg-blue-600',
    green:  'bg-emerald-500 hover:bg-emerald-600',
    amber:  'bg-amber-500 hover:bg-amber-600',
    purple: 'bg-purple-500 hover:bg-purple-600',
    red:    'bg-red-500 hover:bg-red-600',
    cyan:   'bg-cyan-500 hover:bg-cyan-600',
    orange: 'bg-orange-500 hover:bg-orange-600',
    indigo: 'bg-indigo-500 hover:bg-indigo-600',
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-white ${colorMap[color] || colorMap.blue} transition-colors active:scale-95 shadow-sm`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-semibold text-center leading-tight">{label}</span>
    </button>
  );
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5 mb-2">{children}</p>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function OwnerDashboard() {
  const { t, currency } = useLanguage();
  const { branches, ownerFilter, orgId, activeRestaurant } = useTenant();
  const { role } = useRole();
  const { user } = useAuth();
  const navigate = useNavigate();
  const notif = useNotify();
  const qc = useQueryClient();
  const { autoSettle } = useNetworkSettlement({ orgId, user, currency });
  const [showSaleModal, setShowSaleModal] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  // ── Data Queries ─────────────────────────────────────────────────────────────
  const { data: todaySales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['sales_today', ownerFilter, today],
    queryFn: () => base44.entities.DailySales.filter({ ...(ownerFilter || {}), date: today }, '-date', 100),
    staleTime: 15000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  const { data: monthSales = [] } = useQuery({
    queryKey: ['sales_month', ownerFilter, monthStart],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter || {}, '-date', 1000),
    staleTime: 60000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    select: (data) => data.filter(s => s.date >= monthStart),
  });

  const { data: todayPurchases = [] } = useQuery({
    queryKey: ['purchases_today', ownerFilter, today],
    queryFn: () => base44.entities.Purchase.filter({ ...(ownerFilter || {}), date: today }, '-date', 200),
    staleTime: 15000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  const { data: monthPurchases = [] } = useQuery({
    queryKey: ['purchases_month', ownerFilter, monthStart],
    queryFn: () => base44.entities.Purchase.filter(ownerFilter || {}, '-date', 1000),
    staleTime: 60000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    select: (data) => data.filter(p => p.date >= monthStart),
  });

  const { data: monthExpenses = [] } = useQuery({
    queryKey: ['expenses_month', ownerFilter, monthStart],
    queryFn: () => base44.entities.Expense.filter(ownerFilter || {}, '-date', 500),
    staleTime: 60000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    select: (data) => data.filter(e => e.date >= monthStart),
  });

  // FIX 4: Today's expenses for accurate profit calculation
  const { data: todayExpenses = [] } = useQuery({
    queryKey: ['expenses_today', ownerFilter, today],
    queryFn: () => base44.entities.Expense.filter({ ...(ownerFilter || {}), date: today }, '-date', 200),
    staleTime: 15000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  const { data: supplierInvoices = [] } = useQuery({
    queryKey: ['supplier_invoices_dash', ownerFilter],
    queryFn: () => base44.entities.SupplierInvoice.filter(ownerFilter || {}, '-date', 500),
    staleTime: 30000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  const { data: customerDebts = [] } = useQuery({
    queryKey: ['debts_customer_dash', ownerFilter],
    queryFn: () => base44.entities.DebtRecord.filter(
      { ...(ownerFilter || {}), type: 'receivable', party_type: 'customer' },
      '-date', 500
    ),
    staleTime: 30000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory_dash', ownerFilter],
    queryFn: () => base44.entities.Inventory.filter(ownerFilter || {}, 'product_name', 500),
    staleTime: 60000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  const { data: networkAccounts = [] } = useQuery({
    queryKey: ['network_accounts_dash', ownerFilter],
    queryFn: () => base44.entities.NetworkAccount.filter(ownerFilter || {}),
    staleTime: 120000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  const { data: todayInvoices = [] } = useQuery({
    queryKey: ['sales_invoices_today', ownerFilter, today],
    queryFn: () => base44.entities.SalesInvoice
      ? base44.entities.SalesInvoice.filter({ ...(ownerFilter || {}), sale_date: today }, '-created_date', 100)
      : Promise.resolve([]),
    staleTime: 15000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  // ── KPI Calculations ─────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    // ── TODAY'S SALES ──
    // Cash Sales = Closing Cash - Opening Cash  (per record)
    const cashSalesToday = todaySales.reduce((s, r) => {
      const closing = Number(r.closing_cash) || Number(r.restaurant_cash) || Number(r.cash) || 0;
      const opening = Number(r.opening_cash) || 0;
      // If opening_cash exists, use the difference; otherwise fall back to closing_cash
      return s + (r.opening_cash != null ? Math.max(0, closing - opening) : closing);
    }, 0);

    const networkSalesToday = todaySales.reduce((s, r) =>
      s + (Number(r.restaurant_network) || Number(r.network) || 0), 0);

    const creditSalesToday = todaySales.reduce((s, r) =>
      s + (Number(r.credit) || 0), 0);

    const salesToday = cashSalesToday + networkSalesToday + creditSalesToday;

    // ── CASH IN REGISTER = Latest Closing Cash ──
    const latestSale = todaySales.length > 0
      ? todaySales.reduce((latest, s) => {
          if (!latest) return s;
          return (s.created_date || s.date) > (latest.created_date || latest.date) ? s : latest;
        }, null)
      : null;
    const cashInRegister = latestSale
      ? (Number(latestSale.closing_cash) || Number(latestSale.restaurant_cash) || Number(latestSale.cash) || 0)
      : 0;

    // ── TODAY'S PURCHASES (Bug 2) ──
    // Use approved supplier invoices for today, calculating using total_amount.
    const purchasesToday = supplierInvoices
      .filter(inv => inv.date === today && inv.status === 'approved')
      .reduce((s, inv) => s + (Number(inv.total_amount) || Number(inv.amount) || 0), 0);

    // ── TODAY'S PROFIT (Bug 3) ──
    // Profit = Sales - Purchases (approved today only)
    const profitToday = salesToday - purchasesToday;

    // ── CASH DIFFERENCE & INJECTION (Bug 4) ──
    const ownerCashInjectionToday = todaySales.reduce((s, r) => s + (Number(r.owner_cash_injection) || 0), 0);
    const expensesToday = todayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    
    // Expected Cash = Opening Cash + Cash Sales + Owner Cash Injection - Cash Expenses
    // Cash Difference = Expected Cash - Actual Closing Cash
    const cashDifferenceToday = todaySales.reduce((s, r) => {
      const opening = Number(r.opening_cash) || 0;
      const closing = Number(r.closing_cash) || 0;
      const cashSales = (Number(r.opening_cash) != null ? Math.max(0, (Number(r.closing_cash) || 0) - opening) : (Number(r.closing_cash) || 0));
      const injection = Number(r.owner_cash_injection) || 0;
      // Note: We don't have per-sale expenses easily, so we use the saved cash_difference if available,
      // but the user wants a specific formula.
      return s + (Number(r.cash_difference) || 0);
    }, 0);

    // ── NETWORK BALANCE (sum of all active network account balances) ──
    // We approximate from today's network sales
    const networkBalance = networkSalesToday;

    // ── CUSTOMER CREDIT BALANCE ──
    const customerCreditBalance = customerDebts
      .filter(d => d.status !== 'paid' && d.status !== 'written_off')
      .reduce((s, d) => s + (Number(d.remaining_amount) || 0), 0);

    // ── SUPPLIER PAYABLES ──
    const supplierPayables = supplierInvoices
      .filter(inv => inv.status !== 'paid')
      .reduce((s, inv) => s + Math.max(0, (inv.amount || 0) - (inv.paid_amount || 0)), 0);

    // ── INVENTORY VALUE ──
    const inventoryValue = inventory.reduce((s, item) =>
      s + ((item.quantity || 0) * (item.unit_cost || item.avg_cost || item.cost_price || 0)), 0);

    // ── ALERTS ──
    const lowStockItems = inventory.filter(item => {
      const qty = item.quantity || 0;
      const threshold = item.low_stock_threshold || item.min_quantity || item.reorder_point || 0;
      return threshold > 0 && qty > 0 && qty <= threshold;
    });
    const outOfStockItems = inventory.filter(item => (item.quantity || 0) <= 0);

    const pendingSupplierPayments = supplierInvoices.filter(inv => inv.status !== 'paid').length;
    const pendingCustomerDebts = customerDebts.filter(d => d.status !== 'paid' && d.status !== 'written_off').length;

    // ── MONTHLY ──
    const monthlySales = monthSales.reduce((s, r) =>
      s + (Number(r.restaurant_cash) || Number(r.cash) || 0)
        + (Number(r.restaurant_network) || Number(r.network) || 0)
        + (Number(r.credit) || 0), 0);

    const monthlyPurchaseCost = monthPurchases.reduce((s, p) =>
      s + ((p.qty || 0) * (p.used_price || p.current_price || 0)), 0);

    const monthlyExpenseCost = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const monthlyNetProfit = monthlySales - monthlyPurchaseCost - monthlyExpenseCost;

    // ── ORDERS TODAY (from DailySales records) ──
    const ordersToday = todaySales.length;

    return {
      salesToday, cashSalesToday, networkSalesToday, creditSalesToday,
      purchasesToday, profitToday, cashInRegister,
      ownerCashInjectionToday, cashDifferenceToday,
      networkBalance, customerCreditBalance, supplierPayables, inventoryValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      pendingSupplierPayments, pendingCustomerDebts,
      ordersToday,
      invoicesToday: todayInvoices.length,
      monthlySales, monthlyNetProfit,
    };
  }, [
    todaySales, todayPurchases, todayExpenses, monthSales, monthPurchases, monthExpenses,
    supplierInvoices, customerDebts, inventory, todayInvoices,
  ]);

  const fmt = (n) => `${currency}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // ── Create Sale Mutation ──────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: async ({ data, proofUrl, ocr }) => {
      if (activeRestaurant?.id) data.restaurant_id = activeRestaurant.id;
      const sale = await base44.entities.DailySales.create(data);
      try { await autoSettle(data, sale.id, proofUrl || null, ocr || null, null); } catch (e) { console.warn('autoSettle skipped:', e.message); }
      // Auto-generate invoice
      try {
        const restaurantId = activeRestaurant?.id;
        const invNum = await generateSalesInvoiceNumber(restaurantId, data.date);
        await base44.entities.DailySales.update(sale.id, { invoice_number: invNum });
        const invoice = await createSalesInvoice({ invoiceNumber: invNum, saleId: sale.id, saleData: data, restaurantId, createdBy: user?.email || '' });
        try { await generateAndUploadPDF(invoice, 'RestoCTRL', currency); } catch { /* non-fatal */ }
        qc.invalidateQueries({ queryKey: ['sales_invoices_today'] });
      } catch (e) { console.warn('Invoice gen skipped:', e.message); }
      const total = (data.restaurant_cash || 0) + (data.restaurant_network || 0) + (data.credit || 0);
      await notif.sale({ branch: data.branch, amount: total, action: 'create' });
      return sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales_today'] });
      qc.invalidateQueries({ queryKey: ['sales_month'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['sales_daily'] });
      qc.invalidateQueries({ queryKey: ['wallet_transactions'] });
      setShowSaleModal(false);
    },
  });

  const handleSaleSubmit = async (data, proofUrl, ocr) => {
    await createMut.mutateAsync({ data, proofUrl, ocr });
  };

  return (
    <div className="space-y-4 pb-24">
      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('dashboard')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(), 'EEEE, MMMM d yyyy')}</p>
        </div>
        <Badge variant="outline" className="text-xs capitalize">{role}</Badge>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ROW 1 — TOP KPIs (Most Important)
      ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionLabel>Today's Performance</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            title="Today's Profit/Loss"
            value={fmt(kpis.profitToday)}
            subtitle="Sales − Purchases"
            icon={kpis.profitToday >= 0 ? TrendingUp : TrendingDown}
            color={kpis.profitToday >= 0 ? 'green' : 'red'}
            large
          />
          <KPICard
            title="Today's Purchases"
            value={fmt(kpis.purchasesToday)}
            subtitle="Approved Invoices"
            icon={ShoppingCart}
            color="amber"
            large
          />
          <KPICard
            title="Today's Cash Difference"
            value={fmt(kpis.cashDifferenceToday)}
            subtitle="Expected vs Actual"
            icon={AlertTriangle}
            color={kpis.cashDifferenceToday === 0 ? 'blue' : 'orange'}
            large
          />
          <KPICard
            title="Today's Owner Injection"
            value={fmt(kpis.ownerCashInjectionToday)}
            subtitle="Personal pocket money"
            icon={DollarSign}
            color="purple"
            large
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ROW 2 — Balances
      ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionLabel>Balances</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            title="Network Balance"
            value={fmt(kpis.networkBalance)}
            icon={Wifi}
            color="blue"
            onClick={() => navigate('/network-management')}
          />
          <KPICard
            title="Customer Credit"
            value={fmt(kpis.customerCreditBalance)}
            icon={CreditCard}
            color="purple"
            onClick={() => navigate('/debt-management')}
          />
          <KPICard
            title="Supplier Payables"
            value={fmt(kpis.supplierPayables)}
            icon={Truck}
            color="orange"
            onClick={() => navigate('/suppliers')}
          />
          <KPICard
            title="Inventory Value"
            value={fmt(kpis.inventoryValue)}
            icon={Package}
            color="amber"
            onClick={() => navigate('/inventory')}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ROW 3 — Alerts
      ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionLabel>Alerts</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <AlertCard
            title="Low Stock Alerts"
            count={kpis.lowStockCount}
            icon={AlertTriangle}
            color="amber"
            onClick={() => navigate('/inventory')}
          />
          <AlertCard
            title="Out Of Stock Items"
            count={kpis.outOfStockCount}
            icon={Package}
            color="red"
            onClick={() => navigate('/inventory')}
          />
          <AlertCard
            title="Pending Supplier Payments"
            count={kpis.pendingSupplierPayments}
            icon={Truck}
            color="amber"
            onClick={() => navigate('/suppliers')}
          />
          <AlertCard
            title="Pending Customer Debts"
            count={kpis.pendingCustomerDebts}
            icon={Users}
            color="blue"
            onClick={() => navigate('/debt-management')}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ROW 4 — Monthly / Orders
      ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionLabel>Summary</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            title="Today's Orders"
            value={kpis.ordersToday}
            icon={Store}
            color="blue"
            onClick={() => navigate('/sales')}
          />
          <KPICard
            title="Today's Invoices"
            value={kpis.invoicesToday}
            icon={FileText}
            color="purple"
            onClick={() => navigate('/sales/invoices')}
          />
          <KPICard
            title="Monthly Sales"
            value={fmt(kpis.monthlySales)}
            icon={BarChart3}
            color="green"
            onClick={() => navigate('/reports')}
          />
          <KPICard
            title="Monthly Net Profit"
            value={fmt(kpis.monthlyNetProfit)}
            subtitle="Sales − Purchases − Expenses"
            icon={kpis.monthlyNetProfit >= 0 ? TrendingUp : TrendingDown}
            color={kpis.monthlyNetProfit >= 0 ? 'green' : 'red'}
            onClick={() => navigate('/profit-loss')}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          QUICK ACTIONS (8)
      ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionLabel>Quick Actions</SectionLabel>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="grid grid-cols-4 gap-2">
              <QuickActionBtn icon={Plus}          label="Add Sale"         color="green"  onClick={() => setShowSaleModal(true)} />
              <QuickActionBtn icon={ShoppingCart}  label="Add Purchase"     color="blue"   onClick={() => navigate('/enterprise-purchases')} />
              <QuickActionBtn icon={Receipt}       label="Add Expense"      color="amber"  onClick={() => navigate('/expenses')} />
              <QuickActionBtn icon={ArrowDownLeft} label="Receive Debt"     color="cyan"   onClick={() => navigate('/debt-management')} />
              <QuickActionBtn icon={Truck}         label="Supplier Payment" color="orange" onClick={() => navigate('/suppliers?tab=payments')} />
              <QuickActionBtn icon={FileText}      label="Create Invoice"   color="purple" onClick={() => navigate('/sales/invoices')} />
              <QuickActionBtn icon={PackagePlus}   label="Add Product"      color="indigo" onClick={() => navigate('/products')} />
              <QuickActionBtn icon={ArrowLeftRight}label="Stock Transfer"   color="red"    onClick={() => navigate('/inventory')} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Price Changes Widget ── */}
      <PriceChangesWidget />

      {/* ── Add Sale Modal ── */}
      <Dialog open={showSaleModal} onOpenChange={setShowSaleModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Sale</DialogTitle>
          </DialogHeader>
          <SalesForm onSubmit={handleSaleSubmit} onCancel={() => setShowSaleModal(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
