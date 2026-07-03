/**
 * SalesSources Page — Owner-only
 * Settings → Sales Sources
 */
import React from 'react';
import { useRole, ROLES } from '@/lib/RoleContext';
import { Navigate } from 'react-router-dom';
import SalesSourcesManager from '@/components/settings/SalesSourcesManager';
import { Shield } from 'lucide-react';

export default function SalesSourcesPage() {
  const { role } = useRole();

  if (role !== ROLES.OWNER) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center p-8">
        <Shield className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-lg font-bold">Owner Access Only</h2>
        <p className="text-sm text-muted-foreground">
          Sales Sources configuration is restricted to the Owner role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <SalesSourcesManager />
    </div>
  );
}
