/**
 * CashRegister — READ ONLY.
 * Automatically reads opening_cash, closing_cash, cash_difference, cash_status
 * from the latest DailySales record for the selected branch and date.
 * NO manual entry. Source of truth = Add Sale records.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { format } from 'date-fns';
import { Banknote, CheckCircle2, TrendingDown, TrendingUp, Lock } from 'lucide-react';

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
    read_only_note: 'Auto-read from Add Sale record',
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
    read_only_note: 'تُقرأ تلقائياً من سجل إضافة المبيعات',
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
    read_only_note: 'خوانده‌شده از رکورد افزودن فروش',
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

function ReadOnlyField({ label, value, currency, color }) {
  return (
    <div className="rounded-xl p-3 bg-muted/60">
      <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">{label}</p>
      <p className={`text-2xl font-bold text-center ${color || 'text-foreground'}`}>
        {currency}{Number(value || 0).toLocaleString()}
      </p>
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

  // Latest sale record for the selected branch and date
  const latestSale = useMemo(() => {
    const filtered = (!branch || branch === 'all')
      ? sales
      : sales.filter(s => s.branch === branch);
    // Sort by created_date descending, take first
    return filtered.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))[0] || null;
  }, [sales, branch]);

  const openingCash = Number(latestSale?.opening_cash || 0);
  const closingCash = Number(latestSale?.closing_cash || 0);
  // cash_difference = closing - opening (as per spec)
  const cashDifference = latestSale ? (closingCash - openingCash) : null;
  const cashStatus = latestSale?.cash_status || (
    cashDifference === null ? null :
    cashDifference === 0 ? 'Balanced' :
    cashDifference < 0 ? 'Shortage' : 'Overage'
  );

  const diffColor = cashDifference === null ? '' : cashDifference > 0 ? 'text-amber-600' : cashDifference < 0 ? 'text-red-600' : 'text-emerald-600';

  return (
    <div className="rounded-xl border border-border overflow-hidden">
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
        ) : !latestSale ? (
          <p className="text-xs text-muted-foreground text-center py-4">{lbl.no_data}</p>
        ) : (
          <>
            {/* Opening & Closing */}
            <div className="grid grid-cols-2 gap-3">
              <ReadOnlyField label={lbl.opening_cash} value={openingCash} currency={currency} color="text-blue-600" />
              <ReadOnlyField label={lbl.closing_cash} value={closingCash} currency={currency} color="text-foreground" />
            </div>

            {/* Cash Difference */}
            {cashDifference !== null && (
              <div className="rounded-xl p-3 bg-muted/40 border border-border">
                <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">{lbl.cash_difference}</p>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-extrabold ${diffColor}`}>
                    {cashDifference >= 0 ? '+' : ''}{currency}{Math.abs(cashDifference).toLocaleString()}
                  </span>
                  <CashStatusBadge status={cashStatus} lbl={lbl} />
                </div>
              </div>
            )}

            {/* Cash Status */}
            {cashStatus && (
              <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted/30">
                <span className="text-xs text-muted-foreground font-medium">{lbl.cash_status}</span>
                <CashStatusBadge status={cashStatus} lbl={lbl} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
