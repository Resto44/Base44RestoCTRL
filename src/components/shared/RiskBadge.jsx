import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/LanguageContext';

export default function RiskBadge({ creditPct }) {
  const { t } = useLanguage();

  if (creditPct === null || creditPct === undefined) {
    return <Badge variant="secondary">—</Badge>;
  }

  if (creditPct > 0.40) {
    return <Badge className="bg-red-500/15 text-red-600 border-red-200 hover:bg-red-500/20">{t('risk_high')}</Badge>;
  }
  if (creditPct > 0.20) {
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-200 hover:bg-amber-500/20">{t('risk_medium')}</Badge>;
  }
  return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20">{t('risk_low')}</Badge>;
}