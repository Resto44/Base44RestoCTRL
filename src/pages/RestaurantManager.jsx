import React, { useState } from 'react';
import { useTenant } from '@/lib/TenantContext';
import { useRole } from '@/lib/RoleContext';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Building2, GitBranch, Star } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export default function RestaurantManager() {
  const { user } = useAuth();
  const { restaurants, activeRestaurant, setActiveRestaurant, allBranches, updateRestaurantBranches, createRestaurant, refetchRestaurants } = useTenant();
  const { role } = useRole();
  const queryClient = useQueryClient();

  const [showNewRestaurant, setShowNewRestaurant] = useState(false);
  const [showBranchManager, setShowBranchManager] = useState(false);
  const [restForm, setRestForm] = useState({ name: '', address: '', currency: '$' });
  const [branchForm, setBranchForm] = useState({ key: '', label: '', manager_email: '' });
  const [saving, setSaving] = useState(false);

  if (role !== 'owner') {
    return <div className="p-8 text-center text-muted-foreground">Owner access required.</div>;
  }

  const handleCreateRestaurant = async () => {
    if (!restForm.name) return;
    setSaving(true);
    await createRestaurant(restForm);
    setRestForm({ name: '', address: '', currency: '$' });
    setShowNewRestaurant(false);
    setSaving(false);
    toast.success('Restaurant created!');
  };

  const handleAddBranch = async () => {
    if (!branchForm.label) return;
    const key = branchForm.key || branchForm.label.toLowerCase().replace(/\s+/g, '_');
    const updated = [...allBranches, { ...branchForm, key, is_active: true }];
    await updateRestaurantBranches(updated);
    setBranchForm({ key: '', label: '', manager_email: '' });
    toast.success('Branch added!');
  };

  const handleToggleBranch = async (branchKey) => {
    const updated = allBranches.map(b => b.key === branchKey ? { ...b, is_active: !b.is_active } : b);
    await updateRestaurantBranches(updated);
  };

  const handleDeleteBranch = async (branchKey) => {
    const updated = allBranches.filter(b => b.key !== branchKey);
    await updateRestaurantBranches(updated);
    toast.success('Branch removed!');
  };

  const handleDeleteRestaurant = async (id) => {
    if (!window.confirm('Delete this restaurant? This cannot be undone.')) return;
    await base44.entities.Restaurant.delete(id);
    refetchRestaurants();
    queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    toast.success('Restaurant deleted');
  };

  return (
    <div>
      <PageHeader
        title="Restaurants & Branches"
        action={
          restaurants.length < 15 && (
            <Button size="sm" onClick={() => setShowNewRestaurant(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Restaurant
            </Button>
          )
        }
      />

      <div className="space-y-4">
        {restaurants.map(r => (
          <Card key={r.id} className={`p-4 ${r.id === activeRestaurant?.id ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <div>
                  <p className="font-semibold">{r.name}</p>
                  {r.address && <p className="text-xs text-muted-foreground">{r.address}</p>}
                </div>
              </div>
              <div className="flex gap-1.5">
                {r.id !== activeRestaurant?.id && (
                  <Button size="sm" variant="outline" onClick={() => setActiveRestaurant(r.id)}>
                    <Star className="w-3 h-3 mr-1" /> Select
                  </Button>
                )}
                {r.id === activeRestaurant?.id && (
                  <Badge className="bg-primary/10 text-primary text-xs">Active</Badge>
                )}
                <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => handleDeleteRestaurant(r.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {r.id === activeRestaurant?.id && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <GitBranch className="w-3 h-3" /> Branches
                  </p>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowBranchManager(true)}>
                    <Plus className="w-3 h-3 mr-0.5" /> Add Branch
                  </Button>
                </div>
                <div className="space-y-2">
                  {allBranches.length === 0 && <p className="text-xs text-muted-foreground italic">No branches yet</p>}
                  {allBranches.map(b => (
                    <div key={b.key} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{b.label}</p>
                        {b.manager_email && <p className="text-xs text-muted-foreground">{b.manager_email}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={b.is_active !== false} onCheckedChange={() => handleToggleBranch(b.key)} />
                        <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => handleDeleteBranch(b.key)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        ))}

        {restaurants.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No restaurants yet. Add your first one!</p>
          </div>
        )}
      </div>

      {/* New Restaurant Dialog */}
      <Dialog open={showNewRestaurant} onOpenChange={setShowNewRestaurant}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Restaurant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={restForm.name} onChange={e => setRestForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Address</Label><Input value={restForm.address} onChange={e => setRestForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div>
              <Label>Currency</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {['$', '€', '£', 'SAR', 'ر.س', '؋'].map(c => (
                  <Button key={c} size="sm" variant={restForm.currency === c ? 'default' : 'outline'} onClick={() => setRestForm(f => ({ ...f, currency: c }))}>{c}</Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleCreateRestaurant} disabled={saving}>Create</Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowNewRestaurant(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Branch Dialog */}
      <Dialog open={showBranchManager} onOpenChange={setShowBranchManager}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Branch</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Branch Name *</Label><Input value={branchForm.label} onChange={e => setBranchForm(f => ({ ...f, label: e.target.value }))} /></div>
            <div><Label>Manager Email (optional)</Label><Input type="email" value={branchForm.manager_email} onChange={e => setBranchForm(f => ({ ...f, manager_email: e.target.value }))} /></div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleAddBranch}>Add Branch</Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowBranchManager(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}