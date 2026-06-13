import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/lib/TenantContext';
import { useLanguage } from '@/lib/LanguageContext';
import { generateOperationalAlerts, ALERT_SEVERITY } from '@/services/analytics/alertAnalytics';
import { Card } from '@/components/ui/card';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

const SEVERITY_CONFIG = {
  [ALERT_SEVERITY.CRITICAL]: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200' },
  [ALERT_SEVERITY.HIGH]: { icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200' },
  [ALERT_SEVERITY.MEDIUM]: { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950', border: 'border-yellow-200' },
  [ALERT_SEVERITY.LOW]: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-200' },
  [ALERT_SEVERITY.INFO]: { icon: Info, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-900', border: 'border-slate-200' },
};

export default function OperationalAlerts({ branchKey = 'all' }) {
  const { ownerFilter } = useTenant();
  const { t } = useLanguage();
  const [dismissedAlerts, setDismissedAlerts] = React.useState(new Set());
  const [filterBySeverity, setFilterBySeverity] = React.useState(null);

  // Fetch operational alerts
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['operational_alerts', ownerFilter, branchKey],
    queryFn: () => generateOperationalAlerts(ownerFilter, branchKey),
    enabled: !!ownerFilter?.created_by,
    staleTime: 60000,
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  // Filter alerts based on severity
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (filterBySeverity && alert.severity !== filterBySeverity) return false;
      return !dismissedAlerts.has(alert.message);
    });
  }, [alerts, filterBySeverity, dismissedAlerts]);

  // Group alerts by severity
  const alertsByGroup = useMemo(() => {
    const grouped = {};
    Object.values(ALERT_SEVERITY).forEach(severity => {
      grouped[severity] = filteredAlerts.filter(a => a.severity === severity);
    });
    return grouped;
  }, [filteredAlerts]);

  const handleDismissAlert = (message) => {
    setDismissedAlerts(prev => new Set([...prev, message]));
  };

  const handleDismissAll = () => {
    setDismissedAlerts(new Set(alerts.map(a => a.message)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const totalAlerts = filteredAlerts.length;
  const criticalCount = alertsByGroup[ALERT_SEVERITY.CRITICAL]?.length || 0;
  const highCount = alertsByGroup[ALERT_SEVERITY.HIGH]?.length || 0;

  return (
    <div className="space-y-4">
      {/* Alert Summary */}
      <Card className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">{t('operational_alerts')}</h2>
          <div className="flex gap-2">
            {totalAlerts > 0 && (
              <button
                onClick={handleDismissAll}
                className="px-3 py-1 text-xs bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 transition"
              >
                {t('dismiss_all')}
              </button>
            )}
            <button
              onClick={() => refetch()}
              className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 transition"
            >
              {t('refresh')}
            </button>
          </div>
        </div>

        {/* Alert Count Summary */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white dark:bg-slate-800 rounded p-2 text-center">
            <p className="text-xs text-muted-foreground">{t('total')}</p>
            <p className="text-lg font-bold">{totalAlerts}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950 rounded p-2 text-center">
            <p className="text-xs text-red-600">{t('critical')}</p>
            <p className="text-lg font-bold text-red-600">{criticalCount}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950 rounded p-2 text-center">
            <p className="text-xs text-orange-600">{t('high')}</p>
            <p className="text-lg font-bold text-orange-600">{highCount}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950 rounded p-2 text-center">
            <p className="text-xs text-emerald-600">{t('healthy')}</p>
            <p className="text-lg font-bold text-emerald-600">{totalAlerts === 0 ? '✓' : '—'}</p>
          </div>
        </div>
      </Card>

      {/* Severity Filter Buttons */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterBySeverity(null)}
          className={`px-3 py-1 text-xs rounded whitespace-nowrap transition ${filterBySeverity === null ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
        >
          {t('all')}
        </button>
        {Object.entries(ALERT_SEVERITY).map(([key, severity]) => (
          <button
            key={severity}
            onClick={() => setFilterBySeverity(severity)}
            className={`px-3 py-1 text-xs rounded whitespace-nowrap transition ${filterBySeverity === severity ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
          >
            {t(severity)}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      {totalAlerts === 0 ? (
        <Card className="p-8 text-center bg-emerald-50 dark:bg-emerald-950 border-emerald-200">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
          <p className="text-emerald-600 font-semibold">{t('no_alerts')}</p>
          <p className="text-xs text-muted-foreground">{t('all_systems_operational')}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {Object.entries(alertsByGroup).map(([severity, severityAlerts]) => {
            if (severityAlerts.length === 0) return null;
            const config = SEVERITY_CONFIG[severity];
            const Icon = config.icon;

            return (
              <div key={severity} className="space-y-2">
                {severityAlerts.map((alert, idx) => (
                  <Card key={idx} className={`p-3 border-l-4 ${config.bg} ${config.border}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${config.color}`}>{alert.type}</p>
                        <p className="text-sm text-foreground mt-1">{alert.message}</p>
                        {alert.details && (
                          <div className="text-xs text-muted-foreground mt-2 bg-white dark:bg-slate-900 rounded p-2">
                            <pre className="overflow-x-auto">{JSON.stringify(alert.details, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDismissAlert(alert.message)}
                        className="text-xs text-muted-foreground hover:text-foreground transition flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-Refresh Info */}
      <p className="text-xs text-muted-foreground text-center">{t('alerts_auto_refresh')}</p>
    </div>
  );
}
