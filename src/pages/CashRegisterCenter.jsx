import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Plus, Download, Printer, Share2, Clock, DollarSign, ArrowUpRight,
  ArrowDownRight, BarChart3, RefreshCw, Lock, Unlock
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function KPITile({ label, value, icon: Icon, color = 'blue', sub }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600 border-blue-100',
    green:  'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber:  'bg-amber-50 text-amber-600 border-amber-100',
    red:    'bg-red-50 text-red-600 border-red-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };
  return (
    <Card className={`border ${colors[color]?.split(' ')[2] || 'border-border'}`}>
      <CardContent className="p-3">
        <div className={`w-8 h-8 rounded-lg ${colors[color]?.split(' ')[0]} flex items-center justify-center mb-2`}>
          <Icon className={`w-4 h-4 ${colors[color]?.split(' ')[1]}`} />
        </div>
        <p className="text-lg font-bold text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function CashRegisterCenter() {
  const { t, currency, lang } = useLanguage();
  const { branches, ownerFilter } = useTenant();
  const [tab, setTab] = useState('dashboard');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const today = format(new Date(), 'yyyy-MM-dd');

  const { activeRestaurant } = useTenant();
  const { data: allSales = [] } = useQuery({
    queryKey: ['sales_cash', activeRestaurant?.id],
    queryFn: () => base44.entities.DailySales.filter(activeRestaurant?.id ? { restaurant_id: activeRestaurant.id } : {}, '-date', 500),
    enabled: !!activeRestaurant?.id,
    staleTime: 60000,
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['expenses_cash', activeRestaurant?.id],
    queryFn: () => base44.entities.Expense.filter(activeRestaurant?.id ? { restaurant_id: activeRestaurant.id } : {}, '-date', 500),
    enabled: !!activeRestaurant?.id,
    staleTime: 60000,
  });

  const todaySales = useMemo(() =>
    allSales.filter(s => s.date === today && (selectedBranch === 'all' || s.branch === selectedBranch)),
    [allSales, today, selectedBranch]
  );

  const todayExpenses = useMemo(() =>
    allExpenses.filter(e => e.date === today && (selectedBranch === 'all' || e.branch === selectedBranch || e.branch === 'all')),
    [allExpenses, today, selectedBranch]
  );

  const cashIn = todaySales.reduce((s, r) => s + (r.cash || 0), 0);
  const cashOut = todayExpenses.reduce((s, r) => s + (r.amount || 0), 0);
  
  // Get latest opening/closing cash from the most recent sale record of today
  const latestSale = useMemo(() => todaySales[0], [todaySales]);
  const openingCash = latestSale?.opening_cash || 0;
  const actualClosing = latestSale?.closing_cash || 0;
  
  const expectedClosing = openingCash + cashIn - cashOut;
  const variance = actualClosing > 0 ? actualClosing - expectedClosing : 0;

  const fmt = (n) => `${currency}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // Last 7 days chart data
  const chartData = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      const label = format(subDays(new Date(), 6 - i), 'MM/dd');
      const daySales = allSales.filter(s => s.date === d);
      const dayExp = allExpenses.filter(e => e.date === d);
      return {
        date: label,
        cashIn: daySales.reduce((s, r) => s + (r.cash || 0), 0),
        cashOut: dayExp.reduce((s, r) => s + (r.amount || 0), 0),
      };
    }),
    [allSales, allExpenses]
  );

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold">{t('cash_register')}</h1>
          <p className="text-xs text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
            <Download className="w-3 h-3" /> PDF
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
            <Printer className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Branch selector */}
      <Select value={selectedBranch} onValueChange={setSelectedBranch}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={t('all_branches')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('all_branches')}</SelectItem>
          {branches.length > 0 ? (
            branches.map(b => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)
          ) : (
            <div className="py-2 px-3 text-xs text-muted-foreground text-center">No branches found</div>
          )}
        </SelectContent>
      </Select>

      {/* Shift Info */}
      <div className="bg-muted/50 rounded-xl p-3 border border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Clock className="w-3 h-3" />
          <span>Values below are automatically read from the latest **Add Sale** record for today.</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-background rounded-lg p-2 border border-border">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('opening_cash')}</p>
            <p className="text-sm font-bold text-emerald-600">{fmt(openingCash)}</p>
          </div>
          <div className="bg-background rounded-lg p-2 border border-border">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('closing_cash')}</p>
            <p className="text-sm font-bold text-red-600">{fmt(actualClosing)}</p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-3 h-9">
          <TabsTrigger value="dashboard" className="text-xs">{t('overview')}</TabsTrigger>
          <TabsTrigger value="cashbook" className="text-xs">{t('cash_book')}</TabsTrigger>
          <TabsTrigger value="reconciliation" className="text-xs">{t('cash_reconciliation')}</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <KPITile label={t('opening_cash')}    value={fmt(openingCash)}      icon={Unlock}         color="blue"  />
            <KPITile label={t('cash_in')}          value={fmt(cashIn)}           icon={ArrowUpRight}   color="green" />
            <KPITile label={t('cash_out')}         value={fmt(cashOut)}          icon={ArrowDownRight} color="red"   />
            <KPITile label={t('expected_closing')} value={fmt(expectedClosing)}  icon={DollarSign}     color="amber" />
          </div>

          {/* Variance indicator */}
          {actualClosing > 0 && (
            <Card className={`border-2 ${variance >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {variance >= 0
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    : <AlertTriangle className="w-5 h-5 text-red-600" />
                  }
                  <div>
                    <p className="text-sm font-semibold">{t('cash_variance')}</p>
                    <p className="text-xs text-muted-foreground">{t('actual_closing')}: {fmt(actualClosing)}</p>
                  </div>
                </div>
                <p className={`text-lg font-bold ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {variance >= 0 ? '+' : ''}{fmt(variance)}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">{t('cash_in')} / {t('cash_out')} — {t('last_7_days')}</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`${currency}${v.toLocaleString()}`, '']} />
                  <Bar dataKey="cashIn"  fill="#10b981" radius={[4, 4, 0, 0]} name={t('cash_in')} />
                  <Bar dataKey="cashOut" fill="#ef4444" radius={[4, 4, 0, 0]} name={t('cash_out')} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Book Tab */}
        <TabsContent value="cashbook" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">{t('cash_book')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {todaySales.length === 0 && todayExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('no_data')}</p>
              ) : (
                <div className="space-y-2">
                  {todaySales.map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">{s.branch} — {t('cash')}</p>
                        <p className="text-xs text-muted-foreground">{s.date}</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">+{fmt(s.cash)}</span>
                    </div>
                  ))}
                  {todayExpenses.map((e, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">{e.category}</p>
                        <p className="text-xs text-muted-foreground">{e.date}</p>
                      </div>
                      <span className="text-sm font-bold text-red-500">-{fmt(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reconciliation Tab */}
        <TabsContent value="reconciliation" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">{t('cash_reconciliation')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-2">
                {[
                  { label: t('opening_cash'),    value: openingCash,      color: 'text-blue-600' },
                  { label: `+ ${t('cash_in')}`,  value: cashIn,           color: 'text-emerald-600' },
                  { label: `- ${t('cash_out')}`, value: cashOut,          color: 'text-red-500' },
                  { label: t('expected_closing'), value: expectedClosing,  color: 'text-amber-600', bold: true },
                  { label: t('actual_closing'),   value: actualClosing,    color: 'text-foreground', bold: true },
                  { label: t('variance'),         value: variance,         color: actualClosing > 0 ? (variance >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-muted-foreground', bold: true },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'} ${row.color}`}>{fmt(row.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


    </div>
  );
}
