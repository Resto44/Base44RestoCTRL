import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useTenant } from '@/lib/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/LanguageContext';
import { AlertCircle, TrendingUp, Users, AlertTriangle, Zap } from 'lucide-react';
import BranchSelect from '@/components/shared/BranchSelect';

export default function EmployeeControl() {
  const { user } = useAuth();
  const { activeBranch, branches } = useTenant();
  const { t } = useLanguage();
  const [selectedBranch, setSelectedBranch] = useState(activeBranch);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Real-time attendance today
  const { data: todayAttendance = [] } = useQuery({
    queryKey: ['attendance-today', selectedBranch],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      return base44.entities.Attendance.filter({
        branch: selectedBranch,
        date: today,
      });
    },
    refetchInterval: autoRefresh ? 10000 : false, // Auto-refresh every 10s
  });

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees', selectedBranch],
    queryFn: () =>
      base44.entities.Employee.filter({ branch: selectedBranch }),
  });

  // Fetch salary advances today
  const { data: advancesToday = [] } = useQuery({
    queryKey: ['advances-today', selectedBranch],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      return base44.entities.SalaryAdvance.filter({
        branch: selectedBranch,
        date: today,
      });
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Fetch payroll today
  const { data: payrollToday = [] } = useQuery({
    queryKey: ['payroll-today', selectedBranch],
    queryFn: async () => {
      const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      return base44.entities.PayrollRun.filter({
        branch: selectedBranch,
        month: thisMonth,
      });
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Calculate metrics
  const presentToday = todayAttendance.filter(a => a.check_in && !a.check_out).length;
  const checkedOutToday = todayAttendance.filter(a => a.check_out).length;
  const absentToday = employees.length - todayAttendance.filter(a => a.check_in).length;

  // Detect late arrivals
  const lateEmployees = todayAttendance.filter(a => {
    const checkInTime = new Date(`2000-01-01 ${a.check_in}`);
    const scheduledTime = new Date('2000-01-01 08:00:00');
    return checkInTime > scheduledTime;
  });

  // Get currently present employees
  const presentEmployees = employees.filter(emp => {
    const record = todayAttendance.find(a => a.employee_id === emp.id);
    return record?.check_in && !record?.check_out;
  });

  // Get absent employees
  const absentEmployees = employees.filter(emp => {
    const record = todayAttendance.find(a => a.employee_id === emp.id);
    return !record;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {t('Employee Control Center')}
              </h1>
              <p className="text-slate-600 text-sm mt-1">
                {t('Real-time workforce monitoring')}
              </p>
            </div>
            <div className="flex gap-2">
              <BranchSelect
                value={selectedBranch}
                onChange={setSelectedBranch}
              />
              <label className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={e => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{t('Live Updates')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {presentToday}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('Present Today')}
                  </div>
                </div>
                <Users className="w-8 h-8 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {absentToday}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('Absent Today')}
                  </div>
                </div>
                <AlertCircle className="w-8 h-8 text-orange-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {lateEmployees.length}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('Late Today')}
                  </div>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {advancesToday.length}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('Advances Today')}
                  </div>
                </div>
                <Zap className="w-8 h-8 text-purple-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Section */}
        {(absentEmployees.length > 0 || lateEmployees.length > 0) && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-900">
                <AlertTriangle className="w-5 h-5" />
                {t('Active Alerts')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {absentEmployees.slice(0, 3).map(emp => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 bg-white rounded border border-red-200"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {emp.full_name}
                      </div>
                      <div className="text-xs text-red-600">
                        {t('Absent')} - {new Date().toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant="destructive">{t('Absent')}</Badge>
                  </div>
                ))}

                {lateEmployees.slice(0, 3).map(record => {
                  const emp = employees.find(e => e.id === record.employee_id);
                  const checkInTime = new Date(`2000-01-01 ${record.check_in}`);
                  const scheduledTime = new Date('2000-01-01 08:00:00');
                  const lateMinutes = Math.round(
                    (checkInTime - scheduledTime) / 60000
                  );

                  return (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-white rounded border border-orange-200"
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {emp?.full_name}
                        </div>
                        <div className="text-xs text-orange-600">
                          {t('Late')} {lateMinutes} {t('minutes')}
                        </div>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800">
                        +{lateMinutes}m
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Presence */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Currently Present */}
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">
                {t('Currently Present')} ({presentEmployees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {presentEmployees.length > 0 ? (
                  presentEmployees.map(emp => {
                    const record = todayAttendance.find(
                      a => a.employee_id === emp.id
                    );
                    return (
                      <div
                        key={emp.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-green-50"
                      >
                        <div>
                          <div className="font-medium text-slate-900">
                            {emp.full_name}
                          </div>
                          <div className="text-xs text-slate-600">
                            {t('In')}: {record?.check_in}
                          </div>
                        </div>
                        <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-slate-500 py-8">
                    {t('No employees present')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Absent Employees */}
          <Card>
            <CardHeader>
              <CardTitle className="text-orange-600">
                {t('Absent Today')} ({absentEmployees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {absentEmployees.length > 0 ? (
                  absentEmployees.map(emp => (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-orange-50"
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {emp.full_name}
                        </div>
                        <div className="text-xs text-slate-600">
                          {emp.position || 'Employee'}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">
                        {t('Absent')}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 py-8">
                    {t('All employees present')} ✓
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Salary Advances Today */}
        {advancesToday.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>{t('Salary Advances Today')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {advancesToday.map(advance => {
                  const emp = employees.find(e => e.id === advance.employee_id);
                  return (
                    <div
                      key={advance.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{emp?.full_name}</div>
                        <div className="text-xs text-slate-600">
                          {new Date(advance.date).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">
                          SAR {advance.amount}
                        </div>
                        <Badge variant="secondary" className="mt-1">
                          {t('Advance')}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}