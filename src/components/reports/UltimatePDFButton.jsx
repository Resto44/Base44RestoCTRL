/**
 * UltimatePDFButton — compact trigger for 10-page executive PDF.
 * Delegates to generateUltimatePDF from pdfGenerator.js
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { generateUltimatePDF } from '@/lib/pdfGenerator';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/lib/TenantContext';

export default function UltimatePDFButton({ sales, purchases, expenses, rangeType, fromStr, toStr }) {
  const { t, lang, currency, branches, dir } = useLanguage();
  const { branches: tenantBranches, activeRestaurant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
  const { data: walletTransactions = [] } = useQuery({
    queryKey: ['wallet_transactions'],
    queryFn: () => base44.entities.WalletTransaction.list('-transaction_date', 2000),
  });

  const brandSettings = brandSettingsList[0] || null;
  const effectiveBranches = tenantBranches?.length > 0 ? tenantBranches : branches?.length > 0 ? branches : [{ key: 'main', label: 'Main Branch' }];

  const handleClick = async () => {
    setLoading(true);
    setDone(false);
    try {
      await generateUltimatePDF({
        sales, purchases, expenses, rangeType, fromStr, toStr,
        t, lang, currency,
        branches: effectiveBranches,
        dir,
        brandSettings,
        inventory,
        supplierInvoices,
        walletTransactions,
      });
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Button size="sm" variant="outline" className="gap-1 text-emerald-600 border-emerald-300" onClick={() => setDone(false)}>
        <CheckCircle2 className="w-4 h-4" />
        {lang === 'fa' ? 'ذخیره شد!' : lang === 'ar' ? 'تم الحفظ!' : 'Saved!'}
      </Button>
    );
  }

  return (
    <Button size="sm" variant="default" onClick={handleClick} disabled={loading} className="gap-1">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
      {loading
        ? (lang === 'fa' ? 'در حال تولید...' : lang === 'ar' ? 'جارٍ الإنشاء...' : 'Generating...')
        : (lang === 'fa' ? 'PDF اجرایی' : lang === 'ar' ? 'PDF تنفيذي' : 'Executive PDF')}
    </Button>
  );
}