/**
 * CashRegister — Daily cash flow reconciliation.
 * Opening Cash + Cash In (Cash Sales + Collections) - Cash Out (Expenses + Supplier Payments)
 * = Expected Closing Cash. Shows warning when actual vs expected differ.
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Banknote, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';

const LABELS = {
  en: {
    title: 'Cash Register',
    opening_cash: 'Opening Cash',
    cash_in: 'Cash In',
    cash_sales: 'Cash Sales',
    customer_collections: 'Customer Collections',
    cash_out: 'Cash Out',
    expenses: 'Expenses',
    supplier_payments: 'Supplier Payments',
    expected_closing: 'Expected Closing Cash',
    actual_closing: 'Actual Closing Cash',
    cash_difference: 'Cash Difference',
    warning_over: 'Cash surplus detected',
    warning_short: 'Cash shortage detected',
    balanced: 'Cash balanced',
  },
  ar: {
    title: 'سجل النقد',
    opening_cash: 'النقد الافتتاحي',
    cash_in: 'النقد الداخل',
    cash_sales: 'المبيعات النقدية',
    customer_collections: 'تحصيلات العملاء',
    cash_out: 'النقد الخارج',
    expenses: 'المصروفات',
    supplier_payments: 'مدفوعات الموردين',
    expected_closing: 'النقد الختامي المتوقع',
    actual_closing: 'النقد الختامي الفعلي',
    cash_difference: 'فرق النقد',
    warning_over: 'تم اكتشاف فائض نقدي',
    warning_short: 'تم اكتشاف عجز نقدي',
    balanced: 'النقد متوازن',
  },
  fa: {
    title: 'صندوق نقد',
    opening_cash: 'نقد ابتدایی',
    cash_in: 'ورودی نقد',
    cash_sales: 'فروش نقدی',
    customer_collections: 'وصولی مشتریان',
    cash_out: 'خروجی نقد',
    expenses: 'هزینه‌ها',
    supplier_payments: 'پرداخت‌های تامین‌کننده',
    expected_closing: 'نقد پایانی مورد انتظار',
    actual_closing: 'نقد پایانی واقعی',
    cash_difference: 'تفاوت نقد',
    warning_over: 'مازاد نقد شناسایی شد',
    warning_short: 'کمبود نقد شناسایی شد',
    balanced: 'نقد متعادل است',
  },
};

function CashRow({ label, value, currency, isTotal, color, indent }) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${indent ? 'pl-4' : ''} ${isTotal ? 'border-t border-border mt-1 pt-2' : ''}`}>
      <span className={`text-xs ${isTotal ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-sm font-bold ${color || 'text-foreground'}`}>
        {currency}{Number(value || 0).toLocaleString()}
      </span>
    </div>
  );
}

export default function CashRegister({ date, branch }) {
  const { language, currency } = useLanguage();
  const lbl = LABELS[language] || LABELS.en;
  const { ownerFilter } = useTenant();
  const todayStr = date || format(new Date(), 'yyyy-MM-dd');

  const [openingCash, setOpeningCash] = useState('');
  const [actualClosing, setActualClosing] = useState('');

  const filterBranch = (items) => {
    if (!branch || branch === 'all') return items;
    return items.filter(i => i.branch === branch);
  };

  const { data: sales = [] } = useQuery({
    queryKey: ['sales_daily', ownerFilter, todayStr],
    queryFn: () => base44.entities.DailySales.filter({ ...(ownerFilter || {}), date: todayStr }, '-date', 100),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 15000,
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['credit_collections_daily', ownerFilter, todayStr],
    queryFn: () => base44.entities.CreditCollection.filter({ ...(ownerFilter || {}), date: todayStr }, '-date', 100),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 15000,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses_daily', ownerFilter, todayStr],
    queryFn: () => base44.entities.Expense.filter({ ...(ownerFilter || {}), date: todayStr }, '-date', 100),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 15000,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['supplier_invoices', ownerFilter],
    queryFn: () => base44.entities.SupplierInvoice.filter(ownerFilter || {}, '-date', 500),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 30000,
  });

  const metrics = useMemo(() => {
    const daySales = filterBranch(sales);
    const dayCollections = filterBranch(collections);
    const dayExpenses = filterBranch(expenses);

    const cashSales = daySales.reduce((s, r) => s + (Number(r.restaurant_cash) || Number(r.cash) || 0), 0);
    const customerCollections = dayCollections
      .filter(c => c.received_via === 'cash')
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);

    const expensesTotal = dayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const supplierPaymentsToday = invoices
      .filter(inv => inv.last_payment_date === todayStr)
      .reduce((s, inv) => s + (Number(inv.paid_amount) || 0), 0);

    const opening = Number(openingCash) || 0;
    const cashIn = cashSales + customerCollections;
    const cashOut = expensesTotal + supplierPaymentsToday;
    const expectedClosing = opening + cashIn - cashOut;
    const actual = Number(actualClosing) || 0;
    const difference = actual - expectedClosing;

    return { cashSales, customerCollections, cashIn, expensesTotal, supplierPaymentsToday, cashOut, expectedClosing, difference };
  }, [sales, collections, expenses, invoices, openingCash, actualClosing, todayStr, branch]);

  const hasDifference = actualClosing !== '' && Math.abs(metrics.difference) > 0.01;
  const diffColor = metrics.difference > 0 ? 'text-emerald-600' : 'text-red-600';
  const diffBg = metrics.difference > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200';

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/60">
        <Banknote className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{lbl.title}</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Opening Cash Input */}
        <div>
          <Label className="text-xs text-muted-foreground">{lbl.opening_cash}</Label>
          <Input
            type="number" inputMode="decimal" step="0.01" min="0"
            value={openingCash}
            onChange={e => setOpeningCash(e.target.value)}
            placeholder="0"
            className="h-10"
          />
        </div>

        {/* Cash In */}
        <div className="rounded-lg bg-emerald-50 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-800">{lbl.cash_in}</span>
          </div>
          <CashRow label={lbl.cash_sales} value={metrics.cashSales} currency={currency} indent color="text-emerald-700" />
          <CashRow label={lbl.customer_collections} value={metrics.customerCollections} currency={currency} indent color="text-emerald-700" />
          <CashRow label="Total In" value={metrics.cashIn} currency={currency} isTotal color="text-emerald-800" />
        </div>

        {/* Cash Out */}
        <div className="rounded-lg bg-red-50 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="w-3.5 h-3.5 text-red-600" />
            <span className="text-xs font-semibold text-red-800">{lbl.cash_out}</span>
          </div>
          <CashRow label={lbl.expenses} value={metrics.expensesTotal} currency={currency} indent color="text-red-700" />
          <CashRow label={lbl.supplier_payments} value={metrics.supplierPaymentsToday} currency={currency} indent color="text-red-700" />
          <CashRow label="Total Out" value={metrics.cashOut} currency={currency} isTotal color="text-red-800" />
        </div>

        {/* Expected Closing */}
        <div className="flex justify-between items-center bg-primary/5 rounded-lg px-3 py-2.5">
          <span className="text-xs font-semibold">{lbl.expected_closing}</span>
          <span className="text-lg font-extrabold text-primary">{currency}{metrics.expectedClosing.toLocaleString()}</span>
        </div>

        {/* Actual Closing Input */}
        <div>
          <Label className="text-xs text-muted-foreground">{lbl.actual_closing}</Label>
          <Input
            type="number" inputMode="decimal" step="0.01"
            value={actualClosing}
            onChange={e => setActualClosing(e.target.value)}
            placeholder="0"
            className="h-10"
          />
        </div>

        {/* Difference / Warning */}
        {actualClosing !== '' && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 border ${hasDifference ? diffBg : 'bg-emerald-50 border-emerald-200'}`}>
            {hasDifference ? (
              <AlertTriangle className={`w-4 h-4 ${metrics.difference > 0 ? 'text-emerald-600' : 'text-red-600'}`} />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
            <div className="flex-1">
              <p className={`text-xs font-semibold ${hasDifference ? diffColor : 'text-emerald-700'}`}>
                {hasDifference
                  ? (metrics.difference > 0 ? lbl.warning_over : lbl.warning_short)
                  : lbl.balanced}
              </p>
              {hasDifference && (
                <p className={`text-xs ${diffColor}`}>
                  {lbl.cash_difference}: {currency}{Math.abs(metrics.difference).toLocaleString()}
                </p>
              )}
            </div>
            <span className={`text-lg font-bold ${hasDifference ? diffColor : 'text-emerald-700'}`}>
              {metrics.difference >= 0 ? '+' : ''}{currency}{metrics.difference.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
