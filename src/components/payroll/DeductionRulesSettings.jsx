import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Settings2 } from 'lucide-react';

const RULE_TYPES = { late: 'Late Arrival', absent: 'Absence', half_day: 'Half Day' };
const DED_TYPES = { fixed: 'Fixed Amount', daily_fraction: 'Fraction of Daily Salary' };

const emptyRule = { name: '', type: 'late', deduction_type: 'fixed', amount: '', fraction: '1', late_threshold_minutes: 15, is_active: true };

export default function DeductionRulesSettings() {
  const { currency } = useLanguage();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyRule);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: rules = [] } = useQuery({
    queryKey: ['deduction_rules'],
    queryFn: () => base44.entities.DeductionRule.list(),
  });

  const createMut = useMutation({
    mutationFn: d => base44.entities.DeductionRule.create(d),
    onSuccess: (result) => { 
      console.log('DEDUCTION SUCCESS', result);
      qc.invalidateQueries({ queryKey: ['deduction_rules'] }); 
      setShowForm(false); 
      setForm(emptyRule); 
    },
    onError: (error) => { 
      console.error('DEDUCTION ERROR', error);
      console.error('INSERT FAILED', error); 
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.DeductionRule.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deduction_rules'] }),
  });

  const deleteMut = useMutation({
    mutationFn: id => base44.entities.DeductionRule.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deduction_rules'] }),
  });

  const handleSave = () => {
    if (!form.name || !form.type) return;
    const payload = {
      ...form,
      rule_name: form.name,
      applies_to: form.type,
      deduction_type: form.deduction_type,
      amount: Number(form.amount) || 0,
      late_threshold: Number(form.late_threshold_minutes) || 15,
    };
    delete payload.name;
    delete payload.type;
    delete payload.fraction;
    delete payload.late_threshold_minutes;
    
    console.log('DEDUCTION PAYLOAD', payload);
    createMut.mutate(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Deduction Rules</h3>
          <p className="text-xs text-muted-foreground">Configure how absences, late arrivals, and half-days affect salary</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add Rule</Button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Settings2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No deduction rules configured</p>
          <p className="text-xs">Add rules to auto-calculate deductions in payroll</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(r => (
            <Card key={r.id} className={`p-3 ${!r.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {RULE_TYPES[r.type]} →{' '}
                    {r.deduction_type === 'fixed'
                      ? `${currency}${r.amount} per occurrence`
                      : `${(r.fraction * 100).toFixed(0)}% of daily salary`}
                    {r.type === 'late' && ` (threshold: ${r.late_threshold_minutes || 15} min)`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch checked={!!r.is_active} onCheckedChange={v => toggleMut.mutate({ id: r.id, is_active: v })} />
                  <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => deleteMut.mutate(r.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-3 bg-muted/40 text-xs text-muted-foreground space-y-1">
        <p className="font-medium">How deductions work:</p>
        <p>• <strong>Fixed amount</strong>: deducts a flat amount per each occurrence (e.g. SAR 50 per absence)</p>
        <p>• <strong>Daily fraction</strong>: deducts a fraction of the daily salary (base ÷ 26 working days) per occurrence</p>
        <p>• Late rules only apply when the employee's attendance status is "Late"</p>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Deduction Rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Rule Name</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Absence Deduction" /></div>
            <div>
              <Label className="text-xs">Applies To</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(RULE_TYPES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Deduction Type</Label>
              <Select value={form.deduction_type} onValueChange={v => set('deduction_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DED_TYPES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.deduction_type === 'fixed' ? (
              <div><Label className="text-xs">Amount ({currency})</Label><Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
            ) : (
              <div><Label className="text-xs">Fraction (e.g. 1 = full day, 0.5 = half)</Label><Input type="number" step="0.1" max="1" value={form.fraction} onChange={e => set('fraction', e.target.value)} /></div>
            )}
            {form.type === 'late' && (
              <div><Label className="text-xs">Late Threshold (minutes)</Label><Input type="number" value={form.late_threshold_minutes} onChange={e => set('late_threshold_minutes', e.target.value)} /></div>
            )}
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleSave} disabled={createMut.isPending}>Save Rule</Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}