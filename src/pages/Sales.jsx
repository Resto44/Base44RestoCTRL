import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import SalesForm from '@/components/sales/SalesForm';
import SalesListItem from '@/components/sales/SalesListItem';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Plus, Download, SlidersHorizontal, BarChart3, FileText, Share2, Printer, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { downloadCSV, downloadPDF, buildSalesCSV, buildSalesPDF } from '@/lib/exportUtils';
import ExportDialog from '@/components/shared/ExportDialog';
import SalesFilterSidebar from '@/components/sales/SalesFilterSidebar';
import { useNotify } from '@/lib/useNotify';
import { useNetworkSettlement } from '@/hooks/useNetworkSettlement';
import { useAuth } from '@/lib/AuthContext';
import { useTenant } from '@/lib/TenantContext';
import { format } from 'date-fns';
import CustomerCollections from '@/components/sales/CustomerCollections';
import DailySummary from '@/components/sales/DailySummary';
import CashRegister from '@/components/sales/CashRegister';
import POSReconciliation from '@/components/sales/POSReconciliation';
import {
  generateSalesInvoiceNumber,
  createSalesInvoice,
  generateAndUploadPDF,
  shareInvoiceNative,
  openInvoicePrint,
  downloadInvoicePDF,
  printInvoice,
  shareInvoiceWhatsApp,
} from '@/lib/salesInvoiceService';

export default function Sales() {
  const { t, currency } = useLanguage();
  const { branches } = useTenant();
  const qc = useQueryClient();
  const notif = useNotify();
  const { user } = useAuth();
  const { orgId, ownerFilter, activeRestaurant } = useTenant();
  const { autoSettle } = useNetworkSettlement({ orgId, user, currency });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showFinancialPanel, setShowFinancialPanel] = useState(false);
  const [filters, setFilters] = useState({ branch: 'all', from: '', to: '', minTotal: '', maxTotal: '' });
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Invoice state — shown after successful save
  const [savedInvoice, setSavedInvoice] = useState(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', ownerFilter],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter || {}, '-date', 2000), staleTime: 120000,
    enabled: !!ownerFilter?.created_by,
  });

  // Only create wallet transactions for COUNTER (restaurant) sales.
  const autoWalletTx = async (saleData, saleId, prevSale = null) => {
    const promises = [];
    const base = { date: saleData.date, branch: saleData.branch, auto_generated: true, reference_id: saleId };

    if (prevSale) {
      const existing = await base44.entities.WalletTransaction.filter({ reference_id: prevSale.id, auto_generated: true });
      await Promise.all(existing.map(tx => base44.entities.WalletTransaction.delete(tx.id)));
    }

    const rNet = Number(saleData.restaurant_network) || 0;
    const rCash = Number(saleData.restaurant_cash) || 0;

    if (rNet > 0) {
      promises.push(base44.entities.WalletTransaction.create({
        ...base,
        type: 'network_sales_auto', wallet: 'owner_network', direction: 'in',
        amount: rNet, payment_method: 'network',
        description: `Counter network — ${saleData.branch} — ${saleData.date}`,
      }));
    }

    if (rCash > 0) {
      promises.push(base44.entities.WalletTransaction.create({
        ...base,
        type: 'cash_sales_branch', wallet: 'branch_cash', direction: 'in',
        amount: rCash, payment_method: 'cash',
        description: `Counter cash — ${saleData.branch} — ${saleData.date}`,
      }));
    }

    await Promise.all(promises);
    qc.invalidateQueries({ queryKey: ['wallet_transactions'] });
  };

  // Auto-generate invoice after sale save
  const autoGenerateInvoice = async (saleData, saleId) => {
    try {
      const restaurantId = activeRestaurant?.id;
      const invNum = saleData.invoice_number || await generateSalesInvoiceNumber(restaurantId, saleData.date);

      // Update daily_sales with invoice_number
      if (!saleData.invoice_number) {
        await base44.entities.DailySales.update(saleId, { invoice_number: invNum });
      }

      const invoice = await createSalesInvoice({
        invoiceNumber: invNum,
        saleId,
        saleData,
        restaurantId,
        createdBy: user?.email || '',
      });

      // Phase 8: Generate and store permanent PDF
      try {
        await generateAndUploadPDF(invoice, 'RestoCTRL', currency);
        // Re-fetch to get the pdf_url
        const { data: updatedInv } = await base44.entities.SalesInvoice.filter({ invoice_number: invNum });
        if (updatedInv && updatedInv[0]) {
          setSavedInvoice(updatedInv[0]);
        } else {
          setSavedInvoice(invoice);
        }
      } catch (pdfErr) {
        console.error('[Sales] PDF generation failed:', pdfErr);
        setSavedInvoice(invoice);
      }

      setShowInvoiceDialog(true);
      qc.invalidateQueries({ queryKey: ['sales_invoices'] });
      return invoice;
    } catch (err) {
      console.warn('[Sales] Invoice generation failed:', err.message);
    }
  };

  const createMut = useMutation({
    mutationFn: async ({ data, proofUrl, ocr }) => {
      const sale = await base44.entities.DailySales.create(data);
      await autoWalletTx(data, sale.id);
      try { await autoSettle(data, sale.id, proofUrl || null, ocr || null, null); } catch (e) { console.warn('autoSettle skipped:', e.message); }
      await autoGenerateInvoice(data, sale.id);
      const total = (data.restaurant_cash || 0) + (data.restaurant_network || 0);
      await notif.sale({ branch: data.branch, amount: total, action: 'create' });
      return sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['sales_cash'] });
      qc.invalidateQueries({ queryKey: ['sales_daily'] });
      qc.invalidateQueries({ queryKey: ['settlements_all'] });
      qc.invalidateQueries({ queryKey: ['settlements_mgr'] });
      qc.invalidateQueries({ queryKey: ['wallet_transactions'] });
      setShowForm(false);
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data, prev, proofUrl, ocr }) => {
      const sale = await base44.entities.DailySales.update(id, data);
      await autoWalletTx(data, id, prev);
      try { await autoSettle(data, id, proofUrl || null, ocr || null, prev); } catch (e) { console.warn('autoSettle skipped:', e.message); }
      // Re-generate invoice on update (upsert by invoice_number)
      await autoGenerateInvoice({ ...data, invoice_number: prev?.invoice_number }, id);
      const total = (data.restaurant_cash || 0) + (data.restaurant_network || 0);
      await notif.sale({ branch: data.branch, amount: total, action: 'update' });
      return sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['sales_cash'] });
      qc.invalidateQueries({ queryKey: ['sales_daily'] });
      qc.invalidateQueries({ queryKey: ['settlements_all'] });
      qc.invalidateQueries({ queryKey: ['settlements_mgr'] });
      setEditing(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (sale) => {
      await base44.entities.DailySales.delete(sale.id);
      await notif.sale({ branch: sale.branch, action: 'delete' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); setDeleting(null); },
  });

  const handleSave = async (data, proofUrl, ocr) => {
    const existing = sales.find(s => s.date === data.date && s.branch === data.branch);
    if (existing && !editing) {
      await updateMut.mutateAsync({ id: existing.id, data, prev: existing, proofUrl, ocr });
      setShowForm(false);
    } else if (editing) {
      await updateMut.mutateAsync({ id: editing.id, data, prev: editing, proofUrl, ocr });
    } else {
      await createMut.mutateAsync({ data, proofUrl, ocr });
    }
  };

  const filtered = useMemo(() => {
    return sales.filter(s => {
      if (!s.date) return false;
      if (filters.branch !== 'all' && s.branch !== filters.branch) return false;
      if (filters.from && s.date < filters.from) return false;
      if (filters.to && s.date > filters.to) return false;
      const total = (s.restaurant_cash || s.cash || 0) + (s.restaurant_network || s.network || 0);
      if (filters.minTotal && total < Number(filters.minTotal)) return false;
      if (filters.maxTotal && total > Number(filters.maxTotal)) return false;
      return true;
    });
  }, [sales, filters]);

  const handleExport = ({ format: fmt, from, to, branch }) => {
    const data = sales.filter(s => {
      if (!s.date) return false;
      const inRange = (!from || s.date >= from) && (!to || s.date <= to);
      const inBranch = branch === 'all' || s.branch === branch;
      return inRange && inBranch;
    }).sort((a, b) => a.date.localeCompare(b.date));

    const branchLabel = branch === 'all' ? 'All Branches' : (branches.find(b => b.key === branch)?.label || branch);
    const subtitle = `${branchLabel} | ${from} → ${to}`;
    const filename = `sales_${from}_${to}_${branch}`;

    if (fmt === 'csv') {
      const { headers, rows } = buildSalesCSV(data, t, currency, branches);
      downloadCSV(`${filename}.csv`, headers, rows);
    } else {
      const { headers, rows, totalsRow } = buildSalesPDF(data, t, currency, branches, subtitle);
      downloadPDF({ filename: `${filename}.pdf`, title: t('daily_sales'), subtitle, headers, rows, totalsRow, currency });
    }
    setShowExport(false);
  };

  const activeFilterCount = [
    filters.branch !== 'all', filters.from, filters.to, filters.minTotal, filters.maxTotal,
  ].filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title={t('daily_sales')}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowExport(true)}>
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
            <Button
              size="sm"
              variant={showFinancialPanel ? 'default' : 'outline'}
              onClick={() => setShowFinancialPanel(v => !v)}
            >
              <BarChart3 className="w-4 h-4 mr-1" /> Summary
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowFilters(v => !v)} className="relative">
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button size="sm" onClick={() => { setShowForm(true); setEditing(null); }}>
              <Plus className="w-4 h-4 mr-1" />{t('add_sales')}
            </Button>
          </div>
        }
      />

      {/* Financial Panel — toggled by Summary button */}
      {showFinancialPanel && (
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <CustomerCollections date={todayStr} branch={filters.branch} />
          <DailySummary date={todayStr} branch={filters.branch} />
          <CashRegister date={todayStr} branch={filters.branch} />
          <POSReconciliation date={todayStr} branch={filters.branch} />
        </div>
      )}

      <div className="flex gap-4">
        {showFilters && (
          <div className="w-56 flex-shrink-0">
            <SalesFilterSidebar filters={filters} onChange={setFilters} onClose={() => setShowFilters(false)} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {filtered.length > 0 && (
            <p className="text-xs text-muted-foreground mb-2">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
          )}
          {isLoading ? (
            <p className="text-center text-muted-foreground text-sm py-8">{t('loading')}</p>
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {filtered.map(s => (
                <SalesListItem
                  key={s.id}
                  sale={s}
                  onEdit={(sale) => { setEditing(sale); setShowForm(false); }}
                  onDelete={(sale) => setDeleting(sale)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Sale Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('add_sales')}</DialogTitle></DialogHeader>
          <SalesForm onSubmit={handleSave} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Sale Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('edit_sales')}</DialogTitle></DialogHeader>
          {editing && <SalesForm initial={editing} onSubmit={handleSave} onCancel={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
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

      {/* Invoice Share/Download Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Invoice Generated
            </DialogTitle>
          </DialogHeader>
          {savedInvoice && (
            <div className="space-y-4">
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Invoice Number</p>
                <p className="text-xl font-bold text-primary">{savedInvoice.invoice_number}</p>
                <p className="text-xs text-muted-foreground mt-1">{savedInvoice.branch} · {savedInvoice.sale_date}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 h-11"
                  onClick={() => downloadInvoicePDF(savedInvoice, 'RestoCTRL', currency)}
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 h-11"
                  onClick={() => openInvoicePrint(savedInvoice, 'RestoCTRL', currency)}
                >
                  <FileText className="w-4 h-4" />
                  View PDF
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 h-11"
                  onClick={() => shareInvoiceNative(savedInvoice, 'RestoCTRL', currency)}
                >
                  <Share2 className="w-4 h-4" />
                  Share PDF
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 h-11"
                  onClick={() => printInvoice(savedInvoice, 'RestoCTRL', currency)}
                >
                  <Printer className="w-4 h-4" />
                  Print
                </Button>
                <Button
                  className="flex items-center gap-2 h-11 col-span-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => shareInvoiceWhatsApp(savedInvoice, currency)}
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp Share
                </Button>
              </div>

              <Button variant="ghost" className="w-full" onClick={() => setShowInvoiceDialog(false)}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ExportDialog open={showExport} onClose={() => setShowExport(false)} onExport={handleExport} title={t('daily_sales')} />
    </div>
  );
}
