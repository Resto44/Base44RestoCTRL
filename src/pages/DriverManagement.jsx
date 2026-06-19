import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Progress } from '@/components/ui/progress';
import {
  Truck, Search, Plus, Star, Clock, Wallet, DollarSign, TrendingUp,
  AlertTriangle, CheckCircle2, ChevronRight, Phone, MapPin, Calendar,
  BarChart3, ArrowUpRight, ArrowDownRight, Users, Shield, Fuel
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

function DriverCard({ driver, onClick }) {
  const { currency } = useLanguage();
  const isActive = driver.is_active !== false;
  return (
    <Card className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">
              {driver.name?.charAt(0)?.toUpperCase() || 'D'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">{driver.name}</p>
              <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px] h-4 px-1">
                {isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{driver.phone || '—'}</p>
            <p className="text-xs text-muted-foreground">{driver.branch}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-0.5 justify-end">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-xs font-semibold">{driver.rating || '4.8'}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 ml-auto" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DriverProfileModal({ driver, onClose }) {
  const { t, currency } = useLanguage();
  const [tab, setTab] = useState('overview');

  if (!driver) return null;

  const tabs = [
    { key: 'overview',     label: t('overview') },
    { key: 'orders',       label: t('driver_orders') },
    { key: 'earnings',     label: t('driver_earnings') },
    { key: 'wallet',       label: t('driver_wallet') },
    { key: 'settlements',  label: t('driver_settlements') },
    { key: 'performance',  label: t('driver_performance') },
    { key: 'shifts',       label: t('driver_shifts') },
    { key: 'debts',        label: t('driver_debts') },
  ];

  return (
    <Dialog open={!!driver} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">
                {driver.name?.charAt(0)?.toUpperCase() || 'D'}
              </span>
            </div>
            {driver.name}
          </DialogTitle>
        </DialogHeader>

        {/* Tab navigation - scrollable */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-2">
          {tab === 'overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Orders', value: driver.total_orders || '0', icon: Truck, color: 'text-blue-600' },
                  { label: 'Rating', value: `${driver.rating || '4.8'} ⭐`, icon: Star, color: 'text-amber-600' },
                  { label: 'This Month', value: `${currency}${(driver.earnings_month || 0).toLocaleString()}`, icon: DollarSign, color: 'text-green-600' },
                  { label: 'Wallet Balance', value: `${currency}${(driver.wallet_balance || 0).toLocaleString()}`, icon: Wallet, color: 'text-purple-600' },
                ].map(kpi => (
                  <Card key={kpi.label}>
                    <CardContent className="p-3">
                      <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="p-3 space-y-2">
                  {[
                    { label: 'Branch', value: driver.branch || '—' },
                    { label: 'Phone', value: driver.phone || '—' },
                    { label: 'Join Date', value: driver.joining_date || '—' },
                    { label: 'Status', value: driver.is_active !== false ? 'Active' : 'Inactive' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-1 border-b border-border last:border-0">
                      <span className="text-xs text-muted-foreground">{row.label}</span>
                      <span className="text-xs font-medium">{row.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 'shifts' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-10 bg-emerald-500 hover:bg-emerald-600 text-white text-xs gap-1">
                  <CheckCircle2 className="w-4 h-4" />{t('clock_in')}
                </Button>
                <Button className="h-10 bg-red-500 hover:bg-red-600 text-white text-xs gap-1">
                  <Clock className="w-4 h-4" />{t('clock_out')}
                </Button>
              </div>
              <Card>
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">{t('shift_history')}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-sm text-muted-foreground text-center py-4">{t('no_data')}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 'debts' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: t('fuel_advances'),      color: 'bg-amber-50 text-amber-700', value: 0 },
                  { label: t('cash_shortages'),     color: 'bg-red-50 text-red-700',    value: 0 },
                  { label: t('equipment_liability'), color: 'bg-blue-50 text-blue-700', value: 0 },
                  { label: t('installments'),       color: 'bg-purple-50 text-purple-700', value: 0 },
                ].map(d => (
                  <Card key={d.label} className={d.color}>
                    <CardContent className="p-3">
                      <p className="text-lg font-bold">{currency}{d.value}</p>
                      <p className="text-[11px] font-medium">{d.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Button className="w-full h-9 text-xs" variant="outline">
                <Plus className="w-3 h-3 mr-1" /> Add Debt Record
              </Button>
            </div>
          )}

          {tab === 'earnings' && (
            <div className="space-y-3">
              <Card>
                <CardContent className="p-3 space-y-2">
                  {[
                    { label: 'This Month', value: `${currency}${(driver.earnings_month || 0).toLocaleString()}`, color: 'text-green-600' },
                    { label: 'Last Month', value: `${currency}0`, color: 'text-muted-foreground' },
                    { label: 'Total Earned', value: `${currency}${(driver.total_earnings || 0).toLocaleString()}`, color: 'text-blue-600' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-sm text-muted-foreground">{row.label}</span>
                      <span className={`text-sm font-bold ${row.color}`}>{row.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 'performance' && (
            <div className="space-y-3">
              {[
                { label: 'On-Time Delivery', value: 92, color: 'bg-emerald-500' },
                { label: 'Customer Rating', value: 96, color: 'bg-blue-500' },
                { label: 'Order Acceptance', value: 88, color: 'bg-amber-500' },
                { label: 'Completion Rate', value: 97, color: 'bg-purple-500' },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="font-semibold">{m.value}%</span>
                  </div>
                  <Progress value={m.value} className="h-2" />
                </div>
              ))}
            </div>
          )}

          {(tab === 'orders' || tab === 'wallet' || tab === 'settlements') && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">{t('no_data')}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const emptyDriverForm = { full_name: '', phone: '', branch: '', position: 'Driver', is_active: true };

export default function DriverManagement() {
  const { t } = useLanguage();
  const { ownerFilter, branches } = useTenant();
  const [search, setSearch] = useState('');
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [driverForm, setDriverForm] = useState(emptyDriverForm);
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.Employee.create(data),
    onSuccess: () => {
      toast.success('Driver added successfully');
      qc.invalidateQueries({ queryKey: ['drivers'] });
      setShowAddDialog(false);
      setDriverForm(emptyDriverForm);
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to add driver');
    },
  });

  const handleAddDriver = () => {
    if (!driverForm.full_name || !driverForm.branch) {
      toast.error('Full name and branch are required');
      return;
    }
    addMutation.mutate({ ...driverForm, is_driver: true });
  };

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['drivers', ownerFilter],
    queryFn: () => base44.entities.Employee.filter(ownerFilter || {}),
    staleTime: 120000,
    enabled: !!ownerFilter?.created_by,
  });

  const drivers = useMemo(() =>
    employees.filter(e =>
      e.position?.toLowerCase().includes('driver') &&
      (search === '' || e.name?.toLowerCase().includes(search.toLowerCase()))
    ),
    [employees, search]
  );

  const activeCount = drivers.filter(d => d.is_active !== false).length;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold">{t('driver_management')}</h1>
          <p className="text-xs text-muted-foreground">{activeCount} active drivers</p>
        </div>
        <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setShowAddDialog(true)}>
          <Plus className="w-3 h-3" /> Add Driver
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total', value: drivers.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Active', value: activeCount, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'Inactive', value: drivers.length - activeCount, color: 'bg-red-50 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-2.5 text-center ${s.color}`}>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-[11px] font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`${t('search')} drivers...`}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Driver list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : drivers.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t('no_data')}</p>
          <p className="text-xs mt-1">No drivers found. Add drivers with "Driver" in their position.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {drivers.map(driver => (
            <DriverCard key={driver.id} driver={driver} onClick={() => setSelectedDriver(driver)} />
          ))}
        </div>
      )}

      {/* Driver Profile Modal */}
      <DriverProfileModal driver={selectedDriver} onClose={() => setSelectedDriver(null)} />

      {/* Add Driver Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Driver</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input
                value={driverForm.full_name}
                onChange={e => setDriverForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Driver full name"
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                value={driverForm.phone}
                onChange={e => setDriverForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Phone number"
              />
            </div>
            <div>
              <Label className="text-xs">Branch *</Label>
              <Select value={driverForm.branch} onValueChange={v => setDriverForm(f => ({ ...f, branch: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {(branches || []).map(b => (
                    <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddDriver} disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Saving...' : 'Add Driver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
