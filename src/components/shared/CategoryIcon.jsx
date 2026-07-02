import React from 'react';
import * as LucideIcons from 'lucide-react';
import { HelpCircle, Layers } from 'lucide-react';

/**
 * Shared component to render category icons.
 * Supports both legacy emojis and new Lucide icon names.
 */
export function CategoryIcon({ icon, color, className = "w-4 h-4" }) {
  if (!icon) return <Layers className={className} />;
  
  // Check if it's an emoji (legacy support)
  if (icon.length <= 2) {
    return <span className={`leading-none shrink-0 ${className.includes('w-') ? '' : 'text-base'}`}>{icon}</span>;
  }

  // Lucide icon support
  const IconComponent = LucideIcons[icon] || HelpCircle;
  return <IconComponent className={className} style={{ color: color || 'inherit' }} />;
}

export default CategoryIcon;
