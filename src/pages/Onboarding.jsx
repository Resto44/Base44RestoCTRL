import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Check, ChevronRight, Building2, GitBranch, Globe, Zap, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const CURRENCIES = ['SAR', 'ر.س', 'AED', '$', '€', '£', 'AFN', '؋'];
const LANGUAGES = [
  { value: 'en', label: 'English', dir: 'ltr', welcome: 'Welcome', sub: "Let's set up your private restaurant workspace" },
  { value: 'ar', label: 'العربية', dir: 'rtl', welcome: 'أهلاً وسهلاً', sub: 'لنقم بإعداد مساحة عمل مطعمك الخاصة' },
  { value: 'fa', label: 'فارسی', dir: 'rtl', welcome: 'خوش آمدید', sub: 'بیایید فضای کاری خصوصی رستوران شما را راه‌اندازی کنیم' },
];

const LABELS = {
  en: {
    step1: 'Language', step2: 'Restaurant', step3: 'Branch', step4: 'Currency',
    restaurantLabel: 'Restaurant Name', restaurantPlaceholder: 'e.g. Al-Nakheel Grill',
    addressLabel: 'Address (optional)', addressPlaceholder: 'City, Country',
    branchLabel: 'First Branch Name', branchPlaceholder: 'e.g. Main Branch',
    currencyLabel: 'Display Currency',
    summaryTitle: 'Your Setup Summary',
    summaryRestaurant: 'Restaurant', summaryBranch: 'Branch', summaryCurrency: 'Currency', summaryLang: 'Language',
    back: 'Back', continue: 'Continue', launch: 'Launch My Dashboard',
    launching: 'Setting up your workspace…',
    privacy: 'Your data is completely private — no one else can access it.',
    required: 'This field is required',
  },
  ar: {
    step1: 'اللغة', step2: 'المطعم', step3: 'الفرع', step4: 'العملة',
    restaurantLabel: 'اسم المطعم', restaurantPlaceholder: 'مثل: مطعم النخيل',
    addressLabel: 'العنوان (اختياري)', addressPlaceholder: 'المدينة، الدولة',
    branchLabel: 'اسم الفرع الأول', branchPlaceholder: 'مثل: الفرع الرئيسي',
    currencyLabel: 'عملة العرض',
    summaryTitle: 'ملخص الإعداد',
    summaryRestaurant: 'المطعم', summaryBranch: 'الفرع', summaryCurrency: 'العملة', summaryLang: 'اللغة',
    back: 'رجوع', continue: 'متابعة', launch: 'إطلاق لوحتي',
    launching: 'جاري إعداد مساحة عملك…',
    privacy: 'بياناتك خاصة تماماً — لا أحد آخر يمكنه الوصول إليها.',
    required: 'هذا الحقل مطلوب',
  },
  fa: {
    step1: 'زبان', step2: 'رستوران', step3: 'فرع', step4: 'ارز',
    restaurantLabel: 'نام رستوران', restaurantPlaceholder: 'مثل: رستوران نخیل',
    addressLabel: 'آدرس (اختیاری)', addressPlaceholder: 'شهر، کشور',
    branchLabel: 'نام اولین فرع', branchPlaceholder: 'مثل: شعبه اصلی',
    currencyLabel: 'ارز نمایش',
    summaryTitle: 'خلاصه تنظیمات',
    summaryRestaurant: 'رستوران', summaryBranch: 'فرع', summaryCurrency: 'ارز', summaryLang: 'زبان',
    back: 'بازگشت', continue: 'ادامه', launch: 'راه‌اندازی داشبوردم',
    launching: 'در حال راه‌اندازی فضای کاری شما…',
    privacy: 'اطلاعات شما کاملاً خصوصی است — هیچ‌کس دیگری به آن دسترسی ندارد.',
    required: 'این فیلد الزامی است',
  },
};

const STEPS = ['step1', 'step2', 'step3', 'step4'];

export default function Onboarding({ onComplete }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('en');
  const [restaurant, setRestaurant] = useState({ name: '', address: '' });
  const [branchLabel, setBranchLabel] = useState('');
  const [currency, setCurrency] = useState('SAR');

  const L = LABELS[lang] || LABELS.en;
  const langMeta = LANGUAGES.find(l => l.value === lang) || LANGUAGES[0];
  const dir = langMeta.dir;

  const stepIcons = [Globe, Building2, GitBranch, DollarSign];
  const stepLabels = [L.step1, L.step2, L.step3, L.step4];

  const validate = () => {
    if (step === 1 && !restaurant.name.trim()) { toast.error(L.required); return false; }
    if (step === 2 && !branchLabel.trim()) { toast.error(L.required); return false; }
    return true;
  };

  const goNext = () => {
    if (!validate()) return;
    if (step === 0) {
      // Apply language immediately to document
      localStorage.setItem('rc_lang', lang);
      document.documentElement.setAttribute('dir', dir);
      document.documentElement.setAttribute('lang', lang);
    }
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      if (!user?.email) throw new Error('Not authenticated — please refresh and try again.');

      // Directly create restaurant (bypasses TenantContext which may not be mounted yet)
      const branchKey = branchLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'main';
      const rest = await base44.entities.Restaurant.create({
        org_id: user.email,
        name: restaurant.name.trim(),
        address: restaurant.address.trim(),
        currency,
        branches: JSON.stringify([{ key: branchKey, label: branchLabel.trim(), is_active: true }]),
      });

      if (!rest?.id) throw new Error('Restaurant creation failed — please try again.');

      // Save locale preferences
      localStorage.setItem('rc_lang', lang);
      localStorage.setItem('rc_currency', currency);
      localStorage.setItem('rc_lang_applied', '1');
      document.documentElement.setAttribute('dir', dir);
      document.documentElement.setAttribute('lang', lang);

      // Ensure profile is fully hydrated before redirecting
      try {
        const profile = await base44.auth.me();
        if (!profile) {
          throw new Error('Profile not found after onboarding');
        }
      } catch (e) {
        console.error('[Onboarding] Profile hydration failed:', e);
        setError('Failed to complete profile setup. Please refresh and try again.');
        toast.error('Profile setup failed — please refresh and try again.');
        setSaving(false);
        return;
      }

      // Clear all cached queries then hard-redirect
      qc.clear();

      // Small delay to ensure cache is cleared before navigation
      await new Promise(r => setTimeout(r, 200));
      window.location.replace('/');
    } catch (e) {
      console.error('[Onboarding] handleFinish error:', e);
      setError(e.message || 'Something went wrong. Please try again.');
      toast.error(e.message || 'Setup failed — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4" dir={dir}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">
            {langMeta.welcome}{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-slate-400 text-sm mt-1">{langMeta.sub}</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-1.5 mb-8 flex-wrap">
          {STEPS.map((_, i) => {
            const Icon = stepIcons[i];
            return (
              <React.Fragment key={i}>
                <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  i === step ? 'bg-primary text-primary-foreground' :
                  i < step ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'
                }`}>
                  {i < step ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  <span className="hidden sm:inline">{stepLabels[i]}</span>
                </div>
                {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step Content */}
        <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-sm">

          {/* Step 0: Language */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-5 h-5 text-primary" />
                <h2 className="text-white font-bold text-lg">{L.step1}</h2>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {LANGUAGES.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setLang(l.value)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      lang === l.value ? 'border-primary bg-primary/20 text-white' : 'border-white/20 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                    dir={l.dir}
                  >
                    {lang === l.value && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                    {lang !== l.value && <span className="w-4" />}
                    <span className="font-semibold">{l.label}</span>
                  </button>
                ))}
              </div>
              <Button className="w-full" onClick={goNext}>
                {L.continue} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 1: Restaurant */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="text-white font-bold text-lg">{L.step2}</h2>
              </div>
              <div>
                <Label className="text-slate-300 text-sm">{L.restaurantLabel} *</Label>
                <Input
                  className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-slate-500"
                  placeholder={L.restaurantPlaceholder}
                  value={restaurant.name}
                  onChange={e => setRestaurant(r => ({ ...r, name: e.target.value }))}
                  dir={dir}
                />
              </div>
              <div>
                <Label className="text-slate-300 text-sm">{L.addressLabel}</Label>
                <Input
                  className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-slate-500"
                  placeholder={L.addressPlaceholder}
                  value={restaurant.address}
                  onChange={e => setRestaurant(r => ({ ...r, address: e.target.value }))}
                  dir={dir}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-white/20 text-slate-300 hover:bg-white/10" onClick={() => setStep(0)}>{L.back}</Button>
                <Button className="flex-1" onClick={goNext}>{L.continue} <ChevronRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* Step 2: Branch */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <GitBranch className="w-5 h-5 text-primary" />
                <h2 className="text-white font-bold text-lg">{L.step3}</h2>
              </div>
              <p className="text-slate-400 text-sm">
                {restaurant.name && <span className="text-white font-medium">{restaurant.name} — </span>}
                {L.branchLabel}
              </p>
              <div>
                <Label className="text-slate-300 text-sm">{L.branchLabel} *</Label>
                <Input
                  className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-slate-500"
                  placeholder={L.branchPlaceholder}
                  value={branchLabel}
                  onChange={e => setBranchLabel(e.target.value)}
                  dir={dir}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-white/20 text-slate-300 hover:bg-white/10" onClick={() => setStep(1)}>{L.back}</Button>
                <Button className="flex-1" onClick={goNext}>{L.continue} <ChevronRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* Step 3: Currency + Summary */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-primary" />
                <h2 className="text-white font-bold text-lg">{L.step4}</h2>
              </div>
              <div>
                <Label className="text-slate-300 text-sm">{L.currencyLabel}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {CURRENCIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                        currency === c ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/20 text-slate-300 hover:bg-white/10'
                      }`}
                    >{c}</button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-white/5 rounded-xl p-4 space-y-2 border border-white/10">
                <p className="text-slate-300 text-xs font-semibold uppercase tracking-wide">{L.summaryTitle}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{L.summaryRestaurant}</span>
                  <span className="text-white font-medium">{restaurant.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{L.summaryBranch}</span>
                  <span className="text-white font-medium">{branchLabel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{L.summaryCurrency}</span>
                  <span className="text-white font-medium">{currency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{L.summaryLang}</span>
                  <span className="text-white font-medium">{langMeta.label}</span>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-500/20 border border-red-500/40 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-white/20 text-slate-300 hover:bg-white/10" onClick={() => setStep(2)} disabled={saving}>{L.back}</Button>
                <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold" onClick={handleFinish} disabled={saving}>
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      {L.launching}
                    </span>
                  ) : `🚀 ${L.launch}`}
                </Button>
              </div>
            </div>
          )}
        </Card>

        <p className="text-center text-slate-600 text-xs mt-4">{L.privacy}</p>
      </div>
    </div>
  );
}