-- ── FIX: CREATE MISSING menu_products TABLE ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch       TEXT,
  name         TEXT NOT NULL,
  name_ar      TEXT,
  category     TEXT,
  price        NUMERIC DEFAULT 0,
  description  TEXT,
  image_url    TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  sort_order   NUMERIC DEFAULT 0,
  addons_json  TEXT,
  created_by   TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.menu_products ENABLE ROW LEVEL SECURITY;

-- Policies for menu_products
DROP POLICY IF EXISTS "Menu products: owner manage all" ON public.menu_products;
CREATE POLICY "Menu products: owner manage all" ON public.menu_products
FOR ALL USING (
  created_by = auth.jwt() ->> 'email'
) WITH CHECK (
  created_by = auth.jwt() ->> 'email'
);

DROP POLICY IF EXISTS "Menu products: public view" ON public.menu_products;
CREATE POLICY "Menu products: public view" ON public.menu_products
FOR SELECT USING (true);

-- Ensure updated_date trigger exists
CREATE OR REPLACE FUNCTION update_updated_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_menu_products_updated ON public.menu_products;
CREATE TRIGGER trg_menu_products_updated
    BEFORE UPDATE ON public.menu_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_date();
