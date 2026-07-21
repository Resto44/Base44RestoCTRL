import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/lib/TenantContext';
import { useRole } from '@/lib/RoleContext';
import { useLanguage } from '@/lib/LanguageContext';
import { formatCurrency } from '@/lib/helpers';
import PageHeader from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  GitBranch, Plus, Pencil, Trash2, Users, TrendingUp, DollarSign,
  ShoppingCart, Receipt, MapPin, Phone, Clock, UserCheck, UserX,
  BarChart3, AlertTriangle, CheckCircle2, Building2, Mail
} from 'lucide-react';
import { subDays, format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';

const UI = {
  en: {
    title: 'Branch Management Center',
    subtitle: 'Manage branches, assign managers, monitor performance',
    add_branch: 'Add Branch',
    edit_branch: 'Edit Branch',
    delete_branch: 'Delete Branch',
    branch_name: 'Branch Name',
    branch_address: 'Address',
    branch_phone: 'Phone',
    working_hours: 'Working Hours',
    manager_email: 'Manager Email',
    manager_name: 'Manager Name',
    invite_manager: 'Invite Manager',
    active: 'Active',
    inactive: 'Inactive',
    no_branches: 'No branches yet. Add your first branch.',
    performance: 'Performance (30d)',
    sales: 'Sales',
    expenses: 'Expenses',
    purchases: 'Purchases',
    employees: 'Employees',
    no_manager: 'No Manager Assigned',
    save: 'Save',
    cancel: 'Cancel',
    delete_confirm: 'This will remove the branch permanently.',
    overview: 'Overview',
    analytics: 'Analytics',
    managers: 'Managers',
    compare: 'Compare',
    status: 'Status',
    branch_key: 'Branch Key (unique ID)',
    owner_only: 'Owner access required.',
    all_branches: 'All Branches',
    top_branch: 'Top Branch',
    total_sales_30: 'Total Sales (30d)',
    manager_assigned: 'Manager Assigned',
    not_assigned: 'Not Assigned',
    invite_sent: 'Manager invited successfully!',
    already_active: 'This branch is already active.',
    disable_branch: 'Disable Branch',
    enable_branch: 'Enable Branch',
  },
  ar: {
    title: 'مركز إدارة الفروع',
    subtitle: 'إدارة الفروع، تعيين المديرين، مراقبة الأداء',
    add_branch: 'إضافة فرع',
    edit_branch: 'تعديل الفرع',
    delete_branch: 'حذف الفرع',
    branch_name: 'اسم الفرع',
    branch_address: 'العنوان',
    branch_phone: 'الهاتف',
    working_hours: 'ساعات العمل',
    manager_email: 'بريد المدير',
    manager_name: 'اسم المدير',
    invite_manager: 'دعوة مدير',
    active: 'نشط',
    inactive: 'غير نشط',
    no_branches: 'لا توجد فروع بعد. أضف أول فرع.',
    performance: 'الأداء (30 يوم)',
    sales: 'المبيعات',
    expenses: 'المصاريف',
    purchases: 'المشتريات',
    employees: 'الموظفون',
    no_manager: 'لم يُعيَّن مدير',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete_confirm: 'سيتم حذف الفرع بشكل دائم.',
    overview: 'نظرة عامة',
    analytics: 'التحليلات',
    managers: 'المديرون',
    compare: 'مقارنة',
    status: 'الحالة',
    branch_key: 'معرف الفرع (فريد)',
    owner_only: 'يتطلب صلاحية المالك.',
    all_branches: 'جميع الفروع',
    top_branch: 'أفضل فرع',
    total_sales_30: 'إجمالي المبيعات (30 يوم)',
    manager_assigned: 'تم تعيين مدير',
    not_assigned: 'غير مُعيَّن',
    invite_sent: 'تم دعوة المدير بنجاح!',
    already_active: 'هذا الفرع نشط بالفعل.',
    disable_branch: 'تعطيل الفرع',
    enable_branch: 'تفعيل الفرع',
  },
  fa: {
    title: 'مرکز مدیریت شعب',
    subtitle: 'مدیریت شعب، تخصیص مدیران، نظارت بر عملکرد',
    add_branch: 'افزودن شعبه',
    edit_branch: 'ویرایش شعبه',
    delete_branch: 'حذف شعبه',
    branch_name: 'نام شعبه',
    branch_address: 'آدرس',
    branch_phone: 'تلفن',
    working_hours: 'ساعت کاری',
    manager_email: 'ایمیل مدیر',
    manager_name: 'نام مدیر',
    invite_manager: 'دعوت مدیر',
    active: 'فعال',
    inactive: 'غیرفعال',
    no_branches: 'هنوز شعبه‌ای ندارید. اولین شعبه را اضافه کنید.',
    performance: 'عملکرد (۳۰ روز)',
    sales: 'فروش',
    expenses: 'هزینه‌ها',
    purchases: 'خریدها',
    employees: 'کارمندان',
    no_manager: 'مدیری تخصیص نیافته',
    save: 'ذخیره',
    cancel: 'لغو',
    delete_confirm: 'این شعبه به طور دائم حذف خواهد شد.',
    overview: 'نمای کلی',
    analytics: 'تحلیل‌ها',
    managers: 'مدیران',
    compare: 'مقایسه',
    status: 'وضعیت',
    branch_key: 'کلید شعبه (یکتا)',
    owner_only: 'دسترسی مالک لازم است.',
    all_branches: 'همه شعبه‌ها',
    top_branch: 'برترین شعبه',
    total_sales_30: 'کل فروش (۳۰ روز)',
    manager_assigned: 'مدیر تخصیص یافته',
    not_assigned: 'تخصیص نیافته',
    invite_sent: 'مدیر با موفقیت دعوت شد!',
    already_active: 'این شعبه از قبل فعال است.',
    disable_branch: 'غیرفعال کردن',
    enable_branch: 'فعال کردن',
  },
};

const EMPTY_BRANCH = { key: '', label: '', address: '', phone: '', working_hours: '', manager_email: '', manager_name: '', is_active: true };

function BranchForm({ initial, onSubmit, onCancel, u, saving }) {
  const [form, setForm] = useState(initial || EMPTY_BRANCH);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!initial?.key;

  return (
    <div className="space-y-3">
      <div>
        <Label>{u.branch_name} *</Label>
        <Input value={form.label} onChange={e => { set('label', e.target.value); if (!isEdit) set('key', e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')); }} />
      </div>
      {!isEdit && (
        <div>
          <Label>{u.branch_key}</Label>
          <Input value={form.key} onChange={e => set('key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="branch_1" />
        </div>
      )}
      <div>
        <Label><MapPin className="w-3 h-3 inline mr-1" />{u.branch_address}</Label>
        <Input value={form.address || ''} onChange={e => set('address', e.target.value)} />
      </div>
      <div>
        <Label><Phone className="w-3 h-3 inline mr-1" />{u.branch_phone}</Label>
        <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
      </div>
      <div>
        <Label><Clock className="w-3 h-3 inline mr-1" />{u.working_hours}</Label>
        <Input value={form.working_hours || ''} onChange={e => set('working_hours', e.target.value)} placeholder="9:00 AM - 11:00 PM" />
      </div>
      <div className="border-t pt-3">
        <Label><Mail className="w-3 h-3 inline mr-1" />{u.manager_email}</Label>
        <Input type="email" value={form.manager_email || ''} onChange={e => set('manager_email', e.target.value)} />
      </div>
      <div>
        <Label><UserCheck className="w-3 h-3 inline mr-1" />{u.manager_name}</Label>
        <Input value={form.manager_name || ''} onChange={e => set('manager_name', e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.is_active !== false} onCheckedChange={v => set('is_active', v)} />
        <Label>{form.is_active !== false ? u.active : u.inactive}</Label>
      </div>
      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={() => form.label.trim() && onSubmit(form)} disabled={saving || !form.label.trim()}>{u.save}</Button>
        <Button variant="outline" onClick={onCancel}>{u.cancel}</Button>
      </div>
    </div>
  );
}

export default function BranchManagement() {
  const { lang, currency } = useLanguage();
  const u = UI[lang] || UI.en;
  const { role } = useRole();
  const { allBranches, updateRestaurantBranches, ownerFilter } = useTenant();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const { data: sales = [] } = useQuery({
    queryKey: ['bm_sales', ownerFilter],
    queryFn: () => base44.entities.DailySales.filter(ownerFilter || {}, '-date', 1000),
    staleTime: 120000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['bm_expenses', ownerFilter],
    queryFn: () => base44.entities.Expense.filter(ownerFilter || {}, '-date', 500),
    staleTime: 120000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });
  const { data: purchases = [] } = useQuery({
    queryKey: ['bm_purchases', ownerFilter],
    queryFn: () => base44.entities.Purchase.filter(ownerFilter || {}, '-date', 500),
    staleTime: 120000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['bm_employees', ownerFilter],
    queryFn: () => base44.entities.Employee.filter(ownerFilter || {}, 'full_name', 200),
    staleTime: 120000,
    enabled: !!(ownerFilter?.created_by || ownerFilter?.branch),
  });

  const recentSales = sales.filter(s => s.date >= thirtyDaysAgo);
  const recentExpenses = expenses.filter(e => e.date >= thirtyDaysAgo);
  const recentPurchases = purchases.filter(p => p.date >= thirtyDaysAgo);

  const branchStats = useMemo(() => {
    return allBranches.map(b => {
      const bSales = recentSales.filter(s => s.branch === b.key);
      const bExpenses = recentExpenses.filter(e => e.branch === b.key || e.branch === 'all');
      const bPurchases = recentPurchases.filter(p => p.branch === b.key);
      const bEmployees = employees.filter(e => e.branch === b.key);
      const totalSales = bSales.reduce((s, r) => s + (r.cash || 0) + (r.network || 0) + (r.credit || 0), 0);
      const totalExpenses = bExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const totalPurchases = bPurchases.reduce((s, p) => s + ((p.used_price || p.current_price || 0) * (p.qty || 1)), 0);
      return { ...b, totalSales, totalExpenses, totalPurchases, employeeCount: bEmployees.length };
    });
  }, [allBranches, recentSales, recentExpenses, recentPurchases, employees]);

  const compareData = branchStats.map(b => ({
    name: b.label,
    [u.sales]: Math.round(b.totalSales),
    [u.expenses]: Math.round(b.totalExpenses),
    [u.purchases]: Math.round(b.totalPurchases),
  }));

  const topBranch = branchStats.length > 0 ? [...branchStats].sort((a, b) => b.totalSales - a.totalSales)[0] : null;

  const handleSaveBranch = async (form) => {
    setSaving(true);
    try {
      const key = form.key || form.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (editing) {
        const updated = allBranches.map(b => b.key === editing.key ? { ...b, ...form, key: b.key } : b);
        await updateRestaurantBranches(updated);
        toast.success(u.edit_branch);
      } else {
        if (allBranches.find(b => b.key === key)) {
          toast.error('Branch key already exists. Use a different name.');
          return;
        }
        await updateRestaurantBranches([...allBranches, { ...form, key }]);
        toast.success(u.add_branch);
      }
      setShowForm(false);
      setEditing(null);
    } catch (error) {
      console.error('[BranchManagement] branch save failed', error);
      toast.error(error.message || 'Unable to save this branch.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await updateRestaurantBranches(allBranches.filter(b => b.key !== deleting.key));
      setDeleting(null);
      toast.success(u.delete_branch);
    } catch (error) {
      console.error('[BranchManagement] branch delete failed', error);
      toast.error(error.message || 'Unable to delete this branch.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (branchKey) => {
    try {
      await updateRestaurantBranches(allBranches.map(b => b.key === branchKey ? { ...b, is_active: !b.is_active } : b));
    } catch (error) {
      console.error('[BranchManagement] branch status update failed', error);
      toast.error(error.message || 'Unable to update this branch.');
    }
  };

  if (role !== 'owner') {
    return <div className="p-8 text-center text-muted-foreground">{u.owner_only}</div>;
  }

  return (
    <div>
      <PageHeader
        title={u.title}
        action={
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-1" /> {u.add_branch}
          </Button>
        }
      />
      <p className="text-xs text-muted-foreground mb-4">{u.subtitle}</p>

      <Tabs defaultValue="overview">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="overview" className="flex-1 text-xs"><GitBranch className="w-3 h-3 mr-1" />{u.overview}</TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1 text-xs"><BarChart3 className="w-3 h-3 mr-1" />{u.analytics}</TabsTrigger>
          <TabsTrigger value="compare" className="flex-1 text-xs"><TrendingUp className="w-3 h-3 mr-1" />{u.compare}</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ── */}
        <TabsContent value="overview">
          {/* Summary KPIs */}
          {branchStats.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{u.all_branches}</p>
                <p className="text-2xl font-black text-primary">{branchStats.length}</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{u.top_branch}</p>
                <p className="text-sm font-bold truncate">{topBranch?.label || '—'}</p>
              </Card>
              <Card className="p-3 text-center col-span-2">
                <p className="text-xs text-muted-foreground">{u.total_sales_30}</p>
                <p className="text-xl font-black text-emerald-600">
                  {formatCurrency(branchStats.reduce((s, b) => s + b.totalSales, 0), currency)}
                </p>
              </Card>
            </div>
          )}

          {/* Branch Cards */}
          {allBranches.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">{u.no_branches}</p>
              <Button size="sm" className="mt-3" onClick={() => setShowForm(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {u.add_branch}
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {branchStats.map(b => {
                const stats = branchStats.find(s => s.key === b.key) || b;
                return (
                  <Card key={b.key} className={`p-4 ${b.is_active === false ? 'opacity-60' : ''}`}>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <GitBranch className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm truncate">{b.label}</p>
                            <Badge className={`text-[10px] shrink-0 ${b.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                              {b.is_active !== false ? u.active : u.inactive}
                            </Badge>
                          </div>
                          {b.address && <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><MapPin className="w-2.5 h-2.5 shrink-0" />{b.address}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(b); setShowForm(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleting(b)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">{u.sales}</p>
                        <p className="text-xs font-bold text-emerald-700">{formatCurrency(stats.totalSales, currency)}</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">{u.expenses}</p>
                        <p className="text-xs font-bold text-red-600">{formatCurrency(stats.totalExpenses, currency)}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">{u.employees}</p>
                        <p className="text-xs font-bold">{stats.employeeCount}</p>
                      </div>
                    </div>

                    {/* Manager row */}
                    <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {b.manager_email ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{b.manager_name || b.manager_email}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <p className="text-xs text-muted-foreground">{u.no_manager}</p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="hidden text-[10px] text-muted-foreground sm:inline">Staff are assigned from Owner Dashboard</span>
                        <Switch checked={b.is_active !== false} onCheckedChange={() => handleToggle(b.key)} />
                      </div>
                    </div>

                    {/* Extra info */}
                    {(b.phone || b.working_hours) && (
                      <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                        {b.phone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" /> {b.phone}</span>}
                        {b.working_hours && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {b.working_hours}</span>}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── ANALYTICS TAB ── */}
        <TabsContent value="analytics">
          <div className="space-y-3">
            {branchStats.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">{u.no_branches}</p>
              </Card>
            ) : (
              branchStats.map(b => {
                const profit = b.totalSales - b.totalExpenses - b.totalPurchases;
                return (
                  <Card key={b.key} className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <GitBranch className="w-4 h-4 text-primary" />
                      <p className="font-semibold text-sm">{b.label}</p>
                      <Badge className={`text-[10px] ${b.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                        {b.is_active !== false ? u.active : u.inactive}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><DollarSign className="w-2.5 h-2.5" />{u.sales}</p>
                        <p className="text-sm font-bold text-emerald-600">{formatCurrency(b.totalSales, currency)}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Receipt className="w-2.5 h-2.5" />{u.expenses}</p>
                        <p className="text-sm font-bold text-red-500">{formatCurrency(b.totalExpenses, currency)}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><ShoppingCart className="w-2.5 h-2.5" />{u.purchases}</p>
                        <p className="text-sm font-bold text-amber-600">{formatCurrency(b.totalPurchases, currency)}</p>
                      </div>
                      <div className={`rounded-lg p-2 ${profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          {profit >= 0 ? <TrendingUp className="w-2.5 h-2.5 text-emerald-600" /> : <AlertTriangle className="w-2.5 h-2.5 text-red-500" />}
                          Profit
                        </p>
                        <p className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(profit, currency)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{b.employeeCount} {u.employees}</span>
                      {b.manager_email && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span className="truncate">{b.manager_name || b.manager_email}</span>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* ── COMPARE TAB ── */}
        <TabsContent value="compare">
          {compareData.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">{u.no_branches}</p>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="p-4">
                <p className="text-xs font-semibold mb-3">{u.performance}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={compareData} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${currency}${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => formatCurrency(v, currency)} />
                    <Bar dataKey={u.sales} fill="#10b981" radius={[2, 2, 0, 0]} />
                    <Bar dataKey={u.expenses} fill="#ef4444" radius={[2, 2, 0, 0]} />
                    <Bar dataKey={u.purchases} fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Ranking table */}
              <Card className="p-4">
                <p className="text-xs font-semibold mb-3">Branch Ranking by Sales</p>
                <div className="space-y-2">
                  {[...branchStats].sort((a, b) => b.totalSales - a.totalSales).map((b, i) => {
                    const max = branchStats[0]?.totalSales || 1;
                    const pct = branchStats.reduce((s, x) => s + x.totalSales, 0) > 0
                      ? (b.totalSales / branchStats.reduce((s, x) => s + x.totalSales, 0) * 100)
                      : 0;
                    return (
                      <div key={b.key} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="font-medium truncate">{b.label}</span>
                            <span className="text-muted-foreground shrink-0 ml-1">{formatCurrency(b.totalSales, currency)}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Branch Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? u.edit_branch : u.add_branch}</DialogTitle>
          </DialogHeader>
          <BranchForm
            initial={editing}
            u={u}
            saving={saving}
            onSubmit={handleSaveBranch}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleting} onOpenChange={v => { if (!v) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{u.delete_branch}: {deleting?.label}?</AlertDialogTitle>
            <AlertDialogDescription>{u.delete_confirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{u.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving}>{u.delete_branch}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}