# Sales Sources Migration Strategy

## Database Schema

We will create a new `sales_sources` table to store dynamic sale types.

```sql
CREATE TABLE IF NOT EXISTS public.sales_sources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ar TEXT,
    name_fa TEXT,
    icon TEXT DEFAULT 'Banknote',
    color TEXT DEFAULT 'emerald',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    -- Feature flags
    included_in_revenue BOOLEAN DEFAULT true,
    included_in_cash_register BOOLEAN DEFAULT true,
    included_in_dashboard_kpi BOOLEAN DEFAULT true,
    included_in_profit_calc BOOLEAN DEFAULT true,
    
    -- Requirements
    requires_customer BOOLEAN DEFAULT false,
    requires_pos_device BOOLEAN DEFAULT false,
    requires_reference BOOLEAN DEFAULT false,
    requires_wallet BOOLEAN DEFAULT false,
    
    -- Scoping
    is_global BOOLEAN DEFAULT true,
    branch_id TEXT, -- NULL means global
    
    default_payment_method TEXT DEFAULT 'cash',
    description TEXT,
    
    -- System flags (prevent deletion of core types)
    is_system BOOLEAN DEFAULT false,
    system_key TEXT UNIQUE, -- 'cash', 'credit', 'network', 'other'
    
    -- Standard audit fields
    created_by TEXT,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now(),
    restaurant_id UUID REFERENCES public.restaurants(id)
);

-- Enable RLS
ALTER TABLE public.sales_sources ENABLE ROW LEVEL SECURITY;

-- Only owner can manage
CREATE POLICY "SalesSources: Owner manage" ON public.sales_sources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.email = auth.jwt()->>'email' AND profiles.role = 'owner')
  );

-- Managers and cashiers can read
CREATE POLICY "SalesSources: Staff read" ON public.sales_sources
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.email = auth.jwt()->>'email')
  );
```

## Seed Data

We need to seed the default sources:
1. Cash Sale (`system_key = 'cash'`)
2. Network / POS Sale (`system_key = 'network'`)
3. Customer Credit Sale (`system_key = 'credit'`)
4. Other Income (`system_key = 'other'`)

## Updates to Daily Sales Table

To support backward compatibility and avoid breaking reports immediately, we'll keep the `cash`, `network`, `credit` columns in `daily_sales` for now.

We will add a new JSONB column to `daily_sales` to store dynamic source amounts:
```sql
ALTER TABLE public.daily_sales ADD COLUMN IF NOT EXISTS sales_sources_json JSONB DEFAULT '[]'::jsonb;
```

This will store an array of `{ source_id, amount, entries: [] }` for each dynamic source used in that shift.

## API Entity

Add `SalesSource` to `src/api/supabaseClient.js`:
```javascript
SalesSource: createEntity('sales_sources'),
```

## Frontend Changes

1. **Settings**: Create `src/components/settings/SalesSourcesManager.jsx` and add to `SettingsPage.jsx`.
2. **Sales Workspace**: Refactor `ERPSalesWorkspace.jsx` to fetch active `SalesSources` and dynamically render the input sections instead of hardcoding POS, Credit, and Cash sections.
3. **Dashboard**: Update `SalesDashboard.jsx` to aggregate from `sales_sources_json` based on the `included_in_dashboard_kpi` flag.
4. **Shift Closing**: Update calculations to iterate over dynamic sources based on `included_in_cash_register` flag.

## Migration Steps
1. Apply SQL migration via Supabase MCP.
2. Update `supabaseClient.js`.
3. Build Settings UI.
4. Refactor Sales Workspace.
5. Update Dashboard & Reports.
6. Test.
7. Deploy to Vercel.
