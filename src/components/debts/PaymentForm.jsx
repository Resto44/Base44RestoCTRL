import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { useDebtI18n } from '@/lib/debtI18n';
import { useNotify } from '@/lib/useNotify';

export default function PaymentForm({ debt, onSave, onCancel }) {
  const notif = useNotify();
  const { user } = useAuth();
  const d = useDebtI18n();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const remaining = (debt.remaining_amount ?? debt.total_amount - (debt.paid_amount || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    setSaving(true);

    await base44.entities.DebtPayment.create({
      debt_id: debt.id,
      party_name: debt.party_name,
      date,
      amount: amt,
      payment_method: method,
      notes,
      recorded_by: user?.email,
      recorded_by_name: user?.full_name,
    });

    const newPaid = (debt.paid_amount || 0) + amt;
    const newRemaining = debt.total_amount - newPaid;
    const newStatus = newRemaining <= 0 ? 'paid' : 'partial';
    await base44.entities.DebtRecord.update(debt.id, {
      paid_amount: newPaid,
      remaining_amount: Math.max(0, newRemaining),
      status: newStatus,
    });

    await notif.creditCollection({ 
      branch: debt.branch || 'General', 
      amount: amt, 
      action: 'create' 
    });

    setSaving(false);
    onSave();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{d.total_debt}</span>
          <span className="font-bold">{debt.total_amount?.toLocaleString()} {d.currency}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{d.amount_paid_label}</span>
          <span className="font-medium text-green-600">{(debt.paid_amount || 0)?.toLocaleString()} {d.currency}</span>
        </div>
        <div className="flex justify-between border-t pt-1">
          <span className="font-semibold">{d.remaining}</span>
          <span className="font-bold text-red-600">{remaining?.toLocaleString()} {d.currency}</span>
        </div>
      </div>

      <div className="space-y-1">
        <Label>{d.payment_amount}</Label>
        <Input required type="number" min="0.01" max={remaining} step="0.01"
          value={amount} onChange={e => setAmount(e.target.value)}
          placeholder={d.max_placeholder(remaining?.toLocaleString())} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{d.payment_method}</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">{d.method_cash}</SelectItem>
              <SelectItem value="network">{d.method_network}</SelectItem>
              <SelectItem value="bank_transfer">{d.method_bank}</SelectItem>
              <SelectItem value="cheque">{d.method_cheque}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{d.date}</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>{d.notes}</Label>
        <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">
          {saving ? d.recording : d.submit_payment}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>{d.cancel}</Button>
      </div>
    </form>
  );
}