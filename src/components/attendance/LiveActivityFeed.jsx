import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/LanguageContext';
import { LogIn, LogOut, AlertCircle, Zap, TrendingUp } from 'lucide-react';

export default function LiveActivityFeed({ branch, autoRefresh = true }) {
  const { t } = useLanguage();
  const [activities, setActivities] = useState([]);

  // Fetch attendance records
  const { data: attendanceRecords = [], refetch } = useQuery({
    queryKey: ['attendance-feed', branch],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      return base44.entities.Attendance.filter({
        branch,
        date: today,
      });
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-feed', branch],
    queryFn: () =>
      base44.entities.Notification.filter({
        branch,
      }).then(items => items.slice(0, 50)), // Latest 50
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Process combined activity feed
  useEffect(() => {
    const feedItems = [];

    // Add attendance check-ins/outs
    attendanceRecords.forEach(record => {
      if (record.check_in) {
        feedItems.push({
          id: `checkin-${record.id}`,
          type: 'check_in',
          timestamp: new Date(`${record.date} ${record.check_in}`),
          employee_id: record.employee_id,
          employee_name: record.employee_name,
          message: `Checked in at ${record.check_in}`,
          severity: 'info',
        });
      }

      if (record.check_out) {
        feedItems.push({
          id: `checkout-${record.id}`,
          type: 'check_out',
          timestamp: new Date(`${record.date} ${record.check_out}`),
          employee_id: record.employee_id,
          employee_name: record.employee_name,
          message: `Checked out at ${record.check_out}`,
          severity: 'info',
        });
      }
    });

    // Add notifications
    notifications.forEach(notif => {
      feedItems.push({
        id: notif.id,
        type: notif.type,
        timestamp: new Date(notif.created_date),
        title: notif.title,
        message: notif.message,
        severity: notif.severity,
      });
    });

    // Sort by timestamp descending
    feedItems.sort((a, b) => b.timestamp - a.timestamp);
    setActivities(feedItems.slice(0, 30)); // Show latest 30
  }, [attendanceRecords, notifications]);

  const getIcon = (type, severity) => {
    if (type === 'check_in') return <LogIn className="w-4 h-4 text-green-600" />;
    if (type === 'check_out') return <LogOut className="w-4 h-4 text-blue-600" />;
    if (severity === 'critical') return <AlertCircle className="w-4 h-4 text-red-600" />;
    if (severity === 'warning') return <TrendingUp className="w-4 h-4 text-orange-600" />;
    return <Zap className="w-4 h-4 text-slate-600" />;
  };

  const getSeverityColor = severity => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-orange-50 border-orange-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const getSeverityBadge = severity => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t('Live Activity Feed')}</span>
          {autoRefresh && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span className="text-xs text-slate-600 font-normal">
                {t('Live')}
              </span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {activities.length > 0 ? (
            activities.map(activity => (
              <div
                key={activity.id}
                className={`flex items-start gap-3 p-3 border rounded-lg ${getSeverityColor(
                  activity.severity
                )}`}
              >
                <div className="mt-1">{getIcon(activity.type, activity.severity)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 text-sm truncate">
                    {activity.employee_name || activity.title}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {activity.message}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {activity.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                {activity.severity && (
                  <Badge
                    variant={getSeverityBadge(activity.severity)}
                    className="flex-shrink-0 text-xs"
                  >
                    {t(activity.severity)}
                  </Badge>
                )}
              </div>
            ))
          ) : (
            <div className="text-center text-slate-500 py-8">
              {t('No activities yet')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}