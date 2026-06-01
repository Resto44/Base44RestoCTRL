import React, { useEffect } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import BranchSelect from '@/components/shared/BranchSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTenant } from '@/lib/TenantContext';

export default function DashboardFilters({ rangeType, setRangeType, branch, setBranch, customFrom, setCustomFrom, customTo, setCustomTo }) {
  const { t } = useLanguage();
  const { isManager, managerBranch } = useTenant();

  // Auto-lock managers to their branch
  useEffect(() => {
    if (isManager && managerBranch && branch !== managerBranch) {
      setBranch(managerBranch);
    }
  }, [isManager, managerBranch]);
  const ranges = ['week', 'month', 'year', 'custom'];

  return (
    <div className="space-y-3 mb-5">
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {ranges.map(r => (
          <Button
            key={r}
            size="sm"
            variant={rangeType === r ? 'default' : 'outline'}
            onClick={() => setRangeType(r)}
            className="text-xs whitespace-nowrap"
          >
            {t(r)}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <BranchSelect value={branch} onChange={setBranch} includeAll />
        </div>
      </div>
      {rangeType === 'custom' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">{t('from_date')}</label>
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">{t('to_date')}</label>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}