/**
 * Dropdown to pick a network account filtered by branch.
 * Used in SalesForm and ManagerSubmitPanel.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wifi } from 'lucide-react';

export default function NetworkAccountSelect({ branch, value, onChange, placeholder = 'Select network account...' }) {
  const { data: accounts = [] } = useQuery({
    queryKey: ['network_accounts'],
    queryFn: () => base44.entities.NetworkAccount.list('-created_date', 500),
    staleTime: 60000,
  });

  const filtered = accounts.filter(a => a.is_active && (!branch || a.branch === branch));

  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {filtered.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            {branch ? 'No active accounts for this branch' : 'Select a branch first'}
          </div>
        )}
        {filtered.map(a => (
          <SelectItem key={a.id} value={a.id}>
            <div className="flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{a.account_name}</span>
              {a.account_number && <span className="text-muted-foreground text-xs">#{a.account_number}</span>}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}