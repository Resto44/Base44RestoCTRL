import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Card } from '@/components/ui/card';
import { Bike, Banknote, CreditCard } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const LABELS = {
  en: {
    title: 'Driver Performance',
    this_month: 'This Month',
    driver: 'Driver',
    cash: 'Cash',
    network: 'Network',
    total: 'Total',
    days: 'Days',
    no_drivers: 'No driver data this month',
    outstanding: 'Outstanding',
    settled: 'Settled',
  },
  ar: {
    title: 'أداء السائقين',
    this_month: 'هذا الشهر',
    driver: 'السائق',
    cash: 'نقداً',
    network: 'شبكة',
    total: 'الإجمالي',
    days: 'أيام',
    no_drivers: 'لا بيانات سائق هذا الشهر',
    outstanding: 'معلق',
    settled: 'مُسوَّى',
  },
  fa: {
    title: 'عملکرد رانندگان',
    this_month: 'این ماه',
    driver: 'راننده',
    cash: 'نقد',
    network: 'شبکه',
    total: 'کل',
    days: 'روز',
    no_drivers: 'داده‌ای برای این ماه وجود ندارد',
    outstanding: 'معلق',
    settled: 'تسویه',
  },
};

export default function DriverAnalytics({ branch = 'all' }) {
  const { language, currency } = useLanguage();
  const { ownerFilter } = useTenant();
  const lbl = LABELS[language] || LABELS.en;

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: sales = [] } = useQuery({
    queryKey: ['sales_driver_analytics', ownerFilter, branch, monthStart],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter, '-date', 10000),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 60000,
  });

  const driverStats = useMemo(() => {
    const filtered = sales.filter(s => {
      if (!s.date) return false;
      if (s.date < monthStart || s.date > monthEnd) return false;
      if (branch !== 'all' && s.branch !== branch) return false;
      return (s.driver_cash || 0) > 0 || (s.driver_network || 0) > 0 || s.driver_name;
    });

    const map = {};
    for (const s of filtered) {
      const key = s.driver_employee_id || s.driver_name || 'unknown';
      if (!key || key === 'unknown') continue;
      if (!map[key]) {
        map[key] = {
          name: s.driver_name || key,
          cash: 0,
          network: 0,
          days: 0,
          branch: s.branch,
        };
      }
      map[key].cash += (s.driver_cash || 0);
      map[key].network += (s.driver_network || 0);
      map[key].days += 1;
    }

    return Object.values(map).sort((a, b) => (b.cash + b.network) - (a.cash + a.network));
  }, [sales, branch, monthStart, monthEnd]);

  if (driverStats.length === 0) {
    return (
      <Card className="p-4 text-center text-muted-foreground text-sm">
        <Bike className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p>{lbl.no_drivers}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Bike className="w-3.5 h-3.5" /> {lbl.title} — {lbl.this_month}
      </p>
      {driverStats.map(d => {
        const total = d.cash + d.network;
        const cashPct = total > 0 ? Math.round((d.cash / total) * 100) : 0;
        return (
          <Card key={d.name} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                  <Bike className="w-3.5 h-3.5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{d.name}</p>
                  <p className="text-[10px] text-muted-foreground">{d.days} {lbl.days}</p>
                </div>
              </div>
              <p className="text-base font-bold text-primary">{currency}{total.toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-secondary/50 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                <div>
                  <p className="text-[10px] text-muted-foreground">{lbl.cash}</p>
                  <p className="text-xs font-bold">{currency}{d.cash.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-secondary/50 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <div>
                  <p className="text-[10px] text-muted-foreground">{lbl.network}</p>
                  <p className="text-xs font-bold">{currency}{d.network.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Cash/network bar */}
            <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${cashPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-emerald-600">{cashPct}% cash</span>
              <span className="text-[9px] text-blue-600">{100 - cashPct}% network</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}