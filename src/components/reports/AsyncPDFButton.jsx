/**
 * AsyncPDFButton — triggers ultimate 10-page PDF with live progress indicator.
 * Uses generateUltimatePDF which saves the file directly via jsPDF.
 */
import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { generateUltimatePDF } from '@/lib/pdfGenerator';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

const STATUS = { idle: 'idle', generating: 'generating', done: 'done', error: 'error' };

export default function AsyncPDFButton({ sales, purchases, expenses, rangeType, fromStr, toStr }) {
  const { t, currency, lang, dir } = useLanguage();
  const { branches, activeRestaurant } = useTenant();
  const [status, setStatus] = useState(STATUS.idle);
  const [step, setStep] = useState('');
  const [error, setError] = useState(null);

  const { data: brandSettingsList = [] } = useQuery({
    queryKey: ['brand_settings'],
    queryFn: () => base44.entities.BrandSettings.list(),
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => base44.entities.Inventory.list('-date', 5000),
  });
  const { data: supplierInvoices = [] } = useQuery({
    queryKey: ['all_invoices'],
    queryFn: () => base44.entities.SupplierInvoice.list('-date', 500),
  });

  const brandSettings = brandSettingsList[0] || null;

  const steps = lang === 'fa'
    ? ['بارگذاری فونت...', 'محاسبه متریک‌ها...', 'رندر صفحه ۱-۳...', 'رندر صفحه ۴-۶...', 'رندر صفحه ۷-۱۰...', 'ذخیره PDF...']
    : lang === 'ar'
    ? ['تحميل الخط...', 'حساب المقاييس...', 'رسم ص ١-٣...', 'رسم ص ٤-٦...', 'رسم ص ٧-١٠...', 'حفظ PDF...']
    : ['Loading font...', 'Computing metrics...', 'Rendering p.1-3...', 'Rendering p.4-6...', 'Rendering p.7-10...', 'Saving PDF...'];

  const handleGenerate = useCallback(async () => {
    setStatus(STATUS.generating);
    setError(null);

    // Animate through steps while generating
    let stepIdx = 0;
    setStep(steps[0]);
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      setStep(steps[stepIdx]);
    }, 1400);

    try {
      await generateUltimatePDF({
        sales, purchases, expenses, rangeType, fromStr, toStr,
        t, lang, currency,
        branches: branches.length > 0 ? branches : [{ key: 'main', label: 'Main Branch' }],
        dir,
        brandSettings,
        inventory,
        supplierInvoices,
      });
      clearInterval(interval);
      setStep(steps[steps.length - 1]);
      setStatus(STATUS.done);
    } catch (e) {
      clearInterval(interval);
      console.error('PDF generation failed:', e);
      setError(e.message || 'Generation failed');
      setStatus(STATUS.error);
    }
  }, [sales, purchases, expenses, inventory, supplierInvoices, branches, rangeType, fromStr, toStr, currency, lang, dir, brandSettings, t]);

  const reset = () => { setStatus(STATUS.idle); setError(null); setStep(''); };

  if (status === STATUS.idle) {
    return (
      <Button size="sm" onClick={handleGenerate} className="gap-1.5">
        <FileDown className="w-4 h-4" />
        {lang === 'fa' ? 'دانلود PDF ۱۰ صفحه' : lang === 'ar' ? 'تقرير PDF 10 صفحات' : 'Export 10-Page PDF'}
      </Button>
    );
  }

  if (status === STATUS.generating) {
    const pct = Math.round((steps.indexOf(step) / (steps.length - 1)) * 100);
    return (
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 min-w-60">
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-blue-700 truncate">{step}</p>
          <div className="w-full bg-blue-200 rounded-full h-1.5 mt-1">
            <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-blue-500 mt-0.5">{pct}%</p>
        </div>
      </div>
    );
  }

  if (status === STATUS.done) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-xs font-medium text-emerald-700">
          {lang === 'fa' ? 'PDF ذخیره شد!' : lang === 'ar' ? 'تم حفظ PDF!' : 'PDF saved!'}
        </span>
        <button onClick={reset} className="text-emerald-500 hover:text-emerald-700 ms-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (status === STATUS.error) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
        <span className="text-xs text-red-700 truncate max-w-32">{error}</span>
        <Button size="sm" variant="outline" className="h-7 text-xs border-red-300" onClick={handleGenerate}>
          {lang === 'fa' ? 'تلاش مجدد' : 'Retry'}
        </Button>
        <button onClick={reset}><X className="w-3.5 h-3.5 text-red-400" /></button>
      </div>
    );
  }

  return null;
}