import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import PageHeader from '@/components/shared/PageHeader';
import BranchSelect from '@/components/shared/BranchSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Smartphone, Edit2, Trash2, WifiOff, Wifi, Hash } from 'lucide-react';

const EMPTY = { account_name: '', branch: '', network_provider: '', account_number: '', device_name: '', notes: '', is_active: true };

export default function NetworkAccounts() {
  const { branches } = useLanguage();
  const qc = useQueryClient();
  const [filterBranch, setFilterBranch] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const { ownerFilter } = useTenant();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['network_accounts', ownerFilter],
    queryFn: () => base44.entities.NetworkAccount.filter(ownerFilter, '-created_date', 500),
    staleTime: 30000,
    enabled: !!ownerFilter.created_by,
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.NetworkAccount.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['network_accounts'] }); closeForm(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.NetworkAccount.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['network_accounts'] }); closeForm(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.NetworkAccount.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['network_accounts'] }); setDeleting(null); },
  });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY); };
  const openCreate = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (a) => { setForm({ ...a }); setEditing(a); setShowForm(true); };

  const handleSave = () => {
    if (!form.account_name || !form.branch) return alert('Account name and branch are required.');
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  };

  const filtered = filterBranch === 'all' ? accounts : accounts.filter(a => a.branch === filterBranch);
  const grouped = filtered.reduce((acc, a) => {
    const b = a.branch || 'Unassigned';
    if (!acc[b]) acc[b] = [];
    acc[b].push(a);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Network Accounts"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Add Account
          </Button>
        }
      />

      {/* Branch filter */}
      <div className="mb-4">
        <BranchSelect value={filterBranch} onChange={setFilterBranch} includeAll />
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground text-sm py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Smartphone className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">No network accounts yet. Add your first device.</p>
          <Button className="mt-4" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Add Account</Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([branch, accs]) => (
            <div key={branch}>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{branch}</p>
              <div className="space-y-2">
                {accs.map(a => (
                  <Card key={a.id} className={`p-3 ${!a.is_active ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${a.is_active ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        {a.is_active ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{a.account_name}</span>
                          {!a.is_active && <Badge variant="outline" className="text-xs text-slate-400">Inactive</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {a.network_provider && <span className="text-xs text-muted-foreground">{a.network_provider}</span>}
                          {a.account_number && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Hash className="w-3 h-3" />{a.account_number}
                            </span>
                          )}
                          {a.device_name && <span className="text-xs text-muted-foreground">📱 {a.device_name}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(a)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => setDeleting(a)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Network Account' : 'Add Network Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Account Name * <span className="text-muted-foreground">(e.g. شبكة النخيل — 1002)</span></Label>
              <Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="شبكة فرع النخيل — ID 1002" />
            </div>
            <div>
              <Label className="text-xs">Branch *</Label>
              <BranchSelect value={form.branch} onChange={v => setForm(f => ({ ...f, branch: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Network Provider</Label>
                <Input value={form.network_provider} onChange={e => setForm(f => ({ ...f, network_provider: e.target.value }))} placeholder="مدى، Visa، STC..." />
              </div>
              <div>
                <Label className="text-xs">Terminal / Account #</Label>
                <Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="1001" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Device Name</Label>
              <Input value={form.device_name} onChange={e => setForm(f => ({ ...f, device_name: e.target.value }))} placeholder="POS Terminal 1" />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional..." />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label className="text-sm">Active</Label>
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
                {editing ? 'Save Changes' : 'Add Account'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={closeForm}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.account_name}"?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMut.mutate(deleting?.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}