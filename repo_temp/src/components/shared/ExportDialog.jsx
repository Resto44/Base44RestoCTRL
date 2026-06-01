import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BranchSelect from '@/components/shared/BranchSelect';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';
import { getDateRange, formatDate } from '@/lib/helpers';
import { FileText, FileSpreadsheet, Download } from 'lucide-react';
import { format } from 'date-fns';

const RANGE_KEYS = ['week', 'month', 'year', 'custom'];

export default function ExportDialog({ open, onClose, onExport, title }) {
  const { t } = useLanguage();
  const { isManager, managerBranch } = useTenant();

  const [rangeType, setRangeType] = useState('month');
  const [branch, setBranch] = useState(() => managerBranch || 'all');
  const [customFrom, setCustomFrom] = useState(format(new Date(), 'yyyy-MM-01'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const getRange = () => {
    if (rangeType === 'custom') {
      return { from: customFrom, to: customTo };
    }
    const range = getDateRange(rangeType);
    return { from: formatDate(range.from), to: formatDate(range.to) };
  };

  const handleExport = (format) => {
    const { from, to } = getRange();
    onExport({ format, from, to, branch });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            {t('export_csv')} / PDF — {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Date range selector */}
          <div>
            <Label className="text-xs mb-2 block">{t('filter')}</Label>
            <div className="flex gap-1.5 flex-wrap">
              {RANGE_KEYS.map(r => (
                <Button
                  key={r}
                  size="sm"
                  variant={rangeType === r ? 'default' : 'outline'}
                  onClick={() => setRangeType(r)}
                  className="text-xs h-7 px-2.5"
                >
                  {t(r)}
                </Button>
              ))}
            </div>
          </div>

          {rangeType === 'custom' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">{t('from_date')}</Label>
                <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              </div>
              <div className="flex-1">
                <Label className="text-xs">{t('to_date')}</Label>
                <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}

          {/* Branch selector */}
          <div>
            <Label className="text-xs mb-1.5 block">{t('branch')}</Label>
            <BranchSelect value={branch} onChange={setBranch} includeAll />
          </div>

          {/* Export buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => handleExport('csv')}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              CSV
            </Button>
            <Button
              className="flex items-center gap-2"
              onClick={() => handleExport('pdf')}
            >
              <FileText className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}