import React from 'react';
import { useRole } from '@/lib/RoleContext';
import { ShieldOff } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function RoleGuard({ permission, children, fallback }) {
  const { can, role } = useRole();
  const { t } = useLanguage();

  if (can[permission]) return children;

  if (fallback === null) return null;

  return fallback || (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <ShieldOff className="w-8 h-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your role (<span className="font-medium capitalize">{role}</span>) does not have permission to view this page.
        </p>
      </div>
    </div>
  );
}