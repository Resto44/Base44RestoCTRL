-- ═══════════════════════════════════════════════════════════════════════════
-- PRODUCT MANAGEMENT SYSTEM — FULL SCHEMA MIGRATION
-- RestoCTRL44 | Supabase Project: mqubwgbppncldyiicbtu
-- Date: 2026-06-15
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. EXTEND products TABLE with all required fields ───────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS name_en         TEXT,
  ADD COLUMN IF NOT EXISTS name_fa         TEXT,
  ADD COLUMN IF NOT EXISTS sku             TEXT,
  ADD COLUMN IF NOT EXISTS barcode         TEXT,
  ADD COLUMN IF NOT EXISTS qr_code         TEXT,
  ADD COLUMN IF NOT EXISTS sub_category_id UUID,
  ADD COLUMN IF NOT EXISTS brand           TEXT,
  ADD COLUMN IF NOT EXISTS supplier_id     UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchase_cost   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate        NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_stock       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_stock   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url       TEXT,
  ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','discontinued'));

-- Backfill selling_price and purchase_cost from existing columns
UPDATE products SET selling_price = COALESCE(default_price, 0) WHERE selling_price = 0;
UPDATE products SET purchase_cost = COALESCE(default_cost, 0) WHERE purchase_cost = 0;

-- ── 2. EXTEND categories TABLE with parent/child hierarchy ──────────────────
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS sort_order      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS color           TEXT,
  ADD COLUMN IF NOT EXISTS icon            TEXT;

-- ── 3. UNITS TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_units (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  abbreviation  TEXT,
  type          TEXT DEFAULT 'custom' CHECK (type IN ('weight','volume','count','custom')),
  is_system     BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INTEGER DEFAULT 0,
  created_by    TEXT,
  created_date  TIMESTAMPTZ DEFAULT NOW(),
  updated_date  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;

-- Seed system units (global, no restaurant_id)
INSERT INTO product_units (name, abbreviation, type, is_system, sort_order) VALUES
  ('Kilogram',  'KG',     'weight', TRUE, 1),
  ('Gram',      'g',      'weight', TRUE, 2),
  ('Piece',     'pcs',    'count',  TRUE, 3),
  ('Box',       'box',    'count',  TRUE, 4),
  ('Carton',    'ctn',    'count',  TRUE, 5),
  ('Liter',     'L',      'volume', TRUE, 6),
  ('Milliliter','mL',     'volume', TRUE, 7)
ON CONFLICT DO NOTHING;

-- ── 4. PRODUCT VARIANTS TABLE ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  restaurant_id  UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  name_ar        TEXT,
  name_en        TEXT,
  sku_suffix     TEXT,
  cost_price     NUMERIC DEFAULT 0,
  selling_price  NUMERIC DEFAULT 0,
  stock_impact   NUMERIC DEFAULT 1,
  current_stock  NUMERIC DEFAULT 0,
  is_active      BOOLEAN DEFAULT TRUE,
  sort_order     INTEGER DEFAULT 0,
  created_by     TEXT,
  created_date   TIMESTAMPTZ DEFAULT NOW(),
  updated_date   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- ── 5. INVENTORY TRANSACTIONS TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id      UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'stock_in','stock_out','purchase','recipe_consumption',
    'transfer_in','transfer_out','waste','adjustment','opening'
  )),
  quantity        NUMERIC NOT NULL,
  unit_cost       NUMERIC DEFAULT 0,
  reference_id    UUID,
  reference_type  TEXT,
  notes           TEXT,
  created_by      TEXT,
  created_date    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- ── 6. PRODUCT ANALYTICS SNAPSHOT TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  period_date     DATE NOT NULL,
  units_sold      NUMERIC DEFAULT 0,
  revenue         NUMERIC DEFAULT 0,
  cost_of_goods   NUMERIC DEFAULT 0,
  gross_profit    NUMERIC DEFAULT 0,
  waste_qty       NUMERIC DEFAULT 0,
  purchase_qty    NUMERIC DEFAULT 0,
  created_date    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (restaurant_id, product_id, period_date)
);
ALTER TABLE product_analytics ENABLE ROW LEVEL SECURITY;

-- ── 7. TRIGGERS for updated_date ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_date_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_date = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_units_updated') THEN
    CREATE TRIGGER trg_product_units_updated
      BEFORE UPDATE ON product_units
      FOR EACH ROW EXECUTE FUNCTION update_updated_date_fn();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_variants_updated') THEN
    CREATE TRIGGER trg_product_variants_updated
      BEFORE UPDATE ON product_variants
      FOR EACH ROW EXECUTE FUNCTION update_updated_date_fn();
  END IF;
END $$;

-- ── 8. INDEXES ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_restaurant ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku        ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode    ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_status     ON products(status);
CREATE INDEX IF NOT EXISTS idx_variants_product    ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_product      ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_type         ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_analytics_product   ON product_analytics(product_id, period_date);
CREATE INDEX IF NOT EXISTS idx_categories_parent   ON categories(parent_id);

-- ── 9. RLS POLICIES ──────────────────────────────────────────────────────────

-- product_units: system units visible to all, restaurant units scoped
DROP POLICY IF EXISTS "product_units_select" ON product_units;
CREATE POLICY "product_units_select" ON product_units FOR SELECT
  USING (is_system = TRUE OR restaurant_id IN (
    SELECT p.restaurant_id FROM profiles p WHERE p.id = auth.uid()
  ));

DROP POLICY IF EXISTS "product_units_manage" ON product_units;
CREATE POLICY "product_units_manage" ON product_units FOR ALL
  USING (is_system = FALSE AND restaurant_id IN (
    SELECT r.id FROM restaurants r WHERE r.org_id = (auth.jwt() ->> 'email')
  ));

-- product_variants
DROP POLICY IF EXISTS "variants_select" ON product_variants;
CREATE POLICY "variants_select" ON product_variants FOR SELECT
  USING (restaurant_id IN (
    SELECT p.restaurant_id FROM profiles p WHERE p.id = auth.uid()
  ));

DROP POLICY IF EXISTS "variants_manage" ON product_variants;
CREATE POLICY "variants_manage" ON product_variants FOR ALL
  USING (restaurant_id IN (
    SELECT r.id FROM restaurants r WHERE r.org_id = (auth.jwt() ->> 'email')
  ));

-- inventory_transactions
DROP POLICY IF EXISTS "inv_tx_select" ON inventory_transactions;
CREATE POLICY "inv_tx_select" ON inventory_transactions FOR SELECT
  USING (restaurant_id IN (
    SELECT p.restaurant_id FROM profiles p WHERE p.id = auth.uid()
  ));

DROP POLICY IF EXISTS "inv_tx_manage" ON inventory_transactions;
CREATE POLICY "inv_tx_manage" ON inventory_transactions FOR ALL
  USING (restaurant_id IN (
    SELECT r.id FROM restaurants r WHERE r.org_id = (auth.jwt() ->> 'email')
  ));

-- product_analytics
DROP POLICY IF EXISTS "analytics_select" ON product_analytics;
CREATE POLICY "analytics_select" ON product_analytics FOR SELECT
  USING (restaurant_id IN (
    SELECT p.restaurant_id FROM profiles p WHERE p.id = auth.uid()
  ));

DROP POLICY IF EXISTS "analytics_manage" ON product_analytics;
CREATE POLICY "analytics_manage" ON product_analytics FOR ALL
  USING (restaurant_id IN (
    SELECT r.id FROM restaurants r WHERE r.org_id = (auth.jwt() ->> 'email')
  ));

-- ── 10. FUNCTION: update product current_stock from transactions ─────────────
CREATE OR REPLACE FUNCTION sync_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_delta NUMERIC;
BEGIN
  -- Determine stock delta based on transaction type
  IF NEW.transaction_type IN ('stock_in','purchase','transfer_in','opening') THEN
    v_delta := NEW.quantity;
  ELSIF NEW.transaction_type IN ('stock_out','recipe_consumption','transfer_out','waste') THEN
    v_delta := -NEW.quantity;
  ELSIF NEW.transaction_type = 'adjustment' THEN
    v_delta := NEW.quantity; -- can be negative
  ELSE
    v_delta := 0;
  END IF;

  UPDATE products
    SET current_stock = COALESCE(current_stock, 0) + v_delta,
        updated_date  = NOW()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stock ON inventory_transactions;
CREATE TRIGGER trg_sync_stock
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION sync_product_stock();
