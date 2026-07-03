-- ============================================================
-- Sales Sources System Migration
-- Date: 2026-07-03
-- Description: Creates configurable sales_sources table to
--   replace all hardcoded Cash/Credit/Network sale types.
-- ============================================================

-- 1. Create sales_sources table
CREATE TABLE IF NOT EXISTS public.sales_sources (
    id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name_en                     TEXT NOT NULL,
    name_ar                     TEXT,
    name_fa                     TEXT,
    icon                        TEXT DEFAULT 'Banknote',
    color                       TEXT DEFAULT 'emerald',
    sort_order                  INTEGER DEFAULT 0,
    is_active                   BOOLEAN DEFAULT true,

    -- Feature flags
    included_in_revenue         BOOLEAN DEFAULT true,
    included_in_cash_register   BOOLEAN DEFAULT true,
    included_in_dashboard_kpi   BOOLEAN DEFAULT true,
    included_in_profit_calc     BOOLEAN DEFAULT true,

    -- Requirements
    requires_customer           BOOLEAN DEFAULT false,
    requires_pos_device         BOOLEAN DEFAULT false,
    requires_reference          BOOLEAN DEFAULT false,
    requires_wallet             BOOLEAN DEFAULT false,

    -- Scoping
    is_global                   BOOLEAN DEFAULT true,
    branch_id                   TEXT,

    default_payment_method      TEXT DEFAULT 'cash',
    description                 TEXT,

    -- System flags (protect core types from deletion)
    is_system                   BOOLEAN DEFAULT false,
    system_key                  TEXT,

    -- Standard audit fields
    created_by                  TEXT,
    created_date                TIMESTAMPTZ DEFAULT now(),
    updated_date                TIMESTAMPTZ DEFAULT now(),
    restaurant_id               TEXT
);

-- Unique constraint on system_key (per restaurant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_sources_system_key
    ON public.sales_sources (system_key, restaurant_id)
    WHERE system_key IS NOT NULL;

-- 2. Add sales_sources_json to daily_sales for dynamic source amounts
ALTER TABLE public.daily_sales
    ADD COLUMN IF NOT EXISTS sales_sources_json JSONB DEFAULT '[]'::jsonb;

-- 3. Enable Row Level Security
ALTER TABLE public.sales_sources ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "SalesSources: Owner full access" ON public.sales_sources;
DROP POLICY IF EXISTS "SalesSources: Staff read" ON public.sales_sources;

-- Owner can do everything
CREATE POLICY "SalesSources: Owner full access" ON public.sales_sources
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'owner'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'owner'
        )
    );

-- Managers and cashiers can read active sources
CREATE POLICY "SalesSources: Staff read" ON public.sales_sources
    FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
        )
    );

-- 4. Seed default sales sources
-- These will be inserted per-restaurant when the owner first visits Settings → Sales Sources.
-- Here we insert global defaults (restaurant_id = NULL) that serve as templates.

INSERT INTO public.sales_sources (
    name_en, name_ar, name_fa,
    icon, color, sort_order,
    is_active,
    included_in_revenue, included_in_cash_register,
    included_in_dashboard_kpi, included_in_profit_calc,
    requires_customer, requires_pos_device,
    requires_reference, requires_wallet,
    is_global, is_system, system_key,
    default_payment_method, description
)
VALUES
    -- 1. Cash Sale
    (
        'Cash Sale', 'مبيعات نقدية', 'فروش نقدی',
        'Banknote', 'emerald', 10,
        true,
        true, true, true, true,
        false, false, false, false,
        true, true, 'cash',
        'cash', 'Standard counter cash sales collected directly from customers.'
    ),
    -- 2. Customer Credit Sale
    (
        'Customer Credit Sale', 'مبيعات الآجل', 'فروش اعتباری',
        'UserCheck', 'amber', 20,
        true,
        true, false, true, true,
        true, false, false, false,
        true, true, 'credit',
        'credit', 'Sales on credit to registered customers with outstanding balance tracking.'
    ),
    -- 3. Network / POS Sale
    (
        'Network / POS Sale', 'مبيعات الشبكة', 'فروش شبکه',
        'CreditCard', 'violet', 30,
        true,
        true, true, true, true,
        false, true, false, false,
        true, true, 'network',
        'network', 'Electronic payments via POS terminals and network payment devices.'
    ),
    -- 4. Other Income
    (
        'Other Income', 'دخل آخر', 'درآمد دیگر',
        'PlusCircle', 'slate', 40,
        true,
        true, false, true, false,
        false, false, true, false,
        true, true, 'other',
        'other', 'Miscellaneous income not classified under standard sale types.'
    )
ON CONFLICT DO NOTHING;

-- 5. Create index for performance
CREATE INDEX IF NOT EXISTS idx_sales_sources_active ON public.sales_sources (is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_sales_sources_restaurant ON public.sales_sources (restaurant_id, is_active);

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_sources TO authenticated;
GRANT SELECT ON public.sales_sources TO anon;
