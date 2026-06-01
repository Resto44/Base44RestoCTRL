import React from 'react';
import { useTenant } from '@/lib/TenantContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RestaurantSwitcher() {
  const { restaurants, activeRestaurant, setActiveRestaurant, loadingRestaurants } = useTenant();

  if (loadingRestaurants) return <div className="w-32 h-8 bg-muted animate-pulse rounded-md" />;
  if (restaurants.length === 0) {
    return (
      <Link to="/restaurants" className="flex items-center gap-1.5 text-xs text-primary font-medium px-2 py-1 rounded-md border border-primary/30 hover:bg-primary/5">
        <Building2 className="w-3.5 h-3.5" />
        Setup Restaurant
      </Link>
    );
  }

  if (restaurants.length === 1) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground max-w-[140px] truncate">
        <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="truncate">{activeRestaurant?.name || ''}</span>
      </div>
    );
  }

  return (
    <Select value={activeRestaurant?.id || ''} onValueChange={setActiveRestaurant}>
      <SelectTrigger className="h-8 text-xs gap-1 border-primary/20 max-w-[160px]">
        <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
        <SelectValue placeholder="Select restaurant" />
      </SelectTrigger>
      <SelectContent>
        {restaurants.map(r => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}