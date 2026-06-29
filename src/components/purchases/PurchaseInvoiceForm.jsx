/**
 * PurchaseInvoiceForm — Phase 7
 * Enterprise multi-line invoice form with:
 * - Header fields (invoice #, supplier, branch, dates, currency)
 * - Multi-line items (category, product, unit, qty, cost, discount, tax, line total)
 * - Additional costs (delivery, transport, customs, etc.)
 * - Partial payment section (cash, bank, POS, transfer)
 * - Attachment upload
 * - OCR scan trigger
 * - Approval workflow display
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { useAuth } from '@/lib/AuthContext';
import { usePurchaseProductsByCategory } from '@/hooks/usePurchaseProductsByCategory';
import { usePurchaseCategoriesHierarchy } from '@/hooks/usePurchaseCategoriesHierarchy';
import BranchSelect from '@/components/shared/BranchSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Trash2, Receipt, Package, Truck, AlertCircle, CheckCircle2,
  Clock, Upload, Paperclip, ScanLine, ChevronDown, ChevronUp, DollarSign
} from 'lucide-react';
import {
  calcLineTotal, calcInvoiceTotals, computeApprovalStatus,
  createPurchaseInvoice, updatePurchaseInvoice, addInvoicePayment
} from '@/lib/procurementEngine';
import OcrScanDialog from './OcrScanDialog';

const CURRENCIES = ['SAR', 'USD', 'AED', 'EGP', 'KWD', 'QAR', 'BHD', 'OMR', 'EUR', 'GBP'];
const PAYMENT_METHODS = ['cash', 'bank', 'pos', 'transfer'];
const ADDITIONAL_COST_TYPES = ['delivery', 'transport', 'customs', 'packaging', 'miscellaneous'];

const STATUS_CONFIG = {
  draft:     { label: 'Draft',    cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  pending:   { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  approved:  { label: 'Approved', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  paid:      { label: 'Paid',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  partial:   { label: 'Partial',  cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  unpaid:    { label: 'Unpaid',   cls: 'bg-red-100 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled',cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const APPROVAL_CONFIG = {
  auto_approved: { label: 'Auto Approved', cls: 'bg-emerald-100 text-emerald-700' },
  pending:       { label: 'Pending Approval', cls: 'bg-yellow-100 text-yellow-700' },
  approved:      { label: 'Approved', cls: 'bg-blue-100 text-blue-700' },
  rejected:      { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
};

const emptyItem = () => ({
  _id: Math.random().toString(36).slice(2),
  category: '',
  category_id: '',
  purchase_category_id: '',
  product_id: '',
  product_name: '',
  unit: '',
  quantity: 1,
  unit_cost: 0,
  discount: 0,
  tax: 0,
  line_total: 0,
});

const emptyPayment = () => ({
  _id: Math.random().toString(36).slice(2),
  amount: 0,
  payment_method: 'cash',
  notes: '',
  date: new Date().toISOString().split('T')[0],
});

const emptyAdditionalCost = () => ({
  _id: Math.random().toString(36).slice(2),
  type: 'delivery',
  description: '',
  amount: 0,
});

export default function PurchaseInvoiceForm({ invoice = null, onSuccess, onCancel }) {
  const { currency: currencySymbol, lang } = useLanguage();
  const { ownerFilter } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();

  const isEdit = !!invoice;

  // ── Form state ─────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    invoice_number: invoice?.invoice_number || '',
    supplier_id: invoice?.supplier_id || '',
    supplier_name: invoice?.supplier_name || '',
    branch: invoice?.branch || '',
    date: invoice?.date || new Date().toISOString().split('T')[0],
    due_date: invoice?.due_date || '',
    currency: invoice?.currency || 'SAR',
    notes: invoice?.notes || '',
    status: invoice?.status || 'draft',
  });

  const [items, setItems] = useState(
    invoice?.items?.length ? invoice.items.map(i => ({ ...i, _id: Math.random().toString(36).slice(2) })) : [emptyItem()]
  );

  const [additionalCosts, setAdditionalCosts] = useState(
    invoice?.additional_costs?.length ? invoice.additional_costs.map(c => ({ ...c, _id: Math.random().toString(36).slice(2) })) : []
  );

  const [payments, setPayments] = useState([emptyPayment()]);
  const [showAdditionalCosts, setShowAdditionalCosts] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showOcr, setShowOcr] = useState(false);
  const [attachments, setAttachments] = useState(invoice?.attachment_urls || []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { activeRestaurantId } = useTenant();

  // ── Auto-numbering ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit && !form.invoice_number && activeRestaurantId) {
      const fetchNumber = async () => {
        try {
          const { data, error } = await supabase.rpc('generate_purchase_invoice_number', {
            p_restaurant_id: activeRestaurantId,
            p_date: form.date
          });
          if (!error && data) {
            setForm(f => ({ ...f, invoice_number: data }));
          }
        } catch (err) {
          console.error('[PurchaseInvoiceForm] Failed to generate invoice number:', err);
        }
      };
      fetchNumber();
    }
  }, [isEdit, activeRestaurantId, form.date]);

  // ── Data fetches ───────────────────────────────────────────────────────
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', ownerFilter],
    queryFn: () => base44.entities.Supplier.filter(ownerFilter || {}, 'name', 500),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  // Note: products are now fetched per-category via usePurchaseProductsByCategory hook
  // This global query is kept for backward compatibility but not used for invoice items
  const { data: _allProducts = [] } = useQuery({
    queryKey: ['products', ownerFilter],
    queryFn: () => base44.entities.Product.filter(ownerFilter || {}, 'name', 1000),
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  // Use hierarchical categories hook
  const { categories, tree: categoriesTree } = usePurchaseCategoriesHierarchy();

  // ── Totals ─────────────────────────────────────────────────────────────
  const totals = calcInvoiceTotals(items, additionalCosts);
  const paymentTotal = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const remaining = totals.grandTotal - paymentTotal;
  const approvalStatus = computeApprovalStatus(totals.grandTotal);

  // ── Item handlers ──────────────────────────────────────────────────────
  const updateItem = useCallback((id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item._id !== id) return item;
      const updated = { ...item, [field]: value };
      
      // When category changes: clear product selection
      if (field === 'category_id') {
        updated.product_id = '';
        updated.product_name = '';
      }
      
      updated.line_total = calcLineTotal(updated);
      return updated;
    }));
  }, []);

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (id) => setItems(prev => prev.filter(i => i._id !== id));

  // ── Additional cost handlers ───────────────────────────────────────────
  const updateAdditionalCost = (id, field, value) => {
    setAdditionalCosts(prev => prev.map(c => c._id === id ? { ...c, [field]: value } : c));
  };
  const addAdditionalCost = () => setAdditionalCosts(prev => [...prev, emptyAdditionalCost()]);
  const removeAdditionalCost = (id) => setAdditionalCosts(prev => prev.filter(c => c._id !== id));

  // ── Payment handlers ───────────────────────────────────────────────────
  const updatePayment = (id, field, value) => {
    setPayments(prev => prev.map(p => p._id === id ? { ...p, [field]: value } : p));
  };
  const addPayment = () => setPayments(prev => [...prev, emptyPayment()]);
  const removePayment = (id) => setPayments(prev => prev.filter(p => p._id !== id));

  // ── OCR pre-fill ───────────────────────────────────────────────────────
  const handleOcrResult = (extracted) => {
    setForm(f => ({
      ...f,
      invoice_number: extracted.invoice_number || f.invoice_number,
      date: extracted.date || f.date,
      supplier_name: extracted.supplier_name || f.supplier_name,
    }));
    setShowOcr(false);
  };

  // ── File attachment ────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const path = `invoices/${Date.now()}_${file.name}`;
      const { data, error: uploadError } = await supabase.storage.from('attachments').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
      setAttachments(prev => [...prev, publicUrl]);
    } catch (err) {
      console.error('Upload error:', err);
      // Fallback: store file name as placeholder
      setAttachments(prev => [...prev, `[file:${file.name}]`]);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.branch) { setError('Branch is required'); return; }
    
    // Minimal validation: must have either a selected supplier or a typed name
    const supplierId = form.supplier_id && form.supplier_id.trim() !== '' ? form.supplier_id : null;
    const supplierName = form.supplier_name && form.supplier_name.trim() !== '' ? form.supplier_name : null;
    
    if (!supplierId && !supplierName) { 
      setError('Supplier selection or name is required'); 
      return; 
    }

    if (items.length === 0 || items.every(i => !i.product_name && !i.product_id)) {
      setError('At least one line item is required'); return;
    }

    setSaving(true);
    try {
      const cleanItems = items.map(({ _id, ...i }) => ({
        ...i,
        line_total: calcLineTotal(i),
      }));
      const cleanCosts = additionalCosts.map(({ _id, ...c }) => c);

      const invoicePayload = {
        ...form,
        supplier_id: supplierId, // Sanitize: ensure "" becomes null for UUID column
        supplier_name: supplierName || form.supplier_name,
        attachment_urls: attachments,
      };

      let savedInvoice;
      if (isEdit) {
        savedInvoice = await updatePurchaseInvoice({
          invoiceId: invoice.id,
          invoiceData: invoicePayload,
          items: cleanItems,
          additionalCosts: cleanCosts,
          createdBy: user?.email,
        });
      } else {
        savedInvoice = await createPurchaseInvoice({
          invoiceData: invoicePayload,
          items: cleanItems,
          additionalCosts: cleanCosts,
          createdBy: user?.email,
        });
      }

      // Process payments if any have amounts
      const validPayments = payments.filter(p => parseFloat(p.amount) > 0);
      for (const pmt of validPayments) {
        await addInvoicePayment({
          invoiceId: savedInvoice.id,
          amount: parseFloat(pmt.amount),
          paymentMethod: pmt.payment_method,
          notes: pmt.notes,
          date: pmt.date,
          createdBy: user?.email,
        });
      }

      qc.invalidateQueries({ queryKey: ['supplier_invoices'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['debt_records'] });
      qc.invalidateQueries({ queryKey: ['purchases'] });

      onSuccess?.(savedInvoice);
    } catch (err) {
      setError(err.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* OCR Scan Button */}
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowOcr(true)} className="gap-1.5 text-xs">
          <ScanLine className="w-3.5 h-3.5" /> Scan Invoice (OCR)
        </Button>
      </div>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Receipt className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Invoice Header</span>
          {totals.grandTotal > 0 && (
            <Badge className={`ms-auto text-[10px] border ${APPROVAL_CONFIG[approvalStatus]?.cls}`}>
              {APPROVAL_CONFIG[approvalStatus]?.label}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Invoice Number</Label>
            <Input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="INV-001" className="h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Currency</Label>
            <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Supplier *</Label>
          <Select value={form.supplier_id} onValueChange={v => {
            const s = suppliers.find(s => s.id === v);
            setForm(f => ({ ...f, supplier_id: v, supplier_name: s?.name || '' }));
          }}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select supplier..." />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {!form.supplier_id && (
            <Input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
              placeholder="Or type supplier name..." className="h-9 mt-1.5 text-sm" />
          )}
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Branch *</Label>
          <BranchSelect value={form.branch} onChange={v => setForm(f => ({ ...f, branch: v }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Purchase Date *</Label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Due Date</Label>
            <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="h-9" />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Notes</Label>
          <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-sm resize-none" placeholder="Additional notes..." />
        </div>
      </Card>

      {/* ── LINE ITEMS ──────────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Line Items</span>
          <Button type="button" size="sm" variant="outline" onClick={addItem} className="ms-auto gap-1 text-xs h-7">
            <Plus className="w-3 h-3" /> Add Item
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => {
            // Fetch products for this item's purchase category
            const { products: categoryProducts = [] } = usePurchaseProductsByCategory(item.purchase_category_id);
            
            return (
            <div key={item._id} className="rounded-lg border border-border p-3 space-y-2 bg-secondary/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                {items.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(item._id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Product Category</Label>
                  <Select value={item.category_id} onValueChange={v => {
                    const cat = categories.find(c => c.id === v);
                    updateItem(item._id, 'category_id', v);
                    updateItem(item._id, 'category', cat?.name || '');
                  }}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Render hierarchical categories */}
                      {categoriesTree.map(rootCat => (
                        <div key={rootCat.id}>
                          <SelectItem value={rootCat.id}>
                            {rootCat.icon || '🛒'} {rootCat.name}
                          </SelectItem>
                          {rootCat.children && rootCat.children.length > 0 && (
                            rootCat.children.map(childCat => (
                              <SelectItem key={childCat.id} value={childCat.id} className="pl-6">
                                └─ {childCat.icon || '📦'} {childCat.name}
                              </SelectItem>
                            ))
                          )}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Purchase Category *</Label>
                  <Select value={item.purchase_category_id} onValueChange={v => {
                    updateItem(item._id, 'purchase_category_id', v);
                  }}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesTree.map(rootCat => (
                        <div key={rootCat.id}>
                          <SelectItem value={rootCat.id}>
                            {rootCat.icon || '🛒'} {rootCat.name}
                          </SelectItem>
                          {rootCat.children && rootCat.children.length > 0 && (
                            rootCat.children.map(childCat => (
                              <SelectItem key={childCat.id} value={childCat.id} className="pl-6">
                                └─ {childCat.icon || '📦'} {childCat.name}
                              </SelectItem>
                            ))
                          )}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Product *</Label>
                  <Select value={item.product_id} onValueChange={v => {
                    const prod = categoryProducts.find(p => p.id === v);
                    updateItem(item._id, 'product_id', v);
                    if (prod) {
                      updateItem(item._id, 'product_name', prod.name);
                      updateItem(item._id, 'unit', prod.unit || item.unit);
                      updateItem(item._id, 'unit_cost', prod.default_cost || item.unit_cost);
                    }
                  }} disabled={!item.category_id}>
                    <SelectTrigger className="h-8 text-xs" disabled={!item.category_id}>
                      <SelectValue placeholder={item.category_id ? (categoryProducts.length === 0 ? 'No products in this category.' : 'Select...') : 'Select category first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryProducts.length === 0 && item.category_id ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">No products in this category.</div>
                      ) : (
                        categoryProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                  {!item.product_id && item.category_id && (
                    <Input value={item.product_name} onChange={e => updateItem(item._id, 'product_name', e.target.value)}
                      placeholder="Or type product name" className="h-8 text-xs mt-1" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Unit</Label>
                  <Input value={item.unit} onChange={e => updateItem(item._id, 'unit', e.target.value)} placeholder="kg" className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Quantity</Label>
                  <Input type="number" min="0" step="0.001" value={item.quantity}
                    onChange={e => updateItem(item._id, 'quantity', parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Unit Cost</Label>
                  <Input type="number" min="0" step="0.01" value={item.unit_cost}
                    onChange={e => updateItem(item._id, 'unit_cost', parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Discount</Label>
                  <Input type="number" min="0" step="0.01" value={item.discount}
                    onChange={e => updateItem(item._id, 'discount', parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Tax %</Label>
                  <Input type="number" min="0" max="100" step="0.1" value={item.tax}
                    onChange={e => updateItem(item._id, 'tax', parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Line Total</Label>
                  <div className="h-8 flex items-center px-2 rounded-md bg-primary/5 border border-border text-xs font-semibold text-primary">
                    {(item.line_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      </Card>

      {/* ── ADDITIONAL COSTS ────────────────────────────────────────────── */}
      <Card className="p-4">
        <button type="button" className="flex items-center gap-2 w-full" onClick={() => setShowAdditionalCosts(v => !v)}>
          <Truck className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Additional Costs</span>
          {totals.additionalTotal > 0 && (
            <span className="text-xs text-muted-foreground ms-1">({currencySymbol}{totals.additionalTotal.toLocaleString()})</span>
          )}
          <span className="ms-auto">{showAdditionalCosts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
        </button>

        {showAdditionalCosts && (
          <div className="mt-3 space-y-2">
            {additionalCosts.map(cost => (
              <div key={cost._id} className="flex gap-2 items-center">
                <Select value={cost.type} onValueChange={v => updateAdditionalCost(cost._id, 'type', v)}>
                  <SelectTrigger className="h-8 text-xs w-32 flex-shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{ADDITIONAL_COST_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={cost.description} onChange={e => updateAdditionalCost(cost._id, 'description', e.target.value)}
                  placeholder="Description" className="h-8 text-xs flex-1" />
                <Input type="number" min="0" step="0.01" value={cost.amount}
                  onChange={e => updateAdditionalCost(cost._id, 'amount', parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs w-24 flex-shrink-0" placeholder="0.00" />
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive flex-shrink-0" onClick={() => removeAdditionalCost(cost._id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addAdditionalCost} className="gap-1 text-xs h-7">
              <Plus className="w-3 h-3" /> Add Cost
            </Button>
          </div>
        )}
      </Card>

      {/* ── TOTALS SUMMARY ──────────────────────────────────────────────── */}
      <Card className="p-4 bg-secondary/30">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{currencySymbol}{totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Discount</span>
              <span>-{currencySymbol}{totals.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {totals.taxAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>+{currencySymbol}{totals.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {totals.additionalTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Additional Costs</span>
              <span>+{currencySymbol}{totals.additionalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1.5 font-bold text-base">
            <span>Grand Total</span>
            <span className="text-primary">{currencySymbol}{totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </Card>

      {/* ── PAYMENTS ────────────────────────────────────────────────────── */}
      <Card className="p-4">
        <button type="button" className="flex items-center gap-2 w-full" onClick={() => setShowPayments(v => !v)}>
          <DollarSign className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Payments</span>
          {paymentTotal > 0 && (
            <span className="text-xs text-muted-foreground ms-1">(Paid: {currencySymbol}{paymentTotal.toLocaleString()})</span>
          )}
          <span className="ms-auto">{showPayments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
        </button>

        {showPayments && (
          <div className="mt-3 space-y-2">
            {payments.map((pmt, idx) => (
              <div key={pmt._id} className="rounded-lg border border-border p-2.5 space-y-2 bg-secondary/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Payment {idx + 1}</span>
                  {payments.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removePayment(pmt._id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Amount</Label>
                    <Input type="number" min="0" step="0.01" value={pmt.amount}
                      onChange={e => updatePayment(pmt._id, 'amount', e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Method</Label>
                    <Select value={pmt.payment_method} onValueChange={v => updatePayment(pmt._id, 'payment_method', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Date</Label>
                    <Input type="date" value={pmt.date} onChange={e => updatePayment(pmt._id, 'date', e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Notes</Label>
                    <Input value={pmt.notes} onChange={e => updatePayment(pmt._id, 'notes', e.target.value)} placeholder="..." className="h-8 text-xs" />
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addPayment} className="gap-1 text-xs h-7">
              <Plus className="w-3 h-3" /> Add Payment
            </Button>

            {/* Remaining balance */}
            {totals.grandTotal > 0 && (
              <div className={`flex justify-between items-center rounded-lg px-3 py-2.5 ${remaining > 0 ? 'bg-red-50 dark:bg-red-950' : 'bg-emerald-50 dark:bg-emerald-950'}`}>
                <span className={`text-xs font-medium ${remaining > 0 ? 'text-red-700' : 'text-emerald-700'}`}>Remaining Balance</span>
                <div className="flex items-center gap-2">
                  {remaining <= 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                  <span className={`text-base font-bold ${remaining > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {currencySymbol}{Math.abs(remaining).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── ATTACHMENTS ─────────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Paperclip className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Attachments</span>
        </div>
        <div className="space-y-2">
          {attachments.map((url, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded px-2 py-1">
              <Paperclip className="w-3 h-3 flex-shrink-0" />
              <a href={url} target="_blank" rel="noreferrer" className="truncate flex-1 text-primary hover:underline">{url.split('/').pop()}</a>
              <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <label className="flex items-center gap-2 cursor-pointer">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs h-7 pointer-events-none">
              <Upload className="w-3.5 h-3.5" /> Upload File
            </Button>
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileUpload} />
          </label>
        </div>
      </Card>

      {/* ── ACTIONS ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 pb-4">
        <Button type="submit" className="flex-1 h-11 font-bold" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Update Invoice' : 'Create Invoice'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-11">Cancel</Button>
        )}
      </div>

      {/* OCR Dialog */}
      {showOcr && (
        <OcrScanDialog
          onResult={handleOcrResult}
          onClose={() => setShowOcr(false)}
          branch={form.branch}
          createdBy={user?.email}
        />
      )}
    </form>
  );
}
