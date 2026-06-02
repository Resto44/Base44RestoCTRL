import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useRole } from '@/lib/RoleContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import BranchSelect from '@/components/shared/BranchSelect';
import { formatCurrency } from '@/lib/helpers';
import { buildPayrollRow, monthRange, currentMonth } from '@/lib/payrollEngine';
import { Download, CheckCircle2, AlertTriangle, Users, TrendingDown, Gift } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  draft: 'bg-secondary text-secondary-foreground',
  finalized: 'bg-blue-100 text-blue-700 border-blue-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export default function PayrollReport() {
  const { currency, branches } = useLanguage();
  const { role } = useRole();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [filterBranch, setFilterBranch] = useState('all');
  const [confirmFinalize, setConfirmFinalize] = useState(null);
  const [generating, setGenerating] = useState(false);

  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list('name', 500) });
  const { data: attendanceAll = [] } = useQuery({ queryKey: ['attendance'], queryFn: () => base44.entities.Attendance.list('-date', 5000) });
  const { data: bonusesAll = [] } = useQuery({ queryKey: ['employee_bonuses'], queryFn: () => base44.entities.EmployeeBonus.list('-date', 1000) });
  const { data: advancesAll = [] } = useQuery({ queryKey: ['salary_advances'], queryFn: () => base44.entities.SalaryAdvance.list('-date', 1000) });
  const { data: rulesAll = [] } = useQuery({ queryKey: ['deduction_rules'], queryFn: () => base44.entities.DeductionRule.list() });
  const { data: payrollRuns = [], refetch: refetchRuns } = useQuery({ queryKey: ['payroll_runs', month], queryFn: () => base44.entities.PayrollRun.filter({ month }) });

  const { from, to } = monthRange(month);

  const rows = useMemo(() => {
    const filteredEmp = employees.filter(e =>
      e.is_active !== false &&
      (filterBranch === 'all' || e.branch === filterBranch)
    );

    return filteredEmp.map(emp => {
      // Check if payroll already finalized for this employee this month
      const existing = payrollRuns.find(r => r.employee_id === emp.id && r.month === month);
      if (existing) return { ...existing, _saved: true };

      const empAttendance = attendanceAll.filter(r => r.employee_id === emp.id && r.date >= from && r.date <= to);
      const empBonuses = bonusesAll.filter(b => b.employee_id === emp.id && b.date >= from && b.date <= to);
      const empAdvances = advancesAll.filter(a => a.employee_id === emp.id && a.month === month);
      return buildPayrollRow(emp, empAttendance, empBonuses, empAdvances, rulesAll);
    });
  }, [employees, filterBranch, month, attendanceAll, bonusesAll, advancesAll, rulesAll, payrollRuns, from, to]);

  const updateRun = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PayrollRun.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll_runs', month] }),
  });

  const createRun = useMutation({
    mutationFn: d => base44.entities.PayrollRun.create(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll_runs', month] }),
  });

  const handleFinalize = async (row) => {
    if (row._saved) {
      await updateRun.mutateAsync({ id: row.id, data: { status: 'finalized' } });
    } else {
      await createRun.mutateAsync({ ...row, month, status: 'finalized' });
    }
    setConfirmFinalize(null);
  };

  const handleMarkPaid = async (row) => {
    if (row._saved) {
      await updateRun.mutateAsync({ id: row.id, data: { status: 'paid', paid_date: format(new Date(), 'yyyy-MM-dd') } });
    }
  };

  const exportCSV = () => {
    const headers = ['Employee', 'Branch', 'Base Salary', 'Bonuses', 'Deductions', 'Advances', 'Final Salary', 'Present Days', 'Absent Days', 'Late Days', 'Hours', 'Status'];
    const csvRows = rows.map(r => [
      r.employee_name, r.branch, r.base_salary, r.bonuses, r.deductions, r.advances,
      r.final_salary, r.present_days, r.absent_days, r.late_days, (r.total_hours || 0).toFixed(1), r.status || 'draft'
    ]);
    const csv = [headers, ...csvRows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `payroll_${month}.csv`;
    a.click();
  };

  const totals = useMemo(() => ({
    base: rows.reduce((s, r) => s + (r.base_salary || 0), 0),
    bonuses: rows.reduce((s, r) => s + (r.bonuses || 0), 0),
    deductions: rows.reduce((s, r) => s + (r.deductions || 0), 0),
    advances: rows.reduce((s, r) => s + (r.advances || 0), 0),
    final: rows.reduce((s, r) => s + (r.final_salary || 0), 0),
    unpaid: rows.filter(r => r.status !== 'paid').reduce((s, r) => s + (r.final_salary || 0), 0),
  }), [rows]);

  // Deduction warnings (>20% of base)
  const highDeductions = rows.filter(r => r.base_salary > 0 && (r.deductions / r.base_salary) > 0.2);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm flex-1" />
        <BranchSelect value={filterBranch} onChange={setFilterBranch} includeAll />
        <Button size="sm" variant="outline" onClick={exportCSV}><Download className="w-3.5 h-3.5" /></Button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 text-center">
          <Users className="w-4 h-4 mx-auto mb-1 text-primary" />
          <p className="text-base font-bold">{formatCurrency(totals.final, currency)}</p>
          <p className="text-xs text-muted-foreground">Total Payroll</p>
        </Card>
        <Card className="p-3 text-center bg-red-50 border-red-100">
          <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-red-500" />
          <p className="text-base font-bold text-red-600">{formatCurrency(totals.unpaid, currency)}</p>
          <p className="text-xs text-red-500">Unpaid</p>
        </Card>
        <Card className="p-3 text-center bg-emerald-50 border-emerald-100">
          <Gift className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
          <p className="text-sm font-bold text-emerald-700">{formatCurrency(totals.bonuses, currency)}</p>
          <p className="text-xs text-emerald-600">Bonuses</p>
        </Card>
        <Card className="p-3 text-center bg-amber-50 border-amber-100">
          <TrendingDown className="w-4 h-4 mx-auto mb-1 text-amber-600" />
          <p className="text-sm font-bold text-amber-700">{formatCurrency(totals.deductions, currency)}</p>
          <p className="text-xs text-amber-600">Deductions</p>
        </Card>
      </div>

      {/* Deduction warnings */}
      {highDeductions.length > 0 && (
        <Card className="p-3 border-amber-300 bg-amber-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700">High Deduction Warning</p>
              {highDeductions.map(r => (
                <p key={r.employee_id || r.employee_name} className="text-xs text-amber-600">
                  {r.employee_name}: {formatCurrency(r.deductions, currency)} deducted ({Math.round((r.deductions / r.base_salary) * 100)}% of base)
                </p>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Employee rows */}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">No employees found</p>
        ) : rows.map((row, i) => (
          <Card key={row.employee_id || i} className="p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-semibold text-sm">{row.employee_name}</p>
                <p className="text-xs text-muted-foreground">{row.branch}</p>
              </div>
              <Badge className={STATUS_COLORS[row.status || 'draft']}>{row.status || 'draft'}</Badge>
            </div>

            {/* Attendance summary */}
            <div className="flex gap-3 text-xs mb-2">
              <span className="text-emerald-600">✓ {row.present_days} present</span>
              <span className="text-red-500">✗ {row.absent_days} absent</span>
              <span className="text-amber-600">⏱ {row.late_days} late</span>
              <span className="text-muted-foreground">{(row.total_hours || 0).toFixed(0)}h</span>
            </div>

            {/* Salary breakdown */}
            <div className="bg-muted/40 rounded-lg p-2 space-y-1 text-xs mb-2">
              <div className="flex justify-between"><span>Base Salary</span><span>{formatCurrency(row.base_salary, currency)}</span></div>
              {row.bonuses > 0 && <div className="flex justify-between text-emerald-600"><span>+ Bonuses</span><span>{formatCurrency(row.bonuses, currency)}</span></div>}
              {row.deductions > 0 && <div className="flex justify-between text-red-500"><span>− Deductions</span><span>{formatCurrency(row.deductions, currency)}</span></div>}
              {row.advances > 0 && <div className="flex justify-between text-amber-600"><span>− Advances</span><span>{formatCurrency(row.advances, currency)}</span></div>}
              <div className="flex justify-between font-bold border-t border-border pt-1 text-sm">
                <span>= Final Payable</span><span className="text-primary">{formatCurrency(row.final_salary, currency)}</span>
              </div>
            </div>

            {/* Actions */}
            {role === 'owner' && (
              <div className="flex gap-2">
                {(!row.status || row.status === 'draft') && (
                  <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => setConfirmFinalize(row)}>
                    Finalize
                  </Button>
                )}
                {row.status === 'finalized' && row._saved && (
                  <Button size="sm" className="flex-1 text-xs h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleMarkPaid(row)}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Paid
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <AlertDialog open={!!confirmFinalize} onOpenChange={() => setConfirmFinalize(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize Payroll for {confirmFinalize?.employee_name}?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground px-6">
            Final Payable: {formatCurrency(confirmFinalize?.final_salary, currency)}<br />
            Deductions: {formatCurrency(confirmFinalize?.deductions, currency)}<br />
            This action will lock the payroll record for this employee.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleFinalize(confirmFinalize)}>Finalize</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}