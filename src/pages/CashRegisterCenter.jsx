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
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: allSales = [] } = useQuery({
    queryKey: ['sales_cash', ownerFilter],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter || {}, '-date', 500),
    staleTime: 60000,
    enabled: !!ownerFilter?.created_by,
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['expenses_cash', ownerFilter],
    queryFn: () => base44.entities.Expense.filter(ownerFilter || {}, '-date', 500),
    staleTime: 60000,
    enabled: !!ownerFilter?.created_by,
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
  const openingCash = parseFloat(openingAmount) || 0;
  const expectedClosing = openingCash + cashIn - cashOut;
  const actualClosing = parseFloat(closingAmount) || 0;
  const variance = actualClosing - expectedClosing;

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
          {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Shift Controls */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => setShowOpenModal(true)}
          className="h-12 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          <Unlock className="w-4 h-4" />
          <span className="text-sm font-semibold">{t('opening_cash')}</span>
        </Button>
        <Button
          onClick={() => setShowCloseModal(true)}
          className="h-12 gap-2 bg-red-500 hover:bg-red-600 text-white"
        >
          <Lock className="w-4 h-4" />
          <span className="text-sm font-semibold">{t('closing_cash')}</span>
        </Button>
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
                  { label: t('variance'),         value: variance,         color: variance >= 0 ? 'text-emerald-600' : 'text-red-500', bold: true },
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

      {/* Opening Cash Modal */}
      <Dialog open={showOpenModal} onOpenChange={setShowOpenModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('opening_cash')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">{t('amount')} ({currency})</Label>
              <Input
                type="number"
                value={openingAmount}
                onChange={e => setOpeningAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1.5"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowOpenModal(false)} variant="outline" className="flex-1">{t('cancel')}</Button>
              <Button onClick={() => setShowOpenModal(false)} className="flex-1 bg-emerald-500 hover:bg-emerald-600">{t('confirm')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Closing Cash Modal */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('closing_cash')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('expected_closing')}</span>
                <span className="font-semibold">{fmt(expectedClosing)}</span>
              </div>
            </div>
            <div>
              <Label className="text-sm">{t('actual_closing')} ({currency})</Label>
              <Input
                type="number"
                value={closingAmount}
                onChange={e => setClosingAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1.5"
              />
            </div>
            {closingAmount && (
              <div className={`p-2 rounded-lg text-sm font-semibold text-center ${variance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {t('variance')}: {variance >= 0 ? '+' : ''}{fmt(variance)}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => setShowCloseModal(false)} variant="outline" className="flex-1">{t('cancel')}</Button>
              <Button onClick={() => setShowCloseModal(false)} className="flex-1 bg-red-500 hover:bg-red-600 text-white">{t('confirm')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
