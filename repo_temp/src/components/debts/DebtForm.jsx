import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { useDebtI18n } from '@/lib/debtI18n';
import { format } from 'date-fns';

export default function DebtForm({ initial = {}, onSave, onCancel }) {
  const { branches } = useLanguage();
  const d = useDebtI18n();

  const partyTypes = [
    { value: 'customer', label: d.party_customer },
    { value: 'company', label: d.party_company },
    { value: 'supplier', label: d.party_supplier },
    { value: 'loan', label: d.party_loan },
    { value: 'branch', label: d.party_branch },
    { value: 'owner_personal', label: d.party_owner_personal },
  ];

  const [form, setForm] = useState({
    type: 'receivable',
    party_type: 'customer',
    party_name: '',
    party_phone: '',
    branch: '',
    invoice_number: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    due_date: '',
    total_amount: '',
    description: '',
    notes: '',
    interest_rate: '',
    installment_amount: '',
    installment_frequency: 'monthly',
    ...initial,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const total = parseFloat(form.total_amount) || 0;
    const paid = parseFloat(form.paid_amount) || 0;
    const data = {
      ...form,
      total_amount: total,
      paid_amount: paid,
      remaining_amount: total - paid,
      interest_rate: parseFloat(form.interest_rate) || 0,
      installment_amount: parseFloat(form.installment_amount) || 0,
      status: paid >= total ? 'paid' : paid > 0 ? 'partial' : 'open',
    };
    if (initial.id) {
      await base44.entities.DebtRecord.update(initial.id, data);
    } else {
      await base44.entities.DebtRecord.create(data);
    }
    setSaving(false);
    onSave();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      {/* Type + Party Type */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{d.type_label}</Label>
          <Select value={form.type} onValueChange={v => set('type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="receivable">{d.type_receivable}</SelectItem>
              <SelectItem value="liability">{d.type_liability}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{d.party_label}</Label>
          <Select value={form.party_type} onValueChange={v => set('party_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {partyTypes.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Name + Phone */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{d.name_label}</Label>
          <Input required value={form.party_name} onChange={e => set('party_name', e.target.value)} placeholder={d.name_placeholder} />
        </div>
        <div className="space-y-1">
          <Label>{d.phone_label}</Label>
          <Input value={form.party_phone} onChange={e => set('party_phone', e.target.value)} placeholder="05xxxxxxxx" />
        </div>
      </div>

      {/* Branch + Invoice */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{d.branch_label}</Label>
          <Select value={form.branch} onValueChange={v => set('branch', v)}>
            <SelectTrigger><SelectValue placeholder={d.choose_branch} /></SelectTrigger>
            <SelectContent>
              {branches.map(b => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{d.invoice_label}</Label>
          <Input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="INV-001" />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{d.debt_date}</Label>
          <Input type="date" required value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{d.due_date}</Label>
          <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </div>
      </div>

      {/* Amount */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{d.total_amount}</Label>
          <Input required type="number" min="0" step="0.01" value={form.total_amount} onChange={e => set('total_amount', e.target.value)} placeholder="0.00" />
        </div>
        <div className="space-y-1">
          <Label>{d.paid_so_far}</Label>
          <Input type="number" min="0" step="0.01" value={form.paid_amount || ''} onChange={e => set('paid_amount', e.target.value)} placeholder="0.00" />
        </div>
      </div>

      {/* Loan fields */}
      {form.party_type === 'loan' && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <div className="space-y-1">
            <Label>{d.monthly_installment}</Label>
            <Input type="number" min="0" value={form.installment_amount} onChange={e => set('installment_amount', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{d.interest_pct}</Label>
            <Input type="number" min="0" step="0.1" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} />
          </div>
        </div>
      )}

      {/* Description + Notes */}
      <div className="space-y-1">
        <Label>{d.description}</Label>
        <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder={d.description_placeholder} />
      </div>
      <div className="space-y-1">
        <Label>{d.notes}</Label>
        <Textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={d.notes_placeholder} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? d.saving : (initial.id ? d.update : d.add)}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>{d.cancel}</Button>
      </div>
    </form>
  );
}