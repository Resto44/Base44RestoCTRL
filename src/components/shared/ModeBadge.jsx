/**
 * ModeBadge — Visual indicator of the current Business Mode
 * Displayed in the app header and key pages.
 */

import React from 'react';
import { UtensilsCrossed, ShoppingBag } from 'lucide-react';
import { useBusinessMode } from '@/lib/BusinessModeContext';
import { cn } from '@/lib/utils';

export default function ModeBadge({ size = 'sm', showLabel = true, className }) {
  const { isRetail, modeLabel, setMode, activeMode, BUSINESS_MODES } = useBusinessMode();

  const Icon = isRetail ? ShoppingBag : UtensilsCrossed;

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs gap-1',
    sm: 'px-2 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-sm gap-2',
  };

  const colorClasses = isRetail
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800';

  const toggleMode = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const newMode = activeMode === 'retail' ? 'restaurant' : 'retail';
    setMode(newMode);
  };

  return (
    <button 
      onClick={toggleMode}
      className={cn(
        'inline-flex items-center rounded-full font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer',
        sizeClasses[size] || sizeClasses.sm,
        colorClasses,
        className
      )}
    >
      <Icon className={cn(size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
      {showLabel && <span>{modeLabel}</span>}
    </button>
  );
}
