/**
 * ExecutiveSummaryBar
 * Adds the "owner-level" KPIs that the main P&L grid doesn't cover:
 *   branches, employees, open debts, last payroll.
 * Kept as a separate component so Dashboard.jsx stays lean.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { formatCurrency } from '@/lib/helpers';
import { Card } from '@/components/ui/card';
import { GitBranch, Users, CreditCard, Banknote } from 'lucide-react';

const UI = {
  en: { branches: 'Active Branches', employees: 'Employees', open_debt: 'Open Debts', last_payroll: 'Last Payroll', na: 'N/A' },
  ar: { branches: 'الفروع النشطة', employees: 'الموظفون', open_debt: 'الديون المفتوحة', last_payroll: 'آخر رواتب', na: 'لا يوجد' },
  fa: { branches: 'شعب فعال', employees: 'کارمندان', open_debt: 'بدهی‌های باز', last_payroll: 'آخرین حقوق', na: 'ندارد' },
};

export default function ExecutiveSummaryBar() {
  const { lang, currency } = useLanguage();
  const { branches, ownerFilter } = useTenant();
  const u = UI[lang] || UI.en;

  const { data: employees = [] } = useQuery({
    queryKey: ['employees_exec', ownerFilter],
    queryFn: () => base44.entities.Employee.filter({ ...ownerFilter, is_active: true }, 'full_name', 500),
    staleTime: 300000,
    enabled: !!ownerFilter.created_by,
  });

  const { data: debts = [] } = useQuery({
    queryKey: ['debts_exec', ownerFilter],
    queryFn: () => base44.entities.DebtRecord.filter({ ...ownerFilter, status: 'open' }, '-date', 200),
    staleTime: 120000,
    enabled: !!ownerFilter.created_by,
  });

  const { data: payrollRuns = [] } = useQuery({
    queryKey: ['payroll_runs_exec', ownerFilter],
    queryFn: () => base44.entities.PayrollRun.filter(ownerFilter, '-paid_date', 5),
    staleTime: 300000,
    enabled: !!ownerFilter.created_by,
  });

  const activeBranches = branches.length;
  const employeeCount = employees.length;
  const totalOpenDebt = debts.reduce((s, d) => s + (d.remaining_amount || d.total_amount || 0), 0);
  const lastPayroll = payrollRuns[0];
  const lastPayrollAmount = lastPayroll ? formatCurrency(lastPayroll.total_net || 0, currency) : u.na;

  const tiles = [
    { label: u.branches,    value: activeBranches,     icon: GitBranch, color: 'text-indigo-500',  bg: 'bg-indigo-50 dark:bg-indigo-950/20' },
    { label: u.employees,   value: employeeCount,       icon: Users,     color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
    { label: u.open_debt,   value: formatCurrency(totalOpenDebt, currency), icon: CreditCard, color: totalOpenDebt > 0 ? 'text-red-500' : 'text-emerald-500', bg: 'bg-red-50 dark:bg-red-950/20' },
    { label: u.last_payroll, value: lastPayrollAmount,  icon: Banknote,  color: 'text-amber-500',   bg: 'bg-amber-50 dark:bg-amber-950/20' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {tiles.map(({ label, value, icon: Icon, color, bg }) => (
        <Card key={label} className={`p-3 flex items-center gap-2.5 border-0 shadow-sm ${bg}`}>
          <div className={`p-2 rounded-lg bg-white/70 dark:bg-background/50 ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground leading-tight">{label}</p>
            <p className="text-base font-black text-foreground leading-tight">{value}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}