/**
 * ApprovalPolicy
 * Owner-only settings page for defining auto-approval limits,
 * accountant verification requirements, and dual-signature thresholds.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useRole } from '@/lib/RoleContext';
import { formatCurrency } from '@/lib/helpers';
import PageHeader from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, Plus, Pencil, Trash2, AlertTriangle, Info } from 'lucide-react';
import BranchSelect from '@/components/shared/BranchSelect';

const EXPENSE_TYPES = [
  { value: 'all',                  label: 'All Types (Global)' },
  { value: 'MANAGER_TO_SPONSOR',   label: 'Branch → Sponsor Settlement' },
  { value: 'SPONSOR_TO_OWNER',     label: 'Sponsor → Owner Transfer' },
  { value: 'OWNER_TO_BRANCH',      label: 'Owner → Branch Funding' },
  { value: 'settlement',           label: 'All Settlements' },
  { value: 'personal_expense',     label: 'Personal Expense' },
];

const empty = { expense_type: 'all', branch: 'all', manager_email: '', auto_approve_limit: 0, require_accountant_verification: false, require_dual_signature_above: '', notes: '', is_active: true };

export default function ApprovalPolicy() {
  const { user } = useAuth();
  const { currency } = useLanguage();
  const { role } = useRole();
  const fmt = v => formatCurrency(v, currency);
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['approval_policies'],
    queryFn: () => base44.entities.ApprovalPolicy.list('-created_date', 100),
    staleTime: 60000,
  });

  const saveMut = useMutation({
    mutationFn: d => editing
      ? base44.entities.ApprovalPolicy.update(editing.id, d)
      : base44.entities.ApprovalPolicy.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approval_policies'] }); setShowForm(false); setEditing(null); setForm(empty); },
  });

  const deleteMut = useMutation({
    mutationFn: id => base44.entities.ApprovalPolicy.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approval_policies'] }); setDeleteId(null); },
  });

  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...empty, ...p, require_dual_signature_above: p.require_dual_signature_above ?? '' });
    setShowForm(true);
  };

  const handleSave = () => {
    saveMut.mutate({
      ...form,
      auto_approve_limit: Number(form.auto_approve_limit) || 0,
      require_dual_signature_above: form.require_dual_signature_above ? Number(form.require_dual_signature_above) : undefined,
      created_by: user?.email,
    });
  };

  if (role !== 'owner' && role !== 'admin') {
    return <div className="text-center py-20 text-muted-foreground">Owner access only.</div>;
  }

  return (
    <div>
      <PageHeader
        title="Approval Policies"
        action={<Button size="sm" onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }}><Plus className="w-3.5 h-3.5 mr-1" /> Add Policy</Button>}
      />

      {/* Info card */}
      <Card className="p-3 mb-4 bg-blue-50 border-blue-200 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700">
          <p className="font-semibold mb-0.5">How Approval Policies Work</p>
          <ul className="space-y-0.5 list-disc ml-3">
            <li><span className="font-medium">Auto-Approve Limit:</span> Submissions at or below this amount skip manual review.</li>
            <li><span className="font-medium">Accountant Verification:</span> Requires an accountant to mark "Verified" before owner approval.</li>
            <li><span className="font-medium">Dual Signature:</span> Amounts above this threshold require both Sponsor + Owner sign-off.</li>
          </ul>
        </div>
      </Card>

      {/* Policies list */}
      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground text-sm">Loading...</p>
      ) : policies.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">No approval policies defined yet</p>
          <p className="text-xs text-muted-foreground mt-1">All submissions require manual review by default</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {policies.map(p => (
            <Card key={p.id} className={`p-3 ${!p.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{EXPENSE_TYPES.find(t => t.value === p.expense_type)?.label || p.expense_type}</Badge>
                    {p.branch && p.branch !== 'all' && <Badge variant="outline" className="text-xs">{p.branch}</Badge>}
                    {!p.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {p.auto_approve_limit > 0 && (
                      <span className="text-emerald-600 font-medium">✓ Auto-approve ≤ {fmt(p.auto_approve_limit)}</span>
                    )}
                    {p.require_accountant_verification && (
                      <span className="text-violet-600 font-medium">🔍 Accountant verification required</span>
                    )}
                    {p.require_dual_signature_above > 0 && (
                      <span className="text-amber-600 font-medium">✍️ Dual signature above {fmt(p.require_dual_signature_above)}</span>
                    )}
                  </div>
                  {p.manager_email && <p className="text-xs text-muted-foreground">Manager: {p.manager_email}</p>}
                  {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Policy' : 'Add Approval Policy'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Expense Type *</Label>
              <Select value={form.expense_type} onValueChange={v => set('expense_type', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Branch (optional)</Label>
              <BranchSelect value={form.branch === 'all' ? '' : form.branch} onChange={v => set('branch', v || 'all')} includeAll />
            </div>

            <div>
              <Label className="text-xs">Specific Manager Email (leave blank = all)</Label>
              <Input value={form.manager_email} onChange={e => set('manager_email', e.target.value)} placeholder="manager@example.com" />
            </div>

            <div>
              <Label className="text-xs">Auto-Approve Limit ({currency})</Label>
              <p className="text-xs text-muted-foreground mb-1">Submissions ≤ this amount are automatically approved</p>
              <Input type="number" value={form.auto_approve_limit} onChange={e => set('auto_approve_limit', e.target.value)} placeholder="0 = disabled" />
            </div>

            <div>
              <Label className="text-xs">Dual Signature Required Above ({currency})</Label>
              <p className="text-xs text-muted-foreground mb-1">Amounts above this need both Sponsor + Owner sign-off</p>
              <Input type="number" value={form.require_dual_signature_above} onChange={e => set('require_dual_signature_above', e.target.value)} placeholder="Leave blank = disabled" />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Require Accountant Verification</p>
                <p className="text-xs text-muted-foreground">Accountant must verify before owner approves</p>
              </div>
              <Switch checked={form.require_accountant_verification} onCheckedChange={v => set('require_accountant_verification', v)} />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Policy Active</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />
            </div>

            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Input value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleSave} disabled={saveMut.isPending}>
                {saveMut.isPending ? 'Saving...' : 'Save Policy'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this policy?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteMut.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}