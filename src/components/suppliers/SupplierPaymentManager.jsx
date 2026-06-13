import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { formatCurrency } from '@/lib/helpers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { Truck, CreditCard, CheckCircle2, Clock, AlertCircle, Plus, Receipt, Package } from 'lucide-react';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'bg-amber-100 text-amber-700 border-amber-200',   icon: Clock },
  partial:  { label: 'Partial',  color: 'bg-blue-100 text-blue-700 border-blue-200',      icon: AlertCircle },
  settled:  { label: 'Settled',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
};

export default function SupplierPaymentManager() {
  const { currency } = useLanguage();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [payingId, setPayingId] = useState(null);
  const [payAmount, setPayAmount] = useState('');

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: invoices = [], isLoading } = useQuery({ queryKey: ['supplier_invoices'], queryFn: () => base44.entities.SupplierInvoice.list('-date', 500) });
  const { data: purchases = [] } = useQuery({ queryKey: ['purchases'], queryFn: () => base44.entities.Purchase.list('-date', 200) });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list('name', 500) });

  const emptyForm = {
    supplier_id: '',
    invoice_number: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    due_date: '',
    branch: '',
    amount: '',
    notes: '',
    status: 'pending',
    paid_amount: 0,
  };
  const [form, setForm] = useState(emptyForm);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const createMut = useMutation({
    mutationFn: d => base44.entities.SupplierInvoice.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['supplier_invoices'] }); setShowCreate(false); setForm(emptyForm); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SupplierInvoice.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['supplier_invoices'] }); setPayingId(null); setPayAmount(''); },
  });

  // Compute: link recent purchases to invoices by supplier
  const recentPurchaseSummary = useMemo(() => {
    const map = {};
    purchases.slice(0, 100).forEach(p => {
      if (!p.product_name) return;
      const key = p.branch || 'all';
      if (!map[key]) map[key] = { total: 0, items: [] };
      const cost = (p.qty || 0) * (p.used_price || p.current_price || 0);
      map[key].total += cost;
      map[key].items.push(p);
    });
    return map;
  }, [purchases]);

  const filtered = useMemo(() =>
    invoices.filter(inv => filterStatus === 'all' || inv.status === filterStatus),
    [invoices, filterStatus]
  );

  const totals = useMemo(() => ({
    pending: invoices.filter(i => i.status === 'pending').reduce((s, i) => s + (i.amount || 0), 0),
    partial: invoices.filter(i => i.status === 'partial').reduce((s, i) => s + ((i.amount || 0) - (i.paid_amount || 0)), 0),
    settled: invoices.filter(i => i.status === 'settled').reduce((s, i) => s + (i.amount || 0), 0),
  }), [invoices]);

  const handlePay = (inv) => {
    const paid = parseFloat(payAmount) || 0;
    const newPaid = (inv.paid_amount || 0) + paid;
    const newStatus = newPaid >= inv.amount ? 'settled' : newPaid > 0 ? 'partial' : 'pending';
    updateMut.mutate({ id: inv.id, data: { paid_amount: newPaid, status: newStatus } });
  };

  const fmt = v => formatCurrency(v, currency);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'pending', label: 'Pending AP', value: totals.pending, color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { key: 'partial', label: 'Remaining (Partial)', value: totals.partial, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { key: 'settled', label: 'Settled (Total)', value: totals.settled, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
        ].map(c => (
          <Card key={c.key} className={`p-3 border ${c.color}`}>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-sm font-bold mt-0.5">{fmt(c.value)}</p>
          </Card>
        ))}
      </div>

      {/* Recent purchase activity → link to AP */}
      {Object.keys(recentPurchaseSummary).length > 0 && (
        <Card className="p-3 border-dashed border-2 border-amber-300 bg-amber-50/40">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Recent Inventory Purchases (Unlinked)</p>
          </div>
          <div className="space-y-1">
            {Object.entries(recentPurchaseSummary).slice(0, 3).map(([branch, { total, items }]) => (
              <div key={branch} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{branch} branch — {items.length} items</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-700">{fmt(total)}</span>
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => {
                    setForm(f => ({ ...f, amount: total.toFixed(2), branch, notes: `Auto-linked from ${items.length} purchases` }));
                    setShowCreate(true);
                  }}>
                    <Plus className="w-3 h-3 mr-1" /> Create Invoice
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter + Add */}
      <div className="flex items-center gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { setForm(emptyForm); setShowCreate(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> New Invoice
        </Button>
      </div>

      {/* Invoice List */}
      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No supplier invoices yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => {
            const supplier = suppliers.find(s => s.id === inv.supplier_id);
            const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const remaining = (inv.amount || 0) - (inv.paid_amount || 0);
            const paidPct = inv.amount > 0 ? Math.min(100, ((inv.paid_amount || 0) / inv.amount) * 100) : 0;
            return (
              <Card key={inv.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{supplier?.name || inv.supplier_name || 'Unknown Supplier'}</p>
                        <Badge className={`text-xs border ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {inv.invoice_number && `#${inv.invoice_number} · `}{inv.date}{inv.due_date && ` · Due: ${inv.due_date}`}
                      </p>
                      {inv.notes && <p className="text-xs text-muted-foreground truncate">{inv.notes}</p>}
                      {/* Payment progress bar */}
                      {inv.amount > 0 && (
                        <div className="mt-2">
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
                          </div>
                          <div className="flex justify-between mt-0.5">
                            <span className="text-xs text-emerald-600">{fmt(inv.paid_amount || 0)} paid</span>
                            <span className="text-xs text-red-500">{fmt(remaining)} left</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{fmt(inv.amount)}</p>
                    {inv.status !== 'settled' && (
                      <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" onClick={() => { setPayingId(inv.id); setPayAmount(''); }}>
                        <CreditCard className="w-3 h-3 mr-1" /> Pay
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Supplier Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={v => {
                const s = suppliers.find(s => s.id === v);
                set('supplier_id', v);
                if (s) set('supplier_name', s.name);
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select supplier..." /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Invoice #</Label><Input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="INV-001" /></div>
              <div><Label className="text-xs">Amount *</Label><Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Date *</Label><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
              <div><Label className="text-xs">Due Date</Label><Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={() => {
                const supplierId = form.supplier_id && form.supplier_id.trim() !== '' ? form.supplier_id : null;
                const payload = { ...form, amount: parseFloat(form.amount) || 0 };
                if (!supplierId) delete payload.supplier_id; else payload.supplier_id = supplierId;
                createMut.mutate(payload);
              }} disabled={createMut.isPending || !form.supplier_id || !form.amount}>Save</Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={!!payingId} onOpenChange={() => setPayingId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          {payingId && (() => {
            const inv = invoices.find(i => i.id === payingId);
            if (!inv) return null;
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Outstanding: <span className="font-bold text-foreground">{fmt((inv.amount || 0) - (inv.paid_amount || 0))}</span></p>
                <div>
                  <Label className="text-xs">Payment Amount</Label>
                  <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" autoFocus />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => handlePay(inv)} disabled={updateMut.isPending || !payAmount}>Confirm</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setPayingId(null)}>Cancel</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}