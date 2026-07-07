import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CreditCard, AlertCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/lib/TenantContext';

export default function AccountsPayableWidget() {
  const { lang, currency } = useLanguage();
  const { ownerFilter } = useTenant();
  const { data: invoices = [] } = useQuery({
    queryKey: ['all_invoices', ownerFilter],
    queryFn: () => base44.entities.SupplierInvoice.filter({ ...ownerFilter, status: 'unpaid' }),
    enabled: !!ownerFilter.created_by,
  });
  const { data: partials = [] } = useQuery({
    queryKey: ['partial_invoices', ownerFilter],
    queryFn: () => base44.entities.SupplierInvoice.filter({ ...ownerFilter, status: 'partial' }),
    enabled: !!ownerFilter.created_by,
  });

  const allUnpaid = useMemo(() => [...invoices, ...partials], [invoices, partials]);
  const today = format(new Date(), 'yyyy-MM-dd');

  const totalOwed = useMemo(() => allUnpaid.reduce((s, i) => s + (i.amount - (i.paid_amount || 0)), 0), [allUnpaid]);
  const overdueCount = useMemo(() => allUnpaid.filter(i => i.due_date && i.due_date < today).length, [allUnpaid, today]);
  const dueSoonCount = useMemo(() => allUnpaid.filter(i => {
    if (!i.due_date) return false;
    const diff = (new Date(i.due_date) - new Date()) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length, [allUnpaid]);

  if (allUnpaid.length === 0) return null;

  const title = lang === 'ar' ? 'الذمم الدائنة' : lang === 'fa' ? 'حساب‌های پرداختنی' : 'Accounts Payable';
  const overdueLabel = lang === 'ar' ? 'متأخرة' : lang === 'fa' ? 'معوق' : 'Overdue';
  const dueSoonLabel = lang === 'ar' ? 'مستحقة قريباً' : lang === 'fa' ? 'به‌زودی سررسید' : 'Due Soon';
  const viewLabel = lang === 'ar' ? 'الموردون' : lang === 'fa' ? 'تامین‌کنندگان' : 'Suppliers';

  return (
    <Card className="mb-4 border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
            <CreditCard className="w-4 h-4" /> {title}
          </CardTitle>
          <Button size="sm" variant="ghost" asChild className="text-xs">
            <Link to="/suppliers">{viewLabel}</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground mb-3">{currency} {totalOwed.toLocaleString()}</p>
        <div className="flex gap-3 flex-wrap">
          {overdueCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="w-3 h-3" />
              {overdueCount} {overdueLabel}
            </div>
          )}
          {dueSoonCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <Clock className="w-3 h-3" />
              {dueSoonCount} {dueSoonLabel}
            </div>
          )}
        </div>
        {/* Aging buckets */}
        <div className="mt-3 space-y-1">
          {[
            { label: lang === 'ar' ? 'الجاري' : lang === 'fa' ? 'جاری' : 'Current', filter: (i) => !i.due_date || i.due_date >= today },
            { label: lang === 'ar' ? '1-30 يوم' : lang === 'fa' ? '1-30 روز' : '1-30 days', filter: (i) => { if (!i.due_date) return false; const d = (new Date(today) - new Date(i.due_date)) / 86400000; return d >= 1 && d <= 30; } },
            { label: lang === 'ar' ? '+30 يوم' : lang === 'fa' ? '+30 روز' : '30+ days', filter: (i) => i.due_date && (new Date(today) - new Date(i.due_date)) / 86400000 > 30 },
          ].map(bucket => {
            const bucketInvoices = allUnpaid.filter(bucket.filter);
            const bucketTotal = bucketInvoices.reduce((s, i) => s + (i.amount - (i.paid_amount || 0)), 0);
            if (bucketTotal === 0) return null;
            return (
              <div key={bucket.label} className="flex justify-between text-xs text-muted-foreground">
                <span>{bucket.label}</span>
                <span className="font-medium">{currency} {bucketTotal.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}