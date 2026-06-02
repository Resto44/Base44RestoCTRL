import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Plus, Search, Pencil, Trash2, Star, ToggleLeft, ToggleRight, Package
} from 'lucide-react';

const ICONS = ['🍽', '🥩', '🥦', '🧴', '🧹', '💡', '🔧', '📦', '🛒', '💰', '👗', '🎯'];
const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
];

const CATEGORY_TYPES = {
  en: ['Food & Ingredients', 'Beverages', 'Packaging', 'Cleaning', 'Utilities', 'Maintenance', 'Equipment', 'Staff Supplies', 'Marketing', 'Other'],
  ar: ['طعام ومكونات', 'مشروبات', 'تغليف', 'تنظيف', 'خدمات', 'صيانة', 'معدات', 'مستلزمات موظفين', 'تسويق', 'أخرى'],
  fa: ['مواد غذایی', 'نوشیدنی‌ها', 'بسته‌بندی', 'نظافت', 'آب و برق', 'تعمیرات', 'تجهیزات', 'لوازم کارمندان', 'بازاریابی', 'سایر'],
};

const UI = {
  en: {
    title: 'Category Manager',
    subtitle: 'Manage purchase & inventory categories',
    add: 'Add Category',
    edit: 'Edit Category',
    search: 'Search categories...',
    name_en: 'Name (English)',
    name_ar: 'Name (Arabic)',
    name_fa: 'Name (Persian)',
    icon: 'Icon',
    color: 'Color',
    type: 'Type',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    delete_confirm: 'Delete this category?',
    delete_desc: 'This cannot be undone.',
    favorites: 'Favorites',
    all: 'All Categories',
    active: 'Active',
    inactive: 'Inactive',
    no_categories: 'No categories yet. Add your first one!',
    spending: 'Total Spending',
    analytics: 'Category Analytics',
    top_category: 'Top Category',
    categories_count: 'Categories',
  },
  ar: {
    title: 'إدارة الفئات',
    subtitle: 'إدارة فئات المشتريات والمخزون',
    add: 'إضافة فئة',
    edit: 'تعديل الفئة',
    search: 'ابحث عن الفئات...',
    name_en: 'الاسم (إنجليزي)',
    name_ar: 'الاسم (عربي)',
    name_fa: 'الاسم (فارسي)',
    icon: 'الأيقونة',
    color: 'اللون',
    type: 'النوع',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    delete_confirm: 'حذف هذه الفئة؟',
    delete_desc: 'لا يمكن التراجع عن هذا الإجراء.',
    favorites: 'المفضلة',
    all: 'جميع الفئات',
    active: 'نشط',
    inactive: 'غير نشط',
    no_categories: 'لا توجد فئات بعد. أضف أول فئة!',
    spending: 'إجمالي الإنفاق',
    analytics: 'تحليلات الفئات',
    top_category: 'أعلى فئة',
    categories_count: 'فئات',
  },
  fa: {
    title: 'مدیریت دسته‌بندی',
    subtitle: 'مدیریت دسته‌بندی‌های خرید و انبار',
    add: 'افزودن دسته',
    edit: 'ویرایش دسته',
    search: 'جستجوی دسته‌بندی...',
    name_en: 'نام (انگلیسی)',
    name_ar: 'نام (عربی)',
    name_fa: 'نام (فارسی)',
    icon: 'آیکون',
    color: 'رنگ',
    type: 'نوع',
    save: 'ذخیره',
    cancel: 'لغو',
    delete: 'حذف',
    delete_confirm: 'این دسته حذف شود؟',
    delete_desc: 'این عمل قابل برگشت نیست.',
    favorites: 'موردعلاقه‌ها',
    all: 'همه دسته‌ها',
    active: 'فعال',
    inactive: 'غیرفعال',
    no_categories: 'هنوز دسته‌ای ندارید. اولین را اضافه کنید!',
    spending: 'مجموع هزینه',
    analytics: 'تحلیل دسته‌ها',
    top_category: 'دسته برتر',
    categories_count: 'دسته‌بندی',
  },
};

function CategoryForm({ category, onSave, onCancel, lang }) {
  const u = UI[lang] || UI.en;
  const types = CATEGORY_TYPES[lang] || CATEGORY_TYPES.en;
  const [form, setForm] = useState({
    name_en: category?.name_en || '',
    name_ar: category?.name_ar || '',
    name_fa: category?.name_fa || '',
    icon: category?.icon || '📦',
    color: category?.color || '#3B82F6',
    type: category?.type || types[0],
    is_active: category?.is_active !== false,
    is_favorite: category?.is_favorite || false,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name_en && !form.name_ar && !form.name_fa) return;
    onSave(form);
  };

  return (
    <div className="space-y-4">
      {/* Icon & Color row */}
      <div className="flex gap-3 items-start">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{u.icon}</label>
          <div className="flex flex-wrap gap-1.5 max-w-[180px]">
            {ICONS.map(ic => (
              <button key={ic}
                onClick={() => set('icon', ic)}
                className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-all ${form.icon === ic ? 'border-primary bg-primary/10 scale-110' : 'border-transparent bg-muted hover:border-border'}`}>
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{u.color}</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button key={c}
                onClick={() => set('color', c)}
                style={{ backgroundColor: c }}
                className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: form.color + '20', border: `2px solid ${form.color}40` }}>
          {form.icon}
        </div>
        <div>
          <div className="font-semibold text-sm">{form[`name_${lang}`] || form.name_en || '—'}</div>
          <div className="text-xs text-muted-foreground">{form.type}</div>
        </div>
      </div>

      {/* Names */}
      <div className="space-y-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">{u.name_en}</label>
          <Input value={form.name_en} onChange={e => set('name_en', e.target.value)} className="mt-1" placeholder="e.g. Cleaning Supplies" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{u.name_ar}</label>
          <Input value={form.name_ar} onChange={e => set('name_ar', e.target.value)} className="mt-1 text-right" dir="rtl" placeholder="مواد التنظيف" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{u.name_fa}</label>
          <Input value={form.name_fa} onChange={e => set('name_fa', e.target.value)} className="mt-1 text-right" dir="rtl" placeholder="مواد نظافتی" />
        </div>
      </div>

      {/* Type */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">{u.type}</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {types.map(t => (
            <button key={t}
              onClick={() => set('type', t)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${form.type === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card hover:bg-muted'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>{u.cancel}</Button>
        <Button onClick={handleSave}>{u.save}</Button>
      </DialogFooter>
    </div>
  );
}

function CategoryCard({ cat, lang, onEdit, onDelete, onToggleFavorite, onToggleActive }) {
  const name = cat[`name_${lang}`] || cat.name_en || cat.name_ar || cat.name_fa || '—';
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border bg-card transition-all hover:shadow-md ${!cat.is_active ? 'opacity-50' : ''}`}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ backgroundColor: (cat.color || '#3B82F6') + '20', border: `2px solid ${(cat.color || '#3B82F6')}40` }}>
        {cat.icon || '📦'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{name}</div>
        <div className="text-xs text-muted-foreground truncate">{cat.type}</div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onToggleFavorite(cat)}
          className={`p-1.5 rounded-lg transition-colors ${cat.is_favorite ? 'text-amber-500 bg-amber-50' : 'text-muted-foreground hover:text-amber-500 hover:bg-amber-50'}`}>
          <Star className="w-3.5 h-3.5" fill={cat.is_favorite ? 'currentColor' : 'none'} />
        </button>
        <button onClick={() => onToggleActive(cat)}
          className={`p-1.5 rounded-lg transition-colors ${cat.is_active ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-50'}`}>
          {cat.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
        </button>
        <button onClick={() => onEdit(cat)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(cat)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function CategoryManager() {
  const { lang } = useLanguage();
  const { ownerFilter } = useTenant();
  const u = UI[lang] || UI.en;
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['purchase_categories', ownerFilter],
    queryFn: () => base44.entities.PurchaseCategory.filter(ownerFilter, 'name_en', 100),
    staleTime: 30000,
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['purchases_for_analytics', ownerFilter],
    queryFn: () => base44.entities.Purchase.filter(ownerFilter, '-date', 200),
    staleTime: 60000,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.PurchaseCategory.update(editing.id, data)
      : base44.entities.PurchaseCategory.create({ ...data, ...ownerFilter }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase_categories'] }); setShowForm(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PurchaseCategory.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase_categories'] }); setDeleteTarget(null); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PurchaseCategory.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase_categories'] }),
  });

  // Analytics: spending per category name
  const spendingMap = useMemo(() => {
    const map = {};
    purchases.forEach(p => {
      const k = p.category || 'other';
      map[k] = (map[k] || 0) + ((p.qty || 0) * (p.used_price || p.current_price || 0));
    });
    return map;
  }, [purchases]);

  const totalSpending = Object.values(spendingMap).reduce((a, b) => a + b, 0);

  const filtered = useMemo(() => {
    let list = categories;
    if (activeTab === 'favorites') list = list.filter(c => c.is_favorite);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.name_en || '').toLowerCase().includes(q) ||
        (c.name_ar || '').includes(q) ||
        (c.name_fa || '').includes(q)
      );
    }
    return list;
  }, [categories, activeTab, search]);

  const topCategory = useMemo(() => {
    const top = Object.entries(spendingMap).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    return { name: top[0], amount: top[1] };
  }, [spendingMap]);

  const handleEdit = (cat) => { setEditing(cat); setShowForm(true); };
  const handleDelete = (cat) => setDeleteTarget(cat);
  const handleToggleFavorite = (cat) => toggleMutation.mutate({ id: cat.id, data: { is_favorite: !cat.is_favorite } });
  const handleToggleActive = (cat) => toggleMutation.mutate({ id: cat.id, data: { is_active: !cat.is_active } });

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">{u.title}</h1>
          <p className="text-sm text-muted-foreground">{u.subtitle}</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> {u.add}
        </Button>
      </div>

      {/* Analytics row */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{u.categories_count}</div>
          <div className="text-xl font-bold mt-0.5">{categories.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{u.spending}</div>
          <div className="text-lg font-bold mt-0.5 truncate">{totalSpending.toLocaleString()}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{u.top_category}</div>
          <div className="text-sm font-bold mt-0.5 truncate">{topCategory?.name || '—'}</div>
        </Card>
      </div>

      {/* Search + tabs */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={u.search}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'favorites'].map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {tab === 'all' ? u.all : u.favorites}
            </button>
          ))}
        </div>
      </div>

      {/* Category list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{u.no_categories}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cat => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              lang={lang}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? u.edit : u.add}</DialogTitle>
          </DialogHeader>
          <CategoryForm
            category={editing}
            lang={lang}
            onSave={(data) => saveMutation.mutate(data)}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{u.delete_confirm}</AlertDialogTitle>
            <AlertDialogDescription>{u.delete_desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{u.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {u.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}