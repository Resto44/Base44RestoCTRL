/**
 * NetworkAccountSelect — v2 (rebuilt 2026-06-20)
 *
 * Loads network_accounts WHERE branch_id = selected_branch.
 * Network accounts NEVER appear in the restaurant selector.
 * Accounts appear ONLY for their own branch.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wifi } from 'lucide-react';
import { useTenant } from '@/lib/TenantContext';

export default function NetworkAccountSelect({
  branch,
  value,
  onChange,
  placeholder = 'Select network account...',
  disabled = false,
}) {
  const { activeRestaurant } = useTenant();

  const { data: accounts = [] } = useQuery({
    queryKey: ['network_accounts_select', activeRestaurant?.id, branch],
    queryFn: async () => {
      if (!activeRestaurant?.id) return [];
      const all = await base44.entities.NetworkAccount.filter(
        { restaurant_id: activeRestaurant.id },
        '-created_date',
        200
      );
      // Rule: only return accounts for the selected branch
      if (!branch) return [];
      return all.filter(a =>
        (a.status === 'active' || a.is_active) &&
        (a.branch_id === branch || a.branch === branch)
      );
    },
    staleTime: 30000,
    enabled: !!activeRestaurant?.id,
  });

  return (
    <Select value={value || ''} onValueChange={onChange} disabled={disabled || !branch}>
      <SelectTrigger>
        <SelectValue placeholder={!branch ? 'Select branch first' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {!branch && (
          <div className="px-3 py-2 text-xs text-muted-foreground">Select a branch first</div>
        )}
        {branch && accounts.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">No active accounts for this branch</div>
        )}
        {accounts.map(a => (
          <SelectItem key={a.id} value={a.id}>
            <div className="flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{a.account_name || a.network_name}</span>
              {a.account_number && (
                <span className="text-muted-foreground text-xs">#{a.account_number}</span>
              )}
              {a.network_provider && (
                <span className="text-muted-foreground text-xs">({a.network_provider})</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
