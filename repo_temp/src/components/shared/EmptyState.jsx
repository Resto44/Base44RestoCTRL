import React from 'react';
import { Inbox } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function EmptyState({ message }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Inbox className="w-12 h-12 mb-3 opacity-40" />
      <p className="text-sm font-medium">{message || t('no_data')}</p>
    </div>
  );
}