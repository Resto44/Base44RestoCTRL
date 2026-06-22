/**
 * Order Analytics V2 — Online Ordering V2
 * Smart Restaurant ERP — Integrated Module
 * Sales, revenue, top products, top drivers, delivery time, customer retention.
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';
import {
  TrendingUp, DollarSign, Package, Users, Clock, Star,
  Bike, ChefHat, BarChart2, RefreshCw, ArrowUp, ArrowDown
} from 'lucide-react';
import { ORDER_STATUS } from '@/lib/onlineOrderingService';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

// ── Metric Card ────────────────────────────────────────────────────────────
function MetricCard({ title, value, subtitle, icon: Icon, color = 'text-primary', trend = null }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
        {trend !== null && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}% vs yesterday
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Analytics Dashboard ───────────────────────────────────────────────
export default function OrderAnalyticsV2() {
  const { restaurant } = useTenant?.() || {};
  const [dateRange, setDateRange] = useState('7');

  const { data: allOrders = [], isLoading } = useQuery({
    queryKey: ['analytics_orders', restaurant?.id],
    queryFn: () => base44.entities.Order.filter({ restaurant_id: restaurant?.id }),
    enabled: !!restaurant?.id,
    refetchInterval: 30000,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['analytics_customers', restaurant?.id],
    queryFn: () => base44.entities.Customer.filter({ restaurant_id: restaurant?.id }),
    enabled: !!restaurant?.id,
  });

  const days = parseInt(dateRange);
  const dateFrom = subDays(new Date(), days);

  // Filter orders by date range
  const orders = useMemo(() =>
    allOrders.filter(o => new Date(o.created_date) >= dateFrom),
    [allOrders, dateFrom]
  );

  const delivered = orders.filter(o => o.status === ORDER_STATUS.DELIVERED);
  const cancelled = orders.filter(o => o.status === ORDER_STATUS.CANCELLED);
  const revenue = delivered.reduce((s, o) => s + (o.total_amount || 0), 0);
  const avgOrderValue = delivered.length > 0 ? revenue / delivered.length : 0;
  const conversionRate = orders.length > 0 ? (delivered.length / orders.length) * 100 : 0;

  // Daily revenue chart data
  const dailyData = useMemo(() => {
    const interval = eachDayOfInterval({ start: dateFrom, end: new Date() });
    return interval.map(day => {
      const dayOrders = delivered.filter(o => {
        const d = new Date(o.created_date);
        return d >= startOfDay(day) && d < startOfDay(new Date(day.getTime() + 86400000));
      });
      return {
        date: format(day, 'MMM d'),
        revenue: dayOrders.reduce((s, o) => s + (o.total_amount || 0), 0),
        orders: dayOrders.length,
      };
    });
  }, [delivered, dateFrom]);

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    const counts = {};
    orders.forEach(o => {
      counts[o.payment_method] = (counts[o.payment_method] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  // Order status breakdown
  const statusBreakdown = useMemo(() => {
    const counts = {};
    orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  // Top drivers
  const topDrivers = useMemo(() => {
    const driverMap = {};
    delivered.forEach(o => {
      if (!o.driver_name) return;
      if (!driverMap[o.driver_name]) driverMap[o.driver_name] = { name: o.driver_name, deliveries: 0, revenue: 0 };
      driverMap[o.driver_name].deliveries++;
      driverMap[o.driver_name].revenue += o.delivery_fee || 0;
    });
    return Object.values(driverMap).sort((a, b) => b.deliveries - a.deliveries).slice(0, 5);
  }, [delivered]);

  // Repeat customers
  const repeatCustomers = useMemo(() => {
    const customerOrders = {};
    orders.forEach(o => {
      if (!o.customer_id) return;
      customerOrders[o.customer_id] = (customerOrders[o.customer_id] || 0) + 1;
    });
    const repeat = Object.values(customerOrders).filter(c => c > 1).length;
    const total = Object.keys(customerOrders).length;
    return { repeat, total, rate: total > 0 ? (repeat / total) * 100 : 0 };
  }, [orders]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            Order Analytics V2
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time insights for Online Ordering</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Today</SelectItem>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Orders" value={orders.length} icon={Package} subtitle={`${delivered.length} delivered`} />
        <MetricCard title="Revenue" value={`${revenue.toFixed(0)} SAR`} icon={DollarSign} color="text-green-600" />
        <MetricCard title="Avg Order Value" value={`${avgOrderValue.toFixed(0)} SAR`} icon={TrendingUp} color="text-blue-600" />
        <MetricCard title="Conversion Rate" value={`${conversionRate.toFixed(1)}%`} icon={Star} color="text-amber-600" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Cancelled" value={cancelled.length} icon={Package} color="text-red-500" />
        <MetricCard title="Customers" value={customers.length} icon={Users} color="text-indigo-600" />
        <MetricCard title="Repeat Customers" value={`${repeatCustomers.rate.toFixed(1)}%`} icon={Users} color="text-purple-600" subtitle={`${repeatCustomers.repeat} of ${repeatCustomers.total}`} />
        <MetricCard title="Active Orders" value={orders.filter(o => !['delivered','cancelled'].includes(o.status)).length} icon={Clock} color="text-primary" />
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Revenue & Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} name="Revenue (SAR)" />
              <Bar yAxisId="right" dataKey="orders" fill="#f59e0b" name="Orders" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={paymentBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {paymentBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Order Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {statusBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366f1" name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Drivers */}
      {topDrivers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bike className="w-4 h-4" /> Top Drivers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topDrivers.map((driver, idx) => (
                <div key={driver.name} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{driver.name}</p>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{ width: `${(driver.deliveries / (topDrivers[0]?.deliveries || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{driver.deliveries}</p>
                    <p className="text-xs text-muted-foreground">deliveries</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
