import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Filter } from 'lucide-react';
import { useTenant } from '@/lib/TenantContext';
import { format, subDays, startOfMonth } from 'date-fns';

export default function SalesFilterSidebar({ filters, onChange, onClose }) {
  const { branches, isManager } = useTenant();

  const presets = [
    { label: 'Today', from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') },
    { label: 'Last 7 days', from: format(subDays(new Date(), 6), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') },
    { label: 'This month', from: format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') },
    { label: 'Last 30 days', from: format(subDays(new Date(), 29), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') },
  ];

  const handleReset = () => {
    onChange({ branch: 'all', from: '', to: '', minTotal: '', maxTotal: '' });
  };

  return (
    <Card className="p-4 space-y-5 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Filters</span>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Branch */}
      <div className="space-y-1.5">
        <Label className="text-xs">Branch</Label>
        <Select value={filters.branch} onValueChange={(v) => onChange({ ...filters, branch: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All branches" />
          </SelectTrigger>
          <SelectContent>
            {!isManager && <SelectItem value="all">All Branches</SelectItem>}
            {branches.map(b => (
              <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date presets */}
      <div className="space-y-1.5">
        <Label className="text-xs">Quick Date Range</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map(p => (
            <Button
              key={p.label}
              size="sm"
              variant={filters.from === p.from && filters.to === p.to ? 'default' : 'outline'}
              className="text-xs h-7 px-2"
              onClick={() => onChange({ ...filters, from: p.from, to: p.to })}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      <div className="space-y-1.5">
        <Label className="text-xs">Custom From</Label>
        <Input
          type="date"
          className="h-8 text-xs"
          value={filters.from}
          onChange={e => onChange({ ...filters, from: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Custom To</Label>
        <Input
          type="date"
          className="h-8 text-xs"
          value={filters.to}
          onChange={e => onChange({ ...filters, to: e.target.value })}
        />
      </div>

      {/* Min/Max total */}
      <div className="space-y-1.5">
        <Label className="text-xs">Min Total Sales</Label>
        <Input
          type="number"
          placeholder="0"
          className="h-8 text-xs"
          value={filters.minTotal}
          onChange={e => onChange({ ...filters, minTotal: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Max Total Sales</Label>
        <Input
          type="number"
          placeholder="Any"
          className="h-8 text-xs"
          value={filters.maxTotal}
          onChange={e => onChange({ ...filters, maxTotal: e.target.value })}
        />
      </div>

      <Button size="sm" variant="outline" className="w-full text-xs" onClick={handleReset}>
        Reset Filters
      </Button>
    </Card>
  );
}