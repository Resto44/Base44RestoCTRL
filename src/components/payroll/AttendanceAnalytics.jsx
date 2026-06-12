import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, AlertTriangle, Clock, Users } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/helpers';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STATUS_COLORS = { present: '#10b981', late: '#f59e0b', absent: '#ef4444', half_day: '#3b82f6', vacation: '#8b5cf6' };

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function employeeKey(employee = {}) {
  return employee.employee_id ?? employee.id ?? '';
}

function sameEmployee(recordEmployeeId, employeeId) {
  return String(recordEmployeeId ?? '') === String(employeeId ?? '');
}

function inDateRange(date, from, to) {
  return Boolean(date && date >= from && date <= to);
}

function safePercent(percent) {
  return Number.isFinite(percent) ? percent : 0;
}

export default function AttendanceAnalytics() {
  const { t, currency, branches } = useLanguage();
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [lookbackDays, setLookbackDays] = useState(30);

  const { data: attendanceData = [] } = useQuery({ queryKey: ['attendance'], queryFn: () => base44.entities.Attendance.list('-date', 5000) });
  const { data: employeesData = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list('full_name', 500) });
  const { data: bonusesData = [] } = useQuery({ queryKey: ['employee_bonuses'], queryFn: () => base44.entities.EmployeeBonus.list('-date', 1000) });

  const attendance = useMemo(() => safeArray(attendanceData), [attendanceData]);
  const employees = useMemo(() => safeArray(employeesData), [employeesData]);
  const bonuses = useMemo(() => safeArray(bonusesData), [bonusesData]);
  const branchOptions = useMemo(() => safeArray(branches), [branches]);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - lookbackDays);
    return formatDate(d);
  }, [lookbackDays]);

  const today = formatDate(new Date());

  const employeeById = useMemo(() => {
    const map = {};
    employees.forEach(emp => {
      const id = employeeKey(emp);
      if (id) map[String(id)] = emp;
    });
    return map;
  }, [employees]);

  const filteredAttendance = useMemo(() =>
    attendance.filter(r => {
      if (!r || !inDateRange(r.date, cutoff, today)) return false;
      if (selectedBranch === 'all') return true;
      const emp = employeeById[String(r.employee_id ?? '')];
      return (r.branch || emp?.branch) === selectedBranch;
    }), [attendance, cutoff, today, selectedBranch, employeeById]);

  // Status distribution for pie
  const statusDist = useMemo(() => {
    const counts = {};
    filteredAttendance.forEach(r => {
      const status = r?.status || 'unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({ name: t(status) || status, value: count, status }));
  }, [filteredAttendance, t]);

  // Attendance by day of week
  const byDayOfWeek = useMemo(() => {
    const map = Array(7).fill(null).map((_, i) => ({ day: DAYS[i], present: 0, absent: 0, late: 0 }));
    filteredAttendance.forEach(r => {
      if (!r?.date) return;
      const dow = new Date(r.date).getDay(); // 0=Sun
      if (!Number.isFinite(dow)) return;
      const idx = dow === 0 ? 6 : dow - 1; // Mon=0
      if (!map[idx]) return;
      if (r.status === 'present' || r.status === 'half_day') map[idx].present++;
      else if (r.status === 'absent') map[idx].absent++;
      else if (r.status === 'late') map[idx].late++;
    });
    return map;
  }, [filteredAttendance]);

  // Per-employee performance
  const employeePerformance = useMemo(() => {
    const map = {};

    filteredAttendance.forEach(r => {
      if (!r?.employee_id) return;

      const id = String(r.employee_id);
      const emp = employeeById[id];
      const branch = r.branch || emp?.branch || 'unassigned';
      const name = emp?.full_name || r.employee_name || id;

      if (!map[id]) map[id] = { name, branch, present: 0, absent: 0, late: 0, hours: 0, total: 0 };

      if (r.status !== 'vacation') map[id].total++;
      map[id].hours += toNumber(r.hours_worked);

      if (r.status === 'present') map[id].present++;
      else if (r.status === 'half_day') map[id].present += 0.5;
      else if (r.status === 'late') { map[id].present++; map[id].late++; }
      else if (r.status === 'absent') map[id].absent++;
    });

    // Attach bonus info
    const periodBonuses = bonuses.filter(b => inDateRange(b?.date, cutoff, today));
    periodBonuses.forEach(b => {
      const id = String(b?.employee_id ?? '');
      if (map[id]) {
        map[id].totalBonus = toNumber(map[id].totalBonus) + toNumber(b.amount);
      }
    });

    return Object.entries(map).map(([id, v]) => ({
      id, ...v,
      rate: v.total > 0 ? Math.min(100, Math.round((toNumber(v.present) / v.total) * 100)) : 0,
    })).sort((a, b) => b.rate - a.rate);
  }, [filteredAttendance, bonuses, cutoff, today, employeeById]);

  const totalPresent = filteredAttendance.filter(r => r?.status === 'present' || r?.status === 'late' || r?.status === 'half_day').length;
  const totalAbsent = filteredAttendance.filter(r => r?.status === 'absent').length;
  const totalLate = filteredAttendance.filter(r => r?.status === 'late').length;
  const avgRate = employeePerformance.length > 0
    ? Math.round(employeePerformance.reduce((s, e) => s + toNumber(e.rate), 0) / employeePerformance.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={String(lookbackDays)} onValueChange={v => setLookbackDays(Number(v) || 30)}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{t('last_7_days')}</SelectItem>
            <SelectItem value="30">{t('last_30_days')}</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_branches')}</SelectItem>
            {branchOptions.map(b => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { IconComp: Users, label: t('present'), val: totalPresent, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { IconComp: AlertTriangle, label: t('absent'), val: totalAbsent, color: 'text-red-600', bg: 'bg-red-50' },
          { IconComp: Clock, label: t('late'), val: totalLate, color: 'text-amber-600', bg: 'bg-amber-50' },
          { IconComp: TrendingUp, label: t('analytics'), val: `${avgRate}%`, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(({ IconComp, label, val, color, bg }) => (
          <Card key={label} className={`p-3 text-center ${bg} border-0`}>
            <IconComp className={`w-4 h-4 mx-auto mb-1 ${color}`} />
            <p className={`text-lg font-bold ${color}`}>{val}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </Card>
        ))}
      </div>

      {/* Status pie + day-of-week bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {statusDist.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">{t('status')} Distribution</h3>
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${(safePercent(percent) * 100).toFixed(0)}%`} labelLine={false}>
                  {statusDist.map((entry, i) => (
                    <Cell key={`${entry.status}-${i}`} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Attendance by Day of Week</h3>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={byDayOfWeek}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="present" fill="#10b981" stackId="a" name={t('present')} radius={[0,0,0,0]} />
              <Bar dataKey="late" fill="#f59e0b" stackId="a" name={t('late')} />
              <Bar dataKey="absent" fill="#ef4444" stackId="a" name={t('absent')} radius={[4,4,0,0]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Per-employee table with performance scores */}
      {employeePerformance.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">{t('employees')} Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="pb-2 font-semibold">{t('name')}</th>
                  <th className="pb-2 font-semibold text-center">{t('present')}</th>
                  <th className="pb-2 font-semibold text-center">{t('absent')}</th>
                  <th className="pb-2 font-semibold text-center">{t('late')}</th>
                  <th className="pb-2 font-semibold text-center">{t('hours_worked')}</th>
                  <th className="pb-2 font-semibold text-center">{t('bonus')}</th>
                  <th className="pb-2 font-semibold text-center">Score</th>
                </tr>
              </thead>
              <tbody>
                {employeePerformance.slice(0, 15).map((emp, i) => (
                  <tr key={emp.id || i} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="py-2">
                      <div className="font-medium">{emp.name}</div>
                      <div className="text-xs text-muted-foreground">{emp.branch}</div>
                    </td>
                    <td className="py-2 text-center text-emerald-600 font-semibold">{emp.present}</td>
                    <td className="py-2 text-center text-red-500">{emp.absent}</td>
                    <td className="py-2 text-center text-amber-500">{emp.late}</td>
                    <td className="py-2 text-center">{toNumber(emp.hours).toFixed(1)}h</td>
                    <td className="py-2 text-center">
                      {toNumber(emp.totalBonus) > 0 ? <span className="text-emerald-600 font-semibold">{formatCurrency(toNumber(emp.totalBonus), currency)}</span> : '—'}
                    </td>
                    <td className="py-2 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <div className="w-16 bg-muted rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${Math.min(toNumber(emp.rate), 100)}%`, background: emp.rate >= 90 ? '#10b981' : emp.rate >= 75 ? '#f59e0b' : '#ef4444' }} />
                        </div>
                        <span className={`text-xs font-semibold ${emp.rate >= 90 ? 'text-emerald-600' : emp.rate >= 75 ? 'text-amber-600' : 'text-red-500'}`}>{emp.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
