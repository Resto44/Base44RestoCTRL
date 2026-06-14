import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import { formatDate } from '@/lib/helpers';
import { AlertTriangle, Package, TrendingDown, List, BarChart3, ShoppingCart } from 'lucide-react';
import ForecastReorderPanel from '@/components/inventory/ForecastReorderPanel';
import AIRestockAlerts from '@/components/inventory/AIRestockAlerts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function statusBadge(daysLeft, t) {
  if (daysLeft === null || daysLeft === undefined) return null;
  if (daysLeft <= 3) return <Badge className="bg-red-100 text-red-700 border-red-200">{t('severity_critical')}</Badge>;
  if (daysLeft <= 7) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{t('risk_low')}</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{t('active')}</Badge>;
}

export default function InventoryForecast() {
  const { lang, t } = useLanguage();
  const { branches } = useTenant();
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [lookbackDays, setLookbackDays] = useState(30);

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => base44.entities.Inventory.list('-date', 2000), staleTime: 300000,
  });
  const { data: purchases = [] } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => base44.entities.Purchase.list('-date', 2000), staleTime: 120000,
  });
  const { data: wastes = [] } = useQuery({
    queryKey: ['inventory_waste'],
    queryFn: () => base44.entities.InventoryWaste.list('-date', 2000), staleTime: 120000,
  });

  const cutoffDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - lookbackDays);
    return formatDate(d);
  }, [lookbackDays]);

  const forecast = useMemo(() => {
    // Get latest inventory record per product per branch
    const invMap = {};
    inventory.forEach(inv => {
      const key = `${inv.product_id}__${inv.branch}`;
      if (!invMap[key] || inv.date > invMap[key].date) invMap[key] = inv;
    });

    // Compute avg daily consumption from purchases in lookback period
    const today = formatDate(new Date());
    const periodPurchases = purchases.filter(p => p.date >= cutoffDate && p.date <= today);
    const periodWastes = wastes.filter(w => w.date >= cutoffDate && w.date <= today);

    // Group purchases by product+branch
    const consumptionMap = {};
    periodPurchases.forEach(p => {
      const key = `${p.product_id}__${p.branch}`;
      if (!consumptionMap[key]) consumptionMap[key] = { qty: 0, product_name: p.product_name, unit: '' };
      consumptionMap[key].qty += (p.qty || 0);
    });
    // Waste also counts as consumption
    periodWastes.forEach(w => {
      const key = `${w.product_id}__${w.branch}`;
      if (!consumptionMap[key]) consumptionMap[key] = { qty: 0, product_name: w.product_name, unit: w.unit || '' };
      consumptionMap[key].qty += (w.qty || 0);
    });

    return Object.entries(consumptionMap).map(([key, cons]) => {
      const [product_id, branch] = key.split('__');
      const inv = invMap[key];
      const avgDaily = cons.qty / lookbackDays;
      const currentStock = inv ? (inv.opening_stock || 0) : 0;
      const daysLeft = avgDaily > 0 ? Math.floor(currentStock / avgDaily) : null;

      return {
        product_id,
        product_name: cons.product_name || product_id,
        branch,
        unit: inv?.unit || cons.unit || '',
        avgDaily: Math.round(avgDaily * 100) / 100,
        currentStock,
        daysLeft,
        needsReorder: daysLeft !== null && daysLeft <= 7,
      };
    }).filter(r => selectedBranch === 'all' || r.branch === selectedBranch)
      .sort((a, b) => {
        const da = a.daysLeft ?? 999;
        const db = b.daysLeft ?? 999;
        return da - db;
      });
  }, [inventory, purchases, wastes, lookbackDays, cutoffDate, selectedBranch]);

  const criticalCount = forecast.filter(r => r.daysLeft !== null && r.daysLeft <= 3).length;
  const lowCount = forecast.filter(r => r.daysLeft !== null && r.daysLeft > 3 && r.daysLeft <= 7).length;

  // Chart data: top 10 by days left (lowest first)
  const chartData = forecast.slice(0, 10).map(r => ({
    name: r.product_name.length > 12 ? r.product_name.slice(0, 12) + '…' : r.product_name,
    days: r.daysLeft ?? 0,
    stock: r.currentStock,
  }));

  return (
    <div>
      <PageHeader title={t('inventory_forecast')} />

      {/* Alert summary */}
      {(criticalCount > 0 || lowCount > 0) && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span>{criticalCount} {t('severity_critical')}</span>
            </div>
          )}
          {lowCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
              <TrendingDown className="w-4 h-4" />
              <span>{lowCount} {t('risk_low')}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">
            <Package className="w-4 h-4" />
            <span>{forecast.length - criticalCount - lowCount} {t('active')}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={String(lookbackDays)} onValueChange={v => setLookbackDays(Number(v))}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">{t('last_30_days')}</SelectItem>
            <SelectItem value="60">60 {t('days_of_stock')}</SelectItem>
            <SelectItem value="90">90 {t('days_of_stock')}</SelectItem>
          </SelectContent>
        </Select>
        {branches.length > 0 && (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_branches')}</SelectItem>
              {branches.map(b => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4">{t('avg_consumption')} — {t('days_of_stock')}</p>

      {forecast.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>{t('no_data')}</p>
        </Card>
      ) : (
        <Tabs defaultValue="list">
          <TabsList className="mb-4">
            <TabsTrigger value="list" className="gap-1"><List className="w-3.5 h-3.5" /> {t('table')}</TabsTrigger>
            <TabsTrigger value="chart" className="gap-1"><BarChart3 className="w-3.5 h-3.5" /> {t('chart')}</TabsTrigger>
            <TabsTrigger value="reorder" className="gap-1 text-amber-700"><ShoppingCart className="w-3.5 h-3.5" /> {t('reorder_suggested')}</TabsTrigger>
            <TabsTrigger value="ai" className="gap-1 text-violet-700"><AlertTriangle className="w-3.5 h-3.5" /> AI Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <Card className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="pb-2 font-semibold">{t('product')}</th>
                      <th className="pb-2 font-semibold">{t('branch')}</th>
                      <th className="pb-2 text-end font-semibold">{t('avg_consumption')}</th>
                      <th className="pb-2 text-end font-semibold">{t('opening_stock')}</th>
                      <th className="pb-2 text-end font-semibold">{t('days_of_stock')}</th>
                      <th className="pb-2 font-semibold">{t('days_of_stock')} bar</th>
                      <th className="pb-2 text-center font-semibold">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.map((r, i) => (
                      <tr key={i} className={`border-b border-border/40 last:border-0 ${r.needsReorder ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                        <td className="py-2.5 font-medium">{r.product_name}</td>
                        <td className="py-2.5 text-muted-foreground text-xs">{r.branch}</td>
                        <td className="py-2.5 text-end">{r.avgDaily} {r.unit}</td>
                        <td className="py-2.5 text-end">{r.currentStock} {r.unit}</td>
                        <td className={`py-2.5 text-end font-bold ${r.daysLeft !== null && r.daysLeft <= 3 ? 'text-red-500' : r.daysLeft !== null && r.daysLeft <= 7 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {r.daysLeft !== null ? r.daysLeft : '—'}
                        </td>
                        <td className="py-2.5 w-24">
                          {r.daysLeft !== null && (
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div className="h-1.5 rounded-full" style={{
                                width: `${Math.min(100, (r.daysLeft / 30) * 100)}%`,
                                background: r.daysLeft <= 3 ? '#ef4444' : r.daysLeft <= 7 ? '#f59e0b' : '#10b981',
                              }} />
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 text-center">{statusBadge(r.daysLeft, t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="chart">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">{t('days_of_stock')} — Top Items</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip formatter={v => [`${v} days`, t('days_of_stock')]} />
                  <Bar dataKey="days" radius={[0, 4, 4, 0]} name={t('days_of_stock')}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.days <= 3 ? '#ef4444' : entry.days <= 7 ? '#f59e0b' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          <TabsContent value="reorder">
            <ForecastReorderPanel forecast={forecast} />
          </TabsContent>

          <TabsContent value="ai">
            <AIRestockAlerts forecast={forecast} purchases={purchases} branches={branches} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}