import React, { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/LanguageContext';
import { useTenant } from '@/lib/TenantContext';

export default function BranchSelect({ value, onChange, includeAll = false }) {
  const { t } = useLanguage();
  const { branches, isManager } = useTenant();

  // Managers with only one branch: auto-select and hide selector
  useEffect(() => {
    if (isManager && branches.length === 1 && value !== branches[0].key) {
      onChange(branches[0].key);
    }
  }, [isManager, branches, value, onChange]);

  if (isManager && branches.length === 1) {
    return null; // manager sees only their branch — no selector needed
  }

  if (branches.length === 0) {
    return (
      <div className="text-xs text-muted-foreground px-3 py-2 border rounded-lg bg-muted/30">
        {t('no_branches_yet') || 'No branches — create one in Settings'}
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t('branch')} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && !isManager && <SelectItem value="all">{t('all_branches')}</SelectItem>}
        {branches.map(b => (
          <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}