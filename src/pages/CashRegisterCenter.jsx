/**
 * CashRegisterCenter — READ ONLY.
 * Reads opening_cash, closing_cash, cash_difference, cash_status
 * from the latest DailySales record per branch per date.
 * NO manual entry. Source of truth = Add Sale records.
 *
 * Cash Movement (today's cash inflow) = closing_cash - opening_cash
 */
import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Clock, DollarSign, ArrowUpRight, ArrowDownRight, BarChart3, Lock,
  Banknote, Info
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

function CashStatusBadge({ status }) {
  if (!status) return null;
  const config = {
    Balanced: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    Shortage: { color: 'bg-red-100 text-red-700 border-red-200', icon: TrendingDown },
    Overage:  { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: TrendingUp },
  };
  const c = config[status] || config.Balanced;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.color}`}>
      <Icon className="w-3.5 h-3.5" />{status}
    </span>
  );
}

export default function CashRegisterCenter() {
  const { t, currency } = useLanguage();
  const { branches, ownerFilter } = useTenant();
  const [tab, setTab] = useState('dashboard');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: allSales = [], isLoading } = useQuery({
    queryKey: ['sales_cash', ownerFilter],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter || {}, '-date', 500),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
    staleTime: 30000,
  });

  const todaySales = useMemo(() =>
    allSales.filter(s => s.date === today && (selectedBranch === 'all' || s.branch === selectedBranch)),
    [allSales, today, selectedBranch]
  );

  // Latest sale record for today (source of truth for cash register)
  const latestSale = useMemo(() => {
    return todaySales.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))[0] || null;
  }, [todaySales]);

  const openingCash = Number(latestSale?.opening_cash || 0);
  const closingCash = Number(latestSale?.closing_cash || 0);

  // Cash Movement = closing_cash - opening_cash (today's cash inflow only)
  const cashMovement = latestSale ? (closingCash - openingCash) : 0;

  // Cash status from record, or computed
  const cashStatus = latestSale?.cash_status || (
    !latestSale ? null :
    cashMovement === 0 ? 'Balanced' :
    cashMovement < 0 ? 'Shortage' : 'Overage'
  );

  const cashDifference = latestSale?.cash_difference ?? cashMovement;

  const fmt = (n) => `${currency}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // Last 7 days chart data — uses cash_difference (movement) per day
  const chartData = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      const label = format(subDays(new Date(), 6 - i), 'MM/dd');
      const daySales = allSales.filter(s => s.date === d && (selectedBranch === 'all' || s.branch === selectedBranch));
      // Latest sale for that day
      const latest = daySales.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))[0];
      const opening = Number(latest?.opening_cash || 0);
      const closing = Number(latest?.closing_cash || 0);
      const movement = latest ? (closing - opening) : 0;
      return {
        date: label,
        opening,
        closing,
        movement,
      };
    }),
    [allSales, selectedBranch]
  );

  const diffColor = cashDifference > 0 ? 'text-amber-600' : cashDifference < 0 ? 'text-red-600' : 'text-emerald-600';

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold">{t('cash_register')}</h1>
          <p className="text-xs text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-lg px-2.5 py-1.5">
          <Lock className="w-3 h-3" />
          <span>Read Only</span>
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

      {/* Read-only source info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <div className="flex items-center gap-2 text-xs text-blue-700 mb-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">Values are automatically read from the latest Add Sale record for today.</span>
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : !latestSale ? (
          <p className="text-xs text-muted-foreground">No sale record found for today{selectedBranch !== 'all' ? ` (${selectedBranch})` : ''}.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg p-2 border border-blue-100">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('opening_cash')}</p>
              <p className="text-sm font-bold text-blue-600">{fmt(openingCash)}</p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-blue-100">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('closing_cash')}</p>
              <p className="text-sm font-bold text-foreground">{fmt(closingCash)}</p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-blue-100">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Cash Movement</p>
              <p className={`text-sm font-bold ${diffColor}`}>
                {cashMovement >= 0 ? '+' : ''}{fmt(cashMovement)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-blue-100">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Cash Status</p>
              <div className="mt-0.5">
                <CashStatusBadge status={cashStatus} />
              </div>
            </div>
          </div>
        )}
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
            <KPITile label={t('opening_cash')}   value={fmt(openingCash)}   icon={Banknote}       color="blue"  />
            <KPITile label={t('closing_cash')}   value={fmt(closingCash)}   icon={DollarSign}     color="green" />
            <KPITile label="Cash Movement"       value={`${cashMovement >= 0 ? '+' : ''}${fmt(cashMovement)}`} icon={cashMovement >= 0 ? ArrowUpRight : ArrowDownRight} color={cashMovement >= 0 ? 'amber' : 'red'} sub="Closing − Opening" />
            <KPITile label="Cash Status"         value={cashStatus || '—'}  icon={cashStatus === 'Shortage' ? TrendingDown : cashStatus === 'Overage' ? TrendingUp : CheckCircle2} color={cashStatus === 'Shortage' ? 'red' : cashStatus === 'Overage' ? 'amber' : 'green'} />
          </div>

          {/* Cash Difference card */}
          {latestSale && (
            <Card className={`border-2 ${cashDifference === 0 ? 'border-emerald-200 bg-emerald-50' : cashDifference > 0 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {cashDifference === 0
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    : cashDifference > 0
                      ? <TrendingUp className="w-5 h-5 text-amber-600" />
                      : <AlertTriangle className="w-5 h-5 text-red-600" />
                  }
                  <div>
                    <p className="text-sm font-semibold">Cash Difference</p>
                    <p className="text-xs text-muted-foreground">Closing − Opening</p>
                  </div>
                </div>
                <p className={`text-lg font-bold ${diffColor}`}>
                  {cashDifference >= 0 ? '+' : ''}{fmt(cashDifference)}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">Cash Movement — Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`${currency}${v.toLocaleString()}`, '']} />
                  <Bar dataKey="opening" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Opening" />
                  <Bar dataKey="closing" fill="#10b981" radius={[4, 4, 0, 0]} name="Closing" />
                  <Bar dataKey="movement" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Movement" />
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
              {todaySales.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('no_data')}</p>
              ) : (
                <div className="space-y-2">
                  {todaySales.map((s, i) => {
                    const op = Number(s.opening_cash || 0);
                    const cl = Number(s.closing_cash || 0);
                    const mv = cl - op;
                    return (
                      <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{s.branch}</p>
                          <CashStatusBadge status={s.cash_status} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <div>
                            <span className="block font-medium text-blue-600">{fmt(op)}</span>
                            <span>Opening</span>
                          </div>
                          <div>
                            <span className="block font-medium text-foreground">{fmt(cl)}</span>
                            <span>Closing</span>
                          </div>
                          <div>
                            <span className={`block font-medium ${mv >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                              {mv >= 0 ? '+' : ''}{fmt(mv)}
                            </span>
                            <span>Movement</span>
                          </div>
                        </div>
                        {s.cash_notes && (
                          <p className="text-xs text-muted-foreground italic">{s.cash_notes}</p>
                        )}
                      </div>
                    );
                  })}
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
              {!latestSale ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('no_data')}</p>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: t('opening_cash'),   value: openingCash,   color: 'text-blue-600' },
                    { label: t('closing_cash'),    value: closingCash,   color: 'text-foreground' },
                    { label: 'Cash Difference (Closing − Opening)', value: cashDifference, color: diffColor, bold: true },
                    { label: 'Cash Status',        value: cashStatus,    isStatus: true, bold: true },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-sm text-muted-foreground">{row.label}</span>
                      {row.isStatus ? (
                        <CashStatusBadge status={row.value} />
                      ) : (
                        <span className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'} ${row.color}`}>
                          {typeof row.value === 'number' ? fmt(row.value) : row.value}
                        </span>
                      )}
                    </div>
                  ))}
                  {latestSale.cash_notes && (
                    <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-medium">Notes: </span>{latestSale.cash_notes}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
