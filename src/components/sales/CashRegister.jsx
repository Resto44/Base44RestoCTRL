/**
 * CashRegister — READ ONLY.
 * Automatically reads opening_cash, closing_cash, cash_difference, cash_status,
 * shift, cashier_name, sales_notes, manager_approval from the latest DailySales record.
 *
 * NO manual entry. Source of truth = Add Sale records.
 *
 * Features:
 * - Shows all shifts for the selected date (Morning + Evening)
 * - Displays Shift, Cashier Name, Sales Notes
 * - Shows Manager Approval badge when shortage was approved
 * - Shows combined daily total at the bottom
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { format } from 'date-fns';
import {
  Banknote, CheckCircle2, TrendingDown, TrendingUp, Lock,
  Clock, User, ShieldCheck, AlertCircle, SunMedium, Moon
} from 'lucide-react';

const LABELS = {
  en: {
    title: 'Cash Register',
    opening_cash: 'Opening Cash',
    closing_cash: 'Closing Cash',
    cash_difference: 'Cash Difference',
    cash_status: 'Cash Status',
    balanced: 'Balanced',
    shortage: 'Shortage',
    overage: 'Overage',
    no_data: 'No sale record found for this date/branch.',
    read_only_note: 'Auto-synced from Add Sale records',
    shift: 'Shift',
    cashier: 'Cashier',
    notes: 'Notes',
    manager_approved: 'Manager Approved',
    shortage_approved: 'Shortage approved by manager',
    daily_total: 'Daily Cash Total',
    morning: 'Morning',
    evening: 'Evening',
    cash_sales: 'Cash Sales',
  },
  ar: {
    title: 'سجل النقد',
    opening_cash: 'النقد الافتتاحي',
    closing_cash: 'النقد الختامي',
    cash_difference: 'فرق النقد',
    cash_status: 'حالة النقد',
    balanced: 'متوازن',
    shortage: 'عجز',
    overage: 'زيادة',
    no_data: 'لا يوجد سجل مبيعات لهذا التاريخ/الفرع.',
    read_only_note: 'تُزامن تلقائياً من سجلات إضافة المبيعات',
    shift: 'الوردية',
    cashier: 'الكاشير',
    notes: 'ملاحظات',
    manager_approved: 'موافقة المدير',
    shortage_approved: 'تمت الموافقة على العجز من قِبل المدير',
    daily_total: 'إجمالي النقد اليومي',
    morning: 'صباحية',
    evening: 'مسائية',
    cash_sales: 'المبيعات النقدية',
  },
  fa: {
    title: 'صندوق نقد',
    opening_cash: 'نقد ابتدایی',
    closing_cash: 'نقد پایانی',
    cash_difference: 'اختلاف نقد',
    cash_status: 'وضعیت نقد',
    balanced: 'متعادل',
    shortage: 'کسری',
    overage: 'مازاد',
    no_data: 'هیچ رکورد فروشی برای این تاریخ/شعبه یافت نشد.',
    read_only_note: 'همگام‌سازی خودکار از رکوردهای افزودن فروش',
    shift: 'شیفت',
    cashier: 'صندوقدار',
    notes: 'یادداشت',
    manager_approved: 'تأیید مدیر',
    shortage_approved: 'کسری توسط مدیر تأیید شد',
    daily_total: 'جمع نقد روزانه',
    morning: 'صبح',
    evening: 'عصر',
    cash_sales: 'فروش نقدی',
  },
};

function CashStatusBadge({ status, lbl }) {
  if (!status) return null;
  const config = {
    Balanced: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    Shortage: { color: 'bg-red-100 text-red-700 border-red-200', icon: TrendingDown },
    Overage: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: TrendingUp },
  };
  const c = config[status] || config.Balanced;
  const Icon = c.icon;
  const label = lbl[status.toLowerCase()] || status;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.color}`}>
      <Icon className="w-3.5 h-3.5" />{label}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

function ShiftCard({ sale, currency, lbl }) {
  const opening = Number(sale.opening_cash || 0);
  const closing = Number(sale.closing_cash || 0);
  const diff = closing - opening;
  const cashSales = Math.max(0, diff);
  const status = sale.cash_status || (diff === 0 ? 'Balanced' : diff < 0 ? 'Shortage' : 'Overage');
  const diffColor = diff > 0 ? 'text-amber-600' : diff < 0 ? 'text-red-600' : 'text-emerald-600';
  const isEvening = sale.shift === 'Evening';
  const ShiftIcon = isEvening ? Moon : SunMedium;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Shift header */}
      <div className={`flex items-center gap-2 px-3 py-2 ${isEvening ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'bg-amber-50 dark:bg-amber-950/30'}`}>
        <ShiftIcon className={`w-3.5 h-3.5 ${isEvening ? 'text-indigo-600' : 'text-amber-600'}`} />
        <span className={`text-xs font-bold ${isEvening ? 'text-indigo-700' : 'text-amber-700'}`}>
          {sale.shift === 'Evening' ? lbl.evening : lbl.morning}
        </span>
        <span className="ms-auto">
          <CashStatusBadge status={status} lbl={lbl} />
        </span>
      </div>

      <div className="p-3 space-y-2">
        {/* Opening / Closing */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">{lbl.opening_cash}</p>
            <p className="text-sm font-bold text-blue-600">{currency}{opening.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">{lbl.closing_cash}</p>
            <p className="text-sm font-bold text-foreground">{currency}{closing.toLocaleString()}</p>
          </div>
        </div>

        {/* Cash Difference */}
        <div className="rounded-lg bg-muted/30 border border-border px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{lbl.cash_difference}</span>
          <span className={`text-sm font-extrabold ${diffColor}`}>
            {diff >= 0 ? '+' : ''}{currency}{Math.abs(diff).toLocaleString()}
          </span>
        </div>

        {/* Cash Sales */}
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{lbl.cash_sales}</span>
          <span className="text-sm font-bold text-emerald-600">{currency}{cashSales.toLocaleString()}</span>
        </div>

        {/* Shift info */}
        <div className="space-y-0.5">
          <InfoRow icon={User} label={lbl.cashier} value={sale.cashier_name} />
          {sale.cash_notes && <InfoRow icon={Banknote} label={lbl.cash_status} value={sale.cash_notes} />}
          {sale.sales_notes && <InfoRow icon={Clock} label={lbl.notes} value={sale.sales_notes} />}
        </div>

        {/* Manager Approval */}
        {sale.manager_approval && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 px-3 py-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-emerald-700">{lbl.manager_approved}</p>
              {sale.manager_approved_by && (
                <p className="text-[10px] text-muted-foreground">{sale.manager_approved_by}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CashRegister({ date, branch }) {
  const { language, currency } = useLanguage();
  const lbl = LABELS[language] || LABELS.en;
  const { ownerFilter } = useTenant();
  const todayStr = date || format(new Date(), 'yyyy-MM-dd');

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales_daily', ownerFilter, todayStr],
    queryFn: () => base44.entities.DailySales.filter({ ...(ownerFilter || {}), date: todayStr }, '-date', 100),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 15000,
  });

  // Filter by branch, then sort by created_date
  const filteredSales = useMemo(() => {
    const filtered = (!branch || branch === 'all')
      ? sales
      : sales.filter(s => s.branch === branch);
    return filtered.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
  }, [sales, branch]);

  // Daily totals
  const dailyTotals = useMemo(() => {
    return filteredSales.reduce((acc, sale) => {
      const opening = Number(sale.opening_cash || 0);
      const closing = Number(sale.closing_cash || 0);
      const cashSales = Math.max(0, closing - opening);
      return {
        totalCashSales: acc.totalCashSales + cashSales,
        latestClosing: closing,
      };
    }, { totalCashSales: 0, latestClosing: 0 });
  }, [filteredSales]);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/60">
        <Banknote className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{lbl.title}</span>
        <Lock className="w-3 h-3 text-muted-foreground ms-auto" />
      </div>

      <div className="p-3 space-y-3">
        {/* Read-only note */}
        <p className="text-[10px] text-muted-foreground text-center italic">{lbl.read_only_note}</p>

        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
        ) : filteredSales.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{lbl.no_data}</p>
        ) : (
          <>
            {/* One card per shift record */}
            {filteredSales.map(sale => (
              <ShiftCard key={sale.id} sale={sale} currency={currency} lbl={lbl} />
            ))}

            {/* Daily Total */}
            {filteredSales.length > 1 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">{lbl.daily_total}</span>
                <span className="text-xl font-extrabold text-primary">{currency}{dailyTotals.totalCashSales.toLocaleString()}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
