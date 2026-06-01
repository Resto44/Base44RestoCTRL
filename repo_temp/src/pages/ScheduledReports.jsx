import React, { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Mail, Clock, Loader2, Send, CheckCircle2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import UltimatePDFButton from '@/components/reports/UltimatePDFButton';
import ScheduleForm, { REPORT_TYPES } from '@/components/reports/ScheduleForm';
import { getDateRange, formatDate, formatCurrency } from '@/lib/helpers';

const FREQ_LABELS = { daily: 'daily', weekly: 'weekly', monthly: 'monthly' };
const RANGE_LABELS = { day: 'today', week: 'this_week', month: 'this_month' };

export default function ScheduledReports() {
  const { t, branches, currency } = useLanguage();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [sentId, setSentId] = useState(null);

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['scheduled_reports'],
    queryFn: () => base44.entities.ScheduledReport.list('-created_date'),
  });

  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.DailySales.list('-date', 10000) });
  const { data: purchases = [] } = useQuery({ queryKey: ['purchases'], queryFn: () => base44.entities.Purchase.list('-date', 10000) });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-date', 10000) });

  // KPI summary for current week
  const weekKPIs = useMemo(() => {
    const dr = getDateRange('week');
    const from = formatDate(dr.from);
    const to = formatDate(dr.to);
    const ws = sales.filter(s => s.date >= from && s.date <= to);
    const wp = purchases.filter(p => p.date >= from && p.date <= to);
    const we = expenses.filter(e => e.date >= from && e.date <= to);
    const rev = ws.reduce((s, x) => s + (x.cash || 0) + (x.network || 0) + (x.credit || 0), 0);
    const cost = wp.reduce((s, x) => s + ((x.used_price || x.current_price || 0) * x.qty), 0);
    const exp = we.reduce((s, x) => s + (x.amount || 0), 0);
    return { rev, cost, exp, profit: rev - cost - exp, fromStr: from, toStr: to };
  }, [sales, purchases, expenses]);

  const { fromStr, toStr } = weekKPIs;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ScheduledReport.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['scheduled_reports'] }); setShowForm(false); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.ScheduledReport.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled_reports'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduledReport.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled_reports'] }),
  });

  const handleSendNow = async (schedule) => {
    setSendingId(schedule.id);
    try {
      const dr = getDateRange(schedule.range_type || 'week');
      const from = formatDate(dr.from);
      const to = formatDate(dr.to);

      const branchLabel = schedule.branch === 'all' ? 'All Branches'
        : (branches.find(b => b.key === schedule.branch)?.label || schedule.branch);

      const filteredSales = sales.filter(s =>
        s.date >= from && s.date <= to &&
        (schedule.branch === 'all' || s.branch === schedule.branch)
      );
      const totalCash = filteredSales.reduce((s, x) => s + (x.cash || 0), 0);
      const totalNetwork = filteredSales.reduce((s, x) => s + (x.network || 0), 0);
      const totalSales = totalCash + totalNetwork;

      const filteredExpenses = expenses.filter(e =>
        e.date >= from && e.date <= to &&
        (schedule.branch === 'all' || e.branch === schedule.branch || e.branch === 'all')
      );
      const totalExpenses = filteredExpenses.reduce((s, x) => s + (x.amount || 0), 0);

      const filteredPurchases = purchases.filter(p =>
        p.date >= from && p.date <= to &&
        (schedule.branch === 'all' || p.branch === schedule.branch)
      );
      const totalPurchases = filteredPurchases.reduce((s, x) => s + ((x.used_price || x.current_price || 0) * x.qty), 0);
      const netProfit = totalSales - totalPurchases - totalExpenses;

      const reportTypeLabel = REPORT_TYPES.find(r => r.value === schedule.report_type)?.label || 'Report';
      const rangeLabel = RANGE_LABELS[schedule.range_type] || schedule.range_type;

      const emailBody = `Hello,

Here is your automated ${reportTypeLabel} for ${branchLabel} — ${rangeLabel} (${from} to ${to}):

📊 SUMMARY
──────────────────────────
Total Revenue:     ${currency}${totalSales.toFixed(2)}
  Cash:            ${currency}${totalCash.toFixed(2)}
  Network/Card:    ${currency}${totalNetwork.toFixed(2)}

Total Purchases:   ${currency}${totalPurchases.toFixed(2)}
Total Expenses:    ${currency}${totalExpenses.toFixed(2)}
Net Profit:        ${currency}${netProfit.toFixed(2)}
──────────────────────────

This report was automatically generated and sent per your scheduled report settings.

To manage your report schedule, log in to your dashboard.`;

      await base44.integrations.Core.SendEmail({
        to: schedule.email_to,
        subject: `${reportTypeLabel} — ${branchLabel} (${rangeLabel})`,
        body: emailBody,
      });

      await base44.entities.ScheduledReport.update(schedule.id, {
        last_sent: formatDate(new Date()),
      });
      queryClient.invalidateQueries({ queryKey: ['scheduled_reports'] });
      setSentId(schedule.id);
      setTimeout(() => setSentId(null), 3000);
    } finally {
      setSendingId(null);
    }
  };

  const branchLabel = (key) => key === 'all' ? t('all_branches') : (branches.find(b => b.key === key)?.label || key);

  return (
    <div>
      <PageHeader
        title={t('scheduled_reports')}
        action={
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('add')}
          </Button>
        }
      />

      {/* Live KPI snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {[
          { label: t('total_sales'), val: weekKPIs.rev, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('total_purchase_cost'), val: weekKPIs.cost, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: t('total_expenses'), val: weekKPIs.exp, icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: t('net_profit'), val: weekKPIs.profit, icon: weekKPIs.profit >= 0 ? TrendingUp : TrendingDown, color: weekKPIs.profit >= 0 ? 'text-emerald-700' : 'text-red-600', bg: weekKPIs.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
        ].map(({ label, val, icon: KpiIcon, color, bg }) => (
          <Card key={label} className={`p-3 ${bg} border-0`}>
            <KpiIcon className={`w-4 h-4 mb-1 ${color}`} />
            <p className={`text-base font-bold ${color}`}>{formatCurrency(val, currency)}</p>
            <p className="text-[10px] text-muted-foreground">{label} ({t('this_week')})</p>
          </Card>
        ))}
      </div>

      {/* Manual export */}
      <Card className="p-4 mb-4 border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-sm">{t('export_ultimate_pdf')}</h3>
            <p className="text-xs text-muted-foreground">{t('pdf_period')}: {fromStr} → {toStr}</p>
          </div>
          <UltimatePDFButton sales={sales} purchases={purchases} expenses={expenses} rangeType="week" fromStr={fromStr} toStr={toStr} />
        </div>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('scheduled_reports')}</DialogTitle></DialogHeader>
          <ScheduleForm onSave={(d) => createMutation.mutate(d)} onClose={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : schedules.length === 0 ? (
        <EmptyState message={t('no_data')} />
      ) : (
        <div className="space-y-3">
          {schedules.map(s => (
            <Card key={s.id} className={`p-4 ${!s.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.email_to}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {t(REPORT_TYPES.find(r => r.value === s.report_type)?.labelKey || 'reports')}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{branchLabel(s.branch || 'all')}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t(FREQ_LABELS[s.frequency] || 'weekly')}</Badge>
                      {s.frequency === 'weekly' && (
                        <Badge variant="outline" className="text-[10px] capitalize">{s.day_of_week}</Badge>
                      )}
                    </div>
                    {s.last_sent && (
                      <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t('last_sent')}: {s.last_sent}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    onClick={() => handleSendNow(s)}
                    disabled={sendingId === s.id}
                  >
                    {sendingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" />
                      : sentId === s.id ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      : <Send className="w-3 h-3" />}
                    {sentId === s.id ? '✓' : t('export')}
                  </Button>
                  <Switch
                    checked={!!s.is_active}
                    onCheckedChange={v => toggleMutation.mutate({ id: s.id, is_active: v })}
                  />
                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(s.id)} className="text-destructive h-8 w-8">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 rounded-xl bg-muted text-xs text-muted-foreground">
        <p className="font-medium mb-1">📅 {t('scheduled_reports')}</p>
        <p>{t('pdf_disclaimer')}</p>
      </div>
    </div>
  );
}