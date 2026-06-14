import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { AlertTriangle, TrendingDown, DollarSign, Bell, UserX, Gift } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/helpers';
import { startOfMonth, subMonths, endOfMonth } from 'date-fns';
import { currentMonth, monthRange, summariseAttendance } from '@/lib/payrollEngine';

export default function Alerts() {
  const { t, currency, branches } = useLanguage();

  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.DailySales.list('-date', 1000), staleTime: 120000 });
  const { data: purchases = [] } = useQuery({ queryKey: ['purchases'], queryFn: () => base44.entities.Purchase.list('-date', 1000), staleTime: 120000 });
  const { data: attendanceAll = [] } = useQuery({ queryKey: ['attendance'], queryFn: () => base44.entities.Attendance.list('-date', 1000), staleTime: 300000 });
  const { data: bonusesAll = [] } = useQuery({ queryKey: ['employee_bonuses'], queryFn: () => base44.entities.EmployeeBonus.list('-date', 500), staleTime: 300000 });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list('name', 500), staleTime: 600000 });

  const alerts = useMemo(() => {
    const result = [];
    const now = new Date();
    const thisMonthStart = formatDate(startOfMonth(now));
    const thisMonthEnd = formatDate(endOfMonth(now));
    const lastMonthStart = formatDate(startOfMonth(subMonths(now, 1)));
    const lastMonthEnd = formatDate(endOfMonth(subMonths(now, 1)));

    const thisSales = sales.filter(s => s.date >= thisMonthStart && s.date <= thisMonthEnd);
    const lastSales = sales.filter(s => s.date >= lastMonthStart && s.date <= lastMonthEnd);
    const thisPurch = purchases.filter(p => p.date >= thisMonthStart && p.date <= thisMonthEnd);
    const lastPurch = purchases.filter(p => p.date >= lastMonthStart && p.date <= lastMonthEnd);

    const thisTotal = thisSales.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0);
    const lastTotal = lastSales.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0);
    const thisCost = thisPurch.reduce((s, p) => s + (p.qty || 0) * (p.used_price || p.current_price || 0), 0);
    const lastCost = lastPurch.reduce((s, p) => s + (p.qty || 0) * (p.used_price || p.current_price || 0), 0);

    const thisProfit = thisTotal - thisCost;
    const lastProfit = lastTotal - lastCost;
    const thisCredit = thisSales.reduce((s, r) => s + (r.credit || 0), 0);
    const thisCreditPct = thisTotal > 0 ? (thisCredit / thisTotal) * 100 : 0;

    // High credit risk
    if (thisCreditPct > 30) {
      result.push({
        id: 'credit_risk',
        type: 'danger',
        icon: AlertTriangle,
        title: t('alert_high_credit'),
        detail: `${thisCreditPct.toFixed(1)}% ${t('credit_pct')} — ${t('risk_high')}`,
      });
    }

    // Profit drop vs last month
    if (lastProfit > 0 && thisProfit < lastProfit * 0.8) {
      const drop = ((lastProfit - thisProfit) / lastProfit * 100).toFixed(1);
      result.push({
        id: 'profit_drop',
        type: 'warning',
        icon: TrendingDown,
        title: t('alert_profit_drop'),
        detail: `${drop}% drop — ${formatCurrency(thisProfit, currency)} vs ${formatCurrency(lastProfit, currency)}`,
      });
    }

    // Price increase alerts per product
    const productPrices = {};
    purchases.forEach(p => {
      if (!p.product_id || !p.used_price) return;
      if (!productPrices[p.product_id]) productPrices[p.product_id] = [];
      productPrices[p.product_id].push({ date: p.date, price: p.used_price, name: p.product_name });
    });
    Object.entries(productPrices).forEach(([pid, entries]) => {
      if (entries.length < 2) return;
      const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
      const oldest = sorted[0].price;
      const newest = sorted[sorted.length - 1].price;
      if (oldest > 0 && newest > oldest * 1.15) {
        const pct = ((newest - oldest) / oldest * 100).toFixed(1);
        result.push({
          id: `price_${pid}`,
          type: 'warning',
          icon: DollarSign,
          title: t('alert_price_increase'),
          detail: `${sorted[0].name || pid}: +${pct}% (${currency}${oldest} → ${currency}${newest})`,
        });
      }
    });

    // Per-branch credit alerts
    branches.forEach(b => {
      const bs = thisSales.filter(s => s.branch === b.key);
      const bt = bs.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0);
      const bc = bs.reduce((s, r) => s + (r.credit || 0), 0);
      const pct = bt > 0 ? (bc / bt) * 100 : 0;
      if (pct > 40) {
        result.push({
          id: `branch_credit_${b.key}`,
          type: 'danger',
          icon: AlertTriangle,
          title: `${b.label} — ${t('alert_high_credit')}`,
          detail: `${pct.toFixed(1)}% ${t('credit_pct')}`,
        });
      }
    });

    // === PAYROLL ALERTS ===
    const mon = currentMonth();
    const { from: mFrom, to: mTo } = monthRange(mon);
    const now2 = new Date();
    const dayOfMonth = now2.getDate();

    // Group attendance by employee for this month
    const empAttMap = {};
    attendanceAll.filter(r => r.date >= mFrom && r.date <= mTo).forEach(r => {
      if (!empAttMap[r.employee_id]) empAttMap[r.employee_id] = [];
      empAttMap[r.employee_id].push(r);
    });

    // Repeated absences (>3 this month)
    employees.forEach(emp => {
      const recs = empAttMap[emp.id] || [];
      const summary = summariseAttendance(recs);
      if (summary.absent >= 3) {
        result.push({
          id: `absent_${emp.id}`,
          type: 'warning',
          icon: UserX,
          title: `Repeated Absences — ${emp.name}`,
          detail: `${summary.absent} absences this month at ${emp.branch}`,
        });
      }
      // Excessive late (>4 times)
      if (summary.late >= 4) {
        result.push({
          id: `late_${emp.id}`,
          type: 'warning',
          icon: AlertTriangle,
          title: `Frequent Late Arrivals — ${emp.name}`,
          detail: `${summary.late} late occurrences this month at ${emp.branch}`,
        });
      }
    });

    // Unusually high bonuses (>50% of base salary)
    const monthBonuses = bonusesAll.filter(b => b.date >= mFrom && b.date <= mTo);
    employees.forEach(emp => {
      const empBonuses = monthBonuses.filter(b => b.employee_id === emp.id);
      const total = empBonuses.reduce((s, b) => s + (b.amount || 0), 0);
      const base = emp.base_salary || 0;
      if (base > 0 && total > base * 0.5) {
        result.push({
          id: `bonus_high_${emp.id}`,
          type: 'warning',
          icon: Gift,
          title: `High Bonus — ${emp.name}`,
          detail: `${formatCurrency(total, currency)} in bonuses (${Math.round((total/base)*100)}% of base salary)`,
        });
      }
    });

    // Unpaid salaries near month-end (after day 25)
    if (dayOfMonth >= 25) {
      const totalUnpaidSalary = employees
        .filter(e => e.is_active !== false)
        .reduce((s, e) => s + (e.base_salary || 0), 0);
      if (totalUnpaidSalary > 0) {
        result.push({
          id: 'payroll_due',
          type: 'danger',
          icon: DollarSign,
          title: 'Payroll Due',
          detail: `Month-end approaching — estimated ${formatCurrency(totalUnpaidSalary, currency)} payroll obligation`,
        });
      }
    }

    return result;
  }, [sales, purchases, branches, t, currency, attendanceAll, bonusesAll, employees]);

  const typeStyles = {
    danger: 'border-red-200 bg-red-50 dark:bg-red-950/20',
    warning: 'border-amber-200 bg-amber-50 dark:bg-amber-950/20',
  };
  const iconStyles = {
    danger: 'text-red-500',
    warning: 'text-amber-500',
  };

  return (
    <div>
      <PageHeader title={t('alerts_title')} />
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="w-12 h-12 text-emerald-400 mb-3" />
          <p className="text-muted-foreground text-sm">{t('no_alerts')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const Icon = alert.icon;
            return (
              <Card key={alert.id} className={`p-4 border ${typeStyles[alert.type]}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconStyles[alert.type]}`} />
                  <div>
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}