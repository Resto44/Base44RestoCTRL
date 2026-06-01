import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BranchSelect from '@/components/shared/BranchSelect';
import { useLanguage } from '@/lib/LanguageContext';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

export const REPORT_TYPES = [
  { value: 'sales',    labelKey: 'daily_sales' },
  { value: 'pl',       labelKey: 'profit_loss' },
  { value: 'cashflow', labelKey: 'cashflow' },
  { value: 'full',     labelKey: 'reports' },
];

export default function ScheduleForm({ onSave, onClose }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: '',
    report_type: 'full',
    branch: 'all',
    frequency: 'weekly',
    day_of_week: 'monday',
    email_to: '',
    range_type: 'week',
    include_inventory: true,
    include_suppliers: true,
    is_active: true,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.name && form.email_to;

  return (
    <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
      <div>
        <Label className="text-xs">{t('name')}</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)}
          placeholder={t('name') + ' — e.g. Weekly P&L'} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">{t('type')}</Label>
          <Select value={form.report_type} onValueChange={v => set('report_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{t(r.labelKey)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t('branch')}</Label>
          <BranchSelect value={form.branch} onChange={v => set('branch', v)} includeAll />
        </div>
      </div>

      <div>
        <Label className="text-xs">{t('email')}</Label>
        <Input type="email" value={form.email_to} onChange={e => set('email_to', e.target.value)}
          placeholder="manager@example.com" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">{t('frequency')}</Label>
          <Select value={form.frequency} onValueChange={v => set('frequency', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{t('daily')}</SelectItem>
              <SelectItem value="weekly">{t('weekly')}</SelectItem>
              <SelectItem value="monthly">{t('monthly')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t('date_range')}</Label>
          <Select value={form.range_type} onValueChange={v => set('range_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t('today')}</SelectItem>
              <SelectItem value="week">{t('this_week')}</SelectItem>
              <SelectItem value="month">{t('this_month')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.frequency === 'weekly' && (
        <div>
          <Label className="text-xs">Send Day</Label>
          <Select value={form.day_of_week} onValueChange={v => set('day_of_week', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DAYS.map(d => <SelectItem key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch checked={form.include_inventory} onCheckedChange={v => set('include_inventory', v)} />
          {t('inventory')}
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch checked={form.include_suppliers} onCheckedChange={v => set('include_suppliers', v)} />
          {t('suppliers')}
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave(form)} disabled={!valid} className="flex-1">{t('save')}</Button>
        <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
      </div>
    </div>
  );
}