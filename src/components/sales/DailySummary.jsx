/**
 * DailySummary — Auto-calculated daily financial summary.
 * Shows: Sales (Cash, Network, Credit), Collections, Purchases, Supplier Payments,
 * Supplier Debt Balance, Customer Debt Balance.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { format } from 'date-fns';
import { TrendingUp, Wallet, ShoppingCart, Truck, Users, BarChart3, DollarSign } from 'lucide-react';

const LABELS = {
  en: {
    title: 'Daily Summary',
    sales: 'Sales',
    cash_sales: 'Cash Sales',
    network_sales: 'Network Sales',
    credit_sales: 'Customer Credit Sales',
    gross_sales: 'Gross Sales',
    collections: 'Collections',
    customer_collections: 'Customer Collections',
    purchases: 'Purchases',
    new_purchases: 'New Purchases',
    supplier_payments: 'Supplier Payments',
    supplier_debt_balance: 'Supplier Debt Balance',
    customer_debt_balance: 'Customer Debt Balance',
  },
  ar: {
    title: 'الملخص اليومي',
    sales: 'المبيعات',
    cash_sales: 'المبيعات النقدية',
    network_sales: 'مبيعات الشبكة',
    credit_sales: 'مبيعات العملاء الآجلة',
    gross_sales: 'إجمالي المبيعات',
    collections: 'التحصيلات',
    customer_collections: 'تحصيلات العملاء',
    purchases: 'المشتريات',
    new_purchases: 'مشتريات جديدة',
    supplier_payments: 'مدفوعات الموردين',
    supplier_debt_balance: 'رصيد ديون الموردين',
    customer_debt_balance: 'رصيد ديون العملاء',
  },
  fa: {
    title: 'خلاصه روزانه',
    sales: 'فروش',
    cash_sales: 'فروش نقدی',
    network_sales: 'فروش شبکه',
    credit_sales: 'فروش نسیه مشتریان',
    gross_sales: 'جمع فروش',
    collections: 'وصولی‌ها',
    customer_collections: 'وصولی مشتریان',
    purchases: 'خریدها',
    new_purchases: 'خریدهای جدید',
    supplier_payments: 'پرداخت‌های تامین‌کننده',
    supplier_debt_balance: 'موجودی بدهی تامین‌کننده',
    customer_debt_balance: 'موجودی بدهی مشتری',
  },
};

function SummaryRow({ label, value, currency, highlight, indent, color }) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${indent ? 'pl-4' : ''} ${highlight ? 'border-t border-border mt-1 pt-2' : ''}`}>
      <span className={`text-xs ${indent ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>{label}</span>
      <span className={`text-sm font-bold ${color || (highlight ? 'text-primary' : 'text-foreground')}`}>
        {currency}{Number(value || 0).toLocaleString()}
      </span>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children, color = 'bg-secondary/40' }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className={`flex items-center gap-2 px-3 py-2 ${color}`}>
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

export default function DailySummary({ date, branch }) {
  const { language, currency } = useLanguage();
  const lbl = LABELS[language] || LABELS.en;
  const { ownerFilter } = useTenant();
  const todayStr = date || format(new Date(), 'yyyy-MM-dd');

  // Today's sales
  const { data: sales = [] } = useQuery({
    queryKey: ['sales_daily', ownerFilter, todayStr],
    queryFn: () => base44.entities.DailySales.filter({ ...(ownerFilter || {}), date: todayStr }, '-date', 100),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 15000,
  });

  // Today's collections
  const { data: collections = [] } = useQuery({
    queryKey: ['customer_collections_daily', ownerFilter, todayStr],
    queryFn: () => base44.entities.CreditCollection.filter({ ...(ownerFilter || {}), date: todayStr }, '-date', 100),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 15000,
  });

  // Today's supplier invoices (new purchases)
  const { data: invoices = [] } = useQuery({
    queryKey: ['supplier_invoices_daily', ownerFilter, todayStr],
    queryFn: () => base44.entities.SupplierInvoice.filter({ ...(ownerFilter || {}), date: todayStr }, '-date', 100),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 15000,
  });

  // All open supplier invoices for balance
  const { data: allInvoices = [] } = useQuery({
    queryKey: ['supplier_invoices', ownerFilter],
    queryFn: () => base44.entities.SupplierInvoice.filter(ownerFilter || {}, '-date', 500),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 30000,
  });

  // All open customer debts for balance
  const { data: customerDebts = [] } = useQuery({
    queryKey: ['debts_customer', ownerFilter],
    queryFn: () => base44.entities.DebtRecord.filter({ ...(ownerFilter || {}), type: 'receivable', party_type: 'customer' }, '-date', 500),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 30000,
  });

  // Filter by branch if provided
  const filterBranch = (items) => {
    if (!branch || branch === 'all') return items;
    return items.filter(i => i.branch === branch);
  };

  const daySales = filterBranch(sales);
  const dayCollections = filterBranch(collections);
  const dayInvoices = filterBranch(invoices);

  const metrics = useMemo(() => {
    const cashSales = daySales.reduce((s, r) => s + (Number(r.restaurant_cash) || Number(r.cash) || 0), 0);
    const networkSales = daySales.reduce((s, r) => s + (Number(r.restaurant_network) || Number(r.network) || 0), 0);
    const creditSales = daySales.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    const grossSales = cashSales + networkSales + creditSales;

    const customerCollections = dayCollections.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    const newPurchases = dayInvoices.reduce((s, inv) => s + (Number(inv.amount) || 0), 0);

    // Supplier payments today = sum of paid_amount on invoices with last_payment_date = today
    const supplierPaymentsToday = allInvoices
      .filter(inv => inv.last_payment_date === todayStr)
      .reduce((s, inv) => {
        // Approximate: paid_amount changes. We use last payment notes if available
        return s + (Number(inv.paid_amount) || 0);
      }, 0);

    const supplierDebtBalance = allInvoices
      .filter(inv => inv.status !== 'paid')
      .reduce((s, inv) => s + Math.max(0, (inv.amount || 0) - (inv.paid_amount || 0)), 0);

    const customerDebtBalance = customerDebts
      .filter(d => d.status !== 'paid' && d.status !== 'written_off')
      .reduce((s, d) => s + (Number(d.remaining_amount) || 0), 0);

    return {
      cashSales, networkSales, creditSales, grossSales,
      customerCollections, newPurchases,
      supplierPaymentsToday, supplierDebtBalance, customerDebtBalance,
    };
  }, [daySales, dayCollections, dayInvoices, allInvoices, customerDebts, todayStr]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold">{lbl.title}</span>
        <span className="text-xs text-muted-foreground ml-auto">{todayStr}</span>
      </div>

      {/* Sales Section */}
      <SectionCard icon={TrendingUp} title={lbl.sales} color="bg-blue-50">
        <SummaryRow label={lbl.cash_sales} value={metrics.cashSales} currency={currency} indent />
        <SummaryRow label={lbl.network_sales} value={metrics.networkSales} currency={currency} indent />
        <SummaryRow label={lbl.credit_sales} value={metrics.creditSales} currency={currency} indent color="text-amber-700" />
        <SummaryRow label={lbl.gross_sales} value={metrics.grossSales} currency={currency} highlight color="text-blue-700" />
      </SectionCard>

      {/* Collections Section */}
      <SectionCard icon={Wallet} title={lbl.collections} color="bg-emerald-50">
        <SummaryRow label={lbl.customer_collections} value={metrics.customerCollections} currency={currency} indent />
      </SectionCard>

      {/* Purchases Section */}
      <SectionCard icon={ShoppingCart} title={lbl.purchases} color="bg-purple-50">
        <SummaryRow label={lbl.new_purchases} value={metrics.newPurchases} currency={currency} indent />
      </SectionCard>

      {/* Supplier Payments Section */}
      <SectionCard icon={Truck} title={lbl.supplier_payments} color="bg-orange-50">
        <SummaryRow label={lbl.supplier_debt_balance} value={metrics.supplierDebtBalance} currency={currency} indent color="text-orange-700" />
      </SectionCard>

      {/* Customer Debt Balance */}
      <SectionCard icon={Users} title={lbl.customer_debt_balance} color="bg-amber-50">
        <SummaryRow label={lbl.customer_debt_balance} value={metrics.customerDebtBalance} currency={currency} indent color="text-amber-700" />
      </SectionCard>
    </div>
  );
}
