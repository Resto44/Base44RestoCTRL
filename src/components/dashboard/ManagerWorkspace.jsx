import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { useLanguage } from '@/lib/LanguageContext';
import { formatCurrency } from '@/lib/helpers';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  GitBranch, TrendingUp, DollarSign, ShoppingCart, Receipt,
  Users, ShoppingBag, Package, ArrowRight, BarChart3,
  AlertTriangle, CheckCircle2
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
const UI = {
  en: {
    greeting: 'Branch Operations',
    your_branch: 'Your Branch',
    last_30: 'Last 30 Days',
    sales: 'Sales',
    expenses: 'Expenses',
    purchases: 'Purchases',
    employees: 'Employees',
    profit: 'Profit',
    quick_actions: 'Quick Actions',
    add_sales: 'Add Sales',
    add_purchase: 'Add Purchase',
    add_expense: 'Add Expense',
    view_employees: 'Employees',
    view_attendance: 'Attendance',
    trend: 'Sales Trend (30d)',
    no_data: 'No data yet for this period.',
    drivers: 'Drivers',
    inventory: 'Inventory',
    tasks: 'Tasks',
  },
  ar: {
    greeting: 'عمليات الفرع',
    your_branch: 'فرعك',
    last_30: 'آخر 30 يوماً',
    sales: 'المبيعات',
    expenses: 'المصاريف',
    purchases: 'المشتريات',
    employees: 'الموظفون',
    profit: 'الربح',
    quick_actions: 'إجراءات سريعة',
    add_sales: 'إضافة مبيعات',
    add_purchase: 'إضافة مشتريات',
    add_expense: 'إضافة مصروف',
    view_employees: 'الموظفون',
    view_attendance: 'الحضور',
    trend: 'اتجاه المبيعات (30 يوم)',
    no_data: 'لا توجد بيانات لهذه الفترة.',
    drivers: 'السائقون',
    inventory: 'المخزون',
    tasks: 'المهام',
  },
  fa: {
    greeting: 'عملیات شعبه',
    your_branch: 'شعبه شما',
    last_30: '۳۰ روز گذشته',
    sales: 'فروش',
    expenses: 'هزینه‌ها',
    purchases: 'خریدها',
    employees: 'کارمندان',
    profit: 'سود',
    quick_actions: 'اقدامات سریع',
    add_sales: 'افزودن فروش',
    add_purchase: 'افزودن خرید',
    add_expense: 'افزودن هزینه',
    view_employees: 'کارمندان',
    view_attendance: 'حضور و غیاب',
    trend: 'روند فروش (۳۰ روز)',
    no_data: 'داده‌ای برای این دوره وجود ندارد.',
    drivers: 'راننده‌ها',
    inventory: 'انبار',
    tasks: 'وظایف',
  },
};

export default function ManagerWorkspace() {
  const { lang, currency } = useLanguage();
  const u = UI[lang] || UI.en;
  const { branches, ownerFilter, managerBranch } = useTenant();

  const myBranch = branches.find(b => b.key === managerBranch) || branches[0];
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: sales = [] } = useQuery({
    queryKey: ['mgr_sales', ownerFilter],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter, '-date', 200),
    staleTime: 60000,
    enabled: !!(ownerFilter?.branch),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['mgr_expenses', ownerFilter],
    queryFn: () => base44.entities.Expense.filter(ownerFilter, '-date', 200),
    staleTime: 60000,
    enabled: !!(ownerFilter?.branch),
  });
  const { data: purchases = [] } = useQuery({
    queryKey: ['mgr_purchases', ownerFilter],
    queryFn: () => base44.entities.Purchase.filter(ownerFilter, '-date', 200),
    staleTime: 60000,
    enabled: !!(ownerFilter?.branch),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['mgr_employees', ownerFilter],
    queryFn: () => base44.entities.Employee.filter(ownerFilter, 'full_name', 100),
    staleTime: 120000,
    enabled: !!(ownerFilter?.branch),
  });

  const recentSales = sales.filter(s => s.date >= thirtyDaysAgo);
  const totalSales = recentSales.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0);
  const totalExpenses = expenses.filter(e => e.date >= thirtyDaysAgo).reduce((s, e) => s + (e.amount || 0), 0);
  const totalPurchases = purchases.filter(p => p.date >= thirtyDaysAgo).reduce((s, p) => s + ((p.used_price || p.current_price || 0) * (p.qty || 1)), 0);
  const profit = totalSales - totalExpenses - totalPurchases;

  // Build daily trend for past 14 days
  const trendData = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const daySales = sales.filter(s => s.date === d);
      const total = daySales.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0);
      days.push({ day: format(subDays(new Date(), i), 'MM/dd'), total });
    }
    return days;
  }, [sales]);

  const quickActions = [
    { to: '/sales', label: u.add_sales, icon: ShoppingBag, color: 'bg-primary/10 text-primary border-primary/20' },
    { to: '/enterprise-purchases', label: u.add_purchase, icon: Package, color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20' },
    { to: '/expenses', label: u.add_expense, icon: Receipt, color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20' },
    { to: '/employees', label: u.view_employees, icon: Users, color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20' },
    { to: '/employee-attendance', label: u.view_attendance, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20' },
    { to: '/inventory', label: u.inventory, icon: BarChart3, color: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/20' },
    { to: '/tasks', label: u.tasks, icon: CheckCircle2, color: 'bg-muted text-foreground border-border' },
    { to: '/staff-attendance', label: 'Check-in', icon: GitBranch, color: 'bg-muted text-foreground border-border' },
  ];

  return (
    <div className="space-y-4">
      {/* Branch Badge */}
      {myBranch && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-xl border border-primary/10">
          <GitBranch className="w-4 h-4 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">{u.your_branch}</p>
            <p className="text-sm font-bold text-primary">{myBranch.label}</p>
          </div>
          {myBranch.manager_name && (
            <Badge className="ml-auto text-xs bg-primary/10 text-primary">{myBranch.manager_name}</Badge>
          )}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><DollarSign className="w-2.5 h-2.5" />{u.sales}</p>
          <p className="text-base font-black text-emerald-600">{formatCurrency(totalSales, currency)}</p>
          <p className="text-[10px] text-muted-foreground">{u.last_30}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Receipt className="w-2.5 h-2.5" />{u.expenses}</p>
          <p className="text-base font-black text-red-500">{formatCurrency(totalExpenses, currency)}</p>
          <p className="text-[10px] text-muted-foreground">{u.last_30}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><ShoppingCart className="w-2.5 h-2.5" />{u.purchases}</p>
          <p className="text-base font-black text-amber-600">{formatCurrency(totalPurchases, currency)}</p>
          <p className="text-[10px] text-muted-foreground">{u.last_30}</p>
        </Card>
        <Card className={`p-3 ${profit >= 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20' : 'bg-red-50 border-red-200 dark:bg-red-950/20'}`}>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            {profit >= 0 ? <TrendingUp className="w-2.5 h-2.5 text-emerald-600" /> : <AlertTriangle className="w-2.5 h-2.5 text-red-500" />}
            {u.profit}
          </p>
          <p className={`text-base font-black ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(profit, currency)}</p>
          <p className="text-[10px] text-muted-foreground">{u.last_30}</p>
        </Card>
      </div>

      {/* Sales Trend Chart */}
      {trendData.some(d => d.total > 0) && (
        <Card className="p-3">
          <p className="text-xs font-semibold mb-2">{u.trend}</p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={trendData} margin={{ left: -20, right: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${v > 999 ? `${(v/1000).toFixed(0)}k` : v}`} />
              <Tooltip formatter={v => formatCurrency(v, currency)} />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}



      {/* Employees quick stat */}
      {employees.length > 0 && (
        <Card className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <div>
              <p className="text-xs font-semibold">{u.employees}</p>
              <p className="text-[10px] text-muted-foreground">{employees.filter(e => e.is_active !== false).length} active</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/employees"><ArrowRight className="w-4 h-4" /></Link>
          </Button>
        </Card>
      )}
    </div>
  );
}