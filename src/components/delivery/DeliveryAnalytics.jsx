import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Truck, DollarSign, XCircle } from 'lucide-react';

export default function DeliveryAnalytics({ orders, drivers, today }) {
  const stats = useMemo(() => {
    const delivered = orders.filter(o => o.status === 'delivered');
    const cancelled = orders.filter(o => o.status === 'cancelled');
    const totalRevenue = delivered.reduce((s, o) => s + (o.total_amount || 0), 0);
    const cashRevenue = delivered.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total_amount || 0), 0);
    const networkRevenue = delivered.filter(o => o.payment_method === 'network').reduce((s, o) => s + (o.total_amount || 0), 0);
    const creditRevenue = delivered.filter(o => o.payment_method === 'credit').reduce((s, o) => s + (o.total_amount || 0), 0);
    return { delivered: delivered.length, cancelled: cancelled.length, totalRevenue, cashRevenue, networkRevenue, creditRevenue };
  }, [orders]);

  // Per-driver breakdown
  const driverStats = useMemo(() => {
    return drivers.map(d => {
      const dOrders = orders.filter(o => o.driver_id === d.id && o.status === 'delivered');
      return {
        name: d.full_name?.split(' ')[0],
        orders: dOrders.length,
        revenue: dOrders.reduce((s, o) => s + (o.total_amount || 0), 0),
      };
    }).filter(d => d.orders > 0);
  }, [orders, drivers]);

  // Payment method pie
  const paymentData = [
    { name: 'Cash', value: stats.cashRevenue, color: '#10b981' },
    { name: 'Network', value: stats.networkRevenue, color: '#3b82f6' },
    { name: 'Credit', value: stats.creditRevenue, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const kpis = [
    { label: 'Delivered', value: stats.delivered, icon: Truck, color: 'text-green-600' },
    { label: 'Cancelled', value: stats.cancelled, icon: XCircle, color: 'text-red-500' },
    { label: 'Revenue', value: `${stats.totalRevenue.toFixed(0)} SAR`, icon: DollarSign, color: 'text-primary' },
    { label: 'Avg Order', value: stats.delivered > 0 ? `${(stats.totalRevenue / stats.delivered).toFixed(0)} SAR` : '—', icon: TrendingUp, color: 'text-violet-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {driverStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm">Orders by Driver</CardTitle></CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={driverStats} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v, n) => [n === 'revenue' ? `${v} SAR` : v, n === 'revenue' ? 'Revenue' : 'Orders']} />
                <Bar dataKey="orders" fill="#3b82f6" radius={[3,3,0,0]} name="orders" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {paymentData.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm">Payment Mix</CardTitle></CardHeader>
          <CardContent className="pb-3">
            <div className="flex items-center gap-4">
              <PieChart width={120} height={120}>
                <Pie data={paymentData} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value">
                  {paymentData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div className="space-y-2">
                {paymentData.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-semibold">{d.value.toFixed(0)} SAR</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}