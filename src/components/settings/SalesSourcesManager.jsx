/**
 * SalesSourcesManager — Owner-only Settings → Sales Sources
 * Full CRUD for configurable sale types.
 * Replaces hardcoded Cash / Credit / Network sale types.
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Edit2, Trash2, GripVertical, Banknote, CreditCard,
  UserCheck, PlusCircle, ShoppingBag, Truck, Star, Globe,
  Smartphone, UtensilsCrossed, Package, DollarSign, Gift,
  Users, Building2, Zap, Activity, BarChart3, Shield,
  ChevronUp, ChevronDown, Eye, EyeOff, AlertCircle, CheckCircle2,
  Loader2, Settings, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Icon registry ─────────────────────────────────────────────────────────────
const ICON_MAP = {
  Banknote, CreditCard, UserCheck, PlusCircle, ShoppingBag, Truck,
  Star, Globe, Smartphone, UtensilsCrossed, Package, DollarSign,
  Gift, Users, Building2, Zap, Activity, BarChart3, Shield,
};

const ICON_OPTIONS = [
  { value: 'Banknote',       label: 'Cash / Banknote' },
  { value: 'CreditCard',     label: 'Credit Card / POS' },
  { value: 'UserCheck',      label: 'Customer / Credit' },
  { value: 'PlusCircle',     label: 'Other / Plus' },
  { value: 'ShoppingBag',    label: 'Shopping Bag' },
  { value: 'Truck',          label: 'Delivery / Truck' },
  { value: 'Star',           label: 'Star / Featured' },
  { value: 'Globe',          label: 'Online / Globe' },
  { value: 'Smartphone',     label: 'Mobile / App' },
  { value: 'UtensilsCrossed',label: 'Restaurant' },
  { value: 'Package',        label: 'Package / Wholesale' },
  { value: 'DollarSign',     label: 'Dollar / Income' },
  { value: 'Gift',           label: 'Gift Card' },
  { value: 'Users',          label: 'Group / Membership' },
  { value: 'Building2',      label: 'Catering / Event' },
  { value: 'Zap',            label: 'Quick / Flash' },
  { value: 'Activity',       label: 'Activity / Misc' },
  { value: 'BarChart3',      label: 'Analytics / Report' },
  { value: 'Shield',         label: 'Protected / Secure' },
];

const COLOR_OPTIONS = [
  { value: 'emerald', label: 'Emerald (Cash)',   bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  { value: 'violet',  label: 'Violet (POS)',     bg: 'bg-violet-100',  text: 'text-violet-700',  border: 'border-violet-300' },
  { value: 'amber',   label: 'Amber (Credit)',   bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300' },
  { value: 'slate',   label: 'Slate (Other)',    bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-300' },
  { value: 'blue',    label: 'Blue',             bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300' },
  { value: 'rose',    label: 'Rose',             bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-300' },
  { value: 'orange',  label: 'Orange',           bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300' },
  { value: 'teal',    label: 'Teal',             bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-300' },
  { value: 'pink',    label: 'Pink',             bg: 'bg-pink-100',    text: 'text-pink-700',    border: 'border-pink-300' },
  { value: 'indigo',  label: 'Indigo',           bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-300' },
  { value: 'cyan',    label: 'Cyan',             bg: 'bg-cyan-100',    text: 'text-cyan-700',    border: 'border-cyan-300' },
  { value: 'lime',    label: 'Lime',             bg: 'bg-lime-100',    text: 'text-lime-700',    border: 'border-lime-300' },
];

const PAYMENT_METHODS = [
  { value: 'cash',    label: 'Cash' },
  { value: 'network', label: 'Network / POS' },
  { value: 'credit',  label: 'Customer Credit' },
  { value: 'wallet',  label: 'Wallet' },
  { value: 'other',   label: 'Other' },
];

// ── Default form state ────────────────────────────────────────────────────────
const DEFAULT_FORM = {
  name_en: '',
  name_ar: '',
  name_fa: '',
  icon: 'Banknote',
  color: 'emerald',
  sort_order: 50,
  is_active: true,
  included_in_revenue: true,
  included_in_cash_register: true,
  included_in_dashboard_kpi: true,
  included_in_profit_calc: true,
  requires_customer: false,
  requires_pos_device: false,
  requires_reference: false,
  requires_wallet: false,
  is_global: true,
  branch_id: '',
  default_payment_method: 'cash',
  description: '',
};

// ── Color helper ──────────────────────────────────────────────────────────────
function getColorClasses(color) {
  return COLOR_OPTIONS.find(c => c.value === color) || COLOR_OPTIONS[0];
}

// ── Icon component ────────────────────────────────────────────────────────────
function SourceIcon({ iconName, className }) {
  const IconComp = ICON_MAP[iconName] || Banknote;
  return <IconComp className={className} />;
}

// ── Toggle row ────────────────────────────────────────────────────────────────
function ToggleRow({ label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

// ── Source Card ───────────────────────────────────────────────────────────────
function SourceCard({ source, onEdit, onDelete, onToggleActive, onMoveUp, onMoveDown, isFirst, isLast }) {
  const cc = getColorClasses(source.color);
  const isSystem = source.is_system;

  return (
    <div className={`rounded-xl border-2 p-3 transition-all ${source.is_active ? `${cc.border} bg-background` : 'border-border bg-muted/30 opacity-60'}`}>
      <div className="flex items-center gap-3">
        {/* Drag handle / order controls */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-0.5 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="p-0.5 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cc.bg}`}>
          <SourceIcon iconName={source.icon} className={`w-5 h-5 ${cc.text}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">{source.name_en}</span>
            {source.name_ar && <span className="text-xs text-muted-foreground" dir="rtl">{source.name_ar}</span>}
            {isSystem && (
              <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-primary/30 text-primary">
                SYSTEM
              </Badge>
            )}
            {!source.is_active && (
              <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-muted-foreground text-muted-foreground">
                INACTIVE
              </Badge>
            )}
          </div>
          {/* Feature flags */}
          <div className="flex flex-wrap gap-1 mt-1">
            {source.included_in_revenue && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Revenue</span>
            )}
            {source.included_in_dashboard_kpi && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">KPI</span>
            )}
            {source.included_in_cash_register && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">Cash Reg</span>
            )}
            {source.requires_customer && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Customer</span>
            )}
            {source.requires_pos_device && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">POS</span>
            )}
            {!source.is_global && source.branch_id && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Branch</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onToggleActive(source)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title={source.is_active ? 'Deactivate' : 'Activate'}
          >
            {source.is_active
              ? <Eye className="w-4 h-4 text-emerald-600" />
              : <EyeOff className="w-4 h-4 text-muted-foreground" />
            }
          </button>
          <button
            type="button"
            onClick={() => onEdit(source)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          {!isSystem && (
            <button
              type="button"
              onClick={() => onDelete(source)}
              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Branch Select Inline (uses tenant branches) ─────────────────────────────
function BranchSelectInline({ value, onChange }) {
  const { branches } = useTenant();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10">
        <SelectValue placeholder="Select branch..." />
      </SelectTrigger>
      <SelectContent>
        {(branches || []).map(b => (
          <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Source Form Dialog ────────────────────────────────────────────────────────
function SourceFormDialog({ open, onClose, initial, onSave, isSaving }) {
  const [form, setForm] = useState(initial || DEFAULT_FORM);

  React.useEffect(() => {
    setForm(initial || DEFAULT_FORM);
  }, [initial, open]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const cc = getColorClasses(form.color);
  const IconComp = ICON_MAP[form.icon] || Banknote;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name_en.trim()) {
      toast.error('English name is required');
      return;
    }
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cc.bg}`}>
              <IconComp className={`w-4 h-4 ${cc.text}`} />
            </div>
            {initial?.id ? 'Edit Sales Source' : 'New Sales Source'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Names */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">Names</h3>
            <div>
              <Label className="text-xs font-semibold mb-1 block">English Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name_en}
                onChange={e => set('name_en', e.target.value)}
                placeholder="e.g. Delivery Revenue"
                className="h-10"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Arabic Name</Label>
              <Input
                value={form.name_ar || ''}
                onChange={e => set('name_ar', e.target.value)}
                placeholder="مثال: إيرادات التوصيل"
                className="h-10 text-right"
                dir="rtl"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Persian Name</Label>
              <Input
                value={form.name_fa || ''}
                onChange={e => set('name_fa', e.target.value)}
                placeholder="مثال: درآمد تحویل"
                className="h-10 text-right"
                dir="rtl"
              />
            </div>
          </div>

          <Separator />

          {/* Appearance */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">Appearance</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Icon</Label>
                <Select value={form.icon} onValueChange={v => set('icon', v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(opt => {
                      const IC = ICON_MAP[opt.value] || Banknote;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <IC className="w-4 h-4" />
                            <span className="text-xs">{opt.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Color</Label>
                <Select value={form.color} onValueChange={v => set('color', v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${opt.bg} border ${opt.border}`} />
                          <span className="text-xs">{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Sort Order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={e => set('sort_order', Number(e.target.value))}
                className="h-10 w-28"
                min={0}
                max={999}
              />
            </div>
          </div>

          <Separator />

          {/* Feature Flags */}
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wide mb-2">Inclusion Flags</h3>
            <ToggleRow
              label="Included in Revenue"
              description="Count this source toward total revenue calculations"
              checked={form.included_in_revenue}
              onChange={v => set('included_in_revenue', v)}
            />
            <Separator className="my-1" />
            <ToggleRow
              label="Included in Cash Register"
              description="Show in cash register and daily cash reconciliation"
              checked={form.included_in_cash_register}
              onChange={v => set('included_in_cash_register', v)}
            />
            <Separator className="my-1" />
            <ToggleRow
              label="Included in Dashboard KPI"
              description="Display as a KPI card on the main dashboard"
              checked={form.included_in_dashboard_kpi}
              onChange={v => set('included_in_dashboard_kpi', v)}
            />
            <Separator className="my-1" />
            <ToggleRow
              label="Included in Profit Calculation"
              description="Include this source when computing net profit"
              checked={form.included_in_profit_calc}
              onChange={v => set('included_in_profit_calc', v)}
            />
          </div>

          <Separator />

          {/* Requirements */}
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wide mb-2">Requirements</h3>
            <ToggleRow
              label="Requires Customer"
              description="A customer must be selected for this sale type"
              checked={form.requires_customer}
              onChange={v => set('requires_customer', v)}
            />
            <Separator className="my-1" />
            <ToggleRow
              label="Requires POS Device"
              description="A POS / network device must be selected"
              checked={form.requires_pos_device}
              onChange={v => set('requires_pos_device', v)}
            />
            <Separator className="my-1" />
            <ToggleRow
              label="Requires Reference Number"
              description="A reference or transaction number must be entered"
              checked={form.requires_reference}
              onChange={v => set('requires_reference', v)}
            />
            <Separator className="my-1" />
            <ToggleRow
              label="Requires Wallet"
              description="Must be linked to a wallet balance"
              checked={form.requires_wallet}
              onChange={v => set('requires_wallet', v)}
            />
          </div>

          <Separator />

          {/* Scoping & Payment */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">Scope & Payment</h3>
            <ToggleRow
              label="Global (All Branches)"
              description="Available to all branches. Disable to restrict to a specific branch."
              checked={form.is_global}
              onChange={v => set('is_global', v)}
            />
            {!form.is_global && (
              <div>
                <Label className="text-xs font-semibold mb-1 block">Branch</Label>
                <BranchSelectInline
                  value={form.branch_id || ''}
                  onChange={v => set('branch_id', v)}
                />
              </div>
            )}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Default Payment Method</Label>
              <Select value={form.default_payment_method} onValueChange={v => set('default_payment_method', v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Description */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Description</Label>
            <Textarea
              value={form.description || ''}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional description of this sale source..."
              rows={2}
              className="text-sm"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="min-w-[100px]">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (initial?.id ? 'Save Changes' : 'Create Source')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SalesSourcesManager() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { ownerFilter, branches } = useTenant();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ── Fetch ───────────────────────────────────────────────────────────────
  const { data: sources = [], isLoading, refetch } = useQuery({
    queryKey: ['sales_sources', ownerFilter?.created_by],
    queryFn: async () => {
      // Owner sees all their sources; filter by created_by for tenant isolation
      const all = await base44.entities.SalesSource.list('sort_order', 200);
      if (ownerFilter?.created_by) {
        return all.filter(s => !s.created_by || s.created_by === ownerFilter.created_by);
      }
      return all;
    },
    staleTime: 30000,
    enabled: !!(ownerFilter?.created_by || user?.email),
  });

  const sorted = useMemo(() =>
    [...sources].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [sources]
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data) => base44.entities.SalesSource.create({ ...data, created_by: user?.email }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales_sources'] }); toast.success('Sales source created'); setDialogOpen(false); },
    onError: (e) => toast.error(`Failed to create: ${e.message}`),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SalesSource.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales_sources'] }); toast.success('Sales source updated'); setDialogOpen(false); },
    onError: (e) => toast.error(`Failed to update: ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.SalesSource.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales_sources'] }); toast.success('Sales source deleted'); setDeleteConfirm(null); },
    onError: (e) => toast.error(`Failed to delete: ${e.message}`),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSave = (formData) => {
    if (editing?.id) {
      updateMut.mutate({ id: editing.id, data: formData });
    } else {
      createMut.mutate(formData);
    }
  };

  const handleEdit = (source) => {
    setEditing(source);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleToggleActive = (source) => {
    updateMut.mutate({ id: source.id, data: { is_active: !source.is_active } });
  };

  const handleDelete = (source) => {
    if (source.is_system) {
      toast.error('System sources cannot be deleted. You can deactivate them instead.');
      return;
    }
    setDeleteConfirm(source);
  };

  const handleMoveUp = (idx) => {
    if (idx === 0) return;
    const a = sorted[idx];
    const b = sorted[idx - 1];
    updateMut.mutate({ id: a.id, data: { sort_order: b.sort_order - 1 } });
  };

  const handleMoveDown = (idx) => {
    if (idx === sorted.length - 1) return;
    const a = sorted[idx];
    const b = sorted[idx + 1];
    updateMut.mutate({ id: a.id, data: { sort_order: b.sort_order + 1 } });
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const activeCount = sources.filter(s => s.is_active).length;
  const revenueCount = sources.filter(s => s.included_in_revenue).length;
  const kpiCount = sources.filter(s => s.included_in_dashboard_kpi).length;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Sales Sources
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure dynamic sale types. These replace hardcoded Cash / Credit / Network types.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleNew} className="h-8 gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Source
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{sources.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Sources</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Active</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{kpiCount}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-bold">In KPI</p>
        </Card>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
        <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-blue-800">System Sources are protected</p>
          <p className="text-[11px] text-blue-700 mt-0.5">
            Cash, Credit, Network, and Other Income are system sources and cannot be deleted, but can be deactivated.
            You can create unlimited custom sources for Delivery, Catering, Talabat, HungerStation, etc.
          </p>
        </div>
      </div>

      {/* Source list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading sales sources...</span>
        </div>
      ) : sorted.length === 0 ? (
        <Card className="p-8 text-center">
          <PlusCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">No sales sources yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Create your first sales source to get started.</p>
          <Button size="sm" onClick={handleNew}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create First Source
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((source, idx) => (
            <SourceCard
              key={source.id}
              source={source}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
              onMoveUp={() => handleMoveUp(idx)}
              onMoveDown={() => handleMoveDown(idx)}
              isFirst={idx === 0}
              isLast={idx === sorted.length - 1}
            />
          ))}
        </div>
      )}

      {/* Suggested sources */}
      <Card className="p-4">
        <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wide mb-3">Suggested Custom Sources</h3>
        <div className="flex flex-wrap gap-2">
          {[
            'Delivery Revenue', 'Catering', 'Wholesale', 'Event Sales',
            'Gift Card', 'Membership', 'Online Store', 'Talabat',
            'HungerStation', 'Jahez', 'Uber Eats', 'Noon Food',
            'Commission Income', 'Rental Income', 'Misc Income',
          ].map(name => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setEditing({ ...DEFAULT_FORM, name_en: name });
                setDialogOpen(true);
              }}
              className="text-xs px-2.5 py-1 rounded-full border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors"
            >
              + {name}
            </button>
          ))}
        </div>
      </Card>

      {/* Form dialog */}
      <SourceFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        initial={editing}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Sales Source
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteConfirm?.name_en}</strong>?
            This cannot be undone. Historical records using this source will retain their data.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMut.mutate(deleteConfirm.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
