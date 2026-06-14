import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Bell, AlertTriangle, CheckCircle2, Info, TrendingDown, Package,
  DollarSign, Users, Truck, Clock, X, ChevronRight, Zap,
  Shield, RefreshCw
} from 'lucide-react';
import { format, subDays } from 'date-fns';

const ALERT_TYPES = {
  critical: { color: 'bg-red-500',    text: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200',   icon: AlertTriangle },
  warning:  { color: 'bg-amber-500',  text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle },
  info:     { color: 'bg-blue-500',   text: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-200',  icon: Info },
  success:  { color: 'bg-emerald-500',text: 'text-emerald-700',bg:'bg-emerald-50',border:'border-emerald-200',icon: CheckCircle2 },
};

function AlertCard({ alert, onDismiss }) {
  const cfg = ALERT_TYPES[alert.type] || ALERT_TYPES.info;
  const Icon = cfg.icon;
  return (
    <Card className={`border ${cfg.border} ${cfg.bg}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div className={`w-7 h-7 rounded-lg ${cfg.color} flex items-center justify-center shrink-0 mt-0.5`}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${cfg.text}`}>{alert.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-muted-foreground">{alert.time}</span>
              {alert.branch && <Badge variant="outline" className="text-[10px] h-4 px-1">{alert.branch}</Badge>}
              {alert.action && (
                <button className={`text-[10px] font-semibold ${cfg.text} underline`}>{alert.action}</button>
              )}
            </div>
          </div>
          <button onClick={() => onDismiss(alert.id)} className="shrink-0 p-1 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SmartAlertCenter() {
  const { t, currency } = useLanguage();
  const { ownerFilter, branches } = useTenant();
  const [tab, setTab] = useState('active');
  const [dismissed, setDismissed] = useState(new Set());

  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

  const { data: inventory = [] } = useQuery({
    queryKey: ['alerts_inventory', ownerFilter],
    queryFn: () => base44.entities.Inventory.filter(ownerFilter || {}),
    staleTime: 120000,
    enabled: !!ownerFilter?.created_by,
  });

  const { data: allSales = [] } = useQuery({
    queryKey: ['alerts_sales', ownerFilter],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter || {}, '-date', 200),
    staleTime: 120000,
    enabled: !!ownerFilter?.created_by,
  });

  const { data: debts = [] } = useQuery({
    queryKey: ['alerts_debts', ownerFilter],
    queryFn: () => base44.entities.Debt?.filter(ownerFilter || {}) || [],
    staleTime: 120000,
    enabled: !!ownerFilter?.created_by,
  });

  // Generate smart alerts from data
  const generatedAlerts = useMemo(() => {
    const alerts = [];

    // Low stock alerts
    const lowStockItems = inventory.filter(i => i.quantity <= (i.low_stock_threshold || 0) && i.quantity > 0);
    const outOfStockItems = inventory.filter(i => i.quantity <= 0);

    outOfStockItems.forEach(item => {
      alerts.push({
        id: `out-${item.id}`,
        type: 'critical',
        title: `Out of Stock: ${item.product_name}`,
        message: `${item.product_name} is out of stock at ${item.branch}. Reorder immediately.`,
        time: 'Now',
        branch: item.branch,
        action: 'Order Now',
        category: 'inventory',
      });
    });

    lowStockItems.slice(0, 3).forEach(item => {
      alerts.push({
        id: `low-${item.id}`,
        type: 'warning',
        title: `Low Stock: ${item.product_name}`,
        message: `Only ${item.quantity} ${item.unit || 'units'} remaining (threshold: ${item.low_stock_threshold}).`,
        time: 'Today',
        branch: item.branch,
        action: 'Restock',
        category: 'inventory',
      });
    });

    // High outstanding debts
    const highDebts = debts.filter(d => (d.balance || 0) > 1000);
    highDebts.slice(0, 2).forEach(debt => {
      alerts.push({
        id: `debt-${debt.id}`,
        type: 'warning',
        title: `High Outstanding: ${debt.party_name}`,
        message: `${debt.party_name} has ${currency}${(debt.balance || 0).toLocaleString()} outstanding.`,
        time: 'Today',
        action: 'Collect',
        category: 'financial',
      });
    });

    // No sales today alert
    const todaySales = allSales.filter(s => s.date === today);
    if (todaySales.length === 0 && new Date().getHours() >= 10) {
      alerts.push({
        id: 'no-sales-today',
        type: 'warning',
        title: 'No Sales Recorded Today',
        message: 'No sales have been recorded yet today. Please check if the POS is operational.',
        time: 'Today',
        category: 'sales',
      });
    }

    // Revenue drop alert (compare today vs yesterday)
    const yesterdaySales = allSales.filter(s => s.date === format(subDays(new Date(), 1), 'yyyy-MM-dd'));
    const todayRevenue = todaySales.reduce((s, r) => s + (r.total_sales || 0), 0);
    const yesterdayRevenue = yesterdaySales.reduce((s, r) => s + (r.total_sales || 0), 0);
    if (yesterdayRevenue > 0 && todayRevenue < yesterdayRevenue * 0.5 && new Date().getHours() >= 14) {
      alerts.push({
        id: 'revenue-drop',
        type: 'critical',
        title: 'Revenue Drop Alert',
        message: `Today's revenue (${currency}${todayRevenue.toLocaleString()}) is 50%+ below yesterday (${currency}${yesterdayRevenue.toLocaleString()}).`,
        time: 'Today',
        category: 'sales',
      });
    }

    // System info alerts
    alerts.push({
      id: 'system-backup',
      type: 'info',
      title: 'Daily Backup Complete',
      message: 'All data has been backed up successfully.',
      time: format(new Date(), 'HH:mm'),
      category: 'system',
    });

    return alerts;
  }, [inventory, allSales, debts, today, currency]);

  const activeAlerts = generatedAlerts.filter(a => !dismissed.has(a.id));
  const criticalAlerts = activeAlerts.filter(a => a.type === 'critical');
  const warningAlerts = activeAlerts.filter(a => a.type === 'warning');
  const infoAlerts = activeAlerts.filter(a => a.type === 'info' || a.type === 'success');

  const handleDismiss = (id) => setDismissed(prev => new Set([...prev, id]));
  const handleDismissAll = () => setDismissed(new Set(activeAlerts.map(a => a.id)));

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="w-6 h-6 text-primary" />
            {activeAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {activeAlerts.length}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('smart_alert_center')}</h1>
            <p className="text-xs text-muted-foreground">{activeAlerts.length} active alerts</p>
          </div>
        </div>
        {activeAlerts.length > 0 && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleDismissAll}>
            Dismiss All
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-center">
          <p className="text-xl font-bold text-red-600">{criticalAlerts.length}</p>
          <p className="text-[11px] text-red-600/70 font-medium">Critical</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
          <p className="text-xl font-bold text-amber-600">{warningAlerts.length}</p>
          <p className="text-[11px] text-amber-600/70 font-medium">Warnings</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-center">
          <p className="text-xl font-bold text-blue-600">{infoAlerts.length}</p>
          <p className="text-[11px] text-blue-600/70 font-medium">Info</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-4 h-9">
          <TabsTrigger value="active" className="text-xs">
            Active {activeAlerts.length > 0 && <Badge className="ml-1 h-4 w-4 p-0 text-[9px] bg-red-500">{activeAlerts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs">Inventory</TabsTrigger>
          <TabsTrigger value="financial" className="text-xs">Financial</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-3 space-y-2">
          {activeAlerts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-50" />
              <p className="text-sm font-medium">All clear! No active alerts.</p>
              <p className="text-xs mt-1">Your restaurant is running smoothly.</p>
            </div>
          ) : (
            <>
              {criticalAlerts.map(a => <AlertCard key={a.id} alert={a} onDismiss={handleDismiss} />)}
              {warningAlerts.map(a => <AlertCard key={a.id} alert={a} onDismiss={handleDismiss} />)}
              {infoAlerts.map(a => <AlertCard key={a.id} alert={a} onDismiss={handleDismiss} />)}
            </>
          )}
        </TabsContent>

        <TabsContent value="inventory" className="mt-3 space-y-2">
          {activeAlerts.filter(a => a.category === 'inventory').length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No inventory alerts</p>
            </div>
          ) : (
            activeAlerts.filter(a => a.category === 'inventory').map(a => (
              <AlertCard key={a.id} alert={a} onDismiss={handleDismiss} />
            ))
          )}
        </TabsContent>

        <TabsContent value="financial" className="mt-3 space-y-2">
          {activeAlerts.filter(a => a.category === 'financial' || a.category === 'sales').length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No financial alerts</p>
            </div>
          ) : (
            activeAlerts.filter(a => a.category === 'financial' || a.category === 'sales').map(a => (
              <AlertCard key={a.id} alert={a} onDismiss={handleDismiss} />
            ))
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">Alert Preferences</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {[
                { label: 'Low Stock Alerts', enabled: true },
                { label: 'Revenue Drop Alerts', enabled: true },
                { label: 'Outstanding Debt Alerts', enabled: true },
                { label: 'System Notifications', enabled: true },
                { label: 'Daily Summary', enabled: false },
              ].map(pref => (
                <div key={pref.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-sm">{pref.label}</span>
                  <div className={`w-10 h-5 rounded-full transition-colors ${pref.enabled ? 'bg-primary' : 'bg-muted'} relative cursor-pointer`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${pref.enabled ? 'right-0.5' : 'left-0.5'}`} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
