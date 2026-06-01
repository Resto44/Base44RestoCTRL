import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Bike } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import NetworkAccountSelect from '@/components/network/NetworkAccountSelect';

const LABELS = {
  en: {
    add_driver: 'Add Driver', driver: 'Driver', cash: 'Cash', network: 'Network',
    orders: 'Orders', notes: 'Notes', device: 'Device', no_drivers: 'No drivers yet',
    select_driver: 'Select driver', manual_name: 'Or type name',
  },
  ar: {
    add_driver: 'إضافة سائق', driver: 'السائق', cash: 'نقد', network: 'شبكة',
    orders: 'الطلبات', notes: 'ملاحظات', device: 'الجهاز', no_drivers: 'لا يوجد سائقون',
    select_driver: 'اختر سائقاً', manual_name: 'أو اكتب الاسم',
  },
  fa: {
    add_driver: 'افزودن راننده', driver: 'راننده', cash: 'نقد', network: 'شبکه',
    orders: 'سفارشات', notes: 'یادداشت', device: 'دستگاه', no_drivers: 'راننده‌ای ندارد',
    select_driver: 'انتخاب راننده', manual_name: 'یا نام بنویسید',
  },
};

function newDriver() {
  return { id: Date.now(), driver_employee_id: '', driver_name: '', cash: 0, network: 0, network_account_id: '', order_count: 0, notes: '' };
}

export default function MultiDriverForm({ branch, lang = 'en', drivers: initialDrivers = [], onChange }) {
  const lbl = LABELS[lang] || LABELS.en;
  const [entries, setEntries] = useState(initialDrivers.length > 0 ? initialDrivers : []);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees_branch', branch],
    queryFn: () => base44.entities.Employee.filter({ branch, is_active: true }),
    staleTime: 60000,
    enabled: !!branch,
  });

  const update = (id, field, value) => {
    const next = entries.map(e => e.id === id ? { ...e, [field]: value } : e);
    setEntries(next);
    onChange?.(next);
  };

  const selectDriver = (id, empId) => {
    if (empId === '__manual__') {
      update(id, 'driver_employee_id', '');
    } else {
      const emp = employees.find(e => e.id === empId);
      const next = entries.map(e => e.id === id ? { ...e, driver_employee_id: empId, driver_name: emp?.full_name || '' } : e);
      setEntries(next);
      onChange?.(next);
    }
  };

  const addDriver = () => {
    const next = [...entries, newDriver()];
    setEntries(next);
    onChange?.(next);
  };

  const removeDriver = (id) => {
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    onChange?.(next);
  };

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">{lbl.no_drivers}</p>
      )}
      {entries.map((entry, idx) => (
        <div key={entry.id} className="border border-orange-200 bg-orange-50/60 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bike className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-semibold text-orange-700">{lbl.driver} {idx + 1}</span>
            </div>
            <button type="button" onClick={() => removeDriver(entry.id)} className="text-destructive hover:opacity-70">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Driver selection */}
          <div className="grid grid-cols-1 gap-2">
            <Select value={entry.driver_employee_id || '__manual__'} onValueChange={(v) => selectDriver(entry.id, v)}>
              <SelectTrigger className="h-9 text-sm bg-white">
                <SelectValue placeholder={lbl.select_driver} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual__">{lbl.manual_name}</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!entry.driver_employee_id && (
              <Input
                value={entry.driver_name}
                onChange={e => update(entry.id, 'driver_name', e.target.value)}
                placeholder={lbl.manual_name}
                className="h-9 text-sm bg-white"
              />
            )}
          </div>

          {/* Cash / Network */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">{lbl.cash}</Label>
              <Input
                type="number" inputMode="decimal" min="0" step="0.01"
                value={entry.cash || ''}
                placeholder="0"
                onChange={e => update(entry.id, 'cash', Number(e.target.value) || 0)}
                className="h-10 text-center font-bold bg-white"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">{lbl.network}</Label>
              <Input
                type="number" inputMode="decimal" min="0" step="0.01"
                value={entry.network || ''}
                placeholder="0"
                onChange={e => update(entry.id, 'network', Number(e.target.value) || 0)}
                className="h-10 text-center font-bold bg-white"
              />
            </div>
          </div>

          {/* Device + Orders */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">{lbl.device}</Label>
              <NetworkAccountSelect
                branch={branch}
                value={entry.network_account_id}
                onChange={v => update(entry.id, 'network_account_id', v)}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">{lbl.orders}</Label>
              <Input
                type="number" inputMode="numeric" min="0"
                value={entry.order_count || ''}
                placeholder="0"
                onChange={e => update(entry.id, 'order_count', Number(e.target.value) || 0)}
                className="h-9 text-center bg-white"
              />
            </div>
          </div>

          {/* Notes */}
          <Input
            value={entry.notes}
            onChange={e => update(entry.id, 'notes', e.target.value)}
            placeholder={lbl.notes + '...'}
            className="h-8 text-xs bg-white"
          />
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addDriver} className="w-full border-dashed border-orange-300 text-orange-600 hover:bg-orange-50">
        <Plus className="w-3.5 h-3.5 mr-1" />{lbl.add_driver}
      </Button>
    </div>
  );
}