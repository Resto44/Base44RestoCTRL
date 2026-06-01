import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useRole } from '@/lib/RoleContext';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Clock, Users, Trash2, ClipboardList, CalendarDays, TrendingUp, ShieldCheck } from 'lucide-react';
import BranchSelect from '@/components/shared/BranchSelect';
import LaborReport from '@/components/attendance/LaborReport';
import WeeklyRosterView from '@/components/staff/WeeklyRosterView';
import StaffPerformanceDashboard from '@/components/staff/StaffPerformanceDashboard';
import ShiftAudit from '@/components/staff/ShiftAudit';

const emptyForm = {
  date: format(new Date(), 'yyyy-MM-dd'),
  branch: '',
  staff_name: '',
  staff_email: '',
  check_in: '',
  check_out: '',
  notes: '',
};

function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const [ih, im] = checkIn.split(':').map(Number);
  const [oh, om] = checkOut.split(':').map(Number);
  const mins = (oh * 60 + om) - (ih * 60 + im);
  return mins > 0 ? (mins / 60) : null;
}

export default function StaffAttendance() {
  const { t } = useLanguage();
  const { role } = useRole();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['staff_attendance'],
    queryFn: () => base44.entities.StaffAttendance.list('-date', 1000),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.StaffAttendance.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff_attendance'] }); setShowForm(false); setForm(emptyForm); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.StaffAttendance.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff_attendance'] }),
  });

  const handleSubmit = () => {
    if (!form.branch || !form.staff_name || !form.check_in || !form.date) return;
    const hours_worked = calcHours(form.check_in, form.check_out);
    createMutation.mutate({ ...form, hours_worked: hours_worked || 0 });
  };

  const filtered = useMemo(() => records.filter(r =>
    (filterBranch === 'all' || r.branch === filterBranch) &&
    (!filterDate || r.date === filterDate)
  ), [records, filterBranch, filterDate]);

  const isManager = role === 'owner' || role === 'manager';

  return (
    <div>
      <PageHeader
        title="Staff Attendance"
        action={<Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Log Entry</Button>}
      />

      <Tabs defaultValue="log">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="log" className="flex-1"><Clock className="w-3.5 h-3.5 mr-1" /> Attendance</TabsTrigger>
          {isManager && <TabsTrigger value="roster" className="flex-1 text-xs"><CalendarDays className="w-3 h-3 mr-0.5" /> Roster</TabsTrigger>}
          {isManager && <TabsTrigger value="report" className="flex-1 text-xs"><ClipboardList className="w-3 h-3 mr-0.5" /> Labor</TabsTrigger>}
          {isManager && <TabsTrigger value="performance" className="flex-1 text-xs"><TrendingUp className="w-3 h-3 mr-0.5" /> Performance</TabsTrigger>}
          {isManager && <TabsTrigger value="audit" className="flex-1 text-xs"><ShieldCheck className="w-3 h-3 mr-0.5" /> Audit</TabsTrigger>}
        </TabsList>

        <TabsContent value="log">
          <div className="flex gap-2 mb-4">
            <BranchSelect value={filterBranch} onChange={setFilterBranch} includeAll />
            <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="flex-1" />
          </div>

          <div className="space-y-2">
            {isLoading ? <p className="text-center text-muted-foreground py-8">Loading...</p> :
              filtered.length === 0 ? (
                <div className="text-center text-muted-foreground py-16">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No attendance records</p>
                </div>
              ) : filtered.map(r => {
                const hrs = r.hours_worked || calcHours(r.check_in, r.check_out);
                return (
                  <Card key={r.id} className="p-3 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-sm truncate">{r.staff_name}</p>
                        <Badge variant="outline" className="text-xs shrink-0">{r.branch}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.date}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs"><span className="text-muted-foreground">In:</span> {r.check_in || '-'}</span>
                        <span className="text-xs"><span className="text-muted-foreground">Out:</span> {r.check_out || '-'}</span>
                        {hrs != null && <span className="text-xs font-semibold text-primary">{hrs.toFixed(1)}h</span>}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => deleteMutation.mutate(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </Card>
                );
              })
            }
          </div>
        </TabsContent>

        {isManager && (
          <TabsContent value="roster">
            <WeeklyRosterView />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="report">
            <LaborReport records={records} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="performance">
            <StaffPerformanceDashboard attendanceRecords={records} />
          </TabsContent>
        )}
        {isManager && (
          <TabsContent value="audit">
            <ShiftAudit />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Log Attendance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><Label>Branch</Label><BranchSelect value={form.branch} onChange={v => setForm(f => ({ ...f, branch: v }))} /></div>
            <div><Label>Staff Name</Label><Input value={form.staff_name} onChange={e => setForm(f => ({ ...f, staff_name: e.target.value }))} placeholder="Full name" /></div>
            <div><Label>Staff Email (optional)</Label><Input type="email" value={form.staff_email} onChange={e => setForm(f => ({ ...f, staff_email: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Check In</Label><Input type="time" value={form.check_in} onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))} /></div>
              <div><Label>Check Out</Label><Input type="time" value={form.check_out} onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))} /></div>
            </div>
            {form.check_in && form.check_out && calcHours(form.check_in, form.check_out) != null && (
              <p className="text-sm font-semibold text-primary">Hours: {calcHours(form.check_in, form.check_out).toFixed(2)}h</p>
            )}
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending}>Save</Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}