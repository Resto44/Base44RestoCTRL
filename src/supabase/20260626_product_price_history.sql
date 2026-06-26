-- ============================================================
-- Product Price History — 2026-06-26
-- Tracks every purchase-price change for analytics
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS product_price_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       text        NOT NULL,
  product_name     text        NOT NULL,
  previous_price   numeric(12,4) NOT NULL DEFAULT 0,
  new_price        numeric(12,4) NOT NULL,
  difference       numeric(12,4) GENERATED ALWAYS AS (new_price - previous_price) STORED,
  pct_change       numeric(8,4)  GENERATED ALWAYS AS (
    CASE WHEN previous_price = 0 THEN NULL
         ELSE ROUND(((new_price - previous_price) / previous_price) * 100, 4)
    END
  ) STORED,
  supplier_id      text,
  supplier_name    text,
  branch           text,
  invoice_id       text,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  created_by       text        NOT NULL
);

-- 2. Indexes for fast analytics queries
CREATE INDEX IF NOT EXISTS idx_pph_product_id   ON product_price_history (product_id);
CREATE INDEX IF NOT EXISTS idx_pph_recorded_at  ON product_price_history (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_pph_created_by   ON product_price_history (created_by);
CREATE INDEX IF NOT EXISTS idx_pph_branch       ON product_price_history (branch);

-- 3. Enable RLS
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;

-- 4. Owner: full access to their own rows
CREATE POLICY "owner_all_pph" ON product_price_history
  FOR ALL USING (created_by = auth.jwt()->>'email')
  WITH CHECK (created_by = auth.jwt()->>'email');

-- 5. Staff: read rows for their branch
CREATE POLICY "staff_read_pph" ON product_price_history
  FOR SELECT USING (
    branch = (
      SELECT branch FROM employees
      WHERE email = auth.jwt()->>'email'
      LIMIT 1
    )
  );
