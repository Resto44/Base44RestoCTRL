-- ============================================================
-- ENTERPRISE CATEGORY SYSTEM — 2026-06-18
-- Complete replacement of old mixed category system
-- ============================================================

-- ── HELPER: ensure update_updated_date function exists ──────
CREATE OR REPLACE FUNCTION update_updated_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. PRODUCT CATEGORIES (3-level hierarchy)
--    Used ONLY by Product Management / Inventory
-- ============================================================
DROP TABLE IF EXISTS public.product_categories CASCADE;

CREATE TABLE public.product_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  name_ar       TEXT,
  name_fa       TEXT,
  color         TEXT DEFAULT '#3B82F6',
  icon          TEXT DEFAULT '📦',
  image_url     TEXT,
  sort_order    NUMERIC DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_categories_restaurant
  ON public.product_categories (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent
  ON public.product_categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_active_sort
  ON public.product_categories (is_active, sort_order, name);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_categories_select" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_insert" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_update" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_delete" ON public.product_categories;

CREATE POLICY "product_categories_select"
  ON public.product_categories FOR SELECT TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "product_categories_insert"
  ON public.product_categories FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "product_categories_update"
  ON public.product_categories FOR UPDATE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  )
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "product_categories_delete"
  ON public.product_categories FOR DELETE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );

DROP TRIGGER IF EXISTS trg_product_categories_updated ON public.product_categories;
CREATE TRIGGER trg_product_categories_updated
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_date();

-- ============================================================
-- 2. EXPENSE CATEGORIES (flat, no hierarchy)
--    Used ONLY by Expenses module
-- ============================================================
DROP TABLE IF EXISTS public.expense_categories CASCADE;

CREATE TABLE public.expense_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  name_ar       TEXT,
  name_fa       TEXT,
  color         TEXT DEFAULT '#EF4444',
  icon          TEXT DEFAULT '💸',
  sort_order    NUMERIC DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_restaurant
  ON public.expense_categories (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_active_sort
  ON public.expense_categories (is_active, sort_order, name);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_select" ON public.expense_categories;
DROP POLICY IF EXISTS "expense_categories_insert" ON public.expense_categories;
DROP POLICY IF EXISTS "expense_categories_update" ON public.expense_categories;
DROP POLICY IF EXISTS "expense_categories_delete" ON public.expense_categories;

CREATE POLICY "expense_categories_select"
  ON public.expense_categories FOR SELECT TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "expense_categories_insert"
  ON public.expense_categories FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "expense_categories_update"
  ON public.expense_categories FOR UPDATE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  )
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "expense_categories_delete"
  ON public.expense_categories FOR DELETE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );

DROP TRIGGER IF EXISTS trg_expense_categories_updated ON public.expense_categories;
CREATE TRIGGER trg_expense_categories_updated
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_date();

-- ============================================================
-- 3. PURCHASE CATEGORIES (flat)
--    Used ONLY by Purchases module
-- ============================================================
DROP TABLE IF EXISTS public.purchase_categories CASCADE;

CREATE TABLE public.purchase_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  name_ar       TEXT,
  name_fa       TEXT,
  color         TEXT DEFAULT '#8B5CF6',
  icon          TEXT DEFAULT '🛒',
  sort_order    NUMERIC DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_categories_restaurant
  ON public.purchase_categories (restaurant_id);

ALTER TABLE public.purchase_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_categories_select" ON public.purchase_categories;
DROP POLICY IF EXISTS "purchase_categories_insert" ON public.purchase_categories;
DROP POLICY IF EXISTS "purchase_categories_update" ON public.purchase_categories;
DROP POLICY IF EXISTS "purchase_categories_delete" ON public.purchase_categories;

CREATE POLICY "purchase_categories_select"
  ON public.purchase_categories FOR SELECT TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "purchase_categories_insert"
  ON public.purchase_categories FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "purchase_categories_update"
  ON public.purchase_categories FOR UPDATE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  )
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "purchase_categories_delete"
  ON public.purchase_categories FOR DELETE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );

DROP TRIGGER IF EXISTS trg_purchase_categories_updated ON public.purchase_categories;
CREATE TRIGGER trg_purchase_categories_updated
  BEFORE UPDATE ON public.purchase_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_date();

-- ============================================================
-- 4. SALES CATEGORIES (flat)
--    Used ONLY by Sales module
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  name_ar       TEXT,
  name_fa       TEXT,
  color         TEXT DEFAULT '#10B981',
  icon          TEXT DEFAULT '💰',
  sort_order    NUMERIC DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_categories_restaurant
  ON public.sales_categories (restaurant_id);

ALTER TABLE public.sales_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_categories_select" ON public.sales_categories;
DROP POLICY IF EXISTS "sales_categories_insert" ON public.sales_categories;
DROP POLICY IF EXISTS "sales_categories_update" ON public.sales_categories;
DROP POLICY IF EXISTS "sales_categories_delete" ON public.sales_categories;

CREATE POLICY "sales_categories_select"
  ON public.sales_categories FOR SELECT TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "sales_categories_insert"
  ON public.sales_categories FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "sales_categories_update"
  ON public.sales_categories FOR UPDATE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  )
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "sales_categories_delete"
  ON public.sales_categories FOR DELETE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );

DROP TRIGGER IF EXISTS trg_sales_categories_updated ON public.sales_categories;
CREATE TRIGGER trg_sales_categories_updated
  BEFORE UPDATE ON public.sales_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_date();

-- ============================================================
-- 5. ONLINE ORDER CATEGORIES (flat)
--    Used ONLY by Online Ordering module
-- ============================================================
DROP TABLE IF EXISTS public.menu_categories CASCADE;

CREATE TABLE public.online_order_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  name_ar       TEXT,
  name_fa       TEXT,
  color         TEXT DEFAULT '#F59E0B',
  icon          TEXT DEFAULT '🍽',
  image_url     TEXT,
  sort_order    NUMERIC DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_online_order_categories_restaurant
  ON public.online_order_categories (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_online_order_categories_active_sort
  ON public.online_order_categories (is_active, sort_order, name);

ALTER TABLE public.online_order_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "online_order_categories_select" ON public.online_order_categories;
DROP POLICY IF EXISTS "online_order_categories_insert" ON public.online_order_categories;
DROP POLICY IF EXISTS "online_order_categories_update" ON public.online_order_categories;
DROP POLICY IF EXISTS "online_order_categories_delete" ON public.online_order_categories;
DROP POLICY IF EXISTS "online_order_categories_anon_select" ON public.online_order_categories;

CREATE POLICY "online_order_categories_select"
  ON public.online_order_categories FOR SELECT TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "online_order_categories_insert"
  ON public.online_order_categories FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "online_order_categories_update"
  ON public.online_order_categories FOR UPDATE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  )
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
CREATE POLICY "online_order_categories_delete"
  ON public.online_order_categories FOR DELETE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (SELECT id FROM public.restaurants WHERE org_id = auth.email())
  );
-- Public read for online ordering storefront
CREATE POLICY "online_order_categories_anon_select"
  ON public.online_order_categories FOR SELECT TO anon
  USING (is_active = TRUE);

DROP TRIGGER IF EXISTS trg_online_order_categories_updated ON public.online_order_categories;
CREATE TRIGGER trg_online_order_categories_updated
  BEFORE UPDATE ON public.online_order_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_date();

-- ============================================================
-- 6. MIGRATE EXISTING DATA
-- ============================================================

-- Migrate old expense_categories data (was using 'name' column)
-- Already handled by DROP + CREATE above with fresh table.
-- Migrate old categories table data into product_categories
INSERT INTO public.product_categories (
  restaurant_id, name, name_ar, name_fa, color, icon, sort_order, is_active, created_by, created_at
)
SELECT
  restaurant_id,
  COALESCE(name_en, 'Unnamed') AS name,
  name_ar,
  name_fa,
  COALESCE(color, '#3B82F6'),
  COALESCE(icon, '📦'),
  COALESCE(sort_order, 0),
  COALESCE(is_active, TRUE),
  created_by,
  COALESCE(created_date, NOW())
FROM public.categories
WHERE category_type = 'product' OR category_type IS NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. ADD category_id COLUMNS TO PRODUCTS (if not present)
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;

-- ============================================================
-- 8. ADD category_id TO PURCHASES (if not present)
-- ============================================================
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS purchase_category_id UUID REFERENCES public.purchase_categories(id) ON DELETE SET NULL;

-- ============================================================
-- 9. ADD category_id TO EXPENSES (if not present)
-- ============================================================
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL;

-- ============================================================
-- 10. VERIFICATION VIEW
-- ============================================================
CREATE OR REPLACE VIEW public.v_category_system_check AS
SELECT 'product_categories'       AS module, COUNT(*) AS row_count FROM public.product_categories
UNION ALL
SELECT 'expense_categories'       AS module, COUNT(*) AS row_count FROM public.expense_categories
UNION ALL
SELECT 'purchase_categories'      AS module, COUNT(*) AS row_count FROM public.purchase_categories
UNION ALL
SELECT 'sales_categories'         AS module, COUNT(*) AS row_count FROM public.sales_categories
UNION ALL
SELECT 'online_order_categories'  AS module, COUNT(*) AS row_count FROM public.online_order_categories;
