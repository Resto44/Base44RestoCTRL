import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/lib/LanguageContext';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toValidDateRange(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

function formatIsoDate(date) {
  return date.toISOString().split('T')[0];
}

function hasCheckIn(record) {
  return Boolean(record?.check_in || record?.status === 'present' || record?.status === 'late' || record?.status === 'half_day');
}

export default function AttendanceAnalytics({ branch, dateRange = 7 }) {
  const { t } = useLanguage();
  const safeDateRange = toValidDateRange(dateRange);

  // Fetch attendance history
  const { data: attendanceHistoryData = [] } = useQuery({
    queryKey: ['attendance-history', branch || 'all', safeDateRange],
    queryFn: async () => {
      const records = branch
        ? await base44.entities.Attendance.filter({ branch })
        : await base44.entities.Attendance.list('-date', 5000);

      return safeArray(records);
    },
  });

  const attendanceHistory = useMemo(() => safeArray(attendanceHistoryData), [attendanceHistoryData]);

  // Calculate daily attendance metrics
  const dailyMetrics = useMemo(() => {
    const metrics = [];

    for (let i = safeDateRange - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = formatIsoDate(date);

      const dayRecords = attendanceHistory.filter(r => r?.date === dateStr);
      const present = dayRecords.filter(hasCheckIn).length;
      const absent = dayRecords.filter(r => r?.status === 'absent' || !hasCheckIn(r)).length;
      const total = present + absent;

      metrics.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        present,
        absent,
        total,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
      });
    }

    return metrics;
  }, [attendanceHistory, safeDateRange]);

  // Calculate punctuality
  const lateCount = attendanceHistory.filter(r => {
    if (!r?.check_in) return r?.status === 'late';
    const checkInTime = new Date(`2000-01-01 ${r.check_in}`);
    const scheduledTime = new Date('2000-01-01 08:00:00');
    return Number.isFinite(checkInTime.getTime()) && checkInTime > scheduledTime;
  }).length;

  const onTimeCount = attendanceHistory.filter(r => {
    if (!r?.check_in) return r?.status === 'present' || r?.status === 'half_day';
    const checkInTime = new Date(`2000-01-01 ${r.check_in}`);
    const scheduledTime = new Date('2000-01-01 08:00:00');
    return Number.isFinite(checkInTime.getTime()) && checkInTime <= scheduledTime;
  }).length;

  const punctualityData = [
    {
      name: t('On Time'),
      value: onTimeCount,
      fill: '#22c55e',
    },
    {
      name: t('Late'),
      value: lateCount,
      fill: '#f97316',
    },
  ];

  // Attendance status summary
  const totalRecords = attendanceHistory.filter(r => r?.status !== 'vacation').length;
  const totalPresent = attendanceHistory.filter(hasCheckIn).length;
  const totalAbsent = attendanceHistory.filter(r => r?.status === 'absent').length;
  const attendanceRate =
    totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {attendanceRate}%
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {t('Attendance Rate')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-900">
                {totalPresent}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {t('Total Present')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {totalAbsent}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {t('Total Absent')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {lateCount}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {t('Late Arrivals')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Trend */}
      <Card>
        <CardHeader>
          <CardTitle>{t('Attendance Trend')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#22c55e"
                name={t('Attendance Rate %')}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Daily Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{t('Daily Attendance')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" fill="#22c55e" name={t('Present')} />
              <Bar dataKey="absent" fill="#f97316" name={t('Absent')} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Punctuality */}
      <Card>
        <CardHeader>
          <CardTitle>{t('Punctuality')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={punctualityData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {punctualityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
