import React, { useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BranchSelect from '@/components/shared/BranchSelect';
import NetworkAccountSelect from '@/components/network/NetworkAccountSelect';
import SmartUploadZone from '@/components/shared/SmartUploadZone';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { Store, Receipt } from 'lucide-react';
import DeliverySummaryPanel from '@/components/sales/DeliverySummaryPanel';

const LABELS = {
  en: {
    date: 'Date', branch: 'Branch', save: 'Save', cancel: 'Cancel',
    restaurant_sales: 'Counter Sales', restaurant_cash: 'Counter Cash',
    restaurant_network: 'Counter Network', credit: 'Credit Sales',
    notes: 'Notes', optional: 'optional', proof: 'Network Proof',
    ocr_detected: '✓ OCR detected', restaurant_device: 'POS Device',
    total: 'Total',
  },
  ar: {
    date: 'التاريخ', branch: 'الفرع', save: 'حفظ', cancel: 'إلغاء',
    restaurant_sales: 'مبيعات الكاونتر', restaurant_cash: 'نقد الكاونتر',
    restaurant_network: 'شبكة الكاونتر', credit: 'مبيعات آجلة',
    notes: 'ملاحظات', optional: 'اختياري', proof: 'إثبات الشبكة',
    ocr_detected: '✓ تم اكتشاف مبلغ', restaurant_device: 'جهاز نقطة البيع',
    total: 'المجموع',
  },
  fa: {
    date: 'تاریخ', branch: 'فرع', save: 'ذخیره', cancel: 'لغو',
    restaurant_sales: 'فروش کانتر', restaurant_cash: 'نقد کانتر',
    restaurant_network: 'شبکه کانتر', credit: 'فروش نسیه',
    notes: 'یادداشت', optional: 'اختیاری', proof: 'رسید شبکه',
    ocr_detected: '✓ مبلغ شناسایی شد', restaurant_device: 'دستگاه کانتر',
    total: 'جمع کل',
  },
};

function NumInput({ label, value, onChange, highlight }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-primary/5 border border-primary/20' : 'bg-muted/60'}`}>
      <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">{label}</p>
      <Input
        type="number" inputMode="decimal" step="0.01" min="0"
        value={value || ''}
        placeholder="0"
        onChange={e => onChange(e.target.value)}
        className="text-2xl h-14 font-bold text-center border-0 bg-transparent focus-visible:ring-0 p-0"
      />
    </div>
  );
}

export default function SalesForm({ initial, onSubmit, onCancel }) {
  const { language } = useLanguage();
  const lbl = LABELS[language] || LABELS.en;
  const { managerBranch, branches } = useTenant();

  const defaultBranch = initial?.branch || managerBranch || branches[0]?.key || '';

  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    branch: defaultBranch,
    restaurant_network_account_id: '',
    credit: 0,
    notes: '',
    ...initial,
    // Normalise: prefer restaurant_ fields, fall back to legacy cash/network
    restaurant_cash: initial?.restaurant_cash ?? initial?.cash ?? 0,
    restaurant_network: initial?.restaurant_network ?? initial?.network ?? 0,
  });

  const [proofUrl, setProofUrl] = useState(initial?.proof_url || '');
  const [ocrData, setOcrData] = useState(null);
  const [zoomImg, setZoomImg] = useState(null);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleOcrResult = ({ file_url, ocr }) => {
    setProofUrl(file_url);
    setOcrData(ocr);
    if (ocr?.amount && !Number(form.restaurant_network)) {
      set('restaurant_network', ocr.amount);
    }
  };

  const rCash = Number(form.restaurant_cash) || 0;
  const rNet = Number(form.restaurant_network) || 0;
  const credit = Number(form.credit) || 0;
  const total = rCash + rNet + credit;
  const hasNetwork = rNet > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      restaurant_cash: rCash,
      restaurant_network: rNet,
      // counter sales only — delivery sales come from DeliveryOrders
      cash: rCash,
      network: rNet,
      credit,
      // clear legacy driver fields to prevent duplicates
      driver_cash: 0,
      driver_network: 0,
      driver_name: '',
      driver_employee_id: '',
      driver_network_account_id: '',
      drivers_json: '',
    };
    onSubmit(payload, proofUrl, ocrData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-2">
      {/* Date + Branch */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">{lbl.date}</Label>
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="h-10" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{lbl.branch}</Label>
          <BranchSelect value={form.branch} onChange={v => set('branch', v)} />
        </div>
      </div>

      {/* Counter Sales */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/60">
          <Store className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{lbl.restaurant_sales}</span>
          <span className="ms-auto text-xs text-primary font-bold">{(rCash + rNet).toLocaleString()}</span>
        </div>
        <div className="p-3 grid grid-cols-2 gap-3">
          <NumInput label={lbl.restaurant_cash} value={form.restaurant_cash} onChange={v => set('restaurant_cash', v)} />
          <NumInput label={lbl.restaurant_network} value={form.restaurant_network} onChange={v => set('restaurant_network', v)} highlight />
        </div>
        {hasNetwork && (
          <div className="px-3 pb-3 space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">{lbl.restaurant_device}</Label>
              <NetworkAccountSelect
                branch={form.branch}
                value={form.restaurant_network_account_id}
                onChange={v => set('restaurant_network_account_id', v)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                {lbl.proof} <span className="text-muted-foreground font-normal">({lbl.optional})</span>
              </Label>
              <SmartUploadZone
                fileUrl={proofUrl}
                onResult={handleOcrResult}
                onViewImage={() => setZoomImg(proofUrl)}
                label="Scan receipt"
              />
              {ocrData?.amount && (
                <p className="text-xs text-emerald-600 mt-1">{lbl.ocr_detected}: {ocrData.amount?.toLocaleString()}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Read-only Delivery Summary */}
      <DeliverySummaryPanel branch={form.branch} date={form.date} />

      {/* Credit + Notes */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3 bg-muted/60">
          <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">{lbl.credit}</p>
          <Input
            type="number" inputMode="decimal" step="0.01" min="0"
            value={form.credit || ''}
            placeholder="0"
            onChange={e => set('credit', e.target.value)}
            className="text-xl h-12 font-bold text-center border-0 bg-transparent focus-visible:ring-0 p-0"
          />
        </div>
        <div className="rounded-xl p-3 bg-muted/60">
          <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">{lbl.notes}</p>
          <Input
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            className="h-12 border-0 bg-transparent focus-visible:ring-0 p-0 text-sm"
            placeholder="..."
          />
        </div>
      </div>

      {/* Total */}
      <div className="bg-primary/5 rounded-xl p-4 flex justify-between items-center">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Receipt className="w-3.5 h-3.5" />
          {lbl.total}
        </div>
        <p className="text-3xl font-extrabold text-primary">{total.toLocaleString()}</p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1 h-12 text-base font-bold">{lbl.save}</Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-12">{lbl.cancel}</Button>
        )}
      </div>

      <Dialog open={!!zoomImg} onOpenChange={() => setZoomImg(null)}>
        <DialogContent className="max-w-sm p-2">
          <img src={zoomImg} alt="Proof" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </form>
  );
}