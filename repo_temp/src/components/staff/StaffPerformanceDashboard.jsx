import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import BranchSelect from '@/components/shared/BranchSelect';
import { formatCurrency } from '@/lib/helpers';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Download, Clock, DollarSign } from 'lucide-react';

function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [ih, im] = checkIn.split(':').map(Number);
  const [oh, om] = checkOut.split(':').map(Number);
  const mins = (oh * 60 + om) - (ih * 60 + im);
  return mins > 0 ? mins / 60 : 0;
}

export default function StaffPerformanceDashboard({ attendanceRecords }) {
  const { currency } = useLanguage();
  const today = new Date();
  const [fromDate, setFromDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [branch, setBranch] = useState('all');

  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.DailySales.list('-date', 5000),
  });

  // Filter attendance to date range + branch
  const filteredAttendance = useMemo(() =>
    attendanceRecords.filter(r =>
      r.date >= fromDate && r.date <= toDate &&
      (branch === 'all' || r.branch === branch)
    ), [attendanceRecords, fromDate, toDate, branch]);

  // Filter sales to same range + branch
  const filteredSales = useMemo(() =>
    sales.filter(s =>
      s.date >= fromDate && s.date <= toDate &&
      (branch === 'all' || s.branch === branch)
    ), [sales, fromDate, toDate, branch]);

  // Build per-staff performance metrics
  const staffMetrics = useMemo(() => {
    const map = {};

    filteredAttendance.forEach(r => {
      const key = r.staff_name || r.staff_email || 'Unknown';
      if (!map[key]) map[key] = {
        name: key,
        email: r.staff_email,
        shifts: 0,
        totalHours: 0,
        branches: new Set(),
        workDates: new Set(),
      };
      map[key].shifts++;
      map[key].totalHours += r.hours_worked || calcHours(r.check_in, r.check_out);
      map[key].workDates.add(r.date);
      if (r.branch) map[key].branches.add(r.branch);
    });

    // Distribute daily sales equally among staff who worked that day on that branch
    // (approximate: sales per day / # staff working that day)
    const dayStaffCount = {};
    filteredAttendance.forEach(r => {
      const key = `${r.date}_${r.branch}`;
      dayStaffCount[key] = (dayStaffCount[key] || 0) + 1;
    });

    filteredAttendance.forEach(r => {
      const staffKey = r.staff_name || r.staff_email || 'Unknown';
      const dayKey = `${r.date}_${r.branch}`;
      const count = dayStaffCount[dayKey] || 1;
      // Find sales for that day/branch
      const daySales = filteredSales
        .filter(s => s.date === r.date && (branch === 'all' ? s.branch === r.branch : true))
        .reduce((s, x) => s + (x.cash || 0) + (x.network || 0), 0);
      if (map[staffKey]) {
        map[staffKey].allocatedSales = (map[staffKey].allocatedSales || 0) + (daySales / count);
      }
    });

    return Object.values(map)
      .map(s => ({
        ...s,
        branches: [...s.branches],
        workDates: [...s.workDates],
        avgSalesPerShift: s.shifts > 0 ? (s.allocatedSales || 0) / s.shifts : 0,
        salesPerHour: s.totalHours > 0 ? (s.allocatedSales || 0) / s.totalHours : 0,
        avgHoursPerShift: s.shifts > 0 ? s.totalHours / s.shifts : 0,
      }))
      .sort((a, b) => b.avgSalesPerShift - a.avgSalesPerShift);
  }, [filteredAttendance, filteredSales, branch]);

  const totalSales = filteredSales.reduce((s, x) => s + (x.cash || 0) + (x.network || 0), 0);
  const totalHours = staffMetrics.reduce((s, x) => s + x.totalHours, 0);

  const exportCSV = () => {
    const rows = [
      ['Staff', 'Shifts', 'Total Hours', 'Avg Hours/Shift', 'Allocated Sales', 'Avg Sales/Shift', 'Sales/Hour'],
      ...staffMetrics.map(s => [
        s.name, s.shifts, s.totalHours.toFixed(1), s.avgHoursPerShift.toFixed(1),
        (s.allocatedSales || 0).toFixed(2), s.avgSalesPerShift.toFixed(2), s.salesPerHour.toFixed(2),
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `staff_performance_${fromDate}_${toDate}.csv`;
    a.click();
  };

  const chartData = staffMetrics.slice(0, 8).map(s => ({
    name: s.name.split(' ')[0],
    'Avg Sales/Shift': Math.round(s.avgSalesPerShift),
    'Total Hours': Math.round(s.totalHours),
  }));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Filters</h3>
          <Button size="sm" variant="outline" onClick={exportCSV} disabled={staffMetrics.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">From</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
        </div>
        <BranchSelect value={branch} onChange={setBranch} includeAll />
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 text-center">
          <DollarSign className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
          <p className="text-lg font-bold">{formatCurrency(totalSales, currency)}</p>
          <p className="text-xs text-muted-foreground">Total Sales</p>
        </Card>
        <Card className="p-3 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-lg font-bold">{totalHours.toFixed(0)}h</p>
          <p className="text-xs text-muted-foreground">Total Hours Worked</p>
        </Card>
        <Card className="p-3 text-center">
          <Users className="w-5 h-5 mx-auto mb-1 text-violet-500" />
          <p className="text-lg font-bold">{staffMetrics.length}</p>
          <p className="text-xs text-muted-foreground">Staff Active</p>
        </Card>
        <Card className="p-3 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1 text-amber-500" />
          <p className="text-lg font-bold">
            {totalHours > 0 ? formatCurrency(totalSales / totalHours, currency) : '—'}
          </p>
          <p className="text-xs text-muted-foreground">Revenue/Hour</p>
        </Card>
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Avg Sales per Shift by Staff</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ left: -10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v, n) => n === 'Avg Sales/Shift' ? formatCurrency(v, currency) : `${v}h`} />
              <Bar dataKey="Avg Sales/Shift" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Per-staff table */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Staff Performance Breakdown</h3>
        {staffMetrics.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No attendance data for selected period.</p>
        ) : staffMetrics.map((s, i) => (
          <Card key={s.name} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                  <p className="font-medium text-sm truncate">{s.name}</p>
                  {s.branches.map(b => <Badge key={b} variant="outline" className="text-xs">{b}</Badge>)}
                </div>
                <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  <span><strong className="text-foreground">{s.shifts}</strong> shifts</span>
                  <span><strong className="text-foreground">{s.totalHours.toFixed(1)}h</strong> total</span>
                  <span><strong className="text-foreground">{s.avgHoursPerShift.toFixed(1)}h</strong>/shift</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-primary text-sm">{formatCurrency(s.avgSalesPerShift, currency)}</p>
                <p className="text-xs text-muted-foreground">avg/shift</p>
                <p className="text-xs text-emerald-600 font-medium">{formatCurrency(s.salesPerHour, currency)}/hr</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground px-1">
        * Sales are allocated proportionally to staff who worked the same branch/day.
      </p>
    </div>
  );
}