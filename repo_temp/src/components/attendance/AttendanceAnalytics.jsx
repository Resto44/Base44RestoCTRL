import React from 'react';
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

export default function AttendanceAnalytics({ branch, dateRange = 7 }) {
  const { t } = useLanguage();

  // Fetch attendance history
  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ['attendance-history', branch, dateRange],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      return base44.entities.Attendance.filter({
        branch,
      });
    },
  });

  // Calculate daily attendance metrics
  const dailyMetrics = [];
  for (let i = dateRange - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayRecords = attendanceHistory.filter(r => r.date === dateStr);
    const present = dayRecords.filter(r => r.check_in).length;
    const absent = dayRecords.filter(r => !r.check_in).length;

    dailyMetrics.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      present,
      absent,
      total: present + absent,
      rate: present > 0 ? Math.round((present / (present + absent)) * 100) : 0,
    });
  }

  // Calculate punctuality
  const lateCount = attendanceHistory.filter(r => {
    if (!r.check_in) return false;
    const checkInTime = new Date(`2000-01-01 ${r.check_in}`);
    const scheduledTime = new Date('2000-01-01 08:00:00');
    return checkInTime > scheduledTime;
  }).length;

  const onTimeCount = attendanceHistory.filter(r => {
    if (!r.check_in) return false;
    const checkInTime = new Date(`2000-01-01 ${r.check_in}`);
    const scheduledTime = new Date('2000-01-01 08:00:00');
    return checkInTime <= scheduledTime;
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
  const totalRecords = attendanceHistory.length;
  const totalPresent = attendanceHistory.filter(r => r.check_in).length;
  const totalAbsent = totalRecords - totalPresent;
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