import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { isPast, parseISO } from 'date-fns';
import DebtCard from '@/components/debts/DebtCard';
import DebtForm from '@/components/debts/DebtForm';
import PaymentForm from '@/components/debts/PaymentForm';
import DebtDetailSheet from '@/components/debts/DebtDetailSheet';
import DebtDashboard from '@/components/debts/DebtDashboard';
import LiquidityForecast from '@/components/debts/LiquidityForecast';
import ReminderSettings from '@/components/debts/ReminderSettings';
import { useRole } from '@/lib/RoleContext';
import { useTenant } from '@/lib/TenantContext';
import { useDebtI18n } from '@/lib/debtI18n';
import { useLanguage } from '@/lib/LanguageContext';

export default function DebtManagement() {
  const { role } = useRole();
  const tenant = useTenant();
  const qc = useQueryClient();
  const d = useDebtI18n();
  const { currency } = useLanguage();

  const [tab, setTab] = useState('dashboard');
  const [typeFilter, setTypeFilter] = useState('all');
  const [partyFilter, setPartyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [payingDebt, setPayingDebt] = useState(null);
  const [viewingDebt, setViewingDebt] = useState(null);

  const { ownerFilter } = tenant;

  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['debts', ownerFilter],
    queryFn: () => base44.entities.DebtRecord.filter(ownerFilter || {}, '-date', 200),
    enabled: !!ownerFilter?.created_by,
  });

  const userBranch = tenant?.currentBranch;
  const filteredByRole = useMemo(() => {
    if (role === 'manager' && userBranch) {
      return debts.filter(d => !d.branch || d.branch === userBranch);
    }
    return debts;
  }, [debts, role, userBranch]);

  const filtered = useMemo(() => {
    return filteredByRole.filter(debt => {
      if (typeFilter !== 'all' && debt.type !== typeFilter) return false;
      if (partyFilter !== 'all' && debt.party_type !== partyFilter) return false;
      if (statusFilter === 'open' && !['open', 'partial'].includes(debt.status)) return false;
      if (statusFilter === 'overdue' && !(debt.status !== 'paid' && debt.due_date && isPast(parseISO(debt.due_date)))) return false;
      if (statusFilter === 'paid' && debt.status !== 'paid') return false;
      if (search && !debt.party_name?.toLowerCase().includes(search.toLowerCase()) &&
          !debt.description?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [filteredByRole, typeFilter, partyFilter, statusFilter, search]);

  const receivableTotal = useMemo(() =>
    filteredByRole.filter(d => d.type === 'receivable' && d.status !== 'paid')
      .reduce((s, d) => s + (d.remaining_amount || 0), 0), [filteredByRole]);

  const liabilityTotal = useMemo(() =>
    filteredByRole.filter(d => d.type === 'liability' && d.status !== 'paid')
      .reduce((s, d) => s + (d.remaining_amount || 0), 0), [filteredByRole]);

  const overdueCount = useMemo(() =>
    filteredByRole.filter(d => d.status !== 'paid' && d.due_date && isPast(parseISO(d.due_date))).length,
    [filteredByRole]);

  const handleSaved = () => {
    setShowForm(false);
    setEditingDebt(null);
    qc.invalidateQueries({ queryKey: ['debts'] });
  };

  const handlePaymentSaved = () => {
    setPayingDebt(null);
    qc.invalidateQueries({ queryKey: ['debts'] });
  };

  const partyOptions = [
    { value: 'customer', label: d.party_customer },
    { value: 'company', label: d.party_company },
    { value: 'supplier', label: d.party_supplier },
    { value: 'loan', label: d.party_loan },
    { value: 'branch', label: d.party_branch },
    { value: 'owner_personal', label: d.party_owner_personal },
  ];

  const remainingTotal = filtered.reduce((s, debt) => s + (debt.remaining_amount || 0), 0);

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{d.title}</h1>
          <p className="text-xs text-muted-foreground">{d.subtitle}</p>
        </div>
        <Button size="sm" onClick={() => { setEditingDebt(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> {d.add}
        </Button>
      </div>

      {/* Quick KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => { setTypeFilter('receivable'); setTab('list'); setStatusFilter('open'); }}
          className="bg-green-50 border border-green-200 rounded-xl p-3 text-center transition hover:bg-green-100"
        >
          <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
          <div className="text-sm font-bold text-green-700">{receivableTotal.toLocaleString()}</div>
          <div className="text-[10px] text-green-600">{d.owed_to_us}</div>
        </button>
        <button
          onClick={() => { setTypeFilter('liability'); setTab('list'); setStatusFilter('open'); }}
          className="bg-red-50 border border-red-200 rounded-xl p-3 text-center transition hover:bg-red-100"
        >
          <TrendingDown className="w-4 h-4 text-red-600 mx-auto mb-1" />
          <div className="text-sm font-bold text-red-700">{liabilityTotal.toLocaleString()}</div>
          <div className="text-[10px] text-red-600">{d.we_owe}</div>
        </button>
        <button
          onClick={() => { setTab('list'); setStatusFilter('overdue'); setTypeFilter('all'); }}
          className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center transition hover:bg-amber-100"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 mx-auto mb-1" />
          <div className="text-sm font-bold text-amber-700">{overdueCount}</div>
          <div className="text-[10px] text-amber-600">{d.overdue}</div>
        </button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="dashboard" className="text-xs">{d.tab_dashboard}</TabsTrigger>
          <TabsTrigger value="list" className="text-xs">{d.tab_list}</TabsTrigger>
          <TabsTrigger value="forecast" className="text-xs">{d.tab_forecast}</TabsTrigger>
          <TabsTrigger value="reminders" className="text-xs">{d.tab_reminders}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <DebtDashboard debts={filteredByRole} />
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 text-sm"
                placeholder={d.search_placeholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={d.filter_type} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{d.all}</SelectItem>
                  <SelectItem value="receivable">{d.type_receivable}</SelectItem>
                  <SelectItem value="liability">{d.type_liability}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={partyFilter} onValueChange={setPartyFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={d.filter_party} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{d.all}</SelectItem>
                  {partyOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={d.filter_status} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">{d.status_open}</SelectItem>
                  <SelectItem value="overdue">{d.status_overdue}</SelectItem>
                  <SelectItem value="paid">{d.status_paid}</SelectItem>
                  <SelectItem value="all_statuses">{d.status_all}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">
              {d.records_count(filtered.length, remainingTotal.toLocaleString())}
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-2">💳</div>
              <div className="text-sm">{d.no_records}</div>
              <Button size="sm" className="mt-3" onClick={() => { setEditingDebt(null); setShowForm(true); }}>
                <Plus className="w-4 h-4 mr-1" /> {d.add_first}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(debt => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  onPay={setPayingDebt}
                  onView={setViewingDebt}
                  onEdit={d => { setEditingDebt(d); setShowForm(true); }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <LiquidityForecast debts={filteredByRole} />
          )}
        </TabsContent>

        <TabsContent value="reminders" className="mt-4">
          <ReminderSettings
            debts={filteredByRole}
            onLogAction={() => qc.invalidateQueries({ queryKey: ['debts'] })}
          />
        </TabsContent>
      </Tabs>

      {/* Add / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditingDebt(null); } }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDebt ? d.edit_record : d.add_record}</DialogTitle>
          </DialogHeader>
          <DebtForm
            initial={editingDebt || {}}
            onSave={handleSaved}
            onCancel={() => { setShowForm(false); setEditingDebt(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={!!payingDebt} onOpenChange={v => { if (!v) setPayingDebt(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{d.payment_title(payingDebt?.party_name || '')}</DialogTitle>
          </DialogHeader>
          {payingDebt && (
            <PaymentForm
              debt={payingDebt}
              onSave={handlePaymentSaved}
              onCancel={() => setPayingDebt(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <DebtDetailSheet
        debt={viewingDebt}
        open={!!viewingDebt}
        onClose={() => setViewingDebt(null)}
        onUpdated={() => qc.invalidateQueries({ queryKey: ['debts'] })}
      />
    </div>
  );
}