import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { useRole } from '@/lib/RoleContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import { getDateRange, formatDate, formatCurrency } from '@/lib/helpers';
import { computeRunningCashflow } from '@/lib/cashflowEngine';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, CreditCard } from 'lucide-react';

const RANGES = ['week', 'month', 'year'];

const ui = {
  en: {
    title: 'Running Cash Flow', week: 'Week', month: 'Month', year: 'Year',
    allBranches: 'All Branches', openingCash: 'Opening Cash', closingCash: 'Closing Cash',
    openingNetwork: 'Opening Network', closingNetwork: 'Closing Network',
    totalIn: 'Total Inflows', totalOut: 'Total Outflows', netFlow: 'Net Flow',
    cashTrend: 'Cash Balance Trend', networkTrend: 'Network Balance Trend',
    date: 'Date', openBal: 'Open', inflow: 'In', outflow: 'Out', closeBal: 'Close',
    cashCol: 'Cash', networkCol: 'Network', noData: 'No transactions in this period.',
    statement: 'Cash Flow Statement',
  },
  ar: {
    title: 'التدفق النقدي الجاري', week: 'أسبوع', month: 'شهر', year: 'سنة',
    allBranches: 'جميع الفروع', openingCash: 'رصيد النقد الافتتاحي', closingCash: 'رصيد النقد الختامي',
    openingNetwork: 'رصيد الشبكة الافتتاحي', closingNetwork: 'رصيد الشبكة الختامي',
    totalIn: 'إجمالي الواردات', totalOut: 'إجمالي المدفوعات', netFlow: 'صافي التدفق',
    cashTrend: 'اتجاه رصيد النقد', networkTrend: 'اتجاه رصيد الشبكة',
    date: 'التاريخ', openBal: 'افتتاحي', inflow: 'وارد', outflow: 'صادر', closeBal: 'ختامي',
    cashCol: 'نقد', networkCol: 'شبكة', noData: 'لا توجد معاملات في هذه الفترة.',
    statement: 'بيان التدفق النقدي',
  },
  fa: {
    title: 'جریان نقدی جاری', week: 'هفته', month: 'ماه', year: 'سال',
    allBranches: 'همه فروع', openingCash: 'موجودی ابتدای نقد', closingCash: 'موجودی پایان نقد',
    openingNetwork: 'موجودی ابتدای شبکه', closingNetwork: 'موجودی پایان شبکه',
    totalIn: 'کل دریافتی‌ها', totalOut: 'کل پرداختی‌ها', netFlow: 'جریان خالص',
    cashTrend: 'روند موجودی نقد', networkTrend: 'روند موجودی شبکه',
    date: 'تاریخ', openBal: 'ابتدا', inflow: 'دریافتی', outflow: 'پرداختی', closeBal: 'پایان',
    cashCol: 'نقد', networkCol: 'شبکه', noData: 'هیچ تراکنشی در این دوره وجود ندارد.',
    statement: 'صورت جریان نقدی',
  },
};

function SummaryCard({ label, value, currency, color, isCash }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1">
        {isCash
          ? <Wallet className={`w-4 h-4 ${color}`} />
          : <CreditCard className={`w-4 h-4 ${color}`} />
        }
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={`text-xl font-bold ${color}`}>{formatCurrency(value, currency)}</p>
    </Card>
  );
}

export default function CashFlow() {
  const { lang, currency } = useLanguage();
  const { branches } = useTenant();
  const { role, user } = useRole();
  const m = ui[lang] || ui.en;
  const [rangeType, setRangeType] = useState('month');
  const [selectedBranch, setSelectedBranch] = useState('all');

  // Branch managers can only see their branch
  const branchKey = useMemo(() => {
    if (role === 'owner') return selectedBranch === 'all' ? null : selectedBranch;
    // For managers, restrict to their branch if set
    return user?.branch || selectedBranch === 'all' ? null : selectedBranch;
  }, [role, user, selectedBranch]);

  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.DailySales.list('-date', 10000) });
  const { data: purchases = [] } = useQuery({ queryKey: ['purchases'], queryFn: () => base44.entities.Purchase.list('-date', 10000) });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-date', 10000) });
  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: () => base44.entities.CreditCollection.list('-date', 10000) });

  const dateRange = useMemo(() => getDateRange(rangeType), [rangeType]);
  const fromStr = formatDate(dateRange.from);
  const toStr = formatDate(dateRange.to);

  const { rows, summary } = useMemo(() => computeRunningCashflow({
    sales, purchases, expenses, collections,
    branch: branchKey,
    fromStr, toStr,
  }), [sales, purchases, expenses, collections, branchKey, fromStr, toStr]);

  const chartData = rows.map(r => ({
    date: r.date.slice(5),
    cash: r.closeCash,
    network: r.closeNetwork,
  }));

  const exportCSV = () => {
    const headers = ['Date', 'Open Cash', 'Cash In', 'Cash Out', 'Close Cash', 'Open Network', 'Network In', 'Network Out', 'Close Network'];
    const csvRows = rows.map(r => [
      r.date, r.openCash.toFixed(0), (r.cashIn + r.collCash).toFixed(0), (r.cashExpOut + r.cashPurchOut).toFixed(0), r.closeCash.toFixed(0),
      r.openNetwork.toFixed(0), (r.networkIn + r.collNetwork).toFixed(0), (r.networkExpOut + r.networkPurchOut).toFixed(0), r.closeNetwork.toFixed(0),
    ]);
    const csv = [headers, ...csvRows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cashflow_${fromStr}_${toStr}.csv`; a.click();
  };

  return (
    <div>
      <PageHeader
        title={m.title}
        action={
          <Button size="sm" variant="outline" onClick={exportCSV}>
            CSV ↓
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {RANGES.map(r => (
          <Button key={r} size="sm" variant={rangeType === r ? 'default' : 'outline'} onClick={() => setRangeType(r)}>
            {m[r]}
          </Button>
        ))}
        {role === 'owner' && branches.length > 0 && (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{m.allBranches}</SelectItem>
              {branches.map(b => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryCard label={m.openingCash} value={summary.openingCash} currency={currency} isCash color="text-muted-foreground" />
        <SummaryCard label={m.closingCash} value={summary.closingCash} currency={currency} isCash color={summary.closingCash >= 0 ? 'text-emerald-600' : 'text-red-500'} />
        <SummaryCard label={m.openingNetwork} value={summary.openingNetwork} currency={currency} isCash={false} color="text-muted-foreground" />
        <SummaryCard label={m.closingNetwork} value={summary.closingNetwork} currency={currency} isCash={false} color={summary.closingNetwork >= 0 ? 'text-blue-600' : 'text-red-500'} />
      </div>

      {/* Inflow/Outflow summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Card className="p-4 bg-emerald-50 dark:bg-emerald-900/20">
          <p className="text-xs text-muted-foreground">{m.totalIn} ({m.cashCol})</p>
          <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.totalCashIn, currency)}</p>
        </Card>
        <Card className="p-4 bg-red-50 dark:bg-red-900/20">
          <p className="text-xs text-muted-foreground">{m.totalOut} ({m.cashCol})</p>
          <p className="text-lg font-bold text-red-500">{formatCurrency(summary.totalCashOut, currency)}</p>
        </Card>
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20">
          <p className="text-xs text-muted-foreground">{m.totalIn} ({m.networkCol})</p>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(summary.totalNetworkIn, currency)}</p>
        </Card>
        <Card className="p-4 bg-orange-50 dark:bg-orange-900/20">
          <p className="text-xs text-muted-foreground">{m.totalOut} ({m.networkCol})</p>
          <p className="text-lg font-bold text-orange-500">{formatCurrency(summary.totalNetworkOut, currency)}</p>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <Card className="p-4 mb-5">
          <h3 className="text-sm font-semibold mb-3">{m.cashTrend} & {m.networkTrend}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => formatCurrency(v, currency)} />
              <Legend />
              <Area type="monotone" dataKey="cash" stroke="#10b981" fill="url(#cashGrad)" name={m.cashCol} strokeWidth={2} />
              <Area type="monotone" dataKey="network" stroke="#2563eb" fill="url(#netGrad)" name={m.networkCol} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      ) : (
        <Card className="p-8 text-center text-muted-foreground mb-5">{m.noData}</Card>
      )}

      {/* Daily Statement Table */}
      {rows.length > 0 && (
        <Card className="p-4 mb-5">
          <h3 className="text-sm font-semibold mb-3">{m.statement}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="pb-2 font-semibold">{m.date}</th>
                  <th className="pb-2 text-end font-semibold">{m.openBal} ({m.cashCol})</th>
                  <th className="pb-2 text-end font-semibold text-emerald-600">{m.inflow} ({m.cashCol})</th>
                  <th className="pb-2 text-end font-semibold text-red-500">{m.outflow} ({m.cashCol})</th>
                  <th className="pb-2 text-end font-semibold">{m.closeBal} ({m.cashCol})</th>
                  <th className="pb-2 text-end font-semibold">{m.closeBal} ({m.networkCol})</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="py-2">{r.date}</td>
                    <td className="py-2 text-end text-muted-foreground">{formatCurrency(r.openCash, currency)}</td>
                    <td className="py-2 text-end text-emerald-600">+{formatCurrency(r.cashIn + r.collCash, currency)}</td>
                    <td className="py-2 text-end text-red-500">({formatCurrency(r.cashExpOut + r.cashPurchOut, currency)})</td>
                    <td className={`py-2 text-end font-semibold ${r.closeCash >= 0 ? 'text-foreground' : 'text-red-500'}`}>{formatCurrency(r.closeCash, currency)}</td>
                    <td className={`py-2 text-end font-semibold ${r.closeNetwork >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCurrency(r.closeNetwork, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}