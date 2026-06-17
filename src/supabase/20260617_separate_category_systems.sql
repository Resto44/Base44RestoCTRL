-- ============================================================
-- MIGRATION: Separate Category Systems
-- Date: 2026-06-17
-- Purpose: Create product_categories and menu_categories as
--          independent tables, completely isolated from
--          expense_categories and the legacy categories table.
-- ============================================================

-- ── 1. PRODUCT CATEGORIES ────────────────────────────────────
-- Used exclusively by Product Management / Inventory modules.
CREATE TABLE IF NOT EXISTS public.product_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name_en       TEXT NOT NULL,
  name_ar       TEXT,
  name_fa       TEXT,
  icon          TEXT DEFAULT '📦',
  color         TEXT DEFAULT '#3B82F6',
  description   TEXT,
  parent_id     UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  is_favorite   BOOLEAN DEFAULT FALSE,
  sort_order    NUMERIC DEFAULT 0,
  created_by    TEXT,
  created_date  TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_categories_restaurant
  ON public.product_categories (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_active_sort
  ON public.product_categories (is_active, sort_order, name_en);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_categories_select" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_insert" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_update" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_delete" ON public.product_categories;

CREATE POLICY "product_categories_select"
  ON public.product_categories FOR SELECT TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE org_id = auth.email()
    )
  );

CREATE POLICY "product_categories_insert"
  ON public.product_categories FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE org_id = auth.email()
    )
  );

CREATE POLICY "product_categories_update"
  ON public.product_categories FOR UPDATE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE org_id = auth.email()
    )
  )
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE org_id = auth.email()
    )
  );

CREATE POLICY "product_categories_delete"
  ON public.product_categories FOR DELETE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE org_id = auth.email()
    )
  );

-- Auto-update updated_date trigger
DROP TRIGGER IF EXISTS trg_product_categories_updated_date ON public.product_categories;
CREATE TRIGGER trg_product_categories_updated_date
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_date();


-- ── 2. MENU CATEGORIES ───────────────────────────────────────
-- Used exclusively by Online Ordering module.
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name_en       TEXT NOT NULL,
  name_ar       TEXT,
  name_fa       TEXT,
  icon          TEXT DEFAULT '🍽',
  color         TEXT DEFAULT '#F59E0B',
  description   TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    NUMERIC DEFAULT 0,
  created_by    TEXT,
  created_date  TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant
  ON public.menu_categories (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_active_sort
  ON public.menu_categories (is_active, sort_order, name_en);

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_categories_select" ON public.menu_categories;
DROP POLICY IF EXISTS "menu_categories_insert" ON public.menu_categories;
DROP POLICY IF EXISTS "menu_categories_update" ON public.menu_categories;
DROP POLICY IF EXISTS "menu_categories_delete" ON public.menu_categories;

CREATE POLICY "menu_categories_select"
  ON public.menu_categories FOR SELECT TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE org_id = auth.email()
    )
  );

CREATE POLICY "menu_categories_insert"
  ON public.menu_categories FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE org_id = auth.email()
    )
  );

CREATE POLICY "menu_categories_update"
  ON public.menu_categories FOR UPDATE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE org_id = auth.email()
    )
  )
  WITH CHECK (
    created_by = auth.email()
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE org_id = auth.email()
    )
  );

CREATE POLICY "menu_categories_delete"
  ON public.menu_categories FOR DELETE TO authenticated
  USING (
    created_by = auth.email()
    OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE org_id = auth.email()
    )
  );

-- Also allow anon read for public-facing online ordering menu
CREATE POLICY "menu_categories_anon_select"
  ON public.menu_categories FOR SELECT TO anon
  USING (is_active = TRUE);

-- Auto-update updated_date trigger
DROP TRIGGER IF EXISTS trg_menu_categories_updated_date ON public.menu_categories;
CREATE TRIGGER trg_menu_categories_updated_date
  BEFORE UPDATE ON public.menu_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_date();


-- ── 3. ENSURE expense_categories HAS ALL REQUIRED COLUMNS ───
-- The existing expense_categories table uses 'name' column (not name_en).
-- Add name_en alias so the ExpenseCategoryManager works with both.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'expense_categories'
      AND column_name = 'name_en'
  ) THEN
    ALTER TABLE public.expense_categories ADD COLUMN name_en TEXT;
    -- Sync existing name -> name_en
    UPDATE public.expense_categories SET name_en = name WHERE name_en IS NULL;
  END IF;
END $$;

-- ── 4. VERIFICATION HELPER VIEW ──────────────────────────────
-- Provides a quick cross-table isolation check.
CREATE OR REPLACE VIEW public.v_category_isolation_check AS
SELECT 'expense_categories' AS source_table, id, name AS name_en, NULL::TEXT AS type_field
FROM public.expense_categories
UNION ALL
SELECT 'product_categories' AS source_table, id, name_en, NULL::TEXT AS type_field
FROM public.product_categories
UNION ALL
SELECT 'menu_categories' AS source_table, id, name_en, NULL::TEXT AS type_field
FROM public.menu_categories;
