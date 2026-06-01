import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import PurchaseForm from '@/components/purchases/PurchaseForm.jsx';
import PurchaseListItem from '@/components/purchases/PurchaseListItem';
import EmptyState from '@/components/shared/EmptyState';
import BranchSelect from '@/components/shared/BranchSelect';
import { Button } from '@/components/ui/button';
import { Plus, Download, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ExportDialog from '@/components/shared/ExportDialog';
import { downloadCSV, downloadPDF, buildPurchasesCSV, buildPurchasesPDF } from '@/lib/exportUtils';
import { useNotify } from '@/lib/useNotify';
import { useTenant } from '@/lib/TenantContext';

export default function Purchases() {
  const { t, currency } = useLanguage();
  const { branches } = useTenant();
  const qc = useQueryClient();
  const notif = useNotify();
  const { ownerFilter } = useTenant();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [filterBranch, setFilterBranch] = useState('all');
  const [showExport, setShowExport] = useState(false);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['purchases', ownerFilter],
    queryFn: () => base44.entities.Purchase.filter(ownerFilter, '-date', 10000),
    enabled: !!ownerFilter?.created_by,
  });

  const createMut = useMutation({
    mutationFn: async (data) => {
      const pur = await base44.entities.Purchase.create(data);
      const amount = (data.qty || 0) * (data.used_price || data.current_price || 0);
      await notif.purchase({ branch: data.branch, amount, action: 'create' });
      return pur;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); setShowForm(false); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }) => {
      const pur = await base44.entities.Purchase.update(id, data);
      const amount = (data.qty || 0) * (data.used_price || data.current_price || 0);
      await notif.purchase({ branch: data.branch, amount, action: 'update' });
      return pur;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: async (purchase) => {
      await base44.entities.Purchase.delete(purchase.id);
      await notif.purchase({ branch: purchase.branch, action: 'delete' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); setDeleting(null); },
  });

  const handleSave = (data) => {
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const filtered = filterBranch === 'all' ? purchases : purchases.filter(p => p.branch === filterBranch);

  const handleExport = ({ format, from, to, branch }) => {
    const data = purchases.filter(p => {
      if (!p.date) return false;
      const inRange = p.date >= from && p.date <= to;
      const inBranch = branch === 'all' || p.branch === branch;
      return inRange && inBranch;
    }).sort((a, b) => a.date.localeCompare(b.date));

    const branchLabel = branch === 'all' ? t('all_branches') : (branches.find(b => b.key === branch)?.label || branch);
    const subtitle = `${branchLabel} | ${from} → ${to}`;
    const filename = `purchases_${from}_${to}_${branch}`;

    if (format === 'csv') {
      const { headers, rows } = buildPurchasesCSV(data, t, currency, branches);
      downloadCSV(`${filename}.csv`, headers, rows);
    } else {
      const { headers, rows, totalsRow } = buildPurchasesPDF(data, t, currency, branches, subtitle);
      downloadPDF({ filename: `${filename}.pdf`, title: t('purchases'), subtitle, headers, rows, totalsRow, currency });
    }
    setShowExport(false);
  };

  return (
    <div>
      <PageHeader
        title={t('purchases')}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowExport(true)}>
              <Download className="w-4 h-4" />
            </Button>
            <Link to="/categories">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Settings2 className="w-4 h-4" />
              </Button>
            </Link>
            <Button size="sm" onClick={() => { setShowForm(true); setEditing(null); }}>
              <Plus className="w-4 h-4 mr-1" />{t('add_purchase')}
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <BranchSelect value={filterBranch} onChange={setFilterBranch} includeAll />
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground text-sm py-8">{t('loading')}</p>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <PurchaseListItem
              key={p.id}
              purchase={p}
              onEdit={(pur) => { setEditing(pur); setShowForm(false); }}
              onDelete={(pur) => setDeleting(pur)}
            />
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('add_purchase')}</DialogTitle>
          </DialogHeader>
          <PurchaseForm onSubmit={handleSave} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('edit_purchase')}</DialogTitle>
          </DialogHeader>
          {editing && (
            <PurchaseForm
              initial={editing}
              onSubmit={handleSave}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirm_delete')}</AlertDialogTitle>
            <AlertDialogDescription></AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMut.mutate(deleting)}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExportDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        title={t('purchases')}
      />
    </div>
  );
}