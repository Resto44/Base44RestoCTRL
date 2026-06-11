import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Clock, CheckCircle2, XCircle, AlertCircle, Coffee, Palmtree, Download } from 'lucide-react';
import BranchSelect from '@/components/shared/BranchSelect';
import { format } from 'date-fns';
import { calcHours } from '@/lib/payrollEngine';

const STATUS_CONFIG = {
  present:  { key: 'present',  icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  late:     { key: 'late',     icon: AlertCircle,  color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  absent:   { key: 'absent',   icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50 border-red-200' },
  half_day: { key: 'half_day', icon: Coffee,       color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' },
  vacation: { key: 'vacation', icon: Palmtree,     color: 'text-violet-600',  bg: 'bg-violet-50 border-violet-200' },
};

const emptyForm = {
  employee_id: '',
  employee_name: '',
  branch: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  check_in: '',
  check_out: '',
  status: 'present',
  late_minutes: 0,
  notes: '',
};

export default function AttendanceTab() {
  const { user } = useAuth();
  const { role } = useRole();
  const { branches, t } = useLanguage();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('full_name', 500),
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => base44.entities.Attendance.list('-date', 5000),
  });

  const createMut = useMutation({
    mutationFn: d => base44.entities.Attendance.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance'] }); setShowForm(false); setForm(emptyForm); },
  });

  const deleteMut = useMutation({
    mutationFn: id => base44.entities.Attendance.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  });

  const filtered = useMemo(() => records.filter(r =>
    (!filterDate || r.date === filterDate) &&
    (filterBranch === 'all' || r.branch === filterBranch)
  ), [records, filterDate, filterBranch]);

  // Employees available to manager (by branch)
  const availableEmployees = useMemo(() => {
    if (role === 'owner') return employees;
    const managerBranch = user?.branch || '';
    return employees.filter(e => !managerBranch || e.branch === managerBranch);
  }, [employees, role, user]);

  const handleSubmit = () => {
    if (!form.employee_id || !form.date || !form.status) return;
    const emp = employees.find(e => e.id === form.employee_id);
    const hours = calcHours(form.check_in, form.check_out);
    createMut.mutate({
      ...form,
      employee_name: emp?.full_name || form.employee_name,
      branch: emp?.branch || form.branch,
      hours_worked: hours,
      late_minutes: Number(form.late_minutes) || 0,
    });
  };

  const exportCSV = () => {
    const rows = [
      ['Date', 'Employee', 'Branch', 'Status', 'Check In', 'Check Out', 'Hours', 'Late Mins'],
      ...filtered.map(r => [r.date, r.employee_name, r.branch, r.status, r.check_in || '', r.check_out || '', (r.hours_worked || 0).toFixed(1), r.late_minutes || 0])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_${filterDate}.csv`;
    a.click();
  };

  // Summary counts for the displayed day
  const summary = useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0, half_day: 0, vacation: 0 };
    filtered.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
    return counts;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="flex-1" />
        <BranchSelect value={filterBranch} onChange={setFilterBranch} includeAll />
        <Button size="sm" variant="outline" onClick={exportCSV}><Download className="w-3.5 h-3.5" /></Button>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5" /></Button>
      </div>

      {/* Day summary pills */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(summary).map(([status, count]) => {
          const cfg = STATUS_CONFIG[status];
          const Icon = cfg.icon;
          return (
            <div key={status} className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.color}`}>
              <Icon className="w-3 h-3" /> {t(cfg.key)}: {count}
            </div>
          );
        })}
      </div>

      {/* Records */}
      <div className="space-y-2">
        {isLoading ? <p className="text-center py-8 text-muted-foreground text-sm">{t('loading')}</p> :
          filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('no_data')}</p>
              <Button size="sm" className="mt-3" onClick={() => setShowForm(true)}>{t('attendance')}</Button>
            </div>
          ) : filtered.map(r => {
            const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.present;
            const Icon = cfg.icon;
            const hrs = r.hours_worked || calcHours(r.check_in, r.check_out);
            return (
              <Card key={r.id} className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.employee_name}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{r.branch}</span>
                      {r.check_in && <span>↦ {r.check_in}</span>}
                      {r.check_out && <span>↤ {r.check_out}</span>}
                      {hrs > 0 && <span className="text-primary font-semibold">{hrs.toFixed(1)}h</span>}
                      {r.late_minutes > 0 && <span className="text-amber-600">{r.late_minutes}m late</span>}
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="text-destructive shrink-0 h-7 w-7"
                  onClick={() => deleteMut.mutate(r.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </Card>
            );
          })}
      </div>

      {/* Add Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('attendance')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('employees')}</Label>
              <Select value={form.employee_id} onValueChange={v => {
                const emp = employees.find(e => e.id === v);
                set('employee_id', v);
                set('employee_name', emp?.full_name || '');
                set('branch', emp?.branch || '');
              }}>
                <SelectTrigger><SelectValue placeholder={t('select')} /></SelectTrigger>
                <SelectContent>
                  {availableEmployees.filter(e => e.is_active !== false).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name} — {e.branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('date')}</Label>
              <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t('status')}</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                    <SelectItem key={v} value={v}>{t(c.key)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(form.status === 'present' || form.status === 'late' || form.status === 'half_day') && (
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">{t('check_in')}</Label><Input type="time" value={form.check_in} onChange={e => set('check_in', e.target.value)} /></div>
                <div><Label className="text-xs">{t('check_out')}</Label><Input type="time" value={form.check_out} onChange={e => set('check_out', e.target.value)} /></div>
              </div>
            )}
            {form.status === 'late' && (
              <div>
                <Label className="text-xs">{t('late_minutes')}</Label>
                <Input type="number" value={form.late_minutes} onChange={e => set('late_minutes', e.target.value)} />
              </div>
            )}
            <div><Label className="text-xs">{t('notes')}</Label><Input value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleSubmit} disabled={createMut.isPending || !form.employee_id}>{t('save')}</Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}