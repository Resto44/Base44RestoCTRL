import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import BranchSelect from '@/components/shared/BranchSelect';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Users, Clock, TrendingDown } from 'lucide-react';

function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [ih, im] = checkIn.split(':').map(Number);
  const [oh, om] = checkOut.split(':').map(Number);
  const mins = (oh * 60 + om) - (ih * 60 + im);
  return mins > 0 ? mins / 60 : 0;
}

export default function LaborReport({ records }) {
  const { currency } = useLanguage();
  const today = new Date();
  const [fromDate, setFromDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [branch, setBranch] = useState('all');
  const [hourlyRate, setHourlyRate] = useState('');

  const filtered = useMemo(() => records.filter(r =>
    r.date >= fromDate && r.date <= toDate &&
    (branch === 'all' || r.branch === branch)
  ), [records, fromDate, toDate, branch]);

  // Group by staff
  const staffSummary = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const key = r.staff_name || r.staff_email || 'Unknown';
      if (!map[key]) map[key] = { name: key, email: r.staff_email, branches: new Set(), totalHours: 0, days: 0 };
      const h = r.hours_worked || calcHours(r.check_in, r.check_out);
      map[key].totalHours += h;
      map[key].days++;
      if (r.branch) map[key].branches.add(r.branch);
    });
    return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
  }, [filtered]);

  const totalHours = staffSummary.reduce((s, x) => s + x.totalHours, 0);
  const totalCost = hourlyRate ? totalHours * parseFloat(hourlyRate) : null;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Filters</h3>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">From</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
        </div>
        <BranchSelect value={branch} onChange={setBranch} includeAll />
        <div>
          <Label className="text-xs">Hourly Rate ({currency}) — for payroll estimate</Label>
          <Input type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="e.g. 25" />
        </div>
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-xl font-bold">{totalHours.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Total Hours</p>
        </Card>
        <Card className="p-3 text-center">
          <Users className="w-5 h-5 mx-auto mb-1 text-violet-500" />
          <p className="text-xl font-bold">{staffSummary.length}</p>
          <p className="text-xs text-muted-foreground">Staff Members</p>
        </Card>
        {totalCost != null && (
          <Card className="p-3 text-center col-span-2 bg-amber-50 border-amber-200">
            <TrendingDown className="w-5 h-5 mx-auto mb-1 text-amber-600" />
            <p className="text-xl font-bold text-amber-700">{currency}{totalCost.toFixed(2)}</p>
            <p className="text-xs text-amber-600">Estimated Labor Cost</p>
          </Card>
        )}
      </div>

      {/* Per-staff breakdown */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Staff Breakdown</h3>
        {staffSummary.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">No data for selected period</p>
        ) : staffSummary.map(s => (
          <Card key={s.name} className="p-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{s.name}</p>
              <div className="flex gap-1 flex-wrap mt-1">
                {[...s.branches].map(b => <Badge key={b} variant="outline" className="text-xs">{b}</Badge>)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{s.days} day(s)</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-primary">{s.totalHours.toFixed(1)}h</p>
              {hourlyRate && <p className="text-xs text-muted-foreground">{currency}{(s.totalHours * parseFloat(hourlyRate)).toFixed(2)}</p>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}