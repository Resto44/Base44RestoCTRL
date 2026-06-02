import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useTenant } from '@/lib/TenantContext';
import { useRole } from '@/lib/RoleContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useNotify } from '@/lib/useNotify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  QrCode, Lock, Users, BarChart2, Camera, CheckCircle2, XCircle, Download,
  RefreshCw, Calendar
} from 'lucide-react';
import BranchSelect from '@/components/shared/BranchSelect';
import KioskPINPad from '@/components/attendance/KioskPINPad';
import QRScanner from '@/components/attendance/QRScanner';
import AttendanceLiveBoard from '@/components/attendance/AttendanceLiveBoard';
import AttendanceAnalyticsPanel from '@/components/attendance/AttendanceAnalyticsPanel';
import EmployeeQRCard from '@/components/attendance/EmployeeQRCard';
import { format } from 'date-fns';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [ih, im] = checkIn.split(':').map(Number);
  const [oh, om] = checkOut.split(':').map(Number);
  const mins = (oh * 60 + om) - (ih * 60 + im);
  return mins > 0 ? +(mins / 60).toFixed(2) : 0;
}

function nowHHMM() {
  return new Date().toTimeString().slice(0, 5);
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ─── Check-in result popup ────────────────────────────────────────────────────
function CheckInResult({ result, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  if (!result) return null;
  const isSuccess = result.type === 'success';
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${isSuccess ? 'bg-green-900/60' : 'bg-red-900/60'}`}
      onClick={onClose}>
      <div className="bg-card rounded-3xl shadow-2xl p-8 text-center max-w-xs w-full" onClick={e => e.stopPropagation()}>
        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
          {isSuccess
            ? <CheckCircle2 className="w-10 h-10 text-green-600" />
            : <XCircle className="w-10 h-10 text-red-600" />}
        </div>
        <p className="font-bold text-xl mb-1">{result.title}</p>
        <p className="text-muted-foreground text-sm">{result.message}</p>
        {result.time && <p className="text-3xl font-mono font-bold text-primary mt-3">{result.time}</p>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EmployeeAttendance() {
  const { user } = useAuth();
  const { branches, managerBranch, isManager } = useTenant();
  const { role } = useRole();
  const { t } = useLanguage();
  const notify = useNotify();
  const qc = useQueryClient();

  const isOwner = role === 'owner' || role === 'restaurant_admin';
  const defaultBranch = isManager ? (managerBranch || '') : (branches[0]?.key || '');

  const [selectedBranch, setSelectedBranch] = useState(defaultBranch);
  const [tab, setTab] = useState('kiosk');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQRCards, setShowQRCards] = useState(false);
  const [checkInResult, setCheckInResult] = useState(null);
  const [analyticsRange, setAnalyticsRange] = useState(30); // days

  // Sync branch when context loads
  useEffect(() => {
    if (!selectedBranch && defaultBranch) setSelectedBranch(defaultBranch);
  }, [defaultBranch]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Queries ──
  const today = todayISO();

  const { data: employees = [], isLoading: loadingEmp } = useQuery({
    queryKey: ['employees', selectedBranch],
    queryFn: () => selectedBranch
      ? base44.entities.Employee.filter({ branch: selectedBranch, is_active: true })
      : [],
    enabled: !!selectedBranch,
    staleTime: 30000,
  });

  const { data: todayAttendance = [], refetch: refetchToday } = useQuery({
    queryKey: ['attendance-today', selectedBranch, today],
    queryFn: () => selectedBranch
      ? base44.entities.Attendance.filter({ branch: selectedBranch, date: today })
      : [],
    enabled: !!selectedBranch,
    refetchInterval: 30000, // refresh every 30s
  });

  const { data: periodRecords = [] } = useQuery({
    queryKey: ['attendance-period', selectedBranch, analyticsRange],
    queryFn: async () => {
      if (!selectedBranch) return [];
      const from = new Date();
      from.setDate(from.getDate() - analyticsRange);
      const records = await base44.entities.Attendance.filter({ branch: selectedBranch }, '-date', 2000);
      const cutoff = from.toISOString().split('T')[0];
      return records.filter(r => r.date >= cutoff);
    },
    enabled: tab === 'analytics' && !!selectedBranch,
    staleTime: 60000,
  });

  // ── Ensure employee has QR code (generate if missing) ──
  const ensureQRCode = useCallback(async (emp) => {
    if (emp.qr_code) return emp;
    const qrCode = `EMP-${emp.id}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    await base44.entities.Employee.update(emp.id, { qr_code: qrCode });
    qc.invalidateQueries({ queryKey: ['employees'] });
    return { ...emp, qr_code: qrCode };
  }, [qc]);

  // ── Core check-in/out logic ──
  const performCheckIn = useCallback(async (emp) => {
    const existing = todayAttendance.find(r => r.employee_id === emp.id);
    if (existing?.check_in) {
      // Already checked in — do check-out
      if (!existing.check_out) {
        const checkOut = nowHHMM();
        const hours = calcHours(existing.check_in, checkOut);
        await base44.entities.Attendance.update(existing.id, { check_out: checkOut, hours_worked: hours });
        await notify.create({
          type: 'attendance',
          title: 'Employee Checked Out',
          message: `${emp.full_name} checked out at ${checkOut} (${hours.toFixed(1)}h worked)`,
          severity: 'info',
          target_role: 'owner',
          branch: selectedBranch,
          org_id: user?.email,
        }).catch(() => {});
        return { type: 'success', title: 'Checked Out', message: emp.full_name, time: checkOut, action: 'out' };
      }
      return { type: 'error', title: 'Already Done', message: `${emp.full_name} already completed shift`, action: 'none' };
    }

    // Fresh check-in
    const checkIn = nowHHMM();
    // Determine if late
    let lateMinutes = 0;
    let status = 'present';
    if (emp.scheduled_start_time) {
      const [sh, sm] = emp.scheduled_start_time.split(':').map(Number);
      const [ch, cm] = checkIn.split(':').map(Number);
      const diff = (ch * 60 + cm) - (sh * 60 + sm);
      if (diff > 5) { lateMinutes = diff; status = 'late'; }
    }

    await base44.entities.Attendance.create({
      employee_id: emp.id,
      employee_name: emp.full_name,
      branch: selectedBranch,
      date: today,
      check_in: checkIn,
      status,
      late_minutes: lateMinutes,
      hours_worked: 0,
    });

    await notify.create({
      type: 'attendance',
      title: lateMinutes > 0 ? 'Late Check-In' : 'Employee Checked In',
      message: `${emp.full_name} checked in at ${checkIn}${lateMinutes > 0 ? ` (${lateMinutes}m late)` : ''}`,
      severity: lateMinutes > 15 ? 'warning' : 'info',
      target_role: 'owner',
      branch: selectedBranch,
      org_id: user?.email,
    }).catch(() => {});

    return {
      type: 'success',
      title: lateMinutes > 0 ? `Late by ${lateMinutes}m` : 'Checked In',
      message: emp.full_name,
      time: checkIn,
      action: 'in',
    };
  }, [todayAttendance, selectedBranch, today, user?.email, notify]);

  // ── PIN check-in ──
  const pinMutation = useMutation({
    mutationFn: async (pin) => {
      const emp = employees.find(e => e.pin === pin && e.is_active !== false);
      if (!emp) throw new Error('PIN not found');
      return performCheckIn(emp);
    },
    onSuccess: (result) => {
      setCheckInResult(result);
      qc.invalidateQueries({ queryKey: ['attendance-today'] });
    },
    onError: (err) => {
      setCheckInResult({ type: 'error', title: 'Invalid PIN', message: err.message || 'Employee not found' });
    },
  });

  // ── QR check-in ──
  const qrMutation = useMutation({
    mutationFn: async (qrCode) => {
      const emp = employees.find(e => e.qr_code === qrCode && e.is_active !== false);
      if (!emp) throw new Error('QR code not recognized');
      return performCheckIn(emp);
    },
    onSuccess: (result) => {
      setShowQRScanner(false);
      setCheckInResult(result);
      qc.invalidateQueries({ queryKey: ['attendance-today'] });
    },
    onError: (err) => {
      setShowQRScanner(false);
      setCheckInResult({ type: 'error', title: 'QR Error', message: err.message });
    },
  });

  // ── Manual check-out from board ──
  const checkOutMutation = useMutation({
    mutationFn: async (emp) => {
      const record = todayAttendance.find(r => r.employee_id === emp.id && !r.check_out);
      if (!record) throw new Error('No open shift');
      const checkOut = nowHHMM();
      const hours = calcHours(record.check_in, checkOut);
      await base44.entities.Attendance.update(record.id, { check_out: checkOut, hours_worked: hours });
      return { emp, checkOut };
    },
    onSuccess: ({ emp, checkOut }) => {
      toast.success(`${emp.full_name} checked out at ${checkOut}`);
      qc.invalidateQueries({ queryKey: ['attendance-today'] });
    },
  });

  // ── Export CSV ──
  const exportCSV = () => {
    const rows = [
      ['Date', 'Employee', 'Branch', 'Status', 'Check In', 'Check Out', 'Hours', 'Late Mins'],
      ...periodRecords.map(r => [
        r.date, r.employee_name, r.branch, r.status,
        r.check_in || '', r.check_out || '',
        (r.hours_worked || 0).toFixed(1), r.late_minutes || 0,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `attendance_${today}.csv`;
    a.click();
  };

  // ── Generate missing QR codes for all employees ──
  const generateAllQRs = async () => {
    const missing = employees.filter(e => !e.qr_code);
    await Promise.all(missing.map(ensureQRCode));
    qc.invalidateQueries({ queryKey: ['employees'] });
    toast.success(`Generated ${missing.length} QR codes`);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Check-in result overlay */}
      {checkInResult && (
        <CheckInResult result={checkInResult} onClose={() => setCheckInResult(null)} />
      )}

      {/* QR Scanner Modal */}
      <Dialog open={showQRScanner} onOpenChange={setShowQRScanner}>
        <DialogContent className="p-0 max-w-sm">
          <QRScanner
            onScan={(code) => qrMutation.mutate(code)}
            onClose={() => setShowQRScanner(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold leading-tight">Employee Attendance</h1>
            <div className="text-xs text-muted-foreground font-mono">
              {currentTime.toLocaleTimeString()} · {format(new Date(), 'EEE dd MMM')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => refetchToday()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={exportCSV}>
                <Download className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Branch selector */}
        <div className="mt-2">
          <BranchSelect
            value={selectedBranch}
            onChange={setSelectedBranch}
            disabled={isManager}
          />
        </div>
      </div>

      <div className="px-4 pt-4 max-w-2xl mx-auto">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full mb-4">
            <TabsTrigger value="kiosk" className="text-xs flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /><span className="hidden sm:inline">Kiosk</span>
            </TabsTrigger>
            <TabsTrigger value="live" className="text-xs flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /><span className="hidden sm:inline">Live</span>
            </TabsTrigger>
            <TabsTrigger value="qrcodes" className="text-xs flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5" /><span className="hidden sm:inline">QR</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs flex items-center gap-1">
              <BarChart2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          {/* ── KIOSK TAB ── */}
          <TabsContent value="kiosk">
            <div className="space-y-4">
              {/* QR Scan button */}
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="text-center mb-4">
                    <p className="text-sm text-muted-foreground font-medium">Scan QR Code</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Point camera at employee QR badge</p>
                  </div>
                  <Button
                    className="w-full h-14 text-base gap-2"
                    onClick={() => setShowQRScanner(true)}
                    disabled={qrMutation.isPending}
                  >
                    <Camera className="w-5 h-5" />
                    Scan QR Code
                  </Button>
                </CardContent>
              </Card>

              {/* PIN Pad */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Enter PIN
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Tap digits to check in / check out</p>
                </CardHeader>
                <CardContent className="pb-5 flex flex-col items-center">
                  <KioskPINPad
                    onSubmit={(pin) => pinMutation.mutate(pin)}
                    loading={pinMutation.isPending}
                  />
                </CardContent>
              </Card>

              {/* Quick status strip */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Present', count: todayAttendance.filter(r => r.check_in && !r.check_out).length, color: 'text-green-600' },
                  { label: 'Done', count: todayAttendance.filter(r => r.check_out).length, color: 'text-slate-500' },
                  { label: 'Absent', count: Math.max(0, employees.length - todayAttendance.filter(r => r.check_in).length), color: 'text-red-500' },
                ].map(({ label, count, color }) => (
                  <Card key={label}>
                    <CardContent className="pt-3 pb-2">
                      <div className={`text-2xl font-bold ${color}`}>{count}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── LIVE BOARD TAB ── */}
          <TabsContent value="live">
            {loadingEmp ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
            ) : (
              <AttendanceLiveBoard
                employees={employees}
                todayAttendance={todayAttendance}
                onCheckOut={(emp) => checkOutMutation.mutate(emp)}
                checkOutLoading={checkOutMutation.isPending}
              />
            )}
          </TabsContent>

          {/* ── QR CODES TAB ── */}
          <TabsContent value="qrcodes">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {employees.filter(e => e.qr_code).length} of {employees.length} employees have QR codes
                </p>
                <Button size="sm" onClick={generateAllQRs} variant="outline" className="gap-1">
                  <QrCode className="w-3.5 h-3.5" /> Generate Missing
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {employees.map(emp => (
                  <div key={emp.id} className="flex flex-col items-center">
                    {emp.qr_code
                      ? <EmployeeQRCard employee={emp} />
                      : (
                        <Card className="w-full max-w-[200px] text-center">
                          <CardContent className="pt-4 pb-3 px-3">
                            <div className="w-[160px] h-[160px] bg-muted rounded-lg flex items-center justify-center mx-auto">
                              <QrCode className="w-10 h-10 text-muted-foreground/40" />
                            </div>
                            <div className="text-xs font-semibold mt-2">{emp.full_name}</div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 w-full text-xs h-7"
                              onClick={() => ensureQRCode(emp).then(() => toast.success('QR generated'))}
                            >
                              Generate
                            </Button>
                          </CardContent>
                        </Card>
                      )
                    }
                  </div>
                ))}
              </div>
              {employees.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No employees in this branch.
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── ANALYTICS TAB ── */}
          <TabsContent value="analytics">
            <div className="space-y-4">
              {/* Range selector */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Last</span>
                {[7, 14, 30, 60].map(d => (
                  <button
                    key={d}
                    onClick={() => setAnalyticsRange(d)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      analyticsRange === d ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                    }`}
                  >{d}d</button>
                ))}
              </div>
              <AttendanceAnalyticsPanel records={periodRecords} employees={employees} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}