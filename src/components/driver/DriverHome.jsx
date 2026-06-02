import React from 'react';
import { Bike, Package, CheckCircle2, Clock, Banknote, CreditCard, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DriverHome({ driver, orders, activeShift, todayCash, todayNetwork, pendingSettlement }) {
  const activeOrders = orders.filter(o => ['pending','preparing','ready','out_for_delivery'].includes(o.status));
  const completedToday = orders.filter(o => o.status === 'delivered');
  const pendingOrders = orders.filter(o => o.status === 'pending');

  const kpis = [
    { label: 'Active Orders', value: activeOrders.length, icon: Package, color: 'bg-blue-50 text-blue-700', badge: activeOrders.length > 0 },
    { label: 'Completed', value: completedToday.length, icon: CheckCircle2, color: 'bg-green-50 text-green-700' },
    { label: 'Cash Collected', value: `${todayCash.toFixed(0)}`, icon: Banknote, color: 'bg-emerald-50 text-emerald-700', prefix: 'SAR' },
    { label: 'Network', value: `${todayNetwork.toFixed(0)}`, icon: CreditCard, color: 'bg-sky-50 text-sky-700', prefix: 'SAR' },
  ];

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="bg-gradient-to-br from-primary/90 to-primary rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-white/80">Welcome back</p>
            <h2 className="text-xl font-bold">{driver?.full_name || 'Driver'}</h2>
          </div>
          <div className="ms-auto">
            {activeShift ? (
              <Badge className="bg-green-400/20 text-green-100 border-green-400/30 text-xs">🟢 On Shift</Badge>
            ) : (
              <Badge className="bg-white/20 text-white/80 border-white/30 text-xs">⚫ Off Shift</Badge>
            )}
          </div>
        </div>
        <div className="text-center py-1">
          <p className="text-white/70 text-xs mb-1">Today's Earnings</p>
          <p className="text-3xl font-black">{(todayCash + todayNetwork).toFixed(0)} <span className="text-xl font-medium">SAR</span></p>
          {pendingSettlement > 0 && (
            <p className="text-white/70 text-xs mt-1">Pending settlement: {pendingSettlement.toFixed(0)} SAR</p>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ label, value, icon: Icon, color, badge, prefix }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className={`p-4 rounded-xl ${color}`}>
              <div className="flex items-start justify-between mb-2">
                <Icon className="w-5 h-5 opacity-70" />
                {badge && <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
              </div>
              <p className="text-2xl font-black">{value}</p>
              <p className="text-xs opacity-70 mt-0.5">{prefix ? `${prefix} · ` : ''}{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Orders Alert */}
      {pendingOrders.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{pendingOrders.length} order{pendingOrders.length > 1 ? 's' : ''} waiting</p>
            <p className="text-xs text-amber-600">Go to Orders tab to accept</p>
          </div>
        </div>
      )}

      {/* Shift status */}
      {!activeShift && (
        <div className="flex items-center gap-3 bg-slate-50 border border-border rounded-xl p-4">
          <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">No active shift</p>
            <p className="text-xs text-muted-foreground">Go to Shift tab to start your shift</p>
          </div>
        </div>
      )}
    </div>
  );
}