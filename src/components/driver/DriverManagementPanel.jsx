import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Bike, Pencil, Trash2, AlertTriangle } from 'lucide-react';

const STATUS_COLOR = {
  active:    'bg-green-100 text-green-700 border-green-200',
  suspended: 'bg-red-100 text-red-700 border-red-200',
  off_duty:  'bg-slate-100 text-slate-600 border-slate-200',
};

const EMPTY_FORM = {
  full_name: '',
  driver_id: '',
  phone: '',
  email: '',
  vehicle_type: '',
  vehicle_plate: '',
  notes: '',
  status: 'active',
};

async function fetchDrivers(restaurantId) {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_date', { ascending: false });
  if (error) { console.warn('[DriverMgmt] fetch error:', error.message); return []; }
  return data || [];
}

async function createDriver(restaurantId, form) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('drivers')
    .insert({ ...form, restaurant_id: restaurantId, is_active: true, created_date: now, updated_date: now })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateDriver(id, changes) {
  const { data, error } = await supabase
    .from('drivers')
    .update({ ...changes, updated_date: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteDriver(id) {
  const { error } = await supabase.from('drivers').delete().eq('id', id);
  if (error) throw error;
}

export default function DriverManagementPanel({ branch, today }) {
  const { activeRestaurantId } = useTenant();
  const qc = useQueryClient();

  const [showForm, setShowForm]           = useState(false);
  const [editingId, setEditingId]         = useState(null);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['drivers-mgmt', activeRestaurantId],
    queryFn: () => fetchDrivers(activeRestaurantId),
    enabled: !!activeRestaurantId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['drivers-mgmt', activeRestaurantId] });

  const createMutation = useMutation({
    mutationFn: (f) => createDriver(activeRestaurantId, f),
    onSuccess: () => { toast.success('Driver created'); invalidate(); closeForm(); },
    onError: (e) => toast.error(e.message || 'Failed to create driver'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, changes }) => updateDriver(id, changes),
    onSuccess: () => { toast.success('Driver updated'); invalidate(); closeForm(); },
    onError: (e) => toast.error(e.message || 'Failed to update driver'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteDriver(id),
    onSuccess: () => { toast.success('Driver deleted'); invalidate(); setConfirmDelete(null); },
    onError: (e) => toast.error(e.message || 'Failed to delete driver'),
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(d) {
    setEditingId(d.id);
    setForm({
      full_name:     d.full_name     || '',
      driver_id:     d.driver_id     || '',
      phone:         d.phone         || '',
      email:         d.email         || '',
      vehicle_type:  d.vehicle_type  || '',
      vehicle_plate: d.vehicle_plate || '',
      notes:         d.notes         || '',
      status:        d.status        || 'active',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit() {
    if (!form.full_name.trim()) { toast.error('Full name is required'); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, changes: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-2xl font-black text-blue-700">{drivers.length}</p>
          <p className="text-xs text-blue-600">Total Drivers</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-2xl font-black text-green-700">
            {drivers.filter(d => d.status === 'active').length}
          </p>
          <p className="text-xs text-green-600">Active</p>
        </div>
      </div>

      <Button onClick={openCreate} className="w-full gap-2">
        <UserPlus className="w-4 h-4" /> Add Driver
      </Button>

      {isLoading && (
        <p className="text-center text-sm text-muted-foreground py-6">Loading drivers…</p>
      )}

      {drivers.map(d => (
        <Card key={d.id} className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold">
                  {d.full_name?.[0] || '?'}
                </div>
                <div>
                  <div className="font-semibold text-sm">{d.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.driver_id && <span className="mr-2">{d.driver_id}</span>}
                    {d.phone || 'No phone'}
                  </div>
                </div>
              </div>
              <Badge className={`text-xs border ${STATUS_COLOR[d.status || 'active']}`}>
                {d.status || 'active'}
              </Badge>
            </div>

            {d.vehicle_type && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Bike className="w-3.5 h-3.5" />
                {d.vehicle_type}{d.vehicle_plate ? ` · ${d.vehicle_plate}` : ''}
              </div>
            )}

            {!d.email && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" /> No email set
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm" variant="outline" className="flex-1 text-xs gap-1"
                onClick={() => openEdit(d)}
              >
                <Pencil className="w-3 h-3" /> Edit
              </Button>
              <Button
                size="sm" variant="outline"
                className="flex-1 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => setConfirmDelete(d.id)}
              >
                <Trash2 className="w-3 h-3" /> Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {drivers.length === 0 && !isLoading && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Bike className="w-10 h-10 mx-auto mb-3 opacity-30" />
          No drivers found. Add your first driver above.
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Driver' : 'Add Driver'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input
                placeholder="Driver full name"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="h-10"
              />
            </div>
            <div>
              <Label className="text-xs">Driver ID</Label>
              <Input
                placeholder="e.g. DRV-002"
                value={form.driver_id}
                onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  placeholder="07xxxxxxxx"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  placeholder="driver@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Vehicle Type</Label>
                <Input
                  placeholder="Motorcycle"
                  value={form.vehicle_type}
                  onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div>
                <Label className="text-xs">Plate</Label>
                <Input
                  placeholder="ABC-123"
                  value={form.vehicle_plate}
                  onChange={e => setForm(f => ({ ...f, vehicle_plate: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select
                value={form.status}
                onValueChange={v => setForm(f => ({ ...f, status: v }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="off_duty">Off Duty</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input
                placeholder="Optional notes"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="h-10"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={closeForm} disabled={isPending}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isPending}>
                {isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Add Driver'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Delete Driver?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove the driver record. This action cannot be undone.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive" className="flex-1"
              onClick={() => deleteMutation.mutate(confirmDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
