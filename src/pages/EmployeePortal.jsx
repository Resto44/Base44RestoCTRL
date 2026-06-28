import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Home, Clock, DollarSign, Bell, Calendar, CheckCircle2, XCircle, AlertCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const PRIORITY_CONFIG = {
  urgent:    { color: 'bg-red-100 text-red-700 border-red-200',    icon: '🚨' },
  important: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '⚠️' },
  normal:    { color: 'bg-blue-50 text-blue-700 border-blue-200',   icon: '📢' },
};

const STATUS_CONFIG = {
  present:   { color: 'text-green-600',  icon: CheckCircle2,  label: 'Present' },
  late:      { color: 'text-amber-600',  icon: AlertCircle,   label: 'Late' },
  absent:    { color: 'text-red-600',    icon: XCircle,       label: 'Absent' },
  half_day:  { color: 'text-blue-600',   icon: Clock,         label: 'Half Day' },
  vacation:  { color: 'text-purple-600', icon: Calendar,      label: 'Vacation' },
};

function StatCard({ label, value, sub, colorClass = 'bg-slate-50' }) {
  return (
    <div className={`${colorClass} rounded-2xl p-4 text-center`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-semibold mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function EmployeePortal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('home');
  const today = new Date().toISOString().split('T')[0];

  // Find Employee record linked to this user
  const { data: employees = [] } = useQuery({
    queryKey: ['my-emp-profile', user?.email],
    queryFn: () => user?.email ? base44.entities.Employee.filter({ email: user.email }) : [],
    enabled: !!user?.email,
  });
  const employee = employees[0] || null;
  const branch = employee?.branch || '';

  // Today's attendance
  const { data: todayAttendance = [] } = useQuery({
    queryKey: ['my-attendance-today', employee?.id, today],
    queryFn: () => employee?.id ? base44.entities.Attendance.filter({ employee_id: employee.id, date: today }) : [],
    enabled: !!employee?.id,
    refetchInterval: 30000,
  });
  const todayRecord = todayAttendance[0] || null;

  // Attendance history (last 30 records)
  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ['my-attendance-history', employee?.id],
    queryFn: () => employee?.id
      ? base44.entities.Attendance.filter({ employee_id: employee.id }, '-date', 30)
      : [],
    enabled: !!employee?.id,
  });

  // Salary advances
  const { data: advances = [] } = useQuery({
    queryKey: ['my-advances', employee?.id],
    queryFn: () => employee?.id
      ? base44.entities.SalaryAdvance.filter({ employee_id: employee.id }, '-created_date', 20)
      : [],
    enabled: !!employee?.id,
  });

  // Announcements for this branch
  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements', branch],
    queryFn: () => base44.entities.Announcement.filter({ is_active: true }, '-created_date', 20),
    enabled: !!branch,
  });

  // Filter announcements for this branch + relevant roles
  const myAnnouncements = announcements.filter(a => {
    if (a.expires_at && new Date(a.expires_at) < new Date()) return false;
    if (a.branch_key && a.branch_key !== branch) return false;
    return true;
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: () => {
      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 5);
      const scheduledStart = employee?.scheduled_start_time;
      let status = 'present';
      let lateMinutes = 0;
      if (scheduledStart) {
        const [sh, sm] = scheduledStart.split(':').map(Number);
        const [ch, cm] = timeStr.split(':').map(Number);
        const diffMins = (ch * 60 + cm) - (sh * 60 + sm);
        if (diffMins > 10) { status = 'late'; lateMinutes = diffMins; }
      }
      return base44.entities.Attendance.create({
        employee_id: employee.id,
        employee_name: employee.full_name,
        branch,
        date: today,
        check_in: timeStr,
        status,
        late_minutes: lateMinutes,
      });
    },
    onSuccess: () => {
      toast.success('✅ Checked in!');
      qc.invalidateQueries({ queryKey: ['my-attendance-today'] });
      qc.invalidateQueries({ queryKey: ['my-attendance-history'] });
    },
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: () => {
      if (!todayRecord) return Promise.reject(new Error('No check-in record'));
      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 5);
      const [ih, im] = (todayRecord.check_in || '00:00').split(':').map(Number);
      const [oh, om] = timeStr.split(':').map(Number);
      const hoursWorked = ((oh * 60 + om) - (ih * 60 + im)) / 60;
      return base44.entities.Attendance.update(todayRecord.id, {
        check_out: timeStr,
        hours_worked: Math.max(0, Math.round(hoursWorked * 100) / 100),
      });
    },
    onSuccess: () => {
      toast.success('👋 Checked out!');
      qc.invalidateQueries({ queryKey: ['my-attendance-today'] });
      qc.invalidateQueries({ queryKey: ['my-attendance-history'] });
    },
  });

  if (!employee) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">👤</div>
        <h2 className="text-xl font-bold mb-2">Profile Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Your employee profile hasn't been linked yet. Contact your manager to set your email ({user?.email}).
        </p>
        <Button variant="outline" className="mt-4" onClick={() => base44.auth.logout('/auth')}>Sign Out</Button>
      </div>
    );
  }

  const presentDays = attendanceHistory.filter(a => a.status === 'present' || a.status === 'late').length;
  const absentDays = attendanceHistory.filter(a => a.status === 'absent').length;
  const totalHours = attendanceHistory.reduce((s, a) => s + (a.hours_worked || 0), 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">{employee.full_name}</h1>
            <p className="text-xs text-muted-foreground">
              {employee.position || 'Staff'} · {branch}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {myAnnouncements.length > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                  {myAnnouncements.length}
                </span>
              </div>
            )}
            <Button size="sm" variant="ghost" onClick={() => base44.auth.logout('/auth')}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 max-w-lg mx-auto">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full mb-4 h-12">
            <TabsTrigger value="home" className="flex flex-col items-center gap-0.5 text-[10px] px-1 py-1.5 h-full">
              <Home className="w-4 h-4" />Home
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex flex-col items-center gap-0.5 text-[10px] px-1 py-1.5 h-full">
              <Clock className="w-4 h-4" />Time
            </TabsTrigger>
            <TabsTrigger value="salary" className="flex flex-col items-center gap-0.5 text-[10px] px-1 py-1.5 h-full">
              <DollarSign className="w-4 h-4" />Salary
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex flex-col items-center gap-0.5 text-[10px] px-1 py-1.5 h-full relative">
              <Bell className="w-4 h-4" />News
              {myAnnouncements.length > 0 && (
                <span className="absolute top-1 right-2 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center font-bold">
                  {myAnnouncements.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* HOME TAB */}
          <TabsContent value="home" className="space-y-4">
            {/* Check-in card */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">Today — {format(new Date(), 'EEE, MMM d')}</p>
                    {todayRecord ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-semibold ${STATUS_CONFIG[todayRecord.status]?.color}`}>
                          {STATUS_CONFIG[todayRecord.status]?.label}
                        </span>
                        <span className="text-xs text-muted-foreground">In: {todayRecord.check_in}</span>
                        {todayRecord.check_out && <span className="text-xs text-muted-foreground">Out: {todayRecord.check_out}</span>}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">Not checked in</p>
                    )}
                  </div>
                  <div className="text-2xl">
                    {todayRecord?.check_out ? '✅' : todayRecord?.check_in ? '⏰' : '⬜'}
                  </div>
                </div>

                {!todayRecord && (
                  <Button className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                    onClick={() => checkInMutation.mutate()}
                    disabled={checkInMutation.isPending}>
                    {checkInMutation.isPending ? 'Checking in…' : '✅ Check In'}
                  </Button>
                )}
                {todayRecord?.check_in && !todayRecord?.check_out && (
                  <Button className="w-full h-12 text-base font-bold bg-slate-700 hover:bg-slate-800 rounded-xl"
                    onClick={() => checkOutMutation.mutate()}
                    disabled={checkOutMutation.isPending}>
                    {checkOutMutation.isPending ? 'Checking out…' : '👋 Check Out'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Present" value={presentDays} sub="last 30 records" colorClass="bg-green-50" />
              <StatCard label="Absent" value={absentDays} sub="last 30 records" colorClass="bg-red-50" />
              <StatCard label="Hours" value={totalHours.toFixed(0)} sub="total logged" colorClass="bg-blue-50" />
            </div>

            {/* Schedule info */}
            {(employee.scheduled_start_time || employee.scheduled_end_time) && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">My Schedule</p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium">
                        {employee.scheduled_start_time || '—'} → {employee.scheduled_end_time || '—'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Latest announcements preview */}
            {myAnnouncements.slice(0, 2).map(ann => (
              <div key={ann.id} className={`rounded-xl p-3 border text-sm ${PRIORITY_CONFIG[ann.priority]?.color}`}>
                <span className="mr-1">{PRIORITY_CONFIG[ann.priority]?.icon}</span>
                <strong>{ann.title}</strong>
                <p className="text-xs mt-1 opacity-80 line-clamp-2">{ann.body}</p>
              </div>
            ))}
          </TabsContent>

          {/* ATTENDANCE TAB */}
          <TabsContent value="attendance" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Days Present" value={presentDays} colorClass="bg-green-50" />
              <StatCard label="Total Hours" value={totalHours.toFixed(1)} colorClass="bg-blue-50" />
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-2">Attendance History</p>
            {attendanceHistory.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                No attendance records yet
              </div>
            )}
            {attendanceHistory.map(rec => {
              const cfg = STATUS_CONFIG[rec.status] || STATUS_CONFIG.present;
              const StatusIcon = cfg.icon;
              return (
                <Card key={rec.id} className="border-0 shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
                        <div>
                          <p className="text-sm font-medium">{format(new Date(rec.date), 'EEE, MMM d yyyy')}</p>
                          <p className="text-xs text-muted-foreground">
                            {rec.check_in && `In: ${rec.check_in}`}
                            {rec.check_out && ` · Out: ${rec.check_out}`}
                            {rec.hours_worked > 0 && ` · ${rec.hours_worked}h`}
                          </p>
                        </div>
                      </div>
                      <Badge className={`text-xs border ${rec.status === 'present' ? 'bg-green-100 text-green-700 border-green-200' : rec.status === 'absent' ? 'bg-red-100 text-red-700 border-red-200' : rec.status === 'late' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                    {rec.late_minutes > 0 && (
                      <p className="text-xs text-amber-600 mt-1 ml-7">{rec.late_minutes} min late</p>
                    )}
                    {rec.notes && <p className="text-xs text-muted-foreground mt-1 ml-7">{rec.notes}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* SALARY TAB */}
          <TabsContent value="salary" className="space-y-4">
            {/* Base salary */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100/50">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">My Compensation</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Base Salary</p>
                    <p className="text-2xl font-black text-blue-700">
                      {employee.base_salary > 0 ? employee.base_salary.toLocaleString() : '—'}
                    </p>
                    {employee.base_salary > 0 && <p className="text-xs text-muted-foreground">per month</p>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Position</p>
                    <p className="font-bold text-sm mt-1">{employee.position || 'Staff'}</p>
                    <p className="text-xs text-muted-foreground">{branch}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Salary advances */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">Salary Advances</p>
              {advances.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No salary advances
                </div>
              )}
              {advances.map(adv => (
                <Card key={adv.id} className="border-0 shadow-sm mb-2">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{adv.amount?.toLocaleString()} SAR</p>
                        <p className="text-xs text-muted-foreground">{adv.date} · {adv.reason || 'Advance'}</p>
                      </div>
                      <Badge className={`text-xs border ${adv.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : adv.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {adv.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ANNOUNCEMENTS TAB */}
          <TabsContent value="announcements" className="space-y-3">
            {myAnnouncements.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                No announcements yet
              </div>
            )}
            {myAnnouncements.map(ann => {
              const cfg = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.normal;
              return (
                <Card key={ann.id} className="border-0 shadow-sm overflow-hidden">
                  <div className={`h-1 w-full ${ann.priority === 'urgent' ? 'bg-red-400' : ann.priority === 'important' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{cfg.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm">{ann.title}</p>
                          <Badge className={`text-xs border shrink-0 ${cfg.color}`}>{ann.priority}</Badge>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{ann.body}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {ann.posted_by_name || ann.posted_by} · {ann.created_date ? format(new Date(ann.created_date), 'MMM d, yyyy') : ''}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}