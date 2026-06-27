/**
 * FinancialKPIs — ERP Dashboard KPI cards.
 * Rules 4 & 5: Separate KPIs for Sales Today, Purchases Today,
 * Operating Result, Owner Capital Contribution, Cash Shortage.
 * Sales figures are NEVER modified by shortage logic.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { format } from 'date-fns';
import {
  TrendingUp, DollarSign, Banknote, Users, Truck, Package,
  AlertTriangle, ShoppingCart, TrendingDown, PiggyBank
} from 'lucide-react';
import { Card } from '@/components/ui/card';

const LABELS = {
  en: {
    sales_today: 'Sales Today',
    purchases_today: 'Purchases Today',
    operating_result: 'Operating Result',
    owner_capital: 'Owner Capital Contribution',
    cash_shortage: 'Cash Shortage Today',
    cash_available: 'Cash Available',
    customer_receivables: 'Customer Receivables',
    supplier_payables: 'Supplier Payables',
    inventory_value: 'Inventory Value',
    alerts: 'Smart Alerts',
    overdue_customers: 'Overdue customer debts',
    overdue_suppliers: 'Overdue supplier balances',
    low_inventory: 'Low inventory items',
    vs_yesterday: 'vs yesterday',
  },
  ar: {
    sales_today: 'مبيعات اليوم',
    purchases_today: 'مشتريات اليوم',
    operating_result: 'النتيجة التشغيلية',
    owner_capital: 'مساهمة رأس مال المالك',
    cash_shortage: 'العجز النقدي اليوم',
    cash_available: 'النقد المتاح',
    customer_receivables: 'المستحقات من العملاء',
    supplier_payables: 'المستحق للموردين',
    inventory_value: 'قيمة المخزون',
    alerts: 'تنبيهات ذكية',
    overdue_customers: 'ديون عملاء متأخرة',
    overdue_suppliers: 'أرصدة موردين متأخرة',
    low_inventory: 'مخزون منخفض',
    vs_yesterday: 'مقارنة بالأمس',
  },
  fa: {
    sales_today: 'فروش امروز',
    purchases_today: 'خریدهای امروز',
    operating_result: 'نتیجه عملیاتی',
    owner_capital: 'سرمایه‌گذاری مالک',
    cash_shortage: 'کمبود نقد امروز',
    cash_available: 'نقد موجود',
    customer_receivables: 'مطالبات مشتریان',
    supplier_payables: 'قابل پرداخت تامین‌کننده',
    inventory_value: 'ارزش موجودی',
    alerts: 'هشدارهای هوشمند',
    overdue_customers: 'بدهی‌های معوق مشتریان',
    overdue_suppliers: 'موجودی‌های معوق تامین‌کننده',
    low_inventory: 'موجودی کم',
    vs_yesterday: 'در مقایسه با دیروز',
  },
};

function KPICard({ label, value, sublabel, icon: Icon, color = 'text-primary', bgColor = 'bg-primary/10', trend }) {
  return (
    <Card className="p-4 flex items-start gap-3 bg-card border-border/50 shadow-sm">
      <div className={`p-2.5 rounded-xl ${bgColor} ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold text-foreground mt-0.5 truncate">{value}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
        {trend !== undefined && (
          <p className={`text-xs mt-0.5 font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </p>
        )}
      </div>
    </Card>
  );
}

function AlertItem({ icon: Icon, text, severity = 'warning' }) {
  const colors = {
    warning: 'text-amber-700 bg-amber-50 border-amber-200',
    error: 'text-red-700 bg-red-50 border-red-200',
    info: 'text-blue-700 bg-blue-50 border-blue-200',
  };
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${colors[severity]}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="text-xs font-medium">{text}</span>
    </div>
  );
}

export default function FinancialKPIs({ branch }) {
  const { language, currency } = useLanguage();
  const lbl = LABELS[language] || LABELS.en;
  const { ownerFilter } = useTenant();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

  const filterBranch = (items) => {
    if (!branch || branch === 'all') return items;
    return items.filter(i => i.branch === branch);
  };

  // ── Today's sales ─────────────────────────────────────────────────────────
  const { data: todaySales = [] } = useQuery({
    queryKey: ['sales_daily', ownerFilter, todayStr],
    queryFn: () => base44.entities.DailySales.filter({ ...(ownerFilter || {}), date: todayStr }, '-date', 100),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 15000,
  });

  const { data: yesterdaySales = [] } = useQuery({
    queryKey: ['sales_daily', ownerFilter, yesterdayStr],
    queryFn: () => base44.entities.DailySales.filter({ ...(ownerFilter || {}), date: yesterdayStr }, '-date', 100),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 60000,
  });

  // ── Rule 4: Today's APPROVED supplier invoices (the authoritative purchase source) ──
  const { data: todayApprovedPurchases = [] } = useQuery({
    queryKey: ['approved_purchases_kpi', ownerFilter, todayStr],
    queryFn: async () => {
      if (!ownerFilter?.created_by) return [];
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('id, total_amount, approval_status, branch, date')
        .eq('created_by', ownerFilter.created_by)
        .eq('date', todayStr)
        .in('approval_status', ['approved', 'auto_approved'])
        .limit(200);
      if (error) return [];
      return data || [];
    },
    enabled: !!ownerFilter?.created_by,
    staleTime: 15000,
  });

  // ── Supplier invoices (for payables) ─────────────────────────────────────
  const { data: allInvoices = [] } = useQuery({
    queryKey: ['supplier_invoices', ownerFilter],
    queryFn: () => base44.entities.SupplierInvoice.filter(ownerFilter || {}, '-date', 500),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 30000,
  });

  const { data: customerDebts = [] } = useQuery({
    queryKey: ['debts_customer', ownerFilter],
    queryFn: () => base44.entities.DebtRecord.filter({ ...(ownerFilter || {}), type: 'receivable', party_type: 'customer' }, '-date', 500),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 30000,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', ownerFilter],
    queryFn: () => base44.entities.Inventory.filter(ownerFilter || {}, 'product_name', 500),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 60000,
  });

  const kpis = useMemo(() => {
    const daySales = filterBranch(todaySales);
    const prevSales = filterBranch(yesterdaySales);

    // ── Rule 5: Sales = Cash + Network + Credit. NEVER reduced by shortage ──
    const salesToday = daySales.reduce((s, r) =>
      s + (Number(r.restaurant_cash) || Number(r.cash) || 0)
        + (Number(r.restaurant_network) || Number(r.network) || 0)
        + (Number(r.credit) || 0), 0);

    const salesYesterday = prevSales.reduce((s, r) =>
      s + (Number(r.restaurant_cash) || Number(r.cash) || 0)
        + (Number(r.restaurant_network) || Number(r.network) || 0)
        + (Number(r.credit) || 0), 0);

    const salesTrend = salesYesterday > 0 ? ((salesToday - salesYesterday) / salesYesterday) * 100 : 0;

    // ── Rule 4: Purchases = only APPROVED supplier invoices for today ────────
    const purchasesToday = filterBranch(todayApprovedPurchases).reduce(
      (s, p) => s + (Number(p.total_amount) || 0), 0
    );

    // ── Rule 2: Daily Operating Result = Sales − Approved Purchases ──────────
    const operatingResult = salesToday - purchasesToday;

    // ── Rule 3: Owner Capital Contribution = max(0, purchases - sales) ───────
    // This is an accounting adjustment ONLY — it does NOT change sales figures.
    const ownerCapitalContribution = Math.max(0, purchasesToday - salesToday);

    // ── Rule 3 / Rule 4: Cash Shortage = same as owner capital contribution ──
    const cashShortageToday = ownerCapitalContribution;

    const cashAvailable = daySales.reduce((s, r) =>
      s + (Number(r.restaurant_cash) || Number(r.cash) || 0), 0);

    const customerReceivables = customerDebts
      .filter(d => d.status !== 'paid' && d.status !== 'written_off')
      .reduce((s, d) => s + (Number(d.remaining_amount) || 0), 0);

    const supplierPayables = allInvoices
      .filter(inv => inv.status !== 'paid')
      .reduce((s, inv) => s + Math.max(0, (inv.amount || 0) - (inv.paid_amount || 0)), 0);

    const inventoryValue = inventory.reduce((s, item) =>
      s + ((item.quantity || 0) * (item.unit_cost || item.avg_cost || 0)), 0);

    // Smart alerts
    const alerts = [];
    const overdueCustomers = customerDebts.filter(d => {
      if (d.status === 'paid' || d.status === 'written_off') return false;
      if (!d.due_date) return false;
      return d.due_date < todayStr;
    });
    if (overdueCustomers.length > 0) {
      alerts.push({ icon: Users, text: `${overdueCustomers.length} ${lbl.overdue_customers}`, severity: 'error' });
    }

    const overdueSuppliers = allInvoices.filter(inv => {
      if (inv.status === 'paid') return false;
      if (!inv.due_date) return false;
      return inv.due_date < todayStr;
    });
    if (overdueSuppliers.length > 0) {
      alerts.push({ icon: Truck, text: `${overdueSuppliers.length} ${lbl.overdue_suppliers}`, severity: 'error' });
    }

    const lowInventory = inventory.filter(item => {
      const qty = item.quantity || 0;
      const min = item.min_quantity || item.reorder_point || 0;
      return min > 0 && qty <= min;
    });
    if (lowInventory.length > 0) {
      alerts.push({ icon: Package, text: `${lowInventory.length} ${lbl.low_inventory}`, severity: 'warning' });
    }

    return {
      salesToday, salesTrend, purchasesToday, operatingResult,
      ownerCapitalContribution, cashShortageToday,
      cashAvailable, customerReceivables, supplierPayables, inventoryValue, alerts,
    };
  }, [todaySales, yesterdaySales, todayApprovedPurchases, customerDebts, allInvoices, inventory, branch, todayStr]);

  const fmt = (v) => `${currency}${Number(v || 0).toLocaleString()}`;

  return (
    <div className="space-y-4">
      {/* Rule 4: Separate KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* KPI 1: Sales Today — Rule 5: never modified by shortage */}
        <KPICard
          label={lbl.sales_today}
          value={fmt(kpis.salesToday)}
          icon={TrendingUp}
          color="text-blue-600"
          bgColor="bg-blue-100"
          trend={kpis.salesTrend}
          sublabel={lbl.vs_yesterday}
        />
        {/* KPI 2: Purchases Today — only approved invoices */}
        <KPICard
          label={lbl.purchases_today}
          value={fmt(kpis.purchasesToday)}
          icon={ShoppingCart}
          color="text-orange-600"
          bgColor="bg-orange-100"
        />
        {/* KPI 3: Operating Result = Sales − Purchases */}
        <KPICard
          label={lbl.operating_result}
          value={fmt(kpis.operatingResult)}
          icon={DollarSign}
          color={kpis.operatingResult >= 0 ? 'text-emerald-600' : 'text-red-600'}
          bgColor={kpis.operatingResult >= 0 ? 'bg-emerald-100' : 'bg-red-100'}
        />
        {/* KPI 4: Owner Capital Contribution */}
        <KPICard
          label={lbl.owner_capital}
          value={fmt(kpis.ownerCapitalContribution)}
          icon={PiggyBank}
          color="text-amber-600"
          bgColor="bg-amber-100"
        />
        {/* KPI 5: Cash Shortage Today */}
        <KPICard
          label={lbl.cash_shortage}
          value={fmt(kpis.cashShortageToday)}
          icon={TrendingDown}
          color={kpis.cashShortageToday > 0 ? 'text-red-600' : 'text-emerald-600'}
          bgColor={kpis.cashShortageToday > 0 ? 'bg-red-100' : 'bg-emerald-100'}
        />
        <KPICard
          label={lbl.cash_available}
          value={fmt(kpis.cashAvailable)}
          icon={Banknote}
          color="text-green-600"
          bgColor="bg-green-100"
        />
        <KPICard
          label={lbl.customer_receivables}
          value={fmt(kpis.customerReceivables)}
          icon={Users}
          color="text-amber-600"
          bgColor="bg-amber-100"
        />
        <KPICard
          label={lbl.supplier_payables}
          value={fmt(kpis.supplierPayables)}
          icon={Truck}
          color="text-orange-600"
          bgColor="bg-orange-100"
        />
        <KPICard
          label={lbl.inventory_value}
          value={fmt(kpis.inventoryValue)}
          icon={Package}
          color="text-purple-600"
          bgColor="bg-purple-100"
        />
      </div>

      {/* Smart Alerts */}
      {kpis.alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">{lbl.alerts}</span>
            <span className="ms-auto text-xs font-bold text-amber-700">{kpis.alerts.length}</span>
          </div>
          <div className="p-3 space-y-2">
            {kpis.alerts.map((alert, i) => (
              <AlertItem key={i} icon={alert.icon} text={alert.text} severity={alert.severity} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
