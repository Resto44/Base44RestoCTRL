import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Palette } from 'lucide-react';

const ui = {
  en: { brand: 'Brand Settings', brand_name: 'Brand Name', logo: 'Logo', upload_logo: 'Upload Logo', currency: 'Currency', timezone: 'Timezone', color: 'Primary Color (reports)', address: 'Address', save: 'Save Changes', saved: 'Saved!' },
  ar: { brand: 'إعدادات العلامة التجارية', brand_name: 'اسم العلامة التجارية', logo: 'الشعار', upload_logo: 'رفع شعار', currency: 'العملة', timezone: 'المنطقة الزمنية', color: 'اللون الرئيسي (التقارير)', address: 'العنوان', save: 'حفظ التغييرات', saved: 'تم الحفظ!' },
  fa: { brand: 'تنظیمات برند', brand_name: 'نام برند', logo: 'لوگو', upload_logo: 'آپلود لوگو', currency: 'ارز', timezone: 'منطقه زمانی', color: 'رنگ اصلی (گزارش‌ها)', address: 'آدرس', save: 'ذخیره تغییرات', saved: 'ذخیره شد!' },
};

const defaultForm = { brand_name: '', logo_url: '', currency: 'SAR', timezone: 'Asia/Riyadh', primary_color: '#2563EB', address: '' };

export default function BrandSettings() {
  const { lang } = useLanguage();
  const m = ui[lang] || ui.en;
  const qc = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [existingId, setExistingId] = useState(null);

  const { data: brands = [] } = useQuery({ queryKey: ['brand_settings'], queryFn: () => base44.entities.BrandSettings.list() });

  useEffect(() => {
    if (brands.length > 0) {
      const b = brands[0];
      setExistingId(b.id);
      setForm({ brand_name: b.brand_name || '', logo_url: b.logo_url || '', currency: b.currency || 'SAR', timezone: b.timezone || 'Asia/Riyadh', primary_color: b.primary_color || '#2563EB', address: b.address || '' });
    }
  }, [brands]);

  const saveMutation = useMutation({
    mutationFn: (data) => existingId ? base44.entities.BrandSettings.update(existingId, data) : base44.entities.BrandSettings.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['brand_settings'] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, logo_url: file_url }));
    setUploading(false);
  };

  return (
    <div>
      <PageHeader title={m.brand} />

      <div className="space-y-4">
        {form.logo_url && (
          <Card className="p-4 flex items-center gap-4">
            <img src={form.logo_url} alt="logo" className="h-16 w-16 object-contain rounded-lg border" />
            <div>
              <p className="font-medium text-sm">{form.brand_name || '—'}</p>
              <p className="text-xs text-muted-foreground">{form.address}</p>
            </div>
          </Card>
        )}

        <Card className="p-4 space-y-4">
          <div>
            <Label className="text-xs">{m.brand_name}</Label>
            <Input value={form.brand_name} onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">{m.address}</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">{m.logo}</Label>
            <div className="flex items-center gap-2 mt-1">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <span><Upload className="w-4 h-4" />{uploading ? '...' : m.upload_logo}</span>
                </Button>
              </label>
              {form.logo_url && <span className="text-xs text-emerald-600">✓ Uploaded</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{m.currency}</Label>
              <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">{m.timezone}</Label>
              <Input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="Asia/Riyadh" />
            </div>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-2"><Palette className="w-3 h-3" />{m.color}</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="w-10 h-9 rounded border cursor-pointer" />
              <Input value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="w-28" />
            </div>
          </div>
          <Button className="w-full" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
            {saved ? m.saved : m.save}
          </Button>
        </Card>
      </div>
    </div>
  );
}